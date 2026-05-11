import React, { useState, useEffect, useRef, useCallback } from "react";

const API = "/api/chat";
const token = () => localStorage.getItem("token");
const me = () => { try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; } };
const headers = () => ({ Authorization: `Bearer ${token()}`, "Content-Type": "application/json" });

const M = {
  pri: "#9B1B30", priLight: "rgba(155,27,48,0.08)", priDk: "#7A1526",
  bg: "#f5f5f7", card: "#ffffff", tx: "#1a1a1a", txM: "#6b6560",
  brdN: "#e5e0db", ok: "#16a34a", sent: "#9B1B30", recv: "#f0eeec",
};

const ROLE_LABELS = {
  admin: "Administrador", pos_vendas: "Pós-Vendas",
  vendedor: "Vendedor", operacional: "Operacional",
};

function Avatar({ name, size = 38 }) {
  const initials = name?.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  const hue = name ? [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360 : 0;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `hsl(${hue}, 55%, 45%)`,
      color: "#fff", fontWeight: 800, fontSize: size * 0.36,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, userSelect: "none",
    }}>{initials}</div>
  );
}

function Badge({ count }) {
  if (!count) return null;
  return (
    <span style={{
      background: "#dc2626", color: "#fff", fontSize: 10, fontWeight: 800,
      borderRadius: 10, padding: "2px 6px", minWidth: 18, textAlign: "center",
      lineHeight: "14px", display: "inline-block",
    }}>{count > 99 ? "99+" : count}</span>
  );
}

function formatTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatMsgTime(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function ChatPage() {
  const myUser = me();
  const [contatos, setContatos] = useState([]);
  const [contatoAtivo, setContatoAtivo] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [editando, setEditando] = useState(null); // { id, conteudo }
  const [menuMsgId, setMenuMsgId] = useState(null);
  const [painelAberto, setPainelAberto] = useState(false); // mobile

  const ultimoIdRef = useRef(0);
  const msgEndRef = useRef(null);
  const inputRef = useRef(null);
  const pollingRef = useRef(null);

  // ── Carrega contatos ──
  const fetchContatos = useCallback(async () => {
    try {
      const r = await fetch(`${API}/contatos`, { headers: headers() });
      const data = await r.json();
      setContatos(data.contatos || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  // ── Carrega histórico de mensagens ──
  const fetchMensagens = useCallback(async (userId) => {
    setLoadingMsgs(true);
    try {
      const r = await fetch(`${API}/mensagens/${userId}`, { headers: headers() });
      const data = await r.json();
      const msgs = data.mensagens || [];
      setMensagens(msgs);
      ultimoIdRef.current = msgs.length ? msgs[msgs.length - 1].id : 0;
      // Marca como lidas
      fetch(`${API}/lidas/${userId}`, { method: "PATCH", headers: headers() });
    } catch (e) { console.error(e); }
    finally { setLoadingMsgs(false); }
  }, []);

  // ── Polling de novas mensagens ──
  const pollNovas = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const r = await fetch(`${API}/novas/${userId}?desde=${ultimoIdRef.current}`, { headers: headers() });
      const data = await r.json();
      const novas = data.mensagens || [];
      if (novas.length > 0) {
        setMensagens(prev => {
          const ids = new Set(prev.map(m => m.id));
          const filtradas = novas.filter(m => !ids.has(m.id));
          return [...prev, ...filtradas];
        });
        ultimoIdRef.current = novas[novas.length - 1].id;
        // Se a nova mensagem é do contato, marca como lida
        const temNovaDoContato = novas.some(m => m.remetente_id !== myUser.id);
        if (temNovaDoContato) {
          fetch(`${API}/lidas/${userId}`, { method: "PATCH", headers: headers() });
          fetchContatos();
        }
      }
    } catch (e) { /* silencioso */ }
  }, [fetchContatos, myUser.id]);

  useEffect(() => { fetchContatos(); }, [fetchContatos]);

  // Inicia/reconfigura polling quando muda o contato ativo
  useEffect(() => {
    clearInterval(pollingRef.current);
    if (!contatoAtivo) return;
    fetchMensagens(contatoAtivo.id);
    pollingRef.current = setInterval(() => pollNovas(contatoAtivo.id), 5000);
    return () => clearInterval(pollingRef.current);
  }, [contatoAtivo?.id]);

  // Scroll para baixo quando chegam mensagens
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  // Polling de contatos (atualiza badges) a cada 10s
  useEffect(() => {
    const t = setInterval(fetchContatos, 10000);
    return () => clearInterval(t);
  }, [fetchContatos]);

  // ── Enviar / Editar mensagem ──
  const handleEnviar = async (e) => {
    e?.preventDefault();
    const conteudo = texto.trim();
    if (!conteudo || !contatoAtivo) return;

    // Se está editando
    if (editando) {
      try {
        const r = await fetch(`${API}/mensagens/${editando.id}`, {
          method: "PATCH",
          headers: headers(),
          body: JSON.stringify({ conteudo }),
        });
        const data = await r.json();
        setMensagens(prev => prev.map(m => m.id === editando.id ? { ...m, ...data.mensagem } : m));
        setEditando(null);
        setTexto("");
      } catch (e) { alert("Erro ao editar mensagem."); }
      return;
    }

    setEnviando(true);
    const otimista = {
      id: `tmp-${Date.now()}`, conteudo, tipo: "texto",
      remetente_id: myUser.id, created_at: new Date().toISOString(),
      lida: false, editada: false,
    };
    setMensagens(prev => [...prev, otimista]);
    setTexto("");

    try {
      const r = await fetch(`${API}/mensagens`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ destinatario_id: contatoAtivo.id, conteudo }),
      });
      const data = await r.json();
      if (r.ok) {
        setMensagens(prev => prev.map(m => m.id === otimista.id ? { ...m, ...data.mensagem } : m));
        ultimoIdRef.current = Math.max(ultimoIdRef.current, data.mensagem.id);
        fetchContatos();
      } else {
        setMensagens(prev => prev.filter(m => m.id !== otimista.id));
        alert(data.error || "Erro ao enviar mensagem.");
      }
    } catch (e) {
      setMensagens(prev => prev.filter(m => m.id !== otimista.id));
    } finally { setEnviando(false); }
  };

  // ── Deletar mensagem ──
  const handleDeletar = async (msgId) => {
    if (!window.confirm("Apagar esta mensagem?")) return;
    setMenuMsgId(null);
    try {
      await fetch(`${API}/mensagens/${msgId}`, { method: "DELETE", headers: headers() });
      setMensagens(prev => prev.map(m => m.id === msgId
        ? { ...m, deletada: true, conteudo: "Mensagem apagada" }
        : m
      ));
    } catch (e) { alert("Erro ao apagar mensagem."); }
  };

  const handleSelecionarContato = (c) => {
    setContatoAtivo(c);
    setMensagens([]);
    setTexto("");
    setEditando(null);
    setMenuMsgId(null);
    setPainelAberto(true);
  };

  const contatosFiltrados = contatos.filter(c =>
    c.name.toLowerCase().includes(busca.toLowerCase()) ||
    c.email.toLowerCase().includes(busca.toLowerCase())
  );

  const totalNaoLidas = contatos.reduce((acc, c) => acc + (parseInt(c.nao_lidas) || 0), 0);

  // ─────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100vh", background: M.bg, overflow: "hidden" }}>

      {/* ── PAINEL ESQUERDO: lista de contatos ── */}
      <div style={{
        width: 320, minWidth: 320, background: M.card,
        borderRight: `1px solid ${M.brdN}`, display: "flex",
        flexDirection: "column", flexShrink: 0,
        // Mobile: esconde quando conversa aberta
        ...(painelAberto ? { display: window.innerWidth < 640 ? "none" : "flex" } : {}),
      }}>
        {/* Header */}
        <div style={{ padding: "20px 20px 12px", borderBottom: `1px solid ${M.brdN}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: M.tx }}>
              💬 Chat Interno
            </h2>
            {totalNaoLidas > 0 && <Badge count={totalNaoLidas} />}
          </div>
          {/* Busca */}
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: M.txM }}>🔍</span>
            <input
              placeholder="Buscar contato..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{
                width: "100%", padding: "8px 10px 8px 32px",
                border: `1px solid ${M.brdN}`, borderRadius: 10,
                fontSize: 13, background: M.bg, boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>
        </div>

        {/* Lista de contatos */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: M.txM, fontSize: 13 }}>⏳ Carregando...</div>
          ) : contatosFiltrados.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: M.txM, fontSize: 13 }}>Nenhum contato encontrado</div>
          ) : contatosFiltrados.map(c => {
            const ativo = contatoAtivo?.id === c.id;
            const naoLidas = parseInt(c.nao_lidas) || 0;
            return (
              <div
                key={c.id}
                onClick={() => handleSelecionarContato(c)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 16px", cursor: "pointer",
                  background: ativo ? M.priLight : "transparent",
                  borderLeft: ativo ? `3px solid ${M.pri}` : "3px solid transparent",
                  transition: "all 0.2s",
                }}
                onMouseEnter={e => { if (!ativo) e.currentTarget.style.background = "#fafafa"; }}
                onMouseLeave={e => { if (!ativo) e.currentTarget.style.background = "transparent"; }}
              >
                <Avatar name={c.name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: M.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.name}
                    </span>
                    <span style={{ fontSize: 11, color: M.txM, flexShrink: 0, marginLeft: 6 }}>
                      {formatTime(c.ultima_mensagem_at)}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                    <span style={{ fontSize: 12, color: M.txM, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 170 }}>
                      {c.ultima_mensagem || <em style={{ color: "#bbb" }}>{ROLE_LABELS[c.role] || c.role}</em>}
                    </span>
                    {naoLidas > 0 && <Badge count={naoLidas} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── PAINEL DIREITO: conversa ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {!contatoAtivo ? (
          // Estado vazio
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: M.txM }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>💬</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: M.tx, marginBottom: 8 }}>Selecione uma conversa</div>
            <div style={{ fontSize: 13 }}>Escolha um contato à esquerda para começar</div>
          </div>
        ) : (
          <>
            {/* Header da conversa */}
            <div style={{
              padding: "14px 20px", background: M.card,
              borderBottom: `1px solid ${M.brdN}`,
              display: "flex", alignItems: "center", gap: 12,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}>
              <Avatar name={contatoAtivo.name} size={42} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: M.tx }}>{contatoAtivo.name}</div>
                <div style={{ fontSize: 12, color: M.txM }}>{ROLE_LABELS[contatoAtivo.role] || contatoAtivo.role}</div>
              </div>
              {/* Ações do contato */}
              {contatoAtivo.telefone && (
                <a
                  href={`https://wa.me/55${contatoAtivo.telefone.replace(/\D/g, "")}`}
                  target="_blank" rel="noreferrer"
                  title="Abrir WhatsApp"
                  style={{
                    padding: "7px 14px", borderRadius: 8, background: "#25D366",
                    color: "#fff", fontWeight: 700, fontSize: 12,
                    textDecoration: "none", display: "flex", alignItems: "center", gap: 5,
                  }}
                >
                  💬 WhatsApp
                </a>
              )}
            </div>

            {/* Área de mensagens */}
            <div
              style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 6 }}
              onClick={() => setMenuMsgId(null)}
            >
              {loadingMsgs ? (
                <div style={{ textAlign: "center", padding: 40, color: M.txM }}>⏳ Carregando mensagens...</div>
              ) : mensagens.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: M.txM, fontSize: 13 }}>
                  Nenhuma mensagem ainda. Diga olá! 👋
                </div>
              ) : (
                mensagens.map((msg, i) => {
                  const isMeu = msg.remetente_id === myUser.id;
                  const showDate = i === 0 || new Date(msg.created_at).toDateString() !== new Date(mensagens[i - 1].created_at).toDateString();

                  return (
                    <React.Fragment key={msg.id}>
                      {showDate && (
                        <div style={{ textAlign: "center", margin: "12px 0 6px" }}>
                          <span style={{ fontSize: 11, color: M.txM, background: M.bg, padding: "3px 12px", borderRadius: 12, fontWeight: 600 }}>
                            {new Date(msg.created_at).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                          </span>
                        </div>
                      )}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: isMeu ? "flex-end" : "flex-start",
                          position: "relative",
                        }}
                      >
                        {/* Botão de menu (hover) */}
                        <div
                          style={{
                            position: "relative",
                            maxWidth: "70%",
                          }}
                          onMouseEnter={() => isMeu && !msg.deletada && setMenuMsgId(msg.id)}
                          onMouseLeave={() => setMenuMsgId(null)}
                        >
                          {/* Menu de ações */}
                          {menuMsgId === msg.id && isMeu && !msg.deletada && (
                            <div style={{
                              position: "absolute", top: -32, right: 0,
                              background: "#fff", border: `1px solid ${M.brdN}`,
                              borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                              display: "flex", zIndex: 10, overflow: "hidden",
                            }}>
                              <button
                                onClick={() => { setEditando({ id: msg.id, conteudo: msg.conteudo }); setTexto(msg.conteudo); setMenuMsgId(null); inputRef.current?.focus(); }}
                                style={{ padding: "6px 12px", border: "none", background: "none", cursor: "pointer", fontSize: 12, color: M.tx, fontWeight: 600 }}
                              >✏️ Editar</button>
                              <button
                                onClick={() => handleDeletar(msg.id)}
                                style={{ padding: "6px 12px", border: "none", background: "none", cursor: "pointer", fontSize: 12, color: "#dc2626", fontWeight: 600, borderLeft: `1px solid ${M.brdN}` }}
                              >🗑 Apagar</button>
                            </div>
                          )}

                          {/* Balão da mensagem */}
                          <div style={{
                            padding: "9px 14px",
                            borderRadius: isMeu ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                            background: isMeu ? M.sent : M.recv,
                            color: isMeu ? "#fff" : M.tx,
                            fontSize: 14, lineHeight: 1.5,
                            opacity: msg.deletada ? 0.6 : 1,
                            fontStyle: msg.deletada ? "italic" : "normal",
                            wordBreak: "break-word",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
                          }}>
                            {msg.conteudo}
                            <div style={{
                              fontSize: 10, marginTop: 4,
                              color: isMeu ? "rgba(255,255,255,0.7)" : M.txM,
                              textAlign: "right", display: "flex", gap: 4, justifyContent: "flex-end", alignItems: "center",
                            }}>
                              {msg.editada && <span>editada</span>}
                              <span>{formatMsgTime(msg.created_at)}</span>
                              {isMeu && <span title={msg.lida ? "Lida" : "Enviada"}>{msg.lida ? "✓✓" : "✓"}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
              <div ref={msgEndRef} />
            </div>

            {/* Barra de input */}
            <div style={{
              padding: "12px 20px",
              background: M.card, borderTop: `1px solid ${M.brdN}`,
              display: "flex", flexDirection: "column", gap: 6,
            }}>
              {editando && (
                <div style={{ fontSize: 12, color: M.pri, fontWeight: 600, display: "flex", justifyContent: "space-between" }}>
                  <span>✏️ Editando mensagem</span>
                  <button onClick={() => { setEditando(null); setTexto(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: M.txM, fontSize: 12 }}>✕ Cancelar</button>
                </div>
              )}
              <form onSubmit={handleEnviar} style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                <textarea
                  ref={inputRef}
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEnviar(); }
                  }}
                  placeholder="Digite uma mensagem... (Enter para enviar, Shift+Enter para nova linha)"
                  rows={1}
                  disabled={enviando}
                  style={{
                    flex: 1, padding: "10px 14px", borderRadius: 12,
                    border: `1px solid ${editando ? M.pri : M.brdN}`,
                    fontSize: 14, resize: "none", outline: "none",
                    fontFamily: "inherit", lineHeight: 1.5, maxHeight: 120,
                    overflowY: "auto", boxSizing: "border-box",
                    transition: "border-color 0.2s",
                  }}
                />
                <button
                  type="submit"
                  disabled={enviando || !texto.trim()}
                  style={{
                    padding: "10px 18px", borderRadius: 12,
                    background: texto.trim() ? M.pri : M.brdN,
                    color: "#fff", border: "none", fontWeight: 700,
                    cursor: texto.trim() ? "pointer" : "default",
                    fontSize: 14, transition: "all 0.2s", flexShrink: 0,
                  }}
                >
                  {editando ? "💾 Salvar" : "➤"}
                </button>
              </form>
              <div style={{ fontSize: 10, color: M.txM, paddingLeft: 2 }}>
                Enter para enviar · Shift+Enter para nova linha
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
