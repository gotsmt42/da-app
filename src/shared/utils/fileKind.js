/**
 * fileKind — บอกชนิดไฟล์จากชื่อ/ลิงก์ เพื่อแสดงป้ายสี (PDF · XLS · DOC · รูป) ชุดเดียวกันทั้งแอป
 * ✅ (10 พ.ย. 2569 ผู้ใช้: "ให้แสดงรูปแบบไฟล์ด้วย ให้สวยงามเช่น PDF Excel หรือรูปภาพ พร้อมจัดวางให้ดูไม่รก")
 */
const IMG = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "bmp", "svg"];

export const fileExtOf = (name = "", url = "") => {
  const pick = (s) => {
    const m = String(s || "").split(/[?#]/)[0].match(/\.([a-z0-9]{1,5})$/i);
    return m ? m[1].toLowerCase() : "";
  };
  return pick(name) || pick(url);
};

/** @returns {{ key: "image"|"pdf"|"excel"|"word"|"other", label: string, color: string, isImage: boolean }} */
export const fileKindOf = (name = "", url = "") => {
  const ext = fileExtOf(name, url);
  if (IMG.includes(ext)) return { key: "image", label: "รูป", color: "#7c3aed", isImage: true };
  if (ext === "pdf") return { key: "pdf", label: "PDF", color: "#dc2626", isImage: false };
  if (["xls", "xlsx", "csv"].includes(ext)) return { key: "excel", label: "XLS", color: "#15803d", isImage: false };
  if (["doc", "docx"].includes(ext)) return { key: "word", label: "DOC", color: "#2563eb", isImage: false };
  return { key: "other", label: (ext || "ไฟล์").toUpperCase().slice(0, 4), color: "#64748b", isImage: false };
};

/** ขนาดไฟล์อ่านง่าย (1.2 MB) — ไม่มีค่า = "" */
export const fileSizeText = (n) => {
  const b = Number(n);
  if (!b) return "";
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};
