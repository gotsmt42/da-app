/**
 * zipStore — รวมหลายไฟล์เป็น .zip ไฟล์เดียว (แบบ "store" ไม่บีบอัด) ไม่ต้องพึ่งไลบรารีเพิ่ม
 *
 * ✅ (28 พ.ย. 2569 ผู้ใช้: "ทำให้มี select เลือกเพื่อเลือกดาวน์โหลด หรือดำเนินการต่างๆ แบบหลายไฟล์ทีเดียว")
 *    ดาวน์โหลดเอกสารหลายใบ = ได้ไฟล์ ZIP ไฟล์เดียว (ไม่ใช่เบราว์เซอร์เด้งถามดาวน์โหลดทีละไฟล์)
 *    PDF บีบอัดภายในอยู่แล้ว — เก็บแบบไม่บีบซ้ำได้ขนาดใกล้เคียงกันและเร็วกว่า
 * ⚠️ ชื่อไฟล์ภาษาไทยใช้ธง UTF-8 (bit 11) — Windows Explorer / macOS / 7-Zip อ่านชื่อไทยถูก
 * ⚠️ รองรับไฟล์รวมไม่เกิน 4 GB (ZIP แบบเดิม ไม่ใช่ ZIP64) — เอกสารของระบบเล็กกว่านั้นมาก
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 (มาตรฐานเดียวกับ ZIP/PNG) */
export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** วัน/เวลาแบบ MS-DOS ที่ ZIP ใช้ (ละเอียด 2 วินาที) */
function dosDateTime(d) {
  const year = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/**
 * @param {{ name: string, data: Uint8Array, date?: Date }[]} files
 * @returns {Uint8Array} ไบต์ของไฟล์ .zip
 */
export function buildZip(files) {
  const enc = new TextEncoder();
  const entries = files.map((f) => {
    const name = enc.encode(f.name);
    const { time, date } = dosDateTime(f.date || new Date());
    return { name, data: f.data, crc: crc32(f.data), time, date };
  });
  const localSize = entries.reduce((t, e) => t + 30 + e.name.length + e.data.length, 0);
  const centralSize = entries.reduce((t, e) => t + 46 + e.name.length, 0);
  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);
  let p = 0;
  const u16 = (v) => { view.setUint16(p, v, true); p += 2; };
  const u32 = (v) => { view.setUint32(p, v >>> 0, true); p += 4; };
  const bytes = (b) => { out.set(b, p); p += b.length; };

  const offsets = [];
  entries.forEach((e) => {
    offsets.push(p);
    u32(0x04034b50); u16(20); u16(0x0800); u16(0); u16(e.time); u16(e.date);
    u32(e.crc); u32(e.data.length); u32(e.data.length); u16(e.name.length); u16(0);
    bytes(e.name); bytes(e.data);
  });
  const centralStart = p;
  entries.forEach((e, i) => {
    u32(0x02014b50); u16(20); u16(20); u16(0x0800); u16(0); u16(e.time); u16(e.date);
    u32(e.crc); u32(e.data.length); u32(e.data.length); u16(e.name.length); u16(0); u16(0);
    u16(0); u16(0); u32(0); u32(offsets[i]);
    bytes(e.name);
  });
  const centralLength = p - centralStart; // ⚠️ วัดก่อนเขียนท้ายไฟล์ — วัดหลังจะเกินมา 12 ไบต์ (โปรแกรมแตก ZIP หาสารบัญไม่เจอ)
  u32(0x06054b50); u16(0); u16(0); u16(entries.length); u16(entries.length);
  u32(centralLength); u32(centralStart); u16(0);
  return out;
}

/** ชื่อไฟล์ไม่ซ้ำกันใน ZIP — ซ้ำ = ต่อท้าย " (2)", " (3)" ก่อนนามสกุล */
export function uniqueFileNames(names) {
  const seen = new Map();
  return names.map((raw) => {
    const name = String(raw || "file").replace(/[\\/:*?"<>|]+/g, "-");
    const key = name.toLowerCase();
    const n = (seen.get(key) || 0) + 1;
    seen.set(key, n);
    if (n === 1) return name;
    const dot = name.lastIndexOf(".");
    return dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`;
  });
}

/** @param {{ name: string, blob: Blob }[]} files → Blob (application/zip) */
export async function zipBlobs(files) {
  const names = uniqueFileNames(files.map((f) => f.name));
  const parts = await Promise.all(files.map(async (f, i) => ({ name: names[i], data: new Uint8Array(await f.blob.arrayBuffer()) })));
  return new Blob([buildZip(parts)], { type: "application/zip" });
}
