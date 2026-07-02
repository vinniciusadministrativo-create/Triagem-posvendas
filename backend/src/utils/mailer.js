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

/**
 * Escapa caracteres especiais de HTML para evitar injeção de markup no e-mail
 * a partir de campos preenchidos pelo usuário (razão social, nome do vendedor).
 *
 * @param {*} v Valor a ser escapado (convertido para string; null/undefined → "").
 * @returns {string}
 */
function escapeHtml(v) {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Cria um transporter do Nodemailer a partir das variáveis de ambiente SMTP.
 * O modo seguro (TLS) é ativado automaticamente quando a porta é 465.
 *
 * @returns {import('nodemailer').Transporter|null} Transporter configurado,
 *          ou `null` se as variáveis SMTP obrigatórias não estiverem definidas.
 */
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

/**
 * Envia ao vendedor um e-mail HTML notificando a mudança de status de um chamado.
 * Não lança erro: se o SMTP não estiver configurado, retorna silenciosamente;
 * falhas de envio são apenas logadas (não bloqueiam o fluxo do chamado).
 *
 * @param {object} params
 * @param {string} params.toEmail E-mail de destino (vendedor).
 * @param {string} [params.toName] Nome do destinatário.
 * @param {number|string} params.chamadoId ID do chamado.
 * @param {string} [params.razaoSocial] Razão social do cliente.
 * @param {string} params.oldStatus Status anterior.
 * @param {string} params.newStatus Novo status.
 * @returns {Promise<void>}
 */
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
        <p style="margin:0 0 16px;color:#1a1a1a;">Olá, <b>${escapeHtml(toName) || "Vendedor"}</b>.</p>
        <p style="margin:0 0 16px;color:#4b5563;">O seu chamado de pós-vendas foi atualizado:</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px 0;color:#9a948d;width:140px;">Chamado</td><td style="padding:8px 0;font-weight:700;">#${escapeHtml(chamadoId)}</td></tr>
          <tr><td style="padding:8px 0;color:#9a948d;">Cliente</td><td style="padding:8px 0;">${escapeHtml(razaoSocial) || "—"}</td></tr>
          <tr><td style="padding:8px 0;color:#9a948d;">Status anterior</td><td style="padding:8px 0;">${escapeHtml(oldLabel)}</td></tr>
          <tr><td style="padding:8px 0;color:#9a948d;">Novo status</td><td style="padding:8px 0;font-weight:700;color:#9B1B30;">${escapeHtml(newLabel)}</td></tr>
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

/**
 * Diagnóstico de SMTP: valida a configuração, testa a conexão (`verify`) e tenta
 * enviar um e-mail de teste. Usado pela rota `GET /api/diag-smtp`.
 *
 * @param {string} toEmail Endereço para onde enviar o e-mail de teste.
 * @returns {Promise<{config: object, verify: string|null, send: string|null}>}
 *          Resultado de cada etapa (a senha é mascarada no retorno).
 */
async function testSmtp(toEmail) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  const result = {
    config: { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_FROM, SMTP_PASS: SMTP_PASS ? "***" : "(vazio)" },
    verify: null,
    send: null,
  };

  const transporter = createTransporter();
  if (!transporter) {
    result.verify = "SMTP não configurado (variáveis ausentes)";
    return result;
  }

  try {
    await transporter.verify();
    result.verify = "ok";
  } catch (err) {
    result.verify = `erro: ${err.message}`;
    return result;
  }

  try {
    await transporter.sendMail({
      from: `"Teste Marin" <${SMTP_FROM || SMTP_USER}>`,
      to: toEmail,
      subject: "Teste SMTP — Sistema Pós-Vendas Marin",
      text: "Se recebeu este e-mail, o SMTP está funcionando corretamente.",
    });
    result.send = "ok";
  } catch (err) {
    result.send = `erro: ${err.message}`;
  }

  return result;
}

/**
 * Envia o e-mail de redefinição de senha com o código numérico.
 *
 * @param {object} params
 * @param {string} params.toEmail Destino.
 * @param {string} [params.toName] Nome do destinatário.
 * @param {string} params.code Código numérico de verificação.
 * @returns {Promise<boolean>} `true` se enviado; `false` se o SMTP não estiver configurado.
 */
async function sendPasswordResetEmail({ toEmail, toName, code }) {
  const transporter = createTransporter();
  if (!transporter) return false; // SMTP não configurado — silencioso

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#fafafa;border-radius:10px;overflow:hidden;border:1px solid #e5e0db;">
      <div style="background:#9B1B30;padding:20px 28px;">
        <h2 style="color:#fff;margin:0;font-size:18px;">Marin Logística — Redefinição de Senha</h2>
      </div>
      <div style="padding:24px 28px;">
        <p style="margin:0 0 16px;color:#1a1a1a;">Olá, <b>${escapeHtml(toName) || "usuário"}</b>.</p>
        <p style="margin:0 0 16px;color:#4b5563;">Recebemos um pedido para redefinir a sua senha. Use o código abaixo na tela de redefinição para criar uma nova senha:</p>
        <div style="text-align:center;margin:24px 0;">
          <div style="display:inline-block;background:#fff;border:1px solid #e5e0db;border-radius:10px;padding:16px 28px;font-size:32px;font-weight:800;letter-spacing:8px;color:#9B1B30;font-family:'Courier New',monospace;">${escapeHtml(code)}</div>
        </div>
        <p style="margin:0 0 8px;font-size:12px;color:#9a948d;">O código expira em 15 minutos e só pode ser usado uma vez.</p>
        <p style="margin:0;font-size:12px;color:#9a948d;">Se você não solicitou esta redefinição, ignore este e-mail — sua senha continua a mesma.</p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Pós-Vendas Marin" <${from}>`,
      to: toEmail,
      subject: "Código de redefinição de senha — Pós-Vendas Marin",
      html,
    });
    return true;
  } catch (err) {
    console.error("[Mailer] Falha ao enviar e-mail de redefinição:", err.message);
    return false;
  }
}

module.exports = { sendStatusUpdateEmail, testSmtp, sendPasswordResetEmail };
