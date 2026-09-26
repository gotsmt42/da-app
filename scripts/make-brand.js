/**
 * make-brand.js — ผลิต "ชุดโลโก้ของแอป" ทั้งหมดจากต้นฉบับชุดเดียว (รันด้วย `npm run brand`)
 *
 * ✅ ทำไมต้องมีสคริปต์: ไฟล์แบรนด์มี 12 ไฟล์ (SVG 3 + PNG 8 + ICO 1) ที่ต้อง "เหมือนกันเป๊ะ" ทุกไฟล์
 * ถ้าแก้ทีละไฟล์ด้วยมือ วันหนึ่งไอคอนบนหน้าจอโฮมจะไม่ตรงกับบนแท็บเบราว์เซอร์โดยไม่มีใครรู้ตัว
 * แก้ที่ค่าคงที่ด้านล่างแล้วรันใหม่ที่เดียว ได้ครบทุกไฟล์เสมอ
 *
 * ⚠️ เป็นเครื่องหมายของ "แอป" เท่านั้น ไม่ใช่โลโก้บริษัทที่ผู้ใช้ตั้งเองจากหน้า "ตั้งค่าองค์กร"
 * ⚠️ ทุกครั้งที่รันแล้วรูปเปลี่ยนจริง ต้องเลื่อนเลข ?v= ใน index.html และ public/manifest.json ด้วย
 *    ไม่งั้นเบราว์เซอร์/มือถือหยิบไอคอนเดิมจากแคชมาใช้ แล้วผู้ใช้จะเห็นของเก่าไปอีกเป็นสัปดาห์
 * ⚠️ ต้องมี playwright-core (devDependency) เพราะใช้ Chromium เรนเดอร์ SVG เป็น PNG ให้คมจริง
 *    — ไม่ได้แปลงด้วยไลบรารีแปลงภาพ เพราะต้องได้ฟอนต์ IBM Plex Sans Thai ตัวเดียวกับที่แอปใช้
 */
const fs = require("fs");
const path = require("path");

const PUBLIC = path.join(__dirname, "..", "public");

// ══ ตัวตนของแบรนด์ ══════════════════════════════════════════════════════════
/** ชื่อแอป — ต้องตรงกับ APP_NAME ใน src/shared/appInfo.js */
const NAME = { head: "Tid", tail: "Tam", th: "ติดตาม" };

/**
 * สีแบรนด์ — ชุดเดียวกับที่ใช้ทั้งแอป (แดง #dc2626 เป็นสีหลักของระบบมาตั้งแต่ต้น)
 * ไล่เฉดจบที่พลัมเพื่อให้ท้ายชื่อมีน้ำหนัก ไม่แบนเหมือนตัวอักษรสีเดียว
 */
const C = {
  iconFrom: "#ef4444",
  iconTo: "#991b1b",
  wordFrom: "#fb4b5c",
  wordMid: "#dc2626",
  wordTo: "#a21caf",
  onLight: "#0f172a",
  onDark: "#ffffff",
  subOnLight: "#64748b",
  subOnDark: "rgba(255,255,255,.72)",
};

/** ฟอนต์เดียวกับตัวแอป (ดู index.html) — โลโก้จึงเป็นเนื้อเดียวกับหน้าจอ ไม่ใช่ของแปลกปลอม */
const FONT = "'IBM Plex Sans Thai', system-ui, sans-serif";
const FONT_URL = "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@600;700&display=swap";

const NOTE = (what) => `
  <!--
    ${what}
    ⚠️ ไฟล์นี้ถูกสร้างจากสคริปต์ scripts/make-brand.js — ห้ามแก้ด้วยมือ (รันใหม่แล้วทับทันที)
    ⚠️ เป็นเครื่องหมายของ "แอป" เท่านั้น ไม่ใช่โลโก้บริษัท (โลโก้บริษัทตั้งจากหน้า "ตั้งค่าองค์กร")
  -->`;

// ══ เครื่องหมายประจำแอป ═════════════════════════════════════════════════════
/**
 * วงแหวนติดตามเปิด 270° + หัวจุดที่ปลาย + เครื่องหมายถูกตรงกลาง
 * = "ติดตามงานจนจบ" (วงแหวน = กำลังติดตาม · หัวจุด = ตำแหน่งปัจจุบัน · ถูก = ปิดงานได้)
 * ⚠️ วาดบนกริด 64×64 เสมอ — ที่อื่นแค่ย่อ/ขยายด้วย transform ไม่วาดใหม่
 */
const MARK = (stroke) => `
  <path d="M32 12 A20 20 0 1 0 49 22" fill="none" stroke="${stroke}" stroke-width="6" stroke-linecap="round"/>
  <circle cx="32" cy="12" r="4.6" fill="${stroke}"/>
  <path d="M23 32.5 L29.5 39 L42 25" fill="none" stroke="${stroke}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;

/**
 * ไอคอนสี่เหลี่ยมจัตุรัส (หน้าจอโฮม · แท็บเบราว์เซอร์)
 * @param {number} [rx] ความโค้งมุม — 0 สำหรับ apple-touch/maskable เพราะระบบปฏิบัติการตัดมุมให้เอง
 *   (ถ้าโค้งมาเองด้วยจะโดนตัดซ้ำสองชั้น เห็นเป็นขอบขาวบางๆ รอบไอคอน)
 * @param {number} [pad] ระยะขอบของเครื่องหมาย — maskable ต้องหดเข้ามาให้อยู่ในวงปลอดภัย 80%
 */
const iconSvg = ({ rx = 15, pad = 0, note = "ไอคอนแอป" } = {}) => {
  const s = (64 - pad * 2) / 64;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="${NAME.head}${NAME.tail} ${NAME.th}">${NOTE(note)}
  <defs>
    <linearGradient id="tt" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${C.iconFrom}"/><stop offset="1" stop-color="${C.iconTo}"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="${rx}" fill="url(#tt)"/>
  <g transform="translate(${pad} ${pad}) scale(${s.toFixed(4)})">${MARK("#ffffff")}</g>
</svg>`;
};

/**
 * โลโก้ตัวอักษรล้วน (แถบบน · การ์ดฟอร์ม)
 * "Tid" ใช้ currentColor จึงอ่านออกทั้งพื้นเข้มและพื้นสว่าง · "Tam" ไล่เฉดสีแบรนด์
 * ⚠️ ไม่มีกรอบพื้นหลังและไม่มีเครื่องหมายนำหน้า (ผู้ใช้สั่งไว้ตั้งแต่แบรนด์ก่อนหน้า) —
 *    แบบที่มีเครื่องหมายอยู่ที่ app-logo-stacked.svg สำหรับพื้นที่ใหญ่
 */
const wordmarkSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 42" width="150" height="42" role="img" aria-label="${NAME.head}${NAME.tail} ${NAME.th}">${NOTE("โลโก้ตัวอักษรล้วน — ใช้บนแถบบนและการ์ดฟอร์ม")}
  <defs>
    <linearGradient id="ttWord" gradientUnits="userSpaceOnUse" x1="74" y1="36" x2="146" y2="8">
      <stop offset="0" stop-color="${C.wordFrom}"/><stop offset=".55" stop-color="${C.wordMid}"/><stop offset="1" stop-color="${C.wordTo}"/>
    </linearGradient>
  </defs>
  <text x="2" y="33" font-family="${FONT}" font-size="38" font-weight="700" letter-spacing="-.5">
    <tspan fill="currentColor">${NAME.head}</tspan><tspan fill="url(#ttWord)">${NAME.tail}</tspan>
  </text>
</svg>`;

/**
 * โลโก้เต็มชุด: เครื่องหมาย + ชื่อ + คำไทยกำกับ — ใช้ที่แผงใหญ่ (หน้าเข้าสู่ระบบ)
 * ⚠️ ต้องเป็น "แนวนอน" ไม่ใช่เรียงแนวตั้งจริงๆ ถึงจะชื่อ stacked — หน้าเข้าสู่ระบบกำหนดความสูงไว้
 *    88px ถ้าเรียงแนวตั้ง ตัวอักษรจะเหลือเล็กจนอ่านไม่ออก (ดูคอมเมนต์ใน Login.js)
 */
const stackedSvg = ({ sub, mono = false } = {}) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 296 76" width="296" height="76" role="img" aria-label="${NAME.head}${NAME.tail} ${NAME.th}">${NOTE(`โลโก้เต็มชุด (เครื่องหมาย + ชื่อ + คำไทย) — ใช้ที่แผงใหญ่${mono ? " · แบบขาวล้วนสำหรับพื้นสีแบรนด์" : ""}`)}
  <defs>
    <linearGradient id="ttIcon2" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${C.iconFrom}"/><stop offset="1" stop-color="${C.iconTo}"/>
    </linearGradient>
    <linearGradient id="ttWord2" gradientUnits="userSpaceOnUse" x1="204" y1="46" x2="290" y2="12">
      <stop offset="0" stop-color="${C.wordFrom}"/><stop offset=".55" stop-color="${C.wordMid}"/><stop offset="1" stop-color="${C.wordTo}"/>
    </linearGradient>
  </defs>
  <g transform="translate(0 6)">
    ${mono ? "" : `<rect width="64" height="64" rx="15" fill="url(#ttIcon2)"/>`}
    ${MARK(mono ? "currentColor" : "#ffffff")}
  </g>
  <text x="78" y="43" font-family="${FONT}" font-size="40" font-weight="700" letter-spacing="-.5">
    <tspan fill="currentColor">${NAME.head}</tspan><tspan fill="${mono ? "currentColor" : "url(#ttWord2)"}">${NAME.tail}</tspan>
  </text>
  <text x="80" y="63" font-family="${FONT}" font-size="15" font-weight="600" letter-spacing="3.4" fill="${sub}">${NAME.th}</text>
</svg>`;

// ══ แปลง SVG เป็น PNG ด้วย Chromium ══════════════════════════════════════════
let chromium;
try {
  ({ chromium } = require("playwright-core"));
} catch {
  console.error("❌ ต้องติดตั้ง playwright-core ก่อน:  npm i -D playwright-core");
  process.exit(1);
}

/** หา Chromium ที่เครื่องมีอยู่แล้ว (playwright-core ไม่ได้ดาวน์โหลดเบราว์เซอร์มาให้) */
const findChrome = () => {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const root = path.join(process.env.LOCALAPPDATA || "", "ms-playwright");
  if (fs.existsSync(root)) {
    for (const dir of fs.readdirSync(root).filter((d) => d.startsWith("chromium-")).sort().reverse()) {
      const exe = path.join(root, dir, "chrome-win64", "chrome.exe");
      if (fs.existsSync(exe)) return exe;
    }
  }
  for (const p of [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  ]) if (fs.existsSync(p)) return p;
  return null;
};

/** ห่อ SVG ด้วยหน้า HTML ที่โหลดฟอนต์จริง + ตั้งสีตัวอักษร (currentColor) ให้ตรงพื้นหลังปลายทาง */
const pageFor = (svg, { w, h, color }) => `<!doctype html><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONT_URL}" rel="stylesheet">
<style>html,body{margin:0;background:transparent}
  #box{width:${w}px;height:${h}px;color:${color};display:flex}
  #box svg{width:100%;height:100%}</style>
<div id="box">${svg}</div>`;

/** ICO = หัวไฟล์ + สารบัญ + ก้อน PNG ต่อกัน (Windows/เบราว์เซอร์อ่าน PNG ข้างในได้ตั้งแต่ Vista) */
const buildIco = (pngs) => {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = 6 + pngs.length * 16;
  const dir = [];
  for (const { size, buf } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8); e.writeUInt32LE(offset, 12);
    offset += buf.length;
    dir.push(e);
  }
  return Buffer.concat([head, ...dir, ...pngs.map((p) => p.buf)]);
};

(async () => {
  const exe = findChrome();
  if (!exe) {
    console.error("❌ ไม่พบ Chromium — ตั้ง CHROME_PATH ชี้ไปที่ chrome.exe แล้วรันใหม่");
    process.exit(1);
  }
  const browser = await chromium.launch({ executablePath: exe });
  const shot = async (svg, { w, h, color = C.onDark, scale = 1 }) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
    await page.setContent(pageFor(svg, { w, h, color }), { waitUntil: "networkidle" });
    // ⚠️ รอฟอนต์พร้อมจริง — ถ่ายก่อนฟอนต์มาถึงจะได้ตัวอักษรฟอนต์สำรองของเครื่อง (คนละหน้าตากันทุกเครื่อง)
    await page.evaluate(() => document.fonts.ready);
    const buf = await page.locator("#box").screenshot({ omitBackground: true });
    await page.close();
    return buf;
  };
  const write = (file, data) => {
    fs.writeFileSync(path.join(PUBLIC, file), data);
    console.log(`  ✓ ${file}  (${(data.length / 1024).toFixed(1)} kB)`);
  };

  console.log("\n── SVG ต้นฉบับ ──");
  const icon = iconSvg();
  write("app-icon.svg", icon);
  write("app-wordmark.svg", wordmarkSvg());
  write("app-logo-stacked.svg", stackedSvg({ sub: C.subOnLight }));

  console.log("\n── ไอคอนแอป (PNG) ──");
  const iconAt = (px, svg) => shot(svg, { w: px, h: px });
  write("app-icon-192.png", await iconAt(192, icon));
  write("app-icon-512.png", await iconAt(512, icon));
  // apple-touch: ไม่ต้องโค้งมุมเอง (iOS ตัดให้) และต้องทึบทั้งใบ ไม่มีพื้นโปร่ง
  write("app-icon-apple-180.png", await iconAt(180, iconSvg({ rx: 0, note: "ไอคอนสำหรับ iOS (หน้าจอโฮม)" })));
  // maskable: เครื่องหมายต้องอยู่ในวงปลอดภัย 80% กลางภาพ เผื่อระบบตัดเป็นวงกลม/หยดน้ำ
  write("app-icon-maskable-512.png", await iconAt(512, iconSvg({ rx: 0, pad: 7, note: "ไอคอนแบบ maskable (Android ตัดรูปทรงเอง)" })));

  console.log("\n── โลโก้ตัวอักษร (PNG) ──");
  const wm = wordmarkSvg();
  write("app-wordmark-light.png", await shot(wm, { w: 150, h: 42, color: C.onDark, scale: 4 }));
  write("app-wordmark-dark.png", await shot(wm, { w: 150, h: 42, color: C.onLight, scale: 4 }));
  /**
   * ⚠️ แบบพื้นเข้ม (ใช้บนแผงสีแดงของหน้าเข้าสู่ระบบ) ต้องเป็น "ขาวล้วนไม่มีกรอบ" —
   * ถ้าใช้ชุดสีเต็ม กรอบไอคอนสีแดงจะไปทับพื้นแดงจนจมหายไป และตัว "Tam" ที่ไล่เฉดแดง
   * ก็อ่านยากบนพื้นเดียวกัน (เห็นของจริงมาแล้ว) — เป็นกติกามาตรฐานของโลโก้บนพื้นสีแบรนด์
   */
  write("app-logo-stacked-light.png", await shot(stackedSvg({ sub: C.subOnDark, mono: true }), { w: 296, h: 76, color: C.onDark, scale: 4 }));
  write("app-logo-stacked-dark.png", await shot(stackedSvg({ sub: C.subOnLight }), { w: 296, h: 76, color: C.onLight, scale: 4 }));

  console.log("\n── favicon.ico (16/32/48 ในไฟล์เดียว) ──");
  const ico = [];
  for (const size of [16, 32, 48]) ico.push({ size, buf: await iconAt(size, icon) });
  write("favicon.ico", buildIco(ico));

  await browser.close();
  console.log("\n✅ สร้างชุดโลโก้ครบแล้ว — อย่าลืมเลื่อนเลข ?v= ใน index.html และ public/manifest.json\n");
})();
