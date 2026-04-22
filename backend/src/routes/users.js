const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// GET /api/users — list all users (admin only)
router.get("/", authMiddleware(["admin"]), async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, email, telefone, role, active, created_at FROM users ORDER BY role, name"
    );
    res.json({ users: rows });
  } catch (e) {
    res.status(500).json({ error: "Erro ao listar usuários" });
  }
});

// GET /api/users/contacts — list names and emails for sharing (all roles)
router.get("/contacts", authMiddleware(), async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, email FROM users WHERE active = true ORDER BY name"
    );
    res.json({ contacts: rows });
  } catch (e) {
    res.status(500).json({ error: "Erro ao buscar contatos" });
  }
});

// POST /api/users — create user (admin only)
router.post("/", authMiddleware(["admin"]), async (req, res) => {
  const { name, email, password, role, telefone } = req.body;
  if (!name || !email || !password || !role)
    return res.status(400).json({ error: "Todos os campos são obrigatórios" });
  if (!["vendedor", "pos_vendas", "admin", "operacional"].includes(role))
    return res.status(400).json({ error: "Role inválido" });

  try {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, telefone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, telefone, role, active, created_at`,
      [name, email.toLowerCase().trim(), hash, role, telefone || null]
    );
    res.status(201).json({ user: rows[0] });
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "E-mail já cadastrado" });
    res.status(500).json({ error: "Erro ao criar usuário" });
  }
});

// PATCH /api/users/:id — toggle active (admin only)
router.patch("/:id", authMiddleware(["admin"]), async (req, res) => {
  const { active, name, role, telefone, password } = req.body;
  try {
    const updates = [];
    const params = [];
    if (active !== undefined) { params.push(active); updates.push(`active = $${params.length}`); }
    if (name) { params.push(name); updates.push(`name = $${params.length}`); }
    if (role) { params.push(role); updates.push(`role = $${params.length}`); }
    if (telefone !== undefined) { params.push(telefone); updates.push(`telefone = $${params.length}`); }
    if (req.body.email) { params.push(req.body.email.toLowerCase().trim()); updates.push(`email = $${params.length}`); }
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      params.push(hash);
      updates.push(`password_hash = $${params.length}`);
    }
    if (!updates.length) return res.status(400).json({ error: "Nenhum campo para atualizar" });

    params.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${params.length}
       RETURNING id, name, email, telefone, role, active`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: "Usuário não encontrado" });
    res.json({ user: rows[0] });
  } catch (e) {
    res.status(500).json({ error: "Erro ao atualizar usuário" });
  }
});

// PATCH /api/users/:id/password — change own password
router.patch("/:id/password", authMiddleware(), async (req, res) => {
  if (req.user.id !== parseInt(req.params.id) && req.user.role !== "admin")
    return res.status(403).json({ error: "Acesso negado" });
  const { current_password, new_password } = req.body;
  if (!new_password || new_password.length < 8)
    return res.status(400).json({ error: "Nova senha deve ter mínimo 8 caracteres" });
  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Usuário não encontrado" });
    if (req.user.role !== "admin") {
      const valid = await bcrypt.compare(current_password, rows[0].password_hash);
      if (!valid) return res.status(401).json({ error: "Senha atual incorreta" });
    }
    const hash = await bcrypt.hash(new_password, 12);
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, req.params.id]);
    res.json({ message: "Senha alterada com sucesso" });
  } catch (e) {
    res.status(500).json({ error: "Erro ao alterar senha" });
  }
});

module.exports = router;
