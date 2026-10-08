/**
 * lazyWithRetry — React.lazy ที่ "ไม่ทิ้งจอขาว" เมื่อโหลดไฟล์ของหน้าไม่สำเร็จ
 *
 * 🐛 ปัญหาที่แก้ (8 ต.ค. 2569 ผู้ใช้: "ระบบเปิดมาชอบเป็นหน้าขาวว่างๆ ต้องคอยรีเฟรชถึงจะมา"):
 *   ทุกหน้าโหลดแบบแยกไฟล์ (lazy) ชื่อไฟล์มีรหัสต่อท้ายที่เปลี่ยนทุกครั้งที่ deploy
 *   • มือถือ/แท็บที่เปิดค้างไว้ หรือเบราว์เซอร์ที่จำ index.html รุ่นเก่า → ขอไฟล์ชื่อเก่าที่ถูกลบไปแล้ว
 *   • เน็ตมือถือหลุดชั่วขณะตอนเปิดแอป → โหลดไฟล์ไม่ครบ
 *   import() ล้ม → React โยน error → ไม่มีใครรับ → ทั้งแอปถูกถอดออก = จอขาว จนกว่าจะกดรีเฟรชเอง
 * ✅ ลองโหลดซ้ำ 2 ครั้ง (เผื่อเน็ตสะดุด) → ยังไม่ได้ = ไฟล์รุ่นเก่าหายไปแล้ว → รีโหลดหน้าให้เอง 1 ครั้ง
 *   (ได้ index.html รุ่นใหม่ที่ชี้ไฟล์ถูกชื่อ) · กันวนรีโหลดไม่รู้จบด้วยเวลาที่จำไว้ใน sessionStorage
 *   ถ้ารีโหลดแล้วยังล้มอีก ปล่อย error ให้ AppErrorBoundary แสดงหน้า "โหลดใหม่" แทนจอขาว
 */
import { lazy } from "react";

const RELOAD_KEY = "tt-chunk-reload-at";
const RELOAD_GAP_MS = 30_000;

export const isChunkLoadError = (err) => {
  const msg = String(err?.message || err || "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [\w-]+ failed|ChunkLoadError|Unable to preload CSS/i.test(msg);
};

/** รีโหลดหน้าเพื่อเอาไฟล์รุ่นใหม่ — คืน true ถ้าสั่งรีโหลดแล้ว (ไม่เกิน 1 ครั้งต่อ 30 วินาที) */
export const reloadForFreshBuild = () => {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_GAP_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* sessionStorage ใช้ไม่ได้ (โหมดส่วนตัวบางเบราว์เซอร์) — ยังรีโหลดได้ แต่ไม่มีตัวกันวน จึงไม่รีโหลด */
    return false;
  }
  window.location.reload();
  return true;
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export const importWithRetry = async (factory, retries = 2) => {
  try {
    return await factory();
  } catch (err) {
    if (retries > 0) {
      await wait(retries === 2 ? 400 : 1200);
      return importWithRetry(factory, retries - 1);
    }
    if (isChunkLoadError(err) && reloadForFreshBuild()) {
      // ค้างไว้ระหว่างรอหน้ารีโหลด — ไม่โยน error ให้จอกระพริบหน้า error ก่อน
      return new Promise(() => {});
    }
    throw err;
  }
};

export default function lazyWithRetry(factory) {
  return lazy(() => importWithRetry(factory));
}
