/**
 * jobDocPermissions.test.js — สิทธิ์แนบ/ลบเอกสารประจำงาน (ต้องตรงกับ server: PUT /events/upload · delete-file)
 * 🐛 (10 พ.ย. 2569) ช่างในงานไม่มีปุ่ม "แนบ" ในหน้า Event — ล็อกกติกาไว้ไม่ให้หลุดอีก
 */
import { describe, it, expect } from "vitest";
import { canEditJobFiles, canDeleteJobFile } from "./jobDocPermissions";

const tech = { role: "technician", userId: "u1", fname: "ภูริต" };
const otherTech = { role: "technician", userId: "u9", fname: "สมชาย" };
const lead = { role: "techlead", userId: "u2", fname: "หัวหน้า" };
const staff = { role: "user", userId: "u3", fname: "จนท" };
const admin = { role: "techadmin", userId: "u4", fname: "แอดมิน" };
const manager = { role: "manager", userId: "u5", fname: "ผจก" };
const sale = { role: "sale", userId: "u6", fname: "เซล" };

const open = { _id: "e1", status: "กำลังดำเนินการ", team: "ภูริต", teamMembers: [{ userId: "u2", name: "หัวหน้า" }] };
const closed = { ...open, status: "ดำเนินการเสร็จสิ้น" };
const byResp = { _id: "e2", status: "กำลังดำเนินการ", responsiblePersonId: "u9" };

describe("canEditJobFiles — who can attach job documents", () => {
  it("a technician on the job can attach every document type (the Event-page bug)", () => {
    for (const t of ["report", "quotation", "invoice", "completion"]) expect(canEditJobFiles(tech, open, t)).toBe(true);
  });
  it("team members (tech lead) and the responsible person can attach too", () => {
    expect(canEditJobFiles(lead, open, "report")).toBe(true);
    expect(canEditJobFiles(otherTech, byResp, "report")).toBe(true);
  });
  it("a technician not on the job / a salesperson can only view", () => {
    expect(canEditJobFiles(otherTech, open, "report")).toBe(false);
    expect(canEditJobFiles(sale, open, "report")).toBe(false);
  });
  it("staff (user) can attach on open jobs as before", () => {
    expect(canEditJobFiles(staff, open, "invoice")).toBe(true);
  });
  it("closed job: only admin/manager can change files — others only quotations", () => {
    expect(canEditJobFiles(tech, closed, "report")).toBe(false);
    expect(canEditJobFiles(staff, closed, "completion")).toBe(false);
    expect(canEditJobFiles(tech, closed, "quotation")).toBe(true);
    expect(canEditJobFiles(tech, closed, "quotationResult")).toBe(true);
    expect(canEditJobFiles(admin, closed, "report")).toBe(true);
    expect(canEditJobFiles(manager, closed, "invoice")).toBe(true);
  });
  it("not logged in = no permission", () => {
    expect(canEditJobFiles(null, open, "report")).toBe(false);
  });
});

describe("canDeleteJobFile — who can delete files", () => {
  it("can delete if allowed to attach", () => {
    expect(canDeleteJobFile(tech, open, "report", { _id: "f" })).toBe(true);
  });
  it("superseded quotations and files from dispatch requests can't be deleted, even by admin", () => {
    expect(canDeleteJobFile(admin, open, "quotation", { supersededAt: "2026-11-01" })).toBe(false);
    expect(canDeleteJobFile(admin, open, "sitePhoto", { source: "dispatch" })).toBe(false);
  });
  it("a technician not on the job can't delete", () => {
    expect(canDeleteJobFile(otherTech, open, "report", { _id: "f" })).toBe(false);
  });
});
