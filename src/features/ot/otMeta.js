/**
 * otMeta.js — ป้าย/สี/ตัวช่วยของระบบ OT (ใบขออนุมัติทำงานล่วงเวลา)
 * ⚠️ ค่าดิบ (type/status) ต้องตรงกับ da-app-server/src/models/OtRequest.js
 * ⚠️ ชั่วโมง/เงินที่คำนวณในหน้าจอเป็นพรีวิวเท่านั้น — server คำนวณใหม่ทุกครั้ง (routes/ot.js)
 */
import moment from "moment";

export const OT_ACCENT = "#0f766e";
export const OT_DARK = "#115e59";
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
  approved: { label: "อนุมัติแล้ว · รอจ่ายพร้อมเงินเดือน", short: "รอจ่ายพร้อมเงินเดือน", color: "#1d4ed8", bg: "#eff6ff", border: "#93c5fd" },
  paid: { label: "จ่ายพร้อมเงินเดือนแล้ว", short: "จ่ายแล้ว", color: "#15803d", bg: "#f0fdf4", border: "#86efac" },
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
export const lineHours = (start, end, breakMin) => {
  const a = toMin(start);
  const b = toMin(end);
  if (a === null || b === null || a === b) return null;
  const dur = b > a ? b - a : b + 1440 - a;
  if (dur > 16 * 60) return null;
  const brk = Math.min(Math.max(Math.round(Number(breakMin) || 0), 0), dur - 1);
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
 * วันหยุด + เริ่มหลัง 17:00 = OT วันหยุด · วันปกติ = OT วันทำงาน (ผู้ใช้เปลี่ยนเองได้เสมอ)
 */
export const guessType = (date, start, cfg) => {
  if (!date) return "workdayOT";
  const holiday = Boolean(cfg?.holidays?.[date]) || (cfg?.restDays || [0]).includes(moment(date).day());
  if (!holiday) return "workdayOT";
  const a = toMin(start);
  return a !== null && a >= 17 * 60 ? "holidayOT" : "holidayWork";
};

/** ชื่อวันหยุด (ถ้ามี) — "วันหยุด: วันจักรี" / "วันหยุดประจำสัปดาห์" */
export const holidayNote = (date, cfg) => {
  if (!date) return "";
  if (cfg?.holidays?.[date]) return cfg.holidays[date];
  return (cfg?.restDays || [0]).includes(moment(date).day()) ? "วันหยุดประจำสัปดาห์" : "";
};

/** "2026-09" → "ก.ย. 2569" */
export const periodLabel = (p) => {
  const [y, m] = String(p || "").split("-").map(Number);
  if (!y || !m) return "-";
  const TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${TH[m - 1]} ${y + 543}`;
};
