/**
 * ExportPdfButton — ปุ่ม "พิมพ์ / ส่งออก PDF" ชุดเดียวทั้งแอป (คู่กับ ExportExcelButton)
 *
 * ✅ (11 พ.ย. 2569 ผู้ใช้: "ปุ่ม PDF เป็นแดงแทนฟ้า และให้รูปแบบการแสดง icon เหมือนกันทุกหน้า")
 *    รูปแบบเดียวกับปุ่ม Excel ทุกอย่าง: ปุ่มขาวขอบเทา สูง 40 · สีแค่ที่ไอคอน (ไฟล์ PDF สีแดง) · hover ขอบแดงพื้นแดงอ่อน
 *    มือถือ (compact): ปุ่มไอคอนสี่เหลี่ยม 40px — คำเต็มอยู่ใน tooltip/aria-label
 *
 * @param label    ข้อความบนปุ่ม (ค่าเริ่มต้น "พิมพ์ PDF")
 * @param count    จำนวนใบ (ต่อท้ายข้อความ เช่น "พิมพ์ PDF ทั้งหมด (4)")
 * @param compact  true = ไอคอนอย่างเดียว · ไม่ส่ง = ไอคอนอย่างเดียวเฉพาะจอ < 600px
 */
import { Button, CircularProgress, Tooltip, useMediaQuery } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFilePdf } from "@fortawesome/free-solid-svg-icons";

export const PDF_RED = "#dc2626";
export const PdfIcon = ({ size = 16 }) => <FontAwesomeIcon icon={faFilePdf} style={{ fontSize: size, color: PDF_RED }} />;

export default function ExportPdfButton({ onClick, disabled, loading, compact, label = "พิมพ์ PDF", count, sx }) {
  const narrow = useMediaQuery("(max-width:599.95px)");
  const iconOnly = compact ?? narrow;
  const text = count != null ? `${label} (${count})` : label;
  const icon = loading ? <CircularProgress size={15} sx={{ color: PDF_RED }} /> : <PdfIcon />;
  return (
    <Tooltip title={loading ? "กำลังเตรียม PDF…" : text}>
      <span style={{ display: "inline-flex", flexShrink: 0 }}>
        <Button variant="outlined" onClick={onClick} disabled={disabled || loading} aria-label={text}
          startIcon={iconOnly ? undefined : icon}
          sx={{
            flexShrink: 0, height: 40, borderRadius: 2, textTransform: "none", fontWeight: 700, whiteSpace: "nowrap",
            bgcolor: "#fff", color: "#0f172a", borderColor: "#e6e9ef",
            "&:hover": { borderColor: PDF_RED, bgcolor: "#fef2f2" },
            ...(iconOnly ? { minWidth: 40, width: 40, px: 0 } : { px: 1.75 }),
            ...sx,
          }}>
          {iconOnly ? icon : text}
        </Button>
      </span>
    </Tooltip>
  );
}
