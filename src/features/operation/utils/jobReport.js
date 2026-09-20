import moment from "moment";
import { getOverdueGroupKey, isFlaggedDays, isSevereDays } from "@/shared/utils/overdueJobs";

/**
 * jobReport.js — สรุปตัวเลขของ "รายงานงาน" จากรายการงานดิบ
 *
 * ✅ แยกเป็นฟังก์ชันบริสุทธิ์เหมือน utils/expenseReport.js — คำนวณตรงกันทุกครั้ง ทดสอบได้
 *    โดยไม่ต้องเปิดหน้าจอ และหน้าจอเหลือหน้าที่แค่ "วาด" อย่างเดียว
 *
 * ⚠️ ทุกตัวเลขในรายงานนี้นับเป็น "งาน" ไม่ใช่ "แถว" — งานที่เข้าหลายวันไม่ติดกันคือ 1 งาน
 *    (ใช้ getOverdueGroupKey ตัวเดียวกับหน้าการดำเนินงาน/Dashboard) ถ้านับแบบแถว ตัวเลขจะไม่ตรง
 *    กับการ์ดที่ผู้ใช้เห็นในหน้าอื่น แล้วจะกลายเป็น "รายงานที่เชื่อไม่ได้"
 * ⚠️ งานหนึ่งถูกนับเข้าเดือนของ "วันเข้างานครั้งสุดท้าย" — เดือนเดียวกับที่ตรรกะค้างงานใช้
 *    ตัดสิน ตัวเลขรายเดือนกับตัวเลขค้างงานจึงกระทบยอดกันได้
 */

/** ขั้นของงานตามลำดับจริง — ตรงกับ OP_LIST ในหน้าการดำเนินงาน */
export const JOB_STAGES = ["กำลังรอยืนยัน", "ยืนยันแล้ว", "กำลังดำเนินการ", "ดำเนินการเสร็จสิ้น"];

export const STAGE_COLOR = {
  "กำลังรอยืนยัน": "#f59e0b",
  ยืนยันแล้ว: "#3b82f6",
  กำลังดำเนินการ: "#8b5cf6",
  ดำเนินการเสร็จสิ้น: "#10b981",
};

export const DONE_STATUS = "ดำเนินการเสร็จสิ้น";

export const monthKey = (d) => (d ? moment(d).format("YYYY-MM") : "");

/** วันสิ้นสุดจริงของแถวหนึ่ง — allDay เก็บ end แบบ exclusive จึงต้องถอยหนึ่งวัน */
const rowEnd = (e) => (e.end ? moment(e.end).subtract(e.allDay ? 1 : 0, "days") : moment(e.start || e.date));

/**
 * ยุบแถวทั้งหมดให้เหลือ "งานละหนึ่งรายการ"
 * ตัวแทนของงาน = แถวที่วันสิ้นสุดช้าที่สุด (สถานะล่าสุดของงานนั้น)
 */
export const groupJobs = (events = []) => {
  const byKey = new Map();
  events.forEach((e) => {
    const key = getOverdueGroupKey(e);
    const end = rowEnd(e);
    const prev = byKey.get(key);
    if (!prev || end.isAfter(prev.end)) {
      byKey.set(key, { key, end, rows: (prev?.rows || 0) + 1, event: e });
    } else {
      prev.rows += 1;
    }
  });
  return [...byKey.values()];
};

/** เพิ่มยอดลงตารางสรุปหนึ่งช่อง */
const bump = (map, key, patch) => {
  const row = map.get(key) || { key, total: 0, done: 0, overdue: 0 };
  row.total += patch.total || 0;
  row.done += patch.done || 0;
  row.overdue += patch.overdue || 0;
  map.set(key, row);
};

const sortDesc = (map) => [...map.values()].sort((a, b) => b.total - a.total || String(a.key).localeCompare(String(b.key)));

/**
 * @param {Array} events รายการงานดิบจาก /events/event-op
 * @param {object} [opts]
 * @param {Map} [opts.daysPastDueMap] ผลของ buildDaysPastDueMap — ส่งมาเพื่อให้ "ค้างงาน"
 *   ตรงกับหน้าอื่นเป๊ะ · ไม่ส่งมาก็ได้ ตัวเลขค้างงานจะเป็น 0 (ใช้ตอนทดสอบส่วนอื่น)
 * @param {string} [opts.from] / @param {string} [opts.to] ช่วงวัน (YYYY-MM-DD)
 *   ⚠️ ต้องกรอง "หลังยุบเป็นงานแล้ว" เสมอ — ถ้ากรองแถวก่อน งานที่เข้าหลายวันคร่อมขอบช่วงจะถูก
 *      หั่นเหลือบางแถว แล้ว "วันเข้างานครั้งสุดท้าย" กับสถานะล่าสุดจะผิดไปทั้งงาน
 */
export function buildJobReport(events = [], { daysPastDueMap, from, to } = {}) {
  const all = groupJobs(events);
  const jobs = all.filter((j) => {
    if (from && j.end.isBefore(moment(from), "day")) return false;
    if (to && j.end.isAfter(moment(to), "day")) return false;
    return true;
  });

  const byMonth = new Map();
  const bySystem = new Map();
  const byCustomer = new Map();
  const byTeam = new Map();
  const stageCount = Object.fromEntries(JOB_STAGES.map((s) => [s, 0]));

  let done = 0;
  let overdue = 0;
  let warning = 0;
  let visits = 0;

  jobs.forEach((job) => {
    const e = job.event;
    visits += job.rows;

    const isDone = e.status === DONE_STATUS;
    if (isDone) done += 1;
    if (Object.prototype.hasOwnProperty.call(stageCount, e.status)) stageCount[e.status] += 1;

    const entry = daysPastDueMap?.get(e._id);
    const isOverdue = Boolean(entry && isSevereDays(entry.days));
    const isWarning = Boolean(entry && isFlaggedDays(entry.days) && !isSevereDays(entry.days));
    if (isOverdue) overdue += 1;
    if (isWarning) warning += 1;

    const patch = { total: 1, done: isDone ? 1 : 0, overdue: isOverdue ? 1 : 0 };
    bump(byMonth, job.end.format("YYYY-MM"), patch);
    bump(bySystem, e.system || "ไม่ระบุระบบ", patch);
    bump(byCustomer, (e.company || e.site || "ไม่ระบุโครงการ").trim(), patch);
    // ⚠️ ทีมเก็บเป็นข้อความชื่อเดียว (หัวหน้างาน) — ลูกทีมอยู่คนละฟิลด์และไม่ใช่ "เจ้าของงาน"
    bump(byTeam, (e.team || e.responsiblePerson || "ยังไม่มอบหมาย").trim(), patch);
  });

  return {
    total: jobs.length,
    visits,
    done,
    overdue,
    warning,
    inProgress: stageCount["กำลังดำเนินการ"] || 0,
    unconfirmed: stageCount["กำลังรอยืนยัน"] || 0,
    /** สัดส่วนงานที่ปิดแล้ว — ตัวเลขเดียวที่บอก "สุขภาพ" ของคิวงานได้ในแวบเดียว */
    doneRate: jobs.length ? Math.round((done / jobs.length) * 100) : 0,
    pipeline: JOB_STAGES.map((s) => ({ key: s, label: s, count: stageCount[s], color: STAGE_COLOR[s] })),
    // เรียงเดือนจากเก่าไปใหม่ — กราฟแท่งต้องอ่านจากซ้ายไปขวาตามเวลา
    byMonth: [...byMonth.values()].sort((a, b) => a.key.localeCompare(b.key)),
    bySystem: sortDesc(bySystem),
    byCustomer: sortDesc(byCustomer),
    byTeam: sortDesc(byTeam),
  };
}
