import React, { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import logoMarin from "../assets/logo_marin.png";
import vtrixSymbol from "../assets/vtrix/vtrix-symbol.svg";

const M = {
  pri: "#9B1B30",
  priDk: "#7A1526",
  soft: "rgba(155,27,48,0.08)",
  tx: "#1a1a1a",
  txM: "#6b6560",
  brdN: "#e5e0db",
};

export default function Sidebar({ user, onLogout, onSwitchUser, isOpen, onToggle }) {
  const navigate = useNavigate();
  const [naoLidas, setNaoLidas] = useState(0);

  // Polling de mensagens não lidas (badge)
  useEffect(() => {
    const fetchNaoLidas = async () => {
      try {
        const r = await fetch("/api/chat/nao-lidas", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        if (r.ok) {
          const data = await r.json();
          setNaoLidas(data.total || 0);
        }
      } catch (_) {}
    };
    fetchNaoLidas();
    const t = setInterval(fetchNaoLidas, 10000);
    return () => clearInterval(t);
  }, []);

  const menuItems = [
    { label: "Novo Chamado", path: "/formulario", icon: "📥", roles: ["vendedor", "pos_vendas", "admin"] },
    { label: "Meus Chamados", path: "/meus-chamados", icon: "📋", roles: ["vendedor"] },
    { label: "Pós-Vendas", path: "/dashboard", icon: "🔍", roles: ["pos_vendas", "admin", "operacional"] },
    { label: "Visão Geral", path: "/historico", icon: "🗃️", roles: ["pos_vendas", "admin"] },
    { label: "Gestão Usuários", path: "/admin", icon: "👤", roles: ["admin"] },
    { label: "Chat", path: "/chat", icon: "💬", roles: ["vendedor", "pos_vendas", "admin", "operacional"], badge: naoLidas },
  ].filter(item => item.roles.includes(user?.role));

  const sidebarStyle = {
    position: "fixed",
    left: 0,
    top: 0,
    bottom: 0,
    width: isOpen ? "260px" : "0px",
    background: "rgba(255, 255, 255, 0.95)",
    backdropFilter: "blur(12px)",
    borderRight: isOpen ? `1px solid ${M.brdN}` : "none",
    transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
    zIndex: 1000,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: isOpen ? "10px 0 30px rgba(0,0,0,0.03)" : "none",
  };

  const navItemStyle = (isActive) => ({
    display: "flex",
    alignItems: "center",
    padding: "14px 22px",
    textDecoration: "none",
    color: isActive ? "#fff" : "#374151",
    background: isActive ? M.pri : "transparent",
    borderRadius: "0 25px 25px 0",
    marginRight: 15,
    marginBottom: 8,
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    whiteSpace: "nowrap",
    opacity: isOpen ? 1 : 0,
  });

  return (
    <>
      {/* HAMBURGER BUTTON */}
      <button 
        className="no-print"
        onClick={onToggle}
        style={{
          position: "fixed",
          top: 20,
          left: 20,
          zIndex: 1001,
          background: M.pri,
          color: "#fff",
          border: "none",
          borderRadius: 8,
          width: 40,
          height: 40,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 4px 12px rgba(155,27,48,0.3)`,
          transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
          transform: isOpen ? "translateX(210px)" : "translateX(0)",
        }}
      >
        {isOpen ? "✕" : "☰"}
      </button>

      <div className={`sidebar-container ${isOpen ? 'open' : ''}`} style={sidebarStyle}>
        <div style={{ padding: "80px 20px 30px", opacity: isOpen ? 1 : 0, transition: "opacity 0.3s" }}>
          <div style={{ marginBottom: 20 }}>
            {/* Vtrix ┃ Marin — plataforma + empresa-mãe, separadas por divisor */}
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
              {/* Vtrix (plataforma) */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <img src={vtrixSymbol} alt="" style={{ width: 30, height: 30, display: "block" }} />
                <span style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-0.01em", color: M.tx, lineHeight: 1 }}>
                  <span style={{ color: M.pri }}>V</span>trix
                </span>
              </div>
              {/* divisor */}
              <div style={{ width: 1, height: 22, background: M.brdN }} />
              {/* Marin (empresa-mãe) */}
              <img src={logoMarin} alt="Marin" style={{ height: 17, width: "auto", borderRadius: 2, display: "block" }} />
            </div>
            <div style={{ fontSize: 10, color: M.txM, textTransform: "uppercase", letterSpacing: 1 }}>{user?.role}</div>
          </div>
        </div>

        <nav style={{ flex: 1 }}>
          {menuItems.map(item => (
            <NavLink 
              key={item.path} 
              to={item.path} 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              style={({ isActive }) => navItemStyle(isActive)}
            >
              <span style={{ fontSize: 20, minWidth: 30 }}>{item.icon}</span>
              <span style={{ marginLeft: 12, fontSize: 14, fontWeight: 600, flex: 1 }}>{item.label}</span>
              {item.badge > 0 && (
                <span style={{
                  background: "#dc2626", color: "#fff", fontSize: 10,
                  fontWeight: 800, borderRadius: 10, padding: "2px 6px",
                  minWidth: 18, textAlign: "center", lineHeight: "14px",
                }}>{item.badge > 99 ? "99+" : item.badge}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: "20px 0", borderTop: `1px solid ${M.brdN}`, opacity: isOpen ? 1 : 0 }}>
          <button
            onClick={onLogout}
            className="nav-item no-print"
            style={{ width: "calc(100% - 15px)", padding: "12px 22px", textAlign: "left", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", color: "#dc2626" }}
          >
            <span style={{ fontSize: 18, minWidth: 30 }}>🚪</span>
            <span style={{ marginLeft: 12, fontSize: 13, fontWeight: 800 }}>Sair</span>
          </button>
        </div>
      </div>

      {/* OVERLAY FOR MOBILE (Optional, keeping simple for desktop push) */}
    </>
  );
}
