/**
 * jobDocActions — แนบ/ลบ "เอกสารประจำงาน" + บันทึกประวัติ (activityLog) แบบเดียวกับหน้าการดำเนินงาน
 *
 * ✅ (25 พ.ย. 2569 ผู้ใช้: "ทำให้มันเป็นรูปแบบหน้าเอกสารงานแบบเดียวกันกับหน้าการดำเนินงาน ให้อัพเดตตรงกันทั้งหมด")
 *    ใช้ร่วม: กล่องเอกสารหน้าภาพรวมงาน (JobDocsDialog) · หน้าต่างเอกสารในหน้า Event (EditEventDocs)
 *    — แนบหลายไฟล์ทีละไฟล์ (แถบความคืบหน้าถูกต้อง) · ประวัติ "แนบ/ลบไฟล์" ข้อความชุดเดียวกับหน้าการดำเนินงาน
 * ⚠️ activityLog ฝั่ง server ต่อท้ายอย่างเดียว (appendOnlyActivityLog) — ส่งเฉพาะรายการใหม่ ไม่ทับประวัติเดิม
 */
import EventService from "@/shared/services/EventService";
import { JOB_DOC_TYPE_BY_KEY } from "@/shared/utils/jobDocTypes";

const actorName = () => {
  try {
    const p = JSON.parse(localStorage.getItem("payload") || "{}");
    return p?.name || p?.username || "ผู้ใช้งาน";
  } catch {
    return "ผู้ใช้งาน";
  }
};
const labelOf = (type) => JOB_DOC_TYPE_BY_KEY[type]?.label || type;

// ประวัติเป็นของเสริม — บันทึกไม่สำเร็จต้องไม่ทำให้การแนบ/ลบที่สำเร็จแล้วกลายเป็น "ล้มเหลว"
const logActivity = (eventId, action, detail) =>
  EventService.UpdateEvent(eventId, {
    activityLog: [{ action, detail, userName: actorName(), timestamp: new Date().toISOString() }],
  }).catch(() => {});

/** ข้อความผิดพลาดจริงจาก server/ตัวตรวจไฟล์ (ไฟล์ใหญ่เกิน · ชนิดไม่รองรับ · งานปิดแล้ว) */
export const jobDocErrorText = (e, fallback) => {
  const d = e?.response?.data;
  return (typeof d === "string" ? d : d?.message || d?.error) || e?.message || fallback;
};

/**
 * แนบไฟล์ (หลายไฟล์ได้) ทีละไฟล์ตามลำดับ
 * @param onProgress ({ percent, sizeText }) — percent ค้างที่ 99 จนเซิร์ฟเวอร์ตอบกลับ (เหมือนหน้าการดำเนินงาน)
 * @returns จำนวนไฟล์ที่แนบสำเร็จ · ไฟล์ไหนพัง = โยน error (ไฟล์ก่อนหน้าที่สำเร็จแล้วยังถูกบันทึกประวัติ)
 */
export async function uploadJobDocFiles(eventId, fileList, type, onProgress) {
  const files = Array.from(fileList?.length !== undefined ? fileList : [fileList]).filter(Boolean);
  const names = [];
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const sizeText = `${(file.size / (1024 * 1024)).toFixed(2)} MB${files.length > 1 ? ` (${i + 1}/${files.length})` : ""}`;
      onProgress?.({ percent: 0, sizeText });
      // eslint-disable-next-line no-await-in-loop -- อัปโหลดทีละไฟล์ให้แถบความคืบหน้าถูกต้อง
      await EventService.Upload(eventId, file, type, {
        onUploadProgress: (pe) => onProgress?.({ percent: Math.min(99, Math.round((pe.loaded * 100) / (pe.total || 1))), sizeText }),
      });
      names.push(file.name);
    }
  } finally {
    if (names.length) {
      const label = labelOf(type);
      await logActivity(eventId, "file_uploaded",
        names.length > 1 ? `${label}: ${names.length} ไฟล์ (${names.join(", ")})` : `${label}: ${names[0]}`);
    }
  }
  return names.length;
}

/** ลบไฟล์ 1 ไฟล์ (file ต้องมี _id) + บันทึกประวัติ */
export async function deleteJobDocFile(eventId, type, file) {
  await EventService.DeleteFile(eventId, type, file?._id);
  const label = labelOf(type);
  await logActivity(eventId, "file_deleted", file?.fileName ? `${label}: ${file.fileName}` : label);
}
