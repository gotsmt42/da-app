/**
 * ตัวตนของแอป (ชื่อ + เวอร์ชัน) ต้องตรงกันทุกที่ที่พิมพ์ไว้
 *
 * 🐛 ปัญหาจริงที่เคยเกิด: เลขเวอร์ชันเคยอยู่สองที่แล้วไม่ตรงกัน (.env เขียน 1.80 แต่
 *    package.json ค้างที่ 1.7.4) และ "เกี่ยวกับแอป" ในหน้าตั้งค่าเคยพิมพ์ชื่อบริษัทไว้แทนชื่อแอป
 * ⚠️ ชื่อแอปต้องพิมพ์ไว้ 3 ที่โดยเลี่ยงไม่ได้ — index.html (<title>) และ public/manifest.json
 *    เป็นไฟล์สแตติกที่ import โมดูลไม่ได้ ส่วน appInfo.js คือที่ที่โค้ดใช้
 *    เทสต์นี้จึงทำหน้าที่เป็นตัวยึด: เปลี่ยนชื่อแอปแล้วลืมแก้ที่ใดที่หนึ่ง เทสต์จะฟ้องทันที
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { APP_NAME, APP_VERSION } from "./appInfo";

// ⚠️ อ่านจากรากโปรเจกต์ (vitest รันจากที่นั่นเสมอ) ไม่ใช่อิง import.meta.url —
// ไฟล์เทสต์ถูกแปลงก่อนรัน ทำให้ path ที่อิงตัวไฟล์ชี้ผิดที่
const read = (rel) => readFileSync(resolve(process.cwd(), rel), "utf8");

describe("ตัวตนของแอป", () => {
  it("ชื่อแอปใน index.html ตรงกับ appInfo.js", () => {
    const title = read("index.html").match(/<title>([^<]*)<\/title>/)?.[1] || "";
    expect(title).toContain(APP_NAME);
  });

  it("ชื่อแอปใน manifest.json ตรงกับ appInfo.js", () => {
    const manifest = JSON.parse(read("public/manifest.json"));
    expect(manifest.short_name).toBe(APP_NAME);
    expect(manifest.name).toContain(APP_NAME);
  });

  it("เลขเวอร์ชันมาจาก package.json ที่เดียว", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(APP_VERSION).toBe(pkg.version);
    // ⚠️ ต้องเป็น semver สามท่อน — `npm version` สร้าง git tag จากค่านี้
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("ไม่มีใครอ่านเลขเวอร์ชันจาก .env อีกแล้ว", () => {
    // 🐛 เคยอ่านจาก REACT_APP_VERSION ซึ่งไม่ได้อยู่ใน git ทำให้ที่ deploy ต้องตั้งเองซ้ำ
    expect(import.meta.env.REACT_APP_VERSION).toBeUndefined();
  });
});
