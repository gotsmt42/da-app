/**
 * jobDocPermissions — ใครแนบ/ลบ "เอกสารประจำงาน" ได้ (Service Report · ใบเสนอราคา · เอกสารการเงิน · ใบส่งมอบงาน)
 *
 * 🐛 (10 พ.ย. 2569 ผู้ใช้: "ช่างไม่มีปุ่มให้อัพโหลดไฟล์เอกสารงาน ใน Event · ตรวจสอบสิทธิ์ของผู้ใช้ต่างๆ ให้หมด")
 *    เดิมช่องเอกสาร (FileUploadSection) เช็คแค่ can(user, "editOperation") ซึ่งไม่มีช่าง/หัวหน้าช่าง
 *    → ช่างที่อยู่ในงานเปิดเอกสารจากหน้า Event แล้วไม่มีปุ่ม "แนบ" เลย ทั้งที่ server อนุญาต และหน้างานของช่างก็แนบได้
 *
 * ✅ กติกาเดียวกับ server (PUT /events/upload/:id · PUT /events/delete-file/:id):
 *    • editAnyJob (แอดมิน/ผู้บริหาร/ผู้จัดการ) — แนบ/ลบได้เสมอ แม้งานปิดแล้ว
 *    • งานปิดแล้ว (ดำเนินการเสร็จสิ้น) — คนอื่นแก้ได้เฉพาะใบเสนอราคา/เอกสารผลลัพธ์ใบเสนอราคา (ติดตามหลังปิดงานได้)
 *    • editOperation (เจ้าหน้าที่ — พฤติกรรมเดิม) — แนบ/ลบได้
 *    • คนที่อยู่ในงาน (ผู้รับผิดชอบ · หัวหน้าทีม · ลูกทีม) — แนบ/ลบได้ (ช่าง/หัวหน้าช่างในงานของตัวเอง)
 *    • นอกนั้น (ดูอย่างเดียว เช่น ช่างที่ไม่ได้อยู่ในงาน · ฝ่ายขาย) — ดูได้อย่างเดียว
 *    ลบไม่ได้เสมอ: ใบเสนอราคาฉบับเดิมที่ส่งลูกค้าแล้ว · ไฟล์ที่มาจากใบคำขอลงงาน (source = dispatch)
 */
import { can } from "@/shared/utils/roles";
import { isParticipant } from "@/shared/utils/jobFlow";

const CLOSED = "ดำเนินการเสร็จสิ้น";
const AFTER_CLOSE_OK = new Set(["quotation", "quotationResult"]);

/** แนบไฟล์ชนิดนี้ในงานนี้ได้ไหม */
export const canEditJobFiles = (user, event, type) => {
  if (!user) return false;
  if (can(user, "editAnyJob")) return true;
  if (event?.status === CLOSED && !AFTER_CLOSE_OK.has(type)) return false;
  if (can(user, "editOperation")) return true;
  return Boolean(event) && isParticipant(event, user.userId || user._id || user.id, user.fname);
};

/** ลบไฟล์นี้ได้ไหม (ต้องแนบได้ก่อน + ไม่ใช่ไฟล์ที่ล็อกไว้) */
export const canDeleteJobFile = (user, event, type, file) => {
  if (!canEditJobFiles(user, event, type)) return false;
  if (type === "quotation" && file?.supersededAt) return false;
  if (file?.source === "dispatch") return false;
  return true;
};
