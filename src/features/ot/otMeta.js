/**
 * otMeta.js — ป้าย/สี/ตัวช่วยของระบบ OT (ใบขออนุมัติทำงานล่วงเวลา)
 * ⚠️ ค่าดิบ (type/status) ต้องตรงกับ da-app-server/src/models/OtRequest.js
 * ⚠️ ชั่วโมง/เงินที่คำนวณในหน้าจอเป็นพรีวิวเท่านั้น — server คำนวณใหม่ทุกครั้ง (routes/ot.js)
 */
import moment from "moment";

// 🎨 (27 ต.ค. 2569 ผู้ใช้: "ไม่ให้สีเหมือน advance") สีประจำหมวด "บุคคล" ชุดเดียวกับไอคอนหมวดบนหน้าแรก (ฟ้าอมเขียว)
export const OT_ACCENT = "#0891b2";
export const OT_DARK = "#0e7490";
export const TEXT_MAIN = "#0f172a";
export const TEXT_SUB = "#64748b";
export const BORDER_MAIN = "#e2e8f0";

/** ประเภท OT — สีใช้เฉพาะจุดเล็ก/ป้ายอ่อน (ผู้ใช้แจ้งว่าสีเยอะแล้วรกตา) */
export const OT_TYPES = [
  { value: "workdayOT", label: "OT วันทำงาน", short: "วันทำงาน", color: "#1d4ed8", bg: "#eff6ff" },
  { value: "holidayWork", label: "ทำงานวันหยุด", short: "วันหยุด", color: "#b45309", bg: "#fffbeb" },
  { value: "holidayOT", label: "OT วันหยุด", short: "OT วันหยุด", color: "#be123c", bg: "#fff1f2" },
];
export const typeMeta = (v) => OT_TYPES.find((t) => t.value === v) || OT_TYPES[0];

/** สถานะ — ชุดสี/คำเดียวกับระบบเบิก (ผู้ใช้อ่านแบบเดียวกันทั้งแอป) */
export const OT_STATUS = {
  pending: { label: "รอตรวจสอบ", color: "#b45309", bg: "#fffbeb", border: "#fcd34d" },
  reviewed: { label: "รออนุมัติ", color: "#6d28d9", bg: "#f5f3ff", border: "#c4b5fd" },
  // 🔁 (27 ต.ค. 2569) ระบบ OT ไม่ยุ่งกับเงินแล้ว — อนุมัติ = จบ · ปิดรอบ = ส่งชั่วโมงให้ฝ่ายบุคคล/บัญชีแล้ว
  approved: { label: "อนุมัติแล้ว", short: "อนุมัติแล้ว", color: "#15803d", bg: "#f0fdf4", border: "#86efac" },
  paid: { label: "ปิดรอบแล้ว · ส่งชั่วโมงแล้ว", short: "ปิดรอบแล้ว", color: "#475569", bg: "#f8fafc", border: "#cbd5e1" },
  rejected: { label: "ตีกลับให้แก้", color: "#b91c1c", bg: "#fef2f2", border: "#fca5a5" },
  cancelled: { label: "ยกเลิก", color: "#64748b", bg: "#f8fafc", border: "#cbd5e1" },
};
export const otStatus = (s) => OT_STATUS[s] || { label: s || "-", color: TEXT_SUB, bg: "#f8fafc", border: BORDER_MAIN };
export const STATUS_ORDER = ["pending", "reviewed", "rejected", "approved", "paid", "cancelled"];

export const money = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const baht = (n) => {
  const v = money(n);
  return `฿${v.toLocaleString("th-TH", { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 })}`;
};
/** 3.5 → "3 ชม. 30 น." */
export const hoursText = (h) => {
  const mins = Math.round((Number(h) || 0) * 60);
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  if (!mins) return "0 ชม.";
  return [hh ? `${hh} ชม.` : "", mm ? `${mm} น.` : ""].filter(Boolean).join(" ");
};

const toMin = (t) => {
  const m = String(t || "").match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** ชั่วโมงของบรรทัด — สูตรเดียวกับ server (hoursOf) · null = เวลายังไม่ครบ/ผิด */
/**
 * พักเที่ยง 12:00–13:00 ไม่นับเป็นชั่วโมง OT — ✅ (27 ต.ค. 2569 ผู้ใช้: "เวลาทำงานไม่ต้องนับเที่ยง 12.00 ด้วย")
 * หักเฉพาะส่วนที่ช่วง OT คร่อมจริง (เช่น 08:30–17:30 = 9 ชม. − 1 = 8 ชม. · 11:30–12:30 หัก 30 นาที)
 * ⚠️ ต้องตรงกับ server (routes/ot.js · lunchOverlap) — server คำนวณซ้ำเองไม่เชื่อค่าจากหน้าจอ
 */
const LUNCH = [12 * 60, 13 * 60];
const lunchOverlap = (a, dur) => [0, 1440].reduce((t, off) => t + Math.max(0, Math.min(a + dur, LUNCH[1] + off) - Math.max(a, LUNCH[0] + off)), 0);
export const lineHours = (start, end, breakMin) => {
  const a = toMin(start);
  const b = toMin(end);
  if (a === null || b === null || a === b) return null;
  const dur = b > a ? b - a : b + 1440 - a;
  if (dur > 16 * 60) return null;
  const brk = Math.min(Math.max(Math.round(Number(breakMin) || 0), 0) + lunchOverlap(a, dur), dur - 1);
  return Math.round(((dur - brk) / 60) * 100) / 100;
};

/** เลิกก่อนเริ่ม = ข้ามเที่ยงคืน */
export const crossesMidnight = (start, end) => {
  const a = toMin(start);
  const b = toMin(end);
  return a !== null && b !== null && b < a;
};

/**
 * เดาประเภท OT จากวันที่ — ✅ ให้กรอกง่าย: วันหยุด (นักขัตฤกษ์/วันหยุดประจำสัปดาห์) + เริ่มในเวลางาน = ทำงานวันหยุด
 * วันหยุด + เริ่มตั้งแต่ 17:30 (เวลาเลิกงาน) = OT วันหยุด · วันปกติ = OT วันทำงาน (ผู้ใช้เปลี่ยนเองได้เสมอ)
 */
/**
 * วันหยุดประจำสัปดาห์ — ✅ (27 ต.ค. 2569 ผู้ใช้: "วันเสาร์ อาทิตย์ คือทำงานวันหยุด · จ-ศ คือ OT วันทำงาน")
 * เสาร์ (6) + อาทิตย์ (0) เป็นวันหยุดเสมอ รวมกับที่ตั้งไว้ในตั้งค่าองค์กร (ถ้ามีวันอื่นเพิ่ม)
 */
export const restDaysOf = (cfg) => [...new Set([0, 6, ...(cfg?.restDays || [])])];

/**
 * เวลาตั้งต้นตามประเภท OT — ✅ ผู้ใช้: "ทำงานวันหยุด 8.30-17.30 · OT วันทำงานเริ่ม 17.30 · OT วันหยุดเริ่ม 17.30"
 */
export const TYPE_TIME = {
  workdayOT: { start: "17:30", end: "20:30" },
  holidayWork: { start: "08:30", end: "17:30" },
  holidayOT: { start: "17:30", end: "20:30" },
};
export const timeForType = (type) => TYPE_TIME[type] || TYPE_TIME.workdayOT;

export const guessType = (date, start, cfg) => {
  if (!date) return "workdayOT";
  const holiday = Boolean(cfg?.holidays?.[date]) || restDaysOf(cfg).includes(moment(date).day());
  if (!holiday) return "workdayOT";
  const a = toMin(start);
  return a !== null && a >= 17 * 60 + 30 ? "holidayOT" : "holidayWork"; // 🔁 (27 ต.ค. 2569) เลิกงาน 17:30
};

/** ชื่อวันหยุด (ถ้ามี) — "วันหยุด: วันจักรี" / "วันหยุดประจำสัปดาห์" */
export const holidayNote = (date, cfg) => {
  if (!date) return "";
  if (cfg?.holidays?.[date]) return cfg.holidays[date];
  return restDaysOf(cfg).includes(moment(date).day()) ? "วันหยุดประจำสัปดาห์" : "";
};

/** "2026-09" → "ก.ย. 2569" */
export const periodLabel = (p) => {
  const [y, m] = String(p || "").split("-").map(Number);
  if (!y || !m) return "-";
  const TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${TH[m - 1]} ${y + 543}`;
};
