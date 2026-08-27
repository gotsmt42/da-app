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

export default function ViewToggle({ value, onChange, accent = "#0891b2" }) {
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
 * ค่าเริ่มต้นของมุมมอง — จอกว้างเริ่มที่ตาราง จอแคบเริ่มที่การ์ด
 * ⚠️ อ่าน localStorage ก่อนเสมอ: ตรงนี้กำหนดแค่ "ค่าตั้งต้นตอนยังไม่เคยเลือก" ไม่ใช่บังคับทับ
 */
export const initialViewMode = (storageKey) => {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === "card" || saved === "table") return saved;
  } catch {
    /* โหมดส่วนตัว/ปิด storage — ตกไปใช้ค่าตามขนาดจอ */
  }
  return typeof window !== "undefined" && window.innerWidth >= 900 ? "table" : "card";
};
