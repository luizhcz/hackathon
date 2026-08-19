# Trilha de auditoria durável para Jobs Codex

## Problem Statement

Durante uma execução `LIVE`, um Job permaneceu no Catalogador por `20.020 ms`, atingiu o timeout e tornou-se Exceção. O painel mostrou apenas `Falha na identificação — revisão necessária`; a causa normalizada, a configuração efetiva, a thread, as atividades anteriores, as validações e a decisão que levou ao resultado não foram preservadas. O processador descartava o erro e o Adapter descartava eventos normalizados, enquanto `GET /api/jobs/:id/audit` não existia.

Isso impede o usuário de compreender por que o sistema recusou uma Identificação e impede o desenvolvedor de distinguir timeout, saída inválida, política de segurança, falha de autenticação ou outra causa. Sem histórico durável, também não há evidência para decidir de forma responsável se prompts, schemas, timeout, retry ou regras determinísticas devem mudar. Como o frontend definitivo ainda não existe, a solução precisa ser um contrato de backend independente e reutilizável, acompanhado apenas por um visualizador diagnóstico no painel atual.

## Solution

Persistir cada Job e sua Trilha de auditoria no mesmo armazenamento SQLite transacional. Toda criação, transição, decisão, fallback e ação humana produzirá um Registro de auditoria atômico com o estado correspondente. O runtime Codex emitirá atividades normalizadas por um observer interno; tipos e eventos brutos do SDK continuarão confinados ao Adapter.

Cada perfil Codex devolverá o resultado de domínio separado de uma Explicação do agente estruturada em conclusão, evidências e incertezas. A Trilha de auditoria produzirá uma Projeção de auditoria segura para usuário e outra técnica para desenvolvedor, consumidas por um endpoint cursor-based com schema versionado. A projeção técnica exigirá um bearer token configurado. O painel atual receberá uma timeline expansível para validar visualmente esse contrato, sem se tornar a interface definitiva.

## User Stories

1. Como usuário, quero ver quando cada etapa começou, para entender onde o Job está trabalhando.
2. Como usuário, quero ver quando cada etapa terminou, para acompanhar o progresso real.
3. Como usuário, quero saber quando uma etapa foi ignorada, para compreender a consequência de uma Exceção.
4. Como usuário, quero receber uma explicação específica para um timeout, para não confundi-lo com incapacidade de reconhecer o produto.
5. Como usuário, quero ver a conclusão do Catalogador, para entender qual Identificação ele produziu.
6. Como usuário, quero ver as evidências usadas pelo Catalogador, para conferir se vieram da embalagem.
7. Como usuário, quero ver as incertezas declaradas pelo Catalogador, para compreender uma confiança baixa.
8. Como usuário, quero ver por que uma categoria foi considerada desconhecida, para orientar a Revisão humana.
9. Como usuário, quero saber quando um EAN foi rejeitado pela validação determinística, para não confiar num código inválido.
10. Como usuário, quero ver a consulta usada pelo Precificador, para compreender a origem do preço.
11. Como usuário, quero saber se o preço veio de busca live ou tabela local, para interpretar sua precisão.
12. Como usuário, quero ver por que um Resultado degradado foi aplicado, para não confundi-lo com resultado exato.
13. Como usuário, quero ver a explicação do Redator, para entender como o texto se limita às evidências disponíveis.
14. Como usuário, quero saber quando o template local substituiu o Redator, para reconhecer o fallback.
15. Como usuário, quero ver por que o Job entrou em Exceção, para decidir como revisá-lo.
16. Como usuário, quero ver quando a Revisão humana foi concluída, para distinguir automação de intervenção humana.
17. Como usuário, quero ver quais campos do Anúncio foram editados na confirmação, para conhecer o resultado efetivamente publicado.
18. Como usuário, quero ver quando o Anúncio foi publicado, para encerrar a história do Job.
19. Como usuário, quero uma timeline ordenada, para acompanhar causa e consequência sem interpretar logs técnicos.
20. Como usuário, quero que a timeline atualize enquanto o Job trabalha, para observar o Fluxo principal em andamento.
21. Como desenvolvedor, quero correlacionar cada Execução do agente com Job, etapa, tentativa e thread, para investigar uma execução específica.
22. Como desenvolvedor, quero ver modelo, versão do SDK e configuração efetiva, para reproduzir o comportamento.
23. Como desenvolvedor, quero ver os identificadores e versões de prompt e schema, para relacionar resultados a mudanças controladas.
24. Como desenvolvedor, quero ver timeout configurado e duração observada, para distinguir lentidão de cancelamento.
25. Como desenvolvedor, quero ver uso de tokens, para avaliar custo e contexto das execuções.
26. Como desenvolvedor, quero ver Resumos de raciocínio públicos emitidos pelo SDK, para obter detalhe suplementar sem acessar raciocínio privado.
27. Como desenvolvedor, quero ver buscas web normalizadas, para conferir a consulta do Precificador.
28. Como desenvolvedor, quero ver falhas normalizadas com código e causa sanitizada, para localizar o ponto responsável.
29. Como desenvolvedor, quero ver parse e validação separadamente, para distinguir JSON inválido de schema incompatível.
30. Como desenvolvedor, quero ver snapshots validados e limitados de entrada e saída, para reproduzir decisões sem armazenar payloads irrestritos.
31. Como desenvolvedor, quero copiar a resposta JSON da auditoria, para comparar execuções e anexar evidência a decisões futuras.
32. Como desenvolvedor, quero buscar somente registros posteriores a uma sequência, para inspecionar Jobs ativos sem reler todo o histórico.
33. Como desenvolvedor, quero que o incidente original permaneça documentado como fato, para não perder a motivação da mudança.
34. Como desenvolvedor, quero evitar reconstrução fictícia do incidente antigo, para preservar a integridade da auditoria.
35. Como operador, quero que Jobs e trilhas sobrevivam a reinícios, para não perder evidência durante uma falha.
36. Como operador, quero que estado e auditoria sejam gravados atomicamente, para impedir divergência entre o que aconteceu e o que foi registrado.
37. Como operador, quero que uma Falha de auditoria interrompa processamento não auditado, para preservar a confiabilidade do sistema.
38. Como operador, quero uma mensagem mínima em stderr quando a persistência falhar, para localizar a indisponibilidade sem vazar dados.
39. Como operador, quero registros operacionais JSON limitados, para correlacionar atividade do processo com a fonte de verdade.
40. Como operador, quero que o reset arquive Jobs em vez de apagar evidência, para preparar outra demonstração com segurança.
41. Como operador, quero retenção configurável de 30 dias, para equilibrar investigação e minimização de dados.
42. Como operador, quero que Jobs ativos e aguardando revisão não expirem automaticamente, para não perder trabalho pendente.
43. Como operador autorizado, quero expurgar dados explicitamente, para cumprir necessidades operacionais ou de privacidade.
44. Como responsável por segurança, quero impedir armazenamento de credenciais, variáveis de ambiente e tokens, para evitar vazamento pela auditoria.
45. Como responsável por segurança, quero excluir bytes de imagem da trilha, para limitar dados pessoais e volume.
46. Como responsável por segurança, quero excluir prompts completos e payloads brutos do SDK, para manter o contrato limitado e sanitizado.
47. Como responsável por segurança, quero impedir exposição de chain-of-thought, para manter somente explicações públicas e observáveis.
48. Como responsável por segurança, quero que comandos, mutações de arquivo ou MCP inesperados falhem a etapa, para aplicar a política do perfil.
49. Como responsável por segurança, quero que a projeção técnica exija bearer token, para não expor diagnósticos na rede local.
50. Como responsável por segurança, quero que o token permaneça apenas na memória do navegador, para não persistir segredo no frontend diagnóstico.
51. Como mantenedor, quero tipos de evento fechados e versionados, para evoluir o contrato de forma aditiva.
52. Como mantenedor, quero payloads tipados e limitados, para impedir que a auditoria vire um depósito de objetos arbitrários.
53. Como mantenedor, quero que tipos do Codex SDK permaneçam no Adapter, para trocar a implementação sem quebrar consumidores.
54. Como mantenedor, quero que somente o módulo transacional possa alterar Jobs, para tornar transições sem auditoria impossíveis por construção.
55. Como mantenedor, quero migrações versionadas, para atualizar o armazenamento de forma verificável.
56. Como mantenedor, quero um banco local sem serviço externo, para preservar a operação simples da demo.
57. Como desenvolvedor do frontend definitivo, quero um endpoint HTTP independente da interface atual, para construir outra experiência sem importar módulos internos.
58. Como desenvolvedor do frontend definitivo, quero Projeções de auditoria separadas por autorização, para renderizar apenas o detalhe permitido.
59. Como desenvolvedor do frontend definitivo, quero paginação por sequência, para consumir timelines grandes de forma incremental.
60. Como desenvolvedor do frontend definitivo, quero compatibilidade aditiva do schema, para atualizar o frontend sem quebra coordenada.
61. Como apresentador, quero visualizar a auditoria no painel atual, para demonstrar que o backend funciona antes do frontend definitivo.
62. Como apresentador, quero continuar usando as telas e atalhos existentes, para não quebrar o roteiro atual.
63. Como equipe, quero manter timeout e ausência de retry inalterados por enquanto, para decidir futuras políticas com evidência acumulada.
64. Como equipe, quero que fixtures, execuções LIVE e ações humanas produzam o mesmo contrato de auditoria, para comparar todos os modos.

## Implementation Decisions

- Uma Trilha de auditoria é um registro de domínio ligado ao Job, não um sinônimo de logs operacionais.
- O estado em memória será substituído por armazenamento SQLite local usando a capacidade nativa do Node.js atual, sem serviço externo.
- O banco padrão será configurável e ficará fora do controle de versão. Ele usará WAL, chaves estrangeiras e migrações versionadas.
- O Job, seus bytes de imagem operacionais e sua Trilha de auditoria serão persistidos. Bytes de imagem nunca farão parte de um Registro de auditoria.
- Um módulo profundo chamado `JobLedger` será a única interface autorizada a criar ou alterar Jobs. Ele esconderá transações, sequência de auditoria, persistência da imagem, arquivamento, retenção e sanitização.
- A interface do `JobLedger` oferecerá operações orientadas à intenção, não uma atualização genérica. Toda transição exigirá seu evento correspondente e será atômica.
- Se a criação da trilha falhar, o upload responderá indisponibilidade e nenhum Job será iniciado. Se uma gravação falhar durante processamento, novas ações serão interrompidas; uma transação compensatória tentará transformar o Job em Exceção. Se o armazenamento continuar indisponível, somente uma mensagem emergencial sanitizada será emitida.
- Na inicialização, Jobs interrompidos serão reconciliados sem retomar threads: Catalogador incompleto vira Exceção; Precificador ou Redator incompletos seguem as regras determinísticas de degradação existentes.
- Cada Registro de auditoria terá schema versionado, identificador, Job, sequência monotônica por Job, instante, tipo fechado, etapa opcional, execução opcional, tentativa, status e payload tipado.
- A versão 1 terá os tipos `job.created`, `job.archived`, `stage.started`, `stage.completed`, `stage.failed`, `stage.skipped`, `agent.configured`, `agent.started`, `agent.activity`, `agent.completed`, `validation.completed`, `decision.recorded`, `fallback.applied`, `job.transitioned`, `review.completed` e `publication.completed`.
- Cada tipo de evento possuirá payload específico. Não haverá payload público arbitrário. Textos, listas e snapshots terão limites explícitos; rejeição, sanitização e truncamento intencional serão observáveis.
- Cada perfil Codex devolverá um envelope que separa o resultado de domínio de uma `AgentExplanation` com conclusão, evidências e incertezas. Todos os campos serão obrigatórios; listas vazias serão permitidas e limitadas a dez itens.
- `CatalogadorOut`, `PrecificadorOut` e `RedatorOut` continuarão representando somente resultados de domínio. A Explicação do agente não será incorporada ao Anúncio publicado.
- `CodexRuntime` aceitará um observer normalizado. O Adapter converterá eventos do SDK em atividades estáveis e nunca permitirá que tipos brutos atravessem o seam.
- Atividades normalizadas incluirão início de thread, Resumo de raciocínio público, busca web, conclusão, uso e erro. Conteúdo será sanitizado e limitado antes de sair do Adapter.
- Comando, mutação de arquivo ou MCP fora da política do perfil produzirá violação auditável e encerrará a etapa. Apenas busca web do Precificador `LIVE` será uma atividade de ferramenta permitida.
- Cada Execução do agente terá `run_id`, tentativa, perfil, etapa, Job e thread quando conhecida. Futuros retries poderão reutilizar o contrato sem alterar eventos existentes.
- O timeout de Catalogador continuará em 20 segundos, Precificador em 8 segundos e Redator em 15 segundos. Esta entrega não adicionará retry nem aumentará limites.
- Timeout será distinguido de cancelamento e falha genérica. A projeção de usuário informará etapa, limite, cancelamento e consequência; a técnica acrescentará código, correlação, duração e causa sanitizada.
- A Trilha de auditoria será a fonte de verdade. Cada registro confirmado emitirá uma linha JSON operacional limitada a correlação, sequência, tipo, etapa, visibilidade e status.
- A Projeção de auditoria de usuário conterá explicações, evidências, decisões, fallbacks, estados e consequências em linguagem segura.
- A Projeção de auditoria técnica acrescentará configuração, versões, correlação, uso, atividades e snapshots validados sanitizados.
- A projeção técnica exigirá `Authorization: Bearer` com `AUDIT_DEVELOPER_TOKEN`, comparado de forma segura. Sem configuração, ela ficará indisponível. O token não terá padrão e não poderá aparecer em URL, HTML, logs ou armazenamento do navegador.
- O endpoint de auditoria aceitará Job, sequência posterior e audiência. A resposta conterá `schema_version`, `job_id`, registros ordenados, `next_sequence` e indicação de mais resultados. A audiência padrão será usuário.
- O contrato começará com polling cursor-based. SSE, WebSocket e streaming direto não serão adicionados sem requisito concreto.
- O painel atual ganhará uma timeline expansível por Job, atualizada incrementalmente, agrupada por etapa e Execução do agente. Ele mostrará usuário por padrão, aceitará token técnico somente em memória e permitirá visualizar ou copiar JSON.
- O visualizador atual será diagnóstico. A semântica pertence ao contrato HTTP; organização visual e componentes não serão tratados como frontend definitivo.
- O reset arquivará Jobs visíveis e registrará `job.archived`. Jobs arquivados deixarão a listagem operacional, mas sua auditoria continuará acessível por ID.
- Jobs terminais serão retidos por 30 dias por padrão, configurável. Limpeza ocorrerá na inicialização e a cada 24 horas. Jobs ativos ou aguardando revisão não expirarão automaticamente.
- Expurgo manual será uma operação separada e autenticada. Metadados de expurgo serão operacionais e externos à trilha removida.
- O incidente `cdde4` será mantido apenas como documento factual. Nenhum Registro de auditoria retroativo será fabricado.
- Fixtures, LIVE, LOCAL, Revisão humana e publicação usarão os mesmos tipos de evento e Projeções de auditoria.
- As rotas e DTOs existentes permanecerão compatíveis para o painel atual e para consumidores já existentes.

## Testing Decisions

- Bons testes observarão comportamento pelo seam mais alto possível: estado do Job, Projeção de auditoria e resposta HTTP. Eles não afirmarão tabelas SQL, chamadas internas, ordem de funções ou eventos brutos do SDK.
- O seam principal será o workflow completo do Job usando `JobLedger` com um banco SQLite temporário real e `CodexRuntime` determinístico. O teste observará estado e auditoria pela mesma interface usada pelo backend.
- O seam HTTP cobrirá paginação por sequência, ordenação, audiência padrão, autorização técnica, indisponibilidade sem token e DTO versionado.
- O único seam externo adicional será o smoke real de `LocalCodexSdkRuntime`, verificando que atividades normalizadas atravessam o observer sem expor tipos do SDK.
- O repro do incidente será transformado em teste rápido com timeout injetado. Ele exigirá mensagem explícita de timeout na projeção do usuário e código, limite, duração e causa sanitizada na projeção técnica.
- Um teste transacional causará falha de gravação e provará que estado e Registro de auditoria são ambos confirmados ou ambos revertidos.
- Um teste de reinício fechará e reabrirá o banco, provando que Job, imagem operacional e trilha permanecem acessíveis.
- Testes de reconciliação cobrirão Jobs interrompidos durante Catalogador, Precificador e Redator sem retomar threads.
- Testes de cursor cobrirão sequência monotônica, ausência de duplicação, páginas vazias e continuação durante processamento.
- Testes de projeção provarão que usuário não recebe thread, snapshots, configuração ou causas técnicas e que desenvolvedor recebe somente detalhe sanitizado autorizado.
- Testes de segurança cobrirão token ausente, incorreto e correto, além da proibição de token em query string.
- Testes de sanitização cobrirão credenciais, caminhos locais, variáveis de ambiente, prompts completos, payloads grandes e limites de listas/textos.
- Testes de política do runtime cobrirão busca web permitida no Precificador e comando, arquivo ou MCP inesperado encerrando a etapa.
- Testes de explicação validarão conclusão obrigatória, no máximo dez evidências, no máximo dez incertezas e separação do resultado de domínio.
- Testes de cobertura causal exigirão criação, etapas, validação, decisão, fallback, Exceção, Revisão humana, publicação e arquivamento nas trilhas correspondentes.
- Testes de retenção cobrirão expiração de Job terminal, preservação de Job ativo/revisão e expurgo autorizado.
- Testes do painel verificarão expansão da timeline, polling incremental, agrupamento, troca de projeção, token somente em memória e cópia de JSON.
- A suíte existente de Job, publicação e fila servirá como prior art e prova de compatibilidade. Nenhuma alteração de auditoria poderá mudar os resultados externos já cobertos.
- A verificação final incluirá typecheck, testes, build de produção, fluxo fixture por HTTP, smoke real do SDK e inspeção visual do painel diagnóstico.

## Out of Scope

- Alterar timeout, adicionar retry ou criar política adaptativa para agentes.
- Reconstruir a Trilha de auditoria do incidente anterior.
- Expor chain-of-thought, raciocínio privado ou eventos brutos do Codex SDK.
- Persistir imagem, credenciais, prompts completos ou payloads irrestritos dentro da Trilha de auditoria.
- Projetar o frontend definitivo ou tratar o visualizador diagnóstico como design final.
- Adicionar SSE, WebSocket ou streaming de eventos diretamente ao navegador.
- Adicionar PostgreSQL, serviço de banco externo, replicação ou operação multi-instância.
- Implementar o sistema definitivo de usuários, autenticação e autorização.
- Criar dashboards analíticos, agregações históricas, comparação automática de prompts ou recomendação automática de políticas.
- Mudar o Adapter Codex local ou implementar um Adapter remoto.
- Exportações adicionais como CSV ou PDF; o contrato JSON é a exportação inicial.
- Guardar saída de comandos, argumentos MCP, bytes de imagem ou resposta bruta irrestrita.

## Further Notes

- O incidente que motivou a mudança está documentado separadamente e contém somente fatos observados.
- ADR-0004 registra a decisão de manter auditoria normalizada, obrigatória, transacional e durável.
- A Trilha de auditoria deve permitir decisões futuras sobre timeout, retry, prompt e schema; ela não deve tomar essas decisões automaticamente.
- O frontend definitivo deve depender somente do contrato HTTP versionado, nunca de SQLite, `JobLedger`, `CodexRuntime` ou eventos do SDK.
- O trabalho é grande o suficiente para ser dividido em tickets tracer-bullet após esta especificação.
