import { redatorSchema } from "../domain/schemas";
import type { Job, RedatorOut } from "../domain/types";
import type { JobStore } from "./job-store";

export type JobPublicationErrorCode = "JOB_NOT_FOUND" | "JOB_PROCESSING" | "INVALID_ANNOUNCEMENT";

export class JobPublicationError extends Error {
  constructor(
    public readonly code: JobPublicationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "JobPublicationError";
  }
}

function editedFields(original: RedatorOut | null, submitted: RedatorOut): Array<keyof RedatorOut> {
  const fields = Object.keys(submitted) as Array<keyof RedatorOut>;
  if (!original) return fields;

  return fields.filter((field) => JSON.stringify(original[field]) !== JSON.stringify(submitted[field]));
}

export function publishJob(store: JobStore, id: string, input: unknown): Job {
  const parsed = redatorSchema.safeParse(input);
  if (!parsed.success) {
    throw new JobPublicationError("INVALID_ANNOUNCEMENT", "O anúncio enviado é inválido.");
  }

  const current = store.getJob(id);
  if (!current) throw new JobPublicationError("JOB_NOT_FOUND", "Job não encontrado.");
  if (current.status === "processando") {
    throw new JobPublicationError("JOB_PROCESSING", "O Job ainda está sendo processado.");
  }
  if (current.status === "publicado") return current;

  const now = new Date().toISOString();
  const fields = editedFields(current.anuncio, parsed.data);
  const updated = store.updateJob(id, (job) => ({
    ...job,
    status: "publicado",
    anuncio: parsed.data,
    passos: job.passos.map((step) =>
      step.id === "publicar" ? { ...step, status: "ok", resumo: "Anúncio publicado", ms: 0 } : step,
    ) as Job["passos"],
    revisao: {
      ...job.revisao,
      concluida_em: job.revisao.necessaria ? now : null,
    },
    publicado: {
      anuncio: parsed.data,
      campos_editados: fields,
    },
  }));

  if (!updated) throw new JobPublicationError("JOB_NOT_FOUND", "Job não encontrado.");
  return updated;
}
