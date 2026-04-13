import React from "react";

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

export default function DanfeMirror({ nf: nfRaw, chamado }) {
  let nf = nfRaw;
  if (typeof nf === "string") {
    try { nf = JSON.parse(nf); } catch(e) { nf = {}; }
  }
  nf = nf || {};

  const d = {
    ...nf,
    razao_social_dest: nf.razao_social_dest || nf.cliente || chamado?.razao_social || "N/A",
    cnpj_dest: nf.cnpj_dest || nf.cnpj || chamado?.cnpj || "N/A",
    endereco_dest: nf.endereco_dest || nf.endereco || "N/A",
    natureza_operacao: nf.natureza_operacao || "1202 - DEVOLUÇÃO DE VENDA DE MERCADORIA",
    base_icms: nf.base_icms || "0,00",
    valor_icms: nf.valor_icms || "0,00",
    base_icms_st: nf.base_icms_st || "0,00",
    valor_icms_st: nf.valor_icms_st || "0,00",
    valor_total_produtos: nf.valor_total_produtos || nf.total_produtos || "0,00",
    valor_total_nota: nf.valor_total_nota || nf.total_nota || nf.valor_total || "0,00",
    valor_frete: nf.valor_frete || "0,00",
    valor_seguro: nf.valor_seguro || "0,00",
    valor_ipi: nf.valor_ipi || "0,00",
    outras_despesas: nf.outras_despesas || "0,00",
    desconto: nf.desconto || "0,00",
    placa_veiculo: nf.placa_veiculo || "-",
    placa_uf: nf.placa_uf || "-",
    quantidade_volumes: nf.quantidade_volumes || "",
    especie_volumes: nf.especie_volumes || "",
    peso_bruto: nf.peso_bruto || "",
    peso_liquido: nf.peso_liquido || "",
    produtos: Array.isArray(nf.produtos) ? nf.produtos : []
  };

  const prods = d.produtos.length > 0 ? d.produtos : [{}];
  const now = new Date();
  const footerMsg = `ESPELHO NFD REF.NF-${chamado?.nf_original || ""} - CFOP CORRETO 5202`;

  const handlePrint = () => {
    window.print();
  };

  // Styles do Modelo Profissional
  const boxStyle = { border: "1px solid #000", padding: "2px 4px", fontSize: "7px", minHeight: "22px", display: "flex", flexDirection: "column", boxSizing: "border-box" };
  const labelStyle = { fontSize: "6px", fontWeight: "700", textTransform: "uppercase", marginBottom: "1px" };
  const valueStyle = { fontSize: "9px", fontWeight: "500", fontFamily: "monospace", flex: 1, display: "flex", alignItems: "center" };
  const sectionTitle = { fontSize: "7px", fontWeight: "800", textTransform: "uppercase", padding: "4px 0 2px 2px" };

  return (
    <div className="danfe-container" style={{ marginTop: 20 }}>
      <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button 
          onClick={handlePrint} 
          style={{ padding: "10px 24px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
        >
          🖨️ Imprimir Espelho (A4)
        </button>
      </div>

      <div id="danfe-print" style={{ background: "#fff", padding: "10mm", color: "#000", fontFamily: "Arial, sans-serif", position: "relative", width: "210mm", minHeight: "297mm", boxSizing: "border-box", margin: "0 auto", border: "1px solid #eee" }}>
        
        {/* Watermark Profissional */}
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
            <div style={boxStyle}><div style={labelStyle}>Natureza da Operação</div><div style={valueStyle}>{d.natureza_operacao}</div></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
              <div style={{ ...boxStyle, borderTop: "none", borderLeft: "none" }}><div style={labelStyle}>Inscrição Estadual</div><div style={valueStyle}>261935348</div></div>
              <div style={{ ...boxStyle, borderTop: "none" }}><div style={labelStyle}>Inscrição Estadual Substituta</div><div style={valueStyle}>-</div></div>
              <div style={{ ...boxStyle, borderTop: "none", borderRight: "none" }}><div style={labelStyle}>CNPJ</div><div style={valueStyle}>04.002.562/0004-78</div></div>
            </div>
          </div>

          <div style={sectionTitle}>Destinatário / Remetente</div>
          <div style={{ border: "1px solid #000", marginBottom: "4px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1.5fr" }}>
              <div style={{ ...boxStyle, border: "none", borderRight: "1px solid #000" }}><div style={labelStyle}>Nome / Razão Social</div><div style={valueStyle}>{d.razao_social_dest}</div></div>
              <div style={{ ...boxStyle, border: "none" }}><div style={labelStyle}>CNPJ / CPF</div><div style={valueStyle}>{d.cnpj_dest}</div></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr 0.5fr 0.5fr", borderTop: "1px solid #000" }}>
              <div style={{ ...boxStyle, border: "none", borderRight: "1px solid #000" }}><div style={labelStyle}>Endereço</div><div style={valueStyle}>{d.endereco_dest}</div></div>
              <div style={{ ...boxStyle, border: "none", borderRight: "1px solid #000" }}><div style={labelStyle}>Bairro / Distrito</div><div style={valueStyle}>{d.bairro_dest || "CENTRO"}</div></div>
              <div style={{ ...boxStyle, border: "none", borderRight: "1px solid #000" }}><div style={labelStyle}>CEP</div><div style={valueStyle}>{d.cep_dest || "-"}</div></div>
              <div style={{ ...boxStyle, border: "none" }}><div style={labelStyle}>Data Emissão</div><div style={valueStyle}>{nf.data_emissao || now.toLocaleDateString("pt-BR")}</div></div>
            </div>
          </div>

          <div style={sectionTitle}>Cálculo do Imposto</div>
          <div style={{ border: "1px solid #000", marginBottom: "4px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr 1fr 1fr" }}>
              <div style={{ ...boxStyle, border: "none", borderRight: "1px solid #000" }}><div style={labelStyle}>Base de Cálculo ICMS</div><div style={valueStyle}>{d.base_icms}</div></div>
              <div style={{ ...boxStyle, border: "none", borderRight: "1px solid #000" }}><div style={labelStyle}>Valor do ICMS</div><div style={valueStyle}>{d.valor_icms}</div></div>
              <div style={{ ...boxStyle, border: "none", borderRight: "1px solid #000" }}><div style={labelStyle}>Base Calc. ICMS Subst.</div><div style={valueStyle}>{d.base_icms_st}</div></div>
              <div style={{ ...boxStyle, border: "none", borderRight: "1px solid #000" }}><div style={labelStyle}>Valor ICMS Subst.</div><div style={valueStyle}>{d.valor_icms_st}</div></div>
              <div style={{ ...boxStyle, border: "none" }}><div style={labelStyle}>Vlr Total Produtos</div><div style={valueStyle}>{d.valor_total_produtos}</div></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr 1fr", borderTop: "1px solid #000" }}>
              <div style={{ ...boxStyle, border: "none", borderRight: "1px solid #000" }}><div style={labelStyle}>Valor do Frete</div><div style={valueStyle}>{d.valor_frete}</div></div>
              <div style={{ ...boxStyle, border: "none", borderRight: "1px solid #000" }}><div style={labelStyle}>Valor do Seguro</div><div style={valueStyle}>{d.valor_seguro}</div></div>
              <div style={{ ...boxStyle, border: "none", borderRight: "1px solid #000" }}><div style={labelStyle}>Desconto</div><div style={valueStyle}>{d.desconto}</div></div>
              <div style={{ ...boxStyle, border: "none", borderRight: "1px solid #000" }}><div style={labelStyle}>Outras Desp. Acc.</div><div style={valueStyle}>{d.outras_despesas}</div></div>
              <div style={{ ...boxStyle, border: "none", borderRight: "1px solid #000" }}><div style={labelStyle}>Valor do IPI</div><div style={valueStyle}>{d.valor_ipi}</div></div>
              <div style={{ ...boxStyle, border: "none", borderRight: "1px solid #000" }}><div style={labelStyle}>Vlr IPI Devolvido</div><div style={valueStyle}>0,00</div></div>
              <div style={{ ...boxStyle, border: "none" }}><div style={labelStyle}>Valor Total da Nota</div><div style={valueStyle}>{d.valor_total_nota}</div></div>
            </div>
          </div>

          <div style={sectionTitle}>Transportador / Volumes Transportados</div>
          <div style={{ border: "1px solid #000", marginBottom: "4px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1.5fr 1fr" }}>
              <div style={{ ...boxStyle, border: "none", borderRight: "1px solid #000" }}><div style={labelStyle}>Nome / Razão Social</div><div style={valueStyle}>MARIN LOGISTICA E COMERCIO LTDA</div></div>
              <div style={{ ...boxStyle, border: "none", borderRight: "1px solid #000" }}><div style={labelStyle}>Frete por Conta</div><div style={valueStyle}>1 - Emitente (CIF)</div></div>
              <div style={{ ...boxStyle, border: "none" }}><div style={labelStyle}>CNPJ / CPF</div><div style={valueStyle}>04.002.562/0004-78</div></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "0.5fr 1fr 1fr 1fr 1fr 1.2fr", borderTop: "1px solid #000" }}>
              <div style={{ ...boxStyle, border: "none", borderRight: "1px solid #000" }}><div style={labelStyle}>Quantidade</div><div style={valueStyle}>{d.quantidade_volumes || "0"}</div></div>
              <div style={{ ...boxStyle, border: "none", borderRight: "1px solid #000" }}><div style={labelStyle}>Espécie</div><div style={valueStyle}>{d.especie_volumes || "VOLUMES"}</div></div>
              <div style={{ ...boxStyle, border: "none", borderRight: "1px solid #000" }}><div style={labelStyle}>Marca</div><div style={valueStyle}>-</div></div>
              <div style={{ ...boxStyle, border: "none", borderRight: "1px solid #000" }}><div style={labelStyle}>Numeração</div><div style={valueStyle}>-</div></div>
              <div style={{ ...boxStyle, border: "none", borderRight: "1px solid #000" }}><div style={labelStyle}>Peso Bruto</div><div style={valueStyle}>{d.peso_bruto || "0,000 kg"}</div></div>
              <div style={{ ...boxStyle, border: "none" }}><div style={labelStyle}>Peso Líquido</div><div style={valueStyle}>{d.peso_liquido || "0,000 kg"}</div></div>
            </div>
          </div>

          <div style={sectionTitle}>Dados dos Produtos / Serviços</div>
          <div style={{ border: "1px solid #000", borderBottom: "none" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <thead>
                <tr style={{ height: "14px", borderBottom: "1px solid #000" }}>
                  {["CÓD.","DESCRIÇÃO","NCM/SH","CST","CFOP","UNID.","QTDE.","VLR. UNIT.","VLR. TOTAL"].map(h => (
                    <th key={h} style={{ fontSize: "5px", fontWeight: "700", borderRight: "1px solid #000", padding: "1px", background: "#f5f5f5", textAlign: "center" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {prods.map((p, i) => (
                  <tr key={i} style={{ minHeight: "14px", borderBottom: "1px solid #000" }}>
                    <td style={{ fontSize: "6.5px", padding: "2px", borderRight: "1px solid #000" }}>{p.codigo || "-"}</td>
                    <td style={{ fontSize: "6.5px", padding: "2px", borderRight: "1px solid #000" }}>{p.descricao || "-"}</td>
                    <td style={{ fontSize: "6.5px", padding: "2px", borderRight: "1px solid #000" }}>{p.ncm || "-"}</td>
                    <td style={{ fontSize: "6.5px", padding: "2px", borderRight: "1px solid #000" }}>{p.cst || "000"}</td>
                    <td style={{ fontSize: "6.5px", padding: "2px", borderRight: "1px solid #000" }}>{p.cfop || "5202"}</td>
                    <td style={{ fontSize: "6.5px", padding: "2px", borderRight: "1px solid #000" }}>{p.unidade || "UN"}</td>
                    <td style={{ fontSize: "6.5px", padding: "2px", borderRight: "1px solid #000", textAlign: "right" }}>{p.quantidade || "0"}</td>
                    <td style={{ fontSize: "6.5px", padding: "2px", borderRight: "1px solid #000", textAlign: "right" }}>{p.valor_unitario || "0,00"}</td>
                    <td style={{ fontSize: "6.5px", padding: "2px", borderRight: "1px solid #000", textAlign: "right" }}>{p.valor_liquido || p.valor_total || "0,00"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={sectionTitle}>Dados Adicionais</div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", border: "1px solid #000", minHeight: "60px" }}>
            <div style={{ padding: "4px", fontSize: "7px", borderRight: "1px solid #000" }}>
              <div style={labelStyle}>Informações Complementares</div>
              <div style={{ fontSize: "7px", lineHeight: "1.3" }}>
                {d.info_complementares || footerMsg}<br/>
                Vendedor: {chamado?.vendedor_nome || chamado?.nome_vendedor}<br/>
                DEVOLUÇÃO REF. NF {chamado?.nf_original}
              </div>
            </div>
            <div style={{ padding: "4px", fontSize: "7px" }}>
              <div style={labelStyle}>Data/Hora</div>
              <div style={{ fontSize: "6px", color: "#888" }}>{now.toLocaleString("pt-BR")}</div>
              <div style={{ fontSize: "6px", color: "#aaa", marginTop: "2px" }}>Triagem Automática Marin</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: portrait; margin: 0mm; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden; }
          #danfe-print, #danfe-print * { visibility: visible !important; }
          #danfe-print { 
            position: absolute; top: 0; left: 0; right: 0; width: 100%; 
            margin: 0 !important; padding: 10mm !important; z-index: 10000;
            background: #fff !important; -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important; box-sizing: border-box;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
