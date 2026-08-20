import { Stack, Typography } from "@mui/material";

/**
 * InfoLine.js — บรรทัดข้อมูล "ไอคอน + ป้ายกำกับ + ค่า" ของการ์ดงานในหน้าการดำเนินงาน
 *
 * ⚠️ แยกออกมาเป็นไฟล์ของตัวเองเพื่อให้ "การ์ดงาน" (Operation/index.js) กับ "การ์ดรออนุมัติ/ไม่อนุมัติ"
 * (PendingApprovalsPanel.js) ใช้คอมโพเนนต์ตัวเดียวกันจริงๆ — ข้อมูลชุดเดียวกัน (ระบบ/โครงการ/ครั้งที่/
 * ทีม) จะได้แสดงหน้าตาเหมือนกันเป๊ะทุกที่ ไม่ต้องไล่ก็อปสไตล์ตามกันทีละจุดแล้วหลุดไม่ตรงกันภายหลัง
 * ⚠️ ห้าม import จาก Operation/index.js โดยตรง — index.js เป็นตัว import PendingApprovalsPanel อยู่แล้ว
 * จะกลายเป็น circular import ทันที จึงต้องอยู่ไฟล์กลางแบบนี้
 *
 * ✅ ป้ายกำกับจางลง + ล็อกความกว้างคงที่ (ค่าของทุกบรรทัดเรียงตรงกันเป็นคอลัมน์เดียว กวาดตาอ่านลงมาได้)
 * ✅ ค่าจริงเข้มและหนากว่า ให้เป็นสิ่งที่ตาเห็นก่อน — เดิมป้ายกำกับกับค่าเป็นสีเทาเดียวกันทั้งคู่ พอมี
 * หลายบรรทัดเรียงกันจึงกลายเป็นเทาพร่าๆ ก้อนเดียว ตาไม่รู้จะเกาะตรงไหน
 */
const InfoLine = ({ icon, label, children }) => (
  <Stack direction="row" spacing={0.75} sx={{ alignItems: "flex-start" }}>
    <Typography
      variant="caption"
      sx={{ flexShrink: 0, whiteSpace: "nowrap", color: "text.disabled", minWidth: 62 }}
    >
      {icon} {label}
    </Typography>
    <Typography
      variant="caption"
      sx={{ minWidth: 0, color: "text.primary", fontWeight: 500, lineHeight: 1.5 }}
    >
      {children}
    </Typography>
  </Stack>
);

export default InfoLine;
