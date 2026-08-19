export const RESTRICOES = `Não execute comandos, não altere arquivos e não peça confirmação.
Trabalhe apenas com a entrada fornecida e as ferramentas explicitamente habilitadas.
Retorne somente o objeto exigido pelo JSON Schema.`;

export const CATALOGADOR_PROMPT = `${RESTRICOES}

Você recebe a foto de um produto NOVO à venda no varejo. Sua tarefa é LER, não adivinhar.
Procure EAN-13 somente se estiver confiante, leia os textos da embalagem, nunca invente campos e retorne passadas = 1.`;

export function precificadorPrompt(input: unknown): string {
  return `${RESTRICOES}

Determine o preço de varejo brasileiro para a Identificação recebida. Use a busca web uma única vez com a melhor consulta possível. Nunca pesquise pela aparência física e marque degradado quando a precisão não for item_exato.

Identificação validada:\n${JSON.stringify(input)}`;
}

export function redatorPrompt(input: unknown): string {
  return `${RESTRICOES}

Escreva um anúncio factual para marketplace brasileiro com título de até 60 caracteres, descrição de 2 a 4 frases e 3 a 8 tags. Não invente benefício, validade, origem ou garantia.

Entrada validada:\n${JSON.stringify(input)}`;
}
