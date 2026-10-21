/**
 * ViewToggle — ปุ่มสลับ "การ์ด / ตาราง" ที่ใช้ร่วมกันทุกหน้าที่มีสองมุมมอง
 *
 * ✅ ทำไมต้องมีสองมุมมอง: การ์ดออกแบบมาสำหรับจอแคบ (ข้อมูลเรียงลงมา อ่านทีละใบ) ส่วนตารางคือ
 * รูปแบบมาตรฐานของหน้าจัดการงานบนเว็บ — คอลัมน์ตรงกันทุกแถว กวาดสายตาลงมาเทียบกันได้ และเห็น
 * รายการได้มากกว่าต่อหนึ่งหน้าจอ (บทเรียนเดียวกับที่หน้า "การดำเนินงาน" เจอมาแล้ว)
 *
 * ⚠️ จำค่าที่ผู้ใช้เลือกไว้ข้ามการเปิดหน้า — แต่ละคนถนัดคนละแบบและมักใช้แบบเดิมตลอด
 */
import { ToggleButton, ToggleButtonGroup, Tooltip } from "@mui/material";
import { ViewAgenda, TableRows } from "@mui/icons-material";

// ✅ กฎออกแบบ (สีไม่เยอะ): ปุ่มที่เลือกอยู่เป็นเทาเข้มเหมือนกันทุกหน้า — ไม่รับสีประจำหน้าแล้ว (เดิมส้ม/ฟ้าคนละหน้า)
export default function ViewToggle({ value, onChange, accent: _accent }) {
  const accent = "#2563eb";
  return (
    <ToggleButtonGroup
      exclusive size="small" value={value}
      onChange={(_, v) => v && onChange(v)}
      sx={{
        flexShrink: 0,
        "& .MuiToggleButton-root": { px: 1.1, py: 0.4, border: "1px solid", borderColor: "divider" },
        "& .Mui-selected": {
          bgcolor: `${accent} !important`, color: "#fff !important",
          "&:hover": { bgcolor: `${accent} !important` },
        },
      }}
    >
      <ToggleButton value="card">
        <Tooltip title="มุมมองการ์ด"><ViewAgenda sx={{ fontSize: 17 }} /></Tooltip>
      </ToggleButton>
      <ToggleButton value="table">
        <Tooltip title="มุมมองตาราง"><TableRows sx={{ fontSize: 17 }} /></Tooltip>
      </ToggleButton>
    </ToggleButtonGroup>
  );
}

/**
 * ค่าเริ่มต้นของมุมมอง
 * 🔁 (21 ต.ค. 2569 ผู้ใช้: "หน้าจอคอมให้ default เป็นรูปแบบตารางเสมอ")
 *    จอคอม (กว้าง ≥ 900) = เปิดหน้ามาเป็นตารางเสมอ (สลับเป็นการ์ดได้ระหว่างใช้ แต่เปิดใหม่กลับเป็นตาราง)
 *    จอแคบ = ค่าที่เลือกไว้ล่าสุด หรือการ์ด
 */
export const initialViewMode = (storageKey) => {
  if (typeof window !== "undefined" && window.innerWidth >= 900) return "table";
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === "card" || saved === "table") return saved;
  } catch {
    /* โหมดส่วนตัว/ปิด storage — ตกไปใช้ค่าตามขนาดจอ */
  }
  return typeof window !== "undefined" && window.innerWidth >= 900 ? "table" : "card";
};
