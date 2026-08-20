/**
 * fileUpload.js — กฎกลางของการอัปโหลดไฟล์ทั้งแอป (ขนาด / ชนิด / การบีบอัดรูป)
 *
 * 🐛 สภาพเดิมก่อนมีไฟล์นี้:
 *   • ฝั่ง server ไม่มี `limits` ที่ multer เลยสักจุด = อัปไฟล์ใหญ่แค่ไหนก็ได้ และหลาย route ใช้
 *     memoryStorage ซึ่งโหลดไฟล์ทั้งก้อนเข้า RAM (อัป 1 ไฟล์ 500MB = กิน RAM 500MB ทันที)
 *   • ฝั่งจอมีที่เดียวที่เช็คขนาด และตั้งไว้ที่ 500MB ซึ่งเท่ากับไม่ได้จำกัดอะไร
 *   • ไม่มีการบีบอัดรูปเลย รูปจากมือถือ 12MP (6-12MB) ถูกอัปขึ้นทั้งดุ้น แล้วตอนเปิดดูก็โหลดกลับมา
 *     ทั้งดุ้นอีก → "โหลดรูปนานมาก"
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ทำไมเลือกตัวเลขพวกนี้
 *
 * ขนาดสูงสุด 15 MB:
 *   • รูปจากมือถือรุ่นปัจจุบัน 12-48MP อยู่ที่ 3-12 MB — ครอบคลุมได้หมดโดยไม่ต้องให้ผู้ใช้ย่อเอง
 *   • ไฟล์ PDF รายงาน/ใบวางบิลที่สแกนมา ปกติ 1-8 MB, ที่หนาจริงๆ ไม่เกิน 15 MB
 *   • เกินกว่านี้เกือบทั้งหมดคือไฟล์ที่อัปผิด (วิดีโอ/ไฟล์ดิบ) ไม่ใช่เอกสารงาน
 *   • ⚠️ ตัวเลขนี้ต้องตรงกับ MAX_UPLOAD_BYTES ฝั่ง server (src/config/upload.js) เสมอ
 *
 * รูปถูกบีบอัดก่อนส่งเสมอ:
 *   • ย่อด้านยาวสุดเหลือ 1920px — พอสำหรับดูเต็มจอและอ่านตัวหนังสือในรูปถ่ายเอกสาร
 *     (ต้นฉบับมือถือ 3000-4000px คือความละเอียดที่จ่ายค่าโหลดไปเปล่าๆ)
 *   • เข้ารหัสเป็น WebP คุณภาพ 0.75 — "พอประมาณ" ตามที่ต้องการ ตาคนแทบแยกไม่ออกจากต้นฉบับ
 *     แต่ไฟล์เล็กลง 5-10 เท่า (รูป 6 MB → ~300-500 KB)
 *   • ผลลัพธ์: อัปเร็วขึ้นมาก และตอนเปิดดูก็โหลดเร็วขึ้นตามไปด้วย
 */

// ── ขนาด ─────────────────────────────────────────────────────────────────────
export const MAX_UPLOAD_MB = 15;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** เล็กกว่านี้ไม่ต้องบีบอัด — เสียเวลา decode/encode มากกว่าที่ประหยัดได้ */
const SKIP_COMPRESS_BELOW = 400 * 1024;

// ── ชนิดไฟล์ที่อนุญาต (allowlist — ปลอดภัยกว่าการไล่แบนทีละชนิด) ──────────────
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  // ✅ iPhone ถ่ายเป็น HEIC เป็นค่าเริ่มต้น — ต้องรับ ไม่งั้นช่างอัปรูปจาก iPhone ไม่ได้เลย
  "image/heic",
  "image/heif",
];

export const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOC_TYPES];

/**
 * ⚠️ ชนิดที่ "จงใจไม่รับ" และเหตุผล — เผื่อมีคนมาถามว่าทำไมอัปไม่ได้
 *
 *   .svg              เป็น XML ที่ฝัง <script> ได้ พอเปิดดูจากลิงก์ Cloudinary จะรันสคริปต์ในโดเมนนั้น
 *                     = ช่องทาง XSS ที่คลาสสิกที่สุดของระบบอัปโหลดรูป
 *   .html .htm .js    รันสคริปต์ได้ตรงๆ ด้วยเหตุผลเดียวกัน
 *   .exe .msi .bat    ไฟล์รันได้ ไม่มีเหตุผลทางธุรกิจให้แนบเข้างานบริการ
 *   .cmd .sh .ps1 .scr
 *   .docm .xlsm .pptm Office ที่ฝังมาโคร — เป็นพาหะมัลแวร์ที่พบบ่อยที่สุดในไฟล์เอกสาร
 *   .zip .rar .7z     ไฟล์บีบอัดซ่อนอะไรข้างในก็ได้ ตรวจไม่ได้ และไม่จำเป็นกับงานนี้
 *   วิดีโอทุกชนิด      ขนาดใหญ่มากและไม่ใช่หลักฐานที่ระบบนี้ใช้ (ถ้าวันหนึ่งต้องใช้ ควรทำทางแยกต่างหาก
 *                     ที่มี transcode ไม่ใช่ปล่อยผ่านช่องเดียวกับเอกสาร)
 */
export const BLOCKED_EXTENSIONS = [
  "svg", "html", "htm", "js", "mjs",
  "exe", "msi", "bat", "cmd", "com", "scr", "ps1", "sh",
  "docm", "xlsm", "pptm",
  "zip", "rar", "7z",
];

/** ค่า accept ของ <input type="file"> — กันคนเลือกไฟล์ผิดชนิดตั้งแต่ต้น */
export const ACCEPT_ALL = ALLOWED_TYPES.join(",");
export const ACCEPT_IMAGE = ALLOWED_IMAGE_TYPES.join(",");

const extOf = (name = "") => String(name).split(".").pop().toLowerCase();
const isImage = (file) => ALLOWED_IMAGE_TYPES.includes(file?.type);

export const formatBytes = (n) => {
  if (!Number.isFinite(n)) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

/**
 * ตรวจไฟล์ก่อนอัป — คืน { ok, message }
 * @param {File}    file
 * @param {object}  opts
 * @param {boolean} opts.imagesOnly  true = รับเฉพาะรูป (เช่นรูปโปรไฟล์/รูปสินค้า)
 */
export const validateFile = (file, { imagesOnly = false } = {}) => {
  if (!file) return { ok: false, message: "ไม่พบไฟล์" };

  const ext = extOf(file.name);
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return { ok: false, message: `ไม่รองรับไฟล์ .${ext} ด้วยเหตุผลด้านความปลอดภัย` };
  }

  const allowed = imagesOnly ? ALLOWED_IMAGE_TYPES : ALLOWED_TYPES;
  // ⚠️ บางเบราว์เซอร์/บางเครื่องส่ง type มาเป็นค่าว่าง (เช่น .heic บน Windows) — ตกลงมาเช็คนามสกุลแทน
  const typeOk = file.type
    ? allowed.includes(file.type)
    : (imagesOnly ? ["jpg", "jpeg", "png", "webp", "heic", "heif"] : ["jpg", "jpeg", "png", "webp", "heic", "heif", "pdf", "doc", "docx", "xls", "xlsx"]).includes(ext);

  if (!typeOk) {
    return {
      ok: false,
      message: imagesOnly
        ? "รองรับเฉพาะรูปภาพ (JPG, PNG, WebP, HEIC)"
        : "รองรับเฉพาะรูปภาพ (JPG, PNG, WebP, HEIC) และเอกสาร (PDF, Word, Excel)",
    };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      message: `ไฟล์ใหญ่เกินไป (${formatBytes(file.size)}) — จำกัดที่ ${MAX_UPLOAD_MB} MB ต่อไฟล์`,
    };
  }

  return { ok: true, message: "" };
};

/** เบราว์เซอร์รองรับ WebP ตอน encode ไหม — เช็คครั้งเดียวแล้วจำไว้ */
let webpSupport = null;
const supportsWebp = () => {
  if (webpSupport !== null) return webpSupport;
  try {
    const c = document.createElement("canvas");
    c.width = 1; c.height = 1;
    webpSupport = c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    webpSupport = false;
  }
  return webpSupport;
};

/**
 * บีบอัดรูปก่อนอัปโหลด
 *
 * ⚠️ ใช้ createImageBitmap(..., { imageOrientation: "from-image" }) เพื่อให้เคารพ EXIF orientation
 * ถ้าวาดลง canvas ตรงๆ โดยไม่สนใจ EXIF รูปถ่ายแนวตั้งจากมือถือจะ "ตะแคง" หลังบีบอัด ซึ่งเป็นบั๊ก
 * คลาสสิกของการบีบอัดรูปฝั่งเบราว์เซอร์
 *
 * ⚠️ คืนไฟล์เดิมกลับไปเมื่อ: ไม่ใช่รูป / เป็น HEIC หรือ GIF (เบราว์เซอร์ decode ไม่ได้ หรือบีบแล้ว
 * ภาพเคลื่อนไหวหาย) / ไฟล์เล็กอยู่แล้ว / บีบแล้วไม่ได้เล็กลง — ปลอดภัยกว่าเสี่ยงทำไฟล์เสีย
 */
export const compressImage = async (file, { maxEdge = 1920, quality = 0.75 } = {}) => {
  if (!file || !isImage(file)) return file;
  // HEIC/HEIF: เบราว์เซอร์ส่วนใหญ่ decode ไม่ได้ ปล่อยผ่านให้ server จัดการ
  if (file.type === "image/heic" || file.type === "image/heif") return file;
  if (file.size <= SKIP_COMPRESS_BELOW) return file;
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") return file;

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const { width, height } = bitmap;
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    // คุณภาพการย่อ — ค่าเริ่มต้นของเบราว์เซอร์ทำให้ขอบหยักเวลาย่อเยอะๆ
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const mime = supportsWebp() ? "image/webp" : "image/jpeg";
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
    if (!blob) return file;

    // บีบแล้วไม่เล็กลง (เช่นรูปที่บีบมาดีอยู่แล้ว) — ใช้ต้นฉบับดีกว่า
    if (blob.size >= file.size) return file;

    const ext = mime === "image/webp" ? "webp" : "jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.${ext}`, { type: mime, lastModified: Date.now() });
  } catch {
    // decode/encode พังด้วยเหตุใดก็ตาม → ส่งต้นฉบับไป ดีกว่าอัปไม่ได้เลย
    return file;
  }
};

/**
 * ตัวช่วยหลักที่ทุกจุดควรเรียก — ตรวจ + บีบอัด ในขั้นตอนเดียว
 * @returns {Promise<{ ok: boolean, file?: File, message?: string, saved?: number }>}
 */
export const prepareUploadFile = async (file, opts = {}) => {
  const check = validateFile(file, opts);
  if (!check.ok) return { ok: false, message: check.message };

  const out = await compressImage(file, opts);
  return { ok: true, file: out, saved: file.size - out.size };
};

/** ทำทีละหลายไฟล์ — คืนรายการที่ผ่าน กับรายการที่ไม่ผ่านพร้อมเหตุผล */
export const prepareUploadFiles = async (files, opts = {}) => {
  const accepted = [];
  const rejected = [];
  for (const f of Array.from(files || [])) {
    // eslint-disable-next-line no-await-in-loop -- บีบอัดทีละไฟล์โดยตั้งใจ ไม่ให้กิน CPU/RAM พร้อมกันทั้งหมด
    const r = await prepareUploadFile(f, opts);
    if (r.ok) accepted.push(r.file);
    else rejected.push({ name: f.name, message: r.message });
  }
  return { accepted, rejected };
};
