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
  SALES_APPOINTMENT_TYPES, SALES_TYPE_GROUPS, SALES_TYPE_META, salesEventColors, SALES_MANUAL_STATUSES, SALES_STATUS_DEFAULT, SALES_PHOTO_REQUIRED, toSalesStatus,
} from "../../salesAppointmentTypes";
import { SALES_FORM_CSS, salesFormHeader, salesTypePicker } from "./salesFormStyle";
import { mountThaiDatePickers } from "@/shared/components/mountThaiDatePickers";
import { domFormDraft } from "@/shared/utils/formDraft";
// ✅ (10 ต.ค. 2569) ข้อมูลที่กรอกค้างไม่หายเมื่อฟอร์มหลุด/ปิด — ดู shared/utils/formDraft.js
let formDraftCtl = null;

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

  const typeCards = salesTypePicker(SALES_APPOINTMENT_TYPES, SALES_TYPE_GROUPS, currentType, esc);
  const currentValue = Number(pick("jobValue")) || 0;

  // ✅ สถานะนัดหมายเป็นชุดของฝ่ายขายเอง (ดู SALES_STATUSES) ไม่ใช่สถานะงานช่าง
  const currentStatus = toSalesStatus(pick("status"));
  // ✅ เลือกได้เฉพาะสถานะที่ไม่ต้องใช้รูปหน้างาน — "เข้าพบแล้ว/ปิดงานแล้ว" กดจากหน้ารายละเอียดนัด
  const lockedStatus = SALES_PHOTO_REQUIRED.includes(currentStatus);
  const statusChips = lockedStatus
    ? `<div class="sa-locked">สถานะปัจจุบัน: <b>${esc(currentStatus)}</b> — เปลี่ยนได้จากหน้ารายละเอียดนัด</div>`
    : SALES_MANUAL_STATUSES.map(
    (st) => `
    <label class="sa-stat" data-color="${st.color}">
      <input type="radio" name="saStatus" value="${esc(st.key)}" ${st.key === currentStatus ? "checked" : ""} />
      <span>${esc(st.key)}</span>
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
  <style>${SALES_FORM_CSS}</style>

  <div id="sa-modal-inner">
    ${salesFormHeader({ icon: headerType.icon, color: headerType.color, title: "แก้ไขนัดหมาย", sub: esc(headerSub) })}

    <div id="sa-body" class="sa-wrap">
      <div class="sa-card">
        <div class="sa-card-title">ประเภทนัดหมาย</div>
        ${typeCards}
      </div>

      <div class="sa-card">
        <div class="sa-card-title">ลูกค้าและสถานที่</div>
        <div class="sa-label"><span class="sa-req">*</span> สถานที่ / ชื่อโครงการ</div>
        <input type="text" id="saSite" value="${esc(currentSite)}" />
        <div class="sa-label">ลูกค้า / บริษัท</div>
        <input type="text" id="saCompany" value="${esc(currentCompany)}" />
        <div class="sa-row" style="margin-top:12px">
          <div>
            <div class="sa-sublabel">ผู้ติดต่อ</div>
            <input type="text" id="saContactName" placeholder="ชื่อผู้ติดต่อ" value="${esc(pick("contactName"))}" />
          </div>
          <div>
            <div class="sa-sublabel">เบอร์โทร</div>
            <input type="text" id="saContactTel" placeholder="08x-xxx-xxxx" inputmode="tel" value="${esc(pick("contactTel"))}" />
          </div>
        </div>
        <div class="sa-label">มูลค่าโอกาสการขาย (บาท)</div>
        <input type="text" id="saValue" placeholder="เช่น 250,000 — ไม่บังคับ" inputmode="decimal" value="${currentValue ? esc(currentValue.toLocaleString("th-TH")) : ""}" />
      </div>

      <div class="sa-card">
        <div class="sa-card-title">วันและเวลา</div>
        <label class="sa-checkbox-row">
          <input type="checkbox" id="saMultiDateToggle" ${hasSiblings ? "checked" : ""} />
          <span>นัดหลายวัน (ไม่ติดกันก็ได้)<small>ทุกช่วงวันถือเป็นนัดหมายเดียวกัน</small></span>
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
          <button type="button" class="sa-btn sa-btn-ghost" id="saAddDateBtn">＋ เพิ่มช่วงวันที่</button>
        </div>

        <div class="sa-row" style="margin-top:12px">
          <div>
            <div class="sa-sublabel">เวลาเริ่ม</div>
            <input type="text" id="saStart" placeholder="08:30" inputmode="decimal" maxlength="5" value="${esc(pick("startTime"))}" />
          </div>
          <div>
            <div class="sa-sublabel">เวลาสิ้นสุด</div>
            <input type="text" id="saEnd" placeholder="17:00" inputmode="decimal" maxlength="5" value="${esc(pick("endTime"))}" />
          </div>
        </div>
        <div class="sa-hint">ไม่ระบุเวลา = ทั้งวัน · ระบุเวลาได้เฉพาะนัดวันเดียว (แบบ 24 ชม.)</div>
      </div>

      <div class="sa-card">
        <div class="sa-card-title">สถานะนัดหมาย</div>
        <div class="sa-stats">${statusChips}</div>
      </div>

      <div class="sa-card">
        <div class="sa-card-title">รายละเอียด <small>สิ่งที่ต้องเตรียม · เรื่องที่จะคุย</small></div>
        <textarea id="saDetail" rows="5">${esc(pick("description"))}</textarea>
      </div>
    </div>

    <!-- Footer -->
    <div id="sa-action-bar">
      <button class="sa-btn sa-btn-danger" id="sa-btnDelete">ลบ</button>
      <div class="sa-btn-spacer"></div>
      <button class="sa-btn sa-btn-ghost" id="sa-btnCancel">ยกเลิก</button>
      <button class="sa-btn sa-btn-primary" id="sa-btnConfirm">บันทึกการแก้ไข</button>
    </div>

  </div>`;

  let isSaving = false;

  await Swal.fire({
    html,
    width: "1200px",
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
      formDraftCtl?.stop(); // ปิดโดยไม่ได้บันทึก → เก็บค่าล่าสุดไว้กู้คืน
      popup.__thaiDpCleanup?.();
    },
    didOpen: () => {
      // ✅ เปลี่ยนช่อง <input type="date"> ทุกช่อง (รวมแถวช่วงวันที่ที่เพิ่ม/prefill ทีหลังด้วย —
      // ✅ กู้คืนข้อมูลที่กรอกค้างไว้ (ภายใน 10 นาที) — ต้องก่อน TomSelect/ปฏิทิน พ.ศ. mount ให้มันอ่านค่าที่เติมคืน
      {
        const fd = domFormDraft(Swal.getPopup(), `editSalesAppt:${id}`, { bannerHost: "#sa-body" });
        formDraftCtl = fd;
        fd.restore();
        setTimeout(() => fd.start(), 300);
      }
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
        const contactName = document.getElementById("saContactName").value.trim();
        const contactTel = document.getElementById("saContactTel").value.trim();
        const rawValue = document.getElementById("saValue").value.replace(/[,\s฿]/g, "");
        if (rawValue && !(Number(rawValue) >= 0)) { Swal.showValidationMessage("มูลค่าต้องเป็นตัวเลข เช่น 250000"); return; }
        const status = lockedStatus ? currentStatus : (document.querySelector('input[name="saStatus"]:checked')?.value || SALES_STATUS_DEFAULT);

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
            contactName,
            contactTel,
            jobValue: rawValue ? Number(rawValue) : null,
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

          formDraftCtl?.clear(); // บันทึกสำเร็จ → ล้างข้อมูลที่กรอกค้าง
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
