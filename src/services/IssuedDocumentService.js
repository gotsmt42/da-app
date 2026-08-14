import API from "../API/axiosInstance";

/**
 * ทะเบียนเอกสารที่ออกจริง (ใบแจ้งเข้างาน / ใบส่งมอบงาน)
 * ดูเหตุผลว่าทำไมต้องบันทึกไว้ ที่ da-app-server/models/IssuedDocument.js
 */
const IssuedDocumentService = {
  /** @param {object} params — { docType, status, q, from, to, page, limit } */
  async list(params = {}) {
    const res = await API.get("/issued-documents", { params });
    return res.data;
  },

  /** ⚠️ เรียกตอน "ยืนยันออกเอกสาร" สำเร็จเท่านั้น — ไม่ใช่ตอนดูตัวอย่าง (ตัวอย่างยังไม่กินเลขที่จริง) */
  async create(payload) {
    const res = await API.post("/issued-documents", payload);
    return res.data;
  },

  /** เปลี่ยนสถานะติดตาม / แก้บันทึกเพิ่มเติมของใบนั้น */
  async update(id, payload) {
    const res = await API.patch(`/issued-documents/${id}`, payload);
    return res.data;
  },
};

export default IssuedDocumentService;
