/**
 * WorkNoticeDialog — กล่องออก "ใบแจ้งเข้าปฏิบัติงาน"
 *
 * ✅ ยกแบบมาจาก DeliveryNoteDialog (ใบส่งมอบงาน) ทั้งโครง ตามที่ผู้ใช้ขอ — ทุกช่องถูกเติมมาให้ครบตั้งแต่
 * เปิดกล่องโดยอ่านจากตัวงานจริง (โครงการ/บริษัท/ประเภทงาน/ระบบ/ครั้งที่/วันเข้างาน/ทีมที่เข้า) + ที่อยู่
 * จากทะเบียนลูกค้า + เลขที่เอกสารถัดไปจาก server ผู้ใช้กรณีปกติจึงกด "ออกเอกสาร" ได้เลยโดยไม่ต้องพิมพ์
 * อะไรสักตัว ส่วนกรณีที่ต้องปรับถ้อยคำก็ยังแก้ได้ทุกช่องก่อนออกจริง
 *
 * 🐛 ของเดิมออกใบนี้ผ่าน "toast ถามยืนยัน" ที่หายเองใน 5 วินาที (ดู EditEvent.js เดิม) — กดไม่ทันก็ต้อง
 * เริ่มใหม่, ปุ่มในนั้นผูก event ด้วย setTimeout 100ms (พลาดได้ถ้าเครื่องช้า), และแก้อะไรในเอกสารไม่ได้เลย
 * นอกจาก 3 ช่องที่บังเอิญมีอยู่ในฟอร์มแก้ไขงาน — เปลี่ยนมาเป็นกล่องเต็มรูปแบบแบบเดียวกับใบส่งมอบงาน
 *
 * ⚠️ เลขที่เอกสารถูก "กินจริง" ตอนกดออกเท่านั้น (DocNumberService.next) ไม่ใช่ตอนเปิดกล่อง —
 * เปิดดูแล้วปิดไปเฉยๆ ต้องไม่ทำให้เลขกระโดดหายไปหนึ่งใบ
 *
 * ✅ (25 พ.ย. 2569 ผู้ใช้: "ทำให้สามารถกดแก้ไขได้ย้อนหลัง หรือสร้างซ้ำ เผื่อบางทีการแจ้งกำหนดการงานนั้นๆมีการแก้ไข")
 *    งานที่ออกใบแล้ว → เลือกได้ 2 ทาง (ผู้มีสิทธิ์แก้เอกสาร หรือคนที่ออกใบนั้น):
 *      • mode "edit"    แก้ไขใบนี้ — เลขที่เดิม · server เก็บฉบับก่อนแก้ไว้ในประวัติ (PUT /issued-documents/:id/revise)
 *      • mode "reissue" ออกใบใหม่แทน — เลขที่ใหม่ · ใบเดิมถูกยกเลิกให้อัตโนมัติ (POST พร้อม replaceId)
 *    ทั้งสองทางเริ่มจากข้อความของใบเดิม + บอกถ้าวันในตารางงานเปลี่ยนไปแล้ว (กดปุ่มเดียวใช้วันล่าสุด)
 *
 * ✅ (26 พ.ย. 2569 ผู้ใช้: "ใบแจ้งเข้างานให้มีตัวเลือกแบบแค่เดือนด้วย เพราะบางทีจะแจ้งแผนงานทั้งปีไปก่อน")
 *    กำหนดการเลือกได้ "ระบุวันที่" (รายวัน แบบเดิม) หรือ "ระบุแค่เดือน" (ครั้งที่ · ช่วงเดือน · รายละเอียด)
 *    งานสัญญาเติมทุกครั้งของปีสัญญาให้ตามแผนงานทั้งปี · planPreset = เปิดมาจากหน้าแผนงานทั้งปีของสัญญา
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Stack, Typography,
  TextField, Button, IconButton, Alert, useMediaQuery, CircularProgress, Autocomplete,
  Switch, FormControlLabel, Menu, MenuItem, ListItemIcon,
} from "@mui/material";
import { VisibilityRounded as Visibility, EventAvailableRounded as EventAvailable, RefreshRounded as Refresh, SearchRounded as Search, AddRounded as Add, DeleteOutlineRounded as DeleteOutline, ContentPasteRounded as ContentPaste, AutoFixHighRounded as AutoFixHigh, CalendarMonthRounded as CalendarMonth, TodayRounded as Today } from "@mui/icons-material";
import { jsPDF } from "jspdf";
import thSarabunFont from "@/assets/fonts/THSarabunNew_base64";
import DocNumberService from "@/shared/services/DocNumberService";
import CustomerService from "@/shared/services/CustomerService";
import {
  buildWorkNoticeDefaults, buildWorkNoticeBody, buildWorkNoticeCooperation,
  generateWorkNoticePdf, noticeSubjectPresetsFor, buildDayRows, dayRowText,
  TIME_PRESETS, SUPPORT_REQUEST_PRESETS, workVerbFor,
  SCHEDULE_MODES, buildMonthRows, monthRowText,
  SIGNER_POSITION_PRESETS, thaiFullDate, ISSUER,
} from "../utils/workNoticePdf";
import moment from "moment";
import { resolveJobFields, referencePresetsFor, attentionPresetsFor } from "../utils/deliveryNotePdf";
import DocumentPreviewDialog from "./DocumentPreviewDialog";
import MailService from "@/shared/services/MailService";
import IssuedDocumentService from "@/shared/services/IssuedDocumentService";
import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import ThaiMonthSelect from "@/shared/ui/ThaiMonthSelect";
import { addMonthsKey, isMonthKey, monthDiff } from "@/shared/utils/contractPlan";
import SignatureService from "@/shared/services/SignatureService";
import StaffDirectoryService from "@/shared/services/StaffDirectoryService";
import { useAuth } from "@/features/auth/AuthContext";
import usePermissions from "@/shared/hooks/usePermissions";
import {
  DocDialogHeader, DocSection, FoldSection, AutoTextBar, docFormSx, SubHeader, DraftBanner, IssuedSummary, SignerPreview, useDocDraft, useIssuedTarget,
  OUTLINE_BTN_SX,
} from "./docFormKit";
import { INK_2, MUTED, FAINT, LINE, SURFACE, DANGER, PRIMARY_BTN_SX } from "@/shared/ui/PageKit";

// ✅ สีประจำเอกสารชนิดนี้เป็น "ฟ้า" ไม่ใช่แดงเหมือนใบส่งมอบงาน — ตรงกับสีปุ่ม "📄 ออกใบแจ้งเข้างาน"
// ในหน้าแก้ไขงาน (.ee-btn-info = #0ea5e9) ผู้ใช้จึงเชื่อมโยงได้ทันทีว่ากล่องนี้มาจากปุ่มไหน และแยกออก
// จากกล่องใบส่งมอบงาน (แดง #dc2626 / ปุ่ม .ee-btn-delivery เขียวน้ำเงิน) ตั้งแต่แวบแรกที่เปิด
const ACCENT = "#0284c7";
const TEXT_SUB = MUTED;

/** จับคู่งานกับทะเบียนลูกค้า (โครงการ + บริษัท ก่อน แล้วค่อยอย่างใดอย่างหนึ่ง) */
const findCustomer = (list, job) => {
  const p = resolveJobFields(job);
  const norm = (v) => String(v || "").trim().toLowerCase();
  return list.find((c) => norm(c.cSite) === norm(p.site) && norm(c.cCompany) === norm(p.company))
    || list.find((c) => norm(c.cSite) === norm(p.site))
    || (p.company ? list.find((c) => norm(c.cCompany) === norm(p.company)) : null);
};

/**
 * @param docOverride ✅ (26 พ.ย. 2569) ใบที่ออกแล้ว (จากหน้าทะเบียนเอกสาร) — จัดการใบนี้ตรง ๆ ไม่ต้องหาจากงาน
 * @param initialMode "edit" | "reissue" — เปิดมาแล้วเข้าโหมดแก้ไข/ออกใหม่แทนเลย (เมนู ⋮ ในทะเบียนเอกสาร)
 * ⚠️ job = {} ได้ (ออกใบที่ไม่ผูกงาน — เฉพาะผู้มีสิทธิ์แก้เอกสาร · server ตรวจตอนขอเลข)
 * @param planPreset ✅ (26 พ.ย. 2569) { monthRows, planYearLabel } — เปิดมาเป็นแบบ "ระบุแค่เดือน" พร้อมแผนทั้งปี (หน้าแผนงานทั้งปีของสัญญา)
 */
const WorkNoticeDialog = ({ open, onClose, job, customer, issuer, canUseRunningNumber = false, docOverride = null, initialMode = null, planPreset = null }) => {
  const isMobile = useMediaQuery("(max-width:600px)");
  const [form, setFormState] = useState(null);
  // ✅ แยก "ผู้ใช้แก้เอง" (setForm → นับเป็นร่าง) ออกจาก "ระบบเติมให้" (setFormState) — ดู useDocDraft
  const dirtyRef = useRef(false);
  const setForm = (u) => { dirtyRef.current = true; setFormState(u); };
  const [toolsAnchor, setToolsAnchor] = useState(null);
  const [viewingExisting, setViewingExisting] = useState(false);
  const [previewNumber, setPreviewNumber] = useState("");
  const [loadingNumber, setLoadingNumber] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [customerList, setCustomerList] = useState([]);
  // ✅ ขั้นตอนดูตัวอย่างก่อนออกจริง — preview เก็บไฟล์ที่กำลังแสดง, issued บอกว่ากินเลขจริงไปแล้วหรือยัง
  const [preview, setPreview] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [issued, setIssued] = useState(false);
  /** null = ออกใบใหม่ปกติ · "edit" = แก้ไขใบที่ออกแล้ว (เลขเดิม) · "reissue" = ออกใบใหม่แทนใบเดิม (เลขใหม่) */
  const [mode, setMode] = useState(null);
  useEffect(() => { if (!open) setMode(null); }, [open]);

  // ✅ ตั้งค่าเริ่มต้นใหม่ทุกครั้งที่เปิดกล่อง — ไม่ค้างค่าของงานก่อนหน้าไว้ (กล่องนี้ถูกใช้ซ้ำกับทุกงาน
  // ในหน้าเดียวกัน ถ้าไม่รีเซ็ตจะเปิดงาน B แล้วเห็นข้อมูลงาน A ค้างอยู่)
  useEffect(() => {
    if (!open || !job) return;
    const base0 = buildWorkNoticeDefaults(job, customer, issuer);
    const base = planPreset?.monthRows?.length
      ? { ...base0, scheduleMode: "months", monthRows: planPreset.monthRows, planYearLabel: planPreset.planYearLabel || "" }
      : base0;
    if (base !== base0) base.subject = noticeSubjectPresetsFor(base.workLabel, base.roundLabel, base)[0];
    setFormState({
      ...base,
      body: buildWorkNoticeBody(base),
      cooperationNote: buildWorkNoticeCooperation(base.scheduleMode),
    });
    setError("");

    // ⚠️ กัน setState หลังกล่องถูกปิด/เปลี่ยนงานไปแล้ว (คำขอที่ยิงไปยังค้างอยู่กลางทางได้เสมอ)
    let alive = true;

    // ⚠️ ขอเลขเดินหน้าเฉพาะคนที่มีสิทธิ์ออกเลขจริงเท่านั้น (server จำกัด POST /doc-number/next ไว้ที่
    // admin/manager — ดู routes/docNumber.js) ช่างยังออกใบแจ้งเข้างานได้เหมือนเดิม แต่ใช้ "เลขที่อ้างอิง"
    // ของงานนั้นแทน ถ้าเรียกขอเลขให้ทุกคนจะกลายเป็นปุ่มที่ช่างกดแล้วขึ้น error ทุกครั้ง
    if (canUseRunningNumber) {
      setLoadingNumber(true);
      DocNumberService.peek("notice")
        .then((d) => {
          if (!alive) return;
          setPreviewNumber(d.docNumber);
          setFormState((f) => (f ? { ...f, docNumber: d.docNumber } : f));
        })
        .catch(() => { if (alive) setPreviewNumber(""); })
        .finally(() => { if (alive) setLoadingNumber(false); });
    }

    CustomerService.getCustomers()
      .then((res) => {
        if (!alive) return;
        // ⚠️ API /customer คืนค่าในคีย์ "userCustomers" (ดู routes/customer.js) — ตัวอื่นเป็น fallback
        const list = res?.userCustomers || res?.customers || res?.data
          || (Array.isArray(res) ? res : []);
        setCustomerList(Array.isArray(list) ? list : []);
        if (customer) return;
        const found = findCustomer(list, job);
        if (found) {
          setFormState((f) => (f ? {
            ...f,
            customerAddress: f.customerAddress || found.address || "",
            customerCompany: f.customerCompany || found.cCompany || "",
            customerTaxId: f.customerTaxId || found.tax || "",
          } : f));
        }
      })
      // ⚠️ หาที่อยู่ไม่เจอต้องไม่บล็อกการออกเอกสาร — ที่อยู่ไม่ใช่ช่องบังคับ (พิมพ์เองได้ในกล่อง)
      .catch(() => {});

    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- planPreset อ่านครั้งเดียวตอนเปิด
  }, [open, job, customer, issuer, canUseRunningNumber]);

  // ✅ ร่างอัตโนมัติ + กันออกซ้ำ (ผู้ใช้สั่ง 3 ต.ค. 2569) — ⚠️ ต้องอยู่หลัง effect ตั้งค่าเริ่มต้นด้านบน
  const eventId = String(job?.id || job?._id || "");
  const draft = useDocDraft({
    open, draftKey: eventId && !mode ? `notice:${eventId}` : "", form, setFormState, dirtyRef,
    // เลขที่เดินหน้าออกให้ใหม่ทุกครั้ง — ไม่กู้คืนเลขเก่าจากร่าง
    omit: canUseRunningNumber ? ["docNumber"] : [],
  });
  const existing = useIssuedTarget({ open, eventId, docType: "notice", docOverride });

  /**
   * เริ่มแก้ไข/ออกใหม่แทน — ตั้งต้นจากข้อความของใบเดิม (snapshot) แต่ "วันในตารางงาน" ใช้ของงานตอนนี้
   * (ปุ่ม "ใช้วันตามตารางงานล่าสุด" จะได้สร้างกำหนดการใหม่ตามวันที่เลื่อนแล้ว)
   */
  const { can } = usePermissions();
  const { userData: me } = useAuth();
  const canChangeIssued = Boolean(existing.doc) && existing.doc.status !== "cancelled"
    && (can("editDocuments") || (existing.doc.issuedBy && String(existing.doc.issuedBy) === String(me?.userId || "")));
  const startChange = (next) => {
    const snap = existing.doc?.formSnapshot || {};
    const base = buildWorkNoticeDefaults(job, customer, issuer);
    dirtyRef.current = false;
    setFormState({
      ...base,
      body: buildWorkNoticeBody(base),
      cooperationNote: buildWorkNoticeCooperation(snap.scheduleMode),
      ...snap,
      jobStartDate: base.jobStartDate, jobEndDate: base.jobEndDate, jobDateText: base.jobDateText,
      docNumber: next === "edit" ? existing.doc.docNumber : (canUseRunningNumber ? (previewNumber || snap.docNumber || base.docNumber) : (snap.docNumber || base.docNumber)),
      ...(next === "reissue" ? { issuedAt: moment().format("YYYY-MM-DD") } : {}),
    });
    setError("");
    setMode(next);
  };
  /** วันในตารางงานตอนนี้ ต่างจากกำหนดการในใบไหม (เลื่อนวันงานหลังออกใบ) */
  const jobDays = useMemo(() => (form && mode ? buildDayRows({
    startAt: form.jobStartDate, endAt: form.jobEndDate, title: form.workLabel, system: "", defaultTime: TIME_PRESETS[0],
  }).map((r) => r.date) : []), [form, mode]);
  const docDays = (form?.dayRows || []).map((r) => r.date).filter(Boolean);
  // ใบที่ไม่ผูกงาน (เปิดจากทะเบียนเอกสาร) ไม่มีตารางงานให้เทียบ
  const scheduleChanged = Boolean(mode) && Boolean(eventId) && (form?.scheduleMode || "days") === "days" && jobDays.length > 0 && jobDays.join(",") !== docDays.join(",");
  // เปิดมาจากเมนู ⋮ ของทะเบียนเอกสาร → เข้าโหมดที่สั่งทันทีที่ข้อมูลพร้อม (ครั้งเดียวต่อการเปิด)
  const initModeRef = useRef(false);
  useEffect(() => { if (!open) initModeRef.current = false; }, [open]);
  useEffect(() => {
    if (!open || !initialMode || initModeRef.current || !form || !existing.doc) return;
    initModeRef.current = true;
    startChange(initialMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- เข้าโหมดครั้งเดียวเมื่อพร้อม
  }, [open, initialMode, form, existing.doc]);

  /** ทิ้งร่าง แล้วเริ่มใหม่จากข้อมูลงาน */
  const discardDraft = () => {
    draft.clear();
    const base = buildWorkNoticeDefaults(job, customer, issuer);
    const found = customer ? null : findCustomer(customerList, job);
    setFormState((f) => ({
      ...base,
      body: buildWorkNoticeBody(base),
      cooperationNote: buildWorkNoticeCooperation(),
      docNumber: canUseRunningNumber ? (previewNumber || f?.docNumber || "") : base.docNumber,
      ...(found ? {
        customerAddress: base.customerAddress || found.address || "",
        customerCompany: base.customerCompany || found.cCompany || "",
        customerTaxId: base.customerTaxId || found.tax || "",
      } : {}),
    }));
  };

  // ⚠️ ไม่เปลี่ยนจริง = ไม่นับเป็นการแก้ (Autocomplete ยิง onInputChange ซ้ำตอนเปิดกล่อง → ร่างปลอม)
  const set = (k) => (v) => { if ((form?.[k] ?? "") === (v ?? "")) return; setForm((f) => ({ ...f, [k]: v })); };
  const setField = (k) => (e) => set(k)(e.target.value);

  // ✅ สร้างข้อความใหม่จากค่าที่แก้ล่าสุดได้ตลอด — เผื่อผู้ใช้แก้ชื่อโครงการ/งาน/อ้างถึง หลังเปิดกล่อง
  // (ไม่ทำอัตโนมัติ เพราะถ้าเขาแก้ถ้อยคำเองไว้แล้วจะโดนเขียนทับทิ้ง)
  // ✅ (17 ต.ค. 2569 ผู้ใช้: "อัปเดตข้อความอัตโนมัติไปเลย ไม่ต้องยุ่งยาก") — ข้อความเขียนใหม่ตามข้อมูลทันทีที่ข้อมูลเปลี่ยน
  //    จนกว่าผู้ใช้จะพิมพ์แก้เอง (bodyManual อยู่ในฟอร์ม → ติดไปกับร่างอัตโนมัติด้วย)
  const builtBody = form ? buildWorkNoticeBody(form) : "";
  useEffect(() => {
    if (!form || form.bodyManual || (form.body || "") === builtBody) return;
    setFormState((f) => (f ? { ...f, body: builtBody } : f));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ตามเฉพาะข้อความที่ระบบสร้าง/สถานะแก้เอง
  }, [builtBody, form?.bodyManual]);
  const editBody = (e) => { const v = e.target.value; setForm((f) => ({ ...f, body: v, bodyManual: true })); };
  const resetBody = () => setForm((f) => ({ ...f, bodyManual: false, body: buildWorkNoticeBody(f) }));

  const subjectOptions = useMemo(
    () => noticeSubjectPresetsFor(form?.workLabel, form?.roundLabel, { scheduleMode: form?.scheduleMode, planYearLabel: form?.planYearLabel }),
    [form?.workLabel, form?.roundLabel, form?.scheduleMode, form?.planYearLabel],
  );
  const referenceOptions = useMemo(() => referencePresetsFor(job), [job]);
  const attentionOptions = useMemo(() => attentionPresetsFor(job), [job]);

  // ── กำหนดการรายวัน (เพิ่ม/ลบ/แก้ได้ทุกบรรทัด) ────────────────────────────
  const updateDay = (i, k, v) =>
    setForm((f) => ({ ...f, dayRows: f.dayRows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)) }));
  const removeDay = (i) =>
    setForm((f) => ({ ...f, dayRows: f.dayRows.filter((_, idx) => idx !== i) }));
  // ✅ เพิ่มวันถัดจากบรรทัดสุดท้าย พร้อมก๊อปเวลา/รายละเอียดของบรรทัดนั้นมาให้ — งานหลายวันมักเข้าเวลา
  // เดิมและทำงานคล้ายกัน กดเพิ่มแล้วแก้เฉพาะส่วนที่ต่างจะเร็วกว่ากรอกใหม่ทั้งบรรทัดทุกครั้ง
  const addDay = () =>
    setForm((f) => {
      const rows = f.dayRows || [];
      const last = rows[rows.length - 1];
      const nextDate = last?.date
        ? moment(last.date).add(1, "day").format("YYYY-MM-DD")
        : f.jobStartDate;
      return {
        ...f,
        dayRows: [...rows, {
          date: nextDate,
          time: last?.time || TIME_PRESETS[0],
          detail: last?.detail || workVerbFor(f.workLabel),
        }],
      };
    });
  // ✅ สร้างรายการใหม่ทั้งชุดตามวันที่ที่งานลงตารางไว้ — ใช้ตอนแก้มั่วจนอยากเริ่มใหม่ หรือตอนที่เลื่อน
  // วันงานในระบบแล้วอยากให้เอกสารตามวันใหม่
  const regenerateDays = () =>
    setForm((f) => ({
      ...f,
      dayRows: buildDayRows({
        startAt: f.jobStartDate, endAt: f.jobEndDate,
        title: f.workLabel, system: "", defaultTime: f.dayRows?.[0]?.time || TIME_PRESETS[0],
      }),
    }));
  // ✅ "ใช้ค่าของวันแรกกับทุกวัน" — เคสที่เจอบ่อยที่สุดคือเข้าเวลาเดิมทุกวัน แก้ทีละบรรทัดเสียเวลาเปล่า
  const applyFirstToAll = (key) =>
    setForm((f) => {
      const first = f.dayRows?.[0]?.[key];
      if (!first) return f;
      return { ...f, dayRows: f.dayRows.map((r) => ({ ...r, [key]: first })) };
    });

  // บรรทัดที่จะถูกพิมพ์จริง (บรรทัดที่ไม่มีข้อมูลอะไรเลยจะถูกข้าม)
  const printedDays = (form?.dayRows || []).filter((r) => dayRowText(r));

  // ── ✅ (26 พ.ย. 2569) แบบ "ระบุแค่เดือน" — แผนล่วงหน้า (มักทั้งปี) ยังไม่ลงวันที่ ─────────────────
  const byMonth = form?.scheduleMode === "months";
  const printedMonths = (form?.monthRows || []).filter((r) => monthRowText(r));
  /** สลับแบบกำหนดการ — ถ้อยคำที่ระบบตั้งให้ (เรื่อง · ย่อหน้าปิด) เปลี่ยนตามแบบ · ที่พิมพ์แก้เองแล้วไม่แตะ */
  const switchScheduleMode = (next) => setForm((f) => {
    const cur = f.scheduleMode || "days";
    if (cur === next) return f;
    const out = { ...f, scheduleMode: next };
    if (next === "months" && !(f.monthRows || []).some((r) => isMonthKey(r.month))) {
      const built = buildMonthRows(job, { startDate: f.jobStartDate });
      out.monthRows = built.rows.map((r) => ({ ...r, detail: r.detail || workVerbFor(f.workLabel) }));
      out.planYearLabel = f.planYearLabel || built.yearLabel;
    }
    const oldSubjects = noticeSubjectPresetsFor(f.workLabel, f.roundLabel, { scheduleMode: cur, planYearLabel: f.planYearLabel });
    if (!f.subject?.trim() || oldSubjects.includes(f.subject)) out.subject = noticeSubjectPresetsFor(out.workLabel, out.roundLabel, out)[0];
    if (!f.cooperationNote?.trim() || f.cooperationNote === buildWorkNoticeCooperation(cur)) out.cooperationNote = buildWorkNoticeCooperation(next);
    return out;
  });
  const updateMonth = (i, k, v) =>
    setForm((f) => ({ ...f, monthRows: f.monthRows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)) }));
  const removeMonth = (i) => setForm((f) => ({ ...f, monthRows: f.monthRows.filter((_, idx) => idx !== i) }));
  /** เพิ่มแถวถัดไป — เดือนห่างเท่าระยะของ 2 แถวสุดท้าย (ไม่มี = เดือนถัดไป) · ครั้งที่ "2/4" → "3/4" */
  const addMonth = () => setForm((f) => {
    const rows = f.monthRows || [];
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    const step = last?.month && prev?.month && isMonthKey(last.month) && isMonthKey(prev.month) ? Math.max(1, monthDiff(prev.month, last.month)) : 1;
    const m = String(last?.round || "").match(/^(\d+)\/(\d+)$/);
    return {
      ...f,
      monthRows: [...rows, {
        ...(Number(last?.time) >= 1 ? { time: Number(last.time) + 1 } : {}),
        month: isMonthKey(last?.month) ? addMonthsKey(last.month, step) : (f.jobStartDate || "").slice(0, 7),
        monthTo: "",
        round: m ? `${Number(m[1]) + 1}/${m[2]}` : "",
        detail: last?.detail || workVerbFor(f.workLabel),
      }],
    };
  });
  /** เติมใหม่ทั้งชุดตามแผนงานทั้งปีของสัญญา (งานทั่วไป = เดือนของงานนี้) */
  const regenerateMonths = () => setForm((f) => {
    const built = buildMonthRows(job, { startDate: f.jobStartDate });
    return { ...f, monthRows: built.rows, planYearLabel: built.yearLabel || f.planYearLabel };
  });
  const applyFirstMonthDetail = () => setForm((f) => {
    const first = f.monthRows?.[0]?.detail;
    return first ? { ...f, monthRows: f.monthRows.map((r) => ({ ...r, detail: first })) } : f;
  });

  const missing = useMemo(() => {
    if (!form) return [];
    const m = [];
    if (!form.subject?.trim()) m.push("เรื่อง");
    if (!form.site?.trim()) m.push("ชื่อโครงการ");
    // ⚠️ ต้องมีกำหนดการอย่างน้อย 1 บรรทัด ไม่งั้นใบแจ้งเข้างานจะไม่ได้แจ้งอะไรเลย
    if (form.scheduleMode === "months") {
      if (!(form.monthRows || []).some((r) => monthRowText(r))) m.push("แผนรายเดือน (เลือกเดือนอย่างน้อย 1 แถว)");
    } else if (!(form.dayRows || []).some((r) => dayRowText(r))) m.push("กำหนดการรายวัน");
    if (!form.signerName?.trim()) m.push("ชื่อผู้ออกเอกสาร");
    return m;
  }, [form]);

  // ── ขั้นตอน "ดูตัวอย่าง → ยืนยันออก" ──────────────────────────────────────
  // ⚠️ blob url ต้อง revoke เองทุกครั้งที่สร้างใบใหม่ทับหรือปิดกล่อง — โหมด "blob" ของ outputDocument
  // ไม่ revoke ให้ (กล่องพรีวิวยังถือ url ค้างไว้แสดงอยู่) ถ้าไม่เก็บกวาดเอง เปิดๆ ปิดๆ หลายรอบจะมี
  // ไฟล์ค้างในหน่วยความจำสะสมไปเรื่อยๆ จนกว่าจะปิดแท็บ
  const replacePreview = (next) => setPreview(next);

  // ✅ คืนหน่วยความจำของไฟล์ตัวอย่าง — cleanup ของ effect นี้ทำงานทั้งตอน "สร้างไฟล์ใหม่ทับ" (revoke ตัว
  // เก่าที่ถูกแทนที่) และตอน "คอมโพเนนต์ถูกถอดออก" (ปิดกล่อง/เปลี่ยนหน้า) ครบทั้ง 2 ทางในที่เดียว
  // ⚠️ จำเป็นเพราะ outputDocument โหมด "blob" ไม่ revoke ให้เอง (กล่องพรีวิวยังต้องถือ url ไว้แสดง
  // อยู่ จะนานแค่ไหนก็แล้วแต่ผู้ใช้) ถ้าไม่เก็บกวาด เปิดๆ ปิดๆ หลายรอบจะมีไฟล์ค้างในหน่วยความจำสะสม
  useEffect(() => {
    const url = preview?.url;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [preview?.url]);



  /**
   * ✅ ผู้ลงนามเลือกจากทะเบียนพนักงานได้เลย (ผู้ใช้ขอ: "ให้เลือกชื่อ พร้อมเบอร์ ในระบบได้เลย")
   * — เลือกแล้วเติมตำแหน่ง/เบอร์ให้อัตโนมัติ · ยังพิมพ์ชื่อเองได้ (freeSolo) สำหรับคนนอกทะเบียน
   */
  const [staffOptions, setStaffOptions] = useState([]);
  useEffect(() => {
    if (!open) return;
    StaffDirectoryService.list().then(setStaffOptions);
  }, [open]);

  // ✅ (17 ต.ค. 2569 "กรอกน้อยที่สุด") ผู้ลงนามที่ระบบเติมให้ → เติมชื่อเต็ม/ตำแหน่ง/เบอร์จากทะเบียนพนักงานให้เอง (ครั้งเดียวต่อการเปิดกล่อง)
  const signerAutoRef = useRef(false);
  useEffect(() => { if (!open) signerAutoRef.current = false; }, [open]);
  useEffect(() => {
    if (signerAutoRef.current || !staffOptions.length || !form?.signerName) return;
    signerAutoRef.current = true;
    const norm = (v) => String(v || "").replace(/\s+/g, " ").trim();
    const name = norm(form.signerName);
    const hit = staffOptions.find((o) => norm(o.name) === name) || staffOptions.find((o) => norm(o.name).startsWith(`${name} `));
    if (!hit) return;
    setFormState((f) => (f ? {
      ...f,
      signerName: hit.name,
      signerPosition: hit.position && (!f.signerPosition || SIGNER_POSITION_PRESETS.includes(f.signerPosition)) ? hit.position : f.signerPosition,
      ...("signerTel" in f && !f.signerTel && hit.tel ? { signerTel: hit.tel } : {}),
    } : f));
  }, [staffOptions, form?.signerName]);
  const filterStaff = (options, state) => {
    const q = String(state.inputValue || "").trim().toLowerCase();
    if (!q) return options.slice(0, 30);
    return options.filter((o) => [o.name, o.position, o.tel, o.role].join(" ").toLowerCase().includes(q)).slice(0, 30);
  };
  const pickSigner = (v) => {
    if (!v || typeof v === "string") return;
    // เบอร์ติดต่อกลับมาจากทะเบียนพนักงาน — ลูกค้าใช้โทรกลับเมื่อต้องเลื่อนนัด (ใบแจ้งเข้างานเท่านั้น)
    setForm((f) => ({ ...f, signerName: v.name, signerPosition: v.position || f.signerPosition, signerTel: v.tel || f.signerTel }));
  };

  // ── ลายเซ็นอิเล็กทรอนิกส์ของผู้ออกเอกสาร ─────────────────────────────────
  const { userData } = useAuth();
  const [mySignature, setMySignature] = useState(null);
  const [useMySignature, setUseMySignature] = useState(true);
  useEffect(() => {
    if (!open) return;
    SignatureService.me().then(setMySignature);
  }, [open]);
  const myFullName = [userData?.fname, userData?.lname].filter(Boolean).join(" ").trim();
  const sameName = (a, b) => String(a || "").replace(/\s+/g, " ").trim() === String(b || "").replace(/\s+/g, " ").trim();
  const signerIsMe = Boolean(myFullName) && sameName(form?.signerName, myFullName);
  /** ⚠️ ไม่เก็บรูปลายเซ็นไว้ใน form state — ทะเบียนเอกสารเก็บ formSnapshot ทั้งก้อน ถ้าใส่รูปไปด้วย
   * ฐานข้อมูลจะบวมขึ้นหลักร้อย KB ต่อใบโดยไม่จำเป็น (ใส่ตอนสร้างไฟล์เท่านั้น) */
  const signatureImage = mySignature && useMySignature && signerIsMe ? mySignature.image : "";

  const buildPdf = (docNumber) =>
    generateWorkNoticePdf({ jsPDF, thSarabunFont, form: { ...form, docNumber, signatureImage }, mode: "blob" });

  /** ขั้นที่ 1 — สร้างไฟล์ตัวอย่างด้วย "เลขที่ที่จะได้" โดยยังไม่กินเลขจริง */
  const handlePreview = async () => {
    if (existing.doc && !mode) return;
    if (missing.length > 0) {
      setError(`กรุณากรอก: ${missing.join(" · ")}`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { url, blob, fileName } = await buildPdf(form.docNumber);
      replacePreview({ url, blob, fileName });
      setIssued(false);
      setViewingExisting(false);
      setPreviewOpen(true);
    } catch {
      setError("สร้างตัวอย่างเอกสารไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  };

  /** ขั้นที่ 2 — กินเลขจริงแล้วสร้างไฟล์ใหม่ด้วยเลขนั้น (ไฟล์ตัวอย่างถูกแทนที่ทันที) */
  const handleConfirm = async () => {
    setBusy(true);
    setError("");
    try {
      // ⚠️ กินเลขจริงตรงนี้ที่เดียวเท่านั้น และต้องได้เลขมาก่อนถึงจะสร้างไฟล์ — เอกสารที่ไม่มีเลขอ้างอิง
      // คือเอกสารที่ตามกลับไม่ได้ (เฉพาะคนที่มีสิทธิ์ออกเลข ส่วนคนอื่นใช้เลขที่กรอกไว้ในช่องตามเดิม)
      const fields = {
        issuedAt: form.issuedAt, subject: form.subject, site: form.site, customerCompany: form.customerCompany,
        workLabel: form.workLabel, roundLabel: form.roundLabel, signerName: form.signerName,
      };
      // ✅ แก้ไขใบเดิม — เลขที่เดิม ไม่กินเลขใหม่ · บันทึกก่อนแล้วค่อยสร้างไฟล์ (ทะเบียนต้องตรงกับไฟล์ที่ส่ง)
      if (mode === "edit") {
        const saved = await IssuedDocumentService.revise(existing.doc._id, { ...fields, formSnapshot: { ...form, docNumber: existing.doc.docNumber } });
        const { url, blob, fileName } = await buildPdf(saved.docNumber);
        replacePreview({ url, blob, fileName });
        setIssued(true);
        existing.setDoc(saved);
        setMode(null);
        return;
      }
      // ✅ ตรวจซ้ำอีกรอบก่อนออกจริง — อีกคน/อีกแท็บอาจออกใบของงานนี้ไปแล้วระหว่างที่กรอกอยู่ (ออกใหม่แทน = ข้ามใบที่กำลังถูกแทน)
      const dup = await IssuedDocumentService.activeForEvent(eventId, "notice").catch(() => null);
      if (dup && !(mode === "reissue" && String(dup._id) === String(existing.doc?._id))) {
        existing.setDoc(dup);
        setPreviewOpen(false);
        setError(`งานนี้ออกใบแจ้งเข้างานไปแล้ว (เลขที่ ${dup.docNumber}) — ออกซ้ำไม่ได้`);
        return;
      }
      let finalNumber = form.docNumber;
      if (canUseRunningNumber) {
        // ⚠️ ส่ง id ของงานไปด้วย — backend ใช้ตรวจว่าผู้ขอเลขเกี่ยวข้องกับงานนี้จริง (ดู /doc-number/next)
        const res = await DocNumberService.next("notice", job?.id || job?._id, mode === "reissue" ? existing.doc?._id : undefined);
        finalNumber = res.docNumber;
      }
      const { url, blob, fileName } = await buildPdf(finalNumber);
      setForm((f) => ({ ...f, docNumber: finalNumber }));
      replacePreview({ url, blob, fileName });
      setIssued(true);
      // ✅ บันทึกลงทะเบียนเอกสารทันทีที่ออกจริง (ดูหน้า "ทะเบียนเอกสาร")
      // ⚠️ ห้าม await รวมใน try เดียวกับการสร้างไฟล์ — ถ้าบันทึกทะเบียนล้มเหลว (เน็ตหลุด/สิทธิ์ไม่พอ)
      // ต้องไม่ทำให้ผู้ใช้เห็นว่า "ออกเอกสารไม่สำเร็จ" ทั้งที่เลขถูกกินและไฟล์ออกเรียบร้อยแล้ว
      draft.clear();
      const replaceId = mode === "reissue" ? existing.doc?._id : undefined;
      IssuedDocumentService.create({
        ...(replaceId ? { replaceId } : {}),
        docType: "notice",
        docNumber: finalNumber,
        issuedAt: form.issuedAt,
        subject: form.subject,
        site: form.site,
        customerCompany: form.customerCompany,
        workLabel: form.workLabel,
        roundLabel: form.roundLabel,
        signerName: form.signerName,
        eventId: job?.id || job?._id || null,
        contractNo: resolveJobFields(job).contractNo || "",
        formSnapshot: { ...form, docNumber: finalNumber },
      }).then((doc) => { existing.setDoc(doc); setMode(null); }).catch((e) => setError(e?.response?.data?.message || "บันทึกทะเบียนเอกสารไม่สำเร็จ"));
    } catch (err) {
      if (err?.response?.status === 409 && err.response.data?.doc) {
        existing.setDoc(err.response.data.doc);
        setPreviewOpen(false);
      }
      setError(err?.response?.data?.message || "ออกเอกสารไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  };

  const closeAll = () => {
    replacePreview(null);
    setPreviewOpen(false);
    setIssued(false);
    setViewingExisting(false);
    onClose?.();
  };

  /** เปิดดูใบที่ออกไปแล้ว — สร้างไฟล์จากข้อมูลที่บันทึกไว้ในทะเบียน (ส่ง/พิมพ์ใบเดิมซ้ำได้) */
  const viewExisting = async () => {
    const snap = existing.doc?.formSnapshot;
    if (!snap || !Object.keys(snap).length) { setError("ใบเดิมไม่มีข้อมูลสำหรับสร้างไฟล์ — เปิดดูได้ที่ทะเบียนเอกสาร"); return; }
    setBusy(true); setError("");
    try {
      const { url, blob, fileName } = await generateWorkNoticePdf({ jsPDF, thSarabunFont, form: snap, mode: "blob" });
      replacePreview({ url, blob, fileName });
      setIssued(true);
      setViewingExisting(true);
      setPreviewOpen(true);
    } catch {
      setError("สร้างไฟล์ใบเดิมไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  };

  if (!form) return null;

  const fieldSx = { bgcolor: "#fff" };
  const locked = Boolean(existing.doc) && !mode;
  const modeLabel = mode === "edit" ? `แก้ไขใบเลขที่ ${existing.doc?.docNumber} (เลขเดิม)` : mode === "reissue" ? `ออกใบใหม่แทนเลขที่ ${existing.doc?.docNumber}` : "";

  return (
    <Dialog
      open={open}
      // ✅ ปิดได้เฉพาะปุ่ม "✕" กับ "ยกเลิก" — เผลอแตะพื้นหลังแล้วหลุดจากฟอร์มยาว (ข้อความยังอยู่ในร่างอัตโนมัติ)
      onClose={(_, reason) => {
        if (busy) return;
        if (reason === "backdropClick" || reason === "escapeKeyDown") return;
        closeAll();
      }}
      fullWidth maxWidth="md" fullScreen={isMobile}
      PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3 } }}
    >
      <DialogTitle sx={{ p: 0 }}>
        <DocDialogHeader
          icon={<EventAvailable />} accent={ACCENT} title="ออกใบแจ้งเข้างาน"
          subtitle={locked
            ? `ออกแล้ว · เลขที่ ${existing.doc.docNumber}`
            : modeLabel ? modeLabel
            : !canUseRunningNumber
              ? "ใช้เลขที่อ้างอิงของงาน"
              : loadingNumber ? "กำลังตรวจเลขที่..." : previewNumber ? `เลขที่ถัดไป ${previewNumber}` : "ออกเลขที่อัตโนมัติ"}
          savedLabel={locked ? "" : draft.savedLabel}
          onClose={closeAll} busy={busy}
        />
      </DialogTitle>

      <DialogContent sx={{ px: { xs: 1.5, sm: 3 }, py: { xs: 1.75, sm: 2.5 }, bgcolor: SURFACE, overflowX: "hidden", ...docFormSx(ACCENT) }}>
        {error && <Alert severity="error" onClose={() => setError("")} sx={{ mb: 1.75, borderRadius: 2 }}>{error}</Alert>}
        {locked && (
          <IssuedSummary doc={existing.doc} label="ใบแจ้งเข้างาน" onView={viewExisting} viewing={busy} onNavigate={closeAll}
            onEdit={canChangeIssued ? () => startChange("edit") : undefined}
            onReissue={canChangeIssued ? () => startChange("reissue") : undefined}
            changeBlockedReason={existing.doc && !canChangeIssued ? "แก้ไข/ออกใหม่แทนได้เฉพาะผู้ออกใบนี้ หรือผู้มีสิทธิ์แก้เอกสาร" : ""} />
        )}
        {mode && (
          <Box sx={{ mb: 1.75, p: 1.5, borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${LINE}`, borderLeft: `4px solid ${ACCENT}` }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.88rem", fontWeight: 800, color: INK_2 }}>
                  {mode === "edit" ? `กำลังแก้ไขใบเลขที่ ${existing.doc?.docNumber}` : `กำลังออกใบใหม่แทนเลขที่ ${existing.doc?.docNumber}`}
                </Typography>
                <Typography sx={{ fontSize: "0.76rem", color: MUTED, lineHeight: 1.5 }}>
                  {mode === "edit"
                    ? "ใช้เลขที่เดิม · กดดูตัวอย่าง แล้ว “บันทึกการแก้ไข” — ระบบเก็บฉบับก่อนแก้ไว้ในประวัติ"
                    : "ได้เลขที่ใหม่ตอนยืนยัน · ใบเดิมถูกยกเลิกในทะเบียนให้อัตโนมัติ (ยังเปิดดูย้อนหลังได้)"}
                </Typography>
              </Box>
              <Button size="small" onClick={() => { setMode(null); setError(""); }} sx={{ ...OUTLINE_BTN_SX, flexShrink: 0 }}>ยกเลิกการแก้</Button>
            </Stack>
            {scheduleChanged && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} sx={{ mt: 1.25, p: 1.1, borderRadius: 2, bgcolor: "#fffbeb", border: "1px solid #fde68a" }}>
                <Typography sx={{ flex: 1, fontSize: "0.78rem", color: "#92400e", lineHeight: 1.5 }}>
                  วันในตารางงานตอนนี้ <b>{form.jobDateText}</b> ไม่ตรงกับกำหนดการในใบ ({docDays.length} วัน)
                </Typography>
                <Button size="small" onClick={() => { regenerateDays(); }} startIcon={<Refresh sx={{ fontSize: 16 }} />}
                  sx={{ ...OUTLINE_BTN_SX, flexShrink: 0, color: "#92400e", borderColor: "#fcd34d" }}>
                  ใช้วันตามตารางงานล่าสุด
                </Button>
              </Stack>
            )}
          </Box>
        )}
        {!locked && draft.restoredLabel && <DraftBanner when={draft.restoredLabel} onDiscard={discardDraft} />}

        {/* ✅ ออกแล้ว = แสดงสรุปใบเดิมอย่างเดียว ไม่โชว์ฟอร์ม (แก้/ออกซ้ำไม่ได้อยู่แล้ว) */}
        {!locked && (<Box>
          {/* 🔁 (17 ต.ค. 2569 ผู้ใช้: "ควรลำดับจากหัวกระดาษมาล่าง ให้เข้าใจง่าย และใช้คำง่ายๆ ไม่กำกวม")
              เรียงตามเอกสารจริง บนลงล่าง: ① ถึงใคร → ② หัวเรื่อง → ③ เนื้อหาหลัก (เปิดไว้) → ④ ข้อความในจดหมาย → ⑤ ผู้ลงชื่อ */}
          <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.5, mb: 1.25, px: 0.5 }}>
            ระบบกรอกให้ครบแล้ว เรียงตามเอกสารจากบนลงล่าง — ตรวจ แล้วกด “แก้ไข” เฉพาะส่วนที่ต้องเปลี่ยน
          </Typography>
          <FoldSection step={1} title="ถึงลูกค้า"
            summary={[form.site, form.customerCompany, form.attention && `เรียน ${form.attention}`].filter(Boolean).join(" · ") || "ยังไม่ระบุโครงการ"}
            alert={!form.site?.trim()}>
            <Stack spacing={2.25}>
              <Autocomplete
                size="small" fullWidth
                options={customerList}
                value={null} blurOnSelect clearOnBlur
                getOptionLabel={(o) => [o?.cSite, o?.cCompany].filter(Boolean).join(" · ") || "(ไม่ระบุชื่อ)"}
                filterOptions={(opts, { inputValue }) => {
                  const q = inputValue.trim().toLowerCase();
                  if (!q) return opts.slice(0, 30);
                  return opts.filter((o) => [o.cSite, o.cCompany, o.tax, o.address].some((v) => String(v || "").toLowerCase().includes(q))).slice(0, 30);
                }}
                onChange={(_, picked) => {
                  if (!picked) return;
                  setForm((f) => ({ ...f, site: picked.cSite || f.site, customerCompany: picked.cCompany || "", customerAddress: picked.address || "", customerTaxId: picked.tax || "" }));
                }}
                renderOption={(props, o) => (
                  <Box component="li" {...props} key={o._id} sx={{ display: "block !important", py: 1 }}>
                    <Typography sx={{ fontSize: "0.85rem", fontWeight: 700 }}>{o.cSite}</Typography>
                    <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>
                      {o.cCompany || "— ไม่ระบุบริษัท —"}{o.tax ? ` · เลขภาษี ${o.tax}` : ""}
                    </Typography>
                  </Box>
                )}
                renderInput={(params) => (
                  <TextField {...params} placeholder="ค้นหาลูกค้า: ชื่อโครงการ / บริษัท / เลขผู้เสียภาษี" sx={fieldSx}
                    InputProps={{ ...params.InputProps, startAdornment: <Search sx={{ fontSize: 18, color: FAINT, ml: 0.5, mr: 0.5 }} /> }} />
                )}
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField size="small" fullWidth label="ชื่อโครงการ" value={form.site} onChange={setField("site")} required sx={fieldSx} />
                <TextField size="small" fullWidth label="บริษัทลูกค้า" value={form.customerCompany} onChange={setField("customerCompany")} sx={fieldSx} />
              </Stack>
              <TextField size="small" fullWidth multiline minRows={2} label="ที่อยู่ลูกค้า (ไม่บังคับ)"
                value={form.customerAddress} onChange={setField("customerAddress")} sx={fieldSx} />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Autocomplete
                  freeSolo fullWidth size="small" options={attentionOptions}
                  inputValue={form.attention} onInputChange={(_, v) => set("attention")(v)}
                  renderInput={(params) => <TextField {...params} label="เรียน" sx={fieldSx} />}
                />
                {/* ✅ อ้างถึง — ตัวเลือกจากเลขเอกสารที่ผูกกับงานนี้ (ใบเสนอราคา/สัญญา) */}
                <Autocomplete
                  freeSolo fullWidth size="small" options={referenceOptions}
                  inputValue={form.reference} onInputChange={(_, v) => set("reference")(v)}
                  renderInput={(params) => <TextField {...params} label="อ้างถึง" placeholder="เช่น สัญญาเลขที่ FAPTY01-2569" sx={fieldSx} />}
                />
              </Stack>
            </Stack>
          </FoldSection>

          <FoldSection step={2} title="หัวเรื่อง"
            summary={[form.subject || "ยังไม่ระบุเรื่อง", `วันที่ ${thaiFullDate(form.issuedAt)}`].filter(Boolean).join(" · ")}
            alert={!form.subject?.trim()}>
            <Stack spacing={2.25}>
              <Stack direction="row" spacing={1.5} sx={{ minWidth: 0 }}>
                <TextField size="small" fullWidth label="งานที่ดำเนินการ" placeholder="เช่น PM ระบบ Fire Alarm"
                  value={form.workLabel} onChange={setField("workLabel")} sx={fieldSx} />
                <TextField size="small" label="ครั้งที่" placeholder="1/2" value={form.roundLabel || ""}
                  onChange={setField("roundLabel")} sx={{ ...fieldSx, width: { xs: 96, sm: 140 }, flexShrink: 0 }} />
              </Stack>
              <Stack spacing={2.25}>
                <Autocomplete
                  freeSolo fullWidth size="small" options={subjectOptions}
                  inputValue={form.subject} onInputChange={(_, v) => set("subject")(v)}
                  renderInput={(params) => <TextField {...params} label="เรื่อง" required sx={fieldSx} />}
                />
                {/* ✅ grid: มือถือเรียงเต็มกว้าง · จอใหญ่ 2 คอลัมน์ — เดิม flex บีบช่องวันที่จนล้นขอบจอมือถือ */}
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "minmax(0,1fr) minmax(0,1fr)" }, gap: 2 }}>
                  <TextField
                    size="small" fullWidth label="เลขที่เอกสาร" value={form.docNumber}
                    onChange={setField("docNumber")} disabled={canUseRunningNumber || mode === "edit"} sx={fieldSx}
                    helperText={mode === "edit" ? "แก้ไขใบเดิม = ใช้เลขที่เดิม" : mode === "reissue" && canUseRunningNumber ? "เลขที่ใหม่ ออกให้ตอนยืนยัน" : canUseRunningNumber ? "ออกให้อัตโนมัติ" : "เลขที่อ้างอิงของงาน"}
                  />
                  <ThaiDatePicker label="วันที่ออก" value={form.issuedAt} onChange={set("issuedAt")}
                    helperText={thaiFullDate(form.issuedAt)} textFieldProps={{ sx: fieldSx }} />
                </Box>
              </Stack>
            </Stack>
          </FoldSection>

          {/* 🔁 (17 ต.ค. 2569 ผู้ใช้: "ปรับปรุงหน้าออกเอกสาร ให้สอดคล้องกับระบบปัจจุบัน สวยงาม ดูง่าย เน้นกรอกน้อยที่สุด
                หรือกรอกส่วนที่จำเป็นที่ปรับเปลี่ยนตลอด")
              ① ส่วนที่เปลี่ยนทุกใบ (กำหนดการเข้างาน) เปิดไว้บนสุด
              ② ส่วนที่ระบบเติมให้ครบแล้ว (แจ้งถึง · เรื่องและเนื้อความ · ผู้ออกเอกสาร) พับไว้ หัวพับโชว์ค่าที่จะพิมพ์จริง กดแก้เฉพาะที่ต้องเปลี่ยน */}
          <DocSection step={3} highlight={ACCENT}
            title={byMonth ? `แผนเข้างานรายเดือน · ${printedMonths.length} ครั้ง` : `กำหนดการเข้างาน · ${printedDays.length} วัน`}
            hint={byMonth
              ? "ระบุแค่ช่วงเดือน — ในเอกสารจะแจ้งว่าวันและเวลาที่แน่นอนจะแจ้งให้ทราบล่วงหน้าอีกครั้ง"
              : `วันในตารางงาน: ${form.jobDateText} — แก้วัน เวลา และงานที่เข้าทำ ให้ตรงกับที่นัดลูกค้าไว้`}
            action={(
              <Stack direction="row" spacing={0.75}>
                <Button size="small" onClick={(e) => setToolsAnchor(e.currentTarget)} startIcon={<AutoFixHigh sx={{ fontSize: 16 }} />} sx={OUTLINE_BTN_SX}>
                  ตัวช่วย
                </Button>
                <Button size="small" onClick={byMonth ? addMonth : addDay} startIcon={<Add sx={{ fontSize: 16 }} />} sx={OUTLINE_BTN_SX}>
                  {byMonth ? "เพิ่มเดือน" : "เพิ่มวัน"}
                </Button>
              </Stack>
            )}>
            {/* ✅ (26 พ.ย. 2569) เลือกแบบกำหนดการ — ระบุวันที่ (เดิม) / ระบุแค่เดือน (แจ้งแผนล่วงหน้า) */}
            <Box role="radiogroup" aria-label="แบบกำหนดการ"
              sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75, p: 0.5, mb: 1.5, borderRadius: 2.5, bgcolor: "#eef2f7" }}>
              {SCHEDULE_MODES.map((o) => {
                const on = (form.scheduleMode || "days") === o.value;
                return (
                  <Box key={o.value} component="button" type="button" role="radio" aria-checked={on} onClick={() => switchScheduleMode(o.value)}
                    sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.25, py: 0.9, border: 0, borderRadius: 2, cursor: "pointer", font: "inherit", textAlign: "left",
                      bgcolor: on ? "#fff" : "transparent", boxShadow: on ? "0 1px 3px rgba(15,23,42,.12)" : "none", color: on ? ACCENT : MUTED, transition: "background-color .15s" }}>
                    {o.value === "days" ? <Today sx={{ fontSize: 20 }} /> : <CalendarMonth sx={{ fontSize: 20 }} />}
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: "0.86rem", fontWeight: 800, color: on ? INK_2 : MUTED, lineHeight: 1.3 }}>{o.label}</Typography>
                      <Typography sx={{ fontSize: "0.7rem", color: MUTED, lineHeight: 1.3 }} noWrap>{o.hint}</Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
            <Menu anchorEl={toolsAnchor} open={Boolean(toolsAnchor)} onClose={() => setToolsAnchor(null)}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
              {(byMonth ? [
                [regenerateMonths, <CalendarMonth key="i" fontSize="small" />, "เติมทุกครั้งตามแผนงานทั้งปีของสัญญา"],
                [applyFirstMonthDetail, <ContentPaste key="i" fontSize="small" />, "ใช้รายละเอียดของแถวแรกกับทุกแถว"],
              ] : [
                [regenerateDays, <Refresh key="i" fontSize="small" />, "สร้างรายการใหม่ตามตารางในระบบ"],
                [() => applyFirstToAll("time"), <ContentPaste key="i" fontSize="small" />, "ใช้เวลาของวันแรกกับทุกวัน"],
                [() => applyFirstToAll("detail"), <ContentPaste key="i" fontSize="small" />, "ใช้รายละเอียดของวันแรกกับทุกวัน"],
              ]).map(([fn, icon, label]) => (
                <MenuItem key={label} onClick={() => { fn(); setToolsAnchor(null); }} sx={{ fontSize: "0.86rem" }}>
                  <ListItemIcon sx={{ color: INK_2 }}>{icon}</ListItemIcon>{label}
                </MenuItem>
              ))}
            </Menu>
            {/* 🔁 (26 พ.ย. 2569 ผู้ใช้: "ข้อมูลยังดูงงๆ ลายตา และติดชิดกันเกินไป") แผนรายเดือนแบบตาราง:
                หัวคอลัมน์ครั้งเดียว (ไม่มีป้ายซ้ำทุกแถว) · งานที่เข้าทำกรอกครั้งเดียวใช้กับทุกครั้ง (แยกเฉพาะครั้งได้) · ระยะห่างโปร่งขึ้น */}
            {byMonth && (() => {
              const rows = form.monthRows || [];
              const shared = rows[0]?.detail || "";
              const setShared = (v) => setForm((f) => {
                const old = f.monthRows?.[0]?.detail || "";
                return { ...f, monthRows: (f.monthRows || []).map((r, idx) => (idx === 0 || (!r.customDetail && (r.detail || "") === old) ? { ...r, detail: v } : r)) };
              });
              // ครั้งที่แบบหลายปี ("1/4 - 2569-70") ยาว → คอลัมน์กว้างขึ้นให้อ่านครบ
              const roundW = rows.some((r) => String(r.round || "").length > 5) ? 132 : 84;
              const cols = { xs: `${roundW === 84 ? 64 : 110}px minmax(0,1fr) 34px`, sm: `${roundW}px minmax(0,1fr) minmax(0,1fr) 34px` };
              return (
                <>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "170px minmax(0,1fr)" }, gap: 2, mt: 0.75, mb: 2.25 }}>
                    <TextField size="small" fullWidth label="ประจำปี (ไม่บังคับ)" placeholder="เช่น 2569-70" value={form.planYearLabel || ""} onChange={setField("planYearLabel")}
                      helperText="ต่อท้ายเรื่องและเนื้อความ" sx={fieldSx} />
                    <TextField size="small" fullWidth multiline label="งานที่เข้าทำ (ใช้กับทุกครั้ง)" value={shared} onChange={(e) => setShared(e.target.value)}
                      placeholder="เช่น เข้าทำการตรวจเช็คและบำรุงรักษา ระบบ Fire Alarm" helperText="พิมพ์ครั้งเดียว ใช้กับทุกแถวในตาราง" sx={fieldSx} />
                  </Box>
                  <Box sx={{ border: `1px solid ${LINE}`, borderRadius: 2.5, overflow: "hidden", bgcolor: "#fff" }}>
                    <Box sx={{ display: { xs: "none", sm: "grid" }, gridTemplateColumns: cols, columnGap: 1.5, px: 1.75, py: 0.9, bgcolor: SURFACE, borderBottom: `1px solid ${LINE}` }}>
                      {["ครั้งที่", "เดือนที่จะเข้า", "ถึงเดือน (ถ้าเข้าหลายเดือน)", ""].map((h, k) => (
                        <Typography key={k} sx={{ fontSize: "0.74rem", fontWeight: 800, color: MUTED }}>{h}</Typography>
                      ))}
                    </Box>
                    {rows.map((r, i) => {
                      const custom = i > 0 && (r.customDetail || (r.detail || "") !== shared);
                      return (
                        <Box key={i} sx={{ px: { xs: 1.25, sm: 1.75 }, py: 1.4, borderTop: i ? `1px solid ${LINE}` : "none" }}>
                          <Box sx={{ display: "grid", gridTemplateColumns: cols, columnGap: 1.5, rowGap: 1.25, alignItems: "center" }}>
                            <TextField size="small" placeholder="1/4" value={r.round || ""} onChange={(e) => updateMonth(i, "round", e.target.value)}
                              inputProps={{ "aria-label": `ครั้งที่ แถว ${i + 1}`, style: { textAlign: "center", fontWeight: 800 } }} sx={fieldSx} />
                            <ThaiMonthSelect value={r.month} onChange={(v) => updateMonth(i, "month", v)} around={r.month || form.jobStartDate?.slice(0, 7)}
                              sx={{ ...fieldSx, "& .MuiSelect-select": { fontWeight: 700 } }} />
                            <Box sx={{ gridColumn: { xs: "2 / 3", sm: "auto" }, gridRow: { xs: 2, sm: "auto" }, minWidth: 0 }}>
                              <ThaiMonthSelect value={r.monthTo} emptyLabel={isMobile ? "ถึงเดือน (ถ้ามี)" : "— เดือนเดียว —"} around={r.month}
                                min={isMonthKey(r.month) ? addMonthsKey(r.month, 1) : undefined} max={isMonthKey(r.month) ? addMonthsKey(r.month, 24) : undefined} disabled={!isMonthKey(r.month)}
                                onChange={(v) => updateMonth(i, "monthTo", v && isMonthKey(r.month) && monthDiff(r.month, v) <= 0 ? "" : v)} sx={fieldSx} />
                            </Box>
                            <IconButton size="small" onClick={() => removeMonth(i)} aria-label={`ลบแถวที่ ${i + 1}`} sx={{ color: FAINT, justifySelf: "center", gridColumn: { xs: 3, sm: "auto" }, gridRow: { xs: 1, sm: "auto" } }}>
                              <DeleteOutline sx={{ fontSize: 19 }} />
                            </IconButton>
                          </Box>
                          {custom ? (
                            <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mt: 1.5 }}>
                              <TextField size="small" fullWidth multiline label="งานเฉพาะครั้งนี้" value={r.detail || ""} onChange={(e) => updateMonth(i, "detail", e.target.value)} sx={fieldSx} />
                              <Button size="small" onClick={() => setForm((f) => ({ ...f, monthRows: f.monthRows.map((x, idx) => (idx === i ? { ...x, detail: shared, customDetail: false } : x)) }))}
                                sx={{ ...OUTLINE_BTN_SX, flexShrink: 0, mt: 0.25 }}>ใช้แบบทุกครั้ง</Button>
                            </Stack>
                          ) : i > 0 && (
                            <Button size="small" onClick={() => updateMonth(i, "customDetail", true)}
                              sx={{ mt: 0.5, ml: { sm: `calc(${roundW}px + 12px)` }, p: 0, px: 0.5, minWidth: 0, textTransform: "none", fontSize: "0.72rem", fontWeight: 700, color: MUTED, "&:hover": { color: ACCENT, bgcolor: "transparent" } }}>
                              + แยกงานเฉพาะครั้งนี้
                            </Button>
                          )}
                        </Box>
                      );
                    })}
                    {rows.length === 0 && (
                      <Box sx={{ py: 3, textAlign: "center" }}>
                        <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>ยังไม่มีแผน — กด "เพิ่มเดือน" หรือ "ตัวช่วย"</Typography>
                      </Box>
                    )}
                  </Box>
                </>
              );
            })()}
            {/* ✅ รายการเดียวคั่นเส้น (ไม่ซ้อนกล่องในกล่อง) · วันที่/เวลาแถวเดียวกัน · ปุ่มลบอยู่ขวาของหัววัน */}
            {!byMonth && <Box sx={{ border: `1px solid ${LINE}`, borderRadius: 2, overflow: "hidden", bgcolor: "#fff" }}>
              {(form.dayRows || []).map((r, i) => (
                <Box key={i} sx={{ px: { xs: 1.25, sm: 1.75 }, pt: 1.25, pb: 1.75, borderTop: i ? `1px solid ${LINE}` : "none" }}>
                  <Stack direction="row" alignItems="center" sx={{ mb: 1.5 }}>
                    <Typography sx={{ flex: 1, fontSize: "0.8rem", fontWeight: 800, color: INK_2 }}>วันที่ {i + 1}</Typography>
                    <IconButton size="small" onClick={() => removeDay(i)} aria-label={`ลบวันที่ ${i + 1}`} sx={{ color: FAINT, p: 0.5 }}>
                      <DeleteOutline sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Stack>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr) minmax(0,1fr)", sm: "200px minmax(0,1fr)" }, gap: 1.5 }}>
                    <ThaiDatePicker label="วันที่" value={r.date} onChange={(v) => updateDay(i, "date", v)} textFieldProps={{ sx: fieldSx }} />
                    {/* ⚠️ disableClearable — ไม่จองที่ปุ่มล้างด้านขวา เวลา "09.30 - 17.30 น." จะไม่ถูกตัดเป็น "17...." */}
                    <Autocomplete
                      freeSolo disableClearable size="small" options={TIME_PRESETS}
                      inputValue={r.time || ""} onInputChange={(_, v) => { if (v !== (r.time || "")) updateDay(i, "time", v); }}
                      renderInput={(params) => <TextField {...params} label="เวลา" sx={fieldSx} />}
                    />
                  </Box>
                  <TextField
                    size="small" fullWidth multiline sx={{ mt: 2, ...fieldSx }}
                    label="เข้าทำอะไร / บริเวณไหน"
                    value={r.detail || ""} onChange={(e) => updateDay(i, "detail", e.target.value)}
                    placeholder="เช่น เข้าทำการตรวจเช็คตู้ควบคุม และทดสอบบริเวณห้องพัก"
                  />
                </Box>
              ))}
              {(form.dayRows || []).length === 0 && (
                <Box sx={{ py: 2.5, textAlign: "center" }}>
                  <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>ยังไม่มีกำหนดการ — กด "เพิ่มวัน" หรือ "ตัวช่วย"</Typography>
                </Box>
              )}
            </Box>}

            {/* 🔁 (17 ต.ค. 2569 ผู้ใช้: "หมายเหตุให้ระบุว่าถ้าจำเป็นด้วย ดูว่าเอาไว้ไหนถึงจะเหมาะสม")
                พิมพ์ใต้ตารางกำหนดการในเอกสาร (สิ่งที่ขอจากลูกค้าเผื่อจำเป็น) · เลือกข้อความสำเร็จรูปได้ · ไม่ต้องการ = ลบให้ว่าง */}
            <SubHeader>หมายเหตุใต้ตารางกำหนดการ (ไม่บังคับ)</SubHeader>
            <TextField
              size="small" fullWidth multiline minRows={2} sx={fieldSx}
              value={form.supportNote} onChange={setField("supportNote")}
              placeholder="เช่น หากจำเป็น ขอความอนุเคราะห์อุปกรณ์/เจ้าหน้าที่จากลูกค้า — ไม่ต้องการให้เว้นว่าง"
              helperText="สิ่งที่ขอจากลูกค้าเผื่อจำเป็น · ไม่ต้องการให้ลบข้อความทิ้ง (หัวข้อหมายเหตุจะไม่ถูกพิมพ์)"
            />
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, mt: 1 }}>
              {[
                ["อุปกรณ์ที่สูง + ผู้ประสานงาน", SUPPORT_REQUEST_PRESETS[0]],
                ["ผู้ประสานงานนำเข้าพื้นที่", SUPPORT_REQUEST_PRESETS[1]],
                ["เปิดพื้นที่ + ไฟฟ้าทดสอบ", SUPPORT_REQUEST_PRESETS[2]],
              ].map(([label, text]) => (
                <Button key={label} size="small" onClick={() => set("supportNote")(text)}
                  sx={{ ...OUTLINE_BTN_SX, fontSize: "0.76rem", py: 0.25, borderRadius: 99,
                    ...(form.supportNote === text ? { borderColor: ACCENT, color: ACCENT, bgcolor: `${ACCENT}0f` } : {}) }}>
                  {label}
                </Button>
              ))}
              {form.supportNote && (
                <Button size="small" onClick={() => set("supportNote")("")} sx={{ ...OUTLINE_BTN_SX, fontSize: "0.76rem", py: 0.25, borderRadius: 99, color: MUTED }}>
                  ไม่ใส่หมายเหตุ
                </Button>
              )}
            </Stack>
          </DocSection>

          <FoldSection step={4} title="ข้อความในจดหมาย"
            summary={form.bodyManual ? "แก้ข้อความเองแล้ว (ไม่อัปเดตอัตโนมัติ)" : "ย่อหน้าเปิด (ก่อนกำหนดการ) และย่อหน้าปิด (ขอความร่วมมือ)"}>
            <AutoTextBar manual={Boolean(form.bodyManual)} onReset={resetBody} />
              <Stack spacing={2.25}>
                <TextField size="small" fullWidth multiline minRows={3} label="ย่อหน้าเปิด (อยู่ก่อนกำหนดการ)"
                  value={form.body} onChange={editBody} sx={fieldSx} />
                <TextField size="small" fullWidth multiline minRows={3} label="ย่อหน้าปิด (อยู่หลังกำหนดการ)"
                  value={form.cooperationNote} onChange={setField("cooperationNote")} sx={fieldSx}
                  helperText='ปิดท้ายด้วย "จึงเรียนมาเพื่อโปรดทราบ..." ให้อัตโนมัติ' />
              </Stack>
          </FoldSection>

          <FoldSection step={5} title="ผู้ลงชื่อท้ายจดหมาย"
            summary={[form.signerName || "ยังไม่ระบุชื่อ", form.signerPosition, form.signerTel && `โทร ${form.signerTel}`, signatureImage ? "ลายเซ็นอิเล็กทรอนิกส์" : "เว้นช่องเซ็นมือ"].filter(Boolean).join(" · ")}
            alert={!form.signerName?.trim()}>
            <Stack spacing={2.25}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Autocomplete
                  freeSolo fullWidth size="small"
                  options={staffOptions}
                  value={null}
                  inputValue={form.signerName || ""}
                  onInputChange={(_, v, reason) => { if (reason === "input" || reason === "clear") set("signerName")(v); }}
                  onChange={(_, v) => pickSigner(v)}
                  getOptionLabel={(o) => (typeof o === "string" ? o : o?.name || "")}
                  isOptionEqualToValue={(o, v) => o.userId === v?.userId}
                  filterOptions={filterStaff}
                  renderOption={({ key, ...liProps }, o) => (
                    <li {...liProps} key={o.userId}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: "0.86rem", fontWeight: 700 }} noWrap>{o.name}</Typography>
                        <Typography variant="caption" sx={{ color: FAINT }}>{[o.position, o.tel].filter(Boolean).join(" · ") || o.role}</Typography>
                      </Box>
                    </li>
                  )}
                  renderInput={(params) => <TextField {...params} label="ชื่อ-นามสกุล" required placeholder="เลือกจากพนักงาน หรือพิมพ์เอง" sx={fieldSx} />}
                />
                <Autocomplete
                  freeSolo fullWidth size="small" options={SIGNER_POSITION_PRESETS}
                  inputValue={form.signerPosition} onInputChange={(_, v) => set("signerPosition")(v)}
                  renderInput={(params) => <TextField {...params} label="ตำแหน่ง" sx={fieldSx} />}
                />
              </Stack>
              {/* ✅ เบอร์ติดต่อกลับ — ลูกค้าใช้โทรกลับเมื่อต้องเลื่อนนัด */}
              <TextField size="small" fullWidth label="เบอร์ติดต่อกลับ" value={form.signerTel} onChange={setField("signerTel")}
                placeholder="เช่น 097-085-7411" sx={fieldSx} />
              {/* ⚠️ ลายเซ็นของฉันใช้ได้เฉพาะเมื่อชื่อผู้ลงนามเป็นชื่อตัวเอง — แปะลงชื่อคนอื่น = ปลอมลายมือชื่อ */}
              {mySignature ? (
                <FormControlLabel
                  control={<Switch size="small" checked={useMySignature && signerIsMe} disabled={!signerIsMe} onChange={(e) => setUseMySignature(e.target.checked)} />}
                  label={(
                    <Typography sx={{ fontSize: "0.84rem", color: INK_2 }}>
                      ลงลายเซ็นอิเล็กทรอนิกส์ของฉัน
                      {!signerIsMe && <Box component="span" sx={{ color: FAINT }}> — ใช้ได้เมื่อผู้ลงนามเป็นคุณ</Box>}
                    </Typography>
                  )}
                />
              ) : (
                <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>
                  ยังไม่ได้ตั้งลายเซ็นอิเล็กทรอนิกส์ — เอกสารจะเว้นช่องให้เซ็นมือ (ตั้งได้ที่ ตั้งค่า › ลายเซ็น)
                </Typography>
              )}
              <SignerPreview name={form.signerName} position={form.signerPosition} tel={form.signerTel}
                company={ISSUER.nameTh} signatureImage={signatureImage} />
            </Stack>
          </FoldSection>
        </Box>)}
      </DialogContent>

      <DialogActions sx={{ px: { xs: 1.5, sm: 3 }, py: 1.5, borderTop: `1px solid ${LINE}`, gap: 1, flexWrap: "wrap" }}>
        {!locked && missing.length > 0 && (
          <Typography sx={{ flexBasis: { xs: "100%", sm: "auto" }, mr: { sm: "auto" }, fontSize: "0.78rem", fontWeight: 700, color: DANGER }}>
            ยังไม่ได้กรอก: {missing.join(" · ")}
          </Typography>
        )}
        <Box sx={{ flex: { xs: 1, sm: "none" }, ml: { sm: missing.length > 0 && !locked ? 0 : "auto" } }} />
        <Button onClick={closeAll} disabled={busy} sx={{ textTransform: "none", fontWeight: 700, color: MUTED }}>
          {locked ? "ปิด" : "ยกเลิก"}
        </Button>
        {/* ✅ ปุ่มหลักปุ่มเดียว — ไปดูตัวอย่างก่อนเสมอ (ออกเอกสารจริงอยู่ในกล่องตัวอย่าง) · ออกแล้ว = ดูใบเดิม */}
        {!locked && <Button
          variant="contained" onClick={handlePreview} disabled={busy || existing.loading}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <Visibility sx={{ fontSize: 18 }} />}
          sx={{ ...PRIMARY_BTN_SX, px: 2.25 }}
        >
          {busy ? "กำลังสร้างไฟล์..." : "ดูตัวอย่างเอกสาร"}
        </Button>}
      </DialogActions>

      {/* ✅ กล่องตัวอย่าง — ซ้อนบนฟอร์ม กด "กลับไปแก้ไข" แล้วข้อมูลที่กรอกไว้ยังอยู่ครบทุกช่อง */}
      <DocumentPreviewDialog
        open={previewOpen}
        title="ใบแจ้งเข้างาน"
        accent={ACCENT}
        preview={preview}
        issued={issued}
        docNumber={viewingExisting ? existing.doc?.docNumber : mode === "edit" ? existing.doc?.docNumber : issued ? form.docNumber : (previewNumber || form.docNumber)}
        confirmLabel={mode === "edit" ? "บันทึกการแก้ไข" : mode === "reissue" ? "ออกใบใหม่แทนใบเดิม" : undefined}
        headerSub={!issued && mode === "edit" ? `ใช้เลขที่เดิม ${existing.doc?.docNumber} · ยังไม่บันทึกจนกว่าจะยืนยัน` : undefined}
        busy={busy} error={previewOpen ? error : ""}
        onBack={() => setPreviewOpen(false)}
        onConfirm={handleConfirm}
        onClose={viewingExisting ? () => { setPreviewOpen(false); setViewingExisting(false); setIssued(false); } : issued ? closeAll : () => setPreviewOpen(false)}
        email={{
          docType: "ใบแจ้งเข้างาน",
          refId: eventId,
          defaultTo: MailService.customerEmailFor(customerList, { company: form.customerCompany, site: form.site }, customer),
          recipientName: form.attention,
          project: form.site,
          audience: "customer",
        }}
      />
    </Dialog>
  );
};

export default WorkNoticeDialog;
