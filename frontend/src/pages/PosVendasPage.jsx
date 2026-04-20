import { useState, useEffect, useCallback } from "react";
import { api } from "../api";
import ChamadoDetail from "../components/ChamadoDetail";

const M = {
  pri:"#9B1B30",priDk:"#7A1526",bg:"#fafafa",card:"#fff",alt:"#f5f3f0",
  brdN:"#e5e0db",brdL:"#d5cfc8",tx:"#1a1a1a",txM:"#4b5563",txD:"#9a948d",
  ok:"#16a34a",okS:"rgba(22,163,74,0.08)",okB:"rgba(22,163,74,0.2)",
  warn:"#d97706",warnS:"rgba(217,119,6,0.08)",warnB:"rgba(217,119,6,0.2)",
  blue:"#2563eb",blueS:"rgba(37,99,235,0.08)",blueB:"rgba(37,99,235,0.2)",
  err:"#dc2626",errS:"rgba(220,38,38,0.08)",
  soft:"rgba(155,27,48,0.07)",glow:"rgba(155,27,48,0.30)",
};

const TIPOS=[
  {id:"",label:"Todos os tipos"},
  {id:"preco_errado",label:"Preço Errado"},
  {id:"produto_avariado",label:"Produto Avariado"},
  {id:"erro_pigmentacao",label:"Erro de Pigmentação"},
  {id:"produto_defeito",label:"Produto com Defeito"},
  {id:"qtd_errada",label:"Quantidade Errada"},
  {id:"arrependimento",label:"Arrependimento / Troca"},
  {id:"recusa_entrega",label:"Recusa na Entrega"},
];

const STATUSES=[
  {id:"",label:"Todos os status"},
  {id:"novo",label:"Novo"},
  {id:"avaliacao",label:"Avaliação"},
  {id:"negociacao",label:"Negociação"},
  {id:"espelho",label:"Emitir Espelho NFD"},
  {id:"aguardando_nfd",label:"Aguard. NFD"},
  {id:"aguardando_recolhimento",label:"Aguard. Recolhimento"},
  {id:"aguardando_financeiro",label:"Aguard. Financeiro"},
  {id:"encerrado",label:"Encerrado"},
];

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

// Removido ChamadoDetail interno, utilizando componente compartilhado

export default function PosVendasPage(){
  const[chamados,setChamados]=useState([]);
  const[total,setTotal]=useState(0);
  const[loading,setLoading]=useState(false);
  const[selected,setSelected]=useState(null);
  const[page,setPage]=useState(1);

  const load=useCallback(async(p=1)=>{
    setLoading(true);
    try{
      const res=await api.getChamados({page:p,limit:200});
      setChamados(res.chamados||[]);setTotal(res.total||0);
    }catch(e){console.error(e);}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{load(1);},[]);

  const handleStatusChange=(id,newStatus)=>{
    setChamados(p=>p.map(c=>c.id===id?{...c,status:newStatus}:c));
    setSelected(null);
  };

  const handleDeleteSingle=async(id)=>{
    try{
      await api.deleteChamado(id);
      load(page);
      setSelected(null);
    }catch(e){alert("Erro ao excluir. Apenas o Admin tem essa permissão.");}
  };

  return(
    <div style={{minHeight:"100vh",background:M.bg,padding:"40px 20px 40px 90px",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      {selected&&<ChamadoDetail chamado={selected} onClose={()=>setSelected(null)} onStatusChange={handleStatusChange} onDelete={handleDeleteSingle} />}
      
      <header style={{marginBottom:30}}>
        <h1 style={{fontSize:24,fontWeight:800,color:M.tx}}>Gestão Pós-Vendas</h1>
        <p style={{color:M.txM}}>Acompanhamento e triagem de solicitações em tempo real.</p>
      </header>

      <div style={{ display: "flex", gap: 15, overflowX: "auto", paddingBottom: 20 }}>
        {STATUSES.filter(s => s.id !== "").map(column => {
          const colChamados = chamados.filter(c => c.status === column.id);
          return (
            <div 
              key={column.id} 
              style={{ minWidth: 320, maxWidth: 320, background: "#f8f9fa", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", border: `1px solid ${M.brdN}` }}
              onDragOver={e => e.preventDefault()}
              onDrop={async e => {
                e.preventDefault();
                const id = e.dataTransfer.getData("chamadoId");
                if(!id) return;
                const ch = chamados.find(c => c.id == id);
                if(ch && ch.status !== column.id) {
                  setChamados(p => p.map(c => c.id == id ? { ...c, status: column.id } : c));
                  try {
                    await api.updateStatus(id, column.id);
                  } catch(err) {
                    setChamados(p => p.map(c => c.id == id ? { ...c, status: ch.status } : c));
                    alert("Erro ao mudar status.");
                  }
                }
              }}
            >
              <div style={{ padding: "5px 10px", marginBottom: 15, fontWeight: 800, fontSize: 13, color: M.txM, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ textTransform: "uppercase" }}>{column.label}</span>
                <span style={{ background: M.brdL, padding: "2px 8px", borderRadius: 12, fontSize: 11 }}>{colChamados.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 15, flex: 1, minHeight: 200 }}>
                {colChamados.map(c => (
                  <div 
                    key={c.id} 
                    draggable 
                    onDragStart={e => e.dataTransfer.setData("chamadoId", c.id)}
                    onClick={() => setSelected(c)}
                    style={{ background: M.card, padding: 15, borderRadius: 10, border: `1px solid ${M.brdN}`, cursor: "grab", boxShadow: "0 4px 10px rgba(0,0,0,0.02)" }}
                    onDragEnd={e => e.target.style.opacity = 1}
                  >
                    <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 5 }}>{c.razao_social}</div>
                    <div style={{ fontSize: 11, color: M.txM, marginBottom: 10 }}>NF {c.nf_original} | #{c.id}</div>
                    <div style={{ fontSize: 12, color: M.txM, marginBottom: 15, display: "flex", gap: 8, alignItems: "center" }}>
                       <span style={{background: "#f1f3f5", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700}}>Vendedor</span>
                       {c.vendedor_nome || c.nome_vendedor}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: M.txD }}>{new Date(c.created_at).toLocaleDateString()}</span>
                      <span style={{ fontSize: 10, background: M.soft, color: M.pri, padding: "4px 8px", borderRadius: 6, fontWeight: 700 }}>Ver Detalhes</span>
                    </div>
                  </div>
                ))}
                {colChamados.length === 0 && <div style={{ textAlign: "center", padding: 20, color: M.txD, fontSize: 12, fontStyle: "italic", border: `1px dashed ${M.brdL}`, borderRadius: 10 }}>Arraste um card para cá</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
