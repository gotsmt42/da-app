/**
 * ExpenseFormDialog — ฟอร์มออก/แก้ไข ใบเบิก Advance และ ใบเคลม (ใช้ตัวเดียวกันทั้งสองชนิด)
 *
 * ✅ ช่องตรงกับแบบฟอร์มกระดาษทุกช่อง (วันที่ / ถึง / ผู้เบิก / ตำแหน่ง / เรื่อง / รายการ) ให้คนที่เคยกรอก
 * กระดาษกรอกในแอปได้ทันทีโดยไม่ต้องเรียนรู้ใหม่ — ส่วนที่เพิ่มมาคือสิ่งที่กระดาษทำไม่ได้: ผูกงาน, หมวด
 * ค่าใช้จ่ายไว้ทำรายงาน, คำนวณยอดให้เอง และแนบรูปใบเสร็จ
 *
 * ✅ ใบเคลม: เลือกใบ Advance แล้วระบบคัดลอกรายการที่ตั้งเบิกมาให้แก้เป็น "ยอดใช้จริง" ทันที พร้อมโชว์
 * ส่วนต่าง (คืนเงิน/จ่ายเพิ่ม) แบบสดๆ ระหว่างกรอก — ผู้เบิกรู้ก่อนกดส่งว่าต้องคืนเท่าไร
 *
 * ⚠️ ยอดบนหน้าจอเป็นแค่ตัวช่วยอ่าน — server คำนวณใหม่ทั้งหมดเสมอ (ดู sanitizeItems ใน routes/expenses.js)
 */
import { useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography, TextField,
  IconButton, Alert, useMediaQuery, Autocomplete, MenuItem, Chip, Tooltip, CircularProgress, Avatar, Collapse,
  Menu, ListItemIcon, ListItemText,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Close, Add, DeleteOutline, AttachFile, Send, Save, Link as LinkIcon, ReceiptLong, Payments, ExpandMore,
  Print, EditNote,
} from "@mui/icons-material";

import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import { ACCEPT_ALL, formatBytes } from "@/shared/utils/fileUpload";
import { thaiDate } from "@/shared/utils/thaiDate";
import { useAuth } from "@/features/auth/AuthContext";
import usePermissions from "@/shared/hooks/usePermissions";
import ExpenseService, { errorText } from "../services/ExpenseService";
import AdvancePanel from "./AdvancePanel";
import KindBadge from "./KindBadge";
import ExpensePrintDialog from "./ExpensePrintDialog";
import {
  KIND_META, EXPENSE_CATEGORIES, categoryMeta, FILE_KINDS, baht, fmtMoney, itemAmount, itemsTotal,
  differenceMeta, money, jobText, TEXT_SUB, TEXT_MAIN, BORDER_MAIN,
} from "../expenseMeta";

const MAX_ITEMS = 40;
let keySeq = 0;
const nextKey = () => `k${Date.now()}_${(keySeq += 1)}`;

const blankItem = (category = "other") => {
  const meta = categoryMeta(category);
  return {
    key: nextKey(), category, description: category === "other" ? "" : meta.label, detail: "",
    qty: 1, unit: meta.unit === "รายการ" ? "" : meta.unit, unitPrice: "", receiptNo: "", advanceItemIndex: null,
  };
};

const fromDoc = (it) => ({
  key: nextKey(),
  category: it.category || "other",
  description: it.description || "",
  detail: it.detail || "",
  qty: it.qty ?? 1,
  unit: it.unit || "",
  unitPrice: it.unitPrice ?? "",
  receiptNo: it.receiptNo || "",
  advanceItemIndex: Number.isInteger(it.advanceItemIndex) ? it.advanceItemIndex : null,
});

const dayOf = (d) => (d ? moment(d).format("YYYY-MM-DD") : "");

const QUICK_ADD = ["allowance", "fuel", "toll", "travel", "lodging", "material"];

const numberField = {
  inputMode: "decimal",
  onWheel: (e) => e.currentTarget.blur(), // ⚠️ ล้อเมาส์บนช่องตัวเลขเผลอเปลี่ยนยอดเงินได้โดยไม่รู้ตัว
};

/**
 * การ์ดหัวข้อในฟอร์ม
 * ⚠️ ต้องอยู่ module scope เท่านั้น — ถ้าประกาศไว้ในตัวฟอร์ม ทุกครั้งที่พิมพ์ 1 ตัวอักษรจะได้ component
 * ชนิดใหม่ React จะถอดช่องกรอกทั้งหมดแล้วสร้างใหม่ = เคอร์เซอร์หลุดจากช่องทุกตัวอักษรที่พิมพ์
 */
const Section = ({ accent, icon, title, hint, children, action }) => (
  <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 2.5, p: { xs: 1.5, sm: 2 }, mb: 1.75 }}>
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
      <Box sx={{ width: 4, height: 18, borderRadius: 1, bgcolor: accent }} />
      {icon}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800, fontSize: "0.92rem", color: TEXT_MAIN }}>{title}</Typography>
        {hint && <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", lineHeight: 1.3 }}>{hint}</Typography>}
      </Box>
      {action}
    </Stack>
    {children}
  </Box>
);

export default function ExpenseFormDialog({ open, kind: kindProp, expense, advance: advanceProp, onClose, onSaved }) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const isDesktop = useMediaQuery("(min-width:900px)");
  const { userData } = useAuth();
  const { can } = usePermissions();
  const editing = Boolean(expense?._id);
  const kind = expense?.kind || kindProp || "advance";
  const meta = KIND_META[kind];
  const isClaim = kind === "claim";
  const canPickPerson = can("viewAllExpenses") && !isClaim;
  const accent = meta.color;

  const [docDate, setDocDate] = useState(moment().format("YYYY-MM-DD"));
  const [to, setTo] = useState("");
  const [toOptions, setToOptions] = useState([]);
  const [people, setPeople] = useState([]);
  const [requester, setRequester] = useState(null);
  const [position, setPosition] = useState("");
  const [subject, setSubject] = useState("");
  const [job, setJob] = useState(null);
  const [jobOptions, setJobOptions] = useState([]);
  const [jobQuery, setJobQuery] = useState("");
  const [jobLoading, setJobLoading] = useState(false);
  const [items, setItems] = useState([blankItem("allowance")]);
  const [dueClearAt, setDueClearAt] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState([]);
  const [advanceOptions, setAdvanceOptions] = useState([]);
  const [advance, setAdvance] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  // ฟอร์มใบเคลมเปล่าสำหรับพิมพ์ไปกรอกด้วยลายมือ (ดู utils/expenseBlankPdf.js)
  const [blankMenuEl, setBlankMenuEl] = useState(null);
  const [blankPrint, setBlankPrint] = useState(null);
  const fileInputRef = useRef(null);

  const pickAdvance = (a) => {
    setAdvance(a);
    if (!a) return;
    setTo(a.to || "");
    setPosition(a.requester?.position || "");
    setSubject(`เคลียร์ค่าใช้จ่าย ${a.subject || ""}`.trim());
    // ✅ คัดลอกรายการที่ตั้งเบิกมาเป็นจุดเริ่ม — ส่วนใหญ่ใช้จริงใกล้เคียงกับที่ตั้งไว้ แก้แค่ยอด
    setItems((a.items || []).map((it, i) => ({ ...fromDoc(it), advanceItemIndex: i })));
  };

  // ── ค่าเริ่มต้นทุกครั้งที่เปิด ─────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setError(""); setTouched(false); setFiles([]); setSaving(false);
    if (editing) {
      setDocDate(dayOf(expense.docDate) || moment().format("YYYY-MM-DD"));
      setTo(expense.to || "");
      setRequester({ userId: expense.requester?.userId, name: expense.requester?.name, position: expense.requester?.position });
      setPosition(expense.requester?.position || "");
      setSubject(expense.subject || "");
      setJob(expense.eventId ? { _id: expense.eventId, ...expense.job } : null);
      setItems((expense.items || []).map(fromDoc));
      setDueClearAt(dayOf(expense.dueClearAt));
      setNote(expense.note || "");
      setAdvance(isClaim ? { _id: expense.advanceId, ...expense.advance, ...(expense.advanceDoc || {}) } : null);
    } else {
      setDocDate(moment().format("YYYY-MM-DD"));
      setTo("");
      setRequester({ userId: userData?.userId, name: userData?.fname, position: "" });
      setPosition("");
      setSubject("");
      setJob(null);
      setItems(isClaim ? [] : [blankItem("allowance")]);
      setDueClearAt("");
      setNote("");
      setAdvance(null);
    }
    let alive = true;
    ExpenseService.suggest().then((s) => {
      if (!alive) return;
      setToOptions(s.to || []);
      if (!editing) {
        // ✅ "ถึง" ใช้ชื่อผู้มีอำนาจคนเดิมเกือบทุกใบ — เติมคนล่าสุดให้เลย แก้ได้
        setTo((cur) => cur || s.to?.[0] || "");
        setPosition((cur) => cur || s.position || "");
      }
    }).catch(() => {});
    if (canPickPerson) ExpenseService.people().then((p) => alive && setPeople(p)).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- รีเซ็ตเฉพาะตอนเปิดกล่อง/เปลี่ยนใบเท่านั้น
  }, [open, expense?._id, kind]);

  // ── ใบเคลม: รายการใบ Advance ที่เคลียร์ได้ ───────────────────────────
  useEffect(() => {
    if (!open || !isClaim || editing) return;
    let alive = true;
    ExpenseService.list({ kind: "advance", status: "paid" })
      .then((rows) => {
        if (!alive) return;
        setAdvanceOptions(rows);
        const preset = advanceProp?._id ? rows.find((r) => r._id === advanceProp._id) || advanceProp : null;
        if (preset) pickAdvance(preset);
      })
      .catch((err) => alive && setError(errorText(err, "โหลดรายการใบ Advance ไม่สำเร็จ")));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- โหลดครั้งเดียวต่อการเปิดกล่อง
  }, [open, isClaim, editing, advanceProp?._id]);

  // ── ค้นหางานที่จะผูก (หน่วงให้พิมพ์จบก่อนค่อยยิง) ─────────────────────
  useEffect(() => {
    if (!open || isClaim) return undefined;
    setJobLoading(true);
    const t = setTimeout(() => {
      ExpenseService.jobs(jobQuery)
        .then((rows) => setJobOptions(rows))
        .catch(() => setJobOptions([]))
        .finally(() => setJobLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [open, isClaim, jobQuery]);


  const total = useMemo(() => itemsTotal(items), [items]);
  const diff = money(total - (advance?.total || 0));
  const diffInfo = differenceMeta(diff);

  const setItem = (key, patch) => setItems((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeItem = (key) => setItems((rows) => rows.filter((r) => r.key !== key));
  const addItem = (category) => setItems((rows) => (rows.length >= MAX_ITEMS ? rows : [...rows, blankItem(category)]));

  const onCategory = (row, value) => {
    const prev = categoryMeta(row.category);
    const next = categoryMeta(value);
    const patch = { category: value };
    // เติมชื่อรายการ/หน่วยให้เฉพาะตอนที่ผู้ใช้ยังไม่ได้พิมพ์เอง (หรือยังเป็นค่าที่ระบบเติมไว้)
    if (!row.description || row.description === prev.label) patch.description = value === "other" ? "" : next.label;
    if (!row.unit || row.unit === prev.unit) patch.unit = next.unit === "รายการ" ? "" : next.unit;
    setItem(row.key, patch);
  };

  const validItems = items.filter((it) => String(it.description).trim());
  const problems = [];
  if (isClaim && !advance?._id) problems.push("เลือกใบ Advance ที่ต้องการเคลียร์");
  if (!String(subject).trim()) problems.push("ระบุเรื่อง");
  if (!isClaim && !validItems.length) problems.push("เพิ่มรายการอย่างน้อย 1 รายการ");
  if (!isClaim && total <= 0) problems.push("ยอดขอเบิกต้องมากกว่า 0");
  if (isClaim && !validItems.length && !String(note).trim()) problems.push("เพิ่มรายการที่ใช้จริง หรือระบุหมายเหตุหากไม่ได้ใช้เงินเลย");
  if (items.some((it) => String(it.description).trim() && Number(it.qty) <= 0)) problems.push("จำนวนต้องมากกว่า 0");

  const addFiles = (list) => {
    const arr = Array.from(list || []).map((file) => ({ key: nextKey(), file, kind: isClaim ? "receipt" : "other" }));
    setFiles((cur) => [...cur, ...arr].slice(0, 15));
  };

  const submit = async () => {
    setTouched(true);
    if (problems.length) { setError(`กรุณา${problems.join(" · ")}`); return; }
    setSaving(true); setError("");
    const fields = {
      docDate, to: String(to || "").trim(), subject: String(subject).trim(), note: String(note || "").trim(),
      position: String(position || "").trim(),
      items: validItems.map(({ key, ...it }) => ({
        ...it, qty: Number(it.qty) || 0, unitPrice: Number(it.unitPrice) || 0,
      })),
    };
    if (!isClaim) {
      fields.eventId = job?._id || "";
      fields.dueClearAt = dueClearAt || "";
      if (canPickPerson && requester?.userId) fields.requesterId = requester.userId;
    } else if (!editing) {
      fields.advanceId = advance._id;
    }
    try {
      const payload = files.map((f) => ({ file: f.file, kind: f.kind }));
      const result = editing
        ? await ExpenseService.update(expense._id, fields, payload)
        : isClaim
          ? await ExpenseService.createClaim(fields, payload)
          : await ExpenseService.createAdvance(fields, payload);
      const warn = result.rejected?.length
        ? `บันทึกแล้ว แต่มีไฟล์ที่แนบไม่ได้: ${result.rejected.map((r) => `${r.name} (${r.message})`).join(", ")}`
        : "";
      onSaved?.(result.expense, { created: !editing, warn });
    } catch (err) {
      setError(errorText(err, "บันทึกไม่สำเร็จ"));
    } finally {
      setSaving(false);
    }
  };

  const resubmit = editing && expense.status === "rejected";
  // ✅ แผงรายละเอียดใบ Advance "ข้างๆ" ใบเคลม (ผู้ใช้ขอ) — จอกว้างวางคู่ขวามือ ติดอยู่กับที่ขณะเลื่อนฟอร์ม
  const showAdvancePanel = isClaim && Boolean(advance?._id) && Boolean(advance?.items);
  const usedIndexes = new Set(items.map((it) => it.advanceItemIndex).filter((i) => Number.isInteger(i)));
  const restoreAdvanceItem = (idx) => {
    const src = advance?.items?.[idx];
    if (!src || usedIndexes.has(idx)) return;
    setItems((rows) => [...rows, { ...fromDoc(src), advanceItemIndex: idx }]);
  };
  const advancePanel = showAdvancePanel && (
    <AdvancePanel advance={advance} usedIndexes={usedIndexes} onRestore={restoreAdvanceItem} />
  );

  /**
   * ✅ พิมพ์ฟอร์มเปล่าได้เฉพาะตอน "ออกใบเคลมใหม่" — ตอนแก้ไขใบเคลมเดิม ใบ Advance ของมันมีใบเคลมอยู่แล้ว
   * (server จะปฏิเสธการออกรหัสฟอร์มอยู่ดี) และคนที่แก้ไขใบในระบบไม่มีเหตุต้องพิมพ์กระดาษเปล่า
   * ⚠️ แบบผูกใบ Advance ใช้ใบ "ตามที่อยู่ในระบบ" ไม่ใช่ค่าที่กำลังแก้ในฟอร์ม — กระดาษต้องอ้างข้อมูลที่ตรวจสอบ
   * ย้อนกลับได้ ไม่ใช่ตัวเลขที่ผู้ใช้เพิ่งพิมพ์และยังไม่ได้บันทึก
   */
  const canPrintBlank = isClaim && !editing;
  const openBlank = (variant) => {
    setBlankMenuEl(null);
    setBlankPrint({ variant, advance: variant === "advance" ? advance : null, printedBy: userData?.fname || "" });
  };

  return (
    <Dialog
      open={open}
      onClose={(_, reason) => { if (saving || reason === "backdropClick") return; onClose?.(); }}
      fullWidth maxWidth={isClaim ? "lg" : "md"} fullScreen={isMobile}
      PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3 } }}
    >
      <DialogTitle sx={{ p: 0 }}>
        {/* ✅ หัวกล่องเป็นสีประจำชนิดใบ (แถบบน + พื้นอ่อน + ป้าย ADVANCE/CLAIM) — เปิดขึ้นมาก็รู้ทันทีว่ากำลังกรอกใบไหน */}
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{
          px: { xs: 2, sm: 2.5 }, py: 1.5, borderBottom: `1px solid ${alpha(accent, 0.25)}`,
          borderTop: `5px solid ${accent}`, bgcolor: meta.soft,
        }}>
          <Box sx={{
            width: 38, height: 38, borderRadius: 2.5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            bgcolor: accent, color: "#fff",
          }}>
            {isClaim ? <ReceiptLong sx={{ fontSize: 21 }} /> : <Payments sx={{ fontSize: 21 }} />}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
              <KindBadge kind={kind} />
              <Typography sx={{ fontWeight: 800, fontSize: "1.02rem", lineHeight: 1.3, color: meta.dark }} noWrap>
                {editing ? `แก้ไข ${expense.docNo || ""}` : `ออก${meta.label}ใหม่`}
              </Typography>
            </Stack>
            <Typography variant="caption" sx={{ color: TEXT_SUB }} noWrap component="div">
              {isClaim ? "สรุปค่าใช้จ่ายจริงพร้อมหลักฐาน เพื่อเคลียร์เงินเบิกล่วงหน้า" : "ขอเบิกเงินล่วงหน้าเพื่อใช้ในงาน · หัวหน้าจะได้รับแจ้งทันที"}
            </Typography>
          </Box>
          <IconButton onClick={onClose} disabled={saving}><Close /></IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ bgcolor: "#f8fafc", px: { xs: 1.25, sm: 2.5 }, pt: "16px !important", pb: 1 }}>
        <Box sx={{
          display: "grid", gap: 2, alignItems: "start",
          gridTemplateColumns: { xs: "1fr", md: showAdvancePanel ? "minmax(0, 1fr) 330px" : "1fr" },
        }}>
        <Box sx={{ minWidth: 0 }}>
        {resubmit && expense.rejectReason && (
          <Alert severity="warning" sx={{ mb: 1.75, borderRadius: 2 }}>
            <b>ถูกตีกลับ:</b> {expense.rejectReason} — แก้แล้วกด "ส่งใหม่" ใบจะกลับไปรออนุมัติ
          </Alert>
        )}

        {/* ── ใบเคลม: เลือกใบ Advance ───────────────────────────────── */}
        {isClaim && (
          <Section accent={accent} icon={<LinkIcon sx={{ fontSize: 18, color: accent }} />} title="อ้างอิงใบเบิก Advance" hint="เลือกได้เฉพาะใบที่จ่ายเงินแล้วและยังไม่ได้เคลียร์">
            {editing ? (
              <Typography sx={{ fontWeight: 700 }}>{advance?.docNo} · {advance?.subject} · {baht(advance?.total)}</Typography>
            ) : (
              <Autocomplete
                options={advanceOptions}
                value={advance}
                onChange={(_, v) => pickAdvance(v)}
                isOptionEqualToValue={(o, v) => o._id === v._id}
                getOptionLabel={(o) => (o ? `${o.docNo} · ${o.subject}` : "")}
                noOptionsText="ไม่มีใบ Advance ที่รอเคลียร์"
                renderOption={({ key, ...liProps }, o) => (
                  <li {...liProps} key={o._id}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography sx={{ fontWeight: 800, fontSize: "0.86rem" }}>{o.docNo}</Typography>
                        <Box sx={{ flex: 1 }} />
                        <Typography sx={{ fontWeight: 800, fontSize: "0.86rem", color: accent }}>{baht(o.total)}</Typography>
                      </Stack>
                      <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }} noWrap>
                        {o.requester?.name} · {o.subject}{o.payment?.at ? ` · รับเงิน ${thaiDate(o.payment.at)}` : ""}
                      </Typography>
                    </Box>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField {...params} size="small" label="ใบ Advance *" placeholder="ค้นหาเลขที่ / เรื่อง"
                    error={touched && !advance} />
                )}
              />
            )}
            {advance?._id && (
              <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={{ mt: 1.25 }} alignItems="center">
                <Chip size="small" label={`ผู้เบิก ${advance.requester?.name || "-"}`} />
                <Chip size="small" label={`ยอดเบิก ${baht(advance.total)}`} sx={{ fontWeight: 700, bgcolor: alpha(KIND_META.advance.color, 0.12), color: KIND_META.advance.dark }} />
                {advance.job?.title && <Chip size="small" label={jobText(advance.job)} />}
                {/* จอแคบ: แผงใบ Advance พับเก็บไว้ใต้ช่องเลือก กดเปิดดูเทียบได้ */}
                {showAdvancePanel && !isDesktop && (
                  <Button size="small" onClick={() => setPanelOpen((v) => !v)}
                    endIcon={<ExpandMore sx={{ transform: panelOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />}
                    sx={{ textTransform: "none", fontWeight: 800, color: KIND_META.advance.dark, ml: "auto" }}>
                    {panelOpen ? "ซ่อนรายละเอียด Advance" : "ดูรายละเอียด Advance"}
                  </Button>
                )}
              </Stack>
            )}
            {showAdvancePanel && !isDesktop && (
              <Collapse in={panelOpen} unmountOnExit>
                <Box sx={{ mt: 1.25 }}>{advancePanel}</Box>
              </Collapse>
            )}
          </Section>
        )}

        {/* ── ข้อมูลเอกสาร ─────────────────────────────────────────── */}
        <Section accent={accent} title="ข้อมูลเอกสาร" hint="ตรงกับหัวแบบฟอร์มกระดาษ ใบเบิกค่าใช้จ่าย">
          <Box sx={{ display: "grid", gap: 1.5, alignItems: "start", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
            <ThaiDatePicker label="วันที่" value={docDate} onChange={(v) => setDocDate(v || moment().format("YYYY-MM-DD"))} />
            <Autocomplete
              freeSolo options={toOptions} value={to} inputValue={to}
              onInputChange={(_, v) => setTo(v)}
              renderInput={(params) => <TextField {...params} size="small" label="ถึง (ผู้มีอำนาจอนุมัติ)" placeholder="เช่น K.ธนสิทธิ์" />}
            />
            {canPickPerson ? (
              <Autocomplete
                options={people}
                value={people.find((p) => p.userId === requester?.userId) || (requester?.userId ? requester : null)}
                onChange={(_, v) => {
                  if (!v) return;
                  setRequester(v);
                  setPosition(v.position || "");
                }}
                isOptionEqualToValue={(o, v) => o.userId === v.userId}
                getOptionLabel={(o) => o?.fullName || o?.name || ""}
                disableClearable
                renderOption={({ key, ...liProps }, o) => (
                  <li {...liProps} key={o.userId}>
                    <Avatar src={o.imageUrl?.startsWith("http") ? o.imageUrl : undefined} sx={{ width: 26, height: 26, mr: 1, fontSize: 13 }}>
                      {(o.name || "?").charAt(0)}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: "0.86rem", fontWeight: 700 }} noWrap>{o.fullName}</Typography>
                      <Typography variant="caption" sx={{ color: TEXT_SUB }}>{o.position}</Typography>
                    </Box>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField {...params} size="small" label="ชื่อผู้เบิกเงิน"
                    helperText={requester?.userId && requester.userId !== userData?.userId ? "เบิกแทน — ผู้เบิกจะได้รับแจ้งและต้องเป็นคนเคลียร์ใบนี้" : undefined} />
                )}
              />
            ) : (
              <TextField size="small" label="ชื่อผู้เบิกเงิน" value={isClaim ? (advance?.requester?.name || requester?.name || "") : (requester?.name || "")}
                InputProps={{ readOnly: true }} helperText={isClaim ? "ผู้เบิกของใบเคลม = ผู้รับเงิน Advance" : undefined} />
            )}
            <TextField size="small" label="ตำแหน่ง" value={position} onChange={(e) => setPosition(e.target.value)} />
            <TextField
              size="small" label="เรื่อง *" value={subject} onChange={(e) => setSubject(e.target.value)}
              placeholder={isClaim ? "เคลียร์ค่าใช้จ่าย ..." : "เช่น เบิกเบี้ยเลี้ยง น.ศ. ฝึกงาน / ค่าเดินทางงาน PM"}
              error={touched && !String(subject).trim()}
              sx={{ gridColumn: { sm: "1 / -1" } }} inputProps={{ maxLength: 300 }}
            />
            {!isClaim && (
              <Autocomplete
                sx={{ gridColumn: { sm: "1 / -1" } }}
                options={job && !jobOptions.some((j) => j._id === job._id) ? [job, ...jobOptions] : jobOptions}
                value={job}
                loading={jobLoading}
                filterOptions={(x) => x}
                onChange={(_, v) => setJob(v)}
                onInputChange={(_, v, reason) => { if (reason === "input") setJobQuery(v); if (reason === "clear") setJobQuery(""); }}
                isOptionEqualToValue={(o, v) => o._id === v._id}
                getOptionLabel={(o) => (o ? jobText(o) || o.title || "" : "")}
                noOptionsText="ไม่พบงาน"
                renderOption={({ key, ...liProps }, o) => (
                  <li {...liProps} key={o._id}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: "0.86rem", fontWeight: 700 }} noWrap>{o.title}{o.system ? ` · ${o.system}` : ""}</Typography>
                      <Typography variant="caption" sx={{ color: TEXT_SUB }} noWrap component="div">
                        {[o.site || o.company, o.start ? thaiDate(o.start) : "", o.docNo].filter(Boolean).join(" · ")}
                      </Typography>
                    </Box>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField {...params} size="small" label="ผูกกับงาน (ไม่บังคับ)" placeholder="ค้นหาชื่องาน / โครงการ / เลขที่"
                    helperText="ผูกงานแล้วจะดูได้ว่างานนี้ใช้งบไปเท่าไรในหน้ารายงาน"
                    InputProps={{ ...params.InputProps, endAdornment: (<>{jobLoading ? <CircularProgress size={16} /> : null}{params.InputProps.endAdornment}</>) }} />
                )}
              />
            )}
          </Box>
        </Section>

        {/* ── รายการ ───────────────────────────────────────────────── */}
        <Section
          title={isClaim ? "รายการค่าใช้จ่ายจริง" : "รายการที่ขอเบิก"}
          hint={isClaim ? "แก้ยอดให้ตรงใบเสร็จ · เพิ่ม/ลบรายการได้" : "จำนวน × ราคาต่อหน่วย ระบบคำนวณยอดให้"}
          action={<Typography sx={{ fontWeight: 800, color: accent, whiteSpace: "nowrap" }}>{baht(total)}</Typography>}
        >
          {touched && !isClaim && !validItems.length && <Alert severity="error" sx={{ mb: 1 }}>เพิ่มรายการอย่างน้อย 1 รายการ</Alert>}
          <Stack spacing={1.25}>
            {items.map((row, idx) => {
              const cat = categoryMeta(row.category);
              const amount = itemAmount(row);
              const planned = isClaim && Number.isInteger(row.advanceItemIndex) ? advance?.items?.[row.advanceItemIndex] : null;
              const plannedDiff = planned ? money(amount - (planned.amount || 0)) : 0;
              return (
                <Box key={row.key} sx={{
                  border: `1px solid ${BORDER_MAIN}`, borderLeft: `3px solid ${cat.color}`, borderRadius: 2, p: 1.25, bgcolor: "#fff",
                }}>
                  <Box sx={{
                    display: "grid", gap: 1, alignItems: "start",
                    gridTemplateColumns: {
                      xs: "1fr 1fr",
                      md: isClaim ? "150px 1fr 70px 80px 110px 110px" : "160px 1fr 72px 84px 120px",
                    },
                  }}>
                    <TextField
                      select size="small" label={`#${idx + 1} หมวด`} value={row.category}
                      onChange={(e) => onCategory(row, e.target.value)}
                      sx={{ gridColumn: { xs: "1 / -1", md: "auto" } }}
                    >
                      {EXPENSE_CATEGORIES.map((c) => (
                        <MenuItem key={c.value} value={c.value}>
                          <Box component="span" sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: c.color, mr: 1, display: "inline-block" }} />
                          {c.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      size="small" label="รายการ *" value={row.description}
                      onChange={(e) => setItem(row.key, { description: e.target.value })}
                      error={touched && !String(row.description).trim()}
                      sx={{ gridColumn: { xs: "1 / -1", md: "auto" } }} inputProps={{ maxLength: 300 }}
                    />
                    <TextField
                      size="small" label="จำนวน" type="number" value={row.qty}
                      onChange={(e) => setItem(row.key, { qty: e.target.value })}
                      inputProps={{ min: 0, step: "any", ...numberField }}
                      error={Number(row.qty) <= 0}
                    />
                    <TextField size="small" label="หน่วย" value={row.unit} onChange={(e) => setItem(row.key, { unit: e.target.value })} inputProps={{ maxLength: 30 }} />
                    <TextField
                      size="small" label="ราคา/หน่วย" type="number" value={row.unitPrice}
                      onChange={(e) => setItem(row.key, { unitPrice: e.target.value })}
                      inputProps={{ min: 0, step: "any", ...numberField }}
                    />
                    {isClaim && (
                      <TextField size="small" label="เลขที่ใบเสร็จ" value={row.receiptNo} onChange={(e) => setItem(row.key, { receiptNo: e.target.value })} inputProps={{ maxLength: 60 }} />
                    )}
                  </Box>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
                    <TextField
                      size="small" variant="standard" placeholder="รายละเอียดเพิ่มเติม เช่น ช่วงวันที่ / ทะเบียนรถ (ไม่บังคับ)"
                      value={row.detail} onChange={(e) => setItem(row.key, { detail: e.target.value })}
                      sx={{ flex: 1, "& input": { fontSize: "0.82rem" } }} inputProps={{ maxLength: 300 }}
                    />
                    <Box sx={{ textAlign: "right", minWidth: 96 }}>
                      <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", color: TEXT_MAIN }}>{fmtMoney(amount)}</Typography>
                      {planned && (
                        <Typography variant="caption" sx={{ display: "block", lineHeight: 1.1, color: plannedDiff === 0 ? TEXT_SUB : plannedDiff > 0 ? "#2563eb" : "#d97706" }}>
                          ตั้งเบิก {fmtMoney(planned.amount)}
                        </Typography>
                      )}
                    </Box>
                    <Tooltip title="ลบรายการ">
                      <span>
                        <IconButton size="small" aria-label="ลบรายการ" onClick={() => removeItem(row.key)} disabled={!isClaim && items.length === 1}>
                          <DeleteOutline fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
          <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75} sx={{ mt: 1.25 }}>
            <Button size="small" variant="outlined" startIcon={<Add />} onClick={() => addItem("other")} disabled={items.length >= MAX_ITEMS}
              sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, borderColor: alpha(accent, 0.5), color: accent }}>
              เพิ่มรายการ
            </Button>
            {QUICK_ADD.map((c) => (
              <Chip key={c} size="small" variant="outlined" icon={<Add sx={{ fontSize: "15px !important" }} />} label={categoryMeta(c).label}
                onClick={() => addItem(c)} disabled={items.length >= MAX_ITEMS} sx={{ fontWeight: 600 }} />
            ))}
          </Stack>

          {/* ── สรุปยอด ─────────────────────────────────────────────── */}
          <Box sx={{ mt: 1.75, p: 1.5, borderRadius: 2, bgcolor: alpha(accent, 0.06), border: `1px dashed ${alpha(accent, 0.35)}` }}>
            {isClaim ? (
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)" }, gap: 1 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: TEXT_SUB }}>ยอดเบิก Advance</Typography>
                  <Typography sx={{ fontWeight: 800 }}>{baht(advance?.total || 0)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: TEXT_SUB }}>ใช้จ่ายจริง</Typography>
                  <Typography sx={{ fontWeight: 800 }}>{baht(total)}</Typography>
                </Box>
                <Box sx={{ gridColumn: { xs: "1 / -1", sm: "auto" } }}>
                  <Typography variant="caption" sx={{ color: TEXT_SUB }}>{diffInfo.label}</Typography>
                  <Typography sx={{ fontWeight: 900, fontSize: "1.15rem", color: diffInfo.color }}>
                    {diffInfo.amount ? `${diffInfo.short} ${baht(diffInfo.amount)}` : "ไม่มีส่วนต่าง"}
                  </Typography>
                </Box>
              </Box>
            ) : (
              <Stack direction="row" alignItems="baseline" justifyContent="space-between">
                <Typography sx={{ fontWeight: 700, color: TEXT_SUB }}>รวมเบิกทั้งหมด</Typography>
                <Typography sx={{ fontWeight: 900, fontSize: "1.3rem", color: accent }}>{baht(total)}</Typography>
              </Stack>
            )}
          </Box>
        </Section>

        {/* ── เพิ่มเติม ───────────────────────────────────────────── */}
        <Section accent={accent} title="หมายเหตุและหลักฐาน" hint={isClaim ? "แนบรูปใบเสร็จ/บิลให้ครบ ผู้อนุมัติจะตรวจจากไฟล์เหล่านี้" : "แนบใบเสนอราคา/รูปประกอบได้ (ไม่บังคับ)"}>
          <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: isClaim ? "1fr" : "1fr 220px" } }}>
            <TextField size="small" label="หมายเหตุ" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} inputProps={{ maxLength: 1000 }}
              placeholder={isClaim ? "เช่น ไม่ได้ใช้เงินเพราะงานเลื่อน / ใบเสร็จบางใบสูญหาย" : ""} />
            {!isClaim && (
              <ThaiDatePicker label="กำหนดเคลียร์ (ไม่บังคับ)" value={dueClearAt} onChange={(v) => setDueClearAt(v || "")}
                helperText="ว่างไว้ = 7 วันหลังรับเงิน" />
            )}
          </Box>
          <input ref={fileInputRef} type="file" hidden multiple accept={ACCEPT_ALL}
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <Stack spacing={0.75} sx={{ mt: 1.5 }}>
            {files.map((f) => (
              <Stack key={f.key} direction="row" alignItems="center" spacing={1} sx={{ p: 0.75, pl: 1.25, border: `1px solid ${BORDER_MAIN}`, borderRadius: 2, bgcolor: "#fff" }}>
                <AttachFile sx={{ fontSize: 17, color: TEXT_SUB }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.82rem", fontWeight: 600 }} noWrap>{f.file.name}</Typography>
                  <Typography variant="caption" sx={{ color: TEXT_SUB }}>{formatBytes(f.file.size)}</Typography>
                </Box>
                <TextField select size="small" value={f.kind} onChange={(e) => setFiles((cur) => cur.map((x) => (x.key === f.key ? { ...x, kind: e.target.value } : x)))}
                  sx={{ width: 130, "& .MuiInputBase-input": { py: 0.6, fontSize: "0.8rem" } }}>
                  {FILE_KINDS.map((k) => <MenuItem key={k.value} value={k.value}>{k.label}</MenuItem>)}
                </TextField>
                <IconButton size="small" onClick={() => setFiles((cur) => cur.filter((x) => x.key !== f.key))}><Close fontSize="small" /></IconButton>
              </Stack>
            ))}
          </Stack>
          <Button size="small" startIcon={<AttachFile />} onClick={() => fileInputRef.current?.click()}
            sx={{ mt: 1, textTransform: "none", fontWeight: 700, color: accent }}>
            {isClaim ? "แนบใบเสร็จ / รูปถ่าย" : "แนบไฟล์"}
          </Button>
          {editing && (expense.attachments?.length > 0) && (
            <Typography variant="caption" sx={{ display: "block", color: TEXT_SUB }}>
              มีไฟล์แนบเดิม {expense.attachments.length} ไฟล์ (จัดการได้ในหน้ารายละเอียด)
            </Typography>
          )}
        </Section>
        </Box>
        {showAdvancePanel && isDesktop && (
          <Box sx={{ position: "sticky", top: 0, minWidth: 0 }}>{advancePanel}</Box>
        )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: { xs: 1.5, sm: 2.5 }, py: 1.25, borderTop: `1px solid ${BORDER_MAIN}`, gap: 1 }}>
        {canPrintBlank && (
          <Tooltip describeChild title="พิมพ์ฟอร์มกระดาษไปกรอกด้วยลายมือ แล้วค่อยนำมาบันทึกเข้าระบบ">
            <Button
              onClick={(e) => setBlankMenuEl(e.currentTarget)} disabled={saving}
              startIcon={<Print sx={{ fontSize: 18 }} />}
              aria-haspopup="menu" aria-expanded={Boolean(blankMenuEl)}
              sx={{ textTransform: "none", fontWeight: 700, color: accent, whiteSpace: "nowrap", flexShrink: 0 }}
            >
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>พิมพ์</Box>ฟอร์มเปล่า
            </Button>
          </Tooltip>
        )}
        {error ? (
          <Alert severity="error" sx={{ flex: 1, py: 0, "& .MuiAlert-message": { fontSize: "0.8rem" } }}>{error}</Alert>
        ) : (
          <Typography variant="caption" sx={{ flex: 1, color: TEXT_SUB, display: { xs: "none", sm: "block" } }}>
            {editing ? "บันทึกแล้วยอดจะคำนวณใหม่ทั้งใบ" : "ส่งแล้วแก้ไขได้จนกว่าหัวหน้าจะอนุมัติ"}
          </Typography>
        )}
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: "none", color: TEXT_SUB, display: { xs: error ? "none" : "inline-flex", sm: "inline-flex" } }}>ยกเลิก</Button>
        <Button
          variant="contained" onClick={submit} disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : editing && !resubmit ? <Save sx={{ fontSize: 18 }} /> : <Send sx={{ fontSize: 17 }} />}
          sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, px: 2.5, boxShadow: "none", whiteSpace: "nowrap", bgcolor: accent, "&:hover": { bgcolor: meta.dark, boxShadow: "none" } }}
        >
          {saving ? "กำลังบันทึก..." : resubmit ? "ส่งใหม่" : editing ? "บันทึก" : "ส่งขออนุมัติ"}
        </Button>
      </DialogActions>

      {canPrintBlank && (
        <Menu
          anchorEl={blankMenuEl} open={Boolean(blankMenuEl)} onClose={() => setBlankMenuEl(null)}
          anchorOrigin={{ vertical: "top", horizontal: "left" }} transformOrigin={{ vertical: "bottom", horizontal: "left" }}
          PaperProps={{ sx: { borderRadius: 2.5, maxWidth: 380 } }}
        >
          {/* แบบผูกใบ Advance ขึ้นก่อน — ปลอดภัยกว่า (รหัสฟอร์มตรวจกับระบบได้ + ยอดต้นทางพิมพ์จากระบบ) */}
          <MenuItem onClick={() => openBlank("advance")} disabled={!advance?._id} sx={{ alignItems: "flex-start", py: 1.25, whiteSpace: "normal" }}>
            <ListItemIcon sx={{ mt: 0.25 }}><ReceiptLong sx={{ color: accent }} /></ListItemIcon>
            <ListItemText
              primary={advance?._id ? `ฟอร์มพร้อมข้อมูล ${advance.docNo}` : "ฟอร์มพร้อมข้อมูลใบ Advance"}
              secondary={advance?._id
                ? "พิมพ์เลขที่ ยอดเบิก และรายการตั้งเบิกให้ · รหัสฟอร์มถูกบันทึกในประวัติใบ Advance (แนะนำ)"
                : "เลือกใบ Advance ด้านบนก่อน"}
              primaryTypographyProps={{ fontWeight: 800, fontSize: "0.88rem" }}
              secondaryTypographyProps={{ fontSize: "0.76rem" }}
            />
          </MenuItem>
          <MenuItem onClick={() => openBlank("empty")} sx={{ alignItems: "flex-start", py: 1.25, whiteSpace: "normal" }}>
            <ListItemIcon sx={{ mt: 0.25 }}><EditNote sx={{ color: TEXT_SUB }} /></ListItemIcon>
            <ListItemText
              primary="ฟอร์มเปล่าทั้งใบ"
              secondary="ไม่มีข้อมูลใดๆ กรอกเองทั้งหมด · รหัสฟอร์มตรวจกับระบบไม่ได้"
              primaryTypographyProps={{ fontWeight: 800, fontSize: "0.88rem" }}
              secondaryTypographyProps={{ fontSize: "0.76rem" }}
            />
          </MenuItem>
        </Menu>
      )}
      <ExpensePrintDialog open={Boolean(blankPrint)} blank={blankPrint} onClose={() => setBlankPrint(null)} />
    </Dialog>
  );
}
