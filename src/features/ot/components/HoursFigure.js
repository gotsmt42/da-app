/**
 * HoursFigure — ชั่วโมง OT ตัวใหญ่: ตัวเลขหนา + หน่วยเล็กสีเทา ("54 ชม. 30 น.")
 *
 * 🐛 (28 พ.ย. 2569 ผู้ใช้: "หน้าตา และการแสดงเวลารวมดูแปลกๆ มองยาก")
 *    เดิมตัด " ชม." ออกจากข้อความแล้วต่อหน่วยท้าย → 54.5 ชม. ขึ้นเป็น "54 30 น. ชม." อ่านไม่ออก
 *    ตอนนี้ตัวเลขกับหน่วยแยกกันทุกส่วน: 54 ชม. 30 น. · 8 ชม. · 45 น.
 */
import { Box } from "@mui/material";
import { hoursParts, TEXT_MAIN, TEXT_SUB } from "../otMeta";

const Unit = ({ children }) => (
  // หน่วยเล็กกว่าตัวเลขแต่ไม่เล็กจนอ่านไม่ออก (ตัวเลขขนาดเล็กในตาราง/รายการ ยังอ่าน "ชม./น." ได้ชัด)
  <Box component="span" sx={{ fontSize: "max(0.58em, 0.72rem)", fontWeight: 700, color: TEXT_SUB, ml: "0.2em", mr: "0.35em", "&:last-of-type": { mr: 0 } }}>{children}</Box>
);

export default function HoursFigure({ hours, size = "1.45rem", color = TEXT_MAIN, muted = false, sx }) {
  const { hh, mm } = hoursParts(hours);
  const tone = muted ? "#94a3b8" : color;
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "baseline", whiteSpace: "nowrap", fontSize: size, fontWeight: 900, lineHeight: 1.2, color: tone, fontVariantNumeric: "tabular-nums", ...sx }}>
      {(hh > 0 || !mm) && <>{hh}<Unit>ชม.</Unit></>}
      {mm > 0 && <>{mm}<Unit>น.</Unit></>}
    </Box>
  );
}
