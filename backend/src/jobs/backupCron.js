const cron = require("node-cron");
const pool = require("../db");
const { generateBackupSql, backupFilename } = require("../utils/backup");
const { sendBackupEmail } = require("../utils/mailer");

/**
 * Backup automático agendado: gera o dump SQL do banco e envia por e-mail aos
 * administradores ativos. Opt-in via `BACKUP_CRON_ENABLED=true` (desligado por
 * padrão, já que o anexo contém dados sensíveis). Cadência via
 * `BACKUP_CRON_SCHEDULE` (cron, padrão: toda segunda às 03:00).
 */

/** Executa o backup e envia por e-mail. Exportado para permitir disparo manual/teste. */
async function runBackupJob() {
  try {
    const { rows } = await pool.query(
      "SELECT email FROM users WHERE role = 'admin' AND active = true AND email IS NOT NULL"
    );
    const recipients = rows.map((r) => r.email).filter(Boolean);
    if (!recipients.length) {
      console.warn("[BackupCron] Nenhum admin ativo com e-mail — backup não enviado.");
      return;
    }

    const sql = await generateBackupSql();
    const ok = await sendBackupEmail(recipients, backupFilename(), sql);
    console.log(
      ok
        ? `[BackupCron] Backup enviado a ${recipients.length} admin(s).`
        : "[BackupCron] SMTP não configurado — backup gerado mas não enviado."
    );
  } catch (e) {
    console.error("[BackupCron] Falha ao gerar/enviar backup:", e.message);
  }
}

/** Registra o agendamento se habilitado. Chamado no boot do servidor. */
function startBackupCron() {
  if (process.env.BACKUP_CRON_ENABLED !== "true") return;

  const schedule = process.env.BACKUP_CRON_SCHEDULE || "0 3 * * 1";
  if (!cron.validate(schedule)) {
    console.error(`[BackupCron] BACKUP_CRON_SCHEDULE inválido: "${schedule}" — agendamento ignorado.`);
    return;
  }

  cron.schedule(schedule, runBackupJob, { timezone: process.env.TZ || "America/Sao_Paulo" });
  console.log(`🗓️  Backup automático agendado (${schedule}).`);
}

module.exports = { startBackupCron, runBackupJob };
