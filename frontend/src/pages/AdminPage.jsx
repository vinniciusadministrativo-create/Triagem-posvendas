import React, { useState, useEffect } from "react";
import { api } from "../api";
import ChamadoDetail from "../components/ChamadoDetail";
import RelatoriosPage from "./RelatoriosPage";

const M = {
  pri: "#9B1B30",
  bg: "#fafafa",
  card: "#fff",
  tx: "#1a1a1a",
  txM: "#6b6560",
  brdN: "#e5e0db",
  ok: "#16a34a",
  warn: "#d97706",
  err: "#dc2626",
};

export default function AdminPage() {
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

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data.users || []);
    } catch (e) {
      console.error("Erro ao carregar usuários", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.createUser(newUser);
      setMessage({ type: "success", text: "Usuário criado com sucesso!" });
      setShowCreateModal(false);
      setNewUser({ name: "", email: "", password: "", role: "vendedor" });
      fetchUsers();
    } catch (e) {
      setMessage({ type: "error", text: e.message || "Erro ao criar usuário." });
    }
  };

  const fetchSellerChamados = async (userId) => {
    setLoadingSeller(true);
    try {
      // Usaremos um parâmetro de filtro que adicionaremos na API ou usaremos o getChamados com filtro
      const r = await fetch(`/api/chamados?vendedor_id=${userId}`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      const data = await r.json();
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
    try {
      await api.updateUser(editingUser.id, editingUser);
      setMessage({ type: "success", text: "Usuário atualizado!" });
      setEditingUser(null);
      fetchUsers();
    } catch (e) {
      setMessage({ type: "error", text: "Erro ao atualizar." });
    }
  };

  const handleDeleteChamado = async (id) => {
    if(!window.confirm("Admin: Tem certeza que deseja excluir este chamado permanentemente?")) return;
    try {
      await api.deleteChamado(id);
      fetchSellerChamados(selectedSeller.id);
      setSelectedChamado(null);
    } catch (e) {
      alert("Erro ao excluir chamado.");
    }
  };

  const handleToggleActive = async (u) => {
    const acao = u.active ? "inativar" : "ativar";
    if (!window.confirm(`Tem certeza que deseja ${acao} o usuário "${u.name}"?`)) return;
    try {
      await fetch(`/api/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ active: !u.active }),
      });
      setMessage({ type: "success", text: `Usuário ${u.active ? "inativado" : "ativado"} com sucesso!` });
      fetchUsers();
    } catch (e) {
      setMessage({ type: "error", text: "Erro ao alterar status do usuário." });
    }
  };

  const handleDeleteUser = async (u) => {
    if (!window.confirm(`⚠️ ATENÇÃO: Excluir permanentemente o usuário "${u.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      const r = await fetch(`/api/users/${u.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setMessage({ type: "success", text: data.message });
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

      {editingUser && renderEditModal()}
      {showCreateModal && renderCreateModal()}
    </div>
  );

  function renderCreateModal() {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
        <div style={{ background: "#fff", padding: 30, borderRadius: 14, width: 400 }}>
          <h2 style={{ marginBottom: 20 }}>Novo Usuário</h2>
          <form onSubmit={handleCreate}>
            <div style={{ marginBottom: 15 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>Nome Completo</label>
              <input style={{ width: "100%", padding: 10, border: `1px solid ${M.brdN}`, borderRadius: 8 }} value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} required />
            </div>
            <div style={{ marginBottom: 15 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>E-mail</label>
              <input style={{ width: "100%", padding: 10, border: `1px solid ${M.brdN}`, borderRadius: 8 }} value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} required />
            </div>
            <div style={{ marginBottom: 15 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>Telefone</label>
              <input style={{ width: "100%", padding: 10, border: `1px solid ${M.brdN}`, borderRadius: 8 }} value={newUser.telefone} onChange={e => setNewUser({...newUser, telefone: e.target.value})} />
            </div>
            <div style={{ marginBottom: 15 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>Senha Provisória</label>
              <input type="password" style={{ width: "100%", padding: 10, border: `1px solid ${M.brdN}`, borderRadius: 8 }} value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>Função</label>
              <select style={{ width: "100%", padding: 10, border: `1px solid ${M.brdN}`, borderRadius: 8 }} value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                <option value="vendedor">Vendedor</option>
                <option value="pos_vendas">Pós-Vendas</option>
                <option value="operacional">Operacional (Logística)</option>
                <option value="admin">Administrador</option>
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
      <div className="table-wrapper">
        <table className="table-responsive">
          <thead>
            <tr style={{ background: "#f8f9fa", textAlign: "left" }}>
              {["Nome", "E-mail", "Função", "Status", "Ações"].map(h => (
                <th key={h} style={{ padding: "16px", fontSize: 12, textTransform: "uppercase", color: M.txM }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderTop: `1px solid ${M.brdN}`, opacity: u.active ? 1 : 0.55 }}>
                <td style={{ padding: "16px", fontSize: 14, fontWeight: 600, color: u.active ? M.tx : M.txM }}>{u.name}</td>
                <td style={{ padding: "16px", fontSize: 14, color: M.txM }}>{u.email}</td>
                <td style={{ padding: "16px" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 8px", borderRadius: 4, background: "#f5f3f0", color: M.txM }}>{u.role.toUpperCase()}</span>
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
                    <button onClick={() => setEditingUser(u)}
                      style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${M.brdN}`, background: "#fff", color: M.tx, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                      ✏️ Editar
                    </button>
                    <button onClick={() => handleToggleActive(u)}
                      style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${u.active ? M.warn : M.ok}`, background: "#fff", color: u.active ? M.warn : M.ok, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                      {u.active ? "⏸ Inativar" : "▶ Ativar"}
                    </button>
                    <button onClick={() => handleDeleteUser(u)}
                      style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: M.err, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                      🗑 Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

  function renderEditModal() {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
        <div style={{ background: "#fff", padding: 30, borderRadius: 14, width: 400 }}>
          <h2 style={{ marginBottom: 20 }}>Editar Usuário</h2>
          <form onSubmit={handleUpdate}>
            <div style={{ marginBottom: 15 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>Nome</label>
              <input style={{ width: "100%", padding: 10, border: `1px solid ${M.brdN}`, borderRadius: 8 }} value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} />
            </div>
            <div style={{ marginBottom: 15 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>E-mail</label>
              <input style={{ width: "100%", padding: 10, border: `1px solid ${M.brdN}`, borderRadius: 8 }} value={editingUser.email} onChange={e => setEditingUser({...editingUser, email: e.target.value})} />
            </div>
            <div style={{ marginBottom: 15 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>Telefone</label>
              <input style={{ width: "100%", padding: 10, border: `1px solid ${M.brdN}`, borderRadius: 8 }} value={editingUser.telefone || ""} onChange={e => setEditingUser({...editingUser, telefone: e.target.value})} />
            </div>
            <div style={{ marginBottom: 15 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>Nova Senha (deixe em branco para não alterar)</label>
              <input type="password" style={{ width: "100%", padding: 10, border: `1px solid ${M.brdN}`, borderRadius: 8 }} value={editingUser.password || ""} onChange={e => setEditingUser({...editingUser, password: e.target.value})} />
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
