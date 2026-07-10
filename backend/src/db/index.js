const { Pool } = require("pg");
require("dotenv").config();

/**
 * Configuração de SSL do banco.
 * - `DATABASE_SSL=disable` → sem SSL (apenas dev/local).
 * - `DATABASE_CA` definido → valida a cadeia do certificado (recomendado em produção).
 * - Caso contrário, mantém o comportamento permissivo (necessário em provedores
 *   com certificado autoassinado). Definir `DATABASE_CA` fecha o risco de MITM.
 */
function buildSsl() {
  if (process.env.DATABASE_SSL === "disable") return false;
  if (process.env.DATABASE_CA) return { rejectUnauthorized: true, ca: process.env.DATABASE_CA };
  return { rejectUnauthorized: false };
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: buildSsl(),
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
});
pool.on("error", (err) => {
  console.error("PostgreSQL pool error:", err.message);
});
// Verificação leve de conectividade no boot. O schema (inclusive a coluna
// recolhimento_data) é gerenciado pelas migrations em db/migrations/*.sql.
pool.query("SELECT 1")
  .then(() => console.log("✅ DB conectado"))
  .catch(err => console.error("Erro na conexão com o DB:", err.message));
module.exports = pool;