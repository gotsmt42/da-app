/**
 * JobCalendarPicker — หน้าต่างปฏิทินขนาดย่อสำหรับ "ผูกงาน" ทุกหน้า (OT · ใบเบิก Advance · ใบเคลม · ค่าจ้างผู้รับเหมา)
 *
 * ✅ (25 พ.ย. 2569 ผู้ใช้: "การผูกกับงานทุกๆหน้า เช่นหน้าออกใบเบิก เคลม ให้ทำเป็นรูปแบบเลือกในปฏิทินให้เหมือนกับหน้า ขอ OT")
 *    ย้ายมาจาก features/ot/components/OtJobPicker.js (ตัวนั้นเหลือเป็นตัวห่อของ OT) — หน้าตา/การใช้งานชุดเดียวกันทุกหน้า
 *
 *   mode "day"  (OT) — 1 รายการ = 1 วัน: งานที่เลือกผูกกับวันที่เลือก · เปลี่ยนวัน = เหลือเฉพาะงานที่มีในวันใหม่ · คืน { date, jobs }
 *   mode "jobs" (ใบเบิก) — เลือกงานได้หลายงานจากหลายวัน (วันในปฏิทินใช้หางานเท่านั้น) · คืน { jobs }
 *
 *   • ปฏิทินเดือน: จุด = จำนวนงานในวันนั้น · วันหยุดนักขัตฤกษ์สีแดง · กดวัน = การ์ดงานของวันนั้น (รูป+ชื่อผู้ปฏิบัติงาน)
 *   • ค้นหางานวันอื่นได้ · มือถือ: กดวันแล้วแผ่นรายการเด้งทับปฏิทิน
 *   • onlyMine "auto" = ช่าง/หัวหน้าช่างเห็นเฉพาะงานที่มีชื่อเป็นผู้ปฏิบัติงาน
 *   • ล็อกงานที่เลือกไม่ได้พร้อมบอกเหตุผล: blocked (Map "id|วัน" → ข้อความ) · loadDayLocks(วัน) → Map(id → ข้อความ) เช่น "ช่วงนี้มีใบ Advance แล้ว"
 *   • lockedIds = งานที่เอาออกไม่ได้ (เช่น เปิดฟอร์มจากเมนู "เบิก Advance งานนี้")
 *
 * ประวัติการออกแบบ (มาจาก OT — 25 พ.ย. 2569 ผู้ใช้):
 * ✅ (25 พ.ย. 2569 ผู้ใช้: "หน้าขอยื่นโอที อยากให้เปิดหน้าต่าง event ขนาดย่อมาให้เลือกวัน หรืองานที่ลงในวันนั้นได้เลย
 *    ให้เลือกได้ง่าย และใช้งานง่าย ไม่สับสน เวลาเลื่อนดูงานเยอะๆ" · "ทำให้สวยงามด้วย")
 *    เดิมเลือกวันในช่องวันที่ แล้วไปไล่หางานในรายการยาว (งานในวันนั้น + งานอื่นปนกัน) — งานเยอะแล้วหลง
 *    → ปฏิทินเดือนบอกว่า "วันไหนมีงานกี่งาน" (จุดสีตามประเภทงาน) · กดวัน = เห็นเฉพาะงานของวันนั้นเป็นการ์ด · กดการ์ด = เลือกเสร็จ
 *    ยังพิมพ์ค้นหางานวันอื่นได้ (เรียงงานที่ใกล้วันที่เลือกขึ้นก่อน) · วันที่ลง OT ในใบนี้แล้วมีป้ายบอก กันลงซ้ำ
 *
 * ✅ (25 พ.ย. 2569 ผู้ใช้: "ให้ผูกหลายงานได้รายการเดียวด้วย เผื่อมีเข้า ot หลายงาน")
 *    แตะการ์ด = เลือก/เลิกเลือก (เลือกได้หลายงาน รวมงานของวันอื่นจากการค้นหา) → ปุ่ม "ตกลง" ด้านล่าง
 *
 * ✅ (25 พ.ย. 2569 ผู้ใช้: "รายการของงานที่เข้าหลายวันให้แยกเป็นวันด้วย ไม่นับรวมวันอื่น")
 *    งานหลายวันแสดงเป็น "วันนั้นวันเดียว" (วันที่ 2 จาก 4 ของงาน) ไม่ใช่ช่วงรวม · งานที่เลือกผูกกับวันที่เลือกเสมอ
 *    เปลี่ยนวันในปฏิทิน = เหลือเฉพาะงานที่มีในวันใหม่ · เลือกงานจากผลค้นหาที่อยู่วันอื่น = ปฏิทินกระโดดไปวันนั้นให้
 *
 * ✅ (25 พ.ย. 2569 ผู้ใช้: "ถ้าของช่างให้แสดงแค่รายการที่มีชื่ออยู่ในงานเท่านั้น พร้อมแสดงรูปภาพ user และรายชื่อผู้ปฏิบัติงานทั้งหมด")
 *    ช่าง/หัวหน้าช่าง = เฉพาะงานที่มีชื่อเป็นผู้ปฏิบัติงาน (หัวหน้าทีม/ลูกทีม) · ตำแหน่งอื่นเห็นงานตามสิทธิ์ แต่งานที่มีชื่อตัวเองขึ้นก่อน
 *    การ์ดงานแสดงรูป + ชื่อผู้ปฏิบัติงานทุกคน
 * ✅ (25 พ.ย. 2569 ผู้ใช้: "ไม่ให้เบิก OT ซ้ำงานได้ งานไหนที่ลงรายการไปแล้ว จนกว่าจะลบรายการนั้นก่อน")
 *    blocked = งาน+วัน ที่อยู่ในรายการอื่นของใบนี้ หรือเบิกแล้วในใบอื่น → การ์ดล็อก บอกว่าอยู่ที่ไหน และต้องทำอะไร
 *    (server ตรวจซ้ำตอนบันทึก — routes/ot.js buildLines/crossDocOverlap)
 *
 * 📱 (25 พ.ย. 2569 ผู้ใช้: "หน้ามือถือให้กดเลือกได้ง่ายด้วย อาจจะเด้งทับขึ้นมา") มือถือ: ปฏิทินเต็มจอ → แตะวัน = แผ่นรายการงาน
 *    เด้งทับขึ้นมา (การ์ดใหญ่ กดง่าย) · ปุ่ม "← ปฏิทิน" กลับไปเลือกวันอื่น · แถบล่างเหลือจำนวนที่เลือก + ปุ่มตกลง
 *
 * แหล่งข้อมูล: /events/event-op แบบ slim — ขอบเขตเดียวกับหน้าการดำเนินงาน (ช่างเห็นเฉพาะงานที่ตัวเองเกี่ยวข้อง)
 *   ซึ่งเป็นขอบเขตเดียวกับช่องเลือกงานของ OT/ใบเบิกเดิม (GET /expenses/jobs) · คำขอซ้ำระหว่างหน้าใช้คำตอบเดียวกัน
 */
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import AuthService from "@/shared/services/authService";
import { isRole, TECHNICIAN_ROLES } from "@/shared/utils/roles";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import moment from "moment";
import {
  Dialog, Box, Stack, Typography, IconButton, Button, ButtonBase, TextField, InputAdornment, CircularProgress, Tooltip, useMediaQuery, Avatar, Slide,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  CloseRounded, ChevronLeftRounded, ChevronRightRounded, SearchRounded, CheckCircleRounded, EventBusyRounded, CalendarMonthRounded,
  RadioButtonUncheckedRounded, CheckRounded, LockRounded, EditCalendarRounded,
} from "@mui/icons-material";
import EventService from "@/shared/services/EventService";
import { thaiDate } from "@/shared/utils/thaiDate";
import JobTypeChip from "@/shared/ui/JobTypeChip";
import JobQuickView from "@/shared/ui/JobQuickView";
import { jobText, jobRangeText } from "@/features/expenses/expenseMeta";
const TEXT_MAIN = "#0f172a";
const TEXT_SUB = "#64748b";
const BORDER_MAIN = "#e6e9ef";
const DEF_ACCENT = "#0891b2";
const DEF_DARK = "#0e7490";
/** วันหยุดประจำสัปดาห์ (เสาร์–อาทิตย์ + วันที่องค์กรตั้งเพิ่ม) — ตรงกับ restDaysOf ของระบบ OT */
const restDaysOf = (cfg) => [...new Set([0, 6, ...(cfg?.restDays || [])])];

const DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const DAY_TH = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const MONTH_TH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const SOFT = "#f8fafc";
const HOLIDAY = "#dc2626";
const REST = "#64748b"; // 🎨 ผู้ใช้: "สีสันไม่ต้องรก" — วันหยุดประจำสัปดาห์ = เทา · แดงเฉพาะวันหยุดนักขัตฤกษ์

/** วันของงาน (YYYY-MM-DD) — สูตรเดียวกับ jobRangeText/daysOfJob: end ของงานทั้งวันเป็นแบบไม่รวมวันสุดท้าย */
export const jobDays = (job) => {
  if (!job?.start) return [];
  const start = new Date(job.start);
  const rawEnd = job.end ? new Date(job.end) : null;
  const n = rawEnd && rawEnd > start ? Math.max(1, Math.round((rawEnd - start) / 86400000)) : 1;
  return Array.from({ length: Math.min(n, 62) }, (_, i) => moment(start).add(i, "day").format("YYYY-MM-DD"));
};

/** งานจาก event-op → รูปเดียวกับที่ช่องเลือกงานเดิมใช้ (round = ครั้งที่) */
const toJob = (e) => ({
  _id: e._id, title: e.title, system: e.system, company: e.company, site: e.site, start: e.start, end: e.end,
  status: e.status, team: e.team, teamMembers: e.teamMembers || [], visitCount: e.visitCount, round: e.time === undefined || e.time === null ? "" : String(e.time),
  backgroundColor: e.backgroundColor, groupKey: e.jobGroupId || "",
  teamNames: [...new Set([e.team, ...(e.teamMembers || []).map((m) => m?.name)].map((n) => String(n || "").trim()).filter(Boolean))],
});
const labelOf = (j) => jobText(j) || j.title || "งาน";
/** ผู้ปฏิบัติงานของงาน (หัวหน้าทีม + ลูกทีม · ไม่ซ้ำ) → [{ userId, name, lead }] */
const workersOf = (j) => {
  const out = [];
  const add = (userId, name, lead) => {
    const n = String(name || "").trim();
    if (!n && !userId) return;
    if (out.some((w) => (userId && w.userId === String(userId)) || (n && w.name === n))) return;
    out.push({ userId: userId ? String(userId) : "", name: n, lead });
  };
  add("", j.team, true);
  (j.teamMembers || []).forEach((m) => add(m?.userId, m?.name, false));
  return out;
};
/** รายชื่อผู้ใช้ (รูปโปรไฟล์) — โหลดครั้งเดียวต่อการเปิดแอป */
let usersPromise = null;
const loadUsers = () => {
  if (!usersPromise) usersPromise = AuthService.getAllUserData().then((r) => r?.allUser || []).catch(() => { usersPromise = null; return []; });
  return usersPromise;
};
/** งานนี้มีในวันนั้นไหม (งานที่ไม่รู้ช่วงวัน = ถือว่ามี) */
const covers = (j, d) => { const ds = jobDays(j); return !ds.length || ds.includes(d); };
/** "วันที่ 2 จาก 4 ของงาน" — เฉพาะงานหลายวัน */
export const dayOfJobText = (j, d) => {
  const ds = jobDays(j);
  const i = ds.indexOf(d);
  return ds.length > 1 && i >= 0 ? `วันที่ ${i + 1} จาก ${ds.length} ของงาน` : "";
};
/** ชื่องานโดยไม่ซ้ำชื่อประเภท (ป้ายสีบอกประเภทอยู่แล้ว) — กติกาเดียวกับ JobOptionRow */
const withoutType = (j) => {
  const t = String(j.title || "").trim();
  const l = labelOf(j);
  return t && l.toLowerCase().startsWith(t.toLowerCase()) ? l.slice(t.length).trim() || l : l;
};

export default function JobCalendarPicker({
  open, date, jobs = [], markedDates = [], blocked = new Map(), cfg, holidays, onPick, onClose,
  mode = "day", title = "เลือกวันและงาน", subtitle, accent = DEF_ACCENT, accentDark = DEF_DARK,
  onlyMine = "auto", lockedIds = [], max = 20, loadDayLocks = null, canPick = null,
}) {
  const OT_ACCENT = accent;
  const OT_DARK = accentDark;
  const dayMode = mode === "day";
  const { userData } = useAuth();
  const myId = String(userData?.userId || "");
  const myName = String(userData?.fname || "").trim();
  // ช่าง = เห็นเฉพาะงานที่มีชื่อตัวเอง (onlyMine "auto") · true = ทุกคน · false = ตามสิทธิ์เห็นงาน
  const techOnly = onlyMine === true || (onlyMine === "auto" && isRole(userData, ...TECHNICIAN_ROLES));
  const [dayLocks, setDayLocks] = useState(new Map());
  const [users, setUsers] = useState([]);
  useEffect(() => { if (open) loadUsers().then(setUsers); }, [open]);
  const userOf = (w) => users.find((u) => (w.userId && String(u._id) === w.userId) || (!w.userId && w.name && String(u.fname || "").trim() === w.name));
  const isMine = (j) => workersOf(j).some((w) => (myId && w.userId === myId) || (myName && w.name === myName));
  const isMobile = useMediaQuery("(max-width:700px)");
  const today = moment().format("YYYY-MM-DD");
  const [events, setEvents] = useState(null);
  const [error, setError] = useState("");
  const [month, setMonth] = useState(() => moment(date || today).startOf("month"));
  const [day, setDay] = useState(date || today);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState([]); // งานที่เลือกไว้ (หลายงานได้)
  const [sheet, setSheet] = useState(false); // มือถือ: แผ่นรายการงานของวันที่เลือก (เด้งทับปฏิทิน)
  // ✅ (28 พ.ย. 2569 ผู้ใช้: "อยากให้มีคลิกขวาเพื่อดูข้อมูลงาน การ์ดงาน เพิ่มเติมของงานนั้นๆ ได้" · "แต่รูปแบบการกำหนดสิทธิ์แบบเดิม")
  //    คลิกขวา (มือถือ: กดค้าง) ที่การ์ดงาน = กล่องรายละเอียดงานตัวเดียวกับหน้ารายงาน/ลูกค้า (JobQuickView) — ไม่เลือก/ไม่ยกเลิกงาน
  //    เปิดได้เฉพาะงานในรายการนี้ (มาจาก server ตามสิทธิ์อยู่แล้ว) · ไม่แสดงมูลค่างาน
  const [peekId, setPeekId] = useState(null);
  // canPick(job, เลือกอยู่) → ข้อความเหตุผล (เช่น ใบผู้รับเหมาเลือกได้เฉพาะช่วงของงานเดียวกัน)
  const blockOf = (j, d) => blocked.get(`${j._id}|${d}`) || (d === day ? dayLocks.get(String(j._id)) : "") || (canPick ? canPick(j, sel) : "") || "";
  const isLocked = (j) => lockedIds.some((id) => String(id) === String(j._id));
  // ข้อมูลล็อกเพิ่มของวันที่เลือก (เช่น ช่วงงานที่มีใบ Advance แล้ว) — ดึงทีละวันตอนเปลี่ยนวัน
  useEffect(() => {
    if (!open || !loadDayLocks) { setDayLocks(new Map()); return undefined; }
    let alive = true;
    Promise.resolve(loadDayLocks(day)).then((m) => { if (alive) setDayLocks(m instanceof Map ? m : new Map()); }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ดึงใหม่เมื่อเปลี่ยนวัน/เปิดกล่อง
  }, [open, day]);

  useEffect(() => {
    if (!open) return undefined;
    setMonth(moment(date || today).startOf("month"));
    setDay(date || today);
    setQ("");
    setSel((jobs || []).filter((j) => j?._id));
    setSheet(false);
    setError("");
    let alive = true;
    EventService.getEventOp({ slim: true })
      .then((r) => {
        if (!alive) return;
        const list = (r?.userEvents || r?.events || []).filter((e) => e?.start && !e.unscheduled && e.department !== "sales");
        setEvents(list.map(toJob));
      })
      .catch(() => { if (alive) { setEvents((cur) => cur || []); setError("โหลดงานไม่สำเร็จ — ลองปิดแล้วเปิดใหม่"); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- โหลดใหม่ทุกครั้งที่เปิด (ข้อมูลสด)
  }, [open]);

  const visible = useMemo(() => (techOnly ? (events || []).filter(isMine) : events || []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isMine ขึ้นกับ myId/myName เท่านั้น
    [events, techOnly, myId, myName]);
  /** วันที่ → งานในวันนั้น (งานที่มีชื่อตัวเองก่อน แล้วเรียงตามเวลาเริ่ม) */
  const byDay = useMemo(() => {
    const m = new Map();
    visible.forEach((j) => jobDays(j).forEach((d) => { if (!m.has(d)) m.set(d, []); m.get(d).push(j); }));
    m.forEach((list) => list.sort((a, b) => (Number(isMine(b)) - Number(isMine(a))) || (new Date(a.start) - new Date(b.start))));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isMine ขึ้นกับ myId/myName เท่านั้น
  }, [visible, myId, myName]);

  const cells = useMemo(() => {
    const first = month.clone().startOf("month").startOf("week");
    return Array.from({ length: 42 }, (_, i) => first.clone().add(i, "day"));
  }, [month]);
  const marked = useMemo(() => new Set(markedDates), [markedDates]);
  const rest = restDaysOf(cfg);

  const needle = q.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!needle) return [];
    const ref = moment(day).valueOf();
    return visible
      .filter((j) => [labelOf(j), j.company, j.site, j.title, j.system].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle)))
      .sort((a, b) => Math.abs(new Date(a.start) - ref) - Math.abs(new Date(b.start) - ref))
      .slice(0, 60);
  }, [visible, needle, day]);
  const dayJobs = byDay.get(day) || [];
  const list = needle ? searchResults : dayJobs;

  const isSel = (j) => sel.some((x) => x._id === j._id);
  /** เปลี่ยนวัน = งานที่เลือกไว้เหลือเฉพาะที่มีในวันใหม่ (OT 1 รายการ = 1 วัน) */
  const pickDay = (d) => {
    setDay(d);
    setQ("");
    if (moment(d).month() !== month.month() || moment(d).year() !== month.year()) setMonth(moment(d).startOf("month"));
    if (dayMode) setSel((cur) => cur.filter((j) => covers(j, d)));
  };
  const toggle = (j) => {
    if (isSel(j)) { if (!isLocked(j)) setSel((cur) => cur.filter((x) => x._id !== j._id)); return; }
    if ((!needle || !dayMode) && blockOf(j, day)) return; // งาน+วันนี้ลงรายการอื่นแล้ว / ล็อกด้วยเหตุผลอื่น
    if (!dayMode && max === 1) { setSel([j]); return; } // เลือกได้งานเดียว = แตะงานใหม่แทนงานเดิม
    if (sel.length >= max) return;
    if (!dayMode) { setSel((cur) => [...cur, j]); return; }
    if (!covers(j, day)) {
      // งานจากผลค้นหาที่ไม่มีในวันที่เลือก → ไปวันของงานนั้นที่ใกล้วันที่เลือกที่สุด
      const ref = moment(day);
      const near = jobDays(j).reduce((a, d) => (Math.abs(moment(d).diff(ref)) < Math.abs(moment(a).diff(ref)) ? d : a));
      pickDay(near);
      if (!blockOf(j, near)) setSel((cur) => [...cur.filter((x) => covers(x, near)), j]);
      return;
    }
    setSel((cur) => [...cur, j]);
  };
  const confirm = () => onPick?.(dayMode ? { date: day, jobs: sel } : { jobs: sel });
  const dayKind = (d) => {
    const h = holidays?.get?.(d);
    if (h) return { color: HOLIDAY, label: h.name };
    if (rest.includes(moment(d).day())) return { color: REST, label: "วันหยุดประจำสัปดาห์" };
    return null;
  };
  const selKind = dayKind(day);

  /* ── ปฏิทิน ── */
  const calendar = (
    <Box sx={{ p: { xs: 1.5, sm: 2 }, borderRight: { md: `1px solid ${BORDER_MAIN}` }, borderBottom: { xs: `1px solid ${BORDER_MAIN}`, md: 0 } }}>
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1.25 }}>
        <IconButton size="small" onClick={() => setMonth((m) => m.clone().subtract(1, "month"))} aria-label="เดือนก่อน"><ChevronLeftRounded /></IconButton>
        <Typography sx={{ flex: 1, textAlign: "center", fontWeight: 900, fontSize: "1rem", color: TEXT_MAIN }}>
          {MONTH_TH[month.month()]} {month.year() + 543}
        </Typography>
        <IconButton size="small" onClick={() => setMonth((m) => m.clone().add(1, "month"))} aria-label="เดือนถัดไป"><ChevronRightRounded /></IconButton>
        <Button size="small" onClick={() => pickDay(today)}
          sx={{ textTransform: "none", fontWeight: 800, color: OT_DARK, minWidth: 0, px: 1, borderRadius: 2, bgcolor: alpha(OT_ACCENT, 0.08) }}>
          วันนี้
        </Button>
      </Stack>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 0.5 }}>
        {DOW.map((d, i) => (
          <Typography key={d} sx={{ textAlign: "center", fontSize: "0.7rem", fontWeight: 800, color: rest.includes(i) ? REST : TEXT_SUB, pb: 0.25 }}>{d}</Typography>
        ))}
        {cells.map((m) => {
          const d = m.format("YYYY-MM-DD");
          const inMonth = m.month() === month.month();
          const jobs = byDay.get(d) || [];
          const sel = d === day && !needle;
          const kind = dayKind(d);
          const isToday = d === today;
          const tip = [kind?.label, jobs.length ? `${jobs.length} งาน` : "", marked.has(d) ? "ลง OT ในใบนี้แล้ว" : ""].filter(Boolean).join(" · ");
          return (
            <Tooltip key={d} title={tip} disableInteractive enterDelay={400}>
              <ButtonBase onClick={() => { pickDay(d); if (isMobile) setSheet(true); }}
                aria-label={`${thaiDate(d)}${jobs.length ? ` มี ${jobs.length} งาน` : ""}`} aria-pressed={sel}
                sx={{
                  position: "relative", flexDirection: "column", justifyContent: "flex-start", gap: 0.4, height: { xs: 50, sm: 56 }, pt: 0.6,
                  borderRadius: 2, fontFamily: "inherit", opacity: inMonth ? 1 : 0.38,
                  bgcolor: sel ? OT_ACCENT : jobs.length ? "#fff" : "transparent",
                  border: `1px solid ${sel ? OT_ACCENT : isToday ? alpha(OT_ACCENT, 0.6) : jobs.length ? BORDER_MAIN : "transparent"}`,
                  boxShadow: sel ? `0 4px 12px ${alpha(OT_ACCENT, 0.35)}` : "none",
                  transition: "background-color .12s, box-shadow .12s",
                  "&:hover": { bgcolor: sel ? OT_DARK : alpha(OT_ACCENT, 0.07) },
                }}>
                <Typography component="span" sx={{ fontSize: "0.86rem", fontWeight: isToday || sel ? 900 : 700, lineHeight: 1, color: sel ? "#fff" : kind ? kind.color : TEXT_MAIN }}>
                  {m.date()}
                </Typography>
                {jobs.length > 0 && (
                  <Stack direction="row" spacing={0.3} alignItems="center">
                    {jobs.slice(0, 3).map((j) => (
                      <Box key={j._id} sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: sel ? "#fff" : OT_ACCENT }} />
                    ))}
                    {jobs.length > 3 && <Typography component="span" sx={{ fontSize: "0.6rem", fontWeight: 800, lineHeight: 1, color: sel ? "#fff" : TEXT_SUB }}>+{jobs.length - 3}</Typography>}
                  </Stack>
                )}
                {marked.has(d) && (
                  <Box component="span" sx={{ position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)", px: 0.5, borderRadius: 1, fontSize: "0.52rem", fontWeight: 900, lineHeight: "12px",
                    bgcolor: sel ? "#fff" : alpha(OT_ACCENT, 0.12), color: OT_DARK }}>OT</Box>
                )}
              </ButtonBase>
            </Tooltip>
          );
        })}
      </Box>
      <Stack direction="row" spacing={1.5} useFlexGap sx={{ mt: 1.25, flexWrap: "wrap", rowGap: 0.5 }}>
        {[
          [<Stack key="d" direction="row" spacing={0.3}>{[0, 1].map((c) => <Box key={c} sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: OT_ACCENT }} />)}</Stack>, "จุด = จำนวนงานในวันนั้น"],
          ...(dayMode ? [[<Box key="o" component="span" sx={{ px: 0.5, borderRadius: 1, fontSize: "0.52rem", fontWeight: 900, lineHeight: "12px", bgcolor: alpha(OT_ACCENT, 0.12), color: OT_DARK }}>OT</Box>, "ลงในใบนี้แล้ว"]] : []),
          [<Box key="h" sx={{ width: 8, height: 8, borderRadius: 0.5, bgcolor: HOLIDAY }} />, "วันหยุดนักขัตฤกษ์"],
        ].map(([icon, text]) => (
          <Stack key={text} direction="row" spacing={0.6} alignItems="center">
            {icon}
            <Typography sx={{ fontSize: "0.68rem", color: TEXT_SUB }}>{text}</Typography>
          </Stack>
        ))}
      </Stack>
      {isMobile && (
        <Button fullWidth variant="outlined" onClick={() => setSheet(true)} endIcon={<ChevronRightRounded />}
          sx={{ mt: 1.5, height: 46, justifyContent: "space-between", textTransform: "none", fontWeight: 800, borderRadius: 2.5, color: OT_DARK, borderColor: alpha(OT_ACCENT, 0.5) }}>
          งานวันที่ {moment(day).date()} {thaiDate(day).split(" ")[1]} ({(byDay.get(day) || []).length} งาน)
        </Button>
      )}
    </Box>
  );

  /* ── งานของวันที่เลือก / ผลค้นหา ── */
  const jobList = (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0, height: "100%", bgcolor: SOFT }}>
      <Box sx={{ p: { xs: 1.5, sm: 2 }, pb: 1.25, bgcolor: "#fff", borderBottom: `1px solid ${BORDER_MAIN}` }}>
        {isMobile && (
          <Button size="small" startIcon={<ChevronLeftRounded />} onClick={() => setSheet(false)}
            sx={{ mb: 0.75, ml: -0.75, textTransform: "none", fontWeight: 800, color: OT_DARK }}>
            ปฏิทิน (เลือกวันอื่น)
          </Button>
        )}
        {needle ? (
          <Typography sx={{ fontWeight: 900, fontSize: "0.98rem", color: TEXT_MAIN }}>ผลการค้นหา “{q.trim()}” ({searchResults.length})</Typography>
        ) : (
          <>
            <Typography sx={{ fontWeight: 900, fontSize: "0.98rem", color: TEXT_MAIN }}>
              วัน{DAY_TH[moment(day).day()]}ที่ {thaiDate(day)}
            </Typography>
            <Typography sx={{ fontSize: "0.76rem", color: selKind ? selKind.color : TEXT_SUB, fontWeight: selKind ? 700 : 400 }}>
              {selKind ? `${selKind.label} · ` : ""}{events === null ? "กำลังโหลดงาน…" : dayJobs.length ? `มี ${dayJobs.length} งาน${techOnly ? "ที่คุณมีชื่อ" : ""} — แตะเพื่อเลือก · ${isMobile ? "กดค้าง" : "คลิกขวา"} = ดูรายละเอียดงาน` : techOnly ? "ไม่มีงานที่คุณมีชื่อในวันนี้" : "ไม่มีงานในวันนี้"}
            </Typography>
          </>
        )}
        <TextField size="small" fullWidth value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหางานวันอื่น: โครงการ / บริษัท / ระบบ"
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded sx={{ fontSize: 18, color: "#94a3b8" }} /></InputAdornment> }}
          sx={{ mt: 1.25, "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: SOFT } }} />
      </Box>
      <Box sx={{ flex: 1, overflowY: "auto", p: { xs: 1.25, sm: 1.5 }, minHeight: 0 }}>
        {error && <Typography sx={{ p: 1, fontSize: "0.8rem", color: HOLIDAY }}>{error}</Typography>}
        {events === null ? (
          <Stack alignItems="center" sx={{ py: 5 }}><CircularProgress size={26} sx={{ color: OT_ACCENT }} /></Stack>
        ) : list.length === 0 ? (
          <Stack alignItems="center" spacing={1} sx={{ py: 5, px: 2, textAlign: "center" }}>
            <EventBusyRounded sx={{ fontSize: 36, color: "#cbd5e1" }} />
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: TEXT_SUB }}>{needle ? "ไม่พบงานที่ค้นหา" : "วันนี้ไม่มีงานของคุณ"}</Typography>
            <Typography sx={{ fontSize: "0.76rem", color: "#94a3b8" }}>เลือกวันที่มีจุดในปฏิทิน หรือพิมพ์ชื่อโครงการเพื่อค้นหา</Typography>
          </Stack>
        ) : (
          <Stack spacing={1}>
            {list.map((j) => {
              const on = isSel(j);
              const lock = !on && (!needle || !dayMode) ? blockOf(j, day) : "";
              const workers = workersOf(j);
              const mine = isMine(j);
              return (
                <ButtonBase key={j._id} onClick={() => toggle(j)} onContextMenu={(ev) => { ev.preventDefault(); setPeekId(j._id); }}
                  title="คลิกขวา = ดูรายละเอียดงาน" aria-pressed={on} aria-disabled={Boolean(lock)} sx={{
                  display: "flex", alignItems: "stretch", textAlign: "left", width: "100%", borderRadius: 2.5, overflow: "hidden", fontFamily: "inherit",
                  bgcolor: lock ? "#f8fafc" : "#fff", border: `1.5px solid ${on ? OT_ACCENT : BORDER_MAIN}`, boxShadow: on ? `0 0 0 3px ${alpha(OT_ACCENT, 0.15)}` : "0 1px 2px rgba(15,23,42,.04)",
                  cursor: lock ? "not-allowed" : "pointer", transition: "border-color .12s, box-shadow .12s",
                  ...(!lock && { "&:hover": { borderColor: OT_ACCENT, boxShadow: `0 4px 14px ${alpha(OT_ACCENT, 0.15)}` } }),
                }}>
                  <Box sx={{ flex: 1, minWidth: 0, px: 1.5, py: 1.2, opacity: lock ? 0.75 : 1 }}>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.4, minWidth: 0 }}>
                      <JobTypeChip job={j} />
                      <Typography noWrap sx={{ fontSize: "0.72rem", color: TEXT_SUB, fontWeight: 600, minWidth: 0 }}>
                        {needle || !dayMode ? jobRangeText(j) : (dayOfJobText(j, day) || `${thaiDate(day)} · 1 วัน`)}
                      </Typography>
                      {mine && !techOnly && (
                        <Box component="span" sx={{ flexShrink: 0, px: 0.6, borderRadius: 1, fontSize: "0.62rem", fontWeight: 800, lineHeight: "17px", bgcolor: alpha(OT_ACCENT, 0.1), color: OT_DARK }}>คุณอยู่ในงาน</Box>
                      )}
                    </Stack>
                    <Typography sx={{ fontSize: "0.9rem", fontWeight: 800, color: TEXT_MAIN, lineHeight: 1.4 }}>{withoutType(j)}</Typography>
                    {(j.company || j.status) && (
                      <Typography noWrap sx={{ fontSize: "0.74rem", color: TEXT_SUB, mt: 0.2 }}>{[j.company, j.status].filter(Boolean).join(" · ")}</Typography>
                    )}
                    {/* ผู้ปฏิบัติงานทั้งหมด — รูป + ชื่อ */}
                    {workers.length > 0 && (
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.9, pt: 0.9, borderTop: `1px dashed ${BORDER_MAIN}`, minWidth: 0 }}>
                        <Stack direction="row" sx={{ flexShrink: 0, "& > *:not(:first-of-type)": { ml: "-7px" } }}>
                          {workers.slice(0, 5).map((w) => {
                            const u = userOf(w);
                            const src = u?.imageUrl && /^https?:/i.test(u.imageUrl) ? u.imageUrl : undefined;
                            return (
                              <Tooltip key={w.userId || w.name} title={`${w.name}${w.lead ? " (หัวหน้าทีม)" : ""}`}>
                                <Avatar src={src} sx={{ width: 24, height: 24, fontSize: "0.68rem", fontWeight: 800, border: "2px solid #fff", bgcolor: personColor(w.name) }}>{personInitial(w.name)}</Avatar>
                              </Tooltip>
                            );
                          })}
                          {workers.length > 5 && <Avatar sx={{ width: 24, height: 24, fontSize: "0.62rem", fontWeight: 800, border: "2px solid #fff", bgcolor: "#e2e8f0", color: TEXT_SUB }}>+{workers.length - 5}</Avatar>}
                        </Stack>
                        <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB, minWidth: 0, lineHeight: 1.4 }}>
                          {workers.map((w, k) => {
                            const me = (myId && w.userId === myId) || (myName && w.name === myName);
                            return (
                              <Box key={w.userId || w.name} component="span" sx={{ fontWeight: me ? 800 : w.lead ? 700 : 500, color: me ? OT_DARK : w.lead ? TEXT_MAIN : TEXT_SUB }}>
                                {k ? ", " : ""}{w.name}{me ? " (คุณ)" : ""}
                              </Box>
                            );
                          })}
                        </Typography>
                      </Stack>
                    )}
                    {lock && (
                      <Stack direction="row" spacing={0.6} alignItems="flex-start" sx={{ mt: 0.9, px: 1, py: 0.6, borderRadius: 1.5, bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}` }}>
                        <LockRounded sx={{ fontSize: 14, color: TEXT_SUB, mt: "2px" }} />
                        <Typography sx={{ fontSize: "0.72rem", color: TEXT_MAIN, lineHeight: 1.45 }}>
                          <b>{lock}</b>{dayMode ? ` — 1 งานเบิก OT ได้วันละ 1 รายการ${lock.startsWith("อยู่ใน") ? " · ถ้าจะเลือกใหม่ ให้ลบรายการนั้นก่อน" : ""}` : ""}
                        </Typography>
                      </Stack>
                    )}
                  </Box>
                  <Stack justifyContent="center" sx={{ pr: 1.25, flexShrink: 0 }}>
                    {lock ? <LockRounded sx={{ color: "#cbd5e1", fontSize: 22 }} />
                      : on ? <CheckCircleRounded sx={{ color: OT_ACCENT, fontSize: 26 }} /> : <RadioButtonUncheckedRounded sx={{ color: "#cbd5e1", fontSize: 26 }} />}
                  </Stack>
                </ButtonBase>
              );
            })}
          </Stack>
        )}
      </Box>
    </Box>
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" fullScreen={isMobile}
      PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3.5, overflow: "hidden", height: isMobile ? "100%" : "min(640px, calc(100vh - 64px))" } }}>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: { xs: 1.75, sm: 2.25 }, py: 1.25, borderBottom: `1px solid ${BORDER_MAIN}`, flexShrink: 0 }}>
        <Box sx={{ width: 34, height: 34, borderRadius: 2.25, bgcolor: alpha(OT_ACCENT, 0.12), color: OT_DARK, display: "grid", placeItems: "center", flexShrink: 0 }}>
          <CalendarMonthRounded sx={{ fontSize: 20 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900, fontSize: "1rem", color: TEXT_MAIN, lineHeight: 1.3 }}>{title}</Typography>
          <Typography noWrap sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>{subtitle || (dayMode ? "แตะวันในปฏิทิน → แตะงาน (ได้หลายงาน) → ตกลง" : "แตะวันในปฏิทินเพื่อหางาน → แตะงานที่ต้องการ (ได้หลายงาน จากหลายวัน) → ตกลง")}</Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="ปิด"><CloseRounded /></IconButton>
      </Stack>
      {isMobile ? (
        <Box sx={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>
          <Box sx={{ height: "100%", overflowY: "auto" }}>{calendar}</Box>
          <Slide direction="up" in={sheet} mountOnEnter unmountOnExit>
            <Box sx={{ position: "absolute", inset: 0, zIndex: 2, boxShadow: "0 -8px 24px rgba(15,23,42,.12)" }}>{jobList}</Box>
          </Slide>
        </Box>
      ) : (
      <Box sx={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 1fr)", overflow: "hidden" }}>
        {calendar}
        {jobList}
      </Box>
      )}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ px: { xs: 1.75, sm: 2.25 }, py: 1.1, borderTop: `1px solid ${BORDER_MAIN}`, flexShrink: 0, bgcolor: "#fff" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.74rem", fontWeight: 800, color: sel.length ? OT_DARK : TEXT_SUB }}>
            {sel.length ? `เลือกแล้ว ${sel.length} งาน` : "ยังไม่ได้เลือกงาน"}
          </Typography>
          {sel.length > 0 && (
            <Stack direction="row" spacing={0.5} useFlexGap sx={{ mt: 0.4, display: { xs: "none", sm: "flex" }, flexWrap: "wrap", rowGap: 0.4, maxHeight: 54, overflowY: "auto" }}>
              {sel.map((j) => (
                <Box key={j._id} component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, maxWidth: 260, pl: 0.5, pr: 0.25, py: 0.15, borderRadius: 1.5, bgcolor: alpha(OT_ACCENT, 0.08), border: `1px solid ${alpha(OT_ACCENT, 0.25)}` }}>
                  {j.title && <JobTypeChip job={j} sx={{ height: 16, fontSize: "0.6rem", px: 0.5 }} />}
                  <Typography component="span" noWrap sx={{ fontSize: "0.72rem", fontWeight: 700, color: TEXT_MAIN, minWidth: 0 }}>{withoutType(j)}</Typography>
                  {!isLocked(j) && <IconButton size="small" onClick={() => toggle(j)} aria-label="เอาออก" sx={{ p: 0.15 }}><CloseRounded sx={{ fontSize: 13 }} /></IconButton>}
                </Box>
              ))}
            </Stack>
          )}
        </Box>
        <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ flexShrink: 0 }}>
          <Button onClick={onClose} sx={{ display: { xs: "none", sm: "inline-flex" }, textTransform: "none", color: TEXT_SUB, fontWeight: 700 }}>ยกเลิก</Button>
          <Button variant="contained" disableElevation onClick={confirm} startIcon={<CheckRounded />}
            sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, px: 2, whiteSpace: "nowrap", bgcolor: OT_ACCENT, "&:hover": { bgcolor: OT_DARK } }}>
            {dayMode
              ? (sel.length ? `ตกลง · ${sel.length} งาน · ${moment(day).date()} ${thaiDate(day).split(" ")[1]}` : `ใช้วันที่ ${moment(day).date()} ${thaiDate(day).split(" ")[1]}`)
              : (sel.length ? `ตกลง · ${sel.length} งาน` : "ไม่ผูกงาน")}
          </Button>
        </Stack>
      </Stack>
      {peekId && <JobQuickView eventId={peekId} onClose={() => setPeekId(null)} zIndex={1400} />}
    </Dialog>
  );
}

/**
 * JobPickCard — ช่อง "ผูกกับงาน" ในฟอร์ม (กดแล้วเปิดปฏิทิน) · หน้าตาเดียวกับการ์ดเลือกงานในฟอร์ม OT
 * ยังไม่เลือก = กรอบเส้นประ + ปุ่มทึบ "เลือกงาน" · เลือกแล้ว = ตารางงาน (ป้ายประเภท | ชื่องาน | ช่วงวัน) + ปุ่ม "เปลี่ยน / เพิ่มงาน"
 */
export function JobPickCard({ jobs = [], onClick, label = "ผูกกับงาน", required = false, error = false, helperText, accent = DEF_ACCENT, accentDark = DEF_DARK,
  emptyText = "ยังไม่ได้ผูกงาน — กดเพื่อเลือกจากปฏิทิน", disabled = false, sideText, badge, sx }) {
  const has = jobs.length > 0;
  return (
    <Box sx={sx}>
      <ButtonBase onClick={onClick} disabled={disabled} aria-label={label}
        sx={{
          display: "flex", alignItems: "stretch", textAlign: "left", width: "100%", borderRadius: 2.5, overflow: "hidden", fontFamily: "inherit",
          border: `1.5px ${has ? "solid" : "dashed"} ${error ? "#f87171" : has ? alpha(accent, 0.45) : accent}`,
          bgcolor: has ? "#fff" : alpha(accent, 0.04), opacity: disabled ? 0.85 : 1,
          transition: "border-color .12s, box-shadow .12s, background-color .12s",
          ...(!disabled && { "&:hover": { borderColor: accent, bgcolor: has ? "#fff" : alpha(accent, 0.08), boxShadow: `0 4px 14px ${alpha(accent, 0.15)}` }, "&:hover .pick-cta": { bgcolor: accentDark, color: "#fff" } }),
        }}>
        <Box sx={{ flex: 1, minWidth: 0, px: 1.5, py: 1.1 }}>
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, color: error ? "#dc2626" : TEXT_SUB, mb: 0.5 }}>
            {label}{required ? " *" : ""}{jobs.length > 1 ? ` · ${jobs.length} งาน` : ""}{badge ? <Box component="span" sx={{ ml: 0.75 }}>{badge}</Box> : null}
          </Typography>
          {has ? (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "auto minmax(0, 1fr)", sm: "auto minmax(0, 1fr) auto" }, columnGap: 1, rowGap: 0.6, alignItems: "center" }}>
              {jobs.slice(0, jobs.length > 5 ? 4 : 5).map((j, i) => (
                <Box key={j._id || i} sx={{ display: "contents" }}>
                  <Box sx={{ display: "flex" }}>{j.title ? <JobTypeChip job={j} sx={{ minWidth: 72, justifyContent: "center" }} /> : <Box sx={{ width: 72 }} />}</Box>
                  <Typography noWrap sx={{ fontSize: "0.86rem", fontWeight: 800, color: TEXT_MAIN, minWidth: 0 }}>{withoutType(j)}</Typography>
                  <Typography noWrap sx={{ display: { xs: "none", sm: "block" }, fontSize: "0.72rem", color: TEXT_SUB, textAlign: "right" }}>
                    {sideText ? sideText(j, i) : j.start ? jobRangeText(j) : ""}
                  </Typography>
                </Box>
              ))}
              {jobs.length > 5 && <Typography sx={{ gridColumn: "1 / -1", fontSize: "0.74rem", color: TEXT_SUB, fontWeight: 700 }}>+ อีก {jobs.length - 4} งาน</Typography>}
            </Box>
          ) : (
            <Typography sx={{ fontSize: "0.88rem", fontWeight: 800, color: error ? "#dc2626" : accentDark }}>{emptyText}</Typography>
          )}
        </Box>
        {!disabled && (
          <Stack justifyContent="center" sx={{ pr: 1.25, pl: 0.5, flexShrink: 0 }}>
            <Box className="pick-cta" component="span" sx={{
              display: "inline-flex", alignItems: "center", gap: 0.6, px: { xs: 1, sm: 1.4 }, height: 36, borderRadius: 2, fontSize: "0.82rem", fontWeight: 800, whiteSpace: "nowrap",
              transition: "background-color .12s, color .12s",
              ...(has ? { color: accentDark, border: `1.5px solid ${alpha(accent, 0.5)}`, bgcolor: "#fff" } : { color: "#fff", bgcolor: accent, boxShadow: `0 2px 8px ${alpha(accent, 0.35)}` }),
            }}>
              <EditCalendarRounded sx={{ fontSize: 19 }} />
              <Box component="span" sx={{ display: { xs: has ? "none" : "inline", sm: "inline" } }}>{has ? "เปลี่ยน / เพิ่มงาน" : "เลือกงาน"}</Box>
            </Box>
          </Stack>
        )}
      </ButtonBase>
      {helperText && <Typography sx={{ mt: 0.5, px: 0.5, fontSize: "0.72rem", color: error ? "#dc2626" : TEXT_SUB, lineHeight: 1.45 }}>{helperText}</Typography>}
    </Box>
  );
}

/** รายชื่อผู้ใช้ (รูปโปรไฟล์) สำหรับแถวผู้ปฏิบัติงาน — แคชครั้งเดียวต่อการเปิดแอป */
export function useUserDirectory(active = true) {
  const [users, setUsers] = useState([]);
  useEffect(() => { if (active) loadUsers().then(setUsers); }, [active]);
  return users;
}

/**
 * แถวผู้ปฏิบัติงานของงาน — รูป (ซ้อนกัน) + ชื่อทุกคน · หัวหน้าทีมตัวเข้ม · ตัวเอง = "(คุณ)"
 * ใช้ร่วมกับการ์ดงานในหน้าปฏิทินแบบรายวัน (EventSplitView)
 */
export function WorkersRow({ job, users = [], myId = "", myName = "", accentDark = DEF_DARK, sx }) {
  const workers = workersOf(job);
  if (!workers.length) return null;
  const userOf = (w) => users.find((u) => (w.userId && String(u._id) === w.userId) || (!w.userId && w.name && String(u.fname || "").trim() === w.name));
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, ...sx }}>
      <Stack direction="row" sx={{ flexShrink: 0, "& > *:not(:first-of-type)": { ml: "-7px" } }}>
        {workers.slice(0, 5).map((w) => {
          const u = userOf(w);
          const src = u?.imageUrl && /^https?:/i.test(u.imageUrl) ? u.imageUrl : undefined;
          return (
            <Tooltip key={w.userId || w.name} title={`${w.name}${w.lead ? " (หัวหน้าทีม)" : ""}`}>
              <Avatar src={src} sx={{ width: 24, height: 24, fontSize: "0.68rem", fontWeight: 800, border: "2px solid #fff", bgcolor: personColor(w.name) }}>{personInitial(w.name)}</Avatar>
            </Tooltip>
          );
        })}
        {workers.length > 5 && <Avatar sx={{ width: 24, height: 24, fontSize: "0.62rem", fontWeight: 800, border: "2px solid #fff", bgcolor: "#e2e8f0", color: TEXT_SUB }}>+{workers.length - 5}</Avatar>}
      </Stack>
      <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB, minWidth: 0, lineHeight: 1.4 }}>
        {workers.map((w, k) => {
          const me = (myId && w.userId === myId) || (myName && w.name === myName);
          return (
            <Box key={w.userId || w.name} component="span" sx={{ fontWeight: me ? 800 : w.lead ? 700 : 500, color: me ? accentDark : w.lead ? TEXT_MAIN : TEXT_SUB }}>
              {k ? ", " : ""}{w.name}{me ? " (คุณ)" : ""}
            </Box>
          );
        })}
      </Typography>
    </Stack>
  );
}
