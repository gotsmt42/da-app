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
