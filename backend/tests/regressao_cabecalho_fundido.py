#!/usr/bin/env python3
"""
Teste de regressão — DANFE com cabeçalho de colunas FUNDIDO ao primeiro item.

Contexto (NF nº 50.998, chamado #20): neste layout o pdfplumber devolve a
linha de cabeçalho das colunas ("CÓDIGO", "DESCRIÇÃO...", "NCM/SH", ...) na
MESMA linha da tabela que o primeiro produto — cada célula vem como
"RÓTULO\\nvalor". O extrator pulava a linha 0 inteira (tratando-a como
cabeçalho puro) e, com isso, DESCARTAVA o primeiro item (cód. 03270). A soma
dos itens (1.647,28) ficava menor que o total dos produtos da NF (1.847,08),
disparando o banner "Conferir Itens".

A fixture `fixtures/nf_cabecalho_fundido.tables.json` é a saída REAL de
`page.extract_tables()` para esse PDF (ground truth), contendo só a tabela de
produtos — sem identificadores pessoais do destinatário.

Executar:  python backend/tests/regressao_cabecalho_fundido.py
Sai com código != 0 se a regressão voltar.
"""
import json
import importlib.util
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]  # .../backend
SCRIPT = BASE / "scripts" / "nf_espelho_citel.py"
FIXTURE = Path(__file__).resolve().parent / "fixtures" / "nf_cabecalho_fundido.tables.json"

# Total dos produtos impresso na NF (tabela "VALOR TOTAL DOS PRODUTOS").
TOTAL_PRODUTOS_NF = 1847.08


def _carregar_modulo():
    spec = importlib.util.spec_from_file_location("nf_espelho_citel", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _parse_br(v):
    return float(str(v).replace(".", "").replace(",", ".") or 0)


def main():
    nf = _carregar_modulo()
    tabelas = json.loads(FIXTURE.read_text(encoding="utf-8"))

    # texto="" força o caminho por tabela (o mesmo usado em produção quando a
    # tabela de produtos é reconhecida pelo pdfplumber).
    produtos = nf._extrair_produtos("", tabelas)
    rows = produtos["rows"]

    mapeados = [nf._mapear_produto(r) for r in rows]
    codigos = {p["codigo"] for p in mapeados}
    soma = round(sum(_parse_br(p["valor_total"]) for p in mapeados), 2)

    falhas = []
    if len(rows) != 2:
        falhas.append(f"esperado 2 produtos, veio {len(rows)}: {codigos}")
    if "03270" not in codigos:
        falhas.append("item 03270 (fundido no cabeçalho) foi descartado")
    if "43350" not in codigos:
        falhas.append("item 43350 ausente")
    if abs(soma - TOTAL_PRODUTOS_NF) > 0.02:
        falhas.append(f"soma dos itens {soma:.2f} != total da NF {TOTAL_PRODUTOS_NF:.2f}")

    # O primeiro item precisa ser mapeado corretamente (não só estar presente).
    p0 = next((p for p in mapeados if p["codigo"] == "03270"), None)
    if p0:
        esperado = {"ncm": "32091010", "unidade": "LTA", "quantidade": "2,000",
                    "valor_unitario": "99,9000", "valor_total": "199,80"}
        for k, v in esperado.items():
            if p0[k] != v:
                falhas.append(f"03270.{k}: esperado {v!r}, veio {p0[k]!r}")

    if falhas:
        print("FALHOU — regressão do cabeçalho fundido:")
        for f in falhas:
            print("  -", f)
        raise SystemExit(1)

    print(f"OK — {len(rows)} produtos, códigos {sorted(codigos)}, "
          f"soma {soma:.2f} == total NF {TOTAL_PRODUTOS_NF:.2f}")


if __name__ == "__main__":
    main()
