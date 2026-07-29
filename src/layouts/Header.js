import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import AuthService from "../services/authService";
import EventService from "../services/EventService";
import { useAuth } from "../auth/AuthContext";
import useEventNotifications from "../hooks/useEventNotifications";
import NotificationBell from "../components/Notifications/NotificationBell";
import './Header.css';
import {
  Navbar,
  NavbarBrand,
  Nav,
  NavItem,
  Dropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  Button,
} from "reactstrap";
import { swalLogout, hasValidAvatar } from "../functions/user";
import Swal from "sweetalert2";
import Badge from "@mui/material/Badge";
import { countOverdueContracts } from "../utils/contractOverdue";
// ✅ ไอคอน 3 เมนูกลางตรงกับที่ Dashboard.js/Sidebar.js ใช้จริงสำหรับหน้าเดียวกันเป๊ะๆ
// (FaWrench="การดำเนินงาน", FaFileContract="ภาพรวมสัญญา", FaFileInvoiceDollar="ติดตามใบเสนอราคา")
import { FaBars, FaUserCircle, FaSignOutAlt, FaWrench, FaFileContract, FaFileInvoiceDollar } from "react-icons/fa";

const Header = ({ toggleMobileSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState({});
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // ✅ ดึง events เองที่นี่ (แยกจากหน้า Operation) เพื่อให้กระดิ่งแจ้งเตือนเห็นได้ทุกหน้า
  // ไม่ใช่แค่ตอนเปิดหน้า Operation ค้างไว้เท่านั้น — poll ทุก 30s เหมือนหน้าอื่นๆ ในระบบ
  const [events, setEvents] = useState([]);
  // ✅ แผนงานล่วงหน้า (unscheduled) ของสัญญา — ต้องรวมด้วยตอนเช็ค "เกินกำหนดวางแผนรอบถัดไป" กัน
  // สัญญาที่จองรอบถัดไปไว้ล่วงหน้าแล้วถูกนับเป็น "เกินกำหนด" ผิดๆ (เทียบ pattern เดียวกับ
  // ContractOverview.js fetchData) — ดึงเฉพาะแอดมิน/manager เพราะป้ายนี้โชว์แค่สองสิทธิ์นี้เท่านั้น
  const [contractDrafts, setContractDrafts] = useState([]);

  const { userData, logout } = useAuth();
  const isAdminOrManager = ["admin", "manager"].includes(userData?.role?.toLowerCase());

  const { notifications, unread, markRead, markAllRead } = useEventNotifications(
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

  useEffect(() => {
    if (!isAdminOrManager) return;
    EventService.GetDraftEvents()
      .then((res) => setContractDrafts(res?.drafts || []))
      .catch(() => {}); // เงียบไว้เหมือนกัน — แค่ป้ายสรุปจำนวน ไม่ใช่ข้อมูลหลักของหน้านี้
  }, [isAdminOrManager]);

  // ✅ จำนวนสัญญาที่รอบล่าสุดผ่านมาเกิน 3 เดือนแล้วแต่ยังไม่ได้วางแผนรอบถัดไป — ใช้ตรรกะเดียวกับ
  // ป้ายแจ้งเตือนในตาราง ContractOverview.js เป๊ะๆ (ดู utils/contractOverdue.js)
  const overdueContractCount = useMemo(
    () => (isAdminOrManager ? countOverdueContracts([...events, ...contractDrafts]) : 0),
    [isAdminOrManager, events, contractDrafts]
  );

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

        {/* ✅ เดิมมีเมนู Dashboard/Event/เอกสารทั้งหมด อยู่ตรงนี้ แต่ซ้ำกับข้อมูลในหน้า Dashboard เลยตัด
            ออกไปก่อนหน้านี้ — ตอนนี้เพิ่มกลับมาเฉพาะ 3 เมนูที่ใช้บ่อยและไม่มีใน sidebar เห็นง่ายๆ ระหว่าง
            ทำงาน (การดำเนินงาน/ภาพรวมสัญญา/ติดตามใบเสนอราคา) แทน ให้กระชับ ไม่รกเหมือนของเดิมที่มี 4 เมนู */}
        <Nav className="navbar-nav mx-auto d-none d-lg-flex" navbar>
          <NavItem>
            <Link
              to="/operation"
              className={`nav-link d-flex align-items-center gap-2 ${location.pathname.startsWith("/operation") ? "active" : ""}`}
            >
              <FaWrench size={13} /> การดำเนินงาน
            </Link>
          </NavItem>
          {isAdminOrManager && (
            <NavItem>
              <Link
                to="/contracts"
                className={`nav-link d-flex align-items-center gap-2 ${location.pathname.startsWith("/contracts") ? "active" : ""}`}
              >
                <FaFileContract size={13} /> ภาพรวมสัญญา
              </Link>
            </NavItem>
          )}
          <NavItem>
            <Link
              to="/quotations"
              className={`nav-link d-flex align-items-center gap-2 ${location.pathname.startsWith("/quotations") ? "active" : ""}`}
            >
              <FaFileInvoiceDollar size={13} /> ติดตามใบเสนอราคา
            </Link>
          </NavItem>
        </Nav>

        {/* ✅ จอมือถือ: Nav ด้านบนถูกซ่อนไว้ (d-none d-lg-flex) เหลือพื้นที่ว่างกลางแถบ — ใส่ทางลัด
            "ภาพรวมสัญญา" พร้อมป้ายจำนวนสัญญาที่เกินกำหนดวางแผนรอบถัดไปแทนที่จะปล่อยว่างเปล่า
            (เฉพาะแอดมิน/manager เหมือนเมนูเดียวกันในแถบบนจอกว้าง/Sidebar) */}
        {isAdminOrManager && (
          <Link to="/contracts" className="header-contract-pill d-flex d-lg-none align-items-center gap-1 mx-auto">
            <Badge
              badgeContent={overdueContractCount} color="error" max={9} overlap="circular"
              sx={{ "& .MuiBadge-badge": { fontSize: "8px", minWidth: 14, height: 14, padding: "0 3px" } }}
            >
              <FaFileContract size={12} />
            </Badge>
            <span>ภาพรวมสัญญา</span>
          </Link>
        )}

        {/* ฝั่งขวา: แจ้งเตือน + รูปโปรไฟล์ผู้ใช้งาน + ปุ่มแฮมเบอร์เกอร์ */}
        {/* ✅ ปุ่มเปิด/ปิด push notification ย้ายไปอยู่ที่หน้า Settings แล้ว (เดิมมีทั้งที่นี่และ
            ที่ Settings ทำให้สับสนว่าอันไหนคือจุดควบคุมจริง) */}
        <div className="d-flex align-items-center gap-2">
          <NotificationBell notifications={notifications} unread={unread} onItemClick={markRead} onMarkAllRead={markAllRead} dark />

          <div className="profile-img">
            <Dropdown isOpen={dropdownOpen} toggle={toggle}>
              <DropdownToggle color="transparent" style={{ padding: 0, border: 'none' }}>
                {hasValidAvatar(userData?.imageUrl) ? (
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
                  {hasValidAvatar(userData?.imageUrl) ? (
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
