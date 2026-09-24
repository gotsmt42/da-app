/**
 * navConfig.js — ทะเบียน "ปลายทางของเมนู" กลางของทั้งแอป
 *
 * 🐛 ปัญหาที่แก้: ปลายทางเดียวกันมีทางเข้าได้ถึง 4 ที่ (การ์ดหน้าแรก · แถบล่างมือถือ · เมนูข้าง ·
 *    แถบบน) และแต่ละที่เคยเก็บชื่อ/ไอคอน/พาธ/คีย์ป้ายตัวเลข "ของตัวเอง" คนละไฟล์
 *    ผลคือชื่อหลุดกันจริงมาแล้ว — ปลายทางเดียวกันถูกเรียกว่า "แผนงาน" บ้าง "แผนงานของฉัน" บ้าง
 *    "ตารางงาน" บ้าง และหน้าตั้งค่ายังชี้ไปพาธเก่า (/customer, /employee) ที่เป็นแค่ตัว redirect
 * ✅ ตอนนี้ชื่อ/พาธ/ไอคอน/คีย์ป้ายตัวเลข อยู่ที่ DEST ที่เดียว — แก้ทีเดียวเปลี่ยนครบทุกจุด
 *
 * ⚠️ ไฟล์นี้เก็บ "ปลายทางคืออะไร" เท่านั้น ไม่เก็บ "ใครเห็นบ้าง" — เงื่อนไขสิทธิ์ยังอยู่ที่ตัว
 *    แต่ละหน้าจอโดยตั้งใจ เพราะแต่ละที่จงใจไม่เหมือนกัน (เช่น "ภาพรวมงาน" ถูกตัดออกจากเมนูหลัก
 *    หน้าแรกตามที่ผู้ใช้สั่ง แต่ยังอยู่บนแถบล่างและเมนูข้าง) รวมสิทธิ์เข้ามาด้วยจะกลืนการตัดสินใจ
 *    เหล่านั้นทิ้งหมด
 * ⚠️ ไม่มี JSX ในไฟล์นี้ — icon เก็บเป็น "คอมโพเนนต์" ไม่ใช่ element ที่สร้างไว้แล้ว
 *    ฝั่งที่ต้องการ element ให้เขียน <Icon /> เอง (เมนูข้างทำแบบนั้น)
 */
import {
  FaHome, FaTachometerAlt, FaCalendarAlt, FaWrench, FaBriefcase, FaClipboardList,
  FaClipboardCheck, FaPaperPlane, FaMoneyCheckAlt, FaReceipt, FaInbox, FaChartBar,
  FaFileAlt, FaFileInvoiceDollar, FaFileContract, FaBuilding, FaUserFriends,
  FaCog, FaTags, FaImage, FaUserShield, FaBoxOpen, FaImages, FaNewspaper, FaSlidersH, FaEnvelopeOpenText,
} from "react-icons/fa";
import { DEPARTMENT } from "@/shared/utils/roles";

/**
 * ทะเบียนปลายทางทั้งหมด
 *   title    ชื่อเต็ม — ใช้เป็นค่าตั้งต้นทุกที่
 *   short    ชื่อสั้น — ใช้ได้ทั้งการ์ดหน้าแรกและแถบล่าง ไม่มีก็ใช้ title
 *   bar      ชื่อสั้นพิเศษเฉพาะแถบล่างมือถือ (ช่องกว้างราว 70px) — ใช้เมื่อสั้นกว่า short อีกขั้น
 *            🐛 เคยพลาด: เอาชื่อของแถบล่างไปใส่ช่อง short ทำให้การ์ดหน้าแรกเปลี่ยนจาก
 *               "การดำเนินงาน" เป็น "ดำเนินงาน" ตามไปด้วยโดยไม่ได้ตั้งใจ
 *   sub      คำขยายใต้ชื่อ — ใช้บนการ์ดหน้าแรกที่มีที่ให้อธิบาย
 *   badgeKey คีย์ป้ายตัวเลขจาก useAppBadges — ต้องเป็นคีย์เดียวกันทุกที่ ไม่งั้นเลขไม่ตรงกัน
 */
export const DEST = {
  home: { title: "หน้าหลัก", href: "/dashboard", icon: FaHome },
  dashboard: { title: "ภาพรวม", href: "/dashboard", icon: FaTachometerAlt },

  /** ปฏิทินงาน — ความหมายของ /event ต่างกันตามสิทธิ์ ดู scheduleOptionsFor */
  eventService: { title: "ตารางงานช่าง", sub: "ปฏิทินงานบริการ", href: "/event", icon: FaCalendarAlt, badgeKey: "pendingApproval" },
  eventMine: { title: "แผนงานของฉัน", bar: "แผนงาน", sub: "นัดหมายของฉัน", href: "/event", icon: FaCalendarAlt, badgeKey: "pendingApproval" },
  eventOwn: { title: "ตารางงาน", sub: "ปฏิทินงาน", href: "/event", icon: FaCalendarAlt, badgeKey: "pendingApproval" },
  eventServiceReadOnly: { title: "ตารางงานช่าง", sub: "ดูอย่างเดียว", href: `/event?dept=${DEPARTMENT.SERVICE}`, icon: FaWrench },
  eventSales: { title: "ตารางงานเซล", href: "/event?dept=sales", icon: FaBriefcase },

  operation: { title: "การดำเนินงาน", bar: "ดำเนินงาน", sub: "เช็คอิน · ปิดงาน", href: "/operation", icon: FaWrench, badgeKey: "closeRequests" },
  jobReport: { title: "รายงานงาน", short: "รายงาน", sub: "สรุปสถานะ · รายเดือน · ตามลูกค้า/ทีม", href: "/jobs/report", icon: FaChartBar },
  myJobs: { title: "งานของฉัน", sub: "งานที่ได้รับมอบหมาย", href: "/technician/jobs", icon: FaClipboardList, badgeKey: "myJobs" },
  contracts: { title: "ภาพรวมงาน", href: "/contracts", icon: FaFileContract, badgeKey: "contracts" },
  dispatch: { title: "คำขอลงงาน", sub: "คิวรอมอบหมาย", href: "/dispatch", icon: FaClipboardCheck, badgeKey: "dispatchQueue" },
  sales: { title: "แจ้งงานให้ช่าง", bar: "แจ้งงาน", sub: "ส่งงานเข้าคิวช่าง", href: "/sales", icon: FaPaperPlane, badgeKey: "dispatchMine" },

  advance: { title: "ใบเบิก Advance", short: "ใบ Advance", sub: "เบิกเงินล่วงหน้า", href: "/expenses/advances", icon: FaMoneyCheckAlt, badgeKey: "advance" },
  claim: { title: "ใบเคลม", sub: "เคลียร์ค่าใช้จ่าย", href: "/expenses/claims", icon: FaReceipt, badgeKey: "claim" },
  expenseInbox: { title: "รอดำเนินการ", sub: "ตรวจสอบ · อนุมัติ · เบิกจ่าย", href: "/expenses/approvals", icon: FaInbox, badgeKey: "expenseInbox" },
  expenseReport: { title: "รายงานการเบิก", short: "รายงาน", sub: "ยอดค้าง · ย้อนหลัง", href: "/expenses/report", icon: FaChartBar },

  documents: { title: "เอกสาร", sub: "ไฟล์ · เอกสารออก", href: "/documents", icon: FaFileAlt },
  finance: { title: "ใบเสนอราคา / การเงิน", short: "ใบเสนอราคา", sub: "ติดตาม · วางบิล", href: "/finance", icon: FaFileInvoiceDollar, badgeKey: "quotations" },

  // ⚠️ /customers และ /staff คือพาธจริง ส่วน /customer และ /employee เป็นแค่ตัว redirect ของเก่า
  //    ชี้ไปพาธจริงเสมอ ไม่งั้นผู้ใช้ต้องเด้งสองต่อกว่าจะถึงหน้า
  customers: { title: "ลูกค้า", sub: "ทะเบียนลูกค้า", href: "/customers", icon: FaBuilding },
  staff: { title: "พนักงาน / ทีมช่าง", short: "พนักงาน", sub: "ภาระงาน · ทะเบียน", href: "/staff", icon: FaUserFriends },

  settings: { title: "ตั้งค่า", href: "/about", icon: FaCog },
  // ⚠️ เดิมชื่อ "ประเภทงาน / ระบบ" — คำว่า "ระบบ" ตรงนี้หมายถึงระบบงาน (ไฟฟ้า/ประปา) แต่ไปอยู่
  //    ในหน้าเดียวกับหมวด "ตั้งค่าระบบ" ที่แปลว่า system settings คนละเรื่องกันแต่ใช้คำเดียวกัน
  worktype: { title: "ประเภทงานและระบบงาน", sub: "ตัวเลือกที่ใช้ตอนเพิ่ม/แก้ไขแผนงาน", href: "/worktype", icon: FaTags },
  orgSettings: { title: "ตั้งค่าองค์กร", sub: "โลโก้ · ข้อมูลบริษัทบนเอกสาร · ช่องทางติดต่อบนหัวเว็บ · ค่าตั้งต้นของระบบเบิก", href: "/settings/organization", icon: FaImage },
  // ── เว็บไซต์บริษัท (da-web) — แก้เนื้อหาบนเว็บสาธารณะ + รับคำขอจากลูกค้า ──
  webLeads: { title: "คำขอจากเว็บไซต์", short: "คำขอจากเว็บ", sub: "ติดต่อ · ขอใบเสนอราคา", href: "/website/leads", icon: FaEnvelopeOpenText, badgeKey: "webLeads" },
  webProducts: { title: "สินค้าบนเว็บ", sub: "รูป · สเปก · Datasheet", href: "/website/products", icon: FaBoxOpen },
  webProjects: { title: "ผลงานบนเว็บ", sub: "โครงการที่ส่งมอบ", href: "/website/projects", icon: FaImages },
  webArticles: { title: "บทความ", sub: "ความรู้ · SEO", href: "/website/articles", icon: FaNewspaper },
  webSettings: { title: "การแสดงผลเว็บไซต์", short: "การแสดงผล", sub: "ตัวเลข · ยี่ห้อ · เวลาทำการ", href: "/website/settings", icon: FaSlidersH },
  permissions: { title: "ตั้งค่าสิทธิ์", sub: "สิทธิ์ในระบบ (ผู้ดูแลระบบ) · สิทธิ์ตามตำแหน่งในองค์กร", href: "/settings/permissions", icon: FaUserShield },
};

/**
 * หยิบปลายทางมาหนึ่งอัน พร้อมทับค่าเฉพาะจุดได้ (เช่นสีประจำหมวดของการ์ดหน้าแรก)
 * @param {keyof DEST} key
 * @param {object} [extra] ค่าที่อยากทับ — ห้ามใช้ทับ title/href เพื่อเลี่ยงการกลับไปมีชื่อคนละแบบอีก
 */
export const dest = (key, extra) => {
  const base = DEST[key];
  if (!base) throw new Error(`navConfig: ไม่รู้จักปลายทาง "${key}"`);
  return { key, ...base, ...extra };
};

/** ชื่อสำหรับช่องบนแถบล่างมือถือ — สั้นที่สุดเท่าที่มี */
export const barTitle = (item) => item.bar || item.short || item.title;

/**
 * ✅ ตัวเลือกของเมนู "ตารางงาน" — ต่างกันตามสิทธิ์เพราะ query ?dept= มีความหมายไม่เหมือนกัน
 * (ดู departmentScope ฝั่ง server)
 *   • แอดมิน/ผู้จัดการ: "/event" เฉยๆ = ตารางงานช่าง · "/event?dept=sales" = ตารางงานเซล
 *   • เซล: "/event" เฉยๆ = แผนงานของฉัน · "/event?dept=service" = ตารางงานช่าง (ดูอย่างเดียว)
 * ⚠️ แอดมินไม่มีแนวคิด "แผนงานของฉัน" แยกจาก "ตารางงานช่าง" เพราะไม่ได้เป็นคนลงตารางเข้างานเอง
 *    ใช้ตัวเลือกชุดของเซลกับแอดมินไม่ได้ (ผิดความหมาย ไม่ใช่แค่ผิดคำ)
 */
export const scheduleOptionsFor = (isAdminOrManagerRole) =>
  isAdminOrManagerRole
    ? { primary: dest("eventService"), secondary: { ...dest("eventSales"), dept: "sales" } }
    : { primary: dest("eventMine"), secondary: { ...dest("eventServiceReadOnly"), dept: DEPARTMENT.SERVICE } };

/**
 * เมนูตรงกับหน้าที่เปิดอยู่ไหม — เทียบทั้ง pathname และ query แบบเป๊ะๆ ไม่ใช่แค่ startsWith
 * 🐛 บั๊กที่ป้องกัน: "/event" กับ "/event?dept=sales" pathname เดียวกัน ถ้าเทียบแค่ path
 *    ทั้งคู่จะติดสว่างพร้อมกันเสมอ แยกไม่ออกว่ากำลังดูปฏิทินไหนอยู่
 */
export const isActiveHref = (location, href) => {
  if (!href) return false;
  const [path, query = ""] = href.split("?");
  if (location.pathname !== path) return false;
  const current = location.search.replace(/^\?/, "");
  return query ? current === query : current === "";
};
