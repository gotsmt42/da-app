/**
 * HomeMenu — "เมนูหลัก" บนหน้า Dashboard จัดเป็นหมวดหมู่
 *
 * ✅ ที่มา (ผู้ใช้ขอ 2 รอบ):
 *   1) "เพิ่มเมนูหน้าจอหลักให้ดูง่าย และสวยงาม พร้อมปรับปรุงปุ่มต่างๆ ไม่ให้รก มืออาชีพ" — เดิมทางเข้าหน้าอื่น
 *      กระจายเป็นปุ่ม gradient ใหญ่ 2 ใบ + แบนเนอร์ส้มเต็มแถว + "ทางลัด" ท้ายหน้า คนละหน้าตากันหมด
 *   2) "ยังเรียงไม่เป็นหมวดหมู่ ไม่สวยงาม ดูและใช้งานยาก" — รอบแรกทำเป็นกริดไอคอนก้อนเดียว 12 ช่อง
 *      แยกหมวดด้วยสีอย่างเดียว ตาต้องไล่อ่านทีละช่องถึงจะรู้ว่าอะไรอยู่ตรงไหน
 * ✅ ตอนนี้: แต่ละหมวดเป็นการ์ดของตัวเอง มีหัวหมวดชัดเจน (งาน · เบิกค่าใช้จ่าย · เอกสาร · ข้อมูลหลัก)
 *   • จอกว้าง: การ์ดหมวดวาง 2 คอลัมน์ ข้างในเป็นรายการแนวนอน [ไอคอน] ชื่อ + คำอธิบาย ›  อ่านไล่ลงได้ทันที
 *   • มือถือ:  การ์ดหมวดเรียงลงมา ข้างในเป็นไอคอนแบบหน้าโฮมแอป (หมวดที่มี ≤2 เมนูวางคู่กันครึ่งจอ)
 *
 * ⚠️ ใครเห็นเมนูไหน = เงื่อนไขเดียวกับเมนูข้าง (layouts/Sidebar.js) ทุกรายการ — แก้ที่ Sidebar.js เมื่อไร
 * ต้องแก้ buildHomeMenu ที่นี่ด้วย ไม่งั้นผู้ใช้จะเจอทางลัดไปหน้าที่ไม่มีในเมนูของตัวเอง (หรือกดแล้วเด้งออก)
 */
import { Link } from "react-router-dom";
import {
  FaCalendarAlt, FaChevronRight, FaWallet, FaFolderOpen, FaDatabase, FaGlobeAsia, FaShoppingCart, FaUserClock, FaTools, FaBoxes,
} from "react-icons/fa";

import { can, seesOperationBoard } from "@/shared/utils/roles";
import useAppBadges, { BADGE_LABEL, badgeTone } from "@/shared/hooks/useAppBadges";
// ⚠️ ชื่อ/พาธ/ไอคอน/คีย์ป้ายตัวเลข มาจากทะเบียนกลาง — อย่าพิมพ์ทับที่นี่ ไม่งั้นชื่อจะหลุดจาก
// แถบล่างมือถือและเมนูข้างที่ชี้ปลายทางเดียวกัน (เคยหลุดมาแล้ว: "แผนงาน" / "แผนงานของฉัน" / "ตารางงาน")
import { dest } from "@/layouts/navConfig";
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
  expense: "#0d9488",
  purchase: "#4338ca",
  stock: "#b45309",
  people: "#0891b2",
  docs: "#d97706",
  master: "#2563eb",
  website: "#0f172a",
};

/**
 * @param {object} userData  จาก useAuth()
 * @param {object} [opts]
 * @param {boolean} [opts.hideMyJobs]    ช่างมีการ์ด "งานของฉัน" เด่นอยู่แล้วด้านบน — ไม่ต้องมีซ้ำ
 * @param {boolean} [opts.hideSalesJobs] เซลมีการ์ด "งานขายของฉัน" (/sales) อยู่แล้วด้านบน
 * @returns {Array<{key, title, icon, tone, items: Array<{key, title, short?, sub, href, icon, tone?, badgeKey?}>}>}
 */
export const buildHomeMenu = (userData, { hideMyJobs = false, hideSalesJobs = false } = {}) => {
  // ✅ ตัดสินจากสิทธิ์ล้วน (ตารางสิทธิ์) — ชุดเดียวกับเมนูข้าง/แถบล่าง (ดู Sidebar.js)
  const isAdminOrManager = can(userData, "manageMasterData");
  const seeAllSchedules = can(userData, "viewAllJobs");
  const canSell = can(userData, "createSalesPlan");
  const canRequestDispatch = can(userData, "requestDispatch") && !can(userData, "assignDispatch");
  const canViewFinance = can(userData, "viewFinance");
  const canExpense = can(userData, "requestExpense") || can(userData, "viewAllExpenses");
  // ✅ ทุกคนที่มีขั้นของตัวเองในสายอนุมัติ 3 ส่วน (ตรวจสอบ / อนุมัติ / อนุมัติเบิกจ่าย) เห็นคิวงาน
  const canApproveExpense = can(userData, "reviewExpense") || can(userData, "approveExpense") || can(userData, "disburseExpense");
  const canAssign = can(userData, "assignDispatch");
  const canViewOperation = can(userData, "editOperation") || can(userData, "receiveDispatch");
  const canPlanWork = canViewOperation || canSell || seeAllSchedules || can(userData, "viewServiceCalendar");

  // ── งาน ──────────────────────────────────────────────────────────────────
  // ✅ (11 ต.ค. 2569 ผู้ใช้: "แก้ไขการจัดลำดับเมนู การจัดวาง หมวดหมู่ และ Icon ให้สอดคล้อง สื่อความหมาย")
  //    แยกเป็น 2 หมวดตามบทบาท แทนก้อนเดียว 7 เมนู:
  //      "รับงาน · วางแผน" (คนจัดคิว): งานใหม่ → คำขอลงงาน → ตารางงาน
  //      "ปฏิบัติงาน" (ทุกคนที่ทำงาน): งานของฉัน → การดำเนินงาน → บันทึกเข้างาน → รายงาน
  // ✅ (9 ต.ค. 2569 ผู้ใช้: "เรียงเมนูตามขั้นตอนงาน") รับงาน → คำขอลงงาน → ตารางงาน (วางแผน)
  //    → การดำเนินงาน / งานของฉัน (ทำงาน · ปิดงาน) → รายงาน
  const work = [];
  // ✅ (11 ต.ค. 2569 ผู้ใช้: "หน้าของช่างไม่ต้องมีเมนูงานใหม่") — รับงาน/ส่งลงตาราง เป็นงานของคนจัดคิว (แอดมิน/ผู้จัดการ)
  // 🔁 (15 ต.ค. 2569 ผู้ใช้: "หน้างานใหม่ ให้ช่างเข้ามาดูได้ด้วย แต่ไม่สามารถดำเนินการได้") — ช่างเห็นเมนู (ดูอย่างเดียว)
  if (can(userData, "assignDispatch") || can(userData, "editAnyJob") || can(userData, "receiveDispatch")) work.push(dest("jobIntake"));
  // 🔁 (19 ต.ค. 2569 ผู้ใช้: "หน้าเยอะ ซ้ำซ้อน" → รวมเหลือ 4 หน้าหลัก) คำขอลงงานเป็นแท็บใน "งานเข้า" แล้ว
  if (canAssign && !work.some((it) => it.key === "jobIntake")) work.push(dest("dispatch"));
  if (canRequestDispatch && !hideSalesJobs) work.push(dest("sales"));
  if (canPlanWork) {
    if (seeAllSchedules) {
      work.push(dest("eventService"));
      // ⚠️ "ตารางงานเซล" (/event?dept=sales) ตั้งใจไม่ใส่ในเมนูหลักหน้านี้ — ผู้ใช้สั่งให้เอาออกไปก่อน
      // (ยังเข้าได้ตามปกติจากเมนูข้าง "แผนงาน" และ dropdown บนแถบบน ไม่ได้ปิดฟีเจอร์)
    } else if (can(userData, "viewServiceCalendar")) {
      work.push(dest("eventMine"));
      work.push(dest("eventServiceReadOnly"));
    } else {
      work.push(dest(canViewOperation ? "eventOwn" : "eventMine"));
    }
  }
  const doWork = [];
  // ✅ (11 ต.ค. 2569) ทุกคนที่ถูกมอบหมายงานได้ (ช่าง · แอดมิน/ผู้จัดการที่เป็นผู้รับผิดชอบ) — ขึ้นก่อน (ใช้บ่อยสุด)
  // ✅ (11 ต.ค. 2569 ผู้ใช้: "หน้าแอดมินไม่ควรมีเมนูงานของฉัน ให้มีแค่ของช่าง") — เฉพาะช่าง (receiveDispatch)
  if (can(userData, "receiveDispatch") && !hideMyJobs) doWork.push(dest("myJobs"));
// 🔁 (15 ต.ค. 2569 ผู้ใช้เลือก "ช่างใช้งานของฉันที่เดียว") — ช่าง (รับงานอย่างเดียว) ไม่เห็นหน้าการดำเนินงานแล้ว · ทำงานที่ "งานของฉัน"
  if (seesOperationBoard(userData)) doWork.push(dest("operation"));
  // ✅ (10 ต.ค. 2569) บันทึกเข้างาน — ผู้ดูงานทั้งหมด/ผู้อนุมัติแก้เวลา
  // ประวัติเข้างาน / รายงานงาน เป็นแท็บใน "การดำเนินงาน" — เมนูแยกเฉพาะคนที่ไม่เห็นหน้าการดำเนินงาน
  if ((can(userData, "viewAllJobs") || can(userData, "approveJobs")) && !seesOperationBoard(userData)) doWork.push(dest("attendance"));
  // 🧹 "ภาพรวมงาน" ถูกตัดออกจากเมนูหลักตามที่ผู้ใช้สั่ง — เดิมปลายทางนี้โผล่พร้อมกัน 3 ที่ในจอเดียว
  // (ชิปบนแถบบน + ปุ่มตรงนี้ + ช่องบนแถบเมนูล่าง) พร้อมป้ายตัวเลขเดียวกันทั้งสามจุด
  // ⚠️ ยังเข้าได้ตามปกติจากแถบเมนูล่าง (มือถือ) และเมนูข้าง (ทุกจอ) — ไม่ได้ตัดทางเข้าทิ้ง
  // ✅ ผู้ใช้สั่งให้หมวด "งาน" มีรายงานเหมือนหมวด "เบิกค่าใช้จ่าย" — วางท้ายหมวดตำแหน่งเดียวกัน
  // ⚠️ เห็นเฉพาะคนที่เห็นหน้าการดำเนินงาน เพราะรายงานสรุปจากข้อมูลชุดเดียวกันเป๊ะ
  // 🔁 (21 ต.ค. 2569 ผู้ใช้: "เอกสารไม่ควรรวมกับใบเสนอราคา") ติดตามใบเสนอราคาเป็นขั้นต่อจากงาน — อยู่หมวดงาน
  if (canViewFinance) doWork.push(dest("finance"));
  if (canViewOperation && !seesOperationBoard(userData)) doWork.push(dest("jobReport"));

  // ── เบิกค่าใช้จ่าย ────────────────────────────────────────────────────────
  // ✅ วางต่อจากหมวดงานทันที — ผู้ใช้เลือกใบ Advance/ใบเคลมเป็นเมนูหลักบนแถบล่างมือถือ = ใช้บ่อยรองจากงาน
  const expense = [];
  if (canExpense) {
    expense.push(dest("advance"));
    // ⚠️ ไม่ใส่ tone เอง — ใช้สีของหมวด "เบิกค่าใช้จ่าย" เหมือนปุ่มอื่นในแถวเดียวกัน
    // (เคยทาสีม่วงของ "ชนิดเอกสาร" ไว้ที่ปุ่มนี้ปุ่มเดียว ผู้ใช้ดูของจริงแล้วบอกว่าโดดออกมาจากเพื่อนในแถว —
    // สีประจำชนิดใบยังอยู่ครบในหน้าใบเคลมเอง ตรงนี้เป็นแค่ปุ่มทางเข้า)
    expense.push(dest("claim"));
    expense.push(dest("contractorPay"));
    // ✅ คิวงานของผู้ดำเนินการแต่ละขั้น (ตรวจสอบ/อนุมัติ/อนุมัติเบิกจ่าย) เพิ่มอีกเมนู
    if (canApproveExpense) {
      expense.push(dest("expenseInbox"));
    }
    expense.push(dest("expenseReport"));
  }

  // ── จัดซื้อ · บุคคล ───────────────────────────────────────────────────────
  // ✅ ผู้ใช้สั่ง "แยกจุดวาง และหมวดหมู่ให้สอดคล้องแบบมืออาชีพ" (2 ต.ค. 2569) — เดิม OT กับใบขอซื้อ
  // ไปต่อท้ายหมวดเบิกค่าใช้จ่าย ทั้งที่เป็นคนละเรื่อง (ขอซื้อของ ≠ เบิกเงิน · OT = เวลาทำงานของพนักงาน)
  // ⚠️ สิทธิ์ยังเป็นชุดเดียวกับระบบเบิก (canExpense) — แยกแค่ "หมวด" ไม่ได้แยกสิทธิ์
  // ✅ (10 ต.ค. 2569) จัดซื้อใช้สิทธิ์ของตัวเอง (requestPurchase) — ฝ่ายขายขอซื้อได้โดยไม่มีเมนูเบิก
  const purchase = can(userData, "requestPurchase") || can(userData, "viewAllExpenses") ? [dest("purchase"), dest("purchaseReport")] : [];
  // ✅ (27 ต.ค. 2569 ผู้ใช้: "เอาระบบทำโอทีกลับมา แต่ไม่ต้องระบุเงิน แค่กรอกชั่วโมง อิงงาน") — เปิดเมนู OT กลับมา (สิทธิ์ชุดเดียวกับระบบเบิก)
  const people = canExpense ? [dest("ot")] : [];
  // ✅ (27 ต.ค. 2569) สต๊อก · ทรัพย์สินแผนก — สิทธิ์ของตัวเอง
  const stock = can(userData, "requestStock") || can(userData, "manageStock") ? [dest("stock")] : [];

  // ── เอกสาร ──────────────────────────────────────────────────────────────
  const docs = [];
  if (can(userData, "viewDocuments")) docs.push(dest("documents"));

  // ── ข้อมูลหลัก ────────────────────────────────────────────────────────────
  const master = [];
  if (isAdminOrManager) {
    master.push(dest("customers"));
    master.push(dest("staff"));
  }

  // ── เว็บไซต์บริษัท ───────────────────────────────────────────────────────
  const website = [];
  if (can(userData, "viewLeads")) website.push(dest("webLeads"));
  if (can(userData, "manageWebsite")) {
    website.push(dest("webProducts"), dest("webProjects"), dest("webArticles"), dest("webSettings"));
  }

  // ช่าง/คนที่ไม่ได้จัดคิว (ไม่มีงานใหม่/คำขอลงงาน) — เหลือแค่ตารางงาน → รวมเข้าหมวด "ปฏิบัติงาน" ใบเดียว
  // ✅ (19 ต.ค. 2569) หมวดงานเหลือหมวดเดียว "งาน" เรียงตามขั้นตอน: งานเข้า → ตารางงาน → การดำเนินงาน/งานของฉัน
  doWork.unshift(...work);
  work.length = 0;

  return [
    { key: "work", title: "รับงาน · วางแผน", icon: FaCalendarAlt, tone: TONE.work, items: work },
    { key: "do", title: "งาน", icon: FaTools, tone: TONE.work, items: doWork },
    { key: "expense", title: "เบิกค่าใช้จ่าย", icon: FaWallet, tone: TONE.expense, items: expense },
    // 🔁 (19 ต.ค. 2569 ผู้ใช้: "ไม่ต้องมีคำว่าการเงิน ไม่ได้เน้น และสลับจุดแสดงกับจัดซื้อ")
    // 🔁 (21 ต.ค. 2569 ผู้ใช้: "หน้าแรกสลับหมวดตำแหน่งเอกสาร และจัดซื้อ")
    { key: "purchase", title: "จัดซื้อ", icon: FaShoppingCart, tone: TONE.purchase, items: purchase },
    { key: "stock", title: "คลังแผนก", icon: FaBoxes, tone: TONE.stock, items: stock },
    { key: "people", title: "บุคคล", icon: FaUserClock, tone: TONE.people, items: people },
    { key: "docs", title: "เอกสาร", icon: FaFolderOpen, tone: TONE.docs, items: docs },
    { key: "master", title: "ข้อมูลหลัก", icon: FaDatabase, tone: TONE.master, items: master },
    { key: "website", title: "เว็บไซต์บริษัท", icon: FaGlobeAsia, tone: TONE.website, items: website },
  ].filter((cat) => cat.items.length);
};

const badgeText = (n) => (n > 99 ? "99+" : String(n));

/**
 * 🎨 (27 ต.ค. 2569 ผู้ใช้: "หน้าแรก ปุ่มเริ่มเยอะ และรก มีวิธีเรียงและจัดการยังไงให้สวยงาม ดูง่าย ใช้งานง่าย")
 *   เดิม: การ์ดแยกทุกหมวด (8 ใบ) ปุ่มใหญ่ + คำอธิบายใต้ปุ่ม → หน้ายาว ที่ว่างเยอะ หาไม่เจอ
 *   ตอนนี้ 2 ส่วน:
 *     1. "ต้องดำเนินการ" — เฉพาะเมนูที่มีตัวเลขค้าง เรียงจากมากไปน้อย (กดจากตรงนี้ได้เลย ไม่ต้องหา)
 *     2. "เมนูทั้งหมด" — การ์ดเดียว หมวดละแถว: ชื่อหมวดซ้าย · ไอคอนเล็กเรียงขวา (มือถือ: หัวหมวด + 4 ช่องต่อแถว)
 *        คำอธิบายย้ายไปเป็น tooltip — หน้าจอเหลือแต่ชื่อ อ่านเร็ว
 *   สี: คงสีประจำหมวดตามเดิม (ผู้ใช้เคยให้คงไว้) แต่ใช้เป็นพื้นอ่อนของไอคอนเท่านั้น ไม่ทาทั้งปุ่ม
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
  const countOf = (it) => (it.badgeKey ? Number(counts[it.badgeKey]) || 0 : 0);

  // ── ต้องดำเนินการ: เมนูที่มีเลขค้าง (ไม่ซ้ำปลายทาง) เรียงมาก → น้อย ──
  const seen = new Set();
  const todo = cats.flatMap((c) => c.items.map((it) => ({ ...it, tone: it.tone || c.tone })))
    .filter((it) => countOf(it) > 0 && !seen.has(it.href) && seen.add(it.href))
    .sort((a, b) => (badgeTone(a.badgeKey, badges) === "act" ? 0 : 1) - (badgeTone(b.badgeKey, badges) === "act" ? 0 : 1) || countOf(b) - countOf(a));

  // ✅ (27 ต.ค. 2569 ผู้ใช้เลือก "การ์ดรายการตัวอักษร")
  // 🔁 (ผู้ใช้: "จัดหมู่ใหม่ให้แยกกัน และมองง่ายชัดเจน") — เลิกรวมหมวดเล็ก หมวดละการ์ดตามเมนูข้าง
  //    การ์ดหัวสีอ่อนประจำหมวด + จำนวนเมนู · จอกว้าง 4 คอลัมน์ การ์ดสูงเท่ากันในแถว
  const cards = cats.map((c) => ({ ...c, items: c.items.map((it) => ({ ...it, tone: it.tone || c.tone })) }));

  return (
    <nav className="hm" aria-label="เมนูหลัก">
      {todo.length > 0 && (
        <section className="hm-todo" aria-labelledby="hm-todo-title">
          <h6 className="hm-sec-title" id="hm-todo-title">ต้องดำเนินการ</h6>
          <ul className="hm-todo-list">
            {todo.map((it) => {
              const Icon = it.icon;
              const n = countOf(it);
              const tone = badgeTone(it.badgeKey, badges);
              return (
                <li key={it.key}>
                  <Link to={it.href} className="hm-todo-item" style={{ "--hm-tone": it.tone }} title={BADGE_LABEL[it.badgeKey]}
                    aria-label={`${it.title} (${BADGE_LABEL[it.badgeKey]} ${n})`}>
                    <span className="hm-todo-icon" aria-hidden="true"><Icon /></span>
                    <span className="hm-todo-text">
                      <span className="hm-todo-name">{it.title}</span>
                      <span className="hm-todo-sub">{BADGE_LABEL[it.badgeKey] || it.sub}</span>
                    </span>
                    <span className={`hm-todo-count hm-todo-count--${tone}`}>{badgeText(n)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="hm-all-title">
        <h6 className="hm-sec-title" id="hm-all-title">เมนูทั้งหมด</h6>
        <div className="hm-cards">
          {cards.map((cat) => {
            const CatIcon = cat.icon;
            return (
              <div key={cat.key} className="hm-card" style={{ "--hm-tone": cat.tone }}>
                <div className="hm-card-head" id={`hm-cat-${cat.key}`}>
                  <span className="hm-card-icon" aria-hidden="true"><CatIcon /></span>
                  <span className="hm-card-title">{cat.title}</span>
                  <span className="hm-card-count">{cat.items.length}</span>
                </div>
                <ul className="hm-links" aria-labelledby={`hm-cat-${cat.key}`}>
                  {cat.items.map((it) => {
                    const Icon = it.icon;
                    const n = countOf(it);
                    return (
                      <li key={it.key}>
                        <Link to={it.href} className="hm-link" style={{ "--hm-tone": it.tone }} title={it.sub || undefined}
                          aria-label={n ? `${it.title} (${BADGE_LABEL[it.badgeKey]} ${n})` : it.title}>
                          <span className="hm-link-icon" aria-hidden="true"><Icon /></span>
                          <span className="hm-link-text hm-title-full">{it.title}</span>
                          <span className="hm-link-text hm-title-short">{it.short || it.title}</span>
                          {n > 0
                            ? <span className={`hm-link-count hm-link-count--${badgeTone(it.badgeKey, badges)}`}>{badgeText(n)}</span>
                            : <FaChevronRight className="hm-link-chev" aria-hidden="true" />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </nav>
  );
}
