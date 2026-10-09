/**
 * SalesDashboard — หน้าแรกของฝ่ายขาย
 *
 * ✅ (9 ต.ค. 2569 ผู้ใช้: "แก้หน้า Dashboard ฝ่ายขายให้สอดคล้อง สวยงามทันสมัย ใช้งานง่าย")
 *   โครงเดียวกับหน้าแรกของฝ่ายช่าง (Dashboard.js) — การ์ดทักทายสีขาว · เมนูหลัก · กล่องข้อมูลชุด DashWidgets
 *   สีหลักน้ำเงินชุดเดียวกับทั้งแอป (เลิกแบนเนอร์ม่วงไล่สี) · สีประจำชนิดนัดเหลือเฉพาะป้ายเล็ก
 *
 *   ซ้าย (สิ่งที่ต้องทำ): นัดหมายวันนี้ → ต้องติดตาม (เลยวันนัด/รอปิดงาน) → นัดหมายที่จะถึง 14 วัน
 *   ขวา (งานที่เกี่ยวกับช่าง): งานที่แจ้งให้ช่าง (สถานะจริงของงาน) → ตารางงานช่าง (ดูอย่างเดียว)
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import { Box, Stack, Typography, Button, Avatar } from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Add, Today, EventOutlined, ReportProblemOutlined, SendOutlined, LockOutlined, ChevronRight, CalendarMonthOutlined,
} from "@mui/icons-material";

import useRealtime from "@/shared/realtime/useRealtime";
import { useAuth } from "@/features/auth/AuthContext";
import EventService from "@/shared/services/EventService";
import DispatchService from "@/features/dispatch/services/DispatchService";
import { formatThai } from "@/shared/utils/thaiDate";
import { can, rankLabel, DEPARTMENT } from "@/shared/utils/roles";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import { SALES_TYPE_META, salesStatusMeta } from "@/features/calendar/salesAppointmentTypes";
import { DISPATCH_STATUS_META, jobStatusColor } from "@/features/dispatch/dispatchMeta";
import { INK, MUTED, LINE, SURFACE, CARD_SHADOW, ACCENT, PRIMARY_BTN_SX } from "@/shared/ui/PageKit";
import HomeMenu from "@/features/dashboard/components/HomeMenu";
import { Widget, Row, Empty, Loading, GroupTitle, Pill, DateTile } from "@/features/dashboard/components/DashWidgets";

const AMBER = "#d97706";
const RED = "#dc2626";
const GREEN = "#16a34a";
const SERVICE = "#0891b2";

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "สวัสดีตอนเช้า";
  if (h < 17) return "สวัสดีตอนบ่าย";
  return "สวัสดีตอนเย็น";
};

const startOf = (e) => moment(e.start || e.date);
const placeOf = (e) => [e.site, e.company && e.company !== e.site ? e.company : ""].filter(Boolean).join(" · ") || "ไม่ระบุสถานที่";
const timeOf = (e) => (e.startTime ? `${e.startTime}${e.endTime ? `–${e.endTime}` : ""}` : "ทั้งวัน");

/** แถวนัดหมาย — ช่องเวลา/วันที่ซ้าย · ชนิดนัด + สถานที่ · ป้ายสถานะขวา */
function ApptRow({ e, showDate }) {
  const meta = SALES_TYPE_META[e.title];
  const st = salesStatusMeta(e.status);
  const d = startOf(e);
  return (
    <Row to="/event"
      leading={showDate
        ? <DateTile top={d.format("D")} bottom={formatThai(d, "MMM")} color={ACCENT} strong={d.isSame(moment().add(1, "day"), "day")} />
        : <DateTile top={e.startTime || "ทั้งวัน"} bottom={e.startTime && e.endTime ? `ถึง ${e.endTime}` : undefined} />}
      title={`${meta?.icon ? `${meta.icon} ` : ""}${e.title || "นัดหมาย"}`}
      sub={[placeOf(e), showDate ? timeOf(e) : ""].filter(Boolean).join(" · ")}
      trailing={<Pill color={st.color}>{st.key}</Pill>} />
  );
}

export default function SalesDashboard() {
  const navigate = useNavigate();
  const { userData } = useAuth();
  const [events, setEvents] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [serviceEvents, setServiceEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ ดูตารางงานช่าง (อ่านอย่างเดียว) ได้เฉพาะคนที่มีสิทธิ์ — ไม่มีสิทธิ์ก็ไม่ยิง request และไม่โชว์กล่อง
  const canViewService = can(userData, "viewServiceCalendar");
  const canRequestDispatch = can(userData, "requestDispatch");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [ev, dp, sv] = await Promise.all([
      EventService.getEventOp().catch(() => ({ userEvents: [] })),
      canRequestDispatch ? DispatchService.list().catch(() => []) : Promise.resolve([]),
      canViewService ? EventService.getEventOp({ dept: DEPARTMENT.SERVICE }).catch(() => ({ userEvents: [] })) : Promise.resolve({ userEvents: [] }),
    ]);
    setEvents(ev?.userEvents || []);
    setDispatches(Array.isArray(dp) ? dp : []);
    setServiceEvents(sv?.userEvents || []);
    if (!silent) setLoading(false);
  }, [canViewService, canRequestDispatch]);

  useEffect(() => { load(); }, [load]);
  useRealtime("events", () => { load(true); });
  useRealtime("dispatch", () => { load(true); });

  const today = moment().startOf("day");
  const todays = useMemo(
    () => events.filter((e) => startOf(e).isSame(today, "day")).sort((a, b) => String(a.startTime || "").localeCompare(String(b.startTime || ""))),
    [events, today],
  );
  const upcoming = useMemo(
    () => events.filter((e) => startOf(e).isAfter(today, "day") && startOf(e).diff(today, "days") <= 14)
      .sort((a, b) => startOf(a) - startOf(b)),
    [events, today],
  );
  // ✅ ต้องติดตาม — เกณฑ์เดียวกับแท็บ "ต้องติดตาม" ในตารางนัดหมาย (SalesAgenda): เลยวันนัดยังไม่เข้าพบ + เข้าพบแล้วรอปิดงาน
  const follow = useMemo(() => events.filter((e) => {
    const k = salesStatusMeta(e.status).key;
    if (k === "เข้าพบแล้ว") return true;
    return startOf(e).isBefore(today, "day") && (k === "นัดหมายแล้ว" || k === "เลื่อนนัด");
  }).sort((a, b) => startOf(a) - startOf(b)), [events, today]);
  const weekCount = useMemo(
    () => events.filter((e) => startOf(e).isBetween(today, moment(today).add(7, "days"), "day", "[]")).length,
    [events, today],
  );

  // ⚠️ นับจาก "สถานะงานจริง" ที่ผูกไว้ (d.job) ไม่ใช่สถานะของใบ — ดูเหตุผลที่ dispatchMeta.js
  const dispatchStats = useMemo(() => ({
    waiting: dispatches.filter((d) => d.status === "requested").length,
    rejected: dispatches.filter((d) => d.status === "rejected").length,
    working: dispatches.filter((d) => d.job && d.job.status !== "ดำเนินการเสร็จสิ้น").length,
    done: dispatches.filter((d) => d.job?.status === "ดำเนินการเสร็จสิ้น").length,
  }), [dispatches]);
  const activeDispatches = useMemo(
    () => dispatches
      .filter((d) => d.status !== "cancelled" && d.job?.status !== "ดำเนินการเสร็จสิ้น")
      // ถูกตีกลับขึ้นก่อน (ต้องแก้) → รอตรวจ → กำลังทำ
      .sort((a, b) => (b.status === "rejected") - (a.status === "rejected") || (b.status === "requested") - (a.status === "requested"))
      .slice(0, 6),
    [dispatches],
  );
  const serviceToday = useMemo(() => serviceEvents.filter((e) => startOf(e).isSame(today, "day")).length, [serviceEvents, today]);

  const name = userData?.fname || "ฝ่ายขาย";
  const summary = todays.length
    ? `วันนี้มี ${todays.length} นัด · 7 วันนี้ ${weekCount} นัด`
    : weekCount ? `วันนี้ไม่มีนัด · 7 วันนี้ ${weekCount} นัด` : "ยังไม่มีนัดหมายใน 7 วันนี้";

  return (
    <Box sx={{ px: { xs: 1.5, sm: 2.5 }, py: { xs: 1.25, sm: 2 }, maxWidth: 1480, mx: "auto", bgcolor: SURFACE, minHeight: "100vh" }}>
      <Box sx={{ display: "grid", gap: { xs: 0, lg: 2.5 }, gridTemplateColumns: { xs: "1fr", lg: "minmax(0,1fr) 380px" }, alignItems: "start" }}>
        {/* ── ซ้าย ── */}
        <Box sx={{ minWidth: 0 }}>
          {/* การ์ดทักทาย + ปุ่มหลัก — ชุดเดียวกับหน้าแรกของช่าง */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}
            sx={{ mb: 2, px: { xs: 1.5, sm: 2 }, py: 1.5, bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, boxShadow: CARD_SHADOW }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
              <Avatar sx={{ width: 42, height: 42, fontWeight: 800, bgcolor: personColor(name) }}>{personInitial(name)}</Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: "0.76rem", color: MUTED }}>{greeting()} · {formatThai(moment(), "D MMMM YYYY")} · {rankLabel(userData?.rank || userData?.role)}</Typography>
                <Typography noWrap sx={{ fontWeight: 900, fontSize: { xs: "1.1rem", sm: "1.25rem" }, color: INK, lineHeight: 1.3 }}>{name}</Typography>
                <Typography noWrap sx={{ fontSize: "0.78rem", color: "#475569" }}>{summary}</Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
              <Button variant="contained" startIcon={<Add />} onClick={() => navigate("/event")} sx={{ ...PRIMARY_BTN_SX, flex: { xs: 1, sm: "0 0 auto" }, height: 40 }}>เพิ่มนัดหมาย</Button>
              {canRequestDispatch && (
                <Button variant="outlined" startIcon={<SendOutlined />} onClick={() => navigate("/sales")}
                  sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, height: 40, flex: { xs: 1, sm: "0 0 auto" }, color: ACCENT, borderColor: alpha(ACCENT, 0.4), "&:hover": { borderColor: ACCENT, bgcolor: alpha(ACCENT, 0.04) } }}>
                  แจ้งงานให้ช่าง
                </Button>
              )}
            </Stack>
          </Stack>

          <GroupTitle>เมนูหลัก</GroupTitle>
          <HomeMenu userData={userData} hideSalesJobs />

          {/* นัดหมายวันนี้ */}
          <Widget title={`นัดหมายวันนี้ · ${formatThai(moment(), "D MMM")}`} count={todays.length || undefined} icon={Today}
            sx={{ borderColor: alpha(ACCENT, 0.35) }} to="/event" toLabel="เปิดปฏิทิน">
            {loading ? <Loading rows={2} /> : todays.length ? todays.map((e) => <ApptRow key={e._id} e={e} />) : (
              <Empty text="วันนี้ไม่มีนัดหมาย — กด “เพิ่มนัดหมาย” เพื่อลงนัดใหม่" />
            )}
          </Widget>

          {/* ต้องติดตาม — โชว์เฉพาะตอนมีจริง */}
          {!loading && follow.length > 0 && (
            <Widget title="ต้องติดตาม" count={follow.length} icon={ReportProblemOutlined} tone={AMBER}
              hint="เลยวันนัดยังไม่บันทึกเข้าพบ · เข้าพบแล้วรอปิดงาน" to="/event" toLabel="จัดการ">
              {follow.slice(0, 5).map((e) => <ApptRow key={e._id} e={e} showDate />)}
            </Widget>
          )}

          {/* นัดหมายที่จะถึง */}
          <Widget title="นัดหมายที่จะถึง" count={upcoming.length || undefined} icon={EventOutlined} hint="14 วันข้างหน้า" to={upcoming.length > 6 ? "/event" : undefined}>
            {loading ? <Loading rows={3} /> : upcoming.length ? upcoming.slice(0, 6).map((e) => <ApptRow key={e._id} e={e} showDate />) : (
              <Empty text="ยังไม่มีนัดหมายใน 14 วันข้างหน้า" />
            )}
          </Widget>
        </Box>

        {/* ── ขวา: งานที่เกี่ยวกับช่าง ── */}
        <Box sx={{ minWidth: 0, position: { lg: "sticky" }, top: { lg: 16 } }}>
          {canRequestDispatch && (
            <Widget title="งานที่แจ้งให้ช่าง" count={activeDispatches.length || undefined} icon={SendOutlined} tone={SERVICE}
              to="/sales" toLabel="ดูทั้งหมด"
              summary={[
                dispatchStats.rejected > 0 && <Pill key="r" color={RED}>ถูกตีกลับ {dispatchStats.rejected}</Pill>,
                dispatchStats.waiting > 0 && <Pill key="w" color={AMBER}>รอตรวจ {dispatchStats.waiting}</Pill>,
                dispatchStats.working > 0 && <Pill key="k" color={ACCENT}>ช่างกำลังทำ {dispatchStats.working}</Pill>,
                dispatchStats.done > 0 && <Pill key="d" color={GREEN}>เสร็จแล้ว {dispatchStats.done}</Pill>,
              ].filter(Boolean)}>
              {loading ? <Loading rows={3} /> : activeDispatches.length ? activeDispatches.map((d) => {
                const rejected = d.status === "rejected";
                const label = rejected ? "ถูกตีกลับ" : d.job?.status || DISPATCH_STATUS_META[d.status]?.label || d.status;
                const color = rejected ? RED : d.job?.status ? jobStatusColor(d.job.status) : (DISPATCH_STATUS_META[d.status]?.color || MUTED);
                const sub = rejected
                  ? (d.rejectedReason || "ต้องแก้ไขแล้วส่งใหม่")
                  : [d.customer?.site || d.customer?.company, d.job?.responsiblePerson ? `ช่าง ${d.job.responsiblePerson}` : "", d.job?.start ? formatThai(moment(d.job.start), "D MMM") : ""].filter(Boolean).join(" · ");
                return (
                  <Row key={d._id} to={`/sales/${d._id}`} title={d.title || "งาน"} sub={sub} trailing={<Pill color={color}>{label}</Pill>} />
                );
              }) : (
                <Empty text="ยังไม่มีงานที่แจ้งให้ช่าง — ปิดการขายได้แล้วกด “แจ้งงานให้ช่าง”" />
              )}
            </Widget>
          )}

          {canViewService && (
            <Box component={Link} to={`/event?dept=${DEPARTMENT.SERVICE}`} sx={{
              display: "flex", alignItems: "center", gap: 1.25, mb: 2, p: 1.5, borderRadius: 3, textDecoration: "none",
              bgcolor: "#fff", border: `1px solid ${LINE}`, boxShadow: CARD_SHADOW, "&:hover": { borderColor: alpha(SERVICE, 0.5) },
            }}>
              <Box sx={{ width: 36, height: 36, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: alpha(SERVICE, 0.1), color: SERVICE, flexShrink: 0 }}>
                <CalendarMonthOutlined sx={{ fontSize: 20 }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={0.6} alignItems="center">
                  <Typography sx={{ fontWeight: 800, fontSize: "0.92rem", color: INK }}>ตารางงานช่าง</Typography>
                  <Pill color={SERVICE} icon={<LockOutlined sx={{ fontSize: 12 }} />} sx={{ height: 20, fontSize: "0.64rem" }}>ดูอย่างเดียว</Pill>
                </Stack>
                <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>
                  {serviceToday ? `วันนี้ช่างมีงาน ${serviceToday} งาน · ` : ""}เช็ควันว่างของช่างก่อนนัดลูกค้า
                </Typography>
              </Box>
              <ChevronRight sx={{ color: "#cbd5e1" }} />
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
