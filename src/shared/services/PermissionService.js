/**
 * PermissionService — ตารางสิทธิ์ที่ผู้ดูแลปรับเอง (ใครเห็นเมนูอะไร / จัดการอะไรได้)
 *
 * คำศัพท์: Role = ตำแหน่งในระบบ (Super Admin/Admin/Member) · Rank = ตำแหน่งในองค์กร (เปลี่ยนชื่อได้)
 * ตารางนี้คือสิทธิ์ของ "Rank" — ส่วน Role ตั้งที่ผู้ใช้รายคน (AuthService.UpdateUser)
 *
 * ✅ ผู้ใช้สั่ง: "อยากให้ตั้งค่ากำหนดสิทธิ์ได้ด้วยว่าอยากให้ใครมองเห็นเมนูอะไร และจัดการอะไรได้บ้าง"
 * ⚠️ ฝั่งหน้าจอใช้ "ซ่อนเมนู/ปิดปุ่ม" เท่านั้น — ทุก endpoint ที่ server ยังเช็ค can() ของตัวเองเสมอ
 * ⚠️ โหลดไม่สำเร็จ = ใช้ตารางค่าเริ่มต้นที่ฝังมากับแอป (ไม่ใช่เปิดทุกเมนู) ปลอดภัยไว้ก่อน
 */
import API from "@/shared/api/axiosInstance";
import { setEffectiveCapabilities } from "@/shared/utils/roles";

const PermissionService = {
  /** ตารางที่ใช้จริง (ทุกคนที่ล็อกอินอ่านได้) → เอาไปทับตารางค่าเริ่มต้นฝั่งหน้าจอ */
  async loadEffective() {
    try {
      const res = await API.get("/settings/permissions/effective");
      setEffectiveCapabilities(res.data?.effective || null);
      return res.data?.effective || null;
    } catch {
      setEffectiveCapabilities(null);
      return null;
    }
  },

  /** ข้อมูลสำหรับหน้าตั้งค่าสิทธิ์ (เฉพาะผู้มีสิทธิ์จัดการระบบ) */
  async matrix() {
    const res = await API.get("/settings/permissions");
    return res.data;
  },

  /** เปลี่ยนชื่อ Rank (คีย์ของตำแหน่งคงเดิม) — ✅ ผู้ใช้ขอให้เปลี่ยนชื่อได้ */
  async renameRanks(labels) {
    const res = await API.put("/settings/rank-labels", { labels });
    return res.data;
  },

  /** เปิด/ปิดสิทธิ์หนึ่งช่องของ Rank หนึ่งตำแหน่ง */
  async setOne({ rank, capability, allowed }) {
    const res = await API.put("/settings/permissions", { rank, capability, allowed });
    return res.data;
  },
};

export default PermissionService;
