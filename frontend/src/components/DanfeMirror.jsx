import React, { useState, useEffect } from "react";
import { api } from "../api";

const M = {
  pri: "#9B1B30",
  bg: "#fafafa",
  tx: "#1a1a1a",
  txM: "#6b6560",
  txD: "#9a948d",
  brdN: "#e5e0db",
};

// --- HELPERS ---

function parseNum(val) {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return val;
  let s = String(val).replace(/[^\d.,-]/g, "").trim();
  if (!s) return 0;

  // Se houver vírgula, ela é o decimal. Pontos são milhares.
  if (s.includes(",")) {
    return parseFloat(s.replace(/\./g, "").replace(",", "."));
  }
  
  // Se só houver ponto:
  // Se tiver exatamente 3 dígitos após o ponto (ex: 1.000), tratamos como milhar.
  if (s.includes(".")) {
    const parts = s.split(".");
    if (parts[parts.length - 1].length === 3 && parts[0].length >= 1) {
      return parseFloat(s.replace(/\./g, ""));
    }
    return parseFloat(s);
  }

  return parseFloat(s);
}

function fmtBR(num) {
  if (isNaN(num) || num === null || num === undefined) return "0,00";
  const parts = Number(num).toFixed(2).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return parts.join(",");
}

const BxInput = ({ label, value, onChange, style = {} }) => (
  <div style={{ border: "1px solid #000", padding: "2px 4px", fontSize: "7.5px", minHeight: "22px", display: "flex", flexDirection: "column", boxSizing: "border-box", ...style }}>
    <div style={{ fontSize: "6px", fontWeight: "700", textTransform: "uppercase", marginBottom: "1px" }}>{label}</div>
    <input 
      value={value || ""} 
      onChange={(e) => onChange(e.target.value)}
      style={{ fontSize: "9px", fontWeight: "500", fontFamily: "monospace", border: "none", outline: "none", background: "#fff9c4", width: "100%", padding: 0 }}
    />
  </div>
);

const BxView = ({ label, value, style = {} }) => (
  <div style={{ border: "1px solid #000", padding: "2px 4px", fontSize: "7.5px", minHeight: "22px", display: "flex", flexDirection: "column", boxSizing: "border-box", ...style }}>
    <div style={{ fontSize: "6px", fontWeight: "700", textTransform: "uppercase", marginBottom: "1px" }}>{label}</div>
    <div style={{ fontSize: "9px", fontWeight: "500", fontFamily: "monospace", flex: 1, display: "flex", alignItems: "center" }}>{value || "—"}</div>
  </div>
);

// --- COMPONENT ---

export default function DanfeMirror({ nf: nfRaw, chamado }) {
  const [isEditing, setIsEditing] = useState(false);
  const [localNF, setLocalNF] = useState({});
  const [origProds, setOrigProds] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!nfRaw) return;
    let nf = nfRaw;
    if (typeof nf === "string") {
      try { nf = JSON.parse(nf); } catch(e) { nf = {}; }
    }
    const parsed = nf || {};
    
    setLocalNF(prev => {
      if (prev.produtos && prev.produtos.length > 0 && chamado?.id === prev.chamado_id_ref) return prev;
      const initial = { ...parsed, chamado_id_ref: chamado?.id };
      return recalc(initial);
    });

    if (Array.isArray(parsed.produtos)) {
      setOrigProds(parsed.produtos.map(p => ({ ...p })));
    }
  }, [nfRaw, chamado?.id]);

  // RECALCULADOR CENTRAL - Rigoroso e Reativo
  const recalc = (state, updatedProds = null) => {
    const products = updatedProds || state.produtos || [];
    
    // 1. Totais dos Itens (Qtde * Unitário) com arredondamento de 2 casas
    let sumProds = 0;
    const nextProds = products.map(p => {
      const q = parseNum(p.quantidade);
      const u = parseNum(p.valor_unitario);
      const rowTotal = Number((q * u).toFixed(2));
      sumProds += rowTotal;
      return { ...p, valor_total: fmtBR(rowTotal) };
    });

    // 2. Base e Valor ICMS (Geralmente igual ao total dos produtos em devoluções 12%)
    const baseIcms = Number(sumProds.toFixed(2));
    const valorIcms = Number((baseIcms * 0.12).toFixed(2));

    // 3. Componentes do Total da Nota
    // Impostos Aditivos (ST e IPI)
    const st = parseNum(state.valor_icms_st);
    const ipi = parseNum(state.valor_ipi);
    
    // Despesas Aditivas
    const frete = parseNum(state.valor_frete);
    const seguro = parseNum(state.valor_seguro);
    const outras = parseNum(state.outras_despesas);
    
    // Redutores
    const desc = parseNum(state.desconto);
    
    // 4. FÓRMULA FINAL: PROD + ST + IPI + FRETE + SEGURO + OUTRAS - DESCONTO
    const totalNota = Number((sumProds + st + ipi + frete + seguro + outras - desc).toFixed(2));

    return {
      ...state,
      produtos: nextProds,
      valor_total_produtos: fmtBR(sumProds),
      base_icms: fmtBR(baseIcms),
      valor_icms: fmtBR(valorIcms),
      valor_total_nota: fmtBR(totalNota)
    };
  };

  const upd = (f, v) => {
    setLocalNF(prev => recalc({ ...prev, [f]: v }));
  };

  const updProd = (i, f, v) => {
    setLocalNF(prev => {
      const ps = [...(prev.produtos || [])];
      if (!ps[i]) return prev;
      ps[i] = { ...ps[i], [f]: v };
      return recalc(prev, ps);
    });
  };

  const removeProd = (i) => {
    setLocalNF(prev => {
      const ps = (prev.produtos || []).filter((_, idx) => idx !== i);
      return recalc(prev, ps);
    });
  };

  const addProd = () => {
    setLocalNF(prev => {
      const ps = [...(prev.produtos || []), {
        codigo: "", descricao: "", ncm: "", cst: "000", cfop: "5202", unidade: "UN", quantidade: "0", valor_unitario: "0,00", valor_total: "0,00"
      }];
      return recalc(prev, ps);
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.updateNFData(chamado.id, localNF);
      alert("Sucesso!");
      setIsEditing(false);
      setOrigProds((localNF.produtos || []).map(p => ({ ...p })));
    } catch (e) {
      alert("Erro: " + e.message);
    } finally { setSaving(false); }
  };

  const d = {
    ...localNF,
    razao_social_dest: localNF.razao_social_dest || localNF.cliente || chamado?.razao_social || "",
    cnpj_dest: localNF.cnpj_dest || localNF.cnpj || chamado?.cnpj || "",
    natureza_operacao: localNF.natureza_operacao || "5202 - DEVOLUÇÃO",
    produtos: localNF.produtos || [{}]
  };

  const now = new Date();
  const footerMsg = `ESPELHO NFD REF.NF-${chamado?.nf_original || ""} - CFOP 5202`;

  return (
    <div className="danfe-container" style={{ marginTop: 20 }}>
      <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12, gap: 10 }}>
        {isEditing ? (
          <>
            <button onClick={() => setIsEditing(false)} style={{ padding: "8px 20px", background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
            <button onClick={save} disabled={saving} style={{ padding: "8px 24px", background: M.pri, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>{saving ? "Salvando..." : "💾 Salvar"}</button>
          </>
        ) : (
          <>
            <button onClick={() => setIsEditing(true)} style={{ padding: "8px 20px", background: "#fff", border: `1px solid #ddd`, borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>✏️ Editar</button>
            <button onClick={() => window.print()} style={{ padding: "8px 24px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>🖨️ Imprimir (A4)</button>
          </>
        )}
      </div>

      <div id="danfe-print" style={{ background: "#fff", padding: "8mm", color: "#000", fontFamily: "Arial, sans-serif", position: "relative", width: "210mm", height: "297mm", minHeight: "297mm", boxSizing: "border-box", margin: "0 auto", border: "1px solid #000" }}>
        
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%) rotate(-35deg)", fontSize: "60px", fontWeight: "900", color: "rgba(0,0,0,0.02)", pointerEvents: "none", zIndex: 0, textAlign: "center", width: "100%" }}>
          NÃO TEM VALOR FISCAL<br/>DOCUMENTO PARA CONFERÊNCIA
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", border: "1px solid #000", marginBottom: "4px" }}>
            <div style={{ padding: "10px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", borderRight: "1px solid #000" }}>
              <div style={{ fontSize: "12px", fontWeight: "900", textAlign: "center" }}>MARIN LOGISTICA E COMERCIO LTDA</div>
            </div>
            <div style={{ padding: "6px", fontSize: "7px", textAlign: "center", borderRight: "1px solid #000", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              R VALDO GERLACH, 07<br/>CEP: 88104-743 - SÃO JOSÉ - SC
            </div>
            <div style={{ padding: "10px", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontSize: "14px", fontWeight: "900" }}>ESPELHO</div>
              <div style={{ fontSize: "7px", marginTop: "4px" }}>DANFE</div>
            </div>
          </div>

          <div style={{ border: "1px solid #000", borderTop: "none", marginBottom: "4px" }}>
            {isEditing ? <BxInput label="Natureza da Operação" value={d.natureza_operacao} onChange={v => upd("natureza_operacao", v)} /> : <BxView label="Natureza da Operação" value={d.natureza_operacao} />}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
              <BxView label="I.E." value="261935348" style={{ borderTop: "none", borderLeft: "none" }} />
              <BxView label="I.E. ST" value="-" style={{ borderTop: "none" }} />
              <BxView label="CNPJ" value="04.002.562/0004-78" style={{ borderTop: "none", borderRight: "none" }} />
            </div>
          </div>

          <div style={{ fontSize: "7px", fontWeight: "800", padding: "4px 0 2px 2px" }}>DESTINATÁRIO / REMETENTE</div>
          <div style={{ border: "1px solid #000", marginBottom: "4px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1.5fr" }}>
              {isEditing ? (
                <><BxInput label="Razão Social" value={d.razao_social_dest} onChange={v => upd("razao_social_dest", v)} style={{ border: "none", borderRight: "1px solid #000" }} /><BxInput label="CNPJ" value={d.cnpj_dest} onChange={v => upd("cnpj_dest", v)} style={{ border: "none" }} /></>
              ) : (
                <><BxView label="Razão Social" value={d.razao_social_dest} style={{ border: "none", borderRight: "1px solid #000" }} /><BxView label="CNPJ" value={d.cnpj_dest} style={{ border: "none" }} /></>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr 0.5fr 0.5fr", borderTop: "1px solid #000" }}>
              {isEditing ? (
                <><BxInput label="Endereço" value={d.endereco_dest} onChange={v => upd("endereco_dest", v)} style={{ border: "none", borderRight: "1px solid #000" }} /><BxInput label="Bairro" value={d.bairro_dest} onChange={v => upd("bairro_dest", v)} style={{ border: "none", borderRight: "1px solid #000" }} /><BxInput label="CEP" value={d.cep_dest} onChange={v => upd("cep_dest", v)} style={{ border: "none", borderRight: "1px solid #000" }} /><BxView label="Emissão" value={d.data_emissao || now.toLocaleDateString("pt-BR")} style={{ border: "none" }} /></>
              ) : (
                <><BxView label="Endereço" value={d.endereco_dest} style={{ border: "none", borderRight: "1px solid #000" }} /><BxView label="Bairro" value={d.bairro_dest} style={{ border: "none", borderRight: "1px solid #000" }} /><BxView label="CEP" value={d.cep_dest} style={{ border: "none", borderRight: "1px solid #000" }} /><BxView label="Emissão" value={d.data_emissao || now.toLocaleDateString("pt-BR")} style={{ border: "none" }} /></>
              )}
            </div>
          </div>

          <div style={{ fontSize: "7px", fontWeight: "800", padding: "4px 0 2px 2px" }}>CÁLCULO DO IMPOSTO</div>
          <div style={{ border: "1px solid #000", marginBottom: "4px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr" }}>
              {isEditing ? (
                <><BxInput label="Base ICMS" value={d.base_icms} onChange={v => upd("base_icms", v)} style={{ border: "none", borderRight: "1px solid #000" }} /><BxInput label="Valor ICMS" value={d.valor_icms} onChange={v => upd("valor_icms", v)} style={{ border: "none", borderRight: "1px solid #000" }} /><BxInput label="Base ICMS ST" value={d.base_icms_st} onChange={v => upd("base_icms_st", v)} style={{ border: "none", borderRight: "1px solid #000" }} /><BxInput label="Valor ICMS ST" value={d.valor_icms_st} onChange={v => upd("valor_icms_st", v)} style={{ border: "none", borderRight: "1px solid #000" }} /><BxView label="Total Prod" value={d.valor_total_produtos} style={{ border: "none" }} /></>
              ) : (
                <><BxView label="Base ICMS" value={d.base_icms} style={{ border: "none", borderRight: "1px solid #000" }} /><BxView label="Valor ICMS" value={d.valor_icms} style={{ border: "none", borderRight: "1px solid #000" }} /><BxView label="Base ICMS ST" value={d.base_icms_st} style={{ border: "none", borderRight: "1px solid #000" }} /><BxView label="Valor ICMS ST" value={d.valor_icms_st} style={{ border: "none", borderRight: "1px solid #000" }} /><BxView label="Total Prod" value={d.valor_total_produtos} style={{ border: "none" }} /></>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr", borderTop: "1px solid #000" }}>
              {isEditing ? (
                <><BxInput label="Frete" value={d.valor_frete} onChange={v => upd("valor_frete", v)} style={{ border: "none", borderRight: "1px solid #000" }} /><BxInput label="Seguro" value={d.valor_seguro} onChange={v => upd("valor_seguro", v)} style={{ border: "none", borderRight: "1px solid #000" }} /><BxInput label="Desconto" value={d.desconto} onChange={v => upd("desconto", v)} style={{ border: "none", borderRight: "1px solid #000" }} /><BxInput label="Outras" value={d.outras_despesas} onChange={v => upd("outras_despesas", v)} style={{ border: "none", borderRight: "1px solid #000" }} /><BxInput label="IPI" value={d.valor_ipi} onChange={v => upd("valor_ipi", v)} style={{ border: "none", borderRight: "1px solid #000" }} /><BxView label="Total Nota" value={d.valor_total_nota} style={{ border: "none" }} /></>
              ) : (
                <><BxView label="Frete" value={d.valor_frete} style={{ border: "none", borderRight: "1px solid #000" }} /><BxView label="Seguro" value={d.valor_seguro} style={{ border: "none", borderRight: "1px solid #000" }} /><BxView label="Desconto" value={d.desconto} style={{ border: "none", borderRight: "1px solid #000" }} /><BxView label="Outras" value={d.outras_despesas} style={{ border: "none", borderRight: "1px solid #000" }} /><BxView label="IPI" value={d.valor_ipi} style={{ border: "none", borderRight: "1px solid #000" }} /><BxView label="Total Nota" value={d.valor_total_nota} style={{ border: "none" }} /></>
              )}
            </div>
          </div>

          <div style={{ fontSize: "7px", fontWeight: "800", padding: "4px 0 2px 2px" }}>DADOS DOS PRODUTOS</div>
          <div style={{ border: "1px solid #000", borderBottom: "none" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <thead>
                <tr style={{ height: "14px", borderBottom: "1px solid #000", background: "#f5f5f5" }}>
                  {isEditing && <th style={{ width: "20px" }}></th>}
                  {[
                    {h:"CÓD.", w:"10%"}, {h:"DESCRIÇÃO", w:"36%"}, {h:"NCM", w:"9%"}, {h:"CST", w:"5%"}, {h:"CFOP", w:"6%"}, {h:"UN", w:"5%"}, {h:"QTDE", w:"8%"}, {h:"UNIT", w:"10%"}, {h:"TOTAL", w:"11%"}
                  ].map(c => (
                    <th key={c.h} style={{ fontSize: "6px", fontWeight: "700", borderRight: "1px solid #000", padding: "1px", textAlign: "center", width: c.w }}>{c.h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.produtos.map((p, i) => (
                  <tr key={i} style={{ minHeight: "14px", borderBottom: "1px solid #000" }}>
                    {isEditing && <td style={{ textAlign: "center", borderRight: "1px solid #000" }}><button onClick={() => removeProd(i)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "8px" }}>❌</button></td>}
                    {["codigo","descricao","ncm","cst","cfop","unidade","quantidade","valor_unitario","valor_total"].map(f => (
                      <td key={f} style={{ fontSize: "7.5px", padding: "2px", borderRight: "1px solid #000", textAlign: ["quantidade","valor_unitario","valor_total"].includes(f) ? "right" : "left" }}>
                        {isEditing && f !== "valor_total" ? (
                          <input value={p[f] || ""} onChange={e => updProd(i, f, e.target.value)} style={{ fontSize: "7.5px", width: "100%", border: "none", background: ["quantidade","valor_unitario"].includes(f) ? "#fff9c4" : "transparent", padding: 0 }} />
                        ) : (
                          <span>{p[f] || (f === "valor_total" ? "0,00" : "-")}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {isEditing && <button onClick={addProd} style={{ fontSize: "8px", margin: "4px", cursor: "pointer" }}>➕ Item</button>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", border: "1px solid #000", marginTop: "10px", minHeight: "60px" }}>
            <div style={{ padding: "4px", borderRight: "1px solid #000" }}>
              <div style={{ fontSize: "6px", fontWeight: "700" }}>INFORMAÇÕES COMPLEMENTARES</div>
              <div style={{ fontSize: "7.5px" }}>{d.info_complementares || footerMsg}<br/>DEVOLUÇÃO REF. NF {chamado?.nf_original}</div>
            </div>
            <div style={{ padding: "4px", fontSize: "7px" }}>
              <div style={{ fontSize: "6px", fontWeight: "700" }}>DATA/HORA</div>
              <div>{now.toLocaleString("pt-BR")}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
