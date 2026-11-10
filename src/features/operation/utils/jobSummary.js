import moment from "moment";
import { workValueNet } from "@/shared/utils/workValue";
import { getOverdueGroupKey, isFlaggedDays, isSevereDays } from "@/shared/utils/overdueJobs";

/**
 * jobSummary.js — "สรุปผลการดำเนินงาน" (แทน jobReport.js เดิม)
 *
 * ✅ (4 พ.ย. 2569 ผู้ใช้: "รายงานงาน ดูแล้วไม่เข้าใจ ข้อมูลไม่สอดคล้อง ดูยาก สับสน แก้ให้สมบูรณ์")
 *    ของเดิมไม่ตรงกับหน้าการดำเนินงาน 3 จุด — แก้ให้ใช้กติกาเดียวกันทั้งหมด:
 *    1) "ค้างงาน" เดิม = เลยกำหนดเกิน 2 สัปดาห์ แต่หน้าการดำเนินงาน = เกิน 1 สัปดาห์ (isFlaggedDays)
 *       → ใช้เกณฑ์เดียวกับหน้าการดำเนินงาน และบอก "เกิน 2 สัปดาห์" เป็นตัวเลขย่อย
 *    2) สถานะเดิมนับซ้อนกัน (กำลังดำเนินการ + ค้างงาน ทับกัน รวมแล้วเกินจำนวนงาน)
 *       → 1 งานอยู่กลุ่มเดียว ลำดับเดียวกับหน้าการดำเนินงาน: เสร็จสิ้น → รอตรวจปิดงาน → ค้างงาน →
 *         กำลังดำเนินการ → ยืนยันแล้ว → รอยืนยัน · ผลรวมทุกกลุ่ม = จำนวนงานพอดี
 *    3) เดือนของงานเดิมคิดจาก "วันเข้างานครั้งสุดท้าย" (ไม่มีใครเดาออก) → ใช้ "วันเริ่มงาน" แทน
 *    + ไม่นับนัดฝ่ายขาย/งานยังไม่ลงวัน (ไม่ใช่งานปฏิบัติการ) · เพิ่มมูลค่างาน (workValue นับงานละครั้ง)
 *
 * หน่วยนับ = "งาน" — งานที่เข้าหลายวันไม่ติดกัน (jobGroupId เดียวกัน) = 1 งาน
 */

export const DONE = "ดำเนินการเสร็จสิ้น";

/** กลุ่มสถานะ — ชื่อ/สี/ลำดับเดียวกับแถบสถานะหน้าการดำเนินงาน */
export const STATUS_GROUPS = [
  { key: "waiting", label: "รอยืนยัน", color: "#d97706", hint: "ยังไม่มีใครยืนยันนัด" },
  { key: "confirmed", label: "ยืนยันแล้ว", color: "#2563eb", hint: "ยืนยันนัดแล้ว รอถึงวันเข้างาน" },
  { key: "working", label: "กำลังดำเนินการ", color: "#7c3aed", hint: "อยู่ระหว่างทำงาน" },
  { key: "pending", label: "รอตรวจปิดงาน", color: "#0891b2", hint: "ช่างขอปิดงานแล้ว รอแอดมินตรวจ" },
  { key: "overdue", label: "ค้างงาน", color: "#dc2626", hint: "เลยวันเข้างานเกิน 1 สัปดาห์ ยังไม่ขอปิด" },
  { key: "closed", label: "เสร็จสิ้น", color: "#059669", hint: "ปิดงานเรียบร้อย" },
];
export const GROUP_BY_KEY = Object.fromEntries(STATUS_GROUPS.map((g) => [g.key, g]));

const dayStart = (e) => moment(e.start || e.date).startOf("day");
const dayEnd = (e) => {
  if (!e.end) return dayStart(e);
  const end = moment(e.end);
  return (e.allDay ? end.subtract(1, "days") : end).startOf("day");
};

const valueOf = (rows) => {
  const hit = rows.find((r) => r.workValue !== null && r.workValue !== undefined && r.workValue !== "");
  return hit ? workValueNet(hit) : null; // 🔁 (10 พ.ย. 2569) ก่อน VAT เสมอ
};
const workersOf = (rows) => [...new Set(rows.flatMap((r) => [r.team, ...((r.teamMembers || []).map((m) => m?.name))]).filter(Boolean))];

/** แปลงแถวดิบ → รายการงาน (1 รายการ = 1 งาน) พร้อมกลุ่มสถานะ */
export function buildJobs(events = [], daysPastDueMap = new Map()) {
  const byKey = new Map();
  events.forEach((e) => {
    if (!e || e.department === "sales" || e.unscheduled || !(e.start || e.date)) return;
    const k = getOverdueGroupKey(e);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(e);
  });
  const jobs = [];
  byKey.forEach((rows, key) => {
    rows.sort((a, b) => dayStart(a) - dayStart(b));
    const latest = rows.reduce((p, r) => (dayEnd(r).isAfter(dayEnd(p)) ? r : p), rows[0]);
    const overdueDays = rows.reduce((m, r) => Math.max(m, daysPastDueMap.get(r._id)?.days ?? -Infinity), -Infinity);
    const flagged = rows.some((r) => isFlaggedDays(daysPastDueMap.get(r._id)?.days));
    const group = rows.every((r) => r.status === DONE) ? "closed"
      : rows.some((r) => r.closeRequested && r.status !== DONE) ? "pending"
        : flagged ? "overdue"
          : rows.some((r) => r.status === "กำลังดำเนินการ") ? "working"
            : rows.some((r) => r.status === "ยืนยันแล้ว") ? "confirmed"
              : "waiting";
    let end = dayEnd(rows[0]);
    rows.forEach((r) => { if (dayEnd(r).isAfter(end)) end = dayEnd(r); });
    jobs.push({
      key,
      eventId: latest._id,
      start: dayStart(rows[0]).format("YYYY-MM-DD"),
      end: end.format("YYYY-MM-DD"),
      visits: rows.length,
      group,
      overdueDays: flagged ? overdueDays : null,
      severe: flagged && isSevereDays(overdueDays),
      value: valueOf(rows),
      jobNo: latest.jobNo || "",
      company: (latest.company || "").trim(),
      site: (latest.site || "").trim(),
      title: latest.title || "",
      system: latest.system || "",
      time: latest.time || "",
      responsible: latest.responsiblePerson || "",
      workers: workersOf(rows),
    });
  });
  return jobs.sort((a, b) => b.start.localeCompare(a.start));
}

/** กรองรายการงาน — from/to เทียบกับวันเริ่มงาน */
export function filterJobs(jobs, { from, to, responsible = "all", system = "all", title = "all", q = "" } = {}) {
  const kw = q.trim().toLowerCase();
  return jobs.filter((j) => {
    if (from && j.start < from) return false;
    if (to && j.start > to) return false;
    if (responsible !== "all" && (j.responsible || "__none__") !== responsible) return false;
    if (system !== "all" && j.system !== system) return false;
    if (title !== "all" && j.title !== title) return false;
    if (kw && ![j.site, j.company, j.jobNo, j.system, j.title, j.responsible, ...j.workers].some((v) => String(v || "").toLowerCase().includes(kw))) return false;
    return true;
  });
}

const emptyRow = (key) => ({ key, total: 0, closed: 0, open: 0, overdue: 0, value: 0, valued: 0, ...Object.fromEntries(STATUS_GROUPS.map((g) => [`g_${g.key}`, 0])) });
const addJob = (row, j) => {
  row.total += 1;
  row[`g_${j.group}`] += 1;
  if (j.group === "closed") row.closed += 1; else row.open += 1;
  if (j.group === "overdue") row.overdue += 1;
  if (j.value !== null) { row.value += j.value; row.valued += 1; }
};
const finish = (r) => ({ ...r, closeRate: r.total ? Math.round((r.closed / r.total) * 100) : 0 });
const groupBy = (jobs, keyOf) => {
  const m = new Map();
  jobs.forEach((j) => { const k = keyOf(j); if (!m.has(k)) m.set(k, emptyRow(k)); addJob(m.get(k), j); });
  return [...m.values()].map(finish);
};
const byTotal = (a, b) => b.total - a.total || String(a.key).localeCompare(String(b.key), "th");

/** สรุปทั้งหมดจากรายการงานที่กรองแล้ว */
export function summarizeJobs(jobs = []) {
  const all = emptyRow("all");
  jobs.forEach((j) => addJob(all, j));
  return {
    totals: { ...finish(all), severe: jobs.filter((j) => j.severe).length, visits: jobs.reduce((s, j) => s + j.visits, 0), missing: all.total - all.valued },
    statusRows: STATUS_GROUPS.map((g) => ({ ...g, count: all[`g_${g.key}`] })),
    byMonth: groupBy(jobs, (j) => j.start.slice(0, 7)).sort((a, b) => b.key.localeCompare(a.key)),
    byYear: groupBy(jobs, (j) => j.start.slice(0, 4)).sort((a, b) => b.key.localeCompare(a.key)),
    bySite: groupBy(jobs, (j) => j.site || j.company || "ไม่ระบุโครงการ").sort(byTotal),
    bySystem: groupBy(jobs, (j) => j.system || "ไม่ระบุระบบ").sort(byTotal),
    byTitle: groupBy(jobs, (j) => j.title || "ไม่ระบุประเภท").sort(byTotal),
    byResponsible: groupBy(jobs, (j) => j.responsible || "ยังไม่มอบหมาย").sort(byTotal),
    overdueJobs: jobs.filter((j) => j.group === "overdue").sort((a, b) => (b.overdueDays || 0) - (a.overdueDays || 0)),
  };
}
