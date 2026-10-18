/**
 * make-native-assets.js — เตรียมรูปต้นฉบับสำหรับ "ไอคอนแอป + หน้าเปิดแอป" ของ Android / iPhone
 *
 * ✅ ใช้เครื่องหมายเดียวกับเว็บ (public/app-icon.svg ที่ scripts/make-brand.js สร้าง) — ไอคอนบนมือถือจึงตรงกับเว็บเสมอ
 * ขั้นตอน:  node scripts/make-native-assets.js  →  npm run cap:assets  (สร้างไอคอนทุกขนาดลง android/ ios/)
 *
 * ผลลัพธ์ในโฟลเดอร์ assets/ (ต้นฉบับที่ @capacitor/assets อ่าน):
 *   icon-only.png        1024² พื้นเต็ม (iPhone ตัดมุมเอง)
 *   icon-foreground.png  1024² พื้นใส — Android adaptive icon (เครื่องหมายอยู่ในวงปลอดภัย 66%)
 *   icon-background.png  1024² สีพื้น
 *   splash.png / splash-dark.png  2732² เครื่องหมายกลางจอบนพื้นกรมท่า
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "assets");
const NAVY = "#0f172a"; // = สีพื้นไอคอนใน make-brand.js

const svg = fs.readFileSync(path.join(ROOT, "public", "app-icon.svg"), "utf8");
// เครื่องหมายล้วน (ไม่มีพื้นสี่เหลี่ยม) — กลุ่ม <g> ตัวแรกในไฟล์
const mark = svg.slice(svg.indexOf("<g "), svg.lastIndexOf("</g>") + 4);
if (!mark.startsWith("<g ")) throw new Error("หาเครื่องหมายใน app-icon.svg ไม่เจอ — โครงไฟล์เปลี่ยน?");

/** วางเครื่องหมายกลางผืน size² ให้กว้าง ratio ของผืน */
const markSvg = (size, ratio, bg) => {
  const s = (size * ratio) / 64; // เครื่องหมายออกแบบบน viewBox 64
  const off = (size - 64 * s) / 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ""}
    <g transform="translate(${off} ${off}) scale(${s})">${mark}</g></svg>`);
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const write = (name, buf) => sharp(buf).png().toFile(path.join(OUT, name));
  await write("icon-only.png", markSvg(1024, 1, NAVY));
  await write("icon-foreground.png", markSvg(1024, 0.62, null));
  await write("icon-background.png", Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${NAVY}"/></svg>`));
  await write("splash.png", markSvg(2732, 0.2, NAVY));
  await write("splash-dark.png", markSvg(2732, 0.2, NAVY));
  console.log("✅ สร้างรูปต้นฉบับใน assets/ แล้ว — ต่อด้วย npm run cap:assets");
})().catch((e) => { console.error(e); process.exit(1); });
