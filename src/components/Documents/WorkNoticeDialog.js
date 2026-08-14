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
import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Stack, Typography,
  TextField, Button, IconButton, Alert, Chip, useMediaQuery, CircularProgress, Autocomplete,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Close, Visibility, EventAvailable, Refresh, Search, Add, DeleteOutline, ContentPaste,
} from "@mui/icons-material";
import { jsPDF } from "jspdf";
import thSarabunFont from "../../Fonts/THSarabunNew_base64";
import DocNumberService from "../../services/DocNumberService";
import CustomerService from "../../services/CustomerService";
import {
  buildWorkNoticeDefaults, buildWorkNoticeBody, buildWorkNoticeCooperation,
  generateWorkNoticePdf, noticeSubjectPresetsFor, buildDayRows, dayRowText,
  TIME_PRESETS, SUPPORT_REQUEST_PRESETS, workVerbFor,
  ATTENTION_PRESETS, SIGNER_POSITION_PRESETS, thaiFullDate, ISSUER,
} from "./workNoticePdf";
import moment from "moment";
import { resolveJobFields, referencePresetsFor } from "./deliveryNotePdf";
import DocumentPreviewDialog from "./DocumentPreviewDialog";
import IssuedDocumentService from "../../services/IssuedDocumentService";

// ✅ สีประจำเอกสารชนิดนี้เป็น "ฟ้า" ไม่ใช่แดงเหมือนใบส่งมอบงาน — ตรงกับสีปุ่ม "📄 ออกใบแจ้งเข้างาน"
// ในหน้าแก้ไขงาน (.ee-btn-info = #0ea5e9) ผู้ใช้จึงเชื่อมโยงได้ทันทีว่ากล่องนี้มาจากปุ่มไหน และแยกออก
// จากกล่องใบส่งมอบงาน (แดง #dc2626 / ปุ่ม .ee-btn-delivery เขียวน้ำเงิน) ตั้งแต่แวบแรกที่เปิด
const ACCENT = "#0284c7";
const ACCENT_DARK = "#0369a1";
const SURFACE_SUBTLE = "#f8fafc";
const BORDER_MAIN = "#e2e8f0";
const TEXT_SUB = "#64748b";

// ✅ ป้ายหัวข้อกลุ่มฟิลด์ — แบ่งฟอร์มยาวๆ เป็นก้อนที่กวาดตาหาได้ แทนกองช่องกรอกเรียงติดกันรวด
const SectionLabel = ({ children }) => (
  <Typography
    variant="caption"
    sx={{ fontWeight: 800, color: TEXT_SUB, letterSpacing: "0.04em", display: "block", mb: 1 }}
  >
    {children}
  </Typography>
);

const Card = ({ children }) => (
  <Box sx={{ p: 2, mb: 2, bgcolor: "#fff", borderRadius: 2.5, border: `1px solid ${BORDER_MAIN}` }}>
    {children}
  </Box>
);

const WorkNoticeDialog = ({ open, onClose, job, customer, issuer, canUseRunningNumber = false }) => {
  const isMobile = useMediaQuery("(max-width:600px)");
  const [form, setForm] = useState(null);
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
    setForm({
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
          setForm((f) => (f ? { ...f, docNumber: d.docNumber } : f));
        })
        .catch(() => { if (alive) setPreviewNumber(""); })
        .finally(() => { if (alive) setLoadingNumber(false); });
    }

    {
      const p = resolveJobFields(job);
      const norm = (v) => String(v || "").trim().toLowerCase();
      CustomerService.getCustomers()
        .then((res) => {
          if (!alive) return;
          // ⚠️ API /customer คืนค่าในคีย์ "userCustomers" (ดู routes/customer.js) — ตัวอื่นเป็น fallback
          const list = res?.userCustomers || res?.customers || res?.data
            || (Array.isArray(res) ? res : []);
          setCustomerList(Array.isArray(list) ? list : []);
          if (customer) return;
          const found =
            list.find((c) => norm(c.cSite) === norm(p.site) && norm(c.cCompany) === norm(p.company))
            || list.find((c) => norm(c.cSite) === norm(p.site))
            || (p.company ? list.find((c) => norm(c.cCompany) === norm(p.company)) : null);
          if (found) {
            setForm((f) => (f ? {
              ...f,
              customerAddress: f.customerAddress || found.address || "",
              customerCompany: f.customerCompany || found.cCompany || "",
              customerTaxId: f.customerTaxId || found.tax || "",
            } : f));
          }
        })
        // ⚠️ หาที่อยู่ไม่เจอต้องไม่บล็อกการออกเอกสาร — ที่อยู่ไม่ใช่ช่องบังคับ (พิมพ์เองได้ในกล่อง)
        .catch(() => {});
    }

    return () => { alive = false; };
  }, [open, job, customer, issuer, canUseRunningNumber]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
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


  const buildPdf = (docNumber) =>
    generateWorkNoticePdf({ jsPDF, thSarabunFont, form: { ...form, docNumber }, mode: "blob" });

  /** ขั้นที่ 1 — สร้างไฟล์ตัวอย่างด้วย "เลขที่ที่จะได้" โดยยังไม่กินเลขจริง */
  const handlePreview = async () => {
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
      let finalNumber = form.docNumber;
      if (canUseRunningNumber) {
        const res = await DocNumberService.next("notice");
        finalNumber = res.docNumber;
      }
      const { url, blob, fileName } = await buildPdf(finalNumber);
      setForm((f) => ({ ...f, docNumber: finalNumber }));
      replacePreview({ url, blob, fileName });
      setIssued(true);
      // ✅ บันทึกลงทะเบียนเอกสารทันทีที่ออกจริง (ดูหน้า "ทะเบียนเอกสาร")
      // ⚠️ ห้าม await รวมใน try เดียวกับการสร้างไฟล์ — ถ้าบันทึกทะเบียนล้มเหลว (เน็ตหลุด/สิทธิ์ไม่พอ)
      // ต้องไม่ทำให้ผู้ใช้เห็นว่า "ออกเอกสารไม่สำเร็จ" ทั้งที่เลขถูกกินและไฟล์ออกเรียบร้อยแล้ว
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
      }).catch(() => {});
    } catch (err) {
      setError(err?.response?.data?.message || "ออกเอกสารไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  };

  const closeAll = () => {
    replacePreview(null);
    setPreviewOpen(false);
    setIssued(false);
    onClose?.();
  };

  if (!form) return null;

  return (
    <Dialog
      open={open}
      // ✅ ปิดได้เฉพาะปุ่ม "✕" กับ "ยกเลิก" — กล่องนี้เป็นฟอร์มยาวที่กรอก/แก้ไปหลายช่องแล้ว เผลอแตะ
      // พื้นหลังนอกกล่องทีเดียว (โดยเฉพาะบนมือถือที่นิ้วโดนขอบง่าย) แล้วข้อมูลหายหมดต้องเริ่มใหม่
      onClose={(_, reason) => {
        if (busy) return;
        if (reason === "backdropClick" || reason === "escapeKeyDown") return;
        closeAll();
      }}
      fullWidth maxWidth="md" fullScreen={isMobile}
      PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3 } }}
    >
      <DialogTitle sx={{ p: 0 }}>
        <Stack
          direction="row" alignItems="center" spacing={1.5}
          sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${BORDER_MAIN}` }}
        >
          <Box sx={{
            width: 40, height: 40, borderRadius: 2.5, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            bgcolor: alpha(ACCENT, 0.1), color: ACCENT,
          }}>
            <EventAvailable sx={{ fontSize: 22 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: "1.05rem", lineHeight: 1.3 }}>
              ออกใบแจ้งเข้างาน
            </Typography>
            <Typography variant="caption" sx={{ color: TEXT_SUB }}>
              {/* ✅ โชว์เลขที่จะได้ล่วงหน้า เพื่อให้รู้ก่อนกดว่าเอกสารใบนี้จะเป็นเลขอะไร */}
              {!canUseRunningNumber
                ? "ใช้เลขที่อ้างอิงของงานนี้ — แก้ไขได้ในช่องด้านล่าง"
                : loadingNumber
                  ? "กำลังตรวจเลขที่เอกสารถัดไป..."
                  : previewNumber
                    ? `เลขที่ถัดไป ${previewNumber} · ออกเลขจริงตอนกดออกเอกสาร`
                    : "ระบบจะออกเลขที่เอกสารให้อัตโนมัติตอนกดออกเอกสาร"}
            </Typography>
          </Box>
          <IconButton onClick={closeAll} disabled={busy}><Close /></IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ px: 2.5, py: 2.5, bgcolor: SURFACE_SUBTLE }}>
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

        {/* ── ผู้รับ ─────────────────────────────────────────────────────── */}
        <Card>
          <SectionLabel>แจ้งถึง</SectionLabel>
          <Stack spacing={1.75}>
            {/* ✅ ค้นหาจากทะเบียนลูกค้า แล้ววางชื่อบริษัท/ที่อยู่/เลขผู้เสียภาษีให้ครบชุดในคลิกเดียว */}
            <Autocomplete
              size="small" fullWidth
              options={customerList}
              value={null} blurOnSelect clearOnBlur
              getOptionLabel={(o) =>
                [o?.cSite, o?.cCompany].filter(Boolean).join(" · ") || "(ไม่ระบุชื่อ)"}
              filterOptions={(opts, { inputValue }) => {
                const q = inputValue.trim().toLowerCase();
                if (!q) return opts.slice(0, 30);
                return opts
                  .filter((o) => [o.cSite, o.cCompany, o.tax, o.address]
                    .some((v) => String(v || "").toLowerCase().includes(q)))
                  .slice(0, 30);
              }}
              onChange={(_, picked) => {
                if (!picked) return;
                setForm((f) => ({
                  ...f,
                  site: picked.cSite || f.site,
                  customerCompany: picked.cCompany || "",
                  customerAddress: picked.address || "",
                  customerTaxId: picked.tax || "",
                }));
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
                <TextField
                  {...params}
                  label="ค้นหาจากทะเบียนลูกค้า (ชื่อโครงการ / บริษัท / เลขผู้เสียภาษี)"
                  placeholder="พิมพ์เพื่อค้นหา แล้วเลือกเพื่อวางข้อมูลให้ครบชุด"
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: <Search sx={{ fontSize: 18, color: "text.disabled", ml: 0.5, mr: 0.5 }} />,
                  }}
                />
              )}
            />
            <TextField
              size="small" fullWidth label="ชื่อโครงการ" value={form.site}
              onChange={setField("site")} required
            />
            <TextField
              size="small" fullWidth label="บริษัทลูกค้า" value={form.customerCompany}
              onChange={setField("customerCompany")}
            />
            <TextField
              size="small" fullWidth multiline minRows={2} label="ที่อยู่ลูกค้า"
              value={form.customerAddress} onChange={setField("customerAddress")}
              helperText={form.customerAddress ? undefined : "ไม่พบที่อยู่ในทะเบียนลูกค้า — กรอกเองได้ หรือเว้นว่างไว้ก็ออกเอกสารได้"}
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.75}>
              <Autocomplete
                freeSolo fullWidth size="small" options={ATTENTION_PRESETS}
                inputValue={form.attention}
                onInputChange={(_, v) => set("attention")(v)}
                renderInput={(params) => <TextField {...params} label="เรียน" />}
              />
              {/* ✅ อ้างถึง — ตัวเลือกสร้างจากเลขเอกสารที่ผูกกับงานนี้อยู่แล้ว (ใบเสนอราคา/สัญญา)
                  เลือกได้เลยไม่ต้องไปเปิดหน้าอื่นคัดลอกเลขมาวาง และไม่มีทางพิมพ์เลขผิด */}
              <Autocomplete
                freeSolo fullWidth size="small" options={referenceOptions}
                inputValue={form.reference}
                onInputChange={(_, v) => set("reference")(v)}
                renderInput={(params) => (
                  <TextField
                    {...params} label="อ้างถึง"
                    placeholder="เช่น สัญญาเลขที่ FAPTY01-2569"
                    helperText={referenceOptions.length === 0 ? "งานนี้ยังไม่มีเลขเอกสารในระบบ — พิมพ์เองได้" : undefined}
                  />
                )}
              />
            </Stack>
          </Stack>
        </Card>

        {/* ── กำหนดการเข้างาน ───────────────────────────────────────────── */}
        <Card>
          <SectionLabel>งานที่จะเข้าดำเนินการ</SectionLabel>
          <Stack spacing={1.75}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.75}>
              <TextField
                size="small" fullWidth label="งานที่ดำเนินการ (ประเภทงาน + ระบบ)"
                value={form.workLabel} onChange={setField("workLabel")}
                placeholder="เช่น PM ระบบ Fire Alarm"
                helperText='ใช้ประกอบทั้งหัวข้อ "เรื่อง" และเนื้อความของเอกสาร'
              />
              <TextField
                size="small" sx={{ width: { xs: "100%", sm: 150 }, flexShrink: 0 }}
                label="ครั้งที่" value={form.roundLabel || ""}
                onChange={setField("roundLabel")}
                placeholder="เช่น 1/2"
                helperText={form.roundLabel ? undefined : "งานนี้ไม่มีครั้งที่"}
              />
            </Stack>
          </Stack>

          {/* ── กำหนดการรายวัน ────────────────────────────────────────────
              ✅ รูปแบบตรงกับเอกสารจริงของบริษัท: 1 บรรทัดต่อ 1 วัน
                 "วันที่ 5 กุมภาพันธ์ 2569  เวลา 09.30 - 17.30 น.  เข้าทำการตรวจเช็คตู้ควบคุม ..."
              ⚠️ ต้องแยกรายวัน ไม่ใช่เขียนช่วง "5–7 ก.พ." รวดเดียว เพราะแต่ละวันเข้าทำคนละอย่าง/คนละ
              พื้นที่ และบางงานเว้นวัน — ระบบเติมให้ครบทุกวันตามที่ลงตารางไว้เป็นจุดตั้งต้น แล้วผู้ใช้
              แก้ข้อความรายวันเอง (นัดหมายไม่เหมือนกันสักโครงการ) */}
          <Stack direction="row" alignItems="center" sx={{ mt: 2, mb: 0.5 }}>
            <SectionLabel>กำหนดการรายวัน</SectionLabel>
            <Box sx={{ flex: 1 }} />
            <Button
              size="small" startIcon={<Add sx={{ fontSize: 16 }} />} onClick={addDay}
              sx={{ textTransform: "none", fontWeight: 700, color: ACCENT, mb: 1 }}
            >
              เพิ่มวัน
            </Button>
          </Stack>

          {/* แถบเครื่องมือกรอกเร็ว — เคสที่เจอบ่อยที่สุดคือ "เวลาเดิมทุกวัน / ทำเหมือนกันทุกวัน" */}
          <Stack
            direction="row" spacing={0.5} alignItems="center" useFlexGap
            sx={{ flexWrap: "wrap", mb: 1.25, p: 1, borderRadius: 2, bgcolor: alpha(ACCENT, 0.06), border: `1px dashed ${alpha(ACCENT, 0.35)}` }}
          >
            <Typography variant="caption" sx={{ color: TEXT_SUB, mr: 0.5 }}>
              ตารางลงไว้ <b style={{ color: ACCENT_DARK }}>{form.jobDateText}</b>
            </Typography>
            <Button size="small" onClick={regenerateDays} startIcon={<Refresh sx={{ fontSize: 15 }} />}
              sx={{ textTransform: "none", fontWeight: 700, color: ACCENT_DARK, minWidth: 0 }}>
              สร้างใหม่ตามตาราง
            </Button>
            <Button size="small" onClick={() => applyFirstToAll("time")} startIcon={<ContentPaste sx={{ fontSize: 15 }} />}
              sx={{ textTransform: "none", fontWeight: 700, color: ACCENT_DARK, minWidth: 0 }}>
              ใช้เวลาวันแรกทุกวัน
            </Button>
            <Button size="small" onClick={() => applyFirstToAll("detail")} startIcon={<ContentPaste sx={{ fontSize: 15 }} />}
              sx={{ textTransform: "none", fontWeight: 700, color: ACCENT_DARK, minWidth: 0 }}>
              ใช้รายละเอียดวันแรกทุกวัน
            </Button>
          </Stack>

          <Stack spacing={1.25}>
            {(form.dayRows || []).map((r, i) => (
              <Box key={i} sx={{ p: 1.25, borderRadius: 2, border: `1px solid ${BORDER_MAIN}`, bgcolor: SURFACE_SUBTLE }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                  <TextField
                    size="small" type="date" label={`วันที่ ${i + 1}`}
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: { xs: "100%", sm: 165 }, flexShrink: 0, bgcolor: "#fff" }}
                    value={r.date} onChange={(e) => updateDay(i, "date", e.target.value)}
                  />
                  <Autocomplete
                    freeSolo size="small" options={TIME_PRESETS}
                    sx={{ width: { xs: "100%", sm: 175 }, flexShrink: 0, bgcolor: "#fff" }}
                    inputValue={r.time || ""}
                    onInputChange={(_, v) => updateDay(i, "time", v)}
                    renderInput={(params) => <TextField {...params} label="เวลา" />}
                  />
                  <Box sx={{ flex: 1 }} />
                  <IconButton size="small" onClick={() => removeDay(i)} sx={{ color: "text.disabled", alignSelf: { xs: "flex-end", sm: "center" } }}>
                    <DeleteOutline sx={{ fontSize: 18 }} />
                  </IconButton>
                </Stack>
                <TextField
                  size="small" fullWidth multiline sx={{ mt: 1, bgcolor: "#fff" }}
                  label="วันนี้เข้าทำอะไร / บริเวณไหน"
                  value={r.detail || ""} onChange={(e) => updateDay(i, "detail", e.target.value)}
                  placeholder="เช่น เข้าทำการตรวจเช็คตู้ควบคุม และทดสอบบริเวณพื้นที่ห้องพักที่สามารถเข้าได้"
                />
                {/* ✅ ตัวอย่างบรรทัดจริงที่จะถูกพิมพ์ — เห็นผลทันทีโดยไม่ต้องออกเอกสารมาดูก่อน */}
                <Typography variant="caption" sx={{ display: "block", mt: 0.75, color: TEXT_SUB, fontStyle: "italic" }}>
                  {dayRowText(r) || "— บรรทัดนี้ยังว่าง จะไม่ถูกพิมพ์ลงเอกสาร —"}
                </Typography>
              </Box>
            ))}
            {(form.dayRows || []).length === 0 && (
              <Typography variant="caption" sx={{ color: "text.disabled" }}>
                ยังไม่มีวันไหนเลย — กด "เพิ่มวัน" หรือ "สร้างใหม่ตามตาราง"
              </Typography>
            )}
          </Stack>

          {/* ✅ หมายเหตุเพิ่มเติม — เป็นข้อความของ "ทั้งใบ" ไม่ใช่ของวันใดวันหนึ่ง จึงต้องแยกให้ชัดทั้งใน
              กล่องนี้และในเอกสาร (ในเอกสารจะมีป้าย "หมายเหตุ" คั่นไว้เป็นคอลัมน์ของตัวเอง) */}
          <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, border: `1px solid ${BORDER_MAIN}`, bgcolor: "#fff" }}>
            <SectionLabel>หมายเหตุเพิ่มเติม (ไม่บังคับ)</SectionLabel>
            <TextField
              size="small" fullWidth multiline minRows={2}
              value={form.supportNote} onChange={setField("supportNote")}
              placeholder={SUPPORT_REQUEST_PRESETS[0]}
              helperText='ขึ้นบรรทัดใหม่ได้ · ในเอกสารจะขึ้นเป็นย่อหน้า "หมายเหตุ" แยกจากรายการรายวัน'
            />
          </Box>
          <Typography variant="caption" sx={{ display: "block", mt: 1, color: "text.disabled" }}>
            {printedDays.length > 0
              ? `จะถูกพิมพ์ลงเอกสาร ${printedDays.length} วัน`
              : "ยังไม่มีวันไหนถูกกรอก — เอกสารจะไม่มีกำหนดการเลย"}
          </Typography>
        </Card>

        {/* ── รายละเอียดเอกสาร ───────────────────────────────────────────── */}
        <Card>
          <SectionLabel>รายละเอียดเอกสาร</SectionLabel>
          <Stack spacing={1.75}>
            <Autocomplete
              freeSolo fullWidth size="small" options={subjectOptions}
              inputValue={form.subject}
              onInputChange={(_, v) => set("subject")(v)}
              renderInput={(params) => <TextField {...params} label="เรื่อง" required />}
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.75}>
              <TextField
                size="small" fullWidth label="เลขที่เอกสาร" value={form.docNumber}
                onChange={setField("docNumber")}
                disabled={canUseRunningNumber}
                helperText={canUseRunningNumber
                  ? "ระบบออกเลขเดินหน้าให้อัตโนมัติตอนกดออกเอกสาร"
                  : 'ใช้ "เลขที่อ้างอิง (Doc No.)" ของงานนี้ — แก้ไขได้'}
              />
              <TextField
                size="small" fullWidth type="date" label="วันที่ออกเอกสาร"
                InputLabelProps={{ shrink: true }}
                value={form.issuedAt} onChange={setField("issuedAt")}
                helperText={`ในเอกสารจะขึ้นเป็น "${thaiFullDate(form.issuedAt)}"`}
              />
            </Stack>
          </Stack>
        </Card>

        {/* ── เนื้อความ ──────────────────────────────────────────────────── */}
        <Card>
          <Stack direction="row" alignItems="center">
            <SectionLabel>เนื้อความ</SectionLabel>
            <Box sx={{ flex: 1 }} />
            <Button
              size="small" startIcon={<Refresh sx={{ fontSize: 15 }} />} onClick={regenerateBody}
              sx={{ textTransform: "none", fontWeight: 700, color: TEXT_SUB, mb: 1 }}
            >
              สร้างข้อความใหม่จากข้อมูลด้านบน
            </Button>
          </Stack>
          <Stack spacing={1.75}>
            <TextField
              size="small" fullWidth multiline minRows={3}
              label="ย่อหน้าที่ 1 — ที่มาและกำหนดการ"
              value={form.body} onChange={setField("body")}
            />
            <TextField
              size="small" fullWidth multiline minRows={3}
              label="ย่อหน้าที่ 2 — ขอความร่วมมือ"
              value={form.cooperationNote} onChange={setField("cooperationNote")}
              helperText='ปิดท้ายด้วย "จึงเรียนมาเพื่อโปรดทราบ..." ให้อัตโนมัติในเอกสาร'
            />
          </Stack>
        </Card>

        {/* ── ผู้ออกเอกสาร ───────────────────────────────────────────────── */}
        <Card>
          <SectionLabel>ผู้ออกเอกสาร (ผู้ประสานงาน)</SectionLabel>
          <Stack spacing={1.75}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.75}>
              <TextField
                size="small" fullWidth label="ชื่อ-นามสกุล" value={form.signerName}
                onChange={setField("signerName")} required
                placeholder="เช่น นายสันติสุข ศรีมันตะ"
              />
              <Autocomplete
                freeSolo fullWidth size="small" options={SIGNER_POSITION_PRESETS}
                inputValue={form.signerPosition}
                onInputChange={(_, v) => set("signerPosition")(v)}
                renderInput={(params) => <TextField {...params} label="ตำแหน่ง" />}
              />
            </Stack>
            {/* ✅ เบอร์ติดต่อกลับ — จุดที่ลูกค้ามองหาเมื่อไม่สะดวกตามกำหนดการ ใบแจ้งเข้างานที่ไม่มีเบอร์
                ให้ติดต่อกลับใช้ประโยชน์จริงไม่ได้ (ต่างจากใบส่งมอบงานที่แค่ต้องมีคนเซ็นกำกับ) */}
            <TextField
              size="small" fullWidth label="เบอร์ติดต่อกลับ" value={form.signerTel}
              onChange={setField("signerTel")}
              placeholder="เช่น 097-085-7411"
              helperText={form.signerTel ? undefined : "แนะนำให้ใส่ — ลูกค้าใช้ติดต่อกลับเมื่อต้องเลื่อนนัด"}
            />
            <Typography variant="caption" sx={{ display: "block", color: "text.disabled" }}>
              ออกในนาม {ISSUER.nameTh} · แนบตราประทับบริษัทให้อัตโนมัติ
            </Typography>
          </Stack>
        </Card>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 2, borderTop: `1px solid ${BORDER_MAIN}`, gap: 1 }}>
        {missing.length > 0 && (
          <Chip
            size="small" label={`ยังไม่ได้กรอก: ${missing.join(" · ")}`}
            sx={{ mr: "auto", fontWeight: 700, bgcolor: alpha("#f59e0b", 0.15), color: "#b45309" }}
          />
        )}
        <Button onClick={closeAll} disabled={busy} sx={{ textTransform: "none" }}>ยกเลิก</Button>
        {/* ✅ เหลือปุ่มเดียว: ไปดูตัวอย่างก่อนเสมอ — ปุ่มออกเอกสาร/ดาวน์โหลด/แชร์ ย้ายไปอยู่ในกล่อง
            ตัวอย่างทั้งหมด (ดู DocumentPreviewDialog) เพื่อไม่ให้มีทางลัด "ออกเลยโดยไม่ได้ดู" หลงเหลือ
            อยู่เลย — เอกสารใบนี้กินเลขที่เดินหน้าอย่างเดียว ออกผิดแล้วย้อนไม่ได้ */}
        <Button
          variant="contained" onClick={handlePreview} disabled={busy}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <Visibility sx={{ fontSize: 18 }} />}
          sx={{ textTransform: "none", fontWeight: 700, bgcolor: ACCENT, borderRadius: 2, boxShadow: "none", px: 2, "&:hover": { bgcolor: ACCENT_DARK, boxShadow: "none" } }}
        >
          {busy ? "กำลังสร้างตัวอย่าง..." : "ดูตัวอย่างเอกสาร"}
        </Button>
      </DialogActions>

      {/* ✅ กล่องตัวอย่าง — ซ้อนบนฟอร์ม กด "กลับไปแก้ไข" แล้วข้อมูลที่กรอกไว้ยังอยู่ครบทุกช่อง */}
      <DocumentPreviewDialog
        open={previewOpen}
        title="ใบแจ้งเข้างาน"
        accent={ACCENT} accentDark={ACCENT_DARK}
        preview={preview}
        issued={issued}
        docNumber={issued ? form.docNumber : (previewNumber || form.docNumber)}
        busy={busy} error={error}
        onBack={() => setPreviewOpen(false)}
        onConfirm={handleConfirm}
        onClose={issued ? closeAll : () => setPreviewOpen(false)}
      />
    </Dialog>
  );
};

export default WorkNoticeDialog;
