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
// 🔁 (21 ต.ค. 2569 ผู้ใช้: "วันที่ยังดูไม่สวย ไม่ลงตัว ในหน้าคอม") — แบบปฏิทินชุดเดียวกับการ์ดมือถือ (DateTile):
//    แถบบน = เดือน ปี · กลาง = วัน (ตัวใหญ่) · ล่าง = วันในสัปดาห์ / จำนวนวัน · กว้างเท่ากันทุกแถว (คอลัมน์ตรงกัน)
//    วันนี้ = แถบบนน้ำเงิน · ยังไม่ลงวัน = กล่องเส้นประขนาดเดียวกัน
const W = 66; // 🔁 (21 ต.ค. 2569 ผู้ใช้: "ใหญ่ไป" → "เล็กไป ดูยาก") ขนาดกลาง
const Tile = ({ head, big, foot, headBg = "#475569", headFg = "#fff", bigColor = "#0f172a", footColor = "#64748b", dashed = false, bigSize = "1.2rem", title }) => (
  <Box title={title} sx={{ width: W, borderRadius: 1.75, overflow: "hidden", textAlign: "center", bgcolor: "#fff",
    border: `1px ${dashed ? "dashed" : "solid"} ${dashed ? "#cbd5e1" : "#d5dce5"}` }}>
    <Box sx={{ py: 0.15, bgcolor: headBg, color: headFg, fontSize: "0.64rem", fontWeight: 800, lineHeight: 1.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", px: 0.5 }}>{head}</Box>
    <Typography sx={{ fontSize: bigSize, fontWeight: 900, lineHeight: 1.15, pt: 0.2, color: bigColor, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>{big}</Typography>
    <Typography sx={{ fontSize: "0.62rem", fontWeight: 700, lineHeight: 1.3, pb: 0.35, px: 0.4, color: footColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{foot}</Typography>
  </Box>
);

export default function DateCell({ start, end, allDay, label, children }) {
  if (!start) {
    // label เช่น "แผน ต.ค. 69" / "บันทึก 15 ต.ค." / "ส่งของ 3 พ.ย. 69" / "ยังไม่กำหนดเดือน" → แถบบน = คำนำ · กลาง = วัน/เดือน · ล่าง = ที่เหลือ
    const txt = String(label || "ยังไม่กำหนด").trim();
    const withDay = txt.match(/^(\S+)\s+(\d{1,2})\s+(.+)$/);
    const monthOnly = !withDay && txt.match(/^(\S+)\s+(.+)$/);
    const dashed = { dashed: true, headBg: "#f1f5f9", headFg: "#475569" };
    return (
      <Box>
        {withDay
          ? <Tile {...dashed} head={withDay[1]} big={withDay[2]} foot={withDay[3]} bigColor="#334155" footColor="#64748b" />
          : monthOnly
            ? <Tile {...dashed} head={monthOnly[1]} big={monthOnly[2]} bigSize="0.88rem" foot="ยังไม่ลงวัน" bigColor="#334155" footColor="#94a3b8" />
            : <Tile {...dashed} head={/เดือน/.test(txt) ? "แผน" : "วันเข้างาน"} big="—" foot="ยังไม่กำหนด" bigColor="#94a3b8" footColor="#94a3b8" />}
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
  const big = !multi ? s.format("D") : `${s.format("D")}–${e.format("D")}`;
  const head = !multi || sameMonth ? formatThai(s, "MMM YY") : `${formatThai(s, "MMM")}–${formatThai(e, "MMM")}`;
  const days = e.clone().startOf("day").diff(s.clone().startOf("day"), "days") + 1;
  const foot = isToday ? "วันนี้" : !multi ? formatThai(s, "dddd") : `${days} วัน`;
  return (
    <Box>
      <Tile title={isToday ? "วันนี้" : undefined} head={head} big={big} foot={foot}
        bigSize={!multi ? "1.2rem" : big.length > 4 ? "0.92rem" : "1.02rem"}
        headBg={isToday ? BLUE : "#475569"} footColor={isToday ? BLUE : "#64748b"} />
      {children}
    </Box>
  );
}
