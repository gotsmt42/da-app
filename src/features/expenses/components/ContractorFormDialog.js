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
import { useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography, TextField, IconButton, Alert,
  useMediaQuery, Autocomplete, MenuItem, Chip, Tooltip, CircularProgress, ToggleButton, ToggleButtonGroup,
  Checkbox, FormControlLabel, InputAdornment, LinearProgress,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Close, Add, DeleteOutline, AttachFile, Send, Save, Engineering, AccountBalance, Payments, HistoryEdu, CheckBox, CheckBoxOutlineBlank,
  Business, Person, Receipt, Work,
} from "@mui/icons-material";

import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import { ACCEPT_ALL, formatBytes, MAX_UPLOAD_MB } from "@/shared/utils/fileUpload";
import { thaiDate } from "@/shared/utils/thaiDate";
import { useAuth } from "@/features/auth/AuthContext";
import usePermissions from "@/shared/hooks/usePermissions";
import ExpenseService, { errorText } from "../services/ExpenseService";
import SignatureService from "@/shared/services/SignatureService";
import KindBadge from "./KindBadge";
import StatusBadge from "./StatusBadge";
import BankLogo from "./BankLogo";
import { BANKS, bankMeta, digitsOnly, validateAccount } from "../bankMeta";
import {
  KIND_META, FILE_KINDS, baht, fmtMoney, bahtText, itemAmount, itemsTotal, money, jobText, jobRangeText, jobPartText, jobRangeDates,
  contractorCalc, installmentText, WHT_PRESETS, personFullName, TEXT_SUB, TEXT_MAIN, BORDER_MAIN,
} from "../expenseMeta";
import useFormDraft, { DraftBanner } from "@/shared/hooks/useFormDraft";

const META = KIND_META.contractor;
const ACCENT = META.color;
const MAX_ITEMS = 40;
let keySeq = 0;
const nextKey = () => `c${Date.now()}_${(keySeq += 1)}`;
const blankItem = () => ({ key: nextKey(), category: "labor", description: "", detail: "", qty: 1, unit: "งาน", unitPrice: "", workDate: "" });
/** แถวค่าแรงรายวัน — 1 แถว = 1 วันทำงาน (ผู้ใช้: "อยากได้ใส่วันที่ เพราะเขาเบิกเป็นวัน") */
const dayItem = (workDate = "", unitPrice = "", auto = false) => ({
  key: nextKey(), category: "labor", description: "ค่าแรง", detail: "", qty: 1, unit: "วัน", unitPrice, workDate, auto,
});
const fromDoc = (it) => ({
  key: nextKey(), category: it.category || "labor", description: it.description || "", detail: it.detail || "",
  qty: it.qty ?? 1, unit: it.unit || "", unitPrice: it.unitPrice ?? "", workDate: it.workDate ? moment(it.workDate).format("YYYY-MM-DD") : "",
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
const Section = ({ icon, title, hint, children, action }) => (
  <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 2.5, p: { xs: 1.5, sm: 2 }, mb: 1.75 }}>
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
      <Box sx={{ width: 4, height: 18, borderRadius: 1, bgcolor: ACCENT }} />
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
    data: { docDate, to, position, subject, jobs, cName, cTaxId, cPhone, cAddress, cIsCompany, instNo, instTotal, contractValue, items, rateMode, dailyRate, vatRate, whtRate, deposit, payMode, bankCode, accountNo, accountName },
    restore: (d) => {
      if (d.docDate) setDocDate(d.docDate);
      setTo(d.to || ""); setPosition(d.position || ""); setSubject(d.subject || "");
      if (Array.isArray(d.jobs)) setJobs(d.jobs);
      setCName(d.cName || ""); setCTaxId(d.cTaxId || ""); setCPhone(d.cPhone || ""); setCAddress(d.cAddress || ""); setCIsCompany(Boolean(d.cIsCompany));
      setInstNo(d.instNo || ""); setInstTotal(d.instTotal || ""); setContractValue(d.contractValue || "");
      if (Array.isArray(d.items)) setItems(d.items.map((it) => ({ ...it, key: nextKey() })));
      if (d.rateMode) setRateMode(d.rateMode);
      setDailyRate(d.dailyRate || ""); setVatRate(d.vatRate ?? 0); setWhtRate(d.whtRate ?? 3); setDeposit(d.deposit || "");
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
    setSubject((cur) => (!String(cur).trim() || cur === autoSubjectRef.current ? next : cur));
    autoSubjectRef.current = next;
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
  const dates = items.map((it) => it.workDate).filter(Boolean);
  const dupDates = [...new Set(dates.filter((d, i) => dates.indexOf(d) !== i))];
  const dayCount = rateMode === "daily" ? validItems.filter((it) => it.workDate).length : 0;

  /** ใช้ค่าแรงต่อวันกับทุกวันในรายการ */
  const applyDailyRate = (v) => {
    setDailyRate(v);
    setItems((rows) => rows.map((r) => ({ ...r, unitPrice: v, qty: 1, unit: "วัน" })));
  };
  /**
   * ✅ ผู้ใช้สั่ง: "อยากให้ทำง่าย คำนวณกรอกวันที่เองอัตโนมัติ"
   * เลือกช่วงงานแล้ว ระบบสร้างแถวให้ทุกวันของทุกช่วงเอง · เอาช่วงออก = วันของช่วงนั้นหายไปด้วย
   * ⚠️ แถวที่ผู้ใช้เพิ่มเอง (auto = false) ไม่ถูกลบ · แถวเดิมของวันเดียวกันเก็บค่าแรง/งานที่แก้ไว้
   * ⚠️ ไม่ทำตอนแก้ใบเดิม — รายการที่บันทึกไว้แล้วต้องไม่เปลี่ยนเองเงียบๆ
   */
  const jobsKey = jobs.map((j) => j._id).join(",");
  useEffect(() => {
    if (!open || editing || rateMode !== "daily") return;
    const days = [...new Set(jobs.flatMap(daysOfRange))].sort();
    setItems((rows) => {
      const manual = rows.filter((r) => !r.auto && (r.workDate || Number(r.unitPrice) > 0));
      const byDate = new Map(rows.filter((r) => r.workDate).map((r) => [r.workDate, r]));
      const auto = days.filter((d) => !manual.some((m) => m.workDate === d))
        .map((d) => (byDate.get(d)?.auto ? byDate.get(d) : dayItem(d, dailyRate, true)));
      const next = [...manual, ...auto].sort((a, b) => String(a.workDate || "9").localeCompare(String(b.workDate || "9"))).slice(0, MAX_ITEMS);
      return next.length ? next : [dayItem("", dailyRate)];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- สร้างใหม่เฉพาะตอนช่วงงานที่เลือกเปลี่ยน
  }, [open, editing, rateMode, jobsKey]);

  /** เพิ่มวันถัดจากวันล่าสุดในรายการ */
  const addNextDay = () => setItems((rows) => {
    const last = rows.map((r) => r.workDate).filter(Boolean).sort().pop();
    const rate = dailyRate || ([...rows].reverse().find((r) => Number(r.unitPrice) > 0)?.unitPrice ?? "");
    return [...rows, dayItem(last ? moment(last).add(1, "day").format("YYYY-MM-DD") : "", rate)];
  });
  const taxDigits = digitsOnly(cTaxId);
  const bankError = payMode === "transfer" && bankCode ? validateAccount(bankCode, digitsOnly(accountNo)) : "";
  const problems = [];
  if (!String(cName).trim()) problems.push("ระบุชื่อผู้รับเหมา");
  if (taxDigits && taxDigits.length !== 13) problems.push("เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก");
  if (!String(subject).trim()) problems.push("ระบุเรื่อง");
  if (!validItems.length) problems.push("เพิ่มรายการค่าจ้างอย่างน้อย 1 รายการ");
  if (rateMode === "daily" && validItems.some((it) => !it.workDate)) problems.push("ระบุวันที่ทำงานให้ครบทุกแถว");
  if (dupDates.length) problems.push(`วันที่ซ้ำกัน (${dupDates.map((d) => thaiDate(d)).join(", ")})`);
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
        .sort((a, b) => (rateMode === "daily" ? String(a.workDate).localeCompare(String(b.workDate)) : 0))
        .map(({ key, auto, ...it }) => ({
          ...it, qty: Number(it.qty) || 0, unitPrice: Number(it.unitPrice) || 0, workDate: rateMode === "daily" ? it.workDate : "",
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
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{
          px: { xs: 2, sm: 2.5 }, py: 1.5, borderBottom: `1px solid ${alpha(ACCENT, 0.25)}`, borderTop: `5px solid ${ACCENT}`, bgcolor: META.soft,
        }}>
          <Box sx={{ width: 38, height: 38, borderRadius: 2.5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: ACCENT, color: "#fff" }}>
            <Engineering sx={{ fontSize: 21 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
              <KindBadge kind="contractor" />
              <Typography sx={{ fontWeight: 800, fontSize: "1.02rem", lineHeight: 1.3, color: META.dark }} noWrap>
                {editing ? `แก้ไข ${expense.docNo || ""}` : `ออก${META.label}ใหม่`}
              </Typography>
            </Stack>
            <Typography variant="caption" sx={{ color: TEXT_SUB }} noWrap component="div">
              เบิกค่าแรง/ค่าจ้างเหมาตามงวดงาน · หัก ณ ที่จ่ายและมัดจำให้อัตโนมัติ
            </Typography>
          </Box>
          <IconButton onClick={onClose} disabled={saving}><Close /></IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ bgcolor: "#f8fafc", px: { xs: 1.25, sm: 2.5 }, pt: "16px !important", pb: 1 }}>
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
            <Autocomplete
              freeSolo options={known} sx={{ gridColumn: { sm: "1 / -1" } }}
              value={cName} inputValue={cName}
              onInputChange={(_, v, reason) => { if (reason !== "reset") setCName(v.slice(0, 150)); }}
              onChange={(_, v) => (typeof v === "string" ? setCName(v) : pickKnown(v))}
              getOptionLabel={(o) => (typeof o === "string" ? o : o?.name || "")}
              isOptionEqualToValue={(o, v) => o.name === (typeof v === "string" ? v : v?.name)}
              renderOption={({ key, ...liProps }, o) => (
                <li {...liProps} key={o.name}>
                  {o.isCompany ? <Business sx={{ fontSize: 18, color: ACCENT, mr: 1 }} /> : <Person sx={{ fontSize: 18, color: ACCENT, mr: 1 }} />}
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.88rem", fontWeight: 700 }} noWrap>{o.name}</Typography>
                    <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }} noWrap>
                      {[o.taxId ? `เลขภาษี ${o.taxId}` : "", o.phone, o.payTo?.accountNo ? `${bankMeta(o.payTo.bankCode).short} ${o.payTo.accountNo}` : ""].filter(Boolean).join(" · ") || "ไม่มีข้อมูลเพิ่มเติม"}
                    </Typography>
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField {...params} size="small" label="ชื่อผู้รับเหมา / บริษัท *" placeholder="เช่น นายสมชาย ใจดี / หจก. ช่างดีการไฟฟ้า"
                  error={touched && !String(cName).trim()} />
              )}
            />
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
            <Autocomplete
              multiple disableCloseOnSelect
              sx={{ gridColumn: "1 / -1" }}
              // ✅ เลือกช่วงแรกแล้ว เหลือให้เลือกเฉพาะช่วงอื่นของ "งานเดียวกัน" — ปนคนละงานไม่ได้
              options={(() => {
                const merged = [...jobs, ...jobOptions.filter((o) => !jobs.some((j) => j._id === o._id))];
                if (!job) return jobOptions;
                return merged.filter((o) => jobs.some((j) => j._id === o._id) || (job.groupKey && o.groupKey === job.groupKey)).sort(byStart);
              })()}
              value={jobs} loading={jobLoading} filterOptions={(x) => x}
              onChange={(_, v) => {
                const next = [...v].sort(byStart);
                // เลือกช่วงแรกของงาน → ค้นด้วยเลขที่/ชื่องานนั้น ให้ช่วงอื่นของงานเดียวกันขึ้นมาครบให้ติ๊กต่อ
                if (!jobs.length && next.length) setJobQuery(next[0].docNo || next[0].title || "");
                if (!next.length) setJobQuery("");
                setJobs(next);
              }}
              disabled={Boolean(presetJob) && !editing}
              onInputChange={(_, v, reason) => { if (reason === "input") setJobQuery(v); }}
              isOptionEqualToValue={(o, v) => o._id === v._id}
              getOptionLabel={(o) => (o ? [jobText(o) || o.title || "", jobRangeText(o)].filter(Boolean).join(" · ") : "")}
              renderTags={(value, getTagProps) => value.map((o, i) => {
                const { key, ...tagProps } = getTagProps({ index: i });
                return <Chip key={key} {...tagProps} size="small" label={rangeChip(o)} sx={{ fontWeight: 700, bgcolor: alpha(ACCENT, 0.1), color: META.dark }} />;
              })}
              noOptionsText={job ? "ไม่มีช่วงวันที่อื่นของงานนี้" : "ไม่พบงาน"}
              renderOption={({ key, ...liProps }, o, { selected }) => (
                <li {...liProps} key={o._id}>
                  {job && (
                    <Checkbox size="small" checked={selected} sx={{ mr: 0.5, p: 0.5, "&.Mui-checked": { color: ACCENT } }}
                      icon={<CheckBoxOutlineBlank fontSize="small" />} checkedIcon={<CheckBox fontSize="small" />} />
                  )}
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexWrap: "wrap", rowGap: 0.25 }}>
                      <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, lineHeight: 1.35 }}>{jobText(o) || o.title}</Typography>
                      {jobPartText(o) && <Chip size="small" label={jobPartText(o)} sx={{ height: 18, fontSize: "0.65rem", fontWeight: 800 }} />}
                    </Stack>
                    <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>
                      {[jobRangeText(o), o.docNo ? `เลขที่ ${o.docNo}` : "", o.status || ""].filter(Boolean).join(" · ")}
                    </Typography>
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField {...params} size="small" label="งาน / ช่วงวันที่ของงวดนี้ (แนะนำให้ผูก)"
                  placeholder={job ? "เพิ่มช่วงวันที่ของงานนี้" : "ค้นหาชื่องาน / โครงการ / เลขที่"}
                  helperText={job
                    ? `${jobText(job)} · เลือก ${jobs.length} ช่วงวันที่${job.groupKey ? " — ติ๊กเพิ่มช่วงอื่นของงานเดียวกันได้ (ล้างทั้งหมดเพื่อเปลี่ยนงาน)" : " (งานนี้มีช่วงเดียว)"}`
                    : "งวดเดียวเลือกได้หลายช่วงวันที่ของงานเดียวกัน"}
                  InputProps={{ ...params.InputProps, endAdornment: (<>{jobLoading ? <CircularProgress size={16} /> : null}{params.InputProps.endAdornment}</>) }} />
              )}
            />
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
        <Section title="ข้อมูลเอกสาร" hint="ผู้เบิก = พนักงานที่กรอกใบแทนผู้รับเหมา (รับผิดชอบเอกสารในสายอนุมัติ)">
          <Box sx={{ display: "grid", gap: 1.5, alignItems: "start", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
            <ThaiDatePicker label="วันที่" value={docDate} onChange={(v) => setDocDate(v || moment().format("YYYY-MM-DD"))} />
            <Autocomplete
              freeSolo options={toOptions} value={to} inputValue={to}
              onInputChange={(_, v) => setTo(v)} onChange={(_, v) => setTo(v || "")}
              renderInput={(params) => <TextField {...params} size="small" label="ถึง (ผู้มีอำนาจอนุมัติ)" />}
            />
            {canPickPerson ? (
              <Autocomplete
                options={people}
                value={people.find((p) => p.userId === requester?.userId) || (requester?.userId ? requester : null)}
                onChange={(_, v) => { if (!v) return; setRequester(v); setPosition(v.position || ""); }}
                isOptionEqualToValue={(o, v) => o.userId === v.userId}
                getOptionLabel={(o) => o?.fullName || o?.name || ""}
                disableClearable
                renderInput={(params) => <TextField {...params} size="small" label="พนักงานผู้เบิก (กรอกแทน)" />}
              />
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
          hint={rateMode === "daily" ? "ค่าแรงรายวัน — 1 แถว = 1 วันทำงาน (ไม่รวม VAT)" : "เนื้องานที่ส่งมอบในงวดนี้ · จำนวน × ราคาต่อหน่วย (ไม่รวม VAT)"}
          action={<Typography sx={{ fontWeight: 800, color: ACCENT, whiteSpace: "nowrap" }}>{baht(gross)}</Typography>}>
          <ToggleButtonGroup exclusive size="small" value={rateMode} onChange={(_, v) => v && setRateMode(v)}
            sx={{ mb: 1.5, "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 700, px: 2 }, "& .Mui-selected": { color: `${ACCENT} !important`, bgcolor: `${alpha(ACCENT, 0.1)} !important` } }}>
            <ToggleButton value="daily">คิดรายวัน (ใส่วันที่)</ToggleButton>
            <ToggleButton value="lump">เหมางาน</ToggleButton>
          </ToggleButtonGroup>
          {rateMode === "daily" && (
            <Box sx={{ display: "grid", gap: 1.5, alignItems: "center", gridTemplateColumns: { xs: "1fr", sm: "220px 1fr" }, mb: 1.5 }}>
              <TextField size="small" label="ค่าแรงต่อวัน (ใช้กับทุกวัน)" type="number" value={dailyRate}
                onChange={(e) => applyDailyRate(e.target.value)} inputProps={{ min: 0, step: "any", ...numberField }}
                InputProps={{ endAdornment: <InputAdornment position="end">บาท</InputAdornment> }} />
              <Typography variant="caption" sx={{ color: TEXT_SUB }}>
                {jobs.length
                  ? "ระบบใส่วันที่ให้ครบทุกวันตามช่วงงานที่เลือกแล้ว — ลบวันที่ไม่ได้มา หรือแก้ค่าแรงเฉพาะวันได้"
                  : "เลือกงาน/ช่วงวันที่ด้านบน ระบบจะใส่วันที่ทำงานให้อัตโนมัติ · หรือกด “เพิ่มวัน” เอง"}
              </Typography>
            </Box>
          )}
          {rateMode === "daily" && dupDates.length > 0 && (
            <Alert severity="warning" sx={{ mb: 1, py: 0 }}>วันที่ซ้ำกัน: {dupDates.map((d) => thaiDate(d)).join(", ")}</Alert>
          )}
          <Stack spacing={rateMode === "daily" ? 0.75 : 1.25}>
            {rateMode === "daily" && items.map((row) => (
              <Box key={row.key} sx={{
                display: "grid", gap: 1, alignItems: "center", p: 1, bgcolor: "#fff", borderRadius: 2,
                border: `1px solid ${dupDates.includes(row.workDate) ? "#f59e0b" : BORDER_MAIN}`, borderLeft: `3px solid ${ACCENT}`,
                gridTemplateColumns: { xs: "1fr 1fr auto", md: "190px 1fr 140px 96px auto" },
              }}>
                <Box sx={{ gridColumn: { xs: "1 / 3", md: "auto" } }}>
                  <ThaiDatePicker label="วันที่ทำงาน *" value={row.workDate} onChange={(v) => setItem(row.key, { workDate: v || "", auto: false })}
                    error={touched && !row.workDate} />
                </Box>
                <Box sx={{ display: { xs: "flex", md: "none" }, justifyContent: "flex-end" }}>
                  <IconButton size="small" aria-label="ลบวันนี้" disabled={items.length === 1}
                    onClick={() => setItems((rows) => rows.filter((r) => r.key !== row.key))}><DeleteOutline fontSize="small" /></IconButton>
                </Box>
                <TextField size="small" label="งานที่ทำ" value={row.description} onChange={(e) => setItem(row.key, { description: e.target.value })}
                  inputProps={{ maxLength: 300 }} placeholder="ค่าแรง" error={touched && !String(row.description).trim()} />
                <TextField size="small" label="ค่าแรง/วัน" type="number" value={row.unitPrice} onChange={(e) => setItem(row.key, { unitPrice: e.target.value, qty: 1, unit: "วัน", auto: false })}
                  inputProps={{ min: 0, step: "any", ...numberField }}
                  InputProps={{ endAdornment: <InputAdornment position="end">฿</InputAdornment> }} />
                <Typography sx={{ display: { xs: "none", md: "block" }, fontWeight: 800, fontSize: "0.95rem", textAlign: "right" }}>{fmtMoney(itemAmount(row))}</Typography>
                <IconButton size="small" aria-label="ลบวันนี้" disabled={items.length === 1} sx={{ display: { xs: "none", md: "inline-flex" } }}
                  onClick={() => setItems((rows) => rows.filter((r) => r.key !== row.key))}><DeleteOutline fontSize="small" /></IconButton>
              </Box>
            ))}
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
              <Typography variant="caption" sx={{ color: TEXT_SUB, ml: "auto", fontWeight: 700 }}>รวม {dayCount} วัน · {baht(gross)}</Typography>
            )}
          </Stack>
        </Section>

        {/* ── ภาษีและรายการหัก ─────────────────────────────────────── */}
        <Section icon={<Payments sx={{ fontSize: 18, color: ACCENT }} />} title="ภาษีและรายการหัก"
          hint="หัก ณ ที่จ่ายคิดจากยอดก่อน VAT · หักมัดจำ/เบิกล่วงหน้าที่เคยจ่ายให้ผู้รับเหมาไปแล้ว">
          <Box sx={{ display: "grid", gap: 1.5, alignItems: "start", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" } }}>
            <TextField select size="small" label="ภาษีมูลค่าเพิ่ม (VAT)" value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))}
              helperText={vatRate ? "ผู้รับเหมาจด VAT — แนบใบกำกับภาษี" : "ผู้รับเหมาไม่ได้จด VAT"}>
              <MenuItem value={0}>ไม่มี VAT</MenuItem>
              <MenuItem value={7}>VAT 7%</MenuItem>
            </TextField>
            <TextField select size="small" label="หัก ณ ที่จ่าย" value={whtIsPreset ? Number(whtRate) : "custom"}
              onChange={(e) => setWhtRate(e.target.value === "custom" ? 1.5 : Number(e.target.value))}
              helperText={cIsCompany ? "นิติบุคคล — ยื่น ภ.ง.ด.53" : "บุคคลธรรมดา — ยื่น ภ.ง.ด.3"}>
              {WHT_PRESETS.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
              <MenuItem value="custom">อัตราอื่น…</MenuItem>
            </TextField>
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
              <TextField select size="small" label="ธนาคาร *" value={bankCode} onChange={(e) => setBankCode(e.target.value)}
                error={touched && !bankCode}
                SelectProps={{ renderValue: (v) => (v ? <Stack direction="row" spacing={1} alignItems="center"><BankLogo code={v} size={20} /><span>{bankMeta(v).name}</span></Stack> : "") }}>
                {BANKS.map((b) => (
                  <MenuItem key={b.code} value={b.code}>
                    <Stack direction="row" spacing={1} alignItems="center"><BankLogo code={b.code} size={22} /><span>{b.name}</span></Stack>
                  </MenuItem>
                ))}
              </TextField>
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
        <Section title="หมายเหตุและหลักฐาน" hint="แนบใบแจ้งหนี้/ใบกำกับภาษี รูปผลงานที่ส่งมอบ และสำเนาบัตร/หนังสือรับรอง (ครั้งแรก)">
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
          {editing && expense.attachments?.length > 0 && (
            <Typography variant="caption" sx={{ display: "block", color: TEXT_SUB, mt: 1 }}>
              มีไฟล์แนบเดิม {expense.attachments.length} ไฟล์ (จัดการได้ในหน้ารายละเอียด)
            </Typography>
          )}
        </Section>
      </DialogContent>

      <DialogActions sx={{ px: { xs: 1.5, sm: 2.5 }, py: 1.25, borderTop: `1px solid ${BORDER_MAIN}`, gap: 1 }}>
        {error ? (
          <Alert severity="error" sx={{ flex: 1, py: 0, "& .MuiAlert-message": { fontSize: "0.8rem" } }}>{error}</Alert>
        ) : (
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>ยอดจ่ายสุทธิ</Typography>
            <Typography sx={{ fontWeight: 900, color: META.dark, lineHeight: 1.1 }}>{baht(Math.max(calc.net, 0))}</Typography>
          </Box>
        )}
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: "none", color: TEXT_SUB, display: { xs: error ? "none" : "inline-flex", sm: "inline-flex" } }}>ยกเลิก</Button>
        <Button variant="contained" onClick={submit} disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : editing && !resubmit ? <Save sx={{ fontSize: 18 }} /> : <Send sx={{ fontSize: 17 }} />}
          sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, px: 2.5, boxShadow: "none", whiteSpace: "nowrap", bgcolor: ACCENT, "&:hover": { bgcolor: META.dark, boxShadow: "none" } }}>
          {saving ? "กำลังบันทึก..." : resubmit ? "ส่งใหม่" : editing ? "บันทึก" : "ส่งขออนุมัติ"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
