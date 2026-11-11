import { describe, it, expect, vi } from "vitest";

// ⚠️ ทดสอบเฉพาะการรวมหลายใบ — ตัดการโหลดรูป/ตั้งค่าองค์กรจากเครือข่าย และให้ outputDocument คืนจำนวนแผ่นแทนไฟล์
vi.mock("@/features/documents/utils/deliveryNotePdf", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    preparePrintAssets: async () => {},
    drawLetterhead: () => 30,
    outputDocument: (doc, name) => ({ name, pageCount: doc.getNumberOfPages() }),
  };
});

const { generateExpensesPdf, generateExpensePdf } = await import("./expensePdf");

const person = { userId: "u1", name: "ช่าง A", fullName: "ช่าง A ทดสอบ" };
const item = (amount) => ({ category: "allowance", description: "เบี้ยเลี้ยง", amount, qty: 1, unitPrice: amount });
const advance = (no, extra = {}) => ({
  _id: `a${no}`, kind: "advance", docNo: `ADV-0000${no}/2569`, docDate: "2026-11-05T05:00:00.000Z", status: "paid",
  subject: `เบิกงาน ${no}`, requester: person, items: [item(500)], total: 500, ...extra,
});
const claim = (no, adv) => ({
  _id: `c${no}`, kind: "claim", claimType: "clear", docNo: `CLM-0000${no}/2569`, docDate: "2026-11-08T05:00:00.000Z", status: "approved",
  subject: adv.subject, requester: person, items: [item(300)], total: 300, difference: -200, advance: { _id: adv._id, docNo: adv.docNo, total: adv.total }, advanceDoc: adv,
});

describe("พิมพ์หลายใบในไฟล์เดียว (generateExpensesPdf)", () => {
  it("ใบ Advance 1 แผ่น · ใบเคลม 2 แผ่น (แนบใบ Advance) · รวมแผ่นตรงกับที่วาดจริง", async () => {
    const a1 = advance(1);
    const a2 = advance(2);
    const out = await generateExpensesPdf({
      items: [{ expense: a1 }, { expense: claim(2, a2), signatures: { advance: {} } }, { expense: advance(3) }],
      fileName: "ทดสอบ",
    });
    expect(out.sheets).toBe(4);
    expect(out.pageCount).toBe(4);
    expect(out.name).toBe("ทดสอบ");
  }, 60000);

  it("ใบเดียวผ่านทางพิมพ์หลายใบ = จำนวนแผ่นเท่ากับพิมพ์ทีละใบ", async () => {
    const a = advance(5);
    const c = claim(5, a);
    const single = await generateExpensePdf({ expense: c, signatures: null });
    const bulk = await generateExpensesPdf({ items: [{ expense: c }] });
    expect(single.pageCount).toBe(2);
    expect(bulk.pageCount).toBe(single.pageCount);
  }, 60000);

  it("ไม่มีใบ = ไม่สร้างไฟล์ (โยนข้อผิดพลาด)", async () => {
    await expect(generateExpensesPdf({ items: [] })).rejects.toThrow();
  });
});
