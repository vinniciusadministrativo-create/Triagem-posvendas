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
    case "produto_avariado": return { ...base, etapa_destino: "avaliacao", resumo: "Produto avariado — encaminhado para avaliação.", acoes_automaticas: ["Chamado registrado", "Encaminhado para avaliação operacional"], proximas_etapas: ["avaliado"], precisa_espelho_nfd: false, precisa_recolhimento: false };
    case "produto_defeito": return { ...base, etapa_destino: "espelho", resumo: "Produto com defeito.", acoes_automaticas: ["Espelho NFD gerado"], proximas_etapas: ["aguardando_nfd", "aguardando_recolhimento"], precisa_espelho_nfd: true, precisa_recolhimento: true };
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

      // ── Pós-processamento: limpar e validar valores ──
      const produtos = (det.produtos?.rows || []).map(r => {
        const len = r.length;
        // Se a linha tem ~9 colunas (como no print do usuário), o total costuma ser a última ou penúltima.
        // Índice 10 pode estar fora do range ou ser imposto em tabelas menores.
        const totalIdx = len >= 11 ? 10 : (len >= 9 ? 8 : len - 1);
        const unitIdx  = len >= 11 ? 7  : (len >= 9 ? 7 : len - 2);
        
        return {
          codigo:         r[0]  || "",
          descricao:      r[1]  || "",
          ncm:            r[2]  || "",
          cst:            r[3]  || "",
          cfop:           "5202",
          unidade:        r[5]  || "UN",
          quantidade:     r[6]  || "0",
          valor_unitario: r[unitIdx]  || "0,00",
          valor_total:    r[totalIdx] || "0,00"
        };
      });

      // Calcular total dos produtos a partir dos itens quando valor não extraído
      const parseBR = v => parseFloat((v || "0").replace(/\./g,"").replace(",",".")) || 0;
      const calcTotalProd = produtos.reduce((s, p) => s + parseBR(p.valor_total), 0);
      const fmtBR = n => n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

      const totalProd = parseBR(det.valores?.total_produtos) || calcTotalProd;
      const totalNota = parseBR(det.valores?.total_nota) || totalProd; // fallback: total da nota = total dos produtos

      // Detectar strings inválidas do PDF (quando o regex pega o cabeçalho em vez do valor)
      const INVALIDOS = ["bairro", "distrito", "cnpj", "cpf", "protocolo", "data da", "endereço", "inscrição", "município", "fone", "telefone", "emissão", "saída", "entrada"];
      const isValido = (v) => {
        if (!v) return false;
        const val = v.toLowerCase().trim();
        // Se a string contiver muitos termos de cabeçalho ou for muito curta, é provável que seja lixo do PDF
        if (INVALIDOS.some(inv => val.includes(inv))) {
          // Exceção: se for um endereço legítimo que contém "Bairro" mas também tem números, pode ser válido
          // Mas aqui os exemplos mostrados ("BAIRRO / DISTRITO") são puramente cabeçalhos
          if (val.length < 30 && INVALIDOS.filter(inv => val.includes(inv)).length >= 1) return false;
        }
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
