/**
 * JobFollow — เมนู "ติดตามงาน" (9 ต.ค. 2569 ผู้ใช้: "เมนูอยู่ไหน ไม่เห็น ไม่เจอ")
 *
 * หน้าเดียวรวม "งานที่ต้องตามต่อ" แยกตามขั้นตอนทำงานมาตรฐาน 6 ขั้น — กดขั้นไหนก็เห็นงานของขั้นนั้น
 *   1 รับแจ้งงาน  → รอข้อมูล
 *   2 เปิด Job    → ด่วน / เลยวันครบกำหนด
 *   3 วางแผน     → งานรอลงแผน (รับแจ้งแล้ว ยังไม่ลงวันที่) + ลงตารางแล้วแต่ยังไม่มีทีม
 *   4 ช่างรับงาน  → ยังไม่กดรับงาน (งานภายใน 7 วัน)
 *   5 ติดตามงาน   → งานไม่เสร็จ รอนัดใหม่
 *   6 ปิดงาน      → รอตรวจปิดงาน
 * ข้อมูลชุดเดียวกับหน้าการดำเนินงาน (GET /events/event-op — server กรองตามสิทธิ์แล้ว ช่างเห็นแค่งานตัวเอง)
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import moment from "moment";
import Swal from "sweetalert2";
import { Box, Stack, Typography, Button, ButtonBase, Skeleton } from "@mui/material";
import TomSelect from "tom-select";
import "tom-select/dist/css/tom-select.css";
import CustomerService from "@/shared/services/CustomerService";
import JobTypeService from "@/shared/services/JobTypeService";
import SystemTypeService from "@/shared/services/SystemTypeService";
import AuthService from "@/shared/services/authService";
import { getAddDraftEvent } from "@/features/calendar/components/EventForms/AddDraftEvent";
import { alpha } from "@mui/material/styles";
import {
  FactCheckOutlined, HourglassTopRounded, BoltRounded, GroupAddOutlined, ThumbUpAltOutlined,
  EventRepeatOutlined, TaskAltOutlined, ChevronRight, CheckCircleRounded, AddRounded, EditOutlined,
} from "@mui/icons-material";
import EventService from "@/shared/services/EventService";
import useRealtime from "@/shared/realtime/useRealtime";
import { refreshAppBadges } from "@/shared/hooks/useAppBadges";
import { useAuth } from "@/features/auth/AuthContext";
import { can } from "@/shared/utils/roles";
import { formatThai } from "@/shared/utils/thaiDate";
import { formatRoundLabel } from "@/shared/utils/contractRounds";
import { PageHeader, Panel, EmptyState, INK, MUTED, LINE, ACCENT } from "@/shared/ui/PageKit";
import { JobFlowFlags } from "@/shared/ui/JobFlow";
import { isClosedJob, isUrgent, dueInfo, openFollowUp, acksOf, isAckedBy, isParticipant } from "@/shared/utils/jobFlow";

const AMBER = "#d97706";
const RED = "#dc2626";

const STEPS = [
  { n: 1, key: "info", step: "รับแจ้งงาน", label: "รอข้อมูล", icon: HourglassTopRounded, color: AMBER, hint: "ข้อมูลงานยังไม่ครบ — ตามข้อมูลจากผู้แจ้ง/ลูกค้าให้ครบก่อนเข้างาน" },
  { n: 2, key: "urgent", step: "เปิด Job", label: "ด่วน / เลยกำหนด", icon: BoltRounded, color: RED, hint: "งานด่วน และงานที่เลยวันครบกำหนดแล้ว" },
  { n: 3, key: "unassigned", step: "วางแผน", label: "รอลงแผน", icon: GroupAddOutlined, color: AMBER, hint: "งานที่รับแจ้งแล้วแต่ยังไม่ลงวันที่ — กด “ลงตาราง” แล้วลากงานจากแผงงานรอลงแผนลงวันในปฏิทิน · รวมงานที่ยังไม่มีทีม" },
  { n: 4, key: "unacked", step: "ช่างรับงาน", label: "ยังไม่รับงาน", icon: ThumbUpAltOutlined, color: ACCENT, hint: "งานภายใน 7 วันที่ช่างยังไม่กด “รับงาน”" },
  { n: 5, key: "followup", step: "ติดตามงาน", label: "งานไม่เสร็จ", icon: EventRepeatOutlined, color: AMBER, hint: "ช่างแจ้งว่างานไม่เสร็จ — ลงวันนัดใหม่ในตารางงาน แล้วกด “จัดการแล้ว”" },
  { n: 6, key: "close", step: "ตรวจและปิดงาน", label: "รอตรวจปิดงาน", icon: TaskAltOutlined, color: "#16a34a", hint: "ช่างขอปิดงานแล้ว — ตรวจรูป/เอกสาร แล้วอนุมัติหรือตีกลับ" },
];
// ขั้นที่เปิดให้ก่อนเมื่อเข้าหน้า (เรื่องที่รอเรามากที่สุดก่อน)
const DEFAULT_ORDER = ["followup", "unacked", "close", "urgent", "info", "unassigned"];

const me = () => {
  try {
    const p = JSON.parse(localStorage.getItem("payload") || "{}");
    return { userId: p.userId || "", fname: p.fname || "" };
  } catch { return { userId: "", fname: "" }; }
};

/** แยกงานเข้าแต่ละขั้น — งานหลายวันนับเป็นงานเดียว (ใช้วันที่ใกล้วันนี้ที่สุด) */
export function classifyJobs(events, now = moment(), drafts = []) {
  const today = now.clone().startOf("day");
  const in7 = today.clone().add(8, "days");
  const groups = new Map();
  (events || []).forEach((e) => {
    if (e.department === "sales" || e.unscheduled || isClosedJob(e)) return;
    const k = e.jobGroupId || e._id;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  });
  const out = Object.fromEntries(STEPS.map((s) => [s.key, []]));
  groups.forEach((sessions) => {
    const sorted = sessions.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
    const next = sorted.find((s) => moment(s.end || s.start).isSameOrAfter(today)) || sorted[sorted.length - 1];
    const head = next;
    const start = moment(head.start);
    if (head.infoPending) out.info.push(head);
    const due = dueInfo(head);
    if ((isUrgent(head) || due?.overdue) && !head.closeRequested) out.urgent.push(head);
    if (!head.resPerson && !head.team && start.isSameOrAfter(today)) out.unassigned.push(head);
    if ((head.resPerson || head.team) && head.approvalStatus !== "pending" && !acksOf(head).length && start.isBefore(in7) && moment(head.end || head.start).isSameOrAfter(today)) {
      out.unacked.push(head);
    }
    if (head.followUpOpen && openFollowUp(head)) out.followup.push(head);
    if (head.closeRequested) out.close.push(head);
  });
  // ✅ งานรอลงแผน (unscheduled) — ขั้น 3 เสมอ · ข้อมูลไม่ครบขึ้นขั้น 1 ด้วย · ด่วนขึ้นขั้น 2 ด้วย
  (drafts || []).forEach((d) => {
    if (d.department === "sales") return;
    out.unassigned.push(d);
    if (d.infoPending) out.info.push(d);
    if (isUrgent(d) || dueInfo(d)?.overdue) out.urgent.push(d);
  });
  out.urgent.sort((a, b) => (isUrgent(b) - isUrgent(a)) || (new Date(a.dueDate || a.start) - new Date(b.dueDate || b.start)));
  out.unacked.sort((a, b) => new Date(a.start) - new Date(b.start));
  const planKey = (e) => (e.unscheduled ? `${e.plannedMonth || "9999-99"}-00` : moment(e.start).format("YYYY-MM-DD"));
  out.unassigned.sort((a, b) => (isUrgent(b) - isUrgent(a)) || planKey(a).localeCompare(planKey(b)));
  out.followup.sort((a, b) => new Date(openFollowUp(a).reportedAt) - new Date(openFollowUp(b).reportedAt));
  out.close.sort((a, b) => new Date(a.closeRequestedAt || 0) - new Date(b.closeRequestedAt || 0));
  return out;
}

/** แถบขั้นตอน 1–6 — กดเพื่อดูงานของขั้นนั้น */
function StepStrip({ counts, active, onPick }) {
  return (
    <Box sx={{
      display: "grid", gap: 1, mb: 1.5,
      gridTemplateColumns: { xs: "none", md: "repeat(6, minmax(0, 1fr))" },
      gridAutoFlow: { xs: "column", md: "row" }, gridAutoColumns: { xs: "42%", sm: "28%", md: "auto" },
      overflowX: { xs: "auto", md: "visible" }, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" }, pb: { xs: 0.25, md: 0 },
    }}>
      {STEPS.map((s) => {
        const n = counts[s.key] || 0;
        const on = active === s.key;
        const Icon = s.icon;
        return (
          <ButtonBase key={s.key} onClick={() => onPick(s.key)} sx={{
            display: "block", textAlign: "left", p: 1.4, borderRadius: 3, minWidth: 0,
            bgcolor: on ? alpha(s.color, 0.06) : "#fff",
            border: `1.5px solid ${on ? s.color : LINE}`,
            boxShadow: on ? `0 6px 16px -10px ${alpha(s.color, 0.6)}` : "0 1px 2px rgba(15,23,42,.04)",
            transition: "all .15s", "&:hover": { borderColor: on ? s.color : "#cbd5e1" },
          }}>
            <Stack direction="row" alignItems="center" spacing={0.75}>
              <Box sx={{ width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: "0.7rem", fontWeight: 900, color: on ? "#fff" : MUTED, bgcolor: on ? s.color : "#f1f5f9", flexShrink: 0 }}>{s.n}</Box>
              <Typography noWrap sx={{ fontSize: "0.7rem", fontWeight: 700, color: MUTED }}>{s.step}</Typography>
            </Stack>
            <Stack direction="row" alignItems="flex-end" justifyContent="space-between" sx={{ mt: 0.9 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: "0.82rem", fontWeight: 800, color: INK }}>{s.label}</Typography>
                <Typography sx={{ fontSize: "1.45rem", fontWeight: 900, lineHeight: 1.15, color: n ? s.color : "#cbd5e1", fontVariantNumeric: "tabular-nums" }}>{n}</Typography>
              </Box>
              <Icon sx={{ fontSize: 22, color: n ? alpha(s.color, 0.8) : "#e2e8f0" }} />
            </Stack>
          </ButtonBase>
        );
      })}
    </Box>
  );
}

const placeOf = (e) => [e.site || e.company, e.system, e.time ? `ครั้งที่ ${formatRoundLabel(e.time, e.visitCount, e)}` : ""].filter(Boolean).join(" · ");
const teamOf = (e) => [e.team, ...(e.teamMembers || []).map((m) => m?.name)].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(", ");

/** รายละเอียดเฉพาะขั้น (บรรทัดที่ 3 ของแถว) */
function stepDetail(step, e) {
  if (step === "info") return e.infoPendingNote ? `ขาด: ${e.infoPendingNote}` : "ข้อมูลยังไม่ครบ";
  if (step === "urgent") {
    const d = dueInfo(e);
    return [isUrgent(e) ? "⚡ งานด่วน" : "", d ? (d.overdue ? `เลยวันครบกำหนด ${-d.daysLeft} วัน` : `ครบกำหนด ${formatThai(d.due, "D MMM")}`) : ""].filter(Boolean).join(" · ");
  }
  if (step === "unassigned") {
    if (e.unscheduled) {
      return [e.contactName ? `ผู้ติดต่อ ${e.contactName}${e.contactTel ? ` ${e.contactTel}` : ""}` : "", e.description].filter(Boolean).join(" · ") || "รับแจ้งแล้ว — ยังไม่ลงวันที่";
    }
    return "ลงตารางแล้ว แต่ยังไม่ได้มอบหมายหัวหน้าทีม";
  }
  if (step === "unacked") return teamOf(e) ? `ทีม: ${teamOf(e)}` : "";
  if (step === "followup") {
    const f = openFollowUp(e);
    return [f.reason, f.note, `ต่อไป: ${f.nextOwner}`, f.proposedDate ? `เสนอนัด ${formatThai(moment(f.proposedDate), "D MMM")}` : ""].filter(Boolean).join(" · ");
  }
  if (step === "close") return `${e.closeRequestedBy || "ช่าง"} ขอปิดงาน${e.closeRequestedAt ? ` · ${formatThai(moment(e.closeRequestedAt), "D MMM HH:mm")}` : ""}`;
  return "";
}

function JobRow({ e, step, color, action }) {
  const draft = Boolean(e.unscheduled);
  const start = draft ? moment(e.plannedMonth || moment().format("YYYY-MM"), "YYYY-MM") : moment(e.start);
  const isToday = !draft && start.isSame(moment(), "day");
  return (
    <Stack direction="row" alignItems="center" spacing={1.5} sx={{
      px: { xs: 1.5, sm: 2 }, py: 1.4, borderTop: `1px solid ${LINE}`, "&:first-of-type": { borderTop: 0 },
      transition: "background-color .12s", "&:hover": { bgcolor: alpha(ACCENT, 0.03) },
    }}>
      <Box component={Link} to={draft ? "/event" : `/operation/${e._id}`} sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1, minWidth: 0, textDecoration: "none", color: "inherit" }}>
        <Box sx={{
          width: 48, minHeight: 48, borderRadius: 2, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          bgcolor: isToday ? alpha(ACCENT, 0.1) : draft ? alpha(AMBER, 0.06) : "#f8fafc", border: `1px solid ${isToday ? alpha(ACCENT, 0.3) : draft ? alpha(AMBER, 0.3) : LINE}`,
        }}>
          {draft ? (
            <>
              <Typography sx={{ fontSize: "0.6rem", fontWeight: 800, color: AMBER, lineHeight: 1.2 }}>รอลงแผน</Typography>
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 900, color: INK, lineHeight: 1.2 }}>{e.plannedMonth ? formatThai(start, "MMM") : "—"}</Typography>
            </>
          ) : (
            <>
              <Typography sx={{ fontSize: "1rem", fontWeight: 900, lineHeight: 1.1, color: isToday ? ACCENT : INK }}>{start.format("D")}</Typography>
              <Typography sx={{ fontSize: "0.62rem", fontWeight: 700, color: isToday ? ACCENT : MUTED }}>{isToday ? "วันนี้" : formatThai(start, "MMM")}</Typography>
            </>
          )}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
            <Typography noWrap sx={{ fontWeight: 800, fontSize: "0.92rem", color: INK }}>{e.title || "งาน"}</Typography>
            {e.jobNo && <Typography noWrap sx={{ fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8", flexShrink: 0 }}>{e.jobNo}</Typography>}
          </Stack>
          <Typography noWrap sx={{ fontSize: "0.78rem", color: "#475569" }}>{placeOf(e) || "-"}</Typography>
          {stepDetail(step, e) && <Typography noWrap sx={{ fontSize: "0.74rem", fontWeight: 700, color }}>{stepDetail(step, e)}</Typography>}
          <Box sx={{ display: { xs: "block", sm: "none" } }}><JobFlowFlags event={e} /></Box>
        </Box>
        <Box sx={{ display: { xs: "none", sm: "block" }, flexShrink: 0, maxWidth: 260 }}><JobFlowFlags event={e} /></Box>
      </Box>
      {action || <ChevronRight sx={{ color: "#cbd5e1", flexShrink: 0 }} />}
    </Stack>
  );
}

const BTN_SX = { flexShrink: 0, textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: ACCENT, "&:hover": { bgcolor: "#1d4ed8", boxShadow: "none" }, fontSize: "0.8rem", px: 1.5, whiteSpace: "nowrap" };

export default function JobFollow() {
  const { userData } = useAuth() || {};
  const isAdmin = can(userData, "editAnyJob") || can(userData, "assignDispatch");
  const [events, setEvents] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [active, setActive] = useState(null);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    try {
      const [res, dr] = await Promise.all([
        EventService.getEventOp(),
        EventService.GetDraftEvents().catch(() => null),
      ]);
      setEvents(res?.userEvents || []);
      setDrafts(Array.isArray(dr?.drafts) ? dr.drafts : []);
    } catch {
      setEvents((prev) => prev || []);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useRealtime("events", () => { load(); });

  const buckets = useMemo(() => classifyJobs(events || [], moment(), drafts), [events, drafts]);
  const counts = useMemo(() => Object.fromEntries(STEPS.map((s) => [s.key, buckets[s.key].length])), [buckets]);
  const current = active || DEFAULT_ORDER.find((k) => counts[k] > 0) || "followup";
  const step = STEPS.find((s) => s.key === current);
  const list = buckets[current] || [];
  const total = new Set(Object.values(buckets).flat().map((e) => e.jobGroupId || e._id)).size;

  const act = async (id, fn, ok) => {
    setBusyId(id);
    try {
      await fn();
      await load();
      refreshAppBadges();
      Swal.fire({ icon: "success", title: ok, timer: 1200, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: err?.response?.data?.message || "กรุณาลองใหม่" });
    } finally {
      setBusyId("");
    }
  };

  // ✅ ขั้นที่ 1 รับแจ้งงาน — ฟอร์มเดียวกับ "งานวางแผนล่วงหน้า" ในปฏิทิน (ยังไม่ต้องรู้วันที่)
  const openIntake = (existingDraft) => getAddDraftEvent({
    defaultMonth: moment().format("YYYY-MM"),
    existingDraft,
    events: events || [],
    drafts,
    userData,
    onSaved: async () => { await load(); refreshAppBadges(); setActive("unassigned"); },
    CustomerService, AuthService, JobTypeService, SystemTypeService, EventService, Swal, TomSelect, moment,
  });

  const { userId, fname } = me();
  const actionFor = (e) => {
    if (e.unscheduled) {
      return (
        <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0 }}>
          <Button variant="outlined" onClick={() => openIntake(e)} startIcon={<EditOutlined sx={{ fontSize: "16px !important" }} />}
            sx={{ ...BTN_SX, bgcolor: "#fff", color: ACCENT, borderColor: alpha(ACCENT, 0.4), "&:hover": { bgcolor: alpha(ACCENT, 0.05), borderColor: ACCENT }, display: { xs: "none", sm: "inline-flex" } }}>แก้ไข</Button>
          <Button component={Link} to="/event" variant="contained" sx={BTN_SX}>ลงตาราง</Button>
        </Stack>
      );
    }
    if (current === "followup" && isAdmin) {
      return <Button variant="contained" disabled={busyId === e._id} onClick={() => act(e._id, () => EventService.ResolveFollowUp(e._id, { resolution: "ลงนัดใหม่แล้ว" }), "จัดการแล้ว")} sx={BTN_SX}>จัดการแล้ว</Button>;
    }
    if (current === "unacked" && isParticipant(e, userId, fname) && !isAckedBy(e, userId)) {
      return <Button variant="contained" disabled={busyId === e._id} startIcon={<ThumbUpAltOutlined sx={{ fontSize: "16px !important" }} />} onClick={() => act(e._id, () => EventService.AckJob(e._id), "รับงานแล้ว")} sx={BTN_SX}>รับงาน</Button>;
    }
    if (current === "close" && isAdmin) {
      return <Button component={Link} to={`/operation/${e._id}`} variant="contained" sx={BTN_SX}>ไปตรวจ</Button>;
    }
    if ((current === "unassigned" || current === "info") && isAdmin) {
      return <Button component={Link} to={`/operation/${e._id}`} variant="outlined" sx={{ ...BTN_SX, bgcolor: "#fff", color: ACCENT, borderColor: alpha(ACCENT, 0.4), "&:hover": { bgcolor: alpha(ACCENT, 0.05), borderColor: ACCENT } }}>เปิดงาน</Button>;
    }
    return null;
  };

  return (
    <Box sx={{ px: { xs: 1.5, sm: 2.5 }, py: { xs: 1.25, sm: 2.5 }, maxWidth: 1200, mx: "auto" }}>
      <PageHeader icon={<FactCheckOutlined />} title="ติดตามงาน"
        subtitle={events ? (total ? `งานที่ต้องตามต่อ ${total} งาน · แยกตามขั้นตอนทำงาน` : "ไม่มีงานค้างในทุกขั้นตอน") : "กำลังโหลด..."}
        actions={
          <Button variant="contained" startIcon={<AddRounded />} onClick={() => openIntake()} disabled={!events}
            sx={{ ...BTN_SX, height: 40, px: { xs: 1.25, sm: 2 } }}>
            <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>รับแจ้งงานใหม่</Box>
            <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>รับแจ้งงาน</Box>
          </Button>
        } />

      {!events ? (
        <Stack spacing={1}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={76} sx={{ borderRadius: 3 }} />)}</Stack>
      ) : (
        <>
          <StepStrip counts={counts} active={current} onPick={setActive} />

          <Panel>
            <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 2, py: 1.4, borderBottom: `1px solid ${LINE}`, bgcolor: alpha(step.color, 0.04) }}>
              <Box sx={{ width: 34, height: 34, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: alpha(step.color, 0.12), color: step.color, flexShrink: 0 }}>
                <step.icon sx={{ fontSize: 19 }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 900, fontSize: "0.98rem", color: INK }}>
                  ขั้น {step.n} · {step.label} <Box component="span" sx={{ color: step.color }}>({list.length})</Box>
                </Typography>
                <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{step.hint}</Typography>
              </Box>
            </Stack>
            {list.length ? list.map((e) => (
              <JobRow key={e._id} e={e} step={current} color={step.color} action={actionFor(e)} />
            )) : (
              <Box sx={{ p: 2 }}>
                <EmptyState icon={<CheckCircleRounded />} title="ไม่มีงานค้างในขั้นนี้" hint="เรียบร้อยดี 👍" />
              </Box>
            )}
          </Panel>
        </>
      )}
    </Box>
  );
}
