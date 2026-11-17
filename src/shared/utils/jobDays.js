/**
 * jobDays.js — วันเริ่ม/วันสุดท้ายของงาน 1 แถว (ที่เดียวทั้งแอป)
 *
 * ✅ (17 พ.ย. 2569 ผู้ใช้: "อันไหนควรทำเป็น Module เพื่อเรียกใช้งานง่าย และแก้ไขทีเดียว")
 *    เดิมเขียนซ้ำใน workerLog.js · jobSummary.js (สูตรเดียวกันทุกตัวอักษร) — แก้กติกาวันที่ต้องแก้ที่นี่ที่เดียว
 *    ⚠️ allDay เก็บ end แบบ exclusive (เที่ยงคืนของวันถัดไป) — ถอยกลับหนึ่งวัน
 */
import moment from "moment";

/** วันแรกของแถว (เริ่มต้นวัน) */
export const jobDayStart = (e) => moment(e?.start || e?.date).startOf("day");

/** วันสุดท้ายของแถว (เริ่มต้นวัน) · ไม่มี end = วันเดียวกับวันเริ่ม */
export const jobDayEnd = (e) => {
  if (!e?.end) return jobDayStart(e);
  const end = moment(e.end);
  return (e.allDay ? end.subtract(1, "days") : end).startOf("day");
};

/** จำนวนวันของแถว (อย่างน้อย 1) */
export const jobDayCount = (e) => Math.max(1, jobDayEnd(e).diff(jobDayStart(e), "days") + 1);
