import { describe, it, expect } from "vitest";
import { buildExpenseReport } from "./expenseReport";
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
  it("ทิศทางส่วนต่าง", () => {
    expect(differenceMeta(120).short).toBe("จ่ายเพิ่ม");
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
    expect(r.byJob.map((j) => j.label)).toEqual(["PM · ตึก A", "ไม่ผูกงาน"]);
    expect(r.byMonth.map((m) => m.key)).toEqual(["2026-08", "2026-09"]);
  });

  it("ไม่มีเศษทศนิยมลอยตัว", () => {
    const r = buildExpenseReport([adv({ total: 0.1 }), adv({ total: 0.2 })], { now });
    expect(r.totals.advanced).toBe(0.3);
  });
});
