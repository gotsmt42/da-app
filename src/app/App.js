import React, { useEffect } from "react";
import { useRoutes, useLocation } from "react-router-dom";
import ThemeRoutes from "./router";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
// ✅ ครอบทั้งแอปด้วยธีม MUI เพื่อบังคับให้คอมโพเนนต์ MUI ทุกตัวใช้ฟอนต์เดียวกับที่ตั้งไว้ใน index.css
// (เดิมไม่มี ThemeProvider เลย คอมโพเนนต์ MUI จึงใช้ Roboto ของตัวเองอยู่ ดูเหตุผลเต็มที่ src/theme.js)
import { ThemeProvider } from "@mui/material/styles";
import theme from "./theme";

/**
 * ⚠️ 3 ฟังก์ชันนี้ต้องอยู่ "นอกคอมโพเนนต์" — เดิมประกาศไว้ข้างในด้วย const ซึ่ง:
 *   1. ถูกสร้างใหม่ทุก render (เปลือง และทำให้ useEffect ด้านล่างมี dependency ที่ไม่คงที่)
 *   2. ทำให้ eslint เตือน react-hooks/exhaustive-deps ว่า useEffect ขาด dep 'findCurrentRoute'
 *      ซึ่งถ้าใส่ dep ตามที่เตือนตรงๆ effect จะทำงานทุก render ทันที (ค่าเปลี่ยนทุกครั้ง)
 * ทั้ง 3 ตัวเป็นฟังก์ชันบริสุทธิ์ ไม่ได้อ่าน props/state อะไรเลย ย้ายออกมาข้างนอกจึงถูกต้องที่สุด —
 * ได้ reference คงที่ตลอดอายุแอป eslint เลิกเตือนเองโดยไม่ต้อง disable กฎ
 */
const normalizePath = (path) => path.replace(/\/+$/, "").split("?")[0];

const matchPath = (routePath, currentPath) => {
  const routeSegments = normalizePath(routePath).split("/");
  const currentSegments = normalizePath(currentPath).split("/");

  if (routeSegments.length !== currentSegments.length) return false;

  return routeSegments.every((seg, i) => seg.startsWith(":") || seg === currentSegments[i]);
};

const findCurrentRoute = (routes, pathname) => {
  for (const route of routes) {
    if (matchPath(route.path, pathname)) return route;
    if (route.children) {
      const childMatch = findCurrentRoute(route.children, pathname);
      if (childMatch) return childMatch;
    }
  }
  return null;
};

const App = () => {
  const routing = useRoutes(ThemeRoutes);
  const location = useLocation();

  // ✅ ตั้งชื่อ tab ของเบราว์เซอร์ตามหน้าที่เปิดอยู่
  // ⚠️ เดิมเก็บชื่อไว้ใน state (pageTitle) ด้วย แต่ไม่มีที่ไหนอ่านค่านั้นเลย (จุดที่เคยใช้ถูกคอมเมนต์ทิ้ง
  // ไปแล้ว) — เป็น state ที่ทำให้ re-render ทั้งแอปทุกครั้งที่เปลี่ยนหน้าโดยไม่ได้ให้ผลอะไร ตัดออก
  // เหลือแค่เขียน document.title ตรงๆ ซึ่งเป็นสิ่งเดียวที่มีผลจริง
  useEffect(() => {
    const currentRoute = findCurrentRoute(ThemeRoutes, location.pathname);
    const title = currentRoute ? currentRoute.title || "Dashboard" : "Dashboard";
    document.title = `${title} - DA-APP`;
  }, [location.pathname]);

  return (
    <ThemeProvider theme={theme}>
      <div className="dark">
        <ToastContainer
          position="top-center"
          autoClose={false}
          closeOnClick={false}
          draggable={false}
          theme="colored"
          newestOnTop
        />
        {routing}
      </div>
    </ThemeProvider>
  );
};

export default App;
