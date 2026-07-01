const API_BASE = import.meta.env.VITE_API_URL || "";

/** @returns {string|null} JWT armazenado no localStorage, ou null. */
function getToken() {
  return localStorage.getItem("token");
}

/**
 * Wrapper central sobre `fetch` para chamadas à API.
 * Injeta o header `Authorization: Bearer <token>` (exceto FormData, que não
 * recebe Content-Type manual), faz logout automático em 401 e traduz 429 em
 * mensagem amigável de rate limit.
 *
 * @param {string} path Caminho relativo da API (ex.: `/api/chamados`).
 * @param {RequestInit} [options={}] Opções do fetch (method, body, headers...).
 * @returns {Promise<any>} Corpo da resposta já parseado como JSON.
 * @throws {Error & {status:number}} Em respostas não-OK (a mensagem vem de `error`).
 */
async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
    return;
  }

  const data = await res.json().catch(() => ({}));
if (!res.ok) {
  const err = new Error(
    res.status === 429
      ? "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente."
      : data.error || "Erro na requisição"
  );
  err.status = res.status;
  throw err;
}
  return data;
}

/**
 * Cliente da API. Cada método encapsula uma chamada HTTP e devolve o JSON da
 * resposta (ou lança um Error com `.status`). Ver contratos no README.
 */
export const api = {
  // Auth
  login: (email, password) =>
    request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => request("/api/auth/me"),

  // Chamados
  createChamado: (formData) =>
    request("/api/chamados", { method: "POST", body: formData }),

  getMeusChamados: (params = {}) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v))).toString();
    return request(`/api/chamados/meus${qs ? `?${qs}` : ""}`);
  },

  getChamados: (params = {}) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v))).toString();
    return request(`/api/chamados${qs ? `?${qs}` : ""}`);
  },

  getChamado: (id) => request(`/api/chamados/${id}`),

  //v2 - fix recolhimento_data
  updateStatus: (id, status, extraData = {}) =>
  request(`/api/chamados/${id}/status`, { method: "PATCH", body: JSON.stringify({ 
    status,
    recolhimento_data: extraData.recolhimento_data,
    data_previsao_recolhimento: extraData.data_previsao_recolhimento || null,
    data_real_recolhimento: extraData.data_real_recolhimento || null,
  }) }),

  deleteChamado: (id) => request(`/api/chamados/${id}`, { method: "DELETE" }),
  deleteMultipleChamados: (ids) => request("/api/chamados/batch-delete", { method: "POST", body: JSON.stringify({ ids }) }),
  updateRessalva: (id, data) => request(`/api/chamados/${id}/ressalva`, { method: "PATCH", body: data }),
  updateNFData: (id, nf_data) => request(`/api/chamados/${id}/nf_data`, { method: "PATCH", body: JSON.stringify({ nf_data }) }),
  reprocessPDF: (id, formData) => request(`/api/chamados/${id}/reprocess-pdf`, { method: "POST", body: formData }),
  getHistory: (id) => request(`/api/chamados/${id}/history`),

  // Chat
  getMessages: (id) => request(`/api/chamados/${id}/messages`),
  sendMessage: (id, data) => request(`/api/chamados/${id}/messages`, { method: "POST", body: data }),

  // Users
  getUsers: () => request("/api/users"),
  getContacts: () => request("/api/users/contacts"),
  createUser: (data) => request("/api/users", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id, data) => request(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  changePassword: (id, current_password, new_password) =>
    request(`/api/users/${id}/password`, { method: "PATCH", body: JSON.stringify({ current_password, new_password }) }),

  // Triagem e Processamento (Antiga IA)
  triage: (form, isTest) => 
    request("/api/ai/triage", { method: "POST", body: JSON.stringify({ form, isTest }) }),
  extractNF: (fileB64, mime, isTest, formData) => 
    request("/api/ai/extract-nf", { method: "POST", body: JSON.stringify({ fileB64, mime, isTest, formData }) }),
  analyzeEvidence: (images, isTest) => 
    request("/api/ai/analyze-evidence", { method: "POST", body: JSON.stringify({ images, isTest }) }),

  // Compartilhamento
  shareChamado: (id, user_id) =>
    request(`/api/chamados/${id}/share`, { method: "POST", body: JSON.stringify({ user_id }) }),

  fileUrl: (filename) => {
    if (!filename) return "";
    if (filename.startsWith("http")) return filename;
    return `${API_BASE}/uploads/${filename}`;
  },
};
