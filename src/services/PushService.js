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

  // ⚠️ ลำดับสำคัญ: ยกเลิกฝั่งเบราว์เซอร์ก่อนเสมอ แล้วค่อยแจ้ง server — ไม่ใช่กลับกันเหมือนเดิม
  // เหตุผล: sub.unsubscribe() คือขั้นตอนที่ "หยุดรับ push จริง" ทันที (push service ปฏิเสธ endpoint นั้น
  // ทันทีที่สำเร็จ) ส่วนการแจ้ง server เป็นแค่การเก็บกวาด record ซึ่งถ้าพลาดก็ไม่เป็นไรเลย — ครั้งถัดไป
  // ที่ระบบส่ง push ไป endpoint ที่ตายแล้วจะได้ 410 กลับมาแล้วลบ record ทิ้งให้เองอยู่แล้ว (ดู
  // services/PushNotify.js) ทำให้ตอนล็อกเอาต์เรียกแบบ fire-and-forget ได้อย่างปลอดภัย ไม่ต้องรอเน็ต
  // และไม่พังแม้ token จะถูกลบไปก่อนที่ request จะยิงออก
  async unsubscribe() {
    if (!this.isSupported()) return;
    const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
    if (!reg) return;

    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;

    const { endpoint } = sub;
    await sub.unsubscribe();
    await API.post("/push/unsubscribe", { endpoint }).catch(() => {});
  },

  // 🐛 BUG ที่แก้ 2 อย่างพร้อมกัน — เรียกทุกครั้งที่แอปเริ่มทำงาน/ล็อกอินสำเร็จ (ดู AuthContext):
  //
  // (1) เครื่องที่ใช้ร่วมกัน = แจ้งเตือนไปผิดคน: subscription ผูกกับ userId ตอนที่กดเปิดครั้งแรก
  //     พอคนเก่าล็อกเอาต์แล้วคนใหม่ล็อกอินบนเครื่องเดียวกัน record ใน DB ยังชี้ userId ของคนเก่าอยู่
  //     → เครื่องนี้เด้งแจ้งเตือน "งานของคนเก่า" ให้คนใหม่เห็น และคนใหม่ไม่ได้รับของตัวเองเลยจนกว่าจะ
  //     ไปกดปิด-เปิดสวิตช์ในหน้าตั้งค่าเอง (ซึ่งไม่มีใครรู้ว่าต้องทำ) — POST ซ้ำทุกครั้งที่ล็อกอิน
  //     ทำให้ record ถูก upsert ทับด้วย userId ของคนที่ล็อกอินอยู่จริงเสมอ (ดู POST /push/subscribe)
  //
  // (2) แจ้งเตือนเงียบหายถาวร: เบราว์เซอร์หมุน subscription เองเป็นระยะ endpoint เดิมตาย server ลบทิ้ง
  //     (410) แต่ไม่มีใครบอก endpoint ใหม่ให้ server รู้ → ไม่ได้รับ push อีกเลยทั้งที่สวิตช์ยังขึ้นว่าเปิด
  //
  // ⚠️ ไม่ขอ permission ใหม่เด็ดขาด — ทำเฉพาะตอนที่ผู้ใช้เคยอนุญาตไว้แล้วเท่านั้น (permission granted)
  // คนที่ยังไม่เคยเปิด/กดปฏิเสธไว้ จะไม่โดนเด้งขอสิทธิ์เองโดยไม่ได้ตั้งใจ
  async syncSubscription() {
    try {
      if (!this.isSupported()) return;
      if (Notification.permission !== "granted") return;

      const reg = await navigator.serviceWorker.register("/push-sw.js");
      let sub = await reg.pushManager.getSubscription();

      // subscription หายไป (ถูกหมุน/ถูกล้าง) — ต่อใหม่ได้เลย ไม่ต้องถาม permission ซ้ำเพราะอนุญาตไว้แล้ว
      if (!sub) {
        const { data } = await API.get("/push/vapid-public-key");
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(data.publicKey),
        });
      }

      await API.post("/push/subscribe", sub.toJSON());
    } catch {
      // เงียบไว้ — เป็นงานเบื้องหลัง ไม่ควรมี error เด้งกวนผู้ใช้ตอนเปิดแอป
    }
  },
};

export default PushService;
