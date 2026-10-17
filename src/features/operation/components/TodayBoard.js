/**
 * TodayBoard — แท็บ "งานวันนี้" ในหน้าการดำเนินงาน
 *
 * ✅ (17 ต.ค. 2569 ผู้ใช้: "ขอแทปงานวันนี้ ให้ดูง่ายว่าช่างทำงานไหนบ้าง กดบันทึกเข้างานหรือยัง และการดำเนินการทั้งหมด"
 *    + "ทำจุดวางให้ชัดเจน และดูง่าย")
 *   • แถวสรุปบนสุด: งานวันนี้ · เข้างานแล้ว · ยังไม่เข้างาน (เลยเวลานัด) · ขอปิด/ปิดแล้ว — กดเพื่อกรอง
 *   • การ์ดละ 1 ช่าง (หัวหน้าทีม) — ชื่อ · ลูกทีม · เข้างานแล้วกี่งานจากกี่งาน
 *     ในการ์ด: งานของช่างคนนั้นเรียงตามเวลานัด — เวลา · งาน/โครงการ · สถานะการเข้างาน (สีเดียวต่อสถานะ)
 *   • ช่างที่มีงานเลยเวลานัดแต่ยังไม่เข้างานขึ้นก่อน (ต้องตามก่อน)
 *   • กดงาน = เปิดแผงรายละเอียดงานตัวเต็ม (เอกสาร · ขอปิดงาน · คอมเมนต์) ของหน้าการดำเนินงาน
 * ⚠️ การเข้างาน "ของวันนี้" อ่านจากบันทึกเข้างาน (attendance) ของวันนี้ — งานหลายวันที่เคยเข้าเมื่อวาน
 *    ยังไม่นับว่าเข้างานวันนี้ · ข้อมูลรีเฟรชเองทุก 1 นาที
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import moment from "moment";
import { Box, ButtonBase, Stack, Typography, Skeleton } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { AccessTime, ChevronRight, Groups, PersonOff } from "@mui/icons-material";
import AttendanceService from "@/shared/services/AttendanceService";
import { fmtTime, locationBadge } from "@/features/attendance/attendanceMeta";
import { personColor, personInitial } from "@/shared/utils/personAvatar";

const CLOSED = "ดำเนินการเสร็จสิ้น";
const UNASSIGNED = "ยังไม่มอบหมายช่าง";

/** วันสุดท้ายของงาน (allDay เก็บ end แบบ exclusive) */
const lastDay = (e) => (e.end ? moment(e.end).subtract(e.allDay ? 1 : 0, "days") : moment(e.start));

/** งานที่ลงตารางไว้ "วันนี้" (รวมงานหลายวันที่คร่อมวันนี้) — ใช้ทั้งนับบนแถบสถานะและกรองรายการ */
export const isTodayJob = (e, today = moment()) => {
  if (!e?.start || e.unscheduled || e.cancelledAt || e.department === "sales") return false;
  if (e.approvalStatus === "rejected") return false;
  const d = today.clone().startOf("day");
  return !moment(e.start).startOf("day").isAfter(d) && !lastDay(e).startOf("day").isBefore(d);
};

// สถานะของงานวันนี้ — สีเดียวต่อสถานะ ใช้ทั้งชิปในการ์ดและแถวสรุป
const STATE = {
  late:     { label: "ยังไม่เข้างาน · เลยเวลานัด", short: "เลยเวลานัด", color: "#dc2626" },
  notyet:   { label: "ยังไม่เข้างาน", short: "ยังไม่เข้างาน", color: "#d97706" },
  pending:  { label: "รออนุมัติงาน", short: "รออนุมัติ", color: "#64748b" },
  checkin:  { label: "เข้างานแล้ว", short: "เข้างานแล้ว", color: "#2563eb" },
  request:  { label: "ขอปิดงานแล้ว", short: "ขอปิดงาน", color: "#0891b2" },
  closed:   { label: "ปิดงานแล้ว", short: "ปิดงานแล้ว", color: "#059669" },
};
const FILTERS = [
  { key: "all", label: "งานวันนี้", color: "#0f172a", match: () => true },
  { key: "notin", label: "ยังไม่เข้างาน", color: "#d97706", match: (s) => s === "notyet" || s === "late" },
  { key: "late", label: "เลยเวลานัด", color: "#dc2626", match: (s) => s === "late" },
  { key: "in", label: "เข้างานแล้ว", color: "#2563eb", match: (s) => s === "checkin" },
  { key: "done", label: "ขอปิด / ปิดแล้ว", color: "#059669", match: (s) => s === "request" || s === "closed" },
];

const hasTime = (e) => !e.allDay && moment(e.start).format("HH:mm") !== "00:00";

function stateOf(e, att, now) {
  if (e.status === CLOSED) return "closed";
  if (e.closeRequested) return "request";
  if (att) return "checkin";
  if (e.approvalStatus === "pending") return "pending";
  // เลยเวลานัด: งานที่มีเวลานัด และวันนี้เป็นวันแรกของงาน (งานหลายวัน: วันถัดไปใช้เวลาเดียวกันของวันนี้)
  if (hasTime(e)) {
    const t = moment(e.start);
    const startToday = now.clone().hours(t.hours()).minutes(t.minutes()).seconds(0);
    if (now.isAfter(startToday.add(30, "minutes"))) return "late";
  } else if (now.hours() >= 10) {
    return "late"; // งานทั้งวัน — สาย 10 โมงแล้วยังไม่เข้า ถือว่าต้องตาม
  }
  return "notyet";
}

const Avatar = ({ name, size = 40 }) => (
  <Box sx={{
    width: size, height: size, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center",
    bgcolor: name === UNASSIGNED ? "#e2e8f0" : personColor(name), color: name === UNASSIGNED ? "#64748b" : "#fff",
    fontWeight: 800, fontSize: size * 0.42,
  }}>
    {name === UNASSIGNED ? <PersonOff sx={{ fontSize: size * 0.5 }} /> : personInitial(name)}
  </Box>
);

const StateChip = ({ state, att }) => {
  const m = STATE[state];
  const loc = state === "checkin" ? locationBadge(att?.checkIn) : null;
  return (
    <Stack alignItems="flex-end" gap={0.25} sx={{ flexShrink: 0, maxWidth: 170 }}>
      <Box component="span" sx={{
        display: "inline-flex", alignItems: "center", gap: 0.5, px: 1, height: 24, borderRadius: 99, whiteSpace: "nowrap",
        fontSize: "0.74rem", fontWeight: 800, color: m.color, bgcolor: alpha(m.color, 0.1), border: `1px solid ${alpha(m.color, 0.3)}`,
      }}>
        <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: m.color }} />
        {state === "checkin" ? `เข้างาน ${fmtTime(att?.checkIn?.at)}` : m.short}
      </Box>
      {loc && (
        <Typography noWrap sx={{ fontSize: "0.68rem", fontWeight: 600, color: loc.tone === "warn" ? "#b45309" : "#64748b", maxWidth: "100%" }}>
          {loc.text}
        </Typography>
      )}
    </Stack>
  );
};

export default function TodayBoard({ events, onOpenJob }) {
  const [att, setAtt] = useState(null); // eventId → attendance row ของวันนี้
  const [now, setNow] = useState(moment());
  const [filter, setFilter] = useState("all");
  const today = now.format("YYYY-MM-DD");

  const load = useCallback(async () => {
    try {
      const data = await AttendanceService.list({ from: today, to: today });
      const map = new Map();
      (data?.attendance || []).forEach((r) => { if (!map.has(String(r.eventId))) map.set(String(r.eventId), r); });
      setAtt(map);
    } catch {
      setAtt((m) => m || new Map());
    }
    setNow(moment());
  }, [today]);
  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const rows = useMemo(() => (events || []).filter((e) => isTodayJob(e, now)).map((e) => {
    const a = att?.get(String(e._id)) || null;
    return { e, a, state: stateOf(e, a, now) };
  }), [events, att, now]);

  const counts = useMemo(() => {
    const c = {};
    FILTERS.forEach((f) => { c[f.key] = rows.filter((r) => f.match(r.state)).length; });
    return c;
  }, [rows]);

  const techs = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter) || FILTERS[0];
    const map = new Map();
    rows.filter((r) => f.match(r.state)).forEach((r) => {
      const head = r.e.team || r.e.responsiblePerson || UNASSIGNED;
      if (!map.has(head)) map.set(head, { name: head, jobs: [], members: new Set() });
      const t = map.get(head);
      t.jobs.push(r);
      (r.e.teamMembers || []).forEach((m) => { if (m?.name && m.name !== head) t.members.add(m.name); });
    });
    const list = [...map.values()];
    list.forEach((t) => t.jobs.sort((a, b) => moment(a.e.start).format("HH:mm").localeCompare(moment(b.e.start).format("HH:mm"))));
    const late = (t) => t.jobs.filter((j) => j.state === "late").length;
    return list.sort((a, b) => (a.name === UNASSIGNED ? -1 : b.name === UNASSIGNED ? 1 : 0)
      || late(b) - late(a) || a.name.localeCompare(b.name, "th"));
  }, [rows, filter]);

  if (att === null) {
    return (
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} variant="rounded" height={150} sx={{ borderRadius: 3 }} />)}
      </Box>
    );
  }

  return (
    <Box>
      {/* ── สรุปวันนี้ (กดเพื่อกรอง) ── */}
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 0.75, px: 0.5 }}>
        <Typography sx={{ fontSize: "1rem", fontWeight: 800, color: "#0f172a" }}>
          งานวันนี้ · {now.locale("th").format("dddd D MMMM")} {now.year() + 543}
        </Typography>
        <Typography sx={{ fontSize: "0.74rem", color: "#94a3b8", ml: "auto", whiteSpace: "nowrap" }}>
          อัปเดต {now.format("HH:mm")} น.
        </Typography>
      </Stack>
      <Box sx={{
        display: "grid", gap: 1, mb: 2,
        gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", md: "repeat(5, minmax(0, 1fr))" },
      }}>
        {FILTERS.map((f) => {
          const on = filter === f.key;
          const hot = f.key === "late" && counts.late > 0;
          return (
            <ButtonBase key={f.key} onClick={() => setFilter(f.key)}
              sx={{
                display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0.25, p: 1.5, borderRadius: 2.5,
                fontFamily: "inherit", textAlign: "left", bgcolor: on ? alpha(f.color, 0.08) : "#fff",
                border: `1.5px solid ${on ? alpha(f.color, 0.55) : hot ? alpha(f.color, 0.35) : "#e2e8f0"}`,
              }}>
              <Typography sx={{ fontSize: "1.6rem", fontWeight: 900, lineHeight: 1.1, color: f.key === "all" ? "#0f172a" : f.color }}>
                {counts[f.key] || 0}
              </Typography>
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: on ? f.color : "#475569" }}>{f.label}</Typography>
            </ButtonBase>
          );
        })}
      </Box>

      {techs.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8, color: "text.secondary", bgcolor: "#fff", border: "1px dashed #e2e8f0", borderRadius: 3 }}>
          <Groups sx={{ fontSize: 48, opacity: 0.25, mb: 1 }} />
          <Typography fontWeight={700}>{rows.length === 0 ? "วันนี้ไม่มีงานที่ลงตารางไว้" : "ไม่มีงานในกลุ่มนี้"}</Typography>
        </Box>
      ) : (
        // ── การ์ดละ 1 ช่าง ──
        <Box sx={{ display: "grid", gap: 1.5, alignItems: "start", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" } }}>
          {techs.map((t) => {
            const inCount = t.jobs.filter((j) => ["checkin", "request", "closed"].includes(j.state)).length;
            const lateCount = t.jobs.filter((j) => j.state === "late").length;
            return (
              <Box key={t.name} sx={{
                bgcolor: "#fff", border: `1px solid ${lateCount ? alpha("#dc2626", 0.35) : "#e2e8f0"}`, borderRadius: 3, overflow: "hidden",
                boxShadow: "0 1px 2px rgba(15,23,42,.04)",
              }}>
                {/* หัวการ์ด: ช่าง */}
                <Stack direction="row" alignItems="center" gap={1.25} sx={{ px: 1.75, py: 1.25, bgcolor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <Avatar name={t.name} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: "0.95rem", fontWeight: 800, color: t.name === UNASSIGNED ? "#64748b" : "#0f172a" }}>{t.name}</Typography>
                    <Typography noWrap sx={{ fontSize: "0.74rem", color: "#64748b" }}>
                      {t.members.size ? `ทีม: ${[...t.members].join(", ")}` : `${t.jobs.length} งานวันนี้`}
                    </Typography>
                  </Box>
                  <Stack alignItems="flex-end" sx={{ flexShrink: 0 }}>
                    <Typography sx={{ fontSize: "0.95rem", fontWeight: 900, color: inCount === t.jobs.length ? "#059669" : "#0f172a", lineHeight: 1.2 }}>
                      {inCount}/{t.jobs.length}
                    </Typography>
                    <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: lateCount ? "#dc2626" : "#94a3b8" }}>
                      {lateCount ? `เลยเวลานัด ${lateCount}` : "เข้างานแล้ว"}
                    </Typography>
                  </Stack>
                </Stack>
                {/* งานของช่าง — เรียงตามเวลานัด */}
                {t.jobs.map(({ e, a, state }, i) => (
                  <ButtonBase key={e._id} onClick={() => onOpenJob?.(e._id)}
                    sx={{
                      width: "100%", display: "flex", alignItems: "center", gap: 1.25, px: 1.75, py: 1.25, textAlign: "left", fontFamily: "inherit",
                      borderTop: i ? "1px solid #f1f5f9" : 0, borderLeft: `4px solid ${STATE[state].color}`,
                      "&:hover": { bgcolor: "#f8fafc" },
                    }}>
                    <Stack alignItems="center" sx={{ width: 46, flexShrink: 0 }}>
                      <AccessTime sx={{ fontSize: 15, color: "#94a3b8" }} />
                      <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: "#334155", fontVariantNumeric: "tabular-nums" }}>
                        {hasTime(e) ? moment(e.start).format("HH:mm") : "ทั้งวัน"}
                      </Typography>
                    </Stack>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: "0.88rem", fontWeight: 800, color: "#0f172a" }}>
                        {e.site || e.company || "ไม่ระบุโครงการ"}
                      </Typography>
                      <Typography noWrap sx={{ fontSize: "0.76rem", color: "#64748b" }}>
                        {[e.title, e.system, e.jobNo].filter(Boolean).join(" · ") || "-"}
                      </Typography>
                    </Box>
                    <StateChip state={state} att={a} />
                    <ChevronRight sx={{ fontSize: 18, color: "#cbd5e1", flexShrink: 0 }} />
                  </ButtonBase>
                ))}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
