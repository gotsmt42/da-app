import { useState } from "react";
import { Nav, NavItem, Collapse } from "reactstrap";
import { Link, useLocation } from "react-router-dom";
import "./MobileNav.css";
import Swal from "sweetalert2";
import { swalLogout, hasValidAvatar } from "../shared/utils/user";
import { useAuth } from "../features/auth/AuthContext";
import { roleLabel } from "@/shared/utils/roles";
import { buildNavGroups, isActiveHref, isGroupActive } from "./navConfig";
import { FaCog, FaSignOutAlt } from "react-icons/fa";

/**
 * MobileNav — แผงเมนูแบบเลื่อนเข้า/ออกที่โผล่เฉพาะจอมือถือ (แทนที่ Sidebar.js เดิมที่เคยเป็นแถบข้าง
 * ถาวรทั้งจอคอมและมือถือ)
 *
 * ✅ ที่มา (ผู้ใช้ขอ: "ตัด Sidebar ออก...ปรับปรุง UI ใหม่"): จอคอมย้ายเมนูทั้งหมดไปเป็น dropdown บน
 * แถบบนแล้ว (ดู Header.js + navConfig.js) ไม่มีแถบข้างเหลืออยู่เลย — แต่จอมือถือแคบเกินกว่าจะใส่
 * เมนู 6 หมวดในแถบบนแนวนอนได้ ยังต้องมีที่ "เก็บ" เมนูทั้งหมดไว้กดเปิดดูอยู่ดี (เว็บอ้างอิงเองก็ต้อง
 * ทำแบบนี้เช่นกันถ้าเทียบกับจอมือถือจริง — ภาพตัวอย่างที่ผู้ใช้ส่งมาเป็นจอกว้างเท่านั้น) — ต่างจาก
 * Sidebar.js เดิมตรงที่นี่เป็นแผง "ลอยชั่วคราว" เปิดเฉพาะตอนกดปุ่มแฮมเบอร์เกอร์เท่านั้น ไม่ใช่แถบถาวร
 * ที่กินพื้นที่จอตลอดเวลาเหมือนเดิมอีกต่อไป (ปิดอัตโนมัติทันทีที่กดลิงก์/แตะนอกกรอบ/ปัดลง/เลื่อนจอ —
 * กลไกเดิมทั้งหมดจาก FullLayout.js ยังใช้ต่อเหมือนเดิมทุกประการ ไม่ได้แตะ)
 *
 * ✅ ใช้ buildNavGroups เดียวกับ Header.js เป๊ะ — เมนูที่เห็นในนี้จึงตรงกับ dropdown บนแถบบนของจอคอม
 * เสมอ ไม่มีทางหลุดไม่ตรงกันได้อีก (ต่างจากเดิมที่ Header.js/Sidebar.js ต่างคนต่างมีชุดเมนู/เงื่อนไข
 * สิทธิ์ของตัวเอง)
 * ⚠️ ไม่มีโหมด "ย่อเหลือไอคอน" อีกต่อไป (ตัด isCollapsed/renderParentWithItems ทิ้งทั้งหมด) — ไม่มี
 * แถบถาวรบนจอคอมให้ย่อแล้ว จึงไม่มีเหตุผลต้องมีโหมดนี้เลย
 */
const MobileNav = ({ handleMenuClick }) => {
  const [openGroups, setOpenGroups] = useState({});
  const location = useLocation();
  const { userData, logout } = useAuth();

  const groups = buildNavGroups(userData);

  // ✅ เดิม submenu ปิดเสมอตอนโหลดหน้าใหม่ ต่อให้อยู่ในหน้าลูกของมันอยู่ก็ตาม — ใช้ route ปัจจุบัน
  // เป็นค่าเริ่มต้นแทน (กางอัตโนมัติถ้าหมวดนั้น active) จนกว่าผู้ใช้จะกดเปิด/ปิดเองจึงยึดตามที่กดล่าสุด
  const isGroupOpen = (group) =>
    openGroups[group.key] !== undefined ? openGroups[group.key] : isGroupActive(location, group);
  const toggleGroup = (key) => setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleItemClick = () => {
    if (handleMenuClick) handleMenuClick();
  };

  const handleLogout = async () => {
    const result = await swalLogout();
    if (result.isConfirmed) {
      logout();
      Swal.fire("Logout Success!", "", "success");
    }
  };

  const initials = (userData?.fname?.charAt(0) || userData?.username?.charAt(0) || "U").toUpperCase();

  const renderLink = (group) => (
    <NavItem key={group.key}>
      <Link
        to={group.href}
        title={group.title}
        className={`nav-link ${isActiveHref(location, group.href) ? "active" : ""}`}
        onClick={handleItemClick}
      >
        <span className="nav-icon"><group.icon /></span>
        <span className="nav-text">{group.title}</span>
      </Link>
    </NavItem>
  );

  const renderDropdown = (group) => {
    const open = isGroupOpen(group);
    const active = isGroupActive(location, group);
    return (
      <NavItem key={group.key}>
        <button
          className={`nav-link menu-dropdown-btn ${open ? "expanded" : ""} ${active ? "parent-active" : ""}`}
          onClick={() => toggleGroup(group.key)}
        >
          <span className="nav-icon"><group.icon /></span>
          <span className="nav-text">{group.title}</span>
          <i className={`bi bi-chevron-right arrow-icon ${open ? "rotate" : ""}`}></i>
        </button>
        <Collapse isOpen={open}>
          <div className="submenu-wrapper">
            {group.items.map((item, idx) => (
              <Link
                key={idx}
                className={`nav-link submenu-link ${isActiveHref(location, item.href) ? "active" : ""}`}
                to={item.href}
                onClick={handleItemClick}
              >
                <i className="bi bi-circle submenu-dot"></i>
                <span className="nav-text">{item.title}</span>
              </Link>
            ))}
          </div>
        </Collapse>
      </NavItem>
    );
  };

  return (
    <div className="sidebar-container">
      {/* ส่วนหัว: โปรไฟล์ผู้ใช้ */}
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

      {/* ตรงกลาง: รายการเมนูหลัก — มาจาก buildNavGroups ตัวเดียวกับที่ Header.js ใช้ */}
      <div className="sidebar-content">
        <Nav vertical className="sidebarNav">
          {groups.map((group) => (group.type === "dropdown" ? renderDropdown(group) : renderLink(group)))}
        </Nav>
      </div>

      {/* ด้านล่างสุด: ตั้งค่า + ออกจากระบบ */}
      <div className="sidebar-fixed-bottom">
        <Nav vertical>
          <NavItem>
            <Link
              to="/about"
              title="ตั้งค่า"
              className={`nav-link ${isActiveHref(location, "/about") ? "active" : ""}`}
              onClick={handleItemClick}
            >
              <span className="nav-icon"><FaCog /></span>
              <span className="nav-text">ตั้งค่า</span>
            </Link>
          </NavItem>
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

export default MobileNav;
