/**
 * roles.js — แหล่งความจริงเดียวเรื่อง "ใครทำอะไรได้" ฝั่งหน้าจอ
 *
 * ⚠️ คู่แฝดของ da-app-server/src/config/roles.js — **ตารางสิทธิ์ต้องตรงกันเป๊ะ**
 * แก้ที่นี่ต้องแก้อีกฝั่งด้วยเสมอ (แบบแผนเดียวกับ contractRounds ↔ contractVisits ที่โปรเจกต์ใช้อยู่:
 * ตรรกะเล็กๆ ที่ต้องใช้ทั้งสองฝั่ง ก๊อปได้ แต่ห้ามให้ต่างกัน)
 *
 * ⚠️ ฝั่งนี้ใช้เพื่อ "ซ่อนเมนู/ปุ่มที่กดไปก็ทำไม่ได้อยู่ดี" เท่านั้น — **ไม่ใช่ขอบเขตความปลอดภัย**
 * การกันจริงอยู่ที่ server ทุกจุด (requireCap / การกรอง query ตามผู้ใช้)
 *
 * 🐛 ปัญหาที่แก้: เดิมเช็คสิทธิ์เขียนสดกระจาย ~40 จุด เช่น
 *   const canAccess = ["admin","manager","technician","user"].includes(role)   // FinanceHub.js
 * role ใหม่ที่ไม่ได้ถูกเติมเข้าลิสต์ไหนจะถูกปฏิเสธเงียบๆ ไม่มี error ให้เห็น มีแค่เมนูหายหรือหน้าเด้งกลับ
 * — เป็นบั๊กที่ไล่หายากมากเพราะไม่รู้ว่ามีลิสต์ซ่อนอยู่กี่ที่
 * ✅ กฎใหม่: ห้ามถามว่า "เป็น role อะไร" ให้ถามว่า "ทำสิ่งนี้ได้ไหม" (capability)
 *
 * ── คำศัพท์สองคำที่ต้องแยกจากกันให้ขาด (✅ ผู้ใช้สั่ง: "Role คือตำแหน่งในระบบ Rank คือในองค์กร") ──
 *
 *   Role  = ตำแหน่ง "ในระบบ"  → Super Admin / Admin / Member (user.systemRole) เปลี่ยนชื่อไม่ได้
 *   Rank  = ตำแหน่ง "ในองค์กร" → กรรมการผู้จัดการ / แอดมินช่าง / ช่างเทคนิค ... (user.role — คีย์เดิม) เปลี่ยนชื่อได้
 *   ตำแหน่งเฉพาะบุคคล = user.jobTitle — ข้อความที่พิมพ์ใต้ชื่อในเอกสาร เว้นว่างแล้วใช้ชื่อ Rank (ดู titleOf)
 */

/**
 * Rank — ตำแหน่งในองค์กร
 * ⚠️ ลำดับในก้อนนี้คือ "มากไปน้อยตามสิทธิ์การใช้งาน" (✅ ผู้ใช้สั่ง) — ALL_ROLES ใช้ลำดับนี้
 * จึงมีผลกับลำดับคอลัมน์ในตารางสิทธิ์ ตัวเลือกตอนเพิ่ม/แก้ผู้ใช้ และรายงานทุกใบ — เพิ่มตำแหน่งใหม่ต้องใส่ให้ถูกที่
 */
export const ROLES = {
  /** กรรมการผู้จัดการ — ✅ ผู้ใช้ขอเพิ่ม: ระดับสูงสุดของบริษัท มีทุกสิทธิ์ในระบบ */
  DIRECTOR: "director",
  MANAGER: "manager",
  /**
   * แอดมินช่าง — ⚠️ คีย์คือ "techadmin" ไม่ใช่ "admin"
   * 🐛 ที่แก้ (ผู้ใช้สั่ง: "rank คือชื่อเฉพาะในองค์กร ควรตั้งให้สอดคล้อง"): เดิมคีย์นี้ชนกับชั้นในระบบ
   * Admin พอดี ค่าคำเดียวกันจึงแปลได้สองความหมายแล้วแต่ว่าใครอ่าน — เป็นต้นเหตุของบั๊กจริงที่เคยเจอ
   * (ตั้ง Super Admin แล้วเมนูหาย เพราะโค้ดต้องเดาว่า "admin" ที่อยู่ในฟิลด์ role หมายถึงอะไร)
   * ✅ ข้อมูลเก่าที่ยังเป็น "admin" ยังใช้ได้ตลอดไป — ดู LEGACY_RANK_ALIAS ด้านล่าง
   */
  ADMIN: "techadmin",
  /** หัวหน้าช่างเทคนิค — ✅ ผู้ใช้ขอเพิ่ม: ตอนนี้ให้สิทธิ์เท่าช่างเทคนิคทุกอย่างก่อน */
  TECH_LEAD: "techlead",
  TECHNICIAN: "technician",
  SALE: "sale",
  USER: "user",
};

export const ALL_ROLES = Object.values(ROLES);

/**
 * ชื่อคีย์เดิมของตำแหน่งในองค์กร → คีย์ปัจจุบัน
 * ✅ ข้อมูลเก่าในฐานข้อมูล (user.rank/user.role) และสำเนาที่ฝังอยู่ในเอกสารอื่น (ใบเบิก/ใบมอบหมาย/
 *    ประวัติการแก้ไข) ยังอ่านได้เหมือนเดิมโดยไม่ต้องย้ายข้อมูลก่อน — ย้ายทีหลังเมื่อไรก็ได้
 * ⚠️ ห้ามลบบรรทัดนี้ทิ้งแม้จะย้ายข้อมูลครบแล้ว — สำเนาที่ฝังในเอกสารเก่าย้อนหลังยังมีค่าเดิมอยู่เสมอ
 */
const LEGACY_RANK_ALIAS = { admin: ROLES.ADMIN };

/** ชื่อภาษาไทยสำหรับแสดงผล — ทั้งแอปเป็นภาษาไทย ห้ามโชว์ค่าดิบอย่าง "technician" ให้ผู้ใช้เห็น */
export const RANK_LABEL = {
  [ROLES.DIRECTOR]: "กรรมการผู้จัดการ",
  [ROLES.ADMIN]: "แอดมินช่าง",
  [ROLES.MANAGER]: "ผู้จัดการแผนกช่าง",
  [ROLES.TECH_LEAD]: "หัวหน้าช่างเทคนิค",
  [ROLES.TECHNICIAN]: "ช่างเทคนิค",
  [ROLES.SALE]: "เซล",
  [ROLES.USER]: "ผู้ใช้ทั่วไป",
};

/** สีประจำสายงาน — ใช้ให้ตรงกันทั้งแอป เพื่อให้มองปราดเดียวรู้ว่ากำลังอยู่สายงานไหน */
export const ROLE_COLOR = {
  [ROLES.DIRECTOR]: "#7c2d12",
  [ROLES.ADMIN]: "#0f172a",
  [ROLES.MANAGER]: "#0f766e",
  [ROLES.TECHNICIAN]: "#0891b2", // ฟ้า = สายบริการ (สีเดิมของแอป)
  [ROLES.TECH_LEAD]: "#0ea5e9",  // ฟ้าอ่อนกว่าช่างหนึ่งระดับ — เป็นสายเดียวกันแต่แยกออกจากกันได้
  [ROLES.SALE]: "#8b5cf6",       // ม่วง = สายขาย
  [ROLES.USER]: "#64748b",
};

export const DEPARTMENT = {
  SERVICE: "service",
  SALES: "sales",
};

export const DEPARTMENT_LABEL = {
  [DEPARTMENT.SERVICE]: "ฝ่ายบริการ",
  [DEPARTMENT.SALES]: "ฝ่ายขาย",
};

const ROLE_DEPARTMENT = {
  [ROLES.TECHNICIAN]: DEPARTMENT.SERVICE,
  [ROLES.TECH_LEAD]: DEPARTMENT.SERVICE,
  [ROLES.SALE]: DEPARTMENT.SALES,
};

/**
 * ── ตารางสิทธิ์ (ต้องตรงกับฝั่ง server เป๊ะ) ──────────────────────────────
 * ⚠️ ค่าของ 4 role เดิมคือ "พฤติกรรมเดิมของระบบ" ห้ามเปลี่ยนไปพร้อมกับงานนี้ —
 * งานนี้คือรวมศูนย์การเช็คสิทธิ์ ไม่ใช่เปลี่ยนสิทธิ์ใคร (SALE เป็นของใหม่ล้วน)
 */
export const CAPABILITIES = {
  /**
   * ⚠️ manageAll / manageSystem ไม่ได้อยู่ในตารางนี้แล้ว — เป็น "สิทธิ์ในระบบ" (SYSTEM_CAPABILITIES ด้านล่าง)
   * ✅ ผู้ใช้สั่งให้แยก "สิทธิ์ในระบบ" ออกจาก "ตำแหน่งในองค์กร" — ตารางนี้เหลือเฉพาะสิ่งที่ตำแหน่งทำได้
   */
  approveJobs: [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER],
  viewAllJobs: [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER],
  editAnyJob: [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER],
  // ⚠️ มี user แต่ไม่มี technician — พฤติกรรมเดิมของ OperationBoard.js ที่คงไว้เป๊ะ
  editOperation: [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.USER],
  // ⚠️ ฝ่ายขายถูกตัดออกตามที่ผู้ใช้สั่ง — การติดตามใบเสนอราคาในระบบนี้ผูกกับ "งานของช่าง"
  // (ใบเสนอราคาของงานที่ลงตารางแล้ว) ไม่ใช่ดีลที่เซลกำลังปิด เซลเปิดเข้าไปก็ไม่มีของตัวเอง
  viewQuotations: [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.TECHNICIAN, ROLES.TECH_LEAD],
  // เปิดเมนู "เอกสาร" — เดิมฮาร์ดโค้ดว่า "ทุกคนยกเว้นเซล" ตอนนี้ปรับได้จากตารางสิทธิ์
  viewDocuments: [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.TECH_LEAD, ROLES.TECHNICIAN, ROLES.USER],
  editDocuments: [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER],
  // ⚠️ ฝ่ายขายถูกตัดออก — หน้าการเงินคือการวางบิล/รับเงินของงานช่าง ไม่ใช่ยอดขายของเซล
  viewFinance: [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.TECHNICIAN, ROLES.TECH_LEAD, ROLES.USER],
  editFinance: [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER],
  viewContracts: [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.TECHNICIAN, ROLES.TECH_LEAD],
  editContracts: [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER],
  manageMasterData: [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER],
  createSalesPlan: [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.SALE],
  viewAllSales: [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER],
  requestDispatch: [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.SALE],
  assignDispatch: [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER],
  receiveDispatch: [ROLES.TECHNICIAN, ROLES.TECH_LEAD],

  /**
   * เปิดดู "ตารางงานช่าง" ได้ทั้งแผนก แม้ตัวเองไม่ได้อยู่ในงานเลย — อ่านอย่างเดียวเท่านั้น
   *
   * ✅ เซลต้องรู้ว่าช่างว่างวันไหน/ไปที่ไหนอยู่ ก่อนจะไปรับปากลูกค้าเรื่องวันเข้างาน
   * ⚠️ สิทธิ์ "ดู" ล้วนๆ ไม่มีสิทธิ์เขียนตามมา — ฝั่ง server ยังกันไว้ทุกด่านเหมือนเดิม (PUT /:id
   * ต้องเป็น editAnyJob / เจ้าของงาน / ผู้ถูกมอบหมาย ไม่งั้น 403) ซึ่งเซลไม่เข้าเงื่อนไขไหนเลย
   * ⚠️ ฝั่งหน้าจอยังต้องล็อกฟอร์มให้ครบด้วย (ดู readOnly ที่ EditEvent.js) — ไม่ใช่เพื่อความปลอดภัย
   * แต่เพื่อไม่ให้ผู้ใช้กรอกไปทั้งหน้าแล้วเพิ่งมารู้ตอนกดบันทึกว่าทำไม่ได้
   */
  viewServiceCalendar: [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.SALE],

  // ── เบิกเงินล่วงหน้า (Advance) / เคลียร์ค่าใช้จ่าย (Claim) ───────────────
  /** ออกใบ Advance / ใบเคลมของตัวเองได้ */
  requestExpense: [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.TECHNICIAN, ROLES.TECH_LEAD],
  /**
   * ── ลำดับการเบิกค่าใช้จ่าย 3 ส่วน (เหตุผลเต็มที่ da-app-server/src/config/roles.js) ──
   *   ส่วนที่ 1 ส่งขอเบิก → ส่วนที่ 2 ตรวจสอบ/อนุมัติ (แอดมินช่างตรวจสอบ → ผู้จัดการฯ อนุมัติ)
   *   → ส่วนที่ 3 อนุมัติเบิกจ่าย (ผู้จัดการฯ/กรรมการผู้จัดการ)
   */
  reviewExpense: [ROLES.ADMIN, ROLES.MANAGER],
  /** ส่วนที่ 2 มือสอง — อนุมัติ (ใบที่ตรวจสอบแล้วเท่านั้น) */
  approveExpense: [ROLES.MANAGER],
  /** ส่วนที่ 3 — อนุมัติเบิกจ่าย: จ่ายเงิน Advance / ปิดส่วนต่างใบเคลม / จ่ายคืนใบสำรองจ่าย */
  disburseExpense: [ROLES.DIRECTOR, ROLES.MANAGER],
  /**
   * กดครบทั้งสองขั้นในใบเดียวเองได้ (ตรวจสอบเอง → อนุมัติเอง) — ผู้จัดการเท่านั้น
   * ⚠️ เหตุผลและข้อแลกเปลี่ยนอยู่ที่ da-app-server/src/config/roles.js
   */
  approveOwnReview: [ROLES.MANAGER],
  /**
   * ตรวจสอบ/อนุมัติใบของตัวเองได้ (แอดมิน + ผู้จัดการ ตามที่ผู้ใช้สั่ง)
   * ⚠️ แยกจาก manageAll โดยตั้งใจ — "ตั้งค่าระบบได้" ไม่ได้แปลว่า "เซ็นอนุมัติเงินให้ตัวเองได้"
   */
  approveOwnExpense: [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER],
  /** เห็นใบของทุกคน + เบิกแทนคนอื่นได้ + ดูรายงานทั้งบริษัท */
  viewAllExpenses: [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER],
  /** แก้เนื้อหาเว็บไซต์บริษัท — เหตุผลอยู่ที่ da-app-server/src/config/roles.js */
  // ✅ ผู้ใช้สั่ง (25 ก.ย. 2569): "การตั้งค่า และการแสดงเมนู ให้ทำได้แค่ Super Admin ก่อน"
  //    ไม่ให้ตำแหน่งใดในองค์กรโดยค่าเริ่มต้น — Super Admin ผ่านทุกสิทธิ์อยู่แล้ว (ดู can())
  //    ถ้าวันหลังจะให้ตำแหน่งไหน ติ๊กเพิ่มได้จากหน้าตั้งค่าสิทธิ์ ไม่ต้องแก้โค้ด
  manageWebsite: [],
  /** จัดการคำขอจากเว็บไซต์ (ข้อมูลส่วนบุคคลของลูกค้า) — รวมฝ่ายขายที่เป็นคนโทรกลับ */
  // ✅ ผู้ใช้สั่ง: "เซลไม่ต้อง ให้แก้และดูอะไรได้ในตั้งค่า" — เหลือ Super Admin เท่านั้นเหมือน manageWebsite
  viewLeads: [],
};

/**
 * ── สิทธิ์ในระบบ (คู่แฝดของ da-app-server/src/config/roles.js) ────────────────
 * ✅ ผู้ใช้สั่ง: "ทำสิทธิ์ในระบบ และสิทธิ์ในองค์กรแยกกัน เช่นในระบบ Admin / Super Admin"
 * ⚠️ ชื่อสามชั้นนี้เป็นภาษาอังกฤษและเปลี่ยนไม่ได้ (ผู้ใช้สั่ง — เป็นศัพท์ของระบบ กันสับสนกับตำแหน่ง
 * "แอดมินช่าง" ในองค์กร) ส่วนตำแหน่งในองค์กรเปลี่ยนชื่อเองได้จากหน้าตั้งค่า
 */
export const SYSTEM_ROLES = { SUPER: "superadmin", ADMIN: "admin", MEMBER: "member" };
export const ALL_SYSTEM_ROLES = Object.values(SYSTEM_ROLES);
/**
 * ชั้นในระบบที่ "ไม่มีทางเป็นตำแหน่งในองค์กร" — ใช้แยกให้ออกว่าค่าที่อยู่ในฟิลด์ role เป็นอะไรกันแน่
 * ⚠️ ไม่มี "admin" ในลิสต์นี้โดยตั้งใจ — ชื่อซ้ำกับตำแหน่ง "แอดมินช่าง" (ROLES.ADMIN) ในองค์กร
 */
const SYSTEM_ONLY_ROLES = [SYSTEM_ROLES.SUPER, SYSTEM_ROLES.MEMBER];
export const SYSTEM_ROLE_LABEL = {
  [SYSTEM_ROLES.SUPER]: "Super Admin",
  [SYSTEM_ROLES.ADMIN]: "Admin",
  [SYSTEM_ROLES.MEMBER]: "Member",
};
export const SYSTEM_ROLE_DESC = {
  [SYSTEM_ROLES.SUPER]: "ตั้งค่าองค์กร · ตารางสิทธิ์ · ตั้งผู้ดูแลระบบ · จัดการผู้ใช้ทั้งหมด",
  [SYSTEM_ROLES.ADMIN]: "จัดการผู้ใช้และข้อมูลหลัก (ลูกค้า/ประเภทงาน) — แตะตั้งค่าระบบและตารางสิทธิ์ไม่ได้",
  [SYSTEM_ROLES.MEMBER]: "ใช้งานตามตำแหน่งในองค์กรเท่านั้น",
};
const SYSTEM_CAPABILITIES = {
  manageAll: [SYSTEM_ROLES.SUPER, SYSTEM_ROLES.ADMIN],
  manageSystem: [SYSTEM_ROLES.SUPER],
};
/** ผู้ใช้ที่ยังไม่เคยตั้งชั้นในระบบ → เดาจากตำแหน่งในองค์กร (ตรงกับฝั่ง server) */
export const DEFAULT_SYSTEM_ROLE = {
  [ROLES.DIRECTOR]: SYSTEM_ROLES.SUPER,
  [ROLES.MANAGER]: SYSTEM_ROLES.SUPER,
  [ROLES.ADMIN]: SYSTEM_ROLES.ADMIN,
  [ROLES.TECH_LEAD]: SYSTEM_ROLES.MEMBER,
  [ROLES.TECHNICIAN]: SYSTEM_ROLES.MEMBER,
  [ROLES.SALE]: SYSTEM_ROLES.MEMBER,
  [ROLES.USER]: SYSTEM_ROLES.MEMBER,
};

export const systemRoleOf = (who) => {
  if (who && typeof who === "object") {
    /**
     * ⚠️ ค่าที่ "ตั้งไว้ชัดเจน" ต้องชนะเสมอ — ช่อง systemRole ถูกเขียนเฉพาะตอนที่มีคนเลือกจากหน้า
     * ตั้งค่าสิทธิ์เท่านั้น ส่วนช่อง role เป็นค่าที่ติดมาตั้งแต่ตอนสมัคร (เดาจากตำแหน่ง) หรือเป็นสำเนาเก่า
     * 🐛 ที่แก้ (ผู้ใช้แจ้ง "ตั้ง Super Admin แล้วเมนูไม่ขึ้น"): เดิมอ่านช่อง role ก่อน ตั้งใครเป็น
     * Super Admin จากหน้าตั้งค่าสิทธิ์แล้ว "ไม่มีอะไรเกิดขึ้นเลย" เพราะค่าเดิมในช่อง role ชนะค่าที่
     * เพิ่งบันทึกทุกครั้ง — คนที่สมัครเข้ามาใหม่ได้ role = "member" ติดตัวมาตั้งแต่ต้นด้วย
     */
    const explicit = String(who.systemRole || "").trim().toLowerCase();
    if (ALL_SYSTEM_ROLES.includes(explicit)) return explicit;
    const role = String(who.role || "").trim().toLowerCase();
    /**
     * ✅ "superadmin" / "member" ไม่มีทางเป็นตำแหน่งในองค์กร — เจอที่ฟิลด์ role เมื่อไรแปลว่าเอกสารนี้
     * เป็นรูปแบบใหม่ (role = ชั้นในระบบ) แน่นอน
     * 🐛 ที่แก้: เดิมยอมอ่าน role เป็นชั้นในระบบ "ก็ต่อเมื่อ rank ถูกต้องด้วย" — ผู้ใช้ที่ตั้งเป็น
     * Super Admin แล้วแต่ยังไม่มี rank จึงตกไปเป็น Member เงียบๆ แล้วเมนูหายทั้งแถบ
     * ⚠️ "admin" ยังต้องรอ rank เหมือนเดิม เพราะซ้ำกับตำแหน่ง "แอดมินช่าง" ในองค์กร — ถ้าเดาผิดทาง
     * ผู้ใช้เก่าที่เป็นแอดมินช่างจะเสียสิทธิ์ในองค์กรไปทันที (ของเดิมเดาให้ถูกอยู่แล้วผ่าน DEFAULT_SYSTEM_ROLE)
     */
    if (SYSTEM_ONLY_ROLES.includes(role)) return role;
    // ⚠️ ใช้ "ตำแหน่งที่ถอดได้จริง" ไม่ใช่ค่าดิบในฟิลด์ rank — ข้อมูลเก่าที่ยังใช้ชื่อคีย์เดิมก็ต้องนับด้วย
    const isNewShape = ALL_ROLES.includes(normalizeRole(who));
    if (isNewShape && ALL_SYSTEM_ROLES.includes(role)) return role;
    // (ช่อง systemRole ถูกอ่านไปตั้งแต่ต้นฟังก์ชันแล้ว — ดูคอมเมนต์ด้านบน)
  }
  return DEFAULT_SYSTEM_ROLE[normalizeRole(who)] || SYSTEM_ROLES.MEMBER;
};

export const systemRoleLabel = (who) => SYSTEM_ROLE_LABEL[systemRoleOf(who)] || "";

export const ALL_CAPABILITIES = Object.keys(CAPABILITIES);

/**
 * รับได้ทั้ง userData object ({ role }) หรือสตริง role ตรงๆ
 * ⚠️ ต้อง toLowerCase เสมอ — role ถูกกรอกด้วยมือผ่านหน้าจัดการผู้ใช้ (โค้ดเดิมทั่วแอปก็ทำเช่นกัน)
 */
export const normalizeRole = (who) => {
  if (typeof who === "string") {
    const s = who.trim().toLowerCase();
    return LEGACY_RANK_ALIAS[s] || s;
  }
  // ✅ รูปแบบใหม่: user.rank = ตำแหน่งในองค์กร · รูปแบบเก่า (และสำเนาที่ฝังในเอกสารอื่น): user.role
  const rank = String(who?.rank || "").trim().toLowerCase();
  if (ALL_ROLES.includes(rank)) return rank;
  if (LEGACY_RANK_ALIAS[rank]) return LEGACY_RANK_ALIAS[rank];
  const role = String(who?.role || "").trim().toLowerCase();
  // ⚠️ ต้องเช็คชื่อเดิมก่อนเข้าเงื่อนไข SYSTEM_ONLY_ROLES — ข้อมูลเก่าที่ role = "admin" หมายถึง
  // "แอดมินช่าง" (ตำแหน่งในองค์กร) เสมอ ไม่ใช่ชั้นในระบบ
  if (LEGACY_RANK_ALIAS[role]) return LEGACY_RANK_ALIAS[role];
  /**
   * 🐛 ที่แก้ (ผู้ใช้แจ้ง: "role เป็น superadmin แล้ว แต่เมนูไม่ขึ้น"):
   * ผู้ใช้ที่ถูกตั้ง "ชั้นในระบบ" ไว้ที่ฟิลด์ role แต่ยังไม่มี rank (ข้อมูลเก่าที่ยังไม่ได้ย้าย)
   * จะได้ตำแหน่งในองค์กรเป็นคำว่า "superadmin" ซึ่งไม่มีอยู่ในตารางสิทธิ์เลยสักช่อง →
   * ทุกสิทธิ์ถูกปฏิเสธเงียบๆ และเมนูหายทั้งแถบโดยไม่มี error ให้เห็น
   * ✅ ถือว่า "ไม่รู้ตำแหน่งในองค์กร" ไปตรงๆ ดีกว่าเอาชื่อชั้นในระบบมาสวมเป็นตำแหน่ง
   * ⚠️ "admin" ไม่เข้าเงื่อนไขนี้โดยตั้งใจ — เป็นชื่อที่ซ้ำกันทั้งสองฝั่ง (แอดมินช่าง = ตำแหน่งในองค์กร)
   *    ข้อมูลเก่าที่ role = "admin" ต้องยังได้สิทธิ์แอดมินช่างเหมือนเดิมทุกประการ
   */
  return SYSTEM_ONLY_ROLES.includes(role) ? "" : role;
};

/** ชื่อเดียวกับ normalizeRole แต่เรียกตามคำที่ผู้ใช้กำหนด */
export const normalizeRank = (who) => normalizeRole(who);

/**
 * ── ลำดับชั้นของสิทธิ์ (ใครแก้สิทธิ์ใครได้) ────────────────────────────────────
 * กรรมการผู้จัดการ (4) > ผู้จัดการแผนกช่าง (3) > แอดมินช่าง (2) > ช่าง/เซล/ผู้ใช้ (1)
 * ✅ ผู้ใช้สั่ง: ผู้จัดการสูงสุด · แอดมินตั้งใครเป็นผู้จัดการไม่ได้ และแตะบัญชีผู้จัดการไม่ได้
 * ⚠️ คู่แฝดฝั่ง server ที่ da-app-server/src/config/roles.js — ต้องตรงกันเป๊ะ (ที่นี่ไว้ซ่อน/ปิดปุ่ม
 * ส่วนขอบเขตจริงบังคับที่ server)
 */
/**
 * ช่างหน้างานทั้งหมด (ช่างเทคนิค + หัวหน้าช่างเทคนิค)
 * ✅ ใช้ทุกที่ที่ถามว่า "คนนี้เป็นช่างไหม" — เพิ่ม role ช่างแบบใหม่ในอนาคตก็แก้ที่นี่ที่เดียว
 * ⚠️ อย่าเทียบ role === "technician" ตรงๆ อีก ไม่งั้นหัวหน้าช่างจะหลุดจากรายชื่อ/เมนูของช่างเงียบๆ
 */
export const TECHNICIAN_ROLES = [ROLES.TECHNICIAN, ROLES.TECH_LEAD];

export const ROLE_LEVEL = {
  [ROLES.DIRECTOR]: 4,
  [ROLES.MANAGER]: 3,
  [ROLES.ADMIN]: 2,
  [ROLES.TECHNICIAN]: 1,
  [ROLES.TECH_LEAD]: 1,
  [ROLES.SALE]: 1,
  [ROLES.USER]: 1,
};

/** ระดับของผู้ใช้/role (role ที่ระบบไม่รู้จัก = 0) */
export const roleLevel = (who) => ROLE_LEVEL[normalizeRole(who)] || 0;

/** ตั้ง role นี้ให้คนอื่นได้ไหม — ต้องมีสิทธิ์จัดการผู้ใช้ก่อน และห้ามตั้งสิทธิ์ที่สูงกว่าระดับตัวเอง */
/** ✅ Super Admin ทำได้ทุกอย่าง (ตรงกับฝั่ง server) */
export const isSuperAdmin = (who) => systemRoleOf(who) === SYSTEM_ROLES.SUPER;

/**
 * ✅ สิทธิ์ที่ให้ตาม "สิทธิ์ในระบบ" เพิ่มจากตารางตำแหน่ง — ผู้ใช้สั่ง (25 ก.ย. 2569):
 *    "หน้าคำขอจากเว็บไซต์ ให้สิทธิ์แอดมินสามารถจัดการได้ด้วย"
 *    Admin ในระบบ (ไม่ว่าตำแหน่งในองค์กรไหน) เห็น/อัปเดต/ลบคำขอจากลูกค้าได้ — Super Admin ผ่านอยู่แล้ว
 * ⚠️ การตั้งค่าเว็บไซต์ (manageWebsite) ยังเป็น Super Admin เท่านั้น
 */
const SYSTEM_GRANTS = { viewLeads: [SYSTEM_ROLES.ADMIN] };

/**
 * สายอนุมัติค่าใช้จ่าย — ⚠️ ยกเว้นจาก "Super Admin ทำได้ทุกอย่าง" โดยตั้งใจ
 * ผู้ใช้กำหนดคนแต่ละขั้นไว้ชัดตามตำแหน่งในองค์กร (เช่น กรรมการผู้จัดการไม่อยู่ขั้นตรวจสอบ/อนุมัติ)
 * และเป็นกลไกควบคุมภายในเรื่องเงิน — ถ้า Super Admin ข้ามได้ทุกขั้น ใบเบิกจะไม่มีคนสอบทานเลย
 */
export const EXPENSE_WORKFLOW_CAPS = ["reviewExpense", "approveExpense", "disburseExpense", "approveOwnReview", "approveOwnExpense"];


export const canAssignRole = (actor, role) =>
  roleLevel(role) > 0 && (isSuperAdmin(actor) || (can(actor, "manageAll") && roleLevel(role) <= roleLevel(actor)));

/** แตะบัญชีที่มี role นี้ได้ไหม (แก้สิทธิ์/ลบ) — ต้องมีสิทธิ์จัดการผู้ใช้ และห้ามแตะคนที่ระดับสูงกว่าตัวเอง */
export const canManageUserOfRole = (actor, targetRole) =>
  isSuperAdmin(actor) || (can(actor, "manageAll") && roleLevel(actor) >= roleLevel(targetRole));

/**
 * ✅ ตัวเดียวที่โค้ดที่อื่นควรเรียก
 * @param {object|string} who         userData / สตริง role
 * @param {string} capability         ชื่อจาก CAPABILITIES
 */
/**
 * ตารางสิทธิ์ "ที่ใช้จริง" ซึ่งผู้ดูแลปรับเองได้จากหน้าตั้งค่าสิทธิ์ (ถ้าไม่มี = ใช้ค่าเริ่มต้นในไฟล์นี้)
 * ✅ ผู้ใช้สั่ง: "ตั้งค่ากำหนดสิทธิ์ได้ว่าใครมองเห็นเมนูอะไร และจัดการอะไรได้บ้าง"
 * ⚠️ นี่คือของฝั่งหน้าจอไว้ "ซ่อนเมนู" เท่านั้น — ตัวจริงบังคับที่ server ทุก endpoint เหมือนเดิม
 * ⚠️ โหลดมาจาก GET /settings/permissions/effective ตอนล็อกอิน (ดู AuthContext)
 */
let EFFECTIVE = null;

/** @param {Record<string, string[]>|null} table  { capability: [role, ...] } */
/**
 * ชื่อตำแหน่งในองค์กรที่ผู้ดูแลตั้งเอง — ✅ ผู้ใช้ขอให้เปลี่ยนชื่อได้ (คีย์ของตำแหน่งคงเดิมเสมอ)
 * โหลดมาพร้อมตั้งค่าองค์กร (ดู OrgSettingService) แล้วทับชื่อเริ่มต้นในไฟล์นี้
 */
let RANK_LABEL_OVERRIDES = {};
export const setRankLabels = (map) => {
  const clean = {};
  Object.entries(map || {}).forEach(([role, label]) => {
    // ⚠️ ชื่อที่องค์กรตั้งไว้ก่อนเปลี่ยนคีย์ (เช่น "admin") ต้องยังมีผลกับคีย์ปัจจุบัน
    // ไม่งั้นชื่อตำแหน่งที่ลูกค้าตั้งเองจะหายกลับไปเป็นชื่อเริ่มต้นเงียบๆ ตอน deploy
    const raw = String(role || "").toLowerCase();
    const r = LEGACY_RANK_ALIAS[raw] || raw;
    const text = String(label || "").trim();
    if (text) clean[r] = text;
  });
  RANK_LABEL_OVERRIDES = clean;
};

export const setEffectiveCapabilities = (table) => {
  EFFECTIVE = table && typeof table === "object" ? table : null;
};

export const can = (who, capability) => {
  // ✅ สิทธิ์ระดับระบบตัดสินด้วย "ชั้นในระบบ" ของผู้ใช้ ไม่เกี่ยวกับตำแหน่งในองค์กร
  if (Object.prototype.hasOwnProperty.call(SYSTEM_CAPABILITIES, capability)) {
    return SYSTEM_CAPABILITIES[capability].includes(systemRoleOf(who));
  }
  const allowed = EFFECTIVE?.[capability] || CAPABILITIES[capability];
  // ✅ Super Admin ผ่านทุกสิทธิ์ที่มีอยู่จริง ยกเว้นสายอนุมัติค่าใช้จ่าย (ตรงกับฝั่ง server)
  if (allowed && isSuperAdmin(who) && !EXPENSE_WORKFLOW_CAPS.includes(capability)) return true;
  if (allowed && SYSTEM_GRANTS[capability]?.includes(systemRoleOf(who))) return true;
  if (!allowed) {
    // พิมพ์ชื่อสิทธิ์ผิด = ปฏิเสธไว้ก่อน แต่ต้องส่งเสียงดังพอให้เห็นตอน dev
    // ไม่งั้นจะกลายเป็นบั๊กเงียบแบบเดียวกับที่ไฟล์นี้ตั้งใจกำจัด
    console.error(`❌ can(): ไม่รู้จักสิทธิ์ "${capability}" — ตรวจชื่อใน shared/utils/roles.js`);
    return false;
  }
  return allowed.includes(normalizeRole(who));
};

export const departmentOf = (who) => ROLE_DEPARTMENT[normalizeRole(who)] || null;

export const isRole = (who, ...roles) =>
  roles.map((r) => String(r).toLowerCase()).includes(normalizeRole(who));

/** ทางลัดที่ใช้บ่อยที่สุดในโค้ดเดิม — มีไว้ให้การย้ายโค้ดเก่าอ่านง่ายขึ้น */
export const isAdminOrManager = (who) => isRole(who, ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER);

/** ชื่อตำแหน่งที่แสดงจริง — ชื่อที่ผู้ดูแลตั้งเองมาก่อนชื่อเริ่มต้นของระบบ */
export const rankLabel = (who) => {
  const r = normalizeRole(who);
  return RANK_LABEL_OVERRIDES[r] || RANK_LABEL[r] || who?.role || "ผู้ใช้";
};

/**
 * นามแฝงของ Rank — คีย์ในฐานข้อมูลยังชื่อ role เหมือนเดิม แต่โค้ดใหม่ให้อ่านว่า Rank
 * เพื่อให้ตรงกับคำที่ผู้ใช้เห็นบนหน้าจอ
 */
export const RANKS = ROLES;
export const ALL_RANKS = ALL_ROLES;
export const rankOf = (who) => normalizeRole(who);

/**
 * ตำแหน่งที่ใช้พิมพ์ใต้ชื่อคน — ตำแหน่งเฉพาะบุคคล > ค่าเก่า (rank) > ชื่อ Rank
 * ⚠️ ต้องตรงกับ titleOf() ฝั่ง server — เอกสารที่สร้างสองทางต้องได้ตำแหน่งเหมือนกัน
 */
export const titleOf = (user) => {
  const own = String(user?.jobTitle || "").trim();
  if (own) return own;
  // ⚠️ ข้อมูลเก่า: user.rank เคยเป็นข้อความตำแหน่งที่พิมพ์เอง ก่อนเปลี่ยนความหมายเป็นตำแหน่งในองค์กร
  const legacy = String(user?.rank || "").trim();
  if (legacy && !ALL_ROLES.includes(legacy.toLowerCase())) return legacy;
  return rankLabel(user) || "";
};
