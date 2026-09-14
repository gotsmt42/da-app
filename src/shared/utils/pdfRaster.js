/**
 * pdfRaster.js — แปลง PDF เป็นภาพ แล้วสั่งพิมพ์ด้วย window.print() ของหน้าเว็บเอง
 *
 * 🐛 ปัญหาที่แก้ ("หน้าพิมพ์ มือถือสั่งปริ้นไม่ได้"):
 *   • Chrome บน Android ไม่มีตัวแสดง PDF ในตัวเลย — iframe ที่โหลด PDF เป็นหน้าว่าง, สั่ง print() ที่ iframe
 *     ไม่มีอะไรเกิดขึ้น และเปิด blob: ในแท็บใหม่ก็ได้หน้าขาว/ดาวน์โหลดไม่ขึ้น → ผู้ใช้กดพิมพ์แล้วเงียบ
 *   • Safari บน iOS แสดง PDF ใน iframe ได้แค่เป็นภาพนิ่งหน้าแรก และสั่ง print() ที่ iframe ไม่ได้
 * ✅ สิ่งเดียวที่มือถือทุกค่ายรองรับแน่นอนคือ window.print() ของ "หน้าเว็บ" (Android = หน้าตัวอย่างก่อนพิมพ์
 *    ของระบบ เลือกเครื่องพิมพ์/บันทึกเป็น PDF ได้ · iOS = AirPrint) — จึงวาด PDF ลง canvas ด้วย pdf.js
 *    แปลงเป็นภาพ แล้วพิมพ์ภาพนั้นผ่าน @media print ที่ซ่อนทุกอย่างในหน้ายกเว้นภาพเอกสาร
 *
 * ⚠️ pdf.js ใหญ่ (~1 MB รวม worker) — dynamic import เฉพาะตอนต้องใช้จริง ไม่ถ่วงการเปิดหน้าอื่น
 * ⚠️ ใช้ build แบบ legacy — build ปกติใช้ syntax/API ใหม่ที่ Chrome/Safari รุ่นเก่าบนมือถือของช่างยังไม่มี
 *    (โหลดไม่ขึ้นแล้วพังทั้งกล่องพิมพ์)
 */

let pdfjsPromise = null;

const loadPdfjs = () => {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import("pdfjs-dist/legacy/build/pdf.mjs"),
      import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
    ])
      .then(([lib, worker]) => {
        lib.GlobalWorkerOptions.workerSrc = worker.default;
        return lib;
      })
      .catch((err) => {
        // ⚠️ ล้าง cache ทิ้งเมื่อโหลดพลาด (เน็ตหลุดกลางทาง) — ไม่งั้น promise ที่ fail จะค้างอยู่ตลอดจนกว่า
        // จะรีเฟรชหน้า กดพิมพ์กี่ครั้งก็พังซ้ำทั้งที่เน็ตกลับมาแล้ว
        pdfjsPromise = null;
        throw err;
      });
  }
  return pdfjsPromise;
};

/**
 * A4 ที่ 200 dpi = 1654×2339 px — คมพอสำหรับตัวหนังสือ 11–14pt บนเครื่องพิมพ์สำนักงานทั่วไป
 * ⚠️ ไม่ขึ้นไป 300 dpi: canvas 2480×3508 กินแรม ~35 MB ต่อหน้า และ Safari บน iPhone รุ่นเก่าจำกัดพื้นที่
 * canvas รวมไว้ ~16.7 ล้านพิกเซล — เกินแล้วได้ canvas ว่างเปล่าเงียบๆ ไม่มี error ให้เห็น
 */
const DEFAULT_DPI = 200;

/**
 * @param {Blob} blob  ไฟล์ PDF
 * @returns {Promise<Array<{url: string, blob: Blob, width: number, height: number}>>} ภาพ PNG ทีละหน้า
 *   ⚠️ ผู้เรียกต้อง revokePageImages() เองเมื่อเลิกใช้
 */
export async function renderPdfToImages(blob, { dpi = DEFAULT_DPI } = {}) {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await blob.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  const pdf = await task.promise;
  const pages = [];
  try {
    for (let n = 1; n <= pdf.numPages; n += 1) {
      // eslint-disable-next-line no-await-in-loop -- วาดทีละหน้าโดยตั้งใจ ไม่ให้ canvas หลายหน้ากินแรมพร้อมกัน
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale: dpi / 72 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      // eslint-disable-next-line no-await-in-loop
      await page.render({ canvas, viewport, background: "#ffffff" }).promise;
      // eslint-disable-next-line no-await-in-loop
      const png = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("แปลงหน้าเอกสารเป็นภาพไม่สำเร็จ"))), "image/png");
      });
      pages.push({ url: URL.createObjectURL(png), blob: png, width: canvas.width, height: canvas.height });
      page.cleanup();
      // ✅ คืนแรมของ canvas ทันที — Safari ไม่คืนเองจนกว่า GC จะมาเก็บ ซึ่งบนมือถือแรมน้อยอาจไม่ทัน
      canvas.width = 0;
      canvas.height = 0;
    }
  } catch (err) {
    revokePageImages(pages);
    throw err;
  } finally {
    // ⚠️ ปิดที่ loading task (ไม่ใช่ตัว pdf) — pdf.js v6 ย้าย destroy() มาไว้ที่นี่ และมันคือตัวปิด worker
    task.destroy();
  }
  return pages;
}

export const revokePageImages = (pages) => {
  (pages || []).forEach((p) => URL.revokeObjectURL(p.url));
};

const ROOT_ID = "pdf-print-root";
const STYLE_ID = "pdf-print-style";

/**
 * ⚠️ @page margin 0 + ภาพกว้างเต็มกระดาษ = ได้ขนาดตรงกับ PDF ต้นฉบับเป๊ะบน Chrome/Android
 * ⚠️ max-height 296mm (ไม่ใช่ 297) กันเศษปัดทศนิยมของเครื่องพิมพ์บางรุ่นที่ทำให้ภาพล้นไปอีกนิดเดียว
 *    แล้วได้กระดาษเปล่าเพิ่มมาอีก 1 แผ่นทุกครั้งที่พิมพ์
 * ⚠️ ซ่อนด้วย body > *:not(#root) — กล่อง Dialog ของ MUI ถูก portal ไปเป็นลูกของ body โดยตรง
 *    ถ้าซ่อนแค่ #root กล่องพิมพ์ทั้งกล่อง (ปุ่ม/พื้นหลังเทา) จะไปโผล่บนกระดาษด้วย
 */
const PRINT_CSS = `
#${ROOT_ID} { display: none; }
@media print {
  @page { size: A4 portrait; margin: 0; }
  html, body {
    margin: 0 !important; padding: 0 !important; background: #fff !important;
    height: auto !important; min-height: 0 !important; overflow: visible !important;
  }
  body > *:not(#${ROOT_ID}) { display: none !important; }
  #${ROOT_ID} { display: block !important; position: static !important; }
  #${ROOT_ID} .pdf-print-page { break-after: page; page-break-after: always; break-inside: avoid; }
  #${ROOT_ID} .pdf-print-page:last-child { break-after: auto; page-break-after: auto; }
  #${ROOT_ID} img { display: block; width: 100%; height: auto; max-height: 296mm; object-fit: contain; }
}`;

/**
 * เตรียมภาพเอกสารสำหรับพิมพ์ไว้ในหน้าเว็บล่วงหน้า (มองไม่เห็นบนจอ)
 *
 * ⚠️ ต้องเตรียมไว้ "ก่อน" ผู้ใช้กดปุ่มพิมพ์ ไม่ใช่สร้างตอนกด: Safari บน iOS ยอมให้ window.print() ทำงาน
 * เฉพาะในจังหวะที่ผู้ใช้แตะจริงเท่านั้น ถ้าต้องรอโหลดภาพ (await) ก่อนค่อยสั่งพิมพ์ จังหวะนั้นหลุดไปแล้ว
 * กดพิมพ์แล้วเงียบ — และภาพที่ยังโหลดไม่เสร็จจะออกมาเป็นกระดาษขาว
 *
 * @returns {Promise<{print: () => void, dispose: () => void}>}
 */
export async function preparePagePrint(pages, { title = "" } = {}) {
  document.getElementById(ROOT_ID)?.remove();
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = PRINT_CSS;
    document.head.appendChild(style);
  }
  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.setAttribute("aria-hidden", "true");
  const imgs = pages.map((p) => {
    const wrap = document.createElement("div");
    wrap.className = "pdf-print-page";
    const img = new Image(p.width, p.height);
    img.alt = "";
    img.decoding = "sync";
    img.src = p.url;
    wrap.appendChild(img);
    root.appendChild(wrap);
    return img;
  });
  document.body.appendChild(root);
  await Promise.all(imgs.map((img) => (typeof img.decode === "function" ? img.decode().catch(() => {}) : Promise.resolve())));

  let restoreTitle = null;
  return {
    print() {
      // ✅ ชื่อหน้าเว็บ = ชื่อไฟล์ตั้งต้นตอนเลือก "บันทึกเป็น PDF" ในหน้าพิมพ์ (ไม่งั้นได้ชื่อแอปทุกใบ)
      if (title && !restoreTitle) {
        const prev = document.title;
        document.title = title;
        restoreTitle = () => {
          document.title = prev;
          window.removeEventListener("afterprint", restoreTitle);
          restoreTitle = null;
        };
        window.addEventListener("afterprint", restoreTitle);
        // ⚠️ iOS ไม่ยิง afterprint ทุกครั้ง — ตั้งเวลาคืนชื่อสำรองไว้ ไม่ให้ชื่อแท็บค้างเป็นชื่อเอกสาร
        setTimeout(() => restoreTitle?.(), 15000);
      }
      window.print();
    },
    dispose() {
      restoreTitle?.();
      root.remove();
    },
  };
}

const ua = () => (typeof navigator === "undefined" ? "" : navigator.userAgent || "");

export const isIOS = () =>
  /iP(hone|ad|od)/.test(ua()) || (typeof navigator !== "undefined" && navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const isAndroid = () => /Android/i.test(ua());

/** Safari บนเครื่อง Mac — สั่ง print() ที่ iframe PDF แล้วได้กระดาษเปล่าในหลายเวอร์ชัน */
const isDesktopSafari = () => /^((?!chrome|chromium|crios|fxios|edg|android).)*safari/i.test(ua());

/**
 * เบราว์เซอร์ที่ฝังอยู่ในแอป (LINE / Facebook / Instagram / WebView) — window.print() ไม่ทำอะไรเลย
 * และแชร์ไฟล์ไม่ได้ ต้องบอกให้ผู้ใช้ "เปิดในเบราว์เซอร์" แทนการปล่อยให้กดแล้วเงียบ
 */
export const isInAppBrowser = () => /\bLine\/|FBAN|FBAV|Instagram|MicroMessenger|; wv\)/i.test(ua());

/**
 * ควรพิมพ์ด้วยภาพ (window.print) แทน iframe PDF ไหม
 * ✅ จอคอม Chrome/Edge/Firefox ยังใช้ iframe PDF ต่อ — ได้เส้นและตัวอักษรแบบเวกเตอร์ คมกว่าภาพ
 */
export const prefersImagePrint = () => {
  if (isIOS() || isAndroid() || isDesktopSafari()) return true;
  try {
    return window.matchMedia("(pointer: coarse)").matches && window.matchMedia("(max-width: 1024px)").matches;
  } catch {
    return false;
  }
};
