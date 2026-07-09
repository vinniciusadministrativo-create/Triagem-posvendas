const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");

// ── REPAIR TRUNCATED JSON ──
/**
 * Tenta parsear uma string JSON possivelmente malformada ou truncada.
 * Remove cercas markdown (```json), descarta lixo antes do primeiro `{`,
 * fecha aspas/colchetes/chaves pendentes e remove vírgulas finais.
 *
 * @param {string} str Texto a ser interpretado como JSON.
 * @returns {object|null} Objeto parseado, ou `null` se não for recuperável.
 */
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
/**
 * Classifica um chamado de pós-vendas por regras de negócio (sem IA), aplicando a
 * política de devoluções: define o estágio de destino, elegibilidade, necessidade
 * de espelho NFD/recolhimento e se exige escalação humana.
 *
 * @param {object} formData Dados do formulário do chamado.
 * @param {string} formData.tipoSolicitacao Tipo da solicitação (um dos 7 tipos).
 * @param {string} [formData.descricao] Descrição livre (analisada por palavras-chave).
 * @returns {{
 *   etapa_destino: string, resumo: string, acoes_automaticas: string[],
 *   proximas_etapas: string[], precisa_espelho_nfd: boolean, precisa_recolhimento: boolean,
 *   escalacao_humana: boolean, motivo_escalacao: string,
 *   elegivel_devolucao: boolean, motivo_inelegibilidade: string, observacoes: string
 * }} Resultado da triagem (gravado em `chamados.triage_result`).
 */
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
    case "produto_avariado": return { ...base, etapa_destino: "avaliacao", resumo: "Produto avariado — encaminhado para avaliação.", acoes_automaticas: ["Chamado registrado", "Encaminhado para avaliação operacional"], proximas_etapas: ["avaliado"], precisa_espelho_nfd: false, precisa_recolhimento: false };
    case "produto_defeito": return { ...base, etapa_destino: "avaliacao", resumo: "Produto com defeito — encaminhado para avaliação.", acoes_automaticas: ["Chamado registrado", "Encaminhado para avaliação operacional"], proximas_etapas: ["avaliado"], precisa_espelho_nfd: false, precisa_recolhimento: false };
    default: return { ...base, etapa_destino: "avaliacao", resumo: "Avaliação manual recomendada.", acoes_automaticas: ["Chamado registrado"], proximas_etapas: [], precisa_espelho_nfd: false, precisa_recolhimento: false, escalacao_humana: true };
  }
}

// ── POST /api/ai/triage ──
router.post("/triage", authMiddleware(), async (req, res) => {
  const { form } = req.body;
  const fallback = triageDeterministic(form);
  // IA Desligada - Usando apenas regras determinísticas
  return res.json(fallback);
});

const { extractNFDeterministic } = require("../utils/pythonBridge");
const { cleanAndFormatNfData } = require("../utils/nfData");
const { processarQrCodeImagem } = require("../utils/qrDecoder");
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

      // Pós-processamento centralizado em utils/nfData.js (compartilhado com o
      // reprocessamento e a auto-extração em routes/chamados.js).
      return res.json(cleanAndFormatNfData(det, fd));
    } catch (e) {
      console.warn("Extração determinística falhou, usando fallback...", e.message);
    }
  }

  // ── Tentativa de Leitura de QR Code (Assistente para Transcrição Manual) ──
  let qrDataParsed = null;
  if (fileB64 && mime.startsWith("image/")) {
    try {
      qrDataParsed = await processarQrCodeImagem(fileB64);
    } catch (e) {
      console.warn("Falha ao processar QR Code:", e.message);
    }
  }

  // ── Fallback: Extração Manual Necessária ──
  // Como a IA foi desligada, retornamos flags para digitação manual, pré-preenchendo com dados do QR Code se encontrados.
  return res.json({ 
    numero_nf: qrDataParsed?.numero || fd.nfOriginal || "", 
    data_emissao: qrDataParsed?.data_emissao || "",
    chave_acesso: qrDataParsed?.chave_acesso || "",
    cnpj_emitente: qrDataParsed?.cnpj_emitente || "",
    razao_social_dest: fd.razaoSocial || "", 
    cnpj_dest: fd.cnpj || "",
    produtos: [], 
    valor_total_nota: "0,00",
    manual_required: true,
    isDeterministic: false
  });
});

// ── POST /api/ai/analyze-evidence ──
router.post("/analyze-evidence", authMiddleware(), async (req, res) => {
  // IA Desligada - Retorna pendência de análise humana
  return res.json({ 
    resumo_evidencias: "Análise visual pendente pelo Backoffice.", 
    estado_produto: "Aguardando Avaliação Manual", 
    responsabilidade_sugerida: "Não definida", 
    pontos_observados: ["Fotos recebidas"], 
    grau_confianca: "Manual" 
  });
});

module.exports = router;
