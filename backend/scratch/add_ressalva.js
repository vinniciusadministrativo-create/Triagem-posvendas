const pool = require("../src/db");

async function updateSchema() {
  try {
    await pool.query("ALTER TABLE chamados ADD COLUMN IF NOT EXISTS ressalva_vendedor TEXT;");
    console.log("✅ Coluna ressalva_vendedor adicionada com sucesso!");
    process.exit(0);
  } catch (e) {
    console.error("❌ Erro ao atualizar schema:", e);
    process.exit(1);
  }
}

updateSchema();
