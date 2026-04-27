import { useState, useEffect, useCallback, useRef } from "react";
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
  {id:"negociacao",label:"Negociação"},
  {id:"espelho",label:"Emitir Espelho NFD"},
  {id:"aguardando_nfd",label:"Aguard. NFD"},
  {id:"aguardando_recolhimento",label:"Aguard. Recolhimento"},
  {id:"recolhido",label:"Recolhido"},
  {id:"aguardando_financeiro",label:"Aguard. Financeiro"},
  {id:"encerrado",label:"Encerrado"},
];

const STATUS_COLOR={
  novo:"#6b7280",negociacao:"#8b5cf6",espelho:"#9B1B30",
  aguardando_nfd:"#2563eb",aguardando_recolhimento:"#f59e0b",
  recolhido:"#059669",aguardando_financeiro:"#16a34a",encerrado:"#6b7280",
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
  const[pendingRecolhimento, setPendingRecolhimento]=useState(null);
  const[recolhimentoData, setRecolhimentoData]=useState({
    tipo_frete: "proprio",
    nome_transportadora: "",
    valor_frete: "",
    despesas: "",
    observacoes: ""
  });
  
  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch (e) {
      return {};
    }
  })();
  const isOperacional = user?.role === "operacional";

  const load=useCallback(async(p=1)=>{
    setLoading(true);
    try{
      const res=await api.getChamados({page:p,limit:200, exclude_old_encerrados: true});
      setChamados(res.chamados||[]);setTotal(res.total||0);
    }catch(e){console.error(e);}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{load(1);},[]);

  // AUTO-SCROLL LOGIC (GLOBAL)
  const kanbanRef = useRef(null);
  const scrollSpeed = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const startScrolling = () => {
      if (rafRef.current) return;
      const loop = () => {
        if (kanbanRef.current && scrollSpeed.current !== 0) {
          kanbanRef.current.scrollLeft += scrollSpeed.current;
          rafRef.current = requestAnimationFrame(loop);
        } else {
          rafRef.current = null;
        }
      };
      rafRef.current = requestAnimationFrame(loop);
    };

    const handleGlobalMouseMove = (e) => {
      if (!kanbanRef.current) return;
      
      const mouseX = e.clientX;
      const screenWidth = window.innerWidth;
      const edgeSize = 350; // Área de gatilho bem generosa
      const maxSpeed = 10;  // Velocidade ajustada

      if (mouseX < edgeSize) {
        // Lado ESQUERDO: mouseX varia de 0 a edgeSize
        // Se mouseX é 0, velocidade é maxSpeed (negativo para scrollLeft diminuir)
        scrollSpeed.current = -maxSpeed * (1 - mouseX / edgeSize);
        startScrolling();
      } else if (mouseX > screenWidth - edgeSize) {
        // Lado DIREITO: mouseX varia de (screenWidth - edgeSize) a screenWidth
        const distFromRightEdge = screenWidth - mouseX;
        scrollSpeed.current = maxSpeed * (1 - distFromRightEdge / edgeSize);
        startScrolling();
      } else {
        scrollSpeed.current = 0;
      }
    };

    const stop = () => { scrollSpeed.current = 0; };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("dragover", handleGlobalMouseMove); // Para funcionar no arraste também
    window.addEventListener("mouseup", stop);
    window.addEventListener("dragend", stop);

    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("dragover", handleGlobalMouseMove);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("dragend", stop);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

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

  const handleRecolhimentoSubmit = async (e) => {
    e.preventDefault();
    if (!pendingRecolhimento) return;
    
    const { chamadoId, columnId, ch } = pendingRecolhimento;
    
    if (recolhimentoData.tipo_frete === "transportadora" && !recolhimentoData.nome_transportadora.trim()) {
      alert("Por favor, informe o nome da transportadora.");
      return;
    }

    setPendingRecolhimento(null);
    setChamados(p => p.map(c => c.id == chamadoId ? { ...c, status: columnId } : c));
    try {
      await api.updateStatus(chamadoId, columnId, recolhimentoData);
    } catch(err) {
      setChamados(p => p.map(c => c.id == chamadoId ? { ...c, status: ch.status } : c));
      alert("Erro ao mudar status.");
    }
  };

  return(
    <div className="page-container">
      {selected&&<ChamadoDetail chamado={selected} onClose={()=>setSelected(null)} onStatusChange={handleStatusChange} onDelete={handleDeleteSingle} />}
      
      {pendingRecolhimento && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",display:"flex",justifyContent:"center",alignItems:"center",zIndex:9999}}>
          <div style={{background:M.card,padding:25,borderRadius:12,width:400,maxWidth:"90%",boxShadow:"0 10px 25px rgba(0,0,0,0.2)"}}>
            <h2 style={{fontSize:18,fontWeight:800,color:M.tx,marginBottom:15}}>Detalhes do Recolhimento</h2>
            <form onSubmit={handleRecolhimentoSubmit} style={{display:"flex",flexDirection:"column",gap:15}}>
              
              <div>
                <label style={{display:"block",fontSize:13,fontWeight:700,color:M.txM,marginBottom:5}}>Tipo de Frete</label>
                <select 
                  value={recolhimentoData.tipo_frete} 
                  onChange={e => setRecolhimentoData({...recolhimentoData, tipo_frete: e.target.value})}
                  style={{width:"100%",padding:10,borderRadius:8,border:`1px solid ${M.brdL}`,background:M.bg,outline:"none"}}
                >
                  <option value="proprio">Frete Próprio</option>
                  <option value="transportadora">Transportadora</option>
                </select>
              </div>

              {recolhimentoData.tipo_frete === "transportadora" && (
                <>
                  <div>
                    <label style={{display:"block",fontSize:13,fontWeight:700,color:M.txM,marginBottom:5}}>Nome da Transportadora *</label>
                    <input 
                      type="text" 
                      required
                      value={recolhimentoData.nome_transportadora}
                      onChange={e => setRecolhimentoData({...recolhimentoData, nome_transportadora: e.target.value})}
                      style={{width:"100%",padding:10,borderRadius:8,border:`1px solid ${M.brdL}`,background:M.bg,outline:"none"}}
                    />
                  </div>
                  <div>
                    <label style={{display:"block",fontSize:13,fontWeight:700,color:M.txM,marginBottom:5}}>Valor do Frete (R$) *</label>
                    <input 
                      type="number" step="0.01" required
                      value={recolhimentoData.valor_frete}
                      onChange={e => setRecolhimentoData({...recolhimentoData, valor_frete: e.target.value})}
                      style={{width:"100%",padding:10,borderRadius:8,border:`1px solid ${M.brdL}`,background:M.bg,outline:"none"}}
                    />
                  </div>
                </>
              )}

              <div>
                <label style={{display:"block",fontSize:13,fontWeight:700,color:M.txM,marginBottom:5}}>Outras Despesas (R$) *</label>
                <input 
                  type="number" step="0.01" required
                  value={recolhimentoData.despesas}
                  onChange={e => setRecolhimentoData({...recolhimentoData, despesas: e.target.value})}
                  style={{width:"100%",padding:10,borderRadius:8,border:`1px solid ${M.brdL}`,background:M.bg,outline:"none"}}
                />
              </div>

              <div>
                <label style={{display:"block",fontSize:13,fontWeight:700,color:M.txM,marginBottom:5}}>Observações</label>
                <textarea 
                  rows={3}
                  value={recolhimentoData.observacoes}
                  onChange={e => setRecolhimentoData({...recolhimentoData, observacoes: e.target.value})}
                  style={{width:"100%",padding:10,borderRadius:8,border:`1px solid ${M.brdL}`,background:M.bg,outline:"none",resize:"none"}}
                />
              </div>

              <div style={{display:"flex",gap:10,marginTop:10}}>
                <button type="button" onClick={() => setPendingRecolhimento(null)} style={{flex:1,padding:10,borderRadius:8,border:`1px solid ${M.brdL}`,background:M.bg,color:M.txM,fontWeight:700,cursor:"pointer"}}>
                  Cancelar
                </button>
                <button type="submit" style={{flex:1,padding:10,borderRadius:8,border:"none",background:M.ok,color:"#fff",fontWeight:700,cursor:"pointer"}}>
                  Confirmar
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      <header style={{marginBottom:30}}>
        <h1 style={{fontSize:24,fontWeight:800,color:M.tx}}>Gestão Pós-Vendas</h1>
        <p style={{color:M.txM}}>Acompanhamento e triagem de solicitações em tempo real.</p>
      </header>

      <div 
        ref={kanbanRef}
        style={{ display: "flex", gap: 15, overflowX: "auto", paddingBottom: 20 }}
      >
        {STATUSES.filter(s => {
          if (s.id === "") return false;
          if (isOperacional) {
            return ["aguardando_recolhimento", "recolhido"].includes(s.id);
          }
          return true;
        }).map(column => {
          const colChamados = chamados.filter(c => c.status === column.id);
          return (
            <div 
              key={column.id} 
              className="kanban-col"
              style={{ minWidth: 320, maxWidth: 320, background: "#f8f9fa", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", border: `1px solid ${M.brdN}` }}
              onDragOver={e => e.preventDefault()}
              onDragEnter={e => e.currentTarget.classList.add("drag-over")}
              onDragLeave={e => e.currentTarget.classList.remove("drag-over")}
              onDrop={async e => {
                e.preventDefault();
                e.currentTarget.classList.remove("drag-over");
                const id = e.dataTransfer.getData("chamadoId");
                if(!id) return;
                const ch = chamados.find(c => c.id == id);
                if(ch && ch.status !== column.id) {
                  if (column.id === "recolhido") {
                    setPendingRecolhimento({ chamadoId: id, columnId: column.id, ch });
                    setRecolhimentoData({ tipo_frete: "proprio", nome_transportadora: "", valor_frete: "", despesas: "", observacoes: "" });
                    return;
                  }

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
                    className="kanban-card"
                    draggable 
                    onDragStart={e => {
                      e.dataTransfer.setData("chamadoId", c.id);
                      e.currentTarget.classList.add("dragging");
                    }}
                    onDragEnd={e => {
                      e.currentTarget.classList.remove("dragging");
                    }}
                    onClick={() => setSelected(c)}
                    style={{ background: M.card, padding: 15, borderRadius: 10, border: `1px solid ${M.brdN}`, cursor: "grab", boxShadow: "0 4px 10px rgba(0,0,0,0.02)" }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 800, color: M.tx, marginBottom: 5, letterSpacing: "-0.01em" }}>{c.razao_social}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: M.tx, marginBottom: 10 }}>NF {c.nf_original} <span style={{color: M.txM, fontWeight: 500}}>| #{c.id}</span></div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: M.tx, marginBottom: 15, display: "flex", gap: 8, alignItems: "center" }}>
                       <span style={{background: "#f1f3f5", padding: "3px 6px", borderRadius: 4, fontSize: 10, fontWeight: 800, color: M.txM, textTransform: "uppercase"}}>Vendedor</span>
                       {c.vendedor_nome || c.nome_vendedor}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: M.txM }}>{new Date(c.created_at).toLocaleDateString()}</span>
                        {c.mensagens_count > 0 && (
                          <span title="Mensagens Ativas" style={{ fontSize: 11, fontWeight: 800, background: M.blueS, color: M.blue, padding: "2px 8px", borderRadius: 10 }}>
                            💬 {c.mensagens_count}
                          </span>
                        )}
                      </div>
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
