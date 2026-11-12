import Swal from "@/shared/ui/swal";
import { Capacitor } from "@capacitor/core";

// ✅ ตรวจว่าเป็นมือถือ/แท็บเล็ตหรือไม่ — ใช้ตัดสินใจว่าจะเสนอปุ่มไหนเป็นตัวหลักในเมนูแชร์
// เหตุผล: navigator.share ฝั่ง "แชร์ไฟล์จริง" ใช้ได้ดีบนมือถือเท่านั้น (Android/iOS ที่แอป
// อย่าง LINE ลงทะเบียนตัวเองเป็นปลายทางรับแชร์ของระบบไว้) ส่วนบนคอมพิวเตอร์ (Windows/Mac)
// navigator.share จะเปิดแผง Share ของ OS เอง ซึ่ง LINE บนเดสก์ท็อปไม่ได้ลงทะเบียนเป็น
// Share Target ของ OS แบบแอปมือถือ จึงไม่มีทางโผล่ให้เลือกได้เลยไม่ว่าจะเขียนโค้ดแบบไหน —
// ทางเดียวที่การันตีว่าเข้าถึง LINE ได้จริงบนเดสก์ท็อปคือ endpoint "LINE it!" ของ LINE เอง
export const isMobileDevice = () =>
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");

// เดาชนิดไฟล์จากนามสกุล เพื่อบังคับ MIME type ให้ถูกต้องตอนสร้าง blob เอง — เผื่อ response
// จริงจาก Cloudinary ส่ง Content-Type มาไม่ตรง (เช่น octet-stream) ทำให้เบราว์เซอร์เดาไม่ออกว่า
// ควรแสดงผล/แชร์เป็นไฟล์ชนิดไหน
const guessMimeType = (fileName = "") => {
  const lower = (fileName || "").toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return "";
};

// ✅ ดึงไฟล์มาเป็น blob ก่อนเปิด/พิมพ์ แทนที่จะเปิด url ตรงๆ — ไฟล์ resource_type "raw" บน
// Cloudinary (โดยเฉพาะ PDF เก่าที่อัปโหลดไว้ก่อนแก้ backend) มักส่ง header บังคับดาวน์โหลด
// (Content-Disposition: attachment) แทนที่จะแสดงผลในแท็บ ทำให้เปิดแท็บว่างแล้วสั่ง print()
// ไม่มีผลอะไรเลย (เดิมที่พิมพ์ไม่ได้เพราะจุดนี้) — ห่อเป็น blob: URL ของเราเอง (คนละ header
// จาก server แล้ว) การันตีว่าเปิดดู + พิมพ์ได้จริงเสมอ
export const printFile = async (url, fileName) => {
  if (!url) return;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Fetch failed");
    const rawBlob = await response.blob();
    const mime = guessMimeType(fileName) || rawBlob.type;
    const blob = mime && mime !== rawBlob.type ? new Blob([rawBlob], { type: mime }) : rawBlob;
    const blobUrl = URL.createObjectURL(blob);

    const win = window.open(blobUrl, "_blank");
    if (!win) {
      Swal.fire("เปิดหน้าต่างไม่สำเร็จ", "เบราว์เซอร์บล็อกป๊อปอัป กรุณาอนุญาตแล้วลองใหม่", "warning");
      URL.revokeObjectURL(blobUrl);
      return;
    }
    const tryPrint = () => { try { win.print(); } catch { /* บางเบราว์เซอร์บล็อกการสั่งพิมพ์ */ } };
    win.onload = tryPrint;
    setTimeout(tryPrint, 800);
    // เผื่อเวลาให้กล่องพิมพ์เปิดค้างไว้ก่อนค่อยเคลียร์ blob ทิ้ง
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } catch (err) {
    console.error("Print error:", err);
    Swal.fire("พิมพ์ไม่สำเร็จ", "ไม่สามารถโหลดไฟล์เพื่อพิมพ์ได้ กรุณาลองดาวน์โหลดแล้วพิมพ์จากเครื่องแทน", "error");
  }
};

// ✅ แชร์ไฟล์จริง (ตัวรูป/PDF) ไม่ใช่แค่ลิงก์ — Web Share API level 2 (navigator.share รับ files) · LINE ฯลฯ ได้ไฟล์แนบจริง
/**
 * 🐛 (12 พ.ย. 2569 ผู้ใช้: "กดแชร์ไม่ได้ ไม่ขึ้นแชร์ แต่ไปกดเป็นเปิดแทน")
 *    เดิมเมื่อแชร์ไม่ได้ทุกชั้น ตกไปที่ window.open (เปิดไฟล์) แบบเงียบๆ — เกิดได้ 3 กรณี:
 *      1) ในแอปมือถือ (Capacitor WebView) ไม่มี navigator.share → ใช้แผงแชร์ของเครื่องผ่าน deliverFile แทน
 *      2) เว็บที่ไม่ใช่ https (เช่น ที่อยู่ทดสอบ http://10.x.x.x) เบราว์เซอร์ปิด share/clipboard ทั้งหมด → บอกตรงๆ + ดาวน์โหลดให้
 *      3) โหลดไฟล์นานจนหมดจังหวะแตะ (NotAllowedError) → ถามซ้ำด้วยปุ่ม "แชร์" ให้แตะอีกครั้ง (ได้จังหวะแตะใหม่)
 *    ✅ ไม่เปิดไฟล์แทนการแชร์อีก
 */
const fetchAsFile = async (url, fileName) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Fetch failed");
  const rawBlob = await response.blob();
  const mime = guessMimeType(fileName) || rawBlob.type || "application/octet-stream";
  const blob = mime !== rawBlob.type ? new Blob([rawBlob], { type: mime }) : rawBlob;
  return { blob, file: new File([blob], fileName || "file", { type: mime }) };
};

const canShareFiles = (file) => {
  try { return Boolean(navigator.canShare?.({ files: [file] })); } catch { return false; }
};

const saveBlob = (blob, fileName) => {
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl; a.download = fileName || "download";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
};

export const shareFile = async (url, fileName) => {
  if (!url) return;
  const title = fileName || "ไฟล์เอกสาร";

  // ── ในแอปมือถือ: แผงแชร์ของเครื่อง (LINE ฯลฯ ได้ไฟล์จริง) ──
  if (Capacitor.isNativePlatform()) {
    try {
      const { blob } = await fetchAsFile(url, fileName);
      const { deliverFile } = await import("@/native/nativeBridge");
      await deliverFile(blob, fileName);
    } catch (err) {
      console.warn("shareFile(native):", err);
      Swal.fire({ toast: true, position: "top", icon: "error", title: "แชร์ไม่สำเร็จ ลองใหม่อีกครั้ง", showConfirmButton: false, timer: 2500 });
    }
    return;
  }

  // ── เว็บที่ไม่ใช่ https / เบราว์เซอร์ไม่รองรับแชร์ ──
  if (typeof navigator.share !== "function") {
    const insecure = !window.isSecureContext;
    try { saveBlob((await fetchAsFile(url, fileName)).blob, fileName); } catch { /* ดาวน์โหลดไม่ได้ก็แจ้งอย่างเดียว */ }
    if (!insecure && navigator.clipboard) {
      try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
    }
    Swal.fire({
      icon: "info",
      title: "เครื่องนี้แชร์ตรงไม่ได้",
      text: insecure
        ? "หน้านี้เปิดจากที่อยู่ทดสอบ (http) เบราว์เซอร์จึงปิดการแชร์ — ดาวน์โหลดไฟล์ให้แล้ว · ใช้งานจริงที่ da-app.vercel.app หรือในแอปแชร์ได้ปกติ"
        : "ดาวน์โหลดไฟล์ให้แล้ว และคัดลอกลิงก์ไว้ให้ — แนบส่งเองได้เลย",
      confirmButtonText: "ตกลง",
    });
    return;
  }

  // ── แชร์ไฟล์จริง (รูป/PDF) ──
  let file = null;
  try { ({ file } = await fetchAsFile(url, fileName)); } catch (err) { console.warn("shareFile: โหลดไฟล์ไม่สำเร็จ แชร์ลิงก์แทน —", err); }
  const data = file && canShareFiles(file) ? { files: [file], title } : { title, url };
  const tryShare = async (d) => {
    try { await navigator.share(d); return "ok"; } catch (err) {
      if (err?.name === "AbortError") return "ok"; // ผู้ใช้ปิดแผงแชร์เอง
      if (err?.name === "NotAllowedError") return "again";
      // บาง Android ไม่รับ title คู่กับไฟล์ → ลองไฟล์อย่างเดียว
      if (d.files) { try { await navigator.share({ files: d.files }); return "ok"; } catch (e2) { if (e2?.name === "AbortError") return "ok"; if (e2?.name === "NotAllowedError") return "again"; } }
      return "fail";
    }
  };
  const r = await tryShare(data);
  if (r === "ok") return;
  if (r === "again") {
    // โหลดไฟล์นานจนเบราว์เซอร์ไม่นับว่าเป็นการแตะ — ให้แตะปุ่มแชร์อีกครั้ง (ไฟล์โหลดเสร็จแล้ว)
    const res = await Swal.fire({
      title: "ไฟล์พร้อมแล้ว", text: title, icon: "success",
      showCancelButton: true, confirmButtonText: "แชร์", cancelButtonText: "ยกเลิก",
      preConfirm: () => tryShare(data),
    });
    if (!res.isConfirmed || res.value === "ok") return;
  }
  if (file) saveBlob(file, fileName);
  Swal.fire({ icon: "info", title: "แชร์ไม่สำเร็จ", text: "ดาวน์โหลดไฟล์ให้แล้ว — แนบส่งเองได้เลย", confirmButtonText: "ตกลง" });
};

// ✅ แชร์ "ลิงก์" ไปยัง LINE โดยเฉพาะผ่าน LINE it! share endpoint ทางการ — นี่คือทางเดียวที่
// รับประกันว่าเข้าถึง LINE ได้จริงบนคอมพิวเตอร์/เดสก์ท็อป เพราะแผง Share ของ Windows/Mac
// (ที่ shareFile() ด้านบนเรียกผ่าน navigator.share) ไม่มี LINE Desktop ให้เลือกเลย (LINE
// เวอร์ชันคอมไม่ได้ลงทะเบียนเป็น Share Target ของ OS แบบแอปมือถือ) endpoint นี้รับได้แค่ลิงก์
// ไม่ใช่ไฟล์จริง — ถ้าอยากส่งตัวไฟล์จริงเข้า LINE บนคอม ต้องดาวน์โหลดแล้วลาก/แนบเข้าไปเองเท่านั้น
export const shareToLine = (url, fileName) => {
  if (!url) return;
  const shareUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(fileName || "ไฟล์เอกสาร")}`;
  window.open(shareUrl, "_blank", "noopener,noreferrer,width=500,height=600");
};
