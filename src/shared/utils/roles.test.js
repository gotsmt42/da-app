/**
 * roles.test.js — ล็อกพฤติกรรมของตัวเช็คสิทธิ์กลาง
 *
 * ⚠️ การทดสอบชุดนี้เน้น "กฎที่ผิดแล้วเงียบ" เป็นหลัก ไม่ได้ไล่ทดสอบทุก capability ให้ครบทุกช่อง
 * (ความครบถ้วนของตารางมี `npm run check:perms` ฝั่ง server ดูแลอยู่แล้ว และเป็นตัวเดียวที่เทียบ
 * สองฝั่งให้ด้วย) ตรงนี้ดูเรื่องที่ script ตัวนั้นดูไม่ได้ เช่น การ normalize ค่าที่มาจากฐานข้อมูลจริง
 */
import { describe, it, expect, vi } from "vitest";
import {
  can, isRole, isAdminOrManager, normalizeRole, departmentOf, roleLabel,
  ROLES, DEPARTMENT, ALL_ROLES, CAPABILITIES,
} from "./roles";

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
    expect(can(ROLES.MANAGER, "manageAll")).toBe(false);
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

  it("ผู้จัดการยังทำงานระดับ admin ไม่ได้ (manageAll เดิมเป็นของ admin คนเดียว)", () => {
    expect(can(ROLES.MANAGER, "manageAll")).toBe(false);
    expect(can(ROLES.MANAGER, "editAnyJob")).toBe(true);
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

  it("roleLabel เป็นภาษาไทยทุกตัว ไม่มีค่าดิบหลุดไปถึงหน้าจอ", () => {
    ALL_ROLES.forEach((r) => {
      expect(roleLabel(r)).toBeTruthy();
      expect(roleLabel(r)).not.toBe(r);
    });
  });
});

describe("ความถูกต้องของตารางเอง", () => {
  it("ทุกสิทธิ์ต้องมีอย่างน้อย 1 role ทำได้ (ไม่งั้นคือฟีเจอร์ที่ตายตั้งแต่เกิด)", () => {
    Object.entries(CAPABILITIES).forEach(([capability, roles]) => {
      expect(roles.length, capability).toBeGreaterThan(0);
    });
  });

  it("ไม่มี role แปลกปลอมในตาราง (พิมพ์ผิด)", () => {
    Object.entries(CAPABILITIES).forEach(([capability, roles]) => {
      roles.forEach((r) => expect(ALL_ROLES, `${capability} → ${r}`).toContain(r));
    });
  });
});
