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

    .ade-month-badge {
      display: inline-flex; align-items: center; gap: 6px;
      background: #fef2f2; border: 1px solid #fecaca;
      color: #991b1b; border-radius: 20px; padding: 4px 14px;
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

  const isEditMode = Boolean(existingDraft);

  const [customers, , jobTypes, systemTypes] = await Promise.all([
    CustomerService.getCustomers(),
    AuthService.getAllUserData(),
    JobTypeService.getAll(),
    SystemTypeService.getAll(),
  ]);

  // ✅ โหมดแก้ไข: ทำ option ของค่าที่มีอยู่แล้วเป็น "selected" ให้ TomSelect หยิบไปแสดงตอน init
  const opt = (value, current) =>
    `<option value="${value}"${current === value ? " selected" : ""}>${value}</option>`;

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

    <p class="ade-section-label">ข้อมูลโครงการ</p>
    <div class="ade-grid ade-grid-3">
      <div class="ade-field">
        <label>🏢 ชื่อบริษัท</label>
        <select id="adeCompany"><option selected disabled value="">— เลือกหรือพิมพ์ —</option>${companyOpts}</select>
      </div>
      <div class="ade-field">
        <label><span class="req">*</span> ชื่อโครงการ</label>
        <select id="adeSite"><option selected disabled value="">— เลือกหรือพิมพ์ —</option>${siteOpts}</select>
      </div>
      <div class="ade-field">
        <label><span class="req">*</span> ประเภทงาน</label>
        <select id="adeTitle"><option selected disabled value="">— เลือกหรือพิมพ์ —</option>${titleOpts}</select>
      </div>
    </div>

    <div class="ade-grid ade-grid-2">
      <div class="ade-field">
        <label><span class="req">*</span> ระบบงาน</label>
        <select id="adeSystem"><option selected disabled value="">— เลือกหรือพิมพ์ —</option>${systemOpts}</select>
      </div>
      <div class="ade-field">
        <label>🔢 ครั้งที่</label>
        <select id="adeTime"><option selected disabled value="">— เลือก —</option>${timeOpts}</select>
      </div>
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
        const mkTs = (id, placeholder = "", maxOptions = 7) => {
          try {
            return new TomSelect(id, {
              create: true,
              maxOptions,
              placeholder,
              sortField: { field: "text", direction: "asc" },
              allowEmptyOption: true,
            });
          } catch { return null; }
        };

        mkTs("#adeCompany", "เลือกหรือพิมพ์ชื่อบริษัท");
        mkTs("#adeSite",    "เลือกหรือพิมพ์ชื่อโครงการ");
        mkTs("#adeTitle",   "เลือกหรือพิมพ์ประเภทงาน");
        mkTs("#adeSystem",  "เลือกหรือพิมพ์ระบบงาน");
        mkTs("#adeTime",    "เลือกครั้งที่", 4);

        document.getElementById("ade-btnCancel")?.addEventListener("click", () => Swal.close());

        document.getElementById("ade-btnConfirm")?.addEventListener("click", async (clickEvt) => {
          if (isSavingDraft) return;

          const PLACEHOLDER = "— เลือกหรือพิมพ์ —";
          const getVal = (id) => {
            const raw = document.getElementById(id)?.value?.trim() || "";
            return raw === PLACEHOLDER ? "" : raw;
          };

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
