import { z } from "zod";

import { CodexRuntimeError } from "../src/codex/codex-runtime";
import { LocalCodexSdkRuntime } from "../src/codex/local-codex-sdk-runtime";

const runtime = new LocalCodexSdkRuntime();
const pixelPng = Uint8Array.from(
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
);

try {
  const schemaResult = await runtime.run({
    profile: "catalogador",
    prompt:
      "Não use ferramentas. Retorne somente o objeto JSON exigido pelo schema, com status CODEX_SDK_READY.",
    schema: z.object({ status: z.literal("CODEX_SDK_READY") }).strict(),
    webSearch: "disabled",
  });
  process.stdout.write(`${JSON.stringify(schemaResult.value)}\n`);
  process.stderr.write(`[codex] schema thread=${schemaResult.metadata.threadId}\n`);

  const imageResult = await runtime.run({
    profile: "catalogador",
    prompt: "Considere a imagem anexada e retorne somente status IMAGE_ACCEPTED no objeto exigido.",
    schema: z.object({ status: z.literal("IMAGE_ACCEPTED") }).strict(),
    image: { bytes: pixelPng, mime: "image/png" },
    webSearch: "disabled",
  });
  process.stdout.write(`${JSON.stringify(imageResult.value)}\n`);
  process.stderr.write(`[codex] image thread=${imageResult.metadata.threadId}\n`);

  const searchResult = await runtime.run({
    profile: "precificador",
    prompt:
      "Faça uma busca web live por openai.com. Depois retorne somente status LIVE_SEARCH_READY no objeto exigido.",
    schema: z.object({ status: z.literal("LIVE_SEARCH_READY") }).strict(),
    webSearch: "live",
  });
  process.stdout.write(`${JSON.stringify(searchResult.value)}\n`);
  process.stderr.write(`[codex] search thread=${searchResult.metadata.threadId}\n`);

  const controller = new AbortController();
  controller.abort();
  try {
    await runtime.run({
      profile: "redator",
      prompt: "Retorne um objeto vazio.",
      schema: z.object({}).strict(),
      signal: controller.signal,
    });
    throw new Error("O smoke de cancelamento não cancelou a execução.");
  } catch (error) {
    if (!(error instanceof CodexRuntimeError) || error.code !== "CANCELLED") throw error;
    process.stdout.write('{"status":"CANCELLATION_READY"}\n');
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Falha no smoke test do Codex SDK: ${message}\n`);
  process.exitCode = 1;
}
