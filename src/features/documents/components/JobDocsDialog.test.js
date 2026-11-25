/**
 * JobDocsDialog.test.js — กล่องเอกสารประจำงานจากหน้าภาพรวมงาน
 * ✅ (25 พ.ย. 2569) รูปแบบเดียวกับหน้าการดำเนินงาน · ครั้งที่เข้าหลายช่วง: นับรวมทุกช่วง · ไฟล์ใหม่ไปช่วงล่าสุด
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import EventService from "@/shared/services/EventService";
import JobDocsDialog from "./JobDocsDialog";

vi.mock("@/shared/services/EventService", () => ({
  default: {
    GetEventById: vi.fn(async () => null), UpdateEvent: vi.fn(async () => ({})), Upload: vi.fn(async () => ({})),
    DeleteFile: vi.fn(async () => ({})), GetDraftEvents: vi.fn(async () => ({ drafts: [] })),
  },
}));

beforeAll(() => {
  if (!window.ResizeObserver) window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
});

const base = { title: "PM", system: "Fire Alarm", site: "Avani Pattaya Resort", company: "บริษัท ก", status: "ดำเนินการเสร็จสิ้น", allDay: true };
const visits = [
  { ...base, _id: "early", start: "2026-05-10", end: "2026-05-11", documentSentReport: true,
    reportFiles: [{ _id: "r1", fileName: "SR.jpg", fileUrl: "https://x/r1.jpg", fileType: "image/jpeg" }] },
  { ...base, _id: "late", start: "2026-05-20", end: "2026-05-21",
    invoiceFiles: [{ _id: "i1", fileName: "บิล.jpg", fileUrl: "https://x/i1.jpg", fileType: "image/jpeg" }] },
];
const admin = { role: "techadmin", rank: "techadmin", userId: "a1", fname: "แอดมิน" };

describe("JobDocsDialog (ภาพรวมงาน)", () => {
  it("same layout as the operation page: summary x/4 counted across every visit of the round", async () => {
    render(<MemoryRouter><JobDocsDialog roundVisits={visits} round={3} currentUser={admin} onClose={() => {}} /></MemoryRouter>);
    expect(await screen.findByText("เอกสารประจำงาน")).toBeTruthy();
    expect(screen.getByText("2/4")).toBeTruthy(); // SR (ติ๊ก+ไฟล์ช่วงแรก) + เอกสารการเงิน (ช่วงหลัง)
    expect(screen.getByText("ครั้งที่ 3 · Avani Pattaya Resort")).toBeTruthy();
    expect(screen.getByText("SR.jpg")).toBeTruthy();
    expect(screen.getByText("บิล.jpg")).toBeTruthy();
  });

  it("new files go to the latest visit (same anchor as the operation page) and the page is refreshed", async () => {
    const onChanged = vi.fn(async () => {});
    const { container } = render(<MemoryRouter><JobDocsDialog roundVisits={visits} round={3} currentUser={admin} onClose={() => {}} onChanged={onChanged} /></MemoryRouter>);
    await screen.findByText("เอกสารประจำงาน");
    const input = document.body.querySelector('input[type="file"]') || container.querySelector('input[type="file"]');
    const file = new File(["x"], "SR2.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(EventService.Upload).toHaveBeenCalled());
    expect(EventService.Upload.mock.calls[0][0]).toBe("late");
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    // ประวัติแบบเดียวกับหน้าการดำเนินงาน
    await waitFor(() => expect(EventService.UpdateEvent).toHaveBeenCalledWith("late", expect.objectContaining({ activityLog: [expect.objectContaining({ action: "file_uploaded" })] })));
  });
});
