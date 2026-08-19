import { performance } from "node:perf_hooks";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";

import { CodexRuntimeError } from "../src/codex/codex-runtime";
import { LocalCodexSdkRuntime } from "../src/codex/local-codex-sdk-runtime";
import { CATALOGADOR_PROMPT } from "../src/codex/prompts";
import { catalogadorSchema } from "../src/domain/schemas";
import { DEMO_FIXTURES } from "../src/fixtures/demo-fixtures";

const timeoutMs = Number(process.env.CATALOGADOR_TIMEOUT_MS ?? 20_000);
if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
  throw new Error("CATALOGADOR_TIMEOUT_MS deve ser um inteiro positivo.");
}

const imagePath = process.env.CATALOGADOR_IMAGE_PATH;
const imageExtension = imagePath ? extname(imagePath).toLowerCase() : null;
if (imageExtension && ![".png", ".jpg", ".jpeg"].includes(imageExtension)) {
  throw new Error("CATALOGADOR_IMAGE_PATH deve apontar para uma imagem PNG ou JPEG.");
}
const image = imagePath
  ? {
      bytes: new Uint8Array(await readFile(imagePath)),
      mime: imageExtension === ".png" ? "image/png" as const : "image/jpeg" as const,
    }
  : DEMO_FIXTURES[0].image;
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), timeoutMs);
const startedAt = performance.now();

try {
  const result = await new LocalCodexSdkRuntime().run({
    profile: "catalogador",
    prompt: CATALOGADOR_PROMPT,
    schema: catalogadorSchema,
    image,
    webSearch: "disabled",
    signal: controller.signal,
  });
  process.stdout.write(
    `${JSON.stringify({
      status: "completed",
      duration_ms: Math.round(performance.now() - startedAt),
      timeout_ms: timeoutMs,
      confidence: result.value.confianca,
      category_known: result.value.categoria !== null,
    })}\n`,
  );
} catch (error) {
  const code = error instanceof CodexRuntimeError ? error.code : "FAILED";
  process.stderr.write(
    `${JSON.stringify({
      status: code === "CANCELLED" ? "timeout" : "failed",
      code,
      duration_ms: Math.round(performance.now() - startedAt),
      timeout_ms: timeoutMs,
    })}\n`,
  );
  process.exitCode = 1;
} finally {
  clearTimeout(timer);
}
