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
  departmentOf,
  isRole as isRoleOf,
  isAdminOrManager as isAdminOrManagerOf,
  roleLabel,
} from "@/shared/utils/roles";

export default function usePermissions() {
  const { userData } = useAuth();
  const role = normalizeRole(userData);

  // ⚠️ ผูกกับ role (สตริง) ไม่ใช่ userData ทั้งก้อน — userData ถูกสร้างใหม่ทุกครั้งที่โปรไฟล์ถูกรีเฟรช
  // ถ้าผูกทั้งก้อน ตัวช่วยเหล่านี้จะเปลี่ยน identity บ่อยจนไป trigger effect ของคนที่ใส่มันใน deps
  return useMemo(
    () => ({
      role,
      label: roleLabel(role),
      department: departmentOf(role),
      can: (capability) => canWithRole(role, capability),
      isRole: (...roles) => isRoleOf(role, ...roles),
      isAdminOrManager: isAdminOrManagerOf(role),
    }),
    [role]
  );
}
