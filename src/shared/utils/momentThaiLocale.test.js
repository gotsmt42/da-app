import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import moment from "moment";
import "./momentThaiLocale";

describe("momentThaiLocale", () => {
  it("ลงทะเบียน locale ไทยกับ moment ตัวที่แอปใช้จริง", () => {
    expect(moment.locales()).toContain("th");
    expect(moment("2026-08-11").locale("th").format("D MMMM YYYY")).toBe("11 สิงหาคม 2026");
    expect(moment("2026-08-11").locale("th").format("D MMM")).toBe("11 ส.ค.");
  });

  it("longDateFormat ครบ — ปฏิทิน MUI ใช้ token ย่อพวกนี้ผ่าน localeData()", () => {
    const ld = moment().locale("th").localeData();
    expect(ld.longDateFormat("L")).toBe("DD/MM/YYYY");
    expect(ld.longDateFormat("LL")).toBe("D MMMM YYYY");
    // ตัวพิมพ์เล็ก moment สร้างให้เองจากตัวพิมพ์ใหญ่ — ต้องได้ผลไม่ว่างเปล่า
    expect(ld.longDateFormat("ll")).toBeTruthy();
  });
});

/**
 * 🐛 ด่านกันบั๊กที่เคยเกิดจริง: ก่อนหน้านี้ทั้งแอปใช้ `import "moment/locale/th"` ซึ่ง **ใช้ไม่ได้จริง
 * ในเบราว์เซอร์** — Vite แยกไฟล์นั้นเป็น chunk ที่ฝังสำเนา moment ของตัวเองไว้ข้างใน locale จึงไป
 * ลงทะเบียนกับ moment คนละตัวกับที่แอปใช้ ผลคือเดือนขึ้นเป็นภาษาอังกฤษทั้งแอปโดยไม่มี error ใดๆ
 *
 * ⚠️ เทสต์นี้ต้องเป็นการ "สแกนซอร์ส" ไม่ใช่ทดสอบพฤติกรรม เพราะตอนรัน vitest โมดูลถูกแชร์กันถูกต้อง
 * อยู่แล้ว — ถ้าใครเผลอใส่ import แบบเดิมกลับมา เทสต์พฤติกรรมจะยังผ่านทั้งที่ของจริงพัง
 */
describe("ห้ามกลับไปใช้ import \"moment/locale/th\"", () => {
  const SRC = path.resolve(__dirname, "../..");
  const walk = (dir, out = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else if (e.name.endsWith(".js")) out.push(p);
    }
    return out;
  };

  it("ไม่มีไฟล์ไหนใน src import moment/locale/th อีก", () => {
    const offenders = walk(SRC).filter((p) => {
      if (p.endsWith("momentThaiLocale.js") || p.endsWith("momentThaiLocale.test.js")) return false;
      const s = fs.readFileSync(p, "utf8");
      return /(import|require)\s*\(?\s*["']moment\/locale\//.test(s);
    });
    expect(offenders.map((p) => path.relative(SRC, p))).toEqual([]);
  });
});
