import Toastify from "toastify-js";
import "toastify-js/src/toastify.css";
import { resolveOperationGroup } from "../../../utils/overdueJobs";
import { countUsedRounds, formatRoundLabel } from "../../../utils/contractRounds";
import { escapeHtml } from "../../../utils/escapeHtml";
import { getApprovalState } from "../../../utils/approvalStatus";
import { getActivityLogMeta } from "../../../utils/activityLogMeta";
import { classifyJob, getJobClassMeta } from "../../../utils/jobClassification";

// ✅ ป้องกัน stored XSS — ค่าที่ผู้ใช้พิมพ์เอง (ชื่อบริษัท/โครงการ/ประเภทงาน/ระบบ/ทีม ฯลฯ) ต้อง escape
// ก่อนต่อเป็น HTML string เสมอ ไม่งั้นถ้ามีใครตั้งชื่อเป็น เช่น "><img src=x onerror="..."> จะยิง
// JavaScript ทันทีที่มีใครเปิดฟอร์มนี้ดู — ใช้ helper 2 ตัวนี้แทนต่อ string ตรงๆ ทุกจุด
const optionHtml = (value, selected) =>
  `<option value="${escapeHtml(value)}"${selected ? " selected" : ""}>${escapeHtml(value)}</option>`;
const attrHtml = (value) => escapeHtml(value);

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

    /* ✅ ปุ่มคัดลอก — แยกตำแหน่งออกจากแถบปุ่มด้านล่างโดยตั้งใจ (ไม่ปนกับ ดูการดำเนินงาน/ออกใบแจ้งเข้างาน
       ที่เป็นแถวยาวด้านล่าง) มาไว้ที่หัว modal แทนให้เห็นชัด กดง่าย ไม่หลงในแถวปุ่มอื่น */
    #ee-copy-btn {
      width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
      background: rgba(255,255,255,.18); border: 1.5px solid rgba(255,255,255,.30);
      color: #fff; font-size: 14px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background .15s; line-height: 1;
    }
    #ee-copy-btn:hover { background: rgba(255,255,255,.32); }

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

    /* ── กล่องสถานะอนุมัติ — อยู่บนสุดของฟอร์ม เหนือกล่องข้อมูลสัญญาด้วยซ้ำ เพราะเป็นข้อเท็จจริงที่
       สำคัญที่สุดของงานนี้ตอนยังไม่ approved (เทียบสีเดียวกับกล่องคำขอปิดงานในหน้า Operation/index.js
       ให้ธีมสีตรงกันทั้งแอป — amber=รออนุมัติ, red=ไม่อนุมัติ) ── */
    .ee-approval-box {
      border-radius: 12px; padding: 12px 16px; margin-bottom: 16px;
      font-size: 12.5px; line-height: 1.6;
    }
    .ee-approval-box--pending {
      background: #fffbeb; border: 1.5px solid #fde68a; color: #92400e;
    }
    .ee-approval-box--rejected {
      background: #fef2f2; border: 1.5px solid #fecaca; color: #991b1b;
    }
    .ee-approval-box b { display: block; font-size: 13.5px; margin-bottom: 4px; }
    .ee-approval-box .ee-approval-actions { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
    .ee-approval-reason-bar {
      display: none; margin-top: 10px; padding-top: 10px; border-top: 1px dashed rgba(0,0,0,.15);
    }
    .ee-approval-reason-bar textarea {
      width: 100%; box-sizing: border-box; min-height: 60px; resize: vertical;
      border: 1.5px solid #fca5a5; border-radius: 8px; padding: 8px 10px;
      font-size: 12.5px; font-family: inherit; margin-bottom: 8px;
    }

    /* ── กล่องข้อมูลสัญญา — แยกโทนสีจากส่วนอื่นชัดเจน (ม่วง-น้ำเงิน) ให้เห็นตั้งแต่แวบแรกว่าเป็นข้อมูล
       ระดับ "ทั้งสัญญา" ไม่ใช่แค่ครั้งที่นี้ครั้งเดียว (อยู่บนสุดของฟอร์ม กดเข้ามาก็เจอเลย) ── */
    .ee-contract-box {
      background: linear-gradient(135deg, #eef2ff, #f5f3ff);
      border: 1.5px solid #c7d2fe; border-radius: 12px;
      padding: 14px 16px 6px; margin-bottom: 16px;
    }
    .ee-contract-box-label {
      font-size: 12.5px; font-weight: 700; color: #4338ca;
      margin: 0 0 10px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    }
    .ee-contract-box-label span {
      font-size: 11px; font-weight: 500; color: #6366f1;
    }
    .ee-contract-box .ee-field input {
      background: #fff; border-color: #ddd6fe;
    }
    .ee-contract-box .ee-field label { color: #4c1d95; }
    /* ✅ ดูอย่างเดียวสำหรับช่าง — เทาจาง + cursor not-allowed ให้ดูออกชัดว่าแก้ไม่ได้ ไม่ใช่แค่ลืมกรอก */
    .ee-contract-box .ee-field input:disabled {
      background: #f1f5f9; color: #64748b; border-color: #e2e8f0;
      cursor: not-allowed; opacity: 0.85;
    }

    /* ── บันทึกประวัติ (activityLog) — เทียบ pattern เดียวกับ ActivityLogMini ในหน้า Operation
       ย่อ/กางได้เหมือนกัน แค่ implement เป็น vanilla HTML/CSS แทน React component เพราะฟอร์มนี้
       ทั้งฟอร์ม build เป็น HTML string ให้ SweetAlert2 ไม่ใช่ JSX ── */
    .ee-log-toggle {
      width: 100%; text-align: left; background: none; border: none;
      color: #475569; font-size: 12.5px; font-weight: 700; cursor: pointer;
      padding: 4px 0; display: flex; align-items: center; justify-content: space-between;
    }
    .ee-log-toggle:hover { color: #1e293b; }
    .ee-log-list {
      margin-top: 6px; padding-left: 10px; border-left: 2px solid #e2e8f0;
      display: flex; flex-direction: column; gap: 10px; max-height: 240px; overflow-y: auto;
    }
    .ee-log-item { position: relative; display: flex; gap: 8px; }
    .ee-log-dot {
      position: absolute; left: -15px; top: 4px;
      width: 8px; height: 8px; border-radius: 50%; border: 2px solid #fff;
      box-shadow: 0 0 0 1px #e2e8f0;
    }
    .ee-log-body { flex: 1; min-width: 0; }
    .ee-log-head { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; font-size: 12px; }
    .ee-log-meta { color: #94a3b8; font-size: 11px; }
    .ee-log-detail { color: #94a3b8; font-size: 11px; font-style: italic; margin-top: 1px; }

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

    /* ── งานหลายวัน (multi-date, เหมือนหน้า Add) ── */
    .ee-checkbox-row {
      display: flex; align-items: center; gap: 8px;
      font-size: 12.5px; font-weight: 600; color: #374151;
      margin-bottom: 10px; cursor: pointer;
    }
    .ee-checkbox-row input { width: auto !important; cursor: pointer; }
    .ee-multi-date-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
    .ee-multi-date-row input[type=date] {
      flex: 1; box-sizing: border-box;
      border: 1.5px solid #e2e8f0; border-radius: 7px;
      padding: 7px 10px; font-size: 13px; color: #1e293b;
      background: #fff; font-family: inherit;
    }
    .ee-multi-date-row input:focus {
      outline: none; border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37,99,235,.10);
    }
    .ee-multi-date-row .ee-range-sep { flex-shrink: 0; color: #94a3b8; font-weight: 700; }
    .ee-multi-date-remove {
      flex-shrink: 0; width: 30px; height: 30px; padding: 0 !important;
      display: flex; align-items: center; justify-content: center;
    }
    /* ✅ แถบยืนยันลบช่วงวันที่ — เดิมใช้ window.confirm() ของเบราว์เซอร์ (หน้าตาไม่ตรงธีมแอปเลย)
       เปลี่ยนเป็นแถบในฟอร์มแทน ไม่ใช้ Swal.fire ซ้อนเพราะ modal นี้เป็น Swal อยู่แล้ว เปิดอีกอันจะ
       ไปแทนที่/ปิด modal เดิมทั้งอัน (ข้อมูลแถวอื่นที่ยังไม่บันทึกจะหายไปด้วย) */
    .ee-row-confirm-bar {
      display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
      background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 8px;
      padding: 8px 12px; margin: -2px 0 10px; font-size: 12.5px; font-weight: 600; color: #991b1b;
      animation: eeRowConfirmIn .15s ease;
    }
    @keyframes eeRowConfirmIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
    .ee-row-confirm-bar .ee-row-confirm-sub { font-weight: 500; color: #b91c1c; }
    .ee-row-confirm-actions { display: flex; gap: 6px; flex-shrink: 0; }
    .ee-row-confirm-actions .ee-btn { padding: 5px 12px; font-size: 12px; height: auto; }

    /* ── ลูกทีมเพิ่มเติม (คนที่ 2, 3, ... แสดงผลอย่างเดียว ไม่กระทบสิทธิ์) ── */
    .ee-team-member-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
    .ee-team-member-row select {
      flex: 1; box-sizing: border-box;
      border: 1.5px solid #e2e8f0; border-radius: 7px;
      padding: 7px 10px; font-size: 13px; color: #1e293b;
      background: #fff; font-family: inherit;
    }
    .ee-team-member-row select:focus {
      outline: none; border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37,99,235,.10);
    }
    .swal-edit-event .ee-team-member-row .ts-wrapper { flex: 1 1 auto; min-width: 0; width: auto; }
    .swal-edit-event .ee-team-member-row .ts-control { min-height: 34px; }
    .ee-team-member-remove {
      flex-shrink: 0; width: 30px; height: 30px; padding: 0 !important;
      display: flex; align-items: center; justify-content: center;
    }

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
    .ee-btn-warning   { background: #f59e0b; color: #fff; }
    .ee-btn-ghost     { background: #e2e8f0; color: #475569; }
    .ee-btn-attach    { background: #dc2626; color: #fff; }

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

// ✅ ป๊อปอัพเล็กๆ แยกต่างหากสำหรับ "ย้ายเข้าสัญญาที่มีอยู่แล้ว" (เปิดจากหน้าแก้ไขงาน) — ไม่ใช้
// scope .swal-edit-event ร่วมกับฟอร์มแก้ไขหลัก เพราะ header ของฟอร์มหลัก (#ee-status-header) ผูกกับสี
// ตามสถานะงานเฉพาะ ไม่เหมาะเอามาใช้ซ้ำกับป๊อปอัพนี้ — สไตล์เทียบ pattern เดียวกับไดอะล็อก
// "ย้ายเข้าสัญญาที่มีอยู่แล้ว" ในหน้า "ภาพรวมงาน" (ContractOverview.js) และตัวเลือกสัญญาการ์ด 2 บรรทัด
// เทียบ pattern เดียวกับ AddEvent.js/AddDraftEvent.js ให้ตรงกันทั้งแอป
function injectAttachStyles() {
  if (document.getElementById("ee-attach-styles")) return;
  const style = document.createElement("style");
  style.id = "ee-attach-styles";
  style.textContent = `
    .swal-ee-attach.swal2-popup {
      padding: 0 !important; border-radius: 16px !important; overflow: hidden !important;
      width: min(94vw, 480px) !important; font-family: 'Inter', system-ui, sans-serif !important;
      box-shadow: 0 25px 60px rgba(10,22,40,.35) !important;
    }
    .swal-ee-attach .swal2-html-container { margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
    .swal-ee-attach .swal2-title, .swal-ee-attach .swal2-actions, .swal-ee-attach .swal2-footer { display: none !important; }
    .swal-ee-attach .swal2-close {
      position: absolute; top: 14px; right: 16px; z-index: 99;
      width: 32px; height: 32px; border-radius: 50%;
      background: rgba(255,255,255,.15) !important; color: #fff !important;
      font-size: 18px; display: flex; align-items: center; justify-content: center;
      transition: background .2s;
    }
    .swal-ee-attach .swal2-close:hover { background: rgba(255,255,255,.30) !important; }
    #eea-header { padding: 18px 22px 16px; display: flex; align-items: center; gap: 12px; background: linear-gradient(135deg, #dc2626, #7f1d1d); }
    #eea-header-icon { font-size: 24px; line-height: 1; }
    #eea-header-info h3 { margin: 0; font-size: 16px; font-weight: 700; color: #fff; }
    #eea-header-info small { font-size: 12px; color: rgba(255,255,255,.75); }
    #eea-body { padding: 20px 22px; background: #f8fafc; }
    #eea-body label { font-size: 12px; font-weight: 600; color: #374151; display: block; margin-bottom: 5px; }
    #eea-body select {
      width: 100%; box-sizing: border-box; border: 1.5px solid #e2e8f0; border-radius: 8px;
      padding: 9px 12px; font-size: 14px; color: #1e293b; background: #fff; font-family: inherit;
    }
    .eea-round-label { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #64748b; margin: 18px 0 8px; }
    .eea-round-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 4px; }
    .eea-chip {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 40px; height: 32px; padding: 0 10px; border-radius: 8px;
      font-size: 12px; font-weight: 700; border: 1.5px solid #e2e8f0; background: #fff; color: #64748b; font-family: inherit;
    }
    button.eea-chip { cursor: pointer; transition: border-color .15s, background .15s, transform .15s; }
    button.eea-chip:hover { border-color: #dc2626; }
    .eea-chip--selected { border: 2px solid #dc2626 !important; background: #fef2f2 !important; color: #b91c1c !important; transform: scale(1.06); }
    .eea-chip--scheduled { border-color: #bbf7d0; background: #f0fdf4; color: #15803d; }
    .eea-chip--pending { border-color: #fde68a; background: #fffbeb; color: #b45309; cursor: not-allowed; }
    .eea-hint { font-size: 12px; color: #64748b; margin: 8px 0 0; }
    /* ✅ ตัวเลือกสัญญาใน dropdown (TomSelect render.option/item) — 2 บรรทัด (ชื่อบริษัท/โครงการตัวหนา
       + รายละเอียดย่อยพร้อมป้าย "เหลือ N ครั้ง") เทียบ pattern เดียวกับ AddEvent.js/AddDraftEvent.js/
       ContractOverview.js ให้ตรงกันทั้งแอป */
    .eea-contract-option { padding: 1px 0; }
    .eea-contract-option-main { font-size: 13px; font-weight: 700; color: #1e293b; }
    .eea-contract-option-sub { font-size: 11.5px; color: #64748b; margin-top: 2px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .eea-contract-option-badge {
      display: inline-flex; align-items: center; flex-shrink: 0;
      background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;
      border-radius: 20px; padding: 1px 9px; font-size: 10.5px; font-weight: 700; white-space: nowrap;
    }
    .swal-ee-attach .ts-dropdown .option.active .eea-contract-option-badge { background: #fff; border-color: #fff; }
    #eea-actions { display: flex; gap: 10px; justify-content: flex-end; padding: 14px 22px 18px; background: #f1f5f9; border-top: 1px solid #e2e8f0; }
    .eea-btn {
      display: inline-flex; align-items: center; gap: 6px; border: none; border-radius: 9px;
      padding: 9px 18px; font-size: 13px; font-weight: 700; cursor: pointer;
      transition: opacity .15s, transform .1s; font-family: inherit;
    }
    .eea-btn:hover { opacity: .88; transform: translateY(-1px); }
    .eea-btn-ghost   { background: #e2e8f0; color: #475569; }
    .eea-btn-success { background: #dc2626; color: #fff; }
    .swal-ee-attach .ts-wrapper .ts-control {
      border: 1.5px solid #e2e8f0 !important; border-radius: 8px !important;
      padding: 8px 12px !important; font-size: 14px !important; min-height: 40px;
    }
    .swal-ee-attach .ts-wrapper.focus .ts-control { border-color: #dc2626 !important; }
  `;
  document.head.appendChild(style);
}

// ✅ ครบทั้ง 4 สถานะ ให้ตรงกับ OP_LIST/OP_COLOR ของหน้า Operation เสมอ
// (เดิมมีแค่ 2 สถานะแรก ทำให้งานที่สถานะไปไกลกว่านั้นแล้ว เช่น "กำลังดำเนินการ" หา config ไม่เจอ
// แล้ว fallback ไปแสดงเป็น "กำลังรอยืนยัน" ผิดๆ ทั้ง header สีและตัวเลือกใน dropdown)
const STATUS_CONFIG = {
  กำลังรอยืนยัน: { bg: "linear-gradient(135deg,#475569,#64748b)", icon: "⏳" },
  ยืนยันแล้ว: { bg: "linear-gradient(135deg,#1d4ed8,#2563eb)", icon: "✅" },
  กำลังดำเนินการ: { bg: "linear-gradient(135deg,#6d28d9,#8b5cf6)", icon: "🔄" },
  ดำเนินการเสร็จสิ้น: { bg: "linear-gradient(135deg,#065f46,#10b981)", icon: "🎉" },
};

// ✅ ช่างแก้สถานะเองได้แค่ 2 สถานะแรก (กำลังรอยืนยัน/ยืนยันแล้ว) — สอดคล้องกับหน้า Operation
// ที่ปล่อยให้แอดมิน/manager เป็นคนเปลี่ยนสถานะขั้นถัดไป (กำลังดำเนินการ/ดำเนินการเสร็จสิ้น) เท่านั้น
const TECH_EDITABLE_STATUSES = ["กำลังรอยืนยัน", "ยืนยันแล้ว"];

// ✅ กันบันทึกซ้ำแบบ module-level เหมือนใน AddEvent.js — กันกรณี didOpen/listener ของปุ่มยืนยัน
// ถูก attach ซ้ำ (เช่น เปิดฟอร์มแก้ไขซ้อนกันสองครั้งเร็วๆ) ทำให้คลิกครั้งเดียวบันทึกสองรอบ
let isSavingEdit = false;

export const getEditEvent = async ({
  navigate,
  events,
  fetchEventsFromDB,
  fetchLookupOptions,
  eventInfo,
  setLoading,
  generateWorkPermitPDF,
  handleDeleteEvent,
  handleUnscheduleEvent,
  onCopyEvent,
  EventService,
  CustomerService,
  AuthService,
  JobTypeService,
  SystemTypeService,
  Swal,
  TomSelect,
  moment,
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
  const eventTeamMembers = ev.extendedProps?.teamMembers || [];
  const eventTime = ev.extendedProps?.time || "";
  const eventFontSize = ev.extendedProps?.fontSize;
  const eventStart = moment(ev.start);
  const eventEnd = moment(ev.end);
  const eventAllDay = ev.allDay;
  const eventStatus = ev.extendedProps?.status || "กำลังรอยืนยัน";
  const eventSubject = ev.extendedProps?.subject || "";
  const eventDescription = ev.extendedProps?.description || "";
  // ✅ normalize เผื่อข้อมูลเก่าที่กรอกเป็น text อิสระมาก่อน (เช่น "8.00" ใช้จุดแทนโคลอน ไม่มีเลขศูนย์นำหน้า)
  // ตอนนี้เปลี่ยนช่องเป็น <input type="time"> ซึ่งรับได้แค่รูปแบบ HH:mm มาตรฐานเท่านั้น
  // ถ้าไม่ normalize ค่าเก่าที่ไม่ตรงรูปแบบจะโชว์ว่างเปล่า แล้วถ้าผู้ใช้กดบันทึกโดยไม่ได้แก้ไข
  // ช่องนี้จะถูกเขียนทับเป็นค่าว่างไปเลย ทั้งที่จริงมีข้อมูลอยู่
  // const normalizeTime = (t) => {
  //   const m = String(t || "").trim().match(/^(\d{1,2})[.:](\d{2})$/);
  //   return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
  // };
  const eventStartTime = ev.extendedProps?.startTime;
  const eventEndTime = ev.extendedProps?.endTime;
  const userId = ev.extendedProps?.userId; // ⚠️ นี่คือ id ของ "คนสร้าง event" ไม่ใช่ผู้ใช้ที่ล็อกอินอยู่ตอนนี้

  // ✅ งานที่เข้าหลายวันแบบไม่ติดกัน (ผูกกันด้วย jobGroupId) — หา event วันอื่นๆ ของงานเดียวกัน
  // เพื่อโชว์ในหน้าแก้ไข และให้เพิ่ม/ลบวันที่ของงานนี้ได้จากตรงนี้เลย
  //
  // ⚠️ BUG ที่แก้: `events` ตรงนี้คือ React state ดิบจาก FetchEvents.js (plain object) ซึ่ง
  // jobGroupId/company/site ฯลฯ ยังอยู่ top-level ของ object (ไม่ได้ย้ายเข้า .extendedProps)
  // ต่างจาก `ev` (event ที่กำลังแก้ไข) ที่มาจาก FullCalendar Event API object ซึ่ง FullCalendar
  // ย้ายฟิลด์ที่ไม่รู้จักเข้า .extendedProps ให้อัตโนมัติ — เดิมเช็ค e.extendedProps?.jobGroupId
  // กับ state ดิบ จึงเจอ undefined เสมอ ทำให้ siblingEvents ว่างตลอด และ hasSiblings เป็น false
  // ตลอดเวลา (ระบบแก้ไขพร้อมกันทั้งกลุ่มเลยไม่เคยทำงานจริงเลยตั้งแต่สร้างมา) ต้องอ่าน e.jobGroupId
  // (top-level) แทน
  const eventJobGroupId = ev.extendedProps?.jobGroupId || "";
  // ✅ สัญญาแบบหลายครั้ง — คนละแนวคิดกับ jobGroupId ด้านบน (ผูก "ครั้งที่" ต่างกันของสัญญาเดียวกัน
  // ไม่ใช่วันไม่ติดกันของครั้งเดียว) ข้อมูลสัญญาพวกนี้ต้อง copy เหมือนกันทุก "ครั้ง" ในสัญญาเดียวกัน
  // แก้ตรงนี้แล้วต้องอัปเดตพร้อมกันทุก record ผ่าน UpdateContractFields ไม่ใช่ UpdateEvent เดี่ยวๆ
  const eventContractGroupId = ev.extendedProps?.contractGroupId || "";
  const eventContractNo      = ev.extendedProps?.contractNo || "";
  const eventQuotationNo     = ev.extendedProps?.quotationNo || "";
  const eventContractStart   = ev.extendedProps?.contractStart ? moment(ev.extendedProps.contractStart).format("YYYY-MM-DD") : "";
  const eventContractEnd     = ev.extendedProps?.contractEnd ? moment(ev.extendedProps.contractEnd).format("YYYY-MM-DD") : "";
  const eventVisitCount      = ev.extendedProps?.visitCount || "";
  const eventIntervalMonths  = ev.extendedProps?.intervalMonths || "";
  const eventJobValue        = ev.extendedProps?.jobValue ?? "";
  // ✅ บันทึกประวัติ — เดิมมีแค่ในหน้า Operation (ActivityLogMini) หน้า /event เองยังไม่เคยแสดงเลย
  // ทั้งที่ activityLog บันทึกลงงานทุกตัวเหมือนกันอยู่แล้ว ดึงมาแสดงแบบเดียวกัน (ย่อ/กางได้) ที่นี่ด้วย
  const eventActivityLog = ev.extendedProps?.activityLog || [];
  // ✅ ป้ายบอกประเภทงาน (ทั่วไป/โปรเจค/สัญญา) — ใช้ classifier เดียวกับปฏิทิน (ดู index.js
  // eventClassNames/fc-event-type-*) กันสองจุดตัดสินไม่ตรงกัน
  const eventJobClassMeta = getJobClassMeta(classifyJob(ev.extendedProps));
  // ✅ งานที่สร้างโดยคนที่ไม่ใช่แอดมิน/manager (ช่าง/เซล) ต้องรอการอนุมัติก่อน — ดู PUT /events/:id/approval
  const eventApprovalState     = getApprovalState(ev.extendedProps);
  const eventApprovalRequestedBy = ev.extendedProps?.approvalRequestedBy || "";
  const eventApprovalRequestedAt = ev.extendedProps?.approvalRequestedAt || "";
  const eventApprovalDecidedBy   = ev.extendedProps?.approvalDecidedBy || "";
  const eventApprovalDecidedAt   = ev.extendedProps?.approvalDecidedAt || "";
  const eventApprovalRejectReason = ev.extendedProps?.approvalRejectReason || "";
  const siblingEvents = (events || [])
    .filter((e) => !e.extendedProps?.isHoliday && e.id !== eventId)
    .filter((e) => eventJobGroupId && e.jobGroupId === eventJobGroupId)
    .sort((a, b) => new Date(a.start) - new Date(b.start));
  // ✅ งานนี้เป็นส่วนหนึ่งของงานหลายวันอยู่แล้วหรือไม่ — ถ้าใช่ เปิดหน้าแก้ไขมาให้เห็น/แก้ทุกวันพร้อมกันเลย
  const hasSiblings = siblingEvents.length > 0;
  const eventResPerson = ev.extendedProps?.resPerson || "";

  // ✅ ปุ่ม "ดูการดำเนินงาน" ให้กดได้เมื่อ: เป็น admin, เป็นคนเพิ่ม event เอง,
  // หรือได้รับมอบหมาย (resPerson ตรงกับตัวเอง "หรือ" team ตรงกับชื่อตัวเอง — อย่างใดอย่างหนึ่งพอ)
  const isAdminUser   = userData?.role?.toLowerCase() === "admin";
  const isAdminOrManagerUser = ["admin", "manager"].includes(userData?.role?.toLowerCase());
  const isOwnerUser    = Boolean(userId) && userId.toString() === userData?.userId?.toString();
  const isAssignedUser =
    (eventResPerson && eventResPerson === userData?.userId) ||
    (eventTeam && eventTeam === userData?.fname);
  const canViewOperation =
    (isAdminUser || isOwnerUser || isAssignedUser) &&
    eventStatus !== "กำลังรอยืนยัน"; // งานที่ยังไม่ยืนยัน ยังไม่มีอะไรให้ดูในหน้าดำเนินงาน
  // ❌ งานที่ admin ปิดแล้ว (ดำเนินการเสร็จสิ้น) ช่างลบไม่ได้อีก มีแค่ admin/manager เท่านั้น
  const canDeleteEvent = isAdminOrManagerUser || eventStatus !== "ดำเนินการเสร็จสิ้น";
  // ❌ งานที่ปิดแล้ว (ดำเนินการเสร็จสิ้น) ห้าม "ย้ายไปแผนล่วงหน้า" เด็ดขาด ไม่มีข้อยกเว้นแม้แต่ admin/
  // manager (ต่างจาก canDeleteEvent ด้านบน) เพราะ unschedule เคลียร์ date/start/end ทิ้งโดยไม่แตะ
  // status เลย ถ้าปล่อยให้ทำกับงานที่เสร็จแล้วได้ จะได้ "แผนงานล่วงหน้า" ที่ status ยังเป็น "เสร็จสิ้น"
  // ค้างอยู่ ซึ่งเป็นสถานะขัดแย้งกันเองที่ไม่ควรเกิดขึ้นได้เลย (เทียบ pattern เดียวกับฝั่ง backend
  // PUT /:id/unschedule ที่ปิดเด็ดขาดเหมือนกัน)
  const canUnscheduleEvent = eventStatus !== "ดำเนินการเสร็จสิ้น";
  // ✅ ช่างแก้ไขสถานะเองได้แค่ตอนยังอยู่ในช่วง กำลังรอยืนยัน/ยืนยันแล้ว เท่านั้น
  // ถ้าสถานะถูกเลื่อนไปไกลกว่านั้นแล้ว (กำลังดำเนินการ/ดำเนินการเสร็จสิ้น) ให้แสดงค่าจริงไว้ แต่แก้ไม่ได้
  const canEditStatus = isAdminOrManagerUser || TECH_EDITABLE_STATUSES.includes(eventStatus);

  // ✅ "ย้ายเข้าสัญญาที่มีอยู่แล้ว" — ย้ายมาจากหน้า "ภาพรวมงาน" (ContractOverview.js openAttachDialog)
  // ให้แก้ไขกรณีจัดกลุ่มผิดได้ตรงจากหน้าแก้ไขงานเลย ไม่ต้องสลับไปหน้าภาพรวมงานทุกครั้ง — เฉพาะงานที่ยัง
  // ไม่ผูกสัญญาอยู่แล้ว (!eventContractGroupId) และเฉพาะแอดมิน/manager เทียบสิทธิ์เดียวกับหน้าภาพรวมงาน
  // ✅ events ที่ได้มาเป็น state ดิบ (ไม่ใช่ FullCalendar Event API object) ฟิลด์ต่างๆ จึงอยู่ top-level
  // เหมือนกับที่ siblingEvents ด้านบนใช้ e.jobGroupId/e.id ตรงๆ (ไม่ใช่ e.extendedProps.xxx)
  const contractMap = new Map();
  (events || []).forEach((e) => {
    if (!e.contractGroupId) return;
    if (!contractMap.has(e.contractGroupId)) {
      contractMap.set(e.contractGroupId, {
        key: e.contractGroupId,
        company: e.company || "", site: e.site || "", system: e.system || "", title: e.title || "",
        contractNo: e.contractNo || "", quotationNo: e.quotationNo || "",
        visitCount: e.visitCount || 0, jobValue: e.jobValue, team: e.team || "",
        visits: [],
      });
    }
    contractMap.get(e.contractGroupId).visits.push(e);
  });
  contractMap.forEach((c) => { c.usedVisits = countUsedRounds(c.visits); });
  const attachableContracts = [...contractMap.values()]
    .filter((c) => c.usedVisits < c.visitCount)
    .sort((a, b) => (a.company || "").localeCompare(b.company || "", "th") || (a.site || "").localeCompare(b.site || "", "th"));
  const contractDisplayName = (c) => [c.company, c.site].filter(Boolean).join(" · ") || "(ไม่ระบุชื่อ)";
  const canAttachToContract = isAdminOrManagerUser && !eventContractGroupId && attachableContracts.length > 0;
  // ✅ คัดลอกงานนี้ไปวางเป็นงานใหม่ — เฉพาะงานทั่วไป ไม่ใช่งานผูกสัญญา (คัดลอกงานสัญญาจะทำให้ตัวนับ
  // "ครั้งที่" ที่ใช้ไปแล้วของสัญญาเดิมสับสน/เพี้ยนได้ ดู countUsedRounds ด้านบน)
  const canCopyEvent = !eventContractGroupId;

  const formattedEnd = eventAllDay
    ? moment(eventEnd).subtract(1, "days").format("YYYY-MM-DD")
    : moment(eventEnd).format("YYYY-MM-DD");

  // ✅ เดิม titleOpts/systemOpts เป็น array ฝังโค้ดตายตัว แก้ไขเองไม่ได้นอกจากแก้โค้ด —
  // ดึงจากตาราง "ประเภทงาน"/"ระบบ" ที่จัดการได้จริงผ่านหน้า /worktype (Settings) แทน
  const [res, employees, jobTypes, systemTypes] = await Promise.all([
    CustomerService.getCustomers(),
    AuthService.getAllUserData(),
    JobTypeService.getAll(),
    SystemTypeService.getAll(),
  ]);
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

  // ✅ admin/manager เลือกได้ครบทุกสถานะเสมอ; ช่างเลือกได้แค่ 2 สถานะแรกถ้ายังไม่ถูกเลื่อนสถานะ
  // แต่ถ้าสถานะถูกเลื่อนไปไกลกว่านั้นแล้ว (canEditStatus=false) ให้เหลือแค่ตัวเลือกเดียวคือสถานะปัจจุบัน
  // (แสดงค่าจริงถูกต้อง แต่กด select ไม่ได้เพราะ disabled ด้านล่าง)
  const selectableStatuses = isAdminOrManagerUser
    ? Object.keys(STATUS_CONFIG)
    : canEditStatus
    ? TECH_EDITABLE_STATUSES
    : [eventStatus];

  const statusOptions = selectableStatuses
    .map((s) => optionHtml(s, eventStatus === s))
    .join("");

  const custOpt = (field) =>
    res.userCustomers
      .map((c) => {
        const val = field === "company" ? c.cCompany : c.cSite;
        const current = field === "company" ? eventCompany : eventSite;
        return optionHtml(val, current === val);
      })
      .join("");

  const titleOpts = (jobTypes?.items || [])
    .map((t) => optionHtml(t.name, eventTitle === t.name))
    .join("");

  const systemOpts = (systemTypes?.items || [])
    .map((s) => optionHtml(s.name, eventSystem === s.name))
    .join("");

  const timeOpts = ["1", "2", "3", "4"]
    .map((t) => optionHtml(t, eventTime === t))
    .join("");

  const teamOpts = employeeList
    .map((e) => optionHtml(e.fname, eventTeam === e.fname))
    .join("");

  // ✅ เดิมช่อง select ทุกช่อง (บริษัท/โครงการ/ประเภทงาน/ระบบ/ครั้งที่/ทีม) ใช้ placeholder option
  // (value="") ที่ทั้ง "selected" ทั้งใส่ค่าจริงเป็น "—" กันไว้ตอนไม่มีค่า — พอมี TomSelect
  // plugin "remove_button" (ดู mkTs ด้านล่าง) ทำให้ตัว placeholder นี้ถูกเรนเดอร์เป็น chip
  // ที่มีปุ่ม × ให้กดลบได้เหมือนเป็นค่าจริง ทั้งที่จริงๆ ยังไม่มีค่าเลย (ดูเหมือนข้อมูลเพี้ยนเป็น
  // "—" ทั้งที่ควรว่างเปล่า) — เปลี่ยนให้ placeholder ไม่ selected อีกต่อไป ปล่อยให้ TomSelect
  // แสดง placeholder ของตัวเองแทน (เหมือน AddEvent.js) และถ้าค่าจริงไม่อยู่ในลิสต์ตัวเลือก
  // มาตรฐาน (เช่น พิมพ์เองไว้ก่อนหน้านี้) ต้องแทรก option ที่ตรงกับค่านั้นแบบ selected ไว้เอง
  // ไม่งั้นค่าจริงจะหายไปจากช่องตอนเปิดหน้าแก้ไข
  const customOption = (val, list) =>
    val && !list.includes(val) ? optionHtml(val, true) : "";
  const companyValues = res.userCustomers.map((c) => c.cCompany);
  const siteValues = res.userCustomers.map((c) => c.cSite);
  const titleValues = (jobTypes?.items || []).map((t) => t.name);
  const systemValues = (systemTypes?.items || []).map((s) => s.name);
  const teamValues = employeeList.map((e) => e.fname);
  // ✅ ตัวเลือก "ครั้งที่" เดิม fix ไว้แค่ 1-4 ทั้งที่ตอนนี้สัญญาเข้าได้สูงสุด 24 ครั้ง/ปี — งานที่เป็น
  // ครั้งที่ 5 ขึ้นไปต้องแทรกค่าจริงเข้าไปด้วย customOption ไม่งั้นช่องนี้จะว่างเปล่าตอนเปิดแก้ไข
  const timeValues = ["1", "2", "3", "4"];

  // ✅ ตัวเลือกดิบไม่ฝัง selected มาด้วย ใช้กับแถวลูกทีมเพิ่มเติมที่ต้อง render แยกทีละแถวเอง
  const plainTeamOpts = employeeList
    .map((e) => optionHtml(e.fname, false))
    .join("");

  const cfg0 = STATUS_CONFIG[eventStatus] || STATUS_CONFIG["กำลังรอยืนยัน"];

  // ✅ บันทึกประวัติ — ใหม่ล่าสุดขึ้นก่อน เทียบ pattern เดียวกับ ActivityLogMini ใน Operation/index.js
  // (reverse ทั้งชุดก่อน map) ย่อไว้เป็นค่าเริ่มต้นเสมอ (ไม่ auto กางออก) กันฟอร์มยาวเกินจำเป็นตอนเปิดมา
  // ครั้งแรก — กดปุ่มหัวข้อเพื่อกาง/ยุบเอง (toggle ผ่าน style.display เหมือน eeRejectReasonBar ด้านล่าง)
  const activityLogHtml = eventActivityLog
    .slice()
    .reverse()
    .map((log) => {
      const meta = getActivityLogMeta(log.action);
      const detailHtml = log.detail
        ? `<div class="ee-log-detail">${escapeHtml(log.detail)}</div>`
        : "";
      const byHtml = log.userName ? ` · ${escapeHtml(log.userName)}` : "";
      const whenHtml = log.timestamp ? ` · ${moment(log.timestamp).locale("th").format("DD MMM HH:mm")}` : "";
      return `
        <div class="ee-log-item">
          <span class="ee-log-dot" style="background:${meta.color}"></span>
          <div class="ee-log-body">
            <div class="ee-log-head">
              <span style="color:${meta.color}">${meta.emoji} <b>${escapeHtml(meta.label)}</b></span>
              <span class="ee-log-meta">${byHtml}${whenHtml}</span>
            </div>
            ${detailHtml}
          </div>
        </div>`;
    })
    .join("");

  const html = `
<div id="ee-modal-inner">

  <!-- ── Header ── -->
  <div id="ee-status-header" style="background:${cfg0.bg}">
    <div id="ee-status-icon">${cfg0.icon}</div>
    <div id="ee-status-title">
      <h3><span >${attrHtml(eventTitle)} · ${attrHtml(eventSystem)} ${eventTime ? `· ครั้งที่ ${attrHtml(formatRoundLabel(eventTime, eventVisitCount))}` : ""}</span></h3>
      <div class="ee-header-meta">
        <span class="ee-tag">📍 ${attrHtml(eventSite) || "—"}</span>
        ${eventTeam ? `<span class="ee-tag">👷 ${attrHtml(eventTeam)}</span>` : ""}
        ${eventJobClassMeta ? `<span class="ee-tag">${eventJobClassMeta.emoji} ${attrHtml(eventJobClassMeta.label)}</span>` : ""}
      </div>
    </div>
    ${canCopyEvent ? `<button id="ee-copy-btn" title="คัดลอกงานนี้">📋</button>` : ""}
    <button id="ee-close-btn" title="ปิด">✕</button>
  </div>

  <!-- ── Body ── -->
  <div id="ee-body">

    <!-- ✅ สถานะอนุมัติ — อยู่บนสุดของฟอร์ม เหนือกล่องสัญญาด้วยซ้ำ เพราะเป็นข้อเท็จจริงสำคัญที่สุดของ
         งานนี้ตอนยังไม่ approved (งานที่สร้างโดยคนที่ไม่ใช่แอดมิน/manager ต้องรอการอนุมัติก่อน) -->
    ${eventApprovalState === "pending" ? `
    <div class="ee-approval-box ee-approval-box--pending">
      <b>⏳ งานนี้ยังรออนุมัติ</b>
      ${eventApprovalRequestedBy ? `${attrHtml(eventApprovalRequestedBy)} ส่งงานนี้เข้าระบบ` : "รอการอนุมัติ"}${eventApprovalRequestedAt ? ` เมื่อ ${moment(eventApprovalRequestedAt).locale("th").format("D MMM YYYY HH:mm")}` : ""}
      ${isAdminOrManagerUser ? `
      <div class="ee-approval-actions">
        <button type="button" class="ee-btn ee-btn-success" id="btnApproveJob">✅ อนุมัติงาน</button>
        <button type="button" class="ee-btn ee-btn-danger" id="btnRejectJob">❌ ไม่อนุมัติ</button>
      </div>
      <div class="ee-approval-reason-bar" id="eeRejectReasonBar">
        <textarea id="eeRejectReasonInput" placeholder="ระบุเหตุผลที่ไม่อนุมัติ (ถ้ามี)..."></textarea>
        <div class="ee-approval-actions" style="margin-top:0;">
          <button type="button" class="ee-btn ee-btn-danger" id="btnConfirmRejectJob">ยืนยันไม่อนุมัติ</button>
          <button type="button" class="ee-btn ee-btn-ghost" id="btnCancelRejectJob">ยกเลิก</button>
        </div>
      </div>
      ` : `<div style="margin-top:6px;">รอแอดมิน/manager ตรวจสอบและอนุมัติ</div>`}
    </div>
    ` : eventApprovalState === "rejected" ? `
    <div class="ee-approval-box ee-approval-box--rejected">
      <b>❌ งานนี้ไม่ได้รับการอนุมัติ</b>
      ${eventApprovalDecidedBy ? `${attrHtml(eventApprovalDecidedBy)} ไม่อนุมัติ` : "ไม่ได้รับการอนุมัติ"}${eventApprovalDecidedAt ? ` เมื่อ ${moment(eventApprovalDecidedAt).locale("th").format("D MMM YYYY HH:mm")}` : ""}
      ${eventApprovalRejectReason ? `<div style="margin-top:4px;"><b style="font-size:12.5px;">เหตุผล:</b> ${attrHtml(eventApprovalRejectReason)}</div>` : ""}
      <div style="margin-top:6px;">${isAdminOrManagerUser ? "แก้ไขข้อมูลแล้วบันทึก หรือลบทิ้งได้เลย" : "แก้ไขข้อมูลแล้วกดบันทึก ระบบจะส่งขออนุมัติใหม่ให้อัตโนมัติ"}</div>
    </div>
    ` : ""}

    <!-- ✅ ข้อมูลสัญญา — ย้ายมาไว้บนสุด (เดิมอยู่ล่างสุด ต้องเลื่อนจอไปดู) เพราะเป็นข้อมูลอ้างอิงหลักของ
         "ครั้งที่" นี้ที่มักต้องเช็คก่อนแก้อย่างอื่น ใส่กล่องพื้นหลังโทนม่วง-น้ำเงินแยกจากส่วนอื่นชัดเจน
         ให้เห็นตั้งแต่แวบแรกว่าเป็นข้อมูล "ทั้งสัญญา" ไม่ใช่แค่ครั้งนี้ครั้งเดียว -->
    ${eventContractGroupId ? `
    <div class="ee-contract-box">
      <p class="ee-contract-box-label">📑 ข้อมูลสัญญา <span>${isAdminOrManagerUser ? `แก้ที่นี่จะอัปเดตทุก "ครั้งที่" ในสัญญานี้พร้อมกัน` : `ดูได้อย่างเดียว — แก้ไขได้เฉพาะแอดมิน/manager เท่านั้น`}</span></p>
      <div class="ee-grid ee-grid-3">
        <div class="ee-field">
          <label>📄 เลขที่สัญญา</label>
          <input id="editContractNo" type="text" value="${attrHtml(eventContractNo)}" placeholder="เช่น FAPTY17-2568" ${isAdminOrManagerUser ? "" : "disabled"}>
        </div>
        <div class="ee-field">
          <label>🧾 เลขที่ใบเสนอราคา</label>
          <input id="editQuotationNo" type="text" value="${attrHtml(eventQuotationNo)}" placeholder="เช่น QT2024100049" ${isAdminOrManagerUser ? "" : "disabled"}>
        </div>
        <div class="ee-field">
          <label>🔁 เข้าทุกกี่เดือน</label>
          <input id="editIntervalMonths" type="number" min="1" max="24" value="${eventIntervalMonths}" placeholder="เช่น 3" ${isAdminOrManagerUser ? "" : "disabled"}>
        </div>
        <div class="ee-field">
          <label>📅 วันที่เริ่มสัญญา</label>
          <input id="editContractStart" type="date" value="${eventContractStart}" ${isAdminOrManagerUser ? "" : "disabled"}>
        </div>
        <div class="ee-field">
          <label>📅 วันที่สิ้นสุดสัญญา</label>
          <input id="editContractEnd" type="date" value="${eventContractEnd}" ${isAdminOrManagerUser ? "" : "disabled"}>
        </div>
        <div class="ee-field">
          <label>🔢 จำนวนครั้ง</label>
          <input id="editVisitCount" type="number" value="${eventVisitCount}" placeholder="เช่น 4" ${isAdminOrManagerUser ? "" : "disabled"}>
        </div>
        <div class="ee-field">
          <label>💰 มูลค่างาน</label>
          <input id="editJobValue" type="number" value="${eventJobValue}" placeholder="เช่น 86000" ${isAdminOrManagerUser ? "" : "disabled"}>
        </div>
      </div>
    </div>
    ` : ""}

    <!-- Status bar -->
    <div id="ee-status-bar">
      <div id="ee-status-bar-left">
        <div class="ee-owner-badge">👤 ${footerName}</div>
      </div>
      <div id="ee-status-bar-right">
        <span class="ee-status-bar-label">🔖 สถานะ</span>
        <div id="ee-status-select-wrap">
          <select id="editStatus" ${canEditStatus ? "" : "disabled title=\"สถานะนี้เปลี่ยนได้เฉพาะแอดมิน/manager\""}>${statusOptions}</select>
        </div>
      </div>
    </div>

    <!-- section: โครงการ -->
    <p class="ee-section-label">ข้อมูลโครงการ</p>
    ${eventContractGroupId ? `
    <p style="font-size:11px;color:#b91c1c;margin:-6px 0 10px;">
      🔒 งานนี้เป็นส่วนหนึ่งของสัญญา — ล็อกบริษัท/โครงการ/ประเภทงาน/ระบบ/ครั้งที่ไว้ไม่ให้แก้ตรงนี้
      กันข้อมูลไม่ตรงกับครั้งอื่นในสัญญาเดียวกัน (แก้ "ผู้รับผิดชอบ" ของครั้งนี้ได้ตามปกติ)
    </p>
    ` : ""}
    <div class="ee-grid ee-grid-3">
      <div class="ee-field">
        <label>🏢 ชื่อบริษัท</label>
        <select id="editCompany" ${eventContractGroupId ? "disabled" : ""}><option value="" disabled>— เลือกหรือพิมพ์ —</option>${customOption(eventCompany, companyValues)}${custOpt("company")}</select>
      </div>
      <div class="ee-field">
        <label><span class="req">*</span> ชื่อโครงการ</label>
        <select id="editSite" ${eventContractGroupId ? "disabled" : ""}><option value="" disabled>— เลือกหรือพิมพ์ —</option>${customOption(eventSite, siteValues)}${custOpt("site")}</select>
      </div>
      <div class="ee-field">
        <label><span class="req">*</span> ประเภทงาน</label>
        <select id="editTitle" ${eventContractGroupId ? "disabled" : ""}><option value="" disabled>— เลือกหรือพิมพ์ —</option>${customOption(eventTitle, titleValues)}${titleOpts}</select>
      </div>
    </div>
    <div class="ee-grid ee-grid-3">
      <div class="ee-field">
        <label><span class="req">*</span> ระบบงาน</label>
        <select id="editSystem" ${eventContractGroupId ? "disabled" : ""}><option value="" disabled>— เลือกหรือพิมพ์ —</option>${customOption(eventSystem, systemValues)}${systemOpts}</select>
      </div>
      <div class="ee-field">
        <label>🔢 ครั้งที่</label>
        <select id="editTime" ${eventContractGroupId ? "disabled" : ""}><option value="" disabled>— เลือก —</option>${customOption(eventTime, timeValues)}${timeOpts}</select>
      </div>
      <div class="ee-field">
        <label>👷 ทีม</label>
        <select id="editTeam"><option value="" disabled>— เลือกหรือพิมพ์ —</option>${customOption(eventTeam, teamValues)}${teamOpts}</select>
      </div>
    </div>

    <!-- ✅ ลูกทีมเพิ่มเติม (คนที่ 2, 3, ...) — แสดงผลอย่างเดียว ไม่กระทบสิทธิ์แก้ไข/แจ้งเตือน -->
    <div class="ee-field" style="margin-bottom:14px;">
      <label>👥 ลูกทีมเพิ่มเติม (ถ้ามี)</label>
      <div id="ee-teamMembersList"></div>
      <button type="button" class="ee-btn ee-btn-ghost" id="ee-addTeamMemberBtn" style="margin-top:2px;">➕ เพิ่มลูกทีม</button>
    </div>

    <hr class="ee-divider">

    <!-- section: วันที่ & เวลา — เหมือนหน้า Add เลย ค้างวันที่/ช่วงวันที่เดิมไว้ให้แก้ง่าย -->
    <p class="ee-section-label">วันที่ & เวลา</p>

    <label class="ee-checkbox-row">
      <input type="checkbox" id="ee-multiDateToggle" ${hasSiblings ? "checked" : ""}>
      🗓️ งานนี้ต้องเข้างานหลายวัน (ไม่ติดกันก็ได้) — ถือเป็นงานเดียวกัน
      ${hasSiblings ? `<span style="color:#94a3b8;font-weight:500;">(มีอยู่แล้ว ${siblingEvents.length + 1} วัน)</span>` : ""}
    </label>

    <div id="ee-singleDateSection" style="${hasSiblings ? "display:none;" : ""}">
      <div class="ee-grid ee-grid-2">
        <div class="ee-field">
          <label>📅 วันที่เริ่ม</label>
          <input id="editStart" type="date" value="${eventStart.format("YYYY-MM-DD")}">
        </div>
        <div class="ee-field">
          <label>📅 วันที่สิ้นสุด</label>
          <input id="editEnd" type="date" value="${formattedEnd}">
        </div>
      </div>
    </div>

    <div id="ee-multiDateSection" style="${hasSiblings ? "" : "display:none;"}">
      <div id="ee-multiDateList"></div>
      <button type="button" class="ee-btn ee-btn-ghost" id="ee-addDateBtn" style="margin-bottom:12px;">➕ เพิ่มช่วงวันที่</button>
    </div>

    <div class="ee-grid ee-grid-2">
      <div class="ee-field">
        <label>🕐 เวลาเริ่ม</label>
        <input id="editStartTime" type="text" placeholder="เช่น 08:30" value="${attrHtml(eventStartTime)}">
      </div>
      <div class="ee-field">
        <label>🕔 เวลาสิ้นสุด</label>
        <input id="editEndTime" type="text" placeholder="เช่น 17:00" value="${attrHtml(eventEndTime)}">
      </div>
    </div>

    <hr class="ee-divider">

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
        <input id="editdocNo" type="text" value="${attrHtml(evendocNo)}" placeholder="เช่น DOC-2026-001">
      </div>
      <div class="ee-field">
        <label>📝 ชื่อเรื่อง (Subject)</label>
        <input id="editSubject" type="text" value="${attrHtml(eventSubject)}" placeholder="ระบุชื่อเรื่อง">
      </div>
    </div>
    <div class="ee-field">
      <label>📋 รายละเอียดงาน (Description)</label>
      <textarea id="editDescription" placeholder="กรอกรายละเอียดงาน..."></textarea>
      <div class="ee-char-count" id="charCount">0 ตัวอักษร</div>
    </div>

    ${eventActivityLog.length > 0 ? `
    <hr class="ee-divider">
    <button type="button" id="btnToggleLog" class="ee-log-toggle">
      📜 บันทึกประวัติ (${eventActivityLog.length}) <span id="eeLogToggleIcon">▾</span>
    </button>
    <div id="eeLogList" class="ee-log-list" style="display:none;">
      ${activityLogHtml}
    </div>
    ` : ""}

  </div>

  <!-- ── Action bar (แยก 3 กลุ่มชัดเจน) ── -->
  <div id="ee-action-bar">

    <!-- 🔴 ซ้าย: อันตราย -->
    <div class="ee-btn-group ee-btn-group-left">
      ${canUnscheduleEvent ? `<button class="ee-btn ee-btn-warning" id="btnUnschedule">↩️ ย้ายไปแผนล่วงหน้า</button>` : ""}
      ${canDeleteEvent ? `<button class="ee-btn ee-btn-danger" id="btnDelete">🗑 ลบแผนงาน</button>` : ""}
    </div>

    <!-- 🔵 กลาง: นำทาง & เอกสาร (ย้ายเข้าสัญญาไม่ใช่การกระทำอันตราย — ไม่ควรอยู่กลุ่มซ้ายกับลบ/ย้ายไป
         แผนล่วงหน้า ย้ายมาไว้กลุ่มนี้แทนให้สื่อความหมายตรงกว่า) -->
    <div class="ee-btn-group ee-btn-group-center">
      ${canAttachToContract ? `<button class="ee-btn ee-btn-attach" id="btnAttachContract">🔗 ย้ายเข้าสัญญา</button>` : ""}
      ${canViewOperation ? `<button class="ee-btn ee-btn-operation" id="btnViewSchedule">📊 ดูการดำเนินงาน</button>` : ""}
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

  // ✅ ป๊อปอัพ "ย้ายเข้าสัญญาที่มีอยู่แล้ว" — เทียบ pattern เดียวกับ ContractOverview.js
  // openAttachDialog/handleAttachSubmit ทุกประการ แค่ย้ายมาเปิดจากหน้าแก้ไขงานได้เลยแทน (ดูปุ่ม
  // btnAttachContract ใน action bar ด้านบน) ย้ายทั้งกลุ่ม jobGroupId (ทุกวันของงานเดียวกัน) พร้อมกัน
  // ไม่ใช่แค่วันที่กำลังแก้ไขอยู่วันเดียว กันวันอื่นตกค้างเป็นงานทั่วไปแยกจากสัญญาที่เพิ่งย้ายไป
  const openAttachContractDialog = () => {
    injectAttachStyles();
    const contractOptsHtml = attachableContracts
      .map((c) => `<option value="${c.key}">${escapeHtml(contractDisplayName(c))} · ${escapeHtml(c.title)} (${c.contractNo ? escapeHtml(c.contractNo) : "ไม่มีเลขที่"})</option>`)
      .join("");

    const attachHtml = `
      <div id="eea-header">
        <div id="eea-header-icon">🔗</div>
        <div id="eea-header-info">
          <h3>ย้ายเข้าสัญญาที่มีอยู่แล้ว</h3>
          <small>${attrHtml(eventCompany) || "-"} · ${attrHtml(eventSite) || "-"} · ${attrHtml(eventTitle)}${siblingEvents.length > 0 ? ` · ${siblingEvents.length + 1} วัน` : ""}</small>
        </div>
      </div>
      <div id="eea-body">
        <label>เลือกสัญญาปลายทาง</label>
        <select id="eeaContractPick"><option value="" selected disabled>— เลือกสัญญา —</option>${contractOptsHtml}</select>
        <p class="eea-round-label" id="eeaRoundLabel" style="display:none;">เลือกครั้งที่</p>
        <div class="eea-round-grid" id="eeaRoundGrid"></div>
        <p class="eea-hint" id="eeaRoundHint"></p>
        <input type="hidden" id="eeaSelectedRound" value="">
      </div>
      <div id="eea-actions">
        <button type="button" class="eea-btn eea-btn-ghost" id="eeaCancel">ยกเลิก</button>
        <button type="button" class="eea-btn eea-btn-success" id="eeaConfirm">ย้ายเข้าสัญญา</button>
      </div>
    `;

    Swal.fire({
      html: attachHtml,
      showConfirmButton: false,
      showCancelButton: false,
      showCloseButton: true,
      customClass: { popup: "swal-ee-attach" },
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        const renderContractOption = (data, escape) => {
          const c = contractMap.get(data.value);
          if (!c) return `<div class="eea-contract-option">${escape(data.text)}</div>`;
          const remaining = c.visitCount - c.usedVisits;
          return `
            <div class="eea-contract-option">
              <div class="eea-contract-option-main">${escape(contractDisplayName(c))}</div>
              <div class="eea-contract-option-sub">
                <span>${escape(c.title)} · ${escape(c.system)}${c.contractNo ? ` · เลขที่ ${escape(c.contractNo)}` : ""}</span>
                <span class="eea-contract-option-badge">เหลือ ${remaining} ครั้ง</span>
              </div>
            </div>`;
        };
        const renderContractItem = (data, escape) => {
          const c = contractMap.get(data.value);
          if (!c) return `<div>${escape(data.text)}</div>`;
          return `<div>${escape(contractDisplayName(c))}${c.contractNo ? ` · ${escape(c.contractNo)}` : ""}</div>`;
        };
        let attachTs = null;
        try {
          attachTs = new TomSelect("#eeaContractPick", {
            create: false,
            maxOptions: attachableContracts.length || 5,
            placeholder: "ค้นหาบริษัท/โครงการ/เลขที่สัญญา...",
            sortField: { field: "text", direction: "asc" },
            render: { option: renderContractOption, item: renderContractItem },
          });
        } catch { attachTs = null; }

        const roundLabel = document.getElementById("eeaRoundLabel");
        const roundGrid = document.getElementById("eeaRoundGrid");
        const roundHint = document.getElementById("eeaRoundHint");
        const roundInput = document.getElementById("eeaSelectedRound");

        const renderRounds = (contractId) => {
          const c = contractMap.get(contractId);
          roundInput.value = "";
          roundHint.textContent = "";
          if (!c) { roundLabel.style.display = "none"; roundGrid.innerHTML = ""; return; }
          roundLabel.style.display = "block";
          const rounds = Array.from({ length: c.visitCount }, (_, i) => i + 1);
          roundGrid.innerHTML = rounds.map((n) => {
            const scheduled = c.visits.some((v) => !v.unscheduled && Number(v.time) === n);
            const pending = c.visits.some((v) => v.unscheduled && Number(v.time) === n);
            if (pending) return `<span class="eea-chip eea-chip--pending" title="มีแผนงานล่วงหน้าจองไว้แล้ว — เลือกไม่ได้">📌 ${n}</span>`;
            if (scheduled) return `<button type="button" class="eea-chip eea-chip--scheduled" data-round="${n}" title="ลงตารางแล้ว — กดเพื่อรวมเป็นงานเดียวกัน (ไม่นับครั้งใหม่)">✅ ${n}</button>`;
            return `<button type="button" class="eea-chip eea-chip--open" data-round="${n}">${n}</button>`;
          }).join("");
          roundGrid.querySelectorAll("button.eea-chip").forEach((btn) => {
            btn.addEventListener("click", () => {
              roundGrid.querySelectorAll("button.eea-chip").forEach((b) => b.classList.remove("eea-chip--selected"));
              btn.classList.add("eea-chip--selected");
              roundInput.value = btn.dataset.round;
              roundHint.textContent = `จะย้ายเข้าเป็นครั้งที่ ${btn.dataset.round}`;
            });
          });
        };
        document.getElementById("eeaContractPick")?.addEventListener("change", (e) => renderRounds(e.target.value));
        attachTs?.on("change", (val) => renderRounds(val));

        document.getElementById("eeaCancel")?.addEventListener("click", () => Swal.close());

        document.getElementById("eeaConfirm")?.addEventListener("click", async (clickEvt) => {
          const contractId = document.getElementById("eeaContractPick")?.value;
          const round = roundInput.value;
          if (!contractId) { Swal.showValidationMessage("กรุณาเลือกสัญญาปลายทาง"); return; }
          if (!round) { Swal.showValidationMessage("กรุณาเลือกครั้งที่"); return; }

          const btn = clickEvt.currentTarget;
          const originalLabel = btn.textContent;
          btn.disabled = true;
          btn.style.opacity = "0.7";
          btn.textContent = "⏳ กำลังบันทึก...";

          try {
            const idsToMove = [eventId, ...siblingEvents.map((e) => e.id)];
            await EventService.AttachToContract(contractId, { eventIds: idsToMove, time: round });
            Swal.close();
            await fetchEventsFromDB();
            Swal.fire({ title: "ย้ายเข้าสัญญาสำเร็จ ✅", icon: "success", timer: 1200, showConfirmButton: false });
          } catch (error) {
            console.error("❌ Error attaching event to contract:", error);
            btn.disabled = false;
            btn.style.opacity = "1";
            btn.textContent = originalLabel;
            Swal.showValidationMessage(error?.response?.data?.message || "ย้ายเข้าสัญญาไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
          }
        });
      },
    });
  };

  Swal.fire({
    html,
    width: "1100px",
    showConfirmButton: false,
    showCancelButton: false,
    showCloseButton: false,
    customClass: { popup: "swal-edit-event" },
    // ✅ กันคลิกนอกกล่อง/กด ESC แล้วปิดโดยไม่ตั้งใจ ข้อมูลที่แก้ไว้ทั้งหมดหายหมด
    // ต้องกดปุ่ม "ปิด" (✕) หรือ "ยกเลิก" อย่างชัดเจนเท่านั้น
    allowOutsideClick: false,
    allowEscapeKey: false,
    // ✅ Swal ลบ DOM ของ popup ทิ้งทั้งก้อนตอนปิด แต่ document/window listener ของทุก TomSelect
    // ในฟอร์มยังค้างอยู่ (รวมแถวลูกทีมที่ผู้ใช้ไม่ได้กด ✕ เอง) — เก็บกวาดให้ครบทีเดียวตอนปิด
    willClose: (popup) => popup.querySelectorAll(".tomselected").forEach((el) => el.tomselect?.destroy()),

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
      // ⚠️ เดิมมี plugins: ["remove_button"] ซึ่งเติมปุ่ม × ให้ "ทุก item ปัจจุบัน" ไม่ว่าจะเป็นค่า
      // จริงหรือ placeholder ที่ยังไม่ได้เลือกอะไรเลย — <select> เปล่าตาม HTML spec จะเลือก option
      // แรกในลิสต์ให้อัตโนมัติเสมอถ้าไม่มี option ไหน selected ชัดเจน (คือ placeholder "—
      // เลือกหรือพิมพ์ —" พอดี) ทำให้ปุ่ม × โผล่บน placeholder เหมือนมันเป็นค่าที่เลือกไว้จริง —
      // AddEvent.js ไม่มีปัญหานี้เพราะไม่ได้ใช้ plugin นี้เลย ตัดออกให้ตรงกันไปเลย
      const mkTs = (id, placeholder = "") => {
        try {
          return new TomSelect(id, {
            create: true,
            persist: false,
            closeAfterSelect: true,
            placeholder,
            // ⚠️ selectOnTab: true ทำให้แค่กด Tab ผ่านช่องนี้ (โดยไม่ได้ตั้งใจเลือกอะไรเลย)
            // ก็จะเลือก option ที่ถูก highlight ค้างอยู่ให้อัตโนมัติ (เช่น ตัวเลือกแรกในลิสต์
            // หรือข้อความที่พิมพ์ค้างไว้ในช่อง create) ทำให้ "ครั้งที่"/"ทีม" มีค่าขึ้นมาเองทั้งที่ไม่ได้เลือก
            selectOnTab: false,
            // ✅ ไม่งั้น TomSelect จะทิ้ง <option value=""> (placeholder ตอนไม่มีค่า)
            // แล้วเผลอเลือก option แรกที่มีค่าจริงให้เองอัตโนมัติ
            allowEmptyOption: true,
            onItemAdd() {
              if (this.items.length > 1) this.removeItem(this.items[0], true);
            },
          });
        } catch {
          return null;
        }
      };
      // ✅ ใส่ placeholder ข้อความจริงให้ TomSelect แสดงเองตอนไม่มีค่า (เทียบ pattern เดียวกับ
      // AddEvent.js) แทนการพึ่ง option ปลอมที่เคยทำให้เข้าใจผิดว่ามีค่าเป็น "—" อยู่ (ดูคอมเมนต์
      // ตรง customOption ด้านบน) — ล้างค่าทิ้งอีกชั้นถ้าค่าจริงว่างเปล่า กัน <select> เผลอเลือก
      // option แรก (placeholder) ให้เองตาม HTML spec จนกลายเป็น item ค้างอยู่ในกล่อง
      const mkTsCleared = (id, placeholder, currentVal) => {
        const ts = mkTs(id, placeholder);
        if (ts && !currentVal) ts.clear(true);
        return ts;
      };
      mkTsCleared("#editCompany", "เลือกหรือพิมพ์ชื่อบริษัท", eventCompany);
      mkTsCleared("#editSite",    "เลือกหรือพิมพ์ชื่อโครงการ", eventSite);
      mkTsCleared("#editTitle",   "เลือกหรือพิมพ์ประเภทงาน", eventTitle);
      mkTsCleared("#editSystem",  "เลือกหรือพิมพ์ระบบงาน", eventSystem);
      mkTsCleared("#editTime",    "เลือกครั้งที่", eventTime);
      mkTsCleared("#editTeam",    "เลือกหรือพิมพ์ชื่อทีม", eventTeam);

      const getVal = (id) => document.getElementById(id)?.value?.trim() || "";

      /* ── ลูกทีมเพิ่มเติม (คนที่ 2, 3, ... แสดงผลอย่างเดียว ไม่กระทบสิทธิ์) ── */
      const teamMembersList = document.getElementById("ee-teamMembersList");
      const mkTeamMemberTs = (el, prefillName) => {
        try {
          const ts = new TomSelect(el, {
            create: true,
            persist: false,
            closeAfterSelect: true,
            selectOnTab: false,
            placeholder: "เลือกหรือพิมพ์ชื่อลูกทีม",
            allowEmptyOption: true,
            // ⚠️ ไม่ต้องก็อป onItemAdd (บังคับเลือกได้ทีละคน) มาจาก mkTs ด้านบน — <select> ที่ไม่มี
            // attribute multiple ถูก TomSelect ตั้ง maxItems:1 / mode:"single" ให้เองอยู่แล้ว
          });
          if (prefillName) {
            // ✅ ชื่อลูกทีมเดิมที่ไม่มีอยู่ในลิสต์พนักงานแล้ว (ลาออก/เคยพิมพ์เองไว้) ต้อง addOption
            // ก่อน ไม่งั้น setValue จะเงียบๆ ไม่ทำอะไรเลย (addItem คืนทันทีถ้าค่านั้นไม่มีใน options)
            // แล้วชื่อเดิมจะหายไปจากฟอร์มโดยไม่มีใครรู้ตัว (addOption คืน false เฉยๆ ถ้ามีอยู่แล้ว
            // เรียกซ้ำได้ปลอดภัย)
            ts.addOption({ value: prefillName, text: prefillName });
            ts.setValue(prefillName, true); // true = silent ไม่ยิง change (ค่าใน <select> ยังถูก sync)
          } else {
            ts.clear(true);
          }
          return ts;
        } catch { return null; }
      };

      const addTeamMemberRow = (prefillName = "") => {
        const row = document.createElement("div");
        row.className = "ee-team-member-row";
        row.innerHTML = `
          <select class="ee-team-member-select"><option value="">— เลือกลูกทีม —</option>${plainTeamOpts}</select>
          <button type="button" class="ee-btn ee-btn-ghost ee-team-member-remove" title="ลบออก">✕</button>
        `;
        teamMembersList.appendChild(row); // ต้อง append ก่อน init (ดูคอมเมนต์ใน AddEvent.js)
        const ts = mkTeamMemberTs(row.querySelector(".ee-team-member-select"), prefillName);
        row.querySelector(".ee-team-member-remove").addEventListener("click", () => {
          ts?.destroy();
          row.remove();
        });
      };
      eventTeamMembers.forEach((m) => addTeamMemberRow(m?.name || ""));
      document.getElementById("ee-addTeamMemberBtn")?.addEventListener("click", () => addTeamMemberRow());

      /* ── งานหลายวัน (เหมือนหน้า Add ทุกอย่าง) — สลับ single/multi + ค้างค่าเดิมไว้ให้แก้ง่าย ── */
      const multiToggle   = document.getElementById("ee-multiDateToggle");
      const singleSection = document.getElementById("ee-singleDateSection");
      const multiSection  = document.getElementById("ee-multiDateSection");
      const multiDateList = document.getElementById("ee-multiDateList");

      // แถวละ 1 ช่วงวันที่ (เริ่ม–สิ้นสุด) ติด data-event-id ถ้าผูกกับ event ที่มีอยู่จริงแล้ว
      // (แถวใหม่ที่เพิ่งกด "เพิ่มช่วงวันที่" ยังไม่มี data-event-id จนกว่าจะกดบันทึก)
      const addDateRow = (startValue = "", endValue = "", eventIdAttr = "") => {
        const row = document.createElement("div");
        row.className = "ee-multi-date-row";
        if (eventIdAttr) row.dataset.eventId = eventIdAttr;
        row.innerHTML = `
          <input type="date" class="ee-range-start" value="${startValue}">
          <span class="ee-range-sep">–</span>
          <input type="date" class="ee-range-end" value="${endValue || startValue}">
          <button type="button" class="ee-btn ee-btn-ghost ee-multi-date-remove" title="ลบช่วงนี้ออก">✕</button>
        `;
        row.querySelector(".ee-multi-date-remove").addEventListener("click", () => {
          // ต้องเหลืออย่างน้อย 1 แถวเสมอ กันผู้ใช้ลบจนหมด
          if (multiDateList.children.length <= 1) return;
          const rowEventId = row.dataset.eventId;
          if (!rowEventId) {
            // แถวใหม่ที่ยังไม่กดบันทึก ยังไม่ถูกสร้างจริง ลบออกจากฟอร์มได้เลย
            row.remove();
            return;
          }
          // แถวนี้ผูกกับ event ที่มีอยู่จริงแล้ว ต้องยืนยันก่อนลบจริง (ลบเฉพาะช่วงนี้ ช่วงอื่นไม่กระทบ) —
          // ใช้แถบยืนยันในฟอร์มแทน window.confirm() ของเบราว์เซอร์ (ให้ตรงธีมแอป) และไม่ใช้ Swal.fire
          // ซ้อนเพราะจะไปแทนที่ modal แก้ไขงานที่เปิดอยู่ทั้งอัน (ดูคอมเมนต์ที่ CSS .ee-row-confirm-bar)
          const already = row.nextElementSibling;
          if (already && already.classList.contains("ee-row-confirm-bar")) { already.remove(); return; }
          document.querySelectorAll(".ee-row-confirm-bar").forEach((el) => el.remove());

          const confirmBar = document.createElement("div");
          confirmBar.className = "ee-row-confirm-bar";
          confirmBar.innerHTML = `
            <span>⚠️ ลบช่วงวันที่นี้ออกจากงาน? <span class="ee-row-confirm-sub">(ช่วงอื่นของงานเดียวกันจะไม่หายไป)</span></span>
            <div class="ee-row-confirm-actions">
              <button type="button" class="ee-btn ee-btn-ghost ee-row-confirm-no">ยกเลิก</button>
              <button type="button" class="ee-btn ee-btn-danger ee-row-confirm-yes">ลบช่วงนี้</button>
            </div>
          `;
          row.after(confirmBar);
          confirmBar.querySelector(".ee-row-confirm-no").addEventListener("click", () => confirmBar.remove());
          confirmBar.querySelector(".ee-row-confirm-yes").addEventListener("click", async () => {
            const yesBtn = confirmBar.querySelector(".ee-row-confirm-yes");
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
        multiDateList.appendChild(row);
      };

      // ✅ ค้างวันที่/ช่วงวันที่เดิมไว้เสมอ: แถวแรกคืองานปัจจุบันเอง ตามด้วยวันอื่นๆ ของงานเดียวกัน (ถ้ามี)
      addDateRow(eventStart.format("YYYY-MM-DD"), formattedEnd, eventId);
      siblingEvents.forEach((s) => {
        const sStart = moment(s.start).format("YYYY-MM-DD");
        const sEnd = s.allDay
          ? moment(s.end).subtract(1, "days").format("YYYY-MM-DD")
          : moment(s.end).format("YYYY-MM-DD");
        addDateRow(sStart, sEnd, s.id);
      });

      document.getElementById("ee-addDateBtn")?.addEventListener("click", () => addDateRow());

      multiToggle?.addEventListener("change", () => {
        const isMulti = multiToggle.checked;
        singleSection.style.display = isMulti ? "none" : "";
        multiSection.style.display  = isMulti ? "" : "none";
      });

      // ✅ ฟิลด์ร่วมของงาน (ไม่รวมวันที่) — ใช้ทั้งโหมดวันเดียวและโหมดหลายวัน
      // เวลาแก้ข้อมูลงาน (บริษัท/ไซต์/ทีม/สถานะ ฯลฯ) ในโหมดหลายวัน จะ apply กับทุกช่วงวันที่ในกลุ่มเดียวกัน
      // ✅ ลูกทีมเพิ่มเติม — เก็บทั้งชื่อ+userId (แสดงผลอย่างเดียว ไม่กระทบสิทธิ์) กันซ้ำชื่อ
      // เดียวกันเผลอเพิ่มหลายแถว และตัดแถวที่ยังไม่ได้เลือกใครออก
      const getTeamMembers = () =>
        [...document.querySelectorAll(".ee-team-member-select")]
          .map((sel) => sel.value)
          .filter(Boolean)
          .filter((name, idx, arr) => arr.indexOf(name) === idx)
          .map((name) => ({ userId: teamToId.get(name) || "", name }));

      const buildSharedFields = () => ({
        docNo: getVal("editdocNo"),
        company: getVal("editCompany"),
        site: getVal("editSite"),
        title: getVal("editTitle"),
        system: getVal("editSystem"),
        time: getVal("editTime"),
        team: getVal("editTeam"),
        resPerson: teamToId.get(getVal("editTeam")) || "",
        teamMembers: getTeamMembers(),
        textColor: inputText.value,
        backgroundColor: inputBg.value,
        fontSize: eventFontSize,
        status: getVal("editStatus"),
        manualStatus: true,
        subject: getVal("editSubject"),
        description: getVal("editDescription"),
        startTime: getVal("editStartTime"),
        endTime: getVal("editEndTime"),
      });

      // ✅ ข้อมูลสัญญา — คืนค่า null ถ้างานนี้ไม่ได้อยู่ในสัญญาแบบหลายครั้ง (ไม่มี input พวกนี้ให้อ่าน)
      // หรือถ้าไม่ใช่ admin/manager (ช่องพวกนี้ตอนนี้เป็น disabled สำหรับช่างแล้ว — ดูอย่างเดียว แก้ไม่ได้
      // ไม่ควรยิง UpdateContractFields ไปเลยด้วยซ้ำ เพราะ backend บล็อกอยู่แล้ว (403) จะกลายเป็น error
      // toast หลอกๆ ทั้งที่ส่วนอื่นที่ช่างแก้ได้จริง (เช่น comment/สถานะ) บันทึกสำเร็จไปแล้วก่อนหน้านั้น)
      // ต้องอัปเดตผ่าน UpdateContractFields (updateMany ตาม contractGroupId) แยกจาก UpdateEvent/
      // AddEvent เดี่ยวๆ ด้านล่าง ไม่งั้นแก้แค่ "ครั้งที่" นี้ครั้งเดียว ครั้งอื่นในสัญญาจะไม่อัปเดตตาม
      const buildContractFields = () => (isAdminOrManagerUser && eventContractGroupId ? {
        contractNo:     getVal("editContractNo"),
        quotationNo:    getVal("editQuotationNo"),
        contractStart:  getVal("editContractStart"),
        contractEnd:    getVal("editContractEnd"),
        visitCount:     getVal("editVisitCount") ? Number(getVal("editVisitCount")) : undefined,
        // ✅ ระยะห่างระหว่างรอบ — ข้อมูลอ้างอิงอิสระ ไม่ผูก/บังคับกับ visitCount ด้านบน (ใช้แค่เตือน
        // "เกินกำหนดรอบถัดไป" ดู utils/contractOverdue.js)
        intervalMonths: getVal("editIntervalMonths") ? Number(getVal("editIntervalMonths")) : undefined,
        jobValue:       getVal("editJobValue") ? Number(getVal("editJobValue")) : undefined,
      } : null);

      const buildPayload = () => {
        const endInput = getVal("editEnd");
        // ⚠️ เดิม fallback ไปที่ eventEnd.toISOString() ตรงๆ เวลาช่องวันที่สิ้นสุดว่าง
        // แต่ถ้า eventEnd (มาจาก ev.end ของ FullCalendar ตอนเปิด modal) ดันเป็นค่า invalid
        // (เช่น event ที่เคยถูกบันทึกมาแบบ end หายไปก่อนหน้านี้) .toISOString() จะคืนค่า null
        // แล้ว null ก็จะถูกบันทึกทับเป็น end ของ event ไปเลย ทำให้ event กลายเป็น "ไม่มีวันจบ"
        // แสดงซ้ำทุกวันในปฏิทิน (bug ที่ทำให้ปฏิทินเพี้ยนทั้งเดือน) — จึงต้องเช็ค isValid() ก่อนเสมอ
        // ถ้า invalid ให้ใช้วันเริ่มบวก 1 วันแทน (ปลอดภัยกว่าปล่อยให้ end เป็น null)
        const fallbackEnd = eventEnd.isValid()
          ? eventEnd.toISOString()
          : moment(getVal("editStart")).add(1, "days").toISOString();
        const end = endInput
          ? eventAllDay
            ? moment(endInput).add(1, "days").toISOString()
            : moment(endInput).toISOString()
          : fallbackEnd;
        return {
          id: eventId,
          ...buildSharedFields(),
          start: moment(getVal("editStart")).toISOString(),
          end,
        };
      };

      // ✅ บันทึกประวัติอัตโนมัติ — เทียบค่าฟอร์มตอนบันทึกกับค่าเดิมตอนเปิด modal (eventTeam/eventStatus/
      // ฯลฯ ที่ destructure ไว้ด้านบนสุดของไฟล์) แล้วสร้าง log เฉพาะฟิลด์ที่เปลี่ยนจริง — เดิมหน้านี้
      // ไม่เคยบันทึกประวัติอะไรเลยทั้งที่เป็นจุดที่แก้ไขงานบ่อยที่สุด (เปลี่ยนทีม/สถานะ/โครงการ ฯลฯ)
      // ต่างจากหน้า Operation ที่มี ActivityLogMini ครบอยู่แล้ว — แยก entry ต่อฟิลด์ "สำคัญ" (ทีม/สถานะ/
      // โครงการ/ระบบ/ประเภทงาน/วันที่) ให้เห็นชัดว่าเปลี่ยนอะไร ส่วนฟิลด์ปลีกย่อย (เอกสาร/สี/เวลา) รวม
      // เป็น entry เดียว กันประวัติรกเกินไปต่อการบันทึก 1 ครั้ง
      const actorName = [userData?.fname, userData?.lname].filter(Boolean).join(" ") || userData?.username || "ผู้ใช้งาน";
      const buildChangeLogEntries = (fields) => {
        const now = new Date().toISOString();
        const entries = [];
        const push = (action, detail) => entries.push({ action, detail, userName: actorName, timestamp: now });

        if ((fields.team || "") !== eventTeam) {
          push("team_changed", eventTeam
            ? `เปลี่ยนทีมจาก "${eventTeam}" เป็น "${fields.team || "-"}"`
            : `มอบหมายทีม "${fields.team}"`);
        }
        // ✅ ลูกทีมเพิ่มเติม — คนละแนวคิดกับ "ทีม" หลักด้านบน (แค่แสดงผล ไม่กระทบสิทธิ์/แจ้งเตือน) แต่
        // ก็เป็นการเปลี่ยนแปลงที่ควรเห็นในประวัติเหมือนกัน — เทียบเป็น "ชุดรายชื่อ" (เรียงลำดับก่อนเทียบ)
        // ไม่สนลำดับที่เลือกในฟอร์ม กันนับว่าเปลี่ยนทั้งที่แค่สลับลำดับคนเดิม
        const oldMemberNames = (eventTeamMembers || []).map((m) => m.name).filter(Boolean).sort();
        const newMemberNames = (fields.teamMembers || []).map((m) => m.name).filter(Boolean).sort();
        const memberNamesChanged =
          oldMemberNames.length !== newMemberNames.length ||
          oldMemberNames.some((name, i) => name !== newMemberNames[i]);
        if (memberNamesChanged) {
          push("team_members_changed", newMemberNames.length > 0
            ? `เปลี่ยนลูกทีมเป็น ${newMemberNames.join(", ")}`
            : "นำลูกทีมออกทั้งหมด");
        }
        if ((fields.status || "") !== eventStatus) {
          push("status_changed", `เปลี่ยนสถานะจาก "${eventStatus}" เป็น "${fields.status}"`);
        }
        if ((fields.company || "") !== eventCompany || (fields.site || "") !== eventSite) {
          push("project_changed", `เปลี่ยนโครงการเป็น "${[fields.company, fields.site].filter(Boolean).join(" · ") || "-"}"`);
        }
        if ((fields.system || "") !== eventSystem) {
          push("system_changed", `เปลี่ยนระบบจาก "${eventSystem}" เป็น "${fields.system}"`);
        }
        if ((fields.title || "") !== eventTitle) {
          push("title_changed", `เปลี่ยนประเภทงานจาก "${eventTitle}" เป็น "${fields.title}"`);
        }
        // ✅ fields.start/end มาได้ทั้งรูปแบบ ISO (โหมดวันเดียว, exclusive end +1 วัน) และ YYYY-MM-DD
        // (โหมดหลายวัน) — normalize กลับเป็น inclusive YYYY-MM-DD ทั้งคู่ก่อนเทียบกับ eventStart/
        // formattedEnd (ค่าเดิมตอนเปิด modal ซึ่งเป็น inclusive อยู่แล้ว) ให้เทียบกันตรงๆ ได้
        if (fields.start) {
          const newStartDay = moment(fields.start).format("YYYY-MM-DD");
          const newEndDay = fields.end
            ? moment(fields.end).subtract(eventAllDay ? 1 : 0, "days").format("YYYY-MM-DD")
            : newStartDay;
          if (newStartDay !== eventStart.format("YYYY-MM-DD") || newEndDay !== formattedEnd) {
            push("schedule_changed", `เปลี่ยนวันที่เป็น ${newStartDay}${newEndDay !== newStartDay ? ` – ${newEndDay}` : ""}`);
          }
        }
        const detailsChanged =
          (fields.docNo || "") !== evendocNo ||
          (fields.subject || "") !== eventSubject ||
          (fields.description || "") !== eventDescription ||
          (fields.startTime || "") !== (eventStartTime || "") ||
          (fields.endTime || "") !== (eventEndTime || "") ||
          (fields.backgroundColor || "") !== (ev.backgroundColor || "") ||
          (fields.textColor || "") !== (ev.textColor || "");
        if (detailsChanged) {
          push("details_updated", "แก้ไขรายละเอียดงาน (เอกสาร/สี/เวลา ฯลฯ)");
        }
        return entries;
      };

      // ✅ TomSelect ของช่องประเภทงาน/ระบบเปิด create:true ไว้ (พิมพ์ค่าใหม่ที่ไม่มีในลิสต์ได้)
      // เดิมค่าที่พิมพ์ใหม่ถูกบันทึกแค่ในตัวแผนงานนี้ ไม่เคยเข้าตารางกลาง "ประเภทงาน"/"ระบบ" เลย
      // ทำให้ครั้งถัดไปต้องพิมพ์ใหม่ซ้ำอีก ไม่โผล่เป็นตัวเลือกให้เลือก — upsert เข้าตารางกลาง
      // ถ้ายังไม่มีชื่อนี้อยู่ก่อน (best-effort เฉยๆ ไม่ให้กระทบการบันทึกแผนงานหลักถ้าล้มเหลว)
      const upsertLookups = async (title, system) => {
        // ✅ ไม่พึ่งพากันเลย รวมเป็น Promise.all แทนรอทีละอัน
        await Promise.all([
          (title && !jobTypes?.items?.some((t) => t.name === title))
            ? JobTypeService.add(title).catch(() => {}) : null,
          (system && !systemTypes?.items?.some((s) => s.name === system))
            ? SystemTypeService.add(system).catch(() => {}) : null,
        ]);
      };

      /* Save */
      document
        .getElementById("btnConfirm")
        ?.addEventListener("click", async () => {
          if (isSavingEdit) return; // ✅ กันกรณี listener ถูก attach/ยิงซ้ำ ไม่ให้บันทึกซ้ำ

          // ✅ ยึด hasSiblings (ข้อมูลจริงว่างานนี้อยู่ในกลุ่มอยู่แล้วหรือไม่) เป็นหลักด้วย ไม่ใช่แค่
          // สถานะ checkbox สดๆ ตอนกดบันทึกอย่างเดียว — กันงานที่เป็นกลุ่มอยู่แล้วหลุดไปแก้แบบวันเดียว
          // โดยไม่ตั้งใจ ซึ่งจะทำให้แก้สี/ชื่อโครงการ/รายละเอียดแค่วันเดียวไม่ทั้งกลุ่ม
          const isMultiMode = Boolean(multiToggle?.checked) || hasSiblings;

          if (!isMultiMode) {
            const payload = buildPayload();
            // ✅ กันบันทึก end เป็น null/invalid เด็ดขาด (ทำให้ event กลายเป็น "ไม่มีวันจบ"
            // แสดงซ้ำทุกวันทั้งเดือนในปฏิทิน) — ถ้าเกิดขึ้นจริง ให้บังคับกรอกวันที่สิ้นสุดใหม่แทนการบันทึกทับ
            if (!payload.end || !moment(payload.end).isValid()) {
              Swal.showValidationMessage("กรุณาระบุวันที่สิ้นสุดใหม่อีกครั้ง (ข้อมูลเดิมไม่ถูกต้อง)");
              return;
            }
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
            // ✅ กันวันที่สิ้นสุดก่อนวันที่เริ่ม (เทียบจากค่าดิบในช่อง ก่อนที่ end จะถูกปรับ +1 วัน
            // สำหรับงาน allDay ใน buildPayload ไม่งั้นเทียบกับ payload.end ตรงๆ จะเพี้ยน)
            const rawStart = getVal("editStart");
            const rawEnd = getVal("editEnd");
            if (rawStart && rawEnd && moment(rawEnd).isBefore(moment(rawStart))) {
              Swal.showValidationMessage("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม");
              return;
            }
            isSavingEdit = true;
            setLoading(true);
            try {
              await upsertLookups(payload.title, payload.system);
              const changeEntries = buildChangeLogEntries(payload);
              if (changeEntries.length > 0) payload.activityLog = [...eventActivityLog, ...changeEntries];
              await EventService.UpdateEvent(eventId, payload);
              const contractFields = buildContractFields();
              if (contractFields) {
                await EventService.UpdateContractFields(eventContractGroupId, contractFields);
              }
              setLoading(false);
              Swal.fire({
                title: "บันทึกสำเร็จ ✅",
                icon: "success",
                timer: 1200,
                showConfirmButton: false,
              });
              await Promise.all([fetchEventsFromDB(), fetchLookupOptions?.()]); // ✅ รีเฟรชตัวเลือกตัวกรองให้เห็นประเภทงาน/ระบบที่เพิ่งพิมพ์ใหม่ทันที
            } catch (err) {
              setLoading(false);
              // ✅ err.message ของ axios เป็นข้อความทั่วไป (เช่น "Request failed with status code 409")
              // ไม่ใช่ข้อความ Thai ที่ backend ตั้งใจส่งมา (เช่น รายละเอียดงานที่ชนกัน) ต้องอ่านจาก
              // response.data.message ก่อนเสมอ ไม่งั้นข้อความแจ้งเตือนช่างชนกันจะไปไม่ถึงผู้ใช้เลย
              Swal.fire({
                title: "เกิดข้อผิดพลาด",
                text: err?.response?.data?.message || err.message,
                icon: "error",
              });
            } finally {
              isSavingEdit = false;
            }
            return;
          }

          // ── โหมดงานหลายวัน: อ่านทุกแถว (ช่วงวันที่) แล้วสร้าง/แก้ไขทีเดียวตอนกดบันทึก ──
          const shared = buildSharedFields();
          if (!shared.title)  { Swal.showValidationMessage("กรุณาระบุประเภทงาน");  return; }
          if (!shared.site)   { Swal.showValidationMessage("กรุณาระบุชื่อโครงการ"); return; }
          if (!shared.system) { Swal.showValidationMessage("กรุณาระบบงาน");        return; }

          const rows = [...document.querySelectorAll("#ee-multiDateList .ee-multi-date-row")];
          const ranges = [];
          for (const row of rows) {
            const s = row.querySelector(".ee-range-start")?.value;
            const e = row.querySelector(".ee-range-end")?.value || s;
            if (!s) continue;
            if (moment(e).isBefore(moment(s))) {
              Swal.showValidationMessage("แต่ละช่วงวันที่ วันสิ้นสุดต้องไม่ก่อนวันเริ่ม");
              return;
            }
            ranges.push({ start: s, end: e, eventIdAttr: row.dataset.eventId || "" });
          }
          if (ranges.length === 0) {
            Swal.showValidationMessage("กรุณาเลือกอย่างน้อย 1 ช่วงวันที่");
            return;
          }

          isSavingEdit = true;
          setLoading(true);
          try {
            await upsertLookups(shared.title, shared.system);
            // ✅ ผูก jobGroupId เฉพาะตอนมีมากกว่า 1 ช่วงจริงๆ หรือเป็นงานที่อยู่ในกลุ่มอยู่แล้ว
            // ถ้าติ๊กโหมดหลายวันไว้แต่สุดท้ายเหลือแค่ 1 ช่วง ไม่ควรผูก jobGroupId ให้ (ไม่งั้นจะ
            // โดนเข้าใจผิดว่าเป็นงานหลายวันทั้งที่จริงมีวันเดียว)
            const shouldGroup = ranges.length > 1 || Boolean(eventJobGroupId);
            const groupId = shouldGroup ? (eventJobGroupId || `${eventId}-${Date.now()}`) : "";
            // ⚠️ BUG ที่แก้: shared (buildSharedFields) ไม่มี contractGroupId/isContractBatch เลย —
            // ตอนกดติ๊กโหมด "เข้าหลายวันไม่ติดกัน" แล้วเพิ่มแถวใหม่จากหน้าแก้ไขงานที่ผูกกับสัญญาอยู่แล้ว
            // (เช่น ครั้งที่ 1 ของสัญญา ต้องการต่อวันที่ไม่ต่อเนื่องอีกวัน) แถวใหม่ที่สร้างจะหลุดออกจาก
            // สัญญาไปเลย (ไม่มี contractGroupId) กลายเป็นงานลอยแยกเดี่ยว ไม่ถูกนับเป็นส่วนหนึ่งของ
            // "ครั้งที่ 1" อีกต่อไป ทั้งที่ผู้ใช้ตั้งใจแค่ต่อวันที่ให้ครั้งเดิม — ต้องแนบข้อมูลสัญญากลับไปด้วย
            // ทุกแถวใหม่ ถ้างานที่กำลังแก้ไขอยู่นี้ผูกกับสัญญาอยู่ (eventContractGroupId)
            const contractCarryFields = eventContractGroupId ? {
              isContractBatch: true,
              contractGroupId: eventContractGroupId,
              contractNo: eventContractNo,
              quotationNo: eventQuotationNo,
              contractStart: eventContractStart,
              contractEnd: eventContractEnd,
              visitCount: eventVisitCount,
              intervalMonths: eventIntervalMonths,
              jobValue: eventJobValue,
            } : {};
            for (const r of ranges) {
              const rangeData = {
                ...shared,
                ...contractCarryFields,
                ...(groupId ? { jobGroupId: groupId } : {}),
                start: r.start,
                end: moment(r.end).add(1, "days").format("YYYY-MM-DD"),
                date: r.start,
              };
              // ✅ บันทึกประวัติเฉพาะแถวที่ตรงกับ record ที่กำลังเปิดแก้ไขอยู่จริง (eventId) — แถวอื่นๆ
              // ในกลุ่มไม่มี snapshot ค่าเดิมของตัวเองให้เทียบ (eventTeam/eventStatus/ฯลฯ ด้านบนเป็นของ
              // record นี้ record เดียว) และแถวที่เพิ่งสร้างใหม่ (ไม่มี eventIdAttr) ยังไม่มีประวัติมาก่อน
              if (r.eventIdAttr === eventId) {
                const changeEntries = buildChangeLogEntries(rangeData);
                if (changeEntries.length > 0) rangeData.activityLog = [...eventActivityLog, ...changeEntries];
              }
              if (r.eventIdAttr) {
                await EventService.UpdateEvent(r.eventIdAttr, rangeData);
              } else {
                await EventService.AddEvent(rangeData);
              }
            }
            const contractFields = buildContractFields();
            if (contractFields) {
              await EventService.UpdateContractFields(eventContractGroupId, contractFields);
            }
            setLoading(false);
            Swal.fire({
              title: "บันทึกสำเร็จ ✅",
              icon: "success",
              timer: 1200,
              showConfirmButton: false,
            });
            await Promise.all([fetchEventsFromDB(), fetchLookupOptions?.()]); // ✅ รีเฟรชตัวเลือกตัวกรองให้เห็นประเภทงาน/ระบบที่เพิ่งพิมพ์ใหม่ทันที
          } catch (err) {
            setLoading(false);
            // ✅ err.message ของ axios เป็นข้อความทั่วไป ไม่ใช่ข้อความ Thai ที่ backend ส่งมา — ดูคอมเมนต์
            // เดียวกันในโหมดวันเดียวด้านบน
            Swal.fire({
              title: "เกิดข้อผิดพลาด",
              text: err?.response?.data?.message || err.message,
              icon: "error",
            });
          } finally {
            isSavingEdit = false;
          }
        });

      /* Delete */
      // ⚠️ handleDeleteEvent (getDeleteEvent) เปิด Swal ยืนยันของตัวเองอยู่แล้ว
      // เดิมโค้ดนี้เปิด Swal ยืนยันซ้อนอีกชั้น แล้วเรียก Swal.close() ทันทีหลังเรียก handleDeleteEvent
      // ซึ่งไปปิดกล่องยืนยันที่ handleDeleteEvent เพิ่งเปิดขึ้นมาก่อนที่ผู้ใช้จะกดอะไรได้เลย
      // ทำให้การลบไม่ทำงาน — ปิด modal แก้ไขนี้ก่อน แล้วปล่อยให้ handleDeleteEvent ยืนยันเอง
      document.getElementById("btnDelete")?.addEventListener("click", () => {
        Swal.close();
        handleDeleteEvent(eventId);
      });

      /* ✅ ย้ายกลับไปเป็นงานวางแผนล่วงหน้า (unscheduled) — สำหรับงานที่ลงตารางไปแล้วแต่อยาก
         เอาวันที่ออกก่อน กลับไปอยู่ในแผงงานล่วงหน้าเหมือนเดิม โดยไม่ต้องลบทิ้งทั้งงาน
         handleUnscheduleEvent เปิด Swal ยืนยันของตัวเองอยู่แล้ว จึงปิด modal นี้ก่อนเรียก
         (แพทเทิร์นเดียวกับ btnDelete ด้านบน) */
      document.getElementById("btnUnschedule")?.addEventListener("click", () => {
        Swal.close();
        handleUnscheduleEvent(eventId);
      });

      /* ✅ ย้ายเข้าสัญญาที่มีอยู่แล้ว — เปิดป๊อปอัพเล็กแยกต่างหาก (ไม่ใช้ scope เดียวกับฟอร์มแก้ไขหลัก
         ดู injectAttachStyles ด้านบน) ปิด modal แก้ไขนี้ก่อนเหมือน pattern เดียวกับ btnDelete/
         btnUnschedule ด้านบน กันซ้อนกัน 2 ชั้น */
      document.getElementById("btnAttachContract")?.addEventListener("click", () => {
        Swal.close();
        openAttachContractDialog();
      });

      /* ✅ คัดลอกงานนี้ — เก็บ template ของงาน (ไม่รวมวันที่/สถานะ/สัญญา) ไว้ที่คลิปบอร์ดฝั่ง index.js
         แล้วปิด modal นี้ทันที ให้ผู้ใช้ไปคลิกวันที่บนปฏิทินที่ต้องการวางต่อ (ดู onCopyEvent/getAddEvent)
         — ปุ่มนี้อยู่ที่หัว modal แยกจากแถบปุ่มด้านล่างโดยตั้งใจ (ตอนนี้มีทาง Ctrl/Cmd+ลากด้วยแล้ว
         ปุ่มนี้เป็นทางเลือกสำรอง ไม่ใช่ทางหลัก จึงไม่ควรเด่นเท่าแถบปุ่มการกระทำหลักด้านล่าง) */
      document.getElementById("ee-copy-btn")?.addEventListener("click", () => {
        Swal.close();
        onCopyEvent?.({
          company: eventCompany,
          site: eventSite,
          title: eventTitle,
          system: eventSystem,
          team: eventTeam,
          teamMembers: (eventTeamMembers || []).map((m) => m.name).filter(Boolean),
          backgroundColor: ev.backgroundColor || "#3b82f6",
          textColor: ev.textColor || "#ffffff",
        });
      });

      /* ✅ อนุมัติ/ไม่อนุมัติงาน — ปุ่มอยู่ในฟอร์มเดียวกันเลย ไม่เปิด Swal ซ้อน (ดูคอมเมนต์เตือนเรื่อง
         nested Swal ด้านบน) reject ใช้แถบ textarea เลื่อนลงมาแทน (#eeRejectReasonBar) แทนการเปิด
         popup ยืนยันซ้อนอีกชั้น ปุ่มพวกนี้มีเฉพาะตอน admin/manager ดูงานที่ยังรออนุมัติเท่านั้น */
      document.getElementById("btnApproveJob")?.addEventListener("click", async (clickEvt) => {
        const btn = clickEvt.currentTarget;
        btn.disabled = true;
        try {
          await EventService.DecideApproval(eventId, "approve");
          Swal.close();
          await fetchEventsFromDB();
          Swal.fire({ title: "อนุมัติงานแล้ว ✅", icon: "success", timer: 1200, showConfirmButton: false });
        } catch (error) {
          console.error("❌ Error approving job:", error);
          btn.disabled = false;
          Swal.showValidationMessage(error?.response?.data?.message || "อนุมัติไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        }
      });

      /* ✅ บันทึกประวัติ — ย่อ/กางเหมือน ActivityLogMini (ปุ่มเดียว toggle ทั้ง list + หมุนลูกศร) */
      document.getElementById("btnToggleLog")?.addEventListener("click", () => {
        const list = document.getElementById("eeLogList");
        const icon = document.getElementById("eeLogToggleIcon");
        if (!list) return;
        const isOpen = list.style.display !== "none";
        list.style.display = isOpen ? "none" : "flex";
        if (icon) icon.textContent = isOpen ? "▾" : "▴";
      });

      const eeRejectReasonBar = document.getElementById("eeRejectReasonBar");
      document.getElementById("btnRejectJob")?.addEventListener("click", () => {
        if (eeRejectReasonBar) eeRejectReasonBar.style.display = "block";
        document.getElementById("eeRejectReasonInput")?.focus();
      });
      document.getElementById("btnCancelRejectJob")?.addEventListener("click", () => {
        if (eeRejectReasonBar) eeRejectReasonBar.style.display = "none";
      });
      document.getElementById("btnConfirmRejectJob")?.addEventListener("click", async (clickEvt) => {
        const reason = document.getElementById("eeRejectReasonInput")?.value || "";
        const btn = clickEvt.currentTarget;
        btn.disabled = true;
        try {
          await EventService.DecideApproval(eventId, "reject", reason);
          Swal.close();
          await fetchEventsFromDB();
          Swal.fire({ title: "ไม่อนุมัติงานแล้ว ❌", icon: "success", timer: 1200, showConfirmButton: false });
        } catch (error) {
          console.error("❌ Error rejecting job:", error);
          btn.disabled = false;
          Swal.showValidationMessage(error?.response?.data?.message || "ดำเนินการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        }
      });

      /* View operation */
      document
        .getElementById("btnViewSchedule")
        ?.addEventListener("click", () => {
          const jobGroup = resolveOperationGroup({ status: eventStatus });
          navigate(`/operation/${eventId}${jobGroup ? `?group=${jobGroup}` : ""}`);
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
