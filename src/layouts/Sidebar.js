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

  const isTechnician = userData?.role?.toLowerCase() === "technician";
  const isAdminOrManager = ["admin", "manager"].includes(userData?.role?.toLowerCase());

  const [, setUser] = useState({});

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

  /**
   * ── โครงเมนู 4 หมวด ────────────────────────────────────────────────────────
   *   งาน        — แผนงาน (ตารางงาน/การดำเนินงาน) · ภาพรวมงาน · งานของฉัน (ช่าง)
   *   เอกสาร     — เอกสาร (ไฟล์แนบงาน / เอกสารที่ออกจากระบบ)
   *   การเงิน    — ใบเสนอราคา / การเงิน (ติดตามใบเสนอราคา / วางบิล-รับเงิน)
   *   ข้อมูลหลัก — ลูกค้า (ภาพรวม/ทะเบียน) · พนักงาน (ภาระงาน/ทะเบียน)
   *
   * ✅ ยุบจากเดิม 6 หมวด/14 เมนู เหลือ 4 หมวด/8 เมนู โดยไม่ตัดฟีเจอร์ไหนทิ้งเลย — หน้าที่เป็น
   * "ข้อมูลประเภทเดียวกัน" ถูกรวมเป็นหน้าเดียวแล้วแยกด้วยแท็บแทน (ดู *Hub.js ทั้ง 4 ไฟล์)
   * ปัญหาเดิมที่แก้: ลูกค้าอยู่ 2 ที่คนละหมวด · พนักงานอยู่ 2 ที่คนละหมวด · เอกสารกระจาย 2 หน้า ·
   * สายเงิน (เสนอราคา→วางบิล→รับเงิน) แยกอยู่ 2 หมวด · หมวด "ทีมงาน" มีลูกค้าปนอยู่ ·
   * หมวด "ADMIN MANAGEMENT" เป็นภาษาอังกฤษหมวดเดียวในเมนูที่เป็นไทยทั้งหมด
   * ⚠️ URL เดิมทุกตัวยัง redirect เข้าหน้ารวมพร้อมเปิดแท็บที่ตรงกันให้ (ดู Router.js) ลิงก์เก่าไม่พัง
   */
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
  // ✅ เมนู "แผนงานรออนุมัติ" ถูกตัดออกตามที่ผู้ใช้ขอ — ย้ายไปเป็นแท็บ "รออนุมัติ" ในหน้า "การดำเนินงาน"
  // แทน (ดู PendingApprovalsPanel.js) เพราะเป็นงานเดียวกันกับการไล่จัดการงานในหน้านั้น ไม่ต้องสลับหน้า
  // ไปมา และมี badge บอกจำนวนงานค้างบนแท็บให้เห็นตั้งแต่เข้าหน้ามาแล้ว
  const workMenuManager = [
    { title: "ภาพรวมงาน", href: "/contracts", icon: <FaFileContract /> },
  ];
  // ✅ เดิมประกาศไว้แต่ไม่เคย render เลย — ช่างจึงไม่มีทางกดเข้า "งานของฉัน" จาก sidebar ได้เลย
  // ✅ "ภาพรวมงาน" เดิมเฉพาะแอดมิน/manager (ดู workMenuManager ด้านบน) ตอนนี้ช่างเข้าดูได้ด้วย
  // (เห็นแค่งานของตัวเอง แก้ไขไม่ได้ — ดู ContractOverview.js) เลยเพิ่มเป็นทางลัดให้ตรงนี้ด้วย
  const workMenuTechnician = [
    { title: "งานของฉัน", href: "/technician/jobs", icon: <FaClipboardList /> },
    { title: "ภาพรวมงาน", href: "/contracts", icon: <FaFileContract /> },
  ];

  // ✅ หมวด "เอกสาร" — ยุบ "เอกสารทั้งหมด" (ไฟล์แนบงาน) + "ทะเบียนเอกสาร" (ใบที่ระบบออก) เหลือหน้าเดียว
  // แยกด้วยแท็บ เพราะคนที่มาหาเอกสารไม่ได้แยกในหัวว่าไฟล์นั้นมาจากไหน รู้แค่ว่า "หาเอกสารของงานนี้"
  // (ดู DocumentsHub.js) — เห็นได้ทุก role เหมือนเดิมทั้งคู่
  const documentsMenu = [
    { title: "เอกสาร", href: "/documents", icon: <FaFileAlt /> },
  ];

  // ✅ หมวดการเงิน — ยุบ "ติดตามใบเสนอราคา" + "วางบิล/รับเงิน" เหลือหน้าเดียว เพราะเป็นคนละช่วงของ
  // สายงานเดียวกัน (เสนอราคา → ทำงาน → วางบิล → รับเงิน) คนที่ตามเรื่องเงินของงานหนึ่งต้องดูทั้ง 2 ฝั่ง
  // 🐛 ที่แก้ไปด้วย: เดิม "ติดตามใบเสนอราคา" ถูกโชว์ให้ช่างเห็น แต่ตัวหน้า redirect ช่างออกทันทีที่กด
  // = เมนูที่กดแล้วเด้งทิ้งทุกครั้ง ตอนนี้อยู่ใต้เงื่อนไข isAdminOrManager ตรงกับสิทธิ์จริงของหน้าแล้ว
  const financeMenu = [
    { title: "ใบเสนอราคา / การเงิน", href: "/finance", icon: <FaFileInvoiceDollar /> },
  ];

  // ✅ หมวด "ข้อมูลหลัก" — แทนหมวด "ทีมงาน" เดิมที่มีลูกค้าปนอยู่ (ผิดความหมาย) และแทน
  // "ADMIN MANAGEMENT" ท้ายเมนูที่เป็นภาษาอังกฤษปนอยู่หมวดเดียวในแอปที่เป็นไทยทั้งหมด
  // ✅ แต่ละรายการยุบ "ภาพรวม + ทะเบียน" ของเอนทิตีเดียวกันไว้ในหน้าเดียว (ดู CustomerHub/StaffHub)
  // เดิมลูกค้าอยู่ 2 ที่คนละหมวด พนักงานก็อยู่ 2 ที่คนละหมวด ต้องจำว่าเรื่องเดียวกันอยู่ตรงไหนบ้าง
  const masterDataMenu = [
    { title: "ลูกค้า", href: "/customers", icon: <FaBuilding /> },
    { title: "พนักงาน / ทีมช่าง", href: "/staff", icon: <FaUserFriends /> },
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

          {/* หมวด "เอกสาร" — หน้าเดียวมี 2 แท็บ (ไฟล์แนบงาน / เอกสารที่ออกจากระบบ) เห็นได้ทุก role */}
          <div className="admin-divider-label">เอกสาร</div>
          {documentsMenu.map((item, idx) => renderLink(item, `doc-${idx}`))}

          {/* ✅ เห็นได้ทุก role แล้ว — ช่างต้องเข้าไปติดตามใบเสนอราคา/อัปเดตการวางบิลของงานตัวเองได้
              (ตามที่ผู้ใช้ระบุ) ⚠️ ไม่ได้แปลว่าเห็นข้อมูลการเงินของทั้งบริษัท: ฝั่ง server คืนเฉพาะงานที่
              ผู้ใช้คนนั้นมีชื่ออยู่ (GET /event-op) และเช็คสิทธิ์รายงานซ้ำทุกครั้งที่บันทึก
              (requireEventFinanceAccess) — การซ่อนเมนูไม่เคยเป็นด่านความปลอดภัยอยู่แล้ว */}
          <div className="admin-divider-label">การเงิน</div>
          {financeMenu.map((item, idx) => renderLink(item, `fin-${idx}`))}

          {/* ✅ หมวด "ข้อมูลหลัก" — ทะเบียนกลางของระบบ (ลูกค้า/พนักงาน) ที่ทุกหน้าอื่นอ้างอิงถึง
              เฉพาะแอดมิน/manager (แท็บ "ทะเบียน" ข้างในจำกัดเฉพาะ admin อีกชั้น ตรงกับสิทธิ์เดิม) */}
          {isAdminOrManager && (
            <>
              <div className="admin-divider-label">ข้อมูลหลัก</div>
              {masterDataMenu.map((item, idx) => renderLink(item, `md-${idx}`))}
            </>
          )}
        </Nav>
      </div>

      {/* ด้านล่างสุด: กลุ่มปุ่มตั้งค่าแอดมินและปุ่มออกจากระบบ */}
      <div className="sidebar-fixed-bottom">
        <Nav vertical>
          {/* ✅ หมวด "ADMIN MANAGEMENT" ถูกยุบทิ้งแล้ว — Customer/Employee ย้ายไปรวมกับหน้า "ภาพรวม"
              ของเอนทิตีเดียวกันในหมวด "ข้อมูลหลัก" ด้านบน (ดู masterDataMenu)
              เดิมหมวดนี้เป็นภาษาอังกฤษหมวดเดียวในเมนูที่เป็นไทยทั้งหมด และแยกทะเบียนลูกค้า/พนักงาน
              ออกจากหน้าภาพรวมของตัวเองไปอยู่คนละมุมของเมนู ทั้งที่เป็นข้อมูลชุดเดียวกัน */}

          {/* ✅ ทุกสิทธิ์ (รวมช่าง) เข้าหน้าตั้งค่าได้ — ตัวหน้า Settings.js เองเป็นคนซ่อน
              ส่วน "การจัดการระบบ" ไว้เฉพาะแอดมินอีกชั้นหนึ่งอยู่แล้ว */}
          <NavItem>
            <Link
              to="/about"
              title="ตั้งค่า"
              className={`nav-link ${location.pathname === "/about" ? "active" : ""}`}
              onClick={handleItemClick}
            >
              <span className="nav-icon"><FaCog /></span>
              <span className="nav-text">ตั้งค่า</span>
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
