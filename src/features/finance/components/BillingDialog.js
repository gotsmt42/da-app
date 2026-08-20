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
import { useEffect, useRef, useState } from "react";
import moment from "moment";
import {
  Box, Stack, Typography, TextField, InputAdornment, IconButton, Divider, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Tooltip, MenuItem, Chip,
  useMediaQuery, CircularProgress,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import {
  Payments, AddCircleOutline, DeleteOutline, InsertDriveFile, AutoAwesome,
  AttachFile, Close, ReceiptLong,
} from "@mui/icons-material";
import EventService from "@/shared/services/EventService";
import FilePreviewDialog from "@/features/documents/components/FilePreviewDialog";
import { isImageFile } from "@/shared/utils/jobDocTypes";
import { billingStatus, previewAmounts, paidTotal, baht, perRoundAmount, BILLING_STATE_META } from "@/shared/utils/billing";
import { formatThai } from "@/shared/utils/thaiDate";

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
// ⚠️ ช่องวันที่ของกล่องนี้เคยเป็น DatePicker เฉพาะของตัวเอง (ค.ศ.) — ย้ายมาใช้ตัวกลาง
// ThaiDatePicker ที่เป็น พ.ศ. ทั้งปฏิทิน เพื่อให้เหมือนกันทั้งแอป
const ThaiDateField = ThaiDatePicker;

/**
 * ✅ accent — สีประจำส่วน ใช้แยกว่า "ใบวางบิล" (ฟ้า) กับ "การรับเงิน" (เขียว) คนละเรื่องกัน
 * ทั้งสองส่วนเป็นฟอร์มอิสระที่มีปุ่มบันทึกของตัวเอง ถ้าหน้าตาเหมือนกันหมดจะกดสลับกันได้ง่ายมากเวลารีบ
 * (สีเดียวกับปุ่มบันทึกของส่วนนั้นๆ — แถบหัวการ์ดกับปุ่มจึงอ่านเป็นชุดเดียวกัน)
 */
const SectionCard = ({ title, caption, right, children, sx, accent }) => (
  <Box
    sx={{
      border: `1px solid ${accent ? alpha(accent, 0.28) : BORDER_MAIN}`,
      borderRadius: 2.5, overflow: "hidden", ...sx,
    }}
  >
    <Stack
      direction="row" alignItems="center" spacing={1}
      sx={{
        px: 1.75, py: 1.1,
        bgcolor: accent ? alpha(accent, 0.07) : SURFACE_SUBTLE,
        borderBottom: `1px solid ${accent ? alpha(accent, 0.22) : BORDER_MAIN}`,
      }}
    >
      {/* แถบสีบางๆ ด้านซ้าย — จุดยึดสายตาว่ากำลังอยู่ส่วนไหน โดยไม่ต้องระบายสีทั้งหัวการ์ดจนแสบตา */}
      {accent && <Box sx={{ width: 3, alignSelf: "stretch", borderRadius: 3, bgcolor: accent, flexShrink: 0 }} />}
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
const emptyPayment = () => ({
  amount: "", paidAt: moment().format("YYYY-MM-DD"), method: "", note: "",
  receiptNo: "",
  // ไฟล์สลิป/ใบเสร็จที่เลือกไว้ (ยังไม่อัปโหลด) — อัปพร้อมกับตอนกดบันทึกรับเงินในคำขอเดียว
  slip: null,
});

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
  // ⚠️ ใช้ ref + .click() แทน <Button component="label"> ที่ครอบ <input hidden> — วิธี label ใช้ได้
  // ในหลายเบราว์เซอร์แต่ไม่รับประกัน โดยเฉพาะเมื่อ MUI ห่อ children ด้วย span หลายชั้น
  // การสั่ง .click() ที่ input โดยตรงคือทางที่คุมได้แน่นอนที่สุด
  const newSlipInputRef = useRef(null);
  const rowSlipInputRef = useRef(null);
  const invoiceInputRef = useRef(null);
  // ไฟล์ใบวางบิลที่กดลบไว้แล้วรอยืนยัน — ยืนยันในตัวการ์ดเอง ไม่เปิด modal ซ้อน modal
  const [confirmDeleteFileId, setConfirmDeleteFileId] = useState(null);
  const [slipTargetId, setSlipTargetId] = useState(null);   // รายการรับเงินที่กำลังจะแนบไฟล์ให้
  const [editingReceiptId, setEditingReceiptId] = useState(null);
  const [receiptDraft, setReceiptDraft] = useState("");
  // คำบรรยายใต้ตัวพรีวิว — กล่องนี้เปิดดูได้ทั้งใบวางบิลและสลิปรับเงิน ต้องบอกให้ตรงว่ากำลังดูอะไร
  const [previewCaption, setPreviewCaption] = useState("");
  const [scanning, setScanning] = useState(null);      // fileId ที่กำลังอ่านอยู่
  const [scanResult, setScanResult] = useState(null);  // ผลที่ AI อ่านได้ (ยังไม่บันทึก)
  const [scanEnabled, setScanEnabled] = useState(false);
  const [error, setError] = useState("");

  // ⚠️ ต้อง reset ฟอร์มทุกครั้งที่เปลี่ยนงาน — ไม่งั้นเปิดงาน A แล้วปิด ไปเปิดงาน B จะเห็นยอดของ A
  // ค้างอยู่ในช่อง แล้วกดบันทึกทับงาน B ด้วยยอดผิดได้ทันที
  //
  // 🐛 ที่แก้: เดิมผูกกับ [event] ทั้งก้อน = reset ทุกครั้งที่ object เปลี่ยน identity ซึ่งเกิดขึ้น
  // ทุกครั้งที่ onSaved ยิงกลับมา (หน้า /billing ทำ setTarget(updated) ด้วย) — พอแนบไฟล์ระหว่างที่
  // ยังพิมพ์ยอดค้างอยู่ ฟอร์มจะถูกล้างกลับเป็นค่าจาก server ทันที ยอดที่พิมพ์ไปแล้วหายทั้งหมด
  // ✅ ผูกกับ event._id แทน = reset เฉพาะตอนสลับไปงานคนละงานจริงๆ ตามเจตนาเดิมของโค้ดชุดนี้
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?._id]);

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
    // ⚠️ เช็คซ้ำตรงนี้ด้วย ไม่พึ่งการ disable ปุ่มอย่างเดียว — ปุ่มที่ถูก disable ยังถูกกดผ่าน
    // keyboard/เครื่องมือ dev ได้ และตัวเลขการเงินที่ผิดแก้ย้อนหลังยาก (ออกใบกำกับภาษีไปแล้ว)
    // ⚠️ ฝั่ง server ก็ปฏิเสธด้วย 409 เช่นกัน — ตรงนี้มีไว้ให้ผู้ใช้เห็นสาเหตุทันทีโดยไม่ต้องรอ round-trip
    const amount = Number(payForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return setError("ยอดรับต้องมากกว่า 0");
    }
    if (amount - st.outstanding > 0.005) {
      return setError(
        `รับเงินเกินยอดที่ค้างอยู่ไม่ได้ — ค้าง ${baht(st.outstanding)} แต่กรอก ${baht(amount)}`
      );
    }
    const ok = await run(() => EventService.AddPayment(event._id, { ...payForm, amount }));
    if (ok) setPayForm(emptyPayment());
  };

  const removePayment = (paymentId) => run(() => EventService.DeletePayment(event._id, paymentId));

  /**
   * ✅ แนบสลิป / แก้เลขที่ใบเสร็จ ให้ "รายการที่บันทึกไปแล้ว"
   *
   * 🐛 ที่แก้: เดิมแนบได้เฉพาะตอนกดบันทึกรับเงินครั้งแรก — แต่ของจริงเงินเข้าวันนี้ ใบเสร็จออกทีหลัง
   * พอบิลนั้นรับครบแล้วจะบันทึกรายการใหม่ไม่ได้อีก (ติดกฎห้ามรับเกิน) เท่ากับแนบหลักฐานย้อนหลัง
   * ไม่ได้เลย — เป็นอาการที่เห็นเป็น "แนบไฟล์แล้วไม่มีอะไรเกิดขึ้น"
   */
  const attachSlipToPayment = (paymentId, file) =>
    run(() => EventService.UpdatePayment(event._id, paymentId, { slip: file }));

  /**
   * ✅ แนบไฟล์ใบวางบิลได้จากในกล่องนี้เลย (เดิมแนบได้จากหน้า "การดำเนินงาน" ที่เดียว)
   *
   * ⚠️ ใช้ route อัปโหลดไฟล์ตัวกลาง (PUT /events/upload/:id + type="invoice") ตัวเดียวกับที่หน้า
   * การดำเนินงานใช้ ไม่ได้เขียน route ใหม่ — ไฟล์จึงลงที่ invoiceFiles ชุดเดียวกัน เห็นตรงกันทุกหน้า
   * ⚠️ route นี้คืนมาแค่ข้อมูลไฟล์ ไม่ได้คืน event ทั้งก้อน จึงต้องต่อ array เองแล้วส่งให้ onSaved
   * (ถูกกว่าการยิง GET ซ้ำอีกรอบ และหน้าที่เรียกก็อัปเดตตัวนับเอกสารของตัวเองได้ทันที)
   */
  const uploadInvoiceFile = async (file) => {
    setSaving(true); setError("");
    try {
      const saved = await EventService.Upload(event._id, file, "invoice");
      onSaved?.({
        ...event,
        invoiceFiles: [
          ...(event.invoiceFiles || []),
          { _id: saved.fileId, fileName: saved.fileName, fileUrl: saved.fileUrl, fileType: saved.fileType },
        ],
      });
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "อัปโหลดไฟล์ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const removeInvoiceFile = async (fileId) => {
    setSaving(true); setError("");
    try {
      await EventService.DeleteFile(event._id, "invoice", fileId);
      onSaved?.({
        ...event,
        invoiceFiles: (event.invoiceFiles || []).filter((f) => String(f._id) !== String(fileId)),
      });
      setConfirmDeleteFileId(null);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "ลบไฟล์ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const saveReceiptNo = async (paymentId) => {
    const ok = await run(() => EventService.UpdatePayment(event._id, paymentId, { receiptNo: receiptDraft.trim() }));
    if (ok) setEditingReceiptId(null);
  };

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

  /**
   * ✅ ตรวจยอดรับเงินก่อนให้กดบันทึก — "ห้ามรับเกินยอดที่ค้างอยู่"
   *
   * 🐛 เดิมช่องนี้พิมพ์เลขอะไรลงไปก็ได้ กดบันทึกผ่านหมด (ทั้งฝั่งจอและฝั่ง server เช็คแค่ว่า > 0)
   * บิล 104,000 พิมพ์ 1,040,000 ตกหล่นศูนย์เกินไปหนึ่งตัวก็บันทึกเข้าไปเลย → ยอดรับรวมเกินยอดบิล
   * → สถานะกลายเป็น "ชำระครบ" ทั้งที่ตัวเลขผิด และรายงานการเงินทั้งระบบเพี้ยนตาม
   *
   * ⚠️ เผื่อ 0.005 เพราะยอดสุทธิผ่านการปัดทศนิยม (round2) มาแล้ว — ถ้าเทียบ > ตรงๆ ยอดที่เท่ากัน
   * เป๊ะอาจถูกมองว่าเกินเพราะความคลาดเคลื่อนของเลขทศนิยม แล้วกดจ่ายเต็มจำนวนไม่ได้เลย
   */
  const outstanding = st.outstanding;
  const isSettled = st.state !== "not_invoiced" && outstanding <= 0;
  const payAmount = Number(payForm.amount);
  const hasPayAmount = payForm.amount !== "" && Number.isFinite(payAmount);
  const payOverpaid = hasPayAmount && payAmount - outstanding > 0.005;
  const payNotPositive = hasPayAmount && payAmount <= 0;
  const payInvalid = !hasPayAmount || payOverpaid || payNotPositive;

  /** เติมยอดคงเหลือลงช่องให้ในคลิกเดียว — เคสที่ใช้บ่อยที่สุดคือลูกค้าโอนมาเต็มจำนวน */
  const fillOutstanding = () => setPayForm((f) => ({ ...f, amount: String(outstanding) }));

  /**
   * ⚠️ โชว์ข้อความใต้ช่อง "เฉพาะตอนกรอกผิด" เท่านั้น
   * เดิมโชว์ "รับได้สูงสุด ฿X" ค้างไว้ตลอด ซึ่ง (1) ซ้ำกับยอดคงเหลือที่อยู่บนหัวการ์ดอยู่แล้ว และ
   * (2) ทำให้ช่อง "ยอดรับ" สูงกว่าช่อง "วันที่รับเงิน" ที่อยู่ข้างกัน แถวของฟอร์มเลยเหลื่อมกันทั้งบล็อก
   * ตอนไม่มี error ทุกช่องจึงสูงเท่ากันหมด ฟอร์มอ่านเป็นตารางเดียวกัน
   */
  const payHelperText = payOverpaid
    ? `เกินยอดคงเหลือ ${baht(outstanding)} อยู่ ${baht(payAmount - outstanding)}`
    : payNotPositive
      ? "ยอดรับต้องมากกว่า 0"
      : "";
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
    return formatThai(base.clone().add(term, "days"), "D MMM YYYY");
  })();

  // 🐛 ที่แก้: เดิม maxWidth="sm" (600px) ทุกขนาดจอ — เนื้อหามี 3 ส่วน (ไฟล์แนบ / ข้อมูลใบวางบิล /
  // การรับเงิน) ต่อกันลงมาในคอลัมน์แคบๆ ทำให้ต้องเลื่อนขึ้นลงตลอดเวลาที่กรอก และบนจอคอมก็เหลือ
  // พื้นที่ว่างสองข้างเปล่าๆ — ขยายเป็น lg แล้วจัด 2 คอลัมน์บนจอกว้าง (ดูด้านล่าง) ให้เห็นครบในจอเดียว
  return (
    <Dialog open onClose={() => !saving && onClose?.()} fullWidth maxWidth="lg" fullScreen={isMobile}>
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

      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* ✅ จอกว้างแบ่ง 2 คอลัมน์: ซ้าย = ไฟล์แนบ + ข้อมูลใบวางบิล (สิ่งที่ต้อง "อ่านแล้วกรอก")
            ขวา = การรับเงิน (สิ่งที่ทำทีหลัง) — เป็นลำดับการทำงานจริง และเห็นครบโดยไม่ต้องเลื่อน
            จอแคบเรียงลงมาคอลัมน์เดียวเหมือนเดิม
            ⚠️ alignItems: start — ไม่ให้การ์ดฝั่งที่สั้นกว่ายืดสูงตามอีกฝั่งจนมีที่ว่างข้างในเยอะผิดปกติ */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) minmax(0, 1fr)" },
            gap: 2,
            alignItems: "start",
          }}
        >
          <Box sx={{ minWidth: 0 }}>

        {/* ── ไฟล์ใบวางบิล ─────────────────────────────────────────────────────
            ✅ ไฟล์ชุดนี้ = invoiceFiles ชุดเดียวกับที่ช่างแนบจากหน้า "การดำเนินงาน" ไม่ได้แยกที่เก็บ
            คนกรอกยอดจึงดูรูปใบจริงกับพิมพ์ยอดอยู่ในกล่องเดียวกันได้ ไม่ต้องเปิด 2 หน้าคู่กัน
            ✅ แนบเพิ่ม/ลบได้ตรงนี้เลย เหมือนสลิปใบเสร็จฝั่งการรับเงิน — เดิมแนบได้จากหน้าการดำเนินงาน
            ที่เดียว ทั้งที่คนที่เปิดกล่องนี้คือคนที่ถือใบวางบิลตัวจริงอยู่ในมือ

            🐛 ที่แก้ (ผู้ใช้แจ้งว่า "การ์ดซ้ายดูไม่สวยเมื่อมีไฟล์แนบ ทำให้ซ้าย-ขวาไม่เท่ากัน"):
            เดิมรูปย่อ 96px + ชื่อไฟล์ + ปุ่ม "AI อ่านยอด" เต็มความกว้าง ซ้อนกัน 3 ชั้น = การ์ดสูงเกิน
            150px เพื่อโชว์ไฟล์แค่ใบเดียว ดันคอลัมน์ซ้ายยาวกว่าขวาเห็นได้ชัด
            ✅ ย่อรูปเหลือ 66px แล้วยุบปุ่มลบ/AI เป็นไอคอนซ้อนบนรูป (โผล่ตอนชี้เมาส์ ส่วนจอสัมผัส
            ที่ไม่มี hover ให้โผล่ตลอด) — การ์ดเหลือความสูงราวครึ่งเดียว สองคอลัมน์จึงใกล้เคียงกัน */}
      

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
          accent={ACCENT}
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
  <SectionCard
          sx={{ mb: 2 }}
          title={`ไฟล์ใบวางบิล${attachments.length ? ` (${attachments.length})` : ""}`}
          caption={attachments.length
            ? "กดที่ไฟล์เพื่อดูขนาดเต็ม แล้วกรอกยอดตามใบจริง"
            : "แนบรูป/PDF ใบวางบิลไว้เป็นหลักฐานคู่กับยอดที่กรอก"}
          right={(
            <Tooltip title="แนบไฟล์ใบวางบิล (รูป หรือ PDF)">
              <span>
                <Button
                  size="small" disabled={saving}
                  startIcon={<AttachFile sx={{ fontSize: 15 }} />}
                  onClick={() => invoiceInputRef.current?.click()}
                  sx={{
                    textTransform: "none", fontWeight: 700, fontSize: "0.72rem", borderRadius: 1.5,
                    py: 0.15, px: 1, minHeight: 0, color: ACCENT, bgcolor: alpha(ACCENT, 0.1),
                    "&:hover": { bgcolor: alpha(ACCENT, 0.2) },
                  }}
                >
                  แนบไฟล์
                </Button>
              </span>
            </Tooltip>
          )}
        >
          {attachments.length === 0 ? (
            <Typography variant="caption" sx={{ color: TEXT_SUB }}>
              ยังไม่มีไฟล์แนบ — กด "แนบไฟล์" เพื่ออัปโหลดใบวางบิล
            </Typography>
          ) : (
            <Stack direction="row" spacing={1} sx={{ overflowX: "auto", pb: 0.5 }}>
              {attachments.map((f) => {
                const isImage = isImageFile(f);
                const pendingDelete = confirmDeleteFileId === f._id;
                return (
                  <Box key={f._id || f.fileUrl} sx={{ flexShrink: 0, width: 66 }}>
                    <Box
                      sx={{
                        position: "relative", width: 66, height: 66, borderRadius: 1.5, overflow: "hidden",
                        border: "1px solid", borderColor: "divider", bgcolor: alpha("#0f172a", 0.03),
                        display: "flex", alignItems: "center", justifyContent: "center",
                        // ⚠️ จอสัมผัสไม่มี hover — ปุ่มที่ซ่อนไว้รอ hover จะกดไม่ได้เลยตลอดกาล
                        // จึงโชว์ตลอดบนจอเล็ก แล้วซ่อนรอ hover เฉพาะจอที่มีเมาส์จริงๆ
                        "& .tileAction": { opacity: { xs: 1, md: 0 }, transition: "opacity .15s" },
                        "&:hover": { borderColor: ACCENT },
                        "&:hover .tileAction": { opacity: 1 },
                      }}
                    >
                      <Box
                        onClick={() => { setPreviewCaption("ใบวางบิล"); setPreviewFile(f); }}
                        sx={{ position: "absolute", inset: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        {isImage
                          ? <Box component="img" src={f.fileUrl} alt={f.fileName} loading="lazy" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <InsertDriveFile sx={{ fontSize: 26, color: TEXT_SUB }} />}
                      </Box>

                      {/* ยืนยันลบในตัวการ์ดเอง — ไม่เปิด modal ซ้อน modal (กล่องนี้เป็น Dialog อยู่แล้ว) */}
                      {pendingDelete ? (
                        <Stack
                          alignItems="center" justifyContent="center" spacing={0.25}
                          sx={{ position: "absolute", inset: 0, bgcolor: alpha("#0f172a", 0.72) }}
                        >
                          <Typography sx={{ color: "#fff", fontSize: "0.6rem", fontWeight: 700 }}>ลบไฟล์นี้?</Typography>
                          <Stack direction="row" spacing={0.25}>
                            <Button
                              size="small" disabled={saving} onClick={() => removeInvoiceFile(f._id)}
                              sx={{ minWidth: 0, px: 0.6, py: 0, fontSize: "0.6rem", fontWeight: 800, color: "#fca5a5", textTransform: "none" }}
                            >
                              ลบ
                            </Button>
                            <Button
                              size="small" onClick={() => setConfirmDeleteFileId(null)}
                              sx={{ minWidth: 0, px: 0.6, py: 0, fontSize: "0.6rem", fontWeight: 700, color: "#e2e8f0", textTransform: "none" }}
                            >
                              ยกเลิก
                            </Button>
                          </Stack>
                        </Stack>
                      ) : (
                        <>
                          <Tooltip title="ลบไฟล์นี้">
                            <IconButton
                              className="tileAction" size="small" disabled={saving}
                              onClick={() => setConfirmDeleteFileId(f._id)}
                              sx={{
                                position: "absolute", top: 1, right: 1, p: 0.2,
                                bgcolor: alpha("#0f172a", 0.55), color: "#fff",
                                "&:hover": { bgcolor: "#dc2626" },
                              }}
                            >
                              <Close sx={{ fontSize: 12 }} />
                            </IconButton>
                          </Tooltip>
                          {/* ✅ ให้ AI อ่านยอดจากรูปมาเติมในฟอร์ม — เฉพาะไฟล์รูป (PDF อ่านไม่ได้)
                              ⚠️ โผล่เฉพาะเมื่อเซิร์ฟเวอร์เปิดใช้งานไว้จริง ไม่งั้นกดแล้วเจอ error เปล่าๆ */}
                          {scanEnabled && isImage && !event.billing?.invoicedAt && (
                            <Tooltip title="ให้ AI อ่านยอดจากรูปนี้มาเติมในฟอร์ม">
                              <IconButton
                                className="tileAction" size="small" disabled={Boolean(scanning) || saving}
                                onClick={() => scanInvoice(f)}
                                sx={{
                                  position: "absolute", bottom: 1, right: 1, p: 0.2,
                                  bgcolor: alpha("#0f172a", 0.55), color: "#e9d5ff",
                                  "&:hover": { bgcolor: "#8b5cf6", color: "#fff" },
                                }}
                              >
                                {scanning === f._id
                                  ? <CircularProgress size={11} thickness={6} sx={{ color: "#e9d5ff" }} />
                                  : <AutoAwesome sx={{ fontSize: 12 }} />}
                              </IconButton>
                            </Tooltip>
                          )}
                        </>
                      )}
                    </Box>
                    <Typography variant="caption" sx={{ display: "block", color: TEXT_SUB, fontSize: "0.58rem", mt: 0.2 }} noWrap>
                      {f.fileName || "ไฟล์แนบ"}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          )}
        </SectionCard>
          </Box>

          {/* ── คอลัมน์ขวา: การรับเงิน ─────────────────────────────────────── */}
          <Box sx={{ minWidth: 0 }}>
        {/* ⚠️ ส่วนรับเงินโผล่หลังวางบิลแล้วเท่านั้น — ก่อนหน้านั้นไม่มียอดให้เทียบว่าครบหรือยัง
            (ฝั่ง server ก็ปฏิเสธด้วย 409 ไม่ได้พึ่งการซ่อนปุ่มอย่างเดียว) */}
        {st.state !== "not_invoiced" && (
          <SectionCard
            accent="#10b981"
            sx={{ mt: { xs: 2, md: 0 } }}
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
                    <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap">
                      <Typography sx={{ fontWeight: 700, fontSize: "0.82rem" }}>{baht(p.amount)}</Typography>
                      {/* เลขที่ใบเสร็จเป็นตัวอ้างอิงตอนกระทบยอดกับบัญชี ควรเห็นคู่กับยอดเสมอ
                          ✅ กดที่ชิปเพื่อแก้ได้ในที่ — ใบเสร็จมักออกหลังเงินเข้า ต้องเติมย้อนหลังได้ */}
                      {editingReceiptId === p._id ? (
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <TextField
                            size="small" autoFocus placeholder="เลขที่ใบเสร็จ" value={receiptDraft}
                            onChange={(e) => setReceiptDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveReceiptNo(p._id);
                              if (e.key === "Escape") setEditingReceiptId(null);
                            }}
                            sx={{ "& .MuiInputBase-root": { height: 26, fontSize: "0.72rem" }, width: 130 }}
                          />
                          <Button size="small" disabled={saving} onClick={() => saveReceiptNo(p._id)}
                            sx={{ minWidth: 0, px: 0.9, py: 0, fontSize: "0.68rem", fontWeight: 800, textTransform: "none" }}>
                            บันทึก
                          </Button>
                          <IconButton size="small" onClick={() => setEditingReceiptId(null)}>
                            <Close sx={{ fontSize: 13 }} />
                          </IconButton>
                        </Stack>
                      ) : (
                        <Tooltip title={p.receiptNo ? "แก้เลขที่ใบเสร็จ" : "เพิ่มเลขที่ใบเสร็จ"}>
                          <Chip
                            size="small" clickable
                            icon={<ReceiptLong sx={{ fontSize: 13 }} />}
                            label={p.receiptNo || "เพิ่มเลขที่ใบเสร็จ"}
                            onClick={() => { setEditingReceiptId(p._id); setReceiptDraft(p.receiptNo || ""); }}
                            sx={{
                              height: 19, fontSize: "0.68rem", fontWeight: 700,
                              bgcolor: p.receiptNo ? alpha("#0ea5e9", 0.12) : "transparent",
                              color: p.receiptNo ? "#0369a1" : TEXT_SUB,
                              border: p.receiptNo ? "none" : "1px dashed",
                              borderColor: "divider",
                              "& .MuiChip-icon": { color: "inherit", ml: 0.5 },
                              "& .MuiChip-label": { px: 0.6 },
                            }}
                          />
                        </Tooltip>
                      )}
                    </Stack>
                    <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>
                      {formatThai(moment(p.paidAt), "DD/MM/YYYY")}{p.method ? ` · ${p.method}` : ""}{p.recordedByName ? ` · บันทึกโดย ${p.recordedByName}` : ""}
                    </Typography>
                    {/* สลิป/ใบเสร็จที่แนบไว้ — เปิดดูด้วยตัวพรีวิวตัวเดียวกับที่ใช้ดูใบวางบิล */}
                    {p.slipFileUrl && (
                      <Button
                        size="small" startIcon={<AttachFile sx={{ fontSize: 14 }} />}
                        onClick={() => {
                          setPreviewCaption(p.receiptNo ? `สลิป/ใบเสร็จ เลขที่ ${p.receiptNo}` : "สลิป/ใบเสร็จการรับเงิน");
                          setPreviewFile({ fileName: p.slipFileName, fileUrl: p.slipFileUrl, fileType: p.slipFileType });
                        }}
                        sx={{
                          mt: 0.3, px: 0.6, py: 0, minHeight: 0, borderRadius: 1,
                          textTransform: "none", fontWeight: 700, fontSize: "0.7rem", color: "#0284c7",
                          "&:hover": { bgcolor: alpha("#0ea5e9", 0.1) },
                        }}
                      >
                        ดูสลิป / ใบเสร็จ
                      </Button>
                    )}
                  </Box>
                  {/* ✅ แนบ/เปลี่ยนสลิปของรายการที่บันทึกไปแล้ว — ของจริงใบเสร็จมักออกทีหลังเงินเข้า */}
                  <Tooltip title={p.slipFileUrl ? "เปลี่ยนสลิป / ใบเสร็จ" : "แนบสลิป / ใบเสร็จ"}>
                    <span>
                      <IconButton
                        size="small" disabled={saving}
                        onClick={() => { setSlipTargetId(p._id); rowSlipInputRef.current?.click(); }}
                        sx={{ color: p.slipFileUrl ? "#0284c7" : TEXT_SUB }}
                      >
                        <AttachFile sx={{ fontSize: 15 }} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="ลบรายการนี้">
                    <span>
                      <IconButton size="small" disabled={saving} onClick={() => removePayment(p._id)}
                        sx={{ color: TEXT_SUB, "&:hover": { color: "#dc2626" } }}>
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

            {/* 🐛 ที่แก้ (ผู้ใช้แจ้งว่า "กรอกเลขที่ใบเสร็จและแนบสลิปมีซ้ำกัน ดูรก"):
                ตอนรับเงินครบแล้ว ฟอร์ม "บันทึกรับเงินรายการใหม่" ยังโผล่อยู่ ทั้งที่กดบันทึกไม่ได้
                (ติดกฎห้ามรับเกินยอด) — เลยมีช่อง "เลขที่ใบเสร็จ" กับปุ่ม "แนบสลิป" ซ้ำกับที่มีอยู่
                ในรายการด้านบนโดยไม่มีประโยชน์ ซ่อนทั้งฟอร์มไปเลยเมื่อรับครบแล้ว แล้วบอกทางไปให้ชัด
                ว่าถ้าจะแนบหลักฐาน/ใส่เลขใบเสร็จ ให้ทำที่รายการด้านบน */}
            {isSettled ? (
              <Stack direction="row" alignItems="center" spacing={1}
                sx={{ p: 1.25, borderRadius: 2, bgcolor: alpha("#10b981", 0.07), border: "1px dashed", borderColor: alpha("#10b981", 0.35) }}>
                <Payments sx={{ fontSize: 16, color: "#059669", flexShrink: 0 }} />
                <Typography variant="caption" sx={{ color: TEXT_SUB }}>
                  รับเงินครบแล้ว ไม่ต้องบันทึกเพิ่ม — ถ้าต้องการใส่เลขที่ใบเสร็จหรือแนบสลิป
                  ให้ทำที่รายการด้านบน (กดที่ป้ายใบเสร็จ หรือปุ่มคลิปหนีบ)
                </Typography>
              </Stack>
            ) : (
              <>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.25, mb: 1, alignItems: "start" }}>
              {/* ✅ ปุ่ม "เต็มจำนวน" อยู่ในช่องเลย ไม่ต้องอ่านยอดคงเหลือจากหัวการ์ดแล้วพิมพ์ตามเอง
                  (การพิมพ์ตามคือจุดที่ตัวเลขผิดบ่อยที่สุด) — ซ่อนเมื่อรับครบแล้วเพราะไม่มีอะไรให้เติม */}
              <TextField size="small" type="number" label="ยอดรับ" value={payForm.amount}
                onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
                error={payOverpaid || payNotPositive}
                helperText={payHelperText}
                inputProps={{ min: 0, max: outstanding, step: "0.01" }}
                InputProps={{
                  startAdornment: <InputAdornment position="start">฿</InputAdornment>,
                  endAdornment: !isSettled && outstanding > 0 && (
                    <InputAdornment position="end">
                      <Tooltip title={`ใส่ยอดคงเหลือทั้งหมด ${baht(outstanding)}`}>
                        <Button
                          size="small" onClick={fillOutstanding} disabled={saving}
                          sx={{
                            minWidth: 0, px: 1, py: 0.25, borderRadius: 1.5,
                            textTransform: "none", fontWeight: 800, fontSize: "0.7rem",
                            color: "#059669", bgcolor: alpha("#10b981", 0.1),
                            "&:hover": { bgcolor: alpha("#10b981", 0.2) },
                          }}
                        >
                          เต็มจำนวน
                        </Button>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }} />
              <ThaiDateField label="วันที่รับเงิน" value={payForm.paidAt}
                onChange={(v) => setPayForm((f) => ({ ...f, paidAt: v }))} />
              <TextField size="small" label="เลขที่ใบเสร็จ" value={payForm.receiptNo}
                onChange={(e) => setPayForm((f) => ({ ...f, receiptNo: e.target.value }))}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <ReceiptLong sx={{ fontSize: 16, color: TEXT_SUB }} />
                    </InputAdornment>
                  ),
                }} />
              <TextField size="small" label="ช่องทาง (เช่น โอน / เช็ค)" value={payForm.method}
                onChange={(e) => setPayForm((f) => ({ ...f, method: e.target.value }))} />
              <TextField size="small" label="หมายเหตุ" value={payForm.note}
                sx={{ gridColumn: { sm: "1 / -1" } }}
                onChange={(e) => setPayForm((f) => ({ ...f, note: e.target.value }))} />
            </Box>

            {/* ✅ แนบสลิปโอน/ใบเสร็จ — อัปไปพร้อมกับตอนกดบันทึกรับเงินในคำขอเดียว ไม่ต้องบันทึกก่อน
                แล้วค่อยกลับมาแนบทีหลัง (ซึ่งเป็นขั้นตอนที่คนลืมทำบ่อยที่สุด) */}
            <Box sx={{ mb: 1.5 }}>
              {payForm.slip ? (
                <Stack direction="row" alignItems="center" spacing={1}
                  sx={{ p: 0.9, borderRadius: 2, bgcolor: alpha("#0ea5e9", 0.07), border: "1px solid", borderColor: alpha("#0ea5e9", 0.25) }}>
                  <AttachFile sx={{ fontSize: 16, color: "#0284c7" }} />
                  <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.8rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {payForm.slip.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: TEXT_SUB, flexShrink: 0 }}>
                    {(payForm.slip.size / 1024).toFixed(0)} KB
                  </Typography>
                  <Tooltip title="เอาไฟล์ออก">
                    <IconButton size="small" disabled={saving} onClick={() => setPayForm((f) => ({ ...f, slip: null }))}>
                      <Close sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ) : (
                <Button
                  size="small" startIcon={<AttachFile sx={{ fontSize: 16 }} />}
                  disabled={saving}
                  onClick={() => newSlipInputRef.current?.click()}
                  sx={{
                    textTransform: "none", fontWeight: 700, borderRadius: 2,
                    color: TEXT_SUB, border: "1px dashed", borderColor: "divider",
                    px: 1.5, "&:hover": { borderColor: "#10b981", color: "#059669", bgcolor: alpha("#10b981", 0.06) },
                  }}
                >
                  แนบสลิป / ใบเสร็จ
                </Button>
              )}
            </Box>
            {/* ปุ่มบันทึกของ "ส่วนรับเงิน" — มุมขวาล่างของการ์ดตัวเอง คู่ขนานกับปุ่มของส่วนใบวางบิล
                ⚠️ ใช้สีเขียว (รับเงิน) ต่างจากสีฟ้า (วางบิล) โดยตั้งใจ — เป็นคนละการกระทำที่ย้อนกลับ
                คนละแบบ ถ้าสีเหมือนกันจะกดสลับกันได้ง่ายมากเวลารีบ */}
            <Stack direction="row" justifyContent="flex-end">
              <Button variant="contained" startIcon={<AddCircleOutline sx={{ fontSize: 17 }} />} onClick={addPayment}
                disabled={saving || payInvalid}
                sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, px: 2.5, bgcolor: "#10b981", "&:hover": { bgcolor: "#059669" } }}>
                บันทึกรับเงิน
              </Button>
            </Stack>
              </>
            )}
          </SectionCard>
        )}
          </Box>
        </Box>

        {/* ── ช่องเลือกไฟล์ที่ซ่อนไว้ ─────────────────────────────────────────────
            ⚠️ วางไว้นอกปุ่มโดยตั้งใจ แล้วสั่ง .click() ผ่าน ref — ไม่ใช้ <Button component="label">
            ครอบ <input hidden> เพราะ MUI ห่อ children ด้วย span หลายชั้น การกดจึงไม่ทะลุถึง input
            เสมอไป (อาการที่เจอคือ "กดแนบไฟล์แล้วไม่มีอะไรเกิดขึ้น")
            ⚠️ ต้องล้าง e.target.value ทุกครั้ง ไม่งั้นเลือกไฟล์ "ชื่อเดิม" ซ้ำจะไม่ยิง onChange อีก
            ⚠️ รับ PDF ด้วย ไม่จำกัดแค่รูป — ใบเสร็จที่ออกจากระบบบัญชีมักเป็น PDF */}
        <input ref={newSlipInputRef} hidden type="file" accept="image/*,application/pdf"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) setPayForm((f) => ({ ...f, slip: file }));
          }} />
        <input ref={invoiceInputRef} hidden type="file" accept="image/*,application/pdf"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) uploadInvoiceFile(file);
          }} />
        <input ref={rowSlipInputRef} hidden type="file" accept="image/*,application/pdf"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            const target = slipTargetId;
            setSlipTargetId(null);
            if (file && target) attachSlipToPayment(target, file);
          }} />
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={() => onClose?.()} disabled={saving} sx={{ textTransform: "none" }}>ปิด</Button>
      </DialogActions>

      {/* ✅ ตัวดูไฟล์เป็นของกลาง (features/documents/components/FilePreviewDialog.js) — ตัวเดียวกับที่
          กล่องเอกสารของงานใช้ ไม่ได้เขียนแยกกัน 2 ชุด */}
      <FilePreviewDialog
        file={previewFile}
        caption={previewCaption}
        onClose={() => setPreviewFile(null)}
      />
    </Dialog>
  );
}
