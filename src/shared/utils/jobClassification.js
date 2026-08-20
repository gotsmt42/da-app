/**
 * jobClassification.js — แยกประเภทงาน 3 แบบ: งานทั่วไป / งานโปรเจค / งานสัญญา ให้เป็นค่าเดียวมาตรฐาน
 * ("general" | "project" | "contract" | "") ใช้ร่วมกันได้ทุกที่ที่ต้องโชว์สัญลักษณ์บอกประเภทงาน
 * (ปฏิทิน/หน้าดำเนินงาน/หน้าแก้ไขงาน ฯลฯ) กันแต่ละจุดตัดสินไม่ตรงกัน
 *
 * ✅ ลำดับการตัดสิน (ตรงกับ groupEventsByContract ใน shared/utils/contractOverdue.js):
 * 1) มี contractGroupId → "contract" เสมอ (ไม่สนใจ jobClassification เพราะงานสัญญาไม่ได้ตั้งค่านี้)
 * 2) jobClassification ที่บันทึกไว้ตรงๆ ("general"/"project")
 * 3) isConfirmedGeneral (ค่าเก่าก่อนมีฟีเจอร์นี้) → "general"
 * 4) ไม่มีข้อมูลเลย (งานเก่าก่อนมีระบบจัดหมวดหมู่) → "" (ไม่ทราบ/ยังไม่จัดประเภท)
 */
// 🎨 สีประจำประเภทงาน — ใช้วาดแถบขอบซ้ายบนการ์ดงานในปฏิทิน และชิปบอกประเภทในหน้าอื่นๆ
// 🐛 BUG ที่แก้ (แถบสีประเภทงานมองไม่เห็น): "งานสัญญา" เคยใช้ #6366f1 ซึ่งเป็น "สีเดียวกันเป๊ะ" กับ
// สีพื้นหลังงานเริ่มต้นของปฏิทิน (defaultBackgroundColor ใน EventCalendar/index.js) — แถบขอบซ้ายจึง
// กลืนหายไปกับพื้นหลังการ์ดจนมองไม่เห็นเลยสำหรับงานที่ยังไม่ได้เปลี่ยนสีเอง (ซึ่งเป็นงานส่วนใหญ่)
// และงานสัญญาที่สร้างจากหน้า "ภาพรวมงาน" ใช้พื้นหลัง #3788d8 (น้ำเงิน) ซึ่งก็ใกล้เคียงกันมากอีก
// ส่วน "งานทั่วไป" ใช้เทาอ่อน #94a3b8 ที่คอนทราสต์ต่ำเกินไปบนพื้นหลังเข้มแทบทุกสี
// ✅ เลือกสีที่อยู่คนละโทนกับพื้นหลังที่ใช้จริงทั้งสองแบบ (คราม/น้ำเงิน) และแยกจากกันเองชัดเจน:
//    ส้ม (สัญญา) / เขียวน้ำทะเล (โปรเจค) / เทาเข้ม (ทั่วไป)
// ⚠️ ยังมีเส้นคั่นขาวบางๆ ประกบแถบสีอีกชั้นในปฏิทิน (ดู .fc-event-type-* ใน EventCalendar/index.js)
// เผื่อกรณีผู้ใช้เลือกสีพื้นหลังเองจนบังเอิญใกล้เคียงกับสีแถบ — แถบจะยังแยกออกจากพื้นหลังได้เสมอ
export const JOB_CLASS_META = {
  contract: { label: "งานสัญญา",  emoji: "🔁", color: "#f97316" },
  project:  { label: "งานโปรเจค", emoji: "🏗️", color: "#0d9488" },
  general:  { label: "งานทั่วไป", emoji: "🔧", color: "#475569" },
};

// ✅ รับได้ทั้ง FullCalendar extendedProps และ state ดิบ (field top-level ตรงๆ) — สองรูปแบบข้อมูล
// ที่ใช้ปนกันอยู่ทั่วทั้งฟีเจอร์นี้ (ดูคอมเมนต์เดียวกันในไฟล์อื่นๆ ใน EventCalendar/)
export const classifyJob = (source) => {
  if (!source) return "";
  const contractGroupId = source.contractGroupId ?? source.extendedProps?.contractGroupId;
  if (contractGroupId) return "contract";
  const jobClassification = source.jobClassification ?? source.extendedProps?.jobClassification;
  if (jobClassification === "project") return "project";
  if (jobClassification === "general") return "general";
  const isConfirmedGeneral = source.isConfirmedGeneral ?? source.extendedProps?.isConfirmedGeneral;
  return isConfirmedGeneral ? "general" : "";
};

export const getJobClassMeta = (jobClass) => JOB_CLASS_META[jobClass] || null;
