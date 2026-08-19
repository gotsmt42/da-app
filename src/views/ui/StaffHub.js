/**
 * StaffHub — หน้า "พนักงาน / ทีมช่าง" หน้าเดียวจบ
 *
 * ✅ รวม 2 หน้าที่เดิมแยกกันคนละหมวด ทั้งที่เป็นข้อมูลของคนกลุ่มเดียวกัน:
 *   • "ภาพรวมทีมช่าง" (/team-workload) — ภาระงานของช่างแต่ละคน
 *   • "Employee" (/employee) — ทะเบียนพนักงาน (เพิ่ม/แก้ไข/ลบ)
 * เดิมเห็นว่าช่างคนหนึ่งงานล้นแล้วอยากไปดู/แก้ข้อมูลพนักงานคนนั้น ต้องข้ามไปอีกหมวดท้ายเมนู
 *
 * ⚠️ เหตุผลที่ต้องกรองแท็บตามสิทธิ์ก่อน ไม่ใช่แค่ซ่อน — ดูคอมเมนต์ที่ CustomerHub/TabbedPage
 */
import { lazy } from "react";
import { Navigate } from "react-router-dom";
import { InsertChart, ListAlt } from "@mui/icons-material";
import TabbedPage from "../../components/common/TabbedPage";
import { useAuth } from "../../auth/AuthContext";

const TeamWorkload = lazy(() => import("./TeamWorkload"));
const Employee = lazy(() => import("./Employee"));

const StaffHub = () => {
  const { userData } = useAuth();
  const role = userData?.role?.toLowerCase();
  const isAdmin = role === "admin";
  const isAdminOrManager = ["admin", "manager"].includes(role);

  if (!isAdminOrManager) return <Navigate to="/dashboard" replace />;

  const tabs = [
    {
      key: "workload",
      label: "ภาระงานทีมช่าง",
      icon: <InsertChart sx={{ fontSize: 18 }} />,
      render: () => <TeamWorkload />,
    },
    // ทะเบียนพนักงาน — เฉพาะ admin เหมือน route เดิมที่ห่อด้วย AdminRoute
    isAdmin && {
      key: "registry",
      label: "ทะเบียนพนักงาน",
      icon: <ListAlt sx={{ fontSize: 18 }} />,
      render: () => <Employee />,
    },
  ];

  return <TabbedPage tabs={tabs} />;
};

export default StaffHub;
