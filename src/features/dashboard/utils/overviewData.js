/**
 * overviewData.js — ข้อมูล "ภาพรวมผลงาน" หน้าแรก (จอคอม)
 *
 * ✅ (17 พ.ย. 2569 ผู้ใช้: "หน้านี้ควรเป็น Dashboard แสดงผลงานต่างๆจริงๆให้สอดคล้อง และดูมืออาชีพ
 *    เอาเฉพาะหน้าจอคอมหรือขนาดใหญ่ · มือถือให้เป็นเมนูแบบเดิม")
 *
 * ⚠️ ไม่มีสูตรของตัวเอง — เรียกโมดูลเดียวกับหน้ารายงานทั้งหมด ตัวเลขจึงตรงกันทุกหน้า:
 *    • จำนวนงาน/สถานะ/ค้างงาน/รอตรวจปิด/มูลค่างานของงาน = utils/jobSummary (หน้าสรุปผลการดำเนินงาน · กติกาเดียวกับหน้าการดำเนินงาน)
 *    • ยอดรายคน/ความครบของข้อมูล = utils/workerLog + utils/workerKpi (หน้าผลงานรายบุคคล)
 *    • ค้างงาน = เลยวันเข้างานเกิน 1 สัปดาห์ (buildDaysPastDueMap — คิดจากงานทั้งหมดก่อนกรองช่วง)
 */
import moment from "moment";
import { buildDaysPastDueMap } from "@/shared/utils/overdueJobs";
import { buildJobs, filterJobs, summarizeJobs, STATUS_GROUPS } from "@/features/operation/utils/jobSummary";
import { buildWorkerEntries, filterEntries } from "@/features/operation/utils/workerLog";
import { buildPersonKpis } from "@/features/operation/utils/workerKpi";

/** ช่วงที่เลือกได้บนหน้าแรก */
export const OVERVIEW_PERIODS = [
  ["month", "เดือนนี้"],
  ["lastMonth", "เดือนที่แล้ว"],
  ["year", "ปีนี้"],
];

/** → [from, to] "YYYY-MM-DD" */
export function overviewRange(preset, now = moment()) {
  const f = (m) => m.format("YYYY-MM-DD");
  const n = moment(now);
  if (preset === "lastMonth") return [f(n.clone().subtract(1, "month").startOf("month")), f(n.clone().subtract(1, "month").endOf("month"))];
  if (preset === "year") return [f(n.clone().startOf("year")), f(n.clone().endOf("year"))];
  return [f(n.clone().startOf("month")), f(n.clone().endOf("month"))];
}

/**
 * @param events      งานจาก getEventOp (ตามสิทธิ์ผู้ใช้)
 * @param attendance  บันทึกเข้างาน (ช่วงที่เลือก) — ใช้คิด "กดเข้างานจริง"
 * @param opts        { from, to, today, me } — me = ชื่อผู้ใช้ (fname) เมื่อดูเฉพาะของตัวเอง · ว่าง = ทุกคน
 */
export function buildOverview(events = [], attendance = [], { from, to, today = moment().format("YYYY-MM-DD"), me = "", now = moment() } = {}) {
  const pastDue = buildDaysPastDueMap(events);
  const allJobs = buildJobs(events, pastDue);
  const mine = (j) => !me || (j.workers || []).includes(me) || j.responsible === me;
  const scoped = allJobs.filter(mine);

  // งานในช่วง (นับตามวันเริ่มงาน — เหมือนหน้าสรุปผลการดำเนินงาน)
  const jobs = filterJobs(scoped, { from, to });
  const summary = summarizeJobs(jobs);

  // สถานะ "ตอนนี้" (ไม่จำกัดช่วง) — ตรงกับแท็บของหน้าการดำเนินงาน
  const overdueJobs = scoped.filter((j) => j.group === "overdue");
  const now0 = {
    overdue: overdueJobs.length,
    severe: overdueJobs.filter((j) => j.severe).length,
    pending: scoped.filter((j) => j.group === "pending").length,
    working: scoped.filter((j) => j.group === "working").length,
  };

  // แนวโน้ม 6 เดือนล่าสุด (นับตามวันเริ่มงาน)
  const n = moment(now);
  const tFrom = n.clone().subtract(5, "months").startOf("month").format("YYYY-MM-DD");
  const tTo = n.clone().endOf("month").format("YYYY-MM-DD");
  const trendSummary = summarizeJobs(filterJobs(scoped, { from: tFrom, to: tTo }));
  const trend = Array.from({ length: 6 }, (_, i) => {
    const key = n.clone().subtract(5 - i, "months").format("YYYY-MM");
    const row = trendSummary.byMonth.find((x) => x.key === key);
    return { key, total: row?.total || 0, closed: row?.closed || 0, value: row?.value || 0 };
  });

  // ผลงานรายคน (มูลค่างานที่แต่ละคนทำ) — ช่วงเดียวกัน
  const entries = filterEntries(buildWorkerEntries(events, attendance), { from, to, person: me || "all" });
  const { people, team } = buildPersonKpis(entries, { today });

  return {
    summary,
    statusRows: STATUS_GROUPS.map((g) => ({ ...g, count: summary.statusRows.find((r) => r.key === g.key)?.count || 0 })),
    now: now0,
    trend,
    people,
    team,
  };
}
