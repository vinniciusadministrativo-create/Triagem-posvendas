import React,{useState,useEffect,useRef,useCallback}from"react";
import{M,ROLES,API,tok,me,hdrs,fmtTime,fmtHora,Avatar,Badge,FilePreview}from"../components/ChatUtils";

const myUser=me();
const authH=()=>({Authorization:`Bearer ${tok()}`});

// ── Modal criar grupo ──────────────────────────────────────────────
function NovoGrupoModal({onClose,onCriado}){
  const[nome,setNome]=useState("");
  const[desc,setDesc]=useState("");
  const[todos,setTodos]=useState([]);
  const[sel,setSel]=useState([]);
  useEffect(()=>{fetch(`${API}/contatos`,{headers:hdrs()}).then(r=>r.json()).then(d=>setTodos(d.contatos||[])).catch(()=>{});},[]);
  const toggle=id=>setSel(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const submit=async e=>{
    e.preventDefault();
    if(!nome.trim()||sel.length<1)return alert("Dê um nome e selecione ao menos 1 membro.");
    const r=await fetch(`${API}/grupos`,{method:"POST",headers:hdrs(),body:JSON.stringify({nome,descricao:desc,membros:sel})});
    const d=await r.json();
    if(r.ok){onCriado(d.grupo);}else alert(d.error||"Erro ao criar grupo.");
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000}}>
      <div style={{background:"#fff",borderRadius:16,padding:28,width:420,maxHeight:"80vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h3 style={{margin:0,fontSize:16,fontWeight:800,color:M.tx}}>👥 Novo Grupo</h3>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:M.txM}}>✕</button>
        </div>
        <form onSubmit={submit}>
          <label style={{fontSize:11,fontWeight:700,color:M.txM,textTransform:"uppercase"}}>Nome do Grupo *</label>
          <input value={nome} onChange={e=>setNome(e.target.value)} required placeholder="Ex: Equipe Logística"
            style={{width:"100%",padding:"9px 12px",border:`1px solid ${M.brdN}`,borderRadius:8,fontSize:14,marginBottom:14,boxSizing:"border-box",marginTop:4}}/>
          <label style={{fontSize:11,fontWeight:700,color:M.txM,textTransform:"uppercase"}}>Descrição</label>
          <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Opcional"
            style={{width:"100%",padding:"9px 12px",border:`1px solid ${M.brdN}`,borderRadius:8,fontSize:14,marginBottom:14,boxSizing:"border-box",marginTop:4}}/>
          <label style={{fontSize:11,fontWeight:700,color:M.txM,textTransform:"uppercase"}}>Membros ({sel.length} selecionados) *</label>
          <div style={{border:`1px solid ${M.brdN}`,borderRadius:8,maxHeight:180,overflowY:"auto",marginTop:4,marginBottom:18}}>
            {todos.map(c=>(
              <label key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",cursor:"pointer",borderBottom:`1px solid ${M.brdN}`}}>
                <input type="checkbox" checked={sel.includes(c.id)} onChange={()=>toggle(c.id)} style={{accentColor:M.pri}}/>
                <Avatar name={c.name} size={28}/>
                <div><div style={{fontSize:13,fontWeight:600,color:M.tx}}>{c.name}</div><div style={{fontSize:11,color:M.txM}}>{ROLES[c.role]||c.role}</div></div>
              </label>
            ))}
          </div>
          <div style={{display:"flex",gap:10}}>
            <button type="button" onClick={onClose} style={{flex:1,padding:"10px",border:`1px solid ${M.brdN}`,borderRadius:8,background:"#fff",cursor:"pointer",fontWeight:600}}>Cancelar</button>
            <button type="submit" style={{flex:1,padding:"10px",border:"none",borderRadius:8,background:M.pri,color:"#fff",cursor:"pointer",fontWeight:700}}>Criar Grupo</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Balão de mensagem ──────────────────────────────────────────────
function Balao({msg,isMeu,onEdit,onDelete}){
  const[menu,setMenu]=useState(false);
  return(
    <div style={{display:"flex",justifyContent:isMeu?"flex-end":"flex-start",marginBottom:2}}
      onMouseEnter={()=>isMeu&&!msg.deletada&&setMenu(true)}
      onMouseLeave={()=>setMenu(false)}>
      <div style={{position:"relative",maxWidth:"68%"}}>
        {menu&&(
          <div style={{position:"absolute",top:-34,right:0,background:"#fff",border:`1px solid ${M.brdN}`,borderRadius:8,boxShadow:"0 4px 12px rgba(0,0,0,0.12)",display:"flex",zIndex:10,overflow:"hidden"}}>
            <button onClick={()=>{onEdit(msg);setMenu(false);}} style={{padding:"6px 12px",border:"none",background:"none",cursor:"pointer",fontSize:12,color:M.tx,fontWeight:600}}>✏️ Editar</button>
            <button onClick={()=>{onDelete(msg.id);setMenu(false);}} style={{padding:"6px 12px",border:"none",background:"none",cursor:"pointer",fontSize:12,color:"#dc2626",fontWeight:600,borderLeft:`1px solid ${M.brdN}`}}>🗑 Apagar</button>
          </div>
        )}
        {!isMeu&&msg.remetente_nome&&<div style={{fontSize:11,fontWeight:700,color:M.pri,marginBottom:2,paddingLeft:4}}>{msg.remetente_nome}</div>}
        <div style={{padding:"9px 14px",borderRadius:isMeu?"18px 18px 4px 18px":"18px 18px 18px 4px",background:isMeu?M.sent:M.recv,color:isMeu?"#fff":M.tx,fontSize:14,lineHeight:1.5,fontStyle:msg.deletada?"italic":"normal",opacity:msg.deletada?0.6:1,wordBreak:"break-word",boxShadow:"0 1px 3px rgba(0,0,0,0.07)"}}>
          {msg.conteudo}
          <FilePreview url={msg.anexo_url} nome={msg.anexo_nome} tipo={msg.anexo_tipo}/>
          <div style={{fontSize:10,marginTop:4,color:isMeu?"rgba(255,255,255,0.7)":M.txM,textAlign:"right",display:"flex",gap:4,justifyContent:"flex-end"}}>
            {msg.editada&&<span>editada</span>}
            <span>{fmtHora(msg.created_at)}</span>
            {isMeu&&<span>{msg.lida?"✓✓":"✓"}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────
export default function ChatPage(){
  const[contatos,setContatos]=useState([]);
  const[grupos,setGrupos]=useState([]);
  const[ativo,setAtivo]=useState(null); // {tipo:"dm"|"grupo", dados:{...}}
  const[msgs,setMsgs]=useState([]);
  const[texto,setTexto]=useState("");
  const[busca,setBusca]=useState("");
  const[enviando,setEnviando]=useState(false);
  const[loadingMsgs,setLoadingMsgs]=useState(false);
  const[editando,setEditando]=useState(null);
  const[showNovoGrupo,setShowNovoGrupo]=useState(false);
  const[arquivo,setArquivo]=useState(null);
  const ultimoId=useRef(0);
  const msgEnd=useRef(null);
  const inputRef=useRef(null);
  const fileRef=useRef(null);
  const pollRef=useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn=() => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  },[]);

  const fetchContatos=useCallback(async()=>{
    try{const r=await fetch(`${API}/contatos`,{headers:authH()});const d=await r.json();setContatos(d.contatos||[]);}catch(e){}
  },[]);
  const fetchGrupos=useCallback(async()=>{
    try{const r=await fetch(`${API}/grupos`,{headers:authH()});const d=await r.json();setGrupos(d.grupos||[]);}catch(e){}
  },[]);

  useEffect(()=>{fetchContatos();fetchGrupos();},[]);
  useEffect(()=>{const t=setInterval(()=>{fetchContatos();fetchGrupos();},10000);return()=>clearInterval(t);},[]);
  useEffect(()=>{ msgEnd.current?.scrollIntoView({behavior:"smooth"}); },[msgs]);

  const fetchMsgs=useCallback(async(a)=>{
    setLoadingMsgs(true);ultimoId.current=0;
    try{
      const url=a.tipo==="dm"?`${API}/mensagens/${a.dados.id}`:`${API}/grupos/${a.dados.id}/mensagens`;
      const r=await fetch(`${url}?limit=60`,{headers:authH()});
      const d=await r.json();const m=d.mensagens||[];
      setMsgs(m);if(m.length)ultimoId.current=m[m.length-1].id;
      if(a.tipo==="dm") fetch(`${API}/lidas/${a.dados.id}`,{method:"PATCH",headers:authH()});
      else fetch(`${API}/grupos/${a.dados.id}/lidas`,{method:"POST",headers:authH()});
    }catch(e){}finally{setLoadingMsgs(false);}
  },[]);

  const pollNovas=useCallback(async(a)=>{
    if(!a) return;
    try{
      const url=a.tipo==="dm"?`${API}/novas/${a.dados.id}?desde=${ultimoId.current}`:`${API}/grupos/${a.dados.id}/mensagens?desde=${ultimoId.current}`;
      const r=await fetch(url,{headers:authH()});const d=await r.json();
      const novas=d.mensagens||[];
      if(novas.length){
        setMsgs(p=>{const ids=new Set(p.map(x=>x.id));return[...p,...novas.filter(x=>!ids.has(x.id))];});
        ultimoId.current=novas[novas.length-1].id;
        if(a.tipo==="dm") fetch(`${API}/lidas/${a.dados.id}`,{method:"PATCH",headers:authH()});
        else fetch(`${API}/grupos/${a.dados.id}/lidas`,{method:"POST",headers:authH()});
        fetchContatos();fetchGrupos();
      }
    }catch(e){}
  },[fetchContatos,fetchGrupos]);

  useEffect(()=>{
    clearInterval(pollRef.current);
    if(!ativo)return;
    fetchMsgs(ativo);
    pollRef.current=setInterval(()=>pollNovas(ativo),5000);
    return()=>clearInterval(pollRef.current);
  },[ativo?.tipo,ativo?.dados?.id]);

  const selecionar=(tipo,dados)=>{setAtivo({tipo,dados});setMsgs([]);setTexto("");setEditando(null);setArquivo(null);};

  const enviar=async e=>{
    e?.preventDefault();
    if(!ativo||(!texto.trim()&&!arquivo)) return;
    if(editando){
      const r=await fetch(`${API}/mensagens/${editando.id}`,{method:"PATCH",headers:hdrs(),body:JSON.stringify({conteudo:texto})});
      const d=await r.json();
      if(r.ok) setMsgs(p=>p.map(m=>m.id===editando.id?{...m,...d.mensagem}:m));
      setEditando(null);setTexto("");return;
    }
    setEnviando(true);
    const fd=new FormData();
    if(texto.trim()) fd.append("conteudo",texto.trim());
    if(ativo.tipo==="dm") fd.append("destinatario_id",ativo.dados.id);
    else fd.append("grupo_id",ativo.dados.id);
    if(arquivo) fd.append("arquivo",arquivo);
    const tmp={id:`tmp-${Date.now()}`,conteudo:texto.trim()||(arquivo?"📎 "+arquivo.name:""),tipo:"texto",remetente_id:myUser.id,created_at:new Date().toISOString()};
    setMsgs(p=>[...p,tmp]);setTexto("");setArquivo(null);
    try{
      const r=await fetch(`${API}/mensagens`,{method:"POST",headers:authH(),body:fd});
      const d=await r.json();
      if(r.ok){setMsgs(p=>p.map(m=>m.id===tmp.id?{...m,...d.mensagem}:m));ultimoId.current=Math.max(ultimoId.current,d.mensagem.id);fetchContatos();fetchGrupos();}
      else setMsgs(p=>p.filter(m=>m.id!==tmp.id));
    }catch(e){setMsgs(p=>p.filter(m=>m.id!==tmp.id));}
    finally{setEnviando(false);}
  };

  const deletar=async id=>{
    if(!window.confirm("Apagar mensagem?"))return;
    await fetch(`${API}/mensagens/${id}`,{method:"DELETE",headers:authH()});
    setMsgs(p=>p.map(m=>m.id===id?{...m,deletada:true,conteudo:"Mensagem apagada"}:m));
  };
  const excluirGrupo=async g=>{
    if(!window.confirm(`Excluir o grupo "${g.nome}"? Esta ação não pode ser desfeita.`))return;
    try {
      const r=await fetch(`${API}/grupos/${g.id}`,{method:"DELETE",headers:authH()});
      const d=await r.json().catch(()=>({}));
      if(r.ok){fetchGrupos();if(ativo?.dados?.id===g.id)setAtivo(null);}
      else alert(d.error||"Erro ao excluir grupo.");
    } catch(e) {
      alert("Erro ao excluir grupo.");
    }
  };

  const totalNaoLidas=contatos.reduce((a,c)=>a+parseInt(c.nao_lidas||0),0)+grupos.reduce((a,g)=>a+parseInt(g.nao_lidas||0),0);
  const contatosFilt=contatos.filter(c=>c.name.toLowerCase().includes(busca.toLowerCase()));
  const gruposFilt=grupos.filter(g=>g.nome.toLowerCase().includes(busca.toLowerCase()));

 return(
    <div style={{display:"flex",height:"100vh",background:M.bg,overflow:"hidden"}}>
      {showNovoGrupo&&<NovoGrupoModal onClose={()=>setShowNovoGrupo(false)} onCriado={g=>{fetchGrupos();setShowNovoGrupo(false);selecionar("grupo",g);}}/>}

      {/* PAINEL ESQUERDO — oculto no mobile quando conversa está aberta */}
      {(!isMobile||!ativo)&&(
      <div style={{width:isMobile?"100%":300,minWidth:isMobile?"100%":300,background:M.card,borderRight:`1px solid ${M.brdN}`,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:isMobile?"16px 14px 10px 64px":"16px 14px 10px",borderBottom:`1px solid ${M.brdN}`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <span style={{fontWeight:800,fontSize:17,color:M.tx}}>💬 Chat {totalNaoLidas>0&&<Badge count={totalNaoLidas}/>}</span>
            <button onClick={()=>setShowNovoGrupo(true)} title="Novo Grupo" style={{background:M.pri,color:"#fff",border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:700}}>+ Grupo</button>
          </div>
          <input placeholder="Buscar..." value={busca} onChange={e=>setBusca(e.target.value)}
            style={{width:"100%",padding:"7px 10px",border:`1px solid ${M.brdN}`,borderRadius:8,fontSize:13,boxSizing:"border-box",outline:"none"}}/>
        </div>

        <div style={{flex:1,overflowY:"auto"}}>
          {gruposFilt.length>0&&<div style={{padding:"8px 14px 4px",fontSize:10,fontWeight:700,color:M.txM,textTransform:"uppercase",letterSpacing:1}}>Grupos</div>}
          {gruposFilt.map(g=>{
            const at=ativo?.tipo==="grupo"&&ativo.dados.id===g.id;
            return(
              <div key={g.id} onClick={()=>selecionar("grupo",g)}
                style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",cursor:"pointer",background:at?M.priLight:"transparent",borderLeft:`3px solid ${at?M.pri:"transparent"}`}}>
                <div style={{width:38,height:38,borderRadius:"50%",background:M.pri,color:"#fff",fontWeight:800,fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>👥</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontWeight:700,fontSize:13,color:M.tx,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.nome}</span>
                    <div style={{display:"flex",gap:4,alignItems:"center"}}>
                      {parseInt(g.nao_lidas)>0&&<Badge count={g.nao_lidas}/>}
                      <button onClick={e=>{e.stopPropagation();excluirGrupo(g);}} title="Excluir grupo"
                        style={{background:"none",border:"none",color:"#dc2626",cursor:"pointer",fontSize:12,padding:"2px 4px",fontWeight:700}}>🗑</button>
                    </div>
                  </div>
                  <span style={{fontSize:11,color:M.txM}}>{g.membros} membros · {g.ultima_mensagem||"Sem mensagens"}</span>
                </div>
              </div>
            );
          })}

          {contatosFilt.length>0&&<div style={{padding:"8px 14px 4px",fontSize:10,fontWeight:700,color:M.txM,textTransform:"uppercase",letterSpacing:1}}>Direto</div>}
          {contatosFilt.map(c=>{
            const at=ativo?.tipo==="dm"&&ativo.dados.id===c.id;
            return(
              <div key={c.id} onClick={()=>selecionar("dm",c)}
                style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",cursor:"pointer",background:at?M.priLight:"transparent",borderLeft:`3px solid ${at?M.pri:"transparent"}`}}>
                <Avatar name={c.name}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontWeight:700,fontSize:13,color:M.tx,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</span>
                    <span style={{fontSize:10,color:M.txM,flexShrink:0,marginLeft:4}}>{fmtTime(c.ultima_mensagem_at)}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:11,color:M.txM,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:160}}>{c.ultima_mensagem||ROLES[c.role]||c.role}</span>
                    {parseInt(c.nao_lidas)>0&&<Badge count={c.nao_lidas}/>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* PAINEL DIREITO — ocupa tela toda no mobile */}
      {(!isMobile||ativo)&&(
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {!ativo?(
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:M.txM}}>
            <div style={{fontSize:56,marginBottom:16}}>💬</div>
            <div style={{fontSize:18,fontWeight:700,color:M.tx,marginBottom:8}}>Selecione uma conversa</div>
            <div style={{fontSize:13}}>Escolha um contato ou grupo à esquerda</div>
          </div>
        ):(
          <>
            {/* Header com botão voltar no mobile */}
            <div style={{padding:isMobile?"12px 18px 12px 64px":"12px 18px",background:M.card,borderBottom:`1px solid ${M.brdN}`,display:"flex",alignItems:"center",gap:12,boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
              {isMobile&&(
                <button onClick={()=>setAtivo(null)}
                  style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:M.pri,padding:"0 4px",fontWeight:700,flexShrink:0}}>←</button>
              )}
              {ativo.tipo==="grupo"
                ?<div style={{width:42,height:42,borderRadius:"50%",background:M.pri,color:"#fff",fontWeight:800,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>👥</div>
                :<Avatar name={ativo.dados.name} size={42}/>}
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:15,color:M.tx}}>{ativo.tipo==="grupo"?ativo.dados.nome:ativo.dados.name}</div>
                <div style={{fontSize:12,color:M.txM}}>{ativo.tipo==="grupo"?`${ativo.dados.membros} membros`:ROLES[ativo.dados.role]||ativo.dados.role}</div>
              </div>
              {ativo.tipo==="dm"&&ativo.dados.telefone&&(
                <a href={`https://wa.me/55${ativo.dados.telefone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                  style={{padding:"7px 12px",borderRadius:8,background:"#25D366",color:"#fff",fontWeight:700,fontSize:12,textDecoration:"none"}}>💬 WhatsApp</a>
              )}
            </div>

            {/* Mensagens */}
            <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:4}}>
              {loadingMsgs?<div style={{textAlign:"center",padding:40,color:M.txM}}>⏳ Carregando...</div>
              :msgs.length===0?<div style={{textAlign:"center",padding:40,color:M.txM,fontSize:13}}>Nenhuma mensagem ainda. Diga olá! 👋</div>
              :msgs.map((msg,i)=>{
                const isMeu=msg.remetente_id===myUser.id;
                const showDate=i===0||new Date(msg.created_at).toDateString()!==new Date(msgs[i-1].created_at).toDateString();
                return(
                  <React.Fragment key={msg.id}>
                    {showDate&&<div style={{textAlign:"center",margin:"10px 0 4px"}}>
                      <span style={{fontSize:11,color:M.txM,background:M.bg,padding:"3px 12px",borderRadius:12,fontWeight:600}}>
                        {new Date(msg.created_at).toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long"})}
                      </span></div>}
                    <Balao msg={msg} isMeu={isMeu} onEdit={m=>{setEditando(m);setTexto(m.conteudo);inputRef.current?.focus();}} onDelete={deletar}/>
                  </React.Fragment>
                );
              })}
              <div ref={msgEnd}/>
            </div>

            {/* Input */}
            <div style={{padding:"10px 16px",background:M.card,borderTop:`1px solid ${M.brdN}`}}>
              {editando&&<div style={{fontSize:12,color:M.pri,fontWeight:600,marginBottom:6,display:"flex",justifyContent:"space-between"}}>
                <span>✏️ Editando mensagem</span>
                <button onClick={()=>{setEditando(null);setTexto("");}} style={{background:"none",border:"none",cursor:"pointer",color:M.txM,fontSize:12}}>✕ Cancelar</button>
              </div>}
              {arquivo&&<div style={{fontSize:12,color:M.txM,marginBottom:6,display:"flex",alignItems:"center",gap:8,background:M.bg,padding:"6px 10px",borderRadius:8}}>
                📎 {arquivo.name}
                <button onClick={()=>setArquivo(null)} style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626",fontWeight:700,fontSize:14}}>✕</button>
              </div>}
              <form onSubmit={enviar} style={{display:"flex",gap:8,alignItems:"flex-end"}}>
                <button type="button" onClick={()=>fileRef.current?.click()} title="Anexar arquivo"
                  style={{padding:"9px 11px",border:`1px solid ${M.brdN}`,borderRadius:10,background:M.bg,cursor:"pointer",fontSize:16,flexShrink:0}}>📎</button>
                <input ref={fileRef} type="file" style={{display:"none"}} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.mp4"
                  onChange={e=>setArquivo(e.target.files[0]||null)}/>
                <textarea ref={inputRef} value={texto} onChange={e=>setTexto(e.target.value)} rows={1}
                  onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();enviar();}}}
                  placeholder="Digite uma mensagem..."
                  style={{flex:1,padding:"9px 12px",borderRadius:10,border:`1px solid ${editando?M.pri:M.brdN}`,fontSize:14,resize:"none",fontFamily:"inherit",outline:"none",maxHeight:100,overflowY:"auto"}}/>
                <button type="submit" disabled={enviando||(!texto.trim()&&!arquivo)}
                  style={{padding:"9px 16px",borderRadius:10,background:texto.trim()||arquivo?M.pri:M.brdN,color:"#fff",border:"none",fontWeight:700,cursor:"pointer",fontSize:15,flexShrink:0}}>➤</button>
              </form>
            </div>
          </>
        )}
      </div>
      )}
    </div>
  );}