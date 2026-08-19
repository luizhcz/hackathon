import { demoService } from "@/server/demo-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const image = demoService.getImage(id);
  if (!image) return new Response("Imagem não encontrada.", { status: 404 });

  return new Response(image.bytes as BodyInit, {
    headers: {
      "Content-Type": image.mime,
      "Cache-Control": "no-store",
    },
  });
}
