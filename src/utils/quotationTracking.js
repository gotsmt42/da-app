import moment from "moment";

/**
 * quotationTracking.js — ตรรกะ "ติดตามใบเสนอราคา" ใช้ร่วมกันในหน้า /quotations
 * (เทียบ pattern เดียวกับ overdueJobs.js — วันคิดจาก quotationSentAt แทนวันสิ้นสุดงาน)
 */

// ✅ เลย 3 วันหลังส่ง = เริ่ม "ต้องติดตาม" ให้ทันเห็นก่อนลูกค้าลืม
export const WARNING_DAYS_AFTER_SENT = 3;

// ✅ คืนจำนวนวันตั้งแต่ส่งใบเสนอราคา (null = ยังไม่ได้ส่ง/ไม่ใช่สถานะ "sent")
export const getDaysSinceSent = (event) => {
  if (event.quotationStatus !== "sent" || !event.quotationSentAt) return null;
  return moment().startOf("day").diff(moment(event.quotationSentAt).startOf("day"), "days");
};

// ✅ ใช้ > แทน >= — วันที่ครบพอดี 3 วันยังไม่ถือว่า "เกิน" (เทียบเกณฑ์เดียวกับ isFlaggedDays)
export const isQuotationNeedsFollowUp = (days) => days !== null && days !== undefined && days > WARNING_DAYS_AFTER_SENT;

// ✅ สถานะของ "งาน" ในหน้าติดตามใบเสนอราคา — mutually exclusive ให้ตรงกับแท็บบนหน้า
// waiting_file: quotationApplicable=true แต่ยังไม่มีไฟล์ (ช่างยังไม่ได้แนบ)
// not_sent:     มีไฟล์แล้วแต่ยังไม่ได้กดส่งลูกค้า
// follow_up:    ส่งลูกค้าไปแล้วเกิน WARNING_DAYS_AFTER_SENT วัน ยังไม่มีผล
// sent:         ส่งลูกค้าไปแล้ว ยังไม่เกินกำหนดติดตาม
// approved / rejected / revising: ตรงกับ quotationStatus
export const resolveQuotationGroup = (event) => {
  const hasFiles = (event.quotationFiles?.length || 0) > 0;
  if (!hasFiles) return event.quotationApplicable === true ? "waiting_file" : "";
  if (!event.quotationStatus) return "not_sent";
  if (event.quotationStatus === "sent") {
    const days = getDaysSinceSent(event);
    return isQuotationNeedsFollowUp(days) ? "follow_up" : "sent";
  }
  return event.quotationStatus; // "approved" | "rejected" | "revising"
};
