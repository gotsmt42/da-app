/**
 * MobileJobSummary — หัวการ์ดงานแบบย่อบนมือถือ (ใช้ร่วม: รับงาน · การดำเนินงาน · งานของฉัน)
 *
 * ✅ (20 ต.ค. 2569 ผู้ใช้: "แก้หน้าการดำเนินงาน และงานของฉัน ให้เป็นรูปแบบอย่างงี้ — หน้าแรกข้อมูลไม่เยอะแต่สำคัญ
 *    ไม่รก ไม่กินพื้นที่ สวยงาม") ตอนพับเห็นแค่: ไอคอนปฏิทิน · ประเภทงาน/เลขที่งาน · ชื่องาน · โครงการ ·
 *    รูปผู้รับผิดชอบ + สถานะ · ขั้นถัดไปบรรทัดเดียว — กดที่การ์ดเพื่อกางดูรายละเอียดเต็ม
 */
import { Avatar, Box, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ExpandMoreRounded } from "@mui/icons-material";
import moment from "moment";
import { formatThai } from "@/shared/utils/thaiDate";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import { hasValidAvatar } from "@/shared/utils/user";
import { classifyJob, getJobClassMeta } from "@/shared/utils/jobClassification";
import { formatRoundLabel } from "@/shared/utils/contractRounds";

const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e2e8f0";
const SURFACE = "#f8fafc";
const ACCENT = "#2563eb";

/** ไอคอนปฏิทินขนาดเท่ากันทุกใบ: แถบบน = เดือน · กลาง = วัน (ตัวใหญ่) · ล่าง = วัน/ระยะ */
export const DateTile = ({ head, big, foot, color = "#475569", footColor = null, dashed = false, small = false }) => (
  <Box sx={{ width: 48, flexShrink: 0, borderRadius: 1.75, overflow: "hidden", textAlign: "center", bgcolor: "#fff",
    border: `1px ${dashed ? "dashed" : "solid"} ${dashed ? "#cbd5e1" : "#d5dce5"}` }}>
    <Box sx={{ py: 0.1, bgcolor: dashed ? SURFACE : "#475569", color: dashed ? MUTED : "#fff", fontSize: "0.58rem", fontWeight: 800, lineHeight: 1.5, whiteSpace: "nowrap" }}>{head}</Box>
    <Typography sx={{ fontSize: small ? "0.9rem" : "1.1rem", fontWeight: 900, lineHeight: 1.15, pt: small ? 0.35 : 0.15, color: dashed ? color : INK, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{big}</Typography>
    <Typography sx={{ fontSize: "0.56rem", fontWeight: 700, lineHeight: 1.3, pb: 0.3, color: footColor || (dashed ? color : MUTED), whiteSpace: "nowrap" }}>{foot}</Typography>
  </Box>
);

/** ไอคอนปฏิทินจากวันเข้างาน (หลายวัน = "20–22" · ล่างบอกจำนวนวัน) — สีเดียวกันทุกใบ วันนี้บอกด้วยคำว่า "วันนี้" */
export const EventDateTile = ({ event }) => {
  if (!event?.start) return <DateTile dashed head="วันเข้างาน" big="—" foot="ยังไม่กำหนด" color="#94a3b8" />;
  const s = moment(event.start);
  let e = event.end ? moment(event.end) : s.clone();
  if (event.allDay !== false && event.end && e.isAfter(s)) e = e.subtract(1, "day");
  const multi = e.isAfter(s, "day");
  const today = moment();
  const isToday = !today.isBefore(s, "day") && !today.isAfter(e, "day");
  return (
    // 🔁 (20 ต.ค. 2569 ผู้ใช้: "ตรงวันที่ยังล้น") หลายวัน: ตัวใหญ่ = วันแรก · ล่าง = "ถึง 16" (ไม่ยัด 15–16 ในกล่องแคบ)
    <DateTile head={formatThai(s, "MMM YY")} big={s.format("D")}
      foot={isToday ? "วันนี้" : multi ? `ถึง ${e.isSame(s, "month") ? e.format("D") : formatThai(e, "D MMM")}` : formatThai(s, "ddd")} footColor={isToday ? ACCENT : null} />
  );
};

/** รูปคน (ไม่มีรูป = ตัวอักษรแรกบนสีประจำตัว) */
export const PersonPic = ({ name, src, size = 30 }) => (
  <Avatar src={hasValidAvatar(src) ? src : undefined}
    sx={{ width: size, height: size, fontSize: size * 0.42, fontWeight: 800, bgcolor: personColor(name), flexShrink: 0, boxShadow: "0 0 0 2px #fff, 0 0 0 3px #e2e8f0" }}>
    {personInitial(name)}
  </Avatar>
);

export const StatusPill = ({ label, color = MUTED }) => (
  <Box component="span" sx={{ px: 0.9, height: 22, display: "inline-flex", alignItems: "center", flexShrink: 0, borderRadius: 99, fontSize: "0.7rem", fontWeight: 800,
    color, bgcolor: alpha(color, 0.1), whiteSpace: "nowrap" }}>{label}</Box>
);

/**
 * @param event        งาน
 * @param statusLabel  ข้อความสถานะ · statusColor สีสถานะ
 * @param next         { title, tone } ขั้นถัดไป (บรรทัดเดียว) — ไม่มีก็ไม่แสดง
 * @param person       ชื่อผู้รับผิดชอบ · personSrc รูป · personSub บรรทัดเล็กใต้ชื่อ
 * @param alert        ข้อความเตือนสั้น (ค้าง/เลยกำหนด) สีแดง
 * @param right        ปุ่มมุมขวาบน (เช่น ⋮) — ต้อง stopPropagation เอง
 * @param onToggle     กดการ์ด = กางรายละเอียด
 */
export default function MobileJobSummary({ event, statusLabel, statusColor, next, person, personSrc, personSub, alert, right, actions, onToggle }) {
  const kind = classifyJob(event) || "general";
  const meta = event?.noVisit ? { label: "งานส่งของ", color: "#0891b2" } : (getJobClassMeta(kind) || getJobClassMeta("general"));
  const round = event?.time ? formatRoundLabel(event.time, event.visitCount, event) : "";
  const place = [event.company, event.site].filter((x) => x && x !== "-").filter((x, i, a) => a.indexOf(x) === i).join(" · ");
  return (
    <Box onClick={onToggle} role="button" aria-expanded={false} sx={{ cursor: "pointer" }}>
      <Stack direction="row" gap={1.5} alignItems="flex-start">
        <EventDateTile event={event} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" sx={{ flexWrap: "wrap", columnGap: 0.6, mb: 0.3 }}>
            <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: meta.color, flexShrink: 0 }} />
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: "#475569", whiteSpace: "nowrap" }}>{meta.label}{round ? ` · ครั้งที่ ${round}` : ""}</Typography>
            {event.jobNo && <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8", whiteSpace: "nowrap" }}>· {event.jobNo}</Typography>}
          </Stack>
          <Typography sx={{ fontWeight: 800, fontSize: "1rem", color: INK, lineHeight: 1.3, overflowWrap: "anywhere" }}>
            {event.title || "งาน"}{event.system ? ` · ${event.system}` : ""}
          </Typography>
          {place && <Typography noWrap sx={{ fontSize: "0.84rem", fontWeight: 600, color: "#475569" }}>{place}</Typography>}
          {alert && <Typography sx={{ mt: 0.3, fontSize: "0.74rem", fontWeight: 800, color: "#dc2626" }}>{alert}</Typography>}
        </Box>
        {right}
      </Stack>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 1.1, pt: 1.1, borderTop: `1px dashed ${LINE}`, minWidth: 0 }}>
        {person ? (
          <Stack direction="row" alignItems="center" gap={0.9} sx={{ flex: 1, minWidth: 0 }}>
            <PersonPic name={person} src={personSrc} size={30} />
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: "0.8rem", fontWeight: 800, color: INK, lineHeight: 1.25 }}>{person}</Typography>
              {personSub && <Typography noWrap sx={{ fontSize: "0.68rem", color: MUTED, lineHeight: 1.25 }}>{personSub}</Typography>}
            </Box>
          </Stack>
        ) : (
          <Typography sx={{ flex: 1, fontSize: "0.78rem", fontWeight: 700, color: "#b45309" }}>ยังไม่มอบหมายผู้รับผิดชอบ</Typography>
        )}
        {statusLabel && <StatusPill label={statusLabel} color={statusColor} />}
      </Stack>
      {/* ✅ (20 ต.ค. 2569 ผู้ใช้: "ปุ่มดำเนินการ เช่น รับทราบ บันทึกงาน ต้องอยู่หน้าแรก ให้ดูและใช้ง่าย")
          actions = แถวปุ่ม/สถานะขั้นตอน (รับทราบ · ยืนยันนัด · บันทึกเข้างาน) กดได้เลยโดยไม่ต้องเปิดการ์ด */}
      {actions && <Box onClick={(e) => e.stopPropagation()} sx={{ mt: 1, cursor: "default" }}>{actions}</Box>}
      <Stack direction="row" alignItems="center" gap={0.75} sx={{ mt: 1, mx: -0.25, px: 1, py: 0.7, borderRadius: 2, bgcolor: SURFACE }}>
        {!actions && <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: next?.tone || "#94a3b8", flexShrink: 0 }} />}
        <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.78rem", fontWeight: 700, color: next && !actions ? "#334155" : MUTED }}>
          {actions ? "ดูรายละเอียด · เอกสาร · ขอปิดงาน" : next?.title || "ดูรายละเอียดงาน"}
        </Typography>
        <ExpandMoreRounded sx={{ fontSize: 20, color: MUTED, flexShrink: 0, transform: "rotate(-90deg)" }} />
      </Stack>
    </Box>
  );
}
