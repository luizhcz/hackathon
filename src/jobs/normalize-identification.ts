import type { CatalogadorOut } from "../domain/types";

function isValidEan13(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;
  const digits = [...value].map(Number);
  const sum = digits.slice(0, 12).reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === digits[12];
}

export function normalizeIdentification(produto: CatalogadorOut): CatalogadorOut {
  if (!produto.ean || isValidEan13(produto.ean)) return produto;

  const hasTextEvidence = produto.texto_lido.length > 0 || Boolean(produto.marca || produto.produto || produto.modelo);
  return {
    ...produto,
    ean: null,
    base_identificacao: hasTextEvidence ? "texto_embalagem" : "aparencia",
  };
}
