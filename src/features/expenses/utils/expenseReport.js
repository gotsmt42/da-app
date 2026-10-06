/**
 * expenseReport.js — สรุปยอดรายงานการเบิกจากข้อมูล /api/expenses/report
 *
 * ✅ ยึด "ใบ Advance" เป็นแกนของทุกตัวเลข (ดูเหตุผลที่ route /report ฝั่ง server)
 * ✅ เป็นฟังก์ชันล้วน (ไม่แตะ React/เครือข่าย) — เปลี่ยนตัวกรองบนหน้าจอได้ทันทีโดยไม่ต้องยิงใหม่ และเทสต์ได้ตรงๆ
 *
 * นิยามตัวเลข (ต้องตรงกันทุกที่ที่แสดง):
 *   requested   ยอดขอเบิกทุกใบที่ยังไม่ยกเลิก
 *   pending     ยอดที่ยังไม่ผ่านอนุมัติ (รอตรวจสอบ / ตรวจสอบแล้วรออนุมัติ / ถูกตีกลับ)
 *   reviewing   ยอดที่ "ตรวจสอบแล้ว รออนุมัติ" (ขั้นที่ 3 — ส่วนย่อยของ pending ดูได้ว่าค้างที่ขั้นไหน)
 *   toPay       อนุมัติแล้ว รออนุมัติเบิกจ่าย (ส่วนที่ 3 ของใบ Advance)
 *   advanced    จ่ายเงินล่วงหน้าออกไปแล้วจริง (paid / clearing / cleared)
 *   actual      ใช้จริงตามใบเคลมที่อนุมัติแล้ว (approved / settled)
 *   outstanding ยอด Advance ที่จ่ายแล้วแต่ใบเคลมยังไม่ผ่านอนุมัติ = เงินที่ยังอยู่กับพนักงานโดยไม่มีหลักฐาน
 *   refundDue   ใบเคลมอนุมัติแล้ว ผู้เบิกต้องคืนเงิน รอยืนยันรับเงินคืน (ส่วนที่ 3)
 *   extraDue    ใบเคลมอนุมัติแล้ว บริษัทต้องจ่ายเพิ่ม รออนุมัติเบิกจ่าย (ส่วนที่ 3)
 *   refunded / extraPaid  ส่วนต่างที่ปิดเรียบร้อยแล้ว
 *
 * ── ใบสำรองจ่าย (ผู้เบิกออกเงินเองไปก่อน ไม่มี Advance) ────────────────────
 *   reimburseCount / reimbursePending / reimburse (อนุมัติแล้ว) / reimburseDue (รอจ่ายคืน) / reimbursePaid
 * ⚠️ ยอดกลุ่มนี้ "ไม่รวม" เข้ากับ advanced/actual โดยเด็ดขาด — สองตัวนั้นมีไว้เทียบกันว่าเงินที่จ่าย
 * ล่วงหน้าออกไปถูกใช้จริงเท่าไร ถ้าเอาเงินที่บริษัทยังไม่ได้จ่าย (สำรองจ่าย) ไปบวกใน actual อัตราส่วน
 * การเคลียร์จะเพี้ยนทันทีและดูเหมือนใช้เกินยอดที่เบิกไปทุกเดือน
 */
import { money, jobText, jobPartText } from "../expenseMeta";

const PAID = ["paid", "clearing", "cleared"];
const CLAIM_DONE = ["approved", "settled"];

const emptyTotals = () => ({
  count: 0, requested: 0, pending: 0, reviewing: 0, toPay: 0, advanced: 0, actual: 0,
  outstanding: 0, refundDue: 0, extraDue: 0, refunded: 0, extraPaid: 0, overdue: 0,
  reimburseCount: 0, reimbursePending: 0, reimburseReviewing: 0, reimburse: 0, reimburseDue: 0, reimbursePaid: 0,
});

const addRow = (t, a, now) => {
  const claim = a.claim && a.claim.status !== "cancelled" ? a.claim : null;
  const total = Number(a.total) || 0;
  t.count += 1;
  t.requested += total;
  // ⚠️ "reviewed" = ตรวจสอบแล้วแต่ยังไม่อนุมัติ → ยังเป็นเงินที่ยังไม่ผ่านอนุมัติ ต้องนับรวมใน pending
  // ไม่งั้นใบที่ค้างอยู่ขั้นที่ 2 จะหายไปจากรายงานทั้งที่ยังไม่จบ
  if (["pending", "reviewed", "rejected"].includes(a.status)) t.pending += total;
  if (a.status === "reviewed") t.reviewing += total;
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

/**
 * ใบสำรองจ่ายหนึ่งใบ
 * ⚠️ ใบที่ถูกตีกลับยังถือว่า "รออยู่" (ผู้เบิกยังไม่ได้เงินคืน) แต่ไม่นับเป็นค่าใช้จ่ายที่อนุมัติแล้ว
 */
const addReimburse = (t, r) => {
  const total = Number(r.total) || 0;
  t.reimburseCount += 1;
  if (["pending", "reviewed", "rejected"].includes(r.status)) t.reimbursePending += total;
  if (r.status === "reviewed") t.reimburseReviewing += total;
  if (["approved", "settled"].includes(r.status)) t.reimburse += total;
  if (r.status === "approved") t.reimburseDue += total;
  if (r.status === "settled") t.reimbursePaid += total;
};

/** ⚠️ ปัดเฉพาะยอดเงิน — key/label ของกลุ่มเป็นสตริง ส่วน count/overdue/*Count เป็นจำนวนใบ */
const NON_MONEY = ["count", "overdue", "reimburseCount"];
const MONEY_FIELDS = Object.keys(emptyTotals()).filter((k) => !NON_MONEY.includes(k));
const round = (t) => {
  const out = { ...t };
  MONEY_FIELDS.forEach((k) => { out[k] = money(t[k]); });
  return out;
};

/**
 * รวมสองก้อน (ใบ Advance + ใบสำรองจ่าย) ลงกลุ่มเดียวกัน
 * ⚠️ keyOf/labelOf ต้องใช้ได้กับทั้งสองก้อน — ทั้งคู่มี requester / eventId / job / docDate เหมือนกัน
 * (คนที่สำรองจ่ายก็ต้องโผล่ในตาราง "สรุปตามผู้เบิก" แม้ไม่เคยเบิก Advance เลยสักใบ)
 */
const groupBy = (rows, reimburseRows, keyOf, labelOf, now) => {
  const map = new Map();
  const bucket = (row) => {
    const key = keyOf(row);
    // jobStart = วันเริ่มงาน (ใช้ลิงก์ไปเปิดงานบนปฏิทินจากตารางสรุปตามงาน)
    if (!map.has(key)) map.set(key, { key, label: labelOf(row), jobStart: row.job?.start || "", ...emptyTotals() });
    return map.get(key);
  };
  rows.forEach((a) => addRow(bucket(a), a, now));
  (reimburseRows || []).forEach((r) => addReimburse(bucket(r), r));
  return [...map.values()].map(round);
};

/**
 * ใบที่ค้างอยู่ในสายอนุมัติ 3 ส่วน — ✅ ผู้ใช้สั่งให้รายงานตรงกับลำดับการเบิกใหม่
 *   review   ส่วนที่ 2 มือแรก — รอตรวจสอบ (แอดมินช่าง / ผู้จัดการแผนกช่าง)
 *   approve  ส่วนที่ 2 มือสอง — รออนุมัติ (ผู้จัดการแผนกช่าง)
 *   disburse ส่วนที่ 3 — รออนุมัติเบิกจ่าย (ผู้จัดการแผนกช่าง / กรรมการผู้จัดการ)
 * นับครบทั้ง 3 ชนิดใบ (Advance + ใบเคลมที่ผูก + ใบสำรองจ่าย)
 *   amount  = ยอดในใบ (Advance = ยอดขอเบิก · ใบเคลม = ใช้จริง · สำรองจ่าย = ยอดขอเบิกคืน)
 *   payOut  = เงินที่จะออกจากบริษัทเมื่ออนุมัติเบิกจ่าย · payIn = เงินที่พนักงานต้องคืนบริษัท
 * ⚠️ ใบเคลมที่ใช้พอดี (ส่วนต่าง 0) ไม่มีส่วนที่ 3 (ปิดจบที่ขั้นอนุมัติ) — ไม่มีทางค้างอยู่ใน disburse
 */
const STEP_OF_STATUS = { pending: "review", reviewed: "approve", approved: "disburse" };

export const buildPipeline = (rows = [], reimburseRows = []) => {
  const blank = () => ({ count: 0, advance: 0, claim: 0, reimburse: 0, amount: 0, payOut: 0, payIn: 0 });
  const out = { review: blank(), approve: blank(), disburse: blank() };
  const add = (kind, doc) => {
    const step = STEP_OF_STATUS[doc?.status];
    if (!step) return;
    const b = out[step];
    const total = Number(doc.total) || 0;
    b.count += 1;
    b[kind] += 1;
    b.amount += total;
    if (kind === "claim") {
      const diff = Number(doc.difference) || 0;
      if (diff > 0) b.payOut += diff;
      if (diff < 0) b.payIn += -diff;
    } else {
      b.payOut += total;
    }
  };
  rows.forEach((a) => {
    add("advance", a);
    if (a.claim && a.claim.status !== "cancelled") add("claim", a.claim);
  });
  reimburseRows.forEach((r) => add("reimburse", r));
  Object.values(out).forEach((b) => { b.amount = money(b.amount); b.payOut = money(b.payOut); b.payIn = money(b.payIn); });
  return out;
};

/** เดือนตามเวลาไทย "2026-09" (docDate เก็บเที่ยงวัน UTC จึงตัดสตริงได้ตรงๆ ไม่คลาดวัน) */
export const monthKey = (d) => String(d || "").slice(0, 7);

/**
 * @param {Array} advances  แถวจาก /report (ใบ Advance + claim ที่ผูกอยู่)
 * @param {object} [opts]
 * @param {Array}  [opts.reimbursements] ใบสำรองจ่ายในช่วงเวลาเดียวกัน (ไม่มี Advance ให้เทียบ)
 * @param {Date}   [opts.now]
 */
export function buildExpenseReport(advances, { reimbursements = [], now = new Date() } = {}) {
  const rows = (advances || []).filter((a) => a && a.status !== "cancelled");
  const reimburseRows = (reimbursements || []).filter((r) => r && r.status !== "cancelled");
  const totals = emptyTotals();
  rows.forEach((a) => addRow(totals, a, now));
  reimburseRows.forEach((r) => addReimburse(totals, r));

  const byPerson = groupBy(rows, reimburseRows, (a) => a.requester?.userId || a.requester?.name || "-", (a) => a.requester?.name || "-", now)
    .sort((x, y) => y.advanced - x.advanced || y.reimburse - x.reimburse || y.requested - x.requested);

  const byJob = groupBy(
    rows,
    reimburseRows,
    (a) => a.eventId || "__none__",
    // ✅ ใช้ข้อความงานเต็ม (มี "ครั้งที่ x/y") — เดิมเป็นแค่ ชื่องาน · โครงการ ทำให้งานสัญญาคนละรอบขึ้นชื่อซ้ำกันในตาราง
    // ⚠️ ต่อ "ช่วงวันที่ x/y" ด้วย — งานครั้งเดียวกันที่แยกเข้าหลายช่วง เป็นคนละ eventId แต่ชื่อเหมือนกันทุกตัวอักษร
    (a) => (a.eventId ? [jobText(a.job) || [a.job?.title, a.job?.site || a.job?.company].filter(Boolean).join(" · ") || "งานไม่มีชื่อ", jobPartText(a.job)].filter(Boolean).join(" · ") : "ไม่ผูกงาน"),
    now
  ).sort((x, y) => (x.key === "__none__") - (y.key === "__none__") || y.advanced - x.advanced || y.reimburse - x.reimburse);

  const byMonth = groupBy(rows, reimburseRows, (a) => monthKey(a.docDate), (a) => monthKey(a.docDate), now)
    .sort((x, y) => (x.key < y.key ? -1 : 1));

  // ── หมวดค่าใช้จ่าย: ตั้งเบิก (รายการใน Advance ที่จ่ายแล้ว) เทียบ ใช้จริง (รายการในใบเคลมที่อนุมัติ) ──
  const catMap = new Map();
  const cat = (c) => {
    const k = c || "other";
    if (!catMap.has(k)) catMap.set(k, { key: k, planned: 0, actual: 0, reimburse: 0 });
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
  // ✅ ค่าใช้จ่ายที่สำรองจ่ายเองก็ต้องรู้ว่าหมดไปกับหมวดไหน — แยกคอลัมน์ไว้ ไม่บวกรวมกับ actual
  reimburseRows.forEach((r) => {
    if (!CLAIM_DONE.includes(r.status)) return;
    (r.items || []).forEach((it) => { cat(it.category).reimburse += Number(it.amount) || 0; });
  });
  const byCategory = [...catMap.values()]
    .map((c) => ({ ...c, planned: money(c.planned), actual: money(c.actual), reimburse: money(c.reimburse) }))
    .sort((x, y) => (y.actual + y.reimburse) - (x.actual + x.reimburse) || y.planned - x.planned);

  return { totals: round(totals), pipeline: buildPipeline(rows, reimburseRows), byPerson, byJob, byMonth, byCategory, rows, reimburseRows };
}

/**
 * ══ รายบุคคล "ตามชื่อในแต่ละรายการ" ════════════════════════════════════════
 * ✅ ผู้ใช้ขอ: "นาย A เบิกเบี้ยเลี้ยงแล้วใส่ชื่อนาย B ก็ต้องรู้ได้ว่านาย B ถูกเบิกให้เท่าไร"
 *   ทุกตัวเลขอื่นในรายงานยึด "ผู้เบิก" (คนรับเงิน/คนต้องเคลียร์ใบ) — ส่วนนี้ยึด "เจ้าของเงินแต่ละบรรทัด"
 *   (items[].person) ถ้าบรรทัดไหนไม่ระบุชื่อ = เป็นของผู้เบิกเอง
 *
 * ตัวเลขต่อคน (ต้องตรงกันทั้งหน้าจอและไฟล์ Excel):
 *   requested  ขอเบิกทั้งหมด = รายการในใบ Advance + ใบสำรองจ่าย (ทุกใบที่ไม่ยกเลิก)
 *   advanced   จ่ายล่วงหน้าแล้ว = รายการในใบ Advance ที่จ่ายเงินแล้ว (paid/clearing/cleared)
 *   actual     ใช้จริง = รายการในใบเคลมที่อนุมัติแล้ว (approved/settled)
 *   reimburse  สำรองจ่าย = รายการในใบสำรองจ่ายที่อนุมัติแล้ว
 *   approvedCost ค่าใช้จ่ายที่อนุมัติแล้ว = actual + reimburse (ต้นทุนจริงที่ตกเป็นของคนนั้น)
 *   byOthers   ส่วนของ requested ที่ "คนอื่นเบิกให้" (ผู้เบิก ≠ เจ้าของบรรทัด) · self = เบิกเอง
 *   forOthers  ยอดที่คนนี้ "เป็นผู้เบิกให้คนอื่น" (ไม่นับเป็นของตัวเอง)
 *   claimedByOthers / claimedForOthers  แบบเดียวกันแต่ฝั่ง "ใช้จริง" (ใบเคลม) — ✅ ผู้ใช้: "จะมีการเคลมให้คนอื่นด้วย"
 *     เช่น A เบิก Advance ในชื่อตัวเองทั้งใบ แต่ตอนเคลมแยกบรรทัดให้ B → ใช้จริงของ B เพิ่ม · ของ A ลด
 *   lines[].sharedWith  ชื่อคนอื่นที่อยู่ในใบคู่เดียวกัน (Advance + ใบเคลม) — หน้าจอบอกว่าใบนี้ไม่ได้มีแค่คนนี้
 *   ✅ ความสัมพันธ์ที่ต้องตรงกับการ์ด/ตัวเลขที่ยึดผู้เบิก: ยอดในใบที่เบิก = self + forOthers · ยอดของคนนี้ = self + byOthers
 * ⚠️ ไม่รวมใบค่าจ้างผู้รับเหมา — ผู้รับเงินเป็นคนนอก ไม่ใช่พนักงาน (มีชีต/การ์ดของตัวเองอยู่แล้ว)
 */
const personKey = (p) => (p?.userId ? `u:${p.userId}` : `n:${String(p?.name || "").trim() || "-"}`);
const personLabel = (p) => String(p?.fullName || p?.name || "").trim() || "-";

export function buildPersonLedger(advances = [], reimbursements = []) {
  const rows = (advances || []).filter((a) => a && a.status !== "cancelled");
  const reimburseRows = (reimbursements || []).filter((r) => r && r.status !== "cancelled");
  const map = new Map();
  const bucket = (p) => {
    const key = personKey(p);
    if (!map.has(key)) {
      map.set(key, {
        key, userId: p?.userId || "", label: personLabel(p),
        requested: 0, advanced: 0, actual: 0, reimburse: 0, self: 0, byOthers: 0, forOthers: 0, claimedByOthers: 0, claimedForOthers: 0,
        requesters: new Map(), beneficiaries: new Map(), categories: new Map(), lines: [],
      });
    }
    return map.get(key);
  };
  // เจ้าของบรรทัด: ชื่อในรายการ ถ้าไม่มี = ผู้เบิก
  const ownerOf = (it, doc) => (it?.person?.name || it?.person?.userId ? it.person : doc.requester);

  // anchorDate = วันที่ของใบ Advance (ใบเคลมนับเข้าเดือนของ Advance เหมือนรายงานส่วนอื่น)
  // parent = ใบ Advance ที่ใบเคลมนี้เคลียร์ (หน้าจอจับคู่ "เบิก ↔ ใช้จริง" เป็นการ์ดเดียวกัน)
  const addLine = (doc, it, source, field, anchorDate, parent) => {
    const owner = ownerOf(it, doc);
    const b = bucket(owner);
    const amount = Number(it.amount) || 0;
    const byOther = personKey(owner) !== personKey(doc.requester);
    if (field === "requested") {
      b.requested += amount;
      if (byOther) {
        b.byOthers += amount;
        const rq = personLabel(doc.requester);
        b.requesters.set(rq, (b.requesters.get(rq) || 0) + amount);
        const rb = bucket(doc.requester);
        rb.forOthers += amount;
        rb.beneficiaries.set(b.label, (rb.beneficiaries.get(b.label) || 0) + amount);
      } else b.self += amount;
      const c = it.category || "other";
      b.categories.set(c, (b.categories.get(c) || 0) + amount);
    } else {
      b[field] += amount;
      if (field === "actual" && byOther) {
        b.claimedByOthers += amount;
        bucket(doc.requester).claimedForOthers += amount;
      }
    }
    const line = {
      source, field, docId: doc._id, docNo: doc.docNo, date: doc.docDate, status: doc.status,
      parentId: parent?._id || doc._id, parentNo: parent?.docNo || doc.docNo, parentDate: parent?.docDate || doc.docDate,
      month: monthKey(anchorDate || doc.docDate), paid: source === "advance" ? PAID.includes(doc.status) : CLAIM_DONE.includes(doc.status),
      requester: personLabel(doc.requester), byOther,
      category: it.category || "other", description: it.description || "", amount,
      ownerLabel: personLabel(owner), sharedWith: [],
    };
    b.lines.push(line);
    return line;
  };
  // ใบคู่เดียวกัน (Advance + ใบเคลมของมัน / ใบสำรองจ่าย) มีรายการของใครบ้าง → ใส่ชื่อคนอื่นให้ทุกบรรทัดของคู่นั้น
  const markShared = (lines) => {
    const names = [...new Set(lines.map((l) => l.ownerLabel))];
    if (names.length < 2) return;
    lines.forEach((l) => { l.sharedWith = names.filter((n) => n !== l.ownerLabel); });
  };

  rows.forEach((a) => {
    const pair = [];
    (a.items || []).forEach((it) => {
      pair.push(addLine(a, it, "advance", "requested"));
      if (PAID.includes(a.status)) bucket(ownerOf(it, a)).advanced += Number(it.amount) || 0;
    });
    const claim = a.claim && a.claim.status !== "cancelled" ? a.claim : null;
    if (claim && CLAIM_DONE.includes(claim.status)) {
      // ⚠️ ผู้เบิกของใบเคลม = ผู้เบิกของใบ Advance เสมอ — ใช้ของ Advance เผื่อแถวใบเคลมไม่ได้แนบ requester มา
      (claim.items || []).forEach((it) => pair.push(addLine({ ...claim, requester: claim.requester || a.requester }, it, "claim", "actual", a.docDate, a)));
    }
    markShared(pair);
  });
  reimburseRows.forEach((r) => {
    const pair = [];
    (r.items || []).forEach((it) => {
      pair.push(addLine(r, it, "reimburse", "requested"));
      if (CLAIM_DONE.includes(r.status)) bucket(ownerOf(it, r)).reimburse += Number(it.amount) || 0;
    });
    markShared(pair);
  });

  return [...map.values()]
    .map((b) => ({
      ...b,
      requested: money(b.requested), advanced: money(b.advanced), actual: money(b.actual), reimburse: money(b.reimburse),
      self: money(b.self), byOthers: money(b.byOthers), forOthers: money(b.forOthers),
      claimedByOthers: money(b.claimedByOthers), claimedForOthers: money(b.claimedForOthers),
      onSlips: money(b.self + b.forOthers),
      approvedCost: money(b.actual + b.reimburse),
      requesters: [...b.requesters].map(([name, amount]) => ({ name, amount: money(amount) })).sort((x, y) => y.amount - x.amount),
      beneficiaries: [...b.beneficiaries].map(([name, amount]) => ({ name, amount: money(amount) })).sort((x, y) => y.amount - x.amount),
      categories: [...b.categories].map(([key, amount]) => ({ key, amount: money(amount) })).sort((x, y) => y.amount - x.amount),
      lines: b.lines.sort((x, y) => String(y.date || "").localeCompare(String(x.date || "")) || String(y.docNo || "").localeCompare(String(x.docNo || ""))),
    }))
    .sort((x, y) => y.requested - x.requested || x.label.localeCompare(y.label, "th"));
}

/**
 * หมวดค่าใช้จ่าย + รายเดือน "ของคนเดียว" ตามชื่อในรายการ (ใช้ตอนเลือกดูคนใดคนหนึ่ง)
 * ✅ ผู้ใช้: เลือกนาย B แล้วแผงหมวด/รายเดือนต้องรวมยอดที่คนอื่นเบิกให้ B ด้วย — ไม่ใช่แค่ใบที่ B เป็นผู้เบิก
 * รูปร่างผลลัพธ์เหมือน report.byCategory / report.byMonth ทุกช่อง ใช้กับกราฟเดิมได้ทันที
 *   planned = รายการใน Advance ที่จ่ายแล้ว · actual = รายการในใบเคลมที่อนุมัติ · reimburse = สำรองจ่ายที่อนุมัติ
 */
export function personBreakdown(entry) {
  const cat = new Map();
  const mon = new Map();
  const c = (k) => { if (!cat.has(k)) cat.set(k, { key: k, planned: 0, actual: 0, reimburse: 0 }); return cat.get(k); };
  const m = (k) => {
    if (!mon.has(k)) mon.set(k, { key: k, label: k, ...emptyTotals() });
    return mon.get(k);
  };
  (entry?.lines || []).forEach((l) => {
    const amt = Number(l.amount) || 0;
    const mm = m(l.month);
    if (l.source === "advance") {
      mm.requested += amt;
      if (l.paid) { c(l.category).planned += amt; mm.advanced += amt; }
    } else if (l.source === "claim") {
      c(l.category).actual += amt; mm.actual += amt;
    } else if (l.source === "reimburse") {
      mm.requested += amt;
      if (l.paid) { c(l.category).reimburse += amt; mm.reimburse += amt; }
    }
  });
  return {
    byCategory: [...cat.values()]
      .map((x) => ({ ...x, planned: money(x.planned), actual: money(x.actual), reimburse: money(x.reimburse) }))
      .sort((x, y) => (y.actual + y.reimburse) - (x.actual + x.reimburse) || y.planned - x.planned),
    byMonth: [...mon.values()].map(round).sort((x, y) => (x.key < y.key ? -1 : 1)),
  };
}

/**
 * กรอง "ทีละหมวดค่าใช้จ่าย" — ✅ ผู้ใช้: "อยากดูแค่เบี้ยเลี้ยง หรือค่าน้ำมัน"
 * ⚠️ กรองที่ระดับ "รายการ" แล้วคำนวณยอดใบใหม่จากรายการที่เหลือ (ไม่ใช่กรองทั้งใบ) — ใบหนึ่งมีหลายหมวด
 *    ถ้ากรองทั้งใบ ยอดใบเต็มจะปนหมวดอื่นเข้ามา ตัวเลขทุกส่วนของรายงานจึงต้องคิดจากรายการชุดเดียวกันนี้
 *    • total ของใบ Advance / ใบสำรองจ่าย = ผลรวมรายการหมวดนั้น
 *    • ใบเคลม: total = ผลรวมรายการหมวดนั้น · difference = ใช้จริง − ตั้งเบิก (สูตรเดียวกับ server)
 *    • ใบที่ไม่มีรายการหมวดนั้นเลย (ทั้งฝั่งเบิกและเคลม) ถูกตัดออก
 */
export function filterByCategory(advances = [], reimbursements = [], category = "all") {
  if (!category || category === "all") return { advances, reimbursements };
  const pick = (items) => (items || []).filter((i) => (i.category || "other") === category);
  const sumOf = (items) => money(items.reduce((t, i) => t + (Number(i.amount) || 0), 0));
  const adv = advances
    .map((a) => {
      const items = pick(a.items);
      const total = sumOf(items);
      let claim = a.claim || null;
      if (claim) {
        const ci = pick(claim.items);
        const ct = sumOf(ci);
        claim = { ...claim, items: ci, total: ct, difference: money(ct - total) };
      }
      return { ...a, items, total, claim };
    })
    .filter((a) => a.items.length || a.claim?.items?.length);
  const rmb = reimbursements
    .map((r) => { const items = pick(r.items); return { ...r, items, total: sumOf(items) }; })
    .filter((r) => r.items.length);
  return { advances: adv, reimbursements: rmb };
}
