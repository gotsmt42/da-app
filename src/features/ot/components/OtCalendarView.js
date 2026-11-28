/**
 * OtCalendarView — ดูใบ OT แบบ "ปฏิทินย่อ" เทียบกับงานของช่างที่ขอ
 *
 * ✅ (28 พ.ย. 2569 ผู้ใช้: "อยากให้การแสดงผลดูเป็นแบบตารางเหมือนกันกับตอนจะเลือกลง OT จะทำให้ตรวจสอบ OT ช่างตามงานต่างๆ ได้ง่าย"
 *    · "เปิดเป็นตารางย่อ" · "แสดงงานของช่างที่ขอ OT มา")
 *    ซ้าย = ปฏิทินเดือน (หน้าตาเดียวกับปฏิทินตอนเลือกวันลง OT): วันที่ขอ OT = กรอบน้ำเงิน + ชั่วโมง · จุด = จำนวนงานของช่างวันนั้น
 *    ขวา = วันที่เลือก: รายการ OT ของวันนั้น (เวลา · ประเภท · ชั่วโมง · งานที่อิง) + งานทั้งหมดของช่างในวันนั้น
 *          งานที่ OT อิงถึง = ป้าย "อิงใน OT" · กด "ดูงาน" = เปิดหน้างานในตารางงาน
 *    → ผู้ตรวจเห็นทันทีว่าวันที่ขอ OT ช่างมีงานจริงไหม งานตรงกับที่อ้างไหม
 * ⚠️ งานของช่าง = งานที่ผู้ตรวจเปิดดูได้ (getEventOp) แล้วกรองเฉพาะงานที่ช่างในใบมีชื่อ (หัวหน้าทีม/ลูกทีม)
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import moment from "moment";
import { Box, ButtonBase, IconButton, Stack, Typography, Skeleton } from "@mui/material";
import { ChevronLeftRounded as ChevronLeft, ChevronRightRounded as ChevronRight } from "@mui/icons-material";
import EventService from "@/shared/services/EventService";
import JobTypeChip from "@/shared/ui/JobTypeChip";
import { thaiDate } from "@/shared/utils/thaiDate";
import { dayKind } from "./OtDayInfo";
import HoursFigure from "./HoursFigure";
import JobQuickView from "@/shared/ui/JobQuickView";
import { TEXT_MAIN, TEXT_SUB, BORDER_MAIN, typeMeta, hoursText, lineJobs } from "../otMeta";

const BLUE = "#2563eb";
const DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const ymd = (d) => moment(d).format("YYYY-MM-DD");

/** วันที่ทุกวันของงาน (allDay: end = วันถัดไป) */
const daysOfEvent = (ev) => {
  const s = moment(ev.start).startOf("day");
  let e = ev.end ? moment(ev.end).startOf("day") : s.clone();
  if (ev.allDay !== false && e.isAfter(s)) e = e.subtract(1, "day");
  if (e.isBefore(s)) e = s.clone();
  const out = [];
  for (let d = s.clone(); !d.isAfter(e) && out.length < 62; d.add(1, "day")) out.push(d.format("YYYY-MM-DD"));
  return out;
};
const titleOf = (ev) => [ev.title, ev.system, ev.site].filter(Boolean).join(" · ");

export default function OtCalendarView({ doc, holidays, cfg, isMobile }) {
  const lines = useMemo(() => doc?.lines || [], [doc]);
  const otDays = useMemo(() => [...new Set(lines.map((l) => ymd(l.date)))].sort(), [lines]);
  const [month, setMonth] = useState(() => moment(otDays[0] || doc?.period || undefined).startOf("month"));
  const [day, setDay] = useState(otDays[0] || ymd(new Date()));
  const [events, setEvents] = useState(null);
  const [peekId, setPeekId] = useState(null); // คลิกขวา/กดค้างที่งาน = รายละเอียดงาน (ชุดเดียวกับปฏิทินตอนเลือกงาน)

  // คนในใบ (ปกติคนเดียว) — ใช้หา "งานของช่าง"
  const people = useMemo(() => {
    const m = new Map();
    lines.forEach((l) => { if (l.person?.name || l.person?.userId) m.set(l.person.userId || l.person.name, l.person); });
    if (!m.size && doc?.requester) m.set(doc.requester.userId || doc.requester.name, doc.requester);
    return [...m.values()];
  }, [lines, doc]);

  useEffect(() => {
    let alive = true;
    EventService.getEventOp({ slim: true })
      .then((r) => { if (alive) setEvents((r?.userEvents || r?.events || []).filter((e) => e?.start && !e.unscheduled && e.department !== "sales")); })
      .catch(() => { if (alive) setEvents([]); });
    return () => { alive = false; };
  }, []);


  const linesByDay = useMemo(() => {
    const m = new Map();
    lines.forEach((l) => { const d = ymd(l.date); m.set(d, [...(m.get(d) || []), l]); });
    return m;
  }, [lines]);

  const start = month.clone().startOf("month").startOf("week");
  const cells = Array.from({ length: 42 }, (_, i) => start.clone().add(i, "day"));
  const dayLines = linesByDay.get(day) || [];
  // 🔁 (28 พ.ย. 2569 ผู้ใช้: "ให้แสดงแค่ OT ที่ขอพอ") เหลือเฉพาะงานที่ OT วันนั้นอ้างถึง (ไม่แสดงงานอื่นของช่าง)
  const allEvents = events || [];
  const linkedRefs = [...new Map(dayLines.flatMap((l) => lineJobs(l)).filter((j) => j.eventId || j.jobTitle).map((j) => [String(j.eventId || j.jobTitle), j])).values()];
  const dayJobs = linkedRefs.map((ref) => allEvents.find((ev) => String(ev._id) === String(ref.eventId))
    || { _id: ref.eventId || "", title: String(ref.jobTitle || "").split(" · ")[0], system: String(ref.jobTitle || "").split(" · ").slice(1).join(" · "), _ref: true });
  const dk = dayKind(day, holidays, cfg);

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) minmax(0, 1.1fr)", borderTop: `1px solid ${BORDER_MAIN}` }}>
      {/* ── ปฏิทินเดือน ── */}
      <Box sx={{ p: { xs: 1.25, sm: 1.75 }, borderRight: isMobile ? 0 : `1px solid ${BORDER_MAIN}`, borderBottom: isMobile ? `1px solid ${BORDER_MAIN}` : 0 }}>
        <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
          <IconButton size="small" onClick={() => setMonth((m) => m.clone().subtract(1, "month"))} aria-label="เดือนก่อน"><ChevronLeft /></IconButton>
          <Typography sx={{ flex: 1, textAlign: "center", fontWeight: 800, fontSize: "0.95rem" }}>{thaiDate(month).split(" ").slice(1).join(" ")}</Typography>
          <IconButton size="small" onClick={() => setMonth((m) => m.clone().add(1, "month"))} aria-label="เดือนถัดไป"><ChevronRight /></IconButton>
        </Stack>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "4px" }}>
          {DOW.map((d, i) => <Typography key={d} sx={{ textAlign: "center", fontSize: "0.7rem", fontWeight: 700, color: i === 0 || i === 6 ? "#ef4444" : TEXT_SUB, pb: 0.5 }}>{d}</Typography>)}
          {cells.map((c) => {
            const d = c.format("YYYY-MM-DD");
            const inMonth = c.month() === month.month();
            const ot = linesByDay.get(d);
            const kind = dayKind(d, holidays, cfg)?.kind;
            const on = d === day;
            const otHours = ot ? ot.reduce((t, l) => t + (l.hours || 0), 0) : 0;
            return (
              <ButtonBase key={d} onClick={() => setDay(d)} aria-pressed={on} title={ot ? `ขอ OT ${hoursText(otHours)}` : ""}
                sx={{ flexDirection: "column", justifyContent: "flex-start", gap: "2px", minHeight: isMobile ? 46 : 54, py: 0.5, borderRadius: 1.5, fontFamily: "inherit",
                  opacity: inMonth ? 1 : 0.35,
                  bgcolor: on ? BLUE : ot ? "#eff6ff" : "transparent",
                  border: `1px solid ${on ? BLUE : ot ? "#bfdbfe" : "transparent"}`,
                  color: on ? "#fff" : kind && kind !== "work" ? "#dc2626" : TEXT_MAIN }}>
                <Typography component="span" sx={{ fontSize: "0.86rem", fontWeight: ot || on ? 800 : 600, lineHeight: 1.2 }}>{c.date()}</Typography>
                {ot && <Typography component="span" sx={{ fontSize: "0.62rem", fontWeight: 800, lineHeight: 1, color: on ? "#fff" : BLUE }}>{hoursText(otHours).replace(" ชม.", "ช.").replace(" น.", "น.")}</Typography>}
              </ButtonBase>
            );
          })}
        </Box>
        <Stack direction="row" spacing={1.5} useFlexGap sx={{ mt: 1.25, flexWrap: "wrap", rowGap: 0.5 }}>
          <Typography sx={{ fontSize: "0.7rem", color: TEXT_SUB, display: "inline-flex", alignItems: "center", gap: 0.5 }}>
            <Box component="span" sx={{ width: 12, height: 12, borderRadius: 0.75, bgcolor: "#eff6ff", border: "1px solid #bfdbfe" }} />วันที่ขอ OT
          </Typography>
          <Typography sx={{ fontSize: "0.7rem", color: "#dc2626" }}>ตัวเลขแดง = วันหยุด</Typography>
        </Stack>
      </Box>

      {/* ── วันที่เลือก ── */}
      <Box sx={{ p: { xs: 1.25, sm: 1.75 }, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800, fontSize: "0.95rem" }}>วัน{["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"][moment(day).day()]}ที่ {thaiDate(day)}</Typography>
        <Typography sx={{ fontSize: "0.76rem", color: TEXT_SUB, mb: 1.5 }}>
          {dk ? (dk.kind === "public" ? `วันหยุดนักขัตฤกษ์ · ${dk.label}` : dk.kind === "work" ? "วันทำงาน" : "วันหยุดประจำสัปดาห์") : ""}
        </Typography>

        {/* 🎨 (28 พ.ย. 2569 ผู้ใช้: "สีสันยังดูรกๆ มองยาก") การ์ดขาวขอบเทาแบบเดียวกันทั้ง 2 หมวด · สีเหลือแค่ป้ายประเภท OT */}
        <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: "#334155", mb: 0.75 }}>OT ที่ขอวันนี้</Typography>
        {dayLines.length ? dayLines.map((l) => {
          const tm = typeMeta(l.type);
          return (
            // ✅ (28 พ.ย. 2569 ผู้ใช้: "หน้านี้ด้วยให้คลิกเปิดการ์ดงานมาแสดงได้") กดรายการ OT = การ์ดงานที่อิง (แม้ช่างไม่มีชื่อในงานนั้น)
            <Stack key={l._id} direction="row" spacing={1} alignItems="center" role={lineJobs(l)[0]?.eventId ? "button" : undefined}
              onClick={() => { const id = lineJobs(l).find((j) => j.eventId)?.eventId; if (id) setPeekId(id); }}
              title={lineJobs(l)[0]?.eventId ? "กดเพื่อดูการ์ดงานที่อิง" : ""}
              sx={{ px: 1.5, py: 1.1, mb: 0.75, borderRadius: 2, border: `1px solid ${BORDER_MAIN}`, bgcolor: "#fff", cursor: lineJobs(l)[0]?.eventId ? "pointer" : "default", "&:hover": { borderColor: lineJobs(l)[0]?.eventId ? "#bfdbfe" : BORDER_MAIN } }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 0.4 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: "0.88rem" }}>{l.start} – {l.end}</Typography>
                  <Box component="span" sx={{ px: 0.75, height: 20, display: "inline-flex", alignItems: "center", borderRadius: 1.5, bgcolor: tm.bg, color: tm.color, fontSize: "0.7rem", fontWeight: 800 }}>{tm.label} ×{l.multiplier}</Box>
                </Stack>
                <Typography noWrap sx={{ fontSize: "0.74rem", color: TEXT_SUB, mt: 0.25 }}>
                  {[people.length > 1 ? l.person?.name : "", lineJobs(l).map((j) => j.jobTitle).filter(Boolean).join(" + ") || "ไม่ระบุงาน", l.task].filter(Boolean).join(" · ")}
                </Typography>
              </Box>
              <HoursFigure hours={l.hours} size="1rem" />
            </Stack>
          );
        }) : <Typography sx={{ fontSize: "0.8rem", color: TEXT_SUB, mb: 1 }}>ไม่ได้ขอ OT วันนี้</Typography>}

        <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: "#334155", mt: 2, mb: 0.75 }}>
          งานที่อิงใน OT วันนี้
        </Typography>
        {events === null ? <Skeleton variant="rounded" height={44} /> : dayJobs.length ? dayJobs.map((j) => {
          return (
            <Stack key={j._id} direction="row" spacing={1} alignItems="center" role="button" onClick={() => setPeekId(j._id)} onContextMenu={(ev) => { ev.preventDefault(); setPeekId(j._id); }} title="กดเพื่อดูการ์ดงาน"
              sx={{ px: 1.25, py: 0.85, mb: 0.75, borderRadius: 2, border: `1px solid ${BORDER_MAIN}`, bgcolor: "#fff", cursor: "pointer", "&:hover": { borderColor: "#bfdbfe" } }}>
              <JobTypeChip job={{ title: j.title }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: "0.84rem", fontWeight: 700 }}>{[j.system, j.site].filter(Boolean).join(" · ") || titleOf(j)}</Typography>
                <Typography noWrap sx={{ fontSize: "0.72rem", color: TEXT_SUB }}>
                  {[j.startTime && j.endTime ? `${j.startTime}–${j.endTime}` : "", j.team ? `หัวหน้าทีม ${j.team}` : "", j.status].filter(Boolean).join(" · ")}
                </Typography>
              </Box>
              <ButtonBase component={Link} onClick={(ev) => ev.stopPropagation()} to={`/event?event=${encodeURIComponent(j._id)}&date=${day}&t=${Date.now()}`}
                sx={{ flexShrink: 0, px: 1, height: 26, borderRadius: 1.5, fontFamily: "inherit", fontSize: "0.72rem", fontWeight: 800, color: BLUE, textDecoration: "none", border: "1px solid #dbeafe", "&:hover": { bgcolor: "#eff6ff" } }}>
                ดูงาน
              </ButtonBase>
            </Stack>
          );
        }) : (
          <Box sx={{ px: 1.5, py: 1.1, borderRadius: 2, bgcolor: "#f8fafc", border: `1px dashed ${BORDER_MAIN}` }}>
            <Typography sx={{ fontSize: "0.8rem", color: TEXT_SUB }}>
              {dayLines.length ? "รายการ OT วันนี้ไม่ได้อ้างอิงงาน" : "เลือกวันที่มีกรอบสีน้ำเงิน (วันที่ขอ OT)"}
            </Typography>
          </Box>
        )}
      </Box>
      {peekId && <JobQuickView eventId={peekId} onClose={() => setPeekId(null)} zIndex={1400} />}
    </Box>
  );
}
