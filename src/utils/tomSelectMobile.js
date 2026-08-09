/**
 * tomSelectMobile.js — แก้อาการ TomSelect "เหมือนบัค/ใช้ยาก" บนจอเล็ก-แท็บเล็ต
 *
 * ⚠️ ที่มาของอาการ: ทุกช่อง TomSelect ในแอปนี้ตั้ง dropdownParent:"body" ไว้ (จำเป็น — ไม่งั้น dropdown
 * โดน overflow ของ modal ตัดขอบจนเลือกตัวเลือกล่างๆ ไม่ได้เลย ดูคอมเมนต์ที่ AddEvent.js/EditEvent.js)
 * แต่การย้าย dropdown ไปแปะที่ <body> ทำให้มันถูก "วางตำแหน่งครั้งเดียวตอนเปิด" ด้วยพิกัดสัมบูรณ์ ณ
 * ขณะนั้น — พอเกิดอะไรที่ทำให้พิกัดของช่องเปลี่ยนหลังจากนั้น dropdown จะไม่ตามไปด้วย ค้างอยู่ที่เดิม:
 *   1) เลื่อนเนื้อหาในฟอร์ม (modal มี overflow-y:auto) → dropdown ลอยค้างทับส่วนอื่นของจอ
 *   2) คีย์บอร์ดมือถือเด้งขึ้นมา → viewport หดและหน้าเลื่อน → dropdown หลุดไปคนละที่กับช่อง
 *   3) หมุนจอแนวตั้ง↔แนวนอน (แท็บเล็ตบ่อยมาก) → ตำแหน่ง/ความกว้างเดิมผิดหมด
 * อาการที่ผู้ใช้เจอคือ "กดแล้วรายการไปโผล่ผิดที่ / เลือกไม่โดน / เหมือนบัค"
 *
 * ✅ วิธีแก้: ดักเหตุการณ์ที่ทำให้พิกัดเปลี่ยนทั้ง 3 แบบ แล้วสั่ง TomSelect วางตำแหน่ง dropdown ใหม่
 * (positionDropdown เป็นเมธอดสาธารณะของ instance) ให้กลับมาแปะกับช่องเสมอ
 *
 * ⚠️ ทำไมต้องเป็น listener กลางตัวเดียวที่ window แทนที่จะไปแก้ทีละจุดที่สร้าง TomSelect:
 * ในแอปนี้สร้าง TomSelect อยู่ 10 จุดกระจาย 4 ไฟล์ (ฟอร์มเพิ่ม/แก้ไข/แผนล่วงหน้า/ลงตาราง) และหลายจุด
 * สร้าง instance ใหม่ทุกครั้งที่เปิดฟอร์ม การไล่ผูก-ถอด listener ทีละ instance จะพลาดง่ายและเสี่ยง
 * memory leak — ตัวนี้ผูกครั้งเดียวตลอดอายุแอป แล้วค่อยหา instance ที่ "กำลังเปิดอยู่" ตอนเกิดเหตุการณ์
 * (มีได้ทีละตัวเท่านั้นอยู่แล้วโดยธรรมชาติของ dropdown) จึงครอบคลุมทุกจุดโดยไม่ต้องแก้ call site เลย
 */

let installed = false;

/** หา TomSelect instance ที่ dropdown กำลังเปิดอยู่ (มีได้ทีละตัว) */
const getOpenInstance = () => {
  // TomSelect ใส่คลาส .dropdown-active ให้ wrapper ของช่องที่เปิดอยู่ และเก็บ instance ไว้ที่
  // property .tomselect ของ <select>/<input> ต้นฉบับเสมอ (ดู tom-select: `.tomselect = this`)
  const wrapper = document.querySelector(".ts-wrapper.dropdown-active");
  if (!wrapper) return null;
  // input ต้นฉบับถูกซ่อนไว้ข้างใน wrapper — ตัวที่มี .tomselect คือ instance ที่ต้องการ
  const original = wrapper.querySelector("select, input");
  return original?.tomselect || null;
};

export function installTomSelectMobileFixes() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  let rafId = null;
  const reposition = () => {
    if (rafId) return; // รวมหลายเหตุการณ์ที่ยิงถี่ๆ (scroll/resize) ให้คำนวณครั้งเดียวต่อเฟรม
    rafId = requestAnimationFrame(() => {
      rafId = null;
      const ts = getOpenInstance();
      // ⚠️ ห่อ try — positionDropdown แตะ DOM ของ dropdown ถ้า instance เพิ่งถูกทำลายไประหว่างนี้
      // (ปิดฟอร์มพอดีจังหวะ) จะ throw แล้วทำให้ listener ตัวนี้ตายไปทั้งตัว กระทบทุกช่องหลังจากนั้น
      try { ts?.positionDropdown?.(); } catch { /* instance ถูกทำลายไปแล้ว — ไม่ต้องทำอะไร */ }
    });
  };

  // capture:true — ต้องดักตอน scroll ของ "element ข้างใน" (เช่นเนื้อหาในกล่อง modal ที่ overflow-y:auto)
  // ด้วย ไม่ใช่แค่ scroll ของทั้งหน้า เพราะ scroll event ของ element ไม่ bubble ขึ้นมาถึง window
  window.addEventListener("scroll", reposition, { capture: true, passive: true });
  window.addEventListener("resize", reposition, { passive: true });
  window.addEventListener("orientationchange", reposition, { passive: true });
  // visualViewport = viewport ที่ "มองเห็นจริง" หลังคีย์บอร์ดมือถือเด้งขึ้นมาบัง — เป็นตัวเดียวที่รู้เรื่อง
  // คีย์บอร์ด (resize ธรรมดาไม่ยิงบน iOS ตอนคีย์บอร์ดเปิด) รองรับทุกเบราว์เซอร์มือถือยุคปัจจุบัน
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", reposition, { passive: true });
    window.visualViewport.addEventListener("scroll", reposition, { passive: true });
  }
}
