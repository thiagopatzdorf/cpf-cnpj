# cpf-cnpj: as regras do CPF e do CNPJ num lugar só

Referência aberta (MIT) para validar, explicar o erro, formatar e gerar CPF e CNPJ, **inclusive o CNPJ
alfanumérico** (IN RFB nº 2.229/2024, emitido desde julho de 2026). Sem dependência, em JavaScript e Python,
mais funções curtas de copiar e colar em JS, Python e SQL (PostgreSQL).

- **Site para usar agora:** <https://cpf.genesisinnovation.io> (gerar, validar, máscara em lote, conta passo a passo).
- **As regras em dados:** [`regras.json`](regras.json): pesos, alfabeto, partes, região fiscal, motivos de erro e fontes.
- **O contrato:** [`vetores.json`](vetores.json): casos de teste com a resposta certa. Toda implementação daqui
  passa por eles, e qualquer outra pode usá-los para se conferir.

Achou uma entrada que algum validador erra? Abra uma issue com ela: vira vetor, e o vetor vira regra para todos.

## As regras

### CPF

| regra | valor |
|---|---|
| tamanho | 11 dígitos (`000.000.000-00`) |
| máscara aceita | `.`, `-` e espaço; qualquer outro caractere (letra, `/`, dígito Unicode como `５`) é erro |
| 1º dígito verificador | 9 primeiros × pesos 10, 9, …, 2; resto da soma por 11; resto 0 ou 1 → 0, senão 11 − resto |
| 2º dígito verificador | 9 primeiros + 1º DV × pesos 11, 10, …, 2; mesma regra |
| todos iguais | `111.111.111-11` fecha a conta, mas não é emitido: inválido |
| 9º dígito | região fiscal da inscrição: 0 RS; 1 DF, GO, MS, MT, TO; 2 AC, AM, AP, PA, RO, RR; 3 CE, MA, PI; 4 AL, PB, PE, RN; 5 BA, SE; 6 MG; 7 ES, RJ; 8 SP; 9 PR, SC |
| zero à esquerda | faz parte do número: CPF com 10 dígitos quase sempre é planilha que comeu o zero (o validador recusa e avisa) |

### CNPJ (numérico e alfanumérico)

| regra | valor |
|---|---|
| tamanho | 14 posições (`00.000.000/0000-00`): raiz (8) + ordem (4) + dígitos verificadores (2) |
| alfabeto | raiz e ordem: `0-9` e `A-Z`; os 2 DVs são **sempre** números |
| minúsculas | aceitas na entrada e passadas a maiúsculas, **só a-z ASCII** (ver armadilhas) |
| máscara aceita | `.`, `/`, `-` e espaço |
| valor de cada caractere | código ASCII − 48: `0`…`9` = 0…9, `A` = 17 … `Z` = 42 (para número dá o próprio dígito) |
| 1º dígito verificador | 12 caracteres × pesos 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2; resto 0 ou 1 → 0, senão 11 − resto |
| 2º dígito verificador | 12 + 1º DV × pesos 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2; mesma regra |
| todos iguais | inválido |
| ordem `0001` | matriz; `0002` em diante, filiais |
| exemplo oficial | `12.ABC.345/01DE-35` |
| convivência | os CNPJs numéricos não mudam; a mesma conta valida os dois formatos |

### Motivos de erro (iguais em todas as implementações completas)

`ok`, `vazio`, `caractere`, `tamanho`, `dv-letra` (só CNPJ), `repetido`, `dv1`, `dv2`.

### Armadilhas que os vetores cobram

- `"ß".toUpperCase()` é `"SS"` e `"ı".toUpperCase()` é `"I"`: quem põe em maiúsculas **antes** de conferir o
  alfabeto aceita `12ABC34ß1DE09` como CNPJ válido. O validador que estava no ar até 17/11/2026 caía nisso.
- Em Python, `\d` casa dígitos Unicode (`５`); em JavaScript, não. Use `[0-9]`.
- Guarde CPF e CNPJ como texto (`char(14)`/`text`), nunca como número: o zero à esquerda some, e o CNPJ
  alfanumérico nem cabe.

## Uso

**JavaScript** (navegador ou Node, ESM):

```js
import { validar, gerar } from "cpf-cnpj/cnpj"; // npm install github:thiagopatzdorf/cpf-cnpj
validar("12.abc.345/01de-35"); // { valido: true, motivo: "ok", tipo: "alfanumerico", formatado: "12.ABC.345/01DE-35", ... }
gerar({ alfanumerico: true });  // CNPJ fictício para teste
```

**Python** (3.9+):

```python
# pip install git+https://github.com/thiagopatzdorf/cpf-cnpj
from cpf_cnpj import validar_cpf, validar_cnpj, gerar_cpf
validar_cnpj("12.ABC.345/01DE-36")  # {'valido': False, 'motivo': 'dv2', 'esperado': '35', ...}
gerar_cpf("SP")                     # CPF fictício com 9º dígito 8
```

Linha de comando: `cpf-cnpj validar 529.982.247-25 12.ABC.345/01DE-35` (sai 1 se algum for inválido) e
`cpf-cnpj gerar cnpj --alfanumerico --quantidade 5`.

**Copiar e colar:** [`funcoes/valida.js`](funcoes/valida.js), [`funcoes/valida.py`](funcoes/valida.py) e
[`funcoes/valida.sql`](funcoes/valida.sql) (PostgreSQL, para `CHECK (valida_cnpj(cnpj))`).

## Testes

```sh
python -m unittest discover -s tests   # Python, funções de copiar, JS (se houver node) e SQL (com CPF_TESTE_PG)
node --test tests/                     # só o lado JS
```

Os números gerados são fictícios: passam na conta e não pertencem a ninguém de propósito, mas podem coincidir
com um documento real. Servem para teste. Validar a conta não diz se o CPF ou o CNPJ existe; isso é consulta
na Receita Federal.

## Fontes (conferidas em 2026-10-02)

- Cálculo do DV do CNPJ alfanumérico: Receita Federal/Serpro, manual de cálculo do DV do CNPJ alfanumérico.
- Formato alfanumérico e início em julho de 2026: IN RFB nº 2.229/2024 e perguntas e respostas da Receita.
- 9º dígito do CPF: Receita Federal, folheto "CPF" (Educação Fiscal).

Feito pela [Genesis Innovation](https://genesisinnovation.io).
