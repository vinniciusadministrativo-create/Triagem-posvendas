const express = require("express");
const pool = require("../db");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// ─────────────────────────────────────────
// GET /api/chat/contatos
// Lista todos os usuários ativos + última mensagem + qtd não lidas
// ─────────────────────────────────────────
router.get("/contatos", authMiddleware(), async (req, res) => {
  const me = req.user.id;
  try {
    const { rows } = await pool.query(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.telefone,
        -- Última mensagem da conversa
        (
          SELECT conteudo FROM chat_direto
          WHERE deletada = FALSE
            AND (
              (remetente_id = $1 AND destinatario_id = u.id) OR
              (remetente_id = u.id AND destinatario_id = $1)
            )
          ORDER BY created_at DESC LIMIT 1
        ) AS ultima_mensagem,
        (
          SELECT created_at FROM chat_direto
          WHERE deletada = FALSE
            AND (
              (remetente_id = $1 AND destinatario_id = u.id) OR
              (remetente_id = u.id AND destinatario_id = $1)
            )
          ORDER BY created_at DESC LIMIT 1
        ) AS ultima_mensagem_at,
        -- Contagem de não lidas (enviadas pelo contato para mim)
        (
          SELECT COUNT(*) FROM chat_direto
          WHERE remetente_id = u.id
            AND destinatario_id = $1
            AND lida = FALSE
            AND deletada = FALSE
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

// ─────────────────────────────────────────
// GET /api/chat/mensagens/:userId
// Histórico de mensagens entre o usuário logado e :userId
// ─────────────────────────────────────────
router.get("/mensagens/:userId", authMiddleware(), async (req, res) => {
  const me = req.user.id;
  const outro = parseInt(req.params.userId);
  const limit = parseInt(req.query.limit) || 50;
  const antes_de = req.query.antes_de; // cursor para paginação futura

  try {
    let query = `
      SELECT
        m.id, m.conteudo, m.tipo, m.anexo_url,
        m.lida, m.editada, m.deletada,
        m.created_at, m.updated_at,
        m.remetente_id,
        u.name AS remetente_nome
      FROM chat_direto m
      JOIN users u ON u.id = m.remetente_id
      WHERE m.deletada = FALSE
        AND (
          (m.remetente_id = $1 AND m.destinatario_id = $2) OR
          (m.remetente_id = $2 AND m.destinatario_id = $1)
        )
    `;
    const params = [me, outro];

    if (antes_de) {
      params.push(antes_de);
      query += ` AND m.created_at < $${params.length}`;
    }

    query += ` ORDER BY m.created_at ASC LIMIT $${params.length + 1}`;
    params.push(limit);

    const { rows } = await pool.query(query, params);
    res.json({ mensagens: rows });
  } catch (e) {
    console.error("chat/mensagens:", e);
    res.status(500).json({ error: "Erro ao buscar mensagens" });
  }
});

// ─────────────────────────────────────────
// GET /api/chat/novas/:userId?desde=<id>
// Busca apenas mensagens novas (polling eficiente)
// ─────────────────────────────────────────
router.get("/novas/:userId", authMiddleware(), async (req, res) => {
  const me = req.user.id;
  const outro = parseInt(req.params.userId);
  const desde_id = parseInt(req.query.desde) || 0;

  try {
    const { rows } = await pool.query(`
      SELECT
        m.id, m.conteudo, m.tipo, m.anexo_url,
        m.lida, m.editada, m.deletada,
        m.created_at, m.updated_at,
        m.remetente_id,
        u.name AS remetente_nome
      FROM chat_direto m
      JOIN users u ON u.id = m.remetente_id
      WHERE m.deletada = FALSE
        AND m.id > $3
        AND (
          (m.remetente_id = $1 AND m.destinatario_id = $2) OR
          (m.remetente_id = $2 AND m.destinatario_id = $1)
        )
      ORDER BY m.created_at ASC
    `, [me, outro, desde_id]);

    res.json({ mensagens: rows });
  } catch (e) {
    console.error("chat/novas:", e);
    res.status(500).json({ error: "Erro ao buscar novas mensagens" });
  }
});

// ─────────────────────────────────────────
// GET /api/chat/nao-lidas
// Total de mensagens não lidas para o badge global no menu
// ─────────────────────────────────────────
router.get("/nao-lidas", authMiddleware(), async (req, res) => {
  const me = req.user.id;
  try {
    const { rows } = await pool.query(`
      SELECT COUNT(*) AS total
      FROM chat_direto
      WHERE destinatario_id = $1 AND lida = FALSE AND deletada = FALSE
    `, [me]);
    res.json({ total: parseInt(rows[0].total) });
  } catch (e) {
    res.status(500).json({ error: "Erro ao contar não lidas" });
  }
});

// ─────────────────────────────────────────
// POST /api/chat/mensagens
// Envia uma nova mensagem
// ─────────────────────────────────────────
router.post("/mensagens", authMiddleware(), async (req, res) => {
  const me = req.user.id;
  const { destinatario_id, conteudo, tipo = "texto", anexo_url } = req.body;

  if (!destinatario_id || !conteudo?.trim())
    return res.status(400).json({ error: "Destinatário e conteúdo são obrigatórios" });

  if (parseInt(destinatario_id) === me)
    return res.status(400).json({ error: "Você não pode enviar mensagem para si mesmo" });

  try {
    // Verifica se destinatário existe e está ativo
    const { rows: dest } = await pool.query(
      "SELECT id FROM users WHERE id = $1 AND active = TRUE", [destinatario_id]
    );
    if (!dest[0]) return res.status(404).json({ error: "Destinatário não encontrado" });

    const { rows } = await pool.query(`
      INSERT INTO chat_direto (remetente_id, destinatario_id, conteudo, tipo, anexo_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, conteudo, tipo, anexo_url, lida, editada, created_at, remetente_id
    `, [me, destinatario_id, conteudo.trim(), tipo, anexo_url || null]);

    res.status(201).json({ mensagem: rows[0] });
  } catch (e) {
    console.error("chat/post:", e);
    res.status(500).json({ error: "Erro ao enviar mensagem" });
  }
});

// ─────────────────────────────────────────
// PATCH /api/chat/lidas/:userId
// Marca todas as mensagens de um contato como lidas
// ─────────────────────────────────────────
router.patch("/lidas/:userId", authMiddleware(), async (req, res) => {
  const me = req.user.id;
  const outro = parseInt(req.params.userId);
  try {
    await pool.query(`
      UPDATE chat_direto SET lida = TRUE
      WHERE remetente_id = $1 AND destinatario_id = $2 AND lida = FALSE
    `, [outro, me]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Erro ao marcar como lidas" });
  }
});

// ─────────────────────────────────────────
// PATCH /api/chat/mensagens/:id
// Edita o conteúdo de uma mensagem própria
// ─────────────────────────────────────────
router.patch("/mensagens/:id", authMiddleware(), async (req, res) => {
  const me = req.user.id;
  const { conteudo } = req.body;
  if (!conteudo?.trim()) return res.status(400).json({ error: "Conteúdo não pode ser vazio" });

  try {
    const { rows } = await pool.query(`
      UPDATE chat_direto
      SET conteudo = $1, editada = TRUE, updated_at = NOW()
      WHERE id = $2 AND remetente_id = $3 AND deletada = FALSE
      RETURNING id, conteudo, editada, updated_at
    `, [conteudo.trim(), req.params.id, me]);

    if (!rows[0]) return res.status(404).json({ error: "Mensagem não encontrada ou sem permissão" });
    res.json({ mensagem: rows[0] });
  } catch (e) {
    res.status(500).json({ error: "Erro ao editar mensagem" });
  }
});

// ─────────────────────────────────────────
// DELETE /api/chat/mensagens/:id
// Soft-delete de uma mensagem própria
// ─────────────────────────────────────────
router.delete("/mensagens/:id", authMiddleware(), async (req, res) => {
  const me = req.user.id;
  try {
    const { rows } = await pool.query(`
      UPDATE chat_direto
      SET deletada = TRUE, conteudo = 'Mensagem apagada', updated_at = NOW()
      WHERE id = $1 AND remetente_id = $2
      RETURNING id
    `, [req.params.id, me]);

    if (!rows[0]) return res.status(404).json({ error: "Mensagem não encontrada ou sem permissão" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Erro ao apagar mensagem" });
  }
});

module.exports = router;
