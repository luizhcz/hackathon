import { NextResponse } from "next/server";

import { demoService } from "@/server/demo-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(demoService.listJobs(), {
    headers: { "Cache-Control": "no-store" },
  });
}
