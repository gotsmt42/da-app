/**
 * ContractorFormDialog — ฟอร์มออก/แก้ไข "ใบเบิกค่าจ้างผู้รับเหมา"
 *
 * ✅ ผู้ใช้สั่ง (28 ก.ย. 2569): "เพิ่มระบบเบิกเงินผู้รับเหมาให้สมบูรณ์มืออาชีพ" · "ใบนี้ไม่มี advance คือเบิกค่าแรงเลย"
 *   • พนักงานกรอกแทนผู้รับเหมา — ผู้รับเหมาเป็นคนนอกระบบ ข้อมูลของเขาอยู่ในใบ (ชื่อ/เลขภาษี/ที่อยู่/บัญชี)
 *   • ผูกงาน + งวดงาน + มูลค่าตามสัญญา → เห็นยอดเบิกสะสมและคงเหลือของผู้รับเหมาคนนี้ในงานนี้ทันที
 *   • VAT / หัก ณ ที่จ่าย / หักเงินมัดจำ-เบิกล่วงหน้า → ยอดจ่ายสุทธิคำนวณสดระหว่างกรอก
 *
 * ⚠️ แยกจาก ExpenseFormDialog โดยตั้งใจ — ใบนี้ไม่มีบัญชีพนักงาน/เบี้ยเลี้ยงทีม/ใบ Advance แต่มีผู้รับเหมา
 * งวดงาน และยอดหักที่ใบอื่นไม่มี ถ้ายัดรวมกันฟอร์มเดิม (1,100+ บรรทัด) จะมีเงื่อนไขซ้อนกันจนแก้ไม่ได้
 * ⚠️ ตัวเลขบนหน้าจอเป็นพรีวิว — server คำนวณใหม่ทั้งหมดเสมอ (contractorMoney ใน routes/expenses.js)
 */
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography, TextField, IconButton, Alert,
  useMediaQuery, Chip, Tooltip, CircularProgress, ToggleButton, ToggleButtonGroup,
  Checkbox, FormControlLabel, InputAdornment, LinearProgress,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { CloseRounded as Close, AddRounded as Add, DeleteOutlineRounded as DeleteOutline, AttachFileRounded as AttachFile, SendRounded as Send, SaveRounded as Save, EngineeringRounded as Engineering, AccountBalanceRounded as AccountBalance, PaymentsRounded as Payments, HistoryEduRounded as HistoryEdu, BusinessRounded as Business, PersonRounded as Person, ReceiptRounded as Receipt, WorkRounded as Work, DescriptionRounded as DescriptionIcon, NotesRounded as NotesIcon } from "@mui/icons-material";

import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import { ACCEPT_ALL, formatBytes, MAX_UPLOAD_MB } from "@/shared/utils/fileUpload";
import { thaiDate } from "@/shared/utils/thaiDate";
import { useAuth } from "@/features/auth/AuthContext";
import usePermissions from "@/shared/hooks/usePermissions";
import ExpenseService, { errorText } from "../services/ExpenseService";
import SignatureService from "@/shared/services/SignatureService";
import StatusBadge from "./StatusBadge";
import BankLogo from "./BankLogo";
import { BANKS, bankMeta, bankLogoUrl, digitsOnly, validateAccount } from "../bankMeta";
import SheetSelectField, { FORM_FIELD_SX } from "@/shared/ui/SheetSelectField";
import { SheetPicker, SheetPickerRow, PickerField } from "@/shared/ui/SheetPicker";
import {
  KIND_META, FILE_KINDS, baht, fmtMoney, bahtText, itemAmount, itemsTotal, money, jobText, jobRangeText, jobPartText, jobRangeDates,
  contractorCalc, installmentText, WHT_PRESETS, personFullName, TEXT_SUB, TEXT_MAIN, BORDER_MAIN,
} from "../expenseMeta";
import { JobOptionRow } from "@/shared/ui/JobTypeChip";
import useFormDraft, { DraftBanner } from "@/shared/hooks/useFormDraft";
import { useFileGallery } from "@/shared/ui/FileGalleryDialog";
import FileKindThumb from "@/shared/ui/FileKindThumb";
import { useAttendanceByDay, AttendanceDayStrip } from "./AttendanceRefs";

const META = KIND_META.contractor;
const ACCENT = META.color;
const MAX_ITEMS = 40;
let keySeq = 0;
const nextKey = () => `c${Date.now()}_${(keySeq += 1)}`;
const blankItem = () => ({ key: nextKey(), category: "labor", description: "", detail: "", qty: 1, unit: "งาน", unitPrice: "", workDate: "" });
/** แถวค่าแรงรายวัน — 1 แถว = 1 วันทำงาน (ผู้ใช้: "อยากได้ใส่วันที่ เพราะเขาเบิกเป็นวัน") */
const DEFAULT_FROM = "08:30";
const DEFAULT_TO = "17:30";
/**
 * ✅ (13 พ.ย. 2569 ผู้ใช้: "ผรม. ชุดเดียวกัน เข้างานเช้าและกลางคืนวันเดียวกัน เบิกในใบเดียว · ใส่วันที่ซ้ำไม่ได้ · กลางวัน/กลางคืนจำนวนคนไม่เท่ากัน")
 *    แถวรายวันมี "กะ" — กลางวัน ("") / กลางคืน ("night") · วันเดียวกันมีได้กะละ 1 แถว (คน/เวลา/ค่าแรงแยกกัน)
 *    ตรวจซ้ำด้วย วันที่ + กะ · นับ "วันทำงาน" ตามวันที่ไม่ซ้ำ · แรง รวมทุกกะ
 */
const NIGHT_FROM = "22:00"; // (13 พ.ย. 2569 ผู้ใช้: "เวลาเริ่มต้นของกลางคืนคือ 22 นาฬิกา")
const NIGHT_TO = "05:00";
// 🔁 (13 พ.ย. 2569 ผู้ใช้: "ให้ใช้คำว่าเข้างานกลางคืน ไม่ใช่กะกลางคืน")
const SHIFT_LABEL = { "": "เข้างานกลางวัน", night: "เข้างานกลางคืน" };
const shiftKey = (r) => `${r.workDate}|${r.shift === "night" ? "night" : ""}`;
const byDateShift = (x, y) => String(x.workDate || "9").localeCompare(String(y.workDate || "9")) || (x.shift === "night") - (y.shift === "night");
// 🔁 (24 ต.ค. 2569 ผู้ใช้: "ใส่จำนวนคนต่อวันได้ จะได้อ้างอิงได้" → "ไม่ต้องใส่ค่าแรง/คน ใส่รวมเลย บางทีค่าแรงต่อคนไม่เท่ากัน")
//    1 แถว = 1 วัน · ยอดเงิน = ค่าแรงรวมของวันนั้น (qty 1) · จำนวนคนเก็บแยกไว้อ้างอิง (people)
const dayItem = (workDate = "", unitPrice = "", auto = false, people = 1) => ({
  key: nextKey(), category: "labor", description: "ค่าแรง", detail: "", qty: 1, unit: "วัน", people: people || 1, unitPrice, workDate, auto,
  // ✅ (24 ต.ค. 2569 ผู้ใช้: "ใส่เวลาได้ด้วย default 08.30-17.30")
  timeFrom: DEFAULT_FROM, timeTo: DEFAULT_TO, shift: "",
});
const fromDoc = (it) => ({
  key: nextKey(), category: it.category || "labor", description: it.description || "", detail: it.detail || "",
  qty: it.qty ?? 1, unit: it.unit || "", unitPrice: it.unitPrice ?? "", workDate: it.workDate ? moment(it.workDate).format("YYYY-MM-DD") : "",
  timeFrom: it.timeFrom || "", timeTo: it.timeTo || "", people: it.people || "", shift: it.shift === "night" ? "night" : "",
  // ใบที่บันทึกแบบ "คน × ค่าแรงต่อคน" ช่วงสั้นๆ ก่อนเปลี่ยนเป็นยอดรวม → แปลงเป็นยอดรวมของวัน
  ...(it.workDate && it.unit === "คน" ? { people: it.qty, qty: 1, unit: "วัน", unitPrice: (Number(it.qty) || 0) * (Number(it.unitPrice) || 0) } : {}),
});
/** วันทำงานทุกวันของช่วงงาน — end ของงานทั้งวันเป็นแบบ "ไม่รวมวันสุดท้าย" (เหมือน jobRangeText) */
const daysOfRange = (r) => {
  if (!r?.start) return [];
  const start = moment(r.start).startOf("day");
  const rawEnd = r.end ? moment(r.end) : null;
  const n = rawEnd && rawEnd.isAfter(start) ? Math.max(1, Math.round(rawEnd.diff(start, "hours") / 24)) : 1;
  return Array.from({ length: Math.min(n, 62) }, (_, i) => start.clone().add(i, "days").format("YYYY-MM-DD"));
};
const dayOf = (d) => (d ? moment(d).format("YYYY-MM-DD") : "");
const numberField = { inputMode: "decimal", onWheel: (e) => e.currentTarget.blur() };
const byStart = (a, b) => new Date(a.start || 0) - new Date(b.start || 0);
/** ป้ายสั้นของช่วงงานบนชิป — "ช่วง 10/11 · 14 – 19 ก.ย. 2569" */
const rangeChip = (o) => [Number(o.part) > 0 ? `ช่วง ${o.part}${o.partCount ? `/${o.partCount}` : ""}` : "", jobRangeDates(o)].filter(Boolean).join(" · ") || o.title || "";

/** ⚠️ module scope — ประกาศในตัวฟอร์มจะทำให้ช่องกรอกหลุดโฟกัสทุกตัวอักษร (ดูเหตุผลใน ExpenseFormDialog) */
// 🔁 (13 พ.ย. 2569 ผู้ใช้: "ปรับแก้การแสดงผลหน้าฟอร์มให้สวยงาม ดูง่าย จัดการได้ง่าย แบบธีมอื่นๆ")
//    การ์ดหัวข้อแบบเดียวกับฟอร์มลงงาน/แก้ไขงาน: ช่องไอคอนพื้นอ่อน · ชื่อหัวข้อ · คำอธิบายบรรทัดเล็ก · เส้นคั่นใต้หัว
const Section = ({ icon, title, hint, children, action }) => (
  <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: "14px", mb: 1.5, overflow: "hidden" }}>
    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: { xs: 1.5, sm: 2 }, py: 1.25, borderBottom: `1px solid #eef2f7` }}>
      {icon && (
        <Box sx={{ width: 34, height: 34, borderRadius: "10px", flexShrink: 0, display: "grid", placeItems: "center", bgcolor: alpha(ACCENT, 0.1),
          "& svg": { fontSize: "19px !important", color: `${ACCENT} !important` } }}>{icon}</Box>
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

const SumLine = ({ label, value, strong, minus, color }) => (
  <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ py: 0.35 }}>
    <Typography sx={{ fontSize: strong ? "0.95rem" : "0.86rem", fontWeight: strong ? 900 : 600, color: color || (strong ? TEXT_MAIN : TEXT_SUB) }}>{label}</Typography>
    <Typography sx={{ fontSize: strong ? "1.35rem" : "0.92rem", fontWeight: strong ? 900 : 700, color: color || TEXT_MAIN, whiteSpace: "nowrap" }}>
      {minus && value ? "− " : ""}{fmtMoney(value)}
    </Typography>
  </Stack>
);

export default function ContractorFormDialog({ open, expense, presetJob, onClose, onSaved }) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const { userData } = useAuth();
  const { can } = usePermissions();
  const editing = Boolean(expense?._id);
  const canPickPerson = can("viewAllExpenses");

  const [docDate, setDocDate] = useState(moment().format("YYYY-MM-DD"));
  const [to, setTo] = useState("");
  const [toOptions, setToOptions] = useState([]);
  const [people, setPeople] = useState([]);
  const [requester, setRequester] = useState(null);
  const [position, setPosition] = useState("");
  const [subject, setSubject] = useState("");
  /**
   * ✅ ผู้ใช้สั่ง: "งานงวดให้เบิกหลายช่วงได้" — งวดเดียวของผู้รับเหมาครอบคลุมได้หลายช่วงวันที่ของงานเดียวกัน
   * ⚠️ ต้องเป็นงานเดียวกันเท่านั้น (groupKey เดียวกัน) — server ตรวจซ้ำ (resolveJobRanges)
   */
  const [jobs, setJobs] = useState([]);
  const job = jobs[0] || null;
  const [jobOptions, setJobOptions] = useState([]);
  const [jobQuery, setJobQuery] = useState("");
  const [jobLoading, setJobLoading] = useState(false);
  const [jobSheet, setJobSheet] = useState(false); // แผ่นเลือกงาน
  // ผู้รับเหมา
  const [known, setKnown] = useState([]);
  const [cName, setCName] = useState("");
  const [cTaxId, setCTaxId] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cAddress, setCAddress] = useState("");
  const [cIsCompany, setCIsCompany] = useState(false);
  // งวดงาน
  const [instNo, setInstNo] = useState("");
  const [instTotal, setInstTotal] = useState("");
  const [contractValue, setContractValue] = useState("");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  // เงิน
  const [items, setItems] = useState([dayItem()]);
  /** daily = ค่าแรงรายวัน (ใส่วันที่ทีละวัน) · lump = เหมางาน (ใส่เนื้องาน × จำนวน) */
  const [rateMode, setRateMode] = useState("daily");
  /** ค่าแรงต่อวัน — กรอกครั้งเดียวใช้กับทุกวัน (แก้รายวันทีหลังได้) */
  const [dailyRate, setDailyRate] = useState("");
  /** จำนวนคนต่อวัน — กรอกครั้งเดียวใช้กับทุกวัน (แก้รายวันได้) */
  const [dailyPeople, setDailyPeople] = useState(1);
  // บันทึกเข้างานของงานที่อ้างอิง แยกตามวัน + ตัวดูรูป
  const gallery = useFileGallery();
  const [vatRate, setVatRate] = useState(0);
  const [whtRate, setWhtRate] = useState(3);
  const [deposit, setDeposit] = useState("");
  // บัญชี
  const [payMode, setPayMode] = useState("transfer");
  const [bankCode, setBankCode] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [accountName, setAccountName] = useState("");
  // ✅ (10 ต.ค. 2569) ข้อมูลที่กรอกค้างไม่หายเมื่อฟอร์มหลุด/ปิด — กู้คืนได้ภายใน 10 นาที (ดู shared/hooks/useFormDraft.js)
  const draft = useFormDraft({
    key: editing ? `contractor:edit:${expense._id}` : `contractor:new:${presetJob?._id || "-"}`,
    enabled: Boolean(open),
    data: { docDate, to, position, subject, jobs, cName, cTaxId, cPhone, cAddress, cIsCompany, instNo, instTotal, contractValue, items, rateMode, dailyRate, dailyPeople, vatRate, whtRate, deposit, payMode, bankCode, accountNo, accountName },
    restore: (d) => {
      if (d.docDate) setDocDate(d.docDate);
      setTo(d.to || ""); setPosition(d.position || ""); setSubject(d.subject || "");
      if (String(d.subject || "").startsWith("เบิกค่าจ้างผู้รับเหมา")) autoSubjectsRef.current.add(d.subject);
      if (Array.isArray(d.jobs)) setJobs(d.jobs);
      setCName(d.cName || ""); setCTaxId(d.cTaxId || ""); setCPhone(d.cPhone || ""); setCAddress(d.cAddress || ""); setCIsCompany(Boolean(d.cIsCompany));
      setInstNo(d.instNo || ""); setInstTotal(d.instTotal || ""); setContractValue(d.contractValue || "");
      if (Array.isArray(d.items)) setItems(d.items.map((it) => ({ ...it, key: nextKey() })));
      if (d.rateMode) setRateMode(d.rateMode);
      setDailyRate(d.dailyRate || ""); setDailyPeople(Number(d.dailyPeople) || 1); setVatRate(d.vatRate ?? 0); setWhtRate(d.whtRate ?? 3); setDeposit(d.deposit || "");
      if (d.payMode) setPayMode(d.payMode);
      setBankCode(d.bankCode || ""); setAccountNo(d.accountNo || ""); setAccountName(d.accountName || "");
    },
  });
  // อื่นๆ
  const [note, setNote] = useState("");
  const [files, setFiles] = useState([]);
  const [mySignature, setMySignature] = useState(null);
  const [useSignature, setUseSignature] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const fileInputRef = useRef(null);
  const autoSubjectRef = useRef("");
  // 🐛 (24 ต.ค. 2569 ผู้ใช้: "ชื่อเรื่อง เวลากดผูกงานผิดแล้วเลือกตัวอื่น ให้แก้ตามด้วย") จำทุกเรื่องที่ระบบเคยเติมให้
  //    (รวมเรื่องที่กู้คืนจากฉบับร่าง) — เรื่องยังเป็นของระบบ = เปลี่ยนตามงาน/ผู้รับเหมา/งวดเสมอ · พิมพ์เองแล้วไม่ทับ
  const autoSubjectsRef = useRef(new Set());
  const autoInstRef = useRef(false);

  // ── ค่าเริ่มต้นทุกครั้งที่เปิด ─────────────────────────────────────────
  useEffect(() => {
    if (!open) return undefined;
    setError(""); setTouched(false); setFiles([]); setSaving(false); setHistory([]);
    autoInstRef.current = false;
    if (editing) {
      const e = expense;
      setDocDate(dayOf(e.docDate) || moment().format("YYYY-MM-DD"));
      setTo(e.to || "");
      setRequester({ userId: e.requester?.userId, name: e.requester?.name, fullName: e.requester?.fullName, position: e.requester?.position });
      setPosition(e.requester?.position || "");
      setSubject(e.subject || "");
      autoSubjectRef.current = "";
      setJobs(e.jobRanges?.length
        ? e.jobRanges.map((r) => ({ ...e.job, _id: r.eventId, start: r.start, end: r.end, part: r.part, groupKey: e.jobGroupKey || "" }))
        : e.eventId ? [{ _id: e.eventId, ...e.job, groupKey: e.jobGroupKey || "" }] : []);
      setCName(e.contractor?.name || ""); setCTaxId(e.contractor?.taxId || ""); setCPhone(e.contractor?.phone || "");
      setCAddress(e.contractor?.address || ""); setCIsCompany(Boolean(e.contractor?.isCompany));
      setInstNo(e.installment?.no ? String(e.installment.no) : ""); setInstTotal(e.installment?.total ? String(e.installment.total) : "");
      setContractValue(e.contractValue ? String(e.contractValue) : "");
      setItems((e.items || []).length ? e.items.map(fromDoc) : [dayItem()]);
      setRateMode((e.items || []).some((it) => it.workDate) || !(e.items || []).length ? "daily" : "lump");
      setDailyRate("");
      setVatRate(Number(e.deductions?.vatRate) || 0);
      setWhtRate(Number(e.deductions?.whtRate) || 0);
      setDeposit(e.deductions?.deposit ? String(e.deductions.deposit) : "");
      setPayMode(e.payTo?.accountNo ? "transfer" : "cash");
      setBankCode(e.payTo?.bankCode || ""); setAccountNo(e.payTo?.accountNo || ""); setAccountName(e.payTo?.accountName || "");
      setNote(e.note || "");
    } else {
      setDocDate(moment().format("YYYY-MM-DD"));
      setTo("");
      setRequester({ userId: userData?.userId, name: userData?.fname, position: "" });
      setPosition("");
      setJobs(presetJob ? [{ ...presetJob }] : []);
      autoSubjectRef.current = "";
      setSubject("");
      setCName(""); setCTaxId(""); setCPhone(""); setCAddress(""); setCIsCompany(false);
      setInstNo(""); setInstTotal(""); setContractValue("");
      setItems([]);
      setRateMode("daily");
      setDailyRate("");
      setVatRate(0); setWhtRate(3); setDeposit("");
      setPayMode("transfer"); setBankCode(""); setAccountNo(""); setAccountName("");
      setNote("");
    }
    let alive = true;
    ExpenseService.suggest().then((s) => {
      if (!alive) return;
      setToOptions(s.to || []);
      if (!editing) {
        setTo((cur) => cur || s.to?.[0] || "");
        setPosition((cur) => cur || s.position || "");
      }
    }).catch(() => {});
    ExpenseService.people().then((p) => alive && setPeople(p)).catch(() => {});
    ExpenseService.contractors().then((c) => alive && setKnown(c)).catch(() => {});
    SignatureService.me().then((sig) => alive && setMySignature(sig)).catch(() => {});
    setUseSignature(editing ? Boolean(expense.signatures?.requester?.hash) : true);
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- รีเซ็ตเฉพาะตอนเปิดกล่อง/เปลี่ยนใบ
  }, [open, expense?._id, presetJob?._id]);

  // ── ค้นหางาน ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return undefined;
    setJobLoading(true);
    const t = setTimeout(() => {
      ExpenseService.jobs(jobQuery)
        .then((rows) => setJobOptions(rows))
        .catch(() => setJobOptions([]))
        .finally(() => setJobLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [open, jobQuery]);

  /**
   * ✅ งวดที่เบิกไปแล้วของผู้รับเหมาคนนี้ในงานนี้ — ใช้ทั้งแสดงยอดสะสม และเสนอ "งวดถัดไป"/มูลค่าสัญญาให้
   * ⚠️ เติมให้เฉพาะใบใหม่ที่ผู้ใช้ยังไม่ได้กรอกเอง (ไม่เขียนทับของที่พิมพ์)
   */
  useEffect(() => {
    if (!open || !job?._id || !String(cName).trim()) { setHistory([]); return undefined; }
    let alive = true;
    setHistoryLoading(true);
    const t = setTimeout(() => {
      ExpenseService.contractorHistory(job._id, cName.trim(), expense?._id)
        .then((rows) => {
          if (!alive) return;
          setHistory(rows);
          if (!editing && rows.length && !autoInstRef.current) {
            const last = rows[rows.length - 1];
            const maxNo = Math.max(0, ...rows.map((r) => Number(r.installment?.no) || 0));
            setInstNo((cur) => cur || (maxNo ? String(maxNo + 1) : ""));
            setInstTotal((cur) => cur || (last.installment?.total ? String(last.installment.total) : ""));
            setContractValue((cur) => cur || (last.contractValue ? String(last.contractValue) : ""));
            setVatRate(Number(last.deductions?.vatRate) || 0);
            setWhtRate(Number(last.deductions?.whtRate) || 0);
            autoInstRef.current = true;
          }
        })
        .catch(() => alive && setHistory([]))
        .finally(() => alive && setHistoryLoading(false));
    }, 400);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- โหลดใหม่เมื่องาน/ชื่อผู้รับเหมาเปลี่ยนเท่านั้น
  }, [open, job?._id, cName]);

  /** เรื่องอัตโนมัติ — "เบิกค่าจ้างผู้รับเหมา นายสมชาย งวดที่ 2/5 งาน ... (วันที่)" (แก้เองได้ ไม่ถูกเขียนทับ) */
  useEffect(() => {
    if (!open || editing) return;
    const last = jobs[jobs.length - 1];
    const span = job ? jobRangeDates({ start: job.start, end: last?.end || job.end }) : "";
    const parts = ["เบิกค่าจ้างผู้รับเหมา", String(cName).trim(), installmentText({ no: instNo, total: instTotal }),
      job ? `งาน ${jobText(job)}${span ? ` (${span})` : ""}` : ""].filter(Boolean);
    const next = parts.length > 1 ? parts.join(" ") : "";
    setSubject((cur) => (!String(cur).trim() || cur === autoSubjectRef.current || autoSubjectsRef.current.has(cur) ? next : cur));
    autoSubjectRef.current = next;
    if (next) autoSubjectsRef.current.add(next);
  }, [open, editing, cName, instNo, instTotal, job, jobs]);

  const gross = useMemo(() => itemsTotal(items), [items]);
  const calc = contractorCalc(gross, { vatRate, whtRate, deposit });
  const prevGross = money(history.reduce((s, h) => s + (Number(h.total) || 0), 0));
  const cv = money(contractValue);
  const cumulative = money(prevGross + gross);
  const remaining = money(cv - cumulative);

  const setItem = (key, patch) => setItems((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const pickKnown = (c) => {
    if (!c || typeof c === "string") return;
    setCName(c.name || ""); setCTaxId(c.taxId || ""); setCPhone(c.phone || ""); setCAddress(c.address || ""); setCIsCompany(Boolean(c.isCompany));
    if (c.payTo?.accountNo) {
      setPayMode("transfer"); setBankCode(c.payTo.bankCode || ""); setAccountNo(c.payTo.accountNo || ""); setAccountName(c.payTo.accountName || "");
    }
  };

  const validItems = items.filter((it) => String(it.description).trim());
  // ซ้ำ = วันที่เดียวกัน + กะเดียวกัน (กลางวัน/กลางคืนของวันเดียวกันไม่นับว่าซ้ำ)
  const slotKeys = items.filter((it) => it.workDate).map(shiftKey);
  const dupSlots = [...new Set(slotKeys.filter((k, i) => slotKeys.indexOf(k) !== i))];
  const isDupRow = (r) => Boolean(r.workDate) && dupSlots.includes(shiftKey(r));
  const dupText = dupSlots.map((k) => { const [d, sh] = k.split("|"); return `${thaiDate(d)} (${SHIFT_LABEL[sh]})`; }).join(", ");
  const dayCount = rateMode === "daily" ? new Set(validItems.filter((it) => it.workDate).map((it) => it.workDate)).size : 0;
  const nightCount = rateMode === "daily" ? validItems.filter((it) => it.workDate && it.shift === "night").length : 0;
  /** เพิ่มกะกลางคืนของวันเดียวกัน (ต่อท้ายแถวกลางวัน) — คน/ค่าแรงแยกจากกะกลางวัน */
  const addNightShift = (row) => setItems((rows) => {
    const idx = rows.findIndex((r) => r.key === row.key);
    const night = { ...dayItem(row.workDate, "", false, Number(row.people) || Number(dailyPeople) || 1), shift: "night", timeFrom: NIGHT_FROM, timeTo: NIGHT_TO, added: true, description: row.description || "ค่าแรง" };
    const next = [...rows];
    next.splice(idx + 1, 0, night);
    return next.slice(0, MAX_ITEMS);
  });
  /** สลับกะของแถว — เวลาเปลี่ยนตามกะ ถ้ายังเป็นเวลาเริ่มต้นของกะเดิม */
  const setShift = (row, shift) => {
    const wasDefault = row.shift === "night" ? row.timeFrom === NIGHT_FROM && row.timeTo === NIGHT_TO : row.timeFrom === DEFAULT_FROM && row.timeTo === DEFAULT_TO;
    setItem(row.key, { shift, auto: false, ...(wasDefault ? (shift === "night" ? { timeFrom: NIGHT_FROM, timeTo: NIGHT_TO } : { timeFrom: DEFAULT_FROM, timeTo: DEFAULT_TO }) : {}) });
  };
  // แรงงานรวม (คน-วัน) — ไว้อ้างอิง/ตรวจกับใบลงเวลา
  const manDays = rateMode === "daily" ? validItems.filter((it) => it.workDate).reduce((n, it) => n + (Number(it.people) || 0), 0) : 0;

  /** ใช้ค่าแรงต่อวันกับทุกวันในรายการ */
  const applyDailyRate = (v) => {
    setDailyRate(v);
    setItems((rows) => rows.map((r) => ({ ...r, unitPrice: v, qty: 1, unit: "วัน" })));
  };
  /** ใช้จำนวนคนกับทุกวันในรายการ */
  const applyDailyPeople = (v) => {
    setDailyPeople(v);
    const n = Number(v);
    if (n > 0) setItems((rows) => rows.map((r) => ({ ...r, people: n })));
  };
  /**
   * ✅ ผู้ใช้สั่ง: "อยากให้ทำง่าย คำนวณกรอกวันที่เองอัตโนมัติ"
   * เลือกช่วงงานแล้ว ระบบสร้างแถวให้ทุกวันของทุกช่วงเอง · เอาช่วงออก = วันของช่วงนั้นหายไปด้วย
   * ⚠️ แถวที่ผู้ใช้เพิ่มเอง (auto = false) ไม่ถูกลบ · แถวเดิมของวันเดียวกันเก็บค่าแรง/งานที่แก้ไว้
   * ⚠️ ไม่ทำตอนแก้ใบเดิม — รายการที่บันทึกไว้แล้วต้องไม่เปลี่ยนเองเงียบๆ
   */
  const jobsKey = jobs.map((j) => j._id).join(",");
  const attByDay = useAttendanceByDay(jobs.map((j) => j._id));
  useEffect(() => {
    if (!open || editing || rateMode !== "daily") return;
    const days = [...new Set(jobs.flatMap(daysOfRange))].sort();
    // 🐛 (24 ต.ค. 2569 ผู้ใช้: "วันเข้างานไม่ตามงาน แสดงมาเกิน ผิดเพี้ยน") เดิมแถวที่เคยแก้อะไรไปนิดเดียว (เวลา/คน/ค่าแรง)
    //    ถูกนับเป็น "เพิ่มเอง" แล้วค้างอยู่แม้เปลี่ยนไปผูกงานอื่น → วันเกินจากงานจริง
    //    ✅ วันของงาน = ตามช่วงงานที่เลือกเท่านั้น (ค่าที่แก้ไว้ของวันเดียวกันยังอยู่) · เก็บเพิ่มเฉพาะวันที่กด "เพิ่มวัน" เอง
    if (!days.length) return;
    setItems((rows) => {
      const byDate = new Map(rows.filter((r) => r.workDate && r.shift !== "night").map((r) => [r.workDate, r]));
      const fromJobs = days.map((d) => byDate.get(d) || dayItem(d, dailyRate, true, Number(dailyPeople) || 1));
      // กะกลางคืนที่เพิ่มไว้ของวันในช่วงงาน — เก็บไว้ (ไม่หายตอนสร้างแถวใหม่)
      const nights = rows.filter((r) => r.shift === "night" && r.workDate && days.includes(r.workDate));
      const extra = rows.filter((r) => r.added && r.workDate && !days.includes(r.workDate));
      return [...fromJobs, ...nights, ...extra].sort(byDateShift).slice(0, MAX_ITEMS);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- สร้างใหม่เฉพาะตอนช่วงงานที่เลือกเปลี่ยน
  }, [open, editing, rateMode, jobsKey]);

  /** เพิ่มวันถัดจากวันล่าสุดในรายการ */
  const addNextDay = () => setItems((rows) => {
    const last = rows.map((r) => r.workDate).filter(Boolean).sort().pop();
    const rate = dailyRate || ([...rows].reverse().find((r) => Number(r.unitPrice) > 0)?.unitPrice ?? "");
    const people = Number(dailyPeople) || Number([...rows].reverse().find((r) => Number(r.people) > 0)?.people) || 1;
    return [...rows, { ...dayItem(last ? moment(last).add(1, "day").format("YYYY-MM-DD") : "", rate, false, people), added: true }];
  });
  const taxDigits = digitsOnly(cTaxId);
  const bankError = payMode === "transfer" && bankCode ? validateAccount(bankCode, digitsOnly(accountNo)) : "";
  const problems = [];
  if (!String(cName).trim()) problems.push("ระบุชื่อผู้รับเหมา");
  if (taxDigits && taxDigits.length !== 13) problems.push("เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก");
  if (!String(subject).trim()) problems.push("ระบุเรื่อง");
  if (!validItems.length) problems.push("เพิ่มรายการค่าจ้างอย่างน้อย 1 รายการ");
  if (rateMode === "daily" && validItems.some((it) => !it.workDate)) problems.push("ระบุวันที่ทำงานให้ครบทุกแถว");
  if (dupSlots.length) problems.push(`วันที่และช่วงเข้างานซ้ำกัน (${dupText})`);
  if (gross <= 0) problems.push("ยอดค่าจ้างต้องมากกว่า 0");
  if (items.some((it) => String(it.description).trim() && Number(it.qty) <= 0)) problems.push("จำนวนต้องมากกว่า 0");
  if (calc.net < 0) problems.push("ยอดหักมัดจำมากกว่ายอดที่ต้องจ่าย");
  if (Number(instNo) && Number(instTotal) && Number(instNo) > Number(instTotal)) problems.push("งวดที่ต้องไม่เกินจำนวนงวดทั้งหมด");
  if (payMode === "transfer") {
    if (!bankCode) problems.push("เลือกธนาคารของผู้รับเหมา (หรือเลือกจ่ายเงินสด/เช็ค)");
    else if (bankError) problems.push(bankError);
    else if (!String(accountName).trim()) problems.push("ระบุชื่อบัญชี");
  }
  const canSignSelf = Boolean(requester?.userId) && requester.userId === userData?.userId;

  const submit = async () => {
    setTouched(true);
    if (problems.length) { setError(`กรุณา${problems.join(" · ")}`); return; }
    setSaving(true); setError("");
    const fields = {
      docDate, to: String(to || "").trim(), subject: String(subject).trim(), note: String(note || "").trim(),
      position: String(position || "").trim(),
      eventIds: jobs.map((j) => j._id),
      contractorName: String(cName).trim(), contractorTaxId: taxDigits, contractorPhone: String(cPhone).trim(),
      contractorAddress: String(cAddress).trim(), contractorIsCompany: cIsCompany,
      installmentNo: Number(instNo) || 0, installmentTotal: Number(instTotal) || 0, contractValue: money(contractValue),
      vatRate: calc.vatRate, whtRate: calc.whtRate, deposit: calc.deposit,
      payBankCode: payMode === "transfer" ? bankCode : "",
      payAccountNo: payMode === "transfer" ? digitsOnly(accountNo) : "",
      payAccountName: payMode === "transfer" ? String(accountName).trim() : "",
      // ✅ รายวัน: เรียงตามวันที่ก่อนส่ง — เอกสารอ่านไล่วันได้เสมอ · เหมางาน: ไม่ส่งวันที่
      items: [...validItems]
        .sort((a, b) => (rateMode === "daily" ? byDateShift(a, b) : 0))
        .map(({ key, auto, added, ...it }) => ({
          ...it, qty: Number(it.qty) || 0, unitPrice: Number(it.unitPrice) || 0, workDate: rateMode === "daily" ? it.workDate : "",
          shift: rateMode === "daily" && it.shift === "night" ? "night" : "",
        })),
    };
    if (canPickPerson && requester?.userId) fields.requesterId = requester.userId;
    if (canSignSelf) fields.useSignature = useSignature;
    try {
      const payload = files.map((f) => ({ file: f.file, kind: f.kind }));
      const result = editing
        ? await ExpenseService.update(expense._id, fields, payload)
        : await ExpenseService.createContractorPayment(fields, payload);
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
  const whtIsPreset = WHT_PRESETS.some((p) => p.value === Number(whtRate));

  return (
    <Dialog
      open={open}
      onClose={(_, reason) => { if (saving || reason === "backdropClick") return; onClose?.(); }}
      fullWidth maxWidth="md" fullScreen={isMobile}
      PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3 } }}
    >
      <DialogTitle sx={{ p: 0 }}>
        {/* 🔁 (13 พ.ย. 2569) หัวฟอร์มพื้นขาวแบบฟอร์มอื่น — ชื่อเต็มไม่ถูกตัด (เดิมแถบสีหนา + ป้ายเบียดชื่อจนตัดคำ) */}
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{
          px: { xs: 1.75, sm: 2.5 }, py: 1.25, borderBottom: `1px solid ${BORDER_MAIN}`, bgcolor: "#fff",
        }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "12px", flexShrink: 0, display: "grid", placeItems: "center", bgcolor: alpha(ACCENT, 0.1), color: ACCENT }}>
            <Engineering sx={{ fontSize: 22 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: { xs: "1rem", sm: "1.06rem" }, lineHeight: 1.3, color: TEXT_MAIN }}>
              {editing ? `แก้ไข ${expense.docNo || ""}` : `ออก${META.label}`}
            </Typography>
            <Typography sx={{ color: TEXT_SUB, fontSize: "0.74rem", lineHeight: 1.35 }} component="div">
              เบิกค่าแรง/ค่าจ้างเหมาตามงวดงาน · หัก ณ ที่จ่ายและมัดจำให้อัตโนมัติ
            </Typography>
          </Box>
          <IconButton onClick={onClose} disabled={saving}><Close /></IconButton>
        </Stack>
      </DialogTitle>

      {/* 🔁 (13 พ.ย. 2569 ผู้ใช้: "ux ui ยังเหมือนเดิม · การจัดวาง สีสัน ยังดูยาก") ช่องกรอกทุกช่องแบบเดียวกับฟอร์มลงงาน:
          ป้ายชื่ออยู่เหนือช่อง (ไม่ลอยทับขอบ) · ช่องขาวขอบเทา 1.5px มุมมน 10 · สูง 44 · โฟกัสขอบน้ำเงิน */}
      <DialogContent sx={{ bgcolor: "#f5f7fa", px: { xs: 1, sm: 2.5 }, pt: "12px !important", pb: 1, ...FORM_FIELD_SX }}>
        <DraftBanner draft={draft} />
        {resubmit && expense.rejectReason && (
          <Alert severity="warning" sx={{ mb: 1.75, borderRadius: 2 }}>
            <b>ถูกตีกลับ:</b> {expense.rejectReason} — แก้แล้วกด &quot;ส่งใหม่&quot; ใบจะกลับไปรอตรวจสอบ
          </Alert>
        )}

        {/* ── ผู้รับเหมา ─────────────────────────────────────────────── */}
        <Section icon={<Engineering sx={{ fontSize: 18, color: ACCENT }} />} title="ผู้รับเหมา (ผู้รับเงิน)"
          hint="เลือกผู้รับเหมาที่เคยเบิกแล้ว ระบบเติมข้อมูลและบัญชีให้ · หรือพิมพ์ชื่อใหม่">
          <Box sx={{ display: "grid", gap: 1.5, alignItems: "start", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
            {/* 🔁 (13 พ.ย. 2569) เลือกผู้รับเหมาจากแผ่นรายการ (ค้นหา · เรียง ก-ฮ) หรือพิมพ์ชื่อใหม่ในช่องค้นหา */}
            <SheetSelectField label="ชื่อผู้รับเหมา / บริษัท" required sx={{ gridColumn: { sm: "1 / -1" } }}
              value={cName} allowCreate placeholder="แตะเพื่อเลือก หรือพิมพ์ชื่อใหม่" title="เลือกผู้รับเหมา"
              error={touched && !String(cName).trim()}
              options={known.map((o) => ({
                value: o.name, label: o.name, person: true,
                sub: [o.isCompany ? "นิติบุคคล" : "บุคคลธรรมดา", o.taxId ? `เลขภาษี ${o.taxId}` : "", o.payTo?.accountNo ? `${bankMeta(o.payTo.bankCode).short} ${o.payTo.accountNo}` : ""].filter(Boolean).join(" · "),
              }))}
              onChange={(v, isNew) => { const k = !isNew && known.find((o) => o.name === v); if (k) pickKnown(k); else setCName(String(v).slice(0, 150)); }} />
            <ToggleButtonGroup exclusive size="small" value={cIsCompany ? "company" : "person"}
              onChange={(_, v) => v && setCIsCompany(v === "company")}
              sx={{ "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 700, flex: 1, gap: 0.5 }, "& .Mui-selected": { color: `${ACCENT} !important`, bgcolor: `${alpha(ACCENT, 0.1)} !important` } }}>
              <ToggleButton value="person"><Person sx={{ fontSize: 17 }} />บุคคลธรรมดา</ToggleButton>
              <ToggleButton value="company"><Business sx={{ fontSize: 17 }} />นิติบุคคล</ToggleButton>
            </ToggleButtonGroup>
            <TextField size="small" label="เลขประจำตัวผู้เสียภาษี (13 หลัก)" value={cTaxId}
              onChange={(e) => setCTaxId(digitsOnly(e.target.value).slice(0, 13))}
              inputProps={{ inputMode: "numeric" }}
              error={Boolean(taxDigits) && taxDigits.length !== 13}
              helperText={taxDigits && taxDigits.length !== 13 ? `กรอกแล้ว ${taxDigits.length}/13 หลัก` : "ใช้ออกหนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ)"} />
            <TextField size="small" label="เบอร์โทร" value={cPhone} onChange={(e) => setCPhone(e.target.value)} inputProps={{ maxLength: 40, inputMode: "tel" }} />
            <TextField size="small" label="ที่อยู่ (ไม่บังคับ)" value={cAddress} onChange={(e) => setCAddress(e.target.value)} inputProps={{ maxLength: 300 }} />
          </Box>
        </Section>

        {/* ── งาน / งวดงาน ───────────────────────────────────────────── */}
        <Section icon={<Work sx={{ fontSize: 18, color: ACCENT }} />} title="งาน / งวดงาน"
          hint="ผูกงานแล้วระบบรวมยอดทุกงวดของผู้รับเหมาคนนี้ให้ เห็นว่าเบิกไปแล้วเท่าไรและเหลือเท่าไรตามสัญญา">
          <Box sx={{ display: "grid", gap: 1.5, alignItems: "start", gridTemplateColumns: { xs: "1fr 1fr", sm: "1fr 1fr 1.4fr" } }}>
            {/* 🔁 (13 พ.ย. 2569 ผู้ใช้: "Select งานยังเป็นแบบเดิม") เลือกงานจากแผ่นรายการแบบหน้าลงงาน — ค้นหาบนสุด · ติ๊กได้หลายช่วง */}
            {(() => {
              // ✅ เลือกช่วงแรกแล้ว เหลือให้เลือกเฉพาะช่วงอื่นของ "งานเดียวกัน" — ปนคนละงานไม่ได้
              const choices = (() => {
                const merged = [...jobs, ...jobOptions.filter((o) => !jobs.some((j) => j._id === o._id))];
                if (!job) return jobOptions;
                return merged.filter((o) => jobs.some((j) => j._id === o._id) || (job.groupKey && o.groupKey === job.groupKey)).sort(byStart);
              })();
              const shown = [...jobs, ...choices.filter((o) => !jobs.some((j) => j._id === o._id))];
              const applyJobs = (v) => {
                const next = [...v].sort(byStart);
                // เลือกช่วงแรกของงาน → ค้นด้วยเลขที่/ชื่องานนั้น ให้ช่วงอื่นของงานเดียวกันขึ้นมาครบให้ติ๊กต่อ
                if (!jobs.length && next.length) setJobQuery(next[0].docNo || next[0].title || "");
                if (!next.length) setJobQuery("");
                setJobs(next);
              };
              return (
                <>
                  <PickerField label="งาน / ช่วงวันที่ของงวดนี้ (แนะนำให้ผูก)" placeholder="แตะเพื่อเลือกงาน" sx={{ gridColumn: "1 / -1" }}
                    onClick={() => setJobSheet(true)} disabled={Boolean(presetJob) && !editing}
                    helperText={job
                      ? `${jobText(job)} · ${jobs.length} ช่วงวันที่${job.groupKey ? " — แตะเพื่อติ๊กช่วงอื่นของงานเดียวกัน (เอาออกหมดเพื่อเปลี่ยนงาน)" : " (งานนี้มีช่วงเดียว)"}`
                      : "งวดเดียวเลือกได้หลายช่วงวันที่ของงานเดียวกัน"}>
                    {jobs.length ? (
                      <Stack direction="row" flexWrap="wrap" gap={0.5}>
                        {jobs.map((o) => <Chip key={o._id} size="small" label={rangeChip(o)} sx={{ fontWeight: 700, bgcolor: alpha(ACCENT, 0.1), color: META.dark }} />)}
                      </Stack>
                    ) : null}
                  </PickerField>
                  <SheetPicker open={jobSheet} onClose={() => setJobSheet(false)}
                    title={job ? "เลือกช่วงวันที่ของงานนี้" : "เลือกงาน"}
                    subtitle={job ? `${jobText(job)} · ติ๊กได้หลายช่วง` : "ค้นหาชื่องาน / โครงการ / เลขที่"}
                    query={jobQuery} onQuery={setJobQuery} loading={jobLoading} count={shown.length}
                    emptyText={job ? "ไม่มีช่วงวันที่อื่นของงานนี้" : "ไม่พบงาน"}>
                    {shown.map((o) => {
                      const sel = jobs.some((j) => j._id === o._id);
                      return (
                        <SheetPickerRow key={o._id} multi selected={sel} onClick={() => applyJobs(sel ? jobs.filter((j) => j._id !== o._id) : [...jobs, o])}>
                          <JobOptionRow job={o} main={jobText(o) || o.title}
                            extra={jobPartText(o) ? <Chip size="small" label={jobPartText(o)} sx={{ height: 18, fontSize: "0.65rem", fontWeight: 800 }} /> : null}
                            sub={[jobRangeText(o), o.docNo ? `เลขที่ ${o.docNo}` : "", o.status || ""].filter(Boolean).join(" · ")} />
                        </SheetPickerRow>
                      );
                    })}
                  </SheetPicker>
                </>
              );
            })()}
            <TextField size="small" label="งวดที่" type="number" value={instNo} onChange={(e) => setInstNo(e.target.value)}
              inputProps={{ min: 0, max: 99, ...numberField }} />
            <TextField size="small" label="จากทั้งหมด (งวด)" type="number" value={instTotal} onChange={(e) => setInstTotal(e.target.value)}
              inputProps={{ min: 0, max: 99, ...numberField }}
              error={Boolean(Number(instNo) && Number(instTotal) && Number(instNo) > Number(instTotal))} />
            <TextField size="small" label="มูลค่าตามสัญญาจ้าง (ไม่รวม VAT)" type="number" value={contractValue}
              onChange={(e) => setContractValue(e.target.value)} sx={{ gridColumn: { xs: "1 / -1", sm: "auto" } }}
              inputProps={{ min: 0, step: "any", ...numberField }}
              InputProps={{ endAdornment: <InputAdornment position="end">บาท</InputAdornment> }} />
          </Box>

          {/* ✅ ยอดสะสมทุกงวด — ผู้ตรวจเห็นทันทีว่าเบิกเกินสัญญาหรือไม่ */}
          {(history.length > 0 || cv > 0) && (
            <Box sx={{ mt: 1.5, p: 1.25, borderRadius: 2, border: `1px solid ${alpha(ACCENT, 0.25)}`, bgcolor: META.soft }}>
              {historyLoading && <LinearProgress sx={{ mb: 1, height: 2 }} />}
              {history.length > 0 && (
                <Stack spacing={0.5} sx={{ mb: 1 }}>
                  <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: META.dark }}>งวดที่เบิกไปแล้วในงานนี้ ({history.length})</Typography>
                  {history.map((h) => {
                    return (
                      <Stack key={h._id} direction="row" spacing={1} alignItems="center" sx={{ fontSize: "0.8rem" }}>
                        <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, minWidth: 64 }}>{installmentText(h.installment) || "ไม่ระบุงวด"}</Typography>
                        <Typography sx={{ fontSize: "0.8rem", color: TEXT_SUB, flex: 1, minWidth: 0 }} noWrap>{h.docNo} · {thaiDate(h.docDate)}</Typography>
                        <StatusBadge status={h.status} kind="contractor" sx={{ display: { xs: "none", sm: "inline-flex" } }} />
                        <Typography sx={{ fontSize: "0.82rem", fontWeight: 800, whiteSpace: "nowrap" }}>{fmtMoney(h.total)}</Typography>
                      </Stack>
                    );
                  })}
                </Stack>
              )}
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" }, gap: 1 }}>
                <Box><Typography variant="caption" sx={{ color: TEXT_SUB }}>เบิกแล้ว (งวดก่อน)</Typography><Typography sx={{ fontWeight: 800 }}>{baht(prevGross)}</Typography></Box>
                <Box><Typography variant="caption" sx={{ color: TEXT_SUB }}>งวดนี้</Typography><Typography sx={{ fontWeight: 800, color: ACCENT }}>{baht(gross)}</Typography></Box>
                <Box><Typography variant="caption" sx={{ color: TEXT_SUB }}>รวมสะสม</Typography><Typography sx={{ fontWeight: 800 }}>{baht(cumulative)}</Typography></Box>
                {cv > 0 && (
                  <Box>
                    <Typography variant="caption" sx={{ color: TEXT_SUB }}>คงเหลือตามสัญญา</Typography>
                    <Typography sx={{ fontWeight: 900, color: remaining < 0 ? "#dc2626" : "#059669" }}>{remaining < 0 ? `เกิน ${baht(-remaining)}` : baht(remaining)}</Typography>
                  </Box>
                )}
              </Box>
              {cv > 0 && (
                <LinearProgress variant="determinate" value={Math.min(100, (cumulative / cv) * 100)}
                  sx={{ mt: 1, height: 6, borderRadius: 3, bgcolor: alpha(ACCENT, 0.12), "& .MuiLinearProgress-bar": { bgcolor: remaining < 0 ? "#dc2626" : ACCENT } }} />
              )}
              {cv > 0 && remaining < 0 && (
                <Typography variant="caption" sx={{ color: "#dc2626", fontWeight: 700, display: "block", mt: 0.5 }}>
                  ยอดสะสมเกินมูลค่าสัญญา — ตรวจสอบงานเพิ่ม (VO) หรือแก้มูลค่าสัญญาก่อนส่ง
                </Typography>
              )}
            </Box>
          )}
        </Section>

        {/* ── ข้อมูลเอกสาร ─────────────────────────────────────────── */}
        <Section icon={<DescriptionIcon />} title="ข้อมูลเอกสาร" hint="ผู้เบิก = พนักงานที่กรอกใบแทนผู้รับเหมา (รับผิดชอบเอกสารในสายอนุมัติ)">
          <Box sx={{ display: "grid", gap: 1.5, alignItems: "start", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
            <ThaiDatePicker label="วันที่" value={docDate} onChange={(v) => setDocDate(v || moment().format("YYYY-MM-DD"))} />
            <SheetSelectField label="ถึง (ผู้มีอำนาจอนุมัติ)" value={to} allowCreate placeholder="แตะเพื่อเลือก หรือพิมพ์ชื่อ"
              options={toOptions.map((t) => ({ value: t, label: t, person: true, avatar: people.find((pp) => pp.fullName === t || pp.name === t)?.imageUrl }))} onChange={(v) => setTo(String(v || ""))} />
            {canPickPerson ? (
              <SheetSelectField label="พนักงานผู้เบิก (กรอกแทน)" value={requester?.userId || ""} title="เลือกพนักงานผู้เบิก"
                options={people.map((p) => ({ value: p.userId, label: p.fullName || p.name || "", sub: p.position || "", person: true, avatar: p.imageUrl }))}
                renderValue={(o) => o?.label || personFullName(requester) || ""}
                onChange={(v) => { const pp = people.find((x) => x.userId === v); if (!pp) return; setRequester(pp); setPosition(pp.position || ""); }} />
            ) : (
              <TextField size="small" label="พนักงานผู้เบิก (กรอกแทน)" InputProps={{ readOnly: true }}
                value={people.find((p) => p.userId === requester?.userId)?.fullName || personFullName(requester) || ""} />
            )}
            <TextField size="small" label="ตำแหน่งผู้เบิก" value={position} onChange={(e) => setPosition(e.target.value)} />
            <TextField size="small" label="เรื่อง *" value={subject} onChange={(e) => setSubject(e.target.value)}
              error={touched && !String(subject).trim()} sx={{ gridColumn: { sm: "1 / -1" } }} inputProps={{ maxLength: 300 }}
              placeholder="เช่น เบิกค่าจ้างผู้รับเหมา นายสมชาย งวดที่ 2/5 งานติดตั้งระบบ..." />
          </Box>
        </Section>

        {/* ── รายการค่าจ้าง ────────────────────────────────────────── */}
        <Section icon={<Receipt sx={{ fontSize: 18, color: ACCENT }} />} title="รายการค่าจ้างงวดนี้"
          hint={rateMode === "daily" ? "ค่าแรงรายวัน — 1 แถว = 1 วัน · วันเดียวกันเพิ่มเข้างานกลางคืนได้ (ไม่รวม VAT)" : "เนื้องานที่ส่งมอบในงวดนี้ · จำนวน × ราคาต่อหน่วย (ไม่รวม VAT)"}
          action={<Typography sx={{ fontWeight: 800, color: ACCENT, whiteSpace: "nowrap" }}>{baht(gross)}</Typography>}>
          <ToggleButtonGroup exclusive size="small" value={rateMode} onChange={(_, v) => v && setRateMode(v)}
            sx={{ mb: 1.5, "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 700, px: 2 }, "& .Mui-selected": { color: `${ACCENT} !important`, bgcolor: `${alpha(ACCENT, 0.1)} !important` } }}>
            <ToggleButton value="daily">คิดรายวัน (ใส่วันที่)</ToggleButton>
            <ToggleButton value="lump">เหมางาน</ToggleButton>
          </ToggleButtonGroup>
          {/* 🔁 (24 ต.ค. 2569 ผู้ใช้: "จัดวางฟอร์มใหม่ ให้เข้าใจง่าย สวยงาม ใช้งานง่าย")
              ค่าเริ่มต้นทุกวัน (กล่องเทา) → การ์ดวันละใบ (หัว: วันที่ + ลบ · เวลา/คน/ค่าแรงรวม · งานที่ทำ · บันทึกเข้างานจริง) → สรุปท้าย */}
          {rateMode === "daily" && (
            <Box sx={{ mb: 1.5, p: 1.25, borderRadius: 2.5, bgcolor: "#f8fafc", border: `1px solid ${BORDER_MAIN}` }}>
              <Typography sx={{ fontSize: "0.84rem", fontWeight: 800, color: "#0f172a", mb: 1 }}>ค่าเริ่มต้นทุกวัน <Box component="span" sx={{ fontWeight: 500, fontSize: "0.76rem", color: TEXT_SUB }}>· ใช้กับทุกการ์ดด้านล่าง แก้รายวันได้</Box></Typography>
              <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr 1fr", sm: "160px 220px" } }}>
                <TextField size="small" label="จำนวนคน/วัน" type="number" value={dailyPeople}
                  onChange={(e) => applyDailyPeople(e.target.value)} inputProps={{ min: 1, step: 1, ...numberField }}
                  InputProps={{ endAdornment: <InputAdornment position="end">คน</InputAdornment> }} sx={{ bgcolor: "#fff" }} />
                <TextField size="small" label="ค่าแรงรวม/วัน" type="number" value={dailyRate} placeholder="0"
                  onChange={(e) => applyDailyRate(e.target.value)} inputProps={{ min: 0, step: "any", ...numberField }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Box component="span" sx={{ fontWeight: 900, color: ACCENT }}>฿</Box></InputAdornment>,
                    endAdornment: <InputAdornment position="end">บาท</InputAdornment> }}
                  sx={{ "& .MuiOutlinedInput-notchedOutline": { borderColor: `${alpha(ACCENT, 0.5)} !important` }, "& .MuiInputBase-input": { fontSize: "1.05rem", fontWeight: 800 } }} />
              </Box>
              <Typography variant="caption" sx={{ display: "block", mt: 0.75, color: TEXT_SUB }}>
                {jobs.length
                  ? "วันที่ทำงานใส่ให้ครบตามช่วงงานที่เลือกแล้ว — ลบวันที่ไม่ได้มา หรือแก้เฉพาะวันได้"
                  : "เลือกงาน/ช่วงวันที่ด้านบน ระบบจะใส่วันที่ให้อัตโนมัติ · หรือกด “เพิ่มวัน”"}
              </Typography>
            </Box>
          )}
          {rateMode === "daily" && dupSlots.length > 0 && (
            <Alert severity="warning" sx={{ mb: 1, py: 0 }}>วันที่และช่วงเข้างานซ้ำกัน: {dupText} — ถ้าเข้างานทั้งกลางวันและกลางคืน ให้ตั้งแถวหนึ่งเป็น “เข้างานกลางคืน”</Alert>
          )}
          {gallery.dialog}
          <Stack spacing={rateMode === "daily" ? 1 : 1.25}>
            {/* 🔁 (13 พ.ย. 2569 ผู้ใช้: "การจัดวางยังจัดการได้ยาก ดูยาก สับสน ทำงานยากในมือถือ")
                การ์ดวันละใบ อ่านไล่จากบนลงล่าง:
                  หัว: "วันที่ N" + กะ (ป้าย) · ยอดเงินของวัน · ลบ
                  ① วันที่ (เต็มแถว) ② กะ กลางวัน/กลางคืน (ปุ่มแบ่งครึ่ง) ③ เวลาเริ่ม–ถึง ④ คน · ค่าแรงรวม ⑤ งานที่ทำ
                ตัดปุ่ม ✕ ในช่องเวลา (ซ้อนกับไอคอนนาฬิกา รก) → ลิงก์ "ไม่ระบุเวลา" ลิงก์เดียว */}
            {rateMode === "daily" && items.map((row, idx) => {
              const night = row.shift === "night";
              const tone = night ? "#334155" : ACCENT;
              return (
              <Box key={row.key} sx={{
                bgcolor: "#fff", borderRadius: "14px", overflow: "hidden",
                border: `1.5px solid ${isDupRow(row) ? "#f59e0b" : night ? "#cbd5e1" : BORDER_MAIN}`,
              }}>
                {/* หัวการ์ด */}
                <Stack direction="row" alignItems="center" gap={1} sx={{ px: 1.25, py: 0.75, bgcolor: night ? "#f1f5f9" : alpha(ACCENT, 0.05), borderBottom: `1px solid ${BORDER_MAIN}` }}>
                  <Box sx={{ minWidth: 24, height: 24, px: 0.6, borderRadius: 99, display: "grid", placeItems: "center", bgcolor: tone, color: "#fff", fontSize: "0.72rem", fontWeight: 900 }}>{idx + 1}</Box>
                  <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.86rem", fontWeight: 800, color: "#0f172a" }}>
                    {row.workDate ? thaiDate(row.workDate) : "ยังไม่เลือกวันที่"}
                    <Box component="span" sx={{ ml: 0.75, fontSize: "0.74rem", fontWeight: 800, color: tone }}>{night ? "เข้างานกลางคืน" : "เข้างานกลางวัน"}</Box>
                  </Typography>
                  <Typography sx={{ fontWeight: 900, fontSize: "0.92rem", color: "#0f172a", whiteSpace: "nowrap" }}>{baht(itemAmount(row))}</Typography>
                  <IconButton size="small" aria-label="ลบวันนี้" disabled={items.length === 1} sx={{ mr: -0.5 }}
                    onClick={() => setItems((rows) => rows.filter((r) => r.key !== row.key))}><DeleteOutline fontSize="small" /></IconButton>
                </Stack>
                <Box sx={{ p: 1.25, display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, minmax(0, 1fr))" }, alignItems: "end" }}>
                  <Box sx={{ gridColumn: { xs: "1 / -1", md: "span 2" } }}>
                    <ThaiDatePicker label="วันที่ทำงาน *" value={row.workDate} onChange={(v) => setItem(row.key, { workDate: v || "", auto: false })}
                      error={touched && !row.workDate} />
                  </Box>
                  {/* กะ: กลางวัน / กลางคืน — วันเดียวกันมีได้กะละแถว */}
                  <Box sx={{ gridColumn: { xs: "1 / -1", md: "span 2" } }}>
                    <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: "#334155", mb: 0.5 }}>ช่วงเวลาเข้างาน</Typography>
                    <ToggleButtonGroup exclusive fullWidth value={night ? "night" : "day"} aria-label="ช่วงเวลาเข้างาน"
                      onChange={(_, v) => v && setShift(row, v === "night" ? "night" : "")}
                      sx={{ height: 44, "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 800, fontSize: "0.86rem", borderColor: "#cbd5e1", color: "#475569" },
                        "& .Mui-selected": { color: "#fff !important", bgcolor: `${tone} !important` } }}>
                      <ToggleButton value="day">☀ กลางวัน</ToggleButton>
                      <ToggleButton value="night">☾ กลางคืน</ToggleButton>
                    </ToggleButtonGroup>
                  </Box>
                  {[["timeFrom", "เวลาเริ่ม"], ["timeTo", "เวลาเลิก"]].map(([k, label]) => (
                    <TextField key={k} size="small" label={label} type="time" value={row[k] || ""}
                      onChange={(e) => setItem(row.key, { [k]: e.target.value, auto: false })}
                      InputLabelProps={{ shrink: true }} inputProps={{ step: 300 }} />
                  ))}
                  {/* 🔁 (13 พ.ย. 2569 ผู้ใช้: "ช่องค่าแรงควรให้มองง่าย เด่นชัดกว่านี้") คน (แคบ) · ค่าแรงรวม (กว้าง · พื้นฟ้าอ่อน ขอบน้ำเงิน ตัวเลขใหญ่) */}
                  <Box sx={{ gridColumn: "1 / -1", display: "grid", gap: 1.25, gridTemplateColumns: { xs: "minmax(0, 0.75fr) minmax(0, 1.5fr)", md: "160px minmax(0, 1fr)" }, alignItems: "end" }}>
                    <TextField size="small" label="จำนวนคน" type="number" value={row.people ?? ""} onChange={(e) => setItem(row.key, { people: e.target.value, auto: false })}
                      inputProps={{ min: 0, step: 1, ...numberField }} InputProps={{ endAdornment: <InputAdornment position="end">คน</InputAdornment> }} />
                    {/* ค่าแรงรวมของวันนั้น (ทั้งทีม) — ค่าแรงแต่ละคนไม่เท่ากัน จึงกรอกยอดรวม */}
                    <TextField size="small" label="ค่าแรงรวม" type="number" value={row.unitPrice} placeholder="0"
                      onChange={(e) => setItem(row.key, { unitPrice: e.target.value, qty: 1, unit: "วัน", auto: false })}
                      inputProps={{ min: 0, step: "any", ...numberField }}
                      InputProps={{ startAdornment: <InputAdornment position="start"><Box component="span" sx={{ fontWeight: 900, color: tone }}>฿</Box></InputAdornment>,
                        endAdornment: <InputAdornment position="end">บาท</InputAdornment> }}
                      sx={{
                        "& > .MuiInputLabel-root": { color: `${tone} !important` },
                        "& .MuiOutlinedInput-root": { bgcolor: alpha(tone, 0.05), minHeight: 50 },
                        "& .MuiOutlinedInput-notchedOutline": { borderColor: `${alpha(tone, 0.55)} !important`, borderWidth: "2px !important" },
                        "& .MuiInputBase-input": { fontSize: "1.2rem", fontWeight: 900, color: "#0f172a", fontVariantNumeric: "tabular-nums" },
                      }} />
                  </Box>
                  <TextField size="small" label="งานที่ทำ" value={row.description} onChange={(e) => setItem(row.key, { description: e.target.value })}
                    inputProps={{ maxLength: 300 }} placeholder="เช่น เดินสาย ติดตั้งอุปกรณ์" error={touched && !String(row.description).trim()}
                    sx={{ gridColumn: "1 / -1" }} />
                  {/* 🔁 (26 ต.ค. 2569 ผู้ใช้: "เวลา แก้ไข หรือไม่ใส่ก็ได้") ลิงก์เดียวล้างเวลาทั้งคู่ */}
                  <Stack direction="row" alignItems="center" gap={1} sx={{ gridColumn: "1 / -1", mt: -0.5, flexWrap: "wrap" }}>
                    {(row.timeFrom || row.timeTo) && (
                      <Button size="small" onClick={() => setItem(row.key, { timeFrom: "", timeTo: "", auto: false })}
                        sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.76rem", color: TEXT_SUB, px: 0.75, minWidth: 0 }}>ไม่ระบุเวลา</Button>
                    )}
                    {/* วันนี้ยังไม่มีกะกลางคืน → ปุ่มเพิ่ม (คน/ค่าแรงแยกจากกะกลางวัน) */}
                    {row.workDate && !night && !items.some((r) => r.workDate === row.workDate && r.shift === "night") && items.length < MAX_ITEMS && (
                      <Button size="small" startIcon={<Add />} onClick={() => addNightShift(row)}
                        sx={{ ml: "auto", textTransform: "none", fontWeight: 800, fontSize: "0.78rem", color: "#334155", borderRadius: 99, px: 1.25, border: "1px solid #cbd5e1" }}>
                        เพิ่มเข้างานกลางคืนวันนี้
                      </Button>
                    )}
                  </Stack>
                  {/* บันทึกเข้างานจริงของวันนั้น (งานที่อ้างอิง) — เวลา · ผู้บันทึก · รูปหน้างาน */}
                  {row.workDate && <Box sx={{ gridColumn: "1 / -1" }}><AttendanceDayStrip entries={attByDay.get(row.workDate)} hasJobs={jobs.length > 0} onOpen={gallery.open} /></Box>}
                </Box>
              </Box>
              );
            })}
            {rateMode === "lump" && items.map((row, idx) => (
              <Box key={row.key} sx={{ border: `1px solid ${BORDER_MAIN}`, borderLeft: `3px solid ${ACCENT}`, borderRadius: 2, p: 1.25, bgcolor: "#fff" }}>
                <Box sx={{ display: "grid", gap: 1, alignItems: "start", gridTemplateColumns: { xs: "1fr 1fr", md: "1fr 72px 90px 130px" } }}>
                  <TextField size="small" label={`#${idx + 1} รายการ / เนื้องาน *`} value={row.description}
                    onChange={(e) => setItem(row.key, { description: e.target.value })}
                    error={touched && !String(row.description).trim()} sx={{ gridColumn: { xs: "1 / -1", md: "auto" } }} inputProps={{ maxLength: 300 }}
                    placeholder="เช่น ค่าแรงติดตั้งท่อร้อยสาย ชั้น 3–5" />
                  <TextField size="small" label="จำนวน" type="number" value={row.qty} onChange={(e) => setItem(row.key, { qty: e.target.value })}
                    inputProps={{ min: 0, step: "any", ...numberField }} error={Number(row.qty) <= 0} />
                  <TextField size="small" label="หน่วย" value={row.unit} onChange={(e) => setItem(row.key, { unit: e.target.value })} inputProps={{ maxLength: 30 }} />
                  <TextField size="small" label="ราคา/หน่วย" type="number" value={row.unitPrice} onChange={(e) => setItem(row.key, { unitPrice: e.target.value })}
                    inputProps={{ min: 0, step: "any", ...numberField }} sx={{ gridColumn: { xs: "1 / -1", md: "auto" } }} />
                </Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                  <TextField size="small" variant="standard" placeholder="รายละเอียดเพิ่มเติม เช่น พื้นที่ / จำนวนจุด (ไม่บังคับ)"
                    value={row.detail} onChange={(e) => setItem(row.key, { detail: e.target.value })}
                    sx={{ flex: 1, minWidth: 0, "& input": { fontSize: "0.82rem" } }} inputProps={{ maxLength: 300 }} />
                  <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", minWidth: 90, textAlign: "right" }}>{fmtMoney(itemAmount(row))}</Typography>
                  <Tooltip title="ลบรายการ">
                    <span>
                      <IconButton size="small" aria-label="ลบรายการ" disabled={items.length === 1}
                        onClick={() => setItems((rows) => rows.filter((r) => r.key !== row.key))}>
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Box>
            ))}
          </Stack>
          <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} alignItems="center" sx={{ mt: 1.25 }}>
            <Button size="small" variant="outlined" startIcon={<Add />} disabled={items.length >= MAX_ITEMS}
              onClick={() => (rateMode === "daily" ? addNextDay() : setItems((rows) => [...rows, blankItem()]))}
              sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, borderColor: alpha(ACCENT, 0.5), color: ACCENT }}>
              {rateMode === "daily" ? "เพิ่มวัน" : "เพิ่มรายการ"}
            </Button>
            {rateMode === "daily" && dayCount > 0 && (
              <Typography variant="caption" sx={{ color: TEXT_SUB, ml: "auto", fontWeight: 700 }}>รวม {dayCount} วัน{nightCount ? ` (เข้างานกลางคืน ${nightCount})` : ""} · {manDays.toLocaleString()} แรง · {baht(gross)}</Typography>
            )}
          </Stack>
        </Section>

        {/* ── ภาษีและรายการหัก ─────────────────────────────────────── */}
        <Section icon={<Payments sx={{ fontSize: 18, color: ACCENT }} />} title="ภาษีและรายการหัก"
          hint="หัก ณ ที่จ่ายคิดจากยอดก่อน VAT · หักมัดจำ/เบิกล่วงหน้าที่เคยจ่ายให้ผู้รับเหมาไปแล้ว">
          <Box sx={{ display: "grid", gap: 1.5, alignItems: "start", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" } }}>
            <SheetSelectField label="ภาษีมูลค่าเพิ่ม (VAT)" value={vatRate} sort={false}
              options={[{ value: 0, label: "ไม่มี VAT", sub: "ผู้รับเหมาไม่ได้จด VAT" }, { value: 7, label: "VAT 7%", sub: "ผู้รับเหมาจด VAT — แนบใบกำกับภาษี" }]}
              onChange={(v) => setVatRate(Number(v))}
              helperText={vatRate ? "ผู้รับเหมาจด VAT — แนบใบกำกับภาษี" : "ผู้รับเหมาไม่ได้จด VAT"} />
            <SheetSelectField label="หัก ณ ที่จ่าย" value={whtIsPreset ? Number(whtRate) : "custom"} sort={false}
              options={[...WHT_PRESETS.map((pp) => ({ value: pp.value, label: pp.label })), { value: "custom", label: "อัตราอื่น…", sub: "กรอกอัตราเอง" }]}
              onChange={(v) => setWhtRate(v === "custom" ? 1.5 : Number(v))}
              helperText={cIsCompany ? "นิติบุคคล — ยื่น ภ.ง.ด.53" : "บุคคลธรรมดา — ยื่น ภ.ง.ด.3"} />
            <TextField size="small" label="หักเงินมัดจำ / เบิกล่วงหน้า" type="number" value={deposit}
              onChange={(e) => setDeposit(e.target.value)} inputProps={{ min: 0, step: "any", ...numberField }}
              InputProps={{ endAdornment: <InputAdornment position="end">บาท</InputAdornment> }}
              helperText="ยอดที่จ่ายให้ผู้รับเหมาไปก่อนแล้ว (ถ้ามี)" />
            {!whtIsPreset && (
              <TextField size="small" label="อัตราหัก ณ ที่จ่าย" type="number" value={whtRate}
                onChange={(e) => setWhtRate(e.target.value)} inputProps={{ min: 0, max: 15, step: "0.5", ...numberField }}
                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} />
            )}
          </Box>

          <Box sx={{ mt: 1.75, p: 1.5, borderRadius: 2, bgcolor: alpha(ACCENT, 0.05), border: `1px dashed ${alpha(ACCENT, 0.4)}` }}>
            <SumLine label="ค่าจ้างงวดนี้ (ก่อน VAT)" value={calc.gross} />
            {calc.vat > 0 && <SumLine label={`บวก VAT ${calc.vatRate}%`} value={calc.vat} />}
            {calc.wht > 0 && <SumLine label={`หัก ณ ที่จ่าย ${calc.whtRate}%`} value={calc.wht} minus color="#b45309" />}
            {calc.deposit > 0 && <SumLine label="หักเงินมัดจำ / เบิกล่วงหน้า" value={calc.deposit} minus color="#b45309" />}
            <Box sx={{ borderTop: `1px solid ${alpha(ACCENT, 0.3)}`, mt: 0.75, pt: 0.75 }}>
              <SumLine label="ยอดจ่ายสุทธิให้ผู้รับเหมา" value={calc.net} strong color={calc.net < 0 ? "#dc2626" : META.dark} />
              <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", textAlign: "right" }}>
                ( {bahtText(Math.max(calc.net, 0))} )
              </Typography>
            </Box>
          </Box>
        </Section>

        {/* ── บัญชีรับเงินของผู้รับเหมา ─────────────────────────────── */}
        <Section icon={<AccountBalance sx={{ fontSize: 18, color: ACCENT }} />} title="การรับเงินของผู้รับเหมา"
          hint="ตรวจเลขบัญชีให้ตรงสมุดบัญชี — ผู้อนุมัติเบิกจ่ายโอนตามข้อมูลนี้">
          <ToggleButtonGroup exclusive size="small" value={payMode} onChange={(_, v) => v && setPayMode(v)} sx={{ mb: 1.5, "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 700, px: 2 }, "& .Mui-selected": { color: `${ACCENT} !important`, bgcolor: `${alpha(ACCENT, 0.1)} !important` } }}>
            <ToggleButton value="transfer">โอนเข้าบัญชี</ToggleButton>
            <ToggleButton value="cash">เงินสด / เช็ค</ToggleButton>
          </ToggleButtonGroup>
          {payMode === "transfer" && (
            <Box sx={{ display: "grid", gap: 1.5, alignItems: "start", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
              <SheetSelectField label="ธนาคาร" required value={bankCode} title="เลือกธนาคาร" error={touched && !bankCode}
                options={BANKS.map((b) => ({ value: b.code, label: b.name, icon: bankLogoUrl(b.code) ? `<img src="${bankLogoUrl(b.code)}" alt="" style="width:30px;height:30px;border-radius:50%;flex-shrink:0;object-fit:contain;background:#fff">` : "" }))}
                renderValue={(o, v) => <Stack direction="row" spacing={1} alignItems="center"><BankLogo code={v} size={22} /><span>{bankMeta(v).name}</span></Stack>}
                onChange={(v) => setBankCode(v)} />
              <TextField size="small" label="เลขที่บัญชี *" value={accountNo} onChange={(e) => setAccountNo(digitsOnly(e.target.value).slice(0, 15))}
                inputProps={{ inputMode: "numeric" }} error={Boolean(bankCode && accountNo && bankError)}
                helperText={bankCode && accountNo && bankError ? bankError : " "} />
              <TextField size="small" label="ชื่อบัญชี *" value={accountName} onChange={(e) => setAccountName(e.target.value)}
                sx={{ gridColumn: { sm: "1 / -1" } }} inputProps={{ maxLength: 120 }} error={touched && bankCode && !String(accountName).trim()}
                InputProps={{ endAdornment: !accountName && cName ? (
                  <InputAdornment position="end">
                    <Button size="small" onClick={() => setAccountName(cName)} sx={{ textTransform: "none", fontWeight: 700 }}>ใช้ชื่อผู้รับเหมา</Button>
                  </InputAdornment>
                ) : null }} />
            </Box>
          )}
          {payMode === "cash" && (
            <Typography variant="caption" sx={{ color: TEXT_SUB }}>จ่ายเป็นเงินสดหรือเช็ค — ผู้อนุมัติเบิกจ่ายบันทึกวิธีจ่ายและเลขที่เช็คตอนจ่ายจริง</Typography>
          )}
        </Section>

        {canSignSelf && mySignature && (
          <Section icon={<HistoryEdu sx={{ fontSize: 18, color: ACCENT }} />} title="ลายเซ็นอิเล็กทรอนิกส์" hint="พิมพ์ลงช่องผู้เบิกของใบ PDF">
            <FormControlLabel sx={{ mr: 0 }}
              control={<Checkbox size="small" checked={useSignature} onChange={(e) => setUseSignature(e.target.checked)} sx={{ "&.Mui-checked": { color: ACCENT } }} />}
              label={<Typography sx={{ fontSize: "0.85rem", fontWeight: 700 }}>ลงลายเซ็นอิเล็กทรอนิกส์ของฉันในใบนี้</Typography>} />
            <Box component="img" src={mySignature.image} alt="" sx={{ display: "block", ml: 3.75, height: 34, maxWidth: 150, objectFit: "contain", opacity: useSignature ? 1 : 0.28 }} />
          </Section>
        )}

        {/* ── หมายเหตุและหลักฐาน ───────────────────────────────────── */}
        <Section icon={<NotesIcon />} title="หมายเหตุและหลักฐาน" hint="แนบใบแจ้งหนี้/ใบกำกับภาษี รูปผลงานที่ส่งมอบ และสำเนาบัตร/หนังสือรับรอง (ครั้งแรก)">
          <TextField size="small" fullWidth label="หมายเหตุ" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} inputProps={{ maxLength: 1000 }}
            placeholder="เช่น ส่งมอบงานชั้น 3–5 ครบตามแบบ ตรวจรับโดยหัวหน้างานแล้ว" />
          <input ref={fileInputRef} type="file" hidden multiple accept={ACCEPT_ALL}
            onChange={(e) => {
              const arr = Array.from(e.target.files || []).map((file) => ({ key: nextKey(), file, kind: file.type.startsWith("image/") ? "photo" : "invoice" }));
              setFiles((cur) => [...cur, ...arr].slice(0, 15));
              e.target.value = "";
            }} />
          <Box onClick={() => fileInputRef.current?.click()} sx={{
            mt: 1.5, p: 1.5, border: `1px dashed ${alpha(ACCENT, 0.45)}`, borderRadius: 2, bgcolor: alpha(ACCENT, 0.03),
            textAlign: "center", cursor: "pointer", "&:hover": { bgcolor: alpha(ACCENT, 0.07) },
          }}>
            <AttachFile sx={{ fontSize: 20, color: ACCENT }} />
            <Typography sx={{ fontSize: "0.85rem", fontWeight: 700, color: ACCENT }}>แนบใบแจ้งหนี้ / รูปผลงาน</Typography>
            <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>
              ระบบย่อรูปให้อัตโนมัติ · รองรับ JPG PNG HEIC PDF Word Excel · ไฟล์ละไม่เกิน {MAX_UPLOAD_MB} MB
            </Typography>
          </Box>
          <Stack spacing={0.75} sx={{ mt: 1 }}>
            {files.map((f) => (
              <Stack key={f.key} direction="row" alignItems="center" spacing={1} sx={{ p: 0.75, pl: 1, border: `1px solid ${BORDER_MAIN}`, borderRadius: 2, bgcolor: "#fff" }}>
                {/* 🔁 (10 พ.ย. 2569) ป้ายชนิดไฟล์ชุดกลางของแอป (PDF/XLS/DOC/รูป) */}
                <FileKindThumb name={f.file.name} size={34} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.82rem", fontWeight: 600 }} noWrap>{f.file.name}</Typography>
                  <Typography variant="caption" sx={{ color: TEXT_SUB }}>{formatBytes(f.file.size)}</Typography>
                </Box>
                <SheetSelectField dense value={f.kind} title="ชนิดไฟล์" sort={false} sx={{ width: 140, flexShrink: 0 }}
                    options={FILE_KINDS.map((k) => ({ value: k.value, label: k.label }))}
                    onChange={(v) => setFiles((cur) => cur.map((x) => (x.key === f.key ? { ...x, kind: v } : x)))} />
                <IconButton size="small" onClick={() => setFiles((cur) => cur.filter((x) => x.key !== f.key))}><Close fontSize="small" /></IconButton>
              </Stack>
            ))}
          </Stack>
          {editing && expense.attachments?.length > 0 && (
            <Typography variant="caption" sx={{ display: "block", color: TEXT_SUB, mt: 1 }}>
              มีไฟล์แนบเดิม {expense.attachments.length} ไฟล์ (จัดการได้ในหน้ารายละเอียด)
            </Typography>
          )}
        </Section>
      </DialogContent>

      <DialogActions sx={{ px: { xs: 1.5, sm: 2.5 }, py: 1.25, borderTop: `1px solid ${BORDER_MAIN}`, gap: 1, bgcolor: "#fff" }}>
        {error ? (
          <Alert severity="error" sx={{ flex: 1, py: 0, "& .MuiAlert-message": { fontSize: "0.8rem" } }}>{error}</Alert>
        ) : (
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ color: TEXT_SUB, fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap" }}>ยอดจ่ายสุทธิ</Typography>
            <Typography sx={{ fontWeight: 900, fontSize: "1.15rem", color: TEXT_MAIN, lineHeight: 1.15, whiteSpace: "nowrap" }}>{baht(Math.max(calc.net, 0))}</Typography>
          </Box>
        )}
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: "none", color: TEXT_SUB, display: { xs: error ? "none" : "inline-flex", sm: "inline-flex" } }}>ยกเลิก</Button>
        <Button variant="contained" onClick={submit} disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : editing && !resubmit ? <Save sx={{ fontSize: 18 }} /> : <Send sx={{ fontSize: 17 }} />}
          sx={{ textTransform: "none", fontWeight: 800, borderRadius: "12px", px: 2.5, minHeight: 46, fontSize: "0.92rem", boxShadow: "none", whiteSpace: "nowrap", bgcolor: ACCENT, "&:hover": { bgcolor: META.dark, boxShadow: "none" } }}>
          {saving ? "กำลังบันทึก..." : resubmit ? "ส่งใหม่" : editing ? "บันทึก" : "ส่งขออนุมัติ"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
