# hackathon

Workspace para desenvolver a demo **Foto vira anúncio** com Codex de ponta a ponta.

## Documentação

- `docs/specs/foto-vira-anuncio.md` — spec confirmada da demo.
- `docs/workstreams/frontend-backend.md` — contrato e ownership para trabalho paralelo.
- `CONTEXT.md` — glossário do domínio.
- `docs/adr/` — decisões arquiteturais.

## Trabalho paralelo

A `main` contém a aplicação funcional e uma cópia isolada do protótipo visual
em `prototype/demo-ui`, com dados simulados no navegador. O protótipo continua
sendo evoluído na branch `prototype/demo-ui` e não é importado pelo build da
aplicação funcional.

Frontend e backend trabalham em paralelo por meio do contrato HTTP e do DTO
`Job`. As decisões visuais escolhidas — captura A, painel C e loja B — chegam à
aplicação por handoff e são reimplementadas nas páginas existentes; manter o
protótipo no repositório não o conecta ao backend.

## Como usar

Clone o repositório e abra a pasta com o Codex CLI:

```bash
git clone https://github.com/luizhcz/hackathon.git
cd hackathon
codex
```

## Executar a demo

Requisitos: Node.js 24, npm e login local do Codex ativo.

```bash
npm install
npm run verify
npm run codex:smoke
npm run dev
```

A aplicação inicia em modo `FIXTURE`, sem depender de rede ou autenticação durante o Fluxo principal.

- Painel: `http://localhost:3000/painel`
- Captura pelo celular: `http://<IP-DO-NOTEBOOK>:3000/captura`
- Vitrine: `http://localhost:3000/loja`

Descubra o IP local com `hostname -I`. Notebook e celular devem estar na mesma rede ou hotspot.

No painel:

- `M` alterna `LIVE → LOCAL → FIXTURE`;
- `5` enfileira as cinco fixtures;
- `R` limpa os Jobs após confirmação.

`npm run codex:smoke` valida autenticação, JSON Schema, imagem PNG, busca `live` e cancelamento usando o `LocalCodexSdkRuntime` real.

## Ensaio no equipamento final

1. Conecte notebook e celular ao hotspot do palco.
2. Rode `npm run codex:smoke` e depois `npm run dev`.
3. Abra `/painel` no projetor, `/captura` no celular e `/loja` em outra aba.
4. Envie uma foto JPEG/PNG real e confirme que ela aparece no painel.
5. Publique o Anúncio e confira a vitrine.
6. Acione `5` e confirme que dois Jobs avançam simultaneamente e a caixa lisa vira Exceção.
7. Teste `M` e confirme que a mudança afeta somente Jobs novos.
8. Desligue a rede, selecione `FIXTURE` e repita o Fluxo principal.
