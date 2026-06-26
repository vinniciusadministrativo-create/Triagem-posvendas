import { createContext, useContext, useState, useCallback, useRef } from "react";

const ToastContext = createContext(null);

const ICONS = { success: "✓", error: "✕", warning: "⚠", info: "ℹ" };
const COLORS = {
  success: { bg: "#16a34a", light: "#dcfce7", border: "#86efac" },
  error:   { bg: "#dc2626", light: "#fee2e2", border: "#fca5a5" },
  warning: { bg: "#d97706", light: "#fef3c7", border: "#fcd34d" },
  info:    { bg: "#2563eb", light: "#dbeafe", border: "#93c5fd" },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts(p => p.map(t => t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 350);
  }, []);

  const toast = useCallback((message, type = "info", duration = 4000) => {
    const id = ++idRef.current;
    setToasts(p => [...p, { id, message, type, leaving: false }]);
    setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  toast.success = (msg, dur) => toast(msg, "success", dur);
  toast.error   = (msg, dur) => toast(msg, "error",   dur || 6000);
  toast.warning = (msg, dur) => toast(msg, "warning", dur);
  toast.info    = (msg, dur) => toast(msg, "info",    dur);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 99999,
        display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end",
        pointerEvents: "none",
      }}>
        {toasts.map(t => {
          const c = COLORS[t.type] || COLORS.info;
          return (
            <div
              key={t.id}
              style={{
                pointerEvents: "all",
                display: "flex", alignItems: "flex-start", gap: 10,
                background: "#fff",
                border: `1px solid ${c.border}`,
                borderLeft: `4px solid ${c.bg}`,
                borderRadius: 10,
                padding: "12px 14px",
                minWidth: 260, maxWidth: 360,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: 13,
                animation: t.leaving
                  ? "toastOut 0.35s ease forwards"
                  : "toastIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards",
                cursor: "pointer",
              }}
              onClick={() => dismiss(t.id)}
            >
              <span style={{
                width: 20, height: 20, borderRadius: "50%",
                background: c.bg, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 800, flexShrink: 0, marginTop: 1,
              }}>
                {ICONS[t.type]}
              </span>
              <span style={{ flex: 1, color: "#1a1a1a", lineHeight: 1.5 }}>{t.message}</span>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(60px) scale(0.95); }
          to   { opacity: 1; transform: translateX(0)    scale(1);    }
        }
        @keyframes toastOut {
          from { opacity: 1; transform: translateX(0)    scale(1);    }
          to   { opacity: 0; transform: translateX(60px) scale(0.95); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
