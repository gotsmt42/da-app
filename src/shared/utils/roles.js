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
 */

export const ROLES = {
  /** กรรมการผู้จัดการ — ✅ ผู้ใช้ขอเพิ่ม: ระดับสูงสุดของบริษัท มีทุกสิทธิ์ในระบบ */
  DIRECTOR: "director",
  ADMIN: "admin",
  MANAGER: "manager",
  TECHNICIAN: "technician",
  /** หัวหน้าช่างเทคนิค — ✅ ผู้ใช้ขอเพิ่ม: ตอนนี้ให้สิทธิ์เท่าช่างเทคนิคทุกอย่างก่อน */
  TECH_LEAD: "techlead",
  SALE: "sale",
  USER: "user",
};

export const ALL_ROLES = Object.values(ROLES);

/** ชื่อภาษาไทยสำหรับแสดงผล — ทั้งแอปเป็นภาษาไทย ห้ามโชว์ค่าดิบอย่าง "technician" ให้ผู้ใช้เห็น */
export const ROLE_LABEL = {
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
   * จัดการระบบทั้งหมด — ✅ ผู้ใช้สั่งให้ "ผู้จัดการ" มีสิทธิ์สูงสุดเท่าแอดมิน ตั้งค่าได้ทุกอย่าง
   * (เหตุผล/ข้อจำกัดเต็มอยู่ที่ da-app-server/src/config/roles.js)
   */
  manageAll: [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER],
  approveJobs: [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER],
  viewAllJobs: [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER],
  editAnyJob: [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER],
  // ⚠️ มี user แต่ไม่มี technician — พฤติกรรมเดิมของ OperationBoard.js ที่คงไว้เป๊ะ
  editOperation: [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.USER],
  // ⚠️ ฝ่ายขายถูกตัดออกตามที่ผู้ใช้สั่ง — การติดตามใบเสนอราคาในระบบนี้ผูกกับ "งานของช่าง"
  // (ใบเสนอราคาของงานที่ลงตารางแล้ว) ไม่ใช่ดีลที่เซลกำลังปิด เซลเปิดเข้าไปก็ไม่มีของตัวเอง
  viewQuotations: [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.TECHNICIAN, ROLES.TECH_LEAD],
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
};

export const ALL_CAPABILITIES = Object.keys(CAPABILITIES);

/**
 * รับได้ทั้ง userData object ({ role }) หรือสตริง role ตรงๆ
 * ⚠️ ต้อง toLowerCase เสมอ — role ถูกกรอกด้วยมือผ่านหน้าจัดการผู้ใช้ (โค้ดเดิมทั่วแอปก็ทำเช่นกัน)
 */
export const normalizeRole = (who) => {
  const raw = typeof who === "string" ? who : who?.role;
  return String(raw || "").trim().toLowerCase();
};

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
export const canAssignRole = (actor, role) =>
  can(actor, "manageAll") && roleLevel(role) > 0 && roleLevel(role) <= roleLevel(actor);

/** แตะบัญชีที่มี role นี้ได้ไหม (แก้สิทธิ์/ลบ) — ต้องมีสิทธิ์จัดการผู้ใช้ และห้ามแตะคนที่ระดับสูงกว่าตัวเอง */
export const canManageUserOfRole = (actor, targetRole) =>
  can(actor, "manageAll") && roleLevel(actor) >= roleLevel(targetRole);

/**
 * ✅ ตัวเดียวที่โค้ดที่อื่นควรเรียก
 * @param {object|string} who         userData / สตริง role
 * @param {string} capability         ชื่อจาก CAPABILITIES
 */
export const can = (who, capability) => {
  const allowed = CAPABILITIES[capability];
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

export const roleLabel = (who) => ROLE_LABEL[normalizeRole(who)] || who?.role || "ผู้ใช้";
