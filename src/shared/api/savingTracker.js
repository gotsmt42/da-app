/**
 * savingTracker — นับคำสั่ง "บันทึก" ที่กำลังส่งไปเซิร์ฟเวอร์ (POST/PUT/PATCH/DELETE) ให้ทั้งแอปรู้ว่ากำลังบันทึกอยู่
 * ✅ (10 พ.ย. 2569 ผู้ใช้: "เวลาบันทึกอะไรที่ต้องรอโหลด ให้ขึ้นกำลังบันทึกให้ผู้ใช้รับรู้ ... ในทุกๆหน้า")
 *    ต่อกับ axios (shared/api/axiosInstance) ครั้งเดียว — ทุกปุ่มบันทึกทุกหน้าได้ป้าย "กำลังบันทึก…" (SavingIndicator) โดยไม่ต้องแก้ทีละหน้า
 * ⚠️ ไม่นับงานเบื้องหลังที่ผู้ใช้ไม่ได้กดบันทึก (แจ้งเตือน · อ่านแล้ว · AI อ่านเอกสารที่มีหน้าจอบอกสถานะเอง ฯลฯ)
 *    ปิดเฉพาะ request ได้ด้วย config `{ silent: true }`
 */
const listeners = new Set();
let active = new Map(); // id → { kind }
let seq = 0;
let lastResult = null; // { ok, at }

const SKIP = /(push|subscribe|notification|mark-?read|\/read\b|seen|presence|heartbeat|\/scan\b|scan-availability|availability|close-check|linenotify|track|client-log|doc-number\/next)/i;

const emit = () => listeners.forEach((fn) => fn(snapshot()));
export const snapshot = () => {
  const list = [...active.values()];
  return { count: list.length, upload: list.some((x) => x.kind === "upload"), lastResult };
};

/** คำสั่งนี้นับเป็น "กำลังบันทึก" ไหม */
export const isSavingRequest = (config) => {
  const m = String(config?.method || "get").toLowerCase();
  if (!["post", "put", "patch", "delete"].includes(m)) return false;
  if (config?.silent) return false;
  return !SKIP.test(String(config?.url || ""));
};

export const beginSaving = (config) => {
  const id = ++seq;
  const isUpload = typeof FormData !== "undefined" && config?.data instanceof FormData;
  active.set(id, { kind: isUpload ? "upload" : "save" });
  emit();
  return id;
};

export const endSaving = (id, ok = true) => {
  if (!active.has(id)) return;
  active.delete(id);
  if (!active.size) lastResult = { ok, at: Date.now() };
  emit();
};

export const subscribeSaving = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** ใช้ในเทสต์เท่านั้น */
export const __resetSaving = () => { active = new Map(); lastResult = null; seq = 0; emit(); };
