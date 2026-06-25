const nodemailer = require("nodemailer");

const STATUS_LABELS = {
  novo: "Novo",
  avaliacao: "Em Avaliação",
  avaliado: "Avaliado",
  espelho: "Emitir Espelho NFD",
  aguardando_nfd: "Aguardando NFD",
  aguardando_recolhimento: "Aguardando Recolhimento",
  recolhido: "Recolhido",
  aguardando_financeiro: "Aguardando Financeiro",
  encerrado: "Encerrado",
};

function createTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || "587"),
    secure: parseInt(SMTP_PORT || "587") === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

async function sendStatusUpdateEmail({ toEmail, toName, chamadoId, razaoSocial, oldStatus, newStatus }) {
  const transporter = createTransporter();
  if (!transporter) return; // SMTP não configurado — silencioso

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const newLabel = STATUS_LABELS[newStatus] || newStatus;
  const oldLabel = STATUS_LABELS[oldStatus] || oldStatus;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#fafafa;border-radius:10px;overflow:hidden;border:1px solid #e5e0db;">
      <div style="background:#9B1B30;padding:20px 28px;">
        <h2 style="color:#fff;margin:0;font-size:18px;">Marin Logística — Atualização de Chamado</h2>
      </div>
      <div style="padding:24px 28px;">
        <p style="margin:0 0 16px;color:#1a1a1a;">Olá, <b>${toName || "Vendedor"}</b>.</p>
        <p style="margin:0 0 16px;color:#4b5563;">O seu chamado de pós-vendas foi atualizado:</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px 0;color:#9a948d;width:140px;">Chamado</td><td style="padding:8px 0;font-weight:700;">#${chamadoId}</td></tr>
          <tr><td style="padding:8px 0;color:#9a948d;">Cliente</td><td style="padding:8px 0;">${razaoSocial || "—"}</td></tr>
          <tr><td style="padding:8px 0;color:#9a948d;">Status anterior</td><td style="padding:8px 0;">${oldLabel}</td></tr>
          <tr><td style="padding:8px 0;color:#9a948d;">Novo status</td><td style="padding:8px 0;font-weight:700;color:#9B1B30;">${newLabel}</td></tr>
        </table>
        <p style="margin:24px 0 0;font-size:12px;color:#9a948d;">Este é um e-mail automático. Não responda esta mensagem.</p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Pós-Vendas Marin" <${from}>`,
      to: toEmail,
      subject: `Chamado #${chamadoId} — ${newLabel}`,
      html,
    });
  } catch (err) {
    console.error("[Mailer] Falha ao enviar e-mail:", err.message);
  }
}

module.exports = { sendStatusUpdateEmail };
