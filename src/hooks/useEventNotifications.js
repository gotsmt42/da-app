import { useEffect, useRef, useState } from "react";

// ✅ ดึง logic แจ้งเตือน (diff เทียบ event ก่อน/หลัง) ออกมาจาก Operation/index.js
// ให้ใช้ร่วมกันได้ทั้งหน้า Operation (มี events อยู่แล้วในสโตร์) และ Header (ต้อง fetch เอง
// เพื่อให้เห็นแจ้งเตือนได้ทุกหน้า ไม่ใช่แค่ตอนเปิดหน้า Operation ค้างไว้)
//
// เก็บลิสต์แจ้งเตือน (พร้อมสถานะอ่านแล้ว/ยัง) ลง localStorage แยกตาม userId+role
// เพื่อให้ count และรายการไม่หายไปเมื่อรีเฟรชหน้า
export default function useEventNotifications(events, role = "admin") {
  const payload = JSON.parse(localStorage.getItem("payload") || "{}");
  const storageKey = `noti_${payload?.userId || "guest"}_${role}`;

  const [notifications, setNotifications] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch {
      return [];
    }
  });
  const prevEventsRef = useRef({});
  // ✅ ข้ามการสร้างแจ้งเตือนในรอบแรกที่โหลดข้อมูล (แค่บันทึก snapshot ตั้งต้นไว้เทียบ)
  // ไม่งั้นงานเก่าที่ปิดไปแล้ว/ขอปิดไปแล้วก่อนหน้านี้ จะโผล่เป็น "แจ้งเตือนใหม่" ทันทีที่เปิดหน้า
  const isFirstRun = useRef(true);

  const isNewTimestamp = (incoming, previous) =>
    incoming && (!previous || new Date(incoming).getTime() !== new Date(previous).getTime());

  // ✅ sync ลง localStorage ทุกครั้งที่ลิสต์เปลี่ยน (อ่านแล้ว/มีรายการใหม่เข้ามา) กันรีเฟรชแล้วหาย
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(notifications.slice(0, 30)));
  }, [notifications, storageKey]);

  useEffect(() => {
    if (!Array.isArray(events)) return;
    const newNoti = [];
    const firstRun = isFirstRun.current;
    events.forEach((ev) => {
      const prev = prevEventsRef.current[ev._id];

      if (firstRun) {
        // ยังไม่ต้องเทียบอะไร แค่รอบันทึก snapshot ท้ายลูปด้านล่าง
      } else if (role === "admin") {
        // ตรวจจับงานที่เพิ่งถูกช่างกดขอปิด (closeRequested: false/undefined → true)
        if (ev.closeRequested && (!prev || !prev.closeRequested)) {
          newNoti.push({
            id: ev._id + "_closereq_" + (ev.closeRequestedAt || Date.now()),
            type: "close_requested",
            message: `${ev.closeRequestedBy || "ช่าง"} ขอปิดงาน`,
            detail: `${ev.company} · ${ev.site}`,
            time: ev.closeRequestedAt || new Date().toISOString(),
            eventId: ev._id,
          });
        }
      } else {
        // ฝั่งช่าง: แจ้งผลอนุมัติ/ไม่อนุมัติคำขอปิดงานของตัวเอง (เทียบเวลาจริง เผื่อโดนตีกลับซ้ำหลายรอบ)
        if (isNewTimestamp(ev.closeApprovedAt, prev?.closeApprovedAt)) {
          newNoti.push({
            id: ev._id + "_approved_" + ev.closeApprovedAt,
            type: "close_approved",
            message: "แอดมินอนุมัติปิดงานแล้ว",
            detail: `${ev.company} · ${ev.site}`,
            time: ev.closeApprovedAt,
            eventId: ev._id,
          });
        }
        if (isNewTimestamp(ev.closeRejectedAt, prev?.closeRejectedAt)) {
          newNoti.push({
            id: ev._id + "_rejected_" + ev.closeRejectedAt,
            type: "close_rejected",
            message: "แอดมินไม่อนุมัติปิดงาน",
            detail: ev.closeRejectReason ? `${ev.company} · ${ev.site}: ${ev.closeRejectReason}` : `${ev.company} · ${ev.site}`,
            time: ev.closeRejectedAt,
            eventId: ev._id,
          });
        }
        // ข้อความใหม่จากแอดมิน/manager (comments เก็บมาทั้งชุดเสมอ จึงเทียบจำนวนแทน)
        const comments = ev.comments || [];
        const prevComments = prev?.comments || [];
        if (comments.length > prevComments.length) {
          comments.slice(prevComments.length)
            .filter((c) => c.role !== "technician")
            .forEach((c) => {
              newNoti.push({
                id: ev._id + "_comment_" + c.timestamp,
                type: "comment",
                message: `${c.userName || "แอดมิน"} ตอบกลับ`,
                detail: `${ev.company} · ${ev.site}: ${c.message}`,
                time: c.timestamp,
                eventId: ev._id,
              });
            });
        }
      }

      // บันทึก snapshot
      prevEventsRef.current[ev._id] = ev;
    });
    isFirstRun.current = false;

    if (newNoti.length > 0) {
      setNotifications((prev) => {
        // กันซ้ำ (id เดิมที่ rehydrate มาจาก localStorage อยู่แล้วตอน mount)
        const existingIds = new Set(prev.map((p) => p.id));
        const fresh = newNoti.filter((n) => !existingIds.has(n.id)).map((n) => ({ ...n, read: false }));
        return [...fresh, ...prev].slice(0, 30);
      });
    }
  }, [events, role]);

  // ✅ count = จำนวนแจ้งเตือนที่ยังไม่เคยเปิดดู (read: false) ลดลงทีละอันตอนกดเข้าไปดูงานนั้นครั้งแรก
  const unread = notifications.filter((n) => !n.read).length;

  const markRead = (id) => {
    setNotifications((prev) => prev.map((x) => (x.id === id ? { ...x, read: true } : x)));
  };

  return { notifications, unread, markRead };
}
