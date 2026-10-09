/**
 * jobInfoSection — การ์ด "ข้อมูล Job" ในฟอร์มลงงาน/แก้ไขงาน (ฟอร์มแบบ Swal HTML)
 *
 * ✅ (9 ต.ค. 2569) ขั้นตอนทำงานมาตรฐาน ขั้น 1–3: ความเร่งด่วน · วันครบกำหนด · อุปกรณ์ที่ต้องเตรียม · รอข้อมูล
 *    ทุกช่องไม่บังคับ (ค่าเริ่มต้น = ปกติ / ไม่มีกำหนด / ข้อมูลครบ) — กรอกน้อยที่สุด แก้ทีหลังได้
 *    เลข Job ระบบออกให้เองตอนบันทึก (ไม่ต้องกรอก)
 * ⚠️ ช่องวันที่เป็น <input type="date"> — mountThaiDatePickers ของฟอร์มเปลี่ยนเป็นปฏิทิน พ.ศ. ให้เอง
 */
import { jobInfoPayload } from "@/shared/utils/jobFlow";

const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const CSS = `
<style>
  .ji-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
  @media (max-width: 600px) { .ji-grid { grid-template-columns: 1fr; } }
  .ji-prio { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .ji-prio input { position: absolute; opacity: 0; pointer-events: none; }
  .ji-prio label {
    display: flex; align-items: center; justify-content: center; gap: 6px; height: 40px; border-radius: 10px;
    border: 1.5px solid #e2e8f0; background: #fff; font-size: 13.5px; font-weight: 700; color: #334155; cursor: pointer;
    transition: all .12s; margin: 0 !important;
  }
  .ji-prio input:checked + label { border-color: #2563eb; background: #eff6ff; color: #1d4ed8; }
  .ji-prio input[value="urgent"]:checked + label { border-color: #dc2626; background: #fef2f2; color: #b91c1c; }
  .ji-pending { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: #374151; cursor: pointer; margin: 0; }
  .ji-pending input { width: auto !important; cursor: pointer; }
  .ji-note { margin-top: 8px; }
  .ji-jobno { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #64748b; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 999px; padding: 3px 10px; font-weight: 700; }
</style>`;

/**
 * @param {object} v ค่าเดิม (ฟอร์มแก้ไข) — { jobNo, priority, dueDate, equipment, infoPending, infoPendingNote }
 */
export function jobInfoSectionHtml(v = {}, cls = "ae", disabled = false) {
  const dis = disabled ? "disabled" : "";
  const due = v.dueDate ? new Date(v.dueDate) : null;
  const dueStr = due && !Number.isNaN(due.getTime())
    ? `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}` : "";
  const urgent = v.priority === "urgent";
  const fields = `
        <div class="ji-grid">
          <div class="${cls}-field">
            <label>ความเร่งด่วน</label>
            <div class="ji-prio">
              <input type="radio" name="ji-priority" id="ji-prio-normal" value="normal" ${dis} ${urgent ? "" : "checked"}><label for="ji-prio-normal">ปกติ</label>
              <input type="radio" name="ji-priority" id="ji-prio-urgent" value="urgent" ${dis} ${urgent ? "checked" : ""}><label for="ji-prio-urgent">⚡ ด่วน</label>
            </div>
          </div>
          <div class="${cls}-field">
            <label>วันครบกำหนด (งานต้องเสร็จภายใน)</label>
            <input id="ji-dueDate" type="date" ${dis} value="${dueStr}">
          </div>
        </div>
        <div class="${cls}-field" style="margin-bottom:12px;">
          <label>อุปกรณ์ / อะไหล่ที่ต้องเตรียม</label>
          <textarea id="ji-equipment" rows="3" ${dis} placeholder="บรรทัดละรายการ เช่น&#10;บันไดอลูมิเนียม 3 ม.&#10;Smoke detector × 2">${esc(v.equipment)}</textarea>
        </div>
        <label class="ji-pending">
          <input type="checkbox" id="ji-infoPending" ${dis} ${v.infoPending ? "checked" : ""}>
          ⏳ ข้อมูลยังไม่ครบ (รอข้อมูล)
        </label>
        <div class="${cls}-field ji-note" id="ji-noteWrap" style="${v.infoPending ? "" : "display:none;"}">
          <input id="ji-infoPendingNote" type="text" ${dis} placeholder="ยังขาดอะไร เช่น รอเบอร์ผู้ติดต่อ / รอยืนยันวันเข้า" value="${esc(v.infoPendingNote)}">
        </div>
`;
  const sub = v.jobNo ? `<span class="ji-jobno"># ${esc(v.jobNo)}</span>` : "เลข Job ระบบออกให้อัตโนมัติตอนบันทึก";
  // ฟอร์มรับแจ้งงาน (AddDraftEvent) ไม่มีการ์ด — ใช้หัวข้อแบบ section label ของฟอร์มนั้นแทน
  if (cls === "ade") {
    return `${CSS}
    <hr class="ade-divider">
    <p class="ade-section-label">ข้อมูล Job <span style="font-weight:600;color:#94a3b8;text-transform:none;">· ${sub} · ไม่บังคับ</span></p>
    ${fields}`;
  }
  return `${CSS}
    <section class="${cls}-card">
      <div class="${cls}-card-head">
        <span class="${cls}-card-ico" aria-hidden="true">🧾</span>
        <div class="${cls}-card-titles"><h4>ข้อมูล Job</h4><p>${sub}</p></div>
        ${cls === "ae" ? `<span class="ae-card-badge ae-card-badge--muted">ไม่บังคับ</span>` : ""}
      </div>
      <div class="${cls}-card-body">
${fields}      </div>
    </section>`;
}

/** ผูก event ของการ์ด — เรียกใน didOpen */
export function bindJobInfo(root = document) {
  const cb = root.querySelector("#ji-infoPending");
  const wrap = root.querySelector("#ji-noteWrap");
  if (cb && wrap) cb.addEventListener("change", () => { wrap.style.display = cb.checked ? "" : "none"; });
}

/** อ่านค่าในการ์ด → payload ของ server */
export function readJobInfo(root = document) {
  const q = (s) => root.querySelector(s);
  return jobInfoPayload({
    priority: q('input[name="ji-priority"]:checked')?.value,
    dueDate: q("#ji-dueDate")?.value || null,
    equipment: q("#ji-equipment")?.value,
    infoPending: q("#ji-infoPending")?.checked,
    infoPendingNote: q("#ji-infoPendingNote")?.value,
  });
}
