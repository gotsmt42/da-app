/**
 * MultiDayGroup — หัวการ์ด "งานหลายช่วงวัน" ชุดเดียวกันทั้งหน้าการดำเนินงานและงานของฉัน
 *
 * ✅ ผู้ใช้สั่ง (3 ต.ค. 2569): "ทำให้มองแล้วรู้ว่างานมีหลายช่วงวัน · สีแดงๆ ดูรก · รูปแบบต้องเหมือนกันกับหน้างานของฉัน"
 *    การ์ดซ้อนเป็นปึก (เงาแผ่นกระดาษด้านล่าง) + ป้ายแดง (สีธีมแอป) "งานหลายช่วงวัน · N ช่วง" + หัวพื้นเทาอ่อน
 *    สีอื่นเหลือแค่แถบสถานะด้านซ้าย — ต่างจากการ์ดงานวันเดียวชัดเจน แต่ไม่ฉูดฉาด
 */
import moment from "moment";
import { Box, Stack, Typography, IconButton } from "@mui/material";
import { DateRange, CalendarMonth, Description, ExpandLess, ExpandMore } from "@mui/icons-material";
import { formatThai } from "@/shared/utils/thaiDate";

/** sx ของกรอบการ์ดกลุ่ม (ใส่ให้ Card/Box ภายนอก) */
export const multiDayCardSx = (statusColor = "#94a3b8") => ({
  mb: 3, borderRadius: 4, bgcolor: "background.paper", overflow: "visible",
  border: "1px solid #e2e8f0", borderLeft: `4px solid ${statusColor}`,
  boxShadow: "0 5px 0 -1px #fff, 0 5px 0 0 #cbd5e1, 0 10px 0 -2px #fff, 0 10px 0 -1px #e2e8f0, 0 1px 3px rgba(15,23,42,.06)",
});

const dayEnd = (s) => moment(s.end || s.start).subtract(s.allDay ? 1 : 0, "days").startOf("day");

/**
 * @param sessions ทุกช่วงของงาน · anchorId = ช่วงที่ถือเอกสาร/ขอปิดงาน · title = ชื่องานบรรทัดหลัก
 */
export default function MultiDayGroupHeader({ sessions, anchorId, title, expanded, onToggle }) {
  const sorted = sessions.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
  const last = sessions.reduce((l, s) => (new Date(s.end || s.start) > new Date(l.end || l.start) ? s : l));
  const rangeStart = moment(sorted[0].start).locale("th").format("DD MMM");
  const rangeEnd = formatThai(moment(last.end || last.start).subtract(last.allDay ? 1 : 0, "days"), "DD MMM YYYY");
  // นับวันเข้างานจริง (รวมทุกวันในแต่ละช่วง)
  const totalWorkDays = sessions.reduce((sum, s) => sum + Math.max(dayEnd(s).diff(moment(s.start).startOf("day"), "days") + 1, 1), 0);
  const anchor = sessions.find((s) => s._id === anchorId) || sessions[0];

  return (
    <Box onClick={onToggle} sx={{ px: 2, py: 1.5, cursor: "pointer", bgcolor: "#f8fafc", borderRadius: "14px 14px 0 0", borderBottom: expanded ? "1px solid #e2e8f0" : "none" }}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, height: 24, pl: 0.75, pr: 1, borderRadius: 999, bgcolor: "#dc2626", color: "#fff", fontSize: "0.72rem", fontWeight: 800, whiteSpace: "nowrap" }}>
          <DateRange sx={{ fontSize: 15 }} /> งานหลายช่วงวัน · {sessions.length} ช่วง
        </Box>
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" sx={{ color: "#94a3b8", mr: -0.75 }} onClick={(e) => { e.stopPropagation(); onToggle?.(); }} aria-label={expanded ? "พับ" : "กาง"}>
          {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
        </IconButton>
      </Stack>
      <Typography sx={{ mt: 0.5, fontWeight: 800, fontSize: "0.95rem", color: "#0f172a", lineHeight: 1.35 }}>{title}</Typography>
      <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{ mt: 0.5 }}>
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", height: 22, px: 1, borderRadius: 999, bgcolor: "#fef2f2", color: "#b91c1c", fontSize: "0.72rem", fontWeight: 800 }}>
          เข้างาน {totalWorkDays} วัน
        </Box>
        <Typography sx={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 0.4 }}>
          <CalendarMonth sx={{ fontSize: 14, color: "#94a3b8" }} />{rangeStart} – {rangeEnd}
        </Typography>
      </Stack>
      <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 1 }}>
        {sorted.map((s) => {
          const a = moment(s.start);
          const b = dayEnd(s);
          const label = a.isSame(b, "day") ? a.locale("th").format("DD MMM") : `${a.locale("th").format("DD")}-${b.locale("th").format("DD MMM")}`;
          const on = s._id === anchorId;
          return (
            <Box key={s._id} component="span" sx={{
              display: "inline-flex", alignItems: "center", height: 22, px: 1, borderRadius: 999, fontSize: "0.72rem",
              fontWeight: on ? 800 : 600, bgcolor: on ? "#fef2f2" : "#fff", color: on ? "#b91c1c" : "#475569",
              border: `1px solid ${on ? "#fecaca" : "#cbd5e1"}`,
            }}>{label}</Box>
          );
        })}
      </Stack>
      <Typography sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.75, fontSize: "0.72rem", color: "#94a3b8" }}>
        <Description sx={{ fontSize: 13 }} />
        เอกสาร/ขอปิดงาน อยู่ที่ช่วงวันที่ {moment(anchor.start).locale("th").format("DD MMM")} (วันล่าสุด)
      </Typography>
    </Box>
  );
}
