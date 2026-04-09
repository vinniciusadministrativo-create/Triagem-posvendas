const fs = require('fs');

const path = 'c:/Users/Jovem Apreniz 2/Downloads/trabalho/trabalho/frontend/src/pages/VendedorPage.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add DANFE component and print function above VendedorPage function
const danfeCode = `
// ── DANFE COMPONENT ──
function DANFE({nf,form}) {
  const d=nf||{};const prods=d.produtos?.length?d.produtos:[{}];const now=new Date();
  const bL={fontSize:7,textTransform:"uppercase",color:"#666",fontWeight:600,letterSpacing:0.4,marginBottom:1};
  const bV={fontSize:10,fontFamily:"'IBM Plex Mono',monospace",fontWeight:500,minHeight:13};
  const sc={border:"1.5px solid #333",marginBottom:-1.5};
  const sT={fontSize:7,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,background:M.pri,padding:"2px 6px",borderBottom:"1px solid #333",color:"#fff"};
  const Bx=({label,value,style={}})=>(<div style={{padding:"3px 6px",borderRight:"1px solid #333",...style}}><div style={bL}>{label}</div><div style={bV}>{value||"—"}</div></div>);
  const cH={fontSize:7,fontWeight:700,color:"#333",textTransform:"uppercase",padding:"3px 4px",background:"#f0ebe5",borderBottom:"1px solid #333",whiteSpace:"nowrap"};
  const cD={fontSize:8,padding:"4px",borderBottom:"1px solid #aaa",fontFamily:"'IBM Plex Mono',monospace"};
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
        <div style={sc}><div style={{borderBottom:"1px solid #333"}}><Bx label="Natureza da Operação" value={d.natureza_operacao||"1202 - DEVOLUÇÃO DE VENDA"} style={{borderRight:"none"}}/></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr"}}><Bx label="IE" value="261935348"/><Bx label="IE ST" value=""/><Bx label="CNPJ" value="04.002.562/0004-78" style={{borderRight:"none"}}/></div></div>
        <div style={sc}><div style={sT}>Destinatário / Remetente</div><div style={{display:"grid",gridTemplateColumns:"2fr 1fr",borderBottom:"1px solid #333"}}><Bx label="Razão Social" value={d.razao_social_dest||form.razaoSocial}/><Bx label="CNPJ" value={d.cnpj_dest||form.cnpj} style={{borderRight:"none"}}/></div><div style={{display:"grid",gridTemplateColumns:"2fr 1fr 0.6fr 0.4fr",borderBottom:"1px solid #333"}}><Bx label="Endereço" value={d.endereco_dest}/><Bx label="Bairro" value={d.bairro_dest}/><Bx label="CEP" value={d.cep_dest}/><Bx label="UF" value={d.uf_dest} style={{borderRight:"none"}}/></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr"}}><Bx label="Município" value={d.municipio_dest}/><Bx label="Telefone" value={d.telefone_dest||form.telefone}/><Bx label="IE" value={d.ie_dest} style={{borderRight:"none"}}/></div></div>
        <div style={sc}><div style={sT}>Cálculo do Imposto</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",borderBottom:"1px solid #333"}}><Bx label="Base ICMS" value={d.base_icms}/><Bx label="Vlr ICMS" value={d.valor_icms}/><Bx label="Base ST" value={d.base_icms_st||"0,00"}/><Bx label="Vlr ST" value={d.valor_icms_st||"0,00"} style={{borderRight:"none"}}/></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr 1fr"}}><Bx label="Produtos" value={d.valor_total_produtos}/><Bx label="IPI" value={d.valor_ipi||"0,00"}/><Bx label="Outras" value={d.outras_despesas||"0,00"}/><Bx label="Desc." value={d.desconto||"0,00"}/><Bx label="Frete" value={d.valor_frete||"0,00"}/><Bx label="TOTAL" value={d.valor_total_nota} style={{borderRight:"none"}}/></div></div>
        <div style={sc}><div style={sT}>Transportador</div><div style={{display:"grid",gridTemplateColumns:"2fr 1fr 0.4fr 1fr"}}><Bx label="Nome" value={d.transportador_nome}/><Bx label="CNPJ" value={d.transportador_cnpj}/><Bx label="UF" value={d.transportador_uf}/><Bx label="Frete" value={d.frete_por_conta||"1-CIF"} style={{borderRight:"none"}}/></div></div>
        <div style={sc}><div style={sT}>Produtos</div><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Cód","Descrição","NCM","CST","CFOP","Un","Qtd","Vlr.Un","Vlr.Líq","ICMS","%ICMS"].map(h=><th key={h} style={cH}>{h}</th>)}</tr></thead><tbody>{prods.map((p,i)=>(<tr key={i}><td style={cD}>{p.codigo}</td><td style={{...cD,minWidth:90,fontSize:7}}>{p.descricao}</td><td style={cD}>{p.ncm}</td><td style={cD}>{p.cst}</td><td style={cD}>{p.cfop}</td><td style={cD}>{p.unidade}</td><td style={cD}>{p.quantidade}</td><td style={cD}>{p.valor_unitario}</td><td style={cD}>{p.valor_liquido}</td><td style={cD}>{p.valor_icms}</td><td style={cD}>{p.aliq_icms}</td></tr>))}</tbody></table></div></div>
        <div style={{...sc,display:"grid",gridTemplateColumns:"1fr 1fr"}}><div style={{borderRight:"1px solid #333",padding:"4px 8px"}}><div style={bL}>Info. Complementares</div><div style={{fontSize:8,lineHeight:1.5,minHeight:28,fontFamily:"'IBM Plex Mono',monospace"}}>{d.info_complementares||\`Vendedor: \${form.nomeVendedor}\`}{(d.nf_referencia||form.nfOriginal)&&<><br/>DEVOLUÇÃO REF. NF {d.nf_referencia||form.nfOriginal}</>}</div></div><div style={{padding:"4px 8px"}}><div style={bL}>Dados Adicionais</div><div style={{fontSize:7,color:"#888",marginTop:4}}>{now.toLocaleDateString("pt-BR")} {now.toLocaleTimeString("pt-BR")}</div><div style={{fontSize:6,color:"#aaa",marginTop:2}}>Triagem Automática Marin</div></div></div>
      </div>
    </div>
  );
}

export default function VendedorPage(){
`;
content = content.replace('export default function VendedorPage(){', danfeCode);

// 2. Add activeTab and chamados states
const statesAdd = `
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
`;
content = content.replace('const[savedId,setSavedId]=useState(null);', 'const[savedId,setSavedId]=useState(null);' + statesAdd);

// 3. Print function
const printFunc = `
  const handlePrint = () => {
    window.print();
  };
`;
content = content.replace('  const targetStage=triageResult?STAGES.find(s=>s.id===triageResult.etapa_destino):null;', printFunc + '\n  const targetStage=triageResult?STAGES.find(s=>s.id===triageResult.etapa_destino):null;');

// 4. Tabs & Header
const headerReplacement = `
      {/* HEADER */}
      <div style={{maxWidth:900,margin:"0 auto",paddingTop:22,paddingBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between"}} className="no-print">
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
      <div style={{maxWidth:900,margin:"0 auto 16px",display:"flex",gap:8}} className="no-print">
        <button onClick={()=>setActiveTab("novo")} style={{padding:"10px 20px",borderRadius:10,border:"none",background:activeTab==="novo"?"#fff":"rgba(255,255,255,0.1)",color:activeTab==="novo"?M.pri:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",transition:"all 0.2s"}}>+ Novo Chamado</button>
        <button onClick={()=>setActiveTab("meus")} style={{padding:"10px 20px",borderRadius:10,border:"none",background:activeTab==="meus"?"#fff":"rgba(255,255,255,0.1)",color:activeTab==="meus"?M.pri:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",transition:"all 0.2s"}}>📋 Meus Chamados</button>
      </div>
      
      {activeTab === "meus" ? (
        <div style={{maxWidth:900,margin:"0 auto",background:"#fff",borderRadius:14,padding:20,boxShadow:"0 8px 40px rgba(0,0,0,0.08)"}} className="no-print">
          <h2 style={{fontSize:16,fontWeight:800,marginBottom:16}}>Histórico de Chamados</h2>
          {loadingChamados ? (
             <div style={{textAlign:"center",padding:40,color:M.txM}}>Carregando...</div>
          ) : meusChamados.length === 0 ? (
             <div style={{textAlign:"center",padding:40,color:M.txM}}>Nenhum chamado aberto ainda.</div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {meusChamados.map(c => (
                <div key={c.id} style={{border:\`1px solid \${M.brdN}\`,borderRadius:10,padding:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
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
`;
content = content.replace(/\{\/\* HEADER \*\/\}[\s\S]*?\{\/\* PIPELINE \*\/\}/, headerReplacement + '\n      {/* PIPELINE */}');

// 5. Wrap the bottom with </>
content = content.replace('Triagem Automática Pós-Vendas Marin × Gemini AI', '</>\n      )}\n\n      <div className="no-print" style={{maxWidth:900,margin:"14px auto 0",textAlign:"center",color:M.txD,fontSize:10}}>Triagem Automática Pós-Vendas Marin × Gemini AI');

// 6. Modify DANFE button
const danfeButton = `
            {triageResult.precisa_espelho_nfd&&(
              <div style={{opacity:animPhase>=3?1:0,transition:"all 0.5s",marginBottom:20}}>
                <button onClick={()=>setShowDANFE(!showDANFE)} style={{width:"100%",padding:"12px",background:showDANFE?M.alt:M.pri,color:showDANFE?M.tx:"#fff",border:showDANFE?\`1px solid \${M.brdN}\`:"none",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",boxShadow:showDANFE?"none":\`0 4px 16px \${M.glow}\`}}>
                  {showDANFE?"Ocultar Espelho":"🧾 Ver Espelho DANFE"}
                </button>
                {showDANFE&&(
                  nfData ? (
                    <div style={{marginTop:12}}>
                      <div style={{textAlign:"right",marginBottom:8}}><button onClick={handlePrint} style={{padding:"8px 16px",background:M.ok,color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer"}}>🖨️ Imprimir PDF</button></div>
                      <div style={{borderRadius:10,overflow:"hidden",border:\`1px solid \${M.brdN}\`,boxShadow:"0 4px 20px rgba(0,0,0,0.06)"}}><DANFE nf={nfData} form={form}/></div>
                    </div>
                  ) : <div style={{marginTop:12,padding:20,background:M.errS,borderRadius:10,textAlign:"center",fontSize:13,color:M.err}}>{agentStatus.docErrorText||"Erro ao extrair NF."}</div>
                )}
              </div>
            )}
`;
// find where evidenceResult is and put it before
content = content.replace(/\{evidenceResult&&!evidenceResult\.error/, danfeButton + '\n            {evidenceResult&&!evidenceResult.error');

const cssPrint = `
      <style>{\`
        @media print {
          body * { visibility: hidden; }
          #danfe-print, #danfe-print * { visibility: visible; }
          #danfe-print { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
          .no-print { display: none !important; }
        }
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}} @keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box} select{appearance:auto} textarea{font-family:'Plus Jakarta Sans',sans-serif}\`}</style>
`;
content = content.replace(/<style>\{`@keyframes pulse.*\}<\/style>/s, cssPrint);

fs.writeFileSync(path, content, 'utf8');
console.log('Success');
