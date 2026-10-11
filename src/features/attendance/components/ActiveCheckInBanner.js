/**
 * ลิงก์ "ประวัติเข้างาน" บนหน้า "งานของฉัน" (10 ต.ค. 2569)
 * 🧹 11 ต.ค. 2569 ตัดเช็คเอาต์ออก — ไม่มีสถานะ "กำลังทำงานค้างอยู่" แล้ว เหลือแค่ลิงก์ไปหน้าประวัติ
 */
import { Link } from "react-router-dom";
import { Stack, Button } from "@mui/material";
import { HistoryRounded } from "@mui/icons-material";
import { MUTED } from "@/shared/ui/PageKit";

export default function ActiveCheckInBanner({ sx }) {
  return (
    <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1, ...sx }}>
      <Button component={Link} to="/attendance" size="small" startIcon={<HistoryRounded />} sx={{ fontWeight: 800, color: MUTED }}>
        ประวัติเข้างาน
      </Button>
    </Stack>
  );
}
