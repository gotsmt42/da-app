/**
 * FilePreviewDialog.js — ดูไฟล์แนบ 1 ไฟล์แบบเต็มจอ (ของกลาง)
 *
 * ⚠️ ใช้ทั้งกล่องวางบิลและกล่องเอกสารของงาน — เดิมโค้ดชุดนี้อยู่ในกล่องวางบิลอย่างเดียว พอหน้า
 * "ภาพรวมงาน" ต้องเปิดดูเอกสารอีก 4 ชนิดด้วย ถ้าก๊อปไปอีกชุดจะกลายเป็นตัวดูไฟล์ 2 ชุดที่ต้องแก้พร้อมกัน
 *
 * ⚠️ ซ้อนบนกล่องเดิมเสมอ ไม่ใช่เปลี่ยนหน้า/เปิดแท็บใหม่ — คนใช้กำลังทำงานอยู่ในกล่องที่เปิดค้างไว้
 * (เช่นพิมพ์ยอดตามรูปใบวางบิล) ถ้าพาออกไปที่อื่นแล้วกลับมา ค่าที่พิมพ์ค้างไว้จะหาย
 */
import { Box, Typography, Button, Tooltip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, useMediaQuery } from "@mui/material";
import { InsertDriveFile, OpenInNew } from "@mui/icons-material";
import { isImageFile } from "../../utils/jobDocTypes";

const TEXT_SUB = "#64748b";

/**
 * @param {object|null} props.file  ไฟล์ที่จะดู — null = ปิด
 * @param {string} [props.caption]  คำอธิบายใต้ชื่อไฟล์ (เช่น ชนิดเอกสาร · วันที่เข้างาน)
 */
export default function FilePreviewDialog({ file, caption, onClose }) {
  const isMobile = useMediaQuery("(max-width:900px)");
  if (!file) return null;

  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullScreen={isMobile}>
      <DialogTitle sx={{ fontSize: "0.9rem", fontWeight: 700, pr: 6, pb: caption ? 0.5 : 2 }}>
        {file.fileName || "ไฟล์แนบ"}
        {caption && (
          <Typography variant="caption" sx={{ display: "block", color: TEXT_SUB, fontWeight: 500 }}>
            {caption}
          </Typography>
        )}
        <Tooltip title="เปิดไฟล์ในแท็บใหม่ (ซูม / ดาวน์โหลด)">
          <IconButton
            size="small" component="a" href={file.fileUrl} target="_blank" rel="noopener noreferrer"
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <OpenInNew sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 1, textAlign: "center" }}>
        {isImageFile(file) ? (
          <Box
            component="img" src={file.fileUrl} alt={file.fileName}
            sx={{ maxWidth: "100%", maxHeight: isMobile ? "70vh" : "75vh", objectFit: "contain" }}
          />
        ) : (
          // ⚠️ PDF/ไฟล์อื่นไม่ฝัง iframe — เบราว์เซอร์บนมือถือหลายตัวแสดงไม่ได้แล้วขึ้นกรอบเปล่า
          // ซึ่งดูเหมือนไฟล์เสียทั้งที่ไฟล์ปกติดี ให้กดเปิดแท็บใหม่ไปเลยชัดเจนกว่า
          <Box sx={{ py: 6 }}>
            <InsertDriveFile sx={{ fontSize: 48, color: TEXT_SUB, mb: 1 }} />
            <Typography variant="body2" sx={{ color: TEXT_SUB, mb: 2 }}>ไฟล์ชนิดนี้ดูในหน้านี้ไม่ได้</Typography>
            <Button
              variant="outlined" component="a" href={file.fileUrl} target="_blank" rel="noopener noreferrer"
              startIcon={<OpenInNew sx={{ fontSize: 16 }} />} sx={{ textTransform: "none" }}
            >
              เปิดไฟล์
            </Button>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 1.5 }}>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>ปิด</Button>
      </DialogActions>
    </Dialog>
  );
}
