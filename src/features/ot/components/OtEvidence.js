/**
 * OtEvidence — หลักฐานการทำ OT (รูป/เอกสาร) · ไม่บังคับ
 *
 * ✅ (27 ต.ค. 2569 ผู้ใช้: "ให้แนบหลักฐานการทำ OT ด้วย" · "แต่ไม่บังคับ")
 *   EvidencePicker  — ในฟอร์มยื่น: เลือกไฟล์ไว้ก่อน ส่งใบแล้วค่อยอัปโหลด (POST /api/ot/:id/files)
 *   EvidenceGallery — ในหน้ารายละเอียด: ดู/เปิดไฟล์ · ผู้ยื่นแนบเพิ่มได้ · ลบได้ตอนใบยังแก้ได้
 */
import { useEffect, useRef } from "react";
import { Box, Stack, Typography, ButtonBase, IconButton, CircularProgress } from "@mui/material";
import { AttachFile, Close, InsertDriveFile } from "@mui/icons-material";
import { prepareUploadFile, ACCEPT_ALL } from "@/shared/utils/fileUpload";
import { TEXT_MAIN, TEXT_SUB, BORDER_MAIN } from "../otMeta";

export const MAX_EVIDENCE = 10;
const isImg = (type) => !type || String(type).startsWith("image/");

const Tile = ({ src, name, type, href, onRemove, size = 84 }) => (
  <Box sx={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
    <Box component={href ? "a" : "div"} href={href} target={href ? "_blank" : undefined} rel="noreferrer" title={name || ""}
      sx={{ display: "block", width: "100%", height: "100%", borderRadius: 2, overflow: "hidden", border: `1px solid ${BORDER_MAIN}`, bgcolor: "#f8fafc", textDecoration: "none" }}>
      {isImg(type) ? <Box component="img" src={src} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (
        <Stack alignItems="center" justifyContent="center" spacing={0.25} sx={{ width: "100%", height: "100%", px: 0.75 }}>
          <InsertDriveFile sx={{ fontSize: 28, color: "#dc2626" }} />
          <Typography noWrap sx={{ fontSize: "0.64rem", color: TEXT_SUB, maxWidth: "100%" }}>{name || "ไฟล์"}</Typography>
        </Stack>
      )}
    </Box>
    {onRemove && (
      <IconButton size="small" onClick={onRemove} aria-label="ลบไฟล์"
        sx={{ position: "absolute", top: 3, right: 3, width: 22, height: 22, bgcolor: "rgba(15,23,42,.6)", color: "#fff", "&:hover": { bgcolor: "rgba(15,23,42,.85)" } }}>
        <Close sx={{ fontSize: 14 }} />
      </IconButton>
    )}
  </Box>
);

const AddTile = ({ onPick, busy, size = 84, multiple = true }) => {
  const ref = useRef(null);
  return (
    <>
      <ButtonBase onClick={() => ref.current?.click()} disabled={busy}
        sx={{ width: size, height: size, borderRadius: 2, border: "2px dashed #d7dde5", flexDirection: "column", gap: 0.25, color: TEXT_SUB, fontFamily: "inherit", fontSize: "0.72rem", flexShrink: 0 }}>
        {busy ? <CircularProgress size={20} /> : <AttachFile sx={{ fontSize: 22, color: "#94a3b8" }} />}
        {busy ? "กำลังอัปโหลด" : "แนบไฟล์"}
      </ButtonBase>
      <input ref={ref} type="file" accept={ACCEPT_ALL} multiple={multiple} hidden
        onChange={(e) => { const f = [...(e.target.files || [])]; e.target.value = ""; if (f.length) onPick(f); }} />
    </>
  );
};

/** เตรียมไฟล์ (บีบอัดรูป · ตรวจชนิด/ขนาดตามกฎกลาง) → [{ file, preview, type, name }] */
export const prepareEvidence = async (files) => {
  const out = [];
  for (const f of files) {
    // eslint-disable-next-line no-await-in-loop -- บีบอัดทีละไฟล์
    const r = await prepareUploadFile(f);
    if (r.ok) out.push({ file: r.file, preview: URL.createObjectURL(r.file), type: r.file.type, name: r.file.name });
  }
  return out;
};

/** ฟอร์มยื่น — files: ไฟล์ใหม่ที่ยังไม่อัปโหลด · existing: ไฟล์ที่ใบมีอยู่แล้ว (แก้ใบเดิม) */
export function EvidencePicker({ files, onChange, existing = [] }) {
  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.preview)), [files]);
  const room = MAX_EVIDENCE - existing.length - files.length;
  return (
    <Box sx={{ mt: 1.5, p: 1.5, bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 3 }}>
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "flex-start", sm: "baseline" }} spacing={{ xs: 0, sm: 0.75 }} sx={{ mb: 1 }}>
        <Typography sx={{ fontWeight: 800, fontSize: "0.88rem", color: TEXT_MAIN }}>หลักฐานการทำ OT</Typography>
        <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>ไม่บังคับ · รูปหน้างาน/เอกสาร PDF · Word · Excel ไม่เกิน {MAX_EVIDENCE} ไฟล์</Typography>
      </Stack>
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
        {existing.map((a) => <Tile key={a._id} src={a.url} name={a.name} type={a.type} href={a.url} />)}
        {files.map((f, i) => <Tile key={f.preview} src={f.preview} name={f.name} type={f.type} onRemove={() => onChange(files.filter((_, j) => j !== i))} />)}
        {room > 0 && <AddTile onPick={async (picked) => onChange([...files, ...(await prepareEvidence(picked.slice(0, room)))])} />}
      </Stack>
    </Box>
  );
}

/** หน้ารายละเอียด — attachments จากใบ · canAdd/canRemove ตามสิทธิ์ */
export function EvidenceGallery({ attachments = [], canAdd, canRemove, busy, onAdd, onRemove }) {
  if (!attachments.length && !canAdd) return null;
  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
      {attachments.map((a) => (
        <Tile key={a._id} src={isImg(a.type) ? a.url.replace("/upload/", "/upload/c_fill,w_240,h_240,q_auto,f_auto/") : a.url}
          name={a.name} type={a.type} href={a.url} onRemove={canRemove ? () => onRemove(a) : undefined} />
      ))}
      {canAdd && attachments.length < MAX_EVIDENCE && <AddTile busy={busy} onPick={(f) => onAdd(f.slice(0, MAX_EVIDENCE - attachments.length))} />}
      {!attachments.length && !canAdd && <Typography sx={{ fontSize: "0.8rem", color: "#94a3b8" }}>ไม่มีไฟล์แนบ</Typography>}
    </Stack>
  );
}
