import { NextResponse } from "next/server";

import type { Job } from "../domain/types";
import { JobAuditUnavailableError } from "../jobs/job-store";
import type { UserAuditPage } from "../audit/types";

type ImageInput = {
  bytes: Uint8Array;
  mime: "image/jpeg" | "image/png";
};

type UploadService = {
  createJob(image: ImageInput): Job;
};

type AuditService = {
  getJob(id: string): Job | undefined;
  getAudit(id: string, options?: { afterSequence?: number; limit?: number }): UserAuditPage;
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png"]);

export async function handleUploadRequest(request: Request, service: UploadService) {
  const form = await request.formData();
  const image = form.get("imagem");

  if (!(image instanceof File)) {
    return NextResponse.json({ error: "Envie uma imagem no campo imagem." }, { status: 400 });
  }
  if (!ACCEPTED_TYPES.has(image.type)) {
    return NextResponse.json({ error: "Use uma imagem JPEG ou PNG." }, { status: 415 });
  }
  if (image.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "A imagem deve ter no máximo 10 MB." }, { status: 413 });
  }

  try {
    const job = service.createJob({
      bytes: new Uint8Array(await image.arrayBuffer()),
      mime: image.type as ImageInput["mime"],
    });
    return NextResponse.json({ id: job.id }, { status: 202 });
  } catch (error) {
    if (!(error instanceof JobAuditUnavailableError)) throw error;
    console.error("Falha de auditoria ao iniciar Job.");
    return NextResponse.json(
      { error: "O serviço está temporariamente indisponível." },
      { status: 503 },
    );
  }
}

export function handleAuditRequest(request: Request, id: string, service: AuditService) {
  if (!service.getJob(id)) {
    return NextResponse.json({ error: "Job não encontrado." }, { status: 404 });
  }

  const url = new URL(request.url);
  const rawAfterSequence = url.searchParams.get("after_sequence");
  const rawLimit = url.searchParams.get("limit");
  const afterSequence = rawAfterSequence === null ? 0 : Number(rawAfterSequence);
  const limit = rawLimit === null ? 50 : Number(rawLimit);
  if (
    !Number.isSafeInteger(afterSequence) ||
    afterSequence < 0 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    return NextResponse.json({ error: "Cursor de auditoria inválido." }, { status: 400 });
  }

  return NextResponse.json(service.getAudit(id, { afterSequence, limit }), {
    headers: { "Cache-Control": "no-store" },
  });
}
