import { useState, useEffect } from "react";
import { Nav, NavItem, Collapse } from "reactstrap";
import { Link, useLocation } from "react-router-dom";
import AuthService from "../services/authService";
import "./Sidebar.css";
import Swal from "sweetalert2";
import { swalLogout } from "../functions/user";
import { useAuth } from "../auth/AuthContext";

// ✅ Sidebar เป็น presentational ล้วนๆ ไม่จัดการ เปิด/ปิด บนมือถือเองอีกต่อไป
// (เดิมมี state `isOpen` + ปุ่ม toggle + overlay ของตัวเอง ซ้ำซ้อนกับกลไกของ FullLayout.js
// ที่คุม <aside className="sidebarArea showSidebar/hideSidebar/desktopSidebar"> อยู่แล้ว
// ทั้งสองระบบแยกกันคนละ state ทำให้ปุ่มเปิดปิดที่ Header ไม่ตรงกับที่ Sidebar คาดหวังเสมอไป
// ตอนนี้ FullLayout เป็นเจ้าของ state เพียงจุดเดียว — Sidebar แค่ render เนื้อหาข้างใน)
const Sidebar = ({ handleMenuClick }) => {
  const [collapsedMenu, setCollapsedMenu] = useState({});
  const location = useLocation();
  const { userData, logout } = useAuth();

  const isAdmin = userData?.role?.toLowerCase() === "admin";
  const isTechnician = userData?.role?.toLowerCase() === "technician";

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

  // โครงสร้างเมนูหลัก (เพิ่มตัวอย่าง Sub-menu ในแผนงานให้เห็นวิธีใช้)
  const navigation = [
    { title: "Dashboard", href: "/dashboard", icon: "bi-grid-1x2-fill" },
    {
      title: "แผนงาน",
      href: "/event",
      icon: "bi-calendar-event-fill",
      items: [
        { title: "ตารางงานทั้งหมด", href: "/event" },
        { title: "การดำเนินงาน", href: "/operation" },
      ],
    },
    { title: "เอกสารทั้งหมด", href: "/files", icon: "bi-file-earmark-text-fill" },
  ];

  // ✅ เดิมประกาศไว้แต่ไม่เคย render เลย — ช่างจึงไม่มีทางกดเข้า "งานของฉัน" จาก sidebar ได้เลย
  const technicianMenu = [
    { title: "งานของฉัน", href: "/technician/jobs", icon: "bi-tools" },
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
        className={`nav-link ${location.pathname === item.href ? "active" : ""}`}
        onClick={handleItemClick}
      >
        <i className={`bi ${item.icon} nav-icon`}></i>
        <span className="nav-text">{item.title}</span>
      </Link>
    </NavItem>
  );

  return (
    <div className="sidebar-container">
      {/* ส่วนหัว: โปรไฟล์ผู้ใช้ — การ์ดลอยตัวสไตล์เดียวกับหน้าอื่นๆ ในแอป แทนแถบไล่เฉดเดิม */}
      <div className="profilebg">
        <div className="p-2 d-flex align-items-center gap-3">
          <Link to={"/account"} onClick={handleItemClick}>
            {userData?.imageUrl ? (
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

      {/* ตรงกลาง: รายการเมนูหลัก */}
      <div className="sidebar-content">
        <Nav vertical className="sidebarNav">
          {navigation.map((navi, index) => (
            <NavItem key={index}>
              {navi.items ? (
                <>
                  <button
                    className={`nav-link menu-dropdown-btn ${isMenuOpen(navi, index) ? "expanded" : ""} ${isParentActive(navi) ? "parent-active" : ""}`}
                    onClick={() => toggleNavbar(index)}
                  >
                    <i className={`bi ${navi.icon} nav-icon`}></i>
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
              ) : (
                <Link
                  to={navi.href}
                  className={`nav-link ${location.pathname === navi.href ? "active" : ""}`}
                  onClick={handleItemClick}
                >
                  <i className={`bi ${navi.icon} nav-icon`}></i>
                  <span className="nav-text">{navi.title}</span>
                </Link>
              )}
            </NavItem>
          ))}

          {/* ✅ เมนูเฉพาะช่าง — เดิมมีตัวแปรไว้แต่ไม่เคยแสดงผลจริง */}
          {isTechnician && (
            <>
              <div className="admin-divider-label">งานของฉัน</div>
              {technicianMenu.map((item, idx) => renderLink(item, `tech-${idx}`))}
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
                  className={`nav-link ${location.pathname === "/customer" ? "active" : ""}`}
                  onClick={handleItemClick}
                >
                  <i className="bi bi-building-fill-gear nav-icon"></i>
                  <span className="nav-text">Customer</span>
                </Link>
              </NavItem>
              <NavItem>
                <Link
                  to="/employee"
                  className={`nav-link ${location.pathname === "/employee" ? "active" : ""}`}
                  onClick={handleItemClick}
                >
                  <i className="bi bi-people-fill nav-icon"></i>
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
              className={`nav-link ${location.pathname === "/about" ? "active" : ""}`}
              onClick={handleItemClick}
            >
              <i className="bi bi-sliders nav-icon"></i>
              <span className="nav-text">Settings</span>
            </Link>
          </NavItem>

          {/* ปุ่มออกจากระบบ */}
          <NavItem className="mt-2">
            <Link className="nav-link logout-link" onClick={handleLogout}>
              <i className="bi bi-box-arrow-right nav-icon"></i>
              <span className="nav-text">LOGOUT</span>
            </Link>
          </NavItem>
        </Nav>
      </div>
    </div>
  );
};

export default Sidebar;
