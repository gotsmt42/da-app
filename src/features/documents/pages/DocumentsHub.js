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

import { Suspense } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { can } from "@/shared/utils/roles";
import lazyWithRetry from "@/shared/utils/lazyWithRetry";
import PageLoader from "@/shared/ui/PageLoader";

/**
 * 🔁 (26 พ.ย. 2569 ผู้ใช้: "2 แถบนี้ตัดออกไปก่อน ไม่ได้ใช้งาน") ตัดแท็บ "เอกสารประจำงาน" กับ "คลังไฟล์" ออก
 *    เหลือ "เอกสารที่ออกจากระบบ" หน้าเดียว (ไม่มีแถบแท็บ) · ลิงก์เก่า ?tab=job / ?tab=files มาที่หน้านี้แทน
 *    ⚠️ ไฟล์ JobDocuments.js / Files.js ยังเก็บไว้ — เปิดกลับได้โดยใส่แท็บคืน (TabbedPage) ตามโค้ดเดิมใน git
 */
const IssuedDocuments = lazyWithRetry(() => import("./IssuedDocuments"));

const DocumentsHub = () => {
  const { userData } = useAuth();
  // ✅ ถามตารางสิทธิ์ (เดิมฮาร์ดโค้ดว่า "เซลเข้าไม่ได้" — ติ๊กในตารางแล้วไม่มีผล)
  if (!can(userData, "viewDocuments")) return <Navigate to="/dashboard" replace />;

  return (
    <Suspense fallback={<PageLoader />}>
      <IssuedDocuments />
    </Suspense>
  );
};

export default DocumentsHub;
