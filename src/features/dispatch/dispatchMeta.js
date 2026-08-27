/**
 * dispatchMeta.js — ป้าย/สี ของระบบ "แจ้งงานให้ช่าง" ใช้ร่วมกันทุกหน้าในหมวดนี้
 *
 * ⚠️ ค่าดิบ (status) ต้องตรงกับ enum ใน da-app-server/src/models/Dispatch.js เป๊ะ
 * ถ้าเพิ่มค่าใหม่ต้องแก้ทั้งสองฝั่ง ไม่งั้นจะได้ป้ายว่างเปล่าบนหน้าจอโดยไม่มี error ให้เห็น
 *
 * 🧹 เดิมค่าพวกนี้อยู่ใน features/sales/salesMeta.js ปนกับป้ายของระบบ CRM (ดีล/นัดหมาย) ซึ่งถูกตัด
 * ออกไปแล้วตามที่ผู้ใช้สั่ง — ย้ายมาอยู่กับ feature ที่ใช้จริง หมวด dispatch จึงไม่ต้องพึ่ง
 * features/sales อีกต่อไป
 */
import { ROLE_COLOR, ROLES } from "@/shared/utils/roles";

/** ส้ม = ใบแจ้งงาน · ม่วง = ฝ่ายขาย (คนส่งคำขอ) — แยกสีให้รู้ว่ากำลังดูอะไรอยู่ */
export const DISPATCH_ACCENT = "#f59e0b";
export const SALES_ACCENT = ROLE_COLOR[ROLES.SALE];

export const TEXT_SUB = "#64748b";
export const BORDER_MAIN = "#e2e8f0";
export const SURFACE_SUBTLE = "#f8fafc";

/** สถานะของ "ทั้งใบ" */
export const DISPATCH_STATUS_META = {
  // ⚠️ "รอลงแผนงาน" ไม่ใช่ "รอมอบหมาย" — ใบจะพ้นสถานะนี้ก็ต่อเมื่อมีวันเข้างานจริงแล้วเท่านั้น
  // (recomputeStatus ฝั่ง server บังคับไว้) เลือกช่างไว้ก่อนไม่ทำให้ใบขยับสถานะ
  requested:   { label: "รอลงแผนงาน",    color: "#f59e0b" },
  rejected:    { label: "ตีกลับให้แก้",  color: "#ef4444" },
  assigned:    { label: "ลงแผนงานแล้ว",  color: "#3b82f6" },
  cancelled:   { label: "ยกเลิก",        color: "#94a3b8" },
};

/**
 * สถานะ "รายคน" — คนละชุดกับสถานะของทั้งใบโดยตั้งใจ
 * ใบหนึ่งมอบหมายช่างได้หลายคน แต่ละคนคืบหน้าไม่พร้อมกัน (คนหนึ่งเสร็จแล้ว อีกคนยังไม่รับทราบ)
 * ถ้าใช้ชุดเดียวกันจะตอบไม่ได้ว่า "ใครยังไม่ขยับ"
 */
export const ASSIGNEE_STATUS_META = {
  assigned:     { label: "รอรับทราบ",   color: "#94a3b8" },
  acknowledged: { label: "รับทราบแล้ว", color: "#3b82f6" },
  done:         { label: "เสร็จแล้ว",   color: "#10b981" },
  declined:     { label: "รับงานไม่ได้", color: "#ef4444" },
};

/** ย่อจำนวนเงินให้อ่านง่ายบนการ์ดแคบๆ — ฿1,250,000 → ฿1.25 ล้าน */
export const shortBaht = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e6) return `฿${(v / 1e6).toFixed(v % 1e6 === 0 ? 0 : 2)} ล้าน`;
  if (v >= 1e3) return `฿${Math.round(v / 1e3).toLocaleString("th-TH")}K`;
  return `฿${v.toLocaleString("th-TH")}`;
};

export const fullBaht = (n) =>
  `฿${(Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/**
 * ชนิดเอกสารที่แนบมากับใบแจ้งงาน — ต้องตรงกับ DOC_TYPES ใน da-app-server/src/models/Dispatch.js
 *
 * ⚠️ ใบเสนอราคา/ใบ PO ถูกจัดเป็น "เอกสารการค้า" (commercial: true) แยกจากรูปประกอบ เพราะเป็น
 * หลักฐานว่างานนี้ปิดการขายจริงแล้ว — ผู้จัดการต้องเห็นก่อนกดอนุมัติลงแผนงาน ไม่ใช่ต้องไล่เปิด
 * ไฟล์ทีละใบเพื่อหาว่ามี PO ไหม
 */
export const DOC_TYPE_META = {
  quotation:  { label: "ใบเสนอราคา", short: "QT", color: "#0891b2", commercial: true },
  po:         { label: "ใบสั่งซื้อ (PO)", short: "PO", color: "#059669", commercial: true },
  site_photo: { label: "รูปหน้างาน", short: "รูป", color: "#8b5cf6" },
  drawing:    { label: "แบบแปลน", short: "แบบ", color: "#6366f1" },
  other:      { label: "อื่นๆ", short: "อื่น", color: "#64748b" },
};

export const DOC_TYPE_ORDER = ["quotation", "po", "drawing", "site_photo", "other"];

/**
 * สถานะ "งานจริง" ของฝ่ายช่าง — ต้องตรงกับค่าใน models/Events.js (status เป็นภาษาไทยตรงๆ)
 * และตรงกับสีที่หน้า Dashboard/การดำเนินงานใช้อยู่ เพื่อให้ใบแจ้งงานกับตารางงานอ่านเป็นระบบเดียวกัน
 *
 * 🧹 มาแทน ASSIGNEE_STATUS_META (รอรับทราบ/รับทราบแล้ว/...) ที่ถูกตัดออกตามที่ผู้ใช้สั่ง —
 * ระบบสถานะซ้อนกัน 2 ชุดทำให้ใบขึ้นว่า "รอรับทราบ" ค้างตลอด ทั้งที่ช่างทำงานเสร็จไปแล้ว
 */
export const JOB_STATUS_META = {
  "กำลังรอยืนยัน":      { color: "#f97316" },
  "ยืนยันแล้ว":         { color: "#3b82f6" },
  "กำลังดำเนินการ":     { color: "#8b5cf6" },
  "ดำเนินการเสร็จสิ้น": { color: "#10b981" },
};

export const jobStatusColor = (status) => JOB_STATUS_META[status]?.color || "#64748b";
