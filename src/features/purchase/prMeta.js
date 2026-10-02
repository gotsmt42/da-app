/**
 * prMeta.js — ป้าย/สี/ตัวช่วยของใบขอซื้อสินค้า (PR)
 * ⚠️ ค่าดิบ (status/priority/file kind) ต้องตรงกับ da-app-server/src/models/PurchaseRequest.js
 * ⚠️ ยอดเงินในหน้าจอเป็นพรีวิว — server คำนวณใหม่ทุกครั้ง
 */
export const PR_ACCENT = "#4338ca";
export const PR_DARK = "#3730a3";
export const TEXT_MAIN = "#0f172a";
export const TEXT_SUB = "#64748b";
export const BORDER_MAIN = "#e2e8f0";
export const DARK = "#334155";

/** สถานะ — โทนเดียวกับระบบเบิก/OT ทั้งแอป (อ่านแบบเดียวกัน) */
export const PR_STATUS = {
  pending: { label: "รอตรวจสอบ", color: "#b45309", bg: "#fffbeb", border: "#fcd34d" },
  reviewed: { label: "รออนุมัติ", color: "#6d28d9", bg: "#f5f3ff", border: "#c4b5fd" },
  approved: { label: "อนุมัติแล้ว · รอสั่งซื้อ", short: "รอสั่งซื้อ", color: "#1d4ed8", bg: "#eff6ff", border: "#93c5fd" },
  ordered: { label: "สั่งซื้อแล้ว · รอรับของ", short: "รอรับของ", color: "#0e7490", bg: "#ecfeff", border: "#67e8f9" },
  partial: { label: "รับของบางส่วน", color: "#be185d", bg: "#fdf2f8", border: "#f9a8d4" },
  received: { label: "รับของครบ · ปิดใบ", short: "รับครบ", color: "#15803d", bg: "#f0fdf4", border: "#86efac" },
  rejected: { label: "ตีกลับให้แก้", color: "#b91c1c", bg: "#fef2f2", border: "#fca5a5" },
  cancelled: { label: "ยกเลิก", color: "#64748b", bg: "#f8fafc", border: "#cbd5e1" },
};
export const prStatus = (s) => PR_STATUS[s] || { label: s || "-", color: TEXT_SUB, bg: "#f8fafc", border: BORDER_MAIN };
export const STATUS_ORDER = ["pending", "reviewed", "rejected", "approved", "ordered", "partial", "received", "cancelled"];

export const PRIORITIES = [
  { value: "normal", label: "ปกติ", color: TEXT_SUB },
  { value: "urgent", label: "ด่วน", color: "#b45309" },
  { value: "critical", label: "ด่วนมาก", color: "#b91c1c" },
];
export const priorityMeta = (v) => PRIORITIES.find((p) => p.value === v) || PRIORITIES[0];

export const FILE_KINDS = [
  { value: "quotation", label: "ใบเสนอราคาร้านค้า" },
  { value: "spec", label: "สเปก / แคตตาล็อก" },
  { value: "photo", label: "รูปถ่าย" },
  { value: "po", label: "ใบสั่งซื้อ (PO)" },
  { value: "delivery", label: "ใบส่งของ" },
  { value: "invoice", label: "ใบกำกับภาษี / บิล" },
  { value: "other", label: "อื่นๆ" },
];
export const fileKindLabel = (v) => FILE_KINDS.find((k) => k.value === v)?.label || "อื่นๆ";

export const money = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const fmtMoney = (n) => money(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const baht = (n) => {
  const v = money(n);
  return `฿${v.toLocaleString("th-TH", { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 })}`;
};
export const fmtQty = (n) => (Number(n) || 0).toLocaleString("th-TH", { maximumFractionDigits: 3 });

/** ชื่องานเต็ม — "PM Fire Alarm · โครงการ" */
export const prJobText = (job) => {
  const title = String(job?.title || "").trim();
  const sys = String(job?.system || "").trim();
  const name = sys && !title.toLowerCase().includes(sys.toLowerCase()) ? `${title} ${sys}` : title;
  return [name, job?.site || job?.company].filter(Boolean).join(" · ");
};

/** ความคืบหน้าการรับของ 0–1 */
export const receiveProgress = (r) => {
  const total = (r?.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0);
  const got = (r?.items || []).reduce((s, it) => s + Math.min(Number(it.receivedQty) || 0, Number(it.qty) || 0), 0);
  return total ? got / total : 0;
};
