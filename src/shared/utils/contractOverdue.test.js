import { describe, it, expect } from "vitest";
import moment from "moment";
import { nextVisitOverdueInfo, isRoundOverdue, renewalMap } from "./contractOverdue";

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
    expect(info.state).toBe("due_now");
    expect(info.color).toBe("#dc2626");
    expect(info.monthsUntilDue).toBe(0);
    expect(info.monthsOverdue).toBe(0);
    expect(info.label.startsWith("ถึงรอบเดือนนี้ · ครั้งที่ 2/")).toBe(true);
    expect(info.shortLabel).toBe("ถึงรอบเดือนนี้");
    expect(isRoundOverdue(contract(INTERVAL))).toBe(true);
  });

  it("เลยกำหนดมา 2 เดือน → แดง พร้อมบอกจำนวนเดือนที่เลยมา", () => {
    const info = nextVisitOverdueInfo(contract(INTERVAL + 2));
    expect(info.state).toBe("overdue");
    expect(info.monthsOverdue).toBe(2);
    expect(info.label.startsWith("เลยกำหนด 2 เดือน · ครั้งที่ 2/")).toBe(true);
    expect(info.shortLabel).toBe("เลยกำหนด 2 ด.");
  });

  it("จะถึงรอบในอีก 1 เดือน → เตือนสีส้ม และไม่ถูกนับเป็น 'เลยกำหนด'", () => {
    const c = contract(INTERVAL - 1);
    const info = nextVisitOverdueInfo(c);
    expect(info).toBeTruthy();
    expect(info.state).toBe("due_soon");
    expect(info.color).toBe("#d97706");
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

// 🐛 (16 พ.ย. 2569) สัญญาที่ต่อแล้วต้องไม่ถูกนับเป็น "หมดอายุ" — ต้องตรงกับแจ้งเตือนฝั่ง server (renewedGroups)
describe("renewalMap", () => {
  const base = { isRealContract: true, company: "A", site: "S1", title: "PM", system: "Fire Alarm" };
  it("สัญญาเดิมที่มีฉบับใหม่ (เริ่มทีหลัง) = ต่อแล้ว", () => {
    const old = { ...base, key: "g1", contractStart: "2025-11-01" };
    const next = { ...base, key: "g2", contractStart: "2026-11-01" };
    const m = renewalMap([next, old]);
    expect(m.get("g1")?.key).toBe("g2");
    expect(m.has("g2")).toBe(false);
  });
  it("คนละระบบ/คนละโครงการ ไม่นับว่าต่อ · ตัวพิมพ์/ช่องว่างไม่มีผล", () => {
    const old = { ...base, key: "g1", contractStart: "2025-11-01" };
    expect(renewalMap([old, { ...base, key: "g2", system: "CCTV", contractStart: "2026-11-01" }]).size).toBe(0);
    expect(renewalMap([old, { ...base, key: "g3", site: " s1 ", contractStart: "2026-11-01" }]).get("g1")?.key).toBe("g3");
  });
  it("งานที่ไม่ใช่สัญญาจริง / ไม่มีวันเริ่ม ไม่ถูกนับ", () => {
    const old = { ...base, key: "g1", contractStart: "2025-11-01" };
    expect(renewalMap([old, { ...base, key: "g2", isRealContract: false, contractStart: "2026-11-01" }]).size).toBe(0);
    expect(renewalMap([old, { ...base, key: "g3", contractStart: null }]).size).toBe(0);
  });
});
