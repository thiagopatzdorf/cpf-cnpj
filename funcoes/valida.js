function validaCPF(cpf) {
  // Só dígito e máscara: "529.982.247-25x" é erro, não CPF.
  if (/[^\d.\-\s]/.test(String(cpf))) return false;
  const n = String(cpf).replace(/\D/g, "");
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
  const dv = (t) => {
    let s = 0;
    for (let i = 0; i < t; i++) s += n[i] * (t + 1 - i);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(9) === +n[9] && dv(10) === +n[10];
}

// Aceita o CNPJ numérico e o alfanumérico (IN RFB 2.229/2024).
function validaCNPJ(cnpj) {
  let c = String(cnpj).replace(/[.\/\-\s]/g, "");
  // Confere antes de pôr em maiúsculas: "ı".toUpperCase() vira "I".
  if (!/^[0-9A-Za-z]{12}\d{2}$/.test(c)) return false;
  c = c.toUpperCase();
  if (/^(.)\1{13}$/.test(c)) return false;
  const dv = (t) => {
    let s = 0;
    for (let i = 0; i < t; i++) s += (c.charCodeAt(i) - 48) * (2 + ((t - 1 - i) % 8));
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === +c[12] && dv(13) === +c[13];
}
