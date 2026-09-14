/**
 * expenseMeta.js — ป้าย/สี/ตัวช่วยของระบบเบิกเงินล่วงหน้า (Advance) และใบเคลียร์ค่าใช้จ่าย (Claim)
 *
 * ⚠️ ค่าดิบ (status / category / file kind / payment method) ต้องตรงกับ enum ใน
 * da-app-server/src/models/Expense.js เป๊ะ — เพิ่มค่าใหม่ต้องแก้ทั้งสองฝั่ง ไม่งั้นจะได้ป้ายว่างบนหน้าจอ
 * โดยไม่มี error ให้เห็น
 */

/**
 * สีประจำชนิดใบ — Advance = เขียวอมฟ้า (เงินออก) · Claim = ม่วง (หลักฐานการใช้จ่าย)
 * ✅ ผู้ใช้ขอ "ทำสีใบให้แตกต่าง และแยกได้ง่ายชัดเจน": เดิม Claim เป็นน้ำเงิน ซึ่งเป็นโทนเย็นใกล้กับเขียวอมฟ้า
 * วางคู่กันแล้วแยกด้วยตาไม่ออก — ม่วงอยู่คนละฝั่งของวงล้อสีกับเขียวอมฟ้า เห็นปราดเดียวก็รู้ว่าเป็นใบไหน
 * ⚠️ สีสถานะ (STATUS_BASE) ถูกเลือกให้ไม่ชนกับสองสีนี้ — ห้ามใช้เขียวอมฟ้า/ม่วงเป็นสีสถานะ
 */
export const EXPENSE_ACCENT = "#0d9488";
export const EXPENSE_ACCENT_DARK = "#0f766e";
export const CLAIM_ACCENT = "#7c3aed";
export const CLAIM_ACCENT_DARK = "#6d28d9";
/**
 * ใบสำรองจ่าย (พนักงานออกเงินเองไปก่อน ไม่มี Advance) — ส้ม
 * ✅ ต้องแยกจากใบเคลมปกติให้เห็นตั้งแต่มองรายการ เพราะ "เงินยังไม่ออกจากบริษัท" กับ "เงินออกไปแล้ว
 * รอเคลียร์" คนละเรื่องกันโดยสิ้นเชิงสำหรับคนอนุมัติและฝ่ายบัญชี
 * ⚠️ ส้มอยู่คนละฝั่งวงล้อสีกับทั้งเขียวอมฟ้าและม่วง — สามใบวางเรียงกันแล้วยังแยกออกทุกใบ
 */
export const REIMBURSE_ACCENT = "#ea580c";
export const REIMBURSE_ACCENT_DARK = "#c2410c";

export const TEXT_MAIN = "#0f172a";
export const TEXT_SUB = "#64748b";
export const BORDER_MAIN = "#e2e8f0";
export const SURFACE_SUBTLE = "#f8fafc";

export const KIND_META = {
  advance: {
    label: "ใบเบิก Advance",
    short: "Advance",
    docTitle: "ใบเบิกเงินล่วงหน้า (Advance)",
    color: EXPENSE_ACCENT,
    dark: EXPENSE_ACCENT_DARK,
    soft: "#f0fdfa",
    badge: "ADVANCE",
    /** RGB สำหรับ PDF: สีหลัก / พื้นหัวตาราง / พื้นแถวสรุป */
    pdf: { main: [15, 118, 110], head: [204, 251, 241], fill: [240, 253, 250] },
  },
  claim: {
    label: "ใบเคลม",
    short: "Claim",
    docTitle: "ใบเคลียร์ค่าใช้จ่าย (Claim)",
    color: CLAIM_ACCENT,
    dark: CLAIM_ACCENT_DARK,
    soft: "#f5f3ff",
    badge: "CLAIM",
    pdf: { main: [109, 40, 217], head: [237, 233, 254], fill: [245, 243, 255] },
  },
  /**
   * ⚠️ ไม่ใช่ kind ในฐานข้อมูล — เป็นชนิดย่อยของ claim (claimType = "reimburse")
   * อ่านผ่าน slipKind()/slipMeta() เสมอ อย่าอ้าง e.kind ตรงๆ ไม่งั้นใบสำรองจ่ายจะแสดงเป็นใบเคลมปกติ
   */
  reimburse: {
    label: "ใบเบิกค่าใช้จ่าย (สำรองจ่าย)",
    short: "สำรองจ่าย",
    docTitle: "ใบเบิกค่าใช้จ่าย (สำรองจ่ายเอง)",
    color: REIMBURSE_ACCENT,
    dark: REIMBURSE_ACCENT_DARK,
    soft: "#fff7ed",
    badge: "สำรองจ่าย",
    pdf: { main: [194, 65, 12], head: [255, 237, 213], fill: [255, 247, 237] },
  },
};

/**
 * ชนิดใบที่ใช้ "แสดงผล" — รวมชนิดย่อยของใบเคลมเข้ามาเป็นชนิดเต็มตัว
 * @returns {"advance"|"claim"|"reimburse"}
 */
export const slipKind = (e) =>
  (e?.kind === "claim" && e?.claimType === "reimburse" ? "reimburse" : e?.kind || "advance");

export const slipMeta = (e) => KIND_META[slipKind(e)] || KIND_META.advance;

/** ใบที่ผู้เบิกสำรองจ่ายเอง — บริษัทต้องจ่ายคืนเต็มยอด ไม่มี Advance ให้เทียบ */
export const isReimburse = (e) => slipKind(e) === "reimburse";

/**
 * สถานะ — ป้ายบางตัวต่างกันตามชนิดใบ (approved ของ Advance = รอจ่ายเงิน · ของ Claim = รอชำระส่วนต่าง)
 * ⚠️ ป้ายต้องบอก "ขั้นต่อไปคืออะไร" ไม่ใช่แค่ "ตอนนี้เป็นอะไร" — คนเปิดดูต้องรู้ทันทีว่าใครต้องทำอะไรต่อ
 */
const STATUS_BASE = {
  pending: { label: "รออนุมัติ", color: "#d97706" },
  rejected: { label: "ตีกลับให้แก้", color: "#dc2626" },
  approved: { label: "อนุมัติแล้ว", color: "#2563eb" },
  paid: { label: "จ่ายแล้ว · รอเคลียร์", color: "#0369a1" },
  clearing: { label: "ส่งเคลมแล้ว · รอตรวจ", color: "#be185d" },
  cleared: { label: "เคลียร์แล้ว", color: "#16a34a" },
  settled: { label: "เสร็จสิ้น", color: "#16a34a" },
  cancelled: { label: "ยกเลิก", color: "#94a3b8" },
};

/** @param {"advance"|"claim"|"reimburse"} kind — ใช้ slipKind(e) เสมอ ไม่ใช่ e.kind ดิบ */
export const statusMeta = (status, kind) => {
  const base = STATUS_BASE[status] || { label: status || "-", color: "#94a3b8" };
  if (status === "approved") {
    const label = kind === "reimburse" ? "อนุมัติ · รอจ่ายคืน"
      : kind === "claim" ? "อนุมัติ · รอชำระส่วนต่าง"
        : "อนุมัติ · รอจ่ายเงิน";
    return { ...base, label };
  }
  return base;
};

/** ตัวเลือกกรองสถานะของแต่ละชนิดใบ (เรียงตามลำดับขั้นจริง) */
export const STATUS_FILTERS = {
  advance: ["pending", "rejected", "approved", "paid", "clearing", "cleared", "cancelled"],
  claim: ["pending", "rejected", "approved", "settled", "cancelled"],
  // ใบสำรองจ่ายเดินทางเดียวกับใบเคลม (ไม่มีขั้นจ่ายเงินล่วงหน้า/รอเคลียร์)
  reimburse: ["pending", "rejected", "approved", "settled", "cancelled"],
};

/** ตัวกรองชนิดย่อยของใบเคลม — ค่าต้องตรงกับที่ server รับ (?claimType=) */
export const CLAIM_TYPE_FILTERS = [
  { value: "all", label: "ทั้งหมด" },
  { value: "clear", label: "เคลียร์ Advance", kind: "claim" },
  { value: "reimburse", label: "สำรองจ่ายเอง", kind: "reimburse" },
];

/** ⚠️ ต้องตรงกับ CATEGORIES ใน models/Expense.js */
export const EXPENSE_CATEGORIES = [
  { value: "allowance", label: "เบี้ยเลี้ยง", unit: "วัน", color: "#0e7490" },
  { value: "travel", label: "ค่าเดินทาง", unit: "เที่ยว", color: "#2563eb" },
  { value: "fuel", label: "ค่าน้ำมัน", unit: "ครั้ง", color: "#ea580c" },
  { value: "toll", label: "ทางด่วน / ที่จอดรถ", unit: "ครั้ง", color: "#a16207" },
  { value: "lodging", label: "ที่พัก", unit: "คืน", color: "#db2777" },
  { value: "material", label: "วัสดุ / อุปกรณ์", unit: "ชิ้น", color: "#16a34a" },
  { value: "tool", label: "เครื่องมือ", unit: "ชิ้น", color: "#475569" },
  { value: "shipping", label: "ค่าขนส่ง", unit: "ครั้ง", color: "#0891b2" },
  { value: "other", label: "อื่นๆ", unit: "รายการ", color: "#64748b" },
];

export const categoryMeta = (value) =>
  EXPENSE_CATEGORIES.find((c) => c.value === value) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];

export const FILE_KINDS = [
  { value: "receipt", label: "ใบเสร็จ" },
  { value: "invoice", label: "ใบกำกับ / บิล" },
  { value: "transfer_slip", label: "สลิปโอนเงิน" },
  { value: "photo", label: "รูปถ่าย" },
  { value: "other", label: "อื่นๆ" },
];
export const fileKindLabel = (v) => FILE_KINDS.find((k) => k.value === v)?.label || "อื่นๆ";

export const PAYMENT_METHODS = [
  { value: "transfer", label: "โอนเงิน" },
  { value: "cash", label: "เงินสด" },
  { value: "cheque", label: "เช็ค" },
  { value: "other", label: "อื่นๆ" },
];
export const paymentLabel = (v) => PAYMENT_METHODS.find((m) => m.value === v)?.label || "-";

/** ปัดทศนิยม 2 ตำแหน่ง — ต้องปัดแบบเดียวกับ server (money() ใน routes/expenses.js) */
export const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** 1,480.50 */
export const fmtMoney = (n) =>
  money(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ฿1,480.50 — บนหน้าจอ (ตัดทศนิยม .00 ออกให้อ่านง่าย) */
export const baht = (n) => {
  const v = money(n);
  return `฿${v.toLocaleString("th-TH", { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 })}`;
};

export const itemAmount = (it) => money((Number(it?.qty) || 0) * (Number(it?.unitPrice) || 0));
export const itemsTotal = (items) => money((items || []).reduce((s, it) => s + itemAmount(it), 0));

/**
 * จำนวนเงินเป็นตัวอักษรไทย — "หนึ่งพันสี่ร้อยแปดสิบบาทห้าสิบสตางค์"
 * ✅ เอกสารการเงินของไทยต้องมีบรรทัดนี้กำกับตัวเลขเสมอ (กันการแก้ตัวเลขด้วยมือ)
 * ⚠️ กฎที่พลาดง่าย: "เอ็ด" ใช้กับหลักหน่วยเมื่อมีหลักสิบขึ้นไป · "ยี่สิบ" ไม่ใช่ "สองสิบ" ·
 * "สิบ" ไม่ใช่ "หนึ่งสิบ" · ตัดกลุ่มละ 6 หลักด้วย "ล้าน"
 */
const DIGITS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const PLACES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

const readUnder1M = (n) => {
  const s = String(n);
  let out = "";
  const len = s.length;
  for (let i = 0; i < len; i++) {
    const d = Number(s[i]);
    const place = len - i - 1;
    if (d === 0) continue;
    if (place === 1 && d === 1) out += "สิบ";
    else if (place === 1 && d === 2) out += "ยี่สิบ";
    else if (place === 0 && d === 1 && len > 1) out += "เอ็ด";
    else out += DIGITS[d] + PLACES[place];
  }
  return out;
};

const readInteger = (n) => {
  if (n === 0) return "ศูนย์";
  let out = "";
  let rest = n;
  const groups = [];
  while (rest > 0) {
    groups.unshift(rest % 1_000_000);
    rest = Math.floor(rest / 1_000_000);
  }
  groups.forEach((g, i) => {
    const isLast = i === groups.length - 1;
    if (g > 0) {
      // ⚠️ กลุ่มล้านที่เป็น 1 ตัวเดียวอ่าน "หนึ่งล้าน" ไม่ใช่ "เอ็ดล้าน"
      out += g === 1 && !isLast ? "หนึ่ง" : readUnder1M(g);
    }
    if (!isLast) out += "ล้าน";
  });
  return out;
};

export const bahtText = (amount) => {
  const v = money(Math.abs(Number(amount) || 0));
  const integer = Math.floor(v);
  const satang = Math.round((v - integer) * 100);
  const prefix = Number(amount) < 0 ? "ลบ" : "";
  if (satang === 0) return `${prefix}${readInteger(integer)}บาทถ้วน`;
  return `${prefix}${integer > 0 ? `${readInteger(integer)}บาท` : ""}${readInteger(satang)}สตางค์`;
};

/**
 * คำอธิบายส่วนต่างของใบเคลม
 * @param {number} diff ใช้จริง − ยอด Advance
 * @param {"advance"|"claim"|"reimburse"} [kind] ใบสำรองจ่ายไม่มี Advance — ส่วนต่างทั้งก้อนคือเงินที่
 * บริษัทต้องจ่ายคืน ไม่ใช่ "จ่ายเพิ่มจากที่เบิกไว้" (คำว่า "จ่ายเพิ่ม" จะทำให้เข้าใจผิดว่าเคยจ่ายไปแล้ว)
 */
export const differenceMeta = (diff, kind) => {
  const d = money(diff);
  if (kind === "reimburse") {
    return { label: "บริษัทจ่ายคืนให้ผู้เบิก", short: "จ่ายคืน", color: REIMBURSE_ACCENT_DARK, amount: d };
  }
  if (d > 0) return { label: "บริษัทจ่ายเพิ่มให้ผู้เบิก", short: "จ่ายเพิ่ม", color: "#1d4ed8", amount: d };
  if (d < 0) return { label: "ผู้เบิกคืนเงินให้บริษัท", short: "คืนเงิน", color: "#d97706", amount: -d };
  return { label: "ใช้จริงพอดีกับยอด Advance", short: "พอดี", color: "#059669", amount: 0 };
};

/** จำนวน/หน่วย แบบแบบฟอร์มกระดาษ — "250 × 4 วัน" */
export const qtyText = (it) => {
  const qty = Number(it?.qty) || 0;
  const price = Number(it?.unitPrice) || 0;
  const unit = String(it?.unit || "").trim();
  if (qty === 1 && !unit) return fmtMoney(price).replace(/\.00$/, "");
  return `${fmtMoney(price).replace(/\.00$/, "")} × ${qty.toLocaleString("th-TH")}${unit ? ` ${unit}` : ""}`;
};

export const isOverdueClear = (e) =>
  e?.kind === "advance" && e?.status === "paid" && e?.dueClearAt && new Date(e.dueClearAt) < new Date();

export const jobText = (job) => [job?.title, job?.site || job?.company].filter(Boolean).join(" · ");
