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
import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Stack, Typography,
  TextField, Button, IconButton, Divider, Alert, Chip, useMediaQuery, CircularProgress, Autocomplete,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Close, Add, DeleteOutline, PictureAsPdf, Download, Description, Refresh, Search,
} from "@mui/icons-material";
import { jsPDF } from "jspdf";
import thSarabunFont from "../../Fonts/THSarabunNew_base64";
import DocNumberService from "../../services/DocNumberService";
import CustomerService from "../../services/CustomerService";
import {
  buildDeliveryNoteDefaults, buildDeliveryNoteBody, generateDeliveryNotePdf, thaiFullDate, ISSUER,
  REPORT_NOUN_PRESETS, spaceThaiLatin, resolveJobFields,
  ATTENTION_PRESETS, SIGNER_POSITION_PRESETS, subjectPresetsFor, referencePresetsFor,
} from "./deliveryNotePdf";

const ACCENT = "#dc2626";
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

const DeliveryNoteDialog = ({ open, onClose, job, customer, onIssued }) => {
  const isMobile = useMediaQuery("(max-width:600px)");
  const [form, setForm] = useState(null);
  const [previewNumber, setPreviewNumber] = useState("");
  const [loadingNumber, setLoadingNumber] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // ✅ เก็บทะเบียนลูกค้าทั้งก้อนไว้ให้ช่อง "ค้นหาลูกค้า" ใช้ — โหลดครั้งเดียวตอนเปิดกล่อง
  const [customerList, setCustomerList] = useState([]);

  // ✅ ตั้งค่าเริ่มต้นใหม่ทุกครั้งที่เปิดกล่อง — ไม่ค้างค่าของงานก่อนหน้าไว้ (กล่องนี้ถูกใช้ซ้ำกับทุกงาน
  // ในหน้าเดียวกัน ถ้าไม่รีเซ็ตจะเปิดงาน B แล้วเห็นข้อมูลงาน A ค้างอยู่)
  // ✅ ที่อยู่ลูกค้าถูกค้นหาให้เองจากทะเบียนลูกค้า (จับคู่ด้วยชื่อโครงการ + บริษัท) — ทำในนี้ ไม่ใช่ให้
  // หน้าที่เรียกส่ง prop เข้ามา เพราะกล่องนี้ถูกเรียกจากหลายหน้า (การดำเนินงาน/ปฏิทิน/ภาพรวมงาน)
  // ถ้าให้ทุกหน้าไปโหลดทะเบียนลูกค้าเองจะกลายเป็นโค้ดซ้ำ 3 ที่ และหน้าที่ลืมส่งมาก็จะได้เอกสารไม่มีที่อยู่
  // ⚠️ โหลดตอน "เปิดกล่อง" เท่านั้น ไม่ใช่ตอนหน้าโหลด — หน้าการดำเนินงานมีการ์ดงานเป็นร้อยใบ
  useEffect(() => {
    if (!open || !job) return;
    const base = buildDeliveryNoteDefaults(job, customer);
    setForm({ ...base, body: buildDeliveryNoteBody(base) });
    setError("");

    // ⚠️ กัน setState หลังกล่องถูกปิด/เปลี่ยนงานไปแล้ว (คำขอที่ยิงไปยังค้างอยู่กลางทางได้เสมอ)
    let alive = true;
    setLoadingNumber(true);
    DocNumberService.peek("delivery")
      .then((d) => { if (alive) setPreviewNumber(d.docNumber); })
      .catch(() => { if (alive) setPreviewNumber(""); })
      .finally(() => { if (alive) setLoadingNumber(false); });

    {
      const p = resolveJobFields(job);
      const norm = (v) => String(v || "").trim().toLowerCase();
      CustomerService.getCustomers()
        .then((res) => {
          if (!alive) return;
          // 🐛 BUG ที่แก้ (ช่องค้นหาลูกค้าไม่ขึ้นอะไรเลย): API /customer คืนค่ามาในคีย์ชื่อ
          // "userCustomers" (ดู routes/customer.js) แต่เดิมตรงนี้ไล่หา customers/data ซึ่งไม่มีจริง
          // เลยได้ [] ทุกครั้ง — ทั้งช่องค้นหาและการเติมที่อยู่อัตโนมัติจึงไม่เคยทำงานเลยตั้งแต่แรก
          // ⚠️ คีย์ที่ถูกต้องคือ userCustomers เท่านั้น (เทียบกับ components/User/Customer/index.js
          // ที่อ่าน res.userCustomers เหมือนกัน) ตัวอื่นใส่ไว้เป็น fallback เผื่อ API เปลี่ยนรูปแบบ
          const list = res?.userCustomers || res?.customers || res?.data
            || (Array.isArray(res) ? res : []);
          setCustomerList(Array.isArray(list) ? list : []);
          if (customer) return; // มีข้อมูลลูกค้าส่งมาให้แล้ว ไม่ต้องเดาซ้ำ
          // ✅ จับคู่ด้วยชื่อโครงการก่อน (cSite เป็น required + unique คู่กับ cCompany จึงเจาะจงกว่า)
          // ถ้าไม่เจอค่อยลองจับด้วยชื่อบริษัท — งานเก่าบางรายการกรอกชื่อไว้คนละแบบกับทะเบียนลูกค้า
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
        // ⚠️ หาที่อยู่ไม่เจอ/โหลดทะเบียนลูกค้าไม่ได้ ต้องไม่บล็อกการออกเอกสาร — ที่อยู่ไม่ใช่ช่องบังคับ
        // (ผู้ใช้พิมพ์เองได้ในกล่อง) แค่เสียความสะดวกไป ไม่ใช่ทำงานต่อไม่ได้
        .catch(() => {});
    }

    return () => { alive = false; };
  }, [open, job, customer]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
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

  const handleIssue = async (mode) => {
    if (missing.length > 0) {
      setError(`กรุณากรอก: ${missing.join(" · ")}`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      // ⚠️ กินเลขจริงตรงนี้เท่านั้น — และต้องได้เลขมาก่อนถึงจะสร้างไฟล์ ถ้าขอเลขไม่สำเร็จต้องไม่ออก
      // เอกสารที่ไม่มีเลขที่ออกไป (เอกสารไม่มีเลขอ้างอิงคือเอกสารที่ตามกลับไม่ได้)
      const { docNumber } = await DocNumberService.next("delivery");
      const finalForm = { ...form, docNumber };
      await generateDeliveryNotePdf({ jsPDF, thSarabunFont, form: finalForm, mode });
      onIssued?.(finalForm);
      onClose?.();
    } catch (err) {
      setError(err?.response?.data?.message || "ออกเอกสารไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  };

  if (!form) return null;

  return (
    <Dialog
      open={open}
      // ✅ ปิดได้เฉพาะปุ่ม "✕" กับ "ยกเลิก" เท่านั้น — กล่องนี้เป็นฟอร์มยาวที่กรอก/แก้ไปหลายช่องแล้ว
      // เผลอแตะพื้นหลังนอกกล่องทีเดียว (โดยเฉพาะบนมือถือที่นิ้วโดนขอบง่าย) แล้วข้อมูลหายหมดต้องเริ่มใหม่
      // ⚠️ MUI ส่ง reason มาให้ว่าปิดเพราะอะไร — เมินเฉพาะ 2 กรณีที่เป็นการปิด "โดยไม่ตั้งใจ"
      // (คลิกพื้นหลัง / กด Esc) ส่วนการปิดจากปุ่มเรียก onClose ตรงๆ ไม่ผ่านทางนี้ จึงยังทำงานปกติ
      onClose={(_, reason) => {
        if (busy) return;
        if (reason === "backdropClick" || reason === "escapeKeyDown") return;
        onClose?.();
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
            <Description sx={{ fontSize: 22 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: "1.05rem", lineHeight: 1.3 }}>
              ออกใบส่งมอบงาน
            </Typography>
            <Typography variant="caption" sx={{ color: TEXT_SUB }}>
              {/* ✅ โชว์เลขที่จะได้ล่วงหน้า เพื่อให้รู้ก่อนกดว่าเอกสารใบนี้จะเป็นเลขอะไร */}
              {loadingNumber
                ? "กำลังตรวจเลขที่เอกสารถัดไป..."
                : previewNumber
                  ? `เลขที่ถัดไป ${previewNumber} · ออกเลขจริงตอนกดออกเอกสาร`
                  : "ระบบจะออกเลขที่เอกสารให้อัตโนมัติตอนกดออกเอกสาร"}
            </Typography>
          </Box>
          <IconButton onClick={onClose} disabled={busy}><Close /></IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ px: 2.5, py: 2.5, bgcolor: SURFACE_SUBTLE }}>
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

        {/* ── ผู้รับ ─────────────────────────────────────────────────────── */}
        <Box sx={{ p: 2, mb: 2, bgcolor: "#fff", borderRadius: 2.5, border: `1px solid ${BORDER_MAIN}` }}>
          <SectionLabel>ส่งถึง</SectionLabel>
          <Stack spacing={1.75}>
            {/* ✅ ค้นหาจากทะเบียนลูกค้า แล้ววางชื่อบริษัท/ที่อยู่/เลขผู้เสียภาษีให้ครบชุดในคลิกเดียว
                ⚠️ ไม่ได้ใช้ API ภายนอกค้นเลขผู้เสียภาษี (ของกรมพัฒน์ฯ ฟรีก็จริงแต่ต้องสมัครขอ key และ
                เรียกตรงจากเบราว์เซอร์ไม่ได้เพราะติด CORS ต้องมี proxy ฝั่ง server) — ใช้ข้อมูลที่บริษัท
                กรอกไว้เองในระบบแทน ซึ่งเชื่อถือได้กว่าและไม่มีค่าใช้จ่าย/ไม่พึ่งบริการภายนอก
                ✅ ค้นได้ทั้งชื่อโครงการ ชื่อบริษัท และเลขผู้เสียภาษี (พิมพ์เลขภาษีก็เจอ) */}
            <Autocomplete
              size="small" fullWidth
              options={customerList}
              value={null} blurOnSelect clearOnBlur
              // ⚠️ ต้องคืนสตริงเสมอ — ลูกค้าบางรายการในระบบไม่มีชื่อบริษัท (cCompany ไม่ใช่ช่องบังคับ)
              // ถ้าคืนค่าว่างเปล่า MUI จะเตือนและรายการนั้นกดเลือกไม่ได้
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
              size="small" fullWidth label="เลขประจำตัวผู้เสียภาษี" value={form.customerTaxId}
              onChange={setField("customerTaxId")}
              placeholder="13 หลัก เช่น 0125563014222"
              helperText={form.customerTaxId ? undefined : "ไม่บังคับ — ใส่ไว้จะช่วยตอนลูกค้าใช้ประกอบการวางบิล/ตรวจรับงาน"}
            />
            <TextField
              size="small" fullWidth multiline minRows={2} label="ที่อยู่ลูกค้า"
              value={form.customerAddress} onChange={setField("customerAddress")}
              helperText={form.customerAddress ? undefined : 'ไม่พบที่อยู่ในทะเบียนลูกค้า — กรอกเองได้ หรือเว้นว่างไว้ก็ออกเอกสารได้'}
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.75}>
              {/* ✅ เรียน — เลือกตำแหน่งผู้รับที่เจอบ่อยในงานอาคาร/โรงงาน หรือพิมพ์เองก็ได้ */}
              <Autocomplete
                freeSolo fullWidth size="small" options={ATTENTION_PRESETS}
                inputValue={form.attention}
                onInputChange={(_, v) => set("attention")(v)}
                renderInput={(params) => <TextField {...params} label="เรียน" />}
              />
              {/* ✅ อ้างถึง — ตัวเลือกสร้างจากเลขเอกสารที่ผูกกับงานนี้อยู่แล้ว (ใบเสนอราคา/สัญญา/เลข
                  เอกสาร) เลือกได้เลยไม่ต้องไปเปิดหน้าอื่นคัดลอกเลขมาวาง และไม่มีทางพิมพ์เลขผิด */}
              <Autocomplete
                freeSolo fullWidth size="small" options={referenceOptions}
                inputValue={form.reference}
                onInputChange={(_, v) => set("reference")(v)}
                renderInput={(params) => (
                  <TextField
                    {...params} label="อ้างถึง"
                    placeholder="เช่น ใบเสนอราคาเลขที่ QT2026060020"
                    helperText={referenceOptions.length === 0 ? "งานนี้ยังไม่มีเลขเอกสารในระบบ — พิมพ์เองได้" : undefined}
                  />
                )}
              />
            </Stack>
          </Stack>
        </Box>

        {/* ── รายละเอียดเอกสาร ───────────────────────────────────────────── */}
        <Box sx={{ p: 2, mb: 2, bgcolor: "#fff", borderRadius: 2.5, border: `1px solid ${BORDER_MAIN}` }}>
          <SectionLabel>รายละเอียดเอกสาร</SectionLabel>
          <Stack spacing={1.75}>
            {/* ✅ เรื่อง — ตัวเลือกประกอบจากชื่องาน/ระบบของใบนี้เอง ไม่ใช่รายการตายตัว (หัวเรื่องที่ดี
                ต้องมีชื่องานอยู่ด้วย ไม่งั้นลูกค้าอ่านแล้วไม่รู้ว่าเอกสารของงานไหน) */}
            {/* ✅ ประเภทงาน + ระบบ — เป็นตัวตั้งของทั้ง "เรื่อง" และ "เนื้อความ" (เช่น "PM ระบบ
                Fire Alarm") ทำให้เอกสารบอกได้ว่าเข้าไปทำงานอะไรกับระบบไหน ไม่ใช่แค่ "ส่งมอบเอกสาร"
                ลอยๆ — เติมมาจากตัวงานให้แล้ว แต่เปิดให้แก้ได้ เพราะงานเก่าบางรายการไม่ได้กรอก
                ประเภทงาน/ระบบไว้ครบ ถ้าล็อกไว้จะไม่มีทางเติมให้ถูกได้เลยจากหน้านี้ */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.75}>
              <TextField
                size="small" fullWidth label="งานที่ดำเนินการ (ประเภทงาน + ระบบ)"
                value={form.workLabel} onChange={setField("workLabel")}
                placeholder="เช่น PM ระบบ Fire Alarm"
                helperText='ใช้ประกอบทั้งหัวข้อ "เรื่อง" และเนื้อความของเอกสาร'
              />
              {/* ✅ ครั้งที่ — ดึงจากงานให้แล้ว (รูปแบบ "ครั้งที่/ทั้งหมด" เช่น 1/2) แก้/ลบได้
                  งานทั่วไปที่ไม่มีครั้งที่จะว่างไว้ แล้วเอกสารจะข้ามส่วนนี้ไปเองไม่มีช่องว่างค้าง */}
              <TextField
                size="small" sx={{ width: { xs: "100%", sm: 150 }, flexShrink: 0 }}
                label="ครั้งที่" value={form.roundLabel || ""}
                onChange={setField("roundLabel")}
                placeholder="เช่น 1/2"
                helperText={form.roundLabel ? undefined : "งานนี้ไม่มีครั้งที่"}
              />
            </Stack>
            <Autocomplete
              freeSolo fullWidth size="small" options={subjectOptions}
              inputValue={form.subject}
              onInputChange={(_, v) => set("subject")(v)}
              renderInput={(params) => <TextField {...params} label="เรื่อง" required />}
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.75}>
              <TextField
                size="small" fullWidth type="date" label="วันที่ออกเอกสาร"
                InputLabelProps={{ shrink: true }}
                value={form.issuedAt} onChange={setField("issuedAt")}
                helperText={`ในเอกสารจะขึ้นเป็น "${thaiFullDate(form.issuedAt)}"`}
              />
              <TextField
                size="small" fullWidth type="date" label="วันที่งานเสร็จ"
                InputLabelProps={{ shrink: true }}
                value={form.completedAt} onChange={setField("completedAt")}
                helperText={`ในเอกสารจะขึ้นเป็น "${thaiFullDate(form.completedAt)}"`}
              />
            </Stack>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
            <SectionLabel>สิ่งที่ส่งมาด้วย</SectionLabel>
            <Box sx={{ flex: 1 }} />
            <Button
              size="small" startIcon={<Add sx={{ fontSize: 16 }} />} onClick={addAttachment}
              sx={{ textTransform: "none", fontWeight: 700, color: ACCENT, mb: 1 }}
            >
              เพิ่มรายการ
            </Button>
          </Stack>
          <Stack spacing={1.25}>
            {(form.attachments || []).map((a, i) => (
              <Stack key={i} direction="row" spacing={1} alignItems="center">
                <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 700, width: 16 }}>
                  {i + 1}.
                </Typography>
                {/* ✅ เลือกจากคำมาตรฐานได้ในคลิกเดียว หรือพิมพ์เองก็ได้ (freeSolo) — ระบบเดาคำให้ตาม
                    ลักษณะงานอยู่แล้ว (ดู reportNounFor) รายการนี้ไว้เผื่อกรณีที่อยากใช้คำอื่น
                    ⚠️ ตัวเลือกที่แสดงต่อท้ายด้วย "ระบบ X" ให้เลย จะได้กดครั้งเดียวได้ข้อความครบ
                    ไม่ต้องมาพิมพ์ชื่อระบบต่อท้ายเองทุกครั้ง */}
                <Autocomplete
                  freeSolo fullWidth size="small" sx={{ flex: 1 }}
                  options={reportPresetOptions}
                  inputValue={a.text}
                  onInputChange={(_, v) => updateAttachment(i, "text", v)}
                  renderInput={(params) => (
                    <TextField {...params} placeholder="ชื่อเอกสาร/สิ่งที่ส่งมอบ" />
                  )}
                />
                <TextField
                  size="small" sx={{ width: 100 }} placeholder="จำนวน"
                  value={a.qty} onChange={(e) => updateAttachment(i, "qty", e.target.value)}
                />
                <IconButton size="small" onClick={() => removeAttachment(i)} sx={{ color: "text.disabled" }}>
                  <DeleteOutline sx={{ fontSize: 18 }} />
                </IconButton>
              </Stack>
            ))}
            {(form.attachments || []).length === 0 && (
              <Typography variant="caption" sx={{ color: "text.disabled" }}>
                ไม่มีรายการ — หัวข้อ "สิ่งที่ส่งมาด้วย" จะไม่ถูกพิมพ์ลงในเอกสาร
              </Typography>
            )}
          </Stack>
        </Box>

        {/* ── เนื้อความ ──────────────────────────────────────────────────── */}
        <Box sx={{ p: 2, mb: 2, bgcolor: "#fff", borderRadius: 2.5, border: `1px solid ${BORDER_MAIN}` }}>
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
          <TextField
            size="small" fullWidth multiline minRows={4}
            value={form.body} onChange={setField("body")}
          />
        </Box>

        {/* ── ผู้ลงนาม ───────────────────────────────────────────────────── */}
        <Box sx={{ p: 2, bgcolor: "#fff", borderRadius: 2.5, border: `1px solid ${BORDER_MAIN}` }}>
          <SectionLabel>ผู้ลงนามฝ่ายบริษัท</SectionLabel>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.75}>
            <TextField
              size="small" fullWidth label="ชื่อ-นามสกุล" value={form.signerName}
              onChange={setField("signerName")} required
              placeholder="เช่น นายสันติสุข ศรีมันตะ"
            />
            {/* ✅ ตำแหน่ง — เลือกจากตำแหน่งที่ใช้ลงนามเอกสารจริงในบริษัท หรือพิมพ์เองก็ได้ */}
            <Autocomplete
              freeSolo fullWidth size="small" options={SIGNER_POSITION_PRESETS}
              inputValue={form.signerPosition}
              onInputChange={(_, v) => set("signerPosition")(v)}
              renderInput={(params) => <TextField {...params} label="ตำแหน่ง" />}
            />
          </Stack>
          <Typography variant="caption" sx={{ display: "block", mt: 1.25, color: "text.disabled" }}>
            ออกในนาม {ISSUER.nameTh} · แนบตราประทับบริษัทให้อัตโนมัติ
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 2, borderTop: `1px solid ${BORDER_MAIN}`, gap: 1 }}>
        {missing.length > 0 && (
          <Chip
            size="small" label={`ยังไม่ได้กรอก: ${missing.join(" · ")}`}
            sx={{ mr: "auto", fontWeight: 700, bgcolor: alpha("#f59e0b", 0.15), color: "#b45309" }}
          />
        )}
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: "none" }}>ยกเลิก</Button>
        <Button
          onClick={() => handleIssue("download")} disabled={busy}
          startIcon={<Download sx={{ fontSize: 18 }} />}
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          ดาวน์โหลด
        </Button>
        <Button
          variant="contained" onClick={() => handleIssue("open")} disabled={busy}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdf sx={{ fontSize: 18 }} />}
          sx={{ textTransform: "none", fontWeight: 700, bgcolor: ACCENT, borderRadius: 2, "&:hover": { bgcolor: "#b91c1c" } }}
        >
          {busy ? "กำลังออกเอกสาร..." : "ออกเอกสาร"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeliveryNoteDialog;
