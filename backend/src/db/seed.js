const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const pool = require("../db");

/**
 * Gera uma senha aleatória forte, usada quando nenhuma é fornecida via env.
 * @returns {string}
 */
function gerarSenha() {
  return crypto.randomBytes(12).toString("base64").replace(/[+/=]/g, "").slice(0, 16) + "A1!";
}

const users = [
  {
    name: "Admin Marin",
    email: process.env.SEED_ADMIN_EMAIL || "admin@marinlog.com.br",
    password: process.env.SEED_ADMIN_PASSWORD,
    role: "admin",
  },
  {
    name: "Pós Vendas",
    email: process.env.SEED_POSVENDAS_EMAIL || "posvendas@marinlog.com.br",
    password: process.env.SEED_POSVENDAS_PASSWORD,
    role: "pos_vendas",
  },
];

async function seed() {
  const geradas = [];

  for (const u of users) {
    const senha = u.password || gerarSenha();
    const hash = await bcrypt.hash(senha, 12);

    // ON CONFLICT DO NOTHING + RETURNING: retorna linha só quando o usuário é criado.
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [u.name, u.email, hash, u.role]
    );

    if (rows.length) {
      console.log(`✅ Criado: ${u.email} (${u.role})`);
      if (!u.password) geradas.push({ email: u.email, role: u.role, senha });
    } else {
      console.log(`↩️  Já existe (inalterado): ${u.email}`);
    }
  }

  if (geradas.length) {
    console.log("\n⚠️  Senhas geradas automaticamente — anote agora (não serão exibidas de novo):");
    geradas.forEach(g => console.log(`  ${g.role.padEnd(12)} | ${g.email} | ${g.senha}`));
    console.log("\n   Dica: defina SEED_ADMIN_PASSWORD / SEED_POSVENDAS_PASSWORD para fixar as senhas.");
    console.log("   Troque-as após o primeiro acesso.");
  }

  await pool.end();
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
