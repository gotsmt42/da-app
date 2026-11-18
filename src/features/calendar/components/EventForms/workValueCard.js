/**
 * workValueCard.js — การ์ด "มูลค่างานครั้งนี้" ในฟอร์มแก้ไขงาน (EditEvent · SweetAlert2 HTML)
 *
 * ✅ (10 พ.ย. 2569 ผู้ใช้: "มูลค่างานครั้งนี้ ให้ใส่อัตโนมัติได้เลย · งานสัญญาให้แบ่งตามรอบ · งานที่ไม่มีมูลค่า
 *    ให้ AI ช่วยอ่านไฟล์ · เลือกได้ว่ายอดบวก VAT หรือยอด Net · ให้สอดคล้องกันทั้งหมด")
 *    • ยังไม่เคยใส่ + มีข้อมูลพอ (มูลค่าสัญญา ÷ ครั้ง / มูลค่างานรวม / ใบเสนอราคาที่ได้งาน) → เติมให้เลย บอกที่มา
 *      (บันทึกพร้อมการกด "บันทึก" ของฟอร์ม — ไม่ได้บันทึกเองเงียบๆ)
 *    • เลือก "ก่อน VAT (Net)" / "รวม VAT 7%" · ใต้ช่องแสดงอีกฝั่งของยอดให้ทันที
 *    • ปุ่ม AI อ่านไฟล์ของงาน → เลือกใช้ยอด Net หรือยอดรวม VAT ได้ในคลิกเดียว
 *    🔁 (10 พ.ย. 2569) งานสัญญา: ไม่มีตัวเลือก VAT · ไม่มีปุ่ม AI — ใช้การระบุ VAT ของมูลค่าสัญญา (หน้าภาพรวมงาน)
 *    สูตร/ค่าแนะนำอยู่ที่ shared/utils/workValue.js ที่เดียว (ใช้ร่วมกับหน้างานช่าง · หน้าการดำเนินงาน · วางบิล)
 */
import { suggestWorkValue, vatParts, hasWorkValue, contractVatInfo, workersOfRows, personValueOf } from "@/shared/utils/workValue";
import { baht } from "@/shared/utils/billing";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => Number(n).toLocaleString("th-TH", { maximumFractionDigits: 2 });
const fmt2 = (n) => Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parse = (v) => {
  const t = String(v ?? "").replace(/[,\s฿]/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

export const WORK_VALUE_CSS = `
  .ee-vat-seg { display: inline-flex; gap: 0; margin-top: 10px; padding: 3px; border-radius: 10px; background: #f1f5f9; border: 1px solid #e2e8f0; }
  .ee-vat-seg label { position: relative; cursor: pointer; margin: 0; }
  .ee-vat-seg input { position: absolute; opacity: 0; pointer-events: none; }
  .ee-vat-seg span { display: inline-flex; align-items: center; height: 30px; padding: 0 12px; border-radius: 8px; font-size: 12.5px; font-weight: 600; color: #64748b; transition: background .15s, color .15s; white-space: nowrap; }
  .ee-vat-seg input:checked + span { background: #fff; color: #1d4ed8; font-weight: 700; box-shadow: 0 1px 2px rgba(15,23,42,.12); }
  .ee-vat-seg input:focus-visible + span { outline: 2px solid #93c5fd; }
  .ee-vat-seg input:disabled + span { cursor: default; }
  .ee-wv-break { margin-top: 6px; font-size: 12px; color: #64748b; min-height: 16px; font-variant-numeric: tabular-nums; }
  .ee-wv-break b { color: #334155; font-weight: 600; }
  .ee-wv-auto { margin-top: 8px; display: flex; gap: 6px; align-items: center; padding: 7px 10px; border-radius: 9px; background: #eff6ff; border: 1px solid #dbeafe; color: #1e40af; font-size: 12px; line-height: 1.45; }
  .ee-wv-use { flex-shrink: 0; border: 1px solid #93c5fd; background: #fff; color: #1d4ed8; font: inherit; font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 8px; cursor: pointer; }
  .ee-wv-use:hover { background: #2563eb; color: #fff; border-color: #2563eb; }
  .ee-wv-ai { margin-top: 10px; }
  .ee-wv-ai-btn { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 9px; border: 1px solid #e2e8f0; background: #fff; color: #2563eb; font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; }
  .ee-wv-ai-btn:hover { background: #eff6ff; border-color: #bfdbfe; }
  .ee-wv-ai-btn:disabled { opacity: .6; cursor: default; }
  .ee-wv-ai-res { margin-top: 8px; padding: 9px 11px; border-radius: 10px; border: 1px solid #e0e7ff; background: #f8faff; font-size: 12.5px; color: #334155; line-height: 1.5; }
  .ee-wv-ai-res .ee-wv-ai-src { color: #64748b; font-size: 11.5px; }
  .ee-wv-ai-res .ee-wv-ai-note { margin-top: 4px; color: #92400e; font-size: 11.5px; }
  .ee-wv-ai-use { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
  .ee-wv-ai-use button { flex: 1 1 140px; min-height: 34px; padding: 4px 10px; border-radius: 9px; border: 1px solid #bfdbfe; background: #fff; color: #1d4ed8; font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; line-height: 1.25; }
  .ee-wv-ai-use button:hover { background: #eff6ff; }
  .ee-wv-ai-use button small { display: block; font-weight: 500; color: #64748b; font-size: 11px; }
  .ee-wv-ct { margin-top: 10px; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; }
  .ee-wv-ct-main { flex: 1; min-width: 0; }
  .ee-wv-ct-top { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .ee-wv-ct-tag { font-size: 11px; font-weight: 700; color: #1d4ed8; background: #eff6ff; border-radius: 999px; padding: 2px 8px; }
  .ee-wv-ct-auto { font-size: 11px; font-weight: 600; color: #64748b; }
  .ee-wv-ct-line { margin-top: 4px; font-size: 12.5px; color: #334155; font-variant-numeric: tabular-nums; line-height: 1.4; }
  .ee-wv-ct-vat { margin-top: 1px; font-size: 12px; color: #64748b; line-height: 1.4; }
  .ee-wv-ct-vat.warn { color: #b45309; }
  .ee-wv-ct-link { flex-shrink: 0; height: 32px; padding: 0 12px; border-radius: 9px; border: 1px solid #bfdbfe; background: #fff; color: #2563eb; font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; white-space: nowrap; }
  .ee-wv-ct-link:hover { background: #eff6ff; }
  .ee-wv-people-head { display: flex; align-items: baseline; gap: 8px; margin-top: 16px; padding-top: 14px; border-top: 1px solid #eef2f7; }
  .ee-wv-people-head b { font-size: 14px; font-weight: 800; color: #0f172a; }
  .ee-wv-people-head span { margin-left: auto; font-size: 12px; color: #94a3b8; font-variant-numeric: tabular-nums; }
  .ee-wv-people { margin-top: 8px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; padding: 2px 12px; }
  .ee-wv-person { display: flex; align-items: center; gap: 10px; min-height: 42px; padding: 6px 0; }
  .ee-wv-person + .ee-wv-person { border-top: 1px solid #eef2f7; }
  .ee-wv-person-name { flex: 1; min-width: 0; font-size: 14px; font-weight: 600; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ee-wv-person-name small { font-size: 11.5px; font-weight: 500; color: #94a3b8; margin-left: 4px; }
  .ee-wv-person-val { flex-shrink: 0; font-size: 14px; font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; }
  .ee-wv-person-val small { font-size: 11.5px; font-weight: 500; color: #94a3b8; }
  .ee-wv-person-empty { flex-shrink: 0; font-size: 13px; font-weight: 600; color: #94a3b8; }
  .ee-wv-note { margin-top: 8px; font-size: 11.5px; color: #94a3b8; line-height: 1.5; }
  .ee-wv-spin { width: 13px; height: 13px; border-radius: 50%; border: 2px solid #c7d2fe; border-top-color: #4338ca; animation: ee-boot-spin .8s linear infinite; }
`;

/**
 * ค่าเริ่มต้นของการ์ด
 * @param {object} p extendedProps ของงาน
 */
export function workValueInitial(p = {}) {
  const saved = hasWorkValue(p.workValue);
  const savedVat = Boolean(p.workValueVatIncluded);
  const suggest = saved ? null : suggestWorkValue(p);
  const contract = contractVatInfo(p);
  /**
   * 🔁 (18 พ.ย. 2569 ผู้ใช้: "ทำไมยอดเยอะขนาดนี้" → "ทำเลยอันไหนที่ทำให้มีประสิทธิภาพและเช็คข้อมูลได้ง่าย")
   *    เดิมเติมค่าแนะนำลงช่องให้เลย แล้วถูกบันทึกไปด้วยทุกครั้งที่กดบันทึกฟอร์ม (แม้แก้เรื่องอื่น) —
   *    งานทั่วไปค่าแนะนำ = มูลค่างานรวมทั้งงาน → มูลค่าครั้งนี้กลายเป็นยอดทั้งโครงการโดยไม่ตั้งใจ
   *    ตอนนี้: ช่องว่างไว้ · แสดงค่าแนะนำพร้อมปุ่ม "ใช้ค่านี้" ต้องกดเองถึงจะใส่ (ไม่กด = ไม่บันทึก)
   */
  return {
    saved, savedVat, contract,
    savedValue: saved ? Number(p.workValue) : null,
    suggest,
    amount: saved ? Number(p.workValue) : null,
    // งานสัญญา = VAT ตามมูลค่าสัญญาเสมอ (ทั้งค่าที่บันทึกแล้วและค่าใหม่)
    vat: contract ? contract.vatIncluded : savedVat,
    source: saved ? (p.workValueSource || "") : "",
  };
}

/**
 * 🔁 (17 พ.ย. 2569 ผู้ใช้: "มูลค่าครั้งนี้คือให้ช่างทุกคนลง · มูลค่ารวมของงานแยกต่างหากโดยผู้รับผิดชอบงานจัดการ")
 *    ฟอร์มแก้ไขงานไม่ให้แก้ "มูลค่าครั้งนี้" ตรงแล้ว (ช่องเดียว = ช่างแต่ละคนลงที่การ์ดงาน) — แสดงรายคน (อ่านอย่างเดียว · ไม่รวมกัน)
 *    มูลค่างานรวม (ทั้งงาน/สัญญา) ยังแก้ได้ที่ช่อง "มูลค่างาน" ของฟอร์มตามเดิม
 * @param p extendedProps ของงาน (team · teamMembers · workerValues · workValue)
 */
export function workerValuesSummaryHtml(p = {}) {
  const rows = [p];
  const workers = workersOfRows(rows);
  if (!workers.length) {
    return `<div class="ee-wv-note">${hasWorkValue(p.workValue) ? `ยอดเดิม ${esc(baht(p.workValue))} · ` : ""}ยังไม่มีทีมเข้างาน — เลือกผู้ปฏิบัติงานก่อน แล้วให้ช่างลงผลงานของตัวเอง</div>`;
  }
  // 🔁 (18 พ.ย. 2569 ผู้ใช้: "ตรงนี้จัดวางให้ดูง่าย สวยงามกว่านี้ยังดูไม่ลงตัว") แถวเรียบ ขนาดตัวอักษรคงที่ · ยังไม่ลง = เทาอ่อน (ไม่ใช้ส้มตัวใหญ่)
  const lines = workers.map((n, i) => {
    const v = personValueOf(rows, n);
    return `<div class="ee-wv-person">
      <span class="ee-wv-person-name">${esc(n)}${i === 0 ? ' <small>หัวหน้าทีม</small>' : ""}${v?.legacy ? ' <small>ยอดเดิม</small>' : ""}</span>
      ${v ? `<span class="ee-wv-person-val">${esc(baht(v.amount))} <small>${v.vatIncluded ? "รวม VAT" : "ก่อน VAT"}</small></span>` : '<span class="ee-wv-person-empty">ยังไม่ลง</span>'}
    </div>`;
  }).join("");
  const filled = workers.filter((n) => personValueOf(rows, n)).length;
  // 🔁 (17 พ.ย. 2569 ผู้ใช้: "ยอดที่ลงไม่นำมารวมกัน แยกเป็นผลงานของแต่ละคน") ไม่มีบรรทัดรวมทั้งทีม
  return `<div class="ee-wv-people-head"><b>ผลงานรายคน</b><span>ลงแล้ว ${filled}/${workers.length} คน</span></div>
    <div class="ee-wv-people">${lines}</div>
    <div class="ee-wv-note">ช่างแต่ละคนลงของตัวเองที่การ์ดงาน (แอดมินลงแทนได้) · ไม่รวมกัน ไม่ใช่มูลค่าครั้งนี้ของงาน</div>`;
}

export function workValueCardHtml(init, { disabled = false } = {}) {
  const dis = disabled ? "disabled" : "";
  // ดูอย่างเดียว = แสดงเฉพาะค่าที่บันทึกจริง (ค่าอัตโนมัติยังไม่ถูกบันทึก ห้ามดูเหมือนเป็นค่าจริง)
  const amount = disabled ? init.savedValue : init.amount;
  const vat = disabled && !init.contract ? init.savedVat : init.vat;
  const ct = init.contract;
  const inputHtml = `
    <div class="ee-value-box">
      <input id="editWorkValue" type="text" aria-label="มูลค่าครั้งนี้" inputmode="decimal" autocomplete="off" placeholder="ยังไม่ระบุ — แตะเพื่อใส่ยอด"
        value="${amount === null ? "" : fmt(amount)}" ${dis}>
      <span class="ee-value-unit">บาท</span>
    </div>`;
  // 🔁 (10 พ.ย. 2569 ผู้ใช้: "ให้กระชับเข้าใจง่าย · ตรงมูลค่างานสัญญาให้กดลิงก์ไปดูงานนั้นที่หน้าภาพรวมได้")
  //    งานสัญญา = แถบเดียว: ป้ายงานสัญญา · ที่มาของยอด · VAT ตามสัญญา · ปุ่ม "ดูสัญญา"
  if (ct) {
    const line = init.suggest && !disabled
      ? init.suggest.hint
      : ct.hasValue ? `มูลค่าสัญญา ${baht(ct.jobValue)}` : ct.text;
    return `${inputHtml}
    <div id="ee-wv-break" class="ee-wv-break" aria-live="polite"></div>
    <div id="ee-wv-contract" class="ee-wv-ct" data-no-draft>
      <div class="ee-wv-ct-main">
        <div class="ee-wv-ct-top"><span class="ee-wv-ct-tag">งานสัญญา</span>${init.suggest && !disabled && !init.saved ? `<button type="button" id="ee-wv-use" class="ee-wv-use" data-no-draft>ใช้ ${esc(baht(init.suggest.amount))}</button>` : ""}</div>
        <div class="ee-wv-ct-line">${esc(line)}</div>
        ${ct.hasValue ? `<div class="ee-wv-ct-vat${ct.set ? "" : " warn"}">${esc(ct.set ? `VAT ตามสัญญา · ${ct.vatText}` : ct.vatText)}</div>` : ""}
      </div>
      <button type="button" class="ee-wv-ct-link" data-open-contract hidden>ดูสัญญา ›</button>
    </div>`;
  }
  const vatHtml = `<div class="ee-vat-seg" role="radiogroup" aria-label="ยอดนี้คือ">
      <label><input type="radio" name="editWorkValueVat" value="0" ${vat ? "" : "checked"} ${dis}><span>ก่อน VAT (Net)</span></label>
      <label><input type="radio" name="editWorkValueVat" value="1" ${vat ? "checked" : ""} ${dis}><span>รวม VAT 7%</span></label>
    </div>`;
  return `
    <div class="ee-value-box">
      <input id="editWorkValue" type="text" aria-label="มูลค่าครั้งนี้" inputmode="decimal" autocomplete="off" placeholder="ยังไม่ระบุ — แตะเพื่อใส่ยอด"
        value="${amount === null ? "" : fmt(amount)}" ${dis}>
      <span class="ee-value-unit">บาท</span>
    </div>
    ${vatHtml}
    <div id="ee-wv-break" class="ee-wv-break" aria-live="polite"></div>
    ${init.suggest && !disabled && !init.saved ? `<div id="ee-wv-auto" class="ee-wv-auto" data-no-draft><span aria-hidden="true">✦</span><span style="flex:1">ค่าแนะนำ <b>${esc(baht(init.suggest.amount))}</b> จาก${esc(init.suggest.hint)}${init.suggest.source === "job" ? " — ใช้เมื่องานนี้เข้าครั้งเดียว (ยอดทั้งงาน)" : ""}${init.suggest.vatIncluded === null && !ct ? " · เลือกให้ตรงว่าเป็นยอดก่อนหรือรวม VAT" : ""}</span><button type="button" id="ee-wv-use" class="ee-wv-use">ใช้ค่านี้</button></div>` : ""}
    <div id="ee-wv-ai" class="ee-wv-ai" data-no-draft></div>`;
}

/**
 * ผูกการทำงาน (หลังเปิดฟอร์ม)
 * @returns {{ read: () => object }} read() = ฟิลด์ที่ต้องส่งไปบันทึก (ส่งเฉพาะที่เปลี่ยน · ตัวเลขผิด = ไม่ส่ง)
 */
export function bindWorkValueCard(root, { init, eventId, EventService, allowAi = true, onOpenContract = null }) {
  const inp = root.querySelector("#editWorkValue");
  if (!inp) return { read: () => ({}) };
  const ctLink = root.querySelector("[data-open-contract]");
  if (ctLink && typeof onOpenContract === "function") {
    ctLink.hidden = false;
    ctLink.addEventListener("click", () => onOpenContract());
  }
  let source = init.source || "";
  const radios = [...root.querySelectorAll('input[name="editWorkValueVat"]')];
  const vatOn = init.contract
    ? () => init.contract.vatIncluded
    : () => root.querySelector('input[name="editWorkValueVat"]:checked')?.value === "1";
  const breakEl = root.querySelector("#ee-wv-break");

  const render = () => {
    const n = parse(inp.value);
    if (!breakEl) return;
    if (!(n > 0)) { breakEl.innerHTML = Number.isNaN(n) ? `<span style="color:#dc2626">ใส่เป็นตัวเลข 0 ขึ้นไป</span>` : ""; return; }
    const p = vatParts(n, vatOn());
    breakEl.innerHTML = vatOn()
      ? `ก่อน VAT <b>฿${fmt2(p.net)}</b> · VAT 7% ฿${fmt2(p.vat)}`
      : `VAT 7% ฿${fmt2(p.vat)} · รวม VAT <b>฿${fmt2(p.gross)}</b>`;
  };
  const markManual = (e) => {
    if (!e.isTrusted) return;
    source = "manual";
    root.querySelector("#ee-wv-auto")?.remove();
  };
  inp.addEventListener("input", (e) => { markManual(e); render(); });
  inp.addEventListener("blur", () => { const n = parse(inp.value); if (n > 0) inp.value = fmt(n); });
  radios.forEach((r) => r.addEventListener("change", render));
  render();

  const setValue = (amount, vat, src) => {
    inp.value = fmt(amount);
    const r = radios.find((x) => x.value === (vat ? "1" : "0"));
    if (r && !r.checked) { r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); }
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    inp.dispatchEvent(new Event("change", { bubbles: true }));
    source = src;
    root.querySelector("#ee-wv-auto")?.remove();
    render();
  };

  // ✅ (18 พ.ย. 2569) "ใช้ค่านี้" — ใส่ค่าแนะนำเมื่อคนกดเองเท่านั้น
  const useBtn = root.querySelector("#ee-wv-use");
  if (useBtn && init.suggest) {
    useBtn.addEventListener("click", () => {
      const sg = init.suggest;
      setValue(sg.amount, init.contract ? init.contract.vatIncluded : sg.vatIncluded !== null ? sg.vatIncluded : vatOn(), sg.source);
      useBtn.remove();
    });
  }

  // ── AI อ่านยอดจากไฟล์ (เปิดใช้เฉพาะเมื่อเซิร์ฟเวอร์มีคีย์) ──
  const host = root.querySelector("#ee-wv-ai");
  if (host && allowAi && !init.contract && !inp.disabled && EventService?.ScanWorkValue) {
    const KIND = { po: "PO", quotation: "ใบเสนอราคา", invoice: "ใบวางบิล", contract: "สัญญา", other: "เอกสาร" };
    const idle = (label = "✦ ให้ AI อ่านยอดจากไฟล์ของงาน") => {
      host.innerHTML = `<button type="button" class="ee-wv-ai-btn">${label}</button>`;
      host.querySelector("button").addEventListener("click", run);
    };
    const run = async () => {
      host.innerHTML = `<button type="button" class="ee-wv-ai-btn" disabled><span class="ee-wv-spin"></span>AI กำลังอ่านไฟล์ของงานนี้…</button>`;
      try {
        const r = await EventService.ScanWorkValue(eventId);
        if (!host.isConnected) return;
        if (!r?.found) {
          idle("✦ ให้ AI อ่านใหม่");
          host.insertAdjacentHTML("beforeend", `<div class="ee-wv-ai-res">AI ยังหายอดที่ชัดเจนไม่เจอ${r?.fileCount ? ` (อ่าน ${r.fileCount} ไฟล์)` : ""} — กรอกยอดเองได้${r?.note ? `<div class="ee-wv-ai-note">⚠ ${esc(r.note)}</div>` : ""}</div>`);
          return;
        }
        const src = [KIND[r.docType] || r.fileKind || "เอกสาร", r.docNo].filter(Boolean).join(" ");
        host.innerHTML = `
          <div class="ee-wv-ai-res">
            <div><b>✦ AI อ่านได้</b> · ก่อน VAT ฿${fmt2(r.amountBeforeVat)} · รวม VAT ฿${fmt2(r.grandTotal)}</div>
            <div class="ee-wv-ai-src">จาก ${esc(src)}${r.fileName ? ` · ${esc(r.fileName)}` : ""} · อ่าน ${r.fileCount} ไฟล์</div>
            ${r.note ? `<div class="ee-wv-ai-note">⚠ ${esc(r.note)}</div>` : ""}
            <div class="ee-wv-ai-use">
              <button type="button" data-v="0">ใช้ยอด Net ฿${fmt(r.amountBeforeVat)}<small>ก่อน VAT</small></button>
              <button type="button" data-v="1">ใช้ยอดรวม VAT ฿${fmt(r.grandTotal)}<small>รวม VAT แล้ว</small></button>
            </div>
          </div>`;
        host.querySelectorAll("[data-v]").forEach((b) => b.addEventListener("click", () => {
          const vat = b.dataset.v === "1";
          setValue(vat ? r.grandTotal : r.amountBeforeVat, vat, "ai");
          idle("✦ ให้ AI อ่านใหม่");
          host.insertAdjacentHTML("beforeend", `<div class="ee-wv-ai-res">ใส่ยอด${vat ? "รวม VAT" : " Net"} จาก ${esc(src)} แล้ว — กด “บันทึก” ด้านล่างเพื่อยืนยัน</div>`);
        }));
      } catch (err) {
        if (!host.isConnected) return;
        idle("✦ ลองให้ AI อ่านอีกครั้ง");
        host.insertAdjacentHTML("beforeend", `<div class="ee-wv-ai-res"><div class="ee-wv-ai-note">⚠ ${esc(err?.response?.data?.message || "AI อ่านไฟล์ไม่สำเร็จ")}</div></div>`);
      }
    };
    EventService.BillingScanAvailability?.()
      .then((a) => { if (a?.enabled && host.isConnected) idle(); })
      .catch(() => {});
  }

  return {
    read() {
      if (inp.disabled) return {};
      const n = parse(inp.value);
      if (Number.isNaN(n)) return {};
      const vat = vatOn();
      const out = {};
      if (n !== init.savedValue) out.workValue = n;
      if (n !== null && (vat !== init.savedVat || out.workValue !== undefined)) out.workValueVatIncluded = vat;
      if (out.workValue !== undefined) out.workValueSource = n === null ? "" : (source || "manual");
      return out;
    },
  };
}
