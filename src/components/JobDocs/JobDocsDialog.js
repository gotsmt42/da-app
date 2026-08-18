/**
 * JobDocsDialog.js — เอกสารทั้งหมดของ "ครั้งที่ N" 1 ครั้ง (Service Report / ใบเสนอราคา /
 * ใบวางบิล / ใบส่งมอบงาน) ดูได้จากหน้าภาพรวมงานโดยไม่ต้องข้ามไปหน้าการดำเนินงาน
 *
 * ⚠️ ดูอย่างเดียว ไม่มีอัปโหลด/ลบ — การจัดการไฟล์ยังเป็นของหน้า "การดำเนินงาน" ที่เดียวเหมือนเดิม
 * (ช่างทำงานที่นั่น มีทั้งแถบความคืบหน้าอัปโหลด สิทธิ์ และการยืนยันลบครบอยู่แล้ว) หน้านี้ยกมาแค่
 * "เปิดดู" ซึ่งเป็นสิ่งที่คนดูภาพรวมงานต้องการจริงๆ — เอาการอัปโหลดมาด้วยจะกลายเป็นของ 2 ที่ที่ต้อง
 * ดูแลพร้อมกันโดยไม่ได้ประโยชน์เพิ่ม
 */
import { useState } from "react";
import moment from "moment";
import "moment/locale/th";
import {
  Box, Stack, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Chip, useMediaQuery,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { InsertDriveFile, FolderOpen } from "@mui/icons-material";
import { roundDocs, isImageFile } from "../../utils/jobDocTypes";
import { formatEventDateRange } from "../../utils/formatDateRange";
import FilePreviewDialog from "../Documents/FilePreviewDialog";

const TEXT_SUB = "#64748b";

/**
 * @param {Array}  props.roundVisits  งานทุก document ของครั้งนี้ (null/ว่าง = ปิดกล่อง)
 * @param {string} props.title        หัวข้อกล่อง เช่น "ครั้งที่ 2 · บริษัท ก"
 */
export default function JobDocsDialog({ roundVisits, title, onClose }) {
  const isMobile = useMediaQuery("(max-width:900px)");
  const [preview, setPreview] = useState(null);

  if (!roundVisits || roundVisits.length === 0) return null;
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
          {groups.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 5 }}>
              <FolderOpen sx={{ fontSize: 36, color: "text.disabled", mb: 1 }} />
              <Typography variant="body2" sx={{ color: TEXT_SUB }}>
                ครั้งนี้ยังไม่มีเอกสารแนบ — แนบได้ที่หน้า "การดำเนินงาน"
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
          preview?.file?.uploadedAt ? `อัปโหลด ${moment(preview.file.uploadedAt).format("DD/MM/YYYY")}` : null,
        ].filter(Boolean).join(" · ")}
        onClose={() => setPreview(null)}
      />
    </>
  );
}
