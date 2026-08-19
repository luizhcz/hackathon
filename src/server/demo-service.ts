import { LocalCodexSdkRuntime } from "../codex/local-codex-sdk-runtime";
import type { ModoExecucao } from "../domain/types";
import { DEMO_FIXTURES, type DemoFixture } from "../fixtures/demo-fixtures";
import { processFixture } from "../fixtures/process-fixture";
import { createJobProcessor } from "../jobs/job-processor";
import { publishJob } from "../jobs/job-publication";
import { createJobQueue } from "../jobs/job-queue";
import { createJobStore } from "../jobs/job-store";

function createDemoService() {
  const store = createJobStore({ initialMode: "fixture" });
  const processor = createJobProcessor({ store, runtime: new LocalCodexSdkRuntime() });
  const assignedFixtures = new Map<string, DemoFixture>();
  let fixtureCursor = 0;
  const queue = createJobQueue({
    concurrency: 2,
    async worker(id) {
      const fixture = assignedFixtures.get(id);
      try {
        if (fixture) await processFixture(store, id, fixture);
        else await processor.process(id);
      } finally {
        assignedFixtures.delete(id);
      }
    },
  });

  function enqueue(image: { bytes: Uint8Array; mime: "image/jpeg" | "image/png" }, fixture?: DemoFixture) {
    const job = store.createJob(image);
    if (fixture) assignedFixtures.set(job.id, fixture);
    void queue.enqueue(job.id).catch((error) => {
      console.error("Falha inesperada ao processar Job", error);
    });
    return job;
  }

  return {
    listJobs: () => store.listJobs(),
    getJob: (id: string) => store.getJob(id),
    getImage: (id: string) => store.getImage(id),
    getMode: () => store.getMode(),
    setMode(mode: ModoExecucao) {
      store.setMode(mode);
      return mode;
    },
    upload(image: { bytes: Uint8Array; mime: "image/jpeg" | "image/png" }) {
      const fixture = store.getMode() === "fixture" ? DEMO_FIXTURES[fixtureCursor++ % DEMO_FIXTURES.length] : undefined;
      return enqueue(image, fixture);
    },
    enqueueFixtures() {
      return DEMO_FIXTURES.map((fixture) => enqueue(fixture.image, fixture).id);
    },
    publish(id: string, announcement: unknown) {
      return publishJob(store, id, announcement);
    },
    clear() {
      store.clear();
    },
  };
}

export type DemoService = ReturnType<typeof createDemoService>;

const globalDemo = globalThis as typeof globalThis & { __fotoViraAnuncioDemo?: DemoService };

export const demoService = globalDemo.__fotoViraAnuncioDemo ?? createDemoService();

if (process.env.NODE_ENV !== "production") globalDemo.__fotoViraAnuncioDemo = demoService;
