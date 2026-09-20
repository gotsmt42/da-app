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
import { useAuth } from "@/features/auth/AuthContext";
import { can, isRole, ROLES, DEPARTMENT } from "@/shared/utils/roles";
import useAppBadges, { BADGE_LABEL } from "@/shared/hooks/useAppBadges";
// ⚠️ ชื่อ/พาธ/ไอคอน/คีย์ป้ายตัวเลข มาจากทะเบียนกลาง — อย่าพิมพ์ทับที่นี่
// ช่องบนแถบนี้กว้างราว 70px จึงใช้ชื่อที่สั้นที่สุดของปลายทาง (barTitle)
import { dest, barTitle } from "./navConfig";
import "./MobileBottomNav.css";

const MAX_ITEMS = 5;
// หน้าอื่นของระบบเบิกที่ไม่ใช่ "ใบ Advance" — ใช้ตัดสินว่าช่องไหนบนแถบล่างควรติดสว่าง
const EXPENSE_OTHER_PATHS = ["/expenses/claims", "/expenses/approvals", "/expenses/report"];

/**
 * ช่องหนึ่งช่องบนแถบล่าง — เอาปลายทางจากทะเบียนกลางมาใส่ชื่อสั้นและเงื่อนไข "กำลังอยู่หน้านี้"
 * ⚠️ match ต้องอยู่ที่นี่ ไม่ย้ายไปทะเบียนกลาง — เป็นเรื่องของแถบนี้ล้วนๆ (เช่น /expenses/<id>
 *    ที่เปิดจากลิงก์แจ้งเตือน ต้องนับเป็นช่อง Advance ไม่งั้นไม่มีช่องไหนติดสว่างเลย)
 */
const bar = (key, match) => {
  const d = dest(key);
  return { ...d, label: barTitle(d), match };
};

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

  const deptOf = (loc) => new URLSearchParams(loc.search).get("dept");
  const items = [bar("home", (loc) => loc.pathname === "/dashboard")];

  // ── ปฏิทิน ──────────────────────────────────────────────────────────────
  if (isSaleUser && can(userData, "viewServiceCalendar")) {
    // เซล: ปฏิทินของตัวเอง + ตารางงานช่าง (ดูอย่างเดียว) คนละช่อง — /event เฉยๆ ของเซลคือนัดหมายของเซล
    items.push(bar("eventMine", (loc) => loc.pathname === "/event" && deptOf(loc) !== DEPARTMENT.SERVICE));
    items.push(bar("eventServiceReadOnly", (loc) => loc.pathname === "/event" && deptOf(loc) === DEPARTMENT.SERVICE));
  } else if (canPlanWork) {
    // แอดมิน/หัวหน้ามีทั้งตารางงานช่างและเซล — ช่องนี้คือของช่าง (/event ไม่มี dept) ส่วนช่าง/พนักงานคือปฏิทินตัวเอง
    items.push(bar(
      isAdminOrManager ? "eventService" : "eventOwn",
      (loc) => loc.pathname === "/event" && deptOf(loc) !== "sales",
    ));
  }

  // ── เบิกค่าใช้จ่าย ──────────────────────────────────────────────────────
  if (canExpense) {
    // ⚠️ /expenses ที่ไม่มี ?tab= (เช่นเปิดใบจากลิงก์แจ้งเตือน /expenses/<id>) เปิดแท็บ Advance เป็นค่าเริ่มต้น
    // จึงนับเป็นช่อง Advance — ไม่งั้นอยู่ในระบบเบิกแล้วแถบล่างไม่มีช่องไหนติดสว่างเลย
    // ⚠️ /expenses/<id> (เปิดใบจากลิงก์แจ้งเตือน) นับเป็นช่องนี้ด้วย — ไม่งั้นอยู่ในระบบเบิกแล้วไม่มีช่องไหนสว่างเลย
    items.push(bar("advance", (loc) => loc.pathname.startsWith("/expenses") && !EXPENSE_OTHER_PATHS.includes(loc.pathname)));
    items.push(bar("claim", (loc) => loc.pathname === "/expenses/claims"));
  }

  // ── ภาพรวมงาน ───────────────────────────────────────────────────────────
  if (isAdminOrManager || isTechnician) {
    items.push(bar("contracts", (loc) => loc.pathname === "/contracts"));
  }

  // ── เติมช่องว่างด้วยเมนูหลักของสายงาน (role ที่ไม่มีสิทธิ์ครบ 4 เมนูข้างบน) ────────────
  const fillers = [];
  if (isSaleUser) fillers.push(bar("sales", (loc) => loc.pathname.startsWith("/sales")));
  if (canViewOperation) fillers.push(bar("operation", (loc) => loc.pathname.startsWith("/operation")));
  if (can(userData, "viewDocuments")) fillers.push(bar("documents", (loc) => loc.pathname.startsWith("/documents")));
  if (can(userData, "viewFinance")) fillers.push(bar("finance", (loc) => loc.pathname.startsWith("/finance")));
  fillers.forEach((f) => { if (items.length < MAX_ITEMS) items.push(f); });

  return items.slice(0, MAX_ITEMS);
};

const isEditable = (el) =>
  Boolean(el && (el.isContentEditable || (el.tagName === "INPUT" && !["button", "checkbox", "radio", "submit", "reset", "file", "range", "color"].includes(el.type)) || el.tagName === "TEXTAREA" || el.tagName === "SELECT"));

export default function MobileBottomNav() {
  const { userData } = useAuth();
  const location = useLocation();
  const items = userData ? buildBottomNav(userData) : [];
  const { badges } = useAppBadges(userData);
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

  return (
    <nav className={`mbn${typing ? " mbn--hidden" : ""}`} aria-label="เมนูลัด">
      <ul className="mbn-list" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((it) => {
          const Icon = it.icon;
          const active = it.match(location);
          const count = it.badgeKey ? Number(badges[it.badgeKey]) || 0 : 0;
          return (
            <li key={it.key} className="mbn-li">
              <Link
                to={it.href}
                className={`mbn-item${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
                aria-label={count ? `${it.label} (${BADGE_LABEL[it.badgeKey]} ${count})` : it.label}
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
