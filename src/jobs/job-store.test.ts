import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it } from "vitest";

import { createJobStore, JobAuditUnavailableError } from "./job-store";

const temporaryDirectories: string[] = [];

function temporaryDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "foto-vira-anuncio-"));
  temporaryDirectories.push(directory);
  return join(directory, "jobs.sqlite");
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("Job store", () => {
  it("creates a Job with every Passo and snapshots the current mode", () => {
    const store = createJobStore({ initialMode: "local" });

    const first = store.createJob({ bytes: new Uint8Array([1]), mime: "image/jpeg" });
    store.setMode("fixture");

    expect(first).toMatchObject({
      status: "processando",
      modo_execucao: "local",
      imagem_url: `/api/jobs/${first.id}/imagem`,
      passos: [
        { id: "identificar", status: "pendente" },
        { id: "precificar", status: "pendente" },
        { id: "redigir", status: "pendente" },
        { id: "publicar", status: "pendente" },
      ],
    });
    expect(store.getJob(first.id)?.modo_execucao).toBe("local");
    expect(store.createJob({ bytes: new Uint8Array([2]), mime: "image/png" }).modo_execucao).toBe(
      "fixture",
    );
    store.close();
  });

  it("persists the Job, operational image and first audit record across restarts", () => {
    const databasePath = temporaryDatabasePath();
    const firstProcess = createJobStore({ initialMode: "local", databasePath });
    const created = firstProcess.createJob({
      bytes: new Uint8Array([1, 2, 3]),
      mime: "image/png",
    });

    expect(firstProcess.getAudit(created.id)).toEqual({
      schema_version: 1,
      job_id: created.id,
      audience: "user",
      records: [
        expect.objectContaining({
          schema_version: 1,
          job_id: created.id,
          sequence: 1,
          type: "job.created",
          status: "completed",
          summary: "Job criado e imagem recebida.",
        }),
      ],
      next_sequence: 1,
      has_more: false,
    });
    firstProcess.close();

    const restartedProcess = createJobStore({ initialMode: "fixture", databasePath });
    expect(restartedProcess.getJob(created.id)).toEqual(created);
    expect(restartedProcess.getImage(created.id)).toEqual({
      bytes: new Uint8Array([1, 2, 3]),
      mime: "image/png",
    });
    expect(restartedProcess.getAudit(created.id).records).toHaveLength(1);
    restartedProcess.close();
  });

  it("returns the user audit projection through an ordered cursor", () => {
    const store = createJobStore({ initialMode: "fixture" });
    const created = store.createJob({ bytes: new Uint8Array([7]), mime: "image/jpeg" });

    expect(store.getAudit(created.id, { afterSequence: 1 })).toEqual({
      schema_version: 1,
      job_id: created.id,
      audience: "user",
      records: [],
      next_sequence: 1,
      has_more: false,
    });
    store.close();
  });

  it("rolls back the Job and image when the first audit record cannot be created", () => {
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
    expect(() =>
      store.createJob({ bytes: new Uint8Array([9]), mime: "image/jpeg" }),
    ).toThrow(JobAuditUnavailableError);
    expect(store.listJobs()).toEqual([]);
    store.close();
  });

  it("enables WAL, foreign keys and a versioned migration for file databases", () => {
    const databasePath = temporaryDatabasePath();
    const store = createJobStore({ initialMode: "local", databasePath });
    store.close();

    const database = new DatabaseSync(databasePath);
    expect(database.prepare("PRAGMA journal_mode").get()).toEqual({ journal_mode: "wal" });
    expect(database.prepare("PRAGMA foreign_key_list(job_images)").all()).toEqual([
      expect.objectContaining({ table: "jobs", from: "job_id", to: "id", on_delete: "CASCADE" }),
    ]);
    expect(database.prepare("SELECT version FROM schema_migrations").all()).toEqual([{ version: 1 }]);
    database.close();
  });
});
