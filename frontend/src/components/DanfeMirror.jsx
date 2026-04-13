import React from 'react';

const M = {
  brdN: "#e5e0db",
  tx: "#1a1a1a",
  txM: "#6b6560",
  pri: "#9B1B30",
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
    natureza_operacao: nf.natureza_operacao || "DEVOLUÇÃO DE MERCADORIA",
    base_icms: nf.base_icms || "0,00",
    valor_icms: nf.valor_icms || "0,00",
    valor_total_produtos: nf.valor_total_produtos || nf.total_produtos || "0,00",
    valor_total_nota: nf.valor_total_nota || nf.total_nota || nf.valor_total || "0,00",
    produtos: Array.isArray(nf.produtos) ? nf.produtos : []
  };

  const handlePrint = () => {
    const printContent = document.getElementById('danfe-print');
    const WinPrint = window.open('', '', 'width=900,height=650');
    WinPrint.document.write('<html><head><title>Imprimir Espelho</title>');
    WinPrint.document.write('<style>body{margin:0;padding:20px;font-family:sans-serif;} @media print{.no-print{display:none;}}</style>');
    WinPrint.document.write('</head><body>');
    WinPrint.document.write(printContent.innerHTML);
    WinPrint.document.write('</body></html>');
    WinPrint.document.close();
    WinPrint.focus();
    WinPrint.print();
    WinPrint.close();
  };

  return (
    <div style={{ marginTop: 20, border: `1px solid ${M.brdN}`, borderRadius: 12, overflow: "hidden", background: "#f8fafc" }}>
      <div style={{ padding: "15px 20px", background: "#fff", borderBottom: `1px solid ${M.brdN}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: 16, color: M.pri }}>📄 Espelho de Devolução (NFD)</h3>
        <button onClick={handlePrint} style={{ padding: "8px 16px", background: M.pri, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>🖨️ Imprimir</button>
      </div>
      
      <div id="danfe-print" style={{ padding: 30, background: "#fff", color: "#000" }}>
        <div style={{ border: "2px solid #000", padding: 15, textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>MARIN LOGISTICA - ESPELHO NFD</div>
          <div style={{ fontSize: 12 }}>DOCUMENTO PARA SIMPLES CONFERÊNCIA - NÃO POSSUI VALOR FISCAL</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
          <div style={{ border: "1px solid #000", padding: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 800 }}>DESTINATÁRIO / REMETENTE</div>
            <div style={{ marginTop: 5 }}><b>NOME:</b> {d.razao_social_dest}</div>
            <div><b>CNPJ:</b> {d.cnpj_dest}</div>
            <div><b>ENDEREÇO:</b> {d.endereco_dest || "N/A"}</div>
          </div>
          <div style={{ border: "1px solid #000", padding: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 800 }}>DADOS DA NOTA ORIGINAL</div>
            <div style={{ marginTop: 5 }}><b>NF REF:</b> {chamado.nf_original}</div>
            <div><b>DATA EMISSÃO:</b> {new Date().toLocaleDateString()}</div>
            <div><b>NATUREZA:</b> {d.natureza_operacao}</div>
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", fontSize: 11 }}>
          <thead>
            <tr style={{ background: "#eee" }}>
              <th style={{ border: "1px solid #000", padding: 4 }}>CÓDIGO</th>
              <th style={{ border: "1px solid #000", padding: 4 }}>DESCRIÇÃO</th>
              <th style={{ border: "1px solid #000", padding: 4 }}>QTD</th>
              <th style={{ border: "1px solid #000", padding: 4 }}>UN</th>
              <th style={{ border: "1px solid #000", padding: 4 }}>VALOR UNIT</th>
              <th style={{ border: "1px solid #000", padding: 4 }}>VALOR TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {(d.produtos || [{}]).map((p, i) => (
              <tr key={i}>
                <td style={{ border: "1px solid #000", padding: 4, textAlign: "center" }}>{p.codigo || "-"}</td>
                <td style={{ border: "1px solid #000", padding: 4 }}>{p.descricao || "Item de Devolução"}</td>
                <td style={{ border: "1px solid #000", padding: 4, textAlign: "center" }}>{p.quantidade || "1"}</td>
                <td style={{ border: "1px solid #000", padding: 4, textAlign: "center" }}>{p.unidade || "UN"}</td>
                <td style={{ border: "1px solid #000", padding: 4, textAlign: "right" }}>{p.valor_unitario || d.valor_total_nota}</td>
                <td style={{ border: "1px solid #000", padding: 4, textAlign: "right" }}>{p.valor_total || d.valor_total_nota}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {[
            { l: "BASE ICMS", v: d.base_icms },
            { l: "VALOR ICMS", v: d.valor_icms },
            { l: "V. PRODUTOS", v: d.valor_total_produtos },
            { l: "TOTAL NOTA", v: d.valor_total_nota }
          ].map(b => (
            <div key={b.l} style={{ border: "1px solid #000", padding: 5, textAlign: "center" }}>
              <div style={{ fontSize: 8 }}>{b.l}</div>
              <div style={{ fontWeight: 800 }}>R$ {b.v}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, border: "1px solid #000", padding: 10, fontSize: 10 }}>
          <b>DADOS ADICIONAIS:</b> ESPELHO NFD REF.NF-{chamado.nf_original} - CFOP CORRETO 5202. Gerado automaticamente pelo sistema Marin Logística.
        </div>
      </div>
    </div>
  );
}
