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
import { Navigate } from "react-router-dom";

import { useAuth } from "@/features/auth/AuthContext";
import { can } from "@/shared/utils/roles";
import Operation from "../components/OperationBoard/index";

const Operate = () => {
  const { userData } = useAuth();
  // อัปเดตงานคนอื่นได้ หรือเป็นช่างที่รับงานเอง — ตรงกับเงื่อนไขโชว์เมนูเป๊ะ
  const canOpen = can(userData, "editOperation") || can(userData, "receiveDispatch");

  if (!canOpen) return <Navigate to="/dashboard" replace />;

  return <Operation />;
};

export default Operate;
