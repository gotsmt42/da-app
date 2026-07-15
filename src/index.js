import "./index.css";

import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import "./assets/scss/style.scss";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { BrowserRouter as Router } from "react-router-dom";
import Loader from "./layouts/loader/Loader";

import { AuthProvider } from "./auth/AuthContext";

import { StyleSheetManager } from "styled-components";

import "bootstrap/dist/css/bootstrap.min.css"; // import Bootstrap CSS

import "@fortawesome/react-fontawesome";

// ✅ "ResizeObserver loop completed with undelivered notifications." เป็นข้อความเตือนที่ไม่เป็นอันตราย
// เกิดขึ้นเองจากสเปกของเบราว์เซอร์เวลา ResizeObserver (ที่ MUI/FullCalendar ใช้ภายใน) ตอบสนอง resize
// ไม่ทันภายในหนึ่งเฟรม ไม่ได้บ่งบอกว่าแอปพัง — แต่ webpack-dev-server client overlay (โหลดเป็น entry
// แยกก่อนบันเดิลแอปเราเสมอ ทำให้ listener ของมัน register ก่อนของเราตลอด, stopImmediatePropagation
// จากฝั่งเราจึงช้าเกินไปเสมอ ใช้ไม่ได้จริง) จะจับไปโชว์เป็นหน้าจอ error สีแดงเต็มจอ — ปล่อยให้ overlay
// ขึ้นมาสั้นๆ ตามปกติ แล้วซ่อน DOM element ของมันทันทีแทน (วิธีที่ยืนยันได้ผลจริงกับ CRA 5)
window.addEventListener("error", (e) => {
  if (
    e.message === "ResizeObserver loop completed with undelivered notifications." ||
    e.message === "ResizeObserver loop limit exceeded"
  ) {
    e.stopImmediatePropagation();
    const overlay = document.getElementById("webpack-dev-server-client-overlay");
    const overlayDiv = document.getElementById("webpack-dev-server-client-overlay-div");
    if (overlay) overlay.style.display = "none";
    if (overlayDiv) overlayDiv.style.display = "none";
  }
});

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
