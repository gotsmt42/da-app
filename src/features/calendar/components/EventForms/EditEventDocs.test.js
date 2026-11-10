/**
 * EditEventDocs.test.js — เอกสารประจำงานในหน้า Event
 * 🐛 (10 พ.ย. 2569) ช่างต้องเห็นแบบเดียวกับหน้าดำเนินงาน (มี/ไม่มี · บังคับ · แนบได้) · แอดมินยังเป็นแบบตรวจเดิม
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import EditEventDocs from "./EditEventDocs";

vi.mock("@/shared/services/EventService", () => ({ default: { GetEventById: vi.fn(async () => null), UpdateEvent: vi.fn(async () => ({})), Upload: vi.fn(), DeleteFile: vi.fn() } }));

beforeAll(() => {
  if (!window.ResizeObserver) window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
});

const ev = { _id: "e1", title: "สแตนบาย", system: "Fire Alarm", site: "Holiday Inn", status: "กำลังดำเนินการ", team: "ภูริต", acks: [{}], activityLog: [] };
const open = () => fireEvent.click(screen.getByText(/ดู \/ ตรวจเอกสาร/));

describe("EditEventDocs (Event page)", () => {
  it("technician on the job: technician document module (progress x/4 · yes/no questions · attach)", async () => {
    render(<MemoryRouter><EditEventDocs event={ev} currentUser={{ role: "technician", userId: "u1", fname: "ภูริต" }} /></MemoryRouter>);
    open();
    expect(await screen.findByText("0/4 รายการ")).toBeTruthy();
    expect(screen.getByText("งานนี้ต้องวางบิลลูกค้าไหม?")).toBeTruthy();
    expect(screen.getAllByText("แนบไฟล์").length).toBeGreaterThan(0);
  });

  it("technician not on the job: view-only + says why", async () => {
    render(<MemoryRouter><EditEventDocs event={ev} currentUser={{ role: "technician", userId: "u9", fname: "สมชาย" }} /></MemoryRouter>);
    open();
    expect(await screen.findByText(/คุณไม่ได้อยู่ในงานนี้/)).toBeTruthy();
    expect(screen.queryByText("แนบไฟล์")).toBeNull();
  });

  it("admin: review-style document panel as before (no technician questions)", async () => {
    render(<MemoryRouter><EditEventDocs event={ev} currentUser={{ role: "techadmin", userId: "a1", fname: "แอดมิน" }} /></MemoryRouter>);
    open();
    expect(await screen.findByText("Service Report")).toBeTruthy();
    expect(screen.queryByText("งานนี้ต้องวางบิลลูกค้าไหม?")).toBeNull();
  });
});
