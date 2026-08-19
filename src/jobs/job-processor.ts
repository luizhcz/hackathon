import type { CodexRunRequest, CodexRunResult, CodexRuntime } from "../codex/codex-runtime";
import { CATALOGADOR_PROMPT, precificadorPrompt, redatorPrompt } from "../codex/prompts";
import { catalogadorSchema, precificadorSchema, redatorSchema } from "../domain/schemas";
import type { CatalogadorOut, Job, PassoId, PrecificadorOut, RedatorOut } from "../domain/types";
import { writeFromTemplate } from "./fallback-writer";
import type { JobStore } from "./job-store";
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
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await runtime.run({ ...request, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function createJobProcessor({
  store,
  runtime,
  timeouts = { catalogador: 20_000, precificador: 8_000, redator: 15_000 },
}: {
  store: JobStore;
  runtime: CodexRuntime;
  timeouts?: { catalogador: number; precificador: number; redator: number };
}) {
  return {
    async process(id: string): Promise<void> {
      const image = store.getImage(id);
      if (!image || !store.getJob(id)) throw new Error(`Job não encontrado: ${id}`);

      store.updateJob(id, (job) => updateStep(job, "identificar", { status: "rodando" }));
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
      } catch {
        store.updateJob(id, (job) => ({
          ...updateStep(
            updateStep(
              updateStep(
                updateStep(job, "identificar", {
                  status: "falhou",
                  resumo: "Falha na identificação — revisão necessária",
                  ms: Date.now() - catalogStart,
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
        }));
        return;
      }
      const motivoExcecao =
        produto.categoria === null
          ? "categoria_desconhecida"
          : produto.confianca === "baixa"
            ? "confianca_baixa"
            : null;

      if (motivoExcecao) {
        store.updateJob(id, (job) => ({
          ...updateStep(
            updateStep(
              updateStep(
                updateStep(job, "identificar", {
                  status: "falhou",
                  resumo:
                    motivoExcecao === "categoria_desconhecida"
                      ? "Categoria desconhecida — revisão necessária"
                      : "Confiança baixa — revisão necessária",
                  ms: Date.now() - catalogStart,
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
        }));
        return;
      }

      store.updateJob(id, (job) => ({
        ...updateStep(job, "identificar", {
          status: "ok",
          resumo: [produto.marca, produto.produto, produto.quantidade].filter(Boolean).join(" "),
          ms: Date.now() - catalogStart,
        }),
        produto,
      }));

      store.updateJob(id, (job) => updateStep(job, "precificar", { status: "rodando" }));
      const priceStart = Date.now();
      let preco: PrecificadorOut;
      if (store.getJob(id)?.modo_execucao === "live") {
        try {
          const result = await runWithTimeout(runtime, {
            profile: "precificador",
            prompt: precificadorPrompt(produto),
            schema: precificadorSchema,
            webSearch: "live",
          }, timeouts.precificador);
          preco = result.value;
        } catch {
          preco = priceFromLocalTable(produto);
        }
      } else {
        preco = priceFromLocalTable(produto);
      }
      const priceSummary = preco.degradado
        ? `R$ ${preco.preco_min}–${preco.preco_max} · tabela local · faixa da categoria`
        : `R$ ${brl(preco.preco_sugerido)} · ${preco.referencias.length} referências · item exato`;
      store.updateJob(id, (job) => ({
        ...updateStep(job, "precificar", {
          status: "ok",
          resumo: priceSummary,
          ms: Date.now() - priceStart,
        }),
        preco,
      }));

      store.updateJob(id, (job) => updateStep(job, "redigir", { status: "rodando" }));
      const writingStart = Date.now();
      let anuncio: RedatorOut;
      let writingSummary: string;
      try {
        const result = await runWithTimeout(runtime, {
          profile: "redator",
          prompt: redatorPrompt({ produto, preco }),
          schema: redatorSchema,
          webSearch: "disabled",
        }, timeouts.redator);
        anuncio = result.value;
        writingSummary = `Título com ${anuncio.titulo.length} caracteres, ${anuncio.tags.length} tags`;
      } catch {
        anuncio = writeFromTemplate(produto, preco);
        writingSummary = "Texto gerado por template local";
      }
      store.updateJob(id, (job) => ({
        ...updateStep(updateStep(job, "redigir", {
          status: "ok",
          resumo: writingSummary,
          ms: Date.now() - writingStart,
        }), "publicar", { status: "aguardando" }),
        anuncio,
        status: "aguardando",
      }));
    },
  };
}
