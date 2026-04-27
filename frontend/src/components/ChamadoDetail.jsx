import React, { useState, useEffect, useRef } from "react";
import { api } from "../api";
import ShareChamado from "./ShareChamado";
import DanfeMirror from "./DanfeMirror";

const M = {
  pri: "#9B1B30",
  bg: "#fafafa",
  tx: "#1a1a1a",
  txM: "#6b6560",
  brdN: "#e5e0db",
  err: "#dc2626",
  blue: "#2563eb",
  blueS: "rgba(37,99,235,0.08)",
  blueB: "rgba(37,99,235,0.2)",
};

const STATUS_COLOR = {
  novo: "#6b7280", negociacao: "#8b5cf6", 
  espelho: "#9B1B30", aguardando_nfd: "#2563eb", 
  aguardando_recolhimento: "#f59e0b", recolhido: "#059669", 
  aguardando_financeiro: "#16a34a", encerrado: "#6b7280",
};

const STATUSES = [
  { id: "novo", label: "Novo" },
  { id: "negociacao", label: "Negociação" },
  { id: "espelho", label: "Emitir Espelho NFD" },
  { id: "aguardando_nfd", label: "Aguard. NFD" },
  { id: "aguardando_recolhimento", label: "Aguard. Recolhimento" },
  { id: "recolhido", label: "Recolhido" },
  { id: "aguardando_financeiro", label: "Aguard. Financeiro" },
  { id: "encerrado", label: "Encerrado" },
];

function Badge({ label, color }) {
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, background: `${color}18`, border: `1px solid ${color}40`, color, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
      {label}
    </span>
  );
}

function AttachmentCard({ filename, label }) {
  if (!filename) return null;
  const url = api.fileUrl(filename);
  const ext = filename.split('.').pop().toLowerCase();
  
  const isImg = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
  const isVideo = ["mp4", "mov", "avi", "webm"].includes(ext);
  const isPdf = ext === "pdf";

  return (
    <div className="attachment-card" onClick={() => window.open(url, "_blank")}>
      <div className="attachment-preview">
        {isImg && <img src={url} alt={label} />}
        {isVideo && (
          <video muted preload="metadata">
            <source src={url} />
          </video>
        )}
        {isPdf && <div className="attachment-icon">📄</div>}
        {!isImg && !isVideo && !isPdf && <div className="attachment-icon">📎</div>}
      </div>
      <div className="attachment-info">
        <div className="attachment-label">{label}</div>
      </div>
    </div>
  );
}

export default function ChamadoDetail({ chamado, onClose, onStatusChange, onDelete }) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [newStatus, setNewStatus] = useState(chamado.status || "novo");
  const [localRessalva, setLocalRessalva] = useState(chamado.ressalva_vendedor || "");
  const [ressalvaFiles, setRessalvaFiles] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [chatFile, setChatFile] = useState(null);
  const messagesEndRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [savingRessalva, setSavingRessalva] = useState(false);
  const [history, setHistory] = useState([]);
  const [pendingRecolhimento, setPendingRecolhimento] = useState(false);
  const [recolhimentoData, setRecolhimentoData] = useState({
    tipo_frete: "proprio",
    nome_transportadora: "",
    valor_frete: "",
    despesas: "",
    observacoes: ""
  });

  // MENTIONS
  const [contacts, setContacts] = useState([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0); // Sobe a página ao abrir o detalhe
    loadMessages();
    loadContacts();
    if (isAdmin || isPosVendas) loadHistory();
  }, [chamado.id]);

  const loadHistory = async () => {
    try {
      const res = await api.getHistory(chamado.id);
      setHistory(res.history || []);
    } catch(e) {}
  };

  const loadContacts = async () => {
    try {
      const res = await api.getContacts();
      setContacts(res.contacts || []);
    } catch(e) {}
  };

  const loadMessages = async () => {
    try {
      const res = await api.getMessages(chamado.id);
      setMessages(res.messages || []);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch(e) { }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !chatFile) || saving) return;
    setSaving(true);
    try {
      const fd = new FormData();
      if (newMessage.trim()) fd.append("mensagem", newMessage);
      if (chatFile) fd.append("anexo", chatFile);

      const res = await api.sendMessage(chamado.id, fd);
      setMessages(p => [...p, res.message]);
      setNewMessage("");
      setChatFile(null);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      alert("Erro ao enviar mensagem.");
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setNewMessage(val);
    
    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    const words = textBeforeCursor.split(/\s/);
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith("@")) {
      setMentionFilter(lastWord.slice(1).toLowerCase());
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (userName) => {
    const cursor = inputRef.current.selectionStart || newMessage.length;
    const textBeforeCursor = newMessage.slice(0, cursor);
    const textAfterCursor = newMessage.slice(cursor);
    
    const words = textBeforeCursor.split(/\s/);
    words.pop(); 
    
    const newBefore = words.length > 0 ? words.join(" ") + ` @${userName} ` : `@${userName} `;
    
    setNewMessage(newBefore + textAfterCursor);
    setShowMentions(false);
    inputRef.current.focus();
  };

  const renderMessageText = (txt) => {
    return txt.split(/(@\w+)/g).map((part, i) => {
       if (part.startsWith("@")) return <span key={i} style={{ textDecoration: "underline", fontWeight: 800 }}>{part}</span>;
       return <span key={i}>{part}</span>;
    });
  };

  // Regras de Permissão
  const isAdmin = user.role === "admin";
  const isPosVendas = user.role === "pos_vendas";
  const isOperacional = user.role === "operacional";
  const isOwner = chamado.vendedor_id === user.id;
  const canEdit = isAdmin || isPosVendas || isOperacional;
  const canDelete = isAdmin;
  const canShare = isOwner || isAdmin;

  const save = async () => {
    if (isOperacional && newStatus === "recolhido" && chamado.status !== "recolhido") {
      setPendingRecolhimento(true);
      return;
    }
    await executeSave();
  };

  const executeSave = async (data = undefined) => {
    setSaving(true);
    try {
      await api.updateStatus(chamado.id, newStatus, data);
      if (onStatusChange) onStatusChange(chamado.id, newStatus);
      if (isAdmin || isPosVendas) loadHistory();
      alert("Status atualizado!");
      setPendingRecolhimento(false);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRecolhimentoSubmit = async (e) => {
    e.preventDefault();
    if (recolhimentoData.tipo_frete === "transportadora" && !recolhimentoData.nome_transportadora.trim()) {
      alert("Por favor, informe o nome da transportadora.");
      return;
    }
    await executeSave(recolhimentoData);
  };

  const handleSaveRessalva = async () => {
    setSavingRessalva(true);
    try {
      const fd = new FormData();
      fd.append("ressalva_vendedor", localRessalva);
      ressalvaFiles.forEach((file) => fd.append("ressalva_arquivos", file));
      
      await api.updateRessalva(chamado.id, fd);
      alert("Observação enviada com sucesso!");
      setRessalvaFiles([]);
    } catch (e) {
      alert(e.message);
    } finally {
      setSavingRessalva(false);
    }
  };

  return (
    <div className="modal-wrapper">
      <div className="modal-content" style={{ position: "relative" }}>
        
        {pendingRecolhimento && (
          <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"rgba(255,255,255,0.9)",display:"flex",justifyContent:"center",alignItems:"center",zIndex:999,borderRadius:12}}>
            <div style={{background:M.card || "#fff",padding:25,borderRadius:12,width:400,maxWidth:"90%",boxShadow:"0 10px 25px rgba(0,0,0,0.2)",border:`1px solid ${M.brdN}`}}>
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
                  <button type="button" onClick={() => setPendingRecolhimento(false)} style={{flex:1,padding:10,borderRadius:8,border:`1px solid ${M.brdL}`,background:M.bg,color:M.txM,fontWeight:700,cursor:"pointer"}}>
                    Cancelar
                  </button>
                  <button type="submit" style={{flex:1,padding:10,borderRadius:8,border:"none",background:M.ok || "#16a34a",color:"#fff",fontWeight:700,cursor:"pointer"}}>
                    Confirmar
                  </button>
                </div>

              </form>
            </div>
          </div>
        )}

        {/* HEADER */}
        <div style={{ padding: 20, borderBottom: `1px solid ${M.brdN}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Chamado #{chamado.id}</h2>
            <div style={{ fontSize: 11, color: M.txM }}>Criado em: {new Date(chamado.created_at).toLocaleString()}</div>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 24, cursor: "pointer" }}>×</button>
        </div>

        <div className="split-view">
          {/* LADO ESQUERDO: DETALHES DO CHAMADO */}
          <div className="split-left">
            <div style={{ marginBottom: 20 }}>
            <Badge label={chamado.status} color={STATUS_COLOR[chamado.status] || "#000"} />
            <h3 style={{ marginTop: 12, marginBottom: 4, fontSize: 20 }}>{chamado.razao_social}</h3>
            <p style={{ color: M.txM, fontSize: 13, margin: 0 }}>
              CNPJ: {chamado.cnpj} | Vendedor: <b>{chamado.vendedor_nome || chamado.nome_vendedor}</b>
            </p>
          </div>

          <div style={{ background: M.bg, padding: 20, borderRadius: 12, marginBottom: 20, border: `1px solid ${M.brdN}` }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: M.txM, textTransform: "uppercase", marginBottom: 8 }}>Descrição da Solicitação</div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: M.tx }}>{chamado.descricao}</p>
          </div>

          {/* LINHA DO TEMPO (HISTÓRICO) - Apenas Admin e Pos-Vendas */}
          {(isAdmin || isPosVendas) && history.length > 0 && (
            <div style={{ marginBottom: 25, padding: "0 10px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: M.txM, textTransform: "uppercase", marginBottom: 15, display: "flex", alignItems: "center", gap: 6 }}>
                🕒 Histórico de Movimentação
              </div>
              <div style={{ borderLeft: `2px solid ${M.brdN}`, marginLeft: 8, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 18 }}>
                {history.map((h, i) => (
                  <div key={h.id} style={{ position: "relative" }}>
                    <div style={{ position: "absolute", left: -27, top: 4, width: 12, height: 12, borderRadius: "50%", background: i === 0 ? M.pri : M.brdL, border: `2px solid #fff`, boxShadow: "0 0 0 2px #fff" }} />
                    <div style={{ fontSize: 13, fontWeight: 700, color: M.tx }}>
                      {h.user_name} <span style={{ fontWeight: 400, color: M.txM }}>moveu para</span> {STATUSES.find(s => s.id === h.status_novo)?.label || h.status_novo}
                    </div>
                    <div style={{ fontSize: 11, color: M.txD, marginTop: 2 }}>
                      {new Date(h.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DADOS DO RECOLHIMENTO SE EXISTIR */}
          {chamado.recolhimento_data && (
            <div style={{ background: "#f8f9fa", padding: 20, borderRadius: 12, marginBottom: 20, border: `1px solid ${M.brdN}` }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: M.txM, textTransform: "uppercase", marginBottom: 12 }}>🚚 Detalhes do Recolhimento</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13, color: M.tx }}>
                <div><b>Tipo de Frete:</b> {chamado.recolhimento_data.tipo_frete === "transportadora" ? "Transportadora" : "Frete Próprio"}</div>
                {chamado.recolhimento_data.tipo_frete === "transportadora" && <div><b>Transportadora:</b> {chamado.recolhimento_data.nome_transportadora}</div>}
                {chamado.recolhimento_data.valor_frete && <div><b>Valor do Frete:</b> R$ {Number(chamado.recolhimento_data.valor_frete).toFixed(2).replace('.', ',')}</div>}
                {chamado.recolhimento_data.despesas && <div><b>Despesas Extras:</b> R$ {Number(chamado.recolhimento_data.despesas).toFixed(2).replace('.', ',')}</div>}
                {chamado.recolhimento_data.observacoes && <div style={{ gridColumn: "1 / -1", marginTop: 5 }}><b>Observações:</b> {chamado.recolhimento_data.observacoes}</div>}
              </div>
            </div>
          )}

          {/* RESSALVA EDITÁVEL PARA O VENDEDOR OU VISÍVEL PARA ADMIN */}
          {isOwner ? (
            <div style={{ marginBottom: 20, padding: 20, background: M.blueS, borderRadius: 12, border: `1px solid ${M.blueB}` }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: M.blue, textTransform: "uppercase", marginBottom: 8 }}>📝 Sua Ressalva / Observação Extra</label>
              <textarea 
                value={localRessalva} 
                onChange={e => setLocalRessalva(e.target.value)}
                placeholder="Adicione informações extras aqui..."
                style={{ width: "100%", padding: 12, borderRadius: 10, border: `1px solid ${M.brdN}`, minHeight: 80, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 10 }}
              />
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: M.blue, marginBottom: 5 }}>ANEXAR ARQUIVOS (Até 3)</label>
                <input 
                  type="file" 
                  multiple 
                  accept="image/*,application/pdf,video/*"
                  onChange={e => setRessalvaFiles(Array.from(e.target.files).slice(0, 3))}
                  style={{ fontSize: 12 }}
                />
                {ressalvaFiles.length > 0 && <div style={{ fontSize: 11, color: M.txM, marginTop: 4 }}>{ressalvaFiles.length} arquivo(s) selecionado(s)</div>}
              </div>
              <button 
                onClick={handleSaveRessalva} 
                disabled={savingRessalva}
                style={{ padding: "8px 16px", background: M.blue, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                {savingRessalva ? "Salvando..." : "Salvar Observação"}
              </button>
              {chamado.ressalva_arquivos && chamado.ressalva_arquivos.length > 0 && (
                <div style={{ marginTop: 15, paddingTop: 15, borderTop: `1px solid ${M.brdN}` }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: M.txM }}>ARQUIVOS ANEXADOS:</span>
                  <div style={{ display: "flex", gap: 10, marginTop: 5, flexWrap: "wrap" }}>
                    {chamado.ressalva_arquivos.map((file, i) => (
                      <a key={i} href={api.fileUrl(file)} target="_blank" rel="noreferrer" style={{ fontSize: 10, display: "inline-block", padding: "4px 8px", background: "#fff", border: `1px solid ${M.brdN}`, borderRadius: 4, textDecoration: "none", color: M.blue }}>
                        📄 {file.slice(0, 15)}...
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (chamado.ressalva_vendedor || (chamado.ressalva_arquivos && chamado.ressalva_arquivos.length > 0)) ? (
            <div style={{ marginBottom: 20, padding: 20, background: M.blueS, borderRadius: 12, border: `1px solid ${M.blueB}` }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: M.blue, textTransform: "uppercase", marginBottom: 8 }}>💬 Ressalva do Vendedor</div>
              {chamado.ressalva_vendedor && <div style={{ fontSize: 13, lineHeight: 1.6, color: M.tx, marginBottom: 10 }}>{chamado.ressalva_vendedor}</div>}
              {chamado.ressalva_arquivos && chamado.ressalva_arquivos.length > 0 && (
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: M.txM }}>ARQUIVOS ANEXADOS:</span>
                  <div style={{ display: "flex", gap: 10, marginTop: 5, flexWrap: "wrap" }}>
                    {chamado.ressalva_arquivos.map((file, i) => (
                      <a key={i} href={api.fileUrl(file)} target="_blank" rel="noreferrer" style={{ fontSize: 10, display: "inline-block", padding: "4px 8px", background: "#fff", border: `1px solid ${M.brdN}`, borderRadius: 4, textDecoration: "none", color: M.blue }}>
                        📄 {file.slice(0, 15)}...
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* GALERIA DE ANEXOS ORIGINAIS (CONSOLIDADA) */}
          {(() => {
            const hasNF = !!chamado.nf_file_path;
            const hasEvidence = chamado.evidence_paths && chamado.evidence_paths.length > 0;
            const hasRessalva = chamado.ressalva_arquivos && chamado.ressalva_arquivos.length > 0;

            if (!hasNF && !hasEvidence && !hasRessalva) return null;

            return (
              <div className="attachment-gallery">
                <div style={{ fontSize: 11, fontWeight: 800, color: M.txM, textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  📁 Documentos e Evidências
                </div>
                <div className="attachment-grid">
                  {hasNF && (
                    <AttachmentCard filename={chamado.nf_file_path} label="Nota Fiscal Original" />
                  )}
                  {hasEvidence && chamado.evidence_paths.map((p, i) => (
                    <AttachmentCard key={`ev-${i}`} filename={p} label={`Evidência ${i + 1}`} />
                  ))}
                  {hasRessalva && chamado.ressalva_arquivos.map((p, i) => (
                    <AttachmentCard key={`res-${i}`} filename={p} label={`Anexo Extra ${i + 1}`} />
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ESPELHO DA NFD (CONDICIONAL) */}
          {(() => {
            // Regra: Só mostra o espelho se a triagem disser que precisa (ex: devolução) 
            // OU se o status atual for de uma etapa que exige o espelho.
            const triageNeedsMirror = chamado.triage_result?.precisa_espelho_nfd === true;
            const statusStageRequiresMirror = ["espelho", "aguardando_nfd", "aguardando_recolhimento", "aguardando_financeiro"].includes(chamado.status);
            
            // Caso especial: mesmo se a triagem disse que não, se o Admin preencheu dados manualmente, 
            // e mudou o status para um que requer espelho, ele deve ver.
            // Mas para "Preço Errado" (onde triageNeedsMirror é false e o status não é de espelho), ele some.
            const showMirror = canEdit && (triageNeedsMirror || statusStageRequiresMirror);
            
            if (!showMirror) return null;
            
            return <DanfeMirror nf={chamado.nf_data} chamado={chamado} />;
          })()}

          {/* ÁREA DE COMPARTILHAMENTO */}
          {canShare && (
            <div style={{ borderTop: `1px solid ${M.brdN}`, paddingTop: 15, marginBottom: 20 }}>
              <ShareChamado chamadoId={chamado.id} />
            </div>
          )}

          {/* ÁREA DE EDIÇÃO (APENAS ADMIN/POS-VENDAS) */}
          {canEdit ? (
            <div style={{ borderTop: `1px solid ${M.brdN}`, paddingTop: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 800, marginBottom: 10 }}>ALTERAR TRIAGEM (ETAPA):</label>
              <div style={{ display: "flex", gap: 10 }}>
                <select 
                  value={newStatus} 
                  onChange={e => setNewStatus(e.target.value)} 
                  style={{ flex: 1, padding: "12px", borderRadius: 8, border: `1px solid ${M.brdN}`, fontSize: 14 }}
                >
                  {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <button 
                  onClick={save} 
                  disabled={saving} 
                  style={{ padding: "0 25px", background: M.pri, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
                >
                  {saving ? "Salvando..." : "Atualizar"}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ borderTop: `1px solid ${M.brdN}`, paddingTop: 15, fontSize: 12, color: M.txM, fontStyle: "italic" }}>
              * Você está em modo de visualização. Apenas o Admin ou Pós-Vendas podem alterar este chamado.
            </div>
          )}

            {canDelete && (
              <button 
                className="no-print"
                onClick={() => { if(window.confirm("Tem certeza que deseja excluir?")) onDelete(chamado.id); }} 
                style={{ marginTop: 30, width: "100%", padding: 12, background: "transparent", color: M.err, border: `1px solid ${M.err}`, borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}
              >
                🗑️ Excluir Chamado Permanentemente
              </button>
            )}
          </div> {/* FIM DO LADO ESQUERDO */}

          {/* LADO DIREITO: CHAT INTERNO */}
          <div className="split-right">
            <div style={{ padding: 15, borderBottom: `1px solid ${M.brdN}`, fontWeight: 800, color: M.tx, fontSize: 14 }}>
              💬 Chat Interno
            </div>
            
            <div style={{ flex: 1, padding: 15, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
              {messages.length === 0 && <p style={{ fontSize: 12, color: M.txM, textAlign: "center", marginTop: 20, fontStyle: "italic" }}>Nenhuma mensagem ainda.</p>}
              {messages.map(m => {
                const isMe = m.user_id === user.id;
                return (
                  <div key={m.id} style={{ alignSelf: isMe ? "flex-end" : "flex-start", maxWidth: "85%" }}>
                    <div style={{ fontSize: 9, color: M.txM, marginBottom: 2, textAlign: isMe ? "right" : "left", fontWeight: 700 }}>
                      {m.user_name} <span style={{ fontWeight: 400 }}>({m.user_role})</span>
                    </div>
                    <div 
                      className={`chat-bubble ${isMe ? "" : "left"}`}
                      style={{
                      background: isMe ? M.pri : "#fff",
                      color: isMe ? "#fff" : M.tx,
                      padding: "10px 14px",
                      borderRadius: 14,
                      border: isMe ? "none" : `1px solid ${M.brdN}`,
                      fontSize: 13,
                      lineHeight: 1.5,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.04)"
                    }}>
                      {m.mensagem && <div>{renderMessageText(m.mensagem)}</div>}
                      {m.anexo && (
                        <div style={{ marginTop: m.mensagem ? 8 : 0 }}>
                          <a href={api.fileUrl(m.anexo)} target="_blank" rel="noreferrer" style={{ display: "inline-block", background: isMe ? M.priDk : M.bg, color: isMe ? "#fff" : M.tx, padding: "6px 10px", borderRadius: 8, textDecoration: "none", fontSize: 11, border: `1px solid ${isMe ? M.pri : M.brdN}` }}>
                            📎 Ver Anexo
                          </a>
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 8, color: M.txD, marginTop: 4, textAlign: isMe ? "right" : "left" }}>
                       {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div style={{ padding: 15, borderTop: `1px solid ${M.brdN}`, background: "#fff", display: "flex", flexDirection: "column", gap: 10, position: "relative" }}>
              
              {showMentions && contacts.length > 0 && (
                <div style={{ position: "absolute", bottom: "100%", left: 15, right: 15, background: "#fff", border: `1px solid ${M.brdN}`, borderRadius: 10, boxShadow: "0 -4px 15px rgba(0,0,0,0.08)", maxHeight: 180, overflowY: "auto", zIndex: 100, marginBottom: 5 }}>
                  {contacts.filter(c => c.name.toLowerCase().includes(mentionFilter) || c.role.toLowerCase().includes(mentionFilter)).map(c => (
                    <div 
                      key={c.id} 
                      onClick={() => insertMention(c.name)}
                      style={{ padding: "8px 12px", cursor: "pointer", borderBottom: `1px solid ${M.alt}`, display: "flex", alignItems: "center", gap: 10 }}
                      onMouseEnter={e => e.currentTarget.style.background = M.bg}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                       <div style={{ width: 26, height: 26, borderRadius: "50%", background: M.pri, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>
                         {c.name.charAt(0).toUpperCase()}
                       </div>
                       <div style={{ fontSize: 12 }}>
                         <div style={{ fontWeight: 800, color: M.tx }}>{c.name}</div>
                         <div style={{ fontSize: 10, color: M.txM, textTransform: "uppercase", letterSpacing: 0.5 }}>{c.role}</div>
                       </div>
                    </div>
                  ))}
                  {contacts.filter(c => c.name.toLowerCase().includes(mentionFilter)).length === 0 && (
                    <div style={{ padding: "10px 12px", fontSize: 11, color: M.txM, textAlign: "center" }}>Nenhum usuário encontrado.</div>
                  )}
                </div>
              )}

              {chatFile && (
                <div style={{ fontSize: 11, color: M.blue, background: M.blueS, padding: "6px 10px", borderRadius: 6, display: "flex", justifyContent: "space-between" }}>
                  <span>📎 {chatFile.name} (Pronto para enviar)</span>
                  <button onClick={() => setChatFile(null)} style={{ border: "none", background: "none", color: M.err, cursor: "pointer", fontWeight: 700 }}>X</button>
                </div>
              )}
              <form onSubmit={handleSendMessage} style={{ display: "flex", gap: 8 }}>
                <label style={{ display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: M.alt, padding: "0 10px", borderRadius: 10, border: `1px solid ${M.brdN}` }}>
                  <input type="file" style={{ display: "none" }} onChange={e => setChatFile(e.target.files[0])} />
                  📎
                </label>
                <input 
                   ref={inputRef}
                   placeholder="Ex: @NomeUsuario..." 
                   style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `1px solid ${M.brdN}`, fontSize: 13, outline: "none", transition: "border 0.2s" }} 
                   onFocus={e => e.target.style.borderColor = M.pri}
                   onBlur={e => { e.target.style.borderColor = M.brdN; setTimeout(() => setShowMentions(false), 200); }}
                   value={newMessage} 
                   onChange={handleInputChange} 
                />
                <button type="submit" disabled={saving || (!newMessage.trim() && !chatFile)} style={{ background: M.pri, color: "#fff", border: "none", borderRadius: 10, padding: "0 15px", fontWeight: 700, cursor: "pointer", opacity: ((!newMessage.trim() && !chatFile) || saving) ? 0.5 : 1 }}>
                   Enviar
                </button>
              </form>
            </div>
          </div> {/* FIM DO LADO DIREITO */}
        </div>
      </div>
    </div>
  );
}
