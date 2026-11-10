import { describe, it, expect } from "vitest";
import { vatParts, workValueNet, suggestWorkValue, vatNote, contractVatInfo } from "./workValue";

describe("vatParts", () => {
  it("ยอดก่อน VAT → บวก 7%", () => {
    expect(vatParts(10000, false)).toEqual({ net: 10000, vat: 700, gross: 10700 });
  });
  it("ยอดรวม VAT → ถอด 7%", () => {
    expect(vatParts(10700, true)).toEqual({ net: 10000, vat: 700, gross: 10700 });
  });
  it("ไม่มีค่า = null", () => {
    expect(vatParts("", false)).toBeNull();
    expect(vatParts(null, true)).toBeNull();
  });
});

describe("workValueNet", () => {
  it("ค่าเดิม (ไม่มีธง) ถือเป็นยอดก่อน VAT", () => {
    expect(workValueNet({ workValue: 5000 })).toBe(5000);
  });
  it("รวม VAT → คืนยอดก่อน VAT", () => {
    expect(workValueNet({ workValue: 10700, workValueVatIncluded: true })).toBe(10000);
  });
  it("ไม่มีค่า = null", () => {
    expect(workValueNet({ workValue: null })).toBeNull();
  });
});

describe("suggestWorkValue", () => {
  it("งานสัญญา: มูลค่าสัญญา ÷ จำนวนครั้ง · ครั้งสุดท้ายรับเศษ", () => {
    const base = { contractGroupId: "C1", jobValue: 100000, visitCount: 3 };
    expect(suggestWorkValue({ ...base, time: "1" }).amount).toBe(33333.33);
    const last = suggestWorkValue({ ...base, time: "3" });
    expect(last.amount).toBe(33333.34);
    expect(last.source).toBe("contract");
    expect(last.vatIncluded).toBe(false); // ยังไม่ระบุ VAT ของสัญญา = ก่อน VAT
    expect(last.hint).toMatch(/÷ 3 ครั้ง/);
    expect(suggestWorkValue({ ...base, time: "1", jobValueVatIncluded: true }).vatIncluded).toBe(true);
  });
  it("งานสัญญาไม่มีมูลค่า = ไม่แนะนำ", () => {
    expect(suggestWorkValue({ contractGroupId: "C1", visitCount: 4 })).toBeNull();
  });
  it("งานทั่วไปที่มีมูลค่างานรวม", () => {
    expect(suggestWorkValue({ jobValue: 15000 })).toMatchObject({ amount: 15000, source: "job" });
  });
  it("งานทั่วไป: ใบเสนอราคาที่ได้งาน ใช้ยอดที่อนุมัติจริงก่อน + ธง VAT ของใบ", () => {
    const s = suggestWorkValue({ quotationStatus: "approved", quotationAmount: 50000, quotationApprovedAmount: 21400, quotationVatIncluded: true });
    expect(s).toMatchObject({ amount: 21400, vatIncluded: true, source: "quotation" });
  });
  it("ใบเสนอราคายังไม่ได้งาน / นัดฝ่ายขาย = ไม่แนะนำ", () => {
    expect(suggestWorkValue({ quotationStatus: "sent", quotationAmount: 5000 })).toBeNull();
    expect(suggestWorkValue({ department: "sales", jobValue: 5000 })).toBeNull();
  });
});

describe("vatNote", () => {
  it("บอกอีกฝั่งของยอด", () => {
    expect(vatNote(10000, false)).toMatch(/^ก่อน VAT · รวม VAT ฿10,700/);
    expect(vatNote(10700, true)).toMatch(/^รวม VAT · ก่อน VAT ฿10,000/);
  });
});

describe("contractVatInfo (งานสัญญา = VAT ตามมูลค่าสัญญา)", () => {
  it("ไม่ใช่งานสัญญา = null", () => {
    expect(contractVatInfo({ jobValue: 5000 })).toBeNull();
  });
  it("ระบุแล้ว / ยังไม่ระบุ / ยังไม่มีมูลค่าสัญญา", () => {
    expect(contractVatInfo({ contractGroupId: "C", jobValue: 1000, jobValueVatIncluded: true })).toMatchObject({ vatIncluded: true, set: true, hasValue: true });
    const unset = contractVatInfo({ contractGroupId: "C", jobValue: 1000, jobValueVatIncluded: null });
    expect(unset).toMatchObject({ vatIncluded: false, set: false });
    expect(unset.text).toMatch(/ยังไม่ระบุ/);
    expect(unset.vatText).toMatch(/ยังไม่ระบุ VAT/);
    expect(contractVatInfo({ contractGroupId: "C" }).text).toMatch(/ยังไม่มีมูลค่าสัญญา/);
  });
});
