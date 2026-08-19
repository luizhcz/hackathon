export type UserAuditRecord = {
  schema_version: 1;
  id: string;
  job_id: string;
  sequence: number;
  occurred_at: string;
  type: "job.created";
  status: "completed";
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
