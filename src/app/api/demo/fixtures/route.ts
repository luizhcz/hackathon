import { NextResponse } from "next/server";

import { demoService } from "@/server/demo-service";

export const runtime = "nodejs";

export function POST() {
  return NextResponse.json({ ids: demoService.enqueueFixtures() }, { status: 202 });
}
