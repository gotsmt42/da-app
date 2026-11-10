/**
 * AttachmentList — โมดูลจัดการไฟล์/รูปภาพชุดเดียวทั้งแอป
 * ✅ (10 พ.ย. 2569 ผู้ใช้: "ทำเป็น Module การจัดการไฟล์ และรูปภาพ ให้ใช้เป็นรูปแบบเดียวกันทั้งแอพ ไม่ใช่สะเปะสะปะ")
 *
 * หน้าตา (แบบเดียวกันทุกที่):
 *   แถวไฟล์ = ภาพย่อ/ป้ายชนิด (FileKindThumb) · ชื่อไฟล์ · บรรทัดรอง (ป้ายที่มา · วันเวลา) · ปุ่มลบ (ถ้าอนุญาต)
 *   แตะแถว = เปิดกล่องดูไฟล์ (FileGalleryDialog) เลื่อนดูไฟล์อื่นในรายการได้ — จำ "ลำดับ" ไม่ใช่ลิงก์ (ไฟล์ซ้ำชื่อก็เลื่อนได้)
 *   ปุ่มแนบอยู่ท้ายรายการ แบ่งเท่ากัน
 *
 * การอัปโหลด (โหลดเบื้องหลัง ไม่กระพริบ):
 *   เลือกไฟล์ → ขึ้นแถว "กำลังอัปโหลด" ทันที (รูปในเครื่อง + วงหมุน + %) → อัปโหลดทีละไฟล์
 *   → รอรายการจริงจากเซิร์ฟเวอร์ (onUploaded) แล้วค่อยเอาแถวชั่วคราวออก — ไม่มีช่วงที่ไฟล์หายแล้วโผล่ใหม่
 *
 * @param files      [{ fileUrl, fileName, uploadedAt?, tag?, tagColor?, ...ข้อมูลอื่นส่งกลับใน onDelete }]
 * @param actions    ปุ่มแนบ [{ key, label, icon? }] — ไม่ส่ง/readOnly = ไม่มีปุ่ม
 * @param upload     async (file, actionKey, onProgress(0–1)) => void — อัปโหลด 1 ไฟล์ (โยน error = ไม่สำเร็จ)
 * @param onUploaded async () => void — โหลดรายการใหม่หลังอัปโหลดครบ (รอให้เสร็จก่อนเอาแถวชั่วคราวออก)
 * @param onDelete   async (file) => void — มี = แสดงปุ่มลบ (ถามยืนยันก่อน)
 * @param title      หัวรายการ (ไม่ส่ง = ไม่มีหัว) · emptyText = ข้อความเมื่อไม่มีไฟล์ (null = ไม่แสดง)
 * @param accept     ชนิดไฟล์ที่เลือกได้
 * @param onOpen     (file, index, list) => void — เปิดดูด้วยกล่องของหน้าเอง (ไม่ส่ง = ใช้กล่องดูไฟล์ในตัว)
 * @param onRowMenu  (anchorEl, file) => void — มี = ปุ่ม "⋮" ท้ายแถว (ดาวน์โหลด/พิมพ์/แชร์/ลบ ของหน้านั้น) แทนปุ่มลบ
 * @param uploading  { progress: 0–100, sizeText } — หน้าที่อัปโหลดเอง (ไม่ผ่าน upload) แสดงแถว "กำลังอัปโหลด" แบบเดียวกัน
 * ไฟล์: tag = ข้อความ หรือ { text, color, old } (old = ฉบับเดิม แสดงจางพร้อม 🔒) · uploadedBy แสดงในบรรทัดรอง
 */
import { useEffect, useRef, useState } from "react";
import { Box, Button, IconButton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ChevronRightRounded, CloseRounded, AttachFileRounded, MoreVertRounded } from "@mui/icons-material";
import moment from "moment";
import Swal from "@/shared/ui/swal";
import FileKindThumb from "@/shared/ui/FileKindThumb";
import { useFileGallery } from "@/shared/ui/FileGalleryDialog";
import { formatThai } from "@/shared/utils/thaiDate";
import { fileKindOf, fileSizeText } from "@/shared/utils/fileKind";

const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e6e9ef";
const ACCENT = "#2563eb";
const DEFAULT_ACCEPT = "image/*,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx";
let seq = 0;

export default function AttachmentList({
  files = [], actions, upload, onUploaded, onDelete, readOnly = false,
  title, emptyText = "ยังไม่มีไฟล์แนบ", accept = DEFAULT_ACCEPT, thumbSize = 40, sx,
  onOpen, onRowMenu, uploading = null, confirmDelete = true,
}) {
  const gal = useFileGallery();
  const inputRef = useRef(null);
  const pickKey = useRef(null);
  const [pending, setPending] = useState([]); // { id, name, size, localUrl, progress, failed }
  const [deleting, setDeleting] = useState(null);
  const canAdd = !readOnly && upload && actions?.length;
  const busy = pending.some((p) => !p.failed);

  // คืนหน่วยความจำรูปในเครื่องเมื่อปิด
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  useEffect(() => () => pendingRef.current.forEach((p) => p.localUrl && URL.revokeObjectURL(p.localUrl)), []);

  const items = files.filter((f) => f?.fileUrl);

  const pick = (key) => { pickKey.current = key; setTimeout(() => inputRef.current?.click(), 0); };
  const onPick = async (e) => {
    const picked = [...(e.target.files || [])];
    e.target.value = "";
    if (!picked.length || !upload) return;
    const rows = picked.map((f) => ({
      id: `u${++seq}`, file: f, name: f.name, size: f.size, progress: 0, failed: false,
      localUrl: fileKindOf(f.name).isImage ? (() => { try { return URL.createObjectURL(f); } catch { return ""; } })() : "",
    }));
    setPending((p) => [...p, ...rows]);
    let failed = 0;
    for (const r of rows) {
      try {
        // eslint-disable-next-line no-await-in-loop -- อัปโหลดทีละไฟล์ (เน็ตมือถือ · ไม่แย่งกัน)
        await upload(r.file, pickKey.current, (pr) => setPending((p) => p.map((x) => (x.id === r.id ? { ...x, progress: pr } : x))));
        setPending((p) => p.map((x) => (x.id === r.id ? { ...x, progress: 1 } : x)));
      } catch {
        failed += 1;
        setPending((p) => p.map((x) => (x.id === r.id ? { ...x, failed: true } : x)));
      }
    }
    try { await onUploaded?.(); } catch { /* โหลดรายการใหม่ไม่ได้ — realtime จะตามมา */ }
    // เอาแถวที่สำเร็จออก (ตอนนี้รายการจริงมีไฟล์นั้นแล้ว) · แถวที่ล้มค้างไว้ให้เห็น/กดเอาออก
    setPending((p) => {
      p.filter((x) => rows.some((r) => r.id === x.id) && !x.failed).forEach((x) => x.localUrl && URL.revokeObjectURL(x.localUrl));
      return p.filter((x) => !(rows.some((r) => r.id === x.id) && !x.failed));
    });
    if (failed) Swal.fire({ icon: "warning", title: "อัปโหลดไม่ครบ", text: `ไม่สำเร็จ ${failed} ไฟล์ — ลองแนบใหม่อีกครั้ง` });
  };

  const remove = async (f) => {
    // confirmDelete=false = หน้านั้นถามยืนยันเองแล้ว (ไม่ถามซ้ำ 2 รอบ)
    const r = !confirmDelete ? { isConfirmed: true } : await Swal.fire({
      icon: "warning", title: "ลบไฟล์นี้?", text: f.fileName || "ไฟล์",
      showCancelButton: true, confirmButtonText: "ลบไฟล์", cancelButtonText: "ไม่ลบ", confirmButtonColor: "#dc2626", reverseButtons: true,
    });
    if (!r.isConfirmed) return;
    setDeleting(f.fileUrl + (f._id || ""));
    try { await onDelete(f); } catch { Swal.fire({ icon: "error", title: "ลบไฟล์ไม่สำเร็จ", text: "ลองใหม่อีกครั้ง" }); }
    setDeleting(null);
  };

  const row = { py: 0.85, minWidth: 0 };
  const ext = uploading ? [{ id: "ext", name: uploading.sizeText ? `ไฟล์ขนาด ${uploading.sizeText}` : "ไฟล์", progress: (Number(uploading.progress) || 0) / 100, failed: false, localUrl: "" }] : [];
  const rowsPending = [...pending, ...ext];
  const count = items.length + rowsPending.length;

  return (
    <Box sx={sx}>
      {title && (
        <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: INK }}>
          {title}{count ? <Box component="span" sx={{ color: MUTED, fontWeight: 600 }}> · {count} ไฟล์</Box> : ""}
        </Typography>
      )}
      {canAdd && <input ref={inputRef} type="file" hidden multiple accept={accept} onChange={onPick} />}
      {count > 0 ? (
        <Box sx={{ mt: title ? 0.5 : 0 }}>
          {items.map((f, i) => {
            const delKey = f.fileUrl + (f._id || "");
            const tag = f.tag && typeof f.tag === "object" ? f.tag : f.tag ? { text: f.tag, color: f.tagColor } : null;
            const sub = [f.uploadedBy, f.uploadedAt ? formatThai(moment(f.uploadedAt), "D MMM HH:mm") : ""].filter(Boolean).join(" · ");
            return (
              <Stack key={`${f._id || f.fileUrl}-${i}`} direction="row" alignItems="center" gap={1.25}
                onClick={() => (onOpen ? onOpen(f, i, items) : gal.open(f.fileUrl, f.fileName, items, i))}
                sx={{ ...row, cursor: "pointer", borderTop: i ? `1px solid ${LINE}` : 0, opacity: deleting === delKey ? 0.45 : tag?.old ? 0.72 : 1, "&:hover .fn": { color: ACCENT } }}>
                <FileKindThumb name={f.fileName} url={f.fileUrl} size={thumbSize} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography className="fn" noWrap title={f.fileName} sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK, lineHeight: 1.35 }}>{f.fileName || "ไฟล์"}</Typography>
                  {(tag || sub) && (
                    <Typography noWrap sx={{ fontSize: "0.72rem", color: MUTED, lineHeight: 1.35 }}>
                      {tag && <Box component="span" sx={{ color: tag.color || MUTED, fontWeight: 700 }}>{tag.old ? "🔒 " : ""}{tag.text}</Box>}
                      {tag && sub ? " · " : ""}{sub}
                    </Typography>
                  )}
                </Box>
                {onRowMenu ? (
                  <IconButton size="small" aria-label="ดาวน์โหลด/พิมพ์/แชร์/ลบ" onClick={(e) => { e.stopPropagation(); onRowMenu(e.currentTarget, f); }}
                    sx={{ flexShrink: 0, color: "#94a3b8" }}>
                    <MoreVertRounded sx={{ fontSize: 19 }} />
                  </IconButton>
                ) : onDelete && !readOnly ? (
                  <IconButton size="small" aria-label="ลบไฟล์" disabled={deleting === delKey}
                    onClick={(e) => { e.stopPropagation(); remove(f); }}
                    sx={{ flexShrink: 0, color: "#94a3b8", "&:hover": { color: "#dc2626", bgcolor: "#fef2f2" } }}>
                    <CloseRounded sx={{ fontSize: 18 }} />
                  </IconButton>
                ) : <ChevronRightRounded sx={{ fontSize: 20, color: "#cbd5e1", flexShrink: 0 }} />}
              </Stack>
            );
          })}
          {rowsPending.map((p, i) => (
            <Stack key={p.id} direction="row" alignItems="center" gap={1.25} sx={{ ...row, borderTop: items.length || i ? `1px solid ${LINE}` : 0 }}>
              <FileKindThumb name={p.name} localUrl={p.localUrl} busy={!p.failed} size={thumbSize} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: "0.84rem", fontWeight: 700, color: p.failed ? "#94a3b8" : INK, lineHeight: 1.35 }}>{p.name}</Typography>
                <Typography noWrap sx={{ fontSize: "0.72rem", lineHeight: 1.35, color: p.failed ? "#dc2626" : ACCENT, fontWeight: 700 }}>
                  {p.failed ? "อัปโหลดไม่สำเร็จ" : p.progress >= 1 ? "กำลังบันทึก…" : `กำลังอัปโหลด${p.progress > 0 ? ` ${Math.round(p.progress * 100)}%` : "…"}`}
                  {!p.failed && fileSizeText(p.size) ? <Box component="span" sx={{ color: MUTED, fontWeight: 500 }}> · {fileSizeText(p.size)}</Box> : null}
                </Typography>
                {!p.failed && (
                  <Box sx={{ mt: 0.4, height: 3, borderRadius: 99, bgcolor: alpha(ACCENT, 0.12), overflow: "hidden" }}>
                    <Box sx={{ height: "100%", width: `${Math.max(6, Math.round((p.progress || 0) * 100))}%`, bgcolor: ACCENT, transition: "width .2s" }} />
                  </Box>
                )}
              </Box>
              {p.failed && (
                <IconButton size="small" aria-label="เอาออก" onClick={() => setPending((x) => { if (p.localUrl) URL.revokeObjectURL(p.localUrl); return x.filter((y) => y.id !== p.id); })}
                  sx={{ flexShrink: 0, color: "#94a3b8" }}>
                  <CloseRounded sx={{ fontSize: 18 }} />
                </IconButton>
              )}
            </Stack>
          ))}
        </Box>
      ) : emptyText ? <Typography sx={{ mt: title ? 0.5 : 0, fontSize: "0.78rem", color: "#94a3b8" }}>{emptyText}</Typography> : null}
      {canAdd && (
        <Box sx={{ mt: 1, display: "grid", gridTemplateColumns: `repeat(${Math.min(actions.length, 3)}, minmax(0, 1fr))`, gap: 0.75 }}>
          {actions.map((a) => {
            const Icon = a.icon || AttachFileRounded;
            return (
              <Button key={a.key} size="small" disabled={busy} onClick={() => pick(a.key)} startIcon={<Icon sx={{ fontSize: "17px !important" }} />}
                sx={{ height: 40, borderRadius: 2, textTransform: "none", fontWeight: 800, fontSize: "0.82rem", whiteSpace: "nowrap",
                  color: ACCENT, border: `1px dashed ${alpha(ACCENT, 0.45)}`, bgcolor: alpha(ACCENT, 0.03), "&:hover": { bgcolor: alpha(ACCENT, 0.07) },
                  "& .MuiButton-startIcon": { mr: 0.6 } }}>
                {a.label}
              </Button>
            );
          })}
        </Box>
      )}
      {gal.dialog}
    </Box>
  );
}
