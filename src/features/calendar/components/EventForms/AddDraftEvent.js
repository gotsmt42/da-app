import { countUsedRounds, totalRoundsOf } from "@/shared/utils/contractRounds";
import { escapeHtml } from "@/shared/utils/escapeHtml";
import { formatThai } from "@/shared/utils/thaiDate";
import { mountThaiDatePickers } from "@/shared/components/mountThaiDatePickers";
import { can } from "@/shared/utils/roles";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import { jobInfoSectionHtml, bindJobInfo, readJobInfo } from "./jobInfoSection";
import { domFormDraft } from "@/shared/utils/formDraft";
// ✅ (10 ต.ค. 2569) ข้อมูลที่กรอกค้างไม่หายเมื่อฟอร์มหลุด/ปิด — ดู shared/utils/formDraft.js
let formDraftCtl = null;

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
    /* ✅ (15 ต.ค. 2569 ผู้ใช้: "หน้าจอคอมขยายขนาดฟอร์มอีก") ฟอร์มรับงานกว้างขึ้นบนจอคอม — มือถือยังเต็มจอเหมือนเดิม */
    .swal-add-draft.swal-add-draft-wide.swal2-popup { width: min(96vw, 980px) !important; }
    .swal-add-draft-wide #ade-body { padding: 24px 32px; }
    @media(max-width:600px) { .swal-add-draft-wide #ade-body { padding: 16px; } }
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
      background: #f1f5f9 !important; color: #475569 !important;
      font-size: 18px; display: flex; align-items: center; justify-content: center;
      transition: background .2s;
    }
    .swal-add-draft .swal2-close:hover { background: #e2e8f0 !important; }

    #ade-header {
      padding: 20px 24px 18px; display: flex; align-items: center; gap: 14px;
      background: #fff; border-bottom: 1px solid #e2e8f0; flex-shrink: 0;
    }
    #ade-header-icon { width: 42px; height: 42px; border-radius: 12px; background: #eff6ff; display: grid; place-items: center; font-size: 22px; line-height: 1; flex-shrink: 0; }
    #ade-header-info { flex: 1; }
    #ade-header-info { text-align: left; }
    #ade-header-info h3 { margin:0; font-size:18px; font-weight:800; color:#0f172a; }
    #ade-header-info small { font-size:12px; color:#64748b; }

    #ade-body { padding: 22px 26px; background: #f8fafc; overflow-y: auto; flex: 1; min-height: 0; text-align: left; }

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
      outline: none; border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37,99,235,.12);
    }

    .ade-divider { border: none; border-top: 1px solid #e2e8f0; margin: 16px 0; }

    /* ✅ (15 ต.ค. 2569) การ์ด "ที่มาของงาน" + ตัวเลือกแบบเม็ดยา — โทนเดียวกับการ์ดประเภทงาน (ขาว · ขอบเทา · เลือกแล้วน้ำเงิน) */
    .ade-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px 16px; margin-bottom: 18px; }
    .ade-hint { font-size: 11.5px; font-weight: 500; color: #94a3b8; }
      display: inline-flex; align-items: center; height: 36px; padding: 0 14px; border-radius: 999px;
      border: 1.5px solid #e2e8f0; background: #fff; color: #334155; font-size: 13px; font-weight: 600;
      transition: border-color .15s, background .15s, color .15s;
    }
    .ade-mode-toggle { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
    /* แถบเลือกแบบ segmented — กรอบเดียว พื้นเทาอ่อน ช่องที่เลือกเป็นการ์ดขาวตัวหนังสือน้ำเงิน */
    .ade-seg { display: grid; gap: 4px; padding: 4px; border-radius: 12px; background: #f1f5f9; border: 1px solid #e2e8f0; }
    .ade-seg-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .ade-seg-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .ade-seg-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .ade-gap { margin-top: 16px; }
    /* ⚠️ ต้องเจาะจงกว่า ".ade-field label" (display:flex/ขนาด 12px) ไม่งั้นช่องกว้างไม่เท่ากัน — ที่ผู้ใช้เห็นว่า "เยื้อง" */
    .ade-field .ade-seg label { display: block; flex: none; min-width: 0; position: relative; margin: 0; cursor: pointer; font-size: inherit; font-weight: inherit; color: inherit; gap: 0; }
    .ade-seg input { position: absolute; opacity: 0; width: 0; height: 0; }
    .ade-seg span {
      display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; min-height: 40px; padding: 6px 8px;
      box-sizing: border-box; border-radius: 9px; text-align: center; color: #475569;
      transition: background .15s, color .15s, box-shadow .15s;
    }
    .ade-seg span b { font-size: 13px; font-weight: 600; line-height: 1.25; }
    .ade-seg span i { font-style: normal; font-size: 16px; line-height: 1; }
    .ade-seg label:hover span { color: #1e293b; }
    .ade-seg input:checked + span { background: #fff; color: #1d4ed8; box-shadow: 0 1px 3px rgba(15,23,42,.14); }
    .ade-seg input:checked + span b { font-weight: 700; }
    #ade-modeDesc { display: block; margin-top: 6px; line-height: 1.45; }
    .ade-seg input:focus-visible + span { box-shadow: 0 0 0 3px rgba(37,99,235,.2); }
    @media(max-width:600px) { .ade-mode-toggle { grid-template-columns: 1fr; } }
    .ade-file {
      position: relative; display: flex; align-items: center; min-height: 40px; padding: 0 12px; cursor: pointer;
      border: 1.5px dashed #cbd5e1; border-radius: 8px; background: #f8fafc; color: #475569; font-size: 13px; font-weight: 600;
      overflow: hidden;
    }
    .ade-file:hover { border-color: #2563eb; color: #1d4ed8; }
    .ade-file input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
    .ade-file span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    /* ✅ (15 ต.ค. 2569 ผู้ใช้: "หน้าจอมือถือให้แสดงเต็มหน้า ให้สวยงาม จัดวางให้ทำง่ายๆ")
       มือถือ: เต็มจอ ไม่มีขอบมน · ตัวเลือกเป็นตาราง 2–3 ช่องกดง่าย · ปุ่มล่างเต็มความกว้าง เว้นขอบล่างของ iPhone */
    @media(max-width:600px) {
      .swal2-container:has(.swal-add-draft) { padding: 0 !important; }
      .swal-add-draft.swal2-popup, .swal-add-draft.swal-add-draft-wide.swal2-popup {
        width: 100vw !important; max-width: 100vw !important; height: 100dvh !important; max-height: 100dvh !important;
        margin: 0 !important; border-radius: 0 !important;
      }
      .swal-add-draft .swal2-close { top: 12px; right: 12px; }
      #ade-header { padding: 12px 56px 12px 16px; gap: 10px; }
      #ade-header-icon { width: 36px; height: 36px; font-size: 18px; border-radius: 10px; }
      #ade-header-info h3 { font-size: 16px; }
      #ade-header-info small { font-size: 11.5px; display: block; line-height: 1.4; }
      .swal-add-draft #ade-body, .swal-add-draft-wide #ade-body { padding: 14px 14px 20px; }
      .ade-card { padding: 12px; border-radius: 12px; margin-bottom: 14px; }
      .ade-seg-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .ade-seg-3 span { flex-direction: column; gap: 3px; min-height: 56px; padding: 6px 4px; }
      .ade-seg span b { font-size: 12.5px; }
      .ade-mode-toggle, .ade-jobtype-toggle { grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); gap: 6px; margin-bottom: 8px; }
      .ade-mode-toggle .ade-jobtype-card, .ade-jobtype-toggle .ade-jobtype-card {
        flex-direction: column; text-align: center; gap: 4px; padding: 10px 4px; height: 100%; box-sizing: border-box; justify-content: center;
      }
      .ade-mode-toggle .ade-jobtype-desc, .ade-jobtype-toggle .ade-jobtype-desc { display: none; }
      .ade-mode-toggle .ade-jobtype-title, .ade-jobtype-toggle .ade-jobtype-title { font-size: 12.5px; }
      .ade-grid { gap: 10px; margin-bottom: 12px; }
      .ade-field select, .ade-field input, .ade-field textarea { font-size: 16px; } /* iOS ไม่ซูมเข้าเองตอนแตะช่อง */
      #ade-action-bar { padding: 10px 12px calc(10px + env(safe-area-inset-bottom)); gap: 8px; flex-wrap: nowrap; }
      #ade-action-bar .ade-btn { flex: 1; justify-content: center; padding: 13px 10px; font-size: 14px; }
      #ade-action-bar .ade-btn-success { flex: 2; }
    }
    /* ✅ (15 ต.ค. 2569 ผู้ใช้: "กรอบรายละเอียดงานให้ขยายขึ้นอีก") */
    #adeDescription { min-height: 132px; line-height: 1.6; resize: vertical; }
    .ade-field input.ade-autofilled { background: #eff6ff; border-color: #93c5fd; transition: background 1.2s; }

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
      border-color: #2563eb; background: #eff6ff;
    }
    .ade-jobtype-option input:checked + .ade-jobtype-card .ade-jobtype-title { color: #1d4ed8; }
    .ade-jobtype-option input:disabled + .ade-jobtype-card { opacity: .5; cursor: not-allowed; }
    .ade-jobtype-note { font-size: 11px; color: #b91c1c; margin: -12px 0 16px; display: none; }
    .ade-lock-note { font-size: 11px; color: #92400e; margin: -6px 0 12px; }

    .ade-contract-pick-info {
      background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 10px;
      padding: 12px 14px; margin-bottom: 16px; font-size: 13px; color: #374151; display: none;
    }
    .ade-contract-pick-info b { color: #1d4ed8; }
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
      background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;
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
      background: #eff6ff; border: 1px solid #bfdbfe;
      color: #1d4ed8; border-radius: 20px; padding: 4px 14px;
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
      padding: 14px 24px 16px; background: #fff; border-top: 1px solid #e2e8f0;
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
    .ade-btn-success { background: #2563eb; color: #fff; }
    .ade-btn-success:hover { background: #1d4ed8; opacity: 1; }
    .ade-btn-ghost   { background: #e2e8f0; color: #475569; }
    .ade-btn-spacer  { flex: 1; }
    @media(max-width:520px) { .ade-btn-spacer { display:none; } #ade-action-bar { justify-content:center; } }

    .swal-add-draft .ts-wrapper { width: 100%; }
    .swal-add-draft .ts-wrapper .ts-control {
      border: 1.5px solid #e2e8f0 !important; border-radius: 8px !important;
      padding: 8px 12px !important; font-size: 14px !important; min-height: 40px;
    }
    .swal-add-draft .ts-wrapper.focus .ts-control { border-color: #2563eb !important; }
  `;
  document.head.appendChild(style);
}

// ✅ กันบันทึกซ้ำแบบเดียวกับ AddEvent.js (module-level ไม่ผูกกับ closure ของ didOpen แต่ละครั้ง)
let isSavingDraft = false;

/* ─────────────────────────────────────────────
   MAIN EXPORT — ใช้ทั้งเพิ่มใหม่และแก้ไข (existingDraft) เหลือแค่ข้อมูลโครงการ + เดือนที่ตั้งใจ
   วันที่/เวลา/ทีม ทั้งหมดย้ายไปกำหนดตอนกดปุ่ม "ลงตาราง" แทน (ดู handleScheduleDraftClick)
───────────────────────────────────────────── */
/** ✅ (15 ต.ค. 2569) ตัวเลือกที่มาของงาน — ชุดเดียวกับ server (routes/calendarEvent/drafts.js pickIntakeInfo) */
/** ✅ (15 ต.ค. 2569) ประเภทงานแบบเลือกด่วนในฟอร์มรับงาน — match = คำที่ใช้หาชื่อประเภทงานเดิมในระบบ */
const QUICK_TYPES = [
  { key: "service", icon: "🔧", label: "ซ่อม / บริการ", name: "Service", match: ["service", "ซ่อม", "บริการ"] },
  { key: "pm", icon: "🗓️", label: "บำรุงรักษา (PM)", name: "PM", match: ["pm", "บำรุง"] },
  { key: "install", icon: "🧰", label: "ติดตั้ง", name: "ติดตั้งอุปกรณ์", match: ["ติดตั้ง", "install"] },
  { key: "survey", icon: "🔎", label: "ตรวจสอบ / สำรวจ", name: "ตรวจสอบ / สำรวจ", match: ["ตรวจ", "สำรวจ", "survey", "inspect"] },
  { key: "project", icon: "🏗️", label: "งานโปรเจค", name: "งานโปรเจค", match: ["โปรเจค", "project"] },
  { key: "other", icon: "➕", label: "อื่นๆ", name: "", match: [] },
];
/** งานเดิม (โหมดแก้ไข) ตรงกับตัวเลือกด่วนอันไหน — ไม่ตรง = "อื่นๆ" · งานใหม่ = ยังไม่เลือก */
const quickTypeOf = (draft) => {
  if (!draft) return "";
  if (draft.jobClassification === "project") return "project";
  const t = String(draft.title || "").toLowerCase();
  if (!t) return "";
  return (QUICK_TYPES.find((q) => q.match.some((m) => t.includes(m))) || { key: "other" }).key;
};

export const INTAKE_SOURCE_OPTS = [["sales", "ฝ่ายขาย"], ["service", "ฝ่ายบริการ"], ["project", "ฝ่ายโครงการ"], ["customer", "ลูกค้าแจ้งตรง"]];

export const getAddDraftEvent = async ({
  defaultMonth, // "YYYY-MM" — เดือนที่กำลังเปิดดูอยู่ในแผงงานล่วงหน้า ใช้เป็นค่าเริ่มต้น
  intake = false, // ✅ เปิดจากเมนู "รับงาน" — งานทั่วไป/โปรเจคเท่านั้น และติดป้าย "รับงาน" (fromIntake) ให้ server ออกเลข Job
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
  const isAdminOrManagerUser = can(userData, "approveJobs");

  const isEditMode = Boolean(existingDraft);
  const isIntakeForm = intake || Boolean(existingDraft?.intakeAt);
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
        visitCount: totalRoundsOf(e),
        intervalMonths: e.intervalMonths,
        contractYears: e.contractYears,
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

  const [customers, usersRes, jobTypes, systemTypes] = await Promise.all([
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

  // ✅ (11 ต.ค. 2569 ผู้ใช้: "ให้มอบหมายผู้รับผิดชอบในช่องของงานใหม่ได้ด้วย ให้สมบูรณ์")
  //    ฟอร์มรับงานใหม่ (ทั่วไป/โปรเจค) เลือกผู้รับผิดชอบงานได้เลย — เฉพาะคนที่มีสิทธิ์มอบหมาย (เกณฑ์เดียวกับ PUT /basic-info)
  //    ค่าเริ่มต้น = ผู้รับงานเอง (เหมือนพฤติกรรมเดิม) · ผู้รับผิดชอบจะเห็นงานใน "งานของฉัน" เพื่อกดรับทราบ → ยืนยันนัดหมาย
  // 🔁 (15 ต.ค. 2569 ผู้ใช้: "ขั้นแรกยังไม่ต้องใส่ผู้รับผิดชอบงาน") — ฟอร์มรับงานไม่มีช่องผู้รับผิดชอบแล้ว
  //    มอบหมายตอน "ส่งลงตาราง" (ScheduleDialog ในหน้างานใหม่) แทน · ตัวแปรคงไว้เผื่อเปิดกลับ
  const canAssignResp = false;
  const respUsers = (usersRes?.allUser || []).filter((u) => u.fname).sort((a, b) => a.fname.localeCompare(b.fname, "th"));
  const initialResp = isEditMode ? (existingDraft?.responsiblePerson || "") : (userData?.fname || "");
  // ⚠️ ตัวเลือกจริงใส่ผ่าน TomSelect (มีรูป/ตำแหน่ง) — select เก็บแค่ค่าเริ่มต้นไว้ ไม่ให้รายการซ้ำ
  const respOpts = `<option value="${escapeHtml(initialResp)}" selected>${escapeHtml(initialResp || "ยังไม่มอบหมาย")}</option>`;

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
  const monthLabel = formatThai(moment(monthValue, "YYYY-MM").locale("th"), "MMMM YYYY");

  const attr = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const html = `
<div id="ade-modal-inner">
  <div id="ade-header">
    <div id="ade-header-icon">📥</div>
    <div id="ade-header-info">
      <h3>${isIntakeForm ? (isEditMode ? "แก้ไขงานที่รับไว้" : "รับงานใหม่") : (isEditMode ? "แก้ไขงานวางแผนล่วงหน้า" : "เพิ่มงานวางแผนล่วงหน้า")}</h3>
      <small>${isIntakeForm ? "กรอกรับงานไว้ก่อน — ยังไม่ต้องระบุวันที่ ส่งลงตารางได้ทีหลังจากเมนู “รับงาน”" : "ยังไม่ต้องระบุวันที่ — ลาก/กดลงตารางได้ทีหลัง"}</small>
    </div>
  </div>

  <div id="ade-body">
    <div class="ade-month-badge" id="ade-monthBadge">📌 เดือนที่ตั้งใจ: ${monthLabel}</div>

    ${!isAdminOrManagerUser ? `<div class="ade-approval-note">⏳ แผนงานนี้จะขึ้นแสดงทันที แต่ต้องรอแอดมิน/manager อนุมัติก่อน จึงจะถือว่ายืนยันสมบูรณ์</div>` : ""}

    ${isIntakeForm ? `
    <!-- ✅ (15 ต.ค. 2569 ผู้ใช้: "ได้รับแจ้งงานมาเช่น PO หรือใบเสนอราคา ... ลงว่าจากแผนกอะไร ... ถ้าไม่มีเข้างาน เช่นส่งของ ขายของ")
         การ์ดแรกของฟอร์มรับงาน: รับงานจาก · รูปแบบงาน · เอกสารที่ได้รับ (ใช้ได้ทั้งตอนเพิ่มและแก้ไข) -->
    <!-- 🐛 (15 ต.ค. 2569 ผู้ใช้: "กดแก้ไขงานนี้ทำไมเด้งมามั่วๆ") — ตอนแก้ไข ห้ามกู้คืนตัวเลือกในการ์ดนี้จากข้อมูลที่กรอกค้าง
         (เคยกู้ "ส่งช่างเข้างาน/PM" ที่ค้างจากรอบก่อนมาทับรูปแบบจริงของงาน → เปิดแก้ไขงานจดงานแล้วกลายเป็นฟอร์มงานเข้างาน) -->
    <div class="ade-card" ${isEditMode ? "data-no-draft" : ""}>
      <!-- 🔁 (15 ต.ค. 2569 ผู้ใช้: "ตัวเลือกดูสับสน รกเกินไป" · "ยังไม่สวย ดูเยื้องๆ" · "ใช้คำที่สื่อความหมายชัดเจน")
           แถบเลือกแบบเดียวกันทั้งการ์ด ช่องกว้างเท่ากันทุกช่อง · เรียงตามลำดับที่ต้องตัดสินใจ -->
      <div class="ade-field">
        <label><span class="req">*</span> งานนี้ต้องทำอะไร</label>
        <div class="ade-seg ade-seg-3">
          ${[["visit", "🛠️", "ส่งช่างเข้างาน"], ["novisit", "🚚", "ส่งของ / ขายของ"], ["note", "📝", "จดโน๊ตงาน"]].map(([v, ic, l]) => `<label><input type="radio" name="adeVisitMode" value="${v}" ${(existingDraft?.intakeNote ? "note" : existingDraft?.noVisit ? "novisit" : "visit") === v ? "checked" : ""}><span><i>${ic}</i><b>${l}</b></span></label>`).join("")}
        </div>
        <span id="ade-modeDesc" class="ade-hint"></span>
      </div>

      <!-- ✅ (15 ต.ค. 2569 ผู้ใช้: "ประเภทงานควรมีเพิ่มให้เหมาะสม" → เลือก "รวมเป็นช่องเดียว")
           ตัวเลือกด่วน = ประเภทงาน (title) ที่ใช้บ่อย · "อื่นๆ" = เลือก/พิมพ์จากรายการเดิม · โปรเจค → หมวด "งานโปรเจค" -->
      <div class="ade-field ade-gap" id="ade-jobTypeField">
        <label><span class="req">*</span> ประเภทงาน</label>
        <div class="ade-seg ade-seg-3">
          ${QUICK_TYPES.map((t) => `<label><input type="radio" name="adeQuickType" value="${t.key}" ${quickTypeOf(existingDraft) === t.key ? "checked" : ""}><span><i>${t.icon}</i><b>${t.label}</b></span></label>`).join("")}
        </div>
      </div>

      <div class="ade-field ade-gap" id="ade-sourceField">
        <label><span class="req">*</span> รับงานมาจาก</label>
        <div class="ade-seg ade-seg-4">
          ${[["sales", "ฝ่ายขาย"], ["service", "ฝ่ายบริการ"], ["project", "ฝ่ายโครงการ"], ["customer", "ลูกค้าโดยตรง"]].map(([v, l]) => `<label><input type="radio" name="adeIntakeSource" value="${v}" ${existingDraft?.intakeSource === v ? "checked" : ""}><span><b>${l}</b></span></label>`).join("")}
        </div>
      </div>

      <div class="ade-field ade-gap">
        <label>เอกสารที่ได้รับมากับงาน <span class="ade-hint">· ไม่บังคับ</span></label>
        <div class="ade-seg ade-seg-4">
          ${[["", "ไม่มีเอกสาร"], ["po", "ใบสั่งซื้อ (PO)"], ["quotation", "ใบเสนอราคา"], ["other", "เอกสารอื่น"]].map(([v, l]) => `<label><input type="radio" name="adeIntakeDocType" value="${v}" ${(existingDraft?.intakeDocType || "") === v ? "checked" : ""}><span><b>${l}</b></span></label>`).join("")}
        </div>
      </div>
      <div id="ade-docFields" class="ade-grid ade-grid-2" style="margin:12px 0 0;${existingDraft?.intakeDocType ? "" : "display:none;"}">
        <div class="ade-field">
          <label>เลขที่เอกสาร <span class="ade-hint">· ถ้ามี</span></label>
          <input id="adeIntakeDocNo" type="text" placeholder="เช่น PO-2569-0123" value="${attr(existingDraft?.intakeDocNo)}">
        </div>
        <div class="ade-field" data-no-draft>
          <label>แนบไฟล์เอกสาร</label>
          <label class="ade-file">
            <input id="adeIntakeFiles" type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx">
            <span id="ade-fileText">📎 แตะเพื่อเลือกไฟล์ · รูป, PDF, Word, Excel</span>
          </label>
          ${(existingDraft?.sitePhotoFiles || []).some((f) => f.source === "intake") ? `<span class="ade-hint">แนบไว้แล้ว ${(existingDraft.sitePhotoFiles || []).filter((f) => f.source === "intake").length} ไฟล์ · เลือกเพิ่มได้</span>` : ""}
        </div>
      </div>
    </div>` : ""}

    ${isEditMode || isIntakeForm ? "" : `
    <div id="ade-jobTypeBlock">
    <p class="ade-section-label">${isIntakeForm ? "ประเภทงาน" : "ขั้นตอนที่ 1 — ประเภทงาน"}</p>
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
      <label class="ade-jobtype-option" ${isIntakeForm ? 'style="display:none"' : ""}>
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
    ${selectableContracts.length === 0 && !isIntakeForm
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
    </div>
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

    <!-- ✅ (9 ต.ค. 2569) ขั้นที่ 1 รับงาน — ผู้ติดต่อ + อาการเสีย/ขอบเขตงาน (เฉพาะงานทั่วไป/โปรเจค) -->
    <div id="ade-intakeSection">
      <hr class="ade-divider">
      <p class="ade-section-label">รายละเอียดงานที่รับ <span style="font-weight:600;color:#94a3b8;text-transform:none;">· ไม่บังคับ</span></p>
      <div class="ade-grid ade-grid-2" id="ade-contactGrid">
        <div class="ade-field">
          <label id="ade-contactLabel">👤 ผู้ติดต่อหน้างาน</label>
          <input id="adeContactName" type="text" placeholder="ชื่อผู้ติดต่อ" value="${attr(existingDraft?.contactName)}">
        </div>
        <div class="ade-field">
          <label>📞 เบอร์โทร</label>
          <input id="adeContactTel" type="tel" placeholder="เช่น 081-234-5678" value="${attr(existingDraft?.contactTel)}">
        </div>
      </div>
      ${canAssignResp ? `
      <div class="ade-field" style="margin-top:12px;">
        <label>🧑‍💼 ผู้รับผิดชอบงาน</label>
        <select id="adeResp">${respOpts}</select>
        <div style="font-size:12px;color:#64748b;margin-top:4px;">ผู้รับผิดชอบจะได้รับแจ้งเตือน และกดรับทราบ → ยืนยันนัดหมาย ในหน้า "งานของฉัน"</div>
      </div>` : ""}
      <div class="ade-field" style="margin-top:12px;">
        <label>📝 อาการเสีย / ขอบเขตงาน</label>
        <textarea id="adeDescription" rows="5" placeholder="เช่น ตู้ควบคุมแจ้งเตือน Fault โซน 3 · ลูกค้าขอเข้าก่อน 10 โมง">${attr(existingDraft?.description)}</textarea>
      </div>
      <div id="ade-jobInfoBlock">${jobInfoSectionHtml(existingDraft || {}, "ade")}</div>
    </div>

    <div id="ade-contractPickSection" style="display:none;">
      <p class="ade-section-label">ขั้นตอนที่ 2 — เลือกสัญญา</p>
      <div class="ade-field" style="margin-bottom:16px;">
        <label><span class="req">*</span> เลือกสัญญา</label>
        <select id="ade-contractPick"><option value="" selected disabled>— เลือกสัญญา —</option>${contractOpts}</select>
      </div>
      <div class="ade-contract-pick-info" id="ade-contractPickInfo"></div>
    </div>

    <div id="ade-monthBlock">
    <hr class="ade-divider">

    <p class="ade-section-label">เดือนที่ตั้งใจจะทำงานนี้</p>
    <div class="ade-grid ade-grid-2">
      <div class="ade-field">
        <label><span class="req">*</span> เดือน/ปี</label>
        <input id="adeMonth" type="month" value="${monthValue}">
      </div>
    </div>
    </div>
  </div>

  <div id="ade-action-bar">
    <div class="ade-btn-spacer"></div>
    <button class="ade-btn ade-btn-ghost" id="ade-btnCancel">ยกเลิก</button>
    <button class="ade-btn ade-btn-success" id="ade-btnConfirm">${isEditMode ? "💾 บันทึกการแก้ไข" : (isIntakeForm ? "💾 บันทึกรับงาน" : "💾 บันทึกงานล่วงหน้า")}</button>
  </div>
</div>
`;

  return new Promise((resolve) => {
    Swal.fire({
      html,
      width: isIntakeForm ? "980px" : "720px",
      showConfirmButton: false,
      showCancelButton: false,
      showCloseButton: true,
      customClass: { popup: isIntakeForm ? "swal-add-draft swal-add-draft-wide" : "swal-add-draft" },
      allowOutsideClick: false,
      allowEscapeKey: false,

      // ⚠️ คืนทรัพยากรของช่องเลือกเดือนที่ mount ไว้ ไม่งั้น React root จะค้างทุกครั้งที่เปิดกล่อง
      willClose: (popup) => {
        popup.__thaiDpCleanup?.();
        formDraftCtl?.stop(); // ปิดโดยไม่ได้บันทึก → เก็บค่าล่าสุดไว้กู้คืน
      },

      didOpen: () => {
        // ✅ (15 ต.ค. 2569) การ์ดที่มาของงาน — เลือกชนิดเอกสารแล้วค่อยโชว์ช่องเลขที่/แนบไฟล์ · โชว์ชื่อไฟล์ที่เลือก
        if (isIntakeForm) {
          const docFields = document.getElementById("ade-docFields");
          const syncDoc = () => {
            const v = document.querySelector('input[name="adeIntakeDocType"]:checked')?.value || "";
            if (docFields) docFields.style.display = v ? "" : "none";
          };
          document.querySelectorAll('input[name="adeIntakeDocType"]').forEach((r) => r.addEventListener("change", syncDoc));
          // บันทึกงาน: บอกว่ากรอกแค่สิ่งที่ต้องทำก็พอ · เปลี่ยนหัวช่องรายละเอียดให้ตรงความหมาย
          const descLabel = document.getElementById("adeDescription")?.closest(".ade-field")?.querySelector("label");
          // ✅ (15 ต.ค. 2569 ผู้ใช้: "ทำให้เป็นฟอร์มรูปแบบ auto และใช้งานง่ายมากขึ้น") — ฟอร์มปรับตัวตามรูปแบบงาน
          //    ต้องเข้างาน = ครบทุกช่อง · ไม่ต้องเข้างาน = ไม่ถามเดือนเข้างาน, ผู้ติดต่อ (ไม่ใช่หน้างาน), รายการที่ส่ง
          //    บันทึกงาน = เหลือแค่สิ่งที่ต้องทำ + ผู้รับผิดชอบ/ความเร่งด่วน (ซ่อนโครงการ/ประเภท/เดือน)
          const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? "" : "none"; };
          const descArea = document.getElementById("adeDescription");
          const syncMode = () => {
            const mode = document.querySelector('input[name="adeVisitMode"]:checked')?.value || "visit";
            const note = mode === "note";
            const md = document.getElementById("ade-modeDesc");
            if (md) {
              md.textContent = note ? "จดเรื่องที่ต้องทำไว้กันลืม — กรอกแค่ “สิ่งที่ต้องทำ” ด้านล่าง แล้วกดทำเสร็จเมื่อเรียบร้อย"
                : mode === "novisit" ? "กรอกแค่ลูกค้า เอกสาร และรายการที่ต้องส่ง — ส่งของแล้วกด “ส่งมอบแล้ว” แล้วอัปโหลดใบวางบิล"
                  : "รับงานไว้ก่อน แล้วกด “ส่งลงตาราง” เลือกวันและช่างที่จะเข้างาน";
            }
            show("ade-sourceField", !note);
            // 🔁 (15 ต.ค. 2569 ผู้ใช้: "รูปแบบส่งของ ขายของ ไม่ควรมีรายละเอียดเยอะ ให้ง่ายๆ")
            //    ส่งของ/ขายของ: ไม่ถามประเภทงาน · ระบบงาน · ความเร่งด่วน/อุปกรณ์ · เดือนเข้างาน
            show("ade-jobTypeField", mode === "visit");
            // 🔁 (15 ต.ค. 2569 ผู้ใช้: "จดงาน ให้เหลือแค่รายละเอียดก็พอ ดูรกๆ") — ความเร่งด่วน/อุปกรณ์/รอข้อมูล เฉพาะงานเข้างาน
            show("ade-jobInfoBlock", mode === "visit");
            const intakeHead = document.querySelector("#ade-intakeSection > .ade-section-label");
            if (intakeHead) intakeHead.style.display = note ? "none" : "";
            const sysField = document.getElementById("adeSystem")?.closest(".ade-field");
            if (sysField) sysField.style.display = mode === "visit" ? "" : "none";
            const sectionLabel = document.querySelector("#ade-generalSection .ade-section-label");
            if (sectionLabel) sectionLabel.textContent = mode === "novisit" ? "ลูกค้า" : "ข้อมูลโครงการ";
            Swal.getPopup()?.dispatchEvent(new Event("ade-mode"));
            show("ade-jobTypeBlock", !note);
            show("ade-generalSection", !note);
            show("ade-contactGrid", !note);
            show("ade-monthBlock", mode === "visit");
            show("ade-monthBadge", mode === "visit");
            const contactLabel = document.getElementById("ade-contactLabel");
            if (contactLabel) contactLabel.textContent = mode === "novisit" ? "👤 ผู้ติดต่อ / ผู้รับของ" : "👤 ผู้ติดต่อหน้างาน";
            if (descLabel) {
              descLabel.innerHTML = note ? '<span class="req">*</span> สิ่งที่ต้องทำ'
                : mode === "novisit" ? "📦 รายการสินค้า / สิ่งที่ต้องส่งมอบ" : "📝 อาการเสีย / ขอบเขตงาน";
            }
            if (descArea) {
              descArea.rows = note ? 8 : 5; // จดงาน = ช่องเดียวในฟอร์ม ให้กว้างพอเขียนได้สบาย
              descArea.placeholder = note ? "เช่น โทรตามลูกค้าเรื่องใบเสนอราคา · เตรียมเอกสารส่งมอบงาน"
                : mode === "novisit" ? "เช่น อุปกรณ์ Smoke Detector 10 ตัว · ส่งที่ห้องเครื่อง ชั้น B1"
                  : "เช่น ตู้ควบคุมแจ้งเตือน Fault โซน 3 · ลูกค้าขอเข้าก่อน 10 โมง";
            }
            // 🐛 focus() ธรรมดาทำให้เบราว์เซอร์เลื่อนกล่อง Swal ระหว่างแอนิเมชันเปิด → ฟอร์มเด้งเยื้อง — ใช้ preventScroll
            if (note) descArea?.focus({ preventScroll: true });
          };
          document.querySelectorAll('input[name="adeVisitMode"]').forEach((r) => r.addEventListener("change", syncMode));
          // 🐛 (15 ต.ค. 2569 ผู้ใช้: "กดแก้ไขงานจดงาน ไม่เข้าหน้าจดงานทันที ผ่านหน้าอื่นก่อน เด้งเพี้ยน")
          //    จัดฟอร์มตามรูปแบบงานทันทีตอนเปิด (เดิมรอ 350ms → เห็นฟอร์มเต็มก่อนแล้วค่อยหด) · รอบหลังสำหรับข้อมูลที่กู้คืน
          syncDoc(); syncMode();
          setTimeout(() => { syncDoc(); syncMode(); }, 350); // หลังกู้คืนข้อมูลที่กรอกค้าง
          const fileInput = document.getElementById("adeIntakeFiles");
          fileInput?.addEventListener("change", () => {
            const n = fileInput.files?.length || 0;
            const t = document.getElementById("ade-fileText");
            if (t) t.textContent = n ? `📎 ${n === 1 ? fileInput.files[0].name : `เลือกแล้ว ${n} ไฟล์`}` : "📎 แตะเพื่อเลือกไฟล์ · รูป, PDF, Word, Excel";
          });
        }
        // ✅ กู้คืนข้อมูลที่กรอกค้างไว้ (ภายใน 10 นาที) — ต้องก่อน TomSelect/ปฏิทิน พ.ศ. mount ให้มันอ่านค่าที่เติมคืน
        {
          const fd = domFormDraft(Swal.getPopup(), (existingDraft ? `editDraft:${existingDraft._id}` : intake ? "intake" : "addDraft"), { bannerHost: "#ade-body" });
          formDraftCtl = fd;
          fd.restore();
          setTimeout(() => fd.start(), 300);
        }
        // ✅ ช่อง <input type="month"> ของเบราว์เซอร์แสดง ค.ศ. เสมอ และบังคับเป็นไทยไม่ได้
        // — แทนด้วยตัวเลือกเดือนของแอปที่เป็น พ.ศ. (ค่าที่เก็บยังเป็น "YYYY-MM" ของ ค.ศ. เหมือนเดิม)
        Swal.getPopup().__thaiDpCleanup = mountThaiDatePickers(Swal.getPopup());
        bindJobInfo(Swal.getPopup());
        const mkTs = (id, placeholder = "") => {
          // ⚠️ เดิม fix ไว้ 7 ตัดรายชื่อ/ตัวเลือกที่มีเกิน 7 รายการทิ้งไปเงียบๆ (ห้องสมุด TomSelect
          // ค่า default จริงคือ 50 อยู่แล้ว) ทำให้ dropdown บริษัท/โครงการ/ประเภทงาน/ระบบงาน "หาไม่เจอ"
          // เป็นบางที เวลารายการมีมากกว่า 7 รายการ — ผู้เรียกควรส่ง length ของรายการจริงมาแทน
          try {
            return new TomSelect(id, {
              create: true,
              maxOptions: 20, // ✅ แสดงสูงสุด 20 แถว (กันหน่วง) + ป้ายบอกว่ามีเพิ่ม — ดู MAX_OPTIONS_NOTE ใน shared/utils/tomSelectFixes.js
              placeholder,
              sortField: { field: "text", direction: "asc" },
              allowEmptyOption: true,
              dropdownParent: "body", // ✅ กันพื้นที่เลื่อน (overflow-y:auto) ตัดขอบ dropdown
            });
          } catch { return null; }
        };

        const companyTs = mkTs("#adeCompany", "เลือกหรือพิมพ์ชื่อบริษัท", customers.userCustomers.length || 50);
        const siteTs = mkTs("#adeSite",    "เลือกหรือพิมพ์ชื่อโครงการ", customers.userCustomers.length || 50);
        const titleTs = mkTs("#adeTitle",   "เลือกหรือพิมพ์ประเภทงาน", (jobTypes?.items || []).length || 50);
        const systemTs = mkTs("#adeSystem",  "เลือกหรือพิมพ์ระบบงาน", (systemTypes?.items || []).length || 50);

        // ✅ (15 ต.ค. 2569) ประเภทงานแบบเลือกด่วน — ตั้งค่าช่องประเภทงาน (title) ให้ · "อื่นๆ" ค่อยโชว์ช่องเดิมให้เลือก/พิมพ์
        if (isIntakeForm && !isContractLinked) {
          const titleField = document.getElementById("adeTitle")?.closest(".ade-field");
          const titleGrid = titleField?.parentElement;
          const titleLabel = titleField?.querySelector("label");
          if (titleLabel) titleLabel.innerHTML = '<span class="req">*</span> ระบุประเภทงาน';
          const findName = (q) => (jobTypes?.items || []).map((t) => t.name)
            .find((n) => q.match.some((m) => String(n).toLowerCase().includes(m))) || q.name;
          let firstSync = true;
          const syncQuick = (evt) => {
            const key = document.querySelector('input[name="adeQuickType"]:checked')?.value || "";
            const q = QUICK_TYPES.find((x) => x.key === key);
            const other = !q || q.key === "other";
            const visit = (document.querySelector('input[name="adeVisitMode"]:checked')?.value || "visit") === "visit";
            const showTitle = visit && other;
            if (titleField) titleField.style.display = showTitle ? "" : "none";
            if (titleGrid) { titleGrid.classList.toggle("ade-grid-3", showTitle); titleGrid.classList.toggle("ade-grid-2", !showTitle); }
            if (!titleTs || evt?.type === "ade-mode") return; // เปลี่ยนรูปแบบงาน = แค่ซ่อน/โชว์ ไม่แตะค่า
            if (other) {
              // เปลี่ยนจากตัวเลือกด่วนมาเป็น "อื่นๆ" → ล้างค่าที่ระบบเติมไว้ ให้เลือกเอง (ตอนเปิดฟอร์มแก้ไขคงค่าเดิม)
              if (!firstSync && key === "other") titleTs.clear(true);
            } else {
              const name = findName(q);
              if (!titleTs.options[name]) titleTs.addOption({ value: name, text: name });
              titleTs.setValue(name, true);
            }
            firstSync = false;
          };
          document.querySelectorAll('input[name="adeQuickType"]').forEach((r) => r.addEventListener("change", syncQuick));
          Swal.getPopup()?.addEventListener("ade-mode", syncQuick);
          syncQuick({ type: "ade-mode" }); // จัดการแสดงผลทันที (ไม่แตะค่า)
          setTimeout(syncQuick, 360);
        }

        // ✅ (15 ต.ค. 2569 ผู้ใช้: "ฟอร์มรูปแบบ auto") เลือกโครงการแล้วเติมให้เอง — เฉพาะช่องที่ยังว่าง (ไม่ทับที่กรอกเอง)
        //    บริษัท + ผู้ติดต่อ/เบอร์ จากทะเบียนลูกค้า · ประเภทงาน/ระบบ จากงานล่าสุดของโครงการนี้
        if (isIntakeForm && !isContractLinked) {
          const history = [...(events || []), ...(drafts || [])]
            .filter((e) => e.site && e.department !== "sales")
            .sort((a, b) => new Date(b.updatedAt || b.start || 0) - new Date(a.updatedAt || a.start || 0));
          const fillIfEmpty = (id, value) => {
            const el = document.getElementById(id);
            if (el && value && !String(el.value || "").trim()) {
              el.value = value;
              el.classList.add("ade-autofilled");
              setTimeout(() => el.classList.remove("ade-autofilled"), 1600);
            }
          };
          const tsFill = (ts, value) => {
            if (!ts || !value || ts.getValue()) return;
            if (!ts.options[value]) ts.addOption({ value, text: value });
            ts.setValue(value, true);
          };
          siteTs?.on("change", (site) => {
            if (!site) return;
            const cust = customers.userCustomers.find((c) => c.cSite === site);
            tsFill(companyTs, cust?.cCompany);
            fillIfEmpty("adeContactName", cust?.cName);
            fillIfEmpty("adeContactTel", cust?.tel);
            const last = history.find((e) => e.site === site);
            if (["", "other"].includes(document.querySelector('input[name="adeQuickType"]:checked')?.value || "")) tsFill(titleTs, last?.title);
            tsFill(systemTs, last?.system);
            if (!cust?.cName) fillIfEmpty("adeContactName", last?.contactName);
            if (!cust?.tel) fillIfEmpty("adeContactTel", last?.contactTel);
          });
          // เลือกบริษัทก่อน → รายการโครงการเหลือเฉพาะของบริษัทนั้นขึ้นก่อน (ยังพิมพ์ใหม่ได้)
          companyTs?.on("change", (company) => {
            if (!siteTs || !company || siteTs.getValue()) return;
            const mine = customers.userCustomers.filter((c) => c.cCompany === company);
            if (mine.length === 1) tsFill(siteTs, mine[0].cSite);
          });
        }
        // ✅ ช่อง "ครั้งที่" ตัดออกไปแล้วสำหรับงานทั่วไป/งานโปรเจค (เหลือเฉพาะตอนแก้ไขงานที่ผูกสัญญา
        // อยู่แล้ว — ดู isContractLinked ตอน render HTML) เช็คว่ามี element อยู่จริงก่อนค่อย init TomSelect
        if (document.getElementById("adeTime")) mkTs("#adeTime", "เลือกครั้งที่", 4);

        // ✅ (11 ต.ค. 2569 ผู้ใช้: "ผู้รับผิดชอบงาน แก้ UI ให้สวย มีรูปเหมือนหน้าอื่นๆ ด้วย")
        //    รายชื่อพร้อมรูป (ไม่มีรูป = ตัวอักษรย่อบนสีประจำตัว แบบ PersonChip) · ค้นหาชื่อได้
        if (document.getElementById("adeResp")) {
          const av = (name, img) => {
            const letter = `<span style="flex-shrink:0;width:30px;height:30px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;background:${name ? personColor(name) : "#cbd5e1"}">${escapeHtml(name ? personInitial(name) : "?")}</span>`;
            return img
              ? `<span style="position:relative;flex-shrink:0;width:30px;height:30px;">${letter}<img src="${escapeHtml(img)}" alt="" onerror="this.remove()" style="position:absolute;inset:0;width:30px;height:30px;border-radius:50%;object-fit:cover;"></span>`
              : letter;
          };
          const row = (d, small) => `<div style="display:flex;align-items:center;gap:10px;padding:${small ? "2px 0" : "6px 2px"};min-width:0;">
              ${av(d.value, d.img)}
              <div style="min-width:0;line-height:1.3;">
                <div style="font-size:14px;font-weight:600;color:${d.value ? "#0f172a" : "#94a3b8"};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(d.text)}</div>
                ${d.sub && !small ? `<div style="font-size:12px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(d.sub)}</div>` : ""}
              </div>
            </div>`;
          try {
            new TomSelect("#adeResp", {
              options: [{ value: "", text: "ยังไม่มอบหมาย", img: "", sub: "" },
                ...respUsers.map((u) => ({ value: u.fname, text: [u.fname, u.lname].filter(Boolean).join(" "), img: u.imageUrl || "", sub: u.jobTitle || "" }))],
              items: [initialResp],
              searchField: ["text", "sub"],
              maxOptions: 200,
              allowEmptyOption: true,
              dropdownParent: "body",
              render: { option: (d) => row(d, false), item: (d) => row(d, true) },
            });
          } catch { /* ใช้ select ปกติ */ }
        }

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
            maxOptions: 20, // ✅ แสดงสูงสุด 20 แถว (กันหน่วง) + ป้ายบอกว่ามีเพิ่ม — ดู MAX_OPTIONS_NOTE ใน shared/utils/tomSelectFixes.js
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
          const radioVal = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value || "";

          const jobType = document.querySelector('input[name="ade-jobType"]:checked')?.value
            || (radioVal("adeQuickType") === "project" ? "project" : "general");

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
                contactName: getVal("adeContactName"),
                contactTel: getVal("adeContactTel"),
                description: getVal("adeDescription"),
                ...readJobInfo(Swal.getPopup()),
              };
              await EventService.AddDraftEvent(contractPayload);
              isSavingDraft = false;

              formDraftCtl?.clear(); // บันทึกสำเร็จ → ล้างข้อมูลที่กรอกค้าง
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

          // ✅ (15 ต.ค. 2569) บันทึกงาน (โน๊ต) — บังคับแค่สิ่งที่ต้องทำ
          const isNoteMode = isIntakeForm && radioVal("adeVisitMode") === "note";
          const isDeliveryMode = isIntakeForm && radioVal("adeVisitMode") === "novisit";
          if (isNoteMode) {
            if (!getVal("adeDescription")) { Swal.showValidationMessage("กรุณาระบุสิ่งที่ต้องทำ"); return; }
          } else if (isDeliveryMode) {
            if (!site) { Swal.showValidationMessage("กรุณาระบุลูกค้า / โครงการ"); return; }
          } else {
            if (!site)   { Swal.showValidationMessage("กรุณาระบุชื่อโครงการ");  return; }
            if (!title)  { Swal.showValidationMessage("กรุณาระบุประเภทงาน");    return; }
            if (!system) { Swal.showValidationMessage("กรุณาระบุระบบงาน");      return; }
          }
          if (!plannedMonth) { Swal.showValidationMessage("กรุณาระบุเดือนที่ตั้งใจ"); return; }
          if (isIntakeForm && radioVal("adeVisitMode") === "visit" && !radioVal("adeQuickType")) { Swal.showValidationMessage("กรุณาเลือกประเภทงาน"); return; }
          if (isIntakeForm && radioVal("adeVisitMode") !== "note" && !radioVal("adeIntakeSource")) { Swal.showValidationMessage("กรุณาเลือกว่ารับงานจากแผนกไหน"); return; }
          const intakeFiles = isIntakeForm && radioVal("adeIntakeDocType") ? [...(document.getElementById("adeIntakeFiles")?.files || [])] : [];

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
              // ส่งของ/ขายของ ไม่ถามประเภทงาน/ระบบ — ตั้งชื่อประเภทงานให้เอง
              title: isDeliveryMode ? "ส่งของ / ขายของ" : title,
              system: isDeliveryMode ? "" : system,
              time: getVal("adeTime"),
              plannedMonth,
              contactName: getVal("adeContactName"),
              contactTel: getVal("adeContactTel"),
              description: getVal("adeDescription"),
              ...readJobInfo(Swal.getPopup()),
              ...(isIntakeForm ? {
                intakeSource: radioVal("adeIntakeSource"),
                intakeDocType: radioVal("adeIntakeDocType"),
                intakeDocNo: radioVal("adeIntakeDocType") ? getVal("adeIntakeDocNo") : "",
                noVisit: radioVal("adeVisitMode") === "novisit",
                intakeNote: radioVal("adeVisitMode") === "note",
              } : {}),
            };
            // ✅ ตั้งหมวดหมู่ "งานทั่วไป"/"งานโปรเจค" ให้เลยตั้งแต่ตอนสร้าง (ตามที่เลือกไว้ในขั้นตอนที่ 1)
            // แทนที่จะปล่อยว่างไว้แล้วต้องไปกดจัดหมวดหมู่ย้อนหลังทีหลังในหน้า "ภาพรวมงาน" เสมอ — เฉพาะตอน
            // สร้างใหม่เท่านั้น (โหมดแก้ไขไม่มี radio นี้ให้เลือก jobType จึงเป็นค่า fallback "general"
            // เสมอ ไม่ควรเอามาทับหมวดหมู่เดิมที่มีอยู่แล้วของ draft นั้น)
            if (!isEditMode) {
              payload.jobClassification = jobType === "project" ? "project" : "general";
              if (isIntakeForm) payload.fromIntake = true;
              // ✅ คนที่เพิ่มแผนงานทั่วไป/โปรเจคเองเป็นผู้รับผิดชอบงานนั้นทันทีโดยอัตโนมัติ (งานตามสัญญา
              // ยังคงให้ admin/manager มอบหมายเองผ่านหน้า "ภาพรวมงาน" เหมือนเดิม ไม่ตั้งตรงนี้) — ทีมที่
              // เข้างานจริงยังเลือกได้ตามปกติตอนกดลงตารางจริง (ดู scheduleDraft/swal-schedule-team ใน
              // EventCalendar/index.js) เพราะ draft ยังไม่รู้วันที่แน่นอน จึงยังไม่มีช่องเลือกทีมตรงนี้
              if (jobType !== "contract") {
                if (canAssignResp) {
                  const pick = getVal("adeResp");
                  const u = respUsers.find((x) => x.fname === pick);
                  payload.responsiblePerson = pick || "";
                  payload.responsiblePersonId = u?._id ? String(u._id) : "";
                } else if (!isIntakeForm) {
                  payload.responsiblePerson = userData?.fname || "";
                  payload.responsiblePersonId = userData?.userId || "";
                }
              }
            }

            let savedId = null;
            const existing = customers.userCustomers.find(
              (c) => c.cCompany === payload.company && c.cSite === payload.site
            );
            if (!existing && payload.site) {
              await CustomerService.AddCustomer({
                cCompany: payload.company ?? "",
                cSite:    payload.site    ?? "",
              }).catch(() => {});
            }
            if (title && !jobTypes?.items?.some((t) => t.name === title)) {
              await JobTypeService.add(title).catch(() => {});
            }
            if (system && !systemTypes?.items?.some((s) => s.name === system)) {
              await SystemTypeService.add(system).catch(() => {});
            }

            if (isEditMode) {
              await EventService.UpdateDraftEvent(existingDraft._id, payload);
              // ✅ เปลี่ยนผู้รับผิดชอบจากฟอร์มแก้ไขงานใหม่ → ผ่าน basic-info (บันทึกผู้ดำเนินการ + แจ้งคนใหม่)
              if (canAssignResp) {
                const pick = getVal("adeResp");
                if (pick !== (existingDraft?.responsiblePerson || "")) {
                  const u = respUsers.find((x) => x.fname === pick);
                  await EventService.UpdateBasicInfo([existingDraft._id], { responsiblePerson: pick || "", responsiblePersonId: u?._id ? String(u._id) : "" });
                }
              }
              savedId = existingDraft._id;
            } else {
              savedId = (await EventService.AddDraftEvent(payload))?._id;
            }
            // ✅ แนบเอกสารรับงาน (หลังบันทึกงานแล้ว) — ล้มบางไฟล์ไม่ทำให้งานหาย แจ้งให้แนบใหม่จากหน้าแก้ไข
            let failedFiles = 0;
            if (savedId && intakeFiles.length) {
              btn.textContent = "⏳ กำลังแนบไฟล์...";
              for (const f of intakeFiles) {
                try { await EventService.Upload(savedId, f, "intake"); } catch { failedFiles += 1; }
              }
            }
            isSavingDraft = false;

            formDraftCtl?.clear(); // บันทึกสำเร็จ → ล้างข้อมูลที่กรอกค้าง
            Swal.fire(failedFiles ? {
              title: "บันทึกงานแล้ว",
              text: `แต่แนบไฟล์ไม่สำเร็จ ${failedFiles} ไฟล์ — กด "แก้ไข" แล้วแนบใหม่ได้`,
              icon: "warning",
            } : {
              title: isEditMode ? "บันทึกการแก้ไขสำเร็จ ✅" : isIntakeForm ? "รับงานแล้ว ✅" : "บันทึกงานล่วงหน้าสำเร็จ ✅",
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
