const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 5000, // Desiste após 5 segundos se o banco não responder
  idleTimeoutMillis: 30000,
});

pool.on("error", (err) => {
  console.error("PostgreSQL pool error:", err);
});

pool.query("ALTER TABLE chamados ADD COLUMN IF NOT EXISTS recolhimento_data JSONB;")
  .catch(err => console.error("Error adding recolhimento_data column:", err));

module.exports = pool;
