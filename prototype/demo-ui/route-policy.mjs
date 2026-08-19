const surfaceDefinitions = Object.freeze({
  captura: { label: "Captura", variant: "A" },
  painel: { label: "Painel", variant: "C" },
  loja: { label: "Loja", variant: "B" },
});

export const surfaces = Object.freeze(
  Object.fromEntries(
    Object.entries(surfaceDefinitions).map(([surface, definition]) => [surface, definition.label]),
  ),
);

function normalizeSurface(requestedSurface) {
  return Object.hasOwn(surfaceDefinitions, requestedSurface) ? requestedSurface : "painel";
}

export function resolveRoute(search) {
  const params = new URLSearchParams(search);
  const surface = normalizeSurface(params.get("surface"));

  return { surface, variant: surfaceDefinitions[surface].variant };
}

export function searchForSurface(requestedSurface) {
  const surface = normalizeSurface(requestedSurface);
  return `?surface=${surface}`;
}
