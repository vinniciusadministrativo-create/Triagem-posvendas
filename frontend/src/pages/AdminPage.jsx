import React, { useState, useEffect } from "react";

const M = {
  pri: "#9B1B30",
  bg: "#fafafa",
  card: "#fff",
  tx: "#1a1a1a",
  txM: "#6b6560",
  brdN: "#e5e0db",
  ok: "#16a34a",
  err: "#dc2626",
};

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("token");
      const r = await fetch("/api/users", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await r.json();
      setUsers(data.users || []);
    } catch (e) {
      console.error("Erro ao carregar usuários", e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const r = await fetch(`/api/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({
          email: editingUser.email,
          name: editingUser.name,
          role: editingUser.role
        })
      });
      if (r.ok) {
        setMessage({ type: "success", text: "Usuário atualizado com sucesso!" });
        setEditingUser(null);
        fetchUsers();
      }
    } catch (e) {
      setMessage({ type: "error", text: "Erro ao atualizar usuário." });
    }
  };

  const handleResetPassword = async (userId) => {
    const newPass = prompt("Digite a nova senha (mín. 8 caracteres):");
    if (!newPass || newPass.length < 8) return;

    try {
      const token = localStorage.getItem("token");
      const r = await fetch(`/api/users/${userId}/password`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ new_password: newPass })
      });
      if (r.ok) alert("Senha alterada com sucesso!");
    } catch (e) {
      alert("Erro ao alterar senha.");
    }
  };

  return (
    <div style={{ padding: "40px 20px 40px 90px", minHeight: "100vh", background: M.bg, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <header style={{ marginBottom: 30 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: M.tx }}>Gestão de Cadastros</h1>
        <p style={{ color: M.txM }}>Administração de acesso e credenciais de colaboradores.</p>
      </header>

      {message && (
        <div style={{ padding: 15, borderRadius: 8, background: message.type === "success" ? "#f0fdf4" : "#fef2f2", color: message.type === "success" ? M.ok : M.err, marginBottom: 20, border: `1px solid ${message.type === "success" ? "#bcf0da" : "#fecaca"}` }}>
          {message.text}
        </div>
      )}

      <div style={{ background: M.card, borderRadius: 14, border: `1px solid ${M.brdN}`, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8f9fa", textAlign: "left" }}>
              {["Nome", "E-mail", "Função", "Status", "Ações"].map(h => (
                <th key={h} style={{ padding: "16px", fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: M.txM }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderTop: `1px solid ${M.brdN}` }}>
                <td style={{ padding: "16px", fontSize: 14, fontWeight: 600 }}>{u.name}</td>
                <td style={{ padding: "16px", fontSize: 14, color: M.txM }}>{u.email}</td>
                <td style={{ padding: "16px" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 8px", borderRadius: 4, background: u.role === "admin" ? "#eef2ff" : "#f5f3f0", color: u.role === "admin" ? "#4f46e5" : M.txM }}>
                    {u.role.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: "16px" }}>
                  <span style={{ color: u.active ? M.ok : M.err }}>{u.active ? "● Ativo" : "● Inativo"}</span>
                </td>
                <td style={{ padding: "16px", display: "flex", gap: 10 }}>
                  <button onClick={() => setEditingUser(u)} style={{ background: "none", border: "none", color: M.pri, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Editar</button>
                  <button onClick={() => handleResetPassword(u.id)} style={{ background: "none", border: "none", color: M.txM, cursor: "pointer", fontSize: 13 }}>Reset Senha</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyCenter: "center", zIndex: 1100 }}>
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
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button type="button" onClick={() => setEditingUser(null)} style={{ flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${M.brdN}`, background: "#fff", cursor: "pointer" }}>Cancelar</button>
                <button type="submit" style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: M.pri, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
