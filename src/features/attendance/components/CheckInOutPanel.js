/**
 * CheckInOutPanel — "ขั้นตอนของฉัน" + บันทึกเข้างาน ในการ์ดงาน (10 ต.ค. 2569)
 *
 * ✅ (11 ต.ค. 2569 ผู้ใช้: "ตัดระบบเช็คเอาต์ออก" + "แก้คำจากเช็คอินเป็นเข้างาน ทุกๆหน้า")
 *    ขั้นตอนเหลือ: รับทราบ → เข้างาน (ถ่ายรูปหน้างาน) → เอกสาร → ขอปิดงาน · คำบนจอใช้ "เข้างาน" ทั้งหมด
 *    (ชื่อไฟล์/ตัวแปร/route ยังเป็น check-in ตามเดิม — เปลี่ยนเฉพาะคำที่ผู้ใช้เห็น)
 *
 * ✅ (10 ต.ค. 2569 ผู้ใช้: "ปุ่มรับทราบกับเช็คอินคล้ายกัน และจุดวางทำให้งง แก้ให้ดูง่าย สมบูรณ์แบบ")
 *    เดิมมีปุ่มน้ำเงินเต็มความกว้าง 2 ปุ่มคนละที่ (เช็คอิน · รับทราบงาน) + กล่องขั้นตอนถัดไปอีกกล่อง
 *    ✅ ตอนนี้รวมเป็นกล่องเดียว: แถบขั้นตอน 4 ขั้น (รับทราบ → เช็คอิน → เช็คเอาต์ → ขอปิดงาน)
 *       และ "ปุ่มหลักปุ่มเดียว" ของขั้นที่ต้องทำตอนนี้เท่านั้น
 *    • ก่อนถึงวันเข้างาน → ปุ่ม "รับทราบงาน"
 *    • ถึงวันเข้างาน     → ปุ่ม "เช็คอินเข้างาน" (เช็คอิน = รับทราบงานไปในตัว — server บันทึกให้)
 *    • กำลังทำงาน       → ตัวจับเวลา + ปุ่ม "เช็คเอาต์"
 *    • เช็คเอาต์แล้ว      → บอกให้แนบเอกสารแล้วขอปิดงาน (ปุ่มขอปิดงานอยู่ท้ายการ์ดเหมือนเดิม)
 *
 * เห็นเฉพาะช่างที่ได้รับมอบหมายงาน (isParticipant) — แอดมินเห็นแค่รายการเข้า-ออก + อนุมัติ/แก้เวลา
 *
 * @param user      ผู้ใช้ปัจจุบัน — ส่งมาเองเมื่อ mount นอก AuthProvider (เช่นในฟอร์ม EditEvent ที่เป็น SweetAlert)
 * @param embedded  อยู่ในฟอร์ม SweetAlert — ห้ามเรียก Swal ซ้อน (จะปิดฟอร์มที่เปิดอยู่ทิ้ง) ใช้ข้อความในกล่องแทน
 */
import { useCallback, useEffect, useState } from "react";
import moment from "moment";
import Swal from "@/shared/ui/swal";
import { Box, Stack, Typography, Button, ButtonBase, Collapse, Dialog, DialogContent, TextField } from "@mui/material";
import { alpha, createTheme, ThemeProvider } from "@mui/material/styles";
import appTheme from "@/app/theme";
import {
  LoginRounded, InfoOutlined, ThumbUpAltOutlined, CheckRounded, HourglassTopRounded,
  ExpandMoreRounded, HistoryRounded, TaskAltRounded, BlockRounded,
} from "@mui/icons-material";
import { BTN as MBTN, CARD, EYEBROW } from "@/shared/ui/modernUi";
import { PersonChip } from "@/shared/ui/PersonChip";
import AttendanceService from "@/shared/services/AttendanceService";
import EventService from "@/shared/services/EventService";
import useRealtime from "@/shared/realtime/useRealtime";
import { useAuth } from "@/features/auth/AuthContext";
import { can } from "@/shared/utils/roles";
import { isParticipant, isClosedJob, isAckedBy, ackTracked, attendanceTracked, isConfirmedJob, FLOW_SINCE } from "@/shared/utils/jobFlow";
import { refreshAppBadges } from "@/shared/hooks/useAppBadges";
import { formatThai } from "@/shared/utils/thaiDate";
import { INK, INK_2, MUTED, FAINT, SURFACE, ACCENT, LINE } from "@/shared/ui/PageKit";
import { fmtTime, locationBadge } from "../attendanceMeta";
import CheckDialog from "./CheckDialog";
import AttendanceList from "./AttendanceList";

// ✅ (10 ต.ค. 2569 ผู้ใช้: "เช็คอินให้ยึดหัวหน้าทีมเป็นหลัก แสดงชื่อลูกทีมด้วย ต้องสอดคล้องกับงานใน event ต้องตามขั้นตอน")
//    ขั้นตอนเต็ม: รับทราบ → เช็คอิน (วันเข้างาน + รูป) → เช็คเอาต์ (+ Service Report) → ส่งเอกสาร → ขอปิดงาน
//    🧹 (11 ต.ค. 2569 ผู้ใช้: "ตัดระบบเช็คเอาต์ออก ช่างต้องวิ่งหลายงาน ทำงานได้ยาก") — ตัดขั้นเช็คเอาต์ออก
// ✅ (11 ต.ค. 2569 ผู้ใช้: "เพิ่มสายสถานะงานยืนยันแล้ว · การกดยืนยันแล้วควรต่อจากการกดรับทราบอีกขั้น"
//     + "ทำให้ช่างโฟกัสกับขั้นตอนทั้งหมดจนจบงาน เพื่อติดตาม")
//    รับทราบ (ช่าง) › ยืนยันนัด (แอดมิน = สถานะ "ยืนยันแล้ว" ของงาน) › เข้างาน › เอกสาร › ขอปิดงาน › ปิดงาน (แอดมินอนุมัติ)
// ✅ (11 ต.ค. 2569 ผู้ใช้: "ขั้นตอนที่ 6 จากปิดงาน เป็นเสร็จสิ้น")
const STEPS = ["รับทราบ", "ยืนยันนัด", "เข้างาน", "เอกสาร", "ขอปิดงาน", "เสร็จสิ้น"]; // ยืนยันนัด = ผู้รับผิดชอบยืนยันนัดหมาย
const DECLINE_PRESETS = ["ติดงานอื่นวันนั้น", "ลา / ป่วย", "ไม่ถนัดงานระบบนี้", "อยู่ไกลเกินไป"];
// ⚠️ อยู่ในฟอร์ม SweetAlert (.swal2-container z-index 20000) — หน้าต่าง/ปฏิทินเลือกวันของ MUI ต้องลอยเหนือกว่า
//    (mount ด้วย createRoot แยก จึงไม่มี ThemeProvider ของแอป — ใช้ธีมของแอปแล้วยก zIndex ขึ้น)
const EMBEDDED_THEME = createTheme(appTheme, { zIndex: { modal: 20050, snackbar: 20060, tooltip: 20070 } });

/** ข้อความสถานะในกล่อง — ไอคอนวงกลม + ข้อความ */
const Note = ({ icon, tone = MUTED, children }) => (
  <Stack direction="row" gap={1.25} alignItems="center" sx={{ p: 1.5, borderRadius: "14px", bgcolor: SURFACE }}>
    <Box sx={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", bgcolor: alpha(tone, 0.12), color: tone, "& svg": { fontSize: 19 } }}>{icon}</Box>
    <Typography sx={{ fontSize: "0.88rem", color: INK, lineHeight: 1.5 }}>{children}</Typography>
  </Stack>
);

/**
 * ✅ (11 ต.ค. 2569 ผู้ใช้: "ขั้นตอนงานให้ย่อไป ให้เน้นเอกสารประจำงาน" · "ทีมเข้างาน ผู้รับผิดชอบ ควรอยู่ header ไม่กินพื้นที่")
 * ✅ (11 ต.ค. 2569 ผู้ใช้: "สีสายขั้นตอนมันกลืนเกินไป แก้ให้สวยงามและดูง่ายกว่านี้")
 *    แถบขั้นตอนแบบย่อ — วงกลม 4 จุดเชื่อมด้วยเส้น ป้ายชื่ออยู่ใต้ แยก 3 สถานะด้วยสีคนละโทนชัด ๆ:
 *    ผ่านแล้ว = วงเขียวทึบ ✓ + เส้นเขียว · ขั้นปัจจุบัน = วงน้ำเงินทึบมีเลข + วงแหวน + ป้ายตัวหนาน้ำเงิน · ยังไม่ถึง = วงขาวขอบเทา มีเลข
 */
const DONE_C = "#16a34a";
export function MiniSteps({ current, labels = STEPS, dates }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${labels.length}, 1fr)` }}>
      {labels.map((label, i) => {
        const done = i < current;
        const on = i === current;
        const lineL = i > 0 ? (i <= current ? DONE_C : "#e2e8f0") : "transparent";
        const lineR = i < labels.length - 1 ? (i < current ? DONE_C : "#e2e8f0") : "transparent";
        return (
          <Stack key={label} alignItems="center" sx={{ minWidth: 0 }}>
            <Box sx={{ position: "relative", width: "100%", height: 16, display: "grid", placeItems: "center" }}>
              <Box sx={{ position: "absolute", top: 7, left: 0, width: "50%", height: 2, bgcolor: lineL }} />
              <Box sx={{ position: "absolute", top: 7, right: 0, width: "50%", height: 2, bgcolor: lineR }} />
              <Box sx={{
                position: "relative", width: 16, height: 16, borderRadius: "50%", display: "grid", placeItems: "center",
                fontSize: "0.6rem", fontWeight: 700, fontVariantNumeric: "tabular-nums",
                bgcolor: done ? DONE_C : on ? ACCENT : "#fff",
                color: done || on ? "#fff" : "#94a3b8",
                border: done || on ? "none" : "1.5px solid #cbd5e1",
                boxShadow: on ? `0 0 0 3px ${alpha(ACCENT, 0.16)}` : "none",
              }}>
                {done ? <CheckRounded sx={{ fontSize: 12 }} /> : i + 1}
              </Box>
            </Box>
            <Typography noWrap sx={{ mt: 0.25, fontSize: labels.length > 5 ? "0.62rem" : "0.68rem", lineHeight: 1.25, maxWidth: "100%",
              fontWeight: on ? 700 : 500, color: on ? ACCENT : done ? "#15803d" : "#94a3b8" }}>{label}</Typography>
            {dates && <Typography noWrap sx={{ fontSize: "0.62rem", color: MUTED, lineHeight: 1.3, minHeight: "0.8rem" }}>{dates[i] || ""}</Typography>}
          </Stack>
        );
      })}
    </Box>
  );
}

/**
 * ✅ (15 ต.ค. 2569 ผู้ใช้: "โยกเอาเส้นดำเนินงานมาไว้แสดงขั้นแรก ไม่อยากกดเข้าไปดู")
 * ขั้นปัจจุบันของงานจากข้อมูลงานอย่างเดียว (ไม่ต้องโหลดบันทึกเข้างาน) — ใช้กับแถบขั้นตอนบนการ์ดที่ยังไม่กาง
 * ⚠️ ตรรกะเดียวกับ current ใน CheckInOutPanel — เข้างานแล้วดูจาก checkedInAt (server ตั้งจากบันทึกเข้างานจริง)
 */
export function jobStepOf(event, docsComplete = false) {
  if (!event) return 0;
  if (["pending", "rejected"].includes(event.approvalStatus)) return 0;
  if (isClosedJob(event)) return STEPS.length;
  if (event.closeRequested) return 5;
  const legacyStarted = event.status === "กำลังดำเนินการ" && Boolean(event.createdAt) && new Date(event.createdAt) < new Date(FLOW_SINCE);
  if (event.checkedInAt || legacyStarted) return docsComplete ? 4 : 3;
  const acked = !ackTracked(event) || (event.acks || []).length > 0;
  if (acked && !event.ackDeclined?.userId) return isConfirmedJob(event) ? 2 : 1;
  return 0;
}

/**
 * ✅ (11 ต.ค. 2569 ผู้ใช้: "สายขั้นตอนมันซ้ำซ้อน ให้ตัดส่วนนี้ออก และใช้คำนี้ไปแทนข้างบน ใน editevent" → เลือก "ใช้คำสถานะแทน 4 ขั้น")
 * สายขั้นตอนแบบ "สถานะงาน" — รอยืนยัน › ยืนยันแล้ว › กำลังดำเนินการ › เสร็จสิ้น + วันที่ใต้ขั้นที่ผ่านแล้ว
 * (ย้ายมาจาก stepperHtml ใน EditEvent.js · เสร็จสิ้น = ผ่านครบทุกขั้น เป็นสีเขียวทั้งเส้น)
 */
const STATUS_STEPS = [
  { key: "กำลังรอยืนยัน", label: "รอยืนยัน", at: (e) => e.createdAt },
  { key: "ยืนยันแล้ว", label: "ยืนยันแล้ว", at: (e) => e.confirmedAt || (e.approvalStatus === "approved" ? e.approvalDecidedAt : "") },
  { key: "กำลังดำเนินการ", label: "กำลังดำเนินการ", at: (e) => e.checkedInAt },
  { key: "ดำเนินการเสร็จสิ้น", label: "เสร็จสิ้น", at: (e) => e.closeApprovedAt || e.checkedOutAt },
];
function statusStepsOf(event) {
  const idx = Math.max(0, STATUS_STEPS.findIndex((st) => st.key === event.status));
  // ✅ (11 ต.ค. 2569 ผู้ใช้: "หน้า event เมื่อกดยืนยัน ควรแสดงเป็นยืนยันแล้ว")
  //    สถานะที่งาน "อยู่" = ขั้นที่ผ่านแล้ว (✓ เขียว) · ขั้นถัดไปคือสิ่งที่รอ (น้ำเงิน) — เดิมขั้นของสถานะปัจจุบันเป็นสีน้ำเงินมีเลข ดูเหมือนยังไม่ได้ยืนยัน
  const current = idx + 1;
  const dates = STATUS_STEPS.map((st, i) => {
    const at = i <= idx ? st.at(event) : "";
    return at && moment(at).isValid() ? formatThai(moment(at), "D MMM YY") : "";
  });
  return { current, dates, labels: STATUS_STEPS.map((st) => st.label) };
}

function scheduledAttendanceDays(event) {
  const start = moment(event.start).utcOffset(7).startOf("day");
  const end = moment(event.end || event.start).utcOffset(7)
    .subtract(event.allDay ? 1 : 0, "days").startOf("day");
  if (!start.isValid() || !end.isValid() || end.isBefore(start)) return [];

  const days = [];
  for (let day = start.clone(); day.isSameOrBefore(end, "day") && days.length < 366; day.add(1, "day")) {
    days.push(day.clone());
  }
  return days;
}

function recordedAttendanceDayKeys(rows) {
  return new Set((rows || [])
    .filter((row) => row.checkIn?.at && moment(row.checkIn.at).isValid())
    .map((row) => moment(row.checkIn.at).utcOffset(7).format("YYYY-MM-DD")));
}

/** แสดงความคืบหน้าการบันทึกแยกตามวัน เมื่องานเดียวมีหลายวันเข้างาน */
function MultiDayAttendanceProgress({ event, rows }) {
  if (!Array.isArray(rows)) return null;
  const days = scheduledAttendanceDays(event);
  if (days.length < 2) return null;

  const checked = recordedAttendanceDayKeys(rows);
  const completedByPlan = days.filter((day) => checked.has(day.format("YYYY-MM-DD"))).length;
  const scheduledKeys = new Set(days.map((day) => day.format("YYYY-MM-DD")));
  const offPlanDays = [...checked].filter((day) => !scheduledKeys.has(day)).sort();
  const visibleDays = days.length > 10 ? days.slice(0, 9) : days;

  return (
    <Box sx={{ mt: 0.75, px: 1, py: 0.8, borderRadius: 1.5, bgcolor: "#f8fafc", border: `1px solid ${LINE}` }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: INK_2 }}>บันทึกเข้างานรายวัน</Typography>
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: checked.size ? "#15803d" : ACCENT, whiteSpace: "nowrap" }}>
          บันทึกแล้ว {checked.size} วัน
        </Typography>
      </Stack>
      <Typography sx={{ mt: 0.2, fontSize: "0.66rem", color: MUTED }}>
        ตรงตามแผน {completedByPlan} / {days.length} วัน
      </Typography>
      <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.65 }}>
        {visibleDays.map((day) => {
          const done = checked.has(day.format("YYYY-MM-DD"));
          return (
            <Box key={day.format("YYYY-MM-DD")} title={done ? `บันทึกแล้ว ${formatThai(day, "D MMM YYYY")}` : `ยังไม่ได้บันทึก ${formatThai(day, "D MMM YYYY")}`}
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.35, px: 0.7, py: 0.25, borderRadius: 99,
                bgcolor: done ? "#ecfdf5" : "#fff", border: `1px solid ${done ? "#bbf7d0" : LINE}`,
                color: done ? "#15803d" : MUTED, fontSize: "0.67rem", fontWeight: 700, whiteSpace: "nowrap" }}>
              {done ? <CheckRounded sx={{ fontSize: 13 }} /> : <Box component="span" sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#cbd5e1" }} />}
              {formatThai(day, "D MMM")}
            </Box>
          );
        })}
        {days.length > visibleDays.length && (
          <Typography sx={{ alignSelf: "center", fontSize: "0.67rem", color: MUTED }}>และอีก {days.length - visibleDays.length} วัน</Typography>
        )}
      </Stack>
      {offPlanDays.length > 0 && (
        <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap" sx={{ mt: 0.65 }}>
          <Typography sx={{ fontSize: "0.66rem", color: "#b45309", fontWeight: 700 }}>บันทึกนอกแผน</Typography>
          {offPlanDays.map((day) => (
            <Box key={day} title={`บันทึกเข้างาน ${formatThai(moment(day), "D MMM YYYY")} ซึ่งอยู่นอกช่วงวันที่ตามแผน`}
              sx={{ px: 0.7, py: 0.25, borderRadius: 99, bgcolor: "#fff7ed", border: "1px solid #fed7aa",
                color: "#b45309", fontSize: "0.67rem", fontWeight: 700, whiteSpace: "nowrap" }}>
              {formatThai(moment(day), "D MMM")}
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}

/**
 * ✅ (11 ต.ค. 2569 ผู้ใช้: "การรับทราบงานของช่างให้กดปฏิเสธได้ โดยกรอกเหตุผลมาด้วย")
 * กล่องปฏิเสธงาน — เลือกเหตุผลสำเร็จรูป หรือพิมพ์เอง (ต้องมีเหตุผลเสมอ)
 */
function DeclineDialog({ open, onClose, onSubmit, busy }) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) setReason(""); }, [open]);
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogContent sx={{ p: 2.25 }}>
        <Typography sx={{ fontWeight: 700, fontSize: "1rem", color: INK }}>ปฏิเสธงานนี้</Typography>
        <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 0.25 }}>แอดมินจะได้รับแจ้งพร้อมเหตุผล เพื่อมอบหมายคนอื่นแทน</Typography>
        <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1.5 }}>
          {DECLINE_PRESETS.map((t) => (
            <ButtonBase key={t} onClick={() => setReason(t)}
              sx={{ px: 1.25, height: 32, borderRadius: 99, fontFamily: "inherit", fontSize: "0.8rem", fontWeight: 500,
                border: `1px solid ${reason === t ? "#dc2626" : LINE}`, color: reason === t ? "#dc2626" : INK_2, bgcolor: reason === t ? "#fef2f2" : "#fff" }}>
              {t}
            </ButtonBase>
          ))}
        </Stack>
        <TextField fullWidth multiline minRows={2} size="small" value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="เหตุผล (จำเป็น)" sx={{ mt: 1.25 }} inputProps={{ maxLength: 500 }} />
        <Stack direction="row" gap={1} sx={{ mt: 1.75 }}>
          <Button fullWidth variant="outlined" onClick={onClose} disabled={busy} sx={{ ...MBTN.outline("#64748b"), minHeight: 40 }}>ยกเลิก</Button>
          <Button fullWidth variant="contained" disableElevation disabled={busy || !reason.trim()} onClick={() => onSubmit(reason.trim())}
            sx={{ ...MBTN.primary, minHeight: 40, bgcolor: "#dc2626", "&:hover": { bgcolor: "#b91c1c" } }}>
            {busy ? "กำลังส่ง…" : "ยืนยันปฏิเสธ"}
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

/** บรรทัดสถานะแบบย่อ — ไอคอนเล็ก + ข้อความ (+ ปุ่มข้อความทางขวา) */
const Line = ({ icon, tone = MUTED, children, right }) => (
  <Stack direction="row" alignItems="center" gap={0.75}>
    <Box sx={{ color: tone, display: "grid", flexShrink: 0, "& svg": { fontSize: 17 } }}>{icon}</Box>
    <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.8rem", color: INK_2, lineHeight: 1.45 }}>{children}</Typography>
    {right}
  </Stack>
);

const Hint = ({ children }) => (
  <Typography sx={{ mt: 0.85, textAlign: "center", fontSize: "0.76rem", color: MUTED }}>{children}</Typography>
);

/**
 * @param docsComplete  เอกสารประจำงานครบแล้วหรือยัง (ส่งมาจากการ์ดงาน) — ใช้เลื่อนแถบขั้นตอน "เอกสาร → ขอปิดงาน"
 */
export default function CheckInOutPanel({ event, onPreview, onChanged, onPatched, user, embedded = false, compact = false, statusSteps = false, docsComplete, sx, lineOnly = false }) {
  const auth = useAuth() || {};
  const userData = user || auth.userData;
  const me = String(userData?.userId || "");
  const participant = Boolean(event) && isParticipant(event, me, userData?.fname);
  const isApprover = can(userData, "approveJobs");
  const [rows, setRows] = useState(null);
  const [dialog, setDialog] = useState(false);
  const [acking, setAcking] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false); // บันทึกเข้างาน — พับไว้เป็นบรรทัดสรุป กดเพื่อดู
  const [flash, setFlash] = useState(null); // ข้อความแจ้งผลในกล่อง (โหมด embedded)
  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(null), 5000);
    return () => clearTimeout(t);
  }, [flash]);
  /** แจ้งผล — ปกติใช้ Swal · ในฟอร์ม SweetAlert ใช้ข้อความในกล่องแทน */
  const notify = ({ icon = "success", title, text = "", timer }) => {
    if (embedded) setFlash({ ok: icon !== "error", title, text });
    else Swal.fire({ icon, title, text, ...(timer ? { timer, showConfirmButton: false } : {}) });
  };

  /** ✅ (19 ต.ค. 2569 ผู้ใช้: "ให้มีคอนเฟิร์มทุกจุดที่กดปุ่ม") — ถามก่อนบันทึก · ในฟอร์ม SweetAlert ใช้กล่องถามของเบราว์เซอร์ (ซ้อน Swal ไม่ได้) */
  const ask = async (title, text, confirmButtonText) => {
    if (embedded) return window.confirm(`${title}
${text}`);
    const r = await Swal.fire({ icon: "question", title, text, showCancelButton: true, confirmButtonText });
    return r.isConfirmed;
  };

  const load = useCallback(async () => {
    if (!event?._id) return;
    try {
      const ev = await AttendanceService.ofEvent(event._id);
      setRows(ev?.attendance || []);
    } catch {
      setRows((p) => p || []);
    }
  }, [event?._id]);
  useEffect(() => { load(); }, [load]);
  useRealtime("attendance", () => { load(); });

  const myRows = (rows || []).filter((r) => String(r.userId) === me);

  if (!event || event.department === "sales" || event.unscheduled) return null;

  const closed = isClosedJob(event);
  const pendingApproval = ["pending", "rejected"].includes(event.approvalStatus);
  // ⚠️ งานเก่าก่อนเริ่มใช้ระบบเช็คอิน (ดู attendanceTracked) ไม่มีกล่องขั้นตอน — ปุ่มรับทราบงานกลับไปอยู่ที่ JobFlowPanel ตามเดิม
  const showFlow = participant && !closed && attendanceTracked(event);
  // ✅ (11 ต.ค. 2569 ผู้ใช้: "ทำไมรูปแบบไม่เหมือนกัน ดูสับสน") — การ์ดแบบย่อแสดงแถบขั้นตอนให้ทุกคนเหมือนกัน
  //    (เดิมคนที่ไม่ได้อยู่ในทีมเห็นกล่อง "ทำงาน → แนบเอกสาร → ขอปิดงาน" แบบเก่าจาก JobFlowPanel แทน)
  // statusSteps (ฟอร์ม EditEvent) = แสดงสายสถานะงานเสมอ แม้งานปิดแล้ว/งานเก่า
  // งานปิดแล้วก็แสดง (ผ่านครบทุกขั้น) — ช่างติดตามได้จนจบงาน
  const showSteps = compact ? statusSteps || closed || attendanceTracked(event) : showFlow;
  const viewOnly = !participant;

  if (!showSteps && !(rows || []).length) return null;

  // ── ทีมของวันนี้: หัวหน้าทีมเข้างานเป็นคนเช็คอินให้ทั้งทีม ──
  const head = event.team || "";
  const isResponsible = (event.responsiblePersonId && String(event.responsiblePersonId) === me) || (userData?.fname && event.responsiblePerson === userData.fname);
  const hasResponsible = Boolean(event.responsiblePersonId || event.responsiblePerson);
  const hasHead = Boolean(event.team || event.resPerson || (!event.team && !event.resPerson && hasResponsible));
  const isHead = (event.resPerson && String(event.resPerson) === me) || (userData?.fname && event.team === userData.fname) || (!event.team && !event.resPerson && isResponsible);
  const members = [...new Set((event.teamMembers || []).map((m) => m?.name).filter((n) => n && n !== head))];
  // เช็คอินนับแยกตามวันไทย: งานเดียวเข้างานซ้ำได้คนละวัน แต่วันเดียวกันบันทึกได้ครั้งเดียว
  const todayKey = moment().utcOffset(7).format("YYYY-MM-DD");
  const plannedDays = scheduledAttendanceDays(event);
  const recordedDays = recordedAttendanceDayKeys(rows || []);
  // 🐛 (15 ต.ค. 2569 ผู้ใช้: "บันทึกเข้างาน เด้งมาให้กดซ้ำทั้งที่งานเข้าวันเดียว") — เข้างานช้ากว่านัด (นอกวันนัด)
  //    ก็นับเป็นวันของงาน: บันทึกครบ "จำนวนวัน" ที่นัดไว้แล้ว = ครบ ไม่ต้องให้กดอีก (ตรงกับ server POST /attendance/check-in)
  const allPlannedDaysRecorded = plannedDays.length > 0
    && (plannedDays.every((day) => recordedDays.has(day.format("YYYY-MM-DD"))) || recordedDays.size >= plannedDays.length);
  const checkin = (rows || []).find((r) => r.checkIn?.at && moment(r.checkIn.at).utcOffset(7).format("YYYY-MM-DD") === todayKey);
  const latestCheckin = (rows || []).slice().sort((a, b) => new Date(b.checkIn?.at) - new Date(a.checkIn?.at))[0];
  // 🐛 (19 ต.ค. 2569 ผู้ใช้: "อยู่ขั้นตอนแนบเอกสารแล้ว ยังมีปุ่มบันทึกเข้างาน เกิดจากอะไร")
  //    สาเหตุ: งานนัด 2 วัน แต่บันทึกเข้างานไว้ 1 วัน (นอกแผน) → ระบบถือว่ายังบันทึกไม่ครบจำนวนวัน จึงโชว์ปุ่มใหญ่ทุกวัน
  //    แม้วันนัดผ่านไปหมดแล้ว · และแถบขั้นตอนดูแค่ "เข้างานวันนี้" จึงย้อนกลับไปขั้นเข้างาน
  //    ✅ เลยวันนัดสุดท้ายแล้ว + เคยบันทึกเข้างานอย่างน้อย 1 วัน = ผ่านขั้นเข้างาน → ไปขั้นเอกสาร
  //       (ยังบันทึกเพิ่มได้ด้วยปุ่มเล็ก "บันทึกเข้างานเพิ่มวันนี้" สำหรับวันที่ต้องกลับไปทำต่อจริง)
  const lastPlanned = plannedDays.length ? plannedDays[plannedDays.length - 1] : moment(event.end || event.start);
  const planPassed = moment().utcOffset(7).startOf("day").isAfter(moment(lastPlanned).utcOffset(7).startOf("day"));
  const attendanceDone = allPlannedDaysRecorded || (Boolean(latestCheckin) && planPassed);

  // ── ขั้นปัจจุบัน (ของทีม) ──
  const teamAcks = event.acks || [];
  // คนในทีม = ฉันรับทราบแล้วหรือยัง · คนนอกทีม (ดูอย่างเดียว) = มีใครในทีมรับทราบแล้วหรือยัง
  // ✅ (11 ต.ค. 2569 ผู้ใช้: "ให้หัวหน้าทีม หรือ ผู้รับผิดชอบ กดรับทราบ แค่นั้น") — รับทราบเป็นของ "ทั้งทีม":
  //    หัวหน้าทีมหรือผู้รับผิดชอบคนใดคนหนึ่งกดแล้ว = รับทราบแล้ว · ลูกทีม/แอดมินกดแทนไม่ได้
  // ✅ (11 ต.ค. 2569 ผู้ใช้ — ขั้นตอนใหม่) รับทราบ + ยืนยันนัดหมาย = ผู้รับผิดชอบงาน
  //    (ยังไม่มอบหมายผู้รับผิดชอบ → หัวหน้าทีมแทน) · บันทึกเข้างาน = หัวหน้าทีม หลังยืนยันนัดหมายแล้ว
  const canAck = hasResponsible ? Boolean(isResponsible) : Boolean(isHead);
  const respName = event.responsiblePerson || head;
  const acked = !ackTracked(event) || teamAcks.length > 0 || (rows || []).length > 0 || isAckedBy(event, me) || myRows.length > 0;
  const beforeDay = moment().startOf("day").isBefore(moment(event.start).startOf("day"));
  // ยืนยันนัด = สถานะงาน "ยืนยันแล้ว" (หรือเลยไปแล้ว) — ปุ่ม "ยืนยันนัดแล้ว" ของแอดมิน / ช่องสถานะในปฏิทิน ตัวเดียวกัน
  const confirmed = isConfirmedJob(event); // รวมงานเก่าที่เลยวันแล้ว (ดู isLegacyPreconfirmed)
  // ปฏิเสธงานที่ยังค้าง (ล้างเองเมื่อมีคนรับทราบ/มอบหมายใหม่ — ดู server jobflow ack-decline)
  const declined = event.ackDeclined?.userId ? event.ackDeclined : null;
  const declinedByMe = declined && String(declined.userId) === me;
  // งานเดิมก่อนเปิดใช้ระบบบันทึกเข้างาน ที่สถานะ "กำลังดำเนินการ" อยู่แล้ว = ถือว่าเข้างานแล้ว (ให้แถบตรงกับป้ายสถานะ)
  const legacyStarted = !checkin && !latestCheckin && event.status === "กำลังดำเนินการ" && Boolean(event.createdAt) && new Date(event.createdAt) < new Date(FLOW_SINCE);
  const current = closed ? STEPS.length
    : event.closeRequested ? 5
    : checkin || latestCheckin || legacyStarted ? (docsComplete ? 4 : 3)
    : acked && !declined ? (confirmed ? 2 : 1)
    : 0;

  const ack = async () => {
    if (!(await ask("รับทราบงานนี้?", `${event.title || "งาน"}${event.site ? ` · ${event.site}` : ""} — แอดมินจะเห็นว่าคุณรับงานแล้ว`, "รับทราบงาน"))) return;
    setAcking(true);
    try {
      const res = await EventService.AckJob(event._id);
      onPatched?.(res?.events || []);
      notify({ title: "รับทราบงานแล้ว", text: `ถึงวันเข้างานกด "เข้างาน" ตรงนี้`, timer: 1800 });
    } catch (err) {
      notify({ icon: "error", title: "ไม่สำเร็จ", text: err?.response?.data?.message || "กรุณาลองใหม่" });
    } finally {
      setAcking(false);
    }
  };

  const confirmJob = async () => {
    if (!(await ask("ยืนยันนัดหมายเข้างาน?", `เข้างาน ${formatThai(moment(event.start), "D MMM YYYY")} — หัวหน้าทีมจะได้รับแจ้ง`, "ยืนยันนัดหมาย"))) return;
    setAcking(true);
    try {
      const res = await EventService.ConfirmJob(event._id);
      onPatched?.(res?.events || []);
      refreshAppBadges();
      notify({ title: "ยืนยันนัดหมายแล้ว", text: `แจ้งหัวหน้าทีม${head ? ` ${head}` : ""} ให้บันทึกเข้างานในวันนัดแล้ว`, timer: 2000 });
    } catch (err) {
      notify({ icon: "error", title: "ไม่สำเร็จ", text: err?.response?.data?.message || "กรุณาลองใหม่" });
    } finally {
      setAcking(false);
    }
  };

  // ✅ (11 ต.ค. 2569 ผู้ใช้: "ให้กดอนุมัติผ่านตรงนี้ได้") — ผู้มีสิทธิ์อนุมัติกดอนุมัติ/ไม่อนุมัติงานได้จากแถบขั้นตอน
  const decideApproval = async (approve) => {
    let reason = "";
    if (!approve) {
      if (embedded) {
        const v = window.prompt("เหตุผลที่ไม่อนุมัติ (ถ้ามี)");
        if (v === null) return;
        reason = v.trim();
      } else {
        const r = await Swal.fire({ title: "ไม่อนุมัติงานนี้", input: "text", inputPlaceholder: "เหตุผล (ถ้ามี)", showCancelButton: true,
          confirmButtonText: "ไม่อนุมัติ", cancelButtonText: "ยกเลิก", confirmButtonColor: "#dc2626" });
        if (!r.isConfirmed) return;
        reason = (r.value || "").trim();
      }
    }
    setAcking(true);
    try {
      const res = await EventService.DecideApproval(event._id, approve ? "approve" : "reject", reason);
      onPatched?.(res?.events || []);
      refreshAppBadges();
      notify({ title: approve ? "อนุมัติงานแล้ว" : "ไม่อนุมัติงานแล้ว", text: approve ? "แจ้งผู้รับผิดชอบให้กดรับทราบงาน" : "", timer: 1600 });
    } catch (err) {
      notify({ icon: "error", title: "ไม่สำเร็จ", text: err?.response?.data?.message || "กรุณาลองใหม่" });
    } finally {
      setAcking(false);
    }
  };

  const decline = async (reason) => {
    setAcking(true);
    try {
      const res = await EventService.AckDecline(event._id, { reason });
      onPatched?.(res?.events || []);
      setDeclineOpen(false);
      refreshAppBadges();
      notify({ title: "ปฏิเสธงานแล้ว", text: "แจ้งแอดมินพร้อมเหตุผลแล้ว", timer: 1800 });
    } catch (err) {
      notify({ icon: "error", title: "ไม่สำเร็จ", text: err?.response?.data?.message || "กรุณาลองใหม่" });
    } finally {
      setAcking(false);
    }
  };

  const onDone = (data) => {
    setDialog(false);
    load();
    onChanged?.();
    refreshAppBadges();
    // server เปลี่ยนสถานะงานเป็น "กำลังดำเนินการ" + บันทึกรับทราบให้ — ส่งงานทั้งกลุ่มกลับไปอัปเดตหน้าจอทันที
    if (data?.events?.length) onPatched?.(data.events);
    const a = data?.attendance;
    const b = locationBadge(a?.checkIn);
    const workDay = a?.checkIn?.at ? formatThai(moment(a.checkIn.at).utcOffset(7), "D MMMM YYYY") : "วันนี้";
    notify({ title: `บันทึกเข้างานวันที่ ${workDay} แล้ว`, text: [b?.text, "วันทำงานถัดไปบันทึกเพิ่มได้"].filter(Boolean).join(" · "), timer: 2400 });
  };

  // ── เนื้อหาของขั้นปัจจุบัน (ปุ่มหลักปุ่มเดียว) ──
  const dayText = formatThai(moment(event.start), "D MMM YYYY");
  let action;
  if (pendingApproval) {
    action = <Note icon={<HourglassTopRounded />} tone="#d97706">งานนี้รอแอดมินอนุมัติ — อนุมัติแล้วจึงเริ่มงานได้</Note>;
  } else if (event.closeRequested) {
    action = <Note icon={<HourglassTopRounded />} tone="#d97706">ส่งขอปิดงานแล้ว — รอแอดมินตรวจเอกสารและอนุมัติ</Note>;
  } else if (checkin) {
    // เข้างานแล้ว — กล่องเดียว: เวลา · ใคร/ตำแหน่ง · (เส้นคั่น) ขั้นถัดไปเป็นข้อความธรรมดา
    // ✅ (11 ต.ค. 2569 ผู้ใช้: "ข้างล่างเข้างานอย่าทำให้เป็นเหมือนปุ่มกด เดี๋ยวสับสนได้") — ไม่มีกรอบ/สีปุ่ม
    const inBadge = locationBadge(checkin.checkIn);
    action = (
      <Box sx={{ p: 1.5, borderRadius: "14px", bgcolor: SURFACE }}>
        <Stack direction="row" gap={1.25} alignItems="center">
          <Box sx={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", bgcolor: alpha("#16a34a", 0.12), color: "#16a34a" }}>
            <TaskAltRounded sx={{ fontSize: 19 }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.92rem", fontWeight: 600, color: INK, lineHeight: 1.35 }}>เข้างานแล้ว {fmtTime(checkin.checkIn?.at)} น.</Typography>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.45 }}>
              {[checkin.userName, inBadge?.text].filter(Boolean).join(" · ")}
            </Typography>
          </Box>
        </Stack>
        <Typography sx={{ mt: 1.25, pt: 1.1, borderTop: "1px dashed #d8dee6", fontSize: "0.8rem", color: INK_2, lineHeight: 1.5 }}>
          บันทึกของวันนี้เรียบร้อยแล้ว{rows.length > 1 ? ` · บันทึกแล้ว ${rows.length} วัน` : ""}
        </Typography>
      </Box>
    );
  } else if (attendanceDone) {
    action = (
      <Box>
        <Note icon={<TaskAltRounded />} tone="#16a34a">
          {allPlannedDaysRecorded ? `บันทึกเข้างานครบตามวันที่กำหนดแล้ว · ${plannedDays.length}/${plannedDays.length} วัน` : `บันทึกเข้างานแล้ว ${recordedDays.size} วัน · ขั้นถัดไป: แนบเอกสารแล้วขอปิดงาน`}
        </Note>
        {isHead && !allPlannedDaysRecorded && (
          <ButtonBase onClick={() => setDialog(true)} sx={{ mt: 0.5, fontFamily: "inherit", fontSize: "0.76rem", fontWeight: 700, color: ACCENT }}>+ บันทึกเข้างานเพิ่มวันนี้ (ถ้ากลับไปทำต่อ)</ButtonBase>
        )}
      </Box>
    );
  } else if (!acked) {
    action = (
      <Box>
        <Button fullWidth variant="contained" disableElevation startIcon={<ThumbUpAltOutlined />} disabled={acking} onClick={ack} sx={MBTN.primary}>
          {acking ? "กำลังบันทึก…" : "รับทราบงาน"}
        </Button>
        <Hint>ให้แอดมินรู้ว่าคุณรับงานแล้ว · เข้างาน {dayText}</Hint>
      </Box>
    );
  } else if (!hasHead) {
    action = <Note icon={<InfoOutlined />} tone="#d97706">ยังไม่มีหัวหน้าทีมเข้างาน — รอแอดมินมอบหมายก่อนจึงกดเข้างานได้</Note>;
  } else if (beforeDay) {
    action = <Note icon={<HourglassTopRounded />} tone={ACCENT}>รับทราบแล้ว · กดเข้างานได้ในวันที่ <b>{dayText}</b>{isHead ? "" : ` (หัวหน้าทีม ${head} เป็นคนกด)`}</Note>;
  } else if (!isHead) {
    action = <Note icon={<InfoOutlined />} tone={ACCENT}>รอหัวหน้าทีม <b>{head}</b> กดเข้างานให้ทีม</Note>;
  } else {
    action = (
      <Box>
        <Button fullWidth variant="contained" disableElevation startIcon={<LoginRounded />} onClick={() => setDialog(true)} sx={MBTN.primary}>
          บันทึกเข้างานวันนี้
        </Button>
        <Hint>กดแทนทั้งทีม · ระบบบันทึกเวลาและตำแหน่งให้</Hint>
      </Box>
    );
  }

  const pendingFix = (rows || []).some((r) => r.hasPendingCorrection);
  const showLog = logOpen || (isApprover && pendingFix);

  // ── แบบย่อ (การ์ดงาน) — ทีม/ผู้รับผิดชอบอยู่หัวการ์ดแล้ว · ไม่มีกล่องใหญ่ · เน้นให้เอกสารด้านล่างเด่นกว่า ──
  if (compact) {
    const logLink = (rows || []).length > 0 && (
      <ButtonBase onClick={() => setLogOpen((v) => !v)} aria-expanded={showLog}
        sx={{ flexShrink: 0, gap: 0.25, px: 0.5, py: 0.25, borderRadius: "8px", fontFamily: "inherit", fontSize: "0.74rem", fontWeight: 600, color: pendingFix ? "#b45309" : ACCENT }}>
        {pendingFix ? "ขอแก้เวลา" : "บันทึก"}
        <ExpandMoreRounded sx={{ fontSize: 17, transition: "transform .2s", transform: showLog ? "rotate(180deg)" : "none" }} />
      </ButtonBase>
    );
    let line;
    const day = formatThai(moment(event.start), "D MMM");
    if (closed) line = <Line icon={<TaskAltRounded />} tone="#16a34a" right={logLink}>ปิดงานแล้ว{event.closeApprovedBy ? ` · อนุมัติโดย ${event.closeApprovedBy}` : ""}</Line>;
    else if (event.approvalStatus === "rejected") line = <Line icon={<InfoOutlined />} tone="#dc2626">ไม่อนุมัติงาน{event.approvalRejectReason ? ` — ${event.approvalRejectReason}` : ""}</Line>;
    else if (pendingApproval) {
      line = isApprover ? (
        <Box>
          <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 0.75 }}>
            {event.approvalRequestedBy ? `${event.approvalRequestedBy} ส่งงานนี้เข้าระบบ · ` : ""}รออนุมัติงาน
          </Typography>
          <Stack direction="row" gap={0.75}>
            <Button variant="contained" disableElevation disabled={acking} onClick={() => decideApproval(true)} startIcon={<TaskAltRounded />}
              sx={{ ...MBTN.success, minHeight: 40, flex: 2 }}>{acking ? "กำลังบันทึก…" : "อนุมัติงาน"}</Button>
            <Button variant="outlined" disabled={acking} onClick={() => decideApproval(false)}
              sx={{ ...MBTN.outline("#dc2626"), minHeight: 40, flex: 1 }}>ไม่อนุมัติ</Button>
          </Stack>
        </Box>
      ) : <Line icon={<HourglassTopRounded />} tone="#d97706">รอแอดมินอนุมัติงาน</Line>;
    }
    else if (event.closeRequested) line = <Line icon={<HourglassTopRounded />} tone="#d97706" right={logLink}>ส่งขอปิดงานแล้ว · รอแอดมินตรวจและอนุมัติปิดงาน</Line>;
    else if (checkin) {
      const b = locationBadge(checkin.checkIn);
      line = (
        <Line icon={<TaskAltRounded />} tone="#16a34a" right={logLink}>
          <b style={{ fontWeight: 600, color: INK }}>บันทึกวันนี้แล้ว · {fmtTime(checkin.checkIn?.at)}</b> · {checkin.userName}
          {b?.tone === "warn" && <Box component="span" sx={{ color: "#b45309" }}> · {b.text}</Box>}
        </Line>
      );
    } else if (attendanceDone) {
      line = (
        <Box>
          <Line icon={<TaskAltRounded />} tone="#16a34a" right={logLink}>
            {allPlannedDaysRecorded ? `บันทึกเข้างานครบตามวันที่กำหนดแล้ว · ${plannedDays.length}/${plannedDays.length} วัน` : `บันทึกเข้างานแล้ว ${recordedDays.size} วัน · ขั้นถัดไป: แนบเอกสารแล้วขอปิดงาน`}
          </Line>
          {isHead && !allPlannedDaysRecorded && (
            <ButtonBase onClick={() => setDialog(true)} sx={{ mt: 0.25, ml: 3, fontFamily: "inherit", fontSize: "0.74rem", fontWeight: 700, color: ACCENT }}>+ บันทึกเข้างานเพิ่มวันนี้ (ถ้ากลับไปทำต่อ)</ButtonBase>
          )}
        </Box>
      );
    } else if (legacyStarted) {
      line = <Line icon={<TaskAltRounded />} tone="#16a34a" right={logLink}>กำลังดำเนินการ · {docsComplete ? "เอกสารครบ กดขอปิดงานได้" : "แนบเอกสารประจำงานให้ครบ แล้วขอปิดงาน"}</Line>;
    } else if (declined && !declinedByMe) {
      line = <Line icon={<BlockRounded />} tone="#dc2626"><b style={{ fontWeight: 600 }}>{declined.name} ปฏิเสธงาน</b> — {declined.reason} · รอมอบหมายใหม่</Line>;
    } else if (declinedByMe) {
      line = (
        <Line icon={<BlockRounded />} tone="#dc2626"
          right={<ButtonBase onClick={ack} disabled={acking} sx={{ flexShrink: 0, px: 0.75, py: 0.25, borderRadius: "8px", fontFamily: "inherit", fontSize: "0.74rem", fontWeight: 600, color: ACCENT }}>เปลี่ยนใจ · รับทราบ</ButtonBase>}>
          <b style={{ fontWeight: 600 }}>คุณปฏิเสธงานนี้</b> — {declined.reason} · รอแอดมินมอบหมายใหม่
        </Line>
      );
    } else if (viewOnly) {
      // ✅ ใช้ข้อมูลจริง: "รับทราบแล้ว" เฉพาะเมื่อมีคนกดจริง · เลยวันเข้างานแล้วยังไม่มีใครกดเข้างาน = เตือนสีส้ม
      const lastDay = moment(event.end || event.start).subtract(event.allDay && event.end ? 1 : 0, "days").startOf("day");
      const pastDay = moment().startOf("day").isAfter(lastDay);
      const who = teamAcks.length ? `รับทราบแล้ว: ${teamAcks.map((x) => x.name).join(", ")}` : "";
      line = !hasHead ? <Line icon={<InfoOutlined />} tone="#d97706">ยังไม่มีหัวหน้าทีม — รอแอดมินมอบหมาย</Line>
        : !acked ? <Line icon={<InfoOutlined />} tone={pastDay ? "#d97706" : MUTED}>{pastDay ? `เลยวันเข้างาน (${day}) · ยังไม่รับทราบ/บันทึกเข้างาน` : `รอผู้รับผิดชอบ${respName ? ` ${respName}` : ""} กดรับทราบงาน · เข้างาน ${day}`}</Line>
        : pastDay ? <Line icon={<InfoOutlined />} tone="#d97706">{[who, `เลยวันเข้างาน (${day}) · ${confirmed ? "ยังไม่บันทึกเข้างาน" : "ยังไม่ยืนยันนัดหมาย"}`].filter(Boolean).join(" · ")}</Line>
        : (
          <Line icon={<HourglassTopRounded />} tone={MUTED}>
            {[who, !confirmed ? "รอผู้รับผิดชอบยืนยันนัดหมาย" : beforeDay ? `ยืนยันนัดหมายแล้ว · เข้างาน ${day}` : `รอหัวหน้าทีม ${head} บันทึกเข้างาน`].filter(Boolean).join(" · ")}
          </Line>
        );
    } else if (!acked && !canAck) {
      line = <Line icon={<InfoOutlined />} tone={MUTED}>รอผู้รับผิดชอบ{respName ? ` ${respName}` : ""} กดรับทราบงาน · เข้างาน {day}</Line>;
    } else if (!acked) {
      // ✅ รับทราบ (ปุ่มหลัก) + ปฏิเสธ (เส้นขอบแดง) คู่กัน — เฉพาะผู้รับผิดชอบ (ไม่มีผู้รับผิดชอบ → หัวหน้าทีม)
      line = (
        <Stack direction="row" gap={0.75}>
          <Button variant="contained" disableElevation startIcon={<ThumbUpAltOutlined />} disabled={acking} onClick={ack} sx={{ ...MBTN.primary, minHeight: 40, flex: 2.2 }}>
            {acking ? "กำลังบันทึก…" : `รับทราบงาน · ${day}`}
          </Button>
          <Button variant="outlined" disabled={acking} onClick={() => setDeclineOpen(true)} sx={{ ...MBTN.outline("#dc2626"), minHeight: 40, flex: 1 }}>
            ปฏิเสธ
          </Button>
        </Stack>
      );
    } else if (!confirmed) {
      // ✅ ขั้นถัดจากรับทราบ: ผู้รับผิดชอบยืนยันนัดหมาย (สถานะงาน → ยืนยันแล้ว)
      line = canAck ? (
        <Box>
          <Button fullWidth variant="contained" disableElevation startIcon={<TaskAltRounded />} disabled={acking} onClick={confirmJob} sx={{ ...MBTN.success, minHeight: 40 }}>
            {acking ? "กำลังบันทึก…" : `ยืนยันนัดหมาย · เข้างาน ${day}`}
          </Button>
          <Typography sx={{ mt: 0.5, textAlign: "center", fontSize: "0.72rem", color: MUTED }}>ยืนยันวันเข้างานกับลูกค้าแล้ว จึงกด · หัวหน้าทีมจะได้รับแจ้ง</Typography>
        </Box>
      ) : <Line icon={<HourglassTopRounded />} tone={MUTED}>รับทราบแล้ว · รอผู้รับผิดชอบ{respName ? ` ${respName}` : ""} ยืนยันนัดหมาย</Line>;
    } else if (!hasHead) line = <Line icon={<InfoOutlined />} tone="#d97706">ยืนยันนัดหมายแล้ว · ยังไม่มีหัวหน้าทีม — มอบหมายหัวหน้าทีมเข้างาน</Line>;
    else if (beforeDay) {
      line = <Line icon={<TaskAltRounded />} tone="#16a34a">ยืนยันนัดหมายแล้ว · {isHead ? `กดบันทึกเข้างานได้วันที่ ${day}` : `หัวหน้าทีม ${head} บันทึกเข้างานวันที่ ${day}`}</Line>;
    } else if (!isHead) line = <Line icon={<InfoOutlined />} tone={MUTED}>ยืนยันนัดหมายแล้ว · รอหัวหน้าทีม <b style={{ fontWeight: 600 }}>{head}</b> บันทึกเข้างาน</Line>;
    else {
      line = (
        <Button fullWidth variant="contained" disableElevation startIcon={<LoginRounded />} onClick={() => setDialog(true)} sx={{ ...MBTN.primary, minHeight: 42 }}>
          บันทึกเข้างานวันนี้
        </Button>
      );
    }
    // ✅ (20 ต.ค. 2569 ผู้ใช้: "การ์ดย่อยังกินพื้นที่ ยาวไป") lineOnly = เฉพาะแถวปุ่ม/สถานะบรรทัดเดียว (ไม่มีแถบขั้นตอน/บันทึกรายวัน)
    //    ใช้บนการ์ดย่อมือถือ — รายละเอียดเต็มอยู่ในแผ่นรายละเอียด
    if (lineOnly) {
      const slim = (
        <Box sx={{ ...sx }} onClick={(e) => e.stopPropagation()}>
          {flash && (
            <Box sx={{ mb: 0.75, px: 1.25, py: 0.75, borderRadius: "12px", bgcolor: flash.ok ? "#f0fdf4" : "#fef2f2" }}>
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: flash.ok ? "#15803d" : "#b91c1c" }}>{flash.ok ? "✓ " : ""}{flash.title}</Typography>
            </Box>
          )}
          {line}
          <CheckDialog open={dialog} event={event} onClose={() => setDialog(false)} onDone={onDone} />
          <DeclineDialog open={declineOpen} busy={acking} onClose={() => setDeclineOpen(false)} onSubmit={decline} />
        </Box>
      );
      return embedded ? <ThemeProvider theme={EMBEDDED_THEME}>{slim}</ThemeProvider> : slim;
    }
    const out = (
      <Box sx={{ mt: 1.25, ...sx }} onClick={(e) => e.stopPropagation()}>
        {/* ในฟอร์ม SweetAlert (embedded) แจ้งผลในกล่องแทน Swal */}
        {flash && (
          <Box sx={{ mb: 1, px: 1.25, py: 0.85, borderRadius: "12px", bgcolor: flash.ok ? "#f0fdf4" : "#fef2f2" }}>
            <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: flash.ok ? "#15803d" : "#b91c1c" }}>{flash.ok ? "✓ " : ""}{flash.title}</Typography>
            {flash.text && <Typography sx={{ fontSize: "0.76rem", color: INK_2 }}>{flash.text}</Typography>}
          </Box>
        )}
        {showSteps ? (
          <Box sx={{ px: 1, py: 0.75, borderRadius: "12px", border: `1px solid ${LINE}` }}>
            {statusSteps ? <MiniSteps {...statusStepsOf(event)} /> : <MiniSteps current={pendingApproval ? 0 : current} />}
            <MultiDayAttendanceProgress event={event} rows={rows} />
            <Box sx={{ mt: 0.75, pt: 0.75, borderTop: `1px solid ${LINE}` }}>{line}</Box>
          </Box>
        ) : (rows || []).length > 0 && (
          <Line icon={<HistoryRounded />} right={logLink}>บันทึกแล้ว {rows.length} วัน</Line>
        )}
        <Collapse in={showLog} unmountOnExit>
          <Box sx={{ pt: 1 }}>
            <AttendanceList rows={rows || []} me={me} isApprover={isApprover} onPreview={onPreview} embedded={embedded}
              onChanged={(r) => { setRows((prev) => prev.map((x) => (x._id === r._id ? r : x))); refreshAppBadges(); onChanged?.(); }} />
          </Box>
        </Collapse>
        <CheckDialog open={dialog} event={event} onClose={() => setDialog(false)} onDone={onDone} />
        <DeclineDialog open={declineOpen} busy={acking} onClose={() => setDeclineOpen(false)} onSubmit={decline} />
      </Box>
    );
    return embedded ? <ThemeProvider theme={EMBEDDED_THEME}>{out}</ThemeProvider> : out;
  }

  const body = (
    <Box sx={{ mt: 1.5, ...sx }} onClick={(e) => e.stopPropagation()}>
      {showFlow && (
        <Box sx={{ ...CARD, p: { xs: 1.75, sm: 2 } }}>
          <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography sx={EYEBROW}>ขั้นตอนของฉัน</Typography>
            <Typography sx={{ fontSize: "0.74rem", color: FAINT, fontWeight: 600 }}>{formatThai(moment(event.start), "ddd D MMM")}</Typography>
          </Stack>
          {/* ทีมของวันนี้ — หัวหน้าทีมเป็นหลัก + ลูกทีม */}
          <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap" sx={{ mb: 1.5 }}>
            <Typography sx={{ fontSize: "0.76rem", color: MUTED, fontWeight: 700 }}>ทีม</Typography>
            {head ? (
              <PersonChip name={head} strong badge="หัวหน้า" title={`หัวหน้าทีมเข้างาน: ${head}`} />
            ) : (
              <Typography sx={{ fontSize: "0.78rem", color: "#b45309", fontWeight: 700 }}>ยังไม่มีหัวหน้าทีม</Typography>
            )}
            {members.map((n) => <PersonChip key={n} name={n} title={`ลูกทีม: ${n}`} />)}
          </Stack>
          <Box sx={{ mb: 1.5 }}><MiniSteps current={pendingApproval ? 0 : current} /></Box>
          <MultiDayAttendanceProgress event={event} rows={rows} />
          {flash && (
            <Box sx={{ mb: 1.25, px: 1.5, py: 1, borderRadius: "12px", bgcolor: flash.ok ? "#f0fdf4" : "#fef2f2" }}>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: flash.ok ? "#15803d" : "#b91c1c" }}>{flash.ok ? "✓ " : ""}{flash.title}</Typography>
              {flash.text && <Typography sx={{ fontSize: "0.78rem", color: INK_2 }}>{flash.text}</Typography>}
            </Box>
          )}
          {action}
        </Box>
      )}

      {/* บันทึกเข้างาน — บรรทัดสรุปบรรทัดเดียว กดเพื่อดูรายละเอียด (ไม่ให้การ์ดยาวเกิน) */}
      {(rows || []).length > 0 && (
        <Box sx={{ mt: showFlow ? 1 : 0 }}>
          <ButtonBase onClick={() => setLogOpen((v) => !v)} aria-expanded={showLog}
            sx={{ width: "100%", justifyContent: "flex-start", gap: 1, px: 1.5, py: 1.1, borderRadius: "12px", fontFamily: "inherit",
              bgcolor: SURFACE, "&:hover": { bgcolor: "#eef2f6" } }}>
            <HistoryRounded sx={{ fontSize: 19, color: MUTED }} />
            <Typography sx={{ flex: 1, textAlign: "left", fontSize: "0.84rem", fontWeight: 700, color: INK_2 }}>
              บันทึกแล้ว {rows.length} วัน
            </Typography>
            {pendingFix && (
              <Box component="span" sx={{ px: 0.9, py: 0.15, borderRadius: 99, fontSize: "0.68rem", fontWeight: 600, color: "#b45309", bgcolor: "#fef3c7" }}>ขอแก้เวลา</Box>
            )}
            <ExpandMoreRounded sx={{ fontSize: 22, color: FAINT, transition: "transform .2s", transform: showLog ? "rotate(180deg)" : "none" }} />
          </ButtonBase>
          <Collapse in={showLog} unmountOnExit>
            <Box sx={{ pt: 1 }}>
              <AttendanceList rows={rows} me={me} isApprover={isApprover} onPreview={onPreview} embedded={embedded}
                onChanged={(r) => { setRows((prev) => prev.map((x) => (x._id === r._id ? r : x))); refreshAppBadges(); onChanged?.(); }} />
            </Box>
          </Collapse>
        </Box>
      )}

      <CheckDialog open={dialog} event={event} onClose={() => setDialog(false)} onDone={onDone} />
    </Box>
  );
  return embedded ? <ThemeProvider theme={EMBEDDED_THEME}>{body}</ThemeProvider> : body;
}
