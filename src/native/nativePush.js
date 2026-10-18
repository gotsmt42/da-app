/**
 * nativePush.js — แจ้งเตือนแบบแอปจริง (Android / iPhone) ผ่าน Firebase Cloud Messaging
 *
 * ✅ (18 ต.ค. 2569 ผู้ใช้: "แปลงเป็นแอพมือถือ ทั้ง Android และ iPhone")
 *    แอปรับ Web Push ไม่ได้ (WebView ไม่มี PushManager) → PushService.js สลับมาใช้ไฟล์นี้อัตโนมัติเมื่ออยู่ในแอป
 *    token เป็น FCM ทั้งสองระบบ (iPhone ผ่าน APNs ใน Firebase) → server ส่งด้วย firebase-admin ทางเดียว
 *
 * ⚠️ import plugin แบบ dynamic — โค้ด Firebase (หลายร้อย kB) ไม่ถูกโหลดในเว็บปกติเลย
 * ⚠️ ทุกฟังก์ชันกลืน error เอง — ตั้งค่า Firebase ไม่ครบ (ยังไม่มี google-services.json) ต้องไม่ทำให้แอปพัง
 */
import { Capacitor } from "@capacitor/core";
import API from "@/shared/api/axiosInstance";

export const isNativeApp = () => Capacitor.isNativePlatform();

let listenersReady = false;
let lastToken = "";
// แตะแจ้งเตือนตอนแอปปิดอยู่ → เหตุการณ์มาถึงก่อนหน้าหลัก (FullLayout) mount — เก็บไว้ให้ InAppPushBanner มาหยิบ
let pendingOpen = null;
export const takePendingOpen = () => { const p = pendingOpen; pendingOpen = null; return p; };

// ⚠️ คืน "ทั้งโมดูล" ห้ามคืนตัว plugin ออกจาก async function / Promise ตรงๆ เด็ดขาด
//    plugin ของ Capacitor เป็น Proxy ที่ตอบทุกชื่อ property เป็นคำสั่ง native — รวมถึง .then
//    Promise จึงเรียก FirebaseMessaging.then(...) ไปที่เครื่อง ซึ่งไม่มีวันตอบ → await ค้างตลอดไป
//    (ผู้ใช้เจอ 18 ต.ค. 2569: กดเปิดแจ้งเตือนแล้วหมุน 10 นาที ไม่มีอะไรเด้ง)
const pluginModule = () => import("@capacitor-firebase/messaging");

const appVersion = async () => {
  try { return (await (await import("@capacitor/app")).App.getInfo()).version || ""; } catch { return ""; }
};

const sendToken = async (token) => {
  if (!token || !localStorage.getItem("token")) return;
  lastToken = token;
  await API.post("/push/native/register", { token, platform: Capacitor.getPlatform(), appVersion: await appVersion() });
};

/** ฟังเหตุการณ์ครั้งเดียวต่อการเปิดแอป */
const setupListeners = async (FirebaseMessaging) => {
  if (listenersReady) return;
  listenersReady = true;
  // token ถูกหมุน → แจ้ง server ใหม่ (ไม่งั้นเครื่องนี้เงียบหายถาวร)
  await FirebaseMessaging.addListener("tokenReceived", ({ token }) => { sendToken(token).catch(() => {}); });
  // แอปเปิดอยู่ → เด้งแบนเนอร์ในแอป + เสียง (ชุดเดียวกับเว็บ: InAppPushBanner ฟัง event นี้)
  await FirebaseMessaging.addListener("notificationReceived", ({ notification }) => {
    const data = notification?.data || {};
    window.dispatchEvent(new CustomEvent("tidtam:push", {
      detail: { title: notification?.title, body: notification?.body, url: data.url || "/", tag: data.tag, nid: data.nid },
    }));
  });
  // แตะแจ้งเตือน → เปิดหน้าที่เกี่ยวข้อง (InAppPushBanner ฟัง event นี้แล้วเปลี่ยนหน้าแบบ SPA)
  await FirebaseMessaging.addListener("notificationActionPerformed", ({ notification }) => {
    pendingOpen = { url: notification?.data?.url || "/", nid: notification?.data?.nid };
    window.dispatchEvent(new CustomEvent("tidtam:navigate"));
  });
};

/**
 * ทุกขั้นมีเวลาจำกัด — เดิมถ้า Firebase/server ไม่ตอบ ปุ่ม "เปิดแจ้งเตือน" หมุนค้างตลอดไป (ผู้ใช้เจอ 18 ต.ค. 2569)
 * ล้มแล้วบอกชื่อขั้น จะได้รู้ว่าติดที่เครื่อง / Firebase / server
 */
const step = (label, promise, ms = 15000) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error("ไม่ตอบสนอง (หมดเวลา)")), ms)),
]).catch((err) => { throw new Error(`${label}: ${err?.message || err}`); });

/** ขออนุญาต + ลงทะเบียนเครื่องกับ server (เรียกได้ซ้ำ — ไม่ถามซ้ำถ้าเคยอนุญาตแล้ว)
 *  ask=true (ผู้ใช้กดเอง) → ล้มแล้ว throw พร้อมเหตุผล · ask=false (sync เงียบๆ ตอนเปิดแอป) → คืน false */
export async function registerNativePush({ ask = true } = {}) {
  if (!isNativeApp()) return false;
  try {
    if (!Capacitor.isPluginAvailable("FirebaseMessaging")) throw new Error("แอปรุ่นนี้ไม่มีระบบแจ้งเตือน — ติดตั้ง APK รุ่นล่าสุด");
    const { FirebaseMessaging } = await pluginModule();
    let { receive } = await step("ตรวจสิทธิ์", FirebaseMessaging.checkPermissions());
    // ⚠️ บางเครื่องไม่เด้งกล่องขออนุญาตเลย แล้ว promise ไม่จบ (ผู้ใช้เจอ: หมุน 10 นาที ไม่มีอะไรขึ้น)
    //    → จำกัด 45 วินาที แล้วพาไปเปิดสิทธิ์เองในตั้งค่าเครื่อง (เปิดแล้วกดใหม่ = ผ่าน checkPermissions เลย)
    const MANUAL = "เปิดเองได้ที่ ตั้งค่าเครื่อง › แอป › TidTam › การแจ้งเตือน › เปิด แล้วกลับมากดเปิดแจ้งเตือนอีกครั้ง";
    if (receive !== "granted" && ask) {
      ({ receive } = await step("ขออนุญาตแจ้งเตือน", FirebaseMessaging.requestPermissions(), 45000)
        .catch(() => { throw new Error(`เครื่องไม่แสดงกล่องขออนุญาต — ${MANUAL}`); }));
    }
    if (receive !== "granted") {
      if (ask) throw new Error(`ยังไม่อนุญาตให้แจ้งเตือน — ${MANUAL}`);
      return false;
    }
    if (Capacitor.getPlatform() === "android") {
      // ช่องแจ้งเตือนความสำคัญสูง (เด้งทับหน้าจอ + เสียง) — id ต้องตรงกับ server (NativePush.js)
      await step("สร้างช่องแจ้งเตือน", FirebaseMessaging.createChannel({
        id: "tidtam_default", name: "แจ้งเตือนงาน", description: "งานใหม่ การอนุมัติ และการเตือนประจำวัน",
        importance: 5, visibility: 1, vibration: true,
      }), 5000).catch(() => {});
    }
    await step("เตรียมรับแจ้งเตือน", setupListeners(FirebaseMessaging), 5000);
    const { token } = await step("ขอรหัสเครื่องจาก Firebase", FirebaseMessaging.getToken(), 20000);
    // server บน Render อาจกำลังตื่น (~30–50 วินาที)
    await step("ลงทะเบียนกับ server", sendToken(token), 60000);
    return true;
  } catch (err) {
    console.warn("แจ้งเตือนแบบแอป: ลงทะเบียนไม่สำเร็จ", err?.message || err);
    if (ask) throw err;
    return false;
  }
}

export async function nativePermissionState() {
  if (!isNativeApp()) return "unsupported";
  try { return (await (await pluginModule()).FirebaseMessaging.checkPermissions()).receive; } catch { return "denied"; }
}

/** ออกจากระบบ — เลิกส่งแจ้งเตือนเข้าเครื่องนี้ (ทั้งฝั่ง server และ token ในเครื่อง) */
export async function unregisterNativePush() {
  if (!isNativeApp()) return;
  try {
    const { FirebaseMessaging } = await pluginModule();
    const token = lastToken || (await FirebaseMessaging.getToken().catch(() => ({}))).token;
    if (token) await API.post("/push/native/unregister", { token }).catch(() => {});
    await FirebaseMessaging.deleteToken().catch(() => {});
    lastToken = "";
  } catch { /* เงียบไว้ */ }
}

/** ตัวเลขบนไอคอนแอป */
export async function setNativeBadge(n) {
  if (!isNativeApp()) return;
  try {
    const { FirebaseMessaging } = await pluginModule();
    if (!n) await FirebaseMessaging.removeAllDeliveredNotifications();
  } catch { /* เงียบไว้ */ }
}
