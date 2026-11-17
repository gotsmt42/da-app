import { getOverdueGroupKey } from "@/shared/utils/overdueJobs";
import { personValueOf, jobWorkValueNet } from "@/shared/utils/workValue";
import { JOB_DOC_TYPES, isDocRequired, isDocComplete } from "@/shared/utils/jobDocTypes";
import { jobDayStart as dayStart, jobDayEnd as dayEnd, jobDayCount } from "@/shared/utils/jobDays";

/**
 * ✅ (17 พ.ย. 2569 ผู้ใช้: "ความครบของข้อมูลควรมีมากกว่านี้ ให้สมบูรณ์") ความครบของ "งาน" (ทั้งทีม)
 *    Service Report · เอกสารครบตามประเภทงาน (กติกาเดียวกับเช็คลิสต์เอกสารในหน้าการดำเนินงาน) · สรุปงานที่ทำ
 *    คืน null = ข้อมูลชุดนี้ไม่มีฟิลด์ (server เก่ายังไม่ส่งมา) → ไม่นับ ไม่กล่าวหาว่าขาด
 */
export function jobCompleteness(rows) {
  const known = rows.some((r) => r.reportFiles !== undefined || r.documentSentReport !== undefined);
  const knownSummary = rows.some((r) => r.description !== undefined || r.workNote !== undefined);
  const latest = rows[rows.length - 1] || {};
  // เอกสารอื่นที่งานนี้ต้องมีนอกจาก Service Report (งาน PM = เอกสารการเงิน + ใบส่งมอบงาน) — ไม่ต้องมี = ไม่นับ
  const others = JOB_DOC_TYPES.filter((t) => t.key !== "report" && isDocRequired(latest, t.key));
  return {
    hasReport: known ? rows.some((r) => isDocComplete(r, "report")) : null,
    docsOk: known && others.length ? others.every((t) => rows.some((r) => isDocComplete(r, t.key))) : null,
    hasSummary: knownSummary ? rows.some((r) => String(r.description || r.workNote || "").trim().length > 0) : null,
  };
}

/**
 * workerLog.js — รายงานรายช่าง (บันทึกการเข้างานแยกรายบุคคล)
 *
 * ✅ (4 พ.ย. 2569 ผู้ใช้: "ทำให้ระบบลงแผนงานแยกรายบุคคลต่อช่างอย่างชัดเจน ... ตรวจสอบย้อนหลังว่า
 *    ช่างคนไหนเข้างานที่ไหน มูลค่าต่อครั้ง แยกคน ค้นหาได้ง่าย export ชัดเจน รวมยอดต่อเดือน ปี")
 *
 * หน่วยนับ: 1 แถว = 1 คน × 1 งาน ("ครั้ง")
 *  • งานที่เข้าหลายวัน/หลายช่วง (jobGroupId เดียวกัน) = 1 งาน — คนเดียวไปหลายช่วงก็นับ 1 ครั้ง (นับวันแยกให้)
 *  • ผู้ปฏิบัติงาน = หัวหน้าทีม (team) + ลูกทีม (teamMembers) ของ "แต่ละช่วง" — แต่ละช่วงคนไม่ตรงกันได้
 *  • 🔁 (17 พ.ย. 2569 ผู้ใช้: "คนที่ 1 ลง 5000 คนที่ 2 ลง 3000 แล้วไม่รวมมูลค่ากัน ให้แยกตามคน")
 *    มูลค่าของแถว (value) = มูลค่างานที่คนนั้นทำ (workerValues · ก่อน VAT) — เดิมทุกคนได้ workValue ของงานเต็มจำนวน
 *    ข้อมูลเดิมที่ยังไม่มีรายคน: ยอดเดิมนับให้ "คนที่ลง" (workValueBy) เท่านั้น · คนอื่น = ยังไม่ใส่
 *    มูลค่างานของงาน (workValue · ก่อน VAT) แยกไว้ใน jobValue / jobValueTotal (นับงานละครั้ง — ไม่ใช่ผลรวมรายคน)
 *  • นับเข้าเดือน/ปีตาม "วันแรกที่คนนั้นเข้างานนั้น"
 *  • ไม่นับนัดฝ่ายขาย และงานที่ยังไม่ลงวัน
 */

export const DONE_STATUS = "ดำเนินการเสร็จสิ้น";

/** ผู้ปฏิบัติงานของแถวหนึ่ง — คนที่ 1 = หัวหน้าทีม (ตัดชื่อซ้ำ) */
export const workersOfRow = (e) => [...new Set([e.team, ...((e.teamMembers || []).map((m) => m?.name))].filter(Boolean))];

/** มูลค่างานของงาน (ก่อน VAT) — ทุกวันในกลุ่มเก็บค่าเดียวกัน ใช้ค่าแรกที่มี · null = ยังไม่ใส่ */
export const workValueOfRows = jobWorkValueNet;

/** ชื่อใน attendance เป็น "ชื่อ นามสกุล" — เทียบกับชื่อในทีม (ชื่อเล่น/ชื่อจริงคำแรก) */
const sameName = (full, name) => full === name || String(full || "").split(" ")[0] === name;

/**
 * แปลงงานดิบ → แถว "คน × งาน" (เรียงวันล่าสุดก่อน)
 * @param attendance แถวบันทึกเข้างาน (GET /attendance) — ✅ (4 พ.ย. 2569 ผู้ใช้: "เข้างานแยกรายคน ... ให้สอดคล้องกับที่จะแยกดูผลงาน และมูลค่างานแยกคน")
 *        ใส่มา = แต่ละแถวรู้ว่าคนนั้น "กดเข้างานจริง" กี่วัน เวลาไหน (checkIns) · ไม่ใส่ = checkIns ว่าง
 */
export function buildWorkerEntries(events = [], attendance = []) {
  const attByEvent = new Map();
  (attendance || []).forEach((a) => {
    const k = String(a.eventId);
    if (!attByEvent.has(k)) attByEvent.set(k, []);
    attByEvent.get(k).push(a);
  });
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
    const jobValue = workValueOfRows(rows);
    const complete = jobCompleteness(rows);
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
        const e = dayEnd(r);
        if (e.isAfter(last)) last = e;
        days += jobDayCount(r);
      });
      const ids = new Set(x.sessions.map((r) => String(r._id)));
      const member = x.sessions.flatMap((r) => r.teamMembers || []).find((m) => m?.name === name);
      const checkIns = [...ids].flatMap((id) => attByEvent.get(id) || [])
        .filter((a) => a.checkIn?.at && ((member?.userId && String(a.userId) === String(member.userId)) || sameName(a.userName, name)))
        .map((a) => a.checkIn.at)
        .sort();
      out.push({
        id: `${jobKey}|${name}`,
        checkIns,
        jobKey,
        name,
        lead: x.lead,
        date: first.format("YYYY-MM-DD"),
        endDate: last.format("YYYY-MM-DD"),
        sessions: x.sessions.length,
        days,
        ...(() => {
          const pv = personValueOf(rows, name);
          return { value: pv ? pv.net : null, valueLegacy: Boolean(pv?.legacy) };
        })(),
        jobValue,
        status: latest.status || "",
        done: latest.status === DONE_STATUS,
        // ✅ (17 พ.ย. 2569) ขอปิดงานแล้ว รอแอดมินตรวจ — กติกาเดียวกับกลุ่ม "รอตรวจปิดงาน" ของหน้าการดำเนินงาน
        closeRequested: rows.some((r) => r.closeRequested && r.status !== DONE_STATUS),
        ...complete,
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

const emptyAgg = (key) => ({ key, visits: 0, lead: 0, days: 0, valued: 0, missing: 0, total: 0, checked: 0, checkInDays: 0, people: new Set(), jobs: new Set(), last: "" });
const add = (agg, r) => {
  agg.visits += 1;
  if (r.checkIns?.length) { agg.checked += 1; agg.checkInDays += r.checkIns.length; }
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
    if (r.jobValue !== null && r.jobValue !== undefined) jobValues.set(r.jobKey, r.jobValue);
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
