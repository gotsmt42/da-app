/**
 * swipeToClose — "ลากลงเพื่อปิด" ให้หน้าต่างทุกแบบในแอปบนมือถือ (ติดตั้งครั้งเดียวที่ index.js)
 *
 * ✅ (21 ต.ค. 2569 ผู้ใช้: "ทำให้ทุกๆ เมนูในระบบที่มีการเปิด ให้สามารถเลื่อนลงเพื่อปิดได้ ง่ายต่อการใช้งานมือถือ")
 *    ครอบคลุม: กล่อง Dialog ของ MUI (ทุกหน้า) · ลิ้นชักล่าง (Drawer) · กล่อง SweetAlert (ฟอร์มแก้ไขงาน ฯลฯ)
 *    วิธีทำงาน: แตะที่ "หัวหน้าต่าง" (ด้านบน 72px) หรือที่เนื้อหาตอนเลื่อนอยู่บนสุด แล้วลากลง → หน้าต่างเลื่อนตามนิ้ว
 *    ลากเกิน 110px (หรือปัดเร็ว) = ปิด (ส่งปุ่ม Esc ให้หน้าต่างปิดตัวเองตามปกติ) · ไม่ถึง = เด้งกลับที่เดิม
 * ⚠️ ไม่แตะ: จอใหญ่ (มีเมาส์) · หน้าต่างที่ลากปิดได้อยู่แล้ว (.tt-swipe-native = SwipeableDrawer)
 *    · กล่องที่ตั้งใจห้ามปิดด้วย Esc (disableEscapeKeyDown / allowEscapeKey:false) — ลากแล้วเด้งกลับ ไม่ทำข้อมูลหาย
 *    · การลากที่เริ่มบนช่องกรอก/แถบเลื่อนแนวนอน/แผนที่/รูปที่ซูมได้
 */
const PAPER_SEL = ".MuiDialog-paper, .MuiDrawer-paperAnchorBottom, .swal2-popup";
const SKIP_SEL = "input, textarea, select, [contenteditable=true], .MuiSlider-root, .gm-style, [data-no-swipe], .leaflet-container, canvas";
const HEAD_ZONE = 72;
const CLOSE_AT = 110;

let state = null;

const isMobile = () => window.matchMedia("(max-width: 600px)").matches && window.matchMedia("(pointer: coarse)").matches;

/** มีส่วนไหนระหว่างจุดแตะกับหน้าต่างที่ยังเลื่อนขึ้นได้อยู่ (ยังไม่อยู่บนสุด) */
const scrolledDown = (el, paper) => {
  for (let n = el; n && n !== paper.parentElement; n = n.parentElement) {
    if (n.scrollTop > 0 && n.scrollHeight > n.clientHeight + 2) return true;
  }
  return false;
};

/** ปุ่มปิดของหน้าต่าง (✕ / ย้อนกลับ บนหัว) — ใช้เมื่อหน้าต่างไม่รับ Esc */
const CLOSE_BTN_SEL = [
  "[data-swipe-close]", "#ee-close-btn", ".swal2-close",
  'button[aria-label="ปิด"]', 'button[aria-label="close" i]', 'button[title="ปิด"]',
  'button:has(> svg[data-testid="CloseIcon"])', 'button:has(> svg[data-testid="CloseRoundedIcon"])',
  'button:has(> svg[data-testid="ArrowBackIcon"])', 'button:has(> svg[data-testid="ArrowBackIosNewIcon"])',
].join(",");
const findCloseBtn = (paper) => {
  const top = paper.getBoundingClientRect().top;
  let list = [];
  try { list = [...paper.querySelectorAll(CLOSE_BTN_SEL)]; } catch { list = [...paper.querySelectorAll("[data-swipe-close], #ee-close-btn, .swal2-close, button[aria-label='ปิด']")]; }
  // เอาปุ่มที่มองเห็นและอยู่ส่วนหัว (กันไปกดปุ่มลบรายการ ✕ ในเนื้อหา)
  return list.find((el) => el.offsetParent !== null && !el.disabled && el.getBoundingClientRect().top - top < 140) || null;
};

const pressEsc = (paper) => {
  const evt = new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true, cancelable: true });
  (paper.querySelector("[tabindex]") || paper).dispatchEvent(evt);
};

/**
 * ขอให้หน้าต่างปิดตัวเอง ตามลำดับ — หยุดทันทีที่หน้าต่างเริ่มปิด
 * 🐛 (21 ต.ค. 2569 ผู้ใช้: "หลายๆ หน้ากดเลื่อนลงปิดแต่ไม่ปิด") เดิมส่ง Esc อย่างเดียว — หน้าต่างที่ไม่ได้ผูก Esc
 *    (ไม่มี onClose / ปิดได้ทางปุ่ม ✕ อย่างเดียว) จึงเด้งกลับ → ลอง Esc → แตะพื้นหลัง → กดปุ่มปิดบนหัว
 */
const requestClose = (paper) => {
  const gone = () => !document.body.contains(paper) || isClosing(paper);
  const isSwal = paper.matches(".swal2-popup");
  const steps = [
    () => { const b = isSwal && findCloseBtn(paper); if (b) b.click(); else pressEsc(paper); },
    () => { if (!isSwal) paper.closest(".MuiModal-root")?.querySelector(":scope > .MuiBackdrop-root")?.click(); },
    () => { findCloseBtn(paper)?.click(); },
  ];
  let i = 0;
  const next = () => {
    if (i > 0 && gone()) return;
    if (i >= steps.length) return;
    steps[i++]();
    setTimeout(next, 160);
  };
  next();
};

/** หน้าต่างกำลังเล่นท่าปิดอยู่หรือไม่ (SweetAlert ใส่ swal2-hide · MUI ค่อยๆ จางพื้นหลังจนโปร่ง) */
const isClosing = (paper) => {
  if (paper.classList.contains("swal2-hide") || paper.closest(".swal2-backdrop-hide")) return true;
  const root = paper.closest(".MuiModal-root, .MuiDialog-root, .MuiDrawer-root");
  if (!root) return false;
  if (root.classList.contains("MuiModal-hidden")) return true;
  // ท่าปิดของ MUI (Fade) ตั้ง opacity เป็น "0" ที่กล่อง/พื้นหลัง · ค่าที่ไฟล์นี้ตั้งเองตอนลากไม่ใช่ "0" (จึงไม่สับสน)
  const cont = root.querySelector(":scope > .MuiDialog-container");
  const bd = root.querySelector(":scope > .MuiBackdrop-root");
  return cont?.style.opacity === "0" || bd?.style.opacity === "0";
};

/** กันแตะหลอก — หลังลากปิด นิ้วที่ยกขึ้นอาจกลายเป็นคลิกโดนการ์ดงานข้างใต้ แล้วเปิดหน้าต่างเดิมซ้ำ */
let ghostUntil = 0;
const blockGhostClick = () => { ghostUntil = Date.now() + 600; };
const onClickCapture = (e) => {
  // ⚠️ บล็อกเฉพาะคลิกจากนิ้วจริง (isTrusted) — คลิกที่โค้ดสั่งเอง (กดปุ่มปิด) ต้องผ่าน
  if (e.isTrusted && Date.now() < ghostUntil) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.(); }
};

function onStart(e) {
  if (!isMobile() || e.touches.length !== 1) return;
  const t = e.target;
  const paper = t.closest?.(PAPER_SEL);
  if (!paper || paper.closest(".tt-swipe-native") || t.closest(SKIP_SEL)) return;
  const rect = paper.getBoundingClientRect();
  const y = e.touches[0].clientY;
  const inHead = y - rect.top <= HEAD_ZONE;
  if (!inHead && scrolledDown(t, paper)) return;
  state = { paper, startY: y, startX: e.touches[0].clientX, dy: 0, t0: Date.now(), active: false, inHead };
}

/** พื้นหลังมืดของหน้าต่าง (MUI) — จางตามระยะลาก ให้รู้สึกว่าหน้าต่างกำลังจะปิด */
const backdropOf = (paper) => paper.closest(".MuiModal-root")?.querySelector(":scope > .MuiBackdrop-root") || null;

// 🔁 (21 ต.ค. 2569 ผู้ใช้: "หน้า event เลื่อนลงปิดยังดูแข็งๆ ไม่สมูท เหมือนเด้งๆ วาบๆ")
//    • ขยับตามนิ้วทุกเฟรม (requestAnimationFrame) และนับระยะจากจุดที่เริ่มลากจริง (เดิมกระโดด 8px ตอนเริ่ม)
//    • พื้นหลังค่อยๆ จางตามระยะลาก
//    • ปิด: เลื่อนลงจนพ้นจอให้จบก่อน แล้วค่อยสั่งปิด — เดิมสั่งปิดทันที ท่าปิดของ SweetAlert (ย่อ/จาง กลางจอ)
//      ทับตำแหน่งที่ลากไว้ หน้าต่างจึงเด้งกลับมากลางจอแล้ววาบหายไป
let raf = 0;
const paint = () => {
  raf = 0;
  if (!state?.active) return;
  state.paper.style.transform = `translate3d(0, ${state.dy}px, 0)`;
  if (state.backdrop) state.backdrop.style.opacity = String(Math.max(0.15, 1 - state.dy / (state.h * 0.9)));
};

function onMove(e) {
  if (!state) return;
  const y = e.touches[0].clientY;
  const dy = y - state.startY;
  const dx = Math.abs(e.touches[0].clientX - state.startX);
  if (!state.active) {
    // เริ่มลากจริงเมื่อเลื่อนลงชัดเจน และไม่ใช่การปัดแนวนอน
    if (dy < 6 || dx > dy) {
      if (dy < -4 || dx > 12) { state = null; return; }
      // นิ้วเริ่มลงแล้ว (ยังไม่ถึงเกณฑ์) — กันเบราว์เซอร์ยึดท่านี้ไปเป็นการเลื่อน/ดึงรีเฟรชก่อน
      if (dy > 0 && e.cancelable) e.preventDefault();
      return;
    }
    state.active = true;
    state.originY = y;
    state.h = state.paper.getBoundingClientRect().height || window.innerHeight;
    state.backdrop = backdropOf(state.paper);
    state.paper.style.transition = "none";
    state.paper.style.willChange = "transform";
    if (state.backdrop) state.backdrop.style.transition = "none";
  }
  state.dy = Math.max(0, y - state.originY);
  state.lastY = y; state.lastT = e.timeStamp;
  if (!raf) raf = requestAnimationFrame(paint);
  if (e.cancelable) e.preventDefault();
}

const EASE_OUT = "cubic-bezier(.22,.8,.3,1)";
const settle = (paper, backdrop) => {
  paper.style.transition = `transform .26s ${EASE_OUT}`;
  paper.style.transform = "";
  if (backdrop) { backdrop.style.transition = "opacity .26s ease"; backdrop.style.opacity = ""; }
  setTimeout(() => {
    paper.style.transition = ""; paper.style.willChange = "";
    if (backdrop) backdrop.style.transition = "";
  }, 280);
};

function onEnd() {
  if (!state) return;
  const { paper, dy, t0, active, backdrop, h } = state;
  state = null;
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  if (!active) return;
  const fast = dy > 40 && dy / Math.max(1, Date.now() - t0) > 0.5;
  if (dy > CLOSE_AT || fast) {
    blockGhostClick();
    const dist = Math.max(h || 0, window.innerHeight) + 40;
    const ms = Math.round(Math.min(280, Math.max(160, (dist - dy) * 0.35)));
    paper.style.transition = `transform ${ms}ms ${EASE_OUT}`;
    paper.style.transform = `translate3d(0, ${dist}px, 0)`;
    if (backdrop) { backdrop.style.transition = `opacity ${ms}ms ease`; backdrop.style.opacity = "0.001"; }
    setTimeout(() => {
      // พ้นจอแล้ว — ปิดท่าปิดในตัวของ SweetAlert (ไม่ให้กลับมาย่อ/จางกลางจอ) แล้วสั่งปิดจริง
      if (paper.matches(".swal2-popup")) {
        // ⚠️ ห้ามตั้ง animation: none — SweetAlert ค้างรอ animationend ไม่ถอดกล่อง (พื้นหลังใสค้างบังทั้งจอ)
        //    ใช้ท่าจางสั้นๆ ที่ไม่แตะ transform แทน (หน้าต่างอยู่นอกจอแล้ว)
        paper.style.setProperty("animation", "tt-swipe-out .12s forwards", "important");
        if (paper.parentElement) paper.parentElement.style.background = "transparent";
      }
      requestClose(paper);
      // 🐛 (21 ต.ค. 2569 "เลื่อนลงปิด ก็เปิดให้ซ้ำอีก") ดึงกลับเฉพาะหน้าต่างที่ "ไม่ยอมปิด" จริง (ยังอยู่และไม่ได้กำลังปิด)
      setTimeout(() => {
        if (document.body.contains(paper) && !isClosing(paper)) {
          paper.style.animation = "";
          if (paper.parentElement) paper.parentElement.style.background = "";
          settle(paper, backdrop);
        }
      }, 650);
    }, ms);
  } else {
    settle(paper, backdrop);
  }
}

let installed = false;
export function installSwipeToClose() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  document.addEventListener("touchstart", onStart, { passive: true, capture: true });
  document.addEventListener("touchmove", onMove, { passive: false, capture: true });
  document.addEventListener("touchend", onEnd, { passive: true, capture: true });
  document.addEventListener("touchcancel", onEnd, { passive: true, capture: true });
  document.addEventListener("click", onClickCapture, true);
  // ขีดจับด้านบนของหน้าต่างเต็มจอ/ลิ้นชักล่างบนมือถือ — บอกว่าลากลงปิดได้
  const css = document.createElement("style");
  css.textContent = `@keyframes tt-swipe-out{from{opacity:1}to{opacity:0}}
  @media (max-width:600px) and (pointer:coarse){
    .MuiDialog-paperFullScreen:not(.tt-swipe-native)::before,.MuiDrawer-paperAnchorBottom:not(.tt-swipe-native)::before{content:"";display:block;flex-shrink:0;width:40px;height:5px;border-radius:99px;background:#cbd5e1;margin:8px auto 2px}
  }`;
  document.head.appendChild(css);
}
