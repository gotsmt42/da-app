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
import "moment/locale/th";
import Swal from "sweetalert2";
import { formatEventDateRange } from "../../utils/formatDateRange";
import {
  Box, Card, CardContent, Typography, Stack, Chip, Avatar,
  Button, IconButton, TextField, Collapse, Divider, LinearProgress,
  Tooltip, ToggleButton, ToggleButtonGroup, Menu, MenuItem, ListItemIcon, ListItemText,
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
  Send, Chat, Link as LinkIcon, MoreVert, Print, Share,
} from "@mui/icons-material";
import LineIcon from "../icons/LineIcon";
import { printFile, shareFile, shareToLine, isMobileDevice } from "../../functions/fileActions";

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

const DOCUMENT_TYPES = [
  { type: "report",     label: "Service Report", color: "#3b82f6", alwaysRequired: true,  icon: <Description sx={{ fontSize: 18 }} /> },
  { type: "quotation",  label: "ใบเสนอราคา",     color: "#f59e0b", alwaysRequired: false, icon: <RequestQuote sx={{ fontSize: 18 }} /> },
  { type: "invoice",    label: "ใบวางบิล",       color: "#8b5cf6", alwaysRequired: false, icon: <ReceiptLong sx={{ fontSize: 18 }} /> },
  { type: "completion", label: "ใบส่งมอบงาน",     color: "#10b981", alwaysRequired: false, icon: <AssignmentTurnedIn sx={{ fontSize: 18 }} /> },
];

// เอกสารชนิดนี้ถือว่า "เสร็จ" แล้วหรือยัง (report ต้องติ๊ก, ที่เหลือ "ไม่มี" หรือ "มี"+มีไฟล์อย่างน้อย 1 ไฟล์)
const isDocComplete = (event, type) => {
  const hasFiles = (event[`${type}Files`] || []).length > 0;
  // Service Report: บังคับต้องติ๊ก "และ" ต้องแนบไฟล์จริงอย่างน้อย 1 ไฟล์ ถึงจะถือว่าเสร็จ
  if (type === "report") return Boolean(event.documentSentReport) && hasFiles;
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

// ─── DocumentFileList ─────────────────────────────────────────────────
// รายการไฟล์ที่แนบ (แนบได้หลายไฟล์) + ปุ่มเพิ่มไฟล์อีก (ใช้ร่วมกันทั้ง required เสมอ และ "มี")
const DocumentFileList = ({ type, files, isUploading, uploadProgress, onFileUpload, onDeleteFile, onPreview, isLocked }) => {
  const fileRef = useRef();
  const fileList = files || [];

  // ✅ เมนู "⋮" ต่อไฟล์ — เดิมโชว์ปุ่มดู/ดาวน์โหลด/ลบ เรียงเป็นไอคอนแยกทุกแถว ดูรกเวลามีหลายไฟล์
  // รวมเป็นเมนูเดียว เหลือแค่ปุ่มดูไฟล์ (บ่อยสุด) + ปุ่ม "⋮" ที่มีดาวน์โหลด/พิมพ์/แชร์ LINE/ลบ
  const [fileMenu, setFileMenu] = useState(null); // { el, file }
  const closeFileMenu = () => setFileMenu(null);

  const handleFileChange = (e) => {
    if (e.target.files?.length) onFileUpload(e.target.files, type);
  };

  return (
    <Box>
      {fileList.length > 0 && (
        <Stack spacing={0.5} sx={{ mb: 0.5 }}>
          {fileList.map(f => (
            <Stack key={f._id || f.fileUrl} direction="row" alignItems="center" gap={0.5} sx={{
              p: 1, borderRadius: 1.5, bgcolor: alpha("#6b7280", 0.06),
            }}>
              {fileTypeIcon(f.fileName)}
              <Typography variant="caption" color="text.secondary" noWrap flex={1} sx={{ fontSize: "0.8rem" }}
                onClick={() => onPreview(f.fileUrl, f.fileName)} style={{ cursor: "pointer" }}>
                {f.fileName}
              </Typography>
              <Tooltip title="ดูไฟล์">
                <IconButton onClick={() => onPreview(f.fileUrl, f.fileName)} sx={{ p: 1 }}>
                  <Visibility sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="เพิ่มเติม">
                <IconButton onClick={e => setFileMenu({ el: e.currentTarget, file: f })} sx={{ p: 1 }}>
                  <MoreVert sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Stack>
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
          <Button
            variant="outlined" fullWidth
            startIcon={<CloudUpload sx={{ fontSize: 18 }} />}
            onClick={() => fileRef.current?.click()}
            sx={{ textTransform: "none", fontSize: "0.8rem", fontWeight: 600, borderRadius: 1.5, borderStyle: "dashed", py: 1 }}>
            {fileList.length > 0 ? "+ เพิ่มไฟล์อีก" : "แนบไฟล์ (เลือกได้หลายไฟล์)"}
          </Button>
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
  onToggleCheck, onSetApplicable, onFileUpload, onDeleteFile, onPreview,
  isUploading, uploadProgress, isLocked,
}) => {
  const files      = event[`${type}Files`] || [];
  const hasFiles   = files.length > 0;
  const applicable = event[`${type}Applicable`];
  const complete   = isDocComplete(event, type);
  const checked    = Boolean(event[`documentSent${capitalize(type)}`]);

  return (
    <Box sx={{
      borderRadius: 2, border: "1px solid",
      borderColor: complete ? alpha(color, 0.35) : "divider",
      background: complete ? alpha(color, 0.05) : "transparent",
      transition: "all 0.15s ease",
      overflow: "hidden",
    }}>
      {/* แถวหัวข้อ — แตะได้ทั้งแถวเพื่อติ๊ก (เฉพาะ Service Report) */}
      <Stack direction="row" alignItems="center" gap={1.25}
        onClick={alwaysRequired && !isLocked ? () => onToggleCheck(type, !checked) : undefined}
        sx={{
          p: 1.5,
          cursor: alwaysRequired && !isLocked ? "pointer" : "default",
          minHeight: 48,
        }}>
        <Box sx={{
          width: 34, height: 34, borderRadius: "10px", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          bgcolor: alpha(color, complete ? 0.18 : 0.1),
          color,
        }}>
          {icon}
        </Box>
        <Typography variant="body2" fontWeight={700} flex={1}
          color={complete ? color : "text.primary"}>
          {label}
        </Typography>
        {alwaysRequired ? (
          <Box sx={{
            width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: `2px solid ${checked ? color : alpha("#6b7280", 0.4)}`,
            background: checked ? color : "transparent",
            transition: "all 0.15s ease",
          }}>
            {checked && <CheckCircle sx={{ fontSize: 16, color: "#fff" }} />}
          </Box>
        ) : complete ? (
          <CheckCircle sx={{ fontSize: 22, color, flexShrink: 0 }} />
        ) : null}
      </Stack>

      {/* เนื้อหาย่อย: คำเตือน / ปุ่มมี-ไม่มี / แนบไฟล์ */}
      {alwaysRequired ? (
        <Box sx={{ px: 1.5, pb: 1.5 }}>
          {checked && !hasFiles && (
            <Typography variant="caption" color="warning.main" sx={{ display: "block", mb: 0.75, fontWeight: 600 }}>
              ⚠️ ต้องแนบไฟล์ก่อน จึงจะขอปิดงานได้
            </Typography>
          )}
          <DocumentFileList
            type={type} files={files}
            isUploading={isUploading} uploadProgress={uploadProgress}
            onFileUpload={onFileUpload} onDeleteFile={onDeleteFile} onPreview={onPreview}
            isLocked={isLocked}
          />
        </Box>
      ) : applicable === null || applicable === undefined ? (
        <Box sx={{ px: 1.5, pb: 1.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
            งานนี้มีเอกสารนี้หรือไม่?
          </Typography>
          <ToggleButtonGroup
            fullWidth exclusive size="small"
            value={null}
            disabled={isLocked}
            onChange={(_, val) => { if (val !== null) onSetApplicable(type, val === "yes"); }}
            sx={{ height: 40 }}>
            <ToggleButton value="yes" sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.8rem", gap: 0.5 }}>
              <CheckCircle sx={{ fontSize: 17 }} /> มี
            </ToggleButton>
            <ToggleButton value="no" sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.8rem", gap: 0.5 }}>
              <Close sx={{ fontSize: 17 }} /> ไม่มี
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      ) : applicable === false ? (
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, pb: 1.5 }}>
          <Typography variant="caption" color="text.disabled">ไม่มีเอกสารนี้สำหรับงานนี้</Typography>
          {!isLocked && (
            <Button size="small" onClick={() => onSetApplicable(type, true)}
              sx={{ textTransform: "none", fontSize: "0.75rem", minWidth: "auto" }}>
              เปลี่ยนเป็นมี
            </Button>
          )}
        </Stack>
      ) : (
        <Box sx={{ px: 1.5, pb: 1.5 }}>
          <DocumentFileList
            type={type} files={files}
            isUploading={isUploading} uploadProgress={uploadProgress}
            onFileUpload={onFileUpload} onDeleteFile={onDeleteFile} onPreview={onPreview}
            isLocked={isLocked}
          />
          {!hasFiles && !isLocked && (
            <Button size="small" onClick={() => onSetApplicable(type, false)}
              sx={{ textTransform: "none", fontSize: "0.75rem", minWidth: "auto", p: 0, mt: 0.75, color: "text.disabled" }}>
              เปลี่ยนเป็นไม่มี
            </Button>
          )}
        </Box>
      )}
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

  const isMine = (c) => (myRole === "technician" ? c.role === "technician" : c.role !== "technician");

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
                      {c.userName || (c.role === "technician" ? "ช่าง" : "แอดมิน")}
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
// ✅ เดิมแต่ละบรรทัด "ไอคอน ป้ายกำกับ : ค่า" เป็นข้อความยาวเส้นเดียว พอค่ายาว (เช่นชื่อโครงการ)
// บนจอมือถือแคบๆ จะตัดขึ้นบรรทัดใหม่แบบมั่วๆ (บางทีตัดกลางป้ายกำกับ/ตัดกลางวันที่) ดูไม่เป็นระเบียบ
// แยกป้ายกำกับ (ไม่ตัดคำ) ออกจากค่า (ตัดคำ/ขึ้นบรรทัดใหม่ได้อิสระ) ด้วย flex row — ค่าที่ยาวจะ
// ขึ้นบรรทัดใหม่แบบชิดใต้ตัวมันเองเท่านั้น ไม่ดึงป้ายกำกับหรือคำอื่นๆ ตามไปด้วย
const InfoLine = ({ icon, label, children }) => (
  <Stack direction="row" spacing={0.5} sx={{ alignItems: "flex-start" }}>
    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, whiteSpace: "nowrap" }}>
      {icon} {label} :
    </Typography>
    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 0 }}>
      {children}
    </Typography>
  </Stack>
);

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
  const canRequestClose = completedDocCount === DOCUMENT_TYPES.length && !isNotConfirmed && !isBeforeLastWorkDay;
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

  return (
    <Wrapper>
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>

        {/* ── Header — กดที่ไหนก็ได้บนแถวนี้เพื่อกาง/พับการ์ด ไม่ต้องเล็งกดลูกศรเล็กๆ อีกต่อไป ── */}
        <Stack
          direction="row" alignItems="flex-start" justifyContent="space-between" gap={1.5}
          onClick={() => setExpanded(p => !p)}
          sx={{ cursor: "pointer" }}
        >
          <Stack direction="row" alignItems="flex-start" gap={1.5} flex={1} minWidth={0}>
            {/* ✅ ลดขนาดลงบนจอมือถือ (จอกว้างยังคง 44px เท่าเดิม) — การ์ดตอนนี้เนื้อหากระชับขึ้นแล้ว
                วงกลมไอคอนใหญ่แบบเดิมเลยดูไม่สมส่วนเมื่อเทียบกับตัวหนังสือที่เหลือ */}
            <Avatar sx={{
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
                <Chip
                  size="small"
                  label={event.status || "ไม่ระบุ"}
                  sx={{
                    height: 22, fontSize: "0.7rem", fontWeight: 700,
                    bgcolor: alpha(statusColor, 0.12),
                    color: statusColor,
                    border: `1px solid ${alpha(statusColor, 0.3)}`,
                  }}
                />
                {/* ✅ ย่อช่วงวันที่ให้กระชับ (ดู formatEventDateRange) — ถ้าอยู่ปีเดียวกัน/เดือนเดียวกัน
                    ไม่ต้องพิมพ์เดือนปีซ้ำสองรอบ กันตัดขึ้นบรรทัดใหม่แบบขาดกลางวันที่บนจอแคบด้วย */}
                <Typography variant="caption" color="text.secondary" fontWeight={600} noWrap>
                  📅 {formatEventDateRange(event)}
                </Typography>
                {event.jobGroupId && (
                  <Tooltip title="งานนี้เป็นส่วนหนึ่งของงานหลายวัน (กลุ่มเดียวกัน)">
                    <LinkIcon sx={{ fontSize: 16, color: "#8b5cf6", opacity: 0.8 }} />
                  </Tooltip>
                )}
              </Stack>

              {event.title && (
                <Typography fontWeight={800} fontSize="0.95rem">
                  [{event.title}]
                </Typography>
              )}
              <Stack spacing={0.3} sx={{ mt: 0.4 }}>
                {event.system && <InfoLine icon="💻" label="ระบบ">{event.system}</InfoLine>}
                {/* ✅ เดิม `{company || "—"} · {site || "—"}` โชว์ "— · ไซต์" เป็นขีดลอยๆ เวลาช่องใดช่องหนึ่งว่าง */}
                <InfoLine icon="🏢" label="โครงการ">
                  {event.company && event.site
                    ? `${event.company} · ${event.site}`
                    : (event.company || event.site || "ไม่ระบุบริษัท/ไซต์")}
                </InfoLine>
                {/* ✅ ย้ายมาไว้ถัดจากโครงการตามที่ขอ (เดิมอยู่คู่กับระบบด้านบนสุด) */}
                {event.time && <InfoLine icon="🔢" label="ครั้งที่">{event.time}</InfoLine>}
                {(event.startTime || event.endTime) && (
                  <InfoLine icon="🕐" label="เวลา">{event.startTime || "-"} — {event.endTime || "-"}</InfoLine>
                )}
                {event.docNo && <InfoLine icon="📄" label="เอกสาร">{event.docNo}</InfoLine>}
                {/* ✅ ทีม อยู่ล่างสุดของรายการ — เพิ่มชื่อลูกทีมเพิ่มเติม (teamMembers) ต่อท้ายชื่อทีม/
                    หัวหน้าทีมด้วย (เดิมมีแค่ event.team ตัวเดียว ไม่เห็นลูกทีมที่เพิ่มมาเลย) กันชื่อซ้ำ
                    ด้วย filter dedupe (เทียบ pattern เดียวกับ teamDisplay ใน EventCalendar/index.js) */}
                {(() => {
                  const teamNames = [event.team, ...(event.teamMembers || []).map(m => m?.name)]
                    .filter(Boolean)
                    .filter((name, idx, arr) => arr.indexOf(name) === idx);
                  return teamNames.length > 0 && (
                    <InfoLine icon="👷" label="ทีม">{teamNames.join(", ")}</InfoLine>
                  );
                })()}
              </Stack>
            </Box>
          </Stack>
          {/* ✅ ไม่มี onClick ของตัวเองแล้ว — แค่ไอคอนบอกว่ากดดูรายละเอียดได้ ตัวกดจริงคือทั้งแถว
              Header (คลิกบับเบิลขึ้นมาถึงเอง) — เดิมใช้ลูกศรชี้ลง/ขึ้นสื่อถึงการกางเนื้อหาลงในหน้า
              แต่ตอนนี้เปิดเป็น Dialog ทับขึ้นมาแทนแล้ว เปลี่ยนเป็นลูกศรชี้ขวาให้ตรงกับพฤติกรรมจริง */}
          <IconButton sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: { xs: 0.5, sm: 1 }, pointerEvents: "none" }}>
            <ChevronRight sx={{ fontSize: { xs: 18, sm: 24 } }} />
          </IconButton>
        </Stack>

        {/* ── เอกสารประจำงาน + ขอปิดงาน: ซ่อนถ้างานนี้ใช้เอกสารร่วมกับกลุ่ม (แสดงที่การ์ดตัวแทนแทน) ── */}
        {!hideDocuments && (
        <>
        <Box sx={{ mt: 2 }}>
          <Box
            onClick={() => setDocsExpanded(p => !p)}
            sx={{
              cursor: "pointer", p: 1.5, borderRadius: 2, minHeight: 56,
              border: "1px solid", borderColor: "divider",
              "&:active": { bgcolor: alpha("#6b7280", 0.06) },
              "&:hover": { borderColor: canRequestClose ? "#10b981" : "#3b82f6" },
            }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="body2" fontWeight={700} color="text.secondary">
                📋 เอกสารประจำงาน{isLocked ? " 🔒" : ""}
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
                height: 10, borderRadius: 5,
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
                ขอปิดงานได้ตั้งแต่วันที่ {lastWorkDay.locale("th").format("DD MMM YYYY")} เป็นต้นไป
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
          <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography fontWeight={800} fontSize="1rem" noWrap>
                {event.company && event.site
                  ? `${event.company} · ${event.site}`
                  : (event.company || event.site || "ไม่ระบุบริษัท/ไซต์")}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                สรุปงานที่ทำ · คุยกับแอดมิน
              </Typography>
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
        <Dialog open={docsExpanded} onClose={() => setDocsExpanded(false)} fullWidth maxWidth="sm" fullScreen={!isDesktop}>
          <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography fontWeight={800} fontSize="1rem" noWrap>
                {event.company && event.site
                  ? `${event.company} · ${event.site}`
                  : (event.company || event.site || "ไม่ระบุบริษัท/ไซต์")}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                เอกสารประจำงาน ({completedDocCount}/{DOCUMENT_TYPES.length})
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => setDocsExpanded(false)}>
              <Close fontSize="small" />
            </IconButton>
          </DialogTitle>
          {/* ✅ เพิ่มหลอดสถานะความคืบหน้าเหมือนแถบด้านนอก (เดิมมีแค่ตัวเลข "0/4" ไม่มีหลอดจริง) */}
          <Box sx={{ px: 3, pb: 1.5 }}>
            <LinearProgress
              variant="determinate"
              value={(completedDocCount / DOCUMENT_TYPES.length) * 100}
              sx={{
                height: 10, borderRadius: 5,
                bgcolor: alpha("#6b7280", 0.12),
                "& .MuiLinearProgress-bar": {
                  bgcolor: canRequestClose ? "#10b981" : "#3b82f6",
                  borderRadius: 5,
                },
              }}
            />
          </Box>
          <DialogContent dividers>
            {docsContent}
          </DialogContent>
        </Dialog>
      )}
    </Wrapper>
  );
};

export default TechnicianJobCard;
