import type { CatalogadorOut, Categoria, PrecificadorOut } from "../domain/types";

const FAIXAS_LOCAIS: Record<Categoria, { minimo: number; maximo: number; sugerido: number }> = {
  alimento: { minimo: 5, maximo: 30, sugerido: 14.9 },
  bebida: { minimo: 4, maximo: 25, sugerido: 9.9 },
  limpeza: { minimo: 8, maximo: 40, sugerido: 19.9 },
  higiene: { minimo: 8, maximo: 50, sugerido: 19.9 },
  eletronico: { minimo: 30, maximo: 500, sugerido: 99.9 },
  papelaria: { minimo: 3, maximo: 50, sugerido: 9.9 },
  utilidade: { minimo: 10, maximo: 100, sugerido: 29.9 },
  outro: { minimo: 10, maximo: 100, sugerido: 29.9 },
};

export function priceFromLocalTable(produto: CatalogadorOut): PrecificadorOut {
  const categoria = produto.categoria ?? "outro";
  const faixa = FAIXAS_LOCAIS[categoria];

  return {
    estrategia: "tabela_local",
    precisao: "faixa_categoria",
    degradado: true,
    consulta: categoria,
    referencias: [],
    preco_min: faixa.minimo,
    preco_max: faixa.maximo,
    preco_sugerido: faixa.sugerido,
    justificativa: "Estimativa da tabela local de demonstração.",
    confianca: "baixa",
  };
}
