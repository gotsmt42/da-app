import { describe, it, expect } from "vitest";
import moment from "moment";
import { nextVisitOverdueInfo, isRoundOverdue } from "./contractOverdue";

/**
 * เกณฑ์เตือน "รอบเข้างานถัดไป" — คิดเป็นเดือน ไม่ใช่วัน (ดู nextVisitOverdueInfo)
 *   ถึงเดือนที่ต้องเข้าแล้ว/เลยมาแล้ว → แดง · จะถึงเดือนหน้า → ส้ม · ไกลกว่านั้น → ไม่เตือน
 *
 * ⚠️ ฟิกซ์เจอร์คำนวณย้อนจาก "วันนี้" เสมอ ไม่ฮาร์ดโค้ดวันที่ — ไม่งั้นเทสต์จะพังเองเมื่อเวลาผ่านไป
 */
const INTERVAL = 6;

/** สร้างสัญญาที่รอบล่าสุดอยู่ห่างจากวันนี้ `monthsAgo` เดือน (ยังเหลือรอบให้ลงอีก) */
const contract = (monthsAgo, over = {}) => {
  const last = moment().startOf("month").subtract(monthsAgo, "months").date(15);
  return {
    isRealContract: true,
    visitCount: 4,
    intervalMonths: INTERVAL,
    visits: [{ _id: "v1", time: 1, start: last.toISOString(), end: null, unscheduled: false }],
    ...over,
  };
};

describe("nextVisitOverdueInfo — เตือนตามเดือนที่ต้องเข้างาน", () => {
  it("ถึงเดือนที่ต้องเข้างานพอดี → เตือนสีแดงทันที (ไม่ต้องรอให้เลยวัน)", () => {
    const info = nextVisitOverdueInfo(contract(INTERVAL));
    expect(info).toBeTruthy();
    expect(info.state).toBe("overdue");
    expect(info.color).toBe("#dc2626");
    expect(info.monthsUntilDue).toBe(0);
    expect(info.monthsOverdue).toBe(0);
    expect(info.label).toBe("ถึงรอบเข้างานแล้ว");
    expect(info.shortLabel).toBe("ถึงรอบแล้ว");
    expect(isRoundOverdue(contract(INTERVAL))).toBe(true);
  });

  it("เลยกำหนดมา 2 เดือน → แดง พร้อมบอกจำนวนเดือนที่เลยมา", () => {
    const info = nextVisitOverdueInfo(contract(INTERVAL + 2));
    expect(info.state).toBe("overdue");
    expect(info.monthsOverdue).toBe(2);
    expect(info.label).toBe("เลยกำหนดรอบเข้างานแล้ว 2 เดือน");
    expect(info.shortLabel).toBe("เกิน 2 ด.");
  });

  it("จะถึงรอบในอีก 1 เดือน → เตือนสีส้ม และไม่ถูกนับเป็น 'เลยกำหนด'", () => {
    const c = contract(INTERVAL - 1);
    const info = nextVisitOverdueInfo(c);
    expect(info).toBeTruthy();
    expect(info.state).toBe("due_soon");
    expect(info.color).toBe("#f59e0b");
    expect(info.monthsUntilDue).toBe(1);
    expect(info.shortLabel).toBe("ใกล้ถึงรอบ");
    // ⚠️ สำคัญ: ตัวเลขใต้ป้าย "เลยกำหนด" ต้องไม่โป่งขึ้นเพราะคำเตือนสีส้ม
    expect(isRoundOverdue(c)).toBe(false);
  });

  it("ยังอีก 2 เดือนขึ้นไป → ไม่เตือนเลย", () => {
    expect(nextVisitOverdueInfo(contract(INTERVAL - 2))).toBeNull();
    expect(nextVisitOverdueInfo(contract(0))).toBeNull();
  });

  it("ลงแผนงานครบทุกครั้งตามสัญญาแล้ว → ไม่เตือน", () => {
    expect(nextVisitOverdueInfo(contract(INTERVAL, { visitCount: 1 }))).toBeNull();
  });

  it("ยังไม่เคยลงตารางจริงสักครั้ง → ไม่เตือน (ไม่มีรอบล่าสุดให้เทียบ)", () => {
    const c = contract(INTERVAL);
    c.visits = [{ _id: "d1", time: 1, start: null, unscheduled: true }];
    expect(nextVisitOverdueInfo(c)).toBeNull();
  });

  it("งานทั่วไป/โปรเจค (ไม่ใช่สัญญาจริง) → ไม่เตือน", () => {
    expect(nextVisitOverdueInfo(contract(INTERVAL, { isRealContract: false }))).toBeNull();
  });

  it("งาน allDay — หักวัน end ที่ถูกบวกไป 1 วันตอนบันทึกออกก่อนเทียบ", () => {
    const last = moment().startOf("month").subtract(INTERVAL, "months").date(15);
    const c = contract(INTERVAL);
    c.visits = [{
      _id: "v1", time: 1, unscheduled: false, allDay: true,
      start: last.toISOString(),
      end: last.clone().add(1, "day").toISOString(),
    }];
    expect(nextVisitOverdueInfo(c).lastVisitDate.date()).toBe(15);
  });
});
