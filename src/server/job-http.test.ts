import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createJobStore } from "../jobs/job-store";
import { handleAuditRequest, handleUploadRequest } from "./job-http";

const temporaryDirectories: string[] = [];

function temporaryDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "foto-vira-anuncio-http-"));
  temporaryDirectories.push(directory);
  return join(directory, "jobs.sqlite");
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("Job HTTP", () => {
  it("returns the versioned user audit projection by default", async () => {
    const store = createJobStore({ initialMode: "local" });
    const job = store.createJob({ bytes: new Uint8Array([1]), mime: "image/png" });

    const response = handleAuditRequest(
      new Request(`http://localhost/api/jobs/${job.id}/audit?after_sequence=0`),
      job.id,
      store,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      schema_version: 1,
      job_id: job.id,
      audience: "user",
      records: [{ sequence: 1, type: "job.created" }],
      next_sequence: 1,
      has_more: false,
    });
    store.close();
  });

  it("responds unavailable and creates no Job when the first audit record fails", async () => {
    const databasePath = temporaryDatabasePath();
    const migratedStore = createJobStore({ initialMode: "local", databasePath });
    migratedStore.close();
    const database = new DatabaseSync(databasePath);
    database.exec(`
      CREATE TRIGGER reject_first_audit
      BEFORE INSERT ON audit_records
      BEGIN
        SELECT RAISE(ABORT, 'audit unavailable');
      END;
    `);
    database.close();
    const store = createJobStore({ initialMode: "local", databasePath });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const form = new FormData();
    form.set("imagem", new File([new Uint8Array([1, 2])], "produto.png", { type: "image/png" }));

    const response = await handleUploadRequest(
      new Request("http://localhost/api/upload", { method: "POST", body: form }),
      store,
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "O serviço está temporariamente indisponível.",
    });
    expect(store.listJobs()).toEqual([]);
    store.close();
  });
});
