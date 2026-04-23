#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════╗
║  EXTRATOR DE NF-e + GERADOR DE ESPELHO (formato Citel)      ║
║                                                              ║
║  Uso:                                                        ║
║    python nf_espelho_citel.py <nota_fiscal.pdf> [saida.pdf]  ║
║                                                              ║
║  O script lê o PDF da NF, extrai todos os dados              ║
║  automaticamente e gera um espelho no formato Citel.         ║
╚══════════════════════════════════════════════════════════════╝
"""

import re
import sys
import os
import json
from datetime import datetime

try:
    import pdfplumber
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib.colors import HexColor, black, white
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    )
    from reportlab.lib.styles import ParagraphStyle
except ImportError as e:
    print(f"ERRO: Bibliotecas faltando. Instale com: pip install pdfplumber reportlab")
    sys.exit(1)


# ═══════════════════════════════════════════════════════════════
#  PARTE 1 — EXTRAÇÃO DE DADOS DA NF
# ═══════════════════════════════════════════════════════════════

def extrair_texto_nf(pdf_path):
    """Extrai texto e tabelas de todas as páginas do PDF."""
    texto = ""
    tabelas = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                texto += t + "\n"
            for tb in (page.extract_tables() or []):
                tabelas.append(tb)
    return texto, tabelas


def _buscar(padrao, texto, grupo=1, default=""):
    """Helper: busca regex no texto."""
    m = re.search(padrao, texto, re.IGNORECASE | re.MULTILINE)
    return m.group(grupo).strip() if m else default


def _buscar_valor(label, texto):
    """Busca um valor monetário associado a um label."""
    # Tenta com R$
    v = _buscar(rf"{label}[:\s]*R?\$?\s*([\d.,]+)", texto)
    if v:
        return v
    return "0,00"


def extrair_dados(texto, tabelas):
    """Parser robusto para NF-e em PDF (formato DANFE / Citel)."""
    d = {}

    # ── Número e Série ──
    d["numero"] = _buscar(r"N[°ºo]\.?\s*([\d.]+)", texto)
    d["serie"] = _buscar(r"S[EÉ]RIE\s*(\d+)", texto)

    # ── Chave de acesso (44 dígitos) ──
    chave_match = re.search(r"(\d{4}\s+\d{4}\s+\d{4}\s+\d{4}\s+\d{4}\s+\d{4}\s+\d{4}\s+\d{4}\s+\d{4}\s+\d{4}\s+\d{4})", texto)
    if chave_match:
        d["chave_acesso"] = chave_match.group(1).strip()
    else:
        raw = re.findall(r"\d", _buscar(r"(?:CHAVE\s*(?:DE\s*)?ACESSO)[:\s]*([\d\s.]+)", texto))
        d["chave_acesso"] = " ".join("".join(raw[i:i+4]) for i in range(0, len(raw), 4)) if raw else ""

    # ── Protocolo ──
    d["protocolo"] = _buscar(r"PROTOCOLO\s*(?:DE\s*)?AUTORIZA[ÇC][ÃA]O\s*([\d/:\s]+)", texto)

    # ── Natureza da operação ──
    d["natureza_op"] = _buscar(r"NATUREZA\s*(?:DA\s*)?OPERA[ÇC][ÃA]O\s*\n?\s*(.+?)(?:\n|INSCRI)", texto)

    # ── Data emissão ──
    d["data_emissao"] = (
        _buscar(r"DATA\s*(?:DA\s*)?EMISS[ÃA]O\s*\n?\s*(\d{2}/\d{2}/\d{4})", texto) or
        _buscar(r"EMISS[ÃA]O[:\s]*(\d{2}/\d{2}/\d{4})", texto) or
        _buscar(r"(\d{2}/\d{2}/\d{4})", texto)
    )

    # ── EMITENTE ──
    emit_nome = _buscar(r"^(.+?)(?:\n|DANFE)", texto)
    if not emit_nome or len(emit_nome) < 5:
        emit_nome = _buscar(r"RECEBEMOS\s+DE\s+(.+?)\s+OS\s+PRODUTOS", texto)

    emit_cnpj = ""
    emit_ie = ""
    cnpjs = re.findall(r"(\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2})", texto)
    ies = re.findall(r"INSCRI[ÇC][ÃA]O\s*ESTADUAL\s*\n?\s*(\d[\d.]*)", texto)

    if cnpjs:
        emit_cnpj = cnpjs[-1]
    if ies:
        emit_ie = ies[0]

    emit_end_full = _buscar(r"((?:RUA|R\s|AV\s|AVENIDA|ROD).+?)(?:\n)", texto)
    emit_bairro = _buscar(r"(?:BAIRRO)[:\s]*(.+?)(?:\n|CEP)", texto)
    emit_cep = _buscar(r"CEP[:\s]*([\d.-]+)", texto)

    d["emitente"] = {
        "nome": emit_nome or "",
        "cnpj": emit_cnpj,
        "ie": emit_ie,
        "endereco": emit_end_full or "",
        "bairro": emit_bairro or "",
        "cep": emit_cep or "",
        "municipio": "",
        "uf": "",
    }

    mun_uf = re.search(r"([\w\s]+)\s*-\s*([A-Z]{2})\s*\n.*?(?:TELEFONE|CEP)", texto)
    if mun_uf:
        d["emitente"]["municipio"] = mun_uf.group(1).strip()
        d["emitente"]["uf"] = mun_uf.group(2).strip()

    # ── DESTINATÁRIO ──
    dest_block = re.search(
        r"DESTINAT[ÁA]RIO\s*/\s*REMETENTE(.*?)(?:FATURA|DUPLICATA|C[ÁA]LCULO\s*DO\s*IMPOSTO)",
        texto, re.IGNORECASE | re.DOTALL
    )
    dt = dest_block.group(1) if dest_block else texto

    dest_nome = _buscar(r"(?:NOME\s*/\s*RAZ[ÃA]O\s*SOCIAL|RAZ[ÃA]O\s*SOCIAL)\s*\n?\s*(.+?)(?:\n|CNPJ|CPF)", dt)
    dest_doc = _buscar(r"(?:CNPJ\s*/?\s*CPF|CNPJ|CPF)\s*\n?\s*([\d./-]+)", dt)
    dest_end = _buscar(r"(?:ENDERE[ÇC]O)\s*\n?\s*(.+?)(?:\n|BAIRRO|MUNIC)", dt)
    dest_bairro = _buscar(r"(?:BAIRRO\s*/?\s*DISTRITO|BAIRRO)\s*\n?\s*(.+?)(?:\n|CEP)", dt)
    dest_cep = _buscar(r"CEP\s*\n?\s*([\d.-]+)", dt)
    dest_mun = _buscar(r"(?:MUNIC[ÍI]PIO)\s*\n?\s*(.+?)(?:\n|UF|FONE)", dt)
    dest_uf = _buscar(r"(?:\bUF\b)\s*\n?\s*([A-Z]{2})", dt)
    dest_fone = _buscar(r"(?:TELEFONE|FONE)\s*/?\s*(?:FAX)?\s*\n?\s*([\d\s().-]+)", dt)
    dest_ie = _buscar(r"INSCRI[ÇC][ÃA]O\s*ESTADUAL\s*\n?\s*([\d.]+)", dt)

    d["destinatario"] = {
        "nome": dest_nome,
        "cnpj_cpf": dest_doc,
        "ie": dest_ie,
        "endereco": dest_end,
        "bairro": dest_bairro,
        "cep": dest_cep,
        "municipio": dest_mun,
        "uf": dest_uf,
        "telefone": dest_fone,
    }

    # ── DUPLICATAS ──
    d["duplicatas"] = []
    dup_matches = re.findall(r"(\d{3})\s+(\d{2}/\d{2}/\d{4})\s+([\d.,]+)", texto)
    for num, venc, valor in dup_matches:
        try:
            v = float(valor.replace(".", "").replace(",", "."))
            if v > 10 and int(num) < 100:
                d["duplicatas"].append({"numero": num, "vencimento": venc, "valor": valor})
        except: pass

    # ── VALORES ──
    d["valores"] = {
        "base_icms":        _buscar_valor(r"BASE\s*(?:DE\s*)?C[ÁA]LCULO\s*(?:DO\s*)?ICMS(?!\s*SUB)", texto),
        "valor_icms":       _buscar_valor(r"VALOR\s*(?:DO\s*)?ICMS(?!\s*SUB)", texto),
        "base_icms_st":     _buscar_valor(r"BASE\s*(?:DE\s*)?C[ÁA]LCULO\s*(?:DO\s*)?ICMS\s*(?:SUBST|SUB)", texto),
        "valor_icms_st":    _buscar_valor(r"VALOR\s*(?:DO\s*)?ICMS\s*(?:SUBST|SUB)", texto),
        "total_produtos":   _buscar_valor(r"VALOR\s*TOTAL\s*(?:DOS\s*)?PRODUTOS", texto),
        "total_nota":       _buscar_valor(r"VALOR\s*TOTAL\s*(?:DA\s*)?NOTA", texto),
        "frete":            _buscar_valor(r"VALOR\s*(?:DO\s*)?FRETE", texto),
        "seguro":           _buscar_valor(r"VALOR\s*(?:DO\s*)?SEGURO", texto),
        "desconto":         _buscar_valor(r"(?<!\w)DESCONTO(?!\w)", texto),
        "outras_despesas":  _buscar_valor(r"OUTRAS\s*DESPESAS", texto),
        "valor_ipi":        _buscar_valor(r"VALOR\s*(?:DO\s*)?IPI(?!\s*DEV)", texto),
        "ipi_devolvido":    _buscar_valor(r"VALOR\s*(?:DO\s*)?IPI\s*DEVOL", texto),
    }

    # ── TRANSPORTE ──
    transp_block = re.search(r"TRANSPORTADOR.*?VOLUMES\s*TRANSPORTADOS(.*?)(?:DADOS\s*(?:DOS?\s*)?PRODUTO|$)", texto, re.IGNORECASE | re.DOTALL)
    tb = transp_block.group(1) if transp_block else ""
    d["transporte"] = {
        "nome":         _buscar(r"(?:NOME\s*/\s*RAZ[ÃA]O\s*SOCIAL)\s*\n?\s*(.+?)(?:\n|FRETE)", tb),
        "cnpj":         _buscar(r"(?:CNPJ\s*/?\s*CPF)\s*\n?\s*([\d./-]+)", tb),
        "ie":           _buscar(r"INSCRI[ÇC][ÃA]O\s*ESTADUAL\s*\n?\s*([\d.]+)", tb),
        "frete":        _buscar(r"FRETE\s*POR\s*CONTA\s*\n?\s*(.+?)(?:\n|COD|CNPJ)", tb),
        "endereco":     _buscar(r"ENDERE[ÇC]O\s*\n?\s*(.+?)(?:\n|MUNIC)", tb),
        "municipio":    _buscar(r"MUNIC[ÍI]PIO\s*\n?\s*(.+?)(?:\n|UF)", tb),
        "uf":           _buscar(r"\bUF\b\s*\n?\s*([A-Z]{2})", tb),
        "quantidade":   _buscar(r"QUANTIDADE\s*\n?\s*(\d+)", tb),
        "especie":      _buscar(r"ESP[ÉE]CIE\s*\n?\s*(\S+)", tb) if "ESPÉCIE" in tb else "",
        "peso_bruto":   _buscar(r"PESO\s*BRUTO\s*\n?\s*([\d.,]+)", tb),
        "peso_liquido": _buscar(r"PESO\s*L[ÍI]QUIDO\s*\n?\s*([\d.,]+)", tb),
    }

    # ── PRODUTOS ──
    d["produtos"] = _extrair_produtos(texto, tabelas)
    d["info_complementar"] = _buscar(r"INFORMA[ÇC][ÕO]ES\s*COMPLEMENTARES\s*\n(.+?)(?:RESERVADO|DADOS\s*ADICIONAIS|\Z)", texto, default="").strip()
    return d


def _extrair_produtos(texto, tabelas):
    rows = []

    # Palavras-chave que indicam que uma linha NÃO é um produto
    LINHAS_INVALIDAS = [
        "identificacao", "assinatura", "recebedor", "valor do frete",
        "valor do seguro", "desconto", "outras despesas", "valor do ipi",
        "informacoes", "reservado", "dados adicionais", "transportador",
        "emitente", "destinatario", "duplicata", "fatura", "protocolo",
    ]

    for tabela in tabelas:
        if not tabela or len(tabela) < 2: continue
        header = [str(c).lower().strip() if c else "" for c in tabela[0]]
        # A tabela de produtos deve ter coluna de descrição E de valores
        tem_prod = any(k in h for h in header for k in ["descri", "produto", "servi"])
        tem_val  = any(k in h for h in header for k in ["valor", "total", "unit", "quant"])
        # Deve ter ao menos 6 colunas (cod, desc, ncm, cst, cfop, un...)
        if not (tem_prod and tem_val and len(header) >= 6): continue

        for row in tabela[1:]:
            if not row or len(row) < 3: continue
            cells = [str(c).strip() if c else "" for c in row]

            # A primeira célula deve ser um código numérico (ex: "43568")
            cod = cells[0].replace(".", "").strip()
            if not cod.isdigit(): continue

            # Filtra linhas que contenham palavras de seções inválidas
            linha_texto = " ".join(cells).lower()
            if any(inv in linha_texto for inv in LINHAS_INVALIDAS): continue

            # Linha pode ser produto válido
            rows.append(cells)

    # Fallback: regex no texto bruto
    if not rows:
        linhas = re.findall(
            r"^(\d{3,6})\s+(.+?)\s+(\d{8})\s+(\d{3})\s+(\d{4})\s+(\w{2,4})\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)",
            texto, re.MULTILINE
        )
        for l in linhas:
            rows.append([l[0], l[1], l[2], l[3], l[4], l[5], l[6], l[7], "0,00", l[7], l[8], "0,00", "0,00", "0,00", "0,00", "0,00"])

    return {"rows": rows}


# ═══════════════════════════════════════════════════════════════
#  PARTE 2 — GERAÇÃO DO ESPELHO PDF
# ═══════════════════════════════════════════════════════════════

W, H = A4
MARGIN = 10 * mm
UW = W - 2 * MARGIN

def _s(name, font="Helvetica", sz=8, color=black, align=TA_LEFT, bold=False, leading=None):
    fn = f"{font}-Bold" if bold else font
    return ParagraphStyle(name, fontName=fn, fontSize=sz, textColor=color, alignment=align, leading=leading or sz + 2.5)

S_COMPANY = _s("company", sz=11, bold=True)
S_ADDR = _s("addr", sz=8, align=TA_CENTER, leading=11)
S_ESPELHO = _s("espelho", sz=20, bold=True, align=TA_RIGHT)
S_VALUE = _s("value", sz=9, bold=True)
S_VALUE_N = _s("value_n", sz=9)
S_SECTION = _s("section", sz=8, bold=True)
S_HPROD = _s("hprod", sz=5.5, bold=True, align=TA_CENTER, leading=7.5)
S_CPROD = _s("cprod", sz=6.5, align=TA_CENTER)
S_CPROD_L = _s("cprodl", sz=6.5, align=TA_LEFT)
S_INFO_LBL = _s("info_lbl", sz=7, bold=True)
S_INFO = _s("info", sz=7, leading=10)
S_FOOTER_L = _s("footer_l", sz=6, color=HexColor("#555555"))
S_FOOTER_R = _s("footer_r", sz=6, color=HexColor("#555555"), align=TA_RIGHT)

BASE = TableStyle([("GRID", (0, 0), (-1, -1), 0.4, black), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 1.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5), ("LEFTPADDING", (0, 0), (-1, -1), 3), ("RIGHTPADDING", (0, 0), (-1, -1), 3)])

def cp(label, value, val_style=S_VALUE):
    txt = f'<font size="6" color="#333333">{label}</font><br/>{value if value else ""}'
    return Paragraph(txt, val_style)

def _sec(title):
    return (Spacer(1, 2.5 * mm), Paragraph(f"<u><b>{title}</b></u>", S_SECTION), Spacer(1, 0.5 * mm))

def gerar_espelho(dados, output_path):
    d = dados; emit = d["emitente"]; dest = d["destinatario"]; val = d["valores"]; transp = d.get("transporte", {}); prods = d.get("produtos", {}); dups = d.get("duplicatas", []); info = d.get("info_complementar", "")
    story = []
    story.append(Table([[Paragraph(f"<b>{emit['nome']}</b>", S_COMPANY), Paragraph("<b>ESPELHO</b>", S_ESPELHO)]], colWidths=[UW * 0.65, UW * 0.35], rowHeights=[18]))
    story[-1].setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.4, black), ("LINEAFTER", (0, 0), (0, 0), 0.4, black), ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    story.append(Table([[Paragraph(f'{emit.get("endereco", "")}<br/>CEP: {emit.get("cep", "")}', S_ADDR), Paragraph("Espelho Rascunho", _s("_sub", sz=9, align=TA_CENTER))]], colWidths=[UW * 0.65, UW * 0.35], rowHeights=[40]))
    story[-1].setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.4, black), ("LINEBEFORE", (1, 0), (1, 0), 0.4, black), ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    story.append(Table([[cp("NATUREZA DA OPERAÇÃO", d.get("natureza_op", ""))]], colWidths=[UW])); story[-1].setStyle(BASE)
    story.append(Table([[cp("INSCRIÇÃO ESTADUAL", emit.get("ie", "")), cp("CNPJ", emit.get("cnpj", ""))]], colWidths=[UW * 0.5, UW * 0.5])); story[-1].setStyle(BASE)
    for el in _sec("DESTINATÁRIO"): story.append(el)
    story.append(Table([[cp("NOME / RAZÃO SOCIAL", dest.get("nome", "")), cp("CNPJ / CPF", dest.get("cnpj_cpf", ""))]], colWidths=[UW * 0.7, UW * 0.3])); story[-1].setStyle(BASE)
    story.append(Table([[cp("ENDEREÇO", dest.get("endereco", "")), cp("MUNICIPIO", dest.get("municipio", "")), cp("UF", dest.get("uf", ""))]], colWidths=[UW * 0.6, UW * 0.3, UW * 0.1])); story[-1].setStyle(BASE)
    for el in _sec("CÁLCULO DO IMPOSTO"): story.append(el)
    story.append(Table([[cp("VLR TOTAL PRODUTOS", val.get("total_produtos", "0,00")), cp("VLR TOTAL NOTA", val.get("total_nota", "0,00"))]], colWidths=[UW * 0.5, UW * 0.5])); story[-1].setStyle(BASE)
    for el in _sec("DADOS DOS PRODUTOS"): story.append(el)
    rows = [[Paragraph(h, S_HPROD) for h in ["COD", "DESCRIÇÃO", "NCM", "QTD", "UNIT", "TOTAL"]]]
    for r in prods.get("rows", []): rows.append([Paragraph(str(c), S_CPROD) for c in (r[0], r[1], r[2], r[6], r[7], r[10])])
    pt = Table(rows, colWidths=[UW*0.1]*6); pt.setStyle(BASE); story.append(pt)

    def watermark(c, doc):
        c.saveState(); c.setFont("Helvetica-Bold", 50); c.setFillColor(HexColor("#e0e0e0"))
        c.translate(W/2, H/2); c.rotate(45); c.drawCentredString(0, 0, "NÃO TEM VALOR FISCAL"); c.restoreState()

    doc = SimpleDocTemplate(output_path, pagesize=A4, margin=MARGIN); doc.build(story, onFirstPage=watermark)
    return output_path


# ═══════════════════════════════════════════════════════════════
#  PARTE 3 — EXECUÇÃO
# ═══════════════════════════════════════════════════════════════

def processar(pdf_input, pdf_output=None, json_output=False):
    texto, tabelas = extrair_texto_nf(pdf_input)
    dados = extrair_dados(texto, tabelas)
    if json_output:
        print(json.dumps(dados, ensure_ascii=False))
        return
    if pdf_output:
        gerar_espelho(dados, pdf_output)
    return dados

if __name__ == "__main__":
    if len(sys.argv) < 2: sys.exit(1)
    
    # Modo Geração: python script.py --generate dados.json saida.pdf
    if "--generate" in sys.argv:
        try:
            with open(sys.argv[2], 'r', encoding='utf-8') as f:
                dados = json.load(f)
            gerar_espelho(dados, sys.argv[3])
            print(f"OK: {sys.argv[3]}")
        except Exception as e:
            print(f"ERRO: {str(e)}")
            sys.exit(1)
        sys.exit(0)

    # Modo Extração (Padrão)
    out_json = "--json" in sys.argv
    pdf_in = sys.argv[1]
    processar(pdf_in, json_output=out_json)
