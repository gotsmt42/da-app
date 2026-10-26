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
  // 🔁 (26 ต.ค. 2569) ออกฉบับแก้ไขแล้ว = นับครั้งที่ติดตามใหม่ของฉบับปัจจุบัน (ประวัติฉบับเดิมยังเก็บไว้)
  const followUps = currentFollowUps(event);
  const lastContactAt = getLastContactAt(event);
  const daysSinceLastContact = getDaysSinceLastContact(event);
  // ✅ นัดติดตามครั้งถัดไป (ตั้งไว้ตอนบันทึกการติดตาม/ในข้อมูลใบเสนอราคา) — ถ้ามีและอยู่หลังการติดต่อล่าสุด
  //    ใช้วันนั้นแทนเกณฑ์ 7 วัน (เช่น ลูกค้าบอก "ขอเข้าที่ประชุมสิ้นเดือน") · ⚠️ ตรงกับ OverdueReminder ฝั่ง server
  const next = event.quotationNextFollowUpAt ? moment(event.quotationNextFollowUpAt) : null;
  const scheduled = Boolean(next && next.isValid() && next.isAfter(lastContactAt));
  const dueAt = scheduled ? next.clone().startOf("day") : lastContactAt.clone().startOf("day").add(WARNING_DAYS_AFTER_SENT, "days");
  // จำนวนวันที่เหลือก่อนครบกำหนดติดตามรอบถัดไป (ติดลบ = เลยกำหนดมาแล้วกี่วัน)
  const daysUntilDue = dueAt.clone().startOf("day").diff(moment().startOf("day"), "days");
  return {
    followUpCount: followUps.length,
    lastFollowUp: followUps.length > 0 ? followUps[followUps.length - 1] : null,
    // ✅ แยกให้ชัดว่า "ติดต่อล่าสุด" มาจากการส่งครั้งแรก หรือจากการติดตามที่บันทึกไว้
    lastContactAt,
    lastContactIsFollowUp: followUps.length > 0 && lastContactAt.isAfter(moment(event.quotationSentAt)),
    daysSinceSent: getDaysSinceSent(event),
    daysSinceLastContact,
    dueAt,
    scheduled,
    daysUntilDue,
    needsFollowUp: daysUntilDue < 0,
  };
};

// ✅ สถานะของ "งาน" ในหน้าติดตามใบเสนอราคา — mutually exclusive ให้ตรงกับแท็บบนหน้า
// waiting_file: quotationApplicable=true แต่ยังไม่มีไฟล์ (ช่างยังไม่ได้แนบ)
// not_sent:     มีไฟล์แล้วแต่ยังไม่เริ่มนับ = รอช่างส่งงาน (server เริ่มนับเองเมื่อส่งงาน — services/quotationAutoStart.js)
// follow_up:    ติดต่อลูกค้าครั้งล่าสุดผ่านมาเกิน WARNING_DAYS_AFTER_SENT วัน ยังไม่มีผล
// sent:         ส่ง/ติดตามไปแล้ว ยังไม่ถึงกำหนดติดตามรอบถัดไป
// approved / rejected / revising: ตรงกับ quotationStatus
export const resolveQuotationGroup = (event) => {
  const hasFiles = (event.quotationFiles?.length || 0) > 0;
  if (!hasFiles) return event.quotationApplicable === true ? "waiting_file" : "";
  if (!event.quotationStatus) return "not_sent";
  if (event.quotationStatus === "sent") {
    return getFollowUpInfo(event)?.needsFollowUp ? "follow_up" : "sent";
  }
  return event.quotationStatus; // "approved" | "rejected" | "revising"
};

/**
 * ✅ (19 ต.ค. 2569 ผู้ใช้: "สถานะต่างๆ ต้องอัปเดตพร้อมๆ กับทุกหน้าดำเนินการ")
 * ชื่อ/สีสถานะใบเสนอราคาชุดเดียวทั้งแอป — หน้าติดตามใบเสนอราคา · งานเข้า · การดำเนินงาน · งานของฉัน ใช้ตัวนี้
 * (คีย์ = resolveQuotationGroup) ข้อมูลมาจากงานตัวเดียวกัน และทุกหน้าโหลดใหม่เองเมื่อมีการบันทึก (useRealtime "events")
 */
export const QUOTE_STATUS = {
  waiting_file: { label: "รอแนบใบเสนอราคา", short: "รอแนบไฟล์", color: "#64748b" },
  not_sent: { label: "กำลังเริ่มนับติดตาม", short: "เริ่มนับ", color: "#d97706" },
  sent: { label: "รอลูกค้าตอบ", short: "รอลูกค้าตอบ", color: "#2563eb" },
  follow_up: { label: "ถึงเวลาติดตาม", short: "ถึงเวลาติดตาม", color: "#dc2626" },
  revising: { label: "รอแนบใบเสนอราคาฉบับแก้ไข", short: "รอฉบับแก้ไข", color: "#7c3aed" },
  approved: { label: "ได้งาน", short: "ได้งาน", color: "#16a34a" },
  rejected: { label: "ไม่ได้งาน", short: "ไม่ได้งาน", color: "#dc2626" }, // ผู้ใช้: ไม่ได้งาน = แดง · ได้งาน = เขียว
};

/**
 * ✅ (26 ต.ค. 2569 ผู้ใช้: "ให้สามารถกดแก้ไขใบเสนอราคาแล้วเริ่มติดตามใหม่ ... เอกสารเดิมที่ส่งไปแล้วมันไม่สามารถแก้ไขได้")
 *    ฉบับของใบเสนอราคา — quotationRevision = ฉบับปัจจุบัน (0 = ฉบับแรก)
 *    ไฟล์ฉบับเดิม (supersededAt) = เอกสารที่ส่งลูกค้าไปแล้ว ล็อก ดู/ดาวน์โหลดได้ ลบไม่ได้ · ใช้ร่วมทุกหน้าที่แสดงไฟล์ใบเสนอราคา
 */
export const quoteRevOf = (event) => Number(event?.quotationRevision) || 0;
export const revLabel = (n) => `Rev.${Number(n) || 0}`;
export const isOldQuoteFile = (f) => Boolean(f?.supersededAt);
export const currentQuoteFiles = (files) => (files || []).filter((f) => !f?.supersededAt);
export const currentFollowUps = (event) => {
  const rev = quoteRevOf(event);
  return (event?.quotationFollowUps || []).filter((f) => (Number(f?.revision) || 0) === rev);
};
/** ฉบับปัจจุบันขึ้นก่อน แล้วตามด้วยฉบับเดิม (ใหม่ → เก่า) */
export const sortQuoteFiles = (files) => (files || []).slice().sort((a, b) =>
  (isOldQuoteFile(a) - isOldQuoteFile(b)) || ((Number(b?.revision) || 0) - (Number(a?.revision) || 0)));
/** ป้ายฉบับของไฟล์ — null ถ้างานนี้ยังไม่เคยออกฉบับแก้ไข (ไม่ต้องรก) */
export const quoteFileTag = (f, files) => {
  if (!(files || []).some((x) => x?.supersededAt || Number(x?.revision) > 0)) return null;
  const r = revLabel(f?.revision);
  return isOldQuoteFile(f)
    ? { text: `ฉบับเดิม ${r} · ส่งแล้ว`, color: "#64748b", bg: "#f1f5f9", old: true }
    : { text: `ฉบับปัจจุบัน ${r}`, color: "#7c3aed", bg: "#f5f3ff", old: false };
};
