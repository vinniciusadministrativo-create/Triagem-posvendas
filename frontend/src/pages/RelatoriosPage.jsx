import React, { useState, useEffect, useCallback } from "react";

const API_BASE = "/api";
const token = () => localStorage.getItem("token");
const authHeaders = () => ({ Authorization: `Bearer ${token()}`, "Content-Type": "application/json" });

const M = {
  pri: "#9B1B30",
  priLight: "#f9eaed",
  bg: "#f5f5f7",
  card: "#ffffff",
  tx: "#1a1a1a",
  txM: "#6b6560",
  brdN: "#e5e0db",
  ok: "#16a34a",
  okBg: "#dcfce7",
  warn: "#d97706",
  warnBg: "#fef3c7",
  err: "#dc2626",
  errBg: "#fee2e2",
  info: "#2563eb",
  infoBg: "#dbeafe",
  chart1: "#9B1B30",
  chart2: "#3b82f6",
  chart3: "#10b981",
  chart4: "#f59e0b",
  chart5: "#8b5cf6",
  chart6: "#ec4899",
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
};

const STATUS_COLORS = {
  novo: { bg: "#dbeafe", color: "#1d4ed8" },
  triagem: { bg: "#fef3c7", color: "#92400e" },
  analise: { bg: "#ede9fe", color: "#6d28d9" },
  aprovado: { bg: "#dcfce7", color: "#166534" },
  reprovado: { bg: "#fee2e2", color: "#991b1b" },
  encerrado: { bg: "#f3f4f6", color: "#374151" },
  aguardando_recolhimento: { bg: "#fff7ed", color: "#c2410c" },
  recolhido: { bg: "#d1fae5", color: "#065f46" },
};

const CHART_COLORS = [M.chart1, M.chart2, M.chart3, M.chart4, M.chart5, M.chart6];

function KPICard({ label, value, icon, color, bg }) {
  return (
    <div style={{
      background: M.card, borderRadius: 16, padding: "20px 24px",
      border: `1px solid ${M.brdN}`, display: "flex", alignItems: "center",
      gap: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14, background: bg || M.priLight,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 24, flexShrink: 0
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 800, color: color || M.pri, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 13, color: M.txM, marginTop: 4 }}>{label}</div>
      </div>
    </div>
  );
}

function MiniBarChart({ data, labelKey, valueKey, colors }) {
  if (!data || data.length === 0) return <p style={{ color: M.txM, textAlign: "center", padding: 20 }}>Sem dados</p>;
  const max = Math.max(...data.map(d => parseInt(d[valueKey]) || 0));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map((d, i) => {
        const pct = max > 0 ? (parseInt(d[valueKey]) / max) * 100 : 0;
        const barColor = colors ? colors[i % colors.length] : CHART_COLORS[i % CHART_COLORS.length];
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 130, fontSize: 12, color: M.tx, fontWeight: 600, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d[labelKey]}>
              {d[labelKey] || "—"}
            </div>
            <div style={{ flex: 1, background: "#f0eeec", borderRadius: 6, height: 18, position: "relative", overflow: "hidden" }}>
              <div style={{
                width: `${pct}%`, height: "100%", background: barColor,
                borderRadius: 6, transition: "width 0.5s ease"
              }} />
            </div>
            <div style={{ width: 36, fontSize: 12, fontWeight: 700, color: barColor, textAlign: "right" }}>{d[valueKey]}</div>
          </div>
        );
      })}
    </div>
  );
}

function Section({ title, children, action }) {
  return (
    <div style={{
      background: M.card, borderRadius: 16, border: `1px solid ${M.brdN}`,
      overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
    }}>
      <div style={{ padding: "16px 24px", borderBottom: `1px solid ${M.brdN}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: M.tx }}>{title}</h3>
        {action}
      </div>
      <div style={{ padding: 24 }}>{children}</div>
    </div>
  );
}

export default function RelatoriosPage() {
  const [resumo, setResumo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ from: "", to: "" });
  const [appliedFilters, setAppliedFilters] = useState({ from: "", to: "" });
  const [exportLoading, setExportLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

  // --- Lista paginada para aba "Chamados" ---
  const [chamadosList, setChamadosList] = useState([]);
  const [chamadosFilters, setChamadosFilters] = useState({ from: "", to: "", status: "", tipo: "", vendedor_id: "" });
  const [chamadosLoading, setChamadosLoading] = useState(false);
  const [users, setUsers] = useState([]);

  const fetchResumo = useCallback(async (f) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (f.from) params.set("from", f.from);
      if (f.to)   params.set("to", f.to);
      const r = await fetch(`${API_BASE}/relatorios/resumo?${params}`, { headers: authHeaders() });
      if (!r.ok) throw new Error("Falha ao carregar dados");
      const data = await r.json();
      setResumo(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchChamados = useCallback(async (f) => {
    setChamadosLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(f).forEach(([k, v]) => { if (v) params.set(k, v); });
      const r = await fetch(`${API_BASE}/relatorios/chamados?${params}`, { headers: authHeaders() });
      const data = await r.json();
      setChamadosList(data.chamados || []);
    } catch (e) {
      console.error(e);
    } finally {
      setChamadosLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/users`, { headers: authHeaders() });
      const data = await r.json();
      setUsers(data.users || []);
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchResumo({});
    fetchUsers();
  }, [fetchResumo, fetchUsers]);

  useEffect(() => {
    if (activeTab === "chamados") fetchChamados(chamadosFilters);
  }, [activeTab]);

  const handleApplyFilters = () => {
    setAppliedFilters({ ...filters });
    fetchResumo(filters);
  };

  const handleExportCSV = async (tipo) => {
    setExportLoading(true);
    try {
      const params = new URLSearchParams({ formato: "csv", ...appliedFilters });
      if (tipo === "historico") {
        const r = await fetch(`${API_BASE}/relatorios/historico?${params}`, { headers: authHeaders() });
        await downloadBlob(r, `historico_${Date.now()}.csv`);
      } else if (tipo === "chamados") {
        const p = new URLSearchParams({ formato: "csv", ...chamadosFilters });
        const r = await fetch(`${API_BASE}/relatorios/chamados?${p}`, { headers: authHeaders() });
        await downloadBlob(r, `chamados_${Date.now()}.csv`);
      } else {
        const r = await fetch(`${API_BASE}/relatorios/chamados?${params}`, { headers: authHeaders() });
        await downloadBlob(r, `chamados_${Date.now()}.csv`);
      }
    } catch (e) {
      alert("Erro ao exportar: " + e.message);
    } finally {
      setExportLoading(false);
    }
  };

  async function downloadBlob(response, filename) {
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  const handlePrint = () => window.print();

  // ──────────────────────────────
  //  RENDER
  // ──────────────────────────────

  return (
    <div style={{ padding: "24px 0" }}>
      {/* ── HEADER ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: M.tx }}>📊 Relatórios</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: M.txM }}>Extraia e exporte dados consolidados da operação</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handlePrint}
            style={{ padding: "10px 18px", borderRadius: 10, border: `1px solid ${M.brdN}`, background: M.card, color: M.tx, fontWeight: 600, cursor: "pointer", fontSize: 13 }}
          >🖨️ Imprimir</button>
          <button
            onClick={() => handleExportCSV(activeTab === "chamados" ? "chamados" : activeTab === "historico" ? "historico" : "chamados")}
            disabled={exportLoading}
            style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: M.pri, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13, opacity: exportLoading ? 0.6 : 1 }}
          >⬇️ Exportar CSV</button>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${M.brdN}`, marginBottom: 28 }}>
        {[
          { key: "dashboard", label: "📈 Dashboard" },
          { key: "chamados", label: "📋 Chamados" },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => { setActiveTab(t.key); if (t.key === "chamados") fetchChamados(chamadosFilters); }}
            style={{
              padding: "10px 20px", border: "none", background: "none", cursor: "pointer",
              fontWeight: 700, fontSize: 13,
              color: activeTab === t.key ? M.pri : M.txM,
              borderBottom: activeTab === t.key ? `2px solid ${M.pri}` : "2px solid transparent",
              marginBottom: -1,
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* ─────────── TAB: DASHBOARD ─────────── */}
      {activeTab === "dashboard" && (
        <>
          {/* Filtros de período */}
          <div style={{ background: M.card, border: `1px solid ${M.brdN}`, borderRadius: 14, padding: "16px 20px", marginBottom: 24, display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: M.txM, marginBottom: 5 }}>DATA INÍCIO</label>
              <input type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
                style={{ padding: "8px 12px", border: `1px solid ${M.brdN}`, borderRadius: 8, fontSize: 13 }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: M.txM, marginBottom: 5 }}>DATA FIM</label>
              <input type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
                style={{ padding: "8px 12px", border: `1px solid ${M.brdN}`, borderRadius: 8, fontSize: 13 }} />
            </div>
            <button
              onClick={handleApplyFilters}
              style={{ padding: "9px 20px", background: M.pri, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}
            >Filtrar</button>
            {(appliedFilters.from || appliedFilters.to) && (
              <button onClick={() => { setFilters({ from: "", to: "" }); setAppliedFilters({ from: "", to: "" }); fetchResumo({}); }}
                style={{ padding: "9px 14px", background: "none", color: M.err, border: `1px solid ${M.err}`, borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>✕ Limpar</button>
            )}
            {(appliedFilters.from || appliedFilters.to) && (
              <span style={{ fontSize: 12, color: M.txM, marginLeft: 4 }}>
                Filtrando: {appliedFilters.from || "início"} → {appliedFilters.to || "hoje"}
              </span>
            )}
          </div>

          {error && <div style={{ background: M.errBg, color: M.err, padding: 16, borderRadius: 10, marginBottom: 20 }}>❌ {error}</div>}
          {loading && <div style={{ textAlign: "center", padding: 60, color: M.txM }}>⏳ Carregando...</div>}

          {resumo && !loading && (
            <>
              {/* KPI Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
                <KPICard label="Total de Chamados" value={resumo.total} icon="📬" color={M.pri} bg={M.priLight} />
                <KPICard label="Com Previsão Recolhimento" value={resumo.sla_recolhimento?.com_previsao ?? "—"} icon="📦" color="#2563eb" bg="#dbeafe" />
                <KPICard label="Recolhidos" value={resumo.sla_recolhimento?.recolhidos ?? "—"} icon="✅" color={M.ok} bg={M.okBg} />
                <KPICard label="Atrasados no Recolhimento" value={resumo.sla_recolhimento?.atrasados ?? "—"} icon="⚠️" color={M.warn} bg={M.warnBg} />
                <KPICard label="Desvio Médio (dias)" value={resumo.sla_recolhimento?.media_desvio_dias ?? "—"} icon="📅" color={resumo.sla_recolhimento?.media_desvio_dias > 0 ? M.err : M.ok} bg={resumo.sla_recolhimento?.media_desvio_dias > 0 ? M.errBg : M.okBg} />
              </div>

              {/* Charts row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, marginBottom: 20 }}>
                <Section title="Chamados por Status">
                  <MiniBarChart
                    data={resumo.por_status.map(d => ({ ...d, label: STATUS_LABELS[d.status] || d.status }))}
                    labelKey="label"
                    valueKey="qtd"
                    colors={resumo.por_status.map(d => STATUS_COLORS[d.status]?.bg ? STATUS_COLORS[d.status].color : M.chart1)}
                  />
                </Section>

                <Section title="Chamados por Tipo de Solicitação">
                  <MiniBarChart data={resumo.por_tipo} labelKey="tipo_solicitacao" valueKey="qtd" />
                </Section>
              </div>

              <Section title="Top 10 Vendedores por Volume">
                <MiniBarChart data={resumo.por_vendedor} labelKey="vendedor" valueKey="qtd" colors={[M.chart2]} />
              </Section>
            </>
          )}
        </>
      )}

      {/* ─────────── TAB: CHAMADOS ─────────── */}
      {activeTab === "chamados" && (
        <>
          {/* Filtros */}
          <div style={{ background: M.card, border: `1px solid ${M.brdN}`, borderRadius: 14, padding: "16px 20px", marginBottom: 20, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: M.txM, marginBottom: 5 }}>INÍCIO</label>
              <input type="date" value={chamadosFilters.from} onChange={e => setChamadosFilters(f => ({ ...f, from: e.target.value }))}
                style={{ padding: "8px 12px", border: `1px solid ${M.brdN}`, borderRadius: 8, fontSize: 13 }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: M.txM, marginBottom: 5 }}>FIM</label>
              <input type="date" value={chamadosFilters.to} onChange={e => setChamadosFilters(f => ({ ...f, to: e.target.value }))}
                style={{ padding: "8px 12px", border: `1px solid ${M.brdN}`, borderRadius: 8, fontSize: 13 }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: M.txM, marginBottom: 5 }}>STATUS</label>
              <select value={chamadosFilters.status} onChange={e => setChamadosFilters(f => ({ ...f, status: e.target.value }))}
                style={{ padding: "8px 12px", border: `1px solid ${M.brdN}`, borderRadius: 8, fontSize: 13 }}>
                <option value="">Todos</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: M.txM, marginBottom: 5 }}>VENDEDOR</label>
              <select value={chamadosFilters.vendedor_id} onChange={e => setChamadosFilters(f => ({ ...f, vendedor_id: e.target.value }))}
                style={{ padding: "8px 12px", border: `1px solid ${M.brdN}`, borderRadius: 8, fontSize: 13 }}>
                <option value="">Todos</option>
                {users.filter(u => u.role === "vendedor").map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <button onClick={() => fetchChamados(chamadosFilters)}
              style={{ padding: "9px 20px", background: M.pri, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Filtrar</button>
            <button onClick={() => handleExportCSV("chamados")} disabled={exportLoading}
              style={{ padding: "9px 16px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13, opacity: exportLoading ? 0.6 : 1 }}>⬇️ CSV</button>
          </div>

          {chamadosLoading ? (
            <div style={{ textAlign: "center", padding: 60, color: M.txM }}>⏳ Carregando...</div>
          ) : (
            <div style={{ background: M.card, border: `1px solid ${M.brdN}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <div style={{ padding: "12px 20px", borderBottom: `1px solid ${M.brdN}`, fontSize: 13, color: M.txM, fontWeight: 600 }}>
                {chamadosList.length} chamados encontrados
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8f9fa" }}>
                      {["#", "Data", "Empresa", "NF", "Vendedor", "Tipo", "Status", "Previsão Recolh.", "Real Recolh."].map(h => (
                        <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, color: M.txM, textTransform: "uppercase", fontWeight: 700, whiteSpace: "nowrap", borderBottom: `1px solid ${M.brdN}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chamadosList.length === 0 ? (
                      <tr><td colSpan={9} style={{ textAlign: "center", padding: 40, color: M.txM }}>Nenhum chamado encontrado com os filtros aplicados.</td></tr>
                    ) : chamadosList.map((c, i) => {
                      const sc = STATUS_COLORS[c.status] || { bg: "#f3f4f6", color: "#374151" };
                      return (
                        <tr key={c.id} style={{ borderTop: `1px solid ${M.brdN}`, background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                          <td style={{ padding: "10px 14px", color: M.txM, fontWeight: 600 }}>#{c.id}</td>
                          <td style={{ padding: "10px 14px", whiteSpace: "nowrap", color: M.txM }}>
                            {c.created_at ? new Date(c.created_at).toLocaleDateString("pt-BR") : "—"}
                          </td>
                          <td style={{ padding: "10px 14px", fontWeight: 600, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.razao_social}>{c.razao_social || "—"}</td>
                          <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{c.nf_original || "—"}</td>
                          <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{c.vendedor_nome || "—"}</td>
                          <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{c.tipo_solicitacao || "—"}</td>
                          <td style={{ padding: "10px 14px" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: sc.bg, color: sc.color, whiteSpace: "nowrap" }}>
                              {STATUS_LABELS[c.status] || c.status}
                            </span>
                          </td>
                          <td style={{ padding: "10px 14px", whiteSpace: "nowrap", color: M.txM }}>
                            {c.data_previsao_recolhimento ? new Date(c.data_previsao_recolhimento).toLocaleDateString("pt-BR") : "—"}
                          </td>
                          <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                            {c.data_real_recolhimento ? (
                              <span style={{ color: M.ok, fontWeight: 700 }}>
                                ✓ {new Date(c.data_real_recolhimento).toLocaleDateString("pt-BR")}
                              </span>
                            ) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          [data-relatorios-root], [data-relatorios-root] * { visibility: visible !important; }
          [data-relatorios-root] { position: absolute; left: 0; top: 0; width: 100%; }
          button { display: none !important; }
        }
      `}</style>
    </div>
  );
}
