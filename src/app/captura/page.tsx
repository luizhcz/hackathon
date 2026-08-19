"use client";

import { ChangeEvent, useEffect, useState } from "react";

export default function CapturePage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setError(null);
    setStatus("idle");
    if (selected && !["image/jpeg", "image/png"].includes(selected.type)) {
      setFile(null);
      setError("Use uma imagem JPEG ou PNG.");
      return;
    }
    if (selected && selected.size > 10 * 1024 * 1024) {
      setFile(null);
      setError("A imagem deve ter no máximo 10 MB.");
      return;
    }
    setFile(selected);
  }

  async function send() {
    if (!file) return;
    setStatus("sending");
    setError(null);
    const form = new FormData();
    form.set("imagem", file);
    try {
      const response = await fetch("/api/upload", { method: "POST", body: form });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error);
      }
      setStatus("sent");
    } catch (caught) {
      setStatus("idle");
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "Não consegui enviar. Verifique a conexão e tente novamente.",
      );
    }
  }

  return (
    <main className="capture-shell">
      <section className="capture-card">
        <div className="eyebrow">FOTO VIRA ANÚNCIO</div>
        <h1>Fotografe. A gente prepara o resto.</h1>
        <p className="lede">Use uma foto nítida da frente da embalagem.</p>

        <label className={`photo-drop ${preview ? "has-preview" : ""}`}>
          {preview ? <img src={preview} alt="Prévia do produto" /> : <span className="camera-mark">◎</span>}
          <span>{preview ? "Trocar foto" : "Abrir câmera"}</span>
          <input type="file" accept="image/jpeg,image/png" capture="environment" onChange={selectFile} />
        </label>

        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" disabled={!file || status !== "idle"} onClick={send}>
          {status === "sending" ? "Enviando…" : status === "sent" ? "Enviado ✓" : "Enviar foto"}
        </button>
        {status === "sent" && <p className="success-note">Pronto. Você já pode acompanhar no painel.</p>}
      </section>
    </main>
  );
}
