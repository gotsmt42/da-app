import { describe, it, expect } from "vitest";
import { countUsedRounds, formatRoundLabel, visitsPerYear, INTERVAL_MONTHS_PRESETS } from "./contractRounds";

/**
 * เทสต์ชุดนี้มาแทน App.test.js เดิมที่ติดมากับ Create React App (มันหาข้อความ "learn react link"
 * ซึ่งไม่มีอยู่ในแอปนี้เลย = รันเมื่อไหร่ก็ fail)
 *
 * เลือกทดสอบ contractRounds เพราะเป็นฟังก์ชันบริสุทธิ์ที่มีกฎธุรกิจจริงอยู่ข้างใน และเป็นตัวที่พังแล้ว
 * เห็นผลทันทีกับผู้ใช้ (จำนวนครั้งของสัญญาผิด = ลงงานเกินโควตาได้)
 */
describe("countUsedRounds", () => {
  it("นับตาม 'ครั้งที่' ที่ไม่ซ้ำกัน ไม่ใช่จำนวน document", () => {
    // ครั้งที่ 2 เข้างาน 2 วันไม่ติดกัน → เป็น 2 document แต่ต้องนับเป็นครั้งเดียว
    const visits = [{ time: 1 }, { time: 2 }, { time: 2 }, { time: 3 }];
    expect(countUsedRounds(visits)).toBe(3);
  });

  it("ข้ามงานที่ยังไม่ระบุครั้งที่ (undefined / null / ค่าว่าง)", () => {
    expect(countUsedRounds([{ time: 1 }, { time: null }, { time: "" }, {}])).toBe(1);
  });

  it("มองว่าเลข 2 กับสตริง '2' เป็นครั้งเดียวกัน", () => {
    expect(countUsedRounds([{ time: 2 }, { time: "2" }])).toBe(1);
  });

  it("รับ input ที่ไม่ใช่ array ได้โดยไม่ throw", () => {
    expect(countUsedRounds(undefined)).toBe(0);
    expect(countUsedRounds(null)).toBe(0);
  });
});

describe("formatRoundLabel", () => {
  it("งานสัญญาโชว์เป็นสัดส่วน ครั้งที่/ทั้งหมด", () => {
    expect(formatRoundLabel(1, 3)).toBe("1/3");
  });

  it("งานที่ไม่ใช่งานสัญญา (ไม่มี visitCount) โชว์แค่เลขครั้ง", () => {
    expect(formatRoundLabel(2, undefined)).toBe("2");
    expect(formatRoundLabel(2, 0)).toBe("2");
  });

  it("ไม่มีครั้งที่ → คืนสตริงว่าง ไม่ใช่ 'undefined'", () => {
    expect(formatRoundLabel(undefined, 3)).toBe("");
    expect(formatRoundLabel(null, 3)).toBe("");
    expect(formatRoundLabel("", 3)).toBe("");
  });
});

describe("visitsPerYear", () => {
  it("คืนค่าเฉพาะตอน 12 หารด้วยระยะห่างลงตัว", () => {
    expect(visitsPerYear(3)).toBe(4);
    expect(visitsPerYear(6)).toBe(2);
    expect(visitsPerYear(12)).toBe(1);
  });

  it("หารไม่ลงตัวคืน null — ยอมไม่โชว์ ดีกว่าโชว์เลขที่สื่อสารผิด (ทุก 5 เดือน = ปีละ 2.4 ครั้ง)", () => {
    expect(visitsPerYear(5)).toBeNull();
    expect(visitsPerYear(7)).toBeNull();
  });

  it("ค่าที่เป็นไปไม่ได้คืน null", () => {
    expect(visitsPerYear(0)).toBeNull();
    expect(visitsPerYear(-3)).toBeNull();
    expect(visitsPerYear(undefined)).toBeNull();
  });
});

describe("INTERVAL_MONTHS_PRESETS", () => {
  it("มีครบ 6 ตัวเลือก เรียงจากถี่ไปห่าง", () => {
    expect(INTERVAL_MONTHS_PRESETS.map((p) => p.months)).toEqual([1, 2, 3, 4, 6, 12]);
  });

  it("สมมาตรกับ visitsPerYear() เสมอ — แปลงไปแปลงกลับต้องได้ค่าเดิม", () => {
    INTERVAL_MONTHS_PRESETS.forEach((p) => {
      expect(visitsPerYear(p.months)).toBe(p.perYear);
      expect(12 / p.perYear).toBe(p.months);
    });
  });

  it("ป้ายกำกับพูดเป็นภาษาไทยธรรมชาติ ไม่ใช่ 'ทุก 1 เดือน'/'ทุก 12 เดือน'", () => {
    expect(INTERVAL_MONTHS_PRESETS.find((p) => p.months === 1).label).toBe("ทุกเดือน (ปีละ 12 ครั้ง)");
    expect(INTERVAL_MONTHS_PRESETS.find((p) => p.months === 12).label).toBe("ทุกปี (ปีละ 1 ครั้ง)");
    expect(INTERVAL_MONTHS_PRESETS.find((p) => p.months === 3).label).toBe("ทุก 3 เดือน (ปีละ 4 ครั้ง)");
  });
});
