import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Important for session-based authentication
});

// Players
export const playersApi = {
  getAll: (params) => api.get("/players", { params }),
  getById: (id) => api.get(`/players/${id}`),
  create: (data) => api.post("/players", data),
  update: (id, data) => api.put(`/players/${id}`, data),
  delete: (id) => api.delete(`/players/${id}`),
  getDebts: (id) => api.get(`/players/${id}/debts`),
  assignRoles: (id, roleIds) =>
    api.post(`/players/${id}/roles`, { role_ids: roleIds }),
};

// Ratios
export const ratiosApi = {
  getAll: () => api.get("/ratios"),
  getById: (id) => api.get(`/ratios/${id}`),
  create: (data) => api.post("/ratios", data),
  update: (id, data) => api.put(`/ratios/${id}`, data),
  delete: (id) => api.delete(`/ratios/${id}`),
  getDefaults: (gender) => api.get("/ratios/defaults", { params: { gender } }),
};

// Menus
export const menusApi = {
  getAll: () => api.get("/menus"),
  getById: (id) => api.get(`/menus/${id}`),
  create: (data) => api.post("/menus", data),
  update: (id, data) => api.put(`/menus/${id}`, data),
  delete: (id) => api.delete(`/menus/${id}`),
};

// Shuttles
export const shuttlesApi = {
  getAll: (params) => api.get("/shuttles", { params }),
  getById: (id) => api.get(`/shuttles/${id}`),
  create: (data) => api.post("/shuttles", data),
  update: (id, data) => api.put(`/shuttles/${id}`, data),
  delete: (id) => api.delete(`/shuttles/${id}`),
  getStockEntries: (id) => api.get(`/shuttles/${id}/stock-entries`),
  addStockEntry: (id, data) => api.post(`/shuttles/${id}/stock-entries`, data),
  getPrices: (id) => api.get(`/shuttles/${id}/prices`),
  addPrice: (id, data) => api.post(`/shuttles/${id}/prices`, data),
  deletePrice: (id, priceId) => api.delete(`/shuttles/${id}/prices/${priceId}`),
};

// Bills
export const billsApi = {
  getAll: (params) => api.get("/bills", { params }),
  getById: (id) => api.get(`/bills/${id}`),
  create: (data) => api.post("/bills", data),
  update: (id, data) => api.put(`/bills/${id}`, data),
  delete: (id) => api.delete(`/bills/${id}`),
  markPayment: (billId, playerId, data) =>
    api.post(`/bills/${billId}/players/${playerId}/pay`, data),
  getSubBills: (billId) => api.get(`/bills/${billId}/sub-bills`),
  createSubBill: (billId, data) => api.post(`/bills/${billId}/sub-bills`, data),
  sendTelegram: (billId, fileBlob, caption) => {
    const formData = new FormData();
    formData.append("file", fileBlob, `bill_${billId}.png`);
    if (caption) formData.append("caption", caption);
    return api.post(`/bills/${billId}/send-telegram`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// Debts
export const debtsApi = {
  getAll: () => api.get("/debts"),
  getById: (id) => api.get(`/debts/${id}`),
  create: (data) => api.post("/debts", data),
  update: (id, data) => api.put(`/debts/${id}`, data),
  delete: (id) => api.delete(`/debts/${id}`),
};

// Payment Accounts
export const paymentAccountsApi = {
  getAll: (params) => api.get("/payment-accounts", { params }),
  getById: (id) => api.get(`/payment-accounts/${id}`),
  create: (data) => api.post("/payment-accounts", data),
  update: (id, data) => api.put(`/payment-accounts/${id}`, data),
  delete: (id) => api.delete(`/payment-accounts/${id}`),
};

// Party Bills (tiệc)
export const partyBillsApi = {
  getAll: () => api.get("/party-bills"),
  getById: (id) => api.get(`/party-bills/${id}`),
  create: (data) => api.post("/party-bills", data),
  update: (id, data) => api.put(`/party-bills/${id}`, data),
  delete: (id) => api.delete(`/party-bills/${id}`),
  markPayment: (billId, participantId, data) =>
    api.post(`/party-bills/${billId}/participants/${participantId}/pay`, data),
  sendTelegram: (billId, fileBlob, caption) => {
    const formData = new FormData();
    formData.append("file", fileBlob, `party_bill_${billId}.png`);
    if (caption) formData.append("caption", caption);
    return api.post(`/party-bills/${billId}/send-telegram`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// Roles
export const rolesApi = {
  getAll: () => api.get("/roles"),
  getById: (id) => api.get(`/roles/${id}`),
  create: (data) => api.post("/roles", data),
  update: (id, data) => api.put(`/roles/${id}`, data),
  delete: (id) => api.delete(`/roles/${id}`),
};

// Permissions
export const permissionsApi = {
  getAll: (params) => api.get("/permissions", { params }),
  getById: (id) => api.get(`/permissions/${id}`),
};

// Auth
export const authApi = {
  login: (email, password) => api.post("/login", { email, password }),
  logout: () => api.post("/logout"),
  me: () => api.get("/me"),
};

// Player Lists (Danh sách VĐV)
export const playerListsApi = {
  getAll: () => api.get("/player-lists"),
  getById: (id) => api.get(`/player-lists/${id}`),
  create: (data) => api.post("/player-lists", data),
  update: (id, data) => api.put(`/player-lists/${id}`, data),
  delete: (id) => api.delete(`/player-lists/${id}`),
};

// Tournament Players (VĐV trong danh sách)
export const tournamentPlayersApi = {
  getAll: (params) => api.get("/tournament-players", { params }),
  getById: (id) => api.get(`/tournament-players/${id}`),
  create: (data) => api.post("/tournament-players", data),
  update: (id, data) => api.put(`/tournament-players/${id}`, data),
  delete: (id) => api.delete(`/tournament-players/${id}`),
  import: (playerListId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("player_list_id", playerListId);
    return api.post("/tournament-players/import", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },
};

// Brackets (Bảng thi đấu)
export const bracketsApi = {
  getAll: (playerListId) => api.get(`/player-lists/${playerListId}/brackets`),
  getById: (playerListId, bracketId) =>
    api.get(`/player-lists/${playerListId}/brackets/${bracketId}`),
  organize: (playerListId, data) =>
    api.post(`/player-lists/${playerListId}/brackets/organize`, data),
  delete: (playerListId, bracketId) =>
    api.delete(`/player-lists/${playerListId}/brackets/${bracketId}`),
  deleteAll: (playerListId) =>
    api.delete(`/player-lists/${playerListId}/brackets`),
};

export default api;
