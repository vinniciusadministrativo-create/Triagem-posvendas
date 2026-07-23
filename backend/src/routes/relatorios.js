const express = require("express");
const pool = require("../db");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// GET /api/relatorios/resumo — KPIs gerais
router.get("/resumo", authMiddleware(["admin", "pos_vendas"]), async (req, res) => {
  try {
    const { from, to } = req.query;
    const conditions = [];
    const params = [];

    if (from) { params.push(from); conditions.push(`c.created_at >= $${params.length}`); }
    if (to)   { params.push(to);   conditions.push(`c.created_at <= $${params.length}::date + interval '1 day'`); }

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
      pool.query(`
        SELECT razao_social as cliente, COUNT(id) as qtd
        FROM chamados c ${where}
        GROUP BY razao_social ORDER BY qtd DESC LIMIT 10
      `, params),

      // SLA de recolhimento: previsão vs real
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE data_previsao_recolhimento IS NOT NULL) as com_previsao,
          COUNT(*) FILTER (WHERE data_real_recolhimento IS NOT NULL) as recolhidos,
          COUNT(*) FILTER (WHERE data_real_recolhimento > data_previsao_recolhimento) as atrasados,
          ROUND(COALESCE(AVG(data_real_recolhimento::date - data_previsao_recolhimento::date) FILTER (WHERE data_real_recolhimento > data_previsao_recolhimento), 0), 1) as media_atraso_dias,
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

// GET /api/relatorios/chamados — lista completa para exportação CSV
router.get("/chamados", authMiddleware(["admin", "pos_vendas"]), async (req, res) => {
  try {
    const { from, to, status, tipo, vendedor_id, formato = "json" } = req.query;
    const conditions = [];
    const params = [];

    if (from)       { params.push(from);       conditions.push(`c.created_at >= $${params.length}`); }
    if (to)         { params.push(to);         conditions.push(`c.created_at <= $${params.length}::date + interval '1 day'`); }
    if (status)     { params.push(status);     conditions.push(`c.status = $${params.length}`); }
    if (tipo)       { params.push(tipo);       conditions.push(`c.tipo_solicitacao = $${params.length}`); }
    if (vendedor_id){ params.push(vendedor_id);conditions.push(`c.vendedor_id = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

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
      ORDER BY c.created_at DESC
    `, params);

    if (formato === "csv") {
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

      const STATUS_LABELS = {
        novo: "Novo",
        triagem: "Triagem",
        analise: "Análise",
        aprovado: "Aprovado",
        reprovado: "Reprovado",
        encerrado: "Encerrado",
        aguardando_recolhimento: "Ag. Recolhimento",
        recolhido: "Recolhido",
        espelho: "Emitir Espelho NFD",
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

    res.json({ chamados: rows, total: rows.length });
  } catch (e) {
    console.error("Erro ao exportar chamados:", e);
    res.status(500).json({ error: "Erro ao exportar chamados" });
  }
});

// GET /api/relatorios/historico — movimentações de status com timeline
router.get("/historico", authMiddleware(["admin", "pos_vendas"]), async (req, res) => {
  try {
    const { from, to, formato = "json" } = req.query;
    const conditions = [];
    const params = [];

    if (from) { params.push(from); conditions.push(`h.created_at >= $${params.length}`); }
    if (to)   { params.push(to);   conditions.push(`h.created_at <= $${params.length}::date + interval '1 day'`); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(`
      SELECT
        h.id,
        h.chamado_id,
        c.razao_social,
        c.nf_original,
        u.name AS usuario,
        u.role AS role_usuario,
        h.status_anterior,
        h.status_novo,
        h.created_at
      FROM chamado_historico h
      LEFT JOIN users u ON h.user_id = u.id
      LEFT JOIN chamados c ON h.chamado_id = c.id
      ${where}
      ORDER BY h.created_at DESC
    `, params);

    if (formato === "csv") {
      const headers = ["ID Histórico", "ID Chamado", "Empresa", "NF", "Usuário", "Perfil", "Status Anterior", "Status Novo", "Data/Hora"];
      const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const csvRows = rows.map(r => [
        r.id, r.chamado_id, r.razao_social, r.nf_original, r.usuario,
        r.role_usuario, r.status_anterior, r.status_novo,
        r.created_at ? new Date(r.created_at).toLocaleString("pt-BR") : "",
      ].map(escape).join(";"));

      const csv = "\uFEFF" + [headers.map(h => `"${h}"`).join(";"), ...csvRows].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="relatorio_historico_${Date.now()}.csv"`);
      return res.send(csv);
    }

    res.json({ historico: rows, total: rows.length });
  } catch (e) {
    console.error("Erro ao exportar histórico:", e);
    res.status(500).json({ error: "Erro ao exportar histórico" });
  }
});

module.exports = router;
