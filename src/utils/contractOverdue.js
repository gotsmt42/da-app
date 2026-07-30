import moment from "moment";
import { countUsedRounds } from "./contractRounds";

/**
 * contractOverdue.js — จัดกลุ่ม event ด้วย contractGroupId ให้เป็น "สัญญา" (1 แถว/สัญญา) และเช็คว่า
 * รอบล่าสุดผ่านมาเกิน 3 เดือนแล้วแต่ยังไม่ได้วางแผนรอบถัดไปหรือยัง — เดิมโค้ดชุดนี้อยู่ใน
 * ContractOverview.js อย่างเดียว พอต้องใช้ซ้ำอีกจุด (ป้ายสรุปจำนวนที่ Header บนมือถือ) ย้ายมารวมไว้
 * ที่เดียวกันตัวเดียวกับ overdueJobs.js เพื่อกันตรรกะเพี้ยนไม่ตรงกันระหว่างสองจุด
 */

// ✅ งานเก่าที่ยังไม่มี contractGroupId (สร้างก่อนมีฟีเจอร์สัญญา) fallback เป็นสัญญา 1 ครั้งของตัวเอง —
// ⚠️ BUG ที่แก้: เดิม fallback ไปที่ _id ของตัวเองตรงๆ เสมอ ทำให้ "งานทั่วไป" ที่เข้าหลายวันไม่ติดกัน
// (ผูกกันด้วย jobGroupId เดียวกันอยู่แล้ว — Operation จัดกลุ่มถูกอยู่แล้วโดยใช้ jobGroupId นี้) โผล่เป็น
// หลายแถวแยกกันในตารางนี้ ทั้งที่จริงเป็นงานเดียวกัน — ต้อง fallback ไปที่ jobGroupId ก่อน ถ้ามี
export const groupEventsByContract = (events) => {
  const map = new Map();
  events.forEach((e) => {
    const key = e.contractGroupId || (e.jobGroupId ? `jgid:${e.jobGroupId}` : `nogid:${e._id}`);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  });
  return [...map.entries()].map(([key, visits]) => {
    const sorted = visits.slice().sort((a, b) => (Number(a.time) || 0) - (Number(b.time) || 0));
    const head = sorted[0];
    const teamNames = [head.team, ...(head.teamMembers || []).map((m) => m?.name)]
      .filter(Boolean)
      .filter((name, idx, arr) => arr.indexOf(name) === idx);
    // ✅ งานที่ไม่มี contractGroupId มี 3 หมวดหมู่: "" (ยังไม่จัดกลุ่ม — ค่าเริ่มต้น) / "general"
    // (งานทั่วไป) / "project" (งานโปรเจค) ต่อเมื่อกดยืนยันผ่านหน้า "ภาพรวมงาน" เท่านั้น (ดู
    // PUT /events/:id/classify) — เดิมมีแค่ isConfirmedGeneral (true/false) ก่อนเพิ่มหมวด "โปรเจค"
    // fallback มาอ่านค่าเก่านี้ด้วยถ้า jobClassification ยังไม่เคยถูกตั้งเลย กันข้อมูลที่ยืนยันไปแล้ว
    // ก่อนหน้านี้หายไป
    const jobClassification = head.jobClassification || (head.isConfirmedGeneral ? "general" : "");
    return {
      key,
      isRealContract: Boolean(head.contractGroupId),
      jobClassification,
      isConfirmedGeneral: jobClassification === "general",
      isConfirmedProject: jobClassification === "project",
      company: head.company,
      site: head.site,
      system: head.system,
      title: head.title,
      contractNo: head.contractNo,
      quotationNo: head.quotationNo,
      contractStart: head.contractStart,
      contractEnd: head.contractEnd,
      // ⚠️ BUG ที่แก้: เดิม fallback ไป sorted.length เสมอเวลา head.visitCount ไม่มีค่า — ตอนนี้งาน
      // ทั่วไปที่เข้าหลายวันไม่ติดกัน (ผูกด้วย jobGroupId) รวมเป็นแถวเดียวที่มีได้มากกว่า 1 document แล้ว
      // (ดู key ด้านบน) ทำให้ visitCount กลายเป็น 2, 3, ... ทั้งที่ไม่ใช่สัญญาเลย แล้วไปดันคอลัมน์
      // "ครั้งที่ 2" ให้โผล่ขึ้นมาทั้งตาราง (maxVisitCount คำนวณรวมทุกแถวในหน้าที่กรองอยู่) — visitCount
      // มีความหมายเฉพาะสัญญาจริงเท่านั้น แถวที่ไม่ใช่สัญญาไม่ควรมีค่านี้เลย
      visitCount: head.contractGroupId ? (head.visitCount || sorted.length) : undefined,
      jobValue: head.jobValue,
      team: teamNames.join(", ") || "-",
      visits: sorted,
    };
  });
};

// ✅ เตือนถ้ารอบล่าสุดผ่านมาเกิน 3 เดือนแล้ว แต่ยังไม่ได้ลงแผนงานครั้งถัดไปเลย (ไม่มีทั้งวันที่จริงและ
// แผนงานล่วงหน้าจองไว้ — countUsedRounds นับรวมแผนงานล่วงหน้าด้วยอยู่แล้ว ถ้าจองไว้แล้วถือว่า "ลงแผนงาน"
// แล้วไม่ต้องเตือน) ช่วยจับงาน PM ที่อาจตกหล่นไปเพราะลืมนัดรอบถัดไป — ไม่เตือนถ้าสัญญาครบจำนวนครั้งแล้ว
// หรือยังไม่เคยมีรอบไหนลงตารางจริงเลยสักครั้ง (ไม่มี "รอบล่าสุด" ให้เทียบ)
export const nextVisitOverdueInfo = (c) => {
  if (!c.isRealContract || !c.visitCount) return null;
  if (countUsedRounds(c.visits) >= c.visitCount) return null;
  const realVisits = c.visits.filter((v) => !v.unscheduled);
  if (realVisits.length === 0) return null;
  const lastVisitDate = realVisits.reduce((latest, v) => {
    const d = moment(v.end || v.start);
    return !latest || d.isAfter(latest) ? d : latest;
  }, null);
  const dueDate = lastVisitDate.clone().add(3, "months");
  if (dueDate.isAfter(moment())) return null;
  return {
    monthsOverdue: Math.max(1, moment().diff(dueDate, "months") + 1),
    lastVisitDate,
  };
};

// ✅ จำนวนสัญญาที่เกินกำหนดวางแผนรอบถัดไป — ใช้เป็นป้ายสรุปจำนวนแบบเบาๆ (เช่น badge บน Header)
// โดยไม่ต้องดึง/จัดกลุ่มข้อมูลซ้ำเองที่ปลายทาง
export const countOverdueContracts = (events) =>
  groupEventsByContract(events).filter((c) => Boolean(nextVisitOverdueInfo(c))).length;
