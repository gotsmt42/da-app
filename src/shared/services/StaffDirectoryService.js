/**
 * StaffDirectoryService — ทะเบียนพนักงานแบบย่อ (ชื่อ / ตำแหน่ง / เบอร์) สำหรับช่อง "ผู้ลงนาม"
 *
 * ✅ ผู้ใช้ขอ: ใบแจ้งแผนงานและใบส่งมอบ ให้เลือกชื่อพร้อมเบอร์จากในระบบได้เลย ไม่ต้องพิมพ์เอง
 * ⚠️ ใช้ /auth/staff-directory ไม่ใช่ /auth/alluser — ตัวหลังคืนเอกสารผู้ใช้ทั้งก้อนของทุกคน
 * (หนักและมีข้อมูลที่หน้าเอกสารไม่ได้ใช้เลย)
 * ⚠️ แคชต่อการเปิดแอปหนึ่งครั้ง — ทุกกล่องออกเอกสารเรียกซ้ำ ไม่ควรยิง API ใหม่ทุกครั้งที่เปิด
 */
import API from "@/shared/api/axiosInstance";

let cache;

const StaffDirectoryService = {
  /** @returns {Promise<Array<{userId, name, position, tel, role, imageUrl}>>} */
  async list({ force = false } = {}) {
    if (!force && cache) return cache;
    try {
      const res = await API.get("/auth/staff-directory");
      cache = res.data.users || [];
    } catch {
      // ⚠️ ดึงทะเบียนไม่ได้ต้องไม่ทำให้ออกเอกสารไม่ได้ — ช่องผู้ลงนามยังพิมพ์เองได้ตามเดิม
      cache = [];
    }
    return cache;
  },

  clearCache() {
    cache = undefined;
  },
};

export default StaffDirectoryService;
