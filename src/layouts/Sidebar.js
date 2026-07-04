import { useState, useEffect } from "react";
import { Nav, NavItem, Collapse } from "reactstrap";
import { Link, useLocation } from "react-router-dom";
import AuthService from "../services/authService";
import "./Sidebar.css";
import Swal from "sweetalert2";
import { swalLogout } from "../functions/user";
import { useAuth } from "../auth/AuthContext";

const Sidebar = ({ handleMenuClick }) => {
  const [isOpen, setIsOpen] = useState(false); // สำหรับเปิด-ปิด Sidebar บนมือถือ
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
        { title: "การดำเนินงาน", href: "/operation" }
      ]
    },
    { title: "Service Reports", href: "/files", icon: "bi-file-earmark-text-fill" },
  ];

  const technicianMenu = [
    { title: "งานของฉัน", href: "/technician/jobs", icon: "bi-tools" },
  ];

  const toggleSidebar = () => setIsOpen(!isOpen);

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

  const handleItemClick = () => {
    if (handleMenuClick) handleMenuClick();
    setIsOpen(false); // ปิด sidebar อัตโนมัติบนมือถือเมื่อคลิกลิงก์
  };

  return (
    <>
      {/* ปุ่ม Toggle สำหรับหน้าจอมือถือ */}
      <button className="sidebar-toggle-btn d-xl-none" onClick={toggleSidebar}>
        <i className={`bi ${isOpen ? "bi-list" : "bi-x-lg"}`}></i>
      </button>

      {/* Backdrop สีดำจางๆ เมื่อเปิดเมนูบนมือถือ */}
      {isOpen && <div className="sidebar-overlay d-xl-none" onClick={toggleSidebar}></div>}

      <div className={`sidebar-container ${isOpen ? "" : "show"}`}>
        {/* ส่วนหัว: โปรไฟล์ผู้ใช้ */}
        <div className="profilebg" style={{ background: `linear-gradient(rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.95))` }}>
          <div className="p-2 d-flex align-items-center gap-3">
            <Link to={"/account"} onClick={handleItemClick}>
              <img
                src={userData?.imageUrl || "https://via.placeholder.com/48"}
                alt="user"
                width="48"
                height="48"
                className="rounded-circle profile-img"
              />
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
                      className={`nav-link menu-dropdown-btn ${collapsedMenu[index] ? "expanded" : ""}`} 
                      onClick={() => toggleNavbar(index)}
                    >
                      <i className={`bi ${navi.icon} nav-icon`}></i>
                      <span className="nav-text">{navi.title}</span>
                      <i className={`bi bi-chevron-right arrow-icon ${collapsedMenu[index] ? "rotate" : ""}`}></i>
                    </button>
                    <Collapse isOpen={collapsedMenu[index]}>
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
              </>
            )}

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
    </>
  );
};

export default Sidebar;