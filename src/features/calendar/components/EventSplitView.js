/**
 * EventSplitView — มุมมอง "รายวัน" ของตารางงานช่าง: ปฏิทินเดือนย่อ (ซ้าย) + งานของวันที่เลือก (ขวา)
 *
 * ✅ (25 พ.ย. 2569 ผู้ใช้: "ทำปุ่มเมนูสลับรูปแบบการแสดงของหน้า Event ให้เป็นแบบนี้ได้ด้วย (แบบหน้าต่างเลือกงาน OT)
 *    ให้ดูง่าย สวยงาม แค่สลับรูปแบบการแสดงผลได้นะ แบบเดิมยังคงไว้ทั้งหมด")
 *    • เป็นมุมมองที่ 3 ข้าง "รายการ" กับ "ปฏิทิน" — ปฏิทินเดิม (FullCalendar) ยังอยู่ครบ แค่ซ่อนไว้ตอนดูแบบนี้
 *    • ข้อมูลชุดเดียวกับปฏิทิน (filteredCalendarEvents) — ค้นหา/ตัวกรอง/เลือกช่างด้านบนมีผลเหมือนกัน
 *    • กดงาน = เปิดฟอร์มงานตัวเดิม (openTechFromList) · กด "ลงงานวันนี้" = ลงงานในวันที่เลือก
 *    • ปฏิทิน: จุด = จำนวนงานในวันนั้น · วันหยุดนักขัตฤกษ์สีแดง (จากรายการวันหยุดบนปฏิทินเดิม)
 *    • งานหลายวันแสดงทุกวันที่เข้า บอกว่า "วันที่ 2 จาก 4 ของงาน"
 * 🎨 (25 พ.ย. 2569 ผู้ใช้: "ให้แยกสีแสดงตามข้อมูลสีของงานที่ลงด้วยให้สวยงาม") จุดในปฏิทิน + แถบข้างการ์ด + ป้ายประเภท
 *    ใช้สีของงานเอง (backgroundColor ชุดเดียวกับแท่งงานบนปฏิทินเดิม)
 */
import { useMemo, useRef, useState } from "react";
import moment from "moment";
import { Box, Stack, Typography, IconButton, Button, ButtonBase, Tooltip, useMediaQuery } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ChevronLeftRounded, ChevronRightRounded, AddRounded, EventBusyRounded, AccessTimeRounded } from "@mui/icons-material";
import JobTypeChip from "@/shared/ui/JobTypeChip";
import { WorkersRow, useUserDirectory, dayOfJobText } from "@/shared/ui/JobCalendarPicker";
import { jobText } from "@/features/expenses/expenseMeta";
import { thaiDate } from "@/shared/utils/thaiDate";
import { useAuth } from "@/features/auth/AuthContext";
import { TECH_STATUS_COLOR } from "./TechAgenda";

const ACCENT = "#2563eb"; // ✅ น้ำเงินหลักของแอป (การเลือก/ปุ่ม)
const ACCENT_DARK = "#1d4ed8";
const INK = "#0f172a";
const SUB = "#64748b";
const LINE = "#e6e9ef";
const SOFT = "#f8fafc";
const HOLIDAY = "#dc2626";
const DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const DAY_TH = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const MONTH_TH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

/** งานบนปฏิทิน → รูปที่การ์ดใช้ (ฟิลด์อยู่ได้ทั้งระดับบนและใน extendedProps) */
const toJob = (e) => {
  const x = { ...(e.extendedProps || {}), ...e };
  return {
    _id: String(e.id || e._id), title: x.title, system: x.system, company: x.company, site: x.site,
    start: e.start, end: e.end, allDay: e.allDay, status: x.status || "กำลังรอยืนยัน", team: x.team, teamMembers: x.teamMembers || [],
    visitCount: x.visitCount, round: x.time === undefined || x.time === null ? "" : String(x.time),
    startTime: x.startTime || "", endTime: x.endTime || "", approvalStatus: x.approvalStatus, closeRequested: x.closeRequested,
    backgroundColor: e.backgroundColor || x.backgroundColor || "", textColor: e.textColor || x.textColor || "",
  };
};
/** วันของงาน (YYYY-MM-DD) — end ของงานทั้งวันเป็นแบบไม่รวมวันสุดท้าย */
const daysOf = (j) => {
  if (!j.start) return [];
  const s = moment(j.start).startOf("day");
  let e = j.end ? moment(j.end) : s.clone();
  if (j.end && (j.allDay || e.format("HH:mm:ss") === "00:00:00") && e.isAfter(s)) e = e.clone().subtract(1, "ms");
  const n = Math.min(62, Math.max(1, e.clone().startOf("day").diff(s, "days") + 1));
  return Array.from({ length: n }, (_, i) => s.clone().add(i, "day").format("YYYY-MM-DD"));
};
const withoutType = (j) => {
  const t = String(j.title || "").trim();
  const l = jobText(j) || j.title || "งาน";
  return t && l.toLowerCase().startsWith(t.toLowerCase()) ? l.slice(t.length).trim() || l : l;
};

export default function EventSplitView({ events = [], onOpen, onAdd, canAdd = true, addLabel = "ลงงาน" }) {
  const isMobile = useMediaQuery("(max-width:900px)");
  const today = moment().format("YYYY-MM-DD");
  const [month, setMonth] = useState(() => moment().startOf("month"));
  const [day, setDay] = useState(today);
  const listRef = useRef(null);
  const { userData } = useAuth();
  const users = useUserDirectory(true);
  const myId = String(userData?.userId || "");
  const myName = String(userData?.fname || "").trim();

  // วันหยุดนักขัตฤกษ์ — มากับรายการงานของปฏิทินเดิม (extendedProps.isHoliday)
  const holidays = useMemo(() => {
    const m = new Map();
    events.filter((e) => e?.extendedProps?.isHoliday).forEach((e) => m.set(moment(e.start).format("YYYY-MM-DD"), e.title));
    return m;
  }, [events]);
  const byDay = useMemo(() => {
    const m = new Map();
    events
      .filter((e) => !e?.extendedProps?.isHoliday && String(e?.department ?? e?.extendedProps?.department ?? "service") !== "sales")
      .map(toJob)
      .forEach((j) => daysOf(j).forEach((d) => { if (!m.has(d)) m.set(d, []); m.get(d).push(j); }));
    m.forEach((list) => list.sort((a, b) => String(a.startTime || "00:00").localeCompare(String(b.startTime || "00:00")) || new Date(a.start) - new Date(b.start)));
    return m;
  }, [events]);

  const cells = useMemo(() => {
    const first = month.clone().startOf("month").startOf("week");
    return Array.from({ length: 42 }, (_, i) => first.clone().add(i, "day"));
  }, [month]);
  const pickDay = (d) => {
    setDay(d);
    if (moment(d).month() !== month.month() || moment(d).year() !== month.year()) setMonth(moment(d).startOf("month"));
    if (isMobile) setTimeout(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  const dayJobs = byDay.get(day) || [];
  const monthCount = useMemo(() => {
    const ids = new Set();
    byDay.forEach((list, d) => { if (moment(d).isSame(month, "month")) list.forEach((j) => ids.add(j._id)); });
    return ids.size;
  }, [byDay, month]);

  const calendar = (
    <Box sx={{ p: { xs: 1.5, sm: 2 }, borderRight: { md: `1px solid ${LINE}` }, borderBottom: { xs: `1px solid ${LINE}`, md: 0 } }}>
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1.25 }}>
        <IconButton size="small" onClick={() => setMonth((m) => m.clone().subtract(1, "month"))} aria-label="เดือนก่อน"><ChevronLeftRounded /></IconButton>
        <Box sx={{ flex: 1, textAlign: "center" }}>
          <Typography sx={{ fontWeight: 900, fontSize: "1.02rem", color: INK, lineHeight: 1.2 }}>{MONTH_TH[month.month()]} {month.year() + 543}</Typography>
          <Typography sx={{ fontSize: "0.7rem", color: SUB }}>{monthCount} งานในเดือนนี้</Typography>
        </Box>
        <IconButton size="small" onClick={() => setMonth((m) => m.clone().add(1, "month"))} aria-label="เดือนถัดไป"><ChevronRightRounded /></IconButton>
        <Button size="small" onClick={() => pickDay(today)}
          sx={{ textTransform: "none", fontWeight: 800, color: ACCENT_DARK, minWidth: 0, px: 1, borderRadius: 2, bgcolor: alpha(ACCENT, 0.08) }}>วันนี้</Button>
      </Stack>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 0.5 }}>
        {DOW.map((d, i) => (
          <Typography key={d} sx={{ textAlign: "center", fontSize: "0.7rem", fontWeight: 800, color: i === 0 || i === 6 ? SUB : SUB, pb: 0.25 }}>{d}</Typography>
        ))}
        {cells.map((m) => {
          const d = m.format("YYYY-MM-DD");
          const inMonth = m.month() === month.month();
          const jobs = byDay.get(d) || [];
          const sel = d === day;
          const hol = holidays.get(d);
          const isToday = d === today;
          return (
            <Tooltip key={d} title={[hol, jobs.length ? `${jobs.length} งาน` : ""].filter(Boolean).join(" · ")} disableInteractive enterDelay={400}>
              <ButtonBase onClick={() => pickDay(d)} aria-label={`${thaiDate(d)}${jobs.length ? ` มี ${jobs.length} งาน` : ""}`} aria-pressed={sel}
                sx={{
                  flexDirection: "column", justifyContent: "flex-start", gap: 0.4, height: { xs: 50, sm: 60 }, pt: 0.6, borderRadius: 2, fontFamily: "inherit",
                  opacity: inMonth ? 1 : 0.38, bgcolor: sel ? ACCENT : jobs.length ? "#fff" : "transparent",
                  border: `1px solid ${sel ? ACCENT : isToday ? alpha(ACCENT, 0.6) : jobs.length ? LINE : "transparent"}`,
                  boxShadow: sel ? `0 4px 12px ${alpha(ACCENT, 0.3)}` : "none", transition: "background-color .12s, box-shadow .12s",
                  "&:hover": { bgcolor: sel ? ACCENT_DARK : alpha(ACCENT, 0.06) },
                }}>
                <Typography component="span" sx={{ fontSize: "0.88rem", fontWeight: isToday || sel ? 900 : 700, lineHeight: 1, color: sel ? "#fff" : hol ? HOLIDAY : INK }}>{m.date()}</Typography>
                {jobs.length > 0 && (
                  <Stack direction="row" spacing={0.3} alignItems="center">
                    {jobs.slice(0, 3).map((j) => (
                      <Box key={j._id} sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: j.backgroundColor || ACCENT, boxShadow: sel ? "0 0 0 1.5px #fff" : "none" }} />
                    ))}
                    {jobs.length > 3 && <Typography component="span" sx={{ fontSize: "0.6rem", fontWeight: 800, lineHeight: 1, color: sel ? "#fff" : SUB }}>+{jobs.length - 3}</Typography>}
                  </Stack>
                )}
              </ButtonBase>
            </Tooltip>
          );
        })}
      </Box>
      <Stack direction="row" spacing={1.5} useFlexGap sx={{ mt: 1.25, flexWrap: "wrap", rowGap: 0.5 }}>
        <Stack direction="row" spacing={0.6} alignItems="center">
          <Stack direction="row" spacing={0.3}>{["#7c3aed", "#0891b2", "#e11d48"].map((c) => <Box key={c} sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: c }} />)}</Stack>
          <Typography sx={{ fontSize: "0.68rem", color: SUB }}>จุด = งานในวันนั้น (สีตามงาน)</Typography>
        </Stack>
        <Stack direction="row" spacing={0.6} alignItems="center">
          <Box sx={{ width: 8, height: 8, borderRadius: 0.5, bgcolor: HOLIDAY }} />
          <Typography sx={{ fontSize: "0.68rem", color: SUB }}>วันหยุดนักขัตฤกษ์</Typography>
        </Stack>
      </Stack>
    </Box>
  );

  const hol = holidays.get(day);
  const list = (
    <Box ref={listRef} sx={{ display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, bgcolor: SOFT, scrollMarginTop: 72 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ p: { xs: 1.5, sm: 2 }, pb: 1.25, bgcolor: "#fff", borderBottom: `1px solid ${LINE}` }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900, fontSize: "1rem", color: INK }}>วัน{DAY_TH[moment(day).day()]}ที่ {thaiDate(day)}</Typography>
          <Typography sx={{ fontSize: "0.76rem", color: hol ? HOLIDAY : SUB, fontWeight: hol ? 700 : 400 }}>
            {hol ? `${hol} · ` : ""}{dayJobs.length ? `${dayJobs.length} งาน — กดงานเพื่อเปิดดู/แก้ไข` : "ไม่มีงานในวันนี้"}
          </Typography>
        </Box>
        {canAdd && (
          <Button size="small" variant="contained" disableElevation startIcon={<AddRounded />} onClick={() => onAdd?.(day)}
            sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, flexShrink: 0, bgcolor: ACCENT, "&:hover": { bgcolor: ACCENT_DARK } }}>
            {addLabel}วันนี้
          </Button>
        )}
      </Stack>
      <Box sx={{ flex: 1, overflowY: { md: "auto" }, p: { xs: 1.25, sm: 1.5 } }}>
        {dayJobs.length === 0 ? (
          <Stack alignItems="center" spacing={1} sx={{ py: 6, px: 2, textAlign: "center" }}>
            <EventBusyRounded sx={{ fontSize: 38, color: "#cbd5e1" }} />
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: SUB }}>วันนี้ยังไม่มีงาน</Typography>
            <Typography sx={{ fontSize: "0.76rem", color: "#94a3b8" }}>เลือกวันที่มีจุดในปฏิทิน{canAdd ? ` หรือกด “${addLabel}วันนี้”` : ""}</Typography>
          </Stack>
        ) : (
          <Stack spacing={1}>
            {dayJobs.map((j) => {
              const stColor = TECH_STATUS_COLOR[j.status] || SUB;
              const time = j.startTime ? `${j.startTime}${j.endTime ? `–${j.endTime}` : ""} น.` : "ทั้งวัน";
              return (
                <ButtonBase key={j._id} onClick={() => onOpen?.(j._id, day)} sx={{
                  position: "relative", overflow: "hidden", display: "block", textAlign: "left", width: "100%", pl: 2.25, pr: 1.5, py: 1.25, borderRadius: 2.5, fontFamily: "inherit",
                  bgcolor: j.backgroundColor ? alpha(j.backgroundColor, 0.035) : "#fff", border: `1px solid ${j.backgroundColor ? alpha(j.backgroundColor, 0.28) : LINE}`,
                  boxShadow: "0 1px 2px rgba(15,23,42,.04)", transition: "border-color .12s, box-shadow .12s",
                  "&::before": { content: '""', position: "absolute", left: 0, top: 0, bottom: 0, width: 5, bgcolor: j.backgroundColor || ACCENT },
                  "&:hover": { borderColor: j.backgroundColor || ACCENT, boxShadow: `0 4px 14px ${alpha(j.backgroundColor || ACCENT, 0.18)}` },
                }}>
                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5, minWidth: 0, flexWrap: "wrap", rowGap: 0.5 }}>
                    <JobTypeChip job={j} />
                    <Stack direction="row" spacing={0.4} alignItems="center" sx={{ color: SUB }}>
                      <AccessTimeRounded sx={{ fontSize: 14 }} />
                      <Typography component="span" sx={{ fontSize: "0.74rem", fontWeight: 700 }}>{time}</Typography>
                    </Stack>
                    {dayOfJobText(j, day) && <Typography component="span" sx={{ fontSize: "0.72rem", color: SUB }}>· {dayOfJobText(j, day)}</Typography>}
                    <Box sx={{ flex: 1 }} />
                    {j.approvalStatus === "pending" && (
                      <Box component="span" sx={{ px: 0.75, borderRadius: 99, fontSize: "0.66rem", fontWeight: 800, lineHeight: "20px", bgcolor: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" }}>รออนุมัติ</Box>
                    )}
                    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 0.85, borderRadius: 99, fontSize: "0.68rem", fontWeight: 800, lineHeight: "20px", bgcolor: alpha(stColor, 0.08), color: stColor }}>
                      <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: stColor }} />{j.status}
                    </Box>
                  </Stack>
                  <Typography sx={{ fontSize: "0.92rem", fontWeight: 800, color: INK, lineHeight: 1.4 }}>{withoutType(j)}</Typography>
                  {j.company && j.company !== j.site && <Typography noWrap sx={{ fontSize: "0.74rem", color: SUB, mt: 0.2 }}>{j.company}</Typography>}
                  <WorkersRow job={j} users={users} myId={myId} myName={myName} accentDark={ACCENT_DARK} sx={{ mt: 0.9, pt: 0.9, borderTop: `1px dashed ${LINE}` }} />
                </ButtonBase>
              );
            })}
          </Stack>
        )}
      </Box>
    </Box>
  );

  return (
    <Box sx={{
      mb: 2, bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, overflow: "hidden",
      display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", md: "minmax(0, 1.05fr) minmax(0, 1fr)" },
      height: { md: "calc(100vh - 230px)" }, minHeight: { md: 560 },
    }}>
      {calendar}
      {list}
    </Box>
  );
}
