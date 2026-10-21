/**
 * SitePhotos — "ไฟล์แนบ" ของงานช่าง (เดิมชื่อ "รูปและไฟล์หน้างาน" — 10 ต.ค. 2569 ผู้ใช้: "แก้ไขคำให้มืออาชีพ เช่น ไฟล์แนบ") (10 ต.ค. 2569 ผู้ใช้: "ให้ช่างอัปไฟล์หรือรูปภาพในงานได้แบบของเซล")
 *
 * ✅ ใช้ช่องเก็บเดียวกับรูปหน้างานของนัดเซล (Events.sitePhotoFiles · PUT /events/upload/:id type=sitePhoto)
 *   แยกจาก "เอกสารประจำงาน" (Service Report/ใบเสนอราคา/วางบิล/ส่งมอบ) — ตรงนี้คือรูปถ่ายหน้างาน/ไฟล์ประกอบทั่วไป
 *   ไม่บังคับ ไม่มีผลกับการขอปิดงาน
 * ✅ รูปแสดงเป็นตารางภาพย่อ · ไฟล์อื่น (PDF/Word/Excel) เป็นแถบชื่อไฟล์ · กดเพื่อเปิดดู
 * ✅ มือถือ: ปุ่มเพิ่มเปิดกล้อง/คลังภาพได้ · เลือกหลายไฟล์พร้อมกันได้ (ย่อรูปก่อนส่งที่ EventService.Upload)
 */
import { useEffect, useRef, useState } from "react";
import moment from "moment";
import Swal from "@/shared/ui/swal";
import { Box, Stack, Typography, Button, IconButton, CircularProgress } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { AddAPhotoOutlined, PhotoLibraryOutlined, Close, InsertDriveFileOutlined, PictureAsPdfOutlined } from "@mui/icons-material";
import EventService from "@/shared/services/EventService";
import { formatThai } from "@/shared/utils/thaiDate";
import { thumbUrl } from "@/shared/utils/cloudinaryImage";

const BLUE = "#2563eb";
const LINE = "#e2e8f0";
const MUTED = "#64748b";
const INK = "#0f172a";

const isImage = (f) => /^image\//.test(f?.fileType || "") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f?.fileName || "");

/**
 * @param onChange   เรียกหลังเพิ่ม/ลบสำเร็จ (ให้หน้าแม่รีเฟรชข้อมูล)
 * @param confirmFn  (ข้อความ) => Promise<boolean> — ใช้ในฟอร์ม SweetAlert (EditEvent) ที่เรียก Swal ซ้อนไม่ได้
 *                   (Swal เปิดได้ทีละกล่อง เรียกซ้อนแล้วฟอร์มที่กรอกอยู่จะถูกปิดทิ้ง)
 */
export default function SitePhotos({ event, canEdit = false, onPreview, onChange, confirmFn, sx }) {
  const [files, setFiles] = useState(event?.sitePhotoFiles || []);
  const [uploading, setUploading] = useState(0);
  const [err, setErr] = useState("");
  const inputRef = useRef(null);

  // ข้อมูลงานถูกโหลดใหม่ (เรียลไทม์/รีเฟรช) → ตามค่าล่าสุด
  useEffect(() => { setFiles(event?.sitePhotoFiles || []); }, [event?._id, event?.sitePhotoFiles]);

  if (!event) return null;
  if (!files.length && !canEdit) return null;

  // 🔁 (21 ต.ค. 2569) ส่งไฟล์ทั้งช่อง (รูปก่อน แล้วเอกสาร) ให้กล่องดูไฟล์เลื่อนดูต่อได้
  const open = (f) => (onPreview ? onPreview(f.fileUrl, f.fileName, [...files.filter(isImage), ...files.filter((x) => !isImage(x))]) : window.open(f.fileUrl, "_blank", "noopener"));

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
        onChange?.();
      } catch {
        failed += 1;
      }
      setUploading((n) => n - 1);
    }
    if (failed) setErr(`อัปโหลดไม่สำเร็จ ${failed} ไฟล์ — ลองใหม่อีกครั้ง`);
  };

  const remove = async (f) => {
    const question = `${isImage(f) ? "ลบรูปนี้?" : "ลบไฟล์นี้?"}\n${f.fileName}`;
    const ok = confirmFn
      ? await confirmFn(question)
      : (await Swal.fire({
        icon: "warning", title: isImage(f) ? "ลบรูปนี้?" : "ลบไฟล์นี้?", text: f.fileName,
        showCancelButton: true, confirmButtonText: "ลบ", cancelButtonText: "ยกเลิก", confirmButtonColor: "#dc2626", reverseButtons: true,
      })).isConfirmed;
    if (!ok) return;
    try {
      await EventService.DeleteFile(event._id, "sitePhoto", f._id);
      setFiles((prev) => prev.filter((x) => String(x._id) !== String(f._id)));
      onChange?.();
    } catch (e2) {
      setErr(e2?.response?.data?.message || e2?.response?.data || "ลบไม่สำเร็จ");
    }
  };

  const images = files.filter(isImage);
  // 🔁 (21 ต.ค. 2569 ผู้ใช้: "บอกด้วยว่าไฟล์แนบ แนบจากตอนไหน ให้ไม่งง") ที่มาของไฟล์ + วันเวลา ใต้ไฟล์ทุกไฟล์
  const originOf = (f) => (f.source === "intake" ? { t: "ตอนรับงาน", c: "#0891b2" }
    : f.source === "dispatch" ? { t: "จากใบแจ้งงาน", c: "#7c3aed" }
      : f.stage === "before" ? { t: "ตอนเข้างาน", c: "#16a34a" }
        : f.stage === "after" ? { t: "ตอนจบงาน", c: "#16a34a" }
          : { t: "แนบเพิ่ม", c: MUTED });
  const whenOf = (f) => (f.uploadedAt ? formatThai(moment(f.uploadedAt), "D MMM HH:mm") : "");
  const others = files.filter((f) => !isImage(f));

  return (
    <Box sx={{ mt: 1.5, p: 1.25, borderRadius: 2, border: `1px solid ${LINE}`, bgcolor: "#fff", ...sx }} onClick={(e) => e.stopPropagation()}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <PhotoLibraryOutlined sx={{ fontSize: 18, color: MUTED }} />
        <Typography sx={{ flex: 1, fontSize: "0.84rem", fontWeight: 800, color: INK }}>
          ไฟล์แนบ{files.length ? ` · ${files.length}` : ""}
        </Typography>
        {canEdit && (
          <Button size="small" disabled={Boolean(uploading)} onClick={() => inputRef.current?.click()}
            startIcon={uploading ? <CircularProgress size={14} /> : <AddAPhotoOutlined sx={{ fontSize: 17 }} />}
            sx={{ textTransform: "none", fontWeight: 800, color: BLUE, py: 0.2, borderRadius: 2 }}>
            {uploading ? `กำลังอัปโหลด ${uploading}` : "แนบไฟล์"}
          </Button>
        )}
        <input ref={inputRef} type="file" hidden multiple accept="image/*,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx" onChange={onPick} />
      </Stack>

      {!files.length ? (
        <Box component="button" type="button" onClick={() => inputRef.current?.click()} sx={{
          // ✅ (10 ต.ค. 2569 ผู้ใช้: "สีสันยังดูรกๆ ตัดกัน") ช่องว่างเป็นโทนเทา · ข้อความสั้นบรรทัดเดียว
          mt: 1, width: "100%", py: 1.75, px: 1.5, borderRadius: 2, border: "1.5px dashed #cbd5e1", bgcolor: "#f8fafc",
          color: MUTED, fontFamily: "inherit", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75,
          "&:hover": { borderColor: alpha(BLUE, 0.5), color: BLUE },
        }}>
          <AddAPhotoOutlined sx={{ fontSize: 19 }} /> ยังไม่มีไฟล์แนบ · แตะเพื่อถ่ายรูปหรือเลือกไฟล์
        </Box>
      ) : (
        <>
          {images.length > 0 && (
            <Box sx={{ mt: 1, display: "grid", gap: 1, gridTemplateColumns: "repeat(auto-fill, minmax(84px, 92px))" }}>
              {images.map((f) => (
                <Box key={f._id} sx={{ minWidth: 0 }}>
                <Box sx={{ position: "relative", pt: "100%", borderRadius: 1.5, overflow: "hidden", border: `1px solid ${LINE}`, bgcolor: "#f8fafc" }}>
                  <Box component="img" src={thumbUrl(f.fileUrl)} decoding="async" alt={f.fileName} loading="lazy" onClick={() => open(f)} title={`${f.fileName}${f.uploadedBy ? ` · ${f.uploadedBy}` : ""}${f.uploadedAt ? ` · ${formatThai(moment(f.uploadedAt), "D MMM HH:mm")}` : ""}`}
                    sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", cursor: "zoom-in" }} />
                  {canEdit && f.source !== "dispatch" && (
                    <IconButton size="small" aria-label="ลบรูป" onClick={() => remove(f)}
                      sx={{ position: "absolute", top: 3, right: 3, width: 24, height: 24, bgcolor: alpha("#0f172a", 0.55), color: "#fff", "&:hover": { bgcolor: "#dc2626" } }}>
                      <Close sx={{ fontSize: 15 }} />
                    </IconButton>
                  )}
                </Box>
                <Typography noWrap title={f.sourceLabel || originOf(f).t} sx={{ mt: 0.4, fontSize: "0.68rem", fontWeight: 800, color: originOf(f).c, lineHeight: 1.3 }}>{originOf(f).t}</Typography>
                {whenOf(f) && <Typography noWrap sx={{ fontSize: "0.64rem", color: MUTED, lineHeight: 1.3 }}>{whenOf(f)}</Typography>}
                </Box>
              ))}
            </Box>
          )}
          {others.length > 0 && (
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {others.map((f) => (
                <Stack key={f._id} direction="row" alignItems="center" spacing={1} sx={{ px: 1, py: 0.6, borderRadius: 1.5, border: `1px solid ${LINE}` }}>
                  {/\.pdf$/i.test(f.fileName || "") ? <PictureAsPdfOutlined sx={{ fontSize: 18, color: "#dc2626" }} /> : <InsertDriveFileOutlined sx={{ fontSize: 18, color: MUTED }} />}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap onClick={() => open(f)} sx={{ fontSize: "0.8rem", fontWeight: 600, color: BLUE, cursor: "pointer" }}>{f.fileName}</Typography>
                    <Typography noWrap sx={{ fontSize: "0.7rem", color: MUTED }}>
                      <Box component="span" sx={{ fontWeight: 800, color: originOf(f).c }}>{originOf(f).t}</Box>
                      {[whenOf(f), f.uploadedBy].filter(Boolean).map((x) => ` · ${x}`).join("")}
                    </Typography>
                  </Box>
                  {canEdit && f.source !== "dispatch" && <IconButton size="small" aria-label="ลบไฟล์" onClick={() => remove(f)}><Close sx={{ fontSize: 16 }} /></IconButton>}
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
