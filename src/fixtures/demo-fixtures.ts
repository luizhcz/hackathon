import type { CatalogadorOut, PrecificadorOut, RedatorOut } from "../domain/types";

export type DemoFixture = {
  id: string;
  label: string;
  image: { bytes: Uint8Array; mime: "image/png" };
  produto: CatalogadorOut;
  preco: PrecificadorOut | null;
  anuncio: RedatorOut | null;
  exception: "categoria_desconhecida" | "confianca_baixa" | null;
};

const PIXEL_PNG = Uint8Array.from(
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
);

function product(overrides: Partial<CatalogadorOut>): CatalogadorOut {
  return {
    ean: null,
    marca: null,
    produto: null,
    modelo: null,
    variante: null,
    quantidade: null,
    categoria: null,
    texto_lido: [],
    base_identificacao: "texto_embalagem",
    confianca: "media",
    passadas: 1,
    ...overrides,
  };
}

function localPrice(category: string, min: number, max: number, suggested: number): PrecificadorOut {
  return {
    estrategia: "tabela_local",
    precisao: "faixa_categoria",
    degradado: true,
    consulta: category,
    referencias: [],
    preco_min: min,
    preco_max: max,
    preco_sugerido: suggested,
    justificativa: "Estimativa da tabela local de demonstração.",
    confianca: "baixa",
  };
}

export const DEMO_FIXTURES: DemoFixture[] = [
  {
    id: "nescau-ean",
    label: "Nescau 2.0",
    image: { bytes: PIXEL_PNG, mime: "image/png" },
    produto: product({
      ean: "7891000053508",
      marca: "Nescau",
      produto: "Achocolatado em pó",
      variante: "2.0",
      quantidade: "380g",
      categoria: "alimento",
      texto_lido: ["Nescau 2.0", "380g"],
      base_identificacao: "ean",
      confianca: "alta",
    }),
    preco: {
      estrategia: "ean",
      precisao: "item_exato",
      degradado: false,
      consulta: "7891000053508",
      referencias: [
        { fonte: "Mercado A", preco: 12.49 },
        { fonte: "Mercado B", preco: 13.29 },
        { fonte: "Mercado C", preco: 12.89 },
      ],
      preco_min: 12.49,
      preco_max: 13.29,
      preco_sugerido: 12.9,
      justificativa: "Faixa observada para o EAN exato.",
      confianca: "alta",
    },
    anuncio: {
      titulo: "Nescau 2.0 Achocolatado em Pó 380g",
      descricao: "Achocolatado em pó Nescau 2.0 em embalagem de 380g. Item identificado pelo EAN da embalagem.",
      tags: ["nescau", "achocolatado", "chocolate", "380g"],
      categoria_loja: "alimento",
      preco: 12.9,
    },
    exception: null,
  },
  {
    id: "shampoo-texto",
    label: "Shampoo Seda",
    image: { bytes: PIXEL_PNG, mime: "image/png" },
    produto: product({
      marca: "Seda",
      produto: "Shampoo",
      variante: "Cachos Definidos",
      quantidade: "325ml",
      categoria: "higiene",
      texto_lido: ["Seda", "Cachos Definidos", "325ml"],
    }),
    preco: {
      estrategia: "marca_modelo",
      precisao: "equivalente",
      degradado: true,
      consulta: "Seda Shampoo Cachos Definidos 325ml",
      referencias: [{ fonte: "Farmácia A", preco: 14.99 }],
      preco_min: 13.9,
      preco_max: 17.9,
      preco_sugerido: 15.9,
      justificativa: "Faixa de itens equivalentes da mesma linha.",
      confianca: "media",
    },
    anuncio: {
      titulo: "Seda Shampoo Cachos Definidos 325ml",
      descricao: "Shampoo Seda da linha Cachos Definidos em frasco de 325ml. Informações transcritas da embalagem.",
      tags: ["seda", "shampoo", "cachos", "325ml"],
      categoria_loja: "higiene",
      preco: 15.9,
    },
    exception: null,
  },
  {
    id: "caderno-categoria",
    label: "Caderno 96 folhas",
    image: { bytes: PIXEL_PNG, mime: "image/png" },
    produto: product({
      produto: "Caderno espiral",
      quantidade: "96 folhas",
      categoria: "papelaria",
      texto_lido: ["96 folhas"],
    }),
    preco: localPrice("papelaria", 3, 50, 9.9),
    anuncio: {
      titulo: "Caderno Espiral 96 Folhas",
      descricao: "Caderno espiral com 96 folhas. Quantidade identificada na embalagem.",
      tags: ["caderno", "espiral", "96 folhas"],
      categoria_loja: "papelaria",
      preco: 9.9,
    },
    exception: null,
  },
  {
    id: "caixa-lisa",
    label: "Caixa sem identificação",
    image: { bytes: PIXEL_PNG, mime: "image/png" },
    produto: product({
      base_identificacao: "aparencia",
      confianca: "baixa",
    }),
    preco: null,
    anuncio: null,
    exception: "categoria_desconhecida",
  },
  {
    id: "detergente",
    label: "Detergente Ypê",
    image: { bytes: PIXEL_PNG, mime: "image/png" },
    produto: product({
      marca: "Ypê",
      produto: "Detergente líquido",
      variante: "Neutro",
      quantidade: "500ml",
      categoria: "limpeza",
      texto_lido: ["Ypê", "Neutro", "500ml"],
      confianca: "alta",
    }),
    preco: localPrice("limpeza", 8, 40, 19.9),
    anuncio: {
      titulo: "Ypê Detergente Líquido Neutro 500ml",
      descricao: "Detergente líquido Ypê, variante Neutro, em embalagem de 500ml. Informações lidas no rótulo.",
      tags: ["ypê", "detergente", "neutro", "500ml"],
      categoria_loja: "limpeza",
      preco: 19.9,
    },
    exception: null,
  },
];
