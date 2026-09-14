import { describe, it, expect } from "vitest";
import { localFormCode, planRows, __test } from "./expenseBlankPdf";

const { splitMoney, SIG_TOP, AFTER_H, AFTER_H_SIMPLE, ROW_H, ROW_H_TIGHT } = __test;

// ตำแหน่งขอบบนของแถวแรกที่ใช้จริงในฟอร์ม (หน้าแรก / หน้าต่อ) — ค่าประมาณจาก drawFirstPageTop
const FIRST_TOP = 114.3;
const NEXT_TOP = 42.5;

describe("localFormCode", () => {
  it("รูปแบบ FB-YYMMDD-XXXXXX และไม่มีตัวอักษรที่อ่านสับสน (0/O/1/I)", () => {
    const code = localFormCode(new Date(2026, 8, 14));
    expect(code).toMatch(/^FB-260914-[2-9A-HJ-NP-Z]{6}$/);
  });

  it("สุ่มไม่ซ้ำกัน", () => {
    const codes = new Set(Array.from({ length: 200 }, () => localFormCode()));
    expect(codes.size).toBe(200);
  });
});

describe("splitMoney (ช่อง บาท | สต.)", () => {
  it("แยกบาทกับสตางค์ และเติมศูนย์หน้าสตางค์", () => {
    expect(splitMoney(1500)).toEqual({ baht: "1,500", satang: "00" });
    expect(splitMoney(1480.5)).toEqual({ baht: "1,480", satang: "50" });
    expect(splitMoney(0.05)).toEqual({ baht: "0", satang: "05" });
  });
});

describe("planRows — ห้ามตัดรายการที่ตั้งเบิกทิ้ง", () => {
  const totalRows = (plan) => plan.reduce((s, p) => s + p.rows, 0);

  it("ฟอร์มเปล่า = หน้าเดียว แถวสูงปกติ เติมเต็มพื้นที่ก่อนช่องลายเซ็น", () => {
    const plan = planRows(0, FIRST_TOP, NEXT_TOP);
    expect(plan).toHaveLength(1);
    expect(plan[0].rowH).toBe(ROW_H);
    expect(plan[0].last).toBe(true);
    expect(FIRST_TOP + plan[0].rows * ROW_H).toBeLessThanOrEqual(SIG_TOP - AFTER_H + 1e-6);
    expect(plan[0].rows).toBeGreaterThanOrEqual(10);
  });

  it("รายการน้อย = หน้าเดียว และมีแถวว่างเหลือให้เขียนอย่างน้อย 2 แถว", () => {
    const plan = planRows(3, FIRST_TOP, NEXT_TOP);
    expect(plan).toHaveLength(1);
    expect(plan[0].rows - 3).toBeGreaterThanOrEqual(2);
  });

  it("รายการเกินแถวปกติเล็กน้อย = บีบแถวให้จบหน้าเดียวก่อน", () => {
    const normalCap = Math.floor((SIG_TOP - AFTER_H - FIRST_TOP) / ROW_H);
    const plan = planRows(normalCap, FIRST_TOP, NEXT_TOP);
    expect(plan).toHaveLength(1);
    expect(plan[0].rowH).toBe(ROW_H_TIGHT);
    expect(plan[0].rows).toBeGreaterThanOrEqual(normalCap + 2);
  });

  it("ฟอร์มสำรองจ่าย: ท้ายตารางสั้นกว่า (ยอดรวมแถวเดียว) จึงได้แถวเขียนมากกว่า และยังไม่ทับลายเซ็น", () => {
    const claim = planRows(0, FIRST_TOP, NEXT_TOP);
    const rmb = planRows(0, FIRST_TOP, NEXT_TOP, AFTER_H_SIMPLE);
    expect(AFTER_H_SIMPLE).toBeLessThan(AFTER_H);
    expect(rmb).toHaveLength(1);
    expect(rmb[0].rows).toBeGreaterThan(claim[0].rows);
    expect(FIRST_TOP + rmb[0].rows * rmb[0].rowH).toBeLessThanOrEqual(SIG_TOP - AFTER_H_SIMPLE + 1e-6);
  });

  it("รายการเยอะ = ต่อหน้า 2 ครบทุกรายการ และยอดรวม/ลายเซ็นอยู่หน้าสุดท้ายหน้าเดียว", () => {
    [30, 40].forEach((n) => {
      const plan = planRows(n, FIRST_TOP, NEXT_TOP);
      expect(plan.length).toBeGreaterThan(1);
      expect(totalRows(plan)).toBeGreaterThanOrEqual(n + 2);
      expect(plan.filter((p) => p.last)).toHaveLength(1);
      expect(plan[plan.length - 1].last).toBe(true);
    });
  });
});
