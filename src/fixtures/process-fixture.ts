import type { DemoFixture } from "./demo-fixtures";
import type { Job, PassoId } from "../domain/types";
import type { JobStore } from "../jobs/job-store";

function step(job: Job, id: PassoId, update: Partial<Job["passos"][number]>): Job {
  return {
    ...job,
    passos: job.passos.map((item) => (item.id === id ? { ...item, ...update } : item)) as Job["passos"],
  };
}

async function pause(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function processFixture(store: JobStore, id: string, fixture: DemoFixture): Promise<void> {
  store.updateJob(id, (job) => step(job, "identificar", { status: "rodando" }));
  await pause(280);

  if (fixture.exception) {
    store.updateJob(id, (job) => ({
      ...step(step(step(step(job, "identificar", {
        status: "falhou",
        resumo: "Categoria desconhecida — revisão necessária",
        ms: 280,
      }), "precificar", { status: "ignorado" }), "redigir", { status: "ignorado" }), "publicar", {
        status: "aguardando",
      }),
      produto: fixture.produto,
      status: "excecao",
      motivo_excecao: fixture.exception,
      revisao: { necessaria: true, concluida_em: null },
    }));
    return;
  }

  store.updateJob(id, (job) => ({
    ...step(job, "identificar", { status: "ok", resumo: fixture.label, ms: 280 }),
    produto: fixture.produto,
  }));
  store.updateJob(id, (job) => step(job, "precificar", { status: "rodando" }));
  await pause(320);
  store.updateJob(id, (job) => ({
    ...step(job, "precificar", {
      status: "ok",
      resumo: fixture.preco?.degradado
        ? `R$ ${fixture.preco.preco_min}–${fixture.preco.preco_max} · estimativa local`
        : `R$ ${fixture.preco?.preco_sugerido.toFixed(2).replace(".", ",")} · item exato`,
      ms: 320,
    }),
    preco: fixture.preco,
  }));
  store.updateJob(id, (job) => step(job, "redigir", { status: "rodando" }));
  await pause(260);
  store.updateJob(id, (job) => ({
    ...step(step(job, "redigir", {
      status: "ok",
      resumo: fixture.anuncio ? `Título com ${fixture.anuncio.titulo.length} caracteres` : null,
      ms: 260,
    }), "publicar", { status: "aguardando" }),
    anuncio: fixture.anuncio,
    status: "aguardando",
  }));
}
