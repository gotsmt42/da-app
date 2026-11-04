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
// 🔁 (1 พ.ย. 2569 ผู้ใช้: "icon หน้าอื่นๆ ให้สอดคล้องกับหน้าแรก") — FontAwesome → Material Rounded ชุดกลาง
//    (ห่อให้รับ size แบบ react-icons ได้ จุดที่เรียก <Icon size={14} /> ไม่ต้องแก้ — ดู shared/ui/appIcons.js)
import { AppIcon } from "@/shared/ui/appIcons";
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
  home: { title: "หน้าหลัก", href: "/dashboard", icon: AppIcon.Home },
  dashboard: { title: "ภาพรวม", href: "/dashboard", icon: AppIcon.Dashboard },

  /** ปฏิทินงาน — ความหมายของ /event ต่างกันตามสิทธิ์ ดู scheduleOptionsFor */
  eventService: { title: "ตารางงานช่าง", sub: "ปฏิทินงานบริการ", href: "/event", icon: AppIcon.Calendar },
  // ✅ (9 ต.ค. 2569 ผู้ใช้: "icon ให้สอดคล้องสื่อความหมาย") นัดหมายของฉัน = ปฏิทินมีเครื่องหมายถูก · ตารางงานช่าง = ปฏิทิน
  //    ประแจใช้กับ "การดำเนินงาน" อย่างเดียว ไม่ปนกับตารางงาน
  eventMine: { title: "แผนงานของฉัน", bar: "แผนงาน", sub: "นัดหมายของฉัน", href: "/event", icon: AppIcon.CalendarMine },
  eventOwn: { title: "ตารางงาน", sub: "ปฏิทินงาน", href: "/event", icon: AppIcon.Calendar },
  eventServiceReadOnly: { title: "ตารางงานช่าง", sub: "ดูอย่างเดียว", href: `/event?dept=${DEPARTMENT.SERVICE}`, icon: AppIcon.Calendar },
  eventSales: { title: "ตารางงานฝ่ายขาย", href: "/event?dept=sales", icon: AppIcon.Sales },

  operation: { title: "การดำเนินงาน", bar: "ดำเนินงาน", sub: "ทุกงาน · เข้างาน · รายงาน", href: "/operation", icon: AppIcon.Operation, badgeKey: "opsInbox" },
  // ✅ (9 ต.ค. 2569) งานที่ต้องตามต่อ แยกตามขั้นตอน — รับงาน · รอลงแผน · ยังไม่รับงาน · งานไม่เสร็จ · รอปิดงาน
  // ✅ ขั้นที่ 1 "รับงาน" — รับงานจากลูกค้า/LINE/ฝ่ายขาย เก็บเป็นงานรอลงแผน (ผู้ใช้เลือก 9 ต.ค. 2569: เมนูแรกของหมวดงาน)
  // ✅ (9 ต.ค. 2569 ผู้ใช้) ชื่อเมนู "งานใหม่" + ไอคอนเอกสารมีเครื่องหมายบวก (งานที่เพิ่งรับเข้ามา) — ชุดเดียวกับหัวหน้าเพจ
  jobIntake: { title: "งานเข้า", sub: "รับงาน · คำขอลงงาน", href: "/jobs/intake", icon: AppIcon.Intake, badgeKey: "jobsInbox" },
  // ✅ (10 ต.ค. 2569) เช็คอิน/เช็คเอาต์ของช่าง — รายการเข้า-ออกงาน · ชั่วโมงทำงาน · คำขอแก้เวลา
  attendance: { title: "ประวัติบันทึกการเข้างาน", sub: "เข้างาน · รูปหน้างาน · แก้เวลา", href: "/attendance", icon: AppIcon.Attendance, badgeKey: "attendanceFixes" },
  jobWorkers: { title: "ผลงานรายบุคคล", short: "รายบุคคล", sub: "ใครเข้างานไหน · มูลค่าต่อครั้ง · รายเดือน/ปี", href: "/jobs/workers", icon: AppIcon.Contractor },
  jobReport: { title: "สรุปผลการดำเนินงาน", short: "สรุปงาน", sub: "สถานะ · งานค้าง · รายเดือน · มูลค่างาน", href: "/jobs/report", icon: AppIcon.Report },
  // ✅ (11 ต.ค. 2569 ผู้ใช้: "Icon ให้สอดคล้อง สื่อความหมาย ไม่ใส่มั่ว") — คน + เครื่องหมายถูก = งานที่มอบหมายให้ฉัน
  myJobs: { title: "งานของฉัน", sub: "งานที่ได้รับมอบหมาย", href: "/technician/jobs", icon: AppIcon.MyJobs, badgeKey: "myJobs" },
  contracts: { title: "ภาพรวมงาน", href: "/contracts", icon: AppIcon.Contract, badgeKey: "contracts" },
  // ✅ หน้าเดียวกับ "ภาพรวมงาน" แต่เปิดที่ "ปิดแล้ว · ประวัติ" — สัญญาหมดอายุ (รอต่อสัญญา) + งานที่เข้างานครบแล้ว
  contractsClosed: { title: "งานปิดแล้ว · ประวัติ", short: "งานปิดแล้ว", sub: "รอต่อสัญญา · เข้าครบ", href: "/contracts?view=closed", icon: AppIcon.Archive },
  // ✅ (11 ต.ค. 2569) ถาดรับเข้า = คำขอที่ส่งเข้ามารอจัดคิว (เดิมใช้รูปคลิปบอร์ดติ๊กถูก ซึ่งสื่อว่า "อนุมัติแล้ว")
  dispatch: { title: "คำขอลงงาน", sub: "คิวรอมอบหมาย", href: "/dispatch", icon: AppIcon.Inbox, badgeKey: "dispatchQueue" },
  sales: { title: "แจ้งงานให้ช่าง", bar: "แจ้งงาน", sub: "ส่งงานเข้าคิวช่าง", href: "/sales", icon: AppIcon.Send, badgeKey: "dispatchMine" },

  advance: { title: "ใบเบิก Advance", short: "ใบ Advance", sub: "เบิกเงินล่วงหน้า", href: "/expenses/advances", icon: AppIcon.Advance, badgeKey: "advance" },
  claim: { title: "ใบเคลม", sub: "เคลียร์ค่าใช้จ่าย", href: "/expenses/claims", icon: AppIcon.Claim, badgeKey: "claim" },
  purchase: { title: "ใบขอซื้อสินค้า (PR)", short: "ขอซื้อ", sub: "ขอซื้อ · อนุมัติ · สั่งซื้อ · รับของ", href: "/purchase", icon: AppIcon.Purchase, badgeKey: "purchase" },
  purchaseReport: { title: "รายงานการจัดซื้อ", short: "รายงาน", sub: "ยอดซื้อ · ร้านค้า · ค้างรับ", href: "/purchase/report", icon: AppIcon.Report },
  // ✅ (27 ต.ค. 2569) คลังของแผนก — วัสดุเบิกแล้วตัดยอด · ทรัพย์สินยืม-คืน · ทุกใบอิงงาน
  stock: { title: "สต๊อกของ · ทรัพย์สินแผนก", short: "สต๊อกของ", sub: "เบิกของ · ยืม-คืน · คงคลัง", href: "/stock", icon: AppIcon.Stock, badgeKey: "stock" },
  // ✅ (2 พ.ย. 2569 ผู้ใช้: "เพิ่มเมนูประวัติการเบิกด้วย") — เปิดหน้าสต๊อกที่แท็บ "ประวัติ" ตรงๆ (ทุกการเบิก/ยืม/คืน/รับเข้า)
  stockHistory: { title: "ประวัติการเบิก", short: "ประวัติเบิก", sub: "เบิก · ยืม · คืน · รับเข้า", href: "/stock?tab=moves", icon: AppIcon.History },
  ot: { title: "OT · ทำงานล่วงเวลา", short: "OT", sub: "บันทึกชั่วโมง OT · อิงงาน · ขออนุมัติ", href: "/ot", icon: AppIcon.Ot, badgeKey: "ot" },
  contractorPay: { title: "ค่าจ้างผู้รับเหมา", sub: "เบิกค่าแรงตามงวดงาน", href: "/expenses/contractors", icon: AppIcon.Contractor, badgeKey: "contractorPay" },
  // ✅ (11 ต.ค. 2569) คิวอนุมัติใบเบิก — คลิปบอร์ดติ๊กถูก (ไม่ใช้ถาดรับเข้าซ้ำกับคำขอลงงาน) · ชื่อบอกตรงๆ ว่าต้องอนุมัติ
  expenseInbox: { title: "รออนุมัติเบิก", short: "รออนุมัติ", sub: "ตรวจสอบ · อนุมัติ · เบิกจ่าย", href: "/expenses/approvals", icon: AppIcon.Approve, badgeKey: "expenseInbox" },
  expenseReport: { title: "รายงานการเบิก", short: "รายงาน", sub: "ยอดค้าง · ย้อนหลัง", href: "/expenses/report", icon: AppIcon.Report },

  // 🔁 (21 ต.ค. 2569 ผู้ใช้: "ชื่อเมนูให้สื่อความหมาย สอดคล้อง · เอกสารไม่ควรรวมกับใบเสนอราคา · ใบเสนอราคาแก้เป็นติดตามใบเสนอราคา")
  documents: { title: "เอกสาร", sub: "เอกสารประจำงาน · เอกสารที่ออก · คลังไฟล์", href: "/documents", icon: AppIcon.Documents },
  finance: { title: "ติดตามใบเสนอราคา", bar: "ใบเสนอราคา", sub: "ผลเสนอราคา · วางบิล", href: "/finance", icon: AppIcon.Quotation, badgeKey: "quotations" },

  // ⚠️ /customers และ /staff คือพาธจริง ส่วน /customer และ /employee เป็นแค่ตัว redirect ของเก่า
  //    ชี้ไปพาธจริงเสมอ ไม่งั้นผู้ใช้ต้องเด้งสองต่อกว่าจะถึงหน้า
  customers: { title: "ลูกค้า", sub: "ทะเบียนลูกค้า", href: "/customers", icon: AppIcon.Customers },
  staff: { title: "พนักงาน / ทีมช่าง", short: "พนักงาน", sub: "ภาระงาน · ทะเบียน", href: "/staff", icon: AppIcon.Staff },

  settings: { title: "ตั้งค่า", href: "/about", icon: AppIcon.Settings },
  // ⚠️ เดิมชื่อ "ประเภทงาน / ระบบ" — คำว่า "ระบบ" ตรงนี้หมายถึงระบบงาน (ไฟฟ้า/ประปา) แต่ไปอยู่
  //    ในหน้าเดียวกับหมวด "ตั้งค่าระบบ" ที่แปลว่า system settings คนละเรื่องกันแต่ใช้คำเดียวกัน
  worktype: { title: "ประเภทงานและระบบงาน", sub: "ตัวเลือกที่ใช้ตอนเพิ่ม/แก้ไขแผนงาน", href: "/worktype", icon: AppIcon.Tag },
  orgSettings: { title: "ตั้งค่าองค์กร", sub: "โลโก้ · ข้อมูลบริษัทบนเอกสาร · ช่องทางติดต่อบนหัวเว็บ · ค่าตั้งต้นของระบบเบิก", href: "/settings/organization", icon: AppIcon.Image },
  // ── เว็บไซต์บริษัท (da-web) — แก้เนื้อหาบนเว็บสาธารณะ + รับคำขอจากลูกค้า ──
  webLeads: { title: "คำขอจากเว็บไซต์", short: "คำขอจากเว็บ", sub: "ติดต่อ · ขอใบเสนอราคา", href: "/website/leads", icon: AppIcon.Leads, badgeKey: "webLeads" },
  webProducts: { title: "สินค้าบนเว็บ", sub: "รูป · สเปก · Datasheet", href: "/website/products", icon: AppIcon.Products },
  webProjects: { title: "ผลงานบนเว็บ", sub: "โครงการที่ส่งมอบ", href: "/website/projects", icon: AppIcon.Gallery },
  webArticles: { title: "บทความ", sub: "ความรู้ · SEO", href: "/website/articles", icon: AppIcon.Article },
  webSettings: { title: "การแสดงผลเว็บไซต์", short: "การแสดงผล", sub: "ตัวเลข · ยี่ห้อ · เวลาทำการ", href: "/website/settings", icon: AppIcon.Tune },
  permissions: { title: "ตั้งค่าสิทธิ์", sub: "สิทธิ์ในระบบ (ผู้ดูแลระบบ) · สิทธิ์ตามตำแหน่งในองค์กร", href: "/settings/permissions", icon: AppIcon.Permissions },
};

/**
 * หยิบปลายทางมาหนึ่งอัน พร้อมทับค่าเฉพาะจุดได้ (เช่นสีประจำหมวดของการ์ดหน้าแรก)
 * @param {keyof DEST} key
 * @param {object} [extra] ค่าที่อยากทับ — ห้ามใช้ทับ title/href เพื่อเลี่ยงการกลับไปมีชื่อคนละแบบอีก
 */
/**
 * ไอคอนเมนูของหน้าที่เปิดอยู่ (ตาม URL) — ให้หัวหน้าแต่ละหน้า (PageHeader) ใช้ไอคอนเดียวกับเมนูที่กดเข้ามา
 * ✅ (1 พ.ย. 2569 ผู้ใช้: "icon ด้านในยังไม่เหมือนเลย") — เดิมแต่ละหน้าใส่ไอคอนหัวเพจเองคนละตัวกับเมนู
 *    เลือกปลายทางที่พาธยาวที่สุดที่ตรงกับ URL (/expenses/claims ชนะ /expenses) · ไม่นับหน้าแรก
 * @returns {Function|null} คอมโพเนนต์ไอคอน หรือ null ถ้าไม่ใช่หน้าที่อยู่ในเมนู
 */
export const navIconForPath = (pathname = "") => {
  let best = null;
  let bestLen = 0;
  Object.values(DEST).forEach((d) => {
    const path = String(d.href || "").split("?")[0];
    if (!path || path === "/" || path === "/dashboard") return;
    if ((pathname === path || pathname.startsWith(`${path}/`)) && path.length > bestLen) {
      best = d.icon;
      bestLen = path.length;
    }
  });
  return best;
};

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
