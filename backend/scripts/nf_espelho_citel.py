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
    """Helper: busca regex no texto e evita retornar labels conhecidos."""
    LABELS_COMO_DADO = ["NOME", "RAZÃO", "SOCIAL", "CNPJ", "CPF", "ENDEREÇO", "BAIRRO", "CEP", "MUNICÍPIO", "UF", "DATA", "EMISSÃO", "VALOR", "CÓDIGO", "QUANTIDADE"]
    m = re.search(padrao, texto, re.IGNORECASE | re.MULTILINE)
    if not m: return default
    val = m.group(grupo).strip()
    # Se o valor capturado for muito parecido com um label (curto e em caixa alta / contendo palavras chave)
    if len(val) < 30 and any(lbl in val.upper() for lbl in LABELS_COMO_DADO):
        # Se for APENAS o label (ou label + pontuação), descarta
        if any(val.upper().strip(" :/.-") == lbl for lbl in LABELS_COMO_DADO):
            return default
    return val


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
    # Tenta encontrar o bloco do destinatário
    dest_block = re.search(
        r"(?:DESTINAT[ÁA]RIO\s*/\s*REMETENTE|DADOS\s+DO\s+DESTINAT[ÁA]RIO)(.*?)(?:FATURA|DUPLICATA|C[ÁA]LCULO\s*DO\s*IMPOSTO|DADOS\s+DO\s+TRANSPORTE)",
        texto, re.IGNORECASE | re.DOTALL
    )
    dt = dest_block.group(1) if dest_block else texto

    # Patterns mais flexíveis para o destinatário
    dest_nome = (
        _buscar(r"(?:NOME\s*/\s*RAZ[ÃA]O\s*SOCIAL|RAZ[ÃA]O\s*SOCIAL)[:\s]*\n?([^\n\d]{5,})", dt) or
        _buscar(r"(?:DESTINAT[ÁA]RIO|REMETENTE)[:\s]*\n?([^\n\d]{5,})", dt)
    )
    # Procura CNPJ ou CPF puro no bloco
    doc_match = re.search(r"(\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})", dt)
    dest_doc = doc_match.group(1) if doc_match else _buscar(r"(?:CNPJ\s*/?\s*CPF|CNPJ|CPF)[:\s]*\n?([\d./-]+)", dt)
    
    dest_end = _buscar(r"(?:ENDERE[ÇC]O)[:\s]*\n?(.+?)(?:\n|BAIRRO|MUNIC|CEP)", dt)
    dest_bairro = _buscar(r"(?:BAIRRO\s*/?\s*DISTRITO|BAIRRO)[:\s]*\n?(.+?)(?:\n|CEP|MUNIC)", dt)
    dest_cep = _buscar(r"CEP[:\s]*\n?([\d.-]+)", dt)
    dest_mun = _buscar(r"(?:MUNIC[ÍI]PIO)[:\s]*\n?(.+?)(?:\n|UF|FONE)", dt)
    dest_uf = _buscar(r"(?:\bUF\b)[:\s]*\n?([A-Z]{2})", dt)

    d["destinatario"] = {
        "nome": dest_nome,
        "cnpj_cpf": dest_doc,
        "ie": _buscar(r"(?:INSCRI[ÇC][ÃA]O\s*ESTADUAL|INSC\.?\s*EST\.?)[:\s]*\n?([\d.]+)", dt),
        "endereco": dest_end,
        "bairro": dest_bairro,
        "cep": dest_cep,
        "municipio": dest_mun,
        "uf": dest_uf,
        "telefone": _buscar(r"(?:TELEFONE|FONE|FONE/FAX)[:\s]*\n?([\d\s().-]+)", dt),
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

    LINHAS_INVALIDAS = [
        "identificacao", "assinatura", "recebedor", "valor do frete",
        "valor do seguro", "desconto", "outras despesas", "valor do ipi",
        "informacoes", "reservado", "dados adicionais", "transportador",
        "emitente", "destinatario", "duplicata", "fatura", "protocolo",
    ]

    def _linha_valida(cells):
        cod = cells[0].replace(".", "").strip()
        if not cod.isdigit(): return False
        # Linha com célula de NCM (8 dígitos) é produto legítimo mesmo que a
        # descrição contenha palavra da lista (ex.: "TINTA C/ DESCONTO").
        if any(re.fullmatch(r"\d{8}", re.sub(r"\s+", "", c)) for c in cells[1:]):
            return True
        linha_texto = " ".join(cells).lower()
        if any(inv in linha_texto for inv in LINHAS_INVALIDAS): return False
        return True

    def _extrair_linhas(tabela, start_row):
        for row in tabela[start_row:]:
            if not row or len(row) < 3: continue
            cells = [str(c).strip() if c else "" for c in row]
            if _linha_valida(cells):
                rows.append(cells)

    def _linha_dados_do_cabecalho(header_row):
        """Alguns DANFEs (ex.: layout Citel) fundem o cabeçalho das colunas com
        o PRIMEIRO item na mesma linha da tabela: cada célula vem como
        'RÓTULO\\nvalor' (não há linha de grade separando rótulo e dado). Ao
        pular o cabeçalho, esse primeiro produto era descartado. Remove o
        rótulo (1ª linha textual) de cada célula e devolve a linha só com os
        valores — ou None se o restante não formar um produto (código não
        numérico), que é o caso de um cabeçalho puro."""
        dados = []
        for c in header_row:
            partes = str(c).split("\n", 1) if c else [""]
            dados.append(partes[1].strip() if len(partes) > 1 else "")
        cod = dados[0].replace(".", "").strip() if dados else ""
        return dados if cod.isdigit() else None

    # Primeira passagem: tabelas com cabeçalho reconhecível
    found_product_table = False
    product_col_count = 0
    for tabela in tabelas:
        if not tabela or len(tabela) < 2: continue
        header = [str(c).lower().strip() if c else "" for c in tabela[0]]
        tem_prod = any(k in h for h in header for k in ["descri", "produto", "servi", "cod"])
        tem_val  = any(k in h for h in header for k in ["valor", "total", "unit", "quant", "qtd", "preco"])
        tem_header_valido = tem_prod and tem_val and len(header) >= 5

        primeira_celula = str(tabela[0][0]).replace(".", "").strip() if tabela[0] else ""
        is_continuacao = (not tem_header_valido and found_product_table
                          and len(header) >= max(product_col_count - 2, 5)
                          and primeira_celula.isdigit())

        if tem_header_valido:
            found_product_table = True
            product_col_count = len(header)
            # Recupera o 1º item quando ele está fundido na linha do cabeçalho.
            embutida = _linha_dados_do_cabecalho(tabela[0])
            if embutida and _linha_valida(embutida):
                rows.append(embutida)
            _extrair_linhas(tabela, 1)
        elif is_continuacao:
            _extrair_linhas(tabela, 0)

    # Segunda passagem: qualquer tabela com >= 5 colunas onde primeira célula é código numérico
    if not rows:
        for tabela in tabelas:
            if not tabela or len(tabela) < 2: continue
            for row in tabela:
                if not row or len(row) < 5: continue
                cells = [str(c).strip() if c else "" for c in row]
                if _linha_valida(cells):
                    rows.append(cells)

    # Fallback: regex no texto bruto — corrigido [A-Z0-9]
    if not rows:
        # Restringe a busca às seções de produtos (podem ser várias em NF
        # multi-página). Necessário porque a classe da descrição abaixo é
        # permissiva e, no texto completo, poderia "atravessar" dados do
        # cabeçalho da NF e engolir itens.
        secoes = re.findall(
            r"DADOS\s+D[OE]S?\s+PRODUTOS?[\s/]*SERVI[ÇC]OS?(.*?)(?=DADOS\s+ADICIONAIS|INFORMA[ÇC][ÕO]ES\s+COMPLEMENTARES|C[ÁA]LCULO\s+DO\s+ISSQN|RESERVADO\s+AO\s+FISCO|\Z)",
            texto, re.IGNORECASE | re.DOTALL)
        texto_busca = "\n".join(secoes) if secoes else texto
        # A descrição aceita vírgula, acentos e pontuação comum (ex.:
        # "RESOLUCAO DO SENADO FEDERAL N. 13/12," em NF de importado com
        # FCI) e pode atravessar quebras de linha quando os valores vêm
        # depois das linhas de continuação da descrição.
        p_regex = r"(\d{3,7})\s+([A-Za-zÀ-ÿ0-9\s\*.,;/:()%&º°ª'+#-]+?)\s+(\d{8})\s+(\d{3})\s+(\d{4})\s+([A-Z]{2,4})\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)"
        linhas = re.findall(p_regex, texto_busca, re.MULTILINE)
        for l in linhas:
            r = list(l)
            r[1] = " ".join(r[1].split())  # normaliza espaços/quebras de linha na descrição
            r[4] = "5202"
            # Linha natural de 9 colunas: cod, desc, ncm, cst, cfop, un, qtd, unit, total
            rows.append(r)

    return {"rows": rows}


def _mapear_produto(r):
    """Mapeia uma linha de produto (dict do nf_data ou lista de células com
    contagem de colunas variável — DANFEs têm de 9 a 14 colunas) para os
    campos do espelho. Localiza as colunas pelo conteúdo: o NCM (8 dígitos)
    ancora o mapeamento; CST/CFOP/UN vêm em seguida e qtd/unit/total são os
    3 numéricos seguintes. Índices fixos liam a coluna errada em layouts
    maiores (ex.: VALOR ICMS no lugar do total do item)."""
    if isinstance(r, dict):
        return {
            "codigo":         str(r.get("codigo", "")),
            "descricao":      str(r.get("descricao", "")),
            "ncm":            str(r.get("ncm", "")),
            "cfop":           str(r.get("cfop", "5202")),
            "unidade":        str(r.get("unidade", "UN")),
            "quantidade":     str(r.get("quantidade", "0")),
            "valor_unitario": str(r.get("valor_unitario", "0,00")),
            "valor_total":    str(r.get("valor_total", "0,00")),
        }
    cells = [str(c) if c is not None else "" for c in r]
    dg = lambda s: re.sub(r"\s+", "", s)  # junta dígitos quebrados por \n
    num = lambda s: re.fullmatch(r"[\d.,]+", dg(s)) is not None

    ncm_i = next((i for i in range(2, len(cells)) if re.fullmatch(r"\d{8}", dg(cells[i]))), None)
    if ncm_i is not None:
        resto = cells[ncm_i + 1:]
        j = 0
        if j < len(resto) and re.fullmatch(r"\d{2,3}", dg(resto[j])): j += 1  # CST
        if j < len(resto) and re.fullmatch(r"\d{4}", dg(resto[j])):   j += 1  # CFOP original
        un = ""
        if j < len(resto) and re.fullmatch(r"[A-Za-z]{1,4}", dg(resto[j])):
            un = dg(resto[j]); j += 1
        nums = [dg(c) for c in resto[j:] if num(c)]
        return {
            "codigo":         dg(cells[0]),
            "descricao":      " ".join(cells[1].split()),
            "ncm":            dg(cells[ncm_i]),
            "cfop":           "5202",
            "unidade":        un or "UN",
            "quantidade":     nums[0] if len(nums) > 0 else "0",
            "valor_unitario": nums[1] if len(nums) > 1 else "0,00",
            "valor_total":    nums[2] if len(nums) > 2 else "0,00",
        }
    # Fallback: layout de 9 colunas do extrator (cod, desc, ncm, cst, cfop, un, qtd, unit, total)
    get = lambda i, dflt="": cells[i] if i < len(cells) else dflt
    return {
        "codigo":         get(0),
        "descricao":      " ".join(get(1).split()),
        "ncm":            get(2),
        "cfop":           "5202",
        "unidade":        get(5, "UN"),
        "quantidade":     get(6, "0"),
        "valor_unitario": get(7, "0,00"),
        "valor_total":    get(8, "0,00"),
    }


def _norm_dados(d):
    """Aceita tanto a saída bruta de extrair_dados quanto o formato plano
    nf_data salvo pelo backend (produtos = lista de dicts), usado pela rota
    GET /api/chamados/:id/danfe-pdf."""
    if not isinstance(d.get("produtos"), list):
        return d  # formato bruto (produtos = {"rows": [...]})
    g = d.get
    return {
        "numero":        g("numero_nf", ""),
        "natureza_op":   g("natureza_operacao", ""),
        "data_emissao":  g("data_emissao", ""),
        "emitente":      {},
        "duplicatas":    [],
        "info_complementar": "",
        "destinatario": {
            "nome":      g("razao_social_dest") or g("cliente", ""),
            "cnpj_cpf":  g("cnpj_dest") or g("cnpj", ""),
            "endereco":  g("endereco_dest", ""),
            "bairro":    g("bairro_dest", ""),
            "cep":       g("cep_dest", ""),
            "municipio": g("municipio_dest", ""),
            "uf":        g("uf_dest", ""),
            "ie":        "",
        },
        "valores": {
            "base_icms":       g("base_icms", "0,00"),
            "valor_icms":      g("valor_icms", "0,00"),
            "base_icms_st":    g("base_icms_st", "0,00"),
            "valor_icms_st":   g("valor_icms_st", "0,00"),
            "total_produtos":  g("valor_total_produtos", "0,00"),
            "total_nota":      g("valor_total_nota", "0,00"),
            "frete":           g("valor_frete", "0,00"),
            "seguro":          g("valor_seguro", "0,00"),
            "desconto":        "0,00",
            "outras_despesas": "0,00",
            "valor_ipi":       g("valor_ipi", "0,00"),
        },
        "transporte": {
            "peso_bruto":   g("peso_bruto", "0,00"),
            "peso_liquido": g("peso_liquido", "0,00"),
            "quantidade":   g("quantidade_volumes", "0"),
            "especie":      g("especie_volumes", ""),
        },
        "produtos": {"rows": g("produtos", [])},
    }


# ═══════════════════════════════════════════════════════════════
#  PARTE 2 — GERAÇÃO DO ESPELHO PDF
# ═══════════════════════════════════════════════════════════════

W, H = A4
MARGIN = 8 * mm
UW = W - 2 * MARGIN

def _s(name, font="Helvetica", sz=8, color=black, align=TA_LEFT, bold=False, leading=None):
    fn = f"{font}-Bold" if bold else font
    return ParagraphStyle(name, fontName=fn, fontSize=sz, textColor=color, alignment=align, leading=leading or sz + 2.5)

S_COMPANY = _s("company", sz=11, bold=True)
S_ADDR = _s("addr", sz=7.5, align=TA_CENTER, leading=10)
S_ESPELHO = _s("espelho", sz=18, bold=True, align=TA_RIGHT)
S_VALUE = _s("value", sz=9, bold=True)
S_VALUE_N = _s("value_n", sz=9)
S_SECTION = _s("section", sz=8, bold=True)
S_HPROD = _s("hprod", sz=6, bold=True, align=TA_CENTER, leading=8)
S_CPROD = _s("cprod", sz=7, align=TA_CENTER)
S_CPROD_L = _s("cprodl", sz=7, align=TA_LEFT)
S_CPROD_R = _s("cprodr", sz=7, align=TA_RIGHT)
S_INFO_LBL = _s("info_lbl", sz=7, bold=True)
S_INFO = _s("info", sz=7, leading=10)
S_FOOTER_L = _s("footer_l", sz=6, color=HexColor("#555555"))
S_FOOTER_R = _s("footer_r", sz=6, color=HexColor("#555555"), align=TA_RIGHT)

BASE = TableStyle([
    ("GRID", (0, 0), (-1, -1), 0.4, black),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("TOPPADDING", (0, 0), (-1, -1), 1.5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
    ("LEFTPADDING", (0, 0), (-1, -1), 3),
    ("RIGHTPADDING", (0, 0), (-1, -1), 3)
])

def cp(label, value, val_style=S_VALUE):
    txt = f'<font size="6" color="#333333">{label}</font><br/>{value if value else ""}'
    return Paragraph(txt, val_style)

def _sec(title):
    return (Spacer(1, 2.5 * mm), Paragraph(f"<u><b>{title}</b></u>", S_SECTION), Spacer(1, 0.5 * mm))

def gerar_espelho(dados, output_path):
    d = _norm_dados(dados); emit = d.get("emitente", {}); dest = d.get("destinatario", {}); val = d.get("valores", {}); transp = d.get("transporte", {}); prods = d.get("produtos", {}); dups = d.get("duplicatas", []); info = d.get("info_complementar", "")
    story = []
    
    # ── HEADER ──
    story.append(Table([[Paragraph(f"<b>{emit.get('nome', 'MARIN LOGISTICA E COMERCIO LTDA')}</b>", S_COMPANY), Paragraph("<b>ESPELHO DANFE</b>", S_ESPELHO)]], colWidths=[UW * 0.7, UW * 0.3], rowHeights=[18]))
    story[-1].setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.4, black), ("LINEAFTER", (0, 0), (0, 0), 0.4, black), ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    
    story.append(Table([[
        Paragraph(f'{emit.get("endereco", "RUA VALDO GERLACH, 07 - DISTRITO INDUSTRIAL - SAO JOSE - SC")}<br/>CEP: {emit.get("cep", "88104-743")}', S_ADDR), 
        Paragraph("Documento Auxiliar de Conferência", _s("_sub", sz=8, align=TA_CENTER))
    ]], colWidths=[UW * 0.7, UW * 0.3], rowHeights=[35]))
    story[-1].setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.4, black), ("LINEBEFORE", (1, 0), (1, 0), 0.4, black), ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    
    story.append(Table([[cp("NATUREZA DA OPERAÇÃO", d.get("natureza_op", "5202 - DEVOLUÇÃO DE COMPRA PARA COMERCIALIZAÇÃO"))]], colWidths=[UW])); story[-1].setStyle(BASE)
    story.append(Table([[cp("INSCRIÇÃO ESTADUAL", emit.get("ie", "261935348")), cp("CNPJ", emit.get("cnpj", "04.002.562/0004-78"))]], colWidths=[UW * 0.5, UW * 0.5])); story[-1].setStyle(BASE)
    
    # ── DESTINATÁRIO ──
    for el in _sec("DESTINATÁRIO / REMETENTE"): story.append(el)
    story.append(Table([[cp("NOME / RAZÃO SOCIAL", dest.get("nome", "")), cp("CNPJ / CPF", dest.get("cnpj_cpf", ""))]], colWidths=[UW * 0.7, UW * 0.3])); story[-1].setStyle(BASE)
    story.append(Table([[cp("ENDEREÇO", dest.get("endereco", "")), cp("BAIRRO", dest.get("bairro", "")), cp("CEP", dest.get("cep", "")), cp("EMISSÃO", d.get("data_emissao", ""))]], colWidths=[UW * 0.45, UW * 0.25, UW * 0.15, UW * 0.15])); story[-1].setStyle(BASE)
    story.append(Table([[cp("MUNICÍPIO", dest.get("municipio", "")), cp("UF", dest.get("uf", "")), cp("IE", dest.get("ie", ""))]], colWidths=[UW * 0.7, UW * 0.1, UW * 0.2])); story[-1].setStyle(BASE)
    
    # ── VALORES ──
    for el in _sec("CÁLCULO DO IMPOSTO"): story.append(el)
    story.append(Table([[
        cp("BASE CÁLCULO ICMS", val.get("base_icms", "0,00")), 
        cp("VALOR ICMS", val.get("valor_icms", "0,00")), 
        cp("BASE ICMS ST", val.get("base_icms_st", "0,00")), 
        cp("VALOR ICMS ST", val.get("valor_icms_st", "0,00")), 
        cp("VLR TOTAL PROD", val.get("total_produtos", "0,00"))
    ]], colWidths=[UW * 0.2]*5)); story[-1].setStyle(BASE)
    story.append(Table([[
        cp("VALOR FRETE", val.get("frete", "0,00")), 
        cp("VALOR SEGURO", val.get("seguro", "0,00")), 
        cp("DESCONTO", val.get("desconto", "0,00")), 
        cp("OUTRAS DESP", val.get("outras_despesas", "0,00")), 
        cp("VALOR IPI", val.get("valor_ipi", "0,00")),
        cp("VLR TOTAL NOTA", val.get("total_nota", "0,00"))
    ]], colWidths=[UW * 0.166]*6)); story[-1].setStyle(BASE)
    
    # ── PRODUTOS ──
    for el in _sec("DADOS DOS PRODUTOS / SERVIÇOS"): story.append(el)
    p_header = [Paragraph(h, S_HPROD) for h in ["CÓD.", "DESCRIÇÃO DOS PRODUTOS", "NCM/SH", "CFOP", "UN", "QTD", "V.UNIT", "V.TOTAL"]]
    rows = [p_header]
    
    # Larguras das colunas: Cod(10%), Desc(38%), NCM(10%), CFOP(8%), UN(6%), Qtd(8%), Unit(10%), Total(10%) = 100%
    p_cols = [UW*0.1, UW*0.38, UW*0.1, UW*0.08, UW*0.06, UW*0.08, UW*0.1, UW*0.1]
    
    for r in prods.get("rows", []):
        p = _mapear_produto(r)
        rows.append([
            Paragraph(p["codigo"], S_CPROD),
            Paragraph(p["descricao"], S_CPROD_L),
            Paragraph(p["ncm"], S_CPROD),
            Paragraph(p["cfop"], S_CPROD),
            Paragraph(p["unidade"], S_CPROD),
            Paragraph(p["quantidade"], S_CPROD_R),
            Paragraph(p["valor_unitario"], S_CPROD_R),
            Paragraph(p["valor_total"], S_CPROD_R)
        ])
    
    if len(rows) > 1:
        pt = Table(rows, colWidths=p_cols, repeatRows=1)
        pt.setStyle(BASE)
        story.append(pt)
    else:
        story.append(Paragraph("<i>Nenhum item encontrado</i>", S_CPROD))

    # ── FOOTER ──
    for el in _sec("DADOS ADICIONAIS"): story.append(el)
    info_text = f"INFORMAÇÕES COMPLEMENTARES:<br/>{info if info else 'ESPELHO NFD - OPERAÇÃO DE DEVOLUÇÃO'}"
    story.append(Table([[Paragraph(info_text, S_INFO)]], colWidths=[UW], rowHeights=[60]))
    story[-1].setStyle(BASE)

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

    # Modo Extração (Padrão) — com 2º argumento posicional, também gera o espelho
    out_json = "--json" in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    pdf_in = args[0]
    pdf_out = args[1] if len(args) > 1 else None
    processar(pdf_in, pdf_out, json_output=out_json)
