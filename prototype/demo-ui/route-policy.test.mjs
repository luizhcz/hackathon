import assert from "node:assert/strict";
import test from "node:test";

import { resolveRoute, searchForSurface } from "./route-policy.mjs";

test("cada superfície usa a composição visual aprovada", () => {
  assert.deepEqual(resolveRoute("?surface=captura&variant=C"), {
    surface: "captura",
    variant: "A",
  });
  assert.deepEqual(resolveRoute("?surface=painel&variant=A"), {
    surface: "painel",
    variant: "C",
  });
  assert.deepEqual(resolveRoute("?surface=loja&variant=C"), {
    surface: "loja",
    variant: "B",
  });
});

test("painel C é a entrada padrão e a navegação não carrega variante", () => {
  assert.deepEqual(resolveRoute(""), { surface: "painel", variant: "C" });
  assert.deepEqual(resolveRoute("?surface=desconhecida"), {
    surface: "painel",
    variant: "C",
  });
  assert.deepEqual(resolveRoute("?surface=toString"), {
    surface: "painel",
    variant: "C",
  });
  assert.equal(searchForSurface("captura"), "?surface=captura");
  assert.equal(searchForSurface("loja"), "?surface=loja");
  assert.equal(searchForSurface("toString"), "?surface=painel");
});
