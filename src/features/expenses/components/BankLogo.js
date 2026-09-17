/**
 * BankLogo — สัญลักษณ์ธนาคาร (สีประจำธนาคาร + ตัวย่อ)
 *
 * ✅ ผู้ใช้ขอ: "อยากให้แสดงโลโก้หรือสัญลักษณ์ของธนาคารนั้นๆ ด้วย ทำให้ดูง่าย สวยงาม และเด่น
 * เพราะบัญชีจะได้เข้าใจง่าย" — คนไทยจำธนาคารจาก "สี" ก่อนชื่อเสมอ (เขียว = กสิกร · ม่วง = ไทยพาณิชย์
 * · ฟ้า = กรุงไทย) ป้ายสีจึงทำให้กวาดตาหาบัญชีถูกใบได้เร็วกว่าการอ่านชื่อธนาคารทีละบรรทัด
 *
 * ⚠️ ไม่ใช้ไฟล์โลโก้จริงของธนาคาร — เป็นเครื่องหมายการค้าที่นำมาใส่ในระบบเองไม่ได้ และถ้าโหลดจาก
 * อินเทอร์เน็ตก็จะพังเมื่อออฟไลน์/ลิงก์ตาย ตัวย่อ+สีวาดเองจึงชัวร์กว่าและไม่มีวันโหลดไม่ขึ้น
 */
import { Box } from "@mui/material";
import { bankMeta } from "../bankMeta";

/**
 * @param {string} code  รหัสธนาคาร (ดู bankMeta.js)
 * @param {number} size  ความกว้าง/สูงเป็น px
 */
export default function BankLogo({ code, size = 34, sx }) {
  const bank = bankMeta(code);
  // ตัวย่อยาวไม่เท่ากัน (K / ttb / CIMB) — ย่อขนาดอักษรตามความยาวให้เต็มป้ายพอดีทุกธนาคาร
  const chars = bank.mark.length;
  const fontSize = size * (chars <= 1 ? 0.5 : chars === 2 ? 0.4 : chars === 3 ? 0.32 : 0.26);
  return (
    <Box
      aria-hidden
      sx={{
        width: size, height: size, flexShrink: 0, borderRadius: size * 0.29,
        display: "flex", alignItems: "center", justifyContent: "center",
        bgcolor: bank.color,
        // สีอ่อน (กรุงศรี) ตัวขาวอ่านไม่ออก — ใช้ตัวเข้มแทน และมีขอบบางกันจมไปกับพื้นขาว
        color: bank.darkText ? "#1f2937" : "#ffffff",
        border: bank.darkText ? "1px solid rgba(15,23,42,0.12)" : "none",
        fontWeight: 900, fontSize, lineHeight: 1, letterSpacing: chars > 2 ? "-0.02em" : 0,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        boxShadow: "0 1px 3px rgba(15,23,42,0.18)",
        userSelect: "none",
        ...sx,
      }}
    >
      {bank.mark}
    </Box>
  );
}
