import Toastify from "toastify-js";
import "toastify-js/src/toastify.css";

function injectStyles() {
  const existing = document.getElementById("edit-event-styles");
  if (existing) existing.remove(); // ลบของเก่าทิ้งทุกครั้ง เพื่อให้ style ล่าสุดเสมอ
  const style = document.createElement("style");
  style.id = "edit-event-styles";
  style.textContent = `
    .swal-edit-event.swal2-popup {
      padding: 0 !important;
      border-radius: 16px !important;
      overflow: hidden !important;
      max-height: 95vh !important;
      display: flex !important;
      flex-direction: column !important;
      font-family: 'Inter', system-ui, sans-serif !important;
      box-shadow: 0 25px 60px rgba(10,22,40,.35) !important;
    }
    .swal-edit-event .swal2-html-container {
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      display: flex !important;
      flex-direction: column !important;
      flex: 1 !important;
      min-height: 0 !important;
    }
    .swal-edit-event #ee-modal-inner {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }
    .swal-edit-event .swal2-title  { display: none !important; }
    .swal-edit-event .swal2-actions{ display: none !important; }
    .swal-edit-event .swal2-footer { display: none !important; }
    .swal-edit-event .swal2-close { display: none !important; }

    #ee-close-btn {
      width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
      background: rgba(255,255,255,.18); border: 1.5px solid rgba(255,255,255,.30);
      color: #fff; font-size: 16px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background .15s; line-height: 1;
    }
    #ee-close-btn:hover { background: rgba(255,255,255,.32); }

    /* ── Status header ── */
    #ee-status-header {
      padding: 12px 16px;
      display: flex; align-items: center; gap: 12px;
      transition: background .4s; flex-shrink: 0;
    }
    #ee-status-icon {
      width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0;
      background: rgba(255,255,255,.18); backdrop-filter: blur(4px);
      border: 1.5px solid rgba(255,255,255,.30);
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; line-height: 1;
      box-shadow: 0 2px 8px rgba(0,0,0,.15);
    }
    #ee-status-title { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    #ee-status-title h3 {
      margin: 0; font-size: 15px; font-weight: 700; color: #fff;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      letter-spacing: .01em; text-shadow: 0 1px 3px rgba(0,0,0,.2);
    }
    @media (max-width: 600px) {
      #ee-status-title h3 { text-overflow: unset; }
      #ee-status-title h3 .marquee-track {
        display: inline-block;
        animation: marquee-scroll 12s linear infinite;
        padding-right: 80px;
      }
      #ee-status-title h3:hover .marquee-track { animation-play-state: paused; }
    }
    @media (min-width: 601px) {
      #ee-status-title h3 .marquee-track { display: contents; }
    }
    @keyframes marquee-scroll {
      0%   { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
    #ee-status-title .ee-header-meta {
      display: flex; align-items: center; gap: 5px; flex-wrap: wrap;
    }
    #ee-status-title .ee-tag {
      display: inline-flex; align-items: center; gap: 3px;
      background: rgba(255,255,255,.15); border: 1px solid rgba(255,255,255,.22);
      border-radius: 20px; padding: 1px 8px;
      font-size: 10.5px; font-weight: 600; color: rgba(255,255,255,.92);
      white-space: nowrap;
    }
    /* ── Status bar (ใน body) ── */
    #ee-status-bar {
      display: flex; align-items: center; justify-content: space-between;
      background: #fff; border: 1.5px solid #e2e8f0; border-radius: 10px;
      padding: 8px 14px; margin-bottom: 12px;
      box-shadow: 0 1px 4px rgba(0,0,0,.06);
    }
    #ee-status-bar-left { display: flex; align-items: center; }
    #ee-status-bar-right { display: flex; align-items: center; gap: 8px; }
    .ee-status-bar-label {
      font-size: 11px; font-weight: 700; color: #64748b; white-space: nowrap;
    }
    #ee-status-select-wrap { position: relative; flex-shrink: 0; }
    #ee-status-select-wrap select {
      appearance: none;
      background: #f1f5f9;
      border: 1.5px solid #e2e8f0; color: #1e293b;
      border-radius: 8px; padding: 7px 30px 7px 12px;
      font-size: 12.5px; font-weight: 700; cursor: pointer;
      min-width: 160px;
      transition: border-color .2s, box-shadow .2s;
    }
    #ee-status-select-wrap select:focus {
      outline: none; border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37,99,235,.10);
    }
    #ee-status-select-wrap::after {
      content: "▾"; position: absolute; right: 10px; top: 50%;
      transform: translateY(-50%); color: #64748b; pointer-events: none; font-size: 12px;
    }

    /* ── Body ── */
    #ee-body {
      padding: 14px 20px 10px;
      background: #f8fafc;
      overflow-y: auto;
      flex: 1; min-height: 0;
    }

    /* ── Owner badge ── */
    .ee-owner-badge {
      display: inline-flex; align-items: center; gap: 5px;
      background: #eff6ff; border: 1px solid #bfdbfe;
      color: #1d4ed8; border-radius: 20px; padding: 3px 10px;
      font-size: 11px; font-weight: 600;
    }

    /* ── Section label ── */
    .ee-section-label {
      font-size: 10px; font-weight: 700; letter-spacing: .08em;
      text-transform: uppercase; color: #94a3b8; margin: 0 0 6px;
    }

    /* ── Grid ── */
    .ee-grid   { display: grid; gap: 8px; margin-bottom: 8px; }
    .ee-grid-2 { grid-template-columns: 1fr 1fr; }
    .ee-grid-3 { grid-template-columns: 1fr 1fr 1fr; }
    .ee-grid-4 { grid-template-columns: 1fr 1fr 1fr 1fr; }
    @media(max-width:600px) { .ee-grid-2,.ee-grid-3,.ee-grid-4 { grid-template-columns: 1fr; } }

    /* ── Field ── */
    .ee-field { display: flex; flex-direction: column; gap: 3px; }
    .ee-field label {
      font-size: 11px; font-weight: 600; color: #374151;
      display: flex; align-items: center; gap: 3px;
    }
    .ee-field label .req { color: #ef4444; }
    .ee-field select, .ee-field input, .ee-field textarea {
      width: 100%; box-sizing: border-box;
      border: 1.5px solid #e2e8f0; border-radius: 7px;
      padding: 7px 10px; font-size: 13px; color: #1e293b;
      background: #fff; transition: border-color .15s, box-shadow .15s;
      font-family: inherit;
    }
    .ee-field select:focus, .ee-field input:focus, .ee-field textarea:focus {
      outline: none; border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37,99,235,.10);
    }
    .ee-field textarea { resize: vertical; min-height: 90px; line-height: 1.6; }
    .ee-char-count { font-size: 10px; color: #94a3b8; text-align: right; margin-top: 2px; }

    /* ── Divider ── */
    .ee-divider { border: none; border-top: 1px solid #e2e8f0; margin: 10px 0; }

    /* ── Color inline row ── */
    .ee-color-inline {
      display: flex; gap: 16px; align-items: center; flex-wrap: wrap;
      padding: 8px 0;
    }
    .ee-color-item { display: flex; align-items: center; gap: 6px; }
    .ee-color-item span { font-size: 11px; font-weight: 600; color: #374151; }
    .ee-color-item input[type=color] {
      width: 40px; height: 32px; border: 1.5px solid #e2e8f0;
      border-radius: 7px; cursor: pointer; padding: 2px; background: #fff;
    }

    /* ── Action bar ── */
    #ee-action-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 12px 20px 14px;
      background: #f1f5f9;
      border-top: 1px solid #e2e8f0;
      flex-shrink: 0;
      position: sticky;
      bottom: 0;
      z-index: 10;
    }

    /* กลุ่มปุ่ม */
    .ee-btn-group {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .ee-btn-group-left  { justify-content: flex-start; }
    .ee-btn-group-center { justify-content: center; flex: 1; }
    .ee-btn-group-right { justify-content: flex-end; }

    /* เส้นคั่นระหว่างกลุ่ม */
    .ee-btn-group-center {
      border-left: 1px solid #cbd5e1;
      border-right: 1px solid #cbd5e1;
      padding: 0 12px;
    }

    .ee-btn {
      display: inline-flex; align-items: center; gap: 6px;
      border: none; border-radius: 8px; padding: 9px 16px;
      font-size: 12.5px; font-weight: 700; cursor: pointer;
      transition: opacity .15s, transform .1s; white-space: nowrap;
      font-family: inherit;
    }
    .ee-btn:hover  { opacity: .88; transform: translateY(-1px); }
    .ee-btn:active { transform: translateY(0); }
    .ee-btn-success   { background: #10b981; color: #fff; }
    .ee-btn-info      { background: #0ea5e9; color: #fff; }
    .ee-btn-operation { background: linear-gradient(135deg,#7c3aed,#4f46e5); color: #fff; }
    .ee-btn-danger    { background: #ef4444; color: #fff; }
    .ee-btn-ghost     { background: #e2e8f0; color: #475569; }

    @media(max-width:640px) {
      #ee-action-bar { flex-direction: column; gap: 8px; }
      .ee-btn-group  { width: 100%; justify-content: center; }
      .ee-btn-group-center { border: none; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; padding: 8px 0; }
    }

    /* ── TomSelect override ── */
    .swal-edit-event .ts-wrapper { width: 100%; }
    .swal-edit-event .ts-wrapper .ts-control {
      border: 1.5px solid #e2e8f0 !important; border-radius: 7px !important;
      padding: 6px 10px !important; font-size: 13px !important; min-height: 36px;
      box-shadow: none !important;
    }
    .swal-edit-event .ts-wrapper.focus .ts-control {
      border-color: #2563eb !important;
      box-shadow: 0 0 0 3px rgba(37,99,235,.10) !important;
    }
  `;
  document.head.appendChild(style);
}

const STATUS_CONFIG = {
  กำลังรอยืนยัน: { bg: "linear-gradient(135deg,#475569,#64748b)", icon: "⏳" },
  ยืนยันแล้ว: { bg: "linear-gradient(135deg,#1d4ed8,#2563eb)", icon: "✅" },
  // "กำลังดำเนินการ":     { bg: "linear-gradient(135deg,#92400e,#d97706)", icon: "🔄" },
  // "ดำเนินการเสร็จสิ้น": { bg: "linear-gradient(135deg,#065f46,#10b981)", icon: "🎉" },
};

export const getEditEvent = async ({
  navigate,
  setEvents,
  fetchEventsFromDB,
  eventInfo,
  setLoading,
  generateWorkPermitPDF,
  handleDeleteEvent,
  EventService,
  CustomerService,
  AuthService,
  Swal,
  TomSelect,
  moment,
  calendarRef,
  Choices,
  userData,
}) => {
  injectStyles();

  const ev = eventInfo.event;
  const eventId = ev.id;
  const eventTitle = ev.title;
  const evendocNo = ev.extendedProps?.docNo || "";
  const eventCompany = ev.extendedProps?.company || "";
  const eventSite = ev.extendedProps?.site || "";
  const eventSystem = ev.extendedProps?.system || "";
  const eventTeam = ev.extendedProps?.team || "";
  const eventTime = ev.extendedProps?.time || "";
  const eventFontSize = ev.extendedProps?.fontSize;
  const eventStart = moment(ev.start);
  const eventEnd = moment(ev.end);
  const eventAllDay = ev.allDay;
  const eventStatus = ev.extendedProps?.status || "กำลังรอยืนยัน";
  const eventSubject = ev.extendedProps?.subject || "";
  const eventDescription = ev.extendedProps?.description || "";
  const eventStartTime = ev.extendedProps?.startTime || "";
  const eventEndTime = ev.extendedProps?.endTime || "";
  const userId = ev.extendedProps?.userId;

  const formattedEnd = eventAllDay
    ? moment(eventEnd).subtract(1, "days").format("YYYY-MM-DD")
    : moment(eventEnd).format("YYYY-MM-DD");

  const res = await CustomerService.getCustomers();
  const employees = await AuthService.getAllUserData();
  const employeeList = employees?.allUser || [];
  // ใช้ผูก resPerson (ID จริง) จากชื่อที่เลือกใน dropdown ทีม
  // เพื่อให้ technician มองเห็น/จัดการงานของตัวเองในหน้า Operation ได้ถูกต้อง
  const teamToId = new Map(employeeList.map((e) => [e.fname, e._id]));

  const eventOwner = employeeList.find(
    (e) => e?._id?.toString() === userId?.toString(),
  );
  const footerName =
    eventOwner?.username ||
    (eventOwner
      ? `${eventOwner.fname} ${eventOwner.lname}`
      : "ไม่ทราบผู้เพิ่ม");

  const inputBg = Object.assign(document.createElement("input"), {
    type: "color",
    value: ev.backgroundColor || "#3b82f6",
  });
  const inputText = Object.assign(document.createElement("input"), {
    type: "color",
    value: ev.textColor || "#ffffff",
  });

  const statusOptions = Object.keys(STATUS_CONFIG)
    .map(
      (s) =>
        `<option value="${s}" ${eventStatus === s ? "selected" : ""}>${s}</option>`,
    )
    .join("");

  const custOpt = (field) =>
    res.userCustomers
      .map((c) => {
        const val = field === "company" ? c.cCompany : c.cSite;
        const current = field === "company" ? eventCompany : eventSite;
        return `<option value="${val}" ${current === val ? "selected" : ""}>${val}</option>`;
      })
      .join("");

  const titleOpts = [
    "LOCAL",
    "PO",
    "PM",
    "Service",
    "Training",
    "Inspection",
    "Test & Commissioning",
    "สำรวจหน้างาน",
    "ตรวจเช็คปัญหา",
    "แก้ไขปัญหา",
    "สแตนบาย",
    "เปลี่ยนอุปกรณ์",
    "ติดตั้งอุปกรณ์",
  ]
    .map(
      (t) =>
        `<option value="${t}" ${eventTitle === t ? "selected" : ""}>${t}</option>`,
    )
    .join("");

  const systemOpts = [
    "Office",
    "Fire Alarm",
    "CCTV",
    "Access Control",
    "Networks",
  ]
    .map(
      (s) =>
        `<option value="${s}" ${eventSystem === s ? "selected" : ""}>${s}</option>`,
    )
    .join("");

  const timeOpts = ["1", "2", "3", "4"]
    .map(
      (t) =>
        `<option value="${t}" ${eventTime === t ? "selected" : ""}>${t}</option>`,
    )
    .join("");

  const teamOpts = employeeList
    .map(
      (e) =>
        `<option value="${e.fname}" ${eventTeam === e.fname ? "selected" : ""}>${e.fname}</option>`,
    )
    .join("");

  const cfg0 = STATUS_CONFIG[eventStatus] || STATUS_CONFIG["กำลังรอยืนยัน"];

  const html = `
<div id="ee-modal-inner">

  <!-- ── Header ── -->
  <div id="ee-status-header" style="background:${cfg0.bg}">
    <div id="ee-status-icon">${cfg0.icon}</div>
    <div id="ee-status-title">
      <h3><span >${eventTitle} · ${eventSystem} ${eventTime ? `· ครั้งที่ ${eventTime}` : ""}</span></h3>
      <div class="ee-header-meta">
        <span class="ee-tag">📍 ${eventSite || "—"}</span>
        ${eventTeam ? `<span class="ee-tag">👷 ${eventTeam}</span>` : ""}
      </div>
    </div>
    <button id="ee-close-btn" title="ปิด">✕</button>
  </div>

  <!-- ── Body ── -->
  <div id="ee-body">

    <!-- Status bar -->
    <div id="ee-status-bar">
      <div id="ee-status-bar-left">
        <div class="ee-owner-badge">👤 ${footerName}</div>
      </div>
      <div id="ee-status-bar-right">
        <span class="ee-status-bar-label">🔖 สถานะ</span>
        <div id="ee-status-select-wrap">
          <select id="editStatus">${statusOptions}</select>
        </div>
      </div>
    </div>

    <!-- section: โครงการ -->
    <p class="ee-section-label">ข้อมูลโครงการ</p>
    <div class="ee-grid ee-grid-3">
      <div class="ee-field">
        <label>🏢 ชื่อบริษัท</label>
        <select id="editCompany"><option disabled>${eventCompany || "—"}</option>${custOpt("company")}</select>
      </div>
      <div class="ee-field">
        <label><span class="req">*</span> ชื่อโครงการ</label>
        <select id="editSite"><option disabled>${eventSite || "—"}</option>${custOpt("site")}</select>
      </div>
      <div class="ee-field">
        <label><span class="req">*</span> ประเภทงาน</label>
        <select id="editTitle"><option disabled>${eventTitle || "—"}</option>${titleOpts}</select>
      </div>
    </div>
    <div class="ee-grid ee-grid-3">
      <div class="ee-field">
        <label><span class="req">*</span> ระบบงาน</label>
        <select id="editSystem"><option disabled>${eventSystem || "—"}</option>${systemOpts}</select>
      </div>
      <div class="ee-field">
        <label>🔢 ครั้งที่</label>
        <select id="editTime"><option disabled>${eventTime || "—"}</option>${timeOpts}</select>
      </div>
      <div class="ee-field">
        <label>👷 ทีม</label>
        <select id="editTeam"><option disabled>${eventTeam || "—"}</option>${teamOpts}</select>
      </div>
    </div>

    <hr class="ee-divider">

    <!-- section: วันที่ เวลา สี — แถวเดียวกัน 4 คอลัมน์ -->
    <p class="ee-section-label">วันที่ & เวลา</p>
    <div class="ee-grid ee-grid-4">
      <div class="ee-field">
        <label>📅 วันที่เริ่ม</label>
        <input id="editStart" type="date" value="${eventStart.format("YYYY-MM-DD")}">
      </div>
      <div class="ee-field">
        <label>📅 วันที่สิ้นสุด</label>
        <input id="editEnd" type="date" value="${formattedEnd}">
      </div>
      <div class="ee-field">
        <label>🕐 เวลาเริ่ม</label>
        <input id="editStartTime" type="text" placeholder="เช่น 08:30" value="${eventStartTime}">
      </div>
      <div class="ee-field">
        <label>🕔 เวลาสิ้นสุด</label>
        <input id="editEndTime" type="text" placeholder="เช่น 17:00" value="${eventEndTime}">
      </div>
    </div>

    <!-- สี — inline กับส่วนบน -->
    <div class="ee-color-inline">
      <div class="ee-color-item">
        <span>🎨 สีพื้นหลัง</span>
        <div id="ee-bg-picker"></div>
      </div>
      <div class="ee-color-item">
        <span>✏️ สีข้อความ</span>
        <div id="ee-txt-picker"></div>
      </div>
    </div>

    <hr class="ee-divider">

    <!-- section: เอกสาร -->
    <p class="ee-section-label">เอกสาร</p>
    <div class="ee-grid ee-grid-2">
      <div class="ee-field">
        <label>📄 เลขที่อ้างอิง (Doc No.)</label>
        <input id="editdocNo" type="text" value="${evendocNo}" placeholder="เช่น DOC-2026-001">
      </div>
      <div class="ee-field">
        <label>📝 ชื่อเรื่อง (Subject)</label>
        <input id="editSubject" type="text" value="${eventSubject}" placeholder="ระบุชื่อเรื่อง">
      </div>
    </div>
    <div class="ee-field">
      <label>📋 รายละเอียดงาน (Description)</label>
      <textarea id="editDescription" placeholder="กรอกรายละเอียดงาน..."></textarea>
      <div class="ee-char-count" id="charCount">0 ตัวอักษร</div>
    </div>

  </div>

  <!-- ── Action bar (แยก 3 กลุ่มชัดเจน) ── -->
  <div id="ee-action-bar">

    <!-- 🔴 ซ้าย: อันตราย -->
    <div class="ee-btn-group ee-btn-group-left">
      <button class="ee-btn ee-btn-danger" id="btnDelete">🗑 ลบแผนงาน</button>
    </div>

    <!-- 🔵 กลาง: นำทาง & เอกสาร -->
    <div class="ee-btn-group ee-btn-group-center">
      <button class="ee-btn ee-btn-operation" id="btnViewSchedule">📊 ดูการดำเนินงาน</button>
      <button class="ee-btn ee-btn-info"      id="btnGeneratePDF">📄 ออกใบแจ้งเข้างาน</button>
    </div>

    <!-- 🟢 ขวา: ยืนยัน -->
    <div class="ee-btn-group ee-btn-group-right">
      <button class="ee-btn ee-btn-ghost"   id="btnCancel">✕ ปิด</button>
      <button class="ee-btn ee-btn-success" id="btnConfirm">💾 บันทึก</button>
    </div>

  </div>

</div>
`;

  Swal.fire({
    html,
    width: "1100px",
    showConfirmButton: false,
    showCancelButton: false,
    showCloseButton: false,
    customClass: { popup: "swal-edit-event" },

    didOpen: () => {
      /* color pickers */
      Object.assign(inputBg.style, {
        width: "40px",
        height: "32px",
        border: "1.5px solid #e2e8f0",
        borderRadius: "7px",
        cursor: "pointer",
        padding: "2px",
      });
      Object.assign(inputText.style, {
        width: "40px",
        height: "32px",
        border: "1.5px solid #e2e8f0",
        borderRadius: "7px",
        cursor: "pointer",
        padding: "2px",
      });
      document.getElementById("ee-bg-picker").appendChild(inputBg);
      document.getElementById("ee-txt-picker").appendChild(inputText);

      /* description */
      const descEl = document.getElementById("editDescription");
      const countEl = document.getElementById("charCount");
      if (descEl) {
        descEl.value = eventDescription || "";
        const upd = () => {
          if (countEl) countEl.textContent = `${descEl.value.length} ตัวอักษร`;
        };
        descEl.addEventListener("input", upd);
        upd();
      }

      /* status header reactive */
      const statusSel = document.getElementById("editStatus");
      const headerEl = document.getElementById("ee-status-header");
      const iconEl = document.getElementById("ee-status-icon");
      statusSel?.addEventListener("change", (e) => {
        const cfg =
          STATUS_CONFIG[e.target.value] || STATUS_CONFIG["กำลังรอยืนยัน"];
        headerEl.style.background = cfg.bg;
        iconEl.innerHTML = cfg.icon;
      });

      /* TomSelect */
      const mkTs = (id) => {
        try {
          return new TomSelect(id, {
            create: true,
            persist: false,
            closeAfterSelect: true,
            selectOnTab: true,
            plugins: ["remove_button"],
            onItemAdd() {
              if (this.items.length > 1) this.removeItem(this.items[0], true);
            },
          });
        } catch {
          return null;
        }
      };
      [
        "#editCompany",
        "#editSite",
        "#editTitle",
        "#editSystem",
        "#editTime",
        "#editTeam",
      ].forEach(mkTs);

      const getVal = (id) => document.getElementById(id)?.value?.trim() || "";

      const buildPayload = () => {
        const endInput = getVal("editEnd");
        const end = endInput
          ? eventAllDay
            ? moment(endInput).add(1, "days").toISOString()
            : moment(endInput).toISOString()
          : eventEnd.toISOString();
        return {
          id: eventId,
          docNo: getVal("editdocNo"),
          company: getVal("editCompany"),
          site: getVal("editSite"),
          title: getVal("editTitle"),
          system: getVal("editSystem"),
          time: getVal("editTime"),
          team: getVal("editTeam"),
          resPerson: teamToId.get(getVal("editTeam")) || "",
          textColor: inputText.value,
          backgroundColor: inputBg.value,
          fontSize: eventFontSize,
          status: getVal("editStatus"),
          start: moment(getVal("editStart")).toISOString(),
          end,
          manualStatus: true,
          subject: getVal("editSubject"),
          description: getVal("editDescription"),
          startTime: getVal("editStartTime"),
          endTime: getVal("editEndTime"),
        };
      };

      /* Save */
      document
        .getElementById("btnConfirm")
        ?.addEventListener("click", async () => {
          const payload = buildPayload();
          if (!payload.title) {
            Swal.showValidationMessage("กรุณาระบุประเภทงาน");
            return;
          }
          if (!payload.site) {
            Swal.showValidationMessage("กรุณาระบุชื่อโครงการ");
            return;
          }
          if (!payload.system) {
            Swal.showValidationMessage("กรุณาระบบงาน");
            return;
          }
          setLoading(true);
          try {
            await EventService.UpdateEvent(eventId, payload);
            setLoading(false);
            Swal.fire({
              title: "บันทึกสำเร็จ ✅",
              icon: "success",
              timer: 1200,
              showConfirmButton: false,
            });
            // if (payload.status === "ยืนยันแล้ว") {
            //   setTimeout(() => navigate(`/operation/${eventId}`), 1300);
            // }
            await fetchEventsFromDB();
          } catch (err) {
            setLoading(false);
            Swal.fire({
              title: "เกิดข้อผิดพลาด",
              text: err.message,
              icon: "error",
            });
          }
        });

      /* Delete */
      document.getElementById("btnDelete")?.addEventListener("click", () => {
        Swal.fire({
          title: "ลบแผนงานนี้?",
          text: "ไม่สามารถกู้คืนได้",
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: "#ef4444",
          confirmButtonText: "ลบ",
          cancelButtonText: "ยกเลิก",
        }).then((r) => {
          if (r.isConfirmed) {
            handleDeleteEvent(eventId);
            Swal.close();
          }
        });
      });

      /* View operation */
      document
        .getElementById("btnViewSchedule")
        ?.addEventListener("click", () => {
          navigate(`/operation/${eventId}`);
          Swal.close();
        });

      /* Cancel / custom close */
      document
        .getElementById("btnCancel")
        ?.addEventListener("click", () => Swal.close());
      document
        .getElementById("ee-close-btn")
        ?.addEventListener("click", () => Swal.close());

      /* Generate PDF */
      document
        .getElementById("btnGeneratePDF")
        ?.addEventListener("click", () => {
          const payload = buildPayload();
          const toast = Toastify({
            text: `<div style="text-align:center;font-family:system-ui">
            <div style="margin-bottom:8px;font-weight:600">บันทึกข้อมูลก่อนออกใบแจ้งเข้างาน?</div>
            <button id="toast-ok" style="margin-right:8px;padding:5px 14px;background:#fff;color:#1d4ed8;border:none;border-radius:6px;font-weight:700;cursor:pointer">ตกลง</button>
            <button id="toast-no" style="padding:5px 14px;background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:6px;cursor:pointer">ยกเลิก</button>
          </div>`,
            duration: 5000,
            gravity: "top",
            position: "center",
            backgroundColor: "#1d4ed8",
            escapeMarkup: false,
          });
          toast.showToast();
          setTimeout(() => {
            document
              .getElementById("toast-ok")
              ?.addEventListener("click", async () => {
                toast.hideToast();
                if (!payload.subject) {
                  Toastify({
                    text: "กรุณากรอกชื่อเรื่อง",
                    duration: 3000,
                    backgroundColor: "#ef4444",
                    gravity: "top",
                    position: "center",
                  }).showToast();
                  return;
                }
                try {
                  await EventService.UpdateEvent(eventId, payload);
                  await fetchEventsFromDB();
                  Toastify({
                    text: "✅ บันทึกแล้ว กำลังสร้าง PDF...",
                    duration: 2000,
                    backgroundColor: "#10b981",
                    gravity: "top",
                    position: "center",
                  }).showToast();
                  await generateWorkPermitPDF(
                    ev,
                    payload.docNo,
                    payload.subject,
                    payload.description,
                  );
                } catch {
                  Toastify({
                    text: "❌ เกิดข้อผิดพลาด",
                    duration: 3000,
                    backgroundColor: "#ef4444",
                    gravity: "top",
                    position: "center",
                  }).showToast();
                }
              });
            document
              .getElementById("toast-no")
              ?.addEventListener("click", () => toast.hideToast());
          }, 100);
        });
    },
  });
};
