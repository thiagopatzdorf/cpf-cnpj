// CPF: gerar, validar e explicar. Sem DOM: texto ou número entra, objeto sai,
// então roda igual no navegador e no Node.
// Fonte única: packages/cpf-cnpj (regras.json + vetores.json). O site
// cpf.genesisinnovation.io usa uma cópia idêntica, conferida por teste.
//
// Regra do dígito verificador (DV), módulo 11:
//   1º DV: os 9 primeiros dígitos × pesos 10, 9, ..., 2; resto da soma por 11;
//          resto 0 ou 1 -> DV 0, senão DV = 11 - resto.
//   2º DV: os 9 dígitos + o 1º DV × pesos 11, 10, ..., 2; mesma regra.
// O 9º dígito é a região fiscal da inscrição (folheto "CPF" da Receita
// Federal, Educação Fiscal, conferido em 2026-10-02).

/** Região fiscal (9º dígito) -> UFs. Fonte: folheto CPF da Receita Federal. */
export const REGIOES = Object.freeze({
  0: ["RS"],
  1: ["DF", "GO", "MS", "MT", "TO"],
  2: ["AC", "AM", "AP", "PA", "RO", "RR"],
  3: ["CE", "MA", "PI"],
  4: ["AL", "PB", "PE", "RN"],
  5: ["BA", "SE"],
  6: ["MG"],
  7: ["ES", "RJ"],
  8: ["SP"],
  9: ["PR", "SC"],
});

/** UF -> dígito da região fiscal. */
export const UF_REGIAO = Object.freeze(
  Object.fromEntries(Object.entries(REGIOES).flatMap(([d, ufs]) => ufs.map((uf) => [uf, Number(d)]))),
);

/** "Região fiscal 8 (SP)" a partir do dígito. */
export function nomeRegiao(digito) {
  const ufs = REGIOES[digito];
  return ufs ? `${digito}ª região fiscal (${ufs.join(", ")})` : "";
}

function dv(digitos, pesoInicial) {
  let soma = 0;
  for (let i = 0; i < digitos.length; i++) soma += Number(digitos[i]) * (pesoInicial - i);
  const resto = soma % 11;
  return { soma, resto, dv: resto < 2 ? 0 : 11 - resto };
}

/** Os dois DVs de uma base de 9 dígitos ("123456789" -> "09"). */
export function calcularDV(base9) {
  if (!/^\d{9}$/.test(base9)) throw new Error("a base do CPF tem 9 dígitos");
  const d1 = dv(base9, 10).dv;
  const d2 = dv(base9 + d1, 11).dv;
  return `${d1}${d2}`;
}

/** A conta inteira, passo a passo, para mostrar na tela. */
export function explicar(base9) {
  const d1 = dv(base9, 10);
  const d2 = dv(base9 + d1.dv, 11);
  const linha = (digitos, peso0) => [...digitos].map((c, i) => ({ digito: Number(c), peso: peso0 - i, produto: Number(c) * (peso0 - i) }));
  return {
    primeiro: { ...d1, termos: linha(base9, 10) },
    segundo: { ...d2, termos: linha(base9 + d1.dv, 11) },
  };
}

/** "12345678909" -> "123.456.789-09". Entrada fora do formato volta como veio. */
export function formatar(cpf) {
  const d = String(cpf).replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : String(cpf);
}

/** Valida um CPF e diz por quê. Aceita máscara (pontos, hífen, espaços).
 * motivo: "ok" | "vazio" | "caractere" | "tamanho" | "repetido" | "dv1" | "dv2". */
export function validar(texto) {
  const bruto = String(texto ?? "").trim();
  if (!bruto) return { valido: false, motivo: "vazio", mensagem: "vazio" };
  if (/[^\d.\-\s]/.test(bruto)) {
    return { valido: false, motivo: "caractere", mensagem: "tem caractere que não é número nem máscara (CPF só tem dígitos)" };
  }
  const n = bruto.replace(/\D/g, "");
  if (n.length !== 11) {
    const dica = n.length > 0 && n.length < 11 ? "; planilha costuma apagar o zero à esquerda" : "";
    return { valido: false, motivo: "tamanho", numero: n, mensagem: `tem ${n.length} dígitos, o CPF tem 11${dica}` };
  }
  const regiao = Number(n[8]);
  const base = { numero: n, formatado: formatar(n), regiao, regiaoNome: nomeRegiao(regiao) };
  if (/^(\d)\1{10}$/.test(n)) {
    return { ...base, valido: false, motivo: "repetido", mensagem: "todos os dígitos iguais: passa na conta, mas a Receita não emite" };
  }
  const esperado = calcularDV(n.slice(0, 9));
  if (n[9] !== esperado[0]) {
    return { ...base, valido: false, motivo: "dv1", esperado, mensagem: `1º dígito verificador errado: é ${n[9]}, a conta dá ${esperado[0]}` };
  }
  if (n[10] !== esperado[1]) {
    return { ...base, valido: false, motivo: "dv2", esperado, mensagem: `2º dígito verificador errado: é ${n[10]}, a conta dá ${esperado[1]}` };
  }
  return { ...base, valido: true, motivo: "ok", esperado, mensagem: "válido" };
}

/** Gera um CPF válido. opcoes.regiao: 0-9 (ou UF, ex. "SP"); sem ela, qualquer.
 * opcoes.aleatorio: () => [0,1) (injetável no teste); padrão crypto quando há. */
export function gerar(opcoes = {}) {
  const sorteio = opcoes.aleatorio || aleatorioPadrao;
  let regiao = opcoes.regiao;
  if (typeof regiao === "string" && regiao in UF_REGIAO) regiao = UF_REGIAO[regiao];
  if (regiao !== undefined && regiao !== null && regiao !== "") {
    regiao = Number(regiao);
    if (!Number.isInteger(regiao) || regiao < 0 || regiao > 9) throw new Error("região fiscal vai de 0 a 9");
  } else regiao = null;
  for (;;) {
    let base = "";
    for (let i = 0; i < 8; i++) base += Math.floor(sorteio() * 10);
    base += regiao === null ? Math.floor(sorteio() * 10) : regiao;
    if (/^(\d)\1{8}$/.test(base)) continue; // 111.111.111-11 passa na conta, mas não é emitido
    return base + calcularDV(base);
  }
}

/** Lote de 1 a 1000 CPFs, sem repetir. */
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
