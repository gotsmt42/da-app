import React, { useRef, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { Container } from "reactstrap";
import { SpeedInsights } from "@vercel/speed-insights/react";
import Footer from "./Footer";
import { FaArrowLeft, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { IconButton } from "@mui/material";
import Swal from "sweetalert2";
import PushService from "../services/PushService";

import "./FullLayout.css";

const FullLayout = () => {
  const sidebarRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // ควบคุมเปิดปิดบนมือถือ
  // ✅ ย่อ/ขยายแถบข้าง — เฉพาะจอคอม (มือถือใช้กลไก isSidebarOpen แบบเลื่อนเข้า/ออกแยกกันคนละเรื่อง)
  // จำค่าไว้ที่ localStorage ให้คงอยู่ข้ามการออกจากหน้า/รีเฟรช เทียบ pattern เดียวกับที่ใช้จำความกว้าง
  // คอลัมน์ในหน้า ContractOverview.js
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => localStorage.getItem("sidebar.collapsed") === "1"
  );
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

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar.collapsed", next ? "1" : "0");
      return next;
    });
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

  // ✅ ชวนเปิดการแจ้งเตือนแบบ Push ทุกครั้งที่เข้าแอพ ถ้ายังไม่เคยเปิดไว้ — เดิมมีแค่ปุ่ม
  // เปิด/ปิดเงียบๆ ที่ Header ซึ่งผู้ใช้ส่วนใหญ่ไม่รู้ตัวว่ามันมีอยู่เลยไม่เคยกดเปิด ทำให้พลาด
  // แจ้งเตือนงานสำคัญ — FullLayout mount แค่ครั้งเดียวต่อการเข้าแอพหนึ่งรอบ (ไม่ใช่ทุกครั้งที่
  // เปลี่ยนหน้าใน SPA) จึงชวนซ้ำทุกครั้งที่เปิดแอพใหม่จนกว่าจะกดเปิดจริง โดยไม่เด้งซ้ำถ้า
  // เบราว์เซอร์บล็อกไว้แล้ว (permission "denied") เพราะเด้งไปก็ไม่มีประโยชน์อะไร
  useEffect(() => {
    const promptEnablePush = async () => {
      if (!PushService.isSupported()) return;
      const permission = await PushService.getPermissionState();
      if (permission === "denied") return;

      const alreadySubscribed = await PushService.isSubscribed();
      if (alreadySubscribed) return;

      const result = await Swal.fire({
        title: "เปิดการแจ้งเตือนไหม? 🔔",
        text: "รับแจ้งเตือนงานใหม่ อนุมัติ/ไม่อนุมัติปิดงาน และข้อความถึงคุณทันที ไม่ต้องเปิดแอพค้างไว้",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "เปิดการแจ้งเตือน",
        cancelButtonText: "ไว้ทีหลัง",
        confirmButtonColor: "#dc2626",
      });

      if (result.isConfirmed) {
        try {
          await PushService.subscribe();
          Swal.fire({ title: "เปิดการแจ้งเตือนแล้ว 🔔", icon: "success", timer: 1200, showConfirmButton: false });
        } catch (error) {
          Swal.fire("เปิดไม่สำเร็จ", error.message || "กรุณาลองใหม่อีกครั้ง", "error");
        }
      }
    };

    promptEnablePush();
  }, []);

  const headerClass = isScrollingUp ? "stickyHeader" : "";
  const isDashboard = location.pathname === "/dashboard";
  
  // ตรวจจับ URL หน้าปฏิทินเพื่อปลดล็อกโหมดเต็มหน้าจอ
  const isCalendarPage = location.pathname === "/event" || location.pathname === "/calendar" || location.pathname === "/";

  // ✅ หน้า "ภาพรวมสัญญา" เป็นตารางกว้างหลายคอลัมน์ (ปรับความกว้างคอลัมน์เองได้) — ถูก .contentArea
  // (max-width: 1300px, กึ่งกลางจอ ดูใน _container.scss) บีบพื้นที่ทิ้งไปเยอะบนจอกว้าง ทั้งที่ตาราง
  // ต้องการพื้นที่แนวนอนมากที่สุดเท่าที่จะทำได้ ใช้ปลดล็อกแบบเดียวกับหน้าปฏิทิน แต่คงระยะขอบ (p-4)
  // ปกติไว้ (ไม่ใช้ p-0 m-0 เหมือนปฏิทิน เพราะหน้านี้ยังอยากมีระยะขอบให้ดูไม่ติดขอบจอเกินไป)
  const isWideTablePage = location.pathname === "/contracts";

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
          className={`sidebarArea shadow ${isMobile ? (isSidebarOpen ? "showSidebar" : "hideSidebar") : "desktopSidebar"} ${!isMobile && isSidebarCollapsed ? "collapsed" : ""}`}
          ref={sidebarRef}
        >
          <Sidebar handleMenuClick={handleMenuClick} isCollapsed={!isMobile && isSidebarCollapsed} />

          {/* ✅ ปุ่มย่อ/ขยายแถบ — เฉพาะจอคอม (d-lg-flex) ปุ่มแฮมเบอร์เกอร์ที่ Header เป็นคนละเรื่อง
              (ใช้เฉพาะมือถือ เปิด/ปิดแบบเลื่อนเข้าออก ไม่ใช่ย่อ/ขยายแบบนี้) */}
          <button
            type="button"
            className="sidebar-collapse-toggle d-none d-lg-flex"
            onClick={toggleSidebarCollapse}
            title={isSidebarCollapsed ? "ขยายแถบเมนู" : "ย่อแถบเมนู"}
          >
            {isSidebarCollapsed ? <FaChevronRight size={12} /> : <FaChevronLeft size={12} />}
          </button>
        </aside>

        {/* พื้นที่แสดง Content ฝั่งขวา — เดิม .contentArea ล็อก max-width:1300px กึ่งกลางจอไว้เสมอ
            (ดู _container.scss) ทุกหน้า ไม่ใช่แค่ปฏิทิน/ภาพรวมสัญญา ทำให้พอย่อแถบข้างแล้วพื้นที่ที่ได้
            คืนมากลายเป็นขอบว่างๆ สองข้างเฉยๆ แทนที่จะให้เนื้อหาขยายใช้จริง — เติม class นี้ให้ทุกหน้า
            ปลดล็อก max-width ตอนย่อแถบเหมือนกันหมด ไม่ต้องรอเป็นหน้าพิเศษเฉพาะที่ทำไว้ก่อนหน้านี้ */}
        <div
          className={`contentArea ${isCalendarPage ? "calendar-mode" : ""} ${isWideTablePage ? "wide-table-mode" : ""} ${!isMobile && isSidebarCollapsed ? "sidebarCollapsed" : ""} ${isMobile && isSidebarOpen ? "blur-content" : ""}`}
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

          <Footer />
        </div>
      </div>
    </main>
  );
};

export default FullLayout;