/**
 * realtimeClient — ช่องสัญญาณอัปเดตหน้าจอแบบเรียลไทม์ (ฝั่งเบราว์เซอร์)
 *
 * ✅ ผู้ใช้สั่ง: "หน้าการอัพเดตข้อมูล หรือสถานะต่างๆ ให้เป็นแบบเรียลไทม์อัตโนมัติ ไม่ต้องรีเฟรช"
 *
 * หลักการ (คู่กับ da-app-server/src/services/realtime.js):
 *   • หนึ่งแท็บ = หนึ่งการเชื่อมต่อ ใช้ร่วมกันทุกหน้า/ทุก component
 *   • server ส่งแค่ "สัญญาณ" ว่าหมวดไหนเปลี่ยน ({ topic, id }) — หน้าจอดึงข้อมูลใหม่ผ่าน API เดิมเอง
 *     (API เดิมกรองสิทธิ์ไว้แล้ว ทางนี้จึงไม่มีข้อมูลให้รั่ว)
 *   • หลุดแล้วต่อใหม่เอง (หน่วงเวลาเพิ่มขึ้นเรื่อยๆ) และต่อใหม่ทันทีเมื่อกลับมาที่แท็บ/เน็ตกลับมา
 *   • หลุดนานจนอาจพลาดสัญญาณ → ส่ง "resync" ให้ทุกหน้าที่เปิดอยู่ดึงข้อมูลใหม่หนึ่งรอบ
 *
 * ⚠️ ใช้ fetch อ่าน stream แทน EventSource — EventSource แนบ Authorization header ไม่ได้ ต้องใส่ token
 * ใน URL ซึ่งจะไปค้างอยู่ใน log ของเซิร์ฟเวอร์/พร็อกซีทุกตัว
 */

const API_URL = import.meta.env.REACT_APP_API_URL || "";

const newId = () =>
  window.crypto?.randomUUID?.() ||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * รหัสของแท็บนี้ — แนบไปกับทุก API request (axiosInstance) เพื่อให้รู้ว่าสัญญาณไหน "แท็บนี้เป็นคนกดเอง"
 */
export const CLIENT_ID = newId();

/** หน่วงก่อนต่อใหม่ (ms) — ไล่ขึ้นทีละขั้น ไม่ให้ทุกเครื่องรุมต่อพร้อมกันตอนเซิร์ฟเวอร์เพิ่งกลับมา */
const BACKOFF = [1000, 2000, 4000, 8000, 15000, 30000];
/** เซิร์ฟเวอร์ส่งสัญญาณชีพทุก 25 วินาที — เงียบเกินนี้ถือว่าการเชื่อมต่อตายแบบไม่รู้ตัว (มือถือหลับ/สลับเน็ต) */
const STALE_MS = 70_000;
/** หลุดนานกว่านี้ถือว่าอาจพลาดสัญญาณ → ให้ทุกหน้าดึงข้อมูลใหม่หนึ่งรอบหลังต่อกลับได้ */
const RESYNC_AFTER_MS = 5_000;

const listeners = new Set();
const statusListeners = new Set();

let running = false;
let status = "idle"; // idle | connecting | open | closed
let controller = null;
let retry = 0;
let retryTimer = null;
let watchdog = null;
let lastByteAt = 0;
let lostAt = 0;
let everOpened = false;
let hiddenAt = 0;

const setStatus = (s) => {
  if (status === s) return;
  status = s;
  statusListeners.forEach((fn) => {
    try { fn(s); } catch { /* ไม่ให้ตัวฟังตัวเดียวล้มทั้งระบบ */ }
  });
};

const emit = (evt) => {
  listeners.forEach((l) => {
    if (evt.type === "resync" || !l.topics || l.topics.has(evt.topic)) {
      try {
        l.fn(evt);
      } catch (err) {
        console.error("realtime listener error:", err);
      }
    }
  });
};

const markLost = () => {
  if (!lostAt) lostAt = Date.now();
};

const scheduleReconnect = (delay) => {
  if (!running) return;
  clearTimeout(retryTimer);
  const wait = delay ?? BACKOFF[Math.min(retry, BACKOFF.length - 1)] + Math.random() * 600;
  retry += 1;
  retryTimer = setTimeout(connect, wait);
};

const handleFrame = (frame) => {
  let event = "message";
  let data = "";
  frame.split(/\r?\n/).forEach((line) => {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  });
  if (event === "ready") {
    setStatus("open");
    retry = 0;
    // ✅ ต่อกลับมาหลังหลุดไปนาน → อาจพลาดการเปลี่ยนแปลงระหว่างนั้น ให้ทุกหน้าดึงใหม่หนึ่งรอบ
    if (everOpened && lostAt && Date.now() - lostAt > RESYNC_AFTER_MS) emit({ type: "resync" });
    everOpened = true;
    lostAt = 0;
    return;
  }
  if (event === "change" && data) {
    try {
      emit({ type: "change", ...JSON.parse(data) });
    } catch {
      /* ข้อความเสีย — ข้าม */
    }
  }
};

async function connect() {
  if (!running) return;
  const token = localStorage.getItem("token");
  if (!token || !API_URL || typeof fetch !== "function") {
    setStatus("idle");
    return;
  }
  controller?.abort();
  const ctrl = new AbortController();
  controller = ctrl;
  setStatus("connecting");
  try {
    const res = await fetch(`${API_URL}/realtime/stream`, {
      headers: { Authorization: `Bearer ${token}`, "X-Client-Id": CLIENT_ID, Accept: "text/event-stream" },
      signal: ctrl.signal,
      cache: "no-store",
    });
    // 🔒 token ใช้ไม่ได้แล้ว — ไม่ต้องวนต่อใหม่ (API request ถัดไปของหน้าจอจะพาไปหน้าเข้าสู่ระบบเอง)
    if ([401, 403, 404].includes(res.status)) {
      markLost();
      setStatus("closed");
      return;
    }
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    lastByteAt = Date.now();
    for (;;) {
      // eslint-disable-next-line no-await-in-loop -- อ่าน stream ทีละก้อนตามลำดับโดยธรรมชาติ
      const { value, done } = await reader.read();
      if (done) break;
      lastByteAt = Date.now();
      buffer += decoder.decode(value, { stream: true });
      let m = buffer.match(/\r?\n\r?\n/);
      while (m) {
        const frame = buffer.slice(0, m.index);
        buffer = buffer.slice(m.index + m[0].length);
        handleFrame(frame);
        m = buffer.match(/\r?\n\r?\n/);
      }
    }
    throw new Error("stream ended");
  } catch {
    // ถูกแทนที่ด้วยการเชื่อมต่อใหม่/ถูกสั่งหยุด — ไม่ต้องทำอะไร
    if (controller !== ctrl || !running) return;
    markLost();
    setStatus("closed");
    scheduleReconnect();
  }
}

const onVisibility = () => {
  if (document.visibilityState === "hidden") {
    hiddenAt = Date.now();
    return;
  }
  // ✅ กลับมาที่แท็บ: การเชื่อมต่อไม่อยู่แล้ว → ต่อใหม่ทันที (ไม่ต้องรอรอบหน่วงเวลา)
  if (status !== "open" && status !== "connecting") {
    retry = 0;
    scheduleReconnect(0);
  } else if (hiddenAt && Date.now() - hiddenAt > 60_000) {
    // ⚠️ มือถือพักแอปไว้เบื้องหลังนาน การเชื่อมต่ออาจตายไปแล้วโดยยังไม่รู้ตัว — ให้หน้าจอดึงใหม่ไว้ก่อน
    emit({ type: "resync" });
  }
  hiddenAt = 0;
};

const onOnline = () => {
  retry = 0;
  scheduleReconnect(0);
};

/** login/logout จากแท็บอื่น (token ใน localStorage เปลี่ยน) → เริ่มการเชื่อมต่อใหม่ด้วยตัวตนล่าสุด */
const onStorage = (e) => {
  if (e.key !== "token") return;
  if (!e.newValue) {
    controller?.abort();
    setStatus("idle");
    return;
  }
  retry = 0;
  scheduleReconnect(0);
};

/** เริ่มเชื่อมต่อ (เรียกตอนผู้ใช้ล็อกอินอยู่) — เรียกซ้ำได้ ไม่เปิดซ้อน */
export function startRealtime() {
  if (running) {
    if (status === "idle" || status === "closed") {
      retry = 0;
      scheduleReconnect(0);
    }
    return;
  }
  running = true;
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("online", onOnline);
  window.addEventListener("storage", onStorage);
  clearInterval(watchdog);
  watchdog = setInterval(() => {
    if (status === "open" && Date.now() - lastByteAt > STALE_MS) {
      markLost();
      controller?.abort();
      setStatus("closed");
      scheduleReconnect(0);
    }
  }, 15_000);
  connect();
}

/** หยุด (ออกจากระบบ) */
export function stopRealtime() {
  running = false;
  clearTimeout(retryTimer);
  clearInterval(watchdog);
  controller?.abort();
  controller = null;
  everOpened = false;
  lostAt = 0;
  retry = 0;
  document.removeEventListener("visibilitychange", onVisibility);
  window.removeEventListener("online", onOnline);
  window.removeEventListener("storage", onStorage);
  setStatus("idle");
}

/**
 * ฟังสัญญาณ
 * @param {string[]|null} topics  หมวดที่สนใจ (null = ทุกหมวด) — "resync" ได้รับเสมอ
 * @param {(evt: {type: "change"|"resync", topic?: string, id?: string, origin?: string, by?: string}) => void} fn
 * @returns {() => void} ยกเลิกการฟัง
 */
export function subscribeRealtime(topics, fn) {
  const entry = { topics: topics ? new Set(topics) : null, fn };
  listeners.add(entry);
  return () => listeners.delete(entry);
}

export function onRealtimeStatus(fn) {
  statusListeners.add(fn);
  fn(status);
  return () => statusListeners.delete(fn);
}

export const realtimeStatus = () => status;
