# Trabalho paralelo de frontend e backend

Este acordo permite que duas pessoas trabalhem ao mesmo tempo sem editar os
mesmos arquivos. A `main` contém a aplicação funcional e pode registrar cópias
aprovadas do protótipo; a branch `prototype/demo-ui` responde somente à
pergunta visual com dados simulados.

## Seam entre os módulos

O seam é o contrato HTTP e o DTO `Job` definidos na spec e implementados na
`main`. O frontend conhece somente esse contrato e seus estados visíveis. O
backend esconde fila, Codex, armazenamento em memória e processamento atrás
dele.

Durante o protótipo, um Adapter em memória no navegador simula a mesma
interface. Na aplicação funcional, as rotas HTTP são o Adapter real. Os mocks
devem reproduzir o formato e a semântica do contrato, não a implementação do
backend.

### Interface congelada

| Operação | Resultado relevante para o frontend |
|---|---|
| `POST /api/upload` | `202 { id }` ou erro de imagem |
| `GET /api/jobs` | `Job[]`, sem bytes da imagem |
| `GET /api/jobs/:id/imagem` | imagem indicada por `imagem_url` |
| `POST /api/jobs/:id/publicar` | `Job` publicado ou erro de transição |
| `GET /api/demo/modo` | `{ modo }` |
| `POST /api/demo/modo` | `{ modo }` |
| `POST /api/demo/fixtures` | `202 { ids }` |
| `DELETE /api/demo/jobs` | `204` |

O frontend pode depender destes fatos:

- `Job.status` é `processando`, `aguardando`, `publicado` ou `excecao`;
- os quatro `passos` sempre existem e mudam de estado;
- `imagem_url` é renderizável diretamente;
- Resultado degradado vem de `preco.degradado`;
- Exceção vem de `status` e `motivo_excecao`;
- o Anúncio efetivamente publicado vem de `publicado.anuncio`;
- o painel funcional consulta Jobs a cada 800 ms.

Qualquer alteração nessa interface deve ser proposta numa issue antes de
mudar código. Uma pessoa não adapta silenciosamente o contrato para facilitar
seu próprio lado.

## Ownership sem sobreposição

### Pessoa de frontend

Na fase de protótipo, possui exclusivamente:

- `prototype/demo-ui/**`;
- documentação de execução dentro do diretório do protótipo;
- estados, temporizadores e fixtures visuais executados no navegador.

Não adiciona Next.js, rotas, Codex SDK, busca web, persistência ou processamento
no servidor. Os dados simulados devem seguir a interface congelada acima.

No handoff para a aplicação funcional, a pessoa de frontend passa a possuir:

- páginas de captura, painel e loja;
- estilos globais e módulos visuais dessas páginas;
- clientes HTTP e estado exclusivamente visual.

### Pessoa de backend

Possui exclusivamente na aplicação funcional:

- rotas HTTP;
- módulos de domínio e validação;
- armazenamento, fila e publicação;
- fixtures de processamento;
- integração Codex e smoke tests;
- testes desses módulos.

Durante o trabalho paralelo, não redesenha captura, painel ou loja e não altera
CSS visual. Se precisar expor informação nova, propõe primeiro a mudança da
interface.

## Fluxo de branches

1. Frontend conclui #9, #10 e #11 em `prototype/demo-ui`.
2. Backend evolui a aplicação a partir de `origin/main`, sem importar o código
   descartável do protótipo.
3. Cada frente publica commits pequenos somente em sua área de ownership; um
   marco aprovado do protótipo pode ser aplicado à `main` sem conectá-lo à
   aplicação funcional.
4. Ao concluir #11, frontend produz um handoff com as decisões A/C/B, estados e
   comportamento validado.
5. Uma branch nova de integração nasce da `main`; nela, frontend reimplementa
   as decisões visuais nas páginas existentes usando o contrato congelado.
6. Backend revisa apenas a aderência ao contrato; frontend revisa apenas o
   comportamento e a apresentação das telas.

Não fazer merge ou rebase da `main` dentro da branch do protótipo: a aplicação
funcional e o protótipo têm ciclos independentes. A presença do diretório
estático na `main` serve para consulta e demonstração; a portabilidade ocorre
pelo handoff e pela interface, não pela importação do protótipo no build.

## Decisões existentes

- ADR-0001 fornece os cenários de Resultado degradado e Exceção que o frontend
  simula.
- ADR-0003 governa somente a implementação do backend com Codex SDK.
- A composição visual é captura A, painel C e loja B.
- O protótipo é explicitamente simulado; nunca deve aparentar execução live.
