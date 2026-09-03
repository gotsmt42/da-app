/**
 * navConfig.js — แหล่งความจริงเดียวของ "ใครเห็นเมนูอะไรบ้าง" ให้ทั้งแถบบน (Header.js, จอกว้าง)
 * และแผงเมนูมือถือ (MobileNav.js, จอแคบ) ใช้ร่วมกัน
 *
 * ✅ ที่มา (ผู้ใช้ขอ: "ตัด Sidebar ออก...ปรับปรุง UI ใหม่...ทันสมัย"): เดิม Sidebar.js เป็นแถบข้าง
 * ถาวรที่กินพื้นที่จอตลอดเวลา ย้ายเนื้อหาเดียวกันมาไว้ในแถบบนแทน (dropdown ตามหมวดเดิม) — logic
 * "ใครเห็นอะไร" ทั้งหมดที่นี่ port มาจาก Sidebar.js เป๊ะๆ ไม่มีการเพิ่ม/ลด/เปลี่ยนเงื่อนไขสิทธิ์ใดๆ
 * เปลี่ยนแค่ "รูปร่าง" ของข้อมูล (จาก JSX โดยตรง → data array ให้ 2 ตัว render ไปคนละแบบ)
 * ⚠️ ไฟล์นี้ไม่มี JSX เลย — เป็นแค่ data + logic ล้วนๆ ให้ทั้งสองฝั่ง import ไปใช้ได้เหมือนกัน
 */
import {
  FaTachometerAlt, FaCalendarAlt, FaFileContract, FaClipboardList, FaFileAlt,
  FaFileInvoiceDollar, FaUserFriends, FaBuilding, FaPaperPlane, FaClipboardCheck,
  FaWrench, FaBriefcase,
} from "react-icons/fa";
import { can, isRole, ROLES, DEPARTMENT } from "@/shared/utils/roles";

/**
 * ✅ ตัวเลือกของเมนู "ตารางงาน" — ต่างกันตาม role เพราะ query ?dept= มีความหมายไม่เหมือนกัน
 * (ดู departmentScope ฝั่ง server)
 *   • แอดมิน/manager: "/event" เฉยๆ = ตารางงานช่าง (ค่าเริ่มต้นของแผนกบริการ) ·
 *     "/event?dept=sales" = ตารางงานเซล (ข้ามแผนกไปดูของฝ่ายขาย)
 *   • เซล: "/event" เฉยๆ = แผนงานของฉัน (นัดหมายของตัวเอง) · "/event?dept=service" = ตารางงานช่าง
 *     (ขอดูอย่างเดียวข้ามแผนกมาฝั่งบริการ ตามสิทธิ์ viewServiceCalendar)
 * ⚠️ แอดมินไม่มีแนวคิด "แผนงานของฉัน" แยกจาก "ตารางงานช่าง" เพราะแอดมินไม่ได้เป็นคนลงตารางเข้างานเอง
 * — ใช้ตัวเลือกชุดของเซลกับแอดมินไม่ได้ (ผิดความหมาย ไม่ใช่แค่ผิดคำ)
 * ✅ ย้ายมาจาก Header.js เดิม — ทั้ง Header (ปุ่ม pill มือถือเดิม) และ navConfig (dropdown "งาน" ใหม่)
 * ต้องใช้ตัวเลือกชุดเดียวกันเป๊ะ ไม่งั้นผู้ใช้จะเจอ 2 จุดที่ควรตรงกันแต่ตัวเลือกไม่ตรงกัน
 */
export const scheduleOptionsFor = (isAdminOrManagerRole) =>
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

// ✅ เมนูตรงกับหน้าที่เปิดอยู่ไหม — เทียบทั้ง pathname และ query แบบเป๊ะๆ (ไม่ใช่แค่ startsWith)
// 🐛 บั๊กที่ป้องกัน: "/event" กับ "/event?dept=sales" pathname เดียวกัน ถ้าเทียบแค่ path ทั้งคู่จะ
// active พร้อมกันเสมอ แยกไม่ออกว่ากำลังดูปฏิทินไหนอยู่จริง — ย้ายมาจาก Sidebar.js เดิม (isActiveHref)
export const isActiveHref = (location, href) => {
  if (!href) return false;
  const [path, query = ""] = href.split("?");
  if (location.pathname !== path) return false;
  const current = location.search.replace(/^\?/, "");
  return query ? current === query : current === "";
};

export const isGroupActive = (location, group) =>
  group.type === "dropdown"
    ? group.items.some((item) => isActiveHref(location, item.href))
    : isActiveHref(location, group.href);

/**
 * ✅ โครงเมนู 6 หมวด — port ตรงจาก Sidebar.js (workMenu/operationMenu/workMenuManager/salesMenu/
 * dispatchMenu/workMenuTechnician/documentsMenu/financeMenu/masterDataMenu) ทุกเงื่อนไขสิทธิ์เดิม
 * เป๊ะๆ แค่ประกอบเป็น array เดียวแทนการ render กระจาย — แต่ละ group เป็น:
 *   { type:"link", title, href, icon }               — ปลายทางเดียว กดแล้วไปเลย
 *   { type:"dropdown", title, icon, items:[{title,href,icon}] } — มีหลายปลายทางในหมวดเดียวกัน
 * @param {object} userData จาก useAuth()
 */
export const buildNavGroups = (userData) => {
  const isTechnician = isRole(userData, ROLES.TECHNICIAN);
  const isAdminOrManager = can(userData, "manageMasterData");
  const canSell = can(userData, "createSalesPlan");
  const isSaleUser = isRole(userData, ROLES.SALE);
  const canViewFinance = can(userData, "viewFinance");
  const canAssign = can(userData, "assignDispatch");
  const canViewOperation = can(userData, "editOperation") || can(userData, "receiveDispatch");
  // ✅ ใครลงแผนงานได้ ต้องเห็นเมนูแผนงาน (ตรงกับ Sidebar.js:52 เป๊ะ)
  const canPlanWork = canViewOperation || canSell || isTechnician || isAdminOrManager;

  const groups = [];

  groups.push({ key: "dashboard", type: "link", title: "Dashboard", href: "/dashboard", icon: FaTachometerAlt });

  // ── หมวด "งาน" — รวมแผนงาน/การดำเนินงาน/ภาพรวมงาน/งานของฉัน/คำขอลงงาน ────────────
  if (canPlanWork) {
    const workItems = [];
    if (isAdminOrManager || can(userData, "viewServiceCalendar")) {
      // ✅ แอดมิน/manager เห็น "ตารางงานช่าง"+"ตารางงานเซล" ส่วนเซล (เข้าเงื่อนไข viewServiceCalendar
      // แต่ไม่ใช่ isAdminOrManager) เห็น "แผนงานของฉัน"+"ตารางงานช่าง (ดูอย่างเดียว)" — ดู scheduleOptionsFor
      const sched = scheduleOptionsFor(isAdminOrManager);
      workItems.push({ title: sched.primary.label, href: sched.primary.href, icon: sched.primary.icon });
      workItems.push({ title: sched.secondary.label, href: sched.secondary.href, icon: sched.secondary.icon });
    } else {
      // ช่าง/ผู้ใช้ทั่วไป — ปฏิทินเดียว ไม่มีตัวเลือกให้สลับ
      workItems.push({
        title: canViewOperation ? "ตารางงาน" : "แผนงานของฉัน", href: "/event", icon: FaCalendarAlt,
      });
    }
    if (canViewOperation) workItems.push({ title: "การดำเนินงาน", href: "/operation", icon: FaWrench });
    if (isAdminOrManager) workItems.push({ title: "ภาพรวมงาน", href: "/contracts", icon: FaFileContract });
    if (isTechnician) {
      workItems.push({ title: "งานของฉัน", href: "/technician/jobs", icon: FaClipboardList });
      workItems.push({ title: "ภาพรวมงาน", href: "/contracts", icon: FaFileContract });
    }
    if (canAssign) workItems.push({ title: "คำขอลงงาน", href: "/dispatch", icon: FaClipboardCheck });

    // ✅ เหลือปลายทางเดียว (ไม่เคยเกิดในทางปฏิบัติตอนนี้ แต่กันไว้เผื่ออนาคต) = ลิงก์ตรงๆ ไม่ต้องมี
    // dropdown ที่กดแล้วเจอตัวเลือกเดียว — เทียบ pattern เดียวกับ "งานขาย" ด้านล่าง
    if (workItems.length === 1) groups.push({ key: "work", type: "link", ...workItems[0] });
    else groups.push({ key: "work", type: "dropdown", title: "งาน", icon: FaCalendarAlt, items: workItems });
  }

  // ── หมวด "งานขาย" — เหลือรายการเดียว (แจ้งงานให้ช่าง) ใส่เป็นลิงก์ตรงๆ ไม่ทำ dropdown 1 ตัวเลือก
  if (isSaleUser) {
    groups.push({ key: "sales", type: "link", title: "แจ้งงานให้ช่าง", href: "/sales", icon: FaPaperPlane });
  }

  // ── หมวด "เอกสาร" — ทุก role ยกเว้นเซล (เอกสารงานช่างล้วนๆ เซลไม่เกี่ยว)
  if (!isSaleUser) {
    groups.push({ key: "documents", type: "link", title: "เอกสาร", href: "/documents", icon: FaFileAlt });
  }

  // ── หมวด "การเงิน" — แทนที่ "ติดตามใบเสนอราคา" (/quotations) เดิมของ Header.js ซึ่งเป็นแค่ URL
  // นามแฝงเก่าที่ redirect เข้าหน้าเดียวกันนี้อยู่แล้ว (ดู router/index.js) ไม่ต้องมี 2 ทางเข้าซ้ำกัน
  if (canViewFinance) {
    groups.push({ key: "finance", type: "link", title: "ใบเสนอราคา / การเงิน", href: "/finance", icon: FaFileInvoiceDollar });
  }

  // ── หมวด "ข้อมูลหลัก" — ลูกค้า + พนักงาน/ทีมช่าง เฉพาะแอดมิน/manager
  if (isAdminOrManager) {
    groups.push({
      key: "masterdata", type: "dropdown", title: "ข้อมูลหลัก", icon: FaBuilding,
      items: [
        { title: "ลูกค้า", href: "/customers", icon: FaBuilding },
        { title: "พนักงาน / ทีมช่าง", href: "/staff", icon: FaUserFriends },
      ],
    });
  }

  return groups;
};
