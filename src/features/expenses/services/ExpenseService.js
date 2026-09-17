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

  /**
   * ข้อมูลรายงาน
   * ⚠️ คืนทั้งก้อน { advances, reimbursements } ไม่ใช่อาร์เรย์เดียว — ใบสำรองจ่ายไม่มี Advance ให้ผูก
   * จึงมาคนละก้อน (ดู route /report) ถ้าคืนแค่ advances ยอดสำรองจ่ายจะหายจากรายงานทั้งหมดเงียบๆ
   */
  async report(params = {}) {
    const res = await API.get("/expenses/report", { params });
    return { advances: res.data.advances || [], reimbursements: res.data.reimbursements || [] };
  },

  async people() {
    const res = await API.get("/expenses/people");
    return res.data.users || [];
  },

  async jobs(q = "") {
    const res = await API.get("/expenses/jobs", { params: q ? { q } : {} });
    return res.data.jobs || [];
  },

  /**
   * ใบเบิก Advance ที่ยังมีผลของงานนี้ (1 งานออกได้ใบเดียว) — null = ยังไม่มี ออกใบได้
   * @returns {Promise<null | {_id, docNo, status, statusLabel, requesterName, canOpen}>}
   */
  async jobAdvance(eventId) {
    const res = await API.get(`/expenses/job-advance/${eventId}`);
    return res.data.advance || null;
  },

  /**
   * บัญชีรับเงินของพนักงานคนหนึ่ง (ทะเบียนบัญชี — ใช้เลือกใส่ใบเคลม)
   * ⚠️ ดูได้เฉพาะบัญชีตัวเอง หรือแอดมิน/ผู้จัดการดูของคนอื่นได้ (server บังคับ) — เลขบัญชีเป็นข้อมูลส่วนตัว
   * @returns {Promise<{accounts: Array, banks: Array}>}
   */
  async bankAccounts(userId) {
    const res = await API.get("/expenses/bank-accounts", { params: userId ? { userId } : {} });
    return { accounts: res.data.accounts || [], banks: res.data.banks || [] };
  },

  /** @param {{userId, bankCode, accountNo, accountName, isDefault}} fields */
  async addBankAccount(fields) {
    const res = await API.post("/expenses/bank-accounts", fields);
    return res.data.account;
  },

  async updateBankAccount(accountId, fields) {
    const res = await API.put(`/expenses/bank-accounts/${accountId}`, fields);
    return res.data.account;
  },

  async deleteBankAccount(accountId) {
    await API.delete(`/expenses/bank-accounts/${accountId}`);
  },

  async suggest() {
    const res = await API.get("/expenses/suggest");
    return res.data;
  },

  /**
   * ลายเซ็นอิเล็กทรอนิกส์ที่ผนึกไว้ในใบนี้ (ผู้เบิก/ผู้อนุมัติ) — ใช้ตอนสร้าง PDF
   * 🔒 server คืนเฉพาะลายเซ็นของคนที่ลงนามในใบนี้จริง และเฉพาะผู้ที่มีสิทธิ์เห็นใบเท่านั้น
   * ⚠️ ล้มเหลวต้องไม่ทำให้พิมพ์เอกสารไม่ได้ — คืน {} แล้วออกใบแบบเว้นช่องเซ็นมือ
   */
  async signatures(id) {
    try {
      const res = await API.get(`/expenses/${id}/signatures`);
      return res.data.signatures || {};
    } catch {
      return {};
    }
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

  /**
   * ใบเบิกค่าใช้จ่ายแบบสำรองจ่ายเอง (ไม่มี Advance) — ผู้ใช้: "บางทีช่างออกค่าใช้จ่ายไปก่อนไม่ advance"
   * ⚠️ คนละ endpoint กับ /claims เพราะเงื่อนไขต่างกันคนละเรื่อง: ใบนี้ไม่ต้องมี advanceId แต่ต้องมี
   * รายการและยอด > 0 เสมอ และเลือกผู้เบิก/ผูกงานได้เหมือนใบ Advance
   */
  async createReimbursement(fields, files = []) {
    const { body, config, rejected } = await buildBody(fields, files);
    const res = await API.post("/expenses/reimbursements", body, config);
    return { expense: res.data.expense, rejected };
  },

  async update(id, fields, files = []) {
    const { body, config, rejected } = await buildBody(fields, files);
    const res = await API.put(`/expenses/${id}`, body, config);
    return { expense: res.data.expense, rejected };
  },

  /**
   * ขั้นที่ 2 จาก 4 — ตรวจสอบใบ (แอดมินช่าง/ผู้จัดการแผนกช่าง) → "ตรวจสอบแล้ว รออนุมัติ"
   * @param {boolean} useSignature  ลงลายเซ็นอิเล็กทรอนิกส์ในช่อง "ผู้ตรวจสอบ" ไหม
   */
  async review(id, note = "", useSignature = true) {
    const res = await API.post(`/expenses/${id}/review`, { note, useSignature });
    return res.data.expense;
  },

  /** ขั้นที่ 3 จาก 4 — อนุมัติ (ผู้จัดการแผนกช่าง) → "อนุมัติแล้ว รออนุมัติเบิกจ่าย"
   * @param {boolean} useSignature  ลงลายเซ็นอิเล็กทรอนิกส์ของผู้อนุมัติในใบนี้ไหม */
  async approve(id, note = "", useSignature = true) {
    const res = await API.post(`/expenses/${id}/approve`, { note, useSignature });
    return res.data.expense;
  },

  async reject(id, reason) {
    const res = await API.post(`/expenses/${id}/reject`, { reason });
    return res.data.expense;
  },

  /**
   * ขั้นที่ 4 จาก 4 — อนุมัติเบิกจ่ายใบ Advance (ผู้จัดการแผนกช่าง/กรรมการผู้จัดการ)
   * fields = { paidAt, method, ref, note, dueClearAt, useSignature } — useSignature = ลงนามช่อง "ผู้อนุมัติเบิกจ่าย"
   */
  async pay(id, fields, files = []) {
    const { body, config, rejected } = await buildBody(fields, files);
    const res = await API.post(`/expenses/${id}/pay`, body, config);
    return { expense: res.data.expense, rejected };
  },

  /** ขั้นที่ 4 จาก 4 — อนุมัติเบิกจ่ายใบเคลม/ใบสำรองจ่าย · fields = { paidAt, method, ref, note, useSignature } */
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
