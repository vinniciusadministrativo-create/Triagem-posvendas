import { useState, useEffect, useRef, useCallback } from "react";

const FONT = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap";

const M = {
  pri: "#9B1B30", priDk: "#7A1526", priLt: "#B82840", priDeep: "#5E1220",
  glow: "rgba(155,27,48,0.30)", soft: "rgba(155,27,48,0.07)", brd: "rgba(155,27,48,0.25)",
  bg: "#fafafa", card: "#fff", alt: "#f5f3f0", brdN: "#e5e0db", brdL: "#d5cfc8",
  tx: "#1a1a1a", txM: "#6b6560", txD: "#9a948d",
  ok: "#16a34a", okS: "rgba(22,163,74,0.08)", okB: "rgba(22,163,74,0.2)",
  warn: "#d97706", warnS: "rgba(217,119,6,0.08)", warnB: "rgba(217,119,6,0.2)",
  blue: "#2563eb", blueS: "rgba(37,99,235,0.08)", blueB: "rgba(37,99,235,0.2)",
  err: "#dc2626", errS: "rgba(220,38,38,0.08)",
};

const STAGES = [
  { id: "novo", label: "Novo Chamado", color: "#6b7280", icon: "📥" },
  { id: "avaliacao", label: "Avaliação", color: "#f59e0b", icon: "🔍" },
  { id: "negociacao", label: "Negociação Cliente", color: "#8b5cf6", icon: "🤝" },
  { id: "espelho", label: "Emitir Espelho NFD", color: M.pri, icon: "🧾" },
  { id: "aguardando_nfd", label: "Aguard. NFD Cliente", color: "#2563eb", icon: "⏳" },
  { id: "aguardando_recolhimento", label: "Aguard. Recolhimento", color: "#059669", icon: "🚚" },
  { id: "aguardando_financeiro", label: "Aguard. Financeiro", color: "#16a34a", icon: "💰" },
  { id: "encerrado", label: "Encerrado", color: "#6b7280", icon: "✅" },
];

const TIPOS = [
  { id: "preco_errado", label: "Preço Errado" },
  { id: "produto_avariado", label: "Produto Avariado" },
  { id: "erro_pigmentacao", label: "Erro de Pigmentação" },
  { id: "produto_defeito", label: "Produto com Defeito" },
  { id: "qtd_errada", label: "Quantidade Errada / Pedido Errado" },
  { id: "arrependimento", label: "Arrependimento / Troca" },
  { id: "recusa_entrega", label: "Recusa na Entrega" },
];

const RESP = ["Edite", "Gabriel", "Gustavo", "Carlos", "Ana"];

// ── REPAIR TRUNCATED JSON ──
function repairJSON(str) {
  let s = str.trim().replace(/^```json\s*/i,"").replace(/\s*```$/i,"").trim();
  const i = s.indexOf("{"); if (i<0) return null;
  s = s.substring(i);
  try { return JSON.parse(s); } catch(e) {}
  s = s.replace(/,\s*([}\]])/g,"$1");
  let inStr=false;
  for(let j=0;j<s.length;j++){if(s[j]==='"'&&(j===0||s[j-1]!=='\\'))inStr=!inStr;}
  if(inStr) s+='"';
  s=s.replace(/,\s*"[^"]*"?\s*:?\s*"?[^"{}[\]]*$/,"");
  let stack=[];
  for(let j=0;j<s.length;j++){const c=s[j];if(c==='{')stack.push('}');else if(c==='[')stack.push(']');else if(c==='}'||c===']')stack.pop();}
  while(stack.length>0) s+=stack.pop();
  s=s.replace(/,\s*([}\]])/g,"$1");
  try{return JSON.parse(s);}catch(e){return null;}
}

// ── DETERMINISTIC TRIAGE (always works, no API needed) ──
function triageDeterministic(formData) {
  const t = formData.tipoSolicitacao;
  const desc = (formData.descricao || "").toLowerCase();

  const base = { elegivel_devolucao: true, motivo_inelegibilidade: "", escalacao_humana: false, motivo_escalacao: "", observacoes: "" };

  // Check non-eligible keywords
  if (desc.includes("personaliz") || desc.includes("tinta na máquina") || desc.includes("tinta na maquina")) {
    if (!desc.includes("erro interno") && !desc.includes("erro de digitação") && !desc.includes("pigmentação errada")) {
      return { ...base, etapa_destino: "encerrado", resumo: "Produto personalizado não elegível para devolução conforme política.", acoes_automaticas: ["Produto personalizado identificado", "Não se enquadra nas condições de devolução"], proximas_etapas: [], precisa_espelho_nfd: false, precisa_recolhimento: false, elegivel_devolucao: false, motivo_inelegibilidade: "Produtos personalizados (tinta na máquina) não são elegíveis para devolução, exceto em caso de erro interno." };
    }
  }
  if (desc.includes("uso indevido") || desc.includes("mau uso") || desc.includes("má utilização")) {
    return { ...base, etapa_destino: "encerrado", resumo: "Produto com indícios de uso indevido. Não elegível.", acoes_automaticas: ["Uso indevido identificado na descrição"], proximas_etapas: [], precisa_espelho_nfd: false, precisa_recolhimento: false, elegivel_devolucao: false, motivo_inelegibilidade: "Produtos com indícios de uso indevido ou danificados por má utilização não são elegíveis." };
  }

  switch (t) {
    case "preco_errado":
      if (desc.includes("erro") && (desc.includes("colaborador") || desc.includes("interno") || desc.includes("sistema") || desc.includes("digitação") || desc.includes("digitacao"))) {
        return { ...base, etapa_destino: "aguardando_financeiro", resumo: "Erro interno de preço identificado. Encaminhado ao financeiro para geração de crédito.", acoes_automaticas: ["Erro interno de preço identificado na descrição", "Dados do cliente e NF coletados", "Encaminhado para geração de crédito no ERP"], proximas_etapas: [], precisa_espelho_nfd: false, precisa_recolhimento: false };
      }
      return { ...base, etapa_destino: "avaliacao", resumo: "Erro de preço sem causa clara identificada. Escalado para análise do responsável.", acoes_automaticas: ["Chamado registrado", "Dados coletados"], proximas_etapas: ["aguardando_financeiro"], precisa_espelho_nfd: false, precisa_recolhimento: false, escalacao_humana: true, motivo_escalacao: "Não foi possível identificar automaticamente a causa do erro de preço. Necessário análise manual." };

    case "produto_avariado":
      if (desc.includes("transport")) {
        return { ...base, etapa_destino: "avaliacao", resumo: "Produto avariado — responsabilidade da transportadora identificada. Escalado para processo de troca.", acoes_automaticas: ["Avaria por transportadora identificada", "Dados e NF coletados"], proximas_etapas: [], precisa_espelho_nfd: false, precisa_recolhimento: false, escalacao_humana: true, motivo_escalacao: "Avaria por transportadora requer processo de troca direto com a transportadora." };
      }
      return { ...base, etapa_destino: "espelho", resumo: "Produto avariado — espelho NFD gerado para devolução e reposição.", acoes_automaticas: ["Responsabilidade Marin identificada", "Espelho NFD gerado automaticamente", "Aguardando NF de devolução do cliente"], proximas_etapas: ["aguardando_nfd", "aguardando_recolhimento"], precisa_espelho_nfd: true, precisa_recolhimento: true };

    case "erro_pigmentacao":
      if (desc.includes("cliente errou") || desc.includes("erro do cliente") || desc.includes("cliente pediu errado") || desc.includes("confirmação do cliente")) {
        return { ...base, etapa_destino: "encerrado", resumo: "Erro de pigmentação de responsabilidade do cliente. Chamado encerrado com evidências.", acoes_automaticas: ["Erro do cliente identificado", "Evidências da confirmação do pedido registradas", "Cliente comunicado"], proximas_etapas: [], precisa_espelho_nfd: false, precisa_recolhimento: false };
      }
      return { ...base, etapa_destino: "espelho", resumo: "Erro interno de pigmentação. Espelho NFD gerado para devolução.", acoes_automaticas: ["Erro interno de pigmentação identificado", "Espelho NFD gerado automaticamente"], proximas_etapas: ["aguardando_nfd", "aguardando_recolhimento"], precisa_espelho_nfd: true, precisa_recolhimento: true };

    case "produto_defeito":
      if (desc.includes("suvinil")) {
        if (desc.includes("aplicação") || desc.includes("aplicou errado") || desc.includes("erro de aplicação") || desc.includes("aplicacao")) {
          return { ...base, etapa_destino: "encerrado", resumo: "Erro de aplicação do produto Suvinil identificado. Não é defeito de fábrica.", acoes_automaticas: ["Erro de aplicação identificado", "Cliente comunicado sobre uso correto"], proximas_etapas: [], precisa_espelho_nfd: false, precisa_recolhimento: false };
        }
        return { ...base, etapa_destino: "avaliacao", resumo: "Produto Suvinil com possível defeito de lote. Necessário processo BASF (7-15 dias úteis).", acoes_automaticas: ["Defeito de produto Suvinil identificado", "Instrução enviada para abrir chamado BASF", "NF e evidências registradas"], proximas_etapas: ["aguardando_financeiro"], precisa_espelho_nfd: false, precisa_recolhimento: false, escalacao_humana: true, motivo_escalacao: "Defeito Suvinil requer análise técnica via BASF. Prazo: 7-15 dias úteis.", observacoes: "Após resultado BASF: se deferido → gerar crédito; se indeferido → encerrar chamado." };
      }
      return { ...base, etapa_destino: "espelho", resumo: "Produto com defeito identificado. Espelho NFD gerado para devolução.", acoes_automaticas: ["Defeito identificado na descrição", "Espelho NFD gerado automaticamente"], proximas_etapas: ["aguardando_nfd", "aguardando_recolhimento"], precisa_espelho_nfd: true, precisa_recolhimento: true };

    case "qtd_errada":
      if (desc.includes("a mais") || desc.includes("excedente") || desc.includes("sobrando") || desc.includes("mais do que")) {
        return { ...base, etapa_destino: "espelho", resumo: "Produtos a mais identificados. Espelho NFD gerado, recolhimento necessário.", acoes_automaticas: ["Excesso de produtos identificado", "Espelho NFD gerado automaticamente"], proximas_etapas: ["aguardando_nfd", "aguardando_recolhimento"], precisa_espelho_nfd: true, precisa_recolhimento: true };
      }
      return { ...base, etapa_destino: "espelho", resumo: "Produtos faltando / pedido errado. Espelho NFD gerado, crédito será analisado pelo financeiro.", acoes_automaticas: ["Divergência de quantidade identificada", "Espelho NFD gerado automaticamente"], proximas_etapas: ["aguardando_nfd", "aguardando_financeiro"], precisa_espelho_nfd: true, precisa_recolhimento: false };

    case "arrependimento":
      return { ...base, etapa_destino: "espelho", resumo: "Arrependimento/troca — produto deve estar lacrado, prazo 7 dias. Frete por conta do cliente.", acoes_automaticas: ["Solicitação de arrependimento registrada", "Verificação: prazo de 7 dias e produto lacrado", "Espelho NFD gerado — frete do cliente"], proximas_etapas: ["aguardando_nfd", "aguardando_recolhimento"], precisa_espelho_nfd: true, precisa_recolhimento: true, observacoes: "Conforme política: frete de devolução é responsabilidade do CLIENTE. Produto deve estar lacrado e em perfeito estado." };

    case "recusa_entrega":
      return { ...base, etapa_destino: "avaliacao", resumo: "Recusa na entrega registrada. Necessário verificar motivo e estado do produto.", acoes_automaticas: ["Recusa na entrega registrada", "Dados da NF e descrição coletados"], proximas_etapas: ["espelho"], precisa_espelho_nfd: false, precisa_recolhimento: false, escalacao_humana: true, motivo_escalacao: "Recusa na entrega requer verificação do motivo (avaria, divergência, etc) pelo responsável." };

    default:
      return { ...base, etapa_destino: "avaliacao", resumo: "Tipo de solicitação não mapeado. Encaminhado para avaliação.", acoes_automaticas: ["Chamado registrado"], proximas_etapas: [], precisa_espelho_nfd: false, precisa_recolhimento: false, escalacao_humana: true, motivo_escalacao: "Caso não previsto na política de devoluções." };
  }
}

// ── AI AGENT 1: TRIAGE (with deterministic fallback) ──
async function agentTriage(formData, askApiKey) {
  // Always have the deterministic result ready as fallback
  const fallback = triageDeterministic(formData);

  try {
    let apiKey = localStorage.getItem("anthropic_api_key");
    if (!apiKey) {
      apiKey = await askApiKey("Cole sua API Key da Anthropic, ou digite TESTE para simular a IA:");
      if (apiKey) localStorage.setItem("anthropic_api_key", apiKey.trim());
      else throw new Error("API Key não fornecida pelo usuário.");
    }
    
    if (apiKey.toUpperCase() === "TESTE") {
      await new Promise(r => setTimeout(r, 1500));
      return { ...fallback, etapa_destino: "espelho", resumo: "[MODO DE TESTE] IA simulada ativada demonstrando a criação automática do Espelho NFD.", acoes_automaticas: ["Leitura simulada com sucesso", "Espelho NFD gerado baseando-se no processo automático"], proximas_etapas: ["aguardando_nfd", "aguardando_recolhimento"], precisa_espelho_nfd: true, precisa_recolhimento: true, observacoes: "Modo de Teste Simulado. Nenhuma API real foi cobrada ou chamada." };
    }

    const tipoLabel = TIPOS.find(t => t.id === formData.tipoSolicitacao)?.label || formData.tipoSolicitacao;
    const ctrl = new AbortController();
    const tmout = setTimeout(() => ctrl.abort(), 30000);

    // RESTAURADO PARA ANTHROPIC - Requer chamada via Chrome com --disable-web-security
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerously-allow-browser": "true"
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 800,
        messages: [{ role: "user", content: `Triagem Pós-Vendas Marin. Classifique:
Tipo: ${tipoLabel} | Cliente: ${formData.razaoSocial} | NF: ${formData.nfOriginal}
Descrição: ${formData.descricao}

Regras: Defeito→"espelho" (Suvinil→"avaliacao" p/ BASF). Arrependimento 7dias→"espelho". Preço errado interno→"aguardando_financeiro". Avariado transportadora→"avaliacao". Avariado Marin→"espelho". Pigmentação Marin→"espelho", cliente→"encerrado". Qtd errada→"espelho". Personalizado/uso indevido→"encerrado". Ambíguo→"avaliacao" escalacao=true.

JSON puro:
{"etapa_destino":"","resumo":"","acoes_automaticas":[],"proximas_etapas":[],"precisa_espelho_nfd":false,"precisa_recolhimento":false,"escalacao_humana":false,"motivo_escalacao":"","elegivel_devolucao":true,"motivo_inelegibilidade":"","observacoes":""}` }]
      })
    });

    clearTimeout(tmout);

    if (!r.ok) {
      if (r.status === 401) localStorage.removeItem("anthropic_api_key");
      const errBody = await r.text().catch(()=>"");
      console.warn("Triage API failed, using fallback:", r.status, errBody);
      return { ...fallback, error: true, observacoes: (fallback.observacoes ? fallback.observacoes + " | " : "") + `Erro da Anthropic: HTTP ${r.status} ${errBody ? '- '+errBody.substring(0, 100) : ''}` };
    }

    const data = await r.json();
    const txt = data.content?.filter(i => i.type === "text").map(i => i.text).join("") || "";
    const parsed = repairJSON(txt);

    if (parsed && parsed.etapa_destino) return parsed;

    // AI response didn't parse → use fallback
    return { ...fallback, observacoes: (fallback.observacoes ? fallback.observacoes + " | " : "") + "Classificado por regras automáticas." };

  } catch (e) {
    console.warn("Triage AI failed, using deterministic fallback:", e.message);
    return { ...fallback, observacoes: (fallback.observacoes ? fallback.observacoes + " | " : "") + `Erro de conexão com a Anthropic (${e.message}). Leia as dicas de uso do Crome para testes.` };
  }
}

// ── AI AGENT 2: DOCUMENT ANALYSIS ──
async function agentDocument(b64, mime, askApiKey) {
  const ctrl = new AbortController();
  const tmout = setTimeout(() => ctrl.abort(), 60000);
  try {
    let apiKey = localStorage.getItem("anthropic_api_key");
    if (!apiKey) {
      apiKey = await askApiKey("Cole sua API Key da Anthropic para extrair dados da NF, ou digite TESTE para simular:");
      if (apiKey) localStorage.setItem("anthropic_api_key", apiKey.trim());
      else throw new Error("API Key não fornecida pelo usuário.");
    }
    
    if (apiKey.toUpperCase() === "TESTE") {
      await new Promise(r => setTimeout(r, 2000));
      return {
        numero_nf: "998877",
        razao_social_dest: "EMPRESA DE TESTES E VALIDAÇÕES LTDA",
        cnpj_dest: "12.345.678/0001-99",
        endereco_dest: "RUA DOS DESENVOLVEDORES, 404",
        bairro_dest: "CENTRO",
        cep_dest: "88000-000",
        municipio_dest: "SÃO JOSÉ",
        uf_dest: "SC",
        telefone_dest: "(48) 99999-9999",
        ie_dest: "123.456.789",
        natureza_operacao: "1202 - DEVOLUÇÃO SIMULADA",
        base_icms: "2.500,00",
        valor_icms: "425,00",
        valor_total_produtos: "2.500,00",
        valor_total_nota: "2.500,00",
        transportador_nome: "TRANSPORTES RÁPIDOS",
        transportador_cnpj: "98.765.432/0001-11",
        frete_por_conta: "0-Emitente",
        produtos: [
          { codigo: "PROD-01", descricao: "PRODUTO EXTRAÍDO PELA IA DE FORMA SIMULADA (10L)", ncm: "3209.10.10", cfop: "1202", unidade: "GL", quantidade: "10", valor_unitario: "250,00", valor_liquido: "2.500,00", valor_icms: "425,00", aliq_icms: "17%" }
        ],
        info_complementares: "Exemplo demonstrativo do Agente Documental gerando o Espelho NFD com Base no arquivo simulado."
      };
    }

    const ct = mime.startsWith("image/") ? "image" : "document";
    const mt = mime === "application/pdf" ? "application/pdf" : mime;
    
    // RESTAURADO PARA ANTHROPIC
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerously-allow-browser": "true"
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            { type: ct, source: { type: "base64", media_type: mt, data: b64 } },
            { type: "text", text: `Extraia dados desta NF brasileira. Máximo 3 produtos. Retorne SOMENTE JSON puro:
{"numero_nf":"","razao_social_dest":"","cnpj_dest":"","endereco_dest":"","bairro_dest":"","cep_dest":"","municipio_dest":"","uf_dest":"","telefone_dest":"","ie_dest":"","natureza_operacao":"","base_icms":"","valor_icms":"","valor_total_produtos":"","valor_total_nota":"","transportador_nome":"","transportador_cnpj":"","frete_por_conta":"","quantidade_volumes":"","peso_bruto":"","produtos":[{"codigo":"","descricao":"","ncm":"","cfop":"","unidade":"","quantidade":"","valor_unitario":"","valor_liquido":"","valor_icms":"","aliq_icms":""}],"info_complementares":"","vendedor":"","nf_referencia":""}` }
          ]
        }]
      })
    });
    
    clearTimeout(tmout);
    if (!r.ok) {
      if (r.status === 401) localStorage.removeItem("anthropic_api_key");
      const errBody = await r.text().catch(()=>"");
      console.error("Doc API error:", r.status, errBody);
      return { error: r.status === 401 ? "Chave da Anthropic Inválida." : `Erro Anthropic ${r.status}: ${errBody ? errBody.substring(0,100) : ''}` };
    }
    const data = await r.json();
    const txt = data.content?.filter(i => i.type === "text").map(i => i.text).join("") || "";
    if (!txt.trim()) return { error: "Resposta vazia" };
    const parsed = repairJSON(txt);
    return parsed || { error: "JSON inválido" };
  } catch (e) {
    clearTimeout(tmout);
    console.error("Doc error:", e);
    return { error: e.name === "AbortError" ? "Demorou demais (Timeout)." : `Falha de Conexão com Anthropic. Lembre-se de abrir o Chrome no modo Desenvolvedor.` };
  }
}

// ── AI AGENT 3: EVIDENCE ANALYSIS (photos only, up to 3 images) ──
async function agentEvidence(images, askApiKey) {
  // images: [{b64, mime, name}] — only image/* accepted by Claude
  const validImgs = images.filter(i => i.mime.startsWith("image/")).slice(0, 3);
  if (!validImgs.length) return { error: "Nenhuma imagem válida para análise (vídeos não são suportados pela IA)." };

  const ctrl = new AbortController();
  const tmout = setTimeout(() => ctrl.abort(), 60000);
  try {
    let apiKey = localStorage.getItem("anthropic_api_key");
    if (!apiKey) {
      apiKey = await askApiKey("Cole sua API Key da Anthropic para analisar as evidências, ou digite TESTE para simular:");
      if (apiKey) localStorage.setItem("anthropic_api_key", apiKey.trim());
      else throw new Error("API Key não fornecida pelo usuário.");
    }

    if (apiKey.toUpperCase() === "TESTE") {
      await new Promise(r => setTimeout(r, 1800));
      return {
        resumo_evidencias: "[TESTE] Imagens analisadas com sucesso pelo agente simulado. Foram identificadas embalagens com danos visíveis e produto com coloração inconsistente em relação ao pedido original.",
        estado_produto: "Avariado",
        responsabilidade_sugerida: "Marin",
        pontos_observados: ["Embalagem amassada na lateral esquerda", "Produto com tonalidade diferente do especificado", "Lacre intacto — produto não foi aberto"],
        grau_confianca: "Alto"
      };
    }

    const imgContent = validImgs.map(img => ({ type: "image", source: { type: "base64", media_type: img.mime, data: img.b64 } }));

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerously-allow-browser": "true"
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 800,
        messages: [{
          role: "user",
          content: [
            ...imgContent,
            { type: "text", text: `Analise estas imagens de evidência de um chamado de pós-vendas de tintas/produtos de pintura.
Descreva o estado do produto, possíveis causas do problema e de quem pode ser a responsabilidade.
Retorne SOMENTE JSON puro:
{"resumo_evidencias":"","estado_produto":"","responsabilidade_sugerida":"","pontos_observados":[],"grau_confianca":""}` }
          ]
        }]
      })
    });

    clearTimeout(tmout);
    if (!r.ok) {
      if (r.status === 401) localStorage.removeItem("anthropic_api_key");
      const errBody = await r.text().catch(() => "");
      return { error: `Erro Anthropic ${r.status}: ${errBody ? errBody.substring(0, 100) : ''}` };
    }
    const data = await r.json();
    const txt = data.content?.filter(i => i.type === "text").map(i => i.text).join("") || "";
    if (!txt.trim()) return { error: "Resposta vazia" };
    const parsed = repairJSON(txt);
    return parsed || { error: "JSON inválido" };
  } catch (e) {
    clearTimeout(tmout);
    return { error: e.name === "AbortError" ? "Timeout ao analisar evidências." : `Falha de conexão: ${e.message}` };
  }
}

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
    <div style={{background:"#fff",padding:20,fontFamily:"'Plus Jakarta Sans',sans-serif",color:"#000",position:"relative"}}>
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
        <div style={{...sc,display:"grid",gridTemplateColumns:"1fr 1fr"}}><div style={{borderRight:"1px solid #333",padding:"4px 8px"}}><div style={bL}>Info. Complementares</div><div style={{fontSize:8,lineHeight:1.5,minHeight:28,fontFamily:"'IBM Plex Mono',monospace"}}>{d.info_complementares||`Vendedor: ${form.nomeVendedor}`}{(d.nf_referencia||form.nfOriginal)&&<><br/>DEVOLUÇÃO REF. NF {d.nf_referencia||form.nfOriginal}</>}</div></div><div style={{padding:"4px 8px"}}><div style={bL}>Dados Adicionais</div><div style={{fontSize:7,color:"#888",marginTop:4}}>{now.toLocaleDateString("pt-BR")} {now.toLocaleTimeString("pt-BR")}</div><div style={{fontSize:6,color:"#aaa",marginTop:2}}>Triagem Automática Marin</div></div></div>
      </div>
    </div>
  );
}

// ── VALIDATED INPUT ──
function VInput({label,value,onChange,placeholder,maxLength,type="text",pattern,required=true,error}) {
  const [touched,setTouched]=useState(false);
  const showErr=touched&&error;
  return(
    <div>
      <label style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:showErr?M.err:M.txM,marginBottom:4,display:"flex",alignItems:"center",gap:4}}>
        {label} <span style={{color:M.pri,fontSize:8}}>*</span>
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

// ── MAIN ──
// ── API KEY MODAL ──
function ApiKeyModal({onConfirm,onCancel,label="Cole sua API Key da Anthropic:"}) {
  const [val,setVal]=useState("");
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}}>
      <div style={{background:"#fff",borderRadius:14,padding:28,width:380,boxShadow:"0 20px 60px rgba(0,0,0,0.25)",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
        <div style={{fontSize:15,fontWeight:700,marginBottom:6}}>🔒 Chave da Anthropic</div>
        <div style={{fontSize:12,color:"#6b6560",marginBottom:12}}>{label}<br/><span style={{fontSize:11,color:"#9a948d"}}>Digite <b>TESTE</b> para simular.</span></div>
        <input autoFocus type="password" value={val} onChange={e=>setVal(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&val.trim()&&onConfirm(val.trim())}
          placeholder="sk-ant-... ou TESTE"
          style={{width:"100%",padding:"10px 12px",border:"1px solid #e5e0db",borderRadius:8,fontSize:13,marginBottom:12,boxSizing:"border-box",outline:"none"}}/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={onCancel} style={{padding:"9px 18px",border:"1px solid #e5e0db",background:"#fff",borderRadius:8,fontSize:12,cursor:"pointer"}}>Cancelar</button>
          <button onClick={()=>val.trim()&&onConfirm(val.trim())} style={{padding:"9px 18px",background:"#9B1B30",color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer"}}>Confirmar</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [step,setStep]=useState(0);
  const [form,setForm]=useState({codigo:"",razaoSocial:"",cnpj:"",responsavel:"",nomeVendedor:"",telefone:"",emailVendedor:"",tipoSolicitacao:"",descricao:"",nfOriginal:""});
  const [nfFile,setNfFile]=useState(null);
  const [nfB64,setNfB64]=useState(null);
  const [nfMime,setNfMime]=useState(null);
  const [nfData,setNfData]=useState(null);
  const [evidenceFiles,setEvidenceFiles]=useState([]);  // [{file, b64, mime}]
  const [evidenceResult,setEvidenceResult]=useState(null);
  const [triageResult,setTriageResult]=useState(null);
  const [agentStatus,setAgentStatus]=useState({triage:"idle",doc:"idle",evidence:"idle"});
  const [showDANFE,setShowDANFE]=useState(false);
  const [animPhase,setAnimPhase]=useState(0);
  const [formErrors,setFormErrors]=useState({});
  const [apiKeyModal,setApiKeyModal]=useState(null); // {resolve,reject,label}
  const fRef=useRef(null);
  const evRef=useRef(null);
  const cancelledRef=useRef(false);

  useEffect(()=>{const l=document.createElement("link");l.href=FONT;l.rel="stylesheet";document.head.appendChild(l);},[]);
  useEffect(()=>{if(step===2&&animPhase<5){const t=setTimeout(()=>setAnimPhase(p=>p+1),350);return()=>clearTimeout(t);}},[step,animPhase]);

  // Helper: show modal and wait for user to provide API key
  const askApiKey = useCallback((label) => new Promise((resolve, reject) => {
    setApiKeyModal({ resolve, reject, label });
  }), []);

  const upd=(k,v)=>setForm(p=>({...p,[k]:v}));

  const validate=()=>{
    const e={};
    if(!form.codigo||form.codigo.length<1) e.codigo="Código obrigatório";
    if(!form.razaoSocial||form.razaoSocial.length<3) e.razaoSocial="Mín. 3 caracteres";
    if(!form.cnpj||!(form.cnpj.length===11||form.cnpj.length===14)) e.cnpj="CPF (11) ou CNPJ (14 dígitos)";
    if(!form.responsavel) e.responsavel="Selecione";
    if(!form.nomeVendedor||form.nomeVendedor.length<3) e.nomeVendedor="Mín. 3 caracteres";
    if(!form.telefone||form.telefone.length<10) e.telefone="Mín. 10 dígitos";
    if(!form.emailVendedor||!form.emailVendedor.includes("@")) e.emailVendedor="E-mail inválido";
    if(!form.tipoSolicitacao) e.tipoSolicitacao="Selecione o tipo";
    if(!form.nfOriginal) e.nfOriginal="Nº da NF obrigatório";
    if(!form.descricao||form.descricao.length<20) e.descricao="Mín. 20 caracteres";
    if(!nfFile) e.nfFile="Anexe a Nota Fiscal";
    setFormErrors(e);
    return Object.keys(e).length===0;
  };

  const onFile=useCallback(async(e)=>{
    const file=e.target.files?.[0]; if(!file) return;
    if(file.size>10*1024*1024){setFormErrors(p=>({...p,nfFile:"Máx 10MB"}));return;}
    setNfFile(file);setFormErrors(p=>{const n={...p};delete n.nfFile;return n;});
    const reader=new FileReader();
    reader.onload=()=>{setNfB64(reader.result.split(",")[1]);setNfMime(file.type);};
    reader.readAsDataURL(file);
  },[]);

  const onEvidenceFiles=useCallback(async(newFiles)=>{
    const added=[];
    for(const file of Array.from(newFiles)){
      if(file.size>20*1024*1024) continue; // skip >20MB
      await new Promise(resolve=>{
        if(file.type.startsWith("video/")){
          added.push({file,b64:null,mime:file.type}); resolve();
        } else {
          const r=new FileReader();
          r.onload=()=>{added.push({file,b64:r.result.split(",")[1],mime:file.type});resolve();};
          r.readAsDataURL(file);
        }
      });
    }
    setEvidenceFiles(p=>[...p,...added].slice(0,6)); // max 6 files
  },[]);

  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  const submit = async () => {
    if (!validate()) return;
    cancelledRef.current = false;
    setStep(1);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);

    try {
      // Agent 1: Triage (NEVER fails — has deterministic fallback)
      setAgentStatus({ triage: "running", doc: "waiting", evidence: "waiting" });

      let triageRes;
      try {
        triageRes = await Promise.race([
          agentTriage(form, askApiKey),
          new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 35000))
        ]);
      } catch (e) {
        console.warn("Triage race failed, using deterministic:", e);
        triageRes = triageDeterministic(form);
        triageRes.observacoes = (triageRes.observacoes || "") + " Classificado por regras automáticas.";
      }

      if (cancelledRef.current) return;

      if (triageRes?.error) {
        triageRes = triageDeterministic(form);
        triageRes.observacoes = (triageRes.observacoes || "") + " Classificado por regras automáticas.";
      }

      setTriageResult(triageRes);
      setAgentStatus(p => ({ ...p, triage: "done" }));

      // Agent 2: Document (only if triage says DANFE needed)
      if (triageRes.precisa_espelho_nfd && nfB64) {
        setAgentStatus(p => ({ ...p, doc: "running" }));
        try {
          const docRes = await Promise.race([
            agentDocument(nfB64, nfMime, askApiKey),
            new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 65000))
          ]);
          if (cancelledRef.current) return;
          if (!docRes?.error) setNfData(docRes);
          setAgentStatus(p => ({ ...p, doc: docRes?.error ? "error" : "done", docErrorText: docRes?.error }));
        } catch (e) {
          console.warn("Doc agent failed:", e);
          setAgentStatus(p => ({ ...p, doc: "error", docErrorText: "Falha de rede ao contatar a Anthropic." }));
        }
      } else {
        setAgentStatus(p => ({ ...p, doc: "skipped" }));
      }

      // Agent 3: Evidence (if images were attached)
      const evidenceImages = evidenceFiles.filter(f => f.b64 && f.mime.startsWith("image/"));
      if (evidenceImages.length > 0) {
        setAgentStatus(p => ({ ...p, evidence: "running" }));
        try {
          const evRes = await Promise.race([
            agentEvidence(evidenceImages, askApiKey),
            new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 65000))
          ]);
          if (cancelledRef.current) return;
          if (!evRes?.error) setEvidenceResult(evRes);
          setAgentStatus(p => ({ ...p, evidence: evRes?.error ? "error" : "done", evidenceErrorText: evRes?.error }));
        } catch (e) {
          console.warn("Evidence agent failed:", e);
          setAgentStatus(p => ({ ...p, evidence: "error", evidenceErrorText: "Falha de rede ao analisar evidências." }));
        }
      } else {
        setAgentStatus(p => ({ ...p, evidence: evidenceFiles.length > 0 ? "skipped" : "idle" }));
      }
    } catch (e) {
      console.error("Submit error:", e);
      // Ultimate fallback
      const fb = triageDeterministic(form);
      fb.observacoes = "Classificado por regras automáticas (erro geral).";
      setTriageResult(fb);
      setAgentStatus({ triage: "done", doc: "skipped", evidence: "skipped" });
    }

    if (cancelledRef.current) return;
    clearInterval(timerRef.current);
    setStep(2);
    setAnimPhase(0);
  };

  const reset=()=>{clearInterval(timerRef.current);cancelledRef.current=false;setStep(0);setForm({codigo:"",razaoSocial:"",cnpj:"",responsavel:"",nomeVendedor:"",telefone:"",emailVendedor:"",tipoSolicitacao:"",descricao:"",nfOriginal:""});setNfFile(null);setNfB64(null);setNfMime(null);setNfData(null);setEvidenceFiles([]);setEvidenceResult(null);setTriageResult(null);setAgentStatus({triage:"idle",doc:"idle",evidence:"idle"});setShowDANFE(false);setAnimPhase(0);setFormErrors({});setElapsed(0);};

  const targetStage=triageResult?STAGES.find(s=>s.id===triageResult.etapa_destino):null;

  const AgentDot=({status})=>{
    const colors={idle:M.txD,waiting:"#94a3b8",running:M.warn,done:M.ok,error:M.err,skipped:M.txD};
    return <span style={{width:8,height:8,borderRadius:"50%",background:colors[status]||M.txD,display:"inline-block",animation:status==="running"?"pulse 1s infinite":"none"}}/>;
  };

  return(
    <div style={{minHeight:"100vh",background:`linear-gradient(180deg,${M.pri} 0%,${M.priDeep} 220px,${M.bg} 220px)`,fontFamily:"'Plus Jakarta Sans',sans-serif",color:M.tx,padding:"0 12px 24px"}}>
      {/* API KEY MODAL */}
      {apiKeyModal&&<ApiKeyModal
        label={apiKeyModal.label}
        onConfirm={key=>{setApiKeyModal(null);apiKeyModal.resolve(key);}}
        onCancel={()=>{setApiKeyModal(null);apiKeyModal.reject(new Error("Cancelado"));}}
      />}
      {/* HEADER */}
      <div style={{maxWidth:900,margin:"0 auto",paddingTop:22,paddingBottom:16,textAlign:"center"}}>
        <svg width="105" height="30" viewBox="0 0 140 40" fill="none"><rect width="140" height="40" rx="6" fill="rgba(255,255,255,0.15)"/><path d="M14 28L22 12L30 28H26L22 19L18 28H14Z" fill="white"/><text x="38" y="27" fontFamily="Plus Jakarta Sans,sans-serif" fontSize="18" fontWeight="800" fill="white" letterSpacing="1.5">MARIN</text></svg>
        <h1 style={{fontSize:21,fontWeight:800,color:"#fff",margin:"8px 0 3px"}}>Triagem Automática Pós-Vendas</h1>
        <p style={{color:"rgba(255,255,255,0.5)",fontSize:12,margin:0}}>Agentes de IA × Bitrix24</p>
      </div>

      {/* PIPELINE */}
      <div style={{maxWidth:900,margin:"0 auto 14px",overflowX:"auto",paddingBottom:4}}>
        <div style={{display:"flex",gap:3,minWidth:680}}>
          {STAGES.filter(s=>s.id!=="encerrado").map((s,i)=>{
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

        {/* ── FORM ── */}
        {step===0&&(
          <div style={{padding:"24px 28px"}}>
            {/* Upload row: NF + Evidências */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>

              {/* NF Upload */}
              <div style={{padding:14,border:`2px dashed ${nfFile?M.ok:formErrors.nfFile?M.err:M.brdL}`,borderRadius:12,background:nfFile?M.okS:formErrors.nfFile?M.errS:"#faf9f7",textAlign:"center",cursor:"pointer"}}
                onClick={()=>fRef.current?.click()}
                onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor=M.pri;}}
                onDragLeave={e=>{e.currentTarget.style.borderColor=nfFile?M.ok:M.brdL;}}
                onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f){const dt=new DataTransfer();dt.items.add(f);fRef.current.files=dt.files;onFile({target:{files:[f]}});}}}>
                <input ref={fRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" style={{display:"none"}} onChange={onFile}/>
                {nfFile?(<div><span style={{fontSize:20}}>✅</span><div style={{fontSize:12,fontWeight:700,color:M.ok,marginTop:3}}>{nfFile.name}</div><div style={{fontSize:9,color:M.txD}}>{(nfFile.size/1024).toFixed(0)}KB</div><div style={{fontSize:10,color:M.pri,marginTop:3,textDecoration:"underline"}}>Trocar</div></div>)
                :(<div><span style={{fontSize:20}}>📄</span><div style={{fontSize:12,fontWeight:700,marginTop:3}}>Nota Fiscal *</div><div style={{fontSize:10,color:M.txM,marginTop:2}}>JPG, PNG ou PDF · máx 10MB</div>{formErrors.nfFile&&<div style={{fontSize:10,color:M.err,marginTop:3}}>{formErrors.nfFile}</div>}</div>)}
              </div>

              {/* Evidence Upload */}
              <div style={{padding:14,border:`2px dashed ${evidenceFiles.length>0?M.blue:M.brdL}`,borderRadius:12,background:evidenceFiles.length>0?M.blueS:"#faf9f7",textAlign:"center",cursor:"pointer",position:"relative"}}
                onClick={()=>evRef.current?.click()}
                onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor=M.blue;}}
                onDragLeave={e=>{e.currentTarget.style.borderColor=evidenceFiles.length>0?M.blue:M.brdL;}}
                onDrop={e=>{e.preventDefault();onEvidenceFiles(e.dataTransfer.files);}}>
                <input ref={evRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/*" multiple style={{display:"none"}} onChange={e=>onEvidenceFiles(e.target.files)}/>
                {evidenceFiles.length>0?(
                  <div>
                    <span style={{fontSize:20}}>🖼️</span>
                    <div style={{fontSize:12,fontWeight:700,color:M.blue,marginTop:3}}>{evidenceFiles.length} arquivo{evidenceFiles.length>1?"s":""} anexado{evidenceFiles.length>1?"s":""}</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:4,justifyContent:"center",marginTop:6}}>
                      {evidenceFiles.map((f,i)=>(
                        <span key={i} style={{fontSize:9,background:"#fff",border:`1px solid ${M.blueB}`,borderRadius:4,padding:"2px 5px",color:M.blue,display:"flex",alignItems:"center",gap:3}}>
                          {f.mime.startsWith("video/")?"🎥":"📷"} {f.file.name.substring(0,12)}{f.file.name.length>12?"…":""}
                          <span onClick={ev=>{ev.stopPropagation();setEvidenceFiles(p=>p.filter((_,j)=>j!==i));}} style={{cursor:"pointer",color:M.err,fontWeight:700,marginLeft:2}}>×</span>
                        </span>
                      ))}
                    </div>
                    <div style={{fontSize:9,color:M.blue,marginTop:4,textDecoration:"underline"}}>Adicionar mais</div>
                  </div>
                ):(
                  <div><span style={{fontSize:20}}>📸</span><div style={{fontSize:12,fontWeight:700,marginTop:3}}>Fotos / Vídeos</div><div style={{fontSize:10,color:M.txM,marginTop:2}}>Opcional · até 6 arquivos · máx 20MB cada</div><div style={{fontSize:9,color:M.txD,marginTop:2}}>⚠️ Vídeos são armazenados mas a IA analisa apenas imagens</div></div>
                )}
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

            <button onClick={submit} style={{width:"100%",marginTop:22,padding:"13px",background:M.pri,color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",boxShadow:`0 4px 16px ${M.glow}`}} onMouseEnter={e=>e.target.style.background=M.priDk} onMouseLeave={e=>e.target.style.background=M.pri}>
              ⚡ Enviar para Triagem Automática
            </button>
          </div>
        )}

        {/* ── STEP 1: AGENTS WORKING ── */}
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
                    <div style={{fontSize:11,color:M.txM}}>{
                      a.status==="running"?a.desc:
                      a.status==="done"?"Concluído ✓":
                      a.status==="error"?"Erro — continuando...":
                      a.status==="skipped"?"Não necessário":
                      "Aguardando..."
                    }</div>
                  </div>
                  {a.status==="running"&&<div style={{width:16,height:16,border:`2px solid ${M.pri}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>}
                </div>
              ))}
            </div>

            <button onClick={()=>{cancelledRef.current=true;clearInterval(timerRef.current);setAgentStatus({triage:"error",doc:"error",evidence:"error"});const fb=triageDeterministic(form);fb.observacoes="Cancelado pelo usuário. Classificado por regras automáticas.";setTriageResult(fb);setStep(2);setAnimPhase(0);}} style={{marginTop:20,padding:"8px 20px",background:"transparent",color:M.txM,border:`1px solid ${M.brdN}`,borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Cancelar</button>
          </div>
        )}

        {/* ── STEP 2: RESULT ── */}
        {step===2&&triageResult&&(
          <div style={{padding:"24px 28px"}}>
            {triageResult.error?(
              <div style={{textAlign:"center",padding:"40px 20px"}}>
                <div style={{fontSize:36,marginBottom:12}}>⚠️</div>
                <h2 style={{margin:"0 0 8px",fontSize:18,fontWeight:700}}>Erro na Triagem</h2>
                <p style={{color:M.txM,fontSize:13}}>{triageResult.error}</p>
                <p style={{color:M.txM,fontSize:12,marginTop:8}}>O chamado será encaminhado para avaliação do responsável pelo Pós-Vendas.</p>
                <button onClick={reset} style={{marginTop:20,padding:"11px 24px",background:M.pri,color:"#fff",border:"none",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer"}}>← Novo Chamado</button>
              </div>
            ):(
              <>
                {/* DESTINATION */}
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

                {/* NOT ELIGIBLE */}
                {triageResult.elegivel_devolucao===false&&(
                  <div style={{opacity:animPhase>=2?1:0,transition:"all 0.5s",background:M.errS,border:`1.5px solid ${M.err}30`,borderRadius:10,padding:16,marginBottom:20}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><span style={{fontSize:16}}>🚫</span><span style={{fontSize:13,fontWeight:700,color:M.err}}>Não Elegível para Devolução</span></div>
                    <div style={{fontSize:13,lineHeight:1.5}}>{triageResult.motivo_inelegibilidade}</div>
                  </div>
                )}

                {/* ESCALATION */}
                {triageResult.escalacao_humana&&(
                  <div style={{opacity:animPhase>=2?1:0,transition:"all 0.5s",background:M.warnS,border:`1.5px solid ${M.warnB}`,borderRadius:10,padding:16,marginBottom:20}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><span style={{fontSize:16}}>👤</span><span style={{fontSize:13,fontWeight:700,color:M.warn}}>Escalado para Responsável Pós-Vendas</span></div>
                    <div style={{fontSize:13,lineHeight:1.5}}>{triageResult.motivo_escalacao||"Caso necessita de avaliação humana"}</div>
                  </div>
                )}

                {/* AUTO ACTIONS */}
                {triageResult.acoes_automaticas?.length>0&&(
                  <div style={{opacity:animPhase>=2?1:0,transition:"all 0.5s 0.1s",marginBottom:20}}>
                    <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:M.txM,marginBottom:8}}>Ações Realizadas pelo Agente</div>
                    {triageResult.acoes_automaticas.map((a,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 14px",background:i%2===0?M.okS:"#fff",border:`1px solid ${M.okB}`,borderRadius:8,marginBottom:3,fontSize:12}}>
                        <span style={{color:M.ok,fontWeight:700}}>✓</span><span>{a}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* DANFE */}
                {triageResult.precisa_espelho_nfd&&(
                  <div style={{opacity:animPhase>=3?1:0,transition:"all 0.5s",marginBottom:20}}>
                    <button onClick={()=>setShowDANFE(!showDANFE)} style={{width:"100%",padding:"12px",background:showDANFE?M.alt:M.pri,color:showDANFE?M.tx:"#fff",border:showDANFE?`1px solid ${M.brdN}`:"none",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",boxShadow:showDANFE?"none":`0 4px 16px ${M.glow}`}}>
                      {showDANFE?"Ocultar Espelho":"🧾 Ver Espelho DANFE (Gerado pelo Agente Documental)"}
                    </button>
                    {showDANFE&&(
                      nfData?<div style={{marginTop:12,borderRadius:10,overflow:"hidden",border:`1px solid ${M.brdN}`,boxShadow:"0 4px 20px rgba(0,0,0,0.06)"}}><DANFE nf={nfData} form={form}/></div>
                      :<div style={{marginTop:12,padding:20,background:M.errS,borderRadius:10,textAlign:"center",fontSize:13,color:M.err}}>{agentStatus.docErrorText || "Agente Documental não conseguiu extrair dados da NF."}</div>
                    )}
                  </div>
                )}

                {/* EVIDENCE RESULT */}
                {evidenceResult&&!evidenceResult.error&&(
                  <div style={{opacity:animPhase>=3?1:0,transition:"all 0.5s 0.15s",marginBottom:20,background:M.blueS,border:`1px solid ${M.blueB}`,borderRadius:10,padding:16}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                      <span style={{fontSize:16}}>🔍</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:700,color:M.blue}}>Análise de Evidências (IA)</div>
                        <div style={{fontSize:10,color:M.txM,marginTop:1}}>Estado: <b>{evidenceResult.estado_produto}</b> · Responsabilidade sugerida: <b>{evidenceResult.responsabilidade_sugerida}</b> · Confiança: <b>{evidenceResult.grau_confianca}</b></div>
                      </div>
                    </div>
                    <div style={{fontSize:12,lineHeight:1.6,marginBottom:evidenceResult.pontos_observados?.length?8:0}}>{evidenceResult.resumo_evidencias}</div>
                    {evidenceResult.pontos_observados?.length>0&&(
                      <div style={{display:"flex",flexDirection:"column",gap:3}}>
                        {evidenceResult.pontos_observados.map((p,i)=>(
                          <div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:11}}>
                            <span style={{color:M.blue,fontWeight:700}}>▸</span><span>{p}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {agentStatus.evidence==="error"&&(
                  <div style={{opacity:animPhase>=3?1:0,transition:"all 0.5s",marginBottom:20,background:M.errS,border:`1px solid ${M.err}30`,borderRadius:10,padding:14,fontSize:12,color:M.err}}>
                    <b>Evidências:</b> {agentStatus.evidenceErrorText||"Não foi possível analisar as imagens."}
                  </div>
                )}
                {agentStatus.evidence==="skipped"&&evidenceFiles.length>0&&(
                  <div style={{opacity:animPhase>=3?1:0,transition:"all 0.5s",marginBottom:20,background:"#faf9f7",border:`1px solid ${M.brdN}`,borderRadius:10,padding:14,fontSize:12,color:M.txM}}>
                    📹 Vídeos anexados registrados — análise por IA disponível apenas para imagens.
                  </div>
                )}

                {/* OBSERVATIONS */}
                {triageResult.observacoes&&(
                  <div style={{opacity:animPhase>=3?1:0,transition:"all 0.5s 0.1s",background:M.blueS,border:`1px solid ${M.blueB}`,borderRadius:10,padding:14,marginBottom:20}}>
                    <div style={{fontSize:11,fontWeight:700,color:M.blue,marginBottom:6}}>Observações do Agente</div>
                    <div style={{fontSize:12,lineHeight:1.5}}>{triageResult.observacoes}</div>
                  </div>
                )}

                {/* AGENT STATUS */}
                <div style={{opacity:animPhase>=4?1:0,transition:"all 0.5s",background:M.alt,borderRadius:10,padding:14,marginBottom:20,border:`1px solid ${M.brdN}`}}>
                  <div style={{fontSize:11,fontWeight:700,color:M.txM,marginBottom:8}}>Status dos Agentes</div>
                  <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                    {[{n:"Triagem",s:agentStatus.triage},{n:"Documental",s:agentStatus.doc},{n:"Evidências",s:agentStatus.evidence}].filter(a=>a.s!=="idle").map((a,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:11}}><AgentDot status={a.s}/><span style={{fontWeight:600}}>{a.n}:</span><span style={{color:M.txM}}>{a.s==="done"?"Concluído":a.s==="error"?"Erro":a.s==="skipped"?"Não necessário":"—"}</span></div>
                    ))}
                  </div>
                </div>

                <button onClick={reset} style={{width:"100%",padding:"13px",background:M.pri,color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",boxShadow:`0 4px 16px ${M.glow}`}}>← Novo Chamado</button>
              </>
            )}
          </div>
        )}
      </div>

      <div style={{maxWidth:900,margin:"14px auto 0",textAlign:"center",color:M.txD,fontSize:10}}>Triagem Automática Pós-Vendas Marin × Bitrix24 © {new Date().getFullYear()}</div>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box} select{appearance:auto} textarea{font-family:'Plus Jakarta Sans',sans-serif}
      `}</style>
    </div>
  );
}
