/**
 * DateCell — ช่องวันที่คอลัมน์แรกของตาราง (การดำเนินงาน · งานของฉัน · งานเข้า)
 * ✅ (19 ต.ค. 2569 ผู้ใช้: "เอาช่องวันที่ไปไว้หน้าสุด และทำให้ชัดเจน สวยงาม")
 *    กล่องวันที่แบบปฏิทิน: วัน (ตัวใหญ่) · เดือน ปี · วันในสัปดาห์ — กวาดตาลงมาเห็นลำดับเวลาทันที
 *    วันนี้ = กล่องน้ำเงิน · ผ่านไปแล้ว = เทา · ล่วงหน้า = ขาวขอบเทา
 */
import { Box, Typography } from "@mui/material";
import moment from "moment";
import { formatThai } from "@/shared/utils/thaiDate";

const BLUE = "#2563eb";

/**
 * @param start  วันเริ่ม
 * @param end    วันสิ้นสุด (ถ้ามี)
 * @param allDay งานทั้งวัน (end เป็นวันถัดไป 00:00 แบบปฏิทิน)
 * @param label  ข้อความแทนวันที่ (เช่น "แผน ต.ค. 69" ของงานที่ยังไม่ลงวัน) — แสดงเป็นกล่องเส้นประ
 * @param children ข้อมูลเสริมใต้กล่อง (ค้างงาน · อีก N ช่วงวัน)
 */
export default function DateCell({ start, end, allDay, label, children }) {
  if (!start) {
    return (
      <Box>
        <Box sx={{ display: "inline-flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 64, px: 1, py: 0.75, borderRadius: 2,
          border: "1px dashed #cbd5e1", bgcolor: "#fff", color: "#64748b" }}>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, textAlign: "center", lineHeight: 1.3 }}>{label || "ยังไม่กำหนด"}</Typography>
        </Box>
        {children}
      </Box>
    );
  }
  const s = moment(start);
  let e = end ? moment(end) : s.clone();
  if (allDay && end && e.isAfter(s)) e = e.subtract(1, "day");
  const multi = !e.isSame(s, "day");
  const sameMonth = e.isSame(s, "month");
  const today = moment().startOf("day");
  const isToday = !today.isBefore(s.clone().startOf("day")) && !today.isAfter(e.clone().startOf("day"));
  const past = today.isAfter(e.clone().startOf("day"));
  const day = !multi ? s.format("D") : sameMonth ? `${s.format("D")}–${e.format("D")}` : `${s.format("D")}–${e.format("D")}`;
  const month = !multi || sameMonth ? formatThai(s, "MMM YY") : `${formatThai(s, "MMM")}–${formatThai(e, "MMM YY")}`;
  const sub = !multi ? formatThai(s, "dddd") : `${e.diff(s.clone().startOf("day"), "days") + 1} วัน`;
  const tone = isToday ? { bg: BLUE, fg: "#fff", sub: "rgba(255,255,255,.85)", bd: BLUE } : past
    ? { bg: "#f1f5f9", fg: "#475569", sub: "#94a3b8", bd: "#e2e8f0" }
    : { bg: "#fff", fg: "#0f172a", sub: "#64748b", bd: "#e2e8f0" };
  return (
    <Box>
      <Box title={isToday ? "วันนี้" : undefined}
        sx={{ display: "inline-flex", flexDirection: "column", alignItems: "center", minWidth: 64, px: 1, py: 0.6, borderRadius: 2,
          bgcolor: tone.bg, border: `1px solid ${tone.bd}`, boxShadow: isToday ? "0 4px 10px -4px rgba(37,99,235,.5)" : "none" }}>
        <Typography sx={{ fontSize: multi ? "1.02rem" : "1.25rem", fontWeight: 900, lineHeight: 1.1, color: tone.fg, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{day}</Typography>
        <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, lineHeight: 1.3, color: tone.fg, whiteSpace: "nowrap" }}>{month}</Typography>
        <Typography sx={{ fontSize: "0.64rem", fontWeight: 600, lineHeight: 1.2, color: tone.sub, whiteSpace: "nowrap" }}>{isToday ? "วันนี้" : sub}</Typography>
      </Box>
      {children}
    </Box>
  );
}
