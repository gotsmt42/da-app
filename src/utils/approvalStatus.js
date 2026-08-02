import { getOverdueGroupKey } from "./overdueJobs";

/**
 * approvalStatus.js — ตรรกะ "งานรออนุมัติ" ที่ใช้ร่วมกันทั่วแอป (ปฏิทิน, แผงงานล่วงหน้า, หน้าแก้ไขงาน,
 * หน้า Operation) งานที่สร้างโดยคนที่ไม่ใช่แอดมิน/manager (ช่าง/เซล) ต้องรอแอดมิน/manager อนุมัติก่อน
 * ถึงจะถือว่า "ยืนยันแล้วจริง" — ดู PUT /events/:id/approval (backend)
 *
 * ⚠️ กฎเดียวที่ต้องจำ: เอกสารเก่า/งานที่ admin สร้างเอง ไม่มีฟิลด์ approvalStatus เลย (undefined) —
 * ต้องถือว่า "ไม่มีค่า" เทียบเท่า "approved" เสมอ ห้ามเทียบ ev.approvalStatus ตรงๆ ที่ไหนนอกจากในไฟล์นี้
 */

// ✅ events (raw state จาก FetchEvents.js) เก็บ approvalStatus ไว้ top-level เหมือน status/company ทั่วไป
// ส่วน FullCalendar Event API object (arg.event ที่ได้จาก eventContent/eventClassNames ฯลฯ) FullCalendar
// จะย้ายฟิลด์ที่มันไม่รู้จักเข้า .extendedProps ให้เองอัตโนมัติ — เช็คทั้งสองที่กันพลาด
export const getApprovalState = (ev) => ev?.approvalStatus ?? ev?.extendedProps?.approvalStatus ?? "approved";

export const isPendingApproval = (ev) => getApprovalState(ev) === "pending";
export const isRejected = (ev) => getApprovalState(ev) === "rejected";
export const isApproved = (ev) => getApprovalState(ev) === "approved";

// ✅ สีเดียวกับที่ใช้ทั่วแอปสำหรับสถานะ "รอ" (amber) และ "ปัญหา/ปฏิเสธ" (red) — เทียบ pattern เดียวกับ
// กล่องคำขอปิดงานในหน้า Operation/index.js ให้ธีมสีตรงกันทั้งแอป
export const APPROVAL_LABEL = { pending: "⏳ รออนุมัติ", rejected: "❌ ไม่อนุมัติ", approved: "" };
export const APPROVAL_COLORS = { pending: "#f59e0b", rejected: "#ef4444", approved: "#10b981" };

// ✅ นับ "จำนวนงาน" (ไม่ใช่จำนวน document ดิบ) ที่ยังรออนุมัติ — จัดกลุ่มงานที่เข้าหลายวันไม่ติดกัน
// (jobGroupId เดียวกัน) ให้นับเป็น 1 งานเดียว เทียบ pattern เดียวกับ countDistinctJobs ใน overdueJobs.js
// ✅ isAdminOrManager=true เห็นยอดรวมทั้งระบบ (มีสิทธิ์อนุมัติทุกงาน) ส่วนคนอื่นเห็นแค่ของตัวเอง
// (userId/resPerson ตรงกับตัวเอง) กันโชว์ตัวเลขที่กดอนุมัติเองไม่ได้อยู่ดี ดูแล้วงงว่าทำไมกดไม่ได้
export const countPendingJobs = (events, drafts, { userId, isAdminOrManager } = {}) => {
  const all = [...(events || []), ...(drafts || [])];
  const seen = new Set();
  let count = 0;
  all.forEach((e) => {
    if (getApprovalState(e) !== "pending") return;
    if (!isAdminOrManager) {
      const isMine =
        (userId && e.userId && String(e.userId) === String(userId)) ||
        (userId && e.resPerson && String(e.resPerson) === String(userId)) ||
        (userId && e.approvalRequestedByUserId && String(e.approvalRequestedByUserId) === String(userId));
      if (!isMine) return;
    }
    const key = getOverdueGroupKey(e);
    if (seen.has(key)) return;
    seen.add(key);
    count += 1;
  });
  return count;
};
