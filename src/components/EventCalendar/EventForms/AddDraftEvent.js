import { countUsedRounds } from "../../../utils/contractRounds";
import { escapeHtml } from "../../../utils/escapeHtml";

/* ─────────────────────────────────────────────
   STYLE INJECTION — งานวางแผนล่วงหน้า (ยังไม่ลงตาราง)
   โครงเดียวกับ AddEvent.js แต่ตัดส่วนวันที่/เวลา/ทีมออกทั้งหมด (ย้ายไปอยู่ในกล่อง "ลงตาราง"
   แทน — ดู handleScheduleDraftClick ใน EventCalendar/index.js) เหลือแค่ข้อมูลโครงการ +
   เดือนที่ตั้งใจ ให้ฟอร์มนี้เรียบง่าย ไม่ปนกับขั้นตอนลงตารางจริง
───────────────────────────────────────────── */
function injectAddDraftStyles() {
  if (document.getElementById("add-draft-event-styles")) return;
  const style = document.createElement("style");
  style.id = "add-draft-event-styles";
  style.textContent = `
    .swal-add-draft.swal2-popup {
      padding: 0 !important;
      border-radius: 16px !important;
      overflow: hidden !important;
      width: min(96vw, 720px) !important;
      max-height: 95vh !important;
      display: flex !important;
      flex-direction: column !important;
      font-family: 'Inter', system-ui, sans-serif !important;
      box-shadow: 0 25px 60px rgba(10,22,40,.35) !important;
    }
    .swal-add-draft .swal2-html-container {
      margin: 0 !important; padding: 0 !important; overflow: hidden !important;
      display: flex !important; flex-direction: column !important; flex: 1 !important; min-height: 0 !important;
    }
    .swal-add-draft #ade-modal-inner { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .swal-add-draft .swal2-title,
    .swal-add-draft .swal2-actions,
    .swal-add-draft .swal2-footer { display: none !important; }
    .swal-add-draft .swal2-close {
      position: absolute; top: 14px; right: 16px; z-index: 99;
      width: 32px; height: 32px; border-radius: 50%;
      background: rgba(255,255,255,.15) !important; color: #fff !important;
      font-size: 18px; display: flex; align-items: center; justify-content: center;
      transition: background .2s;
    }
    .swal-add-draft .swal2-close:hover { background: rgba(255,255,255,.30) !important; }

    #ade-header {
      padding: 20px 24px 18px; display: flex; align-items: center; gap: 14px;
      background: linear-gradient(135deg, #dc2626, #7f1d1d); flex-shrink: 0;
    }
    #ade-header-icon { font-size: 28px; line-height: 1; }
    #ade-header-info { flex: 1; }
    #ade-header-info h3 { margin:0; font-size:18px; font-weight:700; color:#fff; }
    #ade-header-info small { font-size:12px; color:rgba(255,255,255,.75); }

    #ade-body { padding: 22px 26px; background: #f8fafc; overflow-y: auto; flex: 1; min-height: 0; }

    .ade-section-label {
      font-size: 11px; font-weight: 700; letter-spacing: .08em;
      text-transform: uppercase; color: #64748b; margin: 0 0 10px;
    }

    .ade-grid { display: grid; gap: 12px; margin-bottom: 16px; }
    .ade-grid-2 { grid-template-columns: 1fr 1fr; }
    .ade-grid-3 { grid-template-columns: 1fr 1fr 1fr; }
    @media(max-width:600px) { .ade-grid-2,.ade-grid-3 { grid-template-columns: 1fr; } }

    .ade-field { display: flex; flex-direction: column; gap: 5px; }
    .ade-field label { font-size: 12px; font-weight: 600; color: #374151; display: flex; align-items: center; gap: 4px; }
    .ade-field label .req { color: #ef4444; font-size: 13px; }
    .ade-field select, .ade-field input, .ade-field textarea {
      width: 100%; box-sizing: border-box;
      border: 1.5px solid #e2e8f0; border-radius: 8px;
      padding: 9px 12px; font-size: 14px; color: #1e293b;
      background: #fff; transition: border-color .2s, box-shadow .2s;
      font-family: inherit;
    }
    .ade-field select:focus, .ade-field input:focus, .ade-field textarea:focus {
      outline: none; border-color: #dc2626;
      box-shadow: 0 0 0 3px rgba(220,38,38,.12);
    }

    .ade-divider { border: none; border-top: 1px solid #e2e8f0; margin: 16px 0; }

    /* ── ขั้นตอนที่ 1: เลือกประเภทงาน (การ์ดวิทยุ) — โครงเดียวกับ AddEvent.js ── */
    /* ✅ เพิ่มตัวเลือกที่ 3 "งานโปรเจค" (เดิมมีแค่ 2 ใบ) — 3 คอลัมน์บนจอกว้าง ยุบเหลือคอลัมน์เดียวบนมือถือ
       เหมือนเดิม (เทียบไอคอน/สีเดียวกับหน้า "ภาพรวมงาน" — เขียว=ทั่วไป (🔧), น้ำเงิน=โปรเจค (🏗️) ให้จำง่าย
       ตรงกันทั้งแอป) */
    .ade-jobtype-toggle { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 18px; }
    @media(max-width:600px) { .ade-jobtype-toggle { grid-template-columns: 1fr; } }
    .ade-jobtype-option { position: relative; cursor: pointer; }
    .ade-jobtype-option input { position: absolute; opacity: 0; width: 0; height: 0; }
    .ade-jobtype-card {
      display: flex; align-items: center; gap: 10px;
      border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 12px 14px;
      background: #fff; transition: border-color .15s, background .15s;
    }
    .ade-jobtype-icon { font-size: 22px; line-height: 1; }
    .ade-jobtype-title { font-size: 13px; font-weight: 700; color: #1e293b; }
    .ade-jobtype-desc { font-size: 11px; color: #64748b; }
    .ade-jobtype-option input:checked + .ade-jobtype-card {
      border-color: #dc2626; background: #fef2f2;
    }
    .ade-jobtype-option input:checked + .ade-jobtype-card .ade-jobtype-title { color: #b91c1c; }
    .ade-jobtype-option input:disabled + .ade-jobtype-card { opacity: .5; cursor: not-allowed; }
    .ade-jobtype-note { font-size: 11px; color: #b91c1c; margin: -12px 0 16px; display: none; }
    .ade-lock-note { font-size: 11px; color: #b91c1c; margin: -6px 0 12px; }

    .ade-contract-pick-info {
      background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 10px;
      padding: 12px 14px; margin-bottom: 16px; font-size: 13px; color: #374151; display: none;
    }
    .ade-contract-pick-info b { color: #b91c1c; }
    .ade-contract-pick-info .ade-cpi-sub { font-size: 12px; color: #64748b; margin-top: 2px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

    /* ✅ ตัวเลือกสัญญาใน dropdown (TomSelect render.option/item) — เดิมโชว์เป็นข้อความบรรทัดเดียวยาวๆ
       "บริษัท · โครงการ · ประเภทงาน (เลขที่) — 2/4 ครั้ง" อ่านยาก ไล่สายตาหาไม่ออกว่าอันไหนคืออันไหน —
       แยกเป็น 2 บรรทัด (ชื่อบริษัท/โครงการ ตัวหนาใหญ่ก่อน แล้วรายละเอียดย่อยเบาๆ ด้านล่าง) พร้อมป้าย
       "เหลือ N ครั้ง" แยกออกมาให้เห็นชัดว่าสัญญานี้ว่างอยู่กี่ครั้ง โดยไม่ต้องอ่านทั้งประโยค
       เทียบ pattern เดียวกับตัวเลือกสัญญาในหน้า "ภาพรวมงาน" (ContractOverview.js) ให้ตรงกันทั้งแอป */
    .ade-contract-option { padding: 1px 0; }
    .ade-contract-option-main { font-size: 13px; font-weight: 700; color: #1e293b; }
    .ade-contract-option-sub { font-size: 11.5px; color: #64748b; margin-top: 2px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .ade-contract-option-badge,
    .ade-cpi-badge {
      display: inline-flex; align-items: center; flex-shrink: 0;
      background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;
      border-radius: 20px; padding: 1px 9px; font-size: 10.5px; font-weight: 700; white-space: nowrap;
    }
    /* ⚠️ ไม่ใส่ .swal-add-draft นำหน้า — dropdown ถูกย้ายไปแปะที่ <body> ตรงๆ ผ่าน dropdownParent:"body"
       (กัน overflow-y:auto ของพื้นที่เลื่อนตัดขอบ) จึงไม่ได้เป็นลูกของ .swal-add-draft อีกต่อไป */
    .ts-dropdown .option.active .ade-contract-option-badge,
    .ts-dropdown .option.active .ade-cpi-badge {
      background: #fff; border-color: #fff;
    }
    /* ⚠️ TomSelect z-index เริ่มต้น (10) ต่ำกว่า SweetAlert2 container (1060) มาก — พอ dropdown ย้ายไป
       แปะที่ <body> จะกลายเป็น sibling กับ popup ของ Swal เอง ต้องดันให้สูงกว่าเสมอไม่งั้นโดนซ่อนอยู่หลัง modal */
    .ts-dropdown { z-index: 100000 !important; }

    .ade-month-badge {
      display: inline-flex; align-items: center; gap: 6px;
      background: #fef2f2; border: 1px solid #fecaca;
      color: #991b1b; border-radius: 20px; padding: 4px 14px;
      font-size: 12px; font-weight: 600; margin-bottom: 16px;
    }
    /* ✅ แจ้งเตือนล่วงหน้าให้ช่าง/เซล (ไม่ใช่ admin/manager) รู้ว่าแผนงานนี้ต้องรออนุมัติก่อน —
       ไม่ได้บล็อกอะไร แค่ตั้งความคาดหวังไว้ก่อนกดบันทึก */
    .ade-approval-note {
      display: block; background: #fffbeb; border: 1.5px solid #fde68a;
      color: #92400e; border-radius: 10px; padding: 8px 14px;
      font-size: 12px; font-weight: 600; margin-bottom: 16px;
    }

    #ade-action-bar {
      display: flex; gap: 10px; flex-wrap: wrap;
      padding: 16px 24px 20px; background: #f1f5f9; border-top: 1px solid #e2e8f0;
      justify-content: flex-end; flex-shrink: 0; position: sticky; bottom: 0; z-index: 10;
    }
    .ade-btn {
      display: inline-flex; align-items: center; gap: 7px;
      border: none; border-radius: 9px; padding: 10px 20px;
      font-size: 13px; font-weight: 700; cursor: pointer;
      transition: opacity .15s, transform .1s; white-space: nowrap; font-family: inherit;
    }
    .ade-btn:hover  { opacity: .88; transform: translateY(-1px); }
    .ade-btn:active { transform: translateY(0); }
    .ade-btn-success { background: #dc2626; color: #fff; }
    .ade-btn-ghost   { background: #e2e8f0; color: #475569; }
    .ade-btn-spacer  { flex: 1; }
    @media(max-width:520px) { .ade-btn-spacer { display:none; } #ade-action-bar { justify-content:center; } }

    .swal-add-draft .ts-wrapper { width: 100%; }
    .swal-add-draft .ts-wrapper .ts-control {
      border: 1.5px solid #e2e8f0 !important; border-radius: 8px !important;
      padding: 8px 12px !important; font-size: 14px !important; min-height: 40px;
    }
    .swal-add-draft .ts-wrapper.focus .ts-control { border-color: #dc2626 !important; }
  `;
  document.head.appendChild(style);
}

// ✅ กันบันทึกซ้ำแบบเดียวกับ AddEvent.js (module-level ไม่ผูกกับ closure ของ didOpen แต่ละครั้ง)
let isSavingDraft = false;

/* ─────────────────────────────────────────────
   MAIN EXPORT — ใช้ทั้งเพิ่มใหม่และแก้ไข (existingDraft) เหลือแค่ข้อมูลโครงการ + เดือนที่ตั้งใจ
   วันที่/เวลา/ทีม ทั้งหมดย้ายไปกำหนดตอนกดปุ่ม "ลงตาราง" แทน (ดู handleScheduleDraftClick)
───────────────────────────────────────────── */
export const getAddDraftEvent = async ({
  defaultMonth, // "YYYY-MM" — เดือนที่กำลังเปิดดูอยู่ในแผงงานล่วงหน้า ใช้เป็นค่าเริ่มต้น
  existingDraft, // ✅ ถ้าส่งมา = โหมดแก้ไข (prefill ค่าเดิม + เรียก UpdateDraftEvent แทน AddDraftEvent)
  events, // ✅ งานที่ลงตารางแล้ว — ใช้หาสัญญาที่มีอยู่แล้วสำหรับขั้นตอน "งานตามสัญญา" (เหมือน AddEvent.js)
  drafts, // ✅ แผนงานล่วงหน้าอื่นที่ค้างอยู่ — อาจจองครั้งที่ของสัญญาเดียวกันไปแล้ว ต้องรวมมานับด้วย
  userData, // ✅ ใช้เช็คว่าเป็น admin/manager หรือไม่ — ถ้าไม่ใช่ ต้องโชว์ข้อความแจ้งว่างานจะรออนุมัติ
  onSaved,
  CustomerService,
  AuthService,
  JobTypeService,
  SystemTypeService,
  EventService,
  Swal,
  TomSelect,
  moment,
}) => {
  injectAddDraftStyles();

  // ✅ ผู้ใช้ที่ไม่ใช่ admin/manager สร้าง/แก้แผนงานได้เหมือนเดิมทุกอย่าง แค่งานจะถูกแท็ก "รออนุมัติ"
  // ฝั่ง backend อัตโนมัติ (ดู POST /events/draft, PUT /:id/draft) — ตรงนี้ใช้แค่โชว์ข้อความแจ้งล่วงหน้า
  const isAdminOrManagerUser = ["admin", "manager"].includes(userData?.role?.toLowerCase());

  const isEditMode = Boolean(existingDraft);
  // ✅ แก้ไขงานที่ผูกสัญญาอยู่แล้ว ไม่ให้สลับกลับเป็นงานทั่วไป/เปลี่ยนบริษัท-โครงการ-ประเภทงาน-ระบบ-ครั้งที่
  // ได้อีก (เผื่อแก้แล้วไม่ตรงกับครั้งอื่นในสัญญาเดียวกัน) เหมือน pattern เดียวกับ EditEvent.js
  const isContractLinked = isEditMode && Boolean(existingDraft?.contractGroupId);

  // ✅ ขั้นตอนที่ 1 (งานทั่วไป/งานตามสัญญา) ต้องรู้ว่าตอนนี้มีสัญญาอะไรอยู่แล้วบ้าง — group จาก events
  // (ลงตารางแล้ว) รวมกับ drafts (แผนงานล่วงหน้าอื่นที่ค้างอยู่ ซึ่งอาจจองครั้งที่ไปแล้วเหมือนกัน) เพื่อคำนวณ
  // "ครั้งที่ถัดไป" ถูกต้อง ไม่ชนกับที่จองไปแล้วไม่ว่าจะลงตารางแล้วหรือยังเป็นแค่แผนงานก็ตาม
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
        intervalMonths: e.intervalMonths,
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
  // ✅ ช่างเลือกได้แค่สัญญาของตัวเองเท่านั้น — เป็นสิทธิ์ของ "ผู้รับผิดชอบ" โดยเฉพาะ ไม่ใช่ "ทีมที่เข้างาน"
  // เทียบ pattern เดียวกับ AddEvent.js เป๊ะๆ (ดูคอมเมนต์ละเอียดที่นั่น)
  const isMyContract = (c) =>
    isAdminOrManagerUser ||
    c.visits.some((v) => {
      const effectiveId = v.responsiblePersonId || v.resPerson;
      const effectiveName = v.responsiblePerson || v.team;
      return (
        (effectiveId && effectiveId === userData?.userId) ||
        (effectiveName && effectiveName === userData?.fname) ||
        v.userId === userData?.userId
      );
    });
  const contractListForUser = contractList.filter(isMyContract);
  const selectableContracts = contractListForUser.filter((c) => c.usedVisits < c.visitCount);
  const contractOpts = selectableContracts
    .map((c) => {
      const label = `${escapeHtml(c.company) || "-"} · ${escapeHtml(c.site) || "-"} · ${escapeHtml(c.title)} (${c.contractNo ? escapeHtml(c.contractNo) : "ไม่มีเลขที่"}) — ${c.usedVisits}/${c.visitCount} ครั้ง`;
      return `<option value="${c.key}">${label}</option>`;
    })
    .join("");

  const [customers, , jobTypes, systemTypes] = await Promise.all([
    CustomerService.getCustomers(),
    AuthService.getAllUserData(),
    JobTypeService.getAll(),
    SystemTypeService.getAll(),
  ]);

  // ✅ ป้องกัน stored XSS — ค่าที่ผู้ใช้พิมพ์เอง (ชื่อบริษัท/โครงการ/ประเภทงาน/ระบบ ฯลฯ) ต้อง escape ก่อน
  // ต่อเป็น HTML string เสมอ ไม่งั้นถ้ามีใครตั้งชื่อเป็น เช่น "><img src=x onerror="..."> จะยิง
  // JavaScript ทันทีที่มีใครเปิดฟอร์มนี้ดู
  // ✅ โหมดแก้ไข: ทำ option ของค่าที่มีอยู่แล้วเป็น "selected" ให้ TomSelect หยิบไปแสดงตอน init
  const opt = (value, current) =>
    `<option value="${escapeHtml(value)}"${current === value ? " selected" : ""}>${escapeHtml(value)}</option>`;

  const companyOpts = customers.userCustomers
    .map((c) => opt(c.cCompany, existingDraft?.company)).join("");
  const siteOpts = customers.userCustomers
    .map((c) => opt(c.cSite, existingDraft?.site)).join("");
  const titleOpts = (jobTypes?.items || [])
    .map((t) => opt(t.name, existingDraft?.title)).join("");
  const systemOpts = (systemTypes?.items || [])
    .map((s) => opt(s.name, existingDraft?.system)).join("");
  const timeOpts = ["1", "2", "3", "4"]
    .map((t) => opt(t, existingDraft?.time)).join("");

  const monthValue = existingDraft?.plannedMonth || defaultMonth;
  const monthLabel = moment(monthValue, "YYYY-MM").locale("th").format("MMMM YYYY");

  const html = `
<div id="ade-modal-inner">
  <div id="ade-header">
    <div id="ade-header-icon">📌</div>
    <div id="ade-header-info">
      <h3>${isEditMode ? "แก้ไขงานวางแผนล่วงหน้า" : "เพิ่มงานวางแผนล่วงหน้า"}</h3>
      <small>ยังไม่ต้องระบุวันที่ — ลาก/กดลงตารางได้ทีหลัง</small>
    </div>
  </div>

  <div id="ade-body">
    <div class="ade-month-badge">📌 เดือนที่ตั้งใจ: ${monthLabel}</div>

    ${!isAdminOrManagerUser ? `<div class="ade-approval-note">⏳ แผนงานนี้จะขึ้นแสดงทันที แต่ต้องรอแอดมิน/manager อนุมัติก่อน จึงจะถือว่ายืนยันสมบูรณ์</div>` : ""}

    ${isEditMode ? "" : `
    <p class="ade-section-label">ขั้นตอนที่ 1 — ประเภทงาน</p>
    <div class="ade-jobtype-toggle">
      <label class="ade-jobtype-option">
        <input type="radio" name="ade-jobType" id="ade-jobTypeGeneral" value="general" checked>
        <div class="ade-jobtype-card">
          <div class="ade-jobtype-icon">🔧</div>
          <div>
            <div class="ade-jobtype-title">งานทั่วไป</div>
            <div class="ade-jobtype-desc">งานครั้งเดียว ไม่ผูกกับสัญญา</div>
          </div>
        </div>
      </label>
      <label class="ade-jobtype-option">
        <input type="radio" name="ade-jobType" id="ade-jobTypeProject" value="project">
        <div class="ade-jobtype-card">
          <div class="ade-jobtype-icon">🏗️</div>
          <div>
            <div class="ade-jobtype-title">งานโปรเจค</div>
            <div class="ade-jobtype-desc">งานโปรเจคเดี่ยว ไม่ผูกกับสัญญา</div>
          </div>
        </div>
      </label>
      <label class="ade-jobtype-option">
        <input type="radio" name="ade-jobType" id="ade-jobTypeContract" value="contract" ${selectableContracts.length === 0 ? "disabled" : ""}>
        <div class="ade-jobtype-card">
          <div class="ade-jobtype-icon">🔁</div>
          <div>
            <div class="ade-jobtype-title">งานตามสัญญา</div>
            <div class="ade-jobtype-desc">วางแผนครั้งถัดไปของสัญญาที่มีอยู่แล้ว</div>
          </div>
        </div>
      </label>
    </div>
    ${selectableContracts.length === 0
      ? `<p class="ade-jobtype-note" style="display:block;">${
          contractListForUser.length === 0
            ? (isAdminOrManagerUser
                ? `ยังไม่มีสัญญาในระบบ — สร้างสัญญาใหม่ได้ที่หน้า "ภาพรวมงาน" ก่อน`
                : `คุณยังไม่มีสัญญาที่มอบหมายให้ตัวเอง — ติดต่อแอดมิน/manager ให้เพิ่มสัญญาก่อน`)
            : (isAdminOrManagerUser
                ? `สัญญาที่มีอยู่ครบจำนวนครั้งหมดแล้ว — สร้างสัญญาใหม่ได้ที่หน้า "ภาพรวมงาน"`
                : `สัญญาของคุณครบจำนวนครั้งหมดแล้ว — ติดต่อแอดมิน/manager`)
        }</p>`
      : ""}
    `}

    <div id="ade-generalSection">
      ${isContractLinked ? `
      <p class="ade-lock-note">
        🔒 งานนี้เป็นส่วนหนึ่งของสัญญา — ล็อกบริษัท/โครงการ/ประเภทงาน/ระบบ/ครั้งที่ไว้ไม่ให้แก้ตรงนี้
        กันข้อมูลไม่ตรงกับครั้งอื่นในสัญญาเดียวกัน
      </p>
      ` : ""}
      <p class="ade-section-label">ข้อมูลโครงการ</p>
      <div class="ade-grid ade-grid-3">
        <div class="ade-field">
          <label>🏢 ชื่อบริษัท</label>
          <select id="adeCompany" ${isContractLinked ? "disabled" : ""}><option selected disabled value="">— เลือกหรือพิมพ์ —</option>${companyOpts}</select>
        </div>
        <div class="ade-field">
          <label><span class="req">*</span> ชื่อโครงการ</label>
          <select id="adeSite" ${isContractLinked ? "disabled" : ""}><option selected disabled value="">— เลือกหรือพิมพ์ —</option>${siteOpts}</select>
        </div>
        <div class="ade-field">
          <label><span class="req">*</span> ประเภทงาน</label>
          <select id="adeTitle" ${isContractLinked ? "disabled" : ""}><option selected disabled value="">— เลือกหรือพิมพ์ —</option>${titleOpts}</select>
        </div>
      </div>

      <!-- ✅ "ครั้งที่" มีความหมายเฉพาะงานตามสัญญาเท่านั้น (รอบที่ N ของสัญญา) — งานทั่วไป/งานโปรเจค
           เป็นงานเดี่ยวๆ ไม่มีแนวคิด "ครั้งที่" เลย ตัดช่องนี้ออกให้ฟอร์มดูรกน้อยลง เหลือไว้เฉพาะตอนแก้ไข
           งานที่ผูกสัญญาอยู่แล้ว (isContractLinked) ซึ่งยังมีค่าจริงที่ควรโชว์ไว้ให้เห็น (แค่ล็อกแก้ไม่ได้) -->
      <div class="ade-grid${isContractLinked ? " ade-grid-2" : ""}">
        <div class="ade-field">
          <label><span class="req">*</span> ระบบงาน</label>
          <select id="adeSystem" ${isContractLinked ? "disabled" : ""}><option selected disabled value="">— เลือกหรือพิมพ์ —</option>${systemOpts}</select>
        </div>
        ${isContractLinked ? `
        <div class="ade-field">
          <label>🔢 ครั้งที่</label>
          <select id="adeTime" disabled><option selected disabled value="">— เลือก —</option>${timeOpts}</select>
        </div>
        ` : ""}
      </div>
    </div>

    <div id="ade-contractPickSection" style="display:none;">
      <p class="ade-section-label">ขั้นตอนที่ 2 — เลือกสัญญา</p>
      <div class="ade-field" style="margin-bottom:16px;">
        <label><span class="req">*</span> เลือกสัญญา</label>
        <select id="ade-contractPick"><option value="" selected disabled>— เลือกสัญญา —</option>${contractOpts}</select>
      </div>
      <div class="ade-contract-pick-info" id="ade-contractPickInfo"></div>
    </div>

    <hr class="ade-divider">

    <p class="ade-section-label">เดือนที่ตั้งใจจะทำงานนี้</p>
    <div class="ade-grid ade-grid-2">
      <div class="ade-field">
        <label><span class="req">*</span> เดือน/ปี</label>
        <input id="adeMonth" type="month" value="${monthValue}">
      </div>
    </div>
  </div>

  <div id="ade-action-bar">
    <div class="ade-btn-spacer"></div>
    <button class="ade-btn ade-btn-ghost" id="ade-btnCancel">ยกเลิก</button>
    <button class="ade-btn ade-btn-success" id="ade-btnConfirm">${isEditMode ? "💾 บันทึกการแก้ไข" : "💾 บันทึกงานล่วงหน้า"}</button>
  </div>
</div>
`;

  return new Promise((resolve) => {
    Swal.fire({
      html,
      width: "720px",
      showConfirmButton: false,
      showCancelButton: false,
      showCloseButton: true,
      customClass: { popup: "swal-add-draft" },
      allowOutsideClick: false,
      allowEscapeKey: false,

      didOpen: () => {
        const mkTs = (id, placeholder = "", maxOptions = 50) => {
          // ⚠️ เดิม fix ไว้ 7 ตัดรายชื่อ/ตัวเลือกที่มีเกิน 7 รายการทิ้งไปเงียบๆ (ห้องสมุด TomSelect
          // ค่า default จริงคือ 50 อยู่แล้ว) ทำให้ dropdown บริษัท/โครงการ/ประเภทงาน/ระบบงาน "หาไม่เจอ"
          // เป็นบางที เวลารายการมีมากกว่า 7 รายการ — ผู้เรียกควรส่ง length ของรายการจริงมาแทน
          try {
            return new TomSelect(id, {
              create: true,
              maxOptions,
              placeholder,
              sortField: { field: "text", direction: "asc" },
              allowEmptyOption: true,
              dropdownParent: "body", // ✅ กันพื้นที่เลื่อน (overflow-y:auto) ตัดขอบ dropdown
            });
          } catch { return null; }
        };

        mkTs("#adeCompany", "เลือกหรือพิมพ์ชื่อบริษัท", customers.userCustomers.length || 50);
        mkTs("#adeSite",    "เลือกหรือพิมพ์ชื่อโครงการ", customers.userCustomers.length || 50);
        mkTs("#adeTitle",   "เลือกหรือพิมพ์ประเภทงาน", (jobTypes?.items || []).length || 50);
        mkTs("#adeSystem",  "เลือกหรือพิมพ์ระบบงาน", (systemTypes?.items || []).length || 50);
        // ✅ ช่อง "ครั้งที่" ตัดออกไปแล้วสำหรับงานทั่วไป/งานโปรเจค (เหลือเฉพาะตอนแก้ไขงานที่ผูกสัญญา
        // อยู่แล้ว — ดู isContractLinked ตอน render HTML) เช็คว่ามี element อยู่จริงก่อนค่อย init TomSelect
        if (document.getElementById("adeTime")) mkTs("#adeTime", "เลือกครั้งที่", 4);

        /* ── ขั้นตอนที่ 1: งานทั่วไป vs งานตามสัญญา — สลับ section ทั้งก้อน (เฉพาะตอนสร้างใหม่ ไม่มี
           radio นี้เลยตอนแก้ไข ดูเงื่อนไข isEditMode ตอน render HTML — forEach ด้านล่างเลย no-op ไปเอง) ── */
        const generalSection = document.getElementById("ade-generalSection");
        const contractPickSection = document.getElementById("ade-contractPickSection");
        const jobTypeRadios = [...document.querySelectorAll('input[name="ade-jobType"]')];
        jobTypeRadios.forEach((radio) => {
          radio.addEventListener("change", () => {
            if (!radio.checked) return;
            const isContract = radio.value === "contract";
            generalSection.style.display = isContract ? "none" : "";
            contractPickSection.style.display = isContract ? "" : "none";
          });
        });

        /* ── เลือกสัญญาที่มีอยู่แล้ว — create:false ห้ามพิมพ์เพิ่มเอง ต้องเลือกจากที่มีจริงเท่านั้น ──
           ⚠️ เดิม dropdown โชว์แค่ข้อความยาวบรรทัดเดียว "บริษัท · โครงการ · ประเภทงาน (เลขที่) — 2/4
           ครั้ง" อ่านยาก ไล่สายตาหาสัญญาที่ต้องการไม่ออกเวลามีสัญญาเยอะๆ — ใช้ render.option/item ของ
           TomSelect วาด HTML เอง แยกชื่อบริษัท/โครงการ (ตัวหนาใหญ่) ออกจากรายละเอียดย่อย (เบาๆ) พร้อม
           ป้าย "เหลือ N ครั้ง" แยกให้เห็นชัด — escape() ที่ TomSelect ส่งมาให้ป้องกัน HTML injection จาก
           ชื่อบริษัท/โครงการ/ประเภทงานที่ผู้ใช้เคยพิมพ์กรอกเอง (freeSolo ในฟอร์มอื่นๆ ของแอป) */
        const renderContractOption = (data, escape) => {
          const c = contractMap.get(data.value);
          if (!c) return `<div class="ade-contract-option">${escape(data.text)}</div>`;
          const remaining = c.visitCount - c.usedVisits;
          return `
            <div class="ade-contract-option">
              <div class="ade-contract-option-main">${escape(c.company || "-")} · ${escape(c.site || "-")}</div>
              <div class="ade-contract-option-sub">
                <span>${escape(c.title)} · ${escape(c.system)}${c.contractNo ? ` · เลขที่ ${escape(c.contractNo)}` : ""}</span>
                <span class="ade-contract-option-badge">เหลือ ${remaining} ครั้ง</span>
              </div>
            </div>`;
        };
        // ✅ "item" (ค่าที่เลือกแล้ว โชว์ย่อในกล่องค้นหาเอง ไม่ใช่ในรายการ dropdown) ให้กระชับบรรทัดเดียว
        // ต่างจาก "option" (รายการใน dropdown) ที่โชว์ได้เต็ม 2 บรรทัด — ไม่งั้นกล่องค้นหาจะสูงเกินจำเป็น
        const renderContractItem = (data, escape) => {
          const c = contractMap.get(data.value);
          if (!c) return `<div>${escape(data.text)}</div>`;
          return `<div>${escape(c.company || "-")} · ${escape(c.site || "-")}${c.contractNo ? ` · ${escape(c.contractNo)}` : ""}</div>`;
        };
        let contractTs = null;
        try {
          contractTs = new TomSelect("#ade-contractPick", {
            create: false,
            maxOptions: selectableContracts.length || 5,
            placeholder: "ค้นหาบริษัท/โครงการ/เลขที่สัญญา...",
            sortField: { field: "text", direction: "asc" },
            render: { option: renderContractOption, item: renderContractItem },
            dropdownParent: "body", // ✅ กันพื้นที่เลื่อน (overflow-y:auto) ตัดขอบ dropdown
          });
        } catch { contractTs = null; }

        const contractPickInfo = document.getElementById("ade-contractPickInfo");
        const showContractInfo = (contractId) => {
          const c = contractMap.get(contractId);
          if (!c || !contractPickInfo) { if (contractPickInfo) contractPickInfo.style.display = "none"; return; }
          contractPickInfo.innerHTML = `
            <div><b>${escapeHtml(c.company) || "-"} · ${escapeHtml(c.site) || "-"}</b></div>
            <div class="ade-cpi-sub">${escapeHtml(c.title)} · ${escapeHtml(c.system)}${c.contractNo ? ` · เลขที่สัญญา ${escapeHtml(c.contractNo)}` : ""}</div>
            <div class="ade-cpi-sub">📅 กำลังจะวางแผนเป็น <b>ครั้งที่ ${c.usedVisits + 1}</b> <span class="ade-cpi-badge">จากทั้งหมด ${c.visitCount} ครั้ง</span></div>
          `;
          contractPickInfo.style.display = "block";
        };
        document.getElementById("ade-contractPick")?.addEventListener("change", (e) => showContractInfo(e.target.value));
        contractTs?.on("change", (val) => showContractInfo(val));

        document.getElementById("ade-btnCancel")?.addEventListener("click", () => Swal.close());

        document.getElementById("ade-btnConfirm")?.addEventListener("click", async (clickEvt) => {
          if (isSavingDraft) return;

          const PLACEHOLDER = "— เลือกหรือพิมพ์ —";
          const getVal = (id) => {
            const raw = document.getElementById(id)?.value?.trim() || "";
            return raw === PLACEHOLDER ? "" : raw;
          };

          const jobType = document.querySelector('input[name="ade-jobType"]:checked')?.value || "general";

          /* ── ขั้นตอนที่ 1 = "งานตามสัญญา": เลือกจากสัญญาที่มีอยู่แล้วเท่านั้น วางแผนแค่ครั้งถัดไป ── */
          if (jobType === "contract") {
            const contractId = getVal("ade-contractPick");
            if (!contractId) { Swal.showValidationMessage("กรุณาเลือกสัญญา"); return; }
            const c = contractMap.get(contractId);
            if (!c) { Swal.showValidationMessage("ไม่พบสัญญาที่เลือก กรุณาเลือกใหม่"); return; }
            if (c.usedVisits >= c.visitCount) {
              Swal.showValidationMessage("สัญญานี้ครบตามจำนวนครั้งที่กำหนดไว้แล้ว");
              return;
            }
            const cPlannedMonth = getVal("adeMonth");
            if (!cPlannedMonth) { Swal.showValidationMessage("กรุณาระบุเดือนที่ตั้งใจ"); return; }

            isSavingDraft = true;
            const cBtn = clickEvt.currentTarget;
            const cOriginalLabel = cBtn.textContent;
            cBtn.disabled = true;
            cBtn.style.opacity = "0.7";
            cBtn.textContent = "⏳ กำลังบันทึก...";

            try {
              const nextIndex = c.usedVisits + 1;
              const contractPayload = {
                isContractBatch: true,
                contractGroupId: c.key,
                contractNo: c.contractNo, quotationNo: c.quotationNo,
                contractStart: c.contractStart, contractEnd: c.contractEnd,
                visitCount: c.visitCount, intervalMonths: c.intervalMonths, jobValue: c.jobValue,
                company: c.company, site: c.site, title: c.title, system: c.system,
                team: c.team,
                time: String(nextIndex),
                plannedMonth: cPlannedMonth,
              };
              await EventService.AddDraftEvent(contractPayload);
              isSavingDraft = false;

              Swal.fire({
                title: `เพิ่มครั้งที่ ${nextIndex} เป็นแผนงานล่วงหน้าสำเร็จ ✅`,
                icon: "success",
                timer: 1200,
                showConfirmButton: false,
              });
              await onSaved?.();
              resolve(true);
            } catch (error) {
              console.error("❌ Error saving contract draft event:", error);
              isSavingDraft = false;
              cBtn.disabled = false;
              cBtn.style.opacity = "1";
              cBtn.textContent = cOriginalLabel;
              Swal.showValidationMessage(error?.response?.data?.message || "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
            }
            return;
          }

          /* ── "งานทั่วไป" (เดิม) ── */
          const site   = getVal("adeSite");
          const title  = getVal("adeTitle");
          const system = getVal("adeSystem");
          const plannedMonth = getVal("adeMonth");

          if (!site)   { Swal.showValidationMessage("กรุณาระบุชื่อโครงการ");  return; }
          if (!title)  { Swal.showValidationMessage("กรุณาระบุประเภทงาน");    return; }
          if (!system) { Swal.showValidationMessage("กรุณาระบุระบบงาน");      return; }
          if (!plannedMonth) { Swal.showValidationMessage("กรุณาระบุเดือนที่ตั้งใจ"); return; }

          isSavingDraft = true;
          const btn = clickEvt.currentTarget;
          const originalLabel = btn.textContent;
          btn.disabled = true;
          btn.style.opacity = "0.7";
          btn.textContent = "⏳ กำลังบันทึก...";

          try {
            const payload = {
              company: getVal("adeCompany"),
              site,
              title,
              system,
              time: getVal("adeTime"),
              plannedMonth,
            };
            // ✅ ตั้งหมวดหมู่ "งานทั่วไป"/"งานโปรเจค" ให้เลยตั้งแต่ตอนสร้าง (ตามที่เลือกไว้ในขั้นตอนที่ 1)
            // แทนที่จะปล่อยว่างไว้แล้วต้องไปกดจัดหมวดหมู่ย้อนหลังทีหลังในหน้า "ภาพรวมงาน" เสมอ — เฉพาะตอน
            // สร้างใหม่เท่านั้น (โหมดแก้ไขไม่มี radio นี้ให้เลือก jobType จึงเป็นค่า fallback "general"
            // เสมอ ไม่ควรเอามาทับหมวดหมู่เดิมที่มีอยู่แล้วของ draft นั้น)
            if (!isEditMode) {
              payload.jobClassification = jobType === "project" ? "project" : "general";
              // ✅ คนที่เพิ่มแผนงานทั่วไป/โปรเจคเองเป็นผู้รับผิดชอบงานนั้นทันทีโดยอัตโนมัติ (งานตามสัญญา
              // ยังคงให้ admin/manager มอบหมายเองผ่านหน้า "ภาพรวมงาน" เหมือนเดิม ไม่ตั้งตรงนี้) — ทีมที่
              // เข้างานจริงยังเลือกได้ตามปกติตอนกดลงตารางจริง (ดู scheduleDraft/swal-schedule-team ใน
              // EventCalendar/index.js) เพราะ draft ยังไม่รู้วันที่แน่นอน จึงยังไม่มีช่องเลือกทีมตรงนี้
              if (jobType !== "contract") {
                payload.responsiblePerson = userData?.fname || "";
                payload.responsiblePersonId = userData?.userId || "";
              }
            }

            const existing = customers.userCustomers.find(
              (c) => c.cCompany === payload.company && c.cSite === payload.site
            );
            if (!existing) {
              await CustomerService.AddCustomer({
                cCompany: payload.company ?? "",
                cSite:    payload.site    ?? "",
              }).catch(() => {});
            }
            if (!jobTypes?.items?.some((t) => t.name === title)) {
              await JobTypeService.add(title).catch(() => {});
            }
            if (!systemTypes?.items?.some((s) => s.name === system)) {
              await SystemTypeService.add(system).catch(() => {});
            }

            if (isEditMode) {
              await EventService.UpdateDraftEvent(existingDraft._id, payload);
            } else {
              await EventService.AddDraftEvent(payload);
            }
            isSavingDraft = false;

            Swal.fire({
              title: isEditMode ? "บันทึกการแก้ไขสำเร็จ ✅" : "บันทึกงานล่วงหน้าสำเร็จ ✅",
              icon: "success",
              timer: 1200,
              showConfirmButton: false,
            });
            await onSaved?.();
            resolve(true);
          } catch (error) {
            console.error("❌ Error saving draft event:", error);
            isSavingDraft = false;
            btn.disabled = false;
            btn.style.opacity = "1";
            btn.textContent = originalLabel;
            Swal.showValidationMessage("บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
          }
        });
      },
    }).then((result) => {
      if (!result.isConfirmed) resolve(false);
    });
  });
};
