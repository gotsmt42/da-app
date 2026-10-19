/**
 * JobFlow — ส่วนแสดงผล "ขั้นตอนทำงานมาตรฐาน" ที่ใช้ทั้งการ์ดงานของช่าง (TechnicianJobPanel)
 * และการ์ดงานของแอดมิน (OperationBoard → EventRowCard) — หน้าตาเดียวกันทุกที่
 *
 *   JobFlowChips  ป้ายบรรทัดเดียวใต้ชื่องาน: เลข Job · ด่วน · ครบกำหนด · รอข้อมูล · รับทราบแล้ว
 *   JobFlowPanel  กล่องการทำงาน: รอข้อมูล · อุปกรณ์ · ปุ่ม "รับทราบงาน"
 * 🧹 (10 ต.ค. 2569 ผู้ใช้: "ตัดระบบงานไม่เสร็จต้องเข้าใหม่ออก ให้ช่างเขียนหมายเหตุเองก็พอ") — ตัดปุ่ม/ฟอร์ม/กล่อง "งานไม่เสร็จ" ออก
 * ⚠️ "รับงาน" = รับงานจากลูกค้า (ขั้นที่ 1 · เมนู "รับงาน") — ปุ่มของช่างใช้คำว่า "รับทราบงาน" กันสับสน
 *
 * กฎ UI: น้ำเงิน = ปุ่มหลัก · แดง = ด่วน/เลยกำหนด · อำพัน = รอ/ค้าง · เขียว = เรียบร้อย
 */
import { useState } from "react";
import moment from "moment";
import Swal from "@/shared/ui/swal";
import { Link } from "react-router-dom";
import { Box, Stack, Typography, Button } from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  BoltRounded, EventBusyOutlined, HourglassTopRounded, ReportProblemOutlined, HandymanOutlined,
  CheckCircleRounded, ThumbUpAltOutlined, TagRounded, ArrowForwardRounded,
} from "@mui/icons-material";
import EventService from "@/shared/services/EventService";
import { formatThai } from "@/shared/utils/thaiDate";
import {
  isClosedJob, isUrgent, openFollowUp, attendanceTracked, acksOf, isAckedBy, isParticipant, dueInfo, ackTracked,
} from "@/shared/utils/jobFlow";

const BLUE = "#2563eb";
const RED = "#dc2626";
const AMBER = "#d97706";
const GREEN = "#16a34a";
const ACCENT_TONE = "#2563eb";
const INK = "#0f172a";
const MUTED = "#64748b";

const me = () => {
  try {
    const p = JSON.parse(localStorage.getItem("payload") || "{}");
    return { userId: p.userId || p._id || "", fname: p.fname || p.name || "" };
  } catch { return { userId: "", fname: "" }; }
};

// ✅ (10 ต.ค. 2569 ผู้ใช้: "สีสันมันดูเยอะ และรก อ่านยากเกินไป") — ป้ายทั่วไปพื้นเทา ตัวหนังสือเข้ม สีอยู่ที่ไอคอนเท่านั้น
//    คงสีเต็มไว้เฉพาะเรื่องด่วน/เลยกำหนด (แดง) ให้ยังเด่นอยู่
const Chip = ({ color, solid, icon, children, title }) => {
  const loud = solid || color === RED;
  return (
    <Box component="span" title={title} sx={{
      display: "inline-flex", alignItems: "center", gap: 0.4, height: 22, px: 0.9, borderRadius: 99,
      fontSize: "0.7rem", fontWeight: 800, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums",
      color: solid ? "#fff" : loud ? color : "#334155", bgcolor: solid ? color : loud ? alpha(color, 0.1) : "#f1f5f9",
      "& svg": { fontSize: 14, color: solid ? "#fff" : color },
    }}>
      {icon}{children}
    </Box>
  );
};

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
  // ✅ (11 ต.ค. 2569) ช่างปฏิเสธงาน — ป้ายแดงพร้อมเหตุผล (ชี้ดูได้) แทนป้ายรับทราบ
  if (showAck && !closed && event.ackDeclined?.userId) {
    items.push(<Chip key="a" color={RED} icon={<ReportProblemOutlined />} title={`เหตุผล: ${event.ackDeclined.reason || "-"}`}>{event.ackDeclined.name} ปฏิเสธงาน</Chip>);
  } else if (showAck && !closed && !event.unscheduled && (acks.length || (ackTracked(event) && (event.resPerson || event.team)))) {
    items.push(acks.length
      ? <Chip key="a" color={GREEN} icon={<CheckCircleRounded />} title={acks.map((a) => a.name).join(", ")}>รับทราบแล้ว</Chip>
      : <Chip key="a" color={MUTED} icon={<ThumbUpAltOutlined />}>ยังไม่รับทราบ</Chip>);
  }
  if (!items.length) return null;
  return <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.5, ...sx }}>{items}</Stack>;
}

/**
 * ข้อควรระวังในตาราง — เฉพาะเรื่องที่ต้องสนใจ
 * 🔁 (19 ต.ค. 2569 ผู้ใช้: "ตรงนี้ทำให้สับสนมากว่าคืออะไร") เดิมเป็นป้ายคำเดียว (ด่วน · เลยกำหนด · รอข้อมูล) เรียงใต้สถานะ
 *    ดูเหมือนสถานะงานซ้อนกันหลายอัน → เป็นบรรทัดข้อความเต็มความหมาย (เลยกำหนดเสร็จวันไหน · รอข้อมูลอะไร)
 *    ใต้หัวข้อเล็ก "ต้องระวัง" แยกจากป้ายสถานะชัดเจน
 */
export function JobFlowFlags({ event }) {
  if (!event || event.department === "sales" || isClosedJob(event)) return null;
  const due = dueInfo(event);
  const items = [];
  const fu = openFollowUp(event);
  // fix = วิธีทำให้ข้อนี้หายไป (ผู้ใช้: "แล้วสถานะจะแก้ไขยังไง") — ชี้เมาส์/แตะค้างเห็น · ลิงก์ "แก้ไขข้อมูลงาน" ด้านล่างพาไปฟอร์ม
  if (isUrgent(event)) items.push({ k: "u", color: RED, icon: <BoltRounded />, text: "งานด่วน", fix: "ไม่ด่วนแล้ว: แก้ไขข้อมูลงาน › ความเร่งด่วน = ปกติ" });
  if (due?.overdue) items.push({ k: "d", color: RED, icon: <EventBusyOutlined />, text: `เลยกำหนดเสร็จ${event.dueDate ? ` (${formatThai(moment(event.dueDate), "D MMM")})` : ""}`, fix: "ทำงานให้เสร็จแล้วขอปิดงาน · หรือเลื่อนกำหนด: แก้ไขข้อมูลงาน › เสร็จภายใน" });
  if (fu) items.push({ k: "f", color: AMBER, icon: <ReportProblemOutlined />, text: `แจ้งงานไม่เสร็จ${fu.reason ? ` — ${fu.reason}` : ""}`, fix: "แอดมินลงวันนัดใหม่ แล้วกด “จัดการแล้ว” ในการ์ดงาน" });
  if (event.infoPending) items.push({ k: "i", color: AMBER, icon: <HourglassTopRounded />, text: `รอข้อมูลเพิ่ม${event.infoPendingNote ? `: ${event.infoPendingNote}` : ""}`, fix: "ได้ข้อมูลแล้ว: แก้ไขข้อมูลงาน › เอาติ๊ก “ยังรอข้อมูล” ออก" });
  if (event.ackDeclined?.userId) items.push({ k: "x", color: RED, icon: <ReportProblemOutlined />, text: `${event.ackDeclined.name || "ช่าง"} ปฏิเสธงาน`, fix: "มอบหมายผู้รับผิดชอบ/หัวหน้าทีมคนใหม่ในการ์ดงาน" });
  else if (ackTracked(event) && !event.unscheduled && event.approvalStatus !== "pending" && !acksOf(event).length && moment(event.start).isAfter(moment().subtract(1, "day")))
    items.push({ k: "a", color: MUTED, icon: <ThumbUpAltOutlined />, text: "ผู้รับผิดชอบยังไม่รับทราบงาน", fix: "ผู้รับผิดชอบกด “รับทราบงาน” ในหน้างานของฉัน" });
  if (!items.length) return null;
  return (
    <Box sx={{ mt: 0.75, pt: 0.6, borderTop: "1px dashed #e2e8f0", maxWidth: 220 }}>
      <Typography sx={{ fontSize: "0.62rem", fontWeight: 800, color: "#94a3b8", letterSpacing: 0.3, mb: 0.2 }}>ต้องระวัง</Typography>
      {items.map((x) => (
        <Stack key={x.k} direction="row" spacing={0.5} alignItems="flex-start" title={`${x.text}
วิธีแก้: ${x.fix}`}>
          <Box sx={{ color: x.color, display: "flex", mt: "2px", "& svg": { fontSize: 13 } }}>{x.icon}</Box>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: x.color, lineHeight: 1.4, overflowWrap: "anywhere",
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{x.text}</Typography>
        </Stack>
      ))}
      {items.some((x) => ["u", "d", "i"].includes(x.k)) && (
        <Box component={Link} to={calendarLinkOf(event)} onClick={(e) => e.stopPropagation()}
          sx={{ display: "inline-block", mt: 0.4, fontSize: "0.7rem", fontWeight: 800, color: "#2563eb", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
          แก้ไขข้อมูลงาน ›
        </Box>
      )}
    </Box>
  );
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
      : { tone: AMBER, title: "แจ้งงานไม่เสร็จแล้ว", desc: `รอแอดมินลงนัดใหม่ · ผู้รับผิดชอบต่อ: ${fu.nextOwner}` };
  }
  // 🧹 (10 ต.ค. 2569 ผู้ใช้: "ตัดปุ่มยังไม่มีทีมเข้างานออก ให้เพิ่มผู้เข้าทำงานได้เหมือนผู้รับผิดชอบ และแก้คำเป็นหัวหน้าทีมเข้างาน")
  //    ไม่มีกล่อง "ยังไม่มีทีมเข้างาน" อีกแล้ว — เลือกหัวหน้าทีมเข้างานได้ตรงแถวข้อมูลงานในการ์ด
  // ✅ (11 ต.ค. 2569 ผู้ใช้: "การกดยืนยันแล้ว ควรต่อจากการกดรับทราบอีกขั้น" + "ช่างกดปฏิเสธได้ พร้อมเหตุผล")
  //    ลำดับ: ช่างปฏิเสธ (มอบหมายใหม่) → รอช่างรับทราบ → รอยืนยันนัด (ปุ่ม "ยืนยันนัดแล้ว" = สถานะ ยืนยันแล้ว ในปฏิทิน)
  if (mode === "admin" && ev.ackDeclined?.userId) {
    return { tone: RED, title: `${ev.ackDeclined.name} ปฏิเสธงาน`, desc: `เหตุผล: ${ev.ackDeclined.reason || "-"} — มอบหมายหัวหน้าทีม/ผู้รับผิดชอบคนใหม่ในการ์ดนี้` };
  }
  if (ackTracked(ev) && !acksOf(ev).length && mode === "admin") {
    return { tone: ACCENT_TONE, title: "รอผู้รับผิดชอบกดรับทราบงาน", desc: `เข้างาน ${dayText}${ev.responsiblePerson ? ` · ผู้รับผิดชอบ ${ev.responsiblePerson}` : team ? ` · ทีม ${team}` : ""} — รับทราบแล้วจึงยืนยันนัดหมาย` };
  }
  if (mode === "admin" && ev.status === "กำลังรอยืนยัน") {
    return { tone: AMBER, title: "รอผู้รับผิดชอบยืนยันนัดหมาย", desc: `รับทราบแล้ว — รอยืนยันวันเข้างาน ${dayText} (แอดมินกดแทนได้)`, action: { label: "ยืนยันนัดหมายแทน", confirm: true } };
  }
  if (mode === "tech" && mine && ackTracked(ev) && !ackedByMe) {
    return { tone: ACCENT_TONE, title: "กดรับทราบงาน", desc: `เข้างาน ${dayText} — กดปุ่ม “รับทราบงาน” ด้านล่างให้แอดมินรู้ว่าคุณรับงานแล้ว` };
  }
  if (beforeDay) {
    return mode === "admin"
      ? { tone: ACCENT_TONE, title: "นัดหมายแล้ว", desc: `เข้างาน ${dayText}${team ? ` · ทีม ${team}` : ""}` }
      : { tone: ACCENT_TONE, title: `เข้างาน ${dayText}`, desc: "เตรียมอุปกรณ์ตามรายการ แล้วไปตามนัด" };
  }
  // ✅ (11 ต.ค. 2569 ผู้ใช้: "สถานะที่เขียนว่าช่างกำลังทำงาน ทำให้ตามจริง หรือใช้คำให้สอดคล้อง")
  //    เดิมขึ้น "ช่างกำลังทำงาน" ทุกงานที่ถึงวันแล้ว แม้ยังไม่มีใครกดเข้างาน — ตอนนี้อิงข้อมูลจริง (checkedInAt)
  //    และใช้คำชุดเดียวกับแถบขั้นตอน (รับทราบ › เข้างาน › เอกสาร › ขอปิดงาน)
  if (mode === "admin") {
    if (ev.checkedInAt) {
      return { tone: ACCENT_TONE, title: `เข้างานแล้ว ${moment(ev.checkedInAt).format("HH:mm")} · รอเอกสาร`, desc: "รอช่างแนบเอกสารประจำงาน แล้วกดขอปิดงาน" };
    }
    if (!ev.team && !ev.resPerson) return { tone: AMBER, title: "ยังไม่มีหัวหน้าทีมเข้างาน", desc: "มอบหมายหัวหน้าทีมในการ์ดนี้ ทีมจึงกดเข้างานได้" };
    const last = moment(ev.end || ev.start).subtract(ev.allDay && ev.end ? 1 : 0, "days").startOf("day");
    return moment().startOf("day").isAfter(last)
      ? { tone: AMBER, title: "เลยวันเข้างาน · ยังไม่กดเข้างาน", desc: `นัดเข้างาน ${dayText}${team ? ` · ทีม ${team}` : ""} — ตรวจสอบกับทีม` }
      : { tone: ACCENT_TONE, title: "วันนี้ · รอทีมกดเข้างาน", desc: `${team ? `ทีม ${team} · ` : ""}หัวหน้าทีมกดเข้างานพร้อมถ่ายรูปหน้างาน` };
  }
  return { tone: ACCENT_TONE, title: "ทำงาน → แนบเอกสาร → ขอปิดงาน", desc: "แนบเอกสารประจำงานให้ครบ แล้วกด “ขอปิดงาน”" };
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
          {/* ✅ (10 ต.ค. 2569 ผู้ใช้: "คำว่าต่อไปให้ใช้คำใหม่ ดูแล้วงง" → เลือก "ไม่ต้องมีคำนำหน้า") — ตัดหัว "ขั้นตอนถัดไป" ออก เหลือจุดสี + ข้อความ */}
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

/**
 * กล่องย่อย — หัวไอคอน + เนื้อหา
 * ✅ (10 ต.ค. 2569 ผู้ใช้: "สีสันมันดูเยอะ และรก อ่านยากเกินไป") — พื้นเทาอ่อนเหมือนกันทุกกล่อง
 *    สีเหลือแค่ไอคอนเล็กหน้าหัวข้อ (เดิมพื้นส้ม/ฟ้า/ส้มเรียงกัน ตัดกันจนอ่านยาก)
 */
const Block = ({ color, icon, title, children, action }) => (
  <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}>
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
          <Typography sx={{ fontSize: "0.76rem", fontWeight: 600, color: "#334155" }}>
            รับทราบแล้ว: {acks.map((a) => a.name).join(", ")}
          </Typography>
          <Typography sx={{ fontSize: "0.7rem", color: "#94a3b8" }}>· {formatThai(moment(acks[acks.length - 1].at), "D MMM HH:mm")}</Typography>
        </Stack>
      );
    }
  }

  // ✅ (10 ต.ค. 2569) ช่างที่อยู่ในงาน: ขั้นตอน + ปุ่มรับทราบ/เช็คอิน/เช็คเอาต์ รวมอยู่ในกล่อง "ขั้นตอนของฉัน"
  //    (features/attendance/components/CheckInOutPanel) แล้ว — ไม่แสดงกล่องขั้นตอนถัดไป/ปุ่มรับทราบซ้ำตรงนี้
  // ✅ (11 ต.ค. 2569 ผู้ใช้: "ทำไมรูปแบบไม่เหมือนกัน ดูสับสน") — ตัดเงื่อนไข mine: คนนอกทีมก็เห็นแถบขั้นตอนเดียวกัน
  const flowElsewhere = mode === "tech" && !closed && attendanceTracked(event);
  // แอดมิน: ป้าย "รับทราบแล้ว" บนหัวการ์ดบอกอยู่แล้ว (ชี้ดูชื่อได้) — ไม่ต้องมีบรรทัดซ้ำ (10 ต.ค. 2569 ผู้ใช้: "หน้าดำเนินงานข้อมูลมันดูซ้ำซ้อนและยาวรกเกินไป")
  if (flowElsewhere || mode === "admin") ackArea = null;
  let step = event.unscheduled || flowElsewhere || (fu && !closed) ? null : nextStepOf(event, mode, { mine, ackedByMe });
  // ✅ (11 ต.ค. 2569 ผู้ใช้: "หน้าการดำเนินงานปรับรูปแบบให้คล้ายงานของฉัน") — แอดมิน: งานที่ใช้ระบบเข้างาน
  //    มีแถบขั้นตอน (รับทราบ › เข้างาน › เอกสาร › ขอปิดงาน) ในการ์ดแล้ว เหลือกล่องนี้เฉพาะขั้นที่มีปุ่มให้กด (อนุมัติแผน/ยืนยันนัด)
  if (step && mode === "admin" && !closed && attendanceTracked(event) && !step.action) step = null;
  // งานปิดแล้ว — ป้ายสถานะบนหัวการ์ดบอกอยู่แล้ว ไม่ต้องมีกล่อง "เสร็จสิ้น" ซ้ำ (11 ต.ค. 2569)
  if (closed) step = null;
  const confirmAppointment = onStatusUpdate ? async () => {
    setBusy(true);
    try { await onStatusUpdate(event._id, { status: "ยืนยันแล้ว", manualStatus: true }); } finally { setBusy(false); }
  } : undefined;
  if (!step && !blocks.length && !ackArea) return null;

  return (
    <Stack spacing={1} sx={{ mt: 1.5, ...sx }} onClick={(e) => e.stopPropagation()}>
      <NextStepBox step={step} onConfirm={confirmAppointment} busy={busy} />
      {ackArea}
      {blocks}
    </Stack>
  );
}
