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

const bL={fontSize:7,textTransform:"uppercase",color:"#666",fontWeight:600,letterSpacing:0.4,marginBottom:1};
const bV={fontSize:10,fontFamily:"'IBM Plex Mono',monospace",fontWeight:500,minHeight:13};
const sc={border:"1.5px solid #333",marginBottom:-1.5};
const sT={fontSize:7,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,background:M.pri,padding:"2px 6px",borderBottom:"1px solid #333",color:"#fff"};

const Bx=({label,value,field,onChange,isEditing,style={}})=>(
  <div style={{padding:"3px 6px",borderRight:"1px solid #333",...style}}>
    <div style={bL}>{label}</div>
    {isEditing ? (
      <input 
        value={value||""} 
        onChange={(e)=>onChange(field, e.target.value)}
        style={{...bV, width:"100%", border:"none", background:"#fff9c4", outline:"none", padding:0}}
      />
    ) : (
      <div style={bV}>{value||"—"}</div>
    )}
  </div>
);

function DANFE({nf, chamado, isEditing, onChange}) {
  const d=nf||{};const prods=d.produtos?.length?d.produtos:[{}];const now=new Date();

  const cH={fontSize:7,fontWeight:700,color:"#333",textTransform:"uppercase",padding:"3px 4px",background:"#f0ebe5",borderBottom:"1px solid #333",whiteSpace:"nowrap"};
  const cD={fontSize:8,padding:"4px",borderBottom:"1px solid #aaa",fontFamily:"'IBM Plex Mono',monospace"};

  const footerMsg = `ESPELHO NFD REF.NF-${chamado.nf_original} - CFOP CORRETO 5202`;

  return(
    <div id="danfe-print" style={{background:"#fff",padding:20,fontFamily:"'Plus Jakarta Sans',sans-serif",color:"#000",position:"relative"}}>
      <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%) rotate(-35deg)",fontSize:30,fontWeight:800,color:"rgba(155,27,48,0.13)",whiteSpace:"nowrap",pointerEvents:"none",letterSpacing:2}}>NÃO TEM VALOR FISCAL</div>
      <div style={{position:"relative",zIndex:1}}>
        <div style={{...sc,display:"grid",gridTemplateColumns:"1fr auto"}}>
          <div style={{padding:"8px 10px",borderRight:"1px solid #333"}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:6,background:M.pri,borderRadius:4,padding:"3px 10px",marginBottom:4}}><svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M3 16L10 3L17 16H13L10 9L7 16H3Z" fill="white"/></svg><span style={{color:"#fff",fontSize:10,fontWeight:800,letterSpacing:1.5}}>MARIN</span></div>
            <div style={{fontSize:10,fontWeight:700}}>MARIN LOGÍSTICA E COMÉRCIO LTDA</div>
            <div style={{fontSize:7,color:"#444",lineHeight:1.4}}>R VALDO GERLACH, 07 — DISTRITO INDUSTRIAL — CEP: 88104-743 — SÃO JOSÉ/SC</div>
          </div>
          <div style={{padding:"6px 12px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minWidth:130}}>
            <div style={{fontSize:6,fontWeight:700,color:M.pri,textTransform:"uppercase",letterSpacing:1}}>Espelho Rascunho</div>
            <div style={{fontSize:22,fontWeight:800,letterSpacing:2,color:M.pri}}>DANFE</div>
          </div>
        </div>
        <div style={sc}>
          <div style={{borderBottom:"1px solid #333"}}>
            <Bx label="Natureza da Operação" value={d.natureza_operacao||"1202 - DEVOLUÇÃO DE VENDA"} field="natureza_operacao" onChange={onChange} isEditing={isEditing} style={{borderRight:"none"}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr"}}>
            <Bx label="IE" value="261935348" isEditing={false} style={{background:"#eee"}}/>
            <Bx label="IE ST" value=""/>
            <Bx label="CNPJ" value="04.002.562/0004-78" isEditing={false} style={{borderRight:"none", background:"#eee"}}/>
          </div>
        </div>
        <div style={sc}><div style={sT}>Destinatário / Remetente</div><div style={{display:"grid",gridTemplateColumns:"2fr 1fr",borderBottom:"1px solid #333"}}><Bx label="Razão Social" value={d.razao_social_dest||chamado.razao_social} field="razao_social_dest" onChange={onChange} isEditing={isEditing}/><Bx label="CNPJ" value={d.cnpj_dest||chamado.cnpj} field="cnpj_dest" onChange={onChange} isEditing={isEditing} style={{borderRight:"none"}}/></div><div style={{display:"grid",gridTemplateColumns:"2fr 1fr 0.6fr 0.4fr",borderBottom:"1px solid #333"}}><Bx label="Endereço" value={d.endereco_dest} field="endereco_dest" onChange={onChange} isEditing={isEditing}/><Bx label="Bairro" value={d.bairro_dest} field="bairro_dest" onChange={onChange} isEditing={isEditing}/><Bx label="CEP" value={d.cep_dest} field="cep_dest" onChange={onChange} isEditing={isEditing}/><Bx label="UF" value={d.uf_dest} field="uf_dest" onChange={onChange} isEditing={isEditing} style={{borderRight:"none"}}/></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr"}}><Bx label="Município" value={d.municipio_dest} field="municipio_dest" onChange={onChange} isEditing={isEditing}/><Bx label="Telefone" value={d.telefone_dest||chamado.telefone} field="telefone_dest" onChange={onChange} isEditing={isEditing}/><Bx label="IE" value={d.ie_dest} field="ie_dest" onChange={onChange} isEditing={isEditing} style={{borderRight:"none"}}/></div></div>
        <div style={sc}><div style={sT}>Cálculo do Imposto</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",borderBottom:"1px solid #333"}}><Bx label="Base ICMS" value={d.base_icms} field="base_icms" onChange={onChange} isEditing={isEditing}/><Bx label="Vlr ICMS" value={d.valor_icms} field="valor_icms" onChange={onChange} isEditing={isEditing}/><Bx label="Base ST" value={d.base_icms_st||"0,00"} field="base_icms_st" onChange={onChange} isEditing={isEditing}/><Bx label="Vlr ST" value={d.valor_icms_st||"0,00"} field="valor_icms_st" onChange={onChange} isEditing={isEditing} style={{borderRight:"none"}}/></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr 1fr"}}><Bx label="Produtos" value={d.valor_total_produtos} field="valor_total_produtos" onChange={onChange} isEditing={isEditing}/><Bx label="IPI" value={d.valor_ipi||"0,00"} field="valor_ipi" onChange={onChange} isEditing={isEditing}/><Bx label="Outras" value={d.outras_despesas||"0,00"} field="outras_despesas" onChange={onChange} isEditing={isEditing}/><Bx label="Desc." value={d.desconto||"0,00"} field="desconto" onChange={onChange} isEditing={isEditing}/><Bx label="Frete" value={d.valor_frete||"0,00"} field="valor_frete" onChange={onChange} isEditing={isEditing}/><Bx label="TOTAL" value={d.valor_total_nota} field="valor_total_nota" onChange={onChange} isEditing={isEditing} style={{borderRight:"none"}}/></div></div>
        <div style={sc}><div style={sT}>Transportador</div><div style={{display:"grid",gridTemplateColumns:"2fr 1fr 0.4fr 1fr"}}><Bx label="Nome" value={d.transportador_nome} field="transportador_nome" onChange={onChange} isEditing={isEditing}/><Bx label="CNPJ" value={d.transportador_cnpj} field="transportador_cnpj" onChange={onChange} isEditing={isEditing}/><Bx label="UF" value={d.transportador_uf} field="transportador_uf" onChange={onChange} isEditing={isEditing}/><Bx label="Frete" value={d.frete_por_conta||"1-CIF"} field="frete_por_conta" onChange={onChange} isEditing={isEditing} style={{borderRight:"none"}}/></div></div>
        <div style={sc}><div style={sT}>Produtos</div><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Cód","Descrição","NCM","CST","CFOP","Un","Qtd","Vlr.Un","Vlr.Líq","ICMS","%ICMS"].map(h=><th key={h} style={cH}>{h}</th>)}</tr></thead><tbody>{prods.map((p,i)=>(<tr key={i}>
          {["codigo","descricao","ncm","cst","cfop","unidade","quantidade","valor_unitario","valor_liquido","valor_icms","aliq_icms"].map(f=>(
            <td key={f} style={cD}>
              {isEditing ? (
                <input 
                  value={p[f]||""} 
                  onChange={(e)=>{
                    const newPs=[...prods];
                    newPs[i]={...newPs[i], [f]:e.target.value};
                    onChange("produtos", newPs);
                  }}
                  style={{fontSize:8, width:"100%", border:"none", background:"#fff9c4", outline:"none", padding:0, fontFamily:"inherit"}}
                />
              ) : p[f]}
            </td>
          ))}
        </tr>))}</tbody></table></div></div>
        <div style={{...sc,display:"grid",gridTemplateColumns:"1fr 1fr"}}><div style={{borderRight:"1px solid #333",padding:"4px 8px"}}><div style={bL}>Info. Complementares</div><div style={{fontSize:8,lineHeight:1.5,minHeight:28,fontFamily:"'IBM Plex Mono',monospace"}}>
          {isEditing ? (
            <textarea 
              value={d.info_complementares||`${footerMsg}\n Vendedor: ${chamado.vendedor_nome}`}
              onChange={(e)=>onChange("info_complementares", e.target.value)}
              style={{width:"100%", border:"none", background:"#fff9c4", fontInherit:true, outline:"none", resize:"none", height:40}}
            />
          ) : (
            <>
              {d.info_complementares||footerMsg}
              <br/>Vendedor: {chamado.vendedor_nome}
              {(d.nf_referencia||chamado.nf_original)&&<><br/>DEVOLUÇÃO REF. NF {d.nf_referencia||chamado.nf_original}</>}
            </>
          )}
        </div></div><div style={{padding:"4px 8px"}}><div style={bL}>Dados Adicionais</div><div style={{fontSize:7,color:"#888",marginTop:4}}>{now.toLocaleDateString("pt-BR")} {now.toLocaleTimeString("pt-BR")}</div><div style={{fontSize:6,color:"#aaa",marginTop:2}}>Triagem Automática Marin</div></div></div>
      </div>
    </div>
  );
}


function Badge({label,color}){
  return(
    <span style={{display:"inline-block",padding:"3px 10px",borderRadius:20,background:`${color}18`,border:`1px solid ${color}40`,color,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.5,whiteSpace:"nowrap"}}>
      {label}
    </span>
  );
}

function ChamadoDetail({chamado,onClose,onStatusChange}){
  const[newStatus,setNewStatus]=useState(chamado.status||"novo");
  const[showDANFE,setShowDANFE]=useState(false);
  const[saving,setSaving]=useState(false);
  const[localNF,setLocalNF]=useState(chamado.nf_data||{});
  const[isEditing,setIsEditing]=useState(false);

  useEffect(() => {
    setLocalNF(chamado.nf_data || {});
  }, [chamado]);

  const handlePrint=()=>window.print();

  const d=chamado;
  const tr=d.triage_result||{};
  const ev=d.evidence_result||{};
  const nf=localNF;

  const onNFChange = (field, val) => {
    setLocalNF(prev => ({...prev, [field]: val}));
  };

  const save=async()=>{
    setSaving(true);
    try{await api.updateStatus(d.id,newStatus);onStatusChange(d.id,newStatus);}
    catch(e){alert(e.message);}
    finally{setSaving(false);}
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"flex-start",justifyContent:"center",zIndex:900,overflowY:"auto",padding:"24px 12px"}}>
      <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:700,boxShadow:"0 24px 80px rgba(0,0,0,0.2)",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
        {/* Header */}
        <div style={{padding:"20px 24px",borderBottom:`1px solid ${M.brdN}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:11,color:M.txD,marginBottom:2}}>Chamado #{d.id} · {new Date(d.created_at).toLocaleString("pt-BR")}</div>
            <div style={{fontSize:18,fontWeight:800}}>{d.razao_social}</div>
            <div style={{fontSize:12,color:M.txM}}>NF {d.nf_original} · {d.tipo_solicitacao?.replace(/_/g," ")}</div>
          </div>
          <button onClick={onClose} style={{padding:"6px 14px",border:`1px solid ${M.brdN}`,background:"#fff",borderRadius:8,cursor:"pointer",fontSize:12}}>Fechar ×</button>
        </div>

        <div style={{padding:"20px 24px"}}>
          {/* Triage result */}
          {tr.etapa_destino&&(
            <div style={{background:`${STATUS_COLOR[tr.etapa_destino]||"#6b7280"}10`,border:`1px solid ${STATUS_COLOR[tr.etapa_destino]||"#6b7280"}30`,borderRadius:10,padding:16,marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:M.txM,marginBottom:6}}>Resultado da Triagem IA</div>
              <div style={{fontSize:13,lineHeight:1.5,marginBottom:8}}>{tr.resumo}</div>
              {tr.acoes_automaticas?.length>0&&(
                <div style={{display:"flex",flexDirection:"column",gap:3}}>
                  {tr.acoes_automaticas.map((a,i)=>(<div key={i} style={{display:"flex",gap:8,fontSize:11}}><span style={{color:M.ok,fontWeight:700}}>✓</span><span>{a}</span></div>))}
                </div>
              )}
              {tr.escalacao_humana&&<div style={{marginTop:8,padding:"8px 12px",background:M.warnS,border:`1px solid ${M.warnB}`,borderRadius:8,fontSize:11,color:M.warn}}>⚠️ {tr.motivo_escalacao}</div>}
              {tr.elegivel_devolucao===false&&<div style={{marginTop:8,padding:"8px 12px",background:M.errS,border:`1px solid ${M.err}30`,borderRadius:8,fontSize:11,color:M.err}}>🚫 {tr.motivo_inelegibilidade}</div>}
              {tr.observacoes&&<div style={{marginTop:8,padding:"8px 12px",background:M.blueS,border:`1px solid ${M.blueB}`,borderRadius:8,fontSize:11,color:M.blue}}>{tr.observacoes}</div>}
            </div>
          )}

          {/* Evidence analysis */}
          {ev.resumo_evidencias&&(
            <div style={{background:M.blueS,border:`1px solid ${M.blueB}`,borderRadius:10,padding:16,marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:M.blue,marginBottom:6}}>🔍 Análise de Evidências (IA)</div>
              <div style={{fontSize:11,color:M.txM,marginBottom:6}}>Estado: <b>{ev.estado_produto}</b> · Responsabilidade: <b>{ev.responsabilidade_sugerida}</b> · Confiança: <b>{ev.grau_confianca}</b></div>
              <div style={{fontSize:12,lineHeight:1.5,marginBottom:6}}>{ev.resumo_evidencias}</div>
              {ev.pontos_observados?.map((p,i)=>(<div key={i} style={{display:"flex",gap:6,fontSize:11}}><span style={{color:M.blue}}>▸</span><span>{p}</span></div>))}
            </div>
          )}

          {/* Original Form Data */}
          <div style={{background:"#fff", border:`1px solid ${M.brdN}`, borderRadius:10, padding:16, marginBottom:16, boxShadow:"0 2px 8px rgba(0,0,0,0.03)"}}>
            <div style={{fontSize:11, fontWeight:700, textTransform:"uppercase", color:M.txM, marginBottom:12, borderBottom:`1px solid ${M.brdN}`, paddingBottom:6}}>📝 Dados Originais do Formulário (Vendedor)</div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px 24px"}}>
              <div>
                <div style={{fontSize:10, color:M.txD, textTransform:"uppercase", fontWeight:600}}>Informações do Cliente</div>
                <div style={{fontSize:12, marginTop:4}}><b>Cód:</b> {d.codigo_cliente}</div>
                <div style={{fontSize:12}}><b>CNPJ/CPF:</b> {d.cnpj}</div>
                <div style={{fontSize:12}}><b>Razão:</b> {d.razao_social}</div>
                <div style={{fontSize:12}}><b>NF Original:</b> {d.nf_original}</div>
              </div>
              <div>
                <div style={{fontSize:10, color:M.txD, textTransform:"uppercase", fontWeight:600}}>Contato do Vendedor</div>
                <div style={{fontSize:12, marginTop:4}}><b>Vendedor:</b> {d.nome_vendedor}</div>
                <div style={{fontSize:12}}><b>E-mail:</b> {d.email_vendedor}</div>
                <div style={{fontSize:12}}><b>Telefone:</b> {d.telefone}</div>
                <div style={{fontSize:12}}><b>Responsável:</b> {d.responsavel}</div>
              </div>
            </div>
            <div style={{marginTop:12, paddingTop:12, borderTop:`1px dashed ${M.brdN}`}}>
               <div style={{fontSize:10, color:M.txD, textTransform:"uppercase", fontWeight:600, marginBottom:4}}>Tipo de Solicitação</div>
               <div style={{fontSize:12}}>{d.tipo_solicitacao?.replace(/_/g," ")}</div>
            </div>
          </div>

          {/* NF Data */}
          {nf.numero_nf&&(
            <div style={{background:M.alt,borderRadius:10,padding:16,marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:M.txM,marginBottom:8}}>📄 Dados da Nota Fiscal (extraídos por IA)</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 16px",fontSize:11}}>
                {[["NF",nf.numero_nf],["Razão Social",nf.razao_social_dest],["CNPJ",nf.cnpj_dest],["Município",`${nf.municipio_dest||""} ${nf.uf_dest||""}`],["Total",nf.valor_total_nota],["ICMS",nf.valor_icms]].filter(([,v])=>v).map(([k,v])=>(
                  <div key={k}><span style={{color:M.txD}}>{k}:</span> <b>{v}</b></div>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          {(d.nf_file_path||d.evidence_paths?.length>0)&&(
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:M.txM,marginBottom:8}}>Anexos</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {d.nf_file_path&&(<a href={api.fileUrl(d.nf_file_path)} target="_blank" rel="noreferrer" style={{padding:"6px 12px",background:"#fff",border:`1px solid ${M.brdN}`,borderRadius:8,fontSize:11,color:M.blue,textDecoration:"none"}}>📄 Nota Fiscal</a>)}
                {d.evidence_paths?.map((f,i)=>(<a key={i} href={api.fileUrl(f)} target="_blank" rel="noreferrer" style={{padding:"6px 12px",background:"#fff",border:`1px solid ${M.brdN}`,borderRadius:8,fontSize:11,color:M.blue,textDecoration:"none"}}>📎 Evidência {i+1}</a>))}
              </div>
            </div>
          )}

          {/* Descrição */}
          <div style={{marginBottom:16,padding:14,background:"#faf9f7",borderRadius:10,border:`1px solid ${M.brdN}`}}>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:M.txM,marginBottom:6}}>Descrição do Chamado</div>
            <div style={{fontSize:13,lineHeight:1.6}}>{d.descricao}</div>
          </div>

          {/* Update status */}
          <div style={{padding:"16px",background:M.soft,borderRadius:10,border:`1px solid ${M.brdN}`}}>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:M.txM,marginBottom:8}}>Atualizar Etapa</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              <select value={newStatus} onChange={e=>setNewStatus(e.target.value)}
                style={{flex:1,padding:"9px 12px",border:`1px solid ${M.brdN}`,borderRadius:8,fontSize:12,fontFamily:"inherit",background:"#fff",color:M.tx,minWidth:180}}>
                {STATUSES.filter(s=>s.id).map(s=>(<option key={s.id} value={s.id}>{s.label}</option>))}
              </select>
              <button onClick={save} disabled={saving||newStatus===chamado.status}
                style={{padding:"9px 20px",background:saving||newStatus===chamado.status?"#ccc":M.pri,color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:700,cursor:saving||newStatus===chamado.status?"not-allowed":"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                {saving?"Salvando...":"Salvar Etapa"}
              </button>
            </div>
          </div>

          {/* DANFE Mirror Button (Admin/PosVendas Only) */}
          {(tr.precisa_espelho_nfd || nf.numero_nf) && (
            <div style={{marginTop:20, borderTop:`1px solid ${M.brdN}`, paddingTop:16}}>
              <button onClick={()=>setShowDANFE(!showDANFE)} style={{width:"100%",padding:"12px",background:showDANFE?M.alt:M.pri,color:showDANFE?M.tx:"#fff",border:showDANFE?`1px solid ${M.brdN}`:"none",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:showDANFE?"none":`0 4px 16px ${M.glow}`}}>
                {showDANFE?"Ocultar Espelho":"🧾 Gerar Espelho NFD (Rascunho)"}
              </button>
              {showDANFE && (
                 <div style={{marginTop:12}}>
                    <div className="no-print" style={{display:"flex", justifyContent:"flex-end", gap:8, marginBottom:8}}>
                      <button onClick={()=>setIsEditing(!isEditing)} style={{padding:"8px 16px",background:isEditing?M.warn:M.soft,color:isEditing?"#fff":M.tx,border:`1px solid ${isEditing?"transparent":M.brdN}`,borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer"}}>
                        {isEditing ? "✅ Finalizar Edição" : "✏️ Editar Rascunho"}
                      </button>
                      <button onClick={handlePrint} style={{padding:"8px 16px",background:M.ok,color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer"}}>🖨️ Imprimir PDF</button>
                    </div>
                    <div style={{borderRadius:10,overflow:"hidden",border:`1px solid ${M.brdN}`,boxShadow:"0 4px 20px rgba(0,0,0,0.06)"}}>
                      <DANFE nf={nf} chamado={chamado} isEditing={isEditing} onChange={onNFChange}/>
                    </div>
                 </div>
              )}
            </div>
          )}
        </div>

        <div style={{marginTop:30, padding:"20px", borderTop:`1px solid ${M.brdN}`, display:"flex", justifyContent:"center"}}>
           <button onClick={()=>onDelete(d.id)} style={{background:"transparent", color:M.err, border:`1px solid ${M.err}`, padding:"10px 24px", borderRadius:10, fontSize:12, fontWeight:700, cursor:"pointer", transition:"all 0.2s"}}
             onMouseEnter={e=>e.currentTarget.style.background=M.errS} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
             🗑️ Excluir Chamado (Permanente)
           </button>
        </div>
      </div>
    </div>
  );
}

function AdminUsersPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await api.getUsers();
      setUsers(res.users || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.name || !form.email || !form.password || !form.role) {
      return setError("Preencha todos os campos.");
    }
    try {
      await api.createUser(form);
      setForm({ name: "", email: "", password: "", role: "" });
      setSuccess("Usuário criado com sucesso!");
      loadUsers();
    } catch (err) {
      setError(err.message || "Erro ao criar usuário.");
    }
  };

  const toggleActive = async (id, currentActive) => {
    try {
      await api.updateUser(id, { active: !currentActive });
      loadUsers();
    } catch (err) {
      alert("Erro ao atualizar status");
    }
  };

  return (
    <div style={{padding:"24px", maxWidth: 900, margin:"0 auto"}}>
      <div style={{background:"#fff",padding:24,borderRadius:12,border:`1px solid ${M.brdN}`,marginBottom:24,boxShadow:"0 4px 12px rgba(0,0,0,0.05)"}}>
        <h3 style={{marginTop:0,marginBottom:16,fontSize:15,fontWeight:800}}>Criar Novo Usuário</h3>
        {error && <div style={{padding:"8px 12px",background:M.errS,color:M.err,borderRadius:8,fontSize:12,marginBottom:12}}>{error}</div>}
        {success && <div style={{padding:"8px 12px",background:M.okS,color:M.ok,borderRadius:8,fontSize:12,marginBottom:12}}>{success}</div>}
        <form onSubmit={handleCreate} style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
           <input placeholder="Nome" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} style={{padding:"10px",borderRadius:8,border:`1px solid ${M.brdN}`,fontFamily:"inherit",fontSize:13}} />
           <input type="email" placeholder="E-mail (@marinlog.com.br)" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} style={{padding:"10px",borderRadius:8,border:`1px solid ${M.brdN}`,fontFamily:"inherit",fontSize:13}} />
           <select value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))} style={{padding:"10px",borderRadius:8,border:`1px solid ${M.brdN}`,fontFamily:"inherit",fontSize:13,background:"#fff"}}>
             <option value="">Selecione o Perfil...</option>
             <option value="vendedor">Vendedor</option>
             <option value="pos_vendas">Pós-Vendas</option>
             <option value="admin">Administrador</option>
           </select>
           <input type="password" placeholder="Senha Forte" value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} style={{padding:"10px",borderRadius:8,border:`1px solid ${M.brdN}`,fontFamily:"inherit",fontSize:13}} />
           <button type="submit" style={{gridColumn:"1/-1",padding:"12px",background:M.pri,color:"#fff",border:"none",borderRadius:8,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginTop:8}}>+ Adicionar Usuário</button>
        </form>
      </div>

      <div style={{background:"#fff",borderRadius:12,border:`1px solid ${M.brdN}`,overflow:"hidden"}}>
         <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead style={{background:"#faf9f7",textAlign:"left"}}>
               <tr>
                 <th style={{padding:"12px 16px",borderBottom:`1px solid ${M.brdN}`,color:M.txM,fontWeight:700}}>Nome</th>
                 <th style={{padding:"12px 16px",borderBottom:`1px solid ${M.brdN}`,color:M.txM,fontWeight:700}}>E-mail</th>
                 <th style={{padding:"12px 16px",borderBottom:`1px solid ${M.brdN}`,color:M.txM,fontWeight:700}}>Perfil</th>
                 <th style={{padding:"12px 16px",borderBottom:`1px solid ${M.brdN}`,color:M.txM,fontWeight:700}}>Status</th>
               </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="4" style={{textAlign:"center",padding:24,color:M.txM}}>Carregando...</td></tr>
              ) : (
                users.map(u => (
                  <tr key={u.id}>
                    <td style={{padding:"12px 16px",borderBottom:`1px solid ${M.brdN}`,fontWeight:600}}>{u.name}</td>
                    <td style={{padding:"12px 16px",borderBottom:`1px solid ${M.brdN}`}}>{u.email}</td>
                    <td style={{padding:"12px 16px",borderBottom:`1px solid ${M.brdN}`}}>
                      <span style={{padding:"4px 8px",background:u.role==="admin"?"#fecdd3":(u.role==="pos_vendas"?"#bfdbfe":"#f1f5f9"),color:u.role==="admin"?"#be123c":(u.role==="pos_vendas"?"#1d4ed8":"#475569"),borderRadius:12,fontSize:10,fontWeight:700}}>{u.role.toUpperCase()}</span>
                    </td>
                    <td style={{padding:"12px 16px",borderBottom:`1px solid ${M.brdN}`}}>
                      <button onClick={()=>toggleActive(u.id, u.active)} style={{padding:"6px 12px",borderRadius:6,border:`1px solid ${u.active?M.ok:M.txD}`,background:u.active?M.okS:"#fff",color:u.active?M.ok:M.txD,fontSize:10,fontWeight:700,cursor:"pointer"}}>
                        {u.active ? "Ativo" : "Inativo"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
         </table>
      </div>
    </div>
  );
}

export default function PosVendasPage(){
  const user=JSON.parse(localStorage.getItem("user")||"{}");
  const[chamados,setChamados]=useState([]);
  const[total,setTotal]=useState(0);
  const[loading,setLoading]=useState(false);
  const[page,setPage]=useState(1);
  const[filters,setFilters]=useState({status:"",tipo:"",from:"",to:""});
  const[selected,setSelected]=useState(null);
  const[search,setSearch]=useState("");
  const[activeTab,setActiveTab]=useState("chamados");
  const[selectedIds,setSelectedIds]=useState(new Set());
  const[deletingSelect,setDeletingSelect]=useState(false);

  const LIMIT=15;

  const load=useCallback(async(p=1,f=filters)=>{
    setLoading(true);
    try{
      const res=await api.getChamados({...f,page:p,limit:LIMIT});
      setChamados(res.chamados||[]);setTotal(res.total||0);
    }catch(e){console.error(e);}
    finally{setLoading(false);}
  },[filters]);

  useEffect(()=>{load(1);},[]);

  const applyFilters=()=>{setPage(1);load(1,filters);};
  const clearFilters=()=>{const f={status:"",tipo:"",from:"",to:""};setFilters(f);setPage(1);load(1,f);};
  const logout=()=>{localStorage.removeItem("token");localStorage.removeItem("user");window.location.href="/login";};

  const handleStatusChange=(id,newStatus)=>{
    setChamados(p=>p.map(c=>c.id===id?{...c,status:newStatus,etapa_destino:newStatus}:c));
    if(selected?.id===id)setSelected(s=>({...s,status:newStatus,etapa_destino:newStatus}));
  };

  const toggleSelect=(id)=>{
    const n=new Set(selectedIds);
    if(n.has(id))n.delete(id);else n.add(id);
    setSelectedIds(n);
  };
  const toggleSelectAll=()=>{
    if(selectedIds.size===filtered.length)setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(c=>c.id)));
  };

  const handleDeleteSelected=async()=>{
    if(!window.confirm(`Tem certeza que deseja APAGAR PERMANENTEMENTE ${selectedIds.size} chamados selecionados? Esta ação não pode ser desfeita.`))return;
    setDeletingSelect(true);
    try{
      await api.deleteMultipleChamados(Array.from(selectedIds));
      setSelectedIds(new Set());
      load(page);
    }catch(e){alert(e.message);}
    finally{setDeletingSelect(false);}
  };

  const handleDeleteSingle=async(id)=>{
    if(!window.confirm("Tem certeza que deseja APAGAR PERMANENTEMENTE este chamado? Esta ação não pode ser desfeita."))return;
    try{
      await api.deleteChamado(id);
      setSelected(null);
      load(page);
    }catch(e){alert(e.message);}
  };

  const filtered=search?chamados.filter(c=>(c.razao_social||"").toLowerCase().includes(search.toLowerCase())||(c.nf_original||"").includes(search)):chamados;
  const totalPages=Math.ceil(total/LIMIT);

  return(
    <div style={{minHeight:"100vh",background:M.bg,fontFamily:"'Plus Jakarta Sans',sans-serif",color:M.tx}}>
      {selected&&<ChamadoDetail chamado={selected} onClose={()=>setSelected(null)} onStatusChange={handleStatusChange} onDelete={handleDeleteSingle} />}

      {/* HEADER */}
      <div style={{background:`linear-gradient(135deg,${M.pri},#5E1220)`,padding:"16px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <svg width="90" height="26" viewBox="0 0 140 40" fill="none"><rect width="140" height="40" rx="6" fill="rgba(255,255,255,0.15)"/><path d="M14 28L22 12L30 28H26L22 19L18 28H14Z" fill="white"/><text x="38" y="27" fontFamily="Plus Jakarta Sans" fontSize="18" fontWeight="800" fill="white" letterSpacing="1.5">MARIN</text></svg>
          <div>
            <div style={{color:"#fff",fontWeight:700,fontSize:15}}>Dashboard Pós-Vendas</div>
            <div style={{color:"rgba(255,255,255,0.6)",fontSize:11}}>{total} chamado{total!==1?"s":""} encontrado{total!==1?"s":""}</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{color:"rgba(255,255,255,0.8)",fontSize:12}}>{user.name}</span>
          <button onClick={logout} style={{padding:"6px 14px",background:"rgba(255,255,255,0.15)",color:"#fff",border:"1px solid rgba(255,255,255,0.3)",borderRadius:6,fontSize:11,cursor:"pointer"}}>Sair</button>
        </div>
      </div>

      {/* TABS (Admin) */}
      {user.role === "admin" && (
        <div style={{padding:"0 24px",marginTop:16, borderBottom:`1px solid ${M.brdN}`}}>
          <div style={{display:"flex",gap:8}}>
             <button onClick={()=>setActiveTab("chamados")} style={{padding:"10px 16px",background:"transparent",border:"none",borderBottom:activeTab==="chamados"?`2px solid ${M.pri}`:"2px solid transparent",marginBottom:-1,color:activeTab==="chamados"?M.pri:M.txM,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>📋 Chamados</button>
             <button onClick={()=>setActiveTab("usuarios")} style={{padding:"10px 16px",background:"transparent",border:"none",borderBottom:activeTab==="usuarios"?`2px solid ${M.pri}`:"2px solid transparent",marginBottom:-1,color:activeTab==="usuarios"?M.pri:M.txM,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>👥 Usuários (Admin)</button>
          </div>
        </div>
      )}

      {activeTab === "usuarios" && user.role === "admin" ? (
        <AdminUsersPanel />
      ) : (
        <>
          {/* FILTERS */}
          <div style={{padding:"16px 24px",background:"#fff",borderBottom:`1px solid ${M.brdN}`,display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
        <div style={{flex:1,minWidth:180}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.6,color:M.txM,marginBottom:4}}>Busca</div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Razão social ou Nº NF..."
            style={{width:"100%",padding:"8px 12px",border:`1px solid ${M.brdN}`,borderRadius:8,fontSize:12,fontFamily:"inherit",boxSizing:"border-box",outline:"none"}}/>
        </div>
        <div style={{minWidth:150}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.6,color:M.txM,marginBottom:4}}>Status</div>
          <select value={filters.status} onChange={e=>setFilters(p=>({...p,status:e.target.value}))}
            style={{width:"100%",padding:"8px 12px",border:`1px solid ${M.brdN}`,borderRadius:8,fontSize:12,fontFamily:"inherit",background:"#fff"}}>
            {STATUSES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div style={{minWidth:150}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.6,color:M.txM,marginBottom:4}}>Tipo</div>
          <select value={filters.tipo} onChange={e=>setFilters(p=>({...p,tipo:e.target.value}))}
            style={{width:"100%",padding:"8px 12px",border:`1px solid ${M.brdN}`,borderRadius:8,fontSize:12,fontFamily:"inherit",background:"#fff"}}>
            {TIPOS.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.6,color:M.txM,marginBottom:4}}>De</div>
          <input type="date" value={filters.from} onChange={e=>setFilters(p=>({...p,from:e.target.value}))}
            style={{padding:"8px 10px",border:`1px solid ${M.brdN}`,borderRadius:8,fontSize:12,fontFamily:"inherit"}}/>
        </div>
        <div>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.6,color:M.txM,marginBottom:4}}>Até</div>
          <input type="date" value={filters.to} onChange={e=>setFilters(p=>({...p,to:e.target.value}))}
            style={{padding:"8px 10px",border:`1px solid ${M.brdN}`,borderRadius:8,fontSize:12,fontFamily:"inherit"}}/>
        </div>
        <button onClick={applyFilters} style={{padding:"8px 18px",background:M.pri,color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Filtrar</button>
        <button onClick={clearFilters} style={{padding:"8px 14px",background:"#fff",color:M.txM,border:`1px solid ${M.brdN}`,borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Limpar</button>
        <button onClick={()=>load(page)} style={{padding:"8px 14px",background:"#fff",color:M.blue,border:`1px solid ${M.blueB}`,borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>↻ Atualizar</button>
        {selectedIds.size>0&&(
          <button onClick={handleDeleteSelected} disabled={deletingSelect}
            style={{padding:"8px 18px",background:M.err,color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:700,cursor:deletingSelect?"not-allowed":"pointer",fontFamily:"inherit"}}>
            {deletingSelect?"Apagando...":`🗑️ Apagar Selecionados (${selectedIds.size})`}
          </button>
        )}
      </div>

      {/* TABLE */}
      <div style={{padding:"16px 24px"}}>
        {loading?(
          <div style={{textAlign:"center",padding:"60px 0",color:M.txM}}>
            <div style={{fontSize:32,marginBottom:12}}>⏳</div>
            <div>Carregando chamados...</div>
          </div>
        ):filtered.length===0?(
          <div style={{textAlign:"center",padding:"60px 0",color:M.txM}}>
            <div style={{fontSize:40,marginBottom:12}}>📭</div>
            <div style={{fontWeight:700,fontSize:16,marginBottom:6}}>Nenhum chamado encontrado</div>
            <div style={{fontSize:13}}>Ajuste os filtros ou aguarde novos chamados</div>
          </div>
        ):(
          <>
            <div style={{background:"#fff",borderRadius:12,border:`1px solid ${M.brdN}`,overflow:"hidden",boxShadow:"0 2px 12px rgba(0,0,0,0.04)"}}>
              {/* Table header */}
              <div style={{display:"grid",gridTemplateColumns:"40px 60px 2fr 1fr 1fr 1fr 1fr 100px",gap:0,background:M.alt,borderBottom:`1px solid ${M.brdN}`,padding:"10px 16px",alignItems:"center"}}>
                <input type="checkbox" checked={selectedIds.size===filtered.length && filtered.length>0} onChange={toggleSelectAll} style={{cursor:"pointer"}}/>
                {["#","Cliente / NF","Tipo","Vendedor","Status","Data","Detalhes"].map(h=>(
                  <div key={h} style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.6,color:M.txM}}>{h}</div>
                ))}
              </div>
              {filtered.map((c,i)=>(
                <div key={c.id} style={{display:"grid",gridTemplateColumns:"40px 60px 2fr 1fr 1fr 1fr 1fr 100px",gap:0,padding:"12px 16px",borderBottom:`1px solid ${M.brdN}`,background:i%2===0?"#fff":"#faf9f7",alignItems:"center",transition:"background 0.15s"}}
                  onMouseEnter={e=>e.currentTarget.style.background="#f0ebe5"}
                  onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"#fff":"#faf9f7"}>
                  <input type="checkbox" checked={selectedIds.has(c.id)} onChange={()=>toggleSelect(c.id)} style={{cursor:"pointer"}}/>
                  <div style={{fontSize:12,fontWeight:700,color:M.txD}}>#{c.id}</div>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,marginBottom:2}}>{c.razao_social}</div>
                    <div style={{fontSize:10,color:M.txD}}>NF {c.nf_original} · {c.cnpj}</div>
                  </div>
                  <div style={{fontSize:11,color:M.txM}}>{c.tipo_solicitacao?.replace(/_/g," ")}</div>
                  <div style={{fontSize:11,color:M.txM}}>{c.vendedor_nome||c.nome_vendedor}</div>
                  <div><Badge label={c.status||"novo"} color={STATUS_COLOR[c.status]||"#6b7280"}/></div>
                  <div style={{fontSize:11,color:M.txD}}>{new Date(c.created_at).toLocaleDateString("pt-BR")}</div>
                  <div>
                    <button onClick={()=>setSelected(c)}
                      style={{padding:"5px 12px",background:M.soft,border:`1px solid ${M.brdN}`,borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",color:M.pri,fontFamily:"inherit"}}>
                      Ver →
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages>1&&(
              <div style={{display:"flex",justifyContent:"center",gap:6,marginTop:16}}>
                <button onClick={()=>{const p=Math.max(1,page-1);setPage(p);load(p);}} disabled={page===1}
                  style={{padding:"6px 14px",border:`1px solid ${M.brdN}`,background:page===1?"#f5f5f5":"#fff",borderRadius:8,fontSize:12,cursor:page===1?"not-allowed":"pointer",color:page===1?M.txD:M.tx}}>← Anterior</button>
                <span style={{display:"flex",alignItems:"center",fontSize:12,color:M.txM,padding:"0 8px"}}>Pág. {page} de {totalPages}</span>
                <button onClick={()=>{const p=Math.min(totalPages,page+1);setPage(p);load(p);}} disabled={page===totalPages}
                  style={{padding:"6px 14px",border:`1px solid ${M.brdN}`,background:page===totalPages?"#f5f5f5":"#fff",borderRadius:8,fontSize:12,cursor:page===totalPages?"not-allowed":"pointer",color:page===totalPages?M.txD:M.tx}}>Próxima →</button>
              </div>
            )}
          </>
        )}
      </div>
      </>
      )}

      <style>{`
        @media print {
          @page { size: portrait; margin: 0mm; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden; }
          #danfe-print, #danfe-print * { 
            visibility: visible !important; 
          }
          #danfe-print { 
            position: absolute; 
            top: 0; 
            left: 0; 
            right: 0;
            width: 100%; 
            margin: 0 !important; 
            padding: 15mm !important; 
            z-index: 10000;
            background: #fff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box;
          }
          .no-print { display: none !important; }
        }
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
      `}</style>
    </div>
  );
}
