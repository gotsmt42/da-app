import { countUsedRounds } from "../../../utils/contractRounds";

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

    /* ── สัญญาแบบหลายครั้ง ── */
    .ae-contract-box {
      background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 10px;
      padding: 14px 16px 4px; margin-bottom: 16px;
    }

    /* ── ขั้นตอนที่ 1: เลือกประเภทงาน (การ์ดวิทยุ) ── */
    .ae-jobtype-toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 18px; }
    @media(max-width:600px) { .ae-jobtype-toggle { grid-template-columns: 1fr; } }
    .ae-jobtype-option { position: relative; cursor: pointer; }
    .ae-jobtype-option input { position: absolute; opacity: 0; width: 0; height: 0; }
    .ae-jobtype-card {
      display: flex; align-items: center; gap: 10px;
      border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 12px 14px;
      background: #fff; transition: border-color .15s, background .15s;
    }
    .ae-jobtype-icon { font-size: 22px; line-height: 1; }
    .ae-jobtype-title { font-size: 13px; font-weight: 700; color: #1e293b; }
    .ae-jobtype-desc { font-size: 11px; color: #64748b; }
    .ae-jobtype-option input:checked + .ae-jobtype-card {
      border-color: #dc2626; background: #fef2f2;
    }
    .ae-jobtype-option input:checked + .ae-jobtype-card .ae-jobtype-title { color: #b91c1c; }
    .ae-jobtype-option input:disabled + .ae-jobtype-card {
      opacity: .5; cursor: not-allowed;
    }
    .ae-jobtype-note {
      font-size: 11px; color: #b91c1c; margin: -12px 0 16px; display: none;
    }

    /* ── เลือกสัญญาที่มีอยู่แล้ว (โหมด "งานตามสัญญา") ── */
    .ae-contract-pick-info {
      background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 10px;
      padding: 12px 14px; margin-bottom: 16px; font-size: 13px; color: #374151; display: none;
    }
    .ae-contract-pick-info b { color: #b91c1c; }
    .ae-contract-pick-info .ae-cpi-sub { font-size: 12px; color: #64748b; margin-top: 2px; }

    /* ── ตาราง "เลือกครั้งที่" — สถานะรายครั้งตรงกับตาราง ContractOverview.js เป๊ะๆ ── */
    .ae-round-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    .ae-round-chip {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 42px; height: 32px; padding: 0 10px; border-radius: 8px;
      font-size: 12px; font-weight: 700; border: 1.5px solid #e2e8f0;
      background: #fff; color: #64748b; font-family: inherit;
    }
    button.ae-round-chip--open {
      cursor: pointer; color: #1e293b; transition: border-color .15s, background .15s;
    }
    button.ae-round-chip--open:hover { border-color: #dc2626; }
    .ae-round-chip--selected {
      border-color: #dc2626 !important; background: #fef2f2 !important; color: #b91c1c !important;
    }
    .ae-round-chip--scheduled { border-color: #bbf7d0; background: #f0fdf4; color: #15803d; cursor: not-allowed; }
    .ae-round-chip--pending { border-color: #fde68a; background: #fffbeb; color: #b45309; cursor: not-allowed; }

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

    /* ── ลูกทีมเพิ่มเติม (คนที่ 2, 3, ... แสดงผลอย่างเดียว ไม่กระทบสิทธิ์) ── */
    .ae-team-member-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
    .ae-team-member-row select {
      flex: 1; box-sizing: border-box;
      border: 1.5px solid #e2e8f0; border-radius: 8px;
      padding: 9px 12px; font-size: 14px; color: #1e293b;
      background: #fff; font-family: inherit;
    }
    .ae-team-member-row select:focus {
      outline: none; border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37,99,235,.12);
    }
    .ae-team-member-remove {
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

// ✅ กันบันทึกซ้ำแบบ module-level (ไม่ผูกกับ closure ของ didOpen แต่ละครั้ง) — เคยพบว่ากด
// เพิ่มแผนงานทีเดียว แต่โครงการ/ประเภทงาน/ระบบ ไปลงตารางซ้ำ 2 แถว ต้นเหตุที่เป็นไปได้คือ
// dateClick ของ FullCalendar ยิงซ้ำ (พบได้บนอุปกรณ์ทัชสกรีนบางรุ่น) ทำให้ didOpen รันซ้ำ และ
// ปุ่มยืนยันมี listener ซ้อนกันสองตัว คลิกครั้งเดียวจึงทำงานสองรอบ — ตัวแปรนี้อยู่นอกฟังก์ชัน
// จึงกันได้แม้ listener จะถูก attach ซ้ำกี่ตัวก็ตาม (ต่างจาก flag ที่ผูกกับ closure ของแต่ละ
// didOpen ซึ่งจะมีคนละตัวแปรกันถ้า didOpen รันซ้ำจริง ป้องกันไม่ได้)
let isSavingEvent = false;

/* ─────────────────────────────────────────────
   MAIN EXPORT
───────────────────────────────────────────── */
export const getAddEvent = async ({
  arg,
  events,
  drafts, // ✅ แผนงานล่วงหน้าที่ค้างอยู่ — อาจจองครั้งที่ของสัญญาไปแล้วเหมือนกัน ต้องรวมมานับด้วย
  defaultTextColor,
  defaultBackgroundColor,
  setDefaultTextColor,
  setDefaultBackgroundColor,
  setDefaultFontSize,
  saveEventToDB,
  fetchEventsFromDB,
  fetchLookupOptions,
  CustomerService,
  AuthService,
  JobTypeService,
  SystemTypeService,
  Swal,
  TomSelect,
  moment,
}) => {
  injectAddStyles();

  // ✅ ขั้นตอนที่ 1 ของฟอร์ม (งานทั่วไป/งานตามสัญญา) ต้องรู้ว่าตอนนี้มีสัญญาอะไรอยู่แล้วบ้าง เพื่อให้
  // เลือกได้เฉพาะจากรายการนี้เท่านั้น (พิมพ์เพิ่มเองไม่ได้) กันพิมพ์ชื่อบริษัท/โครงการเพี้ยนจากของเดิม
  // แม้แค่ตัวเดียวก็ทำให้กลายเป็นคนละสัญญาไปเลย — group จาก events (ที่ลงตารางแล้ว) รวมกับ drafts
  // (แผนงานล่วงหน้าที่ค้างอยู่ ซึ่งอาจจองครั้งที่ไปแล้วเหมือนกัน) ตาม contractGroupId เทียบ pattern
  // เดียวกับ `contracts` ใน ContractOverview.js — เก็บ visits ดิบไว้ทั้งก้อนด้วย เพื่อใช้ตัดสิน
  // สถานะรายครั้ง (ลงตารางแล้ว/รอวางแผน/ว่าง) ในตาราง "เลือกครั้งที่" ด้านล่าง ไม่ใช่แค่นับจำนวนเฉยๆ
  const contractMap = new Map();
  [...(events || []), ...(drafts || [])].forEach((e) => {
    if (!e.contractGroupId) return;
    if (!contractMap.has(e.contractGroupId)) {
      contractMap.set(e.contractGroupId, {
        key: e.contractGroupId,
        company: e.company || "",
        site: e.site || "",
        system: e.system || "",
        title: e.title || "",
        contractNo: e.contractNo || "",
        quotationNo: e.quotationNo || "",
        contractStart: e.contractStart || "",
        contractEnd: e.contractEnd || "",
        visitCount: e.visitCount || 0,
        jobValue: e.jobValue,
        team: e.team || "",
        visits: [],
      });
    }
    contractMap.get(e.contractGroupId).visits.push(e);
  });
  // ✅ นับจาก "จำนวนครั้งที่ไม่ซ้ำกัน" (countUsedRounds) ไม่ใช่นับจำนวน document ดิบ — ครั้งที่เข้างาน
  // ไม่ต่อเนื่อง (เว้นช่วงแล้วกลับมาเข้าอีก) จะมีหลาย document ต่อ 1 ครั้ง นับตรงๆ จะเกินจริง
  contractMap.forEach((c) => {
    c.usedVisits = countUsedRounds(c.visits);
  });
  const contractList = [...contractMap.values()].sort((a, b) =>
    (a.company || "").localeCompare(b.company || "", "th") || (a.site || "").localeCompare(b.site || "", "th")
  );
  // ✅ สัญญาที่ครบจำนวนครั้งแล้ว (usedVisits >= visitCount) เลือกไม่ได้อยู่แล้ว (backend บล็อก) —
  // ไม่ต้องเอามาโชว์ในรายการเลือกให้รกตา ตัดออกตั้งแต่ตอนสร้างตัวเลือกเลย ไม่ใช่แค่ปิด disabled ไว้
  const selectableContracts = contractList.filter((c) => c.usedVisits < c.visitCount);
  // ✅ แสดงชื่อบริษัท/โครงการแบบตัดส่วนที่ไม่มีข้อมูลออก แทนที่จะขึ้น "-" ค้างไว้ให้ดูเหมือนข้อมูลพัง
  // (เช่น สัญญาที่ไม่เคยกรอกชื่อบริษัทไว้ เดิมจะโชว์ "- · Centara Grand Mirage" ดูแปลกๆ)
  const contractDisplayName = (c) => [c.company, c.site].filter(Boolean).join(" · ") || "(ไม่ระบุชื่อ)";

  // ✅ เดิม titleOpts/systemOpts เป็น array ฝังโค้ดตายตัว แก้ไขเองไม่ได้นอกจากแก้โค้ด —
  // ดึงจากตาราง "ประเภทงาน"/"ระบบ" ที่จัดการได้จริงผ่านหน้า /worktype (Settings) แทน
  const [customers, employees, jobTypes, systemTypes] = await Promise.all([
    CustomerService.getCustomers(),
    AuthService.getAllUserData(),
    JobTypeService.getAll(),
    SystemTypeService.getAll(),
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

  const titleOpts = (jobTypes?.items || [])
    .map((t) => `<option value="${t.name}">${t.name}</option>`).join("");

  const systemOpts = (systemTypes?.items || [])
    .map((s) => `<option value="${s.name}">${s.name}</option>`).join("");

  const timeOpts = ["1","2","3","4"]
    .map((t) => `<option value="${t}">${t}</option>`).join("");

  const teamOpts = employeeList
    .map((e) => `<option value="${e.fname}">${e.fname}</option>`).join("");

  // ✅ ตัวเลือกสัญญาที่มีอยู่แล้ว — ให้เลือกได้เท่านั้น พิมพ์เพิ่มเองไม่ได้ (ต่างจากช่องอื่นในฟอร์มนี้ที่
  // เปิด create:true ไว้) กันบริษัท/โครงการ/เลขที่สัญญาเพี้ยนจากของเดิมแม้แค่ตัวเดียว ซึ่งจะทำให้
  // กลายเป็นคนละสัญญาไปเลยในระบบ — เอาเฉพาะสัญญาที่ยังเลือกได้จริง (selectableContracts ตัดสัญญา
  // ที่ครบจำนวนครั้งแล้วออกไปแล้ว) ไม่ต้องกันด้วย disabled อีกชั้นเพราะไม่มีตัวไหนครบแล้วหลงเหลืออยู่
  const contractOpts = selectableContracts
    .map((c) => {
      const label = `${contractDisplayName(c)} · ${c.title} (${c.contractNo || "ไม่มีเลขที่"})`;
      return `<option value="${c.key}">${label}</option>`;
    })
    .join("");

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

    <!-- ขั้นตอนที่ 1: เลือกประเภทงาน -->
    <p class="ae-section-label">ขั้นตอนที่ 1 — ประเภทงาน</p>
    <div class="ae-jobtype-toggle">
      <label class="ae-jobtype-option">
        <input type="radio" name="ae-jobType" id="ae-jobTypeGeneral" value="general" checked>
        <div class="ae-jobtype-card">
          <div class="ae-jobtype-icon">📌</div>
          <div>
            <div class="ae-jobtype-title">งานทั่วไป</div>
            <div class="ae-jobtype-desc">งานครั้งเดียว ไม่ผูกกับสัญญา</div>
          </div>
        </div>
      </label>
      <label class="ae-jobtype-option">
        <input type="radio" name="ae-jobType" id="ae-jobTypeContract" value="contract" ${selectableContracts.length === 0 ? "disabled" : ""}>
        <div class="ae-jobtype-card">
          <div class="ae-jobtype-icon">🔁</div>
          <div>
            <div class="ae-jobtype-title">งานตามสัญญา</div>
            <div class="ae-jobtype-desc">เพิ่มครั้งถัดไปของสัญญาที่มีอยู่แล้ว</div>
          </div>
        </div>
      </label>
    </div>
    ${selectableContracts.length === 0
      ? `<p class="ae-jobtype-note" style="display:block;">${
          contractList.length === 0
            ? `ยังไม่มีสัญญาในระบบ — สร้างสัญญาใหม่ได้ที่หน้า "ภาพรวมสัญญา" ก่อน`
            : `สัญญาที่มีอยู่ครบจำนวนครั้งหมดแล้ว — สร้างสัญญาใหม่ได้ที่หน้า "ภาพรวมสัญญา"`
        }</p>`
      : ""}

    <!-- โหมด "งานทั่วไป" -->
    <div id="ae-generalSection">
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

      <!-- ✅ ลูกทีมเพิ่มเติม (คนที่ 2, 3, ...) — แสดงผลอย่างเดียวว่าใครช่วยทำงานนี้บ้าง
           ไม่กระทบสิทธิ์แก้ไข/แจ้งเตือน/นับงานค้าง ซึ่งยังผูกกับ "ทีม" (ช่างหลัก) ด้านบนเหมือนเดิม -->
      <div class="ae-field" style="margin-bottom:16px;">
        <label>👥 ลูกทีมเพิ่มเติม (ถ้ามี)</label>
        <div id="ae-teamMembersList"></div>
        <button type="button" class="ae-btn ae-btn-ghost" id="ae-addTeamMemberBtn" style="margin-top:2px;">➕ เพิ่มลูกทีม</button>
      </div>

      <hr class="ae-divider">

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
    </div>

    <!-- โหมด "งานตามสัญญา" -->
    <div id="ae-contractPickSection" style="display:none;">
      <p class="ae-section-label">ขั้นตอนที่ 2 — เลือกสัญญา</p>
      <div class="ae-field" style="margin-bottom:16px;">
        <label><span class="req">*</span> เลือกสัญญา</label>
        <select id="ae-contractPick"><option value="" selected disabled>— เลือกสัญญา —</option>${contractOpts}</select>
      </div>

      <div class="ae-contract-pick-info" id="ae-contractPickInfo"></div>

      <p class="ae-section-label">ขั้นตอนที่ 3 — เลือกครั้งที่จะลงวันที่</p>
      <div class="ae-round-grid" id="ae-roundGrid"></div>
      <input type="hidden" id="ae-selectedRound" value="">

      <p class="ae-section-label">ขั้นตอนที่ 4 — วันที่เข้างาน</p>
      <div class="ae-grid ae-grid-2">
        <div class="ae-field">
          <label><span class="req">*</span> วันที่เริ่ม</label>
          <input id="ae-cpStart" type="date" value="${arg.dateStr}">
        </div>
        <div class="ae-field">
          <label>วันที่สิ้นสุด</label>
          <input id="ae-cpEnd" type="date" value="${arg.dateStr}">
        </div>
      </div>
      <div class="ae-field" style="margin-bottom:16px;">
        <label>👷 ผู้รับผิดชอบ</label>
        <select id="ae-cpTeam"><option value="">— เลือกหรือพิมพ์ —</option>${teamOpts}</select>
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

      /* ── ลูกทีมเพิ่มเติม (คนที่ 2, 3, ... แสดงผลอย่างเดียว ไม่กระทบสิทธิ์แก้ไข/แจ้งเตือน) ── */
      const teamMembersList = document.getElementById("ae-teamMembersList");
      const addTeamMemberRow = () => {
        const row = document.createElement("div");
        row.className = "ae-team-member-row";
        row.innerHTML = `
          <select class="ae-team-member-select"><option value="">— เลือกลูกทีม —</option>${teamOpts}</select>
          <button type="button" class="ae-btn ae-btn-ghost ae-team-member-remove" title="ลบออก">✕</button>
        `;
        row.querySelector(".ae-team-member-remove").addEventListener("click", () => row.remove());
        teamMembersList.appendChild(row);
      };
      document.getElementById("ae-addTeamMemberBtn")?.addEventListener("click", () => addTeamMemberRow());

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

      /* ── ขั้นตอนที่ 1: งานทั่วไป vs งานตามสัญญา — สลับ section ทั้งก้อน ไม่ใช่แค่ box ย่อยแบบเดิม ── */
      const generalSection     = document.getElementById("ae-generalSection");
      const contractPickSection = document.getElementById("ae-contractPickSection");
      const jobTypeRadios = [...document.querySelectorAll('input[name="ae-jobType"]')];
      jobTypeRadios.forEach((radio) => {
        radio.addEventListener("change", () => {
          const isContract = radio.value === "contract" && radio.checked;
          if (!radio.checked) return;
          generalSection.style.display = isContract ? "none" : "";
          contractPickSection.style.display = isContract ? "" : "none";
        });
      });

      /* ── เลือกสัญญาที่มีอยู่แล้ว — create:false เพราะห้ามพิมพ์เพิ่มเอง ต้องเลือกจากที่มีจริงเท่านั้น ── */
      let contractTs = null;
      try {
        contractTs = new TomSelect("#ae-contractPick", {
          create: false,
          maxOptions: selectableContracts.length || 5,
          placeholder: "ค้นหาบริษัท/โครงการ/เลขที่สัญญา...",
          sortField: { field: "text", direction: "asc" },
        });
      } catch { contractTs = null; }
      mkTs("#ae-cpTeam", "เลือกหรือพิมพ์ชื่อทีม");

      const contractPickInfo = document.getElementById("ae-contractPickInfo");
      const cpTeamSelect = document.getElementById("ae-cpTeam");
      const roundGrid = document.getElementById("ae-roundGrid");
      const selectedRoundInput = document.getElementById("ae-selectedRound");

      // ✅ สร้างตาราง "เลือกครั้งที่" ตามสถานะจริงของแต่ละครั้ง (ลงตารางแล้ว/รอวางแผน/ว่าง) — เทียบ
      // pattern เดียวกับคอลัมน์ "ครั้งที่ N" ใน ContractOverview.js เป๊ะๆ กันตัวเลขไม่ตรงกับความจริง
      // เช่น ถ้าครั้งที่ 2 เคยลบทิ้งไป ตารางนี้ต้องโชว์ว่าง (ไม่ใช่ข้ามไปเสนอครั้งที่ 5 เพราะนับจำนวนดิบ)
      const renderRoundGrid = (c) => {
        if (!roundGrid || !selectedRoundInput) return;
        selectedRoundInput.value = "";
        if (!c || !c.visitCount) { roundGrid.innerHTML = ""; return; }
        let defaultOpen = null;
        const rounds = Array.from({ length: c.visitCount }, (_, i) => i + 1);
        roundGrid.innerHTML = rounds.map((n) => {
          const scheduled = c.visits.find((v) => !v.unscheduled && Number(v.time) === n);
          if (scheduled) {
            const dateLabel = moment(scheduled.start || scheduled.date).format("DD MMM YY");
            return `<span class="ae-round-chip ae-round-chip--scheduled" title="ลงตารางแล้ว — ${dateLabel}">✅ ${n}</span>`;
          }
          const pending = c.visits.find((v) => v.unscheduled && Number(v.time) === n);
          if (pending) {
            return `<span class="ae-round-chip ae-round-chip--pending" title="มีแผนงานล่วงหน้าจองครั้งนี้ไว้แล้ว — ไปลงวันที่จริงที่แผงงานล่วงหน้าแทน">📌 ${n}</span>`;
          }
          if (defaultOpen === null) defaultOpen = n;
          return `<button type="button" class="ae-round-chip ae-round-chip--open" data-round="${n}">${n}</button>`;
        }).join("");
        selectedRoundInput.value = defaultOpen || "";
        roundGrid.querySelectorAll(".ae-round-chip--open").forEach((btn) => {
          if (Number(btn.dataset.round) === defaultOpen) btn.classList.add("ae-round-chip--selected");
          btn.addEventListener("click", () => {
            roundGrid.querySelectorAll(".ae-round-chip--open").forEach((b) => b.classList.remove("ae-round-chip--selected"));
            btn.classList.add("ae-round-chip--selected");
            selectedRoundInput.value = btn.dataset.round;
          });
        });
      };

      const showContractInfo = (contractId) => {
        const c = contractMap.get(contractId);
        if (!c) { contractPickInfo.style.display = "none"; renderRoundGrid(null); return; }
        contractPickInfo.innerHTML = `
          <div><b>${contractDisplayName(c)}</b></div>
          <div class="ae-cpi-sub">${c.title} · ${c.system}${c.contractNo ? ` · เลขที่สัญญา ${c.contractNo}` : ""}</div>
          <div class="ae-cpi-sub">ผู้รับผิดชอบเดิม: ${c.team || "ไม่ระบุ"}</div>
        `;
        contractPickInfo.style.display = "block";
        renderRoundGrid(c);
        // ✅ ตั้งผู้รับผิดชอบเริ่มต้นตามของสัญญาเดิมไว้ก่อน แก้เป็นคนอื่นได้ถ้าครั้งนี้เปลี่ยนคนทำ
        if (cpTeamSelect) {
          cpTeamSelect.value = c.team || "";
          cpTeamSelect.dispatchEvent(new Event("change"));
        }
      };
      document.getElementById("ae-contractPick")?.addEventListener("change", (e) => showContractInfo(e.target.value));
      contractTs?.on("change", (val) => showContractInfo(val));

      /* buttons */
      document.getElementById("ae-btnCancel")?.addEventListener("click", () => Swal.close());

      document.getElementById("ae-btnConfirm")?.addEventListener("click", async (clickEvt) => {
        if (isSavingEvent) return; // ✅ กันกรณี listener ถูก attach/ยิงซ้ำ ไม่ให้บันทึกซ้ำ

        // ✅ กันเผื่อ TomSelect หลุด placeholder text ออกมาเป็นค่าจริงตอนไม่ได้เลือกอะไรเลย
        const PLACEHOLDER = "— เลือกหรือพิมพ์ —";
        const getVal = (id) => {
          const raw = document.getElementById(id)?.value?.trim() || "";
          return raw === PLACEHOLDER ? "" : raw;
        };

        const btn = clickEvt.currentTarget;
        const originalLabel = btn.textContent;
        const startSaving = () => {
          isSavingEvent = true;
          btn.disabled = true;
          btn.style.opacity = "0.7";
          btn.textContent = "⏳ กำลังบันทึก...";
        };
        const stopSaving = () => {
          isSavingEvent = false;
          btn.disabled = false;
          btn.style.opacity = "1";
          btn.textContent = originalLabel;
        };
        // ✅ err.message ของ axios เป็นข้อความทั่วไป (เช่น "Request failed with status code 409")
        // ไม่ใช่ข้อความ Thai ที่ backend ตั้งใจส่งมา (เช่น รายละเอียดงานที่ชนกัน/ครบจำนวนครั้งแล้ว)
        // ต้องอ่านจาก response.data.message ก่อนเสมอ ไม่งั้นข้อความแจ้งเตือนจะไปไม่ถึงผู้ใช้เลย
        const showSaveError = (error) => {
          console.error("❌ Error saving event:", error);
          stopSaving();
          Swal.showValidationMessage(error?.response?.data?.message || "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        };

        const jobType = document.querySelector('input[name="ae-jobType"]:checked')?.value || "general";

        /* ── ขั้นตอนที่ 1 = "งานตามสัญญา": เลือกจากสัญญาที่มีอยู่แล้วเท่านั้น เพิ่มแค่ครั้งถัดไป ── */
        if (jobType === "contract") {
          const contractId = getVal("ae-contractPick");
          if (!contractId) { Swal.showValidationMessage("กรุณาเลือกสัญญา"); return; }
          const c = contractMap.get(contractId);
          if (!c) { Swal.showValidationMessage("ไม่พบสัญญาที่เลือก กรุณาเลือกใหม่"); return; }
          if (c.usedVisits >= c.visitCount) {
            Swal.showValidationMessage("สัญญานี้ครบตามจำนวนครั้งที่กำหนดไว้แล้ว");
            return;
          }
          // ✅ อ่านครั้งที่จากตาราง "เลือกครั้งที่" ที่ผู้ใช้กดเลือกไว้ แทนการนับจำนวน+1 แบบเดิม —
          // กันเคสครั้งกลางๆ เคยถูกลบทิ้งไปแล้ว ตัวเลขจะได้ตรงกับที่ตาราง ContractOverview.js แสดงจริง
          const selectedRound = Number(getVal("ae-selectedRound"));
          if (!selectedRound) { Swal.showValidationMessage("กรุณาเลือกครั้งที่ที่ต้องการลงวันที่"); return; }

          const cpStart = getVal("ae-cpStart");
          const cpEnd = getVal("ae-cpEnd") || cpStart;
          if (!cpStart) { Swal.showValidationMessage("กรุณาระบุวันที่เข้างาน"); return; }
          if (moment(cpEnd).isBefore(moment(cpStart))) {
            Swal.showValidationMessage("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม");
            return;
          }

          startSaving();
          try {
            const cpTeam = getVal("ae-cpTeam") || c.team;
            const nextIndex = selectedRound;
            const newEvent = {
              company: c.company, site: c.site, title: c.title, system: c.system,
              time: String(nextIndex),
              team: cpTeam, resPerson: teamToId.get(cpTeam) || "",
              teamMembers: [],
              backgroundColor: defaultBackgroundColor, textColor: defaultTextColor, fontSize: "8",
              startTime: "", endTime: "",
              isContractBatch: true,
              contractGroupId: c.key,
              contractNo: c.contractNo, quotationNo: c.quotationNo,
              contractStart: c.contractStart, contractEnd: c.contractEnd,
              visitCount: c.visitCount, jobValue: c.jobValue,
              dates: [{
                start: cpStart,
                end: moment(cpEnd).add(1, "days").format("YYYY-MM-DD"),
                date: cpStart,
              }],
            };
            await saveEventToDB(newEvent);
            await fetchEventsFromDB();
            stopSaving();
            Swal.fire({
              title: `เพิ่มครั้งที่ ${nextIndex} สำเร็จ ✅`,
              icon: "success",
              timer: 1200,
              showConfirmButton: false,
            });
          } catch (error) {
            showSaveError(error);
          }
          return;
        }

        /* ── "งานทั่วไป" (เดิม) ── */
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

        startSaving();

        try {
          // ✅ ลูกทีมเพิ่มเติม — เก็บทั้งชื่อ+userId (แสดงผลอย่างเดียว ไม่กระทบสิทธิ์) กันซ้ำชื่อ
          // เดียวกันเผลอเพิ่มหลายแถว และตัดแถวที่ยังไม่ได้เลือกใครออก
          const teamMembers = [...document.querySelectorAll(".ae-team-member-select")]
            .map((sel) => sel.value)
            .filter(Boolean)
            .filter((name, idx, arr) => arr.indexOf(name) === idx)
            .map((name) => ({ userId: teamToId.get(name) || "", name }));

          const payload = {
            company:         getVal("eventCompany"),
            site,
            title,
            system,
            time:            getVal("eventTime"),
            team:            getVal("eventTeam"),
            resPerson:       teamToId.get(getVal("eventTeam")) || "",
            teamMembers,
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

          /* upsert customer/jobType/systemType — เดิมยิงทีละตัวรอทีละอันไม่จำเป็น (3 request ไม่ได้
             พึ่งพากันเลย) รวมเป็น Promise.all เดียวลดเวลารอทั้งหมดเหลือเท่าตัวที่ช้าที่สุดตัวเดียว */
          // ✅ .catch(() => {}) กันไว้ — ฝั่ง backend ตอนนี้มี unique index (cCompany+cSite) กันซ้ำ
          // จริงจังแล้ว ถ้า "existing" ด้านบนพลาดเพราะ snapshot เก่า (เช่น listener ยิงซ้ำ) แล้ว
          // backend ตีกลับ 409 ไม่ควรทำให้การบันทึกแผนงานทั้งฟอร์มพังไปด้วย แค่ข้ามการเพิ่มโครงการซ้ำ
          const existing = customers.userCustomers.find(
            (c) => c.cCompany === payload.company && c.cSite === payload.site
          );
          const upsertPromises = [];
          if (!existing) {
            upsertPromises.push(CustomerService.AddCustomer({
              cCompany: payload.company ?? "",
              cSite:    payload.site    ?? "",
            }).catch(() => {}));
          }
          // ✅ TomSelect ของช่องประเภทงาน/ระบบเปิด create:true ไว้ (พิมพ์ค่าใหม่ที่ไม่มีในลิสต์ได้)
          // เดิมค่าที่พิมพ์ใหม่ถูกบันทึกแค่ในตัวแผนงานนี้ ไม่เคยเข้าตารางกลาง "ประเภทงาน"/"ระบบ"
          // เลย ทำให้ครั้งถัดไปต้องพิมพ์ใหม่ซ้ำอีก ไม่โผล่เป็นตัวเลือกให้เลือก — upsert เข้าตาราง
          // กลางเหมือนที่ทำกับลูกค้า/โครงการด้านบน ถ้ายังไม่มีชื่อนี้อยู่ก่อน
          if (!jobTypes?.items?.some((t) => t.name === title)) {
            upsertPromises.push(JobTypeService.add(title).catch(() => {}));
          }
          if (!systemTypes?.items?.some((s) => s.name === system)) {
            upsertPromises.push(SystemTypeService.add(system).catch(() => {}));
          }
          await Promise.all(upsertPromises);

          // ⚠️ เดิม optimistic-add newEvent เข้า state ตรงนี้ก่อน แต่ newEvent ไม่มี id/ _id เลย
          // (ยังไม่ถูกบันทึกจริง) ทำให้ถ้า saveEventToDB ด้านล่างล้มเหลว จะมี event ผีค้างอยู่ใน
          // ปฏิทินโดยไม่มีทางลบออก จนกว่าจะรีเฟรชหน้า — fetchEventsFromDB() หลังบันทึกสำเร็จ
          // ก็ดึงข้อมูลจริงมาแสดงอยู่แล้ว จึงตัด optimistic add ที่ไม่จำเป็นและเสี่ยงนี้ออก
          await saveEventToDB(newEvent);
          setDefaultTextColor(payload.textColor);
          setDefaultBackgroundColor(payload.backgroundColor);
          setDefaultFontSize(payload.fontSize);
          await Promise.all([fetchEventsFromDB(), fetchLookupOptions?.()]); // ✅ รีเฟรชตัวเลือกตัวกรองให้เห็นประเภทงาน/ระบบที่เพิ่งพิมพ์ใหม่ทันที
          stopSaving();

          Swal.fire({
            title: "บันทึกแผนงานสำเร็จ ✅",
            icon: "success",
            timer: 1200,
            showConfirmButton: false,
          });
        } catch (error) {
          showSaveError(error);
        }
      });
    },
  });
};
