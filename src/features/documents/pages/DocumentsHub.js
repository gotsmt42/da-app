/**
 * DocumentsHub — หน้า "เอกสาร" หน้าเดียวจบ
 *
 * ✅ รวม 2 หน้าที่เดิมแยกกัน ทั้งที่คนใช้มองว่าเป็นเรื่องเดียวกันคือ "หาเอกสารของงานนี้":
 *   • "เอกสารทั้งหมด" (/files) — ไฟล์ที่แนบไว้กับงาน (รูปหน้างาน/รายงาน/ใบเสร็จ ฯลฯ)
 *   • "ทะเบียนเอกสาร" (/issued-documents) — เอกสารที่ "ระบบออกให้" (ใบแจ้งเข้างาน/ใบส่งมอบงาน)
 * ต่างกันแค่ที่มาของไฟล์ ซึ่งคนหาเอกสารไม่ได้แยกในหัวอยู่แล้ว — เดิมต้องเดาว่าใบที่ตามหาอยู่หน้าไหน
 *
 * ⚠️ ทั้ง 2 แท็บเปิดให้ทุก role ของสายบริการ (ช่างต้องตามหาไฟล์/ใบของงานตัวเองได้) —
 * การจำกัดสิทธิ์ "แก้ไข" ยังอยู่ในตัวหน้าแต่ละหน้าเหมือนเดิมทุกประการ
 *
 * ⚠️ ฝ่ายขายเข้าไม่ได้ — เอกสารทั้งสองชุดผูกกับ "งานของช่าง" ทั้งหมด (รายงานหน้างาน/ใบแจ้งเข้างาน/
 * ใบส่งมอบงาน) เซลเปิดเข้ามาก็เห็นแต่เอกสารของคนอื่น ส่วนเอกสารการค้าของเซล (ใบเสนอราคา/PO)
 * อยู่ในใบแจ้งงานที่เขาส่งเอง (features/dispatch)
 */
import { lazy } from "react";
import { Navigate } from "react-router-dom";
import { FolderOpen, Description } from "@mui/icons-material";
import TabbedPage from "@/shared/ui/TabbedPage";
import { useAuth } from "@/features/auth/AuthContext";
import { isRole, ROLES } from "@/shared/utils/roles";

const Files = lazy(() => import("./Files"));
const IssuedDocuments = lazy(() => import("./IssuedDocuments"));

const DocumentsHub = () => {
  const { userData } = useAuth();
  if (isRole(userData, ROLES.SALE)) return <Navigate to="/dashboard" replace />;

  return (
  <TabbedPage
    tabs={[
      {
        key: "files",
        label: "ไฟล์แนบของงาน",
        icon: <FolderOpen sx={{ fontSize: 18 }} />,
        render: () => <Files />,
      },
      {
        key: "issued",
        label: "เอกสารที่ออกจากระบบ",
        icon: <Description sx={{ fontSize: 18 }} />,
        render: () => <IssuedDocuments />,
      },
    ]}
  />
  );
};

export default DocumentsHub;
