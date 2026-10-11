/**
 * jobFlow — ขั้นตอนทำงานมาตรฐาน 6 ขั้น (9 ต.ค. 2569)
 *   1 รับงาน (รอข้อมูล) → 2 เปิด Job (เลข Job · ด่วน · ครบกำหนด) → 3 วางแผน (ทีม · อุปกรณ์)
 *   → 4 ช่างรับทราบงาน/รายงาน → 5 ติดตามงานไม่เสร็จ → 6 ตรวจและปิดงาน
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
/** ✅ "รับทราบงาน" เริ่มใช้ 9 ต.ค. 2569 — งานที่สร้างก่อนหน้านี้ไม่ต้องติดตามการรับทราบ (ตรงกับ ACK_TRACK_SINCE ฝั่ง server) */
export const ACK_TRACK_SINCE = "2026-10-08T17:00:00.000Z";
// 🐛 (11 ต.ค. 2569 ผู้ใช้: "ยังมีบางงานขึ้นเป็นสถานะนี้ ตรวจสอบและหาสาเหตุ")
//    สาเหตุ: งานที่สร้างก่อนวันเริ่มใช้ (ACK_TRACK_SINCE) ถูกนับว่า "รับทราบแล้ว" อัตโนมัติ ทั้งที่ไม่มีใครกด
//    → การ์ดขึ้น "รับทราบแล้ว" และขั้นรับทราบเป็นสีเขียวผิดความจริง
//    ✅ ตอนนี้ติดตามการรับทราบทุกงานที่ยังไม่ปิด (เหมือนการเข้างาน — ผู้ใช้: "งานเก่าหรืองานใหม่ ต้องตามขั้นตอน")
//    ACK_TRACK_SINCE คงไว้เผื่อที่อื่นอ้างถึง แต่ไม่ใช้ตัดสินแล้ว
export const ackTracked = (ev) => Boolean(ev) && !isClosedJob(ev) && !ev.unscheduled && !isLegacyPreconfirmed(ev);

/**
 * ✅ (11 ต.ค. 2569 ผู้ใช้: "ป้องกันงานเก่าในระบบที่เลยวันที่ปัจจุบันไปแล้ว ให้ขั้นตอนรับทราบ และยืนยัน ครบแล้ว · กันข้อผิดพลาด งานไม่แสดง")
 *    งานที่มีอยู่ก่อนเปิดใช้ขั้นตอน "รับทราบ › ยืนยันนัด" (สร้างก่อน FLOW_SINCE) และวันเข้างานผ่านไปแล้ว
 *    = ถือว่ารับทราบ + ยืนยันนัดครบแล้ว — ไม่ค้างขั้นต้น เอกสาร/ขอปิดงานใช้ได้ตามปกติ
 *    งานเก่าที่ยังไม่ถึงวัน และงานใหม่ทั้งหมด ต้องทำตามขั้นตอนเต็ม
 */
export const FLOW_SINCE = "2026-10-11T03:00:00.000Z";
export const isLegacyPreconfirmed = (ev) => Boolean(ev?.createdAt) && new Date(ev.createdAt) < new Date(FLOW_SINCE)
  && Boolean(ev.start) && new Date(ev.start) < new Date(new Date().setHours(0, 0, 0, 0));
/** สถานะที่ถือว่า "ยืนยันนัดแล้ว" (ยืนยันแล้ว หรือเลยไปแล้ว) */
export const CONFIRMED_STATUSES = ["ยืนยันแล้ว", "กำลังดำเนินการ", "ดำเนินการเสร็จสิ้น"];
export const isConfirmedJob = (ev) => CONFIRMED_STATUSES.includes(ev?.status) || isLegacyPreconfirmed(ev);
const DOC_FILE_FIELDS = ["reportFiles", "quotationFiles", "invoiceFiles", "completionFiles"];
/**
 * ✅ (11 ต.ค. 2569 ผู้ใช้: "ให้ช่างกดรับทราบงาน และยืนยันนัดก่อน เมนูเอกสารงานถึงจะขึ้นมาแสดง")
 *    เอกสารประจำงาน/ขอปิดงาน แสดงเมื่อ: รับทราบแล้ว + ยืนยันนัดแล้ว
 *    ⚠️ กันข้อมูลหาย: แสดงเสมอถ้ามีไฟล์เอกสารอยู่แล้ว · เข้างานแล้ว · ขอปิด/ปิดงานแล้ว · งานเก่าที่เลยวันแล้ว
 */
export const docsUnlocked = (ev) => {
  if (!ev) return false;
  if (isClosedJob(ev) || ev.closeRequested || ev.checkedInAt) return true;
  if (DOC_FILE_FIELDS.some((f) => (ev[f] || []).length > 0)) return true;
  if (isLegacyPreconfirmed(ev)) return true;
  return (ev.acks || []).length > 0 && isConfirmedJob(ev);
};
export const isUrgent = (ev) => ev?.priority === "urgent";
/**
 * ✅ (10 ต.ค. 2569 ผู้ใช้: "งานที่เช็คอินไม่ใช่ให้ไปอ้างอิงงานใหม่ ให้ขึ้นงานทั้งหมด ยกเว้นงานที่เสร็จสิ้นแล้ว")
 *    เช็คอิน/เช็คเอาต์ใช้ได้กับทุกงานที่ยังไม่ปิด (เลิกตัดตามวันที่เริ่มใช้ระบบแล้ว) — server เช็คซ้ำ
 */
export const attendanceTracked = (ev) => Boolean(ev) && !isClosedJob(ev);
/**
 * ✅ (10 ต.ค. 2569 ผู้ใช้: "ตัดระบบงานไม่เสร็จต้องเข้าใหม่ออก ให้ช่างเขียนหมายเหตุเองก็พอ")
 *    ปิดระบบ "งานไม่เสร็จ" ทั้งแอปที่จุดนี้จุดเดียว — คืน null เสมอ ป้าย/กล่อง/วิดเจ็ตที่อ่านค่านี้จึงไม่แสดง
 *    ช่างบันทึกเหตุผลเองในสรุปงานตอนเช็คเอาต์ (สถานะ "รอดำเนินการต่อ/รออะไหล่" + หมายเหตุ) แทน
 *    ⚠️ ข้อมูล followUps เดิมใน DB ยังอยู่ ไม่ได้ลบ
 */
export const openFollowUp = () => null;
export const acksOf = (ev) => ev?.acks || [];
export const isAckedBy = (ev, userId) => acksOf(ev).some((a) => String(a.userId) === String(userId));

/**
 * ✅ (11 ต.ค. 2569 ผู้ใช้: "ทุกๆ เมนูที่มีแจ้งเตือน ให้มีจำนวนแจ้งเตือนเหนือปุ่มด้วย")
 * งานนี้รอ "ฉัน" ทำขั้นถัดไปไหม — ผู้รับผิดชอบ (ไม่มี → หัวหน้าทีม): รับทราบ/ยืนยันนัดหมาย ·
 * หัวหน้าทีม: ถึงวันเข้างานแล้ว ยืนยันนัดหมายแล้ว แต่ยังไม่บันทึกเข้างาน
 */
export const needsMyAction = (ev, userId, fname) => {
  if (!ev || ev.unscheduled || isClosedJob(ev) || ev.closeRequested || ["pending", "rejected"].includes(ev.approvalStatus)) return false;
  const uid = String(userId || "");
  const isResp = String(ev.responsiblePersonId || "") === uid || (fname && ev.responsiblePerson === fname);
  const isHead = String(ev.resPerson || "") === uid || (fname && ev.team === fname);
  const hasResp = Boolean(ev.responsiblePersonId || ev.responsiblePerson);
  const canAck = hasResp ? isResp : isHead;
  if (canAck && ev.status === "กำลังรอยืนยัน" && ackTracked(ev) && !ev.ackDeclined?.userId) return true;
  const startDay = new Date(ev.start); startDay.setHours(0, 0, 0, 0);
  return Boolean(isHead && isConfirmedJob(ev) && ev.status !== "กำลังดำเนินการ" && !ev.checkedInAt && startDay <= new Date());
};

/**
 * ✅ (11 ต.ค. 2569 ผู้ใช้: "ภาพรวมงาน/รอบเข้างานที่ต้องนัด ให้แสดงแค่ของผู้รับผิดชอบ")
 * ฉันเป็น "ผู้รับผิดชอบงาน" นี้ไหม (ไม่นับหัวหน้าทีม/ลูกทีม) — ใช้กับสรุปความรับผิดชอบ (สัญญา/รอบเข้างาน)
 */
export const isResponsibleOf = (ev, userId, fname) =>
  Boolean(ev) && (String(ev.responsiblePersonId || "") === String(userId || "x") || (Boolean(fname) && ev.responsiblePerson === fname));

/**
 * ✅ (11 ต.ค. 2569 ผู้ใช้: "หน้างานของฉัน ให้แสดงตามเงื่อนไข มีชื่อเป็นผู้รับผิดชอบ หรือ หัวหน้าทีม")
 * ฉันเป็นผู้รับผิดชอบ หรือหัวหน้าทีมเข้างาน (ไม่นับลูกทีม)
 */
export const isRespOrHead = (ev, userId, fname) =>
  isResponsibleOf(ev, userId, fname) || (Boolean(ev) && (String(ev.resPerson || "") === String(userId || "x") || (Boolean(fname) && ev.team === fname)));

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
