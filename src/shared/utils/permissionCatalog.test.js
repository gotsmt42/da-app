/**
 * permissionCatalog.test.js — รายการคำอธิบายสิทธิ์ต้องครบ และกติกาคู่กันต้องตรงกับ server
 */
import { describe, it, expect } from "vitest";
import { CAPABILITIES } from "./roles";
import { PERMISSION_ITEMS, CAP_NEEDS, capNotApplicable } from "./permissionCatalog";

// สิทธิ์ที่ server ไม่เปิดให้ปรับจากหน้าตั้งค่า (กฎตายตัวในโค้ด — นอก EDITABLE_CAPABILITIES)
const FIXED = ["viewQuotations", "viewAllSales", "approveOwnReview", "approveOwnExpense"];

describe("permissionCatalog", () => {
  it("ครอบคลุมทุกสิทธิ์ที่ปรับได้ และไม่มีชื่อสิทธิ์ที่ไม่มีจริง", () => {
    const editable = Object.keys(CAPABILITIES).filter((c) => !FIXED.includes(c)).sort();
    expect(PERMISSION_ITEMS.map((i) => i.cap).sort()).toEqual(editable);
    PERMISSION_ITEMS.forEach((i) => { expect(i.title && i.short && i.on && i.off).toBeTruthy(); });
  });

  it("คู่ แก้ไข → ดู ตรงกับ CAP_REQUIRES ฝั่ง server", () => {
    expect(CAP_NEEDS).toEqual({ editContracts: "viewContracts", editDocuments: "viewDocuments", editFinance: "viewFinance" });
  });

  it("ดูตารางงานช่างแบบอ่านอย่างเดียว ไม่มีผลกับตำแหน่งฝ่ายช่าง", () => {
    expect(capNotApplicable("technician", "viewServiceCalendar")).toBeTruthy();
    expect(capNotApplicable("techlead", "viewServiceCalendar")).toBeTruthy();
    expect(capNotApplicable("sale", "viewServiceCalendar")).toBeNull();
    expect(capNotApplicable("technician", "viewAllJobs")).toBeNull();
  });
});
