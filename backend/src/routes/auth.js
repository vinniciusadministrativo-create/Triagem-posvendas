const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../db");
const { sendPasswordResetEmail } = require("../utils/mailer");

const router = express.Router();

const RESET_MAX_ATTEMPTS = 5;

/** Hash SHA-256 do código de redefinição (o código cru nunca é armazenado). */
function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

/** Comparação em tempo constante de dois hashes hex de mesmo tamanho. */
function safeEqualHex(a, b) {
  if (!a || !b) return false;
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "E-mail e senha obrigatórios" });

  try {
    const { rows } = await pool.query(
      "SELECT * FROM users WHERE email = $1 AND active = true",
      [email.toLowerCase().trim()]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Credenciais inválidas" });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Credenciais inválidas" });

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro interno" });
  }
});

// GET /api/auth/me  — validate token & return user info
router.get("/me", require("../middleware/auth")(), (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/forgot-password — envia um código numérico de 6 dígitos por e-mail
// Sempre responde 200 genérico (não revela se o e-mail existe — evita enumeração).
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  const generic = { message: "Se o e-mail estiver cadastrado, enviaremos um código de redefinição." };
  if (!email) return res.json(generic);

  try {
    const { rows } = await pool.query(
      "SELECT id, name, email FROM users WHERE email = $1 AND active = true",
      [email.toLowerCase().trim()]
    );
    const user = rows[0];
    if (user) {
      const code = String(crypto.randomInt(100000, 1000000)); // 6 dígitos (100000–999999)
      await pool.query(
        "UPDATE users SET reset_token_hash = $1, reset_token_expires = NOW() + interval '15 minutes', reset_attempts = 0 WHERE id = $2",
        [hashToken(code), user.id]
      );
      await sendPasswordResetEmail({ toEmail: user.email, toName: user.name, code });
    }
  } catch (e) {
    console.error("forgot-password:", e.message); // não altera a resposta genérica
  }
  return res.json(generic);
});

// POST /api/auth/verify-code — valida o código sem consumi-lo (usado na página de digitar o código)
router.post("/verify-code", async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: "E-mail e código são obrigatórios" });

  const invalido = { error: "Código inválido ou expirado. Solicite um novo." };
  try {
    const { rows } = await pool.query(
      `SELECT id, reset_token_hash, reset_attempts
       FROM users
       WHERE email = $1 AND active = true AND reset_token_expires > NOW()`,
      [email.toLowerCase().trim()]
    );
    const user = rows[0];
    if (!user || !user.reset_token_hash) return res.status(400).json(invalido);

    if (user.reset_attempts >= RESET_MAX_ATTEMPTS) {
      await pool.query(
        "UPDATE users SET reset_token_hash = NULL, reset_token_expires = NULL, reset_attempts = 0 WHERE id = $1",
        [user.id]
      );
      return res.status(429).json({ error: "Muitas tentativas. Solicite um novo código." });
    }

    if (!safeEqualHex(user.reset_token_hash, hashToken(String(code).trim()))) {
      await pool.query("UPDATE users SET reset_attempts = reset_attempts + 1 WHERE id = $1", [user.id]);
      return res.status(400).json(invalido);
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error("verify-code:", e.message);
    return res.status(500).json({ error: "Erro ao verificar código" });
  }
});

// POST /api/auth/reset-password — define nova senha a partir do e-mail + código
router.post("/reset-password", async (req, res) => {
  const { email, code, password } = req.body;
  if (!email || !code || !password)
    return res.status(400).json({ error: "E-mail, código e nova senha são obrigatórios" });
  if (password.length < 8)
    return res.status(400).json({ error: "A senha deve ter no mínimo 8 caracteres" });

  const invalido = { error: "Código inválido ou expirado. Solicite um novo." };

  try {
    const { rows } = await pool.query(
      `SELECT id, reset_token_hash, reset_attempts
       FROM users
       WHERE email = $1 AND active = true AND reset_token_expires > NOW()`,
      [email.toLowerCase().trim()]
    );
    const user = rows[0];
    if (!user || !user.reset_token_hash) return res.status(400).json(invalido);

    // Limite de tentativas: invalida o código após muitas falhas (anti brute-force)
    if (user.reset_attempts >= RESET_MAX_ATTEMPTS) {
      await pool.query(
        "UPDATE users SET reset_token_hash = NULL, reset_token_expires = NULL, reset_attempts = 0 WHERE id = $1",
        [user.id]
      );
      return res.status(429).json({ error: "Muitas tentativas. Solicite um novo código." });
    }

    if (!safeEqualHex(user.reset_token_hash, hashToken(String(code).trim()))) {
      await pool.query("UPDATE users SET reset_attempts = reset_attempts + 1 WHERE id = $1", [user.id]);
      return res.status(400).json(invalido);
    }

    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      "UPDATE users SET password_hash = $1, reset_token_hash = NULL, reset_token_expires = NULL, reset_attempts = 0 WHERE id = $2",
      [hash, user.id]
    );
    return res.json({ message: "Senha redefinida com sucesso. Você já pode fazer login." });
  } catch (e) {
    console.error("reset-password:", e.message);
    return res.status(500).json({ error: "Erro ao redefinir senha" });
  }
});

module.exports = router;
