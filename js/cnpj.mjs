// CNPJ numérico e alfanumérico: gerar, validar e explicar. Sem DOM.
//
// Fonte única: packages/cpf-cnpj (regras.json + vetores.json). O site
// cpf.genesisinnovation.io usa uma cópia idêntica, conferida por teste.
//
// Regra oficial (Serpro/Receita Federal, "Cálculo dos dígitos verificadores
// de CNPJ alfanumérico", e IN RFB nº 2.229/2024; conferido em 2026-10-02):
//   - 14 posições: 8 da raiz + 4 da ordem (matriz/filial), alfanuméricas
//     (0-9 e A-Z maiúsculas), + 2 dígitos verificadores sempre numéricos.
//   - Cada caractere vale o seu código ASCII - 48: "0" = 0 ... "9" = 9,
//     "A" = 17 ... "Z" = 42. Para CNPJ só de números o valor é o próprio
//     dígito, então a mesma conta serve para os dois formatos.
//   - Pesos de 2 a 9 da direita para a esquerda, recomeçando depois do 9:
//     1º DV sobre 12 caracteres: 5 4 3 2 9 8 7 6 5 4 3 2;
//     2º DV sobre 13 (12 + 1º DV): 6 5 4 3 2 9 8 7 6 5 4 3 2.
//   - Resto da soma por 11: 0 ou 1 -> DV 0; senão DV = 11 - resto.
// Exemplo do manual: 12.ABC.345/01DE-35.

export const CARACTERES = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Valor do caractere na conta do DV: código ASCII - 48. */
export function valor(c) {
  return c.charCodeAt(0) - 48;
}

function pesos(n) {
  // da direita para a esquerda: 2, 3, ..., 9, 2, 3, ...
  return Array.from({ length: n }, (_, i) => 2 + ((n - 1 - i) % 8));
}

function dv(texto) {
  const p = pesos(texto.length);
  const termos = [...texto].map((c, i) => ({ caractere: c, valor: valor(c), peso: p[i], produto: valor(c) * p[i] }));
  const soma = termos.reduce((s, t) => s + t.produto, 0);
  const resto = soma % 11;
  return { termos, soma, resto, dv: resto < 2 ? 0 : 11 - resto };
}

const BASE = /^[0-9A-Z]{12}$/;

/** Os dois DVs de uma base de 12 caracteres ("12ABC34501DE" -> "35"). */
export function calcularDV(base12) {
  if (!BASE.test(base12)) throw new Error("a base do CNPJ tem 12 caracteres de 0-9 ou A-Z");
  const d1 = dv(base12).dv;
  return `${d1}${dv(base12 + d1).dv}`;
}

/** A conta passo a passo, para mostrar na tela. */
export function explicar(base12) {
  const primeiro = dv(base12);
  return { primeiro, segundo: dv(base12 + primeiro.dv) };
}

/** "12ABC34501DE35" -> "12.ABC.345/01DE-35". Fora do formato volta como veio. */
export function formatar(cnpj) {
  const c = limpar(cnpj);
  return c.length === 14 ? `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}` : String(cnpj);
}

/** Tira a máscara (ponto, barra, hífen, espaço) e passa a-z para maiúsculas.
 * Só a-z ASCII: o toUpperCase() do Unicode transforma "ß" em "SS" e "ı" em "I",
 * e um caractere estranho viraria letra válida em vez de ser recusado. */
export function limpar(texto) {
  return String(texto ?? "").replace(/[.\-/\s]/g, "").replace(/[a-z]/g, (c) => c.toUpperCase());
}

/** Valida um CNPJ (numérico ou alfanumérico) e diz por quê.
 * motivo: "ok" | "vazio" | "caractere" | "tamanho" | "dv-letra" | "repetido" | "dv1" | "dv2".
 * tipo: "numerico" | "alfanumerico". */
export function validar(texto) {
  const bruto = String(texto ?? "").trim();
  if (!bruto) return { valido: false, motivo: "vazio", mensagem: "vazio" };
  const c = limpar(bruto);
  const ruim = c.match(/[^0-9A-Z]/);
  if (ruim) {
    return { valido: false, motivo: "caractere", mensagem: `tem "${ruim[0]}": o CNPJ só aceita 0-9 e A-Z (sem acento) e a máscara . / -` };
  }
  if (c.length !== 14) {
    return { valido: false, motivo: "tamanho", numero: c, mensagem: `tem ${c.length} caracteres, o CNPJ tem 14` };
  }
  const tipo = /^\d{14}$/.test(c) ? "numerico" : "alfanumerico";
  const minusculas = /[a-z]/.test(bruto);
  const base = { numero: c, formatado: formatar(c), tipo, minusculas, matriz: c.slice(8, 12) === "0001" };
  if (!/^\d{2}$/.test(c.slice(12))) {
    return { ...base, valido: false, motivo: "dv-letra", mensagem: "os 2 últimos (dígitos verificadores) são sempre números, mesmo no CNPJ alfanumérico" };
  }
  if (/^(.)\1{13}$/.test(c)) {
    return { ...base, valido: false, motivo: "repetido", mensagem: "todos os caracteres iguais: não é um CNPJ emitido" };
  }
  const esperado = calcularDV(c.slice(0, 12));
  if (c[12] !== esperado[0]) {
    return { ...base, valido: false, motivo: "dv1", esperado, mensagem: `1º dígito verificador errado: é ${c[12]}, a conta dá ${esperado[0]}` };
  }
  if (c[13] !== esperado[1]) {
    return { ...base, valido: false, motivo: "dv2", esperado, mensagem: `2º dígito verificador errado: é ${c[13]}, a conta dá ${esperado[1]}` };
  }
  return { ...base, valido: true, motivo: "ok", esperado, mensagem: "válido" };
}

/** Gera um CNPJ válido.
 * opcoes.alfanumerico: raiz e ordem com letras (formato da IN RFB 2.229/2024).
 * opcoes.filial: número da ordem (1 = matriz "0001"); no alfanumérico, a ordem
 *   também é sorteada quando filial === "aleatoria".
 * opcoes.aleatorio: () => [0,1), injetável no teste. */
export function gerar(opcoes = {}) {
  const sorteio = opcoes.aleatorio || aleatorioPadrao;
  const alfabeto = opcoes.alfanumerico ? CARACTERES : "0123456789";
  const pega = () => alfabeto[Math.floor(sorteio() * alfabeto.length)];
  for (;;) {
    let raiz = "";
    for (let i = 0; i < 8; i++) raiz += pega();
    let ordem;
    if (opcoes.filial === "aleatoria") {
      ordem = "";
      for (let i = 0; i < 4; i++) ordem += pega();
    } else {
      const f = Math.trunc(Number(opcoes.filial ?? 1));
      if (!Number.isFinite(f) || f < 1 || f > 9999) throw new Error("filial vai de 1 a 9999");
      ordem = String(f).padStart(4, "0");
    }
    const base = raiz + ordem;
    if (base === "000000000000") continue;
    // Alfanumérico sem nenhuma letra seria só um CNPJ numérico: sorteia de novo.
    if (opcoes.alfanumerico && !/[A-Z]/.test(base)) continue;
    if (/^(.)\1{11}$/.test(base)) continue;
    return base + calcularDV(base);
  }
}

/** Lote de 1 a 1000 CNPJs, sem repetir. */
export function gerarLote(quantidade, opcoes = {}) {
  const q = Math.trunc(Number(quantidade));
  if (!Number.isFinite(q) || q < 1 || q > 1000) throw new Error("quantidade vai de 1 a 1000");
  const vistos = new Set();
  while (vistos.size < q) vistos.add(gerar(opcoes));
  return [...vistos];
}

function aleatorioPadrao() {
  const c = globalThis.crypto;
  if (c && c.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
  return Math.random();
}
