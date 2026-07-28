/**
 * cloudinaryImage.js — ย่อ/บีบอัดรูปแบบ on-the-fly ตอนแสดงผล (พรีวิว) โดยไม่กระทบไฟล์ต้นฉบับที่
 * เก็บไว้จริง — ใช้ได้เฉพาะไฟล์ที่อัพโหลดเป็น Cloudinary resource_type "image" เท่านั้น (URL มี
 * "/image/upload/") ไฟล์เก่าที่อัพโหลดไว้ก่อนหน้านี้ (ตอนนั้นทุกไฟล์ยังเป็น resource_type "raw" หมด)
 * จะคืน URL เดิมกลับไปเฉยๆ เพราะ raw ไม่รองรับ transformation — ไม่ error แค่ไม่ได้ประโยชน์ความเร็วเพิ่ม
 */
export const getOptimizedImageUrl = (url, { width = 1600 } = {}) => {
  if (!url || typeof url !== "string") return url;
  const marker = "/image/upload/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  const insertAt = idx + marker.length;
  return `${url.slice(0, insertAt)}f_auto,q_auto,w_${width}/${url.slice(insertAt)}`;
};
