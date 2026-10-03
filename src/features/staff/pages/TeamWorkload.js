/**
 * TeamWorkload.js — "ภาพรวมทีมช่าง" (เฉพาะแอดมิน/manager)
 *
 * จุดที่ขาดอยู่เดิม: มีแค่ "งานรวมทุกคนปนกัน" (Operation) กับ "งานของช่างคนเดียว" (MyJobs)
 * ไม่มีมุมมองระหว่างกลาง — ผู้จัดการเปิดดูไม่ได้เลยว่าช่างแต่ละคนมีงานค้าง/งานที่ต้องทำกี่งาน
 * โดยไม่ต้องไล่กรองเองทีละคนในหน้า Operation หน้านี้จึงสรุปให้เห็นทุกคนพร้อมกันในหน้าเดียว
 * แยกเป็นการ์ดต่อคนชัดเจน + สรุปภาพรวมทีมทั้งหมดไว้ด้านบน
 */

import { FilterArea } from "@/shared/ui/MobileFilterSheet";
import { useEffect, useMemo, useState } from "react";
import useRealtime from "@/shared/realtime/useRealtime";
import { useNavigate } from "react-router-dom";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import {
  Box, Stack, Typography, IconButton, Skeleton, Avatar, Tooltip, useMediaQuery,
  Table, TableHead, TableBody, TableRow, TableCell,
} from "@mui/material";
import { Refresh, Groups, ChevronRight } from "@mui/icons-material";
import SelectField from "@/shared/ui/SelectField";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import {
  PageHeader, Kpi, KpiRow, FilterBar, Panel, EmptyState, INK, MUTED, FAINT, LINE, SURFACE, DANGER, CARD_SHADOW,
  TABLE_HEAD_SX, TABLE_ROW_SX, ICON_BTN_SX,
} from "@/shared/ui/PageKit";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import EventService from "@/shared/services/EventService";
import AuthService from "@/shared/services/authService";
import { can, isRole, ROLES } from "@/shared/utils/roles";

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
  const isDesktop = useMediaQuery("(min-width:900px)");
  const isAdminOrManager = can(userData, "manageMasterData");

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

  // ✅ เรียลไทม์: งาน/ทีมเปลี่ยน → ภาระงานอัปเดตทันที
  useRealtime(["events", "users"], () => { fetchData(true); });
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
    const technicians = users.filter((u) => isRole(u, ROLES.TECHNICIAN));
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
      if (!tech || !isRole(tech, ROLES.TECHNICIAN)) return;
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

  // ✅ v2 (ผู้ใช้สั่ง 2 ต.ค. 2569 "ปรับ UI ใหม่ทั้งหมด" + กฎ 6 ข้อ: สีน้อย · ตัวอักษรชัด · ช่องว่างพอดี ·
  //    จัดแนวแม่น · component เหมือนหน้าอื่น · กดแล้วเดาได้) — ใช้ชิ้นส่วนจาก shared/ui/PageKit
  //    เดิม: ไอคอนสีละอย่าง 6 ช่อง · ชิปสีจัด 5 สี · ปุ่มเรียงลำดับแบบแท็บ → ตอนนี้ตัวเลขสีเข้ม แดงเฉพาะค้างงาน
  //    จอใหญ่เป็นตาราง (ตัวเลขชิดขวาเรียงคอลัมน์) · มือถือเป็นการ์ดตัวเลข 4 ช่องเท่ากัน
  const avgText = (ms, n) => (n > 0 ? formatDuration(ms / n) : "—");
  const pctText = (a, n) => (n > 0 ? `${Math.round((a / n) * 100)}%` : "—");
  const openTech = (tech) => navigate(`/operation?team=${encodeURIComponent(tech.fname || "")}`);
  const nameOf = (tech) => (tech.fname ? `${tech.fname} ${tech.lname || ""}`.trim() : tech.username);
  const Num = ({ v, alert }) => (
    <Typography component="span" sx={{ fontWeight: v ? 800 : 500, fontSize: "0.9rem", color: !v ? FAINT : alert ? DANGER : INK, fontVariantNumeric: "tabular-nums" }}>
      {v || "—"}
    </Typography>
  );

  return (
    <Box sx={{ p: { xs: 1.25, sm: 2.5 }, maxWidth: 1400, mx: "auto" }}>
      <PageHeader
        icon={<Groups />}
        title="ภาระงานทีมช่าง"
        subtitle={`งานที่ช่างแต่ละคนถืออยู่ · ค้างเกิน ${WARNING_DAYS_AFTER_END} วันนับเป็นค้างงาน${lastRefreshed ? ` · อัปเดต ${moment(lastRefreshed).format("HH:mm")}` : ""}`}
        actions={(
          <Tooltip title="รีเฟรช">
            <IconButton onClick={() => fetchData()} sx={ICON_BTN_SX} aria-label="รีเฟรช"><Refresh sx={{ fontSize: 20 }} /></IconButton>
          </Tooltip>
        )}
      />

      {/* ✅ มือถือ: ตัวเลขสรุป/ค้นหา/ตัวกรองอยู่ในแผ่นล่าง (FilterArea) — จอไม่รก (ผู้ใช้สั่ง 3 ต.ค. 2569) */}
      <FilterArea count={search.trim() ? 1 : 0} summary={`ช่าง ${statsByTech.length} คน · ค้างงาน ${teamTotals.overdue}`}
        onClear={() => setSearch("")}
        chips={[search.trim() && { key: "q", label: `ค้นหา: ${search.trim()}`, onDelete: () => setSearch("") }]}>
        {loading ? (
          <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(6, 1fr)" }, mb: 1.5 }}>
            {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} variant="rounded" height={76} sx={{ borderRadius: 2.5 }} />)}
          </Box>
        ) : (
          <KpiRow columns={6}>
            <Kpi label="ช่างทั้งหมด" value={`${statsByTech.length} คน`} />
            <Kpi label="กำลังทำ" value={`${teamTotals.active} งาน`} sub={teamTotals.pending ? `รออนุมัติปิดงาน ${teamTotals.pending}` : "ไม่มีงานรออนุมัติปิด"} />
            <Kpi label="ค้างงาน" value={`${teamTotals.overdue} งาน`} sub={`เลยกำหนดเกิน ${WARNING_DAYS_AFTER_END} วัน`} alert={teamTotals.overdue > 0} />
            <Kpi label="เสร็จเดือนนี้" value={`${teamTotals.completedThisMonth} งาน`} />
            <Kpi label="เวลาเฉลี่ย / ครั้ง" value={avgText(teamTotals.durationMs, teamTotals.durationCount)}
              sub={teamTotals.durationCount ? `จาก ${teamTotals.durationCount.toLocaleString()} ครั้งที่กดเข้า-ออกครบ` : "ยังไม่มีข้อมูลเข้า-ออก"} />
            <Kpi label="เข้างานตรงตามแผน" value={pctText(teamTotals.onTimeCount, teamTotals.checkedInCount)}
              sub={teamTotals.checkedInCount ? `${teamTotals.onTimeCount} จาก ${teamTotals.checkedInCount} ครั้ง` : "ยังไม่มีข้อมูลเช็คอิน"} />
          </KpiRow>
        )}
  
        <FilterBar search={search} onSearch={setSearch} placeholder="ค้นหาชื่อช่าง">
          <SelectField label="เรียงตาม" value={sortBy} onChange={(e) => setSortBy(e.target.value)} sx={{ minWidth: { xs: 0, sm: 180 }, flex: { xs: 1, sm: "none" } }}>
            {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </SelectField>
        </FilterBar>
      </FilterArea>

      {loading ? (
        <Stack spacing={1}>{[1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={isDesktop ? 54 : 120} sx={{ borderRadius: 2.5 }} />)}</Stack>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Groups />} title={search ? "ไม่พบช่างที่ตรงกับคำค้นหา" : "ยังไม่มีช่างในระบบ"} hint={search ? "" : "เพิ่มพนักงานตำแหน่งช่างได้ที่แท็บ \"ทะเบียนพนักงาน\""} />
      ) : isDesktop ? (
        <Panel sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 980, ...TABLE_HEAD_SX }}>
            <TableHead>
              <TableRow>
                <TableCell>ช่าง</TableCell>
                <TableCell align="right">กำลังทำ</TableCell>
                <TableCell align="right">รออนุมัติปิด</TableCell>
                <TableCell align="right">ค้างงาน</TableCell>
                <TableCell align="right">ใบเสนอราคารอผล</TableCell>
                <TableCell align="right">เสร็จเดือนนี้</TableCell>
                <TableCell align="right">เวลาเฉลี่ย/ครั้ง</TableCell>
                <TableCell align="right">ตรงตามแผน</TableCell>
                <TableCell>งานถัดไป</TableCell>
                <TableCell width={32} />
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.tech._id} hover onClick={() => openTech(s.tech)} sx={{ cursor: "pointer", ...TABLE_ROW_SX }}>
                  <TableCell sx={{ maxWidth: 240 }}>
                    <Stack direction="row" spacing={1.1} alignItems="center" sx={{ minWidth: 0 }}>
                      <Avatar sx={{ width: 32, height: 32, fontSize: "0.85rem", fontWeight: 800, bgcolor: personColor(nameOf(s.tech)) }}>{personInitial(nameOf(s.tech))}</Avatar>
                      <Typography noWrap sx={{ fontWeight: 800, fontSize: "0.88rem", color: INK }}>{nameOf(s.tech)}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="right"><Num v={s.active} /></TableCell>
                  <TableCell align="right"><Num v={s.pending} /></TableCell>
                  <TableCell align="right">
                    <Num v={s.overdue} alert />
                    {s.overdue > 0 && <Typography sx={{ fontSize: "0.7rem", color: MUTED }}>นานสุด {s.maxOverdueDays} วัน</Typography>}
                  </TableCell>
                  <TableCell align="right"><Num v={s.quotationPending} /></TableCell>
                  <TableCell align="right"><Num v={s.completedThisMonth} /></TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    <Typography sx={{ fontSize: "0.84rem", color: s.durationCount >= 3 ? INK : FAINT }}>{s.durationCount >= 3 ? avgText(s.durationMs, s.durationCount) : "—"}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography sx={{ fontSize: "0.84rem", color: s.checkedInCount >= 3 ? INK : FAINT, fontVariantNumeric: "tabular-nums" }}>{s.checkedInCount >= 3 ? pctText(s.onTimeCount, s.checkedInCount) : "—"}</Typography>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 240 }}>
                    {s.nextJob ? (
                      <>
                        <Typography noWrap sx={{ fontSize: "0.82rem", fontWeight: 700, color: INK }}>{moment(s.nextJob.start).locale("th").format("D MMM")} · {s.nextJob.title || "งาน"}</Typography>
                        <Typography noWrap sx={{ fontSize: "0.72rem", color: MUTED }}>{[s.nextJob.company, s.nextJob.site].filter(Boolean).join(" · ")}</Typography>
                      </>
                    ) : <Typography sx={{ fontSize: "0.8rem", color: FAINT }}>—</Typography>}
                  </TableCell>
                  <TableCell><ChevronRight sx={{ color: "#cbd5e1" }} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      ) : (
        <Stack spacing={1}>
          {filtered.map((s) => (
            <Box key={s.tech._id} role="button" onClick={() => openTech(s.tech)}
              sx={{ p: 1.5, bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, cursor: "pointer", boxShadow: CARD_SHADOW, "&:active": { bgcolor: SURFACE } }}>
              <Stack direction="row" spacing={1.1} alignItems="center">
                <Avatar sx={{ width: 34, height: 34, fontSize: "0.9rem", fontWeight: 800, bgcolor: personColor(nameOf(s.tech)) }}>{personInitial(nameOf(s.tech))}</Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontWeight: 800, fontSize: "0.92rem", color: INK }}>{nameOf(s.tech)}</Typography>
                  {s.overdue > 0
                    ? <Typography noWrap sx={{ fontSize: "0.74rem", fontWeight: 700, color: DANGER }}>ค้าง {s.overdue} งาน · นานสุด {s.maxOverdueDays} วัน</Typography>
                    : <Typography noWrap sx={{ fontSize: "0.74rem", color: MUTED }}>ไม่มีงานค้าง</Typography>}
                </Box>
                <ChevronRight sx={{ color: "#cbd5e1" }} />
              </Stack>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", mt: 1.25, pt: 1.25, borderTop: `1px solid ${LINE}` }}>
                {[["กำลังทำ", s.active], ["ค้างงาน", s.overdue, true], ["รออนุมัติปิด", s.pending], ["เสร็จเดือนนี้", s.completedThisMonth]].map(([l, v, alert], i) => (
                  <Box key={l} sx={{ textAlign: "center", borderLeft: i ? `1px solid ${LINE}` : 0 }}>
                    <Num v={v} alert={alert} />
                    <Typography noWrap sx={{ fontSize: "0.66rem", color: MUTED }}>{l}</Typography>
                  </Box>
                ))}
              </Box>
              {s.nextJob && (
                <Typography noWrap sx={{ mt: 1, fontSize: "0.74rem", color: MUTED }}>
                  งานถัดไป {moment(s.nextJob.start).locale("th").format("D MMM")} · {s.nextJob.title || "งาน"}{s.nextJob.site ? ` · ${s.nextJob.site}` : ""}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}
