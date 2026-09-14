/**
 * MobileBottomNav — แถบเมนูหลักติดขอบล่างจอ (เฉพาะมือถือ) แบบแอป Facebook
 *
 * ✅ ผู้ใช้ขอ: "หน้าจอมือถือ อยากให้มีแถบด้านล่างแบบของแอพมือถือเช่น facebook เป็นเมนูหลักๆ คือ
 * ตารางงานช่าง ใบ Advance ใบเคลม ภาพรวมงาน" — เดิมบนมือถือต้องกดแฮมเบอร์เกอร์เปิดเมนูข้างทุกครั้ง
 * ที่จะสลับหน้า (2 แตะ + เลื่อนหา) ทั้งที่งานประจำวันวนอยู่แค่ไม่กี่หน้า
 * ✅ เพิ่ม "หน้าหลัก" เป็นช่องแรกตามแบบแอป Facebook — ไม่งั้นทางกลับหน้าแรกมีแค่โลโก้เล็กๆ ที่คนไม่รู้ว่ากดได้
 *
 * ⚠️ สิทธิ์: 4 เมนูที่ผู้ใช้ระบุเป็นชุดของแอดมิน/หัวหน้า/ช่าง (มีสิทธิ์ครบทั้ง 4) — role อื่นเห็นเฉพาะเมนูที่
 * ตัวเองเข้าได้จริง (เงื่อนไขเดียวกับ layouts/Sidebar.js) แล้วเติมด้วยเมนูหลักของสายงานตัวเอง
 * ไม่ปล่อยช่องที่กดแล้วเด้งออกเพราะไม่มีสิทธิ์
 * ⚠️ ซ่อนตอนแป้นพิมพ์เปิด (โฟกัสช่องกรอก) — Android ดันแถบที่ fixed ขอบล่างขึ้นมาเกาะเหนือแป้นพิมพ์
 * แล้วบังช่องที่กำลังพิมพ์พอดี
 * ⚠️ ความสูงของแถบประกาศเป็นตัวแปร --app-bottom-nav-h (FullLayout.css) — ของที่ fixed ขอบล่างจอ
 * (เช่น แถบยอดรวมหน้าภาพรวมงาน) ต้องเลื่อนขึ้นด้วยตัวแปรนี้ ไม่งั้นโดนแถบนี้ทับ
 */
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FaHome, FaCalendarAlt, FaMoneyCheckAlt, FaReceipt, FaFileContract, FaWrench, FaPaperPlane,
  FaFileAlt, FaFileInvoiceDollar,
} from "react-icons/fa";

import { useAuth } from "@/features/auth/AuthContext";
import { can, isRole, ROLES, DEPARTMENT } from "@/shared/utils/roles";
import useExpenseSummary from "@/features/expenses/hooks/useExpenseSummary";
import "./MobileBottomNav.css";

const MAX_ITEMS = 5;
const EXPENSE_TABS_OTHER = ["claims", "approvals", "report"];

/**
 * @returns {Array<{key, label, href, icon, match: (loc) => boolean, badgeKey?}>}
 */
export const buildBottomNav = (userData) => {
  const isTechnician = isRole(userData, ROLES.TECHNICIAN);
  const isAdminOrManager = can(userData, "manageMasterData");
  const isSaleUser = isRole(userData, ROLES.SALE);
  const canExpense = can(userData, "requestExpense") || can(userData, "viewAllExpenses");
  const canViewOperation = can(userData, "editOperation") || can(userData, "receiveDispatch");
  const canPlanWork = canViewOperation || can(userData, "createSalesPlan") || isTechnician || isAdminOrManager;

  const tabOf = (loc) => new URLSearchParams(loc.search).get("tab");
  const deptOf = (loc) => new URLSearchParams(loc.search).get("dept");
  const items = [
    { key: "home", label: "หน้าหลัก", href: "/dashboard", icon: FaHome, match: (loc) => loc.pathname === "/dashboard" },
  ];

  // ── ปฏิทิน ──────────────────────────────────────────────────────────────
  if (isSaleUser && can(userData, "viewServiceCalendar")) {
    // เซล: ปฏิทินของตัวเอง + ตารางงานช่าง (ดูอย่างเดียว) คนละช่อง — /event เฉยๆ ของเซลคือนัดหมายของเซล
    items.push({ key: "event-mine", label: "แผนงาน", href: "/event", icon: FaCalendarAlt, match: (loc) => loc.pathname === "/event" && deptOf(loc) !== DEPARTMENT.SERVICE });
    items.push({ key: "event-service", label: "ตารางงานช่าง", href: `/event?dept=${DEPARTMENT.SERVICE}`, icon: FaWrench, match: (loc) => loc.pathname === "/event" && deptOf(loc) === DEPARTMENT.SERVICE });
  } else if (canPlanWork) {
    items.push({
      key: "event",
      // แอดมิน/หัวหน้ามีทั้งตารางงานช่างและเซล — ช่องนี้คือของช่าง (/event ไม่มี dept) ส่วนช่าง/พนักงานคือปฏิทินตัวเอง
      label: isAdminOrManager ? "ตารางงานช่าง" : "ตารางงาน",
      href: "/event",
      icon: FaCalendarAlt,
      match: (loc) => loc.pathname === "/event" && deptOf(loc) !== "sales",
    });
  }

  // ── เบิกค่าใช้จ่าย ──────────────────────────────────────────────────────
  if (canExpense) {
    // ⚠️ /expenses ที่ไม่มี ?tab= (เช่นเปิดใบจากลิงก์แจ้งเตือน /expenses/<id>) เปิดแท็บ Advance เป็นค่าเริ่มต้น
    // จึงนับเป็นช่อง Advance — ไม่งั้นอยู่ในระบบเบิกแล้วแถบล่างไม่มีช่องไหนติดสว่างเลย
    items.push({
      key: "advance", label: "ใบ Advance", href: "/expenses?tab=advances", icon: FaMoneyCheckAlt,
      match: (loc) => loc.pathname.startsWith("/expenses") && !EXPENSE_TABS_OTHER.includes(tabOf(loc)),
    });
    items.push({
      key: "claim", label: "ใบเคลม", href: "/expenses?tab=claims", icon: FaReceipt, badgeKey: "awaitingClaim",
      match: (loc) => loc.pathname.startsWith("/expenses") && tabOf(loc) === "claims",
    });
  }

  // ── ภาพรวมงาน ───────────────────────────────────────────────────────────
  if (isAdminOrManager || isTechnician) {
    items.push({ key: "contracts", label: "ภาพรวมงาน", href: "/contracts", icon: FaFileContract, match: (loc) => loc.pathname === "/contracts" });
  }

  // ── เติมช่องว่างด้วยเมนูหลักของสายงาน (role ที่ไม่มีสิทธิ์ครบ 4 เมนูข้างบน) ────────────
  const fillers = [];
  if (isSaleUser) fillers.push({ key: "sales", label: "แจ้งงาน", href: "/sales", icon: FaPaperPlane, match: (loc) => loc.pathname.startsWith("/sales") });
  if (canViewOperation) fillers.push({ key: "operation", label: "ดำเนินงาน", href: "/operation", icon: FaWrench, match: (loc) => loc.pathname.startsWith("/operation") });
  if (!isSaleUser) fillers.push({ key: "documents", label: "เอกสาร", href: "/documents", icon: FaFileAlt, match: (loc) => loc.pathname.startsWith("/documents") });
  if (can(userData, "viewFinance")) fillers.push({ key: "finance", label: "ใบเสนอราคา", href: "/finance", icon: FaFileInvoiceDollar, match: (loc) => loc.pathname.startsWith("/finance") });
  fillers.forEach((f) => { if (items.length < MAX_ITEMS) items.push(f); });

  return items.slice(0, MAX_ITEMS);
};

const isEditable = (el) =>
  Boolean(el && (el.isContentEditable || (el.tagName === "INPUT" && !["button", "checkbox", "radio", "submit", "reset", "file", "range", "color"].includes(el.type)) || el.tagName === "TEXTAREA" || el.tagName === "SELECT"));

export default function MobileBottomNav() {
  const { userData } = useAuth();
  const location = useLocation();
  const items = userData ? buildBottomNav(userData) : [];
  const hasClaim = items.some((it) => it.badgeKey === "awaitingClaim");
  const summary = useExpenseSummary(hasClaim, userData?.userId, location.pathname);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const onFocusIn = (e) => setTyping(isEditable(e.target));
    // ⚠️ focusout ยิงก่อน focusin ของช่องถัดไป — หน่วงนิดเดียวให้เช็คช่องที่โฟกัสจริงตอนนี้ ไม่งั้นแถบ
    // จะกระพริบโผล่-หายทุกครั้งที่กดย้ายจากช่องหนึ่งไปอีกช่อง
    const onFocusOut = () => setTimeout(() => setTyping(isEditable(document.activeElement)), 60);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  if (items.length < 2) return null;
  const counts = { awaitingClaim: Number(summary?.awaitingClaim) || 0 };

  return (
    <nav className={`mbn${typing ? " mbn--hidden" : ""}`} aria-label="เมนูลัด">
      <ul className="mbn-list" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((it) => {
          const Icon = it.icon;
          const active = it.match(location);
          const count = it.badgeKey ? counts[it.badgeKey] : 0;
          return (
            <li key={it.key} className="mbn-li">
              <Link
                to={it.href}
                className={`mbn-item${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
                aria-label={count ? `${it.label} (รอเคลียร์ ${count})` : it.label}
              >
                <span className="mbn-icon" aria-hidden="true">
                  <Icon />
                  {count > 0 && <span className="mbn-badge">{count > 99 ? "99+" : count}</span>}
                </span>
                <span className="mbn-label">{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
