import { describe, expect, it } from "vitest";

import { SLUG_RE, emptyBlock, leadStatus, slugify, thaiShort } from "./webContent";

/**
 * ⚠️ slug คือ URL ที่ Google เก็บไว้ถาวร — ต้องผ่านกติกาเดียวกับ server (SLUG_RE ใน webShared.js)
 *    ทุกครั้ง ไม่งั้นผู้ใช้กดบันทึกแล้วโดนปฏิเสธหลังกรอกฟอร์มจนเสร็จ
 */
describe("slugify", () => {
  it("แปลงข้อความอังกฤษเป็น slug ที่ server ยอมรับ", () => {
    const s = slugify("Factory CCTV Upgrade — 64 Cameras!");
    expect(s).toBe("factory-cctv-upgrade-64-cameras");
    expect(SLUG_RE.test(s)).toBe(true);
  });

  it("ภาษาไทยล้วนคืนค่าว่าง ให้ผู้ใช้พิมพ์เอง (ไม่เดา URL ที่อ่านไม่รู้เรื่อง)", () => {
    expect(slugify("ติดตั้งกล้องวงจรปิดโรงงาน")).toBe("");
  });

  it("ไทยปนอังกฤษ เก็บเฉพาะส่วนอังกฤษ และไม่มีขีดซ้อน/ขีดหัวท้าย", () => {
    const s = slugify("ติดตั้ง Fire Alarm อาคาร 8 ชั้น");
    expect(s).toBe("fire-alarm-8");
    expect(SLUG_RE.test(s)).toBe(true);
  });

  it("ไม่ยาวเกิน 80 ตัวอักษร", () => {
    expect(slugify("a ".repeat(200)).length).toBeLessThanOrEqual(80);
  });
});

describe("emptyBlock", () => {
  it("ตารางเริ่มต้นมีจำนวนช่องในแถวเท่ากับหัวตาราง", () => {
    const t = emptyBlock("table");
    expect(t.rows[0].length).toBe(t.head.length);
  });
  it("รายการเริ่มต้นมีหนึ่งช่องให้พิมพ์ได้ทันที", () => {
    expect(emptyBlock("list").items).toEqual([""]);
  });
});

describe("leadStatus / thaiShort", () => {
  it("สถานะที่ไม่รู้จักตกไปเป็น 'ใหม่' ไม่ใช่ undefined ที่ทำให้หน้าจอพัง", () => {
    expect(leadStatus("???").value).toBe("new");
  });
  it("แสดงวันที่เป็น พ.ศ.", () => {
    expect(thaiShort("2026-09-24T07:05:00")).toBe("24 ก.ย. 2569");
    expect(thaiShort("")).toBe("-");
  });
});
