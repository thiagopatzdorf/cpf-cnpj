// Contrato do lado JS: js/cpf.mjs e js/cnpj.mjs batem `valido` e `motivo` de vetores.json,
// e as funções de copiar (funcoes/valida.js) batem `valido`. Roda com: node --test packages/cpf-cnpj/tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as cpf from "../js/cpf.mjs";
import * as cnpj from "../js/cnpj.mjs";

const pacote = new URL("../", import.meta.url);
const vetores = JSON.parse(readFileSync(new URL("vetores.json", pacote), "utf8"));
const regras = JSON.parse(readFileSync(new URL("regras.json", pacote), "utf8"));
const copiar = new Function(`${readFileSync(new URL("funcoes/valida.js", pacote), "utf8")}; return { validaCPF, validaCNPJ };`)();

for (const [doc, completo, deCopiar] of [["cpf", cpf.validar, copiar.validaCPF], ["cnpj", cnpj.validar, copiar.validaCNPJ]]) {
  test(`${doc}: biblioteca diverge de vetores.json`, () => {
    for (const v of vetores[doc]) {
      const r = completo(v.entrada);
      assert.deepEqual([r.valido, r.motivo], [v.valido, v.motivo], `${JSON.stringify(v.entrada)} (${v.nota})`);
    }
  });
  test(`${doc}: função de copiar diverge de vetores.json`, () => {
    for (const v of vetores[doc]) assert.equal(deCopiar(v.entrada), v.valido, `${JSON.stringify(v.entrada)} (${v.nota})`);
  });
}

test("regras.json diferente do código JS", () => {
  assert.equal(regras.cnpj.caracteres_base, cnpj.CARACTERES);
  assert.deepEqual(Object.fromEntries(Object.entries(cpf.REGIOES).map(([k, v]) => [k, [...v]])), regras.cpf.regiao_fiscal);
  assert.equal(cnpj.validar(regras.cnpj.exemplo_oficial).valido, true);
});
