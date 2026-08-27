/**
 * EditSalesAppointment — แก้ไข/ลบนัดหมายของฝ่ายขาย
 *
 * ⚠️ **คนละฟอร์มกับ EditEvent.js ของช่างโดยตั้งใจ** — ฟอร์มของช่างมีทั้งแผงสัญญา (เลขที่สัญญา/
 * จำนวนครั้ง/รอบเข้า) เอกสาร 4 ชนิด ผู้รับผิดชอบ ทีมที่เข้างาน คำขอปิดงาน และปุ่มออกใบแจ้งงาน/
 * ใบส่งของ ซึ่งไม่มีอะไรเกี่ยวกับนัดของเซลเลยสักอย่าง
 *
 * ⚠️ ต้องเป็นคู่แฝดของ AddSalesAppointment.js — ช่องเดียวกัน ประเภทนัดชุดเดียวกัน สีชุดเดียวกัน
 * ถ้าเพิ่มช่องที่ฟอร์มเพิ่ม ต้องเพิ่มที่นี่ด้วยเสมอ ไม่งั้นข้อมูลที่กรอกตอนสร้างจะหายตอนแก้ไข
 * (บันทึกด้วย PUT ซึ่งเขียนทับทั้งชุด)
 *
 * ✅ ที่แก้ (ผู้ใช้แจ้ง: "ยังไม่สามารถแก้ไขวันที่หลายวันได้ แบบตอน addEvent"): เดิมกล่องนี้มีแค่
 * วันที่เริ่ม–สิ้นสุดคู่เดียว ไม่มีทางแตะช่วงวันที่ไม่ติดกันของนัดที่มีอยู่แล้วเลย — ตอนนี้มิเรอร์กลไก
 * sibling-sync เต็มรูปแบบของ EditEvent.js: ตรวจจาก jobGroupId ว่านัดนี้เป็นส่วนหนึ่งของกลุ่มวันที่
 * ไม่ติดกันอยู่แล้วหรือไม่ (siblingEvents) ถ้าใช่ ติ๊กโหมดหลายวันให้อัตโนมัติพร้อมโชว์ทุกช่วงเป็นแถว
 * แก้ไข/ลบทีละช่วงได้ และเพิ่มช่วงใหม่ได้ด้วยปุ่มเดียวกับฟอร์มเพิ่ม
 *
 * ✅ ที่แก้ (ผู้ใช้แจ้ง: "กดลบแผนงาน ขึ้นให้ยืนยัน 2 ที"): เดิมห่อ handleDeleteEvent ด้วย Swal
 * ยืนยันของตัวเองอีกชั้น ทั้งที่ handleDeleteEvent (getDeleteEvent) มี Swal ยืนยันในตัวอยู่แล้ว —
 * กดลบเลยเจอกล่องยืนยันสองรอบซ้อนกัน เทียบบั๊กเดียวกันเป๊ะกับที่ EditEvent.js เคยเจอและแก้ไปแล้ว
 * (ดูคอมเมนต์ที่ btnDelete ของไฟล์นั้น) — แก้ตามแบบเดียวกัน: ปิดกล่องแก้ไขนี้ก่อน แล้วปล่อยให้
 * handleDeleteEvent เปิดกล่องยืนยันของตัวเองเพียงครั้งเดียว
 *
 * ✅ ที่แก้ (ผู้ใช้ขอ: "เน้นต้องกรอกคือชื่อโครงการ"): สลับตัวบังคับกรอกจาก "ลูกค้า/บริษัท" มาเป็น
 * "สถานที่/ชื่อโครงการ" ให้ตรงกับ EditEvent.js ของช่าง (site คือฟิลด์ required:true จริงๆ ฝั่ง server)
 *
 * ✅ ที่แก้ (ผู้ใช้ขอ: "ทำ header และ footer เป็นแบบ fixed แบบของช่างด้วย"): หัวกล่อง/แถบปุ่ม
 * ตรึงอยู่กับที่เหมือน EditEvent.js ของช่าง (ดู #ee-status-header/#ee-action-bar ที่นั่น) เหลือแค่
 * เนื้อฟอร์มตรงกลางที่เลื่อนได้ — ต้องเป็นคู่แฝดกับ AddSalesAppointment.js ในเรื่องนี้ด้วยเช่นกัน
 */
import {
  SALES_APPOINTMENT_TYPES, SALES_TYPE_META, salesEventColors, SALES_STATUSES, SALES_STATUS_DEFAULT, toSalesStatus,
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
 * #editStartTime/#editEndTime) ที่ใช้วิธีนี้อยู่แล้ว ทั้งแอปจึงเป็น 24 ชม. ตรงกันทุกจุด
 */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const normalizeTimeInput = (raw) => {
  const s = String(raw || "").trim();
  const m = s.match(/^(\d{1,2})[.:](\d{2})$/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : s;
};

export const getEditSalesAppointment = async ({
  eventInfo, events, EventService, fetchEventsFromDB, handleDeleteEvent, Swal, moment,
}) => {
  // ⚠️ อ่านจาก events (state จริง) ก่อนเสมอ — object ของ FullCalendar ย้ายฟิลด์ที่มันไม่รู้จักไปไว้ใน
  // extendedProps ทำให้ค่าอย่าง description หายไปถ้าอ่านจาก arg.event ตรงๆ
  const id = eventInfo?.event?.id || eventInfo?.event?._id;
  const src = events.find((e) => String(e._id) === String(id)) || {};
  const ext = eventInfo?.event?.extendedProps || {};
  const pick = (k) => src[k] ?? ext[k] ?? "";

  const currentType = pick("title") || SALES_APPOINTMENT_TYPES[0].key;
  const start = moment(src.start || eventInfo?.event?.start);
  const currentCompany = pick("company");
  const currentSite = pick("site");
  const isAllDay = src.allDay ?? eventInfo?.event?.allDay ?? true;
  const rawEnd = moment(src.end || eventInfo?.event?.end);
  // ⚠️ end ของงาน allDay เก็บแบบ exclusive (+1 วันจากวันสุดท้ายจริง — ธรรมเนียมทั้งแอป) ต้องลบคืน
  // ก่อนโชว์ในช่อง "วันที่สิ้นสุด" ไม่งั้นวันที่ที่เห็นจะเกินมา 1 วันจากที่บันทึกไว้จริง
  // นัดแบบมีเวลาเป๊ะ (ไม่ allDay) ไม่มีแนวคิด "หลายวัน" อยู่แล้ว ใช้วันเริ่มเป็นวันสิ้นสุดตรงๆ
  const displayEnd = isAllDay && rawEnd.isValid()
    ? rawEnd.clone().subtract(1, "day")
    : start;

  // ✅ นัดอื่นๆ ที่เป็น "ช่วงวันที่ไม่ติดกัน" ของนัดหมายเดียวกันนี้ — ตรวจจาก jobGroupId เดียวกับที่
  // ตัวเองมี (มิเรอร์ siblingEvents ของ EditEvent.js เป๊ะ) ถ้ามี แปลว่านัดนี้อยู่ในกลุ่มหลายวันอยู่แล้ว
  const eventJobGroupId = pick("jobGroupId") || "";
  const siblingEvents = (events || [])
    .filter((e) => !e.extendedProps?.isHoliday && String(e._id) !== String(id))
    .filter((e) => eventJobGroupId && e.jobGroupId === eventJobGroupId)
    .sort((a, b) => new Date(a.start) - new Date(b.start));
  const hasSiblings = siblingEvents.length > 0;

  const typeCards = SALES_APPOINTMENT_TYPES.map(
    (t) => `
    <label class="sa-type" data-color="${t.color}">
      <input type="radio" name="saType" value="${esc(t.key)}" ${t.key === currentType ? "checked" : ""} />
      <span class="sa-type-icon">${t.icon}</span>
      <span class="sa-type-title">${esc(t.key)}</span>
      <span class="sa-type-hint">${esc(t.hint)}</span>
    </label>`
  ).join("");

  // ✅ สถานะนัดหมายเป็นชุดของฝ่ายขายเอง (ดู SALES_STATUSES) ไม่ใช่สถานะงานช่าง
  const currentStatus = toSalesStatus(pick("status"));
  const statusChips = SALES_STATUSES.map(
    (st) => `
    <label class="sa-stat" data-color="${st.color}">
      <input type="radio" name="saStatus" value="${esc(st.key)}" ${st.key === currentStatus ? "checked" : ""} />
      <span>${st.icon} ${esc(st.key)}</span>
    </label>`
  ).join("");

  // ✅ หัวกล่องไล่สีตามประเภทนัดปัจจุบัน — อิงค่า ณ ตอนเปิดกล่อง ไม่ reactive ตามที่ผู้ใช้แก้ไข
  // สดๆ (เทียบ pattern เดียวกับ EditEvent.js ที่หัวกล่องอิงสถานะตอนเปิด ไม่ใช่ตอนกำลังแก้)
  const headerType = SALES_TYPE_META[currentType] || SALES_APPOINTMENT_TYPES[0];
  const headerSub = [
    currentCompany,
    currentSite && currentSite !== currentCompany ? currentSite : null,
    hasSiblings ? `${siblingEvents.length + 1} ช่วงวัน` : null,
  ].filter(Boolean).join(" · ") || "ไม่ระบุลูกค้า";

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

    /* ── Header (ตรึงบนสุดเสมอ) ── */
    #sa-header { padding: 18px 46px 16px 22px; display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
    #sa-header-icon { font-size: 26px; line-height: 1; }
    #sa-header-info { flex: 1; min-width: 0; }
    #sa-header-info h3 { margin: 0; font-size: 17px; font-weight: 700; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,.15); }
    #sa-header-info small {
      font-size: 12px; color: rgba(255,255,255,.82);
      display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

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

    /* ── หลายวัน (ไม่ติดกัน) — มิเรอร์ ee-checkbox-row/ee-multi-date-row ของ EditEvent.js ── */
    .sa-checkbox-row {
      display: flex; align-items: center; gap: 8px;
      font-size: 12.5px; font-weight: 600; color: #374151;
      margin: 2px 0 4px; cursor: pointer;
    }
    .sa-checkbox-row input { width: auto !important; cursor: pointer; }
    .sa-checkbox-hint { font-size: 11px; color: #94a3b8; margin: 0 0 10px; }
    /* 🐛 ที่แก้ (ผู้ใช้แจ้ง: "ตรงมันล้น ไม่สวยงาม"): เดิมยัด 2 ช่องวันที่ + ป้ายวันที่ภาษาไทย + ปุ่มลบ
       ไว้แถวเดียวด้วย flex — ช่องวันที่หลังอัปเกรดเป็นปฏิทิน พ.ศ. (MUI) กว้างกว่า input เปล่าๆ มาก
       บวกป้ายข้อความอีกก้อนจึงล้นขอบกล่อง ป้ายนั้นซ้ำซ้อนอยู่แล้วด้วย (ปฏิทิน พ.ศ. ที่อัปเกรดให้
       ก็เขียนวันที่ชัดเจนไม่กำกวมอยู่แล้ว) ✅ ตัดป้ายทิ้ง + ห่อบรรทัดได้เมื่อพื้นที่ไม่พอ (flex-wrap)
       กันล้นซ้ำอีกในอนาคตถ้าจอแคบมากๆ */
    .sa-multi-date-row { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; flex-wrap: wrap; }
    .sa-multi-date-row input { flex: 1; min-width: 130px; }
    .sa-multi-date-row .sa-range-sep { flex-shrink: 0; color: #94a3b8; font-weight: 700; }
    .sa-multi-date-remove { flex-shrink: 0; width: 34px; height: 34px; padding: 0 !important; }
    .sa-row-confirm-bar {
      display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;
      background: #fef2f2; border: 1.5px dashed #fecaca; border-radius: 8px;
      padding: 8px 10px; margin: -2px 0 8px; font-size: 11.5px; color: #991b1b;
    }
    .sa-row-confirm-actions { display: flex; gap: 6px; flex-shrink: 0; }
    .sa-row-confirm-actions .sa-btn { padding: 5px 12px; font-size: 11.5px; }

    /* ── Footer (ตรึงล่างสุดเสมอ) ── */
    #sa-action-bar {
      display: flex; align-items: center; gap: 10px; padding: 14px 22px 16px;
      background: #f1f5f9; border-top: 1px solid #e2e8f0;
      flex-shrink: 0; position: sticky; bottom: 0; z-index: 10; flex-wrap: wrap;
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
    .sa-btn-danger { background: #fef2f2; color: #dc2626; border: 1.5px solid #fecaca; }
    .sa-btn-danger:hover { background: #fee2e2; opacity: 1; }
    .sa-btn-spacer { flex: 1; }
    @media (max-width: 480px) { #sa-action-bar { justify-content: center; } .sa-btn-spacer { display: none; } }
  </style>

  <div id="sa-modal-inner">

    <!-- Header -->
    <div id="sa-header" style="background: linear-gradient(135deg, ${headerType.color}, color-mix(in srgb, ${headerType.color} 72%, black));">
      <div id="sa-header-icon">${headerType.icon}</div>
      <div id="sa-header-info">
        <h3>แก้ไขนัดหมาย</h3>
        <small title="${esc(headerSub)}">${esc(headerSub)}</small>
      </div>
    </div>

    <!-- Body -->
    <div id="sa-body" class="sa-wrap">
      <div class="sa-label" style="margin-top:10px;">ประเภทนัดหมาย</div>
      <div class="sa-types">${typeCards}</div>

      <div class="sa-label"><span class="sa-req">*</span> สถานที่ / ชื่อโครงการ</div>
      <input type="text" id="saSite" value="${esc(currentSite)}" />

      <div class="sa-label">ลูกค้า / บริษัท</div>
      <input type="text" id="saCompany" value="${esc(currentCompany)}" />

      <div class="sa-label">วันที่</div>
      <label class="sa-checkbox-row">
        <input type="checkbox" id="saMultiDateToggle" ${hasSiblings ? "checked" : ""} />
        🗓️ นัดนี้ต้องเข้างานหลายวัน (ไม่ติดกันก็ได้) — ถือเป็นนัดหมายเดียวกัน
      </label>
      ${hasSiblings ? `<div class="sa-checkbox-hint">มีอยู่แล้ว ${siblingEvents.length + 1} ช่วงวัน — ลบ/เพิ่มช่วงได้ด้านล่าง</div>` : ""}

      <div id="saSingleDateSection" style="${hasSiblings ? "display:none;" : ""}">
        <div class="sa-row">
          <div>
            <div class="sa-sublabel">วันที่เริ่ม</div>
            <input type="date" id="saDateStart" value="${start.isValid() ? start.format("YYYY-MM-DD") : ""}" />
          </div>
          <div>
            <div class="sa-sublabel">วันที่สิ้นสุด</div>
            <input type="date" id="saDateEnd" value="${displayEnd.isValid() ? displayEnd.format("YYYY-MM-DD") : ""}" />
          </div>
        </div>
      </div>

      <div id="saMultiDateSection" style="${hasSiblings ? "" : "display:none;"}">
        <div id="saMultiDateList"></div>
        <button type="button" class="sa-btn sa-btn-ghost" id="saAddDateBtn" style="margin-bottom:10px;">➕ เพิ่มช่วงวันที่</button>
      </div>

      <div class="sa-label">เวลา (ถ้ามี — เฉพาะนัดวันเดียวเท่านั้นที่ลงเป็นเวลาตรงเป๊ะได้)</div>
      <div class="sa-row" style="gap:6px">
        <input type="text" id="saStart" placeholder="เช่น 08:30" inputmode="decimal" maxlength="5" value="${esc(pick("startTime"))}" />
        <input type="text" id="saEnd" placeholder="เช่น 17:00" inputmode="decimal" maxlength="5" value="${esc(pick("endTime"))}" />
      </div>

      <div class="sa-label">สถานะนัดหมาย</div>
      <div class="sa-stats">${statusChips}</div>

      <div class="sa-label">รายละเอียด / สิ่งที่ต้องเตรียม</div>
      <textarea id="saDetail" rows="8">${esc(pick("description"))}</textarea>
    </div>

    <!-- Footer -->
    <div id="sa-action-bar">
      <button class="sa-btn sa-btn-danger" id="sa-btnDelete">🗑 ลบนัดหมาย</button>
      <div class="sa-btn-spacer"></div>
      <button class="sa-btn sa-btn-ghost" id="sa-btnCancel">ยกเลิก</button>
      <button class="sa-btn sa-btn-primary" id="sa-btnConfirm">💾 บันทึกการแก้ไข</button>
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
    // ✅ กันคลิกนอกกล่อง/กด ESC แล้วปิดโดยไม่ตั้งใจ ข้อมูลที่แก้ไว้ทั้งหมดหายหมด — ต้องกดปุ่ม
    // "ยกเลิก" หรือปุ่มปิด (✕) อย่างชัดเจนเท่านั้น เทียบ pattern เดียวกับ EditEvent.js ของช่าง
    allowOutsideClick: false,
    allowEscapeKey: false,
    focusConfirm: false,
    // ✅ คืนทรัพยากรของปฏิทิน พ.ศ. ที่ mount ไว้ตอนปิดกล่อง ไม่งั้น React root จะค้างทุกครั้งที่เปิด
    // (เทียบ pattern เดียวกับ AddEvent.js/EditEvent.js ของช่าง)
    willClose: (popup) => {
      popup.__thaiDpCleanup?.();
    },
    didOpen: () => {
      // ✅ เปลี่ยนช่อง <input type="date"> ทุกช่อง (รวมแถวช่วงวันที่ที่เพิ่ม/prefill ทีหลังด้วย —
      // mountThaiDatePickers ดักด้วย MutationObserver ให้เองอัตโนมัติ) เป็นปฏิทิน พ.ศ. เดือนไทย
      Swal.getPopup().__thaiDpCleanup = mountThaiDatePickers(Swal.getPopup());

      document.querySelectorAll(".sa-type").forEach((el) => {
        el.style.setProperty("--sa-c", el.dataset.color);
      });
      document.querySelectorAll(".sa-stat").forEach((el) => {
        el.style.setProperty("--sa-s", el.dataset.color);
      });

      // ── นัดหลายวันไม่ติดกัน — มิเรอร์กลไก sibling-sync เต็มรูปแบบของ EditEvent.js ──
      const multiToggle = document.getElementById("saMultiDateToggle");
      const singleSection = document.getElementById("saSingleDateSection");
      const multiSection = document.getElementById("saMultiDateSection");
      const multiDateList = document.getElementById("saMultiDateList");

      // แถวละ 1 ช่วงวันที่ (เริ่ม–สิ้นสุด) ติด data-event-id ถ้าผูกกับนัดที่มีอยู่จริงแล้ว
      // (แถวใหม่ที่เพิ่งกด "เพิ่มช่วงวันที่" ยังไม่มี data-event-id จนกว่าจะกดบันทึก)
      const addDateRow = (startValue = "", endValue = "", eventIdAttr = "") => {
        const row = document.createElement("div");
        row.className = "sa-multi-date-row";
        if (eventIdAttr) row.dataset.eventId = eventIdAttr;
        row.innerHTML = `
          <input type="date" class="sa-range-start" value="${startValue}">
          <span class="sa-range-sep">–</span>
          <input type="date" class="sa-range-end" value="${endValue || startValue}">
          <button type="button" class="sa-btn sa-btn-ghost sa-multi-date-remove" title="ลบช่วงนี้ออก">✕</button>
        `;

        row.querySelector(".sa-multi-date-remove").addEventListener("click", () => {
          // ต้องเหลืออย่างน้อย 1 แถวเสมอ กันผู้ใช้ลบจนหมด
          if (multiDateList.children.length <= 1) return;
          const rowEventId = row.dataset.eventId;
          if (!rowEventId) {
            // แถวใหม่ที่ยังไม่กดบันทึก ยังไม่ถูกสร้างจริง ลบออกจากฟอร์มได้เลย
            row.remove();
            return;
          }
          // แถวนี้ผูกกับนัดที่มีอยู่จริงแล้ว ต้องยืนยันก่อนลบจริง — ใช้แถบยืนยันในฟอร์มแทน Swal.fire
          // ซ้อน (จะไปแทนที่กล่องแก้ไขทั้งอันเหมือนบั๊กปุ่มลบด้านล่างที่เพิ่งแก้ไปหมาดๆ)
          const already = row.nextElementSibling;
          if (already && already.classList.contains("sa-row-confirm-bar")) { already.remove(); return; }
          document.querySelectorAll(".sa-row-confirm-bar").forEach((el) => el.remove());

          const confirmBar = document.createElement("div");
          confirmBar.className = "sa-row-confirm-bar";
          confirmBar.innerHTML = `
            <span>⚠️ ลบช่วงวันที่นี้? (ช่วงอื่นของนัดเดียวกันจะไม่หายไป)</span>
            <div class="sa-row-confirm-actions">
              <button type="button" class="sa-btn sa-btn-ghost sa-row-confirm-no">ยกเลิก</button>
              <button type="button" class="sa-btn sa-btn-danger sa-row-confirm-yes">ลบช่วงนี้</button>
            </div>
          `;
          row.after(confirmBar);
          confirmBar.querySelector(".sa-row-confirm-no").addEventListener("click", () => confirmBar.remove());
          confirmBar.querySelector(".sa-row-confirm-yes").addEventListener("click", async () => {
            const yesBtn = confirmBar.querySelector(".sa-row-confirm-yes");
            yesBtn.disabled = true;
            yesBtn.textContent = "กำลังลบ...";
            try {
              await EventService.DeleteEvent(rowEventId);
              confirmBar.remove();
              row.remove();
              await fetchEventsFromDB();
            } catch {
              Swal.showValidationMessage("ลบช่วงวันที่นี้ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
              confirmBar.remove();
            }
          });
        });

        row.querySelectorAll("input[type=date]").forEach((input) => {
          input.addEventListener("change", () => sortDateRows());
        });
        multiDateList.appendChild(row);
      };

      // ✅ เรียงตามวันที่เริ่มจากน้อยไปมากเสมอ (รูปแบบ YYYY-MM-DD เทียบเป็นข้อความได้ตรงลำดับเวลาอยู่แล้ว)
      const sortDateRows = () => {
        [...multiDateList.querySelectorAll(".sa-multi-date-row")]
          .map((r) => ({ el: r, key: r.querySelector(".sa-range-start")?.value || "9999-12-31" }))
          .sort((a, b) => a.key.localeCompare(b.key))
          .forEach(({ el }) => multiDateList.appendChild(el));
      };

      // ✅ ค้างวันที่/ช่วงวันที่เดิมไว้เสมอ: นัดปัจจุบัน + ช่วงอื่นๆ ของนัดเดียวกัน (ถ้ามี) แล้วเรียงตามวันที่
      addDateRow(
        start.isValid() ? start.format("YYYY-MM-DD") : "",
        displayEnd.isValid() ? displayEnd.format("YYYY-MM-DD") : "",
        id
      );
      siblingEvents.forEach((s) => {
        const sStart = moment(s.start).format("YYYY-MM-DD");
        const sEnd = s.allDay
          ? moment(s.end).subtract(1, "days").format("YYYY-MM-DD")
          : moment(s.start).format("YYYY-MM-DD");
        addDateRow(sStart, sEnd, String(s._id));
      });
      sortDateRows();

      document.getElementById("saAddDateBtn")?.addEventListener("click", () => addDateRow());

      multiToggle?.addEventListener("change", () => {
        const isMulti = multiToggle.checked;
        singleSection.style.display = isMulti ? "none" : "";
        multiSection.style.display = isMulti ? "" : "none";
      });

      document.getElementById("sa-btnCancel")?.addEventListener("click", () => Swal.close());

      // ── ลบทั้งนัด ────────────────────────────────────────────────
      // ⚠️ handleDeleteEvent (getDeleteEvent) เปิด Swal ยืนยันของตัวเองอยู่แล้ว — เดิมโค้ดนี้เปิด
      // Swal ยืนยันซ้อนอีกชั้นก่อน ทำให้กดลบแล้วเจอกล่องยืนยัน "2 ที" (ผู้ใช้แจ้ง) เทียบบั๊กเดียวกัน
      // เป๊ะกับที่ EditEvent.js เคยเจอและแก้ไปแล้ว (ดู btnDelete ที่นั่น) — ปิดกล่องแก้ไขนี้ก่อน
      // แล้วปล่อยให้ handleDeleteEvent ยืนยันเองครั้งเดียว
      document.getElementById("sa-btnDelete")?.addEventListener("click", () => {
        Swal.close();
        handleDeleteEvent(id);
      });

      // ── บันทึกการแก้ไข ────────────────────────────────────────────
      document.getElementById("sa-btnConfirm")?.addEventListener("click", async (clickEvt) => {
        if (isSaving) return; // ✅ กัน listener ยิงซ้ำ ไม่ให้บันทึกซ้ำ

        const type = document.querySelector('input[name="saType"]:checked')?.value || "อื่นๆ";
        const site = document.getElementById("saSite").value.trim();
        const company = document.getElementById("saCompany").value.trim();
        const startTime = normalizeTimeInput(document.getElementById("saStart").value);
        const endTime = normalizeTimeInput(document.getElementById("saEnd").value);
        const detail = document.getElementById("saDetail").value.trim();
        const status = document.querySelector('input[name="saStatus"]:checked')?.value || SALES_STATUS_DEFAULT;

        // ⚠️ บังคับ "ชื่อโครงการ" ไม่ใช่ "บริษัท" — ตรงกับ EditEvent.js ของช่าง
        if (!site) { Swal.showValidationMessage("กรุณาระบุสถานที่ / ชื่อโครงการ"); return; }
        if (startTime && !TIME_RE.test(startTime)) { Swal.showValidationMessage("เวลาเริ่มไม่ถูกต้อง กรอกแบบ 24 ชม. เช่น 08:30"); return; }
        if (endTime && !TIME_RE.test(endTime)) { Swal.showValidationMessage("เวลาสิ้นสุดไม่ถูกต้อง กรอกแบบ 24 ชม. เช่น 17:00"); return; }
        if (startTime && endTime && endTime < startTime) {
          Swal.showValidationMessage("เวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่ม");
          return;
        }

        const btn = clickEvt.currentTarget;
        const originalLabel = btn.textContent;
        isSaving = true;
        btn.disabled = true;
        btn.textContent = "⏳ กำลังบันทึก...";

        try {
          const { backgroundColor, textColor } = salesEventColors(type);
          const shared = {
            company,
            site,
            title: type,
            description: detail,
            backgroundColor,
            textColor,
            // ⚠️ ต้องส่ง startTime/endTime ทุกครั้ง ไม่ใช่เฉพาะตอนมีเวลา — ผู้ใช้ลบเวลาออกเพื่อ
            // เปลี่ยนกลับเป็น "ทั้งวัน" ได้ ถ้าไม่ส่ง ค่าเดิมจะค้างแล้วนัดจะยังโชว์เวลาเก่าที่ลบไปแล้ว
            startTime: startTime || "",
            endTime: endTime || "",
            // ✅ สถานะแก้ได้จากในฟอร์มนี้โดยตรง — เดิมนัดทุกอันค้างที่ "กำลังรอยืนยัน" ตลอดไป
            status,
            manualStatus: true,
          };

          // ⚠️ ยึด hasSiblings เป็นหลักด้วย ไม่ใช่แค่สถานะ checkbox สดๆ ตอนกดบันทึก — กันนัดที่อยู่
          // ในกลุ่มหลายวันอยู่แล้วหลุดไปแก้แบบวันเดียวโดยไม่ตั้งใจ (เทียบ isMultiMode ของ EditEvent.js)
          const isMultiMode = Boolean(multiToggle?.checked) || hasSiblings;

          if (!isMultiMode) {
            // ✅ นัดวันเดียว — คงพฤติกรรมเดิมเป๊ะ: มีเวลาเริ่ม = นัดตรงเวลา (allDay:false)
            const singleStart = document.getElementById("saDateStart").value;
            const singleEnd = document.getElementById("saDateEnd").value || singleStart;
            if (!singleStart) { Swal.showValidationMessage("กรุณาเลือกวันที่เริ่ม"); isSaving = false; btn.disabled = false; btn.textContent = originalLabel; return; }
            if (moment(singleEnd).isBefore(moment(singleStart))) {
              Swal.showValidationMessage("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม");
              isSaving = false; btn.disabled = false; btn.textContent = originalLabel;
              return;
            }

            let payload;
            if (singleStart !== singleEnd) {
              // ✅ ช่วงวันที่ต่อเนื่องหลายวัน — ทั้งวันเหมือนงานของช่าง เวลาที่กรอกไว้ (ถ้ามี) เป็นแค่
              // ข้อมูลอ้างอิง ไม่ได้ทำให้กลายเป็นนัดตรงเวลา (ดูเหตุผลเต็มที่ AddSalesAppointment.js)
              payload = {
                ...shared,
                allDay: true,
                date: singleStart,
                start: singleStart,
                end: moment(singleEnd).add(1, "days").format("YYYY-MM-DD"),
              };
            } else {
              const startAt = startTime
                ? moment(`${singleStart} ${startTime}`, "YYYY-MM-DD HH:mm")
                : moment(singleStart);
              const endAt = endTime
                ? moment(`${singleStart} ${endTime}`, "YYYY-MM-DD HH:mm")
                : startTime
                  ? startAt.clone().add(1, "hour")
                  : startAt.clone().add(1, "day");
              payload = {
                ...shared,
                allDay: !startTime,
                date: startAt.toDate(),
                start: startAt.toDate(),
                end: endAt.toDate(),
              };
            }
            await EventService.UpdateEvent(id, payload);
          } else {
            // ✅ นัดหลายวันไม่ติดกัน: อ่านทุกแถว แล้วอัปเดต/สร้างทีเดียวตอนกดบันทึก — มิเรอร์ EditEvent.js
            const rows = [...document.querySelectorAll("#saMultiDateList .sa-multi-date-row")];
            const ranges = [];
            for (const row of rows) {
              const s = row.querySelector(".sa-range-start")?.value;
              const e = row.querySelector(".sa-range-end")?.value || s;
              if (!s) continue;
              if (moment(e).isBefore(moment(s))) {
                Swal.showValidationMessage("แต่ละช่วงวันที่ วันสิ้นสุดต้องไม่ก่อนวันเริ่ม");
                isSaving = false; btn.disabled = false; btn.textContent = originalLabel;
                return;
              }
              ranges.push({ start: s, end: e, eventIdAttr: row.dataset.eventId || "" });
            }
            if (ranges.length === 0) {
              Swal.showValidationMessage("กรุณาเลือกอย่างน้อย 1 ช่วงวันที่");
              isSaving = false; btn.disabled = false; btn.textContent = originalLabel;
              return;
            }

            // ✅ ผูก jobGroupId เฉพาะตอนมีมากกว่า 1 ช่วงจริงๆ หรือเป็นนัดที่อยู่ในกลุ่มอยู่แล้ว —
            // ติ๊กโหมดหลายวันไว้แต่สุดท้ายเหลือช่วงเดียว ไม่ควรผูก jobGroupId ให้ (ไม่งั้นจะเข้าใจผิด
            // ว่าเป็นนัดหลายวันทั้งที่จริงมีวันเดียว)
            const shouldGroup = ranges.length > 1 || Boolean(eventJobGroupId);
            const groupId = shouldGroup ? (eventJobGroupId || `${id}-${Date.now()}`) : "";

            for (const r of ranges) {
              const rangeData = {
                ...shared,
                allDay: true,
                ...(groupId ? { jobGroupId: groupId } : {}),
                start: r.start,
                end: moment(r.end).add(1, "days").format("YYYY-MM-DD"),
                date: r.start,
              };
              if (r.eventIdAttr) {
                await EventService.UpdateEvent(r.eventIdAttr, rangeData);
              } else {
                await EventService.AddEvent(rangeData);
              }
            }
          }

          await fetchEventsFromDB();

          Swal.fire({
            toast: true, position: "top", icon: "success",
            title: "บันทึกการแก้ไขแล้ว", showConfirmButton: false, timer: 2000,
          });
        } catch (err) {
          console.error("❌ Error updating sales appointment:", err);
          isSaving = false;
          btn.disabled = false;
          btn.textContent = originalLabel;
          Swal.showValidationMessage(err?.response?.data?.message || "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        }
      });
    },
  });
};

export default getEditSalesAppointment;
