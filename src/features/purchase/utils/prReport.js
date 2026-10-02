/**
 * prReport.js — สรุปตัวเลขรายงานใบขอซื้อ (PR) จากรายการใบ (คำนวณฝั่งหน้าจอ · server กรองสิทธิ์แล้ว)
 * ⚠️ ใบที่ยกเลิกนับจำนวนใบได้ แต่ไม่นับเข้ายอดเงินทุกช่อง
 * ⚠️ "ยอดจริง" = ยอดสั่งซื้อจริงที่ฝ่ายจัดซื้อบันทึก (actualTotal) — ใบที่ยังไม่สั่งซื้อใช้ยอดประมาณการแทนในช่อง "ยอดใช้"
 */
import moment from "moment";
import { prJobText, receiveProgress } from "../prMeta";

const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round(n * 100) / 100;

export const WAIT_APPROVAL = ["pending", "reviewed"];
export const WAIT_ORDER = ["approved"];
export const WAIT_RECEIVE = ["ordered", "partial"];
export const PASSED = ["approved", "ordered", "partial", "received"];
export const ORDERED = ["ordered", "partial", "received"];

export const isLate = (r) => r.neededBy && !["received", "cancelled"].includes(r.status) && moment(r.neededBy).isBefore(moment(), "day");
/** ยอดของใบ — ยอดจริงถ้าสั่งซื้อแล้ว ไม่งั้นยอดประมาณการ · ใบยกเลิก = 0 */
export const amountOf = (r) => (r.status === "cancelled" ? 0 : num(r.actualTotal) || num(r.estTotal));
/** มูลค่าของที่ยังไม่ได้รับ (ใบที่สั่งซื้อแล้ว) — ตามสัดส่วนจำนวนที่ยังค้าง */
export const pendingReceiveOf = (r) => (WAIT_RECEIVE.includes(r.status) ? r2(amountOf(r) * (1 - receiveProgress(r))) : 0);

const blank = (key, label) => ({ key, label, count: 0, est: 0, actual: 0, ordered: 0, pendingReceive: 0, waitApproval: 0, waitOrder: 0, received: 0, late: 0 });

const add = (g, r) => {
  g.count += 1;
  if (isLate(r)) g.late += 1;
  if (r.status === "cancelled") return;
  g.est += num(r.estTotal);
  if (ORDERED.includes(r.status)) { g.ordered += 1; g.actual += num(r.actualTotal) || num(r.estTotal); }
  if (WAIT_APPROVAL.includes(r.status)) g.waitApproval += num(r.estTotal);
  if (WAIT_ORDER.includes(r.status)) g.waitOrder += num(r.estTotal);
  if (r.status === "received") g.received += 1;
  g.pendingReceive += pendingReceiveOf(r);
};

const groupBy = (rows, keyOf) => {
  const m = new Map();
  rows.forEach((r) => {
    const [key, label] = keyOf(r);
    if (!m.has(key)) m.set(key, blank(key, label));
    add(m.get(key), r);
  });
  return [...m.values()].map((g) => ({ ...g, est: r2(g.est), actual: r2(g.actual), pendingReceive: r2(g.pendingReceive) }))
    .sort((a, b) => (b.actual || b.est) - (a.actual || a.est) || b.count - a.count);
};

export function buildPrReport(rows) {
  const totals = blank("all", "ทั้งหมด");
  const byStatus = {};
  let saving = 0;
  let savingBase = 0;
  rows.forEach((r) => {
    add(totals, r);
    byStatus[r.status] = byStatus[r.status] || { count: 0, amount: 0 };
    byStatus[r.status].count += 1;
    byStatus[r.status].amount += amountOf(r);
    if (ORDERED.includes(r.status) && num(r.actualTotal)) { saving += num(r.estTotal) - num(r.actualTotal); savingBase += num(r.estTotal); }
  });

  // รายเดือน (ตามวันที่ใบ) — ประมาณการ vs สั่งซื้อจริง
  const months = new Map();
  rows.forEach((r) => {
    const key = moment(r.docDate).format("YYYY-MM");
    if (!months.has(key)) months.set(key, { key, count: 0, est: 0, actual: 0 });
    const m = months.get(key);
    m.count += 1;
    if (r.status === "cancelled") return;
    m.est += num(r.estTotal);
    if (ORDERED.includes(r.status)) m.actual += num(r.actualTotal) || num(r.estTotal);
  });

  // สินค้าที่ขอซื้อบ่อย/มูลค่าสูง — รวมตามชื่อสินค้า + หน่วย
  const items = new Map();
  rows.filter((r) => r.status !== "cancelled").forEach((r) => (r.items || []).forEach((it) => {
    const name = String(it.description || "").trim();
    if (!name) return;
    const key = `${name.toLowerCase()}|${it.unit || ""}`;
    if (!items.has(key)) items.set(key, { key, name, unit: it.unit || "", qty: 0, amount: 0, docs: new Set(), prices: [] });
    const g = items.get(key);
    g.qty += num(it.qty);
    g.amount += num(it.actualAmount) || num(it.estAmount);
    g.docs.add(r._id);
    const price = num(it.actualUnitPrice) || num(it.estUnitPrice);
    if (price) g.prices.push(price);
  }));

  return {
    totals: { ...totals, est: r2(totals.est), actual: r2(totals.actual), pendingReceive: r2(totals.pendingReceive), waitApproval: r2(totals.waitApproval), waitOrder: r2(totals.waitOrder) },
    byStatus,
    saving: r2(saving),
    savingPct: savingBase ? Math.round((saving / savingBase) * 1000) / 10 : 0,
    byMonth: [...months.values()].sort((a, b) => a.key.localeCompare(b.key)).map((m) => ({ ...m, est: r2(m.est), actual: r2(m.actual) })),
    byPerson: groupBy(rows, (r) => [String(r.requester?.userId || r.requester?.name || "-"), r.requester?.name || "-"]),
    byJob: groupBy(rows, (r) => (r.eventId ? [String(r.eventId), `${prJobText(r.job) || "งาน"}${r.job?.docNo ? ` (${r.job.docNo})` : ""}`] : ["-", "ไม่ผูกงาน"])),
    bySupplier: groupBy(rows.filter((r) => ORDERED.includes(r.status)), (r) => {
      const s = String(r.order?.supplier || "").trim();
      return s ? [s.toLowerCase(), s] : ["-", "ไม่ระบุร้านค้า"];
    }),
    topItems: [...items.values()]
      .map((g) => ({ ...g, docs: g.docs.size, amount: r2(g.amount), minPrice: g.prices.length ? Math.min(...g.prices) : 0, maxPrice: g.prices.length ? Math.max(...g.prices) : 0 }))
      .sort((a, b) => b.amount - a.amount || b.qty - a.qty),
  };
}
