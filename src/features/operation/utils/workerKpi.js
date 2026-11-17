/**
 * workerKpi.js — KPI รายช่าง (ที่เดียวทั้งแอป: หน้าผลงานรายบุคคล · Excel · คู่มือวิธีเช็ค)
 *
 * ✅ (17 พ.ย. 2569 ผู้ใช้: "ทำสรุปรายงาน ยอดของแต่ละคนแยกกันให้ชัดเจน และมีวิธีแนะนำว่าจะเช็ค KPI
 *    ของช่างแต่ละคนยังไงให้มีประสิทธิภาพ และไม่มีความผิดพลาด · อันไหนควรทำเป็น Module ให้ทำ แก้ไขทีเดียว")
 *
 * แก้เกณฑ์/คำอธิบาย KPI = แก้ KPI_DEFS ที่เดียว → หน้าจอ · Excel · คู่มือ เปลี่ยนตามกันหมด
 *
 * หลักกันตัวเลขผิด (สรุปจากคู่มือด้านล่าง):
 *   1) อัตรา % คิดจาก "ครั้งที่ผ่านไปแล้ว" (วันสุดท้ายของคนนั้น < วันนี้) — งานที่ยังไม่ถึง/กำลังทำไม่ถูกนับว่าขาด
 *   2) มูลค่า = มูลค่างานที่คนนั้นทำ (ก่อน VAT) ไม่รวมยอดคนอื่น ไม่ใช้มูลค่างานของงาน
 *   3) เฉลี่ย/ต่อวัน หารด้วยเฉพาะครั้งที่ลงมูลค่า — ครั้งที่ยังไม่ลงไม่ดึงค่าเฉลี่ยให้ต่ำลง
 *   4) ข้อมูลไม่ครบ (ลงมูลค่า/กดเข้างานต่ำกว่าเกณฑ์) = ติดป้าย "ยังประเมินไม่ได้" ให้แก้ข้อมูลก่อนเทียบคน
 *
 * ป้อนด้วยแถว "คน × งาน" จาก buildWorkerEntries → filterEntries (utils/workerLog.js)
 */
import moment from "moment";
import { DONE_STATUS } from "./workerLog";

/**
 * นิยาม KPI
 *  unit: baht | count | day | pct · good/warn = เกณฑ์ (pct: ≥good เขียว · ≥warn ส้ม · ต่ำกว่า แดง)
 *  quality: true = ตัวชี้ความครบของข้อมูล (ต้องผ่านก่อนจึงเทียบมูลค่าระหว่างคนได้)
 */
export const KPI_DEFS = [
  { key: "total", label: "มูลค่างานที่ทำ", unit: "baht",
    desc: "ผลรวมมูลค่างานที่คนนั้นทำ (บันทึกเอง) (ก่อน VAT) — ไม่รวมยอดของคนอื่นในทีม และไม่ใช่มูลค่างานของงาน" },
  { key: "visits", label: "เข้างาน", unit: "count", desc: "จำนวนงานที่อยู่ในทีมเข้างาน (งานเดียวเข้าหลายวัน = 1 ครั้ง)" },
  { key: "days", label: "วันทำงาน", unit: "day", desc: "รวมจำนวนวันของทุกช่วงที่คนนั้นอยู่ในทีม" },
  { key: "avgPerVisit", label: "เฉลี่ยต่อครั้ง", unit: "baht", desc: "มูลค่า ÷ จำนวนครั้งที่ลงมูลค่าแล้ว" },
  { key: "perDay", label: "มูลค่าต่อวันทำงาน", unit: "baht",
    desc: "มูลค่า ÷ วันทำงานของครั้งที่ลงมูลค่าแล้ว — ใช้เทียบระหว่างคนได้ยุติธรรมที่สุด (งานหลายวันกับงานวันเดียว)" },
  // scope: self = ของคนนั้นเอง · job = ของงานที่อยู่ในทีม (ทั้งทีมรับผิดชอบร่วมกัน) · num/base = ฟิลด์ตัวตั้ง/ตัวหาร
  { key: "fillRate", label: "ลงมูลค่าครบ", unit: "pct", good: 95, warn: 80, quality: true, scope: "self", num: "pastValued", base: "past",
    desc: "ครั้งที่ผ่านไปแล้วที่ลงมูลค่าของตัวเองแล้ว ÷ ครั้งที่ผ่านไปแล้วทั้งหมด" },
  { key: "checkInRate", label: "กดเข้างานจริง", unit: "pct", good: 90, warn: 70, quality: true, scope: "self", num: "pastChecked", base: "past",
    desc: "ครั้งที่ผ่านไปแล้วที่มีบันทึกกดเข้างาน (พิกัด/เวลา) ของคนนั้น — ยืนยันว่าไปหน้างานจริง" },
  // 🔁 (17 พ.ย. 2569 ผู้ใช้: "ความสอดคล้องข้อมูลหน้าต่างๆ") ขอปิดงานแล้ว (รอแอดมินตรวจ) = ช่างทำส่วนของตัวเองครบแล้ว
  //    นับเป็น "ส่งปิดงานแล้ว" — กติกาเดียวกับกลุ่ม "รอตรวจปิดงาน" ของหน้าการดำเนินงาน (ไม่ใช่ความผิดของช่าง)
  { key: "doneRate", label: "ส่งปิดงานแล้ว", unit: "pct", good: 90, warn: 70, scope: "job", num: "pastDone", base: "past",
    desc: "ครั้งที่ผ่านไปแล้วที่ขอปิดงานแล้ว (รอแอดมินตรวจ) หรือปิด \"ดำเนินการเสร็จสิ้น\" แล้ว" },
  // ✅ (17 พ.ย. 2569 ผู้ใช้: "ความครบของข้อมูลควรมีมากกว่านี้ ให้สมบูรณ์")
  { key: "reportRate", label: "แนบ Service Report", unit: "pct", good: 90, warn: 70, scope: "job", num: "pastReport", base: "reportBase",
    desc: "งานที่ผ่านไปแล้วที่แนบ Service Report และกดยืนยันส่งแล้ว (ทุกงานต้องมีก่อนปิดงาน)" },
  { key: "docsRate", label: "เอกสารงาน PM ครบ", unit: "pct", good: 90, warn: 70, scope: "job", num: "pastDocs", base: "docsBase",
    desc: "งาน PM ต้องมีเอกสารการเงินและใบส่งมอบงาน (นอกจาก Service Report) — กติกาเดียวกับเช็คลิสต์เอกสารในหน้าการดำเนินงาน · งานอื่นไม่นับ" },
  { key: "summaryRate", label: "เขียนสรุปงานที่ทำ", unit: "pct", good: 80, warn: 60, scope: "job", num: "pastSummary", base: "summaryBase",
    desc: "งานที่ผ่านไปแล้วที่มีรายละเอียด/สรุปงานที่ทำ — ใช้ตรวจย้อนหลังว่าเข้าไปทำอะไร" },
  { key: "leadRate", label: "เป็นหัวหน้าทีม", unit: "pct", desc: "ข้อมูลประกอบ (ไม่ใช่เป้า) — สัดส่วนครั้งที่เป็นหัวหน้าทีม" },
];
export const KPI_BY_KEY = Object.fromEntries(KPI_DEFS.map((d) => [d.key, d]));
export const RATE_KPIS = KPI_DEFS.filter((d) => d.unit === "pct" && d.good !== undefined);

/** ขั้นตอนเช็ค KPI ให้แม่นยำ — แสดงในหน้าจอและชีต Excel "วิธีอ่าน KPI" */
export const KPI_GUIDE = [
  // 🔁 (17 พ.ย. 2569 ผู้ใช้: "ให้ดูง่าย เข้าใจง่าย ไม่ซับซ้อน") เหลือ 4 ข้อสั้นๆ
  { title: "เช็คข้อมูลให้ครบก่อน", text: "คอลัมน์ \"ข้อมูล\" ต้องเป็น ✓ ครบ — ถ้าขึ้น \"ต้องแก้\" กดชื่อคนนั้นแล้วแก้งานที่ขาด (ยังไม่ลงมูลค่า / ไม่กดเข้างาน / ยังไม่ปิดงาน)" },
  { title: "ใช้ช่วงเวลาเดียวกันทุกคน", text: "ดูเป็นรายเดือน และเลือกสถานะ \"เสร็จสิ้นแล้ว\" เมื่อจะสรุปผล — งานที่ยังไม่ปิดยอดยังเปลี่ยนได้" },
  { title: "เทียบคนด้วย \"ต่อวันทำงาน\"", text: "ยอดรวมสูงอาจเพราะทำงานหลายวัน — มูลค่าต่อวันทำงานเทียบกันได้ยุติธรรมกว่า" },
  { title: "ดูหลายเดือน แล้วเก็บไฟล์", text: "ดูแนวโน้ม 3 เดือนขึ้นไป และส่งออก Excel เก็บไว้ทุกสิ้นเดือน" },
];

/** เกรดของค่า % ตามเกณฑ์ · null = ไม่มีฐาน (ยังไม่มีครั้งที่ผ่านไปแล้ว) */
export function gradeOf(key, value) {
  const d = KPI_BY_KEY[key];
  if (!d || d.good === undefined || value === null || value === undefined) return "na";
  const pct = value * 100;
  return pct >= d.good ? "good" : pct >= d.warn ? "warn" : "bad";
}
export const GRADE_COLOR = { good: "#15803d", warn: "#b45309", bad: "#dc2626", na: "#94a3b8" };
export const GRADE_BG = { good: "#f0fdf4", warn: "#fffbeb", bad: "#fef2f2", na: "#f8fafc" };

const ratio = (n, d) => (d > 0 ? n / d : null);

/** ประเภทปัญหาข้อมูลที่ต้องแก้ก่อนสรุป KPI */
export const ISSUE_DEFS = {
  missingValue: { label: "ยังไม่ลงมูลค่า", tone: "bad", hint: "เปิดงานแล้วลง \"มูลค่างานของฉัน\" / ผู้รับผิดชอบลงแทน" },
  noCheckIn: { label: "ไม่มีบันทึกกดเข้างาน", tone: "warn", hint: "ตรวจว่าไปจริงไหม · ขอแก้เวลาเข้างาน" },
  notClosed: { label: "เลยวันแล้วยังไม่ขอปิดงาน", tone: "warn", hint: "ตามให้ผู้ปฏิบัติงานกดขอปิดงาน" },
  noReport: { label: "ยังไม่มี Service Report", tone: "warn", hint: "แนบ Service Report แล้วกดยืนยันส่ง ที่เอกสารประจำงาน" },
  docsIncomplete: { label: "เอกสารงาน PM ไม่ครบ", tone: "warn", hint: "แนบเอกสารการเงิน/ใบส่งมอบงาน หรือระบุว่า \"ไม่มี\" ในเช็คลิสต์เอกสาร" },
  noSummary: { label: "ยังไม่มีสรุปงานที่ทำ", tone: "warn", hint: "เขียนสรุปงานที่ทำในหน้างาน" },
  legacy: { label: "ยอดเดิม (ก่อนแยกรายคน)", tone: "na", hint: "ให้คนนั้นลงยอดของตัวเองใหม่" },
};

/**
 * KPI รายคน
 * @param entries แถว "คน × งาน" (กรองแล้ว)
 * @param today   "YYYY-MM-DD" (ทดสอบได้) · ค่าเริ่ม = วันนี้
 * @returns {{ people: object[], team: object }}
 */
export function buildPersonKpis(entries = [], { today = moment().format("YYYY-MM-DD") } = {}) {
  const per = new Map();
  const blank = (name) => ({
    name, visits: 0, lead: 0, days: 0, total: 0, valued: 0, valuedDays: 0, jobs: new Set(),
    past: 0, pastValued: 0, pastChecked: 0, pastDone: 0, pastPending: 0, upcoming: 0, last: "",
    pastReport: 0, reportBase: 0, pastDocs: 0, docsBase: 0, pastSummary: 0, summaryBase: 0,
    // ✅ (17 พ.ย. 2569 ผู้ใช้: "ได้นับยอดรวมทั้งหมดของคนนั้นไหม ไม่ว่างานอะไร ที่มีมูลค่าครั้งนี้ของทุกงาน")
    //    มูลค่างานที่เข้าร่วม = มูลค่าครั้งนี้ของงาน (เต็มจำนวน) รวมทุกงานที่อยู่ในทีม — อ้างอิง ไม่ใช่ยอดรายคน
    //    ทีม: นับงานละครั้ง (jobValueKeys) ไม่ซ้ำตามจำนวนคน
    jobValueSum: 0, jobsWithValue: 0, jobValueKeys: new Set(),
    issues: { missingValue: [], noCheckIn: [], notClosed: [], noReport: [], docsIncomplete: [], noSummary: [], legacy: [] },
  });
  const team = blank("ทุกคน");
  const add = (p, r) => {
    p.visits += 1;
    p.days += r.days || 0;
    p.jobs.add(r.jobKey);
    if (r.lead) p.lead += 1;
    if (r.date > p.last) p.last = r.date;
    if (r.jobValue !== null && r.jobValue !== undefined && !p.jobValueKeys.has(r.jobKey)) {
      p.jobValueKeys.add(r.jobKey); p.jobValueSum += r.jobValue; p.jobsWithValue += 1;
    }
    if (r.value !== null && r.value !== undefined) { p.total += r.value; p.valued += 1; p.valuedDays += r.days || 0; }
    if (r.valueLegacy) p.issues.legacy.push(r);
    const isPast = (r.endDate || r.date) < today;
    if (!isPast) { p.upcoming += 1; return; }
    p.past += 1;
    if (r.value !== null && r.value !== undefined) p.pastValued += 1; else p.issues.missingValue.push(r);
    if (r.checkIns?.length) p.pastChecked += 1; else p.issues.noCheckIn.push(r);
    if (r.done || r.status === DONE_STATUS) p.pastDone += 1;
    else if (r.closeRequested) { p.pastDone += 1; p.pastPending += 1; } // ส่งปิดแล้ว รอแอดมินตรวจ
    else p.issues.notClosed.push(r);
    // ความครบของงาน — null = ไม่รู้ (ไม่มีฟิลด์) ไม่นับ
    if (r.hasReport !== null && r.hasReport !== undefined) { p.reportBase += 1; if (r.hasReport) p.pastReport += 1; else p.issues.noReport.push(r); }
    if (r.docsOk !== null && r.docsOk !== undefined) { p.docsBase += 1; if (r.docsOk) p.pastDocs += 1; else p.issues.docsIncomplete.push(r); }
    if (r.hasSummary !== null && r.hasSummary !== undefined) { p.summaryBase += 1; if (r.hasSummary) p.pastSummary += 1; else p.issues.noSummary.push(r); }
  };
  entries.forEach((r) => {
    if (!per.has(r.name)) per.set(r.name, blank(r.name));
    add(per.get(r.name), r);
    add(team, r);
  });

  const finish = (p, teamTotal) => {
    const out = {
      ...p,
      jobs: p.jobs.size,
      avgPerVisit: ratio(p.total, p.valued),
      perDay: ratio(p.total, p.valuedDays),
      fillRate: ratio(p.pastValued, p.past),
      checkInRate: ratio(p.pastChecked, p.past),
      doneRate: ratio(p.pastDone, p.past),
      reportRate: ratio(p.pastReport, p.reportBase),
      docsRate: ratio(p.pastDocs, p.docsBase),
      summaryRate: ratio(p.pastSummary, p.summaryBase),
      leadRate: ratio(p.lead, p.visits),
      share: teamTotal ? p.total / teamTotal : null,
    };
    out.grades = Object.fromEntries(RATE_KPIS.map((d) => [d.key, gradeOf(d.key, out[d.key])]));
    // ประเมินได้ = ตัวชี้ความครบของข้อมูล (quality) ผ่านเกณฑ์เขียวทุกตัว และมีครั้งที่ผ่านไปแล้ว
    out.reliable = p.past > 0 && KPI_DEFS.filter((d) => d.quality).every((d) => out.grades[d.key] === "good");
    out.issueList = Object.entries(p.issues)
      .filter(([, list]) => list.length)
      .map(([key, list]) => ({ key, ...ISSUE_DEFS[key], count: list.length, entries: list }));
    out.issueCount = out.issueList.filter((x) => x.key !== "legacy").reduce((s, x) => s + x.count, 0);
    return out;
  };
  const teamOut = finish(team, team.total);
  const people = [...per.values()].map((p) => finish(p, team.total));
  // เทียบกับค่าเฉลี่ยทีม (มูลค่าต่อวัน) — เฉพาะเมื่อทั้งคนนั้นและทีมมีฐาน
  people.forEach((p) => { p.vsTeamPerDay = p.perDay !== null && teamOut.perDay ? p.perDay / teamOut.perDay - 1 : null; });
  people.sort((a, b) => b.total - a.total || b.visits - a.visits || a.name.localeCompare(b.name, "th"));
  return { people, team: teamOut };
}

/** เรียงรายชื่อตามมุมมอง: total | perDay | issues */
export function sortPeople(people, by = "total") {
  const list = people.slice();
  if (by === "perDay") list.sort((a, b) => (b.perDay ?? -1) - (a.perDay ?? -1) || b.total - a.total);
  else if (by === "issues") list.sort((a, b) => b.issueCount - a.issueCount || a.name.localeCompare(b.name, "th"));
  else list.sort((a, b) => b.total - a.total || b.visits - a.visits);
  return list;
}

/** ข้อความค่า KPI ตามหน่วย (ใช้ร่วมกันหน้าจอ/Excel) */
export function formatKpi(key, value) {
  const d = KPI_BY_KEY[key];
  if (value === null || value === undefined) return "–";
  if (!d) return String(value);
  if (d.unit === "pct") return `${Math.round(value * 100)}%`;
  if (d.unit === "baht") return `฿${Number(value).toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
  if (d.unit === "day") return `${value} วัน`;
  return `${value} ครั้ง`;
}
