/**
 * TeamWorkload.js — "ภาพรวมทีมช่าง" (เฉพาะแอดมิน/manager)
 *
 * จุดที่ขาดอยู่เดิม: มีแค่ "งานรวมทุกคนปนกัน" (Operation) กับ "งานของช่างคนเดียว" (MyJobs)
 * ไม่มีมุมมองระหว่างกลาง — ผู้จัดการเปิดดูไม่ได้เลยว่าช่างแต่ละคนมีงานค้าง/งานที่ต้องทำกี่งาน
 * โดยไม่ต้องไล่กรองเองทีละคนในหน้า Operation หน้านี้จึงสรุปให้เห็นทุกคนพร้อมกันในหน้าเดียว
 * แยกเป็นการ์ดต่อคนชัดเจน + สรุปภาพรวมทีมทั้งหมดไว้ด้านบน
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import {
  Box, Stack, Typography, TextField, InputAdornment, IconButton,
  Chip, Skeleton, Avatar, Tooltip, ToggleButton, ToggleButtonGroup,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Search, Clear, Refresh, Groups, PendingActions, Warning, CheckCircle,
  HourglassTop, CalendarMonth, ArrowForwardIos, RequestQuote, Timer, EventAvailable,
} from "@mui/icons-material";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import EventService from "@/shared/services/EventService";
import AuthService from "@/shared/services/authService";

const WARNING_DAYS_AFTER_END = 7;   // เกณฑ์เดียวกับหน้า Operation/งานของฉัน — เลยกำหนด 1 สัปดาห์ = ค้างงาน
const SEVERE_DAYS_AFTER_END = 14;

// ✅ ลายเซ็นเดียวกับที่ใช้จัดกลุ่มงานหลายวันไม่ติดกันทั้งฝั่ง Operation/Dashboard/backend reminder
const getGroupKey = (ev) => {
  if (ev.jobGroupId) return `gid:${ev.jobGroupId}`;
  return ["company", "site", "title", "system", "team", "time"]
    .map((k) => (ev[k] || "").toString().trim().toLowerCase())
    .join("|");
};

// ✅ เพดานความยาวงาน 1 ครั้งที่ยอมรับว่า "เป็นไปได้จริง" — ใช้คัดข้อมูลเสียออกจากค่าเฉลี่ย
// ⚠️ จำเป็นจริงๆ เพราะเคสที่เจอบ่อยที่สุดคือช่างลืมกดออก แล้วไปกดตอนเช้าวันรุ่งขึ้น ได้ระยะเวลา
// 15-20 ชม. ต่อครั้ง ซึ่งถ้าปล่อยเข้าค่าเฉลี่ยแค่ไม่กี่รายการก็ทำให้ตัวเลขทั้งคนเพี้ยนจนใช้ตัดสินใจไม่ได้
// ⚠️ 14 ชม. เป็นเส้นแบ่งที่เลือกเอง ไม่ใช่ค่าที่ถูกต้องทางทฤษฎี — งานติดตั้งยาวจริงๆ ที่เกินนี้จะถูก
// ตัดทิ้งไปด้วย ยอมแลกเพราะ "ค่าเฉลี่ยที่เชื่อถือได้จากข้อมูลส่วนใหญ่" มีประโยชน์กว่า "ค่าเฉลี่ยที่รวม
// ทุกอย่างแต่เพี้ยน" — จำนวนครั้งที่นับได้จริงแสดงคู่กันไว้เสมอ จะได้รู้ว่าเฉลี่ยจากกี่ครั้ง
const MAX_PLAUSIBLE_SESSION_HOURS = 14;

const formatDuration = (ms) => {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} นาที`;
  return m === 0 ? `${h} ชม.` : `${h} ชม. ${m} นาที`;
};

const SORT_OPTIONS = [
  { key: "overdue", label: "ค้างงานมากสุด" },
  { key: "active", label: "งานเยอะสุด" },
  { key: "name", label: "ชื่อ ก-ฮ" },
];

export default function TeamWorkload() {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const role = userData?.role?.toLowerCase();
  const isAdminOrManager = ["admin", "manager"].includes(role);

  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("overdue");

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [resEvents, resUsers] = await Promise.all([
        EventService.getEventOp().catch(() => ({ userEvents: [] })),
        AuthService.getAllUserData().catch(() => ({ allUser: [] })),
      ]);
      setEvents(resEvents?.userEvents || []);
      setUsers(resUsers?.allUser || []);
      setLastRefreshed(new Date());
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, []);

  // ✅ จัดกลุ่มงานที่เข้าหลายวันไม่ติดกันให้เป็น "1 งาน" ก่อนคำนวณอะไรทั้งหมด (เทียบ pattern เดียวกับ
  // Operation/Dashboard/backend OverdueReminder) ไม่งั้นงานเดียวที่แบ่งลง 3 วันจะถูกนับเป็น 3 งาน
  const jobGroups = useMemo(() => {
    const map = new Map();
    events.forEach((e) => {
      const key = getGroupKey(e);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    });
    return [...map.values()];
  }, [events]);

  const statsByTech = useMemo(() => {
    const technicians = users.filter((u) => (u.role || "").toLowerCase() === "technician");
    const userById = new Map(users.map((u) => [u._id, u]));
    const userByFname = new Map(users.map((u) => [u.fname, u]));

    // 🐛 BUG ที่แก้ (งานไปนับให้ผิดคน): เดิมไล่หาเจ้าของงานจาก resPerson → team → userId เท่านั้น
    // ไม่รู้จัก "ผู้รับผิดชอบงาน" (responsiblePerson/responsiblePersonId) เลย — ซึ่งเป็นฟิลด์ที่ทั้งระบบ
    // ใช้ตัดสินว่าใครต้องรับผิดชอบงานนี้ (ทั้งการแจ้งเตือน backend, หน้าภาพรวมงาน, หน้าติดตามใบเสนอราคา)
    // ผลคือหน้านี้นับงานเข้าให้ "ทีมที่เข้างาน" แทนที่จะเป็นผู้รับผิดชอบ ตัวเลขจึงไม่ตรงกับหน้าอื่น
    // ✅ ใช้ลำดับเดียวกับ resolveResponsibleUser ฝั่ง backend (services/OverdueReminder.js) เป๊ะๆ:
    // responsiblePersonId → responsiblePerson → resPerson → team → คนที่สร้างงานเอง
    const resolveTech = (sessions) => {
      for (const e of sessions) if (e.responsiblePersonId && userById.has(e.responsiblePersonId)) return userById.get(e.responsiblePersonId);
      for (const e of sessions) if (e.responsiblePerson && userByFname.has(e.responsiblePerson)) return userByFname.get(e.responsiblePerson);
      for (const e of sessions) if (e.resPerson && userById.has(e.resPerson)) return userById.get(e.resPerson);
      for (const e of sessions) if (e.team && userByFname.has(e.team)) return userByFname.get(e.team);
      for (const e of sessions) if (e.userId && userById.has(e.userId)) return userById.get(e.userId);
      return null;
    };

    const map = new Map(technicians.map((t) => [t._id, {
      tech: t, active: 0, pending: 0, overdue: 0, severeOverdue: 0, completedThisMonth: 0,
      // ✅ ข้อมูลเพิ่มที่ช่วยตัดสินใจได้จริง — เดิมมีแค่จำนวนงาน ไม่รู้ว่าค้างนานแค่ไหน/มีงานติดตามค้างไหม
      maxOverdueDays: 0, quotationPending: 0, nextJob: null,
      // ✅ เวลาเช็คอิน/เช็คเอาต์ถูกเก็บทุกงานอยู่แล้วแต่ไม่เคยถูกเอามาใช้เลยทั้งแอป — เก็บเป็นตัวตั้ง
      // (ผลรวม + จำนวน) แล้วค่อยหารตอนแสดงผล จะได้ไม่ต้องกัน หาร 0 หลายที่ และค่าเฉลี่ยถ่วงตาม
      // จำนวนครั้งจริง ไม่ใช่เฉลี่ยของค่าเฉลี่ยรายงานซึ่งให้ผลผิด
      durationMs: 0, durationCount: 0, onTimeCount: 0, checkedInCount: 0,
    }]));

    jobGroups.forEach((sessions) => {
      const tech = resolveTech(sessions);
      if (!tech || (tech.role || "").toLowerCase() !== "technician") return;
      const entry = map.get(tech._id);
      if (!entry) return;

      // ✅ ต้องคำนวณ "ก่อน" ทางแยก allClosed ด้านล่าง — งานที่ปิดแล้วคือกลุ่มที่มีข้อมูลเช็คอิน/
      // เช็คเอาต์ครบที่สุด ถ้าไปวางหลัง early-return ของ allClosed จะไม่ถูกนับเลยสักรายการ
      // ⚠️ วนทีละ session (1 session = การเข้างาน 1 วัน) ไม่ใช่ทีละกลุ่ม — งานที่เข้า 3 วันมีเวลาทำงาน
      // 3 ช่วง ต้องนับครบทั้ง 3 ไม่ใช่นับเป็นงานเดียว
      sessions.forEach((e) => {
        if (e.checkedInAt && e.checkedOutAt) {
          const ms = moment(e.checkedOutAt).diff(moment(e.checkedInAt));
          if (ms > 0 && ms <= MAX_PLAUSIBLE_SESSION_HOURS * 3600 * 1000) {
            entry.durationMs += ms;
            entry.durationCount += 1;
          }
        }
        // ✅ "เข้างานตรงตามแผน" = วันที่เช็คอินจริงไม่เลยวันที่นัดไว้ — เทียบระดับวัน ไม่ใช่ระดับนาที
        // เพราะงานภาคสนามนัดกันเป็นวัน ไม่ได้นัดเป็นเวลาเป๊ะ (งาน allDay ไม่มีเวลาเก็บไว้ด้วยซ้ำ)
        if (e.checkedInAt && e.start) {
          entry.checkedInCount += 1;
          if (moment(e.checkedInAt).startOf("day").isSameOrBefore(moment(e.start).startOf("day"))) {
            entry.onTimeCount += 1;
          }
        }
      });

      const allClosed = sessions.every((e) => e.status === "ดำเนินการเสร็จสิ้น");
      const anyRequested = sessions.some((e) => e.closeRequested && e.status !== "ดำเนินการเสร็จสิ้น");

      if (allClosed) {
        const closedAt = sessions.map((e) => e.closeApprovedAt).filter(Boolean).sort().pop();
        if (closedAt && moment(closedAt).isSame(moment(), "month")) entry.completedThisMonth += 1;
        return;
      }

      if (anyRequested) {
        entry.pending += 1;
        return;
      }

      let lastPlanEnd = null;
      let earliestStart = null;
      sessions.forEach((e) => {
        const end = e.end ? moment(e.end).subtract(e.allDay ? 1 : 0, "days") : moment(e.start);
        if (!lastPlanEnd || end.isAfter(lastPlanEnd)) lastPlanEnd = end;
        const start = moment(e.start);
        if (!earliestStart || start.isBefore(earliestStart)) earliestStart = start;
      });
      const daysPastDue = moment().startOf("day").diff(lastPlanEnd.startOf("day"), "days");
      // ✅ ใช้ > แทน >= — วันที่ครบพอดี 7/14 วันยังไม่ถือว่า "เกิน" (เทียบเกณฑ์เดียวกับ isFlaggedDays/
      // isSevereDays ใน shared/utils/overdueJobs.js)
      const isOverdue = daysPastDue > WARNING_DAYS_AFTER_END;

      // 🐛 BUG ที่แก้ (ตัวเลขรวมกันแล้วเกินจำนวนงานจริง): เดิมนับ entry.active++ ก่อนเสมอ แล้วค่อยไปเช็ค
      // ค้างงานแยกอีกที — งานที่ค้างเกินกำหนดจึงถูกนับทั้งใน "กำลังทำ" และ "ค้างงาน" พร้อมกัน (เห็นได้
      // จากการ์ดที่ขึ้น "3 กำลังทำ" + "4 ค้างงาน" ทั้งที่มีงานจริงไม่ถึง 7) — เทียบกับที่เพิ่งแก้ในหน้า
      // "การดำเนินงาน" ด้วยเหตุผลเดียวกัน: งาน 1 งานต้องอยู่กลุ่มเดียวเท่านั้น "ค้างงาน" เร่งด่วนกว่า
      // จึงให้ครองงานนั้นไว้
      if (isOverdue) {
        entry.overdue += 1;
        if (daysPastDue > SEVERE_DAYS_AFTER_END) entry.severeOverdue += 1;
        // ✅ เก็บ "ค้างนานสุดกี่วัน" ไว้ด้วย — บอกความรุนแรงได้ตรงกว่าจำนวนงานเฉยๆ
        if (daysPastDue > entry.maxOverdueDays) entry.maxOverdueDays = daysPastDue;
      } else if (sessions.some((e) => ["ยืนยันแล้ว", "กำลังดำเนินการ"].includes(e.status))) {
        entry.active += 1;
      }

      // 🐛 BUG ที่แก้ ("งานถัดไป" โชว์วันที่ผ่านมาแล้ว): เดิมเลือกงานที่ start เร็วที่สุดในบรรดางานที่
      // ยังไม่ค้าง — ซึ่งรวมงานที่เริ่มไปแล้ว/เลยวันมาแล้วแต่ยังไม่ถึงเกณฑ์ค้าง (≤7 วัน) ด้วย จึงขึ้นเป็น
      // "งานถัดไป: ... 5 ส.ค." ทั้งที่วันนี้ 10 ส.ค. ไปแล้ว — ต้องนับเฉพาะงานที่ยังมาไม่ถึงจริงๆ
      const today = moment().startOf("day");
      if (!isOverdue && earliestStart.startOf("day").isSameOrAfter(today)) {
        if (!entry.nextJob || earliestStart.isBefore(entry.nextJob.start)) {
          const head = sessions[0];
          entry.nextJob = { start: earliestStart.clone(), title: head.title, company: head.company, site: head.site };
        }
      }

      // ✅ ใบเสนอราคาที่ส่งลูกค้าไปแล้วรอผล — เป็นงานติดตามที่ผู้รับผิดชอบต้องทำต่อ แต่เดิมหน้านี้
      // ไม่แสดงเลย ทั้งที่เป็นภาระงานจริงของช่างคนนั้น (ดูหน้า "ติดตามใบเสนอราคา")
      if (sessions.some((e) => e.quotationStatus === "sent")) entry.quotationPending += 1;
    });

    return [...map.values()];
  }, [users, jobGroups]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const list = keyword
      ? statsByTech.filter((s) => (s.tech.fname || s.tech.username || "").toLowerCase().includes(keyword))
      : statsByTech;
    return list.slice().sort((a, b) => {
      if (sortBy === "overdue") return (b.overdue + b.severeOverdue) - (a.overdue + a.severeOverdue) || b.active - a.active;
      if (sortBy === "active") return b.active - a.active || b.overdue - a.overdue;
      return (a.tech.fname || "").localeCompare(b.tech.fname || "", "th");
    });
  }, [statsByTech, search, sortBy]);

  const teamTotals = useMemo(() => statsByTech.reduce((acc, s) => ({
    active: acc.active + s.active,
    pending: acc.pending + s.pending,
    overdue: acc.overdue + s.overdue,
    completedThisMonth: acc.completedThisMonth + s.completedThisMonth,
    // ✅ รวมเป็นตัวตั้งก่อนแล้วค่อยหารทีเดียว — เฉลี่ยจากค่าเฉลี่ยรายคนจะได้ผลผิด เพราะช่างที่มี
    // 1 ครั้งกับช่างที่มี 50 ครั้งจะถ่วงน้ำหนักเท่ากันทั้งที่ไม่ควรเท่า
    durationMs: acc.durationMs + s.durationMs,
    durationCount: acc.durationCount + s.durationCount,
    onTimeCount: acc.onTimeCount + s.onTimeCount,
    checkedInCount: acc.checkedInCount + s.checkedInCount,
  }), {
    active: 0, pending: 0, overdue: 0, completedThisMonth: 0,
    durationMs: 0, durationCount: 0, onTimeCount: 0, checkedInCount: 0,
  }), [statsByTech]);

  // ✅ กันช่างเปิดหน้านี้ตรงๆ ผ่าน URL — AdminRoute เดิมไม่รองรับ manager จึงเช็ค role เองในนี้แทน
  if (!loading && !isAdminOrManager) return <Navigate to="/dashboard" replace />;

  return (
    <Box sx={{ px: { xs: 1.5, sm: 2 }, pt: 2, pb: 4, maxWidth: 1200, mx: "auto" }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6" fontWeight={800}>ภาพรวมทีมช่าง</Typography>
          <Typography variant="caption" color="text.secondary">
            {lastRefreshed ? `อัปเดตล่าสุด ${moment(lastRefreshed).locale("th").format("HH:mm:ss")}` : "กำลังโหลด..."}
          </Typography>
        </Box>
        <Tooltip title="รีเฟรช">
          <IconButton onClick={() => fetchData()} sx={{ border: "1px solid", borderColor: "divider", borderRadius: "50%", width: 40, height: 40 }}>
            <Refresh sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* สรุปภาพรวมทีมทั้งหมด */}
      <Box sx={{
        // ✅ 6 ช่องบนจอกว้าง · จอเล็กพับเป็น 3x2 — 6 ช่องเรียงเดียวบนมือถือจะแคบจนตัวเลขตกบรรทัด
        display: "grid",
        gridTemplateColumns: { xs: "repeat(3, 1fr)", sm: "repeat(6, 1fr)" },
        gap: 1, mb: 2,
        p: 1.5, borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "background.paper",
      }}>
        {[
          { label: "ช่างทั้งหมด", value: statsByTech.length, color: "#0891b2", icon: <Groups sx={{ fontSize: 16 }} /> },
          { label: "กำลังทำ", value: teamTotals.active, color: "#3b82f6", icon: <PendingActions sx={{ fontSize: 16 }} /> },
          { label: "ค้างงาน", value: teamTotals.overdue, color: "#ef4444", icon: <Warning sx={{ fontSize: 16 }} /> },
          { label: "เสร็จเดือนนี้", value: teamTotals.completedThisMonth, color: "#10b981", icon: <CheckCircle sx={{ fontSize: 16 }} /> },
          // ✅ 2 ช่องใหม่ — คำนวณจากเวลาเช็คอิน/เช็คเอาต์ที่ระบบเก็บมาตลอดแต่ไม่เคยถูกใช้เลย
          // ⚠️ ขึ้น "—" เมื่อยังไม่มีข้อมูลพอ ไม่ใช่ 0 — 0% กับ "ยังไม่มีข้อมูล" คนละความหมายกันคนละเรื่อง
          {
            label: "เวลาเฉลี่ย/ครั้ง",
            value: teamTotals.durationCount > 0 ? formatDuration(teamTotals.durationMs / teamTotals.durationCount) : "—",
            color: "#8b5cf6", icon: <Timer sx={{ fontSize: 16 }} />,
            hint: teamTotals.durationCount > 0
              ? `เฉลี่ยจากการเข้างาน ${teamTotals.durationCount.toLocaleString()} ครั้งที่มีทั้งเวลาเข้าและออก`
              : "ยังไม่มีการเข้างานที่กดทั้งเข้าและออกครบ",
          },
          {
            label: "เข้าตรงตามแผน",
            value: teamTotals.checkedInCount > 0 ? `${Math.round((teamTotals.onTimeCount / teamTotals.checkedInCount) * 100)}%` : "—",
            color: "#0891b2", icon: <EventAvailable sx={{ fontSize: 16 }} />,
            hint: teamTotals.checkedInCount > 0
              ? `เข้างานไม่เลยวันที่นัด ${teamTotals.onTimeCount.toLocaleString()} จาก ${teamTotals.checkedInCount.toLocaleString()} ครั้ง`
              : "ยังไม่มีการเช็คอินที่เทียบกับวันนัดได้",
          },
        ].map((s, i) => (
          // ✅ ช่องที่เป็นค่าเฉลี่ย/เปอร์เซ็นต์ต้องบอกได้ว่า "คิดจากกี่ครั้ง" — 100% จาก 2 ครั้งกับ
          // 100% จาก 200 ครั้ง คนละความหมายกันสิ้นเชิง ตัวเลขลอยๆ ทำให้ตัดสินใจผิดได้ง่ายมาก
          <Tooltip key={i} title={s.hint || ""} arrow disableHoverListener={!s.hint}>
            <Box sx={{ textAlign: "center", cursor: s.hint ? "help" : "default" }}>
              <Box sx={{ color: s.color, mb: 0.25 }}>{s.icon}</Box>
              {loading ? <Skeleton width={28} sx={{ mx: "auto" }} /> : (
                <Typography fontWeight={800} fontSize="1.1rem" sx={{ whiteSpace: "nowrap" }}>{s.value}</Typography>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem" }}>{s.label}</Typography>
            </Box>
          </Tooltip>
        ))}
      </Box>

      <TextField
        fullWidth size="small" placeholder="ค้นหาชื่อช่าง..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 1.5, "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: "background.paper" } }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 19, color: "text.disabled" }} /></InputAdornment>,
          endAdornment: search ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setSearch("")}><Clear sx={{ fontSize: 17 }} /></IconButton>
            </InputAdornment>
          ) : null,
        }}
      />

      <ToggleButtonGroup
        value={sortBy} exclusive size="small"
        onChange={(_, v) => { if (v) setSortBy(v); }}
        sx={{ mb: 2, flexWrap: "wrap" }}
      >
        {SORT_OPTIONS.map((o) => (
          <ToggleButton key={o.key} value={o.key} sx={{ textTransform: "none", fontWeight: 700, px: 1.5, fontSize: "0.75rem" }}>
            {o.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {loading ? (
        <Stack spacing={1.5}>
          {[1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={92} sx={{ borderRadius: 3 }} />)}
        </Stack>
      ) : filtered.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 6, color: "text.disabled" }}>
          <Groups sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
          <Typography variant="body2">{search ? "ไม่พบช่างที่ตรงกับคำค้นหา" : "ยังไม่มีช่างในระบบ"}</Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {filtered.map(({ tech, active, pending, overdue, severeOverdue, completedThisMonth, maxOverdueDays, quotationPending, nextJob, durationMs, durationCount, onTimeCount, checkedInCount }) => (
            <Box
              key={tech._id}
              onClick={() => navigate(`/operation?team=${encodeURIComponent(tech.fname || "")}`)}
              sx={{
                p: 1.75, borderRadius: 3, border: "1px solid", borderColor: "divider",
                bgcolor: "background.paper", cursor: "pointer", transition: "all 0.15s ease",
                "&:hover": { borderColor: "#0891b2", boxShadow: "0 2px 12px rgba(8,145,178,0.12)" },
              }}
            >
              <Stack direction="row" alignItems="center" gap={1.25}>
                <Avatar sx={{ bgcolor: alpha("#0891b2", 0.14), color: "#0891b2", fontWeight: 700 }}>
                  {(tech.fname || tech.username || "?").charAt(0).toUpperCase()}
                </Avatar>
                <Box flex={1} minWidth={0}>
                  <Typography fontWeight={700} fontSize="0.9rem" noWrap>
                    {tech.fname ? `${tech.fname} ${tech.lname || ""}`.trim() : tech.username}
                  </Typography>
                  <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.4 }}>
                    {active > 0 && (
                      <Chip size="small" label={`${active} กำลังทำ`} sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700, bgcolor: alpha("#3b82f6", 0.12), color: "#3b82f6" }} />
                    )}
                    {pending > 0 && (
                      <Chip size="small" icon={<HourglassTop sx={{ fontSize: 12 }} />} label={`${pending} รออนุมัติ`} sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700, bgcolor: alpha("#f59e0b", 0.12), color: "#f59e0b" }} />
                    )}
                    {overdue > 0 && (
                      /* ✅ เพิ่ม "ค้างนานสุดกี่วัน" — บอกความรุนแรงตรงกว่าจำนวนงานเฉยๆ (ค้าง 1 งาน
                         30 วัน เร่งด่วนกว่าค้าง 3 งาน 8 วัน แต่เดิมดูไม่ออกจากตัวเลขอย่างเดียว) */
                      <Chip size="small" icon={<Warning sx={{ fontSize: 12 }} />}
                        label={`${overdue} ค้างงาน${maxOverdueDays > 0 ? ` · นานสุด ${maxOverdueDays} วัน` : ""}${severeOverdue > 0 ? ` (${severeOverdue} เกิน 2 สัปดาห์)` : ""}`}
                        sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700, bgcolor: alpha("#ef4444", 0.12), color: "#ef4444" }} />
                    )}
                    {/* ✅ ใบเสนอราคารอผลลูกค้า — ภาระงานติดตามที่ผู้รับผิดชอบต้องทำต่อ เดิมหน้านี้ไม่แสดงเลย */}
                    {quotationPending > 0 && (
                      <Chip size="small" icon={<RequestQuote sx={{ fontSize: 12 }} />} label={`${quotationPending} ใบเสนอราคารอผล`}
                        sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700, bgcolor: alpha("#8b5cf6", 0.12), color: "#8b5cf6" }} />
                    )}
                    {completedThisMonth > 0 && (
                      <Chip size="small" icon={<CheckCircle sx={{ fontSize: 12 }} />} label={`${completedThisMonth} เสร็จเดือนนี้`} sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700, bgcolor: alpha("#10b981", 0.12), color: "#10b981" }} />
                    )}
                    {active === 0 && pending === 0 && overdue === 0 && completedThisMonth === 0 && quotationPending === 0 && (
                      <Typography variant="caption" color="text.disabled">ไม่มีงานในตอนนี้</Typography>
                    )}
                  </Stack>
                  {/* ✅ สถิติจากเวลาเช็คอิน/เช็คเอาต์ — แยกบรรทัดจากชิปสถานะงานด้านบน เพราะเป็นคนละ
                      เรื่องกัน (ด้านบน = ภาระงานตอนนี้ / ด้านล่าง = พฤติกรรมการทำงานที่ผ่านมา)
                      ⚠️ ต้องมีอย่างน้อย 3 ครั้งถึงจะแสดง — เฉลี่ยจาก 1-2 ครั้งไม่ได้บอกอะไรเลย
                      แต่คนอ่านมักเชื่อทันทีเพราะมันขึ้นเป็นตัวเลขเหมือนกัน */}
                  {(durationCount >= 3 || checkedInCount >= 3) && (
                    <Stack direction="row" gap={1.25} flexWrap="wrap" sx={{ mt: 0.5 }}>
                      {durationCount >= 3 && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                          <Timer sx={{ fontSize: 12 }} />
                          เฉลี่ย {formatDuration(durationMs / durationCount)}/ครั้ง
                          <Box component="span" sx={{ color: "text.disabled" }}>({durationCount} ครั้ง)</Box>
                        </Typography>
                      )}
                      {checkedInCount >= 3 && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                          <EventAvailable sx={{ fontSize: 12 }} />
                          ตรงตามแผน {Math.round((onTimeCount / checkedInCount) * 100)}%
                          <Box component="span" sx={{ color: "text.disabled" }}>({onTimeCount}/{checkedInCount})</Box>
                        </Typography>
                      )}
                    </Stack>
                  )}
                  {nextJob && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.4, mt: 0.5 }}>
                      <CalendarMonth sx={{ fontSize: 12 }} />
                      งานถัดไป: {nextJob.title || "งาน"} · {[nextJob.company, nextJob.site].filter(Boolean).join(" · ")} · {moment(nextJob.start).locale("th").format("D MMM")}
                    </Typography>
                  )}
                </Box>
                <ArrowForwardIos sx={{ fontSize: 13, color: "text.disabled", flexShrink: 0 }} />
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}
