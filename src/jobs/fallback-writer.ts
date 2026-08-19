import { redatorSchema } from "../domain/schemas";
import type { CatalogadorOut, PrecificadorOut, RedatorOut } from "../domain/types";

export function writeFromTemplate(produto: CatalogadorOut, preco: PrecificadorOut): RedatorOut {
  if (!produto.categoria) throw new Error("Categoria é obrigatória para o template local.");

  const titleParts = [
    produto.marca,
    produto.produto,
    produto.modelo,
    produto.variante,
    produto.quantidade,
  ].filter((value): value is string => Boolean(value));
  const title = titleParts.join(" ").slice(0, 60).trim();
  const descriptionParts = [
    title || "Produto identificado",
    `categoria ${produto.categoria}`,
    produto.quantidade ? `quantidade ${produto.quantidade}` : null,
  ].filter((value): value is string => Boolean(value));
  const tags = Array.from(
    new Set([produto.marca, produto.produto, produto.categoria].filter((value): value is string => Boolean(value))),
  ).slice(0, 8);

  while (tags.length < 3) tags.push(`produto-${tags.length + 1}`);

  return redatorSchema.parse({
    titulo: title || `Produto ${produto.categoria}`,
    descricao: `${descriptionParts.join(", ")}.`,
    tags,
    categoria_loja: produto.categoria,
    preco: preco.preco_sugerido,
  });
}
