/**
 * stockMeta — สี/ป้าย/ตัวช่วยของระบบ "สต๊อก · ทรัพย์สินแผนก"
 * 🎨 โทนอำพันเข้ม — แยกจาก OT (ฟ้าอมเขียว) · Advance (เขียวอมฟ้า) · จัดซื้อ (คราม)
 */
export const STOCK_ACCENT = "#b45309";
export const STOCK_DARK = "#92400e";
export const TEXT_MAIN = "#0f172a";
export const TEXT_SUB = "#64748b";
export const BORDER_MAIN = "#e2e8f0";

/** วัสดุ = เบิกแล้วตัดยอดถาวร · ทรัพย์สิน = ยืมไปใช้แล้วต้องคืน */
export const KINDS = {
  consumable: { label: "วัสดุ", full: "วัสดุสิ้นเปลือง / อะไหล่", hint: "เบิกแล้วตัดยอดถาวร", color: "#0369a1", bg: "#e0f2fe" },
  asset: { label: "ทรัพย์สิน", full: "ทรัพย์สิน / เครื่องมือ", hint: "ยืมไปใช้ ต้องคืน", color: "#7c3aed", bg: "#ede9fe" },
};
export const kindMeta = (k) => KINDS[k] || KINDS.consumable;

export const REQ_STATUS = {
  pending: { label: "รออนุมัติ", color: "#d97706", bg: "#fef3c7" },
  issued: { label: "จ่ายของแล้ว", color: "#16a34a", bg: "#dcfce7" },
  returned: { label: "คืนครบแล้ว", color: "#0f766e", bg: "#ccfbf1" },
  rejected: { label: "ไม่อนุมัติ", color: "#dc2626", bg: "#fee2e2" },
  cancelled: { label: "ยกเลิก", color: "#64748b", bg: "#f1f5f9" },
};
export const REQ_ORDER = ["pending", "issued", "returned", "rejected", "cancelled"];
export const reqStatus = (s) => REQ_STATUS[s] || REQ_STATUS.pending;

/**
 * สถานะที่ "แสดง" ให้คนอ่าน — ✅ (27 ต.ค. 2569 ผู้ใช้: "สถานะยืม กับรับของไปให้แยกกันเผื่องง")
 *   ใบที่จ่ายแล้ว (issued) แยกเป็น 2 แบบ:
 *     loan   ยืมอยู่      — มีทรัพย์สินที่ยังไม่คืน (ม่วง สีเดียวกับชนิดทรัพย์สิน)
 *     issued เบิกจ่ายแล้ว — รับวัสดุไปแล้ว ไม่มีอะไรค้างคืน (เขียว)
 */
export const REQ_VIEW = {
  pending: { label: "รออนุมัติ", color: "#d97706", bg: "#fef3c7" },
  loan: { label: "ยืมอยู่", color: "#7c3aed", bg: "#ede9fe" },
  issued: { label: "เบิกจ่ายแล้ว", color: "#16a34a", bg: "#dcfce7" },
  returned: { label: "คืนครบแล้ว", color: "#0f766e", bg: "#ccfbf1" },
  rejected: { label: "ไม่อนุมัติ", color: "#dc2626", bg: "#fee2e2" },
  cancelled: { label: "ยกเลิก", color: "#64748b", bg: "#f1f5f9" },
};
export const REQ_VIEW_ORDER = ["pending", "loan", "issued", "returned", "rejected", "cancelled"];

export const MOVE_TYPES = {
  in: { label: "รับเข้า", color: "#16a34a" },
  out: { label: "เบิกจ่าย", color: "#dc2626" },
  loan: { label: "ยืมออก", color: "#7c3aed" },
  return: { label: "รับคืน", color: "#0f766e" },
  adjust: { label: "ตรวจนับ", color: "#d97706" },
  damage: { label: "คืน · ชำรุด", color: "#b45309", neutral: true },
  lost: { label: "สูญหาย", color: "#b91c1c", neutral: true },
  repair: { label: "ซ่อมเสร็จ", color: "#0f766e" },
  writeoff: { label: "ตัดจำหน่าย", color: "#64748b", neutral: true },
};

/** ใบคืนของ (RT) — ✅ (27 ต.ค. 2569 ผู้ใช้เลือก "ใบคืนของ + สภาพของ") */
export const RT_STATUS = {
  pending: { label: "รอตรวจรับ", color: "#d97706", bg: "#fef3c7" },
  received: { label: "รับคืนแล้ว", color: "#16a34a", bg: "#dcfce7" },
  rejected: { label: "ไม่รับคืน", color: "#dc2626", bg: "#fee2e2" },
  cancelled: { label: "ยกเลิก", color: "#64748b", bg: "#f1f5f9" },
};
export const rtStatus = (s) => RT_STATUS[s] || RT_STATUS.pending;
/** สภาพของที่คืน — ผลต่อยอดเมื่อตรวจรับ */
export const CONDITIONS = {
  good: { label: "ปกติ", effect: "เข้าคลัง เบิกได้ต่อ", color: "#16a34a", bg: "#dcfce7" },
  damaged: { label: "ชำรุด", effect: "แยกเป็นยอดรอซ่อม (เบิกไม่ได้)", color: "#b45309", bg: "#fef3c7" },
  lost: { label: "สูญหาย", effect: "ตัดจำหน่าย · บันทึกผู้รับผิดชอบ", color: "#b91c1c", bg: "#fee2e2", assetOnly: true },
};

/** เบิกได้ = ในคลัง − จองไว้ให้ใบที่รออนุมัติ */
export const available = (it) => Math.max(0, (it?.qty || 0) - (it?.reserved || 0));
export const isLow = (it) => (it?.minQty || 0) > 0 && available(it) < it.minQty;
export const isOut = (it) => available(it) <= 0;
/** ทรัพย์สินที่ยังไม่คืน (ยืมออกไป − คืนแล้ว) ของใบหนึ่งใบ */
export const outstanding = (r) => (r?.lines || []).filter((l) => l.kind === "asset").reduce((s, l) => s + Math.max(0, l.qty - (l.returnedQty || 0)), 0);
/** คีย์สถานะแสดงผลของใบเบิก (ดู REQ_VIEW) */
export const reqView = (r) => (r?.status === "issued" ? (outstanding(r) > 0 ? "loan" : "issued") : r?.status || "pending");
export const fmt = (n) => Number(n || 0).toLocaleString("th-TH");
/** ข้อมูลงานแบบย่อที่ JobTypeChip ใช้เลือกสี */
export const jobOf = (r) => ({ title: r?.jobType || "", backgroundColor: r?.jobColor || "" });

