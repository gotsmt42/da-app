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

// 🔁 (10 พ.ย. 2569 ผู้ใช้: "ถ้าเปิดปัญหาอย่างนี้จะแก้ไม่หาย · เครื่องอื่นเข้าได้ แต่บางเครื่องขึ้นแบบนี้จะยาว")
//    เดิมรีโหลดเองได้ 1 ครั้ง/30 วินาที แล้วขึ้น "มีเวอร์ชันใหม่" ซ้ำ ไม่บอกว่าเป็นอะไร กดโหลดใหม่ก็ได้หน้าเดิม
//    ตอนนี้นับจำนวนครั้งที่ล้มในช่วง 2 นาที: ครั้งที่ 1 = รีโหลดแบบล้างแคช · ครั้งที่ 2 = ล้างข้อมูลค้างในเครื่องแล้วเปิดใหม่ (ไม่ต้องล็อกอินใหม่)
//    ครั้งที่ 3 ขึ้นไป = หยุดรีโหลดเอง แล้วให้หน้าจอบอกสาเหตุที่น่าจะเป็น + ปุ่มแก้ (ไม่วนรีโหลดไม่รู้จบ)
const FAIL_KEY = "tt-chunk-fails";
const FAIL_WINDOW_MS = 120_000;
const AUTO_TRIES = 2;

export const isChunkLoadError = (err) => {
  const msg = String(err?.message || err || "");
  // 🔁 (4 พ.ย. 2569) + "Outdated Optimize Dep" (dev) · ไฟล์ .js ถูกตอบเป็น HTML (หลัง deploy ไฟล์เก่าหาย → ได้ index.html แทน)
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [\w-]+ failed|ChunkLoadError|Unable to preload CSS|Outdated Optimize Dep|Expected a JavaScript.*MIME type|is not a valid JavaScript MIME type/i.test(msg);
};

/** จำนวนครั้งที่โหลดไฟล์ไม่สำเร็จติดกัน (ภายใน 2 นาที) — null = sessionStorage ใช้ไม่ได้ */
export const chunkFailCount = () => {
  try {
    const v = JSON.parse(sessionStorage.getItem(FAIL_KEY) || "null");
    return v && Date.now() - v.at < FAIL_WINDOW_MS ? Number(v.n) || 0 : 0;
  } catch {
    return null;
  }
};
const setFails = (n) => { try { sessionStorage.setItem(FAIL_KEY, JSON.stringify({ n, at: Date.now() })); } catch { /* ใช้ไม่ได้ */ } };
/** ล้างตัวนับ (ผู้ใช้กดแก้เอง) — ⚠️ ไม่ล้างตอนโหลดไฟล์อื่นสำเร็จ ไม่งั้นหน้าที่เสียหน้าเดียวจะรีโหลดวนไม่จบ */
export const clearChunkFails = () => { try { sessionStorage.removeItem(FAIL_KEY); } catch { /* ใช้ไม่ได้ */ } };

/** รีโหลดหน้าเพื่อเอาไฟล์รุ่นใหม่ — คืน true ถ้าสั่งรีโหลดแล้ว (อัตโนมัติไม่เกิน 2 ครั้งใน 2 นาที) */
export const reloadForFreshBuild = () => {
  const n = chunkFailCount();
  // sessionStorage ใช้ไม่ได้ (โหมดส่วนตัวบางเบราว์เซอร์) = ไม่มีตัวกันวน → ไม่รีโหลดเอง ให้ผู้ใช้กดเอง
  if (n === null || n >= AUTO_TRIES) return false;
  setFails(n + 1);
  if (n === 0) hardReload();
  else deepCleanReload();
  return true;
};

/**
 * ล้างข้อมูลค้างในเครื่องแล้วเปิดใหม่ — Cache Storage · Service Worker (ยกเว้นตัวแจ้งเตือน push) · ค่าที่แอปจำไว้
 * ⚠️ เก็บการล็อกอิน (token/payload) ไว้ — ผู้ใช้ไม่ต้องล็อกอินใหม่ · ตัวนับครั้งที่ล้มก็เก็บไว้ (กันวน)
 */
export const deepCleanReload = (path) => {
  const jobs = [];
  try {
    const keep = { token: 1, payload: 1 };
    Object.keys(localStorage).forEach((k) => { if (!keep[k]) localStorage.removeItem(k); });
  } catch { /* ใช้ไม่ได้ */ }
  try {
    const fails = sessionStorage.getItem(FAIL_KEY);
    sessionStorage.clear();
    if (fails) sessionStorage.setItem(FAIL_KEY, fails);
  } catch { /* ใช้ไม่ได้ */ }
  try { if (window.caches?.keys) jobs.push(window.caches.keys().then((ks) => Promise.all(ks.map((k) => window.caches.delete(k))))); } catch { /* ไม่มี */ }
  try {
    if (navigator.serviceWorker?.getRegistrations) {
      jobs.push(navigator.serviceWorker.getRegistrations().then((rs) => Promise.all(
        rs.filter((r) => !String(r.active?.scriptURL || r.installing?.scriptURL || "").includes("push-sw")).map((r) => r.unregister()),
      )));
    }
  } catch { /* ไม่มี */ }
  const go = () => {
    const u = new URL(path || window.location.href, window.location.origin);
    u.searchParams.set("_r", String(Date.now()));
    window.location.replace(u.toString());
  };
  Promise.all(jobs).catch(() => {}).then(go);
  setTimeout(go, 3000); // บางเครื่องคำสั่งล้างแคชค้าง — ไม่รอเกิน 3 วินาที
};

/**
 * ✅ (27 ต.ค. 2569 ผู้ใช้: "ในมือถือเปิดไม่ได้ · คอม/แท็บเล็ตเปิดได้") แอปมือถือ (WebView) บางรุ่นเก็บหน้าแรก (index.html)
 *    รุ่นเก่าไว้ในหน่วยความจำ — reload() ธรรมดาได้หน้าเก่าที่ชี้ไปไฟล์ที่ถูกลบแล้วซ้ำ ติดหน้า "มีเวอร์ชันใหม่" วนไป
 *    โหลดใหม่ด้วยพารามิเตอร์เวลา (?_r=) บังคับขอหน้าใหม่จากเซิร์ฟเวอร์เสมอ + ล้าง Cache Storage ถ้ามี
 */
export const hardReload = () => {
  const go = () => {
    const u = new URL(window.location.href);
    u.searchParams.set("_r", String(Date.now()));
    window.location.replace(u.toString());
  };
  try {
    if (window.caches?.keys) {
      window.caches.keys().then((ks) => Promise.all(ks.map((k) => window.caches.delete(k)))).finally(go);
      return;
    }
  } catch { /* ไม่มี Cache Storage — โหลดใหม่เลย */ }
  go();
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * ✅ (8 ต.ค. 2569 ผู้ใช้: "บางทีหน้าก็โหลดไม่มาเลย ค้าง 'กำลังโหลด…' ต้องรีเฟรช")
 * โหลดไฟล์ที่ "ค้าง" (ไม่สำเร็จและไม่ล้ม — เน็ตมือถือหลุดกลางทาง / เครือข่ายในออฟฟิศ) เดิมรอตลอดไป
 * ตอนนี้ถือว่าล้มเมื่อเกิน 20 วินาที → เข้าขั้นตอนเดียวกับโหลดไม่สำเร็จ (รีโหลดให้เอง 1 ครั้ง / ปุ่ม "โหลดใหม่")
 */
// โหมด dev (เปิดผ่าน LAN จากมือถือ) โหลดไฟล์ทีละหลายร้อยตัวแบบไม่บีบอัด — เผื่อเวลามากกว่า
const IMPORT_TIMEOUT_MS = import.meta.env.DEV ? 60_000 : 20_000;
const TIMEOUT_MSG = "ChunkLoadError: Loading chunk timeout";
const withTimeout = (promise) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error(TIMEOUT_MSG)), IMPORT_TIMEOUT_MS);
  promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
});

export const importWithRetry = async (factory, retries = 2) => {
  try {
    return await withTimeout(factory());
  } catch (err) {
    // ⚠️ ค้างจนหมดเวลา = ลองซ้ำไม่ช่วย (เบราว์เซอร์จำ import เดิมที่ยังค้างอยู่) → ไปรีโหลดเลย
    if (retries > 0 && err?.message !== TIMEOUT_MSG) {
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
