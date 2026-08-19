import { NextResponse } from "next/server";
import { z } from "zod";

import { demoService } from "@/server/demo-service";

export const runtime = "nodejs";

const inputSchema = z.object({ modo: z.enum(["live", "local", "fixture"]) }).strict();

export async function GET() {
  return NextResponse.json({ modo: demoService.getMode() });
}

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Modo inválido." }, { status: 400 });
  return NextResponse.json({ modo: demoService.setMode(parsed.data.modo) });
}
