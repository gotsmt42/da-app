/**
 * signatureImage — แปลงลายเซ็น (วาดเอง / รูปที่อัปโหลด) ให้เป็น PNG พื้นหลังโปร่งใสพร้อมฝังใน PDF
 *
 * ✅ ทำไมต้องลบพื้นหลัง: คนส่วนใหญ่ "เซ็นบนกระดาษแล้วถ่ายรูป" — รูปนั้นมีพื้นขาว/เทาติดมาเต็มกรอบ
 * ถ้าเอาไปแปะในเอกสารตรงๆ สี่เหลี่ยมพื้นขาวจะทับเส้นลายเซ็นและข้อความรอบๆ ดูเหมือนตัดแปะ
 * ไม่มืออาชีพ · ที่นี่จึงทำพื้นให้โปร่งใสและครอปขอบว่างออกให้เหลือแต่เส้นหมึก
 *
 * ⚠️ ทุกอย่างทำในเบราว์เซอร์ก่อนส่งขึ้น server (server ตรวจซ้ำว่าเป็น PNG จริงและขนาดไม่เกิน)
 */

/** ลายเซ็นที่ยาวกว่านี้ไม่ได้ชัดขึ้น แต่ทำให้ไฟล์ PDF อืดและกินโควตาฐานข้อมูล */
const MAX_W = 900;
const MAX_H = 300;
/** ขอบเผื่อรอบเส้นหมึกหลังครอป (px) — ชิดขอบเป๊ะแล้วดูอึดอัดเวลาเอาไปวางบนเส้นเซ็น */
const PAD = 6;

const canvasOf = (w, h) => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};

/**
 * ครอปพื้นที่โปร่งใสรอบนอกออก เหลือเฉพาะกรอบที่มีหมึก
 * @returns {HTMLCanvasElement|null} null = ไม่มีหมึกเลย (ผู้ใช้ยังไม่ได้เซ็น)
 */
export const trimTransparent = (source, pad = PAD) => {
  const { width: w, height: h } = source;
  const ctx = source.getContext("2d");
  const { data } = ctx.getImageData(0, 0, w, h);
  let top = h; let left = w; let right = -1; let bottom = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      // อัลฟ่าต่ำๆ คือขอบเบลอของเส้น ไม่ใช่หมึกจริง — กันครอปกว้างเกินเพราะ noise จากรูปถ่าย
      if (data[(y * w + x) * 4 + 3] > 24) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0 || bottom < 0) return null;
  const x0 = Math.max(0, left - pad);
  const y0 = Math.max(0, top - pad);
  const cw = Math.min(w, right + pad + 1) - x0;
  const ch = Math.min(h, bottom + pad + 1) - y0;
  const out = canvasOf(cw, ch);
  out.getContext("2d").drawImage(source, x0, y0, cw, ch, 0, 0, cw, ch);
  return out;
};

/** ย่อให้ไม่เกินกรอบที่กำหนด (ไม่ขยายรูปเล็กให้ใหญ่ขึ้น — จะได้เส้นแตก) */
const fit = (source) => {
  const scale = Math.min(1, MAX_W / source.width, MAX_H / source.height);
  if (scale === 1) return source;
  const out = canvasOf(source.width * scale, source.height * scale);
  const ctx = out.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return out;
};

/**
 * ลายเซ็นที่ผู้ใช้วาดบน canvas → PNG dataURL (พื้นโปร่งใสอยู่แล้วเพราะวาดบน canvas เปล่า)
 * @returns {string} "" = ยังไม่ได้วาดอะไรเลย
 */
export const canvasToSignaturePng = (canvas) => {
  const trimmed = trimTransparent(canvas);
  if (!trimmed) return "";
  return fit(trimmed).toDataURL("image/png");
};

/**
 * รูปลายเซ็นที่อัปโหลด (ถ่ายจากกระดาษ / สแกน) → PNG พื้นโปร่งใส
 *
 * วิธีทำ: พิกเซลที่ "สว่าง" = กระดาษ → โปร่งใส · พิกเซลเข้ม = หมึก → คงไว้และไล่ความทึบตามความเข้ม
 * ⚠️ ไล่ระดับ (ไม่ใช่ตัดขาวดำแบบ 0/1) เพราะการตัดขาวดำทำให้เส้นเป็นรอยหยักและลายเซ็นบางๆ ขาดหาย
 * ⚠️ ถ่ายในที่แสงน้อยทั้งรูปจะเข้ม — threshold จึงคิดจาก "ความสว่างของกระดาษในรูปนั้น" ไม่ใช่ค่าคงที่
 */
export const fileToSignaturePng = (file) => new Promise((resolve, reject) => {
  if (!file) { reject(new Error("ไม่พบไฟล์")); return; }
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
    reject(new Error("รองรับไฟล์รูป PNG / JPG / WEBP เท่านั้น"));
    return;
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    try {
      const base = canvasOf(img.naturalWidth, img.naturalHeight);
      const ctx = base.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const frame = ctx.getImageData(0, 0, base.width, base.height);
      const px = frame.data;

      // ความสว่างของ "กระดาษ" = ค่าที่พบบ่อยในโซนสว่าง (ใช้ percentile 90 กันจุดสะท้อนแสง)
      const lum = new Uint8Array(px.length / 4);
      for (let i = 0, j = 0; i < px.length; i += 4, j += 1) {
        lum[j] = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
      }
      const hist = new Uint32Array(256);
      for (let j = 0; j < lum.length; j += 1) hist[lum[j]] += 1;
      let acc = 0; let paper = 255;
      for (let v = 255; v >= 0; v -= 1) {
        acc += hist[v];
        if (acc > lum.length * 0.1) { paper = v; break; }
      }
      const inkAt = Math.max(40, paper * 0.55); // เข้มกว่านี้ = หมึกเต็มที่
      const paperAt = Math.max(inkAt + 10, paper * 0.88); // สว่างกว่านี้ = กระดาษ (โปร่งใส)

      for (let i = 0, j = 0; i < px.length; i += 4, j += 1) {
        const v = lum[j];
        let alpha;
        if (v >= paperAt) alpha = 0;
        else if (v <= inkAt) alpha = 255;
        else alpha = Math.round(((paperAt - v) / (paperAt - inkAt)) * 255);
        // ✅ ทำหมึกเป็นสีน้ำเงินเข้มเสมอ — ลายเซ็นในรูปถ่ายมักออกเทาซีด พอย่อลงไปในเอกสารแล้วจางหาย
        px[i] = 17; px[i + 1] = 24; px[i + 2] = 64;
        px[i + 3] = px[i + 3] === 0 ? 0 : alpha;
      }
      ctx.putImageData(frame, 0, 0);
      const trimmed = trimTransparent(base);
      if (!trimmed) { reject(new Error("ไม่พบลายเส้นในรูปนี้ — ลองถ่ายให้ชัดขึ้นในที่สว่าง")); return; }
      resolve(fit(trimmed).toDataURL("image/png"));
    } catch (err) {
      reject(err instanceof Error ? err : new Error("อ่านรูปไม่สำเร็จ"));
    }
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error("เปิดไฟล์รูปไม่สำเร็จ"));
  };
  img.src = url;
});

/** ขนาดไฟล์ dataURL แบบอ่านง่าย (ใช้เตือนผู้ใช้ก่อนบันทึก) */
export const dataUrlBytes = (dataUrl) => {
  const b64 = String(dataUrl || "").split(",")[1] || "";
  return Math.round((b64.length * 3) / 4);
};
