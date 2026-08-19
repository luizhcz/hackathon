# Codex SDK spike handover

Read this when continuing the local Codex integration.

## What exists

- `@openai/codex-sdk` runs local Codex threads with the user's existing ChatGPT login.
- `src/codex-bridge.ts` exposes one streamed, read-only run against an explicit workspace.
- `src/smoke.ts` verifies authentication, event streaming, and the final response.
- The bridge disables global Codex apps and plugins for its own runs. This keeps personal integrations out of the app and avoids the skill-description budget warning without changing the user's global configuration.

## Current safety boundary

Runs use `read-only`, no network access, and approval policy `never`. The bridge validates the prompt and workspace before starting a thread. It returns the thread ID, final response, and usage.

## Verify

```bash
npm install
npm run codex:login
npm run check
npm run smoke
```

Expected smoke response: `CODEX_SDK_READY`, with no skill-budget warning.

## Continue from here

Keep the bridge behind the application's backend boundary. Decide thread persistence, cancellation, and the UI event contract after the app architecture exists. Add write access or selected plugins only when a concrete feature requires them, with focused tests for the expanded permission boundary.
