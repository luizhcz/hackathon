import { demoService } from "@/server/demo-service";
import { handleUploadRequest } from "@/server/job-http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleUploadRequest(request, { createJob: (image) => demoService.upload(image) });
}
