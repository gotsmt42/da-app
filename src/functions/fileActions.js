import Swal from "sweetalert2";

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

// ✅ แชร์ไฟล์จริง (ตัวรูป/PDF) ไม่ใช่แค่ลิงก์ — ใช้ Web Share API level 2 (navigator.share
// รับ files ได้) แอปปลายทาง (LINE ฯลฯ) จะได้ไฟล์แนบจริงเหมือนเลือกรูปจากเครื่องส่งเอง
// ไม่ใช่แค่การ์ดพรีวิวลิงก์
//
// สำคัญ: ทุกขั้นตอนแยก try/catch ของตัวเอง ไม่ใช่ try ก้อนเดียวทั้งฟังก์ชัน — เดิมถ้าขั้น
// "แชร์ไฟล์จริง" throw (เช่น NotAllowedError เพราะ user-activation ของเบราว์เซอร์หมดอายุ
// ไปแล้วตอนที่ await fetch() เสร็จ โดยเฉพาะ Safari/iOS ที่เข้มงวดเรื่องนี้มาก) โค้ดจะกระโดด
// ไป catch ก้อนนอกแล้วแจ้ง "แชร์ไม่สำเร็จ" ทันที โดยไม่เคยลองแชร์ลิงก์ต่อเลย ทำให้ดูเหมือน
// "แชร์ไม่ได้" ทั้งที่จริงๆ ยังมีทางแชร์ลิงก์สำรองที่ใช้ได้อยู่ — ตอนนี้ไล่ลองทีละชั้นจนกว่า
// จะสำเร็จ จบท้ายด้วยการเปิดไฟล์ในแท็บใหม่เป็นทางเลือกสุดท้ายที่ไม่มีวันล้มเหลว
export const shareFile = async (url, fileName) => {
  if (!url) return;
  const title = fileName || "ไฟล์เอกสาร";

  // ── ชั้นที่ 1: แชร์ไฟล์จริง ──
  try {
    const response = await fetch(url);
    if (response.ok) {
      const rawBlob = await response.blob();
      const mime = guessMimeType(fileName) || rawBlob.type || "application/octet-stream";
      const blob = mime && mime !== rawBlob.type ? new Blob([rawBlob], { type: mime }) : rawBlob;
      const file = new File([blob], fileName || "file", { type: mime });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title });
        return; // สำเร็จ
      }
    }
  } catch (err) {
    if (err?.name === "AbortError") return; // ผู้ใช้กดยกเลิกเอง ไม่ต้องลองวิธีอื่นต่อ
    console.warn("shareFile: แชร์ไฟล์จริงไม่สำเร็จ ลองแชร์ลิงก์แทน —", err);
  }

  // ── ชั้นที่ 2: แชร์ลิงก์ผ่าน Web Share API ──
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return; // สำเร็จ
    } catch (err) {
      if (err?.name === "AbortError") return;
      console.warn("shareFile: แชร์ลิงก์ไม่สำเร็จ ลองคัดลอกแทน —", err);
    }
  }

  // ── ชั้นที่ 3: คัดลอกลิงก์ใส่คลิปบอร์ด ──
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(url);
      Swal.fire({ title: "คัดลอกลิงก์ไฟล์แล้ว", text: "เบราว์เซอร์นี้ไม่รองรับแชร์ไฟล์โดยตรง", icon: "success", timer: 1800, showConfirmButton: false });
      return; // สำเร็จ
    } catch (err) {
      console.warn("shareFile: คัดลอกคลิปบอร์ดไม่สำเร็จ —", err);
    }
  }

  // ── ทางเลือกสุดท้าย: เปิดไฟล์ในแท็บใหม่ให้ผู้ใช้บันทึก/แชร์เอง ──
  window.open(url, "_blank");
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
