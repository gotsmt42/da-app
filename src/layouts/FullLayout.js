// FullLayout.js

import React, { useRef, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { Container } from "reactstrap";
import { SpeedInsights } from "@vercel/speed-insights/react";
import Footer from "./Footer";
import { FaArrowCircleLeft, FaArrowLeft } from "react-icons/fa";
import { IconButton } from "@mui/material";

import './FullLayout.css'

const FullLayout = () => {
  const sidebarRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false); // State เพื่อติดตามสถานะโหมด mobile
  const [isScrollingUp, setIsScrollingUp] = useState(false);
  const [lastScrollTop, setLastScrollTop] = useState(0);
  const [isHeaderFixed, setIsHeaderFixed] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleOutsideClick = (e) => {
      // ตรวจสอบว่าคลิกอยู่นอกเหนือจาก contentArea
      if (sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        closeSidebar();
      }
    };

    const checkIsMobile = () => {
      const screenWidth = window.innerWidth;
      setIsMobile(screenWidth <= 768); // ตั้งค่าให้เป็น mobile เมื่อหน้าจอน้อยกว่าหรือเท่ากับ 768px
    };
    checkIsMobile(); // เรียกฟังก์ชันเมื่อโหลดหน้าเว็บ

    // เพิ่ม event listener เมื่อ component ถูก mount
    document.addEventListener("mousedown", handleOutsideClick);

    // ถอด event listener เมื่อ component ถูก unmount
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const closeSidebar = () => {
    if (isMobile) {
      document.getElementById("sidebarArea").classList.remove("showSidebar");
    }
  };

  const handleMenuClick = () => {
    closeSidebar(); // เมื่อคลิกที่เมนูให้ปิด Slidebar
  };

  const handleScroll = () => {
    const currentScrollTop =
      window.pageYOffset || document.documentElement.scrollTop;

    setIsScrollingUp(currentScrollTop < lastScrollTop && currentScrollTop > 0);
    setLastScrollTop(currentScrollTop <= 0 ? 0 : currentScrollTop);

    // ตรวจสอบว่าต้องกำหนด Header เป็น fixed หรือไม่
    setIsHeaderFixed(currentScrollTop > 0);
  };

  useEffect(() => {
    window.addEventListener("scroll", handleScroll); // เพิ่ม event listener สำหรับ scroll

    return () => {
      window.removeEventListener("scroll", handleScroll); // ถอด event listener เมื่อ component ถูก unmount
    };
  }, [lastScrollTop]); // ให้ useEffect ทำงานเมื่อ lastScrollTop เปลี่ยนแปลง

  // ใช้ตรวจสอบค่า isScrollingUp และใส่คลาส CSS ตามที่ต้องการใน Header
// ใช้ตรวจสอบความกว้างของหน้าจอเพื่อตัดสินใจใช้งาน stickyHeader หรือไม่
const Mobile = window.innerWidth <= 768; // ตรวจสอบว่าเป็นโหมดมือถือหรือไม่
const isLargeScreen = window.innerWidth > 1024; // ตรวจสอบว่าเป็นหน้าจอใหญ่หรือไม่
const shouldUseStickyHeader = Mobile && !isLargeScreen;

// ใช้ตรวจสอบค่า isScrollingUp และใส่คลาส CSS ตามที่ต้องการใน Header
const headerClass = isScrollingUp && shouldUseStickyHeader ? "stickyHeader" : "";

  const isDashboard = location.pathname === "/dashboard";
  
  
  return (
    <main>
      {/* Header */}
      <div className={`header ${headerClass}`}>
        <Header />
      </div>

      <div className="pageWrapper d-lg-flex">
        {/* Sidebar */}
        <aside
          className={`sidebarArea shadow ${isMobile ? "" : "showSidebar"}`}
          id="sidebarArea"
          ref={sidebarRef}
        >
          <Sidebar handleMenuClick={handleMenuClick} />
        </aside>

        {/* Content Area */}
        <div className="contentArea" onClick={isMobile ? closeSidebar : null}>
          {/* Back Button */}
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

          {/* Middle Content */}
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
