/**
 * HomeMenu — "เมนูหลัก" บนหน้า Dashboard จัดเป็นหมวดหมู่
 *
 * ✅ ที่มา (ผู้ใช้ขอ 2 รอบ):
 *   1) "เพิ่มเมนูหน้าจอหลักให้ดูง่าย และสวยงาม พร้อมปรับปรุงปุ่มต่างๆ ไม่ให้รก มืออาชีพ" — เดิมทางเข้าหน้าอื่น
 *      กระจายเป็นปุ่ม gradient ใหญ่ 2 ใบ + แบนเนอร์ส้มเต็มแถว + "ทางลัด" ท้ายหน้า คนละหน้าตากันหมด
 *   2) "ยังเรียงไม่เป็นหมวดหมู่ ไม่สวยงาม ดูและใช้งานยาก" — รอบแรกทำเป็นกริดไอคอนก้อนเดียว 12 ช่อง
 *      แยกหมวดด้วยสีอย่างเดียว ตาต้องไล่อ่านทีละช่องถึงจะรู้ว่าอะไรอยู่ตรงไหน
 * ✅ ตอนนี้: แต่ละหมวดเป็นการ์ดของตัวเอง มีหัวหมวดชัดเจน (งาน · เบิกค่าใช้จ่าย · เอกสารและการเงิน · ข้อมูลหลัก)
 *   • จอกว้าง: การ์ดหมวดวาง 2 คอลัมน์ ข้างในเป็นรายการแนวนอน [ไอคอน] ชื่อ + คำอธิบาย ›  อ่านไล่ลงได้ทันที
 *   • มือถือ:  การ์ดหมวดเรียงลงมา ข้างในเป็นไอคอนแบบหน้าโฮมแอป (หมวดที่มี ≤2 เมนูวางคู่กันครึ่งจอ)
 *
 * ⚠️ ใครเห็นเมนูไหน = เงื่อนไขเดียวกับเมนูข้าง (layouts/Sidebar.js) ทุกรายการ — แก้ที่ Sidebar.js เมื่อไร
 * ต้องแก้ buildHomeMenu ที่นี่ด้วย ไม่งั้นผู้ใช้จะเจอทางลัดไปหน้าที่ไม่มีในเมนูของตัวเอง (หรือกดแล้วเด้งออก)
 */
import { Link } from "react-router-dom";
import {
  FaCalendarAlt, FaWrench, FaClipboardList, FaClipboardCheck,
  FaPaperPlane, FaFileAlt, FaFileInvoiceDollar, FaMoneyCheckAlt, FaReceipt, FaChartBar, FaInbox,
  FaBuilding, FaUserFriends, FaChevronRight, FaWallet, FaFolderOpen, FaDatabase,
} from "react-icons/fa";

import { can, isRole, ROLES, DEPARTMENT, TECHNICIAN_ROLES } from "@/shared/utils/roles";
import useAppBadges, { BADGE_LABEL } from "@/shared/hooks/useAppBadges";
import "./HomeMenu.css";

/**
 * สีประจำหมวด/เมนู — ความหมายเดียวกับที่ใช้ทั้งแอป (แดง = งานบริการ · ม่วง = ฝ่ายขาย ·
 * เขียวอมฟ้า = เบิกค่าใช้จ่าย · ส้ม = เอกสาร/การเงิน · น้ำเงิน = ข้อมูลหลัก)
 * ⚠️ คำอธิบาย (sub) ต้องสั้นไม่เกิน ~16 ตัวอักษร — ยาวกว่านี้โดนตัดเป็น "..." บนจอแท็บเล็ต
 * ⚠️ เคยลองเปลี่ยนเป็นเทาทั้งหมดเพื่อ "ลดสีให้ดูสงบ" แล้ว — ผู้ใช้ดูของจริงแล้วบอกว่าไม่สวย
 * ให้คงชุดสีนี้ไว้ อย่าเปลี่ยนเป็นโทนเทาอีก
 * ⚠️ กฎของหน้านี้: **ทุกปุ่มในหมวดเดียวกันใช้สีเดียวกัน** ปุ่มไหนใส่ tone ของตัวเองจะโดดออกจากแถว
 * (เคยทาสีม่วงของ "ชนิดเอกสารใบเคลม" ที่ปุ่มใบเคลมปุ่มเดียว — ผู้ใช้ให้แก้กลับ) สีประจำชนิดเอกสาร
 * ใช้ในหน้าของมันเอง (features/expenses/expenseMeta.js) ไม่ใช่ในเมนูหน้าแรก
 * ยกเว้นเดียวที่เหลืออยู่คือเมนูของสายงานขายในหมวด "งาน" ซึ่งเป็นคนละสายงานกันจริงๆ
 */
const TONE = {
  work: "#dc2626",
  sales: "#7c3aed",
  expense: "#0d9488",
  docs: "#d97706",
  master: "#2563eb",
};

/**
 * @param {object} userData  จาก useAuth()
 * @param {object} [opts]
 * @param {boolean} [opts.hideMyJobs]    ช่างมีการ์ด "งานของฉัน" เด่นอยู่แล้วด้านบน — ไม่ต้องมีซ้ำ
 * @param {boolean} [opts.hideSalesJobs] เซลมีการ์ด "งานขายของฉัน" (/sales) อยู่แล้วด้านบน
 * @returns {Array<{key, title, icon, tone, items: Array<{key, title, short?, sub, href, icon, tone?, badgeKey?}>}>}
 */
export const buildHomeMenu = (userData, { hideMyJobs = false, hideSalesJobs = false } = {}) => {
  const isTechnician = isRole(userData, ...TECHNICIAN_ROLES);
  const isAdminOrManager = can(userData, "manageMasterData");
  const canSell = can(userData, "createSalesPlan");
  const isSaleUser = isRole(userData, ROLES.SALE);
  const canViewFinance = can(userData, "viewFinance");
  const canExpense = can(userData, "requestExpense") || can(userData, "viewAllExpenses");
  // ✅ ทุกคนที่มีขั้นของตัวเองในสายอนุมัติ 4 ขั้น (ตรวจสอบ / อนุมัติ / อนุมัติเบิกจ่าย) เห็นคิวงาน
  const canApproveExpense = can(userData, "reviewExpense") || can(userData, "approveExpense") || can(userData, "disburseExpense");
  const canAssign = can(userData, "assignDispatch");
  const canViewOperation = can(userData, "editOperation") || can(userData, "receiveDispatch");
  const canPlanWork = canViewOperation || canSell || isTechnician || isAdminOrManager;

  // ── งาน ──────────────────────────────────────────────────────────────────
  const work = [];
  if (canPlanWork) {
    if (isAdminOrManager) {
      work.push({ key: "event-service", title: "ตารางงานช่าง", sub: "ปฏิทินงานบริการ", href: "/event", icon: FaCalendarAlt, badgeKey: "pendingApproval" });
      // ⚠️ "ตารางงานเซล" (/event?dept=sales) ตั้งใจไม่ใส่ในเมนูหลักหน้านี้ — ผู้ใช้สั่งให้เอาออกไปก่อน
      // (ยังเข้าได้ตามปกติจากเมนูข้าง "แผนงาน" และ dropdown บนแถบบน ไม่ได้ปิดฟีเจอร์)
    } else if (can(userData, "viewServiceCalendar")) {
      work.push({ key: "event-mine", title: "แผนงานของฉัน", sub: "นัดหมายของฉัน", href: "/event", icon: FaCalendarAlt, tone: TONE.sales, badgeKey: "pendingApproval" });
      work.push({ key: "event-service", title: "ตารางงานช่าง", sub: "ดูอย่างเดียว", href: `/event?dept=${DEPARTMENT.SERVICE}`, icon: FaWrench });
    } else {
      work.push({ key: "event", title: canViewOperation ? "ตารางงาน" : "แผนงานของฉัน", sub: "ปฏิทินงาน", href: "/event", icon: FaCalendarAlt, badgeKey: "pendingApproval" });
    }
  }
  if (canViewOperation) work.push({ key: "operation", title: "การดำเนินงาน", sub: "เช็คอิน · ปิดงาน", href: "/operation", icon: FaWrench, badgeKey: "closeRequests" });
  if (isTechnician && !hideMyJobs) work.push({ key: "my-jobs", title: "งานของฉัน", sub: "งานที่ได้รับมอบหมาย", href: "/technician/jobs", icon: FaClipboardList, badgeKey: "myJobs" });
  // 🧹 "ภาพรวมงาน" ถูกตัดออกจากเมนูหลักตามที่ผู้ใช้สั่ง — เดิมปลายทางนี้โผล่พร้อมกัน 3 ที่ในจอเดียว
  // (ชิปบนแถบบน + ปุ่มตรงนี้ + ช่องบนแถบเมนูล่าง) พร้อมป้ายตัวเลขเดียวกันทั้งสามจุด
  // ⚠️ ยังเข้าได้ตามปกติจากแถบเมนูล่าง (มือถือ) และเมนูข้าง (ทุกจอ) — ไม่ได้ตัดทางเข้าทิ้ง
  if (canAssign) work.push({ key: "dispatch", title: "คำขอลงงาน", sub: "คิวรอมอบหมาย", href: "/dispatch", icon: FaClipboardCheck, badgeKey: "dispatchQueue" });
  if (isSaleUser && !hideSalesJobs) work.push({ key: "sales", title: "แจ้งงานให้ช่าง", sub: "ส่งงานเข้าคิวช่าง", href: "/sales", icon: FaPaperPlane, tone: TONE.sales, badgeKey: "dispatchMine" });

  // ── เบิกค่าใช้จ่าย ────────────────────────────────────────────────────────
  // ✅ วางต่อจากหมวดงานทันที — ผู้ใช้เลือกใบ Advance/ใบเคลมเป็นเมนูหลักบนแถบล่างมือถือ = ใช้บ่อยรองจากงาน
  const expense = [];
  if (canExpense) {
    expense.push({ key: "advance", title: "ใบเบิก Advance", short: "ใบ Advance", sub: "เบิกเงินล่วงหน้า", href: "/expenses/advances", icon: FaMoneyCheckAlt, badgeKey: "advance" });
    // ⚠️ ไม่ใส่ tone เอง — ใช้สีของหมวด "เบิกค่าใช้จ่าย" เหมือนปุ่มอื่นในแถวเดียวกัน
    // (เคยทาสีม่วงของ "ชนิดเอกสาร" ไว้ที่ปุ่มนี้ปุ่มเดียว ผู้ใช้ดูของจริงแล้วบอกว่าโดดออกมาจากเพื่อนในแถว —
    // สีประจำชนิดใบยังอยู่ครบในหน้าใบเคลมเอง ตรงนี้เป็นแค่ปุ่มทางเข้า)
    expense.push({ key: "claim", title: "ใบเคลม", sub: "เคลียร์ค่าใช้จ่าย", href: "/expenses/claims", icon: FaReceipt, badgeKey: "claim" });
    // ✅ คิวงานของผู้ดำเนินการแต่ละขั้น (ตรวจสอบ/อนุมัติ/อนุมัติเบิกจ่าย) เพิ่มอีกเมนู
    if (canApproveExpense) {
      expense.push({ key: "expense-inbox", title: "รอดำเนินการ", short: "รอดำเนินการ", sub: "ตรวจสอบ · อนุมัติ · เบิกจ่าย", href: "/expenses/approvals", icon: FaInbox, badgeKey: "expenseInbox" });
    }
    expense.push({ key: "expense-report", title: "รายงานการเบิก", short: "รายงาน", sub: "ยอดค้าง · ย้อนหลัง", href: "/expenses/report", icon: FaChartBar });
  }

  // ── เอกสารและการเงิน ─────────────────────────────────────────────────────
  const docs = [];
  if (!isSaleUser) docs.push({ key: "documents", title: "เอกสาร", sub: "ไฟล์ · เอกสารออก", href: "/documents", icon: FaFileAlt });
  if (canViewFinance) {
    docs.push({ key: "finance", title: "ใบเสนอราคา / การเงิน", short: "ใบเสนอราคา", sub: "ติดตาม · วางบิล", href: "/finance", icon: FaFileInvoiceDollar, badgeKey: "quotations" });
  }

  // ── ข้อมูลหลัก ────────────────────────────────────────────────────────────
  const master = [];
  if (isAdminOrManager) {
    master.push({ key: "customers", title: "ลูกค้า", sub: "ทะเบียนลูกค้า", href: "/customers", icon: FaBuilding });
    master.push({ key: "staff", title: "พนักงาน / ทีมช่าง", short: "พนักงาน", sub: "ภาระงาน · ทะเบียน", href: "/staff", icon: FaUserFriends });
  }

  return [
    { key: "work", title: "งาน", icon: FaCalendarAlt, tone: TONE.work, items: work },
    { key: "expense", title: "เบิกค่าใช้จ่าย", icon: FaWallet, tone: TONE.expense, items: expense },
    { key: "docs", title: "เอกสารและการเงิน", icon: FaFolderOpen, tone: TONE.docs, items: docs },
    { key: "master", title: "ข้อมูลหลัก", icon: FaDatabase, tone: TONE.master, items: master },
  ].filter((cat) => cat.items.length);
};

/**
 * แบ่งการ์ดหมวดลง 2 คอลัมน์ (จอกว้าง) ให้ความสูงสองฝั่งใกล้กันที่สุด โดยยังคงลำดับหมวดเดิม
 * ⚠️ ทำใน JS ไม่ใช้ CSS columns — CSS columns ตัดสินเองว่าการ์ดไหนไปฝั่งไหน คาดเดาไม่ได้ และบางทีหั่น
 * การ์ดใบเดียวแยกครึ่งไปคนละคอลัมน์
 */
export const splitColumns = (cats) => {
  const cols = [[], []];
  const height = [0, 0];
  cats.forEach((cat, index) => {
    const side = height[1] < height[0] ? 1 : 0;
    cols[side].push({ cat, index });
    height[side] += cat.items.length + 1.2; // +หัวการ์ด
  });
  return cols;
};

const badgeText = (n) => (n > 99 ? "99+" : String(n));

/**
 * @param {object} props
 * @param {object} props.userData
 * @param {object} [props.badges]   ตัวเลขที่หน้าแม่คำนวณไว้แล้ว เช่น { quotations: 3 }
 */
export default function HomeMenu({ userData, badges = {}, hideMyJobs = false, hideSalesJobs = false }) {
  const cats = buildHomeMenu(userData, { hideMyJobs, hideSalesJobs });
  // ⚠️ ทุกเมนูอ่านตัวเลขจาก store เดียวกัน (useAppBadges) — ห้ามคำนวณเองที่นี่ ไม่งั้นเลขบนเมนูหลัก
  // กับแถบล่าง/แถบบนจะไม่ตรงกันเวลาเงื่อนไขเปลี่ยน
  const { badges: shared } = useAppBadges(userData);

  if (!cats.length) return null;

  // badges ที่หน้าแม่ส่งมา (ถ้ามี) ทับของ store ได้ — หน้านั้นมีข้อมูลสดกว่าเพราะโหลดเองอยู่แล้ว
  const counts = { ...shared, ...badges };

  // มือถือ: หมวดที่มี ≤2 เมนูวางคู่กันครึ่งจอ — ถ้าเหลือใบเดียวไม่มีคู่ ให้เต็มแถวแทน (ไม่ทิ้งครึ่งจอว่าง)
  const narrow = cats.filter((c) => c.items.length <= 2);
  const loneNarrowKey = narrow.length % 2 === 1 ? narrow[narrow.length - 1].key : null;

  return (
    <nav className="hm" aria-label="เมนูหลัก">
      <div className="hm-cols">
        {splitColumns(cats).map((col, ci) => (
          // มีแค่ 2 คอลัมน์ตายตัว ลำดับไม่มีวันสลับ — ใช้ลำดับเป็น key ได้
          <div className="hm-col" key={ci === 0 ? "left" : "right"}>
            {col.map(({ cat, index }) => {
              const CatIcon = cat.icon;
              const half = cat.items.length <= 2 && cat.key !== loneNarrowKey;
              return (
                <section
                  key={cat.key}
                  className={`hm-cat${half ? " hm-cat--half" : ""}`}
                  style={{ order: index, "--hm-tone": cat.tone }}
                  aria-labelledby={`hm-cat-${cat.key}`}
                >
                  <header className="hm-cat-head">
                    <span className="hm-cat-icon" aria-hidden="true"><CatIcon /></span>
                    <h6 className="hm-cat-title" id={`hm-cat-${cat.key}`}>{cat.title}</h6>
                  </header>
                  <ul className={`hm-list${half ? " hm-list--half" : ""}`}>
                    {cat.items.map((it) => {
                      const Icon = it.icon;
                      const count = it.badgeKey ? Number(counts[it.badgeKey]) || 0 : 0;
                      return (
                        <li key={it.key} className="hm-li">
                          <Link
                            to={it.href}
                            className="hm-item"
                            style={{ "--hm-tone": it.tone || cat.tone }}
                            title={it.short ? it.title : undefined}
                            aria-label={count ? `${it.title} (${BADGE_LABEL[it.badgeKey]} ${count})` : it.title}
                          >
                            <span className="hm-icon" aria-hidden="true">
                              <Icon />
                              {count > 0 && <span className="hm-badge hm-badge--dot">{badgeText(count)}</span>}
                            </span>
                            <span className="hm-text">
                              <span className="hm-title-full">{it.title}</span>
                              <span className="hm-title-short">{it.short || it.title}</span>
                              <span className="hm-sub">{it.sub}</span>
                            </span>
                            {count > 0 && <span className="hm-badge hm-badge--pill" aria-hidden="true">{badgeText(count)}</span>}
                            <FaChevronRight className="hm-chevron" aria-hidden="true" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
