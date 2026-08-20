import { useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import { TextField } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterMoment } from "@mui/x-date-pickers/AdapterMoment";
import {
  THAI_DATE_FORMAT,
  THAI_DATE_PLACEHOLDER,
  toThaiPattern,
  toBEYear,
  toCEYear,
} from "../utils/thaiDate";

/**
 * ThaiDatePicker.js — ช่องเลือกวันที่ของทั้งแอป: ปฏิทิน พ.ศ. + เดือนภาษาไทย
 *
 * 🐛 ที่ต้องเลิกใช้ <input type="date">: รูปแบบที่มันแสดงถูกกำหนดโดย locale ของ "เครื่องผู้ใช้"
 * ล้วนๆ แอปสั่งไม่ได้เลย (ไม่มี attribute หรือ CSS ใดๆ ที่เปลี่ยนได้) เครื่องที่ตั้งเป็น en-US จึงเห็น
 * 08/19/2026 = เดือน/วัน/ปี ซึ่งอ่านสลับกับที่คนไทยคุ้น อันตรายมากกับเอกสารการเงินและวันครบกำหนด
 * เพราะวันที่อย่าง 08/09 อ่านได้ 2 แบบโดยไม่มีอะไรบอกว่าอันไหนถูก — และมันแสดง ค.ศ. เสมอ
 * บังคับให้เป็น พ.ศ. ไม่ได้
 *
 * ✅ สัญญาของ component นี้: ข้างนอกคุยกันด้วยสตริง ค.ศ. "YYYY-MM-DD" เหมือนเดิมทุกประการ
 * ความเป็น พ.ศ. อยู่แค่ "ชั้นที่ผู้ใช้เห็น" เท่านั้น ไม่รั่วออกไปถึง state หรือ server เด็ดขาด
 */

/**
 * ข้อความทั้งหมดของปฏิทินเป็นภาษาไทย
 *
 * 🐛 ที่แก้: ค่าเริ่มต้นของ MUI เป็นอังกฤษล้วน ("Choose date", "Select date", "Cancel", "OK",
 * "Previous month") — บนมือถือ DatePicker จะกลายร่างเป็นแบบ Mobile ซึ่ง "โชว์ปุ่ม Cancel/OK และ
 * หัวข้อ Select date ให้เห็นเต็มๆ" ไม่ใช่แค่ aria-label ที่ซ่อนอยู่
 */
const TH_LOCALE_TEXT = {
  previousMonth: "เดือนก่อนหน้า",
  nextMonth: "เดือนถัดไป",
  openPreviousView: "ย้อนกลับ",
  openNextView: "ถัดไป",
  calendarViewSwitchingButtonAriaLabel: (view) =>
    view === "year" ? "กำลังเลือกปี — กดเพื่อกลับไปเลือกวัน" : "กำลังเลือกวัน — กดเพื่อเลือกปี",
  inputModeToggleButtonAriaLabel: (isKeyboardInputOpen) =>
    isKeyboardInputOpen ? "สลับไปเลือกจากปฏิทิน" : "สลับไปพิมพ์วันที่เอง",
  start: "เริ่ม",
  end: "สิ้นสุด",
  cancelButtonLabel: "ยกเลิก",
  clearButtonLabel: "ล้างค่า",
  okButtonLabel: "ตกลง",
  todayButtonLabel: "วันนี้",
  datePickerDefaultToolbarTitle: "เลือกวันที่",
  dateTimePickerDefaultToolbarTitle: "เลือกวันที่และเวลา",
  timePickerDefaultToolbarTitle: "เลือกเวลา",
  dateRangePickerDefaultToolbarTitle: "เลือกช่วงวันที่",
  openDatePickerDialogue: (rawValue, utils) =>
    rawValue && utils.isValid(utils.date(rawValue))
      ? `เลือกวันที่ — ตอนนี้คือ ${utils.format(utils.date(rawValue), "fullDate")}`
      : "เลือกวันที่",
  openTimePickerDialogue: (rawValue, utils) =>
    rawValue && utils.isValid(utils.date(rawValue))
      ? `เลือกเวลา — ตอนนี้คือ ${utils.format(utils.date(rawValue), "fullTime")}`
      : "เลือกเวลา",
  timeTableLabel: "เลือกเวลา",
  dateTableLabel: "เลือกวันที่",
};

/**
 * Adapter ที่ทำให้ทุกอย่างใน DatePicker เป็น พ.ศ. — ทั้งช่องข้อความ, หัวปฏิทิน ("สิงหาคม 2569"),
 * ปุ่มเลือกปี และ aria-label ของปุ่มเปิดปฏิทิน
 *
 * ⚠️ เหตุผลที่ override แค่ 2 เมธอดก็พอ: ทุกการแสดงผลของ @date-io/moment วิ่งผ่าน formatByString
 * หมด (format(date, "monthAndYear") ก็แค่ไปเปิดตาราง formats แล้วเรียกต่อ) ส่วน parse คือทางเข้า
 * ทางเดียวของข้อความที่ผู้ใช้พิมพ์เอง จึงครอบคลุมครบโดยไม่ต้องแตะตรรกะวันที่ข้างในเลย
 *
 * ⚠️ ปีที่ใช้คำนวณข้างในยังเป็น ค.ศ. ทั้งหมด (getYearRange, setYear, ฯลฯ ไม่ถูกแตะ) — จงใจ
 * เพราะถ้าไปแก้ตรงนั้นด้วย ตรรกะเทียบวันที่ของ MUI จะเพี้ยนทันที
 */
class AdapterMomentBE extends AdapterMoment {
  formatByString = (date, format) => {
    const m = date.clone().locale(this.locale || "th");
    // ⚠️ ต้องคลี่ token ย่อ (ll / L / LL) ก่อนแทนที่ปีเสมอ — 10 ใน 27 รูปแบบของ MUI ใช้ token พวกนี้
    // ซึ่งมีปีอยู่ข้างในแต่ไม่ได้เขียนว่า YYYY ถ้าไม่คลี่ก่อน ปีจะหลุดเป็น ค.ศ. เฉพาะจุดพวกนั้น
    return m.format(toThaiPattern(format, toBEYear(m.year()), m.localeData()));
  };

  parse = (value, format) => {
    if (value === "" || value == null) return null;
    // 🐛 ต้องแปลงเลขปีในสตริงก่อน parse ไม่ใช่ parse แล้วค่อยลบ 543 — moment ตรวจว่าวันมีอยู่จริง
    // ไหมโดยอิงปฏิทินของปีที่มันอ่านได้ "29/02/2567" จึงถูกตีเป็น invalid ทันที (ค.ศ. 2567 ไม่ใช่
    // ปีอธิกสุรทิน) ทั้งที่ผู้ใช้กรอกถูก
    const ceText = String(value).replace(/\d{4}/, (y) =>
      Number(y) >= 2400 ? String(toCEYear(y)) : y
    );
    return this.moment(ceText, format, this.locale || "th", true);
  };
}

/** แปลงสตริง ค.ศ. "YYYY-MM-DD" เป็น moment — คืน null ถ้าว่างหรือไม่ถูกต้อง */
const toPickerValue = (value, valueFormat) => {
  if (!value) return null;
  const m = moment.isMoment(value) ? value.clone() : moment(value, valueFormat);
  return m.isValid() ? m : null;
};

/**
 * @param {string}   props.value        สตริง ค.ศ. "YYYY-MM-DD" (หรือว่าง)
 * @param {Function} props.onChange     คืนสตริง ค.ศ. "YYYY-MM-DD" หรือ "" เมื่อค่าไม่ถูกต้อง
 * @param {string}   [props.valueFormat] รูปแบบของค่าที่รับ-ส่ง ค่าเริ่มต้น "YYYY-MM-DD"
 * @param {object}   [props.textFieldProps] props ที่ส่งต่อให้ TextField ข้างใน
 */
export default function ThaiDatePicker({
  label,
  value,
  onChange,
  valueFormat = "YYYY-MM-DD",
  minDate,
  maxDate,
  disabled,
  readOnly,
  size = "small",
  fullWidth = true,
  variant,
  error,
  helperText,
  textFieldProps = {},
  autoOpen = false,
  onOpen,
  onClose,
  ...rest
}) {
  // ⚠️ ต้อง memo ไว้ ไม่งั้นทุก render จะได้ instance ใหม่ ทำให้ LocalizationProvider ส่ง context
  // ค่าใหม่ลงไปทุกครั้ง = ปฏิทินทั้งอันถูก render ใหม่ทุกครั้งที่พ่อ render (หน้าตารางสัญญามีช่องวันที่
  // หลายสิบช่องพร้อมกัน จะหน่วงเห็นได้ชัด)
  const adapter = useMemo(() => AdapterMomentBE, []);

  /**
   * 🐛 BUG ที่แก้ (ผู้ใช้แจ้งว่า "วันที่กดไม่ขึ้นหลายจุด"): ค่าเริ่มต้นของ MUI v5 เปิดปฏิทินได้
   * "เฉพาะตอนกดไอคอนปฏิทินเล็กๆ ท้ายช่อง" เท่านั้น กดที่ตัวช่องเองไม่มีอะไรเกิดขึ้นเลย ซึ่งสวนกับ
   * ความคาดหวังทั้งหมด โดยเฉพาะบนมือถือที่ไอคอนเล็กจนกดพลาดตลอด
   * ✅ คุม open เองแล้วให้คลิกที่ช่องเปิดปฏิทินด้วย
   * ⚠️ ยังส่ง onOpen/onClose ต่อให้ผู้เรียกเสมอ — ตารางแก้ไขสด (EditableCell) ใช้สองตัวนี้รู้ว่า
   * ปฏิทินเปิดอยู่ไหม เพื่อไม่ให้ onBlur ปิดโหมดแก้ไขทิ้งตอนผู้ใช้กำลังเลือกวันอยู่
   */
  const [open, setOpen] = useState(false);
  const canOpen = !disabled && !readOnly;

  /**
   * 🐛 BUG ที่แก้ (อาการ "กดแล้ววันที่ไม่ขึ้น" ทั้งที่ปฏิทินเปิดอยู่จริง): ค่า z-index ของ popper
   * ที่ MUI ให้มาคือ theme.zIndex.modal = 1300 ซึ่ง "ต่ำกว่าหลายอย่างในแอปนี้"
   *   • .swal2-container ถูกยกเป็น 1500 ในบางฟอร์ม (StaffPanel/index.js)
   *   • .ts-dropdown ของ TomSelect ถูกยกเป็น 100000 (tomSelectFixes + ฟอร์มปฏิทิน)
   * ผลคือปฏิทินถูกวาดอยู่ "หลัง" กล่อง swal มิด — ผู้ใช้เห็นเหมือนกดแล้วไม่มีอะไรเกิดขึ้นเลย
   * ทั้งที่ DOM มีปฏิทินอยู่ครบ (ทดสอบแล้ว: elementFromPoint กลางปฏิทินไปโดน <label> ของฟอร์มแทน)
   * ✅ ยกให้สูงกว่าทุกตัวที่แอปนี้ใช้ ปฏิทินจึงอยู่บนสุดเสมอไม่ว่าเปิดจากที่ไหน
   * ⚠️ ต้องตั้งทั้ง popper (โหมดจอใหญ่) และ dialog (โหมดจอสัมผัส) เพราะ DatePicker สลับโหมดเองตาม
   * (pointer: fine) ของเครื่องผู้ใช้ — แก้ทางเดียวจะพังอีกทางแบบมองไม่เห็น
   */
  const zIndexSx = { zIndex: 100010 };

  /**
   * ✅ autoOpen — เปิดปฏิทินให้เลยตอนช่องโผล่ขึ้นมา ใช้กับ "ช่องแก้ไขสดในตาราง" ที่ผู้ใช้คลิกช่องไป
   * แล้วหนึ่งครั้ง ถ้ายังต้องคลิกซ้ำอีกทีถึงจะได้ปฏิทิน จะรู้สึกเหมือนกดแล้วไม่มีอะไรเกิดขึ้น
   * ⚠️ ต้องเรียก onOpen เองด้วย — เมื่อ open ถูกคุมจากข้างนอก MUI จะไม่เรียก onOpen ให้ ถ้าไม่เรียก
   * ฝั่งที่ใช้ (EditableCell) จะไม่รู้ว่าปฏิทินเปิดอยู่ แล้วสั่งปิดโหมดแก้ไขทิ้งตอนช่องเสียโฟกัส
   * ⚠️ กันด้วย ref ไม่ใช่ dep array — onOpen เป็น arrow inline จึงมี identity ใหม่ทุก render
   */
  const openedOnMount = useRef(false);
  useEffect(() => {
    if (!autoOpen || !canOpen || openedOnMount.current) return;
    openedOnMount.current = true;
    setOpen(true);
    onOpen?.();
  }, [autoOpen, canOpen, onOpen]);

  return (
    <LocalizationProvider dateAdapter={adapter} adapterLocale="th" localeText={TH_LOCALE_TEXT}>
      <DatePicker
        label={label}
        open={open}
        onOpen={() => { setOpen(true); onOpen?.(); }}
        onClose={() => { setOpen(false); onClose?.(); }}
        value={toPickerValue(value, valueFormat)}
        onChange={(next) =>
          // ⚠️ ต้องเช็ค isValid() เสมอ ผู้ใช้พิมพ์ค้างกลางทางได้ตลอด ถ้าไม่เช็คจะได้สตริง
          // "Invalid date" หลุดเข้า state แล้วถูกส่งขึ้น server
          onChange?.(next && next.isValid() ? next.format(valueFormat) : "")
        }
        inputFormat={THAI_DATE_FORMAT}
        minDate={toPickerValue(minDate, valueFormat) || undefined}
        maxDate={toPickerValue(maxDate, valueFormat) || undefined}
        disabled={disabled}
        readOnly={readOnly}
        {...rest}
        PopperProps={{ ...rest.PopperProps, sx: { ...zIndexSx, ...(rest.PopperProps?.sx || {}) } }}
        DialogProps={{ ...rest.DialogProps, sx: { ...zIndexSx, ...(rest.DialogProps?.sx || {}) } }}
        renderInput={(params) => (
          <TextField
            {...params}
            size={size}
            fullWidth={fullWidth}
            variant={variant}
            error={error || params.error}
            helperText={helperText}
            {...textFieldProps}
            onClick={(e) => {
              if (canOpen) setOpen(true);
              textFieldProps.onClick?.(e);
            }}
            // ⚠️ ต้อง merge ไม่ใช่เขียนทับ: params.InputProps มี endAdornment ที่เป็น "ปุ่มไอคอน
            // ปฏิทิน" อยู่ ถ้าผู้เรียกส่ง InputProps ของตัวเองมา (เช่น startAdornment เป็นป้ายชื่อ
            // ช่องในตารางแก้ไขสด) แล้วเขียนทับทั้งก้อน ปุ่มเปิดปฏิทินจะหายไปเงียบๆ
            InputProps={{ ...params.InputProps, ...(textFieldProps.InputProps || {}) }}
            inputProps={{
              ...params.inputProps,
              placeholder: THAI_DATE_PLACEHOLDER,
              ...(textFieldProps.inputProps || {}),
            }}
          />
        )}
      />
    </LocalizationProvider>
  );
}
