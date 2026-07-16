import { useEffect, useRef, useState } from "react";
import moment from "moment";
import "moment/locale/th";

// ✅ สร้างข้อความรายละเอียดงานพร้อมวันที่/เวลานัดหมาย — ใช้กับแจ้งเตือน "งานใหม่" โดยเฉพาะ
// เพื่อให้เห็นว่างานนัดไว้เมื่อไหร่ได้ทันทีจากกล่องแจ้งเตือน ไม่ต้องเปิดเข้าไปดูในงานเอง
const buildNewJobDetail = (ev) => {
  const dateLabel = moment(ev.start || ev.date).locale("th").format("D MMM YYYY");
  const timeLabel = (ev.startTime || ev.endTime) ? `${ev.startTime || "-"}-${ev.endTime || "-"}` : "ทั้งวัน";
  const place = [ev.company, ev.site].filter(Boolean).join(" · ");
  return `${place ? place + " · " : ""}📅 ${dateLabel} 🕐 ${timeLabel}`;
};

const READ_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // เก็บรายการที่ "อ่านแล้ว" ไว้ 7 วัน ก่อนลบทิ้ง
const HARD_CAP = 200; // กันลิสต์บวมไม่มีที่สิ้นสุดในกรณีสุดโต่ง (ปกติ read-based pruning จะกันไว้ก่อนถึงตรงนี้อยู่แล้ว)

// ✅ "ยังไม่อ่าน" เก็บไว้เสมอไม่ว่าจะเก่าแค่ไหน กันพลาดแจ้งเตือนสำคัญที่ยังไม่เคยเห็น
// "อ่านแล้ว" เก็บไว้ 7 วันนับจากวันที่กดอ่าน (readAt) แล้วค่อยลบทิ้ง — ไม่ใช่ตัดทิ้งตามจำนวนดิบๆ
// เหมือนเดิม ซึ่งอาจลบรายการที่เพิ่งอ่านไปหมาดๆ ถ้ามีแจ้งเตือนใหม่เข้ามาถี่ๆ
const pruneOldRead = (list) => {
  const now = Date.now();
  return list.filter((n) => {
    if (!n.read) return true;
    if (!n.readAt) return true; // ข้อมูลเก่าก่อนมี readAt เก็บไว้ก่อน เดี๋ยวมี readAt ตอนอ่านซ้ำรอบหน้า
    return now - new Date(n.readAt).getTime() < READ_RETENTION_MS;
  });
};

// ✅ ดึง logic แจ้งเตือน (diff เทียบ event ก่อน/หลัง) ออกมาจาก Operation/index.js
// ให้ใช้ร่วมกันได้ทั้งหน้า Operation (มี events อยู่แล้วในสโตร์) และ Header (ต้อง fetch เอง
// เพื่อให้เห็นแจ้งเตือนได้ทุกหน้า ไม่ใช่แค่ตอนเปิดหน้า Operation ค้างไว้)
//
// เก็บลิสต์แจ้งเตือน (พร้อมสถานะอ่านแล้ว/ยัง) ลง localStorage แยกตาม userId+role
// เพื่อให้ count และรายการไม่หายไปเมื่อรีเฟรชหน้า
export default function useEventNotifications(events, role = "admin") {
  const payload = JSON.parse(localStorage.getItem("payload") || "{}");
  // ✅ v2: บั๊กเดิม (ดูคอมเมนต์ที่ useEffect ด้านล่าง) ทำให้งานเก่าทุกงานถูกตีเป็น "แจ้งเตือนใหม่"
  // ทีเดียวพร้อมกันหมด ต้องเปลี่ยน key เพื่อละทิ้งข้อมูลที่พังไปแล้วใน localStorage ของผู้ใช้เดิม
  const storageKey = `noti_v2_${payload?.userId || "guest"}_${role}`;

  const [notifications, setNotifications] = useState(() => {
    try {
      return pruneOldRead(JSON.parse(localStorage.getItem(storageKey) || "[]"));
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
    localStorage.setItem(storageKey, JSON.stringify(notifications.slice(0, HARD_CAP)));
  }, [notifications, storageKey]);

  useEffect(() => {
    // ✅ บั๊กเดิม: effect นี้รันทันทีตอน mount ตอน events ยังเป็น [] ว่างๆ (ก่อน fetch จริงจะเสร็จ)
    // ทำให้ isFirstRun.current ถูกตั้งเป็น false ไปแล้วตั้งแต่รอบที่ข้อมูลยังไม่มา — พอข้อมูลจริงโหลด
    // เสร็จและ effect รันรอบถัดไป มันไม่ถูกนับเป็น "รอบแรก" อีกต่อไป ทำให้งานเก่าทุกงาน (prevEventsRef
    // ยังว่างเปล่าอยู่) ถูกตีเป็น "แจ้งเตือนใหม่" พร้อมกันหมดทีเดียว — ต้องรอให้มีข้อมูลจริงก่อน
    // ค่อยเริ่มนับว่านี่คือรอบแรก ไม่งั้น snapshot เปล่าจะไปขวางรอบที่มีข้อมูลจริงโดยไม่ตั้งใจ
    if (!Array.isArray(events) || events.length === 0) return;
    const newNoti = [];
    const firstRun = isFirstRun.current;
    events.forEach((ev) => {
      const prev = prevEventsRef.current[ev._id];

      if (firstRun) {
        // ยังไม่ต้องเทียบอะไร แค่รอบันทึก snapshot ท้ายลูปด้านล่าง
      } else if (role === "admin") {
        // ✅ เดิมกล่องแจ้งเตือนในแอพไม่เคยรู้จัก "งานใหม่" เลย (มีแค่ push แจ้งตอนนั้นตอนเดียว
        // เปิดแอพย้อนมาดูทีหลังจะไม่เห็นประวัติ) — ตรวจจับ event id ที่เพิ่งปรากฏครั้งแรกในรายการ
        // (ไม่เคยเห็นมาก่อนใน snapshot รอบที่แล้ว = เพิ่งถูกเพิ่มเข้าระบบจริงๆ)
        if (!prev) {
          newNoti.push({
            id: ev._id + "_newjob_" + (ev.createdAt || ev._id),
            type: "new_job",
            message: "มีงานใหม่เข้าระบบ",
            detail: `${ev.title || "งาน"} · ${buildNewJobDetail(ev)}`,
            // ✅ ใช้ createdAt (เวลาที่ถูกสร้างจริงใน DB) ไม่ใช่ ev.start/ev.date (วันนัดหมายของงาน) —
            // เดิมถ้า createdAt หายไป จะ fallback ไปใช้วันนัดหมายซึ่งอาจเป็นวันในอดีต/อนาคตไกลๆ
            // ทำให้ "เมื่อกี้"/"Xนาทีที่แล้ว" ที่ควรบอกว่าแจ้งเตือนนี้เพิ่งเกิด กลายเป็นค่าผิดๆ ไปแทน
            time: ev.createdAt || new Date().toISOString(),
            eventId: ev._id,
          });
        }
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
        // ✅ ฝั่งช่าง: events ที่ได้มาจาก getEventOp() ถูก scope ไว้แค่งานของตัวเองอยู่แล้ว —
        // งาน id ไหนที่เพิ่งปรากฏครั้งแรก คือ "เพิ่งถูกสร้าง/มอบหมายมาให้ฉัน" ไม่ว่าจะเพิ่งสร้างใหม่
        // หรือถูกโอนมาจากคนอื่นก็ตาม
        if (!prev) {
          newNoti.push({
            id: ev._id + "_newjob_" + (ev.createdAt || ev._id),
            type: "new_job",
            message: "คุณได้รับมอบหมายงานใหม่",
            detail: `${ev.title || "งาน"} · ${buildNewJobDetail(ev)}`,
            // ✅ ใช้ createdAt (เวลาที่ถูกสร้างจริงใน DB) ไม่ใช่ ev.start/ev.date (วันนัดหมายของงาน) —
            // เดิมถ้า createdAt หายไป จะ fallback ไปใช้วันนัดหมายซึ่งอาจเป็นวันในอดีต/อนาคตไกลๆ
            // ทำให้ "เมื่อกี้"/"Xนาทีที่แล้ว" ที่ควรบอกว่าแจ้งเตือนนี้เพิ่งเกิด กลายเป็นค่าผิดๆ ไปแทน
            time: ev.createdAt || new Date().toISOString(),
            eventId: ev._id,
          });
        }
        // แจ้งผลอนุมัติ/ไม่อนุมัติคำขอปิดงานของตัวเอง (เทียบเวลาจริง เผื่อโดนตีกลับซ้ำหลายรอบ)
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
        return pruneOldRead([...fresh, ...prev]).slice(0, HARD_CAP);
      });
    }
  }, [events, role]);

  // ✅ count = จำนวนแจ้งเตือนที่ยังไม่เคยเปิดดู (read: false) ลดลงทันทีที่ markRead/markAllRead ทำงาน
  const unread = notifications.filter((n) => !n.read).length;

  const markRead = (id) => {
    setNotifications((prev) => pruneOldRead(
      prev.map((x) => (x.id === id && !x.read) ? { ...x, read: true, readAt: new Date().toISOString() } : x)
    ));
  };

  // ✅ เปิดกล่องแจ้งเตือน/เลื่อนดูแล้ว = ถือว่าอ่านทั้งหมดที่ยังไม่อ่านในตอนนั้น ไม่ต้องกดทีละรายการ
  // (คืน prev เดิมถ้าไม่มีอะไรต้องเปลี่ยน กัน re-render/เขียน localStorage รัวๆ ตอนถูกเรียกถี่ๆ
  // จาก onScroll ที่ยิง event ทุกพิกเซลระหว่างเลื่อน)
  const markAllRead = () => {
    setNotifications((prev) => {
      if (!prev.some((x) => !x.read)) return prev;
      const now = new Date().toISOString();
      return pruneOldRead(prev.map((x) => (x.read ? x : { ...x, read: true, readAt: now })));
    });
  };

  return { notifications, unread, markRead, markAllRead };
}
