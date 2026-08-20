/**
 * BillingDialog.js — กล่องจัดการ "ใบวางบิล + การรับเงิน" ของงาน 1 ครั้ง
 *
 * ⚠️ ของกลาง — ใช้ทั้งหน้า "วางบิล / รับเงิน" (/billing) และหน้า "ภาพรวมงาน" (/contracts)
 * เดิมโค้ดชุดนี้อยู่ในหน้า /billing อย่างเดียว พอต้องกดจัดการจากตารางภาพรวมงานได้ด้วย ถ้าก๊อปไปอีกชุด
 * จะกลายเป็นฟอร์มการเงิน 2 ชุดที่ต้องแก้พร้อมกันตลอดไป (และวันหนึ่งจะลืมแก้ชุดหนึ่งแน่นอน)
 *
 * ⚠️ วางบิล "ต่อครั้งที่เข้างาน" — กล่องนี้จึงผูกกับ event 1 ตัวเสมอ ไม่ใช่ผูกกับสัญญาทั้งก้อน
 * ⚠️ ยอด VAT / หัก ณ ที่จ่าย / ยอดสุทธิ คำนวณที่ server เท่านั้น (ดู da-app-server/utils/billing.js)
 * ตัวเลขที่โชว์ในกล่องนี้ก่อนกดบันทึกเป็น "ตัวอย่าง" ล้วนๆ ไม่ได้ถูกส่งขึ้นไปเขียนทับ
 */
import { useEffect, useState } from "react";
import moment from "moment";
import {
  Box, Stack, Typography, TextField, InputAdornment, IconButton, Divider, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Tooltip, MenuItem, Chip,
  useMediaQuery, CircularProgress,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterMoment } from "@mui/x-date-pickers/AdapterMoment";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { Payments, AddCircleOutline, DeleteOutline, InsertDriveFile, AutoAwesome } from "@mui/icons-material";
import EventService from "@/shared/services/EventService";
import FilePreviewDialog from "@/features/documents/components/FilePreviewDialog";
import { isImageFile } from "@/shared/utils/jobDocTypes";
import { billingStatus, previewAmounts, paidTotal, baht, perRoundAmount, BILLING_STATE_META } from "@/shared/utils/billing";

const ACCENT = "#0891b2";
const TEXT_SUB = "#64748b";
const BORDER_MAIN = "#e2e8f0";
const SURFACE_SUBTLE = "#f8fafc";

/**
 * ✅ การ์ดครอบแต่ละส่วนของกล่อง — กล่องนี้มี "ฟอร์มอิสระ 2 ชุด" อยู่ในหน้าเดียว (ใบวางบิล กับ การรับเงิน)
 * ซึ่งแต่ละชุดมีปุ่มบันทึกของตัวเองคนละปุ่ม
 * 🐛 ที่แก้: เดิมทั้ง 2 ชุดเรียงต่อกันเป็นเนื้อเดียว คั่นด้วยหัวข้อตัวหนาเล็กๆ กับเส้นแบ่งบางๆ แล้วปุ่ม
 * บันทึกลอยอยู่กลางเนื้อหา ส่วนท้ายกล่องมีแค่ปุ่ม "ปิด" — คนใช้จึงแยกไม่ออกว่าปุ่มไหนบันทึกอะไร และ
 * เข้าใจผิดว่าปุ่มท้ายกล่องคือปุ่มบันทึกหลัก (กดปิดแล้วข้อมูลที่กรอกหาย)
 * ✅ ครอบเป็นการ์ดแยกใบ + วางปุ่มของแต่ละใบไว้มุมขวาล่างของใบตัวเอง = เห็นได้ทันทีว่าปุ่มนี้เป็นของ
 * ส่วนไหน ส่วนท้ายกล่องเหลือแค่ "ปิด" ซึ่งชัดว่าไม่ใช่การบันทึก
 */
/**
 * ✅ ช่องวันที่รูปแบบไทย (วว/ดด/ปปปป)
 * 🐛 ที่แก้: เดิมใช้ <input type="date"> ซึ่ง "รูปแบบที่แสดง" ถูกกำหนดโดย locale ของเบราว์เซอร์ล้วนๆ
 * แอปสั่งไม่ได้เลย (ไม่มี attribute/CSS ใดๆ ที่เปลี่ยนได้) — เครื่องที่ตั้ง locale เป็น en-US จึงเห็น
 * 08/19/2026 (เดือน/วัน/ปี) ซึ่งอ่านสลับกับที่คนไทยคุ้น และอันตรายมากกับเอกสารการเงิน เพราะวันที่อย่าง
 * 08/09 อ่านได้ 2 แบบโดยไม่มีอะไรบอกว่าอันไหนถูก
 * ✅ ใช้ DatePicker ของ MUI แทน ซึ่งบังคับรูปแบบได้จริงด้วย inputFormat และแสดงเหมือนกันทุกเครื่อง
 * ⚠️ state ยังเก็บเป็นสตริง "YYYY-MM-DD" เหมือนเดิมทุกประการ — ไม่แตะทั้งค่าที่ส่งขึ้น server และ
 * ตรรกะคำนวณวันครบกำหนด แค่เปลี่ยน "วิธีแสดง/วิธีรับ input" เท่านั้น
 * ⚠️ กันค่าไม่ถูกต้องระหว่างพิมพ์ — ผู้ใช้พิมพ์ค้างกลางทางได้เสมอ ถ้าไม่เช็ค isValid() จะได้สตริง
 * "Invalid date" หลุดเข้า state แล้วถูกส่งขึ้น server
 */
const ThaiDateField = ({ label, value, onChange, ...rest }) => (
  <DatePicker
    label={label}
    value={value ? moment(value, "YYYY-MM-DD") : null}
    onChange={(v) => onChange(v && v.isValid() ? v.format("YYYY-MM-DD") : "")}
    inputFormat="DD/MM/YYYY"
    renderInput={(params) => (
      <TextField
        {...params}
        size="small"
        fullWidth
        {...rest}
        inputProps={{ ...params.inputProps, placeholder: "วว/ดด/ปปปป" }}
      />
    )}
  />
);

const SectionCard = ({ title, caption, right, children, sx }) => (
  <Box sx={{ border: `1px solid ${BORDER_MAIN}`, borderRadius: 2.5, overflow: "hidden", ...sx }}>
    <Stack
      direction="row" alignItems="center" spacing={1}
      sx={{ px: 1.75, py: 1.1, bgcolor: SURFACE_SUBTLE, borderBottom: `1px solid ${BORDER_MAIN}` }}
    >
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontWeight: 800, fontSize: "0.85rem", lineHeight: 1.3 }}>{title}</Typography>
        {caption && <Typography variant="caption" sx={{ color: TEXT_SUB }}>{caption}</Typography>}
      </Box>
      {right}
    </Stack>
    <Box sx={{ p: 1.75 }}>{children}</Box>
  </Box>
);

// ⚠️ ห้ามเปลี่ยนรูปแบบวันที่ตรงนี้เป็น DD-MM-YYYY เด็ดขาด — นี่คือ "รูปแบบที่เก็บใน state/ส่งขึ้น server"
// ไม่ใช่รูปแบบที่แสดงบนจอ (รูปแบบที่แสดงคุมด้วย inputFormat ของ ThaiDateField ต่างหาก)
// ถ้าเก็บเป็น DD-MM-YYYY: moment("19-08-2026", "YYYY-MM-DD") จะได้ปี 2019 — ผิดแบบเงียบๆ ไม่ error
// และ moment("19-08-2026") ที่ใช้คำนวณวันครบกำหนดชำระจะได้ Invalid date
const emptyInvoice = () => ({
  invoiceNo: "", invoicedAt: moment().format("YYYY-MM-DD"),
  creditTermDays: 30, amountBeforeVat: "", vatRate: 7, whtRate: 3, note: "",
});
const emptyPayment = () => ({ amount: "", paidAt: moment().format("YYYY-MM-DD"), method: "", note: "" });

/**
 * ยอดตั้งต้นของ "ครั้งนี้"
 * ⚠️ ลำดับสำคัญ: แบ่งจากมูลค่าสัญญาก่อน → ถ้าแบ่งไม่ได้ (ไม่รู้จำนวนครั้ง/ไม่ได้กรอกมูลค่า) ค่อยใช้
 * ยอดใบเสนอราคาของงานครั้งนั้นตรงๆ ซึ่งเป็นยอดรายครั้งอยู่แล้ว → ไม่มีอะไรเลยก็ปล่อยว่างให้พิมพ์เอง
 * ⚠️ ห้าม fallback ไปที่ jobValue เต็มจำนวนเด็ดขาด — นั่นคือบั๊กที่กำลังแก้อยู่
 */
const defaultAmount = (event) => {
  const split = perRoundAmount(event.jobValue, event.visitCount, event.time);
  if (split !== null) return split;
  return event.quotationAmount || "";
};

/** ข้อความอธิบายว่ายอดตั้งต้นมาจากไหน — ไม่มีคำอธิบาย = คนกรอกไม่มีทางรู้ว่าเลขนี้เชื่อได้แค่ไหน */
const amountHint = (event) => {
  const rounds = Number(event.visitCount);
  const total = Number(event.jobValue);
  if (!Number.isFinite(total) || total <= 0) return "";
  if (!Number.isFinite(rounds) || rounds < 2) return `จากมูลค่างาน ${baht(total)}`;
  const isLast = Number(event.time) >= rounds;
  return `แบ่งจากมูลค่าสัญญา ${baht(total)} ÷ ${rounds} ครั้ง${isLast ? " (ครั้งสุดท้ายรับเศษ)" : ""}`;
};

/**
 * @param {object}   props.event     งาน 1 ครั้ง (event document) — null = ปิดกล่อง
 * @param {Function} props.onSaved   เรียกทุกครั้งที่บันทึกสำเร็จ พร้อม event ตัวใหม่จาก server
 *                                   (ผู้เรียกต้องเอาไปอัปเดต state ของตัวเอง กล่องนี้ไม่รู้จักที่มาของข้อมูล)
 */
export default function BillingDialog({ event, onClose, onSaved, subtitle }) {
  const isMobile = useMediaQuery("(max-width:900px)");
  const [form, setForm] = useState(emptyInvoice);
  const [payForm, setPayForm] = useState(emptyPayment);
  const [saving, setSaving] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [scanning, setScanning] = useState(null);      // fileId ที่กำลังอ่านอยู่
  const [scanResult, setScanResult] = useState(null);  // ผลที่ AI อ่านได้ (ยังไม่บันทึก)
  const [scanEnabled, setScanEnabled] = useState(false);
  const [error, setError] = useState("");

  // ⚠️ ต้อง reset ฟอร์มทุกครั้งที่เปลี่ยนงาน — ไม่งั้นเปิดงาน A แล้วปิด ไปเปิดงาน B จะเห็นยอดของ A
  // ค้างอยู่ในช่อง แล้วกดบันทึกทับงาน B ด้วยยอดผิดได้ทันที
  useEffect(() => {
    if (!event) return;
    const b = event.billing || {};
    setError("");
    setPayForm(emptyPayment());
    setForm(b.invoicedAt ? {
      invoiceNo: b.invoiceNo || "",
      invoicedAt: moment(b.invoicedAt).format("YYYY-MM-DD"),
      creditTermDays: b.creditTermDays ?? 30,
      amountBeforeVat: b.amountBeforeVat ?? "",
      vatRate: b.vatRate ?? 7,
      whtRate: b.whtRate ?? 3,
      note: b.note || "",
    } : {
      ...emptyInvoice(),
      // ✅ เติมยอดตั้งต้นให้เป็น "ยอดของครั้งนี้" ไม่ใช่มูลค่าทั้งสัญญา
      // 🐛 BUG ที่แก้: เดิมเติม jobValue เต็มจำนวน — สัญญา PM 500,000 บาท 4 ครั้ง จะขึ้น 500,000
      // ในช่องยอดของ "ครั้งที่ 1" ซึ่งผิดไป 4 เท่า และผิดแบบที่กดบันทึกผ่านได้ง่ายมากเพราะตัวเลข
      // ที่เห็นดูคุ้นตา (เป็นมูลค่าสัญญาที่กรอกไว้เอง) — ต้องหารด้วยจำนวนครั้งทั้งหมดก่อนเสมอ
      amountBeforeVat: defaultAmount(event),
    });
  }, [event]);

  // ⚠️ ถามเซิร์ฟเวอร์ว่าเปิดใช้ AI ไว้ไหม แล้วซ่อนปุ่มถ้าไม่ได้เปิด — ดีกว่าให้กดแล้วเจอ error
  // (ฟีเจอร์นี้ต้องมี ANTHROPIC_API_KEY ที่เซิร์ฟเวอร์ ซึ่งบางสภาพแวดล้อมอาจไม่ได้ตั้ง)
  useEffect(() => {
    let alive = true;
    EventService.BillingScanAvailability()
      .then((r) => { if (alive) setScanEnabled(Boolean(r?.enabled)); })
      .catch(() => { if (alive) setScanEnabled(false); });
    return () => { alive = false; };
  }, []);

  const run = async (fn) => {
    setSaving(true); setError("");
    try {
      const res = await fn();
      onSaved?.(res.event);
      return true;
    } catch (err) {
      setError(err?.response?.data?.message || "บันทึกไม่สำเร็จ");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveInvoice = () => run(() => EventService.SaveBilling(event._id, {
    ...form, amountBeforeVat: Number(form.amountBeforeVat),
  }));

  const addPayment = async () => {
    const ok = await run(() => EventService.AddPayment(event._id, { ...payForm, amount: Number(payForm.amount) }));
    if (ok) setPayForm(emptyPayment());
  };

  const removePayment = (paymentId) => run(() => EventService.DeletePayment(event._id, paymentId));

  /**
   * ให้ AI อ่านยอดจากรูป แล้ว "เติมลงฟอร์ม" ให้ตรวจ — ไม่บันทึกเอง
   * ⚠️ เติมเฉพาะช่องที่ AI อ่านได้จริงเท่านั้น ช่องที่อ่านไม่ได้ต้องคงค่าเดิมไว้ ไม่ใช่ล้างเป็นศูนย์/ว่าง
   * ทับของที่คนพิมพ์ไว้แล้ว (เคสที่เจอบ่อย: อ่านยอดได้แต่เลขที่บิลเบลอ)
   */
  const scanInvoice = async (file) => {
    setScanning(file._id); setError(""); setScanResult(null);
    try {
      const { result } = await EventService.ScanInvoice(event._id, file._id);
      setScanResult(result);
      if (result?.found) {
        setForm((f) => ({
          ...f,
          invoiceNo: result.invoiceNo || f.invoiceNo,
          invoicedAt: result.invoicedAt || f.invoicedAt,
          amountBeforeVat: result.amountBeforeVat > 0 ? result.amountBeforeVat : f.amountBeforeVat,
          vatRate: Number.isFinite(result.vatRate) ? result.vatRate : f.vatRate,
          whtRate: Number.isFinite(result.whtRate) ? result.whtRate : f.whtRate,
        }));
      }
    } catch (err) {
      setError(err?.response?.data?.message || "อ่านรูปไม่สำเร็จ");
    } finally {
      setScanning(null);
    }
  };

  if (!event) return null;

  // ⚠️ ช่างอัปโหลดผ่านหน้าการดำเนินงานด้วย type="invoice" → เก็บลง invoiceFiles (ดู models/Events.js)
  const attachments = event.invoiceFiles || [];
  // โชว์เฉพาะตอนยังไม่เคยวางบิล — ใบที่บันทึกไปแล้วยอดมาจากของจริง ไม่ใช่ค่าที่ระบบแบ่งให้
  const hint = event.billing?.invoicedAt ? "" : amountHint(event);

  const st = billingStatus(event.billing);
  const meta = BILLING_STATE_META[st.state];
  const preview = previewAmounts({
    amountBeforeVat: form.amountBeforeVat, vatRate: form.vatRate, whtRate: form.whtRate,
  });

  // ✅ วันครบกำหนดชำระ = วันที่วางบิล + เครดิตเทอม — คำนวณสดจากค่าที่กรอกอยู่ ให้เห็นผลทันทีตอนแก้
  // เครดิตเทอม (ไม่ต้องบันทึกก่อนถึงจะรู้) ⚠️ วันที่/เครดิตเทอมอาจยังกรอกไม่ครบระหว่างพิมพ์ ต้องเช็ค
  // isValid() ก่อนเสมอ ไม่งั้นจะโชว์ "Invalid date" ให้คนใช้เห็นกลางกล่องการเงิน
  const dueDateLabel = (() => {
    const base = moment(form.invoicedAt);
    const term = Number(form.creditTermDays);
    if (!base.isValid() || !Number.isFinite(term) || term < 0) return "";
    return base.clone().add(term, "days").format("D MMM YYYY");
  })();

  return (
    <Dialog open onClose={() => !saving && onClose?.()} fullWidth maxWidth="sm" fullScreen={isMobile}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.25 }}>
          <Typography sx={{ fontWeight: 800, fontSize: "1rem", minWidth: 0 }} noWrap>
            {event.company || "ไม่ระบุลูกค้า"}
          </Typography>
          <Chip
            size="small" label={st.label}
            sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700, bgcolor: alpha(meta.color, 0.12), color: meta.color }}
          />
        </Stack>
        <Typography variant="caption" sx={{ color: TEXT_SUB }}>
          {subtitle || [event.site, event.title, event.time ? `ครั้งที่ ${event.time}` : ""].filter(Boolean).join(" · ")}
        </Typography>
      </DialogTitle>

      {/* ⚠️ DatePicker ของ MUI ต้องอยู่ใน LocalizationProvider เสมอ ไม่งั้นพังตอน render */}
      <LocalizationProvider dateAdapter={AdapterMoment}>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* ── ใบวางบิลที่ช่างแนบมาจากหน้าการดำเนินงาน ───────────────────────────
            ✅ ไฟล์ชุดนี้มีอยู่ในระบบอยู่แล้ว (ช่างอัปโหลดผ่านหน้า "การดำเนินงาน" ช่อง "ใบวางบิล")
            แต่เดิมดูได้จากหน้านั้นที่เดียว — คนกรอกยอดวางบิลต้องเปิด 2 หน้าคู่กันเพื่อดูรูปแล้วพิมพ์ยอดตาม
            ✅ ยกมาไว้ในกล่องนี้เลย จะได้ดูรูปกับกรอกยอดอยู่ที่เดียวกัน */}
        {attachments.length > 0 && (
          <SectionCard
            sx={{ mb: 2 }}
            title={`ใบวางบิลที่แนบมา (${attachments.length})`}
            caption="กดที่รูปเพื่อดูขนาดเต็ม แล้วกรอกยอดตามใบจริง"
          >
            <Stack direction="row" spacing={1} sx={{ overflowX: "auto", pb: 0.5 }}>
              {attachments.map((f) => {
                const isImage = isImageFile(f);
                return (
                  <Box key={f._id || f.fileUrl} sx={{ flexShrink: 0, width: 96 }}>
                    <Box
                      onClick={() => setPreviewFile(f)}
                      sx={{
                        width: 96, height: 96, borderRadius: 2, overflow: "hidden", cursor: "pointer",
                        border: "1px solid", borderColor: "divider", bgcolor: alpha("#0f172a", 0.03),
                        display: "flex", alignItems: "center", justifyContent: "center",
                        "&:hover": { borderColor: ACCENT },
                      }}
                    >
                      {isImage
                        ? <Box component="img" src={f.fileUrl} alt={f.fileName} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <InsertDriveFile sx={{ fontSize: 34, color: TEXT_SUB }} />}
                    </Box>
                    <Typography variant="caption" sx={{ display: "block", color: TEXT_SUB, mt: 0.25 }} noWrap>
                      {f.fileName || "ไฟล์แนบ"}
                    </Typography>
                    {/* ✅ ให้ AI อ่านยอดจากรูปมาเติมในฟอร์ม — เฉพาะไฟล์รูป (PDF อ่านไม่ได้)
                        ⚠️ ปุ่มโผล่เฉพาะเมื่อเซิร์ฟเวอร์เปิดใช้งานไว้จริง ไม่งั้นกดแล้วเจอ error เปล่าๆ */}
                    {scanEnabled && isImage && !event.billing?.invoicedAt && (
                      <Button
                        size="small" fullWidth disabled={Boolean(scanning) || saving}
                        onClick={() => scanInvoice(f)}
                        startIcon={scanning === f._id
                          ? <CircularProgress size={11} thickness={6} />
                          : <AutoAwesome sx={{ fontSize: 13 }} />}
                        sx={{ mt: 0.25, textTransform: "none", fontSize: "0.63rem", fontWeight: 700, py: 0.1, minHeight: 0, color: "#8b5cf6" }}
                      >
                        {scanning === f._id ? "กำลังอ่าน..." : "AI อ่านยอด"}
                      </Button>
                    )}
                  </Box>
                );
              })}
            </Stack>
          </SectionCard>
        )}

        {/* ⚠️ ผลจาก AI เป็น "ข้อเสนอให้ตรวจ" ไม่ใช่ค่าที่บันทึกแล้ว — ต้องบอกให้ชัดที่สุดเท่าที่ทำได้
            เพราะเป็นตัวเลขการเงินที่ถ้าผิดแล้วออกใบกำกับภาษี/แจ้งลูกค้าไปแล้วตามแก้ยากมาก
            ⚠️ ใช้ severity ตามความมั่นใจที่โมเดลบอกมา ไม่ใช่ success เสมอ — "อ่านได้" กับ "อ่านได้ถูก"
            คนละเรื่องกัน การขึ้นแถบเขียวทุกครั้งจะทำให้คนเลิกตรวจภายในไม่กี่ครั้ง */}
        {scanResult && (
          <Alert
            severity={!scanResult.found ? "warning" : scanResult.confidence === "high" ? "info" : "warning"}
            onClose={() => setScanResult(null)}
            sx={{ mb: 2, "& .MuiAlert-message": { width: "100%" } }}
          >
            {!scanResult.found ? (
              <Typography variant="body2">อ่านใบวางบิลจากรูปนี้ไม่ได้ — กรุณากรอกยอดเอง{scanResult.note ? ` (${scanResult.note})` : ""}</Typography>
            ) : (
              <>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  AI เติมยอดให้แล้ว — <u>ต้องตรวจกับรูปก่อนกดบันทึกทุกครั้ง</u>
                </Typography>
                <Typography variant="caption" sx={{ display: "block", mt: 0.25 }}>
                  ความมั่นใจ: {{ high: "สูง", medium: "ปานกลาง", low: "ต่ำ" }[scanResult.confidence] || scanResult.confidence}
                  {scanResult.note ? ` · ${scanResult.note}` : ""}
                </Typography>
              </>
            )}
          </Alert>
        )}

        <SectionCard
          title="ข้อมูลใบวางบิล"
          caption="กรอกยอดก่อน VAT แล้วระบบจะคำนวณยอดที่ลูกค้าต้องโอนให้"
        >
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.25, mb: 1.5 }}>
          <TextField size="small" label="เลขที่ใบวางบิล" value={form.invoiceNo}
            onChange={(e) => setForm((f) => ({ ...f, invoiceNo: e.target.value }))} />
          <ThaiDateField label="วันที่วางบิล" value={form.invoicedAt}
            onChange={(v) => setForm((f) => ({ ...f, invoicedAt: v }))} />
          <TextField size="small" type="number" label="ยอดก่อน VAT" value={form.amountBeforeVat}
            onChange={(e) => setForm((f) => ({ ...f, amountBeforeVat: e.target.value }))}
            helperText={hint}
            FormHelperTextProps={{ sx: { fontSize: "0.65rem", mx: 0 } }}
            InputProps={{ startAdornment: <InputAdornment position="start">฿</InputAdornment> }} />
          <TextField size="small" type="number" label="เครดิตเทอม (วัน)" value={form.creditTermDays}
            onChange={(e) => setForm((f) => ({ ...f, creditTermDays: e.target.value }))} />
          <TextField select size="small" label="VAT" value={form.vatRate}
            onChange={(e) => setForm((f) => ({ ...f, vatRate: e.target.value }))}>
            <MenuItem value={7}>7%</MenuItem>
            <MenuItem value={0}>ไม่คิด VAT</MenuItem>
          </TextField>
          <TextField select size="small" label="ภาษีหัก ณ ที่จ่าย" value={form.whtRate}
            onChange={(e) => setForm((f) => ({ ...f, whtRate: e.target.value }))}>
            <MenuItem value={3}>3% (งานบริการ)</MenuItem>
            <MenuItem value={1}>1%</MenuItem>
            <MenuItem value={0}>ไม่หัก</MenuItem>
          </TextField>
        </Box>

        {/* ✅ ตัวอย่างยอด — ให้เห็นยอดที่ลูกค้าต้องโอนจริงก่อนกดบันทึก (ค่าจริงคำนวณใหม่ที่ server)
            ✅ จัดลำดับสายตาใหม่: รายการย่อย (ยอดก่อน VAT / VAT / หัก ณ ที่จ่าย) เป็นตัวเล็กสีจาง
            ส่วน "ยอดที่ลูกค้าต้องโอน" เป็นตัวเลขใหญ่ — เดิมทั้ง 4 บรรทัดขนาดพอๆ กัน ต้องไล่อ่านทีละ
            บรรทัดกว่าจะรู้ว่าตกลงต้องเก็บเงินเท่าไหร่ ทั้งที่เป็นข้อมูลชิ้นเดียวที่คนเปิดกล่องนี้มาหา */}
        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(ACCENT, 0.06), border: `1px solid ${alpha(ACCENT, 0.2)}`, mb: 1.5 }}>
          <Stack spacing={0.35}>
            {[
              { k: "ยอดก่อน VAT", v: baht(preview.amountBeforeVat) },
              { k: `VAT ${form.vatRate}%`, v: `+${baht(preview.vatAmount)}` },
              { k: `หัก ณ ที่จ่าย ${form.whtRate}%`, v: `−${baht(preview.whtAmount)}` },
            ].map((r) => (
              <Stack key={r.k} direction="row" justifyContent="space-between">
                <Typography variant="caption" sx={{ color: TEXT_SUB }}>{r.k}</Typography>
                <Typography variant="caption" sx={{ color: TEXT_SUB, fontVariantNumeric: "tabular-nums" }}>{r.v}</Typography>
              </Stack>
            ))}
          </Stack>
          <Divider sx={{ my: 1 }} />
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
            <Typography sx={{ fontWeight: 800, fontSize: "0.85rem" }}>ยอดที่ลูกค้าต้องโอน</Typography>
            <Typography sx={{ fontWeight: 800, fontSize: "1.35rem", color: ACCENT, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
              {baht(preview.netAmount)}
            </Typography>
          </Stack>
          {/* ✅ วันครบกำหนดชำระ — คำนวณจากวันที่วางบิล + เครดิตเทอมที่กรอกไว้ เดิมกรอกเครดิตเทอม 30 วัน
              แล้วต้องไปนับปฏิทินเองว่าครบกำหนดวันไหน ทั้งที่เป็นคำถามแรกที่คนตามเก็บเงินต้องตอบ */}
          {dueDateLabel && (
            <Typography variant="caption" sx={{ display: "block", textAlign: "right", color: TEXT_SUB, mt: 0.25 }}>
              ครบกำหนดชำระ {dueDateLabel}
            </Typography>
          )}
        </Box>

        <TextField fullWidth size="small" label="หมายเหตุ" value={form.note} multiline minRows={1}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />

        {/* ปุ่มบันทึกของ "ส่วนใบวางบิล" — อยู่มุมขวาล่างของการ์ดตัวเอง ไม่ปนกับปุ่มของส่วนรับเงิน */}
        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.5 }}>
          <Button variant="contained" onClick={saveInvoice} disabled={saving || !form.amountBeforeVat}
            sx={{ bgcolor: ACCENT, textTransform: "none", fontWeight: 700, borderRadius: 2, px: 2.5, "&:hover": { bgcolor: "#0e7490" } }}>
            {saving ? "กำลังบันทึก..." : event.billing?.invoicedAt ? "อัปเดตใบวางบิล" : "บันทึกการวางบิล"}
          </Button>
        </Stack>
        </SectionCard>

        {/* ⚠️ ส่วนรับเงินโผล่หลังวางบิลแล้วเท่านั้น — ก่อนหน้านั้นไม่มียอดให้เทียบว่าครบหรือยัง
            (ฝั่ง server ก็ปฏิเสธด้วย 409 ไม่ได้พึ่งการซ่อนปุ่มอย่างเดียว) */}
        {st.state !== "not_invoiced" && (
          <SectionCard
            sx={{ mt: 2 }}
            title="การรับเงิน"
            caption={`รับแล้ว ${baht(paidTotal(event.billing))} จาก ${baht(st.net)}`}
            right={st.outstanding > 0 ? (
              // ✅ ยอดค้างเป็นป้ายสีแยกออกมา ไม่ใช่ข้อความต่อท้ายบรรทัดเดียวกับยอดที่รับแล้ว —
              // เป็นตัวเลขที่ต้องตามเก็บ ควรสะดุดตาต่างจากตัวเลขที่จบไปแล้ว
              <Chip
                size="small" label={`ค้าง ${baht(st.outstanding)}`}
                sx={{ height: 22, fontWeight: 800, fontSize: "0.7rem", bgcolor: alpha("#dc2626", 0.1), color: "#dc2626" }}
              />
            ) : (
              <Chip
                size="small" label="รับครบแล้ว"
                sx={{ height: 22, fontWeight: 800, fontSize: "0.7rem", bgcolor: alpha("#10b981", 0.12), color: "#059669" }}
              />
            )}
          >
            <Stack spacing={0.5} sx={{ mb: 1.5 }}>
              {(event.billing?.payments || []).map((p) => (
                <Stack key={p._id} direction="row" alignItems="center" spacing={1}
                  sx={{ p: 0.9, borderRadius: 2, bgcolor: alpha("#10b981", 0.06) }}>
                  <Payments sx={{ fontSize: 15, color: "#10b981" }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: "0.82rem" }}>{baht(p.amount)}</Typography>
                    <Typography variant="caption" sx={{ color: TEXT_SUB }}>
                      {moment(p.paidAt).format("DD/MM/YYYY")}{p.method ? ` · ${p.method}` : ""}{p.recordedByName ? ` · บันทึกโดย ${p.recordedByName}` : ""}
                    </Typography>
                  </Box>
                  <Tooltip title="ลบรายการนี้">
                    <span>
                      <IconButton size="small" disabled={saving} onClick={() => removePayment(p._id)}>
                        <DeleteOutline sx={{ fontSize: 16 }} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              ))}
              {(event.billing?.payments || []).length === 0 && (
                <Typography variant="body2" sx={{ color: TEXT_SUB }}>ยังไม่มีการรับเงิน</Typography>
              )}
            </Stack>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.25, mb: 1 }}>
              <TextField size="small" type="number" label="ยอดรับ" value={payForm.amount}
                onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
                InputProps={{ startAdornment: <InputAdornment position="start">฿</InputAdornment> }} />
              <ThaiDateField label="วันที่รับเงิน" value={payForm.paidAt}
                onChange={(v) => setPayForm((f) => ({ ...f, paidAt: v }))} />
              <TextField size="small" label="ช่องทาง (เช่น โอน / เช็ค)" value={payForm.method}
                onChange={(e) => setPayForm((f) => ({ ...f, method: e.target.value }))} />
              <TextField size="small" label="หมายเหตุ" value={payForm.note}
                onChange={(e) => setPayForm((f) => ({ ...f, note: e.target.value }))} />
            </Box>
            {/* ปุ่มบันทึกของ "ส่วนรับเงิน" — มุมขวาล่างของการ์ดตัวเอง คู่ขนานกับปุ่มของส่วนใบวางบิล
                ⚠️ ใช้สีเขียว (รับเงิน) ต่างจากสีฟ้า (วางบิล) โดยตั้งใจ — เป็นคนละการกระทำที่ย้อนกลับ
                คนละแบบ ถ้าสีเหมือนกันจะกดสลับกันได้ง่ายมากเวลารีบ */}
            <Stack direction="row" justifyContent="flex-end">
              <Button variant="contained" startIcon={<AddCircleOutline sx={{ fontSize: 17 }} />} onClick={addPayment}
                disabled={saving || !payForm.amount}
                sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, px: 2.5, bgcolor: "#10b981", "&:hover": { bgcolor: "#059669" } }}>
                บันทึกรับเงิน
              </Button>
            </Stack>
          </SectionCard>
        )}
      </DialogContent>
      </LocalizationProvider>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={() => onClose?.()} disabled={saving} sx={{ textTransform: "none" }}>ปิด</Button>
      </DialogActions>

      {/* ✅ ตัวดูไฟล์เป็นของกลาง (features/documents/components/FilePreviewDialog.js) — ตัวเดียวกับที่
          กล่องเอกสารของงานใช้ ไม่ได้เขียนแยกกัน 2 ชุด */}
      <FilePreviewDialog
        file={previewFile}
        caption="ใบวางบิลที่ช่างแนบมา"
        onClose={() => setPreviewFile(null)}
      />
    </Dialog>
  );
}
