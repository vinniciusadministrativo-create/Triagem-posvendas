const express = require("express");
const path = require("path");
const pool = require("../db");
const authMiddleware = require("../middleware/auth");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

const router = express.Router();

// ── Cloudinary (mesma config do chamados.js) ──────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dvrcqfo4o",
  api_key:    process.env.CLOUDINARY_API_KEY    || "192681423577212",
  api_secret: process.env.CLOUDINARY_API_SECRET || "oZfa9N7J9KZt7us-sCNwkbKE2BI",
});

const chatStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const ext = path.extname(file.originalname);
    const isImg = file.mimetype.startsWith("image/");
    return {
      folder: "chat_interno",
      resource_type: isImg ? "image" : "raw",
      public_id: `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`,
    };
  },
});

const upload = multer({
  storage: chatStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/jpeg", "image/png", "image/webp", "image/gif",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "video/mp4",
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

// ════════════════════════════════════════════════════════════════════
//  CONTATOS & MENSAGENS DIRETAS
// ════════════════════════════════════════════════════════════════════

// GET /api/chat/contatos — lista usuários ativos + última msg + não lidas
router.get("/contatos", authMiddleware(), async (req, res) => {
  const me = req.user.id;
  try {
    const { rows } = await pool.query(`
      SELECT
        u.id, u.name, u.email, u.role, u.telefone,
        (
          SELECT conteudo FROM chat_direto
          WHERE deletada = FALSE AND grupo_id IS NULL
            AND ((remetente_id = $1 AND destinatario_id = u.id)
              OR (remetente_id = u.id AND destinatario_id = $1))
          ORDER BY created_at DESC LIMIT 1
        ) AS ultima_mensagem,
        (
          SELECT created_at FROM chat_direto
          WHERE deletada = FALSE AND grupo_id IS NULL
            AND ((remetente_id = $1 AND destinatario_id = u.id)
              OR (remetente_id = u.id AND destinatario_id = $1))
          ORDER BY created_at DESC LIMIT 1
        ) AS ultima_mensagem_at,
        (
          SELECT COUNT(*) FROM chat_direto
          WHERE remetente_id = u.id AND destinatario_id = $1
            AND lida = FALSE AND deletada = FALSE AND grupo_id IS NULL
        ) AS nao_lidas
      FROM users u
      WHERE u.id != $1 AND u.active = TRUE
      ORDER BY ultima_mensagem_at DESC NULLS LAST, u.name ASC
    `, [me]);
    res.json({ contatos: rows });
  } catch (e) {
    console.error("chat/contatos:", e);
    res.status(500).json({ error: "Erro ao buscar contatos" });
  }
});

// GET /api/chat/mensagens/:userId
router.get("/mensagens/:userId", authMiddleware(), async (req, res) => {
  const me = req.user.id;
  const outro = parseInt(req.params.userId);
  const limit = parseInt(req.query.limit) || 50;
  const antes_de = req.query.antes_de;
  try {
    let q = `
      SELECT m.id, m.conteudo, m.tipo, m.anexo_url, m.anexo_nome, m.anexo_tipo,
             m.lida, m.editada, m.deletada, m.created_at, m.updated_at,
             m.remetente_id, u.name AS remetente_nome
      FROM chat_direto m JOIN users u ON u.id = m.remetente_id
      WHERE m.deletada = FALSE AND m.grupo_id IS NULL
        AND ((m.remetente_id=$1 AND m.destinatario_id=$2)
          OR (m.remetente_id=$2 AND m.destinatario_id=$1))
    `;
    const params = [me, outro];
    if (antes_de) { params.push(antes_de); q += ` AND m.created_at < $${params.length}`; }
    q += ` ORDER BY m.created_at ASC LIMIT $${params.length + 1}`;
    params.push(limit);
    const { rows } = await pool.query(q, params);
    res.json({ mensagens: rows });
  } catch (e) {
    res.status(500).json({ error: "Erro ao buscar mensagens" });
  }
});

// GET /api/chat/novas/:userId?desde=<id>
router.get("/novas/:userId", authMiddleware(), async (req, res) => {
  const me = req.user.id;
  const outro = parseInt(req.params.userId);
  const desde_id = parseInt(req.query.desde) || 0;
  try {
    const { rows } = await pool.query(`
      SELECT m.id, m.conteudo, m.tipo, m.anexo_url, m.anexo_nome, m.anexo_tipo,
             m.lida, m.editada, m.deletada, m.created_at, m.updated_at,
             m.remetente_id, u.name AS remetente_nome
      FROM chat_direto m JOIN users u ON u.id = m.remetente_id
      WHERE m.deletada = FALSE AND m.grupo_id IS NULL AND m.id > $3
        AND ((m.remetente_id=$1 AND m.destinatario_id=$2)
          OR (m.remetente_id=$2 AND m.destinatario_id=$1))
      ORDER BY m.created_at ASC
    `, [me, outro, desde_id]);
    res.json({ mensagens: rows });
  } catch (e) {
    res.status(500).json({ error: "Erro ao buscar novas mensagens" });
  }
});

// GET /api/chat/nao-lidas — badge global
router.get("/nao-lidas", authMiddleware(), async (req, res) => {
  const me = req.user.id;
  try {
    // Diretas
    const { rows: d } = await pool.query(`
      SELECT COUNT(*) AS total FROM chat_direto
      WHERE destinatario_id=$1 AND lida=FALSE AND deletada=FALSE AND grupo_id IS NULL
    `, [me]);
    // Grupos — mensagens não enviadas por mim sem registro de leitura
    const { rows: g } = await pool.query(`
      SELECT COUNT(m.id) AS total
      FROM chat_direto m
      JOIN chat_grupo_membros mb ON mb.grupo_id = m.grupo_id AND mb.user_id = $1
      LEFT JOIN chat_leituras_grupo cl ON cl.mensagem_id = m.id AND cl.user_id = $1
      WHERE m.remetente_id != $1 AND m.deletada = FALSE AND cl.id IS NULL
    `, [me]);
    const total = parseInt(d[0].total) + parseInt(g[0]?.total || 0);
    res.json({ total });
  } catch (e) {
    res.status(500).json({ error: "Erro ao contar não lidas" });
  }
});

// POST /api/chat/mensagens — envia msg de texto OU arquivo
router.post("/mensagens", authMiddleware(), upload.single("arquivo"), async (req, res) => {
  const me = req.user.id;
  const { destinatario_id, conteudo, tipo = "texto" } = req.body;

  if (!destinatario_id && !req.body.grupo_id)
    return res.status(400).json({ error: "Informe destinatario_id ou grupo_id" });
  if (!req.file && !conteudo?.trim())
    return res.status(400).json({ error: "Mensagem ou arquivo são obrigatórios" });

  try {
    let anexo_url = null, anexo_nome = null, anexo_tipo = null, tipoFinal = tipo;

    if (req.file) {
      anexo_url  = req.file.path;
      anexo_nome = req.file.originalname;
      anexo_tipo = req.file.mimetype;
      tipoFinal  = req.file.mimetype.startsWith("image/") ? "imagem" : "arquivo";
    }

    const { rows } = await pool.query(`
      INSERT INTO chat_direto
        (remetente_id, destinatario_id, grupo_id, conteudo, tipo, anexo_url, anexo_nome, anexo_tipo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, conteudo, tipo, anexo_url, anexo_nome, anexo_tipo, lida, editada, created_at, remetente_id
    `, [
      me,
      destinatario_id || null,
      req.body.grupo_id || null,
      (conteudo || "").trim(),
      tipoFinal,
      anexo_url, anexo_nome, anexo_tipo,
    ]);

    res.status(201).json({ mensagem: rows[0] });
  } catch (e) {
    console.error("chat/post:", e);
    res.status(500).json({ error: "Erro ao enviar mensagem" });
  }
});

// PATCH /api/chat/lidas/:userId
router.patch("/lidas/:userId", authMiddleware(), async (req, res) => {
  const me = req.user.id;
  const outro = parseInt(req.params.userId);
  try {
    await pool.query(`
      UPDATE chat_direto SET lida=TRUE
      WHERE remetente_id=$1 AND destinatario_id=$2 AND lida=FALSE AND grupo_id IS NULL
    `, [outro, me]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Erro ao marcar como lidas" });
  }
});

// PATCH /api/chat/mensagens/:id — editar
router.patch("/mensagens/:id", authMiddleware(), async (req, res) => {
  const me = req.user.id;
  const { conteudo } = req.body;
  if (!conteudo?.trim()) return res.status(400).json({ error: "Conteúdo não pode ser vazio" });
  try {
    const { rows } = await pool.query(`
      UPDATE chat_direto SET conteudo=$1, editada=TRUE, updated_at=NOW()
      WHERE id=$2 AND remetente_id=$3 AND deletada=FALSE
      RETURNING id, conteudo, editada, updated_at
    `, [conteudo.trim(), req.params.id, me]);
    if (!rows[0]) return res.status(404).json({ error: "Mensagem não encontrada" });
    res.json({ mensagem: rows[0] });
  } catch (e) {
    res.status(500).json({ error: "Erro ao editar mensagem" });
  }
});

// DELETE /api/chat/mensagens/:id — soft-delete
router.delete("/mensagens/:id", authMiddleware(), async (req, res) => {
  const me = req.user.id;
  try {
    const { rows } = await pool.query(`
      UPDATE chat_direto SET deletada=TRUE, conteudo='Mensagem apagada', updated_at=NOW()
      WHERE id=$1 AND remetente_id=$2 RETURNING id
    `, [req.params.id, me]);
    if (!rows[0]) return res.status(404).json({ error: "Mensagem não encontrada" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Erro ao apagar mensagem" });
  }
});

// ════════════════════════════════════════════════════════════════════
//  GRUPOS
// ════════════════════════════════════════════════════════════════════

// GET /api/chat/grupos — lista grupos do usuário logado
router.get("/grupos", authMiddleware(), async (req, res) => {
  const me = req.user.id;
  try {
    const { rows } = await pool.query(`
      SELECT g.id, g.nome, g.descricao, g.criado_por, g.avatar_url, g.created_at,
        (SELECT COUNT(*) FROM chat_grupo_membros WHERE grupo_id = g.id) AS membros,
        (
          SELECT conteudo FROM chat_direto WHERE grupo_id = g.id AND deletada=FALSE
          ORDER BY created_at DESC LIMIT 1
        ) AS ultima_mensagem,
        (
          SELECT created_at FROM chat_direto WHERE grupo_id = g.id AND deletada=FALSE
          ORDER BY created_at DESC LIMIT 1
        ) AS ultima_mensagem_at,
        -- Não lidas do grupo: msgs não minhas sem registro de leitura
        (
          SELECT COUNT(m.id) FROM chat_direto m
          LEFT JOIN chat_leituras_grupo cl ON cl.mensagem_id = m.id AND cl.user_id = $1
          WHERE m.grupo_id = g.id AND m.remetente_id != $1
            AND m.deletada = FALSE AND cl.id IS NULL
        ) AS nao_lidas
      FROM chat_grupos g
      JOIN chat_grupo_membros mb ON mb.grupo_id = g.id AND mb.user_id = $1
      ORDER BY ultima_mensagem_at DESC NULLS LAST, g.nome ASC
    `, [me]);
    res.json({ grupos: rows });
  } catch (e) {
    console.error("chat/grupos:", e);
    res.status(500).json({ error: "Erro ao listar grupos" });
  }
});

// POST /api/chat/grupos — cria grupo
router.post("/grupos", authMiddleware(), async (req, res) => {
  const me = req.user.id;
  const { nome, descricao, membros = [] } = req.body;
  if (!nome?.trim()) return res.status(400).json({ error: "Nome do grupo é obrigatório" });
  if (!Array.isArray(membros) || membros.length < 1)
    return res.status(400).json({ error: "Adicione pelo menos 1 outro membro" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "INSERT INTO chat_grupos (nome, descricao, criado_por) VALUES ($1, $2, $3) RETURNING *",
      [nome.trim(), descricao?.trim() || null, me]
    );
    const grupoId = rows[0].id;

    // Adiciona criador como admin
    const todosMembros = [...new Set([me, ...membros.map(Number)])];
    for (const uid of todosMembros) {
      await client.query(
        "INSERT INTO chat_grupo_membros (grupo_id, user_id, admin) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        [grupoId, uid, uid === me]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ grupo: rows[0] });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("chat/grupos POST:", e);
    res.status(500).json({ error: "Erro ao criar grupo" });
  } finally { client.release(); }
});

// DELETE /api/chat/grupos/:id — exclui grupo (apenas criador ou admin do grupo)
router.delete("/grupos/:id", authMiddleware(), async (req, res) => {
  const me = req.user.id;
  try {
    const { rows: g } = await pool.query(
      "SELECT criado_por FROM chat_grupos WHERE id=$1", [req.params.id]
    );
    if (!g[0]) return res.status(404).json({ error: "Grupo não encontrado" });

    // Permite: criador do grupo, ou admin do sistema
    const { rows: mb } = await pool.query(
      "SELECT admin FROM chat_grupo_membros WHERE grupo_id=$1 AND user_id=$2",
      [req.params.id, me]
    );
    const isAdminGrupo = mb[0]?.admin;
    const isCriador = g[0].criado_por === me;
    if (!isCriador && !isAdminGrupo && req.user.role !== "admin")
      return res.status(403).json({ error: "Apenas o criador ou admin pode excluir o grupo" });

    await pool.query("DELETE FROM chat_grupos WHERE id=$1", [req.params.id]);
    res.json({ ok: true, message: "Grupo excluído com sucesso" });
  } catch (e) {
    res.status(500).json({ error: "Erro ao excluir grupo" });
  }
});

// GET /api/chat/grupos/:id/mensagens — histórico do grupo
router.get("/grupos/:id/mensagens", authMiddleware(), async (req, res) => {
  const me = req.user.id;
  const grupoId = parseInt(req.params.id);
  const limit = parseInt(req.query.limit) || 50;
  const desde_id = parseInt(req.query.desde) || 0;
  try {
    // Verifica se é membro
    const { rows: mb } = await pool.query(
      "SELECT 1 FROM chat_grupo_membros WHERE grupo_id=$1 AND user_id=$2", [grupoId, me]
    );
    if (!mb[0]) return res.status(403).json({ error: "Você não é membro deste grupo" });

    const { rows } = await pool.query(`
      SELECT m.id, m.conteudo, m.tipo, m.anexo_url, m.anexo_nome, m.anexo_tipo,
             m.editada, m.deletada, m.created_at, m.updated_at,
             m.remetente_id, u.name AS remetente_nome
      FROM chat_direto m JOIN users u ON u.id = m.remetente_id
      WHERE m.grupo_id=$1 AND m.deletada=FALSE AND m.id > $2
      ORDER BY m.created_at ASC LIMIT $3
    `, [grupoId, desde_id, limit]);

    res.json({ mensagens: rows });
  } catch (e) {
    res.status(500).json({ error: "Erro ao buscar mensagens do grupo" });
  }
});

// POST /api/chat/grupos/:id/lidas — marca mensagens do grupo como lidas
router.post("/grupos/:id/lidas", authMiddleware(), async (req, res) => {
  const me = req.user.id;
  const grupoId = parseInt(req.params.id);
  try {
    // Insere registros de leitura para msgs não lidas ainda
    await pool.query(`
      INSERT INTO chat_leituras_grupo (mensagem_id, user_id)
      SELECT m.id, $2 FROM chat_direto m
      LEFT JOIN chat_leituras_grupo cl ON cl.mensagem_id = m.id AND cl.user_id = $2
      WHERE m.grupo_id = $1 AND m.remetente_id != $2 AND m.deletada=FALSE AND cl.id IS NULL
      ON CONFLICT DO NOTHING
    `, [grupoId, me]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Erro ao marcar lidas" });
  }
});

// GET /api/chat/grupos/:id/membros — lista membros
router.get("/grupos/:id/membros", authMiddleware(), async (req, res) => {
  const me = req.user.id;
  try {
    const { rows: mb } = await pool.query(
      "SELECT 1 FROM chat_grupo_membros WHERE grupo_id=$1 AND user_id=$2",
      [req.params.id, me]
    );
    if (!mb[0]) return res.status(403).json({ error: "Acesso negado" });

    const { rows } = await pool.query(`
      SELECT u.id, u.name, u.email, u.role, m.admin, m.joined_at
      FROM chat_grupo_membros m JOIN users u ON u.id = m.user_id
      WHERE m.grupo_id=$1 ORDER BY m.admin DESC, u.name ASC
    `, [req.params.id]);
    res.json({ membros: rows });
  } catch (e) {
    res.status(500).json({ error: "Erro ao listar membros" });
  }
});

module.exports = router;
