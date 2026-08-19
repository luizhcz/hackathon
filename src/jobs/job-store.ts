import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { UserAuditPage, UserAuditRecord } from "../audit/types";
import type { Job, ModoExecucao, Passo } from "../domain/types";

type ImageInput = {
  bytes: Uint8Array;
  mime: "image/jpeg" | "image/png";
};

type JobRow = { job_json: string };
type ImageRow = { bytes: Uint8Array; mime: ImageInput["mime"] };
type AuditRow = Omit<UserAuditRecord, "schema_version" | "summary"> & { schema_version: number };

const PASSOS: Array<Pick<Passo, "id" | "rotulo">> = [
  { id: "identificar", rotulo: "Identificar produto" },
  { id: "precificar", rotulo: "Pesquisar preço" },
  { id: "redigir", rotulo: "Redigir anúncio" },
  { id: "publicar", rotulo: "Publicar" },
];

const MIGRATIONS = [
  `
    CREATE TABLE jobs (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      job_json TEXT NOT NULL
    ) STRICT;

    CREATE TABLE job_images (
      job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
      bytes BLOB NOT NULL,
      mime TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png'))
    ) STRICT;

    CREATE TABLE audit_records (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      sequence INTEGER NOT NULL CHECK (sequence > 0),
      schema_version INTEGER NOT NULL CHECK (schema_version = 1),
      occurred_at TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type = 'job.created'),
      status TEXT NOT NULL CHECK (status = 'completed'),
      payload_json TEXT NOT NULL,
      UNIQUE (job_id, sequence)
    ) STRICT;
  `,
] as const;

function migrate(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    ) STRICT;
  `);
  for (const [index, sql] of MIGRATIONS.entries()) {
    const version = index + 1;
    database.exec("BEGIN IMMEDIATE");
    try {
      const applied = database
        .prepare("SELECT version FROM schema_migrations WHERE version = ?")
        .get(version);
      if (applied) {
        database.exec("COMMIT");
        continue;
      }
      database.exec(sql);
      database
        .prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
        .run(version, new Date().toISOString());
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
}

function readJob(row: JobRow | undefined): Job | undefined {
  return row ? (JSON.parse(row.job_json) as Job) : undefined;
}

export class JobAuditUnavailableError extends Error {
  constructor() {
    super("Não foi possível iniciar a Trilha de auditoria do Job.");
    this.name = "JobAuditUnavailableError";
  }
}

export function createJobStore({
  initialMode,
  databasePath = ":memory:",
}: {
  initialMode: ModoExecucao;
  databasePath?: string;
}) {
  if (databasePath !== ":memory:") mkdirSync(dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA busy_timeout = 5000");
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA journal_mode = WAL");
  migrate(database);
  let mode = initialMode;

  function getJob(id: string): Job | undefined {
    const row = database.prepare("SELECT job_json FROM jobs WHERE id = ?").get(id) as
      | JobRow
      | undefined;
    return readJob(row);
  }

  return {
    createJob(image: ImageInput): Job {
      const id = randomUUID();
      const occurredAt = new Date().toISOString();
      const job: Job = {
        id,
        criado_em: occurredAt,
        status: "processando",
        modo_execucao: mode,
        imagem_url: `/api/jobs/${id}/imagem`,
        passos: PASSOS.map((passo) => ({
          ...passo,
          status: "pendente",
          resumo: null,
          ms: null,
        })) as Job["passos"],
        produto: null,
        preco: null,
        anuncio: null,
        motivo_excecao: null,
        revisao: { necessaria: false, concluida_em: null },
        publicado: null,
      };

      database.exec("BEGIN IMMEDIATE");
      try {
        database
          .prepare("INSERT INTO jobs (id, created_at, job_json) VALUES (?, ?, ?)")
          .run(id, occurredAt, JSON.stringify(job));
        database
          .prepare("INSERT INTO job_images (job_id, bytes, mime) VALUES (?, ?, ?)")
          .run(id, image.bytes, image.mime);
        database
          .prepare(`
            INSERT INTO audit_records (
              id, job_id, sequence, schema_version, occurred_at, type, status, payload_json
            ) VALUES (?, ?, 1, 1, ?, 'job.created', 'completed', ?)
          `)
          .run(randomUUID(), id, occurredAt, JSON.stringify({ mode, image_mime: image.mime }));
        database.exec("COMMIT");
        return job;
      } catch {
        database.exec("ROLLBACK");
        throw new JobAuditUnavailableError();
      }
    },

    getJob,

    listJobs(): Job[] {
      const rows = database
        .prepare("SELECT job_json FROM jobs ORDER BY created_at DESC, id DESC")
        .all() as JobRow[];
      return rows.map((row) => readJob(row) as Job);
    },

    getImage(id: string): ImageInput | undefined {
      const row = database.prepare("SELECT bytes, mime FROM job_images WHERE job_id = ?").get(id) as
        | ImageRow
        | undefined;
      return row ? { bytes: new Uint8Array(row.bytes), mime: row.mime } : undefined;
    },

    getAudit(
      id: string,
      { afterSequence = 0, limit = 50 }: { afterSequence?: number; limit?: number } = {},
    ): UserAuditPage {
      const safeAfter = Number.isSafeInteger(afterSequence) && afterSequence >= 0 ? afterSequence : 0;
      const safeLimit = Number.isSafeInteger(limit) ? Math.min(Math.max(limit, 1), 100) : 50;
      const rows = database
        .prepare(`
          SELECT schema_version, id, job_id, sequence, occurred_at, type, status
          FROM audit_records
          WHERE job_id = ? AND sequence > ?
          ORDER BY sequence ASC
          LIMIT ?
        `)
        .all(id, safeAfter, safeLimit + 1) as AuditRow[];
      const hasMore = rows.length > safeLimit;
      const pageRows = hasMore ? rows.slice(0, safeLimit) : rows;
      const records: UserAuditRecord[] = pageRows.map((row) => ({
        schema_version: 1,
        id: row.id,
        job_id: row.job_id,
        sequence: row.sequence,
        occurred_at: row.occurred_at,
        type: row.type,
        status: row.status,
        summary: "Job criado e imagem recebida.",
      }));
      return {
        schema_version: 1,
        job_id: id,
        audience: "user",
        records,
        next_sequence: records.at(-1)?.sequence ?? safeAfter,
        has_more: hasMore,
      };
    },

    updateJob(id: string, update: (job: Job) => Job): Job | undefined {
      const current = getJob(id);
      if (!current) return undefined;
      const updated = update(current);
      database.prepare("UPDATE jobs SET job_json = ? WHERE id = ?").run(JSON.stringify(updated), id);
      return updated;
    },

    setMode(nextMode: ModoExecucao): void {
      mode = nextMode;
    },

    getMode(): ModoExecucao {
      return mode;
    },

    clear(): void {
      database.prepare("DELETE FROM jobs").run();
    },

    close(): void {
      database.close();
    },
  };
}

export type JobStore = ReturnType<typeof createJobStore>;
