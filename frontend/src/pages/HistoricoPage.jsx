import React, { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "../api";
import ChamadoDetail from "../components/ChamadoDetail";
import { useToast } from "../components/Toast";
import { STATUS_OPTIONS, TIPO_OPTIONS, statusLabel, tipoLabel, statusColor } from "../constants/chamado";

const M = {
  pri:"#9B1B30",
  bg:"#fafafa",card:"#fff",
  brdN:"#e5e0db",
  tx:"#1a1a1a",txM:"#4b5563",txD:"#9a948d",
};

function Badge({label,color}){
  return(
    <span style={{display:"inline-block",padding:"3px 10px",borderRadius:20,background:`${color}18`,border:`1px solid ${color}40`,color,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.5,whiteSpace:"nowrap"}}>
      {label}
    </span>
  );
}

// YYYY-MM-DD local (sem UTC, evita erro de fuso nos atalhos de período)
const ymd = (d) => {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0"), day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
};

// Colunas ordenáveis: chave de ordenação (accessor) por id
const SORTERS = {
  razao_social: c => (c.razao_social || "").toLowerCase(),
  nf_original:  c => c.nf_original || "",
  tipo:         c => tipoLabel(c.tipo_solicitacao),
  vendedor:     c => (c.vendedor_nome || c.nome_vendedor || "").toLowerCase(),
  mensagens:    c => c.mensagens_count || 0,
  status:       c => statusLabel(c.status),
  created_at:   c => new Date(c.created_at).getTime() || 0,
};

const inputStyle = { padding: "9px 12px", borderRadius: 8, border: `1px solid ${M.brdN}`, fontSize: 13, fontFamily: "inherit", background: "#fff" };

export default function HistoricoPage() {
  const toast = useToast();
  const [chamados, setChamados] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [page] = useState(1);
  const [exporting, setExporting] = useState(false);

  // Filtros client-side
  const [filterText, setFilterText] = useState("");
  // Filtros server-side
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tipoFilter, setTipoFilter] = useState("");
  const [vendedorFilter, setVendedorFilter] = useState("");
  const [vendedores, setVendedores] = useState([]);

  // Ordenação
  const [sortKey, setSortKey] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");

  const serverParams = useCallback(() => {
    const p = {};
    if (from) p.from = from;
    if (to) p.to = `${to} 23:59:59`;      // Até inclusivo (fim do dia)
    if (statusFilter) p.status = statusFilter;
    if (tipoFilter) p.tipo = tipoFilter;
    if (vendedorFilter) p.vendedor_id = vendedorFilter;
    return p;
  }, [from, to, statusFilter, tipoFilter, vendedorFilter]);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await api.getChamados({ page: p, limit: 200, ...serverParams() });
      setChamados(res.chamados || []);
      setTotal(res.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [serverParams]);

  useEffect(() => { load(page); }, [page, load]);

  useEffect(() => {
    api.getContacts().then(d => setVendedores(d.contacts || [])).catch(() => {});
  }, []);

  const handleStatusChange = (id, newStatus) => {
    setChamados(p => p.map(c => c.id === id ? { ...c, status: newStatus } : c));
    setSelected(null);
  };

  const handleDeleteSingle = async (id) => {
    try {
      await api.deleteChamado(id);
      load(page);
      setSelected(null);
    } catch (e) {
      toast.error("Erro ao excluir. Apenas o Admin tem essa permissão.");
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await api.exportChamadosCSV(serverParams());
    } catch (e) {
      toast.error(e.message || "Erro ao exportar CSV.");
    } finally {
      setExporting(false);
    }
  };

  const setPeriodo = (tipo) => {
    const hoje = new Date();
    if (tipo === "hoje") { setFrom(ymd(hoje)); setTo(ymd(hoje)); }
    else if (tipo === "7dias") { const d = new Date(); d.setDate(d.getDate()-6); setFrom(ymd(d)); setTo(ymd(hoje)); }
    else if (tipo === "mes") { setFrom(ymd(new Date(hoje.getFullYear(), hoje.getMonth(), 1))); setTo(ymd(hoje)); }
  };

  const limpar = () => {
    setFrom(""); setTo(""); setStatusFilter(""); setTipoFilter(""); setVendedorFilter(""); setFilterText("");
  };

  const temFiltro = from || to || statusFilter || tipoFilter || vendedorFilter || filterText;

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "created_at" ? "desc" : "asc"); }
  };

  const filtered = useMemo(() => chamados.filter(c =>
    c.razao_social?.toLowerCase().includes(filterText.toLowerCase()) ||
    c.nf_original?.includes(filterText)
  ), [chamados, filterText]);

  const rows = useMemo(() => {
    const arr = [...filtered];
    const get = SORTERS[sortKey] || SORTERS.created_at;
    arr.sort((a, b) => {
      const x = get(a), y = get(b);
      if (x < y) return sortDir === "asc" ? -1 : 1;
      if (x > y) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const COLS = [
    { key: "razao_social", label: "Cliente" },
    { key: "nf_original", label: "NF" },
    { key: "tipo", label: "Tipo" },
    { key: "vendedor", label: "Vendedor" },
    { key: "mensagens", label: "Mensagens" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Data" },
    { key: null, label: "Ação" },
  ];

  return (
    <div className="page-container">
      {selected && <ChamadoDetail chamado={selected} onClose={() => setSelected(null)} onStatusChange={handleStatusChange} onDelete={handleDeleteSingle} />}

      <header style={{ marginBottom: 20 }}>
        <div className="responsive-header" style={{ marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: M.tx }}>🗃️ Histórico de Chamados</h1>
            <p style={{ color: M.txM }}>Consulta de todos os registros e ferramentas de filtro e exclusão.</p>
          </div>
          <button onClick={handleExport} disabled={exporting}
            style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: exporting ? M.txD : M.pri, color: "#fff", fontWeight: 800, fontSize: 13, cursor: exporting ? "default" : "pointer", whiteSpace: "nowrap" }}>
            {exporting ? "Exportando…" : "⬇️ Exportar CSV"}
          </button>
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: M.txM, textTransform: "uppercase" }}>De</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} max={to || undefined} style={inputStyle} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: M.txM, textTransform: "uppercase" }}>Até</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} min={from || undefined} style={inputStyle} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={inputStyle}>
            <option value="">Todos os status</option>
            {STATUS_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <select value={tipoFilter} onChange={e => setTipoFilter(e.target.value)} style={inputStyle}>
            <option value="">Todos os tipos</option>
            {TIPO_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <select value={vendedorFilter} onChange={e => setVendedorFilter(e.target.value)} style={inputStyle}>
            <option value="">Todos os vendedores</option>
            {vendedores.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <input placeholder="Razão Social ou NF..." value={filterText} onChange={e => setFilterText(e.target.value)}
            style={{ ...inputStyle, width: 200 }} />
          {temFiltro && (
            <button onClick={limpar} style={{ ...inputStyle, cursor: "pointer", fontWeight: 700, color: M.txM }}>Limpar</button>
          )}
        </div>

        {/* Atalhos de período + contagem */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
          {[["hoje","Hoje"],["7dias","7 dias"],["mes","Este mês"]].map(([id,lbl]) => (
            <button key={id} onClick={() => setPeriodo(id)}
              style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${M.brdN}`, background: "#fff", color: M.txM, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {lbl}
            </button>
          ))}
          <span style={{ marginLeft: "auto", fontSize: 12, color: M.txM }}>
            {loading ? "Carregando…" : `${rows.length}${filterText ? ` de ${chamados.length}` : ""} chamado(s)${total > chamados.length ? ` — mostrando os ${chamados.length} mais recentes de ${total}` : ""}`}
          </span>
        </div>
      </header>

      <div className="table-wrapper">
        <table className="table-responsive">
          <thead style={{ background: "#f8f9fa", textAlign: "left" }}>
            <tr>
              {COLS.map(col => (
                <th key={col.label} onClick={col.key ? () => toggleSort(col.key) : undefined}
                  style={{ padding: 15, fontSize: 11, textTransform: "uppercase", color: M.txM, cursor: col.key ? "pointer" : "default", userSelect: "none", whiteSpace: "nowrap" }}>
                  {col.label}{col.key && sortKey === col.key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan="8" style={{ padding: 40, textAlign: "center" }}>Carregando...</td></tr> :
             rows.map(c => (
              <tr key={c.id} style={{ borderTop: `1px solid ${M.brdN}` }}>
                <td style={{ padding: 15, fontSize: 14, fontWeight: 700 }}>{c.razao_social}</td>
                <td style={{ padding: 15, fontSize: 13 }}>{c.nf_original}</td>
                <td style={{ padding: 15, fontSize: 12, color: M.txM }}>{tipoLabel(c.tipo_solicitacao)}</td>
                <td style={{ padding: 15, fontSize: 12 }}>{c.vendedor_nome || c.nome_vendedor}</td>
                <td style={{ padding: 15, fontSize: 12 }}>
                   {c.mensagens_count > 0 ? <span style={{ fontWeight: 800 }}>💬 {c.mensagens_count}</span> : "-"}
                </td>
                <td style={{ padding: 15 }}><Badge label={statusLabel(c.status)} color={statusColor(c.status)} /></td>
                <td style={{ padding: 15, fontSize: 12, color: M.txD }}>{new Date(c.created_at).toLocaleDateString()}</td>
                <td style={{ padding: 15 }}>
                  <button onClick={() => setSelected(c)} style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${M.pri}`, background: "none", color: M.pri, fontWeight: 700, cursor: "pointer" }}>Ver →</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && <tr><td colSpan="8" style={{ padding: 40, textAlign: "center", color: M.txM }}>Nenhum chamado encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
