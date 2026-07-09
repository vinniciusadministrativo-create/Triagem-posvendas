console.log("🎬 Iniciando servidor...");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { rateLimit } = require("express-rate-limit");
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  validate: false,
  keyGenerator: (req) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    return ip.replace(/:\d+$/, '').replace(/^::ffff:/, '');
  }
});
const path = require("path");
const authMiddleware = require("./middleware/auth");

console.log("🛠️ Carregando middlewares...");
const app = express();
app.set('trust proxy', 1);

// Middleware
// FRONTEND_URL pode listar múltiplas origens separadas por vírgula. Sem ela, mantém "*".
const allowedOrigins = (process.env.FRONTEND_URL || "*").split(",").map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins.includes("*") ? "*" : allowedOrigins }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

console.log("🛤️ Carregando rotas...");

// Rate limiting
const rlOptions = {
  validate: false,
  keyGenerator: (req) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    return ip.replace(/:\d+$/, '').replace(/^::ffff:/, '');
  }
};

app.use("/api/auth", rateLimit({ ...rlOptions, windowMs: 15 * 60 * 1000, max: 20 }));
app.use("/api", rateLimit({ ...rlOptions, windowMs: 60 * 1000, max: 100 }));

// Security headers
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self'",
  "connect-src 'self'",
  // estilos inline (React style={{}}) + Google Fonts
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  // imagens/vídeos servidos pelo Cloudinary
  "img-src 'self' data: blob: https://res.cloudinary.com",
  "media-src 'self' https://res.cloudinary.com",
  // preview do documento original da NF (iframe apontando para o Cloudinary)
  "frame-src 'self' https://res.cloudinary.com",
].join("; ");

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Content-Security-Policy", CSP);
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/chamados", require("./routes/chamados"));
app.use("/api/users", require("./routes/users"));
app.use("/api/ai", require("./routes/ai"));
app.use("/api/relatorios", require("./routes/relatorios"));
app.use("/api/chat", require("./routes/chat"));
app.use("/api/admin", require("./routes/admin"));

// Health check
app.get("/api/health", (req, res) => res.json({ status: "ok", ts: new Date().toISOString(), build: "2026-06-25-smtp-diag" }));

// SMTP diagnostic — restrito a admin; envia o e-mail de teste apenas para o
// próprio admin autenticado (sem destinatário arbitrário) para evitar abuso de relay.
app.get("/api/diag-smtp", authMiddleware(["admin"]), async (req, res) => {
  try {
    const { testSmtp } = require("./utils/mailer");
    const result = await testSmtp(req.user.email || process.env.SMTP_USER);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Static uploads
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Serve Built Frontend (Production Monolith)
const frontendPath = path.join(__dirname, "../../frontend/dist");
app.use(express.static(frontendPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith("index.html")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
  }
}));

// Web App SPA fallback (Must be after all other routes)
app.get(/.*/, (req, res) => {
  // Se for uma rota de API ou de UPLOADS que não foi capturada acima, retorna 404 real
  if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
    return res.status(404).json({ error: "Recurso não encontrado" });
  }
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.sendFile(path.join(frontendPath, "index.html"));
});


// Global error handler
app.use((err, req, res, next) => {
  console.error("Erro global:", err?.message, err?.stack);
  // Em produção não expõe detalhes internos do erro ao cliente.
  const isProd = process.env.NODE_ENV === "production";
  res.status(500).json({ error: isProd ? "Erro interno do servidor" : (err?.message || "Erro interno do servidor") });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 API rodando na porta ${PORT}`));

// Trigger webhook Render
