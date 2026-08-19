# Foto vira anúncio — spec de build

> Demo de hackathon, não produto. Orçamento fechado: **3 horas de desenvolvimento + 1 hora de ensaio**. Quando “mais correto” conflitar com “cabe no relógio”, vence o relógio — sem cortar segurança, honestidade do pitch ou ensaio.

## 1. Resultado esperado

Um pequeno varejista fotografa um produto novo. O sistema identifica o item, sugere um preço e escreve um Anúncio. No Fluxo principal, o humano participa somente ao enviar a foto e ao confirmar a publicação.

O argumento do palco é físico: o apresentador fotografa o produto, larga o celular e deixa o painel mostrar o trabalho acontecendo.

### Critérios de sucesso

- Uma foto JPEG ou PNG enviada pelo celular cria um Job imediatamente.
- O painel mostra os quatro passos desde o nascimento do Job e atualiza seu estado sem intervenção.
- Identificação, preço e redação usam exclusivamente Codex por meio do SDK oficial no modo `LIVE`.
- Falhas de preço ou redação produzem Resultado degradado por código determinístico.
- Identificação insegura nunca é publicada diretamente; vira Exceção e exige Revisão humana.
- A confirmação publica o Anúncio numa vitrine local.
- Cinco Jobs podem existir ao mesmo tempo, com no máximo dois em processamento.
- A apresentação possui modos de contingência explícitos e ensaiados.

### Fora de escopo

- Banco de dados, autenticação e autorização.
- Marketplace externo.
- Deploy serverless ou hospedagem remota.
- Edição opcional no Fluxo principal.
- Histórico após reiniciar o processo.
- Segunda passada de visão.
- Limpeza ou geração de imagem.
- Websocket, SSE ou filas externas.
- Responsividade refinada do painel.

## 2. Regra de ouro

No Fluxo principal, o humano aparece em exatamente dois pontos:

1. envia a imagem;
2. confirma a publicação.

Nada entre esses pontos pode pedir aprovação, abrir diálogo ou esperar uma resposta humana. Falhas técnicas degradam quando existe uma saída determinística segura.

A Exceção é deliberadamente diferente de degradação: se o Catalogador falhar ou souber pouco demais para sustentar um Anúncio, o Job entra na Fila de revisão humana. A Revisão humana é um caminho excepcional e não viola a promessa feita sobre o Fluxo principal.

## 3. Restrição Codex de ponta a ponta

Toda capacidade de inteligência artificial usa Codex:

| Momento | Recurso |
|---|---|
| Desenvolvimento | Codex CLI |
| Runtime de IA | Threads locais do Codex |
| Integração Node.js | `LocalCodexSdkRuntime` sobre `@openai/codex-sdk@0.148.0` |
| Visão | Entrada de imagem local do Codex SDK |
| Saída estruturada | `outputSchema` do Codex SDK |
| Preço ao vivo | Busca web `live` do Codex SDK |
| Fallbacks | TypeScript determinístico, sem IA |
| Fixtures | Saídas previamente geradas pelo Codex |

Não usar:

- OpenAI Agents SDK;
- Responses API diretamente;
- function calling;
- outro modelo ou serviço de IA;
- geração ou edição de imagem.

### 3.1 CodexRuntime

`CodexRuntime` é o único seam de IA da aplicação. Sua interface recebe perfil, prompt, imagem opcional, JSON Schema e sinal de cancelamento, e devolve somente o resultado validado e metadados normalizados. `LocalCodexSdkRuntime` é o único adapter real nesta entrega e deve:

- fixar exatamente `@openai/codex-sdk@0.148.0` e versionar o lockfile;
- iniciar uma thread nova e isolada para cada perfil de cada Job;
- enviar imagem como entrada local estruturada somente para o Catalogador;
- passar um JSON Schema versionado em `outputSchema` para cada perfil;
- capturar a resposta final e fazer `JSON.parse`;
- validar o objeto antes de devolvê-lo ao pipeline;
- cancelar a execução com `AbortSignal` ao atingir o timeout;
- consumir o streaming internamente e nunca expor tipos, eventos, raciocínio ou saída bruta do SDK;
- traduzir falhas do SDK para erros estáveis do contrato;
- apagar workspace e arquivos temporários em `finally`.

Configuração comum a todas as execuções:

```text
sandboxMode: read-only
approvalPolicy: never
skipGitRepoCheck: true
model: gpt-5.4-mini
modelReasoningEffort: low
networkAccessEnabled: false
webSearchMode: disabled
features.apps: false
features.plugins: false
```

Cada thread executa em workspace temporário isolado contendo somente os artefatos de entrada necessários. Catalogador e Redator permanecem sem rede e com busca desabilitada. Apenas o Precificador `LIVE` recebe `networkAccessEnabled: true` e `webSearchMode: live`. Qualquer ampliação futura de permissão deve ser mínima, limitada ao perfil que a exige e coberta por teste focado; aprovação permanece `never`.

O SDK controla um runtime Codex local e usa o login já configurado. Antes da demo, executar:

```bash
codex --version
codex login status
```

Falha nesse preflight inicia a aplicação em `FIXTURE`. Nenhum token, arquivo de autenticação ou chave entra no repositório.

### 3.2 Perfis Codex

Cada Job usa até três execuções novas, sequenciais e efêmeras:

1. **Catalogador** — recebe prompt, imagem e `CatalogadorOut`.
2. **Precificador** — recebe a Identificação e `PrecificadorOut`; somente ele pode pesquisar a web.
3. **Redator** — recebe Identificação e preço e devolve `RedatorOut`.

Os perfis não compartilham nem retomam threads. O servidor passa explicitamente apenas o resultado validado da etapa anterior. Isso mantém permissões, contexto e falhas isolados.

## 4. Arquitetura

```text
Celular /captura ──POST /api/upload──────────┐
                                             ▼
                                   ┌──────────────────┐
                                   │   App Next.js    │
                                   │ Map + fila FIFO  │
                                   │ concorrência 2   │
                                   └────────┬─────────┘
                                            │
                            ┌───────────────▼───────────────┐
                            │ CodexRuntime                  │
                            │ 1 Catalogador  imagem+schema  │
                            │ 2 Precificador busca+schema   │
                            │ 3 Redator      schema         │
                            └───────────────┬───────────────┘
                                            │
Projetor /painel ──GET /api/jobs (800 ms)───┘
                 ──POST /api/jobs/:id/publicar──▶ /loja
```

### Decisões fixas

| Decisão | Escolha | Motivo |
|---|---|---|
| Aplicação | Next.js App Router + TypeScript | Um único projeto e uma única rede local |
| Runtime | Node.js local | Codex SDK é server-side e controla threads locais; não funciona como Edge runtime |
| Estado | `Map` singleton em `globalThis` | Evita banco e sobrevive a recargas de módulo em desenvolvimento |
| Trabalho | Fila FIFO com concorrência 2 | Protege latência e recursos durante cinco uploads |
| Atualização | Polling a cada 800 ms | Recupera sozinho de perda temporária de rede |
| Imagem | Rota separada | Bytes não entram no payload repetido do polling |
| Publicação | Vitrine local `/loja` | Produz payoff visual sem integração externa |

O `Map` é a persistência oficial. Cada entrada interna armazena Job, bytes da imagem e MIME. `GET /api/jobs` nunca serializa os bytes.

Como o Codex SDK recebe imagem local por caminho, o Catalogador cria uma cópia no workspace temporário isolado. Essa cópia é transporte, não persistência, e deve ser removida após a execução. A imagem continua disponível no painel pelos bytes mantidos no `Map`.

## 5. Modos de execução

O modo é copiado para `job.modo_execucao` na criação. Alterar o modo global afeta apenas Jobs futuros.

| Modo | Catalogador | Precificador | Redator | Uso |
|---|---|---|---|---|
| `live` | Codex | Codex + busca live | Codex | Demonstração real quando o preflight e o ensaio passam |
| `local` | Codex | Tabela local | Codex | Busca indisponível ou instável |
| `fixture` | Replay gravado | Replay gravado | Replay gravado | Contingência total, sem chamadas externas |

Fixtures devem conter saídas produzidas previamente pelo Codex e latências artificiais suficientes para o público perceber a progressão. Elas não são apresentadas como medição live.

Atalhos do `/painel`:

- `M`: alterna `LIVE → LOCAL → FIXTURE`;
- `5`: enfileira as cinco fixtures versionadas;
- `R`: pede confirmação curta e limpa todos os Jobs.

Um badge pequeno e sempre visível mostra o modo atual. Se Codex não estiver autenticado ou o smoke test falhar, iniciar em `FIXTURE`.

## 6. Contratos HTTP

```text
POST   /api/upload
       multipart/form-data: imagem
       → 202 { id: string }

GET    /api/jobs
       → Job[]

GET    /api/jobs/:id/imagem
       → bytes com Content-Type original

POST   /api/jobs/:id/publicar
       body: RedatorOut
       → Job

POST   /api/demo/modo
       body: { modo: "live" | "local" | "fixture" }
       → { modo: string }

POST   /api/demo/fixtures
       → 202 { ids: string[] }

DELETE /api/demo/jobs
       → 204
```

### Upload

- Aceitar somente `image/jpeg` e `image/png`.
- Limite de 10 MB.
- Retornar `415` para formato inválido e `413` para tamanho excedido.
- Criar o Job e seus quatro Passos antes de responder `202`.
- Enfileirar o processamento sem aguardar Codex.

### Publicação

A transição deve ser síncrona e atômica dentro do processo:

- `processando` → rejeitar com `409`;
- `aguardando` + `RedatorOut` válido → publicar;
- `excecao` + `RedatorOut` completo → concluir Revisão humana e publicar;
- `publicado` → devolver o mesmo Job, sem duplicar;
- corpo inválido → `400`, sem alterar o Job.

Se `job.anuncio` for `null`, todos os campos de `RedatorOut` entram em `campos_editados`. Caso contrário, o servidor calcula o diff campo a campo.

## 7. Contratos de domínio

### 7.1 Categorias

```ts
type Categoria =
  | "alimento"
  | "bebida"
  | "limpeza"
  | "higiene"
  | "eletronico"
  | "papelaria"
  | "utilidade"
  | "outro";
```

`outro` significa “categoria conhecida fora das sete principais”. `null` significa que nem a categoria pôde ser identificada.

### 7.2 Passo

Os quatro Passos existem desde a criação em `pendente`; eles mudam de estado, nunca aparecem depois.

```ts
type PassoId = "identificar" | "precificar" | "redigir" | "publicar";

interface Passo {
  id: PassoId;
  rotulo: string;
  status:
    | "pendente"
    | "rodando"
    | "ok"
    | "falhou"
    | "aguardando"
    | "ignorado";
  resumo: string | null;
  ms: number | null;
}
```

`resumo` é sempre derivado no servidor. Nunca pedir ao Codex um resumo exclusivo para a interface.

Exemplos:

- identificar: `Nescau 2.0 achocolatado 380g — EAN validado`;
- precificar live: `R$ 12,90 · 3 referências · item exato`;
- precificar local: `R$ 8–15 · tabela local · faixa da categoria`;
- redigir: `Título com 54 caracteres, 6 tags`;
- redigir por fallback: `Texto gerado por template local`;
- exceção: `Categoria desconhecida — revisão necessária`.

### 7.3 Job

```ts
type ModoExecucao = "live" | "local" | "fixture";

type MotivoExcecao =
  | "categoria_desconhecida"
  | "confianca_baixa"
  | "falha_catalogacao"
  | null;

interface Job {
  id: string;
  criado_em: string;
  status: "processando" | "aguardando" | "publicado" | "excecao";
  modo_execucao: ModoExecucao;
  imagem_url: string;
  passos: [Passo, Passo, Passo, Passo];
  produto: CatalogadorOut | null;
  preco: PrecificadorOut | null;
  anuncio: RedatorOut | null;
  motivo_excecao: MotivoExcecao;
  revisao: {
    necessaria: boolean;
    concluida_em: string | null;
  };
  publicado: {
    anuncio: RedatorOut;
    campos_editados: Array<keyof RedatorOut>;
  } | null;
}
```

Campos internos como bytes, MIME, estado da fila e handles de processo não pertencem ao DTO.

## 8. Structured outputs do Codex

Os três schemas devem usar modo estrito:

- todos os campos em `required`;
- campos desconhecidos representados por `null`;
- `additionalProperties: false` em todo objeto, inclusive aninhados;
- resposta analisada e validada novamente no servidor;
- parse ou validação inválidos contam como falha da etapa.

### 8.1 CatalogadorOut

```ts
interface CatalogadorOut {
  ean: string | null;
  marca: string | null;
  produto: string | null;
  modelo: string | null;
  variante: string | null;
  quantidade: string | null;
  categoria: Categoria | null;
  texto_lido: string[];
  base_identificacao: "ean" | "texto_embalagem" | "aparencia";
  confianca: "alta" | "media" | "baixa";
  passadas: 1 | 2;
}
```

O núcleo implementa somente uma passada e retorna `passadas: 1`. O tipo preserva `2` para não reabrir o contrato se a passada adicional for retomada depois da hackathon.

Após validar o schema, o servidor valida o dígito verificador EAN-13. EAN inválido vira `null`, e `base_identificacao` é recalculada a partir da melhor evidência restante.

### 8.2 PrecificadorOut

```ts
interface PrecificadorOut {
  estrategia: "ean" | "marca_modelo" | "descritiva" | "tabela_local";
  precisao: "item_exato" | "equivalente" | "faixa_categoria";
  degradado: boolean;
  consulta: string;
  referencias: Array<{ fonte: string; preco: number }>;
  preco_min: number;
  preco_max: number;
  preco_sugerido: number;
  justificativa: string;
  confianca: "alta" | "media" | "baixa";
}
```

### 8.3 RedatorOut

```ts
interface RedatorOut {
  titulo: string;
  descricao: string;
  tags: string[];
  categoria_loja: Categoria;
  preco: number;
}
```

Validações determinísticas adicionais:

- `titulo`: 1–60 caracteres;
- `descricao`: não vazia;
- `tags`: 3–8 itens não vazios;
- `preco`: positivo e finito.

## 9. Máquina de estados

### 9.1 Criação

1. Criar Job `processando`.
2. Criar os quatro Passos em `pendente`.
3. Copiar o modo global para `modo_execucao`.
4. Enfileirar o Job.
5. Responder `202`.

### 9.2 Catalogação

1. `identificar → rodando`.
2. Copiar a imagem para arquivo temporário.
3. Executar Catalogador Codex com timeout total de 20 segundos.
4. Validar JSON e EAN.
5. Derivar o resumo.

Falha de processo, timeout, JSON inválido ou schema inválido:

- Job `excecao`;
- `motivo_excecao = "falha_catalogacao"`;
- identificar `falhou`;
- precificar e redigir `ignorado`;
- publicar `aguardando`.

Saída válida passa pela regra determinística, nesta precedência:

```ts
const motivo_excecao =
  produto.categoria === null
    ? "categoria_desconhecida"
    : produto.confianca === "baixa"
      ? "confianca_baixa"
      : null;
```

Se houver motivo, preservar a Identificação como evidência e seguir para Exceção. Caso contrário, identificar `ok` e avançar.

### 9.3 Precificação

1. `precificar → rodando`.
2. Escolher uma única consulta pela melhor evidência disponível.
3. Em `live`, executar uma tentativa Codex com busca e timeout duro de 8 segundos.
4. Em `local`, ou após qualquer falha live, usar a tabela local.
5. Validar e derivar o resumo.
6. `precificar → ok`, inclusive quando degradado.

Os degraus escolhem a consulta; não executam várias buscas sequenciais:

```text
EAN válido             → busca exata por EAN       → item_exato
marca + produto/modelo → busca por nome            → equivalente
categoria + atributos  → busca descritiva          → faixa_categoria
busca falhou/timeout   → tabela local               → faixa_categoria
```

Nunca buscar pela aparência física. A consulta descritiva usa prateleira e atributos: `shampoo 400ml preço`, não `frasco branco`.

### 9.4 Redação

1. `redigir → rodando`.
2. Executar Redator Codex com timeout total de 15 segundos.
3. Validar o resultado.
4. Se falhar, gerar `RedatorOut` por template TypeScript determinístico.
5. Derivar o resumo e marcar `redigir → ok`.
6. Job `aguardando`; publicar `aguardando`.

O template local combina somente campos existentes na Identificação, categoria e preço. Não inventa benefícios, origem, validade ou garantia.

### 9.5 Revisão e publicação

Job `aguardando` mostra `Publicar anúncio`.

Job `excecao` mostra `Revisar para publicar`, nunca o botão normal. O formulário exige todos os campos de `RedatorOut`; a Identificação permanece visível e imutável como evidência.

Publicar uma Exceção válida e concluir sua Revisão humana são a mesma transição atômica. Depois da publicação:

- Job `publicado`;
- publicar `ok`;
- `revisao.concluida_em` preenchido somente quando `necessaria`;
- `publicado.anuncio` contém o objeto efetivamente enviado;
- `/loja` passa a exibi-lo.

## 10. Fallback de preço

A tabela contém uma linha por categoria, cada uma com mínimo, máximo e sugestão. Os valores são dados de demonstração e devem ser claramente marcados como estimativa local.

```ts
type FaixaLocal = {
  minimo: number;
  maximo: number;
  sugerido: number;
};

const FAIXAS_LOCAIS: Record<Categoria, FaixaLocal> = {
  alimento:    { minimo: 5,  maximo: 30,  sugerido: 14.9 },
  bebida:      { minimo: 4,  maximo: 25,  sugerido: 9.9 },
  limpeza:     { minimo: 8,  maximo: 40,  sugerido: 19.9 },
  higiene:     { minimo: 8,  maximo: 50,  sugerido: 19.9 },
  eletronico:  { minimo: 30, maximo: 500, sugerido: 99.9 },
  papelaria:   { minimo: 3,  maximo: 50,  sugerido: 9.9 },
  utilidade:   { minimo: 10, maximo: 100, sugerido: 29.9 },
  outro:       { minimo: 10, maximo: 100, sugerido: 29.9 },
};
```

Para uma faixa produzida ao vivo, escolher o valor terminado em `,90` mais próximo do ponto médio somente se ele permanecer dentro de `[preco_min, preco_max]`. Caso contrário, usar o ponto médio com duas casas.

Quando `degradado === true`, o painel mostra faixa e sugestão, nunca apenas um número com aparência de precisão exata.

## 11. Prompts

Todos começam com estas restrições:

```text
Não execute comandos, não altere arquivos e não peça confirmação.
Trabalhe apenas com a entrada fornecida e as ferramentas explicitamente habilitadas.
Retorne somente o objeto exigido pelo JSON Schema.
```

### Catalogador

```text
Você recebe a foto de um produto NOVO à venda no varejo.
Sua tarefa é LER, não adivinhar.

1. Procure EAN-13. Retorne os dígitos somente se estiver confiante.
2. Leia marca, produto, modelo, variante, volume, peso e quantidade.
3. Registre em texto_lido todos os trechos brutos legíveis, inclusive parciais.
4. base_identificacao representa a melhor evidência: ean, texto_embalagem
   ou aparencia.
5. Use confianca baixa quando não tiver certeza nem da categoria.

Nunca invente marca, produto, modelo ou EAN. Campo não lido é null.
Retorne passadas = 1.
```

### Precificador

```text
Determine o preço de varejo brasileiro para a Identificação recebida.
Use a busca web disponível uma única vez, com a melhor consulta possível:
- EAN válido → código;
- marca + produto/modelo → nome;
- somente categoria → categoria e atributos úteis.

Nunca pesquise pela aparência física.
Marque degradado sempre que precisao não for item_exato.
Justifique em uma frase, em português, de onde veio o valor.
```

### Redator

```text
Escreva um anúncio factual para marketplace brasileiro.

titulo: até 60 caracteres, começando por marca e produto quando existirem,
com volume ou quantidade. Sem emoji e sem caixa alta.
descricao: 2 a 4 frases, usando somente a Identificação recebida.
tags: 3 a 8 termos de busca reais.

Não invente benefício, validade, origem ou garantia.
```

## 12. Interface

O build combina as variações validadas no protótipo visual, sem reutilizar
diretamente seu código descartável:

- `/captura`: variação A — conversa direta;
- `/painel`: variação C — esteira do agente;
- `/loja`: variação B.

### `/captura`

- Um controle grande de câmera/arquivo.
- Preview local.
- Botão `Enviar`.
- Depois do `202`: `Enviado`.
- Nenhum status do pipeline e nenhuma edição.

Erros:

- tipo inválido: `Use uma imagem JPEG ou PNG.`;
- tamanho: `A imagem deve ter no máximo 10 MB.`;
- upload: `Não consegui enviar. Verifique a conexão e tente novamente.`.

### `/painel`

- Grid de cards legível a cinco metros.
- Estado vazio: `Nenhuma foto ainda. Envie pelo celular.`
- Cada card renderiza diretamente o array `passos`.
- Passos `pendente` aparecem apagados; `rodando`, ativos; `ok`, verdes; `falhou`, cinza/vermelho; `ignorado`, cinza; `aguardando`, pulsante.
- Resultado degradado mostra faixa, sugestão e origem local.
- Exceção permanece visível com motivo concreto.
- Badge pequeno mostra `LIVE`, `LOCAL` ou `FIXTURE`.

Botões:

- Job normal: `Publicar anúncio`;
- Exceção: `Revisar para publicar`;
- resultado: `Publicado`.

### Revisão de Exceção

Formulário mínimo com os cinco campos de `RedatorOut`. Todos são obrigatórios. Não permitir editar a Identificação.

A revisão existe no produto, mas não é preenchida durante os três minutos principais. No palco, basta mostrar a entrada na fila: `O Codex não teve confiança e exigiu revisão.`

### `/loja`

Vitrine mínima somente com Jobs publicados: imagem, título, preço, descrição e tags. Nenhum carrinho, filtro ou detalhe de produto.

## 13. Fixtures

Versionar cinco JPEG/PNG e suas saídas completas:

1. EAN válido → `item_exato`;
2. marca e produto sem EAN → `equivalente`;
3. categoria e quantidade → `faixa_categoria`;
4. caixa lisa → Exceção;
5. segundo produto normal → demonstra concorrência.

O atalho `5` cria cinco Jobs `fixture`. Eles percorrem os mesmos estados e contratos, com delays definidos nos dados. Não mapear por hash nem tentar reconhecer upload real em modo fixture.

## 14. Ordem de build

### 0:00–0:15 — Scaffold e smoke Codex

- Criar Next.js com TypeScript.
- Implementar a interface mínima `CodexRuntime` e o adapter `LocalCodexSdkRuntime`.
- Validar três capacidades: JSON Schema, imagem JPEG/PNG e busca web.
- Confirmar modelo `gpt-5.4-mini`, autenticação, streaming, cancelamento e opções de sandbox.

Se imagem ou schema não funcionar em 15 minutos, o modo live deixa de ser caminho crítico; seguir construindo com fixtures e retornar somente se houver folga.

### 0:15–0:50 — Esqueleto falso end-to-end

- `Map` singleton, fila e contratos.
- `/captura` envia.
- `/painel` recebe por polling e anima quatro Passos.
- Publicação idempotente.
- `/loja` mostra o resultado.

Ao minuto 50 já existe demo apresentável em `FIXTURE`.

### 0:50–1:25 — Catalogador Codex

- Arquivo temporário e limpeza.
- Schema e prompt.
- Timeout, parse e validação.
- EAN-13.
- Regra de Exceção.
- Testar três imagens diferentes.

### 1:25–1:50 — Preço local e Redator

- Tabela das oito categorias.
- Arredondamento seguro.
- Redator Codex.
- Template determinístico.
- Job chega a `aguardando`.

### 1:50–2:10 — Revisão de Exceção

- Formulário completo mínimo.
- Validação de `RedatorOut`.
- Publicação atômica e diff.

### 2:10–2:30 — Fila, modos e fixtures

- Concorrência 2.
- Snapshot do modo por Job.
- Teclas `M`, `5`, `R`.
- Cinco cenários versionados.

### 2:30–2:50 — Busca web, somente se o núcleo estiver verde

- Uma única busca Codex.
- Timeout de 8 segundos.
- Queda imediata para tabela local.

Se não estiver estável ao minuto 2:50, remover a busca do caminho do palco e usar `LOCAL`.

### 2:50–3:00 — Congelamento

- Testar notebook e celular no hotspot real.
- Iniciar Next.js acessível na LAN.
- Executar preflight Codex.
- Limpar Jobs e percorrer uma vez o roteiro.
- Corrigir somente bloqueadores.

Às 3:00, parar de desenvolver.

## 15. Ordem de corte

1. Busca web live.
2. Acabamento visual e responsividade do painel.
3. Upload real das cinco peças; usar as cinco fixtures.
4. Textos secundários e metadados não visíveis no palco.

Já estão cortados: segunda passada de visão, edição normal, histórico e limpeza de imagem.

Nunca cortar:

- ensaio de uma hora;
- captura → painel → publicação;
- Exceção visível;
- fallback local;
- transparência do modo;
- restrição Codex-only.

## 16. Roteiro de demonstração

O tempo final da automação deve ser medido no ensaio. Não afirmar “15 segundos” antes dessa medição.

| Momento | Ação |
|---|---|
| 0:00 | `Loja com 200 itens parados. Cada anúncio manual custa minutos.` |
| 0:20 | Fotografar um produto e largar o celular |
| processamento | Permanecer em silêncio enquanto o painel acende |
| conclusão | Confirmar e mostrar o item em `/loja` |
| sequência | Disparar as cinco fixtures e mostrar concorrência 2 |
| degradação | Mostrar categoria sem item exato e a faixa de preço |
| segurança | Mostrar caixa lisa entrando em Revisão humana |
| fechamento | Comparar o processo manual com o tempo live medido no ensaio |

Se o modo for `FIXTURE`, tratá-lo como replay de saídas previamente produzidas pelo Codex, não como execução live. O badge permanece visível.

## 17. Plano B e runbook

- Notebook e celular no mesmo hotspot.
- Servidor local acessível por IP da LAN.
- Cinco imagens e saídas Codex versionadas.
- Aplicação inicia em `FIXTURE` se o preflight falhar.
- `M` troca para `LOCAL` em segundos se apenas a busca estiver instável.
- `R` limpa o ensaio anterior.
- Um QR code ou URL curta abre `/captura` no celular.
- Não atualizar dependências, modelo, Codex SDK ou runtime Codex depois do ensaio final.

Checklist antes de subir ao palco:

- [ ] `codex --version` responde;
- [ ] `codex login status` autenticado;
- [ ] uma imagem real passa pelo Catalogador;
- [ ] o hotspot abre `/captura` no aparelho físico;
- [ ] a publicação aparece em `/loja`;
- [ ] as cinco fixtures funcionam;
- [ ] a caixa lisa vira Exceção;
- [ ] `M` e `R` funcionam;
- [ ] o tempo live foi anotado;
- [ ] roteiro ensaiado em voz alta.

## 18. Riscos aceitos

| Risco | Consequência | Mitigação da demo |
|---|---|---|
| Codex SDK controla um runtime local | Não há deploy serverless | Rodar somente no notebook nesta demo |
| Login local expira | Runtime live indisponível | Preflight e `FIXTURE` |
| Três processos aumentam latência | Tempo não cabe em 15 s | Medir, não prometer; fixtures para lote |
| Busca demora ou retorna lixo | Preço instável | Uma tentativa de 8 s e tabela local |
| Visão erra texto pequeno | Identificação insegura | EAN checksum, Exceção e fotos ensaiadas |
| Processo reinicia | Jobs desaparecem | Aceito; limpar e preparar antes do palco |
| Cinco Jobs saturam o notebook | Cards lentos | Fila FIFO com concorrência 2 |

## 19. Evidência mínima de verificação

Testes determinísticos prioritários:

- checksum EAN-13 válido e inválido;
- regra e precedência de `motivo_excecao`;
- preço `,90` permanece dentro da faixa;
- fallback local produz `PrecificadorOut` válido;
- template produz `RedatorOut` válido;
- publicação rejeita `processando`;
- publicação de `publicado` é idempotente;
- Exceção não mostra botão normal;
- mudança de modo não altera Job existente;
- contrato de `CodexRuntime` com Adapter determinístico, observando somente estados do Job.

Smoke tests manuais prioritários:

- JPEG e PNG reais;
- limite e MIME de upload;
- polling sem bytes de imagem;
- arquivo temporário removido após Catalogador;
- cancelamento da execução no timeout;
- contrato real de `LocalCodexSdkRuntime` para schema, imagem, streaming, cancelamento e busca `live`;
- fluxo completo no aparelho e hotspot do palco.

## 20. Referências oficiais

- [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk)
- [Entradas de imagem no Codex](https://learn.chatgpt.com/docs/image-inputs?surface=cli)
- [Web search no Codex](https://learn.chatgpt.com/docs/web-search?surface=cli)
- [Configuração, sandbox e permissões do Codex](https://learn.chatgpt.com/docs/config-file/config-basic)

As decisões de domínio e arquitetura relacionadas estão em [`CONTEXT.md`](../../CONTEXT.md), [`ADR 0001`](../adr/0001-degradar-falhas-tecnicas-e-revisar-identificacao-insegura.md) e [`ADR 0003`](../adr/0003-integrar-codex-pelo-sdk-atras-de-contrato-proprio.md). O spike preservado em `spike/codex-sdk`, commit `a153d00`, é a fonte primária da integração local validada e não deve ser mesclado diretamente.
