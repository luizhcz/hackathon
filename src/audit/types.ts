export type AuditStage = "catalogador" | "precificador" | "redator";
export type AuditEventType =
  | "job.created"
  | "stage.started"
  | "stage.completed"
  | "stage.failed"
  | "fallback.applied";
export type AuditCode =
  | "TIMEOUT"
  | "CANCELLED"
  | "RUNTIME_FAILED"
  | "INVALID_OUTPUT"
  | "EMPTY_RESPONSE"
  | "LOCAL_PRICE_TABLE"
  | "LOCAL_WRITER_TEMPLATE";

export type UserAuditRecord = {
  schema_version: 1;
  id: string;
  job_id: string;
  sequence: number;
  occurred_at: string;
  type: AuditEventType;
  stage: AuditStage | null;
  status: "started" | "completed" | "failed" | "applied";
  duration_ms: number | null;
  code: AuditCode | null;
  summary: string;
};

export type UserAuditPage = {
  schema_version: 1;
  job_id: string;
  audience: "user";
  records: UserAuditRecord[];
  next_sequence: number;
  has_more: boolean;
};
