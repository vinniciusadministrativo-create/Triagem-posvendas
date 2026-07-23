import { useState } from "react";

const M = {
  pri: "#9B1B30", tx: "#1a1a1a", txM: "#4b5563", bg: "#fafafa",
  brdL: "#d5cfc8", card: "#fff",
  ok: "#16a34a", okS: "rgba(22,163,74,0.10)", okB: "rgba(22,163,74,0.45)",
  err: "#dc2626", errS: "rgba(220,38,38,0.10)", errB: "rgba(220,38,38,0.45)",
};

/**
 * Modal de encerramento do chamado. Exige uma resolução (ATENDIDO/INDEFERIDO)
 * e uma descrição — ambas obrigatórias — antes de mover para "encerrado".
 * Reutilizado no Kanban (PosVendasPage) e no seletor de status (ChamadoDetail).
 *
 * @param {(data: {resolucao: string, descricao: string}) => void} onConfirm
 * @param {() => void} onCancel
 * @param {boolean} [saving]
 */
export default function EncerramentoModal({ onConfirm, onCancel, saving = false }) {
  const [resolucao, setResolucao] = useState("");
  const [descricao, setDescricao] = useState("");

  const valido = (resolucao === "atendido" || resolucao === "indeferido") && descricao.trim().length > 0;

  const submit = (e) => {
    e.preventDefault();
    if (!valido || saving) return;
    onConfirm({ resolucao, descricao: descricao.trim() });
  };

  const optBtn = (ativo, cor, corS, corB) => ({
    flex: 1, padding: "12px 10px", borderRadius: 10, cursor: "pointer", fontWeight: 800,
    fontSize: 14, textTransform: "uppercase", letterSpacing: 0.5, transition: "all .15s",
    background: ativo ? corS : M.bg,
    border: `2px solid ${ativo ? corB : M.brdL}`,
    color: ativo ? cor : M.txM,
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
      <div style={{ background: M.card, padding: 25, borderRadius: 12, width: 420, maxWidth: "90%", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: M.tx, marginBottom: 5 }}>Encerrar Chamado</h2>
        <p style={{ fontSize: 13, color: M.txM, marginBottom: 18 }}>Informe a resolução para concluir o atendimento.</p>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: M.txM, marginBottom: 8 }}>Resolução *</label>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setResolucao("atendido")} style={optBtn(resolucao === "atendido", M.ok, M.okS, M.okB)}>
                ✓ Atendido
              </button>
              <button type="button" onClick={() => setResolucao("indeferido")} style={optBtn(resolucao === "indeferido", M.err, M.errS, M.errB)}>
                ✕ Indeferido
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: M.txM, marginBottom: 5 }}>Descrição da resolução *</label>
            <textarea
              rows={4}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva brevemente como o chamado foi resolvido..."
              style={{ width: "100%", padding: 10, borderRadius: 8, border: `1px solid ${M.brdL}`, background: M.bg, outline: "none", resize: "none", fontFamily: "inherit", fontSize: 13, boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onCancel} disabled={saving} style={{ flex: 1, padding: 11, borderRadius: 8, border: `1px solid ${M.brdL}`, background: M.bg, color: M.txM, fontWeight: 700, cursor: "pointer" }}>
              Cancelar
            </button>
            <button type="submit" disabled={!valido || saving} style={{ flex: 1, padding: 11, borderRadius: 8, border: "none", background: valido && !saving ? M.pri : "#c9b3ba", color: "#fff", fontWeight: 700, cursor: valido && !saving ? "pointer" : "not-allowed" }}>
              {saving ? "Encerrando..." : "Confirmar Encerramento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
