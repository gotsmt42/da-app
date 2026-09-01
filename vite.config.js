import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * vite.config.js — แทนที่ react-scripts (Create React App) ที่หยุดพัฒนาไปตั้งแต่ปี 2022
 *
 * ตั้งค่าให้ "เข้ากันได้กับของเดิมให้มากที่สุด" เพื่อไม่ต้องแก้ deployment/สคริปต์ภายนอก:
 *   • outDir ยังเป็น build/ เหมือน CRA (ไม่ใช่ dist/ ตามค่าเริ่มต้นของ Vite)
 *   • dev server ยังอยู่ port 3000 เหมือน CRA
 *   • envPrefix ยังเป็น REACT_APP_ เหมือน CRA — .env เดิมและตัวแปรที่ตั้งไว้บน Vercel ใช้ต่อได้เลย
 *     ⚠️ แต่ในโค้ดต้องอ่านผ่าน import.meta.env ไม่ใช่ process.env (Vite ไม่มี process ในเบราว์เซอร์)
 */
export default defineConfig({
  plugins: [react()],

  envPrefix: "REACT_APP_",

  // ✅ path alias "@" → src/ — ตอนจัดโครงสร้างเป็น feature-based ไฟล์ลึกขึ้น ทำให้เกิด import
  // แบบ "../../../shared/services/EventService" กว่า 157 จุด ซึ่งอ่านยากและพังทันทีที่ย้ายไฟล์
  // เขียนเป็น "@/shared/services/EventService" แทน = ตำแหน่งไฟล์ปลายทางชัดเจนโดยไม่ต้องนับ ../
  // ⚠️ vitest ใช้ resolve.alias ตัวเดียวกันนี้อยู่แล้ว (config อยู่ไฟล์เดียวกัน) ไม่ต้องตั้งซ้ำ
  // ⚠️ ถ้าเพิ่ม alias ตัวใหม่ ต้องไปเพิ่มใน jsconfig.json ด้วย ไม่งั้น editor จะกด "ไปที่นิยาม" ไม่ได้
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  // ⚠️ โปรเจกต์นี้เขียน JSX ไว้ในไฟล์นามสกุล .js (173 ไฟล์) ซึ่ง esbuild จะไม่ parse ให้โดยปริยาย
  // (มันถือว่า .js = JavaScript ธรรมดา) ต้องสั่ง loader เป็น jsx ให้ทั้งตอน transform และตอนที่
  // Vite สแกน dependency ตอนเริ่ม dev server ไม่งั้นจะพังตั้งแต่ไฟล์แรกที่มี < ในโค้ด
  esbuild: {
    loader: "jsx",
    include: /src\/.*\.jsx?$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: { loader: { ".js": "jsx" } },
  },

  server: {
    port: 3000,
    open: false,

    /**
     * ✅ proxy /api → backend (ใช้เฉพาะตอน dev เท่านั้น ไม่กระทบ build/production)
     *
     * มีไว้เพื่อ "เปิดทดสอบจากมือถือ" โดยเฉพาะ — เดิมหน้าเว็บยิง API ไปที่
     * http://localhost:5000 แบบเต็ม URL ซึ่งพอเปิดจากมือถือ คำว่า localhost จะหมายถึง
     * *ตัวมือถือเอง* ไม่ใช่เครื่องที่รันเซิร์ฟเวอร์ → เรียก API ไม่ถึงเลยสักเส้น
     *
     * ให้หน้าเว็บเรียกแบบ path เดียวกัน (/api/...) แล้ว Vite เป็นคนต่อไปหา backend ให้แทน
     * ผลพลอยได้ที่สำคัญ: เบราว์เซอร์มองว่าเป็น origin เดียวกัน จึง **ไม่ต้องแตะ CORS ฝั่ง server**
     * (ALLOWED_ORIGINS มีแค่ localhost:3000 ถ้าเปิดด้วย IP ในวง LAN จะโดน CORS บล็อกทันที)
     *
     * ⚠️ ใช้คู่กับโหมด mobile เท่านั้น (ดู .env.mobile ที่ตั้ง REACT_APP_API_URL=/api)
     * โหมดปกติยังยิงไปที่ localhost:5000 ตรงๆ เหมือนเดิมทุกประการ
     */
    proxy: {
      "/api": {
        // ⚠️ ต้องเป็น [::1] (IPv6) ไม่ใช่ 127.0.0.1 — เครื่องนี้มีบริการอื่น (NFNGateway ของ
        // Facilities Monitoring) จองพอร์ต 5000 บน IPv4 อยู่ ส่วน backend ผูกกับ IPv6 (::)
        // ถ้าชี้ IPv4 จะไปโดนบริการนั้นแล้วได้ ECONNRESET ทุก request โดยไม่มีอะไรบอกว่าทำไม
        target: "http://[::1]:5000",
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: "build",
    // CRA ก็ไม่ได้ปล่อย sourcemap ใน production เหมือนกัน
    sourcemap: false,

    // ⚠️ จุดที่ต่างจาก CRA จริงๆ: CRA อ่าน "browserslist" ใน package.json (>0.2%, not dead) แต่ Vite
    // ไม่สนใจฟิลด์นั้น ค่าเริ่มต้นของ Vite 6 คือ baseline-widely-available (ประมาณ Chrome 107+ /
    // Safari 16+) ซึ่ง "ใหม่กว่า" ของเดิม — มือถือช่างที่เครื่องเก่าหน่อยอาจเปิดไม่ขึ้น
    // ตั้ง es2020 ไว้ให้ครอบคลุมใกล้เคียงของเดิม (Chrome 80+ / Safari 13.1+ / Firefox 74+)
    target: "es2020",

    // ⚠️ อย่าเพิ่ม manualChunks แยก vendor ก้อนใหญ่ (@fullcalendar / exceljs / jspdf) — ลองแล้วได้ผล
    // ตรงข้าม: พอมันกลายเป็น shared chunk ที่หลายหน้าอ้างถึง Vite จะใส่ <link rel="modulepreload">
    // ของมันลงใน index.html ทำให้ผู้ใช้ต้องโหลด FullCalendar 1.2 MB ตั้งแต่หน้า login ทั้งที่ยังไม่
    // เปิดปฏิทินเลย ปล่อยให้ Rollup แบ่งตาม dynamic import ของแต่ละหน้าเองดีกว่า (โหลดเมื่อเปิดหน้านั้น)
    //
    // ที่ตั้ง limit ไว้ 1400 kB เพราะ chunk ที่เกิน 500 kB ที่เหลืออยู่เป็นตัวไลบรารีเองล้วนๆ —
    // EventCalendar (FullCalendar), DocumentPreviewDialog (jsPDF+html2canvas), ตัวส่งออก Excel
    // (ExcelJS) — ทั้งหมดถูก lazy load อยู่แล้ว ไม่ได้อยู่ในหน้าแรก และเล็กกว่านี้ไม่ได้ถ้าไม่ตัดฟีเจอร์
    chunkSizeWarningLimit: 1400,
  },

  // vitest — มาแทน jest ที่เคยติดมากับ react-scripts
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/setupTests.js",
  },
});
