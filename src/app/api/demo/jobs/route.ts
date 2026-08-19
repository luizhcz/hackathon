import { demoService } from "@/server/demo-service";

export const runtime = "nodejs";

export function DELETE() {
  demoService.clear();
  return new Response(null, { status: 204 });
}
