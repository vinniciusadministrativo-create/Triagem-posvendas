import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import './index.css'
import LoginPage from './pages/LoginPage.jsx'
import VendedorPage from './pages/VendedorPage.jsx'
import PosVendasPage from './pages/PosVendasPage.jsx'
import HistoricoPage from './pages/HistoricoPage.jsx'
import Layout from './Layout.jsx'
import AdminPage from './pages/AdminPage.jsx'
import ChatPage from './pages/ChatPage.jsx'
import { StrictMode, useState, useEffect } from 'react'

function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();
  const [auth, setAuth] = useState(() => {
    try {
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return { token, user };
    } catch { return { token: null, user: {} }; }
  });

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'token' || e.key === 'user') {
        try {
          setAuth({
            token: localStorage.getItem('token'),
            user: JSON.parse(localStorage.getItem('user') || '{}'),
          });
        } catch {
          setAuth({ token: null, user: {} });
        }
      }
    };
    window.addEventListener('storage', e => onStorage(e));
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  if (!auth.token || !auth.user?.role) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (allowedRoles && !allowedRoles.includes(auth.user.role)) {
    if (auth.user.role === 'vendedor') return <Navigate to="/formulario" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function RootRedirect() {
  const token = localStorage.getItem('token');
  const user = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); }
    catch { return {}; }
  })();

  if (!token || !user?.role) return <Navigate to="/login" replace />;
  if (user.role === 'vendedor') return <Navigate to="/formulario" replace />;
  return <Navigate to="/dashboard" replace />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        {/* ROTAS COM SIDEBAR */}
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<RootRedirect />} />
          <Route
            path="/formulario"
            element={
              <ProtectedRoute allowedRoles={['vendedor', 'pos_vendas', 'admin']}>
                <VendedorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/meus-chamados"
            element={
              <ProtectedRoute allowedRoles={['vendedor', 'admin']}>
                <VendedorPage defaultTab="meus" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={['pos_vendas', 'admin', 'operacional']}>
                <PosVendasPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/historico"
            element={
              <ProtectedRoute allowedRoles={['pos_vendas', 'admin']}>
                <HistoricoPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute allowedRoles={['vendedor', 'pos_vendas', 'admin', 'operacional']}>
                <ChatPage />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
