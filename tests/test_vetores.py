"""Contrato: toda implementação de CPF/CNPJ deste pacote dá o mesmo resultado para vetores.json.

As completas (python/cpf_cnpj.py e js/*.mjs) devem bater `valido` E `motivo`; as funções de
copiar e colar (funcoes/valida.*) devem bater `valido`. regras.json tem de ser o que o código faz.
Roda com: python -m unittest discover -s packages/cpf-cnpj/tests
"""
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

PACOTE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PACOTE / "python"))
import cpf_cnpj

VETORES = json.loads((PACOTE / "vetores.json").read_text(encoding="utf-8"))
REGRAS = json.loads((PACOTE / "regras.json").read_text(encoding="utf-8"))


def _carregar_funcoes_py():
    spec = importlib.util.spec_from_file_location("valida_copiar", PACOTE / "funcoes" / "valida.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.valida_cpf, mod.valida_cnpj


class Contrato(unittest.TestCase):
    def test_python_completo_diverge_dos_vetores(self):
        for doc, fn in (("cpf", cpf_cnpj.validar_cpf), ("cnpj", cpf_cnpj.validar_cnpj)):
            for v in VETORES[doc]:
                with self.subTest(doc=doc, entrada=v["entrada"]):
                    r = fn(v["entrada"])
                    self.assertEqual((r["valido"], r["motivo"]), (v["valido"], v["motivo"]), v["nota"])

    def test_funcao_python_de_copiar_diverge_dos_vetores(self):
        vcpf, vcnpj = _carregar_funcoes_py()
        for doc, fn in (("cpf", vcpf), ("cnpj", vcnpj)):
            for v in VETORES[doc]:
                with self.subTest(doc=doc, entrada=v["entrada"]):
                    self.assertEqual(fn(v["entrada"]), v["valido"], v["nota"])

    @unittest.skipUnless(shutil.which("node"), "sem node")
    def test_javascript_completo_e_de_copiar_divergem_dos_vetores(self):
        saida = subprocess.run(["node", "--test", str(PACOTE / "tests" / "vetores.test.mjs")],
                               capture_output=True, text=True, check=False)
        self.assertEqual(saida.returncode, 0, saida.stdout[-3000:] + saida.stderr[-2000:])

    @unittest.skipUnless(os.environ.get("CPF_TESTE_PG") and shutil.which("psql"), "sem CPF_TESTE_PG")
    def test_funcao_sql_de_copiar_diverge_dos_vetores(self):
        sql = (PACOTE / "funcoes" / "valida.sql").read_text(encoding="utf-8")
        for doc in ("cpf", "cnpj"):
            for v in VETORES[doc]:
                lit = v["entrada"].replace("'", "''")
                r = subprocess.run(["psql", os.environ["CPF_TESTE_PG"], "-qAtX", "-v", "ON_ERROR_STOP=1",
                                    "-c", sql, "-c", f"SELECT valida_{doc}('{lit}')"],
                                   capture_output=True, text=True, check=True).stdout.strip()
                with self.subTest(doc=doc, entrada=v["entrada"]):
                    self.assertEqual(r, "t" if v["valido"] else "f", v["nota"])

    def test_regras_json_diferentes_do_codigo(self):
        c, n = REGRAS["cpf"], REGRAS["cnpj"]
        self.assertEqual(c["dv"]["pesos_1"], cpf_cnpj.PESOS_CPF_1)
        self.assertEqual(c["dv"]["pesos_2"], cpf_cnpj.PESOS_CPF_2)
        self.assertEqual(n["dv"]["pesos_1"], cpf_cnpj.PESOS_CNPJ_1)
        self.assertEqual(n["dv"]["pesos_2"], cpf_cnpj.PESOS_CNPJ_2)
        self.assertEqual(n["caracteres_base"], cpf_cnpj.CARACTERES_CNPJ)
        self.assertEqual({int(k): tuple(v) for k, v in c["regiao_fiscal"].items()}, cpf_cnpj.REGIOES)
        motivos = {v["motivo"] for d in ("cpf", "cnpj") for v in VETORES[d]}
        self.assertEqual(motivos, set(REGRAS["motivos"]), "motivo sem vetor ou vetor com motivo não documentado")
        exemplo = cpf_cnpj.validar_cnpj(n["exemplo_oficial"])
        self.assertTrue(exemplo["valido"])

    def test_gerador_cria_documento_que_o_validador_recusa(self):
        for _ in range(300):
            self.assertTrue(cpf_cnpj.validar_cpf(cpf_cnpj.gerar_cpf())["valido"])
            self.assertTrue(cpf_cnpj.validar_cnpj(cpf_cnpj.gerar_cnpj())["valido"])
            alfa = cpf_cnpj.validar_cnpj(cpf_cnpj.gerar_cnpj(alfanumerico=True))
            self.assertEqual((alfa["valido"], alfa["tipo"]), (True, "alfanumerico"))
        self.assertEqual(cpf_cnpj.gerar_cpf("SP")[8], "8")
        self.assertEqual(cpf_cnpj.gerar_cnpj(filial=2)[8:12], "0002")

    def test_cli_valida_e_sai_com_codigo_errado(self):
        cli = [sys.executable, str(PACOTE / "python" / "cpf_cnpj.py"), "validar"]
        ok = subprocess.run(cli + ["12.ABC.345/01DE-35", "529.982.247-25"], capture_output=True, text=True, check=False)
        self.assertEqual(ok.returncode, 0, ok.stderr)
        self.assertEqual([r["documento"] for r in json.loads(ok.stdout)], ["CNPJ", "CPF"])
        ruim = subprocess.run(cli + ["529.982.247-26"], capture_output=True, text=True, check=False)
        self.assertEqual(ruim.returncode, 1)


if __name__ == "__main__":
    unittest.main()
