/** RefQuotesBar.test.js — ใบเสนอราคาแยกที่อิงงาน แสดงในหน้างาน (10 พ.ย. 2569) */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RefQuotesBar, { refQuotesOf } from "./RefQuotesBar";

const nav = vi.fn();
vi.mock("react-router-dom", async (orig) => ({ ...(await orig()), useNavigate: () => nav }));
vi.mock("@/shared/realtime/useRealtime", () => ({ default: () => {} }));
vi.mock("@/shared/services/EventService", () => ({ default: { GetDraftEvents: vi.fn(async () => ({ drafts: [
  { _id: "q1", quoteOnly: true, title: "เปลี่ยนอุปกรณ์", quoteRef: { kind: "event", eventId: "e1", jobGroupId: "G1" }, quotationFiles: [{}], quotationStatus: "approved" },
  { _id: "q2", quoteOnly: true, title: "อื่น", quoteRef: { kind: "event", eventId: "zz" } },
  { _id: "q3", quoteOnly: true, title: "ยกเลิก", quoteRef: { kind: "event", eventId: "e1" }, cancelledAt: "2026-11-01" },
] })) } }));

beforeAll(() => { if (!window.ResizeObserver) window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; });

describe("RefQuotesBar", () => {
  it("refQuotesOf: matches the referenced day or any day of the same multi-day job", () => {
    const list = [{ _id: "a", quoteRef: { eventId: "e1", jobGroupId: "G1" } }, { _id: "b", quoteRef: { eventId: "x" } }];
    expect(refQuotesOf(list, { _id: "e1" }).map((q) => q._id)).toEqual(["a"]);
    expect(refQuotesOf(list, { _id: "e2", jobGroupId: "G1" }).map((q) => q._id)).toEqual(["a"]);
    expect(refQuotesOf(list, { _id: "e3" })).toEqual([]);
  });
  it("shows quotes referencing this job with status (cancelled hidden) · tap opens it in quotation tracking", async () => {
    render(<MemoryRouter><RefQuotesBar event={{ _id: "e9", jobGroupId: "G1" }} /></MemoryRouter>);
    expect(await screen.findByText("เปลี่ยนอุปกรณ์")).toBeTruthy();
    expect(screen.queryByText("ยกเลิก")).toBeNull();
    expect(screen.getByText(/ได้งาน/)).toBeTruthy();
    fireEvent.click(screen.getByText("เปลี่ยนอุปกรณ์"));
    await waitFor(() => expect(nav).toHaveBeenCalledWith("/finance?tab=quotations&jobId=q1"));
  });
});
