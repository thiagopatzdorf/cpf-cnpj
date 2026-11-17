"""CPF e CNPJ (numérico e alfanumérico): validar, explicar o erro, formatar e gerar.

Implementação de referência em Python puro (sem dependência), irmã de js/cpf.mjs e
js/cnpj.mjs. As regras estão em ../regras.json e o contrato em ../vetores.json: as duas
implementações devem dar o mesmo `valido` e o mesmo `motivo` para cada entrada.

    python cpf_cnpj.py validar 12.ABC.345/01DE-35
    python cpf_cnpj.py gerar cnpj --alfanumerico --quantidade 3
"""
from __future__ import annotations

import json
import re
import secrets
import sys

__all__ = [
    "REGIOES",
    "dv_cnpj",
    "dv_cpf",
    "formatar_cnpj",
    "formatar_cpf",
    "gerar_cnpj",
    "gerar_cpf",
    "validar",
    "validar_cnpj",
    "validar_cpf",
]

REGIOES = {
    0: ("RS",), 1: ("DF", "GO", "MS", "MT", "TO"), 2: ("AC", "AM", "AP", "PA", "RO", "RR"),
    3: ("CE", "MA", "PI"), 4: ("AL", "PB", "PE", "RN"), 5: ("BA", "SE"), 6: ("MG",),
    7: ("ES", "RJ"), 8: ("SP",), 9: ("PR", "SC"),
}
UF_REGIAO = {uf: d for d, ufs in REGIOES.items() for uf in ufs}
CARACTERES_CNPJ = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
PESOS_CPF_1 = list(range(10, 1, -1))
PESOS_CPF_2 = list(range(11, 1, -1))
PESOS_CNPJ_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
PESOS_CNPJ_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
# [0-9] e não \d: em Python \d casa "５" (largura total) e o JS não; o contrato é o do JS.
_MASCARA_CPF = re.compile(r"[^0-9.\-\s]")
_MASCARA_CNPJ = re.compile(r"[.\-/\s]")


def _dv(valores: list[int], pesos: list[int]) -> int:
    resto = sum(v * p for v, p in zip(valores, pesos)) % 11
    return 0 if resto < 2 else 11 - resto


def dv_cpf(base9: str) -> str:
    """Os dois dígitos verificadores de uma base de 9 dígitos ("123456789" -> "09")."""
    if not re.fullmatch(r"[0-9]{9}", base9):
        raise ValueError("a base do CPF tem 9 dígitos")
    v = [int(c) for c in base9]
    d1 = _dv(v, PESOS_CPF_1)
    return f"{d1}{_dv(v + [d1], PESOS_CPF_2)}"


def dv_cnpj(base12: str) -> str:
    """Os dois DVs de uma base de 12 caracteres 0-9/A-Z ("12ABC34501DE" -> "35").
    Cada caractere vale código ASCII - 48, então o CNPJ numérico dá na mesma."""
    if not re.fullmatch(r"[0-9A-Z]{12}", base12):
        raise ValueError("a base do CNPJ tem 12 caracteres de 0-9 ou A-Z")
    v = [ord(c) - 48 for c in base12]
    d1 = _dv(v, PESOS_CNPJ_1)
    return f"{d1}{_dv(v + [d1], PESOS_CNPJ_2)}"


def formatar_cpf(cpf: str) -> str:
    d = re.sub(r"[^0-9]", "", str(cpf))
    return f"{d[:3]}.{d[3:6]}.{d[6:9]}-{d[9:]}" if len(d) == 11 else str(cpf)


def limpar_cnpj(texto: str) -> str:
    """Tira a máscara e passa a-z para maiúsculas (só ASCII: "ß".upper() é "SS")."""
    s = _MASCARA_CNPJ.sub("", str(texto or ""))
    return "".join(c.upper() if "a" <= c <= "z" else c for c in s)


def formatar_cnpj(cnpj: str) -> str:
    c = limpar_cnpj(cnpj)
    return f"{c[:2]}.{c[2:5]}.{c[5:8]}/{c[8:12]}-{c[12:]}" if len(c) == 14 else str(cnpj)


def validar_cpf(texto: str) -> dict:
    """{valido, motivo, ...}; motivo em regras.json (ok, vazio, caractere, tamanho, repetido, dv1, dv2)."""
    bruto = str(texto or "").strip()
    if not bruto:
        return {"valido": False, "motivo": "vazio"}
    if _MASCARA_CPF.search(bruto):
        return {"valido": False, "motivo": "caractere"}
    n = re.sub(r"[^0-9]", "", bruto)
    if len(n) != 11:
        return {"valido": False, "motivo": "tamanho", "numero": n}
    base = {"numero": n, "formatado": formatar_cpf(n), "regiao": int(n[8]), "ufs": list(REGIOES[int(n[8])])}
    if n == n[0] * 11:
        return {**base, "valido": False, "motivo": "repetido"}
    esperado = dv_cpf(n[:9])
    if n[9] != esperado[0]:
        return {**base, "valido": False, "motivo": "dv1", "esperado": esperado}
    if n[10] != esperado[1]:
        return {**base, "valido": False, "motivo": "dv2", "esperado": esperado}
    return {**base, "valido": True, "motivo": "ok", "esperado": esperado}


def validar_cnpj(texto: str) -> dict:
    """{valido, motivo, tipo, ...}; motivo em regras.json (ok, vazio, caractere, tamanho, dv-letra, repetido, dv1, dv2)."""
    bruto = str(texto or "").strip()
    if not bruto:
        return {"valido": False, "motivo": "vazio"}
    c = limpar_cnpj(bruto)
    if re.search(r"[^0-9A-Z]", c):
        return {"valido": False, "motivo": "caractere"}
    if len(c) != 14:
        return {"valido": False, "motivo": "tamanho", "numero": c}
    base = {
        "numero": c, "formatado": formatar_cnpj(c),
        "tipo": "numerico" if c.isdigit() else "alfanumerico", "matriz": c[8:12] == "0001",
    }
    if not re.fullmatch(r"[0-9]{2}", c[12:]):
        return {**base, "valido": False, "motivo": "dv-letra"}
    if c == c[0] * 14:
        return {**base, "valido": False, "motivo": "repetido"}
    esperado = dv_cnpj(c[:12])
    if c[12] != esperado[0]:
        return {**base, "valido": False, "motivo": "dv1", "esperado": esperado}
    if c[13] != esperado[1]:
        return {**base, "valido": False, "motivo": "dv2", "esperado": esperado}
    return {**base, "valido": True, "motivo": "ok", "esperado": esperado}


def validar(texto: str) -> dict:
    """Sem saber o tipo: 11 dígitos = CPF, 14 de 0-9/A-Z = CNPJ."""
    c = limpar_cnpj(texto)
    if re.fullmatch(r"[0-9]{11}", c):
        return {"documento": "CPF", **validar_cpf(texto)}
    if re.fullmatch(r"[0-9A-Z]{14}", c):
        return {"documento": "CNPJ", **validar_cnpj(texto)}
    return {"documento": None, "valido": False, "motivo": "vazio" if not c else "tamanho"}


def gerar_cpf(regiao: int | str | None = None) -> str:
    """CPF válido e fictício, para teste. regiao: 0-9 ou UF ("SP")."""
    if isinstance(regiao, str):
        regiao = UF_REGIAO[regiao.upper()] if regiao.upper() in UF_REGIAO else int(regiao)
    if regiao is not None and not 0 <= regiao <= 9:
        raise ValueError("região fiscal vai de 0 a 9")
    while True:
        base = "".join(str(secrets.randbelow(10)) for _ in range(8))
        base += str(secrets.randbelow(10) if regiao is None else regiao)
        if base != base[0] * 9:
            return base + dv_cpf(base)


def gerar_cnpj(alfanumerico: bool = False, filial: int = 1) -> str:
    """CNPJ válido e fictício, para teste. filial 1 = matriz (0001)."""
    if not 1 <= filial <= 9999:
        raise ValueError("filial vai de 1 a 9999")
    alfabeto = CARACTERES_CNPJ if alfanumerico else "0123456789"
    while True:
        base = "".join(secrets.choice(alfabeto) for _ in range(8)) + f"{filial:04d}"
        if alfanumerico and base.isdigit():
            continue
        if base != base[0] * 12:
            return base + dv_cnpj(base)


def _principal(argv: list[str]) -> int:
    if len(argv) >= 2 and argv[0] == "validar":
        resultados = [{"entrada": a, **validar(a)} for a in argv[1:]]
        print(json.dumps(resultados, ensure_ascii=False, indent=1))
        return 0 if all(r["valido"] for r in resultados) else 1
    if len(argv) >= 2 and argv[0] == "gerar" and argv[1] in ("cpf", "cnpj"):
        q = int(argv[argv.index("--quantidade") + 1]) if "--quantidade" in argv else 1
        for _ in range(q):
            print(gerar_cpf() if argv[1] == "cpf" else gerar_cnpj(alfanumerico="--alfanumerico" in argv))
        return 0
    print("uso: cpf_cnpj.py validar <doc>... | gerar cpf|cnpj [--alfanumerico] [--quantidade N]", file=sys.stderr)
    return 2


def _principal_cli() -> int:
    return _principal(sys.argv[1:])


if __name__ == "__main__":
    sys.exit(_principal(sys.argv[1:]))
