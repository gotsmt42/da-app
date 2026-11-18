/**
 * workValue.js — "มูลค่างานครั้งนี้" ที่เดียวทั้งแอป (ค่าแนะนำอัตโนมัติ · ก่อน VAT / รวม VAT)
 *
 * ✅ (10 พ.ย. 2569 ผู้ใช้: "มูลค่างานครั้งนี้ ให้ใส่อัตโนมัติได้เลย ถ้างานไหนมีการกรอกมูลค่ารวมอยู่แล้ว เช่นงานสัญญา
 *    ก็ให้แบ่งตามรอบ · งานที่ไม่มีมูลค่าให้เอา AI มาช่วยอ่านไฟล์ · เลือกได้ว่ายอดบวก VAT หรือยอด Net
 *    ทำให้สอดคล้องกันทั้งหมด")
 *    • workValueVatIncluded: false = ยอดก่อน VAT (Net — ค่าเดิมทั้งหมด) · true = รวม VAT 7% แล้ว
 *    • ที่ไหนจะรวมยอด/วางบิล ใช้ workValueNet() เสมอ (ไม่เอายอดรวม VAT กับยอด Net มาบวกปนกัน)
 */
import { perRoundAmount, round2, baht } from "./billing";
import { totalRoundsOf } from "./contractRounds";

export const VAT_RATE = 7;

export const hasWorkValue = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));

/** แยกยอด: ค่าที่ใส่ + ใส่แบบไหน → ก่อน VAT · VAT · รวม VAT */
export function vatParts(amount, vatIncluded) {
  if (!hasWorkValue(amount)) return null;
  const n = Number(amount);
  const net = vatIncluded ? round2(n / (1 + VAT_RATE / 100)) : round2(n);
  const gross = vatIncluded ? round2(n) : round2(n * (1 + VAT_RATE / 100));
  return { net, vat: round2(gross - net), gross };
}

/** ยอดก่อน VAT ของงาน (ใช้รวมยอด/วางบิล) · ไม่มีค่า = null */
export const workValueNet = (ev) => (hasWorkValue(ev?.workValue) ? vatParts(ev.workValue, Boolean(ev.workValueVatIncluded)).net : null);

/**
 * ✅ (17 พ.ย. 2569) มูลค่างานของ "งาน" (ทุกวันของงานเก็บค่าเดียวกัน — ใช้แถวแรกที่ใส่ไว้)
 *    ที่เดียวทั้งแอป: หน้าการดำเนินงาน · สรุปผลงาน · รายงานรายช่าง · Excel (เดิมเขียนซ้ำ 4 ที่)
 */
export const jobWorkValueHit = (rows) => (rows || []).find((r) => hasWorkValue(r?.workValue)) || null;
/** มูลค่างานของงาน ก่อน VAT · null = ยังไม่ใส่ */
export const jobWorkValueNet = (rows) => workValueNet(jobWorkValueHit(rows));

export const vatLabel = (vatIncluded) => (vatIncluded ? "รวม VAT" : "ก่อน VAT");

/**
 * ✅ (10 พ.ย. 2569 ผู้ใช้: "งานสัญญาไม่ให้มีระบุก่อน VAT/รวม VAT … ให้ไประบุที่หน้าภาพรวมงาน")
 *    งานสัญญา = VAT ตามมูลค่าสัญญาเสมอ · คืน null ถ้าไม่ใช่งานสัญญา (เลือก VAT เองได้)
 */
export function contractVatInfo(ev) {
  if (!ev?.contractGroupId) return null;
  const flag = ev.jobValueVatIncluded;
  const set = flag === true || flag === false;
  const hasValue = Number(ev.jobValue) > 0;
  return {
    vatIncluded: flag === true,
    set,
    hasValue,
    jobValue: hasValue ? Number(ev.jobValue) : null,
    // ป้ายสั้น: VAT ของสัญญา
    vatText: set ? (flag ? "รวม VAT 7%" : "ก่อน VAT (Net)") : "ยังไม่ระบุ VAT · คิดเป็นก่อน VAT",
    text: !hasValue
      ? "ยังไม่มีมูลค่าสัญญา — ใส่ได้ที่หน้าภาพรวมงาน"
      : set
        ? `VAT ตามสัญญา: ${flag ? "รวม VAT 7%" : "ก่อน VAT (Net)"}`
        : "VAT ตามสัญญา: ยังไม่ระบุ (คิดเป็นก่อน VAT)",
  };
}

/** ข้อความสั้นใต้ยอด เช่น "ก่อน VAT · รวม VAT ฿11,128.00" */
export function vatNote(amount, vatIncluded) {
  const p = vatParts(amount, vatIncluded);
  if (!p || !Number(amount)) return vatLabel(vatIncluded);
  return vatIncluded ? `รวม VAT · ก่อน VAT ${baht(p.net)}` : `ก่อน VAT · รวม VAT ${baht(p.gross)}`;
}

const roundNoOf = (ev) => {
  const n = parseInt(String(ev?.time ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
};

/**
 * ค่าแนะนำ "มูลค่างานครั้งนี้" จากข้อมูลที่มีอยู่แล้ว (ไม่ต้องใช้ AI)
 *   งานสัญญา: มูลค่าสัญญา ÷ จำนวนครั้ง (ครั้งสุดท้ายรับเศษ)
 *   งานอื่น:  มูลค่างานรวม → ยอดใบเสนอราคาที่ได้งาน (ยอดที่อนุมัติจริงก่อน)
 * @returns {{amount:number, vatIncluded:boolean|null, source:string, hint:string}|null}
 *          vatIncluded null = ไม่รู้ว่ารวม VAT ไหม (ใช้ค่าที่เลือกอยู่)
 */
export function suggestWorkValue(ev) {
  if (!ev || ev.department === "sales") return null;
  const jobValue = Number(ev.jobValue);
  if (ev.contractGroupId) {
    if (!(jobValue > 0)) return null;
    const rounds = totalRoundsOf(ev) || Number(ev.visitCount) || 0;
    const roundNo = roundNoOf(ev);
    const amount = perRoundAmount(jobValue, rounds, roundNo);
    if (amount === null) return null;
    const isLast = rounds > 1 && roundNo !== null && roundNo >= rounds;
    return {
      // 🔁 (10 พ.ย. 2569) ใช้การระบุ VAT ของมูลค่าสัญญา (หน้าภาพรวมงาน) — ไม่ให้เลือกเองรายครั้ง
      amount, vatIncluded: ev.jobValueVatIncluded === true, source: "contract",
      hint: rounds > 1 ? `มูลค่าสัญญา ${baht(jobValue)} ÷ ${rounds} ครั้ง${isLast ? " (ครั้งสุดท้ายรับเศษ)" : ""}` : `มูลค่าสัญญา ${baht(jobValue)}`,
    };
  }
  if (jobValue > 0) return { amount: round2(jobValue), vatIncluded: null, source: "job", hint: `มูลค่างานรวม ${baht(jobValue)}` };
  if (ev.quotationStatus === "approved") {
    const q = Number(ev.quotationApprovedAmount ?? ev.quotationAmount);
    if (q > 0) {
      return {
        amount: round2(q), vatIncluded: Boolean(ev.quotationVatIncluded), source: "quotation",
        hint: `ยอดใบเสนอราคาที่ได้งาน${ev.quotationNo ? ` ${ev.quotationNo}` : ""} ${baht(q)}`,
      };
    }
  }
  return null;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ✅ (17 พ.ย. 2569 ผู้ใช้: "ผู้ปฏิบัติงาน 1 ใส่มูลค่าเข้างานโครงการนั้นครั้งนั้น 5000 คนที่ 2 ลง 3000
 *    แล้วไม่รวมมูลค่ากัน ให้แยกตามคน และเช็คการเชื่อมโยงข้อมูลให้สมบูรณ์")
 *    มูลค่างานรายคน (workerValues) — แต่ละคนลงยอดของตัวเอง ไม่ทับกัน ไม่บวกรวมกัน
 *    • 🔁 (17 พ.ย. 2569 ผู้ใช้: "มูลค่าครั้งนี้คือให้ช่างทุกคนลง · มูลค่ารวมของงานแยกต่างหากโดยผู้รับผิดชอบงานจัดการ") ช่องเดียวรายคน · 🔁 ผู้ใช้: "ยอดที่ลงไม่นำมารวมกัน ให้แยกเป็นผลงานของแต่ละคน" — ไม่มีผลรวมทั้งทีม · ยอดของงาน = jobValue (มูลค่างานรวม)
 *    • งานเข้าหลายวันเก็บชุดเดียวกันทุกวัน — rows = ทุกวันของงาน (หรือวันเดียวก็ได้)
 *    • ข้อมูลเดิม (ก่อนมีรายคน): งานที่ยังไม่มีรายการรายคนเลย + ยอดเดิมลงโดยคนในทีม = นับให้คนที่ลง
 *      (เดิมทุกคนได้ยอดเต็ม — ยอดรายคนจึงพองเกินจริง)
 * ───────────────────────────────────────────────────────────────────────────── */

/** วันแยกช่อง "มูลค่าครั้งนี้ของงาน" กับ "ผลงานรายคน" — ยอดของงานที่ลงก่อนวันนี้โดยช่างในทีม = ผลงานเดิมของช่างคนนั้น */
export const LEGACY_CUTOFF = "2026-11-18";

/** ชื่อเต็ม "ชื่อ นามสกุล" ตรงกับชื่อในทีม (ชื่อคำแรก) ไหม */
export const sameWorkerName = (full, name) => Boolean(full && name)
  && (full === name || String(full).trim().split(/\s+/)[0] === name);

/** ผู้ปฏิบัติงานของงาน (หัวหน้าทีม + ลูกทีม ทุกวัน ตัดชื่อซ้ำ) — คนแรก = หัวหน้าทีม */
export const workersOfRows = (rows) => [...new Set((rows || [])
  .flatMap((r) => [r?.team, ...((r?.teamMembers || []).map((m) => m?.name))])
  .filter(Boolean))];

/** Map ชื่อ → รายการมูลค่ารายคน (ถ้าแต่ละวันไม่ตรงกัน ใช้ค่าที่บันทึกล่าสุด) */
export function workerValueMap(rows) {
  const map = new Map();
  (rows || []).forEach((r) => (r?.workerValues || []).forEach((w) => {
    if (!w?.name || !hasWorkValue(w.amount)) return;
    const prev = map.get(w.name);
    if (!prev || new Date(w.at || 0) > new Date(prev.at || 0)) map.set(w.name, w);
  }));
  return map;
}

/**
 * มูลค่างานของคนนี้ในงานนี้ · null = คนนี้ยังไม่ลง
 * @returns {{amount:number, vatIncluded:boolean, net:number, at?:string, by?:string, legacy:boolean}|null}
 */
export function personValueOf(rows, name) {
  if (!name) return null;
  const map = workerValueMap(rows);
  const w = map.get(name);
  if (w) {
    const vat = Boolean(w.vatIncluded);
    return { amount: Number(w.amount), vatIncluded: vat, net: vatParts(w.amount, vat).net, at: w.at, by: w.by, legacy: false };
  }
  if (map.size) return null;
  // 🔁 (17 พ.ย. 2569 ผู้ใช้: "แต่ละงานมีมูลค่าครั้งนี้ 1 ค่า · ยอดที่ช่างลงเป็นผลงานรายคน")
  //    มูลค่าครั้งนี้ของงาน (workValue) ไม่ใช่ผลงานรายคน — ยกเว้นข้อมูลเดิมก่อนแยกช่อง (ก่อน LEGACY_CUTOFF)
  //    ที่ "ช่างในทีมลงเอง" (สมัยที่ช่างลงมูลค่าครั้งนี้ตอนขอปิดงาน) = นับเป็นผลงานของช่างคนนั้น
  //    แอดมิน/ผู้รับผิดชอบลง หรือหลังวันแยกช่อง = ไม่นับให้ใคร · กติกาเดียวกับ server (PUT /events/:id/worker-value)
  const hit = (rows || []).find((r) => hasWorkValue(r?.workValue) && r.workValueSource !== "workers"
    && (!r.workValueAt || String(r.workValueAt) < LEGACY_CUTOFF));
  if (!hit) return null;
  const owner = workersOfRows(rows).find((n) => sameWorkerName(hit.workValueBy, n));
  if (!owner || owner !== name) return null;
  const vat = Boolean(hit.workValueVatIncluded);
  return { amount: Number(hit.workValue), vatIncluded: vat, net: vatParts(hit.workValue, vat).net, at: hit.workValueAt, by: hit.workValueBy, legacy: true };
}

/** ชื่อของผู้ใช้คนนี้ในทีมงาน (เทียบ userId ของลูกทีมก่อน แล้วชื่อ) · ไม่อยู่ในทีม = "" */
export function myWorkerName(rows, me) {
  if (!me) return "";
  const uid = me.userId ? String(me.userId) : "";
  const byId = uid && (rows || []).flatMap((r) => r?.teamMembers || []).find((m) => m?.userId && String(m.userId) === uid);
  if (byId?.name) return byId.name;
  return workersOfRows(rows).find((n) => n === me.fname) || "";
}

/**
 * ✅ (17 พ.ย. 2569 ผู้ใช้: "ยอดมูลค่าที่ลงจะไม่นำมารวมยอดกัน ให้แยกเป็นผลงานของแต่ละคน" ·
 *    หน้าสรุปงาน "แยกรายคน + มูลค่างานรวม")
 *    มูลค่าครั้งนี้ของงาน = รายการรายคน (ไม่มีผลรวม) · มูลค่าของงาน = มูลค่างานรวม (jobValue) ที่ผู้รับผิดชอบ/แอดมินระบุ
 */
/** รายคนของงาน: [{ name, lead, value }] — value = personValueOf (null = ยังไม่ลง) */
export const personValuesOf = (rows) => workersOfRows(rows).map((name, i) => ({ name, lead: i === 0, value: personValueOf(rows, name) }));

/** มูลค่างานรวม (ก่อน VAT) — งานสัญญาใช้ธง VAT ของสัญญา · null = ยังไม่ระบุ */
export function jobTotalNet(rows) {
  const hit = (rows || []).find((r) => Number(r?.jobValue) > 0);
  if (!hit) return null;
  return vatParts(Number(hit.jobValue), hit.jobValueVatIncluded === true).net;
}

/** คีย์นับ "มูลค่างานรวม" ครั้งเดียว — งานสัญญาหลายรอบใช้ค่าเดียวกันทั้งสัญญา (นับสัญญาละครั้ง ไม่คูณตามรอบ) */
export const jobTotalKey = (row, fallbackKey) => (row?.contractGroupId ? `c:${row.contractGroupId}` : fallbackKey);

/**
 * ✅ (18 พ.ย. 2569 ผู้ใช้: "งานที่เข้าไม่ต่อเนื่องหลายช่วง ไม่เอามูลค่างานมารวมกันนะ")
 *    คีย์นับ "มูลค่าครั้งนี้" ครั้งเดียวต่อการเข้างาน 1 ครั้ง (ไม่บวกซ้ำทุกช่วงวัน)
 *    • มี jobGroupId = ทุกช่วงของงานเดียวกัน → คีย์เดียว
 *    • งานเก่าที่ไม่มี jobGroupId และแต่ละช่วงทีมไม่ตรงกัน (การ์ดแยกกัน) แต่เป็นงานเดียวกัน (บริษัท/โครงการ/ประเภท/ระบบ/ครั้งที่ เดียวกัน)
 *      และใส่ยอดเท่ากันทุกช่วง → นับครั้งเดียว
 */
export function visitValueKey(row, net) {
  if (row?.jobGroupId) return `gid:${row.jobGroupId}`;
  const sig = ["company", "site", "title", "system", "time"].map((k) => String(row?.[k] || "").trim().toLowerCase()).join("|");
  return `sig:${sig}|${Math.round(Number(net || 0) * 100)}`;
}

/**
 * ✅ (18 พ.ย. 2569 ผู้ใช้: "มันควรบอกว่ามูลค่ารวม ไม่ใช่มูลค่าครั้งนี้ ถ้าเอายอดมูลค่ารวมมาบวกกันแบบนี้")
 *    มูลค่าครั้งนี้ของงาน "เท่ากับมูลค่างานรวมทั้งงาน" = จริงๆ คือยอดรวมทั้งงาน (มักถูกเติมจากมูลค่างานรวม) ไม่ใช่ยอดของครั้งนี้
 *    → ไม่นับรวมในยอด "มูลค่าครั้งนี้" · แสดงแยกเป็น "เท่ามูลค่างานรวม" ให้ตรวจ/แก้
 */
export function isWholeJobValue(rows) {
  const hit = jobWorkValueHit(rows);
  const total = jobTotalNet(rows);
  if (!hit || total === null) return false;
  return Math.abs(workValueNet(hit) - total) < 1;
}

