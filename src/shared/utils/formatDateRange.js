import moment from "moment";
import { formatThai } from "./thaiDate";

/**
 * formatDateRange.js — จัดรูปแบบช่วงวันที่ของงานให้กระชับ ใช้ร่วมกันทั้งหน้า Operation (แอดมิน)
 * และ TechnicianJobPanel (ช่าง) กันการ์ดโชว์ "14 ก.ค. 2569 — 15 ก.ค. 2569" ยาวเกินจำเป็น (เดือน/ปี
 * ซ้ำกันทั้งสองฝั่งของ — ) ซึ่งพอตัดขึ้นบรรทัดใหม่บนจอแคบจะขาดกลางวันที่ (เช่น "15" กับ "ก.ค. 2569"
 * แยกกันคนละบรรทัด) ดูไม่เป็นระเบียบ — ถ้าอยู่ปีเดียวกัน/เดือนเดียวกัน ย่อเหลือแค่ "14 – 15 ก.ค. 2569"
 *
 * ⚠️ ปีที่แสดงเป็น พ.ศ. ทั้งหมด (ผ่าน formatThai) — ห้ามกลับไปใช้ .format() ตรงๆ เพราะจะได้ ค.ศ.
 * แล้วหน้าจอจะมีปีสองระบบปนกันโดยไม่มีอะไรบอกผู้ใช้ว่าอันไหนเป็นอันไหน
 */
export const formatEventDateRange = (event) => {
  const start = moment(event.start);
  if (!event.end) return formatThai(start, "DD MMM YYYY");

  // ✅ event.end ของงานแบบ allDay ถูกบวกไป 1 วันตอนบันทึก (ค่า end แบบ exclusive ของ FullCalendar)
  // ต้องลบ 1 วันคืนตอนแสดงผล ไม่งั้นวันที่ที่โชว์เพี้ยนไม่ตรงกับหน้า event
  const end = moment(event.end).subtract(event.allDay ? 1 : 0, "days");

  // ⚠️ กันวันที่กลับหัว — งาน allDay ที่เก็บ end เท่ากับ/ก่อน start (ข้อมูลเก่าที่ตกค้างจากตอนที่ยัง
  // ไม่ได้ normalize ที่โมเดล) พอลบ 1 วันจะกลายเป็น "24 – 23 ส.ค. 2569" ซึ่งอ่านแล้วเหมือนระบบพัง
  // 🐛 อาการที่ผู้ใช้เจอจริงในหน้า "งานของฉัน" ของช่าง
  if (!end.isValid() || end.isBefore(start, "day")) return formatThai(start, "DD MMM YYYY");
  if (start.isSame(end, "day")) return formatThai(start, "DD MMM YYYY");
  if (start.year() === end.year()) {
    if (start.month() === end.month()) {
      return `${formatThai(start, "DD")} – ${formatThai(end, "DD MMM YYYY")}`;
    }
    return `${formatThai(start, "DD MMM")} – ${formatThai(end, "DD MMM YYYY")}`;
  }
  return `${formatThai(start, "DD MMM YYYY")} – ${formatThai(end, "DD MMM YYYY")}`;
};
