/**
 * customerJobs.js — นับ/จัดกลุ่ม "งานของลูกค้า" ที่เดียวทั้งแอป
 *
 * ✅ (17 พ.ย. 2569 ผู้ใช้: "ความสอดคล้องข้อมูลหน้าต่างๆให้สมบูรณ์ ไม่มีผิดพลาดต่อการรวมข้อมูล · ภาพรวมลูกค้า/ทะเบียนลูกค้า ข้อมูลสอดคล้อง")
 *    เดิมแต่ละหน้านับ "งาน" คนละแบบ — ลูกค้ารายเดียวกันได้เลขต่างกัน:
 *      • หน้าแรก "โครงการที่มีงานมากที่สุด" + ทะเบียนลูกค้า = นับทุกแถว (งานเข้า 3 วัน = 3 งาน · รวมนัดฝ่ายขาย)
 *      • ภาพรวมลูกค้า = นับเป็นงาน (jobGroup) แต่รวมนัดฝ่ายขาย
 *    ตอนนี้ทุกหน้าใช้กติกาเดียวกับหน้าการดำเนินงาน/สรุปผลการดำเนินงาน (utils/jobSummary.buildJobs):
 *      1 งาน = 1 กลุ่มงาน (เข้าหลายวันนับ 1) · ไม่นับนัดฝ่ายขาย · ไม่นับงานที่ยังไม่ลงวัน · สถานะ 6 กลุ่มชุดเดียวกัน
 */
import { buildDaysPastDueMap } from "@/shared/utils/overdueJobs";
import { buildJobs, STATUS_GROUPS } from "@/features/operation/utils/jobSummary";

export const normName = (s) => String(s || "").trim().replace(/\s+/g, " ");
/** คีย์ "โครงการ" (บริษัท + โครงการ) — ทะเบียนลูกค้า 1 แถว = 1 โครงการ */
export const projectKey = (company, site) => `${normName(company).toLowerCase()}|${normName(site).toLowerCase()}`;
/** คีย์ "ลูกค้า" — บริษัท ถ้าว่างใช้โครงการ (หน้าภาพรวมลูกค้า) */
export const customerKey = (company, site) => (normName(company) || normName(site)).toLowerCase();

/** งานทั้งหมดจากแถวดิบ — สถานะ/ค้างงานคิดจากงานทั้งหมดก่อนกรอง (เหมือนหน้าการดำเนินงาน) */
export const buildAllJobs = (events = []) => buildJobs(events, buildDaysPastDueMap(events));

const indexBy = (jobs, keyOf) => {
  const m = new Map();
  jobs.forEach((j) => {
    const k = keyOf(j);
    if (!k || k === "|") return;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(j);
  });
  return m;
};
export const jobsByProject = (jobs) => indexBy(jobs, (j) => projectKey(j.company, j.site));
export const jobsByCustomer = (jobs) => indexBy(jobs, (j) => customerKey(j.company, j.site));

/** จำนวนงานต่อสถานะ (6 กลุ่ม ชื่อ/สีเดียวกับหน้าการดำเนินงาน) */
export const statusBreakdown = (jobs = []) => STATUS_GROUPS.map((g) => ({ ...g, count: jobs.filter((j) => j.group === g.key).length }));

/** อันดับโครงการตามจำนวนงาน (หน้าแรก) */
export function rankProjects(jobs = []) {
  return [...jobsByProject(jobs).values()].map((list) => {
    const { company, site } = list[0];
    return {
      company, site,
      name: company && site && company !== site ? `${company} · ${site}` : company || site,
      count: list.length,
      closed: list.filter((j) => j.group === "closed").length,
      overdue: list.filter((j) => j.group === "overdue").length,
    };
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "th"));
}

/** คีย์โครงการที่มีในทะเบียนมากกว่า 1 แถว (ชื่อซ้ำ — ควรลบ/รวม) */
export function duplicateProjectKeys(records = []) {
  const n = new Map();
  records.forEach((r) => { const k = projectKey(r.cCompany, r.cSite); n.set(k, (n.get(k) || 0) + 1); });
  return new Set([...n].filter(([, c]) => c > 1).map(([k]) => k));
}
