/**
 * pdfShare.js — ปุ่ม "แชร์" ของหน้าต่างเอกสาร PDF ทุกตัว (ใบเบิก/เคลม · เอกสารงาน · PDF ทั่วไป) ใช้ตัวเดียวกัน
 *
 * 🔁 (4 พ.ย. 2569 ผู้ใช้: "หน้าใบเบิก เคลม หรือใน pdf ต่างๆ ในหน้าจอมือถือ กดแชร์ไม่ได้บางกรณี ขึ้นแจ้งเตือนเหมือนบัค
 *    เบราว์เซอร์สั่งพิมพ์ไม่ได้ ทั้งที่กดแชร์ แก้ไขให้สมบูรณ์")
 *    🐛 เดิม 3 จุด:
 *       1) เบราว์เซอร์ในแอป (LINE ฯลฯ) ถูกบล็อกทันที + ขึ้นข้อความเรื่อง "สั่งพิมพ์ไม่ได้" ทั้งที่กดแชร์
 *       2) บาง Android ปฏิเสธการแชร์ไฟล์ที่แนบ title/text มาด้วย → "แชร์ไม่สำเร็จ" ทั้งที่แชร์ไฟล์อย่างเดียวได้
 *       3) แชร์ไม่ได้ = ทิ้งให้ผู้ใช้ไปกดดาวน์โหลดเอง
 *    ✅ ลองแชร์จริงก่อนเสมอ → ไม่ผ่านลองแบบไฟล์อย่างเดียว → ยังไม่ได้ = ดาวน์โหลดให้อัตโนมัติ + บอกตรงๆ (เรื่องแชร์ ไม่ใช่เรื่องพิมพ์)
 * ⚠️ ห้าม await อะไรก่อน navigator.share ครั้งแรก — Safari ยอมให้แชร์เฉพาะในจังหวะที่ผู้ใช้แตะปุ่ม
 *    (ภาพหน้าเอกสารจึงต้องเก็บ blob ไว้ตั้งแต่ตอนวาด แล้วส่ง pages เข้ามาตรงๆ)
 */
import { Capacitor } from "@capacitor/core";
import { isInAppBrowser } from "@/shared/utils/pdfRaster";

const canShare = (files) => {
  try { return Boolean(navigator?.canShare?.({ files })); } catch { return false; }
};

/**
 * @param blob / fileName  ไฟล์ PDF
 * @param pages            [{ blob }] ภาพหน้าเอกสาร (ถ้ามี) — ใช้แทนเมื่อเครื่องแชร์ PDF ไม่ได้แต่แชร์รูปได้
 * @param text             ข้อความประกอบการแชร์
 * @param download         () => void — ดาวน์โหลดไฟล์ (ทางสำรอง)
 * @param notify           (msg) => void — แสดงข้อความแจ้งในหน้าต่าง
 */
export async function sharePdf({ blob, fileName, pages, text, download, notify }) {
  if (!blob) return;
  const fallback = (msg) => { download?.(); notify?.(msg); };
  /* ✅ (4 พ.ย. 2569 ผู้ใช้: "ปกติแชร์ได้ แก้ไขให้แชร์ได้") ในแอปมือถือ (Capacitor · Android WebView) ไม่มี navigator.share
     — เดิม UA "; wv)" ถูกนับเป็น "เบราว์เซอร์ในแอป" แล้วบล็อกการแชร์ (ขึ้นข้อความเรื่องพิมพ์)
     → ใช้แผงแชร์ของเครื่องผ่านปลั๊กอิน Share ตัวเดียวกับการดาวน์โหลดไฟล์ในแอป (nativeBridge.deliverFile) */
  if (Capacitor.isNativePlatform()) {
    try {
      const { deliverFile } = await import("@/native/nativeBridge");
      await deliverFile(blob, fileName);
    } catch {
      notify?.("แชร์ไม่สำเร็จ — ลองใหม่อีกครั้ง");
    }
    return;
  }
  if (!window.isSecureContext || typeof navigator.share !== "function") {
    fallback(isInAppBrowser()
      ? "เบราว์เซอร์ในแอป (เช่น LINE) แชร์ไฟล์ไม่ได้ — ดาวน์โหลดไฟล์ให้แล้ว แนบส่งเองได้ หรือกด ⋮ \"เปิดในเบราว์เซอร์\" แล้วกดแชร์อีกครั้ง"
      : "เบราว์เซอร์นี้แชร์ไฟล์ไม่ได้ — ดาวน์โหลดไฟล์ให้แล้ว แนบส่งเองได้เลย");
    return;
  }
  const base = String(fileName || "เอกสาร.pdf").replace(/\.pdf$/i, "");
  let files = [new File([blob], fileName || `${base}.pdf`, { type: "application/pdf" })];
  if (!canShare(files) && pages?.length) {
    const imgs = pages.map((p, i) => new File([p.blob], `${base}${pages.length > 1 ? `-${i + 1}` : ""}.${p.blob.type === "image/png" ? "png" : "jpg"}`, { type: p.blob.type || "image/jpeg" }));
    files = canShare(imgs) ? imgs : null;
  } else if (!canShare(files)) {
    files = null;
  }
  if (!files) {
    fallback("เครื่องนี้แชร์ไฟล์ PDF โดยตรงไม่ได้ — ดาวน์โหลดไฟล์ให้แล้ว แนบส่งเองได้เลย");
    return;
  }
  const attempts = [{ files, title: fileName, text }, { files }];
  for (const data of attempts) {
    try {
      // eslint-disable-next-line no-await-in-loop -- ลองทีละแบบ (แบบแรกไม่ผ่าน → แบบไฟล์อย่างเดียว)
      await navigator.share(data);
      return;
    } catch (err) {
      if (err?.name === "AbortError") return; // ผู้ใช้ปิดแผงแชร์เอง — ไม่ใช่ข้อผิดพลาด
    }
  }
  fallback("แชร์ไม่สำเร็จในเบราว์เซอร์นี้ — ดาวน์โหลดไฟล์ให้แล้ว แนบส่งเองได้เลย");
}
