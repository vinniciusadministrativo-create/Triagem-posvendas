import React from "react";
import { Outlet, Navigate, useNavigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
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
    navigate("/login");
  };

  return (
    <div style={{ display: "flex" }}>
      <Sidebar 
        user={user} 
        onLogout={handleLogout} 
        onSwitchUser={handleSwitchUser} 
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />
      <main style={{ 
        flex: 1, 
        minHeight: "100vh", 
        position: "relative",
        paddingLeft: isSidebarOpen ? "260px" : "0px",
        transition: "padding-left 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
      }}>
        <Outlet />
      </main>
    </div>
  );
}
