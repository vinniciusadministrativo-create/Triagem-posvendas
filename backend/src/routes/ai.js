const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");

// ── REPAIR TRUNCATED JSON ──
function repairJSON(str) {
  let s = str.trim().replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
  const i = s.indexOf("{"); if (i < 0) return null;
  s = s.substring(i);
  try { return JSON.parse(s); } catch (e) { }
  s = s.replace(/,\s*([}\]])/g, "$1");
  let inStr = false;
  for (let j = 0; j < s.length; j++) { if (s[j] === '"' && (j === 0 || s[j - 1] !== '\\')) inStr = !inStr; }
  if (inStr) s += '"';
  s = s.replace(/,\s*"[^"]*"?\s*:?\s*"?[^"{}[\]]*$/, "");
  let stack = [];
  for (let j = 0; j < s.length; j++) { const c = s[j]; if (c === '{') stack.push('}'); else if (c === '[') stack.push(']'); else if (c === '}' || c === ']') stack.pop(); }
  while (stack.length > 0) s += stack.pop();
  s = s.replace(/,\s*([}\]])/g, "$1");
  try { return JSON.parse(s); } catch (e) { return null; }
}

// ── DETERMINISTIC TRIAGE FALLBACK ──
function triageDeterministic(formData) {
  const t = formData.tipoSolicitacao;
  const desc = (formData.descricao || "").toLowerCase();
  const base = { elegivel_devolucao: true, motivo_inelegibilidade: "", escalacao_humana: false, motivo_escalacao: "", observacoes: "" };

  if (desc.includes("personaliz") || desc.includes("tinta na máquina") || desc.includes("tinta na maquina")) {
    if (!desc.includes("erro interno") && !desc.includes("erro de digitação") && !desc.includes("pigmentação errada")) {
      return { ...base, etapa_destino: "encerrado", resumo: "Produto personalizado não elegível para devolução conforme política.", acoes_automaticas: ["Produto personalizado identificado", "Não se enquadra nas condições de devolução"], proximas_etapas: [], precisa_espelho_nfd: false, precisa_recolhimento: false, elegivel_devolucao: false, motivo_inelegibilidade: "Produtos personalizados não são elegíveis." };
    }
  }

  switch (t) {
    case "preco_errado": return { ...base, etapa_destino: "aguardando_financeiro", resumo: "Erro interno de preço identificado.", acoes_automaticas: ["Identificado na descrição"], proximas_etapas: [], precisa_espelho_nfd: false, precisa_recolhimento: false };
    case "produto_avariado": return { ...base, etapa_destino: "espelho", resumo: "Produto avariado — Marin.", acoes_automaticas: ["Espelho NFD gerado automaticamente"], proximas_etapas: ["aguardando_nfd", "aguardando_recolhimento"], precisa_espelho_nfd: true, precisa_recolhimento: true };
    case "produto_defeito": return { ...base, etapa_destino: "espelho", resumo: "Produto com defeito.", acoes_automaticas: ["Espelho NFD gerado"], proximas_etapas: ["aguardando_nfd", "aguardando_recolhimento"], precisa_espelho_nfd: true, precisa_recolhimento: true };
    default: return { ...base, etapa_destino: "avaliacao", resumo: "Avaliação manual recomendada.", acoes_automaticas: ["Chamado registrado"], proximas_etapas: [], precisa_espelho_nfd: false, precisa_recolhimento: false, escalacao_humana: true };
  }
}

// ── POST /api/ai/triage ──
router.post("/triage", authMiddleware(), async (req, res) => {
  const { form, isTest } = req.body;
  const fallback = triageDeterministic(form);

  if (isTest || !process.env.ANTHROPIC_API_KEY) {
    return res.json({ ...fallback, resumo: "[MODO SIMULADO] " + (fallback.resumo || "Processado por regras automáticas.") });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 800,
        messages: [{ role: "user", content: `Triagem Pós-Vendas. Classifique JSON: ${JSON.stringify(form)}` }]
      })
    });

    const data = await response.json();
    const txt = data.content?.[0]?.text || "";
    const parsed = repairJSON(txt);
    res.json(parsed || fallback);
  } catch (e) {
    res.json(fallback);
  }
});

const { extractNFDeterministic } = require("../utils/pythonBridge");
const fs = require("fs");
const path = require("path");
const os = require("os");

// ── POST /api/ai/extract-nf ──
router.post("/extract-nf", authMiddleware(), async (req, res) => {
  const { fileB64, mime, isTest, formData } = req.body;

  // Dados do formulário como fallback para campos não extraídos do PDF
  const fd = formData || {};

  // ── EXTRAÇÃO DETERMINÍSTICA via Python (sempre tenta primeiro para PDFs) ──
  if (mime === "application/pdf" && fileB64) {
    try {
      const tempPath = path.join(os.tmpdir(), `nf_${Date.now()}.pdf`);
      fs.writeFileSync(tempPath, fileB64, "base64");
      const det = await extractNFDeterministic(tempPath);
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

      // ── Pós-processamento: limpar e validar valores ──
      const produtos = (det.produtos?.rows || []).map(r => ({
        codigo:         r[0]  || "",
        descricao:      r[1]  || "",
        ncm:            r[2]  || "",
        cst:            r[3]  || "",
        cfop:           "5202", // FORÇADO AUTOMATICAMENTE conforme pedido
        unidade:        r[5]  || "UN",
        quantidade:     r[6]  || "0",
        valor_unitario: r[7]  || "0,00",
        valor_total:    r[10] || "0,00"
      }));

      // Calcular total dos produtos a partir dos itens quando valor não extraído
      const parseBR = v => parseFloat((v || "0").replace(/\./g,"").replace(",",".")) || 0;
      const calcTotalProd = produtos.reduce((s, p) => s + parseBR(p.valor_total), 0);
      const fmtBR = n => n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

      const totalProd = parseBR(det.valores?.total_produtos) || calcTotalProd;
      const totalNota = parseBR(det.valores?.total_nota) || totalProd; // fallback: total da nota = total dos produtos

      // Detectar strings inválidas do PDF (quando o regex pega o cabeçalho em vez do valor)
      const INVALIDOS = ["bairro", "distrito", "cnpj", "cpf", "protocolo", "data da", "endereço", "inscrição", "município", "fone", "telefone"];
      const isValido = (v) => {
        if (!v) return false;
        const val = v.toLowerCase().trim();
        // Só é inválido se for EXATAMENTE um dos cabeçalhos ou se for muito curto
        if (INVALIDOS.some(inv => val === inv || val === inv + ":")) return false;
        if (val.length < 2) return false;
        return true;
      };

      // Natureza: validar que não é um cabeçalho
      const natureza = (det.natureza_op && isValido(det.natureza_op) && det.natureza_op.length < 100)
        ? det.natureza_op
        : (fd.naturezaOperacao || "5202 - DEVOLUÇÃO DE COMPRA PARA COMERCIALIZAÇÃO");

      // Retornar JSON com prioridade para dados extraídos do PDF
      return res.json({
        numero_nf:            det.numero            || fd.nfOriginal  || "",
        data_emissao:         det.data_emissao       || "",
        natureza_operacao:    natureza,
        valor_total_nota:     fmtBR(totalNota),
        valor_total_produtos: fmtBR(totalProd),
        base_icms:            det.valores?.base_icms      || "0,00",
        valor_icms:           det.valores?.valor_icms     || "0,00",
        base_icms_st:         det.valores?.base_icms_st   || "0,00",
        valor_icms_st:        det.valores?.valor_icms_st  || "0,00",
        valor_frete:          det.valores?.frete          || "0,00",
        valor_seguro:         det.valores?.seguro         || "0,00",
        valor_ipi:            det.valores?.valor_ipi      || "0,00",
        peso_bruto:           det.transporte?.peso_bruto  || "0,00",
        peso_liquido:         det.transporte?.peso_liquido|| "0,00",
        quantidade_volumes:   det.transporte?.quantidade  || "0",
        especie_volumes:      det.transporte?.especie     || "",
        
        // Destinatário: PDF primeiro, Form segundo
        cliente:              (det.destinatario?.nome && isValido(det.destinatario.nome)) ? det.destinatario.nome : (fd.razaoSocial || ""),
        razao_social_dest:    (det.destinatario?.nome && isValido(det.destinatario.nome)) ? det.destinatario.nome : (fd.razaoSocial || ""),
        cnpj:                 (det.destinatario?.cnpj_cpf && isValido(det.destinatario.cnpj_cpf)) ? det.destinatario.cnpj_cpf : (fd.cnpj || ""),
        cnpj_dest:            (det.destinatario?.cnpj_cpf && isValido(det.destinatario.cnpj_cpf)) ? det.destinatario.cnpj_cpf : (fd.cnpj || ""),
        endereco_dest:        isValido(det.destinatario?.endereco) ? det.destinatario.endereco : "",
        bairro_dest:          isValido(det.destinatario?.bairro)   ? det.destinatario.bairro   : "",
        cep_dest:             isValido(det.destinatario?.cep)      ? det.destinatario.cep      : "",
        municipio_dest:       isValido(det.destinatario?.municipio) ? det.destinatario.municipio : "",
        uf_dest:              isValido(det.destinatario?.uf)        ? det.destinatario.uf        : "",
        
        produtos,
        isDeterministic: true
      });
    } catch (e) {
      console.warn("Extração determinística falhou, usando fallback...", e.message);
    }
  }

  // ── Fallback: dados de teste ou IA ──
  if (isTest || !process.env.ANTHROPIC_API_KEY) {
    return res.json({ numero_nf: "998877", razao_social_dest: "LOJA TESTE LTDA", produtos: [{ descricao: "PRODUTO TESTE", quantidade: "10" }], valor_total_nota: "1.000,00" });
  }

  try {
    const ct = mime.startsWith("image/") ? "image" : "document";
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            { type: ct, source: { type: "base64", media_type: mime, data: fileB64 } },
            { type: "text", text: "Extraia TODOS os dados desta NF em JSON puro. É mandatório extrair TODOS os itens da tabela de produtos, sem resumir ou omitir nenhum. Retorne campos: numero_nf, data_emissao, natureza_operacao, valor_total_nota, valor_total_produtos, base_icms, valor_icms, base_icms_st, valor_icms_st, valor_frete, valor_seguro, valor_ipi, peso_bruto, peso_liquido, quantidade_volumes, especie_volumes, cliente (razao social), cnpj, endereco_dest, bairro_dest, cep_dest, e a lista de 'produtos' contendo: codigo, descricao, ncm, cst, cfop, unidade, quantidade, valor_unitario, valor_total." }
          ]
        }]
      })
    });

    const data = await response.json();
    const txt = data.content?.[0]?.text || "";
    res.json(repairJSON(txt) || { error: "Falha na extração" });
  } catch (e) {
    res.status(500).json({ error: "Erro na API de IA" });
  }
});

// ── POST /api/ai/analyze-evidence ──
router.post("/analyze-evidence", authMiddleware(), async (req, res) => {
  const { images, isTest } = req.body; // images: [{b64, mime}]

  if (isTest || !process.env.ANTHROPIC_API_KEY) {
    return res.json({ resumo_evidencias: "[SIMULADO] Fotos mostram dano na embalagem.", estado_produto: "Avariado", responsabilidade_sugerida: "Marin", pontos_observados: ["Amassado lateral"], grau_confianca: "Alto" });
  }

  try {
    const imgContent = images.map(img => ({ type: "image", source: { type: "base64", media_type: img.mime, data: img.b64 } }));
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 800,
        messages: [{
          role: "user",
          content: [
            ...imgContent,
            { type: "text", text: "Analise estas fotos de evidência e retorne JSON: {resumo_evidencias, estado_produto, responsabilidade_sugerida, pontos_observados:[], grau_confianca}" }
          ]
        }]
      })
    });

    const data = await response.json();
    const txt = data.content?.[0]?.text || "";
    res.json(repairJSON(txt) || { error: "Falha na análise" });
  } catch (e) {
    res.status(500).json({ error: "Erro na IA" });
  }
});

module.exports = router;
