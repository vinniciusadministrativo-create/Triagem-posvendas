/**
 * Pós-processamento da extração determinística de NF (DANFE).
 *
 * Lógica única usada tanto na extração da criação do chamado
 * (`POST /api/ai/extract-nf`) quanto no reprocessamento/auto-extração
 * (`routes/chamados.js`). Qualquer correção no mapeamento de produtos,
 * totais ou filtro de cabeçalhos deve ser feita APENAS aqui.
 */

// Strings que indicam que o regex do extrator capturou um cabeçalho do PDF
// em vez do valor real (ex.: "BAIRRO / DISTRITO").
const INVALIDOS = ["bairro", "distrito", "cnpj", "cpf", "protocolo", "data da", "endereço", "inscrição", "município", "fone", "telefone", "emissão", "saída", "entrada"];

/** @returns {boolean} true se o valor extraído parece legítimo (não é lixo de cabeçalho). */
function isValido(v) {
  if (!v) return false;
  const val = v.toLowerCase().trim();
  if (INVALIDOS.some(inv => val.includes(inv))) {
    // Exceção: um endereço legítimo pode conter "bairro" mas é longo; strings
    // curtas com termo de cabeçalho são descartadas.
    if (val.length < 30 && INVALIDOS.filter(inv => val.includes(inv)).length >= 1) return false;
  }
  return val.length >= 2;
}

/**
 * Normaliza a saída bruta do extrator Python (DANFE) para o formato `nf_data`
 * usado pelo espelho. Mapeia as linhas de produtos por índice, calcula totais a
 * partir dos itens quando ausentes, formata valores em padrão BR e filtra
 * "lixo" de cabeçalho do PDF.
 *
 * @param {object} det Objeto bruto retornado por `extractNFDeterministic`.
 * @param {object} [fd={}] Dados do formulário do chamado, usados como fallback
 *        para campos não extraídos (nfOriginal, naturezaOperacao, razaoSocial, cnpj).
 * @returns {object} Dados formatados da NF (campos monetários como string BR,
 *          array `produtos`, flag `isDeterministic: true`).
 */
function cleanAndFormatNfData(det, fd = {}) {
  const produtos = (det.produtos?.rows || []).map(r => {
    const len = r.length;
    // Se a linha tem ~9 colunas, o total costuma ser a última ou penúltima.
    // Índice 10 pode estar fora do range ou ser imposto em tabelas menores.
    const totalIdx = len >= 11 ? 10 : (len >= 9 ? 8 : len - 1);
    const unitIdx  = len >= 11 ? 7  : (len >= 9 ? 7 : len - 2);
    return {
      codigo:         r[0]  || "",
      descricao:      r[1]  || "",
      ncm:            r[2]  || "",
      cst:            r[3]  || "",
      cfop:           "5202",
      unidade:        r[5]  || "UN",
      quantidade:     r[6]  || "0",
      valor_unitario: r[unitIdx]  || "0,00",
      valor_total:    r[totalIdx] || "0,00"
    };
  });

  // Calcular total dos produtos a partir dos itens quando valor não extraído
  const parseBR = v => parseFloat((v || "0").replace(/\./g, "").replace(",", ".")) || 0;
  const calcTotalProd = produtos.reduce((s, p) => s + parseBR(p.valor_total), 0);
  const fmtBR = n => n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  const totalProd = parseBR(det.valores?.total_produtos) || calcTotalProd;
  const totalNota = parseBR(det.valores?.total_nota) || totalProd; // fallback: total da nota = total dos produtos

  const natureza = (det.natureza_op && isValido(det.natureza_op) && det.natureza_op.length < 100)
    ? det.natureza_op
    : (fd.naturezaOperacao || "5202 - DEVOLUÇÃO DE COMPRA PARA COMERCIALIZAÇÃO");

  // Prioridade: dados extraídos do PDF; fallback: dados do formulário
  return {
    numero_nf:            det.numero            || fd.nfOriginal || "",
    data_emissao:         det.data_emissao       || "",
    natureza_operacao:    natureza,
    valor_total_nota:     fmtBR(totalNota),
    valor_total_produtos: fmtBR(totalProd),
    base_icms:            det.valores?.base_icms      || "0,00",
    valor_icms:           det.valores?.valor_icms     || "0,00",
    base_icms_st:         det.valores?.base_icms_st   || "0,00",
    valor_icms_st:        det.valores?.valor_icms_st  || "0,00",
    valor_frete:          det.valores?.frete          || "0,00",
    valor_seguro:         det.valores?.seguro         || "0,00",
    valor_ipi:            det.valores?.valor_ipi      || "0,00",
    peso_bruto:           det.transporte?.peso_bruto  || "0,00",
    peso_liquido:         det.transporte?.peso_liquido|| "0,00",
    quantidade_volumes:   det.transporte?.quantidade  || "0",
    especie_volumes:      det.transporte?.especie     || "",
    cliente:              (det.destinatario?.nome && isValido(det.destinatario.nome)) ? det.destinatario.nome : (fd.razaoSocial || ""),
    razao_social_dest:    (det.destinatario?.nome && isValido(det.destinatario.nome)) ? det.destinatario.nome : (fd.razaoSocial || ""),
    cnpj:                 (det.destinatario?.cnpj_cpf && isValido(det.destinatario.cnpj_cpf)) ? det.destinatario.cnpj_cpf : (fd.cnpj || ""),
    cnpj_dest:            (det.destinatario?.cnpj_cpf && isValido(det.destinatario.cnpj_cpf)) ? det.destinatario.cnpj_cpf : (fd.cnpj || ""),
    endereco_dest:        isValido(det.destinatario?.endereco)  ? det.destinatario.endereco  : "",
    bairro_dest:          isValido(det.destinatario?.bairro)    ? det.destinatario.bairro    : "",
    cep_dest:             isValido(det.destinatario?.cep)       ? det.destinatario.cep       : "",
    municipio_dest:       isValido(det.destinatario?.municipio) ? det.destinatario.municipio : "",
    uf_dest:              isValido(det.destinatario?.uf)        ? det.destinatario.uf        : "",
    produtos,
    isDeterministic: true
  };
}

module.exports = { cleanAndFormatNfData };
