/**
 * Validação das queries de SLA de relatórios contra o banco real.
 *
 * Estratégia: além de EXECUTAR as queries (o que prova que o SQL é válido e que
 * os tipos casam), recalcula cada métrica em JS a partir das linhas cruas e
 * compara com o que o Postgres devolveu. Divergência = a query não implementa a
 * regra documentada no README › "Relatórios — regras dos indicadores".
 *
 * Somente SELECT — não altera nada.
 *
 * Uso:  cd backend && node scratch/validar_sla.js
 * Saída: exit 0 se tudo confere, 1 se houve divergência, 2 se falhou a conexão.
 */
const path = require("path");
// Roda a partir de backend/ para o dotenv achar o .env, independente do cwd.
process.chdir(path.join(__dirname, ".."));

require("dotenv").config();
const { Pool } = require("pg");

const TZ = "America/Sao_Paulo";
const HOJE_SQL = `(NOW() AT TIME ZONE '${TZ}')::date`;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
  max: 2,
});

let falhas = 0;
function checa(nome, esperadoJS, obtidoSQL) {
  const ok = String(esperadoJS) === String(obtidoSQL);
  if (!ok) falhas++;
  console.log(`  ${ok ? "ok    " : "FALHOU"} ${nome.padEnd(30)} SQL=${String(obtidoSQL).padEnd(9)} JS=${esperadoJS}`);
}

/** Diferença em dias entre duas datas 'AAAA-MM-DD' (aritmética pura, sem fuso). */
const difDias = (a, b) =>
  Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);

const media = (arr) =>
  arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;

(async () => {
  // ── 0. Ambiente ────────────────────────────────────────────────────────────
  const { rows: [env] } = await pool.query(`
    SELECT version() AS v,
           current_setting('TimeZone') AS tz,
           CURRENT_DATE::text AS current_date_banco,
           ${HOJE_SQL}::text  AS hoje_operacao
  `);
  console.log("=== AMBIENTE ===");
  console.log("  PostgreSQL    :", env.v.split(" ").slice(0, 2).join(" "));
  console.log("  TimeZone banco:", env.tz);
  console.log("  CURRENT_DATE  :", env.current_date_banco, "(usado antes da correção)");
  console.log("  hoje operacao :", env.hoje_operacao, "(usado agora)");
  if (env.current_date_banco !== env.hoje_operacao) {
    console.log("  ATENCAO: divergem — a correcao de fuso muda o card 'Em Atraso' hoje.");
  }
  const hoje = env.hoje_operacao;

  // ── 1. Linhas cruas relevantes ao SLA ──────────────────────────────────────
  const { rows } = await pool.query(`
    SELECT id, status,
           data_previsao_recolhimento::text AS prev,
           data_real_recolhimento::text     AS real
      FROM chamados ORDER BY id
  `);
  const comDatas = rows.filter(r => r.prev || r.real);
  console.log(`\n=== BASE ===\n  ${rows.length} chamados, ${comDatas.length} com alguma data de recolhimento`);
  if (comDatas.length) {
    console.log("\n  id   status                   previsao     real         atraso");
    for (const r of comDatas) {
      const at = r.prev && r.real ? difDias(r.real, r.prev) : null;
      const rot = at === null ? "—"
        : `${at > 0 ? "+" : ""}${at}d${at < 0 ? " (antecipado)" : at === 0 ? " (na data)" : ""}`;
      console.log(`  ${String(r.id).padEnd(4)} ${String(r.status).padEnd(23)} ` +
        `${String(r.prev || "—").padEnd(12)} ${String(r.real || "—").padEnd(12)} ${rot}`);
    }
  }

  // ── 2. Query NOVA — cópia fiel de routes/relatorios.js ─────────────────────
  const { rows: [q] } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE data_previsao_recolhimento IS NOT NULL) as com_previsao,
      COUNT(*) FILTER (WHERE data_real_recolhimento IS NOT NULL) as recolhidos,
      COUNT(*) FILTER (
        WHERE data_real_recolhimento IS NOT NULL
          AND data_previsao_recolhimento IS NOT NULL
          AND data_real_recolhimento > data_previsao_recolhimento
      ) as atrasados,
      ROUND(COALESCE(AVG(
        GREATEST(data_real_recolhimento - data_previsao_recolhimento, 0)
      ) FILTER (
        WHERE data_real_recolhimento IS NOT NULL
          AND data_previsao_recolhimento IS NOT NULL
      ), 0), 1) as media_atraso_dias,
      ROUND(COALESCE(AVG(
        data_real_recolhimento - data_previsao_recolhimento
      ) FILTER (
        WHERE data_real_recolhimento IS NOT NULL
          AND data_previsao_recolhimento IS NOT NULL
          AND data_real_recolhimento > data_previsao_recolhimento
      ), 0), 1) as media_atraso_atrasados_dias,
      COUNT(*) FILTER (
        WHERE data_real_recolhimento IS NULL
          AND data_previsao_recolhimento IS NOT NULL
          AND data_previsao_recolhimento < ${HOJE_SQL}
      ) as pendentes_atrasados,
      ROUND(COALESCE(AVG(
        ${HOJE_SQL} - data_previsao_recolhimento
      ) FILTER (
        WHERE data_real_recolhimento IS NULL
          AND data_previsao_recolhimento IS NOT NULL
          AND data_previsao_recolhimento < ${HOJE_SQL}
      ), 0), 1) as media_atraso_pendentes_dias,
      ROUND(COALESCE(SUM(
        COALESCE(NULLIF(recolhimento_data->>'valor_frete', '')::numeric, 0) +
        COALESCE(NULLIF(recolhimento_data->>'despesas', '')::numeric, 0)
      ), 0), 2) as desvio_reais
    FROM chamados c
  `);

  // ── 3. Recálculo independente em JS ────────────────────────────────────────
  const concluidos = rows.filter(r => r.real && r.prev);
  const atrasadosJS = concluidos.filter(r => difDias(r.real, r.prev) > 0);
  const pendentesJS = rows.filter(r => !r.real && r.prev && r.prev < hoje);

  console.log("\n=== SQL x RECALCULO EM JS ===");
  checa("com_previsao", rows.filter(r => r.prev).length, q.com_previsao);
  checa("recolhidos", rows.filter(r => r.real).length, q.recolhidos);
  checa("atrasados", atrasadosJS.length, q.atrasados);
  checa("media_atraso_dias",
    media(concluidos.map(r => Math.max(difDias(r.real, r.prev), 0))).toFixed(1),
    q.media_atraso_dias);
  checa("media_atraso_atrasados_dias",
    media(atrasadosJS.map(r => difDias(r.real, r.prev))).toFixed(1),
    q.media_atraso_atrasados_dias);
  checa("pendentes_atrasados", pendentesJS.length, q.pendentes_atrasados);
  checa("media_atraso_pendentes_dias",
    media(pendentesJS.map(r => difDias(hoje, r.prev))).toFixed(1),
    q.media_atraso_pendentes_dias);

  // ── 4. Correções 1 e 2, explicitamente ─────────────────────────────────────
  console.log("\n=== REGRAS DE NEGOCIO ===");
  const antecipados = concluidos.filter(r => difDias(r.real, r.prev) < 0);
  const naData = concluidos.filter(r => difDias(r.real, r.prev) === 0);
  console.log(`  concluidos com previsao: ${concluidos.length}` +
    ` (atrasados ${atrasadosJS.length} | na data ${naData.length} | antecipados ${antecipados.length})`);

  if (Number(q.media_atraso_dias) < 0) {
    falhas++; console.log("  FALHOU Correcao 1: media_atraso_dias NEGATIVA");
  } else {
    console.log("  ok     Correcao 1: media nunca negativa");
  }

  if (antecipados.length || naData.length) {
    const semClamp = media(concluidos.map(r => difDias(r.real, r.prev))).toFixed(1);
    console.log(`  ok     Correcao 1: clamp ativo — sem GREATEST a media seria ${semClamp}, com clamp e ${q.media_atraso_dias}`);
  } else {
    console.log("  n/a    Correcao 1: base sem coleta antecipada/na data — clamp nao exercitado");
  }

  // Correção 2: pendente vencido não pode aparecer em `atrasados`.
  const vazamento = atrasadosJS.filter(r => !r.real).length;
  if (vazamento > 0) {
    falhas++; console.log(`  FALHOU Correcao 2: ${vazamento} pendente(s) contado(s) como atrasado`);
  } else {
    console.log(`  ok     Correcao 2: ${pendentesJS.length} pendente(s) vencido(s) fora de 'atrasados', em card proprio`);
  }

  // ── 5. Top 10 por CNPJ x por razão social ──────────────────────────────────
  const { rows: porCnpj } = await pool.query(`
    SELECT (array_agg(c.razao_social ORDER BY c.created_at DESC))[1] as cliente,
           MAX(c.cnpj) as cnpj, COUNT(c.id) as qtd
      FROM chamados c
     GROUP BY COALESCE(NULLIF(c.cnpj, ''), c.razao_social)
     ORDER BY qtd DESC, cliente ASC LIMIT 10
  `);
  const { rows: porRazao } = await pool.query(`
    SELECT razao_social as cliente, COUNT(id) as qtd
      FROM chamados c GROUP BY razao_social ORDER BY qtd DESC, cliente ASC LIMIT 10
  `);
  console.log("\n=== TOP 10 CLIENTES ===");
  console.log("  agrupado por CNPJ (novo):");
  porCnpj.forEach(r => console.log(`    ${String(r.qtd).padStart(4)}  ${r.cliente}  [${r.cnpj || "sem cnpj"}]`));
  const igual = JSON.stringify(porCnpj.map(r => [r.cliente, r.qtd])) ===
                JSON.stringify(porRazao.map(r => [r.cliente, r.qtd]));
  if (igual) {
    console.log("  (identico ao agrupamento antigo — nenhum CNPJ fragmentado nesta base)");
  } else {
    console.log("  por razao social (antigo) — DIFERE, havia cliente fragmentado:");
    porRazao.forEach(r => console.log(`    ${String(r.qtd).padStart(4)}  ${r.cliente}`));
  }

  // ── 6. Fuso nos limites do período ─────────────────────────────────────────
  const { rows: [t] } = await pool.query(`
    SELECT ($1::date)::timestamp AT TIME ZONE '${TZ}' AS ini_novo,
           $1::date::timestamptz                      AS ini_antigo,
           (($1::date + interval '1 day')::timestamp AT TIME ZONE '${TZ}') AS fim_novo
  `, ["2026-07-01"]);
  console.log("\n=== FUSO NO RECORTE DE PERIODO ===");
  console.log("  from=2026-07-01 novo   :", t.ini_novo.toISOString());
  console.log("  from=2026-07-01 antigo :", t.ini_antigo.toISOString());
  console.log("  to  =2026-07-01 limite sup. exclusivo:", t.fim_novo.toISOString());
  const desloc = (t.ini_antigo - t.ini_novo) / 3600000;
  console.log(`  deslocamento corrigido: ${desloc}h` + (desloc === 0
    ? " (banco ja em SP — correcao e no-op hoje, protege se o TZ mudar)"
    : " (chamados nessa janela caiam no dia errado)"));

  // ── 7. Smoke test do filtro de período ─────────────────────────────────────
  const { rows: [smoke] } = await pool.query(`
    SELECT COUNT(*)::int AS n FROM chamados c
     WHERE c.created_at >= ($1::date)::timestamp AT TIME ZONE '${TZ}'
       AND c.created_at <  ($2::date + interval '1 day')::timestamp AT TIME ZONE '${TZ}'
  `, ["2020-01-01", "2030-12-31"]);
  console.log(`\n  filtro de periodo amplo devolve ${smoke.n} de ${rows.length} chamados`);
  console.log(`  desvio_reais: R$ ${q.desvio_reais}`);

  console.log(falhas === 0
    ? "\nOK — TODAS AS VALIDACOES PASSARAM. SQL confere com a regra documentada."
    : `\nFALHA — ${falhas} divergencia(s) entre o SQL e a regra.`);

  await pool.end();
  process.exit(falhas === 0 ? 0 : 1);
})().catch(err => {
  console.error("\nERRO:", err.message);
  if (err.code) console.error("  code:", err.code);
  pool.end().catch(() => {});
  process.exit(2);
});
