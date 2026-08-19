import type { z } from "zod";

export type CodexProfile = "catalogador" | "precificador" | "redator";

export type CodexImage = {
  bytes: Uint8Array;
  mime: "image/jpeg" | "image/png";
};

export type CodexRunRequest<T> = {
  profile: CodexProfile;
  prompt: string;
  schema: z.ZodType<T>;
  image?: CodexImage;
  webSearch?: "disabled" | "live";
  signal?: AbortSignal;
};

export type CodexRunResult<T> = {
  value: T;
  metadata: {
    threadId: string;
    inputTokens: number | null;
    outputTokens: number | null;
  };
};

export interface CodexRuntime {
  run<T>(request: CodexRunRequest<T>): Promise<CodexRunResult<T>>;
}

export type CodexRuntimeErrorCode = "CANCELLED" | "FAILED" | "INVALID_OUTPUT" | "EMPTY_RESPONSE";

export class CodexRuntimeError extends Error {
  constructor(
    public readonly code: CodexRuntimeErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CodexRuntimeError";
  }
}
