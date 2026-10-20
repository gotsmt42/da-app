/**
 * myJobAttention — งานที่ "ฉัน" ต้องลงมือตอนนี้ (กันลืม) · ใช้ร่วม: หน้าแรก (ต้องทำตอนนี้) · งานของฉัน (เด้งขึ้นก่อน)
 *
 * ✅ (20 ต.ค. 2569 ผู้ใช้: "เตือนช่างว่ามีงานที่ไม่กดรับทราบ ไม่กดบันทึกงานเมื่อถึงเวลา · งานของฉันให้เด้งงานที่ยังไม่รับทราบ
 *    และบันทึกเข้างานขึ้นก่อน ให้สังเกตง่าย กันลืม")
 *    checkin  ถึงวันเข้างานแล้ว (รวมวันที่ 2,3… ของงานหลายวัน) ฉันเป็นหัวหน้าทีม แต่ยังไม่บันทึกเข้างานของวันนี้
 *    ack      ฉันเป็นคนกดรับทราบ (ผู้รับผิดชอบ · ไม่มี = หัวหน้าทีม) ยังไม่รับทราบ
 *    confirm  รับทราบแล้ว ยังไม่ยืนยันนัดหมาย
 */
import moment from "moment";
import { ackTracked } from "@/shared/utils/jobFlow";
import { formatThai } from "@/shared/utils/thaiDate";

const OPEN = ["กำลังรอยืนยัน", "ยืนยันแล้ว", "กำลังดำเนินการ"];

/** วันแรก/วันสุดท้ายของงาน (เวลาไทย · allDay: end = วันถัดไป 00:00 — กติกาเดียวกับทั้งแอป) */
export const jobSpanOf = (e) => {
  const first = moment(e.start).utcOffset(7).startOf("day");
  let last = e.end ? moment(e.end).utcOffset(7).subtract(e.allDay ? 1 : 0, "day").startOf("day") : first.clone();
  if (last.isBefore(first)) last = first.clone();
  return { first, last, days: last.diff(first, "days") + 1 };
};

/** งานนี้มีวันเข้างานเป็นวันนี้ไหม */
export const isTodayJob = (e) => {
  if (!e?.start || e.unscheduled) return false;
  const { first, last } = jobSpanOf(e);
  const t = moment().utcOffset(7).startOf("day");
  return !t.isBefore(first) && !t.isAfter(last);
};

/**
 * @param todayCheckedIds Set ของ eventId ที่บันทึกเข้างานวันนี้แล้ว (null = ยังไม่รู้ → ไม่ตัดสินเรื่องบันทึกเข้างาน)
 * @returns "checkin" | "ack" | "confirm" | null
 */
export function attentionOf(e, { userId, fname, todayCheckedIds }) {
  if (!e || e.unscheduled || e.department === "sales" || e.cancelledAt || !OPEN.includes(e.status) || e.closeRequested) return null;
  if (["pending", "rejected"].includes(e.approvalStatus)) return null;
  const me = String(userId || "");
  const isResp = String(e.responsiblePersonId || "") === me || (fname && e.responsiblePerson === fname);
  const isHead = String(e.resPerson || "") === me || (fname && e.team === fname);
  const hasResp = Boolean(e.responsiblePersonId || e.responsiblePerson);
  const canAck = hasResp ? isResp : isHead;
  if (canAck && e.status === "กำลังรอยืนยัน" && !e.ackDeclined?.userId) {
    const acked = (e.acks || []).length > 0 || !ackTracked(e);
    return acked ? "confirm" : "ack";
  }
  const headish = isHead || (!e.team && !e.resPerson && isResp);
  if (headish && ["ยืนยันแล้ว", "กำลังดำเนินการ"].includes(e.status) && todayCheckedIds && isTodayJob(e) && !todayCheckedIds.has(String(e._id))) {
    return "checkin";
  }
  return null;
}

export const ATTENTION_META = {
  checkin: { rank: 0, color: "#dc2626", title: "ถึงวันเข้างาน · ยังไม่บันทึกเข้างาน", short: "ยังไม่บันทึกเข้างานวันนี้", hint: "ถึงหน้างานแล้วกด “บันทึกเข้างาน” พร้อมถ่ายรูป" },
  ack: { rank: 1, color: "#d97706", title: "ยังไม่กดรับทราบงาน", short: "ยังไม่กดรับทราบงาน", hint: "กดรับทราบ (หรือปฏิเสธพร้อมเหตุผล)" },
  confirm: { rank: 2, color: "#2563eb", title: "ยังไม่ยืนยันนัดหมาย", short: "ยังไม่ยืนยันนัดหมาย", hint: "ยืนยันวันกับลูกค้าแล้วกด “ยืนยันนัดหมาย”" },
};

/** ป้ายวันสั้น: "วันนี้" · "วันที่ 2/3" (งานหลายวันที่เริ่มแล้ว) · "21 ต.ค." */
export const attentionDayText = (e) => {
  const { first, days } = jobSpanOf(e);
  const t = moment().utcOffset(7).startOf("day");
  if (days > 1 && !t.isBefore(first)) return `วันที่ ${Math.min(t.diff(first, "days") + 1, days)}/${days}`;
  return first.isSame(t, "day") ? "วันนี้" : formatThai(first, "D MMM");
};
