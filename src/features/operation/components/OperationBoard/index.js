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

import MultiDayGroupHeader, { multiDayCardSx } from "@/shared/ui/MultiDayGroup";
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import PdfBlobView from "@/shared/components/PdfBlobView";
import useRealtime from "@/shared/realtime/useRealtime";
import EventService from "@/shared/services/EventService";
import AuthService from "@/shared/services/authService";
import JobTypeService from "@/shared/services/JobTypeService";
import SystemTypeService from "@/shared/services/SystemTypeService";
import Swal from "sweetalert2";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import {
  buildDaysPastDueMap, isFlaggedDays, isSevereDays, countFlaggedJobs, countDistinctJobs, getOverdueGroupKey,
} from "@/shared/utils/overdueJobs";
import { getApprovalState, isPendingApproval, isRejected } from "@/shared/utils/approvalStatus";
import { getOptimizedImageUrl } from "@/shared/utils/cloudinaryImage";
import { formatEventDateRange } from "@/shared/utils/formatDateRange";
import { formatRoundLabel } from "@/shared/utils/contractRounds";
import { classifyJob, getJobClassMeta } from "@/shared/utils/jobClassification";
// ✅ ไอคอนไฟล์ Excel — ชุดเดียวกับปุ่มส่งออกในหน้าปฏิทิน/ติดตามใบเสนอราคา (MUI ไม่มีไอคอนนี้)
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileExcel } from "@fortawesome/free-solid-svg-icons";

// MUI Core
import {
  Box, Grid, Paper, Typography, TextField, IconButton, Chip, Avatar,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Button, ButtonBase, Stack, Tooltip, Badge, Fade, Collapse, LinearProgress,
  Divider, useMediaQuery, useTheme, InputAdornment,
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
  CalendarMonth, Warning, TrendingUp, Description, DateRange,
  CloudUpload, InsertDriveFile, Image, PictureAsPdf, Article,
  Refresh, ArrowUpward, ArrowDownward, Circle, ExpandMore,
  ExpandLess, FolderOpen, AttachFile, Login, Logout, Edit,
  NoteAdd, History, Person, AccessTime, FiberManualRecord,
  TaskAlt, HourglassTop, Cancel,
  Send, Chat, Link as LinkIcon,
  Print, Share, RequestQuote, ReceiptLong, AssignmentTurnedIn, EventAvailable, Tune,
  RemoveCircleOutline, NoteAlt,
} from "@mui/icons-material";

// MUI Date Picker
// ✅ ปฏิทิน พ.ศ. ของแอป — มีหน้าจอเลือกปี→เดือน→วัน ครบ (ดู ThaiDatePickerInner)
import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import TelLink from "@/shared/components/TelLink";

// Router
import { useParams, useNavigate, useSearchParams } from "react-router-dom";

// Styled
import { styled, alpha } from "@mui/material/styles";

import TechnicianJobCard, { isDocComplete, isDocRequired } from "@/features/technician/components/TechnicianJobPanel";
import { INK, INK_2, MUTED, FAINT, LINE, SURFACE, ACCENT, ACCENT_SOFT, ACCENT_LINE, SUCCESS } from "@/shared/ui/PageKit";
import useEventNotifications from "@/shared/hooks/useEventNotifications";
import NotificationBell from "@/features/notifications/components/NotificationBell";
import LineIcon from "@/shared/ui/LineIcon";
import { printFile, shareFile, shareToLine, isMobileDevice } from "@/shared/utils/fileActions";
import DeliveryNoteDialog from "@/features/documents/components/DeliveryNoteDialog";
import WorkNoticeDialog from "@/features/documents/components/WorkNoticeDialog";
import { JobFlowChips, JobFlowPanel, JobFlowFlags, nextStepOf } from "@/shared/ui/JobFlow";
import SitePhotos from "@/shared/ui/SitePhotos";
import InfoLine from "@/shared/ui/InfoLine";
// ✅ ตำแหน่งหน้างานบน Google Maps — ตัวเดียวกับที่ระบบใบแจ้งงานใช้ (ดูหัวไฟล์ SiteMapLink.js)
// ⚠️ หน้านี้ใช้แค่ hook ไม่ใช้ตัวคอมโพเนนต์ — ลิงก์แผนที่ผูกไว้กับ "ชื่อโครงการ" บนการ์ดเลย
// ไม่มีปุ่ม/กล่องของตัวเอง (ดูเหตุผลตรงจุดที่ใช้)
import { useSiteMapUrl, GoogleMapsPin } from "@/shared/ui/SiteMapLink";
import { JOB_DOC_TYPES } from "@/shared/utils/jobDocTypes";
import { formatThai } from "@/shared/utils/thaiDate";
import { ROLES, TECHNICIAN_ROLES, isRole, normalizeRole } from "@/shared/utils/roles";
import { can } from "@/shared/utils/roles";
import ViewTiles from "@/shared/ui/ViewTiles";
import ResponsibleSummary from "@/shared/ui/ResponsibleSummary";
import Drawer from "@mui/material/Drawer";
import AppsIcon from "@mui/icons-material/Apps";
import SelectField, { SELECT_FIELD_SX, SELECT_MENU_PROPS } from "@/shared/ui/SelectField";
import PersonSelectField from "@/shared/ui/PersonSelectField";
import useCloseOnPick from "@/shared/hooks/useCloseOnPick";
import { PeopleRow, PersonChip, AssignableResponsible, AssignResponsibleMenu, useAvatarMap, teamNamesOf } from "@/shared/ui/PersonChip";

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
// src/shared/utils/overdueJobs.js แล้ว เพราะต้องใช้ตรรกะเดียวกันซ้ำในหลายหน้า (Dashboard, MyJobs) —
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

// ⚠️ ลบ FilterChip ออกแล้ว — เดิมใช้กับแผงตัวกรองที่กางชิปทุกตัวเลือกออกมา 23 ชิป ตอนนี้แผงนั้น
// เปลี่ยนเป็น dropdown 4 ช่องแล้ว (ดู FilterPanel) จึงไม่มีใครใช้อีก

// ─── Upload / Badge ─────────────────────────────────────────────────
// ✅ ปุ่มเลือกกลุ่มสถานะงาน (รอคุณอนุมัติ/กำลังดำเนินการ/ค้างงาน/เสร็จสิ้น) — เดิมใช้ ToggleButtonGroup
// แบบชิปเล็กๆ เรียงแนวนอน พอจอแคบ (มือถือ) จะห่อบรรทัดมั่วๆ กดยาก เปลี่ยนเป็นการ์ดใหญ่จัดกริด
// 2 คอลัมน์เสมอ (ฝั่งแอดมิน/manager ขยายเป็น 4 คอลัมน์ในแนวนอนตอนจอกว้างพอ) แตะง่าย เห็นตัวเลขชัด
// ✅ ปรับให้กระชับขึ้นมากบนจอเล็ก — เดิมจัดกลางแนวตั้ง (ไอคอน/ชื่อ/จำนวน ซ้อน 3 ชั้น สูงขั้นต่ำ 92px)
// พอเป็นกริด 2x2 บนมือถือจึงกินพื้นที่เกือบ 200px ก่อนจะถึงข้อมูลจริงสักรายการ ต้องเลื่อนผ่านทุกครั้ง
// ✅ จอเล็ก: เรียงแนวนอน (ไอคอน | ชื่อ+จำนวน) สูงแค่ ~62px — เห็นครบเหมือนเดิมแต่ประหยัดที่ราวครึ่งหนึ่ง
// ✅ จอกว้าง: คงแบบเดิม (จัดกลาง 3 ชั้น) ซึ่งดูสมส่วนอยู่แล้วเมื่อวางเรียง 4 ใบในแถวเดียว
// ✅ ตัวเลขจำนวนงานทำให้เด่นขึ้น (ตัวหนา+ใหญ่กว่าคำว่า "งาน") — เป็นข้อมูลที่คนมองการ์ดนี้ต้องการจริงๆ
// ✅ ป้ายสถานะ — พื้นเทาอ่อน ขอบบาง ตัวหนังสือเข้ม · สีสถานะอยู่ที่จุดเล็กหน้าข้อความ (กฎออกแบบ: สีไม่เยอะ)
// ✅ (10 ต.ค. 2569 ผู้ใช้: "สีสถานะจืดชืดไป ไม่ชัดเจน") — ป้ายสถานะพื้นอ่อน + ขอบ + ตัวหนังสือโทนเข้มของสีสถานะ
//    (เดิมพื้นเทาเหมือนกันทุกสถานะ ต่างกันแค่จุดเล็ก — ในตารางไม่มีจุดเลย แยกสถานะไม่ออก)
//    ⚠️ สถานะเป็นสีเดียวในการ์ด/แถวที่ "ต้องเด่น" — ส่วนอื่นยังเป็นโทนเทาตามรอบก่อน
const STATUS_INK = { "#f59e0b": "#b45309", "#3b82f6": "#1d4ed8", "#8b5cf6": "#6d28d9", "#10b981": "#047857" };
const StatusBadge = styled(Box, { shouldForwardProp: (p) => p !== "color" })(({ color }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "2px 10px",
  borderRadius: 20,
  fontSize: "0.75rem",
  fontWeight: 800,
  whiteSpace: "nowrap",
  background: color ? alpha(color, 0.12) : "#f8fafc",
  border: `1px solid ${color ? alpha(color, 0.35) : "#e2e8f0"}`,
  color: STATUS_INK[color] || "#334155",
  "& .MuiSvgIcon-root": { color: color || "#94a3b8", fontSize: 8 },
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

const DOC_TYPE_LABELS = Object.fromEntries(JOB_DOC_TYPES.map((t) => [t.key, t.label]));

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
// (features/notifications/components/NotificationBell) ให้ Header ใช้ร่วมได้ทุกหน้า
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
// ⚠️ ไม่เก็บสำเนาไอคอน/สีไว้ที่นี่แล้ว — ย้ายไปเป็นต้นฉบับเดียวที่ shared/utils/jobDocTypes.js เพราะหน้า
// "ภาพรวมงาน" ต้องใช้ชุดเดียวกันด้วย (ถ้าก๊อปไว้คนละที่ วันหนึ่งจะเปลี่ยนสีไม่ครบแล้วผู้ใช้เห็นคนละสี
// ระหว่าง 2 หน้าโดยไม่มีอะไรฟ้อง)
const DOC_TYPE_META = Object.fromEntries(
  JOB_DOC_TYPES.map((t) => [t.key, { icon: t.Icon, color: t.color, desc: t.desc }])
);

// ✅ perf: แยกแถวไฟล์ออกมาเป็นคอมโพเนนต์ของตัวเอง + React.memo — เดิมแถวไฟล์ทั้งหมดอยู่ใน .map()
// ในตัว FileUploadSection เอง พอ auto-refresh ทุก 15 วิ แทนที่ events ทั้งก้อนด้วย object ใหม่
// (แม้ข้อมูลจริงจะไม่เปลี่ยน) ทุกแถวไฟล์ (Tooltip×2 + IconButton×2 ต่อแถว) ต้อง re-render ใหม่หมดทุกครั้ง
// งานที่มีไฟล์เยอะๆ (เช่น 9 ไฟล์ใน Service Report จากภาพที่ผู้ใช้ส่งมา) นี่คือส่วนที่หนักที่สุดของการ์ด
// เทียบด้วยค่าจริง (_id/fileUrl/fileName) ไม่ใช่ reference ของ object ไฟล์ (ซึ่งเปลี่ยนทุก poll อยู่แล้ว
// แม้เนื้อหาเดิม) — ต้องรับ onPreview/onOpenMenu แบบ stable reference (useCallback ที่ต้นทาง) ไม่งั้น
// memo จะไม่มีผลอะไรเลยเพราะ props เปลี่ยนทุกครั้งอยู่ดี
const FileRow = React.memo(
  ({ file: f, onPreview, onOpenMenu }) => (
    <Stack direction="row" alignItems="center" gap={1} sx={{
      pl: 1.25, pr: 0.5, py: 0.5, borderRadius: 2, bgcolor: "#fff", border: `1px solid ${LINE}`,
    }}>
      {fileTypeIcon(f.fileName)}
      <Box flex={1} minWidth={0} onClick={() => onPreview(f.fileUrl, f.fileName)} sx={{ cursor: "pointer" }}>
        <Typography noWrap title={f.fileName} sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK_2 }}>{f.fileName}</Typography>
        {(f.uploadedBy || f.uploadedAt) && (
          <Typography noWrap sx={{ fontSize: "0.68rem", color: FAINT }}>
            {[f.uploadedBy, f.uploadedAt ? moment(f.uploadedAt).locale("th").format("D MMM HH:mm") : ""].filter(Boolean).join(" · ")}
          </Typography>
        )}
      </Box>
      <Tooltip title="ดูไฟล์">
        <IconButton onClick={() => onPreview(f.fileUrl, f.fileName)} sx={{ p: 0.9, color: MUTED }}><Visibility sx={{ fontSize: 18 }} /></IconButton>
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

/**
 * ✅ (3 ต.ค. 2569) ผู้ใช้: "หน้าของแอดมินด้วย ให้สอดคล้อง ดูง่าย รายละเอียดครบถ้วน มืออาชีพ"
 *    card=true → การ์ดขาวแบบเดียวกับหน้าแนบเอกสารของช่าง: ไอคอน · ชื่อ + ป้ายบังคับ/ถ้ามี · คำอธิบาย · ป้ายสถานะ
 *    event (ถ้าส่งมา) ใช้ตัดสินว่าบังคับไหม (งาน PM) และสถานะครบหรือยัง — ตรรกะเดียวกับฝั่งช่าง (isDocComplete)
 */
export const FileUploadSection = ({
  eventId, type, label, files, applicable,
  onUpload, onDelete, onPreview,
  uploading, progress, uploading_size, currentUser,
  card = false, event = null,
}) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = React.useRef();
  const overrideInputRef = React.useRef();
  const canEdit  = can(currentUser, "editOperation");

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

  // ✅ ป้ายสถานะ 1 ป้าย — แอดมินเห็นทันทีว่าช่องนี้ช่างทำแล้ว/ยังขาด/ระบุว่าไม่มี
  const required = event ? isDocRequired(event, type) : type === "report";
  const reportUnconfirmed = type === "report" && event && hasFiles && !event.documentSentReport;
  const pill = hasFiles
    ? (reportUnconfirmed
        ? { text: "ช่างยังไม่ยืนยัน", fg: "#b45309", bg: "#fffbeb", dot: "#f59e0b" }
        : { text: `แนบแล้ว ${fileList.length} ไฟล์`, fg: "#15803d", bg: "#f0fdf4", icon: true })
    : applicable === false && !required
      ? { text: "ไม่มี", fg: MUTED, bg: "#f1f5f9", dot: FAINT }
      : required || applicable === true
        ? { text: "ยังไม่แนบ", fg: "#b45309", bg: "#fffbeb", dot: "#f59e0b" }
        : { text: "รอช่างตอบ", fg: MUTED, bg: "#f1f5f9", dot: FAINT };

  return (
    <Box sx={card ? {
      borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${hasFiles && !reportUnconfirmed ? "#d1fae5" : LINE}`,
      boxShadow: "0 1px 2px rgba(15,23,42,.04)", px: 1.75, pt: 1.5, pb: 1.75,
    } : undefined}>
      <Stack direction="row" alignItems="flex-start" gap={1.25} sx={{ mb: 1.25 }}>
        <Box sx={{
          width: card ? 36 : 30, height: card ? 36 : 30, borderRadius: "10px", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          bgcolor: alpha(meta.color, 0.1), color: meta.color,
        }}>
          <TypeIcon sx={{ fontSize: card ? 19 : 17 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
            <Typography sx={{ fontWeight: 800, fontSize: "0.92rem", color: INK, lineHeight: 1.3 }}>{label}</Typography>
            {card && (
              <Box component="span" sx={{
                fontSize: "0.64rem", fontWeight: 800, px: 0.75, py: 0.1, borderRadius: 1,
                color: required ? INK_2 : MUTED, bgcolor: required ? "#f1f5f9" : "transparent",
                border: required ? "none" : `1px solid ${LINE}`,
              }}>
                {required ? (type === "report" ? "บังคับ" : "บังคับงาน PM") : "ถ้ามี"}
              </Box>
            )}
          </Stack>
          {card && meta.desc && (
            <Typography sx={{ fontSize: "0.76rem", color: MUTED, lineHeight: 1.45, mt: 0.25 }}>{meta.desc}</Typography>
          )}
        </Box>
        <Box component="span" sx={{
          display: "inline-flex", alignItems: "center", gap: 0.4, flexShrink: 0, mt: 0.25,
          height: 24, px: 1, borderRadius: 999, fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap",
          color: pill.fg, bgcolor: pill.bg,
        }}>
          {!pill.icon && <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: pill.dot }} />}
          {pill.icon && <CheckCircle sx={{ fontSize: 14 }} />}{pill.text}
        </Box>
      </Stack>

      {/* ✅ ถ้ามีไฟล์เยอะ (เช่น 6+ ไฟล์) จำกัดความสูงแล้วเลื่อนดูแทน ไม่ให้รายการยาวจนดันเนื้อหา
          ส่วนอื่นไปไกล ทำให้หน้าดูไม่เป็นระบบเวลาไฟล์เยอะ */}
      {hasFiles && (
        <Stack spacing={0.75} sx={{ mb: uploading || canEdit ? 1 : 0, maxHeight: 260, overflowY: "auto" }}>
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
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}
          sx={{ px: 1.25, py: 0.75, borderRadius: 2, bgcolor: SURFACE }}>
          <Typography sx={{ fontSize: "0.8rem", color: INK_2, display: "inline-flex", alignItems: "center", gap: 0.6 }}>
            <RemoveCircleOutline sx={{ fontSize: 16, color: FAINT }} />
            ช่างระบุว่างานนี้ไม่มี{label}
          </Typography>
          {canEdit && (
            <>
              <input ref={overrideInputRef} type="file" hidden multiple
                onChange={e => { if (e.target.files?.length) onUpload(e.target.files, eventId, type); }} />
              <Button size="small" onClick={() => overrideInputRef.current?.click()}
                sx={{ textTransform: "none", fontSize: "0.76rem", fontWeight: 700, color: ACCENT, flexShrink: 0, minWidth: "auto" }}>
                แนบไฟล์แทน
              </Button>
            </>
          )}
        </Stack>
      ) : canEdit ? (
        /* ✅ กล่องแนบไฟล์แบบเดียวกับฝั่งช่าง — กดหรือลากไฟล์มาวาง บอกชนิดไฟล์ที่รับในตัว */
        <Box
          role="button"
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          sx={{
            display: "flex", alignItems: "center", gap: 1, minHeight: 44, px: 1.5, borderRadius: 2, cursor: "pointer",
            border: `1px dashed ${dragging ? ACCENT : ACCENT_LINE}`,
            bgcolor: dragging ? ACCENT_SOFT : "#fff", color: ACCENT,
            transition: "background-color .15s, border-color .15s, color .15s",
            "&:hover": { bgcolor: ACCENT_SOFT, borderColor: ACCENT },
          }}>
          <input ref={inputRef} type="file" hidden multiple
            onChange={e => { if (e.target.files?.length) onUpload(e.target.files, eventId, type); }} />
          <CloudUpload sx={{ fontSize: 19 }} />
          <Typography component="span" sx={{ fontSize: "0.84rem", fontWeight: 700, color: "inherit" }}>
            {dragging ? "ปล่อยไฟล์ที่นี่" : hasFiles ? "เพิ่มไฟล์" : "แนบไฟล์"}
          </Typography>
          <Typography component="span" noWrap sx={{ fontSize: "0.7rem", color: FAINT, ml: "auto", minWidth: 0, display: { xs: "none", sm: "inline" } }}>
            กดเลือก หรือลากไฟล์มาวาง · PDF · รูป · Word · Excel
          </Typography>
          <Typography component="span" noWrap sx={{ fontSize: "0.7rem", color: FAINT, ml: "auto", minWidth: 0, display: { xs: "inline", sm: "none" } }}>
            PDF · รูป · Word · Excel
          </Typography>
        </Box>
      ) : !hasFiles ? (
        <Box sx={{ px: 1.25, py: 1, borderRadius: 2, bgcolor: SURFACE }}>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>ยังไม่มีไฟล์</Typography>
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

  const isMine = (c) => (isRole(myRole, ...TECHNICIAN_ROLES) ? isRole(c.role, ...TECHNICIAN_ROLES) : !isRole(c.role, ...TECHNICIAN_ROLES));

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
                      {c.userName || (isRole(c.role, ...TECHNICIAN_ROLES) ? "ช่าง" : "แอดมิน")}
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
/**
 * ตัวบอกสถานะเอกสาร/กิจกรรมบนหัวการ์ด (ไม่ใช่ปุ่ม — เป็นแค่ตัวชี้ว่ามีอะไรอยู่บ้าง)
 *
 * ✅ บนจอกว้างโชว์ "จำนวน" ต่อท้ายไอคอนด้วย — เดิมมีแต่ไอคอนเปล่าๆ ต้องเอาเมาส์ไปจิ้มทีละอัน
 * ถึงจะรู้ว่ามีกี่ไฟล์ ทั้งที่จอคอมมีที่เหลือเฟือ ทำให้ต้องไล่ hover ทีละการ์ดเวลาไล่ดูงานหลายรายการ
 * ⚠️ โชว์เฉพาะตอนมากกว่า 1 — เลข "1" ต่อท้ายทุกอันคือ noise เพราะการที่ไอคอนโผล่ก็แปลว่ามีอย่างน้อย 1 อยู่แล้ว
 * ⚠️ จอแคบยังเป็นไอคอนเปล่าเหมือนเดิม พื้นที่ไม่พอให้ใส่ตัวเลข
 */
// ✅ (10 ต.ค. 2569 ผู้ใช้: "สีสันยังดูรกๆ ตัดกัน") ไอคอนเอกสารเป็นโทนเทาเดียวกันหมด — แยกชนิดด้วยรูปไอคอน/tooltip
//    (เดิมฟ้า/แดง/ส้ม/เขียว 4 สีเรียงกันท้ายการ์ดทุกใบ) · prop color ยังรับไว้เพื่อไม่ต้องแก้จุดเรียก
const DocIndicator = ({ title, icon: Icon, count, showCount }) => (
  <Tooltip title={title}>
    <Stack direction="row" alignItems="center" gap={0.2}>
      <Icon sx={{ fontSize: 16, color: "#94a3b8" }} />
      {showCount && count > 1 && (
        <Typography component="span" sx={{ fontSize: "0.68rem", fontWeight: 800, color: "#64748b", lineHeight: 1 }}>
          {count}
        </Typography>
      )}
    </Stack>
  </Tooltip>
);

const EventRowCard = ({
  event, employee, onStatusUpdate, onDocNoUpdate, onInputUpdate, onDateUpdate,
  onFileUpload, onDeleteFile, onPreview, onDelete, onApproveClose, onRejectClose,
  uploadingState, isUploadingState, uploadProgressState, uploadingFileSizeState,
  currentUser, onAssignResponsible,
  // ✅ เปิดกางรายละเอียดไว้ตั้งแต่แรก — ใช้ในแผงรายละเอียด (กดจากตาราง) ซึ่งเปิดมาเพื่อดูรายละเอียดอยู่แล้ว
  defaultExpanded = false,
  // ✅ แสดงรายละเอียด (เอกสาร/คุยกับช่าง/ประวัติ) กางลงในตัวการ์ด แทนการเปิดหน้าต่างซ้อน — ใช้ในแผงด้านข้าง
  //    (ผู้ใช้: "เปิดมาแบบแผงนี้พอ ไม่ต้องเด้งหน้าไฟล์ซ้อนขึ้นมาอีก")
  inlineDetails = false,
  // ✅ งานที่เข้าหลายวัน (กลุ่มเดียวกัน) ใช้เอกสารร่วมกันชุดเดียว — JobGroupBlock จะโชว์
  // เอกสารรวมไว้ที่หัวกลุ่มแทน จึงซ่อนส่วนอัปโหลดเอกสารในการ์ดรายวันแต่ละใบไม่ให้ซ้ำกัน
  hideDocuments = false,
  // ✅ เวลาอยู่ในกลุ่มงานหลายวัน JobGroupBlock จะรวมทุกวันไว้ใน GlassCard ใบเดียวกันเอง
  // (ห่อจากข้างนอก) จึงไม่ต้องมี GlassCard/เงา/ระยะห่างซ้อนของตัวเองอีกชั้น
  noOuterCard = false,
  // ✅ ขั้นตอนทำงาน (จัดการงานไม่เสร็จแล้ว) — server คืนงานทั้งกลุ่ม ให้หน้าแม่เอาไปแทน
  onPatched,
}) => {
  const avatarMap = useAvatarMap(employee);
  // ✅ มอบหมาย/เปลี่ยนผู้รับผิดชอบจากการ์ดนี้ได้เลย (สิทธิ์เดียวกับหน้าภาพรวมงาน — editContracts)
  const [assignAnchor, setAssignAnchor] = useState(null);
  const canAssign = Boolean(onAssignResponsible) && can(currentUser, "editContracts");
  // open = กางรายละเอียดในการ์ด · expanded = กล่องเอกสาร/คุยกับช่าง/ประวัติ
  const [open,       setOpen]       = useState(defaultExpanded || inlineDetails);
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
  // ✅ ใบส่งมอบงาน — จุดหลักที่ควรกดออกเอกสารนี้คือ "ตรงการ์ดงานที่ทำเสร็จแล้ว" เพราะเป็นลำดับ
  // การทำงานจริง (งานเสร็จ → ส่งมอบเอกสารให้ลูกค้าเซ็นรับ) ไม่ต้องจำเลขงานแล้วไปเปิดหาที่หน้าอื่น
  const [deliveryNoteOpen, setDeliveryNoteOpen] = useState(false);
  // ✅ ใบแจ้งเข้างาน — เอกสารคู่กันของงานเดียวกัน คนละหัวคนละท้ายของงาน (แจ้งก่อนเข้า / ส่งมอบหลังเสร็จ)
  // ควรอยู่จุดเดียวกันเสมอ ไม่งั้นออกใบหนึ่งได้จากหน้านี้ แต่อีกใบต้องไปเปิดหาที่หน้าปฏิทินแทน
  const [workNoticeOpen, setWorkNoticeOpen] = useState(false);
  // พิกัดหน้างานของโครงการนี้ — อ่านจากแคชกลาง (ทั้งหน้ายิงโหลดทะเบียนลูกค้าครั้งเดียว ไม่ใช่ต่อการ์ด)
  const { href: mapHref, saved: hasSiteMap } = useSiteMapUrl(event.company, event.site);
  const theme  = useTheme();
  // ✅ จอกว้างพอ (≥900px) เปิดรายละเอียดงาน (เอกสาร/คุยกับช่าง/ประวัติ) แบบ Dialog ทับขึ้นมาแทน
  // การกางลงในหน้า (Collapse) — เดิมกางแล้วเนื้อหายาวๆ ดันการ์ดอื่นในคอลัมน์เดียวกันลงมา ต้อง
  // เลื่อนจอตาม ทั้งที่จอกว้างเปิดลอยทับได้เลยโดยไม่กระทบตำแหน่งการ์ดอื่น (มือถือยังกางลงแบบเดิม)
  const isDesktop = useMediaQuery("(min-width:900px)");
  const canEdit = can(currentUser, "editOperation");
  // ✅ ขั้นตอนถัดไป (ตัวเดียวกับกล่อง "ขั้นตอนถัดไป" ใน JobFlowPanel) — โชว์สั้นๆ บนหัวการ์ดตอนพับ
  // ⚠️ งานปิดแล้วไม่แสดง — ป้ายสถานะ "ดำเนินการเสร็จสิ้น" บอกอยู่แล้ว ไม่ต้องซ้ำ
  const nextStep = event.department === "sales" || localStatus === "ดำเนินการเสร็จสิ้น" ? null : nextStepOf(event, "admin");
  const isAdminOrManager = can(currentUser, "approveJobs");

  // ── Send Comment (คุยกับช่าง เช่น ตอบคำขอใบเสนอราคา) ──────────────────
  const handleSendComment = async (message) => {
    const payload = JSON.parse(localStorage.getItem("payload") || "{}");
    const newComment = {
      userId: payload?.userId || "",
      userName: payload?.name || payload?.username || "แอดมิน",
      role: normalizeRole(currentUser),   // ช่องนี้เก็บ "ตำแหน่ง" เป็นสตริงตามเดิม (ถูกเทียบด้วย isRole ตอนแสดงผล)
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
  const docDone = JOB_DOC_TYPES.filter((t) => isDocComplete(event, t.key)).length;
  const sectionLabel = (icon, text, extra) => (
    <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 1 }}>
      {icon}
      <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: INK_2, flex: 1 }}>{text}</Typography>
      {extra}
    </Stack>
  );
  const expandedContent = (
    <Grid container spacing={1.25}>
      {event.workNote && (
        <Grid item xs={12} sx={{ mb: 0.75 }}>
          {sectionLabel(<NoteAlt sx={{ fontSize: 17, color: MUTED }} />, "สรุปงานที่ทำ (จากช่าง)")}
          <Box sx={{ px: 1.75, py: 1.25, borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${LINE}` }}>
            <Typography sx={{ fontSize: "0.84rem", color: INK_2, whiteSpace: "pre-line", lineHeight: 1.65 }}>
              {event.workNote}
            </Typography>
          </Box>
        </Grid>
      )}

      {(!hideDocuments || showDocsOverride) && (
        <Grid item xs={12} sx={{ mb: -0.25 }}>
          {sectionLabel(<Description sx={{ fontSize: 17, color: MUTED }} />, "เอกสารประจำงาน", (
            <Typography sx={{ fontSize: "0.76rem", fontWeight: 800, color: docDone === JOB_DOC_TYPES.length ? "#15803d" : MUTED }}>
              {docDone}/{JOB_DOC_TYPES.length} รายการ{docDone === JOB_DOC_TYPES.length ? " · พร้อมปิดงาน" : ""}
            </Typography>
          ))}
        </Grid>
      )}

      {hideDocuments && !showDocsOverride && (
        <Grid item xs={12}>
          <Button size="small" onClick={() => setShowDocsOverride(true)}
            sx={{ textTransform: "none", fontSize: "0.75rem", color: "text.secondary" }}>
            <Description sx={{ fontSize: 13, mr: 0.5, verticalAlign: "-2px" }} />
            เอกสารหลักอยู่ที่การ์ดวันล่าสุด — กดเพื่อแนบ/แก้ไฟล์แยกเฉพาะวันนี้
          </Button>
        </Grid>
      )}
      {(!hideDocuments || showDocsOverride) && (
        <Grid item xs={12}>
        <FileUploadSection
          card event={event}
          eventId={event._id} type="report" label="Service Report"
          files={event.reportFiles}
          onUpload={onFileUpload} onDelete={onDeleteFile} onPreview={onPreview}
          uploading={isUploadingState.report && uploadingState.report === event._id}
          progress={uploadProgressState.report}
          uploading_size={uploadingFileSizeState.report}
          currentUser={currentUser}
        />
      </Grid>
      )}
      {(!hideDocuments || showDocsOverride) && (
      <Grid item xs={12}>
        <FileUploadSection
          card event={event}
          eventId={event._id} type="quotation" label="ใบเสนอราคา"
          files={event.quotationFiles}
          applicable={event.quotationApplicable}
          onUpload={onFileUpload} onDelete={onDeleteFile} onPreview={onPreview}
          uploading={isUploadingState.quotation && uploadingState.quotation === event._id}
          progress={uploadProgressState.quotation}
          uploading_size={uploadingFileSizeState.quotation}
          currentUser={currentUser}
        />
      </Grid>
      )}

      {(!hideDocuments || showDocsOverride) && (
       <Grid item xs={12}>
        <FileUploadSection
          card event={event}
          eventId={event._id} type="invoice" label="ใบวางบิล"
          files={event.invoiceFiles}
          applicable={event.invoiceApplicable}
          onUpload={onFileUpload} onDelete={onDeleteFile} onPreview={onPreview}
          uploading={isUploadingState.invoice && uploadingState.invoice === event._id}
          progress={uploadProgressState.invoice}
          uploading_size={uploadingFileSizeState.invoice}
          currentUser={currentUser}
        />
      </Grid>
      )}

      {(!hideDocuments || showDocsOverride) && (
       <Grid item xs={12}>
        <FileUploadSection
          card event={event}
          eventId={event._id} type="completion" label="ใบส่งมอบงาน"
          files={event.completionFiles}
          applicable={event.completionApplicable}
          onUpload={onFileUpload} onDelete={onDeleteFile} onPreview={onPreview}
          uploading={isUploadingState.completion && uploadingState.completion === event._id}
          progress={uploadProgressState.completion}
          uploading_size={uploadingFileSizeState.completion}
          currentUser={currentUser}
        />
      </Grid>
      )}

      {/* คุยกับช่าง (เช่น ตอบคำขอใบเสนอราคา) */}
      <Grid item xs={12} sx={{ mt: 1 }}>
        {sectionLabel(<Chat sx={{ fontSize: 17, color: MUTED }} />, `คุยกับช่าง${(event.comments || []).length > 0 ? ` (${event.comments.length})` : ""}`)}
        <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${LINE}` }}>
          <CommentThread comments={event.comments} onSend={handleSendComment} myRole={currentUser} />
        </Box>
      </Grid>

      {event.activityLog?.length > 0 && (
        <Grid item xs={12}>
          <Box sx={{ px: 1.5, py: 0.75, borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${LINE}` }}>
            <ActivityLogMini logs={event.activityLog} />
          </Box>
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
        {/* ✅ (10 ต.ค. 2569 ผู้ใช้: "หน้าการดำเนินงานอยากให้เป็นการ์ดหัวข้อ แล้วค่อยเปิดขยายเพื่อดูข้อมูล
            ทำให้สวยงาม ดูง่าย เข้าใจง่าย และมืออาชีพ")
            • หัวการ์ด (เห็นเสมอ): สถานะ · วันที่ · ชื่องาน/ระบบ · โครงการ · ป้ายสำคัญ · ผู้รับผิดชอบ · ขั้นตอนถัดไป
            • กดหัวการ์ด = กาง/พับรายละเอียดลงในการ์ด (คน · ข้อมูลงาน · ขั้นตอนทำงาน · รูปหน้างาน · คำขอปิดงาน)
            • เอกสาร/คุยกับช่าง/ประวัติ อยู่ปุ่มท้ายรายละเอียด (เปิดกล่องเดิม)
            ปุ่ม/ลิงก์ย่อยด้านในที่มี action ของตัวเอง ต้อง stopPropagation ไม่งั้นกดแล้วการ์ดกาง/พับไปด้วย */}
        <Box onClick={() => setOpen((p) => !p)} sx={{ cursor: "pointer" }} role="button" aria-expanded={open}>
          <Stack direction="row" alignItems="flex-start" gap={1.5}>
            <Avatar sx={{
              display: { xs: "none", sm: "flex" },
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
              <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
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
                    <Chip size="small" label={meta.label}
                      icon={<Circle sx={{ fontSize: "8px !important", color: `${meta.color} !important` }} />}
                      sx={{ height: 22, fontSize: "0.7rem", fontWeight: 700, bgcolor: "#f8fafc", border: "1px solid #e2e8f0", color: "#334155" }} />
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
                      <CalendarMonth sx={{ fontSize: 13, mr: 0.5, verticalAlign: "-2px" }} />
                      {formatEventDateRange(event)}
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
                {/* ✅ ไม่ต้องมี LocalizationProvider ห่อแล้ว — ThaiDatePicker ห่อ provider (พร้อม adapter
                    พ.ศ. และข้อความไทย) มาให้ในตัวอยู่แล้วทุกช่อง */}
                <Stack spacing={1.5} sx={{ p: 2, width: 260 }}>
                    <Typography variant="subtitle2" fontWeight={700}>แก้ไขวันที่เข้างาน</Typography>
                    {/* 🐛 BUG ที่แก้: 2 ช่องนี้เคยเป็น DatePicker ดิบของ MUI + AdapterMoment ธรรมดา —
                        ปฏิทินจึงขึ้นเป็น ค.ศ. ต่างจากทั้งแอปที่เป็น พ.ศ. หมด และไม่มีหน้าจอเลือกเดือนด้วย
                        (ต้องกดลูกศรทีละเดือน) ✅ เปลี่ยนมาใช้ ThaiDatePicker ตัวกลางเหมือนที่อื่นทั้งแอป
                        ⚠️ ThaiDatePicker รับ/คืนค่าเป็นสตริง "YYYY-MM-DD" ไม่ใช่ moment — แปลงตรงนี้
                        ให้ state ข้างนอกยังเป็น moment เหมือนเดิม (handleDateSave เรียก .format/.isValid) */}
                    <ThaiDatePicker
                      label="วันที่เริ่ม"
                      value={editStart && editStart.isValid() ? editStart.format("YYYY-MM-DD") : ""}
                      onChange={(v) => setEditStart(v ? moment(v, "YYYY-MM-DD") : null)}
                    />
                    <ThaiDatePicker
                      label="วันที่สิ้นสุด"
                      value={editEnd && editEnd.isValid() ? editEnd.format("YYYY-MM-DD") : ""}
                      onChange={(v) => setEditEnd(v ? moment(v, "YYYY-MM-DD") : null)}
                      minDate={editStart && editStart.isValid() ? editStart.format("YYYY-MM-DD") : undefined}
                    />
                    {dateError && <Alert severity="error" sx={{ py: 0, fontSize: "0.75rem" }}>{dateError}</Alert>}
                    <Stack direction="row" justifyContent="flex-end" gap={1}>
                      <Button size="small" onClick={closeDateEdit} disabled={dateSaving}>ยกเลิก</Button>
                      <Button size="small" variant="contained" onClick={handleDateSave} disabled={dateSaving}>
                        {dateSaving ? "กำลังบันทึก..." : "บันทึก"}
                      </Button>
                    </Stack>
                </Stack>
              </Popover>

              <Typography fontWeight={800} fontSize="1rem" noWrap sx={{ letterSpacing: "-0.01em", mt: 0.5, color: INK }}>
                {event.title || "ไม่ระบุประเภทงาน"}
                {event.system && <Box component="span" sx={{ fontWeight: 600, color: INK_2 }}>{` · ${event.system}`}</Box>}
              </Typography>
              <Typography noWrap sx={{ fontSize: "0.84rem", color: MUTED, fontWeight: 600 }}>
                {companySite(event.company, event.site)}
                {event.time ? ` · ครั้งที่ ${formatRoundLabel(event.time, event.visitCount, event)}` : ""}
              </Typography>
              {/* ✅ เลข Job · ด่วน · ครบกำหนด · รอข้อมูล · งานไม่เสร็จ · ช่างรับงานแล้วหรือยัง */}
              <JobFlowChips event={event} showAck />
            </Box>
            <Stack direction="row" alignItems="center" gap={0.25} flexShrink={0} sx={{ mt: -0.5, mr: -0.75 }}>
            {canEdit && (
              <IconButton onClick={e => { e.stopPropagation(); setMoreAnchorEl(e.currentTarget); }} sx={{ p: 1 }}>
                <MoreVert fontSize="small" />
              </IconButton>
            )}
              <ExpandMore sx={{ fontSize: 22, color: MUTED, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none" }} />
            </Stack>
          </Stack>

          {/* ท้ายหัวการ์ด: ผู้รับผิดชอบ · ขั้นตอนถัดไป · เอกสาร (ตอนพับ — ตอนกางรายละเอียดมีครบอยู่แล้ว) */}
          {!open && (
            <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 1.25, pt: 1.1, borderTop: `1px dashed ${LINE}`, minWidth: 0 }}>
              {event.responsiblePerson
                ? <PersonChip name={event.responsiblePerson} avatar={avatarMap.get(event.responsiblePerson)} strong title={`ผู้รับผิดชอบ: ${event.responsiblePerson}`} />
                : <Typography component="span" sx={{ fontSize: "0.74rem", color: FAINT, fontWeight: 700, whiteSpace: "nowrap" }}>ยังไม่มอบหมายผู้รับผิดชอบ</Typography>}
              {nextStep && (
                <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.76rem", color: INK_2, fontWeight: 700 }}>
                  {/* สีสถานะเหลือแค่จุดเล็ก ตัวหนังสือโทนเดียวกับการ์ด (ไม่ใช้ตัวหนังสือสีเขียว/ส้ม/แดงปนกัน)
                      ✅ (10 ต.ค. 2569 ผู้ใช้: "คำว่าต่อไปให้ใช้คำใหม่ ดูแล้วงง" → เลือก "ไม่ต้องมีคำนำหน้า") */}
                  <Box component="span" sx={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", bgcolor: nextStep.tone || ACCENT, mr: 0.75, verticalAlign: "1px" }} />
                  {nextStep.title}
                </Typography>
              )}
              {!nextStep && <Box sx={{ flex: 1 }} />}
                {(event.reportFiles?.length > 0 || event.quotationFiles?.length > 0 || event.invoiceFiles?.length > 0 || event.completionFiles?.length > 0 || event.comments?.length > 0 || (isDesktop && (event.activityLog?.length > 0 || event.jobGroupId))) && (
                  <Stack direction="row" alignItems="center" gap={0.7}
                    divider={<Divider orientation="vertical" flexItem sx={{ height: 14, my: "auto" }} />}
                    sx={{ flexShrink: 0 }}>
                    {(event.reportFiles?.length > 0 || event.quotationFiles?.length > 0 || event.invoiceFiles?.length > 0 || event.completionFiles?.length > 0) && (
                      <Stack direction="row" alignItems="center" gap={0.5}>
                        {event.reportFiles?.length > 0     && <DocIndicator title={`Service Report: ${event.reportFiles.length} ไฟล์`}  icon={Description}         color="#3b82f6" count={event.reportFiles.length}     showCount={isDesktop} />}
                        {event.quotationFiles?.length > 0  && <DocIndicator title={`ใบเสนอราคา: ${event.quotationFiles.length} ไฟล์`} icon={RequestQuote}        color="#ef4444" count={event.quotationFiles.length}  showCount={isDesktop} />}
                        {event.invoiceFiles?.length > 0    && <DocIndicator title={`ใบวางบิล: ${event.invoiceFiles.length} ไฟล์`}    icon={ReceiptLong}         color="#f59e0b" count={event.invoiceFiles.length}    showCount={isDesktop} />}
                        {event.completionFiles?.length > 0 && <DocIndicator title={`ใบส่งมอบงาน: ${event.completionFiles.length} ไฟล์`} icon={AssignmentTurnedIn} color="#07941a" count={event.completionFiles.length} showCount={isDesktop} />}
                      </Stack>
                    )}
                    {(event.comments?.length > 0 || (isDesktop && (event.activityLog?.length > 0 || event.jobGroupId))) && (
                      <Stack direction="row" alignItems="center" gap={0.5}>
                        {event.activityLog?.length > 0 && isDesktop && (
                          <DocIndicator title={`${event.activityLog.length} กิจกรรม`} icon={History}
                            color="text.disabled" count={event.activityLog.length} showCount={isDesktop} />
                        )}
                        {event.comments?.length > 0 && (
                          <DocIndicator title={`${event.comments.length} ข้อความ`} icon={Chat}
                            color="text.disabled" count={event.comments.length} showCount={isDesktop} />
                        )}
                        {event.jobGroupId && isDesktop && (
                          <Tooltip title="งานนี้เป็นส่วนหนึ่งของงานหลายวัน (กลุ่มเดียวกัน)">
                            <LinkIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                          </Tooltip>
                        )}
                      </Stack>
                    )}
                  </Stack>
                )}

            </Stack>
          )}
        </Box>

        {/* เมนู "⋮" ของการ์ดงาน — ปุ่มลบ (เดิมโชว์เป็นไอคอนสีแดงตลอดเวลา) ย้ายมารวมที่นี่ */}
        <Menu {...FAST_MENU_PROPS} anchorEl={moreAnchorEl} open={Boolean(moreAnchorEl)} onClose={() => setMoreAnchorEl(null)}
          PaperProps={{ sx: { borderRadius: 2, boxShadow: "0 8px 32px rgba(0,0,0,0.12)" } }}>
          {/* ✅ ออกใบส่งมอบงาน — เฉพาะแอดมิน/manager (เป็นเอกสารที่ส่งออกไปหาลูกค้าในนามบริษัท
              และ backend ก็กันไว้อีกชั้นตอนขอเลขที่เอกสาร ดู routes/docNumber.js)
              ⚠️ ไม่บังคับว่าต้องปิดงานก่อนถึงจะออกได้ แต่ถ้ายังไม่เสร็จจะมีคำเตือนกำกับในเมนู —
              เพราะของจริงมีเคสที่ต้องส่งมอบเอกสารบางส่วนก่อนปิดงานทั้งก้อน (เช่น ส่งรายงานให้ตรวจ
              ก่อนแล้วค่อยปิด) ถ้าล็อกตายจะกลายเป็นทำงานไม่ได้ทั้งที่เป็นขั้นตอนปกติ */}
          {/* ✅ ใบแจ้งเข้างานมาก่อนใบส่งมอบงานในเมนู — เรียงตามลำดับเวลาที่ใช้จริง (แจ้งก่อนเข้า →
              ส่งมอบหลังเสร็จ) คนที่กวาดตาหาจะเจอใบที่ต้องใช้ตามจังหวะงานของตัวเองได้เร็วกว่าเรียงมั่ว */}
          {isAdminOrManager && (
            <MenuItem
              onClick={() => { setMoreAnchorEl(null); setWorkNoticeOpen(true); }}
              sx={{ gap: 1.5, minHeight: 44 }}
            >
              <ListItemIcon><EventAvailable fontSize="small" sx={{ color: "#0284c7" }} /></ListItemIcon>
              <ListItemText
                primary="ออกใบแจ้งเข้างาน"
                secondary={localStatus === "ดำเนินการเสร็จสิ้น" ? "งานนี้ปิดแล้ว — ปกติใบนี้ออกก่อนเข้างาน" : undefined}
                secondaryTypographyProps={{ fontSize: "0.7rem", color: "#b45309" }}
              />
            </MenuItem>
          )}
          {isAdminOrManager && (
            <MenuItem
              onClick={() => { setMoreAnchorEl(null); setDeliveryNoteOpen(true); }}
              sx={{ gap: 1.5, minHeight: 44 }}
            >
              <ListItemIcon><Description fontSize="small" sx={{ color: "#dc2626" }} /></ListItemIcon>
              <ListItemText
                primary="ออกใบส่งมอบงาน"
                secondary={localStatus === "ดำเนินการเสร็จสิ้น" ? undefined : "งานนี้ยังไม่ปิด — ออกได้แต่ตรวจวันที่ให้ดีก่อน"}
                secondaryTypographyProps={{ fontSize: "0.7rem", color: "#b45309" }}
              />
            </MenuItem>
          )}
          {isAdminOrManager && <Divider sx={{ my: 0.5 }} />}
          <MenuItem onClick={() => { setMoreAnchorEl(null); onDelete(event._id); }} sx={{ gap: 1.5, minHeight: 44, color: "error.main" }}>
            <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>ลบงานนี้</ListItemText>
          </MenuItem>
        </Menu>

        {/* ⚠️ mount เฉพาะตอนเปิดจริง — การ์ดงานมีเป็นร้อยใบในหน้าเดียว ถ้า mount Dialog ทิ้งไว้ทุกใบ
            จะเสียทั้งหน่วยความจำและเวลา render โดยไม่ได้ใช้เลยแม้แต่ใบเดียวในกรณีปกติ */}
        {deliveryNoteOpen && (
          <DeliveryNoteDialog
            open={deliveryNoteOpen}
            onClose={() => setDeliveryNoteOpen(false)}
            job={event}
          />
        )}
        {workNoticeOpen && (
          <WorkNoticeDialog
            open={workNoticeOpen}
            onClose={() => setWorkNoticeOpen(false)}
            job={event}
            canUseRunningNumber={isAdminOrManager}
          />
        )}

        {/* ── รายละเอียด (กางจากหัวการ์ด) ── */}
        <Collapse in={open} unmountOnExit>
          <Box onClick={(e) => e.stopPropagation()} sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${LINE}` }}>
            {/* ✅ (10 ต.ค. 2569 ผู้ใช้: "สีสันยังดูรกๆ ตัดกัน มองยาก แก้ไขให้มืออาชีพ")
                ข้อมูลทั้งหมดเป็นรายการ "ป้าย : ค่า" ชุดเดียว ไม่มีกล่องซ้อนกล่อง/พื้นสี — สีเหลือแค่ปุ่มกด (น้ำเงิน) กับเรื่องเตือน */}
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: MUTED, letterSpacing: ".03em", mb: 0.75 }}>ข้อมูลงาน</Typography>
                <Box sx={{ display: "grid", rowGap: 0.75, mb: 0.75 }}>
                  <InfoLine label="ผู้รับผิดชอบ">
                    <AssignableResponsible responsible={event.responsiblePerson} avatars={avatarMap} onAssign={canAssign ? setAssignAnchor : undefined} />
                  </InfoLine>
                  <InfoLine label="ผู้เข้าทำงาน">
                    {teamNamesOf(event).length ? (
                      <Box component="span" sx={{ display: "inline-flex", flexWrap: "wrap", gap: 0.5 }}>
                        {teamNamesOf(event).map((n, i, all) => (
                          <PersonChip key={n} name={n} avatar={avatarMap.get(n)} badge={i === 0 && all.length > 1 ? "หัวหน้า" : undefined}
                            title={i === 0 ? `หัวหน้าทีมเข้างาน: ${n}` : `ลูกทีม: ${n}`} />
                        ))}
                      </Box>
                    ) : <Box component="span" sx={{ color: FAINT }}>ยังไม่ระบุ</Box>}
                  </InfoLine>
                </Box>
                {canAssign && (
                  <AssignResponsibleMenu
                    anchorEl={assignAnchor} onClose={() => setAssignAnchor(null)}
                    employees={employee} value={event.responsiblePerson || ""}
                    onPick={(name) => { setAssignAnchor(null); onAssignResponsible(event, name); }}
                  />
                )}
                {/* ✅ จอกว้างจัดข้อมูลเป็น 2 คอลัมน์ จอแคบเรียงลงมาคอลัมน์เดียวเหมือนเดิม
                    🐛 ที่แก้: เดิมเรียงลงมาคอลัมน์เดียวทุกขนาดจอ — บนจอคอมการ์ดกว้างเต็มหน้า แต่เนื้อหา
                    เกาะอยู่ซ้ายมือแค่ ~30% ที่เหลือว่างเปล่า ทำให้การ์ดสูงเกินจำเป็น เห็นงานได้ทีละไม่กี่
                    รายการต้องเลื่อนตลอด และ "หน้าตาเหมือนจอมือถือที่ถูกยืดออก" ตามที่ผู้ใช้บอก
                    ⚠️ minmax(0,1fr) ไม่ใช่ 1fr — ไม่งั้นข้อความยาว (ชื่อโครงการ/รายชื่อทีม) จะดัน
                    คอลัมน์ให้กว้างเกินแล้วตกขอบการ์ด แทนที่จะตัดด้วย ellipsis */}
                <Box
                  sx={{
                    mt: 0.6,
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "minmax(0,1fr) minmax(0,1fr)" },
                    columnGap: 2.5,
                    rowGap: 0.35,
                    alignItems: "start",
                  }}
                >
                  {event.system && <InfoLine label="ระบบ">{event.system}</InfoLine>}
                  {/* ชื่อโครงการเป็นตัวที่ใช้ระบุงานมากที่สุด ให้กินเต็มความกว้างเสมอ ไม่ต้องตัดคำ
                      ✅ ชื่อโครงการ = ลิงก์แผนที่ในตัว (ผู้ใช้ขอ: "ให้กดผ่านชื่อโครงการเลย และไม่ต้องมีแก้ไข
                      แบบนี้ดูรก") — เดิมมีกล่อง "ค้นหาตำแหน่งใน Maps" เต็มความกว้าง + ปุ่มดินสอแยกอีกปุ่ม
                      วางคั่นกลางการ์ด กินที่เท่าข้อมูลจริง 2 บรรทัดต่อการ์ด พอลิสต์มีหลายงานเลยเห็นแต่กล่อง
                      ⚠️ ที่ผูกกับชื่อโครงการได้พอดีเพราะพิกัดถูกเก็บ "ต่อโครงการ" (ไม่ใช่ต่องาน) ชื่อที่กด
                      จึงตรงกับสิ่งที่จะเปิดเป๊ะ ไม่ต้องมีป้ายอธิบายเพิ่ม
                      ⚠️ การแก้พิกัดยังทำได้ที่ฟอร์มแก้ไขงานและหน้าภาพรวมสัญญาเหมือนเดิม — ตัดออกเฉพาะ
                      หน้านี้ซึ่งเป็นหน้า "ดูงาน/นำทาง" ไม่ใช่หน้าตั้งค่าข้อมูลโครงการ */}
                  <Box sx={{ gridColumn: { md: "1 / -1" } }}>
                    <InfoLine label="โครงการ">
                      <Box
                        component="a"
                        href={mapHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        // การ์ดทั้งใบกดเพื่อกาง/ยุบ — ถ้าไม่กั้นไว้ กดลิงก์ทีการ์ดจะกางตามไปด้วยทุกครั้ง
                        onClick={(e) => e.stopPropagation()}
                        title={hasSiteMap
                          ? "เปิดแผนที่นำทางไปหน้างาน"
                          : "ยังไม่มีพิกัดบันทึกไว้ — เปิดค้นหาชื่อโครงการใน Google Maps"}
                        sx={{
                          color: "inherit",
                          textDecoration: "none",
                          // เส้นใต้ประ = บอกว่ากดได้โดยไม่ต้องทำให้เป็นสีลิงก์ทั้งบรรทัด (ชื่อโครงการยังต้อง
                          // อ่านเป็นข้อมูลของการ์ดอยู่ ไม่ใช่กลายเป็นปุ่ม)
                          borderBottom: "1px dashed",
                          borderColor: "divider",
                          "&:hover": { color: "primary.main", borderColor: "primary.main" },
                        }}
                      >
                        {companySite(event.company, event.site)}
                        {/* หมุดแดงตัวเดียวกับทุกหน้า — บอกว่าชื่อนี้กดแล้วไป Google Maps (เดิมเป็นอีโมจิ
                            📍/🔍 ซึ่งสื่อได้แค่ "ตำแหน่ง/ค้นหา" ไม่ได้บอกว่าเป็นบริการไหน) */}
                        <Box
                          component="span"
                          sx={{ ml: 0.5, display: "inline-flex", verticalAlign: "-2px" }}
                        >
                          <GoogleMapsPin size={13} />
                        </Box>
                      </Box>
                    </InfoLine>
                  </Box>
                  {/* ✅ ผู้ติดต่อหน้างาน — วางถัดจากโครงการทันที เพราะเป็นข้อมูล "ไปถึงแล้วโทรหาใคร"
                      ที่ต้องอ่านคู่กับ "ไปที่ไหน" เสมอ ⚠️ เบอร์กดโทรออกได้เลย (TelLink) ซึ่งเป็นเหตุผล
                      หลักที่ต้องมีในหน้านี้ — ช่างเปิดจากมือถือตอนกำลังจะออกรถ/ถึงหน้างาน
                      ⚠️ ซ่อนทั้งบรรทัดถ้ายังไม่มีข้อมูล ไม่โชว์เป็นช่องว่าง — การ์ดนี้เรียงกันหลายสิบใบ
                      ในหน้าเดียว บรรทัดว่างทุกใบจะกินพื้นที่มากกว่าข้อมูลจริงที่มีอยู่ */}
                  {(event.contactName || event.contactTel) && (
                    <InfoLine label="ผู้ติดต่อ">
                      <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
                        {event.contactName && <span>{event.contactName}</span>}
                        {event.contactTel && <TelLink tel={event.contactTel} />}
                      </Stack>
                    </InfoLine>
                  )}
                  {/* ✅ ย้ายมาไว้ถัดจากโครงการตามที่ขอ (เดิมอยู่คู่กับระบบด้านบนสุด) */}
                  {event.time && <InfoLine label="ครั้งที่">{formatRoundLabel(event.time, event.visitCount, event)}</InfoLine>}
                  {(event.startTime || event.endTime) && (
                    <InfoLine label="เวลา">{event.startTime || "-"} — {event.endTime || "-"}</InfoLine>
                  )}
                  {/* ✅ ถ้ายังไม่มีเลขเอกสาร ซ่อนช่อง "ใส่เลขที่เอกสาร" ไว้ตอนพับการ์ด — เดิมโชว์ทุกการ์ด
                      ในลิสต์ตลอดเวลาแม้ยังไม่มีข้อมูล ดูรกเวลามีงานหลายรายการ ให้กดขยายก่อนค่อยใส่ */}
                  {(event.docNo || open) && (
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
                          <Description sx={{ fontSize: 13, mr: 0.4, verticalAlign: "-2px" }} />
                          เอกสาร :
                        </Typography>
                        <Typography variant="caption" color={event.docNo ? "text.secondary" : "text.disabled"} sx={{ minWidth: 0, "&:hover": canEdit ? { color: "primary.main", textDecoration: "underline" } : {} }}>
                          {event.docNo || "ใส่เลขที่เอกสาร"}
                        </Typography>
                      </Stack>
                    )
                  )}
                </Box>
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

          {/* ✅ ขั้นตอนทำงาน: สถานะรับงาน · รอข้อมูล · อุปกรณ์ · งานไม่เสร็จ (ปุ่ม "จัดการแล้ว") */}
          {!hideDocuments && <JobFlowPanel event={event} mode="admin" onPatched={onPatched} onStatusUpdate={onStatusUpdate} />}

          {/* ✅ (10 ต.ค. 2569) รูปและไฟล์หน้างานที่ช่างแนบ — แอดมินดู/เพิ่ม/ลบได้ */}
          <SitePhotos event={event} canEdit={canEdit} onPreview={onPreview} sx={{ mt: 2, p: 0, border: 0, borderRadius: 0 }} />

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


            {/* เอกสาร/คุยกับช่าง/ประวัติ — แผงด้านข้างแสดงต่อท้ายเลย · การ์ดในรายการเปิดเป็นกล่อง */}
            {inlineDetails ? (
              <Box sx={{ mt: 2, pt: 1.5, borderTop: `1px solid ${LINE}` }}>{expandedContent}</Box>
            ) : (
              <ButtonBase onClick={() => setExpanded(true)}
                sx={{ mt: 2, width: "100%", px: 1.5, py: 1.1, gap: 1.25, borderRadius: 2, border: `1px solid ${LINE}`, bgcolor: "#fff",
                  justifyContent: "flex-start", fontFamily: "inherit", "&:hover": { bgcolor: SURFACE, borderColor: "#cbd5e1" } }}>
                <Description sx={{ fontSize: 19, color: MUTED }} />
                <Typography noWrap sx={{ flex: 1, minWidth: 0, textAlign: "left", fontSize: "0.86rem", fontWeight: 700, color: INK }}>
                  เอกสาร · คุยกับช่าง · ประวัติ
                </Typography>
                <Typography component="span" sx={{ flexShrink: 0, fontSize: "0.74rem", fontWeight: 700, color: MUTED, fontVariantNumeric: "tabular-nums" }}>
                  เอกสาร {docDone}/{JOB_DOC_TYPES.length}
                </Typography>
                <ChevronRight sx={{ fontSize: 20, color: FAINT }} />
              </ButtonBase>
            )}
          </Box>
        </Collapse>

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

      {!inlineDetails && (
      <Dialog open={expanded} onClose={() => setExpanded(false)} fullWidth maxWidth="md" fullScreen={!isDesktop}
        PaperProps={{ sx: { borderRadius: { xs: 0, sm: 3 } } }}>
          {/* ✅ หัวกระชับแบบเดียวกับฝั่งช่าง: ประเภทงาน · โครงการ/ระบบ/ครั้งที่ บรรทัดเดียว · ผู้ติดต่อ · สถานะ+วันที่ */}
          <Box sx={{ px: { xs: 2, sm: 2.5 }, pt: 2, pb: 1.5, borderBottom: `1px solid ${LINE}` }}>
            <Stack direction="row" alignItems="flex-start" gap={1}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: MUTED, letterSpacing: 0.2 }}>
                  รายละเอียดงาน
                </Typography>
                <Typography noWrap sx={{ fontWeight: 800, fontSize: "1.05rem", color: INK, lineHeight: 1.35 }}>
                  {event.title || "ไม่ระบุประเภทงาน"}
                </Typography>
                {(() => {
                  const place = [companySite(event.company, event.site), event.system,
                    event.time ? `ครั้งที่ ${formatRoundLabel(event.time, event.visitCount, event)}` : ""].filter(Boolean).join(" · ");
                  return place ? <Typography sx={{ fontSize: "0.82rem", color: INK_2, mt: 0.25 }}>{place}</Typography> : null;
                })()}
                <Stack direction="row" alignItems="center" gap={1.25} flexWrap="wrap" sx={{ mt: 0.75 }}>
                  <Box component="span" sx={{
                    display: "inline-flex", alignItems: "center", gap: 0.6, height: 24, px: 1, borderRadius: 999,
                    bgcolor: SURFACE, border: `1px solid ${LINE}`, color: INK_2, fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap",
                  }}>
                    <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: OP_COLOR[event.status] || FAINT }} />
                    {event.status || "ไม่ระบุสถานะ"}
                  </Box>
                  <Typography sx={{ fontSize: "0.76rem", color: MUTED, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 0.4 }}>
                    <CalendarMonth sx={{ fontSize: 14, color: FAINT }} />{formatEventDateRange(event)}
                  </Typography>
                  {(event.contactName || event.contactTel) && (
                    <Stack direction="row" alignItems="center" gap={0.6} sx={{ fontSize: "0.78rem", color: INK_2 }}>
                      <Person sx={{ fontSize: 15, color: FAINT }} />
                      {event.contactName && <span>{event.contactName}</span>}
                      {event.contactTel && <TelLink tel={event.contactTel} />}
                    </Stack>
                  )}
                </Stack>
              </Box>
              <IconButton size="small" onClick={() => setExpanded(false)} aria-label="ปิด" sx={{ color: MUTED, mr: -0.5 }}>
                <Close fontSize="small" />
              </IconButton>
            </Stack>
          </Box>
          <DialogContent sx={{ bgcolor: SURFACE, px: { xs: 1.5, sm: 2.5 }, py: 2 }}>
            {expandedContent}
          </DialogContent>
        </Dialog>
      )}
    </Wrapper>
  );
};

// ─── FilterPanel ──────────────────────────────────────────────────────
const FilterPanel = ({
  search, onSearch, filterType, onFilterType, filterSystem, onFilterSystem,
  filterStatus, onFilterStatus, filterOP, onFilterOP, filterTeam, onFilterTeam,
  showAll, onToggleShowAll, selectedDate, onDateChange, onClearAll, activeCount,
  typeOptions, systemOptions, inSheet = false,
}) => {
  const [open, setOpen] = useState(false);
  // ✅ จอคอม/จอใหญ่ แสดงช่องเลือกตัวกรองตลอด (ผู้ใช้ขอ) — พื้นที่พอ ไม่ต้องกดเปิดก่อน · มือถือยังพับเก็บได้เหมือนเดิม
  const isWide = useMediaQuery("(min-width:900px)");

  // ✅ รายการตัวกรองที่เปิดอยู่ตอนนี้ — ใช้ทั้งโชว์เป็นชิปถอดได้ และเป็นแหล่งความจริงเดียว
  // ว่า "กำลังกรองอะไรอยู่บ้าง" (เดิมกระจายอยู่ตามชิปแต่ละกลุ่มซึ่งเห็นได้ต่อเมื่อกางแผงเท่านั้น)
  const activeFilters = [
    filterOP && { key: "op", label: "สถานะ", value: filterOP, color: OP_COLOR[filterOP], clear: () => onFilterOP("") },
    filterType && { key: "type", label: "ประเภท", value: filterType, clear: () => onFilterType("") },
    filterSystem && { key: "system", label: "ระบบ", value: filterSystem, clear: () => onFilterSystem("") },
    filterStatus && { key: "billing", label: "การเงิน", value: filterStatus, clear: () => onFilterStatus("") },
    filterTeam && { key: "team", label: "ทีม", value: filterTeam, clear: () => onFilterTeam("") },
    search && { key: "search", label: "ค้นหา", value: search, clear: () => onSearch("") },
  ].filter(Boolean);

  // ✅ ช่องตัวกรองชุดเดียว — จอใหญ่วางในแถวเดียวกับช่องค้นหา (ผู้ใช้ขอ "ให้เหลือแถวเดียว") · มือถืออยู่ในแผงพับ
  const filterSelects = (
    <>
            <TextField
              select size="small" label="สถานะงาน" value={filterOP}
              onChange={(e) => onFilterOP(e.target.value)}
              sx={SELECT_FIELD_SX} SelectProps={{ MenuProps: SELECT_MENU_PROPS }}
            >
              <MenuItem value=""><em>ทั้งหมด</em></MenuItem>
              {OP_LIST.map((op) => (
                <MenuItem key={op} value={op}>
                  <Stack direction="row" alignItems="center" gap={1}>
                    <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: OP_COLOR[op], flexShrink: 0 }} />
                    {op}
                  </Stack>
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select size="small" label="ประเภทงาน" value={filterType}
              onChange={(e) => onFilterType(e.target.value)}
              sx={SELECT_FIELD_SX} SelectProps={{ MenuProps: SELECT_MENU_PROPS }}
            >
              <MenuItem value=""><em>ทั้งหมด</em></MenuItem>
              {typeOptions.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>

            <TextField
              select size="small" label="ระบบ" value={filterSystem}
              onChange={(e) => onFilterSystem(e.target.value)}
              sx={SELECT_FIELD_SX} SelectProps={{ MenuProps: SELECT_MENU_PROPS }}
            >
              <MenuItem value=""><em>ทั้งหมด</em></MenuItem>
              {systemOptions.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
    </>
  );
  // ✅ มือถือ: อยู่ในแผ่นล่าง (เปิดจากปุ่มบนหัวเพจ) — ช่องค้นหา · เดือน · ช่องเลือก เรียงแนวตั้งเต็มความกว้าง
  if (inSheet) {
    return (
      <Stack gap={1.5}>
        <TextField
          placeholder="ค้นหา บริษัท, ไซต์, เลขเอกสาร..." size="small" value={search} fullWidth
          onChange={(e) => onSearch(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18, color: "text.disabled" }} /></InputAdornment>,
            endAdornment: search ? (
              <InputAdornment position="end"><IconButton size="small" onClick={() => onSearch("")}><Clear fontSize="small" /></IconButton></InputAdornment>
            ) : null,
            sx: { borderRadius: 2.5, bgcolor: "#f8fafc" },
          }}
        />
        <Stack direction="row" gap={1} alignItems="center">
          <Button size="small" variant={showAll ? "contained" : "outlined"} onClick={() => onToggleShowAll(true)}
            sx={{ flex: 1, borderRadius: 2.5, textTransform: "none", fontWeight: 700, height: 40, boxShadow: "none" }}>
            ทุกเดือน
          </Button>
          {showAll ? (
            <Button size="small" variant="outlined"
              onClick={() => { onToggleShowAll(false); onDateChange(moment().format("YYYY-MM")); }}
              sx={{ flex: 1, borderRadius: 2.5, textTransform: "none", fontWeight: 700, height: 40, boxShadow: "none" }}>
              เลือกเดือน
            </Button>
          ) : (
            <Box sx={{ flex: 1 }}>
              <ThaiDatePicker
                views={["year", "month"]} openTo="month" label="เดือน"
                valueFormat="YYYY-MM" inputFormat="MM/YYYY"
                value={selectedDate || ""}
                onChange={(v) => { if (v) onDateChange(v); }}
                textFieldProps={{ sx: { "& .MuiOutlinedInput-root": { borderRadius: 2.5 } } }}
              />
            </Box>
          )}
        </Stack>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr", gap: 1.5 }}>{filterSelects}</Box>
      </Stack>
    );
  }

  return (
    <GlassCard sx={{ mb: { xs: 2, sm: 3 } }}>
      <CardContent sx={{ p: { xs: 1.5, sm: 2.5 }, "&:last-child": { pb: { xs: 1.5, sm: 2.5 } } }}>
        <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
          <TextField
            placeholder="ค้นหา บริษัท, ไซต์, เลขเอกสาร..."
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
            sx={{ flex: 1, minWidth: isWide ? 180 : 220 }}
          />
          {isWide && (
            <Stack direction="row" gap={1} sx={{ flexShrink: 1, minWidth: 0, "& > .MuiTextField-root": { width: 150, flexShrink: 1, minWidth: 110 } }}>
              {filterSelects}
            </Stack>
          )}
          <Stack direction="row" gap={1} alignItems="center">
            <Button size="small" variant={showAll ? "contained" : "outlined"}
              onClick={() => onToggleShowAll(true)}
              sx={{ borderRadius: 2.5, textTransform: "none", fontSize: "0.82rem", fontWeight: 700, height: 40, px: 1.75, boxShadow: "none" }}>
              ทั้งหมด
            </Button>
            {/* ✅ ตัวเลือกเดือน — ใช้ ThaiDatePicker เหมือนกันทั้งแอป ปีจึงเป็น พ.ศ. ตรงกับที่อื่น
                (เดิมเป็น DatePicker ดิบ + AdapterMoment ธรรมดา ขึ้นเป็น ค.ศ. อยู่จุดเดียวในหน้านี้)
                ⚠️ ช่องนี้เก็บค่าเป็น "YYYY-MM" (ระดับเดือน) จึงต้องส่ง valueFormat/inputFormat เอง —
                ค่าเริ่มต้นของ ThaiDatePicker เป็นระดับวัน (YYYY-MM-DD / วว/ดด/ปปปป) */}
            {!showAll && (
              <ThaiDatePicker
                views={["year", "month"]} openTo="month" label="เดือน"
                valueFormat="YYYY-MM" inputFormat="MM/YYYY"
                value={selectedDate || ""}
                onChange={(v) => { if (v) onDateChange(v); }}
                fullWidth={false}
                textFieldProps={{ sx: { width: 160, "& .MuiOutlinedInput-root": { borderRadius: 2 } } }}
              />
            )}
            {showAll && (
              <Button size="small" variant="outlined"
                onClick={() => { onToggleShowAll(false); onDateChange(moment().format("YYYY-MM")); }}
                sx={{ borderRadius: 2.5, textTransform: "none", fontSize: "0.82rem", fontWeight: 700, height: 40, px: 1.75, boxShadow: "none" }}>
                เลือกเดือน
              </Button>
            )}
          </Stack>
          {!isWide && (
          <Badge badgeContent={activeCount} color="error" invisible={activeCount === 0}>
            <Button size="small" variant="outlined" startIcon={<FilterList />}
              onClick={() => setOpen(p => !p)}
              sx={{ borderRadius: 2, textTransform: "none" }}>
              ตัวกรอง
            </Button>
          </Badge>
          )}
          {activeCount > 0 && (
            <Tooltip title="ล้างตัวกรองทั้งหมด">
              <IconButton size="small" onClick={onClearAll} color="error"><Clear fontSize="small" /></IconButton>
            </Tooltip>
          )}
        </Stack>
        <Collapse in={open && !isWide}>
          <Divider sx={{ my: 2 }} />
          {/* 🐛 ที่แก้: เดิมกางชิปทุกตัวเลือกออกมาทั้งหมด 4 กลุ่ม (23 ชิป) กินพื้นที่แนวตั้ง ~300px
              ดันรายการงานตกจอไปเลย และต้องกวาดตาหาทีละชิปว่าตัวไหนคือตัวที่ต้องการ
              ✅ ทั้ง 4 ตัวกรองเป็นแบบ "เลือกได้ทีละอัน" อยู่แล้ว (กดซ้ำ = ยกเลิก) จึงเป็น dropdown
              ได้ตรงๆ — เหลือแถวเดียว ~56px และหาตัวเลือกได้จากรายการที่เรียงไว้แทนการกวาดตา
              ⚠️ คงสีประจำสถานะไว้เป็นจุดสีหน้าตัวเลือก เพราะสีคือข้อมูล (คนใช้จำสถานะจากสีอยู่แล้ว)
              ไม่ใช่แค่การตกแต่ง */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(3, 1fr)" },
              gap: 1.5,
            }}
          >
            {filterSelects}
          </Box>
        </Collapse>

        {/* ✅ ตัวกรองที่เปิดอยู่ โชว์เป็นชิปถอดได้ "นอกแผงที่พับได้" — เห็นตลอดแม้พับตัวกรองไปแล้ว
            🐛 เดิมพอพับแผงลง จะไม่มีทางรู้เลยว่ากำลังกรองอะไรอยู่ (รู้แค่ตัวเลขบน badge ว่ามีกี่ตัว)
            ทำให้เจอบ่อยว่า "ทำไมงานหาย" ทั้งที่จริงมีตัวกรองค้างอยู่จากครั้งก่อน */}
        {activeFilters.length > 0 && (
          <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap" sx={{ mt: 1.5 }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ flexShrink: 0 }}>
              กรองอยู่:
            </Typography>
            {activeFilters.map((f) => (
              <Chip
                key={f.key} size="small" label={`${f.label}: ${f.value}`} onDelete={f.clear}
                sx={{
                  height: 24, fontWeight: 700, fontSize: "0.72rem",
                  bgcolor: alpha(f.color || "#0f172a", 0.1), color: f.color || "#334155",
                  "& .MuiChip-deleteIcon": { fontSize: 15, color: "inherit", opacity: 0.7, "&:hover": { opacity: 1 } },
                }}
              />
            ))}
            <Button size="small" onClick={onClearAll}
              sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.72rem", minWidth: 0, px: 1 }}>
              ล้างทั้งหมด
            </Button>
          </Stack>
        )}
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
    <Dialog open={Boolean(previewUrl)} onClose={onClose} maxWidth="xl" fullWidth fullScreen={window.matchMedia?.("(max-width:600px)").matches}
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
            <PdfBlobView url={pdfBlobUrl} />
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
const OperationTable = ({ jobGroups, daysPastDueMap, onOpenJob, employee, canAssign, onAssignResponsible }) => {
  const avatarMap = useAvatarMap(employee);
  const [assign, setAssign] = useState(null); // { anchor, job } | null
  return (
  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3, overflowX: "auto" }}>
    <Table size="small" sx={{ minWidth: 1000, width: "100%" }}>
      <TableHead>
        {/* ⚠️ เดิมหัวตารางเป็นสีม่วง (#f5f3ff/#4c1d95) ซึ่งไม่มีที่ไหนในแอปใช้สีนี้เลย — ดูเหมือน
            คอมโพเนนต์ที่ยกมาจากที่อื่นแล้วลืมปรับสี เปลี่ยนเป็นเทาเข้มกลางๆ ให้เข้าชุดกับหัวตาราง
            ที่อื่นในระบบ และไม่ไปแย่งสายตากับสีสถานะในแต่ละแถวซึ่งเป็นข้อมูลจริงที่ต้องอ่าน */}
        <TableRow sx={{ "& th": { fontWeight: 800, fontSize: "0.72rem", bgcolor: "#f1f5f9", color: "#334155", whiteSpace: "nowrap", letterSpacing: 0.2 } }}>
          <TableCell>สถานะ</TableCell>
          <TableCell>โครงการ / บริษัท</TableCell>
          {/* ✅ ผู้ติดต่อหน้างาน — วางถัดจากโครงการ อ่านเป็นชุดเดียวกันว่า "ไปที่ไหน แล้วโทรหาใคร" */}
          <TableCell>ผู้ติดต่อ</TableCell>
          <TableCell>ประเภทงาน · ระบบ</TableCell>
          {/* ✅ เพิ่มคอลัมน์ "ครั้งที่" — การ์ดแสดงอยู่แล้วแต่ตารางไม่มี ทำให้สลับมาดูตารางแล้วข้อมูลหาย
              เป็นตัวเลขที่จำเป็นกับงานสัญญา (รู้ว่าเข้าไปแล้วกี่ครั้งจากทั้งหมดกี่ครั้ง) */}
          <TableCell align="center">ครั้งที่</TableCell>
          <TableCell>วันที่เข้างาน</TableCell>
          <TableCell>ผู้รับผิดชอบ</TableCell>
          <TableCell>ผู้เข้าทำงาน</TableCell>
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
          // ⚠️ ตัดชื่อซ้ำออก — หัวหน้าทีม (team) มักถูกใส่ไว้ใน teamMembers ด้วย ทำให้ขึ้นเป็น
          // "Santisuk, Santisuk" เหมือนมี 2 คนทั้งที่เป็นคนเดียว (เห็นชัดขึ้นหลังชื่อทุกที่ใช้ชื่อต้นเหมือนกันแล้ว)
          const teamNames = teamNamesOf(a);
          return (
            <TableRow key={a._id} hover onClick={() => onOpenJob(job)}
              sx={{ cursor: "pointer", bgcolor: idx % 2 ? alpha("#0f172a", 0.02) : "transparent" }}>
              <TableCell sx={{ whiteSpace: "nowrap" }}>
                <StatusBadge color={OP_COLOR[a.status]}><Circle sx={{ fontSize: 6 }} />{a.status || "—"}</StatusBadge>
                <JobFlowFlags event={a} />
              </TableCell>
              <TableCell sx={{ maxWidth: 220 }}>
                {/* ✅ โครงการเป็นบรรทัดหลัก (มีค่าเสมอ) บริษัทเป็นบรรทัดรอง — เดิมบริษัทขึ้นก่อน งานที่ไม่ได้กรอกบริษัทจึงขึ้น "-" ตัวหนา */}
                <Typography variant="caption" fontWeight={700} noWrap sx={{ display: "block", fontSize: "0.8rem" }}>{a.site || "-"}</Typography>
                <Typography variant="caption" color={a.company ? "text.secondary" : "text.disabled"} noWrap sx={{ display: "block" }}>{a.company || "ไม่ระบุบริษัท"}</Typography>
                {a.jobNo && <Typography variant="caption" noWrap sx={{ display: "block", color: "#94a3b8", fontSize: "0.68rem", fontWeight: 700 }}>{a.jobNo}</Typography>}
              </TableCell>
              {/* ⚠️ หยุด event ไม่ให้ลอยขึ้นไปที่ onClick ของทั้งแถว (ซึ่งเปิดกล่องรายละเอียดงาน) —
                  TelLink หยุดให้อยู่แล้ว แต่พื้นที่ว่างรอบๆ ในเซลล์ยังคลิกทะลุได้ */}
              <TableCell sx={{ maxWidth: 160 }}>
                {(a.contactName || a.contactTel) ? (
                  <>
                    <Typography variant="caption" fontWeight={700} noWrap sx={{ display: "block" }}>
                      {a.contactName || "-"}
                    </Typography>
                    {a.contactTel && <TelLink tel={a.contactTel} size="0.72rem" />}
                  </>
                ) : (
                  <Typography variant="caption" color="text.disabled">—</Typography>
                )}
              </TableCell>
              <TableCell sx={{ maxWidth: 170 }}>
                <Typography variant="caption" noWrap sx={{ display: "block" }}>{a.title || "-"}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>{a.system || "-"}</Typography>
              </TableCell>
              <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                {a.time ? (
                  <Typography variant="caption" fontWeight={700}>{formatRoundLabel(a.time, a.visitCount, a)}</Typography>
                ) : (
                  <Typography variant="caption" color="text.disabled">-</Typography>
                )}
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
              <TableCell sx={{ maxWidth: 170 }} onClick={canAssign ? (e) => e.stopPropagation() : undefined}>
                <AssignableResponsible
                  responsible={a.responsiblePerson} avatars={avatarMap}
                  onAssign={canAssign ? (anchor) => setAssign({ anchor, job: a }) : undefined}
                />
              </TableCell>
              <TableCell sx={{ maxWidth: 240 }}>
                {teamNames.length > 0 ? (
                  <Stack direction="row" gap={0.5} flexWrap="wrap">
                    {teamNames.slice(0, 3).map((n, i) => (
                      <PersonChip key={n} name={n} avatar={avatarMap.get(n)} size={20} badge={i === 0 && teamNames.length > 1 ? "หัวหน้า" : undefined} />
                    ))}
                    {teamNames.length > 3 && (
                      <Typography variant="caption" sx={{ alignSelf: "center", fontWeight: 700, color: "text.secondary" }} title={teamNames.slice(3).join(", ")}>
                        +{teamNames.length - 3}
                      </Typography>
                    )}
                  </Stack>
                ) : <Typography variant="caption" color="text.disabled">ยังไม่ระบุ</Typography>}
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
    {canAssign && (
      <AssignResponsibleMenu
        anchorEl={assign?.anchor || null} onClose={() => setAssign(null)}
        employees={employee} value={assign?.job?.responsiblePerson || ""}
        onPick={(name) => { const job = assign?.job; setAssign(null); if (job) onAssignResponsible(job, name); }}
      />
    )}
  </TableContainer>
  );
};

// ─── JobGroupBlock ──────────────────────────────────────────────────────
// การ์ดรวมสำหรับงานที่เข้าหลายวันไม่ติดกัน (ผูกกันด้วย jobGroupId/signature เดียวกัน)
// โชว์ช่วงวันที่รวมทั้งหมด (เริ่ม–สิ้นสุด) ในหัวการ์ดเดียว + ยุบ/ขยายเพื่อซ่อนการ์ดรายวัน
// ลดความรกเวลามีหลายวัน แต่ยังกดขยายดู/จัดการแต่ละวันแยกกันได้ตามเดิม
// ═══════════════════════════════════════════════════════════════════════
const JobGroupBlock = ({ sessions, currentUser, ...cardProps }) => {
  const [expanded, setExpanded] = useState(Boolean(cardProps.defaultExpanded));
  const isGrouped = sessions.length > 1;

  // ✅ งานกลุ่มเดียวกันใช้เอกสาร (Service Report/ใบเสนอราคา/ใบวางบิล/ใบส่งมอบงาน) และ "ขอปิดงาน"
  // ร่วมกันชุดเดียว แทนที่จะให้อัปโหลด/ขอปิดซ้ำทุกวัน — ยึดวันล่าสุด (sessions[0]) เป็น "การ์ดหลัก"
  // ที่ถือเอกสาร/คำขอปิดงานของทั้งกลุ่ม ส่วนวันอื่นๆ ซ่อนส่วนนี้ไป เหลือแค่สรุปงาน/คุยกับอีกฝั่ง/ประวัติ
  const anchorId = sessions[0]._id;

  const renderCard = (event) => {
    const hideDocuments = isGrouped && event._id !== anchorId;
    return isRole(currentUser, ...TECHNICIAN_ROLES) ? (
      <TechnicianJobCard key={event._id} event={event} {...cardProps} isTechnicianView={true} hideDocuments={hideDocuments} noOuterCard={isGrouped} />
    ) : (
      <EventRowCard key={event._id} event={event} {...cardProps} currentUser={currentUser} hideDocuments={hideDocuments} noOuterCard={isGrouped} />
    );
  };

  if (!isGrouped) return renderCard(sessions[0]);

  const head = sessions[0];
  const sortedByStart = sessions.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
  const latestEndSession = sessions.reduce((latest, s) =>
    new Date(s.end || s.start) > new Date(latest.end || latest.start) ? s : latest
  );
  const rangeStart = moment(sortedByStart[0].start).locale("th").format("DD MMM");
  const rangeEnd = formatThai(
    moment(latestEndSession.end || latestEndSession.start)
      .subtract(latestEndSession.allDay ? 1 : 0, "days"),
    "DD MMM YYYY",
  );

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
  // ✅ หัวการ์ดงานหลายช่วงวัน — ตัวกลางชุดเดียวกับหน้างานของฉัน (shared/ui/MultiDayGroup)
  return (
    <GlassCard sx={multiDayCardSx(OP_COLOR[head.status] || "#94a3b8")}>
      <MultiDayGroupHeader sessions={sessions} anchorId={anchorId} expanded={expanded} onToggle={() => setExpanded((p) => !p)}
        title={`${companySite(head.company, head.site)} — ${head.title || ""}${head.system ? ` · ${head.system}` : ""}${head.time ? ` ครั้งที่ ${formatRoundLabel(head.time, head.visitCount, head)}` : ""}`} />

      {/* ✅ (10 ต.ค. 2569 ผู้ใช้: "ทำกรอบแบ่งงานกันให้ชัดเจนกว่านี้หน่อย มองแยกยาก")
          เดิมแต่ละช่วงวันคั่นด้วยเส้นบางเส้นเดียว ข้อมูลไหลต่อกันจนแยกไม่ออกว่าจบช่วงไหน
          ✅ ตอนนี้แต่ละช่วงเป็นกรอบขาวของตัวเอง วางบนพื้นเทาอ่อน + แถบหัว "ช่วงที่ n/N · วันที่" */}
      <Collapse in={expanded}>
        <Stack spacing={1.25} sx={{ p: { xs: 1, sm: 1.5 }, pt: { xs: 1.25, sm: 1.5 }, bgcolor: SURFACE, borderRadius: "0 0 16px 16px" }}>
          {sessions.map((event, i) => {
            const order = sortedByStart.findIndex((x) => x._id === event._id) + 1;
            return (
              <Box key={event._id} sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, overflow: "hidden", boxShadow: "0 1px 2px rgba(15,23,42,.05)" }}>
                <Stack direction="row" alignItems="center" gap={1} sx={{ px: 2, py: 0.85, bgcolor: "#f8fafc", borderBottom: `1px solid ${LINE}` }}>
                  <Typography sx={{ fontSize: "0.74rem", fontWeight: 900, color: INK_2, whiteSpace: "nowrap" }}>
                    ช่วงที่ {order}/{sessions.length}
                  </Typography>
                  <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.74rem", fontWeight: 600, color: MUTED }}>
                    {formatEventDateRange(event)}
                  </Typography>
                  {event._id === anchorId && (
                    <Box component="span" sx={{ flexShrink: 0, px: 0.9, py: 0.15, borderRadius: 99, fontSize: "0.66rem", fontWeight: 800, color: ACCENT, bgcolor: ACCENT_SOFT, border: `1px solid ${ACCENT_LINE}` }}>
                      ถือเอกสาร/ขอปิดงาน
                    </Box>
                  )}
                </Stack>
                {renderCard(event)}
              </Box>
            );
          })}
        </Stack>
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
  // ✅ สลับมุมมองการ์ด/ตาราง — จำค่าไว้ข้ามการเปิดหน้า (แต่ละคนถนัดคนละแบบและมักใช้แบบเดิมตลอด)
  // เทียบ pattern เดียวกับหน้า "ติดตามใบเสนอราคา"
  // 🐛 ที่แก้ (อาการ: "หน้าจอคอมดูเหมือนจอมือถือ / เทอะทะ / ไม่เหมือนเว็บจัดการงานทั่วไป"):
  // เดิมค่าเริ่มต้นเป็น "การ์ด" ทุกขนาดจอ — การ์ดออกแบบมาสำหรับจอแคบ (ข้อมูลเรียงลงมาเป็นบรรทัด
  // อ่านทีละใบ) พอเอามาวางบนจอคอมกว้าง 1400px เนื้อหาเกาะอยู่ซ้ายมือ ~25% ที่เหลือว่างเปล่า และ
  // เห็นงานได้ทีละ 3-4 รายการต่อหนึ่งหน้าจอทั้งที่มี 91 รายการ
  // ✅ จอกว้างเริ่มที่ "ตาราง" ซึ่งเป็นรูปแบบมาตรฐานของหน้าจัดการงานบนเว็บ — คอลัมน์ตรงกันทุกแถว
  // กวาดสายตาลงมาเทียบกันได้ เห็นได้ 15-20 รายการต่อหน้าจอ (ตารางมีอยู่แล้ว แค่ไม่เคยเป็นค่าเริ่มต้น)
  // ⚠️ เคารพค่าที่ผู้ใช้เลือกเองเสมอ — ตรงนี้เปลี่ยนแค่ "ค่าตั้งต้นตอนยังไม่เคยเลือก" เท่านั้น
  const [viewMode, setViewMode] = useState(() => {
    try {
      const saved = localStorage.getItem("operation.viewMode");
      if (saved === "table" || saved === "card") return saved;
    } catch { /* localStorage ใช้ไม่ได้ (โหมดส่วนตัว/ถูกบล็อก) → ตกไปใช้ค่าตามขนาดจอ */ }
    return typeof window !== "undefined" && window.innerWidth >= 900 ? "table" : "card";
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
      // 🐛 ที่แก้ (กด "ตรวจสอบ" ในพาแนล "งานที่ช่างขอปิด" แล้วไม่มีอะไรเกิดขึ้น เหมือนปุ่มตาย):
      // ปลายทางของปุ่มนี้คือ "การ์ดงาน" ในรายการ ซึ่ง effect เลื่อนจอหาด้วย id `job-card-<id>` —
      // แต่ id นั้นถูกใส่ไว้ในที่เดียวเท่านั้น คือการ์ดในแท็บ "รายการงาน" + มุมมองการ์ด ถ้าผู้ใช้อยู่
      // นอกเงื่อนไขนี้ document.getElementById จะคืน null แล้ว effect return เงียบๆ = กดแล้วไม่มีผล
      // ทั้งที่ URL/ตัวกรอง/highlightId เปลี่ยนถูกต้องครบหมดแล้ว มี 2 ทางที่หลุดได้:
      //   1. ค้างอยู่แท็บ "รออนุมัติ" (activeTab === 1) — การ์ดไม่ถูก render เลย
      //   2. ค้างอยู่มุมมอง "ตาราง" (viewMode === "table") — render เป็น OperationTable ซึ่งไม่มี id นี้
      //      ⚠️ อันนี้ร้ายกว่า เพราะ viewMode ถูกจำไว้ใน localStorage ("operation.viewMode") จึงค้าง
      //      ข้ามการรีเฟรช/ปิดเปิดเบราว์เซอร์ — เลือกตารางไว้ครั้งเดียวก็เสียไปตลอด
      // จึงต้องบังคับกลับมาทั้งสองอย่าง (ตรงกับที่ onOpenJob ของ OperationTable ทำอยู่แล้วเวลากดแถว)
      // ⚠️ ต้องอยู่ใน effect เดียวกับ setHighlightId — React 18 จะ batch ทุก state เป็น render เดียว
      // การ์ดจึงถูก commit ลง DOM ก่อนที่ effect เลื่อนจอจะทำงาน (ถ้าแยก effect กัน จังหวะจะสลับกัน
      // จนหา element ไม่เจอในรอบแรก)
      setActiveTab(0);
      setViewMode("card");
      // ✅ เก็บเป็น "<id>|<nonce>" ไม่ใช่ id เฉยๆ — กันเคสกดปุ่ม "ตรวจสอบ" งานเดิมซ้ำติดๆ กัน
      // (ก่อนที่ไฮไลต์ครั้งก่อนจะจางหายไปครบ 3 วิ) ถ้าเก็บแค่ id เฉยๆ ค่าจะเหมือนเดิมทุกตัวอักษร
      // React จะมองว่าไม่มีอะไรเปลี่ยน (bail out) ไม่ trigger effect เลื่อนจอซ้ำให้ — ต่อ nonce
      // (จาก ?t=) เข้าไปด้วยการันตีว่าค่า state เปลี่ยนจริงทุกครั้งที่กด ไม่ว่าจะกดงานเดิมกี่ครั้ง
      setHighlightId(`${highlightParam}|${searchParams.get("t") || Date.now()}`);
    }
  }, [searchParams]);

  // ✅ ?tab=approvals — เปิดหน้านี้มาที่แท็บ "รออนุมัติ" ได้ทันที
  // 🐛 ที่แก้ (กดแจ้งเตือน "ส่งงานใหม่รออนุมัติ" แล้วมาไม่ถูกที่): แจ้งเตือนชนิดนี้เดิมพามาที่
  // /operation/<id> ซึ่งเปิดหน้าการดำเนินงานที่แท็บ "รายการงาน" แล้วกรองเหลืองานเดียว — คนที่กดมา
  // ต้องมากดสลับแท็บ "รออนุมัติ" เองอีกทีถึงจะกดอนุมัติ/ไม่อนุมัติได้ ทั้งที่สิ่งเดียวที่ต้องทำต่อจาก
  // แจ้งเตือนนั้นคือการตัดสินใจอนุมัติ (ปุ่มอนุมัติอยู่ในแท็บนั้นที่เดียว ไม่มีในการ์ดรายการงาน)
  // ⚠️ ต้องเช็คสิทธิ์ด้วย — แท็บ "รออนุมัติ" ถูกเรนเดอร์เฉพาะแอดมิน/manager (ดู Tabs ด้านล่าง) ถ้า
  // ตั้ง activeTab=1 ให้ role อื่นจะกลายเป็นแท็บที่ไม่มีอยู่จริง = หน้าว่างเปล่าโดยไม่มีอะไรอธิบาย
  // ⚠️ deps มี searchParams (ไม่ใช่ mount-only) — กดแจ้งเตือนซ้ำตอนที่อยู่หน้านี้อยู่แล้ว จะเปลี่ยนแค่
  // query param โดยไม่ remount หน้า (เทียบเหตุผลเดียวกับ effect ของ ?highlight= ด้านบน)
  // ⚠️ ตัว effect จริงอยู่ใต้จุดที่ประกาศ currentUser (ดูด้านล่าง) — เขียนไว้ตรงนั้นเพื่อไม่ให้
  // อ้างถึงตัวแปรก่อนถูกประกาศ

  const [page,     setPage]     = useState(1);
  // 🐛 เดิมตั้ง 5 รายการ/หน้า ทุกขนาดจอ — มี 91 งานก็ต้องเปิด 19 หน้า ซึ่งบนจอคอมที่มีที่เหลือเฟือ
  // คือการบังคับให้กดเปลี่ยนหน้าโดยไม่จำเป็น (5 รายการเหมาะกับมือถือที่เลื่อนยาวๆ ไม่ไหวเท่านั้น)
  // ✅ จอกว้างเริ่มที่ 20 — พอดีกับหนึ่งหน้าจอในมุมมองตาราง ผู้ใช้ยังเปลี่ยนเองได้ที่ช่อง "ต่อหน้า"
  const [pageSize, setPageSize] = useState(
    () => (typeof window !== "undefined" && window.innerWidth >= 900 ? 20 : 5)
  );
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
  /**
   * ⚠️ เก็บ "ตัวผู้ใช้ทั้งก้อน" ไม่ใช่สตริงตำแหน่ง — can()/isRole() ต้องเห็นทั้งตำแหน่งในองค์กร (rank)
   * และชั้นในระบบ (role) ถ้าส่งแค่สตริง Super Admin ที่ตำแหน่งเป็นช่างจะแก้อะไรในบอร์ดนี้ไม่ได้เลย
   */
  const [currentUser,  setCurrentUser]    = useState(null);
  const isAdminOrManager = can(currentUser, "approveJobs");

  // ✅ ?tab=approvals — เปิดหน้านี้มาที่แท็บ "รออนุมัติ" ได้ทันที
  // 🐛 ที่แก้ (กดแจ้งเตือน "ส่งงานใหม่รออนุมัติ" แล้วมาไม่ถูกที่): แจ้งเตือนชนิดนี้เดิมพามาที่
  // /operation/<id> ซึ่งเปิดที่แท็บ "รายการงาน" แล้วกรองเหลืองานเดียว — คนที่กดมาต้องมาสลับแท็บ
  // "รออนุมัติ" เองอีกทีถึงจะกดอนุมัติ/ไม่อนุมัติได้ ทั้งที่สิ่งเดียวที่ต้องทำต่อจากแจ้งเตือนนั้นคือ
  // การตัดสินใจอนุมัติ (ปุ่มอนุมัติอยู่ในแท็บนั้นที่เดียว การ์ดในแท็บรายการงานไม่มีให้)
  // ⚠️ ต้องเช็คสิทธิ์ด้วย — แท็บ "รออนุมัติ" ถูกเรนเดอร์เฉพาะแอดมิน/manager (ดู Tabs ด้านล่าง) ถ้าตั้ง
  // activeTab=1 ให้ role อื่นจะกลายเป็นแท็บที่ไม่มีอยู่จริง = เนื้อหาว่างเปล่าโดยไม่มีอะไรอธิบาย
  // ⚠️ deps มี searchParams (ไม่ใช่ mount-only) — กดแจ้งเตือนซ้ำตอนที่อยู่หน้านี้อยู่แล้วจะเปลี่ยนแค่
  // query param โดยไม่ remount หน้า (เทียบเหตุผลเดียวกับ effect ของ ?highlight= ด้านบน)
  // 🧹 ลิงก์เก่า /operation?tab=approvals — แท็บ "รออนุมัติ" ถูกย้ายออกไปเป็นเมนู "คำขอลงงาน" แล้ว
  // ⚠️ ต้องส่งต่อไปหน้าใหม่ ไม่ใช่ปล่อยให้เงียบ — ลิงก์นี้ถูกใช้จริงจากแจ้งเตือนที่ส่งออกไปแล้ว
  // และจากบุ๊กมาร์กของผู้ใช้ ถ้าไม่ทำอะไรเลย คนกดจะเจอหน้ารายการงานธรรมดาแล้วหาที่กดอนุมัติไม่เจอ
  useEffect(() => {
    if (searchParams.get("tab") === "approvals" && isAdminOrManager) {
      navigate("/dispatch?tab=approvals", { replace: true });
    }
  }, [searchParams, isAdminOrManager, navigate]);

  const [uploadingState,         setUploadingState]         = useState({ quotation: null, report: null, invoice: null, completion: null });
  const [uploadProgressState,    setUploadProgressState]    = useState({ quotation: 0, report: 0, invoice: 0, completion:0 });
  const [uploadingFileSizeState, setUploadingFileSizeState] = useState({ quotation: "", report: "", invoice: "", completion: "" });
  const [isUploadingState,       setIsUploadingState]       = useState({ quotation: false, report: false, invoice: false, completion:false });

  useEffect(() => {
    const payload = JSON.parse(localStorage.getItem("payload") || "{}");
    if (payload?.role || payload?.rank) setCurrentUser(payload);
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
    if (!currentUser) return;
    const interval = setInterval(() => {
      fetchEventsFromDB(true); // silent refresh
    }, 15000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // ✅ เรียลไทม์: งานเปลี่ยน (อนุมัติปิดงาน/แก้สถานะ/มอบหมาย) → บอร์ดอัปเดตทันที ไม่ต้องรอรอบ 15 วินาทีข้างบน
  useRealtime("events", () => { fetchEventsFromDB(true); });
  useRealtime("users", () => { fetchEmployee(); });
  useRealtime("lookups", () => { fetchLookupOptions(); });

  /**
   * ✅ มอบหมาย/เปลี่ยนผู้รับผิดชอบจากหน้านี้
   * ⚠️ ใช้ /basic-info ตัวเดียวกับหน้าภาพรวมงาน — server ทำให้ทุกวัน/ทุกครั้งของงานเดียวกันได้ค่าเดียวกัน
   *    (ดู services/groupResponsible.js) หน้าภาพรวมงาน/ปฏิทิน/ฟอร์มแก้ไขงาน จึงเห็นชื่อเดียวกันทันที
   */
  const handleAssignResponsible = async (event, name) => {
    if ((event.responsiblePerson || "") === (name || "")) return;
    const person = employee.find((e) => e.fname === name);
    try {
      await EventService.UpdateBasicInfo([event._id], { responsiblePerson: name || "", responsiblePersonId: person?._id ? String(person._id) : "" });
      await fetchEventsFromDB(true);
      setSnackbar({ open: true, msg: name ? `มอบหมาย ${name} เป็นผู้รับผิดชอบแล้ว` : "ยกเลิกการมอบหมายแล้ว", severity: "success" });
    } catch (err) {
      setSnackbar({ open: true, msg: err?.response?.data?.message || "มอบหมายผู้รับผิดชอบไม่สำเร็จ", severity: "error" });
    }
  };

  const fetchEventsFromDB = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // ⚠️ detail = ขอ activityLog มาด้วย — หน้านี้ทั้งแสดง (ActivityLogMini) และบันทึกต่อท้าย
      //    ถ้าไม่ขอ แล้วมีการบันทึกกิจกรรมใหม่ ประวัติเดิมทั้งชุดจะถูกเขียนทับหาย
      const res = await EventService.getEventOp({ detail: true });
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

  // ✅ แยก "ชื่อหลัก" กับ "แท็กประกอบ" ของงานที่ถูกกรองเจาะจง ไว้ใช้กับแถบแจ้งสถานะการกรองด้านล่าง
  // เดิมยัดทุกอย่างต่อกันเป็นประโยคเดียว (PM · Fire Alarm · Holiday Inn ...) อ่านแล้วแยกไม่ออกว่า
  // อะไรคือชื่องาน อะไรคือประเภท — ยกชื่อโครงการ/ไซต์ขึ้นเป็นตัวหลักเพราะเป็นสิ่งที่คนใช้จำงานได้จริง
  // (ตรงกับที่ ClosureRequestsPanel/การ์ดงานใช้อยู่แล้ว) ที่เหลือลดชั้นลงเป็นแท็บเล็กๆ
  const focusedJob = useMemo(() => {
    if (!selectedEvent) return null;
    const hasPlace = Boolean(selectedEvent.company || selectedEvent.site);
    const name = hasPlace
      ? companySite(selectedEvent.company, selectedEvent.site)
      : (selectedEvent.title || "งานที่เลือก");
    return {
      name,
      tags: [selectedEvent.title, selectedEvent.system].filter(t => t && t !== name),
    };
  }, [selectedEvent]);

  // ✅ สร้างจาก events ทั้งหมด (ก่อนตัวกรองอื่น) เสมอ เพื่อให้งานหลายวันไม่ติดกันถูกจัดกลุ่มครบ
  // ทุกแถว แล้วคิดค้างจากวันสุดท้ายของทั้งชุด ไม่ใช่แยกทีละแถว
  const daysPastDueMap = useMemo(() => buildDaysPastDueMap(events), [events]);

  // ✅ ต้องคำนวณก่อน filteredEvents (ใช้ตัดสิน default group ด้านล่าง) — ย้ายขึ้นมาจากที่เดิม
  // ที่อยู่ถัดจาก filteredEvents เพราะตอนนั้นยังไม่ต้องใช้ค่านี้ตอนกรอง
  // ✅ เดิมนับทุกแถว event ดิบ — งานที่เข้าหลายวันไม่ติดกัน (jobGroupId เดียวกัน) ขอปิดพร้อมกันทั้ง
  // กลุ่มแล้ว (ดู handleRequestClose) ทำให้ตัวเลขนี้เพี้ยนสูงกว่าจำนวนงานจริง (เช่น 1 งานเข้า 3 วัน
  // ขึ้นเป็น "3 งาน") ใช้ countDistinctJobs จัดกลุ่มก่อนนับแทน ให้ตรงกับจำนวนงานจริงที่เห็นในพาแนล
  const [filterResponsible, setFilterResponsible] = useState("all");
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [headerMenuAnchor, setHeaderMenuAnchor] = useState(null);
  /**
   * ✅ ตัวเลขบนการ์ดสถานะนับตามตัวกรองที่ตั้งอยู่ (ผู้ใช้ขอ) — ค้นหา/เดือน/ประเภท/ระบบ/การเงิน/สถานะ/ทีม/ผู้รับผิดชอบ
   *    ยกเว้น "กลุ่มของการ์ดเอง" (ไม่งั้นทุกการ์ดจะเหลือเลขเดียวกับการ์ดที่เลือกอยู่) — ตัวเลขจึงบอกตรงๆ ว่า
   *    "ถ้ากดการ์ดนี้จะเห็นกี่งาน" เหมือนการ์ดในหน้าภาพรวมงาน
   */
  const countBase = useMemo(() => {
    const keyword = search.toLowerCase();
    return events.filter((event) => {
      if (dateSearch && moment(event.start).format("YYYY-MM") !== dateSearch) return false;
      if (filterType && event.title !== filterType) return false;
      if (filterSystem && event.system !== filterSystem) return false;
      if (filterTeam && event.team !== filterTeam) return false;
      if (filterStatus && ![event.status_two, event.status_three].includes(filterStatus)) return false;
      if (filterOP && event.status !== filterOP) return false;
      if (filterResponsible === "unassigned" && event.responsiblePerson) return false;
      if (filterResponsible !== "all" && filterResponsible !== "unassigned" && event.responsiblePerson !== filterResponsible) return false;
      if (keyword) {
        const hit = [event.company, event.site, event.title, event.system, event.team, event.docNo, event.contactName, event.contactTel,
          formatThai(moment(event.start), "DD/MM/YYYY HH:mm")].map((v) => (v || "").toLowerCase()).some((t) => t.includes(keyword));
        if (!hit) return false;
      }
      return true;
    });
  }, [events, dateSearch, filterType, filterSystem, filterTeam, filterStatus, filterOP, filterResponsible, search]);

  const pendingCount = useMemo(
    () => countDistinctJobs(countBase, e => e.closeRequested === true && e.status !== "ดำเนินการเสร็จสิ้น"),
    [countBase]
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
  // ✅ เปิดหน้ามา = "ทั้งหมด" เสมอ (ผู้ใช้ขอ) — ลิงก์เจาะจงจากที่อื่น (?group= / ?status= / ?highlight= / งานเดียว)
  //    ยังเปิดตรงกลุ่ม/งานนั้นเหมือนเดิม เพราะตั้ง statusGroup/filterOP/id มาให้ก่อนแล้ว
  const effectiveGroup = statusGroup || (filterOP || id ? "" : "all");

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
    const isAdminOrManagerRole = can(currentUser, "approveJobs");
    // ✅ เดิม default ไปที่ "pending" (รอคุณอนุมัติ) เสมอสำหรับแอดมิน/manager แม้ไม่มีงานรออนุมัติเลย
    // ทำให้เปิดหน้ามาเจอ "ไม่พบรายการ" ว่างเปล่าโดยไม่มีอะไรผิดพลาดจริง — ถ้าไม่มีคำขอปิดงานรออยู่
    // ให้ default ไปโชว์ "กำลังดำเนินการ/ยืนยันแล้ว" แทน ซึ่งมักจะมีงานอยู่จริงให้เห็นทันที
    const group = filterOP ? null : (statusGroup || "all");

    // ✅ เดิมตัดงานสถานะ "กำลังรอยืนยัน" ออกทั้งหมดเสมอ (ยกเว้นกรองเจาะจงเอง) แต่งานที่ค้างมานาน
    // จนเลยกำหนดโดยไม่เคยถูกยืนยันเลยตั้งแต่แรกคืองานที่กลุ่ม "ค้างงาน" ต้องจับให้ได้มากที่สุด —
    // ตัดออกเสมอทำให้ตัวเลขบน badge (นับจาก isFlaggedDays ตรงๆ ไม่รู้จัก exclusion นี้) กับรายการที่
    // แสดงจริงไม่ตรงกัน (เห็น badge ว่า 3 งาน แต่เปิดมา "ไม่พบรายการ") จึงงดเว้นเฉพาะตอนดูกลุ่มนี้
    // ✅ กลุ่ม "pending" (รอคุณอนุมัติ) เจอบั๊กเดียวกัน — งานที่ช่างขอปิดตั้งแต่ยังไม่เคยถูกยืนยัน
    // สถานะเลย (status ยังเป็น "กำลังรอยืนยัน" อยู่ แต่ closeRequested:true แล้ว) ถูกตัดออกจากรายการ
    // ทั้งที่ pendingCount/ClosureRequestsPanel นับรวมงานนี้ไว้แล้ว ทำให้เห็น badge "2 งาน" แต่เปิด
    // แท็บมาแล้วเจอ "ไม่พบรายการ" ว่างเปล่า ต้องงดเว้นตัดออกในกลุ่มนี้ด้วยเช่นกัน
    const matchNotPending = (filterOP === "กำลังรอยืนยัน" || group === "overdue" || group === "pending" || group === "all")
      ? true
      : event.status !== "กำลังรอยืนยัน";

    let matchGroup;
    if (!group || group === "all") {
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
         event.contactName, event.contactTel,
         formatThai(moment(event.start), "DD/MM/YYYY HH:mm")]
          .map(v => (v || "").toLowerCase()).some(t => t.includes(keyword))
      : true;

    return matchMonth && matchType && matchSystem && matchStatus && matchOP && matchTeam && matchSearch && matchNotPending && matchGroup;
  });
}, [id, selectedEvent, events, dateSearch, filterType, filterSystem, filterStatus, filterOP, filterTeam, search, statusGroup, currentUser, daysPastDueMap]);

  // ✅ แท็บ "ค้างงาน" เดิมเรียงตามวันที่เริ่มงานเหมือนแท็บอื่นๆ ทำให้ป้าย "เลยกำหนด X วัน" โผล่มาแบบ
  // สลับมั่วไม่มีลำดับ (เช่น 10, 14, 13, 20 วัน สลับกันไปมา) ดูยากว่างานไหนควรรีบทำก่อน — เรียง
  // ตามจำนวนวันที่ค้างมากสุดก่อนแทนเฉพาะแท็บนี้ ให้เห็นชัดว่างานไหนเร่งด่วนที่สุดอยู่บนสุดเสมอ
  // (แท็บอื่นยังเรียงตามวันที่เริ่มงานล่าสุดก่อนเหมือนเดิม)
  /**
   * ✅ ทางลัดดูงานตามผู้รับผิดชอบ (แผงเดียวกับหน้าภาพรวมงาน) — กรองหลังกลุ่ม/ค้นหา/ตัวกรองอื่นทั้งหมด
   * ⚠️ ตัวเลขบนแผงนับจาก filteredEvents (ก่อนกรองผู้รับผิดชอบ) — เลือกคนหนึ่งอยู่ก็ยังเห็นตัวเลขของทุกคน
   */
  const responsibleFiltered = useMemo(() => (
    filterResponsible === "all" ? filteredEvents
      : filterResponsible === "unassigned" ? filteredEvents.filter((e) => !e.responsiblePerson)
        : filteredEvents.filter((e) => e.responsiblePerson === filterResponsible)
  ), [filteredEvents, filterResponsible]);

  const sortedEvents = useMemo(() => {
    if (effectiveGroup === "overdue") {
      return responsibleFiltered.slice().sort((a, b) => {
        const daysA = daysPastDueMap.get(a._id)?.days ?? 0;
        const daysB = daysPastDueMap.get(b._id)?.days ?? 0;
        return daysB - daysA;
      });
    }
    // ✅ แท็บ "เสร็จสิ้น" ให้เอางานล่าสุดขึ้นก่อน (ใหม่ไปเก่า) — ต่างจากแท็บอื่นที่เรียงเก่าไปใหม่
    // เพราะงานที่ปิดแล้วอยากเห็นงานที่เพิ่งเสร็จล่าสุดก่อน ไม่ใช่งานเก่าที่ปิดไปนานแล้ว
    if (effectiveGroup === "closed") {
      return responsibleFiltered.slice().sort((a, b) => new Date(b.start) - new Date(a.start));
    }
    // ✅ เรียงจากวันเก่าสุด (ก่อนวันปัจจุบัน) ไล่ไปจนถึงอนาคต — งานที่ค้าง/ใกล้ถึงกำหนดอยู่บนสุด
    // เดิมเรียงจากวันลงงานล่าสุดก่อน (ใหม่ไปเก่า) ทำให้งานที่ลงวันในอนาคตไกลๆ แซงหน้างานที่ควรทำก่อน
    return responsibleFiltered.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
  }, [responsibleFiltered, effectiveGroup, daysPastDueMap]);
  const activeFilterCount = [filterType, filterSystem, filterStatus, filterOP, search.trim(), filterTeam].filter(Boolean).length;

  // นับจำนวนงานแต่ละกลุ่มไว้โชว์บน toggle — อ้างอิงจาก events ทั้งหมด ไม่ผ่านตัวกรองอื่น
  // ✅ ใช้ countDistinctJobs จัดกลุ่มก่อนนับเหมือนกัน (เทียบเหตุผลเดียวกับ pendingCount ด้านบน)
  const closedCount   = useMemo(() => countDistinctJobs(countBase, e => e.status === "ดำเนินการเสร็จสิ้น"), [countBase]);
  const allJobsCount  = useMemo(() => countDistinctJobs(countBase, () => true), [countBase]);
  // 🐛 BUG ที่แก้ (งานค้างโผล่ซ้ำ 2 แถบ): เดิมนับงานสถานะ "ยืนยันแล้ว/กำลังดำเนินการ" ทั้งหมดเข้ากลุ่มนี้
  // โดยไม่สนว่าเลยกำหนดไปแล้วหรือยัง — งานที่ค้างเกิน 1 สัปดาห์จึงถูกนับ/แสดงทั้งใน "กำลังดำเนินการ"
  // และ "ค้างงาน" พร้อมกัน ตัวเลขบนการ์ดรวมกันแล้วเกินจำนวนงานจริง และไล่ดูทีละแถบก็เจองานเดิมซ้ำ
  // ⚠️ อีก 2 กลุ่มไม่มีปัญหานี้อยู่แล้ว — buildDaysPastDueMap ยกเว้นงานที่ปิดแล้ว/ขอปิดแล้วออกจากการนับ
  // "ค้างงาน" ตั้งแต่ต้นทาง (ดู shared/utils/overdueJobs.js) จึงทับซ้อนกันเฉพาะคู่นี้คู่เดียว
  // ✅ "ค้างงาน" เป็นกลุ่มที่เร่งด่วนกว่า จึงให้ครองงานนั้นไว้แถบเดียว ส่วนกลุ่มนี้เหลือเฉพาะงานที่ยังอยู่
  // ในกำหนดจริงๆ — แต่ละงานอยู่แถบเดียวเสมอ ผลรวมของทุกแถบ = จำนวนงานทั้งหมดพอดี
  const inProgressCount  = useMemo(
    () => countDistinctJobs(
      countBase,
      e => ["ยืนยันแล้ว", "กำลังดำเนินการ"].includes(e.status)
        && !e.closeRequested
        && !isFlaggedDays(daysPastDueMap.get(e._id)?.days),
    ),
    [countBase, daysPastDueMap]
  );
  const overdueCount     = useMemo(() => countFlaggedJobs(countBase, daysPastDueMap, isFlaggedDays), [countBase, daysPastDueMap]);
  const severeOverdueCount = useMemo(() => countFlaggedJobs(countBase, daysPastDueMap, isSevereDays), [countBase, daysPastDueMap]);

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
  const responsibleRows = useMemo(() => {
    const seen = new Set();
    return filteredEvents.filter((e) => {
      const sig = getJobSignature(e);
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredEvents]);
  const isRowOverdue = useCallback((r) => isFlaggedDays(daysPastDueMap.get(r._id)?.days), [daysPastDueMap]);

  // กันหน้าเกินขอบเขตเมื่อผลลัพธ์หลังกรองน้อยกว่าหน้าปัจจุบัน
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  /**
   * ✅ แผงรายละเอียดงาน — กดแถวในตารางแล้วเปิดการ์ดงานตัวเต็ม (ทุกปุ่มทำงานเหมือนมุมมองการ์ด) ทับบนตารางเลย
   * 🐛 เดิมกดแถวแล้ว "สลับทั้งหน้าไปมุมมองการ์ด" แล้วเลื่อนหาให้ — ผู้ใช้หลุดจากตาราง ต้องกดกลับเองทุกครั้ง (ไม่มืออาชีพ)
   * ⚠️ เก็บแค่ id — หากลุ่มงานสดจากรายการทุก render: แก้สถานะ/อัปโหลดในแผงแล้วข้อมูลในแผงเปลี่ยนตามทันที
   *    ถ้างานหลุดจากตัวกรองปัจจุบัน (เช่น ปิดงานแล้วย้ายไปกลุ่มเสร็จสิ้น) ยังเปิดค้างได้จากข้อมูลทั้งหมด
   */
  const [detailJobId, setDetailJobId] = useState(null);
  const detailSessions = useMemo(() => {
    if (!detailJobId) return null;
    const inList = jobGroups.find((g) => g.some((x) => x._id === detailJobId));
    if (inList) return inList;
    const base = events.find((e) => e._id === detailJobId);
    if (!base) return null;
    return base.jobGroupId ? events.filter((e) => e.jobGroupId === base.jobGroupId) : [base];
  }, [detailJobId, jobGroups, events]);

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


  // ✅ (9 ต.ค. 2569) ขั้นตอนทำงาน — รับงาน/งานไม่เสร็จ ส่งงานทั้งกลุ่มกลับมา เอามาแทนในหน้าจอเลย
  const handlePatched = useCallback((docs) => {
    if (!docs?.length) return;
    const byId = new Map(docs.map((d) => [d._id, d]));
    setEvents((prev) => prev.map((e) => (byId.has(e._id) ? { ...e, ...byId.get(e._id), activityLog: e.activityLog } : e)));
  }, []);

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
    } catch (err) {
      // ✅ บอกเหตุผลจริงจาก server/ตัวตรวจไฟล์ (ไฟล์ใหญ่เกิน · ชนิดไม่รองรับ · งานปิดแล้ว) — เดิมขึ้นแค่ "อัปโหลดไม่สำเร็จ"
      const d = err?.response?.data;
      const why = (typeof d === "string" ? d : d?.message || d?.error) || err?.message || "";
      setSnackbar({
        open: true,
        msg: (successCount > 0 ? `อัปโหลดสำเร็จ ${successCount}/${files.length} ไฟล์ (มีไฟล์ที่ล้มเหลว)` : "อัปโหลดไม่สำเร็จ") + (why ? ` — ${why}` : ""),
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
      const { exportOperationToExcel, buildOperationFileName } = await import("@/features/operation/utils/operationExcelExport");
      const groupLabel = {
        all: "ทั้งหมด", pending: "คำขอปิดงาน", active: "กำลังดำเนินการ", overdue: "ค้างงาน", closed: "เสร็จสิ้น",
      }[effectiveGroup] || "ทั้งหมด";
      await exportOperationToExcel({
        // ⚠️ jobGroups เป็น array ของ "array of sessions" ตรงๆ (ดู useMemo ด้านบน) ไม่ใช่ object ที่มี
        // .sessions — ต้องห่อก่อนส่งเข้าโมดูล export ซึ่งอ่าน job.sessions[0] (ไม่ห่อ = undefined[0])
        jobs: jobGroups.map((sessions) => ({ sessions })),
        meta: {
          fileName: buildOperationFileName(groupLabel),
          groupLabel: `กลุ่ม: ${groupLabel}`,
          filterSummary: activeFilterCount > 0 ? `ตัวกรอง ${activeFilterCount} เงื่อนไข` : "ไม่ได้กรองเพิ่มเติม",
          exportedAt: formatThai(moment(), "DD/MM/YYYY HH:mm"),
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

  // ✅ แถบแบ่งหน้าใช้ทั้งมุมมองการ์ดและตาราง — เดิมมีแค่การ์ด ตารางเลยดูข้อมูลหน้าถัดไปไม่ได้ (ผู้ใช้แจ้ง)
  // ✅ มือถือ: การ์ดสถานะ/ผู้รับผิดชอบ/ค้นหา/ตัวกรอง รวมในแผ่นล่างแผ่นเดียว (ผู้ใช้ขอ — เหมือนหน้าภาพรวมงาน)
  // ✅ มือถือ: เลือกสถานะ/ตัวกรอง/เดือนแล้วปิดแผ่นทันที — ยกเว้นกด "เลือกเดือน" (ยังต้องเลือกเดือนในช่องที่โผล่มา)
  useCloseOnPick(mobileSheetOpen, () => setMobileSheetOpen(false), {
    statusGroup, filterResponsible, filterOP, filterType, filterSystem, filterTeam, month: showAll ? "ALL" : selectedDate,
  }, (prev, next) => prev.month === "ALL" && next.month !== "ALL");

  const statusTileGroups = [{
    title: "",
    items: [
      { value: "all", label: "ทั้งหมด", count: allJobsCount, unit: "งาน", icon: <AppsIcon />, color: "#475569" },
      ...(isAdminOrManager ? [
        { value: "pending", label: "คำขอปิดงาน", count: pendingCount, unit: "งาน", icon: <HourglassTop />, color: "#d97706", alert: true },
        { value: "active", label: "กำลังดำเนินการ / ยืนยันแล้ว", shortLabel: "กำลังดำเนินการ", count: inProgressCount, unit: "งาน", icon: <PendingActions />, color: "#7c3aed" },
      ] : []),
      { value: "overdue", label: "ค้างงาน", count: overdueCount, unit: "งาน", icon: <Warning />, color: "#dc2626", alert: true,
        sub: severeOverdueCount > 0 ? `${severeOverdueCount} เกิน 2 สัปดาห์` : undefined },
      { value: "closed", label: "เสร็จสิ้น", count: closedCount, unit: "งาน", icon: <CheckCircle />, color: "#059669" },
    ],
  }];
  const statusItem = statusTileGroups[0].items.find((i) => i.value === effectiveGroup);
  const mobileActiveCount = activeFilterCount + (filterResponsible !== "all" ? 1 : 0) + (effectiveGroup && effectiveGroup !== "all" ? 1 : 0);
  const responsibleOptions = (() => {
    const m = new Map();
    let unassigned = 0;
    responsibleRows.forEach((r) => {
      if (!r.responsiblePerson) { unassigned += 1; return; }
      m.set(r.responsiblePerson, (m.get(r.responsiblePerson) || 0) + 1);
    });
    return { list: [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "th")), unassigned, total: responsibleRows.length };
  })();
  const clearAllOpFilters = () => {
    setFilterType(""); setFilterSystem(""); setFilterStatus(""); setFilterOP(""); setFilterTeam(""); setSearch(""); setFilterResponsible("all");
  };
  const filterPanelProps = {
    search, onSearch: setSearch,
    filterType, onFilterType: setFilterType,
    filterSystem, onFilterSystem: setFilterSystem,
    filterStatus, onFilterStatus: setFilterStatus,
    filterOP, onFilterOP: setFilterOP,
    filterTeam, onFilterTeam: setFilterTeam,
    typeOptions, systemOptions,
    showAll, onToggleShowAll: (v) => { setShowAll(v); if (v) setSelectedDate(""); },
    selectedDate, onDateChange: (d) => { setSelectedDate(d); setShowAll(false); },
    onClearAll: clearAllOpFilters,
    activeCount: activeFilterCount,
  };

  // ✅ แถบแบ่งหน้าแบบเดียวกับทั้งแอป (สไตล์ปุ่มมาจากธีม — app/theme.js) — ซ้าย: แสดงกี่รายการ + ต่อหน้า · ขวา: เลขหน้า
  //    มือถือ: ซ่อนช่อง "ต่อหน้า" (ใช้ค่าเดิม) และตัดปุ่มหน้าแรก/สุดท้าย ให้เลขหน้าอยู่บรรทัดเดียวไม่ล้นจอ
  const pageFrom = jobGroups.length ? (page - 1) * pageSize + 1 : 0;
  const pageTo = Math.min(page * pageSize, jobGroups.length);
  const paginationBar = (
    <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" justifyContent="space-between" gap={1.25} sx={{ mt: 2, mb: 1 }}>
      <Stack direction="row" alignItems="center" gap={1.5}>
        <Typography sx={{ fontSize: "0.78rem", color: "#64748b", fontVariantNumeric: "tabular-nums" }}>
          {totalPages > 1 ? `แสดง ${pageFrom}–${pageTo} จาก ${jobGroups.length} งาน` : `${jobGroups.length} งาน`}
        </Typography>
        {!isMobile && (
          <SelectField label="ต่อหน้า" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} sx={{ width: 120 }}>
            {[5, 10, 20, 50, 100].map(n => <option key={n} value={n}>{n} รายการ</option>)}
          </SelectField>
        )}
      </Stack>
      {totalPages > 1 && (
        <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)}
          size="medium" siblingCount={isMobile ? 0 : 1} showFirstButton={!isMobile} showLastButton={!isMobile} />
      )}
    </Stack>
  );

  return (
    <Box sx={{ px: { xs: 0, sm: 2, md: 3 }, py: { xs: 1.5, sm: 3 }, maxWidth: 1400, mx: "auto" }}>

      {/* Header
          🐛 เดิมบนมือถือ ชื่อหน้ากับแถวปุ่มตกคนละบรรทัด (flexWrap ทำให้ปุ่ม 5 ตัวห่อลงมาเป็นแถบของ
          ตัวเอง) กินความสูงเกือบ 150px ก่อนถึงเนื้อหา
          ✅ บังคับบรรทัดเดียวบนจอแคบ + ย่อปุ่มกลมเหลือ 34px ให้พอดีจอ 393px */}
      <Stack
        direction="row" alignItems="center" justifyContent="space-between"
        sx={{ mb: { xs: 2, sm: 3 } }}
        flexWrap={{ xs: "nowrap", sm: "wrap" }} gap={{ xs: 0.75, sm: 1 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            fontWeight={800} letterSpacing={-0.5} noWrap
            sx={{ fontSize: { xs: "1.15rem", sm: "1.5rem" }, lineHeight: 1.3 }}
          >
            การดำเนินงาน
          </Typography>
          {/* 🐛 BUG ที่แก้ (ตัวเลขใต้หัวข้อไม่ตรงกับสิ่งที่เห็นบนจอ): เดิมโชว์ sortedEvents.length เสมอ
              ซึ่งเป็นจำนวนงานของแท็บ "รายการงาน" — พอสลับไปแท็บ "รออนุมัติ" ที่มี 0 งาน หัวข้อยังขึ้น
              "1 รายการ" ค้างอยู่ (จำนวนของอีกแท็บ) อ่านแล้วขัดกันเองทันที
              ✅ ให้ตัวเลขเปลี่ยนตามแท็บที่เปิดอยู่จริง และซ่อน "กรอง N เงื่อนไข" ตอนอยู่แท็บรออนุมัติ
              เพราะตัวกรองพวกนั้นไม่มีผลกับแท็บนั้นเลย */}
          <Typography variant="body2" color="text.secondary">
            {loading
              ? "กำลังโหลด..."
              : `${sortedEvents.length} รายการ${activeFilterCount > 0 ? ` · กรอง ${activeFilterCount} เงื่อนไข` : ""}`}
          </Typography>
        </Box>
        {/* ✅ ปุ่มวงกลม ขนาด 40px ให้แตะง่ายขึ้นบนมือถือ (เดิม size="small" เล็กไปสำหรับนิ้วมือ)
            เข้าธีมเดียวกับปุ่มวงกลมที่ใช้ทั่วแอป (bell button ใน Dashboard/Header) */}
        <Stack direction="row" gap={{ xs: 0.5, sm: 1 }} flexShrink={0}>
          {/* ✅ มือถือ: ปุ่มสถานะ/ค้นหา/ตัวกรอง — เปิดแผ่นล่าง */}
          {/* ✅ มือถือ (ผู้ใช้: "ปุ่มไม่ชัดเจน มองยาก"): เดิมเป็นไอคอนกลม 5 ปุ่มคนละแบบเรียงกัน เดาไม่ออกว่าอันไหนคืออะไร
              → เหลือ 2 ปุ่ม: "ตัวกรอง" มีป้ายข้อความ + เมนู ⋮ (รีเฟรช · มุมมองการ์ด/ตาราง · ส่งออก Excel) */}
          {isMobile && activeTab !== 1 && (
            <Badge badgeContent={mobileActiveCount} color="error" sx={{ "& .MuiBadge-badge": { fontSize: "0.6rem", height: 16, minWidth: 16 } }}>
              <Button
                aria-label="สถานะ ค้นหา และตัวกรอง" onClick={() => setMobileSheetOpen(true)}
                startIcon={<Tune sx={{ fontSize: "18px !important" }} />}
                sx={{
                  height: 38, px: 1.5, borderRadius: 2.5, textTransform: "none", fontWeight: 800, fontSize: "0.85rem",
                  border: "1px solid", borderColor: mobileActiveCount ? "#334155" : "divider",
                  color: "#334155", bgcolor: mobileActiveCount ? "#f1f5f9" : "background.paper",
                }}
              >
                ตัวกรอง
              </Button>
            </Badge>
          )}
          {isMobile && (
            <>
              <IconButton
                aria-label="เมนูเพิ่มเติม" onClick={(e) => setHeaderMenuAnchor(e.currentTarget)}
                sx={{ width: 38, height: 38, borderRadius: 2.5, border: "1px solid", borderColor: "divider" }}
              >
                <MoreVert sx={{ fontSize: 20 }} />
              </IconButton>
              <Menu
                anchorEl={headerMenuAnchor} open={Boolean(headerMenuAnchor)} onClose={() => setHeaderMenuAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
                slotProps={{ paper: { sx: { borderRadius: 2.5, minWidth: 210, mt: 0.5 } } }}
              >
                <MenuItem onClick={() => { setHeaderMenuAnchor(null); fetchEventsFromDB(); }}>
                  <ListItemIcon><Refresh fontSize="small" /></ListItemIcon><ListItemText>รีเฟรชข้อมูล</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => { setHeaderMenuAnchor(null); setViewMode(viewMode === "card" ? "table" : "card"); }}>
                  <ListItemIcon>{viewMode === "card" ? <TableChart fontSize="small" /> : <ViewList fontSize="small" />}</ListItemIcon>
                  <ListItemText>{viewMode === "card" ? "ดูแบบตาราง" : "ดูแบบการ์ด"}</ListItemText>
                </MenuItem>
                {isAdminOrManager && (
                  <MenuItem disabled={exporting || jobGroups.length === 0} onClick={() => { setHeaderMenuAnchor(null); handleExportExcel(); }}>
                    <ListItemIcon><FontAwesomeIcon icon={faFileExcel} style={{ fontSize: 16, color: "#047857" }} /></ListItemIcon>
                    <ListItemText>ส่งออก Excel</ListItemText>
                  </MenuItem>
                )}
              </Menu>
            </>
          )}
          {!isMobile && (<>
          <Tooltip title="รีเฟรช">
            <IconButton onClick={() => fetchEventsFromDB()}
              sx={{ border: "1px solid", borderColor: "divider", borderRadius: "50%", width: { xs: 34, sm: 40 }, height: { xs: 34, sm: 40 } }}>
              <Refresh fontSize="small" />
            </IconButton>
          </Tooltip>
          {/* Notification bell — ทุก role เห็น แต่เนื้อหาต่างกันตามฝั่ง (ดูคอมเมนต์ใน NotificationBell) */}
          {/* 🧹 มือถือ: ตัดกระดิ่งออก (ผู้ใช้ขอ — แถบหัวแอปมีกระดิ่งแจ้งเตือนอยู่แล้ว ปุ่มบนหัวเพจแน่นเกิน) */}
          {!isMobile && <NotificationBell notifications={notifications} unread={unread} onItemClick={markRead} onMarkAllRead={markAllRead} />}
          {/* ✅ สลับมุมมองการ์ด ↔ ตาราง — การ์ดอ่านรายละเอียดทีละงานได้ครบ (มีเอกสาร/คอมเมนต์/ปุ่มจัดการ
              ในตัว) ส่วนตารางไว้กวาดดูหลายงานพร้อมกัน/เทียบกัน เทียบ pattern เดียวกับหน้าติดตามใบเสนอราคา */}
          <ToggleButtonGroup
            size="small" exclusive value={viewMode}
            onChange={(_, v) => v && setViewMode(v)}
            sx={{ "& .MuiToggleButton-root": { px: { xs: 0.85, sm: 1.25 }, py: { xs: 0.4, sm: 0.75 }, borderRadius: 2 } }}
          >
            <ToggleButton value="card" title="มุมมองการ์ด"><ViewList sx={{ fontSize: 18 }} /></ToggleButton>
            <ToggleButton value="table" title="มุมมองตาราง"><TableChart sx={{ fontSize: 18 }} /></ToggleButton>
          </ToggleButtonGroup>
          {isAdminOrManager && (
            <Tooltip title="ส่งออกเป็นไฟล์ Excel (.xlsx)">
              <span>
                <IconButton onClick={handleExportExcel} disabled={exporting || jobGroups.length === 0}
                  sx={{
                    border: "1px solid", borderRadius: "50%",
                    width: { xs: 34, sm: 40 }, height: { xs: 34, sm: 40 },
                    borderColor: alpha("#047857", 0.25), color: "#047857",
                    "&:hover": { bgcolor: alpha("#047857", 0.08), borderColor: "#047857" },
                  }}>
                  <FontAwesomeIcon icon={faFileExcel} style={{ fontSize: 16 }} />
                </IconButton>
              </span>
            </Tooltip>
          )}
          </>)}
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
      {/* ✅ แถบ "กำลังดูเฉพาะงานนี้" — โทนเรียบ (ขาว + ขอบซ้ายเทาเข้ม) ไม่ใช่กล่องฟ้าทั้งแถบ (กฎ: สีไม่เยอะ)
          ⚠️ ยังกรองเหลืองานเดียวเหมือนเดิม — ลิงก์ /operation/:id มาจากหลายที่ ถ้าไม่กรองงานอาจไม่อยู่ในหน้านี้ */}
      {selectedEvent && (
        <Stack direction="row" alignItems="center" gap={1.25}
          sx={{ mb: 2, px: 1.5, py: 1.1, borderRadius: 2.5, bgcolor: "#fff", border: "1px solid #e2e8f0", borderLeft: "4px solid #2563eb" }}>
          <Box flex={1} minWidth={0}>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, color: "#64748b" }}>กำลังดูเฉพาะงานนี้</Typography>
            <Typography title={focusedJob.name} noWrap sx={{ fontSize: "0.9rem", fontWeight: 800, color: "#0f172a" }}>{focusedJob.name}</Typography>
            {focusedJob.tags.length > 0 && (
              <Typography noWrap sx={{ fontSize: "0.74rem", color: "#64748b" }}>{focusedJob.tags.join(" · ")}</Typography>
            )}
          </Box>
          <Tooltip title="ดูงานนี้ในปฏิทิน">
            <IconButton aria-label="ดูในปฏิทิน" onClick={() => {
              // งานที่ยังไม่ลงตาราง → หน้า "งานใหม่" (ตารางงานไม่มีแผงแผนล่วงหน้าแล้ว 10 ต.ค. 2569)
              if (selectedEvent.unscheduled) { navigate("/jobs/intake"); return; }
              navigate(`/event?event=${selectedEvent._id}&date=${moment(selectedEvent.start).format("YYYY-MM-DD")}&t=${Date.now()}`);
            }} sx={{ width: 38, height: 38, border: "1px solid #e2e8f0", borderRadius: 2, color: "#334155" }}>
              <CalendarMonth sx={{ fontSize: 19 }} />
            </IconButton>
          </Tooltip>
          <Button size="small" onClick={() => navigate("/operation")}
            sx={{ flexShrink: 0, height: 38, px: 1.25, borderRadius: 2, fontWeight: 700, whiteSpace: "nowrap", color: "#fff", bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8" } }}>
            ดูทั้งหมด
          </Button>
        </Stack>
      )}

      {/* 🧹 แถบแท็บถูกลบออก — เหลือแท็บเดียว ("รายการงาน") มานานแล้วหลังย้าย Dashboard / Timeline /
          รออนุมัติ ออกไปหน้าอื่นหมด แท็บเดียวไม่ได้บอกอะไรกับผู้ใช้เลยแต่กินความสูงราว 90px
          ทุกครั้งที่เปิดหน้า — ชื่อหน้าด้านบนบอกอยู่แล้วว่านี่คือหน้าอะไร
          ⚠️ state activeTab ยังอยู่ (มีโค้ดอื่นตั้งค่าและอ่านค่าอยู่) เผื่อวันหน้ามีแท็บที่สองจริงๆ */}

      {/* ✅ แอดมิน/manager: กลุ่มงาน 4 ตัวเลือก (รอคุณอนุมัติ / กำลังดำเนินการ / ค้างงาน / เสร็จสิ้น)
          ฝั่งช่าง: เหลือแค่ "ค้างงาน" กับ "เสร็จสิ้น" (งานที่กำลังทำ/รออนุมัติ ย้ายไปหน้า "งานของฉัน" หมดแล้ว)
          เดิมใช้ ToggleButtonGroup แบบชิปเล็กเรียงแนวนอน จอมือถือห่อบรรทัดมั่วๆ กดยาก เปลี่ยนเป็น
          การ์ดใหญ่จัดกริด 2 คอลัมน์เสมอบนจอแคบ (แอดมินขยายเป็น 4 คอลัมน์แนวนอนตอนจอกว้างพอ) */}
      {/* ⚠️ เหลือแท็บเดียวแล้ว (รายการงาน) — เงื่อนไขนี้จึงเป็นจริงเสมอ คงไว้เผื่อเพิ่มแท็บในอนาคต */}
      {/* ✅ การ์ดตัวเลขชุดเดียวกับหน้าภาพรวมงาน (ViewTiles) — เดิมเป็นกล่องจัดกลาง ไอคอนเทา ตัวเลขเล็ก
          ผู้ใช้แจ้งว่าดูยาก ไม่รู้ว่ากดสลับได้ · ช่างเห็นแค่ ค้างงาน/เสร็จสิ้น (งานรออนุมัติเป็นของแอดมิน) */}
      {activeTab !== 1 && !isMobile && (
        <ViewTiles
          value={effectiveGroup}
          onChange={setStatusGroup}
          isMobile={isMobile}
          groups={statusTileGroups}
        />
      )}

      {/* ✅ ทางลัดงานตามผู้รับผิดชอบ — ชุดเดียวกับหน้าภาพรวมงาน (กดชื่อเพื่อดูเฉพาะงานของคนนั้น) */}
      {isAdminOrManager && activeTab !== 1 && !id && !isMobile && (
        <ResponsibleSummary
          rows={responsibleRows}
          unit="งาน"
          value={filterResponsible}
          onChange={(v) => { setFilterResponsible(v); setPage(1); }}
          employees={employee}
          isOverdue={isRowOverdue}
          isMobile={isMobile}
        />
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

          {!isMobile && <FilterPanel {...filterPanelProps} />}
          {isMobile && (
            <>
              {/* มือถือ: สิ่งที่กำลังดูอยู่เป็นชิปบรรทัดเดียว — แตะเพื่อเปิดแผ่นตัวกรอง */}
              {/* ✅ แถบสถานะกดสลับได้ทันที (ผู้ใช้: "ยังดูงานที่ค้างยาก") — ค้างงานเป็นแดงเห็นชัดตั้งแต่เปิดหน้า
                  ไม่ต้องเปิดแผ่นตัวกรองก่อน · เลื่อนแนวนอนได้ถ้ามีหลายสถานะ */}
              {!id && (
                <Box sx={{ display: "flex", gap: 0.75, overflowX: "auto", mx: -1.5, px: 1.5, pb: 0.5, mb: 1, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
                  {/* ⚠️ ค้างงานอยู่ถัดจาก "ทั้งหมด" เสมอ — เห็นได้โดยไม่ต้องเลื่อนแถบ */}
                  {[...statusTileGroups[0].items].sort((x, y) => (x.value === "all" ? -2 : x.value === "overdue" ? -1 : 0) - (y.value === "all" ? -2 : y.value === "overdue" ? -1 : 0)).map((it) => {
                    const on = effectiveGroup === it.value;
                    const hot = it.alert && it.count > 0;
                    return (
                      <Box key={it.value} component="button" type="button" onClick={() => { setStatusGroup(it.value); setPage(1); }}
                        sx={{
                          flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 0.75, height: 36, px: 1.5, borderRadius: 999, cursor: "pointer",
                          font: "inherit", fontSize: "0.84rem", fontWeight: 800, whiteSpace: "nowrap",
                          border: `1px solid ${on ? (hot ? "#fecaca" : "#bfdbfe") : "#e2e8f0"}`,
                          bgcolor: on ? (hot ? "#fef2f2" : "#eff6ff") : "#fff",
                          color: on ? (hot ? "#b91c1c" : "#1d4ed8") : "#334155",
                        }}>
                        {it.shortLabel || it.label}
                        <Box component="span" sx={{
                          minWidth: 22, height: 22, px: 0.6, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center",
                          fontSize: "0.74rem", fontWeight: 900,
                          bgcolor: hot ? "#dc2626" : on ? "#2563eb" : "#f1f5f9", color: hot || on ? "#fff" : "#64748b",
                        }}>{it.count}</Box>
                      </Box>
                    );
                  })}
                </Box>
              )}
              <Stack direction="row" gap={0.75} flexWrap="wrap" alignItems="center" sx={{ mb: 1.5 }}>
                <Chip size="small" onClick={() => setMobileSheetOpen(true)} label={showAll ? "ทุกเดือน" : (selectedDate ? moment(selectedDate, "YYYY-MM").add(543, "year").format("MM/YYYY") : "เดือนนี้")} sx={{ fontWeight: 700, bgcolor: "#fff", border: "1px solid #e2e8f0", color: "#334155" }} />
                {filterResponsible !== "all" && (
                  <Chip size="small" label={`ผู้รับผิดชอบ: ${filterResponsible === "unassigned" ? "ยังไม่มอบหมาย" : filterResponsible}`} onDelete={() => setFilterResponsible("all")} sx={{ fontWeight: 700 }} />
                )}
                {search.trim() && <Chip size="small" label={`ค้นหา: ${search.trim()}`} onDelete={() => setSearch("")} sx={{ fontWeight: 700 }} />}
                {filterOP && <Chip size="small" label={`สถานะ: ${filterOP}`} onDelete={() => setFilterOP("")} sx={{ fontWeight: 700 }} />}
                {filterType && <Chip size="small" label={`ประเภท: ${filterType}`} onDelete={() => setFilterType("")} sx={{ fontWeight: 700 }} />}
                {filterSystem && <Chip size="small" label={`ระบบ: ${filterSystem}`} onDelete={() => setFilterSystem("")} sx={{ fontWeight: 700 }} />}
                {filterTeam && <Chip size="small" label={`ทีม: ${filterTeam}`} onDelete={() => setFilterTeam("")} sx={{ fontWeight: 700 }} />}
              </Stack>
              <Drawer
                anchor="bottom" open={mobileSheetOpen} onClose={() => setMobileSheetOpen(false)}
                PaperProps={{ sx: { borderTopLeftRadius: 18, borderTopRightRadius: 18, px: 2, pt: 1, pb: "calc(16px + env(safe-area-inset-bottom))", maxHeight: "88vh" } }}
              >
                <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: "#cbd5e1", mx: "auto", mb: 1.25, flexShrink: 0 }} />
                <Stack direction="row" alignItems="center" sx={{ mb: 1.5, flexShrink: 0 }}>
                  <Typography sx={{ flex: 1, fontWeight: 800, fontSize: "1rem" }}>สถานะและตัวกรอง</Typography>
                  {mobileActiveCount > 0 && (
                    <Button size="small" onClick={() => { clearAllOpFilters(); setStatusGroup("all"); }} sx={{ textTransform: "none", fontWeight: 700, color: "#dc2626" }}>
                      ล้างทั้งหมด
                    </Button>
                  )}
                  <IconButton size="small" aria-label="ปิด" onClick={() => setMobileSheetOpen(false)}><Close /></IconButton>
                </Stack>
                <Box sx={{ overflowY: "auto", mx: -2, px: 2, pb: 1 }}>
                  <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: "text.secondary", mb: 0.75 }}>สถานะ</Typography>
                  <Box sx={{ "& > div": { mb: 1.75 } }}>
                    <ViewTiles value={effectiveGroup} onChange={setStatusGroup} isMobile groups={statusTileGroups} />
                  </Box>
                  {isAdminOrManager && !id && responsibleOptions.total > 0 && (
                    <Box sx={{ mb: 1.5, display: "flex", "& > *": { flex: 1 } }}>
                      <PersonSelectField
                        label="ผู้รับผิดชอบ" title="เลือกผู้รับผิดชอบ" value={filterResponsible} onChange={(v) => { setFilterResponsible(v); setPage(1); }}
                        allLabel="ทุกคน" allCount={responsibleOptions.total} unit="งาน"
                        options={[
                          ...(responsibleOptions.unassigned > 0 ? [{ id: "unassigned", name: "ยังไม่มอบหมาย", count: responsibleOptions.unassigned, unassigned: true }] : []),
                          ...responsibleOptions.list.map(([name, n]) => ({ id: name, name, count: n, avatar: (employee || []).find((e) => e.fname === name)?.imageUrl })),
                        ]}
                      />
                    </Box>
                  )}
                  <FilterPanel {...filterPanelProps} inSheet />
                </Box>
                <Button
                  fullWidth variant="contained" onClick={() => setMobileSheetOpen(false)}
                  sx={{ mt: 1.5, flexShrink: 0, py: 1.1, textTransform: "none", fontWeight: 800, borderRadius: 2.5, boxShadow: "none", bgcolor: "#334155", "&:hover": { bgcolor: "#1e293b", boxShadow: "none" } }}
                >
                  ดูผลลัพธ์ {sortedEvents.length} รายการ
                </Button>
              </Drawer>
            </>
          )}

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
            <>
            <OperationTable
              employee={employee}
              canAssign={can(currentUser, "editContracts")}
              onAssignResponsible={handleAssignResponsible}
              jobGroups={pagedGroups.map((sessions) => ({ sessions }))}
              daysPastDueMap={daysPastDueMap}
              // ✅ กดแถว = เปิดแผงรายละเอียดทับบนตาราง (ไม่สลับทั้งหน้าไปมุมมองการ์ดเหมือนเดิม)
              onOpenJob={(job) => setDetailJobId(job.sessions[0]._id)}
            />
            {paginationBar}
            </>
          ) : (
            <>
              {/* ✅ กลับมาเป็นคอลัมน์เดียว — เดิมลองแบ่ง 2 คอลัมน์บนจอกว้าง แต่การ์ดงานกรุ๊ป (เข้า
                  หลายวันไม่ติดกัน) โชว์แถบวันที่ย่อย + "เข้างาน N วัน" เพิ่มมาตั้งแต่ตอนพับอยู่ ทำให้
                  สูงกว่าการ์ดงานวันเดียวเสมอ วางคู่กันแล้วดูไม่เท่ากัน/ไม่สวย คอลัมน์เดียวเรียงยาวลงมา
                  แทนจะเนียนตากว่า ไม่มีปัญหาความสูงไม่เท่ากันให้กวนตาอีก */}
              {pagedGroups.map(sessions => {
                // ✅ ในมุมมอง "ค้างงาน" ให้เห็นความรุนแรงต่างกันชัดๆ ก่อนเปิดการ์ด — เลย 1 สัปดาห์
                // = แจ้งเตือนสีเหลือง (ให้ทันเห็นก่อน), เลย 2 สัปดาห์ = ค้างงานเต็มตัวสีแดง
                // ✅ แสดงทุกมุมมอง ไม่ใช่เฉพาะแท็บค้างงาน (ผู้ใช้: "ยังดูงานที่ค้างยาก")
                const daysPastDueRaw = daysPastDueMap.get(sessions[0]._id)?.days ?? null;
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
                      <Stack direction="row" alignItems="center" gap={0.75}
                        sx={{
                          mb: -1.25, pb: 1.75, pt: 0.75, px: 1.5, borderRadius: "14px 14px 0 0",
                          bgcolor: severeOverdue ? "#fef2f2" : "#fffbeb", border: `1px solid ${severeOverdue ? "#fecaca" : "#fde68a"}`, borderBottom: 0,
                        }}>
                        <Warning sx={{ fontSize: 16, color: severeOverdue ? "#dc2626" : "#d97706" }} />
                        <Typography sx={{ fontSize: "0.8rem", fontWeight: 900, color: severeOverdue ? "#b91c1c" : "#92400e" }}>
                          {severeOverdue ? `ค้างงาน ${daysPastDue} วัน` : `เลยกำหนด ${daysPastDue} วัน`}
                        </Typography>
                        <Typography sx={{ fontSize: "0.74rem", color: severeOverdue ? "#b91c1c" : "#92400e", opacity: 0.8 }}>· ยังไม่ปิดงาน</Typography>
                      </Stack>
                    )}
                    <JobGroupBlock
                      sessions={sessions}
                      currentUser={currentUser}
                      onAssignResponsible={handleAssignResponsible}
                      employee={employee}
                      onStatusUpdate={handleStatusUpdate}
                      onDateUpdate={handleDateUpdate}
                      onDocNoUpdate={handleDocNoUpdate}
                      onInputUpdate={handleInputUpdate} onPatched={handlePatched}
                      onFileUpload={handleFileUpload}
                      onDeleteFile={(eid, type, fileId) => { setPendingDelete({ id: eid, type, fileId }); setConfirmOpen(true); }}
                      onPreview={handlePreviewFile}
                      onDelete={handleDeleteRow}
                      onApproveClose={handleApproveClose}
                      onRejectClose={handleRejectClose}
                      // ดูเฉพาะงานเดียว (กดมาจากหน้าอื่น) → กางรายละเอียดให้เลย ไม่ต้องกดซ้ำ
                      defaultExpanded={Boolean(focusedJob)}
                      uploadingState={uploadingState}
                      isUploadingState={isUploadingState}
                      uploadProgressState={uploadProgressState}
                      uploadingFileSizeState={uploadingFileSizeState}
                    />
                  </Box>
                );
              })}

              {paginationBar}
            </>
          )}
        </>
      )}

      {/* TAB 1: TIMELINE */}

      {/* TAB 2: แผนงานรออนุมัติ (เฉพาะแอดมิน/manager — ดูคอมเมนต์ที่แท็บด้านบน)
          ⚠️ ซ่อนด้วย CSS แทนการ unmount — ตัวเลขบน badge ของแท็บมาจากแผงนี้ ถ้า unmount ทิ้งตอนอยู่แท็บ
          อื่น badge จะกลับเป็น 0 ทันทีที่สลับแท็บ (และต้องโหลดใหม่ทุกครั้งที่กดกลับเข้ามา) — แผงจะดึง
          ข้อมูลรอบแรกให้เสมอ แต่หยุดรีเฟรชอัตโนมัติเมื่อไม่ได้เปิดอยู่ (ดู prop active) */}



      {/* ── แผงรายละเอียดงาน (จากตาราง) — ขวามือบนจอใหญ่ · เต็มจอบนมือถือ ── */}
      <Drawer
        anchor={isMobile ? "bottom" : "right"}
        open={Boolean(detailSessions)}
        onClose={() => setDetailJobId(null)}
        PaperProps={{ sx: {
          width: isMobile ? "100%" : "min(640px, 92vw)",
          height: isMobile ? "92dvh" : "100%",
          borderTopLeftRadius: isMobile ? 16 : 0, borderTopRightRadius: isMobile ? 16 : 0,
          bgcolor: "#f8fafc",
        } }}
      >
        {detailSessions && (() => {
          const head = detailSessions[0];
          return (
            <>
              <Stack direction="row" alignItems="center" gap={1.25}
                sx={{ px: 2, py: 1.5, bgcolor: "background.paper", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 2 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontWeight: 800, fontSize: "1rem", lineHeight: 1.3 }}>
                    {head.site || head.company || "รายละเอียดงาน"}
                  </Typography>
                  <Typography noWrap sx={{ fontSize: "0.76rem", color: "text.secondary" }}>
                    {[head.title, head.system, head.company && head.site ? head.company : ""].filter(Boolean).join(" · ")}
                  </Typography>
                </Box>
                <Button
                  size="small" startIcon={<CalendarMonth sx={{ fontSize: 16 }} />}
                  onClick={() => {
                    // งานที่ยังไม่ลงตาราง → หน้า "งานใหม่" (ตารางงานไม่มีแผงแผนล่วงหน้าแล้ว 10 ต.ค. 2569)
                    if (head.unscheduled) { navigate("/jobs/intake"); return; }
                    navigate(`/event?event=${head._id}&date=${moment(head.start).format("YYYY-MM-DD")}&t=${Date.now()}`);
                  }}
                  sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, flexShrink: 0 }}
                >
                  ดูในปฏิทิน
                </Button>
                <IconButton size="small" onClick={() => setDetailJobId(null)} aria-label="ปิด"><Close fontSize="small" /></IconButton>
              </Stack>
              <Box sx={{ p: { xs: 1.5, sm: 2 }, overflowY: "auto", flex: 1 }}>
                <JobGroupBlock
                  key={detailJobId}
                  inlineDetails
                  sessions={detailSessions}
                  currentUser={currentUser}
                  onAssignResponsible={handleAssignResponsible}
                  employee={employee}
                  onStatusUpdate={handleStatusUpdate}
                  onDateUpdate={handleDateUpdate}
                  onDocNoUpdate={handleDocNoUpdate}
                  onInputUpdate={handleInputUpdate} onPatched={handlePatched}
                  onFileUpload={handleFileUpload}
                  onDeleteFile={(eid, type, fileId) => { setPendingDelete({ id: eid, type, fileId }); setConfirmOpen(true); }}
                  onPreview={handlePreviewFile}
                  onDelete={(...args) => { setDetailJobId(null); return handleDeleteRow(...args); }}
                  onApproveClose={handleApproveClose}
                  onRejectClose={handleRejectClose}
                  uploadingState={uploadingState}
                  isUploadingState={isUploadingState}
                  uploadProgressState={uploadProgressState}
                  uploadingFileSizeState={uploadingFileSizeState}
                />
              </Box>
            </>
          );
        })()}
      </Drawer>

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