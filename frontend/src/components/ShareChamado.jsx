import React, { useState, useEffect } from "react";
import { api } from "../api";

const M = {
  pri: "#9B1B30",
  bg: "#fafafa",
  tx: "#1a1a1a",
  txM: "#6b6560",
  brdN: "#e5e0db",
  blueS: "rgba(37,99,235,0.08)",
  blue: "#2563eb",
};

export default function ShareChamado({ chamadoId, onShared }) {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadContacts();
    }
  }, [isOpen]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const res = await api.getContacts();
      setContacts(res.contacts || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (userId) => {
    if (!window.confirm("Deseja compartilhar acesso a este chamado com este usuário?")) return;
    try {
      await api.shareChamado(chamadoId, userId);
      alert("Chamado compartilhado com sucesso!");
      setIsOpen(false);
      if (onShared) onShared();
    } catch (e) {
      alert("Erro ao compartilhar: " + e.message);
    }
  };

  const filtered = contacts.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ marginTop: 20 }}>
      <button 
        onClick={() => setIsOpen(true)}
        style={{
          padding: "10px 16px",
          background: "none",
          border: `1px solid ${M.pri}`,
          color: M.pri,
          borderRadius: 8,
          fontWeight: 700,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13
        }}
      >
        <span>➕</span> Compartilhar Chamado
      </button>

      {isOpen && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2000,
          padding: 20
        }}>
          <div style={{
            background: "#fff",
            borderRadius: 16,
            width: "100%",
            maxWidth: 450,
            maxHeight: "80vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 20px 50px rgba(0,0,0,0.2)"
          }}>
            <div style={{ padding: 20, borderBottom: `1px solid ${M.brdN}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Compartilhar com...</h3>
              <button onClick={() => setIsOpen(false)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 20 }}>×</button>
            </div>

            <div style={{ padding: 15, borderBottom: `1px solid ${M.brdN}` }}>
              <input 
                type="text"
                placeholder="Buscar por nome ou e-mail..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 15px",
                  borderRadius: 8,
                  border: `1px solid ${M.brdN}`,
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box"
                }}
                autoFocus
              />
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
              {loading ? (
                <p style={{ textAlign: "center", padding: 20, color: M.txM }}>Carregando contatos...</p>
              ) : filtered.length === 0 ? (
                <p style={{ textAlign: "center", padding: 20, color: M.txM }}>Nenhum contato encontrado.</p>
              ) : (
                filtered.map(contact => (
                  <div 
                    key={contact.id}
                    onClick={() => handleShare(contact.id)}
                    style={{
                      padding: "12px 15px",
                      borderRadius: 10,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      transition: "background 0.2s"
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = M.bg}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: M.blueS,
                      color: M.blue,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 14
                    }}>
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: M.tx }}>{contact.name}</div>
                      <div style={{ fontSize: 12, color: M.txM }}>{contact.email}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
