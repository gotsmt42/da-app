/**
 * sheetPicker.js — หน้าต่างเลือกรายการแบบใหม่ (แทน dropdown ของ TomSelect) ใช้ในฟอร์ม SweetAlert
 *
 * ✅ (12 พ.ย. 2569 ผู้ใช้: "ทำรูปแบบ select ให้เป็นแบบใหม่เหมือนกันทั้งหมด" — ต่อจากหน้าต่างเลือกสัญญา)
 *    แตะช่องเลือก = หน้าต่างเด้งขึ้น (มือถือ = แผ่นจากล่าง · คอม = กล่องกลาง) · ช่องค้นหาบนสุด · รายการแถวใหญ่กดง่าย
 *    ช่องที่พิมพ์ค่าใหม่ได้ (create) มีแถว "+ ใช้ “คำที่พิมพ์”" ให้กด
 * ⚠️ TomSelect ยังเป็นตัวเก็บค่าเหมือนเดิม (ค่า/การบันทึก/event "change" ไม่เปลี่ยน) — แค่เปลี่ยนวิธีเปิดเลือก
 * ⚠️ ใช้กับช่องเลือกค่าเดียวเท่านั้น (ช่องเลือกหลายค่ายังเป็น dropdown เดิม)
 */
import { escapeHtml } from "@/shared/utils/escapeHtml";

const CSS = `
.tt-sheet { position: absolute; inset: 0; z-index: 90; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(15,23,42,.45); animation: tt-sheet-fade .15s ease; }
@keyframes tt-sheet-fade { from { opacity: 0; } to { opacity: 1; } }
.tt-sheet-panel { width: 100%; max-width: 560px; max-height: 100%; display: flex; flex-direction: column; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 50px -12px rgba(15,23,42,.45); text-align: left; }
.tt-sheet-head { display: flex; align-items: center; gap: 10px; padding: 14px 14px 8px; }
.tt-sheet-head > div { flex: 1; min-width: 0; }
.tt-sheet-title { font-size: 18px; font-weight: 800; color: #0f172a; }
.tt-sheet-sub { font-size: 13px; color: #64748b; margin-top: 2px; }
.tt-sheet-x, .tt-sheet-clear { height: 40px; flex-shrink: 0; border: 0; border-radius: 12px; background: #f1f5f9; color: #334155; font: inherit; cursor: pointer; }
.tt-sheet-x { width: 40px; font-size: 18px; }
.tt-sheet-clear { padding: 0 14px; font-size: 13.5px; font-weight: 700; }
.tt-sheet-search { position: relative; margin: 0 14px 10px; }
.tt-sheet-search svg { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
.tt-sheet-search input { width: 100%; box-sizing: border-box; height: 48px; padding: 0 14px 0 42px; border: 1.5px solid #e2e8f0; border-radius: 12px; font: inherit; font-size: 15px; color: #0f172a; background: #f8fafc; }
.tt-sheet-search input:focus { outline: none; border-color: #2563eb; background: #fff; box-shadow: 0 0 0 3px rgba(37,99,235,.12); }
.tt-sheet-list { flex: 1; min-height: 0; overflow-y: auto; padding: 0 14px 14px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; align-content: start; overflow-x: hidden; }
.tt-sheet-item { box-sizing: border-box; max-width: 100%; overflow-wrap: anywhere; }
/* 🔁 (12 พ.ย. 2569 ผู้ใช้: "ดูโล้นๆ ใส่อะไรให้ดูมืออาชีพ สวยงาม") แถวในกลุ่มเดียวมีเส้นคั่น · ไอคอนอักษรนำ · วงเลือกท้ายแถว */
/* 🐛 (12 พ.ย. 2569 ผู้ใช้: "เลื่อนเลือกไม่ได้") กลุ่มรายการ (overflow:hidden) อยู่ใน grid → แถวหดเท่ากล่อง เลยไม่มีอะไรให้เลื่อน
   → รายการเป็นบล็อกธรรมดา กลุ่มสูงตามเนื้อหา กล่องรายการเลื่อนได้จริง */
.tt-sheet-list { display: block !important; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
.tt-sheet-group { flex-shrink: 0; }
.tt-sheet-group { border: 1px solid #e6e9ef; border-radius: 14px; overflow: hidden; background: #fff; }
.tt-sheet-group .tt-sheet-item { border: 0 !important; border-radius: 0 !important; min-height: 56px !important; padding: 8px 14px !important; }
.tt-sheet-group .tt-sheet-item + .tt-sheet-item { border-top: 1px solid #eef2f7 !important; }
.tt-sheet-group .tt-sheet-item:hover { background: #f8fafc !important; }
.tt-sheet-group .tt-sheet-item.is-cur { background: #eff6ff !important; }
.tt-sheet-item.is-cur::after { content: none !important; }
.tt-si-av { width: 36px; height: 36px; flex-shrink: 0; border-radius: 10px; display: grid; place-items: center; font-size: 15px; font-weight: 800; color: #1d4ed8; background: #eff6ff; }
.tt-si-txt { flex: 1; min-width: 0; }
.tt-si-radio { width: 22px; height: 22px; flex-shrink: 0; margin-left: auto; border-radius: 50%; border: 2px solid #cbd5e1; box-sizing: border-box; }
.tt-sheet-item.is-cur .tt-si-radio { border: 0; background: #2563eb url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6 12.5l4 4 8-9' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / 14px no-repeat; }
.tt-sheet-item.is-new { margin-bottom: 10px; border-radius: 14px !important; }
.tt-sheet-item.is-new .tt-si-av { background: #2563eb; color: #fff; }
.tt-sheet-item { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; padding: 9px 14px; border: 1.5px solid #e6e9ef; border-radius: 12px; background: #fff; font: inherit; font-size: 15px; font-weight: 600; color: #0f172a; text-align: left; cursor: pointer; transition: border-color .12s, background .12s; }
.tt-sheet-item:hover { border-color: #93c5fd; background: #f8fbff; }
.tt-sheet-item.is-cur { border-color: #2563eb; background: #eff6ff; color: #1d4ed8; }
.tt-sheet-item.is-cur::after { content: "✓"; margin-left: auto; font-weight: 900; color: #2563eb; }
.tt-sheet-item > * { min-width: 0; }
.tt-sheet-item.is-new { border-style: dashed; border-color: #93c5fd; background: #eff6ff; color: #1d4ed8; }
.tt-sheet-empty { padding: 26px 10px; text-align: center; color: #64748b; font-size: 14px; }
.tt-sheet-grip { display: none; }
@media (max-width: 600px) {
  .tt-sheet-grip { display: block; width: 44px; height: 5px; border-radius: 99px; background: #cbd5e1; margin: 8px auto 0; flex-shrink: 0; }
  .tt-sheet { align-items: flex-end; padding: 0; }
  .tt-sheet-panel { max-width: none; height: 82%; border-radius: 18px 18px 0 0; }
}`;

const ensureCss = () => {
  if (document.getElementById("tt-sheet-css")) return;
  const st = document.createElement("style");
  st.id = "tt-sheet-css";
  st.textContent = CSS;
  document.head.appendChild(st);
};

/**
 * ลากลงเพื่อปิด "เฉพาะหน้าต่างเลือก" (ไม่ปิดฟอร์มด้านหลัง)
 * ✅ (12 พ.ย. 2569 ผู้ใช้: "ให้เลื่อนลงปิดแยกเฉพาะได้ด้วย ไม่ปิดแผ่นแรกทั้งหมด")
 *    ⚠️ ตัวลากปิดกลางของแอป (swipeToClose) ข้ามองค์ประกอบที่มี data-no-swipe — ใส่ไว้ที่ฉากหลังหน้าต่างเลือก
 *    ลากได้จากหัว/ช่องค้นหา หรือจากรายการตอนเลื่อนอยู่บนสุด · เกิน 90px หรือปัดเร็ว = ปิด · ไม่ถึง = เด้งกลับ
 */
export function bindSheetDrag(ov, panel, list, close) {
  ensureCss();
  ov.setAttribute("data-no-swipe", "");
  let st = null;
  panel.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    const inList = list.contains(e.target);
    if (inList && list.scrollTop > 0) return;
    st = { y: t.clientY, t: Date.now(), dy: 0, inList };
  }, { passive: true });
  panel.addEventListener("touchmove", (e) => {
    if (!st) return;
    st.dy = Math.max(0, e.touches[0].clientY - st.y);
    if (st.inList && st.dy > 0 && list.scrollTop > 0) { st = null; return; }
    if (st.dy > 4) { panel.style.transition = "none"; panel.style.transform = `translateY(${st.dy}px)`; if (e.cancelable) e.preventDefault(); }
  }, { passive: false });
  const end = () => {
    if (!st) return;
    const fast = st.dy > 40 && st.dy / Math.max(1, Date.now() - st.t) > 0.6;
    panel.style.transition = "transform .18s ease";
    if (st.dy > 90 || fast) {
      panel.style.transform = "translateY(100%)";
      // คืนตำแหน่งหลังปิด — หน้าต่างที่ซ่อนแล้วเปิดใหม่ (ไม่ได้ลบทิ้ง) ต้องกลับมาอยู่ที่เดิม
      setTimeout(() => { close(); panel.style.transition = ""; panel.style.transform = ""; }, 170);
    } else panel.style.transform = "";
    st = null;
  };
  panel.addEventListener("touchend", end);
  panel.addEventListener("touchcancel", end);
}

/**
 * เรียง A-Z แบบมืออาชีพ: อังกฤษ A→Z ก่อน แล้วไทย ก→ฮ (ICU ภาษาไทย — ข้ามสระหน้า เ แ โ ใ ไ ไปเรียงตามพยัญชนะ)
 * · ตัวเลขเรียงตามค่า (ห้อง 2 ก่อน ห้อง 10) · ไม่สนตัวพิมพ์เล็ก/ใหญ่ · รายการที่ไม่มีตัวอักษร/ตัวเลข (เช่น ".") ไปท้าย
 * (12 พ.ย. 2569 ผู้ใช้: "ใน Select ทุกๆอย่างให้เรียง A-Z ตามลำดับให้มืออาชีพ")
 */
const COLLATOR = new Intl.Collator("th", { numeric: true, sensitivity: "base" });
const hasWord = (t) => /[\p{L}\p{N}]/u.test(t);
const isLatin = (t) => /^[^\p{L}\p{N}]*[A-Za-z0-9]/u.test(t);
export const SORTER = {
  compare: (a, b) => {
    const wa = hasWord(a), wb = hasWord(b);
    if (wa !== wb) return wa ? -1 : 1;
    const la = isLatin(a), lb = isLatin(b);
    if (la !== lb) return la ? -1 : 1;
    return COLLATOR.compare(a, b);
  },
};

const SEARCH_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M10 18a8 8 0 1 1 5.3-14A8 8 0 0 1 10 18Zm0-2a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm7.6.2 4.1 4.1-1.4 1.4-4.1-4.1 1.4-1.4Z"/></svg>';

/**
 * เปิดหน้าต่างเลือก
 * @param {object} o
 * @param {HTMLElement} o.host  กล่องที่วางหน้าต่าง (popup ของ Swal — position relative)
 * @param {string} o.title
 * @param {{value:string, html:string, search:string}[]} o.items
 * @param {string} [o.current]
 * @param {boolean} [o.allowCreate] พิมพ์ค่าใหม่ได้
 * @param {(value:string, isNew:boolean) => void} o.onPick
 * @param {() => void} [o.onClear] มีค่าแล้ว = แสดงปุ่ม "ล้าง"
 */
export function openSheetPicker({ host, title, items, current = "", allowCreate = false, onPick, onClear }) {
  if (!host || host.querySelector(".tt-sheet")) return;
  ensureCss();
  const ov = document.createElement("div");
  ov.className = "tt-sheet";
  ov.innerHTML = `
    <div class="tt-sheet-panel" role="dialog" aria-label="${escapeHtml(title)}">
      <div class="tt-sheet-grip" aria-hidden="true"></div>
      <div class="tt-sheet-head">
        <div><div class="tt-sheet-title">${escapeHtml(title)}</div><div class="tt-sheet-sub">${items.length} รายการ${allowCreate ? " · พิมพ์ชื่อใหม่ได้" : ""}</div></div>
        ${current && onClear ? '<button type="button" class="tt-sheet-clear">ล้าง</button>' : ""}
        <button type="button" class="tt-sheet-x" aria-label="ปิด">✕</button>
      </div>
      <div class="tt-sheet-search">${SEARCH_ICON}<input type="search" placeholder="ค้นหา${allowCreate ? " หรือพิมพ์ชื่อใหม่" : ""}" autocomplete="off"></div>
      <div class="tt-sheet-list"></div>
    </div>`;
  const list = ov.querySelector(".tt-sheet-list");
  const input = ov.querySelector("input");
  const draw = () => {
    const q = input.value.trim();
    const ql = q.toLowerCase();
    const rows = items.filter((it) => !ql || ql.split(/\s+/).every((w) => it.search.includes(w)));
    const exact = items.some((it) => it.value.toLowerCase() === ql);
    list.innerHTML = (allowCreate && q && !exact
      ? `<button type="button" class="tt-sheet-item is-new" data-new="1" data-v="${escapeHtml(q)}"><span class="tt-si-av" aria-hidden="true">+</span><span class="tt-si-txt">ใช้ “${escapeHtml(q)}” (ชื่อใหม่)</span></button>` : "")
      + (rows.length
        ? `<div class="tt-sheet-group">${rows.map((it) => `<button type="button" class="tt-sheet-item${it.value === current ? " is-cur" : ""}" data-v="${escapeHtml(it.value)}">${it.html}<span class="tt-si-radio" aria-hidden="true"></span></button>`).join("")}</div>`
        : (allowCreate && q ? "" : `<div class="tt-sheet-empty">ไม่พบรายการ${q ? ` “${escapeHtml(q)}”` : ""}</div>`));
  };
  draw();
  const close = () => ov.remove();
  input.addEventListener("input", draw);
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  ov.querySelector(".tt-sheet-x").addEventListener("click", close);
  bindSheetDrag(ov, ov.querySelector(".tt-sheet-panel"), list, close);
  ov.querySelector(".tt-sheet-clear")?.addEventListener("click", () => { onClear?.(); close(); });
  list.addEventListener("click", (e) => {
    const b = e.target.closest(".tt-sheet-item");
    if (!b) return;
    close();
    onPick(b.dataset.v, b.dataset.new === "1");
  });
  host.appendChild(ov);
  // คอม: โฟกัสช่องค้นหาเลย · มือถือ: ไม่เด้งคีย์บอร์ดทันที (จะบังรายการ)
  if (window.matchMedia("(min-width: 601px)").matches) setTimeout(() => input.focus(), 50);
}

/**
 * ผูกหน้าต่างเลือกเข้ากับ TomSelect (ค่าเดียว) — แตะช่องแล้วเปิดหน้าต่างแทน dropdown
 * @param {object} ts TomSelect instance
 * @param {object} [o]
 * @param {string} [o.title] ไม่ส่ง = อ่านจากป้ายชื่อของช่อง
 * @param {() => HTMLElement} o.host
 */
export function attachSheetPicker(ts, { title, host } = {}) {
  if (!ts || ts.settings?.mode === "multi" || ts.input?.multiple || ts.__sheet) return;
  ts.__sheet = true;
  const label = title || (ts.input.closest(".ae-field, .ee-field")?.querySelector("label")?.textContent || "เลือก").replace(/[*✱]/g, "").trim();
  const open = () => {
    if (ts.isDisabled || ts.isLocked) return;
    ts.close();
    const esc = (v) => escapeHtml(String(v ?? ""));
    const renderOpt = ts.settings.render?.option;
    const items = Object.values(ts.options)
      .filter((o) => o[ts.settings.valueField] !== "" && o[ts.settings.valueField] != null)
      .map((o) => {
        const value = String(o[ts.settings.valueField]);
        const text = String(o[ts.settings.labelField] ?? value);
        const initial = esc((text.trim().replace(/^[^\p{L}\p{N}]+/u, "").replace(/^[เแโใไ]/, "") || text).slice(0, 1).toUpperCase());
        let html = `<span class="tt-si-av" aria-hidden="true">${initial || "•"}</span><span class="tt-si-txt">${esc(text)}</span>`;
        try { if (renderOpt) { const r = renderOpt.call(ts, o, esc); if (r) html = `<span class="tt-si-txt">${r}</span>`; } } catch { /* ใช้ข้อความล้วน */ }
        return { value, html, label: text.trim(), search: `${value} ${text}`.toLowerCase() };
      })
      .sort((a, b) => SORTER.compare(a.label, b.label));
    const current = String(ts.getValue() || "");
    openSheetPicker({
      host: host?.() || ts.wrapper.closest(".swal2-popup") || document.body,
      title: label,
      items,
      current,
      allowCreate: Boolean(ts.settings.create),
      onPick: (v, isNew) => {
        if (isNew && !ts.options[v]) ts.addOption({ [ts.settings.valueField]: v, [ts.settings.labelField]: v });
        ts.setValue(v);
      },
      onClear: () => ts.clear(),
    });
  };
  // ⚠️ ดักก่อน TomSelect (capture) — ไม่ให้ dropdown เปิด/ไม่โฟกัสช่องพิมพ์ (คีย์บอร์ดมือถือไม่เด้ง)
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
  ts.wrapper.addEventListener("pointerdown", stop, true);
  ts.wrapper.addEventListener("mousedown", stop, true);
  ts.wrapper.addEventListener("click", (e) => { stop(e); open(); }, true);
  ts.on("dropdown_open", () => { ts.close(); });
}
