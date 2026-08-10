/* eslint-disable no-unused-vars */
/**
 * Operation/index.js — v4
 *
 * สิ่งที่เพิ่มจาก v3:
 *   ✅ ClosureRequestsPanel — แยกงานที่ช่างขอปิดออกมาเป็นพาแนลเฉพาะ เห็นชัดทันที
 *      ไม่ต้องไล่หาในลิสต์ที่มีการแบ่งหน้า/กรองอยู่ อนุมัติ/ไม่อนุมัติได้จากพาแนลนี้เลย
 *   ✅ NotificationBell — แก้ให้ยิงตาม closeRequested (ของเดิมยิงตาม checkedOutAt
 *      ซึ่งเลิกใช้ไปแล้วตั้งแต่เปลี่ยนมาใช้ระบบ "ขอปิดงาน" จึงไม่เคยแจ้งเตือนอีกเลย)
 *   ✅ Auto-refresh: ลดเหลือ 15s และขยายให้ทำงานกับทุก role (เดิมเฉพาะ admin/manager)
 *      เพื่อให้ผลอนุมัติ/ไม่อนุมัติ render กลับไปหาช่างแบบ realtime โดยไม่ต้องรีเฟรชเอง
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import EventService from "../../services/EventService";
import AuthService from "../../services/authService";
import JobTypeService from "../../services/JobTypeService";
import SystemTypeService from "../../services/SystemTypeService";
import Swal from "sweetalert2";
import moment from "moment";
import "moment/locale/th";
import {
  buildDaysPastDueMap, isFlaggedDays, isSevereDays, countFlaggedJobs, countDistinctJobs, getOverdueGroupKey,
} from "../../utils/overdueJobs";
import { getApprovalState, isPendingApproval, isRejected } from "../../utils/approvalStatus";
import { getOptimizedImageUrl } from "../../utils/cloudinaryImage";
import { formatEventDateRange } from "../../utils/formatDateRange";
import { formatRoundLabel } from "../../utils/contractRounds";
import { classifyJob, getJobClassMeta } from "../../utils/jobClassification";
// ✅ ไอคอนไฟล์ Excel — ชุดเดียวกับปุ่มส่งออกในหน้าปฏิทิน/ติดตามใบเสนอราคา (MUI ไม่มีไอคอนนี้)
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileExcel } from "@fortawesome/free-solid-svg-icons";

// MUI Core
import {
  Box, Grid, Paper, Typography, TextField, IconButton, Chip, Avatar,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Button, Stack, Tooltip, Badge, Fade, Collapse, LinearProgress,
  Tabs, Tab, Divider, useMediaQuery, useTheme, InputAdornment,
  Menu, MenuItem, ListItemIcon, ListItemText, Card, CardContent,
  Skeleton, Alert, Snackbar, Popover,
  List, ListItem, Pagination,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  ToggleButtonGroup, ToggleButton,
} from "@mui/material";

// MUI Icons
import {
  Search, FilterList, Clear, TableChart, ChevronRight, ViewList,
  Upload, Download, Delete, Visibility, Close, CheckCircle,
  PendingActions, Build, Assignment, Notifications, MoreVert,
  CalendarMonth, Warning, TrendingUp, Description,
  CloudUpload, InsertDriveFile, Image, PictureAsPdf, Article,
  Refresh, ArrowUpward, ArrowDownward, Circle, ExpandMore,
  ExpandLess, FolderOpen, AttachFile, Login, Logout, Edit,
  NoteAdd, History, Person, AccessTime, FiberManualRecord,
  TaskAlt, HourglassTop, Cancel,
  Send, Chat, Link as LinkIcon,
  Print, Share, RequestQuote, ReceiptLong, AssignmentTurnedIn,
} from "@mui/icons-material";

// MUI Date Picker
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterMoment } from "@mui/x-date-pickers/AdapterMoment";

// Router
import { useParams, useNavigate, useSearchParams } from "react-router-dom";

// Styled
import { styled, alpha } from "@mui/material/styles";

import TechnicianJobCard from "../Technician/TechnicianJobPanel";
import useEventNotifications from "../../hooks/useEventNotifications";
import NotificationBell from "../Notifications/NotificationBell";
import LineIcon from "../icons/LineIcon";
import { printFile, shareFile, shareToLine, isMobileDevice } from "../../functions/fileActions";
import PendingApprovalsPanel from "./PendingApprovalsPanel";
import InfoLine from "../InfoLine";

// ✅ ใช้ตัดสินใจลำดับปุ่มแชร์ในเมนู "⋮" ต่อไฟล์ (ดูเหตุผลใน fileActions.js)
const IS_MOBILE = isMobileDevice();

// ✅ เดิม MUI Menu เปิดช้า/รู้สึกหน่วง เพราะ transition คำนวณตามความสูงเมนู (auto) และมีการ
// ล็อกสกรอลของหน้า (เพิ่ม padding ชดเชย scrollbar) ทุกครั้งที่เปิด ทำให้เกิด reflow เห็นได้ชัด
// บนมือถือ — ลด duration ลงคงที่ + ปิด scroll lock ให้ลื่นขึ้นทุกเมนูในหน้านี้
const FAST_MENU_PROPS = {
  transitionDuration: { enter: 120, exit: 80 },
  disableScrollLock: true,
};

// ✅ ตรรกะ "ค้างงาน" (คิดจากวันสุดท้ายของงานที่เข้าหลายวันไม่ติดกัน ไม่ใช่คิดแยกทีละแถว) ย้ายไปรวมไว้ที่
// src/utils/overdueJobs.js แล้ว เพราะต้องใช้ตรรกะเดียวกันซ้ำในหลายหน้า (Dashboard, MyJobs) —
// ดูรายละเอียดคอมเมนต์ที่ไฟล์นั้นแทน

// ─── Styled Components ────────────────────────────────────────────────
// ✅ export GlassCard/StatCard/FileUploadSection/CommentThread — เดิมเป็น local const ใช้แค่ในไฟล์นี้
// เพิ่ม export ให้หน้าใหม่ (เช่น /quotations) เรียกใช้ซ้ำได้โดยไม่ต้อง copy โค้ด UI ไฟล์แนบ/คอมเมนต์
// (ซึ่งมี logic เมนู "⋮"/แชร์/พิมพ์ค่อนข้างซับซ้อน) ไปวางซ้ำอีกที่ — ไม่กระทบพฤติกรรมเดิมในไฟล์นี้เลย
export const GlassCard = styled(Card)(({ theme }) => ({
  background: alpha(theme.palette.background.paper, 0.9),
  backdropFilter: "blur(10px)",
  borderRadius: 16,
  border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  boxShadow: `0 4px 24px ${alpha(theme.palette.common.black, 0.06)}`,
  transition: "transform 0.2s ease, box-shadow 0.2s ease",
  "&:hover": {
    transform: "translateY(-2px)",
    boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.1)}`,
  },
}));

export const StatCard = styled(GlassCard)(({ color }) => ({
  position: "relative",
  overflow: "hidden",
  "&::before": {
    content: '""',
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: 4,
    background: color || "linear-gradient(90deg, #667eea, #764ba2)",
    borderRadius: "16px 16px 0 0",
  },
}));

const StyledTab = styled(Tab)(({ theme }) => ({
  fontWeight: 600,
  fontSize: "0.85rem",
  textTransform: "none",
  minHeight: 48,
  borderRadius: "8px 8px 0 0",
  "&.Mui-selected": { color: theme.palette.primary.main },
}));

const FilterChip = styled(Chip)(({ theme, active }) => ({
  fontWeight: active ? 700 : 500,
  transition: "all 0.15s ease",
  "&:hover": { transform: "scale(1.04)" },
}));

// ─── StatusGroupCard ────────────────────────────────────────────────────
// ✅ ปุ่มเลือกกลุ่มสถานะงาน (รอคุณอนุมัติ/กำลังดำเนินการ/ค้างงาน/เสร็จสิ้น) — เดิมใช้ ToggleButtonGroup
// แบบชิปเล็กๆ เรียงแนวนอน พอจอแคบ (มือถือ) จะห่อบรรทัดมั่วๆ กดยาก เปลี่ยนเป็นการ์ดใหญ่จัดกริด
// 2 คอลัมน์เสมอ (ฝั่งแอดมิน/manager ขยายเป็น 4 คอลัมน์ในแนวนอนตอนจอกว้างพอ) แตะง่าย เห็นตัวเลขชัด
// ✅ ปรับให้กระชับขึ้นมากบนจอเล็ก — เดิมจัดกลางแนวตั้ง (ไอคอน/ชื่อ/จำนวน ซ้อน 3 ชั้น สูงขั้นต่ำ 92px)
// พอเป็นกริด 2x2 บนมือถือจึงกินพื้นที่เกือบ 200px ก่อนจะถึงข้อมูลจริงสักรายการ ต้องเลื่อนผ่านทุกครั้ง
// ✅ จอเล็ก: เรียงแนวนอน (ไอคอน | ชื่อ+จำนวน) สูงแค่ ~62px — เห็นครบเหมือนเดิมแต่ประหยัดที่ราวครึ่งหนึ่ง
// ✅ จอกว้าง: คงแบบเดิม (จัดกลาง 3 ชั้น) ซึ่งดูสมส่วนอยู่แล้วเมื่อวางเรียง 4 ใบในแถวเดียว
// ✅ ตัวเลขจำนวนงานทำให้เด่นขึ้น (ตัวหนา+ใหญ่กว่าคำว่า "งาน") — เป็นข้อมูลที่คนมองการ์ดนี้ต้องการจริงๆ
const StatusGroupCard = ({ active, onClick, icon, color, label, count, sub }) => (
  <Box
    onClick={onClick}
    sx={{
      cursor: "pointer", borderRadius: 3, transition: "all 0.15s ease", border: "2px solid",
      borderColor: active ? color : "divider",
      bgcolor: active ? alpha(color, 0.08) : "background.paper",
      "&:hover": { borderColor: active ? color : alpha(color, 0.5) },
      display: "flex",
      p: { xs: 1.25, sm: 1.5 },
      minHeight: { xs: 62, sm: 92 },
      flexDirection: { xs: "row", sm: "column" },
      alignItems: "center",
      justifyContent: { xs: "flex-start", sm: "center" },
      textAlign: { xs: "left", sm: "center" },
      gap: { xs: 1.25, sm: 0 },
    }}>
    {React.cloneElement(icon, {
      sx: {
        fontSize: { xs: 22, sm: 24 },
        color: active ? color : "text.secondary",
        mb: { xs: 0, sm: 0.5 },
        flexShrink: 0,
      },
    })}
    <Box sx={{ minWidth: 0 }}>
      <Typography fontWeight={800} fontSize="0.8rem" lineHeight={1.25}
        color={active ? color : "text.primary"}>
        {label}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
        <Box component="span" sx={{ fontWeight: 800, fontSize: "0.9rem", color: active ? color : "text.primary" }}>
          {count}
        </Box>
        {" งาน"}{sub ? ` · ${sub}` : ""}
      </Typography>
    </Box>
  </Box>
);

const UploadZone = styled(Box)(({ theme, dragging }) => ({
  border: `2px dashed ${dragging ? theme.palette.primary.main : alpha(theme.palette.divider, 0.4)}`,
  borderRadius: 12,
  padding: theme.spacing(3),
  textAlign: "center",
  cursor: "pointer",
  background: dragging ? alpha(theme.palette.primary.main, 0.04) : "transparent",
  transition: "all 0.2s ease",
  "&:hover": {
    borderColor: theme.palette.primary.main,
    background: alpha(theme.palette.primary.main, 0.02),
  },
}));

const StatusBadge = styled(Box)(({ color }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "3px 10px",
  borderRadius: 20,
  fontSize: "0.75rem",
  fontWeight: 600,
  background: alpha(color || "#999", 0.12),
  color: color || "#999",
}));

// ── Pulse dot (แสดงว่า online / กำลังทำงาน) ──
const PulseDot = styled(Box)(({ color = "#10b981" }) => ({
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: color,
  flexShrink: 0,
  animation: "pulse 2s ease-in-out infinite",
  "@keyframes pulse": {
    "0%, 100%": { opacity: 1, transform: "scale(1)" },
    "50%": { opacity: 0.5, transform: "scale(1.4)" },
  },
}));

// ─── Constants ────────────────────────────────────────────────────────
// ✅ เดิม TYPE_LIST/SYSTEM_LIST ล็อกไว้ตายตัวแค่ 5/3 ชนิด ไม่ตรงกับข้อมูลจริงในระบบเลย (จริงๆ มี
// ประเภทงาน 13 แบบ, ระบบ 4 แบบ ผ่านตาราง JobType/SystemType ที่จัดการได้จากหน้า "ประเภทงาน/ระบบ")
// ย้ายไปดึงจาก JobTypeService/SystemTypeService แบบไดนามิกแทน (ดู typeOptions/systemOptions
// ในคอมโพเนนต์หลัก) ให้ตัวกรองตรงกับข้อมูลจริงเสมอ ไม่ต้องแก้โค้ดทุกครั้งที่มีคนเพิ่มประเภท/ระบบใหม่
const STATUS_BILLING = ["วางบิลแล้ว", "เก็บเงินแล้ว"];
const OP_LIST      = ["กำลังรอยืนยัน", "ยืนยันแล้ว", "กำลังดำเนินการ", "ดำเนินการเสร็จสิ้น"];

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

const ACTION_META = {
  check_in:       { label: "เช็คอิน",          icon: <Login sx={{ fontSize: 13 }} />,       color: "#8b5cf6" },
  check_out:      { label: "เช็คเอาท์",         icon: <Logout sx={{ fontSize: 13 }} />,      color: "#10b981" },
  note_saved:     { label: "บันทึกสรุปงาน",     icon: <Edit sx={{ fontSize: 13 }} />,        color: "#3b82f6" },
  report_saved:   { label: "บันทึก Report",     icon: <NoteAdd sx={{ fontSize: 13 }} />,     color: "#10b981" },
  file_uploaded:  { label: "อัปโหลดไฟล์",       icon: <CloudUpload sx={{ fontSize: 13 }} />, color: "#f59e0b" },
  status_changed: { label: "เปลี่ยนสถานะ",      icon: <Circle sx={{ fontSize: 7 }} />,       color: "#6b7280" },
  close_requested:{ label: "ขอปิดงาน",          icon: <TaskAlt sx={{ fontSize: 13 }} />,     color: "#f59e0b" },
  close_approved: { label: "อนุมัติปิดงาน",      icon: <CheckCircle sx={{ fontSize: 13 }} />, color: "#10b981" },
  close_rejected: { label: "ไม่อนุมัติปิดงาน",    icon: <Cancel sx={{ fontSize: 13 }} />,      color: "#ef4444" },
  document_checked:        { label: "ทำเครื่องหมายเอกสาร", icon: <CheckCircle sx={{ fontSize: 13 }} />, color: "#3b82f6" },
  document_applicable_set: { label: "ระบุมี/ไม่มีเอกสาร",   icon: <TaskAlt sx={{ fontSize: 13 }} />,     color: "#8b5cf6" },
  // ✅ เดิมไม่มี entry นี้ ทำให้ log การลบไฟล์ (ถ้ามี) โชว์เป็น "file_deleted" ดิบๆ แทนป้ายภาษาไทย
  file_deleted:   { label: "ลบไฟล์",            icon: <Delete sx={{ fontSize: 13 }} />,      color: "#ef4444" },
  // ✅ ระบบติดตามใบเสนอราคา (หน้า /quotations) — บันทึกลง activityLog เดียวกับที่ใช้อยู่แล้ว
  quotation_sent:     { label: "ส่งใบเสนอราคาให้ลูกค้า",   icon: <RequestQuote sx={{ fontSize: 13 }} />, color: "#3b82f6" },
  quotation_approved: { label: "ลูกค้าอนุมัติใบเสนอราคา",  icon: <CheckCircle sx={{ fontSize: 13 }} />,  color: "#10b981" },
  quotation_rejected: { label: "ลูกค้าปฏิเสธใบเสนอราคา",   icon: <Cancel sx={{ fontSize: 13 }} />,       color: "#ef4444" },
  quotation_revising: { label: "แก้ไขใบเสนอราคาใหม่",      icon: <Edit sx={{ fontSize: 13 }} />,         color: "#f59e0b" },
  quotation_followup: { label: "บันทึกการติดตามลูกค้า",    icon: <History sx={{ fontSize: 13 }} />,      color: "#3b82f6" },
};

// ✅ ใช้แปะป้ายชนิดเอกสารในประวัติกิจกรรม (อัปโหลด/ลบไฟล์) ให้อ่านง่าย ตรงกับ label ที่ใช้ในฟอร์มจริง
const DOC_TYPE_LABELS = {
  report: "Service Report",
  quotation: "ใบเสนอราคา",
  invoice: "ใบวางบิล",
  completion: "ใบส่งมอบงาน",
};

// ─── Helper Functions ─────────────────────────────────────────────────
const getFileType = (fileName = "") => {
  if (!fileName || typeof fileName !== "string") return "unknown";
  const lower = fileName.toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp"].some(e => lower.endsWith(e))) return "image";
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".doc") || lower.endsWith(".docx")) return "word";
  if (lower.endsWith(".xls") || lower.endsWith(".xlsx")) return "excel";
  return "unknown";
};

// ✅ รวม company · site แบบไม่โชว์ "—" ซ้ำเวลาช่องใดช่องหนึ่งว่าง (เดิม `{company || "—"} · {site || "—"}`
// จะเห็น "— · ไซต์" หรือ "บริษัท · —" เป็นขีดลอยๆ ดูรก/เหมือนบั๊กเวลาข้อมูลไม่ครบทั้งคู่)
const companySite = (company, site) => {
  if (company && site) return `${company} · ${site}`;
  return company || site || "ไม่ระบุบริษัท/ไซต์";
};

const fileTypeIcon = (fileName) => {
  const t = getFileType(fileName);
  if (t === "image") return <Image sx={{ color: "#10b981" }} />;
  if (t === "pdf")   return <PictureAsPdf sx={{ color: "#ef4444" }} />;
  if (t === "word")  return <Article sx={{ color: "#3b82f6" }} />;
  if (t === "excel") return <InsertDriveFile sx={{ color: "#10b981" }} />;
  return <AttachFile sx={{ color: "#6b7280" }} />;
};

// ไฟล์เก็บบน Cloudinary (คนละโดเมน) และบาง URL เก่าอาจไม่มีนามสกุลติดมาด้วย
// (ไฟล์ resource_type "raw" ที่อัปโหลดไว้ก่อนแก้ backend) จึงดึงไฟล์มาเป็น blob
// แล้วสั่งดาวน์โหลดเอง เพื่อบังคับชื่อไฟล์ + นามสกุลที่ถูกต้องจากฐานข้อมูลเสมอ
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
    window.open(url, "_blank"); // fallback: เปิดไฟล์ให้ผู้ใช้บันทึกเอง
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ─── NEW: LiveTrackingPanel ───────────────────────────────────────────
// แสดงสถานะช่างแบบ real-time (auto-refresh 30s), กดดูรายละเอียดได้
// ═══════════════════════════════════════════════════════════════════════
const LiveTrackingPanel = ({ events, onRefresh, lastRefreshed }) => {
  const today = moment().format("YYYY-MM-DD");

  // งานวันนี้ที่มีการ check-in หรือกำลังดำเนินการ
  const todayActive = useMemo(() => {
    return events.filter(e => {
      const isToday = moment(e.start).format("YYYY-MM-DD") === today
        || (e.checkedInAt && moment(e.checkedInAt).format("YYYY-MM-DD") === today);
      return isToday && (e.checkedInAt || e.status === "กำลังดำเนินการ");
    }).sort((a, b) => {
      // เรียงตาม check-in ล่าสุด
      const aTime = a.checkedInAt ? new Date(a.checkedInAt) : new Date(a.start);
      const bTime = b.checkedInAt ? new Date(b.checkedInAt) : new Date(b.start);
      return bTime - aTime;
    });
  }, [events, today]);

  const [expanded, setExpanded] = useState(true);

  // return (
  //   <GlassCard sx={{ mb: 3, border: "1px solid", borderColor: alpha("#8b5cf6", 0.2) }}>
  //     <CardContent sx={{ p: 2.5 }}>
  //       {/* Header */}
  //       <Stack direction="row" alignItems="center" justifyContent="space-between" mb={expanded ? 2 : 0}>
  //         <Stack direction="row" alignItems="center" gap={1}>
  //           <PulseDot color={todayActive.length > 0 ? "#10b981" : "#6b7280"} />
  //           <Typography variant="subtitle2" fontWeight={700}>
  //             งานที่กำลังดำเนินการ
  //           </Typography>
  //           <Chip
  //             label={`${todayActive.length} งาน`}
  //             size="small"
  //             sx={{
  //               height: 20, fontSize: "0.68rem", fontWeight: 700,
  //               bgcolor: alpha("#8b5cf6", 0.1), color: "#8b5cf6",
  //             }}
  //           />
  //           {lastRefreshed && (
  //             <Typography variant="caption" color="text.disabled">
  //               · อัปเดต {moment(lastRefreshed).format("HH:mm:ss")}
  //             </Typography>
  //           )}
  //         </Stack>
  //         <Stack direction="row" gap={0.5}>
  //           <Tooltip title="รีเฟรชข้อมูล">
  //             <IconButton size="small" onClick={onRefresh}>
  //               <Refresh sx={{ fontSize: 16 }} />
  //             </IconButton>
  //           </Tooltip>
  //           <IconButton size="small" onClick={() => setExpanded(p => !p)}>
  //             {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
  //           </IconButton>
  //         </Stack>
  //       </Stack>

  //       <Collapse in={expanded}>
  //         {todayActive.length === 0 ? (
  //           <Box sx={{ textAlign: "center", py: 3, color: "text.disabled" }}>
  //             <AccessTime sx={{ fontSize: 36, opacity: 0.25, mb: 0.5 }} />
  //             <Typography variant="body2">ไม่มีช่างที่กำลังทำงานอยู่ขณะนี้</Typography>
  //           </Box>
  //         ) : (
  //           <Stack spacing={1.5}>
  //             {todayActive.map(ev => {
  //               const isCheckedOut = Boolean(ev.checkedOutAt);
  //               const isActive     = ev.checkedInAt && !ev.checkedOutAt;
  //               const duration     = ev.checkedInAt
  //                 ? moment.duration(
  //                     moment(isCheckedOut ? ev.checkedOutAt : undefined).diff(moment(ev.checkedInAt))
  //                   ).humanize()
  //                 : null;

  //               // หาช่างจาก activityLog
  //               const techNames = [...new Set(
  //                 (ev.activityLog || [])
  //                   .filter(l => l.action === "check_in" && l.userName)
  //                   .map(l => l.userName)
  //               )];

  //               const latestLog = [...(ev.activityLog || [])].reverse()[0];

  //               return (
  //                 <Box key={ev._id} sx={{
  //                   p: 1.5, borderRadius: 2,
  //                   border: "1px solid",
  //                   borderColor: isActive
  //                     ? alpha("#8b5cf6", 0.25)
  //                     : isCheckedOut
  //                       ? alpha("#10b981", 0.2)
  //                       : alpha("#6b7280", 0.15),
  //                   background: isActive
  //                     ? alpha("#8b5cf6", 0.03)
  //                     : isCheckedOut
  //                       ? alpha("#10b981", 0.03)
  //                       : "transparent",
  //                 }}>
  //                   <Stack direction="row" alignItems="flex-start" gap={1.5}>
  //                     {/* Status dot */}
  //                     <Box sx={{ pt: 0.5 }}>
  //                       {isActive
  //                         ? <PulseDot color="#8b5cf6" />
  //                         : <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#10b981" }} />
  //                       }
  //                     </Box>

  //                     <Box flex={1} minWidth={0}>
  //                       {/* บริษัท + ไซต์ */}
  //                       <Typography fontWeight={700} fontSize="0.875rem" noWrap>
  //                         {ev.company || "—"} · {ev.site || "—"}
  //                       </Typography>

  //                       {/* ช่าง */}
  //                       {techNames.length > 0 && (
  //                         <Stack direction="row" gap={0.5} alignItems="center" mt={0.3}>
  //                           <Person sx={{ fontSize: 13, color: "text.secondary" }} />
  //                           <Typography variant="caption" color="text.secondary">
  //                             {techNames.join(", ")}
  //                           </Typography>
  //                         </Stack>
  //                       )}

  //                       {/* เวลา */}
  //                       <Stack direction="row" gap={1.5} mt={0.5} flexWrap="wrap">
  //                         {ev.checkedInAt && (
  //                           <Stack direction="row" alignItems="center" gap={0.4}>
  //                             <Login sx={{ fontSize: 12, color: "#8b5cf6" }} />
  //                             <Typography variant="caption" color="#8b5cf6" fontWeight={600}>
  //                               {moment(ev.checkedInAt).format("HH:mm")}
  //                             </Typography>
  //                           </Stack>
  //                         )}
  //                         {ev.checkedOutAt && (
  //                           <Stack direction="row" alignItems="center" gap={0.4}>
  //                             <Logout sx={{ fontSize: 12, color: "#10b981" }} />
  //                             <Typography variant="caption" color="#10b981" fontWeight={600}>
  //                               {moment(ev.checkedOutAt).format("HH:mm")}
  //                             </Typography>
  //                           </Stack>
  //                         )}
  //                         {duration && (
  //                           <Typography variant="caption" color="text.disabled">· {duration}</Typography>
  //                         )}
  //                       </Stack>

  //                       {/* workNote preview */}
  //                       {ev.workNote && (
  //                         <Typography variant="caption" color="text.secondary"
  //                           sx={{
  //                             display: "block", mt: 0.75, fontStyle: "italic",
  //                             overflow: "hidden", textOverflow: "ellipsis",
  //                             whiteSpace: "nowrap", maxWidth: "100%",
  //                           }}>
  //                           "{ev.workNote.slice(0, 80)}{ev.workNote.length > 80 ? "…" : ""}"
  //                         </Typography>
  //                       )}

  //                       {/* latest activity */}
  //                       {latestLog && (
  //                         <Typography variant="caption" color="text.disabled"
  //                           sx={{ display: "block", mt: 0.25 }}>
  //                           อัปเดตล่าสุด: {moment(latestLog.timestamp).locale("th").fromNow()}
  //                         </Typography>
  //                       )}
  //                     </Box>

  //                     {/* Status chip */}
  //                     <Chip
  //                       label={isActive ? "กำลังทำ" : "กำลังดำเนินการ"}
  //                       size="small"
  //                       sx={{
  //                         height: 22, fontSize: "0.68rem", fontWeight: 700,
  //                         bgcolor: isActive ? alpha("#8b5cf6", 0.12) : alpha("#8b5cf6", 0.12),
  //                         color: isActive ? "#8b5cf6" : "#8b5cf6",
  //                         flexShrink: 0,
  //                       }}
  //                     />
  //                   </Stack>
  //                 </Box>
  //               );
  //             })}
  //           </Stack>
  //         )}
  //       </Collapse>
  //     </CardContent>
  //   </GlassCard>
  // );
};

// ═══════════════════════════════════════════════════════════════════════
// ─── NEW: ClosureRequestsPanel ─────────────────────────────────────────
// แยกงานที่ช่างส่ง "ขอปิดงาน" ออกมาให้เห็นชัดในที่เดียว ไม่ต้องไล่หาใน
// ลิสต์หลักที่มีการแบ่งหน้า/กรองอยู่ — อนุมัติ/ไม่อนุมัติได้จากพาแนลนี้เลย
// อ้างอิงจาก events ทั้งหมด (ไม่ผ่านตัวกรอง/pagination ของตาราง)
// ═══════════════════════════════════════════════════════════════════════
const ClosureRequestsPanel = ({ events, onReject }) => {
  const navigate = useNavigate();
  const [expanded,     setExpanded]     = useState(true);
  const [busyId,       setBusyId]       = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  // ✅ งานที่เข้าหลายวันไม่ติดกัน (ผูกด้วย jobGroupId เดียวกัน) ตอนขอปิดงานตอนนี้ตั้ง
  // closeRequested:true ให้ทุกวันในกลุ่มพร้อมกันแล้ว (ดู handleRequestClose ใน
  // TechnicianJobPanel.js) — ถ้าไม่จัดกลุ่มตรงนี้ด้วย จะเห็นงานเดียวกันโผล่ซ้ำเป็นหลายแถวเท่า
  // จำนวนวันที่เข้างาน ต้องกดอนุมัติทีละแถว ทั้งที่จริงเป็นงานเดียว รวมเป็น 1 แถวต่อ 1 งาน แทน
  // (เทียบ pattern เดียวกับ JobGroupBlock) กดอนุมัติ/ไม่อนุมัติทีเดียวจบทั้งกลุ่ม
  const pendingGroups = useMemo(() => {
    const map = new Map();
    events
      .filter(e => e.closeRequested)
      .forEach(e => {
        const key = getOverdueGroupKey(e);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(e);
      });
    return [...map.values()]
      .map(sessions => sessions.slice().sort((a, b) => new Date(b.start) - new Date(a.start)))
      .sort((a, b) => new Date(b[0].closeRequestedAt || 0) - new Date(a[0].closeRequestedAt || 0));
  }, [events]);

  // ✅ ไม่มีคำขอปิดงานรออยู่เลย = ไม่ต้องโชว์การ์ดนี้ทิ้งไว้เปล่าๆ (เดิมโชว์ตลอดพร้อมข้อความ
  // "ยังไม่มีคำขอปิดงาน...") กินพื้นที่ด้านบนสุดของหน้าโดยไม่มีอะไรให้ทำ ซ่อนไปเลยดีกว่า
  if (pendingGroups.length === 0) return null;

  const handleRejectConfirm = async () => {
    if (!rejectTarget) return;
    setBusyId(rejectTarget);
    await onReject(rejectTarget, rejectReason.trim());
    setBusyId(null);
    setRejectTarget(null);
    setRejectReason("");
  };

  return (
    <GlassCard sx={{ mb: 3, border: "1px solid", borderColor: alpha("#f59e0b", 0.25) }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={expanded ? 2 : 0}>
          <Stack direction="row" alignItems="center" gap={1}>
            <PulseDot color="#f59e0b" />
            <Typography variant="subtitle2" fontWeight={700}>
              งานที่ช่างขอปิด · รอตรวจสอบ
            </Typography>
            <Chip
              label={`${pendingGroups.length} งาน`}
              size="small"
              sx={{
                height: 20, fontSize: "0.68rem", fontWeight: 700,
                bgcolor: alpha("#f59e0b", 0.12), color: "#f59e0b",
              }}
            />
          </Stack>
          <IconButton size="small" onClick={() => setExpanded(p => !p)}>
            {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          </IconButton>
        </Stack>

        <Collapse in={expanded}>
            <Stack spacing={1.5}>
              {pendingGroups.map(sessions => {
                const ev = sessions[0];
                const isGrouped = sessions.length > 1;
                // ✅ นับ "จำนวนวันเข้างานจริง" รวมทุกวันในแต่ละช่วง (เทียบ pattern เดียวกับ
                // JobGroupBlock) ให้แอดมินเห็นก่อนกดอนุมัติว่างานนี้จริงๆ เข้ากี่วัน ไม่ใช่แค่ 1 วัน
                const dayEnd = s => moment(s.end || s.start).subtract(s.allDay ? 1 : 0, "days").startOf("day");
                const totalWorkDays = sessions.reduce((sum, s) => {
                  const days = dayEnd(s).diff(moment(s.start).startOf("day"), "days") + 1;
                  return sum + Math.max(days, 1);
                }, 0);
                return (
                <Box key={ev.jobGroupId || ev._id} sx={{
                  p: 1.5, borderRadius: 2, border: "1px solid",
                  borderColor: alpha("#f59e0b", 0.25), background: alpha("#f59e0b", 0.03),
                }}>
                  <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "flex-start" }} gap={1.5}>
                    <Stack direction="row" alignItems="flex-start" gap={1.5} flex={1} minWidth={0}>
                      <HourglassTop sx={{ fontSize: 18, color: "#f59e0b", mt: 0.3, flexShrink: 0 }} />
                      <Box flex={1} minWidth={0}>
                        <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                          <Typography fontWeight={700} fontSize="0.875rem" noWrap>
                            {companySite(ev.company, ev.site)}
                          </Typography>
                          {isGrouped && (
                            <Chip label={`เข้างาน ${totalWorkDays} วัน`} size="small"
                              sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700, bgcolor: alpha("#dc2626", 0.15), color: "#dc2626" }} />
                          )}
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                          {ev.closeRequestedBy || "ช่าง"} ขอปิดงาน
                          {ev.closeRequestedAt && ` · ${moment(ev.closeRequestedAt).locale("th").fromNow()}`}
                        </Typography>
                        {ev.workNote && (
                          <Typography variant="caption" color="text.secondary"
                            sx={{
                              display: "block", mt: 0.5, fontStyle: "italic",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                            "{ev.workNote.slice(0, 100)}{ev.workNote.length > 100 ? "…" : ""}"
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                    {/* ✅ ปุ่ม "ตรวจสอบ" — เดิมพาไปหน้า Operation แบบเจาะจงงานตัวเดียว (/operation/:id)
                        เปลี่ยนเป็นพาไปที่ "รายการงานทั้งหมด" ในแท็บ "รอคุณอนุมัติ" แล้วเลื่อนจอ +
                        ไฮไลต์กรอบกระพริบไปที่งานนั้นแทน ให้เห็นบริบทงานอื่นๆ ที่รอตรวจสอบด้วยกัน ไม่ใช่
                        เห็นแค่งานเดียวโดดๆ (ดู highlightId/scroll effect ในคอมโพเนนต์หลัก Operation)
                        ✅ ตัดปุ่ม "อนุมัติ" ออกจากพาแนลนี้ตามที่ขอ — ต้องกด "ตรวจสอบ" ไปดูรายละเอียด
                        เต็มๆ ก่อนเท่านั้น (อนุมัติได้จากการ์ดงานจริงแทน) กัน "อนุมัติมั่ว" โดยไม่ได้ดู */}
                    <Stack direction="row" gap={0.75} flexShrink={0} flexWrap="wrap" sx={{ width: { xs: "100%", sm: "auto" } }}>
                      <Button size="small" color="warning" variant="contained"
                        startIcon={<Visibility sx={{ fontSize: 15 }} />}
                        // ✅ ต่อ &t=<timestamp> ต่อท้ายเสมอ — เดิมกด "ตรวจสอบ" งานเดิมซ้ำ (หลังกด
                        // ครั้งแรกไปแล้ว) จะได้ URL เหมือนเดิมทุกตัวอักษร (ถ้ายังไม่ได้เปลี่ยนหน้า/
                        // กรองอะไรเลย) react-router มองว่าเป็นการนำทางไปที่เดิม ไม่ถือเป็นการเปลี่ยน
                        // location ใหม่ ทำให้ effect ที่ฟัง searchParams ไม่ทำงานซ้ำ ต้องรีเฟรชก่อน
                        // ถึงจะกดซ้ำได้ — ใส่ timestamp ให้ query string ไม่ซ้ำกันทุกครั้งที่กด
                        // การันตีว่าเป็น navigation ใหม่เสมอ ไม่ว่าจะกดงานเดิมกี่ครั้งก็ตาม
                        onClick={() => navigate(`/operation?group=pending&highlight=${ev._id}&t=${Date.now()}`)}
                        sx={{ flex: { xs: 1, sm: "initial" }, borderRadius: 2, textTransform: "none", fontWeight: 700 }}>
                        ตรวจสอบ
                      </Button>
                      <Button size="small" color="error" variant="outlined"
                        startIcon={<Cancel sx={{ fontSize: 15 }} />}
                        disabled={busyId === ev._id}
                        onClick={() => { setRejectTarget(ev._id); setRejectReason(""); }}
                        sx={{ flex: { xs: 1, sm: "initial" }, borderRadius: 2, textTransform: "none", fontWeight: 700 }}>
                        ไม่อนุมัติ
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
                );
              })}
            </Stack>
        </Collapse>
      </CardContent>

      {/* Dialog: ระบุเหตุผลที่ไม่อนุมัติ */}
      <Dialog open={Boolean(rejectTarget)} onClose={() => !busyId && setRejectTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>ไม่อนุมัติปิดงาน</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1.5 }}>
            ระบุเหตุผล/คอมเมนต์ที่ไม่อนุมัติ เพื่อแจ้งให้ช่างทราบและแก้ไข
          </DialogContentText>
          <TextField
            autoFocus fullWidth multiline minRows={3}
            placeholder="เช่น ไฟล์ใบเสนอราคายังไม่ครบ กรุณาแนบเพิ่ม"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectTarget(null)} disabled={Boolean(busyId)}>ยกเลิก</Button>
          <Button variant="contained" color="error" onClick={handleRejectConfirm} disabled={Boolean(busyId)}>
            {busyId ? "กำลังบันทึก..." : "ยืนยันไม่อนุมัติ"}
          </Button>
        </DialogActions>
      </Dialog>
    </GlassCard>
  );
};

// ─── NotificationBell ─────────────────────────────────────────────────
// ✅ ย้ายไปเป็น shared hook (useEventNotifications) + shared component
// (components/Notifications/NotificationBell) ให้ Header ใช้ร่วมได้ทุกหน้า
// ไม่ใช่แค่ตอนเปิดหน้า Operation ค้างไว้เท่านั้น

// ─── ActivityLogMini ──────────────────────────────────────────────────
const ActivityLogMini = ({ logs = [] }) => {
  const [open, setOpen] = useState(false);
  if (logs.length === 0) return null;
  const sorted = [...logs].reverse();
  return (
    <Box>
      <Button
        size="small"
        startIcon={<History sx={{ fontSize: 15 }} />}
        onClick={() => setOpen(p => !p)}
        endIcon={open ? <ExpandLess sx={{ fontSize: 15 }} /> : <ExpandMore sx={{ fontSize: 15 }} />}
        sx={{ color: "text.secondary", fontWeight: 600, fontSize: "0.73rem", px: 0, py: 0.25 }}>
        ประวัติการอัปเดต ({logs.length})
      </Button>
      <Collapse in={open}>
        <Stack spacing={1} sx={{ mt: 1, pl: 1.5, borderLeft: "2px solid", borderColor: "divider" }}>
          {sorted.map((log, i) => {
            const meta = ACTION_META[log.action] || { label: log.action, color: "#6b7280", icon: <Circle sx={{ fontSize: 7 }} /> };
            return (
              <Box key={i} sx={{ position: "relative" }}>
                <Box sx={{
                  position: "absolute", left: -13, top: 4,
                  width: 8, height: 8, borderRadius: "50%",
                  bgcolor: meta.color, border: "2px solid", borderColor: "background.paper",
                }} />
                <Stack direction="row" gap={0.5} alignItems="center" flexWrap="wrap">
                  <Box sx={{ color: meta.color, display: "flex" }}>{meta.icon}</Box>
                  <Typography variant="caption" fontWeight={700} color={meta.color}>{meta.label}</Typography>
                  {log.userName && <Typography variant="caption" color="text.secondary">· {log.userName}</Typography>}
                  <Typography variant="caption" color="text.disabled">
                    · {moment(log.timestamp).locale("th").format("DD MMM HH:mm")}
                  </Typography>
                </Stack>
                {log.detail && (
                  <Typography variant="caption" color="text.disabled"
                    sx={{ display: "block", fontStyle: "italic", pl: 2.5, mt: 0.15 }}>
                    {log.detail}
                  </Typography>
                )}
              </Box>
            );
          })}
        </Stack>
      </Collapse>
    </Box>
  );
};

// ─── FileUploadSection ────────────────────────────────────────────────
// เอกสารแต่ละชนิดแนบได้หลายไฟล์ (files คือ array) — เพิ่ม/ลบทีละไฟล์ได้อิสระ
// ✅ ไอคอน/สีเฉพาะของเอกสารแต่ละชนิด (เทียบ pattern เดียวกับ DOCUMENT_TYPES ใน
// TechnicianJobPanel.js) ให้หัวข้อแต่ละช่องแยกออกจากกันชัดเจนด้วยตา ไม่ต้องอ่านชื่อก็จำได้
const DOC_TYPE_META = {
  report:     { icon: Description,        color: "#3b82f6" },
  quotation:  { icon: RequestQuote,       color: "#ef4444" },
  invoice:    { icon: ReceiptLong,        color: "#f59e0b" },
  completion: { icon: AssignmentTurnedIn, color: "#07941a" },
};

// ✅ perf: แยกแถวไฟล์ออกมาเป็นคอมโพเนนต์ของตัวเอง + React.memo — เดิมแถวไฟล์ทั้งหมดอยู่ใน .map()
// ในตัว FileUploadSection เอง พอ auto-refresh ทุก 15 วิ แทนที่ events ทั้งก้อนด้วย object ใหม่
// (แม้ข้อมูลจริงจะไม่เปลี่ยน) ทุกแถวไฟล์ (Tooltip×2 + IconButton×2 ต่อแถว) ต้อง re-render ใหม่หมดทุกครั้ง
// งานที่มีไฟล์เยอะๆ (เช่น 9 ไฟล์ใน Service Report จากภาพที่ผู้ใช้ส่งมา) นี่คือส่วนที่หนักที่สุดของการ์ด
// เทียบด้วยค่าจริง (_id/fileUrl/fileName) ไม่ใช่ reference ของ object ไฟล์ (ซึ่งเปลี่ยนทุก poll อยู่แล้ว
// แม้เนื้อหาเดิม) — ต้องรับ onPreview/onOpenMenu แบบ stable reference (useCallback ที่ต้นทาง) ไม่งั้น
// memo จะไม่มีผลอะไรเลยเพราะ props เปลี่ยนทุกครั้งอยู่ดี
const FileRow = React.memo(
  ({ file: f, onPreview, onOpenMenu }) => (
    <Stack direction="row" alignItems="center" gap={0.5} sx={{
      p: 1.25, borderRadius: 2, border: "1px solid", borderColor: "divider",
      background: t => alpha(t.palette.success.main, 0.04),
    }}>
      {fileTypeIcon(f.fileName)}
      <Box flex={1} minWidth={0} onClick={() => onPreview(f.fileUrl, f.fileName)} sx={{ cursor: "pointer" }}>
        <Typography variant="caption" fontWeight={600} noWrap sx={{ fontSize: "0.8rem", display: "block" }}>{f.fileName}</Typography>
      </Box>
      <Tooltip title="ดูไฟล์">
        <IconButton onClick={() => onPreview(f.fileUrl, f.fileName)} sx={{ p: 1 }}><Visibility sx={{ fontSize: 20 }} /></IconButton>
      </Tooltip>
      <Tooltip title="เพิ่มเติม">
        <IconButton onClick={e => onOpenMenu(e.currentTarget, f)} sx={{ p: 1 }}>
          <MoreVert sx={{ fontSize: 20 }} />
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

export const FileUploadSection = ({
  eventId, type, label, files, applicable,
  onUpload, onDelete, onPreview,
  uploading, progress, uploading_size, currentUserRole,
}) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = React.useRef();
  const overrideInputRef = React.useRef();
  const canEdit  = ["admin", "manager", "user"].includes(currentUserRole);

  // ✅ เมนู "⋮" ต่อไฟล์ — เดิมโชว์ปุ่มดาวน์โหลด/ลบเรียงเป็นไอคอนแยกทุกแถว ดูรกตาเวลามีหลายไฟล์
  // รวมเป็นเมนูเดียว เหลือแค่ปุ่มดูไฟล์ (บ่อยสุด) + ปุ่ม "⋮" แยกต่างหาก
  const [fileMenu, setFileMenu] = useState(null); // { el, file }
  const closeFileMenu = () => setFileMenu(null);
  // ✅ perf: stable reference ให้ FileRow ที่ memo ไว้เทียบ props ได้จริง (setFileMenu จาก useState
  // เป็น stable อยู่แล้ว ห่อด้วย useCallback deps [] เฉยๆ เพื่อความชัดเจน)
  const handleOpenFileMenu = useCallback((el, file) => setFileMenu({ el, file }), []);

  const fileList = files || [];
  const hasFiles = fileList.length > 0;

  const handleDrop = e => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) onUpload(e.dataTransfer.files, eventId, type);
  };

  // ช่างระบุไว้แล้วว่างานนี้ "ไม่มี" เอกสารชนิดนี้ (ใบเสนอราคา/ใบวางบิล/ใบส่งมอบงาน)
  const notApplicable = applicable === false && !hasFiles;

  // ✅ เดิมหัวข้อเป็นตัวหนังสือพิมพ์ใหญ่เรียบๆ สีเดียวกันหมดทุกประเภท แยกด้วยตายาก โดยเฉพาะเวลามอง
  // เร็วๆ — เพิ่มไอคอนวงกลมสีเฉพาะตัว + ตัวหนังสือหัวข้อเด่นขึ้น + ชิปนับจำนวนไฟล์สีเดียวกับไอคอน
  // ให้แต่ละประเภทเอกสารจำได้ทันทีด้วยสี ไม่ต้องอ่านชื่อ
  const meta = DOC_TYPE_META[type] || { icon: Description, color: "#6b7280" };
  const TypeIcon = meta.icon;

  return (
    <Box>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.25 }}>
        <Box sx={{
          width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          bgcolor: alpha(meta.color, 0.12), color: meta.color,
        }}>
          <TypeIcon sx={{ fontSize: 16 }} />
        </Box>
        <Typography variant="subtitle2" fontWeight={800} sx={{ flex: 1, minWidth: 0 }} noWrap>
          {label}
        </Typography>
        {hasFiles && (
          <Chip label={fileList.length} size="small" sx={{
            height: 20, minWidth: 20, fontWeight: 700, fontSize: "0.7rem",
            bgcolor: alpha(meta.color, 0.15), color: meta.color,
          }} />
        )}
      </Stack>

      {/* ✅ ถ้ามีไฟล์เยอะ (เช่น 6+ ไฟล์) จำกัดความสูงแล้วเลื่อนดูแทน ไม่ให้รายการยาวจนดันเนื้อหา
          ส่วนอื่นไปไกล ทำให้หน้าดูไม่เป็นระบบเวลาไฟล์เยอะ */}
      {hasFiles && (
        <Stack spacing={0.75} sx={{ mb: uploading || canEdit ? 1 : 0, maxHeight: 260, overflowY: "auto", pr: 0.5 }}>
          {fileList.map(f => (
            <FileRow key={f._id || f.fileUrl} file={f} onPreview={onPreview} onOpenMenu={handleOpenFileMenu} />
          ))}
        </Stack>
      )}

      {/* เมนู "⋮" ต่อไฟล์ — ดาวน์โหลด/พิมพ์/แชร์/ลบ รวมไว้ที่เดียว แทนไอคอนแยกเรียงเต็มแถว */}
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
              <ListItemText>แชร์ไฟล์</ListItemText>
            </MenuItem>
          </>
        )}
        {canEdit && [
          <Divider key="file-menu-divider" />,
          <MenuItem key="file-menu-delete" onClick={() => { onDelete(eventId, type, fileMenu.file._id); closeFileMenu(); }} sx={{ gap: 1.5, minHeight: 44, color: "error.main" }}>
            <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>ลบไฟล์</ListItemText>
          </MenuItem>,
        ]}
      </Menu>

      {uploading ? (
        <Box sx={{ p: 1.5, borderRadius: 2, border: "1px solid", borderColor: "primary.main" }}>
          <Stack direction="row" gap={1} alignItems="center" mb={0.5}>
            <CloudUpload fontSize="small" color="primary" />
            <Typography variant="caption">กำลังอัปโหลด... {uploading_size}</Typography>
          </Stack>
          <LinearProgress variant="determinate" value={progress} sx={{ borderRadius: 2 }} />
          <Typography variant="caption" color="text.secondary">{progress}%</Typography>
        </Box>
      ) : notApplicable ? (
        <Box sx={{
          p: 1.5, borderRadius: 2, border: "1px dashed", borderColor: alpha("#6b7280", 0.4),
          textAlign: "center", bgcolor: alpha("#6b7280", 0.05),
        }}>
          <Stack direction="row" alignItems="center" justifyContent="center" gap={0.5}>
            <Close sx={{ fontSize: 16, color: "text.disabled" }} />
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              ไม่มีเอกสารนี้ (ช่างระบุไว้)
            </Typography>
          </Stack>
          {canEdit && (
            <>
              <input ref={overrideInputRef} type="file" hidden multiple
                onChange={e => { if (e.target.files?.length) onUpload(e.target.files, eventId, type); }} />
              <Button size="small" onClick={() => overrideInputRef.current?.click()}
                sx={{ textTransform: "none", fontSize: "0.72rem", mt: 0.5, minHeight: 32 }}>
                มีไฟล์จริง? แนบที่นี่
              </Button>
            </>
          )}
        </Box>
      ) : canEdit ? (
        <UploadZone
          dragging={dragging ? 1 : 0}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          sx={{
            minHeight: hasFiles ? 48 : 76, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", py: hasFiles ? 1 : undefined,
          }}>
          <input ref={inputRef} type="file" hidden multiple
            onChange={e => { if (e.target.files?.length) onUpload(e.target.files, eventId, type); }} />
          {!hasFiles && <CloudUpload sx={{ color: "text.disabled", mb: 0.5, fontSize: 26 }} />}
          <Typography variant="caption" color="text.secondary">
            {hasFiles ? "+ เพิ่มไฟล์อีก" : "แตะเพื่อเลือกไฟล์ (เลือกได้หลายไฟล์) หรือลากมาวาง"}
          </Typography>
        </UploadZone>
      ) : !hasFiles ? (
        <Box sx={{ p: 1.5, borderRadius: 2, border: "1px dashed", borderColor: "divider", textAlign: "center" }}>
          <Typography variant="caption" color="text.disabled">ไม่มีไฟล์</Typography>
        </Box>
      ) : null}
    </Box>
  );
};

// ─── CommentThread ────────────────────────────────────────────────────
// คุยโต้ตอบกับช่าง (เช่น ตอบคำขอใบเสนอราคา) แยกจาก activityLog ที่เป็น log อัตโนมัติ
// myRole ใช้กำหนดว่าข้อความฝั่งไหนคือ "ของเรา" (จัดชิดขวา) — ฝั่งแอดมิน: role !== "technician"
export const CommentThread = ({ comments = [], onSend, myRole }) => {
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
          placeholder="พิมพ์ข้อความถึงช่าง..."
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

// ─── EventRowCard ─────────────────────────────────────────────────────
const EventRowCard = ({
  event, employee, onStatusUpdate, onDocNoUpdate, onInputUpdate, onDateUpdate,
  onFileUpload, onDeleteFile, onPreview, onDelete, onApproveClose, onRejectClose,
  uploadingState, isUploadingState, uploadProgressState, uploadingFileSizeState,
  currentUserRole,
  // ✅ งานที่เข้าหลายวัน (กลุ่มเดียวกัน) ใช้เอกสารร่วมกันชุดเดียว — JobGroupBlock จะโชว์
  // เอกสารรวมไว้ที่หัวกลุ่มแทน จึงซ่อนส่วนอัปโหลดเอกสารในการ์ดรายวันแต่ละใบไม่ให้ซ้ำกัน
  hideDocuments = false,
  // ✅ เวลาอยู่ในกลุ่มงานหลายวัน JobGroupBlock จะรวมทุกวันไว้ใน GlassCard ใบเดียวกันเอง
  // (ห่อจากข้างนอก) จึงไม่ต้องมี GlassCard/เงา/ระยะห่างซ้อนของตัวเองอีกชั้น
  noOuterCard = false,
}) => {
  const [expanded,   setExpanded]   = useState(false);
  const [editingDoc, setEditingDoc] = useState(false);
  const [docNo,      setDocNo]      = useState(event.docNo || "");
  const [anchorEl,   setAnchorEl]   = useState(null);
  // ✅ เมนู "⋮" ของการ์ดงาน — เดิมปุ่มลบงานเป็นไอคอนสีแดงโชว์ตลอดเวลาข้างปุ่มพับ/กาง ดูรกและเสี่ยงกดพลาด
  const [moreAnchorEl, setMoreAnchorEl] = useState(null);
  const [localStatus,setLocalStatus]= useState(event.status || "");
  // ✅ งานกลุ่มเดียวกัน (jobGroupId) เปลี่ยนสถานะพร้อมกันทุกวันจริงอยู่แล้วที่ฝั่ง state/DB (ดู
  // handleStatusUpdate/getGroupEventIds) แต่ localStatus เป็น state ของการ์ดตัวเอง เดิม sync แค่
  // ตอน mount ครั้งเดียว (useState initial value) พอ event.status ของ "การ์ดอื่นในกลุ่มเดียวกัน"
  // อัปเดตจาก props ใหม่ การ์ดนั้นๆ ไม่รู้ตัวเลยว่าเปลี่ยนไปแล้ว ต้องรีเฟรชหน้าถึงจะเห็นตรงกัน —
  // ต้องซิงก์ตาม event.status ทุกครั้งที่ prop เปลี่ยนจริงๆ ไม่ใช่แค่ตอน mount
  useEffect(() => {
    setLocalStatus(event.status || "");
  }, [event.status]);
  const [approving,  setApproving]  = useState(false);
  const [rejecting,      setRejecting]      = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason,   setRejectReason]   = useState("");
  // ✅ เอกสารของงานกลุ่มเดียวกันปกติซ่อนไว้ (ใช้ร่วมกันที่การ์ดหลัก) แต่แอดมิน/manager
  // ยังต้องแนบ/แก้ไฟล์แยกเฉพาะวันนี้ได้เหมือนเดิมถ้าจำเป็น จึงเปิดให้กดดูเพิ่มเติมได้เสมอ
  const [showDocsOverride, setShowDocsOverride] = useState(false);
  const theme  = useTheme();
  // ✅ จอกว้างพอ (≥900px) เปิดรายละเอียดงาน (เอกสาร/คุยกับช่าง/ประวัติ) แบบ Dialog ทับขึ้นมาแทน
  // การกางลงในหน้า (Collapse) — เดิมกางแล้วเนื้อหายาวๆ ดันการ์ดอื่นในคอลัมน์เดียวกันลงมา ต้อง
  // เลื่อนจอตาม ทั้งที่จอกว้างเปิดลอยทับได้เลยโดยไม่กระทบตำแหน่งการ์ดอื่น (มือถือยังกางลงแบบเดิม)
  const isDesktop = useMediaQuery("(min-width:900px)");
  const canEdit = ["admin", "manager", "user"].includes(currentUserRole);
  const isAdminOrManager = ["admin", "manager"].includes(currentUserRole);

  // ── Send Comment (คุยกับช่าง เช่น ตอบคำขอใบเสนอราคา) ──────────────────
  const handleSendComment = async (message) => {
    const payload = JSON.parse(localStorage.getItem("payload") || "{}");
    const newComment = {
      userId: payload?.userId || "",
      userName: payload?.name || payload?.username || "แอดมิน",
      role: currentUserRole,
      message,
      timestamp: new Date().toISOString(),
    };
    await onInputUpdate(event._id, { comments: [...(event.comments || []), newComment] });
  };

  const handleStatusChange = newStatus => {
    setLocalStatus(newStatus);
    onStatusUpdate(event._id, { status: newStatus });
    setAnchorEl(null);
  };

  const handleDocSave = () => { onDocNoUpdate(event._id, docNo); setEditingDoc(false); };

  // ── แก้ไขวันที่เข้างาน — แก้เฉพาะวันนี้ (session นี้) เท่านั้น ไม่ใช่ทั้งกลุ่ม เพราะงานที่เข้า
  // หลายวันไม่ติดกัน (jobGroupId เดียวกัน) แต่ละวันมีวันที่ของตัวเองไม่เหมือนกันโดยตั้งใจ — ต่างจาก
  // สถานะที่ต้องเหมือนกันทั้งกลุ่ม (ดู handleStatusUpdate) พอบันทึกแล้ว onDateUpdate จะอัปเดต events
  // state ที่ใช้ร่วมกันทั้งแอป ทำให้หน้านี้/ภาพรวมสัญญา/ปฏิทิน เห็นวันที่ใหม่ตรงกันทันทีที่โหลดข้อมูลใหม่
  const [dateAnchorEl, setDateAnchorEl] = useState(null);
  const [editStart, setEditStart] = useState(null);
  const [editEnd, setEditEnd] = useState(null);
  const [dateSaving, setDateSaving] = useState(false);
  const [dateError, setDateError] = useState("");

  const openDateEdit = (e) => {
    e.stopPropagation();
    if (!canEdit) return;
    setEditStart(moment(event.start));
    setEditEnd(moment(event.end).subtract(event.allDay ? 1 : 0, "days"));
    setDateError("");
    setDateAnchorEl(e.currentTarget);
  };
  const closeDateEdit = () => { if (!dateSaving) setDateAnchorEl(null); };

  const handleDateSave = async () => {
    if (!editStart || !editStart.isValid()) { setDateError("กรุณาระบุวันที่เข้างาน"); return; }
    const effectiveEnd = (editEnd && editEnd.isValid()) ? editEnd : editStart;
    if (effectiveEnd.isBefore(editStart, "day")) { setDateError("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม"); return; }
    setDateSaving(true);
    setDateError("");
    try {
      const s = editStart.format("YYYY-MM-DD");
      await onDateUpdate(event._id, {
        start: s,
        end: moment(effectiveEnd).add(event.allDay ? 1 : 0, "days").format("YYYY-MM-DD"),
        date: s,
      });
      setDateSaving(false);
      setDateAnchorEl(null);
    } catch (err) {
      setDateSaving(false);
      setDateError(err?.response?.data?.message || "แก้ไขวันที่ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
  };

  // ✅ ป้องกันกดผิด/กดพลาด — กดแล้วงานเข้าสถานะ "ดำเนินการเสร็จสิ้น" ทันที (และถ้าเป็นงานกลุ่มเข้า
  // หลายวัน จะมีผลกับทุกวันในกลุ่มพร้อมกัน) แก้คืนไม่ได้ง่ายๆ ควรให้ยืนยันก่อนอีกชั้น (เทียบ pattern
  // เดียวกับตอนช่างกดขอปิดงานใน TechnicianJobPanel.js)
  const handleApprove = async () => {
    const confirm = await Swal.fire({
      title: "ยืนยันอนุมัติปิดงาน?",
      text: "งานนี้จะเข้าสถานะ \"ดำเนินการเสร็จสิ้น\" ทันที",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "อนุมัติปิดงาน",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#10b981",
    });
    if (!confirm.isConfirmed) return;

    setApproving(true);
    await onApproveClose(event._id);
    setLocalStatus("ดำเนินการเสร็จสิ้น");
    setApproving(false);
  };

  const handleReject = async () => {
    setRejecting(true);
    await onRejectClose(event._id, rejectReason.trim());
    setRejecting(false);
    setRejectDialogOpen(false);
    setRejectReason("");
  };

  // ✅ เนื้อหารายละเอียดงาน (เอกสาร/คุยกับช่าง/ประวัติ) แยกเป็นตัวแปรเดียว ใช้ร่วมกันทั้งแบบกางลง
  // ในหน้า (Collapse บนมือถือ) และแบบ Dialog ทับขึ้นมา (จอกว้าง) ไม่ต้องเขียนซ้ำสองที่
  // ✅ เดิม 4 ช่องเอกสาร (Service Report/ใบเสนอราคา/ใบวางบิล/ใบส่งมอบงาน) วางเป็น 2 คอลัมน์ (sm={6})
  // พอช่องไหนมีไฟล์เยอะ (เช่น Service Report 6 ไฟล์) จะสูงกว่าอีกฝั่งมาก ทำให้เห็นพื้นที่ว่างเปล่า
  // ข้างๆ เยอะผิดปกติ ดูไม่เป็นระบบ — เปลี่ยนเป็นคอลัมน์เดียวเรียงลงมาทั้งหมด (xs={12} เสมอ) แทน
  // ไม่มีปัญหาคอลัมน์สูงไม่เท่ากันให้กวนตาอีก (เทียบเหตุผลเดียวกับที่แก้การ์ดงานกรุ๊ปก่อนหน้านี้)
  const expandedContent = (
    <Grid container spacing={2}>
      {event.workNote && (
        <Grid item xs={12}>
          <Typography variant="caption" fontWeight={700} color="text.secondary"
            sx={{ textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 0.5 }}>
            สรุปงานที่ทำ (ช่าง)
          </Typography>
          <Box sx={{
            p: 1.5, borderRadius: 2, border: "1px solid",
            borderColor: alpha("#3b82f6", 0.25), background: alpha("#3b82f6", 0.04),
          }}>
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "pre-line", lineHeight: 1.7 }}>
              {event.workNote}
            </Typography>
          </Box>
        </Grid>
      )}

      {hideDocuments && !showDocsOverride && (
        <Grid item xs={12}>
          <Button size="small" onClick={() => setShowDocsOverride(true)}
            sx={{ textTransform: "none", fontSize: "0.75rem", color: "text.secondary" }}>
            📄 เอกสารหลักอยู่ที่การ์ดวันล่าสุด — กดเพื่อแนบ/แก้ไฟล์แยกเฉพาะวันนี้
          </Button>
        </Grid>
      )}
      {(!hideDocuments || showDocsOverride) && (
        <Grid item xs={12}>
        <FileUploadSection
          eventId={event._id} type="report" label="Service Report"
          files={event.reportFiles}
          onUpload={onFileUpload} onDelete={onDeleteFile} onPreview={onPreview}
          uploading={isUploadingState.report && uploadingState.report === event._id}
          progress={uploadProgressState.report}
          uploading_size={uploadingFileSizeState.report}
          currentUserRole={currentUserRole}
        />
      </Grid>
      )}
      {(!hideDocuments || showDocsOverride) && (
      <Grid item xs={12}>
        <FileUploadSection
          eventId={event._id} type="quotation" label="ใบเสนอราคา"
          files={event.quotationFiles}
          applicable={event.quotationApplicable}
          onUpload={onFileUpload} onDelete={onDeleteFile} onPreview={onPreview}
          uploading={isUploadingState.quotation && uploadingState.quotation === event._id}
          progress={uploadProgressState.quotation}
          uploading_size={uploadingFileSizeState.quotation}
          currentUserRole={currentUserRole}
        />
      </Grid>
      )}

      {(!hideDocuments || showDocsOverride) && (
       <Grid item xs={12}>
        <FileUploadSection
          eventId={event._id} type="invoice" label="ใบวางบิล"
          files={event.invoiceFiles}
          applicable={event.invoiceApplicable}
          onUpload={onFileUpload} onDelete={onDeleteFile} onPreview={onPreview}
          uploading={isUploadingState.invoice && uploadingState.invoice === event._id}
          progress={uploadProgressState.invoice}
          uploading_size={uploadingFileSizeState.invoice}
          currentUserRole={currentUserRole}
        />
      </Grid>
      )}

      {(!hideDocuments || showDocsOverride) && (
       <Grid item xs={12}>
        <FileUploadSection
          eventId={event._id} type="completion" label="ใบส่งมอบงาน"
          files={event.completionFiles}
          applicable={event.completionApplicable}
          onUpload={onFileUpload} onDelete={onDeleteFile} onPreview={onPreview}
          uploading={isUploadingState.completion && uploadingState.completion === event._id}
          progress={uploadProgressState.completion}
          uploading_size={uploadingFileSizeState.completion}
          currentUserRole={currentUserRole}
        />
      </Grid>
      )}

      {/* คุยกับช่าง (เช่น ตอบคำขอใบเสนอราคา) */}
      <Grid item xs={12}>
        <Divider sx={{ mb: 1.5 }} />
        <Typography variant="caption" fontWeight={700} color="text.secondary"
          sx={{ textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
          <Chat sx={{ fontSize: 14 }} /> คุยกับช่าง{(event.comments || []).length > 0 && ` (${event.comments.length})`}
        </Typography>
        <CommentThread comments={event.comments} onSend={handleSendComment} myRole={currentUserRole} />
      </Grid>

      {event.activityLog?.length > 0 && (
        <Grid item xs={12}>
          <Divider sx={{ mb: 1.5 }} />
          <ActivityLogMini logs={event.activityLog} />
        </Grid>
      )}
    </Grid>
  );

  const Wrapper = noOuterCard ? React.Fragment : GlassCard;
  // ✅ เดิมตั้ง transform:"none" ทับค่า default ของ GlassCard (ยกการ์ดขึ้นตอน hover) ทำให้ hover
  // แทบไม่รู้สึกอะไรเลยนอกจากเงาจางๆ ผู้ใช้ไม่รู้ว่ากดได้ — ใส่ animation ยกขึ้น + เงาเข้มขึ้น +
  // เส้นขอบเน้นสีชัดเจนตอน hover ให้เห็นชัดว่าเป็นการ์ดที่กดได้ (ทั้งการ์ดคลิกได้เพื่อดูรายละเอียด)
  const wrapperProps = noOuterCard
    ? {}
    : { sx: {
        mb: 1.5,
        transition: "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
        "&:hover": {
          transform: "translateY(-3px)",
          boxShadow: `0 10px 28px ${alpha(theme.palette.common.black, 0.16)}`,
          borderColor: alpha(theme.palette.primary.main, 0.3),
        },
      } };

  return (
    <Wrapper {...wrapperProps}>
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        {/* Header — กดที่ไหนก็ได้บนแถวนี้เพื่อกาง/พับการ์ดได้เลย ไม่ต้องเล็งกดลูกศรเล็กๆ อีกต่อไป
            (ปุ่ม/ลิงก์ย่อยด้านในที่มี action ของตัวเอง เช่น เปลี่ยนสถานะ/เมนู "⋮"/แก้เลขเอกสาร
            ต้อง stopPropagation ไว้ ไม่งั้นกดแล้วจะกาง/พับซ้อนกับ action หลักโดยไม่ตั้งใจ) */}
        <Stack
          direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}
          onClick={() => setExpanded(p => !p)}
          sx={{ cursor: "pointer" }}
        >
          <Stack direction="row" alignItems="flex-start" gap={1.5} flex={1} minWidth={0}>
            {/* ✅ ลดขนาดลงบนจอมือถือ (จอกว้างยังคง 40px เท่าเดิม) — การ์ดตอนนี้เนื้อหากระชับขึ้นแล้ว
                วงกลมไอคอนใหญ่แบบเดิมเลยดูไม่สมส่วนเมื่อเทียบกับตัวหนังสือที่เหลือ */}
            <Avatar sx={{
              width: { xs: 32, sm: 40 }, height: { xs: 32, sm: 40 }, flexShrink: 0, fontSize: "0.8rem", fontWeight: 700,
              background: OP_COLOR[localStatus] ? alpha(OP_COLOR[localStatus], 0.15) : alpha(theme.palette.grey[500], 0.15),
              color: OP_COLOR[localStatus] || theme.palette.text.secondary,
            }}>
              {React.cloneElement(TYPE_ICON[event.title] || <Build />, {
                fontSize: "inherit",
                sx: { fontSize: { xs: 16, sm: 20 } },
              })}
            </Avatar>
            <Box minWidth={0} flex={1}>
              {/* ✅ จัดใหม่ให้เป็นรายการ "ไอคอน + ป้ายกำกับ : ค่า" เรียงทีละบรรทัดเรียบๆ (เทียบสไตล์
                  การ์ดงานวางแผนล่วงหน้า) แทนแถว chip เดิม (สถานะ/ชื่องาน/ระบบ/ทีม ปนกันแถวเดียว
                  ดูรกเวลาจอแคบ) — StatusBadge + วันที่ (ย่อแล้ว) ไว้แถวบนสุดด้วยกัน ใช้พื้นที่กว้างๆ
                  ข้างสถานะที่เคยเว้นว่างไว้ให้เกิดประโยชน์ คู่กับไอคอนเอกสาร/กิจกรรมทางขวา —
                  ระบบ/ครั้งที่ วางคู่กัน 2 คอลัมน์ (ทั้งสองสั้น ไม่ต้องแยกคนละบรรทัดให้เปลืองที่)
                  ส่วนทีมย้ายไปไว้ล่างสุดของรายการ */}
              <Stack direction="row" alignItems="center" gap={1} mb={0.5} flexWrap="wrap">
                <Tooltip title="เปลี่ยนสถานะ">
                  <Box onClick={e => { e.stopPropagation(); canEdit && setAnchorEl(e.currentTarget); }} sx={{ cursor: canEdit ? "pointer" : "default" }}>
                    <StatusBadge color={OP_COLOR[localStatus]}>
                      <Circle sx={{ fontSize: 6 }} /> {localStatus || "ไม่ระบุ"}
                    </StatusBadge>
                  </Box>
                </Tooltip>
                {/* ✅ ป้ายรออนุมัติ/ไม่อนุมัติ — แค่บอกสถานะเฉยๆ (ไม่มีปุ่มกดที่นี่ ตัดสินใจได้ที่
                    EditEvent.js ในปฏิทินเท่านั้น กันสองจุดแย่งกันตัดสินใจงานเดียวกัน) */}
                {isPendingApproval(event) && (
                  <Tooltip title="รอแอดมิน/manager อนุมัติ (อนุมัติ/ไม่อนุมัติได้ที่ปฏิทิน)">
                    <Chip size="small" label="⏳ รออนุมัติ" sx={{
                      height: 22, fontSize: "0.7rem", fontWeight: 700,
                      bgcolor: alpha("#f59e0b", 0.15), color: "#92400e",
                    }} />
                  </Tooltip>
                )}
                {/* ✅ ป้ายประเภทงาน — โชว์เฉพาะ "โปรเจค"/"สัญญา" (กรณีพิเศษ) ไม่โชว์ "ทั่วไป" ที่นี่ กัน
                    การ์ดรกเกินไป (ต่างจากปฏิทินที่ใช้แถบสีขอบบางๆ ซึ่งเบากว่า โชว์ครบ 3 แบบได้ ดู
                    fc-event-type-* ใน EventCalendar/index.js) เทียบ pattern เดียวกับป้ายรออนุมัติ/
                    ไม่อนุมัติด้านบนที่โชว์เฉพาะกรณีพิเศษเหมือนกัน */}
                {(() => {
                  const jobClass = classifyJob(event);
                  if (jobClass !== "project" && jobClass !== "contract") return null;
                  const meta = getJobClassMeta(jobClass);
                  return (
                    <Chip size="small" label={`${meta.emoji} ${meta.label}`} sx={{
                      height: 22, fontSize: "0.7rem", fontWeight: 700,
                      bgcolor: alpha(meta.color, 0.15), color: meta.color,
                    }} />
                  );
                })()}
                {isRejected(event) && (
                  <Tooltip title={event.approvalRejectReason ? `เหตุผล: ${event.approvalRejectReason}` : "ไม่ได้รับการอนุมัติ"}>
                    <Chip size="small" label="❌ ไม่อนุมัติ" sx={{
                      height: 22, fontSize: "0.7rem", fontWeight: 700,
                      bgcolor: alpha("#ef4444", 0.15), color: "#991b1b",
                    }} />
                  </Tooltip>
                )}
                {/* ✅ ย่อช่วงวันที่ให้กระชับ (ดู formatEventDateRange) — ถ้าอยู่ปีเดียวกัน/เดือนเดียวกัน
                    ไม่ต้องพิมพ์เดือนปีซ้ำสองรอบ กันตัดขึ้นบรรทัดใหม่แบบขาดกลางวันที่บนจอแคบด้วย —
                    กดแก้ไขวันที่ได้ตรงนี้เลย (เทียบ pattern เดียวกับป้ายสถานะด้านซ้าย) */}
                <Tooltip title={canEdit ? "แก้ไขวันที่เข้างาน" : ""}>
                  <Box
                    onClick={openDateEdit}
                    sx={{
                      display: "flex", alignItems: "center", gap: 0.5,
                      px: 0.75, py: 0.25, borderRadius: 1.5,
                      cursor: canEdit ? "pointer" : "default",
                      transition: "background-color 0.15s ease",
                      "&:hover": canEdit ? { bgcolor: alpha(theme.palette.primary.main, 0.08) } : {},
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" fontWeight={600} noWrap>
                      📅 {formatEventDateRange(event)}
                    </Typography>
                    {canEdit && <Edit sx={{ fontSize: 12, color: "text.disabled" }} />}
                  </Box>
                </Tooltip>
              </Stack>

              <Popover
                open={Boolean(dateAnchorEl)}
                anchorEl={dateAnchorEl}
                onClose={closeDateEdit}
                onClick={(e) => e.stopPropagation()}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
                PaperProps={{ sx: { borderRadius: 3, boxShadow: `0 12px 32px ${alpha(theme.palette.common.black, 0.18)}` } }}
              >
                <LocalizationProvider dateAdapter={AdapterMoment}>
                  <Stack spacing={1.5} sx={{ p: 2, width: 260 }}>
                    <Typography variant="subtitle2" fontWeight={700}>แก้ไขวันที่เข้างาน</Typography>
                    <DatePicker
                      label="วันที่เริ่ม" value={editStart} onChange={setEditStart}
                      renderInput={(params) => <TextField {...params} size="small" fullWidth />}
                    />
                    <DatePicker
                      label="วันที่สิ้นสุด" value={editEnd} onChange={setEditEnd}
                      minDate={editStart || undefined}
                      renderInput={(params) => <TextField {...params} size="small" fullWidth />}
                    />
                    {dateError && <Alert severity="error" sx={{ py: 0, fontSize: "0.75rem" }}>{dateError}</Alert>}
                    <Stack direction="row" justifyContent="flex-end" gap={1}>
                      <Button size="small" onClick={closeDateEdit} disabled={dateSaving}>ยกเลิก</Button>
                      <Button size="small" variant="contained" onClick={handleDateSave} disabled={dateSaving}>
                        {dateSaving ? "กำลังบันทึก..." : "บันทึก"}
                      </Button>
                    </Stack>
                  </Stack>
                </LocalizationProvider>
              </Popover>

              {/* ✅ ไอคอนเอกสาร/กิจกรรม แยกเป็นบรรทัดของตัวเองเต็มความกว้าง ชิดขวา — เดิมพยายามยัด
                  ไว้แถวเดียวกับป้ายสถานะ/ลอยไปแถวบนสุดฝั่งขวาซึ่งไปเบียด/ทับกับป้ายสถานะบนจอแคบ
                  (ความกว้างไม่พอ) อยู่คนละบรรทัดเต็มความกว้างการ์ดแบบนี้รับประกันว่าไม่ทับกันแน่นอน
                  ไม่ว่าป้ายสถานะ/วันที่จะยาวแค่ไหน — เปลี่ยนไอคอนเอกสารแต่ละชนิดให้ไม่ซ้ำกัน (เทียบ
                  pattern เดียวกับ DOCUMENT_TYPES ใน TechnicianJobPanel.js) และคั่นกลุ่ม "เอกสาร" กับ
                  "กิจกรรม/ข้อความ/กลุ่มงาน" ด้วยเส้นแบ่งบางๆ ให้อ่านง่าย ไม่ปนกันรก */}
              {(event.reportFiles?.length > 0 || event.quotationFiles?.length > 0 || event.invoiceFiles?.length > 0 || event.completionFiles?.length > 0 || event.activityLog?.length > 0 || event.comments?.length > 0 || event.jobGroupId) && (
                <Stack direction="row" alignItems="center" justifyContent="flex-end" gap={0.7}
                  divider={<Divider orientation="vertical" flexItem sx={{ height: 14, my: "auto" }} />}
                  sx={{ mb: 0.5 }}>
                  {(event.reportFiles?.length > 0 || event.quotationFiles?.length > 0 || event.invoiceFiles?.length > 0 || event.completionFiles?.length > 0) && (
                    <Stack direction="row" alignItems="center" gap={0.5}>
                      {event.reportFiles?.length > 0     && <Tooltip title={`Service Report: ${event.reportFiles.length} ไฟล์`}><Description sx={{ fontSize: 16, color: "#3b82f6", opacity: 0.85 }} /></Tooltip>}
                      {event.quotationFiles?.length > 0  && <Tooltip title={`ใบเสนอราคา: ${event.quotationFiles.length} ไฟล์`}><RequestQuote sx={{ fontSize: 16, color: "#ef4444", opacity: 0.85 }} /></Tooltip>}
                      {event.invoiceFiles?.length > 0    && <Tooltip title={`ใบวางบิล: ${event.invoiceFiles.length} ไฟล์`}><ReceiptLong sx={{ fontSize: 16, color: "#f59e0b", opacity: 0.85 }} /></Tooltip>}
                      {event.completionFiles?.length > 0 && <Tooltip title={`ใบส่งมอบงาน: ${event.completionFiles.length} ไฟล์`}><AssignmentTurnedIn sx={{ fontSize: 16, color: "#07941a", opacity: 0.85 }} /></Tooltip>}
                    </Stack>
                  )}
                  {(event.activityLog?.length > 0 || event.comments?.length > 0 || event.jobGroupId) && (
                    <Stack direction="row" alignItems="center" gap={0.5}>
                      {event.activityLog?.length > 0 && (
                        <Tooltip title={`${event.activityLog.length} กิจกรรม`}>
                          <History sx={{ fontSize: 16, color: "text.disabled" }} />
                        </Tooltip>
                      )}
                      {event.comments?.length > 0 && (
                        <Tooltip title={`${event.comments.length} ข้อความ`}>
                          <Chat sx={{ fontSize: 16, color: "text.disabled" }} />
                        </Tooltip>
                      )}
                      {event.jobGroupId && (
                        <Tooltip title="งานนี้เป็นส่วนหนึ่งของงานหลายวัน (กลุ่มเดียวกัน)">
                          <LinkIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                        </Tooltip>
                      )}
                    </Stack>
                  )}
                </Stack>
              )}

              {/* ✅ ตัดวงเล็บ [ ] ครอบชื่องานออก — ไม่ได้สื่อความหมายอะไร เป็นแค่สัญลักษณ์ส่วนเกินที่
                  โผล่ทุกการ์ด และเพิ่มน้ำหนัก/ระยะห่างให้ชื่องานเป็น "จุดยึดสายตา" ของการ์ดจริงๆ
                  (เดิมตัวเล็กใกล้เคียงบรรทัดข้อมูลด้านล่าง เลยจมหายไปกับข้อมูลอื่น) */}
              {event.title && (
                <Typography fontWeight={800} fontSize="1rem" noWrap sx={{ letterSpacing: "-0.01em" }}>
                  {event.title}
                </Typography>
              )}
              <Stack spacing={0.35} sx={{ mt: 0.6 }}>
                {event.system && <InfoLine icon="💻" label="ระบบ">{event.system}</InfoLine>}
                <InfoLine icon="🏢" label="โครงการ">{companySite(event.company, event.site)}</InfoLine>
                {/* ✅ ย้ายมาไว้ถัดจากโครงการตามที่ขอ (เดิมอยู่คู่กับระบบด้านบนสุด) */}
                {event.time && <InfoLine icon="🔢" label="ครั้งที่">{formatRoundLabel(event.time, event.visitCount)}</InfoLine>}
                {(event.startTime || event.endTime) && (
                  <InfoLine icon="🕐" label="เวลา">{event.startTime || "-"} — {event.endTime || "-"}</InfoLine>
                )}
                {/* ✅ ถ้ายังไม่มีเลขเอกสาร ซ่อนช่อง "ใส่เลขที่เอกสาร" ไว้ตอนพับการ์ด — เดิมโชว์ทุกการ์ด
                    ในลิสต์ตลอดเวลาแม้ยังไม่มีข้อมูล ดูรกเวลามีงานหลายรายการ ให้กดขยายก่อนค่อยใส่ */}
                {(event.docNo || expanded) && (
                  editingDoc ? (
                    <Stack direction="row" gap={0.5} alignItems="center" onClick={e => e.stopPropagation()}>
                      <TextField size="small" variant="standard" value={docNo}
                        onChange={e => setDocNo(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleDocSave()}
                        inputProps={{ style: { fontSize: "0.75rem" } }} sx={{ width: 120 }} autoFocus />
                      <Button size="small" onClick={handleDocSave} sx={{ minWidth: "auto", p: 0.5, fontSize: "0.7rem" }}>บันทึก</Button>
                      <Button size="small" color="inherit" onClick={() => setEditingDoc(false)} sx={{ minWidth: "auto", p: 0.5, fontSize: "0.7rem" }}>ยกเลิก</Button>
                    </Stack>
                  ) : (
                    <Stack direction="row" spacing={0.5}
                      sx={{ alignItems: "flex-start", cursor: canEdit ? "pointer" : "default" }}
                      onClick={e => { e.stopPropagation(); canEdit && setEditingDoc(true); }}>
                      <Typography variant="caption" color={event.docNo ? "text.secondary" : "text.disabled"} sx={{ flexShrink: 0, whiteSpace: "nowrap", "&:hover": canEdit ? { color: "primary.main", textDecoration: "underline" } : {} }}>
                        📄 เอกสาร :
                      </Typography>
                      <Typography variant="caption" color={event.docNo ? "text.secondary" : "text.disabled"} sx={{ minWidth: 0, "&:hover": canEdit ? { color: "primary.main", textDecoration: "underline" } : {} }}>
                        {event.docNo || "ใส่เลขที่เอกสาร"}
                      </Typography>
                    </Stack>
                  )
                )}
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
              {/* เวลาเข้า/ออก */}
              {(event.checkedInAt || event.checkedOutAt) && (
                <Stack direction="row" gap={1} mt={0.5} flexWrap="wrap">
                  {event.checkedInAt && (
                    <Typography variant="caption" color="#8b5cf6" fontWeight={600}
                      sx={{ display: "flex", alignItems: "center", gap: 0.3 }}>
                      <Login sx={{ fontSize: 12 }} /> {moment(event.checkedInAt).format("HH:mm")}
                    </Typography>
                  )}
                  {event.checkedOutAt && (
                    <Typography variant="caption" color="#10b981" fontWeight={600}
                      sx={{ display: "flex", alignItems: "center", gap: 0.3 }}>
                      <Logout sx={{ fontSize: 12 }} /> {moment(event.checkedOutAt).format("HH:mm")}
                    </Typography>
                  )}
                </Stack>
              )}
            </Box>
          </Stack>
          {/* ✅ ตัดไอคอนลูกศรบอกสถานะกาง/พับออกไปเลยตามที่ขอ (ดูรกเกินไป) — ทั้งแถว Header ยังคงกด
              เพื่อดูรายละเอียดได้เหมือนเดิม (ไอคอนเอกสาร/กิจกรรมย้ายไปอยู่คนละบรรทัดเต็มความกว้าง
              ด้านล่างแทน — ดูเหตุผลที่ "แถวไอคอนเอกสาร/กิจกรรม" กันไม่ให้ไปเบียด/ทับกับป้ายสถานะ) */}
          <Stack direction="row" gap={0.5} flexShrink={0}>
            {canEdit && (
              <IconButton onClick={e => { e.stopPropagation(); setMoreAnchorEl(e.currentTarget); }} sx={{ p: 1 }}>
                <MoreVert fontSize="small" />
              </IconButton>
            )}
          </Stack>
        </Stack>

        {/* เมนู "⋮" ของการ์ดงาน — ปุ่มลบ (เดิมโชว์เป็นไอคอนสีแดงตลอดเวลา) ย้ายมารวมที่นี่ */}
        <Menu {...FAST_MENU_PROPS} anchorEl={moreAnchorEl} open={Boolean(moreAnchorEl)} onClose={() => setMoreAnchorEl(null)}
          PaperProps={{ sx: { borderRadius: 2, boxShadow: "0 8px 32px rgba(0,0,0,0.12)" } }}>
          <MenuItem onClick={() => { setMoreAnchorEl(null); onDelete(event._id); }} sx={{ gap: 1.5, minHeight: 44, color: "error.main" }}>
            <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>ลบงานนี้</ListItemText>
          </MenuItem>
        </Menu>

        {/* แจ้งเตือนคำขอปิดงานจากช่าง (ยังไม่อนุมัติ) — ใช้ Box แทน Alert action slot
            เพราะ Alert วางข้อความ+ปุ่มแถวเดียวกันแล้วทับ/ล้นกันบนจอมือถือ
            ✅ งานที่เข้าหลายวัน (กลุ่มเดียวกัน) ตอนขอปิดงานตอนนี้ตั้ง closeRequested:true ให้ทุกวัน
            ในกลุ่มพร้อมกัน (ดู handleRequestClose) — ถ้าไม่ซ่อนตรงนี้ด้วย แต่ละวันในกลุ่มจะโชว์กล่อง
            อนุมัติ/ไม่อนุมัติซ้ำกันทุกวัน ทั้งที่กดปุ่มไหนก็ปิดทั้งกลุ่มเหมือนกันหมด (onApproveClose/
            onRejectClose resolve ทั้งกลุ่มอยู่แล้ว) จึงโชว์แค่การ์ดตัวแทนของกลุ่มพอ (เทียบ pattern
            เดียวกับ hideDocuments ที่ซ่อนเอกสารประจำงานในการ์ดรายวันที่เหลือ) */}
        {!hideDocuments && event.closeRequested && localStatus !== "ดำเนินการเสร็จสิ้น" && (
          <Box sx={{
            mt: 1.5, p: 1.5, borderRadius: 2,
            bgcolor: alpha("#f59e0b", 0.08),
            border: "1px solid", borderColor: alpha("#f59e0b", 0.25),
          }}>
            <Stack direction="row" alignItems="flex-start" gap={1}>
              <HourglassTop sx={{ fontSize: 18, color: "#f59e0b", mt: 0.2, flexShrink: 0 }} />
              <Typography variant="body2" sx={{ flex: 1, wordBreak: "break-word" }}>
                {event.closeRequestedBy || "ช่าง"} ขอปิดงาน
                {event.closeRequestedAt && ` เมื่อ ${moment(event.closeRequestedAt).locale("th").format("DD MMM HH:mm")}`}
              </Typography>
            </Stack>
            {isAdminOrManager && (
              <Stack direction={{ xs: "column", sm: "row" }} gap={1} sx={{ mt: 1.25 }}>
                <Button color="warning" variant="contained" size="small"
                  startIcon={<TaskAlt sx={{ fontSize: 16 }} />}
                  onClick={handleApprove} disabled={approving || rejecting}
                  sx={{ flex: 1, borderRadius: 2, textTransform: "none", fontWeight: 700 }}>
                  {approving ? "กำลังอนุมัติ..." : "อนุมัติปิดงาน"}
                </Button>
                <Button color="error" variant="outlined" size="small"
                  startIcon={<Cancel sx={{ fontSize: 16 }} />}
                  onClick={() => setRejectDialogOpen(true)} disabled={approving || rejecting}
                  sx={{ flex: 1, borderRadius: 2, textTransform: "none", fontWeight: 700 }}>
                  ไม่อนุมัติ
                </Button>
              </Stack>
            )}
          </Box>
        )}

        {/* ประวัติการไม่อนุมัติล่าสุด (ถ้ายังไม่มีการขอปิดงานใหม่เข้ามา) — ซ่อนในการ์ดรายวันที่เหลือ
            ของกลุ่มเหมือนกัน (ดูเหตุผลด้านบน) เพราะไม่อนุมัติก็ propagate ไปทั้งกลุ่มเหมือนกันแล้ว */}
        {!hideDocuments && !event.closeRequested && event.closeRejectReason && localStatus !== "ดำเนินการเสร็จสิ้น" && (
          <Box sx={{
            mt: 1.5, p: 1.5, borderRadius: 2,
            bgcolor: alpha("#ef4444", 0.08),
            border: "1px solid", borderColor: alpha("#ef4444", 0.25),
          }}>
            <Stack direction="row" alignItems="center" gap={0.75}>
              <Cancel sx={{ fontSize: 16, color: "#ef4444", flexShrink: 0 }} />
              <Typography variant="body2" fontWeight={700} color="#ef4444">
                ไม่อนุมัติคำขอปิดงาน
              </Typography>
              {event.closeRejectedAt && (
                <Typography variant="caption" color="text.disabled">
                  · {moment(event.closeRejectedAt).locale("th").format("DD MMM HH:mm")}
                </Typography>
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, wordBreak: "break-word" }}>
              "{event.closeRejectReason}"
            </Typography>
          </Box>
        )}

        {/* Dialog: ระบุเหตุผลที่ไม่อนุมัติ */}
        <Dialog open={rejectDialogOpen} onClose={() => !rejecting && setRejectDialogOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>ไม่อนุมัติปิดงาน</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 1.5 }}>
              ระบุเหตุผล/คอมเมนต์ที่ไม่อนุมัติ เพื่อแจ้งให้ช่างทราบและแก้ไข
            </DialogContentText>
            <TextField
              autoFocus fullWidth multiline minRows={3}
              placeholder="เช่น ไฟล์ใบเสนอราคายังไม่ครบ กรุณาแนบเพิ่ม"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRejectDialogOpen(false)} disabled={rejecting}>ยกเลิก</Button>
            <Button variant="contained" color="error" onClick={handleReject} disabled={rejecting}>
              {rejecting ? "กำลังบันทึก..." : "ยืนยันไม่อนุมัติ"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Status Menu */}
        <Menu {...FAST_MENU_PROPS} anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}
          PaperProps={{ sx: { borderRadius: 2, boxShadow: "0 8px 32px rgba(0,0,0,0.12)" } }}>
          <Typography variant="caption" sx={{ px: 2, py: 0.5, display: "block", color: "text.secondary", fontWeight: 700 }}>
            เปลี่ยนสถานะ
          </Typography>
          <Divider />
          {OP_LIST.map(s => {
            // ✅ ตรงกับ operational guard ฝั่ง backend (PUT /:id) — ห้ามปิดงาน ("ดำเนินการเสร็จสิ้น")
            // จนกว่าจะได้รับการอนุมัติก่อน ถ้าไม่ใช่ admin/manager ("กำลังดำเนินการ" ยังกดได้ตามปกติ
            // เพราะตัวจับเวลาอัตโนมัติที่ปฏิทินต้องเปลี่ยนสถานะนี้ได้เสมอ ดูคอมเมนต์เดียวกันฝั่ง backend)
            const blockedByApproval = s === "ดำเนินการเสร็จสิ้น" && !isAdminOrManager && getApprovalState(event) !== "approved";
            const item = (
              <MenuItem key={s} onClick={() => !blockedByApproval && handleStatusChange(s)} selected={localStatus === s}
                disabled={blockedByApproval}
                sx={{ gap: 1.5, py: 1.25, minHeight: 44 }}>
                <Circle sx={{ fontSize: 8, color: OP_COLOR[s] }} />
                <Typography variant="body2" fontWeight={localStatus === s ? 700 : 400}>{s}</Typography>
              </MenuItem>
            );
            return blockedByApproval ? (
              <Tooltip key={s} title="งานนี้ยังไม่ได้รับการอนุมัติ ปิดงานไม่ได้จนกว่าแอดมิน/manager จะอนุมัติก่อน" placement="right">
                <span>{item}</span>
              </Tooltip>
            ) : item;
          })}
        </Menu>

        {/* Expanded — เปิดเป็น Dialog ทับขึ้นมาเสมอ ไม่ว่าจอเล็ก/ใหญ่ ไม่ต้องกางลงดันการ์ดอื่น/
            เลื่อนจอตามอีกต่อไป — จอเล็ก (มือถือ) เปิดแบบเต็มจอ (fullScreen) แทนกล่องลอย */}
      </CardContent>

      <Dialog open={expanded} onClose={() => setExpanded(false)} fullWidth maxWidth="md" fullScreen={!isDesktop}>
          <DialogTitle sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              {/* ✅ สลับตำแหน่ง: ประเภทงานขึ้นเป็นหัวข้อหลัก (ไม่ใส่ label "ประเภท" เพราะเป็นหัวข้อ
                  อยู่แล้วเหมือนที่โครงการเคยอยู่ตำแหน่งนี้), โครงการย้ายลงไปอยู่แถวข้อมูลแทน */}
              <Typography fontWeight={800} fontSize="1rem" noWrap>
                {event.title || "ไม่ระบุประเภทงาน"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                เอกสาร/คุยกับช่าง/ประวัติ
              </Typography>
              {(event.company || event.site || event.system || event.time) && (
                <Stack direction="row" gap={2} flexWrap="wrap" sx={{ mt: 0.5 }}>
                  <InfoLine icon="🏢" label="โครงการ">{companySite(event.company, event.site)}</InfoLine>
                  {event.system && <InfoLine icon="💻" label="ระบบ">{event.system}</InfoLine>}
                  {event.time && <InfoLine icon="🔢" label="ครั้งที่">{formatRoundLabel(event.time, event.visitCount)}</InfoLine>}
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
    </Wrapper>
  );
};

// ─── FilterPanel ──────────────────────────────────────────────────────
const FilterPanel = ({
  search, onSearch, filterType, onFilterType, filterSystem, onFilterSystem,
  filterStatus, onFilterStatus, filterOP, onFilterOP, filterTeam, onFilterTeam,
  showAll, onToggleShowAll, selectedDate, onDateChange, onClearAll, activeCount,
  typeOptions, systemOptions,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <GlassCard sx={{ mb: 3 }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
          <TextField
            placeholder="🔍 ค้นหา บริษัท, ไซต์, เลขเอกสาร..."
            size="small" value={search}
            onChange={e => onSearch(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18, color: "text.disabled" }} /></InputAdornment>,
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => onSearch("")}><Clear fontSize="small" /></IconButton>
                </InputAdornment>
              ) : null,
              sx: { borderRadius: 2 },
            }}
            sx={{ flex: 1, minWidth: 220 }}
          />
          <Stack direction="row" gap={1} alignItems="center">
            <Button size="small" variant={showAll ? "contained" : "outlined"}
              onClick={() => onToggleShowAll(true)}
              sx={{ borderRadius: 2, textTransform: "none", fontSize: "0.78rem" }}>
              ทั้งหมด
            </Button>
            {!showAll && (
              <LocalizationProvider dateAdapter={AdapterMoment}>
                <DatePicker
                  views={["year", "month"]} openTo="month" label="เดือน"
                  value={selectedDate ? moment(selectedDate) : null}
                  onChange={v => onDateChange(moment(v).format("YYYY-MM"))}
                  renderInput={params => (
                    <TextField {...params} size="small" sx={{ width: 160, "& .MuiOutlinedInput-root": { borderRadius: 2 } }} />
                  )}
                />
              </LocalizationProvider>
            )}
            {showAll && (
              <Button size="small" variant="outlined"
                onClick={() => { onToggleShowAll(false); onDateChange(moment().format("YYYY-MM")); }}
                sx={{ borderRadius: 2, textTransform: "none", fontSize: "0.78rem" }}>
                เลือกเดือน
              </Button>
            )}
          </Stack>
          <Badge badgeContent={activeCount} color="error" invisible={activeCount === 0}>
            <Button size="small" variant="outlined" startIcon={<FilterList />}
              onClick={() => setOpen(p => !p)}
              sx={{ borderRadius: 2, textTransform: "none" }}>
              ตัวกรอง
            </Button>
          </Badge>
          {activeCount > 0 && (
            <Tooltip title="ล้างตัวกรองทั้งหมด">
              <IconButton size="small" onClick={onClearAll} color="error"><Clear fontSize="small" /></IconButton>
            </Tooltip>
          )}
        </Stack>
        <Collapse in={open}>
          <Divider sx={{ my: 2 }} />
          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 1, display: "block" }}>สถานะงาน</Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.75}>
                {OP_LIST.map(op => (
                  <FilterChip key={op} label={op} size="small"
                    active={filterOP === op ? 1 : 0}
                    onClick={() => onFilterOP(filterOP === op ? "" : op)}
                    variant={filterOP === op ? "filled" : "outlined"}
                    sx={{ borderColor: OP_COLOR[op], color: filterOP === op ? "#fff" : OP_COLOR[op],
                      bgcolor: filterOP === op ? OP_COLOR[op] : "transparent",
                      "&:hover": { bgcolor: alpha(OP_COLOR[op], 0.12) } }}
                  />
                ))}
              </Stack>
            </Box>
            <Box>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 1, display: "block" }}>ประเภทงาน</Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.75}>
                {typeOptions.map(t => (
                  <FilterChip key={t} label={t} size="small"
                    active={filterType === t ? 1 : 0}
                    icon={TYPE_ICON[t] || <Build fontSize="small" />}
                    onClick={() => onFilterType(filterType === t ? "" : t)}
                    variant={filterType === t ? "filled" : "outlined"}
                    color={filterType === t ? "success" : "default"}
                  />
                ))}
              </Stack>
            </Box>
            <Box>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 1, display: "block" }}>ระบบ</Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.75}>
                {systemOptions.map(s => (
                  <FilterChip key={s} label={s} size="small"
                    active={filterSystem === s ? 1 : 0}
                    onClick={() => onFilterSystem(filterSystem === s ? "" : s)}
                    variant={filterSystem === s ? "filled" : "outlined"}
                    color={filterSystem === s ? "secondary" : "default"}
                  />
                ))}
              </Stack>
            </Box>
            <Box>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 1, display: "block" }}>การเงิน</Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.75}>
                {STATUS_BILLING.map(s => (
                  <FilterChip key={s} label={s} size="small"
                    active={filterStatus === s ? 1 : 0}
                    onClick={() => onFilterStatus(filterStatus === s ? "" : s)}
                    variant={filterStatus === s ? "filled" : "outlined"}
                    color={filterStatus === s ? "primary" : "default"}
                  />
                ))}
              </Stack>
            </Box>
          </Stack>
        </Collapse>
      </CardContent>
    </GlassCard>
  );
};

// ─── FilePreviewDialog ────────────────────────────────────────────────
// ✅ export เพิ่ม (เทียบ pattern เดียวกับ GlassCard/StatCard/FileUploadSection/CommentThread ด้านบน)
// ให้หน้าอื่น (เช่น /quotations) เปิด preview ไฟล์ในหน้าเดิมได้เลย แทนที่จะต้อง window.open แท็บใหม่
export const FilePreviewDialog = ({ previewUrl, previewFileName, onClose }) => {
  const type = getFileType(previewFileName || previewUrl || "");

  // PDF: โหลดเป็น blob เองแล้วใช้ตัวแสดงผล PDF ในตัวของเบราว์เซอร์
  // (เลี่ยงปัญหา CDN ของ Cloudinary ที่ประกาศรองรับ Range request แต่จริง ๆ ไม่ทำงานตามนั้น
  // ซึ่งทำให้ตัวแสดงผล PDF ภายนอกโหลดไฟล์ไม่สำเร็จ)
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError,   setPdfError]   = useState(false);

  useEffect(() => {
    if (type !== "pdf" || !previewUrl) {
      setPdfBlobUrl(null);
      setPdfError(false);
      return;
    }
    let cancelled = false;
    let objectUrl = null;
    setPdfLoading(true);
    setPdfError(false);
    fetch(previewUrl)
      .then(res => { if (!res.ok) throw new Error("โหลดไฟล์ไม่สำเร็จ"); return res.blob(); })
      .then(blob => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(objectUrl);
      })
      .catch(() => { if (!cancelled) setPdfError(true); })
      .finally(() => { if (!cancelled) setPdfLoading(false); });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [type, previewUrl]);

  return (
    <Dialog open={Boolean(previewUrl)} onClose={onClose} maxWidth="xl" fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}>
      <DialogTitle sx={{ m: 0, p: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
        {fileTypeIcon(previewFileName)}
        <Typography fontWeight={700} noWrap flex={1}>{previewFileName || "ดูไฟล์"}</Typography>
        <Stack direction="row" gap={0.5}>
          {previewUrl && <Tooltip title="ดาวน์โหลด"><IconButton onClick={() => downloadFile(previewUrl, previewFileName)}><Download /></IconButton></Tooltip>}
          <IconButton onClick={onClose}><Close /></IconButton>
        </Stack>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ p: 0 }}>
        {type === "image" && <img src={getOptimizedImageUrl(previewUrl)} alt={previewFileName} style={{ maxWidth: "100%", maxHeight: 780, display: "block", margin: "0 auto", padding: 16 }} />}
        {type === "pdf" && (
          pdfLoading ? (
            <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
              <LinearProgress sx={{ mx: 6, mb: 2, borderRadius: 1 }} />
              <Typography variant="body2">กำลังโหลดไฟล์...</Typography>
            </Box>
          ) : pdfError ? (
            <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
              <PictureAsPdf sx={{ fontSize: 48, opacity: 0.3 }} />
              <Typography>ไม่สามารถแสดงตัวอย่างไฟล์นี้ได้</Typography>
              <Button size="small" variant="outlined" sx={{ mt: 1.5, borderRadius: 2 }}
                onClick={() => downloadFile(previewUrl, previewFileName)}>
                ดาวน์โหลดแทน
              </Button>
            </Box>
          ) : pdfBlobUrl ? (
            <iframe src={pdfBlobUrl} width="100%" height="780px" style={{ border: "none" }} title="PDF" />
          ) : null
        )}
        {(type === "word" || type === "excel") && <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`} width="100%" height="780px" style={{ border: "none" }} title="Office" />}
        {type === "unknown" && <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}><FolderOpen sx={{ fontSize: 48 }} /><Typography>ไม่สามารถแสดงไฟล์นี้ได้</Typography></Box>}
      </DialogContent>
    </Dialog>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// ─── มุมมองตาราง — ทางเลือกของการ์ด สำหรับกวาดดูหลายงานพร้อมกัน/เทียบกัน ─────────────────
// ✅ การ์ดมีข้อมูลครบและจัดการงานได้ในตัว (เอกสาร/คอมเมนต์/ปุ่ม) แต่พอมี 20-30 งานต้องเลื่อนยาวมาก
// และเทียบข้ามงานไม่ได้เลย — ตารางตอบโจทย์คนละแบบ กดแถวเพื่อเปิดดูรายละเอียดแบบการ์ดได้เหมือนเดิม
const OperationTable = ({ jobGroups, daysPastDueMap, onOpenJob }) => (
  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3, overflowX: "auto" }}>
    <Table size="small" sx={{ minWidth: 1000, width: "100%" }}>
      <TableHead>
        <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "#f5f3ff", color: "#4c1d95", whiteSpace: "nowrap" } }}>
          <TableCell>สถานะ</TableCell>
          <TableCell>บริษัท / โครงการ</TableCell>
          <TableCell>ประเภทงาน · ระบบ</TableCell>
          <TableCell>วันที่เข้างาน</TableCell>
          <TableCell>ทีมที่เข้างาน</TableCell>
          <TableCell align="center">ค้าง</TableCell>
          <TableCell align="center">เอกสาร</TableCell>
          <TableCell align="center" />
        </TableRow>
      </TableHead>
      <TableBody>
        {jobGroups.map((job, idx) => {
          const a = job.sessions[0];
          const overdueDays = daysPastDueMap.get(a._id)?.days;
          const isOverdue = isFlaggedDays(overdueDays);
          const docCount = ["reportFiles", "quotationFiles", "invoiceFiles", "completionFiles"]
            .reduce((sum, k) => sum + (a[k]?.length || 0), 0);
          const teamNames = [a.team, ...(a.teamMembers || []).map((m) => m?.name)].filter(Boolean);
          return (
            <TableRow key={a._id} hover onClick={() => onOpenJob(job)}
              sx={{ cursor: "pointer", bgcolor: idx % 2 ? alpha("#0f172a", 0.02) : "transparent" }}>
              <TableCell sx={{ whiteSpace: "nowrap" }}>
                <StatusBadge color={OP_COLOR[a.status] || "#6b7280"}>{a.status || "—"}</StatusBadge>
              </TableCell>
              <TableCell sx={{ maxWidth: 220 }}>
                <Typography variant="caption" fontWeight={700} noWrap sx={{ display: "block" }}>{a.company || "-"}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>{a.site || "-"}</Typography>
              </TableCell>
              <TableCell sx={{ maxWidth: 170 }}>
                <Typography variant="caption" noWrap sx={{ display: "block" }}>{a.title || "-"}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>{a.system || "-"}</Typography>
              </TableCell>
              <TableCell sx={{ maxWidth: 200 }}>
                {/* ✅ งานที่เข้าหลายวันไม่ติดกันโชว์ทุกช่วง + จำนวนช่วง ไม่ใช่แค่วันแรกเหมือนที่เคยเข้าใจผิด */}
                <Typography variant="caption" sx={{ display: "block" }}>
                  {formatEventDateRange(a)}
                </Typography>
                {job.sessions.length > 1 && (
                  <Typography variant="caption" color="primary.main" fontWeight={700}>
                    🔗 อีก {job.sessions.length - 1} ช่วงวัน
                  </Typography>
                )}
              </TableCell>
              <TableCell sx={{ maxWidth: 160 }}>
                <Typography variant="caption" noWrap sx={{ display: "block" }}>
                  {teamNames.length > 0 ? teamNames.join(", ") : "-"}
                </Typography>
              </TableCell>
              <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                {isOverdue ? (
                  <Typography variant="caption" fontWeight={800} color="error.main">{overdueDays} วัน</Typography>
                ) : (
                  <Typography variant="caption" color="text.disabled">-</Typography>
                )}
              </TableCell>
              <TableCell align="center">
                <Typography variant="caption" fontWeight={docCount > 0 ? 700 : 400}
                  color={docCount > 0 ? "success.main" : "text.disabled"}>
                  {docCount > 0 ? `${docCount} ไฟล์` : "ยังไม่มี"}
                </Typography>
              </TableCell>
              <TableCell align="center"><ChevronRight sx={{ color: "text.disabled", fontSize: 18 }} /></TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  </TableContainer>
);

// ─── JobGroupBlock ──────────────────────────────────────────────────────
// การ์ดรวมสำหรับงานที่เข้าหลายวันไม่ติดกัน (ผูกกันด้วย jobGroupId/signature เดียวกัน)
// โชว์ช่วงวันที่รวมทั้งหมด (เริ่ม–สิ้นสุด) ในหัวการ์ดเดียว + ยุบ/ขยายเพื่อซ่อนการ์ดรายวัน
// ลดความรกเวลามีหลายวัน แต่ยังกดขยายดู/จัดการแต่ละวันแยกกันได้ตามเดิม
// ═══════════════════════════════════════════════════════════════════════
const JobGroupBlock = ({ sessions, currentUserRole, ...cardProps }) => {
  const [expanded, setExpanded] = useState(false);
  const isGrouped = sessions.length > 1;

  // ✅ งานกลุ่มเดียวกันใช้เอกสาร (Service Report/ใบเสนอราคา/ใบวางบิล/ใบส่งมอบงาน) และ "ขอปิดงาน"
  // ร่วมกันชุดเดียว แทนที่จะให้อัปโหลด/ขอปิดซ้ำทุกวัน — ยึดวันล่าสุด (sessions[0]) เป็น "การ์ดหลัก"
  // ที่ถือเอกสาร/คำขอปิดงานของทั้งกลุ่ม ส่วนวันอื่นๆ ซ่อนส่วนนี้ไป เหลือแค่สรุปงาน/คุยกับอีกฝั่ง/ประวัติ
  const anchorId = sessions[0]._id;

  const renderCard = (event) => {
    const hideDocuments = isGrouped && event._id !== anchorId;
    return currentUserRole === "technician" ? (
      <TechnicianJobCard key={event._id} event={event} {...cardProps} isTechnicianView={true} hideDocuments={hideDocuments} noOuterCard={isGrouped} />
    ) : (
      <EventRowCard key={event._id} event={event} {...cardProps} currentUserRole={currentUserRole} hideDocuments={hideDocuments} noOuterCard={isGrouped} />
    );
  };

  if (!isGrouped) return renderCard(sessions[0]);

  const head = sessions[0];
  const sortedByStart = sessions.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
  const latestEndSession = sessions.reduce((latest, s) =>
    new Date(s.end || s.start) > new Date(latest.end || latest.start) ? s : latest
  );
  const rangeStart = moment(sortedByStart[0].start).locale("th").format("DD MMM");
  const rangeEnd = moment(latestEndSession.end || latestEndSession.start)
    .subtract(latestEndSession.allDay ? 1 : 0, "days")
    .locale("th").format("DD MMM YYYY");

  // ✅ นับ "จำนวนวันเข้างานจริง" ตามที่ลงไว้ (รวมทุกวันในแต่ละช่วง เช่น 13-15 = 3 วัน)
  // แทนที่จะนับจำนวนแถว/ช่วงที่ลง (เดิมนับ sessions.length เพียว ๆ ทำให้ 13-15 และ 17-18
  // ซึ่งจริงๆ คือ 5 วัน กลับโชว์ว่า "เข้างาน 2 วัน" เพราะมีแค่ 2 ช่วง)
  const dayEnd = (s) => moment(s.end || s.start).subtract(s.allDay ? 1 : 0, "days").startOf("day");
  const totalWorkDays = sessions.reduce((sum, s) => {
    const days = dayEnd(s).diff(moment(s.start).startOf("day"), "days") + 1;
    return sum + Math.max(days, 1);
  }, 0);

  // ✅ รวมงานทั้งกลุ่ม (หัวข้อ + ทุกวัน) ไว้ใน GlassCard ใบเดียวกันเลย (ไม่ใช่การ์ดแยกคนละใบ)
  // แต่ละวันคั่นด้วย Divider แทน — เพื่อให้เห็นชัดว่าเป็น "งานเดียวกัน" จริงๆ ไม่ใช่แค่จัดกลุ่มแยกกันไว้
  // ✅ เปลี่ยนจากม่วง (#8b5cf6) เป็นสีธีมแอพ (แดง) ให้ตรงกับธีมสีของทั้งแอพ
  return (
    <GlassCard sx={{ mb: 2, border: "1px solid", borderColor: alpha("#dc2626", 0.3) }}>
      <Box
        onClick={() => setExpanded(p => !p)}
        sx={{
          p: 2, cursor: "pointer", background: alpha("#dc2626", 0.04),
          borderBottom: expanded ? "1px solid" : "none", borderColor: alpha("#dc2626", 0.2),
        }}>
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <CalendarMonth sx={{ fontSize: 18, color: "#dc2626" }} />
          <Typography variant="body2" fontWeight={700} color="#dc2626">
            {companySite(head.company, head.site)} — {head.title}{head.system && ` · ${head.system}`}{head.time && ` ครั้งที่ ${formatRoundLabel(head.time, head.visitCount)}`}
          </Typography>
          <Chip label={`เข้างาน ${totalWorkDays} วัน`} size="small"
            sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700, bgcolor: alpha("#dc2626", 0.15), color: "#dc2626" }} />
          <Typography variant="caption" color="text.secondary">
            📅 {rangeStart} – {rangeEnd}
          </Typography>
          <IconButton size="small" sx={{ ml: "auto" }} onClick={(e) => { e.stopPropagation(); setExpanded(p => !p); }}>
            {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          </IconButton>
        </Stack>
        <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.75 }}>
          {sortedByStart.map(s => {
            const sStart = moment(s.start);
            const sEnd = dayEnd(s);
            const chipLabel = sStart.isSame(sEnd, "day")
              ? sStart.locale("th").format("DD MMM")
              : `${sStart.locale("th").format("DD")}-${sEnd.locale("th").format("DD MMM")}`;
            return (
            <Chip key={s._id} label={chipLabel} size="small"
              variant={s._id === anchorId ? "filled" : "outlined"}
              sx={{
                height: 20, fontSize: "0.68rem",
                borderColor: alpha("#dc2626", 0.35),
                bgcolor: s._id === anchorId ? alpha("#dc2626", 0.2) : "transparent",
                color: "#dc2626", fontWeight: s._id === anchorId ? 700 : 400,
              }} />
            );
          })}
        </Stack>
        <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 0.5 }}>
          📄 เอกสารประจำงาน/ขอปิดงาน ใช้ร่วมกันที่การ์ดวันที่ {moment(head.start).locale("th").format("DD MMM")} (วันล่าสุด)
        </Typography>
      </Box>

      <Collapse in={expanded}>
        {sessions.map((event, i) => (
          <React.Fragment key={event._id}>
            {i > 0 && <Divider />}
            {renderCard(event)}
          </React.Fragment>
        ))}
      </Collapse>
    </GlassCard>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// ─── Main: Operation ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
const Operation = () => {
  moment.locale("th");
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const theme    = useTheme();
  const isMobile = useMediaQuery("(max-width:600px)");

  const [events,       setEvents]       = useState([]);
  const [employee,     setEmployee]     = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [activeTab,    setActiveTab]    = useState(0);
  // ✅ จำนวนงานรออนุมัติ — แผง PendingApprovalsPanel ดึงข้อมูลเองแยกจากหน้านี้ (ดูเหตุผลในไฟล์นั้น)
  // จึงส่งตัวเลขกลับขึ้นมาให้แสดงเป็น badge บนแท็บ ผู้ใช้จะได้รู้ว่ามีงานค้างโดยไม่ต้องกดเข้าไปดูก่อน
  const [pendingApprovalTabCount, setPendingApprovalTabCount] = useState(0);
  // ✅ สลับมุมมองการ์ด/ตาราง — จำค่าไว้ข้ามการเปิดหน้า (แต่ละคนถนัดคนละแบบและมักใช้แบบเดิมตลอด)
  // เทียบ pattern เดียวกับหน้า "ติดตามใบเสนอราคา"
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem("operation.viewMode") === "table" ? "table" : "card"; }
    catch { return "card"; }
  });
  useEffect(() => {
    try { localStorage.setItem("operation.viewMode", viewMode); } catch {}
  }, [viewMode]);
  const [lastRefreshed,setLastRefreshed]= useState(null);

  // ✅ แยกกลุ่มงานให้ชัดเจน แทนที่จะปนกันเป็นลิสต์เดียวเรียงตามวันที่อย่างเดียว
  // ใช้กลุ่มเดียวกันทั้งฝั่งช่างและแอดมิน/manager:
  // "pending" (รอคุณ/ผู้ดูแลอนุมัติปิดงาน — default) | "active" (ยืนยันแล้ว/กำลังดำเนินการ) | "closed" (เสร็จสิ้น)
  const [statusGroup,   setStatusGroup]   = useState("");

  const [search,        setSearch]        = useState("");
  const [showAll,       setShowAll]       = useState(true);
  const [selectedDate,  setSelectedDate]  = useState("");
  const [filterType,    setFilterType]    = useState("");
  const [filterSystem,  setFilterSystem]  = useState("");
  const [filterStatus,  setFilterStatus]  = useState("");
  const [filterOP,      setFilterOP]      = useState("");
  const [filterTeam,    setFilterTeam]    = useState("");

  // ✅ เดิมตัวกรอง "ประเภทงาน"/"ระบบ" ล็อกไว้ตายตัวแค่ 5/3 ชนิด ไม่ตรงกับข้อมูลจริง (ตาราง
  // JobType/SystemType มีมากกว่านั้น และแก้ไขได้จากหน้า "ประเภทงาน/ระบบ") ดึงมาแบบไดนามิกแทน
  // เทียบ pattern เดียวกับที่หน้า Event ใช้ (fetchLookupOptions)
  const [typeOptions,   setTypeOptions]   = useState([]);
  const [systemOptions, setSystemOptions] = useState([]);

  // ✅ รองรับ deep-link มาจาก Dashboard (การ์ด "สรุปสถานะงาน") และหน้า "ภาพรวมทีมช่าง"
  // (กดการ์ดช่างคนหนึ่ง) ให้เจาะจงสถานะ/ช่างที่กดมาได้ทันที ผ่าน query param ?status=...&team=...
  // แทนที่จะเด้งมาหน้า Operation เฉยๆ แล้วต้องกรองเองซ้ำอีกที
  // ✅ เพิ่ม ?group=... — ใช้ตอนกดงานจาก "งานค้างของช่าง" ใน Dashboard (ลิงก์ไป /operation/:id
  // ตรงๆ) ซึ่ง id จะกรองให้เหลืองานนั้นงานเดียวถูกต้องอยู่แล้ว แต่ "แถบสถานะ" (StatusGroupCard)
  // เดิมไม่รู้ว่างานนี้อยู่กลุ่ม "ค้างงาน" เลยขึ้นไฮไลต์แถบผิด (ปัญหา/กำลังดำเนินการ) ไม่ตรงกับ
  // งานที่กำลังดูอยู่จริง — ให้ตั้ง statusGroup ตาม ?group= ทันทีเพื่อให้แถบที่ไฮไลต์ตรงกับงานจริง
  useEffect(() => {
    const statusParam = searchParams.get("status");
    const teamParam = searchParams.get("team");
    const groupParam = searchParams.get("group");
    if (statusParam) setFilterOP(statusParam);
    if (teamParam) setFilterTeam(teamParam);
    if (groupParam) setStatusGroup(groupParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ ?highlight=<id> (+ ?group=) — ใช้ตอนกดปุ่ม "ตรวจสอบ" จากพาแนล "งานที่ช่างขอปิด" พาไปที่
  // รายการงานทั้งหมด (ไม่ใช่ /operation/:id ที่กรองเหลือแค่งานเดียวโดดๆ) แล้วเลื่อนจอ + ไฮไลต์กรอบ
  // กระพริบไปที่งานนั้นแทน — ต้องแยกเป็น effect ของตัวเอง (deps: [searchParams] ไม่ใช่ mount-only
  // แบบด้านบน) เพราะ ClosureRequestsPanel อยู่ในหน้า Operation หน้าเดียวกันอยู่แล้ว กด "ตรวจสอบ"
  // ซ้ำจึงแค่เปลี่ยน query param โดยไม่ remount หน้าใหม่ ถ้าใช้ effect แบบ mount-only ([]) จะไม่
  // ทำงานซ้ำเลย ต้องรีเฟรชหน้าเองก่อนถึงจะเห็นผล (ตามที่ผู้ใช้เจอ)
  // ✅ ต้องล้างตัวกรองอื่นๆ ที่อาจค้างมาจากก่อนหน้าด้วย (เช่นมาจาก Dashboard ด้วย ?status=...&group=...
  // ทำให้ filterOP/statusGroup ค้างค่าเดิมอยู่) เพราะ filterOP ที่ค้างอยู่จะ bypass การกรองตาม
  // group ไปเลย (ดู matchGroup) ทำให้งานที่จะไฮไลต์หลุดจากรายการที่กรองอยู่ กด "ตรวจสอบ" แล้วไม่
  // เจองาน/ไม่เลื่อนให้เหมือนที่ผู้ใช้เจอ — ล้างทุกตัวกรอง + เปิด "ทั้งหมด" (ไม่จำกัดเดือน) ให้แน่ใจ
  // ว่างานที่จะไฮไลต์จะอยู่ในรายการที่กรองแล้วเสมอ ไม่ว่าก่อนหน้านี้จะมาจากหน้าไหนด้วยตัวกรองอะไรมา
  useEffect(() => {
    const groupParam = searchParams.get("group");
    const highlightParam = searchParams.get("highlight");
    if (highlightParam) {
      setFilterType("");
      setFilterSystem("");
      setFilterStatus("");
      setFilterOP("");
      setFilterTeam("");
      setSearch("");
      setShowAll(true);
      if (groupParam) setStatusGroup(groupParam);
      // ✅ เก็บเป็น "<id>|<nonce>" ไม่ใช่ id เฉยๆ — กันเคสกดปุ่ม "ตรวจสอบ" งานเดิมซ้ำติดๆ กัน
      // (ก่อนที่ไฮไลต์ครั้งก่อนจะจางหายไปครบ 3 วิ) ถ้าเก็บแค่ id เฉยๆ ค่าจะเหมือนเดิมทุกตัวอักษร
      // React จะมองว่าไม่มีอะไรเปลี่ยน (bail out) ไม่ trigger effect เลื่อนจอซ้ำให้ — ต่อ nonce
      // (จาก ?t=) เข้าไปด้วยการันตีว่าค่า state เปลี่ยนจริงทุกครั้งที่กด ไม่ว่าจะกดงานเดิมกี่ครั้ง
      setHighlightId(`${highlightParam}|${searchParams.get("t") || Date.now()}`);
    }
  }, [searchParams]);

  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [highlightId, setHighlightId] = useState("");
  // ✅ ส่วน id จริงล้วนๆ (ตัด nonce ทิ้ง) ใช้เทียบ/หา DOM element จริง
  const highlightJobId = highlightId ? highlightId.split("|")[0] : "";

  const [previewUrl,       setPreviewUrl]        = useState(null);
  const [previewFileName,  setPreviewFileName]   = useState("");
  // ✅ perf: reference คงที่ (ไม่สร้าง arrow function ใหม่ทุก render) — จำเป็นสำหรับให้ FileRow ที่
  // memo ไว้ (เทียบ props ด้วย reference) bail out re-render ได้จริง ไม่งั้น prop นี้เปลี่ยนทุกครั้ง
  // ทำให้ memo ไม่มีผลอะไรเลย
  const handlePreviewFile = useCallback((url, name) => { setPreviewUrl(url); setPreviewFileName(name); }, []);
  const [confirmOpen,      setConfirmOpen]        = useState(false);
  const [pendingDelete,    setPendingDelete]      = useState(null);
  const [snackbar,         setSnackbar]           = useState({ open: false, msg: "", severity: "success" });
  const [currentUserRole,  setCurrentUserRole]    = useState("");
  const isAdminOrManager = ["admin", "manager"].includes(currentUserRole);

  const [uploadingState,         setUploadingState]         = useState({ quotation: null, report: null, invoice: null, completion: null });
  const [uploadProgressState,    setUploadProgressState]    = useState({ quotation: 0, report: 0, invoice: 0, completion:0 });
  const [uploadingFileSizeState, setUploadingFileSizeState] = useState({ quotation: "", report: "", invoice: "", completion: "" });
  const [isUploadingState,       setIsUploadingState]       = useState({ quotation: false, report: false, invoice: false, completion:false });

  useEffect(() => {
    const payload = JSON.parse(localStorage.getItem("payload") || "{}");
    if (payload?.role) setCurrentUserRole(payload.role);
  }, []);

  useEffect(() => {
    fetchEventsFromDB();
    fetchEmployee();
    fetchLookupOptions();
  }, [id]);

  // ── Auto-refresh ทุก 15 วินาที (ทุก role ที่ล็อกอินอยู่) ──────────────
  // ✅ ขยายจากเดิมที่จำกัดเฉพาะ admin/manager ทุก 30s → ให้ทำงานกับช่างด้วย
  // เพื่อให้ผลอนุมัติ/ไม่อนุมัติคำขอปิดงาน render กลับไปหาช่างแบบ realtime
  // โดยไม่ต้องกดรีเฟรชเอง
  useEffect(() => {
    if (!currentUserRole) return;
    const interval = setInterval(() => {
      fetchEventsFromDB(true); // silent refresh
    }, 15000);
    return () => clearInterval(interval);
  }, [currentUserRole]);

  const fetchEventsFromDB = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await EventService.getEventOp();
      setEvents(res.userEvents || []);
      setLastRefreshed(new Date());
    } catch (err) { console.error(err); }
    finally { if (!silent) setLoading(false); }
  };

  const fetchEmployee = async () => {
    try {
      const res = await AuthService.getAllUserData();
      setEmployee(res.allUser || []);
    } catch (err) { console.error(err); }
  };

  const fetchLookupOptions = async () => {
    const [jobTypes, systemTypes] = await Promise.all([
      JobTypeService.getAll().catch(() => ({ items: [] })),
      SystemTypeService.getAll().catch(() => ({ items: [] })),
    ]);
    setTypeOptions((jobTypes?.items || []).map((t) => t.name).sort());
    setSystemOptions((systemTypes?.items || []).map((s) => s.name).sort());
  };

  const dateSearch = !showAll ? selectedDate : "";

  // ✅ อ้างอิงจาก events (state ที่อัปเดตสดทุกครั้งที่แก้ไข) แทนการเก็บ snapshot แยก
  // เพื่อไม่ให้หน้า /operation/:id ค้างข้อมูลเก่าจนกว่าจะรีเฟรชหน้า
  const selectedEvent = useMemo(
    () => (id ? events.find(e => e._id === id) || null : null),
    [id, events]
  );

  // ✅ สร้างจาก events ทั้งหมด (ก่อนตัวกรองอื่น) เสมอ เพื่อให้งานหลายวันไม่ติดกันถูกจัดกลุ่มครบ
  // ทุกแถว แล้วคิดค้างจากวันสุดท้ายของทั้งชุด ไม่ใช่แยกทีละแถว
  const daysPastDueMap = useMemo(() => buildDaysPastDueMap(events), [events]);

  // ✅ ต้องคำนวณก่อน filteredEvents (ใช้ตัดสิน default group ด้านล่าง) — ย้ายขึ้นมาจากที่เดิม
  // ที่อยู่ถัดจาก filteredEvents เพราะตอนนั้นยังไม่ต้องใช้ค่านี้ตอนกรอง
  // ✅ เดิมนับทุกแถว event ดิบ — งานที่เข้าหลายวันไม่ติดกัน (jobGroupId เดียวกัน) ขอปิดพร้อมกันทั้ง
  // กลุ่มแล้ว (ดู handleRequestClose) ทำให้ตัวเลขนี้เพี้ยนสูงกว่าจำนวนงานจริง (เช่น 1 งานเข้า 3 วัน
  // ขึ้นเป็น "3 งาน") ใช้ countDistinctJobs จัดกลุ่มก่อนนับแทน ให้ตรงกับจำนวนงานจริงที่เห็นในพาแนล
  const pendingCount = useMemo(
    () => countDistinctJobs(events, e => e.closeRequested === true && e.status !== "ดำเนินการเสร็จสิ้น"),
    [events]
  );

  // ✅ ฝั่งช่างเหลือแค่ "ค้างงาน" กับ "เสร็จสิ้น" (รอผู้ดูแลอนุมัติ/กำลังดำเนินการ ย้ายไปจัดการที่
  // หน้า "งานของฉัน" หมดแล้ว) จึง default ไปที่ "overdue" แทน "pending" ที่ไม่มีให้เลือกอีกต่อไป
  // ✅ แอดมิน/manager: ถ้าไม่มีงานรอคุณอนุมัติเลย ให้การ์ด "กำลังดำเนินการ/ยืนยันแล้ว" ติดสว่างเป็นค่า
  // เริ่มต้นแทน "รอคุณอนุมัติ" ที่ว่างเปล่า ให้ตรงกับรายการที่แสดงจริงด้านล่าง (ดู defaultGroup ข้างล่าง)
  // ✅ ยกเว้น: ถ้ามาจากลิงก์เจาะจงสถานะ (?status=... ตั้ง filterOP ไว้) แต่ไม่ได้ระบุ ?group= มาด้วย
  // อย่า fallback ไปเดาแท็บ default ให้ — เพราะ filterOP กรองผลลัพธ์ตรงๆ อยู่แล้ว (ไม่ผ่าน group เลย
  // ดู matchGroup ด้านล่าง) ถ้าแท็บ default ติดสว่างทั้งที่ไม่ตรงกับรายการที่เห็นจริงจะยิ่งทำให้สับสน
  // ✅ เดียวกันกับตอนเปิดงานเจาะจงตัวเดียว (/operation/:id) — งานบางสถานะ (เช่น "กำลังรอยืนยัน"
  // ที่พบบ่อยในงานที่ "กำลังจะถึง" จาก Dashboard) ไม่มีแท็บกลุ่มไหนตรงกับสถานะนี้เลย (ดู
  // resolveOperationGroup) ทำให้ลิงก์ไม่ได้ส่ง ?group= มาด้วย ถ้ายัง fallback ไปเดาแท็บ default
  // จะติดสว่างผิดแท็บเหมือนเดิม — มี id แปลว่ากำลังดูงานเจาะจงตัวเดียวอยู่แล้ว ไม่ควรเดาแท็บกลุ่ม
  // ✅ ย้ายมาไว้ก่อน sortedEvents (เดิมอยู่ท้ายไฟล์ใกล้ render) เพราะตอนนี้ sortedEvents ต้องรู้ว่า
  // กำลังดูแท็บ "ค้างงาน" อยู่หรือเปล่า เพื่อเรียงงานตามความรุนแรง (วันที่ค้างมากสุดก่อน) แทน
  const effectiveGroup =
    statusGroup ||
    (filterOP || id
      ? ""
      : isAdminOrManager
        ? pendingCount > 0
          ? "pending"
          : "active"
        : "overdue");

  const filteredEvents = useMemo(() => {
  // ✅ เดิม return แค่ [selectedEvent] ตัวเดียว — งานที่เข้าหลายวันไม่ติดกัน (ผูกด้วย jobGroupId
  // เดียวกัน) พอกดจากลิงก์เจาะจงวันใดวันหนึ่ง (เช่นจาก ContractOverview.js ช่องครั้งที่) จะเห็น
  // แค่วันนั้นวันเดียวโดดๆ ไม่ถูกจัดกลุ่มเป็นงานเดียวกันเหมือนตอนดูจากรายการหลัก ต้องดึงทุก session
  // ที่มี jobGroupId เดียวกันมาด้วย ให้ jobGroups ด้านล่างจัดกลุ่มการ์ดได้ถูกต้องเหมือนกันทุกทาง
  if (id && selectedEvent) {
    return selectedEvent.jobGroupId
      ? events.filter(e => e.jobGroupId === selectedEvent.jobGroupId)
      : [selectedEvent];
  }
  return events.filter(event => {
    const matchMonth  = dateSearch ? moment(event.start).format("YYYY-MM") === dateSearch : true;
    const matchType   = filterType   ? event.title  === filterType   : true;
    const matchSystem = filterSystem ? event.system === filterSystem  : true;
    const matchTeam   = filterTeam   ? event.team   === filterTeam   : true;
    const matchStatus = filterStatus ? [event.status_two, event.status_three].includes(filterStatus) : true;
    const matchOP     = filterOP     ? event.status === filterOP     : true;

    // ✅ ตัดงานฝั่งช่างให้เหลือแค่กลุ่มที่ต้องติดตาม (ค้างงาน/เสร็จสิ้น) — งานที่กำลังลงมือทำจริง/รออนุมัติ
    // ย้ายไปจัดการทั้งหมดที่หน้า "งานของฉัน" (technician/jobs) แทน ไม่มี "pending"/"active" ให้เลือก
    // ในมุมมองของช่างอีกต่อไป — ต้องคำนวณกลุ่มนี้ "ก่อน" matchNotPending เพราะกลุ่ม "ค้างงาน" ต้อง
    // งดเว้นการตัด "กำลังรอยืนยัน" ออก (ดูเหตุผลด้านล่าง)
    const isAdminOrManagerRole = ["admin", "manager"].includes(currentUserRole);
    // ✅ เดิม default ไปที่ "pending" (รอคุณอนุมัติ) เสมอสำหรับแอดมิน/manager แม้ไม่มีงานรออนุมัติเลย
    // ทำให้เปิดหน้ามาเจอ "ไม่พบรายการ" ว่างเปล่าโดยไม่มีอะไรผิดพลาดจริง — ถ้าไม่มีคำขอปิดงานรออยู่
    // ให้ default ไปโชว์ "กำลังดำเนินการ/ยืนยันแล้ว" แทน ซึ่งมักจะมีงานอยู่จริงให้เห็นทันที
    const defaultGroup = pendingCount > 0 ? "pending" : "active";
    const group = filterOP ? null : (statusGroup || (isAdminOrManagerRole ? defaultGroup : "overdue"));

    // ✅ เดิมตัดงานสถานะ "กำลังรอยืนยัน" ออกทั้งหมดเสมอ (ยกเว้นกรองเจาะจงเอง) แต่งานที่ค้างมานาน
    // จนเลยกำหนดโดยไม่เคยถูกยืนยันเลยตั้งแต่แรกคืองานที่กลุ่ม "ค้างงาน" ต้องจับให้ได้มากที่สุด —
    // ตัดออกเสมอทำให้ตัวเลขบน badge (นับจาก isFlaggedDays ตรงๆ ไม่รู้จัก exclusion นี้) กับรายการที่
    // แสดงจริงไม่ตรงกัน (เห็น badge ว่า 3 งาน แต่เปิดมา "ไม่พบรายการ") จึงงดเว้นเฉพาะตอนดูกลุ่มนี้
    // ✅ กลุ่ม "pending" (รอคุณอนุมัติ) เจอบั๊กเดียวกัน — งานที่ช่างขอปิดตั้งแต่ยังไม่เคยถูกยืนยัน
    // สถานะเลย (status ยังเป็น "กำลังรอยืนยัน" อยู่ แต่ closeRequested:true แล้ว) ถูกตัดออกจากรายการ
    // ทั้งที่ pendingCount/ClosureRequestsPanel นับรวมงานนี้ไว้แล้ว ทำให้เห็น badge "2 งาน" แต่เปิด
    // แท็บมาแล้วเจอ "ไม่พบรายการ" ว่างเปล่า ต้องงดเว้นตัดออกในกลุ่มนี้ด้วยเช่นกัน
    const matchNotPending = (filterOP === "กำลังรอยืนยัน" || group === "overdue" || group === "pending")
      ? true
      : event.status !== "กำลังรอยืนยัน";

    let matchGroup;
    if (!group) {
      matchGroup = true;
    } else if (group === "pending")      matchGroup = event.closeRequested === true && event.status !== "ดำเนินการเสร็จสิ้น";
    // ✅ ตัดงานที่ค้างเกินกำหนดออกจากกลุ่มนี้ ให้ไปอยู่แถบ "ค้างงาน" แถบเดียว (ดูเหตุผลเต็มที่ inProgressCount)
    else if (group === "active")  matchGroup = ["ยืนยันแล้ว", "กำลังดำเนินการ"].includes(event.status)
      && !event.closeRequested
      && !isFlaggedDays(daysPastDueMap.get(event._id)?.days);
    else if (group === "overdue") matchGroup = isFlaggedDays(daysPastDueMap.get(event._id)?.days);
    else                          matchGroup = event.status === "ดำเนินการเสร็จสิ้น"; // "closed"

    const keyword = search.toLowerCase();
    const matchSearch = keyword
      ? [event.company, event.site, event.title, event.system, event.team, event.docNo,
         moment(event.start).format("DD/MM/YYYY HH:mm")]
          .map(v => (v || "").toLowerCase()).some(t => t.includes(keyword))
      : true;

    return matchMonth && matchType && matchSystem && matchStatus && matchOP && matchTeam && matchSearch && matchNotPending && matchGroup;
  });
}, [id, selectedEvent, events, dateSearch, filterType, filterSystem, filterStatus, filterOP, filterTeam, search, statusGroup, currentUserRole, daysPastDueMap, pendingCount]);

  // ✅ แท็บ "ค้างงาน" เดิมเรียงตามวันที่เริ่มงานเหมือนแท็บอื่นๆ ทำให้ป้าย "เลยกำหนด X วัน" โผล่มาแบบ
  // สลับมั่วไม่มีลำดับ (เช่น 10, 14, 13, 20 วัน สลับกันไปมา) ดูยากว่างานไหนควรรีบทำก่อน — เรียง
  // ตามจำนวนวันที่ค้างมากสุดก่อนแทนเฉพาะแท็บนี้ ให้เห็นชัดว่างานไหนเร่งด่วนที่สุดอยู่บนสุดเสมอ
  // (แท็บอื่นยังเรียงตามวันที่เริ่มงานล่าสุดก่อนเหมือนเดิม)
  const sortedEvents = useMemo(() => {
    if (effectiveGroup === "overdue") {
      return filteredEvents.slice().sort((a, b) => {
        const daysA = daysPastDueMap.get(a._id)?.days ?? 0;
        const daysB = daysPastDueMap.get(b._id)?.days ?? 0;
        return daysB - daysA;
      });
    }
    // ✅ แท็บ "เสร็จสิ้น" ให้เอางานล่าสุดขึ้นก่อน (ใหม่ไปเก่า) — ต่างจากแท็บอื่นที่เรียงเก่าไปใหม่
    // เพราะงานที่ปิดแล้วอยากเห็นงานที่เพิ่งเสร็จล่าสุดก่อน ไม่ใช่งานเก่าที่ปิดไปนานแล้ว
    if (effectiveGroup === "closed") {
      return filteredEvents.slice().sort((a, b) => new Date(b.start) - new Date(a.start));
    }
    // ✅ เรียงจากวันเก่าสุด (ก่อนวันปัจจุบัน) ไล่ไปจนถึงอนาคต — งานที่ค้าง/ใกล้ถึงกำหนดอยู่บนสุด
    // เดิมเรียงจากวันลงงานล่าสุดก่อน (ใหม่ไปเก่า) ทำให้งานที่ลงวันในอนาคตไกลๆ แซงหน้างานที่ควรทำก่อน
    return filteredEvents.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
  }, [filteredEvents, effectiveGroup, daysPastDueMap]);
  const activeFilterCount = [filterType, filterSystem, filterStatus, filterOP, search.trim(), filterTeam].filter(Boolean).length;

  // นับจำนวนงานแต่ละกลุ่มไว้โชว์บน toggle — อ้างอิงจาก events ทั้งหมด ไม่ผ่านตัวกรองอื่น
  // ✅ ใช้ countDistinctJobs จัดกลุ่มก่อนนับเหมือนกัน (เทียบเหตุผลเดียวกับ pendingCount ด้านบน)
  const closedCount   = useMemo(() => countDistinctJobs(events, e => e.status === "ดำเนินการเสร็จสิ้น"), [events]);
  // 🐛 BUG ที่แก้ (งานค้างโผล่ซ้ำ 2 แถบ): เดิมนับงานสถานะ "ยืนยันแล้ว/กำลังดำเนินการ" ทั้งหมดเข้ากลุ่มนี้
  // โดยไม่สนว่าเลยกำหนดไปแล้วหรือยัง — งานที่ค้างเกิน 1 สัปดาห์จึงถูกนับ/แสดงทั้งใน "กำลังดำเนินการ"
  // และ "ค้างงาน" พร้อมกัน ตัวเลขบนการ์ดรวมกันแล้วเกินจำนวนงานจริง และไล่ดูทีละแถบก็เจองานเดิมซ้ำ
  // ⚠️ อีก 2 กลุ่มไม่มีปัญหานี้อยู่แล้ว — buildDaysPastDueMap ยกเว้นงานที่ปิดแล้ว/ขอปิดแล้วออกจากการนับ
  // "ค้างงาน" ตั้งแต่ต้นทาง (ดู utils/overdueJobs.js) จึงทับซ้อนกันเฉพาะคู่นี้คู่เดียว
  // ✅ "ค้างงาน" เป็นกลุ่มที่เร่งด่วนกว่า จึงให้ครองงานนั้นไว้แถบเดียว ส่วนกลุ่มนี้เหลือเฉพาะงานที่ยังอยู่
  // ในกำหนดจริงๆ — แต่ละงานอยู่แถบเดียวเสมอ ผลรวมของทุกแถบ = จำนวนงานทั้งหมดพอดี
  const inProgressCount  = useMemo(
    () => countDistinctJobs(
      events,
      e => ["ยืนยันแล้ว", "กำลังดำเนินการ"].includes(e.status)
        && !e.closeRequested
        && !isFlaggedDays(daysPastDueMap.get(e._id)?.days),
    ),
    [events, daysPastDueMap]
  );
  const overdueCount     = useMemo(() => countFlaggedJobs(events, daysPastDueMap, isFlaggedDays), [events, daysPastDueMap]);
  const severeOverdueCount = useMemo(() => countFlaggedJobs(events, daysPastDueMap, isSevereDays), [events, daysPastDueMap]);

  // ✅ จัดกลุ่ม event ที่เป็น "งานเดียวกัน" เข้าด้วยกัน กันงานที่ต้องเข้าหลายวันแบบไม่ติดกัน
  // (เช่น PM ครั้งที่ 1 แบ่งเข้า 3 วันเว้นระยะ) ถูกนับ/แสดงเป็นคนละงานแยกกัน
  // ลำดับความสำคัญ: jobGroupId (งานที่สร้างผ่านฟอร์มหลายวันแบบใหม่ ผูกกันแน่นอน) →
  // fallback จับคู่ตาม company/site/title/system/team/time ที่ตรงกันทุกช่อง (งานเก่าก่อนมี jobGroupId)
  const getJobSignature = (ev) => {
    if (ev.jobGroupId) return `gid:${ev.jobGroupId}`;
    return ["company", "site", "title", "system", "team", "time"]
      .map(k => (ev[k] || "").toString().trim().toLowerCase())
      .join("|");
  };

  const jobGroups = useMemo(() => {
    const map = new Map();
    sortedEvents.forEach(ev => {
      const key = getJobSignature(ev);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    });
    // แต่ละกลุ่มเรียงวันที่ล่าสุดขึ้นก่อน (เหมือน sortedEvents เดิม)
    return [...map.values()].map(sessions =>
      sessions.slice().sort((a, b) => new Date(b.start) - new Date(a.start))
    );
  }, [sortedEvents]);

  // รีเซ็ตกลับหน้า 1 ทุกครั้งที่ตัวกรอง/คำค้นหา/แท็บ/กลุ่มสถานะเปลี่ยน
  useEffect(() => {
    setPage(1);
  }, [dateSearch, filterType, filterSystem, filterStatus, filterOP, filterTeam, search, activeTab, statusGroup]);

  // ✅ เพจจิ้งอิงตาม "งาน" (jobGroups) ไม่ใช่ raw event — กันงานเดียวกันถูกตัดกระจายไปคนละหน้า
  const totalPages = Math.max(1, Math.ceil(jobGroups.length / pageSize));

  // กันหน้าเกินขอบเขตเมื่อผลลัพธ์หลังกรองน้อยกว่าหน้าปัจจุบัน
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedGroups = useMemo(
    () => jobGroups.slice((page - 1) * pageSize, page * pageSize),
    [jobGroups, page, pageSize]
  );

  // ✅ ?highlight=<id> (จากปุ่ม "ตรวจสอบ" ในพาแนล "งานที่ช่างขอปิด") — งานที่ต้องการอาจไม่ได้อยู่
  // หน้าแรกของรายการ (แบ่งหน้าอยู่) ต้องหาก่อนว่างานนี้อยู่หน้าไหนแล้วกระโดดไปหน้านั้นให้อัตโนมัติ
  useEffect(() => {
    if (!highlightJobId || jobGroups.length === 0) return;
    const idx = jobGroups.findIndex(sessions => sessions.some(s => s._id === highlightJobId));
    if (idx === -1) return;
    const targetPage = Math.floor(idx / pageSize) + 1;
    setPage(p => (p === targetPage ? p : targetPage));
  }, [highlightJobId, jobGroups, pageSize]);

  // ✅ พอเปลี่ยนไปหน้าที่ถูกต้องแล้ว (pagedGroups อัปเดต) ค่อยเลื่อนจอไปหาการ์ดนั้นจริงๆ แล้วเคลียร์
  // highlightId ทิ้งหลังจากนั้นสักพัก ให้กรอบไฮไลต์กระพริบแค่ชั่วคราว ไม่ค้างตลอดไป
  useEffect(() => {
    if (!highlightJobId) return;
    const el = document.getElementById(`job-card-${highlightJobId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(() => setHighlightId(""), 3000);
    return () => clearTimeout(timer);
  }, [highlightId, highlightJobId, pagedGroups]);

  // ✅ งานที่เข้าหลายวัน (ผูกด้วย jobGroupId เดียวกัน) ถือเป็นงานเดียวกัน — แก้ไขจากวันไหน
  // ในกลุ่มก็ควรอ้างอิง id เดียวกันทั้งหมด เพื่อแก้ไขทุกวันในกลุ่มพร้อมกันในคราวเดียว
  // ไม่งั้นแต่ละวันจะมีสถานะ/เลขเอกสารไม่ตรงกันทั้งที่จริงเป็นงานเดียวกัน
  const getGroupEventIds = useCallback((id) => {
    const target = events.find(e => e._id === id);
    if (!target?.jobGroupId) return [id];
    return events.filter(e => e.jobGroupId === target.jobGroupId).map(e => e._id);
  }, [events]);

  const handleStatusUpdate = useCallback(async (id, updates) => {
    try {
      const ids = getGroupEventIds(id);
      await Promise.all(ids.map(gid => EventService.UpdateEvent(gid, updates)));
      setEvents(prev => prev.map(e => (ids.includes(e._id) ? { ...e, ...updates } : e)));
    } catch (err) {
      console.error(err);
      // ✅ ตอนนี้ backend ปฏิเสธ (403) การเปลี่ยนเป็น "ดำเนินการเสร็จสิ้น" สำหรับงานที่ยังรออนุมัติ
      // (ดู PUT /:id operational guard) — เดิม error หายเงียบๆ ไม่มีอะไรบอกผู้ใช้เลยว่าทำไมสถานะไม่เปลี่ยน
      setSnackbar({ open: true, msg: err?.response?.data?.message || "เปลี่ยนสถานะไม่สำเร็จ", severity: "error" });
    }
  }, [getGroupEventIds]);

  // ✅ แก้ไขวันที่เข้างาน — ต่างจาก handleStatusUpdate ตรงที่แก้ "เฉพาะวันนั้น" (id เดียว) ไม่ใช่ทั้งกลุ่ม
  // เพราะงานที่เข้าหลายวันไม่ติดกัน (jobGroupId เดียวกัน) แต่ละวันมีวันที่ของตัวเองไม่เหมือนกันโดย
  // ตั้งใจ — ปล่อยให้ error ลอยขึ้นไปให้ EventRowCard จับเองเพื่อโชว์ข้อความจาก backend (เช่นช่างชนกัน)
  const handleDateUpdate = useCallback(async (id, updates) => {
    await EventService.UpdateEvent(id, updates);
    setEvents(prev => prev.map(e => (e._id === id ? { ...e, ...updates } : e)));
  }, []);

  // อนุมัติคำขอปิดงานจากช่าง → เปลี่ยนสถานะเป็น "ดำเนินการเสร็จสิ้น"
  // ✅ ถ้างานนี้เข้าหลายวัน (กลุ่มเดียวกัน) ให้ปิดทุกวันในกลุ่มพร้อมกัน — งานที่ถือว่าเสร็จแล้ว
  // ควรเสร็จทั้งหมดทุกวัน ไม่ใช่แค่วันที่กดอนุมัติ (การ์ดวันอื่นจะได้ไม่ค้างสถานะเดิม)
  const handleApproveClose = useCallback(async (id) => {
    try {
      const payload   = JSON.parse(localStorage.getItem("payload") || "{}");
      const adminName = payload?.name || payload?.username || "แอดมิน";
      const now = new Date().toISOString();

      const target = events.find(e => e._id === id);
      const newLog = {
        action: "close_approved",
        detail: `อนุมัติปิดงานโดย ${adminName}`,
        userName: adminName,
        timestamp: now,
      };

      const sharedUpdates = {
        status: "ดำเนินการเสร็จสิ้น",
        closeRequested: false,
        closeApprovedAt: now,
        closeApprovedBy: adminName,
      };

      const ids = getGroupEventIds(id);
      await Promise.all(ids.map(gid => {
        const data = gid === id
          ? { ...sharedUpdates, activityLog: [...(target?.activityLog || []), newLog] }
          : sharedUpdates;
        return EventService.UpdateEvent(gid, data);
      }));
      setEvents(prev => prev.map(e => {
        if (!ids.includes(e._id)) return e;
        return e._id === id
          ? { ...e, ...sharedUpdates, activityLog: [...(e.activityLog || []), newLog] }
          : { ...e, ...sharedUpdates };
      }));
      setSnackbar({ open: true, msg: "อนุมัติปิดงานเรียบร้อย", severity: "success" });
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, msg: "อนุมัติปิดงานไม่สำเร็จ", severity: "error" });
    }
  }, [events, getGroupEventIds]);

  // ไม่อนุมัติคำขอปิดงานจากช่าง → เปิดให้ช่างแก้ไขแล้วขอปิดงานใหม่ได้ พร้อมเหตุผล/comment แจ้งช่าง
  // ✅ ตอนขอปิดงาน (handleRequestClose ใน TechnicianJobPanel.js) ตอนนี้ตั้ง closeRequested:true
  // ให้ทุกวันในกลุ่มเดียวกันพร้อมกันแล้ว (ผ่าน onStatusUpdate/getGroupEventIds) — ตอนไม่อนุมัติก็ต้อง
  // เคลียร์ closeRequested คืนให้ครบทุกวันในกลุ่มเดียวกันด้วย ไม่งั้นวันที่เหลือจะค้าง closeRequested:true
  // ตลอดไปโดยไม่มีทางให้ช่างขอปิดใหม่ได้อีก (ปุ่ม "ขอปิดงานอีกครั้ง" โชว์แค่การ์ดตัวแทนของกลุ่มเท่านั้น)
  const handleRejectClose = useCallback(async (id, reason) => {
    try {
      const payload   = JSON.parse(localStorage.getItem("payload") || "{}");
      const adminName = payload?.name || payload?.username || "แอดมิน";
      const now = new Date().toISOString();

      const target = events.find(e => e._id === id);
      const newLog = {
        action: "close_rejected",
        detail: reason ? `ไม่อนุมัติปิดงานโดย ${adminName}: ${reason}` : `ไม่อนุมัติปิดงานโดย ${adminName}`,
        userName: adminName,
        timestamp: now,
      };

      const sharedUpdates = {
        closeRequested: false,
        closeRejectedAt: now,
        closeRejectedBy: adminName,
        closeRejectReason: reason || "",
      };

      const ids = getGroupEventIds(id);
      await Promise.all(ids.map(gid => {
        const data = gid === id
          ? { ...sharedUpdates, activityLog: [...(target?.activityLog || []), newLog] }
          : sharedUpdates;
        return EventService.UpdateEvent(gid, data);
      }));
      setEvents(prev => prev.map(e => {
        if (!ids.includes(e._id)) return e;
        return e._id === id
          ? { ...e, ...sharedUpdates, activityLog: [...(e.activityLog || []), newLog] }
          : { ...e, ...sharedUpdates };
      }));
      setSnackbar({ open: true, msg: "ไม่อนุมัติคำขอปิดงานแล้ว", severity: "success" });
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, msg: "ดำเนินการไม่สำเร็จ", severity: "error" });
    }
  }, [events, getGroupEventIds]);

  const handleDocNoUpdate = useCallback((id, newDocNo) => {
    const ids = getGroupEventIds(id);
    setEvents(prev => prev.map(e => (ids.includes(e._id) ? { ...e, docNo: newDocNo } : e)));
    ids.forEach(gid => EventService.UpdateEvent(gid, { docNo: newDocNo }));
  }, [getGroupEventIds]);

  const handleInputUpdate = useCallback(async (id, data) => {
    try {
      await EventService.UpdateEvent(id, data);
      setEvents(prev => prev.map(e => {
        if (e._id !== id) return e;
        return { ...e, ...data, activityLog: data.activityLog ?? e.activityLog };
      }));
    } catch (err) { console.error(err); }
  }, []);

  const handleDeleteRow = (customerId) => {
    Swal.fire({
      title: "ยืนยันการลบ", text: "เมื่อลบแล้วจะไม่สามารถกู้คืนได้", icon: "warning",
      showCancelButton: true, confirmButtonColor: "#ef4444", cancelButtonColor: "#6b7280",
      confirmButtonText: "ลบเลย", cancelButtonText: "ยกเลิก",
    }).then(async result => {
      if (result.isConfirmed) {
        try {
          await EventService.DeleteEvent(customerId);
          setEvents(prev => prev.filter(e => e._id !== customerId));
          setSnackbar({ open: true, msg: "ลบรายการเรียบร้อย", severity: "success" });

                  fetchEventsFromDB(true)

        } catch {
          setSnackbar({ open: true, msg: "เกิดข้อผิดพลาด", severity: "error" });
        }
      }
    });
  };

  // ✅ เดิมไม่บันทึก activityLog เลยตอนลบไฟล์ (ทั้งฝั่งช่างและแอดมิน) ทำให้ "ประวัติการทำงาน"
  // ไม่เห็นว่าใครลบไฟล์อะไรไปบ้าง — หาเชื่อไฟล์ไว้ก่อนลบ (หลังลบแล้วจะหาไม่เจอในไฟล์ list อีก)
  // แล้วบันทึกลง activityLog ของ event นั้นด้วย
  const handleDeleteFile = useCallback(async (eventId, type, fileId) => {
    try {
      const target = events.find(e => e._id === eventId);
      const deletedFile = (target?.[`${type}Files`] || []).find(f => f._id === fileId);

      await EventService.DeleteFile(eventId, type, fileId);

      const payload    = JSON.parse(localStorage.getItem("payload") || "{}");
      const actorName  = payload?.name || payload?.username || "ผู้ใช้งาน";
      const label      = DOC_TYPE_LABELS[type] || type;
      const newLog = {
        action: "file_deleted",
        detail: deletedFile?.fileName ? `${label}: ${deletedFile.fileName}` : label,
        userName: actorName,
        timestamp: new Date().toISOString(),
      };
      await EventService.UpdateEvent(eventId, { activityLog: [...(target?.activityLog || []), newLog] });

      setSnackbar({ open: true, msg: "ลบไฟล์เรียบร้อย", severity: "success" });
      await fetchEventsFromDB(true);
    } catch {
      setSnackbar({ open: true, msg: "ลบไฟล์ไม่สำเร็จ", severity: "error" });
    }
  }, [events]);

  // ✅ รองรับแนบหลายไฟล์พร้อมกัน (FileList หรือ array ของ File) — อัปโหลดทีละไฟล์ตามลำดับ
  const handleFileUpload = useCallback(async (fileOrFiles, eventId, type) => {
    const files = Array.from(fileOrFiles?.length !== undefined ? fileOrFiles : [fileOrFiles]);
    if (files.length === 0) return;

    setUploadingState(p => ({ ...p, [type]: eventId }));
    setIsUploadingState(p => ({ ...p, [type]: true }));

    let successCount = 0;
    const uploadedNames = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const sizeLabel = `${(file.size / (1024 * 1024)).toFixed(2)} MB` + (files.length > 1 ? ` (${i + 1}/${files.length})` : "");
        setUploadingFileSizeState(p => ({ ...p, [type]: sizeLabel }));
        setUploadProgressState(p => ({ ...p, [type]: 0 }));

        await EventService.Upload(eventId, file, type, {
          // ✅ เดิมหลอดโหลดขึ้น 100% ทันทีที่เบราว์เซอร์ส่งไฟล์ครบ (upload transfer เสร็จ) แต่
          // เซิร์ฟเวอร์อาจยังประมวลผลต่อ (เขียนไฟล์/อัปโหลดขึ้น storage) อยู่ ทำให้หลอดโหลดเต็ม
          // 100 ทั้งที่ยังไม่เสร็จจริง ต้องรอ — จำกัดไว้ที่ 99% ระหว่างส่งไฟล์ แล้วค่อยขึ้น 100%
          // ตอน await resolve จริงๆ (เซิร์ฟเวอร์ตอบกลับมาแล้ว) ให้ตรงกับสถานะจริง
          onUploadProgress: pe => {
            const pct = Math.round((pe.loaded * 100) / pe.total);
            setUploadProgressState(p => ({ ...p, [type]: Math.min(pct, 99) }));
          },
        });
        setUploadProgressState(p => ({ ...p, [type]: 100 }));
        successCount++;
        uploadedNames.push(file.name);
      }
      setSnackbar({ open: true, msg: `อัปโหลด ${successCount} ไฟล์เรียบร้อย`, severity: "success" });

      // ✅ บันทึกลง activityLog ว่าใครอัปโหลดไฟล์อะไรไปบ้าง — เดิมฝั่งแอดมินไม่มีการบันทึกเลย
      // (ฝั่งช่างเคยบันทึกเองแยกอีกชั้นที่ TechnicianJobPanel.js ซึ่งย้ายมารวมไว้ที่นี่แทน
      // เพื่อให้ครอบคลุมทั้งสองฝั่งด้วยจุดเดียว ไม่ต้องบันทึกซ้ำซ้อน)
      if (uploadedNames.length > 0) {
        const target    = events.find(e => e._id === eventId);
        const payload    = JSON.parse(localStorage.getItem("payload") || "{}");
        const actorName  = payload?.name || payload?.username || "ผู้ใช้งาน";
        const label      = DOC_TYPE_LABELS[type] || type;
        const detail = uploadedNames.length > 1
          ? `${label}: ${uploadedNames.length} ไฟล์ (${uploadedNames.join(", ")})`
          : `${label}: ${uploadedNames[0]}`;
        const newLog = {
          action: "file_uploaded",
          detail,
          userName: actorName,
          timestamp: new Date().toISOString(),
        };
        await EventService.UpdateEvent(eventId, { activityLog: [...(target?.activityLog || []), newLog] });
      }
    } catch {
      setSnackbar({
        open: true,
        msg: successCount > 0 ? `อัปโหลดสำเร็จ ${successCount}/${files.length} ไฟล์ (มีไฟล์ที่ล้มเหลว)` : "อัปโหลดไม่สำเร็จ",
        severity: "error",
      });
    } finally {
      await fetchEventsFromDB(true);
      setIsUploadingState(p => ({ ...p, [type]: false }));
      setTimeout(() => {
        setUploadingState(p => ({ ...p, [type]: null }));
        setUploadingFileSizeState(p => ({ ...p, [type]: "" }));
        setUploadProgressState(p => ({ ...p, [type]: 0 }));
      }, 800);
    }
  }, [events]);

  // ✅ เปลี่ยนจาก CSV เป็น Excel (.xlsx) จริง — CSV เป็นข้อความล้วน ใส่สี/ตัวหนา/ความกว้างคอลัมน์ไม่ได้
  // และครอบทุกค่าด้วยเครื่องหมายคำพูดจนกลายเป็นข้อความหมด (วันที่เรียงตามตัวอักษร ตัวเลขรวมยอดไม่ได้)
  // ⚠️ ส่งออกเป็น "รายงานรายงาน" ไม่ใช่ "แถว event ดิบ" — 1 แถว = 1 งาน (รวมทุกวันของงานเดียวกันไว้
  // ด้วยกัน) ตรงกับที่ตาเห็นบนหน้าจอ เดิม CSV แตกเป็นหลายแถวต่องานเดียว จนนับจำนวนงานจากไฟล์ไม่ได้
  const [exporting, setExporting] = useState(false);
  const handleExportExcel = async () => {
    if (exporting || jobGroups.length === 0) return;
    setExporting(true);
    try {
      const { exportOperationToExcel, buildOperationFileName } = await import("./operationExcelExport");
      const groupLabel = {
        pending: "คำขอปิดงาน", active: "กำลังดำเนินการ", overdue: "ค้างงาน", closed: "เสร็จสิ้น",
      }[effectiveGroup] || "ทั้งหมด";
      await exportOperationToExcel({
        // ⚠️ jobGroups เป็น array ของ "array of sessions" ตรงๆ (ดู useMemo ด้านบน) ไม่ใช่ object ที่มี
        // .sessions — ต้องห่อก่อนส่งเข้าโมดูล export ซึ่งอ่าน job.sessions[0] (ไม่ห่อ = undefined[0])
        jobs: jobGroups.map((sessions) => ({ sessions })),
        meta: {
          fileName: buildOperationFileName(groupLabel),
          groupLabel: `กลุ่ม: ${groupLabel}`,
          filterSummary: activeFilterCount > 0 ? `ตัวกรอง ${activeFilterCount} เงื่อนไข` : "ไม่ได้กรองเพิ่มเติม",
          exportedAt: moment().format("DD/MM/YYYY HH:mm"),
        },
        daysPastDueMap,
        isFlaggedDays,
        formatEventDateRange,
      });
      setSnackbar({ open: true, msg: "ส่งออก Excel เรียบร้อย", severity: "success" });
    } catch (err) {
      setSnackbar({ open: true, msg: err?.response?.data?.message || err.message || "ส่งออกไม่สำเร็จ", severity: "error" });
    } finally {
      setExporting(false);
    }
  };

  const { notifications, unread, markRead, markAllRead } = useEventNotifications(
    events,
    isAdminOrManager ? "admin" : "technician"
  );

  return (
    <Box sx={{ px: { xs: 1, sm: 2, md: 3 }, py: 3, maxWidth: 1400, mx: "auto" }}>

      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }} flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="h5" fontWeight={800} letterSpacing={-0.5}>การดำเนินงาน</Typography>
          {/* 🐛 BUG ที่แก้ (ตัวเลขใต้หัวข้อไม่ตรงกับสิ่งที่เห็นบนจอ): เดิมโชว์ sortedEvents.length เสมอ
              ซึ่งเป็นจำนวนงานของแท็บ "รายการงาน" — พอสลับไปแท็บ "รออนุมัติ" ที่มี 0 งาน หัวข้อยังขึ้น
              "1 รายการ" ค้างอยู่ (จำนวนของอีกแท็บ) อ่านแล้วขัดกันเองทันที
              ✅ ให้ตัวเลขเปลี่ยนตามแท็บที่เปิดอยู่จริง และซ่อน "กรอง N เงื่อนไข" ตอนอยู่แท็บรออนุมัติ
              เพราะตัวกรองพวกนั้นไม่มีผลกับแท็บนั้นเลย */}
          <Typography variant="body2" color="text.secondary">
            {loading
              ? "กำลังโหลด..."
              : activeTab === 1
              ? `${pendingApprovalTabCount} งานรออนุมัติ`
              : `${sortedEvents.length} รายการ${activeFilterCount > 0 ? ` · กรอง ${activeFilterCount} เงื่อนไข` : ""}`}
          </Typography>
        </Box>
        {/* ✅ ปุ่มวงกลม ขนาด 40px ให้แตะง่ายขึ้นบนมือถือ (เดิม size="small" เล็กไปสำหรับนิ้วมือ)
            เข้าธีมเดียวกับปุ่มวงกลมที่ใช้ทั่วแอป (bell button ใน Dashboard/Header) */}
        <Stack direction="row" gap={1}>
          <Tooltip title="รีเฟรช">
            <IconButton onClick={() => fetchEventsFromDB()}
              sx={{ border: "1px solid", borderColor: "divider", borderRadius: "50%", width: 40, height: 40 }}>
              <Refresh fontSize="small" />
            </IconButton>
          </Tooltip>
          {/* Notification bell — ทุก role เห็น แต่เนื้อหาต่างกันตามฝั่ง (ดูคอมเมนต์ใน NotificationBell) */}
          <NotificationBell notifications={notifications} unread={unread} onItemClick={markRead} onMarkAllRead={markAllRead} />
          {/* ✅ สลับมุมมองการ์ด ↔ ตาราง — การ์ดอ่านรายละเอียดทีละงานได้ครบ (มีเอกสาร/คอมเมนต์/ปุ่มจัดการ
              ในตัว) ส่วนตารางไว้กวาดดูหลายงานพร้อมกัน/เทียบกัน เทียบ pattern เดียวกับหน้าติดตามใบเสนอราคา */}
          <ToggleButtonGroup
            size="small" exclusive value={viewMode}
            onChange={(_, v) => v && setViewMode(v)}
            sx={{ "& .MuiToggleButton-root": { px: 1.25, py: 0.75, borderRadius: 2 } }}
          >
            <ToggleButton value="card" title="มุมมองการ์ด"><ViewList sx={{ fontSize: 18 }} /></ToggleButton>
            <ToggleButton value="table" title="มุมมองตาราง"><TableChart sx={{ fontSize: 18 }} /></ToggleButton>
          </ToggleButtonGroup>
          {isAdminOrManager && (
            <Tooltip title="ส่งออกเป็นไฟล์ Excel (.xlsx)">
              <span>
                <IconButton onClick={handleExportExcel} disabled={exporting || jobGroups.length === 0}
                  sx={{
                    border: "1px solid", borderRadius: "50%", width: 40, height: 40,
                    borderColor: alpha("#047857", 0.25), color: "#047857",
                    "&:hover": { bgcolor: alpha("#047857", 0.08), borderColor: "#047857" },
                  }}>
                  <FontAwesomeIcon icon={faFileExcel} style={{ fontSize: 16 }} />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Stack>
      </Stack>

      {/* ✅ ย้ายมาไว้บนสุดของหน้า (เหนือแท็บ/การ์ดสรุปสถานะทั้งหมด) ให้แอดมิน/manager เห็นคำขอ
          ปิดงานที่รอตรวจสอบทันทีที่เปิดหน้า ไม่ต้องเลื่อนหา — และ ClosureRequestsPanel เองจะไม่
          render อะไรเลยถ้าไม่มีคำขอค้างอยู่ (return null) จึงไม่กินพื้นที่เวลาไม่มีงานรอตรวจสอบ */}
      {isAdminOrManager && (
        <ClosureRequestsPanel
          events={events}
          onReject={handleRejectClose}
        />
      )}

      {/* ✅ เดิมเป็นแถบ Alert สีฟ้าเต็มความกว้างเขียนว่า "กรองเฉพาะงาน: ..." ซึ่งกินที่และอ่านแล้วเหมือน
          คำเตือนว่ามีอะไรผิด ทั้งที่เป็นเรื่องปกติ (กดมาจากลิงก์เจาะจงงาน) — ย่อเหลือแถบเล็กๆ บรรทัดเดียว
          และเพิ่มปุ่ม "ดูในปฏิทิน" ตามที่ผู้ใช้ขอ เพื่อกระโดดไปดูงานนี้บนปฏิทินแบบเจาะจงวันได้เลย
          ⚠️ ยังคง "กรองเหลืองานเดียว" ไว้เหมือนเดิม (ไม่ได้เอาออก) เพราะลิงก์ที่พามาที่ /operation/:id
          มาจากหลายที่ (แจ้งเตือน/แผงรออนุมัติ/ตาราง) ถ้าไม่กรอง งานที่ตั้งใจให้ดูอาจไม่อยู่ในหน้าปัจจุบัน
          เลย (โดนตัวกรองเดือน/สถานะที่ค้างอยู่คัดออก) กลายเป็นกดลิงก์แล้วไม่เจออะไรเลย */}
      {selectedEvent && (
        <Stack
          direction="row" alignItems="center" gap={1} flexWrap="wrap"
          sx={{
            mb: 2, px: 1.5, py: 1, borderRadius: 2,
            bgcolor: alpha("#0ea5e9", 0.06), border: "1px solid", borderColor: alpha("#0ea5e9", 0.25),
          }}
        >
          <Typography variant="caption" sx={{ color: "text.secondary", flex: 1, minWidth: 0 }}>
            กำลังดูเฉพาะงาน <strong style={{ color: "#0f172a" }}>{selectedEvent.title}</strong>
            {selectedEvent.system ? ` · ${selectedEvent.system}` : ""}
            {selectedEvent.site ? ` · ${selectedEvent.site}` : ""}
          </Typography>
          {/* ✅ ไปดูงานนี้บนปฏิทินแบบเจาะจงวัน — งานที่ยังไม่ลงตารางไม่มีวันที่จริง ส่งไปที่แผง
              งานล่วงหน้า (?draft=) แทน ซึ่งเป็นที่ที่การ์ดของมันอยู่จริง */}
          <Button
            size="small" variant="outlined" startIcon={<CalendarMonth sx={{ fontSize: 15 }} />}
            onClick={() => {
              const q = selectedEvent.unscheduled
                ? `draft=${selectedEvent._id}&month=${selectedEvent.plannedMonth || ""}`
                : `event=${selectedEvent._id}&date=${moment(selectedEvent.start).format("YYYY-MM-DD")}`;
              navigate(`/event?${q}&t=${Date.now()}`);
            }}
            sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700, flexShrink: 0 }}
          >
            ดูในปฏิทิน
          </Button>
          <Button size="small" onClick={() => navigate("/operation")}
            sx={{ borderRadius: 2, textTransform: "none", flexShrink: 0 }}>
            แสดงทั้งหมด
          </Button>
        </Stack>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}
          sx={{ "& .MuiTabs-indicator": { height: 3, borderRadius: "3px 3px 0 0" } }}>
          {/* ✅ ตัดแท็บ "Dashboard" ออกตามที่ผู้ใช้ขอ — สถิติภาพรวมทั้งหมดที่เคยอยู่ในนั้น (จำนวนงานแยก
              สถานะ/แถบความคืบหน้า/สรุปรายช่าง) ซ้ำกับหน้า Dashboard หลักของแอปและการ์ดกลุ่มงานด้านล่าง
              ที่เห็นอยู่แล้วทุกแท็บ — หน้านี้ควรโฟกัสที่ "การดำเนินงานรายงาน" อย่างเดียว
              ✅ ตัดแท็บ "Timeline" ออกตามที่ผู้ใช้ขอเช่นกัน — เป็นการเอางานชุดเดิมมาเรียงตามเดือนเฉยๆ
              ซึ่งดูได้จากหน้าปฏิทินอยู่แล้ว และไม่มีอะไรให้จัดการงานได้จริงในนั้น (การ์ดในแท็บ
              "รายการงาน" คือที่เดียวที่แนบเอกสาร/เช็คอิน/คอมเมนต์ได้) */}
          <StyledTab icon={<TableChart fontSize="small" />} iconPosition="start" label="รายการงาน" />
          {/* ✅ ย้ายหน้า "แผนงานรออนุมัติ" (เดิมเป็นหน้าแยก /pending-approvals) มาเป็นแท็บที่นี่ตามที่
              ผู้ใช้ขอ — เป็นงานเดียวกัน (ไล่จัดการงานทีละใบ) แต่เดิมต้องสลับหน้าไปมา และตัวเลข
              "รอคุณอนุมัติ" ก็โผล่ทั้งการ์ดกลุ่มงานในหน้านี้และหน้านั้นจนดูเหมือนคนละระบบ
              ⚠️ เฉพาะแอดมิน/manager เท่านั้น (คนอื่นอนุมัติไม่ได้อยู่แล้ว — backend ตอบ 403) จึงต้องเป็น
              แท็บสุดท้าย ไม่งั้น index ของแท็บจะเลื่อนไม่ตรงกันระหว่าง role */}
          {isAdminOrManager && (
            <StyledTab
              icon={
                <Badge
                  badgeContent={pendingApprovalTabCount}
                  color="warning"
                  invisible={pendingApprovalTabCount === 0}
                  sx={{ "& .MuiBadge-badge": { fontSize: "0.6rem", height: 15, minWidth: 15 } }}
                >
                  <HourglassTop fontSize="small" />
                </Badge>
              }
              iconPosition="start"
              label="รออนุมัติ"
            />
          )}
        </Tabs>
      </Box>

      {/* ✅ แอดมิน/manager: กลุ่มงาน 4 ตัวเลือก (รอคุณอนุมัติ / กำลังดำเนินการ / ค้างงาน / เสร็จสิ้น)
          ฝั่งช่าง: เหลือแค่ "ค้างงาน" กับ "เสร็จสิ้น" (งานที่กำลังทำ/รออนุมัติ ย้ายไปหน้า "งานของฉัน" หมดแล้ว)
          เดิมใช้ ToggleButtonGroup แบบชิปเล็กเรียงแนวนอน จอมือถือห่อบรรทัดมั่วๆ กดยาก เปลี่ยนเป็น
          การ์ดใหญ่จัดกริด 2 คอลัมน์เสมอบนจอแคบ (แอดมินขยายเป็น 4 คอลัมน์แนวนอนตอนจอกว้างพอ) */}
      {activeTab !== 1 && (
        <Box sx={{
          display: "grid",
          gridTemplateColumns: isAdminOrManager ? { xs: "1fr 1fr", sm: "repeat(4, 1fr)" } : "1fr 1fr",
          gap: 1.25, mb: 3,
        }}>
          {isAdminOrManager && (
            <>
              <StatusGroupCard
                active={effectiveGroup === "pending"} onClick={() => setStatusGroup("pending")}
                icon={<HourglassTop />} color="#f59e0b" label="คำขอปิดงาน" count={pendingCount}
              />
              <StatusGroupCard
                active={effectiveGroup === "active"} onClick={() => setStatusGroup("active")}
                icon={<PendingActions />} color="#8b5cf6" label="กำลังดำเนินการ/ยืนยันแล้ว" count={inProgressCount}
              />
            </>
          )}
          <StatusGroupCard
            active={effectiveGroup === "overdue"} onClick={() => setStatusGroup("overdue")}
            icon={<Warning />} color="#ef4444" label="ค้างงาน" count={overdueCount}
            sub={severeOverdueCount > 0 ? `${severeOverdueCount} เกิน 2 สัปดาห์` : undefined}
          />
          <StatusGroupCard
            active={effectiveGroup === "closed"} onClick={() => setStatusGroup("closed")}
            icon={<CheckCircle />} color="#10b981" label="เสร็จสิ้น" count={closedCount}
          />
        </Box>
      )}

      {loading && <LinearProgress sx={{ borderRadius: 1, mb: 2 }} />}

      {/* TAB 0: TABLE */}
      {activeTab === 0 && (
        <>
          {/* LiveTrackingPanel แสดงเฉพาะ admin/manager (ClosureRequestsPanel ย้ายขึ้นไปไว้บนสุด
              ของหน้าแล้ว เห็นได้ทุกแท็บ ไม่ใช่แค่แท็บ "รายการงาน") */}
          {isAdminOrManager && (
            <LiveTrackingPanel
              events={events}
              onRefresh={() => fetchEventsFromDB(true)}
              lastRefreshed={lastRefreshed}
            />
          )}

          <FilterPanel
            search={search} onSearch={setSearch}
            filterType={filterType} onFilterType={setFilterType}
            filterSystem={filterSystem} onFilterSystem={setFilterSystem}
            filterStatus={filterStatus} onFilterStatus={setFilterStatus}
            filterOP={filterOP} onFilterOP={setFilterOP}
            filterTeam={filterTeam} onFilterTeam={setFilterTeam}
            typeOptions={typeOptions} systemOptions={systemOptions}
            showAll={showAll} onToggleShowAll={v => { setShowAll(v); if (v) setSelectedDate(""); }}
            selectedDate={selectedDate} onDateChange={d => { setSelectedDate(d); setShowAll(false); }}
            onClearAll={() => { setFilterType(""); setFilterSystem(""); setFilterStatus(""); setFilterOP(""); setFilterTeam(""); setSearch(""); }}
            activeCount={activeFilterCount}
          />

          {loading ? (
            [1, 2, 3].map(i => <Skeleton key={i} variant="rounded" height={96} sx={{ mb: 1.5, borderRadius: 2 }} />)
          ) : sortedEvents.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 10, color: "text.secondary" }}>
              <FolderOpen sx={{ fontSize: 56, opacity: 0.25, mb: 1 }} />
              <Typography fontWeight={600}>ไม่พบรายการ</Typography>
              <Typography variant="body2" color="text.disabled">ลองเปลี่ยนเงื่อนไขการค้นหา</Typography>
            </Box>
          ) : viewMode === "table" ? (
            /* ✅ มุมมองตาราง — กดแถวแล้วสลับกลับไปมุมมองการ์ดพร้อมไฮไลต์งานนั้น (การ์ดคือที่เดียวที่
               จัดการงานได้จริง: แนบเอกสาร/เช็คอิน/คอมเมนต์) จึงไม่ทำ dialog ซ้อนอีกชั้นให้ซับซ้อน */
            <OperationTable
              jobGroups={pagedGroups.map((sessions) => ({ sessions }))}
              daysPastDueMap={daysPastDueMap}
              onOpenJob={(job) => {
                setViewMode("card");
                // ⚠️ ต้องเป็นรูปแบบ "<id>|<nonce>" ตามที่ highlightId ใช้ (ดู highlightJobId ด้านบน) —
                // nonce ทำให้กดงานเดิมซ้ำแล้วไฮไลต์กระพริบใหม่ได้ทุกครั้ง ไม่ใช่ค่าเดิมจนไม่มีอะไรเกิดขึ้น
                setHighlightId(`${job.sessions[0]._id}|${Date.now()}`);
              }}
            />
          ) : (
            <>
              {/* ✅ กลับมาเป็นคอลัมน์เดียว — เดิมลองแบ่ง 2 คอลัมน์บนจอกว้าง แต่การ์ดงานกรุ๊ป (เข้า
                  หลายวันไม่ติดกัน) โชว์แถบวันที่ย่อย + "เข้างาน N วัน" เพิ่มมาตั้งแต่ตอนพับอยู่ ทำให้
                  สูงกว่าการ์ดงานวันเดียวเสมอ วางคู่กันแล้วดูไม่เท่ากัน/ไม่สวย คอลัมน์เดียวเรียงยาวลงมา
                  แทนจะเนียนตากว่า ไม่มีปัญหาความสูงไม่เท่ากันให้กวนตาอีก */}
              {pagedGroups.map(sessions => {
                // ✅ ในมุมมอง "ค้างงาน" ให้เห็นความรุนแรงต่างกันชัดๆ ก่อนเปิดการ์ด — เลย 1 สัปดาห์
                // = แจ้งเตือนสีเหลือง (ให้ทันเห็นก่อน), เลย 2 สัปดาห์ = ค้างงานเต็มตัวสีแดง
                const daysPastDueRaw = effectiveGroup === "overdue" ? (daysPastDueMap.get(sessions[0]._id)?.days ?? null) : null;
                const daysPastDue = isFlaggedDays(daysPastDueRaw) ? daysPastDueRaw : null;
                const severeOverdue = isSevereDays(daysPastDue);
                // ✅ งานที่ถูกส่งมาไฮไลต์จากปุ่ม "ตรวจสอบ" (ดู highlightId effect ด้านบน) — ใส่ id
                // ให้ scrollIntoView หาเจอ พร้อมกรอบกระพริบชั่วคราวช่วยให้เห็นชัดว่าเป็นงานไหน
                const isHighlighted = sessions.some(s => s._id === highlightJobId);

                return (
                  <Box key={sessions[0].jobGroupId || sessions[0]._id}
                    id={isHighlighted ? `job-card-${highlightJobId}` : undefined}
                    sx={{
                      mb: 2, minWidth: 0,
                      ...(isHighlighted && {
                        borderRadius: 3,
                        outline: "3px solid #f59e0b",
                        outlineOffset: 2,
                        animation: "highlightPulse 0.9s ease-in-out 3",
                        "@keyframes highlightPulse": {
                          "0%, 100%": { outlineColor: alpha("#f59e0b", 1) },
                          "50%": { outlineColor: alpha("#f59e0b", 0.15) },
                        },
                      }),
                    }}>
                    {daysPastDue !== null && daysPastDue !== undefined && (
                      <Chip
                        size="small"
                        icon={severeOverdue ? <Warning sx={{ fontSize: 14 }} /> : <HourglassTop sx={{ fontSize: 14 }} />}
                        label={severeOverdue ? `ค้างงาน ${daysPastDue} วัน` : `แจ้งเตือน · เลยกำหนด ${daysPastDue} วัน`}
                        sx={{
                          mb: 0.75, fontWeight: 700, fontSize: "0.7rem", height: 24,
                          bgcolor: severeOverdue ? alpha("#ef4444", 0.12) : alpha("#f59e0b", 0.12),
                          color: severeOverdue ? "#ef4444" : "#f59e0b",
                        }}
                      />
                    )}
                    <JobGroupBlock
                      sessions={sessions}
                      currentUserRole={currentUserRole}
                      employee={employee}
                      onStatusUpdate={handleStatusUpdate}
                      onDateUpdate={handleDateUpdate}
                      onDocNoUpdate={handleDocNoUpdate}
                      onInputUpdate={handleInputUpdate}
                      onFileUpload={handleFileUpload}
                      onDeleteFile={(eid, type, fileId) => { setPendingDelete({ id: eid, type, fileId }); setConfirmOpen(true); }}
                      onPreview={handlePreviewFile}
                      onDelete={handleDeleteRow}
                      onApproveClose={handleApproveClose}
                      onRejectClose={handleRejectClose}
                      uploadingState={uploadingState}
                      isUploadingState={isUploadingState}
                      uploadProgressState={uploadProgressState}
                      uploadingFileSizeState={uploadingFileSizeState}
                    />
                  </Box>
                );
              })}

              <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" justifyContent="space-between"
                gap={1.5} sx={{ mt: 2, mb: 1 }}>
                <TextField
                  select size="small" label="ต่อหน้า" value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                  sx={{ width: 110, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                  SelectProps={{ native: true }}>
                  {[5, 10, 20, 50, 100].map(n => <option key={n} value={n}>{n} รายการ</option>)}
                </TextField>
                {/* ✅ เดิม size="small" บนมือถือทำให้ปุ่มเลขหน้าเล็กเกินไป กดยาก/กดพลาด — ใช้ "large"
                    แทนบนมือถือ (ตรงข้ามกับเดิม) ให้ปุ่มโตพอกดง่ายด้วยนิ้ว จอกว้างยังใช้ "medium" เท่าเดิม */}
                <Pagination
                  count={totalPages} page={page}
                  onChange={(_, v) => setPage(v)}
                  color="primary" shape="rounded" size={isMobile ? "large" : "medium"}
                  showFirstButton showLastButton
                  sx={isMobile ? {
                    "& .MuiPaginationItem-root": { minWidth: 40, height: 40, fontSize: "1rem" },
                  } : undefined}
                />
              </Stack>
            </>
          )}
        </>
      )}

      {/* TAB 1: TIMELINE */}

      {/* TAB 2: แผนงานรออนุมัติ (เฉพาะแอดมิน/manager — ดูคอมเมนต์ที่แท็บด้านบน)
          ⚠️ ซ่อนด้วย CSS แทนการ unmount — ตัวเลขบน badge ของแท็บมาจากแผงนี้ ถ้า unmount ทิ้งตอนอยู่แท็บ
          อื่น badge จะกลับเป็น 0 ทันทีที่สลับแท็บ (และต้องโหลดใหม่ทุกครั้งที่กดกลับเข้ามา) — แผงจะดึง
          ข้อมูลรอบแรกให้เสมอ แต่หยุดรีเฟรชอัตโนมัติเมื่อไม่ได้เปิดอยู่ (ดู prop active) */}
      {isAdminOrManager && (
        <Box sx={{ display: activeTab === 1 ? "block" : "none" }}>
          <PendingApprovalsPanel
            active={activeTab === 1}
            onCountChange={setPendingApprovalTabCount}
          />
        </Box>
      )}


      {/* File Preview */}
      <FilePreviewDialog
        previewUrl={previewUrl} previewFileName={previewFileName}
        onClose={() => { setPreviewUrl(null); setPreviewFileName(""); }}
      />

      {/* Confirm Delete File */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>ยืนยันการลบไฟล์</DialogTitle>
        <DialogContent>
          <DialogContentText>ต้องการลบไฟล์นี้หรือไม่? การลบไม่สามารถย้อนกลับได้</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button variant="outlined" onClick={() => setConfirmOpen(false)} sx={{ borderRadius: 2 }}>ยกเลิก</Button>
          <Button variant="contained" color="error" sx={{ borderRadius: 2 }}
            onClick={() => {
              if (pendingDelete) handleDeleteFile(pendingDelete.id, pendingDelete.type, pendingDelete.fileId);
              setConfirmOpen(false);
            }}>
            ลบไฟล์
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={3000}
        onClose={() => setSnackbar(p => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(p => ({ ...p, open: false }))}
          sx={{ borderRadius: 2, fontWeight: 600 }}>
          {snackbar.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Operation;