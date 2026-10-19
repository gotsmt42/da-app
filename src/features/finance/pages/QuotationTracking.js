/**
 * QuotationTracking.js — ติดตามใบเสนอราคา (แท็บแรกของหน้า "ใบเสนอราคา / การเงิน")
 *
 * ✅ v4 — ผู้ใช้สั่ง (2 ต.ค. 2569): "ยังใช้งานยาก ข้อมูลไม่สมบูรณ์ ปรับปรุงหน้านี้ทั้งหมด ให้สมบูรณ์และมืออาชีพ"
 *    + "การจัดวางต่างๆ ไม่สวย"
 *   เดิม: หน้าแคบ 900px กลางจอ · การ์ดยาวเรียงบรรทัดไอคอนอีโมจิ · ตัวกรองเหลือ 3 กลุ่ม (รอ/อนุมัติ/ปฏิเสธ)
 *         · ไม่มีเลขที่/วันที่ใบเสนอราคา · ไม่มียืนราคา · ไม่มีผู้ติดต่อลูกค้า · ปฏิเสธไม่ต้องบอกเหตุผล
 *         · อนุมัติไม่มีเลข PO · บันทึกติดตามไม่มีช่องทาง/นัดครั้งถัดไป
 *   ตอนนี้ (โครงเดียวกับหน้าใบเบิก/ใบขอซื้อ):
 *     หัวเพจ + ตัวเลขเงินขวา → ตัวเลขสรุป (มูลค่ารอตอบ · ต้องตามด่วน · อนุมัติ · อัตราปิดการขาย · ข้อมูลไม่ครบ)
 *     → แถบค้นหา/ตัวกรองกล่องขาว → การ์ดสถานะ (ViewTiles ครบทุกขั้น) → ตาราง (มือถือ = การ์ดกระชับ)
 *     กล่องรายละเอียด: ขั้นตอน → "สิ่งที่ต้องทำต่อ" → ข้อมูลใบเสนอราคา (แก้ได้) → ไฟล์ → การติดตาม → คุยกับช่าง → ประวัติ
 *   บันทึกผ่าน PUT /events/:id/quotation (server ตรวจค่า + บันทึกทุกวันของงานเดียวกันพร้อมกัน)
 *
 * ⚠️ ขอบเขตข้อมูล: GET /event-op คืนเฉพาะงานที่ผู้ใช้เกี่ยวข้อง (ช่างเห็นงานตัวเอง) — server เป็นด่านจริง
 * ⚠️ มูลค่า / ย้อนสถานะ = editFinance เท่านั้น (server บังคับซ้ำ)
 */
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import { alpha } from "@mui/material/styles";
import {
  Box, Stack, Typography, TextField, InputAdornment, IconButton, Chip, Avatar, Tooltip, Skeleton, Snackbar, Alert,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, useMediaQuery, Pagination, Checkbox, FormControlLabel,
  Collapse, Drawer, Badge,
} from "@mui/material";
import {
  Search, Close, Refresh, RequestQuote, Send, CheckCircle, Cancel, Autorenew, HourglassTop, WarningAmber, ChevronRight,
  AttachFile, Chat, OpenInNew, History, Apps, Description, Edit, Phone, Email, EventRepeat, Undo, Save, Insights, ExpandMore, Tune, Check,
} from "@mui/icons-material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileExcel } from "@fortawesome/free-solid-svg-icons";

import useRealtime from "@/shared/realtime/useRealtime";
import { useAuth } from "@/features/auth/AuthContext";
import EventService from "@/shared/services/EventService";
import { FileUploadSection, CommentThread, FilePreviewDialog } from "@/features/operation/components/OperationBoard";
import { getOverdueGroupKey } from "@/shared/utils/overdueJobs";
import { WARNING_DAYS_AFTER_SENT, getFollowUpInfo, resolveQuotationGroup, QUOTE_STATUS } from "@/shared/utils/quotationTracking";
import DateCell from "@/shared/ui/DateCell";
import JobKindTag from "@/shared/ui/JobKindTag";
import { formatEventDateRange } from "@/shared/utils/formatDateRange";
import { formatRoundLabel } from "@/shared/utils/contractRounds";
import { formatThai, thaiDate } from "@/shared/utils/thaiDate";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import { can } from "@/shared/utils/roles";
import ViewTiles from "@/shared/ui/ViewTiles";
import SelectField from "@/shared/ui/SelectField";
import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import useCloseOnPick from "@/shared/hooks/useCloseOnPick";
import { PAGE_SX } from "@/shared/ui/PageKit";

const TEXT_MAIN = "#0f172a";
const TEXT_SUB = "#64748b";
const BORDER = "#e2e8f0";
const PAGE_SIZE = 15;

/** สถานะย่อยของใบ — ลำดับ = ลำดับขั้นตอนจริง (ใช้ทั้งการ์ดสถานะและการเรียง) */
// ชื่อ/สีมาจาก QUOTE_STATUS (ชุดเดียวทั้งแอป) — ที่นี่เพิ่มแค่ไอคอน
const STATUS = {
  follow_up: { ...QUOTE_STATUS.follow_up, short: "ตามด่วน", icon: WarningAmber },
  sent: { ...QUOTE_STATUS.sent, short: "รอตอบ", icon: Send },
  revising: { ...QUOTE_STATUS.revising, icon: Autorenew },
  not_sent: { ...QUOTE_STATUS.not_sent, icon: HourglassTop },
  waiting_file: { ...QUOTE_STATUS.waiting_file, short: "รอไฟล์", icon: AttachFile },
  approved: { ...QUOTE_STATUS.approved, icon: CheckCircle },
  rejected: { ...QUOTE_STATUS.rejected, icon: Cancel },
};
const STATUS_ORDER = ["follow_up", "sent", "revising", "not_sent", "waiting_file", "approved", "rejected"];
const OPEN = ["follow_up", "sent", "revising", "not_sent", "waiting_file"];
const CHANNELS = [
  { value: "phone", label: "โทรศัพท์" },
  { value: "line", label: "LINE" },
  { value: "email", label: "อีเมล" },
  { value: "visit", label: "เข้าพบ" },
  { value: "other", label: "อื่นๆ" },
];
const channelLabel = (v) => CHANNELS.find((c) => c.value === v)?.label || "";
const PERIODS = [
  { value: "all", label: "ทุกช่วงเวลา" },
  { value: "month", label: "เดือนนี้" },
  { value: "3m", label: "3 เดือนล่าสุด" },
  { value: "year", label: "ปีนี้" },
];

const baht = (n) => `฿${(Number(n) || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;
const ymd = (d) => (d ? moment(d).format("YYYY-MM-DD") : "");
const siteText = (a) => [a.company, a.site].filter(Boolean).join(" · ") || "ไม่ระบุโครงการ";
const jobText = (a) => [a.title, a.system].filter(Boolean).join(" · ");
const ownerOf = (a) => a.responsiblePerson || a.team || "";
/** วันที่อ้างอิงของใบ (ใช้กรองช่วงเวลา/เรียง) — วันที่ใบเสนอราคา > วันที่ส่ง > วันที่งาน */
const refDateOf = (a) => a.quotationDate || a.quotationSentAt || a.start;
const isExpired = (a) => a.quotationValidUntil && ["sent", "revising"].includes(a.quotationStatus) && moment(a.quotationValidUntil).isBefore(moment(), "day");
const missingInfo = (a) => !a.quotationAmount || !a.quotationNo;

/** ป้ายกำหนดติดตาม — เลยกำหนด (แดง) / วันนี้ (ส้ม) / อีก N วัน (เทา) */
const DueChip = ({ info }) => {
  if (!info) return null;
  const d = info.daysUntilDue;
  const [label, color] = d < 0 ? [`เลยกำหนด ${-d} วัน`, "#dc2626"] : d === 0 ? ["ตามวันนี้", "#d97706"] : [`ตามอีก ${d} วัน`, TEXT_SUB];
  return <Typography component="span" sx={{ fontSize: "0.72rem", fontWeight: 800, color, whiteSpace: "nowrap" }}>{label}</Typography>;
};

const Owner = ({ name, size = 30 }) => (
  <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
    <Avatar sx={{ width: size, height: size, fontSize: size * 0.42, fontWeight: 800, bgcolor: name ? personColor(name) : "#cbd5e1", flexShrink: 0 }}>
      {name ? personInitial(name) : "?"}
    </Avatar>
    <Typography noWrap sx={{ fontSize: "0.84rem", fontWeight: 700, color: name ? TEXT_MAIN : TEXT_SUB }}>{name || "ไม่ระบุ"}</Typography>
  </Stack>
);

const Kpi = ({ label, value, sub, color = TEXT_MAIN, onClick, active, alert }) => (
  <Box component={onClick ? "button" : "div"} type={onClick ? "button" : undefined} onClick={onClick} sx={{
    textAlign: "left", font: "inherit", cursor: onClick ? "pointer" : "default", minWidth: 0,
    p: { xs: 1.25, sm: 1.5 }, borderRadius: 2.5, bgcolor: "#fff",
    border: `1px solid ${active ? "#334155" : BORDER}`, boxShadow: active ? "inset 0 -3px 0 #334155" : "0 1px 2px rgba(15,23,42,.04)",
    transition: "border-color .15s", "&:hover": onClick ? { borderColor: "#94a3b8" } : {},
  }}>
    <Typography noWrap sx={{ fontSize: "0.74rem", color: TEXT_SUB, fontWeight: 700 }}>{label}</Typography>
    <Typography noWrap sx={{ fontWeight: 900, fontSize: { xs: "1.1rem", sm: "1.3rem" }, color: alert ? color : TEXT_MAIN, lineHeight: 1.3 }}>{value}</Typography>
    {sub && <Typography noWrap sx={{ fontSize: "0.7rem", color: TEXT_SUB }}>{sub}</Typography>}
  </Box>
);

const Section = ({ title, icon, action, children }) => (
  <Box sx={{ border: `1px solid ${BORDER}`, borderRadius: 2.5, bgcolor: "#fff", overflow: "hidden" }}>
    <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.75, py: 1.1, borderBottom: `1px solid ${BORDER}`, bgcolor: "#f8fafc" }}>
      <Box sx={{ color: TEXT_SUB, display: "flex", "& svg": { fontSize: 18 } }}>{icon}</Box>
      <Typography sx={{ flex: 1, fontWeight: 800, fontSize: "0.88rem", color: TEXT_MAIN }}>{title}</Typography>
      {action}
    </Stack>
    <Box sx={{ p: 1.75 }}>{children}</Box>
  </Box>
);

/** ช่องข้อมูล: ป้าย · ค่า (ว่าง = "ยังไม่กรอก" จาง / warn = ส้ม "ยังไม่ระบุ") · คำอธิบายเล็ก */
const Field = ({ label, children, warn, danger, sub, big }) => {
  const empty = children === "" || children == null;
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: "0.68rem", color: TEXT_SUB, fontWeight: 700 }}>{label}</Typography>
      <Typography sx={{ fontSize: big && !empty ? "1rem" : "0.86rem", fontWeight: empty ? 600 : 800, lineHeight: 1.35, wordBreak: "break-word",
        color: empty ? (warn ? "#b45309" : "#94a3b8") : danger ? "#dc2626" : TEXT_MAIN }}>
        {empty ? (warn ? "ยังไม่ระบุ" : "ยังไม่กรอก") : children}
      </Typography>
      {sub && <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: danger ? "#dc2626" : TEXT_SUB }}>{sub}</Typography>}
    </Box>
  );
};

// ─── ตาราง (จอใหญ่) ───────────────────────────────────────────────────────────
// 🔁 (19 ต.ค. 2569 ผู้ใช้: "แก้ไขตารางหน้าติดตามใบเสนอราคา จัดวางให้สวยงาม ชัดเจนขึ้น ย้ายผู้รับผิดชอบมาไว้หน้าสุด ข้อมูลสอดคล้อง")
//    คอลัมน์: วันที่งาน · งาน (ประเภท) · ลูกค้า/โครงการ · ใบเสนอราคา · มูลค่า · การติดตาม · ผู้รับผิดชอบ · สถานะ · ปุ่ม (ผู้ใช้: ย้ายผู้รับผิดชอบไว้ก่อนสถานะ)
//    หัวตาราง/ระยะ/ป้ายชุดเดียวกับตารางหน้าอื่น (การดำเนินงาน · งานเข้า · วางบิล)
const ACTION = {
  follow_up: { label: "บันทึกติดตาม", primary: true, color: "#dc2626" },
  sent: { label: "อัปเดตผล", primary: true },
  revising: { label: "อัปเดตผล", primary: true },
  not_sent: { label: "เปิด" },
  waiting_file: { label: "แนบไฟล์", primary: true },
  approved: { label: "ดู" },
  rejected: { label: "ดู" },
};
const DesktopTable = ({ jobs, onOpen, onPreview }) => {
  const th = { textAlign: "left", fontSize: "0.74rem", fontWeight: 800, color: TEXT_SUB, px: 1.25, py: 1.1, borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap", bgcolor: "#f8fafc" };
  const td = { fontSize: "0.82rem", color: "#334155", px: 1.25, py: 1.2, borderBottom: `1px solid ${BORDER}`, verticalAlign: "top" };
  const sub = { fontSize: "0.74rem", color: TEXT_SUB, lineHeight: 1.45 };
  return (
    <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 3, overflowX: "auto", boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}>
      <Box component="table" sx={{ width: "100%", minWidth: 1280, borderCollapse: "collapse" }}>
        <thead>
          <tr>{["วันที่งาน", "งาน", "ลูกค้า / โครงการ", "ใบเสนอราคา", "มูลค่า", "การติดตาม", "ผู้รับผิดชอบ", "สถานะ", ""].map((h, i) => (
            <Box component="th" key={i} sx={{ ...th, ...(i === 4 ? { textAlign: "right" } : {}) }}>{h}</Box>
          ))}</tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const a = job.anchor;
            const info = job.info;
            const files = a.quotationFiles || [];
            const m = STATUS[job.groupKey] || STATUS.not_sent;
            const act = ACTION[job.groupKey] || { label: "เปิด" };
            const actColor = act.color || "#2563eb";
            return (
              <Box component="tr" key={a._id} onClick={() => onOpen(job)}
                sx={{ cursor: "pointer", "&:hover": { bgcolor: "#f8fafc" }, "&:last-child td": { borderBottom: 0 }, boxShadow: `inset 3px 0 0 ${m.color}` }}>
                <Box component="td" sx={{ ...td, width: 96 }}><DateCell start={a.start} end={a.end} allDay={a.allDay} /></Box>
                <Box component="td" sx={{ ...td, minWidth: 180, maxWidth: 230 }}>
                  <JobKindTag event={a} />
                  <Typography sx={{ mt: 0.5, fontSize: "0.86rem", fontWeight: 800, color: TEXT_MAIN }}>{jobText(a) || "งาน"}</Typography>
                  {a.jobNo && <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8" }}>{a.jobNo}</Typography>}
                </Box>
                <Box component="td" sx={{ ...td, minWidth: 170, maxWidth: 230 }}>
                  <Typography sx={{ fontSize: "0.84rem", fontWeight: 800, color: TEXT_MAIN, overflowWrap: "anywhere" }}>{a.company || a.site || "ไม่ระบุลูกค้า"}</Typography>
                  {a.site && a.site !== a.company && <Typography sx={{ ...sub, overflowWrap: "anywhere" }}>{a.site}</Typography>}
                </Box>
                <Box component="td" sx={{ ...td, minWidth: 150 }}>
                  <Typography sx={{ fontSize: "0.82rem", fontWeight: 800, color: a.quotationNo ? TEXT_MAIN : "#94a3b8" }}>{a.quotationNo || "ไม่มีเลขที่"}</Typography>
                  {a.quotationDate && <Typography sx={sub}>ลงวันที่ {thaiDate(a.quotationDate)}</Typography>}
                  {files.length > 0 && (
                    <Box component="button" type="button" onClick={(e) => { e.stopPropagation(); onPreview(files[files.length - 1].fileUrl, files[files.length - 1].fileName); }}
                      sx={{ mt: 0.4, display: "inline-flex", alignItems: "center", gap: 0.4, height: 22, px: 0.85, border: 0, borderRadius: 99, cursor: "pointer", font: "inherit",
                        bgcolor: alpha("#2563eb", 0.08), color: "#2563eb", fontSize: "0.7rem", fontWeight: 800, "&:hover": { bgcolor: alpha("#2563eb", 0.14) } }}>
                      <AttachFile sx={{ fontSize: 13 }} />เปิดไฟล์{files.length > 1 ? ` (${files.length})` : ""}
                    </Box>
                  )}
                </Box>
                <Box component="td" sx={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                  {a.quotationAmount ? (
                    <>
                      <Typography sx={{ fontWeight: 900, fontSize: "0.9rem", color: TEXT_MAIN, fontVariantNumeric: "tabular-nums" }}>{baht(a.quotationAmount)}</Typography>
                      <Typography sx={sub}>{a.quotationVatIncluded ? "รวม VAT" : "ก่อน VAT"}</Typography>
                    </>
                  ) : <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: "#d97706" }}>ยังไม่ระบุ</Typography>}
                </Box>
                <Box component="td" sx={{ ...td, minWidth: 170 }}>
                  {info ? (
                    <>
                      <DueChip info={info} />
                      <Typography sx={sub}>เริ่มนับ {thaiDate(a.quotationSentAt)}</Typography>
                      <Typography sx={sub}>{info.followUpCount ? `ติดตามแล้ว ${info.followUpCount} ครั้ง` : "ยังไม่เคยติดตาม"} · เงียบ {info.daysSinceLastContact} วัน</Typography>
                    </>
                  ) : a.quotationDecisionAt ? (
                    <>
                      <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: TEXT_MAIN }}>ลูกค้าตอบ {thaiDate(a.quotationDecisionAt)}</Typography>
                      {a.quotationPoNo && <Typography sx={sub}>PO {a.quotationPoNo}</Typography>}
                    </>
                  ) : <Typography sx={{ fontSize: "0.76rem", color: "#94a3b8" }}>{job.groupKey === "waiting_file" ? "แนบไฟล์แล้วเริ่มนับเอง" : "—"}</Typography>}
                </Box>
                <Box component="td" sx={{ ...td, minWidth: 150 }}><Owner name={ownerOf(a)} size={30} /></Box>
                <Box component="td" sx={{ ...td, minWidth: 140 }}>
                  <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, height: 26, px: 1.1, borderRadius: 99, whiteSpace: "nowrap",
                    bgcolor: alpha(m.color, 0.12), color: m.color, border: `1px solid ${alpha(m.color, 0.35)}`, fontSize: "0.76rem", fontWeight: 800 }}>
                    <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: m.color }} />{m.label}
                  </Box>
                </Box>
                <Box component="td" sx={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                  <Stack direction="row" alignItems="center" gap={0.5} justifyContent="flex-end">
                    <Button size="small" onClick={(e) => { e.stopPropagation(); onOpen(job); }}
                      sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, height: 32, px: 1.5, boxShadow: "none",
                        ...(act.primary ? { bgcolor: actColor, color: "#fff", "&:hover": { bgcolor: actColor, filter: "brightness(.92)" } } : { color: actColor, border: `1px solid ${alpha(actColor, 0.4)}` }) }}>
                      {act.label}
                    </Button>
                    <ChevronRight sx={{ color: "#cbd5e1", fontSize: 20 }} />
                  </Stack>
                </Box>
              </Box>
            );
          })}
        </tbody>
      </Box>
    </Box>
  );
};

// ─── การ์ด (มือถือ) ───────────────────────────────────────────────────────────
// 🔁 (19 ต.ค. 2569 ผู้ใช้: "หน้าจอมือถือด้วย ให้สอดคล้อง") — ข้อมูลชุดเดียวกับตาราง เรียงสำหรับจอแคบ:
//    ผู้รับผิดชอบ + สถานะ → ประเภทงาน · ลูกค้า · งาน/วันที่ | มูลค่า → ใบเสนอราคา (เลขที่ · เปิดไฟล์) → การติดตาม + ปุ่ม
const MobileCard = ({ job, onOpen, onPreview }) => {
  const a = job.anchor;
  const m = STATUS[job.groupKey] || STATUS.not_sent;
  const act = ACTION[job.groupKey] || { label: "เปิด" };
  const actColor = act.color || "#2563eb";
  const files = a.quotationFiles || [];
  const info = job.info;
  return (
    <Box onClick={() => onOpen(job)} role="button"
      sx={{ bgcolor: "#fff", border: `1px solid ${BORDER}`, borderLeft: `3px solid ${m.color}`, borderRadius: 3, cursor: "pointer", overflow: "hidden", "&:active": { bgcolor: "#f8fafc" } }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ px: 1.5, py: 1, bgcolor: "#f8fafc", borderBottom: `1px solid ${BORDER}` }}>
        <Box sx={{ flex: 1, minWidth: 0 }}><Owner name={ownerOf(a)} size={24} /></Box>
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, height: 24, px: 1, borderRadius: 99, whiteSpace: "nowrap", flexShrink: 0,
          bgcolor: alpha(m.color, 0.12), color: m.color, border: `1px solid ${alpha(m.color, 0.35)}`, fontSize: "0.72rem", fontWeight: 800 }}>
          <Box component="span" sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: m.color }} />{m.label}
        </Box>
      </Stack>
      <Box sx={{ px: 1.5, pt: 1.1, pb: 1.25 }}>
        <Stack direction="row" gap={1} alignItems="flex-start">
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <JobKindTag event={a} />
            <Typography sx={{ mt: 0.5, fontWeight: 800, fontSize: "0.92rem", color: TEXT_MAIN, lineHeight: 1.35 }}>{a.company || a.site || "ไม่ระบุลูกค้า"}</Typography>
            <Typography sx={{ fontSize: "0.76rem", color: TEXT_SUB }}>
              {[a.site && a.site !== a.company ? a.site : "", jobText(a), formatEventDateRange(a)].filter(Boolean).join(" · ")}
            </Typography>
          </Box>
          <Box sx={{ textAlign: "right", flexShrink: 0 }}>
            <Typography sx={{ fontWeight: 900, fontSize: "0.95rem", color: a.quotationAmount ? TEXT_MAIN : "#d97706" }}>{a.quotationAmount ? baht(a.quotationAmount) : "ยังไม่ระบุ"}</Typography>
            <Typography sx={{ fontSize: "0.68rem", color: TEXT_SUB }}>{a.quotationAmount ? (a.quotationVatIncluded ? "รวม VAT" : "ก่อน VAT") : "มูลค่า"}</Typography>
          </Box>
        </Stack>
        <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 1, px: 1, py: 0.75, borderRadius: 2, bgcolor: "#f8fafc" }}>
          <Description sx={{ fontSize: 16, color: TEXT_SUB }} />
          <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.78rem", fontWeight: 700, color: a.quotationNo ? TEXT_MAIN : "#94a3b8" }}>
            {a.quotationNo ? `เลขที่ ${a.quotationNo}` : "ไม่มีเลขที่"}{a.quotationDate ? ` · ${thaiDate(a.quotationDate)}` : ""}
          </Typography>
          {files.length > 0 && (
            <Box component="button" type="button" onClick={(e) => { e.stopPropagation(); onPreview?.(files[files.length - 1].fileUrl, files[files.length - 1].fileName); }}
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, height: 24, px: 0.9, border: 0, borderRadius: 99, cursor: "pointer", font: "inherit", flexShrink: 0,
                bgcolor: alpha("#2563eb", 0.1), color: "#2563eb", fontSize: "0.7rem", fontWeight: 800 }}>
              <AttachFile sx={{ fontSize: 13 }} />เปิดไฟล์
            </Box>
          )}
        </Stack>
        <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {info ? (
              <>
                <DueChip info={info} />
                <Typography noWrap sx={{ fontSize: "0.7rem", color: TEXT_SUB }}>{info.followUpCount ? `ติดตามแล้ว ${info.followUpCount} ครั้ง` : "ยังไม่เคยติดตาม"} · เงียบ {info.daysSinceLastContact} วัน</Typography>
              </>
            ) : a.quotationDecisionAt ? (
              <Typography noWrap sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>ลูกค้าตอบ {thaiDate(a.quotationDecisionAt)}{a.quotationPoNo ? ` · PO ${a.quotationPoNo}` : ""}</Typography>
            ) : <Typography sx={{ fontSize: "0.72rem", color: "#94a3b8" }}>{job.groupKey === "waiting_file" ? "แนบไฟล์แล้วเริ่มนับเอง" : ""}</Typography>}
          </Box>
          <Button size="small" onClick={(e) => { e.stopPropagation(); onOpen(job); }}
            sx={{ flexShrink: 0, textTransform: "none", fontWeight: 800, borderRadius: 2, height: 32, px: 1.5, boxShadow: "none",
              ...(act.primary ? { bgcolor: actColor, color: "#fff", "&:hover": { bgcolor: actColor } } : { color: actColor, border: `1px solid ${alpha(actColor, 0.4)}` }) }}>
            {act.label}
          </Button>
        </Stack>
      </Box>
    </Box>
  );
};

// ─── กล่องยืนยันการตัดสินใจของลูกค้า (อนุมัติ = เลข PO · ปฏิเสธ = เหตุผลบังคับ · ส่ง = วันที่ส่ง) ─────
const DecisionDialog = ({ mode, onClose, onConfirm, busy, resetInfo }) => {
  const [date, setDate] = useState(moment().format("YYYY-MM-DD"));
  const [po, setPo] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => { if (mode) { setDate(moment().format("YYYY-MM-DD")); setPo(""); setNote(""); } }, [mode]);
  if (!mode) return null;
  const meta = {
    send: { title: "ส่งใบเสนอราคาให้ลูกค้าแล้ว · เริ่มนับติดตาม", color: "#2563eb", btn: "เริ่มนับติดตาม", dateLabel: "วันที่ส่งให้ลูกค้า" },
    resend: { title: "ส่งใบเสนอราคาฉบับแก้ไขให้ลูกค้าแล้ว", color: "#2563eb", btn: "บันทึก · เริ่มนับใหม่", dateLabel: "วันที่ส่งฉบับแก้ไข" },
    approve: { title: "ได้งาน — ลูกค้าตอบรับใบเสนอราคา", color: "#15803d", btn: "บันทึก · ได้งาน", dateLabel: "วันที่ลูกค้าตอบรับ" },
    reject: { title: "ไม่ได้งาน — ลูกค้าไม่รับใบเสนอราคา", color: "#b91c1c", btn: "บันทึก · ไม่ได้งาน", dateLabel: "วันที่ลูกค้าแจ้ง" },
    // ✅ (19 ต.ค. 2569 ผู้ใช้: "ปุ่มแก้ผลให้มีคอนเฟิร์มก่อน กันกดพลาด และมีคำอธิบายชัดเจน")
    reset: { title: "แก้ผลใบเสนอราคา?", color: "#b45309", btn: "ยืนยัน · แก้ผล", noDate: true },
  }[mode];
  const invalid = mode === "reject" && !note.trim();
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 900, fontSize: "1rem", color: meta.color }}>{meta.title}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          {mode === "reset" && (
            <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: "#fffbeb", border: "1px solid #fde68a" }}>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 800, color: "#92400e" }}>ผลเดิม: {resetInfo?.label || "-"}</Typography>
              {resetInfo?.detail && <Typography sx={{ fontSize: "0.78rem", color: "#92400e", mt: 0.25 }}>{resetInfo.detail}</Typography>}
              <Typography component="ul" sx={{ m: 0, mt: 1, pl: 2.25, fontSize: "0.8rem", color: "#475569", lineHeight: 1.6 }}>
                <li>ผลเดิม (วันที่ลูกค้าตอบ · เลข PO · เหตุผล) จะถูกล้าง</li>
                <li>ใบนี้กลับไปสถานะ <b>“รอลูกค้าตอบ”</b> ระบบติดตามต่อจากเดิม</li>
                <li>แล้วกด <b>ได้งาน</b> หรือ <b>ไม่ได้งาน</b> ใหม่ให้ถูกต้อง · ประวัติการแก้ถูกเก็บไว้</li>
              </Typography>
            </Box>
          )}
          {!meta.noDate && <ThaiDatePicker label={meta.dateLabel} value={date} onChange={(v) => setDate(v || moment().format("YYYY-MM-DD"))} />}
          {mode === "approve" && <TextField size="small" label="เลขที่ PO / ใบสั่งซื้อของลูกค้า (ถ้ามี)" value={po} onChange={(e) => setPo(e.target.value)} inputProps={{ maxLength: 60 }} />}
          {(mode === "approve" || mode === "reject") && (
            <TextField size="small" multiline minRows={2} label={mode === "reject" ? "เหตุผลที่ไม่ได้งาน *" : "หมายเหตุ (ถ้ามี)"} value={note}
              onChange={(e) => setNote(e.target.value)} error={invalid && note !== ""} inputProps={{ maxLength: 500 }}
              placeholder={mode === "reject" ? "เช่น ราคาสูงกว่าเจ้าอื่น / เลื่อนโครงการ / ใช้ผู้รับเหมาเดิม" : ""} />
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: "none", color: TEXT_SUB }}>ยกเลิก</Button>
        <Button variant="contained" disabled={busy || invalid} onClick={() => onConfirm({ date, po: po.trim(), note: note.trim() })}
          sx={{ textTransform: "none", fontWeight: 800, boxShadow: "none", bgcolor: meta.color, "&:hover": { bgcolor: meta.color, filter: "brightness(.92)" } }}>
          {busy ? "กำลังบันทึก..." : meta.btn}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── ข้อมูลใบเสนอราคา (ดู/แก้ไข) ─────────────────────────────────────────────
const InfoSection = ({ a, isFinance, canEdit, onSave, bare = false, inline = false }) => {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({});
  const start = () => {
    setF({
      quotationNo: a.quotationNo || "", quotationDate: ymd(a.quotationDate), quotationValidUntil: ymd(a.quotationValidUntil),
      quotationAmount: a.quotationAmount ?? "", quotationVatIncluded: Boolean(a.quotationVatIncluded),
      name: a.quotationContact?.name || a.contactName || "", phone: a.quotationContact?.phone || a.contactTel || "", email: a.quotationContact?.email || "",
    });
    setEditing(true);
  };
  const badRange = f.quotationDate && f.quotationValidUntil && f.quotationValidUntil < f.quotationDate;
  const save = async () => {
    setBusy(true);
    const body = {
      quotationNo: f.quotationNo, quotationDate: f.quotationDate || "", quotationValidUntil: f.quotationValidUntil || "",
      quotationVatIncluded: f.quotationVatIncluded, quotationContact: { name: f.name, phone: f.phone, email: f.email },
      ...(isFinance ? { quotationAmount: f.quotationAmount === "" ? null : Number(f.quotationAmount) } : {}),
    };
    const ok = await onSave(body);
    setBusy(false);
    if (ok) setEditing(false);
  };
  const contact = a.quotationContact || {};
  const editBtn = canEdit && !editing ? <Button size="small" startIcon={<Edit sx={{ fontSize: 16 }} />} onClick={start} sx={{ textTransform: "none", fontWeight: 700 }}>แก้ไข</Button> : null;
  // ✅ bare = ไม่มีกรอบ/หัวของตัวเอง (ใช้ซ้อนในแถบพับ "ข้อมูลใบเสนอราคา" ของกล่องรายละเอียด)
  // ⚠️ ไม่ห่อด้วยคอมโพเนนต์ที่สร้างใหม่ทุก render — ช่องกรอกจะถูก remount แล้วหลุดโฟกัสทุกตัวอักษร
  const body = (
    <>
      {editing ? (
        <Stack spacing={1.5}>
          <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
            <TextField size="small" label="เลขที่ใบเสนอราคา" value={f.quotationNo} onChange={(e) => setF((x) => ({ ...x, quotationNo: e.target.value }))} inputProps={{ maxLength: 60 }} placeholder="เช่น QT-2569-0123" />
            <TextField size="small" label="มูลค่า (บาท)" type="number" value={f.quotationAmount} disabled={!isFinance}
              helperText={isFinance ? "" : "แก้ได้เฉพาะฝ่ายบริหาร/การเงิน"}
              onChange={(e) => setF((x) => ({ ...x, quotationAmount: e.target.value }))} inputProps={{ min: 0, step: "any" }} />
            <ThaiDatePicker label="วันที่ใบเสนอราคา" value={f.quotationDate} onChange={(v) => setF((x) => ({ ...x, quotationDate: v || "" }))} />
            <ThaiDatePicker label="ยืนราคาถึงวันที่" value={f.quotationValidUntil} onChange={(v) => setF((x) => ({ ...x, quotationValidUntil: v || "" }))}
              helperText={badRange ? "ต้องไม่ก่อนวันที่ใบเสนอราคา" : ""} />
          </Box>
          <FormControlLabel sx={{ mt: -0.5 }} control={<Checkbox size="small" checked={f.quotationVatIncluded} disabled={!isFinance} onChange={(e) => setF((x) => ({ ...x, quotationVatIncluded: e.target.checked }))} />}
            label={<Typography sx={{ fontSize: "0.85rem" }}>มูลค่านี้รวม VAT 7% แล้ว</Typography>} />
          <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: TEXT_SUB }}>ผู้ติดต่อฝั่งลูกค้า (คนที่รับใบเสนอราคา)</Typography>
          <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" } }}>
            <TextField size="small" label="ชื่อ" value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} inputProps={{ maxLength: 120 }} />
            <TextField size="small" label="โทรศัพท์" value={f.phone} onChange={(e) => setF((x) => ({ ...x, phone: e.target.value }))} inputProps={{ maxLength: 40, inputMode: "tel" }} />
            <TextField size="small" label="อีเมล" value={f.email} onChange={(e) => setF((x) => ({ ...x, email: e.target.value }))} inputProps={{ maxLength: 120, inputMode: "email" }} />
          </Box>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={() => setEditing(false)} disabled={busy} sx={{ textTransform: "none", color: TEXT_SUB }}>ยกเลิก</Button>
            <Button variant="contained" startIcon={<Save />} onClick={save} disabled={busy || badRange}
              sx={{ textTransform: "none", fontWeight: 800, boxShadow: "none", bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8" } }}>
              {busy ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </Stack>
        </Stack>
      ) : (
        // 🔁 (19 ต.ค. 2569 ผู้ใช้: "รายละเอียดตรงนี้ปรับวางให้สวยงาม ดูง่าย สมบูรณ์กว่านี้")
        //    2 กลุ่มชัดเจน: ใบเสนอราคา (เลขที่ · วันที่ · ยืนราคาถึง · มูลค่า) | ผู้ติดต่อลูกค้า (ชื่อ · โทร · อีเมล)
        //    ช่องว่าง = "ยังไม่กรอก" สีจาง · ช่องที่จำเป็นแต่ว่าง (เลขที่/มูลค่า) = ส้ม · ยืนราคาหมดอายุ = แดง
        <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", sm: "1.6fr 1fr" } }}>
          <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: "#f8fafc", border: `1px solid ${BORDER}` }}>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, color: TEXT_SUB, mb: 0.75, letterSpacing: 0.2 }}>ใบเสนอราคา</Typography>
            <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: "1fr 1fr" }}>
              <Field label="เลขที่" warn={!a.quotationNo}>{a.quotationNo}</Field>
              <Field label="มูลค่า" warn={!a.quotationAmount} sub={a.quotationAmount ? (a.quotationVatIncluded ? "รวม VAT แล้ว" : "ก่อน VAT") : ""} big>
                {a.quotationAmount ? baht(a.quotationAmount) : ""}
              </Field>
              <Field label="วันที่ใบเสนอราคา">{a.quotationDate ? thaiDate(a.quotationDate) : ""}</Field>
              <Field label="ยืนราคาถึง" danger={isExpired(a)} sub={isExpired(a) ? "หมดอายุแล้ว" : ""}>{a.quotationValidUntil ? thaiDate(a.quotationValidUntil) : ""}</Field>
            </Box>
          </Box>
          <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: "#f8fafc", border: `1px solid ${BORDER}` }}>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, color: TEXT_SUB, mb: 0.75, letterSpacing: 0.2 }}>ผู้ติดต่อลูกค้า (คนรับใบเสนอราคา)</Typography>
            <Field label="ชื่อ">{contact.name || a.contactName}</Field>
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {(contact.phone || a.contactTel) ? (
                <Typography component="a" href={`tel:${contact.phone || a.contactTel}`} onClick={(e) => e.stopPropagation()}
                  sx={{ fontSize: "0.86rem", fontWeight: 700, color: "#2563eb", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                  <Phone sx={{ fontSize: 15 }} />{contact.phone || a.contactTel}
                </Typography>
              ) : null}
              {contact.email ? (
                <Typography component="a" href={`mailto:${contact.email}`} sx={{ fontSize: "0.82rem", fontWeight: 700, color: "#2563eb", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 0.5, wordBreak: "break-all" }}>
                  <Email sx={{ fontSize: 15 }} />{contact.email}
                </Typography>
              ) : null}
              {!contact.phone && !a.contactTel && !contact.email && <Typography sx={{ fontSize: "0.8rem", color: "#94a3b8" }}>ยังไม่มีเบอร์/อีเมล</Typography>}
            </Stack>
          </Box>
        </Box>
      )}
    </>
  );
  // ✅ inline = ฝังในกล่อง "ใบเสนอราคา" ของกล่องรายละเอียด (หัวข้อเล็ก + ปุ่มแก้ไข) — เห็นเสมอ ไม่ต้องกางแถบพับ
  if (inline) {
    return (
      <Box>
        <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
          <Typography sx={{ flex: 1, fontSize: "0.78rem", fontWeight: 800, color: "#475569" }}>
            ข้อมูลใบเสนอราคา{missingInfo(a) && !editing ? <Box component="span" sx={{ ml: 0.75, color: "#b45309" }}>· ยังไม่ครบ (เลขที่ / มูลค่า)</Box> : null}
          </Typography>
          {canEdit && !editing && missingInfo(a)
            ? <Button size="small" variant="contained" startIcon={<Edit sx={{ fontSize: 16 }} />} onClick={start}
                sx={{ textTransform: "none", fontWeight: 800, boxShadow: "none", borderRadius: 2, bgcolor: "#d97706", "&:hover": { bgcolor: "#b45309", boxShadow: "none" } }}>กรอกให้ครบ</Button>
            : editBtn}
        </Stack>
        {body}
      </Box>
    );
  }
  return bare ? (
    <Box sx={{ p: 1.75 }}>
      {editBtn && <Box sx={{ display: "flex", justifyContent: "flex-end", mt: -0.75, mb: 0.5 }}>{editBtn}</Box>}
      {body}
    </Box>
  ) : (
    <Section title="ข้อมูลใบเสนอราคา" icon={<RequestQuote />} action={editBtn}>{body}</Section>
  );
};

// ─── การติดตามลูกค้า ─────────────────────────────────────────────────────────
// 🔁 (19 ต.ค. 2569 ผู้ใช้: "ตรงนี้ด้วยทำให้เข้าใจง่ายขึ้น") — ฟอร์มเป็นขั้น ① ติดต่อทางไหน ② ลูกค้าว่าอย่างไร ③ นัดครั้งถัดไป/หลักฐาน
//    ปุ่มบอกว่าบันทึกครั้งที่เท่าไร · ประวัติเป็นการ์ดเรียงใหม่→เก่า (ครั้งที่ · ช่องทาง · วันเวลา · ผู้บันทึก · ข้อความ · หลักฐาน)
const StepLabel = ({ n, children, hint }) => (
  <Stack direction="row" alignItems="baseline" gap={0.75} sx={{ mb: 0.75 }}>
    <Box component="span" sx={{ width: 20, height: 20, borderRadius: "50%", display: "inline-grid", placeItems: "center", bgcolor: "#eff6ff", color: "#2563eb", fontSize: "0.72rem", fontWeight: 900, flexShrink: 0 }}>{n}</Box>
    <Typography sx={{ fontSize: "0.84rem", fontWeight: 800, color: TEXT_MAIN }}>{children}</Typography>
    {hint && <Typography sx={{ fontSize: "0.72rem", color: TEXT_SUB }}>{hint}</Typography>}
  </Stack>
);

const FollowUpSection = ({ a, onSubmit, onPreview, canFollow, formRef }) => {
  const followUps = a.quotationFollowUps || [];
  const [note, setNote] = useState("");
  const [channel, setChannel] = useState("phone");
  const [next, setNext] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef();
  const submit = async () => {
    if (!note.trim() || busy) return;
    setBusy(true);
    const ok = await onSubmit({ note: note.trim(), channel, nextFollowUpAt: next, file });
    setBusy(false);
    if (ok) { setNote(""); setFile(null); setNext(""); }
  };
  const canWrite = canFollow && ["sent", "revising"].includes(a.quotationStatus);
  const nextNo = followUps.length + 1;
  return (
    <Section title={`การติดตามลูกค้า${followUps.length ? ` · ติดตามแล้ว ${followUps.length} ครั้ง` : ""}`} icon={<EventRepeat />}>
      {canWrite && (
        <Box ref={formRef} sx={{ p: { xs: 1.25, sm: 1.5 }, borderRadius: 2.5, border: "1px solid #bfdbfe", bgcolor: "#f8fbff", mb: followUps.length ? 2 : 0 }}>
          <Typography sx={{ fontSize: "0.9rem", fontWeight: 900, color: "#1d4ed8", mb: 1.25 }}>บันทึกการติดตามครั้งที่ {nextNo}</Typography>

          <StepLabel n={1}>ติดต่อลูกค้าทางไหน</StepLabel>
          <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75, mb: 1.5 }}>
            {CHANNELS.map((c) => (
              <Chip key={c.value} label={c.label} onClick={() => setChannel(c.value)}
                sx={{ height: 32, fontWeight: 800, borderRadius: 2, fontSize: "0.8rem",
                  bgcolor: channel === c.value ? "#2563eb" : "#fff", color: channel === c.value ? "#fff" : "#334155",
                  border: `1px solid ${channel === c.value ? "#2563eb" : BORDER}`, "&:hover": { bgcolor: channel === c.value ? "#1d4ed8" : "#f1f5f9" } }} />
            ))}
          </Stack>

          <StepLabel n={2} hint="* จำเป็น">ลูกค้าว่าอย่างไร</StepLabel>
          <TextField multiline minRows={5} maxRows={14} fullWidth placeholder="เช่น ลูกค้ารอเข้าที่ประชุมสิ้นเดือน / ขอส่วนลดเพิ่ม 5% / ให้โทรกลับวันศุกร์"
            value={note} onChange={(e) => setNote(e.target.value)}
            sx={{ mb: 1.5, "& .MuiOutlinedInput-root": { bgcolor: "#fff", borderRadius: 2, fontSize: "0.92rem", lineHeight: 1.6, alignItems: "flex-start" } }} />

          <StepLabel n={3} hint="ไม่บังคับ">นัดติดตามครั้งถัดไป และหลักฐาน</StepLabel>
          <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, alignItems: "start" }}>
            <Box>
              <ThaiDatePicker label="นัดติดตามครั้งถัดไป" value={next} onChange={(v) => setNext(v || "")} />
              <Typography sx={{ fontSize: "0.7rem", color: TEXT_SUB, mt: 0.4 }}>ไม่ระบุ = ระบบเตือนให้ติดตามอีก {WARNING_DAYS_AFTER_SENT} วัน</Typography>
            </Box>
            <Box>
              <input ref={inputRef} type="file" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <Stack direction="row" alignItems="center" gap={0.5}
                sx={{ height: 40, px: 1.25, borderRadius: 2, border: `1px dashed ${file ? "#2563eb" : "#cbd5e1"}`, bgcolor: "#fff", cursor: "pointer" }}
                onClick={() => inputRef.current?.click()}>
                <AttachFile sx={{ fontSize: 17, color: file ? "#2563eb" : TEXT_SUB }} />
                <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.82rem", fontWeight: 700, color: file ? "#2563eb" : TEXT_SUB }}>
                  {file ? file.name : "แนบหลักฐาน (รูปแชท / อีเมล)"}
                </Typography>
                {file && <IconButton size="small" onClick={(e) => { e.stopPropagation(); setFile(null); }}><Close sx={{ fontSize: 16 }} /></IconButton>}
              </Stack>
            </Box>
          </Box>

          <Button fullWidth variant="contained" disabled={!note.trim() || busy} startIcon={<Save sx={{ fontSize: 18 }} />} onClick={submit}
            sx={{ mt: 1.75, height: 44, textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8", boxShadow: "none" } }}>
            {busy ? "กำลังบันทึก..." : `บันทึกการติดตามครั้งที่ ${nextNo}`}
          </Button>
          {!note.trim() && <Typography sx={{ mt: 0.5, textAlign: "center", fontSize: "0.7rem", color: TEXT_SUB }}>กรอกข้อ ② ก่อนจึงบันทึกได้</Typography>}
        </Box>
      )}

      {followUps.length > 0 ? (
        <Box>
          <Typography sx={{ fontSize: "0.76rem", fontWeight: 800, color: TEXT_SUB, mb: 1 }}>ประวัติการติดตาม (ล่าสุดอยู่บน)</Typography>
          <Stack spacing={1}>
            {followUps.slice().reverse().map((x, i) => (
              <Box key={x._id || i} sx={{ p: 1.25, borderRadius: 2, border: `1px solid ${BORDER}`, bgcolor: i === 0 ? "#fff" : "#fcfdfe", boxShadow: i === 0 ? "inset 3px 0 0 #2563eb" : "none" }}>
                <Stack direction="row" alignItems="center" gap={0.75} sx={{ flexWrap: "wrap" }}>
                  <Box component="span" sx={{ px: 0.9, height: 22, display: "inline-flex", alignItems: "center", borderRadius: 99, bgcolor: i === 0 ? "#2563eb" : "#e2e8f0", color: i === 0 ? "#fff" : "#334155", fontSize: "0.72rem", fontWeight: 900 }}>
                    ครั้งที่ {x.attemptNumber}
                  </Box>
                  {x.channel && <Chip size="small" label={channelLabel(x.channel)} sx={{ height: 22, fontSize: "0.7rem", fontWeight: 800, bgcolor: "#f1f5f9" }} />}
                  <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>{formatThai(moment(x.contactedAt).locale("th"), "D MMM YY · HH:mm")} น. · {x.userName}</Typography>
                </Stack>
                {x.note && <Typography sx={{ fontSize: "0.88rem", color: "#1e293b", whiteSpace: "pre-wrap", mt: 0.6, lineHeight: 1.6 }}>{x.note}</Typography>}
                {x.evidenceFileUrl && (
                  <Box component="button" type="button" onClick={() => onPreview(x.evidenceFileUrl, x.evidenceFileName)}
                    sx={{ mt: 0.6, display: "inline-flex", alignItems: "center", gap: 0.4, height: 24, px: 0.9, border: 0, borderRadius: 99, cursor: "pointer", font: "inherit",
                      bgcolor: alpha("#2563eb", 0.08), color: "#2563eb", fontSize: "0.72rem", fontWeight: 800 }}>
                    <AttachFile sx={{ fontSize: 14 }} />ดูหลักฐาน
                  </Box>
                )}
              </Box>
            ))}
          </Stack>
        </Box>
      ) : !canWrite ? (
        <Typography sx={{ fontSize: "0.82rem", color: TEXT_SUB }}>
          {a.quotationStatus ? "ไม่มีบันทึกการติดตาม" : "บันทึกการติดตามได้เมื่อระบบเริ่มนับ (แนบไฟล์ใบเสนอราคาแล้ว)"}
        </Typography>
      ) : null}
    </Section>
  );
};

// ─── กล่องรายละเอียด ─────────────────────────────────────────────────────────
// ✅ ผู้ใช้สั่ง (3 ต.ค. 2569): ตัดขั้น "ส่งลูกค้า" — ระบบเริ่มนับติดตามเองเมื่อแนบใบเสนอราคาและช่างส่งงานแล้ว
//    (server: services/quotationAutoStart.js)
// 🔁 (19 ต.ค. 2569 ผู้ใช้: "การติดตามใบเสนอราคาไม่ชัดเจน ดูไม่เข้าใจ ดูยาก · ทำให้ครบถ้วนสมบูรณ์ UX/UI สวยงาม")
//    โครงใหม่อ่านจากบนลงล่างตามคำถามที่คนเปิดกล่องอยากรู้:
//      ① ตอนนี้อยู่ขั้นไหน (ขั้นตอน 4 ขั้นมีเลข + คำอธิบายใต้ขั้น)
//      ② ต้องทำอะไรต่อ (กล่อง "ขั้นตอนถัดไป" ปุ่มหลักปุ่มเดียว + ปุ่มได้งาน/ไม่ได้งาน)
//      ③ ใบเสนอราคาคืออะไร (ไฟล์ + เลขที่/มูลค่า/ยืนราคา/ผู้ติดต่อ เห็นเสมอ ไม่ซ่อนในแถบพับ)
//      ④ ติดตามไปแล้วกี่ครั้ง (ฟอร์ม + ไทม์ไลน์) · ⑤ คุยกับช่าง · ประวัติ
//    คำเรียกตรงความหมาย: อนุมัติ/ปฏิเสธ → "ได้งาน" / "ไม่ได้งาน"
const STEPS = [
  { key: "file", label: "แนบใบเสนอราคา", hint: "ไฟล์ + เลขที่ + มูลค่า" },
  { key: "start", label: "เริ่มนับติดตาม", hint: "อัตโนมัติทันทีที่แนบไฟล์" },
  { key: "follow", label: "ติดตามลูกค้า", hint: `ทุก ${WARNING_DAYS_AFTER_SENT} วัน หรือตามนัด` },
  { key: "done", label: "ผลลัพธ์", hint: "ได้งาน / ไม่ได้งาน" },
];
const stepIndex = (k) => ({ waiting_file: 0, not_sent: 1, sent: 2, follow_up: 2, revising: 2, approved: 3, rejected: 3 }[k] ?? 0);

/** ตัวเลขสรุปเล็ก (กล่องขั้นตอนถัดไป / ผลลัพธ์) */
const MiniStat = ({ label, value, color }) => (
  <Box sx={{ minWidth: 0, px: 1.25, py: 0.9, borderRadius: 2, bgcolor: "#f8fafc", border: `1px solid ${BORDER}` }}>
    <Typography noWrap sx={{ fontSize: "0.68rem", fontWeight: 700, color: TEXT_SUB }}>{label}</Typography>
    <Typography noWrap sx={{ fontSize: "0.86rem", fontWeight: 800, color: color || TEXT_MAIN }}>{value || "—"}</Typography>
  </Box>
);

const DetailDialog = ({
  job, currentUser, onClose, onQuotation, onFollowUp, onComment, onFileUpload, onDeleteFile, onPreview, upload,
}) => {
  const fullScreen = useMediaQuery("(max-width:600px)");
  const navigate = useNavigate();
  const [decision, setDecision] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const followRef = useRef(null);
  if (!job) return null;
  const a = job.anchor;
  const k = job.groupKey;
  const m = STATUS[k] || STATUS.not_sent;
  const isFinance = can(currentUser, "editFinance");
  const step = stepIndex(k);
  const info = getFollowUpInfo(a);
  const log = (a.activityLog || []).filter((l) => String(l.action || "").startsWith("quotation")).slice().reverse();
  const open = ["sent", "follow_up", "revising"].includes(k);
  const comments = a.comments || [];
  const chatOpen = showChat || comments.length > 0;

  const confirmDecision = async ({ date, po, note }) => {
    setBusy(true);
    const action = decision === "resend" || decision === "send" ? "send" : decision;
    const body = action === "reset" ? { action } : { action, ...(action === "send" ? { sentAt: date } : { decidedAt: date, poNo: po, decisionNote: note }) };
    const ok = await onQuotation(job, body);
    setBusy(false);
    if (ok) setDecision(null);
  };
  const goFollow = () => {
    const el = followRef.current;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => el?.querySelector("textarea")?.focus(), 350);
  };

  // ── ② ขั้นตอนถัดไป: หัวข้อ · คำอธิบาย · ปุ่ม ──
  const due = !info ? "" : info.needsFollowUp ? `เลยกำหนดติดตาม ${-info.daysUntilDue} วัน` : info.daysUntilDue === 0 ? "ครบกำหนดติดตามวันนี้" : `ติดตามครั้งถัดไปอีก ${info.daysUntilDue} วัน`;
  const next = (() => {
    if (k === "waiting_file") {
      return { title: "แนบไฟล์ใบเสนอราคา", text: "กด “แนบไฟล์” ในกล่องใบเสนอราคาด้านล่าง (ช่างแนบจากหน้างานได้) — แนบแล้วระบบเริ่มนับวันติดตามให้ทันที ไม่ต้องกดเอง" };
    }
    if (k === "not_sent") {
      // 🔁 (19 ต.ค. 2569 ผู้ใช้: "นับตั้งแต่ช่างอัปไฟล์ · ไม่ต้องมากดเอง") เซิร์ฟเวอร์เริ่มนับทันทีที่อัปไฟล์ — สถานะนี้เห็นแค่ชั่วครู่
      return { title: "แนบแล้ว · ระบบกำลังเริ่มนับติดตามให้", text: "ไม่ต้องกดอะไร — ระบบเริ่มนับวันติดตามให้อัตโนมัติจากวันที่แนบไฟล์" };
    }
    if (open) {
      return {
        title: k === "revising" ? `ลูกค้าขอแก้ไข · ${due}` : due,
        tone: k === "follow_up" ? "#dc2626" : null,
        text: k === "follow_up"
          ? "ถึงเวลาโทร/ทักลูกค้าแล้ว — บันทึกผลทุกครั้งที่ติดต่อ ระบบจะนับรอบถัดไปให้"
          : "รอลูกค้าตัดสินใจ — ติดต่อแล้วบันทึกผลไว้ เมื่อลูกค้าตอบ กด “ได้งาน” หรือ “ไม่ได้งาน”",
        stats: true,
        decide: true,
        primary: { label: "บันทึกการติดตาม", icon: <EventRepeat />, onClick: goFollow },
      };
    }
    return null;
  })();
  const tone = next?.tone || m.color;

  return (
    <Dialog open onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="md" PaperProps={{ sx: { borderRadius: fullScreen ? 0 : 3, bgcolor: "#f8fafc" } }}>
      {/* ── หัว: ลูกค้า/โครงการ · งาน · มูลค่า ── */}
      <Box sx={{ px: { xs: 1.75, sm: 2.5 }, pt: 1.75, pb: 1.5, bgcolor: "#fff", borderBottom: `1px solid ${BORDER}` }}>
        <Stack direction="row" spacing={1.25} alignItems="flex-start">
          <Box sx={{ width: 42, height: 42, borderRadius: 2.5, flexShrink: 0, display: "grid", placeItems: "center", bgcolor: alpha(m.color, 0.1), color: m.color }}>
            <RequestQuote />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, color: TEXT_SUB, letterSpacing: 0.2 }}>ใบเสนอราคา{a.quotationNo ? ` · ${a.quotationNo}` : ""}</Typography>
            <Typography sx={{ fontWeight: 900, fontSize: "1.05rem", color: TEXT_MAIN, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {siteText(a)}
            </Typography>
            <Typography noWrap sx={{ fontSize: "0.76rem", color: TEXT_SUB }}>
              {[jobText(a), a.time ? `ครั้งที่ ${formatRoundLabel(a.time, a.visitCount, a)}` : "", formatEventDateRange(a), ownerOf(a) ? `ผู้รับผิดชอบ ${ownerOf(a)}` : ""].filter(Boolean).join(" · ")}
            </Typography>
          </Box>
          <Box sx={{ textAlign: "right", flexShrink: 0, display: { xs: "none", sm: "block" } }}>
            <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: TEXT_SUB }}>มูลค่า</Typography>
            <Typography sx={{ fontWeight: 900, fontSize: "1.1rem", color: a.quotationAmount ? TEXT_MAIN : "#94a3b8" }}>{a.quotationAmount ? baht(a.quotationAmount) : "ยังไม่ระบุ"}</Typography>
          </Box>
          <IconButton onClick={onClose} size="small" aria-label="ปิด" sx={{ mt: -0.25 }}><Close /></IconButton>
        </Stack>

        {/* ① ขั้นตอน 4 ขั้น — วงเลข/เครื่องหมายถูก + ชื่อขั้น + คำอธิบาย */}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", mt: 1.75 }}>
          {STEPS.map((s, i) => {
            const final = i === 3 && step === 3;
            const done = i < step;
            const cur = i === step && !final;
            const color = final ? m.color : done ? "#16a34a" : cur ? m.color : "#cbd5e1";
            const FinalIcon = k === "approved" ? CheckCircle : Cancel;
            const lineColor = i <= step ? (i < step || final ? "#16a34a" : color) : "#e2e8f0";
            return (
              <Box key={s.key} sx={{ position: "relative", textAlign: "center", px: 0.5 }}>
                {/* เส้นเชื่อมอยู่ "ใต้" วงกลม (zIndex 0) และเริ่ม-จบที่ขอบวง ไม่ลากทับตัวเลข */}
                {i > 0 && <Box sx={{ position: "absolute", top: 13, right: "calc(50% + 18px)", left: "calc(-50% + 18px)", height: 2, borderRadius: 1, bgcolor: lineColor, zIndex: 0 }} />}
                <Box sx={{ position: "relative", zIndex: 1, mx: "auto", width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center",
                  fontSize: "0.78rem", fontWeight: 900, color: done || cur || final ? "#fff" : "#94a3b8", bgcolor: done || cur || final ? color : "#fff",
                  border: `2px solid ${color}`, boxShadow: cur ? `0 0 0 4px ${alpha(color, 0.18)}` : "none" }}>
                  {final ? <FinalIcon sx={{ fontSize: 18 }} /> : done ? <Check sx={{ fontSize: 17 }} /> : i + 1}
                </Box>
                <Typography noWrap sx={{ mt: 0.5, fontSize: { xs: "0.7rem", sm: "0.78rem" }, fontWeight: cur || final ? 900 : 700, color: cur || final ? color : done ? TEXT_MAIN : "#94a3b8" }}>
                  {final ? m.label : s.label}
                </Typography>
                <Typography noWrap sx={{ fontSize: "0.66rem", color: "#94a3b8", display: { xs: "none", sm: "block" } }}>{s.hint}</Typography>
              </Box>
            );
          })}
        </Box>
      </Box>

      <DialogContent sx={{ px: { xs: 1.5, sm: 2.5 }, py: 1.75 }}>
        <Stack spacing={1.5}>
          {/* ── ② ขั้นตอนถัดไป ── */}
          {next && (
            <Box sx={{ p: { xs: 1.5, sm: 1.75 }, borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${alpha(tone, 0.35)}`, boxShadow: `inset 4px 0 0 ${tone}` }}>
              <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, color: TEXT_SUB, letterSpacing: 0.3 }}>ขั้นตอนถัดไป</Typography>
              <Typography sx={{ fontSize: "1rem", fontWeight: 900, color: next.tone || TEXT_MAIN, mt: 0.15 }}>{next.title}</Typography>
              {next.text && <Typography sx={{ fontSize: "0.8rem", color: "#475569", mt: 0.25 }}>{next.text}</Typography>}
              {next.stats && info && (
                <Box sx={{ display: "grid", gap: 0.75, mt: 1.25, gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, minmax(0, 1fr))" } }}>
                  <MiniStat label="เริ่มนับ" value={thaiDate(a.quotationSentAt)} />
                  <MiniStat label="ติดต่อล่าสุด" value={thaiDate(info.lastContactAt)} />
                  <MiniStat label={info.scheduled ? "นัดติดตาม" : "ครบกำหนดติดตาม"} value={thaiDate(info.dueAt)} color={info.needsFollowUp ? "#dc2626" : undefined} />
                  <MiniStat label="ติดตามแล้ว" value={`${info.followUpCount || 0} ครั้ง · เงียบ ${info.daysSinceLastContact} วัน`} />
                </Box>
              )}
              {(next.primary || next.decide) && (
                <Box sx={{ display: "grid", gap: 1, mt: 1.5, gridTemplateColumns: { xs: "1fr", sm: next.decide ? "1.2fr 1fr 1fr" : "auto" }, justifyContent: "start" }}>
                  {next.primary && (
                    <Button variant="contained" startIcon={next.primary.icon} onClick={next.primary.onClick}
                      sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", height: 42, px: 2.5, bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8", boxShadow: "none" } }}>
                      {next.primary.label}
                    </Button>
                  )}
                  {next.decide && (
                    <>
                      <Button variant="outlined" startIcon={<CheckCircle />} onClick={() => setDecision("approve")}
                        sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, height: 42, color: "#15803d", borderColor: "#86efac", bgcolor: "#fff", "&:hover": { borderColor: "#16a34a", bgcolor: "#f0fdf4" } }}>ได้งาน</Button>
                      <Button variant="outlined" startIcon={<Cancel />} onClick={() => setDecision("reject")}
                        sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, height: 42, color: "#b91c1c", borderColor: "#fca5a5", bgcolor: "#fff", "&:hover": { borderColor: "#dc2626", bgcolor: "#fef2f2" } }}>ไม่ได้งาน</Button>
                    </>
                  )}
                </Box>
              )}
            </Box>
          )}

          {/* ── ผลลัพธ์ (ได้งาน / ไม่ได้งาน) ── */}
          {["approved", "rejected"].includes(k) && (
            <Box sx={{ p: { xs: 1.5, sm: 1.75 }, borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${alpha(k === "approved" ? "#16a34a" : "#dc2626", 0.35)}`, boxShadow: `inset 4px 0 0 ${k === "approved" ? "#16a34a" : "#dc2626"}` }}>
              <Stack direction="row" spacing={1.25} alignItems="flex-start">
                {k === "approved" ? <CheckCircle sx={{ color: "#16a34a", fontSize: 28 }} /> : <Cancel sx={{ color: "#dc2626", fontSize: 28 }} />}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, color: TEXT_SUB, letterSpacing: 0.3 }}>ผลลัพธ์</Typography>
                  <Typography sx={{ fontSize: "1rem", fontWeight: 900, color: k === "approved" ? "#15803d" : "#b91c1c" }}>
                    {k === "approved" ? "ได้งาน — ลูกค้าตอบรับใบเสนอราคา" : "ไม่ได้งาน — ลูกค้าไม่รับใบเสนอราคา"}
                  </Typography>
                  <Box sx={{ display: "grid", gap: 0.75, mt: 1, gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, minmax(0, 1fr))" } }}>
                    <MiniStat label="วันที่ลูกค้าตอบ" value={a.quotationDecisionAt ? thaiDate(a.quotationDecisionAt) : ""} />
                    {k === "approved" && <MiniStat label="เลขที่ PO ลูกค้า" value={a.quotationPoNo} />}
                    <MiniStat label="บันทึกโดย" value={a.quotationDecisionBy} />
                  </Box>
                  {a.quotationDecisionNote && <Typography sx={{ fontSize: "0.84rem", color: "#334155", mt: 1 }}>{k === "rejected" ? "เหตุผล: " : "หมายเหตุ: "}{a.quotationDecisionNote}</Typography>}
                </Box>
                {isFinance && (
                  <Button size="small" startIcon={<Undo sx={{ fontSize: 16 }} />} onClick={() => setDecision("reset")} disabled={busy}
                    sx={{ textTransform: "none", fontWeight: 700, color: TEXT_SUB, flexShrink: 0 }}>แก้ผล</Button>
                )}
              </Stack>
            </Box>
          )}

          {/* ── ③ ใบเสนอราคา: ไฟล์ + ข้อมูล (เห็นเสมอ) ── */}
          <Section title="ใบเสนอราคา" icon={<Description />}>
            <FileUploadSection
              eventId={a._id} type="quotation" label="ไฟล์ใบเสนอราคา"
              files={a.quotationFiles} applicable={a.quotationApplicable}
              onUpload={onFileUpload} onDelete={onDeleteFile} onPreview={onPreview}
              uploading={upload.busy && upload.eventId === a._id} progress={upload.progress} currentUser={currentUser}
            />
            {open && (
              <Button size="small" startIcon={<Autorenew sx={{ fontSize: 16 }} />} onClick={() => setDecision("resend")}
                sx={{ mt: 0.5, textTransform: "none", fontWeight: 700, color: TEXT_SUB }}>ส่งฉบับแก้ไขให้ลูกค้าแล้ว (เริ่มนับใหม่)</Button>
            )}
            <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px dashed ${BORDER}` }}>
              <InfoSection a={a} isFinance={isFinance} canEdit onSave={(body) => onQuotation(job, body)} inline />
            </Box>
          </Section>

          {/* ── ④ การติดตามลูกค้า ── */}
          {(open || (a.quotationFollowUps || []).length > 0) && (
            <FollowUpSection a={a} canFollow formRef={followRef} onPreview={onPreview} onSubmit={(payload) => onFollowUp(job, payload)} />
          )}

          {/* ── ⑤ คุยกับช่าง (พับไว้ถ้ายังไม่มีข้อความ) ── */}
          <Box sx={{ border: `1px solid ${BORDER}`, borderRadius: 2.5, bgcolor: "#fff", overflow: "hidden" }}>
            <Button fullWidth onClick={() => setShowChat((v) => !v)} disabled={comments.length > 0}
              endIcon={comments.length ? null : <ExpandMore sx={{ transform: chatOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />}
              sx={{ textTransform: "none", justifyContent: "space-between", px: 1.75, py: 1.1, color: `${TEXT_MAIN} !important`, bgcolor: "#f8fafc", borderRadius: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chat sx={{ fontSize: 18, color: TEXT_SUB }} />
                <Typography sx={{ fontWeight: 800, fontSize: "0.88rem" }}>คุยกับช่าง{comments.length ? ` · ${comments.length}` : ""}</Typography>
              </Stack>
            </Button>
            <Collapse in={chatOpen} unmountOnExit>
              <Box sx={{ p: 1.75, borderTop: `1px solid ${BORDER}` }}>
                <CommentThread comments={a.comments} onSend={(message) => onComment(job, message)} myRole={currentUser} />
              </Box>
            </Collapse>
          </Box>

          {log.length > 0 && (
            <Section title="ประวัติ" icon={<History />}
              action={log.length > 3 ? <Button size="small" endIcon={<ExpandMore sx={{ transform: showLog ? "rotate(180deg)" : "none" }} />} onClick={() => setShowLog((v) => !v)} sx={{ textTransform: "none", fontWeight: 700 }}>{showLog ? "ย่อ" : `ทั้งหมด ${log.length}`}</Button> : null}>
              <Stack spacing={0.75}>
                {log.slice(0, 3).map((l, i) => <LogRow key={i} l={l} />)}
                <Collapse in={showLog} unmountOnExit><Stack spacing={0.75}>{log.slice(3).map((l, i) => <LogRow key={i} l={l} />)}</Stack></Collapse>
              </Stack>
            </Section>
          )}

          <Button fullWidth endIcon={<OpenInNew sx={{ fontSize: 17 }} />} onClick={() => navigate(`/operation/${a._id}`)}
            sx={{ textTransform: "none", justifyContent: "space-between", border: `1px dashed ${BORDER}`, borderRadius: 2, color: TEXT_SUB, bgcolor: "#fff" }}>
            เปิดงานนี้ในหน้าการดำเนินงาน
          </Button>
        </Stack>
      </DialogContent>
      <DecisionDialog mode={decision} busy={busy} onClose={() => setDecision(null)} onConfirm={confirmDecision}
        resetInfo={{ label: m.label, detail: [a.quotationDecisionAt ? `ลูกค้าตอบ ${thaiDate(a.quotationDecisionAt)}` : "", a.quotationPoNo ? `PO ${a.quotationPoNo}` : "", a.quotationDecisionNote ? `เหตุผล: ${a.quotationDecisionNote}` : ""].filter(Boolean).join(" · ") }} />
    </Dialog>
  );
};

const LogRow = ({ l }) => (
  <Stack direction="row" spacing={1} alignItems="baseline">
    <Typography sx={{ fontSize: "0.72rem", color: TEXT_SUB, whiteSpace: "nowrap", minWidth: 96 }}>{formatThai(moment(l.timestamp).locale("th"), "D MMM YY HH:mm")}</Typography>
    <Typography sx={{ fontSize: "0.8rem", color: "#334155", minWidth: 0 }}>{l.detail}{l.userName ? <Box component="span" sx={{ color: TEXT_SUB }}> — {l.userName}</Box> : null}</Typography>
  </Stack>
);

const errMsg = (err, fallback) => err?.response?.data?.message || err?.response?.data?.err || err?.message || fallback;

/** การบันทึกทั้งหมดของกล่องใบเสนอราคา — ใช้ร่วมกันระหว่างหน้านี้กับ QuotationDialogHost (หน้างานเข้า) */
function useQuotationActions(fetchJobs, toast, userData) {
  const [upload, setUpload] = useState({ busy: false, eventId: null, progress: 0 });
  const onQuotation = useCallback(async (job, body) => {
    try {
      await EventService.UpdateQuotation(job.anchor._id, body);
      await fetchJobs(true);
      toast(body.action === "approve" ? "บันทึกแล้ว: ได้งาน" : body.action === "reject" ? "บันทึกแล้ว: ไม่ได้งาน" : body.action === "send" ? "เริ่มนับวันติดตามแล้ว" : body.action === "reset" ? "แก้ผลแล้ว — กลับไปรอลูกค้าตอบ" : "บันทึกข้อมูลแล้ว");
      return true;
    } catch (err) {
      toast(errMsg(err, "บันทึกไม่สำเร็จ"), "error");
      return false;
    }
  }, [fetchJobs, toast]);
  const onFollowUp = useCallback(async (job, payload) => {
    try {
      await EventService.AddQuotationFollowUp(job.anchor._id, payload);
      await fetchJobs(true);
      toast("บันทึกการติดตามแล้ว");
      return true;
    } catch (err) {
      toast(errMsg(err, "บันทึกการติดตามไม่สำเร็จ"), "error");
      return false;
    }
  }, [fetchJobs, toast]);
  const onComment = useCallback(async (job, message) => {
    const p = JSON.parse(localStorage.getItem("payload") || "{}");
    const name = p?.fname ? `${p.fname} ${p.lname || ""}`.trim() : (p?.username || "ผู้ใช้");
    try {
      await EventService.UpdateEvent(job.anchor._id, {
        comments: [...(job.anchor.comments || []), { userId: p?.userId || "", userName: name, role: userData?.role?.toLowerCase(), message, timestamp: new Date().toISOString() }],
      });
      await fetchJobs(true);
    } catch (err) {
      toast(errMsg(err, "ส่งข้อความไม่สำเร็จ"), "error");
    }
  }, [fetchJobs, userData, toast]);
  const onFileUpload = useCallback(async (fileOrFiles, eventId, type) => {
    const files = Array.from(fileOrFiles?.length !== undefined ? fileOrFiles : [fileOrFiles]);
    if (!files.length) return;
    setUpload({ busy: true, eventId, progress: 0 });
    let ok = 0;
    try {
      for (const file of files) {
        // eslint-disable-next-line no-await-in-loop -- อัปโหลดทีละไฟล์ให้แถบความคืบหน้าถูกต้อง
        await EventService.Upload(eventId, file, type, {
          onUploadProgress: (pe) => setUpload((u) => ({ ...u, progress: Math.min(99, Math.round((pe.loaded * 100) / pe.total)) })),
        });
        ok += 1;
      }
      toast(`อัปโหลด ${ok} ไฟล์เรียบร้อย`);
    } catch (err) {
      toast(ok ? `อัปโหลดสำเร็จ ${ok}/${files.length} ไฟล์` : errMsg(err, "อัปโหลดไม่สำเร็จ"), "error");
    } finally {
      await fetchJobs(true);
      setUpload({ busy: false, eventId: null, progress: 0 });
    }
  }, [fetchJobs, toast]);
  const onDeleteFile = useCallback(async (eventId, type, fileId) => {
    try { await EventService.DeleteFile(eventId, type, fileId); toast("ลบไฟล์เรียบร้อย"); await fetchJobs(true); } catch { toast("ลบไฟล์ไม่สำเร็จ", "error"); }
  }, [fetchJobs, toast]);

  return { onQuotation, onFollowUp, onComment, onFileUpload, onDeleteFile, upload };
}

/**
 * QuotationDialogHost — เปิด "กล่องใบเสนอราคา" ตัวเดียวกับหน้านี้ จากหน้าอื่นได้เลย (เช่นหน้างานเข้า)
 * ✅ (19 ต.ค. 2569 ผู้ใช้: "อยากให้กดเปิดฟอร์มหน้าติดตามใบเสนอราคาได้เลย · ดำเนินการในหน้านี้ได้เลย")
 *    แนบไฟล์ · เริ่มนับ · บันทึกติดตาม · ได้งาน/ไม่ได้งาน · คอมเมนต์ — ฟอร์มและการบันทึกชุดเดียวกัน ไม่มีสองเวอร์ชัน
 * @param eventId  วันใดก็ได้ของงาน (หาทั้งกลุ่มเองแล้วยึดวันล่าสุดเป็นตัวแทน)
 */
export function QuotationDialogHost({ eventId, onClose, onChanged }) {
  const { userData } = useAuth();
  const [events, setEvents] = useState(null);
  const [preview, setPreview] = useState({ url: null, name: "" });
  const [snackbar, setSnackbar] = useState({ open: false, msg: "", severity: "success" });
  const toast = useCallback((msg, severity = "success") => setSnackbar({ open: true, msg, severity }), []);
  const fetchJobs = useCallback(async (silent = false) => {
    try {
      const res = await EventService.getEventOp({ detail: true });
      setEvents(res?.userEvents || []);
      if (silent) onChanged?.();
    } catch {
      toast("โหลดข้อมูลไม่สำเร็จ", "error");
      setEvents([]);
    }
  }, [onChanged, toast]);
  useEffect(() => { fetchJobs(); }, [fetchJobs]);
  const actions = useQuotationActions(fetchJobs, toast, userData);
  const job = useMemo(() => {
    const ev = (events || []).find((e) => e._id === eventId);
    if (!ev) return null;
    const key = getOverdueGroupKey(ev);
    const sessions = events.filter((e) => getOverdueGroupKey(e) === key).sort((x, y) => new Date(y.start) - new Date(x.start));
    const anchor = sessions[0];
    // ยังไม่มีใบเสนอราคาเลย → เปิดที่ขั้น "แนบใบเสนอราคา"
    return { sessions, anchor, groupKey: resolveQuotationGroup(anchor) || "waiting_file", info: getFollowUpInfo(anchor) };
  }, [events, eventId]);

  return (
    <>
      {events === null ? (
        <Dialog open onClose={onClose} PaperProps={{ sx: { borderRadius: 3, p: 3 } }}><Typography sx={{ color: TEXT_SUB }}>กำลังโหลดใบเสนอราคา...</Typography></Dialog>
      ) : job ? (
        <DetailDialog job={job} currentUser={userData} onClose={onClose} {...actions} onPreview={(url, name) => setPreview({ url, name })} />
      ) : (
        <Dialog open onClose={onClose} PaperProps={{ sx: { borderRadius: 3, p: 3 } }}>
          <Typography sx={{ fontWeight: 800 }}>ไม่พบงานนี้ในระบบติดตามใบเสนอราคา</Typography>
          <Typography sx={{ color: TEXT_SUB, fontSize: "0.85rem", mt: 0.5 }}>งานต้องส่งลงตารางก่อน จึงแนบ/ติดตามใบเสนอราคาได้</Typography>
          <Button onClick={onClose} sx={{ mt: 2, alignSelf: "flex-end", textTransform: "none", fontWeight: 800 }}>ปิด</Button>
        </Dialog>
      )}
      <FilePreviewDialog previewUrl={preview.url} previewFileName={preview.name} onClose={() => setPreview({ url: null, name: "" })} />
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((p) => ({ ...p, open: false }))} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snackbar.severity} variant="filled" sx={{ borderRadius: 2 }}>{snackbar.msg}</Alert>
      </Snackbar>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function QuotationTracking() {
  const { userData } = useAuth();
  const isDesktop = useMediaQuery("(min-width:900px)");
  const canAccess = can(userData, "viewFinance");
  const [searchParams, setSearchParams] = useSearchParams();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("open");
  const [owner, setOwner] = useState("all");
  const [period, setPeriod] = useState("all");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detailId, setDetailId] = useState("");
  const [preview, setPreview] = useState({ url: null, name: "" });
  const [snackbar, setSnackbar] = useState({ open: false, msg: "", severity: "success" });
  const topRef = useRef(null);

  const toast = (msg, severity = "success") => setSnackbar({ open: true, msg, severity });

  const fetchJobs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // ⚠️ detail = ขอ activityLog มาด้วย (ประวัติใบเสนอราคาในกล่องรายละเอียด)
      const res = await EventService.getEventOp({ detail: true });
      setEvents(res?.userEvents || []);
      setLastRefreshed(new Date());
    } catch {
      if (!silent) toast("โหลดรายการไม่สำเร็จ", "error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);
  useEffect(() => { if (canAccess) fetchJobs(); }, [fetchJobs, canAccess]);
  useRealtime("events", () => fetchJobs(true), { enabled: Boolean(canAccess) });

  // งานหลายวัน (jobGroupId เดียวกัน) = ใบเสนอราคาใบเดียว — ยึดวันล่าสุดของกลุ่มเป็นตัวแทน
  const jobs = useMemo(() => {
    const map = new Map();
    events.forEach((ev) => {
      const key = getOverdueGroupKey(ev);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    });
    return [...map.values()]
      .map((sessions) => sessions.slice().sort((x, y) => new Date(y.start) - new Date(x.start)))
      .map((sessions) => {
        const anchor = sessions[0];
        return { sessions, anchor, groupKey: resolveQuotationGroup(anchor), info: getFollowUpInfo(anchor) };
      })
      .filter((j) => j.groupKey !== "");
  }, [events]);

  // deep-link ?jobId= (แจ้งเตือน/Dashboard) → เปิดใบนั้นเลย
  useEffect(() => {
    const jobId = searchParams.get("jobId");
    if (!jobId || !jobs.length) return;
    const target = jobs.find((j) => j.sessions.some((s) => s._id === jobId));
    if (target) setDetailId(target.anchor._id);
    setSearchParams((prev) => { const next = new URLSearchParams(prev); next.delete("jobId"); return next; }, { replace: true });
  }, [jobs, searchParams, setSearchParams]);
  const detailJob = useMemo(() => jobs.find((j) => j.sessions.some((s) => s._id === detailId)) || null, [jobs, detailId]);

  // ── ตัวกรอง ──
  const inPeriod = useCallback((a) => {
    if (period === "all") return true;
    const d = moment(refDateOf(a));
    if (period === "month") return d.isSameOrAfter(moment().startOf("month"));
    if (period === "3m") return d.isSameOrAfter(moment().subtract(2, "months").startOf("month"));
    return d.isSameOrAfter(moment().startOf("year"));
  }, [period]);
  const matchQ = useCallback((a) => {
    const q = search.trim().toLowerCase();
    return !q || [a.company, a.site, a.title, a.system, a.docNo, a.quotationNo, a.quotationPoNo, ownerOf(a), a.quotationContact?.name]
      .some((v) => String(v || "").toLowerCase().includes(q));
  }, [search]);
  const scoped = useMemo(() => jobs.filter((j) => matchQ(j.anchor) && inPeriod(j.anchor)), [jobs, matchQ, inPeriod]);
  const owners = useMemo(() => {
    const m = new Map();
    scoped.forEach((j) => { const n = ownerOf(j.anchor) || "ไม่ระบุ"; m.set(n, (m.get(n) || 0) + 1); });
    return [...m].sort((x, y) => y[1] - x[1]);
  }, [scoped]);
  const base = useMemo(() => scoped.filter((j) => owner === "all" || (ownerOf(j.anchor) || "ไม่ระบุ") === owner), [scoped, owner]);

  const counts = useMemo(() => {
    const c = { all: base.length, open: 0, incomplete: 0 };
    base.forEach((j) => { c[j.groupKey] = (c[j.groupKey] || 0) + 1; if (OPEN.includes(j.groupKey)) c.open += 1; if (missingInfo(j.anchor)) c.incomplete += 1; });
    return c;
  }, [base]);
  const stats = useMemo(() => {
    const sum = (list) => list.reduce((s, j) => s + (Number(j.anchor.quotationAmount) || 0), 0);
    const pending = base.filter((j) => ["sent", "follow_up", "revising"].includes(j.groupKey));
    const approved = base.filter((j) => j.groupKey === "approved");
    const rejected = base.filter((j) => j.groupKey === "rejected");
    const decided = approved.length + rejected.length;
    return {
      pendingValue: sum(pending), pendingCount: pending.length,
      approvedValue: sum(approved), approvedCount: approved.length,
      winRate: decided ? Math.round((approved.length / decided) * 100) : null, decided,
      urgentValue: sum(base.filter((j) => j.groupKey === "follow_up")),
    };
  }, [base]);

  const visible = useMemo(() => {
    let list = base;
    if (status === "open") list = base.filter((j) => OPEN.includes(j.groupKey));
    else if (status === "incomplete") list = base.filter((j) => missingInfo(j.anchor));
    else if (status !== "all") list = base.filter((j) => j.groupKey === status);
    // เรียง: ขั้นที่ต้องจัดการก่อน → ครบกำหนดติดตามใกล้สุด → ใหม่สุด
    return list.slice().sort((x, y) => (STATUS_ORDER.indexOf(x.groupKey) - STATUS_ORDER.indexOf(y.groupKey))
      || ((x.info?.daysUntilDue ?? 999) - (y.info?.daysUntilDue ?? 999))
      || (new Date(refDateOf(y.anchor)) - new Date(refDateOf(x.anchor))));
  }, [base, status]);
  useEffect(() => { setPage(1); }, [status, owner, period, search]);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const cur = Math.min(page, pageCount);
  const pageRows = visible.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);

  const { onQuotation, onFollowUp, onComment, onFileUpload, onDeleteFile, upload } = useQuotationActions(fetchJobs, toast, userData);

  const doExport = async () => {
    if (exporting || !visible.length) return;
    setExporting(true);
    try {
      const { exportQuotationsToExcel, buildQuotationFileName } = await import("../utils/quotationExcelExport");
      const tabLabel = status === "open" ? "กำลังดำเนินการ" : status === "all" ? "ทั้งหมด" : status === "incomplete" ? "ข้อมูลไม่ครบ" : STATUS[status]?.label || "ทั้งหมด";
      const filters = [search.trim() && `ค้นหา "${search.trim()}"`, owner !== "all" && `ผู้รับผิดชอบ ${owner}`, period !== "all" && PERIODS.find((x) => x.value === period)?.label].filter(Boolean);
      await exportQuotationsToExcel({
        jobs: visible,
        meta: {
          fileName: buildQuotationFileName(tabLabel), tabLabel: `หมวด: ${tabLabel}`,
          filterSummary: filters.length ? `ตัวกรอง: ${filters.join(" · ")}` : "ไม่ได้กรองเพิ่มเติม",
          exportedAt: formatThai(moment(), "DD/MM/YYYY HH:mm"),
        },
        getFollowUpInfo, formatEventDateRange,
      });
    } catch (err) {
      toast(errMsg(err, "ส่งออกไม่สำเร็จ"), "error");
    } finally {
      setExporting(false);
    }
  };

  // จำนวนตัวกรองที่ต่างจากค่าเริ่มต้น — ป้ายบนปุ่มตัวกรอง (มือถือ)
  const activeFilters = (search.trim() ? 1 : 0) + (owner !== "all" ? 1 : 0) + (period !== "all" ? 1 : 0) + (status !== "open" ? 1 : 0);
  useCloseOnPick(filtersOpen, () => setFiltersOpen(false), { status, owner, period });

  if (!loading && !canAccess) return <Navigate to="/dashboard" replace />;

  const tiles = [
    { value: "open", label: "กำลังดำเนินการ", shortLabel: "ดำเนินการ", count: counts.open, unit: "ใบ", icon: <Apps />, color: "#475569" },
    // ✅ โชว์เฉพาะสถานะที่มีใบอยู่จริง (หรือกำลังเลือกอยู่) — การ์ดเลข 0 เรียงเต็มแถวทำให้รกตา
    ...STATUS_ORDER.filter((s) => (counts[s] || 0) > 0 || status === s).map((s) => {
      const m = STATUS[s];
      const Icon = m.icon;
      return { value: s, label: m.label, shortLabel: m.short, count: counts[s] || 0, unit: "ใบ", icon: <Icon />, color: s === "follow_up" ? m.color : "#475569", alert: s === "follow_up" };
    }),
    { value: "all", label: "ทั้งหมด", count: counts.all, unit: "ใบ", icon: <Insights />, color: "#475569" },
  ];

  const filterBar = (
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}
        sx={isDesktop ? { mb: 1.5, p: 1, bgcolor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 3, boxShadow: "0 1px 2px rgba(15,23,42,.04)" } : {}}>
        <TextField size="small" placeholder="ค้นหาลูกค้า / โครงการ / เลขที่ใบเสนอราคา / PO / ผู้ติดต่อ" value={search} onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1, minWidth: 0, "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: "#f8fafc", height: 40, "& fieldset": { borderColor: "transparent" }, "&:hover fieldset": { borderColor: BORDER }, "&.Mui-focused": { bgcolor: "#fff" } } }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 19, color: TEXT_SUB }} /></InputAdornment>,
            endAdornment: search ? <InputAdornment position="end"><IconButton size="small" onClick={() => setSearch("")}><Close sx={{ fontSize: 17 }} /></IconButton></InputAdornment> : null,
          }} />
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          <SelectField label="ผู้รับผิดชอบ" value={owner} onChange={(e) => setOwner(e.target.value)} sx={{ minWidth: { xs: 0, md: 190 }, flex: { xs: "1 1 0", md: "none" } }}>
            <option value="all">ทุกคน ({scoped.length})</option>
            {owners.map(([n, c]) => <option key={n} value={n}>{n} ({c})</option>)}
          </SelectField>
          <SelectField label="ช่วงเวลา" value={period} onChange={(e) => setPeriod(e.target.value)} sx={{ minWidth: { xs: 0, md: 150 }, flex: { xs: "1 1 0", md: "none" } }}>
            {PERIODS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </SelectField>
          <Tooltip title="ส่งออกรายการที่กรองอยู่เป็น Excel">
            <span>
              <Button onClick={doExport} disabled={exporting || !visible.length} startIcon={<FontAwesomeIcon icon={faFileExcel} />}
                sx={{ height: 40, flexShrink: 0, textTransform: "none", fontWeight: 700, borderRadius: 2.5, color: "#047857", border: `1px solid ${alpha("#047857", 0.3)}`, px: 1.5, "& .MuiButton-startIcon": { mr: { xs: 0, sm: 1 } } }}>
                <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>{exporting ? "กำลังส่งออก..." : "Excel"}</Box>
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </Stack>
  );
  const tilesEl = <ViewTiles value={status} onChange={setStatus} isMobile={!isDesktop} groups={[{ title: "", items: tiles }]} />;
  const statusLabel = status === "open" ? "กำลังดำเนินการ" : status === "all" ? "ทั้งหมด" : status === "incomplete" ? "ข้อมูลไม่ครบ" : STATUS[status]?.label || "";

  return (
    <Box sx={PAGE_SX}>
      {/* ── หัวเพจ ── */}
      <Box sx={{ borderRadius: 3, border: `1px solid ${BORDER}`, bgcolor: "#fff", px: { xs: 1.5, sm: 2 }, py: { xs: 1.25, sm: 1.5 }, mb: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2.5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#eff6ff", color: "#2563eb" }}>
            <RequestQuote />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 900, fontSize: { xs: "1.1rem", sm: "1.25rem" }, color: TEXT_MAIN, lineHeight: 1.25 }}>ติดตามใบเสนอราคา</Typography>
            <Typography noWrap sx={{ fontSize: "0.76rem", color: TEXT_SUB }}>
              แนบใบเสนอราคา → เริ่มนับติดตามอัตโนมัติทันที → ติดตามลูกค้า (ทุก {WARNING_DAYS_AFTER_SENT} วัน หรือตามนัด) → ได้งาน / ไม่ได้งาน
              {lastRefreshed ? ` · อัปเดต ${moment(lastRefreshed).format("HH:mm")}` : ""}
            </Typography>
          </Box>
          <Tooltip title="รีเฟรช">
            <IconButton onClick={() => fetchJobs()} sx={{ border: `1px solid ${BORDER}`, borderRadius: 2, display: { xs: "none", md: "inline-flex" } }}><Refresh sx={{ fontSize: 20 }} /></IconButton>
          </Tooltip>
          {/* ✅ มือถือ: ค้นหา/ตัวกรอง/สถานะ ซ่อนในแผ่นล่าง (เหมือนหน้าใบเบิก/ใบขอซื้อ) — ผู้ใช้สั่ง 2 ต.ค. 2569 */}
          {/* ✅ Excel ต้องกดได้เสมอ (แท็บเล็ต/มือถือด้วย) — ไม่ซ่อนไว้ในแผ่นตัวกรองอย่างเดียว */}
          {!isDesktop && (
            <IconButton aria-label="ส่งออก Excel" onClick={doExport} disabled={exporting || !visible.length}
              sx={{ width: 42, height: 42, borderRadius: 2.5, border: `1px solid ${BORDER}`, color: "#047857" }}>
              <FontAwesomeIcon icon={faFileExcel} style={{ fontSize: 17 }} />
            </IconButton>
          )}
          {!isDesktop && (
            <IconButton aria-label="ค้นหาและตัวกรอง" onClick={() => setFiltersOpen(true)}
              sx={{ width: 42, height: 42, borderRadius: 2.5, border: `1px solid ${BORDER}`, bgcolor: activeFilters ? "#f1f5f9" : "#fff", color: TEXT_MAIN }}>
              <Badge badgeContent={activeFilters} color="error" sx={{ "& .MuiBadge-badge": { fontSize: "0.62rem", height: 16, minWidth: 16 } }}><Tune sx={{ fontSize: 21 }} /></Badge>
            </IconButton>
          )}
        </Stack>
      </Box>

      {/* ── ตัวเลขสรุป ── */}
      {loading ? (
        <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, 1fr)" }, mb: 1.5 }}>
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} variant="rounded" height={78} sx={{ borderRadius: 2.5 }} />)}
        </Box>
      ) : (
        <Box sx={{
          display: "grid", gap: 1, mb: 1.5,
          // มือถือ: แถวเดียวเลื่อนแนวนอน (ไม่กินจอครึ่งหน้าก่อนถึงรายการ)
          gridTemplateColumns: { xs: "none", md: "repeat(5, 1fr)" }, gridAutoFlow: { xs: "column", md: "row" }, gridAutoColumns: { xs: "44%", md: "auto" },
          overflowX: { xs: "auto", md: "visible" }, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" },
        }}>
          <Kpi label="มูลค่ารอลูกค้าตอบ" value={baht(stats.pendingValue)} sub={`${stats.pendingCount} ใบ`} color="#2563eb" onClick={() => setStatus("open")} active={status === "open"} />
          <Kpi label="ต้องติดตามด่วน" value={`${counts.follow_up || 0} ใบ`} sub={counts.follow_up ? `มูลค่า ${baht(stats.urgentValue)}` : "ไม่มีใบเลยกำหนด"} color="#dc2626" alert={counts.follow_up > 0} onClick={() => setStatus("follow_up")} active={status === "follow_up"} />
          <Kpi label="ได้งานแล้ว" value={baht(stats.approvedValue)} sub={`${stats.approvedCount} ใบ`} color="#15803d" onClick={() => setStatus("approved")} active={status === "approved"} />
          <Kpi label="อัตราปิดการขาย" value={stats.winRate === null ? "—" : `${stats.winRate}%`} sub={stats.decided ? `ได้งาน ${stats.approvedCount} จาก ${stats.decided} ใบที่ได้คำตอบ` : "ยังไม่มีใบที่ได้คำตอบ"} color="#0f172a" />
          <Box sx={{ display: "grid" }}><Kpi label="ข้อมูลไม่ครบ" value={`${counts.incomplete} ใบ`} sub="ไม่มีเลขที่ หรือ ไม่มีมูลค่า" color="#b45309" alert={counts.incomplete > 0} onClick={() => setStatus("incomplete")} active={status === "incomplete"} /></Box>
        </Box>
      )}

      {/* ── ค้นหา + ตัวกรอง ── จอใหญ่วางบนหน้า · มือถืออยู่ในแผ่นล่าง */}
      <Box ref={topRef} sx={{ scrollMarginTop: 72 }} />
      {isDesktop ? (
        <>
          {filterBar}
          {tilesEl}
        </>
      ) : (
        <>
          {activeFilters > 0 && (
            <Stack direction="row" spacing={0.75} useFlexGap sx={{ mb: 1.25, flexWrap: "wrap" }}>
              {status !== "open" && <Chip size="small" label={`สถานะ: ${statusLabel}`} onDelete={() => setStatus("open")} sx={{ fontWeight: 700 }} />}
              {search.trim() && <Chip size="small" label={`ค้นหา: ${search.trim()}`} onDelete={() => setSearch("")} sx={{ fontWeight: 700, maxWidth: "100%" }} />}
              {owner !== "all" && <Chip size="small" label={`ผู้รับผิดชอบ: ${owner}`} onDelete={() => setOwner("all")} sx={{ fontWeight: 700 }} />}
              {period !== "all" && <Chip size="small" label={PERIODS.find((x) => x.value === period)?.label} onDelete={() => setPeriod("all")} sx={{ fontWeight: 700 }} />}
            </Stack>
          )}
          <Drawer anchor="bottom" open={filtersOpen} onClose={() => setFiltersOpen(false)}
            PaperProps={{ sx: { borderTopLeftRadius: 18, borderTopRightRadius: 18, px: 2, pt: 1, pb: "calc(16px + env(safe-area-inset-bottom))", maxHeight: "88vh" } }}>
            <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: "#cbd5e1", mx: "auto", mb: 1.25 }} />
            <Stack direction="row" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography sx={{ flex: 1, fontWeight: 800, fontSize: "1rem", color: TEXT_MAIN }}>ค้นหาและตัวกรอง</Typography>
              {activeFilters > 0 && (
                <Button size="small" onClick={() => { setSearch(""); setOwner("all"); setPeriod("all"); setStatus("open"); }} sx={{ textTransform: "none", fontWeight: 700, color: "#dc2626" }}>ล้างทั้งหมด</Button>
              )}
              <IconButton size="small" aria-label="ปิด" onClick={() => setFiltersOpen(false)}><Close /></IconButton>
            </Stack>
            {filterBar}
            <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: TEXT_SUB, mt: 1.75, mb: 0.75 }}>สถานะ</Typography>
            <Box sx={{ "& > div": { mb: 0 } }}>{tilesEl}</Box>
            <Button fullWidth variant="contained" onClick={() => setFiltersOpen(false)}
              sx={{ mt: 2, py: 1.1, textTransform: "none", fontWeight: 800, borderRadius: 2.5, boxShadow: "none", bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8", boxShadow: "none" } }}>
              ดูผลลัพธ์ {visible.length.toLocaleString()} ใบ
            </Button>
          </Drawer>
        </>
      )}

      {/* ── รายการ ── */}
      {loading ? (
        <Stack spacing={1}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={isDesktop ? 54 : 100} sx={{ borderRadius: 2 }} />)}</Stack>
      ) : !visible.length ? (
        <Stack alignItems="center" spacing={1} sx={{ py: 6, px: 2, bgcolor: "#fff", border: `1px dashed ${BORDER}`, borderRadius: 2.5, textAlign: "center" }}>
          <RequestQuote sx={{ fontSize: 44, color: "#cbd5e1" }} />
          <Typography sx={{ fontWeight: 700, color: TEXT_SUB }}>{jobs.length ? "ไม่พบใบเสนอราคาตามตัวกรอง" : "ยังไม่มีใบเสนอราคาให้ติดตาม"}</Typography>
          {!jobs.length && <Typography sx={{ fontSize: "0.8rem", color: "#94a3b8" }}>งานที่ระบุว่า "มีใบเสนอราคา" ในหน้าการดำเนินงาน จะขึ้นที่นี่</Typography>}
        </Stack>
      ) : (
        <>
          {isDesktop
            ? <DesktopTable jobs={pageRows} onOpen={(j) => setDetailId(j.anchor._id)} onPreview={(url, name) => setPreview({ url, name })} />
            : <Stack spacing={1}>{pageRows.map((j) => <MobileCard key={j.anchor._id} job={j} onOpen={(x) => setDetailId(x.anchor._id)} onPreview={(url, name) => setPreview({ url, name })} />)}</Stack>}
          <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" spacing={1} sx={{ mt: 1.5 }}>
            <Typography sx={{ flex: 1, fontSize: "0.76rem", color: TEXT_SUB }}>
              {pageCount > 1 ? `แสดง ${(cur - 1) * PAGE_SIZE + 1}–${(cur - 1) * PAGE_SIZE + pageRows.length} จาก ` : ""}{visible.length} ใบ · มูลค่ารวม {baht(visible.reduce((s, j) => s + (Number(j.anchor.quotationAmount) || 0), 0))}
            </Typography>
            {pageCount > 1 && (
              <Pagination count={pageCount} page={cur} shape="rounded" size={isDesktop ? "medium" : "small"} siblingCount={isDesktop ? 1 : 0}
                onChange={(_, n) => { setPage(n); topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                sx={{ "& .Mui-selected": { bgcolor: "#eff6ff !important", color: "#1d4ed8", borderColor: "#bfdbfe" } }} />
            )}
          </Stack>
        </>
      )}

      {detailJob && (
        <DetailDialog
          job={detailJob} currentUser={userData} onClose={() => setDetailId("")}
          onQuotation={onQuotation} onFollowUp={onFollowUp} onComment={onComment}
          onFileUpload={onFileUpload} onDeleteFile={onDeleteFile} onPreview={(url, name) => setPreview({ url, name })} upload={upload}
        />
      )}
      <FilePreviewDialog previewUrl={preview.url} previewFileName={preview.name} onClose={() => setPreview({ url: null, name: "" })} />
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((p) => ({ ...p, open: false }))} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snackbar.severity} variant="filled" sx={{ borderRadius: 2 }}>{snackbar.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
