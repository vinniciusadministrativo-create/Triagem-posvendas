import { useState, useEffect, useCallback } from "react";
import { api } from "../api";
import ChamadoDetail from "../components/ChamadoDetail";

const M = {
  pri:"#9B1B30",priDk:"#7A1526",bg:"#fafafa",card:"#fff",alt:"#f5f3f0",
  brdN:"#e5e0db",brdL:"#d5cfc8",tx:"#1a1a1a",txM:"#6b6560",txD:"#9a948d",
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
      const res=await api.getChamados({page:p,limit:20});
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

      <div style={{background:"#fff",borderRadius:14,border:`1px solid ${M.brdN}`,overflow:"hidden",boxShadow:"0 10px 30px rgba(0,0,0,0.05)"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead style={{background:"#f8f9fa",textAlign:"left"}}>
            <tr>
              {["Cliente","NF","Tipo","Vendedor","Status","Data","Ação"].map(h=><th key={h} style={{padding:15,fontSize:11,textTransform:"uppercase",color:M.txM}}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan="7" style={{padding:40,textAlign:"center"}}>Carregando...</td></tr> : 
             chamados.map(c=>(
              <tr key={c.id} style={{borderTop:`1px solid ${M.brdN}`}}>
                <td style={{padding:15,fontSize:14,fontWeight:700}}>{c.razao_social}</td>
                <td style={{padding:15,fontSize:13}}>{c.nf_original}</td>
                <td style={{padding:15,fontSize:12,color:M.txM}}>{c.tipo_solicitacao}</td>
                <td style={{padding:15,fontSize:12}}>{c.vendedor_nome || c.nome_vendedor}</td>
                <td style={{padding:15}}><Badge label={c.status} color={STATUS_COLOR[c.status]||"#000"} /></td>
                <td style={{padding:15,fontSize:12,color:M.txD}}>{new Date(c.created_at).toLocaleDateString()}</td>
                <td style={{padding:15}}>
                  <button onClick={()=>setSelected(c)} style={{padding:"6px 12px",borderRadius:6,border:`1px solid ${M.pri}`,background:"none",color:M.pri,fontWeight:700,cursor:"pointer"}}>Ver →</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
