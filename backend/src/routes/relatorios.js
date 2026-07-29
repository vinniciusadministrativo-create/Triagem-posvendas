const express = require("express");
const pool = require("../db");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// Fuso da operação. `chamados.created_at` é TIMESTAMPTZ: comparar direto com
// literais de data usaria o TZ do servidor de banco (UTC em produção),
// deslocando os limites do dia em ~3h e jogando chamados do fim da tarde para
// o dia seguinte. Todos os recortes de período passam por aqui.
const TZ = "America/Sao_Paulo";

/** Data de "hoje" no fuso da operação, para SQL. Não usar `CURRENT_DATE` (UTC). */
const HOJE_SQL = `(NOW() AT TIME ZONE '${TZ}')::date`;

/**
 * Monta as condições de período (`from`/`to`) de uma coluna de data/hora.
 * `from` é inclusivo; `to` é inclusivo no dia (limite superior exclusivo na
 * meia-noite seguinte, no fuso da operação).
 *
 * @param {string} coluna Coluna qualificada (ex.: `c.created_at`).
 * @param {string|undefined} from Data inicial `AAAA-MM-DD`.
 * @param {string|undefined} to Data final `AAAA-MM-DD`.
 * @param {any[]} params Array de parâmetros da query — mutado (push) em ordem.
 * @returns {string[]} Condições SQL para compor o WHERE.
 */
function periodoConditions(coluna, from, to, params) {
  const conditions = [];
  if (from) {
    params.push(from);
    conditions.push(`${coluna} >= ($${params.length}::date)::timestamp AT TIME ZONE '${TZ}'`);
  }
  if (to) {
    params.push(to);
    conditions.push(`${coluna} < ($${params.length}::date + interval '1 day')::timestamp AT TIME ZONE '${TZ}'`);
  }
  return conditions;
}

// GET /api/relatorios/resumo — KPIs gerais
router.get("/resumo", authMiddleware(["admin", "pos_vendas"]), async (req, res) => {
  try {
    const { from, to } = req.query;
    const params = [];
    const conditions = periodoConditions("c.created_at", from, to, params);

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [total, porStatus, porTipo, porCliente, slaRecolhimento, porVendedorMotivo, encerramentos] = await Promise.all([
      // Total de chamados
      pool.query(`SELECT COUNT(*) as total FROM chamados c ${where}`, params),

      // Distribuição por status
      pool.query(`
        SELECT status, COUNT(*) as qtd
        FROM chamados c ${where}
        GROUP BY status ORDER BY qtd DESC
      `, params),

      // Distribuição por tipo de solicitação
      pool.query(`
        SELECT tipo_solicitacao, COUNT(*) as qtd
        FROM chamados c ${where}
        GROUP BY tipo_solicitacao ORDER BY qtd DESC
      `, params),

      // Chamados por cliente (top 10)
      // Agrupa por CNPJ (identidade real do cliente) e não por razão social: a
      // mesma empresa cadastrada com grafias diferentes contava como 2 clientes e
      // dividia o volume. Sem CNPJ, cai na razão social. O nome exibido é o da
      // grafia mais recente. Tie-break por nome mantém o Top 10 determinístico
      // quando há empate na 10ª posição.
      pool.query(`
        SELECT
          (array_agg(c.razao_social ORDER BY c.created_at DESC))[1] as cliente,
          MAX(c.cnpj) as cnpj,
          COUNT(c.id) as qtd
        FROM chamados c ${where}
        GROUP BY COALESCE(NULLIF(c.cnpj, ''), c.razao_social)
        ORDER BY qtd DESC, cliente ASC LIMIT 10
      `, params),

      // ── SLA de recolhimento: previsão × realização ───────────────────────────
      // Regras (ver README › "Relatórios — regras dos indicadores"):
      //  • "Recolhimento concluído" = `data_real_recolhimento` preenchida. É o
      //    único fato de conclusão disponível (o status pode ser movido sem data).
      //  • Atraso de um registro = GREATEST(real - previsão, 0): recolhimento
      //    antecipado ou na data prevista conta 0 dia, nunca valor negativo.
      //  • Apenas registros CONCLUÍDOS (com previsão) entram em `atrasados` e nas
      //    médias. Recolhimentos em andamento com previsão vencida NÃO viram
      //    atraso consolidado — são contados em `pendentes_atrasados`.
      //  • Registros sem previsão ficam fora de qualquer cálculo de atraso.
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE data_previsao_recolhimento IS NOT NULL) as com_previsao,
          COUNT(*) FILTER (WHERE data_real_recolhimento IS NOT NULL) as recolhidos,

          -- Concluídos que estouraram a previsão
          COUNT(*) FILTER (
            WHERE data_real_recolhimento IS NOT NULL
              AND data_previsao_recolhimento IS NOT NULL
              AND data_real_recolhimento > data_previsao_recolhimento
          ) as atrasados,

          -- Média de atraso de TODOS os recolhimentos concluídos com previsão.
          -- Antecipados/na data entram como 0 (GREATEST) em vez de valor negativo.
          ROUND(COALESCE(AVG(
            GREATEST(data_real_recolhimento - data_previsao_recolhimento, 0)
          ) FILTER (
            WHERE data_real_recolhimento IS NOT NULL
              AND data_previsao_recolhimento IS NOT NULL
          ), 0), 1) as media_atraso_dias,

          -- Média considerando somente quem realmente atrasou (denominador = atrasados)
          ROUND(COALESCE(AVG(
            data_real_recolhimento - data_previsao_recolhimento
          ) FILTER (
            WHERE data_real_recolhimento IS NOT NULL
              AND data_previsao_recolhimento IS NOT NULL
              AND data_real_recolhimento > data_previsao_recolhimento
          ), 0), 1) as media_atraso_atrasados_dias,

          -- Em andamento com previsão vencida (métrica de acompanhamento, não de SLA fechado)
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
        FROM chamados c ${where}
      `, params),
      // Motivos por vendedor
      pool.query(`
        SELECT u.name as vendedor, c.tipo_solicitacao, COUNT(c.id) as qtd
        FROM chamados c
        LEFT JOIN users u ON c.vendedor_id = u.id
        ${where}
        GROUP BY u.name, c.tipo_solicitacao
        ORDER BY u.name ASC, qtd DESC
      `, params),
      // Encerramentos por resolução (atendido/indeferido)
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE encerramento_data->>'resolucao' = 'atendido')   as atendidos,
          COUNT(*) FILTER (WHERE encerramento_data->>'resolucao' = 'indeferido') as indeferidos
        FROM chamados c ${where}
      `, params),
    ]);

    res.json({
      total: parseInt(total.rows[0].total),
      por_status: porStatus.rows,
      por_tipo: porTipo.rows,
      por_cliente: porCliente.rows, 
      por_vendedor_motivo: porVendedorMotivo.rows,
      sla_recolhimento: slaRecolhimento.rows[0],
      encerramentos: encerramentos.rows[0],
    });
  } catch (e) {
    console.error("Erro ao gerar resumo:", e);
    res.status(500).json({ error: "Erro ao gerar resumo" });
  }
});

// Paginação da listagem JSON. O CSV ignora (o export precisa da base inteira).
const CHAMADOS_LIMIT_DEFAULT = 50;
const CHAMADOS_LIMIT_MAX = 200;

// GET /api/relatorios/chamados — listagem paginada (JSON) ou export completo (CSV)
router.get("/chamados", authMiddleware(["admin", "pos_vendas"]), async (req, res) => {
  try {
    const { from, to, status, tipo, vendedor_id, formato = "json" } = req.query;
    const params = [];
    const conditions = periodoConditions("c.created_at", from, to, params);

    if (status)     { params.push(status);     conditions.push(`c.status = $${params.length}`); }
    if (tipo)       { params.push(tipo);       conditions.push(`c.tipo_solicitacao = $${params.length}`); }
    if (vendedor_id){ params.push(vendedor_id);conditions.push(`c.vendedor_id = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    // Paginação só na resposta JSON (a tabela da UI). No CSV o usuário espera a
    // base completa do filtro, então `paginacao` fica vazia.
    const isCsv = formato === "csv";
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || CHAMADOS_LIMIT_DEFAULT, 1),
      CHAMADOS_LIMIT_MAX
    );
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    let paginacao = "";
    if (!isCsv) {
      params.push(limit, offset);
      paginacao = `LIMIT $${params.length - 1} OFFSET $${params.length}`;
    }

    const { rows } = await pool.query(`
      SELECT
        c.id,
        c.created_at,
        c.updated_at,
        u.name            AS vendedor_nome,
        c.codigo_cliente,
        c.razao_social,
        c.cnpj,
        c.telefone,
        c.tipo_solicitacao,
        c.status,
        c.nf_original,
        c.responsavel,
        c.descricao,
        c.ressalva_vendedor,
        c.recolhimento_data,
        c.data_previsao_recolhimento,
        c.data_real_recolhimento,
        (SELECT COUNT(*) FROM chamado_mensagens m WHERE m.chamado_id = c.id) AS total_mensagens
      FROM chamados c
      LEFT JOIN users u ON c.vendedor_id = u.id
      ${where}
      ORDER BY c.created_at DESC, c.id DESC
      ${paginacao}
    `, params);

    if (isCsv) {
      const headers = [
        "ID", "Criado em", "Atualizado em", "Vendedor", "Cód. Cliente",
        "Razão Social", "CNPJ", "Telefone", "Tipo Solicitação", "Status",
        "NF Original", "Responsável", "Descrição", "Ressalva Vendedor",
        "Data Recolhimento (Form)", "Previsão Recolhimento", "Data Real Recolhimento"
      ];

      const formatBR = (date) => {
        if (!date) return "";
        const d = new Date(date);
        if (isNaN(d.getTime())) return "";
        return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      };

      const safeDate = (val) => {
        if (!val) return "";
        const d = new Date(val);
        if (isNaN(d.getTime())) return "";
        // Se for string de data curta, ajusta para meio-dia para evitar erro de fuso
        const s = String(val);
        if (s.length <= 10 || (s.includes('-') && !s.includes(':'))) {
          return new Date(s.split('T')[0] + "T12:00:00").toLocaleDateString("pt-BR");
        }
        return d.toLocaleDateString("pt-BR");
      };

      const formatCNPJ = (val) => {
        const s = String(val || "").replace(/\D/g, "");
        if (s.length !== 14) return s;
        return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12, 14)}`;
      };

      const TIPO_LABELS = {
        preco_errado: "Preço Errado",
        produto_avariado: "Produto Avariado",
        erro_pigmentacao: "Erro de Pigmentação",
        produto_defeito: "Produto com Defeito",
        qtd_errada: "Quantidade Errada",
        arrependimento: "Arrependimento / Troca",
        recusa_entrega: "Recusa na Entrega",
      };

      // Espelha os estágios reais do kanban (frontend/src/constants/chamado.js).
      // Os rótulos antigos (triagem/analise/aprovado/reprovado) não existem mais no
      // fluxo e faziam o CSV exportar a chave crua para os estágios ativos.
      const STATUS_LABELS = {
        novo: "Novo",
        avaliacao: "Avaliação",
        avaliado: "Avaliado",
        espelho: "Emitir Espelho NFD",
        aguardando_nfd: "Aguard. NFD",
        aguardando_recolhimento: "Aguard. Recolhimento",
        recolhido: "Recolhido",
        aguardando_financeiro: "Aguard. Financeiro",
        encerrado: "Encerrado",
      };

      const escape = (v) => {
        if (v === null || v === undefined) return "";
        const s = String(v).replace(/"/g, '""');
        return `"${s}"`;
      };

      const csvRows = rows.map(r => [
        r.id,
        formatBR(r.created_at),
        formatBR(r.updated_at),
        r.vendedor_nome,
        r.codigo_cliente,
        r.razao_social,
        formatCNPJ(r.cnpj),
        r.telefone,
        TIPO_LABELS[r.tipo_solicitacao] || r.tipo_solicitacao,
        STATUS_LABELS[r.status] || r.status,
        r.nf_original,
        r.responsavel,
        r.descricao,
        r.ressalva_vendedor,
        safeDate(r.recolhimento_data?.data_recolhimento),
        safeDate(r.data_previsao_recolhimento),
        safeDate(r.data_real_recolhimento),
      ].map(escape).join(";"));

      const csv = "\uFEFF" + [headers.map(h => `"${h}"`).join(";"), ...csvRows].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="relatorio_chamados_${Date.now()}.csv"`);
      return res.send(csv);
    }

    // `total` é a contagem do filtro inteiro (não da página) — a UI usa para o
    // rodapé "x–y de z". Os 2 últimos params são limit/offset, fora do COUNT.
    const filtroParams = params.slice(0, params.length - 2);
    const { rows: cnt } = await pool.query(
      `SELECT COUNT(*) as total FROM chamados c ${where}`, filtroParams
    );

    res.json({
      chamados: rows,
      total: parseInt(cnt[0].total, 10),
      limit,
      offset,
    });
  } catch (e) {
    console.error("Erro ao exportar chamados:", e);
    res.status(500).json({ error: "Erro ao exportar chamados" });
  }
});

module.exports = router;
