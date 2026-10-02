// Service worker เฉพาะสำหรับรับ Web Push notification (ไม่แตะ cache ของแอปหลัก)

// ✅ เวอร์ชันใหม่ของไฟล์นี้ใช้งานทันที ไม่ต้องรอปิดแอปทุกแท็บก่อน (ไฟล์นี้ไม่มี cache ให้พัง)
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = { title: "แจ้งเตือน", body: "" };
  try {
    data = event.data.json();
  } catch {
    data.body = event.data?.text() || "";
  }

  // ✅ แอปเปิดอยู่บนจอ → ส่งให้หน้าแอปเด้งแบนเนอร์ในแอป + เสียงเตือน (แบบ LINE) แทนแจ้งเตือนระบบซ้ำซ้อน
  //    แอปปิด/อยู่เบื้องหลัง → แจ้งเตือนระบบของมือถือ (เสียง/สั่นตามตั้งค่าเครื่อง)
  // ⚠️ ข้ามแจ้งเตือนระบบได้เฉพาะตอนมีหน้าแอป "มองเห็นอยู่" เท่านั้น — Chrome บังคับ userVisibleOnly
  //    ถ้าไม่มีหน้าไหนเปิดอยู่แล้วไม่ showNotification เบราว์เซอร์จะโชว์ข้อความกลางๆ ของมันเองแทน
  // ✅ ตัวเลขบนไอคอนแอป (แบบ LINE) — server แนบจำนวนที่ยังไม่อ่านมาใน payload.badge
  //    รองรับ Android (Chrome) / iOS 16.4+ ที่ติดตั้งแอปลงหน้าจอโฮม · เครื่องที่ไม่รองรับข้ามไปเงียบๆ
  const setBadge = () => {
    try {
      if (!("setAppBadge" in self.navigator)) return Promise.resolve();
      const n = Number(data.badge);
      return (n > 0 ? self.navigator.setAppBadge(n) : Number.isFinite(n) ? self.navigator.clearAppBadge() : self.navigator.setAppBadge()).catch(() => {});
    } catch {
      return Promise.resolve();
    }
  };

  event.waitUntil(
    Promise.all([
      setBadge(),
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
        const visible = list.filter((c) => c.visibilityState === "visible" && new URL(c.url).origin === self.location.origin);
        if (visible.length) {
          visible.forEach((c) => c.postMessage({ type: "app-push", payload: { title: data.title, body: data.body, url: data.url || "/", tag: data.tag, nid: data.nid, kind: data.kind } }));
          return undefined;
        }
        return self.registration.showNotification(data.title || "🔔 แจ้งเตือน", {
          body: data.body || "",
          // ✅ ไอคอนแอป (ใหญ่ ข้างข้อความ) + ไอคอนขาวล้วนสำหรับแถบสถานะ Android
          //    🐛 เดิมใช้ /logo192.png (โลโก้เก่า) ทั้งสองช่อง — แถบสถานะ Android แสดงเป็นสี่เหลี่ยมขาวทึบ
          //    เพราะระบบใช้แค่ความโปร่งใสของรูป badge ต้องเป็นรูปขาวบนพื้นโปร่งใสเท่านั้น
          icon: "/app-icon-192.png?v=16",
          badge: "/notification-badge.png",
          // ✅ tag เดียวกัน = แจ้งเตือนเกี่ยวกับงานเดียวกัน ถูกรวม/แทนที่ของเก่าแทนที่จะกองสะสม
          // renotify: true ทำให้ถึงจะแทนที่ของเก่า ก็ยังสั่น/เด้งแจ้งซ้ำให้รู้ว่ามีอัปเดตใหม่จริง (ไม่ใช่แค่เงียบๆ แทนที่)
          tag: data.tag || undefined,
          renotify: Boolean(data.tag) && Boolean(data.renotify),
          // ✅ มีเสียงเสมอ (ใช้เสียงแจ้งเตือนของเครื่อง) — เว็บกำหนดไฟล์เสียงเองไม่ได้ เบราว์เซอร์มือถือไม่รองรับ
          silent: false,
          vibrate: [120, 60, 120],
          // ✅ ให้ค้างอยู่ในกล่องแจ้งเตือนจนกว่าจะมีคนกดดู ไม่ให้หายไปเองหลังเด้งขึ้นมาไม่กี่วินาที
          requireInteraction: true,
          timestamp: Date.now(),
          dir: "auto",
          lang: "th",
          data: { url: data.url || "/", nid: data.nid || "" },
          actions: [{ action: "open", title: "เปิดดู" }],
        });
      }),
    ])
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
  const { url = "/", nid = "" } = event.notification.data || {};

  // ✅ แอปเปิดค้างอยู่ (แม้อยู่เบื้องหลัง) → ส่งให้แอปเปลี่ยนหน้าเองแบบ SPA (ไม่โหลดใหม่ทั้งแอป) + ทำเครื่องหมายอ่านแล้ว
  //    แอปปิดอยู่ → เปิดหน้าใหม่พร้อม ?_n=<id> ให้แอปทำเครื่องหมายอ่านแล้วตอนเปิดขึ้นมา (service worker ไม่มี token เรียก API เองไม่ได้)
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          client.postMessage({ type: "open-url", url, nid });
          return client.focus();
        }
      }
      if (!clients.openWindow) return undefined;
      const target = new URL(url, self.location.origin);
      if (nid) target.searchParams.set("_n", nid);
      return clients.openWindow(target.pathname + target.search + target.hash);
    })
  );
});
