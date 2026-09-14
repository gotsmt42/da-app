/**
 * pageTitle.js — ชื่อหน้าภาษาไทยของแต่ละ URL
 *
 * ✅ ใช้ที่กลางแถบบน "เฉพาะจอมือถือ" (Header.js) — จอมือถือซ่อนเมนูกลางแถบไว้ทั้งแถว พื้นที่ตรงนั้นจึง
 * ว่างเปล่า และที่สำคัญกว่านั้นคือ "ไม่มีอะไรบอกว่ากำลังอยู่หน้าไหน" เลย: แถบเมนูล่างไฮไลต์ได้แค่ 5
 * ปลายทางที่อยู่บนแถบ (MobileBottomNav.js) ส่วนหน้าอื่นอีกสิบกว่าหน้า (ลูกค้า · พนักงาน · เอกสาร ·
 * รายงานการเบิก · คำขอลงงาน ฯลฯ) เปิดแล้วแถบล่างมืดทั้งแถบ
 * ⚠️ เป็น "ป้ายบอกตำแหน่ง" ไม่ใช่เมนู — กดไม่ได้โดยตั้งใจ เพราะทางเข้าทุกหน้ามีอยู่แล้วที่แถบล่าง/เมนูข้าง
 * (ผู้ใช้เคยแจ้งว่าปุ่มปลายทางเดียวกันโผล่ซ้ำหลายจุดในจอเดียวแล้วดูรก)
 *
 * ⚠️ ชื่อต้องตรงกับที่เมนูข้าง (Sidebar.js) และแถบล่าง (MobileBottomNav.js) เรียกหน้าเดียวกัน —
 * ผู้ใช้กดเมนูชื่อหนึ่งแล้วแถบบนขึ้นอีกชื่อหนึ่ง = สับสนกว่าไม่ใส่อะไรเลย
 * ⚠️ สั้นเข้าไว้ (~14 ตัวอักษร) พื้นที่กลางแถบบนมือถือกว้างราว 180px เท่านั้น ยาวกว่านี้โดนตัดเป็น "…"
 * ⚠️ "/event" ไม่อยู่ในตารางนี้ — ชื่อของมันต่างกันตาม role และ ?dept= (ดู scheduleOptionsFor ใน
 * navConfig/Header) Header จึงส่งชื่อที่คำนวณไว้แล้วเข้ามาทาง override แทน
 */
import {
  FaHome, FaWrench, FaFileContract, FaFileInvoiceDollar, FaFileAlt, FaMoneyCheckAlt, FaReceipt,
  FaInbox, FaChartBar, FaClipboardList, FaClipboardCheck, FaPaperPlane, FaBuilding, FaUserFriends,
  FaUserCircle, FaCog, FaBoxOpen, FaLayerGroup,
} from "react-icons/fa";

/**
 * [path, ชื่อไทย, ไอคอน] — เรียง "เจาะจงที่สุดก่อน" เสมอ
 * ⚠️ /expenses/advances ต้องมาก่อน /expenses ไม่งั้นทุกหน้าในระบบเบิกจะขึ้นชื่อเดียวกันหมด
 * (กฎเดียวกับลำดับ route ฝั่ง server ที่ path ตายตัวต้องมาก่อน /:id)
 */
const TITLES = [
  ["/dashboard", "หน้าหลัก", FaHome],
  ["/operation", "การดำเนินงาน", FaWrench],
  ["/contracts", "ภาพรวมงาน", FaFileContract],
  ["/quotations", "ติดตามใบเสนอราคา", FaFileInvoiceDollar],
  ["/finance", "ใบเสนอราคา", FaFileInvoiceDollar],
  ["/documents", "เอกสาร", FaFileAlt],
  ["/expenses/advances", "ใบเบิก Advance", FaMoneyCheckAlt],
  ["/expenses/claims", "ใบเคลม", FaReceipt],
  ["/expenses/approvals", "รออนุมัติการเบิก", FaInbox],
  ["/expenses/report", "รายงานการเบิก", FaChartBar],
  ["/expenses", "ใบเบิกค่าใช้จ่าย", FaMoneyCheckAlt],
  ["/technician/jobs", "งานของฉัน", FaClipboardList],
  ["/dispatch", "คำขอลงงาน", FaClipboardCheck],
  ["/sales", "แจ้งงานให้ช่าง", FaPaperPlane],
  ["/customers", "ลูกค้า", FaBuilding],
  ["/customer-overview", "ภาพรวมลูกค้า", FaBuilding],
  ["/staff", "พนักงาน / ทีมช่าง", FaUserFriends],
  ["/team-workload", "ภาระงานทีม", FaLayerGroup],
  ["/issued-documents", "เอกสารที่ออกแล้ว", FaFileAlt],
  ["/billing", "วางบิล", FaFileInvoiceDollar],
  ["/product/stock", "สต๊อกสินค้า", FaBoxOpen],
  ["/product", "สินค้า", FaBoxOpen],
  ["/worktype", "ประเภทงาน / ระบบ", FaCog],
  ["/account", "บัญชีของฉัน", FaUserCircle],
  ["/about", "การตั้งค่า", FaCog],
];

/**
 * @param {string} pathname จาก useLocation()
 * @returns {{label: string, Icon: Function} | null} null = ไม่รู้จักหน้านี้ ให้ปล่อยว่างไว้ดีกว่าเดาผิด
 */
export const pageTitleFor = (pathname) => {
  const path = String(pathname || "").replace(/\/+$/, "") || "/";
  const hit = TITLES.find(([p]) => path === p || path.startsWith(`${p}/`));
  return hit ? { label: hit[1], Icon: hit[2] } : null;
};

export default pageTitleFor;
