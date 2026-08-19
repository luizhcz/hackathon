import { describe, expect, it } from "vitest";

import { createJobStore } from "./job-store";

describe("Job store", () => {
  it("creates a Job with every Passo and snapshots the current mode", () => {
    const store = createJobStore({ initialMode: "local" });

    const first = store.createJob({ bytes: new Uint8Array([1]), mime: "image/jpeg" });
    store.setMode("fixture");

    expect(first).toMatchObject({
      status: "processando",
      modo_execucao: "local",
      imagem_url: `/api/jobs/${first.id}/imagem`,
      passos: [
        { id: "identificar", status: "pendente" },
        { id: "precificar", status: "pendente" },
        { id: "redigir", status: "pendente" },
        { id: "publicar", status: "pendente" },
      ],
    });
    expect(store.getJob(first.id)?.modo_execucao).toBe("local");
    expect(store.createJob({ bytes: new Uint8Array([2]), mime: "image/png" }).modo_execucao).toBe(
      "fixture",
    );
  });
});
