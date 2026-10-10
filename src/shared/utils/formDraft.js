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
  .filter((el) => (el.id || (el.type === "radio" && el.name)) && !["file", "password", "hidden", "button", "submit"].includes(el.type) && !el.closest("[data-no-draft]"))
  // ⚠️ id แบบ ":r5:" = id อัตโนมัติของ React (ช่องในปฏิทิน พ.ศ./MUI) เปลี่ยนทุกครั้งที่เปิด — ไม่ใช่ช่องของฟอร์ม
  .filter((el) => !/^:.*:$/.test(el.id || ""));

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

/**
 * ✅ (10 ต.ค. 2569 ผู้ใช้: "ข้อมูลเดิมมันนับเป็นพึ่งกรอกด้วย — ให้นับเฉพาะที่กรอกใหม่จริงๆ")
 *   • ค่าตั้งต้น (baseline) ถ่ายไว้ "หลัง" ฟอร์มเตรียมตัวเสร็จ (TomSelect/ปฏิทิน/ตัวเลือกสีจัดค่าเรียบร้อยแล้ว)
 *   • เก็บร่างเป็น { data, base } — กู้คืนเฉพาะช่องที่ data ต่างจาก base จริงๆ · ไม่มีช่องไหนต่าง = ไม่กู้คืน ไม่มีแถบ
 *   • นับเป็น "แก้" เฉพาะเมื่อมีการกด/พิมพ์จริงของผู้ใช้ไม่นาน (โค้ดเปลี่ยนค่าเอง เช่น โหลดตัวเลือกเสร็จ → ไม่นับ)
 */
let lastUserInputAt = 0;
if (typeof document !== "undefined") {
  const mark = (e) => { if (e.isTrusted) lastUserInputAt = Date.now(); };
  ["keydown", "pointerdown", "input", "change", "paste", "drop"].forEach((t) => document.addEventListener(t, mark, true));
}
/**
 * มีการกด/พิมพ์จริงของผู้ใช้ภายใน ms ที่ผ่านมาไหม
 * @param since นับเฉพาะการกด/พิมพ์หลังเวลานี้ (เช่น ตอนฟอร์มพร้อม) — กดปุ่มเปิดฟอร์มไม่นับว่าเป็นการกรอก
 */
export const userActedWithin = (ms = 1500, since = 0) => lastUserInputAt > since && Date.now() - lastUserInputAt < ms;

const diffKeys = (a = {}, b = {}) => [...new Set([...Object.keys(a), ...Object.keys(b)])]
  .filter((k) => JSON.stringify(a[k] ?? "") !== JSON.stringify(b[k] ?? ""));
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));

export function domFormDraft(root, key, { bannerHost } = {}) {
  let pending = null;   // ร่างที่จะกู้คืน: { at, data: เฉพาะช่องที่ต่าง, base }
  let baseline = null;  // ค่าตั้งต้นของฟอร์ม (หลังเตรียมตัวเสร็จ / base ของร่างที่กู้คืน)
  let timer = null;
  let active = true;
  let started = false;
  let startedAt = 0;

  const persist = () => {
    if (!active || !started || !root.isConnected || !baseline) return;
    const now = collect(root);
    const changed = diffKeys(now, baseline);
    if (!changed.length) { clearDraft(key); return; } // แก้แล้วแก้กลับ = ไม่มีอะไรค้าง
    saveDraft(key, { v: 2, data: pick(now, changed), base: pick(baseline, changed) });
  };
  const onEdit = (e) => {
    if (!active || !started) return;
    // โค้ดเปลี่ยนค่าเอง (ไม่มีการกด/พิมพ์จริงไม่นาน) → ถือเป็นค่าตั้งต้นใหม่ ไม่ใช่สิ่งที่ผู้ใช้กรอก
    if (!e.isTrusted && !userActedWithin(1500, startedAt)) {
      const now = collect(root);
      const changedByUser = pending ? Object.keys(pending.data) : [];
      baseline = { ...now, ...pick(baseline, changedByUser) };
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(persist, 400);
  };

  return {
    /** อ่านร่างที่ค้างไว้ แล้วเติมเฉพาะช่องที่ผู้ใช้เคยแก้ (เรียกก่อน TomSelect/ปฏิทินพ.ศ. mount) */
    restore() {
      const d = loadDraft(key);
      const v2 = d?.data?.v === 2 ? d.data : null;
      if (!v2 || !Object.keys(v2.data || {}).length) { if (d) clearDraft(key); return false; }
      pending = { at: d.at, data: v2.data, base: v2.base };
      apply(root, pending.data);
      return true;
    },
    /** เริ่มติดตามการแก้ + แสดงแถบกู้คืน (เรียกหลังฟอร์มเตรียมตัวเสร็จ) */
    start() {
      let now = collect(root);
      if (pending) {
        // ช่องที่ไม่มีอยู่ในฟอร์มแล้ว (เปลี่ยนรุ่นฟอร์ม/ช่องอัตโนมัติ) ไม่นับ
        pending.data = pick(pending.data, Object.keys(pending.data).filter((k) => k in now));
        const keys = Object.keys(pending.data);
        // ค่าตั้งต้นจริง = ค่าของฟอร์มตอนนี้ โดยช่องที่กู้คืนใช้ค่าเดิมก่อนแก้ (จากร่าง)
        baseline = { ...now, ...pick(pending.base || {}, keys) };
        // ⚠️ ฟอร์มบางอันเติมค่าจากข้อมูลงานทีหลัง (ทับค่าที่กู้คืนไว้ตอนต้น) → เติมซ้ำเฉพาะช่องที่ถูกทับ
        const overwritten = keys.filter((k) => JSON.stringify(now[k] ?? "") !== JSON.stringify(pending.data[k] ?? ""));
        if (overwritten.length) { apply(root, pick(pending.data, overwritten)); now = collect(root); }
        // ช่องที่กู้คืนแล้วกลับเท่าค่าตั้งต้น (ข้อมูลงานถูกแก้ไปตรงกันแล้ว) → ไม่ต้องกู้/ไม่ต้องมีแถบ
        if (!diffKeys(pick(now, Object.keys(pending.data)), pick(baseline, Object.keys(pending.data))).length) {
          clearDraft(key);
          pending = null;
        }
      } else {
        baseline = now;
      }
      if (pending) {
        // ส่ง change ให้ตัวเลือกที่ซ่อน/แสดงส่วนอื่นของฟอร์ม (radio/checkbox) — ไม่ยิงช่องเลือกบริษัท ไม่งั้นตัวเติมอัตโนมัติจะทับ
        apply(root, pending.data, { fire: true, togglesOnly: true });
        const host = (bannerHost && root.querySelector(bannerHost)) || root;
        const bar = document.createElement("div");
        bar.setAttribute("data-no-draft", "");
        bar.style.cssText = "display:flex;align-items:center;gap:10px;margin:0 0 14px;padding:9px 12px;border-radius:10px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;font-size:13px;font-weight:600;text-align:left;";
        const n = Object.keys(pending.data).length;
        bar.innerHTML = `<span style="flex:1">↺ กู้คืนข้อมูลที่กรอกค้างไว้ ${n} ช่อง (${draftAgoText(pending.at)})</span><button type="button" style="border:0;background:#fff;color:#1d4ed8;font-weight:800;font-size:12px;padding:5px 10px;border-radius:8px;cursor:pointer;border:1px solid #bfdbfe;font-family:inherit">ล้างทิ้ง</button>`;
        bar.querySelector("button").addEventListener("click", () => {
          const keys = Object.keys(pending?.data || {});
          clearDraft(key);
          pending = null;
          apply(root, pick(baseline, keys), { fire: true });
          bar.remove();
        });
        host.prepend(bar);
      }
      started = true;
      startedAt = Date.now();
      root.addEventListener("input", onEdit, true);
      root.addEventListener("change", onEdit, true);
    },
    clear() { active = false; clearTimeout(timer); clearDraft(key); },
    /** ฟอร์มกำลังปิด (ไม่ได้บันทึก) — เก็บค่าล่าสุดทันที (ถ้ามีช่องที่แก้จริง) */
    stop() {
      if (!active) return;
      clearTimeout(timer);
      try { persist(); } catch { /* ข้าม */ }
      active = false;
    },
  };
}
