require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Rate limiting
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: "Muitas tentativas. Aguarde 15 minutos." } }));
app.use("/api", rateLimit({ windowMs: 60 * 1000, max: 100 }));

// Security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/chamados", require("./routes/chamados"));
app.use("/api/users", require("./routes/users"));

// Health check
app.get("/api/health", (req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

// Static uploads
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Serve Built Frontend (Production Monolith)
const frontendPath = path.join(__dirname, "../../frontend/dist");
app.use(express.static(frontendPath));

// Web App SPA fallback (Must be after all other routes)
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 API rodando na porta ${PORT}`));
