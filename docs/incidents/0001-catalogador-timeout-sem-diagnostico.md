# Catalogador excedeu o timeout sem diagnóstico observável

Em 19 de agosto de 2026, um Job `LIVE` identificado pelo prefixo `cdde4` permaneceu no Catalogador por `20.020 ms`, tornou-se Exceção com `motivo_excecao = "falha_catalogacao"` e exibiu apenas `Falha na identificação — revisão necessária`. O backend não possuía Trilha de auditoria nem endpoint correspondente: `GET /api/jobs/:id/audit` retornava `404`.

O tempo observado coincide com o limite configurado de 20 segundos, portanto o fato conhecido é que a execução atingiu o timeout e foi cancelada. O erro normalizado, a thread e as atividades anteriores não foram preservados porque o processador descartava a causa e o Adapter descartava eventos normalizados. Esses dados não serão reconstruídos ou inventados retroativamente.

O incidente motivou a adoção registrada na ADR-0004: estado do Job e auditoria transacionais e duráveis, explicações estruturadas, atividades normalizadas, projeções autorizadas e mensagem explícita para timeout. A política de timeout e retry permanecerá inalterada até que a nova trilha produza evidência suficiente para outra decisão.
