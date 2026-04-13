import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

const M = {
  pri: "#9B1B30",
  priDk: "#7A1526",
  soft: "rgba(155,27,48,0.08)",
  tx: "#1a1a1a",
  txM: "#6b6560",
  brdN: "#e5e0db",
};

export default function Sidebar({ user, onLogout, onSwitchUser }) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const menuItems = [
    { label: "Novo Chamado", path: "/formulario", icon: "📥", roles: ["vendedor", "pos_vendas", "admin"] },
    { label: "Meus Chamados", path: "/meus-chamados", icon: "📋", roles: ["vendedor"] },
    { label: "Pós-Vendas", path: "/dashboard", icon: "🔍", roles: ["pos_vendas", "admin"] },
    { label: "Gestão Usuários", path: "/admin", icon: "👤", roles: ["admin"] },
  ].filter(item => item.roles.includes(user?.role));

  const toggle = () => setIsOpen(!isOpen);

  const sidebarStyle = {
    position: "fixed",
    left: 0,
    top: 0,
    bottom: 0,
    width: isOpen ? "260px" : "70px",
    background: "rgba(255, 255, 255, 0.85)",
    backdropFilter: "blur(12px)",
    borderRight: `1px solid ${M.brdN}`,
    transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
    zIndex: 1000,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "10px 0 30px rgba(0,0,0,0.03)",
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
  });

  return (
    <>
      {/* HAMBURGER BUTTON */}
      <button 
        onClick={toggle}
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
          transition: "transform 0.2s",
        }}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
      >
        {isOpen ? "✕" : "☰"}
      </button>

      <div style={sidebarStyle}>
        <div style={{ padding: "80px 20px 30px", textAlign: isOpen ? "left" : "center" }}>
          {isOpen && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: M.pri }}>MARIN</div>
              <div style={{ fontSize: 10, color: M.txM, textTransform: "uppercase", letterSpacing: 1 }}>{user?.role}</div>
            </div>
          )}
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
              {isOpen && <span style={{ marginLeft: 12, fontSize: 14, fontWeight: 600 }}>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: "20px 0", borderTop: `1px solid ${M.brdN}` }}>
          <button 
            onClick={onSwitchUser}
            className="nav-item"
            style={{ width: "calc(100% - 15px)", padding: "12px 22px", textAlign: "left", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", color: "#374151" }}
          >
            <span style={{ fontSize: 18, minWidth: 30 }}>🔄</span>
            {isOpen && <span style={{ marginLeft: 12, fontSize: 13, fontWeight: 600 }}>Trocar Usuário</span>}
          </button>
          
          <button 
            onClick={onLogout}
            className="nav-item"
            style={{ width: "calc(100% - 15px)", padding: "12px 22px", textAlign: "left", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", color: "#dc2626" }}
          >
            <span style={{ fontSize: 18, minWidth: 30 }}>🚪</span>
            {isOpen && <span style={{ marginLeft: 12, fontSize: 13, fontWeight: 800 }}>Sair</span>}
          </button>
        </div>
      </div>

      {/* OVERLAY FOR MOBILE */}
      {isOpen && (
        <div 
          onClick={toggle}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.1)",
            zIndex: 999,
          }}
        />
      )}
    </>
  );
}
