# Diagnóstico dos limites das etapas LIVE

Em 19 de agosto de 2026, o primeiro probe do Catalogador real terminou em
`7.862 ms`, abaixo do limite de `20.000 ms`; sua imagem mínima não produziu uma
Identificação segura e por isso não serve como confirmação do caminho LIVE.
Duas execuções com uma imagem representativa
LIVE completas com a mesma imagem de diagnóstico concluíram o Catalogador em
`8.139 ms` e `10.490 ms`. Esses dados não sustentam alterar seu limite atual.

Nas mesmas execuções, o Precificador foi cancelado em `8.017 ms` e `8.013 ms`,
imediatamente após seu limite anterior de `8.000 ms`; o fallback de tabela local
foi aplicado nas duas vezes. Com um limite experimental de `20.000 ms`, ele
concluiu em `19.752 ms`, margem pequena demais para um default prático. Para
permitir a verificação de um caminho LIVE sem retry, o default do Precificador
passa a `30.000 ms`. O Redator permanece em `15.000 ms`: concluiu em `7.473 ms`,
`7.915 ms` e `9.406 ms`.

Essas medidas descrevem somente o ambiente e a entrada de diagnóstico usados.
A Trilha de auditoria continuará registrando duração, timeout e fallback para
que uma política futura seja decidida com mais evidência.

Uma execução final em processo limpo, com os defaults escolhidos, concluiu o
Catalogador em `8.313 ms`, o Precificador em `26.350 ms` e o Redator em
`13.073 ms`. O Job chegou a `aguardando` sem fallback e a API expôs os sete
registros de criação, início e conclusão em ordem causal.

O harness exige uma foto representativa sem incorporá-la ao repositório e só
termina com sucesso quando a Identificação possui categoria e confiança não baixa:

```bash
CATALOGADOR_IMAGE_PATH=/caminho/produto.png npm run diagnose:catalogador
```

`CATALOGADOR_TIMEOUT_MS` permite testar outro deadline somente no harness.
