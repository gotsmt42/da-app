/**
 * activityLogMeta.js — ป้ายกำกับ/สี ของแต่ละประเภทกิจกรรมใน activityLog ของ CalendarEvent
 *
 * ✅ แยกจาก ACTION_META ใน components/Operation/index.js โดยตั้งใจ — ตัวนั้นผูกกับ MUI icon
 * component (JSX) ใช้ได้แค่ฝั่งที่ render เป็น React เท่านั้น ส่วนไฟล์นี้เก็บแค่ label/color/emoji
 * (string ล้วนๆ) ให้ใช้ได้ทั้งฝั่ง React และฝั่งที่ต้อง build เป็น HTML string ตรงๆ (เช่น
 * EventCalendar/EventForms/EditEvent.js ที่ใช้ SweetAlert2) รายการ action ต้องตรงกับฝั่ง
 * Operation/index.js เสมอ — เพิ่ม action ใหม่ต้องเพิ่มทั้งสองที่
 */
export const ACTIVITY_LOG_META = {
  check_in:       { label: "เช็คอิน",              emoji: "🔑", color: "#8b5cf6" },
  check_out:      { label: "เช็คเอาท์",             emoji: "🚪", color: "#10b981" },
  note_saved:     { label: "บันทึกสรุปงาน",         emoji: "📝", color: "#3b82f6" },
  report_saved:   { label: "บันทึก Report",         emoji: "📋", color: "#10b981" },
  file_uploaded:  { label: "อัปโหลดไฟล์",           emoji: "📎", color: "#f59e0b" },
  status_changed: { label: "เปลี่ยนสถานะ",          emoji: "🔄", color: "#6b7280" },
  close_requested:{ label: "ขอปิดงาน",              emoji: "✅", color: "#f59e0b" },
  close_approved: { label: "อนุมัติปิดงาน",          emoji: "🎉", color: "#10b981" },
  close_rejected: { label: "ไม่อนุมัติปิดงาน",       emoji: "❌", color: "#ef4444" },
  document_checked:        { label: "ทำเครื่องหมายเอกสาร", emoji: "☑️", color: "#3b82f6" },
  document_applicable_set: { label: "ระบุมี/ไม่มีเอกสาร",   emoji: "📑", color: "#8b5cf6" },
  file_deleted:   { label: "ลบไฟล์",                emoji: "🗑️", color: "#ef4444" },
  quotation_sent:     { label: "ส่งใบเสนอราคาให้ลูกค้า",  emoji: "📤", color: "#3b82f6" },
  quotation_approved: { label: "ลูกค้าอนุมัติใบเสนอราคา", emoji: "✅", color: "#10b981" },
  quotation_rejected: { label: "ลูกค้าปฏิเสธใบเสนอราคา",  emoji: "❌", color: "#ef4444" },
  quotation_revising: { label: "แก้ไขใบเสนอราคาใหม่",     emoji: "✏️", color: "#f59e0b" },
  quotation_followup: { label: "บันทึกการติดตามลูกค้า",   emoji: "📞", color: "#3b82f6" },

  // ✅ เพิ่มสำหรับหน้า /event (EditEvent.js) — เดิมหน้านี้ไม่เคยบันทึกประวัติอะไรเลยแม้จะเป็นจุดที่
  // แก้ไขงานบ่อยที่สุด (เปลี่ยนทีม/สถานะ/โครงการ ฯลฯ) เทียบ/แยกจากประเภทข้างบนที่มาจากฝั่ง Operation
  team_changed:     { label: "เปลี่ยนทีม/ผู้รับผิดชอบ",   emoji: "👷", color: "#8b5cf6" },
  team_members_changed: { label: "เปลี่ยนลูกทีม",         emoji: "👥", color: "#8b5cf6" },
  project_changed:  { label: "เปลี่ยนโครงการ",           emoji: "🏢", color: "#3b82f6" },
  system_changed:   { label: "เปลี่ยนระบบ",              emoji: "💻", color: "#3b82f6" },
  title_changed:    { label: "เปลี่ยนประเภทงาน",         emoji: "🔧", color: "#3b82f6" },
  schedule_changed: { label: "เปลี่ยนวันที่/กำหนดการ",    emoji: "📅", color: "#f59e0b" },
  details_updated:  { label: "แก้ไขรายละเอียดงาน",       emoji: "✏️", color: "#6b7280" },
};

export const getActivityLogMeta = (action) =>
  ACTIVITY_LOG_META[action] || { label: action || "อัปเดตข้อมูล", emoji: "•", color: "#6b7280" };
