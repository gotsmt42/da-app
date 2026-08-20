import moment from "moment";

/**
 * quotationTracking.js — ตรรกะ "ติดตามใบเสนอราคา" ใช้ร่วมกันทั้งหน้า /quotations, Dashboard และ
 * (คัดลอกตรรกะเดียวกัน) ฝั่ง server ที่ services/OverdueReminder.js
 *
 * 🐛 BUG ที่แก้ (บันทึกติดตามแล้วระบบยังเตือนเหมือนเดิม): เดิมนับวันจาก quotationSentAt เพียงอย่างเดียว
 * โดยไม่สนใจ quotationFollowUps เลย — ช่างโทรหาลูกค้าแล้วบันทึกผลไว้เรียบร้อย แต่ระบบยังนับจากวันที่ส่ง
 * ใบเสนอราคาครั้งแรกอยู่ดี ป้าย "เกิน N วัน" จึงเพิ่มขึ้นเรื่อยๆ ไม่มีวันหยุด และการแจ้งเตือนก็เด้งซ้ำ
 * ทุกวันทั้งที่เพิ่งติดตามไปเมื่อวาน = บันทึกการติดตามไม่มีผลอะไรเลยกับระบบเตือน
 * ✅ นับจาก "การติดต่อลูกค้าครั้งล่าสุด" แทน (วันที่ส่ง หรือวันที่ติดตามครั้งล่าสุด แล้วแต่อันไหนใหม่กว่า)
 * บันทึกติดตาม 1 ครั้ง = ได้เวลาอีก 7 วันก่อนถูกเตือนอีกรอบ ตรงกับการทำงานจริง
 */

// ✅ เกณฑ์เดียวทั้งระบบ — เดิมกระจัดกระจาย 3 ที่และไม่ตรงกัน (utils=3, OverdueReminder=3, Dashboard=7)
// ทำให้หน้าจอบอกว่า "ต้องติดตาม" แต่ยังไม่มีแจ้งเตือน หรือกลับกัน สับสนว่าอันไหนถูก
export const WARNING_DAYS_AFTER_SENT = 7;

// ✅ วันที่ "ติดต่อลูกค้าครั้งล่าสุด" — ส่งใบเสนอราคา หรือบันทึกติดตาม แล้วแต่อันไหนใหม่กว่า
export const getLastContactAt = (event) => {
  if (!event?.quotationSentAt) return null;
  const followUps = event.quotationFollowUps || [];
  let latest = moment(event.quotationSentAt);
  followUps.forEach((f) => {
    if (!f?.contactedAt) return;
    const t = moment(f.contactedAt);
    if (t.isValid() && t.isAfter(latest)) latest = t;
  });
  return latest;
};

// ✅ จำนวนวันตั้งแต่ "ส่ง" ใบเสนอราคา — ใช้บอกอายุรวมของใบนี้ (ข้อมูลประกอบ ไม่ได้ใช้ตัดสินการเตือน)
export const getDaysSinceSent = (event) => {
  if (event?.quotationStatus !== "sent" || !event?.quotationSentAt) return null;
  return moment().startOf("day").diff(moment(event.quotationSentAt).startOf("day"), "days");
};

// ✅ จำนวนวันตั้งแต่ "ติดต่อลูกค้าครั้งล่าสุด" — ตัวนี้คือตัวที่ใช้ตัดสินว่าต้องติดตามหรือยัง
export const getDaysSinceLastContact = (event) => {
  if (event?.quotationStatus !== "sent" || !event?.quotationSentAt) return null;
  return moment().startOf("day").diff(getLastContactAt(event).startOf("day"), "days");
};

// ✅ ใช้ > แทน >= — ครบพอดี 7 วันยังไม่ถือว่า "เกิน" (เทียบเกณฑ์เดียวกับ isFlaggedDays ใน overdueJobs.js)
export const isQuotationNeedsFollowUp = (days) =>
  days !== null && days !== undefined && days > WARNING_DAYS_AFTER_SENT;

/**
 * ✅ ข้อมูลติดตามครบชุดในที่เดียว — ใช้ทั้งการ์ด/กล่องรายละเอียด/แจ้งเตือน กันแต่ละจุดคำนวณเองแล้วไม่ตรงกัน
 * คืน null ถ้าใบนี้ยังไม่ได้ส่งลูกค้า (ยังไม่เข้าสู่ขั้นตอนติดตาม)
 */
export const getFollowUpInfo = (event) => {
  if (event?.quotationStatus !== "sent" || !event?.quotationSentAt) return null;
  const followUps = event.quotationFollowUps || [];
  const lastContactAt = getLastContactAt(event);
  const daysSinceLastContact = getDaysSinceLastContact(event);
  const dueAt = lastContactAt.clone().add(WARNING_DAYS_AFTER_SENT, "days");
  // จำนวนวันที่เหลือก่อนครบกำหนดติดตามรอบถัดไป (ติดลบ = เลยกำหนดมาแล้วกี่วัน)
  const daysUntilDue = dueAt.startOf("day").diff(moment().startOf("day"), "days");
  return {
    followUpCount: followUps.length,
    lastFollowUp: followUps.length > 0 ? followUps[followUps.length - 1] : null,
    // ✅ แยกให้ชัดว่า "ติดต่อล่าสุด" มาจากการส่งครั้งแรก หรือจากการติดตามที่บันทึกไว้
    lastContactAt,
    lastContactIsFollowUp: followUps.length > 0 && lastContactAt.isAfter(moment(event.quotationSentAt)),
    daysSinceSent: getDaysSinceSent(event),
    daysSinceLastContact,
    dueAt,
    daysUntilDue,
    needsFollowUp: isQuotationNeedsFollowUp(daysSinceLastContact),
  };
};

// ✅ สถานะของ "งาน" ในหน้าติดตามใบเสนอราคา — mutually exclusive ให้ตรงกับแท็บบนหน้า
// waiting_file: quotationApplicable=true แต่ยังไม่มีไฟล์ (ช่างยังไม่ได้แนบ)
// not_sent:     มีไฟล์แล้วแต่ยังไม่ได้กดส่งลูกค้า
// follow_up:    ติดต่อลูกค้าครั้งล่าสุดผ่านมาเกิน WARNING_DAYS_AFTER_SENT วัน ยังไม่มีผล
// sent:         ส่ง/ติดตามไปแล้ว ยังไม่ถึงกำหนดติดตามรอบถัดไป
// approved / rejected / revising: ตรงกับ quotationStatus
export const resolveQuotationGroup = (event) => {
  const hasFiles = (event.quotationFiles?.length || 0) > 0;
  if (!hasFiles) return event.quotationApplicable === true ? "waiting_file" : "";
  if (!event.quotationStatus) return "not_sent";
  if (event.quotationStatus === "sent") {
    return isQuotationNeedsFollowUp(getDaysSinceLastContact(event)) ? "follow_up" : "sent";
  }
  return event.quotationStatus; // "approved" | "rejected" | "revising"
};
