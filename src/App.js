import React, { useEffect, useState } from "react";
import { useRoutes, useLocation } from "react-router-dom";
import ThemeRoutes from "./routes/Router";

import CheckConnectionToast from "./routes/CheckConnectionToast";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const App = () => {
  const [pageTitle, setPageTitle] = useState([]);
  const routing = useRoutes(ThemeRoutes);
  const location = useLocation();


  useEffect(() => {
    const currentRoute = findCurrentRoute(ThemeRoutes, location.pathname);
    const title = currentRoute
      ? currentRoute.title || "Dashboard"
      : "Dashboard";

    setPageTitle(title);
    document.title = `${title} - DA-APP`; // ✅ ตั้งชื่อ tab จริง
  }, [location.pathname]);

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

  return (
    <div className="dark">
      {/* <title>{`${pageTitle} - DA-APP`}</title> */}


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
  );
};

export default App;
