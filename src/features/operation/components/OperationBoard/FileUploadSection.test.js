import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FileUploadSection } from "./index";

beforeAll(() => {
  if (!window.ResizeObserver) window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});

const admin = { role: "admin", rank: { name: "admin", permissions: ["editOperation"] }, permissions: ["editOperation"] };
const files = [
  { _id: "1", fileUrl: "https://x/a.jpg", fileName: "224141.jpg", uploadedBy: "ช่าง A", uploadedAt: "2026-11-09T04:43:00Z" },
  { _id: "2", fileUrl: "https://x/a.jpg", fileName: "224141.jpg" },
  { _id: "3", fileUrl: "https://x/r.pdf", fileName: "report.pdf" },
];
const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("FileUploadSection (operation page documents) — shared file module", () => {
  it("renders every file with a type badge and sends the index to onPreview", () => {
    const onPreview = vi.fn();
    wrap(<FileUploadSection card eventId="e1" type="completion" label="ใบส่งมอบงาน" files={files} applicable onPreview={onPreview} onUpload={() => {}} onDelete={() => {}} currentUser={admin} />);
    expect(screen.getAllByText("224141.jpg")).toHaveLength(2);
    expect(screen.getByText("PDF")).toBeTruthy();
    expect(screen.getByText(/ช่าง A/)).toBeTruthy();
    fireEvent.click(screen.getAllByText("224141.jpg")[1]);
    expect(onPreview).toHaveBeenCalledWith("https://x/a.jpg", "224141.jpg", expect.any(Array), 1);
  });

  it("shows the uploading row in the same list (not a separate box)", () => {
    wrap(<FileUploadSection card eventId="e1" type="completion" label="ใบส่งมอบงาน" files={[]} applicable uploading progress={40} uploading_size="2 MB" onUpload={() => {}} onDelete={() => {}} onPreview={() => {}} currentUser={admin} />);
    expect(screen.getByText(/กำลังอัปโหลด 40%/)).toBeTruthy();
  });

  it("embedded (Event page) keeps the old look — no file-type badge", () => {
    wrap(<FileUploadSection card embedded eventId="e1" type="completion" label="ใบส่งมอบงาน" files={files.slice(2)} applicable onUpload={() => {}} onDelete={() => {}} onPreview={() => {}} currentUser={admin} />);
    expect(screen.getByText("report.pdf")).toBeTruthy();
    expect(screen.queryByText("PDF")).toBeNull();
  });
});
