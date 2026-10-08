/**
 * salesFormStyle — หน้าตาชุดเดียวของฟอร์ม "เพิ่มนัดหมาย" และ "แก้ไขนัดหมาย" (SweetAlert)
 *
 * ✅ ผู้ใช้สั่ง (8 ต.ค. 2569): "ปรับปรุงให้รูปแบบสอดคล้องหน้าอื่นๆ และสวยงาม"
 *   • หัวกล่องพื้นขาว + กล่องไอคอนสีอ่อน + ปุ่มปิดเทา — แบบเดียวกับหน้ารายละเอียดนัด (SalesAppointmentDialog)
 *   • ทุกอย่างชิดซ้าย (SweetAlert ตั้ง text-align:center ไว้ทั้งกล่อง ฟอร์มจึงเคยอยู่กลางจอหมด)
 *   • จัดเป็นการ์ดขาวทีละเรื่อง: ประเภท · สถานที่/ลูกค้า · วันและเวลา · สถานะ · รายละเอียด
 *   • วันเริ่ม/สิ้นสุด และเวลาเริ่ม/สิ้นสุด อยู่คู่กันเสมอ แม้บนมือถือ
 * 🐛 ช่องวันที่ขอบซ้อน 2 ชั้น: กฎ ".sa-wrap input[type=text]" ไปโดนช่องข้างในของปฏิทิน พ.ศ. (MUI) ด้วย
 *    → ยกเว้น .MuiInputBase-input
 */
export const SALES_FORM_CSS = `
  .swal-sales-appt.swal2-popup {
    padding: 0 !important; border-radius: 18px !important; overflow: hidden !important;
    width: min(96vw, 640px) !important; max-height: 92vh !important;
    display: flex !important; flex-direction: column !important;
    font-family: 'IBM Plex Sans Thai', system-ui, sans-serif !important;
    box-shadow: 0 24px 60px rgba(15,23,42,.22) !important;
  }
  .swal-sales-appt .swal2-html-container {
    margin: 0 !important; padding: 0 !important; overflow: hidden !important; text-align: left !important;
    display: flex !important; flex-direction: column !important; flex: 1 !important; min-height: 0 !important;
  }
  #sa-modal-inner { display: flex; flex-direction: column; height: 100%; min-height: 0; text-align: left; }
  .swal-sales-appt .swal2-title, .swal-sales-appt .swal2-actions, .swal-sales-appt .swal2-footer { display: none !important; }
  .swal-sales-appt .swal2-close {
    position: absolute; top: 14px; right: 14px; z-index: 99; width: 34px; height: 34px; border-radius: 10px;
    background: transparent !important; color: #64748b !important; font-size: 22px;
    display: flex; align-items: center; justify-content: center; box-shadow: none !important;
  }
  .swal-sales-appt .swal2-close:hover { background: #f1f5f9 !important; color: #0f172a !important; }
  .swal-sales-appt .swal2-validation-message { margin: 0 !important; border-radius: 0; font-size: 13px; }

  /* ── หัวกล่อง ── */
  #sa-header { padding: 16px 56px 14px 20px; display: flex; align-items: center; gap: 12px; flex-shrink: 0; background: #fff; border-bottom: 1px solid #e2e8f0; }
  #sa-header-icon { width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 21px; }
  #sa-header-info { flex: 1; min-width: 0; }
  #sa-header-info h3 { margin: 0; font-size: 17px; font-weight: 800; color: #0f172a; line-height: 1.3; }
  #sa-header-info small { display: block; font-size: 12.5px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* ── เนื้อหา ── */
  #sa-body { padding: 14px 16px 18px; background: #f8fafc; overflow-y: auto; flex: 1; min-height: 0; }
  .sa-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; margin-bottom: 12px; }
  .sa-card-title { font-size: 13px; font-weight: 800; color: #0f172a; margin: 0 0 10px; display: flex; align-items: center; gap: 6px; }
  .sa-card-title small { font-weight: 600; color: #94a3b8; font-size: 11.5px; }
  .sa-label { font-size: 12px; font-weight: 700; color: #475569; margin: 12px 0 6px; }
  .sa-label:first-child { margin-top: 0; }
  .sa-sublabel { font-size: 11.5px; font-weight: 600; color: #64748b; margin: 0 0 4px; }
  .sa-req { color: #dc2626; }
  .sa-hint { font-size: 11.5px; color: #94a3b8; margin: 6px 0 0; }

  .sa-wrap input[type="text"]:not(.MuiInputBase-input), .sa-wrap input[type="date"], .sa-wrap textarea {
    width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff;
    font-size: 14.5px; font-family: inherit; color: #0f172a; box-sizing: border-box; transition: border-color .15s, box-shadow .15s;
  }
  .sa-wrap textarea { resize: vertical; min-height: 96px; line-height: 1.6; }
  .sa-wrap input:not(.MuiInputBase-input):focus, .sa-wrap textarea:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.12); }
  .sa-wrap ::placeholder { color: #94a3b8; }
  .sa-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .sa-row > div { min-width: 0; }

  /* ประเภทนัด — ปุ่มเลือกแบบไอคอน+ชื่อ (2 คอลัมน์บนมือถือ 3 คอลัมน์บนจอใหญ่) */
  .sa-types { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  @media (max-width: 560px) { .sa-types { grid-template-columns: repeat(2, 1fr); } }
  .sa-type { position: relative; display: flex; align-items: center; gap: 8px; padding: 10px; border: 1px solid #e2e8f0; border-radius: 12px; cursor: pointer; background: #fff; transition: border-color .15s, background .15s, box-shadow .15s; min-width: 0; }
  .sa-type input { position: absolute; opacity: 0; pointer-events: none; }
  .sa-type-icon { width: 30px; height: 30px; border-radius: 9px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 16px; background: color-mix(in srgb, var(--sa-c) 10%, white); }
  .sa-type-text { min-width: 0; }
  .sa-type-title { display: block; font-weight: 700; font-size: 13px; color: #0f172a; line-height: 1.3; }
  .sa-type-hint { display: block; font-size: 11px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sa-type:has(input:checked) { border-color: var(--sa-c); background: color-mix(in srgb, var(--sa-c) 6%, white); box-shadow: 0 0 0 1px var(--sa-c) inset; }
  .sa-type:has(input:checked) .sa-type-title { color: var(--sa-c); }

  /* สถานะ — ป้ายพื้นอ่อน+จุด */
  .sa-stats { display: flex; flex-wrap: wrap; gap: 8px; }
  .sa-stat { position: relative; display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border: 1px solid #e2e8f0; border-radius: 999px; cursor: pointer; background: #fff; font-size: 13px; font-weight: 700; color: #475569; transition: border-color .15s, background .15s, color .15s; }
  .sa-stat input { position: absolute; opacity: 0; pointer-events: none; }
  .sa-stat::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--sa-s); }
  .sa-stat:has(input:checked) { border-color: var(--sa-s); background: color-mix(in srgb, var(--sa-s) 10%, white); color: var(--sa-s); }
  .sa-locked { font-size: 12.5px; color: #475569; background: #f1f5f9; border-radius: 10px; padding: 10px 12px; }

  /* หลายวัน */
  .sa-checkbox-row { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; font-weight: 600; color: #334155; margin: 0 0 12px; cursor: pointer; padding: 10px 12px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; }
  .sa-checkbox-row input { width: 18px !important; height: 18px; margin: 1px 0 0; flex-shrink: 0; accent-color: #2563eb; cursor: pointer; }
  .sa-checkbox-row span small { display: block; font-weight: 500; color: #64748b; font-size: 11.5px; }
  .sa-checkbox-hint { font-size: 11.5px; color: #64748b; margin: -6px 0 10px; }
  .sa-multi-date-row { display: grid; grid-template-columns: 1fr auto 1fr auto; gap: 8px; align-items: center; margin-bottom: 8px; }
  .sa-multi-date-row > * { min-width: 0; }
  .sa-multi-date-row .sa-range-sep { color: #94a3b8; font-weight: 700; }
  .sa-multi-date-remove { width: 36px; height: 36px; padding: 0 !important; justify-content: center; }
  .sa-row-confirm-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 8px 10px; margin: -2px 0 8px; font-size: 12px; color: #991b1b; }
  .sa-row-confirm-actions { display: flex; gap: 6px; flex-shrink: 0; }
  .sa-row-confirm-actions .sa-btn { padding: 6px 12px; font-size: 12px; }

  /* ── ปุ่มล่าง ── */
  #sa-action-bar { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: #fff; border-top: 1px solid #e2e8f0; flex-shrink: 0; }
  .sa-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid transparent; border-radius: 10px; padding: 10px 18px; font-size: 14px; font-weight: 700; cursor: pointer; white-space: nowrap; transition: background .15s, border-color .15s, opacity .15s; font-family: inherit; }
  .sa-btn:disabled { opacity: .6 !important; cursor: not-allowed; }
  .sa-btn-primary { background: #2563eb; color: #fff; }
  .sa-btn-primary:hover { background: #1d4ed8; }
  .sa-btn-ghost { background: #fff; color: #475569; border-color: #e2e8f0; }
  .sa-btn-ghost:hover { background: #f8fafc; border-color: #cbd5e1; }
  .sa-btn-danger { background: #fff; color: #dc2626; border-color: #fecaca; }
  .sa-btn-danger:hover { background: #fef2f2; }
  .sa-btn-spacer { flex: 1; }
  @media (max-width: 480px) {
    #sa-action-bar .sa-btn-primary { flex: 1; }
    .sa-btn { padding: 11px 14px; }
  }

  /* ✅ (8 ต.ค. 2569 ผู้ใช้: "ทำให้มันเต็มหน้าจอมือถือ") — มือถือเปิดเต็มจอ ไม่มีขอบมน ไม่เหลือพื้นหลังรอบๆ */
  @media (max-width: 600px) {
    .swal2-container:has(.swal-sales-appt) { padding: 0 !important; }
    .swal-sales-appt.swal2-popup {
      width: 100vw !important; max-width: 100vw !important; height: 100dvh !important; max-height: 100dvh !important;
      margin: 0 !important; border-radius: 0 !important; box-shadow: none !important;
    }
    #sa-header { padding-top: max(14px, env(safe-area-inset-top)); }
    #sa-action-bar { padding-bottom: max(12px, env(safe-area-inset-bottom)); }
    #sa-body { padding: 12px 12px 18px; }
  }
`;

/** หัวกล่อง: กล่องไอคอนสีอ่อน + ชื่อ + บรรทัดรอง */
export const salesFormHeader = ({ icon, color, title, sub }) => `
  <div id="sa-header">
    <div id="sa-header-icon" style="background:color-mix(in srgb, ${color} 10%, white);border:1px solid color-mix(in srgb, ${color} 22%, white)">${icon}</div>
    <div id="sa-header-info"><h3>${title}</h3><small>${sub}</small></div>
  </div>`;

/** ปุ่มเลือกประเภทนัด 1 ปุ่ม */
export const salesTypeCard = (t, checked, esc) => `
  <label class="sa-type" data-color="${t.color}">
    <input type="radio" name="saType" value="${esc(t.key)}" ${checked ? "checked" : ""} />
    <span class="sa-type-icon">${t.icon}</span>
    <span class="sa-type-text"><span class="sa-type-title">${esc(t.key)}</span><span class="sa-type-hint">${esc(t.hint)}</span></span>
  </label>`;
