import { Codex, type Input, type Usage } from "@openai/codex-sdk";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

import {
  CodexRuntimeError,
  type CodexRunRequest,
  type CodexRunResult,
  type CodexRuntime,
} from "./codex-runtime";

export class LocalCodexSdkRuntime implements CodexRuntime {
  private codex: Codex | null = null;

  constructor(private readonly model = "gpt-5.4-mini") {}

  async run<T>(request: CodexRunRequest<T>): Promise<CodexRunResult<T>> {
    const workspace = await mkdtemp(join(tmpdir(), `foto-vira-anuncio-${request.profile}-`));

    try {
      const input = await this.buildInput(request, workspace);
      const webSearch = request.webSearch ?? "disabled";
      const thread = this.getCodex().startThread({
        model: this.model,
        modelReasoningEffort: "low",
        workingDirectory: workspace,
        sandboxMode: "read-only",
        approvalPolicy: "never",
        skipGitRepoCheck: true,
        networkAccessEnabled: webSearch === "live",
        webSearchMode: webSearch,
      });
      const { events } = await thread.runStreamed(input, {
        outputSchema: z.toJSONSchema(request.schema),
        signal: request.signal,
      });
      let finalResponse = "";
      let usage: Usage | null = null;

      for await (const event of events) {
        if (event.type === "item.completed" && event.item.type === "agent_message") {
          finalResponse = event.item.text;
        } else if (event.type === "turn.completed") {
          usage = event.usage;
        } else if (event.type === "turn.failed") {
          throw new CodexRuntimeError("FAILED", "A execução do Codex falhou.", {
            cause: new Error(event.error.message),
          });
        } else if (event.type === "error") {
          throw new CodexRuntimeError("FAILED", "O stream do Codex falhou.", {
            cause: new Error(event.message),
          });
        }
      }

      if (!finalResponse) {
        throw new CodexRuntimeError("EMPTY_RESPONSE", "O Codex concluiu sem resposta final.");
      }

      let json: unknown;
      try {
        json = JSON.parse(finalResponse);
      } catch (error) {
        throw new CodexRuntimeError("INVALID_OUTPUT", "O Codex retornou JSON inválido.", { cause: error });
      }

      const parsed = request.schema.safeParse(json);
      if (!parsed.success) {
        throw new CodexRuntimeError("INVALID_OUTPUT", "A resposta do Codex não corresponde ao schema.", {
          cause: parsed.error,
        });
      }
      if (!thread.id) {
        throw new CodexRuntimeError("FAILED", "O Codex não retornou um identificador de thread.");
      }

      return {
        value: parsed.data,
        metadata: {
          threadId: thread.id,
          inputTokens: usage?.input_tokens ?? null,
          outputTokens: usage?.output_tokens ?? null,
        },
      };
    } catch (error) {
      if (request.signal?.aborted) {
        throw new CodexRuntimeError("CANCELLED", "A execução do Codex foi cancelada.", { cause: error });
      }
      if (error instanceof CodexRuntimeError) throw error;
      throw new CodexRuntimeError("FAILED", "Não foi possível executar o Codex.", { cause: error });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  }

  private getCodex(): Codex {
    this.codex ??= new Codex({
      config: {
        features: {
          apps: false,
          plugins: false,
        },
      },
    });
    return this.codex;
  }

  private async buildInput<T>(request: CodexRunRequest<T>, workspace: string): Promise<Input> {
    if (!request.image) return request.prompt;

    const extension = request.image.mime === "image/png" ? "png" : "jpg";
    const path = join(workspace, `produto.${extension}`);
    await writeFile(path, request.image.bytes);
    return [
      { type: "text", text: request.prompt },
      { type: "local_image", path },
    ];
  }
}
