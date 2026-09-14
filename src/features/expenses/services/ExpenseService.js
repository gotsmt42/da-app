/**
 * ExpenseService — เรียก /api/expenses (ใบเบิก Advance / ใบเคลม)
 *
 * ⚠️ ส่ง multipart เฉพาะตอนมีไฟล์จริง (เหตุผลเดียวกับ DispatchService) และฟิลด์ที่เป็น array (items)
 * ต้อง JSON.stringify ก่อนใส่ FormData — ไม่งั้นฝั่ง server ได้ "[object Object]"
 * ⚠️ ชนิดไฟล์ (fileKinds[]) เป็นอาร์เรย์คู่ขนานกับ files[] — ไฟล์ที่ถูกปฏิเสธตอนตรวจต้องตัดชนิดของมันออก
 * ด้วยเสมอ (จับคู่ด้วยลำดับ ไม่ใช่ชื่อไฟล์ — ถ่ายรูปจากมือถือได้ชื่อซ้ำกันบ่อย)
 */
import API from "@/shared/api/axiosInstance";
import { prepareUploadFile } from "@/shared/utils/fileUpload";

// ⚠️ อัปโหลดหลายไฟล์จากมือถือเน็ตช้าใช้เวลาเกิน timeout ปกติของแอป (20 วิ) ได้ง่าย
const UPLOAD_TIMEOUT = 120_000;

/** @param {Array<{file: File, kind: string}>} files */
const prepareFiles = async (files) => {
  const accepted = [];
  const rejected = [];
  for (const f of files || []) {
    const entry = f instanceof File ? { file: f, kind: "other" } : f;
    // eslint-disable-next-line no-await-in-loop -- บีบอัดทีละไฟล์โดยตั้งใจ ไม่ให้กิน CPU/RAM พร้อมกัน
    const r = await prepareUploadFile(entry.file);
    if (r.ok) accepted.push({ file: r.file, kind: entry.kind || "other" });
    else rejected.push({ name: entry.file?.name, message: r.message });
  }
  return { accepted, rejected };
};

const buildBody = async (fields, files) => {
  const { accepted, rejected } = await prepareFiles(files);
  if (!accepted.length) return { body: fields, config: undefined, rejected };
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    fd.append(k, Array.isArray(v) ? JSON.stringify(v) : v);
  });
  accepted.forEach(({ file, kind }) => {
    fd.append("files", file);
    fd.append("fileKinds", kind);
  });
  return { body: fd, config: { headers: { "Content-Type": "multipart/form-data" }, timeout: UPLOAD_TIMEOUT }, rejected };
};

const ExpenseService = {
  async list(params = {}) {
    const res = await API.get("/expenses", { params });
    return res.data.expenses || [];
  },

  async summary() {
    const res = await API.get("/expenses/summary");
    return res.data;
  },

  async report(params = {}) {
    const res = await API.get("/expenses/report", { params });
    return res.data.advances || [];
  },

  async people() {
    const res = await API.get("/expenses/people");
    return res.data.users || [];
  },

  async jobs(q = "") {
    const res = await API.get("/expenses/jobs", { params: q ? { q } : {} });
    return res.data.jobs || [];
  },

  async suggest() {
    const res = await API.get("/expenses/suggest");
    return res.data;
  },

  async get(id) {
    const res = await API.get(`/expenses/${id}`);
    return res.data.expense;
  },

  /** @returns {{expense: object, rejected: Array}} */
  async createAdvance(fields, files = []) {
    const { body, config, rejected } = await buildBody(fields, files);
    const res = await API.post("/expenses/advances", body, config);
    return { expense: res.data.expense, rejected };
  },

  async createClaim(fields, files = []) {
    const { body, config, rejected } = await buildBody(fields, files);
    const res = await API.post("/expenses/claims", body, config);
    return { expense: res.data.expense, rejected };
  },

  async update(id, fields, files = []) {
    const { body, config, rejected } = await buildBody(fields, files);
    const res = await API.put(`/expenses/${id}`, body, config);
    return { expense: res.data.expense, rejected };
  },

  async approve(id, note = "") {
    const res = await API.post(`/expenses/${id}/approve`, { note });
    return res.data.expense;
  },

  async reject(id, reason) {
    const res = await API.post(`/expenses/${id}/reject`, { reason });
    return res.data.expense;
  },

  /** บันทึกจ่ายเงิน Advance · fields = { paidAt, method, ref, note, dueClearAt } */
  async pay(id, fields, files = []) {
    const { body, config, rejected } = await buildBody(fields, files);
    const res = await API.post(`/expenses/${id}/pay`, body, config);
    return { expense: res.data.expense, rejected };
  },

  /** ปิดส่วนต่างใบเคลม · fields = { paidAt, method, ref, note } */
  async settle(id, fields, files = []) {
    const { body, config, rejected } = await buildBody(fields, files);
    const res = await API.post(`/expenses/${id}/settle`, body, config);
    return { expense: res.data.expense, rejected };
  },

  async cancel(id, reason = "") {
    const res = await API.post(`/expenses/${id}/cancel`, { reason });
    return res.data.expense;
  },

  async addFiles(id, files) {
    const { body, config, rejected } = await buildBody({}, files);
    if (!(body instanceof FormData)) return { expense: null, rejected };
    const res = await API.post(`/expenses/${id}/files`, body, config);
    return { expense: res.data.expense, rejected };
  },

  /**
   * ออกรหัสฟอร์มใบเคลมเปล่า (พิมพ์ไปกรอกด้วยลายมือ) ที่ผูกกับใบ Advance
   * ✅ server สุ่มรหัสและบันทึกลงประวัติใบ Advance ให้ — ฝ่ายบัญชีใช้เทียบกับรหัสบนกระดาษได้
   * @returns {{code: string, issuedAt: string, issuedBy: string}}
   */
  async issueBlankClaimForm(advanceId) {
    const res = await API.post(`/expenses/${advanceId}/blank-claim-form`);
    return res.data;
  },

  async removeFile(id, fileId) {
    const res = await API.delete(`/expenses/${id}/files/${fileId}`);
    return res.data.expense;
  },
};

/** ข้อความ error ที่อ่านรู้เรื่อง — server ตอบข้อความไทยมาแล้วเกือบทุกกรณี */
export const errorText = (err, fallback = "ทำรายการไม่สำเร็จ") =>
  err?.response?.data?.message || (err?.code === "ECONNABORTED" ? "เครือข่ายช้าเกินไป ลองใหม่อีกครั้ง" : "") || err?.message || fallback;

export default ExpenseService;
