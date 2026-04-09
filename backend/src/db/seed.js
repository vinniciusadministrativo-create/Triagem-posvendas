const bcrypt = require("bcryptjs");
const pool = require("../db");

const users = [
  { name: "Admin Marin", email: "admin@marinlog.com.br", password: "Admin@2025!", role: "admin" },
  { name: "Pós Vendas", email: "posvendas@marinlog.com.br", password: "PosVendas@123", role: "pos_vendas" },
];

async function seed() {
  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 12);
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      [u.name, u.email, hash, u.role]
    );
    console.log(`✅ Seeded: ${u.email} (${u.role})`);
  }
  console.log("\n📋 Logins iniciais:");
  users.forEach(u => console.log(`  ${u.role.padEnd(12)} | ${u.email} | ${u.password}`));
  await pool.end();
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
