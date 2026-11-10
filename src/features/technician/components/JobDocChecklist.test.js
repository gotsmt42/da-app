/**
 * JobDocChecklist.test.js — โมดูลเอกสารฝั่งช่าง (ใช้ทั้งแผงงานช่าง และหน้า Event)
 * ✅ (10 พ.ย. 2569) ล็อกพฤติกรรม: บังคับ/มี-ไม่มี/แนบ/ดูอย่างเดียว ต้องเหมือนกันทุกหน้า
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { JobDocChecklist, jobDocProgress, DOCUMENT_TYPES } from "./JobDocChecklist";

vi.mock("@/shared/ui/swal", () => ({ default: { fire: vi.fn(async () => ({ isConfirmed: true })) }, confirmDelete: vi.fn(async () => true) }));

beforeAll(() => {
  if (!window.ResizeObserver) window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});

const base = { _id: "e1", title: "Service", status: "กำลังดำเนินการ", activityLog: [] };
const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);
const noop = () => {};

describe("JobDocChecklist", () => {
  it("shows all 4 document types · Service Report is required · others ask yes/no", () => {
    wrap(<JobDocChecklist event={base} onInputUpdate={noop} onFileUpload={noop} onDeleteFile={noop} onPreview={noop} />);
    for (const d of DOCUMENT_TYPES) expect(screen.getAllByText(d.label).length).toBeGreaterThan(0);
    expect(screen.getByText("งานนี้ต้องเสนอราคางานเพิ่มเติมให้ลูกค้าไหม?")).toBeTruthy();
    expect(screen.getByText("งานนี้ต้องวางบิลลูกค้าไหม?")).toBeTruthy();
    expect(screen.getByText("ต้องแนบไฟล์")).toBeTruthy(); // Service Report
  });

  it('answering "no" records the doc as handled immediately + writes activityLog', () => {
    const onInputUpdate = vi.fn(async () => {});
    wrap(<JobDocChecklist event={base} userName="ภูริต" onInputUpdate={onInputUpdate} onFileUpload={noop} onDeleteFile={noop} onPreview={noop} />);
    fireEvent.click(screen.getByText("ไม่ต้องวางบิล"));
    expect(onInputUpdate).toHaveBeenCalledWith("e1", expect.objectContaining({
      invoiceApplicable: false, documentSentInvoice: true,
      activityLog: [expect.objectContaining({ action: "document_applicable_set", userName: "ภูริต" })],
    }));
  });

  it('answering "yes" = must attach a file (not done yet)', () => {
    const onInputUpdate = vi.fn(async () => {});
    wrap(<JobDocChecklist event={base} onInputUpdate={onInputUpdate} onFileUpload={noop} onDeleteFile={noop} onPreview={noop} />);
    fireEvent.click(screen.getByText("ต้องเสนอราคา"));
    expect(onInputUpdate).toHaveBeenCalledWith("e1", expect.objectContaining({ quotationApplicable: true, documentSentQuotation: false }));
  });

  it("closed job / view-only: no attach button and no yes/no buttons enabled", () => {
    wrap(<JobDocChecklist event={base} isLocked onInputUpdate={noop} onFileUpload={noop} onDeleteFile={noop} onPreview={noop} />);
    expect(screen.queryByText("แนบไฟล์")).toBeNull();
    expect(screen.getByText("ไม่ต้องวางบิล").closest("button").disabled).toBe(true);
  });

  it("files show in the shared list · clicking opens with the index", () => {
    const onPreview = vi.fn();
    const ev = { ...base, reportFiles: [{ _id: "f1", fileUrl: "https://x/a.jpg", fileName: "a.jpg" }, { _id: "f2", fileUrl: "https://x/a.jpg", fileName: "a.jpg" }] };
    wrap(<JobDocChecklist event={ev} onInputUpdate={noop} onFileUpload={noop} onDeleteFile={noop} onPreview={onPreview} />);
    fireEvent.click(screen.getAllByText("a.jpg")[1]);
    expect(onPreview).toHaveBeenCalledWith("https://x/a.jpg", "a.jpg", expect.any(Array), 1);
  });

  it("embedded (Event page): delete confirms with window.confirm — never a Swal that would close the form", async () => {
    const swal = await import("@/shared/ui/swal");
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const onDeleteFile = vi.fn();
    const ev = { ...base, reportFiles: [{ _id: "f1", fileUrl: "https://x/r.pdf", fileName: "r.pdf" }] };
    wrap(<JobDocChecklist embedded event={ev} onInputUpdate={noop} onFileUpload={noop} onDeleteFile={onDeleteFile} onPreview={noop} />);
    fireEvent.click(screen.getByLabelText("ดาวน์โหลด/พิมพ์/แชร์/ลบ"));
    fireEvent.click(await screen.findByText("ลบไฟล์"));
    await vi.waitFor(() => expect(onDeleteFile).toHaveBeenCalledWith("e1", "report", "f1"));
    expect(confirmSpy).toHaveBeenCalled();
    expect(swal.confirmDelete).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("jobDocProgress counts completed documents", () => {
    expect(jobDocProgress(base)).toEqual({ done: 0, total: 4 });
    const ev = { ...base, quotationApplicable: false, documentSentQuotation: true, invoiceApplicable: false, documentSentInvoice: true };
    expect(jobDocProgress(ev).done).toBeGreaterThanOrEqual(2);
  });
});
