import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import './index.css'
import LoginPage from './pages/LoginPage.jsx'
import VendedorPage from './pages/VendedorPage.jsx'
import PosVendasPage from './pages/PosVendasPage.jsx'
import HistoricoPage from './pages/HistoricoPage.jsx'
import Layout from './Layout.jsx'
import AdminPage from './pages/AdminPage.jsx'

function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();
  const token = localStorage.getItem('token');
  const user = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); }
    catch { return {}; }
  })();

  if (!token || !user?.role) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'vendedor') return <Navigate to="/formulario" replace />;
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
        </Route>

        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
