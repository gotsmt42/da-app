/**
 * ด่านหน้าเพจ — บอกว่าต้องมี "สิทธิ์อะไร" ถึงเข้าหน้านี้ได้
 *
 * 🐛 ที่แก้: เดิมทุกหน้าใช้ manageAll อย่างเดียว ทำให้
 *   • หน้าตั้งค่าองค์กร: Role = Admin เปิดหน้าได้ แต่กดบันทึกแล้ว server ตอบ 403 (ตั้งไม่ได้จริง)
 *   • หน้าข้อมูลหลัก: ติ๊ก manageMasterData ให้ Rank ไหนก็ไม่มีผล เพราะด่านนี้ถาม manageAll
 * ✅ จึงรับ cap ได้ และที่สำคัญ: ชื่อ cap ต้องตรงกับที่ server ใช้จริงใน route นั้นเสมอ
 */
import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { can } from "@/shared/utils/roles";

const AdminRoute = ({ children, cap = "manageAll", fallback = "/dashboard" }) =>
  (can(useAuth().userData, cap) ? children : <Navigate to={fallback} replace />);

export default AdminRoute;
