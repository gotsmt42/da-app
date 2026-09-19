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
import { formatRoundLabel } from "@/shared/utils/contractRounds";

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
  // ✅ 3 ส่วน: ส่งขอเบิก → ตรวจสอบ/อนุมัติ (รอตรวจสอบ → ตรวจสอบแล้ว รออนุมัติ) → รออนุมัติเบิกจ่าย
  pending: { label: "รอตรวจสอบ", color: "#d97706" },
  reviewed: { label: "ตรวจสอบแล้ว · รออนุมัติ", color: "#7c2d12" },
  rejected: { label: "ตีกลับให้แก้", color: "#dc2626" },
  approved: { label: "อนุมัติแล้ว", color: "#2563eb" },
  paid: { label: "จ่ายให้พนักงานแล้ว · รอเคลียร์", color: "#0369a1" },
  clearing: { label: "ส่งเคลมแล้ว · รอตรวจ", color: "#be185d" },
  cleared: { label: "เคลียร์แล้ว", color: "#16a34a" },
  settled: { label: "เสร็จสิ้น", color: "#16a34a" },
  cancelled: { label: "ยกเลิก", color: "#94a3b8" },
};

/** @param {"advance"|"claim"|"reimburse"} kind — ใช้ slipKind(e) เสมอ ไม่ใช่ e.kind ดิบ */
export const statusMeta = (status, kind) => {
  const base = STATUS_BASE[status] || { label: status || "-", color: "#94a3b8" };
  if (status === "approved") {
    // ✅ ส่วนที่ 3 — ทุกชนิดใบรอ "อนุมัติเบิกจ่าย" (ผู้จัดการแผนกช่าง/กรรมการผู้จัดการ)
    // ทิศทางเงิน (จ่ายเพิ่ม/รับคืน) โชว์แยกอยู่ที่ช่องยอดเงินของแถวแล้ว ป้ายสถานะจึงบอกแค่ขั้น
    // ⚠️ ป้ายเดียวกันทุกชนิดใบ — ป้ายยาวกว่านี้ถูกตัดในตารางกล่องรอดำเนินการ (ตรวจด้วยภาพหน้าจอจริง)
    return { ...base, label: "อนุมัติแล้ว · รออนุมัติเบิกจ่าย" };
  }
  return base;
};

/** ตัวเลือกกรองสถานะของแต่ละชนิดใบ (เรียงตามลำดับขั้นจริง) */
export const STATUS_FILTERS = {
  advance: ["pending", "reviewed", "rejected", "approved", "paid", "clearing", "cleared", "cancelled"],
  claim: ["pending", "reviewed", "rejected", "approved", "settled", "cancelled"],
  // ใบสำรองจ่ายเดินทางเดียวกับใบเคลม (ไม่มีขั้นจ่ายเงินล่วงหน้า/รอเคลียร์)
  reimburse: ["pending", "reviewed", "rejected", "approved", "settled", "cancelled"],
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

/**
 * "แนบมาจากขั้นตอนไหน" — ✅ ผู้ใช้ขอให้แยกให้ชัด เพราะไฟล์ในใบเดียวมาจากคนละช่วงของกระบวนการ
 * (ใบเสร็จตอนออกใบ · สลิปตอนจ่ายเงิน · หลักฐานตอนปิดส่วนต่าง) การกองรวมกันทำให้ตรวจย้อนหลังยาก
 * ⚠️ ค่าต้องตรงกับ FILE_STAGES ใน da-app-server/src/models/Expense.js
 * ⚠️ ไฟล์เก่าที่แนบก่อนมีฟิลด์นี้ stage = "" → ตกลงกลุ่ม "ไฟล์แนบอื่นๆ"
 */
export const FILE_STAGES = [
  { value: "created", label: "แนบตอนออกใบ", color: "#0f766e" },
  { value: "resubmitted", label: "แนบตอนแก้ไขและส่งใหม่", color: "#b45309" },
  { value: "review", label: "แนบตอนตรวจสอบ", color: "#b45309" },
  { value: "approve", label: "แนบตอนอนุมัติ", color: "#059669" },
  { value: "pay", label: "แนบตอนจ่ายเงินให้พนักงาน", color: "#1d4ed8" },
  { value: "settle", label: "แนบตอนเคลียร์ส่วนต่าง", color: "#7c3aed" },
  { value: "added", label: "แนบเพิ่มภายหลัง", color: "#64748b" },
  { value: "", label: "ไฟล์แนบอื่นๆ", color: "#94a3b8" },
];

/**
 * ป้ายขั้นตอน "เจาะจงชนิดใบ" — ✅ ผู้ใช้ขอให้ระบุให้ชัดว่าเป็นตอนออกใบ Advance หรือใบเคลม
 * ⚠️ ต้องส่ง slipKind(e) มาเสมอ ไม่ใช่ e.kind ดิบ (ใบสำรองจ่ายมี kind = "claim")
 */
const STAGE_LABEL_BY_KIND = {
  created: { advance: "แนบตอนออกใบ Advance", claim: "แนบตอนออกใบเคลม", reimburse: "แนบตอนออกใบสำรองจ่าย" },
  resubmitted: {
    advance: "แนบตอนแก้ไขใบ Advance และส่งใหม่",
    claim: "แนบตอนแก้ไขใบเคลมและส่งใหม่",
    reimburse: "แนบตอนแก้ไขใบสำรองจ่ายและส่งใหม่",
  },
  pay: { advance: "แนบตอนจ่ายเงิน Advance ให้พนักงาน" },
  settle: { claim: "แนบตอนเคลียร์ส่วนต่างกับพนักงาน", reimburse: "แนบตอนจ่ายคืนพนักงาน" },
};

export const fileStageMeta = (v, kind) => {
  const base = FILE_STAGES.find((s) => s.value === (v || "")) || FILE_STAGES[FILE_STAGES.length - 1];
  const label = STAGE_LABEL_BY_KIND[base.value]?.[kind];
  return label ? { ...base, label } : base;
};

/** จัดไฟล์เป็นกลุ่มตามขั้นตอน เรียงตามลำดับที่เกิดขึ้นจริงในกระบวนการ */
export const groupFilesByStage = (files = [], kind) => FILE_STAGES
  .map((stage) => ({ ...fileStageMeta(stage.value, kind), files: files.filter((f) => (f.stage || "") === stage.value) }))
  .filter((g) => g.files.length);

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
    return { label: "บริษัทจ่ายคืนพนักงาน", short: "จ่ายคืนพนักงาน", color: REIMBURSE_ACCENT_DARK, amount: d };
  }
  if (d > 0) return { label: "บริษัทจ่ายเพิ่มให้พนักงาน", short: "จ่ายเพิ่มให้พนักงาน", color: "#1d4ed8", amount: d };
  if (d < 0) return { label: "พนักงานคืนเงินให้บริษัท", short: "คืนเงินบริษัท", color: "#d97706", amount: -d };
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

/** ชื่องานเต็ม "PM Fire Alarm" — ไม่ต่อชื่อระบบซ้ำถ้าชื่องานมีอยู่แล้ว */
export const jobName = (job) => {
  const title = String(job?.title || "").trim();
  const system = String(job?.system || "").trim();
  if (!system || title.toLowerCase().includes(system.toLowerCase())) return title;
  return [title, system].filter(Boolean).join(" ");
};

/**
 * งานแบบรายละเอียดครบ — "PM Fire Alarm โครงการ Ibis Phuket Patong ครั้งที่ 3/8"
 * ✅ ผู้ใช้ขอ: "เรื่องและงานให้ใส่รายละเอียดให้ครบ เช่น PM Fire Alarm โครงการ ..... ครั้งที่ ......"
 * เดิมเหลือแค่ "PM · Ibis Phuket Patong" — งาน PM ของโครงการเดียวกันมีหลายครั้ง อ่านแล้วไม่รู้ว่าเบิกของครั้งไหน
 * ⚠️ ใบเก่าที่ snapshot งานไว้ก่อนมีฟิลด์ system/round จะได้รูปแบบสั้นลงเอง (ไม่มีส่วนที่ขาด) ไม่พัง
 */
export const jobText = (job) => {
  const place = String(job?.site || job?.company || "").trim();
  const round = formatRoundLabel(job?.round, job?.visitCount);
  return [jobName(job), place ? `โครงการ ${place}` : "", round ? `ครั้งที่ ${round}` : ""].filter(Boolean).join(" ");
};

/** เรื่องตั้งต้นของใบเบิกจากงาน — "เบิกค่าใช้จ่ายงาน PM Fire Alarm โครงการ ... ครั้งที่ ..." */
export const jobSubject = (job, prefix = "เบิกค่าใช้จ่ายงาน") => {
  const text = jobText(job);
  return text ? `${prefix} ${text}` : "";
};

/**
 * ชื่อ-นามสกุลของคนในใบ (ผู้เบิก/ผู้อนุมัติ/พนักงานในรายการ) สำหรับเอกสารและหน้าจอที่ต้องระบุตัวคนชัด
 * ✅ ผู้ใช้ขอ: "ถ้าระบุอัตโนมัติให้มีนามสกุลด้วย" — server เติม fullName จากทะเบียนพนักงานให้ทุกครั้งที่อ่านใบ
 * (ดู withFullNames ใน routes/expenses.js) คนนอกระบบไม่มี fullName จึงถอยไปใช้ชื่อที่พิมพ์ไว้
 */
export const personFullName = (p) => String(p?.fullName || p?.name || "").trim();

/** พนักงานที่รายการนี้เบิกให้ (หัวหน้างานเบิกแทนลูกทีม) — ว่าง = ของผู้เบิกเอง */
export const itemPersonName = (it) => personFullName(it?.person);
