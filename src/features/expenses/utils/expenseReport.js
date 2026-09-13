/**
 * expenseReport.js — สรุปยอดรายงานการเบิกจากข้อมูล /api/expenses/report
 *
 * ✅ ยึด "ใบ Advance" เป็นแกนของทุกตัวเลข (ดูเหตุผลที่ route /report ฝั่ง server)
 * ✅ เป็นฟังก์ชันล้วน (ไม่แตะ React/เครือข่าย) — เปลี่ยนตัวกรองบนหน้าจอได้ทันทีโดยไม่ต้องยิงใหม่ และเทสต์ได้ตรงๆ
 *
 * นิยามตัวเลข (ต้องตรงกันทุกที่ที่แสดง):
 *   requested   ยอดขอเบิกทุกใบที่ยังไม่ยกเลิก
 *   pending     ยอดรออนุมัติ / ถูกตีกลับ
 *   toPay       อนุมัติแล้วแต่ยังไม่จ่าย
 *   advanced    จ่ายเงินล่วงหน้าออกไปแล้วจริง (paid / clearing / cleared)
 *   actual      ใช้จริงตามใบเคลมที่อนุมัติแล้ว (approved / settled)
 *   outstanding ยอด Advance ที่จ่ายแล้วแต่ใบเคลมยังไม่ผ่านอนุมัติ = เงินที่ยังอยู่กับพนักงานโดยไม่มีหลักฐาน
 *   refundDue   ใบเคลมอนุมัติแล้ว ผู้เบิกต้องคืนเงิน แต่ยังไม่ได้ปิดส่วนต่าง
 *   extraDue    ใบเคลมอนุมัติแล้ว บริษัทต้องจ่ายเพิ่ม แต่ยังไม่ได้ปิดส่วนต่าง
 *   refunded / extraPaid  ส่วนต่างที่ปิดเรียบร้อยแล้ว
 */
import { money } from "../expenseMeta";

const PAID = ["paid", "clearing", "cleared"];
const CLAIM_DONE = ["approved", "settled"];

const emptyTotals = () => ({
  count: 0, requested: 0, pending: 0, toPay: 0, advanced: 0, actual: 0,
  outstanding: 0, refundDue: 0, extraDue: 0, refunded: 0, extraPaid: 0, overdue: 0,
});

const addRow = (t, a, now) => {
  const claim = a.claim && a.claim.status !== "cancelled" ? a.claim : null;
  const total = Number(a.total) || 0;
  t.count += 1;
  t.requested += total;
  if (["pending", "rejected"].includes(a.status)) t.pending += total;
  if (a.status === "approved") t.toPay += total;
  if (PAID.includes(a.status)) {
    t.advanced += total;
    const claimApproved = claim && CLAIM_DONE.includes(claim.status);
    if (claimApproved) {
      t.actual += Number(claim.total) || 0;
      const diff = Number(claim.difference) || 0;
      if (claim.status === "approved") {
        if (diff < 0) t.refundDue += -diff;
        if (diff > 0) t.extraDue += diff;
      } else {
        if (diff < 0) t.refunded += -diff;
        if (diff > 0) t.extraPaid += diff;
      }
    } else {
      t.outstanding += total;
      if (a.status === "paid" && a.dueClearAt && new Date(a.dueClearAt) < now) t.overdue += 1;
    }
  }
};

/** ⚠️ ปัดเฉพาะยอดเงิน — key/label ของกลุ่มเป็นสตริง และ count/overdue เป็นจำนวนใบ */
const MONEY_FIELDS = Object.keys(emptyTotals()).filter((k) => k !== "count" && k !== "overdue");
const round = (t) => {
  const out = { ...t };
  MONEY_FIELDS.forEach((k) => { out[k] = money(t[k]); });
  return out;
};

const groupBy = (rows, keyOf, labelOf, now) => {
  const map = new Map();
  rows.forEach((a) => {
    const key = keyOf(a);
    if (!map.has(key)) map.set(key, { key, label: labelOf(a), ...emptyTotals() });
    addRow(map.get(key), a, now);
  });
  return [...map.values()].map(round);
};

/** เดือนตามเวลาไทย "2026-09" (docDate เก็บเที่ยงวัน UTC จึงตัดสตริงได้ตรงๆ ไม่คลาดวัน) */
export const monthKey = (d) => String(d || "").slice(0, 7);

/**
 * @param {Array} advances  แถวจาก /report (ใบ Advance + claim)
 * @param {object} [opts]
 * @param {Date}   [opts.now]
 */
export function buildExpenseReport(advances, { now = new Date() } = {}) {
  const rows = (advances || []).filter((a) => a && a.status !== "cancelled");
  const totals = emptyTotals();
  rows.forEach((a) => addRow(totals, a, now));

  const byPerson = groupBy(rows, (a) => a.requester?.userId || a.requester?.name || "-", (a) => a.requester?.name || "-", now)
    .sort((x, y) => y.advanced - x.advanced || y.requested - x.requested);

  const byJob = groupBy(
    rows,
    (a) => a.eventId || "__none__",
    (a) => (a.eventId ? [a.job?.title, a.job?.site || a.job?.company].filter(Boolean).join(" · ") || "งานไม่มีชื่อ" : "ไม่ผูกงาน"),
    now
  ).sort((x, y) => (x.key === "__none__") - (y.key === "__none__") || y.advanced - x.advanced);

  const byMonth = groupBy(rows, (a) => monthKey(a.docDate), (a) => monthKey(a.docDate), now)
    .sort((x, y) => (x.key < y.key ? -1 : 1));

  // ── หมวดค่าใช้จ่าย: ตั้งเบิก (รายการใน Advance ที่จ่ายแล้ว) เทียบ ใช้จริง (รายการในใบเคลมที่อนุมัติ) ──
  const catMap = new Map();
  const cat = (c) => {
    const k = c || "other";
    if (!catMap.has(k)) catMap.set(k, { key: k, planned: 0, actual: 0 });
    return catMap.get(k);
  };
  rows.forEach((a) => {
    if (!PAID.includes(a.status)) return;
    (a.items || []).forEach((it) => { cat(it.category).planned += Number(it.amount) || 0; });
    const claim = a.claim;
    if (claim && CLAIM_DONE.includes(claim.status)) {
      (claim.items || []).forEach((it) => { cat(it.category).actual += Number(it.amount) || 0; });
    }
  });
  const byCategory = [...catMap.values()]
    .map((c) => ({ ...c, planned: money(c.planned), actual: money(c.actual) }))
    .sort((x, y) => y.actual - x.actual || y.planned - x.planned);

  return { totals: round(totals), byPerson, byJob, byMonth, byCategory, rows };
}
