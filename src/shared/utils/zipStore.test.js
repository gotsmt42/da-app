import { describe, it, expect } from "vitest";
import { buildZip, crc32, uniqueFileNames } from "./zipStore";

const enc = new TextEncoder();
const dec = new TextDecoder();

/** อ่าน ZIP กลับจาก central directory — พิสูจน์ว่าโครงสร้างถูกตามมาตรฐาน */
function readZip(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  expect(v.getUint32(end, true)).toBe(0x06054b50);
  const count = v.getUint16(end + 10, true);
  // ขนาดสารบัญ + ตำแหน่งสารบัญ ต้องจบพอดีที่ท้ายไฟล์ (โปรแกรมแตก ZIP ใช้ค่านี้หาสารบัญ)
  expect(v.getUint32(end + 16, true) + v.getUint32(end + 12, true)).toBe(end);
  let p = v.getUint32(end + 16, true);
  const files = [];
  for (let i = 0; i < count; i += 1) {
    expect(v.getUint32(p, true)).toBe(0x02014b50);
    expect(v.getUint16(p + 8, true) & 0x0800).toBe(0x0800); // ธง UTF-8
    const crc = v.getUint32(p + 16, true);
    const size = v.getUint32(p + 24, true);
    const nameLen = v.getUint16(p + 28, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(bytes.slice(p + 46, p + 46 + nameLen));
    expect(v.getUint32(local, true)).toBe(0x04034b50);
    const localNameLen = v.getUint16(local + 26, true);
    const data = bytes.slice(local + 30 + localNameLen, local + 30 + localNameLen + size);
    files.push({ name, data, crc });
    p += 46 + nameLen;
  }
  return files;
}

describe("zipStore", () => {
  it("crc32 ตรงค่ามาตรฐาน", () => {
    expect(crc32(enc.encode("hello"))).toBe(0x3610a686);
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it("รวมหลายไฟล์ (ชื่อไทย) แล้วอ่านกลับได้ครบ ข้อมูลและ CRC ตรง", () => {
    const zip = buildZip([
      { name: "ใบแจ้งเข้างาน 000025-2569.pdf", data: enc.encode("%PDF-1 first") },
      { name: "b.pdf", data: enc.encode("second file") },
    ]);
    const files = readZip(zip);
    expect(files.map((f) => f.name)).toEqual(["ใบแจ้งเข้างาน 000025-2569.pdf", "b.pdf"]);
    expect(dec.decode(files[0].data)).toBe("%PDF-1 first");
    expect(files[1].crc).toBe(crc32(enc.encode("second file")));
  });

  it("ชื่อซ้ำต่อท้าย (2) (3) และตัดอักขระที่ใช้ในชื่อไฟล์ไม่ได้", () => {
    expect(uniqueFileNames(["a.pdf", "A.pdf", "a.pdf", "x/y.pdf"])).toEqual(["a.pdf", "A (2).pdf", "a (3).pdf", "x-y.pdf"]);
  });
});
