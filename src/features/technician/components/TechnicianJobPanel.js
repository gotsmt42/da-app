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

import { isDocRequired, isDocComplete } from "@/shared/utils/jobDocTypes";
import React, { useState, useRef, useCallback } from "react";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import Swal from "@/shared/ui/swal";
import { formatEventDateRange } from "@/shared/utils/formatDateRange";
import { isApproved } from "@/shared/utils/approvalStatus";
import { formatRoundLabel } from "@/shared/utils/contractRounds";
import {
  Box, Card, CardContent, Typography, Stack, Avatar,
  Button, IconButton, TextField, Collapse, Divider, LinearProgress,
  Tooltip, Menu, MenuItem, ListItemIcon, ListItemText,
  Dialog, DialogContent, useMediaQuery, ButtonBase,
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
  RemoveCircleOutline, CheckBox, CheckBoxOutlineBlank,
  RadioButtonUnchecked,
} from "@mui/icons-material";
import { INK, INK_2, MUTED, FAINT, LINE, SURFACE, ACCENT, ACCENT_SOFT, ACCENT_LINE, SUCCESS } from "@/shared/ui/PageKit";
import { printFile, shareFile, isMobileDevice } from "@/shared/utils/fileActions";
import InfoLine from "@/shared/ui/InfoLine";
import { formatThai } from "@/shared/utils/thaiDate";
import { ROLES, can } from "@/shared/utils/roles";
import EventService from "@/shared/services/EventService";
import { useAuth } from "@/features/auth/AuthContext";
import { JobFlowChips, JobFlowPanel, nextStepOf } from "@/shared/ui/JobFlow";
import MobileJobSummary from "@/shared/ui/MobileJobSummary";
import ServiceReportAiBar from "@/features/documents/components/ServiceReportAiBar";
import MobileSheet from "@/shared/ui/MobileSheet";
import SitePhotos from "@/shared/ui/SitePhotos";
import { AssignResponsibleMenu, PersonChip } from "@/shared/ui/PersonChip";
import CheckInOutPanel, { jobStepOf } from "@/features/attendance/components/CheckInOutPanel";
import { docsUnlocked } from "@/shared/utils/jobFlow";
import { BTN as MBTN, CARD } from "@/shared/ui/modernUi";
import { confirmDelete } from "@/shared/ui/swal";

// ✅ ใช้ตัดสินใจลำดับปุ่มแชร์ในเมนู "⋮" ต่อไฟล์ (ดูเหตุผลใน fileActions.js)
const IS_MOBILE = isMobileDevice();

// ✅ เดิม MUI Menu เปิดช้า/รู้สึกหน่วง เพราะ transition คำนวณตามความสูงเมนู (auto) และมีการ
// ล็อกสกรอลของหน้าทุกครั้งที่เปิด — ลด duration ลงคงที่ + ปิด scroll lock ให้ลื่นขึ้น
const FAST_MENU_PROPS = {
  transitionDuration: { enter: 120, exit: 80 },
  disableScrollLock: true,
};

/**
 * ✅ (11 ต.ค. 2569 ผู้ใช้: "ให้ช่างกดรับทราบงาน และยืนยันนัดก่อน เมนูเอกสารงานถึงจะขึ้นมาแสดง")
 * แถบแทนกล่องเอกสาร ตอนยังไม่ครบขั้น — บอกว่าทำไมยังไม่เห็น (ไม่ให้ดูเหมือนข้อมูลหาย)
 */
const DocsLockedRow = ({ event }) => (
  <Stack direction="row" alignItems="center" gap={0.85} sx={{ mt: 1.5, px: 1.5, py: 1.1, borderRadius: "12px", border: "1px dashed #cbd5e1", bgcolor: "#f8fafc" }}>
    <Lock sx={{ fontSize: 17, color: "#94a3b8", flexShrink: 0 }} />
    <Typography sx={{ fontSize: "0.8rem", color: "#475569", lineHeight: 1.45 }}>
      <b style={{ fontWeight: 600 }}>เอกสารประจำงาน</b> · แสดงหลังผู้รับผิดชอบ{(event?.acks || []).length ? "" : "กดรับทราบงานและ"}ยืนยันนัดหมาย
    </Typography>
  </Stack>
);

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

// ✅ เอกสารชนิดนี้ "บังคับต้องมี" สำหรับงานนี้ไหม — ต่างจากเดิมที่ผูกกับชนิดเอกสารตายตัวอย่างเดียว
// (report เท่านั้นที่บังคับ) ตอนนี้ขึ้นกับประเภทงานด้วยตามที่ผู้ใช้กำหนด:
//   • Service Report — บังคับทุกงานเหมือนเดิม
//   • ใบวางบิล / ใบส่งมอบงาน — บังคับเฉพาะงาน PM (งานอื่นยังเลือก "มี/ไม่มี" ได้ตามเดิม)
//   • ใบเสนอราคา — ไม่บังคับทุกกรณี (มีงานเพิ่มเติมค่อยเสนอ)
// ⚠️ ย้ายไป shared/utils/jobDocTypes.js (ใช้ร่วมกับตาราง) — re-export ไว้ให้ที่ import เดิมยังใช้ได้
export { isDocRequired, isDocComplete };

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
  // 🐛 (20 ต.ค. 2569 ผู้ใช้: "กดแล้วเด้งๆ กระพริบ") มือถือแตะแล้ว hover ค้าง — ยกการ์ดเฉพาะอุปกรณ์ที่มีเมาส์
  "@media (hover: hover) and (pointer: fine)": {
    "&:hover": {
      transform: "translateY(-3px)",
      boxShadow: `0 10px 28px ${alpha(theme.palette.common.black, 0.16)}`,
      borderColor: alpha(theme.palette.primary.main, 0.3),
    },
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
  // 🔁 (21 ต.ค. 2569) ส่งไฟล์ทั้งช่องให้กล่องดูไฟล์ เลื่อนดูไฟล์อื่นได้เลย (reference คงที่ — FileRow memo)
  const listRef = useRef(fileList);
  listRef.current = fileList;
  const previewInSection = useCallback((url, name) => onPreview?.(url, name, listRef.current), [onPreview]);

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
            <FileRow key={f._id || f.fileUrl} file={f} onPreview={previewInSection} onOpenMenu={handleOpenFileMenu} />
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
          </>
        ) : (
          <>
            <MenuItem onClick={() => { shareFile(fileMenu.file.fileUrl, fileMenu.file.fileName); closeFileMenu(); }} sx={{ gap: 1.5, minHeight: 44 }}>
              <ListItemIcon><Share fontSize="small" /></ListItemIcon>
              <ListItemText>แชร์ไฟล์</ListItemText>
            </MenuItem>
          </>
        )}
        {!isLocked && [
          <Divider key="file-menu-divider" />,
          <MenuItem key="file-menu-delete" onClick={async () => { const f = fileMenu.file; closeFileMenu(); if (await confirmDelete({ name: f.fileName })) onDeleteFile(type, f._id); }} sx={{ gap: 1.5, minHeight: 44, color: "error.main" }}>
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
              width: "100%", display: "flex", alignItems: "center", gap: 1, minHeight: 40,
              px: 1.5, borderRadius: 2, cursor: "pointer", font: "inherit", textAlign: "left",
              border: `1px dashed ${ACCENT_LINE}`, bgcolor: "#fff", color: ACCENT,
              transition: "background-color .15s, border-color .15s, color .15s",
              "&:hover": { bgcolor: ACCENT_SOFT, borderColor: ACCENT },
            }}>
            <CloudUpload sx={{ fontSize: 19, color: "inherit" }} />
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

  // ✅ (11 ต.ค. 2569 ผู้ใช้: "หน้าเอกสารงานของช่างยังดูรกๆ ปรับปรุง")
  //    เดิม: ไอคอนสีคนละสีทุกชนิด · ป้าย "บังคับ/ถ้ามี" · ป้ายสถานะพื้นสี · คำอธิบายยาว 2-3 บรรทัด · คำใบ้ซ้ำใต้ปุ่ม
  //    ✅ ตอนนี้: วงกลมสถานะทางซ้าย (✓ เขียว = เสร็จ · ⊖ เทา = ไม่มี · ○ = ยังไม่ทำ) + ชื่อ + ข้อความสถานะสั้นทางขวา
  //       คำอธิบายบรรทัดเดียวเฉพาะช่องที่ยังไม่เสร็จ · เนื้อหา (แนบไฟล์/ตอบคำถาม) เยื้องตรงกับชื่อ · ไม่มีคำใบ้ซ้ำ
  const notApplicable = complete && applicable === false && !alwaysRequired && !requiredByJobType;
  const required = alwaysRequired || requiredByJobType;
  const state = notApplicable ? { text: "ไม่มี", fg: MUTED }
    : complete ? { text: `แนบแล้ว ${files.length} ไฟล์`, fg: "#15803d" }
    : alwaysRequired && hasFiles ? { text: "รอยืนยัน", fg: "#b45309" }
    : required || applicable === true ? { text: "ต้องแนบไฟล์", fg: "#b45309" }
    : { text: "รอตอบ", fg: MUTED };
  const statusIcon = notApplicable ? <RemoveCircleOutline sx={{ fontSize: 22, color: FAINT }} />
    : complete ? <CheckCircle sx={{ fontSize: 22, color: SUCCESS }} />
    : <RadioButtonUnchecked sx={{ fontSize: 22, color: "#cbd5e1" }} />;
  const sub = requiredByJobType && !complete ? "งาน PM ต้องแนบทุกครั้ง" : !complete ? desc : "";
  const fileList = (
    <>
      <DocumentFileList
        type={type} files={files}
        isUploading={isUploading} uploadProgress={uploadProgress}
        onFileUpload={onFileUpload} onDeleteFile={onDeleteFile} onPreview={onPreview}
        isLocked={isLocked}
      />
      {/* ✅ (25 ต.ค. 2569) Service Report: ให้ AI อ่านใบแล้วสรุป → ตรวจ/แก้ → ออก PDF สรุปรายงานบริการ */}
      {type === "report" && hasFiles && <ServiceReportAiBar event={event} sx={{ mt: 0.5 }} />}
    </>
  );
  const linkBtn = (text, onClick) => (
    <Button size="small" onClick={onClick}
      sx={{ textTransform: "none", fontSize: "0.76rem", fontWeight: 700, minWidth: "auto", px: 0.75, py: 0.25, color: ACCENT, flexShrink: 0 }}>
      {text}
    </Button>
  );

  return (
    <Box sx={{ borderRadius: "14px", bgcolor: "#fff", border: `1px solid ${LINE}`, px: 1.5, py: 1.35 }}>
      {/* ── หัว: วงกลมสถานะ · ชื่อ (* = บังคับ) · ข้อความสถานะ ── */}
      <Stack direction="row" alignItems="center" gap={1.1}>
        {statusIcon}
        <Typography sx={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: "0.92rem", color: notApplicable ? MUTED : INK, lineHeight: 1.3 }}>
          {label}{required && <Box component="span" sx={{ color: "#dc2626", ml: 0.25 }}>*</Box>}
        </Typography>
        <Typography sx={{ fontSize: "0.74rem", fontWeight: 600, color: state.fg, whiteSpace: "nowrap" }}>{state.text}</Typography>
      </Stack>

      <Box sx={{ pl: "34px" }}>
        {sub && (
          <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.45, mt: 0.25,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{sub}</Typography>
        )}

        {alwaysRequired ? (
          <Box sx={{ mt: 1 }}>
            {fileList}
            {/* การยืนยัน — ช่องติ๊กบรรทัดเดียว (ไม่ทำเป็นกล่อง ไม่ให้ดูเหมือนปุ่ม) */}
            <Stack direction="row" alignItems="center" gap={0.75} role="checkbox" aria-checked={checked}
              onClick={!isLocked ? () => onToggleCheck(type, !checked) : undefined}
              sx={{ mt: 0.75, py: 0.4, cursor: isLocked ? "default" : "pointer", opacity: isLocked ? 0.7 : 1, width: "fit-content" }}>
              {checked ? <CheckBox sx={{ fontSize: 21, color: ACCENT }} /> : <CheckBoxOutlineBlank sx={{ fontSize: 21, color: FAINT }} />}
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: INK_2 }}>ยืนยันว่า Service Report ครบถ้วนแล้ว</Typography>
            </Stack>
            {checked && !hasFiles && (
              <Typography sx={{ fontSize: "0.72rem", color: "#b45309", fontWeight: 600 }}>ยังไม่มีไฟล์ — แนบไฟล์ก่อนจึงจะนับว่าครบ</Typography>
            )}
          </Box>
        ) : requiredByJobType ? (
          <Box sx={{ mt: 1 }}>{fileList}</Box>
        ) : applicable === null || applicable === undefined ? (
          <Box sx={{ mt: 0.85 }}>
            <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: INK_2, mb: 0.75 }}>
              {question || "งานนี้มีเอกสารนี้หรือไม่?"}
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75 }}>
              {[["yes", yesLabel || "มี"], ["no", noLabel || "ไม่มี"]].map(([v, text]) => (
                <Button key={v} variant="outlined" disabled={isLocked} onClick={() => onSetApplicable(type, v === "yes")}
                  sx={{ ...MBTN.outline(v === "yes" ? ACCENT : "#64748b"), minHeight: 36, fontSize: "0.8rem" }}>
                  {text}
                </Button>
              ))}
            </Box>
          </Box>
        ) : applicable === false ? (
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} sx={{ mt: 0.25 }}>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{noneText || "ไม่มีเอกสารนี้สำหรับงานนี้"}</Typography>
            {!isLocked && linkBtn("เปลี่ยน", () => onSetApplicable(type, true))}
          </Stack>
        ) : (
          <Box sx={{ mt: 1 }}>
            {fileList}
            {!hasFiles && !isLocked && (
              <Box sx={{ mt: 0.5, ml: -0.75 }}>{linkBtn(noLabel ? `เปลี่ยนเป็น “${noLabel}”` : "เปลี่ยนเป็นไม่มี", () => onSetApplicable(type, false))}</Box>
            )}
          </Box>
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
  userData,
  employees = [],
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
  // ✅ ขั้นตอนทำงาน (รับทราบงาน/งานไม่เสร็จ) — server คืนงานทั้งกลุ่ม ให้หน้าแม่เอาไปแทนในรายการ
  onPatched,
  // แสดงเต็ม (ใช้ในหน้าต่างเต็มจอบนมือถือ)
  inSheet = false,
}) => {
  const [docsExpanded,    setDocsExpanded]     = useState(false);
  // ✅ (11 ต.ค. 2569 ผู้ใช้: "เอกสารงานหรืออะไรที่จำเป็นให้แสดงด้านนอกได้เลย" + "ให้ส่วนนี้กดเปิดขึ้นไปอีกหน้าแทนแบบเดิม คงไว้ถึงเอกสารงาน")
  //    บนการ์ด (เห็นเสมอ): หัวการ์ด · ขั้นตอน/ปุ่มเข้างาน · เอกสารประจำงาน · ขอปิดงาน
  //    อีกหน้า (กดหัวการ์ด หรือแถบ "ไฟล์แนบ · สรุปงาน · …"): ไฟล์แนบ · สรุปงานที่ทำ · คุยกับแอดมิน · ประวัติกิจกรรม
  const [detailsOpen, setDetailsOpen] = useState(false);
  // ✅ (20 ต.ค. 2569 ผู้ใช้: "รายละเอียดกดแล้วให้เด้งมาทับแทนเลื่อนลง") มือถือ: การ์ดย่อ (ปุ่มรับทราบ/เข้างานอยู่บนการ์ด)
  //    กดการ์ด = เปิดการ์ดเต็มทับขึ้นมาเต็มจอ · ในหน้าต่างนั้นแสดงเต็มเสมอ (inSheet)
  const mOpen = inSheet;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [requestingClose, setRequestingClose] = useState(false);
  // ✅ เดิมฝั่งช่างโชว์ประวัติกิจกรรมยาวเหยียดตลอดเวลา ไม่มีปุ่มพับ/กาง ต่างจากฝั่งแอดมิน
  // (ดู ActivityLogMini ใน Operation/index.js) ซึ่งพับไว้เป็นค่าเริ่มต้น กดดูได้เมื่อต้องการ —
  // เพิ่ม toggle แบบเดียวกันให้ฝั่งช่างด้วย
  const [activityLogOpen, setActivityLogOpen] = useState(false);
  const [teamAnchor, setTeamAnchor] = useState(null);
  // ✅ จอกว้างพอ (≥900px) เปิดส่วน "สรุปงานที่ทำ/คุยกับแอดมิน/ประวัติกิจกรรม" แบบ Dialog ทับขึ้นมา
  // แทนที่จะกางลงในหน้าเดิม (Collapse) — เดิมกางแล้วเนื้อหาดันการ์ดอื่นในคอลัมน์เดียวกันลงมา ต้อง
  // เลื่อนจอตามทั้งที่จอกว้างมีพื้นที่พอจะเปิดลอยทับได้เลยโดยไม่กระทบตำแหน่งการ์ดอื่น (มือถือจอแคบ
  // ยังคงกางลงแบบเดิม เพราะ dialog เต็มจอบนมือถืออยู่แล้วไม่ต่างจากกางอยู่ในหน้า)
  const isDesktop = useMediaQuery("(min-width:900px)");

  // ดึง userName จาก localStorage
  const payload  = JSON.parse(localStorage.getItem("payload") || "{}");
  const userName = payload?.name || payload?.username || "ช่าง";
  // แอดมิน/ผู้จัดการ (editAnyJob) ขอปิดงานได้โดยไม่ต้องผ่านการตรวจเอกสารด้วย AI (เซิร์ฟเวอร์ใช้เกณฑ์เดียวกัน)
  const { userData: authUser } = useAuth();
  const isAdminOrManager = can(authUser, "editAnyJob");

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
    /**
     * ✅ (26 ต.ค. 2569 ผู้ใช้: "ให้ AI อ่าน Service Report อัตโนมัติ ถ้าพบอุปกรณ์เสีย/ต้องเสนอราคา ต้องอัพใบเสนอราคาก่อนจึงปิดงานได้"
     *    · "ตรวจเอกสารที่อัพผิดประเภทของแต่ละช่อง บังคับไม่ให้ปิดงาน อธิบายให้ชัดเจน แต่ยังขอปิดกับแอดมินได้ถ้าเอกสารไม่มีจริงๆ")
     *    ขั้นแรก: AI ตรวจเอกสารทุกช่อง (ครั้งเดียวต่อชุดไฟล์ — ไฟล์ไม่เปลี่ยน = ผลเดิมทันที ไม่เสีย AI)
     *    ไม่ผ่าน → บอกทีละข้อว่าผิดอะไร แก้ยังไง · ทางเลือก: แก้เอกสาร หรือ ขอให้แอดมินพิจารณาปิดงาน (ต้องใส่เหตุผล)
     */
    let check = null;
    if (!isAdminOrManager) {
      Swal.fire({ title: "AI กำลังตรวจเอกสาร…", text: "ตรวจประเภทเอกสารทุกช่อง และอ่าน Service Report — อาจใช้เวลาสักครู่", allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });
      try {
        check = await EventService.CloseCheck(event._id);
        Swal.close();
      } catch (err) {
        Swal.fire({ icon: "error", title: "ตรวจเอกสารไม่สำเร็จ", text: err?.response?.data?.message || "กรุณาลองใหม่อีกครั้ง" });
        return;
      }
    }
    let overrideReason = "";
    if (check && !check.ok) {
      const esc = (t) => String(t || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
      const html = `<div style="text-align:left;font-size:14px;line-height:1.55">
        <div style="margin-bottom:8px;color:#475569">แก้ตามรายการด้านล่างแล้วกด “ขอปิดงาน” อีกครั้ง</div>
        <ol style="margin:0;padding-left:20px">${(check.problems || []).map((p) => `<li style="margin-bottom:8px"><b style="color:#b91c1c">${esc(p.slotLabel)}</b> — ${esc(p.text)}${(p.items || []).length ? `<ul style="margin:4px 0 0;padding-left:18px;color:#475569;font-size:13px">${p.items.slice(0, 8).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</li>`).join("")}</ol>
        <div style="margin-top:10px;padding:8px 10px;border-radius:8px;background:#f8fafc;color:#475569;font-size:13px">ถ้าเอกสารนั้น “ไม่มีจริง” (เช่น ลูกค้าไม่ออกเอกสาร) กด <b>ขอแอดมินพิจารณาปิดงาน</b> แล้วระบุเหตุผล — แอดมินจะเห็นปัญหาทั้งหมดก่อนอนุมัติ</div>
      </div>`;
      const r = await Swal.fire({
        icon: "warning", title: "เอกสารยังไม่ผ่าน — ยังขอปิดงานไม่ได้", html, width: 640,
        showCancelButton: true, confirmButtonText: "แก้ไขเอกสาร", cancelButtonText: "ขอแอดมินพิจารณาปิดงาน",
        confirmButtonColor: "#2563eb", cancelButtonColor: "#64748b", reverseButtons: false,
      });
      if (r.isConfirmed || r.dismiss !== Swal.DismissReason.cancel) return;
      const reason = await Swal.fire({
        title: "เหตุผลที่ขอให้แอดมินปิดงาน", input: "textarea", inputPlaceholder: "เช่น ลูกค้าไม่ออกใบส่งมอบงาน / งานนี้ไม่มีใบวางบิล",
        inputValidator: (v) => (!String(v || "").trim() ? "กรุณาระบุเหตุผล" : undefined),
        showCancelButton: true, confirmButtonText: "ส่งคำขอปิดงาน", cancelButtonText: "ยกเลิก", confirmButtonColor: "#f59e0b",
      });
      if (!reason.isConfirmed) return;
      overrideReason = String(reason.value || "").trim();
    } else {
      const confirm = await Swal.fire({
        title: "ยืนยันขอปิดงาน?",
        text: check?.skipped ? "งานนี้จะเข้าสถานะ \"รอแอดมินอนุมัติ\" ทันที" : "เอกสารผ่านการตรวจแล้ว · งานนี้จะเข้าสถานะ \"รอแอดมินอนุมัติ\" ทันที",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "ขอปิดงาน",
        cancelButtonText: "ยกเลิก",
        confirmButtonColor: "#f59e0b",
      });
      if (!confirm.isConfirmed) return;
    }

    setRequestingClose(true);
    const now = new Date().toISOString();
    await (onStatusUpdate || onInputUpdate)(event._id, {
      closeRequested: true,
      closeRequestedAt: now,
      closeRequestedBy: userName,
      // ✅ เก็บ userId จริงของคนกดขอปิดงานไว้ด้วย เพื่อให้แจ้งเตือน push ตอนอนุมัติ/ไม่อนุมัติ
      // ส่งถึงคนที่กดขอจริงๆ ได้ (resPerson ของงานอาจไม่ตรงกับคนกดขอ เช่น งานมอบหมายผ่านชื่อทีมแบบเก่า)
      closeRequestedByUserId: payload?.userId || "",
      ...(overrideReason ? { closeOverrideReason: overrideReason } : {}),
    });
    await pushLog("close_requested", overrideReason ? `ขอปิดงาน (เอกสารไม่ผ่านการตรวจ — ขอแอดมินพิจารณา: ${overrideReason})` : "ขอปิดงาน รอแอดมินอนุมัติ");
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
    <Stack spacing={1}>
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
                    : log.action === "job_ack"                ? "รับทราบงาน"
                    : log.action === "job_declined"           ? "ปฏิเสธงาน"
                    : log.action === "job_confirmed"          ? "ยืนยันนัดแล้ว"
                    : log.action === "scheduled"              ? "ส่งลงตาราง"
                    : log.action === "intake_created"         ? "รับงานใหม่"
                    : log.action === "check_in"               ? "เข้างาน"
                    : log.action === "responsible_assigned"   ? "มอบหมายผู้รับผิดชอบ"
                    : log.action === "team_changed"           ? "เปลี่ยนหัวหน้าทีม"
                    : log.action === "status_changed"         ? "เปลี่ยนสถานะ"
                    : log.action === "close_approved"         ? "อนุมัติปิดงาน"
                    : log.action === "close_rejected"         ? "ไม่อนุมัติปิดงาน"
                    : log.action === "follow_up"              ? "แจ้งงานไม่เสร็จ"
                    : log.action === "follow_up_resolved"     ? "จัดการงานไม่เสร็จแล้ว"
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

        {/* ✅ (20 ต.ค. 2569 ผู้ใช้: "งานของฉัน ให้เป็นรูปแบบเดียวกับหน้ารับงาน — หน้าแรกข้อมูลไม่เยอะแต่สำคัญ ไม่กินพื้นที่")
            มือถือตอนพับ = หัวการ์ดย่อ · กดแล้วกางการ์ดเต็ม (ขั้นตอน/เข้างาน · เอกสาร · ขอปิดงาน) · งานวันนี้กางไว้ให้เลย */}
        {!mOpen && (
          <Box sx={{ display: { xs: "block", sm: "none" } }}>
            <MobileJobSummary event={event} statusLabel={event.status || "ไม่ระบุ"} statusColor={statusColor}
              next={(() => { const n = nextStepOf(event, "tech"); return n ? { title: n.title, tone: n.tone } : null; })()}
              person={event.responsiblePerson} personSrc={employees.find((u) => u.fname === event.responsiblePerson)?.imageUrl}
              personSub={event.team ? `หัวหน้าทีม ${event.team}` : "ผู้รับผิดชอบงาน"}
              step={jobStepOf(event, completedDocCount === DOCUMENT_TYPES.length)} inGroup={noOuterCard}
              actions={<CheckInOutPanel compact lineOnly event={event} onPreview={onPreview} onPatched={onPatched} sx={{ mt: 0 }} docsComplete={completedDocCount === DOCUMENT_TYPES.length} />}
              onToggle={() => setSheetOpen(true)} />
          </Box>
        )}

        {/* ── Header — กดที่ไหนก็ได้บนแถวนี้เพื่อกาง/พับการ์ด ไม่ต้องเล็งกดลูกศรเล็กๆ อีกต่อไป ── */}
        <Stack
          direction="row" alignItems="flex-start" justifyContent="space-between" gap={1.5}
          onClick={() => setDetailsOpen(true)}
          sx={{ cursor: "pointer", display: { xs: mOpen ? "flex" : "none", sm: "flex" } }}
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
              {/* ✅ เลข Job · ด่วน · ครบกำหนด · รอข้อมูล · งานไม่เสร็จ */}
              <JobFlowChips event={event} />
              <Stack spacing={0.35} sx={{ mt: 0.6 }}>
                {event.system && <InfoLine label="ระบบ">{event.system}</InfoLine>}
                {/* ✅ เดิม `{company || "—"} · {site || "—"}` โชว์ "— · ไซต์" เป็นขีดลอยๆ เวลาช่องใดช่องหนึ่งว่าง */}
                <InfoLine label="โครงการ">
                  {/* 🔁 (25 ต.ค. 2569 ผู้ใช้: "ให้แสดงชื่อโครงการ ไม่ใช่บริษัท") ชื่อบริษัทยาวดันโครงการตกขอบ */}
                  {event.site || event.company || "ไม่ระบุโครงการ"}
                </InfoLine>
                {/* ✅ ย้ายมาไว้ถัดจากโครงการตามที่ขอ (เดิมอยู่คู่กับระบบด้านบนสุด) */}
                {event.time && <InfoLine label="ครั้งที่">{formatRoundLabel(event.time, event.visitCount, event)}</InfoLine>}
                {(event.startTime || event.endTime) && (
                  <InfoLine label="เวลา">{event.startTime || "-"} — {event.endTime || "-"}</InfoLine>
                )}
                {event.docNo && <InfoLine label="เอกสาร">{event.docNo}</InfoLine>}
                {/* ✅ ทีม อยู่ล่างสุดของรายการ — เพิ่มชื่อลูกทีมเพิ่มเติม (teamMembers) ต่อท้ายชื่อทีม/
                    หัวหน้าทีมด้วย (เดิมมีแค่ event.team ตัวเดียว ไม่เห็นลูกทีมที่เพิ่มมาเลย) กันชื่อซ้ำ
                    ด้วย filter dedupe (เทียบ pattern เดียวกับ teamDisplay ใน EventCalendar/index.js) */}
                {/* ✅ (11 ต.ค. 2569 ผู้ใช้: "ทีมเข้างาน ผู้รับผิดชอบ ควรจะอยู่ header" + "เพิ่มการแสดงผลผู้รับผิดชอบงานด้วย")
                    แสดงเป็นชิปรูปคน: ผู้รับผิดชอบ (เสมอ — ยังไม่มอบหมายก็บอก) · ทีม = หัวหน้า (ป้ายหัวหน้า) + ลูกทีม */}
                {(() => {
                  const head = event.team || "";
                  const isResponsible = (event.responsiblePersonId && String(event.responsiblePersonId) === String(userData?.userId))
                    || (userData?.fname && event.responsiblePerson === userData.fname);
                  const members = [...new Set((event.teamMembers || []).map(m => m?.name).filter((n) => n && n !== head))];
                  return (
                    <>
                      <InfoLine label="ผู้รับผิดชอบ" center>
                        {event.responsiblePerson
                          ? <PersonChip name={event.responsiblePerson} size={20} strong title={`ผู้รับผิดชอบงาน: ${event.responsiblePerson}`} />
                          : <span style={{ color: "#b45309" }}>ยังไม่มอบหมาย</span>}
                      </InfoLine>
                      {(head || members.length > 0 || isResponsible) && (
                        <InfoLine label="ทีม" center>
                          <Box component="span" sx={{ display: "inline-flex", flexWrap: "wrap", gap: 0.5 }}>
                            {head && <PersonChip name={head} size={20} badge="หัวหน้า" title={`หัวหน้าทีมเข้างาน: ${head}`} />}
                            {members.map((n) => <PersonChip key={n} name={n} size={20} title={`ลูกทีม: ${n}`} />)}
                            {!head && isResponsible && <span style={{ color: "#b45309" }}>ยังไม่ได้มอบหมายหัวหน้าทีม</span>}
                            {isResponsible && event.status !== "ดำเนินการเสร็จสิ้น" && (
                              <ButtonBase onClick={(e) => { e.stopPropagation(); setTeamAnchor(e.currentTarget); }}
                                sx={{ ml: 0.5, px: 1, py: 0.35, borderRadius: 1.5, color: "#2563eb", bgcolor: "#eff6ff", fontSize: "0.74rem", fontWeight: 800 }}>
                                {head ? "เปลี่ยนหัวหน้าทีม" : "มอบหมายหัวหน้าทีม"}
                              </ButtonBase>
                            )}
                          </Box>
                        </InfoLine>
                      )}
                      {isResponsible && (
                        <AssignResponsibleMenu
                          title="เลือกหัวหน้าทีมเข้างาน"
                          anchorEl={teamAnchor}
                          onClose={() => setTeamAnchor(null)}
                          employees={employees}
                          value={head}
                          onPick={(name) => {
                            setTeamAnchor(null);
                            const selected = employees.find((person) => person.fname === name);
                            onInputUpdate?.(event._id, { team: name, resPerson: selected?._id ? String(selected._id) : "" });
                          }}
                        />
                      )}
                    </>
                  );
                })()}
              </Stack>
            </Box>
          </Stack>
          {/* ✅ ไม่มี onClick ของตัวเองแล้ว — แค่ไอคอนบอกว่ากดดูรายละเอียดได้ ตัวกดจริงคือทั้งแถว
              Header (คลิกบับเบิลขึ้นมาถึงเอง) — เดิมใช้ลูกศรชี้ลง/ขึ้นสื่อถึงการกางเนื้อหาลงในหน้า
              แต่ตอนนี้เปิดเป็น Dialog ทับขึ้นมาแทนแล้ว เปลี่ยนเป็นลูกศรชี้ขวาให้ตรงกับพฤติกรรมจริง */}
          <ChevronRight sx={{ fontSize: 22, color: "#94a3b8", flexShrink: 0, mt: 0.25 }} />
        </Stack>

        <Box sx={{ display: { xs: mOpen ? "block" : "none", sm: "block" } }}>
        {/* ✅ (10 ต.ค. 2569) เช็คอิน/เช็คเอาต์ — ของแต่ละวันเข้างาน (ทุกการ์ดในกลุ่มหลายวันมีของตัวเอง)
            เวลาจาก server · GPS · รูปก่อน/หลัง · สรุปงาน → ต่อท้าย "สรุปงานที่ทำ" ของงานนี้ */}
        <CheckInOutPanel compact event={event} onPreview={onPreview} onPatched={onPatched} docsComplete={completedDocCount === DOCUMENT_TYPES.length} />

        {/* ✅ ขั้นตอนทำงาน: รับทราบงาน · รอข้อมูล · อุปกรณ์ · งานไม่เสร็จ (ของทั้งงาน — แสดงที่การ์ดตัวแทนเท่านั้น) */}
        {!hideDocuments && <JobFlowPanel event={event} mode="tech" onPatched={onPatched} />}


        {/* ── เอกสารประจำงาน + ขอปิดงาน: ซ่อนถ้างานนี้ใช้เอกสารร่วมกับกลุ่ม (แสดงที่การ์ดตัวแทนแทน) ──
            ✅ (11 ต.ค. 2569) แสดงหลังรับทราบงาน + ยืนยันนัด (docsUnlocked) — ก่อนหน้านั้นเป็นแถบบอกเหตุผล */}
        {!hideDocuments && !docsUnlocked(event) && <DocsLockedRow event={event} />}
        {!hideDocuments && docsUnlocked(event) && (
        <>
        {/* ✅ (10 ต.ค. 2569 ผู้ใช้: "ช่องเอกสารประจำงานมองไม่เจอเลย ทำให้เด่นกว่านี้ เพราะช่างต้องส่งเอกสารเพื่อขอปิดงาน")
            เดิมเป็นแถบเทาบางๆ หน้าตาเหมือนลิงก์ทั่วไป — ตอนนี้เป็นกล่องเด่น: หัวข้อชัด · จำนวนที่ครบ ·
            รายการ 4 ชนิดพร้อมเครื่องหมายถูก · ปุ่มหลัก "แนบเอกสาร" (ครบแล้วกล่องเปลี่ยนเป็นสีเขียว) */}
        {(() => {
          const allDone = completedDocCount === DOCUMENT_TYPES.length;
          const tone = allDone ? "#16a34a" : "#2563eb";
          return (
            <Box sx={{ ...CARD, mt: 1.5, p: { xs: 1.75, sm: 2 }, borderColor: alpha(tone, 0.3), boxShadow: `0 1px 2px rgba(15,23,42,.04), 0 8px 20px -12px ${alpha(tone, 0.45)}` }}>
              <Stack direction="row" alignItems="center" gap={1.25}>
                <Box sx={{ width: 40, height: 40, borderRadius: 2.5, flexShrink: 0, display: "grid", placeItems: "center", bgcolor: alpha(tone, 0.12), color: tone }}>
                  {allDone ? <TaskAlt sx={{ fontSize: 22 }} /> : <Description sx={{ fontSize: 22 }} />}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.98rem", fontWeight: 900, color: "#0f172a", display: "flex", alignItems: "center", gap: 0.5 }}>
                    เอกสารสำหรับขอปิดงาน {isLocked && <Lock sx={{ fontSize: 15, color: "#94a3b8" }} />}
                  </Typography>
                  <Typography sx={{ fontSize: "0.76rem", color: "#64748b" }}>
                    {isLocked ? "งานปิดแล้ว — ดูเอกสารได้อย่างเดียว"
                      : allDone ? "ครบแล้ว — กด “ขอปิดงาน” ด้านล่างได้เลย"
                      : `แนบ/ระบุให้ครบ ${DOCUMENT_TYPES.length} รายการ จึงขอปิดงานได้`}
                  </Typography>
                </Box>
                <Typography sx={{ flexShrink: 0, fontSize: "1.35rem", fontWeight: 900, color: tone, fontVariantNumeric: "tabular-nums" }}>
                  {completedDocCount}/{DOCUMENT_TYPES.length}
                </Typography>
              </Stack>
              <LinearProgress variant="determinate" value={(completedDocCount / DOCUMENT_TYPES.length) * 100}
                sx={{ mt: 1.25, height: 6, borderRadius: 5, bgcolor: alpha("#64748b", 0.12), "& .MuiLinearProgress-bar": { bgcolor: tone, borderRadius: 5 } }} />
              {/* รายการเอกสารทีละชนิด — เห็นทันทีว่าขาดอะไร */}
              <Box sx={{ mt: 1.25, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75 }}>
                {DOCUMENT_TYPES.map((d) => {
                  const ok = isDocComplete(event, d.type);
                  return (
                    <Stack key={d.type} direction="row" alignItems="center" gap={0.6} sx={{ minWidth: 0 }}>
                      {ok
                        ? <CheckCircle sx={{ fontSize: 17, color: "#16a34a", flexShrink: 0 }} />
                        : <RadioButtonUnchecked sx={{ fontSize: 17, color: "#cbd5e1", flexShrink: 0 }} />}
                      <Typography noWrap sx={{ fontSize: "0.8rem", fontWeight: ok ? 600 : 800, color: ok ? "#64748b" : "#0f172a" }}>
                        {d.label}{!ok && isDocRequired(event, d.type) ? " *" : ""}
                      </Typography>
                    </Stack>
                  );
                })}
              </Box>
              <Button fullWidth variant="outlined" disableElevation
                onClick={() => setDocsExpanded(true)}
                startIcon={<Description />}
                sx={{ ...MBTN.outline(tone), mt: 1.5 }}>
                {isLocked ? "ดูเอกสาร" : allDone ? "ดู / แก้เอกสาร" : `แนบเอกสาร (ขาด ${DOCUMENT_TYPES.length - completedDocCount} รายการ)`}
              </Button>
            </Box>
          );
        })()}

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
            {/* ✅ (10 ต.ค. 2569) ปุ่มขั้นสุดท้าย — สีเขียวแบบใหม่ (เดิมปุ่มส้มทรงเก่า) */}
            <Button variant="contained" disableElevation fullWidth startIcon={<TaskAlt />}
              onClick={handleRequestClose} disabled={requestingClose} sx={MBTN.success}>
              {requestingClose ? "กำลังส่งคำขอ..." : event.closeRejectReason ? "ขอปิดงานอีกครั้ง" : "ขอปิดงาน"}
            </Button>
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
        ) : null /* 🧹 ข้อความ "จัดการเอกสารให้ครบก่อน…" ซ้ำกับกล่องเอกสารด้านบน — ตัดออก */}
        </>
        )}

        {/* ── แถบ "รายละเอียด" — กดแล้วเปิดอีกหน้า (ไฟล์แนบ · สรุปงาน · คุยกับแอดมิน · ประวัติ) ── */}
        <ButtonBase onClick={(e) => { e.stopPropagation(); setDetailsOpen(true); }}
          sx={{ width: "100%", mt: 1.5, px: 1.25, py: 0.9, gap: 1, justifyContent: "flex-start", borderRadius: "10px",
            fontFamily: "inherit", bgcolor: SURFACE, "&:hover": { bgcolor: "#eef2f6" } }}>
          <Typography noWrap sx={{ flex: 1, minWidth: 0, textAlign: "left", fontSize: "0.78rem", color: INK_2 }}>
            {[`ไฟล์แนบ ${(event.sitePhotoFiles || []).length}`, "สรุปงาน",
              `คุยกับแอดมิน${(event.comments || []).length ? ` ${event.comments.length}` : ""}`, "ประวัติ"].join(" · ")}
          </Typography>
          <Typography sx={{ fontSize: "0.76rem", fontWeight: 600, color: ACCENT, display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
            เปิด<ChevronRight sx={{ fontSize: 18 }} />
          </Typography>
        </ButtonBase>
        </Box>

      </CardContent>

      {!inSheet && (
        <MobileSheet open={sheetOpen} onClose={() => setSheetOpen(false)}
          title={`${event.title || "งาน"}${event.system ? ` · ${event.system}` : ""}`}
          subtitle={[event.jobNo, event.site || event.company].filter(Boolean).join(" · ")}>
          <Box sx={{ m: 1.25, borderRadius: 3, bgcolor: "#fff", border: `1px solid ${LINE}`, overflow: "hidden" }}>
            <TechnicianJobCard event={event} userData={userData} employees={employees} onInputUpdate={onInputUpdate} onStatusUpdate={onStatusUpdate}
              onFileUpload={onFileUpload} onDeleteFile={onDeleteFile} onPreview={onPreview} uploadingState={uploadingState} isUploadingState={isUploadingState}
              uploadProgressState={uploadProgressState} hideDocuments={hideDocuments} noOuterCard onPatched={onPatched} inSheet />
          </Box>
        </MobileSheet>
      )}

      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} fullWidth maxWidth="md" fullScreen={!isDesktop}
        PaperProps={{ sx: { borderRadius: { xs: 0, sm: 3 } } }}>
        <Box sx={{ px: { xs: 2, sm: 2.5 }, pt: 2, pb: 1.5, borderBottom: `1px solid ${LINE}` }}>
          <Stack direction="row" alignItems="flex-start" gap={1}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: MUTED }}>รายละเอียดงาน</Typography>
              <Typography noWrap sx={{ fontWeight: 700, fontSize: "1.05rem", color: INK, lineHeight: 1.35 }}>{event.title || "ไม่ระบุประเภทงาน"}</Typography>
              <Typography sx={{ fontSize: "0.8rem", color: INK_2, mt: 0.25 }}>
                {[event.site || event.company, event.system,
                  formatEventDateRange(event)].filter(Boolean).join(" · ")}
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => setDetailsOpen(false)} aria-label="ปิด" sx={{ color: MUTED, mr: -0.5 }}>
              <Close fontSize="small" />
            </IconButton>
          </Stack>
        </Box>
        <DialogContent sx={{ bgcolor: SURFACE, px: { xs: 1.5, sm: 2.5 }, py: 2 }}>
          <SitePhotos event={event} canEdit={!isLocked && isApproved(event)} onPreview={onPreview} sx={{ mt: 0 }} />
          <Box sx={{ ...CARD, mt: 1.5, p: { xs: 1.75, sm: 2 } }}>
            {expandedContent}
          </Box>
        </DialogContent>
      </Dialog>

      {!hideDocuments && (
        <Dialog open={docsExpanded} onClose={() => setDocsExpanded(false)} fullWidth maxWidth="md" fullScreen={!isDesktop}
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
                  const place = [event.site || event.company,
                    event.system, event.time ? `ครั้งที่ ${formatRoundLabel(event.time, event.visitCount, event)}` : ""].filter(Boolean).join(" · ");
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
                : `เหลืออีก ${DOCUMENT_TYPES.length - completedDocCount} รายการ จึงขอปิดงานได้ · * = ต้องมี`}
            </Typography>
          </Box>
          {/* 🔁 (19 ต.ค. 2569 ผู้ใช้: "หน้าเอกสารประจำงานให้ขยายออกอีก ดูเล็กไป") — กล่องกว้างขึ้น (md) · จอคอมเรียงเอกสาร 2 คอลัมน์ */}
          <DialogContent sx={{ bgcolor: SURFACE, px: { xs: 1.5, sm: 2.5 }, py: 2.5,
            "& > .MuiStack-root": { display: { md: "grid" }, gridTemplateColumns: { md: "repeat(2, minmax(0, 1fr))" }, gap: { md: 1.5 }, alignItems: "start" },
            "& > .MuiStack-root > *": { mt: { md: "0 !important" } } }}>
            {docsContent}
          </DialogContent>
        </Dialog>
      )}
    </Wrapper>
  );
};

export default TechnicianJobCard;
