import moment from "moment";

/**
 * overdueJobs.js — ตรรกะ "ค้างงาน" ที่ใช้ร่วมกันทั่วแอป (Operation, Dashboard, MyJobs)
 * เดิมโค้ดชุดนี้ถูกก็อปกระจายอยู่หลายที่ (Operation/index.js, backend OverdueReminder.js,
 * TeamWorkload.js, Dashboard.js) พอต้องใช้ซ้ำอีกจุด (Dashboard sidebar + MyJobs) เลยรวมมาไว้ที่เดียว
 * ให้ตรรกะ "1 งานที่เข้าหลายวันไม่ติดกัน = 1 งาน คิดค้างจากวันสุดท้าย" ตรงกันทุกจุดแน่นอน
 */

// ✅ เลย 1 สัปดาห์ = เริ่ม "แจ้งเตือน" ให้ทันเห็นก่อน, เลย 2 สัปดาห์ = "ค้างงาน" เต็มตัว
// (งานที่ปิดแล้ว/รออนุมัติปิดอยู่แล้ว ไม่ถือว่าค้าง)
export const WARNING_DAYS_AFTER_END = 7;
export const OVERDUE_DAYS_AFTER_END = 14;

// ✅ ลายเซ็นจัดกลุ่มงานที่เข้าหลายวันไม่ติดกัน (jobGroupId ก่อน ไม่มีก็ fallback ไปจับคู่
// company/site/title/system/team/time) — ใช้ตัวเดียวกันทุกจุดที่ต้องคิด "1 งาน"
export const getOverdueGroupKey = (ev) => {
  if (ev.jobGroupId) return `gid:${ev.jobGroupId}`;
  return ["company", "site", "title", "system", "team", "time"]
    .map((k) => (ev[k] || "").toString().trim().toLowerCase())
    .join("|");
};

// ✅ งานที่เข้าหลายวันไม่ติดกันต้องคิด "ค้างงาน" จากวันสุดท้ายของทั้งชุดเท่านั้น ไม่ใช่คิดแยกทีละแถว
// เพราะแถวที่วันที่ผ่านไปแล้วแต่ยังไม่ใช่วันสุดท้ายของงาน ยังไม่ถือว่าเลยกำหนดจริง
// คืน Map<eventId, {days, groupKey}|null> (null = ปิดแล้ว/ขอปิดแล้ว ไม่ถือว่าค้าง)
export const buildDaysPastDueMap = (allEvents) => {
  const bySignature = new Map();
  allEvents.forEach((e) => {
    const key = getOverdueGroupKey(e);
    if (!bySignature.has(key)) bySignature.set(key, []);
    bySignature.get(key).push(e);
  });

  const map = new Map();
  bySignature.forEach((sessions, groupKey) => {
    let lastPlanEnd = null;
    sessions.forEach((e) => {
      const end = e.end
        ? moment(e.end).subtract(e.allDay ? 1 : 0, "days")
        : moment(e.start);
      if (!lastPlanEnd || end.isAfter(lastPlanEnd)) lastPlanEnd = end;
    });
    const days = moment().startOf("day").diff(lastPlanEnd.startOf("day"), "days");
    sessions.forEach((e) => {
      const exempt = e.status === "ดำเนินการเสร็จสิ้น" || e.closeRequested;
      map.set(e._id, exempt ? null : { days, groupKey });
    });
  });
  return map;
};

// ✅ "เกิน" 1/2 สัปดาห์ ต้องนับวันที่ล่วงเลยมาแล้วจริงๆ เท่านั้น — วันที่ครบพอดี 7/14 วัน (เช่น
// งานครบกำหนดเมื่อ 14 วันก่อนพอดิบพอดี) ยังไม่ถือว่า "เกิน" 2 สัปดาห์ ต้องเลยมาอีกอย่างน้อย 1 วัน
// (>15+) ถึงจะนับ ใช้ > แทน >= เพื่อไม่ให้วันที่ครบพอดีถูกนับเป็น "เกิน" ก่อนเวลาจริง
export const isFlaggedDays = (days) => days !== null && days !== undefined && days > WARNING_DAYS_AFTER_END;
export const isSevereDays = (days) => days !== null && days !== undefined && days > OVERDUE_DAYS_AFTER_END;

// ✅ นับจำนวน "งาน" ที่เข้าเกณฑ์ (จัดกลุ่มก่อนนับ ไม่ใช่นับทุกแถว) — งานหลายวันไม่ติดกัน 3 แถว
// ที่จริงคือ "งานเดียว" ต้องนับเป็น 1 ให้ตรงกับที่การ์ดแสดงจริง (1 การ์ดต่อ 1 งาน)
export const countFlaggedJobs = (allEvents, daysPastDueMap, thresholdCheck) => {
  const seen = new Set();
  let count = 0;
  allEvents.forEach((e) => {
    const entry = daysPastDueMap.get(e._id);
    if (!entry || !thresholdCheck(entry.days) || seen.has(entry.groupKey)) return;
    seen.add(entry.groupKey);
    count++;
  });
  return count;
};

// ✅ นับจำนวน "งาน" ที่เข้าเงื่อนไข predicate (จัดกลุ่มก่อนนับเหมือน countFlaggedJobs) — ใช้กับ
// เงื่อนไขทั่วไปที่ไม่ได้อิง daysPastDueMap (เช่น "รอคุณอนุมัติ"/"เสร็จสิ้น"/"กำลังดำเนินการ")
// งานที่เข้าหลายวันไม่ติดกัน (jobGroupId เดียวกัน) ต้องนับเป็น 1 งานเสมอ ไม่ใช่นับทุกแถว/ทุกวัน
export const countDistinctJobs = (allEvents, predicate) => {
  const seen = new Set();
  let count = 0;
  allEvents.forEach((e) => {
    if (!predicate(e)) return;
    const key = getOverdueGroupKey(e);
    if (seen.has(key)) return;
    seen.add(key);
    count++;
  });
  return count;
};

// ✅ หาเจ้าของงานจริงด้วยลำดับความสำคัญเดียวกับที่ backend ใช้ตัดสินว่า "งานนี้ของช่างคนไหน"
// (resPerson ตรงๆ → ชื่อทีมตรงกับ fname → คนที่สร้าง event เอง) รับ Map ที่สร้างไว้ล่วงหน้าเพื่อ
// ไม่ต้อง build ซ้ำทุกครั้งที่เรียก
export const resolveAssignedTechnician = (sessions, userById, userByFname) => {
  for (const e of sessions) if (e.resPerson && userById.has(e.resPerson.toString())) return userById.get(e.resPerson.toString());
  for (const e of sessions) if (e.team && userByFname.has(e.team)) return userByFname.get(e.team);
  for (const e of sessions) if (e.userId && userById.has(e.userId.toString())) return userById.get(e.userId.toString());
  return null;
};

// ✅ คำนวณว่า event หนึ่งควรตรงกับ "แท็บกลุ่มสถานะ" ไหนในหน้า Operation (pending/active/
// overdue/closed) — ต้องตรงกับตรรกะจริงใน Operation/index.js (ดู filteredEvents) เป๊ะๆ ไม่งั้น
// ลิงก์จากที่อื่น (Dashboard, Customer, การแจ้งเตือน ฯลฯ) จะพาไปหน้า Operation แล้วแท็บที่
// ไฮไลต์ไม่ตรงกับงานที่กำลังดูอยู่จริง (เช่น กดงาน "เสร็จสิ้น" แต่แท็บ "รอคุณอนุมัติ" ติดสว่างแทน)
// isOverdue: ส่งมาจากจุดที่รู้อยู่แล้วว่างานนี้ค้างงาน (เช่นคำนวณจาก buildDaysPastDueMap ไว้ก่อนแล้ว)
export const resolveOperationGroup = (job, isOverdue = false) => {
  if (!job) return "";
  if (isOverdue) return "overdue";
  if (job.status === "ดำเนินการเสร็จสิ้น") return "closed";
  if (job.closeRequested) return "pending";
  if (["ยืนยันแล้ว", "กำลังดำเนินการ"].includes(job.status)) return "active";
  // "กำลังรอยืนยัน" (ยังไม่ยืนยันงานเลย) ไม่มีแท็บกลุ่มไหนตรงกับสถานะนี้โดยตรง — ปล่อยว่างไว้
  // ดีกว่าให้แท็บที่ไม่ตรงความจริงติดสว่างขึ้นมาแทน
  return "";
};
