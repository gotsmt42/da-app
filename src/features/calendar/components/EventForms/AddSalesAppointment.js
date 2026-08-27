/**
 * AddSalesAppointment — ฟอร์มลงนัดหมายของฝ่ายขาย
 *
 * ⚠️ **คนละฟอร์มกับ AddEvent.js ของช่างโดยตั้งใจ** — ฟอร์มของช่างเริ่มด้วยขั้นตอน
 * "ประเภทงาน: งานทั่วไป / งานโปรเจค / งานตามสัญญา" แล้วต่อด้วยระบบ/ทีม/ครั้งที่/สัญญา ซึ่งไม่มี
 * ความหมายกับงานขายเลยสักช่อง (เซลไม่ได้เข้างานตามสัญญา ไม่มีครั้งที่ ไม่ต้องเลือกทีมช่าง)
 * ถ้าใช้ฟอร์มเดียวกันแล้วซ่อนทีละช่อง จะเหลือฟอร์มที่มีช่องว่างเป็นรูโหว่และยังต้องดูแลเงื่อนไข
 * ซ่อน/แสดงของทั้งสองสายงานพันกันตลอดไป
 *
 * ⚠️ บันทึกลง CalendarEvent ตัวเดียวกับงานช่าง (department="sales" ประทับที่ server จาก role)
 * — ปฏิทิน/หน้าการดำเนินงานจึงใช้ของเดิมได้ทั้งหมด ไม่ต้องมีระบบปฏิทินคู่ขนาน
 *
 * การจับคู่ช่อง:  title = ประเภทนัด · site = ชื่อโครงการ/สถานที่ (ต้องกรอก) · company = ลูกค้า
 *                description = รายละเอียด
 *
 * ✅ ที่แก้ (ผู้ใช้ขอ: "เน้นต้องกรอกคือชื่อโครงการ"): สลับตัวบังคับกรอกจาก "ลูกค้า/บริษัท" มาเป็น
 * "สถานที่/ชื่อโครงการ" ให้ตรงกับ AddEvent.js ของช่าง — ที่นั่น "ชื่อโครงการ" (site) มี * บังคับ ส่วน
 * "ชื่อบริษัท" (company) ไม่มีเลย เพราะ site คือฟิลด์ที่ required:true จริงๆ ที่ฝั่ง server (CalendarEvent
 * model) และเป็นตัวที่การ์ดบนปฏิทิน/หน้าดำเนินงานใช้อ้างอิงงานเป็นหลัก
 *
 * ✅ ที่แก้ (ผู้ใช้ขอ: "ลงวันที่แบบเริ่ม–สิ้นสุด ลงหลายวันได้ แบบของช่าง"): เดิมมีแค่ช่องวันเดียว —
 * ตอนนี้มีวันที่เริ่ม/สิ้นสุดเป็นค่าเริ่มต้น (ครอบคลุม "หลายวันติดกัน" อยู่แล้วในตัว) บวกช่องกาเครื่อง
 * หมาย "เข้างานหลายวัน (ไม่ติดกันก็ได้)" ที่กางออกเป็นรายการช่วงวันที่เพิ่มได้เรื่อยๆ มิเรอร์
 * ae-multiDateSection/ae-addDateBtn ของ AddEvent.js ทุกกลไก (รวม dates[] ที่ backend ผูก
 * jobGroupId เดียวกันให้อัตโนมัติอยู่แล้วจาก POST /events ตัวเดียวกับที่ช่างใช้)
 * ⚠️ ช่วงที่ยาวกว่า 1 วัน (ไม่ว่าจะจากวันที่เริ่ม–สิ้นสุด หรือจากรายการหลายช่วง) ถือเป็นงาน "ทั้งวัน"
 * เหมือนงานของช่างเสมอ — เวลาที่กรอกไว้ (ถ้ามี) เป็นแค่ข้อมูลอ้างอิงเวลาเข้า/เลิกในแต่ละวัน ไม่ใช่
 * ตัวกำหนดกรอบเวลาบนปฏิทิน มีแค่นัด "วันเดียว" เท่านั้นที่ยังลงเป็นนัดตรงเวลาเป๊ะๆ ได้ (allDay:false)
 * เหมือนเดิมทุกประการ — เป็นการใช้งานที่พบบ่อยที่สุดของเซล (นัดพบลูกค้าเวลาที่แน่นอน)
 *
 * ✅ ที่แก้ (ผู้ใช้ขอ: "ทำ header และ footer เป็นแบบ fixed แบบของช่างด้วย"): เดิมใช้ Swal title/
 * ปุ่มมาตรฐาน — ฟอร์มยาว (ประเภท/ลูกค้า/วันเวลา/สถานะ/รายละเอียด) เลื่อนแล้วปุ่มบันทึกลอยหายไปกับ
 * เนื้อหา ต้องเลื่อนกลับขึ้นไปหา ตอนนี้ทำหัว/ท้ายกล่องให้ตรึงอยู่กับที่เหมือน AddEvent.js ของช่าง
 * (ดู #ae-header/#ae-action-bar ที่นั่น) เหลือแค่เนื้อฟอร์มตรงกลางที่เลื่อนได้ — ปุ่มบันทึกจึงกดถึง
 * ได้เสมอไม่ว่าจะเลื่อนอยู่ตรงไหน
 * ⚠️ ไม่ได้ใช้วิธี inject <style> เข้า document.head แบบ AddEvent.js (ที่ต้องมี id กันแทรกซ้ำ) —
 * ฝังตรงใน html template แบบเดิมของฟอร์มนี้พอ เพราะ <style> ที่ SweetAlert แทรกเข้า DOM มีผลทั้ง
 * เอกสารอยู่แล้วไม่ว่าจะอยู่ตรงไหน ผลลัพธ์เหมือนกันแต่โค้ดสั้นกว่า
 */
import {
  SALES_APPOINTMENT_TYPES, salesEventColors, SALES_STATUSES, SALES_STATUS_DEFAULT,
} from "../../salesAppointmentTypes";
import { mountThaiDatePickers } from "@/shared/components/mountThaiDatePickers";

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/**
 * 🐛 ที่แก้ (ผู้ใช้แจ้ง: "ปรับรูปแบบเวลาให้เป็น 24ชม. แบบนี้ใช้ยาก"): เดิมใช้ <input type="time">
 * ของเบราว์เซอร์ ซึ่งแสดงผลเป็น 12 ชม. + AM/PM ตาม locale ของเครื่อง ไม่ใช่ตามภาษาของหน้าเว็บ —
 * ลองใส่ lang="th" ที่ตัว input แล้วก็ไม่ช่วย (เบราว์เซอร์ไม่อ่านค่านี้สำหรับ time picker) ผู้ใช้ไทย
 * เห็น "02:30 PM" แล้วงงว่ากรอกเวลาอะไรไป ข้อมูลที่บันทึกจริงถูกต้องเสมอ (ค่า .value ของ
 * input[type=time] เป็น 24 ชม. อยู่แล้ว) ปัญหาอยู่ที่การแสดงผลล้วนๆ
 * ✅ เปลี่ยนเป็นช่องข้อความธรรมดา ตามแบบเดียวกับฟอร์มของช่าง (AddEvent.js/EditEvent.js — ดู
 * #startTime/#endTime) ที่ใช้วิธีนี้อยู่แล้ว ทั้งแอปจึงเป็น 24 ชม. ตรงกันทุกจุด
 */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const normalizeTimeInput = (raw) => {
  const s = String(raw || "").trim();
  const m = s.match(/^(\d{1,2})[.:](\d{2})$/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : s;
};

export const getAddSalesAppointment = async ({
  arg, userData, saveEventToDB, fetchEventsFromDB, Swal, moment, department,
}) => {
  const clickedDate = arg?.dateStr || moment().format("YYYY-MM-DD");
  const displayDate = moment(clickedDate).locale("th").format("D MMMM YYYY");

  const typeCards = SALES_APPOINTMENT_TYPES.map(
    (t, i) => `
    <label class="sa-type" data-color="${t.color}">
      <input type="radio" name="saType" value="${esc(t.key)}" ${i === 0 ? "checked" : ""} />
      <span class="sa-type-icon">${t.icon}</span>
      <span class="sa-type-title">${esc(t.key)}</span>
      <span class="sa-type-hint">${esc(t.hint)}</span>
    </label>`
  ).join("");

  // ✅ สถานะนัดหมายเป็นชุดของฝ่ายขายเอง (ดู SALES_STATUSES) ไม่ใช่สถานะงานช่าง
  const currentStatus = SALES_STATUS_DEFAULT;
  const statusChips = SALES_STATUSES.map(
    (st) => `
    <label class="sa-stat" data-color="${st.color}">
      <input type="radio" name="saStatus" value="${esc(st.key)}" ${st.key === currentStatus ? "checked" : ""} />
      <span>${st.icon} ${esc(st.key)}</span>
    </label>`
  ).join("");

  // ✅ หัวกล่องไล่สีตามประเภทนัดที่เลือกไว้เป็นค่าเริ่มต้น (ตัวแรกในลิสต์) — ไม่ได้ผูก reactive
  // กับตอนผู้ใช้เปลี่ยนตัวเลือกภายหลัง เทียบ pattern เดียวกับหัวกล่องของ EditEvent.js ที่อิง
  // สถานะ ณ ตอนเปิดกล่อง ไม่ใช่ค่าที่กำลังแก้อยู่สดๆ
  const headerType = SALES_APPOINTMENT_TYPES[0];

  const html = `
  <style>
    .swal-sales-appt.swal2-popup {
      padding: 0 !important; border-radius: 18px !important; overflow: hidden !important;
      width: min(96vw, 720px) !important; max-height: 92vh !important;
      display: flex !important; flex-direction: column !important;
      font-family: 'Inter', system-ui, sans-serif !important;
      box-shadow: 0 25px 60px rgba(88,28,135,.28) !important;
    }
    .swal-sales-appt .swal2-html-container {
      margin: 0 !important; padding: 0 !important; overflow: hidden !important;
      display: flex !important; flex-direction: column !important; flex: 1 !important; min-height: 0 !important;
    }
    #sa-modal-inner { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .swal-sales-appt .swal2-title, .swal-sales-appt .swal2-actions, .swal-sales-appt .swal2-footer {
      display: none !important;
    }
    .swal-sales-appt .swal2-close {
      position: absolute; top: 14px; right: 16px; z-index: 99;
      width: 32px; height: 32px; border-radius: 50%;
      background: rgba(255,255,255,.16) !important; color: #fff !important;
      font-size: 18px; display: flex; align-items: center; justify-content: center;
      transition: background .2s;
    }
    .swal-sales-appt .swal2-close:hover { background: rgba(255,255,255,.30) !important; }

    /* ── Header (ตรึงบนสุดเสมอ — ไม่ได้อยู่ในพื้นที่ที่เลื่อน) ── */
    #sa-header { padding: 18px 46px 16px 22px; display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
    #sa-header-icon { font-size: 26px; line-height: 1; }
    #sa-header-info { flex: 1; min-width: 0; }
    #sa-header-info h3 { margin: 0; font-size: 17px; font-weight: 700; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,.15); }
    #sa-header-info small { font-size: 12px; color: rgba(255,255,255,.82); }

    /* ── Body (พื้นที่เดียวที่เลื่อนได้) ── */
    #sa-body { padding: 4px 22px 18px; background: #f8fafc; overflow-y: auto; flex: 1; min-height: 0; }

    .sa-label { font-size: 12px; font-weight: 700; color: #64748b; margin: 14px 0 6px; }
    .sa-sublabel { font-size: 11px; font-weight: 600; color: #94a3b8; margin: 0 0 4px; }
    .sa-stats { display: flex; flex-wrap: wrap; gap: 6px; }
    .sa-stat { position: relative; display: inline-flex; align-items: center; gap: 5px;
      padding: 6px 12px; border: 1.5px solid #e2e8f0; border-radius: 999px; cursor: pointer;
      font-size: 13px; font-weight: 700; color: #64748b; transition: border-color .15s, background .15s, color .15s; }
    .sa-stat input { position: absolute; opacity: 0; pointer-events: none; }
    .sa-stat:has(input:checked) { border-color: var(--sa-s); background: color-mix(in srgb, var(--sa-s) 12%, white); color: var(--sa-s); }
    .sa-types { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
    .sa-type { position: relative; display: block; padding: 10px 12px; border: 1.5px solid #e2e8f0;
      border-radius: 12px; cursor: pointer; transition: border-color .15s, background .15s; }
    .sa-type input { position: absolute; opacity: 0; pointer-events: none; }
    .sa-type-icon { font-size: 18px; display: block; }
    .sa-type-title { display: block; font-weight: 700; font-size: 13px; margin-top: 2px; }
    .sa-type-hint { display: block; font-size: 11px; color: #94a3b8; }
    .sa-type:has(input:checked) { border-color: var(--sa-c); background: color-mix(in srgb, var(--sa-c) 8%, white); }
    .sa-type:has(input:checked) .sa-type-title { color: var(--sa-c); }
    .sa-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .sa-wrap input[type="text"], .sa-wrap input[type="date"], .sa-wrap textarea {
      width: 100%; padding: 9px 11px; border: 1.5px solid #e2e8f0; border-radius: 10px;
      font-size: 14px; font-family: inherit; box-sizing: border-box; }
    .sa-wrap textarea { resize: vertical; min-height: 90px; line-height: 1.6; }
    .sa-wrap input:focus, .sa-wrap textarea:focus { outline: none; border-color: #8b5cf6; }
    .sa-req { color: #dc2626; }
    @media (max-width: 560px) { .sa-row { grid-template-columns: 1fr; } }

    /* ── หลายวัน (ไม่ติดกัน) — มิเรอร์ ae-checkbox-row/ae-multi-date-row ของ AddEvent.js ── */
    .sa-checkbox-row {
      display: flex; align-items: center; gap: 8px;
      font-size: 12.5px; font-weight: 600; color: #374151;
      margin: 2px 0 10px; cursor: pointer;
    }
    .sa-checkbox-row input { width: auto !important; cursor: pointer; }
    .sa-multi-date-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
    .sa-multi-date-row input { flex: 1; }
    .sa-multi-date-row .sa-range-sep { flex-shrink: 0; color: #94a3b8; font-weight: 700; }
    .sa-multi-date-remove { flex-shrink: 0; width: 34px; height: 34px; padding: 0 !important; }

    /* ── Footer (ตรึงล่างสุดเสมอ) ── */
    #sa-action-bar {
      display: flex; gap: 10px; padding: 14px 22px 16px;
      background: #f1f5f9; border-top: 1px solid #e2e8f0;
      justify-content: flex-end; flex-shrink: 0;
      position: sticky; bottom: 0; z-index: 10;
    }
    .sa-btn {
      display: inline-flex; align-items: center; gap: 7px;
      border: none; border-radius: 9px; padding: 10px 20px;
      font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap;
      transition: opacity .15s, transform .1s; font-family: inherit;
    }
    .sa-btn:hover { opacity: .88; transform: translateY(-1px); }
    .sa-btn:active { transform: translateY(0); }
    .sa-btn:disabled { opacity: .6 !important; cursor: not-allowed; transform: none !important; }
    .sa-btn-primary { background: #8b5cf6; color: #fff; }
    .sa-btn-ghost { background: #e2e8f0; color: #475569; }
    .sa-btn-spacer { flex: 1; }
    @media (max-width: 480px) { .sa-btn-spacer { display: none; } #sa-action-bar { justify-content: center; } }
  </style>

  <div id="sa-modal-inner">

    <!-- Header -->
    <div id="sa-header" style="background: linear-gradient(135deg, ${headerType.color}, color-mix(in srgb, ${headerType.color} 72%, black));">
      <div id="sa-header-icon">${headerType.icon}</div>
      <div id="sa-header-info">
        <h3>เพิ่มนัดหมายของฉัน</h3>
        <small>📅 ${esc(displayDate)}</small>
      </div>
    </div>

    <!-- Body -->
    <div id="sa-body" class="sa-wrap">
      <div class="sa-label" style="margin-top:10px;">ประเภทนัดหมาย</div>
      <div class="sa-types">${typeCards}</div>

      <div class="sa-label"><span class="sa-req">*</span> สถานที่ / ชื่อโครงการ</div>
      <input type="text" id="saSite" placeholder="เช่น อาคาร A ชั้น 12 / โครงการ XYZ" />

      <div class="sa-label">ลูกค้า / บริษัท</div>
      <input type="text" id="saCompany" placeholder="เช่น นิติบุคคลอาคารชุด ABC" />

      <div class="sa-label">วันที่</div>
      <label class="sa-checkbox-row">
        <input type="checkbox" id="saMultiDateToggle" />
        🗓️ นัดนี้ต้องเข้างานหลายวัน (ไม่ติดกันก็ได้) — ถือเป็นนัดหมายเดียวกัน
      </label>

      <div id="saSingleDateSection">
        <div class="sa-row">
          <div>
            <div class="sa-sublabel">วันที่เริ่ม</div>
            <input type="date" id="saDateStart" value="${clickedDate}" />
          </div>
          <div>
            <div class="sa-sublabel">วันที่สิ้นสุด</div>
            <input type="date" id="saDateEnd" value="${clickedDate}" />
          </div>
        </div>
      </div>

      <div id="saMultiDateSection" style="display:none;">
        <div id="saMultiDateList"></div>
        <button type="button" class="sa-btn sa-btn-ghost" id="saAddDateBtn" style="margin-bottom:10px;">➕ เพิ่มช่วงวันที่</button>
      </div>

      <div class="sa-label">เวลา (ถ้ามี — เฉพาะนัดวันเดียวเท่านั้นที่ลงเป็นเวลาตรงเป๊ะได้)</div>
      <div class="sa-row" style="gap:6px">
        <input type="text" id="saStart" placeholder="เช่น 08:30" inputmode="decimal" maxlength="5" />
        <input type="text" id="saEnd" placeholder="เช่น 17:00" inputmode="decimal" maxlength="5" />
      </div>

      <div class="sa-label">สถานะนัดหมาย</div>
      <div class="sa-stats">${statusChips}</div>

      <div class="sa-label">รายละเอียด / สิ่งที่ต้องเตรียม</div>
      <textarea id="saDetail" rows="8" placeholder="เช่น ลูกค้าอยากได้ใบเสนอราคาระบบดับเพลิงชั้น 12"></textarea>
    </div>

    <!-- Footer -->
    <div id="sa-action-bar">
      <div class="sa-btn-spacer"></div>
      <button class="sa-btn sa-btn-ghost" id="sa-btnCancel">ยกเลิก</button>
      <button class="sa-btn sa-btn-primary" id="sa-btnConfirm">💾 บันทึกนัดหมาย</button>
    </div>

  </div>`;

  let isSaving = false;

  await Swal.fire({
    html,
    width: "720px",
    showConfirmButton: false,
    showCancelButton: false,
    showCloseButton: true,
    customClass: { popup: "swal-sales-appt" },
    // ✅ กันคลิกนอกกล่อง/กด ESC แล้วปิดโดยไม่ตั้งใจ ข้อมูลที่กรอกไว้ทั้งหมดหายหมด — ต้องกดปุ่ม
    // "ยกเลิก" หรือปุ่มปิด (✕) อย่างชัดเจนเท่านั้น เทียบ pattern เดียวกับ AddEvent.js ของช่าง
    allowOutsideClick: false,
    allowEscapeKey: false,
    focusConfirm: false,
    // ✅ คืนทรัพยากรของปฏิทิน พ.ศ. ที่ mount ไว้ตอนปิดกล่อง ไม่งั้น React root จะค้างทุกครั้งที่เปิด
    // (เทียบ pattern เดียวกับ AddEvent.js/EditEvent.js ของช่าง)
    willClose: (popup) => {
      popup.__thaiDpCleanup?.();
    },
    didOpen: () => {
      // ✅ เปลี่ยนช่อง <input type="date"> ทุกช่อง (รวมแถวช่วงวันที่ที่เพิ่มทีหลังด้วย —
      // mountThaiDatePickers ดักด้วย MutationObserver ให้เองอัตโนมัติ) เป็นปฏิทิน พ.ศ. เดือนไทย
      // แบบเดียวกับฟอร์มของช่าง (ช่องเดิมถูกซ่อนไว้เป็นตัวเก็บค่า โค้ดที่อ่าน .value ตอนกดบันทึก
      // จึงทำงานเหมือนเดิม)
      Swal.getPopup().__thaiDpCleanup = mountThaiDatePickers(Swal.getPopup());

      // ตั้งตัวแปรสีให้การ์ดแต่ละใบ เพื่อให้ :has(input:checked) ใช้สีประจำประเภทนั้นได้
      document.querySelectorAll(".sa-type").forEach((el) => {
        el.style.setProperty("--sa-c", el.dataset.color);
      });
      document.querySelectorAll(".sa-stat").forEach((el) => {
        el.style.setProperty("--sa-s", el.dataset.color);
      });

      // ── นัดหลายวันไม่ติดกัน — มิเรอร์กลไกเดียวกับ AddEvent.js (ae-multiDateSection) ──
      const multiToggle = document.getElementById("saMultiDateToggle");
      const singleSection = document.getElementById("saSingleDateSection");
      const multiSection = document.getElementById("saMultiDateSection");
      const multiDateList = document.getElementById("saMultiDateList");

      const addDateRow = (startValue = "", endValue = "") => {
        const row = document.createElement("div");
        row.className = "sa-multi-date-row";
        row.innerHTML = `
          <input type="date" class="sa-range-start" value="${startValue}">
          <span class="sa-range-sep">–</span>
          <input type="date" class="sa-range-end" value="${endValue || startValue}">
          <button type="button" class="sa-btn sa-btn-ghost sa-multi-date-remove" title="ลบช่วงนี้ออก">✕</button>
        `;
        row.querySelector(".sa-multi-date-remove").addEventListener("click", () => {
          // ต้องเหลืออย่างน้อย 1 แถวเสมอ กันผู้ใช้ลบจนหมด
          if (multiDateList.children.length > 1) row.remove();
        });
        multiDateList.appendChild(row);
      };
      addDateRow(clickedDate, clickedDate); // แถวแรก prefill ด้วยวันที่ที่คลิกบนปฏิทินมา

      document.getElementById("saAddDateBtn")?.addEventListener("click", () => addDateRow());

      multiToggle?.addEventListener("change", () => {
        const isMulti = multiToggle.checked;
        singleSection.style.display = isMulti ? "none" : "";
        multiSection.style.display = isMulti ? "" : "none";
      });

      document.getElementById("sa-btnCancel")?.addEventListener("click", () => Swal.close());

      document.getElementById("sa-btnConfirm")?.addEventListener("click", async (clickEvt) => {
        if (isSaving) return; // ✅ กัน listener ยิงซ้ำ ไม่ให้บันทึกซ้ำ

        const type = document.querySelector('input[name="saType"]:checked')?.value || "อื่นๆ";
        const site = document.getElementById("saSite").value.trim();
        const company = document.getElementById("saCompany").value.trim();
        const startTime = normalizeTimeInput(document.getElementById("saStart").value);
        const endTime = normalizeTimeInput(document.getElementById("saEnd").value);
        const detail = document.getElementById("saDetail").value.trim();
        const status = document.querySelector('input[name="saStatus"]:checked')?.value || SALES_STATUS_DEFAULT;

        // ⚠️ บังคับ "ชื่อโครงการ" ไม่ใช่ "บริษัท" — ตรงกับ AddEvent.js ของช่าง (site คือฟิลด์ที่
        // required:true จริงๆ ฝั่ง server และเป็นตัวที่การ์ดปฏิทิน/หน้าดำเนินงานอ้างอิงเป็นหลัก)
        if (!site) { Swal.showValidationMessage("กรุณาระบุสถานที่ / ชื่อโครงการ"); return; }
        if (startTime && !TIME_RE.test(startTime)) { Swal.showValidationMessage("เวลาเริ่มไม่ถูกต้อง กรอกแบบ 24 ชม. เช่น 08:30"); return; }
        if (endTime && !TIME_RE.test(endTime)) { Swal.showValidationMessage("เวลาสิ้นสุดไม่ถูกต้อง กรอกแบบ 24 ชม. เช่น 17:00"); return; }
        // ⚠️ เช็คเฉพาะตอนกรอกครบทั้งคู่ — กรอกแค่เวลาเริ่มแล้วปล่อยเวลาจบว่างเป็นเรื่องปกติ
        if (startTime && endTime && endTime < startTime) {
          Swal.showValidationMessage("เวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่ม");
          return;
        }

        // ── อ่านวันที่ ตามโหมดที่เลือก ──
        const isMultiDate = Boolean(multiToggle?.checked);
        let dateRanges = [];
        let singleStart = "";
        let singleEnd = "";

        if (isMultiDate) {
          const rows = [...document.querySelectorAll(".sa-multi-date-row")];
          for (const row of rows) {
            const s = row.querySelector(".sa-range-start")?.value;
            const e = row.querySelector(".sa-range-end")?.value || s;
            if (!s) continue;
            if (moment(e).isBefore(moment(s))) {
              Swal.showValidationMessage("แต่ละช่วงวันที่ วันสิ้นสุดต้องไม่ก่อนวันเริ่ม");
              return;
            }
            dateRanges.push({ start: s, end: e });
          }
          if (dateRanges.length === 0) {
            Swal.showValidationMessage("กรุณาเลือกอย่างน้อย 1 ช่วงวันที่");
            return;
          }
        } else {
          singleStart = document.getElementById("saDateStart").value;
          singleEnd = document.getElementById("saDateEnd").value || singleStart;
          if (!singleStart) { Swal.showValidationMessage("กรุณาเลือกวันที่เริ่ม"); return; }
          if (moment(singleEnd).isBefore(moment(singleStart))) {
            Swal.showValidationMessage("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม");
            return;
          }
        }

        const btn = clickEvt.currentTarget;
        const originalLabel = btn.textContent;
        isSaving = true;
        btn.disabled = true;
        btn.textContent = "⏳ กำลังบันทึก...";

        try {
          const { backgroundColor, textColor } = salesEventColors(type);
          const base = {
            company,
            site,
            title: type,
            description: detail,
            backgroundColor,
            textColor,
            fontSize: 14,
            startTime: startTime || "",
            endTime: endTime || "",
            // ✅ สถานะชุดของฝ่ายขาย ไม่ใช่ "กำลังรอยืนยัน" ของช่าง (นัดของเซลไม่มีขั้นตอนอนุมัติ)
            // ⚠️ ส่ง department เฉพาะตอนที่ผู้เรียกระบุมา (แอดมินสร้างในปฏิทินเซล) — เซลเองไม่ต้องส่ง
            // เพราะ server เดาจาก role ได้ถูกอยู่แล้ว และ server ยอมรับค่านี้เฉพาะแอดมิน/ผู้จัดการ
            ...(department ? { department } : {}),
            status,
            // ⚠️ กันไม่ให้ตัวไล่สถานะอัตโนมัติของงานช่างมาแตะ (ดู useEffect ใน CalendarBoard)
            manualStatus: true,
            userId: userData?.userId,
          };

          let newEvent;
          if (isMultiDate) {
            // ✅ หลายช่วงวันที่ไม่ติดกัน: ส่ง dates[] แทน start/end/date เดี่ยว — backend (POST
            // /events ตัวเดียวกับที่ช่างใช้) จะสร้าง record แยกต่อช่วงแล้วผูกกันด้วย jobGroupId
            // เดียวกันให้อัตโนมัติ ถือเป็นนัดหมายเดียวกันทั้งหมด
            newEvent = {
              ...base,
              allDay: true,
              dates: dateRanges.map((r) => ({
                start: r.start,
                end: moment(r.end).add(1, "days").format("YYYY-MM-DD"),
                date: r.start,
              })),
            };
          } else if (singleStart !== singleEnd) {
            // ✅ ช่วงวันที่ต่อเนื่องหลายวัน (ไม่ได้ใช้ปุ่มไม่ติดกัน) — ทั้งวันเหมือนงานของช่าง
            // เวลาที่กรอกไว้ (ถ้ามี) เป็นแค่ข้อมูลอ้างอิง ไม่ได้ทำให้กลายเป็นนัดตรงเวลา
            newEvent = {
              ...base,
              allDay: true,
              date: singleStart,
              start: singleStart,
              end: moment(singleEnd).add(1, "days").format("YYYY-MM-DD"),
            };
          } else {
            // ✅ นัดวันเดียว — คงพฤติกรรมเดิมเป๊ะ: มีเวลาเริ่ม = นัดตรงเวลา (allDay:false),
            // ไม่มีเวลา = ถือทั้งวัน ⚠️ end ต้อง exclusive (+1 วัน) เมื่อเป็น allDay ตามแบบแผนทั้งแอป
            const startAt = startTime
              ? moment(`${singleStart} ${startTime}`, "YYYY-MM-DD HH:mm")
              : moment(singleStart);
            const endAt = endTime
              ? moment(`${singleStart} ${endTime}`, "YYYY-MM-DD HH:mm")
              : startTime
                ? startAt.clone().add(1, "hour")
                : startAt.clone().add(1, "day");
            newEvent = {
              ...base,
              allDay: !startTime,
              date: startAt.toDate(),
              start: startAt.toDate(),
              end: endAt.toDate(),
            };
          }

          await saveEventToDB(newEvent);
          await fetchEventsFromDB();

          Swal.fire({
            toast: true, position: "top", icon: "success",
            title: "บันทึกนัดหมายแล้ว", showConfirmButton: false, timer: 2000,
          });
        } catch (err) {
          // ✅ err.message ของ axios เป็นข้อความทั่วไป ไม่ใช่ข้อความไทยที่ backend ตั้งใจส่งมา —
          // ต้องอ่านจาก response.data.message ก่อนเสมอ ไม่งั้นข้อความแจ้งเตือนจะไปไม่ถึงผู้ใช้เลย
          console.error("❌ Error saving sales appointment:", err);
          isSaving = false;
          btn.disabled = false;
          btn.textContent = originalLabel;
          Swal.showValidationMessage(err?.response?.data?.message || "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        }
      });
    },
  });
};

export default getAddSalesAppointment;
