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
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Stack, Typography,
  TextField, Button, IconButton, Alert, useMediaQuery, CircularProgress, Autocomplete,
  Switch, FormControlLabel, Menu, MenuItem, ListItemIcon,
} from "@mui/material";
import {
  Visibility, EventAvailable, Refresh, Search, Add, DeleteOutline, ContentPaste, AutoFixHigh,
} from "@mui/icons-material";
import { jsPDF } from "jspdf";
import thSarabunFont from "@/assets/fonts/THSarabunNew_base64";
import DocNumberService from "@/shared/services/DocNumberService";
import CustomerService from "@/shared/services/CustomerService";
import {
  buildWorkNoticeDefaults, buildWorkNoticeBody, buildWorkNoticeCooperation,
  generateWorkNoticePdf, noticeSubjectPresetsFor, buildDayRows, dayRowText,
  TIME_PRESETS, SUPPORT_REQUEST_PRESETS, workVerbFor,
  ATTENTION_PRESETS, SIGNER_POSITION_PRESETS, thaiFullDate, ISSUER,
} from "../utils/workNoticePdf";
import moment from "moment";
import { resolveJobFields, referencePresetsFor } from "../utils/deliveryNotePdf";
import DocumentPreviewDialog from "./DocumentPreviewDialog";
import MailService from "@/shared/services/MailService";
import IssuedDocumentService from "@/shared/services/IssuedDocumentService";
import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import SignatureService from "@/shared/services/SignatureService";
import StaffDirectoryService from "@/shared/services/StaffDirectoryService";
import { useAuth } from "@/features/auth/AuthContext";
import {
  DocDialogHeader, DocSection, SubHeader, DraftBanner, IssuedSummary, SignerPreview, useDocDraft, useIssuedDoc,
  SMALL_BTN_SX, OUTLINE_BTN_SX,
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

const WorkNoticeDialog = ({ open, onClose, job, customer, issuer, canUseRunningNumber = false }) => {
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

  // ✅ ตั้งค่าเริ่มต้นใหม่ทุกครั้งที่เปิดกล่อง — ไม่ค้างค่าของงานก่อนหน้าไว้ (กล่องนี้ถูกใช้ซ้ำกับทุกงาน
  // ในหน้าเดียวกัน ถ้าไม่รีเซ็ตจะเปิดงาน B แล้วเห็นข้อมูลงาน A ค้างอยู่)
  useEffect(() => {
    if (!open || !job) return;
    const base = buildWorkNoticeDefaults(job, customer, issuer);
    setFormState({
      ...base,
      body: buildWorkNoticeBody(base),
      cooperationNote: buildWorkNoticeCooperation(),
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
  }, [open, job, customer, issuer, canUseRunningNumber]);

  // ✅ ร่างอัตโนมัติ + กันออกซ้ำ (ผู้ใช้สั่ง 3 ต.ค. 2569) — ⚠️ ต้องอยู่หลัง effect ตั้งค่าเริ่มต้นด้านบน
  const eventId = String(job?.id || job?._id || "");
  const draft = useDocDraft({
    open, draftKey: eventId ? `notice:${eventId}` : "", form, setFormState, dirtyRef,
    // เลขที่เดินหน้าออกให้ใหม่ทุกครั้ง — ไม่กู้คืนเลขเก่าจากร่าง
    omit: canUseRunningNumber ? ["docNumber"] : [],
  });
  const existing = useIssuedDoc({ open, eventId, docType: "notice" });

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
  const regenerateBody = () => setForm((f) => ({ ...f, body: buildWorkNoticeBody(f) }));

  const subjectOptions = useMemo(
    () => noticeSubjectPresetsFor(form?.workLabel, form?.roundLabel),
    [form?.workLabel, form?.roundLabel],
  );
  const referenceOptions = useMemo(() => referencePresetsFor(job), [job]);

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

  const missing = useMemo(() => {
    if (!form) return [];
    const m = [];
    if (!form.subject?.trim()) m.push("เรื่อง");
    if (!form.site?.trim()) m.push("ชื่อโครงการ");
    // ⚠️ ต้องมีกำหนดการอย่างน้อย 1 บรรทัด ไม่งั้นใบแจ้งเข้างานจะไม่ได้แจ้งอะไรเลย
    if (!(form.dayRows || []).some((r) => dayRowText(r))) m.push("กำหนดการรายวัน");
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
    if (existing.doc) return;
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
      // ✅ ตรวจซ้ำอีกรอบก่อนออกจริง — อีกคน/อีกแท็บอาจออกใบของงานนี้ไปแล้วระหว่างที่กรอกอยู่
      const dup = await IssuedDocumentService.activeForEvent(eventId, "notice").catch(() => null);
      if (dup) {
        existing.setDoc(dup);
        setPreviewOpen(false);
        setError(`งานนี้ออกใบแจ้งเข้างานไปแล้ว (เลขที่ ${dup.docNumber}) — ออกซ้ำไม่ได้`);
        return;
      }
      let finalNumber = form.docNumber;
      if (canUseRunningNumber) {
        // ⚠️ ส่ง id ของงานไปด้วย — backend ใช้ตรวจว่าผู้ขอเลขเกี่ยวข้องกับงานนี้จริง (ดู /doc-number/next)
        const res = await DocNumberService.next("notice", job?.id || job?._id);
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
      IssuedDocumentService.create({
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
      }).then((doc) => existing.setDoc(doc)).catch(() => {});
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
  const locked = Boolean(existing.doc);

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
            : !canUseRunningNumber
              ? "ใช้เลขที่อ้างอิงของงาน"
              : loadingNumber ? "กำลังตรวจเลขที่..." : previewNumber ? `เลขที่ถัดไป ${previewNumber}` : "ออกเลขที่อัตโนมัติ"}
          savedLabel={locked ? "" : draft.savedLabel}
          onClose={closeAll} busy={busy}
        />
      </DialogTitle>

      <DialogContent sx={{ px: { xs: 1.5, sm: 3 }, py: { xs: 1.75, sm: 2.5 }, bgcolor: SURFACE, overflowX: "hidden" }}>
        {error && <Alert severity="error" onClose={() => setError("")} sx={{ mb: 1.75, borderRadius: 2 }}>{error}</Alert>}
        {locked && <IssuedSummary doc={existing.doc} label="ใบแจ้งเข้างาน" onView={viewExisting} viewing={busy} onNavigate={closeAll} />}
        {!locked && draft.restoredLabel && <DraftBanner when={draft.restoredLabel} onDiscard={discardDraft} />}

        {/* ✅ ออกแล้ว = แสดงสรุปใบเดิมอย่างเดียว ไม่โชว์ฟอร์ม (แก้/ออกซ้ำไม่ได้อยู่แล้ว) */}
        {!locked && (<Box>
          {/* ── 1 ผู้รับ ─────────────────────────────────────────────────── */}
          <DocSection step={1} title="แจ้งถึง" hint="เลือกจากทะเบียนลูกค้าเพื่อเติมบริษัท/ที่อยู่ให้ครบ">
            <Stack spacing={1.75}>
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
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.75}>
                <TextField size="small" fullWidth label="ชื่อโครงการ" value={form.site} onChange={setField("site")} required sx={fieldSx} />
                <TextField size="small" fullWidth label="บริษัทลูกค้า" value={form.customerCompany} onChange={setField("customerCompany")} sx={fieldSx} />
              </Stack>
              <TextField size="small" fullWidth multiline minRows={2} label="ที่อยู่ลูกค้า (ไม่บังคับ)"
                value={form.customerAddress} onChange={setField("customerAddress")} sx={fieldSx} />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.75}>
                <Autocomplete
                  freeSolo fullWidth size="small" options={ATTENTION_PRESETS}
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
          </DocSection>

          {/* ── 2 งาน + กำหนดการรายวัน ──────────────────────────────────────
              ✅ รูปแบบตรงกับเอกสารจริงของบริษัท: 1 บรรทัดต่อ 1 วัน (ระบบเติมทุกวันตามตารางเป็นจุดตั้งต้น) */}
          <DocSection step={2} title="งานและกำหนดการ" hint={`ตารางในระบบ: ${form.jobDateText}`}>
            <Stack direction="row" spacing={1.5} sx={{ minWidth: 0 }}>
              <TextField size="small" fullWidth label="งานที่ดำเนินการ" placeholder="เช่น PM ระบบ Fire Alarm"
                value={form.workLabel} onChange={setField("workLabel")} sx={fieldSx} />
              <TextField size="small" label="ครั้งที่" placeholder="1/2" value={form.roundLabel || ""}
                onChange={setField("roundLabel")} sx={{ ...fieldSx, width: { xs: 96, sm: 140 }, flexShrink: 0 }} />
            </Stack>

            <SubHeader action={(
              <Stack direction="row" spacing={0.75}>
                <Button size="small" onClick={(e) => setToolsAnchor(e.currentTarget)} startIcon={<AutoFixHigh sx={{ fontSize: 16 }} />} sx={OUTLINE_BTN_SX}>
                  ตัวช่วย
                </Button>
                <Button size="small" onClick={addDay} startIcon={<Add sx={{ fontSize: 16 }} />} sx={OUTLINE_BTN_SX}>เพิ่มวัน</Button>
              </Stack>
            )} count={`${printedDays.length} วัน`}>
              กำหนดการ
            </SubHeader>
            <Menu anchorEl={toolsAnchor} open={Boolean(toolsAnchor)} onClose={() => setToolsAnchor(null)}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
              {[
                [regenerateDays, <Refresh key="i" fontSize="small" />, "สร้างรายการใหม่ตามตารางในระบบ"],
                [() => applyFirstToAll("time"), <ContentPaste key="i" fontSize="small" />, "ใช้เวลาของวันแรกกับทุกวัน"],
                [() => applyFirstToAll("detail"), <ContentPaste key="i" fontSize="small" />, "ใช้รายละเอียดของวันแรกกับทุกวัน"],
              ].map(([fn, icon, label]) => (
                <MenuItem key={label} onClick={() => { fn(); setToolsAnchor(null); }} sx={{ fontSize: "0.86rem" }}>
                  <ListItemIcon sx={{ color: INK_2 }}>{icon}</ListItemIcon>{label}
                </MenuItem>
              ))}
            </Menu>

            {/* ✅ รายการเดียวคั่นเส้น (ไม่ซ้อนกล่องในกล่อง) · วันที่/เวลาแถวเดียวกัน · ปุ่มลบอยู่ขวาของหัววัน */}
            <Box sx={{ border: `1px solid ${LINE}`, borderRadius: 2, overflow: "hidden", bgcolor: "#fff" }}>
              {(form.dayRows || []).map((r, i) => (
                <Box key={i} sx={{ px: 1.5, pt: 1, pb: 1.5, borderTop: i ? `1px solid ${LINE}` : "none" }}>
                  <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
                    <Typography sx={{ flex: 1, fontSize: "0.8rem", fontWeight: 800, color: INK_2 }}>วันที่ {i + 1}</Typography>
                    <IconButton size="small" onClick={() => removeDay(i)} aria-label={`ลบวันที่ ${i + 1}`} sx={{ color: FAINT, p: 0.5 }}>
                      <DeleteOutline sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Stack>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "200px minmax(0,1fr)" }, gap: 1 }}>
                    <ThaiDatePicker label="วันที่" value={r.date} onChange={(v) => updateDay(i, "date", v)} textFieldProps={{ sx: fieldSx }} />
                    {/* ⚠️ disableClearable — ไม่จองที่ปุ่มล้างด้านขวา เวลา "09.30 - 17.30 น." จะไม่ถูกตัดเป็น "17...." */}
                    <Autocomplete
                      freeSolo disableClearable size="small" options={TIME_PRESETS}
                      inputValue={r.time || ""} onInputChange={(_, v) => { if (v !== (r.time || "")) updateDay(i, "time", v); }}
                      renderInput={(params) => <TextField {...params} label="เวลา" sx={fieldSx} />}
                    />
                  </Box>
                  <TextField
                    size="small" fullWidth multiline sx={{ mt: 1, ...fieldSx }}
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
            </Box>

            <SubHeader>หมายเหตุ (ไม่บังคับ)</SubHeader>
            <TextField
              size="small" fullWidth multiline minRows={2} sx={fieldSx}
              value={form.supportNote} onChange={setField("supportNote")}
              placeholder={SUPPORT_REQUEST_PRESETS[0]}
            />
          </DocSection>

          {/* ── 3 หัวเอกสาร ─────────────────────────────────────────────── */}
          <DocSection step={3} title="หัวเอกสาร">
            <Stack spacing={1.75}>
              <Autocomplete
                freeSolo fullWidth size="small" options={subjectOptions}
                inputValue={form.subject} onInputChange={(_, v) => set("subject")(v)}
                renderInput={(params) => <TextField {...params} label="เรื่อง" required sx={fieldSx} />}
              />
              {/* ✅ grid: มือถือเรียงเต็มกว้าง · จอใหญ่ 2 คอลัมน์ — เดิม flex บีบช่องวันที่จนล้นขอบจอมือถือ */}
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "minmax(0,1fr) minmax(0,1fr)" }, gap: 1.5 }}>
                <TextField
                  size="small" fullWidth label="เลขที่เอกสาร" value={form.docNumber}
                  onChange={setField("docNumber")} disabled={canUseRunningNumber} sx={fieldSx}
                  helperText={canUseRunningNumber ? "ออกให้อัตโนมัติ" : "เลขที่อ้างอิงของงาน"}
                />
                <ThaiDatePicker label="วันที่ออก" value={form.issuedAt} onChange={set("issuedAt")}
                  helperText={thaiFullDate(form.issuedAt)} textFieldProps={{ sx: fieldSx }} />
              </Box>
            </Stack>
          </DocSection>

          {/* ── 4 เนื้อความ ─────────────────────────────────────────────── */}
          <DocSection step={4} title="เนื้อความ"
            action={<Button size="small" onClick={regenerateBody} startIcon={<Refresh sx={{ fontSize: 16 }} />} sx={SMALL_BTN_SX}>สร้างใหม่</Button>}>
            <Stack spacing={1.75}>
              <TextField size="small" fullWidth multiline minRows={3} label="ย่อหน้า 1 · ที่มาและกำหนดการ"
                value={form.body} onChange={setField("body")} sx={fieldSx} />
              <TextField size="small" fullWidth multiline minRows={3} label="ย่อหน้า 2 · ขอความร่วมมือ"
                value={form.cooperationNote} onChange={setField("cooperationNote")} sx={fieldSx}
                helperText='ปิดท้ายด้วย "จึงเรียนมาเพื่อโปรดทราบ..." ให้อัตโนมัติ' />
            </Stack>
          </DocSection>

          {/* ── 5 ผู้ออกเอกสาร ──────────────────────────────────────────── */}
          <DocSection step={5} title="ผู้ออกเอกสาร (ผู้ประสานงาน)" hint={`ออกในนาม ${ISSUER.nameTh} · แนบตราประทับให้อัตโนมัติ`}>
            <Stack spacing={1.75}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.75}>
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
          </DocSection>
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
        docNumber={viewingExisting ? existing.doc?.docNumber : issued ? form.docNumber : (previewNumber || form.docNumber)}
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
