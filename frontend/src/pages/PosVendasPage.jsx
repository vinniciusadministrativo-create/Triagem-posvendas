import { useState, useEffect, useCallback } from "react";
import { api } from "../api";

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

// O componente DANFE e ChamadoDetail são mantidos aqui por serem específicos desta página
function DANFE({nf: nfRaw, chamado, isEditing, onChange}) {
  let nf = nfRaw;
  if (typeof nf === "string") { try { nf = JSON.parse(nf); } catch(e) { nf = {}; } }
  nf = nf || {};

  const d = {
    ...nf,
    razao_social_dest: nf.razao_social_dest || chamado?.razao_social || "",
    cnpj_dest: nf.cnpj_dest || chamado?.cnpj || "",
    telefone_dest: nf.telefone_dest || chamado?.telefone || "",
    natureza_operacao: nf.natureza_operacao || "1202 - DEVOLUÇÃO DE VENDA DE MERCADORIA",
    base_icms: nf.base_icms || "0,00",
    valor_icms: nf.valor_icms || "0,00",
    base_icms_st: nf.base_icms_st || "0,00",
    valor_icms_st: nf.valor_icms_st || "0,00",
    valor_total_produtos: nf.valor_total_produtos || "0,00",
    valor_total_nota: nf.valor_total_nota || "0,00",
    valor_frete: nf.valor_frete || "0,00",
    valor_seguro: nf.valor_seguro || "0,00",
    valor_ipi: nf.valor_ipi || "0,00",
    outras_despesas: nf.outras_despesas || "0,00",
    desconto: nf.desconto || "0,00",
    placa_veiculo: nf.placa_veiculo || "-",
    placa_uf: nf.placa_uf || "-",
    quantidade_volumes: nf.quantidade_volumes || "",
    especie_volumes: nf.especie_volumes || "",
    peso_bruto: nf.peso_bruto || "",
    peso_liquido: nf.peso_liquido || "",
  };
  
  const prods=d.produtos?.length?d.produtos.map(p=>({cst:"000",aliq_icms:"0,00",aliq_ipi:"0,00",...p})):[{}];
  const now=new Date();
  const footerMsg = `ESPELHO NFD REF.NF-${chamado.nf_original} - CFOP CORRETO 5202`;

  const boxStyle = { border: "1px solid #000", padding: "2px 4px", fontSize: "7px", minHeight: "22px", display: "flex", flexDirection: "column", boxSizing: "border-box" };
  const labelStyle = { fontSize: "6px", fontWeight: "700", textTransform: "uppercase", marginBottom: "1px" };
  const valueStyle = { fontSize: "9px", fontWeight: "500", fontFamily: "'IBM Plex Mono', monospace", flex: 1, display: "flex", alignItems: "center" };
  const sectionTitle = { fontSize: "7px", fontWeight: "800", textTransform: "uppercase", padding: "4px 0 2px 2px" };

  return (
    <div id="danfe-print-wrapper" style={{ width: "100%", display: "flex", justifyContent: "center", background: "#f5f5f5", padding: "20px 0" }}>
      <div id="danfe-print" style={{ background: "#fff", padding: "5mm", color: "#000", position: "relative", width: "210mm", minHeight: "297mm", boxSizing: "border-box", border: "1px solid #000", display: "flex", flexDirection: "column", boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%) rotate(-35deg)", fontSize: "60px", fontWeight: "900", color: "rgba(0,0,0,0.03)", pointerEvents: "none", zIndex: 0, textAlign: "center", width: "100%" }}>Não tem valor fiscal.<br/>Simples conferência.</div>
        <div style={{ position: "relative", zIndex: 1, flex: 1 }}>
           {/* Cabeçalho Simplificado para o Espelho */}
           <div style={{ border: "1px solid #000", padding: 10, textAlign: "center", fontWeight: 800 }}>MARIN LOGISTICA - ESPELHO NFD</div>
           <div style={{ ...sectionTitle, marginTop: 10 }}>Dados do Destinatário</div>
           <div style={{ border: "1px solid #000", padding: 8 }}>
              <div><b>Razão Social:</b> {d.razao_social_dest}</div>
              <div><b>CNPJ:</b> {d.cnpj_dest}</div>
              <div style={{ marginTop: 5 }}><b>Endereço:</b> {d.endereco_dest}, {d.municipio_dest} - {d.uf_dest}</div>
           </div>
           {/* ... Resto do DANFE simplificado ... */}
           <p style={{ fontSize: 10, marginTop: 20 }}>Conteúdo completo extraído pela IA Marin.</p>
        </div>
      </div>
    </div>
  );
}

function ChamadoDetail({chamado,onClose,onStatusChange,onDelete}){
  const[newStatus,setNewStatus]=useState(chamado.status||"novo");
  const[saving,setSaving]=useState(false);

  const save=async()=>{
    setSaving(true);
    try{await api.updateStatus(chamado.id,newStatus);onStatusChange(chamado.id,newStatus);}
    catch(e){alert(e.message);}
    finally{setSaving(false);}
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1100,padding:20}}>
      <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:600,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{padding:20,borderBottom:`1px solid ${M.brdN}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <h2 style={{margin:0,fontSize:18}}>Chamado #{chamado.id}</h2>
          <button onClick={onClose} style={{border:"none",background:"none",fontSize:20,cursor:"pointer"}}>×</button>
        </div>
        <div style={{padding:20}}>
          <div style={{marginBottom:15}}>
            <Badge label={chamado.status} color={STATUS_COLOR[chamado.status]} />
            <h3 style={{marginTop:10,marginBottom:5}}>{chamado.razao_social}</h3>
            <p style={{color:M.txM,fontSize:13}}>NF: {chamado.nf_original} | Vendedor: {chamado.vendedor_nome || chamado.nome_vendedor}</p>
          </div>
          
          <div style={{background:M.bg,padding:15,borderRadius:10,marginBottom:20}}>
            <p style={{fontSize:14,lineHeight:1.6}}>{chamado.descricao}</p>
          </div>

          {chamado.ressalva_vendedor && (
            <div style={{marginBottom:20,padding:15,background:M.blueS,borderRadius:10,border:`1px solid ${M.blueB}`}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:M.blue,marginBottom:6}}>💬 Ressalva do Vendedor</div>
              <div style={{fontSize:13,lineHeight:1.6,color:M.tx}}>{chamado.ressalva_vendedor}</div>
            </div>
          )}

          <div style={{borderTop:`1px solid ${M.brdN}`,paddingTop:15}}>
            <label style={{display:"block",fontSize:12,fontWeight:800,marginBottom:8}}>MUDAR PARA:</label>
            <div style={{display:"flex",gap:10}}>
              <select value={newStatus} onChange={e=>setNewStatus(e.target.value)} style={{flex:1,padding:10,borderRadius:8,border:`1px solid ${M.brdN}`}}>
                {STATUSES.filter(s=>s.id).map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <button onClick={save} disabled={saving} style={{padding:"10px 20px",background:M.pri,color:"#fff",border:"none",borderRadius:8,fontWeight:700,cursor:"pointer"}}>
                {saving?"Gravando...":"Salvar"}
              </button>
            </div>
          </div>
          
          <button onClick={()=>onDelete(chamado.id)} style={{marginTop:30,width:"100%",padding:12,background:"transparent",color:M.err,border:`1px solid ${M.err}`,borderRadius:8,cursor:"pointer",fontWeight:700}}>
            🗑️ Excluir Chamado
          </button>
        </div>
      </div>
    </div>
  );
}

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
    if(!window.confirm("Deseja excluir permanentemente?"))return;
    try{
      await api.deleteChamado(id);
      load(page);
      setSelected(null);
    }catch(e){alert("Erro ao excluir");}
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
