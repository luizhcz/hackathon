/*
 * PROTÓTIPO DESCARTÁVEL.
 * Composição aprovada: captura A, painel C e loja B.
 * Todo processamento e todo dado desta interface são simulados no navegador.
 */

import { resolveRoute, searchForSurface, surfaces } from "./route-policy.mjs";

const steps = (identify, price, write, publish) => [
  { id: "identificar", label: "Identificar produto", ...identify },
  { id: "precificar", label: "Buscar preço", ...price },
  { id: "redigir", label: "Escrever anúncio", ...write },
  { id: "publicar", label: "Publicar", ...publish },
];

const jobs = [
  {
    id: "job-nescau",
    name: "Saborê ChocoMax 380 g",
    category: "Alimento",
    image: "linear-gradient(145deg, #5b2417, #cf673b 62%, #f7c368)",
    glyph: "SC",
    status: "aguardando",
    mode: "LIVE",
    exact: true,
    price: 12.9,
    range: null,
    summary: "EAN 7891234567895 validado",
    description: "Achocolatado em pó sabor chocolate, embalagem de 380 g.",
    tags: ["achocolatado", "chocolate", "380g"],
    steps: steps(
      { status: "ok", ms: 1800, summary: "EAN validado" },
      { status: "ok", ms: 3100, summary: "R$ 12,90 · 3 referências · exato" },
      { status: "ok", ms: 2200, summary: "Título com 25 caracteres, 3 tags" },
      { status: "aguardando", ms: null, summary: "Confirmação humana" },
    ),
  },
  {
    id: "job-lumina",
    name: "Lumina Hidrata Plus 400 ml",
    category: "Higiene",
    image: "linear-gradient(145deg, #d7f2ef, #4ab8ae 55%, #126c70)",
    glyph: "LH",
    status: "processando",
    mode: "LIVE",
    exact: false,
    price: null,
    range: null,
    summary: "Marca e produto lidos da embalagem",
    description: "Shampoo para cabelos secos, frasco de 400 ml.",
    tags: ["shampoo", "cabelos secos", "400ml"],
    steps: steps(
      { status: "ok", ms: 2100, summary: "Texto da embalagem" },
      { status: "rodando", ms: null, summary: "Buscando equivalentes" },
      { status: "pendente", ms: null, summary: null },
      { status: "pendente", ms: null, summary: null },
    ),
  },
  {
    id: "job-detergente",
    name: "Detergente para roupas 2 L",
    category: "Limpeza",
    image: "linear-gradient(145deg, #f0f7ff, #72a8df 52%, #244f93)",
    glyph: "2L",
    status: "aguardando",
    mode: "LOCAL",
    exact: false,
    price: 11.9,
    range: [8, 15],
    summary: "Categoria e quantidade identificadas",
    description: "Detergente líquido para roupas brancas e coloridas, embalagem de 2 L.",
    tags: ["detergente", "roupas", "2 litros"],
    steps: steps(
      { status: "ok", ms: 1700, summary: "Categoria + quantidade" },
      { status: "ok", ms: 40, summary: "R$ 8–15 · tabela local" },
      { status: "ok", ms: 1900, summary: "Texto factual, 3 tags" },
      { status: "aguardando", ms: null, summary: "Preço pede atenção" },
    ),
  },
  {
    id: "job-caixa",
    name: "Produto não identificado",
    category: "Categoria desconhecida",
    image: "linear-gradient(145deg, #d5b284, #a87842 60%, #68401f)",
    glyph: "?",
    status: "excecao",
    mode: "FIXTURE",
    exact: false,
    price: null,
    range: null,
    summary: "Categoria desconhecida — revisão necessária",
    description: "",
    tags: [],
    steps: steps(
      { status: "falhou", ms: 1300, summary: "Confiança baixa" },
      { status: "ignorado", ms: null, summary: "Sem evidência suficiente" },
      { status: "ignorado", ms: null, summary: "Aguardando revisão" },
      { status: "aguardando", ms: null, summary: "Revisão humana obrigatória" },
    ),
  },
  {
    id: "job-caderno",
    name: "Traço Campus 96 folhas",
    category: "Papelaria",
    image: "linear-gradient(145deg, #b4cff6, #446bd2 58%, #17285f)",
    glyph: "TC",
    status: "publicado",
    mode: "FIXTURE",
    exact: false,
    price: 18.9,
    range: null,
    summary: "Publicado na vitrine local",
    description: "Caderno espiral azul com 96 folhas.",
    tags: ["caderno", "espiral", "papelaria"],
    steps: steps(
      { status: "ok", ms: 1400, summary: "Texto da capa" },
      { status: "ok", ms: 2600, summary: "R$ 18,90 · equivalentes" },
      { status: "ok", ms: 1600, summary: "Título com 24 caracteres, 3 tags" },
      { status: "ok", ms: 120, summary: "Publicado" },
    ),
  },
];

let reviewingJobId = null;
let uploadPreview = null;
let uploadMessage = "";
let capturePhase = "inicio";
let captureSource = null;
let captureTimers = [];

function getRoute() {
  return resolveRoute(window.location.search);
}

function setRoute(surface) {
  window.history.replaceState({}, "", `${window.location.pathname}${searchForSurface(surface)}`);
  render();
}

function productVisual(job, size = "normal") {
  return `<div class="product-visual ${size}" style="--product-bg:${job.image}"><span>${job.glyph}</span></div>`;
}

function statusLabel(status) {
  return {
    processando: "Processando",
    aguardando: "Pronto para publicar",
    publicado: "Publicado",
    excecao: "Revisão necessária",
  }[status];
}

function stepMarkup(step, compact = false) {
  const time = step.ms ? `${(step.ms / 1000).toFixed(1).replace(".", ",")}s` : "";
  return `
    <li class="step step-${step.status}">
      <span class="step-dot"></span>
      <span class="step-copy">
        <strong>${step.label}</strong>
        ${!compact && step.summary ? `<small>${step.summary}</small>` : ""}
      </span>
      <span class="step-time">${time}</span>
    </li>`;
}

function actionButton(job, kind = "solid") {
  if (job.status === "aguardando") {
    return `<button class="button ${kind}" data-action="publish" data-job="${job.id}">Publicar anúncio</button>`;
  }
  if (job.status === "excecao") {
    return `<button class="button warning" data-action="review" data-job="${job.id}">Revisar para publicar</button>`;
  }
  if (job.status === "publicado") {
    return `<span class="published-mark">✓ Publicado</span>`;
  }
  return `<span class="working-mark"><i></i> Simulação em andamento</span>`;
}

function appHeader(route) {
  return `
    <header class="app-header">
      <a class="brand" href="${searchForSurface("painel")}" data-surface="painel">
        <span class="brand-mark">↗</span>
        <span><b>Foto vira anúncio</b><small>Protótipo com dados simulados</small></span>
      </a>
      <nav class="surface-nav" aria-label="Telas do protótipo">
        ${Object.entries(surfaces).map(([key, label]) => `
          <button class="nav-link ${route.surface === key ? "active" : ""}" data-surface="${key}">${label}</button>
        `).join("")}
      </nav>
      <div class="header-side"><span class="simulation-badge">Simulação local</span></div>
    </header>`;
}

function prototypeSurfaceNav(route) {
  return `<nav class="prototype-surface-nav" aria-label="Telas do protótipo">${Object.entries(surfaces).map(([key, label]) => `<button class="${route.surface === key ? "active" : ""}" data-surface="${key}">${label}</button>`).join("")}<span class="simulation-badge">Simulado</span></nav>`;
}

function chatHeader() {
  return `
    <header class="chat-header">
      <button class="chat-back" aria-label="Voltar">‹</button>
      <span class="chat-avatar">↗</span>
      <span class="chat-contact"><b>Foto vira anúncio</b><small>simulação local</small></span>
      <button class="chat-menu" aria-label="Mais opções">⋮</button>
    </header>`;
}

function captureInputs() {
  return `
    <input id="camera-input" data-capture-source="camera" type="file" accept="image/jpeg,image/png" capture="environment" hidden />
    <input id="gallery-input" data-capture-source="galeria" type="file" accept="image/jpeg,image/png" hidden />`;
}

function chatStatusMessage() {
  if (capturePhase === "catalogando") {
    return `<div class="chat-bubble incoming agent-progress"><span class="typing"><i></i><i></i><i></i></span><div><b>Lendo a embalagem</b><small>Procurando nome, quantidade e EAN…</small></div></div>`;
  }
  if (capturePhase === "precificando") {
    return `<div class="chat-bubble incoming agent-progress"><span class="progress-check">✓</span><div><b>Saborê ChocoMax identificado</b><small>Agora estou buscando o preço.</small></div></div>`;
  }
  if (capturePhase === "redigindo") {
    return `<div class="chat-bubble incoming agent-progress"><span class="progress-check">✓</span><div><b>Preço encontrado: R$ 12,90</b><small>Escrevendo o anúncio…</small></div></div>`;
  }
  if (capturePhase === "pronto") {
    return `
      <div class="chat-bubble incoming draft-message">
        <span class="message-label">Anúncio pronto</span>
        <div class="chat-product">${uploadPreview ? `<img src="${uploadPreview}" alt="Produto enviado" />` : ""}<div><b>Saborê ChocoMax 380 g</b><small>Alimento · item exato</small></div></div>
        <p>Achocolatado em pó sabor chocolate, embalagem de 380 g.</p>
        <div class="chat-price"><span>Preço sugerido</span><b>R$ 12,90</b></div>
        <div class="chat-tags"><i>achocolatado</i><i>chocolate</i><i>380g</i></div>
        <button class="chat-publish" data-action="chat-publish">Publicar anúncio</button>
        <small class="chat-safety">Revise somente se algo parecer errado.</small>
      </div>`;
  }
  if (capturePhase === "publicado") {
    return `
      <div class="chat-bubble incoming success-message"><span class="success-icon">✓</span><div><b>Publicado</b><small>O anúncio já está na sua vitrine.</small></div><button data-action="reset-capture">Anunciar outro produto</button></div>`;
  }
  return "";
}

function chatMessages() {
  return `
    <div class="chat-day"><span>Hoje</span></div>
    <div class="chat-notice">Suas fotos são usadas apenas para preparar o anúncio.</div>
    <div class="chat-bubble incoming welcome-message"><b>Olá, Ana! 👋</b><p>Envie uma foto da embalagem. Eu identifico o produto, pesquiso o preço e escrevo o anúncio.</p><small>Você só confirma antes de publicar.</small><time>13:40</time></div>
    ${uploadPreview ? `<div class="chat-bubble outgoing photo-message"><img src="${uploadPreview}" alt="Foto enviada por ${captureSource}" /><span>${uploadMessage}</span><time>13:41 <b>✓✓</b></time></div>` : ""}
    ${chatStatusMessage()}`;
}

function directComposer() {
  return `
    <div class="chat-composer direct-composer">
      <button class="composer-attach" data-action="open-gallery" aria-label="Escolher imagem">＋</button>
      <div class="composer-placeholder">Mensagem</div>
      <button class="composer-camera" data-action="open-camera" aria-label="Abrir câmera">⌾</button>
    </div>
    <div class="composer-hint"><span>＋ Escolher imagem</span><span>⌾ Abrir câmera</span></div>`;
}

function captureSurface() {
  return `
    <main class="whatsapp-prototype capture-variant-a">
      <section class="phone-shell">
        <div class="phone-status"><span>13:41</span><span>▮▮▮ ◔</span></div>
        ${chatHeader()}
        <div class="chat-wallpaper"><div class="chat-thread">${chatMessages()}</div></div>
        ${directComposer()}
        ${captureInputs()}
      </section>
      <aside class="capture-rationale"><span class="kicker">A · Conversa direta</span><h1>A conversa é a interface.</h1><p>Câmera e galeria vivem no compositor, como num chat cotidiano.</p><div class="two-touch"><span><b>1</b> Enviar foto</span><i></i><span><b>2</b> Publicar anúncio</span></div></aside>
    </main>`;
}

function laneFor(status, title, hint) {
  const laneJobs = jobs.filter((job) => job.status === status);
  return `<section class="lane lane-${status}"><header><span>${String(laneJobs.length).padStart(2, "0")}</span><div><h2>${title}</h2><p>${hint}</p></div></header><div class="lane-list">${laneJobs.map((job) => `<article class="lane-card">${productVisual(job, "small")}<div class="lane-copy"><span>${job.category}</span><h3>${job.name}</h3><p>${job.summary}</p>${job.steps.find((step) => ["rodando", "aguardando", "falhou"].includes(step.status)) ? `<div class="active-step">${stepMarkup(job.steps.find((step) => ["rodando", "aguardando", "falhou"].includes(step.status)), true)}</div>` : ""}${actionButton(job, "outline")}</div></article>`).join("") || `<div class="empty-lane">Nenhum produto</div>`}</div></section>`;
}

function panelSurface() {
  return `
    <main class="panel panel-c">
      <section class="cinema-head"><div><span class="kicker">Esteira autônoma</span><h1>Da foto à vitrine</h1></div><div class="legend"><span><i class="green"></i> concluído</span><span><i class="amber"></i> sua decisão</span><span><i class="red"></i> revisão</span></div></section>
      <section class="lanes">
        ${laneFor("processando", "Codex trabalhando", "Leitura, preço e texto")}
        ${laneFor("aguardando", "Sua decisão", "Um toque para publicar")}
        ${laneFor("excecao", "Revisão humana", "Evidência insuficiente")}
        ${laneFor("publicado", "Na vitrine", "Anúncios concluídos")}
      </section>
    </main>`;
}

function storeProduct(job) {
  return `<article class="store-row">${productVisual(job, "large")}<div class="store-copy"><span>${job.category}</span><h2>${job.name}</h2><p>${job.description}</p><div class="tags">${job.tags.map((tag) => `<i>${tag}</i>`).join("")}</div></div><strong class="store-price">R$ ${job.price.toFixed(2).replace(".", ",")}</strong></article>`;
}

function storeSurface() {
  const published = jobs.filter((job) => job.status === "publicado");
  return `<main class="store store-b"><header><span class="kicker">Publicado pelo Codex</span><h1>Novidades na prateleira</h1><p>Uma vitrine mínima para fechar a história da demo.</p></header><section class="store-products rows">${published.map(storeProduct).join("")}</section></main>`;
}

function reviewModal() {
  const job = jobs.find((item) => item.id === reviewingJobId);
  if (!job) return "";
  return `
    <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Revisar anúncio">
      <form class="review-modal" data-action="finish-review">
        <div class="review-head"><div><span class="kicker">Revisão humana obrigatória</span><h2>Complete o anúncio</h2><p>A identificação original permanece visível como evidência.</p></div><button type="button" class="icon-button" data-action="close-review">×</button></div>
        <div class="review-evidence">${productVisual(job, "small")}<div><span>Identificação do Codex</span><b>${job.name}</b><p>${job.summary}</p></div></div>
        <div class="form-grid"><label>Título<input required value="Produto para revisão" /></label><label>Categoria<select><option>Utilidade</option><option>Outro</option></select></label><label class="wide">Descrição<textarea required>Produto novo. Informações conferidas por revisão humana.</textarea></label><label>Tags<input required value="produto, revisão, loja" /></label><label>Preço<input required value="19,90" /></label></div>
        <button class="button solid wide-button" type="submit">Concluir revisão e publicar</button>
      </form>
    </div>`;
}

function stateInspector(route) {
  return `<details class="state-inspector"><summary>Estado simulado</summary><pre>${JSON.stringify({ route, capture: { phase: capturePhase, source: captureSource, file: uploadMessage || null, hasPreview: Boolean(uploadPreview) }, reviewingJobId, jobs: jobs.map(({ id, status, mode, steps }) => ({ id, status, mode, steps: steps.map(({ id: stepId, status: stepStatus }) => ({ id: stepId, status: stepStatus })) })) }, null, 2)}</pre></details>`;
}

function render() {
  const route = getRoute();
  const surface = route.surface === "captura"
    ? captureSurface()
    : route.surface === "loja"
      ? storeSurface()
      : panelSurface();

  document.documentElement.dataset.variant = route.variant;
  document.documentElement.dataset.surface = route.surface;
  const navigation = route.surface === "captura" ? prototypeSurfaceNav(route) : appHeader(route);
  document.getElementById("app").innerHTML = `${navigation}${surface}${reviewModal()}${stateInspector(route)}`;
}

function clearCaptureTimers() {
  captureTimers.forEach((timer) => window.clearTimeout(timer));
  captureTimers = [];
}

function advanceCapture(after, phase) {
  captureTimers.push(window.setTimeout(() => {
    capturePhase = phase;
    render();
  }, after));
}

function processCaptureFile(file, source) {
  clearCaptureTimers();
  captureSource = source;
  uploadMessage = file.name;
  const reader = new FileReader();
  reader.onload = () => {
    uploadPreview = reader.result;
    capturePhase = "catalogando";
    render();
    advanceCapture(900, "precificando");
    advanceCapture(1800, "redigindo");
    advanceCapture(2800, "pronto");
  };
  reader.readAsDataURL(file);
}

function resetCapture() {
  clearCaptureTimers();
  uploadPreview = null;
  uploadMessage = "";
  capturePhase = "inicio";
  captureSource = null;
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action], [data-surface]");
  if (!target) return;

  if (target.dataset.surface) {
    event.preventDefault();
    setRoute(target.dataset.surface);
    return;
  }

  const action = target.dataset.action;
  const job = jobs.find((item) => item.id === target.dataset.job);
  if (action === "publish" && job) {
    job.status = "publicado";
    job.steps[3] = { ...job.steps[3], status: "ok", ms: 120, summary: "Publicado" };
    render();
  }
  if (action === "review" && job) { reviewingJobId = job.id; render(); }
  if (action === "close-review") { reviewingJobId = null; render(); }
  if (action === "open-camera") document.getElementById("camera-input")?.click();
  if (action === "open-gallery") document.getElementById("gallery-input")?.click();
  if (action === "chat-publish") {
    jobs[0].status = "publicado";
    jobs[0].steps[3] = { ...jobs[0].steps[3], status: "ok", ms: 120, summary: "Publicado pelo celular" };
    capturePhase = "publicado";
    render();
  }
  if (action === "reset-capture") { resetCapture(); render(); }
});

document.addEventListener("submit", (event) => {
  if (!event.target.matches('[data-action="finish-review"]')) return;
  event.preventDefault();
  const job = jobs.find((item) => item.id === reviewingJobId);
  if (job) {
    job.name = "Produto revisado manualmente";
    job.category = "Utilidade";
    job.description = "Produto novo. Informações conferidas por revisão humana.";
    job.tags = ["produto", "revisão", "loja"];
    job.price = 19.9;
    job.status = "publicado";
    job.steps[3] = { ...job.steps[3], status: "ok", ms: 200, summary: "Revisado e publicado" };
  }
  reviewingJobId = null;
  render();
});

document.addEventListener("change", (event) => {
  if (!event.target.matches("[data-capture-source]")) return;
  const file = event.target.files?.[0];
  if (!file) return;
  processCaptureFile(file, event.target.dataset.captureSource);
});

window.addEventListener("popstate", render);
render();
