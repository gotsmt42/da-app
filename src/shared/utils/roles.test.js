/**
 * roles.test.js — ล็อกพฤติกรรมของตัวเช็คสิทธิ์กลาง
 *
 * ⚠️ การทดสอบชุดนี้เน้น "กฎที่ผิดแล้วเงียบ" เป็นหลัก ไม่ได้ไล่ทดสอบทุก capability ให้ครบทุกช่อง
 * (ความครบถ้วนของตารางมี `npm run check:perms` ฝั่ง server ดูแลอยู่แล้ว และเป็นตัวเดียวที่เทียบ
 * สองฝั่งให้ด้วย) ตรงนี้ดูเรื่องที่ script ตัวนั้นดูไม่ได้ เช่น การ normalize ค่าที่มาจากฐานข้อมูลจริง
 */
import { describe, it, expect, vi } from "vitest";
import { can, isRole, isAdminOrManager, normalizeRole, departmentOf, rankLabel, ROLES, DEPARTMENT, ALL_ROLES, CAPABILITIES, canAssignRole, canManageUserOfRole, roleLevel, RANK_LABEL, TECHNICIAN_ROLES, RANKS, ALL_RANKS, systemRoleOf, setRankLabels, titleOf, EXPENSE_WORKFLOW_CAPS } from "./roles";

describe("normalizeRole", () => {
  // ⚠️ role ถูกกรอกด้วยมือผ่านหน้าจัดการผู้ใช้ และเคยมีทั้งตัวใหญ่/ช่องว่างติดมา
  it("รับได้ทั้ง object และสตริง และตัดช่องว่าง/ตัวพิมพ์ใหญ่ทิ้ง", () => {
    expect(normalizeRole({ role: "Admin" })).toBe("admin");
    expect(normalizeRole(" TECHNICIAN ")).toBe("technician");
    expect(normalizeRole({ role: "  Sale " })).toBe("sale");
  });

  it("ค่าว่าง/undefined/null ไม่ทำให้พัง", () => {
    expect(normalizeRole(null)).toBe("");
    expect(normalizeRole(undefined)).toBe("");
    expect(normalizeRole({})).toBe("");
  });
});

describe("can", () => {
  it("ตอบตามตารางสิทธิ์", () => {
    expect(can(ROLES.ADMIN, "manageAll")).toBe(true);
    expect(can(ROLES.MANAGER, "manageAll")).toBe(true);
    expect(can({ role: "Manager" }, "approveJobs")).toBe(true);
  });

  // 🐛 กฎที่ทั้งหมดนี้ตั้งใจแก้: role ที่ไม่รู้จักต้องถูกปฏิเสธ ไม่ใช่หลุดผ่าน
  it("role ที่ไม่รู้จัก / ไม่มี role ถูกปฏิเสธเสมอ", () => {
    expect(can("ceo", "viewFinance")).toBe(false);
    expect(can(null, "viewFinance")).toBe(false);
    expect(can({}, "manageAll")).toBe(false);
  });

  // ⚠️ พิมพ์ชื่อสิทธิ์ผิดต้อง "ปฏิเสธ + ส่งเสียง" ไม่ใช่ปล่อยผ่านเงียบๆ
  it("ชื่อสิทธิ์ที่ไม่มีอยู่จริง = ปฏิเสธ และ log error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(can(ROLES.ADMIN, "capabilityThatDoesNotExist")).toBe(false);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("สิทธิ์ของ role เซล (ของใหม่)", () => {
  it("ลงแผนงานของตัวเองและแจ้งงานให้ช่างได้", () => {
    expect(can(ROLES.SALE, "createSalesPlan")).toBe(true);
    expect(can(ROLES.SALE, "requestDispatch")).toBe(true);
  });

  // ⚠️ หน้าการเงิน/ติดตามใบเสนอราคาผูกกับ "งานของช่าง" (วางบิล/รับเงินของงานที่ลงตารางแล้ว)
  // ไม่ใช่ยอดขายของเซล — ถูกตัดออกตามที่ผู้ใช้สั่ง เซลเปิดเข้าไปก็ไม่มีของตัวเอง
  it("ไม่เข้าหน้าการเงิน/ติดตามใบเสนอราคาของฝ่ายช่าง", () => {
    expect(can(ROLES.SALE, "viewFinance")).toBe(false);
    expect(can(ROLES.SALE, "viewQuotations")).toBe(false);
    expect(can(ROLES.SALE, "editDocuments")).toBe(false);
  });

  it("ไม่ยุ่งกับงานช่างและข้อมูลหลัก", () => {
    expect(can(ROLES.SALE, "viewAllJobs")).toBe(false);
    expect(can(ROLES.SALE, "editAnyJob")).toBe(false);
    expect(can(ROLES.SALE, "approveJobs")).toBe(false);
    expect(can(ROLES.SALE, "viewContracts")).toBe(false);
    expect(can(ROLES.SALE, "manageMasterData")).toBe(false);
    expect(can(ROLES.SALE, "assignDispatch")).toBe(false);   // จ่ายงานเองไม่ได้ ต้องผ่านแอดมิน
  });
});

describe("สิทธิ์เดิมต้องไม่เปลี่ยนเพราะการรวมศูนย์", () => {
  // ⚠️ ชุดนี้คือ regression guard ของงาน \"รวมศูนย์การเช็คสิทธิ์\" โดยเฉพาะ
  it("ช่างยังเข้าการเงิน/ภาพรวมงานได้ แต่ยังอนุมัติงานไม่ได้", () => {
    expect(can(ROLES.TECHNICIAN, "viewFinance")).toBe(true);
    expect(can(ROLES.TECHNICIAN, "viewContracts")).toBe(true);
    expect(can(ROLES.TECHNICIAN, "approveJobs")).toBe(false);
    expect(can(ROLES.TECHNICIAN, "editContracts")).toBe(false);
  });

  // ✅ ผู้ใช้สั่งให้ผู้จัดการมีสิทธิ์สูงสุด: ตั้งค่าระบบได้ทุกอย่าง + ตรวจสอบ/อนุมัติใบของตัวเองได้
  it("ผู้จัดการมีสิทธิ์สูงสุดเท่าแอดมิน", () => {
    expect(can(ROLES.MANAGER, "manageAll")).toBe(true);
    expect(can(ROLES.MANAGER, "editAnyJob")).toBe(true);
    expect(can(ROLES.MANAGER, "approveOwnExpense")).toBe(true);
    expect(can(ROLES.MANAGER, "approveOwnReview")).toBe(true);
    // ⚠️ ช่างยังต้องให้หัวหน้าพิจารณาเสมอ
    expect(can(ROLES.TECHNICIAN, "approveOwnExpense")).toBe(false);
  });

  // ✅ สายอนุมัติใบเบิก 4 ขั้น (ผู้ใช้กำหนด)
  it("ตรวจสอบ = แอดมิน/ผู้จัดการ · อนุมัติ = ผู้จัดการ · อนุมัติเบิกจ่าย = ผู้จัดการ/กรรมการ", () => {
    expect(can(ROLES.ADMIN, "reviewExpense")).toBe(true);
    expect(can(ROLES.MANAGER, "reviewExpense")).toBe(true);
    expect(can(ROLES.DIRECTOR, "reviewExpense")).toBe(false);
    expect(can(ROLES.MANAGER, "approveExpense")).toBe(true);
    expect(can(ROLES.ADMIN, "approveExpense")).toBe(false);
    expect(can(ROLES.DIRECTOR, "approveExpense")).toBe(false);
    expect(can(ROLES.DIRECTOR, "disburseExpense")).toBe(true);
    expect(can(ROLES.MANAGER, "disburseExpense")).toBe(true);
    expect(can(ROLES.ADMIN, "disburseExpense")).toBe(false);
    expect(can(ROLES.TECHNICIAN, "disburseExpense")).toBe(false);
  });

  // ✅ ลำดับชั้น: ผู้จัดการ (3) > แอดมิน (2) > ช่าง/เซล/ผู้ใช้ (1)
  it("แอดมินตั้งใครเป็นผู้จัดการไม่ได้ และแตะบัญชีผู้จัดการไม่ได้", () => {
    expect(canAssignRole(ROLES.ADMIN, ROLES.MANAGER)).toBe(false);
    expect(canAssignRole(ROLES.ADMIN, ROLES.ADMIN)).toBe(true);
    expect(canAssignRole(ROLES.ADMIN, ROLES.TECHNICIAN)).toBe(true);
    expect(canManageUserOfRole(ROLES.ADMIN, ROLES.MANAGER)).toBe(false);
    expect(canManageUserOfRole(ROLES.ADMIN, ROLES.ADMIN)).toBe(true);
  });

  it("ผู้จัดการตั้ง/แตะได้ทุกระดับ · ช่างตั้งสิทธิ์ใครไม่ได้เลย", () => {
    expect(canAssignRole(ROLES.MANAGER, ROLES.MANAGER)).toBe(true);
    expect(canManageUserOfRole(ROLES.MANAGER, ROLES.ADMIN)).toBe(true);
    expect(canAssignRole(ROLES.TECHNICIAN, ROLES.TECHNICIAN)).toBe(false);
    // ⚠️ role ที่ระบบไม่รู้จัก = ระดับ 0 ทำอะไรไม่ได้ และตั้งให้ใครก็ไม่ได้
    expect(roleLevel("tecnicain")).toBe(0);
    expect(canAssignRole(ROLES.MANAGER, "tecnicain")).toBe(false);
  });

  // ✅ ผู้ใช้ขอเพิ่ม "กรรมการผู้จัดการ" — สูงสุดของบริษัท
  it("กรรมการผู้จัดการมีทุกสิทธิ์ที่ผู้จัดการมี และอยู่เหนือทุกระดับ", () => {
    const caps = Object.keys(CAPABILITIES);
    /**
     * ⚠️ ข้อยกเว้นที่ตั้งใจ (ผู้ใช้กำหนดสายอนุมัติใบเบิก 4 ขั้น): กรรมการผู้จัดการอยู่ขั้น "อนุมัติเบิกจ่าย"
     * ไม่อยู่ขั้นตรวจสอบ ("ให้แค่แอดมิน และผู้จัดการเท่านั้น") และขั้นอนุมัติ ("ผู้จัดการที่อนุมัติ")
     * นอกจากสองขั้นนี้ ต้องมีทุกสิทธิ์ที่ผู้จัดการมี
     */
    const EXPENSE_STEP_EXCEPTIONS = ["reviewExpense", "approveExpense", "approveOwnReview"];
    const missing = caps.filter((c) => can(ROLES.MANAGER, c) && !can(ROLES.DIRECTOR, c));
    expect(missing.sort()).toEqual([...EXPENSE_STEP_EXCEPTIONS].sort());
    expect(can(ROLES.DIRECTOR, "disburseExpense")).toBe(true);
    expect(roleLevel(ROLES.DIRECTOR)).toBeGreaterThan(roleLevel(ROLES.MANAGER));
    expect(RANK_LABEL[ROLES.DIRECTOR]).toBe("กรรมการผู้จัดการ");
    // ⚠️ ผู้จัดการที่ "ไม่ใช่ Super Admin" ตั้ง/แตะบัญชีกรรมการผู้จัดการไม่ได้ (คนละระดับ)
    //    (ผู้จัดการที่เป็น Super Admin ทำได้ — Super Admin ไม่ติดลำดับชั้น ตามที่ผู้ใช้สั่ง 25 ก.ย. 2569)
    const adminManager = { rank: ROLES.MANAGER, role: "admin" };
    expect(canAssignRole(adminManager, ROLES.DIRECTOR)).toBe(false);
    expect(canManageUserOfRole(adminManager, ROLES.DIRECTOR)).toBe(false);
    expect(canAssignRole(ROLES.DIRECTOR, ROLES.DIRECTOR)).toBe(true);
    expect(canManageUserOfRole(ROLES.DIRECTOR, ROLES.MANAGER)).toBe(true);
  });

  // ✅ ผู้ใช้ขอเพิ่ม "หัวหน้าช่างเทคนิค" — ตอนนี้ต้องมีสิทธิ์เท่าช่างเทคนิคทุกข้อ
  it("หัวหน้าช่างเทคนิคมีสิทธิ์เท่าช่างเทคนิคทุกข้อ", () => {
    const caps = Object.keys(CAPABILITIES);
    const diff = caps.filter((c) => can(ROLES.TECHNICIAN, c) !== can(ROLES.TECH_LEAD, c));
    expect(diff).toEqual([]);
    expect(RANK_LABEL[ROLES.TECH_LEAD]).toBe("หัวหน้าช่างเทคนิค");
    expect(TECHNICIAN_ROLES).toContain(ROLES.TECH_LEAD);
  });

  // ⚠️ ชื่อสิทธิ์บนหน้าจอต้องตรงกับที่ผู้ใช้สั่ง (แผนกช่าง)
  it("ชื่อสิทธิ์ภาษาไทยตรงตามที่ตั้งไว้", () => {
    expect(RANK_LABEL[ROLES.MANAGER]).toBe("ผู้จัดการแผนกช่าง");
    expect(RANK_LABEL[ROLES.ADMIN]).toBe("แอดมินช่าง");
    expect(RANK_LABEL[ROLES.TECHNICIAN]).toBe("ช่างเทคนิค");
  });

  it("editOperation คงชุดเดิมที่มี user แต่ไม่มีช่าง", () => {
    expect(can(ROLES.USER, "editOperation")).toBe(true);
    expect(can(ROLES.TECHNICIAN, "editOperation")).toBe(false);
  });
});

describe("ตัวช่วยอื่น", () => {
  it("isRole / isAdminOrManager", () => {
    expect(isRole({ role: "SALE" }, ROLES.SALE)).toBe(true);
    expect(isRole("technician", ROLES.ADMIN, ROLES.TECHNICIAN)).toBe(true);
    expect(isAdminOrManager("manager")).toBe(true);
    expect(isAdminOrManager("technician")).toBe(false);
  });

  it("departmentOf — เฉพาะ role ที่สังกัดแผนกจริงเท่านั้นที่มีค่า", () => {
    expect(departmentOf(ROLES.TECHNICIAN)).toBe(DEPARTMENT.SERVICE);
    expect(departmentOf(ROLES.SALE)).toBe(DEPARTMENT.SALES);
    expect(departmentOf(ROLES.ADMIN)).toBe(null);
  });

  it("rankLabel เป็นภาษาไทยทุกตัว ไม่มีค่าดิบหลุดไปถึงหน้าจอ", () => {
    ALL_ROLES.forEach((r) => {
      expect(rankLabel(r)).toBeTruthy();
      expect(rankLabel(r)).not.toBe(r);
    });
  });
});

describe("ความถูกต้องของตารางเอง", () => {
  it("ทุกสิทธิ์ต้องมีอย่างน้อย 1 role ทำได้ (ไม่งั้นคือฟีเจอร์ที่ตายตั้งแต่เกิด)", () => {
    // ✅ ยกเว้นสิทธิ์ที่ผู้ใช้สั่งให้ Super Admin เท่านั้น (ว่างโดยเจตนา — Super Admin ผ่านทุกสิทธิ์)
    const SUPER_ONLY = ["manageWebsite", "viewLeads"];
    Object.entries(CAPABILITIES).forEach(([capability, roles]) => {
      if (SUPER_ONLY.includes(capability)) return;
      expect(roles.length, capability).toBeGreaterThan(0);
    });
  });

  it("เว็บไซต์บริษัท: Super Admin เท่านั้น — เซล/แอดมินที่ไม่ใช่ Super Admin ใช้ไม่ได้", () => {
    const superTech = { rank: "technician", role: "superadmin" };
    const plainAdmin = { rank: "admin", role: "admin" };
    const sale = { rank: "sale", role: "member" };
    expect(can(superTech, "manageWebsite")).toBe(true);
    expect(can(superTech, "viewLeads")).toBe(true);
    expect(can(plainAdmin, "manageWebsite")).toBe(false);
    // ✅ Admin ในระบบจัดการคำขอจากลูกค้าได้ (ผู้ใช้สั่ง) — ไม่ว่าตำแหน่งในองค์กรไหน
    expect(can(plainAdmin, "viewLeads")).toBe(true);
    expect(can({ rank: "director", role: "admin" }, "viewLeads")).toBe(true);
    expect(can(sale, "viewLeads")).toBe(false);
  });

  it("Super Admin ทำได้ทุกอย่าง (ยกเว้นสายอนุมัติค่าใช้จ่าย) และตั้ง/แก้ได้ทุกตำแหน่ง", () => {
    const superTech = { rank: "technician", role: "superadmin" };
    Object.keys(CAPABILITIES).forEach((c) => {
      if (EXPENSE_WORKFLOW_CAPS.includes(c)) return;
      expect(can(superTech, c), c).toBe(true);
    });
    expect(can(superTech, "approveExpense")).toBe(false);
    expect(canAssignRole(superTech, ROLES.DIRECTOR)).toBe(true);
    expect(canManageUserOfRole(superTech, ROLES.DIRECTOR)).toBe(true);
    // Admin ในระบบที่ไม่ใช่ Super Admin ยังติดลำดับชั้นเหมือนเดิม
    expect(canAssignRole({ rank: "admin", role: "admin" }, ROLES.MANAGER)).toBe(false);
  });

  it("ไม่มี role แปลกปลอมในตาราง (พิมพ์ผิด)", () => {
    Object.entries(CAPABILITIES).forEach(([capability, roles]) => {
      roles.forEach((r) => expect(ALL_ROLES, `${capability} → ${r}`).toContain(r));
    });
  });
});

/**
 * Role (ตำแหน่งในระบบ) กับ Rank (ตำแหน่งในองค์กร) — ✅ ผู้ใช้สั่งให้แยกจากกันขาด
 * ⚠️ การสลับสองคำนี้คือบั๊กด้านสิทธิ์ที่เงียบที่สุด — ทดสอบไว้ให้ชัด
 */
describe("Role กับ Rank แยกกัน", () => {
  it("Rank เรียงจากสิทธิ์มากไปน้อย (คอลัมน์ในตารางสิทธิ์ก็เรียงตามนี้)", () => {
    expect(ALL_ROLES).toEqual(["director", "manager", "admin", "techlead", "technician", "sale", "user"]);
  });

  it("RANKS เป็นชื่อเรียกใหม่ของ ROLES (คีย์เดิมทั้งหมด ไม่มีการย้ายข้อมูล)", () => {
    expect(RANKS).toBe(ROLES);
    expect(ALL_RANKS).toBe(ALL_ROLES);
  });

  it("Role เดาจาก Rank ได้เมื่อยังไม่เคยตั้ง (ผู้ใช้เก่าไม่ต้องย้ายข้อมูล)", () => {
    expect(systemRoleOf({ role: "manager" })).toBe("superadmin");
    expect(systemRoleOf({ role: "admin" })).toBe("admin");
    expect(systemRoleOf({ role: "technician" })).toBe("member");
  });

  it("ตั้ง Role เองแล้วชนะค่าที่เดา — ช่างเป็น Super Admin ได้ แต่ Rank ยังเป็นช่าง", () => {
    const techBoss = { role: "technician", systemRole: "superadmin" };
    expect(can(techBoss, "manageSystem")).toBe(true);
    expect(can(techBoss, "approveExpense")).toBe(false);
    expect(rankLabel(techBoss)).toBe("ช่างเทคนิค");
  });

  it("เปลี่ยนชื่อ Rank แล้วทุกหน้าจอเห็นชื่อใหม่ (องค์กรอื่นตั้งชื่อเองได้)", () => {
    setRankLabels({ admin: "ธุรกาช่าง" });
    expect(rankLabel("admin")).toBe("ธุรกาช่าง");
    setRankLabels({});
    expect(rankLabel("admin")).toBe("แอดมินช่าง");
  });

  it("titleOf: ตำแหน่งเฉพาะบุคคล > ค่าเก่า (rank) > ชื่อ Rank", () => {
    expect(titleOf({ role: "technician", jobTitle: "ช่างแอร์อาวุโส" })).toBe("ช่างแอร์อาวุโส");
    expect(titleOf({ role: "technician", rank: "ช่างเก่า" })).toBe("ช่างเก่า");
    expect(titleOf({ role: "technician" })).toBe("ช่างเทคนิค");
  });
});

/**
 * รูปแบบข้อมูลผู้ใช้ในฐานข้อมูล — ✅ ผู้ใช้สั่ง: "ทำรายการให้ตรง และตามชื่อจริงๆด้วย"
 *   rank = ตำแหน่งในองค์กร · role = ตำแหน่งในระบบ · jobTitle = ตำแหน่งเฉพาะบุคคล
 * ⚠️ ต้องอ่านข้อมูล "รูปแบบเก่า" (role = ตำแหน่งในองค์กร) ได้เหมือนเดิมทุกกรณี ไม่งั้นคนที่ยัง
 * ไม่ถูกย้าย หรือสำเนาที่ฝังอยู่ในเอกสารอื่น จะกลายเป็นคนไม่มีสิทธิ์อะไรเลยแบบเงียบๆ
 */
describe("อ่านตำแหน่งได้ทั้งรูปแบบใหม่และเก่า", () => {
  it("รูปแบบใหม่: rank = ตำแหน่งในองค์กร · role = ตำแหน่งในระบบ", () => {
    const boss = { rank: "technician", role: "superadmin" };
    expect(normalizeRole(boss)).toBe("technician");
    expect(systemRoleOf(boss)).toBe("superadmin");
    expect(can(boss, "manageSystem")).toBe(true);
    expect(can(boss, "approveExpense")).toBe(false);
  });

  it("รูปแบบเก่า: role = ตำแหน่งในองค์กร · systemRole = ตำแหน่งในระบบ", () => {
    const legacy = { role: "manager", systemRole: "superadmin" };
    expect(normalizeRole(legacy)).toBe("manager");
    expect(systemRoleOf(legacy)).toBe("superadmin");
    expect(can(legacy, "approveExpense")).toBe(true);
  });

  it("สำเนาที่ฝังในเอกสารอื่น (มีแค่ role) ยังอ่านออก", () => {
    expect(normalizeRole({ role: "sale" })).toBe("sale");
    expect(can({ role: "admin" }, "reviewExpense")).toBe(true);
  });

  it('คำว่า "admin" เป็นได้ทั้ง Rank และ Role — ต้องไม่สลับกัน', () => {
    const orgAdmin = { rank: "admin", role: "admin" };
    expect(normalizeRole(orgAdmin)).toBe("admin");
    expect(systemRoleOf(orgAdmin)).toBe("admin");
    expect(can(orgAdmin, "reviewExpense")).toBe(true);   // สิทธิ์จาก Rank
    expect(can(orgAdmin, "manageSystem")).toBe(false);   // Role แค่ Admin ตั้งค่าระบบไม่ได้
  });

  it("titleOf: ข้อมูลเก่าที่เคยพิมพ์ตำแหน่งไว้ในช่อง rank ยังไม่หายไปจากเอกสาร", () => {
    expect(titleOf({ role: "technician", rank: "ช่างอาวุโส" })).toBe("ช่างอาวุโส");
    expect(titleOf({ rank: "technician", role: "member" })).toBe("ช่างเทคนิค");
  });
});
