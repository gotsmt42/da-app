/**
 * jobFlow — ขั้นตอนทำงานมาตรฐาน 6 ขั้น (9 ต.ค. 2569)
 *   1 รับแจ้งงาน (รอข้อมูล) → 2 เปิด Job (เลข Job · ด่วน · ครบกำหนด) → 3 วางแผน (ทีม · อุปกรณ์)
 *   → 4 ช่างรับงาน/รายงาน → 5 ติดตามงานไม่เสร็จ → 6 ตรวจและปิดงาน
 * ฝั่ง server: routes/calendarEvent/jobflow.js · models/Events.js
 */
import moment from "moment";

export const FOLLOW_UP_REASONS = [
  { key: "รออะไหล่", hint: "ต้องสั่งของ/รอของเข้า", owner: "แอดมิน/ผู้ประสานงาน" },
  { key: "รอลูกค้าอนุมัติ", hint: "รอใบเสนอราคา/ลูกค้าตัดสินใจ", owner: "ฝ่ายขาย" },
  { key: "เข้าซ่อมไม่สำเร็จ", hint: "ต้องเข้าซ่อมอีกครั้ง", owner: "ช่าง (ทีมเดิม)" },
  { key: "ลูกค้าไม่สะดวก", hint: "ลูกค้าขอเลื่อน/เข้าพื้นที่ไม่ได้", owner: "แอดมิน/ผู้ประสานงาน" },
  { key: "อื่นๆ", hint: "ระบุรายละเอียดเอง", owner: "แอดมิน/ผู้ประสานงาน" },
];
export const NEXT_OWNERS = ["แอดมิน/ผู้ประสานงาน", "ช่าง (ทีมเดิม)", "ฝ่ายขาย", "ลูกค้า"];

export const isClosedJob = (ev) => ev?.status === "ดำเนินการเสร็จสิ้น";
export const isUrgent = (ev) => ev?.priority === "urgent";
export const openFollowUp = (ev) => (ev?.followUpOpen ? [...(ev.followUps || [])].reverse().find((f) => !f.resolvedAt) || null : null);
export const acksOf = (ev) => ev?.acks || [];
export const isAckedBy = (ev, userId) => acksOf(ev).some((a) => String(a.userId) === String(userId));

/** คนที่ได้รับมอบหมายงานนี้ (หัวหน้าทีม · ลูกทีม · ผู้รับผิดชอบ) */
export const isParticipant = (ev, userId, fname) => {
  const uid = String(userId || "");
  if (!ev || !uid) return false;
  return (
    String(ev.resPerson || "") === uid ||
    String(ev.responsiblePersonId || "") === uid ||
    (fname && (ev.team === fname || ev.responsiblePerson === fname)) ||
    (ev.teamMembers || []).some((m) => String(m?.userId || "") === uid || (fname && m?.name === fname))
  );
};

/** ครบกำหนด: { label, overdue, daysLeft } หรือ null */
export const dueInfo = (ev) => {
  if (!ev?.dueDate) return null;
  const due = moment(ev.dueDate).startOf("day");
  const daysLeft = due.diff(moment().startOf("day"), "days");
  return { due, daysLeft, overdue: daysLeft < 0 && !isClosedJob(ev) };
};

/** ข้อมูลระดับงานในฟอร์ม → payload (ค่าว่าง = ล้าง) */
export const jobInfoPayload = (f) => ({
  priority: f.priority === "urgent" ? "urgent" : "normal",
  dueDate: f.dueDate || null,
  equipment: String(f.equipment || "").trim(),
  infoPending: Boolean(f.infoPending),
  infoPendingNote: f.infoPending ? String(f.infoPendingNote || "").trim() : "",
});
