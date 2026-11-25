/**
 * RolePermissions.test.js — หน้าตั้งค่าสิทธิ์
 * ✅ (25 พ.ย. 2569 ผู้ใช้: "ทำปุ่มต้องกดบันทึกก่อนทุกครั้งหลังแก้ไข เพื่อกันข้อผิดพลาด")
 *    แก้ = ร่าง (ยังไม่ยิง server) → ตรวจสอบและบันทึก → ค่อยส่ง · เปิด "แก้ไข" ต้องได้ "ดู" คู่กันในร่างเหมือนที่ server ทำ
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PermissionService from "@/shared/services/PermissionService";
import RolePermissions from "./RolePermissions";

const D = ["director", "manager", "techadmin"];
const defaults = { viewAllJobs: D, viewServiceCalendar: [...D, "sale"], viewContracts: [...D, "technician", "techlead"], editContracts: D, reviewExpense: ["techadmin", "manager"] };
let effective;

vi.mock("@/shared/services/PermissionService", () => ({
  default: {
    matrix: vi.fn(async () => ({
      roles: [{ systemRole: "superadmin", label: "Super Admin" }, { systemRole: "admin", label: "Admin" }, { systemRole: "member", label: "Member" }],
      ranks: ["director", "manager", "techadmin", "techlead", "technician", "sale", "user"].map((r) => ({ rank: r, label: { director: "กรรมการผู้จัดการ", user: "ผู้ใช้ทั่วไป", technician: "ช่างเทคนิค" }[r] || r, locked: false })),
      capabilities: ["viewAllJobs", "viewServiceCalendar", "viewContracts", "editContracts", "reviewExpense"],
      defaults: window.__permDefaults, overrides: {}, effective: window.__permEffective,
    })),
    setOne: vi.fn(async ({ rank, capability, allowed }) => {
      const eff = window.__permEffective;
      const s = new Set(eff[capability]); if (allowed) s.add(rank); else s.delete(rank);
      eff[capability] = [...s];
      return { overrides: {}, linked: [], effective: eff };
    }),
    renameRanks: vi.fn(async () => ({})),
  },
}));
vi.mock("@/shared/services/authService", () => ({ default: { getAllUserData: vi.fn(async () => ({ allUser: [] })), UpdateUser: vi.fn(async () => ({})) } }));
vi.mock("@/shared/services/OrgSettingService", () => ({ default: { load: vi.fn(async () => ({})) } }));
vi.mock("@/shared/realtime/useRealtime", () => ({ default: () => {} }));
vi.mock("@/shared/hooks/usePermissions", () => ({ default: () => ({ can: () => true, role: "manager" }) }));
vi.mock("@/features/auth/AuthContext", () => ({ useAuth: () => ({ userData: { userId: "u1", role: "manager", rank: "manager", systemRole: "superadmin" } }) }));

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
});
beforeEach(() => {
  effective = JSON.parse(JSON.stringify(defaults));
  window.__permDefaults = defaults;
  window.__permEffective = effective;
  PermissionService.setOne.mockClear();
  try { localStorage.setItem("perm.openGroups", JSON.stringify(["jobs", "dispatch", "docs", "expense", "stock", "master"])); localStorage.setItem("perm.orgView", JSON.stringify("rank")); } catch { /* */ }
});

const renderPage = () => render(<MemoryRouter><RolePermissions /></MemoryRouter>);

describe("RolePermissions", () => {
  it("toggling only edits the draft; saving sends the change plus its linked view permission", async () => {
    renderPage();
    fireEvent.click(await screen.findByText("ผู้ใช้ทั่วไป"));
    fireEvent.click(screen.getByLabelText("เพิ่ม แก้ไข ต่ออายุสัญญา และจัดรอบเข้างาน"));
    // ยังไม่ส่ง server
    expect(PermissionService.setOne).not.toHaveBeenCalled();
    expect(screen.getByText(/แก้ไขแล้ว 2 ข้อ ใน 1 ตำแหน่ง/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "ตรวจสอบและบันทึก" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(within(dlg).getByRole("button", { name: /บันทึก 2 ข้อ/ }));
    await waitFor(() => expect(PermissionService.setOne).toHaveBeenCalledTimes(2));
    const sent = PermissionService.setOne.mock.calls.map(([a]) => `${a.rank}.${a.capability}=${a.allowed}`).sort();
    expect(sent).toEqual(["user.editContracts=true", "user.viewContracts=true"]);
    expect(await screen.findByText("บันทึกครบแล้ว")).toBeTruthy();
  }, 20000);

  it("cancel discards the draft without touching the server", async () => {
    renderPage();
    fireEvent.click(await screen.findByText("ผู้ใช้ทั่วไป"));
    fireEvent.click(screen.getByLabelText("เห็นงานของทุกคน (ไม่ใช่แค่งานของตัวเอง)"));
    expect(screen.getByText(/แก้ไขแล้ว 1 ข้อ ใน/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "ยกเลิกการแก้ไข" }));
    expect(screen.getByText("บันทึกครบแล้ว")).toBeTruthy();
    expect(PermissionService.setOne).not.toHaveBeenCalled();
  });

  it("shows real values for every rank (director is not shown as 'all ticked') and marks not-applicable cells", async () => {
    renderPage();
    fireEvent.click((await screen.findAllByText("กรรมการผู้จัดการ"))[0]);
    const review = screen.getByLabelText("ขั้นที่ 1 · ตรวจสอบใบเบิก / OT / ใบขอซื้อ ของคนอื่น");
    expect(review.checked).toBe(false);
    expect(review.disabled).toBe(false); // Super Admin แก้ได้ทุกตำแหน่ง
    fireEvent.click(screen.getAllByText("ช่างเทคนิค")[0]);
    expect(screen.getByText("ไม่มีผล")).toBeTruthy(); // ดูตารางงานช่างแบบอ่านอย่างเดียว ไม่มีผลกับฝ่ายช่าง
    expect(screen.queryByLabelText("เปิดดูตารางงานช่างได้ (ดูอย่างเดียว แก้ไม่ได้)")).toBeNull();
  });
});

