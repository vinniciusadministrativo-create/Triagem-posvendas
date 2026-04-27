import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../api";
import ChamadoDetail from "../components/ChamadoDetail";

const M = {
  pri: "#9B1B30", priDk: "#7A1526", priLt: "#B82840", priDeep: "#5E1220",
  glow: "rgba(155,27,48,0.30)", soft: "rgba(155,27,48,0.07)", brd: "rgba(155,27,48,0.25)",
  bg: "#fafafa", card: "#fff", alt: "#f5f3f0", brdN: "#e5e0db", brdL: "#d5cfc8",
  tx: "#1a1a1a", txM: "#374151", txD: "#4b5563",
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

function VInput({ label, value, onChange, placeholder, maxLength, type = "text", pattern, required = true, error, readOnly = false }) {
  const [touched, setTouched] = useState(false);
  const showErr = touched && error;
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: showErr ? M.err : M.txM, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
        {label}<span style={{ color: M.pri, fontSize: 8 }}>*</span>
        {maxLength && <span style={{ fontWeight: 400, fontSize: 9, color: M.txD, marginLeft: "auto" }}>{value.length}/{maxLength}</span>}
      </label>
      <input type={type} value={value} placeholder={placeholder} maxLength={maxLength} required={required} readOnly={readOnly}
        style={{ width: "100%", padding: "10px 12px", border: `1px solid ${showErr ? M.err : M.brdN}`, borderRadius: 8, fontSize: 13, background: readOnly ? M.alt : (showErr ? M.errS : "#fff"), color: readOnly ? M.txM : M.tx, outline: "none", transition: "all 0.2s", boxSizing: "border-box", cursor: readOnly ? "not-allowed" : "text" }}
        onFocus={e => { if (!readOnly) { e.target.style.borderColor = M.pri; e.target.style.boxShadow = `0 0 0 3px ${M.soft}`; } }}
        onBlur={e => { setTouched(true); e.target.style.borderColor = showErr ? M.err : M.brdN; e.target.style.boxShadow = "none"; }}
        onChange={e => { let v = e.target.value; if (pattern === "numeric") v = v.replace(/\D/g, ""); onChange(v); }}
      />
      {showErr && <div style={{ fontSize: 10, color: M.err, marginTop: 3 }}>{error}</div>}
    </div>
  );
}

export default function VendedorPage({ defaultTab = "novo" }) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ codigo: "", razaoSocial: "", cnpj: "", responsavel: "", nomeVendedor: user.name || "", telefone: "", emailVendedor: user.email || "", tipoSolicitacao: "", descricao: "", nfOriginal: "" });
  const [nfFile, setNfFile] = useState(null); const [nfB64, setNfB64] = useState(null); const [nfMime, setNfMime] = useState(null);
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [nfData, setNfData] = useState(null); const [evidenceResult, setEvidenceResult] = useState(null);
  const [triageResult, setTriageResult] = useState(null);
  const [ressalvaVendedor, setRessalvaVendedor] = useState("");
  const [agentStatus, setAgentStatus] = useState({ triage: "idle", doc: "idle", evidence: "idle" });
  const [animPhase, setAnimPhase] = useState(0);
  const [formErrors, setFormErrors] = useState({});
  const [elapsed, setElapsed] = useState(0);
  const [savedId, setSavedId] = useState(null);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [meusChamados, setMeusChamados] = useState([]);
  const [loadingChamados, setLoadingChamados] = useState(false);
  const [selected, setSelected] = useState(null);

  const fRef = useRef(null); const evRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

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

  useEffect(() => { if (step === 2 && animPhase < 5) { const t = setTimeout(() => setAnimPhase(p => p + 1), 350); return () => clearTimeout(t); } }, [step, animPhase]);

  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const maskPhone = (val) => {
    if (!val) return "";
    let v = val.toString().replace(/\D/g, '');
    if (v.length === 0) return "";
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 10) return v.replace(/^(\d\d)(\d{5})(\d{4}).*/, '($1) $2-$3');
    if (v.length > 5) return v.replace(/^(\d\d)(\d{4})(\d{0,4}).*/, '($1) $2-$3');
    if (v.length > 2) return v.replace(/^(\d\d)(\d{0,5})/, '($1) $2');
    return v;
  };

  const maskCpfCnpj = (val) => {
    if (!val) return "";
    let v = val.toString().replace(/\D/g, '');
    if (v.length === 0) return "";
    if (v.length <= 11) {
      v = v.replace(/(\d{3})(\d)/, '$1.$2');
      v = v.replace(/(\d{3})(\d)/, '$1.$2');
      v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      return v;
    } else {
      v = v.slice(0, 14);
      v = v.replace(/^(\d{2})(\d)/, '$1.$2');
      v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
      v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
      v = v.replace(/(\d{4})(\d)/, '$1-$2');
      return v;
    }
  };

  const validate = () => {
    const e = {};
    if (!form.codigo) e.codigo = "Obrigatório";
    if (!form.razaoSocial || form.razaoSocial.length < 3) e.razaoSocial = "Mín. 3 caracteres";
    
    const plainCnpj = form.cnpj ? form.cnpj.replace(/\D/g, '') : '';
    if (!plainCnpj || !(plainCnpj.length === 11 || plainCnpj.length === 14)) e.cnpj = "CPF (11) ou CNPJ (14 dígitos)";
    
    if (!form.tipoSolicitacao) e.tipoSolicitacao = "Selecione";
    if (!form.nfOriginal) e.nfOriginal = "Obrigatório";
    if (!form.descricao || form.descricao.length < 20) e.descricao = "Mín. 20 caracteres";
    if (!nfFile) e.nfFile = "Anexe a Nota Fiscal";
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const onFile = useCallback(async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setNfFile(file);
    const reader = new FileReader();
    reader.onload = () => { setNfB64(reader.result.split(",")[1]); setNfMime(file.type); };
    reader.readAsDataURL(file);
  }, []);

  const onEvidenceFiles = useCallback(async (newFiles) => {
    const added = [];
    for (const file of Array.from(newFiles)) {
      await new Promise(resolve => {
        const r = new FileReader();
        r.onload = () => { added.push({ file, b64: r.result.split(",")[1], mime: file.type }); resolve(); };
        r.readAsDataURL(file);
      });
    }
    setEvidenceFiles(p => [...p, ...added].slice(0, 3));
  }, []);

  const submit = async () => {
    if (!validate()) return;
    setStep(1); setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);

    const isTest = false;

    try {
      // 1. Triagem
      setAgentStatus({ triage: "running", doc: "waiting", evidence: "waiting" });
      const triageRes = await api.triage(form, isTest);
      setTriageResult(triageRes);
      setAgentStatus(p => ({ ...p, triage: "done" }));

      // 2. Documentação
      let docRes = null;
      if (triageRes.precisa_espelho_nfd && nfB64) {
        setAgentStatus(p => ({ ...p, doc: "running" }));
        docRes = await api.extractNF(nfB64, nfMime, isTest, form);
        if (docRes && !docRes.error) setNfData(docRes);
        setAgentStatus(p => ({ ...p, doc: "done" }));
      } else {
        setAgentStatus(p => ({ ...p, doc: "skipped" }));
      }

      // 3. Evidências
      let evRes = null;
      if (evidenceFiles.length > 0) {
        setAgentStatus(p => ({ ...p, evidence: "running" }));
        const imgs = evidenceFiles.map(f => ({ b64: f.b64, mime: f.mime }));
        evRes = await api.analyzeEvidence(imgs, isTest);
        if (evRes && !evRes.error) setEvidenceResult(evRes);
        setAgentStatus(p => ({ ...p, evidence: "done" }));
      } else {
        setAgentStatus(p => ({ ...p, evidence: "idle" }));
      }

      // 4. Salvar Chamado
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append("triage_result", JSON.stringify(triageRes));
      if (docRes) fd.append("nf_data", JSON.stringify(docRes));
      if (evRes) fd.append("evidence_result", JSON.stringify(evRes));
      if (nfFile) fd.append("nf_file", nfFile);
      if (ressalvaVendedor) fd.append("ressalva_vendedor", ressalvaVendedor);
      evidenceFiles.forEach(f => fd.append("evidence_files", f.file));

      const saved = await api.createChamado(fd);
      setSavedId(saved.chamado?.id);
      setStep(2);
    } catch (e) {
      console.error(e);
      setStep(0);
      alert("Erro ao processar chamado.");
    } finally {
      clearInterval(timerRef.current);
    }
  };

  const reset = () => {
    setStep(0); setForm({ codigo: "", razaoSocial: "", cnpj: "", responsavel: "", nomeVendedor: user.name || "", telefone: "", emailVendedor: user.email || "", tipoSolicitacao: "", descricao: "", nfOriginal: "" });
    setNfFile(null); setNfB64(null); setEvidenceFiles([]); setNfData(null); setTriageResult(null); setSavedId(null); setRessalvaVendedor("");
  };

  const targetStage = triageResult ? STAGES.find(s => s.id === triageResult.etapa_destino) : null;
  const AgentDot = ({ status }) => {
    const colors = { idle: M.txD, waiting: "#94a3b8", running: M.warn, done: M.ok, error: M.err, skipped: M.txD };
    return <span style={{ width: 8, height: 8, borderRadius: "50%", background: colors[status] || M.txD, display: "inline-block", animation: status === "running" ? "pulse 1s infinite" : "none" }} />;
  };

  return (
    <div className="page-container">
      {selected && <ChamadoDetail chamado={selected} onClose={() => setSelected(null)} onStatusChange={loadChamados} onDelete={() => { /* Admin only handled inside */ }} />}

      {/* HEADER */}
      <div style={{ maxWidth: 900, margin: "0 auto", marginBottom: 30 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: M.tx }}>{activeTab === "meus" ? "Lista de Chamados Pessoais" : "Nova Solicitação de Pós-Vendas"}</h1>
        <p style={{ color: M.txM }}>{activeTab === "meus" ? "Acompanhe o status dos chamados criados por você ou compartilhados com seu perfil." : "Preencha os dados e anexe a NF para triagem automática."}</p>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", background: "#fff", padding: activeTab === "meus" ? 0 : 30, borderRadius: 14, border: `1px solid ${M.brdN}`, overflow: "hidden" }}>
        {activeTab === "meus" ? (
          <div style={{ padding: 10 }}>
            {loadingChamados ? <p style={{ textAlign: "center", padding: 40 }}>Carregando...</p> : minhasFiles()}
          </div>
        ) : (
          renderForm()
        )}
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  );

  function minhasFiles() {
    if (meusChamados.length === 0) return <p style={{ textAlign: "center", padding: 40 }}>Nenhum chamado encontrado.</p>;
    return meusChamados.map(c => (
      <div key={c.id} onClick={() => setSelected(c)} style={{ padding: 15, borderBottom: `1px solid ${M.brdN}`, display: "flex", justifyContent: "space-between", cursor: "pointer", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = M.bg} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
        <div>
          <div style={{ fontWeight: 700 }}>{c.razao_social}</div>
          <div style={{ fontSize: 12, color: M.txM }}>NF {c.nf_original} | #{c.id}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {c.vendedor_id !== user.id && <span style={{ fontSize: 9, fontWeight: 800, background: M.blueS, color: M.blue, padding: "3px 8px", borderRadius: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Compartilhado</span>}
          {c.mensagens_count > 0 && <span title="Mensagens do Chat" style={{ fontSize: 11, fontWeight: 800, background: M.blueS, color: M.blue, padding: "3px 8px", borderRadius: 10 }}>💬 {c.mensagens_count}</span>}
          <span style={{ 
            fontSize: 10,  
            fontWeight: 800, 
            color: M.pri, 
            background: M.soft, 
            padding: "4px 12px", 
            borderRadius: 20, 
            border: `1px solid ${M.brd}`,
            letterSpacing: 0.8,
            boxShadow: "0 2px 4px rgba(155,27,48,0.05)"
          }}>
            {c.status?.toUpperCase()}
          </span>
        </div>
      </div>
    ));
  }

  function renderForm() {
    if (step === 0) return (
      <div className="responsive-grid">
        <div className="responsive-grid-left">
          <div onClick={() => fRef.current.click()} style={{ padding: 20, border: `2px dashed ${nfFile ? M.ok : M.brdN}`, borderRadius: 12, textAlign: "center", cursor: "pointer", background: nfFile ? M.okS : M.bg }}>
            <input ref={fRef} type="file" style={{ display: "none"}} onChange={onFile} />
            {nfFile ? <p>✅ {nfFile.name}</p> : <p>📄 Anexar Nota Fiscal *</p>}
          </div>
          <div onClick={() => evRef.current.click()} style={{ padding: 20, border: `2px dashed ${evidenceFiles.length ? M.blue : M.brdN}`, borderRadius: 12, textAlign: "center", cursor: "pointer", background: evidenceFiles.length ? M.blueS : M.bg }}>
            <input ref={evRef} type="file" multiple style={{ display: "none" }} onChange={e => onEvidenceFiles(e.target.files)} />
            {evidenceFiles.length ? <p>📸 {evidenceFiles.length} fotos anexadas</p> : <p>📸 Fotos de Evidência</p>}
          </div>
        </div>
        <VInput label="Código do Cliente" placeholder="Ex: 12345" value={form.codigo} onChange={v => upd("codigo", v)} />
        <VInput 
          label="Nome do Vendedor / Responsável" 
          value={form.nomeVendedor} 
          onChange={v => upd("nomeVendedor", v)} 
          readOnly={user.role !== "vendedor"}
        />
        <VInput 
          label="Telefone de Contato" 
          placeholder="(11) 99999-9999"
          value={form.telefone} 
          onChange={v => upd("telefone", maskPhone(v))} 
        />
        <VInput 
          label="E-mail para Retorno" 
          type="email"
          value={form.emailVendedor} 
          onChange={v => upd("emailVendedor", v)} 
          readOnly={user.role !== "vendedor"}
        />
        <VInput 
          label="CNPJ / CPF do Cliente" 
          placeholder="00.000.000/0000-00 ou 000.000.000-00"
          value={form.cnpj} 
          onChange={v => upd("cnpj", maskCpfCnpj(v))} 
        />
        <VInput label="NF Original" value={form.nfOriginal} onChange={v => upd("nfOriginal", v)} />
        <div className="responsive-grid-full"><VInput label="Razão Social" value={form.razaoSocial} onChange={v => upd("razaoSocial", v)} /></div>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 5 }}>Tipo</label>
          <select value={form.tipoSolicitacao} onChange={e => upd("tipoSolicitacao", e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: `1px solid ${M.brdN}` }}>
            <option value="">Selecione...</option>
            {TIPOS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div className="responsive-grid-full">
          <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 5 }}>Descrição</label>
          <textarea value={form.descricao} onChange={e => upd("descricao", e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: `1px solid ${M.brdN}`, minHeight: 100 }} />
        </div>
        <button onClick={submit} className="responsive-grid-full" style={{ padding: 15, background: M.pri, color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, cursor: "pointer" }}>⚡ Enviar Chamado</button>
      </div>
    );
    if (step === 1) return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <h2>🤖 Processando Triagem Automática...</h2>
        <p>{elapsed}s</p>
        <div style={{ maxWidth: 300, margin: "0 auto", textAlign: "left", marginTop: 20 }}>
          <div style={{ marginBottom: 10 }}><AgentDot status={agentStatus.triage} /> Classificando Solicitação</div>
          <div style={{ marginBottom: 10 }}><AgentDot status={agentStatus.doc} /> Analisando Documentos</div>
          <div style={{ marginBottom: 10 }}><AgentDot status={agentStatus.evidence} /> Verificando Evidências</div>
        </div>
      </div>
    );
    return (
      <div>
        <div style={{ background: M.okS, padding: 20, borderRadius: 12, border: `1px solid ${M.okB}`, marginBottom: 20 }}>
          <h3 style={{ color: M.ok }}>Triagem Concluída</h3>
          <p style={{ fontSize: 18, fontWeight: 800 }}>{targetStage?.label}</p>
          <p>{triageResult.resumo}</p>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 800, color: M.txM, display: "block", marginBottom: 8 }}>Deseja adicionar alguma ressalva ou observação para o Pós-Vendas?</label>
          <textarea value={ressalvaVendedor} onChange={e => setRessalvaVendedor(e.target.value)} placeholder="Ex: Cliente tem pressa, produto está na caixa original..." style={{ width: "100%", padding: 12, borderRadius: 10, border: `1px solid ${M.brdN}`, minHeight: 80, fontFamily: "inherit", fontSize: 13, boxSizing: "border-box" }} />
        </div>
        <div style={{ background: M.soft, padding: 15, borderRadius: 10, marginBottom: 20, border: `1px solid ${M.brd}` }}>
          <p style={{ margin: 0, fontSize: 12, color: M.priDk, fontWeight: 700 }}>✓ Chamado #{savedId} registrado com sucesso.</p>
        </div>
        <button onClick={reset} style={{ width: "100%", padding: 15, background: M.pri, color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, cursor: "pointer" }}>← Novo Chamado</button>
      </div>
    );
  }
}
