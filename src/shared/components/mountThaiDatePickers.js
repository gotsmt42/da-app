import { useState } from "react";
import { createRoot } from "react-dom/client";
import ThaiDatePicker from "./ThaiDatePicker";

/**
 * mountThaiDatePickers.js — เปลี่ยน <input type="date"> ในฟอร์ม SweetAlert ให้เป็นปฏิทิน พ.ศ.
 *
 * ⚠️ ทำไมต้องมีไฟล์นี้แยกต่างหาก: ฟอร์มของหน้าปฏิทิน (AddEvent / EditEvent / CalendarBoard) ไม่ใช่
 * React แต่เป็น "HTML string" ที่ส่งให้ SweetAlert render จึงวาง <ThaiDatePicker /> ลงไปตรงๆ ไม่ได้
 *
 * ✅ วิธีที่เลือก: ไม่ลบ <input type="date"> เดิมทิ้ง แต่ "ซ่อนไว้ให้เป็นตัวเก็บค่า" แล้ว mount ปฏิทิน
 * ของ React ทับตำแหน่งมัน เวลาผู้ใช้เลือกวัน ค่าจะถูกเขียนกลับลง input เดิมเสมอ
 * เหตุผล: โค้ดฝั่งฟอร์มอ่านค่าตอนกดบันทึกผ่าน DOM ล้วนๆ (querySelector(".ae-range-start").value,
 * getElementById("start").value ฯลฯ รวมกว่า 30 จุดใน 4 ไฟล์) — ถ้าเปลี่ยนไปเก็บค่าใน state ของ
 * React แทน ต้องไล่แก้ทุกจุดนั้นพร้อมกัน ซึ่งพลาดจุดเดียวก็บันทึกวันที่ผิดแบบเงียบๆ ทันที
 * วิธีนี้ทำให้ "ทางอ่านค่า" เดิมทั้งหมดทำงานเหมือนเดิมเป๊ะโดยไม่ต้องแตะเลยสักบรรทัด
 *
 * ⚠️ ผูกทางเดียว (picker → input) เท่านั้น ตรวจแล้วว่าไม่มีโค้ดไหนเซ็ต .value ของช่องวันที่กลับเข้ามาเอง
 * ถ้าวันหลังมีขึ้นมา ต้องเพิ่มทางกลับด้วย ไม่งั้นปฏิทินจะแสดงค่าเก่าค้าง
 */

/**
 * อ่าน "หน้าตาของช่องเดิม" มาทำเป็นสไตล์ให้ปฏิทินที่ mount แทน
 *
 * ⚠️ ไม่ต้องใช้ !important ที่ไหนเลย — selector ที่ sx สร้าง (& .MuiOutlinedInput-input) มี
 * specificity สูงกว่ากฎของฟอร์ม (".ae-field input") อยู่แล้ว
 *
 * ⚠️ ต้องอ่านจากของจริง ไม่ใช่ฮาร์ดโค้ด เพราะแต่ละฟอร์มตั้งค่าไม่เท่ากัน — AddEvent ใช้ padding
 * 9px/12px ตัวอักษร 14px ขอบมน 8px ส่วน EditEvent ใช้ 7px/10px, 13px, 7px และ CalendarBoard
 * ใส่เป็น inline style อีกแบบ ถ้าฮาร์ดโค้ดค่าใดค่าหนึ่ง อีกสองฟอร์มจะเพี้ยนทันที
 */
const readSkin = (input) => {
  const cs = getComputedStyle(input);
  return {
    padding: cs.padding,
    fontSize: cs.fontSize,
    fontFamily: cs.fontFamily,
    color: cs.color,
    borderRadius: cs.borderTopLeftRadius,
    borderWidth: cs.borderTopWidth,
    borderColor: cs.borderTopColor,
    background: cs.backgroundColor,
  };
};

const fieldSx = (skin) => ({
  width: "100%",
  "& .MuiOutlinedInput-root": {
    borderRadius: skin.borderRadius,
    backgroundColor: skin.background,
    fontSize: skin.fontSize,
    color: skin.color,
    paddingRight: "8px",
    "& fieldset": { borderColor: skin.borderColor, borderWidth: skin.borderWidth },
    "&:hover fieldset": { borderColor: "#cbd5e1" },
    "&.Mui-focused fieldset": { borderColor: "#2563eb", borderWidth: skin.borderWidth },
  },
  // ↓ ล้าง "ทุกคุณสมบัติ" ที่กฎ .ae-field input / .ee-field input ของฟอร์ม swal ยัดใส่ input ตัวใน
  "& .MuiOutlinedInput-input": {
    // 🐛 BUG ที่แก้ (ช่องวันที่แบนเหลือสูง 20px ขณะที่ช่องอื่นสูง 39px และไอคอนปฏิทินหลุดออกนอกกรอบ):
    // ฟอร์ม swal ตั้ง box-sizing:border-box ให้ input ทุกช่อง แต่ MUI กำหนดความสูงเป็น
    // height:1.4375em โดยคาดว่าเป็น content-box — พอกลายเป็น border-box ความสูงนั้นถูกนับรวม
    // padding บน+ล่างเข้าไปด้วย เนื้อในจึงเหลือแทบไม่มี ช่องเลยแบนและดันปุ่มไอคอนหลุดออกไป
    boxSizing: "content-box",
    height: "1.4375em",
    width: "100%",
    minWidth: 0,
    padding: skin.padding,
    fontSize: skin.fontSize,
    fontFamily: skin.fontFamily,
    color: skin.color,
    border: "none",
    borderRadius: 0,
    background: "transparent",
    boxShadow: "none",
    transition: "none",
    "&:focus": { outline: "none", boxShadow: "none", border: "none" },
  },
});

/** ตัวห่อเล็กๆ ที่ถือค่าปัจจุบันไว้เอง แล้วเขียนกลับลง input ที่ซ่อนอยู่ทุกครั้งที่เปลี่ยน */
function BoundThaiDatePicker({ input, skin }) {
  const [value, setValue] = useState(input.value || "");
  // ✅ รองรับ <input type="month"> ด้วย (ฟอร์ม "แผนล่วงหน้า" ใช้เลือกเดือนที่จะเข้างาน) — ค่าที่เก็บ
  // ยังเป็น "YYYY-MM" ของ ค.ศ. เหมือนเดิมทุกประการ เปลี่ยนแค่ตัวเลือกให้เป็นเดือนไทย + ปี พ.ศ.
  const isMonth = input.type === "month";

  return (
    <ThaiDatePicker
      value={value}
      disabled={input.disabled}
      {...(isMonth
        ? {
            valueFormat: "YYYY-MM",
            views: ["year", "month"],
            openTo: "month",
            inputFormat: "MMMM YYYY",
          }
        : {})}
      onChange={(next) => {
        setValue(next);
        input.value = next;
        // ✅ ยิง event ให้ด้วย เผื่อมีโค้ดฝั่งฟอร์มดักฟังการเปลี่ยนแปลงของช่องนี้อยู่
        // (เช่น ป้ายสรุปช่วงวันที่ที่อัปเดตตามตอนแก้ไข) — ต้อง bubbles เพราะบางที่ดักที่ตัวแม่
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }}
      textFieldProps={{
        sx: fieldSx(skin),
        ...(isMonth ? { inputProps: { placeholder: "เดือน ปี (พ.ศ.)" } } : {}),
      }}
    />
  );
}

// ✅ ครอบทั้งช่องวันที่และช่องเดือน (ฟอร์มแผนล่วงหน้าใช้ type="month")
const DATE_INPUTS = 'input[type="date"], input[type="month"]';

const UPGRADED = "data-thai-dp";

const upgradeOne = (input, roots) => {
  if (input.getAttribute(UPGRADED) === "1") return;
  input.setAttribute(UPGRADED, "1");

  // ⚠️ ต้องอ่านสไตล์ของช่องเดิม "ก่อน" ซ่อนมัน
  const skin = readSkin(input);

  const slot = document.createElement("div");
  // ⚠️ ช่องเดิมบางจุดอยู่ในแถว flex และตั้ง flex:1 ไว้ (แถว "ช่วงวันที่" ที่มีปุ่ม ✕ ต่อท้าย) — ถ้าไม่
  // ยกคุณสมบัตินี้มาให้ slot ด้วย ช่องใหม่จะไม่ยืดเต็มแถวและทำให้ปุ่มตกบรรทัด
  // ⚠️ min-width:0 จำเป็นเสมอกับลูกของ flex ไม่งั้นช่องจะดันแถวให้กว้างเกินจอบนมือถือ
  slot.style.cssText = "flex:1 1 auto; min-width:0;";
  input.parentNode.insertBefore(slot, input.nextSibling);
  // ⚠️ ซ่อนด้วย display:none ไม่ใช่ถอดออกจาก DOM — ต้องให้ querySelector/getElementById เดิมยังหาเจอ
  input.style.display = "none";

  const root = createRoot(slot);
  root.render(<BoundThaiDatePicker input={input} skin={skin} />);
  roots.push({ root, slot });
};

/**
 * @param {HTMLElement} container  กล่อง swal ที่เพิ่งเปิด (Swal.getPopup())
 * @returns {Function} เรียกเพื่อคืนทรัพยากรตอนปิดกล่อง
 */
export function mountThaiDatePickers(container) {
  if (!container) return () => {};
  const roots = [];

  container.querySelectorAll(DATE_INPUTS).forEach((el) => upgradeOne(el, roots));

  // ✅ ฟอร์มพวกนี้เพิ่มแถวช่วงวันที่ได้ระหว่างกรอก (ปุ่ม "➕ เพิ่มช่วงวันที่") ช่องที่เกิดทีหลังจึงต้อง
  // ถูกอัปเกรดด้วย ไม่งั้นแถวแรกเป็นปฏิทิน พ.ศ. แต่แถวที่เพิ่มมาเป็นช่องของเบราว์เซอร์ = ปนกันสองแบบ
  const observer = new MutationObserver((records) => {
    for (const rec of records) {
      for (const node of rec.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches?.(DATE_INPUTS)) upgradeOne(node, roots);
        node.querySelectorAll?.(DATE_INPUTS).forEach((el) => upgradeOne(el, roots));
      }
    }
  });
  observer.observe(container, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    // ⚠️ unmount ใน setTimeout — React 18 ห้าม unmount ระหว่างที่ตัวเองกำลัง render อยู่ และจังหวะ
    // ปิดกล่อง swal อาจอยู่ใน callback ที่ถูกเรียกจากภายใน React pipeline พอดี
    setTimeout(() => {
      roots.forEach(({ root, slot }) => {
        root.unmount();
        slot.remove();
      });
    }, 0);
  };
}
