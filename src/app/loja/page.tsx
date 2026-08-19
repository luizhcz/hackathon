"use client";

import { useEffect, useState } from "react";

import type { Job } from "@/domain/types";

export default function StorefrontPage() {
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    async function refresh() {
      const response = await fetch("/api/jobs", { cache: "no-store" });
      if (response.ok) setJobs(((await response.json()) as Job[]).filter((job) => job.status === "publicado"));
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="store-shell">
      <header className="store-header"><span className="store-logo">PRONTO<span>!</span></span><span>Novidades da loja</span></header>
      <section className="store-hero"><div className="eyebrow">CADASTRADOS AGORA</div><h1>Produtos novos,<br />prontos para você.</h1></section>
      {jobs.length === 0 ? (
        <div className="store-empty">Os anúncios publicados aparecerão aqui.</div>
      ) : (
        <section className="store-grid">
          {jobs.map((job) => (
            <article className="store-product" key={job.id}>
              <div className="store-image"><img src={job.imagem_url} alt={job.publicado?.anuncio.titulo} /></div>
              <span className="product-category">{job.publicado?.anuncio.categoria_loja}</span>
              <h2>{job.publicado?.anuncio.titulo}</h2>
              <strong className="store-price">R$ {job.publicado?.anuncio.preco.toFixed(2).replace(".", ",")}</strong>
              <p>{job.publicado?.anuncio.descricao}</p>
              <div className="tags">{job.publicado?.anuncio.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
