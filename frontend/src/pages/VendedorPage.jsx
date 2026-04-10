import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../api";

const FONT = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap";
const GEMINI_MODEL = "gemini-1.5-flash";

const M = {
  pri:"#9B1B30",priDk:"#7A1526",priLt:"#B82840",priDeep:"#5E1220",
  glow:"rgba(155,27,48,0.30)",soft:"rgba(155,27,48,0.07)",brd:"rgba(155,27,48,0.25)",
  bg:"#fafafa",card:"#fff",alt:"#f5f3f0",brdN:"#e5e0db",brdL:"#d5cfc8",
  tx:"#1a1a1a",txM:"#6b6560",txD:"#9a948d",
  ok:"#16a34a",okS:"rgba(22,163,74,0.08)",okB:"rgba(22,163,74,0.2)",
  warn:"#d97706",warnS:"rgba(217,119,6,0.08)",warnB:"rgba(217,119,6,0.2)",
  blue:"#2563eb",blueS:"rgba(37,99,235,0.08)",blueB:"rgba(37,99,235,0.2)",
  err:"#dc2626",errS:"rgba(220,38,38,0.08)",
};

const STAGES=[
  {id:"novo",label:"Novo Chamado",color:"#6b7280",icon:"📥"},
  {id:"avaliacao",label:"Avaliação",color:"#f59e0b",icon:"🔍"},
  {id:"negociacao",label:"Negociação Cliente",color:"#8b5cf6",icon:"🤝"},
  {id:"espelho",label:"Emitir Espelho NFD",color:M.pri,icon:"🧾"},
  {id:"aguardando_nfd",label:"Aguard. NFD Cliente",color:"#2563eb",icon:"⏳"},
  {id:"aguardando_recolhimento",label:"Aguard. Recolhimento",color:"#059669",icon:"🚚"},
  {id:"aguardando_financeiro",label:"Aguard. Financeiro",color:"#16a34a",icon:"💰"},
  {id:"encerrado",label:"Encerrado",color:"#6b7280",icon:"✅"},
];

const TIPOS=[
  {id:"preco_errado",label:"Preço Errado"},
  {id:"produto_avariado",label:"Produto Avariado"},
  {id:"erro_pigmentacao",label:"Erro de Pigmentação"},
  {id:"produto_defeito",label:"Produto com Defeito"},
  {id:"qtd_errada",label:"Quantidade Errada / Pedido Errado"},
  {id:"arrependimento",label:"Arrependimento / Troca"},
  {id:"recusa_entrega",label:"Recusa na Entrega"},
];

const RESP=["Edite","Gabriel","Gustavo","Carlos","Ana"];

// ── REPAIR JSON ──
function repairJSON(str){
  let s=str.trim().replace(/^```json\s*/i,"").replace(/\s*```$/i,"").trim();
  const i=s.indexOf("{");if(i<0)return null;
  s=s.substring(i);
  try{return JSON.parse(s);}catch(e){}
  s=s.replace(/,\s*([}\]])/g,"$1");
  let inStr=false;
  for(let j=0;j<s.length;j++){if(s[j]==='"'&&(j===0||s[j-1]!=='\\'))inStr=!inStr;}
  if(inStr)s+='"';
  s=s.replace(/,\s*"[^"]*"?\s*:?\s*"?[^"{}[\]]*$/,"");
  let stack=[];
  for(let j=0;j<s.length;j++){const c=s[j];if(c==='{')stack.push('}');else if(c==='[')stack.push(']');else if(c==='}'||c===']')stack.pop();}
  while(stack.length>0)s+=stack.pop();
  s=s.replace(/,\s*([}\]])/g,"$1");
  try{return JSON.parse(s);}catch(e){return null;}
}

// ── DETERMINISTIC TRIAGE ──
function triageDeterministic(formData){
  const t=formData.tipoSolicitacao;
  const desc=(formData.descricao||"").toLowerCase();
  const base={elegivel_devolucao:true,motivo_inelegibilidade:"",escalacao_humana:false,motivo_escalacao:"",observacoes:""};
  if(desc.includes("personaliz")||desc.includes("tinta na máquina")||desc.includes("tinta na maquina")){
    if(!desc.includes("erro interno")&&!desc.includes("erro de digitação")&&!desc.includes("pigmentação errada"))
      return{...base,etapa_destino:"encerrado",resumo:"Produto personalizado não elegível para devolução.",acoes_automaticas:["Produto personalizado identificado"],proximas_etapas:[],precisa_espelho_nfd:false,precisa_recolhimento:false,elegivel_devolucao:false,motivo_inelegibilidade:"Produtos personalizados não são elegíveis para devolução, exceto em caso de erro interno."};
  }
  if(desc.includes("uso indevido")||desc.includes("mau uso"))
    return{...base,etapa_destino:"encerrado",resumo:"Produto com indícios de uso indevido.",acoes_automaticas:["Uso indevido identificado"],proximas_etapas:[],precisa_espelho_nfd:false,precisa_recolhimento:false,elegivel_devolucao:false,motivo_inelegibilidade:"Uso indevido não elegível."};
  switch(t){
    case"preco_errado":
      if(desc.includes("erro")&&(desc.includes("colaborador")||desc.includes("interno")||desc.includes("sistema")))
        return{...base,etapa_destino:"aguardando_financeiro",resumo:"Erro interno de preço. Encaminhado ao financeiro.",acoes_automaticas:["Erro interno identificado","Encaminhado ao ERP"],proximas_etapas:[],precisa_espelho_nfd:false,precisa_recolhimento:false};
      return{...base,etapa_destino:"avaliacao",resumo:"Erro de preço sem causa clara. Escalado para análise.",acoes_automaticas:["Chamado registrado"],proximas_etapas:["aguardando_financeiro"],precisa_espelho_nfd:false,precisa_recolhimento:false,escalacao_humana:true,motivo_escalacao:"Não foi possível identificar automaticamente a causa."};
    case"produto_avariado":
      if(desc.includes("transport"))
        return{...base,etapa_destino:"avaliacao",resumo:"Avaria por transportadora. Escalado.",acoes_automaticas:["Avaria por transportadora identificada"],proximas_etapas:[],precisa_espelho_nfd:false,precisa_recolhimento:false,escalacao_humana:true,motivo_escalacao:"Requer processo com a transportadora."};
      return{...base,etapa_destino:"espelho",resumo:"Produto avariado. Espelho NFD gerado.",acoes_automaticas:["Responsabilidade Marin identificada","Espelho NFD gerado"],proximas_etapas:["aguardando_nfd","aguardando_recolhimento"],precisa_espelho_nfd:true,precisa_recolhimento:true};
    case"erro_pigmentacao":
      if(desc.includes("cliente errou")||desc.includes("erro do cliente"))
        return{...base,etapa_destino:"encerrado",resumo:"Erro do cliente. Chamado encerrado.",acoes_automaticas:["Erro do cliente identificado"],proximas_etapas:[],precisa_espelho_nfd:false,precisa_recolhimento:false};
      return{...base,etapa_destino:"espelho",resumo:"Erro interno de pigmentação. Espelho NFD gerado.",acoes_automaticas:["Erro interno identificado","Espelho NFD gerado"],proximas_etapas:["aguardando_nfd","aguardando_recolhimento"],precisa_espelho_nfd:true,precisa_recolhimento:true};
    case"produto_defeito":
      if(desc.includes("suvinil"))
        return{...base,etapa_destino:"avaliacao",resumo:"Produto Suvinil. Necessário processo BASF (7-15 dias úteis).",acoes_automaticas:["Defeito Suvinil identificado","Instrução BASF enviada"],proximas_etapas:["aguardando_financeiro"],precisa_espelho_nfd:false,precisa_recolhimento:false,escalacao_humana:true,motivo_escalacao:"Defeito Suvinil requer análise técnica via BASF."};
      return{...base,etapa_destino:"espelho",resumo:"Produto com defeito. Espelho NFD gerado.",acoes_automaticas:["Defeito identificado","Espelho NFD gerado"],proximas_etapas:["aguardando_nfd","aguardando_recolhimento"],precisa_espelho_nfd:true,precisa_recolhimento:true};
    case"qtd_errada":
      return{...base,etapa_destino:"espelho",resumo:"Divergência de quantidade. Espelho NFD gerado.",acoes_automaticas:["Divergência identificada","Espelho NFD gerado"],proximas_etapas:["aguardando_nfd","aguardando_recolhimento"],precisa_espelho_nfd:true,precisa_recolhimento:false};
    case"arrependimento":
      return{...base,etapa_destino:"espelho",resumo:"Arrependimento/troca — produto lacrado, 7 dias, frete do cliente.",acoes_automaticas:["Solicitação registrada","Espelho NFD gerado — frete do cliente"],proximas_etapas:["aguardando_nfd","aguardando_recolhimento"],precisa_espelho_nfd:true,precisa_recolhimento:true,observacoes:"Frete de devolução é responsabilidade do CLIENTE."};
    case"recusa_entrega":
      return{...base,etapa_destino:"avaliacao",resumo:"Recusa na entrega. Necessário verificar motivo.",acoes_automaticas:["Recusa registrada"],proximas_etapas:["espelho"],precisa_espelho_nfd:false,precisa_recolhimento:false,escalacao_humana:true,motivo_escalacao:"Requer verificação do motivo pelo responsável."};
    default:
      return{...base,etapa_destino:"avaliacao",resumo:"Tipo não mapeado. Encaminhado para avaliação.",acoes_automaticas:["Chamado registrado"],proximas_etapas:[],precisa_espelho_nfd:false,precisa_recolhimento:false,escalacao_humana:true,motivo_escalacao:"Caso não previsto na política."};
  }
}

// ── GEMINI API HELPERS ──
async function geminiRequest(apiKey, parts, maxTokens=800){
  const r=await fetch(`https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({contents:[{parts}],generationConfig:{maxOutputTokens:maxTokens,temperature:0.1}})
  });
  if(!r.ok){const e=await r.text().catch(()=>"");throw new Error(`Gemini ${r.status}: ${e.substring(0,100)}`);}
  const d=await r.json();
  return d.candidates?.[0]?.content?.parts?.map(p=>p.text).join("")||"";
}

async function agentTriage(formData,apiKey){
  const fallback=triageDeterministic(formData);
  if(!apiKey)return fallback;
  try{
    const tipoLabel=TIPOS.find(t=>t.id===formData.tipoSolicitacao)?.label||formData.tipoSolicitacao;
    const txt=await geminiRequest(apiKey,[{text:`Triagem Pós-Vendas Marin. Classifique:
Tipo: ${tipoLabel} | Cliente: ${formData.razaoSocial} | NF: ${formData.nfOriginal}
Descrição: ${formData.descricao}
Regras: Defeito→"espelho" (Suvinil→"avaliacao"). Arrependimento 7dias→"espelho". Preço errado interno→"aguardando_financeiro". Avariado transportadora→"avaliacao". Avariado Marin→"espelho". Pigmentação Marin→"espelho", cliente→"encerrado". Qtd errada→"espelho". Personalizado/uso indevido→"encerrado". Ambíguo→"avaliacao" escalacao=true.
JSON puro: {"etapa_destino":"","resumo":"","acoes_automaticas":[],"proximas_etapas":[],"precisa_espelho_nfd":false,"precisa_recolhimento":false,"escalacao_humana":false,"motivo_escalacao":"","elegivel_devolucao":true,"motivo_inelegibilidade":"","observacoes":""}`}]);
    const parsed=repairJSON(txt);
    return(parsed&&parsed.etapa_destino)?parsed:{...fallback,observacoes:"Classificado por regras automáticas."};
  }catch(e){return{...fallback,observacoes:`Classificado por regras automáticas. (${e.message})`};}
}

async function agentDocument(b64,mime,apiKey){
  if(!apiKey)return null;
  try{
    const isImg=mime.startsWith("image/");
    const parts=isImg
      ?[{inline_data:{mime_type:mime,data:b64}},{text:"Extraia dados desta NF brasileira. Máximo 3 produtos. SOMENTE JSON puro: {\"numero_nf\":\"\",\"razao_social_dest\":\"\",\"cnpj_dest\":\"\",\"endereco_dest\":\"\",\"bairro_dest\":\"\",\"cep_dest\":\"\",\"municipio_dest\":\"\",\"uf_dest\":\"\",\"telefone_dest\":\"\",\"ie_dest\":\"\",\"natureza_operacao\":\"\",\"base_icms\":\"\",\"valor_icms\":\"\",\"valor_total_produtos\":\"\",\"valor_total_nota\":\"\",\"transportador_nome\":\"\",\"transportador_cnpj\":\"\",\"frete_por_conta\":\"\",\"produtos\":[{\"codigo\":\"\",\"descricao\":\"\",\"ncm\":\"\",\"cfop\":\"\",\"unidade\":\"\",\"quantidade\":\"\",\"valor_unitario\":\"\",\"valor_liquido\":\"\",\"valor_icms\":\"\",\"aliq_icms\":\"\"}],\"info_complementares\":\"\"}"}]
      :[{text:"Analise esta NF (PDF) e extraia: numero_nf, razao_social_dest, cnpj_dest, produtos (max 3), valor_total_nota. JSON puro apenas. Se não conseguir, retorne {\"error\":\"PDF não suportado\"}"}];
    const txt=await geminiRequest(apiKey,parts,1000);
    return repairJSON(txt)||{error:"JSON inválido"};
  }catch(e){return{error:e.message};}
}

async function agentEvidence(images,apiKey){
  if(!apiKey||!images.length)return null;
  try{
    const imgParts=images.slice(0,3).map(i=>({inline_data:{mime_type:i.mime,data:i.b64}}));
    const txt=await geminiRequest(apiKey,[...imgParts,{text:"Analise estas evidências de um chamado de pós-vendas de tintas/produtos. Descreva o estado, possíveis causas e responsabilidade. JSON puro: {\"resumo_evidencias\":\"\",\"estado_produto\":\"\",\"responsabilidade_sugerida\":\"\",\"pontos_observados\":[],\"grau_confianca\":\"\"}"}]);
    return repairJSON(txt)||{error:"JSON inválido"};
  }catch(e){return{error:e.message};}
}

// ── API KEY MODAL ──
function ApiKeyModal({onConfirm,onCancel}){
  const[val,setVal]=useState("");
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}}>
      <div style={{background:"#fff",borderRadius:14,padding:28,width:380,boxShadow:"0 20px 60px rgba(0,0,0,0.25)",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
        <div style={{fontSize:15,fontWeight:700,marginBottom:6}}>🔑 API Key do Google Gemini</div>
        <div style={{fontSize:12,color:"#6b6560",marginBottom:4}}>Obtenha gratuitamente em <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" style={{color:M.pri}}>aistudio.google.com</a></div>
        <div style={{fontSize:11,color:"#9a948d",marginBottom:12}}>Digite <b>TESTE</b> para simular a IA sem API.</div>
        <input autoFocus type="password" value={val} onChange={e=>setVal(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&val.trim()&&onConfirm(val.trim())}
          placeholder="AIza... ou TESTE"
          style={{width:"100%",padding:"10px 12px",border:"1px solid #e5e0db",borderRadius:8,fontSize:13,marginBottom:12,boxSizing:"border-box",outline:"none"}}/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={onCancel} style={{padding:"9px 18px",border:"1px solid #e5e0db",background:"#fff",borderRadius:8,fontSize:12,cursor:"pointer"}}>Cancelar</button>
          <button onClick={()=>val.trim()&&onConfirm(val.trim())} style={{padding:"9px 18px",background:M.pri,color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer"}}>Confirmar</button>
        </div>
      </div>
    </div>
  );
}

// ── VALIDATED INPUT ──
function VInput({label,value,onChange,placeholder,maxLength,type="text",pattern,required=true,error}){
  const[touched,setTouched]=useState(false);
  const showErr=touched&&error;
  return(
    <div>
      <label style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:showErr?M.err:M.txM,marginBottom:4,display:"flex",alignItems:"center",gap:4}}>
        {label}<span style={{color:M.pri,fontSize:8}}>*</span>
        {maxLength&&<span style={{fontWeight:400,fontSize:9,color:M.txD,marginLeft:"auto"}}>{value.length}/{maxLength}</span>}
      </label>
      <input type={type} value={value} placeholder={placeholder} maxLength={maxLength} required={required}
        style={{width:"100%",padding:"10px 12px",border:`1px solid ${showErr?M.err:M.brdN}`,borderRadius:8,fontSize:13,fontFamily:"'Plus Jakarta Sans',sans-serif",background:showErr?M.errS:"#fff",color:M.tx,outline:"none",transition:"all 0.2s",boxSizing:"border-box"}}
        onFocus={e=>{e.target.style.borderColor=M.pri;e.target.style.boxShadow=`0 0 0 3px ${M.soft}`;}}
        onBlur={e=>{setTouched(true);e.target.style.borderColor=showErr?M.err:M.brdN;e.target.style.boxShadow="none";}}
        onChange={e=>{let v=e.target.value;if(pattern==="numeric")v=v.replace(/\D/g,"");onChange(v);}}
      />
      {showErr&&<div style={{fontSize:10,color:M.err,marginTop:3}}>{error}</div>}
    </div>
  );
}



export default function VendedorPage(){
  const user=JSON.parse(localStorage.getItem("user")||"{}");
  const[step,setStep]=useState(0);
  const[form,setForm]=useState({codigo:"",razaoSocial:"",cnpj:"",responsavel:"",nomeVendedor:user.name||"",telefone:"",emailVendedor:user.email||"",tipoSolicitacao:"",descricao:"",nfOriginal:""});
  const[nfFile,setNfFile]=useState(null);const[nfB64,setNfB64]=useState(null);const[nfMime,setNfMime]=useState(null);
  const[evidenceFiles,setEvidenceFiles]=useState([]);
  const[nfData,setNfData]=useState(null);const[evidenceResult,setEvidenceResult]=useState(null);
  const[triageResult,setTriageResult]=useState(null);
  const[agentStatus,setAgentStatus]=useState({triage:"idle",doc:"idle",evidence:"idle"});
  const[animPhase,setAnimPhase]=useState(0);
  const[formErrors,setFormErrors]=useState({});
  const[apiKeyModal,setApiKeyModal]=useState(null);
  const[elapsed,setElapsed]=useState(0);
  const[savedId,setSavedId]=useState(null);
  const[activeTab,setActiveTab]=useState("novo");
  const[meusChamados,setMeusChamados]=useState([]);
  const[loadingChamados,setLoadingChamados]=useState(false);
  
  const loadChamados = useCallback(async () => {
    setLoadingChamados(true);
    try {
      const res = await api.getMeusChamados();
      setMeusChamados(res.chamados || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingChamados(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "meus") loadChamados();
  }, [activeTab, loadChamados]);
  const fRef=useRef(null);const evRef=useRef(null);
  const cancelledRef=useRef(false);const timerRef=useRef(null);

  useEffect(()=>{const l=document.createElement("link");l.href=FONT;l.rel="stylesheet";document.head.appendChild(l);},[]);
  useEffect(()=>{if(step===2&&animPhase<5){const t=setTimeout(()=>setAnimPhase(p=>p+1),350);return()=>clearTimeout(t);}},[step,animPhase]);

  const askApiKey=useCallback(()=>new Promise((resolve,reject)=>{setApiKeyModal({resolve,reject});}),[]);

  const getApiKey=useCallback(async()=>{
    let k=sessionStorage.getItem("gemini_key");
    if(!k){k=await askApiKey();if(!k)throw new Error("Chave não fornecida");sessionStorage.setItem("gemini_key",k);}
    return k;
  },[askApiKey]);

  const upd=(k,v)=>setForm(p=>({...p,[k]:v}));

  const validate=()=>{
    const e={};
    if(!form.codigo)e.codigo="Obrigatório";
    if(!form.razaoSocial||form.razaoSocial.length<3)e.razaoSocial="Mín. 3 caracteres";
    if(!form.cnpj||!(form.cnpj.length===11||form.cnpj.length===14))e.cnpj="CPF (11) ou CNPJ (14 dígitos)";
    if(!form.responsavel)e.responsavel="Selecione";
    if(!form.nomeVendedor||form.nomeVendedor.length<3)e.nomeVendedor="Mín. 3 caracteres";
    if(!form.telefone||form.telefone.length<10)e.telefone="Mín. 10 dígitos";
    if(!form.emailVendedor||!form.emailVendedor.includes("@"))e.emailVendedor="E-mail inválido";
    if(!form.tipoSolicitacao)e.tipoSolicitacao="Selecione";
    if(!form.nfOriginal)e.nfOriginal="Obrigatório";
    if(!form.descricao||form.descricao.length<20)e.descricao="Mín. 20 caracteres";
    if(!nfFile)e.nfFile="Anexe a Nota Fiscal";
    setFormErrors(e);
    return Object.keys(e).length===0;
  };

  const onFile=useCallback(async(e)=>{
    const file=e.target.files?.[0];if(!file)return;
    if(file.size>10*1024*1024){setFormErrors(p=>({...p,nfFile:"Máx 10MB"}));return;}
    setNfFile(file);setFormErrors(p=>{const n={...p};delete n.nfFile;return n;});
    const reader=new FileReader();
    reader.onload=()=>{setNfB64(reader.result.split(",")[1]);setNfMime(file.type);};
    reader.readAsDataURL(file);
  },[]);

  const onEvidenceFiles=useCallback(async(newFiles)=>{
    const added=[];
    for(const file of Array.from(newFiles)){
      if(file.size>20*1024*1024)continue;
      await new Promise(resolve=>{
        if(file.type.startsWith("video/")){added.push({file,b64:null,mime:file.type});resolve();}
        else{const r=new FileReader();r.onload=()=>{added.push({file,b64:r.result.split(",")[1],mime:file.type});resolve();};r.readAsDataURL(file);}
      });
    }
    setEvidenceFiles(p=>[...p,...added].slice(0,6));
  },[]);

  const submit=async()=>{
    if(!validate())return;
    cancelledRef.current=false;
    setStep(1);setElapsed(0);
    timerRef.current=setInterval(()=>setElapsed(p=>p+1),1000);

    let apiKey=null;
    try{apiKey=await getApiKey();}catch(_){/* use deterministic */}

    if(apiKey==="TESTE")apiKey=null; // will use deterministic + fake data

    try{
      setAgentStatus({triage:"running",doc:"waiting",evidence:"waiting"});

      let triageRes;
      try{triageRes=await agentTriage(form,apiKey);}
      catch(e){triageRes=triageDeterministic(form);triageRes.observacoes="Classificado por regras automáticas.";}
      if(cancelledRef.current)return;
      setTriageResult(triageRes);
      setAgentStatus(p=>({...p,triage:"done"}));

      let docRes=null;
      if(triageRes.precisa_espelho_nfd&&nfB64){
        setAgentStatus(p=>({...p,doc:"running"}));
        docRes=await agentDocument(nfB64,nfMime,apiKey);
        if(cancelledRef.current)return;
        if(docRes&&!docRes.error)setNfData(docRes);
        setAgentStatus(p=>({...p,doc:docRes?.error?"error":"done",docErrorText:docRes?.error}));
      }else{setAgentStatus(p=>({...p,doc:"skipped"}));}

      const evidImgs=evidenceFiles.filter(f=>f.b64&&f.mime.startsWith("image/"));
      let evRes=null;
      if(evidImgs.length>0){
        setAgentStatus(p=>({...p,evidence:"running"}));
        evRes=await agentEvidence(evidImgs,apiKey);
        if(cancelledRef.current)return;
        if(evRes&&!evRes.error)setEvidenceResult(evRes);
        setAgentStatus(p=>({...p,evidence:evRes?.error?"error":"done",evidenceErrorText:evRes?.error}));
      }else{setAgentStatus(p=>({...p,evidence:evidenceFiles.length>0?"skipped":"idle"}));}

      // Save to backend
      try{
        const fd=new FormData();
        Object.entries(form).forEach(([k,v])=>fd.append(k,v));
        fd.append("triage_result",JSON.stringify(triageRes));
        if(docRes&&!docRes.error)fd.append("nf_data",JSON.stringify(docRes));
        if(evRes&&!evRes.error)fd.append("evidence_result",JSON.stringify(evRes));
        if(nfFile)fd.append("nf_file",nfFile);
        evidenceFiles.forEach(f=>{if(f.file)fd.append("evidence_files",f.file);});
        const saved=await api.createChamado(fd);
        setSavedId(saved.chamado?.id);
      }catch(e){console.warn("Erro ao salvar chamado:",e.message);}

    }catch(e){
      const fb=triageDeterministic(form);fb.observacoes="Classificado por regras automáticas (erro geral).";
      setTriageResult(fb);setAgentStatus({triage:"done",doc:"skipped",evidence:"skipped"});
    }

    if(cancelledRef.current)return;
    clearInterval(timerRef.current);
    setStep(2);setAnimPhase(0);
  };

  const reset=()=>{
    clearInterval(timerRef.current);cancelledRef.current=false;
    setStep(0);setForm({codigo:"",razaoSocial:"",cnpj:"",responsavel:"",nomeVendedor:user.name||"",telefone:"",emailVendedor:user.email||"",tipoSolicitacao:"",descricao:"",nfOriginal:""});
    setNfFile(null);setNfB64(null);setNfMime(null);setEvidenceFiles([]);
    setNfData(null);setEvidenceResult(null);setTriageResult(null);
    setAgentStatus({triage:"idle",doc:"idle",evidence:"idle"});
    setAnimPhase(0);setFormErrors({});setElapsed(0);setSavedId(null);
  };

  const logout=()=>{localStorage.removeItem("token");localStorage.removeItem("user");window.location.href="/login";};
  const targetStage=triageResult?STAGES.find(s=>s.id===triageResult.etapa_destino):null;
  const AgentDot=({status})=>{
    const colors={idle:M.txD,waiting:"#94a3b8",running:M.warn,done:M.ok,error:M.err,skipped:M.txD};
    return<span style={{width:8,height:8,borderRadius:"50%",background:colors[status]||M.txD,display:"inline-block",animation:status==="running"?"pulse 1s infinite":"none"}}/>;
  };

  const handlePrint = () => {
    window.print();
  };

  return(
    <div style={{minHeight:"100vh",background:`linear-gradient(180deg,${M.pri} 0%,${M.priDeep} 220px,${M.bg} 220px)`,fontFamily:"'Plus Jakarta Sans',sans-serif",color:M.tx,padding:"0 12px 24px"}}>
      {apiKeyModal&&<ApiKeyModal
        onConfirm={k=>{setApiKeyModal(null);apiKeyModal.resolve(k);}}
        onCancel={()=>{setApiKeyModal(null);apiKeyModal.reject(new Error("Cancelado"));}}
      />}

      {/* HEADER */}
      <div className="no-print" style={{maxWidth:900,margin:"0 auto",paddingTop:22,paddingBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{textAlign:"left",flex:1,display:"flex",alignItems:"center",gap:12}}>
          <svg width="105" height="30" viewBox="0 0 140 40" fill="none"><rect width="140" height="40" rx="6" fill="rgba(255,255,255,0.15)"/><path d="M14 28L22 12L30 28H26L22 19L18 28H14Z" fill="white"/><text x="38" y="27" fontFamily="Plus Jakarta Sans,sans-serif" fontSize="18" fontWeight="800" fill="white" letterSpacing="1.5">MARIN</text></svg>
          <div>
            <h1 style={{fontSize:18,fontWeight:800,color:"#fff",margin:0}}>Triagem Pós-Vendas</h1>
            <p style={{color:"rgba(255,255,255,0.5)",fontSize:11,margin:0}}>Área do Vendedor</p>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
          <span style={{color:"rgba(255,255,255,0.8)",fontSize:11}}>{user.name}</span>
          <button onClick={logout} style={{padding:"4px 10px",background:"rgba(255,255,255,0.15)",color:"#fff",border:"1px solid rgba(255,255,255,0.3)",borderRadius:6,fontSize:10,cursor:"pointer"}}>Sair</button>
        </div>
      </div>

      {/* TABS */}
      <div className="no-print" style={{maxWidth:900,margin:"0 auto 16px",display:"flex",gap:8}}>
        <button onClick={()=>setActiveTab("novo")} style={{padding:"10px 20px",borderRadius:10,border:"none",background:activeTab==="novo"?"#fff":"rgba(255,255,255,0.1)",color:activeTab==="novo"?M.pri:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",transition:"all 0.2s"}}>+ Novo Chamado</button>
        <button onClick={()=>setActiveTab("meus")} style={{padding:"10px 20px",borderRadius:10,border:"none",background:activeTab==="meus"?"#fff":"rgba(255,255,255,0.1)",color:activeTab==="meus"?M.pri:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",transition:"all 0.2s"}}>📋 Meus Chamados</button>
      </div>

      {activeTab === "meus" ? (
        <div className="no-print" style={{maxWidth:900,margin:"0 auto",background:"#fff",borderRadius:14,padding:20,boxShadow:"0 8px 40px rgba(0,0,0,0.08)"}}>
          <h2 style={{fontSize:16,fontWeight:800,marginBottom:16}}>Histórico de Chamados</h2>
          {loadingChamados ? (
             <div style={{textAlign:"center",padding:40,color:M.txM}}>Carregando...</div>
          ) : meusChamados.length === 0 ? (
             <div style={{textAlign:"center",padding:40,color:M.txM}}>Nenhum chamado aberto ainda.</div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {meusChamados.map(c => (
                <div key={c.id} style={{border:`1px solid ${M.brdN}`,borderRadius:10,padding:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700}}>{c.razao_social}</div>
                    <div style={{fontSize:12,color:M.txM}}>NF {c.nf_original} · {c.tipo_solicitacao}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{display:"inline-block",padding:"4px 10px",background:"#f59e0b20",color:"#d97706",borderRadius:20,fontSize:11,fontWeight:700}}>{c.status}</div>
                    <div style={{fontSize:10,color:M.txD,marginTop:4}}>{new Date(c.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* PIPELINE */}
      <div style={{maxWidth:900,margin:"0 auto 14px",overflowX:"auto",paddingBottom:4}}>
        <div style={{display:"flex",gap:3,minWidth:680}}>
          {STAGES.filter(s=>s.id!=="encerrado").map(s=>{
            const isT=triageResult?.etapa_destino===s.id;
            const isN=triageResult?.proximas_etapas?.includes(s.id);
            return(<div key={s.id} style={{flex:1,padding:"7px 4px",borderRadius:8,textAlign:"center",background:isT?s.color:isN?`${s.color}08`:"#fff",border:`1.5px solid ${isT?s.color:isN?`${s.color}40`:M.brdN}`,color:isT?"#fff":isN?s.color:M.txD,transition:"all 0.5s",transform:isT?"scale(1.03)":"scale(1)",boxShadow:isT?`0 4px 16px ${s.color}40`:"none"}}>
              <div style={{fontSize:13,marginBottom:1}}>{s.icon}</div>
              <div style={{fontSize:7,fontWeight:700,textTransform:"uppercase",letterSpacing:0.2,lineHeight:1.2}}>{s.label}</div>
              {isT&&<div style={{fontSize:6,marginTop:2,opacity:0.8,fontWeight:600}}>DESTINO</div>}
            </div>);
          })}
        </div>
      </div>

      {/* CARD */}
      <div style={{maxWidth:900,margin:"0 auto",background:M.card,borderRadius:14,border:`1px solid ${M.brdN}`,boxShadow:"0 8px 40px rgba(0,0,0,0.08)",overflow:"hidden"}}>

        {/* FORM */}
        {step===0&&(
          <div style={{padding:"24px 28px"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
              {/* NF */}
              <div style={{padding:14,border:`2px dashed ${nfFile?M.ok:formErrors.nfFile?M.err:M.brdL}`,borderRadius:12,background:nfFile?M.okS:formErrors.nfFile?M.errS:"#faf9f7",textAlign:"center",cursor:"pointer"}}
                onClick={()=>fRef.current?.click()}
                onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor=M.pri;}}
                onDragLeave={e=>{e.currentTarget.style.borderColor=nfFile?M.ok:M.brdL;}}
                onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f){const dt=new DataTransfer();dt.items.add(f);fRef.current.files=dt.files;onFile({target:{files:[f]}});}}}>
                <input ref={fRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" style={{display:"none"}} onChange={onFile}/>
                {nfFile?(<div><span style={{fontSize:20}}>✅</span><div style={{fontSize:12,fontWeight:700,color:M.ok,marginTop:3}}>{nfFile.name}</div><div style={{fontSize:9,color:M.txD}}>{(nfFile.size/1024).toFixed(0)}KB</div><div style={{fontSize:10,color:M.pri,marginTop:3,textDecoration:"underline"}}>Trocar</div></div>)
                :(<div><span style={{fontSize:20}}>📄</span><div style={{fontSize:12,fontWeight:700,marginTop:3}}>Nota Fiscal *</div><div style={{fontSize:10,color:M.txM,marginTop:2}}>JPG, PNG ou PDF · máx 10MB</div>{formErrors.nfFile&&<div style={{fontSize:10,color:M.err,marginTop:3}}>{formErrors.nfFile}</div>}</div>)}
              </div>
              {/* Evidence */}
              <div style={{padding:14,border:`2px dashed ${evidenceFiles.length>0?M.blue:M.brdL}`,borderRadius:12,background:evidenceFiles.length>0?M.blueS:"#faf9f7",textAlign:"center",cursor:"pointer"}}
                onClick={()=>evRef.current?.click()}
                onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor=M.blue;}}
                onDragLeave={e=>{e.currentTarget.style.borderColor=evidenceFiles.length>0?M.blue:M.brdL;}}
                onDrop={e=>{e.preventDefault();onEvidenceFiles(e.dataTransfer.files);}}>
                <input ref={evRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/*" multiple style={{display:"none"}} onChange={e=>onEvidenceFiles(e.target.files)}/>
                {evidenceFiles.length>0?(<div><span style={{fontSize:20}}>🖼️</span><div style={{fontSize:12,fontWeight:700,color:M.blue,marginTop:3}}>{evidenceFiles.length} arquivo{evidenceFiles.length>1?"s":""} anexado{evidenceFiles.length>1?"s":""}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:4,justifyContent:"center",marginTop:6}}>
                    {evidenceFiles.map((f,i)=>(<span key={i} style={{fontSize:9,background:"#fff",border:`1px solid ${M.blueB}`,borderRadius:4,padding:"2px 5px",color:M.blue,display:"flex",alignItems:"center",gap:3}}>
                      {f.mime.startsWith("video/")?"🎥":"📷"} {f.file.name.substring(0,12)}{f.file.name.length>12?"…":""}
                      <span onClick={ev=>{ev.stopPropagation();setEvidenceFiles(p=>p.filter((_,j)=>j!==i));}} style={{cursor:"pointer",color:M.err,fontWeight:700,marginLeft:2}}>×</span>
                    </span>))}
                  </div>
                  <div style={{fontSize:9,color:M.blue,marginTop:4,textDecoration:"underline"}}>Adicionar mais</div>
                </div>)
                :(<div><span style={{fontSize:20}}>📸</span><div style={{fontSize:12,fontWeight:700,marginTop:3}}>Fotos / Vídeos</div><div style={{fontSize:10,color:M.txM,marginTop:2}}>Opcional · até 6 arquivos · máx 20MB cada</div><div style={{fontSize:9,color:M.txD,marginTop:2}}>⚠️ IA analisa apenas imagens</div></div>)}
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px 18px"}}>
              <VInput label="Código do Cliente" value={form.codigo} onChange={v=>upd("codigo",v)} placeholder="40001907" maxLength={10} pattern="numeric" error={formErrors.codigo}/>
              <VInput label="CNPJ ou CPF" value={form.cnpj} onChange={v=>upd("cnpj",v)} placeholder="11 ou 14 dígitos" maxLength={14} pattern="numeric" error={formErrors.cnpj}/>
              <div style={{gridColumn:"1/-1"}}><VInput label="Razão Social" value={form.razaoSocial} onChange={v=>upd("razaoSocial",v)} placeholder="Nome da empresa" maxLength={60} error={formErrors.razaoSocial}/></div>
              <div>
                <label style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:formErrors.responsavel?M.err:M.txM,marginBottom:4,display:"flex",alignItems:"center",gap:4}}>Responsável <span style={{color:M.pri,fontSize:8}}>*</span></label>
                <select value={form.responsavel} onChange={e=>upd("responsavel",e.target.value)} style={{width:"100%",padding:"10px 12px",border:`1px solid ${formErrors.responsavel?M.err:M.brdN}`,borderRadius:8,fontSize:13,fontFamily:"'Plus Jakarta Sans',sans-serif",background:"#fff",color:M.tx,cursor:"pointer",boxSizing:"border-box"}}>
                  <option value="">Selecione...</option>{RESP.map(r=><option key={r} value={r}>{r}</option>)}
                </select>
                {formErrors.responsavel&&<div style={{fontSize:10,color:M.err,marginTop:3}}>{formErrors.responsavel}</div>}
              </div>
              <VInput label="Nome do Vendedor" value={form.nomeVendedor} onChange={v=>upd("nomeVendedor",v)} placeholder="Nome completo" maxLength={40} error={formErrors.nomeVendedor}/>
              <VInput label="Telefone" value={form.telefone} onChange={v=>upd("telefone",v)} placeholder="49999999999" maxLength={15} pattern="numeric" error={formErrors.telefone}/>
              <VInput label="E-mail Vendedor" value={form.emailVendedor} onChange={v=>upd("emailVendedor",v)} placeholder="email@marinlog.com.br" maxLength={50} type="email" error={formErrors.emailVendedor}/>

              <div style={{gridColumn:"1/-1"}}>
                <label style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:formErrors.tipoSolicitacao?M.err:M.txM,marginBottom:4,display:"flex",alignItems:"center",gap:4}}>Tipo de Solicitação <span style={{color:M.pri,fontSize:8}}>*</span></label>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {TIPOS.map(t=>(<button key={t.id} onClick={()=>upd("tipoSolicitacao",t.id)} style={{padding:"8px 12px",borderRadius:8,border:form.tipoSolicitacao===t.id?`2px solid ${M.pri}`:`1px solid ${M.brdN}`,background:form.tipoSolicitacao===t.id?M.soft:"#fff",color:form.tipoSolicitacao===t.id?M.pri:M.txM,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",transition:"all 0.2s"}}>{t.label}</button>))}
                </div>
                {formErrors.tipoSolicitacao&&<div style={{fontSize:10,color:M.err,marginTop:3}}>{formErrors.tipoSolicitacao}</div>}
              </div>

              <VInput label="Nº Nota Fiscal Original" value={form.nfOriginal} onChange={v=>upd("nfOriginal",v)} placeholder="46665" maxLength={10} pattern="numeric" error={formErrors.nfOriginal}/>
              <div/>

              <div style={{gridColumn:"1/-1"}}>
                <label style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:formErrors.descricao?M.err:M.txM,marginBottom:4,display:"flex",alignItems:"center",gap:4}}>
                  Descrição do Chamado <span style={{color:M.pri,fontSize:8}}>*</span>
                  <span style={{fontWeight:400,fontSize:9,color:M.txD,marginLeft:"auto"}}>{form.descricao.length}/500</span>
                </label>
                <textarea value={form.descricao} maxLength={500} placeholder="Descreva detalhadamente o problema (mín. 20 caracteres)..."
                  style={{width:"100%",padding:"10px 12px",border:`1px solid ${formErrors.descricao?M.err:M.brdN}`,borderRadius:8,fontSize:13,fontFamily:"'Plus Jakarta Sans',sans-serif",background:formErrors.descricao?M.errS:"#fff",color:M.tx,outline:"none",minHeight:80,resize:"vertical",boxSizing:"border-box"}}
                  onFocus={e=>{e.target.style.borderColor=M.pri;e.target.style.boxShadow=`0 0 0 3px ${M.soft}`;}}
                  onBlur={e=>{e.target.style.borderColor=M.brdN;e.target.style.boxShadow="none";}}
                  onChange={e=>upd("descricao",e.target.value)}/>
                {formErrors.descricao&&<div style={{fontSize:10,color:M.err,marginTop:3}}>{formErrors.descricao}</div>}
              </div>
            </div>

            <button onClick={submit} style={{width:"100%",marginTop:22,padding:"13px",background:M.pri,color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",boxShadow:`0 4px 16px ${M.glow}`}}
              onMouseEnter={e=>e.target.style.background=M.priDk} onMouseLeave={e=>e.target.style.background=M.pri}>
              ⚡ Enviar para Triagem Automática
            </button>
          </div>
        )}

        {/* STEP 1 */}
        {step===1&&(
          <div style={{padding:"48px 28px",textAlign:"center"}}>
            <div style={{fontSize:36,marginBottom:16}}>🤖</div>
            <h2 style={{margin:"0 0 6px",fontSize:20,fontWeight:700}}>Agentes de IA Trabalhando</h2>
            <p style={{color:M.txM,fontSize:13,margin:"0 0 6px"}}>Analisando conforme a Política de Devoluções</p>
            <p style={{color:M.txD,fontSize:12,fontFamily:"'IBM Plex Mono',monospace",margin:"0 0 28px"}}>{elapsed}s</p>
            <div style={{maxWidth:400,margin:"0 auto",textAlign:"left"}}>
              {[
                {label:"Agente de Triagem",desc:"Classificando chamado...",status:agentStatus.triage},
                {label:"Agente Documental",desc:"Extraindo dados da NF...",status:agentStatus.doc},
                {label:"Agente de Evidências",desc:"Analisando fotos...",status:agentStatus.evidence},
              ].filter(a=>a.status!=="idle").map((a,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:a.status==="running"?M.soft:a.status==="done"?M.okS:"#faf9f7",border:`1px solid ${a.status==="running"?M.brd:a.status==="done"?M.okB:M.brdN}`,borderRadius:10,marginBottom:8,transition:"all 0.3s"}}>
                  <AgentDot status={a.status}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700}}>{a.label}</div>
                    <div style={{fontSize:11,color:M.txM}}>{a.status==="running"?a.desc:a.status==="done"?"Concluído ✓":a.status==="error"?"Erro — continuando...":a.status==="skipped"?"Não necessário":"Aguardando..."}</div>
                  </div>
                  {a.status==="running"&&<div style={{width:16,height:16,border:`2px solid ${M.pri}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>}
                </div>
              ))}
            </div>
            <button onClick={()=>{cancelledRef.current=true;clearInterval(timerRef.current);const fb=triageDeterministic(form);fb.observacoes="Cancelado pelo usuário.";setTriageResult(fb);setAgentStatus({triage:"error",doc:"error",evidence:"error"});setStep(2);setAnimPhase(0);}}
              style={{marginTop:20,padding:"8px 20px",background:"transparent",color:M.txM,border:`1px solid ${M.brdN}`,borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Cancelar</button>
          </div>
        )}

        {/* STEP 2 */}
        {step===2&&triageResult&&(
          <div style={{padding:"24px 28px"}}>
            {savedId&&<div style={{background:M.okS,border:`1px solid ${M.okB}`,borderRadius:8,padding:"8px 14px",fontSize:12,color:M.ok,marginBottom:16}}>✅ Chamado #{savedId} salvo no sistema</div>}
            <div style={{opacity:animPhase>=1?1:0,transform:animPhase>=1?"translateY(0)":"translateY(10px)",transition:"all 0.5s",background:`linear-gradient(135deg,${targetStage?.color}10,${targetStage?.color}05)`,border:`2px solid ${targetStage?.color}30`,borderRadius:12,padding:20,marginBottom:20}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,color:M.txM,marginBottom:6}}>Mover para no Bitrix24</div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:42,height:42,borderRadius:10,background:targetStage?.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{targetStage?.icon}</div>
                    <div>
                      <div style={{fontSize:20,fontWeight:800}}>{targetStage?.label}</div>
                      <div style={{fontSize:12,color:M.txM,marginTop:2}}>{form.razaoSocial} — NF {form.nfOriginal}</div>
                    </div>
                  </div>
                </div>
                <div style={{padding:"6px 14px",borderRadius:50,background:triageResult.escalacao_humana?M.warnS:M.okS,border:`1px solid ${triageResult.escalacao_humana?M.warnB:M.okB}`,color:triageResult.escalacao_humana?M.warn:M.ok,fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:5}}>
                  <span style={{width:7,height:7,borderRadius:"50%",background:triageResult.escalacao_humana?M.warn:M.ok}}/>
                  {triageResult.escalacao_humana?"Escalar p/ Responsável":"Automatizado"}
                </div>
              </div>
              <div style={{marginTop:14,padding:"10px 14px",background:"#fff",borderRadius:8,border:`1px solid ${M.brdN}`,fontSize:13,lineHeight:1.5}}>{triageResult.resumo}</div>
            </div>

            {triageResult.elegivel_devolucao===false&&(<div style={{opacity:animPhase>=2?1:0,transition:"all 0.5s",background:M.errS,border:`1.5px solid ${M.err}30`,borderRadius:10,padding:16,marginBottom:20}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><span style={{fontSize:16}}>🚫</span><span style={{fontSize:13,fontWeight:700,color:M.err}}>Não Elegível para Devolução</span></div><div style={{fontSize:13,lineHeight:1.5}}>{triageResult.motivo_inelegibilidade}</div></div>)}
            {triageResult.escalacao_humana&&(<div style={{opacity:animPhase>=2?1:0,transition:"all 0.5s",background:M.warnS,border:`1.5px solid ${M.warnB}`,borderRadius:10,padding:16,marginBottom:20}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><span style={{fontSize:16}}>👤</span><span style={{fontSize:13,fontWeight:700,color:M.warn}}>Escalado para Responsável</span></div><div style={{fontSize:13,lineHeight:1.5}}>{triageResult.motivo_escalacao||"Necessita avaliação humana"}</div></div>)}
            {triageResult.acoes_automaticas?.length>0&&(<div style={{opacity:animPhase>=2?1:0,transition:"all 0.5s 0.1s",marginBottom:20}}><div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:M.txM,marginBottom:8}}>Ações Realizadas</div>{triageResult.acoes_automaticas.map((a,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 14px",background:i%2===0?M.okS:"#fff",border:`1px solid ${M.okB}`,borderRadius:8,marginBottom:3,fontSize:12}}><span style={{color:M.ok,fontWeight:700}}>✓</span><span>{a}</span></div>))}</div>)}

            {evidenceResult&&!evidenceResult.error&&(<div style={{opacity:animPhase>=3?1:0,transition:"all 0.5s 0.15s",marginBottom:20,background:M.blueS,border:`1px solid ${M.blueB}`,borderRadius:10,padding:16}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><span style={{fontSize:16}}>🔍</span><div><div style={{fontSize:12,fontWeight:700,color:M.blue}}>Análise de Evidências (IA)</div><div style={{fontSize:10,color:M.txM}}>Estado: <b>{evidenceResult.estado_produto}</b> · Responsabilidade: <b>{evidenceResult.responsabilidade_sugerida}</b> · Confiança: <b>{evidenceResult.grau_confianca}</b></div></div></div><div style={{fontSize:12,lineHeight:1.6,marginBottom:6}}>{evidenceResult.resumo_evidencias}</div>{evidenceResult.pontos_observados?.map((p,i)=>(<div key={i} style={{display:"flex",gap:6,fontSize:11}}><span style={{color:M.blue}}>▸</span><span>{p}</span></div>))}</div>)}
            {triageResult.observacoes&&(<div style={{opacity:animPhase>=3?1:0,transition:"all 0.5s 0.1s",background:M.blueS,border:`1px solid ${M.blueB}`,borderRadius:10,padding:14,marginBottom:20}}><div style={{fontSize:11,fontWeight:700,color:M.blue,marginBottom:6}}>Observações</div><div style={{fontSize:12,lineHeight:1.5}}>{triageResult.observacoes}</div></div>)}

            <button onClick={reset} style={{width:"100%",padding:"13px",background:M.pri,color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",boxShadow:`0 4px 16px ${M.glow}`}}>← Novo Chamado</button>
          </div>
        )}

      </div>
      </>
      )}

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}} @keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box} select{appearance:auto} textarea{font-family:'Plus Jakarta Sans',sans-serif}`}</style>
    </div>
  );
}
