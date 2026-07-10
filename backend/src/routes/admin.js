const express = require("express");
const pool = require("../db");
const authMiddleware = require("../middleware/auth");
const { generateBackupSql, backupFilename } = require("../utils/backup");

const router = express.Router();

/**
 * GET /api/admin/backup — gera e baixa um dump SQL completo do banco (admin).
 *
 * A geração em JS puro (schema + dados, sem depender de pg_dump) vive em
 * `utils/backup.js`, compartilhada com o backup automático agendado. O arquivo
 * é DESTRUTIVO ao restaurar (DROP TABLE ... CASCADE) e contém `password_hash`
 * (bcrypt) — trate como sensível.
 */
router.get("/backup", authMiddleware(["admin"]), async (req, res) => {
  try {
    const sql = await generateBackupSql();
    res.setHeader("Content-Type", "application/sql; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${backupFilename()}"`);
    res.send(sql);
  } catch (e) {
    console.error("Erro ao gerar backup:", e.message);
    res.status(500).json({ error: "Erro ao gerar backup do banco" });
  }
});

// Frase exata que o admin deve digitar para confirmar o reset destrutivo.
const RESET_PHRASE = "ZERAR CHAMADOS";

/**
 * POST /api/admin/reset-chamados — apaga todos os chamados e dados relacionados (admin).
 *
 * Remove `chamados` e, por efeito das FKs `ON DELETE CASCADE`, também
 * `chamado_historico`, `chamado_mensagens` e `chamado_shares`. Preserva
 * `users` e todo o sistema de chat (`chat_*`), que não dependem de chamados.
 *
 * Proteção: exige a frase exata `RESET_PHRASE` no corpo. Operação irreversível —
 * a UI só libera após um backup ter sido baixado na mesma sessão.
 */
router.post("/reset-chamados", authMiddleware(["admin"]), async (req, res) => {
  const { confirmacao } = req.body || {};
  if (confirmacao !== RESET_PHRASE) {
    return res.status(400).json({ error: `Confirmação inválida. Digite exatamente: ${RESET_PHRASE}` });
  }
  const client = await pool.connect();
  try {
    const { rows } = await client.query("SELECT COUNT(*)::int AS n FROM chamados");
    const total = rows[0].n;
    // TRUNCATE ... CASCADE remove as tabelas filhas (histórico, mensagens, shares);
    // RESTART IDENTITY reinicia os IDs do zero.
    await client.query("TRUNCATE TABLE chamados RESTART IDENTITY CASCADE");
    res.json({
      message: `Reset concluído: ${total} chamado(s) e seus dados relacionados foram removidos. Usuários e chat preservados.`,
      removed: total,
    });
  } catch (e) {
    console.error("Erro no reset de chamados:", e.message);
    res.status(500).json({ error: "Erro ao zerar os chamados" });
  } finally {
    client.release();
  }
});

module.exports = router;
