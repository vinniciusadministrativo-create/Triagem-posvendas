import React, { useState } from "react";
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
  novo: "#6b7280", avaliacao: "#f59e0b", negociacao: "#8b5cf6", 
  espelho: "#9B1B30", aguardando_nfd: "#2563eb", 
  aguardando_recolhimento: "#059669", aguardando_financeiro: "#16a34a", 
  encerrado: "#6b7280",
};

const STATUSES = [
  { id: "novo", label: "Novo" },
  { id: "avaliacao", label: "Avaliação" },
  { id: "negociacao", label: "Negociação" },
  { id: "espelho", label: "Emitir Espelho NFD" },
  { id: "aguardando_nfd", label: "Aguard. NFD" },
  { id: "aguardando_recolhimento", label: "Aguard. Recolhimento" },
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

export default function ChamadoDetail({ chamado, onClose, onStatusChange, onDelete }) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [newStatus, setNewStatus] = useState(chamado.status || "novo");
  const [localRessalva, setLocalRessalva] = useState(chamado.ressalva_vendedor || "");
  const [ressalvaFiles, setRessalvaFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savingRessalva, setSavingRessalva] = useState(false);

  // Regras de Permissão
  const isAdmin = user.role === "admin";
  const isPosVendas = user.role === "pos_vendas";
  const isOwner = chamado.vendedor_id === user.id;
  const canEdit = isAdmin || isPosVendas;
  const canDelete = isAdmin;
  const canShare = isOwner || isAdmin;

  const save = async () => {
    setSaving(true);
    try {
      await api.updateStatus(chamado.id, newStatus);
      if (onStatusChange) onStatusChange(chamado.id, newStatus);
      alert("Status atualizado!");
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 20 }}>
      {/* ... conteúdo encurtado para foco na ressalva ... */}
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 650, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        {/* HEADER */}
        <div style={{ padding: 20, borderBottom: `1px solid ${M.brdN}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Chamado #{chamado.id}</h2>
            <div style={{ fontSize: 11, color: M.txM }}>Criado em: {new Date(chamado.created_at).toLocaleString()}</div>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 24, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ padding: 25 }}>
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

          {canEdit && (chamado.nf_data || ["espelho", "aguardando_nfd", "aguardando_recolhimento", "aguardando_financeiro", "encerrado"].includes(chamado.status)) && (
            <DanfeMirror nf={chamado.nf_data} chamado={chamado} />
          )}

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

          {/* BOTÃO DE EXCLUSÃO (APENAS ADMIN) */}
          {canDelete && (
            <button 
              onClick={() => { if(window.confirm("Tem certeza que deseja excluir?")) onDelete(chamado.id); }} 
              style={{ marginTop: 30, width: "100%", padding: 12, background: "transparent", color: M.err, border: `1px solid ${M.err}`, borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}
            >
              🗑️ Excluir Chamado Permanentemente
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
