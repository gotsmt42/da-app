/**
 * OtService — เรียก /api/ot (ใบขออนุมัติ OT)
 * ⚠️ ยอดเงินของคนอื่นถูก server ตัดเป็น null ถ้าผู้ใช้ไม่มีสิทธิ์ดูค่าจ้าง (moneyVisible = "mine")
 */
import API from "@/shared/api/axiosInstance";

const OtService = {
  async config() { return (await API.get("/ot/config")).data; },
  async summary() { return (await API.get("/ot/summary")).data; },
  async people() { return (await API.get("/ot/people")).data.users || []; },
  async list(params = {}) { return (await API.get("/ot", { params })).data.requests || []; },
  async get(id) { return (await API.get(`/ot/${id}`)).data.request; },
  async create(fields) { return (await API.post("/ot", fields)).data.request; },
  async update(id, fields) { return (await API.put(`/ot/${id}`, fields)).data.request; },
  async review(id, note = "") { return (await API.post(`/ot/${id}/review`, { note })).data.request; },
  async approve(id, note = "") { return (await API.post(`/ot/${id}/approve`, { note })).data.request; },
  async reject(id, reason) { return (await API.post(`/ot/${id}/reject`, { reason })).data.request; },
  async cancel(id, reason = "") { return (await API.post(`/ot/${id}/cancel`, { reason })).data.request; },
  async wages() { return (await API.get("/ot/wages")).data; },
  async saveWage(userId, fields) { return (await API.put(`/ot/wages/${userId}`, fields)).data.wage; },
  async report(period) { return (await API.get("/ot/report", { params: { period } })).data; },
  async closePayroll(period, note = "") { return (await API.post("/ot/payroll/close", { period, note })).data; },
};

export const errorText = (err, fallback = "ทำรายการไม่สำเร็จ") =>
  err?.response?.data?.message || (err?.code === "ECONNABORTED" ? "เครือข่ายช้าเกินไป ลองใหม่อีกครั้ง" : "") || err?.message || fallback;

export default OtService;
