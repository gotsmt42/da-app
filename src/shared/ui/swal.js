/**
 * swal.js — กล่องยืนยัน/แจ้งเตือนชุดเดียวทั้งแอป (ครอบ SweetAlert2)
 *
 * ✅ (19 ต.ค. 2569 ผู้ใช้: "ให้มีคอนเฟิร์มทุกจุดที่กดปุ่ม · แก้จาก sweet alert ก็ดี มันดูเก่าไม่สวยแล้ว
 *    ทำให้สวยงาม สมบูรณ์ และรูปแบบเดียวกันทั้งหมด")
 *    ทุกไฟล์ import Swal จากที่นี่แทน "sweetalert2" ตรงๆ → หน้าตาใหม่ทุกจุดพร้อมกันโดยไม่ต้องเขียนกล่องใหม่ทีละที่
 *    • กล่องมุมโค้ง 18px · เงานุ่ม · พื้นหลังมืด+เบลอ · เปิด/ปิดไว (0.18 วิ)
 *    • ไอคอนเล็กลง · หัวข้อหนา · คำอธิบายสีเทา · ช่องกรอกแบบเดียวกับฟอร์มในแอป
 *    • ปุ่มกว้างเท่ากัน "ยกเลิก" ซ้าย (ขาวขอบเทา) "ยืนยัน" ขวา (น้ำเงิน หรือสีที่หน้านั้นกำหนด เช่น แดง = ลบ/ยกเลิก)
 * ⚠️ กล่องที่ส่ง customClass มาเอง (ฟอร์มใหญ่ เช่น เพิ่มงาน/แก้ไขงาน) ไม่ได้ class tt-swal → หน้าตาเดิมของฟอร์มนั้นไม่เปลี่ยน
 */
import BaseSwal from "sweetalert2";

const CSS = `
.swal2-container.swal2-backdrop-show:has(.tt-swal) { background: rgba(15,23,42,.42) !important; backdrop-filter: blur(3px); }
.tt-swal:not(.swal2-toast) {
  width: min(92vw, 440px) !important; padding: 22px 22px 18px !important; border-radius: 18px !important;
  font-family: inherit !important; border: 1px solid #e2e8f0; box-shadow: 0 24px 60px -18px rgba(15,23,42,.45) !important;
}
.tt-swal.swal2-show { animation: ttSwalIn .18s cubic-bezier(.2,.8,.2,1) !important; }
.tt-swal.swal2-hide { animation: ttSwalOut .12s ease-in forwards !important; }
@keyframes ttSwalIn { from { opacity: 0; transform: translateY(8px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes ttSwalOut { to { opacity: 0; transform: scale(.97); } }
.tt-swal:not(.swal2-toast) .swal2-icon { transform: scale(.62); margin: -6px auto -14px !important; }
.tt-swal:not(.swal2-toast) .swal2-icon .swal2-icon-content { font-size: 3.4em; }
.tt-swal .swal2-title { font-size: 1.12rem !important; font-weight: 800 !important; color: #0f172a !important; padding: 10px 4px 0 !important; line-height: 1.4 !important; }
.tt-swal .swal2-html-container { font-size: .9rem !important; color: #475569 !important; line-height: 1.6 !important; margin: 8px 4px 0 !important; padding: 0 !important; }
.tt-swal .swal2-input-label { font-size: .8rem; font-weight: 700; color: #334155; margin: 14px 0 0 !important; justify-content: flex-start; }
.tt-swal .swal2-input, .tt-swal .swal2-textarea, .tt-swal .swal2-select, .tt-swal .swal2-file {
  width: 100% !important; margin: 8px 0 0 !important; box-sizing: border-box; font-family: inherit !important; font-size: .9rem !important;
  border: 1px solid #cbd5e1 !important; border-radius: 10px !important; box-shadow: none !important; color: #0f172a;
}
.tt-swal .swal2-input { height: 42px !important; padding: 0 12px !important; }
.tt-swal .swal2-textarea { min-height: 92px !important; padding: 10px 12px !important; }
.tt-swal .swal2-input:focus, .tt-swal .swal2-textarea:focus, .tt-swal .swal2-select:focus { border-color: #2563eb !important; box-shadow: 0 0 0 3px rgba(37,99,235,.15) !important; }
.tt-swal .swal2-validation-message { margin: 10px 0 0 !important; border-radius: 10px; background: #fef2f2 !important; color: #b91c1c !important; font-size: .82rem !important; }
.tt-swal:not(.swal2-toast) .swal2-actions { width: 100%; margin: 20px 0 0 !important; gap: 8px; flex-wrap: nowrap; }
.tt-swal:not(.swal2-toast) .swal2-actions button { flex: 1 1 0; margin: 0 !important; }
.tt-swal .swal2-styled { height: 42px; padding: 0 18px !important; border-radius: 10px !important; font-family: inherit !important; font-size: .9rem !important; font-weight: 800 !important; box-shadow: none !important; }
.tt-swal .swal2-styled:focus-visible { box-shadow: 0 0 0 3px rgba(37,99,235,.25) !important; }
.tt-swal .swal2-styled.swal2-cancel { color: #334155 !important; border: 1px solid #e2e8f0 !important; background: #fff !important; }
.tt-swal .swal2-styled.swal2-cancel:hover { background: #f8fafc !important; background-image: none !important; }
.tt-swal .swal2-styled.swal2-confirm:hover, .tt-swal .swal2-styled.swal2-deny:hover { filter: brightness(.93); background-image: none !important; }
.tt-swal .swal2-close { border-radius: 10px; color: #94a3b8; }
.tt-swal .swal2-timer-progress-bar { background: rgba(37,99,235,.35) !important; }
.tt-swal.swal2-toast { border-radius: 12px !important; font-family: inherit !important; box-shadow: 0 12px 30px -12px rgba(15,23,42,.35) !important; }
.tt-swal.swal2-toast .swal2-title { font-size: .9rem !important; padding: 0 !important; }
`;

if (typeof document !== "undefined" && !document.getElementById("tt-swal-css")) {
  const el = document.createElement("style");
  el.id = "tt-swal-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}

const Swal = BaseSwal.mixin({
  customClass: { popup: "tt-swal" },
  confirmButtonColor: "#2563eb",
  cancelButtonColor: "#ffffff",
  denyButtonColor: "#dc2626",
  confirmButtonText: "ตกลง",
  cancelButtonText: "ยกเลิก",
  denyButtonText: "ไม่",
  reverseButtons: true,
  showClass: { popup: "swal2-show", backdrop: "swal2-backdrop-show", icon: "swal2-icon-show" },
});

export default Swal;
