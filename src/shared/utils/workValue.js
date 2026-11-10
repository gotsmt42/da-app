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
