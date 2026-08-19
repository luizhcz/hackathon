import {
  CodexRuntimeError,
  type CodexRunRequest,
  type CodexRunResult,
  type CodexRuntime,
} from "../codex/codex-runtime";
import { CATALOGADOR_PROMPT, precificadorPrompt, redatorPrompt } from "../codex/prompts";
import { catalogadorSchema, precificadorSchema, redatorSchema } from "../domain/schemas";
import type { CatalogadorOut, Job, PassoId, PrecificadorOut, RedatorOut } from "../domain/types";
import { writeFromTemplate } from "./fallback-writer";
import type { JobStore, PendingAuditEvent } from "./job-store";
import { priceFromLocalTable } from "./local-price";
import { normalizeIdentification } from "./normalize-identification";

function updateStep(job: Job, id: PassoId, update: Partial<Job["passos"][number]>): Job {
  return {
    ...job,
    passos: job.passos.map((step) => (step.id === id ? { ...step, ...update } : step)) as Job["passos"],
  };
}

function brl(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function runWithTimeout<T>(
  runtime: CodexRuntime,
  request: Omit<CodexRunRequest<T>, "signal">,
  timeoutMs: number,
): Promise<CodexRunResult<T>> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await runtime.run({ ...request, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new StageTimeoutError(error);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

class StageTimeoutError extends Error {
  constructor(cause: unknown) {
    super("A etapa excedeu seu limite de tempo.", { cause });
    this.name = "StageTimeoutError";
  }
}

function failureCode(error: unknown): string {
  if (error instanceof StageTimeoutError) return "TIMEOUT";
  if (error instanceof CodexRuntimeError) {
    return error.code === "FAILED" ? "RUNTIME_FAILED" : error.code;
  }
  return "RUNTIME_FAILED";
}

export function createJobProcessor({
  store,
  runtime,
  timeouts = { catalogador: 20_000, precificador: 30_000, redator: 15_000 },
}: {
  store: JobStore;
  runtime: CodexRuntime;
  timeouts?: { catalogador: number; precificador: number; redator: number };
}) {
  return {
    async process(id: string): Promise<void> {
      const image = store.getImage(id);
      if (!image || !store.getJob(id)) throw new Error(`Job não encontrado: ${id}`);

      store.updateJobWithAudit(
        id,
        (job) => updateStep(job, "identificar", { status: "rodando" }),
        [{
          type: "stage.started",
          stage: "catalogador",
          status: "started",
          summary: "Catalogador iniciado.",
        }],
      );
      const catalogStart = Date.now();
      let produto: CatalogadorOut;
      try {
        const result = await runWithTimeout(runtime, {
          profile: "catalogador",
          prompt: CATALOGADOR_PROMPT,
          schema: catalogadorSchema,
          image,
          webSearch: "disabled",
        }, timeouts.catalogador);
        produto = normalizeIdentification(result.value);
      } catch (error) {
        const duration = Date.now() - catalogStart;
        const code = failureCode(error);
        store.updateJobWithAudit(id, (job) => ({
          ...updateStep(
            updateStep(
              updateStep(
                updateStep(job, "identificar", {
                  status: "falhou",
                  resumo: "Falha na identificação — revisão necessária",
                  ms: duration,
                }),
                "precificar",
                { status: "ignorado" },
              ),
              "redigir",
              { status: "ignorado" },
            ),
            "publicar",
            { status: "aguardando" },
          ),
          status: "excecao",
          motivo_excecao: "falha_catalogacao",
          revisao: { necessaria: true, concluida_em: null },
        }), [{
          type: "stage.failed",
          stage: "catalogador",
          status: "failed",
          duration_ms: duration,
          code,
          summary:
            code === "TIMEOUT"
              ? `Catalogador excedeu o limite de ${timeouts.catalogador} ms; encaminhado para revisão humana.`
              : "Catalogador não concluiu; encaminhado para revisão humana.",
        }]);
        return;
      }
      const motivoExcecao =
        produto.categoria === null
          ? "categoria_desconhecida"
          : produto.confianca === "baixa"
            ? "confianca_baixa"
            : null;

      if (motivoExcecao) {
        const duration = Date.now() - catalogStart;
        store.updateJobWithAudit(id, (job) => ({
          ...updateStep(
            updateStep(
              updateStep(
                updateStep(job, "identificar", {
                  status: "falhou",
                  resumo:
                    motivoExcecao === "categoria_desconhecida"
                      ? "Categoria desconhecida — revisão necessária"
                      : "Confiança baixa — revisão necessária",
                  ms: duration,
                }),
                "precificar",
                { status: "ignorado" },
              ),
              "redigir",
              { status: "ignorado" },
            ),
            "publicar",
            { status: "aguardando" },
          ),
          produto,
          status: "excecao",
          motivo_excecao: motivoExcecao,
          revisao: { necessaria: true, concluida_em: null },
        }), [{
          type: "stage.completed",
          stage: "catalogador",
          status: "completed",
          duration_ms: duration,
          summary: "Catalogador concluiu a Identificação para revisão humana.",
        }]);
        return;
      }

      store.updateJobWithAudit(id, (job) => ({
        ...updateStep(job, "identificar", {
          status: "ok",
          resumo: [produto.marca, produto.produto, produto.quantidade].filter(Boolean).join(" "),
          ms: Date.now() - catalogStart,
        }),
        produto,
      }), [{
        type: "stage.completed",
        stage: "catalogador",
        status: "completed",
        duration_ms: Date.now() - catalogStart,
        summary: "Catalogador concluiu a Identificação.",
      }]);

      store.updateJobWithAudit(
        id,
        (job) => updateStep(job, "precificar", { status: "rodando" }),
        [{
          type: "stage.started",
          stage: "precificador",
          status: "started",
          summary: "Precificador iniciado.",
        }],
      );
      const priceStart = Date.now();
      let preco: PrecificadorOut;
      let priceError: unknown = null;
      const livePricing = store.getJob(id)?.modo_execucao === "live";
      let usedLocalPrice = !livePricing;
      if (livePricing) {
        try {
          const result = await runWithTimeout(runtime, {
            profile: "precificador",
            prompt: precificadorPrompt(produto),
            schema: precificadorSchema,
            webSearch: "live",
          }, timeouts.precificador);
          preco = result.value;
        } catch (error) {
          priceError = error;
          usedLocalPrice = true;
          preco = priceFromLocalTable(produto);
        }
      } else {
        preco = priceFromLocalTable(produto);
      }
      const priceSummary = usedLocalPrice
        ? `R$ ${preco.preco_min}–${preco.preco_max} · tabela local · faixa da categoria`
        : `R$ ${brl(preco.preco_sugerido)} · ${preco.referencias.length} referências · ${preco.precisao.replace("_", " ")}`;
      const priceDuration = Date.now() - priceStart;
      const priceEvents: PendingAuditEvent[] = priceError
        ? [
            {
              type: "stage.failed",
              stage: "precificador",
              status: "failed",
              duration_ms: priceDuration,
              code: failureCode(priceError),
              summary: "Precificador não concluiu; usando a tabela local.",
            },
            {
              type: "fallback.applied",
              stage: "precificador",
              status: "applied",
              code: "LOCAL_PRICE_TABLE",
              summary: "Tabela local aplicada ao preço.",
            },
          ]
        : [
            {
              type: "stage.completed",
              stage: "precificador",
              status: "completed",
              duration_ms: priceDuration,
              summary: "Precificador concluiu o preço.",
            },
            ...(usedLocalPrice
              ? [{
                  type: "fallback.applied" as const,
                  stage: "precificador" as const,
                  status: "applied" as const,
                  code: "LOCAL_PRICE_TABLE",
                  summary: "Tabela local aplicada ao preço.",
                }]
              : []),
          ];
      store.updateJobWithAudit(id, (job) => ({
        ...updateStep(job, "precificar", {
          status: "ok",
          resumo: priceSummary,
          ms: priceDuration,
        }),
        preco,
      }), priceEvents);

      store.updateJobWithAudit(
        id,
        (job) => updateStep(job, "redigir", { status: "rodando" }),
        [{
          type: "stage.started",
          stage: "redator",
          status: "started",
          summary: "Redator iniciado.",
        }],
      );
      const writingStart = Date.now();
      let anuncio: RedatorOut;
      let writingSummary: string;
      let writingError: unknown = null;
      try {
        const result = await runWithTimeout(runtime, {
          profile: "redator",
          prompt: redatorPrompt({ produto, preco }),
          schema: redatorSchema,
          webSearch: "disabled",
        }, timeouts.redator);
        anuncio = result.value;
        writingSummary = `Título com ${anuncio.titulo.length} caracteres, ${anuncio.tags.length} tags`;
      } catch (error) {
        writingError = error;
        anuncio = writeFromTemplate(produto, preco);
        writingSummary = "Texto gerado por template local";
      }
      const writingDuration = Date.now() - writingStart;
      const writingEvents: PendingAuditEvent[] = writingError
        ? [
            {
              type: "stage.failed",
              stage: "redator",
              status: "failed",
              duration_ms: writingDuration,
              code: failureCode(writingError),
              summary: "Redator não concluiu; usando o template local.",
            },
            {
              type: "fallback.applied",
              stage: "redator",
              status: "applied",
              code: "LOCAL_WRITER_TEMPLATE",
              summary: "Template local aplicado ao Anúncio.",
            },
          ]
        : [{
            type: "stage.completed",
            stage: "redator",
            status: "completed",
            duration_ms: writingDuration,
            summary: "Redator concluiu o Anúncio.",
          }];
      store.updateJobWithAudit(id, (job) => ({
        ...updateStep(updateStep(job, "redigir", {
          status: "ok",
          resumo: writingSummary,
          ms: writingDuration,
        }), "publicar", { status: "aguardando" }),
        anuncio,
        status: "aguardando",
      }), writingEvents);
    },
  };
}
