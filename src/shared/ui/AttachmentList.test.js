import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { fileKindOf, fileExtOf, fileSizeText } from "@/shared/utils/fileKind";
import AttachmentList from "./AttachmentList";
import FileGalleryDialog from "./FileGalleryDialog";

vi.mock("@/shared/ui/swal", () => ({ default: { fire: vi.fn(async () => ({ isConfirmed: true })) } }));

beforeAll(() => {
  if (!URL.createObjectURL) URL.createObjectURL = () => "blob:x";
  if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {};
  if (!window.ResizeObserver) window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});

describe("fileKind", () => {
  it("identifies file types from the name or the URL", () => {
    expect(fileKindOf("a.PDF").key).toBe("pdf");
    expect(fileKindOf("b.xlsx").key).toBe("excel");
    expect(fileKindOf("c.docx").key).toBe("word");
    expect(fileKindOf("d.HEIC").isImage).toBe(true);
    expect(fileKindOf("", "https://x/y/photo.jpg?v=1").isImage).toBe(true);
    expect(fileKindOf("noext").key).toBe("other");
    expect(fileExtOf("a.b.c.png")).toBe("png");
  });
  it("formats file sizes", () => {
    expect(fileSizeText(0)).toBe("");
    expect(fileSizeText(2048)).toBe("2 KB");
    expect(fileSizeText(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});

const files = [
  { _id: "1", fileUrl: "https://x/a.jpg", fileName: "224141.jpg", tag: "แนบเพิ่ม", uploadedAt: "2026-11-09T04:43:00Z" },
  { _id: "2", fileUrl: "https://x/a.jpg", fileName: "224141.jpg", tag: { text: "ฉบับเดิม", old: true } },
  { _id: "3", fileUrl: "https://x/b.pdf", fileName: "quote.pdf", uploadedBy: "สมชาย" },
];

describe("AttachmentList", () => {
  it("shows every file with its type badge and source tag", () => {
    render(<AttachmentList title="ไฟล์แนบ" files={files} readOnly />);
    expect(screen.getAllByText("224141.jpg")).toHaveLength(2);
    expect(screen.getByText("quote.pdf")).toBeTruthy();
    expect(screen.getByText("PDF")).toBeTruthy();
    expect(screen.getByText(/3 ไฟล์/)).toBeTruthy();
    expect(screen.getByText(/ฉบับเดิม/).textContent).toContain("🔒");
    expect(screen.getByText(/สมชาย/)).toBeTruthy();
  });

  it("passes the clicked file's index to onOpen, even when links repeat", () => {
    const onOpen = vi.fn();
    render(<AttachmentList files={files} readOnly onOpen={onOpen} />);
    fireEvent.click(screen.getAllByText("224141.jpg")[1]);
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ _id: "2" }), 1, expect.any(Array));
  });

  it("deletes without a second confirm when confirmDelete={false}", async () => {
    const onDelete = vi.fn(async () => {});
    render(<AttachmentList files={files.slice(2)} onDelete={onDelete} confirmDelete={false} />);
    fireEvent.click(screen.getByLabelText("ลบไฟล์"));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ _id: "3" })));
  });

  it("opens the ⋮ menu via onRowMenu instead of showing a delete button", () => {
    const onRowMenu = vi.fn();
    render(<AttachmentList files={files.slice(2)} readOnly onRowMenu={onRowMenu} onDelete={() => {}} />);
    expect(screen.queryByLabelText("ลบไฟล์")).toBeNull();
    fireEvent.click(screen.getByLabelText("ดาวน์โหลด/พิมพ์/แชร์/ลบ"));
    expect(onRowMenu).toHaveBeenCalled();
  });

  it("shows an uploading row while the page uploads files itself", () => {
    render(<AttachmentList files={[]} readOnly uploading={{ progress: 45, sizeText: "1.2 MB" }} />);
    expect(screen.getByText(/กำลังอัปโหลด 45%/)).toBeTruthy();
  });

  it("uploads in the background: a temporary row stays until the real list is loaded", async () => {
    let finish;
    const upload = vi.fn((file, key, onProgress) => { onProgress(0.5); return new Promise((r) => { finish = r; }); });
    const onUploaded = vi.fn(async () => {});
    const { container } = render(<AttachmentList files={[]} actions={[{ key: "sitePhoto", label: "แนบไฟล์" }]} upload={upload} onUploaded={onUploaded} />);
    const input = container.querySelector("input[type=file]");
    fireEvent.click(screen.getByText("แนบไฟล์")); // เลือกชนิดไฟล์ก่อน (เหมือนผู้ใช้กดปุ่มแนบ)
    const f = new File(["x"], "site.png", { type: "image/png" });
    await act(async () => { fireEvent.change(input, { target: { files: [f] } }); });
    expect(screen.getByText("site.png")).toBeTruthy();
    expect(screen.getByText(/กำลังอัปโหลด 50%/)).toBeTruthy();
    expect(upload).toHaveBeenCalledWith(f, "sitePhoto", expect.any(Function));
    await act(async () => { finish(); });
    await waitFor(() => expect(onUploaded).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText("site.png")).toBeNull());
  });

  it("keeps a failed upload row and labels it as failed", async () => {
    const upload = vi.fn(async () => { throw new Error("net"); });
    const { container } = render(<AttachmentList files={[]} actions={[{ key: "a", label: "แนบ" }]} upload={upload} />);
    const f = new File(["x"], "bad.pdf", { type: "application/pdf" });
    await act(async () => { fireEvent.change(container.querySelector("input[type=file]"), { target: { files: [f] } }); });
    await waitFor(() => expect(screen.getByText("อัปโหลดไม่สำเร็จ")).toBeTruthy());
  });
});

describe("FileGalleryDialog", () => {
  it("moves to the next image even when two files share a link (duplicate names)", () => {
    const list = [
      { fileUrl: "https://x/a.jpg", fileName: "224141.jpg" },
      { fileUrl: "https://x/a.jpg", fileName: "224141.jpg" },
    ];
    const onNavigate = vi.fn();
    render(<FileGalleryDialog previewUrl={list[0].fileUrl} previewFileName="224141.jpg" previewIndex={0} gallery={list} onNavigate={onNavigate} onClose={() => {}} />);
    expect(screen.getByText("1 / 2")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("ไฟล์ถัดไป"));
    expect(onNavigate).toHaveBeenCalledWith(list[1], 1);
  });
  it("shows 2 / 2 when previewIndex = 1", () => {
    const list = [{ fileUrl: "u", fileName: "a.jpg" }, { fileUrl: "u", fileName: "a.jpg" }];
    render(<FileGalleryDialog previewUrl="u" previewFileName="a.jpg" previewIndex={1} gallery={list} onNavigate={() => {}} onClose={() => {}} />);
    expect(screen.getByText("2 / 2")).toBeTruthy();
  });
});
