/**
 * JobFlow — ส่วนแสดงผล "ขั้นตอนทำงานมาตรฐาน" ที่ใช้ทั้งการ์ดงานของช่าง (TechnicianJobPanel)
 * และการ์ดงานของแอดมิน (OperationBoard → EventRowCard) — หน้าตาเดียวกันทุกที่
 *
 *   JobFlowChips  ป้ายบรรทัดเดียวใต้ชื่องาน: เลข Job · ด่วน · ครบกำหนด · รอข้อมูล · งานไม่เสร็จ · รับทราบแล้ว
 *   JobFlowPanel  กล่องการทำงาน: รอข้อมูล · อุปกรณ์ · ปุ่ม "รับทราบงาน" · งานไม่เสร็จ (แจ้ง/จัดการแล้ว)
 * ⚠️ "รับงาน" = รับงานจากลูกค้า (ขั้นที่ 1 · เมนู "รับงาน") — ปุ่มของช่างใช้คำว่า "รับทราบงาน" กันสับสน
 *
 * กฎ UI: น้ำเงิน = ปุ่มหลัก · แดง = ด่วน/เลยกำหนด · อำพัน = รอ/ค้าง · เขียว = เรียบร้อย
 */
import { useState } from "react";
import moment from "moment";
import Swal from "sweetalert2";
import { Link } from "react-router-dom";
import { Box, Stack, Typography, Button, Dialog, DialogContent, DialogActions, TextField, IconButton, ButtonBase } from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  BoltRounded, EventBusyOutlined, HourglassTopRounded, ReportProblemOutlined, HandymanOutlined,
  CheckCircleRounded, ThumbUpAltOutlined, Close, EventRepeatOutlined, CalendarMonthOutlined, TagRounded, ArrowForwardRounded,
} from "@mui/icons-material";
import EventService from "@/shared/services/EventService";
import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import { formatThai } from "@/shared/utils/thaiDate";
import {
  FOLLOW_UP_REASONS, NEXT_OWNERS, isClosedJob, isUrgent, openFollowUp, acksOf, isAckedBy, isParticipant, dueInfo, ackTracked,
} from "@/shared/utils/jobFlow";

const BLUE = "#2563eb";
const RED = "#dc2626";
const AMBER = "#d97706";
const GREEN = "#16a34a";
const ACCENT_TONE = "#2563eb";
const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e2e8f0";

const me = () => {
  try {
    const p = JSON.parse(localStorage.getItem("payload") || "{}");
    return { userId: p.userId || p._id || "", fname: p.fname || p.name || "" };
  } catch { return { userId: "", fname: "" }; }
};

const Chip = ({ color, solid, icon, children, title }) => (
  <Box component="span" title={title} sx={{
    display: "inline-flex", alignItems: "center", gap: 0.4, height: 22, px: 0.9, borderRadius: 99,
    fontSize: "0.7rem", fontWeight: 800, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums",
    color: solid ? "#fff" : color, bgcolor: solid ? color : alpha(color, 0.1),
    "& svg": { fontSize: 14 },
  }}>
    {icon}{children}
  </Box>
);

/** ป้ายสถานะขั้นตอนงาน — ไม่มีอะไรให้แสดง = ไม่ render */
export function JobFlowChips({ event, showAck = false, sx }) {
  if (!event || event.department === "sales") return null;
  const due = dueInfo(event);
  const fu = openFollowUp(event);
  const acks = acksOf(event);
  const closed = isClosedJob(event);
  const items = [];
  if (event.jobNo) items.push(<Chip key="no" color={MUTED} icon={<TagRounded />}>{event.jobNo}</Chip>);
  if (isUrgent(event) && !closed) items.push(<Chip key="u" color={RED} solid icon={<BoltRounded />}>ด่วน</Chip>);
  if (due && !closed) {
    items.push(
      <Chip key="d" color={due.overdue ? RED : due.daysLeft <= 2 ? AMBER : MUTED} icon={<EventBusyOutlined />}>
        {due.overdue ? `เลยกำหนด ${-due.daysLeft} วัน` : `ครบกำหนด ${formatThai(due.due, "D MMM")}`}
      </Chip>,
    );
  }
  if (event.infoPending && !closed) items.push(<Chip key="i" color={AMBER} icon={<HourglassTopRounded />}>รอข้อมูล</Chip>);
  if (fu && !closed) items.push(<Chip key="f" color={AMBER} icon={<ReportProblemOutlined />}>งานไม่เสร็จ · {fu.reason}</Chip>);
  if (showAck && !closed && !event.unscheduled && (acks.length || (ackTracked(event) && (event.resPerson || event.team)))) {
    items.push(acks.length
      ? <Chip key="a" color={GREEN} icon={<CheckCircleRounded />} title={acks.map((a) => a.name).join(", ")}>รับทราบแล้ว</Chip>
      : <Chip key="a" color={MUTED} icon={<ThumbUpAltOutlined />}>ยังไม่รับทราบ</Chip>);
  }
  if (!items.length) return null;
  return <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.5, ...sx }}>{items}</Stack>;
}

/** ป้ายย่อในตาราง — เฉพาะเรื่องที่ต้องสนใจ (ด่วน · เลยกำหนด · รอข้อมูล · งานไม่เสร็จ · ยังไม่รับงาน) */
export function JobFlowFlags({ event }) {
  if (!event || event.department === "sales" || isClosedJob(event)) return null;
  const due = dueInfo(event);
  const items = [];
  if (isUrgent(event)) items.push(<Chip key="u" color={RED} solid icon={<BoltRounded />}>ด่วน</Chip>);
  if (due?.overdue) items.push(<Chip key="d" color={RED} icon={<EventBusyOutlined />}>เลยกำหนด</Chip>);
  if (openFollowUp(event)) items.push(<Chip key="f" color={AMBER} icon={<ReportProblemOutlined />}>ไม่เสร็จ</Chip>);
  if (event.infoPending) items.push(<Chip key="i" color={AMBER} icon={<HourglassTopRounded />}>รอข้อมูล</Chip>);
  if (ackTracked(event) && !event.unscheduled && event.approvalStatus !== "pending" && !acksOf(event).length && moment(event.start).isAfter(moment().subtract(1, "day")))
    items.push(<Chip key="a" color={MUTED} icon={<ThumbUpAltOutlined />}>ยังไม่รับทราบ</Chip>);
  if (!items.length) return null;
  return <Stack direction="row" gap={0.4} flexWrap="wrap" sx={{ mt: 0.5 }}>{items}</Stack>;
}


/**
 * ✅ (9 ต.ค. 2569 ผู้ใช้: "ทำให้สถานะดูง่าย ชัดเจน รู้ได้ทันทีต้องทำอะไรต่อ รวมถึงไปหน้าที่เกี่ยวข้อง")
 * "ขั้นตอนถัดไป" ของงาน — ตอนนี้งานอยู่ตรงไหน · ใครต้องทำอะไร · ปุ่มพาไปทำต่อ
 * ลำดับการเช็คสำคัญ: เรื่องที่ "ติด" อยู่ก่อน (ปิดแล้ว → รออนุมัติ → รอตรวจปิด → งานไม่เสร็จ → ไม่มีทีม → รอยืนยัน → รอรับทราบ)
 */
const calendarLinkOf = (ev) => `/event?event=${ev._id}${ev.start ? `&date=${moment(ev.start).format("YYYY-MM-DD")}` : ""}&t=${Date.now()}`;
const teamText = (ev) => [ev.team, ...(ev.teamMembers || []).map((m) => m?.name)].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(", ");

export function nextStepOf(ev, mode, { mine, ackedByMe } = {}) {
  const closed = isClosedJob(ev);
  const fu = openFollowUp(ev);
  const start = moment(ev.start).startOf("day");
  const beforeDay = moment().startOf("day").isBefore(start);
  const dayText = formatThai(start, "D MMM YYYY");
  const team = teamText(ev);
  if (closed) return { tone: GREEN, title: "เสร็จสิ้น", desc: "ปิดงานเรียบร้อยแล้ว" };
  if (ev.approvalStatus === "pending") {
    return mode === "admin"
      ? { tone: AMBER, title: "รออนุมัติแผนงาน", desc: "ช่างลงงานนี้เอง — ตรวจแล้วกดอนุมัติ/ไม่อนุมัติ", action: { label: "ไปหน้าอนุมัติ", to: "/dispatch" } }
      : { tone: AMBER, title: "รอแอดมินอนุมัติ", desc: "อนุมัติแล้วจึงเริ่มงาน/ขอปิดงานได้" };
  }
  if (ev.closeRequested) {
    return mode === "admin"
      ? { tone: ACCENT_TONE, title: "ช่างขอปิดงาน — รอตรวจ", desc: "ตรวจรูป/เอกสารด้านล่าง แล้วกด “อนุมัติปิดงาน” หรือ “ไม่อนุมัติ”" }
      : { tone: ACCENT_TONE, title: "ส่งขอปิดงานแล้ว", desc: "รอแอดมินตรวจเอกสารและอนุมัติ" };
  }
  if (fu) {
    return mode === "admin"
      ? { tone: AMBER, title: `งานไม่เสร็จ — ${fu.reason}`, desc: "ลงวันนัดใหม่ในตารางงาน แล้วกด “จัดการแล้ว” ในกล่องด้านล่าง", action: { label: "เปิดตารางงาน", to: calendarLinkOf(ev) } }
      : { tone: AMBER, title: "แจ้งงานไม่เสร็จแล้ว", desc: `รอแอดมินลงนัดใหม่ · ต่อไป: ${fu.nextOwner}` };
  }
  if (mode === "admin" && !ev.resPerson && !ev.team) {
    return { tone: AMBER, title: "ยังไม่มีทีมเข้างาน", desc: "เปิดงานในตารางงาน แล้วเลือกหัวหน้าทีม/ลูกทีม", action: { label: "เปิดตารางงาน", to: calendarLinkOf(ev) } };
  }
  if (mode === "admin" && ev.status === "กำลังรอยืนยัน") {
    return { tone: AMBER, title: "รอยืนยันนัด", desc: `ยืนยันวันเข้างาน ${dayText} กับลูกค้าแล้ว กด “ยืนยันนัดแล้ว”`, action: { label: "ยืนยันนัดแล้ว", confirm: true } };
  }
  if (ackTracked(ev) && !acksOf(ev).length && mode === "admin") {
    return { tone: ACCENT_TONE, title: "รอช่างกดรับทราบงาน", desc: `เข้างาน ${dayText}${team ? ` · แจ้งทีม ${team}` : ""}` };
  }
  if (mode === "tech" && mine && ackTracked(ev) && !ackedByMe) {
    return { tone: ACCENT_TONE, title: "กดรับทราบงาน", desc: `เข้างาน ${dayText} — กดปุ่ม “รับทราบงาน” ด้านล่างให้แอดมินรู้ว่าคุณรับงานแล้ว` };
  }
  if (beforeDay) {
    return mode === "admin"
      ? { tone: ACCENT_TONE, title: "นัดหมายแล้ว", desc: `เข้างาน ${dayText}${team ? ` · ทีม ${team}` : ""}` }
      : { tone: ACCENT_TONE, title: `เข้างาน ${dayText}`, desc: "เตรียมอุปกรณ์ตามรายการ แล้วไปตามนัด" };
  }
  return mode === "admin"
    ? { tone: ACCENT_TONE, title: "ช่างกำลังทำงาน", desc: "รอช่างแนบเอกสาร แล้วกดขอปิดงาน" }
    : { tone: ACCENT_TONE, title: "ทำงาน → แนบเอกสาร → ขอปิดงาน", desc: "ถ้ายังไม่เสร็จ กด “งานยังไม่เสร็จ / ต้องนัดใหม่”" };
}

/** กล่อง "ขั้นตอนถัดไป" — แถบสีซ้าย · หัวข้อ · คำอธิบาย · ปุ่มพาไปทำต่อ */
function NextStepBox({ step, onConfirm, busy }) {
  if (!step) return null;
  const a = step.action;
  return (
    // ✅ (10 ต.ค. 2569 ผู้ใช้: "สีสันยังดูรกๆ ตัดกัน มองยาก แก้ไขให้มืออาชีพ") — พื้นเทาอ่อนกล่องเดียว ไม่มีพื้น/ขอบสีตามสถานะ
    //    สีของสถานะเหลือแค่จุดเล็กหน้าชื่อขั้นตอน · ปุ่มยังเป็นน้ำเงินสีเดียวทั้งแอป
    <Box sx={{ p: 1.25, pl: 1.5, borderRadius: 2, bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, color: MUTED, letterSpacing: 0.2 }}>ขั้นตอนถัดไป</Typography>
          <Typography sx={{ fontSize: "0.92rem", fontWeight: 800, color: INK, lineHeight: 1.3, display: "flex", alignItems: "center", gap: 0.75 }}>
            <Box component="span" sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: step.tone, flexShrink: 0 }} />
            {step.title}
          </Typography>
          <Typography sx={{ fontSize: "0.78rem", color: "#334155", mt: 0.2 }}>{step.desc}</Typography>
        </Box>
        {a && (a.to ? (
          <Button component={Link} to={a.to} variant="contained" disableElevation endIcon={<ArrowForwardRounded />}
            sx={{ flexShrink: 0, bgcolor: BLUE, "&:hover": { bgcolor: "#1d4ed8" }, textTransform: "none", fontWeight: 800, borderRadius: 2, whiteSpace: "nowrap" }}>{a.label}</Button>
        ) : a.confirm && onConfirm ? (
          <Button variant="contained" disableElevation disabled={busy} onClick={onConfirm} startIcon={<CheckCircleRounded />}
            sx={{ flexShrink: 0, bgcolor: BLUE, "&:hover": { bgcolor: "#1d4ed8" }, textTransform: "none", fontWeight: 800, borderRadius: 2, whiteSpace: "nowrap" }}>{a.label}</Button>
        ) : null)}
      </Stack>
    </Box>
  );
}

/** กล่องย่อย — หัวไอคอน + เนื้อหา */
const Block = ({ color, icon, title, children, action }) => (
  <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: alpha(color, 0.06), border: `1px solid ${alpha(color, 0.22)}` }}>
    <Stack direction="row" alignItems="flex-start" gap={1}>
      <Box sx={{ color, display: "flex", mt: 0.1, "& svg": { fontSize: 18 } }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: INK }}>{title}</Typography>
        {children}
      </Box>
      {action}
    </Stack>
  </Box>
);

/**
 * กล่องการทำงานของงาน
 * @param mode "tech" = มุมมองช่าง (ปุ่มรับทราบงาน · แจ้งงานไม่เสร็จ) · "admin" = มุมมองแอดมิน (สถานะรับทราบ · จัดการแล้ว)
 * @param onPatched (events[]) — เอางานที่ server คืนมาไปอัปเดตหน้าจอ
 */
export function JobFlowPanel({ event, mode = "tech", onPatched, onStatusUpdate, sx }) {
  const [busy, setBusy] = useState(false);
  const [fuOpen, setFuOpen] = useState(false);
  if (!event || event.department === "sales") return null;
  const { userId, fname } = me();
  const closed = isClosedJob(event);
  const fu = openFollowUp(event);
  const acks = acksOf(event);
  const mine = isParticipant(event, userId, fname);
  const ackedByMe = isAckedBy(event, userId);
  const equipment = String(event.equipment || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const pendingApproval = event.approvalStatus === "pending";

  const run = async (fn, okText) => {
    setBusy(true);
    try {
      const res = await fn();
      onPatched?.(res?.events || []);
      if (okText) Swal.fire({ icon: "success", title: okText, timer: 1300, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: err?.response?.data?.message || "กรุณาลองใหม่" });
    } finally {
      setBusy(false);
    }
  };

  const blocks = [];

  // ── ขั้น 1: รอข้อมูล ──
  if (event.infoPending && !closed) {
    blocks.push(
      <Block key="info" color={AMBER} icon={<HourglassTopRounded />} title="รอข้อมูลเพิ่มเติม">
        <Typography sx={{ fontSize: "0.78rem", color: "#475569", mt: 0.25 }}>{event.infoPendingNote || "ข้อมูลงานยังไม่ครบ — ตรวจสอบกับผู้แจ้งก่อนเข้างาน"}</Typography>
      </Block>,
    );
  }

  // ── ขั้น 3: อุปกรณ์ที่ต้องเตรียม ──
  if (equipment.length) {
    blocks.push(
      <Block key="eq" color={BLUE} icon={<HandymanOutlined />} title={`อุปกรณ์ที่ต้องเตรียม (${equipment.length})`}>
        <Box component="ul" sx={{ m: 0, mt: 0.4, pl: 2.25, "& li": { fontSize: "0.8rem", color: "#334155", lineHeight: 1.55 } }}>
          {equipment.map((x, i) => <li key={i}>{x}</li>)}
        </Box>
      </Block>,
    );
  }

  // ── ขั้น 5: งานไม่เสร็จ ค้างจัดการ ──
  if (fu && !closed) {
    blocks.push(
      <Block key="fu" color={AMBER} icon={<ReportProblemOutlined />} title={`งานไม่เสร็จ — ${fu.reason}`}
        action={mode === "admin" ? (
          <Button size="small" variant="contained" disableElevation disabled={busy}
            onClick={() => run(() => EventService.ResolveFollowUp(event._id, { resolution: "ลงนัดใหม่แล้ว" }), "บันทึกว่าจัดการแล้ว")}
            sx={{ flexShrink: 0, bgcolor: BLUE, "&:hover": { bgcolor: "#1d4ed8" }, textTransform: "none", fontWeight: 800, borderRadius: 2, fontSize: "0.76rem", px: 1.25 }}>
            จัดการแล้ว
          </Button>
        ) : null}>
        {fu.note && <Typography sx={{ fontSize: "0.78rem", color: "#334155", mt: 0.25, wordBreak: "break-word" }}>{fu.note}</Typography>}
        <Stack direction="row" gap={1.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
          <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>ผู้รับผิดชอบต่อ: <b style={{ color: INK }}>{fu.nextOwner}</b></Typography>
          {fu.proposedDate && <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>เสนอนัดใหม่: <b style={{ color: INK }}>{formatThai(moment(fu.proposedDate), "D MMM YYYY")}</b></Typography>}
        </Stack>
        <Typography sx={{ fontSize: "0.7rem", color: "#94a3b8", mt: 0.25 }}>
          แจ้งโดย {fu.reportedBy || "-"} · {formatThai(moment(fu.reportedAt), "D MMM HH:mm")}
          {mode === "admin" ? " · ลงวันนัดใหม่ในตารางงานแล้วกด “จัดการแล้ว”" : " · รอแอดมินลงนัดใหม่"}
        </Typography>
        {mode === "admin" && (
          <Box component={Link} to="/event" sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, mt: 0.5, fontSize: "0.74rem", fontWeight: 800, color: BLUE, textDecoration: "none" }}>
            <CalendarMonthOutlined sx={{ fontSize: 15 }} /> เปิดตารางงานเพื่อลงนัดใหม่
          </Box>
        )}
      </Block>,
    );
  }

  // ── ขั้น 4: ช่างรับทราบงาน ──
  let ackArea = null;
  if (!closed && !pendingApproval && !event.unscheduled) {
    if (mode === "tech" && mine && !ackedByMe) {
      ackArea = (
        <Button fullWidth variant="contained" disableElevation disabled={busy} startIcon={<ThumbUpAltOutlined />}
          onClick={() => run(() => EventService.AckJob(event._id), "รับทราบงานแล้ว")}
          sx={{ bgcolor: BLUE, "&:hover": { bgcolor: "#1d4ed8" }, textTransform: "none", fontWeight: 800, borderRadius: 2, py: 1, fontSize: "0.9rem" }}>
          รับทราบงาน
        </Button>
      );
    } else if (acks.length) {
      ackArea = (
        <Stack direction="row" alignItems="center" gap={0.6} sx={{ px: 0.5 }}>
          <CheckCircleRounded sx={{ fontSize: 16, color: GREEN }} />
          <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: "#15803d" }}>
            รับทราบแล้ว: {acks.map((a) => a.name).join(", ")}
          </Typography>
          <Typography sx={{ fontSize: "0.7rem", color: "#94a3b8" }}>· {formatThai(moment(acks[acks.length - 1].at), "D MMM HH:mm")}</Typography>
        </Stack>
      );
    }
  }

  // ── ขั้น 5: ปุ่มแจ้งงานไม่เสร็จ (ช่าง) ──
  const canReport = mode === "tech" && !closed && !pendingApproval && !event.closeRequested && !event.unscheduled && (mine || !userId);
  const step = event.unscheduled ? null : nextStepOf(event, mode, { mine, ackedByMe });
  const confirmAppointment = onStatusUpdate ? async () => {
    setBusy(true);
    try { await onStatusUpdate(event._id, { status: "ยืนยันแล้ว", manualStatus: true }); } finally { setBusy(false); }
  } : undefined;
  if (!step && !blocks.length && !ackArea && !canReport) return null;

  return (
    <Stack spacing={1} sx={{ mt: 1.5, ...sx }} onClick={(e) => e.stopPropagation()}>
      <NextStepBox step={step} onConfirm={confirmAppointment} busy={busy} />
      {ackArea}
      {blocks}
      {canReport && (
        <Button fullWidth variant="outlined" disabled={busy} startIcon={<EventRepeatOutlined />} onClick={() => setFuOpen(true)}
          sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, color: "#92400e", borderColor: alpha(AMBER, 0.45), bgcolor: "#fff", "&:hover": { borderColor: AMBER, bgcolor: alpha(AMBER, 0.05) } }}>
          {fu ? "แจ้งสาเหตุใหม่ / เปลี่ยนวันนัด" : "งานยังไม่เสร็จ / ต้องนัดใหม่"}
        </Button>
      )}
      {fuOpen && (
        <FollowUpDialog event={event} onClose={() => setFuOpen(false)}
          onSubmit={(payload) => run(() => EventService.ReportFollowUp(event._id, payload), "ส่งให้แอดมินแล้ว").then(() => setFuOpen(false))} />
      )}
    </Stack>
  );
}

/** ฟอร์ม "งานไม่เสร็จ" — เลือกสาเหตุ (เติมผู้รับผิดชอบต่อให้อัตโนมัติ) · รายละเอียด · วันนัดที่เสนอ */
function FollowUpDialog({ event, onClose, onSubmit }) {
  const [reason, setReason] = useState("");
  const [owner, setOwner] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const needNote = reason === "อื่นๆ";
  const ok = reason && owner && (!needNote || note.trim());

  const pickReason = (r) => {
    setReason(r.key);
    setOwner(r.owner);
  };
  const submit = async () => {
    if (!ok) return;
    setSaving(true);
    await onSubmit({ reason, nextOwner: owner, note: note.trim(), proposedDate: date || null });
    setSaving(false);
  };

  const pillSx = (active, color = BLUE) => ({
    px: 1.4, py: 0.9, borderRadius: 2, border: `1.5px solid ${active ? color : LINE}`, bgcolor: active ? alpha(color, 0.07) : "#fff",
    textAlign: "left", display: "block", width: "100%", transition: "all .12s", "&:hover": { borderColor: active ? color : "#cbd5e1" },
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
      <Stack direction="row" alignItems="center" gap={1.25} sx={{ px: 2.5, pt: 2, pb: 1.5, borderBottom: `1px solid ${LINE}` }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: alpha(AMBER, 0.12), color: AMBER }}>
          <EventRepeatOutlined sx={{ fontSize: 20 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900, fontSize: "1rem", color: INK }}>งานยังไม่เสร็จ / ต้องนัดใหม่</Typography>
          <Typography noWrap sx={{ fontSize: "0.76rem", color: MUTED }}>{[event.title, event.site || event.company, event.jobNo].filter(Boolean).join(" · ")}</Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
      </Stack>
      <DialogContent sx={{ px: 2.5, py: 2 }}>
        <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: "#334155", mb: 0.75 }}>1. สาเหตุ</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75 }}>
          {FOLLOW_UP_REASONS.map((r) => (
            <ButtonBase key={r.key} onClick={() => pickReason(r)} sx={pillSx(reason === r.key)}>
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 800, color: reason === r.key ? BLUE : INK }}>{r.key}</Typography>
              <Typography sx={{ fontSize: "0.68rem", color: MUTED, lineHeight: 1.3 }}>{r.hint}</Typography>
            </ButtonBase>
          ))}
        </Box>

        <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: "#334155", mt: 2, mb: 0.75 }}>2. ใครทำขั้นตอนถัดไป</Typography>
        <Stack direction="row" gap={0.75} flexWrap="wrap">
          {NEXT_OWNERS.map((o) => (
            <ButtonBase key={o} onClick={() => setOwner(o)} sx={{
              px: 1.25, height: 32, borderRadius: 99, fontSize: "0.78rem", fontWeight: 700,
              border: `1.5px solid ${owner === o ? BLUE : LINE}`, color: owner === o ? BLUE : "#334155", bgcolor: owner === o ? alpha(BLUE, 0.07) : "#fff",
            }}>{o}</ButtonBase>
          ))}
        </Stack>

        <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: "#334155", mt: 2, mb: 0.75 }}>
          3. รายละเอียด {needNote ? <span style={{ color: RED }}>*</span> : <span style={{ color: "#94a3b8", fontWeight: 600 }}>(ถ้ามี)</span>}
        </Typography>
        <TextField fullWidth multiline minRows={2} size="small" value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="เช่น ต้องเปลี่ยนตู้ควบคุม รอของเข้า 3 วัน" />

        <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: "#334155", mt: 2, mb: 0.75 }}>
          4. วันนัดใหม่ที่เสนอ <span style={{ color: "#94a3b8", fontWeight: 600 }}>(ถ้ามี — แอดมินเป็นคนลงตาราง)</span>
        </Typography>
        <ThaiDatePicker value={date} onChange={(v) => setDate(v || "")} minDate={moment()} />
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5, borderTop: `1px solid ${LINE}`, gap: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: "none", fontWeight: 700, color: MUTED }}>ยกเลิก</Button>
        <Button variant="contained" disableElevation disabled={!ok || saving} onClick={submit}
          sx={{ bgcolor: BLUE, "&:hover": { bgcolor: "#1d4ed8" }, textTransform: "none", fontWeight: 800, borderRadius: 2, px: 2.5 }}>
          {saving ? "กำลังส่ง..." : "ส่งให้แอดมิน"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
