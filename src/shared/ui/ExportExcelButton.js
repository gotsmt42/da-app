/**
 * ExportExcelButton — ปุ่ม "ส่งออก Excel" ชุดเดียวทั้งแอป
 *
 * ✅ (4 พ.ย. 2569 ผู้ใช้: "export excel รูปแบบคำที่ใช้ icon ให้เหมือนกันทั้งหมดด้วย ตอนนี้มั่วมาก ไม่เหมือนกันเลย ทำให้มืออาชีพ")
 *    เดิมแต่ละหน้าเขียนเอง: "Excel" / "Export Excel" / "ส่งออก Excel" · ไอคอนดาวน์โหลด / ตาราง / ไฟล์ Excel · ปุ่มเขียวทั้งปุ่ม / ขาว
 *    → คำเดียว "ส่งออก Excel" · ไอคอนไฟล์ Excel สีเขียว · ปุ่มขาวขอบเทา (สีเขียวแค่ที่ไอคอน) · กำลังทำ = "กำลังส่งออก…"
 *    มือถือ (compact): ปุ่มไอคอนสี่เหลี่ยม 40px — คำเต็มอยู่ใน tooltip/aria-label
 *
 * @param onClick / disabled / loading
 * @param compact  true = ไอคอนอย่างเดียว · ไม่ส่ง = ไอคอนอย่างเดียวเฉพาะจอ < 600px
 * @param count    จำนวนรายการ (ใส่ใน tooltip เช่น "ส่งออก Excel (35 รายการ)")
 */
import { Button, CircularProgress, Tooltip, useMediaQuery } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileExcel } from "@fortawesome/free-solid-svg-icons";

export const EXCEL_GREEN = "#217346";
export const ExcelIcon = ({ size = 16 }) => <FontAwesomeIcon icon={faFileExcel} style={{ fontSize: size, color: EXCEL_GREEN }} />;
export const EXPORT_EXCEL_LABEL = "ส่งออก Excel";

export default function ExportExcelButton({ onClick, disabled, loading, compact, count, unit = "รายการ", sx }) {
  const narrow = useMediaQuery("(max-width:599.95px)");
  const iconOnly = compact ?? narrow;
  const tip = loading ? "กำลังส่งออก…" : count != null ? `${EXPORT_EXCEL_LABEL} (${count} ${unit})` : EXPORT_EXCEL_LABEL;
  const icon = loading ? <CircularProgress size={15} sx={{ color: EXCEL_GREEN }} /> : <ExcelIcon />;
  return (
    <Tooltip title={tip}>
      <span style={{ display: "inline-flex", flexShrink: 0 }}>
        <Button variant="outlined" onClick={onClick} disabled={disabled || loading} aria-label={EXPORT_EXCEL_LABEL}
          startIcon={iconOnly ? undefined : icon}
          sx={{
            flexShrink: 0, height: 40, borderRadius: 2, textTransform: "none", fontWeight: 700, whiteSpace: "nowrap",
            bgcolor: "#fff", color: "#0f172a", borderColor: "#e6e9ef",
            "&:hover": { borderColor: EXCEL_GREEN, bgcolor: "#f0fdf4" },
            ...(iconOnly ? { minWidth: 40, width: 40, px: 0 } : { px: 1.75 }),
            ...sx,
          }}>
          {iconOnly ? icon : loading ? "กำลังส่งออก…" : EXPORT_EXCEL_LABEL}
        </Button>
      </span>
    </Tooltip>
  );
}
