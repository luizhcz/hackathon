# Foto vira anúncio

Uma demo em que a foto de um produto novo é transformada em anúncio com o mínimo de intervenção humana, preservando uma saída segura quando a identificação não é confiável.

## Language

**Job**:
A unidade de trabalho criada a partir de uma foto e acompanhada até a publicação ou revisão humana.
_Avoid_: Tarefa, processamento

**Identificação**:
A evidência estruturada extraída da foto sobre o produto, preservada mesmo quando é incompleta ou leva a uma Exceção.
_Avoid_: Anúncio, cadastro final

**Anúncio**:
O conjunto completo de título, descrição, tags, categoria e preço que pode ser publicado na vitrine.
_Avoid_: Identificação, produto

**Fluxo principal**:
O caminho de um Job que exige participação humana somente no envio da foto e na confirmação da publicação. Uma edição opcional durante a confirmação pertence ao mesmo ponto de participação.
_Avoid_: Fluxo automático, caminho feliz

**Resultado degradado**:
Um resultado ainda publicável, produzido com menor precisão após faltar evidência ou uma dependência falhar. Degradação reduz a precisão declarada, mas não exige revisão humana por si só.
_Avoid_: Erro, exceção

**Exceção**:
Um Job cuja Identificação tem confiança baixa, categoria desconhecida ou não pôde ser produzida por falha do Catalogador. Ele interrompe as etapas automáticas restantes e não pode seguir diretamente para publicação.
_Avoid_: Falha técnica, resultado degradado

**Fila de revisão humana**:
O conjunto de Exceções que aguardam revisão completa antes de poderem ser publicadas.
_Avoid_: Fila de erros, descarte

**Revisão humana**:
O preenchimento e a validação manual de todos os campos do Anúncio necessários para transformar uma Exceção em um item publicável, sem alterar a Identificação preservada como evidência.
_Avoid_: Confirmação da publicação, correção automática

**Confirmação da publicação**:
O ponto de participação humana em que o anúncio é aceito e pode, opcionalmente, ser editado antes da publicação.
_Avoid_: Aprovação automática
