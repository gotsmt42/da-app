/**
 * JobDocsDialog.js — เอกสารทั้งหมดของ "ครั้งที่ N" 1 ครั้ง (Service Report / ใบเสนอราคา /
 * ใบวางบิล / ใบส่งมอบงาน) ดูได้จากหน้าภาพรวมงานโดยไม่ต้องข้ามไปหน้าการดำเนินงาน
 *
 * ⚠️ ดูอย่างเดียว ไม่มีอัปโหลด/ลบ — การจัดการไฟล์ยังเป็นของหน้า "การดำเนินงาน" ที่เดียวเหมือนเดิม
 * (ช่างทำงานที่นั่น มีทั้งแถบความคืบหน้าอัปโหลด สิทธิ์ และการยืนยันลบครบอยู่แล้ว) หน้านี้ยกมาแค่
 * "เปิดดู" ซึ่งเป็นสิ่งที่คนดูภาพรวมงานต้องการจริงๆ — เอาการอัปโหลดมาด้วยจะกลายเป็นของ 2 ที่ที่ต้อง
 * ดูแลพร้อมกันโดยไม่ได้ประโยชน์เพิ่ม
 */
import { useRef, useState } from "react";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import {
  Box, Stack, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Chip, useMediaQuery, TextField, MenuItem, LinearProgress, Alert,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { InsertDriveFile, FolderOpen, AttachFile } from "@mui/icons-material";
import { roundDocs, isImageFile, JOB_DOC_TYPES } from "@/shared/utils/jobDocTypes";
import EventService from "@/shared/services/EventService";
import { formatEventDateRange } from "@/shared/utils/formatDateRange";
import FilePreviewDialog from "./FilePreviewDialog";
import { formatThai } from "@/shared/utils/thaiDate";

const TEXT_SUB = "#64748b";

/**
 * @param {Array}  props.roundVisits  งานทุก document ของครั้งนี้ (null/ว่าง = ปิดกล่อง)
 * @param {string} props.title        หัวข้อกล่อง เช่น "ครั้งที่ 2 · บริษัท ก"
 */
export default function JobDocsDialog({ roundVisits, title, onClose, canUpload = false, onUploaded }) {
  const isMobile = useMediaQuery("(max-width:900px)");
  const [preview, setPreview] = useState(null);
  const [uploadType, setUploadType] = useState(JOB_DOC_TYPES[0].key);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);

  // ⚠️ hooks ต้องถูกเรียกครบทุกรอบก่อน return null เสมอ (กฎของ React) — เช็คว่างทีหลัง
  const visits = roundVisits || [];

  const handlePick = async (e) => {
    const file = e.target.files?.[0];
    // ⚠️ ล้างค่า input ทันที — ไม่งั้นเลือกไฟล์ "ชื่อเดิม" ซ้ำครั้งที่ 2 จะไม่เกิด onChange อีกเลย
    // (เบราว์เซอร์มองว่าค่าไม่เปลี่ยน) ผู้ใช้จะเจออาการ "กดแล้วไม่มีอะไรเกิดขึ้น" แบบหาสาเหตุไม่เจอ
    e.target.value = "";
    if (!file) return;

    // ⚠️ 1 ครั้งมีได้หลาย document (เข้างานหลายวันไม่ต่อเนื่อง) — แนบไปที่วันแรกของครั้งนั้นเสมอ
    // เพราะหน้าจอทุกที่รวมไฟล์ของทั้งครั้งมาแสดงเป็นชุดเดียวอยู่แล้ว (ดู roundDocs) ผู้ใช้จึงไม่ต้อง
    // เลือกว่าจะแนบไปวันไหน ซึ่งเป็นคำถามที่ตอบไม่ได้อยู่ดีสำหรับเอกสารระดับ "ครั้ง" อย่างใบวางบิล
    const target = visits[0];
    if (!target?._id) { setUploadError("ไม่พบงานที่จะแนบไฟล์"); return; }

    setUploading(true);
    setProgress(0);
    setUploadError("");
    try {
      await EventService.Upload(target._id, file, uploadType, {
        onUploadProgress: (evt) => {
          if (evt.total) setProgress(Math.round((evt.loaded * 100) / evt.total));
        },
      });
      // ✅ ให้หน้าที่เปิดกล่องนี้ดึงข้อมูลใหม่ — ไฟล์ที่เพิ่งแนบต้องโผล่ในกล่องทันทีโดยไม่ต้องปิดเปิดใหม่
      await onUploaded?.();
    } catch (err) {
      setUploadError(
        err?.response?.data?.error || err?.response?.data || err?.message || "อัปโหลดไม่สำเร็จ"
      );
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  if (visits.length === 0) return null;
  const groups = roundDocs(roundVisits);
  // ⚠️ ครั้งที่มีหลายวัน ต้องบอกได้ว่าไฟล์มาจากการเข้างานวันไหน — ครั้งที่มีวันเดียวไม่ต้องบอก
  // (ข้อความซ้ำใต้ทุกไฟล์โดยไม่ให้ข้อมูลอะไรเพิ่ม = เสียงรบกวน)
  const multiVisit = roundVisits.length > 1;

  return (
    <>
      <Dialog open onClose={onClose} fullWidth maxWidth="sm" fullScreen={isMobile}>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: "1rem" }} noWrap>เอกสารของงาน</Typography>
          <Typography variant="caption" sx={{ color: TEXT_SUB }}>{title}</Typography>
        </DialogTitle>

        <DialogContent dividers>
          {/* ── แนบไฟล์ (แอดมิน/manager) ────────────────────────────────────────
              ✅ อยู่บนสุดของกล่อง ไม่ใช่ล่างสุด — คนที่เปิดกล่องนี้เพื่อ "แนบ" จะเจอทันทีโดยไม่ต้อง
              เลื่อนผ่านไฟล์ที่มีอยู่ทั้งหมดก่อน (งานที่มีเอกสาร 9 ไฟล์เกิดขึ้นจริง) */}
          {canUpload && (
            <Box sx={{ mb: groups.length > 0 ? 2.5 : 0, p: 1.5, borderRadius: 2, bgcolor: alpha("#0f172a", 0.03), border: "1px dashed", borderColor: "divider" }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} alignItems={{ sm: "center" }}>
                <TextField
                  select size="small" label="ชนิดเอกสาร" value={uploadType}
                  onChange={(e) => setUploadType(e.target.value)}
                  disabled={uploading}
                  sx={{ minWidth: 190 }}
                >
                  {JOB_DOC_TYPES.map((t) => (
                    <MenuItem key={t.key} value={t.key}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <t.Icon sx={{ fontSize: 17, color: t.color }} />
                        <span>{t.label}</span>
                      </Stack>
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  variant="outlined" size="small" startIcon={<AttachFile sx={{ fontSize: 17 }} />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, flexShrink: 0 }}
                >
                  {uploading ? `กำลังอัปโหลด ${progress}%` : "เลือกไฟล์แนบ"}
                </Button>
                {/* ⚠️ จำกัดชนิดไฟล์ให้ตรงกับที่ server รับจริง (ดู allowedTypes ใน PUT /events/upload/:id)
                    ไม่งั้นผู้ใช้เลือกไฟล์ได้แล้วเพิ่งมารู้ตอนอัปโหลดเสร็จว่าไม่รองรับ */}
                <input
                  ref={fileInputRef} type="file" hidden onChange={handlePick}
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
                />
              </Stack>
              {uploading && <LinearProgress variant="determinate" value={progress} sx={{ mt: 1.25, borderRadius: 1 }} />}
              {uploadError && <Alert severity="error" sx={{ mt: 1.25, py: 0 }}>{String(uploadError)}</Alert>}
              {multiVisit && !uploading && (
                <Typography variant="caption" sx={{ display: "block", mt: 1, color: "text.disabled" }}>
                  ครั้งนี้เข้างาน {visits.length} ช่วง — ไฟล์จะถูกแนบไว้ที่ช่วงแรก ({formatEventDateRange(visits[0])}) และแสดงรวมเป็นเอกสารของครั้งนี้
                </Typography>
              )}
            </Box>
          )}

          {groups.length === 0 ? (
            <Box sx={{ textAlign: "center", py: canUpload ? 3 : 5 }}>
              <FolderOpen sx={{ fontSize: 36, color: "text.disabled", mb: 1 }} />
              <Typography variant="body2" sx={{ color: TEXT_SUB }}>
                {canUpload
                  ? "ครั้งนี้ยังไม่มีเอกสารแนบ — เลือกชนิดเอกสารแล้วกด \"เลือกไฟล์แนบ\" ด้านบนได้เลย"
                  : 'ครั้งนี้ยังไม่มีเอกสารแนบ — แนบได้ที่หน้า "การดำเนินงาน"'}
              </Typography>
            </Box>
          ) : (
            <Stack spacing={2.5}>
              {groups.map(({ key, label, color, Icon, files }) => (
                <Box key={key}>
                  <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
                    <Icon sx={{ fontSize: 17, color }} />
                    <Typography sx={{ fontWeight: 800, fontSize: "0.85rem" }}>{label}</Typography>
                    <Chip
                      size="small" label={`${files.length} ไฟล์`}
                      sx={{ height: 18, fontSize: "0.63rem", fontWeight: 700, bgcolor: alpha(color, 0.12), color }}
                    />
                  </Stack>

                  {/* ✅ เรียงเป็นตาราง ไม่ใช่แถวเลื่อนแนวนอน — งานที่มีเอกสาร 9 ไฟล์ (เกิดขึ้นจริง)
                      ถ้าเลื่อนแนวนอนจะเห็นทีละ 3 ไฟล์และไม่รู้ว่ามีอีกกี่ไฟล์ ต้องลากไปเรื่อยๆ */}
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(3, 1fr)", sm: "repeat(4, 1fr)" }, gap: 1 }}>
                    {files.map((f) => (
                      <Box key={f._id || f.fileUrl}>
                        <Box
                          onClick={() => setPreview({ file: f, label })}
                          sx={{
                            width: "100%", aspectRatio: "1", borderRadius: 2, overflow: "hidden", cursor: "pointer",
                            border: "1px solid", borderColor: "divider", bgcolor: alpha("#0f172a", 0.03),
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "border-color .15s",
                            "&:hover": { borderColor: color },
                          }}
                        >
                          {isImageFile(f)
                            ? <Box component="img" src={f.fileUrl} alt={f.fileName} loading="lazy"
                                sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <InsertDriveFile sx={{ fontSize: 30, color: TEXT_SUB }} />}
                        </Box>
                        <Typography variant="caption" sx={{ display: "block", color: TEXT_SUB, mt: 0.25, fontSize: "0.62rem" }} noWrap>
                          {f.fileName || "ไฟล์แนบ"}
                        </Typography>
                        {multiVisit && f._visit && (
                          <Typography variant="caption" sx={{ display: "block", color: "text.disabled", fontSize: "0.6rem" }} noWrap>
                            {formatEventDateRange(f._visit)}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Box>
                </Box>
              ))}
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={onClose} sx={{ textTransform: "none" }}>ปิด</Button>
        </DialogActions>
      </Dialog>

      <FilePreviewDialog
        file={preview?.file}
        caption={[
          preview?.label,
          preview?.file?._visit && multiVisit ? formatEventDateRange(preview.file._visit) : null,
          preview?.file?.uploadedAt ? `อัปโหลด ${formatThai(moment(preview.file.uploadedAt), "DD/MM/YYYY")}` : null,
        ].filter(Boolean).join(" · ")}
        onClose={() => setPreview(null)}
      />
    </>
  );
}
