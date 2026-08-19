import { describe, expect, it } from "vitest";

import { createDeterministicCodexRuntime } from "../codex/deterministic-codex-runtime";
import type { CatalogadorOut, RedatorOut } from "../domain/types";
import { createJobProcessor } from "./job-processor";
import { publishJob } from "./job-publication";
import { createJobStore } from "./job-store";

const produto: CatalogadorOut = {
  ean: null,
  marca: "Caderno",
  produto: "Caderno espiral",
  modelo: null,
  variante: null,
  quantidade: "96 folhas",
  categoria: "papelaria",
  texto_lido: ["96 folhas"],
  base_identificacao: "texto_embalagem",
  confianca: "media",
  passadas: 1,
};

const anuncio: RedatorOut = {
  titulo: "Caderno Espiral 96 Folhas",
  descricao: "Caderno espiral com 96 folhas.",
  tags: ["caderno", "espiral", "papelaria"],
  categoria_loja: "papelaria",
  preco: 9.9,
};

describe("Job publication", () => {
  it("publishes an edited announcement once and returns it idempotently", async () => {
    const store = createJobStore({ initialMode: "local" });
    const processor = createJobProcessor({
      store,
      runtime: createDeterministicCodexRuntime({ catalogador: [produto], redator: [anuncio] }),
    });
    const created = store.createJob({ bytes: new Uint8Array([1]), mime: "image/jpeg" });
    await processor.process(created.id);
    const edited = { ...anuncio, titulo: "Caderno Espiral Novo 96 Folhas" };

    const published = publishJob(store, created.id, edited);
    const repeated = publishJob(store, created.id, edited);

    expect(published).toMatchObject({
      status: "publicado",
      publicado: { anuncio: edited, campos_editados: ["titulo"] },
    });
    expect(published.passos[3]).toMatchObject({ status: "ok" });
    expect(repeated).toEqual(published);
  });

  it("rejects publication while a Job is processing", () => {
    const store = createJobStore({ initialMode: "fixture" });
    const created = store.createJob({ bytes: new Uint8Array([2]), mime: "image/png" });

    expect(() => publishJob(store, created.id, anuncio)).toThrowError(
      expect.objectContaining({ code: "JOB_PROCESSING" }),
    );
    expect(store.getJob(created.id)?.status).toBe("processando");
  });

  it("publishes an Exceção only through a complete human review", async () => {
    const store = createJobStore({ initialMode: "local" });
    const uncertain = { ...produto, categoria: null, confianca: "baixa" as const };
    const processor = createJobProcessor({
      store,
      runtime: createDeterministicCodexRuntime({ catalogador: [uncertain] }),
    });
    const created = store.createJob({ bytes: new Uint8Array([3]), mime: "image/jpeg" });
    await processor.process(created.id);

    const published = publishJob(store, created.id, anuncio);

    expect(published.produto).toEqual(uncertain);
    expect(published).toMatchObject({
      status: "publicado",
      revisao: { necessaria: true },
      publicado: {
        campos_editados: ["titulo", "descricao", "tags", "categoria_loja", "preco"],
      },
    });
    expect(published.revisao.concluida_em).toEqual(expect.any(String));
  });
});
