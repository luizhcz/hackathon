export const categorias = [
  "alimento",
  "bebida",
  "limpeza",
  "higiene",
  "eletronico",
  "papelaria",
  "utilidade",
  "outro",
] as const;

export type Categoria = (typeof categorias)[number];
export type ModoExecucao = "live" | "local" | "fixture";
export type MotivoExcecao =
  | "categoria_desconhecida"
  | "confianca_baixa"
  | "falha_catalogacao"
  | null;

export type PassoId = "identificar" | "precificar" | "redigir" | "publicar";

export interface Passo {
  id: PassoId;
  rotulo: string;
  status: "pendente" | "rodando" | "ok" | "falhou" | "aguardando" | "ignorado";
  resumo: string | null;
  ms: number | null;
}

export interface CatalogadorOut {
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

export interface PrecificadorOut {
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

export interface RedatorOut {
  titulo: string;
  descricao: string;
  tags: string[];
  categoria_loja: Categoria;
  preco: number;
}

export interface Job {
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
