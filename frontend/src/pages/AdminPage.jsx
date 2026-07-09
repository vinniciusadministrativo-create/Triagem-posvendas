import React, { useState, useEffect, useMemo } from "react";
import { api } from "../api";
import ChamadoDetail from "../components/ChamadoDetail";
import RelatoriosPage from "./RelatoriosPage";
import { useConfirm } from "../components/Confirm";

const M = {
  pri: "#9B1B30",
  bg: "#fafafa",
  card: "#fff",
  tx: "#1a1a1a",
  txM: "#6b6560",
  brdN: "#e5e0db",
  soft: "rgba(155,27,48,0.07)",
  ok: "#16a34a",
  warn: "#d97706",
  err: "#dc2626",
};

const ROLES = [
  { id: "vendedor", label: "Vendedor" },
  { id: "pos_vendas", label: "Pós-Vendas" },
  { id: "operacional", label: "Operacional (Logística)" },
  { id: "admin", label: "Administrador" },
];
const ROLE_LABEL = Object.fromEntries(ROLES.map(r => [r.id, r.label]));

const inputStyle = { width: "100%", padding: 10, border: `1px solid ${M.brdN}`, borderRadius: 8, boxSizing: "border-box", fontFamily: "inherit", fontSize: 14 };
const labelStyle = { display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 };

// Campo de senha com botão mostrar/ocultar (reutilizado nos modais)
function PasswordField({ value, onChange, placeholder, required }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input type={show ? "text" : "password"} value={value} onChange={onChange} placeholder={placeholder} required={required}
        style={{ ...inputStyle, paddingRight: 42 }} />
      <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? "Ocultar senha" : "Mostrar senha"} title={show ? "Ocultar senha" : "Mostrar senha"}
        style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 4, lineHeight: 1 }}>
        {show ? "🙈" : "👁️"}
      </button>
    </div>
  );
}

export default function AdminPage() {
  const confirm = useConfirm();
  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
  })();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [message, setMessage] = useState(null);
  const [activeTab, setActiveTab] = useState("users");
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [sellerChamados, setSellerChamados] = useState([]);
  const [loadingSeller, setLoadingSeller] = useState(false);
  const [selectedChamado, setSelectedChamado] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", telefone: "", password: "", role: "vendedor" });

  // Busca e filtros
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState(""); // "" | "active" | "inactive"

  // Backup
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupDone, setBackupDone] = useState(false);

  // Reset (zerar chamados)
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPhrase, setResetPhrase] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data.users || []);
    } catch (e) {
      console.error("Erro ao carregar usuários", e);
      setMessage({ type: "error", text: "Erro ao carregar usuários." });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(u => {
      if (q && !`${u.name} ${u.email}`.toLowerCase().includes(q)) return false;
      if (filterRole && u.role !== filterRole) return false;
      if (filterStatus === "active" && !u.active) return false;
      if (filterStatus === "inactive" && u.active) return false;
      return true;
    });
  }, [users, search, filterRole, filterStatus]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (newUser.password.length < 8) {
      setMessage({ type: "error", text: "A senha deve ter no mínimo 8 caracteres." });
      return;
    }
    try {
      await api.createUser(newUser);
      setMessage({ type: "success", text: "Usuário criado com sucesso!" });
      setShowCreateModal(false);
      setNewUser({ name: "", email: "", telefone: "", password: "", role: "vendedor" });
      fetchUsers();
    } catch (e) {
      setMessage({ type: "error", text: e.message || "Erro ao criar usuário." });
    }
  };

  const fetchSellerChamados = async (userId) => {
    setLoadingSeller(true);
    try {
      const data = await api.getChamados({ vendedor_id: userId });
      setSellerChamados(data.chamados || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSeller(false);
    }
  };

  const handleSellerClick = (u) => {
    setSelectedSeller(u);
    fetchSellerChamados(u.id);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    // Proteção: admin não pode remover a própria função de administrador (evita se trancar para fora)
    if (editingUser.id === currentUser.id && editingUser.role !== "admin") {
      setMessage({ type: "error", text: "Você não pode remover a sua própria função de administrador." });
      return;
    }
    if (editingUser.password && editingUser.password.length < 8) {
      setMessage({ type: "error", text: "A nova senha deve ter no mínimo 8 caracteres." });
      return;
    }
    try {
      await api.updateUser(editingUser.id, editingUser);
      setMessage({ type: "success", text: "Usuário atualizado!" });
      setEditingUser(null);
      fetchUsers();
    } catch (e) {
      setMessage({ type: "error", text: e.message || "Erro ao atualizar." });
    }
  };

  const handleDeleteChamado = async (id) => {
    if (!await confirm("Tem certeza que deseja excluir este chamado permanentemente?", { title: "Excluir chamado", confirmLabel: "Excluir", variant: "danger" })) return;
    try {
      await api.deleteChamado(id);
      fetchSellerChamados(selectedSeller.id);
      setSelectedChamado(null);
    } catch (e) {
      setMessage({ type: "error", text: "Erro ao excluir chamado." });
    }
  };

  const handleToggleActive = async (u) => {
    const acao = u.active ? "inativar" : "ativar";
    if (!await confirm(`Tem certeza que deseja ${acao} o usuário "${u.name}"?`, { title: u.active ? "Inativar usuário" : "Ativar usuário", confirmLabel: acao === "inativar" ? "Inativar" : "Ativar", variant: u.active ? "danger" : "default" })) return;
    try {
      await api.updateUser(u.id, { active: !u.active });
      setMessage({ type: "success", text: `Usuário ${u.active ? "inativado" : "ativado"} com sucesso!` });
      fetchUsers();
    } catch (e) {
      setMessage({ type: "error", text: e.message || "Erro ao alterar status do usuário." });
    }
  };

  const handleBackup = async () => {
    setBackupLoading(true);
    setMessage(null);
    try {
      const { blob, filename } = await api.backupDatabase();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setBackupDone(true);
      setMessage({ type: "success", text: `Backup gerado: ${filename}` });
    } catch (e) {
      setMessage({ type: "error", text: e.message || "Erro ao gerar backup." });
    } finally {
      setBackupLoading(false);
    }
  };

  const RESET_PHRASE = "ZERAR CHAMADOS";
  const handleReset = async () => {
    if (resetPhrase !== RESET_PHRASE) return;
    setResetLoading(true);
    setMessage(null);
    try {
      const data = await api.resetChamados(resetPhrase);
      setMessage({ type: "success", text: data.message || "Chamados zerados com sucesso." });
      setShowResetModal(false);
      setResetPhrase("");
      setBackupDone(false); // exige novo backup antes de um próximo reset
    } catch (e) {
      setMessage({ type: "error", text: e.message || "Erro ao zerar os chamados." });
    } finally {
      setResetLoading(false);
    }
  };

  const handleDeleteUser = async (u) => {
    if (!await confirm(`Excluir permanentemente o usuário "${u.name}"? Esta ação não pode ser desfeita.`, { title: "Excluir usuário", confirmLabel: "Excluir", variant: "danger" })) return;
    try {
      const data = await api.deleteUser(u.id);
      setMessage({ type: "success", text: data.message || "Usuário excluído." });
      fetchUsers();
    } catch (e) {
      setMessage({ type: "error", text: e.message || "Erro ao excluir usuário." });
    }
  };

  return (
    <div className="page-container">
      {selectedChamado && (
        <ChamadoDetail
          chamado={selectedChamado}
          onClose={() => setSelectedChamado(null)}
          onStatusChange={() => fetchSellerChamados(selectedSeller.id)}
          onDelete={handleDeleteChamado}
        />
      )}

      <header style={{ marginBottom: 30 }}>
        <div className="responsive-header" style={{ marginBottom: 0 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: M.tx }}>Painel de Administração</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{ padding: "10px 20px", background: M.pri, color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
          >
            <span>+</span> Novo Usuário
          </button>
        </div>
        <div style={{ display: "flex", gap: 20, marginTop: 20, borderBottom: `1px solid ${M.brdN}` }}>
          <button onClick={() => setActiveTab("users")} style={{ paddingBottom: 10, border: "none", background: "none", borderBottom: activeTab === "users" ? `2px solid ${M.pri}` : "none", color: activeTab === "users" ? M.pri : M.txM, fontWeight: 700, cursor: "pointer" }}>Usuários</button>
          <button onClick={() => setActiveTab("sellers")} style={{ paddingBottom: 10, border: "none", background: "none", borderBottom: activeTab === "sellers" ? `2px solid ${M.pri}` : "none", color: activeTab === "sellers" ? M.pri : M.txM, fontWeight: 700, cursor: "pointer" }}>Gestão por Vendedor</button>
          <button onClick={() => setActiveTab("relatorios")} style={{ paddingBottom: 10, border: "none", background: "none", borderBottom: activeTab === "relatorios" ? `2px solid ${M.pri}` : "none", color: activeTab === "relatorios" ? M.pri : M.txM, fontWeight: 700, cursor: "pointer" }}>📊 Relatórios</button>
          <button onClick={() => setActiveTab("backup")} style={{ paddingBottom: 10, border: "none", background: "none", borderBottom: activeTab === "backup" ? `2px solid ${M.pri}` : "none", color: activeTab === "backup" ? M.pri : M.txM, fontWeight: 700, cursor: "pointer" }}>💾 Backup</button>
        </div>
      </header>

      {message && (
        <div style={{ marginBottom: 16, padding: "12px 18px", borderRadius: 10, background: message.type === "success" ? "#dcfce7" : "#fee2e2", color: message.type === "success" ? "#166534" : "#991b1b", fontWeight: 600, fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{message.type === "success" ? "✅" : "❌"} {message.text}</span>
          <button onClick={() => setMessage(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "inherit" }}>✕</button>
        </div>
      )}

      {activeTab === "users" && renderUsersTable()}
      {activeTab === "sellers" && renderSellersManagement()}
      {activeTab === "relatorios" && <RelatoriosPage />}
      {activeTab === "backup" && renderBackup()}

      {editingUser && renderEditModal()}
      {showCreateModal && renderCreateModal()}
      {showResetModal && renderResetModal()}
    </div>
  );

  function renderCreateModal() {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
        <div style={{ background: "#fff", padding: 30, borderRadius: 14, width: 400, maxWidth: "92vw" }}>
          <h2 style={{ marginBottom: 20 }}>Novo Usuário</h2>
          <form onSubmit={handleCreate}>
            <div style={{ marginBottom: 15 }}>
              <label style={labelStyle}>Nome Completo</label>
              <input style={inputStyle} value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} required />
            </div>
            <div style={{ marginBottom: 15 }}>
              <label style={labelStyle}>E-mail</label>
              <input type="email" style={inputStyle} value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} required />
            </div>
            <div style={{ marginBottom: 15 }}>
              <label style={labelStyle}>Telefone</label>
              <input style={inputStyle} value={newUser.telefone} onChange={e => setNewUser({ ...newUser, telefone: e.target.value })} />
            </div>
            <div style={{ marginBottom: 15 }}>
              <label style={labelStyle}>Senha Provisória</label>
              <PasswordField value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="Mínimo 8 caracteres" required />
              <div style={{ fontSize: 11, color: M.txM, marginTop: 4 }}>Mínimo 8 caracteres.</div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Função</label>
              <select style={inputStyle} value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setShowCreateModal(false)} style={{ flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${M.brdN}`, background: "#fff", cursor: "pointer" }}>Cancelar</button>
              <button type="submit" style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: M.pri, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Cadastrar</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderUsersTable() {
    return (
      <div>
        {/* Busca + filtros */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
          <input
            placeholder="🔍 Buscar por nome ou e-mail..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 220, width: "auto" }}
          />
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
            <option value="">Todas as funções</option>
            {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
            <option value="">Todos os status</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        </div>

        <div style={{ fontSize: 12, color: M.txM, marginBottom: 8 }}>
          {loading ? "Carregando..." : `${filteredUsers.length} de ${users.length} usuário(s)`}
        </div>

        <div className="table-wrapper">
          <table className="table-responsive">
            <thead>
              <tr style={{ background: "#f8f9fa", textAlign: "left" }}>
                {["Nome", "E-mail", "Telefone", "Função", "Status", "Ações"].map(h => (
                  <th key={h} style={{ padding: "16px", fontSize: 12, textTransform: "uppercase", color: M.txM }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && filteredUsers.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: M.txM }}>Nenhum usuário encontrado.</td></tr>
              )}
              {filteredUsers.map(u => {
                const isSelf = u.id === currentUser.id;
                return (
                  <tr key={u.id} style={{ borderTop: `1px solid ${M.brdN}`, opacity: u.active ? 1 : 0.55 }}>
                    <td style={{ padding: "16px", fontSize: 14, fontWeight: 600, color: u.active ? M.tx : M.txM }}>
                      {u.name}{isSelf && <span style={{ fontSize: 10, color: M.pri, marginLeft: 6, fontWeight: 700 }}>(você)</span>}
                    </td>
                    <td style={{ padding: "16px", fontSize: 14, color: M.txM }}>{u.email}</td>
                    <td style={{ padding: "16px", fontSize: 14, color: M.txM }}>{u.telefone || "—"}</td>
                    <td style={{ padding: "16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 8px", borderRadius: 4, background: "#f5f3f0", color: M.txM }}>{ROLE_LABEL[u.role] || u.role}</span>
                    </td>
                    <td style={{ padding: "16px" }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
                        background: u.active ? "#dcfce7" : "#fee2e2",
                        color: u.active ? "#166534" : "#991b1b"
                      }}>
                        {u.active ? "● Ativo" : "● Inativo"}
                      </span>
                    </td>
                    <td style={{ padding: "16px" }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button onClick={() => setEditingUser({ ...u, password: "" })}
                          style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${M.brdN}`, background: "#fff", color: M.tx, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                          ✏️ Editar
                        </button>
                        {/* Ações destrutivas escondidas na própria conta */}
                        {!isSelf && (
                          <>
                            <button onClick={() => handleToggleActive(u)}
                              style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${u.active ? M.warn : M.ok}`, background: "#fff", color: u.active ? M.warn : M.ok, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                              {u.active ? "⏸ Inativar" : "▶ Ativar"}
                            </button>
                            <button onClick={() => handleDeleteUser(u)}
                              style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: M.err, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                              🗑 Excluir
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderSellersManagement() {
    const sellers = users.filter(u => u.role === "vendedor");
    return (
      <div className="responsive-grid">
        <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${M.brdN}`, overflow: "hidden" }}>
          <div style={{ padding: 15, background: "#f8f9fa", fontWeight: 700, borderBottom: `1px solid ${M.brdN}` }}>Vendedores</div>
          {sellers.map(s => (
            <div
              key={s.id}
              onClick={() => handleSellerClick(s)}
              style={{ padding: 15, cursor: "pointer", borderBottom: `1px solid ${M.brdN}`, background: selectedSeller?.id === s.id ? M.soft : "none" }}
            >
              <div style={{ fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 11, color: M.txM }}>{s.email}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${M.brdN}`, padding: 20 }}>
          {selectedSeller ? (
            <>
              <h3 style={{ marginTop: 0 }}>Chamados de: {selectedSeller.name}</h3>
              {loadingSeller ? <p>Carregando...</p> : (
                sellerChamados.length === 0 ? <p>Nenhum chamado para este vendedor.</p> : (
                  sellerChamados.map(c => (
                    <div key={c.id} style={{ padding: "12px 15px", borderBottom: `1px solid ${M.brdN}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{c.razao_social}</div>
                        <div style={{ fontSize: 12, color: M.txM }}>NF {c.nf_original} | #{c.id}</div>
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={() => setSelectedChamado(c)} style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${M.pri}`, color: M.pri, background: "none", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Ver/Gestão</button>
                        <button onClick={() => handleDeleteChamado(c.id)} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: M.err, color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Excluir</button>
                      </div>
                    </div>
                  ))
                )
              )}
            </>
          ) : (
            <p style={{ textAlign: "center", color: M.txM, paddingTop: 100 }}>Selecione um vendedor à esquerda para gerenciar seus chamados.</p>
          )}
        </div>
      </div>
    );
  }

  function renderBackup() {
    return (
      <div style={{ maxWidth: 640 }}>
        <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${M.brdN}`, padding: 24 }}>
          <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 18, color: M.tx }}>Exportar banco de dados</h3>
          <p style={{ fontSize: 14, color: M.txM, lineHeight: 1.6, marginTop: 0 }}>
            Gera um arquivo <code style={{ background: M.soft, padding: "1px 6px", borderRadius: 4 }}>.sql</code> com
            todo o schema e os dados atuais do banco (usuários, chamados, mensagens, chat…). Use-o como backup ou
            para restaurar o banco manualmente via <code style={{ background: M.soft, padding: "1px 6px", borderRadius: 4 }}>psql</code>.
          </p>
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "12px 16px", margin: "16px 0", fontSize: 13, color: "#92400e", lineHeight: 1.5 }}>
            ⚠️ O arquivo contém dados sensíveis (inclusive os hashes de senha). Guarde em local seguro e não compartilhe.
          </div>
          <button
            onClick={handleBackup}
            disabled={backupLoading}
            style={{ padding: "12px 24px", background: backupLoading ? M.txM : M.pri, color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, cursor: backupLoading ? "default" : "pointer", display: "flex", alignItems: "center", gap: 8 }}
          >
            {backupLoading ? "⏳ Gerando backup…" : "⬇️ Baixar backup (.sql)"}
          </button>
        </div>

        {/* Zona de perigo — zerar chamados */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #fecaca", padding: 24, marginTop: 20 }}>
          <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 18, color: M.err }}>⚠️ Zerar chamados</h3>
          <p style={{ fontSize: 14, color: M.txM, lineHeight: 1.6, marginTop: 0 }}>
            Remove <strong>todos os chamados</strong> e seus dados relacionados para começar um novo ciclo do zero.
          </p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "12px 0 16px" }}>
            <div style={{ flex: 1, minWidth: 220, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: M.err, marginBottom: 6 }}>SERÃO APAGADOS</div>
              <div style={{ fontSize: 13, color: "#7f1d1d", lineHeight: 1.6 }}>Chamados · histórico · mensagens dos chamados · compartilhamentos</div>
            </div>
            <div style={{ flex: 1, minWidth: 220, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: M.ok, marginBottom: 6 }}>SERÃO PRESERVADOS</div>
              <div style={{ fontSize: 13, color: "#14532d", lineHeight: 1.6 }}>Usuários · chat entre usuários (mensagens diretas e grupos)</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: M.txM, marginBottom: 12 }}>
            {backupDone
              ? "✅ Backup baixado nesta sessão — reset liberado."
              : "🔒 Baixe um backup acima antes de liberar o reset."}
          </div>
          <button
            onClick={() => { setResetPhrase(""); setShowResetModal(true); }}
            disabled={!backupDone}
            style={{ padding: "12px 24px", background: backupDone ? M.err : "#f3d4d4", color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, cursor: backupDone ? "pointer" : "not-allowed" }}
          >
            🗑 Zerar chamados
          </button>
        </div>
      </div>
    );
  }

  function renderResetModal() {
    const match = resetPhrase === RESET_PHRASE;
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
        <div style={{ background: "#fff", padding: 30, borderRadius: 14, width: 460, maxWidth: "92vw" }}>
          <h2 style={{ marginTop: 0, marginBottom: 12, color: M.err }}>Zerar chamados</h2>
          <p style={{ fontSize: 14, color: M.txM, lineHeight: 1.6, marginTop: 0 }}>
            Esta ação é <strong>irreversível</strong>. Todos os chamados, histórico, mensagens de chamado e
            compartilhamentos serão apagados permanentemente. Usuários e chat serão preservados.
          </p>
          <label style={{ ...labelStyle, marginTop: 12 }}>
            Digite <span style={{ color: M.err, fontWeight: 800 }}>{RESET_PHRASE}</span> para confirmar
          </label>
          <input
            style={inputStyle}
            value={resetPhrase}
            onChange={e => setResetPhrase(e.target.value)}
            placeholder={RESET_PHRASE}
            autoFocus
          />
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button type="button" onClick={() => { setShowResetModal(false); setResetPhrase(""); }} disabled={resetLoading}
              style={{ flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${M.brdN}`, background: "#fff", cursor: "pointer" }}>Cancelar</button>
            <button type="button" onClick={handleReset} disabled={!match || resetLoading}
              style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: (match && !resetLoading) ? M.err : "#f3d4d4", color: "#fff", fontWeight: 700, cursor: (match && !resetLoading) ? "pointer" : "not-allowed" }}>
              {resetLoading ? "Zerando…" : "Confirmar reset"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderEditModal() {
    const isSelf = editingUser.id === currentUser.id;
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
        <div style={{ background: "#fff", padding: 30, borderRadius: 14, width: 400, maxWidth: "92vw" }}>
          <h2 style={{ marginBottom: 20 }}>Editar Usuário</h2>
          <form onSubmit={handleUpdate}>
            <div style={{ marginBottom: 15 }}>
              <label style={labelStyle}>Nome</label>
              <input style={inputStyle} value={editingUser.name} onChange={e => setEditingUser({ ...editingUser, name: e.target.value })} />
            </div>
            <div style={{ marginBottom: 15 }}>
              <label style={labelStyle}>E-mail</label>
              <input type="email" style={inputStyle} value={editingUser.email} onChange={e => setEditingUser({ ...editingUser, email: e.target.value })} />
            </div>
            <div style={{ marginBottom: 15 }}>
              <label style={labelStyle}>Telefone</label>
              <input style={inputStyle} value={editingUser.telefone || ""} onChange={e => setEditingUser({ ...editingUser, telefone: e.target.value })} />
            </div>
            <div style={{ marginBottom: 15 }}>
              <label style={labelStyle}>Função</label>
              <select style={{ ...inputStyle, background: isSelf ? "#f5f3f0" : "#fff", cursor: isSelf ? "not-allowed" : "pointer" }}
                value={editingUser.role} disabled={isSelf}
                onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}>
                {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
              {isSelf && <div style={{ fontSize: 11, color: M.txM, marginTop: 4 }}>Você não pode alterar a própria função.</div>}
            </div>
            <div style={{ marginBottom: 15 }}>
              <label style={labelStyle}>Nova Senha (deixe em branco para não alterar)</label>
              <PasswordField value={editingUser.password || ""} onChange={e => setEditingUser({ ...editingUser, password: e.target.value })} placeholder="Mínimo 8 caracteres" />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button type="button" onClick={() => setEditingUser(null)} style={{ flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${M.brdN}`, background: "#fff", cursor: "pointer" }}>Cancelar</button>
              <button type="submit" style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: M.pri, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Salvar</button>
            </div>
          </form>
        </div>
      </div>
    );
  }
}
