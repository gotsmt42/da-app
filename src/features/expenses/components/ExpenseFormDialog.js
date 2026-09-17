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
  IconButton, Alert, useMediaQuery, Autocomplete, MenuItem, Chip, Tooltip, CircularProgress, Avatar, Collapse,
  Menu, ListItemIcon, ListItemText, Checkbox, FormControlLabel, createFilterOptions,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Close, Add, DeleteOutline, AttachFile, Send, Save, Link as LinkIcon, ReceiptLong, Payments, ExpandMore,
  Print, EditNote, AccountBalanceWallet, Groups, PersonOutline, AccountBalance, HistoryEdu,
} from "@mui/icons-material";

import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import { ACCEPT_ALL, formatBytes, MAX_UPLOAD_MB } from "@/shared/utils/fileUpload";
import { thaiDate } from "@/shared/utils/thaiDate";
import { useAuth } from "@/features/auth/AuthContext";
import usePermissions from "@/shared/hooks/usePermissions";
import ExpenseService, { errorText } from "../services/ExpenseService";
import SignatureService from "@/shared/services/SignatureService";
import AdvancePanel from "./AdvancePanel";
import KindBadge from "./KindBadge";
import ExpensePrintDialog from "./ExpensePrintDialog";
import BankAccountPicker from "./BankAccountPicker";
import {
  KIND_META, EXPENSE_CATEGORIES, categoryMeta, FILE_KINDS, baht, fmtMoney, itemAmount, itemsTotal,
  differenceMeta, money, jobText, jobSubject, itemPersonName, personFullName, slipKind, TEXT_SUB, TEXT_MAIN, BORDER_MAIN,
} from "../expenseMeta";

const MAX_ITEMS = 40;
/** ค้นหาช่อง "ถึง" ได้ทั้งชื่อและตำแหน่ง */
const toFilter = createFilterOptions({ stringify: (o) => `${o.label} ${o.position || ""}` });
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
  const [job, setJob] = useState(null);
  const [jobOptions, setJobOptions] = useState([]);
  const [jobQuery, setJobQuery] = useState("");
  const [jobLoading, setJobLoading] = useState(false);
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
      setJob(expense.eventId ? { _id: expense.eventId, ...expense.job } : null);
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
      autoSubjectRef.current = presetJob ? jobSubject(presetJob, subjectPrefix) : "";
      setSubject(autoSubjectRef.current);
      setJob(presetJob ? { ...presetJob } : null);
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
  useEffect(() => {
    setJobAdvance(null);
    if (!checksJobAdvance || !job?._id) return undefined;
    let alive = true;
    setJobAdvanceChecking(true);
    ExpenseService.jobAdvance(job._id)
      .then((adv) => { if (alive) setJobAdvance(adv && adv._id !== expense?._id ? adv : null); })
      .catch(() => { if (alive) setJobAdvance(null); })
      .finally(() => { if (alive) setJobAdvanceChecking(false); });
    return () => { alive = false; };
  }, [checksJobAdvance, job?._id, expense?._id]);

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
  const teamNames = useMemo(() => [...new Set((job?.teamNames || []).map((n) => String(n || "").trim()).filter(Boolean))], [job]);

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
    problems.push(jobLocked
      ? `ตรวจสอบใบเดิม — งานนี้มีใบเบิก Advance แล้ว (${jobAdvance.docNo}) ออกซ้ำไม่ได้`
      : `เลือกงานอื่นหรือไม่ผูกงาน — งานนี้มีใบเบิก Advance แล้ว (${jobAdvance.docNo})`);
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
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{
          px: { xs: 2, sm: 2.5 }, py: 1.5, borderBottom: `1px solid ${alpha(accent, 0.25)}`,
          borderTop: `5px solid ${accent}`, bgcolor: meta.soft,
        }}>
          <Box sx={{
            width: 38, height: 38, borderRadius: 2.5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            bgcolor: accent, color: "#fff",
          }}>
            {isReimburseForm ? <AccountBalanceWallet sx={{ fontSize: 21 }} /> : isClaim ? <ReceiptLong sx={{ fontSize: 21 }} /> : <Payments sx={{ fontSize: 21 }} />}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
              <KindBadge kind={slip} />
              <Typography sx={{ fontWeight: 800, fontSize: "1.02rem", lineHeight: 1.3, color: meta.dark }} noWrap>
                {editing ? `แก้ไข ${expense.docNo || ""}` : `ออก${meta.label}ใหม่`}
              </Typography>
            </Stack>
            <Typography variant="caption" sx={{ color: TEXT_SUB }} noWrap component="div">
              {isReimburseForm
                ? "ค่าใช้จ่ายที่สำรองจ่ายไปก่อนแล้ว · แนบใบเสร็จให้ครบเพื่อขอเงินคืน"
                : isClaim ? "สรุปค่าใช้จ่ายจริงพร้อมหลักฐาน เพื่อเคลียร์เงินเบิกล่วงหน้า" : "ขอเบิกเงินล่วงหน้าเพื่อใช้ในงาน · หัวหน้าจะได้รับแจ้งทันที"}
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
              freeSolo
              options={toChoices}
              groupBy={(o) => o.group}
              value={to}
              inputValue={to}
              onInputChange={(_, v) => setTo(v)}
              onChange={(_, v) => setTo(typeof v === "string" ? v : v?.label || "")}
              getOptionLabel={(o) => (typeof o === "string" ? o : o?.label || "")}
              isOptionEqualToValue={(o, v) => o.label === (typeof v === "string" ? v : v?.label)}
              // ✅ ค้นด้วยตำแหน่งได้ด้วย — พิมพ์ "กรรมการ" ก็เจอกรรมการผู้จัดการ ไม่ต้องจำชื่อ
              filterOptions={toFilter}
              renderOption={({ key, ...liProps }, o) => (
                <li {...liProps} key={`${o.group}-${o.label}`}>
                  <Avatar src={o.imageUrl?.startsWith("http") ? o.imageUrl : undefined}
                    sx={{ width: 28, height: 28, mr: 1.25, fontSize: 13, bgcolor: o.position ? alpha(accent, 0.18) : "#e2e8f0", color: o.position ? accent : TEXT_SUB }}>
                    {(o.label || "?").charAt(0)}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.88rem", fontWeight: 700 }} noWrap>{o.label}</Typography>
                    <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }} noWrap>
                      {o.position || "ไม่มีในระบบ · ชื่อที่เคยใช้ในใบก่อนหน้า"}
                    </Typography>
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField {...params} size="small" label="ถึง (ผู้มีอำนาจอนุมัติ)" placeholder="เลือกจากรายชื่อ หรือพิมพ์ชื่อ"
                  helperText={toPerson ? `ตำแหน่ง: ${toPerson.position}` : String(to || "").trim() ? "ชื่อนอกระบบ (พิมพ์เอง)" : "เลือกผู้มีอำนาจอนุมัติจากรายชื่อในระบบได้"} />
              )}
            />
            {canPickPerson ? (
              <Autocomplete
                options={people}
                value={people.find((p) => p.userId === requester?.userId) || (requester?.userId ? requester : null)}
                onChange={(_, v) => {
                  if (!v) return;
                  setRequester(v);
                  setPosition(v.position || "");
                  // ⚠️ เปลี่ยนผู้เบิก = บัญชีของคนเดิมใช้ไม่ได้แล้ว ล้างแล้วให้เลือกบัญชีหลักของคนใหม่ให้
                  setPayToAccountId(undefined);
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
            {!isClearClaim && (
              <Autocomplete
                sx={{ gridColumn: { sm: "1 / -1" } }}
                options={job && !jobOptions.some((j) => j._id === job._id) ? [job, ...jobOptions] : jobOptions}
                value={job}
                loading={jobLoading}
                filterOptions={(x) => x}
                onChange={(_, v) => {
                  setJob(v);
                  // ✅ เติมเรื่องจากงานให้ — เฉพาะตอนช่องเรื่องยังว่างหรือยังเป็นค่าที่ระบบเติมไว้ (ไม่ทับที่ผู้ใช้พิมพ์เอง)
                  const next = v ? jobSubject(v, subjectPrefix) : "";
                  setSubject((cur) => (!String(cur).trim() || cur === autoSubjectRef.current ? next : cur));
                  autoSubjectRef.current = next;
                }}
                // ✅ เปิดมาจากเมนู "เบิก Advance งานนี้" ในตารางงาน — ล็อกงานไว้ กันเผลอเปลี่ยนเป็นงานอื่น
                disabled={Boolean(presetJob) && !editing}
                onInputChange={(_, v, reason) => { if (reason === "input") setJobQuery(v); if (reason === "clear") setJobQuery(""); }}
                isOptionEqualToValue={(o, v) => o._id === v._id}
                getOptionLabel={(o) => (o ? jobText(o) || o.title || "" : "")}
                // 🔒 ใบ Advance: งานที่มีใบแล้วเลือกไม่ได้ (ยกเว้นงานของใบที่กำลังแก้อยู่เอง)
                getOptionDisabled={(o) => kind === "advance" && Boolean(o.advance) && o.advance._id !== expense?._id}
                noOptionsText="ไม่พบงาน"
                renderOption={({ key, ...liProps }, o) => {
                  const taken = kind === "advance" && o.advance && o.advance._id !== expense?._id;
                  return (
                    <li {...liProps} key={o._id}>
                      {/* ✅ รายละเอียดงานครบแบบเดียวกับตอนเปิดจากหน้า Event (ผู้ใช้ขอ) — "PM Fire Alarm โครงการ ... ครั้งที่ ..."
                          🐛 เดิมบรรทัดหลักมีแค่ "PM · Fire Alarm" ทุกงานหน้าตาเหมือนกันหมด ต้องอ่านบรรทัดเล็กถึงจะแยกออก
                          และไม่มี "ครั้งที่" งาน PM ของโครงการเดียวกันหลายครั้งจึงแยกกันไม่ได้เลย
                          ⚠️ ไม่ตัดคำ (noWrap) บรรทัดหลัก — ชื่อโครงการยาวต้องอ่านได้ครบ ไม่ใช่ถูกตัดเป็น "..." */}
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, lineHeight: 1.35 }}>{jobText(o) || o.title}</Typography>
                        <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", lineHeight: 1.35 }} component="div">
                          {[
                            // ⚠️ แสดงแค่วันเริ่ม — end ของงานทั้งวันในปฏิทินเป็นแบบ "ไม่รวมวันสุดท้าย" (+1 วัน) ถ้าเอามาโชว์ตรงๆ จะเกินจริง 1 วัน
                            o.start ? `วันที่ ${thaiDate(o.start)}` : "",
                            o.company && o.site && o.company !== o.site ? `บริษัท ${o.company}` : "",
                            o.teamNames?.length ? `ทีม ${o.teamNames.join(", ")}` : "",
                            o.docNo ? `เลขที่ ${o.docNo}` : "",
                            o.status || "",
                          ].filter(Boolean).join(" · ")}
                        </Typography>
                      </Box>
                      {taken && (
                        <Chip size="small" label={`มีใบแล้ว ${o.advance.docNo}`}
                          sx={{ ml: 1, flexShrink: 0, height: 20, fontSize: "0.68rem", fontWeight: 700, bgcolor: alpha(KIND_META.advance.color, 0.12), color: KIND_META.advance.dark }} />
                      )}
                    </li>
                  );
                }}
                renderInput={(params) => (
                  <TextField {...params} size="small"
                    label={presetJob && !editing ? "งานที่เบิก" : "ผูกกับงาน (ไม่บังคับ)"} placeholder="ค้นหาชื่องาน / โครงการ / เลขที่"
                    error={Boolean(jobAdvance)}
                    helperText={presetJob && !editing
                      ? "เปิดจากตารางงาน — ผูกกับงานนี้แล้ว"
                      : kind === "advance" ? "1 งานออกใบ Advance ได้ใบเดียว · ผูกงานแล้วดูงบที่ใช้ได้ในหน้ารายงาน" : "ผูกงานแล้วจะดูได้ว่างานนี้ใช้งบไปเท่าไรในหน้ารายงาน"}
                    InputProps={{ ...params.InputProps, endAdornment: (<>{jobLoading || jobAdvanceChecking ? <CircularProgress size={16} /> : null}{params.InputProps.endAdornment}</>) }} />
                )}
              />
            )}
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
                  <Box sx={{
                    mt: 1, display: "grid", gap: 1, alignItems: "center",
                    gridTemplateColumns: { xs: "1fr auto auto", sm: "210px 1fr auto auto" },
                  }}>
                    {/* ✅ พนักงานของรายการนี้ (ไม่บังคับ) — หัวหน้างานเบิกแทนลูกทีมได้ในใบเดียว แยกบรรทัดละคน
                        พิมพ์ชื่อคนนอกระบบได้ (น.ศ. ฝึกงาน/แรงงานรายวัน) · เลือกจากรายชื่อ = ผูกกับทะเบียนพนักงาน */}
                    <Autocomplete
                      freeSolo size="small" options={people}
                      value={row.person?.name ? (people.find((p) => p.userId && p.userId === row.person.userId) || itemPersonName(row)) : null}
                      getOptionLabel={(o) => (typeof o === "string" ? o : o?.fullName || o?.name || "")}
                      isOptionEqualToValue={(o, v) => (typeof v === "string" ? o.fullName === v || o.name === v : o.userId === v.userId)}
                      onChange={(_, v) => {
                        if (!v) setItem(row.key, { person: null });
                        else if (typeof v === "string") setItem(row.key, { person: { userId: "", name: v.trim().slice(0, 80) } });
                        else setItem(row.key, { person: { userId: v.userId, name: v.fullName || v.name } });
                      }}
                      onInputChange={(_, v, reason) => {
                        if (reason !== "input") return;
                        const name = v.slice(0, 80);
                        const match = people.find((p) => p.fullName === name.trim() || p.name === name.trim());
                        setItem(row.key, { person: name.trim() ? { userId: match?.userId || "", name } : null });
                      }}
                      renderOption={({ key, ...liProps }, o) => (
                        <li {...liProps} key={o.userId}>
                          <Avatar src={o.imageUrl?.startsWith("http") ? o.imageUrl : undefined} sx={{ width: 22, height: 22, mr: 1, fontSize: 11 }}>
                            {(o.name || "?").charAt(0)}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontSize: "0.84rem", fontWeight: 700 }} noWrap>{o.fullName || o.name}</Typography>
                            {o.position && <Typography variant="caption" sx={{ color: TEXT_SUB }} noWrap component="div">{o.position}</Typography>}
                          </Box>
                        </li>
                      )}
                      sx={{ gridColumn: { xs: "1 / -1", sm: "auto" } }}
                      renderInput={(params) => (
                        <TextField {...params} variant="standard" placeholder="พนักงาน (ไม่บังคับ)"
                          InputProps={{ ...params.InputProps, startAdornment: <PersonOutline sx={{ fontSize: 17, color: row.person?.name ? accent : TEXT_SUB, mr: 0.5 }} /> }}
                          sx={{ "& input": { fontSize: "0.82rem" } }} />
                      )}
                    />
                    <TextField
                      size="small" variant="standard" placeholder="รายละเอียดเพิ่มเติม เช่น ช่วงวันที่ / ทะเบียนรถ (ไม่บังคับ)"
                      value={row.detail} onChange={(e) => setItem(row.key, { detail: e.target.value })}
                      sx={{ minWidth: 0, "& input": { fontSize: "0.82rem" } }} inputProps={{ maxLength: 300 }}
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
                        <IconButton size="small" aria-label="ลบรายการ" onClick={() => removeItem(row.key)} disabled={!isClearClaim && items.length === 1}>
                          <DeleteOutline fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </Box>
              );
            })}
          </Stack>
          <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75} sx={{ mt: 1.25 }}>
            <Button size="small" variant="outlined" startIcon={<Add />} onClick={() => addItem("other")} disabled={items.length >= MAX_ITEMS}
              sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, borderColor: alpha(accent, 0.5), color: accent }}>
              เพิ่มรายการ
            </Button>
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
        <Section accent={accent} title="หมายเหตุและหลักฐาน" hint={isClaim ? "แนบรูปใบเสร็จ/บิลให้ครบ ผู้อนุมัติจะตรวจจากไฟล์เหล่านี้" : "แนบใบเสนอราคา/รูปประกอบได้ (ไม่บังคับ)"}>
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
                  <TextField select size="small" value={f.kind} onChange={(e) => setFiles((cur) => cur.map((x) => (x.key === f.key ? { ...x, kind: e.target.value } : x)))}
                    sx={{ width: 130, "& .MuiInputBase-input": { py: 0.6, fontSize: "0.8rem" } }}>
                    {FILE_KINDS.map((k) => <MenuItem key={k.value} value={k.value}>{k.label}</MenuItem>)}
                  </TextField>
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
