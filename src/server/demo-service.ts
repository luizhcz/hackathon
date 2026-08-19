import { LocalCodexSdkRuntime } from "../codex/local-codex-sdk-runtime";
import type { ModoExecucao } from "../domain/types";
import { DEMO_FIXTURES, type DemoFixture } from "../fixtures/demo-fixtures";
import { processFixture } from "../fixtures/process-fixture";
import { createJobProcessor } from "../jobs/job-processor";
import { publishJob } from "../jobs/job-publication";
import { createJobQueue } from "../jobs/job-queue";
import { createJobStore } from "../jobs/job-store";

export function createDemoService({
  databasePath = process.env.JOB_DATABASE_PATH ?? ".data/foto-vira-anuncio.sqlite",
}: { databasePath?: string } = {}) {
  const store = createJobStore({ initialMode: "fixture", databasePath });
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
    getAudit: (id: string, options?: { afterSequence?: number; limit?: number }) =>
      store.getAudit(id, options),
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
    close() {
      store.close();
    },
  };
}

export type DemoService = ReturnType<typeof createDemoService>;

const globalDemo = globalThis as typeof globalThis & { __fotoViraAnuncioDemo?: DemoService };

function getDemoService(): DemoService {
  globalDemo.__fotoViraAnuncioDemo ??= createDemoService();
  return globalDemo.__fotoViraAnuncioDemo;
}

export const demoService: DemoService = {
  listJobs: () => getDemoService().listJobs(),
  getJob: (id) => getDemoService().getJob(id),
  getImage: (id) => getDemoService().getImage(id),
  getAudit: (id, options) => getDemoService().getAudit(id, options),
  getMode: () => getDemoService().getMode(),
  setMode: (mode) => getDemoService().setMode(mode),
  upload: (image) => getDemoService().upload(image),
  enqueueFixtures: () => getDemoService().enqueueFixtures(),
  publish: (id, announcement) => getDemoService().publish(id, announcement),
  clear: () => getDemoService().clear(),
  close: () => {
    if (!globalDemo.__fotoViraAnuncioDemo) return;
    globalDemo.__fotoViraAnuncioDemo.close();
    delete globalDemo.__fotoViraAnuncioDemo;
  },
};
