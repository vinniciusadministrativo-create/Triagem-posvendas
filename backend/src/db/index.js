const { Pool } = require("pg");
require("dotenv").config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
});
pool.on("error", (err) => {
  console.error("PostgreSQL pool error:", err.message);
});
pool.query("ALTER TABLE chamados ADD COLUMN IF NOT EXISTS recolhimento_data JSONB;")
  .then(() => console.log("✅ DB conectado e coluna verificada"))
  .catch(err => console.error("Erro na inicialização do DB:", err.message));
module.exports = pool;