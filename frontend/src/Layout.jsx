import React from "react";
import { Outlet, Navigate, useNavigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";

export default function Layout() {
  const navigate = useNavigate();
  const user = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); }
    catch { return {}; }
  })();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = "/login";
  };

  const handleSwitchUser = () => {
    // Apenas redireciona para o login sem limpar tudo, permitindo trocar conta
    navigate("/login");
  };

  return (
    <div style={{ display: "flex" }}>
      <Sidebar 
        user={user} 
        onLogout={handleLogout} 
        onSwitchUser={handleSwitchUser} 
      />
      <main style={{ flex: 1, minHeight: "100vh", position: "relative" }}>
        <Outlet />
      </main>
    </div>
  );
}
