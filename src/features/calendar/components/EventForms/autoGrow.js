/**
 * autoGrowTextarea — ช่องข้อความยืดตามเนื้อหาแบบนุ่ม (ใช้ทั้งฟอร์มลงงานและฟอร์มแก้ไขงาน)
 *
 * ✅ (18 พ.ย. 2569 ผู้ใช้: "รายละเอียดงานที่ทำ อยากให้ขยายตามจำนวนตัวอักษรที่พิมให้สมูท · ความยาวเริ่มต้นเท่าที่แจ้งให้ขยายไป")
 * 🐛 (20 พ.ย. 2569 ผู้ใช้: "รายละเอียดงานของหน้า event ยังไม่เห็นขยายยาวตามข้อมูลเลย")
 *    เดิมทำไว้แค่ฟอร์มแก้ไขงาน (ฟอร์มลงงานยังเป็นช่องสูงคงที่ + แถบเลื่อน) และวัดความสูงครั้งเดียวตอนเปิด
 *    → ตัวช่วยเดียวใช้ทั้งสองฟอร์ม · วัดใหม่เมื่อ: พิมพ์/วาง · ค่าถูกเติมด้วยโค้ด (กู้คืนร่างยิง input ให้)
 *      · ความกว้างช่องเปลี่ยน (กล่องจัดตัวเสร็จ/หมุนจอ/ช่องเพิ่งแสดงจากที่ซ่อนอยู่)
 *    ความสูงเริ่มต้น = min-height ใน CSS ของแต่ละฟอร์ม · ไม่มีแถบเลื่อนในช่อง (ทั้งข้อความเห็นครบ)
 *
 * @param el      <textarea>
 * @returns grow(smooth = true) — เรียกเองได้หลังตั้งค่าด้วยโค้ดที่ไม่ยิง input
 */
export function autoGrowTextarea(el) {
  if (!el || el.__autoGrow) return el?.__autoGrow || (() => {});
  el.style.overflowY = "hidden";
  el.style.resize = "none";
  // ช่องที่ CSS ไม่ได้ตั้ง transition ของความสูงไว้ — ใส่ให้เอง (ยืดนุ่มเหมือนกันทุกฟอร์ม)
  const cs0 = getComputedStyle(el);
  const cssAnimates = /height|all/.test(cs0.transitionProperty) && !/^0s(,\s*0s)*$/.test(cs0.transitionDuration);
  const restore = cssAnimates ? "" : "height .18s ease-out, border-color .15s ease, box-shadow .15s ease";
  el.style.transition = restore;

  const grow = (smooth = true) => {
    // ซ่อนอยู่ (เช่น การ์ดยังไม่แสดง) วัดไม่ได้ — ResizeObserver ด้านล่างจะเรียกอีกครั้งตอนมองเห็น
    if (!el.isConnected || !el.offsetWidth) return;
    const cs = getComputedStyle(el);
    const border = cs.boxSizing === "border-box" ? (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0) : 0;
    const from = el.getBoundingClientRect().height;
    el.style.transition = "none";
    el.style.height = "auto";
    const to = Math.ceil(el.scrollHeight + border);
    if (!smooth || Math.abs(to - from) < 1) {
      el.style.height = `${to}px`;
      requestAnimationFrame(() => { el.style.transition = restore; });
      return;
    }
    el.style.height = `${from}px`;
    void el.offsetHeight; // ให้เบราว์เซอร์รับความสูงเดิมก่อน แล้วค่อยเลื่อนไปความสูงใหม่
    el.style.transition = restore;
    el.style.height = `${to}px`;
  };
  el.__autoGrow = grow;

  el.addEventListener("input", () => grow(true));

  // ความกว้างเปลี่ยน = บรรทัดตัดใหม่ → วัดใหม่ (ไม่สนการเปลี่ยนความสูงที่เราทำเอง กันวนไม่รู้จบ)
  if (typeof ResizeObserver !== "undefined") {
    let lastW = 0;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect?.width || 0);
      if (!w || w === lastW) return;
      lastW = w;
      grow(false);
    });
    ro.observe(el);
    el.__autoGrowStop = () => ro.disconnect();
  }

  requestAnimationFrame(() => grow(false));
  return grow;
}
