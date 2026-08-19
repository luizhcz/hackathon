import type { CodexProfile, CodexRunRequest, CodexRunResult, CodexRuntime } from "./codex-runtime";

type ScriptValue = unknown | Error;
type Script = Partial<Record<CodexProfile, ScriptValue[]>>;

export function createDeterministicCodexRuntime(initialScript: Script): CodexRuntime {
  const script = Object.fromEntries(
    Object.entries(initialScript).map(([profile, values]) => [profile, [...values]]),
  ) as Script;

  return {
    async run<T>(request: CodexRunRequest<T>): Promise<CodexRunResult<T>> {
      const next = script[request.profile]?.shift();
      if (next === undefined) {
        throw new Error(`Sem resposta determinística para ${request.profile}.`);
      }
      if (next instanceof Error) throw next;

      return {
        value: request.schema.parse(next),
        metadata: {
          threadId: `fixture-${request.profile}`,
          inputTokens: null,
          outputTokens: null,
        },
      };
    },
  };
}
