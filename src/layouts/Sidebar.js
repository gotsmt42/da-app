import { useState, useEffect } from "react";
import { Nav, NavItem, Collapse } from "reactstrap";
import { Link, useLocation } from "react-router-dom";
import AuthService from "../services/authService";
import "./Sidebar.css";
import Swal from "sweetalert2";
import { swalLogout, hasValidAvatar } from "../functions/user";
import { useAuth } from "../auth/AuthContext";
// ✅ ใช้ไอคอนชุดเดียวกับที่ Dashboard.js ใช้จริง (react-icons/fa) แทน bootstrap-icons เดิม — เดิม
// สองที่นี้ใช้คนละชุดไอคอนกันคนละความหมาย (เช่น "แผนงานทั้งหมด" หน้า Dashboard กับ "แผนงาน" ใน
// sidebar เป็นหน้าเดียวกันแต่ไอคอนคนละแบบ) ทำให้ผู้ใช้จำไม่ได้ว่าไอคอนไหนคือเมนูไหนบ้าง
import {
  FaTachometerAlt,
  FaCalendarAlt,
  FaFileContract,
  FaClipboardList,
  FaFileAlt,
  FaFileInvoiceDollar,
  FaUserFriends,
  FaBuilding,
  FaUsers,
  FaCog,
  FaSignOutAlt,
} from "react-icons/fa";

// ✅ Sidebar เป็น presentational ล้วนๆ ไม่จัดการ เปิด/ปิด บนมือถือเองอีกต่อไป
// (เดิมมี state `isOpen` + ปุ่ม toggle + overlay ของตัวเอง ซ้ำซ้อนกับกลไกของ FullLayout.js
// ที่คุม <aside className="sidebarArea showSidebar/hideSidebar/desktopSidebar"> อยู่แล้ว
// ทั้งสองระบบแยกกันคนละ state ทำให้ปุ่มเปิดปิดที่ Header ไม่ตรงกับที่ Sidebar คาดหวังเสมอไป
// ตอนนี้ FullLayout เป็นเจ้าของ state เพียงจุดเดียว — Sidebar แค่ render เนื้อหาข้างใน)
const Sidebar = ({ handleMenuClick, isCollapsed = false }) => {
  const [collapsedMenu, setCollapsedMenu] = useState({});
  const location = useLocation();
  const { userData, logout } = useAuth();

  const isAdmin = userData?.role?.toLowerCase() === "admin";
  const isTechnician = userData?.role?.toLowerCase() === "technician";
  const isAdminOrManager = ["admin", "manager"].includes(userData?.role?.toLowerCase());

  const [user, setUser] = useState({});

  useEffect(() => {
    const getUserData = async () => {
      try {
        const getUser = await AuthService.getUserData();
        setUser(getUser.user);
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };
    getUserData();
  }, []);

  // ✅ จัดหมวดใหม่ให้ตรงกับความหมายจริง — เดิม "ภาพรวมสัญญา"/"ติดตามใบเสนอราคา" ถูกยัดรวมไว้ใต้
  // หัวข้อ "ทีมงาน" ทั้งที่ไม่เกี่ยวกับทีมช่างเลย (เป็นงาน/เอกสารติดตาม) ตอนนี้แยกเป็น 3 หมวดชัดเจน:
  // "งาน" (แผนงาน/สัญญา/งานของฉัน), "เอกสาร" (ไฟล์/ใบเสนอราคา), "ทีมงาน" (เฉพาะภาพรวมทีมช่างจริงๆ)
  const navigation = [
    { title: "Dashboard", href: "/dashboard", icon: <FaTachometerAlt /> },
  ];

  // ✅ หมวด "งาน" — แผนงาน/ปฏิทินอยู่นี่เหมือนเดิม เพิ่มภาพรวมสัญญา (admin/manager) และงานของฉัน
  // (ช่าง) เข้ามาด้วย เพราะเป็นเรื่อง "งาน" ทั้งคู่ ไม่ใช่เรื่องทีม — ไอคอนตรงกับการ์ดทางลัดหน้า
  // Dashboard.js ทุกตัว (FaCalendarAlt="แผนงานทั้งหมด", FaClipboardList="งานของฉัน" ฯลฯ)
  const workMenu = [
    {
      title: "แผนงาน",
      href: "/event",
      icon: <FaCalendarAlt />,
      items: [
        { title: "ตารางงานทั้งหมด", href: "/event" },
        { title: "การดำเนินงาน", href: "/operation" },
      ],
    },
  ];
  const workMenuManager = [
    { title: "ภาพรวมสัญญา", href: "/contracts", icon: <FaFileContract /> },
  ];
  // ✅ เดิมประกาศไว้แต่ไม่เคย render เลย — ช่างจึงไม่มีทางกดเข้า "งานของฉัน" จาก sidebar ได้เลย
  const workMenuTechnician = [
    { title: "งานของฉัน", href: "/technician/jobs", icon: <FaClipboardList /> },
  ];

  // ✅ หมวด "เอกสาร" — ติดตามใบเสนอราคาย้ายมาจาก "ทีมงาน" เดิม เพราะเป็นเรื่องเอกสารติดตาม
  // ไม่ใช่เรื่องทีม เห็นได้ทั้งช่างและแอดมิน/manager เหมือนเดิม
  const documentsMenu = [
    { title: "เอกสารทั้งหมด", href: "/files", icon: <FaFileAlt /> },
  ];
  const documentsMenuShared = [
    { title: "ติดตามใบเสนอราคา", href: "/quotations", icon: <FaFileInvoiceDollar /> },
  ];

  // ✅ หมวด "ทีมงาน" — เหลือแค่ภาพรวมทีมช่างจริงๆ (เฉพาะแอดมิน/manager) สรุปภาพรวมงานของช่าง
  // แต่ละคนแยกกันชัดเจน (เดิมไม่มีทางเห็นได้เลยนอกจากไล่กรองเองทีละคนในหน้า Operation)
  const teamMenu = [
    { title: "ภาพรวมทีมช่าง", href: "/team-workload", icon: <FaUserFriends /> },
  ];

  // ✅ เดิม submenu จะปิดเสมอตอนโหลดหน้าใหม่ ต่อให้กำลังอยู่ในหน้าลูกของมันอยู่ก็ตาม
  // (เช่น เข้า /operation ตรงๆ จาก Dashboard) ทำให้มองไม่ออกเลยว่าอยู่หมวดไหน — ใช้ route
  // เป็นค่าเริ่มต้นแทน จนกว่าผู้ใช้จะกดเปิด/ปิดเองจึงค่อยยึดตามที่กดล่าสุด
  const isParentActive = (navi) => navi.items?.some((item) => location.pathname === item.href);
  const isMenuOpen = (navi, index) =>
    collapsedMenu[index] !== undefined ? collapsedMenu[index] : isParentActive(navi);

  const toggleNavbar = (index) => {
    setCollapsedMenu({
      ...collapsedMenu,
      [index]: !collapsedMenu[index],
    });
  };

  const handleLogout = async () => {
    await swalLogout().then((result) => {
      if (result.isConfirmed) {
        logout();
        Swal.fire("Logout Success!", "", "success");
      }
    });
  };

  // ปิด sidebar อัตโนมัติบนมือถือเมื่อคลิกลิงก์ (state จัดการโดย FullLayout ทั้งหมด)
  const handleItemClick = () => {
    if (handleMenuClick) handleMenuClick();
  };

  const initials = (userData?.fname?.charAt(0) || userData?.username?.charAt(0) || "U").toUpperCase();

  const renderLink = (item, key) => (
    <NavItem key={key}>
      <Link
        to={item.href}
        title={item.title}
        className={`nav-link ${location.pathname === item.href ? "active" : ""}`}
        onClick={handleItemClick}
      >
        <span className="nav-icon">{item.icon}</span>
        <span className="nav-text">{item.title}</span>
      </Link>
    </NavItem>
  );

  // ✅ เมนูแม่ที่มีลูก (ตอนนี้มีแค่ "แผนงาน") — ตอนย่อแถบไม่มีที่พอให้กาง submenu ใน rail แคบๆ
  // ได้เลย กดแล้วพาไปหน้า default (href ของแม่) ตรงๆ แทน ต้องขยายแถบก่อนถึงจะเข้าเมนูลูกอื่นได้
  const renderParentWithItems = (navi, index) => (
    <NavItem key={index}>
      {isCollapsed ? (
        <Link
          to={navi.href}
          title={navi.title}
          className={`nav-link ${isParentActive(navi) || location.pathname === navi.href ? "active" : ""}`}
          onClick={handleItemClick}
        >
          <span className="nav-icon">{navi.icon}</span>
          <span className="nav-text">{navi.title}</span>
        </Link>
      ) : (
        <>
          <button
            className={`nav-link menu-dropdown-btn ${isMenuOpen(navi, index) ? "expanded" : ""} ${isParentActive(navi) ? "parent-active" : ""}`}
            onClick={() => toggleNavbar(index)}
          >
            <span className="nav-icon">{navi.icon}</span>
            <span className="nav-text">{navi.title}</span>
            <i className={`bi bi-chevron-right arrow-icon ${isMenuOpen(navi, index) ? "rotate" : ""}`}></i>
          </button>
          <Collapse isOpen={isMenuOpen(navi, index)}>
            <div className="submenu-wrapper">
              {navi.items.map((item, idx) => (
                <Link
                  key={idx}
                  className={`nav-link submenu-link ${location.pathname === item.href ? "active" : ""}`}
                  to={item.href}
                  onClick={handleItemClick}
                >
                  <i className="bi bi-circle submenu-dot"></i>
                  <span className="nav-text">{item.title}</span>
                </Link>
              ))}
            </div>
          </Collapse>
        </>
      )}
    </NavItem>
  );

  return (
    <div className={`sidebar-container ${isCollapsed ? "collapsed" : ""}`}>
      {/* ส่วนหัว: โปรไฟล์ผู้ใช้ — การ์ดลอยตัวสไตล์เดียวกับหน้าอื่นๆ ในแอป แทนแถบไล่เฉดเดิม */}
      <div className="profilebg">
        <div className="p-2 d-flex align-items-center gap-3">
          <Link to={"/account"} onClick={handleItemClick}>
            {hasValidAvatar(userData?.imageUrl) ? (
              <img
                src={userData.imageUrl}
                alt="user"
                width="48"
                height="48"
                className="rounded-circle profile-img"
              />
            ) : (
              <div className="profile-img profile-img-fallback">{initials}</div>
            )}
          </Link>
          <div className="text-truncate" style={{ zIndex: 2 }}>
            <h6 className="user-name text-truncate">
              {userData?.fname} {userData?.lname}
            </h6>
            <span className="user-role-badge">
              {userData?.role || "User"}
            </span>
          </div>
        </div>
      </div>

      {/* ตรงกลาง: รายการเมนูหลัก — จัดหมวดใหม่เป็น งาน/เอกสาร/ทีมงาน ให้ตรงความหมายจริง */}
      <div className="sidebar-content">
        <Nav vertical className="sidebarNav">
          {navigation.map((item, idx) => renderLink(item, `nav-${idx}`))}

          {/* หมวด "งาน" — แผนงาน/ปฏิทิน + ภาพรวมสัญญา (admin/manager) + งานของฉัน (ช่าง) */}
          <div className="admin-divider-label">งาน</div>
          {workMenu.map((navi, index) => renderParentWithItems(navi, `work-${index}`))}
          {isAdminOrManager && workMenuManager.map((item, idx) => renderLink(item, `work-mgr-${idx}`))}
          {isTechnician && workMenuTechnician.map((item, idx) => renderLink(item, `work-tech-${idx}`))}

          {/* หมวด "เอกสาร" — เอกสารทั้งหมด + ติดตามใบเสนอราคา (เห็นได้ทั้งช่างและแอดมิน/manager) */}
          <div className="admin-divider-label">เอกสาร</div>
          {documentsMenu.map((item, idx) => renderLink(item, `doc-${idx}`))}
          {(isTechnician || isAdminOrManager) &&
            documentsMenuShared.map((item, idx) => renderLink(item, `doc-shared-${idx}`))}

          {/* ✅ เฉพาะแอดมิน/manager — เข้าดูภาพรวมงานแยกรายช่างได้จาก sidebar โดยตรง */}
          {isAdminOrManager && (
            <>
              <div className="admin-divider-label">ทีมงาน</div>
              {teamMenu.map((item, idx) => renderLink(item, `team-${idx}`))}
            </>
          )}
        </Nav>
      </div>

      {/* ด้านล่างสุด: กลุ่มปุ่มตั้งค่าแอดมินและปุ่มออกจากระบบ */}
      <div className="sidebar-fixed-bottom">
        <Nav vertical>
          {isAdmin && (
            <>
              <div className="admin-divider-label">Admin Management</div>
              <NavItem>
                <Link
                  to="/customer"
                  title="Customer"
                  className={`nav-link ${location.pathname === "/customer" ? "active" : ""}`}
                  onClick={handleItemClick}
                >
                  <span className="nav-icon"><FaBuilding /></span>
                  <span className="nav-text">Customer</span>
                </Link>
              </NavItem>
              <NavItem>
                <Link
                  to="/employee"
                  title="Employee"
                  className={`nav-link ${location.pathname === "/employee" ? "active" : ""}`}
                  onClick={handleItemClick}
                >
                  <span className="nav-icon"><FaUsers /></span>
                  <span className="nav-text">Employee</span>
                </Link>
              </NavItem>
            </>
          )}

          {/* ✅ ทุกสิทธิ์ (รวมช่าง) เข้าหน้าตั้งค่าได้ — ตัวหน้า Settings.js เองเป็นคนซ่อน
              ส่วน "การจัดการระบบ" ไว้เฉพาะแอดมินอีกชั้นหนึ่งอยู่แล้ว */}
          <NavItem>
            <Link
              to="/about"
              title="Settings"
              className={`nav-link ${location.pathname === "/about" ? "active" : ""}`}
              onClick={handleItemClick}
            >
              <span className="nav-icon"><FaCog /></span>
              <span className="nav-text">Settings</span>
            </Link>
          </NavItem>

          {/* ปุ่มออกจากระบบ — ไอคอนตัวเดียวกับที่ Header.js ใช้ตรงเมนู Logout ในดรอปดาวน์โปรไฟล์ */}
          <NavItem className="mt-2">
            <Link className="nav-link logout-link" title="Logout" onClick={handleLogout}>
              <span className="nav-icon"><FaSignOutAlt /></span>
              <span className="nav-text">LOGOUT</span>
            </Link>
          </NavItem>
        </Nav>
      </div>
    </div>
  );
};

export default Sidebar;
