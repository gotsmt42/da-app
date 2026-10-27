/**
 * OtFormDialog — ยื่น/แก้ไข ใบขออนุมัติ OT
 *
 * 🔁 (27 ต.ค. 2569 ผู้ใช้: "เอาระบบโอทีกลับมา ไม่ต้องระบุเงิน แค่กรอกชั่วโมง อิงงาน ให้สมบูรณ์"
 *    · "ให้เป็นรายการที่จะเบิก OT 1, 2, 3, 4, 5 ไปเลย"
 *    · "ระบบนี้ทำเพื่อให้พนักงานกรอกทำโอทีเองเป็นหลัก แค่ให้แอดมินตรวจสอบ และอนุมัติก่อน")
 *    พนักงานยื่นของตัวเองเท่านั้น (ไม่ต้องเลือกคน) · ฟอร์มเป็นรายการที่ 1, 2, 3 …
 *    แต่ละรายการ = วันที่ · เวลาเริ่ม-เลิก · ประเภท OT · งานที่อิง (บังคับ) · รายละเอียด
 *    เวลาเริ่มตั้งต้น 17:30 (เวลาเลิกงาน) · ประเภทเดาจากวันที่/เวลาให้ แก้เองได้ · ไม่มีเรื่องเงินในฟอร์ม
 *    แก้ใบเดิม (เช่นถูกตีกลับ) — ผู้ทำ OT คงตามใบเดิม
 */
import { useEffect, useMemo, useState } from "react";
import moment from "moment";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography, TextField, IconButton, Alert,
  useMediaQuery, Autocomplete, MenuItem, Tooltip, CircularProgress, Avatar, ButtonBase,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Close, DeleteOutline, Send, Save, AccessTime, ContentCopy, Add } from "@mui/icons-material";

import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import { thaiDate } from "@/shared/utils/thaiDate";
import { useAuth } from "@/features/auth/AuthContext";
import ExpenseService from "@/features/expenses/services/ExpenseService";
import { jobText, jobRangeText } from "@/features/expenses/expenseMeta";
import { JobOptionRow } from "@/shared/ui/JobTypeChip";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import OtService, { errorText } from "../services/OtService";
import {
  OT_ACCENT, OT_DARK, TEXT_MAIN, TEXT_SUB, BORDER_MAIN, OT_TYPES, typeMeta, lineHours, hoursText, guessType, timeForType, crossesMidnight,
} from "../otMeta";
import useFormDraft, { DraftBanner } from "@/shared/hooks/useFormDraft";
import OtDayInfo, { useHolidays } from "./OtDayInfo";
import { EvidencePicker } from "./OtEvidence";

let seq = 0;
const key = () => `i${Date.now()}_${(seq += 1)}`;
const today = () => moment().format("YYYY-MM-DD");
/**
 * 🔁 (27 ต.ค. 2569 ผู้ใช้: "ตัดพักออก และเวลางาน 8.30 - 17.30")
 *   ไม่มีช่องพักแล้ว (ส่ง breakMin = 0 เสมอ)
 * 🔁 (27 ต.ค. 2569 ผู้ใช้: "คำนวณอัตโนมัติ — เสาร์ อาทิตย์ = ทำงานวันหยุด 8.30-17.30 · จ-ศ = OT วันทำงานเริ่ม 17.30
 *    · OT วันหยุดเริ่ม 17.30") ประเภทเดาจากวันที่ → เวลาตั้งต้นตามประเภท (TYPE_TIME ใน otMeta)
 *   เปลี่ยนวัน/ประเภทแล้วเวลาเปลี่ยนตาม — เว้นแต่ผู้ใช้แก้เวลาเองแล้ว (timeTouched)
 */
const defaultTime = (date, cfg) => timeForType(guessType(date, "08:30", cfg));

/** รายการใหม่ — ต่อจากรายการก่อนหน้า (วัน/เวลา/งานเดิม) ให้กรอกเร็ว */
const blankItem = (cfg, from) => {
  const date = from?.date || today();
  // เวลาที่แก้เองแล้ว → ใช้ต่อ · ประเภทที่เลือกเอง → เวลาตามประเภทนั้น · ไม่งั้นตามวัน
  const t = from?.timeTouched ? from : from?.typeTouched ? timeForType(from.type) : defaultTime(date, cfg);
  return {
    key: key(), date, start: t.start, end: t.end, breakMin: 0, timeTouched: Boolean(from?.timeTouched),
    type: from?.typeTouched ? from.type : guessType(date, t.start, cfg), typeTouched: Boolean(from?.typeTouched),
    job: from?.job || null, task: "",
  };
};

/**
 * วันของงาน (ช่วงงานหลายวัน → รายวัน) — ✅ (27 ต.ค. 2569 ผู้ใช้: "ให้เลือกงานได้เป็นวัน ไม่ใช่ผูกงานรวม เพราะเบิกโอทีบางวัน")
 * ⚠️ end ของงานทั้งวันเป็นแบบ "ไม่รวมวันสุดท้าย" (เที่ยงคืนของวันถัดไป) → ถอยกลับ 1 วัน
 */
const daysOfJob = (job) => {
  if (!job?.start) return [];
  // นับจำนวนวันแบบเดียวกับ jobRangeText (expenseMeta) — เวลาที่เก็บไม่ใช่เที่ยงคืนเสมอ จึงนับเป็นวันเต็มแล้วปัดเศษ
  const start = new Date(job.start);
  const rawEnd = job.end ? new Date(job.end) : null;
  const n = rawEnd && rawEnd > start ? Math.max(1, Math.round((rawEnd - start) / 86400000)) : 1;
  return Array.from({ length: Math.min(n, 62) }, (_, i) => moment(start).add(i, "day").format("YYYY-MM-DD"));
};
/**
 * "รายการ OT รอส่ง" (ตะกร้า) — ✅ (27 ต.ค. 2569 ผู้ใช้: "กดขอโอทีต้องเพิ่มเข้ารายการก่อน เพราะจะลงหลายวัน ไม่ใช่บันทึกใบนั้นเลย")
 *   กด "ขอ OT งานนี้" จากหน้างาน = เพิ่มวันนั้นเข้ารายการ (เก็บในเครื่อง) · ปิดได้ แล้วไปเพิ่มวัน/งานอื่นต่อ
 *   เปิดฟอร์มใบใหม่ครั้งถัดไป (จากหน้างานหรือเมนู OT) รายการเดิมยังอยู่ · ส่งใบสำเร็จแล้วล้างรายการ
 *   ⚠️ เก็บแยกต่อผู้ใช้ · เก็บเฉพาะข้อมูลงานที่ฟอร์มใช้ ไม่เก็บไฟล์แนบ
 */
const basketKey = (uid) => `ot:basket:${uid || "me"}`;
const slimJob = (j) => (j ? (({ _id, title, system, company, site, docNo, start, end, round, visitCount, time, backgroundColor, __label }) =>
  ({ _id, title, system, company, site, docNo, start, end, round, visitCount, time, backgroundColor, __label }))(j) : null);
export const loadOtBasket = (uid) => {
  try { const v = JSON.parse(localStorage.getItem(basketKey(uid)) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
};
const saveOtBasket = (uid, list) => {
  try {
    if (list.length) localStorage.setItem(basketKey(uid), JSON.stringify(list.map((it) => ({ ...it, job: slimJob(it.job) }))));
    else localStorage.removeItem(basketKey(uid));
  } catch { /* เครื่องไม่ให้เก็บ — ฟอร์มยังใช้ได้ แค่ไม่จำรายการ */ }
};

const DAY_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

const TimeField = ({ label, value, onChange, error }) => (
  <TextField size="small" type="time" label={label} value={value} onChange={(e) => onChange(e.target.value)}
    InputLabelProps={{ shrink: true }} inputProps={{ step: 300 }} error={error} fullWidth />
);

/**
 * @param {object} [presetJob] ✅ (27 ต.ค. 2569 ผู้ใช้: "ให้มีเมนูกดลงโอทีในหน้า editEvent ได้เลย")
 *   เปิดจากหน้างาน — รายการแรกผูกงานนี้ให้ · วันที่ = วันนี้ถ้าอยู่ในช่วงงาน ไม่งั้นวันแรกของงาน
 */
export default function OtFormDialog({ open, request, presetJob = null, onClose, onSaved }) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const { userData } = useAuth();
  const editing = Boolean(request?._id);

  const [cfg, setCfg] = useState(null);
  const [jobOptions, setJobOptions] = useState([]);
  const [jobQuery, setJobQuery] = useState("");
  const [jobLoading, setJobLoading] = useState(false);
  const [owners, setOwners] = useState([]); // ผู้ทำ OT — ใบใหม่ = ตัวเอง · แก้ใบเดิม = ตามใบ
  const [items, setItems] = useState([]);
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState([]); // หลักฐาน (ไม่บังคับ) — อัปโหลดหลังบันทึกใบ
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const uid = String(userData?.userId || "");
  // โหมดรายการรอส่ง: เปิดจากหน้างาน หรือมีรายการค้างอยู่ — ไม่ใช้ร่างอัตโนมัติ (รายการรอส่งคือร่างอยู่แล้ว)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ตัดสินครั้งเดียวตอนเปิดกล่อง
  const basketMode = useMemo(() => Boolean(open) && !editing && (Boolean(presetJob) || loadOtBasket(uid).length > 0), [open, presetJob]);
  const draft = useFormDraft({
    key: editing ? `ot:edit:${request._id}` : "ot:new:v3",
    enabled: Boolean(open) && !basketMode,
    data: { items, note },
    restore: (d) => {
      if (Array.isArray(d.items) && d.items.length) setItems(d.items);
      setNote(d.note || "");
    },
  });

  const me = useMemo(() => {
    const name = [userData?.fname, userData?.lname].filter(Boolean).join(" ") || userData?.username || "ฉัน";
    return { userId: String(userData?.userId || ""), name };
  }, [userData]);

  useEffect(() => {
    if (!open) return undefined;
    setError(""); setSaving(false); setTouched(false);
    let alive = true;
    OtService.config().then((c) => alive && setCfg(c)).catch(() => {});
    if (editing) {
      // แถวของคนเดียวกันที่วัน/เวลา/งานเดียวกัน → รายการเดียว
      const map = new Map();
      const persons = new Map();
      (request.lines || []).forEach((l) => {
        persons.set(l.person.userId, { userId: l.person.userId, name: l.person.name });
        const d = moment(l.date).format("YYYY-MM-DD");
        const k = [d, l.start, l.end, l.breakMin || 0, l.type, l.task || "", l.eventId || ""].join("|");
        if (!map.has(k)) {
          map.set(k, {
            key: key(), date: d, start: l.start, end: l.end, breakMin: 0, timeTouched: true, type: l.type, typeTouched: true,
            job: l.eventId ? { _id: l.eventId, title: "", __label: l.jobTitle } : null, task: l.task || "",
          });
        }
      });
      setOwners([...persons.values()]);
      setItems([...map.values()]);
      setNote(request.note || "");
    } else {
      setOwners([]);
      const basket = loadOtBasket(uid);
      if (presetJob) {
        const days = daysOfJob(presetJob);
        const today = moment().format("YYYY-MM-DD");
        // ลำดับ: วันที่ของช่องที่กดในปฏิทิน → วันนี้ (ถ้าอยู่ในช่วงงาน) → วันแรกของงาน · ยังกดเลือกวันอื่นของงานได้
        const prefer = presetJob.preferDate;
        const date = prefer && (!days.length || days.includes(prefer)) ? prefer : !days.length || days.includes(today) ? today : days[0];
        const it = { ...blankItem(null, { date }), ...defaultTime(date, null), job: { ...presetJob, __label: "" } };
        // งานเดียวกันวันเดียวกันมีในรายการแล้ว = ไม่เพิ่มซ้ำ
        const dup = basket.some((b) => b.job?._id === presetJob._id && b.date === date);
        setItems(dup ? basket : [...basket, it]);
      } else if (basket.length) {
        setItems(basket);
      } else {
        setItems([blankItem(null)]);
      }
      setNote("");
      setEvidence([]);
    }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- รีเซ็ตเฉพาะตอนเปิดกล่อง/เปลี่ยนใบ
  }, [open, request?._id]);

  useEffect(() => {
    if (!open) return undefined;
    setJobLoading(true);
    const t = setTimeout(() => {
      ExpenseService.jobs(jobQuery).then(setJobOptions).catch(() => setJobOptions([])).finally(() => setJobLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [open, jobQuery]);

  // งานที่มี "ในวันนั้น" ของทุกวันที่ในฟอร์ม (ดึงครั้งเดียวต่อวัน)
  const [dayJobs, setDayJobs] = useState({});
  const dates = [...new Set(items.map((it) => it.date).filter(Boolean))].join(",");
  useEffect(() => {
    if (!open) return;
    dates.split(",").filter((d) => d && !(d in dayJobs)).forEach((d) => {
      setDayJobs((cur) => ({ ...cur, [d]: null }));
      ExpenseService.jobs("", d).then((list) => setDayJobs((cur) => ({ ...cur, [d]: list }))).catch(() => setDayJobs((cur) => ({ ...cur, [d]: [] })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ดึงเฉพาะวันที่ยังไม่มีในแคช
  }, [open, dates]);

  // โหมดรายการรอส่ง → บันทึกรายการลงเครื่องทุกครั้งที่แก้ (ปิดกล่องแล้วยังอยู่)
  useEffect(() => {
    if (open && basketMode && items.length) saveOtBasket(uid, items);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- บันทึกตามรายการ
  }, [items, basketMode, open]);
  const clearBasket = () => { saveOtBasket(uid, []); setItems([blankItem(cfg)]); };

  const holidays = useHolidays(cfg);
  const who = owners.length ? owners : [me];
  const jobLabel = (j) => (j ? (j.__label || jobText(j) || j.title || "") : "");

  const setItem = (k, patch) => setItems((cur) => cur.map((it) => {
    if (it.key !== k) return it;
    const next = { ...it, ...patch };
    if ("start" in patch || "end" in patch) next.timeTouched = true;
    if ("date" in patch && !next.timeTouched) {
      // เปลี่ยนวัน (ยังไม่เคยแก้เวลาเอง) → ประเภทตามวัน แล้วเวลาตามประเภท
      if (!next.typeTouched) next.type = guessType(next.date, "08:30", cfg);
      Object.assign(next, timeForType(next.type));
    } else if ("type" in patch && !next.timeTouched) {
      // เลือกประเภทเอง → เวลาตั้งต้นของประเภทนั้น (ทำงานวันหยุด 08:30 · OT วันทำงาน/วันหยุด 17:30)
      Object.assign(next, timeForType(next.type));
    } else if (!next.typeTouched && ("date" in patch || "start" in patch)) {
      // แก้เวลาเริ่มเอง → เดาประเภทใหม่ (วันหยุด: ก่อน 17:30 = ทำงานวันหยุด · ตั้งแต่ 17:30 = OT วันหยุด)
      next.type = guessType(next.date, next.start, cfg);
    }
    return next;
  }));
  const pickJob = (it, job) => {
    const days = daysOfJob(job);
    setItem(it.key, days.length && !days.includes(it.date) ? { job, date: days[0] } : { job });
  };
  const addItem = () => setItems((cur) => [...cur, blankItem(cfg, cur[cur.length - 1])]);
  const copyNextDay = (it) => setItems((cur) => {
    const d = moment(it.date).add(1, "day").format("YYYY-MM-DD");
    const i = cur.findIndex((x) => x.key === it.key);
    const t = it.timeTouched ? it : defaultTime(d, cfg);
    const copy = { ...it, key: key(), date: d, start: t.start, end: t.end, type: it.typeTouched ? it.type : guessType(d, t.start, cfg) };
    return [...cur.slice(0, i + 1), copy, ...cur.slice(i + 1)];
  });

  const totalHours = useMemo(() => items.reduce((s, it) => s + (lineHours(it.start, it.end, it.breakMin) || 0), 0), [items]);

  const problems = [];
  if (!items.length) problems.push("เพิ่มรายการ OT อย่างน้อย 1 รายการ");
  if (items.some((it) => !it.job)) problems.push("เลือกงานที่ทำ OT ให้ครบทุกรายการ");
  if (items.some((it) => lineHours(it.start, it.end, it.breakMin) === null)) problems.push("ตรวจสอบเวลาเริ่ม-เลิกให้ครบทุกรายการ");

  const submit = async () => {
    setTouched(true);
    if (problems.length) { setError(`กรุณา${problems.join(" · ")}`); return; }
    setSaving(true); setError("");
    const sorted = [...items].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    const payload = {
      subject: editing ? request.subject || "" : "", note: note.trim(),
      lines: sorted.flatMap((it) => who.map((p) => ({
        person: { userId: p.userId, name: p.name }, date: it.date, type: it.type, start: it.start, end: it.end,
        breakMin: 0, task: it.task, eventId: it.job?._id || "",
      }))),
    };
    try {
      let saved = editing ? await OtService.update(request._id, payload) : await OtService.create(payload);
      draft.clear(); // บันทึกสำเร็จ → ล้างข้อมูลที่กรอกค้าง
      if (!editing) saveOtBasket(uid, []); // ส่งแล้ว → ล้างรายการรอส่ง
      // หลักฐาน (ไม่บังคับ) — อัปไม่สำเร็จไม่ทำให้ใบหาย แนบเพิ่มได้ภายหลังในหน้ารายละเอียด
      let fileWarn = "";
      if (evidence.length) {
        try { saved = await OtService.addFiles(saved._id, evidence.map((f) => f.file)); } catch (e) { fileWarn = `บันทึกใบแล้ว แต่แนบหลักฐานไม่สำเร็จ (${errorText(e)}) — แนบเพิ่มได้ในหน้ารายละเอียด`; }
      }
      onSaved?.(saved, { created: !editing, fileWarn });
    } catch (err) {
      setError(errorText(err, "บันทึกไม่สำเร็จ"));
    } finally {
      setSaving(false);
    }
  };

  const resubmit = editing && request.status === "rejected";

  return (
    <Dialog open={open} onClose={(_, r) => { if (saving || r === "backdropClick") return; onClose?.({ kept: basketMode, count: items.length }); }}
      fullWidth maxWidth="md" fullScreen={isMobile} PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3, bgcolor: "#f8fafc" } }}>
      <DialogTitle sx={{ p: 0, bgcolor: "#fff" }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: { xs: 2, sm: 2.5 }, py: 1.5, borderBottom: `1px solid ${BORDER_MAIN}` }}>
          <Box sx={{ width: 38, height: 38, borderRadius: 2.5, bgcolor: OT_ACCENT, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <AccessTime sx={{ fontSize: 21 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 900, fontSize: "1.02rem", color: TEXT_MAIN }} noWrap>
              {editing ? `แก้ไข ${request.docNo}` : "ยื่นขออนุมัติ OT"}
            </Typography>
            <Typography variant="caption" sx={{ color: TEXT_SUB }} noWrap component="div">
              กรอกรายการ OT ของคุณ → แอดมินตรวจสอบ → อนุมัติ
            </Typography>
          </Box>
          <IconButton onClick={() => onClose?.({ kept: basketMode, count: items.length })} disabled={saving}><Close /></IconButton>
        </Stack>
        {/* ผู้ทำ OT (ตัวเอง) — แสดงเพื่อยืนยัน ไม่ต้องเลือก */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ px: { xs: 2, sm: 2.5 }, py: 1, borderBottom: `1px solid ${BORDER_MAIN}`, bgcolor: "#fff" }}>
          {who.map((p) => (
            <Stack key={p.userId} direction="row" alignItems="center" spacing={0.75}>
              <Avatar sx={{ width: 24, height: 24, fontSize: "0.72rem", fontWeight: 800, bgcolor: personColor(p.name) }}>{personInitial(p.name)}</Avatar>
              <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: TEXT_MAIN }}>{p.name}</Typography>
            </Stack>
          ))}
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: "0.78rem", color: TEXT_SUB, whiteSpace: "nowrap" }}>
            {items.length} รายการ · <b style={{ color: TEXT_MAIN }}>{hoursText(totalHours)}</b>
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ px: { xs: 1.25, sm: 2.5 }, pt: "14px !important", pb: 1 }}>
        <DraftBanner draft={draft} />
        {basketMode && (
          <Alert severity="info" icon={false} sx={{ mb: 1.5, borderRadius: 2.5, bgcolor: "#ecfeff", color: OT_DARK, border: "1px solid #a5f3fc", "& .MuiAlert-message": { width: "100%" } }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <Box sx={{ flex: 1, fontSize: "0.84rem" }}>
                <b>รายการ OT รอส่ง {items.length} รายการ</b> — กด “เก็บไว้ก่อน” แล้วไปกด “ขอ OT งานนี้” ที่งาน/วันอื่นเพิ่มได้ ครบแล้วค่อยส่งทีเดียว
              </Box>
              <Button size="small" onClick={clearBasket} sx={{ textTransform: "none", fontWeight: 700, color: TEXT_SUB, flexShrink: 0 }}>ล้างรายการ</Button>
            </Stack>
          </Alert>
        )}
        {resubmit && request.rejectReason && (
          <Alert severity="warning" sx={{ mb: 1.5, borderRadius: 2 }}><b>ถูกตีกลับ:</b> {request.rejectReason} — แก้แล้วกด “ส่งใหม่”</Alert>
        )}

        {/* ── รายการ OT 1, 2, 3 … ── */}
        <Stack spacing={1.25}>
          {items.map((it, i) => {
            const h = lineHours(it.start, it.end, it.breakMin);
            const tm = typeMeta(it.type);
            const bad = h === null || (touched && !it.job);
            // ✅ กลุ่ม "งานในวันที่เลือก" ขึ้นก่อน (กรองตามคำค้นในเครื่อง) · ตามด้วยงานอื่นจากการค้นหา
            const needle = jobQuery.trim().toLowerCase();
            const onDay = (dayJobs[it.date] || []).filter((j) => !needle || jobLabel(j).toLowerCase().includes(needle) || String(j.docNo || "").toLowerCase().includes(needle));
            const dayIds = new Set(onDay.map((j) => j._id));
            const others = jobOptions.filter((j) => !dayIds.has(j._id));
            let opts = [...onDay.map((j) => ({ ...j, __grp: "day" })), ...others.map((j) => ({ ...j, __grp: "other" }))];
            if (it.job && !opts.some((j) => j._id === it.job._id)) opts = [{ ...it.job, __grp: "other" }, ...opts];
            const jobDays = daysOfJob(it.job);
            const outOfRange = jobDays.length > 0 && !jobDays.includes(it.date);
            return (
              <Box key={it.key} sx={{ bgcolor: "#fff", border: `1px solid ${bad ? "#fca5a5" : BORDER_MAIN}`, borderRadius: 3, boxShadow: "0 1px 2px rgba(15,23,42,.04)", overflow: "hidden" }}>
                {/* หัวรายการ: เลขที่ · ประเภท · ชั่วโมง · คัดลอก/ลบ */}
                <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 1.5, py: 1, borderBottom: `1px solid ${BORDER_MAIN}` }}>
                  <Box sx={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", bgcolor: OT_ACCENT, color: "#fff", fontWeight: 900, fontSize: "0.86rem" }}>{i + 1}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: "0.9rem", color: TEXT_MAIN, lineHeight: 1.3 }} noWrap>รายการที่ {i + 1}</Typography>
                    <Typography noWrap sx={{ fontSize: "0.74rem", fontWeight: 700, color: tm.color }}>
                      {tm.label}{cfg?.multipliers?.[it.type] ? ` ×${cfg.multipliers[it.type]}` : ""}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                    <Typography sx={{ fontWeight: 900, fontSize: "1rem", color: h === null ? "#dc2626" : TEXT_MAIN, lineHeight: 1.2 }}>{h === null ? "เวลาไม่ถูก" : hoursText(h)}</Typography>
                  </Box>
                  <Tooltip title="คัดลอกไปวันถัดไป"><IconButton size="small" onClick={() => copyNextDay(it)}><ContentCopy sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                  <Tooltip title={items.length === 1 ? "ต้องมีอย่างน้อย 1 รายการ" : "ลบรายการนี้"}>
                    <span><IconButton size="small" disabled={items.length === 1} onClick={() => setItems((cur) => cur.filter((x) => x.key !== it.key))}><DeleteOutline sx={{ fontSize: 19 }} /></IconButton></span>
                  </Tooltip>
                </Stack>

                <Box sx={{ p: 1.5, display: "grid", gap: 1.25, alignItems: "start", gridTemplateColumns: { xs: "repeat(6, 1fr)", md: "repeat(12, 1fr)" } }}>
                  {/* 🔁 (27 ต.ค. 2569) วันที่มาก่อน → งานที่มีในวันนั้นขึ้นเป็นกลุ่มแรกของช่องเลือกงาน */}
                  <Box sx={{ gridColumn: { xs: "1 / -1", md: "span 4" } }}>
                    <ThaiDatePicker label="วันที่ทำ OT" value={it.date} onChange={(v) => setItem(it.key, { date: v || it.date })} />
                  </Box>
                  <Box sx={{ gridColumn: { xs: "span 3", md: "span 2" } }}><TimeField label="เริ่ม" value={it.start} onChange={(v) => setItem(it.key, { start: v })} error={h === null} /></Box>
                  <Box sx={{ gridColumn: { xs: "span 3", md: "span 2" } }}><TimeField label="เลิก" value={it.end} onChange={(v) => setItem(it.key, { end: v })} error={h === null} /></Box>
                  <TextField select size="small" label="ประเภท OT" value={it.type} onChange={(e) => setItem(it.key, { type: e.target.value, typeTouched: true })}
                    sx={{ gridColumn: { xs: "1 / -1", md: "span 4" }, "& .MuiSelect-select": { color: tm.color, fontWeight: 700 } }}>
                    {OT_TYPES.map((t) => (
                      <MenuItem key={t.value} value={t.value}>
                        {t.label}{cfg?.multipliers?.[t.value] ? ` (×${cfg.multipliers[t.value]})` : ""}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Autocomplete
                    sx={{ gridColumn: "1 / -1" }}
                    options={opts} value={it.job} loading={jobLoading || dayJobs[it.date] === null} filterOptions={(x) => x}
                    groupBy={(o) => (o.__grp === "day" ? `งานในวันที่ ${thaiDate(it.date)} (${onDay.length})` : "งานอื่น · พิมพ์เพื่อค้นหา")}
                    onChange={(_, v) => (v ? pickJob(it, v) : setItem(it.key, { job: null }))}
                    onInputChange={(_, v, r) => { if (r === "input") setJobQuery(v); }}
                    onOpen={() => setJobQuery("")}
                    isOptionEqualToValue={(o, v) => o._id === v._id}
                    getOptionLabel={(o) => [jobLabel(o), jobRangeText(o)].filter(Boolean).join(" · ")}
                    renderGroup={(g) => (
                      <li key={g.key}>
                        <Box sx={{ position: "sticky", top: -8, zIndex: 1, px: 1.75, py: 0.75, bgcolor: String(g.group).startsWith("งานในวันที่") ? "#ecfeff" : "#f8fafc",
                          color: String(g.group).startsWith("งานในวันที่") ? OT_DARK : TEXT_SUB, fontSize: "0.76rem", fontWeight: 800, borderBottom: `1px solid ${BORDER_MAIN}` }}>{g.group}</Box>
                        <Box component="ul" sx={{ p: 0 }}>{g.children}</Box>
                      </li>
                    )}
                    renderOption={({ key: k, ...li }, o) => (
                      <li {...li} key={o._id}>
                        <JobOptionRow job={o} main={jobLabel(o)} sub={[jobRangeText(o), o.docNo ? `เลขที่ ${o.docNo}` : "", o.status || ""].filter(Boolean).join(" · ")} />
                      </li>
                    )}
                    noOptionsText={`ไม่มีงานในวันที่ ${thaiDate(it.date)} — พิมพ์ชื่องานเพื่อค้นหา`}
                    renderInput={(params) => (
                      <TextField {...params} size="small" label="งานที่ทำ OT *" error={touched && !it.job} placeholder={`งานในวันที่ ${thaiDate(it.date)} หรือพิมพ์ค้นหา`}
                        InputProps={{ ...params.InputProps, endAdornment: (<>{jobLoading ? <CircularProgress size={16} /> : null}{params.InputProps.endAdornment}</>) }} />
                    )}
                  />
                  {/* งานหลายวัน → เลือกวันของงานที่ทำ OT จริง */}
                  {jobDays.length > 1 && (
                    <Box sx={{ gridColumn: "1 / -1", p: 1.25, borderRadius: 2.5, border: `1px solid ${outOfRange ? "#fcd34d" : BORDER_MAIN}`, bgcolor: outOfRange ? "#fffbeb" : "#f8fafc" }}>
                      <Typography sx={{ fontSize: "0.76rem", fontWeight: 800, color: outOfRange ? "#b45309" : TEXT_SUB, mb: 0.75 }}>
                        {outOfRange ? `วันที่ ${thaiDate(it.date)} ไม่อยู่ในช่วงงานนี้ — เลือกวันที่ทำ OT` : `งานนี้มี ${jobDays.length} วัน — เลือกวันที่ทำ OT`}
                      </Typography>
                      <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75 }}>
                        {jobDays.map((d) => {
                          const on = d === it.date;
                          return (
                            <ButtonBase key={d} onClick={() => setItem(it.key, { date: d })}
                              sx={{ flexDirection: "column", width: 52, py: 0.5, borderRadius: 2, fontFamily: "inherit", border: `1.5px solid ${on ? OT_ACCENT : BORDER_MAIN}`,
                                bgcolor: on ? OT_ACCENT : "#fff", color: on ? "#fff" : TEXT_MAIN, "&:hover": { borderColor: OT_ACCENT } }}>
                              <Box component="span" sx={{ fontSize: "0.66rem", fontWeight: 700, opacity: 0.85 }}>{DAY_SHORT[moment(d).day()]}</Box>
                              <Box component="span" sx={{ fontSize: "0.95rem", fontWeight: 900, lineHeight: 1.1 }}>{moment(d).date()}</Box>
                              <Box component="span" sx={{ fontSize: "0.6rem", opacity: 0.85 }}>{thaiDate(d).split(" ")[1]}</Box>
                            </ButtonBase>
                          );
                        })}
                      </Stack>
                    </Box>
                  )}
                  {jobDays.length === 1 && outOfRange && (
                    <Alert severity="warning" sx={{ gridColumn: "1 / -1", py: 0, borderRadius: 2 }}
                      action={<Button size="small" onClick={() => setItem(it.key, { date: jobDays[0] })} sx={{ textTransform: "none", fontWeight: 800 }}>ใช้วันที่ {thaiDate(jobDays[0])}</Button>}>
                      งานนี้อยู่วันที่ {thaiDate(jobDays[0])} ไม่ตรงกับวันที่ทำ OT
                    </Alert>
                  )}
                  {/* วันหยุด/วันทำงานของวันที่เลือก — ชุดเดียวกับปฏิทินงาน */}
                  <Box sx={{ gridColumn: "1 / -1" }}>
                    <OtDayInfo date={it.date} cfg={cfg} holidays={holidays} onPickDate={(d) => setItem(it.key, { date: d })} />
                  </Box>
                  <TextField size="small" label="รายละเอียดงานที่ทำ" value={it.task} onChange={(e) => setItem(it.key, { task: e.target.value })}
                    sx={{ gridColumn: "1 / -1" }} inputProps={{ maxLength: 300 }}
                    placeholder="เช่น เดินสายสัญญาณชั้น 5 ต่อจากเวลางาน"
                    helperText={crossesMidnight(it.start, it.end) ? "ข้ามเที่ยงคืน — นับต่อเนื่องถึงวันถัดไป" : undefined} />
                </Box>
              </Box>
            );
          })}
        </Stack>
        <Button fullWidth variant="outlined" startIcon={<Add />} onClick={addItem}
          sx={{ mt: 1.25, height: 44, textTransform: "none", fontWeight: 800, borderRadius: 2.5, borderStyle: "dashed", bgcolor: "#fff", color: OT_DARK, borderColor: alpha(OT_ACCENT, 0.5), "&:hover": { borderStyle: "dashed", borderColor: OT_ACCENT, bgcolor: alpha(OT_ACCENT, 0.04) } }}>
          เพิ่มรายการที่ {items.length + 1}
        </Button>

        <TextField size="small" fullWidth label="เหตุผล / หมายเหตุ (ไม่บังคับ)" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2}
          inputProps={{ maxLength: 1000 }} placeholder="เช่น ลูกค้าขอให้เข้างานนอกเวลาเพื่อไม่กระทบการเปิดร้าน"
          sx={{ mt: 1.5, mb: 0.5, bgcolor: "#fff" }} />
        <EvidencePicker files={evidence} onChange={setEvidence} existing={editing ? request.attachments || [] : []} />
      </DialogContent>

      <DialogActions sx={{ px: { xs: 1.5, sm: 2.5 }, py: 1.25, borderTop: `1px solid ${BORDER_MAIN}`, gap: 1, bgcolor: "#fff" }}>
        {error ? (
          <Alert severity="error" sx={{ flex: 1, py: 0, "& .MuiAlert-message": { fontSize: "0.8rem" } }}>{error}</Alert>
        ) : (
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>รวม {items.length} รายการ</Typography>
            <Typography sx={{ fontWeight: 900, lineHeight: 1.1 }}>{hoursText(totalHours)}</Typography>
          </Box>
        )}
        <Button onClick={() => onClose?.({ kept: basketMode, count: items.length })} disabled={saving}
          sx={{ textTransform: "none", color: basketMode ? OT_DARK : TEXT_SUB, fontWeight: basketMode ? 800 : 500, display: { xs: error ? "none" : "inline-flex", sm: "inline-flex" } }}>
          {basketMode ? "เก็บไว้ก่อน" : "ยกเลิก"}
        </Button>
        <Button variant="contained" onClick={submit} disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : editing && !resubmit ? <Save /> : <Send />}
          sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, px: 2.5, boxShadow: "none", whiteSpace: "nowrap", bgcolor: OT_ACCENT, "&:hover": { bgcolor: OT_DARK, boxShadow: "none" } }}>
          {saving ? "กำลังบันทึก..." : resubmit ? "ส่งใหม่" : editing ? "บันทึก" : "ส่งขออนุมัติ"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
