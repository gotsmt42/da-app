/**
 * สีประจำตัว + อักษรย่อของพนักงาน — ใช้ชุดเดียวกันทุกที่ที่แสดง "คน" (แผงงานตามผู้รับผิดชอบ, ช่องเลือก
 * ผู้รับผิดชอบ, คอลัมน์ในตาราง) คนเดิมจึงได้สีเดิมทุกหน้า จำได้ด้วยตาก่อนอ่านชื่อ
 */
const PALETTE = ["#2563eb", "#7c3aed", "#0891b2", "#059669", "#ea580c", "#db2777", "#4f46e5", "#0d9488", "#9333ea", "#ca8a04"];

export const personColor = (name) => {
  let h = 0;
  for (const ch of String(name || "")) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
};

export const personInitial = (name) => Array.from(String(name || "?").trim())[0] || "?";
