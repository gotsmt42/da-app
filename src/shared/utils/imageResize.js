/**
 * imageResize.js — ย่อรูปในเบราว์เซอร์ก่อนอัปโหลด
 *
 * ✅ ผู้ใช้แจ้ง (5 ต.ค. 2569): "เปลี่ยนรูปจะหน่วงและช้ามาก" — รูปจากมือถือ 3-8 MB ถูกส่งดิบขึ้น server
 *    แล้ว server ส่งต่อ Cloudinary อีกทอด (รอสองรอบ) · ย่อเหลือ ~512px JPEG (~40-80 KB) ก่อนส่ง เร็วขึ้นหลายสิบเท่า
 * ⚠️ แปลงเป็น JPEG เสมอ — server รับเฉพาะ jpg/png (ไฟล์ webp/heic จากมือถือเคยอัปไม่ผ่าน)
 */
const loadImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("เปิดไฟล์รูปนี้ไม่ได้ — ลองใช้ไฟล์ JPG หรือ PNG")); };
  img.src = url;
});

/**
 * @param {File} file
 * @param {{ max?: number, square?: boolean, quality?: number }} opts square = ครอปตรงกลางเป็นสี่เหลี่ยมจัตุรัส (รูปโปรไฟล์)
 * @returns {Promise<File>}
 */
export async function resizeImage(file, { max = 512, square = false, quality = 0.86 } = {}) {
  const img = await loadImage(file);
  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
  if (square) {
    const side = Math.min(sw, sh);
    sx = (sw - side) / 2; sy = (sh - side) / 2; sw = sh = side;
  }
  const scale = Math.min(1, max / Math.max(sw, sh));
  const w = Math.round(sw * scale), h = Math.round(sh * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; // PNG โปร่งใส → พื้นขาว (JPEG ไม่มีความโปร่งใส)
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("ย่อรูปไม่สำเร็จ");
  const name = (file.name || "image").replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}
