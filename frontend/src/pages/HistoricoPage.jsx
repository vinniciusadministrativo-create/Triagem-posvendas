import React, { useState, useEffect, useCallback } from "react";
import { api } from "../api";
import ChamadoDetail from "../components/ChamadoDetail";

const M = {
  pri:"#9B1B30",
  bg:"#fafafa",card:"#fff",
  brdN:"#e5e0db",
  tx:"#1a1a1a",txM:"#4b5563",txD:"#9a948d",
};

const STATUS_COLOR={
  novo:"#6b7280",avaliacao:"#f59e0b",negociacao:"#8b5cf6",espelho:"#9B1B30",
  aguardando_nfd:"#2563eb",aguardando_recolhimento:"#059669",
  aguardando_financeiro:"#16a34a",encerrado:"#6b7280",
};

function Badge({label,color}){
  return(
    <span style={{display:"inline-block",padding:"3px 10px",borderRadius:20,background:`${color}18`,border:`1px solid ${color}40`,color,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.5,whiteSpace:"nowrap"}}>
      {label}
    </span>
  );
}

export default function HistoricoPage() {
  const [chamados, setChamados] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [filterText, setFilterText] = useState("");

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await api.getChamados({ page: p, limit: 200 });
      setChamados(res.chamados || []); 
      setTotal(res.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [page, load]);

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
      alert("Erro ao excluir. Apenas o Admin tem essa permissão.");
    }
  };

  const filtered = chamados.filter(c => 
    c.razao_social?.toLowerCase().includes(filterText.toLowerCase()) || 
    c.nf_original?.includes(filterText)
  );

  return (
    <div className="page-container">
      {selected && <ChamadoDetail chamado={selected} onClose={() => setSelected(null)} onStatusChange={handleStatusChange} onDelete={handleDeleteSingle} />}
      
      <header className="responsive-header">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: M.tx }}>🗃️ Histórico de Chamados</h1>
          <p style={{ color: M.txM }}>Consulta de todos os registros e ferramentas de filtro e exclusão.</p>
        </div>
        <div>
          <input 
             placeholder="Filtrar por Razão Social ou NF..." 
             value={filterText}
             onChange={e => setFilterText(e.target.value)}
             style={{ padding: "10px 15px", borderRadius: 8, border: `1px solid ${M.brdN}`, width: 300, fontSize: 13 }}
          />
        </div>
      </header>

      <div className="table-wrapper">
        <table className="table-responsive">
          <thead style={{ background: "#f8f9fa", textAlign: "left" }}>
            <tr>
              {["Cliente", "NF", "Tipo", "Vendedor", "Mensagens", "Status", "Data", "Ação"].map(h => <th key={h} style={{ padding: 15, fontSize: 11, textTransform: "uppercase", color: M.txM }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan="8" style={{ padding: 40, textAlign: "center" }}>Carregando...</td></tr> : 
             filtered.map(c => (
              <tr key={c.id} style={{ borderTop: `1px solid ${M.brdN}` }}>
                <td style={{ padding: 15, fontSize: 14, fontWeight: 700 }}>{c.razao_social}</td>
                <td style={{ padding: 15, fontSize: 13 }}>{c.nf_original}</td>
                <td style={{ padding: 15, fontSize: 12, color: M.txM }}>{c.tipo_solicitacao}</td>
                <td style={{ padding: 15, fontSize: 12 }}>{c.vendedor_nome || c.nome_vendedor}</td>
                <td style={{ padding: 15, fontSize: 12 }}>
                   {c.mensagens_count > 0 ? <span style={{ fontWeight: 800 }}>💬 {c.mensagens_count}</span> : "-"}
                </td>
                <td style={{ padding: 15 }}><Badge label={c.status} color={STATUS_COLOR[c.status] || "#000"} /></td>
                <td style={{ padding: 15, fontSize: 12, color: M.txD }}>{new Date(c.created_at).toLocaleDateString()}</td>
                <td style={{ padding: 15 }}>
                  <button onClick={() => setSelected(c)} style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${M.pri}`, background: "none", color: M.pri, fontWeight: 700, cursor: "pointer" }}>Ver →</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && <tr><td colSpan="8" style={{ padding: 40, textAlign: "center", color: M.txM }}>Nenhum chamado encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
