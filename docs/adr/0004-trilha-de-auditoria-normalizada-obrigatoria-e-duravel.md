---
status: accepted
---

# Manter uma trilha de auditoria normalizada, obrigatória e durável

Cada Job e sua Trilha de auditoria serão persistidos no mesmo armazenamento transacional: toda mudança de estado será atômica com seu Registro de auditoria, e falha ao iniciar ou acrescentar a trilha impedirá processamento não auditado. A trilha será durável, ordenada e imutável, com esquema versionado, correlação por Execução do agente e tentativa, configuração identificada, atividades normalizadas do runtime, Explicações do agente obrigatórias, Resumos de raciocínio suplementares, validações, regras determinísticas, fallbacks, transições e ações humanas; tipos e eventos brutos do Codex SDK, raciocínio privado, credenciais, imagem, prompts completos e payloads irrestritos não serão expostos nem persistidos.

A mesma fonte produzirá Projeções de auditoria segura para usuário e técnica para desenvolvedor. O frontend consumirá registros paginados por sequência por meio de um contrato HTTP estável e aditivo; a projeção técnica exigirá autorização, inclusive no desenvolvimento local. Jobs concluídos e suas trilhas terão retenção configurável de 30 dias por padrão e somente uma operação de expurgo explicitamente autorizada poderá removê-los. Aceitamos o custo de persistência, sanitização, controle de acesso e possível indisponibilidade em troca de explicabilidade confiável e de um contrato de backend reutilizável por qualquer frontend futuro.

O backend local usará SQLite e concentrará estado do Job e auditoria num único módulo transacional, substituível quando um ambiente hospedado exigir outro armazenamento. Atividades de runtime fora da política encerram a etapa, e a política atual de timeout e ausência de retry não será alterada sem evidência acumulada na própria trilha. O painel atual receberá somente um visualizador diagnóstico das duas projeções para validar o contrato; seu desenho não será tratado como interface definitiva do produto.

Cada perfil retornará o resultado de domínio separado de uma Explicação do agente estruturada em conclusão, evidências e incertezas. O contrato de auditoria versão 1 usará tipos de evento fechados e payloads limitados, paginação por sequência e correlação por Job, Execução do agente, tentativa e thread. A projeção técnica local exigirá `AUDIT_DEVELOPER_TOKEN`, mantido apenas em memória pelo visualizador; o banco padrão será `.data/foto-vira-anuncio.sqlite`, configurável, com migrações versionadas, WAL, chaves estrangeiras e retenção automática de 30 dias para Jobs terminais.
