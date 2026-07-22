// Rótulos e cores canônicos dos chamados — fonte única para tabelas, filtros e badges.

export const STATUS_LABELS = {
  novo: "Novo",
  avaliacao: "Avaliação",
  avaliado: "Avaliado",
  espelho: "Emitir Espelho NFD",
  aguardando_nfd: "Aguard. NFD",
  aguardando_recolhimento: "Aguard. Recolhimento",
  recolhido: "Recolhido",
  aguardando_financeiro: "Aguard. Financeiro",
  encerrado: "Encerrado",
};

export const STATUS_COLOR = {
  novo: "#6b7280",
  avaliacao: "#f59e0b",
  avaliado: "#8b5cf6",
  espelho: "#9B1B30",
  aguardando_nfd: "#2563eb",
  aguardando_recolhimento: "#f59e0b",
  recolhido: "#059669",
  aguardando_financeiro: "#16a34a",
  encerrado: "#6b7280",
};

export const TIPO_LABELS = {
  preco_errado: "Preço Errado",
  produto_avariado: "Produto Avariado",
  erro_pigmentacao: "Erro de Pigmentação",
  produto_defeito: "Produto com Defeito",
  qtd_errada: "Quantidade Errada",
  arrependimento: "Arrependimento / Troca",
  recusa_entrega: "Recusa na Entrega",
};

// Listas ordenadas para popular <select> de filtro.
export const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([id, label]) => ({ id, label }));
export const TIPO_OPTIONS = Object.entries(TIPO_LABELS).map(([id, label]) => ({ id, label }));

export const statusLabel = (s) => STATUS_LABELS[s] || s || "—";
export const tipoLabel = (t) => TIPO_LABELS[t] || t || "—";
export const statusColor = (s) => STATUS_COLOR[s] || "#6b7280";
