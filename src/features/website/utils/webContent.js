/**
 * ค่ากลางของหลังบ้านเว็บไซต์ — ต้องตรงกับฝั่ง server (da-app-server/src/models/Web*.js)
 * และฝั่งเว็บ (da-web/src/data/*) ทุกตัว ไม่งั้นค่าที่เลือกจากหน้านี้จะถูก server ปฏิเสธ
 */

export const PRODUCT_CATEGORIES = [
  { value: "fire-alarm", label: "Fire Alarm" },
  { value: "cctv", label: "CCTV" },
  { value: "access-control", label: "Access Control" },
  { value: "security", label: "Security" },
  { value: "accessories", label: "อุปกรณ์เสริม" },
];

/** slug ของบริการบนเว็บ — ใช้กับ "ระบบ" ของผลงาน และ "บริการที่เกี่ยวข้อง" ของบทความ */
export const SERVICES = [
  { value: "fire-alarm", label: "ระบบแจ้งเหตุเพลิงไหม้ (Fire Alarm)" },
  { value: "fire-protection", label: "ระบบป้องกันอัคคีภัย (Fire Protection)" },
  { value: "fire-pump", label: "ระบบเครื่องสูบน้ำดับเพลิง (Fire Pump)" },
  { value: "cctv", label: "กล้องวงจรปิด (CCTV)" },
  { value: "access-control", label: "ระบบควบคุมการเข้าออก" },
  { value: "maintenance", label: "บำรุงรักษาระบบ (PM/CM)" },
];
/** ⚠️ ระบบ Network ถูกตัดออกจากเว็บชั่วคราว (บริษัทสั่ง 25 ก.ย. 2569) — เอาออกจากตัวเลือกแล้ว
 *    แต่ข้อมูลเก่าที่เคยเลือกไว้ยังต้องแสดงชื่อไทยได้ ไม่ใช่ขึ้น "network" ดิบๆ */
const RETIRED = { network: "ระบบเครือข่าย" };
export const serviceLabel = (v) => SERVICES.find((s) => s.value === v)?.label || RETIRED[v] || v || "-";

export const LEAD_STATUS = [
  { value: "new", label: "ใหม่", color: "#dc2626" },
  { value: "contacted", label: "ติดต่อแล้ว", color: "#2563eb" },
  { value: "quoted", label: "ส่งใบเสนอราคาแล้ว", color: "#7c3aed" },
  { value: "won", label: "ได้งาน", color: "#059669" },
  { value: "lost", label: "ไม่ได้งาน", color: "#64748b" },
  { value: "spam", label: "สแปม", color: "#94a3b8" },
];
export const leadStatus = (v) => LEAD_STATUS.find((s) => s.value === v) || LEAD_STATUS[0];

/** แบบร่างของบล็อกเนื้อหาบทความ — ตรงกับ WebArticle.BLOCK_TYPES */
export const BLOCK_TYPES = [
  { value: "p", label: "ย่อหน้า" },
  { value: "h2", label: "หัวข้อ" },
  { value: "list", label: "รายการ" },
  { value: "table", label: "ตาราง" },
  { value: "note", label: "กล่องหมายเหตุ" },
];
export const emptyBlock = (type) => {
  if (type === "list") return { type, items: [""] };
  if (type === "table") return { type, head: ["หัวข้อ", "รายละเอียด"], rows: [["", ""]] };
  return { type, text: "" };
};

/**
 * สร้าง slug จากข้อความ — เก็บเฉพาะ a-z 0-9 และขีด
 * ⚠️ ชื่อภาษาไทยล้วนแปลงเป็น slug ไม่ได้ (ทับศัพท์อัตโนมัติผิดบ่อยจนเสียมากกว่าได้)
 *    จึงคืนค่าว่างให้ผู้ใช้พิมพ์เอง — ไม่เดาให้ แล้วได้ URL ที่อ่านไม่รู้เรื่องติดอยู่ใน Google ตลอดไป
 */
export const slugify = (text) =>
  String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** วันที่แบบไทยสั้น พ.ศ. — "24 ก.ย. 2569 · 14:05" */
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export const thaiShort = (v, withTime = false) => {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  const base = `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
  return withTime ? `${base} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : base;
};
