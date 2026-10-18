/**
 * nativeBridge.js — ทำให้เว็บเดิมทำงานได้ครบ "ในแอปมือถือ" (Capacitor · Android / iPhone)
 *
 * ✅ (18 ต.ค. 2569 ผู้ใช้: "แปลงเป็นแอพมือถือ โดยที่แบบเดิมยังใช้งานได้ทั้งหมด")
 *    เว็บใช้ของที่ WebView ในแอปทำไม่ได้หลายอย่าง — แก้ "จุดเดียว" ที่นี่ แทนการไล่แก้ทุกหน้า (40+ จุด):
 *    • ดาวน์โหลดไฟล์ (Excel ผ่าน file-saver · PDF · <a download>) → เขียนลงเครื่อง แล้วเปิดเมนู "เปิด/แชร์"
 *      (ดูไฟล์ / บันทึก / ส่ง LINE / อีเมล ได้จากเมนูเดียว)
 *    • window.open / ลิงก์ target="_blank" ไปเว็บภายนอก (แผนที่ · ไฟล์บน Cloudinary) → เบราว์เซอร์ในแอป
 *    • ปุ่มย้อนกลับของ Android → ปิดกล่องที่เปิดอยู่ก่อน › ย้อนหน้า › ออกจากแอป
 *    • แถบสถานะ/หน้าเปิดแอป ให้เป็นสีประจำแอป
 *
 * ⚠️ ทำงานเฉพาะในแอป (Capacitor.isNativePlatform) — เว็บปกติไม่มีอะไรเปลี่ยนแม้แต่บรรทัดเดียว
 * ⚠️ tel: / mailto: / line: ไม่ดัก — Capacitor เปิดแอปโทรศัพท์/อีเมลของเครื่องให้เองอยู่แล้ว
 */
import { Capacitor } from "@capacitor/core";

const isNative = () => Capacitor.isNativePlatform();
let installed = false;

const EXT_BY_TYPE = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/csv": "csv",
  "image/png": "png",
  "image/jpeg": "jpg",
  "application/zip": "zip",
};

const safeName = (name, type) => {
  const base = String(name || "").replace(/[/\\:*?"<>|]/g, "-").trim();
  if (base && /\.[a-z0-9]{2,5}$/i.test(base)) return base;
  const ext = EXT_BY_TYPE[type] || "bin";
  return `${base || `TidTam-${Date.now()}`}.${ext}`;
};

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const fr = new FileReader();
  fr.onload = () => resolve(String(fr.result).split(",")[1] || "");
  fr.onerror = reject;
  fr.readAsDataURL(blob);
});

/** เขียนไฟล์ลงที่เก็บชั่วคราวของแอป แล้วเปิดเมนูของเครื่อง (ดู / บันทึก / แชร์) */
export async function deliverFile(blob, fileName) {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
  const name = safeName(fileName, blob.type);
  const { uri } = await Filesystem.writeFile({ path: name, data: await blobToBase64(blob), directory: Directory.Cache, recursive: true });
  try {
    await Share.share({ title: name, url: uri, dialogTitle: "เปิดหรือบันทึกไฟล์" });
  } catch (err) {
    // ผู้ใช้ปิดเมนูเอง = ไม่ใช่ข้อผิดพลาด
    if (!/cancel/i.test(String(err?.message || err))) throw err;
  }
}

const fromBlobUrl = async (url, fileName) => {
  const blob = await (await fetch(url)).blob();
  await deliverFile(blob, fileName);
};

const isExternalHttp = (url) => {
  try {
    const u = new URL(url, window.location.href);
    return /^https?:$/.test(u.protocol) && u.origin !== window.location.origin;
  } catch { return false; }
};

/** เปิดเว็บภายนอกในเบราว์เซอร์ของแอป (ปิดแล้วกลับมาหน้าเดิม) */
export async function openExternal(url) {
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url: new URL(url, window.location.href).href, presentationStyle: "popover", toolbarColor: "#182031" });
}

const warn = (err) => {
  console.error("nativeBridge:", err);
  import("sweetalert2").then(({ default: Swal }) => Swal.fire({
    toast: true, position: "top", icon: "error", title: "เปิดไฟล์ไม่สำเร็จ ลองใหม่อีกครั้ง",
    showConfirmButton: false, timer: 3000,
  })).catch(() => {});
};

/**
 * จัดการลิงก์หนึ่งลิงก์แทน WebView — คืน true ถ้าจัดการแล้ว (ผู้เรียกต้องยกเลิกพฤติกรรมเดิม)
 * @param {string} href
 * @param {{ download?: string, newTab?: boolean }} opts
 */
function handleLink(href, { download, newTab } = {}) {
  if (!href) return false;
  if (/^(blob|data):/i.test(href)) {
    fromBlobUrl(href, download).catch(warn);
    return true;
  }
  if (download && !isExternalHttp(href)) {
    fromBlobUrl(href, download).catch(warn);
    return true;
  }
  if (isExternalHttp(href) || (newTab && /^https?:/i.test(href))) {
    openExternal(href).catch(warn);
    return true;
  }
  return false;
}

/** ปุ่มย้อนกลับของ Android: ปิดกล่องโต้ตอบ/แผ่นล่างที่เปิดอยู่ก่อน › ย้อนหน้า › ออกจากแอป */
async function setupBackButton() {
  const { App } = await import("@capacitor/app");
  App.addListener("backButton", ({ canGoBack }) => {
    const modal = document.querySelector(".swal2-container, .MuiDialog-root, .MuiDrawer-modal, .MuiPopover-root, .MuiMenu-root");
    if (modal) {
      // MUI/Swal ปิดตัวเองเมื่อกด Escape — ใช้กลไกเดิมของแต่ละกล่อง (บันทึกค้าง/ยืนยันก่อนปิด ยังทำงานครบ)
      const target = modal.querySelector("[role=dialog], [role=presentation], .swal2-popup") || document.activeElement || document.body;
      target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true }));
      return;
    }
    if (canGoBack && window.history.length > 1) window.history.back();
    else App.exitApp();
  });
}

async function setupChrome() {
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    if (Capacitor.getPlatform() === "android") await StatusBar.setBackgroundColor({ color: "#182031" });
  } catch { /* เครื่องบางรุ่นไม่รองรับ */ }
}

/** ซ่อนหน้าเปิดแอปเมื่อหน้าแรกพร้อม (เรียกจาก NativeBridge หลัง mount) */
export async function hideSplash() {
  if (!isNative()) return;
  try { (await import("@capacitor/splash-screen")).SplashScreen.hide({ fadeOutDuration: 250 }); } catch { /* ignore */ }
}

/** ติดตั้งครั้งเดียวตอนเปิดแอป (index.js) — เว็บปกติไม่ทำอะไร */
export function installNativeBridge() {
  if (installed || !isNative()) return;
  installed = true;
  document.documentElement.classList.add("is-native-app", `is-native-${Capacitor.getPlatform()}`);

  // 1) window.open — PDF/ไฟล์ที่สร้างในแอป (blob:) และเว็บภายนอก
  const nativeOpen = window.open.bind(window);
  window.open = (url, target, features) => {
    if (handleLink(String(url || ""), { newTab: true })) return null;
    return nativeOpen(url, target, features);
  };

  // 2) <a> ที่โค้ดสร้างแล้วสั่ง click() เอง (file-saver · ปุ่มดาวน์โหลด PDF) — ไม่ได้อยู่ในหน้า จึงต้องดักที่ prototype
  const proto = HTMLAnchorElement.prototype;
  const origClick = proto.click;
  proto.click = function click() {
    if (handleLink(this.getAttribute("href") || this.href, { download: this.hasAttribute("download") ? (this.download || "") : undefined, newTab: this.target === "_blank" })) return;
    origClick.call(this);
  };
  const origDispatch = proto.dispatchEvent;
  proto.dispatchEvent = function dispatchEvent(ev) {
    if (ev?.type === "click" && !this.isConnected
      && handleLink(this.getAttribute("href") || this.href, { download: this.hasAttribute("download") ? (this.download || "") : undefined, newTab: this.target === "_blank" })) {
      return false;
    }
    return origDispatch.call(this, ev);
  };

  // 3) ลิงก์ที่ผู้ใช้แตะจริงในหน้า (target="_blank" / download / เว็บภายนอก)
  document.addEventListener("click", (e) => {
    const a = e.target?.closest?.("a[href]");
    if (!a || e.defaultPrevented) return;
    const href = a.getAttribute("href") || "";
    if (/^(tel|mailto|sms|line|geo):/i.test(href)) return;
    if (handleLink(a.href, { download: a.hasAttribute("download") ? (a.download || "") : undefined, newTab: a.target === "_blank" })) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  setupBackButton().catch(() => {});
  setupChrome();
}
