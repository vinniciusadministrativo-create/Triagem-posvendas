const fs = require("fs");
const path = require("path");
const pool = require("../db");

async function migrate() {
  const migrationsDir = path.join(__dirname, "../db/migrations");
  const files = fs.readdirSync(migrationsDir).sort();

  console.log(`🚀 Iniciando migrações em: ${migrationsDir}`);

  for (const file of files) {
    if (file.endsWith(".sql")) {
      console.log(`📄 Executando: ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      await pool.query(sql);
    }
  }

  console.log("✅ Todas as migrações foram concluídas com sucesso.");
  await pool.end();
}

migrate().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
