import { createContext, useContext, useState, useCallback, useRef } from "react";

const ConfirmContext = createContext(null);

const M = {
  pri: "#9B1B30", tx: "#1a1a1a", txM: "#6b6560", brdN: "#e5e0db",
  err: "#dc2626",
};

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { message, title, confirmLabel, cancelLabel, variant }
  const resolverRef = useRef(null);

  // confirm(message, options?) -> Promise<boolean>
  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({
        message,
        title: options.title || "Confirmar ação",
        confirmLabel: options.confirmLabel || "Confirmar",
        cancelLabel: options.cancelLabel || "Cancelar",
        variant: options.variant || "default", // "default" | "danger"
      });
    });
  }, []);

  const respond = useCallback((value) => {
    setState(null);
    if (resolverRef.current) {
      resolverRef.current(value);
      resolverRef.current = null;
    }
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => respond(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 100000, padding: 20, animation: "confirmFadeIn 0.15s ease",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 14, padding: 26, width: "100%", maxWidth: 380,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)", fontFamily: "'Plus Jakarta Sans', sans-serif",
              animation: "confirmPopIn 0.2s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 20 }}>{state.variant === "danger" ? "⚠️" : "❓"}</span>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: M.tx }}>{state.title}</h3>
            </div>
            <p style={{ margin: "0 0 22px", fontSize: 13.5, color: M.txM, lineHeight: 1.6 }}>{state.message}</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => respond(false)}
                style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: `1px solid ${M.brdN}`, background: "#fff", color: M.tx, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
              >
                {state.cancelLabel}
              </button>
              <button
                autoFocus
                onClick={() => respond(true)}
                style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "none", background: state.variant === "danger" ? M.err : M.pri, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
          <style>{`
            @keyframes confirmFadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes confirmPopIn { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
          `}</style>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside ConfirmProvider");
  return ctx;
}
