/**
 * JobIntake — เมนู "รับงาน" (9 ต.ค. 2569)
 *
 * ผู้ใช้: "รับงานคือกรอกรับงานไว้ก่อน ค่อยส่งลงตารางจริง ไม่ต้องอะไรมากมาย ทำให้เข้าใจง่ายๆ"
 *        "ทำให้ขั้นตอนต่างๆ เชื่อมโยงกัน และดูง่าย" · "ไม่ควรเอางานเก่ามารวม"
 *
 *   • เห็นเฉพาะงานที่รับผ่านปุ่ม "รับงานใหม่" (intakeAt) — งานเก่า/งานที่ลงปฏิทินตรงๆ ไม่มาปน
 *   • ทุกงานมีแถบขั้นตอนเดียวกัน: รับงาน → ลงตาราง → ช่างทำงาน → ตรวจปิดงาน → เสร็จ
 *     บอกชัดว่าอยู่ขั้นไหน และปุ่มถัดไปคืออะไร (ส่งลงตาราง / ดูงาน)
 *   • "ส่งลงตาราง" = เลือกวัน + หัวหน้าทีม + ผู้รับผิดชอบงาน ในหน้านี้เลย ไม่ต้องไปลากในปฏิทิน
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import moment from "moment";
import Swal from "sweetalert2";
import TomSelect from "tom-select";
import "tom-select/dist/css/tom-select.css";
import {
  Box, Stack, Typography, Button, ButtonBase, Skeleton, Dialog, DialogContent, DialogActions, IconButton, TextField, MenuItem,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  PostAddOutlined, AddRounded, EditOutlined, ChevronRight, Close, EventAvailableOutlined, CheckRounded,
  ApartmentOutlined, CalendarMonthOutlined, GroupsOutlined, PersonOutlineOutlined, NotesOutlined, HourglassTopRounded, ReportProblemOutlined,
  BlockRounded, RestoreRounded, AssignmentIndOutlined,
} from "@mui/icons-material";
import EventService from "@/shared/services/EventService";
import CustomerService from "@/shared/services/CustomerService";
import JobTypeService from "@/shared/services/JobTypeService";
import SystemTypeService from "@/shared/services/SystemTypeService";
import AuthService from "@/shared/services/authService";
import useRealtime from "@/shared/realtime/useRealtime";
import { refreshAppBadges } from "@/shared/hooks/useAppBadges";
import { useAuth } from "@/features/auth/AuthContext";
import { formatThai } from "@/shared/utils/thaiDate";
import { PageHeader, Panel, EmptyState, INK, MUTED, LINE, ACCENT, SURFACE } from "@/shared/ui/PageKit";
import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import { getAddDraftEvent } from "@/features/calendar/components/EventForms/AddDraftEvent";
import { isUrgent, openFollowUp } from "@/shared/utils/jobFlow";
import { nextStepOf } from "@/shared/ui/JobFlow";
import { can } from "@/shared/utils/roles";

const AMBER = "#d97706";
const GREEN = "#16a34a";
const RED = "#dc2626";

/** ขั้นตอนของงานที่รับไว้ — ใช้ทั้งแถบขั้นตอนและแท็บ */
const STAGES = ["รับงาน", "ลงตาราง", "ช่างทำงาน", "ตรวจปิดงาน", "เสร็จ"];

/** งานนี้อยู่ขั้นไหน + ข้อความสถานะ */
const stageOf = (e) => {
  if (e.cancelledAt) return { i: -1, label: "ยกเลิกแล้ว", color: MUTED };
  if (e.unscheduled) return { i: 0, label: "รอส่งลงตาราง", color: AMBER };
  if (e.status === "ดำเนินการเสร็จสิ้น") return { i: 4, label: "เสร็จสิ้น", color: GREEN };
  if (e.closeRequested) return { i: 3, label: "รอตรวจปิดงาน", color: ACCENT };
  if (openFollowUp(e)) return { i: 2, label: `งานไม่เสร็จ · ${openFollowUp(e).reason}`, color: AMBER };
  if (e.status === "กำลังดำเนินการ") return { i: 2, label: "ช่างกำลังทำงาน", color: ACCENT };
  return { i: 1, label: "ลงตารางแล้ว", color: ACCENT };
};

const TABS = [
  { key: "waiting", label: "รอส่งลงตาราง", short: "รอลงตาราง", test: (s) => s.i === 0 },
  { key: "active", label: "กำลังดำเนินการ", short: "กำลังทำ", test: (s) => s.i >= 1 && s.i <= 3 },
  { key: "done", label: "เสร็จแล้ว", short: "เสร็จแล้ว", test: (s) => s.i === 4 },
  // ✅ แท็บ "ยกเลิก" โชว์เฉพาะตอนมีงานที่ยกเลิก (ไม่กินที่บนมือถือโดยไม่จำเป็น)
  { key: "cancelled", label: "ยกเลิก", short: "ยกเลิก", test: (s) => s.i === -1, hideEmpty: true },
];

const BTN = { textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", whiteSpace: "nowrap", fontSize: "0.82rem" };
const PRIMARY = { ...BTN, bgcolor: ACCENT, color: "#fff", "&:hover": { bgcolor: "#1d4ed8", boxShadow: "none" } };

/** แถบขั้นตอน 5 ช่อง — ผ่านแล้วสีเขียว · ขั้นปัจจุบันสีของสถานะ · ยังไม่ถึงสีเทา (กว้างเท่ากันทุกจอ ไม่ล้น) */
function StageBar({ stage }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${STAGES.length}, minmax(0, 1fr))`, gap: 0.5, mt: 1.25 }}>
      {STAGES.map((name, i) => {
        const done = i < stage.i || stage.i === 4;
        const cur = i === stage.i && stage.i !== 4;
        const c = done ? GREEN : cur ? stage.color : "#e2e8f0";
        return (
          <Box key={name} sx={{ minWidth: 0 }}>
            <Box sx={{ height: 5, borderRadius: 99, bgcolor: c }} />
            <Stack direction="row" alignItems="center" spacing={0.3} sx={{ mt: 0.5, minWidth: 0 }}>
              {done && <CheckRounded sx={{ fontSize: 12, color: GREEN, flexShrink: 0 }} />}
              <Typography noWrap sx={{ fontSize: "0.66rem", fontWeight: cur ? 900 : 600, color: cur ? stage.color : done ? "#15803d" : "#94a3b8" }}>{name}</Typography>
            </Stack>
          </Box>
        );
      })}
    </Box>
  );
}

/**
 * กล่องส่งลงตาราง — เลือกวันเริ่ม/วันสิ้นสุด หัวหน้าทีม และผู้รับผิดชอบงาน
 *
 * ✅ (10 ต.ค. 2569 ผู้ใช้: "ให้เลือกผู้รับผิดชอบงานได้ด้วย ให้สมบูรณ์และสอดคล้อง")
 *   • หัวหน้าทีม = คนที่เข้างานรอบนี้ (team/resPerson) · ผู้รับผิดชอบงาน = คนดูแลทั้งงาน (responsiblePerson)
 *     — แยกกันแบบเดียวกับหัวกล่องแก้ไขงาน (EditEvent) และหน้าภาพรวมงาน
 *   • บันทึกผู้รับผิดชอบผ่าน /events/basic-info ตัวเดียวกับหน้าอื่น → ทุกหน้าเห็นชื่อเดียวกัน
 *   • มอบหมายได้เฉพาะผู้มีสิทธิ์ editContracts (เหมือน EditEvent · server เช็คซ้ำ) — คนอื่นเห็นชื่อแต่เลือกไม่ได้
 */
function ScheduleDialog({ job, employees, canAssignResponsible, onClose, onDone }) {
  const defStart = job.plannedMonth && job.plannedMonth > moment().format("YYYY-MM")
    ? moment(job.plannedMonth, "YYYY-MM").startOf("month").format("YYYY-MM-DD")
    : moment().add(1, "day").format("YYYY-MM-DD");
  const [start, setStart] = useState(defStart);
  const [end, setEnd] = useState(defStart);
  const [team, setTeam] = useState(job.team || "");
  const initialResp = job.responsiblePerson || "";
  const [resp, setResp] = useState(initialResp);
  const [saving, setSaving] = useState(false);
  const people = useMemo(
    () => employees.filter((u) => u.fname).slice().sort((a, b) => a.fname.localeCompare(b.fname, "th")),
    [employees],
  );
  // ชื่อเดิมที่ไม่อยู่ในรายชื่อพนักงานแล้ว (ข้อมูลเก่า) ยังต้องเห็นอยู่
  const extra = (v) => (v && !people.some((u) => u.fname === v) ? [<MenuItem key={`x-${v}`} value={v}>{v}</MenuItem>] : []);
  const ok = start && (!end || end >= start);

  const save = async () => {
    if (!ok) return;
    setSaving(true);
    try {
      const emp = employees.find((u) => u.fname === team);
      const last = end || start;
      await EventService.ScheduleDraftEvent(job._id, {
        date: start, start, end: moment(last).add(1, "day").format("YYYY-MM-DD"),
        ...(team ? { team, resPerson: emp?._id || "" } : {}),
      });
      // ผู้รับผิดชอบงาน — หลังลงตารางสำเร็จเท่านั้น (ถ้าส่งลงตารางไม่ผ่าน จะไม่มีอะไรถูกเปลี่ยน)
      let respFailed = false;
      if (canAssignResponsible && resp !== initialResp) {
        const person = people.find((u) => u.fname === resp);
        try {
          await EventService.UpdateBasicInfo([job._id], { responsiblePerson: resp, responsiblePersonId: person?._id ? String(person._id) : "" });
        } catch {
          respFailed = true;
        }
      }
      onDone();
      if (respFailed) {
        Swal.fire({ icon: "warning", title: "ส่งลงตารางแล้ว", text: "แต่บันทึกผู้รับผิดชอบงานไม่สำเร็จ — แก้ได้จากหน้าแก้ไขงาน" });
        return;
      }
      Swal.fire({ icon: "success", title: "ส่งลงตารางแล้ว", text: "งานขึ้นในตารางงานช่างเรียบร้อย", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "ส่งลงตารางไม่สำเร็จ", text: err?.response?.data?.message || "กรุณาลองใหม่" });
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
      <Stack direction="row" alignItems="center" gap={1.25} sx={{ px: 2.5, pt: 2, pb: 1.5, borderBottom: `1px solid ${LINE}` }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: alpha(ACCENT, 0.1), color: ACCENT }}>
          <EventAvailableOutlined sx={{ fontSize: 20 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900, fontSize: "1rem", color: INK }}>ส่งลงตาราง</Typography>
          <Typography noWrap sx={{ fontSize: "0.76rem", color: MUTED }}>{[job.title, job.site || job.company, job.jobNo].filter(Boolean).join(" · ")}</Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
      </Stack>
      <DialogContent sx={{ px: 2.5, py: 2 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.25 }}>
          <ThaiDatePicker label="วันที่เข้างาน" value={start} onChange={(v) => { setStart(v || ""); if (!end || (v && end < v)) setEnd(v || ""); }} />
          <ThaiDatePicker label="ถึงวันที่" value={end} onChange={(v) => setEnd(v || "")} minDate={start ? moment(start) : undefined} />
        </Box>
        <TextField select fullWidth size="small" label="หัวหน้าทีมที่เข้างาน (ไม่บังคับ)" value={team} onChange={(e) => setTeam(e.target.value)} sx={{ mt: 2 }}
          helperText="คนที่นำทีมเข้าหน้างานรอบนี้">
          <MenuItem value=""><em>ยังไม่ระบุ — มอบหมายทีหลังได้</em></MenuItem>
          {people.map((u) => <MenuItem key={u._id} value={u.fname}>{[u.fname, u.lname].filter(Boolean).join(" ")}</MenuItem>)}
          {extra(team)}
        </TextField>
        <TextField select fullWidth size="small" label="ผู้รับผิดชอบงาน" value={resp} onChange={(e) => setResp(e.target.value)} sx={{ mt: 1.5 }}
          disabled={!canAssignResponsible}
          helperText={canAssignResponsible ? "คนดูแลงานนี้ทั้งงาน ตั้งแต่ลงตารางจนปิดงาน" : "มอบหมายได้เฉพาะแอดมิน/ผู้จัดการ"}>
          <MenuItem value=""><em>ยังไม่ได้มอบหมาย</em></MenuItem>
          {people.map((u) => <MenuItem key={u._id} value={u.fname}>{[u.fname, u.lname].filter(Boolean).join(" ")}</MenuItem>)}
          {extra(resp)}
        </TextField>
        <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1.5 }}>
          ส่งแล้วงานจะขึ้นในตารางงานช่างทันที · เวลา/ลูกทีมเพิ่มได้ภายหลังจากหน้าตารางงาน
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5, borderTop: `1px solid ${LINE}`, gap: 1 }}>
        <Button onClick={onClose} sx={{ ...BTN, color: MUTED }}>ยกเลิก</Button>
        <Button variant="contained" disabled={!ok || saving} onClick={save} sx={{ ...PRIMARY, px: 2.5 }}>
          {saving ? "กำลังส่ง..." : "ส่งลงตาราง"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** บรรทัดข้อมูล: ไอคอน + ข้อความ (ตัดบรรทัดได้ ไม่ล้น) */
const Line = ({ icon: Icon, children, color = "#475569", strong }) => (
  <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ minWidth: 0 }}>
    <Icon sx={{ fontSize: 15, color: "#94a3b8", mt: "2px", flexShrink: 0 }} />
    <Typography sx={{ fontSize: "0.8rem", color, fontWeight: strong ? 700 : 500, lineHeight: 1.45, minWidth: 0, overflowWrap: "anywhere" }}>{children}</Typography>
  </Stack>
);

function JobCard({ job, onSchedule, onEdit, onCancel, onRestore }) {
  const st = stageOf(job);
  const fu = openFollowUp(job);
  const team = [job.team, ...(job.teamMembers || []).map((m) => m?.name)].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(", ");
  const when = job.unscheduled
    ? (job.plannedMonth ? `ตั้งใจเข้างาน ${formatThai(moment(job.plannedMonth, "YYYY-MM"), "MMMM YYYY")}` : "ยังไม่กำหนดเดือน")
    : `เข้างาน ${formatThai(moment(job.start), "D MMM YYYY")}${job.startTime ? ` ${job.startTime}` : ""}`;
  const due = job.dueDate ? formatThai(moment(job.dueDate), "D MMM YYYY") : "";

  const GHOST = { ...BTN, color: "#334155", borderColor: LINE, "&:hover": { borderColor: "#cbd5e1", bgcolor: SURFACE } };
  const actions = st.i === -1 ? (
    <Button variant="outlined" onClick={() => onRestore(job)} startIcon={<RestoreRounded sx={{ fontSize: "17px !important" }} />}
      sx={{ ...GHOST, flex: { xs: 1, sm: "0 0 auto" } }}>นำกลับมา</Button>
  ) : st.i === 0 ? (
    <>
      <Button variant="outlined" onClick={() => onEdit(job)} startIcon={<EditOutlined sx={{ fontSize: "16px !important" }} />}
        sx={{ ...GHOST, flex: { xs: 1, sm: "0 0 auto" } }}>แก้ไข</Button>
      <Button variant="outlined" onClick={() => onCancel(job)} startIcon={<BlockRounded sx={{ fontSize: "16px !important" }} />}
        sx={{ ...BTN, flex: { xs: 1, sm: "0 0 auto" }, color: RED, borderColor: alpha(RED, 0.35), "&:hover": { borderColor: RED, bgcolor: alpha(RED, 0.04) } }}>ยกเลิก</Button>
      <Button variant="contained" onClick={() => onSchedule(job)} startIcon={<EventAvailableOutlined sx={{ fontSize: "17px !important" }} />}
        sx={{ ...PRIMARY, flex: { xs: 1.6, sm: "0 0 auto" } }}>ส่งลงตาราง</Button>
    </>
  ) : (
    <Button component={Link} to={`/operation/${job._id}`} variant="outlined" endIcon={<ChevronRight />}
      sx={{ ...BTN, flex: { xs: 1, sm: "0 0 auto" }, color: ACCENT, borderColor: alpha(ACCENT, 0.4), "&:hover": { borderColor: ACCENT, bgcolor: alpha(ACCENT, 0.04) } }}>ดูงาน</Button>
  );

  return (
    <Box sx={{ px: { xs: 1.75, sm: 2.25 }, py: 1.75, borderTop: `1px solid ${LINE}`, "&:first-of-type": { borderTop: 0 } }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 1.25, sm: 2 }} alignItems={{ sm: "flex-start" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* หัว: สถานะ · เลข Job · ป้าย */}
          <Stack direction="row" spacing={0.6} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 0.5, mb: 0.6 }}>
            <Box component="span" sx={{ px: 1, height: 22, display: "inline-flex", alignItems: "center", borderRadius: 99, fontSize: "0.72rem", fontWeight: 800, color: st.color, bgcolor: alpha(st.color, 0.1) }}>{st.label}</Box>
            {job.jobNo && <Typography component="span" sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8" }}>{job.jobNo}</Typography>}
            {isUrgent(job) && st.i < 4 && (
              <Box component="span" sx={{ px: 0.8, height: 22, display: "inline-flex", alignItems: "center", borderRadius: 99, fontSize: "0.7rem", fontWeight: 800, color: "#fff", bgcolor: RED }}>⚡ ด่วน</Box>
            )}
            {job.infoPending && st.i < 4 && (
              <Box component="span" sx={{ px: 0.8, height: 22, display: "inline-flex", alignItems: "center", borderRadius: 99, fontSize: "0.7rem", fontWeight: 800, color: AMBER, bgcolor: alpha(AMBER, 0.12) }}>รอข้อมูล</Box>
            )}
          </Stack>
          {/* ชื่องาน · โครงการ — ตัดบรรทัดได้ ไม่ตัดทิ้ง */}
          <Typography sx={{ fontWeight: 800, fontSize: "1rem", color: INK, lineHeight: 1.35, overflowWrap: "anywhere" }}>
            {job.title || "งาน"}{job.system ? ` · ${job.system}` : ""}
          </Typography>
          <Stack spacing={0.35} sx={{ mt: 0.6 }}>
            <Line icon={ApartmentOutlined} strong>{[job.site, job.company && job.company !== job.site ? job.company : ""].filter(Boolean).join(" · ") || "-"}</Line>
            <Line icon={CalendarMonthOutlined}>{when}{due ? ` · ต้องเสร็จภายใน ${due}` : ""}</Line>
            {!job.unscheduled && <Line icon={GroupsOutlined}>{team ? `ทีม ${team}` : "ยังไม่มอบหมายทีม"}</Line>}
            <Line icon={AssignmentIndOutlined}>{job.responsiblePerson ? `ผู้รับผิดชอบ ${job.responsiblePerson}` : "ยังไม่มอบหมายผู้รับผิดชอบ"}</Line>
            {(job.contactName || job.contactTel) && (
              <Line icon={PersonOutlineOutlined}>
                {job.contactName || "ผู้ติดต่อ"}
                {job.contactTel && <> · <Box component="a" href={`tel:${job.contactTel}`} sx={{ color: ACCENT, fontWeight: 700, textDecoration: "none" }}>{job.contactTel}</Box></>}
              </Line>
            )}
            {job.description && <Line icon={NotesOutlined}>{job.description}</Line>}
            {job.infoPending && job.infoPendingNote && <Line icon={HourglassTopRounded} color={AMBER}>ขาด: {job.infoPendingNote}</Line>}
            {fu && st.i === 2 && <Line icon={ReportProblemOutlined} color={AMBER} strong>{fu.reason}{fu.note ? ` — ${fu.note}` : ""} · ต่อไป: {fu.nextOwner}</Line>}
            {st.i === -1 && (
              <Line icon={BlockRounded} color={RED} strong>
                เหตุผล: {job.cancelReason || "-"} · ยกเลิกโดย {job.cancelledBy || "-"} {formatThai(moment(job.cancelledAt), "D MMM YYYY HH:mm")}
              </Line>
            )}
          </Stack>
          {st.i >= 0 && <StageBar stage={st} />}
          {/* ✅ บอกชัดว่าต่อไปต้องทำอะไร (ตัวเดียวกับกล่อง "ขั้นตอนถัดไป" ในหน้าการดำเนินงาน) */}
          {(() => {
            const nx = job.cancelledAt ? null : job.unscheduled
              ? { title: "ส่งลงตาราง", desc: "กด “ส่งลงตาราง” เลือกวันเข้างาน หัวหน้าทีม และผู้รับผิดชอบงาน" }
              : st.i >= 0 && st.i < 4 ? nextStepOf(job, "admin") : null;
            return nx ? (
              <Typography sx={{ fontSize: "0.78rem", color: "#334155", mt: 0.75 }}>
                <Box component="span" sx={{ fontWeight: 900, color: nx.tone || AMBER }}>ต่อไป: {nx.title}</Box> — {nx.desc}
              </Typography>
            ) : null;
          })()}
        </Box>
        <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0, width: { xs: "100%", sm: "auto" } }}>{actions}</Stack>
      </Stack>
    </Box>
  );
}

export default function JobIntake() {
  const { userData } = useAuth() || {};
  const [jobs, setJobs] = useState(null);
  const [rawEvents, setRawEvents] = useState([]);
  const [rawDrafts, setRawDrafts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [tab, setTab] = useState("waiting");
  const [scheduling, setScheduling] = useState(null);

  const load = useCallback(async () => {
    try {
      const [dr, ev] = await Promise.all([
        EventService.GetDraftEvents({ includeCancelled: true }).catch(() => null),
        EventService.getEventOp().catch(() => null),
      ]);
      const drafts = Array.isArray(dr?.drafts) ? dr.drafts : [];
      const events = ev?.userEvents || [];
      setRawDrafts(drafts.filter((d) => !d.cancelledAt));
      setRawEvents(events);
      // ✅ เฉพาะงานที่รับผ่านเมนูนี้ — งานหลายวันรวมเป็นงานเดียว (ใช้วันแรก)
      const seen = new Set();
      const list = [...drafts, ...events.slice().sort((a, b) => new Date(a.start) - new Date(b.start))]
        .filter((e) => e.intakeAt)
        .filter((e) => { const k = e.jobGroupId || e._id; if (seen.has(k)) return false; seen.add(k); return true; });
      setJobs(list);
    } catch {
      setJobs((p) => p || []);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { AuthService.getAllUserData().then((r) => setEmployees(r?.allUser || [])).catch(() => {}); }, []);
  useRealtime("events", () => { load(); });

  const openForm = (existingDraft) => getAddDraftEvent({
    intake: true,
    defaultMonth: moment().format("YYYY-MM"),
    existingDraft,
    events: rawEvents,
    drafts: rawDrafts,
    userData,
    onSaved: async () => { await load(); refreshAppBadges(); setTab("waiting"); },
    CustomerService, AuthService, JobTypeService, SystemTypeService, EventService, Swal, TomSelect, moment,
  });

  // ✅ ยกเลิกงานที่รับไว้แต่ไม่ได้ทำ — บังคับเหตุผล · เก็บไว้ในแท็บ "ยกเลิก" นำกลับมาได้
  const cancelJob = async (job) => {
    const r = await Swal.fire({
      title: "ยกเลิกงานนี้?",
      html: `<div style="font-size:14px;color:#475569">${[job.title, job.site || job.company, job.jobNo].filter(Boolean).join(" · ")}</div>`,
      input: "textarea",
      inputLabel: "เหตุผลที่ยกเลิก",
      inputPlaceholder: "เช่น ลูกค้ายกเลิก / ได้ช่างที่อื่นแล้ว / รับงานซ้ำ",
      inputValidator: (v) => (!String(v || "").trim() ? "กรุณาระบุเหตุผล" : undefined),
      showCancelButton: true,
      confirmButtonText: "ยกเลิกงาน",
      cancelButtonText: "ไม่ยกเลิก",
      confirmButtonColor: RED,
      reverseButtons: true,
    });
    if (!r.isConfirmed) return;
    try {
      await EventService.CancelIntake(job._id, { reason: r.value });
      await load(); refreshAppBadges();
      Swal.fire({ icon: "success", title: "ยกเลิกงานแล้ว", text: "ดูย้อนหลังได้ที่แท็บ “ยกเลิก”", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "ยกเลิกไม่สำเร็จ", text: err?.response?.data?.message || "กรุณาลองใหม่" });
    }
  };
  const restoreJob = async (job) => {
    try {
      await EventService.CancelIntake(job._id, { restore: true });
      await load(); refreshAppBadges(); setTab("waiting");
      Swal.fire({ icon: "success", title: "นำงานกลับมาแล้ว", timer: 1200, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: err?.response?.data?.message || "กรุณาลองใหม่" });
    }
  };

  const withStage = useMemo(() => (jobs || []).map((j) => ({ j, s: stageOf(j) })), [jobs]);
  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.key, withStage.filter((x) => t.test(x.s)).length])), [withStage]);
  const list = useMemo(() => {
    const t = TABS.find((x) => x.key === tab) || TABS[0];
    return withStage.filter((x) => t.test(x.s)).map((x) => x.j)
      .sort((a, b) => (isUrgent(b) - isUrgent(a)) || (tab === "done"
        ? new Date(b.closeApprovedAt || b.updatedAt || 0) - new Date(a.closeApprovedAt || a.updatedAt || 0)
        : new Date(a.intakeAt) - new Date(b.intakeAt)));
  }, [withStage, tab]);

  return (
    <Box sx={{ px: { xs: 1.5, sm: 2.5 }, py: { xs: 1.25, sm: 2.5 }, maxWidth: 1000, mx: "auto" }}>
      <PageHeader icon={<PostAddOutlined />} title="งานใหม่"
        subtitle="กรอกไว้ก่อน แล้วส่งลงตาราง"
        actions={<Button variant="contained" startIcon={<AddRounded />} onClick={() => openForm()} disabled={!jobs} sx={{ ...PRIMARY, height: 40, px: { xs: 1.25, sm: 2 } }}>รับงานใหม่</Button>} />

      {/* แท็บตามขั้นตอน */}
      <Stack direction="row" spacing={0.75} sx={{ mb: 1.5 }}>
        {TABS.filter((t) => !t.hideEmpty || counts[t.key] > 0 || tab === t.key).map((t) => {
          const on = tab === t.key;
          return (
            <ButtonBase key={t.key} onClick={() => setTab(t.key)} sx={{
              // ✅ มือถือ: ตัวเลขบน ชื่อล่าง — 4 แท็บไม่ล้นจอ (ผู้ใช้แจ้งแท็บแรกตกขอบ)
              flex: { xs: 1, sm: "0 0 auto" }, minWidth: 0, height: { xs: 54, sm: 40 }, px: { xs: 0.5, sm: 1.75 }, borderRadius: 2.5,
              flexDirection: { xs: "column-reverse", sm: "row" }, fontSize: { xs: "0.74rem", sm: "0.84rem" }, fontWeight: 800, gap: { xs: 0.2, sm: 0.6 }, whiteSpace: "nowrap", overflow: "hidden",
              border: `1.5px solid ${on ? ACCENT : LINE}`, bgcolor: on ? alpha(ACCENT, 0.07) : "#fff", color: on ? ACCENT : "#334155",
            }}>
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>{t.label}</Box>
              <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>{t.short}</Box>
              <Box component="span" sx={{ minWidth: 20, height: 20, px: 0.6, borderRadius: 99, display: "inline-grid", placeItems: "center", fontSize: "0.72rem", bgcolor: on ? ACCENT : SURFACE, color: on ? "#fff" : MUTED }}>{counts[t.key] || 0}</Box>
            </ButtonBase>
          );
        })}
      </Stack>

      {!jobs ? (
        <Stack spacing={1}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={88} sx={{ borderRadius: 3 }} />)}</Stack>
      ) : list.length ? (
        <Panel>{list.map((j) => <JobCard key={j._id} job={j} onSchedule={setScheduling} onEdit={openForm} onCancel={cancelJob} onRestore={restoreJob} />)}</Panel>
      ) : (
        <EmptyState icon={<PostAddOutlined />}
          title={tab === "waiting" ? "ไม่มีงานรอส่งลงตาราง" : tab === "active" ? "ไม่มีงานที่กำลังดำเนินการ" : tab === "cancelled" ? "ไม่มีงานที่ยกเลิก" : "ยังไม่มีงานที่เสร็จ"}
          hint={tab === "waiting" ? "ได้งานมาแล้ว กด “รับงานใหม่” เพื่อกรอกเก็บไว้ก่อน" : undefined}
          action={tab === "waiting" ? <Button variant="contained" startIcon={<AddRounded />} onClick={() => openForm()} sx={{ ...PRIMARY, mt: 1 }}>รับงานใหม่</Button> : null} />
      )}

      {scheduling && (
        <ScheduleDialog job={scheduling} employees={employees} canAssignResponsible={can(userData, "editContracts")} onClose={() => setScheduling(null)}
          onDone={async () => { setScheduling(null); await load(); refreshAppBadges(); }} />
      )}
    </Box>
  );
}
