import React, { useEffect, useState } from "react";
import { useRoutes, useLocation } from "react-router-dom";
import ThemeRoutes from "./routes/Router";

const App = () => {
  const [pageTitle, setPageTitle] = useState([]);
  const routing = useRoutes(ThemeRoutes);
  const location = useLocation();

  useEffect(() => {
    const currentRoute = findCurrentRoute(ThemeRoutes, location.pathname);

    const title = currentRoute ? currentRoute.title || "Dashboard" : "Dashboard";

    setPageTitle(title);
  }, [location.pathname]);

  // ตรวจสอบค่า currentRoute จาก location.pathname
  const findCurrentRoute = (routes, pathname) => {
    // ค้นหา Route ที่มี path เท่ากับ location.pathname ใน ThemeRoutes หรือ children ถ้ามี
    const route = routes.find((route) => route.path === pathname);
    if (route) {
      return route;
    } else {
      // ถ้าไม่เจอในระดับนี้ ให้ค้นหาใน children ของ Route ที่มี children
      for (const parentRoute of routes) {
        if (parentRoute.children && Array.isArray(parentRoute.children)) {
          const childRoute = parentRoute.children.find(
            (child) => child.path === pathname
          );
          if (childRoute) {
            return childRoute;
          }
        }
      }
    }
    return null; // ถ้าไม่เจอเลย
  };
  return (
    <div className="dark">
      <title >{`${pageTitle} - DA-APP`}</title>

      {routing}


    </div>
  );
};

export default App;
  