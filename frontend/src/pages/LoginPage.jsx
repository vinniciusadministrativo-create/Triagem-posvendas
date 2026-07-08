import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import logoMarin from "../assets/logo_marin.png";

const M = {
  pri: "#9B1B30", priDk: "#7A1526", bg: "#fafafa",
  tx: "#1a1a1a", txM: "#6b6560", brdN: "#e5e0db",
  soft: "rgba(155,27,48,0.07)", glow: "rgba(155,27,48,0.30)",
  err: "#dc2626", errS: "rgba(220,38,38,0.08)",
};

const inputStyle = { width: "100%", padding: "10px 12px", border: `1px solid ${M.brdN}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", outline: "none" };
const labelStyle = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: M.txM, display: "block", marginBottom: 5 };
const linkBtn = { background: "none", border: "none", color: M.pri, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: "inherit" };
const primaryBtn = (loading) => ({ width: "100%", padding: 13, background: loading ? "#c0869a" : M.pri, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: `0 4px 16px ${M.glow}`, transition: "background 0.2s" });

// Ícone de olho (SVG) para o botão de mostrar/ocultar senha.
// off=true → olho riscado (senha visível, clicar para ocultar); off=false → olho aberto.
function EyeIcon({ off }) {
  const p = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  return off ? (
    <svg {...p}>
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  ) : (
    <svg {...p}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState("login");   // "login" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const { token, user } = await api.login(email, password);
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      navigate(user.role === "vendedor" ? "/formulario" : "/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await api.forgotPassword(email);
      // Vai para a página dedicada de código/redefinição levando o e-mail
      navigate(`/reset-password?email=${encodeURIComponent(email.trim())}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${M.pri} 0%, #5E1220 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Plus Jakarta Sans', sans-serif", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "36px 32px", width: "100%", maxWidth: 400, boxShadow: "0 24px 80px rgba(0,0,0,0.25)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <img src={logoMarin} alt="Marin Logística" style={{ width: 200, height: "auto", borderRadius: 6, marginBottom: 16 }} />
          <div style={{ fontSize: 18, fontWeight: 800, color: M.tx }}>Triagem Pós-Vendas</div>
          <div style={{ fontSize: 12, color: M.txM, marginTop: 4 }}>
            {mode === "login" ? "Faça login para continuar" : "Recupere o acesso à sua conta"}
          </div>
        </div>

        {/* ── LOGIN ── */}
        {mode === "login" && (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus
                placeholder="seu@marinlog.com.br" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={labelStyle}>Senha</label>
              <div style={{ position: "relative" }}>
                <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="••••••••" style={{ ...inputStyle, paddingRight: 42 }} />
                <button type="button" onClick={() => setShowPw(s => !s)} aria-label={showPw ? "Ocultar senha" : "Mostrar senha"} title={showPw ? "Ocultar senha" : "Mostrar senha"}
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4, lineHeight: 0, color: M.txM, display: "flex", alignItems: "center" }}>
                  <EyeIcon off={showPw} />
                </button>
              </div>
            </div>
            <div style={{ textAlign: "right", marginBottom: 18 }}>
              <button type="button" onClick={() => { setMode("forgot"); setError(""); }} style={linkBtn}>Esqueci minha senha</button>
            </div>
            {error && <div style={{ background: M.errS, border: `1px solid ${M.err}30`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: M.err, marginBottom: 16 }}>{error}</div>}
            <button type="submit" disabled={loading} style={primaryBtn(loading)}>{loading ? "Entrando..." : "Entrar"}</button>
          </form>
        )}

        {/* ── FORGOT: PEDIR CÓDIGO ── */}
        {mode === "forgot" && (
          <form onSubmit={handleSendCode}>
            <p style={{ fontSize: 13, color: M.txM, margin: "0 0 16px", lineHeight: 1.5 }}>
              Informe o e-mail da sua conta. Se ele estiver cadastrado, enviaremos um <b>código de 6 dígitos</b> para você criar uma nova senha.
            </p>
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus
                placeholder="seu@marinlog.com.br" style={inputStyle} />
            </div>
            {error && <div style={{ background: M.errS, border: `1px solid ${M.err}30`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: M.err, marginBottom: 16 }}>{error}</div>}
            <button type="submit" disabled={loading} style={primaryBtn(loading)}>{loading ? "Enviando..." : "Enviar código"}</button>
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button type="button" onClick={() => { setMode("login"); setError(""); }} style={linkBtn}>← Voltar ao login</button>
            </div>
          </form>
        )}

        {/* Sem auto-registro: contas são criadas pelo administrador */}
        <div style={{ textAlign: "center", marginTop: 24, paddingTop: 16, borderTop: `1px solid ${M.brdN}`, fontSize: 11, color: M.txM }}>
          Sem acesso? Fale com o administrador do sistema.
        </div>
      </div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');`}</style>
    </div>
  );
}
