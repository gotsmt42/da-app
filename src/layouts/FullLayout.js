import React, { useRef, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { Container } from "reactstrap";
import { SpeedInsights } from "@vercel/speed-insights/react";
import Footer from "./Footer";
import './FullLayout.css'; // Import CSS file

const FullLayout = () => {
  const sidebarRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isScrollingUp, setIsScrollingUp] = useState(false);
  const [lastScrollTop, setLastScrollTop] = useState(0);
  const [isHeaderFixed, setIsHeaderFixed] = useState(false);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        closeSidebar();
      }
    };

    const checkIsMobile = () => {
      const screenWidth = window.innerWidth;
      setIsMobile(screenWidth <= 768);
    };
    checkIsMobile();

    document.addEventListener("mousedown", handleOutsideClick);

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
    closeSidebar();
  };

  const handleScroll = () => {
    const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;

    setIsScrollingUp(currentScrollTop < lastScrollTop && currentScrollTop > 0);
    setLastScrollTop(currentScrollTop <= 0 ? 0 : currentScrollTop);

    setIsHeaderFixed(currentScrollTop > 0);
  };

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [lastScrollTop]);

  const headerClass = isScrollingUp ? "stickyHeader" : "";

  return (
    <main className="d-flex flex-column min-vh-100">
      <div className={`header ${headerClass}`}>
        <Header />
      </div>
      
      <div className="pageWrapper d-lg-flex flex-grow-1">
        <aside className={`sidebarArea shadow ${isMobile ? "" : "showSidebar"}`} id="sidebarArea" ref={sidebarRef}>
          <Sidebar handleMenuClick={handleMenuClick} />
        </aside>

        <div className="contentArea flex-grow-1" onClick={isMobile ? closeSidebar : null}>
          <Container className="p-4" fluid>
            <Outlet />
            <SpeedInsights />
          </Container>
        </div>
      </div>

      <Footer className="footer" />
    </main>
  );
};

export default FullLayout;
