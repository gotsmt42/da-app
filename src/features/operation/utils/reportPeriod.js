import moment from "moment";
import { THAI_MONTHS_SHORT, thaiDate } from "@/shared/utils/thaiDate";

/**
 * ช่วงเวลาของรายงานในหมวดการดำเนินงาน — ชุดเดียวกันทุกหน้า (สรุปผลการดำเนินงาน · ผลงานรายบุคคล)
 * "เลือกเดือน/เลือกปี/กำหนดช่วงเอง" เปิดช่องให้เลือกเพิ่ม
 */
/** ช่วงสั้น — ใช้ในหน้าประวัติเข้างาน (ส่ง presets={[...SHORT_PRESETS, ...PERIOD_PRESETS]}) */
export const SHORT_PRESETS = [
  { value: "today", label: "วันนี้" },
  { value: "7d", label: "7 วันล่าสุด" },
];

export const PERIOD_PRESETS = [
  { value: "month", label: "เดือนนี้" },
  { value: "lastMonth", label: "เดือนที่แล้ว" },
  { value: "pickMonth", label: "เลือกเดือน…" },
  { value: "year", label: "ปีนี้" },
  { value: "pickYear", label: "เลือกปี…" },
  { value: "12m", label: "12 เดือนล่าสุด" },
  { value: "custom", label: "กำหนดช่วงเอง…" },
  { value: "all", label: "ทั้งหมด" },
];

export const monthLabel = (key) => { const [y, m] = String(key).split("-"); return `${THAI_MONTHS_SHORT[Number(m) - 1]} ${Number(y) + 543}`; };

/** → ["YYYY-MM-DD" | "", "YYYY-MM-DD" | ""] */
export const periodRange = (preset, { month, year, from, to }) => {
  const f = (m) => m.format("YYYY-MM-DD");
  switch (preset) {
    case "today": return [f(moment()), f(moment())];
    case "7d": return [f(moment().subtract(6, "days")), f(moment())];
    case "month": return [f(moment().startOf("month")), f(moment().endOf("month"))];
    case "lastMonth": return [f(moment().subtract(1, "month").startOf("month")), f(moment().subtract(1, "month").endOf("month"))];
    case "pickMonth": return [f(moment(month, "YYYY-MM").startOf("month")), f(moment(month, "YYYY-MM").endOf("month"))];
    case "year": return [f(moment().startOf("year")), f(moment().endOf("year"))];
    case "pickYear": return [`${year}-01-01`, `${year}-12-31`];
    case "12m": return [f(moment().subtract(11, "months").startOf("month")), f(moment().endOf("month"))];
    case "custom": return [from || "", to || ""];
    default: return ["", ""];
  }
};

export const periodText = (preset, rFrom, rTo) => {
  if (preset === "all" || (!rFrom && !rTo)) return "ทุกช่วงเวลา";
  if (preset === "today") return `วันนี้ ${thaiDate(rFrom)}`;
  if (preset === "7d") return `7 วันล่าสุด (${thaiDate(rFrom)} – ${thaiDate(rTo)})`;
  if (["month", "lastMonth", "pickMonth"].includes(preset)) return `เดือน ${monthLabel(rFrom.slice(0, 7))}`;
  if (["year", "pickYear"].includes(preset)) return `ปี ${Number(rFrom.slice(0, 4)) + 543}`;
  return `${rFrom ? thaiDate(rFrom) : "…"} – ${rTo ? thaiDate(rTo) : "…"}`;
};
