import React, { useState, useEffect } from "react";
import { api } from "../api";

const M = {
  pri: "#9B1B30",
  bg: "#fafafa",
  tx: "#1a1a1a",
  txM: "#6b6560",
  txD: "#9a948d",
  brdN: "#e5e0db",
  blue: "#2563eb",
  blueS: "rgba(37,99,235,0.08)",
  blueB: "rgba(37,99,235,0.2)",
};

// Componente de Input estável para evitar perda de foco
const BxInput = ({ label, value, onChange, style = {} }) => (
  <div style={{ border: "1px solid #000", padding: "2px 4px", fontSize: "7px", minHeight: "22px", display: "flex", flexDirection: "column", boxSizing: "border-box", ...style }}>
    <div style={{ fontSize: "6px", fontWeight: "700", textTransform: "uppercase", marginBottom: "1px" }}>{label}</div>
    <input 
      value={value || ""} 
      onChange={(e) => onChange(e.target.value)}
      style={{ fontSize: "9px", fontWeight: "500", fontFamily: "monospace", border: "none", outline: "none", background: "#fff9c4", width: "100%", padding: 0 }}
    />
  </div>
);

const BxView = ({ label, value, style = {} }) => (
  <div style={{ border: "1px solid #000", padding: "2px 4px", fontSize: "7px", minHeight: "22px", display: "flex", flexDirection: "column", boxSizing: "border-box", ...style }}>
    <div style={{ fontSize: "6px", fontWeight: "700", textTransform: "uppercase", marginBottom: "1px" }}>{label}</div>
    <div style={{ fontSize: "9px", fontWeight: "500", fontFamily: "monospace", flex: 1, display: "flex", alignItems: "center" }}>{value || "—"}</div>
  </div>
);

// Helpers para cálculo
function parseNum(val) {
  if (!val && val !== 0) return 0;
  // Suporte a formato brasileiro (1.234,56) e americano (1234.56)
  const s = String(val).replace(/\./g, "").replace(",", ".");
  return parseFloat(s) || 0;
}
function fmtBR(num) {
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DanfeMirror({ nf: nfRaw, chamado }) {
  const [isEditing, setIsEditing] = useState(false);
  const [localNF, setLocalNF] = useState({});
  const [origProds, setOrigProds] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let nf = nfRaw;
    if (typeof nf === "string") {
      try { nf = JSON.parse(nf); } catch(e) { nf = {}; }
    }
    const parsed = nf || {};
    setLocalNF(parsed);
    // Guarda originais para comparação de destaque
    if (Array.isArray(parsed.produtos)) {
      setOrigProds(parsed.produtos.map(p => ({ ...p })));
    }
  }, [nfRaw]);

  // Recalcula totais gerais da nota com base nos itens
  const recalcTotals = (allProds) => {
    let sum = 0;
    allProds.forEach(p => {
      sum += parseNum(p.valor_total);
    });
    
    const formattedSum = fmtBR(sum);
    // Aqui poderíamos recalcular impostos proporcionalmente, 
    // mas o usuário pediu apenas ajuste de valor de acordo com a qtde.
    // Assim, atualizamos os totais principais.
    setLocalNF(prev => ({
      ...prev,
      produtos: allProds,
      valor_total_produtos: formattedSum,
      valor_total_nota: formattedSum // Por padrão, nota total = prod total, usuário ajusta se tiver frete/etc.
    }));
  };

  // Atualiza um campo de um produto e recalcula valor_total se quantidade ou valor_unitario mudou
  const updProd = (i, field, val, allProds) => {
    const newProds = [...allProds];
    newProds[i] = { ...newProds[i], [field]: val };

    if (field === "quantidade" || field === "valor_unitario") {
      const qtde = parseNum(field === "quantidade" ? val : newProds[i].quantidade);
      const unit = parseNum(field === "valor_unitario" ? val : newProds[i].valor_unitario);
      if (qtde >= 0 && unit >= 0) {
        newProds[i].valor_total = fmtBR(qtde * unit);
      }
      recalcTotals(newProds);
    } else {
      upd("produtos", newProds);
    }
  };

  const removeProd = (i) => {
    const newProds = localNF.produtos.filter((_, idx) => idx !== i);
    recalcTotals(newProds);
  };

  const addProd = () => {
    const newProds = [...(localNF.produtos || []), {
      codigo: "", descricao: "", ncm: "", cst: "", cfop: "5202", unidade: "UN", quantidade: "0", valor_unitario: "0,00", valor_total: "0,00"
    }];
    upd("produtos", newProds);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.updateNFData(chamado.id, localNF);
      alert("Espelho atualizado com sucesso!");
      setIsEditing(false);
      // Atualiza referência dos originais após salvar
      setOrigProds((localNF.produtos || []).map(p => ({ ...p })));
    } catch (e) {
      alert("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const d = {
    ...localNF,
    razao_social_dest: localNF.razao_social_dest || localNF.cliente || chamado?.razao_social || "",
    cnpj_dest: localNF.cnpj_dest || localNF.cnpj || chamado?.cnpj || "",
    natureza_operacao: localNF.natureza_operacao || "5202 - DEVOLUÇÃO DE COMPRA PARA COMERCIALIZAÇÃO",
    produtos: Array.isArray(localNF.produtos) ? localNF.produtos : []
  };

  // Usa todos os produtos — sem filtrar por devolvidos
  const prods = d.produtos.length > 0 ? d.produtos : [{}];
  const now = new Date();
  const footerMsg = `ESPELHO NFD REF.NF-${chamado?.nf_original || ""} - CFOP CORRETO 5202`;

  // Estilos compartilhados
  const sectionTitle = { fontSize: "7px", fontWeight: "800", textTransform: "uppercase", padding: "4px 0 2px 2px" };

  return (
    <div className="danfe-container" style={{ marginTop: 20 }}>
      {/* CONTROLES */}
      <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12, gap: 10 }}>
        {isEditing ? (
          <>
            <button onClick={() => setIsEditing(false)} style={{ padding: "8px 20px", background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
            <button onClick={save} disabled={saving} style={{ padding: "8px 24px", background: M.pri, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>{saving ? "Salvando..." : "💾 Salvar Alterações"}</button>
          </>
        ) : (
          <>
            <button onClick={() => setIsEditing(true)} style={{ padding: "8px 20px", background: "#fff", border: `1px solid ${M.brdN}`, borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>✏️ Editar Rascunho</button>
            <button onClick={() => window.print()} style={{ padding: "8px 24px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>🖨️ Imprimir Espelho (A4)</button>
          </>
        )}
      </div>

      <div id="danfe-print" style={{ background: "#fff", padding: "10mm", color: "#000", fontFamily: "Arial, sans-serif", position: "relative", width: "210mm", minHeight: "297mm", boxSizing: "border-box", margin: "0 auto", border: "1px solid #eee" }}>
        
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%) rotate(-35deg)", fontSize: "60px", fontWeight: "900", color: "rgba(0,0,0,0.03)", pointerEvents: "none", zIndex: 0, textAlign: "center", width: "100%" }}>
          NÃO TEM VALOR FISCAL<br/>DOCUMENTO PARA CONFERÊNCIA
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          {/* HEADER */}
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", border: "1px solid #000", marginBottom: "4px" }}>
            <div style={{ padding: "10px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", borderRight: "1px solid #000" }}>
              <div style={{ fontSize: "12px", fontWeight: "900", textAlign: "center" }}>MARIN LOGISTICA E COMERCIO LTDA</div>
            </div>
            <div style={{ padding: "6px", fontSize: "7px", textAlign: "center", borderRight: "1px solid #000", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              R VALDO GERLACH, 07<br/>BAIRRO: DISTRITO INDUSTRIAL<br/>CEP: 88104-743<br/>CIDADE: SÃO JOSÉ
            </div>
            <div style={{ padding: "10px", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontSize: "14px", fontWeight: "900" }}>ESPELHO</div>
              <div style={{ fontSize: "7px", marginTop: "4px" }}>Espelho Rascunho da<br/>DANFE</div>
            </div>
          </div>

          <div style={{ border: "1px solid #000", borderTop: "none", marginBottom: "4px" }}>
            {isEditing ? (
              <BxInput label="Natureza da Operação" value={d.natureza_operacao} onChange={v => upd("natureza_operacao", v)} />
            ) : (
              <BxView label="Natureza da Operação" value={d.natureza_operacao} />
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
              <BxView label="Inscrição Estadual" value="261935348" style={{ borderTop: "none", borderLeft: "none" }} />
              <BxView label="Inscrição Estadual Subst." value="-" style={{ borderTop: "none" }} />
              <BxView label="CNPJ" value="04.002.562/0004-78" style={{ borderTop: "none", borderRight: "none" }} />
            </div>
          </div>

          <div style={sectionTitle}>Destinatário / Remetente</div>
          <div style={{ border: "1px solid #000", marginBottom: "4px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1.5fr" }}>
              {isEditing ? (
                <>
                  <BxInput label="Nome / Razão Social" value={d.razao_social_dest} onChange={v => upd("razao_social_dest", v)} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxInput label="CNPJ / CPF" value={d.cnpj_dest} onChange={v => upd("cnpj_dest", v)} style={{ border: "none" }} />
                </>
              ) : (
                <>
                  <BxView label="Nome / Razão Social" value={d.razao_social_dest} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxView label="CNPJ / CPF" value={d.cnpj_dest} style={{ border: "none" }} />
                </>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr 0.5fr 0.5fr", borderTop: "1px solid #000" }}>
              {isEditing ? (
                <>
                  <BxInput label="Endereço" value={d.endereco_dest} onChange={v => upd("endereco_dest", v)} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxInput label="Bairro" value={d.bairro_dest} onChange={v => upd("bairro_dest", v)} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxInput label="CEP" value={d.cep_dest} onChange={v => upd("cep_dest", v)} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxView label="Data Emissão" value={d.data_emissao || now.toLocaleDateString("pt-BR")} style={{ border: "none" }} />
                </>
              ) : (
                <>
                  <BxView label="Endereço" value={d.endereco_dest} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxView label="Bairro" value={d.bairro_dest} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxView label="CEP" value={d.cep_dest} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxView label="Data Emissão" value={d.data_emissao || now.toLocaleDateString("pt-BR")} style={{ border: "none" }} />
                </>
              )}
            </div>
          </div>

          <div style={sectionTitle}>Cálculo do Imposto</div>
          <div style={{ border: "1px solid #000", marginBottom: "4px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr 1fr 1fr" }}>
              {isEditing ? (
                <>
                  <BxInput label="Base ICMS" value={d.base_icms} onChange={v => upd("base_icms", v)} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxInput label="Valor ICMS" value={d.valor_icms} onChange={v => upd("valor_icms", v)} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxInput label="Base ICMS ST" value={d.base_icms_st} onChange={v => upd("base_icms_st", v)} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxInput label="Valor ICMS ST" value={d.valor_icms_st} onChange={v => upd("valor_icms_st", v)} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxInput label="Vlr Total Prod" value={d.valor_total_produtos} onChange={v => upd("valor_total_produtos", v)} style={{ border: "none" }} />
                </>
              ) : (
                <>
                  <BxView label="Base ICMS" value={d.base_icms} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxView label="Valor ICMS" value={d.valor_icms} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxView label="Base ICMS ST" value={d.base_icms_st} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxView label="Valor ICMS ST" value={d.valor_icms_st} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxView label="Vlr Total Prod" value={d.valor_total_produtos} style={{ border: "none" }} />
                </>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr 1fr", borderTop: "1px solid #000" }}>
              {isEditing ? (
                <>
                  <BxInput label="Frete" value={d.valor_frete} onChange={v => upd("valor_frete", v)} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxInput label="Seguro" value={d.valor_seguro} onChange={v => upd("valor_seguro", v)} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxInput label="Desconto" value={d.desconto} onChange={v => upd("desconto", v)} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxInput label="Outras Desp." value={d.outras_despesas} onChange={v => upd("outras_despesas", v)} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxInput label="IPI" value={d.valor_ipi} onChange={v => upd("valor_ipi", v)} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxView label="IPI Devol." value="0,00" style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxInput label="Total Nota" value={d.valor_total_nota} onChange={v => upd("valor_total_nota", v)} style={{ border: "none" }} />
                </>
              ) : (
                <>
                  <BxView label="Frete" value={d.valor_frete} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxView label="Seguro" value={d.valor_seguro} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxView label="Desconto" value={d.desconto} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxView label="Outras Desp." value={d.outras_despesas} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxView label="IPI" value={d.valor_ipi} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxView label="IPI Devol." value="0,00" style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxView label="Total Nota" value={d.valor_total_nota} style={{ border: "none" }} />
                </>
              )}
            </div>
          </div>

          <div style={sectionTitle}>Transportador / Volumes Transportados</div>
          <div style={{ border: "1px solid #000", marginBottom: "4px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1.5fr 1fr" }}>
              <BxView label="Transportadora" value="MARIN LOGISTICA E COMERCIO LTDA" style={{ border: "none", borderRight: "1px solid #000" }} />
              <BxView label="Frete" value="1 - Emitente (CIF)" style={{ border: "none", borderRight: "1px solid #000" }} />
              <BxView label="CNPJ" value="04.002.562/0004-78" style={{ border: "none" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "0.5fr 1fr 1fr 1fr 1fr 1.2fr", borderTop: "1px solid #000" }}>
              {isEditing ? (
                <>
                  <BxInput label="Qtde" value={d.quantidade_volumes} onChange={v => upd("quantidade_volumes", v)} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxInput label="Espécie" value={d.especie_volumes} onChange={v => upd("especie_volumes", v)} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxView label="Marca" value="-" style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxView label="Num." value="-" style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxInput label="Peso Bruto" value={d.peso_bruto} onChange={v => upd("peso_bruto", v)} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxInput label="Peso Líquido" value={d.peso_liquido} onChange={v => upd("peso_liquido", v)} style={{ border: "none" }} />
                </>
              ) : (
                <>
                  <BxView label="Qtde" value={d.quantidade_volumes} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxView label="Espécie" value={d.especie_volumes} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxView label="Marca" value="-" style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxView label="Num." value="-" style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxView label="Peso Bruto" value={d.peso_bruto} style={{ border: "none", borderRight: "1px solid #000" }} />
                  <BxView label="Peso Líquido" value={d.peso_liquido} style={{ border: "none" }} />
                </>
              )}
            </div>
          </div>

          <div style={sectionTitle}>Dados dos Produtos / Serviços</div>
          <div style={{ border: "1px solid #000", borderBottom: "none" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <thead>
                <tr style={{ height: "14px", borderBottom: "1px solid #000" }}>
                  {isEditing && <th style={{ width: "20px", background: "#fee2e2" }}></th>}
                  {["CÓD.","DESCRIÇÃO","NCM/SH","CST","CFOP","UNID.","QTDE.","VLR. UNIT.","VLR. TOTAL"].map(h => (
                    <th key={h} style={{ fontSize: "5px", fontWeight: "700", borderRight: "1px solid #000", padding: "1px", background: "#f5f5f5", textAlign: "center" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {prods.map((p, i) => {
                  // Verifica se a quantidade foi alterada em relação ao original
                  const origQtde = origProds[i]?.quantidade;
                  const wasEdited = origQtde !== undefined && String(p.quantidade) !== String(origQtde);

                  return (
                    <tr key={i} style={{ minHeight: "14px", borderBottom: "1px solid #000", background: wasEdited ? "#fffde7" : "transparent" }}>
                      {isEditing && (
                        <td style={{ textAlign: "center", borderRight: "1px solid #000", padding: "1px" }}>
                          <button onClick={() => removeProd(i)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "8px", color: "#dc2626", padding: 0 }}>❌</button>
                        </td>
                      )}
                      {["codigo","descricao","ncm","cst","cfop","unidade","quantidade","valor_unitario","valor_total"].map(f => {
                        const isNumericField = ["quantidade","valor_unitario","valor_total"].includes(f);
                        const isReadonlyInEdit = f === "valor_total"; // valor_total é calculado automaticamente
                        return (
                          <td key={f} style={{ fontSize: "6.5px", padding: "2px", borderRight: "1px solid #000", textAlign: isNumericField ? "right" : "left" }}>
                            {isEditing ? (
                              isReadonlyInEdit ? (
                                // Valor total: somente leitura, calculado automaticamente
                                <span style={{ fontSize: "6.5px", fontWeight: "700", color: wasEdited ? "#b45309" : "#222" }}>
                                  {p.valor_total || "0,00"}
                                </span>
                              ) : (
                                <input 
                                  value={p[f] || ""} 
                                  onChange={e => updProd(i, f, e.target.value, prods)}
                                  style={{ 
                                    fontSize: "6.5px", width: "100%", border: "none", 
                                    background: ["quantidade","valor_unitario"].includes(f) ? "#fff9c4" : "#ffffff", 
                                    padding: 0,
                                    fontWeight: f === "quantidade" && wasEdited ? "700" : "normal"
                                  }} 
                                />
                              )
                            ) : (
                              <span style={{ fontWeight: wasEdited && isNumericField ? "700" : "normal", color: wasEdited && isNumericField ? "#b45309" : "inherit" }}>
                                {p[f] || (f === "valor_total" ? (p.valor_liquido || "0,00") : "-")}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {isEditing && (
              <div style={{ padding: "4px", borderTop: "1px solid #000" }}>
                <button onClick={addProd} style={{ fontSize: "8px", background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: "4px", padding: "2px 8px", cursor: "pointer", fontWeight: "700" }}>➕ Adicionar Item</button>
              </div>
            )}
          </div>

          <div style={sectionTitle}>Dados Adicionais</div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", border: "1px solid #000", minHeight: "60px" }}>
            <div style={{ padding: "4px", fontSize: "7px", borderRight: "1px solid #000" }}>
              <div style={{ fontSize: "6px", fontWeight: "700", textTransform: "uppercase", marginBottom: "1px" }}>Informações Complementares</div>
              {isEditing ? (
                <textarea 
                  value={d.info_complementares || footerMsg} 
                  onChange={e => upd("info_complementares", e.target.value)} 
                  style={{ width: "100%", border: "none", background: "#fff9c4", fontFamily: "inherit", resize: "none", height: "40px", fontSize: "7px" }} 
                />
              ) : (
                <div style={{ fontSize: "7px", lineHeight: "1.3" }}>
                  {d.info_complementares || footerMsg}<br/>
                  Vendedor: {chamado?.vendedor_nome || chamado?.nome_vendedor}<br/>
                  DEVOLUÇÃO REF. NF {chamado?.nf_original}
                </div>
              )}
            </div>
            <div style={{ padding: "4px", fontSize: "7px" }}>
              <div style={{ fontSize: "6px", fontWeight: "700", textTransform: "uppercase", marginBottom: "1px" }}>Data/Hora</div>
              <div style={{ fontSize: "6px", color: "#888" }}>{now.toLocaleString("pt-BR")}</div>
              <div style={{ fontSize: "6px", color: "#aaa", marginTop: "2px" }}>Triagem Automática Marin</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          
          /* Hide all text/elements by default but keep their physical flow to not break DOM */
          body * { visibility: hidden !important; }
          
          /* Force all containers above danfe-print to be block and 100% wide to prevent flex-box squishing */
          body, html, #root, .modal-wrapper, .modal-content, .split-view, .split-left, .danfe-container, div[style*="position: fixed"] {
             display: block !important;
             position: static !important;
             width: 100% !important;
             max-width: 100% !important;
             height: auto !important;
             max-height: none !important;
             margin: 0 !important;
             padding: 0 !important;
             overflow: visible !important;
             transform: none !important;
             border: none !important;
             box-shadow: none !important;
          }

          /* Make ONLY the danfe visible and position it perfectly */
          #danfe-print, #danfe-print * { 
            visibility: visible !important; 
          }
          #danfe-print { 
            position: absolute !important; 
            top: 0 !important; 
            left: 0 !important; 
            width: 210mm !important; 
            min-height: 297mm !important; 
            margin: 0 !important; 
            padding: 10mm !important; 
            background: #fff !important; 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
