/**
 * SalesDocsSection — เอกสารแนบของนัดหมายฝ่ายขาย (ใบเสนอราคา/เอกสารอื่น) + รายละเอียดต่อไฟล์
 *
 * ✅ (18 พ.ย. 2569 ผู้ใช้: "ตารางงานของฝ่ายขาย เวลากดปิดงานไปแล้ว แต่ยังให้สามารถมาอัพไฟล์งานนั้นๆ
 *    พร้อมรายละเอียดได้ เพราะบางทีต้องมาอัพไฟล์ใบเสนอราคาย้อนหลังของงานที่ไปเพื่อติดตาม")
 *    • แนบได้ตลอด รวมหลังปิดงาน — เจ้าของนัด/ผู้รับผิดชอบ และแอดมิน/ผู้จัดการ (server ตรวจซ้ำ)
 *    • แต่ละไฟล์มีชนิด (ใบเสนอราคา · เอกสารอื่น) และรายละเอียด แก้ภายหลังได้
 *    • เก็บแยกจากรูปหน้างาน (salesDocFiles) — ไม่นับเป็นรูปหน้างานตอนกด "เข้าพบแล้ว"/"ปิดงาน"
 */
import { useMemo, useRef, useState } from "react";
import moment from "moment";
import {
  Alert, Box, Button, ButtonBase, CircularProgress, Dialog, IconButton, Stack, TextField, Tooltip, Typography, useMediaQuery,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  CloseRounded, DeleteOutlineRounded, EditRounded, NoteAddRounded, UploadFileRounded, DescriptionRounded,
} from "@mui/icons-material";
import Swal from "@/shared/ui/swal";
import EventService from "@/shared/services/EventService";
import FileKindThumb from "@/shared/ui/FileKindThumb";
import { useFileGallery } from "@/shared/ui/FileGalleryDialog";
import { ACCEPT_ALL } from "@/shared/utils/fileUpload";
import { formatThai } from "@/shared/utils/thaiDate";
import { INK, INK_2, MUTED, FAINT, LINE, SURFACE, ACCENT, PRIMARY_BTN_SX } from "@/shared/ui/PageKit";

const RED = "#dc2626";
export const SALES_DOC_TYPES = [
  { key: "quotation", label: "ใบเสนอราคา" },
  { key: "other", label: "เอกสารอื่น" },
];
const DOC_LABEL = Object.fromEntries(SALES_DOC_TYPES.map((t) => [t.key, t.label]));
const fmtDateTime = (d) => (d ? `${formatThai(moment(d), "D MMM YY HH:mm")} น.` : "");

/** ป้ายชนิดเอกสาร */
function DocPill({ type }) {
  const q = type === "quotation";
  return (
    <Box component="span" sx={{ flexShrink: 0, px: 0.8, py: 0.1, borderRadius: "6px", fontSize: "0.68rem", fontWeight: 800, whiteSpace: "nowrap",
      color: q ? ACCENT : "#475569", bgcolor: q ? alpha(ACCENT, 0.09) : "#f1f5f9" }}>
      {DOC_LABEL[type] || DOC_LABEL.other}
    </Box>
  );
}

/** กล่องแนบ/แก้รายละเอียด — mode "add" เลือกไฟล์ได้ · "edit" แก้ชนิด + รายละเอียดของไฟล์เดิม */
function DocEditor({ state, onClose, onSave, busy }) {
  const fullScreen = useMediaQuery("(max-width:600px)");
  const fileRef = useRef(null);
  const [docType, setDocType] = useState(state.file?.docType || "quotation");
  const [note, setNote] = useState(state.file?.note || "");
  const [picked, setPicked] = useState([]);
  const isAdd = state.mode === "add";
  const canSave = !busy && (isAdd ? picked.length > 0 : true);

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}
      PaperProps={{ sx: { borderRadius: fullScreen ? 0 : 3 } }}>
      <Stack direction="row" alignItems="center" sx={{ px: 2.25, py: 1.5, borderBottom: `1px solid ${LINE}` }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "1rem", fontWeight: 900, color: INK }}>{isAdd ? "แนบเอกสาร" : "แก้รายละเอียดเอกสาร"}</Typography>
          <Typography noWrap sx={{ fontSize: "0.76rem", color: MUTED }}>
            {isAdd ? "ใบเสนอราคาหรือเอกสารที่เกี่ยวกับนัดนี้ · แนบได้แม้ปิดงานแล้ว" : state.file?.fileName}
          </Typography>
        </Box>
        <IconButton onClick={onClose} disabled={busy} size="small" aria-label="ปิด"><CloseRounded /></IconButton>
      </Stack>

      <Box sx={{ p: 2.25, display: "flex", flexDirection: "column", gap: 2 }}>
        <Box>
          <Typography sx={{ mb: 0.75, fontSize: "0.78rem", fontWeight: 800, color: INK }}>ชนิดเอกสาร</Typography>
          <Stack direction="row" gap={0.75}>
            {SALES_DOC_TYPES.map((t) => {
              const on = docType === t.key;
              return (
                <ButtonBase key={t.key} onClick={() => setDocType(t.key)}
                  sx={{ px: 1.6, py: 0.7, borderRadius: 99, fontFamily: "inherit", fontSize: "0.82rem", fontWeight: 800,
                    color: on ? "#fff" : "#475569", bgcolor: on ? ACCENT : "#f1f5f9", transition: "all .15s ease" }}>
                  {t.label}
                </ButtonBase>
              );
            })}
          </Stack>
        </Box>

        {isAdd && (
          <Box>
            <Typography sx={{ mb: 0.75, fontSize: "0.78rem", fontWeight: 800, color: INK }}>ไฟล์</Typography>
            <input ref={fileRef} type="file" hidden multiple accept={ACCEPT_ALL}
              onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ""; setPicked((cur) => [...cur, ...fs]); }} />
            <Stack spacing={0.75}>
              {picked.map((f, i) => (
                <Stack key={`${f.name}-${i}`} direction="row" alignItems="center" spacing={1}
                  sx={{ px: 1, py: 0.75, borderRadius: 2, border: `1px solid ${LINE}`, bgcolor: "#fff" }}>
                  <FileKindThumb name={f.name} size={32} />
                  <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.84rem", fontWeight: 700, color: INK_2 }}>{f.name}</Typography>
                  <IconButton size="small" disabled={busy} onClick={() => setPicked((cur) => cur.filter((_, j) => j !== i))} aria-label="เอาไฟล์ออก">
                    <CloseRounded sx={{ fontSize: 17 }} />
                  </IconButton>
                </Stack>
              ))}
              <ButtonBase onClick={() => fileRef.current?.click()} disabled={busy}
                sx={{ py: picked.length ? 1 : 2.25, borderRadius: 2, border: "1.5px dashed #cbd5e1", bgcolor: SURFACE, fontFamily: "inherit",
                  flexDirection: "column", color: MUTED, "&:hover": { borderColor: ACCENT, bgcolor: "#f8fbff" } }}>
                <UploadFileRounded sx={{ fontSize: picked.length ? 20 : 28, color: FAINT }} />
                <Typography sx={{ mt: 0.4, fontSize: "0.82rem", fontWeight: 700, color: INK_2 }}>{picked.length ? "เพิ่มไฟล์อีก" : "แตะเพื่อเลือกไฟล์"}</Typography>
                {!picked.length && <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>PDF · Word · Excel · รูปภาพ · เลือกได้หลายไฟล์</Typography>}
              </ButtonBase>
            </Stack>
          </Box>
        )}

        <Box>
          <Typography sx={{ mb: 0.75, fontSize: "0.78rem", fontWeight: 800, color: INK }}>รายละเอียด</Typography>
          <TextField value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={4} maxRows={10} fullWidth
            inputProps={{ maxLength: 1000 }}
            placeholder="เช่น ใบเสนอราคาเลขที่ QT-6911-012 · ส่งลูกค้าทางอีเมล 20/11 · มูลค่า 85,000 บาท · ลูกค้าจะตอบกลับภายในสิ้นเดือน"
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5, fontSize: "0.9rem", lineHeight: 1.65, alignItems: "flex-start" } }} />
        </Box>
      </Box>

      <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ px: 2.25, py: 1.5, borderTop: `1px solid ${LINE}` }}>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: "none", fontWeight: 700, color: MUTED }}>ยกเลิก</Button>
        <Button variant="contained" disabled={!canSave} onClick={() => onSave({ docType, note, files: picked })}
          startIcon={busy ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : null} sx={{ ...PRIMARY_BTN_SX, px: 2.5 }}>
          {busy ? (typeof busy === "string" ? busy : "กำลังบันทึก…") : !isAdd ? "บันทึก" : picked.length ? `แนบ ${picked.length} ไฟล์` : "แนบไฟล์"}
        </Button>
      </Stack>
    </Dialog>
  );
}

/**
 * @param ev        นัดหมาย (ต้องมี _id · salesDocFiles)
 * @param canEdit   แนบ/แก้/ลบได้ไหม (เจ้าของนัด/แอดมิน · ไม่ขึ้นกับการปิดงาน)
 * @param closed    ปิดงานแล้ว — บอกผู้ใช้ว่ายังแนบได้
 * @param Section   หัวข้อกลุ่มของหน้ารายละเอียดนัด
 * @param onChanged โหลดนัดใหม่หลังเปลี่ยนแปลง
 */
export default function SalesDocsSection({ ev, canEdit, closed, Section, onChanged }) {
  const [editor, setEditor] = useState(null); // { mode: "add" } | { mode: "edit", file }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const gallery = useFileGallery();
  const files = useMemo(
    () => [...(ev?.salesDocFiles || [])].sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0)),
    [ev?.salesDocFiles],
  );
  const quotes = files.filter((f) => f.docType === "quotation").length;

  if (!canEdit && !files.length) return null;

  const save = async ({ docType, note, files: picked }) => {
    setErr("");
    if (editor.mode === "edit") {
      setBusy(true);
      try {
        await EventService.UpdateSalesDoc(ev._id, editor.file._id, { docType, note });
        setEditor(null);
        await onChanged?.();
      } catch (e) {
        setErr(e?.response?.data?.message || "บันทึกรายละเอียดไม่สำเร็จ");
      } finally {
        setBusy(false);
      }
      return;
    }
    let failed = 0;
    for (let i = 0; i < picked.length; i += 1) {
      setBusy(`กำลังแนบ ${i + 1}/${picked.length}`);
      try { await EventService.Upload(ev._id, picked[i], "salesDoc", { fields: { docType, note: note.trim() } }); }
      catch { failed += 1; }
    }
    setBusy(false);
    setEditor(null);
    if (failed) setErr(`แนบไม่สำเร็จ ${failed} ไฟล์ — ลองใหม่อีกครั้ง`);
    else Swal.fire({ toast: true, position: "top", icon: "success", showConfirmButton: false, timer: 1600, title: `แนบเอกสารแล้ว ${picked.length} ไฟล์` });
    await onChanged?.();
  };

  const remove = async (f) => {
    const ok = await Swal.fire({
      icon: "warning", title: "ลบเอกสารนี้?", text: f.fileName, showCancelButton: true, confirmButtonText: "ลบเอกสาร", cancelButtonText: "ยกเลิก",
      confirmButtonColor: RED, reverseButtons: true,
    });
    if (!ok.isConfirmed) return;
    try { await EventService.DeleteFile(ev._id, "salesDoc", f._id); await onChanged?.(); }
    catch (e) { setErr(e?.response?.data?.message || "ลบเอกสารไม่สำเร็จ"); }
  };

  const openFile = (f) => gallery.open(f.fileUrl, f.fileName, files.map((x) => ({ fileUrl: x.fileUrl, fileName: x.fileName })), files.indexOf(f));

  return (
    <Section icon={<DescriptionRounded />}
      title={`เอกสารแนบ${files.length ? ` · ${files.length} ไฟล์` : ""}${quotes ? ` · ใบเสนอราคา ${quotes}` : ""}`}
      hint={canEdit && closed ? "ปิดงานแล้วก็ยังแนบและแก้รายละเอียดได้ — เช่น ใบเสนอราคาที่ส่งลูกค้าตามหลัง" : null}
      right={canEdit ? (
        <Button size="small" startIcon={<NoteAddRounded sx={{ fontSize: 17 }} />} onClick={() => setEditor({ mode: "add" })}
          sx={{ textTransform: "none", fontWeight: 800, color: ACCENT, py: 0.2 }}>
          แนบไฟล์
        </Button>
      ) : null}>
      <Box sx={{ borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${LINE}`, overflow: "hidden" }}>
        {!files.length ? (
          <ButtonBase onClick={() => setEditor({ mode: "add" })}
            sx={{ width: "100%", py: 2.5, px: 2, flexDirection: "column", fontFamily: "inherit", "&:hover": { bgcolor: "#f8fbff" } }}>
            <UploadFileRounded sx={{ fontSize: 28, color: FAINT }} />
            <Typography sx={{ mt: 0.5, fontSize: "0.86rem", fontWeight: 700, color: INK_2 }}>ยังไม่มีเอกสาร · แตะเพื่อแนบใบเสนอราคาหรือเอกสารอื่น</Typography>
            <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>ใส่รายละเอียดกำกับแต่ละไฟล์ได้ เช่น เลขที่ใบเสนอราคา วันที่ส่ง</Typography>
          </ButtonBase>
        ) : files.map((f, i) => (
          <Stack key={f._id} direction="row" spacing={1.25} alignItems="flex-start"
            sx={{ px: 1.5, py: 1.25, borderTop: i ? `1px solid ${LINE}` : 0 }}>
            <ButtonBase onClick={() => openFile(f)} sx={{ borderRadius: 1.5, mt: 0.25 }} aria-label={`เปิด ${f.fileName}`}>
              <FileKindThumb name={f.fileName} url={f.fileUrl} size={44} />
            </ButtonBase>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
                <DocPill type={f.docType} />
                <Typography noWrap onClick={() => openFile(f)}
                  sx={{ flex: 1, minWidth: 0, fontSize: "0.86rem", fontWeight: 800, color: INK, cursor: "pointer", "&:hover": { color: ACCENT } }}>
                  {f.fileName}
                </Typography>
              </Stack>
              {f.note ? (
                <Typography sx={{ mt: 0.4, fontSize: "0.84rem", color: INK_2, lineHeight: 1.6, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{f.note}</Typography>
              ) : canEdit ? (
                <ButtonBase onClick={() => setEditor({ mode: "edit", file: f })}
                  sx={{ mt: 0.3, fontFamily: "inherit", fontSize: "0.78rem", fontWeight: 700, color: ACCENT }}>+ เพิ่มรายละเอียด</ButtonBase>
              ) : null}
              <Typography sx={{ mt: 0.4, fontSize: "0.72rem", color: FAINT }}>
                {[f.uploadedBy ? `แนบโดย ${f.uploadedBy}` : "", fmtDateTime(f.uploadedAt),
                  f.noteUpdatedAt ? `แก้รายละเอียด ${fmtDateTime(f.noteUpdatedAt)}${f.noteUpdatedBy ? ` โดย ${f.noteUpdatedBy}` : ""}` : ""]
                  .filter(Boolean).join(" · ")}
              </Typography>
            </Box>
            {canEdit && (
              <Stack direction="row" sx={{ flexShrink: 0, mr: -0.5 }}>
                <Tooltip title="แก้รายละเอียด">
                  <IconButton size="small" onClick={() => setEditor({ mode: "edit", file: f })} aria-label="แก้รายละเอียด"><EditRounded sx={{ fontSize: 18 }} /></IconButton>
                </Tooltip>
                <Tooltip title="ลบเอกสาร">
                  <IconButton size="small" onClick={() => remove(f)} aria-label="ลบเอกสาร" sx={{ "&:hover": { color: RED } }}><DeleteOutlineRounded sx={{ fontSize: 18 }} /></IconButton>
                </Tooltip>
              </Stack>
            )}
          </Stack>
        ))}
      </Box>
      {err && <Alert severity="error" sx={{ mt: 1, borderRadius: 2 }} onClose={() => setErr("")}>{err}</Alert>}
      {editor && <DocEditor key={editor.file?._id || "add"} state={editor} busy={busy} onClose={() => setEditor(null)} onSave={save} />}
      {gallery.dialog}
    </Section>
  );
}
