const express = require("express");
const pool = require("../db");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// OIDs dos tipos JSON/JSONB no PostgreSQL (para serializar objetos como JSON).
const OID_JSON = 114;
const OID_JSONB = 3802;

/** Escapa uma string para uso dentro de aspas simples em SQL (standard_conforming_strings). */
function quote(s) {
  return "'" + String(s).replace(/'/g, "''") + "'";
}

/**
 * Converte um valor devolvido pelo driver `pg` em um literal SQL válido.
 * Usa o OID da coluna para tratar JSON/JSONB corretamente; para os demais tipos
 * confia no tipo em runtime (Date, boolean, number, Buffer, etc.).
 */
function formatValue(val, dataTypeID) {
  if (val === null || val === undefined) return "NULL";
  if (dataTypeID === OID_JSON || dataTypeID === OID_JSONB) {
    return quote(JSON.stringify(val)) + "::jsonb";
  }
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "number") return Number.isFinite(val) ? String(val) : "NULL";
  if (typeof val === "bigint") return val.toString();
  if (val instanceof Date) return quote(val.toISOString());
  if (Buffer.isBuffer(val)) return "'\\x" + val.toString("hex") + "'";
  if (Array.isArray(val)) {
    // Array Postgres → literal '{...}'. Elementos string entre aspas duplas escapadas.
    const inner = val.map((el) => {
      if (el === null) return "NULL";
      if (typeof el === "number" || typeof el === "boolean") return String(el);
      return '"' + String(el).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
    }).join(",");
    return quote("{" + inner + "}");
  }
  if (typeof val === "object") return quote(JSON.stringify(val)) + "::jsonb";
  return quote(String(val));
}

/** Nome de identificador (tabela/coluna) entre aspas duplas. */
function ident(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

/**
 * GET /api/admin/backup — gera e baixa um dump SQL completo do banco (admin).
 *
 * Estratégia (JS puro, sem depender de pg_dump no host):
 *  1. Descobre as tabelas do schema `public`.
 *  2. Reconstrói o schema (sequences + CREATE TABLE com colunas/tipos/defaults/PK).
 *  3. Exporta os dados como INSERTs.
 *  4. Ajusta as sequences com setval.
 *
 * O arquivo resultante é DESTRUTIVO ao restaurar (DROP TABLE ... CASCADE):
 * destina-se a recriar o banco do zero. Contém `password_hash` (bcrypt) — trate
 * o arquivo como sensível.
 */
router.get("/backup", authMiddleware(["admin"]), async (req, res) => {
  const client = await pool.connect();
  try {
    // 1. Tabelas do schema public
    const { rows: tableRows } = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
    );
    const tables = tableRows.map((r) => r.tablename);

    // 2. Metadados de cada tabela (colunas, PK) + sequences usadas nos defaults
    const meta = {};
    const sequences = []; // { seq, table, column }
    for (const table of tables) {
      const { rows: cols } = await client.query(
        `SELECT a.attname AS name,
                pg_catalog.format_type(a.atttypid, a.atttypmod) AS type,
                a.attnotnull AS not_null,
                pg_get_expr(ad.adbin, ad.adrelid) AS default_expr
           FROM pg_attribute a
           LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
          WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped
          ORDER BY a.attnum`,
        [`"${table}"`]
      );
      const { rows: pk } = await client.query(
        `SELECT a.attname AS name
           FROM pg_index i
           JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
          WHERE i.indrelid = $1::regclass AND i.indisprimary
          ORDER BY array_position(i.indkey, a.attnum)`,
        [`"${table}"`]
      );
      meta[table] = { cols, pk: pk.map((p) => p.name) };

      for (const c of cols) {
        const m = c.default_expr && c.default_expr.match(/nextval\('([^']+)'/);
        if (m) {
          const seq = m[1].replace(/^public\./, "").replace(/"/g, "");
          sequences.push({ seq, table, column: c.name });
        }
      }
    }

    // Cabeçalho de download
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    res.setHeader("Content-Type", "application/sql; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="backup-marin-${stamp}.sql"`);

    const w = (s) => res.write(s);
    w(`-- Backup do banco Marin Triagem\n`);
    w(`-- Gerado em: ${new Date().toISOString()}\n`);
    w(`-- ATENÇÃO: restaurar este arquivo é DESTRUTIVO (DROP TABLE ... CASCADE).\n`);
    w(`-- Contém password_hash (bcrypt). Guarde em local seguro.\n\n`);
    w(`SET statement_timeout = 0;\n`);
    w(`SET client_encoding = 'UTF8';\n`);
    w(`SET standard_conforming_strings = on;\n\n`);
    w(`BEGIN;\n\n`);

    // Seção A — DROP TABLE
    for (const table of tables) {
      w(`DROP TABLE IF EXISTS ${ident(table)} CASCADE;\n`);
    }
    w(`\n`);

    // Seção B — CREATE SEQUENCE (uma vez por sequence)
    const seenSeq = new Set();
    for (const { seq } of sequences) {
      if (seenSeq.has(seq)) continue;
      seenSeq.add(seq);
      w(`CREATE SEQUENCE IF NOT EXISTS ${ident(seq)};\n`);
    }
    if (seenSeq.size) w(`\n`);

    // Seção C — CREATE TABLE
    for (const table of tables) {
      const { cols, pk } = meta[table];
      const lines = cols.map((c) => {
        let line = `  ${ident(c.name)} ${c.type}`;
        if (c.default_expr) line += ` DEFAULT ${c.default_expr}`;
        if (c.not_null) line += ` NOT NULL`;
        return line;
      });
      if (pk.length) {
        lines.push(`  PRIMARY KEY (${pk.map(ident).join(", ")})`);
      }
      w(`CREATE TABLE ${ident(table)} (\n${lines.join(",\n")}\n);\n\n`);
    }

    // Seção D — dados (INSERT)
    for (const table of tables) {
      const result = await client.query(`SELECT * FROM ${ident(table)}`);
      if (!result.rows.length) continue;
      const colNames = result.fields.map((f) => f.name);
      const colTypes = result.fields.map((f) => f.dataTypeID);
      const colList = colNames.map(ident).join(", ");
      w(`-- Dados: ${table} (${result.rows.length} linha(s))\n`);
      for (const row of result.rows) {
        const vals = colNames.map((name, i) => formatValue(row[name], colTypes[i]));
        w(`INSERT INTO ${ident(table)} (${colList}) VALUES (${vals.join(", ")});\n`);
      }
      w(`\n`);
    }

    // Seção E — ajuste das sequences
    if (sequences.length) {
      w(`-- Ajuste das sequences\n`);
      for (const { seq, table, column } of sequences) {
        w(
          `SELECT setval('${seq.replace(/'/g, "''")}', ` +
          `GREATEST(COALESCE((SELECT MAX(${ident(column)}) FROM ${ident(table)}), 0), 1));\n`
        );
      }
      w(`\n`);
    }

    w(`COMMIT;\n`);
    res.end();
  } catch (e) {
    console.error("Erro ao gerar backup:", e.message);
    // Se ainda não começamos a enviar o corpo, devolve erro JSON; senão, apenas encerra.
    if (!res.headersSent) {
      res.status(500).json({ error: "Erro ao gerar backup do banco" });
    } else {
      res.end(`\n-- ERRO durante a geração do backup: ${e.message}\n`);
    }
  } finally {
    client.release();
  }
});

// Frase exata que o admin deve digitar para confirmar o reset destrutivo.
const RESET_PHRASE = "ZERAR CHAMADOS";

/**
 * POST /api/admin/reset-chamados — apaga todos os chamados e dados relacionados (admin).
 *
 * Remove `chamados` e, por efeito das FKs `ON DELETE CASCADE`, também
 * `chamado_historico`, `chamado_mensagens` e `chamado_shares`. Preserva
 * `users` e todo o sistema de chat (`chat_*`), que não dependem de chamados.
 *
 * Proteção: exige a frase exata `RESET_PHRASE` no corpo. Operação irreversível —
 * a UI só libera após um backup ter sido baixado na mesma sessão.
 */
router.post("/reset-chamados", authMiddleware(["admin"]), async (req, res) => {
  const { confirmacao } = req.body || {};
  if (confirmacao !== RESET_PHRASE) {
    return res.status(400).json({ error: `Confirmação inválida. Digite exatamente: ${RESET_PHRASE}` });
  }
  const client = await pool.connect();
  try {
    const { rows } = await client.query("SELECT COUNT(*)::int AS n FROM chamados");
    const total = rows[0].n;
    // TRUNCATE ... CASCADE remove as tabelas filhas (histórico, mensagens, shares);
    // RESTART IDENTITY reinicia os IDs do zero.
    await client.query("TRUNCATE TABLE chamados RESTART IDENTITY CASCADE");
    res.json({
      message: `Reset concluído: ${total} chamado(s) e seus dados relacionados foram removidos. Usuários e chat preservados.`,
      removed: total,
    });
  } catch (e) {
    console.error("Erro no reset de chamados:", e.message);
    res.status(500).json({ error: "Erro ao zerar os chamados" });
  } finally {
    client.release();
  }
});

module.exports = router;
