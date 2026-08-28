import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import AuthService from "../shared/services/authService";
import EventService from "../shared/services/EventService";
import { useAuth } from "../features/auth/AuthContext";
import useEventNotifications from "../shared/hooks/useEventNotifications";
import NotificationBell from "../features/notifications/components/NotificationBell";
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
import { swalLogout, hasValidAvatar } from "../shared/utils/user";
import Swal from "sweetalert2";
import Badge from "@mui/material/Badge";
import { countOverdueContracts } from "../shared/utils/contractOverdue";
// ✅ ไอคอน 3 เมนูกลางตรงกับที่ Dashboard.js/Sidebar.js ใช้จริงสำหรับหน้าเดียวกันเป๊ะๆ
// (FaWrench="การดำเนินงาน", FaFileContract="ภาพรวมสัญญา", FaFileInvoiceDollar="ติดตามใบเสนอราคา")
import {
  FaBars, FaUserCircle, FaSignOutAlt, FaWrench, FaFileContract, FaFileInvoiceDollar, FaCalendarAlt,
  FaChevronDown, FaCheck, FaBriefcase,
} from "react-icons/fa";
import { can, isRole, ROLES, DEPARTMENT } from "@/shared/utils/roles";

/**
 * ✅ ตัวเลือกของ dropdown "ตารางงาน" — ต่างกันตาม role เพราะ query ?dept= มีความหมายไม่เหมือนกัน
 * (ดู departmentScope ฝั่ง server) ต้องเป็นชุดเดียวกับที่ Sidebar.js ใช้อยู่แล้วเป๊ะๆ ไม่งั้นผู้ใช้จะ
 * เจอ 2 ที่ที่ควรจะเหมือนกันแต่ตัวเลือกไม่ตรงกัน
 *   • แอดมิน/manager: "/event" เฉยๆ = ตารางงานช่าง (ค่าเริ่มต้นของแผนกบริการ) ·
 *     "/event?dept=sales" = ตารางงานเซล (ข้ามแผนกไปดูของฝ่ายขาย) — คู่เดียวกับ workMenu ของ
 *     isAdminOrManager ใน Sidebar.js
 *   • เซล: "/event" เฉยๆ = แผนงานของฉัน (นัดหมายของตัวเอง) · "/event?dept=service" = ตารางงานช่าง
 *     (ขอดูอย่างเดียวข้ามแผนกมาฝั่งบริการ ตามสิทธิ์ viewServiceCalendar)
 * ⚠️ แอดมินไม่มีแนวคิด "แผนงานของฉัน" แยกจาก "ตารางงานช่าง" เพราะแอดมินไม่ได้เป็นคนลงตารางเข้างานเอง
 * — ใช้ตัวเลือกชุดของเซลกับแอดมินไม่ได้ (ผิดความหมาย ไม่ใช่แค่ผิดคำ)
 */
const scheduleOptionsFor = (isAdminOrManagerRole) =>
  isAdminOrManagerRole
    ? {
        primary: { label: "ตารางงานช่าง", href: "/event", icon: FaWrench },
        secondary: { label: "ตารางงานเซล", href: "/event?dept=sales", icon: FaBriefcase, dept: "sales" },
      }
    : {
        primary: { label: "แผนงานของฉัน", href: "/event", icon: FaCalendarAlt },
        secondary: {
          label: "ตารางงานช่าง", href: `/event?dept=${DEPARTMENT.SERVICE}`, icon: FaWrench,
          dept: DEPARTMENT.SERVICE,
        },
      };

/**
 * ✅ เมนูเลือกตารางงาน — ใช้ซ้ำทั้งปุ่มจอกว้าง (ใน .navbar-nav) และ pill จอมือถือ เนื้อหาข้างใน
 * เหมือนกันเป๊ะ ต่างแค่ปุ่มเปิด (toggle) ที่อยู่คนละที่คนละหน้าตา
 *
 * ⚠️ ต้องอยู่ module scope (นอกฟังก์ชัน Header) ไม่ใช่ประกาศเป็น component ซ้อนอยู่ข้างในเด็ดขาด —
 * ถ้าซ้อนอยู่ข้างใน ทุกครั้งที่ Header re-render (event แจ้งเตือนเข้าใหม่ทุก 30 วิ) จะได้ function
 * identity ใหม่ React จะมองเป็นคนละคอมโพเนนต์แล้ว unmount/remount เมนูทิ้ง ถ้าผู้ใช้เปิดเมนูค้างอยู่
 * พอดีจังหวะนั้นเมนูจะปิดตัวเองเงียบๆ (เทียบปัญหาเดียวกับ EditableCell ที่ ContractOverview.js)
 */
const ScheduleDropdownMenu = ({ options, isSecondaryActive }) => {
  const PrimaryIcon = options.primary.icon;
  const SecondaryIcon = options.secondary.icon;
  return (
    <DropdownMenu end className="modern-dropdown-menu">
      <Link to={options.primary.href} style={{ textDecoration: "none" }}>
        <DropdownItem className="dropdown-item-icon">
          <PrimaryIcon size={14} />
          <span>{options.primary.label}</span>
          {!isSecondaryActive && <FaCheck size={11} style={{ marginLeft: "auto", color: "#16a34a" }} />}
        </DropdownItem>
      </Link>
      <Link to={options.secondary.href} style={{ textDecoration: "none" }}>
        <DropdownItem className="dropdown-item-icon">
          <SecondaryIcon size={14} />
          <span>{options.secondary.label}</span>
          {isSecondaryActive && <FaCheck size={11} style={{ marginLeft: "auto", color: "#16a34a" }} />}
        </DropdownItem>
      </Link>
    </DropdownMenu>
  );
};

const Header = ({ toggleMobileSidebar }) => {
  const location = useLocation();
  const [user, setUser] = useState({});
  const [dropdownOpen, setDropdownOpen] = useState(false);
  // ✅ แยก state คนละตัวกับปุ่มจอกว้าง/มือถือ — ทั้งคู่มีอยู่ใน DOM พร้อมกันเสมอ (สลับด้วย CSS
  // d-none/d-lg-flex ไม่ใช่ conditional render) ถ้าใช้ state ตัวเดียวกัน เปิดปุ่มหนึ่งจะพาอีกปุ่ม
  // เปิดตามไปด้วยเวลาจอเปลี่ยนขนาดผ่าน breakpoint พอดี
  const [scheduleMenuOpenDesktop, setScheduleMenuOpenDesktop] = useState(false);
  const [scheduleMenuOpenMobile, setScheduleMenuOpenMobile] = useState(false);

  // ✅ ดึง events เองที่นี่ (แยกจากหน้า Operation) เพื่อให้กระดิ่งแจ้งเตือนเห็นได้ทุกหน้า
  // ไม่ใช่แค่ตอนเปิดหน้า Operation ค้างไว้เท่านั้น — poll ทุก 30s เหมือนหน้าอื่นๆ ในระบบ
  const [events, setEvents] = useState([]);
  // ✅ แผนงานล่วงหน้า (unscheduled) ของสัญญา — ต้องรวมด้วยตอนเช็ค "เกินกำหนดวางแผนรอบถัดไป" กัน
  // สัญญาที่จองรอบถัดไปไว้ล่วงหน้าแล้วถูกนับเป็น "เกินกำหนด" ผิดๆ (เทียบ pattern เดียวกับ
  // ContractOverview.js fetchData) — ดึงให้ทุกสิทธิ์ที่เข้าหน้า "ภาพรวมงาน" ได้ (admin/manager/technician)
  // เพราะป้ายนี้โชว์ให้ทุกคนเห็นจำนวนของตัวเองแล้ว ไม่ใช่แค่แอดมิน/manager อีกต่อไป — backend กรองข้อมูล
  // ตาม role ให้อยู่แล้ว (GET /events/drafts) ช่างจึงได้เห็นแค่จำนวนของตัวเองเท่านั้นเหมือนหน้า "ภาพรวมงาน"
  const [contractDrafts, setContractDrafts] = useState([]);

  const { userData, logout } = useAuth();
  const isAdminOrManager = can(userData, "viewAllJobs");
  // ✅ หน้า "ภาพรวมงาน" เปิดให้ช่างเข้าดูงานของตัวเองได้แล้ว (ดู ContractOverview.js canView) —
  // ปุ่มทางลัดในนี้ต้องเปิดให้ตรงกันด้วย ไม่ใช่แค่แอดมิน/manager เหมือนเดิม
  const canViewContracts = can(userData, "viewContracts");
  // ✅ ซ่อนเมนูที่ผู้ใช้กดไปแล้วไม่มีอะไรให้ทำ แทนที่จะโชว์ไว้แล้วเจอหน้าว่าง/โดนเด้งกลับ
  const canViewOperation = can(userData, "editOperation") || can(userData, "receiveDispatch");
  const isSale = isRole(userData, ROLES.SALE);
  const canViewQuotations = can(userData, "viewQuotations");
  // ✅ ทางลัด "ตารางงานช่าง" (ดูอย่างเดียว) — เซลไม่เข้าเงื่อนไข canViewOperation/canViewContracts/
  // canViewQuotations เลยสักข้อ พื้นที่กลาง header จึงว่างเปล่าทั้งจอกว้างและจอมือถือมาตลอด
  const canViewService = can(userData, "viewServiceCalendar");
  // ⚠️ ทั้งสองลิงก์ใช้ path "/event" เหมือนกัน ต่างกันแค่ query — เช็ค search แยกจาก pathname
  // ไม่งั้นจะไฮไลต์ "active" พร้อมกันทั้งคู่ไม่ว่าเซลกำลังดูปฏิทินของตัวเองหรือของช่างอยู่
  // ✅ ตัวเลือกของ dropdown "ตารางงาน" ต่างกันตาม role (ดูเหตุผลที่ scheduleOptionsFor ด้านบนไฟล์)
  const scheduleOptions = scheduleOptionsFor(isAdminOrManager);
  const isOnEventPage = location.pathname.startsWith("/event");
  const isSecondaryScheduleActive = isOnEventPage && location.search.includes(`dept=${scheduleOptions.secondary.dept}`);
  // ✅ ป้ายบนปุ่มสลับตามตัวเลือกปัจจุบันเหมือน <select> จริง — อยู่หน้าอื่นที่ไม่ใช่ปฏิทินเลยก็ยัง
  // ต้องมีค่าเริ่มต้นให้แสดง จึงเผื่อตัวเลือกหลัก (primary) ไว้เป็นค่าตั้งต้นเสมอ
  const scheduleLabel = isSecondaryScheduleActive ? scheduleOptions.secondary.label : scheduleOptions.primary.label;

  const { notifications, unread, markRead, markAllRead } = useEventNotifications(
    events,
    // ⚠️ เซลต้องเป็นสายของตัวเอง ไม่ใช่ตกไปเป็น "technician" (ดูเหตุผลใน hook)
    isSale ? "sale" : isAdminOrManager ? "admin" : "technician"
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
    if (!canViewContracts) return;
    EventService.GetDraftEvents()
      .then((res) => setContractDrafts(res?.drafts || []))
      .catch(() => {}); // เงียบไว้เหมือนกัน — แค่ป้ายสรุปจำนวน ไม่ใช่ข้อมูลหลักของหน้านี้
  }, [canViewContracts]);

  // ✅ จำนวนสัญญาที่รอบล่าสุดผ่านมาเกิน 3 เดือนแล้วแต่ยังไม่ได้วางแผนรอบถัดไป — ใช้ตรรกะเดียวกับ
  // ป้ายแจ้งเตือนในตาราง ContractOverview.js เป๊ะๆ (ดู shared/utils/contractOverdue.js) — events/contractDrafts
  // ถูกกรองตาม role มาจาก backend แล้ว (admin/manager เห็นทั้งหมด ช่างเห็นแค่ของตัวเอง) จึงคำนวณตรงๆ
  // ได้เลยไม่ต้องแยกเงื่อนไข role ที่นี่อีก
  const overdueContractCount = useMemo(
    () => (canViewContracts ? countOverdueContracts([...events, ...contractDrafts]) : 0),
    [canViewContracts, events, contractDrafts]
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
          {/* ⚠️ "การดำเนินงาน" เป็นหน้าของสายงานช่าง — เซลกดเข้าไปเห็นแต่งานที่ไม่เกี่ยวกับตัวเอง
              (server กรองให้เหลือศูนย์รายการอยู่แล้ว) จึงซ่อนไปเลยแทนที่จะให้กดแล้วเจอหน้าว่าง */}
          {canViewOperation && (
          <NavItem>
            <Link
              to="/operation"
              className={`nav-link d-flex align-items-center gap-2 ${location.pathname.startsWith("/operation") ? "active" : ""}`}
            >
              <FaWrench size={13} /> การดำเนินงาน
            </Link>
          </NavItem>
          )}
          {canViewContracts && (
            <NavItem>
              <Link
                to="/contracts"
                className={`nav-link d-flex align-items-center gap-2 ${location.pathname.startsWith("/contracts") ? "active" : ""}`}
              >
                <FaFileContract size={13} /> ภาพรวมงาน
              </Link>
            </NavItem>
          )}
          {canViewQuotations && (
          <NavItem>
            <Link
              to="/quotations"
              className={`nav-link d-flex align-items-center gap-2 ${location.pathname.startsWith("/quotations") ? "active" : ""}`}
            >
              <FaFileInvoiceDollar size={13} /> ติดตามใบเสนอราคา
            </Link>
          </NavItem>
          )}
          {/* ✅ ทางลัดตารางงาน — สลับดูได้จากปุ่มเดียว ไม่ต้องเปิด sidebar ก่อน (ของเดิมเป็นลิงก์
              ตายตัวไปทางเดียว ผู้ใช้ขอให้ทำเป็นตัวเลือกแทน) ตัวเลือกต่างกันตาม role — ดู scheduleOptionsFor
              ✅ แอดมิน/manager เห็นด้วย (canViewService ครอบคลุมทั้ง 2 role นี้อยู่แล้ว) เดิมมีแค่ลิงก์
              เดียวตายตัวเป็นของเซล พอเป็นแอดมินแล้วไม่มีอะไรให้กดในนี้เลย — ตอนนี้ได้ตัวเลือกที่ถูกต้อง
              ตรงกับที่ Sidebar.js ให้แอดมินอยู่แล้ว (ตารางงานช่าง/ตารางงานเซล) */}
          {canViewService && (
          <NavItem>
            <Dropdown isOpen={scheduleMenuOpenDesktop} toggle={() => setScheduleMenuOpenDesktop((o) => !o)}>
              <DropdownToggle
                tag="button" type="button"
                className={`nav-link d-flex align-items-center gap-2 ${isOnEventPage ? "active" : ""}`}
                style={{ background: "transparent", border: "none", fontFamily: "inherit", cursor: "pointer" }}
              >
                <FaCalendarAlt size={13} />
                <span>{scheduleLabel}</span>
                <FaChevronDown
                  size={9}
                  className={`schedule-toggle-caret ${scheduleMenuOpenDesktop ? "schedule-toggle-caret--open" : ""}`}
                />
              </DropdownToggle>
              <ScheduleDropdownMenu options={scheduleOptions} isSecondaryActive={isSecondaryScheduleActive} />
            </Dropdown>
          </NavItem>
          )}
        </Nav>

        {/* ✅ จอมือถือ: Nav ด้านบนถูกซ่อนไว้ (d-none d-lg-flex) เหลือพื้นที่ว่างกลางแถบ — ใส่ทางลัดหลัก
            ของแต่ละสายงานแทนที่จะปล่อยว่างเปล่า มีได้ทีละอันเท่านั้น (พื้นที่กลางแถบแคบเกินจะใส่ 2 อัน)
            ✅ สายบริการ (แอดมิน/manager/ช่าง) → "ภาพรวมงาน" พร้อมป้ายจำนวนสัญญาที่เกินกำหนดวางแผนรอบถัดไป
            ✅ เซล (ไม่มี canViewContracts) → "ตารางงานช่าง" แทน ไม่งั้นจะไม่มีทางลัดอะไรเลยบนจอมือถือ */}
        {canViewContracts ? (
          <Link to="/contracts" className="header-shortcut-pill d-flex d-lg-none align-items-center gap-1 mx-auto">
            <Badge
              badgeContent={overdueContractCount} color="error" max={9} overlap="circular"
              sx={{ "& .MuiBadge-badge": { fontSize: "8px", minWidth: 14, height: 14, padding: "0 3px" } }}
            >
              <FaFileContract size={12} />
            </Badge>
            <span>ภาพรวมงาน</span>
          </Link>
        ) : canViewService ? (
          <Dropdown
            isOpen={scheduleMenuOpenMobile} toggle={() => setScheduleMenuOpenMobile((o) => !o)}
            className="d-flex d-lg-none mx-auto"
          >
            <DropdownToggle
              tag="button" type="button"
              className="header-shortcut-pill d-flex align-items-center gap-1"
              style={{ fontFamily: "inherit", cursor: "pointer" }}
            >
              <FaCalendarAlt size={12} />
              <span>{scheduleLabel}</span>
              <FaChevronDown
                size={8}
                className={`schedule-toggle-caret ${scheduleMenuOpenMobile ? "schedule-toggle-caret--open" : ""}`}
              />
            </DropdownToggle>
            <ScheduleDropdownMenu options={scheduleOptions} isSecondaryActive={isSecondaryScheduleActive} />
          </Dropdown>
        ) : null}

        {/* ฝั่งขวา: แจ้งเตือน + รูปโปรไฟล์ผู้ใช้งาน + ปุ่มแฮมเบอร์เกอร์ */}
        {/* ✅ ปุ่มเปิด/ปิด push notification ย้ายไปอยู่ที่หน้า Settings แล้ว (เดิมมีทั้งที่นี่และ
            ที่ Settings ทำให้สับสนว่าอันไหนคือจุดควบคุมจริง) */}
        <div className="d-flex align-items-center gap-2">
          <NotificationBell notifications={notifications} unread={unread} onItemClick={markRead} onMarkAllRead={markAllRead} dark jobBasePath={canViewOperation ? "/operation" : "/event"} />

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
