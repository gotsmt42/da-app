/**
 * SignatureService — ลายเซ็นอิเล็กทรอนิกส์ของผู้ใช้ (ตั้งค่าครั้งเดียว ใช้กับ PDF ทุกใบ)
 *
 * 🔒 ดึงรูปได้เฉพาะ "ลายเซ็นของตัวเอง" — ลายเซ็นของคนอื่นมาพร้อมเอกสารที่คนนั้นลงนามแล้วเท่านั้น
 * (ดู da-app-server/src/routes/signatures.js)
 * ⚠️ แคชลายเซ็นของตัวเองไว้ในหน่วยความจำต่อการเปิดแอปหนึ่งครั้ง — ตัวสร้าง PDF เรียกทุกครั้งที่
 * ออกเอกสาร ถ้ายิง API ใหม่ทุกใบจะช้าโดยไม่จำเป็น (ล้างแคชเมื่อผู้ใช้แก้ลายเซ็น)
 */
import API from "@/shared/api/axiosInstance";

/**
 * 🐛 บั๊กที่แก้ (ผู้ใช้แจ้ง 2 ต.ค. 2569 "เพิ่มลายเซ็นแล้ว เข้าระบบใหม่ยังอิงอันเดิม ผิดพลาด"):
 *   แคชเดิมเป็นตัวแปรเดียวทั้งแอป ไม่ผูกกับผู้ใช้ — ออกจากระบบแล้วเข้าด้วยบัญชีอื่นในแท็บเดิม (ไม่รีโหลดหน้า)
 *   แคชยังถือ "ลายเซ็นของคนก่อน" อยู่ → หน้าตั้งค่าโชว์ลายเซ็นผิดคน และใบส่งมอบงาน/ใบแจ้งเข้างาน
 *   ที่วาดลายเซ็นจากฝั่งหน้าจอ พิมพ์ลายเซ็นของคนก่อนลงเอกสารของคนใหม่
 * ✅ แคชผูกกับ userId ที่ล็อกอินอยู่ + ตรวจ userId ที่ server ส่งกลับมาซ้ำอีกชั้น ไม่ตรง = ทิ้ง
 *   และล้างแคชทุกครั้งที่ล็อกอิน/ล็อกเอาต์ (AuthContext)
 */
const currentUserId = () => {
  try { return String(JSON.parse(localStorage.getItem("payload") || "{}")?.userId || ""); } catch { return ""; }
};

let cache;
let cacheOwner = "";
/** ล้างแคชถ้าคนที่ล็อกอินอยู่ไม่ใช่เจ้าของแคช */
const ensureOwner = () => {
  const uid = currentUserId();
  if (uid !== cacheOwner) { cache = undefined; cacheOwner = uid; }
  return uid;
};
/** รับเฉพาะลายเซ็นของคนที่ล็อกอินอยู่จริง — ไม่ตรง (สลับบัญชีระหว่างรอคำตอบ) = ไม่ใช้ */
const accept = (sig, uid) => (sig && (!sig.userId || String(sig.userId) === uid) && uid === currentUserId() ? sig : null);

const SignatureService = {
  /** @returns {Promise<null | {hash, image, width, height, method, consentAt, updatedAt}>} */
  async me({ force = false } = {}) {
    const uid = ensureOwner();
    if (!uid) return null;
    if (!force && cache !== undefined) return cache;
    let sig = null;
    try {
      const res = await API.get("/signatures/me", { params: { _: Date.now() } });
      sig = accept(res.data.signature || null, uid);
    } catch {
      // ⚠️ ดึงลายเซ็นไม่ได้ต้องไม่ทำให้ "ออกเอกสารไม่ได้" — ออกใบแบบเว้นช่องให้เซ็นมือแทน
      sig = null;
    }
    // ⚠️ เก็บลงแคชเฉพาะเมื่อยังเป็นคนเดิม (สลับบัญชีระหว่างรอ = ไม่เขียนทับแคชของคนใหม่)
    if (uid === currentUserId()) cache = sig;
    return sig;
  },

  /** @param {{image: string, method: "draw"|"upload", consent: boolean}} fields */
  async save(fields) {
    const uid = ensureOwner();
    const res = await API.put("/signatures/me", fields);
    cache = accept(res.data.signature || null, uid);
    return cache;
  },

  async remove() {
    ensureOwner();
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
    cacheOwner = "";
  },
};

export default SignatureService;
