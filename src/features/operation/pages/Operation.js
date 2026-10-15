/**
 * หน้า "การดำเนินงาน"
 *
 * 🐛 ที่แก้: เดิมเขียนตรงๆว่า "ถ้าเป็นเซลให้เด้งออก" — ติ๊ก "อัปเดตการดำเนินงาน"
 * ให้เซลในตารางสิทธิ์แล้วก็ยังเข้าหน้านี้ไม่ได้ (ตั้งค่าไปก็ไม่มีผลจริง)
 * ✅ เปลี่ยนมาถามสิทธิ์แทน — เกณฑ์เดียวกับการโชว์เมนู (HomeMenu/navConfig) จึงไม่มีเมนูที่กดแล้วเด้ง
 *
 * ⚠️ นี่คือ "กันหลงเข้า" ไม่ใช่ด่านความปลอดภัย — ข้อมูลจริงถูกกรองที่ server ทุกเส้นทาง
 * (ดู departmentScope ใน routes/calendarEvent/shared.js)
 */
import { Navigate, useParams } from "react-router-dom";

import { useAuth } from "@/features/auth/AuthContext";
import { can, seesOperationBoard } from "@/shared/utils/roles";
import Operation from "../components/OperationBoard/index";

const Operate = () => {
  const { userData } = useAuth();
  // อัปเดตงานคนอื่นได้ หรือเป็นช่างที่รับงานเอง — ตรงกับเงื่อนไขโชว์เมนูเป๊ะ
  const { id } = useParams();
  // 🔁 (15 ต.ค. 2569 ผู้ใช้เลือก "ช่างใช้งานของฉันที่เดียว") — ช่าง (รับงานอย่างเดียว) ไม่เห็นหน้าการดำเนินงานแล้ว · ทำงานที่ "งานของฉัน"
  //    ลิงก์เก่า/แจ้งเตือนที่ชี้มาที่ /operation/:id ของช่าง → เปิดงานนั้นในหน้างานของฉันแทน
  const canOpen = seesOperationBoard(userData);
  if (!canOpen && can(userData, "receiveDispatch")) return <Navigate to={id ? `/technician/jobs?job=${id}` : "/technician/jobs"} replace />;

  if (!canOpen) return <Navigate to="/dashboard" replace />;

  return <Operation />;
};

export default Operate;
