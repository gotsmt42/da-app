import moment from "moment";
import { getOverdueGroupKey } from "@/shared/utils/overdueJobs";

/**
 * workerLog.js — รายงานรายช่าง (บันทึกการเข้างานแยกรายบุคคล)
 *
 * ✅ (4 พ.ย. 2569 ผู้ใช้: "ทำให้ระบบลงแผนงานแยกรายบุคคลต่อช่างอย่างชัดเจน ... ตรวจสอบย้อนหลังว่า
 *    ช่างคนไหนเข้างานที่ไหน มูลค่าต่อครั้ง แยกคน ค้นหาได้ง่าย export ชัดเจน รวมยอดต่อเดือน ปี")
 *
 * หน่วยนับ: 1 แถว = 1 คน × 1 งาน ("ครั้ง")
 *  • งานที่เข้าหลายวัน/หลายช่วง (jobGroupId เดียวกัน) = 1 งาน — คนเดียวไปหลายช่วงก็นับ 1 ครั้ง (นับวันแยกให้)
 *  • ผู้ปฏิบัติงาน = หัวหน้าทีม (team) + ลูกทีม (teamMembers) ของ "แต่ละช่วง" — แต่ละช่วงคนไม่ตรงกันได้
 *  • มูลค่าครั้งนี้ (workValue) — ทุกคนในทีมได้มูลค่างานนั้นเต็มจำนวน (ผู้ใช้เลือก 2 พ.ย. 2569)
 *    ผลรวมรายคนจึงมากกว่ามูลค่างานจริงได้ — ยอด "มูลค่างานจริง" นับงานละครั้งแยกไว้ (jobValueTotal)
 *  • นับเข้าเดือน/ปีตาม "วันแรกที่คนนั้นเข้างานนั้น"
 *  • ไม่นับนัดฝ่ายขาย และงานที่ยังไม่ลงวัน
 */

export const DONE_STATUS = "ดำเนินการเสร็จสิ้น";

const dayStart = (e) => moment(e.start || e.date).startOf("day");
const dayEnd = (e) => {
  if (!e.end) return dayStart(e);
  const end = moment(e.end);
  // allDay เก็บ end แบบ exclusive (เที่ยงคืนของวันถัดไป) — ถอยกลับหนึ่งวัน
  return (e.allDay ? end.subtract(1, "days") : end).startOf("day");
};

/** ผู้ปฏิบัติงานของแถวหนึ่ง — คนที่ 1 = หัวหน้าทีม (ตัดชื่อซ้ำ) */
export const workersOfRow = (e) => [...new Set([e.team, ...((e.teamMembers || []).map((m) => m?.name))].filter(Boolean))];

/** มูลค่างานครั้งนี้ของงาน — ทุกวันในกลุ่มเก็บค่าเดียวกัน ใช้ค่าแรกที่มี · null = ยังไม่ใส่ */
export const workValueOfRows = (rows) => {
  const hit = rows.find((r) => r.workValue !== null && r.workValue !== undefined && r.workValue !== "");
  return hit ? Number(hit.workValue) : null;
};

/** แปลงงานดิบ → แถว "คน × งาน" (เรียงวันล่าสุดก่อน) */
export function buildWorkerEntries(events = []) {
  const jobs = new Map();
  events.forEach((e) => {
    if (!e || e.department === "sales" || e.unscheduled || !(e.start || e.date)) return;
    const key = getOverdueGroupKey(e);
    if (!jobs.has(key)) jobs.set(key, []);
    jobs.get(key).push(e);
  });

  const out = [];
  jobs.forEach((rows, jobKey) => {
    rows.sort((a, b) => dayStart(a) - dayStart(b));
    const latest = rows.reduce((p, r) => (dayEnd(r).isAfter(dayEnd(p)) ? r : p), rows[0]);
    const value = workValueOfRows(rows);
    const teamAll = new Set();
    const per = new Map();
    rows.forEach((r) => workersOfRow(r).forEach((name, i) => {
      teamAll.add(name);
      const x = per.get(name) || { sessions: [], lead: false };
      x.sessions.push(r);
      if (i === 0) x.lead = true;
      per.set(name, x);
    }));
    per.forEach((x, name) => {
      const first = dayStart(x.sessions[0]);
      let last = dayEnd(x.sessions[0]);
      let days = 0;
      x.sessions.forEach((r) => {
        const s = dayStart(r); const e = dayEnd(r);
        if (e.isAfter(last)) last = e;
        days += Math.max(1, e.diff(s, "days") + 1);
      });
      out.push({
        id: `${jobKey}|${name}`,
        jobKey,
        name,
        lead: x.lead,
        date: first.format("YYYY-MM-DD"),
        endDate: last.format("YYYY-MM-DD"),
        sessions: x.sessions.length,
        days,
        value,
        status: latest.status || "",
        done: latest.status === DONE_STATUS,
        company: latest.company || "",
        site: latest.site || "",
        title: latest.title || "",
        system: latest.system || "",
        time: latest.time || "",
        jobNo: latest.jobNo || "",
        eventId: latest._id,
        responsible: latest.responsiblePerson || "",
        teamSize: teamAll.size,
      });
    });
  });
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name, "th"));
}

/**
 * กรองแถว
 * @param from/to   "YYYY-MM-DD" (รวมปลายทั้งสองด้าน) · ว่าง = ไม่จำกัด
 * @param person    "all" | ชื่อ
 * @param q         ค้นหา ชื่อคน/บริษัท/โครงการ/ประเภทงาน/ระบบ/เลขที่งาน
 * @param status    "all" | "done" | "open"
 * @param valueMode "all" | "has" | "missing"
 */
export function filterEntries(entries, { from, to, person = "all", q = "", status = "all", valueMode = "all" } = {}) {
  const kw = q.trim().toLowerCase();
  return entries.filter((r) => {
    if (from && r.date < from) return false;
    if (to && r.date > to) return false;
    if (person !== "all" && r.name !== person) return false;
    if (status === "done" && !r.done) return false;
    if (status === "open" && r.done) return false;
    if (valueMode === "has" && r.value === null) return false;
    if (valueMode === "missing" && r.value !== null) return false;
    if (kw && ![r.name, r.company, r.site, r.title, r.system, r.jobNo].some((v) => String(v || "").toLowerCase().includes(kw))) return false;
    return true;
  });
}

const emptyAgg = (key) => ({ key, visits: 0, lead: 0, days: 0, valued: 0, missing: 0, total: 0, people: new Set(), jobs: new Set(), last: "" });
const add = (agg, r) => {
  agg.visits += 1;
  if (r.lead) agg.lead += 1;
  agg.days += r.days;
  if (r.value === null) agg.missing += 1; else { agg.valued += 1; agg.total += r.value; }
  agg.people.add(r.name);
  agg.jobs.add(r.jobKey);
  if (r.date > agg.last) agg.last = r.date;
};
const finish = (agg) => ({
  ...agg, people: agg.people.size, jobs: agg.jobs.size, avg: agg.valued ? agg.total / agg.valued : 0,
});

/** สรุปตัวเลขทั้งหมดจากแถวที่กรองแล้ว */
export function summarizeEntries(entries = []) {
  const all = emptyAgg("all");
  const byPerson = new Map();
  const byMonth = new Map();
  const byYear = new Map();
  const pivot = new Map(); // ชื่อ → Map(เดือน → { visits, total })
  const jobValues = new Map(); // jobKey → มูลค่า (นับงานละครั้ง)

  entries.forEach((r) => {
    add(all, r);
    const m = r.date.slice(0, 7);
    const y = r.date.slice(0, 4);
    if (!byPerson.has(r.name)) byPerson.set(r.name, emptyAgg(r.name));
    if (!byMonth.has(m)) byMonth.set(m, emptyAgg(m));
    if (!byYear.has(y)) byYear.set(y, emptyAgg(y));
    add(byPerson.get(r.name), r);
    add(byMonth.get(m), r);
    add(byYear.get(y), r);
    if (!pivot.has(r.name)) pivot.set(r.name, new Map());
    const cell = pivot.get(r.name).get(m) || { visits: 0, total: 0 };
    cell.visits += 1; cell.total += r.value || 0;
    pivot.get(r.name).set(m, cell);
    if (r.value !== null) jobValues.set(r.jobKey, r.value);
  });

  const totals = finish(all);
  totals.jobValueTotal = [...jobValues.values()].reduce((s, v) => s + v, 0);
  return {
    totals,
    byPerson: [...byPerson.values()].map(finish).sort((a, b) => b.total - a.total || b.visits - a.visits || a.key.localeCompare(b.key, "th")),
    byMonth: [...byMonth.values()].map(finish).sort((a, b) => a.key.localeCompare(b.key)),
    byYear: [...byYear.values()].map(finish).sort((a, b) => a.key.localeCompare(b.key)),
    months: [...byMonth.keys()].sort(),
    pivot,
  };
}
