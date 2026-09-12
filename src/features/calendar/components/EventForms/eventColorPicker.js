/* ═════════════════════════════════════════════════════════════════════════════
   ตัวเลือกสีงานบนปฏิทิน — ใช้ร่วมกันทั้งฟอร์ม "เพิ่มแผนงาน" (AddEvent) และ "แก้ไขงาน" (EditEvent)

   🐛 ของเดิม: เป็น <input type="color"> ของเบราว์เซอร์ล้วนๆ ช่องละ ~40×32px
      - บนมือถือมันเปิดวงล้อสีจิ๋วของระบบ ต้องลากทีละนิดกว่าจะได้สีที่ต้องการ (ผู้ใช้แจ้งว่า
        "เลื่อนกำหนดสียาก") และจะเลือกสีเดิมซ้ำให้ตรงกับงานก่อนหน้าแทบเป็นไปไม่ได้
      - ไม่เห็นว่าสีพื้น + สีข้อความที่เลือกไว้ อยู่ด้วยกันแล้วหน้าตาเป็นยังไง ต้องกดบันทึกก่อนถึงรู้
      - เลือกพื้นเข้มคู่กับตัวอักษรเข้มได้อย่างอิสระ → การ์ดบนปฏิทินอ่านไม่ออก โดยไม่มีอะไรเตือน

   ✅ ของใหม่ = "แถวสรุปเล็กๆ ในฟอร์ม + แผงเลือกสีซ้อนทับ"
      ⚠️ รอบแรกวางจานสีทั้งหมดไว้ในฟอร์มตรงๆ ผู้ใช้ทดสอบบนเครื่องจริงแล้วแจ้งว่ากินพื้นที่ส่วนอื่น
      จนหัวข้อถัดไป (เอกสาร ฯลฯ) ถูกดันตกไปท้ายกล่อง — ตอนนี้ในฟอร์มเหลือแค่แถวเดียวสูง ~54px
      ที่บอกสีปัจจุบัน กดแล้วค่อยเปิดแผงเต็มซ้อนขึ้นมา เลือกเสร็จก็ปิด ไม่แย่งที่ใครเลย

      ในแผงมีให้ครบ 3 ระดับ ไล่จากง่ายสุดไปละเอียดสุด:
      1) "ใช้ล่าสุด" — คู่สีที่เพิ่งใช้ไป แตะครั้งเดียวจบ (งานชุดเดียวกันมักใช้สีเดียวกัน)
      2) จานสีสำเร็จ 36 สี — แตะครั้งเดียวได้ทั้งสีพื้นและสีข้อความที่อ่านออกคู่กันอัตโนมัติ
      3) ปรับเอง — สไลเดอร์ เฉดสี/ความสด/ความสว่าง (ลากด้วยนิ้วง่ายกว่าวงล้อมาก) + แถบน้ำหนักสี
         + ช่องรหัสสี #RRGGBB สำหรับกำหนดเป๊ะๆ + ดูดสีจากหน้าจอ + จานสีของเครื่องเป็นทางสำรอง
      โดยมีตัวอย่างการ์ดจริงและตัววัดความอ่านง่าย (contrast ratio ตาม WCAG) แสดงตลอดเวลา

   ⚠️ ข้อสำคัญเรื่องความเข้ากันได้กับของเดิม: วิดเจ็ตนี้ยังคง <input type="color"> ตัวจริงไว้ครบ
   ทั้ง 2 ช่อง (แค่ซ่อนตา) และคง id เดิมไว้ทุกประการ — โค้ดตอนกดบันทึกที่อ่านค่าด้วย
   document.getElementById("backgroundColorPicker").value จึงทำงานเหมือนเดิมทุกอย่าง
   ห้ามถอด input สองตัวนี้ออกเด็ดขาด

   ⚠️ แผงซ้อนถูก append ไว้ที่ <body> ไม่ใช่ในกล่อง SweetAlert — กล่องของ Swal มี transform
   จากแอนิเมชันเปิด ซึ่งทำให้ position:fixed ข้างในกลายเป็นอิงกล่องแทนที่จะอิงหน้าจอ แผงจะโผล่
   ผิดที่/ถูกตัดขอบทันที · เพราะอยู่คนละที่กัน โค้ดจึงต้องอ้าง element ในแผงผ่านตัวแปร panel
   ไม่ใช่ค้นจาก root
═════════════════════════════════════════════════════════════════════════════ */

const RECENT_KEY = "ec-recent-event-colors";
const RECENT_MAX = 6;

/* ── จานสีสำเร็จ ── สด / เข้ม / อ่อน แถวละ 12 เรียงลำดับเฉดสีตรงกันทั้ง 3 แถว
   เพื่อให้กวาดตาลงแนวตั้งแล้วเจอ "สีเดียวกันแต่คนละน้ำหนัก" ได้ทันที */
const PRESET_ROWS = [
  ["#ef4444", "#f97316", "#f59e0b", "#eab308", "#22c55e", "#10b981", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#64748b"],
  ["#991b1b", "#9a3412", "#b45309", "#4d7c0f", "#166534", "#047857", "#0e7490", "#1d4ed8", "#4338ca", "#6d28d9", "#be185d", "#0f172a"],
  ["#fee2e2", "#ffedd5", "#fef3c7", "#fef9c3", "#dcfce7", "#d1fae5", "#cffafe", "#dbeafe", "#e0e7ff", "#ede9fe", "#fce7f3", "#ffffff"],
];

/* ═══════════ คณิตศาสตร์เรื่องสี ═══════════ */
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const hex2 = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");

/** รับค่าอะไรมาก็ได้ คืน #rrggbb ตัวพิมพ์เล็กเสมอ (รองรับ #abc แบบย่อ) อ่านไม่ออกคืนค่าสำรอง */
export function normalizeHex(value, fallback = "#3b82f6") {
  const s = String(value || "").trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(s)) return `#${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s}`.toLowerCase();
  return fallback;
}

function hexToRgb(hex) {
  const h = normalizeHex(hex).slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

const rgbToHex = ({ r, g, b }) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

function rgbToHsl({ r, g, b }) {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === R) h = (G - B) / d + (G < B ? 6 : 0);
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }) {
  const H = ((((h % 360) + 360) % 360) / 360);
  const S = clamp(s, 0, 100) / 100;
  const L = clamp(l, 0, 100) / 100;
  if (S === 0) return { r: L * 255, g: L * 255, b: L * 255 };
  const q = L < 0.5 ? L * (1 + S) : L + S - L * S;
  const p = 2 * L - q;
  const hue = (t) => {
    let T = t;
    if (T < 0) T += 1;
    if (T > 1) T -= 1;
    if (T < 1 / 6) return p + (q - p) * 6 * T;
    if (T < 1 / 2) return q;
    if (T < 2 / 3) return p + (q - p) * (2 / 3 - T) * 6;
    return p;
  };
  return { r: hue(H + 1 / 3) * 255, g: hue(H) * 255, b: hue(H - 1 / 3) * 255 };
}

const hexToHsl = (hex) => rgbToHsl(hexToRgb(hex));
const hslToHex = (hsl) => rgbToHex(hslToRgb(hsl));

/** ความสว่างสัมพัทธ์ตามสูตร WCAG 2.x */
function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const ch = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** อัตราส่วนความต่างระหว่างสองสี 1–21 (ยิ่งมากยิ่งอ่านง่าย) */
export function contrastRatio(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** สีข้อความที่อ่านออกที่สุดบนพื้นสีนี้ — ขาว หรือดำเนียนๆ อย่างใดอย่างหนึ่ง */
export function bestTextOn(bg) {
  return contrastRatio(bg, "#ffffff") >= contrastRatio(bg, "#111827") ? "#ffffff" : "#111827";
}

/* ═══════════ คู่สีที่เพิ่งใช้ (เก็บในเครื่องผู้ใช้ ไม่ขึ้น server) ═══════════ */
function readRecent() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((x) => x && x.bg && x.text)
      .slice(0, RECENT_MAX)
      .map((x) => ({ bg: normalizeHex(x.bg), text: normalizeHex(x.text, "#ffffff") }));
  } catch {
    return []; // localStorage ถูกปิด/ข้อมูลเสีย — ไม่ใช่เรื่องคอขาดบาดตาย ทำงานต่อโดยไม่มีรายการล่าสุด
  }
}

/**
 * จำคู่สีที่ใช้จริง — เรียกตอน "บันทึกงานสำเร็จ" เท่านั้น ไม่ใช่ตอนลากสไลเดอร์
 * ไม่งั้นรายการจะเต็มไปด้วยสีระหว่างทางที่ผู้ใช้ไม่ได้ตั้งใจใช้จริง
 */
export function rememberEventColors(bg, text) {
  const item = { bg: normalizeHex(bg), text: normalizeHex(text, "#ffffff") };
  try {
    const next = [
      item,
      ...readRecent().filter((x) => !(x.bg === item.bg && x.text === item.text)),
    ].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* เขียนไม่ได้ก็ข้ามไป ห้ามให้กระทบการบันทึกงาน */
  }
}

/* ═══════════ CSS ═══════════ */
function injectColorPickerStyles() {
  if (document.getElementById("ec-color-picker-styles")) return;
  const style = document.createElement("style");
  style.id = "ec-color-picker-styles";
  style.textContent = `
    /* ⚠️ text-align: left — SweetAlert จัดข้อความในกล่องเป็นกึ่งกลาง ซึ่งทำให้หัวข้อย่อยและปุ่ม
       ในวิดเจ็ตนี้ลอยไปอยู่กลาง ไม่เรียงเป็นแนวเดียวกับช่องกรอกอื่นของฟอร์ม */
    .ecp, .ecp-sheet { font-family: inherit; text-align: left; }
    /* input ตัวจริงที่เก็บค่า — ซ่อนตาแต่ห้ามถอดออก (ดูหัวไฟล์) */
    .ecp-store {
      position: absolute; width: 1px; height: 1px; opacity: 0;
      pointer-events: none; border: 0; padding: 0;
    }

    /* ══ แถวสรุปในฟอร์ม (กินที่แค่แถวเดียว) ══ */
    .ecp-trigger {
      display: flex; align-items: center; gap: 10px; width: 100%;
      padding: 8px 10px; border-radius: 10px; cursor: pointer;
      border: 1.5px solid #e2e8f0; background: #fff; font-family: inherit; text-align: left;
      transition: border-color .15s, box-shadow .15s;
    }
    .ecp-trigger:hover { border-color: #cbd5e1; box-shadow: 0 2px 8px rgba(15, 23, 42, .06); }
    .ecp-trigger-card {
      flex: 0 0 auto; width: 104px; min-width: 104px; border-radius: 6px; padding: 5px 7px;
      display: flex; flex-direction: column; gap: 1px; overflow: hidden;
      box-shadow: 0 1px 3px rgba(15, 23, 42, .18);
    }
    .ecp-trigger-t1 { font-size: 10px; font-weight: 800; line-height: 1.25; }
    .ecp-trigger-t2 { font-size: 8.5px; font-weight: 600; line-height: 1.3; opacity: .9; }
    .ecp-trigger-body { flex: 1; min-width: 0; }
    .ecp-trigger-hex {
      display: block; font-size: 11.5px; font-weight: 700; color: #1e293b; text-transform: uppercase;
      font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .ecp-trigger-note { display: block; font-size: 10.5px; font-weight: 700; margin-top: 1px; }
    .ecp-trigger-note--ok { color: #15803d; }
    .ecp-trigger-note--warn { color: #b45309; }
    .ecp-trigger-note--bad { color: #b91c1c; }
    .ecp-trigger-go {
      flex: 0 0 auto; border-radius: 999px; padding: 5px 11px;
      background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;
      font-size: 11px; font-weight: 800; white-space: nowrap;
    }
    .ecp.is-disabled .ecp-trigger { pointer-events: none; opacity: .6; cursor: not-allowed; }
    .ecp.is-disabled .ecp-trigger-go { display: none; }

    /* ══ แผงซ้อนทับ ══
       ⚠️ z-index ต้องสูงกว่ากล่อง SweetAlert (1060) และสูงกว่า dropdown ของ TomSelect
       ที่ไฟล์ฟอร์มดันไว้ที่ 100000 ด้วย ไม่งั้นแผงจะไปอยู่ใต้ของพวกนั้น */
    .ecp-overlay {
      position: fixed; inset: 0; z-index: 100001;
      display: flex; align-items: flex-end; justify-content: center;
    }
    .ecp-overlay[hidden] { display: none; }
    .ecp-backdrop { position: absolute; inset: 0; background: rgba(15, 23, 42, .55); }
    .ecp-sheet {
      position: relative; display: flex; flex-direction: column;
      width: 100%; max-width: 560px; max-height: 88vh;
      background: #fff; border-radius: 18px 18px 0 0;
      box-shadow: 0 -8px 40px rgba(15, 23, 42, .35);
      animation: ecp-rise .18s ease-out;
    }
    @keyframes ecp-rise { from { transform: translateY(14px); opacity: .6; } to { transform: none; opacity: 1; } }
    .ecp-sheet-head {
      flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 10px;
      padding: 13px 16px; border-bottom: 1.5px solid #e2e8f0;
    }
    .ecp-sheet-title { font-size: 14px; font-weight: 800; color: #0f172a; }
    .ecp-x {
      border: 0; background: #f1f5f9; color: #475569; cursor: pointer; font-family: inherit;
      width: 32px; height: 32px; border-radius: 50%; font-size: 15px; font-weight: 800; line-height: 1;
    }
    .ecp-x:hover { background: #e2e8f0; }
    /* ⚠️ overscroll-behavior: contain — กันการเลื่อนในแผงไป "ทะลุ" ไปเลื่อนฟอร์มที่อยู่ข้างหลัง */
    .ecp-sheet-body { flex: 1 1 auto; overflow-y: auto; overscroll-behavior: contain; padding: 14px 16px; }
    .ecp-sheet-foot {
      flex: 0 0 auto; display: flex; gap: 8px; justify-content: flex-end;
      padding: 11px 16px; border-top: 1.5px solid #e2e8f0; background: #f8fafc;
      border-radius: 0 0 0 0;
      /* เผื่อแถบบาร์ล่างของมือถือ (iPhone home indicator) ไม่ให้ทับปุ่ม */
      padding-bottom: calc(11px + env(safe-area-inset-bottom, 0px));
    }
    .ecp-btn {
      border-radius: 9px; cursor: pointer; font-family: inherit;
      font-size: 13px; font-weight: 800; padding: 9px 18px;
    }
    .ecp-btn--ghost { border: 1.5px solid #e2e8f0; background: #fff; color: #475569; }
    .ecp-btn--ghost:hover { background: #f1f5f9; }
    .ecp-btn--primary { border: 0; background: #2563eb; color: #fff; }
    .ecp-btn--primary:hover { background: #1d4ed8; }

    /* ── ตัวอย่างการ์ด + ค่าปัจจุบันของสองช่อง ── */
    .ecp-top { display: flex; gap: 12px; align-items: stretch; flex-wrap: wrap; margin-bottom: 12px; }
    .ecp-preview {
      flex: 1 1 190px; min-width: 0;
      display: flex; align-items: center; justify-content: center;
      padding: 10px; border-radius: 10px; border: 1.5px solid #e2e8f0;
      /* ลายตารางหมากรุกอ่อนๆ ให้เห็นว่าสีอ่อนมากๆ ยังเป็นสีทึบอยู่ ไม่ใช่โปร่งใส */
      background:
        linear-gradient(45deg, #f1f5f9 25%, transparent 25%) -6px 0/12px 12px,
        linear-gradient(-45deg, #f1f5f9 25%, transparent 25%) -6px 0/12px 12px,
        linear-gradient(45deg, transparent 75%, #f1f5f9 75%) -6px 0/12px 12px,
        linear-gradient(-45deg, transparent 75%, #f1f5f9 75%) -6px 0/12px 12px,
        #fff;
    }
    .ecp-preview-card {
      width: 100%; max-width: 230px; border-radius: 6px; padding: 6px 8px;
      display: flex; flex-direction: column; gap: 2px; overflow: hidden;
      box-shadow: 0 1px 3px rgba(15, 23, 42, .18);
    }
    .ecp-preview-title { font-size: 12px; font-weight: 800; line-height: 1.3; }
    .ecp-preview-sub { font-size: 10.5px; font-weight: 600; line-height: 1.35; opacity: .9; }

    .ecp-chans { flex: 0 1 250px; min-width: 190px; display: flex; flex-direction: column; gap: 6px; }
    /* ปุ่มช่องสี = ทั้งตัวบอกค่าปัจจุบัน และตัวเลือกว่าส่วน "ปรับเอง" จะทำงานกับช่องไหน */
    .ecp-chan {
      display: flex; align-items: center; gap: 9px; width: 100%;
      padding: 7px 10px; border-radius: 9px; cursor: pointer;
      border: 1.5px solid #e2e8f0; background: #fff;
      font-family: inherit; text-align: left;
      transition: border-color .15s, box-shadow .15s;
    }
    .ecp-chan:hover { border-color: #cbd5e1; }
    .ecp-chan.is-active { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, .12); }
    .ecp-chan-dot {
      flex-shrink: 0; width: 26px; height: 26px; border-radius: 7px;
      box-shadow: inset 0 0 0 1.5px rgba(15, 23, 42, .15);
    }
    .ecp-chan-body { flex: 1; min-width: 0; }
    .ecp-chan-label { display: block; font-size: 11px; font-weight: 700; color: #475569; line-height: 1.3; }
    .ecp-chan-hex {
      display: block; font-size: 12px; font-weight: 700; color: #1e293b; text-transform: uppercase;
      font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
    }
    .ecp-contrast {
      margin: 0 0 12px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
      font-size: 11.5px; font-weight: 700; border-radius: 8px; padding: 6px 9px;
    }
    .ecp-contrast--ok { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
    .ecp-contrast--warn { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
    .ecp-contrast--bad { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
    .ecp-fix {
      border: 0; color: #fff; cursor: pointer; font-family: inherit;
      font-size: 10.5px; font-weight: 700; border-radius: 999px; padding: 3px 9px; line-height: 1.4;
    }
    .ecp-contrast--warn .ecp-fix { background: #b45309; }
    .ecp-contrast--bad .ecp-fix { background: #b91c1c; }

    /* ── จานสี ──
       ⚠️ ใช้ grid ไม่ใช่ flex-wrap — flex ทำให้แถวสุดท้ายเหลือเศษไม่เต็มแถว (เช่น 10+2) ดูรุ่งริ่ง
       และสีเฉดเดียวกันของแต่ละกลุ่มจะไม่ตรงคอลัมน์กัน ซึ่งเป็นจุดขายของการเรียงแบบนี้ */
    .ecp-group-label {
      margin: 0 0 6px; font-size: 11px; font-weight: 700; color: #64748b;
      display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    }
    .ecp-swatch-row {
      display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; margin-bottom: 8px;
    }
    .ecp-sw {
      position: relative; padding: 0; width: 100%; height: 36px;
      border-radius: 8px; cursor: pointer;
      border: 1.5px solid rgba(15, 23, 42, .12);
      font-family: inherit; font-size: 12px; font-weight: 800;
      display: flex; align-items: center; justify-content: center;
      transition: transform .12s, box-shadow .12s;
    }
    .ecp-sw:hover { transform: translateY(-1px); box-shadow: 0 3px 8px rgba(15, 23, 42, .2); }
    .ecp-sw.is-on { box-shadow: 0 0 0 2.5px #2563eb; transform: translateY(-1px); }
    .ecp-sw.is-on::after {
      content: "✓"; position: absolute; top: -6px; right: -6px;
      width: 15px; height: 15px; border-radius: 50%; background: #2563eb; color: #fff;
      font-size: 9px; font-weight: 900; line-height: 15px; text-align: center;
      box-shadow: 0 1px 3px rgba(0, 0, 0, .3);
    }

    /* ── ส่วนปรับเอง ── */
    .ecp-more {
      display: inline-flex; align-items: center; gap: 6px;
      border: 1.5px solid #e2e8f0; background: #fff; border-radius: 9px;
      padding: 8px 14px; cursor: pointer; font-family: inherit;
      font-size: 12px; font-weight: 700; color: #334155;
    }
    .ecp-more:hover { border-color: #cbd5e1; background: #f8fafc; }
    .ecp-more-caret { transition: transform .18s; }
    .ecp-more[aria-expanded="true"] .ecp-more-caret { transform: rotate(180deg); }

    .ecp-fine {
      margin-top: 10px; padding: 12px; border-radius: 10px;
      background: #f8fafc; border: 1.5px solid #e2e8f0;
    }
    .ecp-fine-head { margin: 0 0 10px; font-size: 11.5px; font-weight: 700; color: #475569; }
    .ecp-fine-head b { color: #1e293b; }

    /* ── สไลเดอร์ ── ลากด้วยนิ้วง่ายกว่าวงล้อสีของระบบมาก จึงเป็นทางหลักของการปรับละเอียด
       ⚠️ touch-action: none — ขาดบรรทัดนี้ บนมือถือการลากจะถูกเบราว์เซอร์ตีความเป็นการเลื่อน
       หน้าจอ แล้วค่าจะไม่ขยับตามนิ้ว (อาการเดียวกับที่เจอในวงล้อสีเดิมเป๊ะๆ) */
    .ecp-slider { margin-bottom: 9px; }
    .ecp-slider-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; }
    .ecp-slider-name { font-size: 11px; font-weight: 700; color: #475569; }
    .ecp-slider-val {
      font-size: 11px; font-weight: 700; color: #1e293b;
      font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
    }
    .ecp-range {
      -webkit-appearance: none; appearance: none;
      display: block; width: 100%; height: 28px; margin: 0; padding: 0;
      background: transparent; cursor: pointer; touch-action: none;
    }
    .ecp-range:focus { outline: none; }
    .ecp-range::-webkit-slider-runnable-track {
      height: 14px; border-radius: 999px; background: var(--ecp-track, #e2e8f0);
      box-shadow: inset 0 0 0 1px rgba(15, 23, 42, .14);
    }
    .ecp-range::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none; border: 0;
      width: 26px; height: 26px; margin-top: -6px; border-radius: 50%; background: #fff;
      box-shadow: 0 0 0 1.5px rgba(15, 23, 42, .3), 0 2px 6px rgba(15, 23, 42, .32);
    }
    .ecp-range::-moz-range-track {
      height: 14px; border-radius: 999px; background: var(--ecp-track, #e2e8f0);
      box-shadow: inset 0 0 0 1px rgba(15, 23, 42, .14);
    }
    .ecp-range::-moz-range-thumb {
      width: 26px; height: 26px; border-radius: 50%; background: #fff; border: 0;
      box-shadow: 0 0 0 1.5px rgba(15, 23, 42, .3), 0 2px 6px rgba(15, 23, 42, .32);
    }

    /* ── แถบน้ำหนักสี (เฉดเดิม ไล่อ่อน → เข้ม) ── */
    .ecp-ramp {
      display: flex; border-radius: 8px; overflow: hidden;
      margin-bottom: 10px; border: 1.5px solid #e2e8f0;
    }
    .ecp-ramp button {
      position: relative; flex: 1; height: 30px; border: 0; padding: 0;
      cursor: pointer; font-family: inherit;
    }
    .ecp-ramp button.is-on::after {
      content: ""; position: absolute; inset: 0; box-shadow: inset 0 0 0 2.5px #2563eb;
    }

    /* ── แถวล่าง: รหัสสี + ปุ่มช่วย ── */
    .ecp-row { display: flex; gap: 7px; align-items: center; flex-wrap: wrap; }
    .ecp-hex-wrap {
      display: flex; align-items: center; gap: 5px; flex: 1 1 140px; min-width: 130px;
      border: 1.5px solid #e2e8f0; border-radius: 8px; background: #fff; padding: 0 9px;
    }
    .ecp-hex-wrap:focus-within { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, .12); }
    .ecp-hex-hash { font-size: 13px; font-weight: 800; color: #94a3b8; }
    /* ⚠️ !important — ฟอร์มทั้งสองมีกฎจัดหน้าตา input ของตัวเองอยู่ (.ae-field input / .ee-field input)
       ที่ใส่ขอบและ padding มาให้ ซึ่งจะทำให้ช่องนี้กลายเป็นกล่องซ้อนกล่อง */
    .ecp-hex {
      flex: 1; min-width: 0; outline: none; background: transparent;
      border: 0 !important; box-shadow: none !important; padding: 8px 0 !important;
      font-size: 13px; font-weight: 700; color: #1e293b; text-transform: uppercase;
      font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
    }
    .ecp-mini {
      border: 1.5px solid #e2e8f0; background: #fff; border-radius: 8px; cursor: pointer;
      font-family: inherit; font-size: 11.5px; font-weight: 700; color: #334155;
      padding: 8px 11px; white-space: nowrap;
    }
    .ecp-mini:hover { border-color: #cbd5e1; background: #f1f5f9; }

    /* ── จอแคบ: ปุ่มสองช่องสีเรียงคู่กันเต็มแถว ──
       เดิมมันตกลงมาอยู่บรรทัดใหม่แล้วกว้างแค่ 250px เหลือที่ว่างครึ่งแถว ทั้งเปลืองความสูงของแผง
       (ซึ่งมีจำกัดบนมือถือ) และดูเหมือนจัดวางพลาด */
    @media (max-width: 640px) {
      .ecp-chans { flex: 1 1 100%; flex-direction: row; min-width: 0; }
      .ecp-chan { flex: 1 1 0; min-width: 0; padding: 7px 8px; gap: 7px; }
      .ecp-chan-hex { font-size: 11px; }
    }

    /* ── จอกว้าง: แผงลอยกลางจอแทนที่จะแปะขอบล่าง และจานสีเรียง 12 ช่องต่อแถว ── */
    @media (min-width: 641px) {
      .ecp-overlay { align-items: center; }
      .ecp-sheet { border-radius: 16px; max-height: 86vh; width: 92vw; }
      .ecp-sheet-foot { border-radius: 0 0 16px 16px; }
      .ecp-swatch-row { grid-template-columns: repeat(12, 1fr); }
      .ecp-sw { height: 32px; }
    }
  `;
  document.head.appendChild(style);
}

/* ═══════════ HTML ═══════════ */
/**
 * คืน HTML ของ "แถวสรุป" ที่จะไปวางในฟอร์ม (กินที่แค่แถวเดียว)
 * แผงเลือกสีตัวเต็มถูกสร้างตอน mountColorPicker() แล้วแปะไว้ที่ <body> แยกต่างหาก
 * @param {string} bgId   id ของ input สีพื้นหลัง (ต้องเป็น id เดิมที่โค้ดตอนบันทึกอ่านอยู่)
 * @param {string} textId id ของ input สีข้อความ
 */
export function colorPickerHtml({ bgId, textId, bg, text, disabled = false }) {
  const b = normalizeHex(bg, "#3b82f6");
  const t = normalizeHex(text, "#ffffff");
  const dis = disabled ? " disabled" : "";
  return `
  <div class="ecp${disabled ? " is-disabled" : ""}" data-ecp data-bg-id="${bgId}" data-text-id="${textId}">
    <input type="color" id="${bgId}" class="ecp-store" value="${b}"${dis}>
    <input type="color" id="${textId}" class="ecp-store" value="${t}"${dis}>
    <button type="button" class="ecp-trigger" data-ecp-open>
      <span class="ecp-trigger-card" data-ecp-trigger-card>
        <span class="ecp-trigger-t1">ตัวอย่างการ์ดงาน</span>
        <span class="ecp-trigger-t2">บริษัท · 08:30–17:00</span>
      </span>
      <span class="ecp-trigger-body">
        <span class="ecp-trigger-hex" data-ecp-trigger-hex></span>
        <span class="ecp-trigger-note" data-ecp-trigger-note></span>
      </span>
      <span class="ecp-trigger-go">เปลี่ยนสี</span>
    </button>
  </div>`;
}

/** HTML ของแผงซ้อน (สร้างตอน mount แล้วแปะที่ body) */
function sheetHtml(disabled) {
  const dis = disabled ? " disabled" : "";
  return `
  <div class="ecp-backdrop" data-ecp-close></div>
  <div class="ecp-sheet" role="dialog" aria-modal="true" aria-label="เลือกสีการ์ดงาน">
    <div class="ecp-sheet-head">
      <span class="ecp-sheet-title">🎨 สีการ์ดงานบนปฏิทิน</span>
      <button type="button" class="ecp-x" data-ecp-close aria-label="ปิด">✕</button>
    </div>

    <div class="ecp-sheet-body">
      <div class="ecp-top">
        <div class="ecp-preview">
          <div class="ecp-preview-card" data-ecp-card>
            <span class="ecp-preview-title">ตัวอย่างการ์ดงานบนปฏิทิน</span>
            <span class="ecp-preview-sub">บริษัทตัวอย่าง · 08:30–17:00 น.</span>
          </div>
        </div>
        <div class="ecp-chans">
          <button type="button" class="ecp-chan is-active" data-ecp-chan="bg">
            <span class="ecp-chan-dot" data-ecp-dot="bg"></span>
            <span class="ecp-chan-body">
              <span class="ecp-chan-label">🎨 สีพื้นหลัง</span>
              <span class="ecp-chan-hex" data-ecp-hexlabel="bg"></span>
            </span>
          </button>
          <button type="button" class="ecp-chan" data-ecp-chan="text">
            <span class="ecp-chan-dot" data-ecp-dot="text"></span>
            <span class="ecp-chan-body">
              <span class="ecp-chan-label">✏️ สีข้อความ</span>
              <span class="ecp-chan-hex" data-ecp-hexlabel="text"></span>
            </span>
          </button>
        </div>
      </div>

      <p class="ecp-contrast" data-ecp-contrast></p>

      <div data-ecp-recent-wrap hidden>
        <p class="ecp-group-label">🕘 ใช้ล่าสุด</p>
        <div class="ecp-swatch-row" data-ecp-recent></div>
      </div>

      <p class="ecp-group-label">
        จานสีสำเร็จ
        <span style="font-weight:600;color:#94a3b8;">— แตะครั้งเดียวได้ทั้งสีพื้นและสีข้อความที่อ่านออก</span>
      </p>
      <div data-ecp-presets></div>

      <button type="button" class="ecp-more" data-ecp-more aria-expanded="false">
        🎚️ ปรับสีเอง <span class="ecp-more-caret">▾</span>
      </button>

      <div class="ecp-fine" data-ecp-fine hidden>
        <p class="ecp-fine-head">กำลังปรับ: <b data-ecp-fine-target>สีพื้นหลัง</b> — สลับช่องได้ที่ปุ่มด้านบน</p>

        <div class="ecp-slider">
          <div class="ecp-slider-top">
            <span class="ecp-slider-name">เฉดสี</span>
            <span class="ecp-slider-val" data-ecp-val="h"></span>
          </div>
          <input type="range" class="ecp-range" data-ecp-range="h" min="0" max="360" step="1"${dis}>
        </div>
        <div class="ecp-slider">
          <div class="ecp-slider-top">
            <span class="ecp-slider-name">ความสด</span>
            <span class="ecp-slider-val" data-ecp-val="s"></span>
          </div>
          <input type="range" class="ecp-range" data-ecp-range="s" min="0" max="100" step="1"${dis}>
        </div>
        <div class="ecp-slider">
          <div class="ecp-slider-top">
            <span class="ecp-slider-name">ความสว่าง</span>
            <span class="ecp-slider-val" data-ecp-val="l"></span>
          </div>
          <input type="range" class="ecp-range" data-ecp-range="l" min="0" max="100" step="1"${dis}>
        </div>

        <p class="ecp-group-label" style="margin-top:10px;">น้ำหนักสี (เฉดเดิม ไล่อ่อน → เข้ม)</p>
        <div class="ecp-ramp" data-ecp-ramp></div>

        <div class="ecp-row">
          <div class="ecp-hex-wrap">
            <span class="ecp-hex-hash">#</span>
            <input type="text" class="ecp-hex" data-ecp-hex maxlength="6" spellcheck="false" placeholder="RRGGBB"${dis}>
          </div>
          <button type="button" class="ecp-mini" data-ecp-native>🎯 จานสีของเครื่อง</button>
          <button type="button" class="ecp-mini" data-ecp-eyedropper hidden>💧 ดูดสีจากหน้าจอ</button>
          <button type="button" class="ecp-mini" data-ecp-white hidden>⬜ ขาว</button>
          <button type="button" class="ecp-mini" data-ecp-black hidden>⬛ ดำ</button>
        </div>
      </div>
    </div>

    <div class="ecp-sheet-foot">
      <button type="button" class="ecp-btn ecp-btn--ghost" data-ecp-reset>คืนค่าเดิม</button>
      <button type="button" class="ecp-btn ecp-btn--primary" data-ecp-close>เสร็จสิ้น</button>
    </div>
  </div>`;
}

/* ═══════════ พฤติกรรม ═══════════ */
/**
 * ผูกการทำงานให้วิดเจ็ตทุกตัวที่อยู่ใน scope — เรียกใน didOpen ของ SweetAlert
 * @returns {Function} ฟังก์ชันถอด listener + ลบแผงซ้อนออกจาก body (เรียกตอนปิดกล่อง)
 */
export function mountColorPicker(scope = document) {
  injectColorPickerStyles();
  const cleanups = [...scope.querySelectorAll("[data-ecp]")].map(setupOne);
  return () => cleanups.forEach((fn) => fn());
}

function setupOne(root) {
  const store = {
    bg: document.getElementById(root.dataset.bgId),
    text: document.getElementById(root.dataset.textId),
  };
  if (!store.bg || !store.text) return () => {};

  const disabled = root.classList.contains("is-disabled");
  let channel = "bg"; // ช่องที่ส่วน "ปรับเอง" กำลังทำงานด้วยอยู่
  let openedWith = null; // ค่าตอนเปิดแผง ใช้กับปุ่ม "คืนค่าเดิม"

  const get = (ch) => normalizeHex(store[ch].value, ch === "bg" ? "#3b82f6" : "#ffffff");

  /* แผงซ้อน — แปะที่ body (ดูเหตุผลเรื่อง transform ที่หัวไฟล์) */
  const overlay = document.createElement("div");
  overlay.className = "ecp-overlay";
  overlay.hidden = true;
  overlay.innerHTML = sheetHtml(disabled);
  document.body.appendChild(overlay);

  const q = (sel) => overlay.querySelector(sel);
  const els = {
    trigger: root.querySelector("[data-ecp-open]"),
    triggerCard: root.querySelector("[data-ecp-trigger-card]"),
    triggerHex: root.querySelector("[data-ecp-trigger-hex]"),
    triggerNote: root.querySelector("[data-ecp-trigger-note]"),
    card: q("[data-ecp-card]"),
    contrast: q("[data-ecp-contrast]"),
    fine: q("[data-ecp-fine]"),
    more: q("[data-ecp-more]"),
    fineTarget: q("[data-ecp-fine-target]"),
    ramp: q("[data-ecp-ramp]"),
    hex: q("[data-ecp-hex]"),
    presets: q("[data-ecp-presets]"),
    recentWrap: q("[data-ecp-recent-wrap]"),
    recent: q("[data-ecp-recent]"),
    white: q("[data-ecp-white]"),
    black: q("[data-ecp-black]"),
    eyedropper: q("[data-ecp-eyedropper]"),
    native: q("[data-ecp-native]"),
    body: q(".ecp-sheet-body"),
  };
  const ranges = {
    h: q('[data-ecp-range="h"]'),
    s: q('[data-ecp-range="s"]'),
    l: q('[data-ecp-range="l"]'),
  };
  const vals = {
    h: q('[data-ecp-val="h"]'),
    s: q('[data-ecp-val="s"]'),
    l: q('[data-ecp-val="l"]'),
  };

  /** ตั้งค่าสีของช่องหนึ่ง
   *  ⚠️ ต้อง dispatch "input"/"change" ด้วย — การตั้ง .value ด้วยสคริปต์ไม่ทำให้ event ยิงเอง
   *  และ EditEvent เทียบค่าก่อน/หลังเพื่อดูว่ามีการแก้ไขจริงหรือไม่ก่อนบันทึก */
  const setColor = (ch, hex) => {
    const v = normalizeHex(hex, get(ch));
    if (store[ch].value === v) return;
    store[ch].value = v;
    store[ch].dispatchEvent(new Event("input", { bubbles: true }));
    store[ch].dispatchEvent(new Event("change", { bubbles: true }));
  };

  const contrastLevel = (bg, text) => {
    const ratio = contrastRatio(bg, text);
    return { ratio, level: ratio >= 4.5 ? "ok" : ratio >= 3 ? "warn" : "bad" };
  };

  /* ── แถวสรุปในฟอร์ม (วาดเสมอ ถึงแผงจะปิดอยู่) ── */
  const renderTrigger = () => {
    const bg = get("bg");
    const text = get("text");
    els.triggerCard.style.background = bg;
    els.triggerCard.style.color = text;
    els.triggerHex.textContent = `พื้น ${bg.toUpperCase()} · ตัวอักษร ${text.toUpperCase()}`;
    const { ratio, level } = contrastLevel(bg, text);
    els.triggerNote.className = `ecp-trigger-note ecp-trigger-note--${level}`;
    els.triggerNote.textContent = {
      ok: `✓ อ่านง่าย (${ratio.toFixed(1)}:1)`,
      warn: `△ พออ่านได้ (${ratio.toFixed(1)}:1)`,
      bad: `⚠ อ่านยาก (${ratio.toFixed(1)}:1)`,
    }[level];
  };

  /* ── แผงซ้อน (วาดเฉพาะตอนเปิด — ปิดอยู่ก็ไม่ต้องเสียแรง) ── */
  const renderSheet = () => {
    const bg = get("bg");
    const text = get("text");

    els.card.style.background = bg;
    els.card.style.color = text;

    ["bg", "text"].forEach((ch) => {
      const v = ch === "bg" ? bg : text;
      overlay.querySelector(`[data-ecp-dot="${ch}"]`).style.background = v;
      overlay.querySelector(`[data-ecp-hexlabel="${ch}"]`).textContent = v;
      overlay.querySelector(`[data-ecp-chan="${ch}"]`).classList.toggle("is-active", ch === channel);
    });

    // ความอ่านง่าย — เกณฑ์ WCAG: 4.5:1 ขึ้นไปถือว่าผ่านสำหรับตัวอักษรขนาดปกติ
    const { ratio, level } = contrastLevel(bg, text);
    const label = {
      ok: "✓ อ่านง่ายชัดเจน",
      warn: "△ พออ่านได้ แต่ตัวเล็กจะเริ่มล้าตา",
      bad: "⚠ อ่านยาก สีพื้นกับสีตัวอักษรใกล้กันเกินไป",
    }[level];
    els.contrast.className = `ecp-contrast ecp-contrast--${level}`;
    els.contrast.innerHTML =
      `<span>${label} (${ratio.toFixed(1)}:1)</span>` +
      (level === "ok" || disabled ? "" : '<button type="button" class="ecp-fix" data-ecp-fix>แก้ให้อ่านง่าย</button>');

    // ⚠️ ติ๊กถูกเฉพาะตอนที่ "ตรงทั้งคู่" เท่านั้น — จานสีหนึ่งช่องหมายถึงคู่สี ไม่ใช่สีเดี่ยว
    // ถ้าติ๊กเพราะบังเอิญตรงแค่สีใดสีหนึ่ง (เช่นสีข้อความเป็นขาวก็ไปติ๊กช่องสีขาว) จะสื่อผิด
    const pairKey = `${bg}|${text}`;
    overlay.querySelectorAll("[data-ecp-sw]").forEach((el) => {
      el.classList.toggle("is-on", el.dataset.ecpPair === pairKey);
    });

    // ── ส่วนปรับเอง ──
    const active = get(channel);
    els.fineTarget.textContent = channel === "bg" ? "สีพื้นหลัง" : "สีข้อความ";
    const hsl = hexToHsl(active);
    const H = Math.round(hsl.h);
    const S = Math.round(hsl.s);
    const L = Math.round(hsl.l);
    ranges.h.value = H;
    ranges.s.value = S;
    ranges.l.value = L;
    vals.h.textContent = `${H}°`;
    vals.s.textContent = `${S}%`;
    vals.l.textContent = `${L}%`;
    ranges.h.style.setProperty(
      "--ecp-track",
      "linear-gradient(90deg,#f00 0%,#ff0 16.66%,#0f0 33.33%,#0ff 50%,#00f 66.66%,#f0f 83.33%,#f00 100%)",
    );
    ranges.s.style.setProperty(
      "--ecp-track",
      `linear-gradient(90deg, ${hslToHex({ h: H, s: 0, l: L })}, ${hslToHex({ h: H, s: 100, l: L })})`,
    );
    ranges.l.style.setProperty(
      "--ecp-track",
      `linear-gradient(90deg, #000, ${hslToHex({ h: H, s: S, l: 50 })}, #fff)`,
    );

    // แถบน้ำหนักสี — เฉดเดิม ไล่สว่าง 94% → 8%
    els.ramp.innerHTML = "";
    [94, 86, 76, 66, 56, 46, 38, 30, 22, 15, 8].forEach((lv) => {
      const hexv = hslToHex({ h: H, s: S, l: lv });
      const btn = document.createElement("button");
      btn.type = "button";
      btn.style.background = hexv;
      btn.title = hexv;
      btn.dataset.ecpRampStep = hexv;
      if (hexv === active) btn.classList.add("is-on");
      els.ramp.appendChild(btn);
    });

    // อย่าเขียนทับขณะผู้ใช้กำลังพิมพ์อยู่ในช่องนั้นเอง
    if (document.activeElement !== els.hex) els.hex.value = active.slice(1).toUpperCase();

    // ปุ่ม ขาว/ดำ มีความหมายเฉพาะกับสีข้อความ
    els.white.hidden = channel !== "text";
    els.black.hidden = channel !== "text";
  };

  const render = () => {
    renderTrigger();
    if (!overlay.hidden) renderSheet();
  };

  /* ── สร้างจานสี ── */
  const swatchBtn = (bg, text, title) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "ecp-sw";
    el.style.background = bg;
    el.style.color = text;
    el.textContent = "ก";
    el.title = title;
    el.dataset.ecpSw = bg;
    el.dataset.ecpText = text;
    el.dataset.ecpPair = `${bg}|${text}`;
    return el;
  };

  PRESET_ROWS.forEach((row) => {
    const wrap = document.createElement("div");
    wrap.className = "ecp-swatch-row";
    row.forEach((bg) => {
      const text = bestTextOn(bg);
      wrap.appendChild(swatchBtn(bg, text, `${bg} · ตัวอักษร ${text}`));
    });
    els.presets.appendChild(wrap);
  });

  const recents = readRecent();
  if (recents.length) {
    els.recentWrap.hidden = false;
    recents.forEach(({ bg, text }) => {
      els.recent.appendChild(swatchBtn(bg, text, `${bg} · ตัวอักษร ${text}`));
    });
  }

  /* ── เปิด/ปิดแผง ── */
  const openSheet = () => {
    openedWith = { bg: get("bg"), text: get("text") };
    channel = "bg";
    overlay.hidden = false;
    renderSheet();
    els.body.scrollTop = 0;
  };
  const closeSheet = () => {
    overlay.hidden = true;
    renderTrigger();
  };
  const onTrigger = () => openSheet();
  els.trigger.addEventListener("click", onTrigger);

  /* ── เหตุการณ์ในแผง ── */
  const onOverlayClick = (e) => {
    if (e.target.closest("[data-ecp-close]")) {
      closeSheet();
      return;
    }

    const chan = e.target.closest("[data-ecp-chan]");
    if (chan) {
      channel = chan.dataset.ecpChan;
      renderSheet();
      return;
    }

    if (e.target.closest("[data-ecp-fix]")) {
      setColor("text", bestTextOn(get("bg")));
      render();
      return;
    }

    const sw = e.target.closest("[data-ecp-sw]");
    if (sw) {
      // แตะจานสี = ได้ทั้งคู่ในครั้งเดียว — นี่คือทางลัดหลักที่ทำให้ "เลือกง่าย"
      setColor("bg", sw.dataset.ecpSw);
      setColor("text", sw.dataset.ecpText);
      render();
      return;
    }

    const step = e.target.closest("[data-ecp-ramp-step]");
    if (step) {
      setColor(channel, step.dataset.ecpRampStep);
      render();
      return;
    }

    if (e.target.closest("[data-ecp-white]")) {
      setColor(channel, "#ffffff");
      render();
      return;
    }
    if (e.target.closest("[data-ecp-black]")) {
      setColor(channel, "#111827");
      render();
      return;
    }

    if (e.target.closest("[data-ecp-reset]")) {
      if (openedWith) {
        setColor("bg", openedWith.bg);
        setColor("text", openedWith.text);
        render();
      }
    }
  };
  overlay.addEventListener("click", onOverlayClick);

  const onMore = () => {
    const open = els.fine.hidden;
    els.fine.hidden = !open;
    els.more.setAttribute("aria-expanded", String(open));
  };
  els.more.addEventListener("click", onMore);

  const onRange = () => {
    setColor(channel, hslToHex({ h: +ranges.h.value, s: +ranges.s.value, l: +ranges.l.value }));
    render();
  };
  Object.values(ranges).forEach((r) => r.addEventListener("input", onRange));

  const onHex = () => {
    const raw = els.hex.value.trim();
    if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(raw)) return; // ยังพิมพ์ไม่ครบ ปล่อยให้พิมพ์ต่อ
    setColor(channel, `#${raw}`);
    render();
  };
  els.hex.addEventListener("input", onHex);
  const onHexBlur = () => {
    els.hex.value = get(channel).slice(1).toUpperCase();
  };
  els.hex.addEventListener("blur", onHexBlur);

  // จานสีของเครื่อง — เก็บไว้เป็นทางเลือกสำรอง ไม่ใช่ทางหลักอีกต่อไป
  // ⚠️ input ถูกซ่อนด้วย opacity/ขนาด 1px ไม่ใช่ display:none — เบราว์เซอร์ไม่เปิดหน้าต่างเลือกสี
  // ให้กับ element ที่ display:none
  const onNative = () => {
    const input = store[channel];
    try {
      if (typeof input.showPicker === "function") input.showPicker();
      else input.click();
    } catch {
      input.click();
    }
  };
  els.native.addEventListener("click", onNative);

  // ค่าจากจานสีของเครื่องเข้ามาทาง event ของ input เอง จึงต้องวาดใหม่ตาม
  const onStoreInput = () => render();
  store.bg.addEventListener("input", onStoreInput);
  store.text.addEventListener("input", onStoreInput);

  // ปิดแผงด้วย Esc
  // ⚠️ stopPropagation — กล่อง SweetAlert ตั้ง allowEscapeKey:false ไว้ก็จริง แต่กันไม่ให้ตัวจัดการ
  // อื่นที่ดักอยู่เข้าใจผิดว่าเป็นการสั่งปิดฟอร์มทั้งกล่อง
  const onKeyDown = (e) => {
    if (e.key !== "Escape" || overlay.hidden) return;
    e.stopPropagation();
    e.preventDefault();
    closeSheet();
  };
  document.addEventListener("keydown", onKeyDown, true);

  // ดูดสีจากหน้าจอ — มีเฉพาะบางเบราว์เซอร์ (Chrome/Edge) จึงซ่อนไว้ถ้าไม่รองรับ
  let onEyedropper = null;
  if (typeof window !== "undefined" && "EyeDropper" in window) {
    els.eyedropper.hidden = false;
    onEyedropper = async () => {
      try {
        const { sRGBHex } = await new window.EyeDropper().open();
        setColor(channel, sRGBHex);
        render();
      } catch {
        /* ผู้ใช้กด Esc ยกเลิก — ไม่ต้องทำอะไร */
      }
    };
    els.eyedropper.addEventListener("click", onEyedropper);
  }

  renderTrigger();

  return () => {
    els.trigger.removeEventListener("click", onTrigger);
    overlay.removeEventListener("click", onOverlayClick);
    els.more.removeEventListener("click", onMore);
    Object.values(ranges).forEach((r) => r.removeEventListener("input", onRange));
    els.hex.removeEventListener("input", onHex);
    els.hex.removeEventListener("blur", onHexBlur);
    els.native.removeEventListener("click", onNative);
    store.bg.removeEventListener("input", onStoreInput);
    store.text.removeEventListener("input", onStoreInput);
    document.removeEventListener("keydown", onKeyDown, true);
    if (onEyedropper) els.eyedropper.removeEventListener("click", onEyedropper);
    overlay.remove(); // ⚠️ แผงอยู่ที่ body — Swal ลบแค่กล่องของตัวเอง ถ้าไม่ลบเองจะค้างทับหน้าจอ
  };
}
