/**
 * หน้า "การดำเนินงาน" — ของสายงานช่างล้วนๆ
 *
 * ⚠️ ฝ่ายขายเข้าไม่ได้ (เด้งกลับไปหน้าปฏิทินของตัวเอง) — หน้านี้ทั้งหน้าสร้างมารอบงานของช่าง:
 * เอกสาร 4 ชนิด · เช็คอินหน้างาน · คำขอปิดงาน · ทีมที่เข้างาน ซึ่งไม่มีอะไรเกี่ยวกับนัดของเซลเลย
 * และ server กรองด้วย department อยู่แล้ว เซลกดเข้ามาก็เห็นแต่หน้าเปล่า
 *
 * ⚠️ นี่คือ "กันไม่ให้หลงเข้ามา" ไม่ใช่ด่านความปลอดภัย — ข้อมูลจริงถูกกรองที่ server ทุกเส้นทาง
 * (ดู departmentScope ใน routes/calendarEvent/shared.js)
 */
import { Navigate } from "react-router-dom";

import { useAuth } from "@/features/auth/AuthContext";
import { ROLES } from "@/shared/utils/roles";
import Operation from "../components/OperationBoard/index";

const Operate = () => {
  const { userData } = useAuth();
  const isSale = (userData?.role || "").toLowerCase() === ROLES.SALE;

  if (isSale) return <Navigate to="/event" replace />;

  return <Operation />;
};

export default Operate;
