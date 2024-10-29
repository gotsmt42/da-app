// FullLayout.js

import React, { useRef, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { Container } from "reactstrap";
import { SpeedInsights } from "@vercel/speed-insights/react";
import Footer from "./Footer";
import { FaArrowLeft } from "react-icons/fa";
import { IconButton } from "@mui/material";

import './FullLayout.css';

const FullLayout = () => {
  const sidebarRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isScrollingUp, setIsScrollingUp] = useState(false);
  const [lastScrollTop, setLastScrollTop] = useState(0);
  const [touchStartY, setTouchStartY] = useState(null);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (isMobile && sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        closeSidebar();
      }
    };

    const checkIsMobile = () => {
      const screenWidth = window.innerWidth;
      setIsMobile(screenWidth <= 768);
    };
    checkIsMobile();

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick); // เพิ่ม event สำหรับการสัมผัส
    window.addEventListener("resize", checkIsMobile);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      window.removeEventListener("resize", checkIsMobile);
    };
  }, [isMobile]);

  const closeSidebar = () => {
    if (isMobile) {
      document.getElementById("sidebarArea").classList.remove("showSidebar");
    }
  };

  const handleMenuClick = () => {
    closeSidebar();
  };

  const handleScroll = () => {
    const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;

    setIsScrollingUp(currentScrollTop < lastScrollTop && currentScrollTop > 0);
    setLastScrollTop(currentScrollTop <= 0 ? 0 : currentScrollTop);

    if (currentScrollTop > 0 && isMobile) {
      closeSidebar();
    }
  };

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [lastScrollTop, isMobile]);

  const headerClass = isScrollingUp ? "stickyHeader" : "";
  const isDashboard = location.pathname === "/dashboard";

  const handleTouchStart = (e) => {
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e) => {
    const touchEndY = e.changedTouches[0].clientY;

    // ตรวจสอบการเลื่อน
    const distance = touchStartY - touchEndY;
    if (distance > 50) { // ถ้าลงมากกว่าหรือเท่ากับ 50px ปิด Sidebar
      closeSidebar();
    }
  };

  return (
    <main onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className={`header ${headerClass}`}>
        <Header />
      </div>

      <div className="pageWrapper d-lg-flex">
        <aside
          className={`sidebarArea shadow ${isMobile ? "" : "showSidebar"}`}
          id="sidebarArea"
          ref={sidebarRef}
        >
          <Sidebar handleMenuClick={handleMenuClick} />
        </aside>

        <div className="contentArea" onClick={isMobile ? closeSidebar : null}>
          {!isDashboard && (
            <div className="back-button">
              <IconButton
                onClick={() => navigate("/dashboard")}
                style={{ margin: "15px", fontSize: "40px" }}
              >
                <FaArrowLeft />
              </IconButton>
            </div>
          )}

          <Container className="p-3" fluid>
            <Outlet />
            <SpeedInsights />
          </Container>

          <Footer className="footer" />
        </div>
      </div>
    </main>
  );
};

export default FullLayout;
