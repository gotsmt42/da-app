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

/** ขอให้หน้าต่างปิดตัวเอง — Esc ไปที่หน้าต่างนั้น (MUI Modal / SweetAlert รับ Esc อยู่แล้ว) */
const requestClose = (paper) => {
  // กล่องฟอร์ม SweetAlert ปิด Esc ไว้ (กันข้อมูลหาย) — กดปุ่ม ✕ ของกล่องแทน (ใช้กติกาปิดของฟอร์มนั้นเอง)
  const closeBtn = paper.matches(".swal2-popup") && paper.querySelector("#ee-close-btn, .swal2-close, [data-swipe-close]");
  if (closeBtn && closeBtn.offsetParent !== null) { closeBtn.click(); return; }
  const evt = new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true, cancelable: true });
  (paper.querySelector("[tabindex]") || paper).dispatchEvent(evt);
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

function onMove(e) {
  if (!state) return;
  const y = e.touches[0].clientY;
  const dy = y - state.startY;
  const dx = Math.abs(e.touches[0].clientX - state.startX);
  if (!state.active) {
    // เริ่มลากจริงเมื่อเลื่อนลงชัดเจน และไม่ใช่การปัดแนวนอน
    if (dy < 8 || dx > dy) { if (dy < -4 || dx > 12) state = null; return; }
    state.active = true;
    state.paper.style.transition = "none";
    state.paper.style.willChange = "transform";
  }
  state.dy = Math.max(0, dy);
  // ลากเกินขอบเล็กน้อยให้รู้สึกหนืด
  state.paper.style.transform = `translateY(${state.dy}px)`;
  if (e.cancelable) e.preventDefault();
}

function onEnd() {
  if (!state) return;
  const { paper, dy, t0, active } = state;
  state = null;
  if (!active) return;
  const fast = dy > 50 && dy / Math.max(1, Date.now() - t0) > 0.6;
  paper.style.transition = "transform .22s ease";
  if (dy > CLOSE_AT || fast) {
    paper.style.transform = `translateY(${Math.max(dy, window.innerHeight)}px)`;
    requestClose(paper);
    // หน้าต่างที่ปิดด้วย Esc ไม่ได้ → เด้งกลับ
    setTimeout(() => {
      if (document.body.contains(paper)) { paper.style.transform = ""; }
      setTimeout(() => { paper.style.transition = ""; paper.style.willChange = ""; }, 240);
    }, 260);
  } else {
    paper.style.transform = "";
    setTimeout(() => { paper.style.transition = ""; paper.style.willChange = ""; }, 240);
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
  // ขีดจับด้านบนของหน้าต่างเต็มจอ/ลิ้นชักล่างบนมือถือ — บอกว่าลากลงปิดได้
  const css = document.createElement("style");
  css.textContent = `@media (max-width:600px) and (pointer:coarse){
    .MuiDialog-paperFullScreen:not(.tt-swipe-native)::before,.MuiDrawer-paperAnchorBottom:not(.tt-swipe-native)::before{content:"";display:block;flex-shrink:0;width:40px;height:5px;border-radius:99px;background:#cbd5e1;margin:8px auto 2px}
  }`;
  document.head.appendChild(css);
}
