import { NextResponse } from "next/server";

import { demoService } from "@/server/demo-service";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png"]);

export async function POST(request: Request) {
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

  const job = demoService.upload({
    bytes: new Uint8Array(await image.arrayBuffer()),
    mime: image.type as "image/jpeg" | "image/png",
  });
  return NextResponse.json({ id: job.id }, { status: 202 });
}
