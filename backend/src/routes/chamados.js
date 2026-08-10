const express = require("express");
const multer = require("multer");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const os = require("os");
const pool = require("../db");
const authMiddleware = require("../middleware/auth");
const { generatePDFFromJSON } = require("../utils/pythonBridge");
const { sendStatusUpdateEmail } = require("../utils/mailer");
const { canAccessChamadoRow, canAccessChamadoById } = require("../utils/chamadoAccess");
const cloudinary = require("cloudinary").v2;

const router = express.Router();

// Configuração do Cloudinary — credenciais OBRIGATORIAMENTE via variáveis de ambiente
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error("❌ ERRO: Variáveis de ambiente do Cloudinary não configuradas (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)");
  process.exit(1);
}
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Formatos aceitos nos anexos (NF, evidências, ressalva e chat do chamado).
// HEIC/HEIF ficam de fora de propósito: o `sharp` empacotado não decodifica HEIF,
// então a leitura de QR Code da NF falharia. A mensagem de erro orienta a troca.
const ALLOWED_MIMES = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf",
  "video/mp4", "video/quicktime", "video/x-msvideo",
];
const MAX_FILE_MB = 20;

/**
 * Filtro de upload que REJEITA COM ERRO os formatos não suportados.
 *
 * Antes respondia `cb(null, false)`, que descarta o arquivo em silêncio: o
 * chamado era criado sem a NF (`nf_file_path = null`) e o vendedor recebia
 * "sucesso". Fotos de iPhone (HEIC) caíam exatamente nesse buraco. Agora o
 * erro sobe para o handler no fim deste router e vira 415 com mensagem clara.
 */
function fileFilter(req, file, cb) {
  if (ALLOWED_MIMES.includes(file.mimetype)) return cb(null, true);

  const tipo = file.mimetype || "tipo desconhecido";
  const heic = /hei[cf]/i.test(tipo) || /\.hei[cf]$/i.test(file.originalname || "");
  const err = new Error(
    heic
      ? `"${file.originalname}" está em HEIC, formato que o sistema não lê. No iPhone: Ajustes › Câmera › Formatos › "Mais Compatível", ou reenvie o arquivo como JPG/PDF.`
      : `Formato não suportado em "${file.originalname}" (${tipo}). Envie PDF, JPG, PNG, WEBP, GIF ou vídeo MP4/MOV.`
  );
  err.code = "UNSUPPORTED_FILE_TYPE";
  cb(err);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024 },
  fileFilter,
});

// Fuso da operação — os relatórios recortam o período por ele (ver routes/relatorios.js).
const TZ_OPERACAO = "America/Sao_Paulo";

// Etapas anteriores à coleta: nelas a data REAL de recolhimento não pode existir.
const ETAPAS_PRE_COLETA = ["novo", "avaliacao", "avaliado", "espelho", "aguardando_nfd"];

/** Data de hoje (AAAA-MM-DD) no fuso da operação. */
function hojeISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ_OPERACAO });
}

/**
 * Valida e normaliza uma das datas de recolhimento vindas do corpo da requisição.
 *
 * Regras: formato `AAAA-MM-DD`, data existente no calendário e não anterior à
 * abertura do chamado (nem previsão nem coleta acontecem antes do chamado existir).
 *
 * @param {*} valor Valor cru do body. `undefined` = campo não enviado; vazio = limpar.
 * @param {string} campo Nome do campo para a mensagem de erro.
 * @param {string|null} aberturaISO Data de abertura já em `AAAA-MM-DD` (fuso da operação).
 * @returns {{skip?: true, value?: string|null, error?: string}}
 */
function normalizaDataRecolhimento(valor, campo, aberturaISO) {
  if (valor === undefined) return { skip: true };
  if (!valor) return { value: null };

  const s = String(valor).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return { error: `${campo}: formato inválido (use AAAA-MM-DD).` };
  }
  // Round-trip pega datas inexistentes (ex.: 2026-02-30).
  const d = new Date(`${s}T00:00:00Z`);
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
    return { error: `${campo}: data inexistente no calendário.` };
  }

  if (aberturaISO && s < aberturaISO) {
    const br = aberturaISO.split("-").reverse().join("/");
    return { error: `${campo}: não pode ser anterior à abertura do chamado (${br}).` };
  }
  return { value: s };
}

/**
 * Mapeia o mimetype de um arquivo para o `resource_type` do Cloudinary.
 *
 * @param {string} mimetype Mimetype do arquivo (ex.: `image/png`, `video/mp4`).
 * @returns {'image'|'video'|'raw'} Tipo de recurso ('raw' para PDFs e demais documentos).
 */
function resolveResourceType(mimetype) {
  if (!mimetype) return 'raw';
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  return 'raw'; // PDFs e outros documentos
}

/**
 * Faz upload de um buffer para o Cloudinary (pasta `triagem_posvendas`),
 * resolvendo o `resource_type` a partir do mimetype. O buffer é convertido para
 * data URI base64 antes do envio.
 *
 * @param {Buffer} buffer Conteúdo binário do arquivo.
 * @param {object} [options={}] Opções extras do upload (ex.: `public_id`). `resource_type` é ignorado (derivado do mimetype).
 * @param {string} [mimetype='application/octet-stream'] Mimetype do arquivo.
 * @returns {Promise<object>} Resultado do Cloudinary (inclui `secure_url`).
 * @throws Repassa o erro do Cloudinary em caso de falha no upload.
 */
async function uploadToCloudinary(buffer, options = {}, mimetype = 'application/octet-stream') {
  const resource_type = resolveResourceType(mimetype);
  const { resource_type: _ignored, ...rest } = options;
  try {
    const b64 = buffer.toString('base64');
    const result = await cloudinary.uploader.upload(
      `data:${mimetype};base64,${b64}`,
      { folder: 'triagem_posvendas', resource_type, ...rest }
    );
    return result;
  } catch (err) {
    console.error("[Cloudinary] upload error:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
    throw err;
  }
}

// GET /api/chamados/diag-cloudinary — diagnóstico de conexão (admin only)
router.get("/diag-cloudinary", authMiddleware(["admin"]), async (req, res) => {
  const cfg = cloudinary.config();
  const info = {
    cloud_name: cfg.cloud_name,
    api_key: cfg.api_key,
    secret_len: cfg.api_secret?.length,
    secret_start: cfg.api_secret?.substring(0, 4),
    cloudinary_url_env: !!process.env.CLOUDINARY_URL,
  };

  let pingResult;
  try { pingResult = { ok: true, ...(await cloudinary.api.ping()) }; }
  catch (e) { pingResult = { ok: false, error: e.message, http_code: e.http_code }; }

  const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const tryUpload = async (opts) => {
    try {
      const r = await cloudinary.uploader.upload(`data:image/png;base64,${tinyPng}`, { public_id: `diag_${Date.now()}`, ...opts });
      return { ok: true, url: r.secure_url };
    } catch (e) { return { ok: false, error: e.message, http_code: e.http_code, name: e.name }; }
  };

  const [uploadDefault, uploadImage, uploadAuto] = await Promise.all([
    tryUpload({}),
    tryUpload({ resource_type: 'image' }),
    tryUpload({ resource_type: 'auto' }),
  ]);

  // Raw HTTPS test — mostra o body real da resposta 403
  const rawTest = await new Promise((resolve) => {
    const crypto = require('crypto');
    const https = require('https');
    const qs = require('querystring');
    const ts = Math.floor(Date.now() / 1000);
    const folder = 'triagem_diag';
    const public_id = `raw_${ts}`;
    const sigStr = `folder=${folder}&public_id=${public_id}&timestamp=${ts}`;
    const signature = crypto.createHash('sha1').update(sigStr + cfg.api_secret).digest('hex');
    const body = qs.stringify({ file: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`, timestamp: String(ts), api_key: cfg.api_key, signature, folder, public_id });
    const req = https.request({ hostname: 'api.cloudinary.com', path: `/v1_1/${cfg.cloud_name}/image/upload`, method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } }, (r) => {
      let data = '';
      r.on('data', c => data += c);
      r.on('end', () => resolve({ status: r.statusCode, headers: r.headers, body: data.substring(0, 1000) }));
    });
    req.on('error', e => resolve({ error: e.message }));
    req.write(body);
    req.end();
  });

  res.json({ config: info, ping: pingResult, uploadDefault, uploadImage, uploadAuto, rawTest });
});

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// GET /api/chamados/meus — usuário vê seus próprios e os compartilhados
router.get("/meus", authMiddleware(["vendedor", "pos_vendas", "admin"]), async (req, res) => {
  try {
    const { page = 1, limit = 20, exclude_old_encerrados } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = `(c.vendedor_id = $1 OR s.user_id = $1)`;
    if (exclude_old_encerrados === "true") {
       whereClause += ` AND NOT (c.status = 'encerrado' AND c.updated_at < NOW() - INTERVAL '3 days')`;
    }

    const { rows } = await pool.query(
      `SELECT c.*, u.name as vendedor_nome,
       (SELECT COUNT(id) FROM chamado_mensagens m WHERE m.chamado_id = c.id) as mensagens_count
       FROM chamados c
       LEFT JOIN users u ON c.vendedor_id = u.id
       LEFT JOIN chamado_shares s ON c.id = s.chamado_id
       WHERE ${whereClause}
       GROUP BY c.id, u.name
       ORDER BY c.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );
    const countRes = await pool.query(
      `SELECT COUNT(DISTINCT c.id) 
       FROM chamados c 
       LEFT JOIN chamado_shares s ON c.id = s.chamado_id 
       WHERE ${whereClause}`,
      [req.user.id]
    );
    res.json({ chamados: rows, total: parseInt(countRes.rows[0].count) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao buscar chamados" });
  }
});

// Rota legada GET /file/:filename removida: `uploadDir` nunca foi declarado
// (causava ReferenceError/500) e os arquivos hoje ficam no Cloudinary (URLs https
// completas em nf_file_path/evidence_paths). Servir disco aqui também abria risco
// de path traversal. O frontend usa diretamente a secure_url do Cloudinary.

// POST /api/chamados — criação (vendedor, pos_vendas, admin)
router.post(
  "/",
  authMiddleware(["vendedor", "pos_vendas", "admin"]),
  upload.fields([{ name: "nf_file", maxCount: 1 }, { name: "evidence_files", maxCount: 6 }]),
  async (req, res) => {
    try {
      const {
        codigo, razaoSocial, cnpj, nomeVendedor, telefone,
        emailVendedor, tipoSolicitacao, descricao, nfOriginal, responsavel,
        triage_result, nf_data, evidence_result, ressalva_vendedor,
        // suporte aos dois formatos de campo (snake_case e camelCase)
        codigo_cliente, razao_social, nome_vendedor,
        email_vendedor, tipo_solicitacao, nf_original,
      } = req.body;

     const nfFileRaw = req.files?.nf_file?.[0];
     let nfFile = null;
if (nfFileRaw) {
  try {
    nfFile = await uploadToCloudinary(nfFileRaw.buffer, {
      resource_type: 'auto',
      public_id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }, nfFileRaw.mimetype);
  } catch (uploadErr) {
    console.error("Erro upload NF:", uploadErr?.message, JSON.stringify(uploadErr));
    return res.status(500).json({ error: "Falha ao enviar a Nota Fiscal. Verifique o arquivo e tente novamente." });
  }
}
    const evFilesRaw = req.files?.evidence_files || [];
      let evFiles = [];
if (evFilesRaw.length) {
  try {
    evFiles = await Promise.all(evFilesRaw.map(f => uploadToCloudinary(f.buffer, {
      resource_type: 'auto',
      public_id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }, f.mimetype)));
  } catch (uploadErr) {
    console.error("Erro upload evidências:", uploadErr?.message, JSON.stringify(uploadErr));
    return res.status(500).json({ error: "Falha ao enviar os arquivos de evidência. Tente novamente." });
  }
}

      const triageObj = triage_result ? JSON.parse(triage_result) : {};
      const cleanCnpj = cnpj ? cnpj.toString().replace(/\D/g, '') : null;

      const { rows } = await pool.query(
        `INSERT INTO chamados (
          vendedor_id, codigo_cliente, razao_social, cnpj, nome_vendedor,
          telefone, email_vendedor, tipo_solicitacao, descricao, nf_original,
          responsavel, triage_result, nf_data, evidence_result, status,
          etapa_destino, nf_file_path, evidence_paths, ressalva_vendedor
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
        RETURNING *`,
        [
          req.user.id,
          codigo_cliente || codigo,
          razao_social || razaoSocial,
          cleanCnpj,
          nome_vendedor || nomeVendedor,
          telefone,
          email_vendedor || emailVendedor,
          tipo_solicitacao || tipoSolicitacao,
          descricao,
          nf_original || nfOriginal,
          responsavel,
          triage_result ? triageObj : null,
          nf_data ? JSON.parse(nf_data) : null,
          evidence_result ? JSON.parse(evidence_result) : null,
          triageObj.etapa_destino || "novo",
          triageObj.etapa_destino || "novo",
          nfFile ? nfFile.secure_url : null,
          evFiles.length ? evFiles.map(f => f.secure_url) : null,
          ressalva_vendedor || null,
        ]
      );

      res.status(201).json({ chamado: rows[0] });
    } catch (e) {
      console.error("Erro ao salvar chamado:", e?.message, e?.stack);
      res.status(500).json({ error: "Erro ao salvar chamado" });
    }
  }
);

// POST /api/chamados/:id/share — compartilha chamado com outro usuário
router.post("/:id/share", authMiddleware(["vendedor", "pos_vendas", "admin"]), async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: "ID do usuário é obrigatório" });
    
    // Verifica se o chamado existe e se o usuário logado tem permissão (dono ou admin)
    const { rows: ch } = await pool.query("SELECT * FROM chamados WHERE id = $1", [req.params.id]);
    if (!ch[0]) return res.status(404).json({ error: "Chamado não encontrado" });
    
    if (req.user.role !== "admin" && ch[0].vendedor_id !== req.user.id) {
      return res.status(403).json({ error: "Apenas o dono do chamado pode compartilhar" });
    }

    await pool.query(
      "INSERT INTO chamado_shares (chamado_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [req.params.id, user_id]
    );
    res.json({ message: "Chamado compartilhado com sucesso" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao compartilhar chamado" });
  }
});

// GET /api/chamados — pos_vendas/admin/operacional lista com filtros
router.get("/", authMiddleware(["pos_vendas", "admin", "operacional"]), async (req, res) => {
  try {
    const { status, tipo, vendedor_id, from, to, page = 1, limit = 20, exclude_old_encerrados } = req.query;
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (status) { params.push(status); conditions.push(`c.status = $${params.length}`); }
    if (tipo) { params.push(tipo); conditions.push(`c.tipo_solicitacao = $${params.length}`); }
    if (vendedor_id) { params.push(vendedor_id); conditions.push(`c.vendedor_id = $${params.length}`); }
    if (from) { params.push(from); conditions.push(`c.created_at >= $${params.length}`); }
    if (to) { params.push(to); conditions.push(`c.created_at <= $${params.length}`); }
    if (exclude_old_encerrados === "true") {
      conditions.push(`NOT (c.status = 'encerrado' AND c.updated_at < NOW() - INTERVAL '3 days')`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit, offset);

    const { rows } = await pool.query(
      `SELECT c.*, u.name as vendedor_nome,
       (SELECT COUNT(id) FROM chamado_mensagens m WHERE m.chamado_id = c.id) as mensagens_count
       FROM chamados c
       LEFT JOIN users u ON c.vendedor_id = u.id
       ${where}
       ORDER BY c.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countRes = await pool.query(`SELECT COUNT(*) FROM chamados c ${where}`, params.slice(0, -2));
    res.json({ chamados: rows, total: parseInt(countRes.rows[0].count) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao buscar chamados" });
  }
});

// GET /api/chamados/:id — detalhe
router.get("/:id", authMiddleware(), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, u.name as vendedor_nome
       FROM chamados c LEFT JOIN users u ON c.vendedor_id = u.id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Chamado não encontrado" });
    // vendedor: acessa apenas chamados próprios OU compartilhados com ele
    if (!(await canAccessChamadoRow(req.user, rows[0])))
      return res.status(403).json({ error: "Acesso negado" });
    res.json({ chamado: rows[0] });
  } catch (e) {
    res.status(500).json({ error: "Erro ao buscar chamado" });
  }
});

// PATCH /api/chamados/:id/status — pos_vendas/admin/operacional atualiza etapa
router.patch("/:id/status", authMiddleware(["pos_vendas", "admin", "operacional"]), async (req, res) => {
  try {
    const { status, recolhimento_data, data_previsao_recolhimento, data_real_recolhimento, encerramento_data } = req.body;
    if (!status) return res.status(400).json({ error: "Status obrigatório" });

    // Busca dados atuais para histórico, e-mail e validação das datas.
    // As datas vêm como TEXT já normalizado pelo Postgres: `created_at` é
    // TIMESTAMPTZ e converter em JS usaria UTC, deslocando a data de abertura de
    // chamados criados à noite; e o driver interpreta colunas DATE no fuso do
    // processo. Formatar no banco elimina os dois deslocamentos.
    const oldRes = await pool.query(
      `SELECT status, email_vendedor, nome_vendedor, razao_social, nf_data, nf_file_path,
              (created_at AT TIME ZONE $2)::date::text AS abertura_data,
              data_real_recolhimento::text             AS real_atual
         FROM chamados WHERE id = $1`,
      [req.params.id, TZ_OPERACAO]
    );
    if (!oldRes.rows[0]) return res.status(404).json({ error: "Chamado não encontrado" });
    const oldRow = oldRes.rows[0];
    const oldStatus = oldRow.status;

    // ── Datas de recolhimento: validação de coerência ────────────────────────
    // Essas duas datas alimentam TODOS os indicadores de SLA dos relatórios —
    // um valor incoerente aqui contamina o dashboard inteiro. Os
    // <input type="date"> da UI não barram nenhum dos casos abaixo, então a
    // validação tem de ser aqui.
    const prevN = normalizaDataRecolhimento(data_previsao_recolhimento, "Data de previsão de recolhimento", oldRow.abertura_data);
    const realN = normalizaDataRecolhimento(data_real_recolhimento, "Data real de recolhimento", oldRow.abertura_data);
    const erroData = prevN.error || realN.error;
    if (erroData) return res.status(400).json({ error: erroData });

    // Data real registra um fato consumado — não pode estar no futuro.
    if (realN.value && realN.value > hojeISO()) {
      return res.status(400).json({ error: "Data real de recolhimento não pode estar no futuro." });
    }

    // Data real só faz sentido a partir da etapa de coleta. Só bloqueia quando o
    // valor está sendo introduzido/alterado — reabrir um chamado já recolhido
    // (a UI reenvia a data atual em toda mudança de status) continua funcionando.
    if (realN.value && realN.value !== oldRow.real_atual && ETAPAS_PRE_COLETA.includes(status)) {
      return res.status(400).json({
        error: `Data real de recolhimento não se aplica à etapa "${status}" — o recolhimento ainda não ocorreu.`,
      });
    }

    // ── Encerramento: resolução + descrição obrigatórias ao mover p/ "encerrado" ──
    // Validado no servidor (não só na UI), sanitizado e carimbado com autor/data.
    let encToStore;
    if (status === "encerrado" && oldStatus !== "encerrado") {
      const enc = encerramento_data || {};
      const resolucaoOk = enc.resolucao === "atendido" || enc.resolucao === "indeferido";
      const descricao = typeof enc.descricao === "string" ? enc.descricao.trim() : "";
      if (!resolucaoOk || !descricao) {
        return res.status(400).json({ error: "Encerramento requer resolução (atendido/indeferido) e descrição." });
      }
      encToStore = { resolucao: enc.resolucao, descricao, encerrado_por: req.user.id, encerrado_por_nome: req.user.name, encerrado_em: new Date().toISOString() };
    }

    // ── Auto-extração do espelho ──
    // Ao mover para "espelho" sem nf_data utilizável, baixa o PDF já anexado
    // (Cloudinary, resource_type 'raw') e extrai os dados automaticamente.
    // Best-effort: falha aqui não bloqueia a mudança de status.
    // Quando não há como extrair (sem PDF ou extração falhou) e não existem
    // dados prévios, grava { manual_required: true } para a UI exibir o aviso
    // de transcrição manual em vez de um espelho vazio.
    let autoNfData = null;
    let espelhoGerado = false;
    let curNfData = oldRow.nf_data;
    if (typeof curNfData === "string") { try { curNfData = JSON.parse(curNfData); } catch { curNfData = null; } }
    const fileUrl = oldRow.nf_file_path || "";
    const isPdfUrl = /^https?:\/\//i.test(fileUrl) && (/\.pdf(\?|$)/i.test(fileUrl) || fileUrl.includes("/raw/upload/"));
    if (status === "espelho" && (!curNfData || curNfData.manual_required)) {
      if (isPdfUrl) {
        const tempPath = path.join(os.tmpdir(), `nf_auto_${Date.now()}.pdf`);
        try {
          const dl = await axios.get(fileUrl, { responseType: "arraybuffer", timeout: 30000, maxContentLength: 20 * 1024 * 1024 });
          fs.writeFileSync(tempPath, dl.data);
          const rawDet = await extractNFDeterministic(tempPath);
          autoNfData = cleanAndFormatNfData(rawDet);
          autoNfData.manual_required = false;
          espelhoGerado = true;
        } catch (e) {
          console.warn(`Auto-extração do espelho falhou (chamado ${req.params.id}):`, e.message);
          // Preserva dados prévios (ex.: pré-preenchimento via QR Code); só
          // sinaliza a pendência quando não há nada gravado.
          if (!curNfData) autoNfData = { manual_required: true };
        } finally {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        }
      } else if (!curNfData) {
        // Anexo não é PDF (ex.: foto da NF) — pede transcrição manual.
        autoNfData = { manual_required: true };
      }
    }

    let query = `UPDATE chamados SET status = $1, etapa_destino = $1, updated_at = NOW()`;
    let params = [status, req.params.id];
    let nextParamIndex = 3;

    if (autoNfData) {
      query += `, nf_data = $${nextParamIndex++}`;
      params.push(autoNfData);
    }

    if (recolhimento_data !== undefined) {
      query += `, recolhimento_data = $${nextParamIndex++}`;
      params.push(recolhimento_data);
    }

    if (encToStore !== undefined) {
      query += `, encerramento_data = $${nextParamIndex++}`;
      params.push(encToStore);
    }

    // Grava os valores já validados/normalizados (AAAA-MM-DD ou null).
    if (!prevN.skip) {
      query += `, data_previsao_recolhimento = $${nextParamIndex++}`;
      params.push(prevN.value);
    }

    if (!realN.skip) {
      query += `, data_real_recolhimento = $${nextParamIndex++}`;
      params.push(realN.value);
    }

    query += ` WHERE id = $2 RETURNING *`;

    // Transação: o UPDATE do chamado e o INSERT no histórico precisam ser
    // atômicos — senão uma falha entre os dois deixa o status mudado sem trilha
    // de auditoria (ou vice-versa). O e-mail é disparado só após o COMMIT.
    const client = await pool.connect();
    let updatedRow;
    try {
      await client.query("BEGIN");
      const upd = await client.query(query, params);
      if (!upd.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Chamado não encontrado" });
      }
      updatedRow = upd.rows[0];

      if (oldStatus !== status) {
        await client.query(
          `INSERT INTO chamado_historico (chamado_id, user_id, status_anterior, status_novo)
           VALUES ($1, $2, $3, $4)`,
          [req.params.id, req.user.id, oldStatus, status]
        );
      }

      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK").catch(() => {});
      throw txErr; // cai no catch externo → 500
    } finally {
      client.release();
    }

    // E-mail fora da transação (fire-and-forget): não bloqueia nem desfaz o commit.
    if (oldStatus !== status && oldRow.email_vendedor) {
      sendStatusUpdateEmail({
        toEmail: oldRow.email_vendedor,
        toName: oldRow.nome_vendedor,
        chamadoId: req.params.id,
        razaoSocial: oldRow.razao_social,
        oldStatus,
        newStatus: status,
      }).catch((err) => console.error(`[Mailer] Falha ao notificar mudança de status do chamado #${req.params.id}:`, err?.message || err));
    }

    res.json({ chamado: updatedRow, espelho_gerado: espelhoGerado });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao atualizar status" });
  }
});

// ── POST /api/chamados/:id/reprocess-pdf ──
// Pós-Vendas pode anexar o PDF original para substituir a foto e gerar o espelho automaticamente
const { extractNFDeterministic } = require("../utils/pythonBridge");
// Pós-processamento da extração centralizado (compartilhado com /api/ai/extract-nf)
const { cleanAndFormatNfData } = require("../utils/nfData");

router.post("/:id/reprocess-pdf", authMiddleware(["pos_vendas", "admin"]), memoryUpload.single("nf_file"), async (req, res) => {
  const tempPath = path.join(os.tmpdir(), `nf_${Date.now()}.pdf`);
  try {
    if (!req.file || req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ error: "É obrigatório enviar um arquivo PDF válido." });
    }

    // Salva o buffer recebido em um arquivo temporário local para o Python
    fs.writeFileSync(tempPath, req.file.buffer);

    // Processa o arquivo com o script Python
    let rawDet;
    try {
      rawDet = await extractNFDeterministic(tempPath);
    } catch (pythonErr) {
      console.error("Erro no script Python:", pythonErr.message);
      return res.status(422).json({ error: "Não foi possível extrair os dados do PDF. Verifique se o arquivo não está corrompido ou protegido por senha." });
    }
    
    if (!rawDet || rawDet.error) {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      return res.status(422).json({ error: "O extrator não encontrou dados válidos neste PDF. Certifique-se que é uma DANFE padrão." });
    }

    // Se a extração deu certo, agora sim subimos para o Cloudinary de forma definitiva
    const uploadRes = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload(tempPath, {
        folder: "triagem_posvendas",
        resource_type: "raw",
        public_id: `${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`,
      }, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });

    // Remove o arquivo temporário
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

    // Formatar os dados usando a mesma lógica da IA/Triagem
    const docRes = cleanAndFormatNfData(rawDet);
    const nfFilePath = uploadRes.secure_url; 
    docRes.manual_required = false;

    const { rows } = await pool.query(
      "UPDATE chamados SET nf_file_path = $1, nf_data = $2, updated_at = NOW() WHERE id = $3 RETURNING *",
      [nfFilePath, docRes, req.params.id]
    );

    if (!rows[0]) return res.status(404).json({ error: "Chamado não encontrado" });

    res.json({ chamado: rows[0] });

  } catch (e) {
    console.error("Erro geral ao reprocessar PDF:", e);
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    res.status(500).json({ error: `Erro no processamento: ${e.message}` });
  }
});

// PATCH /api/chamados/:id/nf_data — pos_vendas/admin atualiza os dados da nota fiscal (transcrição manual)
router.patch("/:id/nf_data", authMiddleware(["pos_vendas", "admin"]), async (req, res) => {
  try {
    const { nf_data } = req.body;
    if (!nf_data) return res.status(400).json({ error: "nf_data obrigatório" });
    const { rows } = await pool.query(
      "UPDATE chamados SET nf_data = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [nf_data, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Chamado não encontrado" });
    res.json({ chamado: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao atualizar dados da NF" });
  }
});

// PATCH /api/chamados/:id/ressalva — vendedor ou admin atualiza observação
router.patch("/:id/ressalva", authMiddleware(), upload.array("ressalva_arquivos", 3), async (req, res) => {
  try {
    const { ressalva_vendedor } = req.body;

    // Verifica proprietário ANTES de subir qualquer arquivo (evita gastar upload
    // no Cloudinary para uma requisição que será rejeitada).
    const { rows: check } = await pool.query("SELECT vendedor_id FROM chamados WHERE id = $1", [req.params.id]);
    if (!check[0]) return res.status(404).json({ error: "Chamado não encontrado" });

    if (req.user.role !== "admin" && check[0].vendedor_id !== req.user.id) {
      return res.status(403).json({ error: "Acesso negado" });
    }

    // O multer desta rota usa memoryStorage: o arquivo existe apenas em
    // `f.buffer` e NÃO há `f.path`. Antes eram gravados `undefined` na coluna e
    // o anexo se perdia silenciosamente — o upload precisa ser explícito.
    let newFiles = [];
    if (req.files && req.files.length > 0) {
      try {
        const uploads = await Promise.all(
          req.files.map(f => uploadToCloudinary(
            f.buffer,
            { public_id: `ressalva_${Date.now()}_${Math.random().toString(36).slice(2)}` },
            f.mimetype
          ))
        );
        newFiles = uploads.map(u => u.secure_url);
      } catch (uploadErr) {
        console.error("Erro upload ressalva:", uploadErr?.message);
        return res.status(500).json({ error: "Falha ao enviar os anexos da ressalva. Tente novamente." });
      }
    }

    let query = `UPDATE chamados SET ressalva_vendedor = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
    let qParams = [ressalva_vendedor, req.params.id];

    if (newFiles.length > 0) {
      query = `UPDATE chamados SET ressalva_vendedor = $1, ressalva_arquivos = array_cat(COALESCE(ressalva_arquivos, '{}'), $3), updated_at = NOW() WHERE id = $2 RETURNING *`;
      qParams.push(newFiles);
    }

    const { rows } = await pool.query(query, qParams);
    res.json({ chamado: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao atualizar ressalva" });
  }
});

// GET /api/chamados/:id/danfe-pdf — gera e baixa o espelho profissional PDF
router.get("/:id/danfe-pdf", authMiddleware(["admin", "pos_vendas"]), async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT nf_data FROM chamados WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Chamado não encontrado" });
    
    let nfData = rows[0].nf_data;
    if (typeof nfData === "string") nfData = JSON.parse(nfData);
    
    if (!nfData) return res.status(400).json({ error: "Dados da NF não encontrados para este chamado" });

    const outputPath = path.join(os.tmpdir(), `danfe_${req.params.id}_${Date.now()}.pdf`);
    await generatePDFFromJSON(nfData, outputPath);

    res.download(outputPath, `ESPELHO_NF_${req.params.id}.pdf`, (err) => {
      // Limpa após envio ou erro
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao gerar PDF profissional" });
  }
});

// DELETE /api/chamados/:id — APENAS ADMIN exclui chamado
router.delete("/:id", authMiddleware(["admin"]), async (req, res) => {
  try {
    const { rows } = await pool.query("DELETE FROM chamados WHERE id = $1 RETURNING *", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Chamado não encontrado" });
    res.json({ message: "Chamado excluído com sucesso" });
  } catch (e) {
    res.status(500).json({ error: "Erro ao excluir chamado" });
  }
});


// POST /api/chamados/batch-delete — APENAS ADMIN exclui vários
router.post("/batch-delete", authMiddleware(["admin"]), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "IDs inválidos" });
    await pool.query("DELETE FROM chamados WHERE id = ANY($1)", [ids]);
    res.json({ message: `${ids.length} chamados excluídos` });
  } catch (e) {
    res.status(500).json({ error: "Erro na exclusão em massa" });
  }
});

// ===========================
// SISTEMA DE CHAT DO CHAMADO
// ===========================

// GET /api/chamados/:id/messages
router.get("/:id/messages", authMiddleware(), async (req, res) => {
  try {
    // Controle de acesso: vendedor só lê mensagens de chamados próprios/compartilhados
    if (!(await canAccessChamadoById(req.user, req.params.id))) {
      return res.status(403).json({ error: "Acesso negado a este chamado" });
    }
    const { rows } = await pool.query(
      `SELECT m.*, u.name as user_name, u.role as user_role
       FROM chamado_mensagens m
       LEFT JOIN users u ON m.user_id = u.id
       WHERE m.chamado_id = $1
       ORDER BY m.created_at ASC`,
      [req.params.id]
    );
    res.json({ messages: rows });
  } catch (e) {
    console.error("Erro ao buscar mensagens do chat:", e);
    res.status(500).json({ error: "Erro ao buscar mensagens" });
  }
});

// POST /api/chamados/:id/messages
router.post("/:id/messages", authMiddleware(), upload.single("anexo"), async (req, res) => {
  try {
    const { mensagem } = req.body;
    const isTextEmpty = !mensagem || !mensagem.trim();
    const hasFile = !!req.file;
    
    if (isTextEmpty && !hasFile) return res.status(400).json({ error: "Mensagem ou anexo vazio" });

    // Verifica permissão (qualquer um do grupo pos_vendas ou admin, mas vendedor só se for o dono ou compartilhado)
    const { rows: ch } = await pool.query("SELECT vendedor_id FROM chamados WHERE id = $1", [req.params.id]);
    if (!ch[0]) return res.status(404).json({ error: "Chamado não encontrado" });

    if (req.user.role === "vendedor" && ch[0].vendedor_id !== req.user.id) {
       // verifica os compartilhamentos
       const { rows: sh } = await pool.query("SELECT * FROM chamado_shares WHERE chamado_id = $1 AND user_id = $2", [req.params.id, req.user.id]);
       if (!sh[0]) return res.status(403).json({ error: "Acesso negado para postar chat" });
    }

    let filepath = null;
    if (req.file) {
      const uploaded = await uploadToCloudinary(
        req.file.buffer,
        { public_id: `chat_${Date.now()}_${Math.random().toString(36).slice(2)}` },
        req.file.mimetype
      );
      filepath = uploaded.secure_url;
    }

    const { rows } = await pool.query(
      `INSERT INTO chamado_mensagens (chamado_id, user_id, mensagem, anexo)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.id, req.user.id, (mensagem || "").trim(), filepath]
    );

    // Retorna mensagem com detalhes de quem mandou para injetar na interface
    const { rows: finalMsg } = await pool.query(
      `SELECT m.*, u.name as user_name, u.role as user_role 
       FROM chamado_mensagens m 
       LEFT JOIN users u ON m.user_id = u.id 
       WHERE m.id = $1`,
      [rows[0].id]
    );

    res.status(201).json({ message: finalMsg[0] });
  } catch (e) {
    console.error("Erro ao enviar mensagem:", e);
    res.status(500).json({ error: "Erro ao enviar mensagem" });
  }
});

// GET /api/chamados/:id/history — busca histórico de movimentação
router.get("/:id/history", authMiddleware(["pos_vendas", "admin"]), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT h.*, u.name as user_name, u.role as user_role
       FROM chamado_historico h
       LEFT JOIN users u ON h.user_id = u.id
       WHERE h.chamado_id = $1
       ORDER BY h.created_at DESC`,
      [req.params.id]
    );
    res.json({ history: rows });
  } catch (e) {
    console.error("Erro ao buscar histórico:", e);
    res.status(500).json({ error: "Erro ao buscar histórico" });
  }
});

/**
 * Handler de erros de upload deste router.
 *
 * Erros do multer (tamanho, contagem, campo inesperado) e do `fileFilter` são
 * emitidos pelo middleware, ANTES do handler da rota — sem isto caíam no
 * handler global e viravam um 500 "Erro interno do servidor", sem indicar ao
 * usuário o que havia de errado com o arquivo.
 */
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: `Arquivo maior que o limite de ${MAX_FILE_MB} MB. Reduza o tamanho e tente novamente.` });
    }
    if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({ error: "Quantidade de arquivos acima do permitido para este envio." });
    }
    return res.status(400).json({ error: `Falha no envio do arquivo: ${err.message}` });
  }
  if (err?.code === "UNSUPPORTED_FILE_TYPE") {
    return res.status(415).json({ error: err.message });
  }
  return next(err);
});

module.exports = router;
