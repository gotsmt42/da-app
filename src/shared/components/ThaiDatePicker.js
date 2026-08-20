import { Suspense, lazy } from "react";
import { TextField } from "@mui/material";
import { CalendarToday } from "@mui/icons-material";
import { InputAdornment } from "@mui/material";
import { THAI_DATE_PLACEHOLDER, thaiDateNumeric } from "../utils/thaiDate";

/**
 * ThaiDatePicker.js — ตัวห่อบางๆ ที่โหลด "ตัวปฏิทินจริง" แบบ lazy
 *
 * ⚠️ ทำไมต้องแยกไฟล์: @mui/x-date-pickers (DatePicker + CalendarPicker + LocalizationProvider +
 * adapter) เป็นโค้ดก้อนใหญ่ — วัดจากผลบิลด์จริงแล้ว **โตขึ้น 64 kB (gzip +21 kB)** และเพราะมี 11 ไฟล์
 * ที่ import ตัวนี้ (หน้าภาพรวมงาน/เอกสาร/สินค้า/ฟอร์มปฏิทิน ฯลฯ) Rollup จึงยกมันไปไว้ใน chunk กลาง
 * ที่ "ทุกหน้าต้องโหลด" แม้แต่หน้า login ที่ไม่มีช่องวันที่สักช่อง
 *
 * ✅ ผู้ใช้แทบไม่เคยเปิดปฏิทินทันทีที่หน้าโหลดเสร็จ — ในหน้าภาพรวมงานช่องวันที่โผล่เฉพาะตอนกดแก้ไข
 * เซลล์หรือเปิดกล่องเท่านั้น การเลื่อนโหลดออกไปจึงคืนเวลาให้ "ตอนเปิดหน้า" โดยไม่กระทบการใช้งาน
 *
 * ⚠️ ระหว่างที่ยังโหลดไม่เสร็จต้องแสดงช่องหน้าตาเหมือนกันเป๊ะ (ขนาด/กรอบ/ค่าที่อ่านได้) ไม่งั้นเลย์เอาต์
 * จะกระตุกตอนสลับ — ดู FallbackField ด้านล่างที่แสดงค่าเป็น พ.ศ. ได้เองโดยไม่ต้องใช้โค้ดปฏิทินเลย
 */
const Inner = lazy(() => import("./ThaiDatePickerInner"));

/**
 * ช่องหน้าตาเหมือนของจริงระหว่างรอโหลด — อ่านค่าได้ทันที แต่ยังกดเปิดปฏิทินไม่ได้เสี้ยววินาทีแรก
 * ⚠️ ต้องเป็น readOnly ไม่ใช่ disabled — disabled จะเป็นสีเทาจางแล้วดูเหมือนช่องที่แก้ไม่ได้
 */
const FallbackField = ({ label, value, size, fullWidth, variant, error, helperText, textFieldProps = {} }) => (
  <TextField
    label={label}
    value={value ? thaiDateNumeric(value, "") : ""}
    placeholder={THAI_DATE_PLACEHOLDER}
    size={size}
    fullWidth={fullWidth}
    variant={variant}
    error={error}
    helperText={helperText}
    InputProps={{
      readOnly: true,
      endAdornment: (
        <InputAdornment position="end">
          <CalendarToday sx={{ fontSize: 20, color: "action.active", mr: 0.5 }} />
        </InputAdornment>
      ),
    }}
    {...textFieldProps}
  />
);

export default function ThaiDatePicker(props) {
  const { label, value, size = "small", fullWidth = true, variant, error, helperText, textFieldProps } = props;
  return (
    <Suspense
      fallback={
        <FallbackField
          label={label} value={value} size={size} fullWidth={fullWidth}
          variant={variant} error={error} helperText={helperText} textFieldProps={textFieldProps}
        />
      }
    >
      <Inner {...props} />
    </Suspense>
  );
}
