import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

const M = {
  pri: "#9B1B30", priDk: "#7A1526", bg: "#fafafa",
  tx: "#1a1a1a", txM: "#6b6560", brdN: "#e5e0db",
  soft: "rgba(155,27,48,0.07)", glow: "rgba(155,27,48,0.30)",
  err: "#dc2626", errS: "rgba(220,38,38,0.08)",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token, user } = await api.login(email, password);
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      if (user.role === "vendedor") navigate("/formulario");
      else navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${M.pri} 0%, #5E1220 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Plus Jakarta Sans', sans-serif", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "36px 32px", width: "100%", maxWidth: 400, boxShadow: "0 24px 80px rgba(0,0,0,0.25)" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: M.pri, borderRadius: 8, padding: "6px 16px", marginBottom: 12 }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M3 16L10 3L17 16H13L10 9L7 16H3Z" fill="white"/></svg>
            <span style={{ color: "#fff", fontSize: 14, fontWeight: 800, letterSpacing: 2 }}>MARIN</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: M.tx }}>Triagem Pós-Vendas</div>
          <div style={{ fontSize: 12, color: M.txM, marginTop: 4 }}>Faça login para continuar</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: M.txM, display: "block", marginBottom: 5 }}>E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="seu@marinlog.com.br"
              style={{ width: "100%", padding: "10px 12px", border: `1px solid ${M.brdN}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: M.txM, display: "block", marginBottom: 5 }}>Senha</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              placeholder="••••••••"
              style={{ width: "100%", padding: "10px 12px", border: `1px solid ${M.brdN}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }} />
          </div>

          {error && (
            <div style={{ background: M.errS, border: `1px solid ${M.err}30`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: M.err, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ width: "100%", padding: 13, background: loading ? "#c0869a" : M.pri, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: `0 4px 16px ${M.glow}`, transition: "background 0.2s" }}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');`}</style>
    </div>
  );
}
