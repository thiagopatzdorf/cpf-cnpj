import re


def valida_cpf(cpf: str) -> bool:
    # Só dígito e máscara: "529.982.247-25x" é erro, não CPF.
    if re.search(r"[^0-9.\-\s]", cpf):
        return False
    n = re.sub(r"[^0-9]", "", cpf)
    if len(n) != 11 or n == n[0] * 11:
        return False

    def dv(t):
        r = sum(int(n[i]) * (t + 1 - i) for i in range(t)) % 11
        return 0 if r < 2 else 11 - r

    return dv(9) == int(n[9]) and dv(10) == int(n[10])


def valida_cnpj(cnpj: str) -> bool:
    c = re.sub(r"[.\-/\s]", "", cnpj)
    # Confere antes de pôr em maiúsculas: "ı".upper() vira "I".
    if not re.fullmatch(r"[0-9A-Za-z]{12}[0-9]{2}", c, re.ASCII):
        return False
    c = c.upper()
    if c == c[0] * 14:
        return False

    def dv(t):
        r = sum((ord(c[i]) - 48) * (2 + (t - 1 - i) % 8) for i in range(t)) % 11
        return 0 if r < 2 else 11 - r

    return dv(12) == int(c[12]) and dv(13) == int(c[13])
