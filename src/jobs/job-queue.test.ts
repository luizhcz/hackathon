import { describe, expect, it } from "vitest";

import { createJobQueue } from "./job-queue";

describe("Job queue", () => {
  it("processes at most two Jobs concurrently", async () => {
    let active = 0;
    let peak = 0;
    const releases: Array<() => void> = [];
    const started: string[] = [];
    const queue = createJobQueue({
      concurrency: 2,
      async worker(id) {
        active += 1;
        peak = Math.max(peak, active);
        started.push(id);
        await new Promise<void>((resolve) => releases.push(resolve));
        active -= 1;
      },
    });

    const jobs = [queue.enqueue("a"), queue.enqueue("b"), queue.enqueue("c")];
    await viWaitFor(() => started.length === 2);
    expect(started).toEqual(["a", "b"]);
    expect(peak).toBe(2);

    releases.shift()?.();
    await viWaitFor(() => started.includes("c"));
    releases.splice(0).forEach((release) => release());
    await Promise.all(jobs);

    expect(peak).toBe(2);
  });
});

async function viWaitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Condition was not reached.");
}
