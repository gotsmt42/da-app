/**
 * CustomerHub — หน้า "ลูกค้า" หน้าเดียวจบ
 *
 * ✅ รวม 2 หน้าที่เดิมแยกกันคนละหมวดในเมนู ทั้งที่เป็นข้อมูลของเอนทิตีเดียวกัน:
 *   • "ภาพรวมลูกค้า" (/customer-overview) เคยอยู่ใต้หมวด "ทีมงาน" — ซึ่งผิดความหมายด้วยซ้ำ
 *   • "Customer" (/customer) เคยอยู่ใต้ "ADMIN MANAGEMENT" ท้ายเมนู
 * เดิมคนที่กำลังดูภาพรวมลูกค้าแล้วอยากแก้ที่อยู่/เลขผู้เสียภาษี ต้องเลื่อนไปสุดเมนูแล้วเปลี่ยนหน้า
 * ทั้งที่เป็นลูกค้ารายเดิมที่กำลังดูอยู่
 *
 * ⚠️ สิทธิ์ของแต่ละแท็บไม่เท่ากัน และต้อง "ไม่สร้างแท็บ" ที่ผู้ใช้ไม่มีสิทธิ์เลย ไม่ใช่แค่ซ่อน —
 * CustomerOverview มี guard ในตัวที่ redirect ทั้งแอปไป /dashboard ถ้า role ไม่ผ่าน ถ้าเผลอ
 * mount ไว้จะเด้งออกทันทีแม้ผู้ใช้ไม่ได้เปิดแท็บนั้น (ดูคอมเมนต์ที่ TabbedPage)
 */
import { lazy } from "react";
import { Navigate } from "react-router-dom";
import { Dashboard as DashboardIcon, ListAlt } from "@mui/icons-material";
import TabbedPage from "../../components/common/TabbedPage";
import { useAuth } from "../../auth/AuthContext";

const CustomerOverview = lazy(() => import("./CustomerOverview"));
const Customer = lazy(() => import("./Customer"));

const CustomerHub = () => {
  const { userData } = useAuth();
  const role = userData?.role?.toLowerCase();
  const isAdmin = role === "admin";
  const isAdminOrManager = ["admin", "manager"].includes(role);

  // ⚠️ กันช่างเปิดหน้านี้ตรงๆ ผ่าน URL — เทียบ pattern เดียวกับที่แต่ละหน้าเดิมทำอยู่แล้ว
  if (!isAdminOrManager) return <Navigate to="/dashboard" replace />;

  const tabs = [
    {
      key: "overview",
      label: "ภาพรวมลูกค้า",
      icon: <DashboardIcon sx={{ fontSize: 18 }} />,
      render: () => <CustomerOverview />,
    },
    // ทะเบียนลูกค้า (เพิ่ม/แก้ไข/ลบ) — เฉพาะ admin เหมือน route เดิมที่ห่อด้วย AdminRoute
    isAdmin && {
      key: "registry",
      label: "ทะเบียนลูกค้า",
      icon: <ListAlt sx={{ fontSize: 18 }} />,
      render: () => <Customer />,
    },
  ];

  return <TabbedPage tabs={tabs} />;
};

export default CustomerHub;
