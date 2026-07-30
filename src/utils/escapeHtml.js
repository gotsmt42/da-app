// ✅ ใช้ครอบทุกครั้งที่เอาข้อความที่ผู้ใช้พิมพ์เอง (ชื่อบริษัท/โครงการ/ประเภทงาน/ระบบ ฯลฯ) ไปต่อเป็น
// string แล้วส่งเข้า Swal.fire({ html: `...` }) โดยตรง — เดิมหลายจุดต่อ string ตรงๆ ไม่ escape เลย
// (เช่น `<small>${eventCompany}</small>`) ถ้ามีใครตั้งชื่อบริษัทเป็น <img src=x onerror="..."> จะยิง
// JavaScript ทันทีที่มีใครเปิดดู/แก้ไข/ลบงานนั้น (stored XSS) — escape ให้ปลอดภัยก่อนต่อ string เสมอ
export const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
