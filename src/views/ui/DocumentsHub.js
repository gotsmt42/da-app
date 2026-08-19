/**
 * DocumentsHub — หน้า "เอกสาร" หน้าเดียวจบ
 *
 * ✅ รวม 2 หน้าที่เดิมแยกกัน ทั้งที่คนใช้มองว่าเป็นเรื่องเดียวกันคือ "หาเอกสารของงานนี้":
 *   • "เอกสารทั้งหมด" (/files) — ไฟล์ที่แนบไว้กับงาน (รูปหน้างาน/รายงาน/ใบเสร็จ ฯลฯ)
 *   • "ทะเบียนเอกสาร" (/issued-documents) — เอกสารที่ "ระบบออกให้" (ใบแจ้งเข้างาน/ใบส่งมอบงาน)
 * ต่างกันแค่ที่มาของไฟล์ ซึ่งคนหาเอกสารไม่ได้แยกในหัวอยู่แล้ว — เดิมต้องเดาว่าใบที่ตามหาอยู่หน้าไหน
 *
 * ⚠️ ทั้ง 2 แท็บเปิดให้ทุก role เหมือน route เดิมทั้งคู่ (ช่างต้องตามหาไฟล์/ใบของงานตัวเองได้) —
 * การจำกัดสิทธิ์ "แก้ไข" ยังอยู่ในตัวหน้าแต่ละหน้าเหมือนเดิมทุกประการ
 */
import { lazy } from "react";
import { FolderOpen, Description } from "@mui/icons-material";
import TabbedPage from "../../components/common/TabbedPage";

const Files = lazy(() => import("./Files"));
const IssuedDocuments = lazy(() => import("./IssuedDocuments"));

const DocumentsHub = () => (
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

export default DocumentsHub;
