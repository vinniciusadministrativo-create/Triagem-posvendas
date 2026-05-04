const pool = require("../src/db/index");

async function main() {
  try {
    await pool.query("ALTER TABLE chamados ADD COLUMN IF NOT EXISTS recolhimento_data JSONB;");
    console.log("Column added successfully");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
