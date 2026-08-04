/**
 * jobClassification.js — แยกประเภทงาน 3 แบบ: งานทั่วไป / งานโปรเจค / งานสัญญา ให้เป็นค่าเดียวมาตรฐาน
 * ("general" | "project" | "contract" | "") ใช้ร่วมกันได้ทุกที่ที่ต้องโชว์สัญลักษณ์บอกประเภทงาน
 * (ปฏิทิน/หน้าดำเนินงาน/หน้าแก้ไขงาน ฯลฯ) กันแต่ละจุดตัดสินไม่ตรงกัน
 *
 * ✅ ลำดับการตัดสิน (ตรงกับ groupEventsByContract ใน utils/contractOverdue.js):
 * 1) มี contractGroupId → "contract" เสมอ (ไม่สนใจ jobClassification เพราะงานสัญญาไม่ได้ตั้งค่านี้)
 * 2) jobClassification ที่บันทึกไว้ตรงๆ ("general"/"project")
 * 3) isConfirmedGeneral (ค่าเก่าก่อนมีฟีเจอร์นี้) → "general"
 * 4) ไม่มีข้อมูลเลย (งานเก่าก่อนมีระบบจัดหมวดหมู่) → "" (ไม่ทราบ/ยังไม่จัดประเภท)
 */
export const JOB_CLASS_META = {
  contract: { label: "งานสัญญา",  emoji: "🔁", color: "#6366f1" },
  project:  { label: "งานโปรเจค", emoji: "🏗️", color: "#0d9488" },
  general:  { label: "งานทั่วไป", emoji: "🔧", color: "#94a3b8" },
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
