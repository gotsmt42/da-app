import { describe, it, expect } from "vitest";
import { compareItems } from "./expenseCompare";

const adv = [
  { category: "allowance", description: "เบี้ยเลี้ยง", amount: 1000 },
  { category: "fuel", description: "ค่าน้ำมัน", amount: 480.5 },
  { category: "toll", description: "ทางด่วน", amount: 130 },
];

describe("compareItems", () => {
  it("จับคู่ด้วย advanceItemIndex · แถวที่ไม่ได้ใช้ยังโชว์ · รายการเพิ่มอยู่ท้าย", () => {
    const { rows, plannedTotal, actualTotal } = compareItems([
      { description: "ค่าน้ำมัน", amount: 420, advanceItemIndex: 1, receiptNo: "RC-1" },
      { description: "ค่าที่จอดรถ", amount: 40 },
      { description: "เบี้ยเลี้ยง", amount: 1000, advanceItemIndex: 0 },
    ], adv);
    expect(rows.map((r) => [r.kind, r.description, r.plannedAmount, r.actualAmount, r.diff])).toEqual([
      ["matched", "เบี้ยเลี้ยง", 1000, 1000, 0],
      ["matched", "ค่าน้ำมัน", 480.5, 420, -60.5],
      ["unused", "ทางด่วน", 130, 0, -130],
      ["added", "ค่าที่จอดรถ", 0, 40, 40],
    ]);
    expect(plannedTotal).toBe(1610.5);
    expect(actualTotal).toBe(1460);
  });

  it("อ้างแถวเดียวกันซ้ำ → แถวที่สองนับเป็นรายการเพิ่ม (ไม่นับตั้งเบิกซ้ำ)", () => {
    const { rows, plannedTotal } = compareItems([
      { description: "ค่าน้ำมัน เที่ยว 1", amount: 300, advanceItemIndex: 1 },
      { description: "ค่าน้ำมัน เที่ยว 2", amount: 200, advanceItemIndex: 1 },
    ], adv);
    expect(rows.filter((r) => r.kind === "added")).toHaveLength(1);
    expect(plannedTotal).toBe(1610.5);
  });

  it("ใบเคลมยอด 0 (ไม่ได้ใช้เงินเลย) → ทุกแถวเป็นไม่ได้ใช้", () => {
    const { rows, actualTotal } = compareItems([], adv);
    expect(rows.every((r) => r.kind === "unused")).toBe(true);
    expect(actualTotal).toBe(0);
  });

  it("ไม่มีข้อมูลใบ Advance → ทุกแถวเป็นรายการเพิ่ม ไม่พัง", () => {
    const { rows } = compareItems([{ description: "x", amount: 5, advanceItemIndex: 0 }], undefined);
    expect(rows[0].kind).toBe("added");
  });
});
