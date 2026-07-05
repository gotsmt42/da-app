import API from "../API/axiosInstance";

// ✅ แปลง VAPID public key จาก base64url เป็น Uint8Array ตามที่ pushManager.subscribe ต้องการ
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

const PushService = {
  isSupported() {
    return "serviceWorker" in navigator && "PushManager" in window;
  },

  async getPermissionState() {
    if (!this.isSupported()) return "unsupported";
    return Notification.permission; // "default" | "granted" | "denied"
  },

  async isSubscribed() {
    if (!this.isSupported()) return false;
    const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return Boolean(sub);
  },

  // ✅ ขอ permission + subscribe + ส่ง subscription ไปเก็บที่ server ผูกกับผู้ใช้ที่ล็อกอินอยู่
  async subscribe() {
    if (!this.isSupported()) throw new Error("อุปกรณ์/เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน");

    const reg = await navigator.serviceWorker.register("/push-sw.js");

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error("ผู้ใช้ไม่อนุญาตให้แจ้งเตือน");
    }

    const { data } = await API.get("/push/vapid-public-key");
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey),
    });

    await API.post("/push/subscribe", sub.toJSON());
    return sub;
  },

  async unsubscribe() {
    if (!this.isSupported()) return;
    const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
    if (!reg) return;

    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;

    await API.post("/push/unsubscribe", { endpoint: sub.endpoint });
    await sub.unsubscribe();
  },
};

export default PushService;
