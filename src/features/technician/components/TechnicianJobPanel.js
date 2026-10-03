/**
 * TechnicianJobPanel.jsx — v4
 *
 * ฟีเจอร์:
 *   ✅ เอกสารประจำงาน 4 ชนิด (Service Report, ใบเสนอราคา, ใบวางบิล, ใบส่งมอบงาน)
 *      ติ๊กสถานะได้อิสระ + แนบไฟล์แยกกันแต่ละชนิด
 *   ✅ บันทึกสรุปงานเป็นข้อความ (workNote) พร้อม push activityLog
 *   ✅ ขอปิดงาน (เมื่อติ๊ก Service Report แล้ว) → รอแอดมินอนุมัติ
 *   ✅ ส่ง activityLog กลับไปที่ parent (Operation) เพื่อแอดมินเห็น real-time
 *   ✅ CommentThread — คุยโต้ตอบกับแอดมิน/manager ได้ในตัว (เช่น "ขอใบเสนอราคางานนี้")
 *      แยกจาก activityLog ที่เป็น log อัตโนมัติของระบบ ใช้งานได้แม้งานจะปิดไปแล้ว
 */

import React, { useState, useRef, useCallback } from "react";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import Swal from "sweetalert2";
import { formatEventDateRange } from "@/shared/utils/formatDateRange";
import { isApproved } from "@/shared/utils/approvalStatus";
import { formatRoundLabel } from "@/shared/utils/contractRounds";
import {
  Box, Card, CardContent, Typography, Stack, Avatar,
  Button, IconButton, TextField, Collapse, Divider, LinearProgress,
  Tooltip, Menu, MenuItem, ListItemIcon, ListItemText,
  Dialog, DialogTitle, DialogContent, useMediaQuery,
} from "@mui/material";
import { styled, alpha } from "@mui/material/styles";
import {
  Build, Assignment, Visibility, Warning, Description,
  Edit, CloudUpload, CheckCircle,
  ExpandMore, ExpandLess, ChevronRight, History,
  PictureAsPdf, Image, Article, InsertDriveFile,
  AttachFile, Delete, Download, TaskAlt, HourglassTop, NoteAdd,
  RequestQuote, ReceiptLong, AssignmentTurnedIn, Close, Cancel,
  Send, Chat, Link as LinkIcon, MoreVert, Print, Share, CalendarMonth, Lock,
  CheckCircleOutline, InfoOutlined, RemoveCircleOutline, CheckBox, CheckBoxOutlineBlank,
} from "@mui/icons-material";
import { INK, INK_2, MUTED, FAINT, LINE, SURFACE, ACCENT, ACCENT_SOFT, ACCENT_LINE, SUCCESS } from "@/shared/ui/PageKit";
import LineIcon from "@/shared/ui/LineIcon";
import { printFile, shareFile, shareToLine, isMobileDevice } from "@/shared/utils/fileActions";
import InfoLine from "@/shared/ui/InfoLine";
import { formatThai } from "@/shared/utils/thaiDate";
import { ROLES } from "@/shared/utils/roles";

// ✅ ใช้ตัดสินใจลำดับปุ่มแชร์ในเมนู "⋮" ต่อไฟล์ (ดูเหตุผลใน fileActions.js)
const IS_MOBILE = isMobileDevice();

// ✅ เดิม MUI Menu เปิดช้า/รู้สึกหน่วง เพราะ transition คำนวณตามความสูงเมนู (auto) และมีการ
// ล็อกสกรอลของหน้าทุกครั้งที่เปิด — ลด duration ลงคงที่ + ปิด scroll lock ให้ลื่นขึ้น
const FAST_MENU_PROPS = {
  transitionDuration: { enter: 120, exit: 80 },
  disableScrollLock: true,
};

// ─── Constants ────────────────────────────────────────────────────────
const OP_COLOR = {
  "กำลังรอยืนยัน":     "#f59e0b",
  "ยืนยันแล้ว":         "#3b82f6",
  "กำลังดำเนินการ":     "#8b5cf6",
  "ดำเนินการเสร็จสิ้น": "#10b981",
};

const TYPE_ICON = {
  PM:              <Build fontSize="small" />,
  Service:         <Assignment fontSize="small" />,
  Inspection:      <Visibility fontSize="small" />,
  "ตรวจเช็คปัญหา": <Warning fontSize="small" />,
  "สำรวจระบบ":     <Description fontSize="small" />,
};

// 🐛 ปรับตามที่ผู้ใช้แจ้ง (ช่างงงว่าแต่ละช่องคือเอกสารอะไร ต้องทำอะไรกับมัน): เดิมมีแค่ชื่อเอกสารลอยๆ
// ("ใบเสนอราคา") กับคำถามกลางๆ ที่ใช้ข้อความเดียวกันหมดทุกชนิด ("งานนี้มีเอกสารนี้หรือไม่?") ซึ่งไม่ได้
// บอกเลยว่าเป็นใบเสนอราคาของอะไร ใครออก ออกให้ใคร และตอบ "มี/ไม่มี" แล้วจะเกิดอะไรขึ้นต่อ
// ✅ เพิ่มคำอธิบายสั้นๆ ใต้ชื่อ + คำถาม/ตัวเลือกเฉพาะของเอกสารแต่ละชนิด ให้อ่านแล้วตัดสินใจได้ทันที
// โดยไม่ต้องเดาหรือไปถามแอดมิน
const DOCUMENT_TYPES = [
  {
    type: "report", label: "Service Report", color: "#2563eb", alwaysRequired: true,
    icon: <Description sx={{ fontSize: 18 }} />,
    desc: "ใบรายงานผลการเข้าปฏิบัติงานครั้งนี้ — ทุกงานต้องแนบก่อนขอปิดงาน",
  },
  {
    type: "quotation", label: "ใบเสนอราคา", color: "#d97706", alwaysRequired: false,
    icon: <RequestQuote sx={{ fontSize: 18 }} />,
    desc: "ใบเสนอราคาที่ต้องเสนอลูกค้าเพิ่มจากงานนี้ เช่น อะไหล่ที่ต้องเปลี่ยน หรืองานซ่อมเพิ่มเติมที่พบหน้างาน",
    question: "งานนี้ต้องเสนอราคางานเพิ่มเติมให้ลูกค้าไหม?",
    yesLabel: "ต้องเสนอราคา",
    noLabel: "ไม่ต้องเสนอ",
    noneText: "งานนี้ไม่ต้องเสนอราคาเพิ่ม",
    uploadHint: "แนบไฟล์ใบเสนอราคาที่ทำให้ลูกค้า — แอดมินจะนำไปติดตามผลกับลูกค้าต่อในหน้า “ติดตามใบเสนอราคา”",
  },
  {
    type: "invoice", label: "ใบวางบิล", color: "#0891b2", alwaysRequired: false,
    icon: <ReceiptLong sx={{ fontSize: 18 }} />,
    desc: "ใบวางบิล/ใบแจ้งหนี้ที่ต้องวางให้ลูกค้าสำหรับงานครั้งนี้",
    question: "งานนี้ต้องวางบิลลูกค้าไหม?",
    yesLabel: "ต้องวางบิล",
    noLabel: "ไม่ต้องวางบิล",
    noneText: "งานนี้ไม่ต้องวางบิล",
    uploadHint: "แนบไฟล์ใบวางบิลที่ส่งให้ลูกค้า",
  },
  {
    type: "completion", label: "ใบส่งมอบงาน", color: "#059669", alwaysRequired: false,
    icon: <AssignmentTurnedIn sx={{ fontSize: 18 }} />,
    desc: "ใบส่งมอบงานที่ลูกค้าเซ็นรับงานเรียบร้อยแล้ว",
    question: "งานนี้มีใบส่งมอบงานที่ลูกค้าเซ็นรับไหม?",
    yesLabel: "มี ลูกค้าเซ็นแล้ว",
    noLabel: "ไม่มี",
    noneText: "งานนี้ไม่มีใบส่งมอบงาน",
    uploadHint: "แนบไฟล์/รูปถ่ายใบส่งมอบงานที่ลูกค้าเซ็นแล้ว",
  },
];

// ✅ งาน PM (Preventive Maintenance) = งานตามสัญญาที่ต้องวางบิลและส่งมอบงานทุกครั้งเป็นมาตรฐาน
// เทียบเกณฑ์เดียวกับที่ ContractOverview.js ใช้จับงาน PM (เทียบชื่อประเภทงานแบบตัดช่องว่าง) — เผื่อ
// ผู้ใช้พิมพ์ "pm"/"Pm" ด้วย จึงเทียบแบบไม่สนตัวพิมพ์เล็กใหญ่
const isPMJob = (event) => (event?.title || "").trim().toUpperCase() === "PM";

// ✅ เอกสารชนิดนี้ "บังคับต้องมี" สำหรับงานนี้ไหม — ต่างจากเดิมที่ผูกกับชนิดเอกสารตายตัวอย่างเดียว
// (report เท่านั้นที่บังคับ) ตอนนี้ขึ้นกับประเภทงานด้วยตามที่ผู้ใช้กำหนด:
//   • Service Report — บังคับทุกงานเหมือนเดิม
//   • ใบวางบิล / ใบส่งมอบงาน — บังคับเฉพาะงาน PM (งานอื่นยังเลือก "มี/ไม่มี" ได้ตามเดิม)
//   • ใบเสนอราคา — ไม่บังคับทุกกรณี (มีงานเพิ่มเติมค่อยเสนอ)
export const isDocRequired = (event, type) => {
  if (type === "report") return true;
  if (type === "quotation") return false;
  return isPMJob(event); // invoice / completion
};

// เอกสารชนิดนี้ถือว่า "เสร็จ" แล้วหรือยัง
//   • report: ต้องติ๊กยืนยัน "และ" มีไฟล์
//   • เอกสารที่บังคับตามประเภทงาน (เช่น ใบวางบิลของงาน PM): ต้องมีไฟล์เท่านั้น ไม่มีทางเลือก "ไม่มี"
//   • เอกสารที่ไม่บังคับ: ตอบ "ไม่มี" ก็เสร็จ / ตอบ "มี" ต้องแนบไฟล์อย่างน้อย 1 ไฟล์
export const isDocComplete = (event, type) => {
  const hasFiles = (event[`${type}Files`] || []).length > 0;
  // Service Report: บังคับต้องติ๊ก "และ" ต้องแนบไฟล์จริงอย่างน้อย 1 ไฟล์ ถึงจะถือว่าเสร็จ
  if (type === "report") return Boolean(event.documentSentReport) && hasFiles;
  // ⚠️ ต้องเช็คก่อน applicable เสมอ — งาน PM ที่ช่างเคยกด "ไม่มี" ไว้ตอนที่ยังไม่บังคับ ต้องกลับมา
  // นับว่ายังไม่เสร็จ ไม่ใช่ผ่านไปเพราะค่าเดิมที่ค้างอยู่ในฐานข้อมูล
  if (isDocRequired(event, type)) return hasFiles;
  const applicable = event[`${type}Applicable`];
  if (applicable === false) return true;
  if (applicable === true) return hasFiles;
  return false;
};

const capitalize = (str = "") => str.charAt(0).toUpperCase() + str.slice(1);

// ─── Styled ──────────────────────────────────────────────────────────
// ✅ เพิ่ม hover animation (ยกขึ้น + เงาเข้มขึ้น + เส้นขอบเน้นสี) ให้ผู้ใช้รู้ชัดเจนว่าการ์ดนี้
// กดได้ (เดิมไม่มี hover effect เลย เอาเมาส์ไปชี้แล้วดูเหมือนกดไม่ได้)
const JobCard = styled(Card)(({ theme }) => ({
  background: alpha(theme.palette.background.paper, 0.96),
  borderRadius: 16,
  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  boxShadow: `0 2px 16px ${alpha(theme.palette.common.black, 0.06)}`,
  marginBottom: theme.spacing(2),
  overflow: "visible",
  transition: "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
  "&:hover": {
    transform: "translateY(-3px)",
    boxShadow: `0 10px 28px ${alpha(theme.palette.common.black, 0.16)}`,
    borderColor: alpha(theme.palette.primary.main, 0.3),
  },
}));

const ActionBtn = styled(Button)(({ theme, variant: v, btncolor }) => ({
  borderRadius: 10,
  fontWeight: 700,
  fontSize: "0.85rem",
  textTransform: "none",
  padding: "10px 16px",
  ...(v === "contained" && {
    background: btncolor || theme.palette.primary.main,
    color: "#fff",
    "&:hover": { background: btncolor ? alpha(btncolor, 0.85) : undefined },
  }),
  ...(v === "outlined" && {
    borderColor: btncolor || theme.palette.primary.main,
    color: btncolor || theme.palette.primary.main,
    "&:hover": { background: alpha(btncolor || theme.palette.primary.main, 0.06) },
  }),
}));

// ─── Helper ───────────────────────────────────────────────────────────
// ไฟล์เก็บบน Cloudinary (คนละโดเมน) และบาง URL เก่าอาจไม่มีนามสกุลติดมาด้วย
// จึงดึงไฟล์มาเป็น blob แล้วสั่งดาวน์โหลดเอง เพื่อบังคับชื่อไฟล์ + นามสกุลที่ถูกต้องเสมอ
const downloadFile = async (url, fileName) => {
  if (!url) return;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Download failed");
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (err) {
    console.error("Download error:", err);
    window.open(url, "_blank");
  }
};

const getFileType = (fileName = "") => {
  const lower = (fileName || "").toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp"].some(e => lower.endsWith(e))) return "image";
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".doc") || lower.endsWith(".docx")) return "word";
  if (lower.endsWith(".xls") || lower.endsWith(".xlsx")) return "excel";
  return "unknown";
};

const fileTypeIcon = (fileName) => {
  const t = getFileType(fileName);
  if (t === "image") return <Image sx={{ color: "#10b981", fontSize: 16 }} />;
  if (t === "pdf")   return <PictureAsPdf sx={{ color: "#ef4444", fontSize: 16 }} />;
  if (t === "word")  return <Article sx={{ color: "#3b82f6", fontSize: 16 }} />;
  if (t === "excel") return <InsertDriveFile sx={{ color: "#10b981", fontSize: 16 }} />;
  return <AttachFile sx={{ color: "#6b7280", fontSize: 16 }} />;
};

// ✅ perf: แยกแถวไฟล์ออกมาเป็นคอมโพเนนต์ของตัวเอง + React.memo — เดิมแถวไฟล์อยู่ใน .map() ในตัว
// DocumentFileList เอง พอ auto-refresh ทุก 15 วิ แทนที่ events ทั้งก้อนด้วย object ใหม่ (แม้ข้อมูลจริง
// ไม่เปลี่ยน) ทุกแถวไฟล์ต้อง re-render ใหม่หมด — งานที่มีไฟล์เยอะ (เช่น 9 ไฟล์ตามภาพที่ผู้ใช้ส่งมา)
// นี่คือส่วนที่หนักที่สุด เทียบด้วยค่าจริง (_id/fileUrl/fileName) ไม่ใช่ reference ของ object ไฟล์
// (เปลี่ยนทุก poll อยู่แล้วแม้เนื้อหาเดิม) — onPreview/onOpenMenu ต้องเป็น stable reference จากต้นทาง
const FileRow = React.memo(
  ({ file: f, onPreview, onOpenMenu }) => (
    <Stack direction="row" alignItems="center" gap={1} sx={{
      pl: 1.25, pr: 0.5, py: 0.5, borderRadius: 2, bgcolor: "#fff", border: `1px solid ${LINE}`,
    }}>
      {fileTypeIcon(f.fileName)}
      <Typography noWrap flex={1} title={f.fileName}
        sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK_2, cursor: "pointer", minWidth: 0 }}
        onClick={() => onPreview(f.fileUrl, f.fileName)}>
        {f.fileName}
      </Typography>
      <Tooltip title="ดูไฟล์">
        <IconButton onClick={() => onPreview(f.fileUrl, f.fileName)} sx={{ p: 0.9, color: MUTED }}>
          <Visibility sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="ดาวน์โหลด/พิมพ์/แชร์/ลบ">
        <IconButton onClick={e => onOpenMenu(e.currentTarget, f)} sx={{ p: 0.9, color: MUTED }}>
          <MoreVert sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
    </Stack>
  ),
  (prev, next) =>
    prev.file._id === next.file._id &&
    prev.file.fileUrl === next.file.fileUrl &&
    prev.file.fileName === next.file.fileName &&
    prev.onPreview === next.onPreview &&
    prev.onOpenMenu === next.onOpenMenu,
);

// ─── DocumentFileList ─────────────────────────────────────────────────
// รายการไฟล์ที่แนบ (แนบได้หลายไฟล์) + ปุ่มเพิ่มไฟล์อีก (ใช้ร่วมกันทั้ง required เสมอ และ "มี")
const DocumentFileList = ({ type, files, isUploading, uploadProgress, onFileUpload, onDeleteFile, onPreview, isLocked }) => {
  const fileRef = useRef();
  const fileList = files || [];

  // ✅ เมนู "⋮" ต่อไฟล์ — เดิมโชว์ปุ่มดู/ดาวน์โหลด/ลบ เรียงเป็นไอคอนแยกทุกแถว ดูรกเวลามีหลายไฟล์
  // รวมเป็นเมนูเดียว เหลือแค่ปุ่มดูไฟล์ (บ่อยสุด) + ปุ่ม "⋮" ที่มีดาวน์โหลด/พิมพ์/แชร์ LINE/ลบ
  const [fileMenu, setFileMenu] = useState(null); // { el, file }
  const closeFileMenu = () => setFileMenu(null);
  // ✅ perf: stable reference ให้ FileRow ที่ memo ไว้เทียบ props ได้จริง
  const handleOpenFileMenu = useCallback((el, file) => setFileMenu({ el, file }), []);

  const handleFileChange = (e) => {
    if (e.target.files?.length) onFileUpload(e.target.files, type);
  };

  // ✅ perf: จำกัดความสูง+เลื่อนดูแทนตอนมีไฟล์เยอะ (เดิมไม่มี ลิสต์ยาวๆ ดันความสูงทั้งหน้า/Dialog
  // ไปเรื่อยๆ) เทียบ pattern เดียวกับ FileUploadSection ในหน้า Operation
  return (
    <Box>
      {fileList.length > 0 && (
        <Stack spacing={0.75} sx={{ mb: 1, maxHeight: 260, overflowY: "auto" }}>
          {fileList.map(f => (
            <FileRow key={f._id || f.fileUrl} file={f} onPreview={onPreview} onOpenMenu={handleOpenFileMenu} />
          ))}
        </Stack>
      )}

      {/* เมนู "⋮" ต่อไฟล์ — ดาวน์โหลด/พิมพ์/แชร์ LINE/แชร์อื่น/ลบ รวมไว้ที่เดียว */}
      <Menu {...FAST_MENU_PROPS} anchorEl={fileMenu?.el} open={Boolean(fileMenu)} onClose={closeFileMenu}
        PaperProps={{ sx: { borderRadius: 2, boxShadow: "0 8px 32px rgba(0,0,0,0.12)" } }}>
        <MenuItem onClick={() => { downloadFile(fileMenu.file.fileUrl, fileMenu.file.fileName); closeFileMenu(); }} sx={{ gap: 1.5, minHeight: 44 }}>
          <ListItemIcon><Download fontSize="small" /></ListItemIcon>
          <ListItemText>ดาวน์โหลด</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { printFile(fileMenu.file.fileUrl, fileMenu.file.fileName); closeFileMenu(); }} sx={{ gap: 1.5, minHeight: 44 }}>
          <ListItemIcon><Print fontSize="small" /></ListItemIcon>
          <ListItemText>พิมพ์</ListItemText>
        </MenuItem>
        {/* ✅ LINE เดสก์ท็อปไม่ลงทะเบียนเป็น Share Target ของ OS จึงไม่มีทางโผล่ในแผง Share ของ
            Windows/Mac ได้เลย (ที่ shareFile() เรียกผ่าน navigator.share) — สลับให้ปุ่มที่
            การันตีว่าเข้าถึง LINE ได้จริงขึ้นก่อนตามชนิดอุปกรณ์ */}
        {IS_MOBILE ? (
          <>
            <MenuItem onClick={() => { shareFile(fileMenu.file.fileUrl, fileMenu.file.fileName); closeFileMenu(); }} sx={{ gap: 1.5, minHeight: 44 }}>
              <ListItemIcon><Share fontSize="small" /></ListItemIcon>
              <ListItemText>แชร์ไฟล์ (รูป/PDF)</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { shareToLine(fileMenu.file.fileUrl, fileMenu.file.fileName); closeFileMenu(); }} sx={{ gap: 1.5, minHeight: 44 }}>
              <ListItemIcon><LineIcon size={20} /></ListItemIcon>
              <ListItemText>แชร์ลิงก์ไปยัง LINE</ListItemText>
            </MenuItem>
          </>
        ) : (
          <>
            <MenuItem onClick={() => { shareToLine(fileMenu.file.fileUrl, fileMenu.file.fileName); closeFileMenu(); }} sx={{ gap: 1.5, minHeight: 44 }}>
              <ListItemIcon><LineIcon size={20} /></ListItemIcon>
              <ListItemText>แชร์ไปยัง LINE</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { shareFile(fileMenu.file.fileUrl, fileMenu.file.fileName); closeFileMenu(); }} sx={{ gap: 1.5, minHeight: 44 }}>
              <ListItemIcon><Share fontSize="small" /></ListItemIcon>
              <ListItemText>แชร์ไฟล์ผ่านระบบ (ไม่รวม LINE บนคอม)</ListItemText>
            </MenuItem>
          </>
        )}
        {!isLocked && [
          <Divider key="file-menu-divider" />,
          <MenuItem key="file-menu-delete" onClick={() => { onDeleteFile(type, fileMenu.file._id); closeFileMenu(); }} sx={{ gap: 1.5, minHeight: 44, color: "error.main" }}>
            <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>ลบไฟล์</ListItemText>
          </MenuItem>,
        ]}
      </Menu>

      {isLocked ? null : isUploading ? (
        <LinearProgress variant="determinate" value={uploadProgress || 0} sx={{ borderRadius: 2, height: 6 }} />
      ) : (
        <>
          <input ref={fileRef} type="file" hidden multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileChange} />
          {/* ✅ ปุ่มแนบไฟล์แบบกล่องเส้นประ — บอกชนิดไฟล์ที่รับได้ในตัว ไม่ต้องเดา */}
          <Box component="button" type="button" onClick={() => fileRef.current?.click()}
            sx={{
              width: "100%", display: "flex", alignItems: "center", gap: 1, minHeight: 44,
              px: 1.5, borderRadius: 2, cursor: "pointer", font: "inherit", textAlign: "left",
              border: "1px dashed #cbd5e1", bgcolor: "#fff", color: INK_2,
              transition: "background-color .15s, border-color .15s, color .15s",
              "&:hover": { bgcolor: ACCENT_SOFT, borderColor: ACCENT_LINE, color: ACCENT },
            }}>
            <CloudUpload sx={{ fontSize: 19, color: "inherit", opacity: 0.8 }} />
            <Typography component="span" sx={{ fontSize: "0.84rem", fontWeight: 700, color: "inherit" }}>
              {fileList.length > 0 ? "เพิ่มไฟล์" : "แนบไฟล์"}
            </Typography>
            <Typography component="span" noWrap sx={{ fontSize: "0.7rem", color: FAINT, ml: "auto", minWidth: 0 }}>
              PDF · รูป · Word · Excel
            </Typography>
          </Box>
        </>
      )}
    </Box>
  );
};

// ─── DocumentChecklistItem ────────────────────────────────────────────
// alwaysRequired (Service Report): แตะทั้งแถวเพื่อติ๊ก + แนบไฟล์
// ไม่ใช่ alwaysRequired (ใบเสนอราคา/ใบวางบิล/ใบส่งมอบงาน): ต้องเลือก "มี/ไม่มี" ก่อน (ปุ่มใหญ่ กดง่ายบนมือถือ)
// ถ้า "มี" ต้องแนบไฟล์ให้ครบถึงจะถือว่าเสร็จ, ถ้า "ไม่มี" ถือว่าเสร็จทันที
const DocumentChecklistItem = ({
  type, label, color, icon, event, alwaysRequired,
  // ✅ ข้อความเฉพาะของเอกสารแต่ละชนิด (ดู DOCUMENT_TYPES) — มี fallback กลางๆ ไว้เผื่อชนิดใหม่ที่ยัง
  // ไม่ได้เขียนข้อความเฉพาะให้ จะได้ไม่ขึ้นช่องว่างเปล่า
  desc, question, yesLabel, noLabel, noneText, uploadHint,
  onToggleCheck, onSetApplicable, onFileUpload, onDeleteFile, onPreview,
  isUploading, uploadProgress, isLocked,
}) => {
  const files      = event[`${type}Files`] || [];
  const hasFiles   = files.length > 0;
  const applicable = event[`${type}Applicable`];
  const complete   = isDocComplete(event, type);
  const checked    = Boolean(event[`documentSent${capitalize(type)}`]);
  // ✅ "บังคับตามประเภทงาน" — งาน PM ต้องมีใบวางบิล/ใบส่งมอบงานเสมอ (ดู isDocRequired)
  // ต่างจาก alwaysRequired ของ Service Report ตรงที่ไม่ต้องติ๊กยืนยัน แค่แนบไฟล์ก็พอ จึงต้องแยกเป็น
  // โหมดที่ 3: ไม่มีปุ่ม "มี/ไม่มี" ให้เลือก (เพราะไม่มีทางเลือก) แต่ก็ไม่มีเช็คบ็อกซ์ให้ติ๊กเหมือน report
  const requiredByJobType = !alwaysRequired && isDocRequired(event, type);

  // ✅ สถานะของช่องนี้ 1 ป้ายทางขวา (แทนวงกลมเปล่า/การระบายสีทั้งการ์ด) — อ่านแล้วรู้ทันทีว่าต้องทำอะไรต่อ
  const pending = alwaysRequired ? (!hasFiles ? "ต้องแนบไฟล์" : "รอยืนยัน")
    : requiredByJobType || applicable === true ? "ต้องแนบไฟล์"
    : "รอเลือก";
  // ✅ ตอบ "ไม่มี" = ป้ายเทา "ไม่มีเอกสารนี้" ไม่ใช่ "ครบ" (ผู้ใช้: "ถ้าไม่มี ไม่ควรมีคำว่าครบ")
  const notApplicable = complete && applicable === false && !alwaysRequired && !requiredByJobType;
  const pill = notApplicable
    ? { text: "ไม่มี", fg: MUTED, dot: "#cbd5e1" }
    : complete
    ? { text: "แนบแล้ว", fg: "#15803d", icon: <CheckCircle sx={{ fontSize: 15 }} /> }
    : pending === "รอเลือก"
      ? { text: pending, fg: MUTED, dot: "#cbd5e1" }
      : { text: pending, fg: "#b45309", dot: "#f59e0b" };
  const required = alwaysRequired || requiredByJobType;
  const fileList = (
    <DocumentFileList
      type={type} files={files}
      isUploading={isUploading} uploadProgress={uploadProgress}
      onFileUpload={onFileUpload} onDeleteFile={onDeleteFile} onPreview={onPreview}
      isLocked={isLocked}
    />
  );
  const hint = (text) => text ? (
    <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.45, mb: 1 }}>{text}</Typography>
  ) : null;

  return (
    <Box sx={{
      borderRadius: 2.5, bgcolor: "#fff", overflow: "hidden",
      border: `1px solid ${LINE}`,
      boxShadow: "0 1px 2px rgba(15,23,42,.04)",
      transition: "border-color .15s ease",
    }}>
      {/* ── หัว: ไอคอนชนิดเอกสาร · ชื่อ + ป้ายบังคับ/ถ้ามี · ป้ายสถานะ ── */}
      <Stack direction="row" alignItems="flex-start" gap={1.25} sx={{ px: 1.75, pt: 1.5, pb: 1 }}>
        <Box sx={{
          width: 36, height: 36, borderRadius: "10px", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          bgcolor: "#f1f5f9", color: INK_2,
        }}>
          {icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
            <Typography sx={{ fontWeight: 800, fontSize: "0.92rem", color: INK, lineHeight: 1.3 }}>{label}</Typography>
            <Box component="span" sx={{
              fontSize: "0.64rem", fontWeight: 800, px: 0.75, py: 0.1, borderRadius: 1,
              color: required ? INK_2 : MUTED, bgcolor: required ? "#f1f5f9" : "transparent",
              border: required ? "none" : `1px solid ${LINE}`,
            }}>
              {required ? "บังคับ" : "ถ้ามี"}
            </Box>
          </Stack>
          {/* ✅ คำอธิบายเต็ม — ช่างรู้ว่าเอกสารนี้คืออะไร ของอะไร ใช้ทำอะไรต่อ (ผู้ใช้: "อธิบายรายละเอียดให้ครบ") */}
          {desc && (
            <Typography sx={{ fontSize: "0.76rem", color: MUTED, lineHeight: 1.45, mt: 0.25 }}>{desc}</Typography>
          )}
        </Box>
        <Box component="span" sx={{
          display: "inline-flex", alignItems: "center", gap: 0.4, flexShrink: 0, mt: 0.25,
          height: 22, fontSize: "0.74rem", fontWeight: 700, whiteSpace: "nowrap", color: pill.fg,
        }}>
          {!pill.icon && <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: pill.dot }} />}
          {pill.icon}{pill.text}
        </Box>
      </Stack>

      <Box sx={{ px: 1.75, pb: 1.75 }}>
        {/* ✅ เหตุผลที่ช่องนี้ไม่มีตัวเลือก "ไม่มี" — บอกครั้งเดียวในกล่องเล็ก (เดิมเตือนซ้ำ 2 บรรทัดตัวส้มหนา) */}
        {requiredByJobType && (
          <Stack direction="row" gap={0.6} alignItems="flex-start" sx={{ mb: 1 }}>
            <InfoOutlined sx={{ fontSize: 15, color: FAINT, mt: 0.2 }} />
            <Typography sx={{ fontSize: "0.74rem", color: INK_2, lineHeight: 1.45 }}>
              งาน PM ต้องมีเอกสารนี้ทุกครั้ง — แนบไฟล์ก่อนจึงจะขอปิดงานได้
            </Typography>
          </Stack>
        )}

        {alwaysRequired ? (
          <>
            {!hasFiles && hint("แนบไฟล์ Service Report ของงานนี้ แล้วกดยืนยันด้านล่าง — ต้องมีทั้งไฟล์และการยืนยันจึงจะขอปิดงานได้")}
            {fileList}
            {/* ✅ การยืนยันเป็นช่องติ๊กมีคำอธิบาย แทนวงกลมเปล่าทางขวาที่ไม่รู้ว่ากดได้ */}
            <Stack direction="row" alignItems="center" gap={1} role="checkbox" aria-checked={checked}
              onClick={!isLocked ? () => onToggleCheck(type, !checked) : undefined}
              sx={{
                mt: 1, px: 1.25, py: 0.9, borderRadius: 2, cursor: isLocked ? "default" : "pointer",
                border: `1px solid ${LINE}`, bgcolor: "#fff",
                opacity: isLocked ? 0.7 : 1,
              }}>
              {checked ? <CheckBox sx={{ fontSize: 22, color: ACCENT }} /> : <CheckBoxOutlineBlank sx={{ fontSize: 22, color: FAINT }} />}
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: INK_2, lineHeight: 1.3 }}>
                  ยืนยันว่า Service Report ครบถ้วนแล้ว
                </Typography>
                {checked && !hasFiles && (
                  <Typography sx={{ fontSize: "0.7rem", color: "#b45309", fontWeight: 600 }}>ยังไม่มีไฟล์ — แนบไฟล์ก่อนจึงจะนับว่าครบ</Typography>
                )}
              </Box>
            </Stack>
          </>
        ) : requiredByJobType ? (
          <>
            {!hasFiles && hint(uploadHint)}
            {fileList}
          </>
        ) : applicable === null || applicable === undefined ? (
          <>
            {/* ✅ คำถามเจาะจงต่อชนิดเอกสาร + ปุ่มที่บอกผลลัพธ์ตรงๆ — ปุ่มขาวชัดเจน (เดิมสีเทาดูเหมือนกดไม่ได้) */}
            <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: INK_2, mb: 0.75 }}>
              {question || "งานนี้มีเอกสารนี้หรือไม่?"}
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
              {[["yes", yesLabel || "มี", <CheckCircleOutline key="i" sx={{ fontSize: 18, color: SUCCESS }} />],
                ["no", noLabel || "ไม่มี", <RemoveCircleOutline key="i" sx={{ fontSize: 18, color: FAINT }} />]].map(([v, text, ic]) => (
                <Button key={v} disabled={isLocked} onClick={() => onSetApplicable(type, v === "yes")} startIcon={ic}
                  sx={{
                    textTransform: "none", fontWeight: 700, fontSize: "0.82rem", borderRadius: 2, py: 0.9,
                    color: INK_2, bgcolor: "#fff", border: `1px solid ${LINE}`,
                    "&:hover": { bgcolor: ACCENT_SOFT, borderColor: ACCENT_LINE },
                  }}>
                  {text}
                </Button>
              ))}
            </Box>
            {/* ✅ บอกล่วงหน้าว่าตอบแล้วจะเกิดอะไรต่อ — ลดความลังเลว่าจะกดผิดไหม */}
            <Typography sx={{ fontSize: "0.7rem", color: FAINT, mt: 0.75 }}>
              {yesLabel ? `เลือก “${yesLabel}” แล้วแนบไฟล์ · ` : ""}เลือกแล้วเปลี่ยนทีหลังได้ · ตอบครบทุกช่องจึงจะขอปิดงานได้
            </Typography>
          </>
        ) : applicable === false ? (
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}
            sx={{ px: 1.25, py: 0.75, borderRadius: 2, bgcolor: SURFACE }}>
            {/* ✅ บอกด้วยคำเดียวกับที่ช่างเพิ่งกดเลือกไป (เช่น "ไม่ต้องเสนอราคาเพิ่ม") */}
            <Typography sx={{ fontSize: "0.8rem", color: INK_2, display: "inline-flex", alignItems: "center", gap: 0.6 }}>
              <RemoveCircleOutline sx={{ fontSize: 16, color: FAINT }} />
              {noneText || "ไม่มีเอกสารนี้สำหรับงานนี้"}
            </Typography>
            {!isLocked && (
              <Button size="small" onClick={() => onSetApplicable(type, true)}
                sx={{ textTransform: "none", fontSize: "0.76rem", fontWeight: 700, minWidth: "auto", color: ACCENT, flexShrink: 0 }}>
                เปลี่ยน
              </Button>
            )}
          </Stack>
        ) : (
          <>
            {/* ✅ บอกว่าต้องแนบไฟล์อะไร และไฟล์นั้นถูกเอาไปใช้ต่อที่ไหน */}
            {!hasFiles && hint(uploadHint)}
            {fileList}
            {!hasFiles && !isLocked && (
              <Button size="small" onClick={() => onSetApplicable(type, false)}
                sx={{ textTransform: "none", fontSize: "0.74rem", fontWeight: 600, minWidth: "auto", px: 0.5, mt: 0.5, color: MUTED }}>
                {noLabel ? `เปลี่ยนเป็น “${noLabel}”` : "เปลี่ยนเป็นไม่มี"}
              </Button>
            )}
          </>
        )}
      </Box>
    </Box>
  );
};

// ─── WorkNoteEditor ───────────────────────────────────────────────────
const WorkNoteEditor = ({ eventId, currentNote, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [note,    setNote]    = useState(currentNote || "");
  const [saving,  setSaving]  = useState(false);

  const handleSave = async () => {
    if (!note.trim()) return;
    setSaving(true);
    await onSave(eventId, note.trim());
    setSaving(false);
    setEditing(false);
  };

  if (!editing) {
    return (
      <Box>
        {currentNote ? (
          <Box sx={{
            p: 1.5, borderRadius: 2, border: "1px solid",
            borderColor: alpha("#3b82f6", 0.2),
            background: alpha("#3b82f6", 0.03),
          }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
              <Typography variant="caption" color="text.secondary"
                sx={{ whiteSpace: "pre-line", lineHeight: 1.7, flex: 1 }}>
                {currentNote}
              </Typography>
              <IconButton size="small" onClick={() => { setNote(currentNote); setEditing(true); }}>
                <Edit sx={{ fontSize: 15 }} />
              </IconButton>
            </Stack>
          </Box>
        ) : (
          <ActionBtn
            variant="outlined"
            btncolor="#3b82f6"
            startIcon={<NoteAdd sx={{ fontSize: 16 }} />}
            onClick={() => setEditing(true)}
            fullWidth>
            เขียนสรุปงานที่ทำ
          </ActionBtn>
        )}
      </Box>
    );
  }

  return (
    <Box>
      <TextField
        multiline minRows={3} maxRows={8}
        fullWidth autoFocus
        placeholder="สรุปงานที่ทำ เช่น ตรวจสอบระบบ FA ชั้น 3, เปลี่ยนหัวสปริงเกอร์ 2 หัว..."
        value={note}
        onChange={e => setNote(e.target.value)}
        size="small"
        sx={{
          "& .MuiOutlinedInput-root": { borderRadius: 2, fontSize: "0.85rem" },
          mb: 1,
        }}
      />
      <Stack direction="row" gap={1} justifyContent="flex-end">
        <Button size="small" onClick={() => setEditing(false)}
          sx={{ borderRadius: 2, textTransform: "none", fontSize: "0.78rem" }}>
          ยกเลิก
        </Button>
        <ActionBtn
          variant="contained"
          btncolor="#3b82f6"
          size="small"
          disabled={!note.trim() || saving}
          onClick={handleSave}>
          {saving ? "กำลังบันทึก..." : "บันทึกสรุปงาน"}
        </ActionBtn>
      </Stack>
    </Box>
  );
};

// ─── CommentThread ────────────────────────────────────────────────────
// คุยโต้ตอบกับแอดมิน/manager (เช่น "ขอใบเสนอราคางานนี้") แยกจาก activityLog
// ที่เป็น log อัตโนมัติของระบบ — myRole ใช้กำหนดว่าข้อความฝั่งไหนคือ "ของเรา" (จัดชิดขวา)
const CommentThread = ({ comments = [], onSend, myRole }) => {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    await onSend(message.trim());
    setMessage("");
    setSending(false);
  };

  const isMine = (c) => (myRole === ROLES.TECHNICIAN ? c.role === ROLES.TECHNICIAN : c.role !== ROLES.TECHNICIAN);

  return (
    <Box>
      {comments.length > 0 && (
        <Stack spacing={1} sx={{ mb: 1.5, maxHeight: 280, overflowY: "auto", pr: 0.5 }}>
          {comments.map((c, i) => {
            const mine = isMine(c);
            return (
              <Box key={i} sx={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                <Box sx={{
                  maxWidth: "82%", p: 1.25, borderRadius: 2,
                  bgcolor: mine ? alpha("#3b82f6", 0.12) : alpha("#6b7280", 0.1),
                  borderTopRightRadius: mine ? 4 : 2,
                  borderTopLeftRadius: mine ? 2 : 4,
                }}>
                  <Stack direction="row" gap={0.75} alignItems="center" sx={{ mb: 0.25 }}>
                    <Typography variant="caption" fontWeight={700} color={mine ? "#3b82f6" : "text.secondary"}>
                      {c.userName || (c.role === ROLES.TECHNICIAN ? "ช่าง" : "แอดมิน")}
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      · {moment(c.timestamp).locale("th").format("DD MMM HH:mm")}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-line", wordBreak: "break-word" }}>
                    {c.message}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Stack>
      )}
      <Stack direction="row" gap={1} alignItems="flex-end">
        <TextField
          fullWidth size="small" multiline maxRows={4}
          placeholder="พิมพ์ข้อความถึงแอดมิน เช่น ขอใบเสนอราคางานนี้..."
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, fontSize: "0.85rem" } }}
        />
        <IconButton
          onClick={handleSend}
          disabled={!message.trim() || sending}
          sx={{ border: "1px solid", borderColor: "primary.main", borderRadius: 2, color: "primary.main", flexShrink: 0 }}>
          <Send sx={{ fontSize: 18 }} />
        </IconButton>
      </Stack>
    </Box>
  );
};

// ─── InfoLine ─────────────────────────────────────────────────────────
// ⚠️ InfoLine เดิมของไฟล์นี้ถูกลบออกแล้ว — เป็นสำเนาที่ "ค้างสไตล์เก่า" ไว้ (มีเครื่องหมาย ":" และ
// ป้ายกำกับกับค่าเป็นสีเทาเดียวกันทั้งคู่ ไม่มีการล็อกความกว้างป้ายกำกับ) ในขณะที่การ์ดงานหน้าอื่นถูก
// ปรับไปใช้สไตล์ใหม่หมดแล้ว หน้างานของช่างจึงเป็นหน้าเดียวที่แสดงข้อมูลชุดเดียวกันคนละหน้าตากับที่อื่น
// ✅ เปลี่ยนมาใช้คอมโพเนนต์กลางตัวเดียวกับหน้า "การดำเนินงาน"/"รออนุมัติ" (src/shared/ui/InfoLine.js)

// ─── Main: TechnicianJobCard ──────────────────────────────────────────
const TechnicianJobCard = ({
  event,
  onInputUpdate,
  // ✅ อัปเดตฟิลด์ที่ต้อง "ใช้ร่วมกันทั้งกลุ่ม" (เช่น ขอปิดงาน) — เผื่อไว้ ถ้าไม่ส่งมา fallback ไป
  // onInputUpdate เดิม (แก้แค่ใบเดียว) ดู handleRequestClose ด้านล่างว่าทำไมต้องแยกจาก onInputUpdate
  onStatusUpdate,
  onFileUpload,
  onDeleteFile,
  onPreview,
  uploadingState,
  isUploadingState,
  uploadProgressState,
  // ✅ งานที่เข้าหลายวัน (กลุ่มเดียวกัน) ใช้เอกสาร + ขอปิดงานร่วมกันครั้งเดียวที่การ์ดตัวแทนของกลุ่ม
  // (JobGroupBlock) จึงซ่อนเอกสารประจำงาน/ปุ่มขอปิดงานในการ์ดรายวันที่เหลือไม่ให้ซ้ำ/สับสน
  hideDocuments = false,
  // ✅ เวลาอยู่ในกลุ่มงานหลายวัน JobGroupBlock จะรวมทุกวันไว้ใน JobCard ใบเดียวกันเอง (ห่อจาก
  // ข้างนอก) จึงไม่ต้องมี JobCard/เงา/ระยะห่างซ้อนของตัวเองอีกชั้น
  noOuterCard = false,
}) => {
  const [expanded,        setExpanded]        = useState(false);
  const [docsExpanded,    setDocsExpanded]     = useState(false);
  const [requestingClose, setRequestingClose] = useState(false);
  // ✅ เดิมฝั่งช่างโชว์ประวัติกิจกรรมยาวเหยียดตลอดเวลา ไม่มีปุ่มพับ/กาง ต่างจากฝั่งแอดมิน
  // (ดู ActivityLogMini ใน Operation/index.js) ซึ่งพับไว้เป็นค่าเริ่มต้น กดดูได้เมื่อต้องการ —
  // เพิ่ม toggle แบบเดียวกันให้ฝั่งช่างด้วย
  const [activityLogOpen, setActivityLogOpen] = useState(false);
  // ✅ จอกว้างพอ (≥900px) เปิดส่วน "สรุปงานที่ทำ/คุยกับแอดมิน/ประวัติกิจกรรม" แบบ Dialog ทับขึ้นมา
  // แทนที่จะกางลงในหน้าเดิม (Collapse) — เดิมกางแล้วเนื้อหาดันการ์ดอื่นในคอลัมน์เดียวกันลงมา ต้อง
  // เลื่อนจอตามทั้งที่จอกว้างมีพื้นที่พอจะเปิดลอยทับได้เลยโดยไม่กระทบตำแหน่งการ์ดอื่น (มือถือจอแคบ
  // ยังคงกางลงแบบเดิม เพราะ dialog เต็มจอบนมือถืออยู่แล้วไม่ต่างจากกางอยู่ในหน้า)
  const isDesktop = useMediaQuery("(min-width:900px)");

  // ดึง userName จาก localStorage
  const payload  = JSON.parse(localStorage.getItem("payload") || "{}");
  const userName = payload?.name || payload?.username || "ช่าง";

  // ── push activityLog ─────────────────────────────────────────────
  const pushLog = useCallback(async (action, detail = "") => {
    const newLog = {
      action,
      detail,
      userName,
      timestamp: new Date().toISOString(),
    };
    const updated = [...(event.activityLog || []), newLog];
    await onInputUpdate(event._id, { activityLog: updated });
  }, [event._id, event.activityLog, onInputUpdate, userName]);

  // ── Toggle เอกสาร (ติ๊ก/ยกเลิกติ๊ก) — เฉพาะ Service Report ─────────
  const handleToggleDocument = async (type, checked) => {
    const label = DOCUMENT_TYPES.find(d => d.type === type)?.label || type;
    const newLog = {
      action: "document_checked",
      detail: `${label} ${checked ? "✓ ติ๊กแล้ว" : "ยกเลิกติ๊ก"}`,
      userName,
      timestamp: new Date().toISOString(),
    };
    await onInputUpdate(event._id, {
      [`documentSent${capitalize(type)}`]: checked,
      activityLog: [...(event.activityLog || []), newLog],
    });
  };

  // ── เลือก "มี/ไม่มี" เอกสาร (quotation/invoice/completion) ─────────
  const handleSetApplicable = async (type, applicable) => {
    const label = DOCUMENT_TYPES.find(d => d.type === type)?.label || type;
    const newLog = {
      action: "document_applicable_set",
      detail: `${label}: ${applicable ? "มีเอกสารนี้" : "ไม่มีเอกสารนี้"}`,
      userName,
      timestamp: new Date().toISOString(),
    };
    const updates = {
      [`${type}Applicable`]: applicable,
      activityLog: [...(event.activityLog || []), newLog],
    };
    // ไม่มี = ถือว่าจัดการแล้วทันที / มี = ยังไม่เสร็จจนกว่าจะแนบไฟล์ (เผื่อสลับมาจาก "ไม่มี" เดิม)
    updates[`documentSent${capitalize(type)}`] = applicable === false;
    await onInputUpdate(event._id, updates);
  };

  // ── อัปโหลด/ลบไฟล์เอกสาร (แนบได้หลายไฟล์พร้อมกัน) ───────────────────
  // ⚠️ ไม่บันทึก activityLog ที่นี่แล้ว — onFileUpload/onDeleteFile ทั้งคู่ชี้ไปที่ handler
  // เดียวกันกับฝั่งแอดมิน (ผ่าน JobGroupBlock) ซึ่งย้ายการบันทึก activityLog ไปรวมไว้ที่นั่น
  // แทน (Operation/index.js) เพื่อให้ครอบคลุมทั้งสองฝั่งจากจุดเดียว ไม่ซ้ำซ้อนกัน
  const handleDocFileUpload = (filesOrFileList, type) => {
    onFileUpload(filesOrFileList, event._id, type);
  };

  const handleDocFileDelete = (type, fileId) => {
    onDeleteFile(event._id, type, fileId);
  };

  const completedDocCount = DOCUMENT_TYPES.filter(doc => isDocComplete(event, doc.type)).length;
  // ✅ ป้องกันข้อผิดพลาด — เจอเคสจริงที่งานยังไม่เคยถูกยืนยัน (status ยัง "กำลังรอยืนยัน") แต่ดัน
  // ขอปิดงานไปแล้ว ทำให้ข้อมูลไม่สอดคล้องกัน (badge/รายการไม่ตรงกันในหน้า Operation) — กันไว้ตั้งแต่
  // ต้นทาง ไม่ให้กดขอปิดงานได้เลยถ้า (1) งานยังไม่ได้รับการยืนยัน หรือ (2) ยังไม่ถึงวันทำงานวันสุดท้าย
  // ตามที่นัดหมายไว้ (งานที่ยังไม่เริ่ม/ยังไม่ถึงวันสุดท้ายไม่ควรขอปิดได้ตั้งแต่แรก)
  const isNotConfirmed = event.status === "กำลังรอยืนยัน";
  // ✅ event.end ของงานแบบ allDay ถูกบวกไป 1 วันตอนบันทึก (ค่า end แบบ exclusive ของ FullCalendar)
  // ต้องลบ 1 วันคืนเพื่อหาวันทำงานจริงวันสุดท้าย (เทียบ pattern เดียวกับ formatEventDateRange)
  const lastWorkDay = event.end
    ? moment(event.end).subtract(event.allDay ? 1 : 0, "days").startOf("day")
    : moment(event.start).startOf("day");
  // ✅ อิงวันที่จริงของวันนี้ (startOf("day") ตัดเวลาออก เทียบแค่วันที่) — ปิดงานได้ตั้งแต่วันลงงาน
  // วันสุดท้ายเลย (ไม่ต้องรอเลยไปอีกวัน) แค่ห้ามปิดก่อนถึงวันนั้น (isBefore ไม่รวมวันสุดท้ายเอง)
  const isBeforeLastWorkDay = moment().startOf("day").isBefore(lastWorkDay);
  // ✅ งานที่ยังรออนุมัติ/ถูกปฏิเสธ (ดู approvalStatus) ยังไม่ควรขอปิดได้ — เทียบ operational guard
  // ตัวเดียวกันฝั่ง backend (PUT /:id) กันกดขอปิดแล้วโดน 403 เงียบๆ โดยไม่รู้สาเหตุ
  const canRequestClose = completedDocCount === DOCUMENT_TYPES.length && !isNotConfirmed && !isBeforeLastWorkDay && isApproved(event);
  // ❌ งานที่ admin ปิดแล้ว (ดำเนินการเสร็จสิ้น) ช่างแก้ไข/ลบ/อัปโหลดไฟล์ไม่ได้อีก
  const isLocked = event.status === "ดำเนินการเสร็จสิ้น";

  // ── Request Close (ขอปิดงาน) ──────────────────────────────────────
  // ✅ เดิมใช้ onInputUpdate ซึ่งแก้แค่ event ใบที่กดเท่านั้น — งานที่เข้าหลายวันไม่ติดกัน (กลุ่ม
  // เดียวกันผูกด้วย jobGroupId) ปุ่มนี้กดได้แค่จากการ์ดตัวแทนของกลุ่ม (ดู hideDocuments) แต่พอกดแล้ว
  // มีแค่ "วันนั้นวันเดียว" ที่กลายเป็น closeRequested:true ส่วนวันอื่นในกลุ่มยังเป็นสถานะเดิมอยู่ —
  // ผลคืองานเดียวกันไปโผล่แยกกันคนละแท็บ (วันที่ขอปิดไปอยู่ "รอแอดมินอนุมัติ" ส่วนวันที่เหลือยัง
  // ค้างอยู่ "ค้างงาน"/"งานที่ต้องทำ") ทำให้ช่างเห็นเหมือนมีงานให้เลือกกดปิดหลายรายการทั้งที่จริง
  // เป็นงานเดียว เกิด user error กดซ้ำ/กดผิดใบได้ — ใช้ onStatusUpdate (ถ้ามี) ซึ่งอัปเดตทั้งกลุ่ม
  // พร้อมกันแทน ให้ทั้งงานเข้าสถานะ "รอแอดมินอนุมัติ" ไปด้วยกันทุกวัน
  const handleRequestClose = async () => {
    // ✅ กันไว้อีกชั้น (defense in depth) เผื่อเงื่อนไข UI ด้านล่างหลุดไปด้วยเหตุผลใดก็ตาม (เช่น
    // เปิดค้างไว้หลายแท็บ ข้อมูลไม่ sync ทันเวลา) ไม่ให้ยิง request ออกไปได้ถ้ายังไม่เข้าเงื่อนไขจริง
    if (event.closeRequested || !canRequestClose) return;
    // ✅ ป้องกันกดผิด/กดพลาด — งานนี้จะเข้าสถานะ "รอแอดมินอนุมัติ" ทันทีที่กด (และถ้าเป็นงานกลุ่ม
    // เข้าหลายวัน จะมีผลกับทุกวันในกลุ่มพร้อมกัน ดูคอมเมนต์ด้านบน) ควรให้ยืนยันก่อนอีกชั้น
    const confirm = await Swal.fire({
      title: "ยืนยันขอปิดงาน?",
      text: "งานนี้จะเข้าสถานะ \"รอแอดมินอนุมัติ\" ทันที",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "ขอปิดงาน",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#f59e0b",
    });
    if (!confirm.isConfirmed) return;

    setRequestingClose(true);
    const now = new Date().toISOString();
    await (onStatusUpdate || onInputUpdate)(event._id, {
      closeRequested: true,
      closeRequestedAt: now,
      closeRequestedBy: userName,
      // ✅ เก็บ userId จริงของคนกดขอปิดงานไว้ด้วย เพื่อให้แจ้งเตือน push ตอนอนุมัติ/ไม่อนุมัติ
      // ส่งถึงคนที่กดขอจริงๆ ได้ (resPerson ของงานอาจไม่ตรงกับคนกดขอ เช่น งานมอบหมายผ่านชื่อทีมแบบเก่า)
      closeRequestedByUserId: payload?.userId || "",
    });
    await pushLog("close_requested", "ขอปิดงาน รอแอดมินอนุมัติ");
    setRequestingClose(false);
  };

  // ── Save Work Note ───────────────────────────────────────────────
  const handleSaveNote = async (eventId, note) => {
    await onInputUpdate(eventId, { workNote: note });
    await pushLog("note_saved", note.slice(0, 80) + (note.length > 80 ? "…" : ""));
  };

  // ── Send Comment (คุยกับแอดมิน เช่น "ขอใบเสนอราคางานนี้") ───────────
  // ทำงานได้แม้งานจะปิดแล้ว (isLocked) เพราะ backend อนุญาตให้ comment-only update ผ่านได้เสมอ
  const handleSendComment = async (message) => {
    const newComment = {
      userId: payload?.userId || "",
      userName,
      role: payload?.role || "technician",
      message,
      timestamp: new Date().toISOString(),
    };
    await onInputUpdate(event._id, { comments: [...(event.comments || []), newComment] });
  };

  const statusColor = OP_COLOR[event.status] || "#6b7280";

  // ✅ เช็คลิสต์เอกสารประจำงาน แยกออกมาเป็นตัวแปรเดียว ใช้ร่วมกันทั้งแบบกางลงในหน้า (Collapse บน
  // มือถือ) และแบบ Dialog ทับขึ้นมา (จอกว้าง) เหมือนกับ expandedContent ด้านล่าง
  const docsContent = (
    <Stack spacing={1.25}>
      {DOCUMENT_TYPES.map(doc => (
        <DocumentChecklistItem
          key={doc.type}
          type={doc.type}
          label={doc.label}
          color={doc.color}
          icon={doc.icon}
          event={event}
          alwaysRequired={doc.alwaysRequired}
          desc={doc.desc}
          question={doc.question}
          yesLabel={doc.yesLabel}
          noLabel={doc.noLabel}
          noneText={doc.noneText}
          uploadHint={doc.uploadHint}
          onToggleCheck={handleToggleDocument}
          onSetApplicable={handleSetApplicable}
          onFileUpload={handleDocFileUpload}
          onDeleteFile={handleDocFileDelete}
          onPreview={onPreview}
          isUploading={Boolean(isUploadingState?.[doc.type]) && uploadingState?.[doc.type] === event._id}
          uploadProgress={uploadProgressState?.[doc.type] || 0}
          isLocked={isLocked}
        />
      ))}
    </Stack>
  );

  // ✅ เนื้อหาส่วน "สรุปงานที่ทำ/คุยกับแอดมิน/ประวัติกิจกรรม" แยกออกมาเป็นตัวแปรเดียว ใช้ร่วมกันทั้ง
  // แบบกางลงในหน้า (Collapse บนมือถือ) และแบบ Dialog ทับขึ้นมา (จอกว้าง) ไม่ต้องเขียนซ้ำสองที่
  const expandedContent = (
    <Stack spacing={2}>
      {/* สรุปงาน */}
      <Box>
        <Typography variant="caption" fontWeight={700} color="text.secondary"
          sx={{ textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 1 }}>
          สรุปงานที่ทำ
        </Typography>
        <WorkNoteEditor
          eventId={event._id}
          currentNote={event.workNote}
          onSave={handleSaveNote}
        />
      </Box>

      {/* คุยกับแอดมิน (เช่น ขอใบเสนอราคางานนี้) */}
      <Box>
        <Divider sx={{ mb: 1.5 }} />
        <Typography variant="caption" fontWeight={700} color="text.secondary"
          sx={{ textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
          <Chat sx={{ fontSize: 14 }} /> คุยกับแอดมิน{(event.comments || []).length > 0 && ` (${event.comments.length})`}
        </Typography>
        <CommentThread comments={event.comments} onSend={handleSendComment} myRole="technician" />
      </Box>

      {/* ActivityLog mini (ของช่างเอง) — พับ/กางได้เหมือนฝั่งแอดมิน (ActivityLogMini) */}
      {(event.activityLog || []).length > 0 && (
        <Box>
          <Divider sx={{ mb: 1.5 }} />
          <Button
            size="small"
            startIcon={<History sx={{ fontSize: 14 }} />}
            endIcon={activityLogOpen ? <ExpandLess sx={{ fontSize: 15 }} /> : <ExpandMore sx={{ fontSize: 15 }} />}
            onClick={() => setActivityLogOpen(p => !p)}
            sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.73rem", px: 0, py: 0.25, textTransform: "uppercase", letterSpacing: 0.5 }}>
            ประวัติกิจกรรม ({event.activityLog.length})
          </Button>
          <Collapse in={activityLogOpen}>
            {/* ✅ เดิมโชว์แค่ 5 รายการล่าสุด (แต่ป้ายจำนวนข้างบนนับทั้งหมด ทำให้ดูเหมือนหายไป)
                ตอนนี้โชว์ครบทุกรายการ ให้ตรงกับที่ป้ายบอกไว้ และเห็นครบเหมือนฝั่งแอดมิน */}
            <Stack spacing={0.75} sx={{ mt: 1, pl: 1.5, borderLeft: "2px solid", borderColor: "divider" }}>
              {[...(event.activityLog)].reverse().map((log, i) => (
                <Stack key={i} direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
                  <Typography variant="caption" color="text.disabled">
                    {moment(log.timestamp).format("HH:mm")}
                  </Typography>
                  <Typography variant="caption" fontWeight={600} color="text.secondary">
                    {log.action === "note_saved"             ? "บันทึกสรุปงาน"
                    : log.action === "file_uploaded"          ? "อัปโหลดไฟล์"
                    : log.action === "file_deleted"           ? "ลบไฟล์"
                    : log.action === "document_checked"       ? "ทำเครื่องหมายเอกสาร"
                    : log.action === "document_applicable_set" ? "ระบุมี/ไม่มีเอกสาร"
                    : log.action === "close_requested"        ? "ขอปิดงาน"
                    : log.action}
                  </Typography>
                  {log.detail && (
                    <Typography variant="caption" color="text.disabled" noWrap sx={{ maxWidth: 200 }}>
                      · {log.detail}
                    </Typography>
                  )}
                </Stack>
              ))}
            </Stack>
          </Collapse>
        </Box>
      )}
    </Stack>
  );

  const Wrapper = noOuterCard ? React.Fragment : JobCard;
  // ✅ แถบสีสถานะด้านซ้ายของการ์ด — กวาดตาแยกสถานะได้ทันที (ผู้ใช้: "สีสันจืด")
  const wrapperProps = noOuterCard ? {} : { sx: { borderLeft: `4px solid ${statusColor}` } };

  return (
    <Wrapper {...wrapperProps}>
      <CardContent sx={{ px: { xs: 1.75, sm: 2.5 }, py: { xs: 1.75, sm: 2.5 }, "&:last-child": { pb: { xs: 1.75, sm: 2.5 } } }}>

        {/* ── Header — กดที่ไหนก็ได้บนแถวนี้เพื่อกาง/พับการ์ด ไม่ต้องเล็งกดลูกศรเล็กๆ อีกต่อไป ── */}
        <Stack
          direction="row" alignItems="flex-start" justifyContent="space-between" gap={1.5}
          onClick={() => setExpanded(p => !p)}
          sx={{ cursor: "pointer" }}
        >
          <Stack direction="row" alignItems="flex-start" gap={1.5} flex={1} minWidth={0}>
            {/* ✅ ลดขนาดลงบนจอมือถือ (จอกว้างยังคง 44px เท่าเดิม) — การ์ดตอนนี้เนื้อหากระชับขึ้นแล้ว
                วงกลมไอคอนใหญ่แบบเดิมเลยดูไม่สมส่วนเมื่อเทียบกับตัวหนังสือที่เหลือ */}
            {/* ✅ มือถือซ่อนวงกลมไอคอน — กินคอลัมน์ซ้ายทั้งการ์ด ข้อความถูกบีบ (ผู้ใช้: "มองง่ายขึ้น ไม่รก") */}
            <Avatar sx={{
              display: { xs: "none", sm: "flex" },
              width: { xs: 32, sm: 44 }, height: { xs: 32, sm: 44 }, flexShrink: 0,
              background: alpha(statusColor, 0.14),
              color: statusColor,
            }}>
              {React.cloneElement(TYPE_ICON[event.title] || <Build />, {
                fontSize: "inherit",
                sx: { fontSize: { xs: 16, sm: 22 } },
              })}
            </Avatar>
            <Box minWidth={0} flex={1}>
              {/* ✅ จัดใหม่เป็นรายการ "ไอคอน + ป้ายกำกับ : ค่า" เรียงทีละบรรทัดเรียบๆ (เทียบสไตล์
                  การ์ดงานวางแผนล่วงหน้า) แทนแถว chip เดิมที่ปนกันหลายอย่างในแถวเดียว — สถานะ + วันที่
                  (ย่อแล้ว) ไว้แถวบนสุดด้วยกัน ใช้พื้นที่กว้างๆ ข้างสถานะที่เคยเว้นว่างไว้ให้เกิดประโยชน์
                  ระบบ/ครั้งที่ วางคู่กัน 2 คอลัมน์ ส่วนทีมย้ายไปไว้ล่างสุดของรายการ */}
              <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" mb={0.4}>
                {/* ✅ ป้ายสถานะแบบเรียบ — พื้นเทาอ่อน จุดสีตามสถานะ (ชุดเดียวกับหน้าการดำเนินงาน) */}
                <Box component="span" sx={{
                  display: "inline-flex", alignItems: "center", gap: 0.6, height: 24, px: 1, borderRadius: 999,
                  bgcolor: "#f8fafc", border: "1px solid #e2e8f0", color: "#334155", fontSize: "0.74rem", fontWeight: 700, whiteSpace: "nowrap",
                }}>
                  <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: statusColor }} />
                  {event.status || "ไม่ระบุ"}
                </Box>
                {/* ✅ ย่อช่วงวันที่ให้กระชับ (ดู formatEventDateRange) — ถ้าอยู่ปีเดียวกัน/เดือนเดียวกัน
                    ไม่ต้องพิมพ์เดือนปีซ้ำสองรอบ กันตัดขึ้นบรรทัดใหม่แบบขาดกลางวันที่บนจอแคบด้วย */}
                <Typography variant="caption" color="text.secondary" fontWeight={700} noWrap sx={{ display: "inline-flex", alignItems: "center", gap: 0.4 }}>
                  <CalendarMonth sx={{ fontSize: 14, color: "#94a3b8" }} />{formatEventDateRange(event)}
                </Typography>
                {event.jobGroupId && (
                  <Tooltip title="งานนี้เป็นส่วนหนึ่งของงานหลายวัน (กลุ่มเดียวกัน)">
                    <LinkIcon sx={{ fontSize: 16, color: "#8b5cf6", opacity: 0.8 }} />
                  </Tooltip>
                )}
              </Stack>

              {/* ✅ ตัดวงเล็บ [ ] ครอบชื่องานออก ให้ตรงกับการ์ดงานหน้าอื่นที่ตัดออกไปแล้ว — ไม่ได้สื่อ
                  ความหมายอะไร เป็นแค่สัญลักษณ์ส่วนเกินที่โผล่ทุกการ์ด */}
              {event.title && (
                <Typography fontWeight={800} fontSize="1rem" sx={{ letterSpacing: "-0.01em" }}>
                  {event.title}
                </Typography>
              )}
              <Stack spacing={0.35} sx={{ mt: 0.6 }}>
                {event.system && <InfoLine label="ระบบ">{event.system}</InfoLine>}
                {/* ✅ เดิม `{company || "—"} · {site || "—"}` โชว์ "— · ไซต์" เป็นขีดลอยๆ เวลาช่องใดช่องหนึ่งว่าง */}
                <InfoLine label="โครงการ">
                  {event.company && event.site
                    ? `${event.company} · ${event.site}`
                    : (event.company || event.site || "ไม่ระบุบริษัท/ไซต์")}
                </InfoLine>
                {/* ✅ ย้ายมาไว้ถัดจากโครงการตามที่ขอ (เดิมอยู่คู่กับระบบด้านบนสุด) */}
                {event.time && <InfoLine label="ครั้งที่">{formatRoundLabel(event.time, event.visitCount)}</InfoLine>}
                {(event.startTime || event.endTime) && (
                  <InfoLine label="เวลา">{event.startTime || "-"} — {event.endTime || "-"}</InfoLine>
                )}
                {event.docNo && <InfoLine label="เอกสาร">{event.docNo}</InfoLine>}
                {/* ✅ ทีม อยู่ล่างสุดของรายการ — เพิ่มชื่อลูกทีมเพิ่มเติม (teamMembers) ต่อท้ายชื่อทีม/
                    หัวหน้าทีมด้วย (เดิมมีแค่ event.team ตัวเดียว ไม่เห็นลูกทีมที่เพิ่มมาเลย) กันชื่อซ้ำ
                    ด้วย filter dedupe (เทียบ pattern เดียวกับ teamDisplay ใน EventCalendar/index.js) */}
                {(() => {
                  const teamNames = [event.team, ...(event.teamMembers || []).map(m => m?.name)]
                    .filter(Boolean)
                    .filter((name, idx, arr) => arr.indexOf(name) === idx);
                  return teamNames.length > 0 && (
                    <InfoLine label="ทีม">{teamNames.join(", ")}</InfoLine>
                  );
                })()}
              </Stack>
            </Box>
          </Stack>
          {/* ✅ ไม่มี onClick ของตัวเองแล้ว — แค่ไอคอนบอกว่ากดดูรายละเอียดได้ ตัวกดจริงคือทั้งแถว
              Header (คลิกบับเบิลขึ้นมาถึงเอง) — เดิมใช้ลูกศรชี้ลง/ขึ้นสื่อถึงการกางเนื้อหาลงในหน้า
              แต่ตอนนี้เปิดเป็น Dialog ทับขึ้นมาแทนแล้ว เปลี่ยนเป็นลูกศรชี้ขวาให้ตรงกับพฤติกรรมจริง */}
          <ChevronRight sx={{ fontSize: 22, color: "#cbd5e1", flexShrink: 0, mt: 0.25 }} />
        </Stack>

        {/* ── เอกสารประจำงาน + ขอปิดงาน: ซ่อนถ้างานนี้ใช้เอกสารร่วมกับกลุ่ม (แสดงที่การ์ดตัวแทนแทน) ── */}
        {!hideDocuments && (
        <>
        <Box sx={{ mt: 1.5 }}>
          <Box
            onClick={() => setDocsExpanded(p => !p)}
            sx={{
              cursor: "pointer", px: 1.5, py: 1.1, borderRadius: 2,
              border: "1px solid", borderColor: "divider",
              "&:active": { bgcolor: alpha("#6b7280", 0.06) },
              "&:hover": { borderColor: canRequestClose ? "#10b981" : "#3b82f6" },
            }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
              <Typography variant="body2" fontWeight={800} sx={{ fontSize: "0.84rem", color: "#334155", display: "inline-flex", alignItems: "center", gap: 0.6 }}>
                <Description sx={{ fontSize: 17, color: "#64748b" }} /> เอกสารประจำงาน
                {isLocked && <Lock sx={{ fontSize: 14, color: "#94a3b8" }} />}
              </Typography>
              <Stack direction="row" alignItems="center" gap={0.5}>
                <Typography variant="body2" fontWeight={800} color={canRequestClose ? "#10b981" : "text.secondary"}>
                  {completedDocCount}/{DOCUMENT_TYPES.length}
                </Typography>
                {/* ✅ เดิมใช้ลูกศรชี้ลง/ขึ้นสื่อถึงการกางลงในหน้า แต่ตอนนี้เปิดเป็น Dialog ทับขึ้นมา
                    แทนแล้ว เปลี่ยนเป็นลูกศรชี้ขวาให้ตรงกับพฤติกรรมจริง */}
                <ChevronRight sx={{ fontSize: 22, color: "text.secondary" }} />
              </Stack>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={(completedDocCount / DOCUMENT_TYPES.length) * 100}
              sx={{
                height: 6, borderRadius: 5,
                bgcolor: alpha("#6b7280", 0.12),
                "& .MuiLinearProgress-bar": {
                  bgcolor: canRequestClose ? "#10b981" : "#3b82f6",
                  borderRadius: 5,
                },
              }}
            />
          </Box>

          {/* ✅ เปิดเป็น Dialog ทับขึ้นมาเสมอ ไม่ว่าจอเล็ก/ใหญ่ (ดู docsExpanded Dialog ด้านล่าง)
              แทนการกางลงในหน้าแบบเดิม — จอมือถือก็ไม่ต้องเลื่อนจอตามอีกต่อไป */}
        </Box>

        {/* ── Request Close (ขอปิดงาน) ── */}
        {event.status === "ดำเนินการเสร็จสิ้น" ? (
          <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap" sx={{
            mt: 1.5, px: 1.5, py: 0.8, borderRadius: 2, bgcolor: alpha("#10b981", 0.08),
          }}>
            <TaskAlt sx={{ fontSize: 16, color: "#10b981" }} />
            <Typography variant="caption" fontWeight={700} color="#10b981">
              แอดมินอนุมัติปิดงานแล้ว
            </Typography>
            {event.closeApprovedAt && (
              <Typography variant="caption" color="text.disabled">
                · {moment(event.closeApprovedAt).locale("th").format("DD MMM HH:mm")}
              </Typography>
            )}
          </Stack>
        ) : event.closeRequested ? (
          <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap" sx={{
            mt: 1.5, px: 1.5, py: 0.8, borderRadius: 2, bgcolor: alpha("#f59e0b", 0.08),
          }}>
            <HourglassTop sx={{ fontSize: 16, color: "#f59e0b" }} />
            <Typography variant="caption" fontWeight={700} color="#f59e0b">
              รอแอดมินอนุมัติปิดงาน
            </Typography>
            {event.closeRequestedAt && (
              <Typography variant="caption" color="text.disabled">
                · ขอเมื่อ {moment(event.closeRequestedAt).locale("th").format("DD MMM HH:mm")}
              </Typography>
            )}
          </Stack>
        ) : canRequestClose ? (
          <Box sx={{ mt: 1.5 }}>
            {event.closeRejectReason && (
              <Box sx={{
                mb: 1, p: 1.25, borderRadius: 2,
                bgcolor: alpha("#ef4444", 0.08), border: "1px solid", borderColor: alpha("#ef4444", 0.25),
              }}>
                <Stack direction="row" alignItems="center" gap={0.5}>
                  <Cancel sx={{ fontSize: 15, color: "#ef4444" }} />
                  <Typography variant="caption" fontWeight={700} color="#ef4444">
                    แอดมินไม่อนุมัติคำขอก่อนหน้า
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.3, wordBreak: "break-word" }}>
                  "{event.closeRejectReason}"
                </Typography>
              </Box>
            )}
            <ActionBtn
              variant="contained"
              btncolor="#f59e0b"
              startIcon={<TaskAlt sx={{ fontSize: 16 }} />}
              onClick={handleRequestClose}
              disabled={requestingClose}
              fullWidth>
              {requestingClose ? "กำลังส่งคำขอ..." : event.closeRejectReason ? "ขอปิดงานอีกครั้ง" : "ขอปิดงาน"}
            </ActionBtn>
          </Box>
        ) : isNotConfirmed ? (
          <Box sx={{
            mt: 1.5, p: 1.25, borderRadius: 2,
            bgcolor: alpha("#ef4444", 0.08), border: "1px solid", borderColor: alpha("#ef4444", 0.25),
          }}>
            <Stack direction="row" alignItems="center" gap={0.5}>
              <Warning sx={{ fontSize: 15, color: "#ef4444" }} />
              <Typography variant="caption" fontWeight={700} color="#ef4444">
                งานนี้ยังไม่ได้รับการยืนยัน ต้องรอยืนยันก่อนจึงจะขอปิดงานได้
              </Typography>
            </Stack>
          </Box>
        ) : isBeforeLastWorkDay ? (
          <Box sx={{
            mt: 1.5, p: 1.25, borderRadius: 2,
            bgcolor: alpha("#ef4444", 0.08), border: "1px solid", borderColor: alpha("#ef4444", 0.25),
          }}>
            <Stack direction="row" alignItems="center" gap={0.5}>
              <Warning sx={{ fontSize: 15, color: "#ef4444" }} />
              <Typography variant="caption" fontWeight={700} color="#ef4444">
                ขอปิดงานได้ตั้งแต่วันที่ {formatThai(lastWorkDay, "DD MMM YYYY")} เป็นต้นไป
              </Typography>
            </Stack>
          </Box>
        ) : !isApproved(event) ? (
          <Box sx={{
            mt: 1.5, p: 1.25, borderRadius: 2,
            bgcolor: alpha("#f59e0b", 0.08), border: "1px solid", borderColor: alpha("#f59e0b", 0.25),
          }}>
            <Stack direction="row" alignItems="center" gap={0.5}>
              <HourglassTop sx={{ fontSize: 15, color: "#f59e0b" }} />
              <Typography variant="caption" fontWeight={700} color="#f59e0b">
                งานนี้ยังไม่ได้รับการอนุมัติจากแอดมิน/manager ต้องรอผลอนุมัติก่อนจึงจะขอปิดงานได้
              </Typography>
            </Stack>
          </Box>
        ) : (
          <Typography variant="caption" color="text.disabled"
            onClick={() => setDocsExpanded(true)}
            sx={{ display: "block", mt: 1.5, textAlign: "center", cursor: "pointer", "&:hover": { textDecoration: "underline" } }}>
            จัดการเอกสารให้ครบก่อน จึงจะขอปิดงานได้ ({completedDocCount}/{DOCUMENT_TYPES.length})
          </Typography>
        )}
        </>
        )}

        {/* ── Expanded: WorkNote + ActivityLog ──
            ✅ เปิดเป็น Dialog ทับขึ้นมาเสมอ (ดู Dialog ด้านล่าง) ไม่ว่าจอเล็ก/ใหญ่ ไม่ต้องกางลงดัน
            การ์ดอื่น/เลื่อนจอตามอีกต่อไป — จอเล็ก (มือถือ) เปิดแบบเต็มจอ (fullScreen) แทนกล่องลอย */}

      </CardContent>

      <Dialog open={expanded} onClose={() => setExpanded(false)} fullWidth maxWidth="sm" fullScreen={!isDesktop}>
          <DialogTitle sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              {/* ✅ สลับตำแหน่ง: ประเภทงานขึ้นเป็นหัวข้อหลัก (ไม่ใส่ label "ประเภท" เพราะเป็นหัวข้อ
                  อยู่แล้วเหมือนที่โครงการเคยอยู่ตำแหน่งนี้), โครงการย้ายลงไปอยู่แถวข้อมูลแทน */}
              <Typography fontWeight={800} fontSize="1rem" noWrap>
                {event.title || "ไม่ระบุประเภทงาน"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                สรุปงานที่ทำ · คุยกับแอดมิน
              </Typography>
              {(event.company || event.site || event.system || event.time) && (
                <Stack direction="row" gap={2} flexWrap="wrap" sx={{ mt: 0.5 }}>
                  <InfoLine label="โครงการ">
                    {event.company && event.site ? `${event.company} · ${event.site}` : (event.company || event.site || "ไม่ระบุบริษัท/ไซต์")}
                  </InfoLine>
                  {event.system && <InfoLine label="ระบบ">{event.system}</InfoLine>}
                  {event.time && <InfoLine label="ครั้งที่">{formatRoundLabel(event.time, event.visitCount)}</InfoLine>}
                </Stack>
              )}
            </Box>
            <IconButton size="small" onClick={() => setExpanded(false)}>
              <Close fontSize="small" />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            {expandedContent}
          </DialogContent>
        </Dialog>

      {!hideDocuments && (
        <Dialog open={docsExpanded} onClose={() => setDocsExpanded(false)} fullWidth maxWidth="sm" fullScreen={!isDesktop}
          PaperProps={{ sx: { borderRadius: { xs: 0, sm: 3 } } }}>
          {/* ✅ หัวกระชับ: ชื่องาน · โครงการ/ระบบ/ครั้งที่ 1 บรรทัด · ความคืบหน้า + บอกว่าต้องครบกี่ช่องจึงขอปิดงานได้ */}
          <Box sx={{ px: { xs: 2, sm: 2.5 }, pt: 2, pb: 1.75, borderBottom: `1px solid ${LINE}` }}>
            <Stack direction="row" alignItems="flex-start" gap={1}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: MUTED, letterSpacing: 0.2 }}>เอกสารประจำงาน</Typography>
                <Typography noWrap sx={{ fontWeight: 800, fontSize: "1.05rem", color: INK, lineHeight: 1.35 }}>
                  {event.title || "ไม่ระบุประเภทงาน"}
                </Typography>
                {(() => {
                  const place = [event.company && event.site ? `${event.company} · ${event.site}` : (event.company || event.site),
                    event.system, event.time ? `ครั้งที่ ${formatRoundLabel(event.time, event.visitCount)}` : ""].filter(Boolean).join(" · ");
                  return place ? <Typography sx={{ fontSize: "0.8rem", color: INK_2, mt: 0.25 }}>{place}</Typography> : null;
                })()}
              </Box>
              <IconButton size="small" onClick={() => setDocsExpanded(false)} aria-label="ปิด" sx={{ color: MUTED, mr: -0.5 }}>
                <Close fontSize="small" />
              </IconButton>
            </Stack>
            <Stack direction="row" alignItems="center" gap={1.25} sx={{ mt: 1.5 }}>
              <LinearProgress
                variant="determinate"
                value={(completedDocCount / DOCUMENT_TYPES.length) * 100}
                sx={{
                  flex: 1, height: 6, borderRadius: 5, bgcolor: "#f1f5f9",
                  "& .MuiLinearProgress-bar": { bgcolor: completedDocCount === DOCUMENT_TYPES.length ? SUCCESS : ACCENT, borderRadius: 5 },
                }}
              />
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: completedDocCount === DOCUMENT_TYPES.length ? "#15803d" : INK_2, whiteSpace: "nowrap" }}>
                {completedDocCount}/{DOCUMENT_TYPES.length} รายการ
              </Typography>
            </Stack>
            <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 0.5 }}>
              {isLocked
                ? "งานนี้ปิดแล้ว — ดูเอกสารได้อย่างเดียว"
                : completedDocCount === DOCUMENT_TYPES.length
                ? "ทำเอกสารทุกรายการเรียบร้อยแล้ว — กลับไปที่การ์ดงานเพื่อกด “ขอปิดงาน”"
                : `เหลืออีก ${DOCUMENT_TYPES.length - completedDocCount} รายการ · ต้องแนบหรือตอบทุกรายการจึงจะขอปิดงานได้`}
            </Typography>
          </Box>
          <DialogContent sx={{ bgcolor: SURFACE, px: { xs: 1.5, sm: 2.5 }, py: 2 }}>
            {docsContent}
          </DialogContent>
        </Dialog>
      )}
    </Wrapper>
  );
};

export default TechnicianJobCard;
