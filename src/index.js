import "./index.css";
// ⚠️ ต้องมาก่อนทุกอย่าง — ลงทะเบียน locale ไทยให้ moment ตั้งแต่แอปเริ่ม
// ถ้าลงทะเบียนช้ากว่าหน้าแรกที่ render จะมีจุดที่แสดงเดือนเป็นอังกฤษค้างอยู่
import "@/shared/utils/momentThaiLocale";

import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import "./assets/scss/style.scss";
import App from "./app/App";
import reportWebVitals from "./app/reportWebVitals";
import { BrowserRouter as Router } from "react-router-dom";
import Loader from "./layouts/Loader";

import { AuthProvider } from "./features/auth/AuthContext";

import { StyleSheetManager } from "styled-components";

// ✅ ต้องติดตั้งครั้งเดียวตอนแอปเริ่ม — แก้ dropdown ของ TomSelect (ทุกช่อง "เลือกหรือพิมพ์..." ในฟอร์ม
// เพิ่ม/แก้ไขงาน) ที่ลอยค้างอยู่กับที่เวลาเลื่อนเนื้อหาในฟอร์ม เพราะมันถูกแปะไว้ที่ <body> ดูรายละเอียด
// ทั้งหมดที่ src/shared/utils/tomSelectFixes.js — เรียกที่นี่เพราะ TomSelect ถูกสร้างจากหลายไฟล์/หลายจังหวะ
import { installTomSelectFixes } from "./shared/utils/tomSelectFixes";

import "bootstrap/dist/css/bootstrap.min.css"; // import Bootstrap CSS
// ✅ ต้อง import เป็น .css ตรงนี้ ไม่ใช่ @import .scss ที่ assets/scss/style.scss (ดูเหตุผลในไฟล์นั้น)
// — เป็นทางเดียวที่ Vite จะ resolve ไฟล์ฟอนต์ .woff/.woff2 ของ bootstrap-icons แล้วใส่ลงบันเดิลให้
import "bootstrap-icons/font/bootstrap-icons.css";

import "@fortawesome/react-fontawesome";

// ✅ "ResizeObserver loop completed with undelivered notifications." เป็นข้อความเตือนที่ไม่เป็นอันตราย
// เกิดขึ้นเองจากสเปกของเบราว์เซอร์เวลา ResizeObserver (ที่ MUI/FullCalendar ใช้ภายใน) ตอบสนอง resize
// ไม่ทันภายในหนึ่งเฟรม ไม่ได้บ่งบอกว่าแอปพัง — กันไม่ให้มันไปโผล่เป็น error ที่ไหน
// ⚠️ เดิมโค้ดตรงนี้ต้องไปไล่ซ่อน DOM ของ webpack-dev-server overlay ด้วย เพราะ CRA โหลด overlay
// เป็น entry แยกก่อนบันเดิลแอปเราเสมอ listener ของมันจึง register ก่อนตลอด stopImmediatePropagation
// จากฝั่งเราไม่ทัน — ย้ายมา Vite แล้วปัญหานั้นหายไปเอง เพราะ Vite ไม่มี overlay ที่ดัก runtime error
// (overlay ของ Vite ขึ้นเฉพาะตอน build/HMR พัง) จึงเหลือแค่หยุด propagation พอ
window.addEventListener("error", (e) => {
  if (
    e.message === "ResizeObserver loop completed with undelivered notifications." ||
    e.message === "ResizeObserver loop limit exceeded"
  ) {
    e.stopImmediatePropagation();
  }
});

installTomSelectFixes();

const root = ReactDOM.createRoot(document.getElementById("root"));


root.render(
  <React.StrictMode>
    <Suspense fallback={<Loader />}>
      <Router future={{ v7_relativeSplatPath: true }}>
        <AuthProvider >
          <StyleSheetManager shouldForwardProp={(prop) => prop !== "align"}>
            <App />
          </StyleSheetManager>
        </AuthProvider>
      </Router>
    </Suspense>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
