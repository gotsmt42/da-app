/**
 * StockService — เรียก /api/stock (สต๊อก · ทรัพย์สินแผนก)
 * ⚠️ ยอดทุกตัวเปลี่ยนที่ server แบบอะตอมมิก — หน้าจอแค่ส่งคำขอแล้วดึงยอดใหม่ (เรียลไทม์หมวด "stock")
 */
import API from "@/shared/api/axiosInstance";

const StockService = {
  async config() { return (await API.get("/stock/config")).data; },
  async summary() { return (await API.get("/stock/summary")).data; },
  async items(dept, all = false) { return (await API.get("/stock/items", { params: { dept, ...(all ? { all: 1 } : {}) } })).data.items || []; },
  async addItem(fields) { return (await API.post("/stock/items", fields)).data.item; },
  async updateItem(id, fields) { return (await API.put(`/stock/items/${id}`, fields)).data.item; },
  /** ลบได้เฉพาะรายการที่ไม่เคยอยู่ในใบเบิก/ใบคืน (server ตรวจ) */
  async deleteItem(id) { return (await API.delete(`/stock/items/${id}`)).data; },
  async uploadPhoto(id, file) {
    const fd = new FormData();
    fd.append("photo", file);
    return (await API.post(`/stock/items/${id}/photo`, fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120_000 })).data.item;
  },
  async removePhoto(id) { return (await API.delete(`/stock/items/${id}/photo`)).data.item; },
  /** type: "in" = รับเข้า (qty = จำนวนที่เพิ่ม) · "count" = ตรวจนับ (qty = ยอดที่นับได้) */
  async adjust(id, type, qty, note = "") { return (await API.post(`/stock/items/${id}/adjust`, { type, qty, note })).data.item; },
  async moves(dept, item) { return (await API.get("/stock/moves", { params: { dept, ...(item ? { item } : {}) } })).data.moves || []; },
  async requests(params = {}) { return (await API.get("/stock/requests", { params })).data.requests || []; },
  async request(id) { return (await API.get(`/stock/requests/${id}`)).data.request; },
  async createRequest(fields) { return (await API.post("/stock/requests", fields)).data.request; },
  async issue(id, note = "") { return (await API.post(`/stock/requests/${id}/issue`, { note })).data.request; },
  async reject(id, reason) { return (await API.post(`/stock/requests/${id}/reject`, { reason })).data.request; },
  async cancel(id) { return (await API.post(`/stock/requests/${id}/cancel`)).data.request; },
  // ── ใบคืนของ (RT) ──
  async returns(params = {}) { return (await API.get("/stock/returns", { params })).data.returns || []; },
  async getReturn(id) { return (await API.get(`/stock/returns/${id}`)).data.return; },
  /** fields: { requestId, lines: [{lineId, qty, condition, note}], note, receiveNow } · photos: File[] */
  async createReturn(fields, photos = []) {
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => fd.append(k, typeof v === "object" ? JSON.stringify(v) : String(v ?? "")));
    photos.forEach((f) => fd.append("photos", f));
    return (await API.post("/stock/returns", fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120_000 })).data.return;
  },
  async receiveReturn(id) { return (await API.post(`/stock/returns/${id}/receive`)).data.return; },
  async rejectReturn(id, reason) { return (await API.post(`/stock/returns/${id}/reject`, { reason })).data.return; },
  async cancelReturn(id) { return (await API.post(`/stock/returns/${id}/cancel`)).data.return; },
  /** ของชำรุด: action "repair" (ซ่อมเสร็จ → เข้าคลัง) | "writeoff" (ตัดจำหน่าย) */
  async damaged(id, action, qty, note = "") { return (await API.post(`/stock/items/${id}/damaged`, { action, qty, note })).data.item; },
};

export const errorText = (err, fallback = "ทำรายการไม่สำเร็จ") =>
  err?.response?.data?.message || (err?.code === "ECONNABORTED" ? "เครือข่ายช้าเกินไป ลองใหม่อีกครั้ง" : "") || err?.message || fallback;

export default StockService;
