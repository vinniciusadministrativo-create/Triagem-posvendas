import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import logoMarin from "../assets/logo_marin.png";

const M = {
  pri: "#9B1B30", tx: "#1a1a1a", txM: "#6b6560", brdN: "#e5e0db",
  glow: "rgba(155,27,48,0.30)", ok: "#16a34a", okS: "rgba(22,163,74,0.08)",
  okB: "rgba(22,163,74,0.25)", err: "#dc2626", errS: "rgba(220,38,38,0.08)",
};

const inputStyle = { width: "100%", padding: "10px 12px", border: `1px solid ${M.brdN}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", outline: "none" };
const labelStyle = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: M.txM, display: "block", marginBottom: 5 };
const linkBtn = { background: "none", border: "none", color: M.pri, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: "inherit" };
const primaryBtn = (loading) => ({ width: "100%", padding: 13, background: loading ? "#c0869a" : M.pri, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: `0 4px 16px ${M.glow}` });

function Card({ subtitle, children }) {
  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${M.pri} 0%, #5E1220 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Plus Jakarta Sans', sans-serif", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "36px 32px", width: "100%", maxWidth: 400, boxShadow: "0 24px 80px rgba(0,0,0,0.25)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <img src={logoMarin} alt="Marin Logística" style={{ width: 180, height: "auto", borderRadius: 6, marginBottom: 14 }} />
          <div style={{ fontSize: 18, fontWeight: 800, color: M.tx }}>Redefinir senha</div>
          {subtitle && <div style={{ fontSize: 12, color: M.txM, marginTop: 4 }}>{subtitle}</div>}
        </div>
        {children}
      </div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@500;600&display=swap');`}</style>
    </div>
  );
}

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const email = (params.get("email") || "").trim();
  const navigate = useNavigate();

  const [step, setStep] = useState("code");     // "code" | "password"
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [done, setDone] = useState(false);

  const errorBox = error && <div style={{ background: M.errS, border: `1px solid ${M.err}30`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: M.err, marginBottom: 16 }}>{error}</div>;
  const infoBox = info && <div style={{ background: M.okS, border: `1px solid ${M.okB}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: M.tx, marginBottom: 16 }}>✅ {info}</div>;
  const backToLogin = (
    <div style={{ textAlign: "center", marginTop: 16 }}>
      <button type="button" onClick={() => navigate("/login")} style={linkBtn}>← Voltar ao login</button>
    </div>
  );

  // ── Sem e-mail no fluxo (acesso direto) ──
  if (!email) {
    return (
      <Card>
        <div style={{ background: M.errS, border: `1px solid ${M.err}30`, borderRadius: 8, padding: "12px 14px", fontSize: 13, color: M.err, marginBottom: 16 }}>
          Inicie a redefinição pela tela de login (em "Esqueci minha senha").
        </div>
        <button type="button" onClick={() => navigate("/login")} style={primaryBtn(false)}>Ir para o login</button>
      </Card>
    );
  }

  // ── Sucesso ──
  if (done) {
    return (
      <Card subtitle="Tudo certo!">
        <div style={{ background: M.okS, border: `1px solid ${M.okB}`, borderRadius: 8, padding: "14px 16px", fontSize: 13, color: M.tx, marginBottom: 16, lineHeight: 1.5 }}>
          ✅ Senha redefinida com sucesso. Você já pode fazer login com a nova senha.
        </div>
        <button type="button" onClick={() => navigate("/login")} style={primaryBtn(false)}>Ir para o login</button>
      </Card>
    );
  }

  // ── PASSO 1: DIGITAR O CÓDIGO ──
  const submitCode = async (e) => {
    e.preventDefault();
    setError("");
    if (code.trim().length !== 6) return setError("Informe o código de 6 dígitos enviado por e-mail.");
    setLoading(true);
    try {
      await api.verifyCode(email, code.trim());
      setInfo(""); setError(""); setStep("password");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError(""); setInfo(""); setLoading(true);
    try {
      await api.forgotPassword(email);
      setInfo("Enviamos um novo código para o seu e-mail.");
      setCode("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (step === "code") {
    return (
      <Card subtitle="Digite o código enviado por e-mail">
        <form onSubmit={submitCode}>
          <p style={{ fontSize: 12.5, color: M.txM, margin: "0 0 16px", lineHeight: 1.5 }}>
            Enviamos um código de 6 dígitos para <b>{email}</b>. O código expira em 15 minutos. Verifique também o spam.
          </p>
          {infoBox}
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Código de 6 dígitos</label>
            <input type="text" inputMode="numeric" value={code} maxLength={6}
              onChange={e => setCode(e.target.value.replace(/\D/g, ""))} required autoFocus placeholder="000000"
              style={{ ...inputStyle, letterSpacing: 8, fontSize: 20, textAlign: "center", fontFamily: "'IBM Plex Mono', monospace" }} />
          </div>
          {errorBox}
          <button type="submit" disabled={loading} style={primaryBtn(loading)}>{loading ? "Verificando..." : "Continuar"}</button>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
            <button type="button" onClick={resend} disabled={loading} style={linkBtn}>Reenviar código</button>
            <button type="button" onClick={() => navigate("/login")} style={linkBtn}>← Voltar ao login</button>
          </div>
        </form>
      </Card>
    );
  }

  // ── PASSO 2: REDEFINIÇÃO (NOVA SENHA) ──
  const submitPassword = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("A nova senha deve ter no mínimo 8 caracteres.");
    if (password !== confirm) return setError("As senhas não coincidem.");
    setLoading(true);
    try {
      await api.resetPassword(email, code.trim(), password);
      setDone(true);
    } catch (err) {
      setError(err.message);
      // Se o código expirou/estourou tentativas, volta ao passo do código
      if (/inválido|expirad|tentativas/i.test(err.message)) setStep("code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card subtitle="Crie a sua nova senha">
      <form onSubmit={submitPassword}>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Nova senha</label>
          <div style={{ position: "relative" }}>
            <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required autoFocus
              placeholder="Mínimo 8 caracteres" style={{ ...inputStyle, paddingRight: 42 }} />
            <button type="button" onClick={() => setShowPw(s => !s)} aria-label={showPw ? "Ocultar senha" : "Mostrar senha"} title={showPw ? "Ocultar senha" : "Mostrar senha"}
              style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 4, lineHeight: 1 }}>
              {showPw ? "🙈" : "👁️"}
            </button>
          </div>
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Confirmar nova senha</label>
          <input type={showPw ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)} required
            placeholder="Repita a senha" style={inputStyle} />
        </div>
        {errorBox}
        <button type="submit" disabled={loading} style={primaryBtn(loading)}>{loading ? "Salvando..." : "Redefinir senha"}</button>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
          <button type="button" onClick={() => { setStep("code"); setError(""); }} style={linkBtn}>← Voltar ao código</button>
          <button type="button" onClick={() => navigate("/login")} style={linkBtn}>Cancelar</button>
        </div>
      </form>
    </Card>
  );
}
