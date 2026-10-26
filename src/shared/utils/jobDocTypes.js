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

// ✅ (3 ต.ค. 2569) สีชุดเดียวกับหน้าแนบเอกสารของช่าง — ไม่ใช้แดง/ม่วง (ผู้ใช้: "สีแดงๆ ดูรก", "ไม่เอาสีม่วง")
//    desc = คำอธิบายสั้นว่าเอกสารนี้คืออะไร ใช้ทำอะไรต่อ (แสดงในหน้าแอดมิน)
export const JOB_DOC_TYPES = [
  { key: "report", field: "reportFiles", label: "Service Report", color: "#2563eb", Icon: Description,
    desc: "ใบรายงานผลการเข้าปฏิบัติงานครั้งนี้ — ทุกงานต้องมีก่อนปิดงาน" },
  // 🔁 (26 ต.ค. 2569 ผู้ใช้: "อยากให้ระบุชัดเจนว่าคือใบเสนอราคาเพิ่มเติม แบบนี้อาจจะสับสน")
  { key: "quotation", field: "quotationFiles", label: "ใบเสนอราคาเพิ่มเติม", color: "#d97706", Icon: RequestQuote,
    desc: "เสนอราคางานเพิ่มเติม/อะไหล่ที่พบหน้างาน — ไฟล์ที่แนบจะไปอยู่ในหน้า “ติดตามใบเสนอราคา”" },
  { key: "invoice", field: "invoiceFiles", label: "ใบวางบิล", color: "#0891b2", Icon: ReceiptLong,
    desc: "ใบวางบิล/ใบแจ้งหนี้ที่วางให้ลูกค้าสำหรับงานครั้งนี้" },
  { key: "completion", field: "completionFiles", label: "ใบส่งมอบงาน", color: "#059669", Icon: AssignmentTurnedIn,
    desc: "ใบส่งมอบงานที่ลูกค้าเซ็นรับงานเรียบร้อยแล้ว" },
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

// ── บังคับ/ครบ ของเอกสารแต่ละชนิด (เดิมอยู่ใน TechnicianJobPanel — ย้ายมาให้ตารางใช้ตรรกะเดียวกับการ์ด) ──
// ผู้ใช้พิมพ์ "pm"/"Pm" ด้วย จึงเทียบแบบไม่สนตัวพิมพ์เล็กใหญ่
const isPMJob = (event) => (event?.title || "").trim().toUpperCase() === "PM";
export const isDocRequired = (event, type) => {
  if (type === "report") return true;
  if (type === "quotation") return false;
  return isPMJob(event); // invoice / completion
};

// เอกสารชนิดนี้ถือว่า "เสร็จ" แล้วหรือยัง
//   • report: ต้องติ๊กยืนยัน "และ" มีไฟล์
//   • เอกสารที่บังคับตามประเภทงาน (เช่น ใบวางบิลของงาน PM): ต้องมีไฟล์เท่านั้น ไม่มีทางเลือก "ไม่มี"
//   • เอกสารที่ไม่บังคับ: ตอบ "ไม่มี" ก็เสร็จ / ตอบ "มี" ต้องแนบไฟล์อย่างน้อย 1 ไฟล์
export const isDocComplete = (event, type) => {
  const hasFiles = (event[`${type}Files`] || []).length > 0;
  // Service Report: บังคับต้องติ๊ก "และ" ต้องแนบไฟล์จริงอย่างน้อย 1 ไฟล์ ถึงจะถือว่าเสร็จ
  if (type === "report") return Boolean(event.documentSentReport) && hasFiles;
  // ⚠️ ต้องเช็คก่อน applicable เสมอ — งาน PM ที่ช่างเคยกด "ไม่มี" ไว้ตอนที่ยังไม่บังคับ ต้องกลับมา
  // นับว่ายังไม่เสร็จ ไม่ใช่ผ่านไปเพราะค่าเดิมที่ค้างอยู่ในฐานข้อมูล
  if (isDocRequired(event, type)) return hasFiles;
  const applicable = event[`${type}Applicable`];
  if (applicable === false) return true;
  if (applicable === true) return hasFiles;
  return false;
};
