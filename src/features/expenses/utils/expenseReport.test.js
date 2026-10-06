import { describe, it, expect } from "vitest";
import { buildExpenseReport, buildPersonLedger, personBreakdown, filterByCategory } from "./expenseReport";
import { bahtText, qtyText, differenceMeta } from "../expenseMeta";

const adv = (over = {}) => ({
  _id: Math.random().toString(16).slice(2),
  kind: "advance",
  status: "paid",
  total: 1000,
  docDate: "2026-09-08T12:00:00.000Z",
  requester: { userId: "u1", name: "เอ" },
  eventId: "",
  items: [{ category: "allowance", amount: 1000 }],
  claim: null,
  ...over,
});

/** ใบสำรองจ่าย (kind=claim + claimType=reimburse) — ไม่มี Advance ให้ผูก จึงมาคนละก้อนกับ adv() */
const rmb = (over = {}) => ({
  _id: Math.random().toString(16).slice(2),
  kind: "claim",
  claimType: "reimburse",
  status: "approved",
  total: 250,
  difference: 250,
  docDate: "2026-09-12T12:00:00.000Z",
  requester: { userId: "u1", name: "เอ" },
  eventId: "",
  items: [{ category: "fuel", amount: 250 }],
  ...over,
});

describe("bahtText", () => {
  it.each([
    [0, "ศูนย์บาทถ้วน"],
    [1, "หนึ่งบาทถ้วน"],
    [11, "สิบเอ็ดบาทถ้วน"],
    [21, "ยี่สิบเอ็ดบาทถ้วน"],
    [101, "หนึ่งร้อยเอ็ดบาทถ้วน"],
    [1000, "หนึ่งพันบาทถ้วน"],
    [1480.5, "หนึ่งพันสี่ร้อยแปดสิบบาทห้าสิบสตางค์"],
    [0.25, "ยี่สิบห้าสตางค์"],
    [1000000, "หนึ่งล้านบาทถ้วน"],
    [1000001, "หนึ่งล้านหนึ่งบาทถ้วน"],
    [2110021, "สองล้านหนึ่งแสนหนึ่งหมื่นยี่สิบเอ็ดบาทถ้วน"],
    [21000000, "ยี่สิบเอ็ดล้านบาทถ้วน"],
  ])("%s → %s", (n, text) => {
    expect(bahtText(n)).toBe(text);
  });
});

describe("qtyText / differenceMeta", () => {
  it("แสดงแบบแบบฟอร์มกระดาษ", () => {
    expect(qtyText({ qty: 4, unitPrice: 250, unit: "วัน" })).toBe("250 × 4 วัน");
    expect(qtyText({ qty: 1, unitPrice: 480.5, unit: "" })).toBe("480.50");
  });
  it("ทิศทางส่วนต่าง — คำต้องบอกว่าใครจ่ายให้ใคร", () => {
    expect(differenceMeta(120).short).toBe("จ่ายเพิ่มให้พนักงาน");
    expect(differenceMeta(-80).short).toBe("คืนเงินบริษัท");
    expect(differenceMeta(-80).amount).toBe(80);
    expect(differenceMeta(0).short).toBe("พอดี");
  });
});

describe("buildExpenseReport", () => {
  const now = new Date("2026-09-20T00:00:00Z");

  it("แยกยอดตามขั้น: รออนุมัติ / รอจ่าย / จ่ายแล้ว / ค้างเคลียร์ / เลยกำหนด", () => {
    const r = buildExpenseReport([
      adv({ status: "pending", total: 300 }),
      adv({ status: "rejected", total: 50 }),
      adv({ status: "approved", total: 200 }),
      adv({ status: "paid", total: 1000, dueClearAt: "2026-09-15T12:00:00Z" }),
      adv({ status: "cancelled", total: 9999 }),
    ], { now });
    expect(r.totals).toMatchObject({ count: 4, requested: 1550, pending: 350, toPay: 200, advanced: 1000, outstanding: 1000, overdue: 1, actual: 0 });
  });

  it("ใบเคลมที่ยังไม่อนุมัติ = ยังค้างเคลียร์ · อนุมัติแล้ว = ใช้จริง + ส่วนต่างรอปิด · ปิดแล้ว = คืน/จ่ายแล้ว", () => {
    const r = buildExpenseReport([
      adv({ status: "clearing", total: 1000, claim: { status: "pending", total: 900, difference: -100 } }),
      adv({ status: "clearing", total: 1000, claim: { status: "approved", total: 1200, difference: 200, items: [{ category: "fuel", amount: 1200 }] } }),
      adv({ status: "cleared", total: 500, items: [{ category: "allowance", amount: 500 }], claim: { status: "settled", total: 450, difference: -50, items: [{ category: "allowance", amount: 450 }] } }),
    ], { now });
    expect(r.totals).toMatchObject({ advanced: 2500, outstanding: 1000, actual: 1650, extraDue: 200, refundDue: 0, refunded: 50, extraPaid: 0 });
    const fuel = r.byCategory.find((c) => c.key === "fuel");
    expect(fuel).toMatchObject({ actual: 1200 });
    expect(r.byCategory.find((c) => c.key === "allowance")).toMatchObject({ planned: 2500, actual: 450 });
  });

  it("จัดกลุ่มตามคน / งาน (ไม่ผูกงานอยู่ท้าย) / เดือน", () => {
    const r = buildExpenseReport([
      adv({ requester: { userId: "u1", name: "เอ" }, total: 100, docDate: "2026-08-31T12:00:00Z" }),
      adv({ requester: { userId: "u2", name: "บี" }, total: 700, eventId: "e1", job: { title: "PM", site: "ตึก A" } }),
      adv({ requester: { userId: "u2", name: "บี" }, total: 300, eventId: "e1", job: { title: "PM", site: "ตึก A" } }),
    ], { now });
    expect(r.byPerson.map((p) => [p.label, p.advanced])).toEqual([["บี", 1000], ["เอ", 100]]);
    expect(r.byJob.map((j) => j.label)).toEqual(["PM โครงการ ตึก A", "ไม่ผูกงาน"]);
    expect(r.byMonth.map((m) => m.key)).toEqual(["2026-08", "2026-09"]);
  });

  it("สายอนุมัติ 3 ส่วน: นับใบค้างแต่ละมือครบทุกชนิดใบ พร้อมทิศทางเงินของขั้นอนุมัติเบิกจ่าย", () => {
    const r = buildExpenseReport([
      adv({ status: "pending", total: 300 }),
      adv({ status: "reviewed", total: 400 }),
      adv({ status: "approved", total: 500 }),
      adv({ status: "clearing", total: 1000, claim: { status: "approved", total: 1200, difference: 200 } }),
      adv({ status: "clearing", total: 1000, claim: { status: "approved", total: 700, difference: -300 } }),
      adv({ status: "clearing", total: 1000, claim: { status: "reviewed", total: 900, difference: -100 } }),
      adv({ status: "clearing", total: 1000, claim: { status: "cancelled", total: 1, difference: -999 } }),
    ], {
      now,
      reimbursements: [rmb({ status: "pending", total: 150 }), rmb({ status: "approved", total: 250 })],
    });
    expect(r.pipeline.review).toMatchObject({ count: 2, advance: 1, reimburse: 1, amount: 450 });
    expect(r.pipeline.approve).toMatchObject({ count: 2, advance: 1, claim: 1, amount: 1300 });
    // ส่วนที่ 3: จ่ายออก = Advance 500 + ส่วนต่างเพิ่ม 200 + คืนค่าสำรองจ่าย 250 · รับคืน = 300
    expect(r.pipeline.disburse).toMatchObject({ count: 4, advance: 1, claim: 2, reimburse: 1, payOut: 950, payIn: 300 });
  });

  it("ไม่มีเศษทศนิยมลอยตัว", () => {
    const r = buildExpenseReport([adv({ total: 0.1 }), adv({ total: 0.2 })], { now });
    expect(r.totals.advanced).toBe(0.3);
  });

  it("ใบสำรองจ่าย: แยกยอดของตัวเอง ไม่ปนกับจ่ายล่วงหน้า/ใช้จริง", () => {
    const r = buildExpenseReport([adv({ status: "paid", total: 1000, requester: { userId: "u1", name: "เอ" } })], {
      now,
      reimbursements: [
        rmb({ status: "pending", total: 100 }),
        rmb({ status: "approved", total: 200 }),
        rmb({ status: "settled", total: 300 }),
        rmb({ status: "cancelled", total: 9999 }),
      ],
    });
    // ⚠️ advanced/actual ต้องไม่ขยับเลย — สองตัวนี้มีไว้เทียบเงินที่จ่ายล่วงหน้ากับที่ใช้จริงเท่านั้น
    expect(r.totals).toMatchObject({
      advanced: 1000, actual: 0,
      reimburseCount: 3, reimbursePending: 100, reimburse: 500, reimburseDue: 200, reimbursePaid: 300,
    });
  });

  it("ใบสำรองจ่าย: โผล่ในกลุ่มตามคน/งาน/เดือน แม้คนนั้นไม่เคยเบิก Advance เลย", () => {
    const r = buildExpenseReport([adv({ requester: { userId: "u1", name: "เอ" }, total: 400 })], {
      now,
      reimbursements: [
        rmb({ status: "settled", total: 250, requester: { userId: "u9", name: "ซี" }, eventId: "e9", job: { title: "ซ่อมด่วน", site: "ตึก Z" } }),
      ],
    });
    const c = r.byPerson.find((p) => p.label === "ซี");
    expect(c).toMatchObject({ advanced: 0, reimburse: 250, reimburseCount: 1 });
    expect(r.byJob.map((j) => j.label)).toContain("ซ่อมด่วน โครงการ ตึก Z");
    expect(r.byMonth.find((m) => m.key === "2026-09")).toMatchObject({ reimburse: 250 });
    expect(r.byCategory.find((x) => x.key === "fuel")).toMatchObject({ reimburse: 250 });
  });

  it("ใบสำรองจ่าย: อ่านว่า 'จ่ายคืนพนักงาน' ไม่ใช่ 'จ่ายเพิ่มให้พนักงาน'", () => {
    expect(differenceMeta(500, "reimburse").short).toBe("จ่ายคืนพนักงาน");
    expect(differenceMeta(500, "claim").short).toBe("จ่ายเพิ่มให้พนักงาน");
  });
});

describe("buildPersonLedger — รายบุคคลตามชื่อในรายการ", () => {
  const A = { userId: "a", name: "นาย A" };
  const B = { userId: "b", name: "นาย B" };
  const advance = {
    _id: "adv1", docNo: "ADV-1", docDate: "2026-09-10", status: "cleared", requester: A, total: 1500,
    items: [
      { category: "allowance", description: "เบี้ยเลี้ยง A", amount: 500 },
      { category: "allowance", description: "เบี้ยเลี้ยง B", amount: 1000, person: B },
    ],
    claim: {
      _id: "clm1", docNo: "CLM-1", docDate: "2026-09-12", status: "settled", requester: A, total: 1400,
      items: [
        { category: "allowance", amount: 500 },
        { category: "allowance", amount: 900, person: B },
      ],
    },
  };
  const reimburse = {
    _id: "rmb1", docNo: "RMB-1", docDate: "2026-09-15", status: "approved", requester: B, total: 300,
    items: [{ category: "fuel", amount: 300 }],
  };

  it("นับเงินบรรทัดที่ใส่ชื่อ B เป็นของ B และบอกว่า A เบิกให้", () => {
    const ledger = buildPersonLedger([advance], [reimburse]);
    const b = ledger.find((p) => p.userId === "b");
    expect(b.requested).toBe(1300);        // 1000 (A เบิกให้) + 300 (สำรองจ่ายเอง)
    expect(b.byOthers).toBe(1000);
    expect(b.self).toBe(300);
    expect(b.requesters).toEqual([{ name: "นาย A", amount: 1000 }]);
    expect(b.advanced).toBe(1000);
    expect(b.actual).toBe(900);
    expect(b.reimburse).toBe(300);
    expect(b.approvedCost).toBe(1200);
  });

  it("บรรทัดที่ไม่ใส่ชื่อ = ของผู้เบิกเอง · ผู้เบิกเห็นยอดที่เบิกให้คนอื่นแยกไว้", () => {
    const a = buildPersonLedger([advance], []).find((p) => p.userId === "a");
    expect(a.requested).toBe(500);
    expect(a.byOthers).toBe(0);
    expect(a.actual).toBe(500);
    expect(a.forOthers).toBe(1000);
    expect(a.onSlips).toBe(1500);              // = ยอดใบ Advance ที่ A เป็นผู้เบิก
    expect(a.beneficiaries).toEqual([{ name: "นาย B", amount: 1000 }]);
  });

  it("หมวด/รายเดือนของคนเดียว รวมยอดที่คนอื่นเบิกให้", () => {
    const b = buildPersonLedger([advance], [reimburse]).find((p) => p.userId === "b");
    const { byCategory, byMonth } = personBreakdown(b);
    expect(byCategory.find((c) => c.key === "allowance")).toEqual({ key: "allowance", planned: 1000, actual: 900, reimburse: 0 });
    expect(byCategory.find((c) => c.key === "fuel").reimburse).toBe(300);
    const sep = byMonth.find((x) => x.key === "2026-09");
    expect(sep.advanced).toBe(1000);
    expect(sep.actual).toBe(900);       // ใบเคลมนับเข้าเดือนของใบ Advance
    expect(sep.reimburse).toBe(300);
  });

  it("เคลมให้คนอื่น: A ตั้งเบิกในชื่อตัวเอง แต่ตอนเคลมแยกบรรทัดให้ B", () => {
    const adv = {
      _id: "adv9", docNo: "ADV-9", docDate: "2026-09-20", status: "cleared", requester: A, total: 1000,
      items: [{ category: "allowance", amount: 1000 }],
      claim: { _id: "clm9", docNo: "CLM-9", status: "settled", requester: A, total: 1000,
        items: [{ category: "allowance", amount: 600 }, { category: "allowance", amount: 400, person: B }] },
    };
    const ledger = buildPersonLedger([adv], []);
    const a = ledger.find((p) => p.userId === "a");
    const b = ledger.find((p) => p.userId === "b");
    expect(a.requested).toBe(1000);
    expect(a.actual).toBe(600);
    expect(a.claimedForOthers).toBe(400);
    expect(b.requested).toBe(0);
    expect(b.actual).toBe(400);
    expect(b.claimedByOthers).toBe(400);
    expect(b.lines[0].sharedWith).toEqual(["นาย A"]);
    expect(a.lines.every((l) => l.sharedWith.includes("นาย B"))).toBe(true);
  });

  it("ไม่นับใบที่ยกเลิก และใบเคลมที่ยังไม่อนุมัติไม่นับเป็นใช้จริง", () => {
    const ledger = buildPersonLedger([
      { ...advance, status: "cancelled" },
      { ...advance, _id: "adv2", status: "paid", claim: { ...advance.claim, status: "pending" } },
    ], []);
    const b = ledger.find((p) => p.userId === "b");
    expect(b.requested).toBe(1000);
    expect(b.actual).toBe(0);
  });
});

describe("filterByCategory — ดูทีละหมวด", () => {
  const A = { userId: "a", name: "เอ" };
  const adv = {
    _id: "x1", docNo: "ADV-X", docDate: "2026-09-01", status: "cleared", requester: A, total: 1500,
    items: [{ category: "allowance", amount: 500 }, { category: "fuel", amount: 1000 }],
    claim: { _id: "c1", docNo: "CLM-X", status: "settled", requester: A, total: 1300, difference: -200,
      items: [{ category: "allowance", amount: 500 }, { category: "fuel", amount: 800 }] },
  };
  const rmb = { _id: "r1", docNo: "RMB-X", docDate: "2026-09-02", status: "approved", requester: A, total: 300, items: [{ category: "toll", amount: 300 }] };

  it("ยอดใบ/ใบเคลม/ส่วนต่าง คิดใหม่จากรายการหมวดนั้น", () => {
    const { advances, reimbursements } = filterByCategory([adv], [rmb], "fuel");
    expect(advances).toHaveLength(1);
    expect(advances[0].total).toBe(1000);
    expect(advances[0].claim.total).toBe(800);
    expect(advances[0].claim.difference).toBe(-200);
    expect(reimbursements).toHaveLength(0);
    const r = buildExpenseReport(advances, { reimbursements });
    expect(r.totals.requested).toBe(1000);
    expect(r.totals.actual).toBe(800);
    expect(r.totals.refunded).toBe(200);
  });

  it("all = ไม่กรอง", () => {
    const out = filterByCategory([adv], [rmb], "all");
    expect(out.advances[0]).toBe(adv);
    expect(out.reimbursements[0]).toBe(rmb);
  });
});
