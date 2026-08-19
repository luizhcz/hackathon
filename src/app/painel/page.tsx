"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import type { UserAuditPage } from "@/audit/types";
import type { Job, ModoExecucao, RedatorOut } from "@/domain/types";

const MODE_LABELS: Record<ModoExecucao, string> = { live: "LIVE", local: "LOCAL", fixture: "FIXTURE" };
const NEXT_MODE: Record<ModoExecucao, ModoExecucao> = { live: "local", local: "fixture", fixture: "live" };

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [mode, setModeState] = useState<ModoExecucao>("fixture");
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [audits, setAudits] = useState<Record<string, UserAuditPage | "loading" | "error">>({});
  const [openAudits, setOpenAudits] = useState<Record<string, boolean>>({});
  const auditCursors = useRef<Record<string, number>>({});
  const auditRequests = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    const [jobsResponse, modeResponse] = await Promise.all([
      fetch("/api/jobs", { cache: "no-store" }),
      fetch("/api/demo/modo", { cache: "no-store" }),
    ]);
    if (jobsResponse.ok) setJobs((await jobsResponse.json()) as Job[]);
    if (modeResponse.ok) setModeState(((await modeResponse.json()) as { modo: ModoExecucao }).modo);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 800);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const setMode = useCallback(async (next: ModoExecucao) => {
    const response = await fetch("/api/demo/modo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modo: next }),
    });
    if (response.ok) setModeState(next);
  }, []);

  const enqueueFixtures = useCallback(async () => {
    await fetch("/api/demo/fixtures", { method: "POST" });
    await refresh();
  }, [refresh]);

  const reset = useCallback(async () => {
    if (!window.confirm("Limpar todos os Jobs da demonstração?")) return;
    await fetch("/api/demo/jobs", { method: "DELETE" });
    setJobs([]);
    setAudits({});
    setOpenAudits({});
    auditCursors.current = {};
    auditRequests.current.clear();
  }, []);

  const loadAudit = useCallback(async (id: string) => {
    if (auditRequests.current.has(id)) return;
    auditRequests.current.add(id);
    const afterSequence = auditCursors.current[id] ?? 0;
    if (afterSequence === 0) {
      setAudits((current) => ({ ...current, [id]: "loading" }));
    }
    try {
      const response = await fetch(
        `/api/jobs/${id}/audit?after_sequence=${afterSequence}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("audit unavailable");
      const nextPage = (await response.json()) as UserAuditPage;
      auditCursors.current[id] = nextPage.next_sequence;
      setAudits((current) => {
        const previous = current[id];
        if (typeof previous !== "object") return { ...current, [id]: nextPage };
        return {
          ...current,
          [id]: { ...nextPage, records: [...previous.records, ...nextPage.records] },
        };
      });
    } catch {
      setAudits((current) => ({
        ...current,
        [id]: typeof current[id] === "object" ? current[id] : "error",
      }));
    } finally {
      auditRequests.current.delete(id);
    }
  }, []);

  useEffect(() => {
    const ids = Object.entries(openAudits)
      .filter(([, open]) => open)
      .map(([id]) => id);
    if (ids.length === 0) return;
    void Promise.all(ids.map(loadAudit));
    const timer = window.setInterval(() => void Promise.all(ids.map(loadAudit)), 800);
    return () => window.clearInterval(timer);
  }, [loadAudit, openAudits]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key.toLowerCase() === "m") void setMode(NEXT_MODE[mode]);
      if (event.key === "5") void enqueueFixtures();
      if (event.key.toLowerCase() === "r") void reset();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enqueueFixtures, mode, reset, setMode]);

  async function publish(job: Job, announcement: RedatorOut) {
    const response = await fetch(`/api/jobs/${job.id}/publicar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(announcement),
    });
    if (response.ok) {
      setReviewing(null);
      await refresh();
    }
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <div className="eyebrow">CODEX · DEMO OPERACIONAL</div>
          <h1>Foto vira anúncio</h1>
        </div>
        <div className="dashboard-controls">
          <button className={`mode-badge mode-${mode}`} onClick={() => void setMode(NEXT_MODE[mode])}>
            <span className="status-dot" /> {MODE_LABELS[mode]}
          </button>
          <button className="ghost-button" onClick={() => void enqueueFixtures()}>5 fixtures</button>
          <button className="ghost-button" onClick={() => void reset()}>Limpar</button>
          <a className="ghost-button" href="/loja" target="_blank">Abrir loja ↗</a>
        </div>
      </header>

      {jobs.length === 0 ? (
        <section className="empty-state">
          <div className="empty-icon">＋</div>
          <h2>Nenhuma foto ainda.</h2>
          <p>Envie pelo celular em <strong>/captura</strong>.</p>
          <button className="primary-button compact" onClick={() => void enqueueFixtures()}>Rodar demonstração</button>
        </section>
      ) : (
        <section className="job-grid">
          {jobs.map((job) => (
            <article className={`job-card status-${job.status}`} key={job.id}>
              <div className="job-topline">
                <span className="job-number">#{job.id.slice(0, 5).toUpperCase()}</span>
                <span className={`job-state state-${job.status}`}>{job.status}</span>
              </div>
              <div className="product-heading">
                <div className="product-thumb"><img src={job.imagem_url} alt="Produto enviado" /></div>
                <div>
                  <h2>{[job.produto?.marca, job.produto?.produto].filter(Boolean).join(" ") || "Lendo embalagem…"}</h2>
                  <p>{job.produto?.quantidade ?? "Identificação em andamento"}</p>
                </div>
              </div>

              <ol className="steps-list">
                {job.passos.map((step) => (
                  <li className={`step step-${step.status}`} key={step.id}>
                    <span className="step-marker">{step.status === "ok" ? "✓" : step.status === "rodando" ? "↻" : "·"}</span>
                    <div><strong>{step.rotulo}</strong>{step.resumo && <small>{step.resumo}</small>}</div>
                  </li>
                ))}
              </ol>

              <AuditTimeline
                audit={audits[job.id]}
                jobId={job.id}
                onToggle={(id, open) =>
                  setOpenAudits((current) => ({ ...current, [id]: open }))
                }
              />

              {job.preco?.degradado && (
                <div className="degraded-note">
                  {job.preco.estrategia === "tabela_local" ? "Estimativa local" : "Resultado degradado"}
                  {` · R$ ${job.preco.preco_min}–${job.preco.preco_max}`}
                </div>
              )}
              {job.status === "excecao" && (
                <div className="exception-note">O Codex não teve confiança e exigiu revisão.</div>
              )}

              <div className="job-actions">
                {job.status === "aguardando" && job.anuncio && (
                  <button className="primary-button compact" onClick={() => void publish(job, job.anuncio!)}>Publicar anúncio</button>
                )}
                {job.status === "excecao" && (
                  <button className="review-button" onClick={() => setReviewing(reviewing === job.id ? null : job.id)}>
                    Revisar para publicar
                  </button>
                )}
                {job.status === "publicado" && <span className="published-label">Publicado ✓</span>}
              </div>
              {reviewing === job.id && <ReviewForm job={job} onSubmit={(value) => publish(job, value)} />}
            </article>
          ))}
        </section>
      )}
      <footer className="shortcut-bar"><span><kbd>M</kbd> modo</span><span><kbd>5</kbd> fixtures</span><span><kbd>R</kbd> limpar</span></footer>
    </main>
  );
}

function AuditTimeline({
  audit,
  jobId,
  onToggle,
}: {
  audit: UserAuditPage | "loading" | "error" | undefined;
  jobId: string;
  onToggle: (id: string, open: boolean) => void;
}) {
  return (
    <details
      className="audit-timeline"
      onToggle={(event) => {
        onToggle(jobId, event.currentTarget.open);
      }}
    >
      <summary>Trilha de auditoria</summary>
      <div className="audit-content">
        {audit === "loading" && <p className="audit-status">Carregando timeline…</p>}
        {audit === "error" && (
          <p className="audit-status audit-error">Não foi possível carregar a timeline.</p>
        )}
        {typeof audit === "object" && (
          <ol className="audit-records">
            {audit.records.map((record) => (
              <li key={record.id}>
                <time dateTime={record.occurred_at}>
                  {new Date(record.occurred_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </time>
                <strong>{record.summary}</strong>
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  );
}

function ReviewForm({ job, onSubmit }: { job: Job; onSubmit: (value: RedatorOut) => Promise<void> }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await onSubmit({
      titulo: String(data.get("titulo")),
      descricao: String(data.get("descricao")),
      tags: String(data.get("tags")).split(",").map((tag) => tag.trim()).filter(Boolean),
      categoria_loja: String(data.get("categoria")) as RedatorOut["categoria_loja"],
      preco: Number(data.get("preco")),
    });
  }

  return (
    <form className="review-form" onSubmit={submit}>
      <p>Identificação preservada: {job.produto?.texto_lido.join(" · ") || "nenhum texto legível"}</p>
      <input name="titulo" required maxLength={60} placeholder="Título" />
      <textarea name="descricao" required placeholder="Descrição" />
      <input name="tags" required placeholder="tag 1, tag 2, tag 3" />
      <div className="form-row">
        <select name="categoria" required defaultValue="">
          <option value="" disabled>Categoria</option>
          {['alimento','bebida','limpeza','higiene','eletronico','papelaria','utilidade','outro'].map((item) => <option key={item}>{item}</option>)}
        </select>
        <input name="preco" required type="number" min="0.01" step="0.01" placeholder="Preço" />
      </div>
      <button className="primary-button compact">Concluir revisão e publicar</button>
    </form>
  );
}
