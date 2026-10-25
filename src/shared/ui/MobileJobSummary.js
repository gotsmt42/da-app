/**
 * MobileJobSummary — หัวการ์ดงานแบบย่อบนมือถือ (ใช้ร่วม: รับงาน · การดำเนินงาน · งานของฉัน)
 *
 * ✅ (20 ต.ค. 2569 ผู้ใช้: "แก้หน้าการดำเนินงาน และงานของฉัน ให้เป็นรูปแบบอย่างงี้ — หน้าแรกข้อมูลไม่เยอะแต่สำคัญ
 *    ไม่รก ไม่กินพื้นที่ สวยงาม") ตอนพับเห็นแค่: ไอคอนปฏิทิน · ประเภทงาน/เลขที่งาน · ชื่องาน · โครงการ ·
 *    รูปผู้รับผิดชอบ + สถานะ · ขั้นถัดไปบรรทัดเดียว — กดที่การ์ดเพื่อกางดูรายละเอียดเต็ม
 */
import { Avatar, Box, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ExpandMoreRounded, CheckRounded } from "@mui/icons-material";
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
  if (event.allDay && event.end && e.isAfter(s)) e = e.subtract(1, "day"); // กติกาเดียวกับทั้งแอป (allDay = end เป็นวันถัดไป)
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
/**
 * ✅ (20 ต.ค. 2569 ผู้ใช้: "สถานะที่บอก รับทราบแล้ว ยืนยันแล้ว ในหน้าแรก ให้สวยงาม ชัดเจน")
 *    แถบขั้นตอนแบบชิป: ขั้นที่ผ่านแล้ว = เขียว ✓ · ขั้นปัจจุบัน = น้ำเงิน · ขั้นที่เหลือ = เทาจาง (ไม่ใส่คำยาว)
 */
const STEP_LABELS = ["รับทราบ", "ยืนยันนัด", "เข้างาน", "เอกสาร", "ขอปิดงาน"];
export function StepChips({ step }) {
  if (step === null || step === undefined) return null;
  const doneAll = step > STEP_LABELS.length; // jobStepOf: 6 = ปิดงานแล้ว
  return (
    // แถวเดียว 5 ช่องเท่ากัน (ไม่ขึ้นบรรทัดใหม่) — ✓ = ผ่านแล้ว
    <Box sx={{ mt: 0.9, display: "grid", gridTemplateColumns: doneAll ? "1fr" : `repeat(${STEP_LABELS.length}, minmax(0,1fr))`, gap: 0.4 }}>
      {doneAll ? (
        <Box component="span" sx={{ height: 24, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 0.35, borderRadius: 99, fontSize: "0.72rem", fontWeight: 800, color: "#15803d", bgcolor: "#dcfce7" }}>
          <CheckRounded sx={{ fontSize: 15 }} /> เสร็จสิ้นทุกขั้นตอน
        </Box>
      ) : STEP_LABELS.map((l, i) => {
        const done = i < step;
        const cur = i === step;
        return (
          <Box key={l} component="span" sx={{
            minWidth: 0, height: 24, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 0.2, borderRadius: 99, fontSize: "0.64rem", whiteSpace: "nowrap", overflow: "hidden",
            fontWeight: done || cur ? 800 : 600,
            color: done ? "#15803d" : cur ? "#fff" : "#94a3b8",
            bgcolor: done ? "#dcfce7" : cur ? ACCENT : "#f1f5f9",
          }}>
            {done && <CheckRounded sx={{ fontSize: 12, flexShrink: 0 }} />}
            {l}
          </Box>
        );
      })}
    </Box>
  );
}

export default function MobileJobSummary({ event, statusLabel, statusColor, next, person, personSrc, personSub, alert, right, actions, onToggle, step, inGroup = false }) {
  const kind = classifyJob(event) || "general";
  const meta = event?.noVisit ? { label: "งานส่งของ", color: "#0891b2" } : (getJobClassMeta(kind) || getJobClassMeta("general"));
  const round = event?.time ? formatRoundLabel(event.time, event.visitCount, event) : "";
  // 🔁 (25 ต.ค. 2569 ผู้ใช้: "การ์ดหน้าแรกเอาชื่อโครงการมาแสดง") ชื่อบริษัทยาวดันชื่อโครงการตกขอบเป็น "…"
  //    → แสดงชื่อโครงการอย่างเดียว (ไม่มีโครงการ = ชื่อบริษัท) · ชื่อบริษัทยังดูได้ในรายละเอียดงาน
  const place = [event.site, event.company].find((x) => x && x !== "-") || "";
  // ✅ (20 ต.ค. 2569 ผู้ใช้: "งานหลายช่วงวันทำให้แยกง่าย ไม่สับสนกับงานเดี่ยวๆ กันพลาด")
  //    ช่วงหนึ่งในงานหลายช่วง (inGroup) — ไม่ซ้ำชื่องาน/โครงการ (อยู่หัวกลุ่มแล้ว) · เหลือ ปฏิทิน + คนเข้างาน + สถานะ ในแถวเดียว
  //    หน้าตาจึงต่างจากการ์ดงานเดี่ยวชัดเจน
  if (inGroup) {
    return (
      <Box onClick={onToggle} role="button" aria-expanded={false} sx={{ cursor: "pointer" }}>
        <Stack direction="row" gap={1.25} alignItems="center">
          <EventDateTile event={event} />
          {person ? (
            <Stack direction="row" alignItems="center" gap={0.8} sx={{ flex: 1, minWidth: 0 }}>
              <PersonPic name={person} src={personSrc} size={28} />
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: "0.8rem", fontWeight: 800, color: INK, lineHeight: 1.25 }}>{person}</Typography>
                {personSub && <Typography noWrap sx={{ fontSize: "0.68rem", color: MUTED, lineHeight: 1.25 }}>{personSub}</Typography>}
              </Box>
            </Stack>
          ) : <Typography sx={{ flex: 1, fontSize: "0.76rem", fontWeight: 700, color: "#b45309" }}>ยังไม่มอบหมาย</Typography>}
          {statusLabel && <StatusPill label={statusLabel} color={statusColor} />}
          {right}
          <ExpandMoreRounded sx={{ fontSize: 20, color: "#94a3b8", flexShrink: 0, transform: "rotate(-90deg)", mr: -0.5 }} />
        </Stack>
        <StepChips step={step} />
        {actions && <Box onClick={(e) => e.stopPropagation()} sx={{ mt: 0.9, cursor: "default" }}>{actions}</Box>}
      </Box>
    );
  }
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
        {/* 🔁 (20 ต.ค. 2569 ผู้ใช้: "ยังกินพื้นที่ ยาวไป") ตัดแถบ "ดูรายละเอียด" ล่างสุด — ลูกศรท้ายแถวบอกว่ากดการ์ดเปิดรายละเอียดได้ */}
        <ExpandMoreRounded sx={{ fontSize: 20, color: "#94a3b8", flexShrink: 0, transform: "rotate(-90deg)", mr: -0.5 }} />
      </Stack>
      {/* ✅ (20 ต.ค. 2569 ผู้ใช้: "ปุ่มดำเนินการ เช่น รับทราบ บันทึกงาน ต้องอยู่หน้าแรก ให้ดูและใช้ง่าย")
          actions = ปุ่ม/สถานะขั้นตอนบรรทัดเดียว (รับทราบ · ยืนยันนัด · บันทึกเข้างาน) กดได้เลยโดยไม่ต้องเปิดการ์ด
          ไม่มี actions = บรรทัดขั้นถัดไป */}
      <StepChips step={step} />
      {actions ? <Box onClick={(e) => e.stopPropagation()} sx={{ mt: 0.9, cursor: "default" }}>{actions}</Box>
        : next && (
          <Stack direction="row" alignItems="center" gap={0.75} sx={{ mt: 0.9, px: 1, py: 0.6, borderRadius: 2, bgcolor: SURFACE }}>
            <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: next.tone || "#94a3b8", flexShrink: 0 }} />
            <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.78rem", fontWeight: 700, color: "#334155" }}>{next.title}</Typography>
          </Stack>
        )}
    </Box>
  );
}
