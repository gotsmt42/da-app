/**
 * QuotationDecision.test.js — บันทึก "ได้งาน" ของงานที่มีใบเสนอราคาหลายใบ
 * ✅ (10 พ.ย. 2569) ได้งานบางใบ = ระบุใบ + ยอดที่อนุมัติจริง (ยอดได้งานไม่เกิน) · แนบหลักฐานในกล่องเดียวกัน
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DecisionDialog, quoteListOf, wonAmountOf } from "./QuotationTracking";

beforeAll(() => {
  if (!window.ResizeObserver) window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});

const a = {
  _id: "e1", quotationNo: "QT2026090027, QT2026090028", quotationAmount: 43896.75,
  quotationAiFilled: { quotations: [{ quotationNo: "QT2026090027", grandTotal: 19340.25 }, { quotationNo: "QT2026090028", grandTotal: 24556.5 }] },
};
const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("quotations in a job", () => {
  it("quoteListOf: number + amount per quotation (AI) · no duplicate numbers", () => {
    expect(quoteListOf(a)).toMatchObject([{ no: "QT2026090027", amount: 19340.25 }, { no: "QT2026090028", amount: 24556.5 }]);
    expect(quoteListOf({ quotationNo: "A, B" })).toMatchObject([{ no: "A", amount: null }, { no: "B", amount: null }]);
  });
  it("quoteListOf: cards follow the attached files (AI file numbers · unmatched files get their own card · superseded excluded)", () => {
    const f1 = { fileUrl: "u1", fileName: "q1.jpg" }, f2 = { fileUrl: "u2", fileName: "q2.pdf" }, f3 = { fileUrl: "u3", fileName: "extra.png" };
    const old = { fileUrl: "u0", fileName: "old.pdf", supersededAt: "2026-10-01" };
    const withAi = { quotationFiles: [old, f1, f2, f3], quotationAiFilled: { quotations: [{ quotationNo: "QT1", grandTotal: 100, files: [1] }, { quotationNo: "QT2", grandTotal: 200, files: [2] }] } };
    expect(quoteListOf(withAi)).toMatchObject([{ no: "QT1", files: [f1] }, { no: "QT2", files: [f2] }, { no: "extra.png", amount: null, files: [f3] }]);
    // no AI: one card per file · numbers paired in order when counts match
    expect(quoteListOf({ quotationNo: "A, B", quotationFiles: [f1, f2] })).toMatchObject([{ no: "A", files: [f1] }, { no: "B", files: [f2] }]);
    // single file + single number + amount entered
    expect(quoteListOf({ quotationNo: "1231654654", quotationAmount: 5000, quotationFiles: [f1] })).toMatchObject([{ no: "1231654654", amount: 5000, files: [f1] }]);
  });
  it("wonAmountOf: partial win = approved amount · not specified = full amount", () => {
    expect(wonAmountOf({ quotationAmount: 100, quotationApprovedAmount: 40 })).toBe(40);
    expect(wonAmountOf({ quotationAmount: 100 })).toBe(100);
    expect(wonAmountOf({ quotationAmount: 100, quotationApprovedAmount: 0 })).toBe(0);
  });
});

describe('"won" dialog — multiple quotations', () => {
  it("approving one quotation sends its number + amount (auto-computed)", () => {
    const onConfirm = vi.fn();
    wrap(<DecisionDialog mode="approve" a={a} onClose={() => {}} onConfirm={onConfirm} />);
    expect(screen.getByText("ลูกค้าอนุมัติใบไหน?")).toBeTruthy();
    fireEvent.click(screen.getByText("QT2026090028")); // uncheck the second quotation
    expect(screen.getAllByText("฿19,340.25")).toHaveLength(2); // card + auto-computed won amount — no typing needed
    fireEvent.click(screen.getByText("บันทึก · ได้งาน"));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ approvedNos: ["QT2026090027"], approvedAmount: 19340.25 }));
  });

  it("approving every quotation at full amount = no partial fields sent", () => {
    const onConfirm = vi.fn();
    wrap(<DecisionDialog mode="approve" a={a} onClose={() => {}} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText("บันทึก · ได้งาน"));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ approvedNos: [], approvedAmount: null }));
  });

  it("unchecking every quotation = can't save (should press 'not won' instead)", () => {
    wrap(<DecisionDialog mode="approve" a={a} onClose={() => {}} onConfirm={() => {}} />);
    fireEvent.click(screen.getByText("QT2026090027"));
    fireEvent.click(screen.getByText("QT2026090028"));
    expect(screen.getByText(/เลือกอย่างน้อย 1 ใบ/)).toBeTruthy();
    expect(screen.getByText("บันทึก · ได้งาน").closest("button").disabled).toBe(true);
  });

  it("evidence files attach in the same dialog and go to onConfirm", () => {
    const onConfirm = vi.fn();
    const { container } = wrap(<DecisionDialog mode="approve" a={a} onClose={() => {}} onConfirm={onConfirm} />);
    const f = new File(["x"], "PO-123.pdf", { type: "application/pdf" });
    fireEvent.change(container.ownerDocument.querySelector("input[type=file]"), { target: { files: [f] } });
    expect(screen.getByText("PO-123.pdf")).toBeTruthy();
    fireEvent.click(screen.getByText("บันทึก · ได้งาน"));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ files: [f] }));
  });

  it("single quotation: shown as a card · press 'enter amount manually' to type a negotiated amount", () => {
    const onConfirm = vi.fn();
    wrap(<DecisionDialog mode="approve" a={{ _id: "e2", quotationNo: "QT1", quotationAmount: 1000 }} onClose={() => {}} onConfirm={onConfirm} />);
    expect(screen.getByText("QT1")).toBeTruthy(); // single quotation also shown as a tappable card
    fireEvent.click(screen.getByText("ระบุยอดเอง"));
    fireEvent.change(screen.getByLabelText("ยอดที่ลูกค้าอนุมัติ (บาท)"), { target: { value: "900" } });
    fireEvent.click(screen.getByText("บันทึก · ได้งาน"));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ approvedAmount: 900 }));
  });

  it("partial win where per-quotation amounts are unknown = must type the amount", () => {
    const onConfirm = vi.fn();
    wrap(<DecisionDialog mode="approve" a={{ _id: "e3", quotationNo: "A1, A2", quotationAmount: 5000 }} onClose={() => {}} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText("A2"));
    expect(screen.getByText("บันทึก · ได้งาน").closest("button").disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("ยอดที่ลูกค้าอนุมัติ (บาท)"), { target: { value: "3000" } });
    fireEvent.click(screen.getByText("บันทึก · ได้งาน"));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ approvedNos: ["A1"], approvedAmount: 3000 }));
  });

  it("tapping a quotation's file thumbnail opens the file (does not toggle selection)", () => {
    const onPreview = vi.fn(); const onConfirm = vi.fn();
    const f1 = { fileUrl: "https://x/q1.pdf", fileName: "q1.pdf" }, f2 = { fileUrl: "https://x/q2.pdf", fileName: "q2.pdf" };
    wrap(<DecisionDialog mode="approve" a={{ _id: "e4", quotationNo: "A, B", quotationFiles: [f1, f2] }} onPreview={onPreview} onClose={() => {}} onConfirm={onConfirm} />);
    fireEvent.click(screen.getAllByTitle(/ดูไฟล์/)[1]);
    expect(onPreview).toHaveBeenCalledWith("https://x/q2.pdf", "q2.pdf");
    expect(screen.getAllByRole("checkbox").every((c) => c.getAttribute("aria-checked") === "true")).toBe(true);
  });

  it("amount unknown (one or every quotation) = must type the approved amount before saving", () => {
    const onConfirm = vi.fn();
    const f1 = { fileUrl: "u1", fileName: "217549.jpg" }, f2 = { fileUrl: "u2", fileName: "Supplier Training.pdf" };
    wrap(<DecisionDialog mode="approve" a={{ _id: "e5", quotationFiles: [f1, f2] }} onClose={() => {}} onConfirm={onConfirm} />);
    const save = () => screen.getByText("บันทึก · ได้งาน").closest("button");
    expect(save().disabled).toBe(true); // every quotation, amount unknown
    fireEvent.click(screen.getByText("Supplier Training.pdf"));
    expect(save().disabled).toBe(true); // one quotation, amount unknown — same rule
    fireEvent.change(screen.getByLabelText("ยอดที่ลูกค้าอนุมัติ (บาท)"), { target: { value: "2222" } });
    fireEvent.click(save());
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ approvedNos: ["217549.jpg"], approvedAmount: 2222 }));
  });
  it("AI read button appears only for picked quotations with unknown amounts", () => {
    const f1 = { _id: "a1", fileUrl: "u1", fileName: "known.pdf" }, f2 = { _id: "a2", fileUrl: "u2", fileName: "unknown.pdf" };
    const a2 = { _id: "e6", quotationFiles: [f1, f2], quotationAiFilled: { quotations: [{ quotationNo: "QT9", grandTotal: 500, files: [1] }] } };
    wrap(<DecisionDialog mode="approve" a={a2} onClose={() => {}} onConfirm={() => {}} />);
    expect(screen.getByText(/ให้ AI อ่านยอดใบที่เลือก \(1 ไฟล์\)/)).toBeTruthy(); // only unknown.pdf
    fireEvent.click(screen.getByText("unknown.pdf")); // untick the unknown one
    expect(screen.queryByText(/ให้ AI อ่านยอด/)).toBeNull(); // QT9 already has a price — no re-read
  });
});
