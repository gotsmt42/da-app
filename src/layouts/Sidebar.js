import { useState, useEffect } from "react";
import { Nav, NavItem, Collapse } from "reactstrap";
import { Link, useLocation } from "react-router-dom";
import AuthService from "../shared/services/authService";
import "./Sidebar.css";
import Swal from "sweetalert2";
import { swalLogout, hasValidAvatar } from "../shared/utils/user";
import { useAuth } from "../features/auth/AuthContext";
import { can, isRole, roleLabel, ROLES } from "@/shared/utils/roles";
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
  FaPaperPlane,
  FaClipboardCheck,
  FaCog,
  FaSignOutAlt,  FaWrench,
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

  const isTechnician = isRole(userData, ROLES.TECHNICIAN);
  const isAdminOrManager = can(userData, "manageMasterData");
  // ✅ เมนูฝ่ายขาย — เห็นเฉพาะคนที่ทำแผนงานขายได้จริง (เซล + หัวหน้า)
  const canSell = can(userData, "createSalesPlan");
  const isSaleUser = isRole(userData, ROLES.SALE);
  const canViewFinance = can(userData, "viewFinance");
  // ✅ คิวจ่ายงาน — เห็นเฉพาะคนที่มอบหมายงานได้จริง (ไม่งั้นกดเข้าไปก็เด้งออก)
  const canAssign = can(userData, "assignDispatch");
  // ✅ หมวด "งาน" (ตารางงาน/การดำเนินงาน) เป็นของสายบริการ — เซลกดเข้าไปเห็นแต่งานที่ไม่เกี่ยวกับ
  // ตัวเอง (server กรองเหลือศูนย์รายการอยู่แล้ว) ซ่อนไปเลยดีกว่าให้กดแล้วเจอหน้าว่าง
  // ⚠️ ใช้เกณฑ์เดียวกับ Header.js เป๊ะๆ — เมนูสองที่นี้ต้องโผล่/หายพร้อมกันเสมอ
  const canViewOperation = can(userData, "editOperation") || can(userData, "receiveDispatch");
  // ✅ ใครลงแผนงานได้ ต้องเห็นเมนูแผนงาน — เซลลงแผนงานของตัวเองด้วยฟอร์ม/ปฏิทินชุดเดียวกับช่าง
  // (ข้อมูลถูกกรองด้วย department ที่ server แล้ว จึงไม่มีทางเห็นงานของอีกฝ่าย)
  const canPlanWork = canViewOperation || canSell || isTechnician || isAdminOrManager;
  // มีอะไรอยู่ในหมวด "งาน" บ้างไหม — ใช้ตัดสินว่าจะโชว์หัวข้อหมวดหรือไม่
  const hasWorkMenu = canPlanWork || canAssign;

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
  // ⚠️ "การดำเนินงาน" เป็นหน้าของสายงานช่างล้วนๆ (เอกสาร 4 ชนิด/เช็คอิน/คำขอปิดงาน) — เซลไม่ต้องเห็น
  // ✅ เหลือรายการเดียวสำหรับเซล = ไม่ต้องมีเมนูย่อยเลย กดชื่อหมวดแล้วเข้าปฏิทินตรงๆ
  // (เมนูย่อยที่มีลูกเดียวคือชั้นที่ต้องกดเปิดก่อนโดยไม่ได้ให้ทางเลือกอะไร)
  /**
   * ✅ แยกเมนู "ตารางงานช่าง" กับ "ตารางงานเซล" ตามที่ผู้ใช้สั่ง
   * ⚠️ ทั้งสองเป็นปฏิทินตัวเดียวกัน ต่างกันแค่ ?dept= — ไม่ได้ทำหน้าใหม่ซ้ำอีกชุด เพราะฟีเจอร์
   * ทั้งหมด (ลากงาน/แผงงานล่วงหน้า/ตัวกรอง) ต้องใช้ได้เหมือนกันทั้งสองแผนก
   * ⚠️ เฉพาะแอดมิน/ผู้จัดการที่เห็นทั้งสองเมนู — ช่างกับเซลเห็นของตัวเองอย่างเดียว และ
   * ฝั่ง server ปฏิเสธการข้ามแผนกของ role อื่นอยู่แล้ว (departmentScope) เมนูนี้จึงไม่ใช่ด่านกัน
   */
  /**
   * ── ปฏิทิน ────────────────────────────────────────────────────────────
   * ✅ แอดมิน/ผู้จัดการเห็น 2 ปฏิทินแยกกัน: "ตารางงานช่าง" กับ "ตารางงานเซล"
   * ⚠️ เป็นหน้าเดียวกัน ต่างกันแค่ ?dept= — ไม่ได้ทำหน้าใหม่ซ้ำอีกชุด เพราะฟีเจอร์ทั้งหมด
   * (ลากงาน/แผงงานล่วงหน้า/ตัวกรอง) ต้องใช้ได้เหมือนกันทั้งสองแผนก
   * ⚠️ role อื่นเห็นปฏิทินของตัวเองอันเดียว และ server ปฏิเสธการข้ามแผนกอยู่แล้ว
   * (departmentScope) เมนูนี้จึงไม่ใช่ด่านกัน
   */
  const workMenu = isAdminOrManager
    ? [{
        title: "แผนงาน",
        href: "/event",
        icon: <FaCalendarAlt />,
        items: [
          { title: "ตารางงานช่าง", href: "/event" },
          { title: "ตารางงานเซล", href: "/event?dept=sales" },
        ],
      }]
    : [{ title: canViewOperation ? "ตารางงาน" : "แผนงานของฉัน", href: "/event", icon: <FaCalendarAlt /> }];

  // ✅ "การดำเนินงาน" แยกออกมาเป็นเมนูระดับบนสุดตามที่ผู้ใช้สั่ง — เดิมซ่อนอยู่ในเมนูย่อยของ
  // "แผนงาน" ทั้งที่เป็นหน้าที่ใช้บ่อยที่สุดของฝ่ายช่าง (ไล่จัดการงานทีละใบ) และเป็นคนละเรื่องกับ
  // ปฏิทิน (ปฏิทิน = วางแผนว่าจะไปวันไหน · การดำเนินงาน = ตามงานที่ลงตารางแล้ว)
  const operationMenu = [
    { title: "การดำเนินงาน", href: "/operation", icon: <FaWrench /> },
  ];
  // ✅ เมนู "แผนงานรออนุมัติ" ถูกตัดออกตามที่ผู้ใช้ขอ — ย้ายไปเป็นแท็บ "รออนุมัติ" ในหน้า "การดำเนินงาน"
  // แทน (ดู PendingApprovalsPanel.js) เพราะเป็นงานเดียวกันกับการไล่จัดการงานในหน้านั้น ไม่ต้องสลับหน้า
  // ไปมา และมี badge บอกจำนวนงานค้างบนแท็บให้เห็นตั้งแต่เข้าหน้ามาแล้ว
  const workMenuManager = [
    { title: "ภาพรวมงาน", href: "/contracts", icon: <FaFileContract /> },
  ];
  // ✅ หมวด "งานขาย" — เหลือรายการเดียวคือฟอร์มแจ้งงานข้ามแผนก
  // ⚠️ แผนงานของเซล **ไม่ได้อยู่ในหมวดนี้** แต่อยู่ในหมวด "งาน" ร่วมกับช่าง เพราะเป็นระบบเดียวกันจริงๆ
  // (ฟอร์มเดียวกัน ปฏิทินเดียวกัน) — สิ่งที่แยกคือ *ข้อมูลที่มองเห็น* ซึ่งกรองด้วย department ที่ server
  // ไม่ใช่แยกด้วยเมนูคนละอัน การมีเมนูซ้ำสองชุดจะทำให้ต้องดูแลหน้าจอ 2 ชุดตลอดไปโดยไม่ได้อะไรเพิ่ม
  const salesMenu = [
    // ✅ ที่แก้ (ผู้ใช้ขอ: "ปรับปรุง icon ให้สอดคล้องกับแถบ ให้มืออาชีพ"): เดิมใช้ FaChartLine
    // (ไอคอนกราฟเส้น) ซึ่งสื่อถึง "ยอด/สถิติ" ไม่ใช่ "ส่งคำของานให้ช่าง" ทั้งที่เมนูนี้ไม่มีกราฟอะไรเลย
    // เปลี่ยนเป็นไอคอนกระดาษเครื่องบิน (ส่ง/แจ้งออกไป) ให้ตรงกับคำว่า "แจ้ง" จริงๆ และแยกจาก
    // FaClipboardCheck ของฝั่งแอดมิน ("คำขอลงงาน") ชัดเจน — คนละบทบาทกัน ไม่ควรใช้ไอคอนหน้าตาคล้ายกัน
    { title: "แจ้งงานให้ช่าง", href: "/sales", icon: <FaPaperPlane /> },
  ];
  // ⚠️ อยู่หมวด "งาน" ไม่ใช่ "งานขาย" — เป็นคิวของฝ่ายบริการ ไม่ใช่ของฝ่ายขาย
  // 🧹 เดิมชื่อ "ใบมอบหมายงาน" ซึ่งเป็นคำที่มองจากฝั่งคนจ่ายงาน ทั้งที่ของในคิวคือ "คำขอ"
  // ที่ยังไม่ได้ตัดสินใจ — ยังไม่เป็นใบมอบหมายจนกว่าจะอนุมัติ
  const dispatchMenu = [
    { title: "คำขอลงงาน", href: "/dispatch", icon: <FaClipboardCheck /> },
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
  /**
   * เมนูนี้ตรงกับหน้าที่เปิดอยู่ไหม
   *
   * 🐛 ที่แก้: เดิมเทียบแค่ pathname — พอมี "ตารางงานช่าง" (/event) กับ "ตารางงานเซล"
   * (/event?dept=sales) ทั้งคู่ pathname เป็น /event เหมือนกัน ผลคือเมนูช่างขึ้น active ค้าง
   * แม้กำลังดูปฏิทินเซลอยู่ และแยกไม่ออกว่าตอนนี้อยู่ที่ไหน
   * ⚠️ เมนูที่ไม่มี query ต้องตรงกับหน้าที่ไม่มี query เท่านั้น ไม่งั้น /event จะ active พร้อมกัน
   * ทั้งสองอันตอนเปิด /event?dept=sales
   */
  const isActiveHref = (href) => {
    if (!href) return false;
    const [path, query = ""] = href.split("?");
    if (location.pathname !== path) return false;
    const current = location.search.replace(/^\?/, "");
    return query ? current === query : current === "";
  };

  const isParentActive = (navi) => navi.items?.some((item) => isActiveHref(item.href));
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
        className={`nav-link ${isActiveHref(item.href) ? "active" : ""}`}
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
          className={`nav-link ${isParentActive(navi) || isActiveHref(navi.href) ? "active" : ""}`}
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
                  className={`nav-link submenu-link ${isActiveHref(item.href) ? "active" : ""}`}
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
            {/* ⚠️ ห้ามโชว์ค่าดิบ ("sale"/"technician") ให้ผู้ใช้เห็น — ทั้งแอปเป็นภาษาไทย */}
            <span className="user-role-badge">{roleLabel(userData)}</span>
          </div>
        </div>
      </div>

      {/* ตรงกลาง: รายการเมนูหลัก — จัดหมวดใหม่เป็น งาน/เอกสาร/ทีมงาน ให้ตรงความหมายจริง */}
      <div className="sidebar-content">
        <Nav vertical className="sidebarNav">
          {navigation.map((item, idx) => renderLink(item, `nav-${idx}`))}

          {/* หมวด "งาน" — แผนงาน/ปฏิทิน + ภาพรวมสัญญา (admin/manager) + งานของฉัน (ช่าง)
              ⚠️ หัวข้อหมวดต้องหายไปพร้อมกับเมนูข้างใต้ — ไม่งั้นเซล (ซึ่งไม่มีเมนูในหมวดนี้เลย)
              จะเห็นคำว่า "งาน" ลอยอยู่เฉยๆ โดยไม่มีอะไรอยู่ใต้มัน */}
          {hasWorkMenu && <div className="admin-divider-label">งาน</div>}
          {/* ⚠️ เมนูที่ไม่มีลูก (เซล — เหลือแค่ปฏิทิน) ต้อง render เป็นลิงก์ธรรมดา
              🐛 renderParentWithItems เรียก navi.items.map() ตรงๆ ถ้าไม่มี items จะพังทั้งแอป
              (จอขาว) เพราะ Sidebar อยู่ในทุกหน้า */}
          {canPlanWork && workMenu.map((navi, index) => (
            navi.items?.length
              ? renderParentWithItems(navi, `work-${index}`)
              : renderLink(navi, `work-${index}`)
          ))}
          {canViewOperation && operationMenu.map((item, idx) => renderLink(item, `work-op-${idx}`))}
          {isAdminOrManager && workMenuManager.map((item, idx) => renderLink(item, `work-mgr-${idx}`))}
          {isTechnician && workMenuTechnician.map((item, idx) => renderLink(item, `work-tech-${idx}`))}
          {canAssign && dispatchMenu.map((item, idx) => renderLink(item, `work-dispatch-${idx}`))}

          {/* หมวด "งานขาย"
              ✅ ที่แก้ (ผู้ใช้ขอ: "เบื้องต้นแถบนี้ให้เฉพาะเซล ที่เข้าได้") — เดิมเงื่อนไข canSell
              (สิทธิ์ createSalesPlan) ให้แอดมิน/หัวหน้าเห็นเมนูนี้ด้วย เพราะมีสิทธิ์ลงแผนงานขายแทนเซล
              ได้ในทางเทคนิค แต่ผู้ใช้ต้องการให้แถบนี้บนเมนูโผล่เฉพาะ role "เซล" เท่านั้นไปก่อน —
              ⚠️ จำกัดแค่การมองเห็นเมนูนี้เท่านั้น ไม่ได้แตะสิทธิ์ระดับ route/API (JobRequests.js ยังเช็ค
              can("requestDispatch") ของตัวเองอยู่) แอดมิน/หัวหน้ายังเข้าหน้า /sales ได้ถ้าพิมพ์ URL เอง
              แค่ไม่เห็นทางลัดในเมนูซ้าย */}
          {isSaleUser && (
            <>
              <div className="admin-divider-label">งานขาย</div>
              {salesMenu.map((item, idx) => renderLink(item, `sales-${idx}`))}
            </>
          )}

          {/* หมวด "เอกสาร" — ไฟล์แนบงาน / เอกสารที่ออกจากระบบ
              ⚠️ ทั้งสองแท็บเป็นเอกสารของ *งานช่าง* ล้วนๆ (ใบเสนอราคา/รายงาน/ใบวางบิล/ใบส่งมอบงาน
              ที่ผูกกับแผนงาน) — เซลเปิดเข้าไปเจอแต่เอกสารของคนอื่น จึงซ่อนตามที่ผู้ใช้สั่ง */}
          {!isSaleUser && (
            <>
              <div className="admin-divider-label">เอกสาร</div>
              {documentsMenu.map((item, idx) => renderLink(item, `doc-${idx}`))}
            </>
          )}

          {/* ✅ เห็นได้ทุก role แล้ว — ช่างต้องเข้าไปติดตามใบเสนอราคา/อัปเดตการวางบิลของงานตัวเองได้
              (ตามที่ผู้ใช้ระบุ) ⚠️ ไม่ได้แปลว่าเห็นข้อมูลการเงินของทั้งบริษัท: ฝั่ง server คืนเฉพาะงานที่
              ผู้ใช้คนนั้นมีชื่ออยู่ (GET /event-op) และเช็คสิทธิ์รายงานซ้ำทุกครั้งที่บันทึก
              (requireEventFinanceAccess) — การซ่อนเมนูไม่เคยเป็นด่านความปลอดภัยอยู่แล้ว */}
          {canViewFinance && (
            <>
              <div className="admin-divider-label">การเงิน</div>
              {financeMenu.map((item, idx) => renderLink(item, `fin-${idx}`))}
            </>
          )}

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
