import { describe, expect, it } from "vitest";

import { createDeterministicCodexRuntime } from "../codex/deterministic-codex-runtime";
import type { CodexRuntime } from "../codex/codex-runtime";
import type { CatalogadorOut, PrecificadorOut, RedatorOut } from "../domain/types";
import { createJobProcessor } from "./job-processor";
import { createJobStore } from "./job-store";

const produto: CatalogadorOut = {
  ean: "7891000053508",
  marca: "Nescau",
  produto: "Achocolatado em pó",
  modelo: null,
  variante: "2.0",
  quantidade: "380g",
  categoria: "alimento",
  texto_lido: ["Nescau 2.0", "380g"],
  base_identificacao: "ean",
  confianca: "alta",
  passadas: 1,
};

const anuncio: RedatorOut = {
  titulo: "Nescau 2.0 Achocolatado em Pó 380g",
  descricao: "Achocolatado em pó Nescau 2.0 em embalagem de 380g. Produto identificado pela embalagem.",
  tags: ["nescau", "achocolatado", "chocolate"],
  categoria_loja: "alimento",
  preco: 14.9,
};

const precoLive: PrecificadorOut = {
  estrategia: "ean",
  precisao: "item_exato",
  degradado: false,
  consulta: "7891000053508",
  referencias: [
    { fonte: "Loja A", preco: 12.49 },
    { fonte: "Loja B", preco: 13.29 },
  ],
  preco_min: 12.49,
  preco_max: 13.29,
  preco_sugerido: 12.9,
  justificativa: "Faixa observada para o EAN exato.",
  confianca: "alta",
};

describe("Job processing", () => {
  it("takes a local Job from photo to an announcement awaiting confirmation", async () => {
    const store = createJobStore({ initialMode: "local" });
    const runtime = createDeterministicCodexRuntime({
      catalogador: [produto],
      redator: [anuncio],
    });
    const processor = createJobProcessor({ store, runtime });
    const job = store.createJob({ bytes: new Uint8Array([1, 2, 3]), mime: "image/jpeg" });

    await processor.process(job.id);

    expect(store.getJob(job.id)).toMatchObject({
      status: "aguardando",
      produto,
      preco: {
        estrategia: "tabela_local",
        precisao: "faixa_categoria",
        degradado: true,
        preco_min: 5,
        preco_max: 30,
        preco_sugerido: 14.9,
      },
      anuncio,
      motivo_excecao: null,
      passos: [
        { id: "identificar", status: "ok" },
        { id: "precificar", status: "ok" },
        { id: "redigir", status: "ok" },
        { id: "publicar", status: "aguardando" },
      ],
    });
  });

  it("preserves uncertain identification and sends the Job to human review", async () => {
    const store = createJobStore({ initialMode: "local" });
    const uncertainProduct: CatalogadorOut = {
      ...produto,
      ean: null,
      categoria: null,
      confianca: "baixa",
      base_identificacao: "aparencia",
    };
    const processor = createJobProcessor({
      store,
      runtime: createDeterministicCodexRuntime({ catalogador: [uncertainProduct] }),
    });
    const job = store.createJob({ bytes: new Uint8Array([4]), mime: "image/png" });

    await processor.process(job.id);

    expect(store.getJob(job.id)).toMatchObject({
      status: "excecao",
      produto: uncertainProduct,
      preco: null,
      anuncio: null,
      motivo_excecao: "categoria_desconhecida",
      revisao: { necessaria: true, concluida_em: null },
      passos: [
        { id: "identificar", status: "falhou" },
        { id: "precificar", status: "ignorado" },
        { id: "redigir", status: "ignorado" },
        { id: "publicar", status: "aguardando" },
      ],
    });
    expect(store.getAudit(job.id).records.at(-1)).toMatchObject({
      type: "stage.completed",
      stage: "catalogador",
      status: "completed",
    });
  });

  it("turns a Catalogador failure into an Exceção instead of losing the Job", async () => {
    const store = createJobStore({ initialMode: "live" });
    const processor = createJobProcessor({
      store,
      runtime: createDeterministicCodexRuntime({ catalogador: [new Error("timeout")] }),
    });
    const job = store.createJob({ bytes: new Uint8Array([5]), mime: "image/jpeg" });

    await processor.process(job.id);

    expect(store.getJob(job.id)).toMatchObject({
      status: "excecao",
      produto: null,
      motivo_excecao: "falha_catalogacao",
      revisao: { necessaria: true },
      passos: [
        { id: "identificar", status: "falhou" },
        { id: "precificar", status: "ignorado" },
        { id: "redigir", status: "ignorado" },
        { id: "publicar", status: "aguardando" },
      ],
    });
  });

  it("uses the validated Codex price when a live search succeeds", async () => {
    const store = createJobStore({ initialMode: "live" });
    const processor = createJobProcessor({
      store,
      runtime: createDeterministicCodexRuntime({
        catalogador: [produto],
        precificador: [precoLive],
        redator: [anuncio],
      }),
    });
    const job = store.createJob({ bytes: new Uint8Array([6]), mime: "image/jpeg" });

    await processor.process(job.id);

    const result = store.getJob(job.id);
    expect(result).toMatchObject({
      status: "aguardando",
      preco: precoLive,
    });
    expect(result?.passos[1]).toMatchObject({
      status: "ok",
      resumo: "R$ 12,90 · 2 referências · item exato",
    });
    expect(
      store.getAudit(job.id).records.map((record) => ({
        type: record.type,
        stage: record.stage,
        status: record.status,
      })),
    ).toEqual([
      { type: "job.created", stage: null, status: "completed" },
      { type: "stage.started", stage: "catalogador", status: "started" },
      { type: "stage.completed", stage: "catalogador", status: "completed" },
      { type: "stage.started", stage: "precificador", status: "started" },
      { type: "stage.completed", stage: "precificador", status: "completed" },
      { type: "stage.started", stage: "redator", status: "started" },
      { type: "stage.completed", stage: "redator", status: "completed" },
    ]);
  });

  it("keeps the Job publishable with local price and text when live dependencies fail", async () => {
    const store = createJobStore({ initialMode: "live" });
    const processor = createJobProcessor({
      store,
      runtime: createDeterministicCodexRuntime({
        catalogador: [produto],
        precificador: [new Error("search unavailable")],
        redator: [new Error("writer unavailable")],
      }),
    });
    const job = store.createJob({ bytes: new Uint8Array([7]), mime: "image/png" });

    await processor.process(job.id);

    expect(store.getJob(job.id)).toMatchObject({
      status: "aguardando",
      preco: { estrategia: "tabela_local", degradado: true, preco_sugerido: 14.9 },
      anuncio: {
        titulo: "Nescau Achocolatado em pó 2.0 380g",
        categoria_loja: "alimento",
        preco: 14.9,
      },
    });
    expect(store.getJob(job.id)?.passos[2]).toMatchObject({
      status: "ok",
      resumo: "Texto gerado por template local",
    });
    expect(
      store.getAudit(job.id).records.map((record) => [record.type, record.stage, record.code]),
    ).toEqual([
      ["job.created", null, null],
      ["stage.started", "catalogador", null],
      ["stage.completed", "catalogador", null],
      ["stage.started", "precificador", null],
      ["stage.failed", "precificador", "RUNTIME_FAILED"],
      ["fallback.applied", "precificador", "LOCAL_PRICE_TABLE"],
      ["stage.started", "redator", null],
      ["stage.failed", "redator", "RUNTIME_FAILED"],
      ["fallback.applied", "redator", "LOCAL_WRITER_TEMPLATE"],
    ]);
  });

  it("does not report a local fallback for a degraded price returned by LIVE", async () => {
    const degradedLivePrice: PrecificadorOut = {
      ...precoLive,
      estrategia: "descritiva",
      precisao: "equivalente",
      degradado: true,
    };
    const store = createJobStore({ initialMode: "live" });
    const processor = createJobProcessor({
      store,
      runtime: createDeterministicCodexRuntime({
        catalogador: [produto],
        precificador: [degradedLivePrice],
        redator: [anuncio],
      }),
    });
    const job = store.createJob({ bytes: new Uint8Array([10]), mime: "image/png" });

    await processor.process(job.id);

    expect(
      store.getAudit(job.id).records.some((record) => record.type === "fallback.applied"),
    ).toBe(false);
  });

  it("removes an invalid EAN-13 and recalculates the identification basis", async () => {
    const store = createJobStore({ initialMode: "local" });
    const invalidEan = { ...produto, ean: "7891000053509", base_identificacao: "ean" as const };
    const processor = createJobProcessor({
      store,
      runtime: createDeterministicCodexRuntime({ catalogador: [invalidEan], redator: [anuncio] }),
    });
    const job = store.createJob({ bytes: new Uint8Array([8]), mime: "image/jpeg" });

    await processor.process(job.id);

    expect(store.getJob(job.id)?.produto).toMatchObject({
      ean: null,
      base_identificacao: "texto_embalagem",
    });
  });

  it("cancels a Catalogador that exceeds its deadline and preserves the Job as an Exceção", async () => {
    const store = createJobStore({ initialMode: "live" });
    const hangingRuntime: CodexRuntime = {
      run(request) {
        return new Promise((_, reject) => {
          request.signal?.addEventListener("abort", () => reject(new Error("cancelled")), { once: true });
        });
      },
    };
    const processor = createJobProcessor({
      store,
      runtime: hangingRuntime,
      timeouts: { catalogador: 5, precificador: 5, redator: 5 },
    });
    const job = store.createJob({ bytes: new Uint8Array([9]), mime: "image/png" });

    await processor.process(job.id);

    expect(store.getJob(job.id)).toMatchObject({
      status: "excecao",
      motivo_excecao: "falha_catalogacao",
    });
    expect(store.getAudit(job.id).records.at(-1)).toMatchObject({
      type: "stage.failed",
      stage: "catalogador",
      status: "failed",
      code: "TIMEOUT",
      summary: "Catalogador excedeu o limite de 5 ms; encaminhado para revisão humana.",
    });
    expect(store.getAudit(job.id).records.at(-1)?.duration_ms).toBeGreaterThanOrEqual(0);
  });
});
