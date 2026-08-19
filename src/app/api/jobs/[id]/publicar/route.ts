import { NextResponse } from "next/server";

import { JobPublicationError } from "@/jobs/job-publication";
import { demoService } from "@/server/demo-service";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo JSON inválido." }, { status: 400 });
  }

  try {
    return NextResponse.json(demoService.publish(id, body));
  } catch (error) {
    if (!(error instanceof JobPublicationError)) throw error;
    const status = error.code === "JOB_NOT_FOUND" ? 404 : error.code === "JOB_PROCESSING" ? 409 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
