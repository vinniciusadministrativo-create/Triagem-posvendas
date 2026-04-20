const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pool = require("../db");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// File upload config
const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg","image/png","image/webp","image/gif","application/pdf","video/mp4","video/quicktime","video/x-msvideo"];
    cb(null, allowed.includes(file.mimetype));
  },
});

// GET /api/chamados/meus — usuário vê seus próprios e os compartilhados
router.get("/meus", authMiddleware(["vendedor", "pos_vendas", "admin"]), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const { rows } = await pool.query(
      `SELECT c.*, u.name as vendedor_nome
       FROM chamados c
       LEFT JOIN users u ON c.vendedor_id = u.id
       LEFT JOIN chamado_shares s ON c.id = s.chamado_id
       WHERE c.vendedor_id = $1 OR s.user_id = $1
       GROUP BY c.id, u.name
       ORDER BY c.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );
    const countRes = await pool.query(
      `SELECT COUNT(DISTINCT c.id) 
       FROM chamados c 
       LEFT JOIN chamado_shares s ON c.id = s.chamado_id 
       WHERE c.vendedor_id = $1 OR s.user_id = $1`,
      [req.user.id]
    );
    res.json({ chamados: rows, total: parseInt(countRes.rows[0].count) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao buscar chamados" });
  }
});

// GET /api/chamados/file/:filename — serve uploaded file
// IMPORTANTE: deve vir ANTES de /:id para não conflitar
router.get("/file/:filename", authMiddleware(), (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Arquivo não encontrado" });
  res.sendFile(filePath);
});

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

      const nfFile = req.files?.nf_file?.[0];
      const evFiles = req.files?.evidence_files || [];

      const triageObj = triage_result ? JSON.parse(triage_result) : {};

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
          cnpj,
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
          nfFile ? nfFile.filename : null,
          evFiles.length ? evFiles.map(f => f.filename) : null,
          ressalva_vendedor || null,
        ]
      );

      res.status(201).json({ chamado: rows[0] });
    } catch (e) {
      console.error(e);
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

// GET /api/chamados — pos_vendas/admin lista com filtros
router.get("/", authMiddleware(["pos_vendas", "admin"]), async (req, res) => {
  try {
    const { status, tipo, vendedor_id, from, to, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (status) { params.push(status); conditions.push(`c.status = $${params.length}`); }
    if (tipo) { params.push(tipo); conditions.push(`c.tipo_solicitacao = $${params.length}`); }
    if (vendedor_id) { params.push(vendedor_id); conditions.push(`c.vendedor_id = $${params.length}`); }
    if (from) { params.push(from); conditions.push(`c.created_at >= $${params.length}`); }
    if (to) { params.push(to); conditions.push(`c.created_at <= $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit, offset);

    const { rows } = await pool.query(
      `SELECT c.*, u.name as vendedor_nome
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
    if (req.user.role === "vendedor" && rows[0].vendedor_id !== req.user.id)
      return res.status(403).json({ error: "Acesso negado" });
    res.json({ chamado: rows[0] });
  } catch (e) {
    res.status(500).json({ error: "Erro ao buscar chamado" });
  }
});

// PATCH /api/chamados/:id/status — pos_vendas atualiza etapa
router.patch("/:id/status", authMiddleware(["pos_vendas", "admin"]), async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "Status obrigatório" });
    const { rows } = await pool.query(
      `UPDATE chamados SET status = $1, etapa_destino = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Chamado não encontrado" });
    res.json({ chamado: rows[0] });
  } catch (e) {
    res.status(500).json({ error: "Erro ao atualizar status" });
  }
});

// PATCH /api/chamados/:id/ressalva — vendedor ou admin atualiza observação
router.patch("/:id/ressalva", authMiddleware(), upload.array("ressalva_arquivos", 3), async (req, res) => {
  try {
    const { ressalva_vendedor } = req.body;
    let newFiles = [];
    if (req.files && req.files.length > 0) {
      newFiles = req.files.map(f => f.filename);
    }
    
    // Verifica proprietário
    const { rows: check } = await pool.query("SELECT vendedor_id FROM chamados WHERE id = $1", [req.params.id]);
    if (!check[0]) return res.status(404).json({ error: "Chamado não encontrado" });
    
    if (req.user.role !== "admin" && check[0].vendedor_id !== req.user.id) {
      return res.status(403).json({ error: "Acesso negado" });
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

// PATCH /api/chamados/:id/nf-data — admin ou pos_vendas salva rascunho da NF
router.patch("/:id/nf-data", authMiddleware(["admin", "pos_vendas"]), async (req, res) => {
  try {
    const { nf_data } = req.body;
    const { rows } = await pool.query(
      `UPDATE chamados SET nf_data = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [nf_data, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Chamado não encontrado" });
    res.json({ chamado: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao salvar rascunho da NF" });
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

module.exports = router;
