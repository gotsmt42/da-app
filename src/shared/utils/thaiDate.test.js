import { describe, it, expect } from "vitest";
import moment from "moment";
import { AdapterMoment } from "@mui/x-date-pickers/AdapterMoment";
import {
  thaiDate, thaiDateNumeric, thaiDateFull, thaiDateTime, thaiMonthYearFull,
  thaiYear, thaiDateRange, parseThai, patchYearTokens, toThaiPattern, toBEYear, toCEYear,
} from "./thaiDate";
import { formatEventDateRange } from "./formatDateRange";

// สร้าง adapter ชุดเดียวกับที่ ThaiDatePicker ใช้จริง เพื่อทดสอบพฤติกรรมของคลาสจริงๆ
class AdapterMomentBE extends AdapterMoment {
  formatByString = (date, format) => {
    const m = date.clone().locale(this.locale || "th");
    return m.format(toThaiPattern(format, toBEYear(m.year()), m.localeData()));
  };
  parse = (value, format) => {
    if (value === "" || value == null) return null;
    const ceText = String(value).replace(/\d{4}/, (y) =>
      Number(y) >= 2400 ? String(toCEYear(y)) : y
    );
    return this.moment(ceText, format, this.locale || "th", true);
  };
}

describe("thaiDate — รูปแบบสำเร็จรูป", () => {
  it("แสดงปี พ.ศ. และเดือนย่อภาษาไทย", () => {
    expect(thaiDate("2026-08-20")).toBe("20 ส.ค. 2569");
    expect(thaiDateNumeric("2026-08-20")).toBe("20/08/2569");
    expect(thaiDateFull("2026-08-20")).toBe("20 สิงหาคม 2569");
    expect(thaiDateTime("2026-08-20T14:30")).toBe("20 ส.ค. 2569 14:30");
    expect(thaiMonthYearFull("2026-08-20")).toBe("สิงหาคม 2569");
    expect(thaiYear("2026-08-20")).toBe("2569");
  });

  it("29 ก.พ. ต้องไม่ถูกหดเหลือ 28 (จุดที่วิธี add(543,'years') พัง)", () => {
    expect(thaiDate("2024-02-29")).toBe("29 ก.พ. 2567");
  });

  it("ค่าที่ใช้ไม่ได้คืน fallback ไม่ใช่ 'Invalid date'", () => {
    expect(thaiDate(null)).toBe("-");
    expect(thaiDate("")).toBe("-");
    expect(thaiDate("ไม่ใช่วันที่")).toBe("-");
    expect(thaiDate(null, "ยังไม่ระบุ")).toBe("ยังไม่ระบุ");
  });

  it("ช่วงวันที่ตัดส่วนที่ซ้ำออก", () => {
    expect(thaiDateRange("2026-08-20", "2026-08-25")).toBe("20 – 25 ส.ค. 2569");
    expect(thaiDateRange("2026-08-20", "2026-09-03")).toBe("20 ส.ค. – 3 ก.ย. 2569");
    expect(thaiDateRange("2025-08-20", "2026-09-03")).toBe("20 ส.ค. 2568 – 3 ก.ย. 2569");
    expect(thaiDateRange("2026-08-20", "2026-08-20")).toBe("20 ส.ค. 2569");
  });
});

describe("patchYearTokens — ต้องไม่แตะข้อความที่ escape ไว้", () => {
  it("เก็บ [..] ไว้เหมือนเดิม", () => {
    expect(patchYearTokens("[ปี] YYYY", 2569)).toBe("[ปี] [2569]");
    expect(patchYearTokens("[YYYY] YYYY", 2569)).toBe("[YYYY] [2569]");
    expect(patchYearTokens("DD/MM/YY", 2569)).toBe("DD/MM/[69]");
  });
});

describe("parseThai — อ่านข้อความ พ.ศ. กลับเป็น ค.ศ.", () => {
  it("อ่านค่าที่ถูกต้องได้", () => {
    expect(parseThai("20/08/2569").format("YYYY-MM-DD")).toBe("2026-08-20");
    expect(parseThai("29/02/2567").format("YYYY-MM-DD")).toBe("2024-02-29");
    expect(parseThai("01/01/2500").format("YYYY-MM-DD")).toBe("1957-01-01");
  });

  it("ค่าที่ไม่ถูกต้องคืน null ไม่ใช่วันที่มั่ว", () => {
    expect(parseThai("20/08/25")).toBeNull();   // พิมพ์ค้างกลางทาง
    expect(parseThai("31/02/2569")).toBeNull(); // วันที่ไม่มีจริง
    expect(parseThai("29/02/2569")).toBeNull(); // ค.ศ. 2026 ไม่ใช่ปีอธิกสุรทิน
    expect(parseThai("")).toBeNull();
  });
});

describe("AdapterMomentBE — ตัวที่ DatePicker ใช้จริง", () => {
  const a = new AdapterMomentBE({ instance: moment, locale: "th" });

  it("ช่องข้อความเป็น พ.ศ.", () => {
    expect(a.formatByString(moment("2026-08-20"), "DD/MM/YYYY")).toBe("20/08/2569");
  });

  it("หัวปฏิทินและปุ่มเลือกปีเป็น พ.ศ. (ผ่าน format ตามตาราง formats)", () => {
    const d = moment("2026-08-20");
    expect(a.format(d, "monthAndYear")).toBe("สิงหาคม 2569");
    expect(a.format(d, "year")).toBe("2569");
  });

  it("พิมพ์ พ.ศ. เข้าไปแล้วได้ ค.ศ. ที่ถูกต้อง", () => {
    expect(a.parse("20/08/2569", "DD/MM/YYYY").format("YYYY-MM-DD")).toBe("2026-08-20");
    expect(a.parse("29/02/2567", "DD/MM/YYYY").format("YYYY-MM-DD")).toBe("2024-02-29");
    expect(a.parse("", "DD/MM/YYYY")).toBeNull();
    expect(a.parse("20/08/25", "DD/MM/YYYY").isValid()).toBe(false);
  });

  it("ตรรกะวันที่ข้างในยังเป็น ค.ศ. (ไม่ถูกแตะ)", () => {
    const d = moment("2026-08-20");
    expect(a.getYear(d)).toBe(2026);
    expect(a.isValid(d)).toBe(true);
  });

  it("ไป-กลับ 3000 วันไม่เพี้ยนสักวัน", () => {
    let bad = 0;
    for (let i = 0; i < 3000; i++) {
      const d = moment("2020-01-01").add(i, "days");
      const shown = a.formatByString(d, "DD/MM/YYYY");
      const back = a.parse(shown, "DD/MM/YYYY");
      if (!back || back.format("YYYY-MM-DD") !== d.format("YYYY-MM-DD")) bad++;
    }
    expect(bad).toBe(0);
  });
});

describe("formatEventDateRange — ช่วงวันที่ของงาน", () => {
  it("ย่อส่วนที่ซ้ำกันออก และแสดงเป็น พ.ศ.", () => {
    expect(formatEventDateRange({ start: "2026-08-20" })).toBe("20 ส.ค. 2569");
    expect(formatEventDateRange({ start: "2026-08-20", end: "2026-08-25" })).toBe("20 – 25 ส.ค. 2569");
    expect(formatEventDateRange({ start: "2026-08-20", end: "2026-09-03" })).toBe("20 ส.ค. – 03 ก.ย. 2569");
  });

  it("งาน allDay ต้องลบวันสุดท้าออก 1 วัน (end เป็นแบบ exclusive)", () => {
    expect(formatEventDateRange({ start: "2026-08-20", end: "2026-08-26", allDay: true }))
      .toBe("20 – 25 ส.ค. 2569");
  });
});
