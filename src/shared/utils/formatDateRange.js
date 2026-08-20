import moment from "moment";

/**
 * formatDateRange.js — จัดรูปแบบช่วงวันที่ของงานให้กระชับ ใช้ร่วมกันทั้งหน้า Operation (แอดมิน)
 * และ TechnicianJobPanel (ช่าง) กันการ์ดโชว์ "14 ก.ค. 2026 — 15 ก.ค. 2026" ยาวเกินจำเป็น (เดือน/ปี
 * ซ้ำกันทั้งสองฝั่งของ — ) ซึ่งพอตัดขึ้นบรรทัดใหม่บนจอแคบจะขาดกลางวันที่ (เช่น "15" กับ "ก.ค. 2026"
 * แยกกันคนละบรรทัด) ดูไม่เป็นระเบียบ — ถ้าอยู่ปีเดียวกัน/เดือนเดียวกัน ย่อเหลือแค่ "14 – 15 ก.ค. 2026"
 */
export const formatEventDateRange = (event) => {
  const start = moment(event.start).locale("th");
  if (!event.end) return start.format("DD MMM YYYY");

  // ✅ event.end ของงานแบบ allDay ถูกบวกไป 1 วันตอนบันทึก (ค่า end แบบ exclusive ของ FullCalendar)
  // ต้องลบ 1 วันคืนตอนแสดงผล ไม่งั้นวันที่ที่โชว์เพี้ยนไม่ตรงกับหน้า event
  const end = moment(event.end).subtract(event.allDay ? 1 : 0, "days").locale("th");

  if (start.isSame(end, "day")) return start.format("DD MMM YYYY");
  if (start.year() === end.year()) {
    if (start.month() === end.month()) {
      return `${start.format("DD")} – ${end.format("DD MMM YYYY")}`;
    }
    return `${start.format("DD MMM")} – ${end.format("DD MMM YYYY")}`;
  }
  return `${start.format("DD MMM YYYY")} – ${end.format("DD MMM YYYY")}`;
};
