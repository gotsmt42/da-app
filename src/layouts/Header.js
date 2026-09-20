import { useState, useEffect } from "react";
import useRealtime from "@/shared/realtime/useRealtime";
import { Link, useLocation } from "react-router-dom";
import AuthService from "../shared/services/authService";
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
import { hasValidAvatar } from "../shared/utils/user";
import useAppBadges from "@/shared/hooks/useAppBadges";
import useOrgSettings from "@/shared/hooks/useOrgSettings";
// ✅ โลโก้แอปต้องเลือกไฟล์ให้ตรงกับพื้น — หัวเว็บเป็นแถบเข้ม จึงใช้ตัวหนังสือสีขาว
import { appLogoFor } from "@/shared/services/OrgSettingService";
// ✅ ไอคอน 3 เมนูกลางตรงกับที่ Dashboard.js/Sidebar.js ใช้จริงสำหรับหน้าเดียวกันเป๊ะๆ
// (FaWrench="การดำเนินงาน", FaFileContract="ภาพรวมสัญญา", FaFileInvoiceDollar="ติดตามใบเสนอราคา")
import {
  FaBars, FaUserCircle, FaWrench, FaFileContract, FaFileInvoiceDollar, FaCalendarAlt,
  FaChevronDown, FaCheck, FaBriefcase,
} from "react-icons/fa";
import { can, isRole, ROLES, DEPARTMENT, rankLabel } from "@/shared/utils/roles";

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

/**
 * ป้ายตัวเลขเล็กๆ ท้ายเมนูบนแถบบน (จอกว้าง)
 * ⚠️ ต้องอยู่ module scope — ประกาศซ้อนในตัว Header จะได้ component ชนิดใหม่ทุกครั้งที่ข้อมูลแจ้งเตือน
 * เข้ามา (ทุก 30 วิ) React ถอดของเดิมทิ้งแล้วสร้างใหม่ทั้งแถบโดยไม่จำเป็น
 */
const HeaderCount = ({ n }) => {
  const count = Number(n) || 0;
  if (!count) return null;
  return <span className="header-nav-count">{count > 99 ? "99+" : count}</span>;
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

  // ✅ events/แผนงานล่วงหน้า มาจาก store กลาง (shared/hooks/useAppBadges.js) ซึ่ง poll ให้ทุก 30 วิ
  // 🐛 ที่แก้: เดิม Header ดึง /event-op เองอีกชุดหนึ่ง (~150 kB ทุก 30 วิ) พอเมนูอื่นเริ่มมีป้ายตัวเลข
  // ที่ต้องใช้ข้อมูลชุดเดียวกัน จะกลายเป็นดึงซ้ำหลายรอบต่อหนึ่งนาที — ตอนนี้ทั้งแอปดึงก้อนเดียวแล้วแจกกัน
  // ⚠️ ตัวเลขบนป้ายทุกจุด (เมนูข้าง/เมนูหลักหน้าแรก/แถบล่างมือถือ/ตรงนี้) จึงมาจากชุดข้อมูลเดียวกันเสมอ
  const { userData } = useAuth();
  const { events, badges } = useAppBadges(userData);
  const org = useOrgSettings();
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

  /**
   * กลางแถบบนของ "จอมือถือ" เหลือได้แค่ทางลัดตารางงานของเซลเท่านั้น
   *
   * 🐛 ที่แก้ (ผู้ใช้แจ้ง "โดนทับแล้ว"): เดิมมีชิป "ชื่อหน้าที่เปิดอยู่" อยู่ตรงกลางด้วย
   * พอโลโก้แอปเปลี่ยนเป็นแบบมีชื่อกำกับ (กว้างขึ้นมาก) พื้นที่ตรงกลางไม่พอ ชิปเลยไปทับกับโลโก้
   * ✅ ตัดชิปชื่อหน้าออก — ชื่อหน้าอยู่บนหัวของแต่ละหน้าและบนแท็บเบราว์เซอร์อยู่แล้ว ไม่ได้หายไปไหน
   * ⚠️ ทางลัดของเซลยังอยู่ เพราะเป็น "ปุ่มที่กดไปไหนได้" ไม่ใช่ป้ายบอกชื่อเฉยๆ
   */
  const hasScheduleShortcut = !canViewContracts && canViewService;

  const { notifications, unread, markRead, markAllRead } = useEventNotifications(
    events,
    // ⚠️ เซลต้องเป็นสายของตัวเอง ไม่ใช่ตกไปเป็น "technician" (ดูเหตุผลใน hook)
    isSale ? "sale" : isAdminOrManager ? "admin" : "technician"
  );

  // ✅ รูป/ชื่อบนหัวเว็บ อัปเดตทันทีเมื่อข้อมูลผู้ใช้เปลี่ยน (เรียลไทม์)
  const [userLiveKey, setUserLiveKey] = useState(0);
  useRealtime("users", () => setUserLiveKey((k) => k + 1));

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
  }, [userLiveKey]);

  // ✅ จำนวนสัญญาที่ถึง/เลยเดือนที่ต้องเข้ารอบถัดไปแล้วแต่ยังไม่ได้วางแผน — คำนวณด้วยตรรกะเดียวกับ
  // ป้ายในตาราง ContractOverview.js (shared/utils/contractOverdue.js) ผ่าน store กลาง
  const overdueContractCount = canViewContracts ? badges.contracts : 0;

  const toggle = () => setDropdownOpen((prevState) => !prevState);

  const initials = (userData?.fname?.charAt(0) || userData?.username?.charAt(0) || "U").toUpperCase();

  return (
    <Navbar dark expand="md" className="fix-header">
      <div className="d-flex align-items-center justify-content-between w-100">

        {/* ฝั่งซ้าย: โลโก้แบรนด์ */}
        <NavbarBrand tag={Link} to="/dashboard" className="m-0">
          <div className="gradiant-bg">
            {/* ✅ โลโก้ตั้งค่าเองได้จากหน้าตั้งค่าองค์กร (ว่าง = ใช้ไฟล์ที่ติดมากับแอป) */}
            {/* ⚠️ ใช้ชุดเต็ม (เครื่องหมาย + ชื่อแอป + บรรทัดไทย) ทุกขนาดจอ — ผู้ใช้ยืนยันว่าเอาแบบนี้
                เคยลองย่อเหลือเฉพาะเครื่องหมายบนมือถือแล้วจำไม่ได้ว่าแอปอะไร
                ที่ให้พอดีจอมือถือคุมด้วย CSS (.logo ใน Header.css) ไม่ใช่สลับไฟล์ */}
            <img src={appLogoFor({ on: "dark" }, org)} alt="Logo" className="logo" />
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
              <HeaderCount n={badges.closeRequests} />
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
                <HeaderCount n={overdueContractCount} />
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
              <HeaderCount n={badges.quotations} />
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
                <HeaderCount n={badges.pendingApproval} />
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

        {/* ── กลางแถบบน เฉพาะจอมือถือ (Nav ด้านบนเป็น d-none d-lg-flex จึงว่างทั้งแถบ) ──────────
            🧹 เดิมตรงนี้เป็นชิป "ภาพรวมงาน" — ตัดออกตามที่ผู้ใช้สั่ง เพราะซ้ำกับช่อง "ภาพรวมงาน" บน
               แถบเมนูล่าง (ปลายทางเดียวกัน ป้ายตัวเลขเดียวกัน ห่างกันแค่ครึ่งจอ)
            ✅ แล้วใส่ "ชื่อหน้าที่เปิดอยู่" แทนที่ช่องว่างนั้น (ผู้ใช้: "แถบ header ในมือถือควรใส่อะไร
               ให้ไม่โล่ง") — เป็นป้ายบอกตำแหน่ง ไม่ใช่ปุ่ม จึงไม่เพิ่มทางเข้าซ้ำให้รกเหมือนเดิม
               และอุดช่องโหว่จริง: แถบล่างไฮไลต์ได้แค่ 5 ปลายทาง หน้าอื่นเปิดแล้วไม่มีอะไรบอกว่าอยู่ไหน
            ⚠️ เซลได้ทางลัด "ตารางงาน" เหมือนเดิม (มาก่อนชื่อหน้า) — เซลไม่มีทางลัดอื่นบนแถบบนเลย
            ⚠️ แถบบนของจอคอมไม่ถูกแตะเลย ทั้งสองอย่างเป็น d-lg-none (ผู้ใช้ขอให้จอคอมคงเดิม) */}
        {hasScheduleShortcut ? (
          <Dropdown
            isOpen={scheduleMenuOpenMobile} toggle={() => setScheduleMenuOpenMobile((o) => !o)}
            className="d-flex d-lg-none mx-auto"
          >
            <DropdownToggle
              tag="button" type="button"
              className="header-shortcut-pill d-flex align-items-center gap-1"
              /* ⚠️ จอมือถือซ่อนตัวหนังสือในพิลล์เพื่อเปิดที่ให้ชื่อแอป — ต้องมี title/aria กำกับไว้
                 ไม่งั้นเหลือไอคอนปฏิทินเปล่าๆ ที่เดาไม่ออกว่ากดแล้วไปไหน */
              title={scheduleLabel}
              aria-label={scheduleLabel}
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

        {/* ฝั่งขวา: แจ้งเตือน + รูปโปรไฟล์ผู้ใช้งาน + ปุ่มแฮมเบอร์เกอร์
            ✅ ปุ่มเปิด/ปิด push notification ย้ายไปอยู่ที่หน้า Settings แล้ว (เดิมมีทั้งที่นี่และ
               ที่ Settings ทำให้สับสนว่าอันไหนคือจุดควบคุมจริง)
            ✅ จอมือถือเหลือแค่ "กระดิ่ง + ปุ่มเมนู" สองปุ่ม (ผู้ใช้สั่งตัดรูปโปรไฟล์ออก)
            ⚠️ ไม่ได้เสียทางเข้าอะไรเลย — ลิ้นชักเมนูมีการ์ดโปรไฟล์ที่กดไป /account ได้
               และมีปุ่ม LOGOUT อยู่ล่างสุด (ดู Sidebar.js) ห่างกันแค่แตะเดียว
            ⚠️ จงใจไม่เติมปุ่มใหม่แทนที่ เช่นไอคอนค้นหา — แอปยังไม่มี "ค้นหารวม" มีแต่ช่องค้นหา
               แยกในแต่ละหน้า ปุ่มที่กดแล้วไม่รู้จะไปไหนรกกว่าช่องว่าง ที่ว่างคืนให้ป้ายทางลัดแทน */}
        <div className="d-flex align-items-center gap-2">
          <NotificationBell notifications={notifications} unread={unread} onItemClick={markRead} onMarkAllRead={markAllRead} dark jobBasePath={canViewOperation ? "/operation" : "/event"} />

          <div className="profile-img d-none d-lg-block">
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
                    {/* ⚠️ ห้ามโชว์ค่าดิบอย่าง "admin" — ผู้ใช้เห็นชื่อสิทธิ์ภาษาไทยเท่านั้น (roles.js) */}
                    <span className="dropdown-user-role">{rankLabel(userData)}</span>
                  </div>
                </div>
                <DropdownItem divider />
                {/* ⚠️ เดิมมีเมนู "Logout" ต่อท้ายตรงนี้ — ย้ายไปไว้ที่ท้ายหน้าตั้งค่าที่เดียว
                    ตามที่ผู้ใช้สั่งว่าให้เหลือจุดออกจากระบบแค่จุดเดียว */}
                <Link to={"/account"} style={{ textDecoration: "none" }}>
                  <DropdownItem className="dropdown-item-icon">
                    <FaUserCircle size={14} /> บัญชีของฉัน
                  </DropdownItem>
                </Link>
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
