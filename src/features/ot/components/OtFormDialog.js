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
 * 🔁 (25 พ.ย. 2569 ผู้ใช้: "อยากให้เปิดหน้าต่าง event ขนาดย่อมาให้เลือกวัน หรืองานที่ลงในวันนั้นได้เลย ... ไม่สับสน เวลาเลื่อนดูงานเยอะๆ")
 *    ช่อง "วันที่" + ช่องค้นหางานแบบรายการยาว → การ์ด "วันและงานที่ทำ OT" ช่องเดียว แตะแล้วเปิดปฏิทินย่อ (OtJobPicker)
 *    เห็นว่าวันไหนมีงาน · แตะวัน = งานของวันนั้นเป็นการ์ด · แตะงาน = ได้ทั้งวันที่และงานพร้อมกัน
 * ✅ (25 พ.ย. 2569 ผู้ใช้: "ให้ผูกหลายงานได้รายการเดียวด้วย") 1 รายการ = jobs หลายงาน (ชั่วโมงนับครั้งเดียว)
 *    ส่ง eventIds ทั้งหมด + eventId = งานแรก (server รุ่นก่อนหน้ายังรับงานแรกได้)
 * 🎨 (25 พ.ย. 2569 ผู้ใช้: "จัดวางให้เห็นค่าชั่วโมงของวันให้ดูง่าย ชัดเจน" · "จัดให้ดี ดูง่าย" · "สีสันไม่ต้องรก")
 *    ทุกค่าแสดงที่เดียว ไม่ซ้ำ: วันที่+งาน (การ์ดเลือก) → เริ่ม · เลิก · = ชั่วโมง OT · ประเภท (แถวเดียว อ่านเป็นสมการ)
 *    → บรรทัดเล็กบอกชนิดวัน/กติกา OT → รายละเอียด · ชั่วโมงคิดสูตรเดียวกับ server (lineHours ↔ hoursOf)
 * ✅ (25 พ.ย. 2569 ผู้ใช้: "ให้แต่ละรายการ สามารถแนบไฟล์หลักฐานแยกกันได้" · "ดึงรูปบันทึกเข้างานมาแสดง แบบของเบิกผู้รับเหมา")
 *    แต่ละรายการ: บันทึกเข้างานของงานที่เลือกในวันนั้น (เวลา · ผู้บันทึก · รูปหน้างาน — ชุดเดียวกับใบค่าจ้างผู้รับเหมา)
 *    + หลักฐานของรายการ (อัปหลังบันทึกใบ ติดรหัสรายการ itemRef) · ใบเก่าที่แนบรวมไว้ยังแสดงเป็น "หลักฐานเดิมของใบ"
 * ✅ (25 พ.ย. 2569 ผู้ใช้: "ไม่ให้เบิก OT ซ้ำงานได้ งานไหนที่ลงรายการไปแล้ว จนกว่าจะกดลบรายการนั้นก่อน อธิบายให้ชัดเจน")
 *    1 งานเบิกได้วันละ 1 รายการ — ปฏิทินย่อล็อกงานที่อยู่ในรายการอื่น/ใบอื่นแล้ว พร้อมบอกว่าอยู่ที่ไหน · ฟอร์มเตือน+กันส่ง
 *    (server ตรวจซ้ำ: routes/ot.js buildLines + crossDocOverlap)
 * 🐛 (25 พ.ย. 2569 ผู้ใช้: "ไม่มีฉบับร่างแต่มีให้กดล้าง") ฉบับร่าง = รายการที่เลือกงานแล้วเท่านั้น — รายการเปล่าไม่นับ/ไม่เก็บ
 */
import { useEffect, useMemo, useState } from "react";
import moment from "moment";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography, TextField, IconButton, Alert,
  useMediaQuery, MenuItem, Tooltip, CircularProgress, Avatar, ButtonBase,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { CloseRounded as Close, DeleteOutlineRounded as DeleteOutline, SendRounded as Send, SaveRounded as Save, AccessTimeRounded as AccessTime, ContentCopyRounded as ContentCopy, AddRounded as Add, EditCalendarRounded as EditCalendar } from "@mui/icons-material";

import { thaiDate } from "@/shared/utils/thaiDate";
import { useAuth } from "@/features/auth/AuthContext";
import { jobText, jobRangeText } from "@/features/expenses/expenseMeta";
import JobTypeChip from "@/shared/ui/JobTypeChip";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import OtService, { errorText } from "../services/OtService";
import {
  OT_ACCENT, OT_DARK, TEXT_MAIN, TEXT_SUB, BORDER_MAIN, OT_TYPES, lineHours, hoursText, guessType, timeForType, crossesMidnight, lineJobs,
} from "../otMeta";
import useFormDraft, { DraftBanner } from "@/shared/hooks/useFormDraft";
import OtDayInfo, { useHolidays } from "./OtDayInfo";
import { ItemEvidence, EvidenceGallery } from "./OtEvidence";
import { useAttendanceByDay, AttendanceDayStrip } from "@/features/expenses/components/AttendanceRefs";
import { useFileGallery } from "@/shared/ui/FileGalleryDialog";
import OtJobPicker, { dayOfJobText } from "./OtJobPicker";

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

/** งานของรายการ — รูปใหม่ jobs[] · ร่าง/รายการรอส่งรุ่นก่อนมี job ตัวเดียว */
const jobsOf = (it) => (Array.isArray(it?.jobs) ? it.jobs.filter(Boolean) : it?.job ? [it.job] : []);
// ⚠️ files (หลักฐานที่ยังไม่อัปโหลด = File) เก็บลงเครื่องไม่ได้ — ตัดทิ้งทุกครั้งที่บันทึกร่าง/รายการรอส่ง
const normItem = (it) => { const { job: _old, files: _files, ...rest } = it || {}; return { ...rest, jobs: jobsOf(it) }; };

/** รายการใหม่ — ต่อจากรายการก่อนหน้า (วัน/เวลา/งานเดิม) ให้กรอกเร็ว */
const blankItem = (cfg, from) => {
  const date = from?.date || today();
  // เวลาที่แก้เองแล้ว → ใช้ต่อ · ประเภทที่เลือกเอง → เวลาตามประเภทนั้น · ไม่งั้นตามวัน
  const t = from?.timeTouched ? from : from?.typeTouched ? timeForType(from.type) : defaultTime(date, cfg);
  return {
    key: key(), date, start: t.start, end: t.end, breakMin: 0, timeTouched: Boolean(from?.timeTouched),
    type: from?.typeTouched ? from.type : guessType(date, t.start, cfg), typeTouched: Boolean(from?.typeTouched),
    // ⚠️ ไม่คัดลอกงานจากรายการก่อนหน้า — วันเดียวกันงานเดียวกันเบิกซ้ำไม่ได้ (1 งานวันละ 1 รายการ) · "คัดลอกไปวันถัดไป" ยังคงงานไว้
    jobs: [], task: "",
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
    if (list.length) localStorage.setItem(basketKey(uid), JSON.stringify(list.map((it) => ({ ...normItem(it), jobs: jobsOf(it).map(slimJob) }))));
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
  const [pickerFor, setPickerFor] = useState(null); // key ของรายการที่กำลังเลือกวัน/งานในปฏิทินย่อ
  const [myDocs, setMyDocs] = useState([]); // ใบ OT ที่มีอยู่ (กันเบิกงาน+วันเดียวกันซ้ำ)
  const [owners, setOwners] = useState([]); // ผู้ทำ OT — ใบใหม่ = ตัวเอง · แก้ใบเดิม = ตามใบ
  const [items, setItems] = useState([]);
  const [note, setNote] = useState("");
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
    data: { items: items.map(normItem), note },
    restore: (d) => {
      if (Array.isArray(d.items) && d.items.length) setItems(d.items.map(normItem));
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
    OtService.list().then((r) => alive && setMyDocs(Array.isArray(r) ? r : [])).catch(() => {});
    if (editing) {
      // แถวของคนเดียวกันที่วัน/เวลา/งานเดียวกัน → รายการเดียว
      const map = new Map();
      const persons = new Map();
      (request.lines || []).forEach((l) => {
        persons.set(l.person.userId, { userId: l.person.userId, name: l.person.name });
        const d = moment(l.date).format("YYYY-MM-DD");
        const lj = lineJobs(l);
        const k = l.itemRef || [d, l.start, l.end, l.breakMin || 0, l.type, l.task || "", lj.map((j) => j.eventId).join("+")].join("|");
        if (!map.has(k)) {
          map.set(k, {
            // ✅ รหัสรายการเดิม (itemRef) — หลักฐานที่แนบไว้กับรายการนี้ยังผูกอยู่หลังแก้ไข
            key: l.itemRef || key(), date: d, start: l.start, end: l.end, breakMin: 0, timeTouched: true, type: l.type, typeTouched: true,
            jobs: lj.filter((j) => j.eventId).map((j) => ({ _id: j.eventId, title: "", __label: j.jobTitle })), task: l.task || "",
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
        const it = { ...blankItem(null, { date }), ...defaultTime(date, null), jobs: [{ ...presetJob, __label: "" }] };
        // งานเดียวกันวันเดียวกันมีในรายการแล้ว = ไม่เพิ่มซ้ำ
        const list = basket.map(normItem);
        const dup = list.some((b) => b.jobs.some((j) => j._id === presetJob._id) && b.date === date);
        setItems(dup ? list : [...list, it]);
      } else if (basket.length) {
        setItems(basket.map(normItem));
      } else {
        setItems([blankItem(null)]);
      }
      setNote("");
    }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- รีเซ็ตเฉพาะตอนเปิดกล่อง/เปลี่ยนใบ
  }, [open, request?._id]);

  // โหมดรายการรอส่ง → บันทึกรายการลงเครื่องทุกครั้งที่แก้ (ปิดกล่องแล้วยังอยู่)
  useEffect(() => {
    // เก็บเฉพาะรายการที่เลือกงานแล้ว (รายการเปล่า = ยังไม่ใช่ฉบับร่าง) — ว่างหมด = ลบฉบับร่างทิ้ง
    if (open && basketMode) saveOtBasket(uid, items.filter((it) => jobsOf(it).length > 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- บันทึกตามรายการ
  }, [items, basketMode, open]);
  // ✅ (25 พ.ย. 2569 ผู้ใช้: "ล้างฉบับร่างให้มีปุ่มคอนเฟิร์มด้วย กันกดผิด") — ถามก่อนทุกครั้ง
  const [confirmClear, setConfirmClear] = useState(false);
  const clearBasket = () => { saveOtBasket(uid, []); setItems([blankItem(cfg)]); setConfirmClear(false); };

  const holidays = useHolidays(cfg);
  // บันทึกเข้างานของทุกงานที่เลือกในฟอร์ม (แยกวัน · ติดรหัสงาน) — แต่ละรายการกรองเฉพาะงานของตัวเอง
  const attByDay = useAttendanceByDay(items.flatMap((it) => jobsOf(it).map((j) => j._id)));
  const gallery = useFileGallery();
  const attachments = editing ? request.attachments || [] : [];
  const itemKeys = new Set(items.map((it) => it.key));
  const looseFiles = attachments.filter((a) => !a.itemRef || !itemKeys.has(a.itemRef)); // ใบเก่า: หลักฐานรวมของใบ
  const who = owners.length ? owners : [me];
  const jobLabel = (j) => (j ? (j.__label || jobText(j) || j.title || "") : "");
  /** ชื่องานโดยไม่ซ้ำชื่อประเภท (ป้ายสีบอกแล้ว) */
  const jobMain = (j) => {
    const t = String(j?.title || "").trim();
    const l = jobLabel(j);
    return t && l.toLowerCase().startsWith(t.toLowerCase()) ? l.slice(t.length).trim() || l : l;
  };

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
  /**
   * ✅ (25 พ.ย. 2569 ผู้ใช้: "ปุ่มเพิ่มรายการ ให้กดเพิ่มง่ายๆ เวลามีหลายรายการต้องเลื่อนไกล")
   * มีปุ่มเพิ่มรายการที่แถบล่าง (เห็นตลอด) · เพิ่มแล้วเลื่อนไปที่รายการใหม่ให้เอง
   */
  const [scrollToKey, setScrollToKey] = useState(null);
  const addItem = () => {
    const it = blankItem(cfg, items[items.length - 1]);
    setItems((cur) => [...cur, it]);
    setScrollToKey(it.key);
  };
  useEffect(() => {
    if (!scrollToKey) return;
    const t = setTimeout(() => {
      document.getElementById(`ot-item-${scrollToKey}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      setScrollToKey(null);
    }, 60);
    return () => clearTimeout(t);
  }, [scrollToKey]);
  const copyNextDay = (it) => setItems((cur) => {
    const d = moment(it.date).add(1, "day").format("YYYY-MM-DD");
    const i = cur.findIndex((x) => x.key === it.key);
    const t = it.timeTouched ? it : defaultTime(d, cfg);
    const copy = { ...it, key: key(), date: d, start: t.start, end: t.end, type: it.typeTouched ? it.type : guessType(d, t.start, cfg) };
    return [...cur.slice(0, i + 1), copy, ...cur.slice(i + 1)];
  });

  // ✅ ชั่วโมงรวมของใบ = ผลรวมทุกรายการ × จำนวนคนในใบ (ใบที่หัวหน้ายื่นให้หลายคน — server สร้างบรรทัดให้ทุกคน)
  const itemHours = useMemo(() => items.reduce((s, it) => s + (lineHours(it.start, it.end, it.breakMin) || 0), 0), [items]);
  const totalHours = itemHours * Math.max(1, (owners.length || 1));

  /**
   * งาน+วัน ที่ "ใช้แล้ว" → ข้อความบอกว่าอยู่ที่ไหน
   *   claimed: เบิกแล้วในใบอื่น (ไม่นับใบที่ยกเลิก · ไม่นับใบที่กำลังแก้) ของคนในใบนี้
   *   usedBy(key): อยู่ในรายการอื่นของใบนี้ (ไม่นับรายการ key เอง)
   */
  const whoIds = new Set(who.map((p) => String(p.userId)));
  const claimed = new Map();
  myDocs.filter((d) => d.status !== "cancelled" && d._id !== request?._id).forEach((d) => (d.lines || []).forEach((l) => {
    if (!whoIds.has(String(l.person?.userId))) return;
    const day = moment(l.date).format("YYYY-MM-DD");
    lineJobs(l).forEach((j) => { if (j.eventId) claimed.set(`${j.eventId}|${day}`, `เบิกแล้วในใบ ${d.docNo}`); });
  }));
  const usedBy = (exceptKey) => {
    const m = new Map(claimed);
    items.forEach((x, idx) => { if (x.key !== exceptKey) jobsOf(x).forEach((j) => { if (j._id) m.set(`${j._id}|${x.date}`, `อยู่ในรายการที่ ${idx + 1} แล้ว`); }); });
    return m;
  };
  /** ปัญหาซ้ำของรายการนี้ → [{ job, where }] */
  const dupOf = (it) => {
    const m = usedBy(it.key);
    return jobsOf(it).map((j) => ({ job: j, where: m.get(`${j._id}|${it.date}`) })).filter((x) => x.where);
  };

  const problems = [];
  if (!items.length) problems.push("เพิ่มรายการ OT อย่างน้อย 1 รายการ");
  if (items.some((it) => !jobsOf(it).length)) problems.push("เลือกงานที่ทำ OT ให้ครบทุกรายการ");
  if (items.some((it) => dupOf(it).length)) problems.push("แก้รายการที่เบิกงานซ้ำ (1 งานเบิกได้วันละ 1 รายการ)");
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
        breakMin: 0, task: it.task, eventId: jobsOf(it)[0]?._id || "", eventIds: jobsOf(it).map((j) => j._id).filter(Boolean), itemRef: it.key,
      }))),
    };
    try {
      let saved = editing ? await OtService.update(request._id, payload) : await OtService.create(payload);
      draft.clear(); // บันทึกสำเร็จ → ล้างข้อมูลที่กรอกค้าง
      if (!editing) saveOtBasket(uid, []); // ส่งแล้ว → ล้างรายการรอส่ง
      // หลักฐาน (ไม่บังคับ) — อัปไม่สำเร็จไม่ทำให้ใบหาย แนบเพิ่มได้ภายหลังในหน้ารายละเอียด
      let fileWarn = "";
      // หลักฐานของแต่ละรายการ — อัปทีเดียวพร้อมรหัสรายการ (server ผูกไฟล์กับรายการที่มีอยู่ในใบจริงเท่านั้น)
      const uploads = items.flatMap((it) => (it.files || []).map((f) => ({ file: f.file, ref: it.key })));
      if (uploads.length) {
        try { saved = await OtService.addFiles(saved._id, uploads.map((u) => u.file), uploads.map((u) => u.ref)); } catch (e) { fileWarn = `บันทึกใบแล้ว แต่แนบหลักฐานไม่สำเร็จ (${errorText(e)}) — แนบเพิ่มได้ในหน้ารายละเอียด`; }
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
        {basketMode && items.some((it) => jobsOf(it).length > 0) && (
          <Alert severity="info" icon={false} sx={{ mb: 1.5, borderRadius: 2.5, bgcolor: "#ecfeff", color: OT_DARK, border: "1px solid #a5f3fc", "& .MuiAlert-message": { width: "100%" } }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <Box sx={{ flex: 1, fontSize: "0.84rem" }}>
                <b>ฉบับร่าง OT {items.filter((it) => jobsOf(it).length > 0).length} รายการ</b> — กด “บันทึกฉบับร่าง” แล้วไปกด “ขอ OT งานนี้” ที่งาน/วันอื่นต่อได้ ครบแล้วค่อยส่งขออนุมัติทีเดียว
              </Box>
              <Button size="small" onClick={() => setConfirmClear(true)} sx={{ textTransform: "none", fontWeight: 700, color: TEXT_SUB, flexShrink: 0 }}>ล้างฉบับร่าง</Button>
            </Stack>
          </Alert>
        )}
        {resubmit && request.rejectReason && (
          <Alert severity="warning" sx={{ mb: 1.5, borderRadius: 2 }}><b>ถูกตีกลับ:</b> {request.rejectReason} — แก้แล้วกด “ส่งใหม่”</Alert>
        )}

        {/* ── รายการ OT 1, 2, 3 … ── */}
        <Stack spacing={2}>
          {items.map((it, i) => {
            const h = lineHours(it.start, it.end, it.breakMin);
            const jobs = jobsOf(it);
            const bad = h === null || (touched && !jobs.length) || dupOf(it).length > 0;
            // งานที่เลือกแต่ไม่มีในวันที่ทำ OT (งานที่ไม่รู้ช่วงวัน เช่นจากใบเดิม = ไม่เตือน)
            const offJobs = jobs.filter((j) => { const ds = daysOfJob(j); return ds.length > 0 && !ds.includes(it.date); });
            const dups = dupOf(it);
            // พักเที่ยง/ข้ามเที่ยงคืน — บอกให้รู้ว่าทำไมชั่วโมงไม่เท่าช่วงเวลา
            const [sh, sm] = String(it.start || "").split(":").map(Number);
            const [eh, em] = String(it.end || "").split(":").map(Number);
            const rawMin = [sh, sm, eh, em].every(Number.isFinite) ? ((eh * 60 + em) - (sh * 60 + sm) + 1440) % 1440 : 0;
            const lunchOff = h !== null && rawMin ? Math.round((rawMin / 60 - h) * 100) / 100 : 0;
            const hoursNote = [lunchOff > 0 ? `หักพักเที่ยง ${hoursText(lunchOff)}` : "", crossesMidnight(it.start, it.end) ? "ข้ามเที่ยงคืน" : ""].filter(Boolean).join(" · ");
            return (
              <Box key={it.key} id={`ot-item-${it.key}`} sx={{ bgcolor: "#fff", border: `1px solid ${bad ? "#fca5a5" : BORDER_MAIN}`, borderRadius: 3, boxShadow: "none", overflow: "hidden", scrollMarginTop: 8 }}>
                {/* หัวรายการ: เลขที่ · สรุปสั้น (วัน · ชั่วโมง) · คัดลอก/ลบ */}
                <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 1.5, py: 0.9, borderBottom: `1px solid ${BORDER_MAIN}`, bgcolor: "#fcfdfe" }}>
                  <Box sx={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", bgcolor: OT_ACCENT, color: "#fff", fontWeight: 900, fontSize: "0.82rem" }}>{i + 1}</Box>
                  <Typography sx={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: "0.9rem", color: TEXT_MAIN }} noWrap>
                    รายการที่ {i + 1}
                    <Box component="span" sx={{ ml: 1, fontWeight: 600, fontSize: "0.78rem", color: TEXT_SUB }}>
                      {DAY_SHORT[moment(it.date).day()]} {thaiDate(it.date)}{h !== null ? ` · ${hoursText(h)}` : ""}
                    </Box>
                  </Typography>
                  <Tooltip title="คัดลอกไปวันถัดไป"><IconButton size="small" onClick={() => copyNextDay(it)}><ContentCopy sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                  <Tooltip title={items.length === 1 ? "ต้องมีอย่างน้อย 1 รายการ" : "ลบรายการนี้"}>
                    <span><IconButton size="small" disabled={items.length === 1} onClick={() => setItems((cur) => cur.filter((x) => x.key !== it.key))}><DeleteOutline sx={{ fontSize: 19 }} /></IconButton></span>
                  </Tooltip>
                </Stack>

                {/* 🎨 (25 พ.ย. 2569 ผู้ใช้: "ดูชิดติดกันเกินไป") เว้นระยะแถวให้ป้ายของช่องกรอกไม่ชนการ์ดด้านบน */}
                <Box sx={{ p: { xs: 1.5, sm: 2 }, display: "grid", rowGap: { xs: 2, sm: 2.25 }, columnGap: 1.5, alignItems: "start", gridTemplateColumns: { xs: "repeat(6, 1fr)", md: "repeat(12, 1fr)" } }}>
                  {/* ✅ (25 พ.ย. 2569) วันและงาน = ช่องเดียว แตะแล้วเปิดปฏิทินย่อ · 🎨 ผู้ใช้: "ทำให้ดูสังเกตว่าเป็นปุ่มเลือกงานง่ายกว่านี้"
                      ยังไม่เลือก = กรอบเส้นประสีหลัก + ปุ่มทึบ "เลือกงาน" · เลือกแล้ว = รายชื่องาน + ปุ่ม "เปลี่ยน/เพิ่มงาน" */}
                  <ButtonBase onClick={() => setPickerFor(it.key)} aria-label="เลือกวันและงานที่ทำ OT"
                    sx={{
                      gridColumn: "1 / -1", display: "flex", alignItems: "stretch", textAlign: "left", width: "100%", borderRadius: 2.5, overflow: "hidden", fontFamily: "inherit",
                      border: `1.5px ${jobs.length ? "solid" : "dashed"} ${touched && !jobs.length ? "#f87171" : jobs.length ? alpha(OT_ACCENT, 0.45) : OT_ACCENT}`,
                      bgcolor: jobs.length ? "#fff" : alpha(OT_ACCENT, 0.04),
                      transition: "border-color .12s, box-shadow .12s, background-color .12s",
                      "&:hover": { borderColor: OT_ACCENT, bgcolor: jobs.length ? "#fff" : alpha(OT_ACCENT, 0.08), boxShadow: `0 4px 14px ${alpha(OT_ACCENT, 0.15)}` },
                      "&:hover .pick-cta": { bgcolor: OT_DARK, color: "#fff" },
                    }}>
                    <Stack alignItems="center" justifyContent="center" sx={{ width: 68, flexShrink: 0, py: 1, bgcolor: alpha(OT_ACCENT, 0.08), color: OT_DARK, borderRight: `1px solid ${alpha(OT_ACCENT, 0.18)}` }}>
                      <Typography component="span" sx={{ fontSize: "0.7rem", fontWeight: 800, lineHeight: 1.2 }}>{DAY_SHORT[moment(it.date).day()]}</Typography>
                      <Typography component="span" sx={{ fontSize: "1.45rem", fontWeight: 900, lineHeight: 1.05, color: TEXT_MAIN }}>{moment(it.date).date()}</Typography>
                      <Typography component="span" sx={{ fontSize: "0.66rem", fontWeight: 700, lineHeight: 1.2 }}>{thaiDate(it.date).split(" ").slice(1).join(" ")}</Typography>
                    </Stack>
                    <Box sx={{ flex: 1, minWidth: 0, px: 1.5, py: 1.1 }}>
                      <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, color: touched && !jobs.length ? "#dc2626" : TEXT_SUB, mb: 0.4 }}>
                        งานที่ทำ OT *{jobs.length > 1 ? ` · ${jobs.length} งาน` : ""}
                      </Typography>
                      {jobs.length ? (
                        /* 🎨 (25 พ.ย. 2569 ผู้ใช้: "เวลาเลือกหลายงานยังดูจัดวางแปลกๆ") ตาราง 3 คอลัมน์ — ป้ายประเภท | ชื่องาน | วันที่เท่าไรของงาน
                           ป้ายกว้างเท่ากันทุกแถว ชื่องานเริ่มตรงกัน · แสดงครบทุกงาน (เกิน 5 งานค่อยย่อ) */
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "auto minmax(0, 1fr)", sm: "auto minmax(0, 1fr) auto" }, columnGap: 1, rowGap: 0.6, alignItems: "center" }}>
                          {jobs.slice(0, jobs.length > 5 ? 4 : 5).map((j) => (
                            <Box key={j._id || jobLabel(j)} sx={{ display: "contents" }}>
                              <Box sx={{ display: "flex" }}>{j.title ? <JobTypeChip job={j} sx={{ minWidth: 72, justifyContent: "center" }} /> : <Box sx={{ width: 72 }} />}</Box>
                              <Typography noWrap sx={{ fontSize: "0.86rem", fontWeight: 800, color: TEXT_MAIN, minWidth: 0 }}>{jobMain(j)}</Typography>
                              {/* ✅ งานหลายวัน = บอกว่าวันนี้คือวันที่เท่าไรของงาน (ไม่นับรวมวันอื่น) */}
                              <Typography noWrap sx={{ display: { xs: "none", sm: "block" }, fontSize: "0.72rem", color: TEXT_SUB, textAlign: "right" }}>
                                {dayOfJobText(j, it.date) ? dayOfJobText(j, it.date).replace(" ของงาน", "") : "งาน 1 วัน"}
                              </Typography>
                            </Box>
                          ))}
                          {jobs.length > 5 && <Typography sx={{ gridColumn: "1 / -1", fontSize: "0.74rem", color: TEXT_SUB, fontWeight: 700 }}>+ อีก {jobs.length - 4} งาน — กด “เปลี่ยน / เพิ่มงาน” เพื่อดูทั้งหมด</Typography>}
                        </Box>
                      ) : (
                        <Typography sx={{ fontSize: "0.88rem", fontWeight: 800, color: touched ? "#dc2626" : OT_DARK }}>ยังไม่ได้เลือกงาน — กดเพื่อเลือกจากปฏิทิน</Typography>
                      )}
                    </Box>
                    <Stack justifyContent="center" sx={{ pr: 1.25, pl: 0.5, flexShrink: 0 }}>
                      <Box className="pick-cta" component="span" sx={{
                        display: "inline-flex", alignItems: "center", gap: 0.6, px: { xs: 1, sm: 1.4 }, height: 36, borderRadius: 2, fontSize: "0.82rem", fontWeight: 800, whiteSpace: "nowrap",
                        transition: "background-color .12s, color .12s",
                        ...(jobs.length
                          ? { color: OT_DARK, border: `1.5px solid ${alpha(OT_ACCENT, 0.5)}`, bgcolor: "#fff" }
                          : { color: "#fff", bgcolor: OT_ACCENT, boxShadow: `0 2px 8px ${alpha(OT_ACCENT, 0.35)}` }),
                      }}>
                        <EditCalendar sx={{ fontSize: 19 }} />
                        <Box component="span" sx={{ display: { xs: jobs.length ? "none" : "inline", sm: "inline" } }}>{jobs.length ? "เปลี่ยน / เพิ่มงาน" : "เลือกงาน"}</Box>
                      </Box>
                    </Stack>
                  </ButtonBase>
                  <Box sx={{ gridColumn: { xs: "span 3", md: "span 3" } }}><TimeField label="เริ่ม" value={it.start} onChange={(v) => setItem(it.key, { start: v })} error={h === null} /></Box>
                  <Box sx={{ gridColumn: { xs: "span 3", md: "span 3" } }}><TimeField label="เลิก" value={it.end} onChange={(v) => setItem(it.key, { end: v })} error={h === null} /></Box>
                  {/* = ชั่วโมง OT (ผลลัพธ์ อ่านอย่างเดียว) — หน้าตาเหมือนช่องกรอก วางต่อจากเวลาเลิก */}
                  <Box sx={{ gridColumn: { xs: "span 3", md: "span 2" }, position: "relative", height: 40, px: 1.5, display: "flex", alignItems: "center", gap: 0.75,
                    borderRadius: 1, border: `1px solid ${h === null ? "#f87171" : alpha(OT_ACCENT, 0.45)}`, bgcolor: "#fff" }}>
                    <Typography component="span" sx={{ position: "absolute", top: -9, left: 9, px: 0.5, bgcolor: "#fff", fontSize: "0.72rem", color: TEXT_SUB, lineHeight: 1.4 }}>ชั่วโมง OT</Typography>
                    <Typography component="span" sx={{ fontWeight: 900, fontSize: "1.08rem", color: h === null ? "#dc2626" : OT_DARK, whiteSpace: "nowrap" }}>{h === null ? "เวลาไม่ถูก" : hoursText(h)}</Typography>
                  </Box>
                  <TextField select size="small" label="ประเภท OT" value={it.type} onChange={(e) => setItem(it.key, { type: e.target.value, typeTouched: true })}
                    sx={{ gridColumn: { xs: "span 3", md: "span 4" }, "& .MuiSelect-select": { color: TEXT_MAIN, fontWeight: 700 } }}>
                    {OT_TYPES.map((t) => (
                      <MenuItem key={t.value} value={t.value}>
                        {t.label}{cfg?.multipliers?.[t.value] ? ` (×${cfg.multipliers[t.value]})` : ""}
                      </MenuItem>
                    ))}
                  </TextField>
                  {dups.length > 0 && (
                    <Alert severity="error" sx={{ gridColumn: "1 / -1", py: 0.25, borderRadius: 2 }}
                      action={<Button size="small" color="inherit" onClick={() => setPickerFor(it.key)} sx={{ textTransform: "none", fontWeight: 800, whiteSpace: "nowrap" }}>เปลี่ยนงาน</Button>}>
                      <b>เบิกงานซ้ำ:</b> {dups.map((d) => `${jobMain(d.job)} (${d.where})`).join(" · ")} — 1 งานเบิก OT ได้วันละ 1 รายการ
                      {dups.some((d) => d.where.startsWith("อยู่ใน")) ? " · ลบรายการที่ซ้ำ หรือเปลี่ยนงาน/วันของรายการนี้" : " · เปลี่ยนงาน/วัน หรือแก้ในใบเดิม"}
                    </Alert>
                  )}
                  {offJobs.length > 0 && (
                    <Alert severity="warning" sx={{ gridColumn: "1 / -1", py: 0, borderRadius: 2 }}
                      action={<Button size="small" onClick={() => setPickerFor(it.key)} sx={{ textTransform: "none", fontWeight: 800, whiteSpace: "nowrap" }}>แก้วัน/งาน</Button>}>
                      วันที่ {thaiDate(it.date)} ไม่อยู่ในช่วงของ {offJobs.length === 1 ? `งาน ${jobMain(offJobs[0])} (${jobRangeText(offJobs[0])})` : `${offJobs.length} งานที่เลือก`}
                    </Alert>
                  )}
                  {/* ชนิดวัน/กติกา OT ของวันนั้น + เหตุที่ชั่วโมงไม่เท่าช่วงเวลา (พักเที่ยง/ข้ามเที่ยงคืน) */}
                  <Box sx={{ gridColumn: "1 / -1", mt: -1 }}>
                    <OtDayInfo compact date={it.date} cfg={cfg} holidays={holidays} note={hoursNote} />
                  </Box>
                  <TextField size="small" label="รายละเอียดงานที่ทำ" value={it.task} onChange={(e) => setItem(it.key, { task: e.target.value })}
                    sx={{ gridColumn: "1 / -1" }} inputProps={{ maxLength: 300 }}
                    placeholder="เช่น เดินสายสัญญาณชั้น 5 ต่อจากเวลางาน"
                    helperText={crossesMidnight(it.start, it.end) ? "ข้ามเที่ยงคืน — นับต่อเนื่องถึงวันถัดไป" : undefined} />
                  {/* บันทึกเข้างาน + หลักฐานของรายการนี้ */}
                  <Box sx={{ gridColumn: "1 / -1", pt: 1.5, borderTop: `1px dashed ${BORDER_MAIN}`, display: "grid", gap: 1.5 }}>
                    {jobs.length > 0 && (
                      <Box>
                        <Typography sx={{ fontWeight: 800, fontSize: "0.8rem", color: TEXT_MAIN, mb: 0.75 }}>บันทึกเข้างานวันนี้</Typography>
                        <AttendanceDayStrip hasJobs onOpen={gallery.open}
                          entries={(attByDay.get(it.date) || []).filter((e) => !e.eventId || jobs.some((j) => String(j._id) === String(e.eventId)))} />
                      </Box>
                    )}
                    <ItemEvidence files={it.files || []} onChange={(files) => setItem(it.key, { files })}
                      existing={attachments.filter((a) => a.itemRef && a.itemRef === it.key)} />
                  </Box>
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
        {looseFiles.length > 0 && (
          <Box sx={{ mt: 1.5, p: 1.5, bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 3 }}>
            <Typography sx={{ fontWeight: 800, fontSize: "0.84rem", color: TEXT_MAIN, mb: 1 }}>หลักฐานเดิมของใบ <Box component="span" sx={{ fontWeight: 500, fontSize: "0.74rem", color: TEXT_SUB }}>· แนบไว้รวมทั้งใบ (ไม่ระบุรายการ)</Box></Typography>
            <EvidenceGallery attachments={looseFiles} />
          </Box>
        )}
        {gallery.dialog}
        <Dialog open={confirmClear} onClose={() => setConfirmClear(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
          <DialogTitle sx={{ fontWeight: 800, pb: 0.5 }}>ล้างฉบับร่าง OT?</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ color: TEXT_SUB }}>
              รายการที่ยังไม่ได้ส่ง {items.length} รายการ (รวม {hoursText(totalHours)}) และหลักฐานที่แนบไว้จะถูกลบทั้งหมด — กู้คืนไม่ได้
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setConfirmClear(false)} sx={{ textTransform: "none", color: TEXT_SUB }}>ไม่ล้าง</Button>
            <Button variant="contained" disableElevation color="error" onClick={clearBasket} startIcon={<DeleteOutline />}
              sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2 }}>ล้างฉบับร่าง</Button>
          </DialogActions>
        </Dialog>
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
        {/* เพิ่มรายการ — อยู่แถบล่างให้กดได้ตลอด ไม่ต้องเลื่อนลงไปหาปุ่มท้ายรายการ */}
        <Button variant="outlined" onClick={addItem} disabled={saving} startIcon={<Add />} aria-label={`เพิ่มรายการที่ ${items.length + 1}`}
          sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, whiteSpace: "nowrap", color: OT_DARK, borderColor: alpha(OT_ACCENT, 0.5), minWidth: { xs: 44, sm: 0 }, px: { xs: 1.25, sm: 1.75 },
            "& .MuiButton-startIcon": { mr: { xs: 0, sm: 0.75 } } }}>
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>เพิ่มรายการ</Box>
        </Button>
        <Button onClick={() => onClose?.({ kept: basketMode, count: items.length })} disabled={saving}
          sx={{ textTransform: "none", color: basketMode ? OT_DARK : TEXT_SUB, fontWeight: basketMode ? 800 : 500, display: { xs: error || !basketMode ? "none" : "inline-flex", sm: "inline-flex" } }}>
          {basketMode ? "บันทึกฉบับร่าง" : "ยกเลิก"}
        </Button>
        <Button variant="contained" onClick={submit} disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : editing && !resubmit ? <Save /> : <Send />}
          sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, px: 2.5, boxShadow: "none", whiteSpace: "nowrap", bgcolor: OT_ACCENT, "&:hover": { bgcolor: OT_DARK, boxShadow: "none" } }}>
          {saving ? "กำลังบันทึก..." : resubmit ? "ส่งใหม่" : editing ? "บันทึก" : "ส่งขออนุมัติ"}
        </Button>
      </DialogActions>

      {/* ปฏิทินย่อ — เลือกวัน + งานของรายการที่กด */}
      {(() => {
        const cur = items.find((x) => x.key === pickerFor);
        return (
          <OtJobPicker open={Boolean(cur)} date={cur?.date} jobs={cur ? jobsOf(cur) : []} cfg={cfg} holidays={holidays}
            markedDates={items.filter((x) => x.key !== pickerFor).map((x) => x.date)}
            blocked={usedBy(pickerFor)}
            onClose={() => setPickerFor(null)}
            onPick={({ date, jobs }) => { if (cur) setItem(cur.key, { date, jobs }); setPickerFor(null); }} />
        );
      })()}
    </Dialog>
  );
}
