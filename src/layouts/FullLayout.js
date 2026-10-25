import React, { useRef, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { Container } from "reactstrap";
import { SpeedInsights } from "@vercel/speed-insights/react";
import Footer from "./Footer";
import MobileBottomNav from "./MobileBottomNav";
import { FaArrowLeft, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { IconButton } from "@mui/material";
import Swal from "@/shared/ui/swal";
import PushService from "../shared/services/PushService";

import "./FullLayout.css";
import AppRebrandNotice from "@/shared/components/AppRebrandNotice";
import InAppPushBanner from "@/shared/ui/InAppPushBanner";
import AppErrorBoundary from "@/shared/ui/AppErrorBoundary";
import useNewBuildReload from "@/shared/hooks/useNewBuildReload";

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
  // ✅ (25 ต.ค. 2569 ผู้ใช้: "เลื่อนปัดหน้าเร็วๆ หน่วง กระตุก ไม่สมูท") ตำแหน่งเลื่อนล่าสุดเก็บใน ref
  //    เดิมเป็น state — เลื่อนทุกเฟรม = วาดใหม่ทั้งแอป (หัวเว็บ + เมนู + หน้าที่เปิดอยู่) หลายสิบครั้งต่อวินาที
  const lastScrollTopRef = useRef(0);

  const location = useLocation();
  useNewBuildReload(); // มีรุ่นใหม่ → รีโหลดตอนเปลี่ยนหน้า กันหน้า "มีเวอร์ชันใหม่" บนมือถือที่เปิดแอปค้างไว้
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

  // อ่านตำแหน่งครั้งเดียวต่อเฟรม (requestAnimationFrame) · เปลี่ยน state เฉพาะตอน "ขึ้น/ลง" สลับกันจริง
  // 🐛 เดิมมี setIsSidebarOpen(false) ตรงนี้ — เลื่อนหน้าทีเดียวลิ้นชักปิดทันที
  //    ผู้ใช้จึงเลื่อนลงไปกดเมนูท้ายลิ้นชัก (เช่น "ตั้งค่า") ไม่ได้เลย
  // ✅ ลิ้นชักปิดได้ทางเดียวคือแตะนอกกรอบหรือกดเมนู — ระหว่างเปิดอยู่จะล็อกไม่ให้หน้าหลังเลื่อน
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const top = window.pageYOffset || document.documentElement.scrollTop;
        const up = top < lastScrollTopRef.current && top > 0;
        lastScrollTopRef.current = top <= 0 ? 0 : top;
        setIsScrollingUp((prev) => (prev === up ? prev : up));
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (frame) cancelAnimationFrame(frame); };
  }, []);

  /**
   * ล็อกไม่ให้หน้าเบื้องหลังเลื่อนตอนลิ้นชักเปิดอยู่
   * ⚠️ จำเป็นคู่กับการเลิกปิดตอนเลื่อน — ไม่งั้นนิ้วที่ลากในลิ้นชักจะไปพาหน้าหลังเลื่อนตามด้วย
   * ⚠️ ต้องคืนค่าเดิมตอนปิด/ตอน unmount เสมอ ไม่งั้นหน้าอื่นเลื่อนไม่ได้ทั้งแอป
   */
  useEffect(() => {
    if (!(isMobile && isSidebarOpen)) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isMobile, isSidebarOpen]);

  // ✅ ชวนเปิดการแจ้งเตือนแบบ Push ทุกครั้งที่เข้าแอพ ถ้ายังไม่เคยเปิดไว้ — เดิมมีแค่ปุ่ม
  // เปิด/ปิดเงียบๆ ที่ Header ซึ่งผู้ใช้ส่วนใหญ่ไม่รู้ตัวว่ามันมีอยู่เลยไม่เคยกดเปิด ทำให้พลาด
  // แจ้งเตือนงานสำคัญ — FullLayout mount แค่ครั้งเดียวต่อการเข้าแอพหนึ่งรอบ (ไม่ใช่ทุกครั้งที่
  // เปลี่ยนหน้าใน SPA) จึงชวนซ้ำทุกครั้งที่เปิดแอพใหม่จนกว่าจะกดเปิดจริง โดยไม่เด้งซ้ำถ้า
  // เบราว์เซอร์บล็อกไว้แล้ว (permission "denied") เพราะเด้งไปก็ไม่มีประโยชน์อะไร
  useEffect(() => {
    const promptEnablePush = async () => {
      // ✅ iPhone/iPad เปิดจาก Safari ตรงๆ = รับแจ้งเตือนไม่ได้เลย (Apple ให้เฉพาะแอปที่ "เพิ่มไปยังหน้าจอโฮม", iOS 16.4+)
      //    เดิมเงียบไปเฉยๆ (isSupported = false) ผู้ใช้ iPhone จึงไม่เคยได้รับแจ้งเตือนและไม่รู้ว่าต้องทำอะไร
      //    → บอกวิธีติดตั้ง สัปดาห์ละครั้งจนกว่าจะติดตั้ง
      if (PushService.isIos() && !PushService.isStandalone()) {
        const KEY = "push.iosGuide.at";
        let last = 0;
        try { last = Number(localStorage.getItem(KEY)) || 0; } catch { /* ไม่มีที่เก็บ */ }
        if (Date.now() - last < 7 * 24 * 60 * 60 * 1000) return;
        try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ไม่มีที่เก็บ */ }
        Swal.fire({
          title: "รับแจ้งเตือนบน iPhone 🔔",
          html: `<div style="text-align:left;font-size:0.95rem;line-height:1.7">
            iPhone รับแจ้งเตือนได้เมื่อเปิดแอปจาก<b>ไอคอนบนหน้าจอโฮม</b>เท่านั้น<br/>
            1. กดปุ่ม <b>แชร์</b> <span style="font-size:1.1em">⬆️</span> ด้านล่างของ Safari<br/>
            2. เลือก <b>"เพิ่มไปยังหน้าจอโฮม"</b><br/>
            3. เปิดแอปจากไอคอนใหม่ แล้วกด <b>"เปิดการแจ้งเตือน"</b></div>`,
          confirmButtonText: "เข้าใจแล้ว",
          confirmButtonColor: "#2563eb",
        });
        return;
      }
      if (!PushService.isSupported()) return;
      const permission = await PushService.getPermissionState();
      // 🐛 (15 ต.ค. 2569 ผู้ใช้: "เครื่องไหนที่เปิดแจ้งเตือนแล้วไม่ควรเด้งขึ้นมา ทำให้สับสน")
      //    อนุญาตไว้แล้ว = เปิดแล้ว ไม่ต้องถามอีก — ถ้า subscription หาย/ถูกหมุน ต่อใหม่เงียบๆ (syncSubscription)
      //    เดิมเช็คแค่ "มี subscription ไหม" ช่วงที่เบราว์เซอร์หมุน subscription หรือ service worker ยังไม่พร้อม จึงเด้งถามซ้ำ
      if (permission === "granted") { PushService.syncSubscription(); return; }
      if (permission === "denied") return;
      if (await PushService.isSubscribed()) return;
      // กด "ไว้ทีหลัง" → ไม่ถามซ้ำ 3 วัน (เดิมถามทุกครั้งที่เปิดแอป)
      const LATER_KEY = "push.askLater.at";
      try { if (Date.now() - (Number(localStorage.getItem(LATER_KEY)) || 0) < 3 * 24 * 3600 * 1000) return; } catch { /* ไม่มีที่เก็บ */ }

      // ✅ หน้าต่างชวนเปิดแจ้งเตือนแบบแอปทั่วไป: ไอคอนกระดิ่ง · หัวข้อ · ประโยชน์ 3 ข้อ · ปุ่มหลักน้ำเงิน / ไว้ทีหลัง
      const item = (icon, text) => `<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;background:#f8fafc;text-align:left">
          <span style="flex-shrink:0;width:32px;height:32px;border-radius:10px;background:#eff6ff;display:grid;place-items:center;font-size:17px">${icon}</span>
          <span style="font-size:14px;color:#334155;line-height:1.45">${text}</span></div>`;
      const result = await Swal.fire({
        html: `<div style="font-family:inherit">
          <div style="margin:4px auto 14px;width:72px;height:72px;border-radius:50%;background:#eff6ff;display:grid;place-items:center;box-shadow:0 0 0 10px rgba(37,99,235,.06)">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="#2563eb" aria-hidden="true"><path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-1.7 1.7A1 1 0 0 0 4 19.4h16a1 1 0 0 0 .7-1.7Z"/></svg>
          </div>
          <div style="font-size:20px;font-weight:800;color:#0f172a">เปิดการแจ้งเตือนบนเครื่องนี้</div>
          <div style="margin-top:6px;font-size:14px;color:#64748b">ไม่ต้องเปิดแอปค้างไว้ ก็ไม่พลาดเรื่องสำคัญ</div>
          <div style="display:grid;gap:8px;margin-top:16px">
            ${item("📋", "งานใหม่ที่มอบหมายให้คุณ และงานที่ต้องรับทราบ")}
            ${item("✅", "ผลอนุมัติ / ไม่อนุมัติ ปิดงานและใบเบิก")}
            ${item("💬", "ข้อความและงานที่ใกล้ถึงกำหนด")}
          </div>
        </div>`,
        showCancelButton: true,
        confirmButtonText: "เปิดการแจ้งเตือน",
        cancelButtonText: "ไว้ทีหลัง",
        buttonsStyling: false,
        customClass: { popup: "tt-push-ask", actions: "tt-push-ask-actions", confirmButton: "tt-push-ask-ok", cancelButton: "tt-push-ask-later" },
        didOpen: () => {
          if (document.getElementById("tt-push-ask-style")) return;
          const st = document.createElement("style");
          st.id = "tt-push-ask-style";
          st.textContent = `.tt-push-ask{border-radius:20px!important;padding:22px 20px 18px!important;width:min(92vw,420px)!important}
            .tt-push-ask-actions{flex-direction:column;width:100%;gap:6px;margin-top:18px!important}
            .tt-push-ask-ok{width:100%;height:48px;border:0;border-radius:12px;background:#2563eb;color:#fff;font:inherit;font-size:16px;font-weight:800;cursor:pointer;box-shadow:0 8px 18px -10px rgba(37,99,235,.8)}
            .tt-push-ask-ok:hover{background:#1d4ed8}
            .tt-push-ask-ok:focus,.tt-push-ask-later:focus{outline:none;box-shadow:0 0 0 3px rgba(37,99,235,.25)}
            .tt-push-ask-later{width:100%;height:42px;border:0;border-radius:12px;background:transparent;color:#64748b;font:inherit;font-size:15px;font-weight:700;cursor:pointer}
            .tt-push-ask-later:hover{background:#f1f5f9}`;
          document.head.appendChild(st);
        },
      });

      if (result.isConfirmed) {
        try {
          await PushService.subscribe();
          Swal.fire({ title: "เปิดการแจ้งเตือนแล้ว", icon: "success", timer: 1300, showConfirmButton: false });
        } catch (error) {
          Swal.fire({ title: "เปิดไม่สำเร็จ", text: error.message || "กรุณาลองใหม่อีกครั้ง", icon: "error", confirmButtonColor: "#2563eb" });
        }
      } else {
        try { localStorage.setItem(LATER_KEY, String(Date.now())); } catch { /* ไม่มีที่เก็บ */ }
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

  /* 🐛 เดิมมี handleTouchStart/handleTouchEnd ที่ <main> — ปัดนิ้วขึ้นเกิน 50px แล้วปิดลิ้นชัก
     แต่ <main> ครอบลิ้นชักไว้ด้วย "การเลื่อนดูเมนูในลิ้นชัก" จึงเป็นการปัดขึ้นแบบเดียวกันเป๊ะ
     ผู้ใช้เลยเลื่อนดูเมนูไม่ได้ พอปล่อยนิ้วลิ้นชักก็ปิดทิ้ง
     ✅ ตัดทิ้งทั้งชุด — ปิดลิ้นชักได้ด้วยการแตะนอกกรอบหรือกดเมนู ซึ่งมีอยู่แล้วและชัดเจนกว่า */

  return (
    <main>
      {/* ✅ แจ้งเตือนแบบ LINE ตอนแอปเปิดอยู่ — แบนเนอร์บนสุด + เสียง (ตอนแอปปิด service worker แจ้งผ่านระบบมือถือแทน) */}
      <InAppPushBanner />
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
          {/* 🐛 BUG ที่แก้ (ระยะบนสุดบนมือถือเยอะเกินจนดูไม่พอดี): ปุ่มย้อนกลับตัวนี้เดิมเป็นลูกศรเปล่าๆ
              ขนาด 30px ที่มี margin รอบตัว 15px + padding ของ IconButton อีก 8px = กินความสูงราว 76px
              ลอยอยู่เฉยๆ แล้วยังตามด้วย padding ของ Container (24px) และของตัวหน้าเองอีกชั้น รวมแล้วมี
              ที่ว่างเกือบ 120px ก่อนจะถึงหัวข้อหน้า ทั้งที่จอมือถือสูงแค่ ~700px
              ✅ ย่อเป็นปุ่มวงกลมกะทัดรัดขนาดมาตรฐานที่นิ้วยังกดถนัด (36px ตามเกณฑ์พื้นที่แตะขั้นต่ำ) และ
              ทำให้ "ดูเป็นปุ่ม" จริงๆ (มีพื้น/ขอบ) แทนลูกศรลอยที่ดูเหมือนไอคอนตกแต่ง — ส่วนระยะซ้อนกัน
              ของ Container แก้ที่ .app-page-container ใน FullLayout.css */}
          {!isDashboard && (
            <div className="back-button">
              <IconButton
                onClick={() => navigate("/dashboard")}
                aria-label="กลับไปหน้าแดชบอร์ด"
                sx={{
                  m: "10px 12px 2px", width: 36, height: 36, fontSize: 16,
                  color: "#475569", bgcolor: "#fff",
                  border: "1px solid rgba(15,23,42,0.1)",
                  boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
                  "&:hover": { bgcolor: "#f8fafc", color: "#dc2626" },
                }}
              >
                <FaArrowLeft />
              </IconButton>
            </div>
          )}

          {/* ปรับแก้: ถ้าเป็นหน้าปฏิทิน/หน้าแรก จะใช้ p-0 m-0 เพื่อดึงพื้นที่เต็มความกว้างขอบจอ
              ✅ app-page-container — hook สำหรับบีบระยะขอบบนจอมือถือ (ดู FullLayout.css) จอใหญ่ยังได้
              p-4 เท่าเดิมทุกประการ */}
          {/* ✅ app-page-container--flush (หน้า Dashboard) — มือถือไม่มีขอบซ้าย-ขวาของชั้นนี้ ให้เนื้อหาเต็มจอ
              (ผู้ใช้ขอ: "ด้านข้างที่ย่นทำให้เต็มด้วย ในจอมือถือ") หน้า Dashboard มีระยะขอบในตัวเองอยู่แล้ว
              เดิมจึงเว้นขอบซ้อน 2 ชั้น เห็นเป็นแถบสีพื้นหลังว่างๆ สองข้างกว้างรวมเกือบ 60px */}
          <Container
            className={isCalendarPage ? "p-0 m-0" : `p-4 app-page-container${isDashboard ? " app-page-container--flush" : ""}`}
            fluid={true}
          >
            {/* ✅ แจ้งครั้งเดียวสำหรับคนที่ติดตั้งแอปไว้ก่อนเปลี่ยนชื่อ/ไอคอน (ดูเหตุผลใน AppRebrandNotice) */}
            <AppRebrandNotice />
            {/* ✅ error ในหน้าใดหน้าหนึ่ง → แสดงกล่อง "โหลดใหม่" เฉพาะเนื้อหา (เมนูยังใช้ได้) ไม่ใช่จอขาวทั้งแอป */}
            <AppErrorBoundary variant="page" resetKey={location.pathname}>
              <Outlet />
            </AppErrorBoundary>
            <SpeedInsights />
          </Container>

          <Footer />
        </div>
      </div>

      {/* แถบเมนูหลักติดขอบล่าง — แสดงเฉพาะจอโทรศัพท์ (CSS ใน MobileBottomNav.css) */}
      <MobileBottomNav />
    </main>
  );
};

export default FullLayout;