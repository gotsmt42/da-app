import { describe, it, expect } from "vitest";
import moment from "moment";
import { excelDate } from "./excelDate";

describe("excelDate", () => {
  it("ตัวเลขวัน/เวลาใน UTC ตรงกับเวลาท้องถิ่น (Excel ไม่มีโซนเวลา)", () => {
    const local = moment("2026-08-04 08:30", "YYYY-MM-DD HH:mm");
    const d = excelDate(local.toDate());
    expect([d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()]).toEqual([2026, 7, 4, 8, 30]);
  });
  it("เที่ยงคืนไม่เลื่อนเป็นวันก่อนหน้า", () => {
    const d = excelDate(moment("2026-08-04", "YYYY-MM-DD"));
    expect(d.getUTCDate()).toBe(4);
    expect(d.getUTCHours()).toBe(0);
  });
  it("ค่าว่าง/ไม่ถูกต้อง = ว่าง", () => {
    expect(excelDate(null)).toBe("");
    expect(excelDate("")).toBe("");
    expect(excelDate("ไม่ใช่วันที่")).toBe("");
  });
});
