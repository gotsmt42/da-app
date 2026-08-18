/**
 * jobDocTypes.js — นิยาม "เอกสารของงาน" 4 ชนิด ที่ช่างแนบจากหน้าการดำเนินงาน
 *
 * ⚠️ ต้นฉบับเดียวของ ชื่อ/ฟิลด์ในฐานข้อมูล/ไอคอน/สี — เดิมชุดนี้ถูกก๊อปไว้ 2 ที่แล้ว
 * (Operation/index.js → DOC_TYPE_META และ TechnicianJobPanel.js → DOCUMENT_TYPES) พอหน้า
 * "ภาพรวมงาน" ต้องใช้ด้วยจะกลายเป็นสำเนาที่ 3 ที่ต้องแก้พร้อมกันตลอดไป — ย้ายมารวมไว้ที่นี่แทน
 *
 * ⚠️ ลำดับในอาร์เรย์นี้คือลำดับที่แสดงผลทุกที่ในระบบ — เรียงตามลำดับที่เกิดขึ้นจริงในสายงาน
 * (รายงานผลงาน → เสนอราคา → วางบิล → ส่งมอบ) ไม่ใช่เรียงตามตัวอักษร
 */
import { Description, RequestQuote, ReceiptLong, AssignmentTurnedIn } from "@mui/icons-material";

export const JOB_DOC_TYPES = [
  { key: "report", field: "reportFiles", label: "Service Report", color: "#3b82f6", Icon: Description },
  { key: "quotation", field: "quotationFiles", label: "ใบเสนอราคา", color: "#ef4444", Icon: RequestQuote },
  { key: "invoice", field: "invoiceFiles", label: "ใบวางบิล", color: "#f59e0b", Icon: ReceiptLong },
  { key: "completion", field: "completionFiles", label: "ใบส่งมอบงาน", color: "#07941a", Icon: AssignmentTurnedIn },
];

/** map แบบ key → นิยาม สำหรับที่ที่รู้ key อยู่แล้ว (เช่นประวัติกิจกรรม) */
export const JOB_DOC_TYPE_BY_KEY = Object.fromEntries(JOB_DOC_TYPES.map((t) => [t.key, t]));

/**
 * ไฟล์นี้เป็นรูปที่แสดงในหน้าเว็บได้ไหม
 * ⚠️ ต้องเช็คทั้ง mime type และนามสกุล — ไฟล์เก่าบางไฟล์ไม่มี fileType เก็บไว้ (อัปโหลดก่อนที่ระบบ
 * จะเริ่มบันทึกฟิลด์นี้) ถ้าดูแค่ mime อย่างเดียวไฟล์เก่าจะกลายเป็น "ไฟล์เอกสาร" ทั้งที่เป็นรูป
 */
export const isImageFile = (f) =>
  /^image\//.test(f?.fileType || "") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f?.fileName || "");

/**
 * รวมเอกสารของ "ครั้งที่ N" ทั้งครั้ง — 1 ครั้งมีได้หลาย document (เข้าหลายช่วงไม่ต่อเนื่อง)
 * ไฟล์จึงกระจายอยู่หลาย document ต้องรวมให้เห็นเป็นชุดเดียวของครั้งนั้น
 *
 * ⚠️ ติด _visit กลับไปกับไฟล์ด้วย — ครั้งที่มีหลายวัน ต้องบอกได้ว่าไฟล์นี้มาจากการเข้างานวันไหน
 * ไม่งั้นเปิดดูแล้วไม่รู้ว่าเป็นเอกสารของรอบย่อยไหน
 * @returns {Array<{key,label,color,Icon,files:Array}>} เฉพาะชนิดที่มีไฟล์จริง
 */
export const roundDocs = (roundVisits = []) =>
  JOB_DOC_TYPES
    .map((t) => ({
      ...t,
      files: roundVisits.flatMap((v) =>
        (v?.[t.field] || []).map((f) => ({ ...f, _visit: v }))),
    }))
    .filter((t) => t.files.length > 0);

/** จำนวนไฟล์ทั้งหมดของครั้งนี้ (ทุกชนิดรวมกัน) */
export const roundDocsCount = (roundVisits = []) =>
  roundDocs(roundVisits).reduce((sum, t) => sum + t.files.length, 0);
