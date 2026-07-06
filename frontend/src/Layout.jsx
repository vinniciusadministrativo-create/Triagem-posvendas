import React from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";

export default function Layout() {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
  const navigate = useNavigate();

  React.useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

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
      {/* Overlay escurece fundo quando sidebar abre no mobile */}
      {isMobile && isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 999,
          }}
        />
      )}
      <main style={{
        flex: 1,
        minWidth: 0,
        minHeight: "100vh",
        position: "relative",
        overflowX: "hidden",
        paddingLeft: isMobile ? "0px" : (isSidebarOpen ? "260px" : "0px"),
        transition: "padding-left 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
      }}>
        <div key={location.pathname} className="page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  );
}