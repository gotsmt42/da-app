import moment from "moment";
import { countUsedRounds } from "./contractRounds";

/**
 * contractOverdue.js — จัดกลุ่ม event ด้วย contractGroupId ให้เป็น "สัญญา" (1 แถว/สัญญา) และเช็คว่า
 * รอบล่าสุดผ่านมาเกิน 3 เดือนแล้วแต่ยังไม่ได้วางแผนรอบถัดไปหรือยัง — เดิมโค้ดชุดนี้อยู่ใน
 * ContractOverview.js อย่างเดียว พอต้องใช้ซ้ำอีกจุด (ป้ายสรุปจำนวนที่ Header บนมือถือ) ย้ายมารวมไว้
 * ที่เดียวกันตัวเดียวกับ overdueJobs.js เพื่อกันตรรกะเพี้ยนไม่ตรงกันระหว่างสองจุด
 */

// ✅ งานเก่าที่ยังไม่มี contractGroupId (สร้างก่อนมีฟีเจอร์สัญญา) fallback เป็นสัญญา 1 ครั้งของตัวเอง
export const groupEventsByContract = (events) => {
  const map = new Map();
  events.forEach((e) => {
    const key = e.contractGroupId || `nogid:${e._id}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  });
  return [...map.values()].map((visits) => {
    const sorted = visits.slice().sort((a, b) => (Number(a.time) || 0) - (Number(b.time) || 0));
    const head = sorted[0];
    const teamNames = [head.team, ...(head.teamMembers || []).map((m) => m?.name)]
      .filter(Boolean)
      .filter((name, idx, arr) => arr.indexOf(name) === idx);
    return {
      key: head.contractGroupId || `nogid:${head._id}`,
      isRealContract: Boolean(head.contractGroupId),
      // ✅ งานที่ไม่มี contractGroupId เป็น "งานทั่วไป" ที่ถูกยืนยันแล้ว (เทียบกับ "ยังไม่จัดกลุ่ม" ซึ่ง
      // เป็นค่าเริ่มต้น) ต่อเมื่อกดยืนยันผ่านหน้า "ภาพรวมงาน" เท่านั้น (ดู PUT /events/:id/general)
      isConfirmedGeneral: Boolean(head.isConfirmedGeneral),
      company: head.company,
      site: head.site,
      system: head.system,
      title: head.title,
      contractNo: head.contractNo,
      quotationNo: head.quotationNo,
      contractStart: head.contractStart,
      contractEnd: head.contractEnd,
      visitCount: head.visitCount || sorted.length,
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
