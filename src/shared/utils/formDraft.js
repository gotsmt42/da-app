/**
 * formDraft — เก็บข้อมูลที่ผู้ใช้กรอกค้างไว้ในฟอร์ม ไม่ให้หายเมื่อฟอร์มหลุด/เด้งปิด/แอปรีโหลด
 *
 * ✅ (10 ต.ค. 2569 ผู้ใช้: "ทุกฟอร์มที่ยังกรอกไม่เสร็จแล้วอาจจะหลุด เด้งออก ข้อมูลในฟอร์มยังไม่ให้หายไป")
 *   • เก็บใน localStorage (อยู่รอดแม้แอป/แท็บรีโหลด) แยกตามผู้ใช้ · หมดอายุ 10 นาทีหลังพิมพ์ครั้งล่าสุด (ผู้ใช้เลือก)
 *   • เปิดฟอร์มเดิมอีกครั้งภายใน 10 นาที → เติมข้อมูลคืนให้เอง + แถบ "กู้คืนข้อมูลที่กรอกค้างไว้ · ล้างทิ้ง"
 *   • บันทึกสำเร็จ → ล้างทิ้งทันที
 * ⚠️ ไฟล์แนบ/รูปเก็บไม่ได้ (ต้องเลือกใหม่) — เก็บเฉพาะข้อความ/ตัวเลือก/วันที่
 * ⚠️ เบราว์เซอร์ปิด storage (โหมดส่วนตัว) = ทำงานเหมือนเดิมทุกอย่าง แค่ไม่มีการกู้คืน
 */
export const DRAFT_TTL_MS = 10 * 60 * 1000;

const userKey = () => {
  try {
    const p = JSON.parse(localStorage.getItem("payload") || "{}");
    return String(p.userId || p._id || "anon");
  } catch { return "anon"; }
};
const fullKey = (key) => `formDraft:${userKey()}:${key}`;

export function saveDraft(key, data) {
  try { localStorage.setItem(fullKey(key), JSON.stringify({ at: Date.now(), data })); } catch { /* storage ปิดอยู่ */ }
}

/** @returns {{ at:number, data:any } | null} */
export function loadDraft(key, ttl = DRAFT_TTL_MS) {
  try {
    const raw = localStorage.getItem(fullKey(key));
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || Date.now() - Number(d.at || 0) > ttl) { localStorage.removeItem(fullKey(key)); return null; }
    return d;
  } catch { return null; }
}

export function clearDraft(key) {
  try { localStorage.removeItem(fullKey(key)); } catch { /* storage ปิดอยู่ */ }
}

/** ล้างร่างที่หมดอายุทั้งหมด — เรียกตอนเปิดแอปครั้งเดียว ไม่ให้ค้างสะสม */
export function sweepExpiredDrafts(ttl = DRAFT_TTL_MS) {
  try {
    const dead = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("formDraft:")) continue;
      try {
        const d = JSON.parse(localStorage.getItem(k) || "{}");
        if (Date.now() - Number(d.at || 0) > ttl) dead.push(k);
      } catch { dead.push(k); }
    }
    dead.forEach((k) => localStorage.removeItem(k));
  } catch { /* storage ปิดอยู่ */ }
}

export const draftAgoText = (at) => {
  const m = Math.max(0, Math.round((Date.now() - at) / 60000));
  return m < 1 ? "เมื่อสักครู่" : `${m} นาทีที่แล้ว`;
};

/* ─────────────────────────────────────────────────────────────
 * ฟอร์ม HTML ใน SweetAlert (AddEvent / AddDraftEvent / EditEvent / นัดหมายเซล)
 *   const draft = domFormDraft(popup, "addEvent", { bannerHost: "#ae-body" });
 *   didOpen ต้นสุด: draft.restore()  (ก่อน TomSelect/ปฏิทิน mount — ให้มันอ่านค่าที่เติมคืนแล้ว)
 *   didOpen ท้ายสุด: draft.start()    (ส่ง change ให้ส่วนที่ซ่อน/แสดงตามตัวเลือก + เริ่มบันทึกตอนพิมพ์)
 *   บันทึกสำเร็จ: draft.clear()
 * ───────────────────────────────────────────────────────────── */
const fieldsOf = (root) => [...root.querySelectorAll("input, select, textarea")]
  .filter((el) => (el.id || (el.type === "radio" && el.name)) && !["file", "password", "hidden", "button", "submit"].includes(el.type) && !el.closest("[data-no-draft]"));

const collect = (root) => {
  const out = {};
  fieldsOf(root).forEach((el) => {
    if (el.type === "radio") { if (el.checked) out[`radio:${el.name}`] = el.value; return; }
    if (el.type === "checkbox") { out[el.id] = el.checked; return; }
    if (el.multiple) { out[el.id] = [...el.selectedOptions].map((o) => o.value); return; }
    out[el.id] = el.value;
  });
  return out;
};

const apply = (root, data, { fire = false, togglesOnly = false } = {}) => {
  Object.entries(data || {}).forEach(([k, v]) => {
    if (k.startsWith("radio:")) {
      const el = root.querySelector(`input[type="radio"][name="${CSS.escape(k.slice(6))}"][value="${CSS.escape(String(v))}"]`);
      if (el) { el.checked = true; if (fire) el.dispatchEvent(new Event("change", { bubbles: true })); }
      return;
    }
    const el = root.querySelector(`#${CSS.escape(k)}`);
    if (!el || el.disabled) return;
    if (togglesOnly && el.type !== "checkbox") return;
    if (el.type === "checkbox") {
      el.checked = Boolean(v);
      if (fire) el.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    const val = Array.isArray(v) ? v : String(v ?? "");
    if (el.tagName === "SELECT") {
      const vals = Array.isArray(val) ? val : [val];
      vals.filter(Boolean).forEach((x) => {
        if (![...el.options].some((o) => o.value === x)) el.add(new Option(x, x));
      });
      if (el.tomselect) {
        vals.forEach((x) => { if (x && !el.tomselect.options[x]) el.tomselect.addOption({ value: x, text: x }); });
        el.tomselect.setValue(Array.isArray(val) ? val : val, !fire);
        return;
      }
      if (Array.isArray(val)) [...el.options].forEach((o) => { o.selected = val.includes(o.value); });
      else el.value = val;
    } else {
      el.value = val;
    }
    if (fire) {
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
};

export function domFormDraft(root, key, { bannerHost } = {}) {
  let restored = null;
  let defaults = null;
  let timer = null;
  let active = true;
  const save = () => {
    if (!active) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!active || !root.isConnected) return;
      const now = collect(root);
      // ยังไม่แก้อะไรจากค่าตั้งต้น = ไม่ต้องเก็บ (เปิดแล้วปิดเฉยๆ ไม่ทิ้งร่างไว้)
      if (defaults && JSON.stringify(now) === JSON.stringify(defaults) && !restored) return;
      saveDraft(key, now);
    }, 400);
  };
  return {
    /** เติมค่าที่กรอกค้างไว้ (เรียกก่อน TomSelect/ปฏิทินพ.ศ. mount) */
    restore() {
      defaults = collect(root);
      const d = loadDraft(key);
      if (!d) return false;
      restored = d;
      apply(root, d.data);
      return true;
    },
    /** เริ่มบันทึกตอนพิมพ์ + แสดงแถบกู้คืน (เรียกท้ายสุดของ didOpen) */
    start() {
      if (restored) {
        // ส่ง change ให้ตัวเลือกที่ซ่อน/แสดงส่วนอื่นของฟอร์ม (เช่น ประเภทงาน · หลายวัน) ทำงานตามค่าที่เติมคืน
        // ⚠️ เฉพาะ radio/checkbox — ไม่ยิง change ให้ช่องเลือกบริษัท/โครงการ ไม่งั้นตัวเติมอัตโนมัติจะทับค่าที่กู้คืน
        apply(root, restored.data, { fire: true, togglesOnly: true });
        const host = (bannerHost && root.querySelector(bannerHost)) || root;
        const bar = document.createElement("div");
        bar.setAttribute("data-no-draft", "");
        bar.style.cssText = "display:flex;align-items:center;gap:10px;margin:0 0 14px;padding:9px 12px;border-radius:10px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;font-size:13px;font-weight:600;text-align:left;";
        bar.innerHTML = `<span style="flex:1">↺ กู้คืนข้อมูลที่กรอกค้างไว้ (${draftAgoText(restored.at)})</span><button type="button" style="border:0;background:#fff;color:#1d4ed8;font-weight:800;font-size:12px;padding:5px 10px;border-radius:8px;cursor:pointer;border:1px solid #bfdbfe;font-family:inherit">ล้างทิ้ง</button>`;
        bar.querySelector("button").addEventListener("click", () => {
          clearDraft(key);
          restored = null;
          if (defaults) apply(root, defaults, { fire: true });
          bar.remove();
        });
        host.prepend(bar);
      }
      root.addEventListener("input", save, true);
      root.addEventListener("change", save, true);
    },
    clear() { active = false; clearTimeout(timer); clearDraft(key); },
    /** ฟอร์มกำลังปิด (ไม่ได้บันทึก) — เก็บค่าล่าสุดทันทีไม่ต้องรอหน่วงเวลา */
    stop() {
      if (!active) return;
      clearTimeout(timer);
      try {
        const now = collect(root);
        if (!(defaults && JSON.stringify(now) === JSON.stringify(defaults) && !restored)) saveDraft(key, now);
      } catch { /* ข้าม */ }
      active = false;
    },
  };
}
