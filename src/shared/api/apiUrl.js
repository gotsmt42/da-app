import { Capacitor } from "@capacitor/core";

/**
 * ที่อยู่ API ของทั้งแอป — จุดเดียว (axios · realtime · หน้าเชื่อมต่อไม่ได้)
 *
 * ✅ (18 ต.ค. 2569) แอปมือถือ (Capacitor): หน้าเว็บในแอปอยู่ที่ https://localhost / capacitor://localhost
 *    ที่อยู่แบบสัมพัทธ์ ("/api") หรือ localhost ของเครื่องพัฒนาจึงใช้ไม่ได้ → ใช้ API จริงบน Render เสมอ
 *    เว้นแต่ตั้ง REACT_APP_NATIVE_API_URL ไว้ตอน build (เช่นทดสอบกับเซิร์ฟเวอร์อื่น)
 * ⚠️ เว็บปกติ: ใช้ REACT_APP_API_URL เหมือนเดิมทุกประการ
 */
export const PRODUCTION_API_URL = "https://da-app-server.onrender.com/api";

const fromEnv = import.meta.env.REACT_APP_API_URL || "";
const nativeOverride = import.meta.env.REACT_APP_NATIVE_API_URL || "";

export const API_URL = Capacitor.isNativePlatform()
  ? (nativeOverride || (/^https:\/\//.test(fromEnv) ? fromEnv : PRODUCTION_API_URL))
  : fromEnv;
