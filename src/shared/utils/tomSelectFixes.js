/**
 * tomSelectFixes.js — แก้อาการ TomSelect "เหมือนบัค/ใช้ยาก" ให้ครบทุกจุดในแอปด้วยการติดตั้งครั้งเดียว
 *
 * ⚠️ ที่มาของอาการ: ทุกช่อง TomSelect ในแอปนี้ตั้ง dropdownParent:"body" ไว้ (จำเป็น — ไม่งั้น dropdown
 * โดน overflow ของ modal ตัดขอบจนเลือกตัวเลือกล่างๆ ไม่ได้เลย ดูคอมเมนต์ที่ AddEvent.js/EditEvent.js)
 * แต่ TomSelect จัดตำแหน่ง dropdown ที่แปะไว้ที่ <body> ด้วย position:absolute + พิกัดที่คำนวณจาก
 * "ตำแหน่งในเอกสาร" (rect.top + window.scrollY) ครั้งเดียวตอนเปิด แล้วดักคำนวณใหม่เฉพาะ scroll ของ
 * window เท่านั้น (ดู positionDropdown ใน tom-select) — ฟอร์มในแอปนี้เลื่อนอยู่ใน #ee-body / #ae-body
 * ซึ่งเป็น "element" ไม่ใช่ window และ scroll event ของ element ไม่ bubble ขึ้นไปถึง window ตัวดักของ
 * TomSelect จึงไม่เคยทำงานเลยในกรณีที่เจอจริงบ่อยที่สุด ผลคือเลื่อนเนื้อหาในฟอร์มแล้วกล่องตัวเลือกค้าง
 * อยู่กับที่ ลอยทับฟิลด์อื่นจนดูเหมือนเป็นรายการของช่องคนละช่อง
 *
 * ✅ วิธีแก้ 3 ส่วน:
 *   1. เปลี่ยน dropdown เป็น position:fixed + พิกัดของ "viewport" (ไม่บวก scrollY) — พอเป็น fixed แล้ว
 *      การเลื่อนหน้าเว็บทั้งหน้าไม่ทำให้กล่องขยับเองอีกต่อไป เหลือกรณีเดียวที่ต้องคำนวณใหม่คือ "ช่องขยับ
 *      ในจอ" (เลื่อนเนื้อหาในฟอร์ม/หมุนจอ/คีย์บอร์ดเด้ง) ซึ่งดักไว้ครบในข้อ 2
 *      ⚠️ ทำโดย "แทนที่เมธอด positionDropdown บน prototype" ครั้งเดียว ไม่ใช่ไปเรียกทับทีหลัง — เพราะ
 *      TomSelect เรียกเมธอดนี้เองตอนเปิด/ตอนพิมพ์กรองด้วย ถ้าไม่แทนที่ ทุกครั้งที่มันเรียกเองจะเซ็ตพิกัด
 *      แบบ absolute (บวก scrollY เกินมา) ทับของเราจนกล่องกระโดดผิดที่
 *   2. ดักเหตุการณ์ที่ทำให้ช่องขยับในจอทั้งหมด (รวม scroll ของ element ด้วย capture) แล้วสั่งคำนวณใหม่
 *   3. ใส่สไตล์กลางให้ dropdown "ดูเป็นของช่องนั้นจริงๆ" — เงา/ขอบชัดขึ้น + ไฮไลต์ตัวเลือกที่ชี้อยู่ +
 *      ติ๊กถูกที่ค่าที่เลือกไว้ปัจจุบัน (กันเลือกผิดเพราะแยกไม่ออกว่าตอนนี้ช่องนี้มีค่าอะไรอยู่)
 *   4. บนมือถือ: แตะครั้งแรก = เห็นรายการอย่างเดียว (คีย์บอร์ดไม่เด้ง) · แตะช่องซ้ำ หรือกดแถบ
 *      "⌨️ แตะเพื่อพิมพ์ค้นหา" ท้ายกล่อง = พิมพ์ค้นหาได้
 *      ⚠️ อาการเดิม: TomSelect โฟกัสช่องพิมพ์ทันทีที่แตะ คีย์บอร์ดมือถือจึงเด้งขึ้นมากินครึ่งจอล่างทุกครั้ง
 *      แล้วบังรายการตัวเลือกที่เพิ่งเปิดพอดี — คนใช้ต้องกดปิดคีย์บอร์ดก่อนถึงจะเห็นว่ามีอะไรให้เลือก
 *      ทั้งที่ส่วนใหญ่แค่อยากกดเลือกจากรายการเฉยๆ ไม่ได้ตั้งใจจะพิมพ์
 *      ✅ ล็อกช่องพิมพ์เป็น readOnly + inputMode:"none" ตั้งแต่จังหวะ pointerdown (ก่อน TomSelect
 *      โฟกัส) เบราว์เซอร์จึงไม่เรียกคีย์บอร์ดขึ้นมา แต่ dropdown ยังเปิดตามปกติ
 *      ✅ การ "ปลดล็อกให้พิมพ์" ทำในจังหวะ click แบบ synchronous เท่านั้น (ดู unlockTypingNow /
 *      onClickCapture) — ของเดิมหน่วงด้วย setTimeout ทำให้ iOS/PWA ไม่ยอมเปิดคีย์บอร์ดให้เลย
 *      จนพิมพ์ค้นหาไม่ได้สักช่อง ซึ่งเป็นอาการที่ผู้ใช้แจ้งเข้ามา
 *
 * ⚠️ ทำไมต้องเป็น listener กลางตัวเดียวที่ window แทนที่จะไปแก้ทีละจุดที่สร้าง TomSelect:
 * ในแอปนี้สร้าง TomSelect อยู่ 10 จุดกระจาย 4 ไฟล์ (ฟอร์มเพิ่ม/แก้ไข/แผนล่วงหน้า/ลงตาราง) และหลายจุด
 * สร้าง instance ใหม่ทุกครั้งที่เปิดฟอร์ม การไล่ผูก-ถอด listener ทีละ instance จะพลาดง่ายและเสี่ยง
 * memory leak — ตัวนี้ผูกครั้งเดียวตลอดอายุแอป แล้วค่อยหา instance ที่ "กำลังเปิดอยู่" ตอนเกิดเหตุการณ์
 * (มีได้ทีละตัวเท่านั้นอยู่แล้วโดยธรรมชาติของ dropdown) จึงครอบคลุมทุกจุดโดยไม่ต้องแก้ call site เลย
 */

let installed = false;

// ⚠️ ห้ามหา instance จาก ".ts-wrapper .tomselected" เด็ดขาด — TomSelect ไม่ได้ "ห่อ" input เดิมไว้ข้างใน
// wrapper แต่แทรก wrapper ไว้ "ข้างหลัง" input เดิม (input.insertAdjacentElement('afterend', wrapper))
// ตัว input/select เดิมจึงเป็น "พี่น้อง" ของ wrapper ไม่ใช่ลูก — โค้ดที่ค้นหาข้างใน wrapper จะไปเจอ
// <input> ภายในของ TomSelect เอง (ช่องพิมพ์ค้นหา) ซึ่งไม่มี property .tomselect ติดอยู่ แล้วได้ null
// ทุกครั้งจนตัวแก้ทั้งไฟล์ไม่ทำงานเลยแบบเงียบๆ — ต้องไล่จาก .tomselected (คลาสที่ TomSelect ใส่ให้
// element เดิมเสมอ) แล้วเช็ค isOpen ซึ่งเป็นสถานะจริงของ instance
const getOpenInstance = () => {
  const nodes = document.querySelectorAll(".tomselected");
  for (const el of nodes) {
    const ts = el.tomselect;
    if (ts?.isOpen) return ts;
  }
  return null;
};

/** instance ตัวไหนก็ได้ที่มีอยู่ตอนนี้ — ใช้เข้าถึง prototype เพื่อแทนที่ positionDropdown */
const getAnyInstance = () => document.querySelector(".tomselected")?.tomselect || null;

const GAP = 4;          // ระยะห่างระหว่างช่องกับกล่องตัวเลือก
const MAX_HEIGHT = 260; // ความสูงสูงสุดของรายการก่อนจะเลื่อนในตัวมันเอง

/**
 * วางกล่องตัวเลือกแบบ fixed ให้แปะกับช่องเสมอ + พลิกขึ้นด้านบนถ้าที่ว่างด้านล่างไม่พอ
 * (ของเดิมเปิดลงล่างท่าเดียว ช่องที่อยู่ค่อนไปทางล่างจอจึงเห็นรายการแค่ 1-2 บรรทัดแล้วตกขอบจอไป)
 */
const positionFixed = function () {
  const control = this?.control;
  const dropdown = this?.dropdown;
  if (!control || !dropdown) return;

  const rect = control.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom - GAP;
  const above = rect.top - GAP;
  // พลิกขึ้นบนเฉพาะตอนที่ด้านล่างคับจริงๆ และด้านบนกว้างกว่า — ไม่งั้นยึดเปิดลงล่างตามที่คนคุ้นเคย
  const flipUp = below < 160 && above > below;
  const space = flipUp ? above : below;

  const content = this.dropdown_content;
  if (content) content.style.maxHeight = `${Math.max(120, Math.min(MAX_HEIGHT, space))}px`;

  dropdown.style.position = "fixed";
  dropdown.style.width = `${rect.width}px`;
  dropdown.style.left = `${rect.left}px`;
  // ⚠️ ต้องวัด offsetHeight หลังตั้ง maxHeight แล้วเท่านั้น ไม่งั้นได้ความสูงก่อนถูกจำกัดแล้ววางเลยขอบจอ
  // (ตอน TomSelect เรียกเมธอดนี้ dropdown ถูกตั้ง display:block + visibility:hidden ไว้แล้ว วัดได้จริง)
  dropdown.style.top = flipUp
    ? `${Math.max(GAP, rect.top - dropdown.offsetHeight - GAP)}px`
    : `${rect.bottom + GAP}px`;
};

let patched = false;
/** แทนที่ positionDropdown บน prototype ครั้งเดียว → มีผลกับทุก instance รวมถึงตัวที่จะสร้างทีหลัง */
const patchPositioning = () => {
  if (patched) return;
  const ts = getAnyInstance();
  const proto = ts && Object.getPrototypeOf(ts);
  if (!proto || typeof proto.positionDropdown !== "function") return;
  proto.positionDropdown = positionFixed;
  patched = true;
};

// ✅ สไตล์กลางของ dropdown ทุกช่องในแอป — ใส่ที่นี่ที่เดียวเพราะ dropdownParent:"body" ทำให้ dropdown
// ไม่ได้เป็นลูกของฟอร์มไหนเลย สไตล์ที่ scope ด้วยคลาสของฟอร์ม (.swal-edit-event ฯลฯ) จึงใช้กับมันไม่ได้
// ⚠️ ไม่แตะสีพื้น/สีตัวอักษรของ .option ที่ฟอร์มไหนตั้งเองไว้เกินจำเป็น — ที่นี่คุมแค่ "กรอบ/ระยะ/สถานะ"
const injectDropdownStyles = () => {
  if (document.getElementById("ts-global-fixes")) return;
  const style = document.createElement("style");
  style.id = "ts-global-fixes";
  style.textContent = `
    /* ⚠️ TomSelect ตั้ง z-index:10 มาเป็นค่าเริ่มต้น ต่ำกว่า SweetAlert2 container (1060) มาก พอย้าย
       dropdown ไปแปะที่ <body> จะกลายเป็น sibling กับ popup แล้วโดนซ่อนอยู่ข้างหลัง (อาการ "กดแล้วไม่ขึ้น") */
    .ts-dropdown { z-index: 100000 !important; }
    /* ✅ fixed = ยึดกับจอ ไม่ใช่กับเอกสาร — เลื่อนหน้าเว็บแล้วกล่องไม่ไหลหนีไปเอง (พิกัดคำนวณจาก
       positionFixed ด้านบน) ⚠️ ห้ามใส่ margin ที่นี่ ระยะห่างจากช่องถูกบวกไว้ในพิกัด top แล้ว ถ้าใส่ซ้ำ
       ตอนกล่องพลิกไปเปิดด้านบนจะเลื่อนลงมาทับตัวช่องพอดี */
    .ts-dropdown { position: fixed !important; margin: 0 !important; }
    /* ✅ ขอบ+เงาชัดขึ้น — ให้ดูเป็น "กล่องที่งอกออกมาจากช่องนี้" ไม่ใช่แผ่นขาวลอยอยู่กลางฟอร์มแบบเดิม
       ที่แยกไม่ออกว่าเป็นรายการของช่องไหน */
    .ts-dropdown {
      border: 1.5px solid #cbd5e1 !important;
      border-radius: 10px !important;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.18) !important;
      overflow: hidden;
    }
    .ts-dropdown .option {
      padding: 8px 12px !important;
      font-size: 13px;
      border-bottom: 1px solid #f1f5f9;
    }
    .ts-dropdown .option:last-child { border-bottom: none; }
    /* ตัวเลือกที่กำลังชี้/เลื่อนคีย์บอร์ดไปถึง */
    .ts-dropdown .option.active { background: #eff6ff !important; color: #1d4ed8 !important; }
    /* ✅ ค่าที่ "เลือกไว้อยู่ตอนนี้" — เดิมหน้าตาเหมือนตัวเลือกอื่นทุกประการ เปิด dropdown มาแล้วไม่รู้เลย
       ว่าตอนนี้ช่องนี้มีค่าอะไรอยู่ ต้องปิดกลับไปอ่านในช่องเอง (เสี่ยงเลือกทับของเดิมโดยไม่ตั้งใจ) */
    .ts-dropdown .option.selected { background: #f8fafc; font-weight: 700; }
    .ts-dropdown .option.selected::after {
      content: "✓"; float: right; margin-left: 8px; color: #16a34a; font-weight: 800;
    }
    /* ข้อความตอนพิมพ์แล้วไม่เจอ / ตอนกำลังจะสร้างชื่อใหม่ — เดิมกลืนไปกับตัวเลือกปกติจนไม่ทันสังเกต */
    .ts-dropdown .no-results { padding: 10px 12px; font-size: 12.5px; color: #94a3b8; }
    .ts-dropdown .create { padding: 8px 12px !important; font-size: 12.5px; color: #0f172a; }
    .ts-dropdown .create strong { color: #2563eb; }
    /* ✅ แถบ "แตะเพื่อพิมพ์ค้นหา" ท้ายกล่อง ขึ้นเฉพาะตอนที่ช่องยังล็อกไม่ให้พิมพ์อยู่ (แตะครั้งแรกบนมือถือ)
       🐛 BUG ที่แก้ (ผู้ใช้แจ้ง: "ในแอพมือถือ...ไม่สามารถกดพิมพ์ได้"): เดิมเป็น ::after ซึ่งเป็น
       pseudo-element — แตะไม่ได้จริง เป็นได้แค่ข้อความบอกใบ้เฉยๆ คนที่อ่านแล้วพยายามแตะตรงป้ายจะไม่มี
       อะไรเกิดขึ้นเลย ✅ เปลี่ยนเป็น element จริง (ดู ensureTypeHint) กดได้ตรงๆ เป็นทางที่ 2 ที่ชัดเจน
       นอกจากการแตะช่องซ้ำ */
    .ts-type-hint {
      display: block; padding: 8px 12px; cursor: pointer;
      font-size: 11.5px; font-weight: 600; color: #1d4ed8; background: #eff6ff;
      border-top: 1px solid #dbeafe; text-align: center;
      -webkit-tap-highlight-color: transparent;
    }
    .ts-type-hint:active { background: #dbeafe; }
  `;
  document.head.appendChild(style);
};

/* ══════════ แตะครั้งแรก = ดูรายการ · แตะซ้ำ = พิมพ์ค้นหา (เฉพาะอุปกรณ์สัมผัส) ══════════ */

// ⚠️ ต้องเช็คตอนเกิดเหตุการณ์จริงทุกครั้ง ไม่ใช่คำนวณครั้งเดียวตอนติดตั้ง — เครื่อง 2-in-1 สลับโหมด
// แท็บเล็ต/โน้ตบุ๊กได้ระหว่างใช้งาน และ (pointer: coarse) เปลี่ยนตาม
const isTouchDevice = () => {
  try { return window.matchMedia("(pointer: coarse)").matches; } catch { return false; }
};

/** หา instance จาก element ที่ถูกแตะ — ไล่จาก .tomselected เพราะ element เดิมเป็น "พี่น้อง" ของ
 *  wrapper ไม่ใช่ลูก (ดูคำเตือนที่ getOpenInstance ด้านบน)
 *  ⚠️ ต้องเช็ค dropdown ด้วย ไม่ใช่แค่ wrapper — dropdownParent:"body" ทำให้กล่องรายการ (และแถบ
 *  "แตะเพื่อพิมพ์" ที่อยู่ข้างใน) ไม่ได้เป็นลูกของ wrapper อีกต่อไป */
const instanceFromNode = (node) => {
  for (const el of document.querySelectorAll(".tomselected")) {
    const ts = el.tomselect;
    if (ts?.wrapper?.contains(node) || ts?.dropdown?.contains(node)) return ts;
  }
  return null;
};

const HINT_CLASS = "ts-type-hint";

/**
 * แถบ "แตะเพื่อพิมพ์ค้นหา" ท้ายกล่องรายการ — element จริงที่กดได้ (ไม่ใช่ ::after เหมือนเดิม)
 * ⚠️ ต้องเป็นลูกของ ts.dropdown ไม่ใช่ ts.dropdown_content — refreshOptions() ของ TomSelect เขียนทับ
 * innerHTML ของ dropdown_content ทุกครั้งที่กรอง/เปิดใหม่ ถ้าใส่ไว้ข้างในแถบจะหายทันทีที่เริ่มพิมพ์
 */
const ensureTypeHint = (ts, show) => {
  const dd = ts?.dropdown;
  if (!dd) return;
  const existing = dd.querySelector(`.${HINT_CLASS}`);
  if (!show) { existing?.remove(); return; }
  if (existing) return;
  const hint = document.createElement("div");
  hint.className = HINT_CLASS;
  hint.setAttribute("role", "button");
  hint.textContent = "⌨️ แตะเพื่อพิมพ์ค้นหา";
  dd.appendChild(hint);
};

const setTyping = (ts, allowed) => {
  const input = ts?.control_input;
  if (!input) return;
  // readOnly = กันคีย์บอร์ดของทุกเบราว์เซอร์ · inputMode:"none" = บอก Chrome/Android ตรงๆ อีกชั้น
  // (ตั้งทั้งคู่เพราะเบราว์เซอร์รุ่นเก่าบางตัวรองรับอย่างใดอย่างหนึ่งเท่านั้น)
  input.readOnly = !allowed;
  input.inputMode = allowed ? "text" : "none";
  input.dataset.tsTyping = allowed ? "1" : "0";
  // แถบบอกวิธีใช้ท้ายกล่อง — ไม่งั้นคนใช้ไม่มีทางรู้ว่าพิมพ์ค้นหาได้
  ensureTypeHint(ts, !allowed);
};

/**
 * ปลดล็อกให้พิมพ์ + เรียกคีย์บอร์ดขึ้นมาให้ได้จริง
 *
 * 🐛 BUG ที่แก้ (ผู้ใช้แจ้ง: "ฟอร์มใน event ที่เป็น select...ในแอพมือถือ หรือที่ลงเป็นแบบแอพ ไม่สามารถ
 * กดพิมพ์ได้"): เดิมโค้ดตรงนี้เรียก input.focus() ใน setTimeout(...,0) ซึ่งพังบน iOS/PWA 2 ชั้นพร้อมกัน
 *   1. setTimeout ทำให้หลุดออกจาก "บริบทที่ผู้ใช้แตะ" (user activation) — iOS เรียกคีย์บอร์ดให้เฉพาะตอน
 *      โฟกัสเกิดขึ้น "แบบ synchronous" ในจังหวะ gesture เท่านั้น หน่วงแม้ 0ms ก็ถูกปฏิเสธ
 *   2. ต่อให้ไม่หน่วง ช่องนั้นก็ถูกโฟกัสค้างอยู่แล้วตั้งแต่แตะครั้งแรก — focus() ซ้ำบน element ที่โฟกัส
 *      อยู่แล้วเป็น no-op และการแค่ปลด readOnly ทีหลังไม่ทำให้คีย์บอร์ดเด้งขึ้นมาเอง
 * ผลรวมคือบน iPhone/PWA พิมพ์ค้นหาไม่ได้เลยสักครั้ง (Android รอดเพราะผ่อนปรนกว่า)
 *
 * ✅ ต้อง blur → focus ใหม่ "แบบ synchronous ในจังหวะแตะ" ถึงจะนับเป็นการโฟกัสครั้งใหม่จริง
 * ⚠️ blur ตรงๆ ไม่ได้ — onBlur ของ TomSelect สั่ง close() ปิดกล่องทิ้ง ✅ ตั้ง isFocused=false ก่อน
 * เพราะ onBlur มี guard "if (!self.isFocused) return;" อยู่บรรทัดแรกๆ (ดู source ของ tom-select)
 * จึงคืนออกไปทันทีโดยไม่ปิดกล่อง — จากนั้น focus() จะวิ่งเข้า onFocus ที่เปิดกล่องกลับให้เองตามปกติ
 */
const unlockTypingNow = (ts) => {
  const input = ts?.control_input;
  if (!input) return;
  setTyping(ts, true);
  try {
    ts.isFocused = false;
    input.blur();
    input.focus({ preventScroll: true });
    ts.isFocused = true;
    if (!ts.isOpen) ts.open();
  } catch { /* instance ถูกทำลายไปแล้ว */ }
};

// instance ที่ "ขอปลดล็อกให้พิมพ์" ไว้ตอน pointerdown แล้วรอไปทำจริงตอน click (ดูเหตุผลที่ onClickCapture)
let pendingUnlock = null;

const onTapControl = (e) => {
  if (!isTouchDevice()) return; // เดสก์ท็อปไม่มีคีย์บอร์ดมาบัง — พิมพ์ได้ทันทีเหมือนเดิม
  const node = e.target;
  if (!node?.closest) { pendingUnlock = null; return; }

  // ── แตะแถบ "แตะเพื่อพิมพ์ค้นหา" ในกล่องรายการ → ทางลัดที่ชัดเจนกว่าการแตะช่องซ้ำ ──
  if (node.closest(`.${HINT_CLASS}`)) {
    pendingUnlock = instanceFromNode(node);
    return;
  }
  // แตะตัวเลือกในกล่อง/ปุ่มลบชิป (×) ไม่ใช่การขอพิมพ์
  if (node.closest(".ts-dropdown") || node.closest(".remove")) { pendingUnlock = null; return; }

  const control = node.closest(".ts-control");
  if (!control) { pendingUnlock = null; return; }

  const ts = instanceFromNode(control);
  if (!ts?.control_input) { pendingUnlock = null; return; }

  if (ts.isOpen && ts.control_input.dataset.tsTyping !== "1") {
    // ── แตะครั้งที่ 2 ขณะรายการเปิดอยู่ = ขอพิมพ์ ──
    // ⚠️ ยังปลดล็อกที่นี่ไม่ได้ ต้องรอ click — เพราะ TomSelect ผูก handler ไว้ที่ 'click' ของ control
    // ซึ่งสั่ง blur() ปิดกล่องทิ้งเมื่อแตะซ้ำขณะเปิดอยู่ (onClick: if (isFocused && isOpen) self.blur())
    // ถ้าปลดล็อก+โฟกัสตอน pointerdown มันจะโดนปิดตามหลังทุกครั้ง
    pendingUnlock = ts;
    return;
  }

  pendingUnlock = null;
  if (!ts.isOpen) {
    // ── แตะครั้งแรก (หรือเปิดใหม่หลังปิดไป) → ล็อกไว้ก่อน ให้เห็นรายการเต็มๆ โดยคีย์บอร์ดไม่เด้ง ──
    // ต้องทำใน pointerdown/touchstart ซึ่งวิ่ง "ก่อน" TomSelect สั่งโฟกัสช่องพิมพ์ ถ้าไปตั้งใน focusin
    // เบราว์เซอร์ตัดสินใจเรียกคีย์บอร์ดไปแล้ว สายเกินแก้
    setTyping(ts, false);
  }
};

/**
 * ปลดล็อกจริงในจังหวะ click — ต้องเป็น capture ที่ window เพื่อให้วิ่ง "ก่อน" handler ของ TomSelect
 * ที่ผูกไว้ที่ตัว control แล้ว stopPropagation ทิ้ง ไม่ให้ onClick() ของมันได้ทำงาน (ไม่งั้นมันจะ
 * blur() ปิดกล่องทันที) — click เป็นบริบท user gesture ที่ iOS ยอมเปิดคีย์บอร์ดให้เช่นกัน
 */
const onClickCapture = (e) => {
  const ts = pendingUnlock;
  pendingUnlock = null;
  if (!ts || !isTouchDevice()) return;
  e.stopPropagation();
  unlockTypingNow(ts);
};

export function installTomSelectFixes() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  injectDropdownStyles();

  // ⚠️ ต้องแทนที่ prototype ให้ทันก่อน TomSelect เรียก positionDropdown ของตัวเองตอนเปิด — ดักที่
  // mousedown/touchstart/focusin แบบ capture ที่ document ซึ่งวิ่งก่อน handler ของตัว control เสมอ
  // (TomSelect สั่ง open() อยู่ใน handler ของ control เอง) จังหวะนั้นมี instance อยู่ในหน้าแน่นอนแล้ว
  const tryPatch = () => patchPositioning();
  ["mousedown", "touchstart", "focusin", "keydown"].forEach((evt) => {
    window.addEventListener(evt, tryPatch, { capture: true, passive: true });
  });

  let rafId = null;
  const reposition = () => {
    if (rafId) return; // รวมหลายเหตุการณ์ที่ยิงถี่ๆ (scroll/resize) ให้คำนวณครั้งเดียวต่อเฟรม
    rafId = requestAnimationFrame(() => {
      rafId = null;
      const ts = getOpenInstance();
      if (!ts) return;
      // ⚠️ ห่อ try — เมธอดนี้แตะ DOM ของ dropdown ถ้า instance เพิ่งถูกทำลายไประหว่างนี้ (ปิดฟอร์มพอดี
      // จังหวะ) จะ throw แล้วทำให้ listener ตัวนี้ตายไปทั้งตัว กระทบทุกช่องหลังจากนั้น
      // ✅ เรียก positionFixed ตรงๆ ด้วย (ไม่พึ่ง patch) เผื่อ prototype ยังไม่ถูกแทนที่ด้วยเหตุใดก็ตาม
      try { positionFixed.call(ts); } catch { /* instance ถูกทำลายไปแล้ว — ไม่ต้องทำอะไร */ }
    });
  };

  // ⚠️ ต้องเป็น capture ที่ document และเป็น pointerdown/touchstart (ไม่ใช่ click/focusin) — ต้องวิ่ง
  // ก่อน handler ของ TomSelect เองที่สั่งโฟกัสช่องพิมพ์ ไม่งั้นคีย์บอร์ดขึ้นไปแล้ว
  // passive:true — ไม่ได้เรียก preventDefault ที่ไหน บอกเบราว์เซอร์ไว้เลยจะได้ไม่กระตุกตอนเลื่อนจอ
  ["pointerdown", "touchstart"].forEach((evt) => {
    window.addEventListener(evt, onTapControl, { capture: true, passive: true });
  });
  // ⚠️ passive:false — ตัวนี้ต้องเรียก stopPropagation ได้จริง (ดูเหตุผลที่ onClickCapture)
  window.addEventListener("click", onClickCapture, { capture: true });

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
