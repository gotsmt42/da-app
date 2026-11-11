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
import "@/shared/utils/momentThaiLocale";
import {
  Box, Stack, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, useMediaQuery, LinearProgress, Alert,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { FolderOpenRounded as FolderOpen, AttachFileRounded as AttachFile } from "@mui/icons-material";
import { roundDocs, isDocRequired, JOB_DOC_TYPES } from "@/shared/utils/jobDocTypes";
import AttachmentList from "@/shared/ui/AttachmentList";
import EventService from "@/shared/services/EventService";
import { formatEventDateRange } from "@/shared/utils/formatDateRange";

const TEXT_SUB = "#64748b";

/**
 * @param {Array}  props.roundVisits  งานทุก document ของครั้งนี้ (null/ว่าง = ปิดกล่อง)
 * @param {string} props.title        หัวข้อกล่อง เช่น "ครั้งที่ 2 · บริษัท ก"
 */
export default function JobDocsDialog({ roundVisits, title, onClose, canUpload = false, onUploaded }) {
  const isMobile = useMediaQuery("(max-width:900px)");
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
  const byKey = new Map(groups.map((g) => [g.key, g.files]));
  // ⚠️ ครั้งที่มีหลายวัน ต้องบอกได้ว่าไฟล์มาจากการเข้างานวันไหน — ครั้งที่มีวันเดียวไม่ต้องบอก
  const multiVisit = roundVisits.length > 1;
  const head = visits[0];
  const filled = JOB_DOC_TYPES.filter((t) => (byKey.get(t.key) || []).length > 0).length;
  const pickType = (key) => { setUploadType(key); setTimeout(() => fileInputRef.current?.click(), 0); };

  /**
   * 🔁 (11 พ.ย. 2569 ผู้ใช้: "หน้าภาพรวมงาน แก้รูปแบบการแสดงเอกสารให้สวยงาม เข้าธีมแอพ ดูง่าย ตอนนี้เหมือนวางโล่งๆ")
   *    การ์ดเอกสาร 4 ชนิดแบบเดียวกับหน้าการดำเนินงาน/งานของฉัน: กรอบไอคอนสี · ชื่อ · สถานะ (แนบแล้ว x ไฟล์ / ยังไม่แนบ · บังคับ/ถ้ามี)
   *    · ปุ่ม "+ แนบ" ของชนิดนั้นมุมขวา (ไม่ต้องเลือกชนิดจากช่องก่อน) · แถวไฟล์ภาพย่อ (โมดูลไฟล์กลาง เลื่อนดูไฟล์อื่นได้)
   */
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" fullScreen={isMobile}
      PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3, bgcolor: "#f8fafc" } }}>
      <DialogTitle sx={{ p: 0, bgcolor: "#fff", borderBottom: "1px solid #e6e9ef" }}>
        <Stack direction="row" alignItems="center" gap={1.25} sx={{ px: 2.5, py: 1.5 }}>
          <Box sx={{ width: 38, height: 38, borderRadius: "11px", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#eff6ff", color: "#2563eb", flexShrink: 0 }}>
            <FolderOpen sx={{ fontSize: 21 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: "1.02rem", color: "#0f172a", lineHeight: 1.3 }} noWrap>เอกสารประจำงาน</Typography>
            <Typography sx={{ fontSize: "0.78rem", color: TEXT_SUB }} noWrap>{title}</Typography>
          </Box>
          <Typography sx={{ flexShrink: 0, fontSize: "1.2rem", fontWeight: 900, color: filled === JOB_DOC_TYPES.length ? "#16a34a" : "#2563eb", fontVariantNumeric: "tabular-nums" }}>
            {filled}/{JOB_DOC_TYPES.length}
          </Typography>
        </Stack>
        <LinearProgress variant="determinate" value={(filled / JOB_DOC_TYPES.length) * 100}
          sx={{ height: 4, bgcolor: "#eef2f7", "& .MuiLinearProgress-bar": { bgcolor: filled === JOB_DOC_TYPES.length ? "#16a34a" : "#2563eb" } }} />
      </DialogTitle>

      <DialogContent sx={{ p: { xs: 1.5, sm: 2 } }}>
        {uploadError && <Alert severity="error" sx={{ mb: 1.25, py: 0 }}>{String(uploadError)}</Alert>}
        <Stack spacing={1.1} sx={{ pt: 1.5 }}>
          {JOB_DOC_TYPES.map((t) => {
            const files = byKey.get(t.key) || [];
            const busy = uploading && uploadType === t.key;
            const required = isDocRequired(head, t.key);
            const has = files.length > 0;
            return (
              <Box key={t.key} sx={{ bgcolor: "#fff", borderRadius: "14px", border: "1px solid", borderColor: has ? "#bbf7d0" : "#e6e9ef", px: 1.5, py: 1.25 }}>
                <Stack direction="row" alignItems="center" gap={1.25}>
                  <Box sx={{ width: 38, height: 38, borderRadius: "11px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: alpha(t.color, 0.1), color: t.color }}>
                    <t.Icon sx={{ fontSize: 20 }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", color: "#0f172a", lineHeight: 1.3 }}>
                      {t.label}{required && <Box component="span" sx={{ color: "#dc2626", ml: 0.25 }}>*</Box>}
                    </Typography>
                    <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 0.2 }}>
                      <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: has ? "#16a34a" : required ? "#d97706" : "#cbd5e1" }} />
                      <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: has ? "#15803d" : required ? "#b45309" : TEXT_SUB }}>
                        {has ? `แนบแล้ว ${files.length} ไฟล์` : "ยังไม่แนบ"}
                      </Typography>
                      <Typography sx={{ fontSize: "0.74rem", color: "#94a3b8" }}>· {required ? "บังคับ" : "ถ้ามี"}</Typography>
                    </Stack>
                  </Box>
                  {canUpload && (
                    <Button size="small" onClick={() => pickType(t.key)} disabled={uploading} startIcon={<AttachFile sx={{ fontSize: "17px !important" }} />}
                      sx={{ flexShrink: 0, textTransform: "none", fontWeight: 800, fontSize: "0.8rem", borderRadius: "10px", px: 1.5, minHeight: 34, bgcolor: "#eff6ff", color: "#2563eb", "&:hover": { bgcolor: "#dbeafe" } }}>
                      {has ? "เพิ่ม" : "แนบ"}
                    </Button>
                  )}
                </Stack>
                {(has || busy) && (
                  <Box sx={{ mt: 1 }}>
                    <AttachmentList readOnly emptyText={null}
                      files={files.map((f) => ({ ...f, tag: multiVisit && f._visit ? formatEventDateRange(f._visit) : null }))}
                      uploading={busy ? { progress } : null}
                      sx={{ maxHeight: 280, overflowY: "auto" }} />
                  </Box>
                )}
              </Box>
            );
          })}
        </Stack>
        {multiVisit && canUpload && (
          <Typography sx={{ display: "block", mt: 1.25, fontSize: "0.72rem", color: "#94a3b8" }}>
            ครั้งนี้เข้างาน {visits.length} ช่วง — ไฟล์ใหม่แนบไว้ที่ช่วงแรก ({formatEventDateRange(visits[0])}) และแสดงรวมเป็นเอกสารของครั้งนี้
          </Typography>
        )}
        {!canUpload && filled === 0 && (
          <Typography sx={{ mt: 1.25, fontSize: "0.78rem", color: TEXT_SUB, textAlign: "center" }}>ยังไม่มีเอกสารแนบ — แนบได้ที่หน้า “การดำเนินงาน” หรือ “งานของฉัน”</Typography>
        )}
        {/* ⚠️ จำกัดชนิดไฟล์ให้ตรงกับที่ server รับจริง — ไม่งั้นเลือกได้แล้วเพิ่งมารู้ตอนอัปโหลดเสร็จ */}
        <input ref={fileInputRef} type="file" hidden onChange={handlePick} accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx" />
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.25, bgcolor: "#fff", borderTop: "1px solid #e6e9ef" }}>
        <Button onClick={onClose} variant="contained" disableElevation
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2.5, px: 3, bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8" } }}>
          เสร็จสิ้น
        </Button>
      </DialogActions>
    </Dialog>
  );
}
