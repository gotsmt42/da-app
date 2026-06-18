import React, { useRef, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { Container } from "reactstrap";
import { SpeedInsights } from "@vercel/speed-insights/react";
import Footer from "./Footer";
import { FaArrowLeft } from "react-icons/fa"; 
import { IconButton } from "@mui/material";

import "./FullLayout.css";

const FullLayout = () => {
  const sidebarRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // ควบคุมเปิดปิดบนมือถือ
  const [isScrollingUp, setIsScrollingUp] = useState(false);
  const [lastScrollTop, setLastScrollTop] = useState(0);
  const [touchStartY, setTouchStartY] = useState(null);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleOutsideClick = (e) => {
      // ถ้ากดนอก Sidebar บนมือถือ ให้สั่งหุบซ่อน
      if (
        isMobile &&
        isSidebarOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target) &&
        !e.target.closest(".toggle-sidebar-btn") // ยกเว้นการคลิกที่ปุ่มเปิดปิดเอง
      ) {
        setIsSidebarOpen(false);
      }
    };

    const checkIsMobile = () => {
      const screenWidth = window.innerWidth;
      const mobileCheck = screenWidth <= 992; // ปรับให้ตรงกับ Breakpoint 992px ของ CSS
      setIsMobile(mobileCheck);
      if (!mobileCheck) {
        setIsSidebarOpen(false); // ถ้าสลับกลับมาจอคอม ให้ปิดสเตทมือถือ
      }
    };
    checkIsMobile();

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    window.addEventListener("resize", checkIsMobile);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      window.removeEventListener("resize", checkIsMobile);
    };
  }, [isMobile, isSidebarOpen]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleMenuClick = () => {
    if (isMobile) setIsSidebarOpen(false); // คลิกเมนูแล้วให้หุบซ่อนบนมือถือ
  };

  const handleScroll = () => {
    const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
    setIsScrollingUp(currentScrollTop < lastScrollTop && currentScrollTop > 0);
    setLastScrollTop(currentScrollTop <= 0 ? 0 : currentScrollTop);

    if (currentScrollTop > 0 && isMobile) {
      setIsSidebarOpen(false); // เลือนหน้าจอแล้วให้หุบซ่อน
    }
  };

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollTop, isMobile]);

  const headerClass = isScrollingUp ? "stickyHeader" : "";
  const isDashboard = location.pathname === "/dashboard";
  
  // ตรวจจับ URL หน้าปฏิทินเพื่อปลดล็อกโหมดเต็มหน้าจอ
  const isCalendarPage = location.pathname === "/event" || location.pathname === "/calendar" || location.pathname === "/"; 

  const handleTouchStart = (e) => {
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e) => {
    const touchEndY = e.changedTouches[0].clientY;
    const distance = touchStartY - touchEndY;
    if (distance > 50 && isMobile) {
      setIsSidebarOpen(false);
    }
  };

  return (
    <main onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* ส่งฟังก์ชันเปิดปิดสไลด์บาร์ผ่าน props ชื่อ toggleMobileSidebar */}
      <div className={`header ${headerClass}`}>
        <Header toggleMobileSidebar={toggleSidebar} />
      </div>

      <div className="pageWrapper">
        {/* แถบ Sidebar หลัก */}
        <aside
          className={`sidebarArea shadow ${isMobile ? (isSidebarOpen ? "showSidebar" : "hideSidebar") : "desktopSidebar"}`}
          ref={sidebarRef}
        >
          <Sidebar handleMenuClick={handleMenuClick} />
        </aside>

        {/* พื้นที่แสดง Content ฝั่งขวา */}
        <div 
          className={`contentArea ${isCalendarPage ? "calendar-mode" : ""} ${isMobile && isSidebarOpen ? "blur-content" : ""}`}
          onClick={isMobile && isSidebarOpen ? () => setIsSidebarOpen(false) : null}
        >
          {!isDashboard && (
            <div className="back-button">
              <IconButton
                onClick={() => navigate("/dashboard")}
                style={{ margin: "15px", fontSize: "30px" }}
              >
                <FaArrowLeft />
              </IconButton>
            </div>
          )}

          {/* ปรับแก้: ถ้าเป็นหน้าปฏิทิน/หน้าแรก จะใช้ p-0 m-0 เพื่อดึงพื้นที่เต็มความกว้างขอบจอ */}
          <Container className={isCalendarPage ? "p-0 m-0" : "p-4"} fluid={true}>
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