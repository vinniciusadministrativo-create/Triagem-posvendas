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
  const { fileB64, mime, isTest } = req.body;

  // ── EXTRAÇÃO DETERMINÍSTICA via Python (sempre tenta primeiro para PDFs) ──
  if (mime === "application/pdf" && fileB64) {
    try {
      const tempPath = path.join(os.tmpdir(), `nf_${Date.now()}.pdf`);
      fs.writeFileSync(tempPath, fileB64, "base64");
      const det = await extractNFDeterministic(tempPath);
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

      return res.json({
        numero_nf: det.numero,
        data_emissao: det.data_emissao,
        natureza_operacao: det.natureza_op,
        valor_total_nota: det.valores?.total_nota || "0,00",
        valor_total_produtos: det.valores?.total_produtos || "0,00",
        base_icms: det.valores?.base_icms || "0,00",
        valor_icms: det.valores?.valor_icms || "0,00",
        base_icms_st: det.valores?.base_icms_st || "0,00",
        valor_icms_st: det.valores?.valor_icms_st || "0,00",
        valor_frete: det.valores?.frete || "0,00",
        valor_seguro: det.valores?.seguro || "0,00",
        valor_ipi: det.valores?.valor_ipi || "0,00",
        peso_bruto: det.transporte?.peso_bruto || "0,00",
        peso_liquido: det.transporte?.peso_liquido || "0,00",
        quantidade_volumes: det.transporte?.quantidade || "0",
        especie_volumes: det.transporte?.especie || "",
        cliente: det.destinatario?.nome || "",
        razao_social_dest: det.destinatario?.nome || "",
        cnpj: det.destinatario?.cnpj_cpf || "",
        endereco_dest: det.destinatario?.endereco || "",
        bairro_dest: det.destinatario?.bairro || "",
        cep_dest: det.destinatario?.cep || "",
        produtos: (det.produtos?.rows || []).map(r => ({
          codigo: r[0],
          descricao: r[1],
          ncm: r[2],
          cst: r[3],
          cfop: r[4],
          unidade: r[5],
          quantidade: r[6],
          valor_unitario: r[7],
          valor_total: r[10]
        })),
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
