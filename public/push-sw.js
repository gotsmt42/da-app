// Service worker เฉพาะสำหรับรับ Web Push notification (ไม่แตะ cache ของแอปหลัก)

self.addEventListener("push", (event) => {
  let data = { title: "แจ้งเตือน", body: "" };
  try {
    data = event.data.json();
  } catch {
    data.body = event.data?.text() || "";
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "🔔 แจ้งเตือน", {
      body: data.body || "",
      icon: "/logo192.png",
      badge: "/logo192.png",
      // ✅ tag เดียวกัน = แจ้งเตือนเกี่ยวกับงานเดียวกัน ถูกรวม/แทนที่ของเก่าแทนที่จะกองสะสม
      // renotify: true ทำให้ถึงจะแทนที่ของเก่า ก็ยังสั่น/เด้งแจ้งซ้ำให้รู้ว่ามีอัปเดตใหม่จริง (ไม่ใช่แค่เงียบๆ แทนที่)
      tag: data.tag || undefined,
      renotify: Boolean(data.tag) && Boolean(data.renotify),
      vibrate: [120, 60, 120],
      // ✅ ให้ค้างอยู่ในกล่องแจ้งเตือนจนกว่าจะมีคนกดดู ไม่ให้หายไปเองหลังเด้งขึ้นมาไม่กี่วินาที
      requireInteraction: true,
      dir: "auto",
      lang: "th",
      data: { url: data.url || "/" },
    })
  );
});

// 🐛 BUG ที่แก้ (แจ้งเตือนเงียบหายถาวรโดยไม่มีใครรู้ตัว): เบราว์เซอร์/push service หมุน (rotate)
// subscription ได้เองเป็นระยะ — endpoint เดิมจะตายทันที ถ้าไม่ต่อ subscription ใหม่แล้วบอก server
// เครื่องนั้นจะไม่ได้รับ push อีกเลยตลอดไป ทั้งที่ปุ่มในหน้า "ตั้งค่า" ยังขึ้นว่าเปิดอยู่ (เพราะ
// getSubscription() คืน subscription ตัวใหม่ที่ server ไม่รู้จัก) — ผู้ใช้จะเข้าใจว่าระบบแจ้งเตือนพัง
// ✅ ต่อ subscription ใหม่แล้วยิงไปที่ /push/resubscribe เพื่อย้าย record เดิม (คง userId ไว้) มาที่
// endpoint ใหม่ — service worker ไม่มี JWT จึงใช้ endpoint เดิมเป็นตัวยืนยันตัวตนแทน (endpoint เป็น
// ค่าลับที่เดาไม่ได้อยู่แล้ว และ route นี้ทำได้แค่ "ย้าย" record เดิมเท่านั้น สร้าง/เปลี่ยนเจ้าของไม่ได้)
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        // ⚠️ service worker ยิงไปที่ API เองไม่ได้ — API อยู่คนละ origin (REACT_APP_API_URL) และต้องแนบ
        // X-API-Key/X-Secret/JWT ซึ่งไม่ควรฝังไว้ในไฟล์ public ที่ใครก็โหลดอ่านได้ — ที่นี่จึงทำแค่ต่อ
        // subscription ใหม่ให้พร้อมไว้ก่อน แล้วปล่อยให้ฝั่งแอปเป็นคนแจ้ง server ตอนเปิดแอปครั้งถัดไป
        // (ดู PushService.syncSubscription ซึ่งถูกเรียกทุกครั้งที่แอปเริ่มทำงาน/ล็อกอิน)
        const appServerKey = event.oldSubscription?.options?.applicationServerKey;
        if (!appServerKey) return;
        await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKey,
        });
      } catch {
        // เงียบไว้ — ฝั่งแอปจะ subscribe ใหม่ให้เองอยู่แล้วถ้าตรงนี้ไม่สำเร็จ (permission ยัง granted อยู่)
      }
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
