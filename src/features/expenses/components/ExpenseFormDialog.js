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
 * ✅ ใบสำรองจ่าย (claimType = "reimburse"): ผู้เบิกออกเงินเองไปก่อน ไม่มี Advance ให้อ้าง — ฟอร์มจึง
 * ตัดช่องเลือกใบ Advance/แผงเทียบยอดออกทั้งหมด แล้วใช้ช่องชุดเดียวกับใบ Advance แทน (เลือกผู้เบิกแทนได้ ·
 * ผูกงานได้) เพราะมันคือ "ใบตั้งต้น" เหมือนกัน ต่างกันแค่เงินออกไปแล้วจากกระเป๋าใคร
 * ⚠️ สามโหมดนี้ต่างกันที่ "มี Advance ให้อ้างหรือไม่" ไม่ใช่ที่ kind — เช็ค isClearClaim/isReimburseForm
 * เสมอ อย่าเช็ค isClaim ตรงๆ เพราะใบสำรองจ่ายก็มี kind = "claim" เหมือนกัน
 *
 * ⚠️ ยอดบนหน้าจอเป็นแค่ตัวช่วยอ่าน — server คำนวณใหม่ทั้งหมดเสมอ (ดู sanitizeItems ใน routes/expenses.js)
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import moment from "moment";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography, TextField,
  IconButton, Alert, useMediaQuery, MenuItem, InputAdornment, Chip, Tooltip, CircularProgress, Collapse,
  Menu, ListItemIcon, ListItemText, Checkbox, FormControlLabel,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { CloseRounded as Close, AddRounded as Add, DeleteOutlineRounded as DeleteOutline, AttachFileRounded as AttachFile, SendRounded as Send, SaveRounded as Save, LinkRounded as LinkIcon, ReceiptLongRounded as ReceiptLong, PaymentsRounded as Payments, ExpandMoreRounded as ExpandMore, PrintRounded as Print, EditNoteRounded as EditNote, AccountBalanceWalletRounded as AccountBalanceWallet, GroupsRounded as Groups, PersonOutlineRounded as PersonOutline, AccountBalanceRounded as AccountBalance, HistoryEduRounded as HistoryEdu, DescriptionRounded as DescriptionIcon, NotesRounded as NotesIcon } from "@mui/icons-material";

import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import { ACCEPT_ALL, formatBytes, MAX_UPLOAD_MB } from "@/shared/utils/fileUpload";
import { thaiDate } from "@/shared/utils/thaiDate";
import { useAuth } from "@/features/auth/AuthContext";
import usePermissions from "@/shared/hooks/usePermissions";
import ExpenseService, { errorText } from "../services/ExpenseService";
import SignatureService from "@/shared/services/SignatureService";
import AdvancePanel from "./AdvancePanel";
import ExpensePrintDialog from "./ExpensePrintDialog";
import BankAccountPicker from "./BankAccountPicker";
import SheetSelectField, { FORM_FIELD_SX } from "@/shared/ui/SheetSelectField";
import { SheetPicker, SheetPickerRow, PickerField } from "@/shared/ui/SheetPicker";
import {
  KIND_META, EXPENSE_CATEGORIES, categoryMeta, FILE_KINDS, baht, fmtMoney, itemAmount, itemsTotal,
  differenceMeta, money, jobText, jobSubject, jobsSubject, jobChipText, jobRangeText, jobPartText, itemPersonName, personFullName, slipKind, TEXT_SUB, TEXT_MAIN, BORDER_MAIN,
} from "../expenseMeta";
import JobTypeChip, { JobOptionRow } from "@/shared/ui/JobTypeChip";
import useFormDraft, { DraftBanner } from "@/shared/hooks/useFormDraft";

const MAX_ITEMS = 40;
let keySeq = 0;
const nextKey = () => `k${Date.now()}_${(keySeq += 1)}`;

const blankItem = (category = "other") => {
  const meta = categoryMeta(category);
  return {
    key: nextKey(), category, description: category === "other" ? "" : meta.label, detail: "",
    qty: 1, unit: meta.unit === "รายการ" ? "" : meta.unit, unitPrice: "", receiptNo: "", advanceItemIndex: null,
    person: null,
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
  person: it.person?.name ? { userId: it.person.userId || "", name: it.person.name } : null,
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
// 🔁 (13 พ.ย. 2569 ผู้ใช้: "หน้าแอดวานซ์/ใบเคลม ให้รูปแบบการเลือกข้อมูลเหมือนหน้าอีเวนต์") การ์ดหัวข้อแบบเดียวกับฟอร์มลงงาน
const Section = ({ accent, icon, title, hint, children, action }) => (
  <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: "14px", mb: 1.5, overflow: "hidden" }}>
    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: { xs: 1.5, sm: 2 }, py: 1.25, borderBottom: "1px solid #eef2f7" }}>
      {icon && (
        <Box sx={{ width: 34, height: 34, borderRadius: "10px", flexShrink: 0, display: "grid", placeItems: "center", bgcolor: alpha(accent, 0.1),
          "& svg": { fontSize: "19px !important", color: `${accent} !important` } }}>{icon}</Box>
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", color: TEXT_MAIN, lineHeight: 1.35 }}>{title}</Typography>
        {hint && <Typography sx={{ color: TEXT_SUB, fontSize: "0.74rem", lineHeight: 1.4, mt: 0.15 }}>{hint}</Typography>}
      </Box>
      {action}
    </Stack>
    <Box sx={{ px: { xs: 1.5, sm: 2 }, py: { xs: 1.5, sm: 1.75 } }}>{children}</Box>
  </Box>
);

/**
 * @param {object} [presetJob]  งานที่เปิดฟอร์มมาจากหน้าตารางงาน (เมนู "เบิก Advance งานนี้") —
 *   { _id, title, company, site, docNo, start } · ผูกงานให้และล็อกช่องไว้ ไม่ให้เผลอเปลี่ยนเป็นงานอื่น
 */
export default function ExpenseFormDialog({ open, kind: kindProp, claimType: claimTypeProp, expense, advance: advanceProp, presetJob, onClose, onSaved }) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const isDesktop = useMediaQuery("(min-width:900px)");
  const navigate = useNavigate();
  const { userData } = useAuth();
  const { can } = usePermissions();
  const editing = Boolean(expense?._id);
  const kind = expense?.kind || kindProp || "advance";
  const isClaim = kind === "claim";
  // ⚠️ ตอนแก้ไขใบเดิมต้องอ่านชนิดย่อยจากตัวใบเสมอ (ค่าที่ส่งมาทาง prop เป็นของ "ใบใหม่" เท่านั้น)
  const claimType = editing ? (expense.claimType || "clear") : (claimTypeProp || "clear");
  /** ใบสำรองจ่าย = ไม่มี Advance ให้อ้าง · ใบเคลมปกติ = ต้องอ้าง Advance เสมอ */
  const isReimburseForm = isClaim && claimType === "reimburse";
  const isClearClaim = isClaim && !isReimburseForm;
  const slip = slipKind({ kind, claimType });
  const meta = KIND_META[slip];
  const canPickPerson = can("viewAllExpenses") && !isClearClaim;
  const accent = meta.color;

  const [docDate, setDocDate] = useState(moment().format("YYYY-MM-DD"));
  const [to, setTo] = useState("");
  const [toOptions, setToOptions] = useState([]);
  const [people, setPeople] = useState([]);
  const [requester, setRequester] = useState(null);
  const [position, setPosition] = useState("");
  const [subject, setSubject] = useState("");
  // ✅ (24 ต.ค. 2569 ผู้ใช้: "ใบเบิก/เคลมทุกใบ อ้างอิงงานได้หลายงานพร้อมกัน") — งานแรก = งานหลักของใบ
  const [jobs, setJobs] = useState([]);
  const job = jobs[0] || null;
  const [jobOptions, setJobOptions] = useState([]);
  const [jobQuery, setJobQuery] = useState("");
  const [jobLoading, setJobLoading] = useState(false);
  const [jobSheet, setJobSheet] = useState(false); // แผ่นเลือกงาน
  /** ใบ Advance ที่มีอยู่แล้วของงานที่เลือก (1 งานออกได้ใบเดียว) — null = ไม่มี (หรือยังตรวจไม่เสร็จ) */
  const [jobAdvance, setJobAdvance] = useState(null);
  const [jobAdvanceChecking, setJobAdvanceChecking] = useState(false);
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
  /**
   * บัญชีรับเงินของผู้เบิก (ทุกชนิดใบ) — undefined = ยังไม่ได้เลือก ให้ตัวเลือกเลือกบัญชีหลักให้เอง
   * ⚠️ แยก undefined ออกจาก "" ให้ชัด: "" คือผู้ใช้ตั้งใจเลือก "ไม่ระบุบัญชี (รับเงินสด)"
   */
  const [payToAccountId, setPayToAccountId] = useState(undefined);
  // ✅ (10 ต.ค. 2569) ข้อมูลที่กรอกค้างไม่หายเมื่อฟอร์มหลุด/ปิด — กู้คืนได้ภายใน 10 นาที (ดู shared/hooks/useFormDraft.js)
  const draft = useFormDraft({
    key: editing ? `expense:edit:${expense._id}` : `expense:new:${slip}:${presetJob?._id || advanceProp?._id || "-"}`,
    enabled: Boolean(open),
    data: { docDate, to, position, subject, jobs, items, dueClearAt, note, advance, payToAccountId: payToAccountId ?? null },
    restore: (d) => {
      if (d.docDate) setDocDate(d.docDate);
      setTo(d.to || ""); setPosition(d.position || ""); setSubject(d.subject || "");
      setJobs(Array.isArray(d.jobs) ? d.jobs : d.job ? [d.job] : []);
      if (Array.isArray(d.items)) setItems(d.items.map((it) => ({ ...it, key: nextKey() })));
      setDueClearAt(d.dueClearAt || ""); setNote(d.note || "");
      if (d.advance) setAdvance(d.advance);
      if (d.payToAccountId !== null && d.payToAccountId !== undefined) setPayToAccountId(d.payToAccountId);
    },
  });
  /**
   * ✅ ผู้ใช้ขอ: "ใบ advance และ claim ให้มีให้ติ๊กด้วยว่าจะใช้ลายเซ็นอิเล็กทรอนิกไหม"
   * ⚠️ ติ๊กได้เฉพาะตอนที่ผู้เบิกคือคนที่กำลังกรอกใบเอง — ลายเซ็นของคนอื่นเอามาแปะไม่ได้ (server บังคับซ้ำ)
   */
  const [mySignature, setMySignature] = useState(null);
  const [useSignature, setUseSignature] = useState(true);
  // ฟอร์มใบเคลมเปล่าสำหรับพิมพ์ไปกรอกด้วยลายมือ (ดู utils/expenseBlankPdf.js)
  const [blankMenuEl, setBlankMenuEl] = useState(null);
  const [blankPrint, setBlankPrint] = useState(null);
  const fileInputRef = useRef(null);
  // เรื่องที่ระบบเติมให้ล่าสุด — ผู้ใช้พิมพ์แก้เองแล้ว เปลี่ยนงานทีหลังต้องไม่เขียนทับของที่ผู้ใช้พิมพ์
  const autoSubjectRef = useRef("");
  const subjectPrefix = isReimburseForm ? "เบิกคืนค่าใช้จ่ายงาน" : "เบิกค่าใช้จ่ายงาน";

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
      setRequester({ userId: expense.requester?.userId, name: expense.requester?.name, fullName: expense.requester?.fullName, position: expense.requester?.position });
      setPosition(expense.requester?.position || "");
      setSubject(expense.subject || "");
      setJobs((expense.jobs || []).length
        ? expense.jobs.map((j) => ({ _id: j.eventId, ...j }))
        : expense.eventId ? [{ _id: expense.eventId, ...expense.job }] : []);
      setItems((expense.items || []).map(fromDoc));
      setDueClearAt(dayOf(expense.dueClearAt));
      setNote(expense.note || "");
      setAdvance(isClearClaim ? { _id: expense.advanceId, ...expense.advance, ...(expense.advanceDoc || {}) } : null);
      // ⚠️ ใบเดิม: ใช้บัญชีที่บันทึกไว้ ไม่ให้ตัวเลือกไปหยิบ "บัญชีหลัก" มาเปลี่ยนปลายทางเงินเองเงียบๆ
      setPayToAccountId(expense.payTo?.accountId || "");
    } else {
      setDocDate(moment().format("YYYY-MM-DD"));
      setTo("");
      setRequester({ userId: userData?.userId, name: userData?.fname, position: "" });
      setPosition("");
      // ✅ เปิดมาจากหน้าตารางงาน — ผูกงานให้ทันที และตั้งเรื่องจากชื่องาน/โครงการ (แก้ได้)
      // ✅ เรื่องแบบรายละเอียดครบ "เบิกค่าใช้จ่ายงาน PM Fire Alarm โครงการ ... ครั้งที่ ..." (ดู jobSubject)
      autoSubjectRef.current = presetJob ? jobsSubject([presetJob], subjectPrefix) : "";
      setSubject(autoSubjectRef.current);
      setJobs(presetJob ? [{ ...presetJob }] : []);
      // ใบเคลมที่อ้าง Advance เริ่มด้วยรายการว่าง (รอคัดลอกจากใบ Advance) ที่เหลือเริ่มด้วยแถวเปล่า
      setItems(isClearClaim ? [] : [blankItem(isReimburseForm ? "fuel" : "allowance")]);
      setDueClearAt("");
      setNote("");
      setAdvance(null);
      setPayToAccountId(undefined);
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
    // ✅ ลายเซ็นอิเล็กทรอนิกส์ของตัวเอง — ใช้ตัดสินว่าจะโชว์ช่องติ๊กไหม (ไม่มีลายเซ็น = ไม่ต้องโชว์)
    SignatureService.me().then((sig) => alive && setMySignature(sig)).catch(() => {});
    // ✅ แก้ใบเดิม: ติ๊กไว้ตามสถานะจริงของใบ (เคยลงนามไว้หรือยัง) · ใบใหม่: ติ๊กไว้ให้เลย
    setUseSignature(editing ? Boolean(expense.signatures?.requester?.hash) : true);
    // ✅ โหลดรายชื่อพนักงานให้ทุกคน — นอกจากแอดมินใช้เลือกผู้เบิกแล้ว หัวหน้างานยังใช้ระบุพนักงานในแต่ละรายการ
    ExpenseService.people().then((p) => alive && setPeople(p)).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- รีเซ็ตเฉพาะตอนเปิดกล่อง/เปลี่ยนใบเท่านั้น
  }, [open, expense?._id, kind, presetJob?._id]);

  /**
   * 🔒 งานที่เลือกมีใบ Advance แล้วหรือยัง (ผู้ใช้สั่ง: "งานไหนมีการออกใบ Advance แล้วจะไม่สามารถออกซ้ำได้")
   * ✅ ตรวจทันทีที่เลือกงาน — บอกก่อนผู้ใช้จะกรอกรายการทั้งใบ ไม่ใช่ไปเจอตอนกดส่ง
   * ⚠️ นี่เป็นแค่ด่านหน้า server ตรวจซ้ำตอนบันทึกเสมอ (รวมกรณีกดส่งพร้อมกันจากหลายเครื่อง)
   * ⚠️ ไม่นับใบที่กำลังแก้อยู่ — แก้ใบ Advance เดิมของงานนั้นต้องบันทึกได้ตามปกติ
   */
  const checksJobAdvance = open && kind === "advance";
  const jobIdsKey = jobs.map((j) => j._id).join(",");
  useEffect(() => {
    setJobAdvance(null);
    const ids = jobIdsKey ? jobIdsKey.split(",") : [];
    if (!checksJobAdvance || !ids.length) return undefined;
    let alive = true;
    setJobAdvanceChecking(true);
    // ตรวจทุกงานที่เลือก — งานแรกที่มีใบ Advance แล้ว (ไม่นับใบที่กำลังแก้อยู่)
    Promise.all(ids.map((id) => ExpenseService.jobAdvance(id).then((adv) => (adv && adv._id !== expense?._id ? { ...adv, eventId: id } : null)).catch(() => null)))
      .then((res) => { if (alive) setJobAdvance(res.find(Boolean) || null); })
      .finally(() => { if (alive) setJobAdvanceChecking(false); });
    return () => { alive = false; };
  }, [checksJobAdvance, jobIdsKey, expense?._id]);

  // ── ใบเคลม: รายการใบ Advance ที่เคลียร์ได้ ───────────────────────────
  useEffect(() => {
    if (!open || !isClearClaim || editing) return;
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
  }, [open, isClearClaim, editing, advanceProp?._id]);

  // ── ค้นหางานที่จะผูก (หน่วงให้พิมพ์จบก่อนค่อยยิง) ─────────────────────
  useEffect(() => {
    if (!open || isClearClaim) return undefined;
    setJobLoading(true);
    const t = setTimeout(() => {
      ExpenseService.jobs(jobQuery)
        .then((rows) => setJobOptions(rows))
        .catch(() => setJobOptions([]))
        .finally(() => setJobLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [open, isClearClaim, jobQuery]);


  const total = useMemo(() => itemsTotal(items), [items]);
  const diff = money(total - (advance?.total || 0));
  const diffInfo = differenceMeta(diff, slip);

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

  /** รายชื่อคนในงาน (หัวหน้าทีม + ลูกทีม) จากงานที่ผูก — ใช้กับปุ่ม "เบี้ยเลี้ยงทีมงาน" */
  const teamNames = useMemo(() => [...new Set(jobs.flatMap((j) => j?.teamNames || []).map((n) => String(n || "").trim()).filter(Boolean))], [jobs]);

  /**
   * ✅ เพิ่มเบี้ยเลี้ยงให้ทุกคนในงานคนละบรรทัด (ข้ามคนที่มีบรรทัดเบี้ยเลี้ยงอยู่แล้ว)
   * • แถวเบี้ยเลี้ยงที่ยังไม่ระบุคน (เช่นแถวตั้งต้นที่กรอกอัตราไว้แล้ว) ถูกใช้เป็นบรรทัดของคนถัดไปก่อน
   *   ไม่งั้นจะเหลือแถวเบี้ยเลี้ยงไม่มีชื่อค้างอยู่ 1 แถว ซึ่งดูเหมือนเบิกเกินไป 1 คน
   * • จำนวนวัน/ราคาต่อวันคัดลอกจากบรรทัดเบี้ยเลี้ยงแรกที่มีอยู่ — ส่วนใหญ่ทั้งทีมได้อัตราเดียวกัน แก้ทีหลังได้
   */
  const addTeamAllowance = () => {
    setItems((rows) => {
      const next = [...rows];
      const has = (name) => {
        const full = people.find((u) => u.name === name)?.fullName;
        return next.some((r) => r.category === "allowance" && [name, full].includes(itemPersonName(r)));
      };
      const template = next.find((r) => r.category === "allowance");
      const toPerson = (name) => {
        // ทีมในปฏิทินเก็บเป็นชื่อต้น — จับคู่กับทะเบียนแล้วใช้ชื่อ-นามสกุล (คนนอกระบบคงชื่อเดิม)
        const p = people.find((u) => u.name === name || u.fullName === name);
        return { userId: p?.userId || "", name: p?.fullName || name };
      };
      teamNames.filter((name) => !has(name)).forEach((name) => {
        const blankIdx = next.findIndex((r) => r.category === "allowance" && !itemPersonName(r));
        if (blankIdx >= 0) {
          next[blankIdx] = { ...next[blankIdx], person: toPerson(name) };
          return;
        }
        if (next.length >= MAX_ITEMS) return;
        next.push({
          ...blankItem("allowance"), person: toPerson(name),
          qty: template?.qty ?? 1, unit: template?.unit ?? "วัน", unitPrice: template?.unitPrice ?? "",
        });
      });
      return next;
    });
  };

  const personTotals = useMemo(() => {
    const map = new Map();
    items.forEach((it) => {
      const name = itemPersonName(it);
      if (!name || !String(it.description).trim()) return;
      const cur = map.get(name) || { name, amount: 0, lines: 0 };
      cur.amount = money(cur.amount + itemAmount(it));
      cur.lines += 1;
      map.set(name, cur);
    });
    return [...map.values()];
  }, [items]);

  // ── บัญชีรับเงิน: เจ้าของบัญชี = ผู้เบิกของใบเสมอ (ใบเคลมปกติผูกกับผู้เบิกของใบ Advance) ──
  const payToUserId = isClearClaim ? advance?.requester?.userId || "" : requester?.userId || "";
  // ⚠️ เอาชื่อ-นามสกุลจากทะเบียนพนักงานก่อน — ใบใหม่มีแค่ชื่อต้นจาก userData (ไม่มีนามสกุล)
  // ถ้าใช้ค่านั้นเติมชื่อบัญชีให้ จะได้บัญชีชื่อ "ช่างเอ" เฉยๆ ซึ่งไม่ตรงกับหน้าสมุดบัญชีจริง
  const payToOwnerName =
    people.find((pp) => pp.userId === payToUserId)?.fullName ||
    (isClearClaim ? personFullName(advance?.requester) : personFullName(requester)) ||
    (isClearClaim ? advance?.requester?.name : requester?.name) || "";
  // 🔒 ทะเบียนบัญชีของคนอื่นเปิดดูได้เฉพาะแอดมิน/ผู้จัดการ — คนอื่นเห็นแค่บัญชีที่ใบเก็บไว้แล้ว
  const canManageBank = Boolean(payToUserId) && (payToUserId === userData?.userId || can("viewAllExpenses"));

  /**
   * ตัวเลือกช่อง "ถึง (ผู้มีอำนาจอนุมัติ)"
   * ✅ ผู้ใช้ขอ: "ตรงช่องถึงให้เลือกชื่อจากระบบได้เลย และแสดงตำแหน่งให้รู้ด้วย"
   *   1. ผู้มีอำนาจอนุมัติในระบบ (กรรมการผู้จัดการ → ผู้จัดการแผนกช่าง → แอดมินช่าง) ขึ้นก่อน
   *   2. พนักงานคนอื่นในระบบ
   *   3. ชื่อที่เคยพิมพ์ใช้ในใบก่อนๆ แต่ไม่มีในระบบ (เช่น "K.ธนสิทธิ์") — ใบเก่ายังเลือกซ้ำได้
   * ⚠️ ยังพิมพ์ชื่อเองได้ (freeSolo) — บางใบส่งถึงคนนอกระบบ ช่องนี้เก็บเป็นข้อความเหมือนเดิม
   */
  const toChoices = useMemo(() => {
    const authority = (role) => ({ director: 0, manager: 1, admin: 2 }[String(role || "").toLowerCase()] ?? 3);
    const staff = [...people]
      .sort((a, b) => authority(a.role) - authority(b.role) || String(a.fullName || "").localeCompare(String(b.fullName || ""), "th"))
      .map((p) => ({
        label: p.fullName || p.name || "",
        position: p.position || "",
        imageUrl: p.imageUrl || "",
        group: authority(p.role) < 3 ? "ผู้มีอำนาจอนุมัติ" : "พนักงานในระบบ",
      }))
      .filter((o) => o.label);
    const inSystem = new Set(staff.map((o) => o.label));
    const history = (toOptions || [])
      .filter((name) => name && !inSystem.has(name))
      .map((name) => ({ label: name, position: "", imageUrl: "", group: "ชื่อที่เคยใช้" }));
    return [...staff, ...history];
  }, [people, toOptions]);
  /** คนที่เลือกอยู่ในช่อง "ถึง" (ถ้าเป็นคนในระบบ) — ใช้แสดงตำแหน่งใต้ช่อง */
  const toPerson = toChoices.find((o) => o.label === String(to || "").trim() && o.position);

  /** ผู้เบิกของใบนี้คือคนที่กำลังกรอกเองไหม — เงื่อนไขเดียวที่ลงลายเซ็นอิเล็กทรอนิกส์ได้ */
  const canSignSelf = Boolean(payToUserId) && payToUserId === userData?.userId;

  const validItems = items.filter((it) => String(it.description).trim());
  const problems = [];
  if (isClearClaim && !advance?._id) problems.push("เลือกใบ Advance ที่ต้องการเคลียร์");
  if (!String(subject).trim()) problems.push("ระบุเรื่อง");
  // ⚠️ ใบสำรองจ่ายยอด 0 ไม่มีความหมาย (ไม่มีอะไรให้จ่ายคืน) — บังคับรายการเหมือนใบ Advance
  if (!isClearClaim && !validItems.length) problems.push("เพิ่มรายการอย่างน้อย 1 รายการ");
  if (!isClearClaim && total <= 0) problems.push("ยอดที่ขอเบิกต้องมากกว่า 0");
  if (isClearClaim && !validItems.length && !String(note).trim()) problems.push("เพิ่มรายการที่ใช้จริง หรือระบุหมายเหตุหากไม่ได้ใช้เงินเลย");
  if (items.some((it) => String(it.description).trim() && Number(it.qty) <= 0)) problems.push("จำนวนต้องมากกว่า 0");
  // ✅ งานที่ล็อกมาจากตารางงานเปลี่ยนไม่ได้ — บอกให้ไปดูใบเดิม ไม่ใช่บอกให้ "เลือกงานอื่น" ที่ทำไม่ได้
  const jobLocked = Boolean(presetJob) && !editing;
  if (kind === "advance" && jobAdvance) {
    const jName = jobs.length > 1 ? `${jobText(jobs.find((j) => j._id === jobAdvance.eventId) || {}) || "งานหนึ่ง"}: ` : "";
    problems.push(jName + (jobLocked
      ? `ตรวจสอบใบเดิม — งานนี้มีใบเบิก Advance แล้ว (${jobAdvance.docNo}) ออกซ้ำไม่ได้`
      : `เอางานนี้ออก หรือเลือกงานอื่น — งานนี้มีใบเบิก Advance แล้ว (${jobAdvance.docNo})`));
  }

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
    if (!isClearClaim) {
      // ✅ หลายงาน — งานแรก = งานหลักของใบ (ส่ง eventId ไว้ด้วยให้ server รุ่นเก่ายังอ่านได้)
      fields.eventIds = jobs.map((j) => j._id);
      fields.eventId = job?._id || "";
      // กำหนดเคลียร์เป็นเรื่องของเงินที่จ่ายล่วงหน้าเท่านั้น ใบสำรองจ่ายไม่มีขั้นนี้
      if (!isClaim) fields.dueClearAt = dueClearAt || "";
      if (canPickPerson && requester?.userId) fields.requesterId = requester.userId;
    } else if (!editing) {
      fields.advanceId = advance._id;
    }
    // ✅ ลงลายเซ็นอิเล็กทรอนิกส์ในใบนี้หรือไม่ (ส่งเมื่อผู้เบิกคือตัวเองเท่านั้น — คนอื่นส่งไปก็ไม่มีผล)
    if (canSignSelf) fields.useSignature = useSignature;
    // ✅ บัญชีรับเงิน (ทุกชนิดใบ) — ส่งเฉพาะตอนที่มีการเลือก/เปลี่ยนจริง
    // ⚠️ ตอนแก้ใบเดิมไม่ส่งถ้าไม่ได้เปลี่ยน: ถ้าบัญชีนั้นถูกลบออกจากทะเบียนไปแล้ว การส่งซ้ำจะทำให้
    // บันทึกไม่ผ่านทั้งใบ ทั้งที่ผู้ใช้แค่มาแก้ยอด — สำเนาบัญชีในใบเดิมยังอยู่ครบอยู่แล้ว
    if (payToAccountId !== undefined && payToAccountId !== (expense?.payTo?.accountId || (editing ? "" : undefined))) {
      fields.payToAccountId = payToAccountId;
    }
    try {
      const payload = files.map((f) => ({ file: f.file, kind: f.kind }));
      const result = editing
        ? await ExpenseService.update(expense._id, fields, payload)
        : isReimburseForm
          ? await ExpenseService.createReimbursement(fields, payload)
          : isClaim
            ? await ExpenseService.createClaim(fields, payload)
            : await ExpenseService.createAdvance(fields, payload);
      const warn = result.rejected?.length
        ? `บันทึกแล้ว แต่มีไฟล์ที่แนบไม่ได้: ${result.rejected.map((r) => `${r.name} (${r.message})`).join(", ")}`
        : "";
      draft.clear(); // บันทึกสำเร็จ → ล้างข้อมูลที่กรอกค้าง
      onSaved?.(result.expense, { created: !editing, warn });
    } catch (err) {
      setError(errorText(err, "บันทึกไม่สำเร็จ"));
    } finally {
      setSaving(false);
    }
  };

  const resubmit = editing && expense.status === "rejected";
  // ✅ แผงรายละเอียดใบ Advance "ข้างๆ" ใบเคลม (ผู้ใช้ขอ) — จอกว้างวางคู่ขวามือ ติดอยู่กับที่ขณะเลื่อนฟอร์ม
  const showAdvancePanel = isClearClaim && Boolean(advance?._id) && Boolean(advance?.items);
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
  /**
    * ✅ พิมพ์ฟอร์มเปล่าไปกรอกด้วยลายมือได้ทั้งใบเคลมและใบสำรองจ่าย (ผู้ใช้ขอ) — เฉพาะตอนออกใบใหม่
    * ⚠️ ต่างกันตรงตัวเลือก: ใบเคลมมี 2 แบบให้เลือก (ผูกใบ Advance / เปล่าทั้งใบ) จึงต้องมีเมนู ส่วนใบ
    * สำรองจ่ายมีแบบเดียว (ไม่มี Advance ให้ผูกอยู่แล้ว) กดปุ่มแล้วเปิดเลย ไม่ต้องให้เลือกจากเมนูที่มีข้อเดียว
    */
   const canPrintBlank = (isClearClaim || isReimburseForm) && !editing;
  const openBlank = (variant) => {
    setBlankMenuEl(null);
    setBlankPrint({ variant, advance: variant === "advance" ? advance : null, printedBy: userData?.fname || "" });
  };
  const onPrintBlankClick = (e) => (isReimburseForm ? openBlank("reimburse") : setBlankMenuEl(e.currentTarget));

  return (
    <Dialog
      open={open}
      onClose={(_, reason) => { if (saving || reason === "backdropClick") return; onClose?.(); }}
      fullWidth maxWidth={isClearClaim ? "lg" : "md"} fullScreen={isMobile}
      PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3 } }}
    >
      <DialogTitle sx={{ p: 0 }}>
        {/* ✅ หัวกล่องเป็นสีประจำชนิดใบ (แถบบน + พื้นอ่อน + ป้าย ADVANCE/CLAIM) — เปิดขึ้นมาก็รู้ทันทีว่ากำลังกรอกใบไหน */}
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{
          px: { xs: 1.75, sm: 2.5 }, py: 1.25, borderBottom: `1px solid ${BORDER_MAIN}`, bgcolor: "#fff",
        }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "12px", flexShrink: 0, display: "grid", placeItems: "center", bgcolor: alpha(accent, 0.1), color: accent }}>
            {isReimburseForm ? <AccountBalanceWallet sx={{ fontSize: 22 }} /> : isClaim ? <ReceiptLong sx={{ fontSize: 22 }} /> : <Payments sx={{ fontSize: 22 }} />}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: { xs: "1rem", sm: "1.06rem" }, lineHeight: 1.3, color: TEXT_MAIN }}>
              {editing ? `แก้ไข ${expense.docNo || ""}` : `ออก${meta.label}`}
            </Typography>
            <Typography sx={{ color: TEXT_SUB, fontSize: "0.74rem", lineHeight: 1.35 }} component="div">
              {isReimburseForm
                ? "ค่าใช้จ่ายที่สำรองจ่ายไปก่อนแล้ว · แนบใบเสร็จให้ครบเพื่อขอเงินคืน"
                : isClaim ? "สรุปค่าใช้จ่ายจริงพร้อมหลักฐาน เพื่อเคลียร์เงินเบิกล่วงหน้า" : "ขอเบิกเงินล่วงหน้าเพื่อใช้ในงาน · หัวหน้าจะได้รับแจ้งทันที"}
            </Typography>
          </Box>
          <IconButton onClick={onClose} disabled={saving}><Close /></IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ bgcolor: "#f5f7fa", px: { xs: 1, sm: 2.5 }, pt: "12px !important", pb: 1, ...FORM_FIELD_SX }}>
        <DraftBanner draft={draft} />
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

        {/* ── ใบสำรองจ่าย: บอกให้ชัดว่าใบนี้ไม่มี Advance ─────────────── */}
        {isReimburseForm && (
          <Alert
            severity="info" icon={<AccountBalanceWallet fontSize="inherit" />}
            sx={{
              mb: 1.75, borderRadius: 2, bgcolor: meta.soft, color: meta.dark,
              border: "1px solid " + alpha(accent, 0.3), "& .MuiAlert-icon": { color: accent },
            }}
          >
            <b>สำรองจ่ายเอง</b> — ใบนี้ไม่ผูกกับใบเบิก Advance ใดๆ อนุมัติแล้วบริษัทจะ<b>จ่ายคืนเต็มยอด</b>ให้ผู้เบิก
            {" "}(ถ้าเคยเบิก Advance ไปแล้วสำหรับงานนี้ ให้ออก<b>ใบเคลม</b>เพื่อเคลียร์ใบนั้นแทน)
          </Alert>
        )}

        {/* ── ใบเคลม: เลือกใบ Advance ───────────────────────────────── */}
        {isClearClaim && (
          <Section accent={accent} icon={<LinkIcon sx={{ fontSize: 18, color: accent }} />} title="อ้างอิงใบเบิก Advance" hint="เลือกได้เฉพาะใบที่จ่ายเงินแล้วและยังไม่ได้เคลียร์">
            {editing ? (
              <Typography sx={{ fontWeight: 700 }}>{advance?.docNo} · {advance?.subject} · {baht(advance?.total)}</Typography>
            ) : (
              <SheetSelectField label="ใบ Advance" required value={advance?._id || ""} title="เลือกใบ Advance" placeholder="แตะเพื่อเลือกใบ Advance"
                error={touched && !advance} helperText={advanceOptions.length ? "" : "ไม่มีใบ Advance ที่รอเคลียร์"}
                options={advanceOptions.map((o) => ({ value: o._id, label: `${o.docNo} · ${o.subject}`, sub: [o.requester?.name, baht(o.total), o.payment?.at ? `รับเงิน ${thaiDate(o.payment.at)}` : ""].filter(Boolean).join(" · ") }))}
                onChange={(v) => pickAdvance(advanceOptions.find((o) => o._id === v) || null)} />
            )}
            {advance?._id && (
              <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={{ mt: 1.25 }} alignItems="center">
                <Chip size="small" label={`ผู้เบิก ${advance.requester?.name || "-"}`} />
                <Chip size="small" label={`ยอดเบิก ${baht(advance.total)}`} sx={{ fontWeight: 700, bgcolor: alpha(KIND_META.advance.color, 0.12), color: KIND_META.advance.dark }} />
                {advance.job?.title && <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, minWidth: 0 }}><JobTypeChip job={advance.job} /><Typography component="span" noWrap sx={{ fontSize: "0.8rem", fontWeight: 700 }}>{(jobText(advance.job) || "").replace(advance.job.title, "").trim()}</Typography></Box>}
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
        <Section accent={accent} icon={<DescriptionIcon />} title="ข้อมูลเอกสาร" hint="ตรงกับหัวแบบฟอร์มกระดาษ ใบเบิกค่าใช้จ่าย">
          <Box sx={{ display: "grid", gap: 1.5, alignItems: "start", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
            <ThaiDatePicker label="วันที่" value={docDate} onChange={(v) => setDocDate(v || moment().format("YYYY-MM-DD"))} />
            <SheetSelectField label="ถึง (ผู้มีอำนาจอนุมัติ)" value={to} allowCreate title="เลือกผู้มีอำนาจอนุมัติ" placeholder="แตะเพื่อเลือก หรือพิมพ์ชื่อ"
              options={toChoices.map((o) => ({ value: o.label, label: o.label, sub: o.position || "ชื่อที่เคยใช้ในใบก่อนหน้า", person: true, avatar: o.imageUrl }))}
              onChange={(v) => setTo(String(v || ""))}
              helperText={toPerson ? `ตำแหน่ง: ${toPerson.position}` : String(to || "").trim() ? "ชื่อนอกระบบ (พิมพ์เอง)" : "เลือกผู้มีอำนาจอนุมัติ"} />
            {canPickPerson ? (
              <SheetSelectField label="ชื่อผู้เบิกเงิน" value={requester?.userId || ""} title="เลือกผู้เบิกเงิน"
                options={people.map((pp) => ({ value: pp.userId, label: pp.fullName || pp.name || "", sub: pp.position || "", person: true, avatar: pp.imageUrl }))}
                renderValue={(o) => o?.label || personFullName(requester) || ""}
                onChange={(v) => {
                  const pp = people.find((x) => x.userId === v);
                  if (!pp) return;
                  setRequester(pp);
                  setPosition(pp.position || "");
                  // ⚠️ เปลี่ยนผู้เบิก = บัญชีของคนเดิมใช้ไม่ได้แล้ว ล้างแล้วให้เลือกบัญชีหลักของคนใหม่
                  setPayToAccountId(undefined);
                }}
                helperText={requester?.userId && requester.userId !== userData?.userId ? "เบิกแทน — ผู้เบิกจะได้รับแจ้งและต้องเป็นคนเคลียร์ใบ" : ""} />
            ) : (
              <TextField size="small" label="ชื่อผู้เบิกเงิน"
                // ✅ ชื่อ-นามสกุล (ผู้ใช้ขอ) — ใบใหม่ยังไม่มี fullName จาก server จึงหาจากรายชื่อพนักงานที่โหลดมาแทน
                // ⚠️ ทะเบียนพนักงานมาก่อน — requester ของใบใหม่มีแค่ชื่อต้นจาก userData (ไม่มีนามสกุล)
                value={isClearClaim
                  ? people.find((p) => p.userId === advance?.requester?.userId)?.fullName || personFullName(advance?.requester) || personFullName(requester)
                  : payToOwnerName}
                InputProps={{ readOnly: true }}
                helperText={isClearClaim ? "ผู้เบิกของใบเคลม = ผู้รับเงิน Advance" : isReimburseForm ? "ผู้เบิก = คนที่สำรองจ่ายและจะได้รับเงินคืน" : undefined} />
            )}
            {/* ⚠️ ตำแหน่งของ "ผู้เบิก" ไม่ใช่ของคนในช่อง "ถึง" — ป้ายต้องบอกให้ชัด เพราะวางติดกัน */}
            <TextField size="small" label="ตำแหน่งผู้เบิก" value={position} onChange={(e) => setPosition(e.target.value)} />
            <TextField
              size="small" label="เรื่อง *" value={subject} onChange={(e) => setSubject(e.target.value)}
              placeholder={isReimburseForm ? "เช่น ค่าน้ำมัน/ทางด่วน งาน PM ที่สำรองจ่ายไปก่อน" : isClaim ? "เคลียร์ค่าใช้จ่าย ..." : "เช่น เบิกเบี้ยเลี้ยง น.ศ. ฝึกงาน / ค่าเดินทางงาน PM"}
              error={touched && !String(subject).trim()}
              sx={{ gridColumn: { sm: "1 / -1" } }} inputProps={{ maxLength: 300 }}
            />
            {/* 🔁 (13 พ.ย. 2569 ผู้ใช้: "Select งานยังเป็นแบบเดิม") ผูกงานจากแผ่นรายการแบบหน้าลงงาน — ค้นหาบนสุด · ติ๊กได้หลายงาน */}
            {!isClearClaim && (() => {
              const applyJobs = (v) => {
                // ✅ เปิดมาจากเมนู "เบิก Advance งานนี้" — งานนั้นเอาออกไม่ได้ (เพิ่มงานอื่นได้)
                let next = v.slice(0, 20);
                if (presetJob && !editing && !next.some((j) => j._id === presetJob._id)) next = [presetJob, ...next];
                setJobs(next);
                // ✅ เติมเรื่องจากงานให้ — เฉพาะตอนช่องเรื่องยังว่างหรือยังเป็นค่าที่ระบบเติมไว้ (ไม่ทับที่ผู้ใช้พิมพ์เอง)
                const subj = jobsSubject(next, subjectPrefix);
                const autoForms = new Set([autoSubjectRef.current, jobsSubject(jobs, subjectPrefix), jobs[0] ? jobSubject(jobs[0], subjectPrefix) : ""].filter(Boolean));
                setSubject((cur) => (!String(cur).trim() || autoForms.has(cur) ? subj : cur));
                autoSubjectRef.current = subj;
              };
              const shown = [...jobs, ...jobOptions.filter((o) => !jobs.some((j) => j._id === o._id))];
              const takenOf = (o) => kind === "advance" && o.advance && o.advance._id !== expense?._id;
              return (
                <>
                  <PickerField sx={{ gridColumn: { sm: "1 / -1" } }} onClick={() => setJobSheet(true)} error={Boolean(jobAdvance)}
                    label={jobs.length > 1 ? `งานที่อ้างอิง (${jobs.length} งาน)` : presetJob && !editing ? "งานที่เบิก" : "ผูกกับงาน (ไม่บังคับ · เลือกได้หลายงาน)"}
                    placeholder="แตะเพื่อเลือกงาน"
                    helperText={presetJob && !editing
                      ? "เปิดจากตารางงาน — ผูกกับงานนี้แล้ว · เพิ่มงานอื่นที่ใช้ค่าใช้จ่ายร่วมกันได้"
                      : jobs.length > 1
                        ? "อ้างอิงหลายงานในใบเดียว — งานแรกเป็นงานหลักของใบ (ใช้ในรายงาน)"
                        : kind === "advance"
                          ? "1 ช่วงงานออกได้ 1 ใบ — งานที่เข้าหลายช่วง เบิกแยกได้ทุกช่วง · ผูกงานแล้วดูงบที่ใช้ได้ในหน้ารายงาน"
                          : "ผูกงานแล้วจะดูได้ว่างานนี้ใช้งบไปเท่าไรในหน้ารายงาน · ค่าใช้จ่ายรวมหลายงาน เลือกเพิ่มได้"}>
                    {jobs.length ? (
                      <Stack direction="row" flexWrap="wrap" gap={0.5} alignItems="center">
                        {jobs.map((o, i) => {
                          const taken = kind === "advance" && jobAdvance?.eventId === o._id;
                          return <Chip key={o._id} size="small" label={`${i === 0 && jobs.length > 1 ? "หลัก · " : ""}${jobChipText(o) || o.title || ""}`}
                            sx={{ maxWidth: "100%", fontWeight: 700, ...(taken ? { bgcolor: alpha("#dc2626", 0.1), color: "#b91c1c" } : {}) }} />;
                        })}
                        {(jobLoading || jobAdvanceChecking) && <CircularProgress size={14} />}
                      </Stack>
                    ) : null}
                  </PickerField>
                  <SheetPicker open={jobSheet} onClose={() => setJobSheet(false)} title="เลือกงาน" subtitle="ค้นหาชื่องาน / โครงการ / เลขที่ · ติ๊กได้หลายงาน"
                    query={jobQuery} onQuery={setJobQuery} loading={jobLoading} count={shown.length} emptyText="ไม่พบงาน">
                    {shown.map((o) => {
                      const sel = jobs.some((j) => j._id === o._id);
                      const locked = presetJob && !editing && o._id === presetJob._id;
                      const taken = takenOf(o);
                      return (
                        <SheetPickerRow key={o._id} multi selected={sel} disabled={(!sel && Boolean(taken)) || Boolean(locked)}
                          onClick={() => applyJobs(sel ? jobs.filter((j) => j._id !== o._id) : [...jobs, o])}>
                          <JobOptionRow job={o} main={jobText(o) || o.title}
                            extra={jobPartText(o) ? (
                              <Chip size="small" label={jobPartText(o)} sx={{ height: 18, fontSize: "0.65rem", fontWeight: 800, bgcolor: alpha("#0f766e", 0.12), color: "#0f766e" }} />
                            ) : null}
                            sub={[
                              jobRangeText(o),
                              o.company && o.site && o.company !== o.site ? `บริษัท ${o.company}` : "",
                              o.teamNames?.length ? `ผู้เข้างานช่วงนี้ ${o.teamNames.join(", ")}` : "",
                              o.docNo ? `เลขที่ ${o.docNo}` : "",
                              taken ? `ช่วงนี้มีใบแล้ว ${o.advance.docNo}` : o.status || "",
                            ].filter(Boolean).join(" · ")} />
                        </SheetPickerRow>
                      );
                    })}
                  </SheetPicker>
                </>
              );
            })()}
            {!isClearClaim && jobAdvance && (
              <Alert
                severity="warning"
                sx={{ gridColumn: { sm: "1 / -1" }, borderRadius: 2, "& .MuiAlert-message": { fontSize: "0.82rem", width: "100%" } }}
                action={jobAdvance.canOpen ? (
                  <Button color="inherit" size="small" sx={{ textTransform: "none", fontWeight: 800, whiteSpace: "nowrap" }}
                    onClick={() => { onClose?.(); navigate(`/expenses/${jobAdvance._id}`); }}>
                    เปิดดูใบนี้
                  </Button>
                ) : undefined}
              >
                <b>งานนี้มีใบเบิก Advance แล้ว</b> — {jobAdvance.docNo} · {jobAdvance.statusLabel}
                {jobAdvance.requesterName ? ` · ผู้เบิก ${jobAdvance.requesterName}` : ""}
                <br />1 งานออกใบ Advance ได้ใบเดียว{presetJob && !editing ? "" : " — เลือกงานอื่น หรือไม่ผูกงาน"}
                {jobAdvance.status === "rejected" ? " (ใบเดิมถูกตีกลับ ให้แก้ไขใบนั้นแล้วส่งใหม่)" : ""}
              </Alert>
            )}
          </Box>
        </Section>

        {/* ── รายการ ───────────────────────────────────────────────── */}
        <Section
          title={isReimburseForm ? "รายการที่สำรองจ่ายไปแล้ว" : isClaim ? "รายการค่าใช้จ่ายจริง" : "รายการที่ขอเบิก"}
          hint={isReimburseForm ? "กรอกตามใบเสร็จที่มีจริง · แนบไฟล์ใบเสร็จด้านล่างให้ครบ" : isClaim ? "แก้ยอดให้ตรงใบเสร็จ · เพิ่ม/ลบรายการได้" : "จำนวน × ราคาต่อหน่วย ระบบคำนวณยอดให้"}
          action={<Typography sx={{ fontWeight: 800, color: accent, whiteSpace: "nowrap" }}>{baht(total)}</Typography>}
        >
          {touched && !isClearClaim && !validItems.length && <Alert severity="error" sx={{ mb: 1 }}>เพิ่มรายการอย่างน้อย 1 รายการ</Alert>}
          <Stack spacing={1.25}>
            {items.map((row, idx) => {
              const cat = categoryMeta(row.category);
              const amount = itemAmount(row);
              const planned = isClaim && Number.isInteger(row.advanceItemIndex) ? advance?.items?.[row.advanceItemIndex] : null;
              const plannedDiff = planned ? money(amount - (planned.amount || 0)) : 0;
              /**
               * 🔁 (13 พ.ย. 2569 ผู้ใช้: "รูปแบบรายการจัดวางให้ดูง่าย สวยงาม ใช้งานง่าย") การ์ดรายการแบบเดียวกับการ์ดรายวันของใบค่าจ้าง:
               *    หัว: เลขรายการ · หมวด (จุดสี) · ยอดเงิน · ลบ
               *    ① หมวด ② รายการ ③ จำนวน · หน่วย ④ ราคา/หน่วย (เด่น) ⑤ เลขที่ใบเสร็จ (ใบเคลม) ⑥ พนักงาน · รายละเอียดเพิ่มเติม
               */
              return (
                <Box key={row.key} sx={{ bgcolor: "#fff", borderRadius: "14px", overflow: "hidden", border: `1.5px solid ${BORDER_MAIN}` }}>
                  <Stack direction="row" alignItems="center" gap={1} sx={{ px: 1.25, py: 0.75, bgcolor: alpha(cat.color, 0.06), borderBottom: `1px solid ${BORDER_MAIN}` }}>
                    <Box sx={{ minWidth: 24, height: 24, px: 0.6, borderRadius: 99, display: "grid", placeItems: "center", bgcolor: cat.color, color: "#fff", fontSize: "0.72rem", fontWeight: 900 }}>{idx + 1}</Box>
                    <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.86rem", fontWeight: 800, color: "#0f172a" }}>
                      {String(row.description || "").trim() || cat.label}
                      <Box component="span" sx={{ ml: 0.75, fontSize: "0.74rem", fontWeight: 800, color: cat.color }}>{cat.label}</Box>
                    </Typography>
                    <Box sx={{ textAlign: "right" }}>
                      <Typography sx={{ fontWeight: 900, fontSize: "0.92rem", color: "#0f172a", whiteSpace: "nowrap" }}>{baht(amount)}</Typography>
                      {planned && (
                        <Typography sx={{ fontSize: "0.68rem", lineHeight: 1.1, color: plannedDiff === 0 ? TEXT_SUB : plannedDiff > 0 ? "#2563eb" : "#d97706", whiteSpace: "nowrap" }}>
                          ตั้งเบิก {fmtMoney(planned.amount)}
                        </Typography>
                      )}
                    </Box>
                    <Tooltip title="ลบรายการ">
                      <span>
                        <IconButton size="small" aria-label="ลบรายการ" onClick={() => removeItem(row.key)} disabled={!isClearClaim && items.length === 1} sx={{ mr: -0.5 }}>
                          <DeleteOutline fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                  <Box sx={{ p: 1.25, display: "grid", gap: 1.25, alignItems: "end", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, minmax(0, 1fr))" } }}>
                    {/* หมวดเลือกจากแผ่นรายการแบบหน้าลงงาน · จุดสีประจำหมวด */}
                    <SheetSelectField label="หมวด" value={row.category} title="เลือกหมวดค่าใช้จ่าย" sort={false}
                      sx={{ gridColumn: { xs: "1 / -1", md: "span 2" } }}
                      options={EXPENSE_CATEGORIES.map((c) => ({ value: c.value, label: c.label, icon: `<span style="flex-shrink:0;width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:${c.color}1f"><span style="width:10px;height:10px;border-radius:50%;background:${c.color}"></span></span>` }))}
                      renderValue={(o) => <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}><Box component="span" sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: cat.color }} />{o?.label}</Box>}
                      onChange={(v) => onCategory(row, v)} />
                    <TextField
                      size="small" label="รายการ *" value={row.description}
                      onChange={(e) => setItem(row.key, { description: e.target.value })}
                      error={touched && !String(row.description).trim()}
                      sx={{ gridColumn: { xs: "1 / -1", md: "span 2" } }} inputProps={{ maxLength: 300 }}
                    />
                    <TextField
                      size="small" label="จำนวน" type="number" value={row.qty}
                      onChange={(e) => setItem(row.key, { qty: e.target.value })}
                      inputProps={{ min: 0, step: "any", ...numberField }}
                      error={Number(row.qty) <= 0}
                    />
                    <TextField size="small" label="หน่วย" value={row.unit} onChange={(e) => setItem(row.key, { unit: e.target.value })} inputProps={{ maxLength: 30 }} />
                    {/* ราคา/หน่วย — ช่องเงินเด่นแบบเดียวกับ "ค่าแรงรวม" ในใบค่าจ้าง */}
                    <TextField
                      size="small" label="ราคา/หน่วย" type="number" value={row.unitPrice} placeholder="0"
                      onChange={(e) => setItem(row.key, { unitPrice: e.target.value })}
                      inputProps={{ min: 0, step: "any", ...numberField }}
                      InputProps={{ startAdornment: <InputAdornment position="start"><Box component="span" sx={{ fontWeight: 900, color: accent }}>฿</Box></InputAdornment>,
                        endAdornment: <InputAdornment position="end">บาท</InputAdornment> }}
                      sx={{
                        gridColumn: { xs: "1 / -1", md: isClaim ? "span 1" : "span 2" },
                        "& > .MuiInputLabel-root": { color: `${accent} !important` },
                        "& .MuiOutlinedInput-root": { bgcolor: alpha(accent, 0.05), minHeight: 50 },
                        "& .MuiOutlinedInput-notchedOutline": { borderColor: `${alpha(accent, 0.55)} !important`, borderWidth: "2px !important" },
                        "& .MuiInputBase-input": { fontSize: "1.2rem", fontWeight: 900, color: "#0f172a", fontVariantNumeric: "tabular-nums" },
                      }}
                    />
                    {isClaim && (
                      <TextField size="small" label="เลขที่ใบเสร็จ" value={row.receiptNo} onChange={(e) => setItem(row.key, { receiptNo: e.target.value })} inputProps={{ maxLength: 60 }}
                        sx={{ gridColumn: { xs: "1 / -1", md: "span 1" } }} />
                    )}
                    {/* ✅ พนักงานของรายการนี้ (ไม่บังคับ) — หัวหน้างานเบิกแทนลูกทีมได้ในใบเดียว แยกบรรทัดละคน
                        พิมพ์ชื่อคนนอกระบบได้ (น.ศ. ฝึกงาน/แรงงานรายวัน) · เลือกจากรายชื่อ = ผูกกับทะเบียนพนักงาน */}
                    <SheetSelectField label="พนักงาน (ไม่บังคับ)" value={row.person?.name || ""} allowCreate title="พนักงานของรายการนี้" placeholder="แตะเพื่อเลือก"
                      sx={{ gridColumn: { xs: "1 / -1", md: "span 2" } }}
                      startIcon={row.person?.name ? null : <PersonOutline sx={{ fontSize: 18, color: TEXT_SUB }} />}
                      options={people.map((pp) => ({ value: pp.fullName || pp.name, label: pp.fullName || pp.name, sub: pp.position || "", person: true, avatar: pp.imageUrl }))}
                      onChange={(v, isNew) => {
                        const name = String(v || "").trim().slice(0, 80);
                        const match = !isNew && people.find((pp) => (pp.fullName || pp.name) === name);
                        setItem(row.key, { person: name ? { userId: match?.userId || "", name } : null });
                      }} />
                    <TextField
                      size="small" label="รายละเอียดเพิ่มเติม (ไม่บังคับ)" placeholder="เช่น ช่วงวันที่ / ทะเบียนรถ"
                      value={row.detail} onChange={(e) => setItem(row.key, { detail: e.target.value })}
                      sx={{ gridColumn: { xs: "1 / -1", md: "span 2" } }} inputProps={{ maxLength: 300 }}
                    />
                  </Box>
                </Box>
              );
            })}
          </Stack>
          {/* 🔁 (13 พ.ย. 2569) ปุ่มเพิ่มรายการเต็มแถว (กดง่ายบนมือถือ) · ทางลัดหมวดเป็นชิปเลื่อนข้างแถวเดียว */}
          <Button fullWidth variant="outlined" startIcon={<Add />} onClick={() => addItem("other")} disabled={items.length >= MAX_ITEMS}
            sx={{ mt: 1.25, height: 44, textTransform: "none", fontWeight: 800, borderRadius: "12px", borderStyle: "dashed", borderWidth: 1.5, borderColor: alpha(accent, 0.55), color: accent, "&:hover": { borderWidth: 1.5, borderStyle: "dashed" } }}>
            เพิ่มรายการ
          </Button>
          <Stack direction="row" useFlexGap spacing={0.75} sx={{ mt: 1, flexWrap: { xs: "nowrap", sm: "wrap" }, overflowX: "auto", pb: 0.5, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" }, "& > *": { flexShrink: 0 } }}>
            {teamNames.length > 0 && !isClearClaim && (
              <Tooltip describeChild title={`เพิ่มรายการเบี้ยเลี้ยงให้ทุกคนในงานนี้ คนละบรรทัด: ${teamNames.join(", ")}`}>
                <Chip size="small" icon={<Groups sx={{ fontSize: "16px !important" }} />} label={`เบี้ยเลี้ยงทีมงาน (${teamNames.length} คน)`}
                  onClick={addTeamAllowance} disabled={items.length >= MAX_ITEMS}
                  sx={{ fontWeight: 800, bgcolor: alpha(accent, 0.1), color: meta.dark, "& .MuiChip-icon": { color: meta.dark } }} />
              </Tooltip>
            )}
            {QUICK_ADD.map((c) => (
              <Chip key={c} size="small" variant="outlined" icon={<Add sx={{ fontSize: "15px !important" }} />} label={categoryMeta(c).label}
                onClick={() => addItem(c)} disabled={items.length >= MAX_ITEMS} sx={{ fontWeight: 600 }} />
            ))}
          </Stack>

          {/* ✅ สรุปยอดตามพนักงาน — โชว์เมื่อมีการระบุพนักงานในรายการ ให้หัวหน้างานเห็นว่าต้องแบ่งเงินให้ใครเท่าไร */}
          {personTotals.length > 0 && (
            <Box sx={{ mt: 1.25, p: 1.25, borderRadius: 2, border: `1px solid ${BORDER_MAIN}`, bgcolor: "#fff" }}>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.75 }}>
                <Groups sx={{ fontSize: 17, color: TEXT_SUB }} />
                <Typography sx={{ fontWeight: 800, fontSize: "0.82rem", color: TEXT_MAIN }}>แยกตามพนักงาน</Typography>
              </Stack>
              <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75}>
                {personTotals.map((p) => (
                  <Chip key={p.name} size="small" variant="outlined"
                    label={<><b>{p.name}</b>&nbsp;{baht(p.amount)}{p.lines > 1 ? ` · ${p.lines} รายการ` : ""}</>}
                    sx={{ fontSize: "0.76rem" }} />
                ))}
              </Stack>
            </Box>
          )}

          {/* ── สรุปยอด ─────────────────────────────────────────────── */}
          <Box sx={{ mt: 1.75, p: 1.5, borderRadius: 2, bgcolor: alpha(accent, 0.06), border: `1px dashed ${alpha(accent, 0.35)}` }}>
            {isReimburseForm ? (
              <Stack direction="row" alignItems="baseline" justifyContent="space-between">
                <Box>
                  <Typography sx={{ fontWeight: 700, color: TEXT_SUB }}>รวมขอเบิกคืน</Typography>
                  <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>บริษัทจ่ายคืนให้ผู้เบิกเต็มจำนวนหลังอนุมัติ</Typography>
                </Box>
                <Typography sx={{ fontWeight: 900, fontSize: "1.3rem", color: accent }}>{baht(total)}</Typography>
              </Stack>
            ) : isClaim ? (
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

        {/* ── บัญชีรับเงินของผู้เบิก ─────────────────────────────────── */}
        {/* ✅ ทุกชนิดใบ — ใบ Advance ก็โอนเงินให้ผู้เบิกเหมือนกัน (ผู้ใช้ขอ "ทำในใบ advance ด้วย") */}
        <Section
          accent={accent}
          icon={<AccountBalance sx={{ fontSize: 18, color: accent }} />}
          title="บัญชีรับเงินของผู้เบิก"
          hint={!isClaim
            ? "บัญชีที่บริษัทจะโอนเงินล่วงหน้าให้ · เพิ่มบัญชีใหม่ได้เลยไม่ต้องออกจากหน้านี้"
            : isReimburseForm
              ? "บริษัทจะโอนเงินคืนเต็มยอดเข้าบัญชีนี้ · เพิ่มบัญชีใหม่ได้เลยไม่ต้องออกจากหน้านี้"
              : "ใช้ตอนที่บริษัทต้องจ่ายเพิ่ม (ใช้จริงมากกว่ายอด Advance) · เพิ่มบัญชีใหม่ได้เลยไม่ต้องออกจากหน้านี้"}
        >
          {payToUserId ? (
            <BankAccountPicker
              userId={payToUserId}
              ownerName={payToOwnerName}
              value={payToAccountId}
              onChange={(id) => setPayToAccountId(id)}
              accent={accent}
              canManage={canManageBank}
              autoSelectDefault={!editing}
              snapshot={expense?.payTo || null}
            />
          ) : (
            <Typography variant="caption" sx={{ color: TEXT_SUB }}>
              เลือกใบ Advance ก่อน แล้วจะเลือกบัญชีของผู้เบิกได้
            </Typography>
          )}
        </Section>

        {/* ── ลายเซ็นอิเล็กทรอนิกส์ ───────────────────────────────────
            ✅ ติ๊กเลือกได้ว่าจะลงลายเซ็นในใบนี้ไหม (ผู้ใช้ขอ) — บางใบต้องการเซ็นสดด้วยมือต่อหน้าผู้อนุมัติ
            ⚠️ โชว์เฉพาะตอนผู้เบิกเป็นตัวเอง — ออกใบแทนคนอื่นต้องเว้นช่องให้เจ้าตัวเซ็นเสมอ */}
        {canSignSelf && (
          <Section accent={accent} icon={<HistoryEdu sx={{ fontSize: 18, color: accent }} />} title="ลายเซ็นอิเล็กทรอนิกส์"
            hint="ลายเซ็นที่ตั้งไว้ในหน้าตั้งค่า จะถูกพิมพ์ลงช่องผู้เบิกของใบ PDF">
            {mySignature ? (
              <>
                <FormControlLabel
                  sx={{ mr: 0 }}
                  control={(
                    <Checkbox size="small" checked={useSignature} onChange={(e) => setUseSignature(e.target.checked)}
                      sx={{ "&.Mui-checked": { color: accent } }} />
                  )}
                  label={<Typography sx={{ fontSize: "0.85rem", fontWeight: 700 }}>ลงลายเซ็นอิเล็กทรอนิกส์ของฉันในใบนี้</Typography>}
                />
                <Stack direction="row" alignItems="center" spacing={1.25} sx={{ pl: 3.75 }}>
                  <Box component="img" src={mySignature.image} alt=""
                    sx={{ height: 34, maxWidth: 150, objectFit: "contain", opacity: useSignature ? 1 : 0.28, transition: "opacity .15s" }} />
                  <Typography variant="caption" sx={{ color: TEXT_SUB }}>
                    {useSignature ? "ลายเซ็นจะขึ้นในช่อง “ผู้เบิกค่าใช้จ่าย” ของใบ PDF" : "ไม่ติ๊ก = เว้นช่องไว้เซ็นด้วยมือ"}
                  </Typography>
                </Stack>
              </>
            ) : (
              <Typography variant="caption" sx={{ color: TEXT_SUB }}>
                ยังไม่ได้ตั้งลายเซ็นอิเล็กทรอนิกส์ — ใบนี้จะเว้นช่องไว้ให้เซ็นด้วยมือ (ตั้งได้ที่ ตั้งค่า › ลายเซ็นอิเล็กทรอนิกส์)
              </Typography>
            )}
          </Section>
        )}

        {/* ── เพิ่มเติม ───────────────────────────────────────────── */}
        <Section accent={accent} icon={<NotesIcon />} title="หมายเหตุและหลักฐาน" hint={isClaim ? "แนบรูปใบเสร็จ/บิลให้ครบ ผู้อนุมัติจะตรวจจากไฟล์เหล่านี้" : "แนบใบเสนอราคา/รูปประกอบได้ (ไม่บังคับ)"}>
          <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: isClaim ? "1fr" : "1fr 220px" } }}>
            <TextField size="small" label="หมายเหตุ" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} inputProps={{ maxLength: 1000 }}
              placeholder={isReimburseForm ? "เช่น จ่ายสดหน้างาน ใบเสร็จอยู่ในรูปที่แนบ" : isClaim ? "เช่น ไม่ได้ใช้เงินเพราะงานเลื่อน / ใบเสร็จบางใบสูญหาย" : ""} />
            {!isClaim && (
              <ThaiDatePicker label="กำหนดเคลียร์ (ไม่บังคับ)" value={dueClearAt} onChange={(v) => setDueClearAt(v || "")}
                helperText="ว่างไว้ = 7 วันหลังรับเงิน" />
            )}
          </Box>
          {/* ── ไฟล์แนบ ────────────────────────────────────────────────
              🐛 ผู้ใช้แจ้ง: "ระยะตรงแนบไฟล์ จุดวางอาจจะสับสนว่าคืออะไร" — เดิมปุ่มแนบไฟล์เป็นปุ่มลอยๆ
              อยู่ใต้ช่องหมายเหตุ ไม่มีหัวข้อกำกับ และมีบล็อกลายเซ็นมาคั่นกลาง เลยไม่รู้ว่าปุ่มนั้นของอะไร
              ✅ รวมเป็นกล่องเดียวมีหัวข้อ "ไฟล์แนบ" + บอกชนิดไฟล์ที่ควรแนบ + กดที่กล่องเพื่อเลือกไฟล์ได้เลย */}
          <Box sx={{ mt: 1.75 }}>
            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.75 }}>
              <AttachFile sx={{ fontSize: 16, color: TEXT_SUB }} />
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 800, color: TEXT_MAIN }}>ไฟล์แนบ</Typography>
              {files.length > 0 && (
                <Chip size="small" label={`${files.length} ไฟล์`} sx={{ height: 18, fontSize: "0.68rem", fontWeight: 700, bgcolor: alpha(accent, 0.12), color: accent }} />
              )}
            </Stack>
            <input ref={fileInputRef} type="file" hidden multiple accept={ACCEPT_ALL}
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            <Box
              onClick={() => fileInputRef.current?.click()}
              sx={{
                p: 1.5, border: `1px dashed ${alpha(accent, 0.45)}`, borderRadius: 2, bgcolor: alpha(accent, 0.03),
                textAlign: "center", cursor: "pointer", transition: "background-color .15s",
                "&:hover": { bgcolor: alpha(accent, 0.07) },
              }}
            >
              <AttachFile sx={{ fontSize: 20, color: accent }} />
              <Typography sx={{ fontSize: "0.85rem", fontWeight: 700, color: accent }}>
                {isClaim ? "แนบใบเสร็จ / รูปถ่าย" : "แนบไฟล์ประกอบ"}
              </Typography>
              <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>
                {isClaim ? "รูปใบเสร็จ บิล สลิปโอน — ผู้อนุมัติจะตรวจจากไฟล์เหล่านี้" : "ใบเสนอราคา รูปหน้างาน หรือเอกสารประกอบ (ไม่บังคับ)"}
              </Typography>
              {/* ✅ บอกกฎขนาดไฟล์ตั้งแต่ก่อนเลือก — ผู้ใช้จะได้ไม่เสียเวลาอัปรูปใหญ่แล้วโดนปฏิเสธทีหลัง */}
              <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 0.25 }}>
                ระบบย่อรูปให้อัตโนมัติก่อนอัปโหลด · รองรับ JPG PNG HEIC PDF Word Excel · ไฟล์ละไม่เกิน {MAX_UPLOAD_MB} MB
              </Typography>
            </Box>
            <Stack spacing={0.75} sx={{ mt: 1 }}>
              {files.map((f) => (
                <Stack key={f.key} direction="row" alignItems="center" spacing={1} sx={{ p: 0.75, pl: 1.25, border: `1px solid ${BORDER_MAIN}`, borderRadius: 2, bgcolor: "#fff" }}>
                  <AttachFile sx={{ fontSize: 17, color: TEXT_SUB }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.82rem", fontWeight: 600 }} noWrap>{f.file.name}</Typography>
                    <Typography variant="caption" sx={{ color: TEXT_SUB }}>{formatBytes(f.file.size)}</Typography>
                  </Box>
                  <SheetSelectField dense value={f.kind} title="ชนิดไฟล์" sort={false} sx={{ width: 140, flexShrink: 0 }}
                    options={FILE_KINDS.map((k) => ({ value: k.value, label: k.label }))}
                    onChange={(v) => setFiles((cur) => cur.map((x) => (x.key === f.key ? { ...x, kind: v } : x)))} />
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); setFiles((cur) => cur.filter((x) => x.key !== f.key)); }}><Close fontSize="small" /></IconButton>
                </Stack>
              ))}
            </Stack>
          </Box>
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
              onClick={onPrintBlankClick} disabled={saving}
              startIcon={<Print sx={{ fontSize: 18 }} />}
              aria-haspopup={isReimburseForm ? undefined : "menu"} aria-expanded={isReimburseForm ? undefined : Boolean(blankMenuEl)}
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
          variant="contained" onClick={submit} disabled={saving || (jobLocked && kind === "advance" && Boolean(jobAdvance))}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : editing && !resubmit ? <Save sx={{ fontSize: 18 }} /> : <Send sx={{ fontSize: 17 }} />}
          sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, px: 2.5, boxShadow: "none", whiteSpace: "nowrap", bgcolor: accent, "&:hover": { bgcolor: meta.dark, boxShadow: "none" } }}
        >
          {saving ? "กำลังบันทึก..." : resubmit ? "ส่งใหม่" : editing ? "บันทึก" : "ส่งขออนุมัติ"}
        </Button>
      </DialogActions>

      {canPrintBlank && !isReimburseForm && (
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
