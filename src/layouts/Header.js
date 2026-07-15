import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import AuthService from "../services/authService";
import EventService from "../services/EventService";
import { useAuth } from "../auth/AuthContext";
import useEventNotifications from "../hooks/useEventNotifications";
import NotificationBell from "../components/Notifications/NotificationBell";
import './Header.css';
import {
  Navbar,
  Nav,
  NavItem,
  NavbarBrand,
  Dropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  Button,
} from "reactstrap";
import { swalLogout } from "../functions/user";
import Swal from "sweetalert2";
import { FaBars, FaUserCircle, FaSignOutAlt } from "react-icons/fa";

const Header = ({ toggleMobileSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);
  const [user, setUser] = useState({});
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // ✅ ดึง events เองที่นี่ (แยกจากหน้า Operation) เพื่อให้กระดิ่งแจ้งเตือนเห็นได้ทุกหน้า
  // ไม่ใช่แค่ตอนเปิดหน้า Operation ค้างไว้เท่านั้น — poll ทุก 30s เหมือนหน้าอื่นๆ ในระบบ
  const [events, setEvents] = useState([]);

  const { userData, logout } = useAuth();
  const isTechnician = userData?.role?.toLowerCase() === "technician";
  const isAdminOrManager = ["admin", "manager"].includes(userData?.role?.toLowerCase());

  const { notifications, unread, markRead } = useEventNotifications(
    events,
    isAdminOrManager ? "admin" : "technician"
  );

  useEffect(() => {
    const getUserData = async () => {
      try {
        const getUser = await AuthService.getUserData();
        setUser(getUser.user);
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    const fetchEventsForNotifications = async () => {
      try {
        const res = await EventService.getEventOp();
        setEvents(res?.userEvents || []);
      } catch {
        // เงียบไว้ — ไม่ใช่หน้าจอหลักของ endpoint นี้ ไม่ต้องกวนผู้ใช้ด้วย error
      }
    };

    getUserData();
    fetchEventsForNotifications();

    const interval = setInterval(fetchEventsForNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggle = () => setDropdownOpen((prevState) => !prevState);

  const handleLogout = async () => {
    const result = await swalLogout();
    if (result.isConfirmed) {
      logout();
      Swal.fire("Logout Success!", "", "success");
    }
  };

  const initials = (userData?.fname?.charAt(0) || userData?.username?.charAt(0) || "U").toUpperCase();

  return (
    <Navbar dark expand="md" className="fix-header">
      <div className="d-flex align-items-center justify-content-between w-100">

        {/* ฝั่งซ้าย: โลโก้แบรนด์ */}
        <NavbarBrand tag={Link} to="/dashboard" className="m-0">
          <div className="gradiant-bg">
            <img src="logo-dark-2.png" alt="Logo" className="logo" />
          </div>
        </NavbarBrand>

        {/* ตรงกลาง: รายการเมนูลิงก์ */}
        <Nav className="navbar-nav mx-auto d-none d-lg-flex" navbar>
          <NavItem>
            <Link to="/dashboard" className={`nav-link ${isActive("/dashboard") ? "active" : ""}`}>Dashboard</Link>
          </NavItem>
          <NavItem>
            <Link to="/event" className={`nav-link ${isActive("/event") ? "active" : ""}`}>Event</Link>
          </NavItem>
          <NavItem>
            <Link to="/files" className={`nav-link ${isActive("/files") ? "active" : ""}`}>เอกสารทั้งหมด</Link>
          </NavItem>
          {/* ✅ เดิม comment ทิ้งไว้ — ช่างไม่มีทางกดเข้า "งานของฉัน" จาก Header ได้เลย */}
          {isTechnician && (
            <NavItem>
              <Link to="/technician/jobs" className={`nav-link ${isActive("/technician") ? "active" : ""}`}>งานของฉัน</Link>
            </NavItem>
          )}
        </Nav>

        {/* ฝั่งขวา: แจ้งเตือน + รูปโปรไฟล์ผู้ใช้งาน + ปุ่มแฮมเบอร์เกอร์ */}
        {/* ✅ ปุ่มเปิด/ปิด push notification ย้ายไปอยู่ที่หน้า Settings แล้ว (เดิมมีทั้งที่นี่และ
            ที่ Settings ทำให้สับสนว่าอันไหนคือจุดควบคุมจริง) */}
        <div className="d-flex align-items-center gap-2">
          <NotificationBell notifications={notifications} unread={unread} onItemClick={markRead} dark />

          <div className="profile-img">
            <Dropdown isOpen={dropdownOpen} toggle={toggle}>
              <DropdownToggle color="transparent" style={{ padding: 0, border: 'none' }}>
                {userData?.imageUrl ? (
                  <img
                    src={userData.imageUrl}
                    alt="profile"
                    className="rounded-circle"
                    width="38"
                    height="38"
                    style={{ objectFit: 'cover', border: '2px solid #243048' }}
                  />
                ) : (
                  <div className="header-avatar-fallback">{initials}</div>
                )}
              </DropdownToggle>
              <DropdownMenu end className="modern-dropdown-menu">
                <div className="dropdown-user-summary">
                  {userData?.imageUrl ? (
                    <img src={userData.imageUrl} alt="profile" className="dropdown-user-avatar" />
                  ) : (
                    <div className="header-avatar-fallback dropdown-user-avatar">{initials}</div>
                  )}
                  <div className="dropdown-user-text">
                    <span className="user-display-name">{user?.username || userData?.name}</span>
                    <span className="dropdown-user-role">{userData?.role || "User"}</span>
                  </div>
                </div>
                <DropdownItem divider />
                <Link to={"/account"} style={{ textDecoration: "none" }}>
                  <DropdownItem className="dropdown-item-icon">
                    <FaUserCircle size={14} /> My Account
                  </DropdownItem>
                </Link>
                <DropdownItem divider />
                <DropdownItem onClick={handleLogout} className="dropdown-item-icon" style={{ color: '#ef4444' }}>
                  <FaSignOutAlt size={14} /> Logout
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>

          <Button
            className="d-lg-none toggle-sidebar-btn"
            onClick={toggleMobileSidebar}
          >
            <FaBars style={{ fontSize: "22px", color: "#ffffff" }} />
          </Button>
        </div>

      </div>
    </Navbar>
  );
};

export default Header;
