/**
 * QuotationTracking.js — ติดตามใบเสนอราคา (admin/manager/ช่าง — ดูขอบเขตสิทธิ์ด้านล่าง)
 *
 * เดิมช่างอัพโหลดใบเสนอราคาเข้า Operation ได้อยู่แล้ว (quotationFiles/quotationApplicable) แต่ไม่มี
 * ที่ไหนติดตามต่อว่า "ส่งลูกค้าหรือยัง / ลูกค้าตอบว่าอย่างไร / ต้องติดตามไหม" เลย — หน้านี้เพิ่ม
 * lifecycle ให้ครบ: รอช่างแนบไฟล์ → รอส่งลูกค้า → ส่งแล้วรอลูกค้าตอบ (ไม่ได้ติดต่อลูกค้าเกิน 7 วัน = ต้องติดตามด่วน)
 * → อนุมัติ/ปฏิเสธ/ขอแก้ไข (วนกลับไปส่งใหม่ได้)
 *
 * ✅ v2: มือถือใช้ยาก — เดิมแท็บกรองสถานะเป็นแถว Chip เลื่อนแนวนอน (ล้นขอบจอ มองแล้วเหมือนตัด)
 * และแตะการ์ดแล้วกางลงในหน้า (Collapse) ต้องเลื่อนจอตามยาว แก้เป็น: แท็บกรองรวมเป็นปุ่มเดียว กดแล้ว
 * เด้งเมนูขึ้นมาเลือก (ไม่มีเลื่อนแนวนอนอีกต่อไป), แตะการ์ดแล้วเด้งเป็น Dialog เต็มจอแทนการกางในหน้า
 *
 * ✅ v3: เปิดให้ช่างเข้าดู "งานของตัวเอง" ได้ด้วย (เดิม admin/manager เท่านั้น) — ช่างดูสถานะ/ไฟล์
 * (read-only, เหมือนเดิม) และบันทึก "การติดตามลูกค้า" แบบเป็นครั้งๆ (ครั้งที่ 1,2,3... พร้อมแนบ
 * หลักฐานถ้ามี) ได้ แต่การเปลี่ยนสถานะ (ส่ง/อนุมัติ/ปฏิเสธ/แก้ไข) และมูลค่าใบเสนอราคายังเป็นสิทธิ์
 * admin/manager เท่านั้น (เทียบ pattern เดียวกับ flow ขอปิดงานที่ต้อง admin อนุมัติ) — เพิ่มตัวกรอง
 * "แยกตามช่าง" (admin/manager เท่านั้น) ให้เห็นว่าช่างแต่ละคนมีใบเสนอราคาค้างอยู่เท่าไหร่
 *
 * โครงสร้าง/pattern อ้างอิงจาก views/ui/TeamWorkload.js (หน้า standalone แบบเดียวกัน) — เช็คสิทธิ์เอง
 * ในนี้ (ไม่ผ่าน AdminRoute), ใช้ EventService.getEventOp() ตัวเดียวกับ Operation/MyJobs/TeamWorkload
 * (backend scope ตาม role ให้แล้ว — ช่างเห็นแค่งานตัวเอง ไม่ต้อง endpoint ใหม่)
 *
 * ส่วน UI ไฟล์แนบ/คุยกับช่าง ใช้ GlassCard/StatCard/FileUploadSection/CommentThread ตัวเดียวกับหน้า
 * Operation จริง (export เพิ่มจากไฟล์นั้น) แทนการ copy โค้ดเมนู "⋮"/แชร์/พิมพ์ไฟล์มาซ้ำ
 */

import { useEffect, useState, useCallback, useMemo, useRef, memo } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import moment from "moment";
import "moment/locale/th";
import { alpha } from "@mui/material/styles";
import {
  Box, Stack, Typography, TextField, InputAdornment, IconButton, Chip, Avatar,
  Tooltip, Skeleton, Snackbar, Alert, Button, Divider, Grid, CardContent,
  Menu, MenuItem, ListItemIcon, ListItemText, Dialog, DialogContent,
  useMediaQuery, useTheme, Pagination,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  ToggleButtonGroup, ToggleButton,
} from "@mui/material";
import {
  Search, Clear, Refresh, RequestQuote, Send, CheckCircle, Cancel,
  Autorenew, HourglassTop, Warning, ExpandMore, ChevronRight, AttachFile,
  Chat, OpenInNew, PriceCheck, Close, History, Person,
  ViewList, TableChart, Description,
} from "@mui/icons-material";
// ✅ ไอคอนไฟล์ Excel — ใช้ตัวเดียวกับปุ่มส่งออก Excel ในหน้าปฏิทิน (EventCalendar) ให้ทั้งแอปสื่อความหมาย
// เดียวกัน (MUI ไม่มีไอคอนไฟล์ Excel ในชุดมาตรฐาน จึงใช้ FontAwesome ที่โปรเจกต์ติดตั้งไว้แล้ว)
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileExcel } from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../../auth/AuthContext";
import EventService from "../../services/EventService";
import AuthService from "../../services/authService";
import { GlassCard, StatCard, FileUploadSection, CommentThread, FilePreviewDialog } from "../../components/Operation";
import { getOverdueGroupKey, resolveAssignedTechnician } from "../../utils/overdueJobs";
import { WARNING_DAYS_AFTER_SENT, getFollowUpInfo, resolveQuotationGroup } from "../../utils/quotationTracking";
import { formatEventDateRange } from "../../utils/formatDateRange";
import { formatRoundLabel } from "../../utils/contractRounds";

const STATUS_META = {
  waiting_file: { label: "รอช่างแนบไฟล์",   color: "#6b7280", icon: <AttachFile sx={{ fontSize: 14 }} /> },
  not_sent:     { label: "รอส่งลูกค้า",      color: "#f59e0b", icon: <HourglassTop sx={{ fontSize: 14 }} /> },
  sent:         { label: "รอลูกค้าตอบ",      color: "#3b82f6", icon: <Send sx={{ fontSize: 14 }} /> },
  follow_up:    { label: "ต้องติดตามด่วน",   color: "#ef4444", icon: <Warning sx={{ fontSize: 14 }} /> },
  revising:     { label: "ลูกค้าขอแก้ไข",    color: "#8b5cf6", icon: <Autorenew sx={{ fontSize: 14 }} /> },
  approved:     { label: "อนุมัติแล้ว",       color: "#10b981", icon: <CheckCircle sx={{ fontSize: 14 }} /> },
  rejected:     { label: "ปฏิเสธแล้ว",        color: "#94a3b8", icon: <Cancel sx={{ fontSize: 14 }} /> },
};

// ✅ เมนูกรองสถานะ (ปุ่ม+popup) ตัดเหลือแค่ 3 กลุ่มที่ใช้จริง (รอลูกค้าตอบ/อนุมัติ/ปฏิเสธ) — ตัด
// "ลูกค้าขอแก้ไข" ออกจากแท็บ/การ์ดสรุปแล้วตามที่ขอ (ไม่มีใครดูอยู่แล้ว) แต่ยังกดสั่งจากเมนู "เปลี่ยน
// สถานะ" ต่องานได้เหมือนเดิม (STATUS_ACTIONS) แค่ไม่ต้องมีแท็บ/การ์ดสรุปแยกให้รกอีกต่อไป — งานที่เคย
// ตั้งเป็น "ลูกค้าขอแก้ไข" ไว้แล้วจึงพับไปรวมกับ "รอลูกค้าตอบ" แทน (การ์ดยังโชว์ป้ายสถานะจริงของตัวเอง
// อยู่ ไม่ได้หายไปไหน) — งานที่ยังไม่ถึงขั้นตอนคุยกับลูกค้า (รอช่างแนบไฟล์/รอส่งลูกค้า) และงานที่ส่งแล้ว
// เกินกำหนดต้องติดตามด่วน ก็รวมอยู่ใน "รอลูกค้าตอบ" เหมือนเดิม
const TAB_GROUP_MAP = {
  waiting_file: "pending",
  not_sent: "pending",
  sent: "pending",
  follow_up: "pending",
  revising: "pending",
  approved: "approved",
  rejected: "rejected",
};
const TAB_META = {
  pending:  { label: "รอลูกค้าตอบ",   color: "#3b82f6", icon: <Send sx={{ fontSize: 14 }} /> },
  approved: { label: "อนุมัติแล้ว",    color: "#10b981", icon: <CheckCircle sx={{ fontSize: 14 }} /> },
  rejected: { label: "ปฏิเสธแล้ว",     color: "#94a3b8", icon: <Cancel sx={{ fontSize: 14 }} /> },
};
const TABS = ["pending", "approved", "rejected"];
// ✅ เรียงลำดับความเร่งด่วนภายในแท็บ "รอลูกค้าตอบ" ที่รวมหลายสถานะย่อยไว้ด้วยกัน — ต้องติดตามด่วน
// ขึ้นก่อนสุด ไล่ไปจนถึงรอช่างแนบไฟล์ (ยังทำอะไรกับลูกค้าไม่ได้จนกว่าจะมีไฟล์)
const PENDING_PRIORITY = { follow_up: 0, sent: 1, revising: 2, not_sent: 3, waiting_file: 4 };

// ✅ ใช้กับปุ่ม "เปลี่ยนสถานะ" ที่กดได้ตลอดเวลาไม่ว่างานจะอยู่สถานะไหนอยู่ก็ตาม (ไม่ต้องรอให้ปุ่ม
// ตามลำดับขั้นตอนโผล่มาเอง) — เผื่อกรณีกดผิด/ต้องแก้ไขข้ามขั้นตอน เช่น จากอนุมัติแล้วสลับไปขอแก้ไขตรงๆ
const STATUS_ACTIONS = [
  { action: "send",    label: "ส่งใบเสนอราคาให้ลูกค้าแล้ว", icon: <Send sx={{ fontSize: 16 }} />,      color: "#3b82f6" },
  { action: "approve", label: "ลูกค้าอนุมัติ",                icon: <CheckCircle sx={{ fontSize: 16 }} />, color: "#10b981" },
  { action: "reject",  label: "ลูกค้าปฏิเสธ",                 icon: <Cancel sx={{ fontSize: 16 }} />,      color: "#94a3b8" },
];

// ─── ช่องกรอก "มูลค่าใบเสนอราคา" แบบกดแก้ตรงจุด (เทียบ pattern เดียวกับ docNo ในหน้า Operation) ───
// 🐛 ปรับตามที่ผู้ใช้แจ้ง (ราคาที่แสดง/แก้ไข ต้องเป็นราคาของ "ใบเสนอราคา" ไม่ใช่ราคางาน):
// ค่านี้เก็บที่ฟิลด์ quotationAmount ซึ่งเป็นฟิลด์อิสระจาก jobValue (ราคางานตามสัญญา) อยู่แล้วตั้งแต่แรก
// — ฝั่งข้อมูลถูกต้องดี แต่ "หน้าจอเรียกมันว่า มูลค่างาน" ซึ่งเป็นคำเดียวกับที่หน้า "ภาพรวมงาน" ใช้เรียก
// jobValue เป๊ะๆ ผู้ใช้จึงเข้าใจว่าตัวเลขนี้ดึงมาจากราคางานอัตโนมัติ ทั้งที่จริงต้องกรอกเองทุกใบ
// ✅ เปลี่ยนชื่อให้ตรงความหมาย ("มูลค่าใบเสนอราคา") + เปลี่ยนจากลิงก์ตัวหนังสือเล็กๆ ซ่อนมุมขวา เป็นช่อง
// กรอกที่เห็นชัดพร้อมป้ายกำกับ เพราะเป็นค่าที่ "ต้องกรอกเพิ่มเอง" ไม่มีทางมาเองได้ ถ้าไม่เด่นก็ไม่มีใครกรอก
// แล้วยอดรวมในการ์ดสรุปจะต่ำกว่าความจริงโดยไม่มีใครรู้
const AmountEditor = ({ value, onSave, compact = false }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  const save = () => {
    setEditing(false);
    const num = draft === "" ? null : Number(draft);
    if (num !== value) onSave(num);
  };

  if (editing) {
    return (
      <Stack direction="row" gap={0.5} alignItems="center" onClick={(e) => e.stopPropagation()}>
        <TextField size="small" type="number" autoFocus
          value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setDraft(value ?? ""); setEditing(false); } }}
          placeholder="0"
          InputProps={{ startAdornment: <Typography sx={{ mr: 0.5, color: "text.disabled" }}>฿</Typography> }}
          inputProps={{ min: 0, style: { fontSize: "0.85rem" } }}
          sx={{ width: 150 }} />
        <Button size="small" variant="contained" onClick={save} sx={{ textTransform: "none", minWidth: "auto", px: 1.25 }}>บันทึก</Button>
        <Button size="small" color="inherit" onClick={() => { setDraft(value ?? ""); setEditing(false); }}
          sx={{ textTransform: "none", minWidth: "auto", px: 1 }}>ยกเลิก</Button>
      </Stack>
    );
  }

  // ✅ โหมดกระชับ (ใช้ในการ์ดรายการ) — แค่แสดงค่า ไม่ต้องมีกรอบ
  if (compact) {
    return (
      <Stack direction="row" gap={0.5} alignItems="center"
        sx={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setEditing(true); }}>
        <PriceCheck sx={{ fontSize: 15, color: "text.disabled" }} />
        <Typography variant="caption" color={value ? "text.primary" : "warning.main"} fontWeight={700}
          sx={{ "&:hover": { color: "primary.main", textDecoration: "underline" } }}>
          {value ? `฿${Number(value).toLocaleString()}` : "กรอกมูลค่าใบเสนอราคา"}
        </Typography>
      </Stack>
    );
  }

  // ✅ โหมดเต็ม (กล่องรายละเอียด) — ยังไม่กรอก = กล่องสีส้มชวนให้กด ไม่ใช่ข้อความเทาจางที่มองข้ามได้
  return (
    <Box
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      sx={{
        p: 1.25, borderRadius: 2, cursor: "pointer", width: "100%",
        border: "1px solid",
        borderColor: value ? "divider" : alpha("#f59e0b", 0.5),
        bgcolor: value ? "transparent" : alpha("#f59e0b", 0.07),
        transition: "border-color .15s, background-color .15s",
        "&:hover": { borderColor: "primary.main" },
      }}
    >
      <Stack direction="row" alignItems="center" gap={1}>
        <PriceCheck sx={{ fontSize: 18, color: value ? "text.disabled" : "#b45309" }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: "block", lineHeight: 1.2 }}>
            มูลค่าใบเสนอราคา
          </Typography>
          <Typography fontWeight={800} fontSize="1rem" color={value ? "text.primary" : "#b45309"} sx={{ lineHeight: 1.3 }}>
            {value ? `฿${Number(value).toLocaleString()}` : "ยังไม่ระบุ — กดเพื่อกรอก"}
          </Typography>
        </Box>
        <Typography variant="caption" color="primary.main" fontWeight={700} sx={{ flexShrink: 0 }}>
          {value ? "แก้ไข" : "กรอก"}
        </Typography>
      </Stack>
      {/* ✅ บอกให้ชัดว่าเป็นคนละตัวกับราคางานตามสัญญา กันกรอกผิดช่อง/เข้าใจว่าระบบดึงมาให้เอง */}
      <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 0.4, fontSize: "0.68rem" }}>
        ราคาที่เสนอลูกค้าในใบนี้ — แยกจาก "มูลค่างาน" ของสัญญาในหน้าภาพรวมงาน
      </Typography>
    </Box>
  );
};

// ─── บรรทัดข้อมูล "ไอคอน + ป้ายกำกับ : ค่า" — เทียบ pattern เดียวกับ InfoLine ในหน้า Operation
// (EventRowCard) ให้การ์ดใบเสนอราคาแสดงรายละเอียดงานครบแบบเดียวกัน (ระบบ/โครงการ/ครั้งที่/ทีม) ───
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

// ─── การ์ดสรุปต่องาน (แตะแล้วเด้ง Dialog รายละเอียดขึ้นมา — ไม่กางลงในหน้าอีกต่อไป) ───────
// ✅ perf: auto-refresh ทุก 30 วิ แทนที่ events ทั้งก้อนด้วย object ใหม่เสมอ (แม้ข้อมูลจริงไม่เปลี่ยน)
// memo ไว้เทียบด้วยค่าจริง (updatedAt/groupKey) กันการ์ดที่ไม่มีอะไรเปลี่ยนต้อง re-render ทุก tick —
// onOpen ต้องเป็น stable reference จากต้นทาง (เป็น setDetailJob ตรงๆ อยู่แล้ว จึง stable โดยธรรมชาติ)
const QuotationCard = memo(({ job, onOpen, onPreview }) => {
  const anchor = job.sessions[0];
  const groupKey = job.groupKey;
  // ✅ ไฟล์ใบเสนอราคาจริง — เดิมต้องเปิดการ์ด → เลื่อนหาส่วนไฟล์ → ค่อยกดดู (3 ขั้น) ทั้งที่เป็นสิ่งที่
  // อยากดูบ่อยที่สุดในหน้านี้ ตอนนี้กดจากการ์ดได้เลยในขั้นเดียว
  const quotationFiles = anchor.quotationFiles || [];
  const meta = STATUS_META[groupKey] || STATUS_META.not_sent;
  // ✅ ข้อมูลติดตามครบชุดจาก util กลาง (นับจาก "ติดต่อลูกค้าครั้งล่าสุด" ไม่ใช่วันที่ส่งอย่างเดียว)
  const followUp = getFollowUpInfo(anchor);

  return (
    <GlassCard sx={{ mb: 1.5, border: "1px solid", borderColor: alpha(meta.color, 0.3), cursor: "pointer" }}
      onClick={() => onOpen(job)}>
      <Box sx={{ p: 2 }}>
        <Stack direction="row" alignItems="flex-start" gap={1.5}>
          <Avatar sx={{
            width: 36, height: 36, flexShrink: 0,
            bgcolor: alpha(meta.color, 0.15), color: meta.color,
          }}>
            <RequestQuote sx={{ fontSize: 18 }} />
          </Avatar>

          <Box minWidth={0} flex={1}>
            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{ mb: 0.5 }}>
              <Chip size="small" icon={meta.icon} label={meta.label} sx={{
                height: 22, fontSize: "0.68rem", fontWeight: 700,
                bgcolor: alpha(meta.color, 0.12), color: meta.color, "& .MuiChip-icon": { color: meta.color },
              }} />
              <Typography variant="caption" color="text.secondary" fontWeight={600} noWrap>
                📅 {formatEventDateRange(anchor)}
              </Typography>
              {/* ✅ เดิมโชว์แค่ "N วัน" เฉยๆ เฉพาะตอนเลยกำหนด ซึ่งนับจากวันที่ส่งเสมอ — ใบที่ตามไปแล้ว
                  5 ครั้งกับใบที่ปล่อยทิ้งไว้เฉยๆ จึงหน้าตาเหมือนกันเป๊ะ แยกไม่ออกว่าต้องจัดการแบบไหน
                  ✅ ตอนนี้บอก "เงียบมากี่วันนับจากติดต่อครั้งล่าสุด" (ตรงกับเกณฑ์เตือนจริง) และใบที่ยัง
                  ไม่ถึงกำหนดก็บอกว่าเหลืออีกกี่วัน ให้วางแผนล่วงหน้าได้ ไม่ใช่รอจนแดงแล้วค่อยรู้ */}
              {followUp?.needsFollowUp && (
                <Chip size="small" label={`เงียบ ${followUp.daysSinceLastContact} วัน`} sx={{
                  height: 22, fontSize: "0.68rem", fontWeight: 700, bgcolor: alpha("#ef4444", 0.12), color: "#ef4444",
                }} />
              )}
              {followUp && !followUp.needsFollowUp && (
                <Chip size="small"
                  label={followUp.daysUntilDue > 0 ? `ตามอีกใน ${followUp.daysUntilDue} วัน` : "ถึงกำหนดตามวันนี้"}
                  sx={{
                    height: 22, fontSize: "0.68rem", fontWeight: 600,
                    bgcolor: alpha(followUp.daysUntilDue > 0 ? "#64748b" : "#f59e0b", 0.1),
                    color: followUp.daysUntilDue > 0 ? "#64748b" : "#b45309",
                  }} />
              )}
              {/* ✅ เห็นได้ทันทีจากการ์ดว่าเคยตามไปแล้วกี่ครั้ง ไม่ต้องเปิดเข้าไปดูข้างในก่อน */}
              {followUp?.followUpCount > 0 && (
                <Chip size="small" label={`☎️ ตามแล้ว ${followUp.followUpCount} ครั้ง`} sx={{
                  height: 22, fontSize: "0.68rem", fontWeight: 600,
                  bgcolor: alpha("#0ea5e9", 0.1), color: "#0369a1",
                }} />
              )}
            </Stack>

            {anchor.title && (
              <Typography fontWeight={700} fontSize="0.92rem" noWrap>[{anchor.title}]</Typography>
            )}

            <Stack spacing={0.3} sx={{ mt: 0.4 }}>
              {anchor.system && <InfoLine icon="💻" label="ระบบ">{anchor.system}</InfoLine>}
              <InfoLine icon="🏢" label="โครงการ">
                {anchor.company && anchor.site ? `${anchor.company} · ${anchor.site}` : (anchor.company || anchor.site || "ไม่ระบุโครงการ")}
              </InfoLine>
              {anchor.time && <InfoLine icon="🔢" label="ครั้งที่">{formatRoundLabel(anchor.time, anchor.visitCount)}</InfoLine>}
              {anchor.team && <InfoLine icon="👷" label="ทีม">{anchor.team}</InfoLine>}
              {anchor.docNo && <InfoLine icon="📄" label="เอกสาร">{anchor.docNo}</InfoLine>}
            </Stack>

            {/* ✅ เดิมโชว์แค่ตัวเลข "฿86,000" ลอยๆ ไม่มีป้ายกำกับ อ่านแล้วเดาไม่ออกว่าเป็นราคาอะไร
                (ราคางาน? ราคาใบเสนอราคา?) และถ้ายังไม่กรอกก็ไม่แสดงอะไรเลย จนไม่มีใครรู้ว่าขาดอยู่ —
                ตอนนี้ติดป้ายชัดเจน และใบที่ยังไม่กรอกขึ้นเตือนเป็นสีส้มให้เห็นตั้งแต่หน้ารายการ */}
            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{ mt: 0.75 }}>
              <Typography variant="caption">
                {anchor.quotationAmount ? (
                  <>
                    <Box component="span" sx={{ color: "text.secondary" }}>💰 มูลค่าใบเสนอราคา : </Box>
                    <Box component="span" sx={{ fontWeight: 800 }}>฿{Number(anchor.quotationAmount).toLocaleString()}</Box>
                  </>
                ) : (
                  <Box component="span" sx={{ color: "#b45309", fontWeight: 700 }}>
                    💰 ยังไม่ระบุมูลค่าใบเสนอราคา
                  </Box>
                )}
              </Typography>
              <Box sx={{ flex: 1 }} />
              {/* ✅ ลิงก์เปิด "ใบเสนอราคาจริง" ตรงจากการ์ด — หยุด event ไม่ให้ลอยไปเปิด Dialog รายละเอียด */}
              {quotationFiles.length > 0 ? (
                <Button
                  size="small" variant="outlined" startIcon={<Description sx={{ fontSize: 15 }} />}
                  onClick={(e) => { e.stopPropagation(); onPreview(quotationFiles[0].fileUrl, quotationFiles[0].fileName); }}
                  sx={{ textTransform: "none", borderRadius: 2, fontSize: "0.7rem", py: 0.25 }}
                >
                  ดูใบเสนอราคา{quotationFiles.length > 1 ? ` (${quotationFiles.length})` : ""}
                </Button>
              ) : (
                <Chip size="small" label="ยังไม่มีไฟล์" sx={{
                  height: 20, fontSize: "0.65rem", bgcolor: alpha("#94a3b8", 0.12), color: "#64748b",
                }} />
              )}
            </Stack>
          </Box>

          <ChevronRight sx={{ color: "text.disabled", flexShrink: 0, mt: 0.5 }} />
        </Stack>
      </Box>
    </GlassCard>
  );
}, (prev, next) => {
  const prevAnchor = prev.job.sessions[0];
  const nextAnchor = next.job.sessions[0];
  return (
    prevAnchor._id === nextAnchor._id &&
    prevAnchor.updatedAt === nextAnchor.updatedAt &&
    prev.job.groupKey === next.job.groupKey &&
    prev.onOpen === next.onOpen
  );
});

// ─── มุมมองตาราง — ทางเลือกของการ์ด สำหรับดูหลายรายการพร้อมกัน/เปรียบเทียบ/หายอดรวม ────────
// ✅ การ์ดอ่านง่ายทีละใบก็จริง แต่พอมี 30-40 ใบต้องเลื่อนยาวมากและเทียบข้ามใบไม่ได้เลย (เช่น อยากรู้ว่า
// ใบไหนเงียบนานสุด/มูลค่าเท่าไหร่บ้าง) ตารางตอบโจทย์คนละแบบ — ให้สลับได้ตามงานที่กำลังทำอยู่
const QuotationTable = ({ jobs, onOpen, onPreview }) => (
  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3, overflowX: "auto" }}>
    {/* ✅ minWidth กันตารางถูกบีบจนอ่านไม่ออกบนจอแคบ (ยังเลื่อนแนวนอนได้) แต่บนจอกว้างให้ยืดเต็มพื้นที่
        ที่มี ไม่ใช่ค้างอยู่ที่ 1100px แล้วเหลือที่ว่างข้างๆ เปล่าๆ */}
    <Table size="small" sx={{ minWidth: 1000, width: "100%" }}>
      <TableHead>
        <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "#eff6ff", color: "#1e3a8a", whiteSpace: "nowrap" } }}>
          <TableCell>สถานะ</TableCell>
          <TableCell>บริษัท / โครงการ</TableCell>
          <TableCell>ประเภทงาน · ระบบ</TableCell>
          <TableCell align="right">มูลค่าใบเสนอราคา</TableCell>
          <TableCell align="center">ส่งลูกค้า</TableCell>
          <TableCell align="center">ตามแล้ว</TableCell>
          <TableCell align="center">เงียบมา</TableCell>
          <TableCell align="center">ใบเสนอราคา</TableCell>
          <TableCell align="center" />
        </TableRow>
      </TableHead>
      <TableBody>
        {jobs.map((job, idx) => {
          const a = job.sessions[0];
          const meta = STATUS_META[job.groupKey] || STATUS_META.not_sent;
          const info = getFollowUpInfo(a);
          const files = a.quotationFiles || [];
          return (
            <TableRow
              key={a._id} hover
              onClick={() => onOpen(job)}
              sx={{ cursor: "pointer", bgcolor: idx % 2 ? alpha("#0f172a", 0.02) : "transparent" }}
            >
              <TableCell sx={{ whiteSpace: "nowrap" }}>
                <Chip size="small" icon={meta.icon} label={meta.label} sx={{
                  height: 22, fontSize: "0.68rem", fontWeight: 700,
                  bgcolor: alpha(meta.color, 0.12), color: meta.color, "& .MuiChip-icon": { color: meta.color },
                }} />
              </TableCell>
              <TableCell sx={{ maxWidth: 240 }}>
                <Typography variant="caption" fontWeight={700} noWrap sx={{ display: "block" }}>
                  {a.company || "-"}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                  {a.site || "-"}
                </Typography>
              </TableCell>
              <TableCell sx={{ maxWidth: 180 }}>
                <Typography variant="caption" noWrap sx={{ display: "block" }}>{a.title || "-"}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>{a.system || "-"}</Typography>
              </TableCell>
              <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                {a.quotationAmount ? (
                  <Typography variant="caption" fontWeight={800}>฿{Number(a.quotationAmount).toLocaleString()}</Typography>
                ) : (
                  <Typography variant="caption" sx={{ color: "#b45309", fontWeight: 700 }}>ยังไม่ระบุ</Typography>
                )}
              </TableCell>
              <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                <Typography variant="caption" color="text.secondary">
                  {a.quotationSentAt ? moment(a.quotationSentAt).locale("th").format("D MMM YY") : "-"}
                </Typography>
              </TableCell>
              <TableCell align="center">
                <Typography variant="caption" fontWeight={info?.followUpCount ? 700 : 400}
                  color={info?.followUpCount ? "success.main" : "text.disabled"}>
                  {info ? `${info.followUpCount} ครั้ง` : "-"}
                </Typography>
              </TableCell>
              <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                {info ? (
                  <Typography variant="caption" fontWeight={info.needsFollowUp ? 800 : 400}
                    color={info.needsFollowUp ? "error.main" : "text.secondary"}>
                    {info.daysSinceLastContact} วัน
                  </Typography>
                ) : <Typography variant="caption" color="text.disabled">-</Typography>}
              </TableCell>
              <TableCell align="center">
                {files.length > 0 ? (
                  <Tooltip title={files[0].fileName || "เปิดใบเสนอราคา"}>
                    <IconButton size="small" color="primary"
                      onClick={(e) => { e.stopPropagation(); onPreview(files[0].fileUrl, files[0].fileName); }}>
                      <Description sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Typography variant="caption" color="text.disabled">ไม่มีไฟล์</Typography>
                )}
              </TableCell>
              <TableCell align="center">
                <ChevronRight sx={{ color: "text.disabled", fontSize: 18 }} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  </TableContainer>
);

// ─── ประวัติการติดตามลูกค้า — บันทึกได้ทั้งช่างและแอดมิน/manager (คนที่โทร/คุยกับลูกค้าจริงมักเป็น
// ช่าง) ครั้งที่นับอัตโนมัติจากจำนวนรายการเดิม (server คำนวณจริง ฝั่งนี้แค่โชว์ผลลัพธ์ที่ได้กลับมา) ───
const FollowUpSection = ({ job, onSubmit, onPreview }) => {
  const anchor = job.sessions[0];
  const followUps = anchor.quotationFollowUps || [];
  const followUpInfo = getFollowUpInfo(anchor);
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef();

  const handleSubmit = async () => {
    if (!note.trim() || submitting) return;
    setSubmitting(true);
    await onSubmit(job, note.trim(), file);
    setNote("");
    setFile(null);
    setSubmitting(false);
  };

  return (
    <Box>
      <Typography variant="caption" fontWeight={700} color="text.secondary"
        sx={{ textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
        <History sx={{ fontSize: 14 }} /> ประวัติการติดตามลูกค้า{followUps.length > 0 && ` (${followUps.length})`}
      </Typography>

      {/* ✅ สรุปสถานะติดตามให้เห็นชัดในบรรทัดเดียว — ตามที่ผู้ใช้ขอ ("บันทึกผลแล้วให้แสดงให้ชัดเจน และ
          นับไปอีก 7 วัน") เดิมต้องไล่อ่านรายการประวัติเองแล้วคำนวณในหัวว่าครบกำหนดหรือยัง */}
      {followUpInfo && (
        <Box sx={{
          p: 1.25, mb: 1.5, borderRadius: 2,
          bgcolor: alpha(followUpInfo.needsFollowUp ? "#ef4444" : "#10b981", 0.07),
          border: "1px solid",
          borderColor: alpha(followUpInfo.needsFollowUp ? "#ef4444" : "#10b981", 0.25),
        }}>
          <Typography variant="caption" fontWeight={700}
            sx={{ display: "block", color: followUpInfo.needsFollowUp ? "#b91c1c" : "#047857" }}>
            {followUpInfo.needsFollowUp
              ? `⚠️ ถึงเวลาติดตาม — เงียบมา ${followUpInfo.daysSinceLastContact} วันแล้ว`
              : followUpInfo.daysUntilDue > 0
                ? `✅ ติดตามแล้ว — ครบกำหนดตามรอบถัดไปอีก ${followUpInfo.daysUntilDue} วัน`
                : "⏰ ครบกำหนดติดตามรอบถัดไปวันนี้"}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
            {followUpInfo.lastContactIsFollowUp
              ? `ติดตามล่าสุด ${followUpInfo.lastContactAt.locale("th").format("D MMM YYYY")}`
              : `ส่งใบเสนอราคา ${followUpInfo.lastContactAt.locale("th").format("D MMM YYYY")}`}
            {" · "}ครบกำหนด {followUpInfo.dueAt.locale("th").format("D MMM YYYY")}
            {followUpInfo.daysSinceSent !== followUpInfo.daysSinceLastContact &&
              ` · ส่งไปแล้วรวม ${followUpInfo.daysSinceSent} วัน`}
          </Typography>
        </Box>
      )}

      {followUps.length > 0 && (
        <Stack spacing={1} sx={{ mb: 1.5 }}>
          {followUps.slice().reverse().map((f, i) => (
            <Box key={f._id || i} sx={{ p: 1.25, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" fontWeight={700} color="primary.main">ครั้งที่ {f.attemptNumber}</Typography>
                <Typography variant="caption" color="text.secondary">{moment(f.contactedAt).locale("th").format("DD MMM YYYY HH:mm")}</Typography>
              </Stack>
              {f.note && <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}>{f.note}</Typography>}
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
                <Typography variant="caption" color="text.secondary">โดย {f.userName}</Typography>
                {f.evidenceFileUrl && (
                  <Button size="small" startIcon={<AttachFile fontSize="small" />}
                    onClick={() => onPreview(f.evidenceFileUrl, f.evidenceFileName)}
                    sx={{ fontSize: "0.7rem", textTransform: "none", minWidth: "auto", p: 0.5 }}>
                    ดูหลักฐาน
                  </Button>
                )}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      <Stack spacing={1}>
        <TextField multiline minRows={2} size="small" placeholder="บันทึกการติดตาม เช่น โทรหาลูกค้าแล้ว ลูกค้าบอกว่า..."
          value={note} onChange={(e) => setNote(e.target.value)} />
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          <input ref={inputRef} type="file" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <Button size="small" variant="outlined" color="inherit" startIcon={<AttachFile fontSize="small" />}
            onClick={() => inputRef.current?.click()} sx={{ textTransform: "none", borderRadius: 2, fontSize: "0.72rem" }}>
            {file ? file.name : "แนบหลักฐาน (ถ้ามี)"}
          </Button>
          {file && (
            <IconButton size="small" onClick={() => setFile(null)}><Close fontSize="small" /></IconButton>
          )}
          <Box sx={{ flex: 1 }} />
          <Button size="small" variant="contained" disabled={!note.trim() || submitting}
            startIcon={<Send fontSize="small" />} onClick={handleSubmit}
            sx={{ textTransform: "none", borderRadius: 2 }}>
            บันทึกการติดตาม
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

// ─── ป้ายสถานะ + ปุ่มเปลี่ยนสถานะ รวมเป็นปุ่มเดียว (admin/manager เท่านั้น) — เดิมแยกเป็นชิปสถานะ
// (แสดงอย่างเดียว) กับปุ่ม "เปลี่ยนสถานะ" อีกอันแยกต่างหาก ทำให้ต้องมองสองจุด — ตอนนี้ตัวปุ่มเองแสดง
// สถานะปัจจุบัน (สี/ไอคอน/ป้ายกำกับ) ไปด้วยในตัว กดแล้วเด้งเมนูเปลี่ยนได้เลย ไม่ต้องแยกกันสองอัน ───
const StatusEditMenu = ({ meta, onSelect }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  return (
    <>
      <Button variant="contained" disableElevation
        startIcon={meta.icon} endIcon={<ExpandMore fontSize="small" />}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{
          textTransform: "none", borderRadius: 2.5, fontSize: "0.78rem", fontWeight: 700,
          bgcolor: alpha(meta.color, 0.12), color: meta.color,
          "&:hover": { bgcolor: alpha(meta.color, 0.2) },
          "& .MuiButton-startIcon": { color: meta.color },
        }}>
        {meta.label}
      </Button>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}
        PaperProps={{ sx: { borderRadius: 2, minWidth: 240 } }}>
        {STATUS_ACTIONS.map((a) => (
          <MenuItem key={a.action} onClick={() => { onSelect(a.action); setAnchorEl(null); }} sx={{ gap: 1, minHeight: 48 }}>
            <ListItemIcon sx={{ color: a.color, minWidth: 28 }}>{a.icon}</ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: 600 }}>{a.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

// ─── Dialog รายละเอียด/ดำเนินการ — เด้งขึ้นมาแทนการกางในหน้า (เต็มจอบนมือถือ) ───────────
const QuotationDetailDialog = ({ job, currentUserRole, onClose, onAction, onAmountSave, onAddFollowUp,
  onFileUpload, onDeleteFile, onPreview, uploadingState, isUploadingState, uploadProgressState }) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const navigate = useNavigate();
  const isAdminOrManager = ["admin", "manager"].includes(currentUserRole);
  // ✅ ช่างแก้ไขสถานะงานของตัวเองได้ด้วย (ไม่ใช่แค่ดู) — backend อนุญาตอยู่แล้ว (เจ้าของ/ผู้ได้รับ
  // มอบหมายแก้ไข event ตัวเองได้เสมอ ดู PUT /:id) และ /quotations ก็ scope ให้ช่างเห็นแค่งานตัวเอง
  // อยู่แล้วด้วย (getEventOp) เลยไม่ต้องกันเพิ่มฝั่งนี้ — ยกเว้นมูลค่าใบเสนอราคา (AmountEditor) ที่ยังเป็น
  // สิทธิ์ admin/manager เท่านั้นเหมือนเดิม (ไม่ได้ถูกขอให้เปลี่ยน)
  const canEditStatus = isAdminOrManager || currentUserRole === "technician";

  if (!job) return null;
  const anchor = job.sessions[0];
  const groupKey = job.groupKey;
  const meta = STATUS_META[groupKey] || STATUS_META.not_sent;

  return (
    <Dialog open={Boolean(job)} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="sm"
      PaperProps={{ sx: { borderRadius: fullScreen ? 0 : 4 } }}>
      <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
        <Stack direction="row" alignItems="flex-start" gap={1}>
          <Box minWidth={0} flex={1}>
            <Typography fontWeight={800} fontSize="1rem" noWrap>
              {anchor.company && anchor.site ? `${anchor.company} · ${anchor.site}` : (anchor.company || anchor.site || "ไม่ระบุโครงการ")}
            </Typography>
            {anchor.title && <Typography variant="body2" color="text.secondary" noWrap>{anchor.title}</Typography>}
          </Box>
          <IconButton onClick={onClose} size="small"><Close /></IconButton>
        </Stack>
        {/* ✅ เพิ่มระบบ/ครั้งที่/เลขเอกสาร ไว้ในหัว Dialog ด้วย (เดิมมีแค่โครงการ+ชื่องาน ไม่ครบเท่าการ์ด
            สรุปในลิสต์) ใช้ InfoLine ตัวเดียวกับการ์ดสรุป ให้ดูเป็นชุดข้อมูลเดียวกันสม่ำเสมอทั้งหน้า */}
        {(anchor.system || anchor.time || anchor.docNo) && (
          <Stack direction="row" gap={2} flexWrap="wrap" sx={{ mt: 1 }}>
            {anchor.system && <InfoLine icon="💻" label="ระบบ">{anchor.system}</InfoLine>}
            {anchor.time && <InfoLine icon="🔢" label="ครั้งที่">{formatRoundLabel(anchor.time, anchor.visitCount)}</InfoLine>}
            {anchor.docNo && <InfoLine icon="📄" label="เอกสาร">{anchor.docNo}</InfoLine>}
          </Stack>
        )}
      </Box>

      <DialogContent sx={{ p: 2 }}>
        {/* ✅ ป้ายสถานะ + ปุ่มเปลี่ยนสถานะ รวมเป็นปุ่มเดียวแล้ว (ดู StatusEditMenu) ไม่ต้องแยกสองจุด */}
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{ mb: 1.5 }}>
          {canEditStatus ? (
            <StatusEditMenu meta={meta} onSelect={(action) => onAction(job, action)} />
          ) : (
            <Chip size="small" icon={meta.icon} label={meta.label} sx={{
              height: 26, fontSize: "0.75rem", fontWeight: 700,
              bgcolor: alpha(meta.color, 0.12), color: meta.color, "& .MuiChip-icon": { color: meta.color },
            }} />
          )}
        </Stack>

        {/* ✅ ย้ายมูลค่าใบเสนอราคาออกจากมุมขวาของแถวสถานะ (เดิมเป็นตัวหนังสือจางๆ เบียดอยู่ท้ายแถว
            มองข้ามได้ง่ายมาก) มาเป็นบล็อกของตัวเองใต้สถานะ — เป็นข้อมูลสำคัญที่ต้องกรอกเองทุกใบ
            และเป็นตัวตั้งของยอดรวมในการ์ดสรุปด้านบนของหน้า จึงควรเห็นชัดตั้งแต่เปิดกล่องมา */}
        <Box sx={{ mb: 1.5 }}>
          {isAdminOrManager ? (
            <AmountEditor value={anchor.quotationAmount} onSave={(v) => onAmountSave(job, v)} />
          ) : (
            <Box sx={{ p: 1.25, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: "block", lineHeight: 1.2 }}>
                มูลค่าใบเสนอราคา
              </Typography>
              <Typography fontWeight={800} fontSize="1rem" color={anchor.quotationAmount ? "text.primary" : "text.disabled"}>
                {anchor.quotationAmount ? `฿${Number(anchor.quotationAmount).toLocaleString()}` : "ยังไม่ระบุ"}
              </Typography>
            </Box>
          )}
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FileUploadSection
              eventId={anchor._id} type="quotation" label="ใบเสนอราคา"
              files={anchor.quotationFiles} applicable={anchor.quotationApplicable}
              onUpload={onFileUpload} onDelete={onDeleteFile}
              onPreview={onPreview}
              uploading={isUploadingState.quotation && uploadingState.quotation === anchor._id}
              progress={uploadProgressState.quotation}
              currentUserRole={currentUserRole}
            />
          </Grid>

          {/* ปุ่มดำเนินการตามสถานะปัจจุบัน — เปลี่ยนสถานะได้ทั้ง admin/manager และช่าง (เจ้าของงาน)
              ส่วนมูลค่าใบเสนอราคายังเป็นสิทธิ์ admin/manager เท่านั้น (ดู AmountEditor ด้านบน) */}
          {canEditStatus && (
            <Grid item xs={12}>
              <Stack direction="row" gap={1} flexWrap="wrap">
                {groupKey === "not_sent" && (
                  <Button size="small" variant="contained" startIcon={<Send fontSize="small" />}
                    onClick={() => onAction(job, "send")} sx={{ textTransform: "none", borderRadius: 2 }}>
                    ส่งใบเสนอราคาให้ลูกค้าแล้ว
                  </Button>
                )}
                {/* ✅ "ลูกค้าขอแก้ไข" ตัดออกจากตัวเลือกแล้ว (ไม่มีใครใช้) — งานเก่าที่เคยถูกตั้งไว้เป็น
                    สถานะนี้ (ก่อนตัดออก) ก็ใช้ปุ่มชุดเดียวกับ "รอลูกค้าตอบ" นี้ต่อได้เลย ไม่ต้องมี
                    เส้นทางแยกอีกต่อไป */}
                {(groupKey === "sent" || groupKey === "follow_up" || groupKey === "revising") && (
                  <>
                    <Button size="small" variant="contained" color="success" startIcon={<CheckCircle fontSize="small" />}
                      onClick={() => onAction(job, "approve")} sx={{ textTransform: "none", borderRadius: 2 }}>
                      ลูกค้าอนุมัติ
                    </Button>
                    <Button size="small" variant="outlined" color="error" startIcon={<Cancel fontSize="small" />}
                      onClick={() => onAction(job, "reject")} sx={{ textTransform: "none", borderRadius: 2 }}>
                      ลูกค้าปฏิเสธ
                    </Button>
                  </>
                )}
                {(groupKey === "approved" || groupKey === "rejected") && (anchor.quotationDecisionBy || anchor.quotationDecisionAt) && (
                  <Typography variant="caption" color="text.secondary">
                    {anchor.quotationDecisionBy ? `บันทึกโดย ${anchor.quotationDecisionBy}` : ""}
                    {anchor.quotationDecisionAt ? ` · ${moment(anchor.quotationDecisionAt).locale("th").format("DD MMM YYYY HH:mm")}` : ""}
                  </Typography>
                )}
                {groupKey === "waiting_file" && (
                  <Typography variant="caption" color="text.disabled">รอแนบไฟล์ใบเสนอราคาก่อน</Typography>
                )}
              </Stack>
            </Grid>
          )}

          <Grid item xs={12}>
            <Button size="small" fullWidth color="inherit" endIcon={<OpenInNew fontSize="small" />}
              onClick={() => navigate(`/operation/${anchor._id}`)}
              sx={{ textTransform: "none", fontSize: "0.75rem", justifyContent: "space-between", border: "1px dashed", borderColor: "divider", borderRadius: 2 }}>
              เปิดดูในหน้าการดำเนินงาน
            </Button>
          </Grid>

          <Grid item xs={12}>
            <Divider sx={{ mb: 1.5 }} />
            <FollowUpSection job={job} onSubmit={onAddFollowUp} onPreview={onPreview} />
          </Grid>

          <Grid item xs={12}>
            <Divider sx={{ mb: 1.5 }} />
            <Typography variant="caption" fontWeight={700} color="text.secondary"
              sx={{ textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
              <Chat sx={{ fontSize: 14 }} /> คุยกับช่าง{(anchor.comments || []).length > 0 && ` (${anchor.comments.length})`}
            </Typography>
            <CommentThread comments={anchor.comments}
              onSend={(message) => onAction(job, "comment", { message })} myRole={currentUserRole} />
          </Grid>
        </Grid>
      </DialogContent>
    </Dialog>
  );
};

// ─── ปุ่มเลือกแท็บสถานะ — กดแล้วเด้งเมนูขึ้นมาเลือก แทนแถว Chip เลื่อนแนวนอนเดิม (ล้นขอบจอ) ───
const StatusFilterButton = ({ group, counts, onChange }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const meta = TAB_META[group];

  return (
    <>
      <Button
        onClick={(e) => setAnchorEl(e.currentTarget)}
        startIcon={meta.icon}
        endIcon={<ExpandMore />}
        sx={{
          width: { xs: "100%", sm: "auto" }, justifyContent: "space-between",
          textTransform: "none", fontWeight: 700, fontSize: "0.85rem",
          borderRadius: 2.5, border: "1px solid", borderColor: alpha(meta.color, 0.4),
          bgcolor: alpha(meta.color, 0.08), color: meta.color, px: 1.75, py: 1,
          "&:hover": { bgcolor: alpha(meta.color, 0.15) },
        }}
      >
        {meta.label} ({counts[group] || 0})
      </Button>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}
        PaperProps={{ sx: { borderRadius: 2, minWidth: 220 } }}>
        {TABS.map((key) => {
          const m = TAB_META[key];
          return (
            <MenuItem key={key} selected={key === group}
              onClick={() => { onChange(key); setAnchorEl(null); }}
              sx={{ gap: 1, minHeight: 44 }}>
              <ListItemIcon sx={{ color: m.color, minWidth: 28 }}>{m.icon}</ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: "0.85rem" }}>{m.label}</ListItemText>
              <Chip size="small" label={counts[key] || 0} sx={{
                height: 20, minWidth: 20, fontWeight: 700, fontSize: "0.7rem",
                bgcolor: alpha(m.color, 0.15), color: m.color,
              }} />
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
};

// ─── ปุ่มเลือกช่าง (admin/manager เท่านั้น) — เห็นจำนวนใบเสนอราคาแยกรายคน กดแล้วเด้งเมนูขึ้นมาเลือก
// เทียบ pattern เดียวกับ StatusFilterButton ด้านบน ───────────────────────────────────────
const TechnicianFilterButton = ({ technicians, selectedId, counts, totalCount, onChange }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const selected = technicians.find((t) => t._id === selectedId);
  const label = selected ? `${selected.fname || ""} ${selected.lname || ""}`.trim() || selected.username : "ทุกช่าง";
  const count = selectedId ? (counts[selectedId] || 0) : totalCount;

  return (
    <>
      <Button
        onClick={(e) => setAnchorEl(e.currentTarget)}
        startIcon={<Person sx={{ fontSize: 18 }} />}
        endIcon={<ExpandMore />}
        sx={{
          width: { xs: "100%", sm: "auto" }, justifyContent: "space-between",
          textTransform: "none", fontWeight: 700, fontSize: "0.85rem",
          borderRadius: 2.5, border: "1px solid", borderColor: "divider",
          color: "text.secondary", bgcolor: "background.paper", px: 1.75, py: 1,
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        {label} ({count})
      </Button>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}
        PaperProps={{ sx: { borderRadius: 2, minWidth: 240, maxHeight: 360 } }}>
        <MenuItem selected={!selectedId} onClick={() => { onChange(null); setAnchorEl(null); }} sx={{ gap: 1, minHeight: 40 }}>
          <ListItemText primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: 700 }}>ทุกช่าง</ListItemText>
          <Chip size="small" label={totalCount} sx={{ height: 20, minWidth: 20, fontWeight: 700, fontSize: "0.7rem" }} />
        </MenuItem>
        <Divider />
        {technicians.map((t) => (
          <MenuItem key={t._id} selected={selectedId === t._id} onClick={() => { onChange(t._id); setAnchorEl(null); }} sx={{ gap: 1, minHeight: 40 }}>
            <ListItemText primaryTypographyProps={{ fontSize: "0.85rem" }}>
              {`${t.fname || ""} ${t.lname || ""}`.trim() || t.username}
            </ListItemText>
            <Chip size="small" label={counts[t._id] || 0} sx={{ height: 20, minWidth: 20, fontWeight: 700, fontSize: "0.7rem" }} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default function QuotationTracking() {
  const { userData } = useAuth();
  const role = userData?.role?.toLowerCase();
  const isAdminOrManager = ["admin", "manager"].includes(role);
  const canAccess = ["admin", "manager", "technician"].includes(role);
  // ✅ deep-link จาก Dashboard (กล่องแจ้งเตือน "ใบเสนอราคาที่ต้องติดตามด่วน") — เปิด Dialog
  // รายละเอียดงานนั้นให้อัตโนมัติผ่าน ?jobId=<eventId> แทนที่จะให้ผู้ใช้ไล่หาเองในรายการ
  const [searchParams, setSearchParams] = useSearchParams();

  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("pending");
  const [selectedTechId, setSelectedTechId] = useState(null);
  // ✅ perf: เดิมไม่แบ่งหน้าเลย render ทุกงานที่ผ่านตัวกรองพร้อมกันทั้งหมด ยิ่งงานสะสมเยอะยิ่งหน่วง
  // (เทียบ pattern เดียวกับหน้า Operation ที่แบ่งหน้าอยู่แล้ว) — หน้าละ 10 งาน
  const [page, setPage] = useState(1);
  // ✅ สลับมุมมองการ์ด/ตาราง — จำค่าไว้ข้ามการเปิดหน้า เพราะแต่ละคนถนัดคนละแบบและมักใช้แบบเดิมตลอด
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem("quotations.viewMode") === "table" ? "table" : "card"; }
    catch { return "card"; }
  });
  useEffect(() => {
    try { localStorage.setItem("quotations.viewMode", viewMode); } catch {}
  }, [viewMode]);
  const [exporting, setExporting] = useState(false);
  const QUOTATIONS_PAGE_SIZE = 10;
  const [detailJob, setDetailJob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewFileName, setPreviewFileName] = useState("");
  const [snackbar, setSnackbar] = useState({ open: false, msg: "", severity: "success" });

  const [uploadingState, setUploadingState] = useState({ quotation: null });
  const [uploadProgressState, setUploadProgressState] = useState({ quotation: 0 });
  const [isUploadingState, setIsUploadingState] = useState({ quotation: false });

  const fetchJobs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await EventService.getEventOp();
      setEvents(res?.userEvents || []);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error(err);
      if (!silent) setSnackbar({ open: true, msg: "โหลดรายการไม่สำเร็จ", severity: "error" });
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { if (canAccess) fetchJobs(); }, [fetchJobs, canAccess]);

  useEffect(() => {
    if (!canAccess) return;
    const interval = setInterval(() => fetchJobs(true), 30000);
    return () => clearInterval(interval);
  }, [fetchJobs, canAccess]);

  // ✅ ตัวกรอง "แยกตามช่าง" เป็นสิทธิ์ admin/manager เท่านั้น — ช่างไม่ต้องโหลดรายชื่อผู้ใช้ทั้งหมด
  useEffect(() => {
    if (!isAdminOrManager) return;
    (async () => {
      try {
        const res = await AuthService.getAllUserData();
        setUsers(res?.allUser || []);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [isAdminOrManager]);

  // ✅ งานที่เข้าหลายวันไม่ติดกัน (jobGroupId เดียวกัน) รวมเป็น "1 งาน" — เอกสาร/สถานะใบเสนอราคา
  // ยึดจากวันล่าสุดของกลุ่มเสมอ (sessions[0] หลังเรียง desc) เทียบ pattern เดียวกับ JobGroupBlock
  // ในหน้า Operation ที่ยึดเอกสารไว้ที่วันล่าสุดเป็นจุดเดียวอยู่แล้ว
  const quotationJobs = useMemo(() => {
    const map = new Map();
    events.forEach((ev) => {
      const key = getOverdueGroupKey(ev);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    });
    return [...map.values()]
      .map((sessions) => sessions.slice().sort((a, b) => new Date(b.start) - new Date(a.start)))
      .map((sessions) => ({ sessions, groupKey: resolveQuotationGroup(sessions[0]) }))
      .filter((job) => job.groupKey !== "");
  }, [events]);

  // ✅ Dialog รายละเอียดถือ job object ที่ snapshot ไว้ตอนเปิด — พอ events รีเฟรชใหม่ (เช่นทุก 30s
  // หรือหลังกดบันทึก) ต้องหา job ตัวเดียวกันตัวล่าสุดมาแทน ไม่งั้น Dialog จะค้างข้อมูลเก่าไม่อัปเดต
  useEffect(() => {
    if (!detailJob) return;
    const anchorId = detailJob.sessions[0]._id;
    const updated = quotationJobs.find((j) => j.sessions.some((s) => s._id === anchorId));
    if (updated) setDetailJob(updated);
  }, [quotationJobs]); // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ เปิด Dialog อัตโนมัติเมื่อมาจาก deep-link ?jobId= (Dashboard) — รอจน quotationJobs โหลดเสร็จ
  // ก่อนค่อยหา แล้วลบ query param ทิ้งทันทีไม่ให้เปิดซ้ำเวลาผู้ใช้ปิด Dialog เองแล้ว events รีเฟรชใหม่
  useEffect(() => {
    const jobId = searchParams.get("jobId");
    if (!jobId || quotationJobs.length === 0) return;
    const target = quotationJobs.find((j) => j.sessions.some((s) => s._id === jobId));
    if (target) setDetailJob(target);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("jobId");
      return next;
    }, { replace: true });
  }, [quotationJobs, searchParams, setSearchParams]);

  // ✅ หาว่างานนี้เป็นของช่างคนไหน (ใช้ util กลางเดียวกับ TeamWorkload.js) — เฉพาะ admin/manager
  // ที่โหลดรายชื่อผู้ใช้ไว้แล้ว (technician ไม่ได้โหลด users จึงได้ techId ว่างเปล่าเสมอ ซึ่งไม่มีผล
  // เพราะ selectedTechId ก็เป็น null ตลอดสำหรับ role นี้อยู่แล้ว — ดูตัวกรองด้านล่าง)
  const technicians = useMemo(() => users.filter((u) => (u.role || "").toLowerCase() === "technician"), [users]);

  const jobsWithTech = useMemo(() => {
    const userById = new Map(users.map((u) => [u._id?.toString(), u]));
    const userByFname = new Map(users.map((u) => [u.fname, u]));
    return quotationJobs.map((job) => ({
      ...job,
      techId: resolveAssignedTechnician(job.sessions, userById, userByFname)?._id?.toString() || null,
    }));
  }, [quotationJobs, users]);

  const technicianCounts = useMemo(() => {
    const c = {};
    jobsWithTech.forEach((job) => { if (job.techId) c[job.techId] = (c[job.techId] || 0) + 1; });
    return c;
  }, [jobsWithTech]);

  const techFilteredJobs = useMemo(
    () => (selectedTechId ? jobsWithTech.filter((j) => j.techId === selectedTechId) : jobsWithTech),
    [jobsWithTech, selectedTechId],
  );

  // ✅ นับแบบละเอียด (7 สถานะย่อยจริง) ไว้ใช้กับการ์ดสถิติด้านบน — แยกจาก tabCounts ที่รวมกลุ่มแล้ว
  const counts = useMemo(() => {
    const c = { waiting_file: 0, not_sent: 0, sent: 0, follow_up: 0, revising: 0, approved: 0, rejected: 0 };
    techFilteredJobs.forEach((job) => { c[job.groupKey] = (c[job.groupKey] || 0) + 1; });
    return c;
  }, [techFilteredJobs]);

  // ✅ นับตามกลุ่มแท็บที่รวมแล้ว (4 กลุ่ม) ไว้ใช้กับปุ่มกรองสถานะ
  const tabCounts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0 };
    techFilteredJobs.forEach((job) => {
      const t = TAB_GROUP_MAP[job.groupKey];
      if (t) c[t] = (c[t] || 0) + 1;
    });
    return c;
  }, [techFilteredJobs]);

  // ✅ ยอดรวมมูลค่าใบเสนอราคาที่ลูกค้าอนุมัติแล้ว — พร้อมนับใบที่ "ยังไม่กรอกมูลค่า" แยกไว้ด้วย
  // ⚠️ มูลค่าใบเสนอราคาต้องกรอกเองทุกใบ (ไม่ได้ดึงจากราคางานตามสัญญาให้อัตโนมัติ) ใบที่ยังไม่กรอกจึงถูก
  // นับเป็น 0 ในยอดรวม — เดิมไม่มีอะไรบอกเลย ยอดรวมจึงต่ำกว่าความจริงแบบเงียบๆ และไม่มีใครรู้ว่าขาดกี่ใบ
  const approvedStats = useMemo(() => {
    const approved = techFilteredJobs.filter((job) => job.groupKey === "approved");
    let total = 0;
    let missing = 0;
    approved.forEach((job) => {
      const amount = Number(job.sessions[0].quotationAmount) || 0;
      if (amount > 0) total += amount;
      else missing += 1;
    });
    return { total, missing };
  }, [techFilteredJobs]);
  const approvedValue = approvedStats.total;

  const filteredJobs = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const list = techFilteredJobs.filter((job) => {
      if (TAB_GROUP_MAP[job.groupKey] !== group) return false;
      if (!keyword) return true;
      const anchor = job.sessions[0];
      return [anchor.company, anchor.site, anchor.title, anchor.docNo]
        .some((v) => (v || "").toLowerCase().includes(keyword));
    });
    // ✅ แท็บ "รอลูกค้าตอบ" รวมหลายสถานะย่อยไว้ด้วยกัน — เรียงงานด่วนที่สุดขึ้นก่อนเสมอ
    if (group === "pending") {
      return list.slice().sort((a, b) => (PENDING_PRIORITY[a.groupKey] ?? 9) - (PENDING_PRIORITY[b.groupKey] ?? 9));
    }
    return list;
  }, [techFilteredJobs, group, search]);

  // ✅ กลับไปหน้า 1 เสมอเมื่อตัวกรองเปลี่ยน (สถานะ/ช่าง/คำค้นหา) ไม่งั้นอาจค้างอยู่หน้าที่ไม่มีข้อมูล
  useEffect(() => { setPage(1); }, [group, selectedTechId, search]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / QUOTATIONS_PAGE_SIZE));
  // ✅ กันหน้าค้างเกินจำนวนหน้าจริง (auto-refresh ทุก 30 วิ อาจทำให้รายการลดลงจนหน้าปัจจุบันไม่มีข้อมูล
  // แล้วเห็นหน้าว่างเปล่าโดยไม่มีอะไรอธิบาย — เทียบ pattern เดียวกับ safePage ในหน้า "ภาพรวมงาน")
  const safePage = Math.min(page, totalPages);
  const pagedJobs = useMemo(
    () => filteredJobs.slice((safePage - 1) * QUOTATIONS_PAGE_SIZE, safePage * QUOTATIONS_PAGE_SIZE),
    [filteredJobs, safePage],
  );

  // ✅ ส่งออก Excel — ส่งออก "ทุกใบที่ผ่านตัวกรองอยู่" (filteredJobs) ไม่ใช่แค่หน้าที่เปิดอยู่
  // โหลด exceljs แบบ dynamic ตอนกดจริงเท่านั้น (ไลบรารีก้อนใหญ่) ไม่ให้ถ่วงเวลาโหลดหน้าของทุกคน
  const handleExportExcel = async () => {
    if (exporting || filteredJobs.length === 0) return;
    setExporting(true);
    try {
      const { exportQuotationsToExcel, buildQuotationFileName } = await import("./quotationExcelExport");
      const tabLabel = TAB_META[group]?.label || "ทั้งหมด";
      const filters = [];
      if (search.trim()) filters.push(`ค้นหา "${search.trim()}"`);
      if (selectedTechId) {
        const t = technicians.find((u) => u._id === selectedTechId);
        if (t) filters.push(`ผู้รับผิดชอบ ${t.fname || t.username}`);
      }
      await exportQuotationsToExcel({
        jobs: filteredJobs,
        meta: {
          fileName: buildQuotationFileName(tabLabel),
          tabLabel: `หมวด: ${tabLabel}`,
          filterSummary: filters.length > 0 ? `ตัวกรอง: ${filters.join(" · ")}` : "ไม่ได้กรองเพิ่มเติม",
          exportedAt: moment().format("DD/MM/YYYY HH:mm"),
        },
        getFollowUpInfo,
        formatEventDateRange,
      });
    } catch (err) {
      setSnackbar({ open: true, msg: err?.message || "ส่งออกไม่สำเร็จ", severity: "error" });
    } finally {
      setExporting(false);
    }
  };

  const updateQuotationFields = useCallback(async (job, fields, logEntry) => {
    try {
      const ids = job.sessions.map((s) => s._id);
      await Promise.all(ids.map((gid) => EventService.UpdateEvent(gid, fields)));
      if (logEntry) {
        const anchor = job.sessions[0];
        await EventService.UpdateEvent(anchor._id, { activityLog: [...(anchor.activityLog || []), logEntry] });
      }
      await fetchJobs(true);
      setSnackbar({ open: true, msg: "บันทึกเรียบร้อย", severity: "success" });
    } catch (err) {
      console.error(err);
      // ✅ โชว์ข้อความจริงจาก backend (เช่น "งานนี้ปิดแล้ว ไม่สามารถแก้ไขได้") แทนข้อความรวมๆ เดิม
      // ที่บอกแค่ "บันทึกไม่สำเร็จ" ทำให้ผู้ใช้เดาสาเหตุไม่ออกว่าติดขัดตรงไหน
      const apiMsg = err?.response?.data?.message || err?.response?.data?.err;
      setSnackbar({ open: true, msg: apiMsg || "บันทึกไม่สำเร็จ", severity: "error" });
    }
  }, [fetchJobs]);

  const handleAction = useCallback(async (job, action, extra = {}) => {
    const payload = JSON.parse(localStorage.getItem("payload") || "{}");
    const actorName = payload?.fname ? `${payload.fname} ${payload.lname || ""}`.trim() : (payload?.username || "แอดมิน");
    const now = new Date().toISOString();

    if (action === "comment") {
      const anchor = job.sessions[0];
      const newComment = { userId: payload?.userId || "", userName: actorName, role, message: extra.message, timestamp: now };
      await updateQuotationFields(job, { comments: [...(anchor.comments || []), newComment] });
      return;
    }

    const ACTION_MAP = {
      send:    { fields: { quotationStatus: "sent", quotationSentAt: now, quotationDecisionAt: null, quotationDecisionBy: null }, log: ["quotation_sent", "ส่งใบเสนอราคาให้ลูกค้า"] },
      approve: { fields: { quotationStatus: "approved", quotationDecisionAt: now, quotationDecisionBy: actorName }, log: ["quotation_approved", "ลูกค้าอนุมัติใบเสนอราคา"] },
      reject:  { fields: { quotationStatus: "rejected", quotationDecisionAt: now, quotationDecisionBy: actorName }, log: ["quotation_rejected", "ลูกค้าปฏิเสธใบเสนอราคา"] },
    };
    const def = ACTION_MAP[action];
    if (!def) return;
    const [logAction, logDetail] = def.log;
    await updateQuotationFields(job, def.fields, { action: logAction, detail: logDetail, userName: actorName, timestamp: now });
  }, [role, updateQuotationFields]);

  const handleAmountSave = useCallback((job, amount) => {
    updateQuotationFields(job, { quotationAmount: amount });
  }, [updateQuotationFields]);

  // ✅ ช่างและ admin/manager บันทึกได้ทั้งคู่ — ผ่าน route เฉพาะ (server คำนวณ attemptNumber เอง)
  // ไม่ผ่าน updateQuotationFields (นั่นสำหรับฟิลด์ที่ propagate ทั้งกลุ่มวัน ส่วนนี้บันทึกที่ anchor เดียว)
  const handleAddFollowUp = useCallback(async (job, note, file) => {
    try {
      const anchor = job.sessions[0];
      await EventService.AddQuotationFollowUp(anchor._id, { note, file });
      await fetchJobs(true);
      setSnackbar({ open: true, msg: "บันทึกการติดตามเรียบร้อย", severity: "success" });
    } catch (err) {
      console.error(err);
      const apiMsg = err?.response?.data?.message || err?.response?.data?.err;
      setSnackbar({ open: true, msg: apiMsg || "บันทึกการติดตามไม่สำเร็จ", severity: "error" });
    }
  }, [fetchJobs]);

  const handleFileUpload = useCallback(async (fileOrFiles, eventId, type) => {
    const files = Array.from(fileOrFiles?.length !== undefined ? fileOrFiles : [fileOrFiles]);
    if (files.length === 0) return;
    setUploadingState((p) => ({ ...p, [type]: eventId }));
    setIsUploadingState((p) => ({ ...p, [type]: true }));
    let successCount = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        setUploadProgressState((p) => ({ ...p, [type]: 0 }));
        await EventService.Upload(eventId, files[i], type, {
          onUploadProgress: (pe) => {
            const pct = Math.round((pe.loaded * 100) / pe.total);
            setUploadProgressState((p) => ({ ...p, [type]: Math.min(pct, 99) }));
          },
        });
        setUploadProgressState((p) => ({ ...p, [type]: 100 }));
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
      await fetchJobs(true);
      setIsUploadingState((p) => ({ ...p, [type]: false }));
      setTimeout(() => {
        setUploadingState((p) => ({ ...p, [type]: null }));
        setUploadProgressState((p) => ({ ...p, [type]: 0 }));
      }, 800);
    }
  }, [fetchJobs]);

  const handleDeleteFile = useCallback(async (eventId, type, fileId) => {
    try {
      await EventService.DeleteFile(eventId, type, fileId);
      setSnackbar({ open: true, msg: "ลบไฟล์เรียบร้อย", severity: "success" });
      await fetchJobs(true);
    } catch {
      setSnackbar({ open: true, msg: "ลบไฟล์ไม่สำเร็จ", severity: "error" });
    }
  }, [fetchJobs]);

  // ✅ กันช่างเปิดหน้านี้ตรงๆ ผ่าน URL — เทียบ pattern เดียวกับ TeamWorkload.js (ไม่ผ่าน AdminRoute
  // เพราะ manager/ช่างต้องเข้าได้ด้วย จึงเช็ค role เองในนี้แทน)
  if (!loading && !canAccess) return <Navigate to="/dashboard" replace />;

  // ✅ การ์ดสถิติตัดให้ตรงกับ 3 แท็บที่เหลือเป๊ะๆ (ตัด "ลูกค้าขอแก้ไข" ออกแล้ว ไม่มีใครดูอยู่แล้ว) —
  // ผลรวม 3 การ์ดนี้ = ทั้งหมดเสมอ (โชว์ "ทั้งหมด" เป็นบรรทัดเดียวกับหัวข้อแทน ไม่ต้องมีการ์ดแยก)
  const statCards = [
    { key: "pending", label: TAB_META.pending.label, value: tabCounts.pending,
      color: "linear-gradient(135deg,#3b82f6,#1d4ed8)", icon: <Send />,
      sub: counts.follow_up > 0 ? `ต้องติดตามด่วน ${counts.follow_up} งาน (เงียบเกิน ${WARNING_DAYS_AFTER_SENT} วัน)` : "ยังไม่มีงานต้องติดตามด่วน" },
    { key: "approved", label: TAB_META.approved.label, value: tabCounts.approved,
      color: "linear-gradient(135deg,#10b981,#059669)", icon: <CheckCircle />,
      // ✅ บอกตรงๆ ว่ายอดรวมยังขาดกี่ใบ แทนที่จะโชว์เลขที่ต่ำกว่าความจริงเฉยๆ (ดู approvedStats)
      sub: approvedStats.missing > 0
        ? `มูลค่ารวม ฿${approvedValue.toLocaleString()} · ยังไม่ระบุมูลค่า ${approvedStats.missing} ใบ`
        : `มูลค่ารวม ฿${approvedValue.toLocaleString()}` },
    { key: "rejected", label: TAB_META.rejected.label, value: tabCounts.rejected,
      color: "linear-gradient(135deg,#94a3b8,#64748b)", icon: <Cancel />,
      sub: "ไม่ผ่านการอนุมัติ" },
  ];

  // ✅ เดิมล็อก maxWidth ไว้ที่ 900px ตายตัว — เหมาะกับตอนที่หน้านี้มีแต่มุมมองการ์ด (การ์ดกว้างเกินไป
  // จะอ่านยาก) แต่ตอนนี้มีมุมมองตาราง 9 คอลัมน์แล้ว พื้นที่ 900px ทำให้ตารางต้องเลื่อนแนวนอนตลอดทั้งที่
  // จอเหลือที่ว่างอีกครึ่งจอ — ให้ตารางใช้ความกว้างเต็มที่ ส่วนมุมมองการ์ดยังจำกัดไว้เท่าเดิม เพราะการ์ด
  // ที่ยืดเต็มจอกว้างๆ จะอ่านยากกว่าเดิม (บรรทัดยาวเกินไป สายตาไล่ไม่ทัน)
  return (
    <Box sx={{
      px: { xs: 1.5, sm: 2 }, pt: 2, pb: 4, mx: "auto",
      maxWidth: viewMode === "table" ? 1600 : 900,
      transition: "max-width .2s ease",
    }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6" fontWeight={800}>ติดตามใบเสนอราคา</Typography>
          <Typography variant="caption" color="text.secondary">
            {`ทั้งหมด ${techFilteredJobs.length} งาน`}
            {lastRefreshed ? ` · อัปเดตล่าสุด ${moment(lastRefreshed).locale("th").format("HH:mm:ss")}` : " · กำลังโหลด..."}
          </Typography>
        </Box>
        <Tooltip title="รีเฟรช">
          <IconButton onClick={() => fetchJobs()} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
            <Refresh sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      </Stack>

      {loading ? (
        <Grid container spacing={1.5} sx={{ mb: 3 }}>
          {[1, 2, 3].map((i) => (
            <Grid item xs={4} key={i}><Skeleton variant="rounded" height={104} sx={{ borderRadius: 4 }} /></Grid>
          ))}
        </Grid>
      ) : (
        <Grid container spacing={1.5} sx={{ mb: 3 }}>
          {statCards.map((c) => (
            <Grid item xs={4} key={c.key}>
              {/* ✅ กดการ์ดสถิติแล้วกรองไปแท็บนั้นเลย — ตัวเลขบนการ์ดกับในเมนูกรองเป็นชุดเดียวกันแล้ว
                  (ตัด "ทั้งหมด"/"ต้องติดตาม" ที่ไม่มีแท็บของตัวเองออกไปแล้วด้านบน) ทำให้กดแล้วตรงพอดี */}
              {/* ✅ เหลือ 3 การ์ด (ตัด "ลูกค้าขอแก้ไข" ออก) — ปรับเป็น 3 คอลัมน์เท่ากันเสมอ (ไม่เว้น
                  ช่องว่างแบบ 2+1 เหมือนตอน 4 การ์ด) ย่อ padding/ไอคอนลงอีกนิดให้พอดีกับคอลัมน์แคบลง */}
              <StatCard color={c.color} onClick={() => setGroup(c.key)}
                sx={{ height: "100%", cursor: "pointer" }}>
                <CardContent sx={{ p: 1.25, "&:last-child": { pb: 1.25 } }}>
                  <Stack spacing={0.5}>
                    <Box sx={{
                      width: 26, height: 26, borderRadius: 1.5, background: c.color, color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center", "& svg": { fontSize: 15 },
                    }}>
                      {c.icon}
                    </Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}
                      noWrap sx={{ fontSize: "0.66rem", display: "block" }}>
                      {c.label}
                    </Typography>
                    <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1 }}>{c.value}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.62rem", lineHeight: 1.25 }}>{c.sub}</Typography>
                  </Stack>
                </CardContent>
              </StatCard>
            </Grid>
          ))}
        </Grid>
      )}

      <TextField
        fullWidth size="small" placeholder="ค้นหาโครงการ, ไซต์, เลขเอกสาร..."
        value={search} onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 1.5, "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: "background.paper" } }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 19, color: "text.disabled" }} /></InputAdornment>,
          endAdornment: search ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setSearch("")}><Clear sx={{ fontSize: 17 }} /></IconButton>
            </InputAdornment>
          ) : null,
        }}
      />

      <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mb: 2 }}>
        <StatusFilterButton group={group} counts={tabCounts} onChange={setGroup} />
        {isAdminOrManager && (
          <TechnicianFilterButton
            technicians={technicians}
            selectedId={selectedTechId}
            counts={technicianCounts}
            totalCount={jobsWithTech.length}
            onChange={setSelectedTechId}
          />
        )}
        <Box sx={{ flex: 1 }} />

        {/* ✅ สลับมุมมองการ์ด ↔ ตาราง — การ์ดอ่านง่ายทีละใบ ตารางเทียบหลายใบพร้อมกัน/หายอดรวมได้ */}
        <ToggleButtonGroup
          size="small" exclusive value={viewMode}
          onChange={(_, v) => v && setViewMode(v)}
          sx={{ "& .MuiToggleButton-root": { textTransform: "none", px: 1.25, py: 0.5, borderRadius: 2 } }}
        >
          <ToggleButton value="card" title="มุมมองการ์ด">
            <ViewList sx={{ fontSize: 18 }} />
          </ToggleButton>
          <ToggleButton value="table" title="มุมมองตาราง">
            <TableChart sx={{ fontSize: 18 }} />
          </ToggleButton>
        </ToggleButtonGroup>

        {/* ✅ ส่งออก Excel — ส่งออก "ทุกใบที่ผ่านตัวกรองอยู่" ไม่ใช่แค่หน้าที่เปิดอยู่
            ใช้ไอคอนไฟล์ Excel (FontAwesome) + โทนเขียว #047857 ให้ตรงกับปุ่มส่งออก Excel ในหน้าปฏิทิน
            (.toolbar-icon-btn--excel) — เดิมเป็นไอคอนลูกศรดาวน์โหลดทั่วไป ดูไม่ออกว่าได้ไฟล์อะไร */}
        <Tooltip title="ส่งออกเป็นไฟล์ Excel (.xlsx)">
          <span>
            <IconButton
              onClick={handleExportExcel}
              disabled={exporting || filteredJobs.length === 0}
              sx={{
                border: "1px solid", borderRadius: 2,
                borderColor: alpha("#047857", 0.25), color: "#047857",
                transition: "background-color .15s, border-color .15s",
                "&:hover": { bgcolor: alpha("#047857", 0.08), borderColor: "#047857" },
              }}
            >
              <FontAwesomeIcon icon={faFileExcel} style={{ fontSize: 17 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {loading ? (
        <Stack spacing={1.5}>
          {[1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={96} sx={{ borderRadius: 4 }} />)}
        </Stack>
      ) : filteredJobs.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 6, px: 2, borderRadius: 4, border: "1px dashed", borderColor: "divider", color: "text.disabled" }}>
          <RequestQuote sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
          <Typography variant="body2">
            {search ? "ไม่พบรายการที่ตรงกับคำค้นหา" : `ยังไม่มีงานในหมวด "${TAB_META[group]?.label}"`}
          </Typography>
        </Box>
      ) : (
        <>
          {viewMode === "table" ? (
            <QuotationTable
              jobs={pagedJobs}
              onOpen={setDetailJob}
              onPreview={(url, name) => { setPreviewUrl(url); setPreviewFileName(name); }}
            />
          ) : (
            <Stack spacing={0}>
              {pagedJobs.map((job) => (
                <QuotationCard
                  key={job.sessions[0].jobGroupId || job.sessions[0]._id}
                  job={job}
                  onOpen={setDetailJob}
                  onPreview={(url, name) => { setPreviewUrl(url); setPreviewFileName(name); }}
                />
              ))}
            </Stack>
          )}
          {totalPages > 1 && (
            <Stack alignItems="center" sx={{ mt: 2 }}>
              <Pagination
                count={totalPages} page={safePage}
                onChange={(_, v) => setPage(v)}
                color="primary" shape="rounded" size="medium"
                showFirstButton showLastButton
              />
            </Stack>
          )}
        </>
      )}

      <QuotationDetailDialog
        job={detailJob}
        currentUserRole={role}
        onClose={() => setDetailJob(null)}
        onAction={handleAction}
        onAmountSave={handleAmountSave}
        onAddFollowUp={handleAddFollowUp}
        onFileUpload={handleFileUpload}
        onDeleteFile={handleDeleteFile}
        onPreview={(url, name) => { setPreviewUrl(url); setPreviewFileName(name); }}
        uploadingState={uploadingState}
        isUploadingState={isUploadingState}
        uploadProgressState={uploadProgressState}
      />

      <FilePreviewDialog
        previewUrl={previewUrl}
        previewFileName={previewFileName}
        onClose={() => { setPreviewUrl(null); setPreviewFileName(""); }}
      />

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snackbar.severity} variant="filled" sx={{ borderRadius: 2 }}>{snackbar.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
