/**
 * DeliveryNoteDialog — กล่องออก "ใบส่งมอบงาน"
 *
 * ✅ หลักการออกแบบ (ตามที่ผู้ใช้ขอว่า "ออกได้ง่าย ตามลักษณะงาน"):
 * ทุกช่องถูกเติมมาให้ครบตั้งแต่เปิดกล่อง โดยอ่านจากตัวงานจริง (ชื่อโครงการ/บริษัท/ระบบ/ประเภทงาน/
 * เลขที่ใบเสนอราคา/วันที่เสร็จ/ผู้รับผิดชอบ) + ที่อยู่จากทะเบียนลูกค้า + เลขที่เอกสารถัดไปจาก server
 * ผู้ใช้กรณีปกติจึงกด "ออกเอกสาร" ได้เลยโดยไม่ต้องพิมพ์อะไรสักตัว ส่วนกรณีที่ต้องปรับถ้อยคำ ก็ยัง
 * แก้ได้ทุกช่องก่อนออกจริง
 *
 * ⚠️ เลขที่เอกสารถูก "กินจริง" ตอนกดออกเท่านั้น (DocNumberService.next) ไม่ใช่ตอนเปิดกล่อง —
 * เปิดดูแล้วปิดไปเฉยๆ ต้องไม่ทำให้เลขกระโดดหายไปหนึ่งใบ
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Stack, Typography,
  TextField, Button, IconButton, Alert, useMediaQuery, CircularProgress, Autocomplete,
  Switch, FormControlLabel,
} from "@mui/material";
import {
  Add, DeleteOutline, Visibility, Description, Refresh, Search,
} from "@mui/icons-material";
import { jsPDF } from "jspdf";
import thSarabunFont from "@/assets/fonts/THSarabunNew_base64";
import DocNumberService from "@/shared/services/DocNumberService";
import CustomerService from "@/shared/services/CustomerService";
import {
  buildDeliveryNoteDefaults, buildDeliveryNoteBody, generateDeliveryNotePdf, thaiFullDate, ISSUER,
  REPORT_NOUN_PRESETS, spaceThaiLatin, resolveJobFields,
  ATTENTION_PRESETS, SIGNER_POSITION_PRESETS, subjectPresetsFor, referencePresetsFor,
} from "../utils/deliveryNotePdf";
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

const ACCENT = "#dc2626";
const TEXT_SUB = MUTED;

/** จับคู่งานกับทะเบียนลูกค้า — โครงการก่อน (cSite เจาะจงกว่า) แล้วค่อยบริษัท */
const findCustomer = (list, job) => {
  const p = resolveJobFields(job);
  const norm = (v) => String(v || "").trim().toLowerCase();
  return list.find((c) => norm(c.cSite) === norm(p.site) && norm(c.cCompany) === norm(p.company))
    || list.find((c) => norm(c.cSite) === norm(p.site))
    || (p.company ? list.find((c) => norm(c.cCompany) === norm(p.company)) : null);
};

const DeliveryNoteDialog = ({ open, onClose, job, customer, onIssued }) => {
  const isMobile = useMediaQuery("(max-width:600px)");
  const [form, setFormState] = useState(null);
  // ✅ แยก "ผู้ใช้แก้เอง" (setForm → นับเป็นร่าง) ออกจาก "ระบบเติมให้" (setFormState) — ดู useDocDraft
  const dirtyRef = useRef(false);
  const setForm = (u) => { dirtyRef.current = true; setFormState(u); };
  const [viewingExisting, setViewingExisting] = useState(false);
  const [previewNumber, setPreviewNumber] = useState("");
  const [loadingNumber, setLoadingNumber] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // ✅ เก็บทะเบียนลูกค้าทั้งก้อนไว้ให้ช่อง "ค้นหาลูกค้า" ใช้ — โหลดครั้งเดียวตอนเปิดกล่อง
  const [customerList, setCustomerList] = useState([]);
  // ✅ ขั้นตอนดูตัวอย่างก่อนออกจริง — preview เก็บไฟล์ที่กำลังแสดง, issued บอกว่ากินเลขจริงไปแล้วหรือยัง
  const [preview, setPreview] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [issued, setIssued] = useState(false);

  // ✅ ตั้งค่าเริ่มต้นใหม่ทุกครั้งที่เปิดกล่อง — ไม่ค้างค่าของงานก่อนหน้าไว้ (กล่องนี้ถูกใช้ซ้ำกับทุกงาน
  // ในหน้าเดียวกัน ถ้าไม่รีเซ็ตจะเปิดงาน B แล้วเห็นข้อมูลงาน A ค้างอยู่)
  // ✅ ที่อยู่ลูกค้าถูกค้นหาให้เองจากทะเบียนลูกค้า (จับคู่ด้วยชื่อโครงการ + บริษัท) — ทำในนี้ ไม่ใช่ให้
  // หน้าที่เรียกส่ง prop เข้ามา เพราะกล่องนี้ถูกเรียกจากหลายหน้า (การดำเนินงาน/ปฏิทิน/ภาพรวมงาน)
  // ถ้าให้ทุกหน้าไปโหลดทะเบียนลูกค้าเองจะกลายเป็นโค้ดซ้ำ 3 ที่ และหน้าที่ลืมส่งมาก็จะได้เอกสารไม่มีที่อยู่
  // ⚠️ โหลดตอน "เปิดกล่อง" เท่านั้น ไม่ใช่ตอนหน้าโหลด — หน้าการดำเนินงานมีการ์ดงานเป็นร้อยใบ
  useEffect(() => {
    if (!open || !job) return;
    const base = buildDeliveryNoteDefaults(job, customer);
    setFormState({ ...base, body: buildDeliveryNoteBody(base) });
    setError("");

    // ⚠️ กัน setState หลังกล่องถูกปิด/เปลี่ยนงานไปแล้ว (คำขอที่ยิงไปยังค้างอยู่กลางทางได้เสมอ)
    let alive = true;
    setLoadingNumber(true);
    DocNumberService.peek("delivery")
      .then((d) => { if (alive) setPreviewNumber(d.docNumber); })
      .catch(() => { if (alive) setPreviewNumber(""); })
      .finally(() => { if (alive) setLoadingNumber(false); });

    CustomerService.getCustomers()
      .then((res) => {
        if (!alive) return;
        // 🐛 BUG ที่แก้ (ช่องค้นหาลูกค้าไม่ขึ้นอะไรเลย): API /customer คืนค่ามาในคีย์ชื่อ
        // "userCustomers" (ดู routes/customer.js) แต่เดิมตรงนี้ไล่หา customers/data ซึ่งไม่มีจริง
        // เลยได้ [] ทุกครั้ง — ทั้งช่องค้นหาและการเติมที่อยู่อัตโนมัติจึงไม่เคยทำงานเลยตั้งแต่แรก
        // ⚠️ คีย์ที่ถูกต้องคือ userCustomers เท่านั้น (เทียบกับ features/customers/components/CustomerPanel/index.js
        // ที่อ่าน res.userCustomers เหมือนกัน) ตัวอื่นใส่ไว้เป็น fallback เผื่อ API เปลี่ยนรูปแบบ
        const list = res?.userCustomers || res?.customers || res?.data
          || (Array.isArray(res) ? res : []);
        setCustomerList(Array.isArray(list) ? list : []);
        if (customer) return; // มีข้อมูลลูกค้าส่งมาให้แล้ว ไม่ต้องเดาซ้ำ
        // ✅ จับคู่ด้วยชื่อโครงการก่อน (cSite เป็น required + unique คู่กับ cCompany จึงเจาะจงกว่า)
        // ถ้าไม่เจอค่อยลองจับด้วยชื่อบริษัท — งานเก่าบางรายการกรอกชื่อไว้คนละแบบกับทะเบียนลูกค้า
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
      // ⚠️ หาที่อยู่ไม่เจอ/โหลดทะเบียนลูกค้าไม่ได้ ต้องไม่บล็อกการออกเอกสาร — ที่อยู่ไม่ใช่ช่องบังคับ
      // (ผู้ใช้พิมพ์เองได้ในกล่อง) แค่เสียความสะดวกไป ไม่ใช่ทำงานต่อไม่ได้
      .catch(() => {});

    return () => { alive = false; };
  }, [open, job, customer]);

  // ✅ ร่างอัตโนมัติ + กันออกซ้ำ (ผู้ใช้สั่ง 3 ต.ค. 2569) — ⚠️ ต้องอยู่หลัง effect ตั้งค่าเริ่มต้นด้านบน
  const eventId = String(job?.id || job?._id || "");
  const draft = useDocDraft({ open, draftKey: eventId ? `delivery:${eventId}` : "", form, setFormState, dirtyRef, omit: ["docNumber"] });
  const existing = useIssuedDoc({ open, eventId, docType: "delivery" });

  /** ทิ้งร่าง แล้วเริ่มใหม่จากข้อมูลงาน */
  const discardDraft = () => {
    draft.clear();
    const base = buildDeliveryNoteDefaults(job, customer);
    const found = customer ? null : findCustomer(customerList, job);
    const next = found ? {
      ...base,
      customerAddress: base.customerAddress || found.address || "",
      customerCompany: base.customerCompany || found.cCompany || "",
      customerTaxId: base.customerTaxId || found.tax || "",
    } : base;
    setFormState({ ...next, body: buildDeliveryNoteBody(next) });
  };

  // ⚠️ ไม่เปลี่ยนจริง = ไม่นับเป็นการแก้ (Autocomplete ยิง onInputChange ซ้ำตอนเปิดกล่อง → ร่างปลอม)
  const set = (k) => (v) => { if ((form?.[k] ?? "") === (v ?? "")) return; setForm((f) => ({ ...f, [k]: v })); };
  const setField = (k) => (e) => set(k)(e.target.value);

  // ✅ เนื้อความสร้างใหม่ตามค่าที่แก้ล่าสุดได้ตลอด — เผื่อผู้ใช้แก้ชื่อโครงการ/วันที่เสร็จหลังเปิดกล่อง
  // แล้วอยากให้ย่อหน้าอัปเดตตาม (ไม่ทำอัตโนมัติ เพราะถ้าเขาแก้ถ้อยคำเองไว้แล้วจะโดนเขียนทับทิ้ง)
  const regenerateBody = () => setForm((f) => ({ ...f, body: buildDeliveryNoteBody(f) }));

  const addAttachment = () =>
    setForm((f) => ({ ...f, attachments: [...(f.attachments || []), { text: "", qty: "1 ชุด" }] }));
  const updateAttachment = (i, k, v) =>
    setForm((f) => ({
      ...f,
      attachments: f.attachments.map((a, idx) => (idx === i ? { ...a, [k]: v } : a)),
    }));
  const removeAttachment = (i) =>
    setForm((f) => ({ ...f, attachments: f.attachments.filter((_, idx) => idx !== i) }));

  // ✅ ตัวเลือกคำเรียกเอกสารรายงาน — ต่อท้ายด้วยชื่อระบบของงานนี้ให้เลย (ถ้ามี) จะได้เลือกทีเดียวจบ
  const reportPresetOptions = useMemo(() => {
    const system = resolveJobFields(job).system || "";
    return REPORT_NOUN_PRESETS.map((n) =>
      spaceThaiLatin(system ? `${n} ระบบ ${system}` : n)
    );
  }, [job]);
  // ✅ ตัวเลือก "อ้างถึง" มาจากเลขเอกสารที่ผูกกับงานนี้จริงๆ (ดู referencePresetsFor)
  const referenceOptions = useMemo(() => referencePresetsFor(job), [job]);
  // ✅ ตัวเลือก "เรื่อง" ประกอบจากชื่องาน/ระบบของใบนี้ — อิง workLabel ที่อยู่ในฟอร์ม เพื่อให้ตัวเลือก
  // เปลี่ยนตามด้วยถ้าผู้ใช้แก้ข้อมูลงานในกล่องนี้
  const subjectOptions = useMemo(
    () => subjectPresetsFor(form?.workLabel, form?.roundLabel),
    [form?.workLabel, form?.roundLabel],
  );

  const missing = useMemo(() => {
    if (!form) return [];
    const m = [];
    if (!form.subject?.trim()) m.push("เรื่อง");
    if (!form.site?.trim()) m.push("ชื่อโครงการ");
    if (!form.signerName?.trim()) m.push("ชื่อผู้ลงนาม");
    return m;
  }, [form]);

  // ── ขั้นตอน "ดูตัวอย่าง → ยืนยันออก" (โครงเดียวกับใบแจ้งเข้างาน) ────────────
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
    setForm((f) => ({ ...f, signerName: v.name, signerPosition: v.position || f.signerPosition }));
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
    generateDeliveryNotePdf({ jsPDF, thSarabunFont, form: { ...form, docNumber, signatureImage }, mode: "blob" });

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
      const { url, blob, fileName } = await buildPdf(previewNumber || form.docNumber);
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
      // ⚠️ กินเลขจริงตรงนี้ที่เดียวเท่านั้น — และต้องได้เลขมาก่อนถึงจะสร้างไฟล์ ถ้าขอเลขไม่สำเร็จต้องไม่ออก
      // เอกสารที่ไม่มีเลขที่ออกไป (เอกสารไม่มีเลขอ้างอิงคือเอกสารที่ตามกลับไม่ได้)
      // ⚠️ ส่ง id ของงานไปด้วยเสมอ — ผู้ใช้ที่ไม่ใช่ admin/manager จะออกเลขได้เฉพาะงานที่ตัวเอง
      // เกี่ยวข้อง backend ใช้ค่านี้ตรวจสิทธิ์ (FullCalendar ใช้ .id ส่วน object ดิบจาก API ใช้ ._id)
      // ✅ server ปฏิเสธ (409) ถ้างานนี้มีใบส่งมอบที่ยังใช้อยู่แล้ว — ตรวจก่อนกินเลข (routes/docNumber.js)
      const { docNumber } = await DocNumberService.next("delivery", job?.id || job?._id);
      const { url, blob, fileName } = await buildPdf(docNumber);
      const finalForm = { ...form, docNumber };
      setForm(finalForm);
      replacePreview({ url, blob, fileName });
      setIssued(true);
      onIssued?.(finalForm);
      // ✅ บันทึกลงทะเบียนเอกสารทันทีที่ออกจริง (ดูหน้า "ทะเบียนเอกสาร")
      // ⚠️ ไม่ await — ถ้าบันทึกทะเบียนล้มเหลว (เน็ตหลุด/สิทธิ์ไม่พอ) ต้องไม่ทำให้ผู้ใช้เห็นว่า
      // "ออกเอกสารไม่สำเร็จ" ทั้งที่เลขถูกกินและไฟล์ออกเรียบร้อยไปแล้ว
      draft.clear();
      IssuedDocumentService.create({
        docType: "delivery",
        docNumber,
        issuedAt: finalForm.issuedAt,
        subject: finalForm.subject,
        site: finalForm.site,
        customerCompany: finalForm.customerCompany,
        workLabel: finalForm.workLabel,
        roundLabel: finalForm.roundLabel,
        signerName: finalForm.signerName,
        eventId: job?.id || job?._id || null,
        contractNo: resolveJobFields(job).contractNo || "",
        formSnapshot: finalForm,
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
      const { url, blob, fileName } = await generateDeliveryNotePdf({ jsPDF, thSarabunFont, form: snap, mode: "blob" });
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
          icon={<Description />} accent={ACCENT} title="ออกใบส่งมอบงาน"
          subtitle={locked
            ? `ออกแล้ว · เลขที่ ${existing.doc.docNumber}`
            : loadingNumber ? "กำลังตรวจเลขที่..." : previewNumber ? `เลขที่ถัดไป ${previewNumber}` : "ออกเลขที่อัตโนมัติ"}
          savedLabel={locked ? "" : draft.savedLabel}
          onClose={closeAll} busy={busy}
        />
      </DialogTitle>

      <DialogContent sx={{ px: { xs: 1.5, sm: 3 }, py: { xs: 1.75, sm: 2.5 }, bgcolor: SURFACE, overflowX: "hidden" }}>
        {error && <Alert severity="error" onClose={() => setError("")} sx={{ mb: 1.75, borderRadius: 2 }}>{error}</Alert>}
        {locked && <IssuedSummary doc={existing.doc} label="ใบส่งมอบงาน" onView={viewExisting} viewing={busy} onNavigate={closeAll} />}
        {!locked && draft.restoredLabel && <DraftBanner when={draft.restoredLabel} onDiscard={discardDraft} />}

        {/* ✅ ออกแล้ว = แสดงสรุปใบเดิมอย่างเดียว ไม่โชว์ฟอร์ม (แก้/ออกซ้ำไม่ได้อยู่แล้ว) */}
        {!locked && (<Box>
          {/* ── 1 ผู้รับ ─────────────────────────────────────────────────── */}
          <DocSection step={1} title="ส่งถึง" hint="เลือกจากทะเบียนลูกค้าเพื่อเติมบริษัท/ที่อยู่/เลขภาษีให้ครบ">
            <Stack spacing={1.75}>
              {/* ✅ ค้นได้ทั้งชื่อโครงการ ชื่อบริษัท และเลขผู้เสียภาษี — ใช้ทะเบียนลูกค้าของบริษัทเอง */}
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
              <TextField size="small" fullWidth label="เลขประจำตัวผู้เสียภาษี (ไม่บังคับ)" value={form.customerTaxId}
                onChange={setField("customerTaxId")} placeholder="13 หลัก" sx={fieldSx} />
              <TextField size="small" fullWidth multiline minRows={2} label="ที่อยู่ลูกค้า (ไม่บังคับ)"
                value={form.customerAddress} onChange={setField("customerAddress")} sx={fieldSx} />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.75}>
                <Autocomplete
                  freeSolo fullWidth size="small" options={ATTENTION_PRESETS}
                  inputValue={form.attention} onInputChange={(_, v) => set("attention")(v)}
                  renderInput={(params) => <TextField {...params} label="เรียน" sx={fieldSx} />}
                />
                <Autocomplete
                  freeSolo fullWidth size="small" options={referenceOptions}
                  inputValue={form.reference} onInputChange={(_, v) => set("reference")(v)}
                  renderInput={(params) => <TextField {...params} label="อ้างถึง" placeholder="เช่น ใบเสนอราคาเลขที่ QT2026060020" sx={fieldSx} />}
                />
              </Stack>
            </Stack>
          </DocSection>

          {/* ── 2 งานที่ส่งมอบ ───────────────────────────────────────────── */}
          <DocSection step={2} title="งานที่ส่งมอบ">
            <Stack spacing={1.75}>
              <Stack direction="row" spacing={1.5}>
                <TextField size="small" fullWidth label="งานที่ดำเนินการ" placeholder="เช่น PM ระบบ Fire Alarm"
                  value={form.workLabel} onChange={setField("workLabel")} sx={fieldSx} />
                <TextField size="small" label="ครั้งที่" placeholder="1/2" value={form.roundLabel || ""}
                  onChange={setField("roundLabel")} sx={{ ...fieldSx, width: { xs: 96, sm: 140 }, flexShrink: 0 }} />
              </Stack>
              <Autocomplete
                freeSolo fullWidth size="small" options={subjectOptions}
                inputValue={form.subject} onInputChange={(_, v) => set("subject")(v)}
                renderInput={(params) => <TextField {...params} label="เรื่อง" required sx={fieldSx} />}
              />
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "minmax(0,1fr) minmax(0,1fr)" }, gap: 1.5 }}>
                <ThaiDatePicker label="วันที่ออกเอกสาร" value={form.issuedAt} onChange={set("issuedAt")}
                  helperText={thaiFullDate(form.issuedAt)} textFieldProps={{ sx: fieldSx }} />
                <ThaiDatePicker label="วันที่งานเสร็จ" value={form.completedAt} onChange={set("completedAt")}
                  helperText={thaiFullDate(form.completedAt)} textFieldProps={{ sx: fieldSx }} />
              </Box>
            </Stack>

            <SubHeader action={<Button size="small" onClick={addAttachment} startIcon={<Add sx={{ fontSize: 16 }} />} sx={OUTLINE_BTN_SX}>เพิ่มรายการ</Button>}>
              สิ่งที่ส่งมาด้วย
            </SubHeader>
            <Stack spacing={1}>
              {(form.attachments || []).map((a, i) => (
                <Stack key={i} direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ width: 18, flexShrink: 0, fontSize: "0.8rem", fontWeight: 800, color: MUTED }}>{i + 1}.</Typography>
                  <Autocomplete
                    freeSolo fullWidth size="small" sx={{ flex: 1, minWidth: 0 }}
                    options={reportPresetOptions}
                    inputValue={a.text}
                    onInputChange={(_, v) => { if (v !== (a.text || "")) updateAttachment(i, "text", v); }}
                    renderInput={(params) => <TextField {...params} placeholder="ชื่อเอกสาร/สิ่งที่ส่งมอบ" sx={fieldSx} />}
                  />
                  <TextField size="small" sx={{ width: { xs: 76, sm: 100 }, flexShrink: 0, ...fieldSx }} placeholder="จำนวน"
                    value={a.qty} onChange={(e) => updateAttachment(i, "qty", e.target.value)} />
                  <IconButton size="small" onClick={() => removeAttachment(i)} aria-label={`ลบรายการ ${i + 1}`} sx={{ color: FAINT, p: 0.5 }}>
                    <DeleteOutline sx={{ fontSize: 18 }} />
                  </IconButton>
                </Stack>
              ))}
              {(form.attachments || []).length === 0 && (
                <Box sx={{ py: 2, textAlign: "center", border: `1px dashed ${LINE}`, borderRadius: 2 }}>
                  <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>ไม่มีรายการ — หัวข้อ "สิ่งที่ส่งมาด้วย" จะไม่ถูกพิมพ์</Typography>
                </Box>
              )}
            </Stack>
          </DocSection>

          {/* ── 3 เนื้อความ ─────────────────────────────────────────────── */}
          <DocSection step={3} title="เนื้อความ"
            action={<Button size="small" onClick={regenerateBody} startIcon={<Refresh sx={{ fontSize: 16 }} />} sx={SMALL_BTN_SX}>สร้างใหม่</Button>}>
            <TextField size="small" fullWidth multiline minRows={4} value={form.body} onChange={setField("body")} sx={fieldSx} />
          </DocSection>

          {/* ── 4 ผู้ลงนาม ──────────────────────────────────────────────── */}
          <DocSection step={4} title="ผู้ลงนามฝ่ายบริษัท" hint={`ออกในนาม ${ISSUER.nameTh} · แนบตราประทับให้อัตโนมัติ`}>
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
              <SignerPreview name={form.signerName} position={form.signerPosition} tel={""}
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
        title="ใบส่งมอบงาน"
        accent={ACCENT}
        preview={preview}
        issued={issued}
        docNumber={viewingExisting ? existing.doc?.docNumber : issued ? form.docNumber : (previewNumber || form.docNumber)}
        busy={busy} error={previewOpen ? error : ""}
        onBack={() => setPreviewOpen(false)}
        onConfirm={handleConfirm}
        onClose={viewingExisting ? () => { setPreviewOpen(false); setViewingExisting(false); setIssued(false); } : issued ? closeAll : () => setPreviewOpen(false)}
        email={{
          docType: "ใบส่งมอบงาน",
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

export default DeliveryNoteDialog;
