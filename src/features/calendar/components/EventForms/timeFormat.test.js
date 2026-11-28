import { describe, it, expect } from "vitest";
import { normTime } from "./timeFormat";

describe("normTime", () => {
  it("จุด/ไม่มีศูนย์นำหน้า/มีคำว่า น. → ชม:นาที", () => {
    expect(normTime("18.00")).toBe("18:00");
    expect(normTime("8.30")).toBe("08:30");
    expect(normTime(" 9:05 ")).toBe("09:05");
    expect(normTime("17.30 น.")).toBe("17:30");
    expect(normTime("00.00")).toBe("00:00");
  });
  it("ค่าที่ไม่ใช่เวลา/ว่าง คงเดิม ไม่เดา", () => {
    expect(normTime("")).toBe("");
    expect(normTime(null)).toBe("");
    expect(normTime("ทั้งวัน")).toBe("ทั้งวัน");
    expect(normTime("25.00")).toBe("25.00");
    expect(normTime("8.75")).toBe("8.75");
  });
});
