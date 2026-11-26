/**
 * contractPlan.js — "แผนงานทั้งปี" ของสัญญา (คำนวณล้วน ไม่มี UI)
 *
 * ✅ (26 พ.ย. 2569 ผู้ใช้: "อยากให้หน้าภาพรวมงานสามารถกดออกแผนงานทั้งปีโดยคำนวณจากการเข้างาน ระบุเดือนของ
 *    ครั้งที่ 1 แล้ว เดือนต่อๆ ไปให้คำนวณตามจำนวนทุกกี่เดือน ปี ที่ระบุไว้อยู่แล้ว … และต่อเป็นต่อปีด้วยนะ")
 *
 * กติกา:
 *   เดือนของครั้งที่ i = เดือนครั้งที่ 1 + (i − 1) × รอบเข้า (intervalMonths) — ต่อเนื่องทุกปีของสัญญา
 *   แก้เดือนรายครั้งเองได้ (planMonths[i − 1]) — ไม่แก้ = ใช้ค่าที่คำนวณ ("ใส่ค่าที่คำนวณมาก่อน")
 *   จำนวนครั้ง = totalRoundsOf (ปีละ N ครั้ง × จำนวนปี) · ป้าย "1/4 - 2569-70" = formatRoundLabel ตัวเดียวกับทั้งระบบ
 *   "ต่อเป็นต่อปี": สัญญาหลายปีเรียงต่อกันทุกปี · สัญญาที่ต่อจากฉบับเดิม เดาเดือนครั้งที่ 1 ต่อจากแผนฉบับเดิม
 *                  และดูล่วงหน้าปีถัดไปได้ (extraYears) สำหรับสัญญาที่ยังไม่ต่อ
 * เดือนเก็บเป็นสตริง "YYYY-MM" (ค.ศ.) — แสดงผลเป็น พ.ศ. ผ่าน thaiMonthLabel
 */
import moment from "moment";
import { contractYearsOf, perYearOf, totalRoundsOf, formatRoundLabel, contractYearLabel, DEFAULT_INTERVAL_MONTHS } from "./contractRounds";

export const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export const TH_MONTHS_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
export const DONE_STATUS = "ดำเนินการเสร็จสิ้น";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const isMonthKey = (v) => MONTH_RE.test(String(v || ""));
export const monthKeyOf = (d) => {
  if (!d) return "";
  const m = moment(d);
  return m.isValid() ? m.format("YYYY-MM") : "";
};
const parts = (key) => key.split("-").map(Number);
export const addMonthsKey = (key, n) => {
  const [y, m] = parts(key);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
};
/** b − a เป็นจำนวนเดือน */
export const monthDiff = (a, b) => {
  const [ay, am] = parts(a);
  const [by, bm] = parts(b);
  return (by * 12 + bm) - (ay * 12 + am);
};
/** "2026-03" → "มี.ค. 69" · full → "มีนาคม 2569" */
export const thaiMonthLabel = (key, { full = false, longYear = full } = {}) => {
  if (!isMonthKey(key)) return "-";
  const [y, m] = parts(key);
  const be = y + 543;
  return `${(full ? TH_MONTHS_FULL : TH_MONTHS)[m - 1]} ${longYear ? be : String(be).slice(-2)}`;
};

/** รอบเข้า (เดือน) ที่ใช้คำนวณ — ไม่ได้ตั้งไว้: ใช้ 12 ÷ ปีละกี่ครั้ง (ถ้าหารลงตัว) ไม่งั้นค่าเริ่มต้น 3 เดือน */
export const planIntervalOf = (c) => {
  const n = Number(c?.intervalMonths);
  if (n >= 1) return { interval: n, assumed: false };
  const per = perYearOf(c);
  if (per >= 1 && 12 % per === 0) return { interval: 12 / per, assumed: true };
  return { interval: DEFAULT_INTERVAL_MONTHS, assumed: true };
};

const scheduledVisits = (c) => (c?.visits || []).filter((v) => !v.unscheduled && v.start);

/**
 * เดือนครั้งที่ 1 ที่แนะนำ — ลำดับ: ที่บันทึกไว้ → คิดย้อนจากครั้งที่ลงตารางแล้ว → ต่อจากแผนสัญญาฉบับเดิม → วันเริ่มสัญญา
 * @param {object} [opts.prev] สัญญาฉบับก่อน (ที่ต่อมาเป็นฉบับนี้) — ใช้ต่อแผนข้ามปี
 * @returns {{ month: string, source: "saved"|"visits"|"renewal"|"start"|"none", note: string }}
 */
export const suggestFirstMonth = (c, { prev = null, today = new Date() } = {}) => {
  if (isMonthKey(c?.planFirstMonth)) return { month: c.planFirstMonth, source: "saved", note: "ใช้เดือนที่บันทึกไว้กับสัญญา" };
  const { interval } = planIntervalOf(c);
  const timed = scheduledVisits(c)
    .map((v) => ({ t: Number(v.time), month: monthKeyOf(v.start), start: new Date(v.start).getTime() }))
    .filter((v) => Number.isInteger(v.t) && v.t >= 1 && v.month)
    .sort((a, b) => a.t - b.t || a.start - b.start);
  if (timed.length) {
    const first = timed[0];
    return {
      month: addMonthsKey(first.month, -(first.t - 1) * interval),
      source: "visits",
      note: first.t === 1 ? "จากเดือนที่เข้าครั้งที่ 1 จริง" : `คิดย้อนจากครั้งที่ ${first.t} ที่ลงตารางแล้ว`,
    };
  }
  const startMonth = monthKeyOf(c?.contractStart);
  if (prev) {
    const prevPlan = buildContractPlan(prev, suggestFirstMonth(prev, { today }).month, { today });
    if (prevPlan.rounds.length) {
      const next = addMonthsKey(prevPlan.rounds[prevPlan.rounds.length - 1].month, interval);
      if (!startMonth || monthDiff(startMonth, next) >= 0) {
        return { month: next, source: "renewal", note: `ต่อจากแผนสัญญาเดิม${prev.contractNo ? ` ${prev.contractNo}` : ""} (ทุก ${interval} เดือนต่อเนื่อง)` };
      }
    }
  }
  if (startMonth) return { month: startMonth, source: "start", note: "เดือนเริ่มสัญญา (ยังไม่ได้ระบุ)" };
  return { month: monthKeyOf(today), source: "none", note: "ยังไม่มีวันเริ่มสัญญา — ใช้เดือนปัจจุบัน" };
};

/** สถานะของแต่ละครั้งในแผน — ป้าย/สีชุดเดียวทั้งหน้าจอ PDF และ Excel */
export const PLAN_STATES = {
  done: { label: "เข้าแล้ว", color: "#15803d", bg: "#f0fdf4" },
  scheduled: { label: "ลงตารางแล้ว", color: "#2563eb", bg: "#eff6ff" },
  due: { label: "ถึงเดือนนี้ · ยังไม่ลงตาราง", short: "ถึงเดือนนี้", color: "#b45309", bg: "#fffbeb" },
  overdue: { label: "เลยเดือนแล้ว · ยังไม่ลงตาราง", short: "เลยเดือนแล้ว", color: "#b91c1c", bg: "#fef2f2" },
  planned: { label: "ยังไม่ถึงเดือน", color: "#475569", bg: "#f8fafc" },
  projected: { label: "ปีถัดไป (ถ้าต่อสัญญา)", short: "ปีถัดไป", color: "#64748b", bg: "#ffffff" },
};

/**
 * แผนทุกครั้งของสัญญา
 * @param {string} firstMonth "YYYY-MM"
 * @param {number} [opts.extraYears] ดูล่วงหน้าต่ออีกกี่ปี (ประมาณการถ้าต่อสัญญา)
 * @param {string[]} [opts.overrides] เดือนที่แก้เองรายครั้ง (ไม่ส่ง = c.planMonths ที่บันทึกไว้)
 */
export function buildContractPlan(c, firstMonth, { today = new Date(), extraYears = 0, overrides } = {}) {
  const ov = Array.isArray(overrides) ? overrides : Array.isArray(c?.planMonths) ? c.planMonths : [];
  const { interval, assumed } = planIntervalOf(c);
  const years = contractYearsOf(c);
  const total = totalRoundsOf(c) || Number(c?.visitCount) || (12 % interval === 0 ? (12 / interval) * years : 0);
  const per = perYearOf(c) || Math.max(1, Math.round(total / years)) || 1;
  const nowKey = monthKeyOf(today);
  const startKey = monthKeyOf(c?.contractStart);
  const endKey = monthKeyOf(c?.contractEnd);
  const visits = scheduledVisits(c);
  const empty = { interval, intervalAssumed: assumed, years, total, per, firstMonth, rounds: [], groups: [], nextYearFirst: "", issues: [] };
  if (!isMonthKey(firstMonth) || total < 1) return empty;

  const count = total + Math.max(0, Math.min(5, extraYears)) * per;
  const rounds = [];
  for (let i = 1; i <= count; i += 1) {
    const projected = i > total;
    const computedMonth = addMonthsKey(firstMonth, (i - 1) * interval);
    const manualMonth = !projected && i > 1 && isMonthKey(ov[i - 1]) && ov[i - 1] !== computedMonth ? ov[i - 1] : "";
    const month = manualMonth || computedMonth;
    const own = projected ? [] : visits.filter((v) => Number(v.time) === i).sort((a, b) => new Date(a.start) - new Date(b.start));
    const done = own.length > 0 && own.every((v) => v.status === DONE_STATUS);
    let state;
    if (own.length) state = done ? "done" : "scheduled";
    else if (projected) state = "projected";
    else if (monthDiff(month, nowKey) > 0) state = "overdue";
    else if (month === nowKey) state = "due";
    else state = "planned";
    const actualMonth = own.length ? monthKeyOf(own[0].start) : "";
    const yearIdx = Math.ceil(i / per);
    rounds.push({
      time: i,
      inYear: ((i - 1) % per) + 1,
      yearIdx,
      month,
      computedMonth,
      manual: Boolean(manualMonth),
      label: formatRoundLabel(i, total, c),
      projected,
      state,
      visits: own,
      actualMonth,
      shift: actualMonth ? monthDiff(month, actualMonth) : 0,
      beforeStart: !projected && Boolean(startKey) && monthDiff(startKey, month) < 0,
      afterEnd: !projected && Boolean(endKey) && monthDiff(endKey, month) > 0,
    });
  }

  const groups = [];
  rounds.forEach((r) => {
    let g = groups[groups.length - 1];
    if (!g || g.yearIdx !== r.yearIdx) {
      g = { yearIdx: r.yearIdx, label: contractYearLabel(c, r.yearIdx) || `ปีที่ ${r.yearIdx}`, projected: r.projected, fromMonth: r.month, rounds: [] };
      groups.push(g);
    }
    g.rounds.push(r);
  });

  const real = rounds.filter((r) => !r.projected);
  const issues = [];
  const late = real.filter((r) => r.afterEnd);
  const early = real.filter((r) => r.beforeStart);
  if (late.length) issues.push(`ครั้งที่ ${late.map((r) => r.label).join(", ")} เลยวันสิ้นสุดสัญญา — ลองเลื่อนเดือนครั้งที่ 1 ให้เร็วขึ้น`);
  if (early.length) issues.push(`ครั้งที่ ${early.map((r) => r.label).join(", ")} อยู่ก่อนวันเริ่มสัญญา`);
  const last = real[real.length - 1];
  return {
    ...empty,
    rounds,
    groups,
    issues,
    lastMonth: last ? last.month : "",
    nextYearFirst: last ? addMonthsKey(last.month, interval) : "",
  };
}

/**
 * ✅ (26 พ.ย. 2569 ผู้ใช้: "ทำให้สามารถติดตามแผนงานทั้งปีที่ส่งไปแล้ว มีการลงตามนี้จริงไหม")
 * แผนที่ส่งลูกค้าแล้ว — รวมทุกใบ (ใบหลังสุดชนะรายครั้ง) → Map ครั้งที่ → { month, doc }
 */
export const sentPlanOf = (c) => {
  const docs = [...(c?.planSentDocs || [])].sort((a, b) => new Date(a.issuedAt || 0) - new Date(b.issuedAt || 0));
  const byTime = new Map();
  docs.forEach((d) => (d.rows || []).forEach((r) => {
    const t = Number(r.time);
    if (isMonthKey(r.month) && Number.isInteger(t) && t >= 1) byTime.set(t, { month: r.month, doc: d });
  }));
  return { docs, byTime, last: docs[docs.length - 1] || null };
};

/** เทียบการลงงานจริงกับเดือนที่แจ้งลูกค้า */
export const ADHERENCE = {
  ontime: { label: "ตรงตามที่แจ้ง", short: "ตรงแผน", color: "#15803d", bg: "#f0fdf4" },
  shifted: { label: "คลาดจากที่แจ้ง", short: "คลาด", color: "#b45309", bg: "#fffbeb" },
  missed: { label: "เลยเดือนที่แจ้ง · ยังไม่ลงงาน", short: "เลยเดือน", color: "#b91c1c", bg: "#fef2f2" },
  due: { label: "ถึงเดือนที่แจ้ง · ยังไม่ลงงาน", short: "เดือนนี้", color: "#b45309", bg: "#fffbeb" },
  upcoming: { label: "ยังไม่ถึงเดือนที่แจ้ง", short: "ยังไม่ถึง", color: "#475569", bg: "#f8fafc" },
};

/**
 * @returns {{ rows: Map<number, {sentMonth, status, diff, docNumber}>, counts: {total, ontime, shifted, missed, due, upcoming, problem} }}
 *   problem = คลาด + เลยเดือน (ต้องตามงาน)
 */
export const adherenceOf = (plan, sent, today = new Date()) => {
  const nowKey = monthKeyOf(today);
  const rows = new Map();
  const counts = { total: 0, ontime: 0, shifted: 0, missed: 0, due: 0, upcoming: 0, problem: 0 };
  (plan?.rounds || []).forEach((r) => {
    const s = sent?.byTime?.get(r.time);
    if (!s || r.projected) return;
    let status;
    let diff = 0;
    if (r.actualMonth) {
      diff = monthDiff(s.month, r.actualMonth);
      status = diff === 0 ? "ontime" : "shifted";
    } else if (monthDiff(s.month, nowKey) > 0) status = "missed";
    else if (s.month === nowKey) status = "due";
    else status = "upcoming";
    rows.set(r.time, { sentMonth: s.month, status, diff, docNumber: s.doc.docNumber });
    counts.total += 1;
    counts[status] += 1;
  });
  counts.problem = counts.shifted + counts.missed;
  return { rows, counts };
};

/** ช่วงปี พ.ศ. จากเดือนจริงในแผน — "2569" หรือ "2569-70" (ใช้พิมพ์ในเอกสาร ไม่พึ่งวันเริ่มสัญญาที่อาจกรอกผิด) */
export const planYearSpanLabel = (months) => {
  const ys = (months || []).filter(isMonthKey).map((k) => Number(k.slice(0, 4)) + 543);
  if (!ys.length) return "";
  const a = Math.min(...ys);
  const b = Math.max(...ys);
  return a === b ? `${a}` : `${a}-${String(b).slice(-2)}`;
};

/** เดือนที่แก้เองรายครั้งสำหรับบันทึก — "" = ใช้ค่าคำนวณ · ตัด "" ท้ายทิ้ง */
export const compactOverrides = (list) => {
  const out = (list || []).map((m) => (isMonthKey(m) ? m : ""));
  while (out.length && !out[out.length - 1]) out.pop();
  return out;
};

/**
 * ครั้งที่ตกในปี พ.ศ. ที่เลือก — สำหรับตารางแผนงานทั้งปีของทุกสัญญา (12 คอลัมน์ ม.ค.–ธ.ค.)
 * @returns {Array<Array<object>>} 12 ช่อง (index 0 = ม.ค.) แต่ละช่องเป็นรายการครั้งที่
 */
export const roundsByMonthOfYear = (plan, beYear) => {
  const ce = Number(beYear) - 543;
  const cells = Array.from({ length: 12 }, () => []);
  (plan?.rounds || []).forEach((r) => {
    // ลงตารางแล้ว = วางที่เดือนที่ลงจริง (ภาระงานจริงของเดือนนั้น) · ยังไม่ลง = เดือนตามแผน
    const [y, m] = parts(r.actualMonth || r.month);
    if (y === ce) cells[m - 1].push(r);
  });
  return cells;
};
