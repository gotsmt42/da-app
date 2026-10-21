/**
 * FileGalleryDialog — กล่องดูไฟล์แบบ "เลื่อนดูไฟล์อื่นในช่องเดียวกันได้เลย" (ใช้ร่วมทุกหน้า)
 *
 * ✅ (21 ต.ค. 2569 ผู้ใช้: "รูปที่อัปมา อยากให้เลื่อนดูรูปอื่นๆ ที่อยู่ช่องเดียวกันได้เลย ไม่ต้องกดเปิดปิด เสียเวลา ใช้ยาก")
 *    • ลูกศรซ้าย/ขวาบนรูป · ปุ่ม ← → บนคีย์บอร์ด · มือถือปัดซ้าย/ขวา (ตอนรูปไม่ได้ซูมเกินจอ)
 *    • แถบรูปย่อด้านล่าง กดข้ามไปไฟล์ไหนก็ได้ · บอกลำดับ "2 / 5"
 *    • โหลดรูปถัดไป/ก่อนหน้าไว้ล่วงหน้า — กดเลื่อนแล้วขึ้นทันที
 * @param previewUrl / previewFileName  ไฟล์ที่เปิดอยู่
 * @param gallery    [{ fileUrl, fileName }] ไฟล์ทั้งหมดในช่องเดียวกัน (ไม่ส่ง = ไฟล์เดียว)
 * @param onNavigate (file) เปลี่ยนไฟล์ที่เปิด
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Dialog, DialogContent, DialogTitle, Divider, IconButton, LinearProgress, Stack, Tooltip, Typography } from "@mui/material";
import { Close, Download, ChevronLeftRounded, ChevronRightRounded, Image as ImageIcon, PictureAsPdf, Article, InsertDriveFile, AttachFile, FolderOpen } from "@mui/icons-material";
import ImagePreview from "@/shared/ui/ImagePreview";
import PdfBlobView from "@/shared/components/PdfBlobView";
import { thumbUrl, getOptimizedImageUrl } from "@/shared/utils/cloudinaryImage";

export const fileKind = (name = "") => {
  const l = String(name || "").toLowerCase();
  if (/\.(jpe?g|png|webp|gif|heic|heif)$/.test(l)) return "image";
  if (l.endsWith(".pdf")) return "pdf";
  if (/\.docx?$/.test(l)) return "word";
  if (/\.xlsx?$/.test(l)) return "excel";
  return "unknown";
};
const kindIcon = (name, sx) => {
  const t = fileKind(name);
  if (t === "image") return <ImageIcon sx={{ color: "#10b981", ...sx }} />;
  if (t === "pdf") return <PictureAsPdf sx={{ color: "#ef4444", ...sx }} />;
  if (t === "word") return <Article sx={{ color: "#3b82f6", ...sx }} />;
  if (t === "excel") return <InsertDriveFile sx={{ color: "#10b981", ...sx }} />;
  return <AttachFile sx={{ color: "#6b7280", ...sx }} />;
};

export const downloadFile = async (url, fileName) => {
  if (!url) return;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Download failed");
    const blobUrl = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = blobUrl; a.download = fileName || "download";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch {
    window.open(url, "_blank", "noopener");
  }
};

/** PDF: โหลดเป็น blob แล้วใช้ตัวแสดง PDF ของเบราว์เซอร์ (เลี่ยงปัญหา Range request ของ CDN) */
function PdfView({ url, onDownload }) {
  const [state, setState] = useState({ loading: true, err: false, blob: null });
  useEffect(() => {
    let cancelled = false; let obj = null;
    setState({ loading: true, err: false, blob: null });
    fetch(url).then((r) => { if (!r.ok) throw new Error(); return r.blob(); })
      .then((b) => { if (cancelled) return; obj = URL.createObjectURL(b); setState({ loading: false, err: false, blob: obj }); })
      .catch(() => { if (!cancelled) setState({ loading: false, err: true, blob: null }); });
    return () => { cancelled = true; if (obj) URL.revokeObjectURL(obj); };
  }, [url]);
  if (state.loading) return <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}><LinearProgress sx={{ mx: 6, mb: 2, borderRadius: 1 }} /><Typography variant="body2">กำลังโหลดไฟล์...</Typography></Box>;
  if (state.err) return (
    <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
      <PictureAsPdf sx={{ fontSize: 48, opacity: 0.3 }} /><Typography>ไม่สามารถแสดงตัวอย่างไฟล์นี้ได้</Typography>
      <Button size="small" variant="outlined" sx={{ mt: 1.5, borderRadius: 2 }} onClick={onDownload}>ดาวน์โหลดแทน</Button>
    </Box>
  );
  return state.blob ? <PdfBlobView url={state.blob} /> : null;
}

const STRIP_H = 76;

export default function FileGalleryDialog({ previewUrl, previewFileName, gallery, onNavigate, onClose }) {
  const list = useMemo(() => {
    const g = (gallery || []).filter((f) => f?.fileUrl);
    return g.some((f) => f.fileUrl === previewUrl) ? g : (previewUrl ? [{ fileUrl: previewUrl, fileName: previewFileName }] : []);
  }, [gallery, previewUrl, previewFileName]);
  const idx = Math.max(0, list.findIndex((f) => f.fileUrl === previewUrl));
  const multi = list.length > 1;
  const type = fileKind(previewFileName || previewUrl || "");
  const go = useCallback((d) => {
    if (!multi) return;
    const n = list[(idx + d + list.length) % list.length];
    if (n) onNavigate?.(n);
  }, [multi, list, idx, onNavigate]);

  // คีย์บอร์ด ← →
  useEffect(() => {
    if (!previewUrl || !multi) return undefined;
    const h = (e) => {
      if (e.target?.closest?.("input, textarea, [contenteditable=true]")) return;
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [previewUrl, multi, go]);

  // โหลดรูปข้างเคียงไว้ล่วงหน้า
  useEffect(() => {
    if (!multi) return;
    [list[(idx + 1) % list.length], list[(idx - 1 + list.length) % list.length]].forEach((f) => {
      if (f && fileKind(f.fileName || f.fileUrl) === "image") { const im = new Image(); im.src = getOptimizedImageUrl(f.fileUrl, { width: 1600 }); }
    });
  }, [multi, list, idx]);

  // แถบรูปย่อ: เลื่อนให้ไฟล์ที่เปิดอยู่เห็นเสมอ
  const stripRef = useRef(null);
  useEffect(() => {
    stripRef.current?.querySelector?.("[data-on='1']")?.scrollIntoView?.({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [idx]);

  const mobile = typeof window !== "undefined" && window.matchMedia?.("(max-width:600px)").matches;
  const arrow = (side) => (
    <IconButton aria-label={side < 0 ? "ไฟล์ก่อนหน้า" : "ไฟล์ถัดไป"} onClick={() => go(side)}
      sx={{ position: "absolute", top: "50%", [side < 0 ? "left" : "right"]: { xs: 6, sm: 14 }, transform: "translateY(-50%)", zIndex: 3,
        width: { xs: 40, sm: 48 }, height: { xs: 40, sm: 48 }, color: "#fff", bgcolor: "rgba(15,23,42,.55)", border: "1px solid rgba(255,255,255,.2)",
        backdropFilter: "blur(4px)", "&:hover": { bgcolor: "rgba(15,23,42,.8)" } }}>
      {side < 0 ? <ChevronLeftRounded sx={{ fontSize: 30 }} /> : <ChevronRightRounded sx={{ fontSize: 30 }} />}
    </IconButton>
  );

  return (
    <Dialog open={Boolean(previewUrl)} onClose={onClose} maxWidth="xl" fullWidth fullScreen={mobile}
      PaperProps={{ sx: { borderRadius: mobile ? 0 : 3, overflow: "hidden" } }}>
      <DialogTitle sx={{ m: 0, p: { xs: 1.5, sm: 2 }, display: "flex", alignItems: "center", gap: 1.5 }}>
        {kindIcon(previewFileName)}
        <Typography fontWeight={700} noWrap flex={1} title={previewFileName}>{previewFileName || "ดูไฟล์"}</Typography>
        {multi && <Box sx={{ px: 1, py: 0.25, borderRadius: 99, bgcolor: "#f1f5f9", fontSize: "0.78rem", fontWeight: 800, color: "#334155", whiteSpace: "nowrap" }}>{idx + 1} / {list.length}</Box>}
        <Stack direction="row" gap={0.5}>
          {previewUrl && <Tooltip title="ดาวน์โหลด"><IconButton onClick={() => downloadFile(previewUrl, previewFileName)}><Download /></IconButton></Tooltip>}
          <IconButton onClick={onClose} aria-label="ปิด"><Close /></IconButton>
        </Stack>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ p: 0, position: "relative", bgcolor: type === "image" ? "#0f172a" : undefined }}>
        {multi && arrow(-1)}
        {multi && arrow(1)}
        {type === "image" && <ImagePreview key={previewUrl} url={previewUrl} name={previewFileName} reserve={multi ? STRIP_H : 0} onSwipe={multi ? go : undefined} />}
        {type === "pdf" && <PdfView key={previewUrl} url={previewUrl} onDownload={() => downloadFile(previewUrl, previewFileName)} />}
        {(type === "word" || type === "excel") && <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`} width="100%" height="780px" style={{ border: "none" }} title="Office" />}
        {type === "unknown" && <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}><FolderOpen sx={{ fontSize: 48 }} /><Typography>ไม่สามารถแสดงไฟล์นี้ได้</Typography></Box>}
      </DialogContent>
      {multi && (
        <Stack ref={stripRef} direction="row" gap={0.75} data-no-swipe
          sx={{ height: STRIP_H, flexShrink: 0, px: 1.25, py: 1, overflowX: "auto", bgcolor: "#0b1220", borderTop: "1px solid rgba(255,255,255,.08)", scrollbarWidth: "thin" }}>
          {list.map((f, i) => {
            const on = i === idx;
            const img = fileKind(f.fileName || f.fileUrl) === "image";
            return (
              <Box key={f.fileUrl} data-on={on ? "1" : "0"} role="button" title={f.fileName} onClick={() => onNavigate?.(f)}
                sx={{ width: 56, height: 56, flexShrink: 0, borderRadius: 1.5, overflow: "hidden", cursor: "pointer", display: "grid", placeItems: "center",
                  bgcolor: "#1e293b", outline: on ? "2px solid #60a5fa" : "1px solid rgba(255,255,255,.12)", outlineOffset: on ? 1 : 0, opacity: on ? 1 : 0.65,
                  transition: "opacity .15s", "&:hover": { opacity: 1 } }}>
                {img ? <Box component="img" src={thumbUrl(f.fileUrl)} alt="" loading="lazy" sx={{ width: "100%", height: "100%", objectFit: "cover" }} /> : kindIcon(f.fileName, { fontSize: 26 })}
              </Box>
            );
          })}
        </Stack>
      )}
    </Dialog>
  );
}

/** ตัวช่วย state ของกล่องดูไฟล์ — open(url, name, list) · dialog = JSX ที่ต้องวางไว้ในหน้า */
export function useFileGallery() {
  const [st, setSt] = useState({ url: null, name: "", list: null });
  const open = useCallback((url, name, list) => setSt({ url, name: name || "", list: Array.isArray(list) ? list : null }), []);
  const close = useCallback(() => setSt({ url: null, name: "", list: null }), []);
  const dialog = (
    <FileGalleryDialog previewUrl={st.url} previewFileName={st.name} gallery={st.list}
      onNavigate={(f) => setSt((p) => ({ ...p, url: f.fileUrl, name: f.fileName || "" }))} onClose={close} />
  );
  return { open, close, dialog, previewUrl: st.url };
}
