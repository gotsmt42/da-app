/**
 * SitePhotos — "รูปและไฟล์หน้างาน" ของงานช่าง (10 ต.ค. 2569 ผู้ใช้: "ให้ช่างอัปไฟล์หรือรูปภาพในงานได้แบบของเซล")
 *
 * ✅ ใช้ช่องเก็บเดียวกับรูปหน้างานของนัดเซล (Events.sitePhotoFiles · PUT /events/upload/:id type=sitePhoto)
 *   แยกจาก "เอกสารประจำงาน" (Service Report/ใบเสนอราคา/วางบิล/ส่งมอบ) — ตรงนี้คือรูปถ่ายหน้างาน/ไฟล์ประกอบทั่วไป
 *   ไม่บังคับ ไม่มีผลกับการขอปิดงาน
 * ✅ รูปแสดงเป็นตารางภาพย่อ · ไฟล์อื่น (PDF/Word/Excel) เป็นแถบชื่อไฟล์ · กดเพื่อเปิดดู
 * ✅ มือถือ: ปุ่มเพิ่มเปิดกล้อง/คลังภาพได้ · เลือกหลายไฟล์พร้อมกันได้ (ย่อรูปก่อนส่งที่ EventService.Upload)
 */
import { useEffect, useRef, useState } from "react";
import moment from "moment";
import Swal from "sweetalert2";
import { Box, Stack, Typography, Button, IconButton, CircularProgress } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { AddAPhotoOutlined, PhotoLibraryOutlined, Close, InsertDriveFileOutlined, PictureAsPdfOutlined } from "@mui/icons-material";
import EventService from "@/shared/services/EventService";
import { formatThai } from "@/shared/utils/thaiDate";

const BLUE = "#2563eb";
const LINE = "#e2e8f0";
const MUTED = "#64748b";
const INK = "#0f172a";

const isImage = (f) => /^image\//.test(f?.fileType || "") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f?.fileName || "");

export default function SitePhotos({ event, canEdit = false, onPreview, sx }) {
  const [files, setFiles] = useState(event?.sitePhotoFiles || []);
  const [uploading, setUploading] = useState(0);
  const [err, setErr] = useState("");
  const inputRef = useRef(null);

  // ข้อมูลงานถูกโหลดใหม่ (เรียลไทม์/รีเฟรช) → ตามค่าล่าสุด
  useEffect(() => { setFiles(event?.sitePhotoFiles || []); }, [event?._id, event?.sitePhotoFiles]);

  if (!event) return null;
  if (!files.length && !canEdit) return null;

  const open = (f) => (onPreview ? onPreview(f.fileUrl, f.fileName) : window.open(f.fileUrl, "_blank", "noopener"));

  const onPick = async (e) => {
    const picked = [...(e.target.files || [])];
    e.target.value = "";
    if (!picked.length) return;
    setErr("");
    setUploading(picked.length);
    let failed = 0;
    for (const f of picked) {
      try {
        const saved = await EventService.Upload(event._id, f, "sitePhoto");
        setFiles((prev) => [...prev, { _id: saved.fileId, fileName: saved.fileName, fileUrl: saved.fileUrl, fileType: saved.fileType, uploadedAt: new Date().toISOString() }]);
      } catch {
        failed += 1;
      }
      setUploading((n) => n - 1);
    }
    if (failed) setErr(`อัปโหลดไม่สำเร็จ ${failed} ไฟล์ — ลองใหม่อีกครั้ง`);
  };

  const remove = async (f) => {
    const ok = await Swal.fire({
      icon: "warning", title: isImage(f) ? "ลบรูปนี้?" : "ลบไฟล์นี้?", text: f.fileName,
      showCancelButton: true, confirmButtonText: "ลบ", cancelButtonText: "ยกเลิก", confirmButtonColor: "#dc2626", reverseButtons: true,
    });
    if (!ok.isConfirmed) return;
    try {
      await EventService.DeleteFile(event._id, "sitePhoto", f._id);
      setFiles((prev) => prev.filter((x) => String(x._id) !== String(f._id)));
    } catch (e2) {
      setErr(e2?.response?.data?.message || e2?.response?.data || "ลบไม่สำเร็จ");
    }
  };

  const images = files.filter(isImage);
  const others = files.filter((f) => !isImage(f));

  return (
    <Box sx={{ mt: 1.5, p: 1.25, borderRadius: 2, border: `1px solid ${LINE}`, bgcolor: "#fff", ...sx }} onClick={(e) => e.stopPropagation()}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <PhotoLibraryOutlined sx={{ fontSize: 18, color: BLUE }} />
        <Typography sx={{ flex: 1, fontSize: "0.84rem", fontWeight: 800, color: INK }}>
          รูปและไฟล์หน้างาน{files.length ? ` · ${files.length}` : ""}
        </Typography>
        {canEdit && (
          <Button size="small" disabled={Boolean(uploading)} onClick={() => inputRef.current?.click()}
            startIcon={uploading ? <CircularProgress size={14} /> : <AddAPhotoOutlined sx={{ fontSize: 17 }} />}
            sx={{ textTransform: "none", fontWeight: 800, color: BLUE, py: 0.2, borderRadius: 2 }}>
            {uploading ? `กำลังอัปโหลด ${uploading}` : "เพิ่มรูป/ไฟล์"}
          </Button>
        )}
        <input ref={inputRef} type="file" hidden multiple accept="image/*,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx" onChange={onPick} />
      </Stack>

      {!files.length ? (
        <Box component="button" type="button" onClick={() => inputRef.current?.click()} sx={{
          mt: 1, width: "100%", py: 2, borderRadius: 2, border: `1.5px dashed ${alpha(BLUE, 0.35)}`, bgcolor: alpha(BLUE, 0.03),
          color: BLUE, fontFamily: "inherit", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75,
        }}>
          <AddAPhotoOutlined sx={{ fontSize: 20 }} /> ถ่ายรูป/เลือกไฟล์หน้างาน (ก่อน-หลังทำงาน · จุดที่พบปัญหา)
        </Box>
      ) : (
        <>
          {images.length > 0 && (
            <Box sx={{ mt: 1, display: "grid", gap: 0.75, gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))" }}>
              {images.map((f) => (
                <Box key={f._id} sx={{ position: "relative", pt: "100%", borderRadius: 1.5, overflow: "hidden", border: `1px solid ${LINE}`, bgcolor: "#f8fafc" }}>
                  <Box component="img" src={f.fileUrl} alt={f.fileName} loading="lazy" onClick={() => open(f)} title={`${f.fileName}${f.uploadedBy ? ` · ${f.uploadedBy}` : ""}${f.uploadedAt ? ` · ${formatThai(moment(f.uploadedAt), "D MMM HH:mm")}` : ""}`}
                    sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", cursor: "zoom-in" }} />
                  {canEdit && (
                    <IconButton size="small" aria-label="ลบรูป" onClick={() => remove(f)}
                      sx={{ position: "absolute", top: 3, right: 3, width: 24, height: 24, bgcolor: alpha("#0f172a", 0.55), color: "#fff", "&:hover": { bgcolor: "#dc2626" } }}>
                      <Close sx={{ fontSize: 15 }} />
                    </IconButton>
                  )}
                </Box>
              ))}
            </Box>
          )}
          {others.length > 0 && (
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {others.map((f) => (
                <Stack key={f._id} direction="row" alignItems="center" spacing={1} sx={{ px: 1, py: 0.6, borderRadius: 1.5, border: `1px solid ${LINE}` }}>
                  {/\.pdf$/i.test(f.fileName || "") ? <PictureAsPdfOutlined sx={{ fontSize: 18, color: "#dc2626" }} /> : <InsertDriveFileOutlined sx={{ fontSize: 18, color: MUTED }} />}
                  <Typography noWrap onClick={() => open(f)} sx={{ flex: 1, minWidth: 0, fontSize: "0.8rem", fontWeight: 600, color: BLUE, cursor: "pointer" }}>{f.fileName}</Typography>
                  {canEdit && <IconButton size="small" aria-label="ลบไฟล์" onClick={() => remove(f)}><Close sx={{ fontSize: 16 }} /></IconButton>}
                </Stack>
              ))}
            </Stack>
          )}
        </>
      )}
      {err && <Typography sx={{ mt: 0.75, fontSize: "0.74rem", color: "#dc2626", fontWeight: 700 }}>{err}</Typography>}
    </Box>
  );
}
