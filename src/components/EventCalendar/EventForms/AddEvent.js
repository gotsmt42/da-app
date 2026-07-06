/* ─────────────────────────────────────────────
   STYLE INJECTION  (shared with EditEvent — skip if already injected)
───────────────────────────────────────────── */
function injectAddStyles() {
  if (document.getElementById("add-event-styles")) return;
  const style = document.createElement("style");
  style.id = "add-event-styles";
  style.textContent = `
    /* ── Modal shell ── */
    .swal-add-event.swal2-popup {
      padding: 0 !important;
      border-radius: 16px !important;
      overflow: hidden !important;
      width: min(98vw, 1100px) !important;
      max-height: 95vh !important;
      display: flex !important;
      flex-direction: column !important;
      font-family: 'Inter', system-ui, sans-serif !important;
      box-shadow: 0 25px 60px rgba(10,22,40,.35) !important;
    }
    .swal-add-event .swal2-html-container {
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      display: flex !important;
      flex-direction: column !important;
      flex: 1 !important;
      min-height: 0 !important;
    }
    .swal-add-event #ae-modal-inner {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }
    .swal-add-event .swal2-title { display: none !important; }
    .swal-add-event .swal2-actions { display: none !important; }
    .swal-add-event .swal2-footer { display: none !important; }
    .swal-add-event .swal2-close {
      position: absolute; top: 14px; right: 16px; z-index: 99;
      width: 32px; height: 32px; border-radius: 50%;
      background: rgba(255,255,255,.15) !important; color: #fff !important;
      font-size: 18px; display: flex; align-items: center; justify-content: center;
      transition: background .2s;
    }
    .swal-add-event .swal2-close:hover { background: rgba(255,255,255,.30) !important; }

    /* ── Add header ── */
    #ae-header {
      padding: 20px 24px 18px;
      display: flex; align-items: center; gap: 14px;
      background: linear-gradient(135deg, #0f172a, #1e3a5f);
      flex-shrink: 0;
    }
    #ae-header-icon { font-size: 28px; line-height: 1; }
    #ae-header-info { flex: 1; }
    #ae-header-info h3 { margin:0; font-size:18px; font-weight:700; color:#fff; }
    #ae-header-info small { font-size:12px; color:rgba(255,255,255,.65); }

    /* ── Body ── */
    #ae-body {
      padding: 22px 26px;
      background: #f8fafc;
      overflow-y: auto;
      flex: 1;
      min-height: 0;
    }

    /* ── Section label ── */
    .ae-section-label {
      font-size: 11px; font-weight: 700; letter-spacing: .08em;
      text-transform: uppercase; color: #64748b; margin: 0 0 10px;
    }

    /* ── Grid ── */
    .ae-grid { display: grid; gap: 12px; margin-bottom: 16px; }
    .ae-grid-2 { grid-template-columns: 1fr 1fr; }
    .ae-grid-3 { grid-template-columns: 1fr 1fr 1fr; }
    @media(max-width:600px) { .ae-grid-2,.ae-grid-3 { grid-template-columns: 1fr; } }

    /* ── Field ── */
    .ae-field { display: flex; flex-direction: column; gap: 5px; }
    .ae-field label {
      font-size: 12px; font-weight: 600; color: #374151;
      display: flex; align-items: center; gap: 4px;
    }
    .ae-field label .req { color: #ef4444; font-size: 13px; }
    .ae-field select, .ae-field input {
      width: 100%; box-sizing: border-box;
      border: 1.5px solid #e2e8f0; border-radius: 8px;
      padding: 9px 12px; font-size: 14px; color: #1e293b;
      background: #fff; transition: border-color .2s, box-shadow .2s;
      font-family: inherit;
    }
    .ae-field select:focus, .ae-field input:focus {
      outline: none; border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37,99,235,.12);
    }

    /* ── Divider ── */
    .ae-divider { border: none; border-top: 1px solid #e2e8f0; margin: 16px 0; }

    /* ── Date badge (แสดงวันที่คลิก) ── */
    .ae-date-badge {
      display: inline-flex; align-items: center; gap: 6px;
      background: #f0fdf4; border: 1px solid #bbf7d0;
      color: #166534; border-radius: 20px; padding: 4px 14px;
      font-size: 12px; font-weight: 600; margin-bottom: 16px;
    }

    /* ── Multi-date (งานเข้าหลายวันไม่ติดกัน) ── */
    .ae-checkbox-row {
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; font-weight: 600; color: #374151;
      margin-bottom: 14px; cursor: pointer;
    }
    .ae-checkbox-row input { width: auto !important; cursor: pointer; }
    .ae-multi-date-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
    .ae-multi-date-row input {
      flex: 1; box-sizing: border-box;
      border: 1.5px solid #e2e8f0; border-radius: 8px;
      padding: 9px 12px; font-size: 14px; color: #1e293b;
      background: #fff; font-family: inherit;
    }
    .ae-multi-date-row input:focus {
      outline: none; border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37,99,235,.12);
    }
    .ae-multi-date-row .ae-range-sep { flex-shrink: 0; color: #94a3b8; font-weight: 700; }
    .ae-multi-date-remove {
      flex-shrink: 0; width: 34px; height: 34px; padding: 0 !important;
      display: flex; align-items: center; justify-content: center;
    }

    /* ── Color row ── */
    .ae-color-row { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-bottom: 0; }
    .ae-color-item { display: flex; align-items: center; gap: 8px; }
    .ae-color-item label { font-size: 12px; font-weight: 600; color: #374151; }
    .ae-color-item input[type=color] {
      width: 44px; height: 36px; border: 1.5px solid #e2e8f0;
      border-radius: 8px; cursor: pointer; padding: 2px; background: #fff;
    }

    /* ── Action bar ── */
    #ae-action-bar {
      display: flex; gap: 10px; flex-wrap: wrap;
      padding: 16px 24px 20px;
      background: #f1f5f9; border-top: 1px solid #e2e8f0;
      justify-content: flex-end;
      flex-shrink: 0;
      position: sticky; bottom: 0; z-index: 10;
    }
    .ae-btn {
      display: inline-flex; align-items: center; gap: 7px;
      border: none; border-radius: 9px; padding: 10px 20px;
      font-size: 13px; font-weight: 700; cursor: pointer;
      transition: opacity .15s, transform .1s; white-space: nowrap;
      font-family: inherit;
    }
    .ae-btn:hover  { opacity: .88; transform: translateY(-1px); }
    .ae-btn:active { transform: translateY(0); }
    .ae-btn-success { background: #10b981; color: #fff; }
    .ae-btn-ghost   { background: #e2e8f0; color: #475569; }
    .ae-btn-spacer  { flex: 1; }
    @media(max-width:520px) { .ae-btn-spacer { display:none; } #ae-action-bar { justify-content:center; } }

    /* ── TomSelect override ── */
    .swal-add-event .ts-wrapper { width: 100%; }
    .swal-add-event .ts-wrapper .ts-control {
      border: 1.5px solid #e2e8f0 !important; border-radius: 8px !important;
      padding: 8px 12px !important; font-size: 14px !important; min-height: 40px;
    }
    .swal-add-event .ts-wrapper.focus .ts-control { border-color: #2563eb !important; }
  `;
  document.head.appendChild(style);
}

/* ─────────────────────────────────────────────
   MAIN EXPORT
───────────────────────────────────────────── */
export const getAddEvent = async ({
  arg,
  defaultTextColor,
  defaultBackgroundColor,
  setDefaultTextColor,
  setDefaultBackgroundColor,
  setDefaultFontSize,
  saveEventToDB,
  fetchEventsFromDB,
  CustomerService,
  AuthService,
  Swal,
  TomSelect,
  moment,
}) => {
  injectAddStyles();

  const [customers, employees] = await Promise.all([
    CustomerService.getCustomers(),
    AuthService.getAllUserData(),
  ]);
  const employeeList = employees?.allUser || [];
  // ใช้ผูก resPerson (ID จริง) จากชื่อที่เลือกใน dropdown ทีม
  // เพื่อให้ technician มองเห็น/จัดการงานของตัวเองในหน้า Operation ได้ถูกต้อง
  const teamToId = new Map(employeeList.map((e) => [e.fname, e._id]));

  const displayDate = moment(arg.dateStr).format("DD MMMM YYYY");

  /* ── options ── */
  const companyOpts = customers.userCustomers
    .map((c) => `<option value="${c.cCompany}">${c.cCompany}</option>`)
    .join("");

  const siteOpts = customers.userCustomers
    .map((c) => `<option value="${c.cSite}">${c.cSite}</option>`)
    .join("");

  const titleOpts = [
    "LOCAL","PO","PM","Service","Training","Inspection",
    "Test & Commissioning","สำรวจหน้างาน","ตรวจเช็คปัญหา",
    "แก้ไขปัญหา","สแตนบาย","เปลี่ยนอุปกรณ์","ติดตั้งอุปกรณ์",
  ].map((t) => `<option value="${t}">${t}</option>`).join("");

  const systemOpts = ["Office","Fire Alarm","CCTV","Access Control","Networks"]
    .map((s) => `<option value="${s}">${s}</option>`).join("");

  const timeOpts = ["1","2","3","4"]
    .map((t) => `<option value="${t}">${t}</option>`).join("");

  const teamOpts = employeeList
    .map((e) => `<option value="${e.fname}">${e.fname}</option>`).join("");

  const html = `
<div id="ae-modal-inner">

  <!-- Header -->
  <div id="ae-header">
    <div id="ae-header-icon">➕</div>
    <div id="ae-header-info">
      <h3>เพิ่มแผนงานใหม่</h3>
      <small>กรอกข้อมูลให้ครบถ้วนแล้วกดบันทึก</small>
    </div>
  </div>

  <!-- Body -->
  <div id="ae-body">

    <!-- date badge -->
    <div class="ae-date-badge">📅 วันที่เลือก: ${displayDate}</div>

    <!-- section 1 -->
    <p class="ae-section-label">ข้อมูลโครงการ</p>
    <div class="ae-grid ae-grid-3">
      <div class="ae-field">
        <label>🏢 ชื่อบริษัท</label>
        <select id="eventCompany"><option selected disabled value="">— เลือกหรือพิมพ์ —</option>${companyOpts}</select>
      </div>
      <div class="ae-field">
        <label><span class="req">*</span> ชื่อโครงการ</label>
        <select id="eventSite"><option selected disabled value="">— เลือกหรือพิมพ์ —</option>${siteOpts}</select>
      </div>
      <div class="ae-field">
        <label><span class="req">*</span> ประเภทงาน</label>
        <select id="eventTitle"><option selected disabled value="">— เลือกหรือพิมพ์ —</option>${titleOpts}</select>
      </div>
    </div>

    <div class="ae-grid ae-grid-3">
      <div class="ae-field">
        <label><span class="req">*</span> ระบบงาน</label>
        <select id="eventSystem"><option selected disabled value="">— เลือกหรือพิมพ์ —</option>${systemOpts}</select>
      </div>
      <div class="ae-field">
        <label>🔢 ครั้งที่</label>
        <select id="eventTime"><option selected disabled value="">— เลือก —</option>${timeOpts}</select>
      </div>
      <div class="ae-field">
        <label>👷 ทีม</label>
        <select id="eventTeam"><option selected disabled value="">— เลือกหรือพิมพ์ —</option>${teamOpts}</select>
      </div>
    </div>

    <hr class="ae-divider">

    <!-- section 2 -->
    <p class="ae-section-label">วันที่ & เวลา</p>

    <label class="ae-checkbox-row">
      <input type="checkbox" id="ae-multiDateToggle">
      🗓️ งานนี้ต้องเข้างานหลายวัน (ไม่ติดกันก็ได้) — ถือเป็นงานเดียวกัน
    </label>

    <div id="ae-singleDateSection">
      <div class="ae-grid ae-grid-2">
        <div class="ae-field">
          <label>📅 วันที่เริ่ม</label>
          <input id="start" type="date" value="${arg.dateStr}">
        </div>
        <div class="ae-field">
          <label>📅 วันที่สิ้นสุด</label>
          <input id="end" type="date" value="${arg.dateStr}">
        </div>
      </div>
    </div>

    <div id="ae-multiDateSection" style="display:none;">
      <div id="ae-multiDateList"></div>
      <button type="button" class="ae-btn ae-btn-ghost" id="ae-addDateBtn" style="margin-bottom:16px;">➕ เพิ่มช่วงวันที่</button>
    </div>

    <div class="ae-grid ae-grid-2">
      <div class="ae-field">
        <label>🕐 เวลาเริ่ม</label>
        <input id="startTime" type="text" placeholder="เช่น 08:30">
      </div>
      <div class="ae-field">
        <label>🕔 เวลาสิ้นสุด</label>
        <input id="endTime" type="text" placeholder="เช่น 17:00">
      </div>
    </div>

    <!-- colors -->
    <div class="ae-color-row">
      <div class="ae-color-item">
        <label>🎨 สีพื้นหลัง</label>
        <input id="backgroundColorPicker" type="color" value="${defaultBackgroundColor}">
      </div>
      <div class="ae-color-item">
        <label>✏️ สีข้อความ</label>
        <input id="textColorPicker" type="color" value="${defaultTextColor}">
      </div>
    </div>

    <!-- hidden fontSize -->
    <input id="fontSize" type="hidden" value="8">

  </div>

  <!-- Action bar (sticky) -->
  <div id="ae-action-bar">
    <div class="ae-btn-spacer"></div>
    <button class="ae-btn ae-btn-ghost" id="ae-btnCancel">ยกเลิก</button>
    <button class="ae-btn ae-btn-success" id="ae-btnConfirm">💾 บันทึกแผนงาน</button>
  </div>

</div>
`;

  Swal.fire({
    html,
    width: "1100px",
    showConfirmButton: false,
    showCancelButton: false,
    showCloseButton: true,
    customClass: { popup: "swal-add-event" },
    // ✅ กันคลิกนอกกล่อง/กด ESC แล้วปิดโดยไม่ตั้งใจ ข้อมูลที่กรอกไว้ทั้งหมดหายหมด
    // ต้องกดปุ่ม "ยกเลิก" หรือปุ่มปิด (✕) อย่างชัดเจนเท่านั้น
    allowOutsideClick: false,
    allowEscapeKey: false,

    didOpen: () => {
      /* TomSelect */
      const mkTs = (id, placeholder = "", maxOptions = 7) => {
        try {
          return new TomSelect(id, {
            create: true,
            maxOptions,
            placeholder,
            sortField: { field: "text", direction: "asc" },
            // ✅ ถ้าไม่ใส่ allowEmptyOption, TomSelect จะทิ้ง <option value="">
            // (placeholder ที่ตั้งใจให้ว่างไว้) แล้วเผลอเลือก option แรกที่มีค่าจริงให้เองอัตโนมัติ
            // ทำให้ "ครั้งที่" กับ "ทีม" มีค่าขึ้นมาเองทั้งที่ไม่ได้เลือก
            allowEmptyOption: true,
          });
        } catch { return null; }
      };

      mkTs("#eventCompany", "เลือกหรือพิมพ์ชื่อบริษัท");
      mkTs("#eventSite",    "เลือกหรือพิมพ์ชื่อโครงการ");
      mkTs("#eventTitle",   "เลือกหรือพิมพ์ประเภทงาน");
      mkTs("#eventSystem",  "เลือกหรือพิมพ์ระบบงาน");
      mkTs("#eventTime",    "เลือกครั้งที่", 4);
      mkTs("#eventTeam",    "เลือกหรือพิมพ์ชื่อทีม");

      /* ── งานเข้าหลายวันไม่ติดกัน (multi-date) ── */
      // ✅ แต่ละแถว = "ช่วงวันที่" หนึ่งช่วง (เริ่ม–สิ้นสุด) เช่น 6-7 และ 9-10
      // เพิ่มได้หลายช่วง แต่ละช่วงถือเป็นงานเดียวกันทั้งหมด (ผูกด้วย jobGroupId เดียวกัน)
      const multiToggle  = document.getElementById("ae-multiDateToggle");
      const singleSection = document.getElementById("ae-singleDateSection");
      const multiSection  = document.getElementById("ae-multiDateSection");
      const multiDateList = document.getElementById("ae-multiDateList");

      const addDateRow = (startValue = "", endValue = "") => {
        const row = document.createElement("div");
        row.className = "ae-multi-date-row";
        row.innerHTML = `
          <input type="date" class="ae-range-start" value="${startValue}">
          <span class="ae-range-sep">–</span>
          <input type="date" class="ae-range-end" value="${endValue || startValue}">
          <button type="button" class="ae-btn ae-btn-ghost ae-multi-date-remove" title="ลบช่วงนี้ออก">✕</button>
        `;
        row.querySelector(".ae-multi-date-remove").addEventListener("click", () => {
          // ต้องเหลืออย่างน้อย 1 แถวเสมอ กันผู้ใช้ลบจนหมด
          if (multiDateList.children.length > 1) row.remove();
        });
        multiDateList.appendChild(row);
      };
      addDateRow(arg.dateStr, arg.dateStr); // แถวแรก prefill ด้วยวันที่ที่คลิกบนปฏิทินมา

      document.getElementById("ae-addDateBtn")?.addEventListener("click", () => addDateRow());

      multiToggle?.addEventListener("change", () => {
        const isMulti = multiToggle.checked;
        singleSection.style.display = isMulti ? "none" : "";
        multiSection.style.display  = isMulti ? "" : "none";
      });

      /* buttons */
      document.getElementById("ae-btnCancel")?.addEventListener("click", () => Swal.close());

      document.getElementById("ae-btnConfirm")?.addEventListener("click", async (clickEvt) => {
        // ✅ กันเผื่อ TomSelect หลุด placeholder text ออกมาเป็นค่าจริงตอนไม่ได้เลือกอะไรเลย
        const PLACEHOLDER = "— เลือกหรือพิมพ์ —";
        const getVal = (id) => {
          const raw = document.getElementById(id)?.value?.trim() || "";
          return raw === PLACEHOLDER ? "" : raw;
        };

        const site   = getVal("eventSite");
        const title  = getVal("eventTitle");
        const system = getVal("eventSystem");

        if (!site)   { Swal.showValidationMessage("กรุณาระบุชื่อโครงการ");  return; }
        if (!title)  { Swal.showValidationMessage("กรุณาระบุประเภทงาน");    return; }
        if (!system) { Swal.showValidationMessage("กรุณาระบุระบบงาน");      return; }

        const isMultiDate = Boolean(multiToggle?.checked);
        let dateRanges = [];

        if (isMultiDate) {
          // ✅ เก็บทุกช่วงวันที่ที่กรอกไว้ (เช่น 6-7 และ 9-10) — แต่ละช่วงเป็นงานเดียวกันทั้งหมด
          const rows = [...document.querySelectorAll(".ae-multi-date-row")];
          for (const row of rows) {
            const s = row.querySelector(".ae-range-start")?.value;
            const e = row.querySelector(".ae-range-end")?.value || s;
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
          // ✅ กันวันที่สิ้นสุดก่อนวันที่เริ่ม (พิมพ์/เลือกผิดได้ง่ายเพราะเป็นช่องแยกกันคนละช่อง)
          const startVal = getVal("start");
          const endVal   = getVal("end");
          if (startVal && endVal && moment(endVal).isBefore(moment(startVal))) {
            Swal.showValidationMessage("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม");
            return;
          }
        }

        // ✅ กันกดซ้ำระหว่างบันทึก + ให้เห็นว่ากำลังทำงานอยู่
        const btn = clickEvt.currentTarget;
        const originalLabel = btn.textContent;
        btn.disabled = true;
        btn.style.opacity = "0.7";
        btn.textContent = "⏳ กำลังบันทึก...";

        try {
          const payload = {
            company:         getVal("eventCompany"),
            site,
            title,
            system,
            time:            getVal("eventTime"),
            team:            getVal("eventTeam"),
            resPerson:       teamToId.get(getVal("eventTeam")) || "",
            backgroundColor: document.getElementById("backgroundColorPicker")?.value,
            textColor:       document.getElementById("textColorPicker")?.value,
            fontSize:        getVal("fontSize") || "8",
            startTime:       getVal("startTime"),
            endTime:         getVal("endTime"),
          };

          // ✅ งานหลายช่วงวันที่ไม่ติดกัน: ส่ง dates[] แทน start/end/date เดี่ยว — backend จะสร้าง
          // record แยกต่อช่วงแต่ผูกกันด้วย jobGroupId เดียวกัน ให้รู้ว่าเป็นงานเดียวกัน
          const newEvent = isMultiDate
            ? {
                ...payload,
                dates: dateRanges.map((r) => ({
                  start: r.start,
                  end:   moment(r.end).add(1, "days").format("YYYY-MM-DD"),
                  date:  r.start,
                })),
              }
            : {
                ...payload,
                start: getVal("start"),
                end:   moment(getVal("end")).add(1, "days").format("YYYY-MM-DD"),
                date:  arg.dateStr,
              };

          /* upsert customer */
          const existing = customers.userCustomers.find(
            (c) => c.cCompany === payload.company && c.cSite === payload.site
          );
          if (!existing) {
            await CustomerService.AddCustomer({
              cCompany: payload.company ?? "",
              cSite:    payload.site    ?? "",
            });
          }

          // ⚠️ เดิม optimistic-add newEvent เข้า state ตรงนี้ก่อน แต่ newEvent ไม่มี id/ _id เลย
          // (ยังไม่ถูกบันทึกจริง) ทำให้ถ้า saveEventToDB ด้านล่างล้มเหลว จะมี event ผีค้างอยู่ใน
          // ปฏิทินโดยไม่มีทางลบออก จนกว่าจะรีเฟรชหน้า — fetchEventsFromDB() หลังบันทึกสำเร็จ
          // ก็ดึงข้อมูลจริงมาแสดงอยู่แล้ว จึงตัด optimistic add ที่ไม่จำเป็นและเสี่ยงนี้ออก
          await saveEventToDB(newEvent);
          setDefaultTextColor(payload.textColor);
          setDefaultBackgroundColor(payload.backgroundColor);
          setDefaultFontSize(payload.fontSize);
          await fetchEventsFromDB();

          Swal.fire({
            title: "บันทึกแผนงานสำเร็จ ✅",
            icon: "success",
            timer: 1200,
            showConfirmButton: false,
          });
        } catch (error) {
          console.error("❌ Error saving event:", error);
          btn.disabled = false;
          btn.style.opacity = "1";
          btn.textContent = originalLabel;
          Swal.showValidationMessage("บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        }
      });
    },
  });
};
