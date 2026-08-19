import { randomUUID } from "node:crypto";

import type { Job, ModoExecucao, Passo } from "../domain/types";

type ImageInput = {
  bytes: Uint8Array;
  mime: "image/jpeg" | "image/png";
};

type StoredJob = {
  job: Job;
  image: ImageInput;
};

const PASSOS: Array<Pick<Passo, "id" | "rotulo">> = [
  { id: "identificar", rotulo: "Identificar produto" },
  { id: "precificar", rotulo: "Pesquisar preço" },
  { id: "redigir", rotulo: "Redigir anúncio" },
  { id: "publicar", rotulo: "Publicar" },
];

export function createJobStore({ initialMode }: { initialMode: ModoExecucao }) {
  const jobs = new Map<string, StoredJob>();
  let mode = initialMode;

  return {
    createJob(image: ImageInput): Job {
      const id = randomUUID();
      const job: Job = {
        id,
        criado_em: new Date().toISOString(),
        status: "processando",
        modo_execucao: mode,
        imagem_url: `/api/jobs/${id}/imagem`,
        passos: PASSOS.map((passo) => ({
          ...passo,
          status: "pendente",
          resumo: null,
          ms: null,
        })) as Job["passos"],
        produto: null,
        preco: null,
        anuncio: null,
        motivo_excecao: null,
        revisao: { necessaria: false, concluida_em: null },
        publicado: null,
      };

      jobs.set(id, { job, image });
      return job;
    },

    getJob(id: string): Job | undefined {
      return jobs.get(id)?.job;
    },

    listJobs(): Job[] {
      return [...jobs.values()]
        .map(({ job }) => job)
        .sort((a, b) => b.criado_em.localeCompare(a.criado_em));
    },

    getImage(id: string): ImageInput | undefined {
      return jobs.get(id)?.image;
    },

    updateJob(id: string, update: (job: Job) => Job): Job | undefined {
      const stored = jobs.get(id);
      if (!stored) return undefined;

      stored.job = update(stored.job);
      return stored.job;
    },

    setMode(nextMode: ModoExecucao): void {
      mode = nextMode;
    },

    getMode(): ModoExecucao {
      return mode;
    },

    clear(): void {
      jobs.clear();
    },
  };
}

export type JobStore = ReturnType<typeof createJobStore>;
