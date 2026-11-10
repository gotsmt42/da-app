/**
 * QuoteOnlyDialog.test.js — ใบเสนอราคาแยก (อิงงาน/สัญญา/ไม่อิง)
 * ✅ (10 พ.ย. 2569) สัญญาหมดอายุขึ้นก่อน · เลือกต้นทางแล้วลูกค้า/โครงการเติมให้ตรงกัน · บันทึกแล้วแนบไฟล์ต่อ
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import moment from "moment";
import QuoteOnlyDialog, { contractOptionsOf, jobOptionsOf } from "./QuoteOnlyDialog";
import EventService from "@/shared/services/EventService";

vi.mock("@/shared/services/EventService", () => ({ default: { CreateQuoteOnly: vi.fn(async () => ({ event: { _id: "new1" } })), UpdateQuoteRef: vi.fn(async () => ({ event: { _id: "q1" } })) } }));

beforeAll(() => {
  if (!window.ResizeObserver) window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});

const past = moment().subtract(20, "days").toISOString();
const soon = moment().add(30, "days").toISOString();
const far = moment().add(300, "days").toISOString();
const events = [
  { _id: "a1", contractGroupId: "C-ACTIVE", contractNo: "FA01-2569", site: "Alpha", contractEnd: far, start: "2026-01-01" },
  { _id: "a2", contractGroupId: "C-ACTIVE", contractNo: "FA01-2569", site: "Alpha", contractEnd: far, start: "2026-06-01" },
  { _id: "b1", contractGroupId: "C-EXP", contractNo: "FA02-2568", company: "Bravo Co", site: "Bravo", system: "Fire Alarm", contractEnd: past, start: "2025-01-01" },
  { _id: "c1", contractGroupId: "C-SOON", contractNo: "FA03-2569", site: "Charlie", contractEnd: soon, start: "2026-02-01" },
  { _id: "j1", title: "Service", system: "CCTV", site: "Delta", start: "2026-10-01", jobNo: "JOB-1" },
  { _id: "q0", quoteOnly: true, site: "ignored", start: "2026-10-02" },
];

describe("reference options", () => {
  it("contracts: one per contract · expired → expiring → active", () => {
    const list = contractOptionsOf(events);
    expect(list.map((c) => c.contractGroupId)).toEqual(["C-EXP", "C-SOON", "C-ACTIVE"]);
    expect(list[0]).toMatchObject({ state: "expired" });
    expect(list[1]).toMatchObject({ state: "expiring" });
  });
  it("jobs: standalone quotations excluded · multi-day job counted once", () => {
    const ids = jobOptionsOf(events).map((e) => e._id);
    expect(ids).not.toContain("q0");
    expect(ids).toContain("j1");
  });
});

describe("QuoteOnlyDialog", () => {
  it("opened from contract renewal: contract pre-selected · customer/project filled · saves reference + uploads files", async () => {
    const onSaved = vi.fn(); const onUploadFiles = vi.fn(async () => {});
    const { baseElement } = render(<QuoteOnlyDialog open events={events} initial={{ kind: "contract", contractGroupId: "C-EXP" }} onClose={() => {}} onSaved={onSaved} onUploadFiles={onUploadFiles} />);
    expect(screen.getByLabelText("โครงการ / สถานที่ *").value).toBe("Bravo");
    expect(screen.getByLabelText("บริษัท / ลูกค้า").value).toBe("Bravo Co");
    expect(screen.getByLabelText("เรื่อง").value).toBe("เสนอราคาต่อสัญญา");
    const f = new File(["x"], "QT-1.pdf", { type: "application/pdf" });
    fireEvent.change(baseElement.querySelector("input[type=file]"), { target: { files: [f] } });
    fireEvent.click(screen.getByText("บันทึก · เริ่มติดตาม"));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("new1"));
    expect(EventService.CreateQuoteOnly).toHaveBeenCalledWith(expect.objectContaining({ site: "Bravo", quoteRef: { kind: "contract", contractGroupId: "C-EXP" } }));
    expect(onUploadFiles).toHaveBeenCalledWith([f], "new1", "quotation");
  });

  it("not referenced: requires a project · saves with quoteRef null", async () => {
    const onSaved = vi.fn();
    render(<QuoteOnlyDialog open events={events} onClose={() => {}} onSaved={onSaved} />);
    const save = () => screen.getByText("บันทึกใบเสนอราคา").closest("button");
    expect(save().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("โครงการ / สถานที่ *"), { target: { value: "Echo" } });
    fireEvent.click(save());
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(EventService.CreateQuoteOnly).toHaveBeenLastCalledWith(expect.objectContaining({ site: "Echo", quoteRef: null }));
  });

  it("'contract' chosen without picking one = can't save", () => {
    render(<QuoteOnlyDialog open events={events} onClose={() => {}} onSaved={() => {}} />);
    fireEvent.click(screen.getByText("สัญญา"));
    fireEvent.change(screen.getByLabelText("โครงการ / สถานที่ *"), { target: { value: "X" } });
    expect(screen.getByText("บันทึกใบเสนอราคา").closest("button").disabled).toBe(true);
  });

  it("editing changes the reference via UpdateQuoteRef", async () => {
    const onSaved = vi.fn();
    render(<QuoteOnlyDialog open events={events} edit={{ _id: "q1", quoteOnly: true, site: "Old", quoteRef: null }} onClose={() => {}} onSaved={onSaved} />);
    fireEvent.click(screen.getByText("บันทึกการแก้ไข"));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("q1"));
    expect(EventService.UpdateQuoteRef).toHaveBeenCalledWith("q1", expect.objectContaining({ site: "Old", quoteRef: null }));
  });
});
