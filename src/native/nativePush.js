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

const plugin = async () => (await import("@capacitor-firebase/messaging")).FirebaseMessaging;

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

/** ขออนุญาต + ลงทะเบียนเครื่องกับ server (เรียกได้ซ้ำ — ไม่ถามซ้ำถ้าเคยอนุญาตแล้ว) */
export async function registerNativePush({ ask = true } = {}) {
  if (!isNativeApp()) return false;
  try {
    const FirebaseMessaging = await plugin();
    let { receive } = await FirebaseMessaging.checkPermissions();
    if (receive !== "granted" && ask) ({ receive } = await FirebaseMessaging.requestPermissions());
    if (receive !== "granted") return false;
    if (Capacitor.getPlatform() === "android") {
      // ช่องแจ้งเตือนความสำคัญสูง (เด้งทับหน้าจอ + เสียง) — id ต้องตรงกับ server (NativePush.js)
      await FirebaseMessaging.createChannel({
        id: "tidtam_default", name: "แจ้งเตือนงาน", description: "งานใหม่ การอนุมัติ และการเตือนประจำวัน",
        importance: 5, visibility: 1, vibration: true,
      }).catch(() => {});
    }
    await setupListeners(FirebaseMessaging);
    const { token } = await FirebaseMessaging.getToken();
    await sendToken(token);
    return true;
  } catch (err) {
    console.warn("แจ้งเตือนแบบแอป: ลงทะเบียนไม่สำเร็จ", err?.message || err);
    return false;
  }
}

export async function nativePermissionState() {
  if (!isNativeApp()) return "unsupported";
  try { return (await (await plugin()).checkPermissions()).receive; } catch { return "denied"; }
}

/** ออกจากระบบ — เลิกส่งแจ้งเตือนเข้าเครื่องนี้ (ทั้งฝั่ง server และ token ในเครื่อง) */
export async function unregisterNativePush() {
  if (!isNativeApp()) return;
  try {
    const FirebaseMessaging = await plugin();
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
    const FirebaseMessaging = await plugin();
    if (!n) await FirebaseMessaging.removeAllDeliveredNotifications();
  } catch { /* เงียบไว้ */ }
}
