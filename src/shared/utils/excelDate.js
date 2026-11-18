import moment from "moment";

/**
 * excelDate — วันที่/เวลาสำหรับเขียนลง Excel (ExcelJS)
 *
 * 🐛 วันที่ใน Excel ไม่มีโซนเวลา — ExcelJS เขียน Date เป็น UTC ตรงๆ เที่ยงคืนเวลาไทย (UTC+7) จึงกลายเป็น 17:00
 *    ของ "วันก่อนหน้า" ในไฟล์ (นัด 4 ส.ค. ขึ้นเป็น 3 ส.ค.) และเวลาเข้างาน 08:00 ขึ้นเป็น 01:00
 *    → สร้าง Date แบบ UTC ที่ตัวเลข วัน/เวลา ตรงกับเวลาไทย · ค่าว่าง/ไม่ถูกต้อง = ""
 */
export function excelDate(v) {
  if (!v) return "";
  const m = moment(v);
  return m.isValid() ? new Date(Date.UTC(m.year(), m.month(), m.date(), m.hours(), m.minutes(), m.seconds())) : "";
}
