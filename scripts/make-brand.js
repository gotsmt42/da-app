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
 *    — ไม่ได้แปลงด้วยไลบรารีแปลงภาพ เพราะต้องได้ฟอนต์ตัวเดียวกับที่ออกแบบไว้
 */
const fs = require("fs");
const path = require("path");

const PUBLIC = path.join(__dirname, "..", "public");

// ══ ตัวตนของแบรนด์ ══════════════════════════════════════════════════════════
/** ชื่อแอป — ต้องตรงกับ APP_NAME ใน src/shared/appInfo.js */
const NAME = { head: "Tid", tail: "Tam", th: "ติดตาม" };

/**
 * สองโทน: กรมท่า + แดง
 * • กรม #0f172a = สีเดียวกับแถบเมนูข้างของแอป (--bg-primary) · แดง #dc2626 = สีเน้นของทั้งระบบ
 * ✅ โลโก้ใหม่ (12 พ.ย. 2569): พื้นขาว · T กรม + T แดง · ขอบเทา #e6e9ef (= ขอบการ์ดของแอป)
 * ⚠️ ห้ามใช้ไล่เฉด — แบรนด์นี้เป็นสีทึบล้วนทั้งชุด (พิมพ์ลงกระดาษ/ปั๊มสกรีนแล้วไม่เพี้ยน
 *    และตัวอักษรบนพื้นเข้มอ่านออกเท่ากันทุกจุด)
 */
const C = {
  navy: "#0f172a",
  red: "#dc2626",
  white: "#ffffff",
  line: "#e6e9ef",
  subOnLight: "#64748b",
  subOnDark: "rgba(255,255,255,.7)",
};

/**
 * ฟอนต์ชื่อแบรนด์ = Poppins 800 (เรขาคณิต หนา อ่านง่ายแม้ย่อเล็ก) · คำไทยใช้ฟอนต์เดียวกับตัวแอป
 * ⚠️ ใช้ตอน "ผลิตรูป" เท่านั้น ไม่ได้โหลดในแอปจริง — ของที่แอปใช้คือ PNG ที่ผลิตจากที่นี่
 */
const FONT_LATIN = "'Poppins', system-ui, sans-serif";
const FONT_THAI = "'IBM Plex Sans Thai', system-ui, sans-serif";
const FONT_URL = "https://fonts.googleapis.com/css2?family=Poppins:wght@800&family=IBM+Plex+Sans+Thai:wght@600&display=swap";

const NOTE = (what) => `
  <!--
    ${what}
    ⚠️ ไฟล์นี้ถูกสร้างจากสคริปต์ scripts/make-brand.js — ห้ามแก้ด้วยมือ (รันใหม่แล้วทับทันที)
    ⚠️ เป็นเครื่องหมายของ "แอป" เท่านั้น ไม่ใช่โลโก้บริษัท (โลโก้บริษัทตั้งจากหน้า "ตั้งค่าองค์กร")
  -->`;

// ══ เครื่องหมายประจำแอป ═════════════════════════════════════════════════════
/**
 * "TT" = Tid + Tam — ตัว T กรม (Tid) กับตัว T แดง (Tam) ซ้อนเหลื่อมกัน
 * ก้านของ T แดงจบลงที่วงกลมขาวมีเครื่องหมายถูก = "ติดตามจนงานเสร็จ"
 * (ผู้ใช้เลือกแบบ X3 เมื่อ 12 พ.ย. 2569 · มุมมน rx 2.5 — ห้ามปรับสัดส่วนเอง)
 *
 * ⚠️ ขอบขาวรอบ T แดงคือ "ช่องว่างคั่น" ระหว่างสองตัว — บนพื้นแดง (mono) ต้องเป็นสีแดง ไม่ใช่ขาว
 * @param {"onLight"|"mono"} way พื้นสว่าง / พื้นสีแบรนด์ (ขาวล้วน ช่องคั่นเป็นสีพื้นแดง)
 */
const MARK = (way) => {
  const t1 = way === "mono" ? C.white : C.navy;
  const t2 = way === "mono" ? C.white : C.red;
  const gap = way === "mono" ? C.red : C.white;
  const checkColor = C.red;
  const stem2 = `stroke="${gap}" stroke-width="2.5" paint-order="stroke"`;
  return `<g transform="translate(0 -2.5)">
  <rect x="8" y="14" width="30" height="9" rx="2.5" fill="${t1}"/>
  <rect x="18.5" y="14" width="9" height="36" rx="2.5" fill="${t1}"/>
  <rect x="26" y="24" width="30" height="9" rx="2.5" fill="${t2}" ${stem2}/>
  <rect x="36.5" y="24" width="9" height="22" rx="2.5" fill="${t2}" ${stem2}/>
  <rect x="26" y="24" width="30" height="9" rx="2.5" fill="${t2}"/>
  <circle cx="41" cy="46" r="9" fill="${C.white}"/>
  <path d="M36.5 46.2 l3.2 3.2 5.8-6.2" fill="none" stroke="${checkColor}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></g>`;
};

/**
 * ไอคอนสี่เหลี่ยมจัตุรัส (หน้าจอโฮม · แท็บเบราว์เซอร์) — พื้นกรมเข้าชุดกับแถบบน/แถบข้างของแอป
 * @param {number} [rx] ความโค้งมุม — 0 สำหรับ apple-touch/maskable เพราะระบบปฏิบัติการตัดมุมให้เอง
 *   (ถ้าโค้งมาเองด้วยจะโดนตัดซ้ำสองชั้น เห็นเป็นขอบขาวบางๆ รอบไอคอน)
 * @param {number} [pad] ระยะขอบของเครื่องหมาย — maskable ต้องหดเข้ามาให้อยู่ในวงปลอดภัย 80%
 */
const iconSvg = ({ rx = 15, pad = 5, note = "ไอคอนแอป" } = {}) => {
  const s = (64 - pad * 2) / 64;
  // พื้นขาวทึบ — ขอบเทาบางเฉพาะแบบมีมุมโค้ง (กันพื้นขาวกลืนไปกับหน้าจอสว่าง) · แบบเต็มใบ (rx=0) ระบบตัดมุมเอง ไม่ต้องมีขอบ
  const tile = rx > 0
    ? `<rect x=".75" y=".75" width="62.5" height="62.5" rx="${rx - 0.75}" fill="${C.white}" stroke="${C.line}" stroke-width="1.5"/>`
    : `<rect width="64" height="64" fill="${C.white}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="${NAME.head}${NAME.tail} ${NAME.th}">${NOTE(note)}
  ${tile}
  <g transform="translate(${pad} ${pad}) scale(${s.toFixed(4)})">${MARK("onLight")}</g>
</svg>`;
};

/** ป้ายแจ้งเตือน (Android ใช้เฉพาะความโปร่งใส) — T คู่สีขาวล้วน ช่องคั่นและเครื่องหมายถูกเจาะโปร่ง */
const badgeSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="96" height="96">
  <defs>
    <mask id="m1"><rect width="64" height="64" fill="#fff"/><rect x="26" y="24" width="30" height="9" rx="2.5" fill="#000" stroke="#000" stroke-width="5"/></mask>
    <mask id="m2"><rect width="64" height="64" fill="#fff"/><path d="M36.5 46.2 l3.2 3.2 5.8-6.2" fill="none" stroke="#000" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></mask>
  </defs>
  <g transform="translate(0 -2.5)">
    <g mask="url(#m1)"><rect x="8" y="14" width="30" height="9" rx="2.5" fill="#fff"/><rect x="18.5" y="14" width="9" height="36" rx="2.5" fill="#fff"/></g>
    <g mask="url(#m2)"><rect x="26" y="24" width="30" height="9" rx="2.5" fill="#fff"/><circle cx="41" cy="46" r="9.5" fill="#fff"/><rect x="36.5" y="30" width="9" height="12" fill="#fff"/></g>
  </g>
</svg>`;

/**
 * โลโก้ตัวอักษรล้วน (แถบบน · การ์ดฟอร์ม)
 * "Tid" ใช้ currentColor จึงอ่านออกทั้งพื้นเข้มและพื้นสว่าง · "Tam" เป็นสีแดงแบรนด์เสมอ
 * ⚠️ ไม่มีกรอบพื้นหลังและไม่มีเครื่องหมายนำหน้า (ผู้ใช้สั่งไว้ตั้งแต่แบรนด์ก่อนหน้า) —
 *    แบบที่มีเครื่องหมายอยู่ที่ app-logo-stacked.svg สำหรับพื้นที่ใหญ่
 */
const wordmarkSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 148 42" width="148" height="42" role="img" aria-label="${NAME.head}${NAME.tail} ${NAME.th}">${NOTE("โลโก้ตัวอักษรล้วน — ใช้บนแถบบนและการ์ดฟอร์ม")}
  <text x="2" y="33" font-family="${FONT_LATIN}" font-size="38" font-weight="800" letter-spacing="-1">
    <tspan fill="currentColor">${NAME.head}</tspan><tspan fill="${C.red}">${NAME.tail}</tspan>
  </text>
</svg>`;

/**
 * โลโก้เต็มชุด: เครื่องหมาย + ชื่อ + คำไทยกำกับ — ใช้ที่แผงใหญ่ (หน้าเข้าสู่ระบบ)
 * ⚠️ ต้องเป็น "แนวนอน" ถึงจะชื่อ stacked — หน้าเข้าสู่ระบบกำหนดความสูงไว้ 88px ถ้าเรียงแนวตั้ง
 *    ตัวอักษรจะเหลือเล็กจนอ่านไม่ออก (ดูคอมเมนต์ใน Login.js)
 * @param {"onLight"|"mono"} way
 */
const stackedSvg = (way) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 292 76" width="292" height="76" role="img" aria-label="${NAME.head}${NAME.tail} ${NAME.th}">${NOTE(`โลโก้เต็มชุด (เครื่องหมาย + ชื่อ + คำไทย)${way === "mono" ? " · แบบขาวล้วนสำหรับพื้นสีแบรนด์" : ""}`)}
  <g transform="translate(0 6)">${MARK(way)}</g>
  <text x="78" y="43" font-family="${FONT_LATIN}" font-size="40" font-weight="800" letter-spacing="-1">
    <tspan fill="currentColor">${NAME.head}</tspan><tspan fill="${way === "mono" ? "currentColor" : C.red}">${NAME.tail}</tspan>
  </text>
  <text x="80" y="63" font-family="${FONT_THAI}" font-size="14" font-weight="600" letter-spacing="4.6" fill="${way === "mono" ? C.subOnDark : C.subOnLight}">${NAME.th}</text>
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
  const shot = async (svg, { w, h, color = C.white, scale = 1 }) => {
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
  write("app-logo-stacked.svg", stackedSvg("onLight"));

  console.log("\n── ไอคอนแอป (PNG) ──");
  const iconAt = (px, svg) => shot(svg, { w: px, h: px });
  write("app-icon-192.png", await iconAt(192, icon));
  write("app-icon-512.png", await iconAt(512, icon));
  // apple-touch: ไม่ต้องโค้งมุมเอง (iOS ตัดให้) และต้องทึบทั้งใบ ไม่มีพื้นโปร่ง
  write("app-icon-apple-180.png", await iconAt(180, iconSvg({ rx: 0, note: "ไอคอนสำหรับ iOS (หน้าจอโฮม)" })));
  // maskable: เครื่องหมายต้องอยู่ในวงปลอดภัย 80% กลางภาพ เผื่อระบบตัดเป็นวงกลม/หยดน้ำ
  write("app-icon-maskable-512.png", await iconAt(512, iconSvg({ rx: 0, pad: 10, note: "ไอคอนแบบ maskable (Android ตัดรูปทรงเอง)" })));

  write("notification-badge.png", await shot(badgeSvg(), { w: 96, h: 96 }));

  console.log("\n── โลโก้ตัวอักษร (PNG) ──");
  const wm = wordmarkSvg();
  write("app-wordmark-light.png", await shot(wm, { w: 148, h: 42, color: C.white, scale: 4 }));
  write("app-wordmark-dark.png", await shot(wm, { w: 148, h: 42, color: C.navy, scale: 4 }));
  /**
   * ⚠️ แบบพื้นเข้ม (ใช้บนแผงสีแดงของหน้าเข้าสู่ระบบ) ต้องเป็น "ขาวล้วน" —
   * ถ้าใช้ชุดสองโทน ตัว "Tam" สีแดงกับช่วงแดงของวงแหวนจะไปจมกับพื้นแดงจนหายไปครึ่งโลโก้
   * (เห็นของจริงมาแล้ว) — เป็นกติกามาตรฐานของโลโก้บนพื้นสีแบรนด์
   */
  write("app-logo-stacked-light.png", await shot(stackedSvg("mono"), { w: 292, h: 76, color: C.white, scale: 4 }));
  write("app-logo-stacked-dark.png", await shot(stackedSvg("onLight"), { w: 292, h: 76, color: C.navy, scale: 4 }));

  console.log("\n── favicon.ico (16/32/48 ในไฟล์เดียว) ──");
  const ico = [];
  for (const size of [16, 32, 48]) ico.push({ size, buf: await iconAt(size, icon) });
  write("favicon.ico", buildIco(ico));

  await browser.close();
  console.log("\n✅ สร้างชุดโลโก้ครบแล้ว — อย่าลืมเลื่อนเลข ?v= ใน index.html และ public/manifest.json\n");
})();
