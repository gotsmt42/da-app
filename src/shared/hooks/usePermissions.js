/**
 * usePermissions — สะพานระหว่าง AuthContext กับตารางสิทธิ์ (shared/utils/roles.js)
 *
 * ✅ ให้คอมโพเนนต์เขียนได้สั้นและอ่านออกว่ากำลังกันอะไร:
 *     const { can } = usePermissions();
 *     if (!can("viewFinance")) return <Navigate to="/dashboard" replace />;
 * แทนของเดิมที่ต้องรู้ทั้ง role ทั้งลิสต์:
 *     const canAccess = ["admin","manager","technician","user"].includes(userData?.role?.toLowerCase());
 *
 * ⚠️ ซ่อน UI เท่านั้น ไม่ใช่ความปลอดภัย — server กันซ้ำทุก endpoint เสมอ
 */
import { useMemo } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import {
  can as canWithRole,
  normalizeRole,
  systemRoleOf,
  departmentOf,
  isRole as isRoleOf,
  isAdminOrManager as isAdminOrManagerOf,
  rankLabel,
} from "@/shared/utils/roles";

export default function usePermissions() {
  const { userData, permVersion } = useAuth();
  const role = normalizeRole(userData);
  /**
   * 🐛 BUG ที่แก้ (ผู้ใช้แจ้ง "Super Admin เข้าหน้าตั้งค่าไม่ได้"):
   * เดิมส่ง "สตริงตำแหน่งในองค์กร" เข้า can() — สตริงมีมิติเดียว ชั้นในระบบจึงหายไปทั้งดุ้น
   * ผลคือ can("manageSystem") เป็น false เสมอไม่ว่าใครก็ตาม (ยกเว้นคนที่ตำแหน่งบังเอิญเดาได้ตรง)
   * และทางลัด "Super Admin ผ่านทุกสิทธิ์" ก็ใช้ไม่ได้ → หน้าตั้งค่าสิทธิ์/องค์กรเด้งออกทันที
   * ✅ ประกอบกลับเป็นก้อนที่มีครบสองมิติก่อนส่งเข้า can()
   * ⚠️ ยังคงผูก useMemo กับ "สตริงสองตัว" ไม่ใช่ตัว userData ทั้งก้อน — userData ถูกสร้างใหม่ทุกครั้ง
   *    ที่รีเฟรชโปรไฟล์ (ทุก 60 วิ) ถ้าผูกทั้งก้อน ตัวช่วยพวกนี้จะเปลี่ยน identity บ่อยจนไปกวน effect
   *    ของคนที่ใส่มันใน deps
   */
  const systemRole = systemRoleOf(userData);

  // ⚠️ ผูกกับ role (สตริง) ไม่ใช่ userData ทั้งก้อน — userData ถูกสร้างใหม่ทุกครั้งที่โปรไฟล์ถูกรีเฟรช
  // ถ้าผูกทั้งก้อน ตัวช่วยเหล่านี้จะเปลี่ยน identity บ่อยจนไป trigger effect ของคนที่ใส่มันใน deps
  return useMemo(
    () => {
      // ตัวแทนผู้ใช้ที่มีครบทั้งสองมิติ: rank = ตำแหน่งในองค์กร · role = ชั้นในระบบ
      const who = { rank: role, role: systemRole };
      return {
        role,
        systemRole,
        label: rankLabel(role),
        department: departmentOf(role),
        can: (capability) => canWithRole(who, capability),
        isRole: (...roles) => isRoleOf(who, ...roles),
        isAdminOrManager: isAdminOrManagerOf(who),
      };
    },
    /**
     * ⚠️ permVersion จำเป็นจริง แม้ eslint จะบอกว่า "ไม่ได้ใช้ในนี้" — ตารางสิทธิ์ที่ผู้ดูแลปรับเองถูกเก็บใน
     * ตัวแปรระดับโมดูลของ shared/utils/roles.js ซึ่ง React มองไม่เห็นว่าเปลี่ยน ถ้าไม่ผูกเวอร์ชันไว้
     * เมนูจะยังเป็นของเดิมจนกว่าจะรีเฟรชหน้า
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [role, systemRole, permVersion]
  );
}
