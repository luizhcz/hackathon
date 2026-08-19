import { z } from "zod";

import { categorias } from "./types";

const categoriaSchema = z.enum(categorias);

export const catalogadorSchema = z
  .object({
    ean: z.string().nullable(),
    marca: z.string().nullable(),
    produto: z.string().nullable(),
    modelo: z.string().nullable(),
    variante: z.string().nullable(),
    quantidade: z.string().nullable(),
    categoria: categoriaSchema.nullable(),
    texto_lido: z.array(z.string()),
    base_identificacao: z.enum(["ean", "texto_embalagem", "aparencia"]),
    confianca: z.enum(["alta", "media", "baixa"]),
    passadas: z.union([z.literal(1), z.literal(2)]),
  })
  .strict();

const referenciaSchema = z
  .object({
    fonte: z.string().min(1),
    preco: z.number().finite().positive(),
  })
  .strict();

export const precificadorSchema = z
  .object({
    estrategia: z.enum(["ean", "marca_modelo", "descritiva", "tabela_local"]),
    precisao: z.enum(["item_exato", "equivalente", "faixa_categoria"]),
    degradado: z.boolean(),
    consulta: z.string(),
    referencias: z.array(referenciaSchema),
    preco_min: z.number().finite().positive(),
    preco_max: z.number().finite().positive(),
    preco_sugerido: z.number().finite().positive(),
    justificativa: z.string().min(1),
    confianca: z.enum(["alta", "media", "baixa"]),
  })
  .strict()
  .refine((value) => value.preco_min <= value.preco_sugerido && value.preco_sugerido <= value.preco_max, {
    message: "O preço sugerido deve permanecer dentro da faixa.",
  });

export const redatorSchema = z
  .object({
    titulo: z.string().trim().min(1).max(60),
    descricao: z.string().trim().min(1),
    tags: z.array(z.string().trim().min(1)).min(3).max(8),
    categoria_loja: categoriaSchema,
    preco: z.number().finite().positive(),
  })
  .strict();
