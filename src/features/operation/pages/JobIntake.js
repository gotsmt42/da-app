/**
 * JobIntake — เมนู "รับงาน" (ขั้นที่ 1 ของขั้นตอนทำงาน · 9 ต.ค. 2569 ผู้ใช้: "เรียงเมนูตามขั้นตอนงาน และใช้คำว่ารับงาน")
 *
 * รับงานจากลูกค้า / LINE / ฝ่ายขาย → เก็บเป็น "งานรอลงแผน" (ยังไม่ต้องรู้วันที่) → ลงตารางทีหลัง
 *   • ปุ่ม "+ รับงานใหม่" = ฟอร์มเดียวกับแผงงานรอลงแผนในปฏิทิน (AddDraftEvent)
 *   • รายการงานรอลงแผน แยกตามเดือนที่ตั้งใจ · กรองด่วน/รอข้อมูล · ปุ่มแก้ไข/ลงตาราง
 *   • ผู้จัดคิว: เห็นคำขอจากฝ่ายขายที่รอตัดสินใจ (ไปหน้า "คำขอลงงาน")
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import moment from "moment";
import { Box, Stack, Typography, Button, ButtonBase, Skeleton } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { MoveToInboxOutlined, AddRounded, EditOutlined, ChevronRight, InboxOutlined, ArrowForwardRounded } from "@mui/icons-material";
import EventService from "@/shared/services/EventService";
import useRealtime from "@/shared/realtime/useRealtime";
import useAppBadges, { refreshAppBadges } from "@/shared/hooks/useAppBadges";
import { useAuth } from "@/features/auth/AuthContext";
import { can } from "@/shared/utils/roles";
import { formatThai } from "@/shared/utils/thaiDate";
import { PageHeader, Panel, EmptyState, INK, MUTED, LINE, ACCENT, SURFACE } from "@/shared/ui/PageKit";
import { isUrgent, dueInfo } from "@/shared/utils/jobFlow";
import { JobRow, BTN_SX, openIntakeForm } from "./JobFollow";

const AMBER = "#d97706";
const FILTERS = [
  { key: "all", label: "ทั้งหมด", test: () => true },
  { key: "urgent", label: "⚡ ด่วน", test: (d) => isUrgent(d) || dueInfo(d)?.overdue },
  { key: "info", label: "รอข้อมูล", test: (d) => d.infoPending },
];

/** 1 รับงาน → 2 ลงตาราง → 3 ติดตามงาน — บอกให้รู้ว่าหน้านี้อยู่ตรงไหนของขั้นตอน */
function FlowGuide() {
  const steps = [
    { n: 1, t: "รับงาน", d: "บันทึกงานที่ได้รับแจ้ง", on: true },
    { n: 2, t: "ลงตาราง", d: "เลือกวัน · มอบหมายทีม", to: "/event" },
    { n: 3, t: "ติดตามงาน", d: "ช่างทำงาน · ปิดงาน", to: "/jobs/follow-up" },
  ];
  return (
    <Stack direction="row" alignItems="stretch" spacing={0.75} sx={{ mb: 1.5, overflowX: "auto", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
      {steps.map((s, i) => (
        <Stack key={s.n} direction="row" alignItems="center" spacing={0.75} sx={{ flex: 1, minWidth: 150 }}>
          <Box component={s.to ? Link : "div"} to={s.to} sx={{
            flex: 1, display: "flex", alignItems: "center", gap: 1, px: 1.25, py: 1, borderRadius: 2.5, textDecoration: "none",
            bgcolor: s.on ? alpha(ACCENT, 0.07) : "#fff", border: `1px solid ${s.on ? alpha(ACCENT, 0.35) : LINE}`,
            "&:hover": s.to ? { borderColor: "#cbd5e1" } : {},
          }}>
            <Box sx={{ width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: "0.74rem", fontWeight: 900, flexShrink: 0, color: s.on ? "#fff" : MUTED, bgcolor: s.on ? ACCENT : SURFACE }}>{s.n}</Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: "0.82rem", fontWeight: 800, color: s.on ? ACCENT : INK }}>{s.t}</Typography>
              <Typography noWrap sx={{ fontSize: "0.68rem", color: MUTED }}>{s.d}</Typography>
            </Box>
          </Box>
          {i < steps.length - 1 && <ChevronRight sx={{ color: "#cbd5e1", flexShrink: 0 }} />}
        </Stack>
      ))}
    </Stack>
  );
}

export default function JobIntake() {
  const { userData } = useAuth() || {};
  const { badges } = useAppBadges(userData);
  const canAssign = can(userData, "assignDispatch");
  const [drafts, setDrafts] = useState(null);
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    try {
      const [dr, ev] = await Promise.all([
        EventService.GetDraftEvents(),
        EventService.getEventOp().catch(() => null),
      ]);
      setDrafts((Array.isArray(dr?.drafts) ? dr.drafts : []).filter((d) => d.department !== "sales"));
      if (ev?.userEvents) setEvents(ev.userEvents);
    } catch {
      setDrafts((prev) => prev || []);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useRealtime("events", () => { load(); });

  const openIntake = (existingDraft) => openIntakeForm({
    existingDraft, events, drafts, userData,
    onSaved: async () => { await load(); refreshAppBadges(); },
  });

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, (drafts || []).filter(f.test).length])), [drafts]);
  // แยกตามเดือนที่ตั้งใจ — ด่วนขึ้นก่อนในแต่ละเดือน
  const groups = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter) || FILTERS[0];
    const map = new Map();
    (drafts || []).filter(f.test).forEach((d) => {
      const k = d.plannedMonth || "";
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(d);
    });
    return [...map.entries()]
      .sort(([a], [b]) => (a || "9999-99").localeCompare(b || "9999-99"))
      .map(([k, list]) => [k, list.sort((a, b) => (isUrgent(b) - isUrgent(a)) || new Date(a.createdAt || 0) - new Date(b.createdAt || 0))]);
  }, [drafts, filter]);

  const thisMonth = moment().format("YYYY-MM");
  const monthTitle = (k) => {
    if (!k) return "ไม่ระบุเดือน";
    const m = moment(k, "YYYY-MM");
    const label = formatThai(m, "MMMM YYYY");
    if (k < thisMonth) return `${label} · เลยเดือนที่ตั้งใจแล้ว`;
    if (k === thisMonth) return `${label} · เดือนนี้`;
    return label;
  };

  const actionFor = (d) => (
    <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0 }}>
      <Button variant="outlined" onClick={() => openIntake(d)} startIcon={<EditOutlined sx={{ fontSize: "16px !important" }} />}
        sx={{ ...BTN_SX, bgcolor: "#fff", color: ACCENT, borderColor: alpha(ACCENT, 0.4), "&:hover": { bgcolor: alpha(ACCENT, 0.05), borderColor: ACCENT }, display: { xs: "none", sm: "inline-flex" } }}>แก้ไข</Button>
      <Button component={Link} to="/event" variant="contained" sx={BTN_SX}>ลงตาราง</Button>
    </Stack>
  );

  return (
    <Box sx={{ px: { xs: 1.5, sm: 2.5 }, py: { xs: 1.25, sm: 2.5 }, maxWidth: 1200, mx: "auto" }}>
      <PageHeader icon={<MoveToInboxOutlined />} title="รับงาน"
        subtitle={drafts ? `รับงานจากลูกค้า / LINE / ฝ่ายขาย · รอลงแผน ${drafts.length} งาน` : "กำลังโหลด..."}
        actions={
          <Button variant="contained" startIcon={<AddRounded />} onClick={() => openIntake()} disabled={!drafts}
            sx={{ ...BTN_SX, height: 40, px: { xs: 1.25, sm: 2 } }}>รับงานใหม่</Button>
        } />

      <FlowGuide />

      {/* คำขอจากฝ่ายขาย — อีกช่องทางของการรับงาน ต้องตัดสินใจที่หน้า "คำขอลงงาน" */}
      {canAssign && badges?.dispatchQueue > 0 && (
        <Box component={Link} to="/dispatch" sx={{
          display: "flex", alignItems: "center", gap: 1.25, mb: 1.5, px: 1.75, py: 1.2, borderRadius: 3, textDecoration: "none",
          bgcolor: alpha(AMBER, 0.06), border: `1px solid ${alpha(AMBER, 0.3)}`, "&:hover": { borderColor: AMBER },
        }}>
          <InboxOutlined sx={{ color: AMBER }} />
          <Typography sx={{ flex: 1, fontSize: "0.85rem", fontWeight: 800, color: "#92400e" }}>
            มีคำขอลงงานรอตัดสินใจ {badges.dispatchQueue} รายการ <Box component="span" sx={{ fontWeight: 600 }}>(จากฝ่ายขาย/ช่าง)</Box>
          </Typography>
          <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: "#92400e", display: "inline-flex", alignItems: "center", gap: 0.3 }}>
            ไปที่คำขอลงงาน <ArrowForwardRounded sx={{ fontSize: 17 }} />
          </Typography>
        </Box>
      )}

      {!drafts ? (
        <Stack spacing={1}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={72} sx={{ borderRadius: 3 }} />)}</Stack>
      ) : drafts.length === 0 ? (
        <EmptyState icon={<MoveToInboxOutlined />} title="ยังไม่มีงานรอลงแผน" hint="ได้รับงานจากลูกค้าแล้ว กด “รับงานใหม่” เพื่อบันทึกไว้ก่อน แล้วค่อยลงตาราง"
          action={<Button variant="contained" startIcon={<AddRounded />} onClick={() => openIntake()} sx={{ ...BTN_SX, mt: 1 }}>รับงานใหม่</Button>} />
      ) : (
        <>
          <Stack direction="row" spacing={0.75} sx={{ mb: 1.25 }}>
            {FILTERS.map((f) => {
              const on = filter === f.key;
              return (
                <ButtonBase key={f.key} onClick={() => setFilter(f.key)} sx={{
                  height: 34, px: 1.5, borderRadius: 99, fontSize: "0.8rem", fontWeight: 700, gap: 0.6,
                  border: `1.5px solid ${on ? ACCENT : LINE}`, bgcolor: on ? alpha(ACCENT, 0.07) : "#fff", color: on ? ACCENT : "#334155",
                }}>
                  {f.label}
                  <Box component="span" sx={{ fontSize: "0.72rem", fontWeight: 800, color: on ? ACCENT : MUTED }}>{counts[f.key]}</Box>
                </ButtonBase>
              );
            })}
          </Stack>
          <Stack spacing={1.5}>
            {groups.length ? groups.map(([k, list]) => (
              <Panel key={k || "none"}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1.1, borderBottom: `1px solid ${LINE}`, bgcolor: k && k < thisMonth ? alpha("#dc2626", 0.04) : SURFACE }}>
                  <Typography sx={{ flex: 1, fontWeight: 800, fontSize: "0.86rem", color: k && k < thisMonth ? "#b91c1c" : INK }}>{monthTitle(k)}</Typography>
                  <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: MUTED }}>{list.length} งาน</Typography>
                </Stack>
                {list.map((d) => <JobRow key={d._id} e={d} step="unassigned" color={AMBER} action={actionFor(d)} />)}
              </Panel>
            )) : (
              <EmptyState icon={<MoveToInboxOutlined />} title="ไม่มีงานในตัวกรองนี้" />
            )}
          </Stack>
        </>
      )}
    </Box>
  );
}
