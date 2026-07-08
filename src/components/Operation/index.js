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
import Swal from "sweetalert2";
import moment from "moment";
import "moment/locale/th";

// MUI Core
import {
  Box, Grid, Paper, Typography, TextField, IconButton, Chip, Avatar,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Button, Stack, Tooltip, Badge, Fade, Collapse, LinearProgress,
  Tabs, Tab, Divider, useMediaQuery, useTheme, InputAdornment,
  Menu, MenuItem, ListItemIcon, ListItemText, Card, CardContent,
  Skeleton, Alert, Snackbar, ToggleButton, ToggleButtonGroup,
  List, ListItem, Pagination,
} from "@mui/material";

// MUI Icons
import {
  Search, FilterList, Clear, Dashboard, Timeline, TableChart,
  Upload, Download, Delete, Visibility, Close, CheckCircle,
  PendingActions, Build, Assignment, Notifications, MoreVert,
  CalendarMonth, Group, Warning, TrendingUp, Description,
  CloudUpload, InsertDriveFile, Image, PictureAsPdf, Article,
  Refresh, ArrowUpward, ArrowDownward, Circle, ExpandMore,
  ExpandLess, FolderOpen, AttachFile, Login, Logout, Edit,
  NoteAdd, History, Person, AccessTime, FiberManualRecord,
  TaskAlt, HourglassTop, Cancel,
  Send, Chat, Link as LinkIcon,
  Print, Share,
} from "@mui/icons-material";

// MUI Date Picker
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterMoment } from "@mui/x-date-pickers/AdapterMoment";

// Router
import { useParams, useNavigate } from "react-router-dom";

// Styled
import { styled, alpha } from "@mui/material/styles";

import TechnicianJobCard from "../Technician/TechnicianJobPanel";
import useEventNotifications from "../../hooks/useEventNotifications";
import NotificationBell from "../Notifications/NotificationBell";
import LineIcon from "../icons/LineIcon";
import { printFile, shareFile, shareToLine, isMobileDevice } from "../../functions/fileActions";

// ✅ ใช้ตัดสินใจลำดับปุ่มแชร์ในเมนู "⋮" ต่อไฟล์ (ดูเหตุผลใน fileActions.js)
const IS_MOBILE = isMobileDevice();

// ✅ เดิม MUI Menu เปิดช้า/รู้สึกหน่วง เพราะ transition คำนวณตามความสูงเมนู (auto) และมีการ
// ล็อกสกรอลของหน้า (เพิ่ม padding ชดเชย scrollbar) ทุกครั้งที่เปิด ทำให้เกิด reflow เห็นได้ชัด
// บนมือถือ — ลด duration ลงคงที่ + ปิด scroll lock ให้ลื่นขึ้นทุกเมนูในหน้านี้
const FAST_MENU_PROPS = {
  transitionDuration: { enter: 120, exit: 80 },
  disableScrollLock: true,
};

// ─── Styled Components ────────────────────────────────────────────────
const GlassCard = styled(Card)(({ theme }) => ({
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

const StatCard = styled(GlassCard)(({ color }) => ({
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
const TYPE_LIST    = ["PM", "Service", "Inspection", "ตรวจเช็คปัญหา", "สำรวจระบบ"];
const SYSTEM_LIST  = ["Fire Alarm", "CCTV", "Fire Pump"];
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
const ClosureRequestsPanel = ({ events, onApprove, onReject }) => {
  const [expanded,     setExpanded]     = useState(true);
  const [busyId,       setBusyId]       = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const pending = useMemo(
    () => events
      .filter(e => e.closeRequested)
      .sort((a, b) => new Date(b.closeRequestedAt || 0) - new Date(a.closeRequestedAt || 0)),
    [events]
  );

  const handleApprove = async (id) => {
    setBusyId(id);
    await onApprove(id);
    setBusyId(null);
  };

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
            <PulseDot color={pending.length > 0 ? "#f59e0b" : "#6b7280"} />
            <Typography variant="subtitle2" fontWeight={700}>
              งานที่ช่างขอปิด · รอตรวจสอบ
            </Typography>
            <Chip
              label={`${pending.length} งาน`}
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
          {pending.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 3, color: "text.disabled" }}>
              <TaskAlt sx={{ fontSize: 36, opacity: 0.25, mb: 0.5 }} />
              <Typography variant="body2">ยังไม่มีคำขอปิดงานที่รอตรวจสอบ</Typography>
            </Box>
          ) : (
            <Stack spacing={1.5}>
              {pending.map(ev => (
                <Box key={ev._id} sx={{
                  p: 1.5, borderRadius: 2, border: "1px solid",
                  borderColor: alpha("#f59e0b", 0.25), background: alpha("#f59e0b", 0.03),
                }}>
                  <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "flex-start" }} gap={1.5}>
                    <Stack direction="row" alignItems="flex-start" gap={1.5} flex={1} minWidth={0}>
                      <HourglassTop sx={{ fontSize: 18, color: "#f59e0b", mt: 0.3, flexShrink: 0 }} />
                      <Box flex={1} minWidth={0}>
                        <Typography fontWeight={700} fontSize="0.875rem" noWrap>
                          {companySite(ev.company, ev.site)}
                        </Typography>
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
                    <Stack direction="row" gap={0.75} flexShrink={0} sx={{ width: { xs: "100%", sm: "auto" } }}>
                      <Button size="small" color="warning" variant="contained"
                        startIcon={<TaskAlt sx={{ fontSize: 15 }} />}
                        disabled={busyId === ev._id}
                        onClick={() => handleApprove(ev._id)}
                        sx={{ flex: { xs: 1, sm: "initial" }, borderRadius: 2, textTransform: "none", fontWeight: 700 }}>
                        อนุมัติ
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
              ))}
            </Stack>
          )}
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

// ─── DashboardStats ───────────────────────────────────────────────────
const DashboardStats = ({ events }) => {
  const stats = useMemo(() => {
    const total    = events.length;
    const byStatus = OP_LIST.reduce((acc, s) => { acc[s] = events.filter(e => e.status === s).length; return acc; }, {});
    const thisMonth = events.filter(e => moment(e.start).format("YYYY-MM") === moment().format("YYYY-MM")).length;
    // ✅ อิงจากฟีเจอร์ "ขอปิดงาน" ที่ใช้งานจริงตอนนี้ (แทนสถานะวางบิล/เก็บเงินแบบเก่าที่ไม่มีช่องให้กรอกแล้ว)
    const pendingClose = events.filter(e => e.closeRequested && e.status !== "ดำเนินการเสร็จสิ้น").length;
    return { total, byStatus, thisMonth, pendingClose };
  }, [events]);

  const cards = [
    { label: "งานทั้งหมด",     value: stats.total, color: "linear-gradient(135deg,#667eea,#764ba2)", icon: <TableChart />,
      sub: `เดือนนี้ ${stats.thisMonth} งาน` },
    { label: "กำลังดำเนินการ", value: stats.byStatus["กำลังดำเนินการ"], color: "linear-gradient(135deg,#8b5cf6,#6d28d9)", icon: <PendingActions />,
      sub: `ยืนยันแล้ว ${stats.byStatus["ยืนยันแล้ว"]} · รอยืนยัน ${stats.byStatus["กำลังรอยืนยัน"]} งาน` },
    { label: "เสร็จสิ้น",      value: stats.byStatus["ดำเนินการเสร็จสิ้น"], color: "linear-gradient(135deg,#10b981,#059669)", icon: <CheckCircle />,
      sub: `คิดเป็น ${stats.total ? Math.round((stats.byStatus["ดำเนินการเสร็จสิ้น"] / stats.total) * 100) : 0}% ของงานทั้งหมด` },
    { label: "คำขออนุมัติปิดงาน", value: stats.pendingClose, color: "linear-gradient(135deg,#f59e0b,#d97706)", icon: <TaskAlt />,
      sub: stats.pendingClose > 0 ? "ช่างขอปิดงาน รอตรวจสอบ" : "ไม่มีงานรออนุมัติ" },
  ];

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      {cards.map(c => (
        <Grid item xs={6} md={3} key={c.label}>
          <StatCard color={c.color}>
            <CardContent sx={{ p: 2.5 }}>
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                <Box minWidth={0}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} letterSpacing={0.5}
                    sx={{ textTransform: "uppercase", fontSize: "0.7rem", display: "block" }}>
                    {c.label}
                  </Typography>
                  <Typography variant="h4" fontWeight={800} sx={{ my: 0.5, lineHeight: 1 }}>{c.value}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{c.sub}</Typography>
                </Box>
                <Box sx={{ p: 1, borderRadius: 2, background: c.color, color: "#fff", display: "flex", flexShrink: 0 }}>
                  {c.icon}
                </Box>
              </Stack>
            </CardContent>
          </StatCard>
        </Grid>
      ))}
    </Grid>
  );
};

// ─── TechnicianSummary v2 (เพิ่ม workNote รายงาน) ─────────────────────
const TechnicianSummary = ({ events, selectedDate }) => {
  const [selectedTech, setSelectedTech] = useState(null);

  const techStats = useMemo(() => {
    const map = {};
    events.forEach(ev => {
      (ev.activityLog || []).forEach(log => {
        if (!log.userName) return;
        if (!map[log.userName]) {
          map[log.userName] = {
            name: log.userName,
            notes: 0, filesUploaded: 0, closeRequests: 0,
            jobs: new Set(),
            jobDetails: [],
          };
        }
        const m = map[log.userName];
        // ✅ อ้างอิงตาม action ที่ใช้งานจริงตอนนี้ (ระบบเช็คอิน/เช็คเอาท์เดิมถูกตัดออกไปแล้ว)
        if (log.action === "note_saved")      m.notes++;
        if (log.action === "file_uploaded")   m.filesUploaded++;
        if (log.action === "close_requested") m.closeRequests++;
        m.jobs.add(ev._id);
      });
      // เก็บ job details สำหรับ drill-down
      (ev.activityLog || []).forEach(log => {
        if (log.userName && !map[log.userName]?.jobDetails.find(j => j._id === ev._id)) {
          if (map[log.userName]) {
            map[log.userName].jobDetails.push({
              _id:          ev._id,
              company:      ev.company,
              site:         ev.site,
              title:        ev.title,
              checkedInAt:  ev.checkedInAt,
              checkedOutAt: ev.checkedOutAt,
              workNote:     ev.workNote,
              status:       ev.status,
              activityLog:  ev.activityLog,
            });
          }
        }
      });
    });
    return Object.values(map).map(m => ({ ...m, jobCount: m.jobs.size }));
  }, [events]);

  if (techStats.length === 0) {
    return (
      <GlassCard sx={{ mb: 3 }}>
        <CardContent sx={{ p: 2.5, textAlign: "center" }}>
          <Person sx={{ fontSize: 40, opacity: 0.2 }} />
          <Typography color="text.disabled" variant="body2">ยังไม่มีข้อมูลการทำงานของช่าง</Typography>
        </CardContent>
      </GlassCard>
    );
  }

  return (
    <GlassCard sx={{ mb: 3 }}>
      <CardContent sx={{ p: 2.5 }}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom color="text.secondary">
          สรุปรายช่าง
          {selectedDate && ` · ${moment(selectedDate).locale("th").format("MMMM YYYY")}`}
        </Typography>
        <Stack spacing={1.5}>
          {techStats.map(t => (
            <Box key={t.name}>
              <Box
                onClick={() => setSelectedTech(selectedTech === t.name ? null : t.name)}
                sx={{
                  p: 1.5, borderRadius: 2, border: "1px solid", borderColor: "divider",
                  background: theme => alpha(theme.palette.background.paper, 0.6),
                  cursor: "pointer",
                  "&:hover": { borderColor: "primary.main" },
                }}>
                <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap">
                  <Avatar sx={{
                    width: 34, height: 34, fontSize: "0.8rem", fontWeight: 700,
                    bgcolor: theme => alpha(theme.palette.primary.main, 0.12),
                    color: "primary.main",
                  }}>
                    {t.name.charAt(0)}
                  </Avatar>
                  <Typography fontWeight={700} fontSize="0.875rem" flex={1}>{t.name}</Typography>
                  <Stack direction="row" gap={0.75} flexWrap="wrap">
                    <Chip size="small" label={`${t.jobCount} งาน`} sx={{ height: 22, fontSize: "0.68rem" }} />
                    <Chip size="small" icon={<CloudUpload sx={{ fontSize: "13px !important" }} />}
                      label={`${t.filesUploaded} ไฟล์`}
                      sx={{ height: 22, fontSize: "0.68rem", bgcolor: alpha("#8b5cf6", 0.1), color: "#8b5cf6" }} />
                    <Chip size="small" icon={<NoteAdd sx={{ fontSize: "13px !important" }} />}
                      label={`${t.notes} สรุปงาน`}
                      sx={{ height: 22, fontSize: "0.68rem", bgcolor: alpha("#3b82f6", 0.1), color: "#3b82f6" }} />
                    {t.closeRequests > 0 && (
                      <Chip size="small" icon={<TaskAlt sx={{ fontSize: "13px !important" }} />}
                        label={`${t.closeRequests} ขอปิดงาน`}
                        sx={{ height: 22, fontSize: "0.68rem", bgcolor: alpha("#10b981", 0.1), color: "#10b981" }} />
                    )}
                  </Stack>
                  {selectedTech === t.name ? <ExpandLess sx={{ fontSize: 18, color: "text.secondary" }} /> : <ExpandMore sx={{ fontSize: 18, color: "text.secondary" }} />}
                </Stack>
              </Box>

              {/* Drill-down: jobDetails */}
              <Collapse in={selectedTech === t.name}>
                <Stack spacing={1} sx={{ mt: 1, pl: 2 }}>
                  {t.jobDetails.map(job => {
                    const dur = job.checkedInAt && job.checkedOutAt
                      ? moment.duration(moment(job.checkedOutAt).diff(moment(job.checkedInAt))).humanize()
                      : null;
                    return (
                      <Box key={job._id} sx={{
                        p: 1.25, borderRadius: 2, border: "1px solid",
                        borderColor: alpha(OP_COLOR[job.status] || "#6b7280", 0.2),
                        background: alpha(OP_COLOR[job.status] || "#6b7280", 0.03),
                      }}>
                        <Stack direction="row" alignItems="flex-start" gap={1}>
                          <Box sx={{
                            width: 6, height: 6, borderRadius: "50%", flexShrink: 0, mt: 0.8,
                            bgcolor: OP_COLOR[job.status] || "#6b7280",
                          }} />
                          <Box flex={1} minWidth={0}>
                            <Typography fontWeight={700} fontSize="0.8rem">
                              {companySite(job.company, job.site)}
                            </Typography>
                            <Stack direction="row" gap={1.5} mt={0.25} flexWrap="wrap">
                              {job.checkedInAt && (
                                <Typography variant="caption" color="#8b5cf6">
                                  <Login sx={{ fontSize: 11 }} /> {moment(job.checkedInAt).format("HH:mm")}
                                </Typography>
                              )}
                              {job.checkedOutAt && (
                                <Typography variant="caption" color="#10b981">
                                  <Logout sx={{ fontSize: 11 }} /> {moment(job.checkedOutAt).format("HH:mm")}
                                </Typography>
                              )}
                              {dur && <Typography variant="caption" color="text.disabled">· {dur}</Typography>}
                            </Stack>
                            {job.workNote && (
                              <Typography variant="caption" color="text.secondary"
                                sx={{ display: "block", mt: 0.5, fontStyle: "italic" }}>
                                "{job.workNote.slice(0, 120)}{job.workNote.length > 120 ? "…" : ""}"
                              </Typography>
                            )}
                          </Box>
                          <Chip
                            label={job.status || "—"}
                            size="small"
                            sx={{
                              height: 20, fontSize: "0.65rem", flexShrink: 0,
                              bgcolor: alpha(OP_COLOR[job.status] || "#6b7280", 0.12),
                              color: OP_COLOR[job.status] || "#6b7280",
                            }}
                          />
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              </Collapse>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </GlassCard>
  );
};

// ─── StatusProgressBar ────────────────────────────────────────────────
const StatusProgressBar = ({ events }) => {
  const total = events.length || 1;
  return (
    <GlassCard sx={{ mb: 3 }}>
      <CardContent sx={{ p: 2.5 }}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom color="text.secondary">
          ภาพรวมสถานะงาน
        </Typography>
        <Stack spacing={1.5}>
          {OP_LIST.map(status => {
            const count = events.filter(e => e.status === status).length;
            const pct   = Math.round((count / total) * 100);
            return (
              <Box key={status}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                  <Stack direction="row" alignItems="center" gap={1}>
                    <Circle sx={{ fontSize: 8, color: OP_COLOR[status] }} />
                    <Typography variant="caption" fontWeight={600}>{status}</Typography>
                  </Stack>
                  <Typography variant="caption" fontWeight={700} color={OP_COLOR[status]}>
                    {count} ({pct}%)
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate" value={pct}
                  sx={{
                    height: 6, borderRadius: 3,
                    bgcolor: alpha(OP_COLOR[status], 0.12),
                    "& .MuiLinearProgress-bar": { bgcolor: OP_COLOR[status], borderRadius: 3 },
                  }}
                />
              </Box>
            );
          })}
        </Stack>
      </CardContent>
    </GlassCard>
  );
};

// ─── TimelineView ─────────────────────────────────────────────────────
const TimelineView = ({ events }) => {
  const grouped = useMemo(() => {
    const map = {};
    events.forEach(e => {
      const key = moment(e.start).format("YYYY-MM");
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [events]);

  return (
    <Box>
      {grouped.length === 0 && (
        <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
          <Timeline sx={{ fontSize: 48, opacity: 0.3 }} />
          <Typography>ไม่มีข้อมูล</Typography>
        </Box>
      )}
      {grouped.map(([month, items]) => (
        <Box key={month} sx={{ mb: 4 }}>
          <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 2 }}>
            <CalendarMonth sx={{ color: "primary.main", fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight={700}>
              {moment(month).locale("th").format("MMMM YYYY")}
            </Typography>
            <Chip label={items.length} size="small" color="primary" sx={{ height: 20, fontSize: "0.7rem" }} />
          </Stack>
          <Stack spacing={1.5} sx={{ pl: 4, borderLeft: "2px solid", borderColor: "divider" }}>
            {items.map(event => (
              <Box key={event._id} sx={{ position: "relative" }}>
                <Box sx={{
                  position: "absolute", left: -21, top: 12,
                  width: 8, height: 8, borderRadius: "50%",
                  bgcolor: OP_COLOR[event.status] || "#6b7280",
                  border: "2px solid #fff",
                  boxShadow: "0 0 0 2px " + (OP_COLOR[event.status] || "#6b7280"),
                }} />
                <GlassCard sx={{ "&:hover": { transform: "none" } }}>
                  <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between"
                      alignItems={{ sm: "center" }} gap={1}>
                      <Box>
                        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                          <StatusBadge color={OP_COLOR[event.status]}>
                            <Circle sx={{ fontSize: 6 }} /> {event.status || "ไม่ระบุ"}
                          </StatusBadge>
                          <Chip icon={TYPE_ICON[event.title]} label={event.title} size="small" variant="outlined" sx={{ fontSize: "0.7rem", height: 22 }} />
                          {event.system && <Chip label={event.system} size="small" variant="outlined" color="secondary" sx={{ fontSize: "0.7rem", height: 22 }} />}
                        </Stack>
                        <Typography fontWeight={700} sx={{ mt: 0.8 }}>
                          {companySite(event.company, event.site)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {moment(event.start).locale("th").format("DD MMM YYYY HH:mm")}
                          {event.docNo && ` · ${event.docNo}`}
                        </Typography>
                        {/* เวลาเข้า/ออกใน timeline */}
                        {(event.checkedInAt || event.checkedOutAt) && (
                          <Stack direction="row" gap={1} mt={0.5}>
                            {event.checkedInAt && (
                              <Typography variant="caption" color="#8b5cf6">
                                <Login sx={{ fontSize: 11 }} /> {moment(event.checkedInAt).format("HH:mm")}
                              </Typography>
                            )}
                            {event.checkedOutAt && (
                              <Typography variant="caption" color="#10b981">
                                <Logout sx={{ fontSize: 11 }} /> {moment(event.checkedOutAt).format("HH:mm")}
                              </Typography>
                            )}
                          </Stack>
                        )}
                      </Box>
                    </Stack>
                  </CardContent>
                </GlassCard>
              </Box>
            ))}
          </Stack>
        </Box>
      ))}
    </Box>
  );
};

// ─── FileUploadSection ────────────────────────────────────────────────
// เอกสารแต่ละชนิดแนบได้หลายไฟล์ (files คือ array) — เพิ่ม/ลบทีละไฟล์ได้อิสระ
const FileUploadSection = ({
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

  const fileList = files || [];
  const hasFiles = fileList.length > 0;

  const handleDrop = e => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) onUpload(e.dataTransfer.files, eventId, type);
  };

  // ช่างระบุไว้แล้วว่างานนี้ "ไม่มี" เอกสารชนิดนี้ (ใบเสนอราคา/ใบวางบิล/ใบส่งมอบงาน)
  const notApplicable = applicable === false && !hasFiles;

  return (
    <Box>
      <Typography variant="caption" fontWeight={700} color="text.secondary"
        sx={{ textTransform: "uppercase", letterSpacing: 0.5, mb: 1, display: "block" }}>
        {label} {hasFiles && `(${fileList.length})`}
      </Typography>

      {hasFiles && (
        <Stack spacing={0.75} sx={{ mb: uploading || canEdit ? 1 : 0 }}>
          {fileList.map(f => (
            <Stack key={f._id || f.fileUrl} direction="row" alignItems="center" gap={0.5} sx={{
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
                <IconButton onClick={e => setFileMenu({ el: e.currentTarget, file: f })} sx={{ p: 1 }}>
                  <MoreVert sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            </Stack>
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
  event, employee, onStatusUpdate, onDocNoUpdate, onInputUpdate,
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
  const [approving,  setApproving]  = useState(false);
  const [rejecting,      setRejecting]      = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason,   setRejectReason]   = useState("");
  // ✅ เอกสารของงานกลุ่มเดียวกันปกติซ่อนไว้ (ใช้ร่วมกันที่การ์ดหลัก) แต่แอดมิน/manager
  // ยังต้องแนบ/แก้ไฟล์แยกเฉพาะวันนี้ได้เหมือนเดิมถ้าจำเป็น จึงเปิดให้กดดูเพิ่มเติมได้เสมอ
  const [showDocsOverride, setShowDocsOverride] = useState(false);
  const theme  = useTheme();
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

  const handleApprove = async () => {
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

  const Wrapper = noOuterCard ? React.Fragment : GlassCard;
  const wrapperProps = noOuterCard
    ? {}
    : { sx: { mb: 1.5, "&:hover": { transform: "none", boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.08)}` } } };

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
            <Avatar sx={{
              width: 40, height: 40, flexShrink: 0, fontSize: "0.8rem", fontWeight: 700,
              background: OP_COLOR[localStatus] ? alpha(OP_COLOR[localStatus], 0.15) : alpha(theme.palette.grey[500], 0.15),
              color: OP_COLOR[localStatus] || theme.palette.text.secondary,
            }}>
              {TYPE_ICON[event.title] || <Build />}
            </Avatar>
            <Box minWidth={0} flex={1}>
              <Stack direction="row" flexWrap="wrap" alignItems="center" gap={0.5} mb={0.5}>
                <Tooltip title="เปลี่ยนสถานะ">
                  <Box onClick={e => { e.stopPropagation(); canEdit && setAnchorEl(e.currentTarget); }} sx={{ cursor: canEdit ? "pointer" : "default" }}>
                    <StatusBadge color={OP_COLOR[localStatus]}>
                      <Circle sx={{ fontSize: 6 }} /> {localStatus || "ไม่ระบุ"}
                    </StatusBadge>
                  </Box>
                </Tooltip>
                {event.title  && <Chip label={event.title}  size="small" variant="outlined" sx={{ fontSize: "0.7rem", height: 22, maxWidth: 130 }} />}
                {event.system && <Chip label={event.system} size="small" variant="outlined" color="secondary" sx={{ fontSize: "0.7rem", height: 22, maxWidth: 130 }} />}
                {event.team   && <Chip icon={<Group sx={{ fontSize: "14px !important" }} />} label={event.team} size="small" variant="outlined" sx={{ fontSize: "0.7rem", height: 22, maxWidth: 150 }} />}
                {/* ✅ ย้ายไอคอนเอกสาร/กิจกรรมมาไว้แถวเดียวกับ chip (wrap ได้ตามธรรมชาติ)
                    แทนที่จะปักไว้คงที่ทางขวาสุดของแถวหัวข้อ ซึ่งไปแย่งพื้นที่ปีบให้ชื่องาน/ทีมถูกตัดคำบนจอมือถือ */}
                <Stack direction="row" alignItems="center" gap={0.6} sx={{ ml: "auto", flexShrink: 0 }}>
                  {event.reportFiles?.length > 0     && <Tooltip title={`Service Report: ${event.reportFiles.length} ไฟล์`}><Description sx={{ fontSize: 17, color: "#3b82f6", opacity: 0.8 }} /></Tooltip>}
                  {event.quotationFiles?.length > 0  && <Tooltip title={`ใบเสนอราคา: ${event.quotationFiles.length} ไฟล์`}><Description sx={{ fontSize: 17, color: "#ef4444", opacity: 0.8 }} /></Tooltip>}
                  {event.invoiceFiles?.length > 0    && <Tooltip title={`ใบวางบิล: ${event.invoiceFiles.length} ไฟล์`}><Description sx={{ fontSize: 17, color: "#f59e0b", opacity: 0.8 }} /></Tooltip>}
                  {event.completionFiles?.length > 0 && <Tooltip title={`ใบส่งมอบงาน: ${event.completionFiles.length} ไฟล์`}><Description sx={{ fontSize: 17, color: "#07941a", opacity: 0.8 }} /></Tooltip>}
                  {event.activityLog?.length > 0 && (
                    <Tooltip title={`${event.activityLog.length} กิจกรรม`}>
                      <History sx={{ fontSize: 17, color: "#f59e0b", opacity: 0.8 }} />
                    </Tooltip>
                  )}
                  {event.comments?.length > 0 && (
                    <Tooltip title={`${event.comments.length} ข้อความ`}>
                      <Chat sx={{ fontSize: 17, color: "#3b82f6", opacity: 0.8 }} />
                    </Tooltip>
                  )}
                  {event.jobGroupId && (
                    <Tooltip title="งานนี้เป็นส่วนหนึ่งของงานหลายวัน (กลุ่มเดียวกัน)">
                      <LinkIcon sx={{ fontSize: 17, color: "#8b5cf6", opacity: 0.8 }} />
                    </Tooltip>
                  )}
                </Stack>
              </Stack>
              <Typography fontWeight={700} fontSize="0.95rem" noWrap>
                {companySite(event.company, event.site)}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1} mt={0.3}>
                <Typography variant="caption" color="text.secondary">
                  📅 {moment(event.start).locale("th").format("DD MMM YYYY")}
                  {/* ✅ event.end ของงานแบบ allDay ถูกบวกไป 1 วันตอนบันทึก (ค่า end แบบ exclusive ของ FullCalendar)
                      ต้องลบ 1 วันคืนตอนแสดงผล ไม่งั้นวันที่ที่โชว์ในหน้า operation จะเพี้ยนไม่ตรงกับหน้า event
                      และแสดงแค่วันที่ ไม่รวมเวลา เพราะเวลาจริงที่ผู้ใช้กรอกอยู่ใน startTime/endTime แยกต่างหาก */}
                  {event.end && ` — ${moment(event.end).subtract(event.allDay ? 1 : 0, "days").locale("th").format("DD MMM YYYY")}`}
                </Typography>
                {(event.startTime || event.endTime) && (
                  <Typography variant="caption" color="text.secondary">
                    🕐 {event.startTime || "-"} — {event.endTime || "-"}
                  </Typography>
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
                    <Typography variant="caption"
                      color={event.docNo ? "text.secondary" : "text.disabled"}
                      onClick={e => { e.stopPropagation(); canEdit && setEditingDoc(true); }}
                      sx={{ cursor: canEdit ? "pointer" : "default", "&:hover": canEdit ? { color: "primary.main", textDecoration: "underline" } : {} }}>
                      📄 {event.docNo || "ใส่เลขที่เอกสาร"}
                    </Typography>
                  )
                )}
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
          <Stack direction="row" gap={0.5} flexShrink={0}>
            {/* ✅ ไม่มี onClick ของตัวเองแล้ว — แค่ไอคอนบอกสถานะกาง/พับ ตัวกดจริงคือทั้งแถว Header
                ด้านบน (คลิกบับเบิลขึ้นมาถึงเอง) กันปัญหาเดิมที่กดซ้อนกับ handler บนแล้วพับคืนทันที */}
            <IconButton sx={{ p: 1, pointerEvents: "none" }}>
              {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
            </IconButton>
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
            เพราะ Alert วางข้อความ+ปุ่มแถวเดียวกันแล้วทับ/ล้นกันบนจอมือถือ */}
        {event.closeRequested && localStatus !== "ดำเนินการเสร็จสิ้น" && (
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

        {/* ประวัติการไม่อนุมัติล่าสุด (ถ้ายังไม่มีการขอปิดงานใหม่เข้ามา) */}
        {!event.closeRequested && event.closeRejectReason && localStatus !== "ดำเนินการเสร็จสิ้น" && (
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
          {OP_LIST.map(s => (
            <MenuItem key={s} onClick={() => handleStatusChange(s)} selected={localStatus === s}
              sx={{ gap: 1.5, py: 1.25, minHeight: 44 }}>
              <Circle sx={{ fontSize: 8, color: OP_COLOR[s] }} />
              <Typography variant="body2" fontWeight={localStatus === s ? 700 : 400}>{s}</Typography>
            </MenuItem>
          ))}
        </Menu>

        {/* Expanded */}
        <Collapse in={expanded}>
          <Divider sx={{ my: 2 }} />
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
              <Grid item xs={12} sm={6}>
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
            <Grid item xs={12} sm={6}>
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
             <Grid item xs={12} sm={6}>
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
             <Grid item xs={12} sm={6}>
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

            {/* <Grid item xs={12}>
              <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
                <Typography variant="caption" fontWeight={700} color="text.secondary">การเงิน:</Typography>
                {STATUS_BILLING.map(s => (
                  <Chip key={s} label={s} size="small"
                    clickable={canEdit}
                    variant={[event.status_two, event.status_three].includes(s) ? "filled" : "outlined"}
                    color={s === "เก็บเงินแล้ว" ? "success" : "warning"}
                    onClick={() => canEdit && onInputUpdate(event._id, { status_two: s, status_three: s })}
                    sx={{ fontSize: "0.72rem" }}
                  />
                ))}
              </Stack>
            </Grid> */}

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
        </Collapse>
      </CardContent>
    </Wrapper>
  );
};

// ─── FilterPanel ──────────────────────────────────────────────────────
const FilterPanel = ({
  search, onSearch, filterType, onFilterType, filterSystem, onFilterSystem,
  filterStatus, onFilterStatus, filterOP, onFilterOP, filterTeam, onFilterTeam,
  showAll, onToggleShowAll, selectedDate, onDateChange, onClearAll, activeCount,
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
                {TYPE_LIST.map(t => (
                  <FilterChip key={t} label={t} size="small"
                    active={filterType === t ? 1 : 0}
                    icon={TYPE_ICON[t]}
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
                {SYSTEM_LIST.map(s => (
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
const FilePreviewDialog = ({ previewUrl, previewFileName, onClose }) => {
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
        {type === "image" && <img src={previewUrl} alt={previewFileName} style={{ maxWidth: "100%", maxHeight: 780, display: "block", margin: "0 auto", padding: 16 }} />}
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
  return (
    <GlassCard sx={{ mb: 2, border: "1px solid", borderColor: alpha("#8b5cf6", 0.3) }}>
      <Box
        onClick={() => setExpanded(p => !p)}
        sx={{
          p: 2, cursor: "pointer", background: alpha("#8b5cf6", 0.04),
          borderBottom: expanded ? "1px solid" : "none", borderColor: alpha("#8b5cf6", 0.2),
        }}>
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <CalendarMonth sx={{ fontSize: 18, color: "#8b5cf6" }} />
          <Typography variant="body2" fontWeight={700} color="#8b5cf6">
            {companySite(head.company, head.site)} — {head.title}{head.system && ` · ${head.system}`}{head.time && ` ครั้งที่ ${head.time}`}
          </Typography>
          <Chip label={`เข้างาน ${totalWorkDays} วัน`} size="small"
            sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700, bgcolor: alpha("#8b5cf6", 0.15), color: "#8b5cf6" }} />
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
                borderColor: alpha("#8b5cf6", 0.35),
                bgcolor: s._id === anchorId ? alpha("#8b5cf6", 0.2) : "transparent",
                color: "#8b5cf6", fontWeight: s._id === anchorId ? 700 : 400,
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
  const theme    = useTheme();
  const isMobile = useMediaQuery("(max-width:600px)");

  const [events,       setEvents]       = useState([]);
  const [employee,     setEmployee]     = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [activeTab,    setActiveTab]    = useState(0);
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

  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [previewUrl,       setPreviewUrl]        = useState(null);
  const [previewFileName,  setPreviewFileName]   = useState("");
  const [confirmOpen,      setConfirmOpen]        = useState(false);
  const [pendingDelete,    setPendingDelete]      = useState(null);
  const [snackbar,         setSnackbar]           = useState({ open: false, msg: "", severity: "success" });
  const [currentUserRole,  setCurrentUserRole]    = useState("");

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

  const dateSearch = !showAll ? selectedDate : "";

  // ✅ อ้างอิงจาก events (state ที่อัปเดตสดทุกครั้งที่แก้ไข) แทนการเก็บ snapshot แยก
  // เพื่อไม่ให้หน้า /operation/:id ค้างข้อมูลเก่าจนกว่าจะรีเฟรชหน้า
  const selectedEvent = useMemo(
    () => (id ? events.find(e => e._id === id) || null : null),
    [id, events]
  );

  const filteredEvents = useMemo(() => {
  if (id && selectedEvent) return [selectedEvent];
  return events.filter(event => {
    const matchMonth  = dateSearch ? moment(event.start).format("YYYY-MM") === dateSearch : true;
    const matchType   = filterType   ? event.title  === filterType   : true;
    const matchSystem = filterSystem ? event.system === filterSystem  : true;
    const matchTeam   = filterTeam   ? event.team   === filterTeam   : true;
    const matchStatus = filterStatus ? [event.status_two, event.status_three].includes(filterStatus) : true;
    const matchOP     = filterOP     ? event.status === filterOP     : true;

    // ✅ เบื้องต้น: ตัดงานสถานะ "กำลังรอยืนยัน" ออกทั้งหมดfilteredEvents
    // (ยกเว้นผู้ใช้ตั้งใจกรองสถานะนี้เองโดยเฉพาะ)
    const matchNotPending = filterOP === "กำลังรอยืนยัน" ? true : event.status !== "กำลังรอยืนยัน";

    // ✅ แยกกลุ่มงานให้ชัดเจนเป็น 3 กลุ่มเดียวกันทั้งฝั่งช่างและแอดมิน/manager
    // (รอคุณ/ผู้ดูแลอนุมัติ / กำลังดำเนินการ-ยืนยันแล้ว / เสร็จสิ้น) — ถ้าผู้ใช้เลือกสถานะเจาะจงไว้แล้ว
    // (filterOP) ให้ยึดตามนั้นแทน ไม่ต้องกรองซ้ำด้วย toggle นี้ (กันผลลัพธ์ขัดกันจนว่างเปล่า)
    // ค่า default ต่างกันตาม role: แอดมิน/manager เปิดที่ "รอคุณอนุมัติ" ก่อน (งานด่วนที่ต้องรีวิว)
    // ส่วนช่างเปิดที่ "กำลังดำเนินการ/ยืนยันแล้ว" ก่อน (งานที่ต้องลงมือทำจริง)
    let matchGroup;
    if (filterOP) {
      matchGroup = true;
    } else {
      const isAdminOrManagerRole = ["admin", "manager"].includes(currentUserRole);
      const group = statusGroup || (isAdminOrManagerRole ? "pending" : "active");
      if (group === "pending")      matchGroup = event.closeRequested === true && event.status !== "ดำเนินการเสร็จสิ้น";
      else if (group === "active")  matchGroup = ["ยืนยันแล้ว", "กำลังดำเนินการ"].includes(event.status) && !event.closeRequested;
      else                          matchGroup = event.status === "ดำเนินการเสร็จสิ้น"; // "closed"
    }

    const keyword = search.toLowerCase();
    const matchSearch = keyword
      ? [event.company, event.site, event.title, event.system, event.team, event.docNo,
         moment(event.start).format("DD/MM/YYYY HH:mm")]
          .map(v => (v || "").toLowerCase()).some(t => t.includes(keyword))
      : true;

    return matchMonth && matchType && matchSystem && matchStatus && matchOP && matchTeam && matchSearch && matchNotPending && matchGroup;
  });
}, [id, selectedEvent, events, dateSearch, filterType, filterSystem, filterStatus, filterOP, filterTeam, search, statusGroup, currentUserRole]);

  const sortedEvents      = useMemo(() => filteredEvents.slice().sort((a, b) => new Date(b.start) - new Date(a.start)), [filteredEvents]);
  const activeFilterCount = [filterType, filterSystem, filterStatus, filterOP, search.trim(), filterTeam].filter(Boolean).length;

  // นับจำนวนงานแต่ละกลุ่มไว้โชว์บน toggle — อ้างอิงจาก events ทั้งหมด ไม่ผ่านตัวกรองอื่น
  const closedCount   = useMemo(() => events.filter(e => e.status === "ดำเนินการเสร็จสิ้น").length, [events]);
  const pendingCount  = useMemo(() => events.filter(e => e.closeRequested === true && e.status !== "ดำเนินการเสร็จสิ้น").length, [events]);
  const inProgressCount  = useMemo(() => events.filter(e => ["ยืนยันแล้ว", "กำลังดำเนินการ"].includes(e.status) && !e.closeRequested).length, [events]);

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
    } catch (err) { console.error(err); }
  }, [getGroupEventIds]);

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

      const updates = {
        closeRequested: false,
        closeRejectedAt: now,
        closeRejectedBy: adminName,
        closeRejectReason: reason || "",
        activityLog: [...(target?.activityLog || []), newLog],
      };

      await EventService.UpdateEvent(id, updates);
      setEvents(prev => prev.map(e => e._id === id ? { ...e, ...updates } : e));
      setSnackbar({ open: true, msg: "ไม่อนุมัติคำขอปิดงานแล้ว", severity: "success" });
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, msg: "ดำเนินการไม่สำเร็จ", severity: "error" });
    }
  }, [events]);

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

  const handleDeleteFile = useCallback(async (eventId, type, fileId) => {
    try {
      await EventService.DeleteFile(eventId, type, fileId);
      setSnackbar({ open: true, msg: "ลบไฟล์เรียบร้อย", severity: "success" });
      await fetchEventsFromDB(true);
    } catch {
      setSnackbar({ open: true, msg: "ลบไฟล์ไม่สำเร็จ", severity: "error" });
    }
  }, []);

  // ✅ รองรับแนบหลายไฟล์พร้อมกัน (FileList หรือ array ของ File) — อัปโหลดทีละไฟล์ตามลำดับ
  const handleFileUpload = useCallback(async (fileOrFiles, eventId, type) => {
    const files = Array.from(fileOrFiles?.length !== undefined ? fileOrFiles : [fileOrFiles]);
    if (files.length === 0) return;

    setUploadingState(p => ({ ...p, [type]: eventId }));
    setIsUploadingState(p => ({ ...p, [type]: true }));

    let successCount = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const sizeLabel = `${(file.size / (1024 * 1024)).toFixed(2)} MB` + (files.length > 1 ? ` (${i + 1}/${files.length})` : "");
        setUploadingFileSizeState(p => ({ ...p, [type]: sizeLabel }));
        setUploadProgressState(p => ({ ...p, [type]: 0 }));

        await EventService.Upload(eventId, file, type, {
          onUploadProgress: pe => {
            setUploadProgressState(p => ({ ...p, [type]: Math.round((pe.loaded * 100) / pe.total) }));
          },
        });
        successCount++;
      }
      setSnackbar({ open: true, msg: `อัปโหลด ${successCount} ไฟล์เรียบร้อย`, severity: "success" });
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
  }, []);

  const handleExportCSV = () => {
    const headers = [
      "บริษัท", "ไซต์", "ประเภท", "ระบบ", "สถานะ", "เลขเอกสาร",
      "วันที่เริ่ม", "วันที่สิ้นสุด", "ทีม",
      "เวลาเข้างาน", "เวลาเสร็จงาน", "สรุปงาน (ช่าง)", "จำนวน log",
    ];
    const rows = sortedEvents.map(e => [
      e.company, e.site, e.title, e.system, e.status, e.docNo,
      moment(e.start).format("DD/MM/YYYY HH:mm"),
      e.end ? moment(e.end).subtract(e.allDay ? 1 : 0, "days").format("DD/MM/YYYY HH:mm") : "",
      e.team,
      e.checkedInAt  ? moment(e.checkedInAt).format("DD/MM/YYYY HH:mm")  : "",
      e.checkedOutAt ? moment(e.checkedOutAt).format("DD/MM/YYYY HH:mm") : "",
      e.workNote || "",
      (e.activityLog || []).length,
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${(c || "").toString().replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `operation_${moment().format("YYYYMMDD")}.csv`; a.click();
    URL.revokeObjectURL(url);
    setSnackbar({ open: true, msg: "Export CSV เรียบร้อย", severity: "success" });
  };

  const isAdminOrManager = ["admin", "manager"].includes(currentUserRole);
  const { notifications, unread, markRead } = useEventNotifications(
    events,
    isAdminOrManager ? "admin" : "technician"
  );

  return (
    <Box sx={{ px: { xs: 1, sm: 2, md: 3 }, py: 3, maxWidth: 1400, mx: "auto" }}>

      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }} flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="h5" fontWeight={800} letterSpacing={-0.5}>แผนการดำเนินงาน</Typography>
          <Typography variant="body2" color="text.secondary">
            {loading ? "กำลังโหลด..." : `${sortedEvents.length} รายการ${activeFilterCount > 0 ? ` · กรอง ${activeFilterCount} เงื่อนไข` : ""}`}
          </Typography>
        </Box>
        <Stack direction="row" gap={1}>
          <Tooltip title="รีเฟรช">
            <IconButton onClick={() => fetchEventsFromDB()} size="small"
              sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
              <Refresh fontSize="small" />
            </IconButton>
          </Tooltip>
          {/* Notification bell — ทุก role เห็น แต่เนื้อหาต่างกันตามฝั่ง (ดูคอมเมนต์ใน NotificationBell) */}
          <NotificationBell notifications={notifications} unread={unread} onItemClick={markRead} />
          <Tooltip title="Export CSV (รวมเวลาเข้า/ออก + สรุปงาน)">
            <IconButton onClick={handleExportCSV} size="small"
              sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
              <Download fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {selectedEvent && (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}
          action={<Button color="inherit" size="small" onClick={() => navigate("/operation")}>แสดงทั้งหมด</Button>}>
          กรองเฉพาะงาน: <strong>{selectedEvent.title}</strong> · {selectedEvent.system} · {selectedEvent.site}
        </Alert>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}
          sx={{ "& .MuiTabs-indicator": { height: 3, borderRadius: "3px 3px 0 0" } }}>
          <StyledTab icon={<TableChart fontSize="small" />} iconPosition="start" label="รายการงาน" />
          <StyledTab icon={<Timeline fontSize="small" />}   iconPosition="start" label="Timeline" />
          {isAdminOrManager && (
            <StyledTab icon={<Dashboard fontSize="small" />}  iconPosition="start" label="Dashboard" />
          )}
        </Tabs>
      </Box>

      {/* ✅ แยกกลุ่มงานให้เห็นชัดเจนเป็น 3 กลุ่มเดียวกันทั้งฝั่งช่างและแอดมิน/manager
          (รอคุณ/ผู้ดูแลอนุมัติ / กำลังดำเนินการ-ยืนยันแล้ว / เสร็จสิ้น)
          (ใช้ร่วมกันทั้ง Tab รายการงาน/Timeline — Dashboard ดูภาพรวมทั้งหมดอยู่แล้วจึงไม่ต้องมี) */}
      {activeTab !== 2 && (() => {
        // ค่า default ต่างกันตาม role: แอดมิน/manager เปิดที่ "รอคุณอนุมัติ" ก่อน
        // ส่วนช่างเปิดที่ "กำลังดำเนินการ/ยืนยันแล้ว" ก่อน (ตรงกับงานที่ต้องลงมือทำจริง)
        const effectiveGroup = statusGroup || (isAdminOrManager ? "pending" : "active");
        return (
        <ToggleButtonGroup
          value={effectiveGroup}
          exclusive
          onChange={(_, v) => { if (v) setStatusGroup(v); }}
          size="small"
          sx={{ mb: 3, flexWrap: "wrap" }}>
          <ToggleButton value="pending" sx={{ textTransform: "none", fontWeight: 700, px: 2, gap: 1 }}>
            <HourglassTop sx={{ fontSize: 18 }} /> {isAdminOrManager ? "รอคุณอนุมัติ" : "รอผู้ดูแลอนุมัติ"}
            <Chip label={pendingCount} size="small" sx={{
              height: 20, fontSize: "0.68rem", ml: 0.75, fontWeight: 700,
              bgcolor: effectiveGroup === "pending" ? "rgba(255,255,255,0.28)" : alpha("#f59e0b", 0.12),
              color: effectiveGroup === "pending" ? "inherit" : "#f59e0b",
            }} />
          </ToggleButton>
          <ToggleButton value="active" sx={{ textTransform: "none", fontWeight: 700, px: 2, gap: 1 }}>
            <PendingActions sx={{ fontSize: 18 }} /> กำลังดำเนินการ/ยืนยันแล้ว
            <Chip label={inProgressCount} size="small" sx={{
              height: 20, fontSize: "0.68rem", ml: 0.75, fontWeight: 700,
              bgcolor: effectiveGroup === "active" ? "rgba(255,255,255,0.28)" : alpha("#8b5cf6", 0.12),
              color: effectiveGroup === "active" ? "inherit" : "#8b5cf6",
            }} />
          </ToggleButton>
          <ToggleButton value="closed" sx={{ textTransform: "none", fontWeight: 700, px: 2, gap: 1 }}>
            <CheckCircle sx={{ fontSize: 18 }} /> งานที่เสร็จสิ้น
            <Chip label={closedCount} size="small" sx={{
              height: 20, fontSize: "0.68rem", ml: 0.75, fontWeight: 700,
              bgcolor: effectiveGroup === "closed" ? "rgba(255,255,255,0.28)" : alpha("#10b981", 0.12),
              color: effectiveGroup === "closed" ? "inherit" : "#10b981",
            }} />
          </ToggleButton>
        </ToggleButtonGroup>
        );
      })()}

      {loading && <LinearProgress sx={{ borderRadius: 1, mb: 2 }} />}

      {/* TAB 0: TABLE */}
      {activeTab === 0 && (
        <>
          {/* ClosureRequestsPanel + LiveTrackingPanel แสดงเฉพาะ admin/manager */}
          {isAdminOrManager && (
            <>
              <ClosureRequestsPanel
                events={events}
                onApprove={handleApproveClose}
                onReject={handleRejectClose}
              />
              <LiveTrackingPanel
                events={events}
                onRefresh={() => fetchEventsFromDB(true)}
                lastRefreshed={lastRefreshed}
              />
            </>
          )}

          <FilterPanel
            search={search} onSearch={setSearch}
            filterType={filterType} onFilterType={setFilterType}
            filterSystem={filterSystem} onFilterSystem={setFilterSystem}
            filterStatus={filterStatus} onFilterStatus={setFilterStatus}
            filterOP={filterOP} onFilterOP={setFilterOP}
            filterTeam={filterTeam} onFilterTeam={setFilterTeam}
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
          ) : (
            <>
              {pagedGroups.map(sessions => (
                <JobGroupBlock
                  key={sessions[0].jobGroupId || sessions[0]._id}
                  sessions={sessions}
                  currentUserRole={currentUserRole}
                  employee={employee}
                  onStatusUpdate={handleStatusUpdate}
                  onDocNoUpdate={handleDocNoUpdate}
                  onInputUpdate={handleInputUpdate}
                  onFileUpload={handleFileUpload}
                  onDeleteFile={(eid, type, fileId) => { setPendingDelete({ id: eid, type, fileId }); setConfirmOpen(true); }}
                  onPreview={(url, name) => { setPreviewUrl(url); setPreviewFileName(name); }}
                  onDelete={handleDeleteRow}
                  onApproveClose={handleApproveClose}
                  onRejectClose={handleRejectClose}
                  uploadingState={uploadingState}
                  isUploadingState={isUploadingState}
                  uploadProgressState={uploadProgressState}
                  uploadingFileSizeState={uploadingFileSizeState}
                />
              ))}

              <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" justifyContent="space-between"
                gap={1.5} sx={{ mt: 2, mb: 1 }}>
                <TextField
                  select size="small" label="ต่อหน้า" value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                  sx={{ width: 110, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                  SelectProps={{ native: true }}>
                  {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n} รายการ</option>)}
                </TextField>
                <Pagination
                  count={totalPages} page={page}
                  onChange={(_, v) => setPage(v)}
                  color="primary" shape="rounded" size={isMobile ? "small" : "medium"}
                  showFirstButton showLastButton
                />
              </Stack>
            </>
          )}
        </>
      )}

      {/* TAB 1: TIMELINE */}
      {activeTab === 1 && (
        <>
          <FilterPanel
            search={search} onSearch={setSearch}
            filterType={filterType} onFilterType={setFilterType}
            filterSystem={filterSystem} onFilterSystem={setFilterSystem}
            filterStatus={filterStatus} onFilterStatus={setFilterStatus}
            filterOP={filterOP} onFilterOP={setFilterOP}
            filterTeam={filterTeam} onFilterTeam={setFilterTeam}
            showAll={showAll} onToggleShowAll={v => { setShowAll(v); if (v) setSelectedDate(""); }}
            selectedDate={selectedDate} onDateChange={d => { setSelectedDate(d); setShowAll(false); }}
            onClearAll={() => { setFilterType(""); setFilterSystem(""); setFilterStatus(""); setFilterOP(""); setFilterTeam(""); setSearch(""); }}
            activeCount={activeFilterCount}
          />
          <TimelineView events={sortedEvents} />
        </>
      )}

      {/* TAB 2: DASHBOARD (เฉพาะ admin/manager) */}
      {activeTab === 2 && isAdminOrManager && (
        <>
          <DashboardStats events={events} />
          <StatusProgressBar events={events} />
          <TechnicianSummary events={events} selectedDate={selectedDate} />
          <GlassCard>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom color="text.secondary">
                งานล่าสุด 5 รายการ
              </Typography>
              <Stack spacing={1.5}>
                {events.slice().sort((a, b) => new Date(b.start) - new Date(a.start)).slice(0, 5).map(e => (
                  <Stack key={e._id} direction="row" alignItems="center" gap={1.5}>
                    <Avatar sx={{ width: 32, height: 32,
                      bgcolor: alpha(OP_COLOR[e.status] || "#6b7280", 0.15),
                      color: OP_COLOR[e.status] || "#6b7280", fontSize: "0.8rem" }}>
                      {TYPE_ICON[e.title] || <Build fontSize="small" />}
                    </Avatar>
                    <Box flex={1} minWidth={0}>
                      <Typography variant="caption" fontWeight={700} noWrap>{companySite(e.company, e.site)}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {moment(e.start).locale("th").fromNow()}
                      </Typography>
                    </Box>
                    <StatusBadge color={OP_COLOR[e.status]}>{e.status || "—"}</StatusBadge>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </GlassCard>
        </>
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