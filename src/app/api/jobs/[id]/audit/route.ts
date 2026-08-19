import { demoService } from "@/server/demo-service";
import { handleAuditRequest } from "@/server/job-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleAuditRequest(request, id, demoService);
}
