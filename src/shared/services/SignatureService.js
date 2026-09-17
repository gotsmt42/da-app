/**
 * SignatureService — ลายเซ็นอิเล็กทรอนิกส์ของผู้ใช้ (ตั้งค่าครั้งเดียว ใช้กับ PDF ทุกใบ)
 *
 * 🔒 ดึงรูปได้เฉพาะ "ลายเซ็นของตัวเอง" — ลายเซ็นของคนอื่นมาพร้อมเอกสารที่คนนั้นลงนามแล้วเท่านั้น
 * (ดู da-app-server/src/routes/signatures.js)
 * ⚠️ แคชลายเซ็นของตัวเองไว้ในหน่วยความจำต่อการเปิดแอปหนึ่งครั้ง — ตัวสร้าง PDF เรียกทุกครั้งที่
 * ออกเอกสาร ถ้ายิง API ใหม่ทุกใบจะช้าโดยไม่จำเป็น (ล้างแคชเมื่อผู้ใช้แก้ลายเซ็น)
 */
import API from "@/shared/api/axiosInstance";

let cache;

const SignatureService = {
  /** @returns {Promise<null | {hash, image, width, height, method, consentAt, updatedAt}>} */
  async me({ force = false } = {}) {
    if (!force && cache !== undefined) return cache;
    try {
      const res = await API.get("/signatures/me");
      cache = res.data.signature || null;
    } catch {
      // ⚠️ ดึงลายเซ็นไม่ได้ต้องไม่ทำให้ "ออกเอกสารไม่ได้" — ออกใบแบบเว้นช่องให้เซ็นมือแทน
      cache = null;
    }
    return cache;
  },

  /** @param {{image: string, method: "draw"|"upload", consent: boolean}} fields */
  async save(fields) {
    const res = await API.put("/signatures/me", fields);
    cache = res.data.signature || null;
    return cache;
  },

  async remove() {
    await API.delete("/signatures/me");
    cache = null;
  },

  /** ใครตั้งลายเซ็นไว้แล้วบ้าง (ไม่มีรูป) — เฉพาะแอดมิน/ผู้จัดการ */
  async status() {
    const res = await API.get("/signatures/status");
    return res.data.users || [];
  },

  clearCache() {
    cache = undefined;
  },
};

export default SignatureService;
