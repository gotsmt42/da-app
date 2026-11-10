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
  Box, Stack, Typography, TextField, InputAdornment, IconButton, Chip, Avatar, Tooltip, Skeleton, CircularProgress, Snackbar, Alert,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, useMediaQuery, Pagination, Checkbox, FormControlLabel,
  Collapse, Drawer, Badge,
} from "@mui/material";
import { SearchRounded as Search, CloseRounded as Close, RefreshRounded as Refresh, RequestQuoteRounded as RequestQuote, SendRounded as Send, CheckCircleRounded as CheckCircle, CancelRounded as Cancel, AutorenewRounded as Autorenew, HourglassTopRounded as HourglassTop, WarningAmberRounded as WarningAmber, ChevronRightRounded as ChevronRight, AttachFileRounded as AttachFile, ChatRounded as Chat, OpenInNewRounded as OpenInNew, HistoryRounded as History, AppsRounded as Apps, DescriptionRounded as Description, EditRounded as Edit, PhoneRounded as Phone, EmailRounded as Email, EventRepeatRounded as EventRepeat, UndoRounded as Undo, SaveRounded as Save, InsightsRounded as Insights, ExpandMoreRounded as ExpandMore, TuneRounded as Tune, CheckRounded as Check } from "@mui/icons-material";

import useRealtime from "@/shared/realtime/useRealtime";
import { useAuth } from "@/features/auth/AuthContext";
import EventService from "@/shared/services/EventService";
import { FileUploadSection, CommentThread, FilePreviewDialog } from "@/features/operation/components/OperationBoard";
import AttachmentList from "@/shared/ui/AttachmentList";
import FileKindThumb from "@/shared/ui/FileKindThumb";
import { fileKindOf } from "@/shared/utils/fileKind";
import { getOverdueGroupKey } from "@/shared/utils/overdueJobs";
import { WARNING_DAYS_AFTER_SENT, getFollowUpInfo, resolveQuotationGroup, QUOTE_STATUS, quoteRevOf, revLabel, currentFollowUps } from "@/shared/utils/quotationTracking";
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
import ExportExcelButton from "@/shared/ui/ExportExcelButton";
import QuoteOnlyDialog from "@/features/finance/components/QuoteOnlyDialog";
import Swal from "@/shared/ui/swal";
import AddRounded from "@mui/icons-material/AddRounded";

const TEXT_MAIN = "#0f172a";
const TEXT_SUB = "#64748b";
const BORDER = "#e6e9ef";
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

const baht = (n) => `฿${(Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ymd = (d) => (d ? moment(d).format("YYYY-MM-DD") : "");
const siteText = (a) => [a.company, a.site].filter(Boolean).join(" · ") || "ไม่ระบุโครงการ";
const jobText = (a) => [a.title, a.system].filter(Boolean).join(" · ");
const ownerOf = (a) => a.responsiblePerson || a.team || "";
/** วันที่อ้างอิงของใบ (ใช้กรองช่วงเวลา/เรียง) — วันที่ใบเสนอราคา > วันที่ส่ง > วันที่งาน */
const refDateOf = (a) => a.quotationDate || a.quotationSentAt || a.start;
const isExpired = (a) => a.quotationValidUntil && ["sent", "revising"].includes(a.quotationStatus) && moment(a.quotationValidUntil).isBefore(moment(), "day");
const missingInfo = (a) => !a.quotationAmount || !a.quotationNo;
/**
 * ✅ (26 ต.ค. 2569 ผู้ใช้: "การอัพเดตว่าได้งาน และ ไม่ได้งาน ให้ช่างส่งคำขอมา และต้องให้แอดมินอนุมัติก่อนเท่านั้น")
 *    คำขอบันทึกผลที่รอแอดมิน (ผู้มีสิทธิ์ editFinance) อนุมัติ — null = ไม่มี
 */
const reqOf = (a) => (a?.quotationDecisionRequest?.action ? a.quotationDecisionRequest : null);
/**
 * ✅ (10 พ.ย. 2569) ใบเสนอราคาแยก — ป้าย "ใบเสนอราคาแยก" + อ้างอิง (สัญญา/งาน) กดไปดูต้นทางได้
 *    สัญญา → หน้าภาพรวมงาน (ค้นด้วยเลขที่สัญญา) · งาน → หน้างานนั้น
 */
const refHref = (r) => (r?.kind === "contract" ? `/contracts?q=${encodeURIComponent(r.label || "")}${r.contractEnd && moment(r.contractEnd).isBefore(moment(), "day") ? "&view=expired" : ""}`
  : r?.kind === "event" && r.eventId ? `/operation/${r.eventId}` : null);
const QuoteRefLine = ({ a, dense = false }) => {
  const navigate = useNavigate();
  if (!a?.quoteOnly) return null;
  const r = a.quoteRef;
  const href = refHref(r);
  return (
    <Stack direction="row" alignItems="center" gap={0.5} sx={{ flexWrap: "wrap", minWidth: 0 }}>
      <Box component="span" sx={{ display: "inline-flex", alignItems: "center", height: 20, px: 0.75, borderRadius: 99, bgcolor: "#eff6ff", color: "#1d4ed8", fontSize: "0.66rem", fontWeight: 800, whiteSpace: "nowrap" }}>ใบเสนอราคาแยก</Box>
      {r ? (
        <Box component={href ? "button" : "span"} type={href ? "button" : undefined}
          onClick={href ? (e) => { e.stopPropagation(); navigate(href); } : undefined}
          title={href ? "เปิดดูต้นทาง" : undefined}
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.3, minWidth: 0, maxWidth: "100%", border: 0, p: 0, bgcolor: "transparent", font: "inherit", cursor: href ? "pointer" : "default",
            fontSize: dense ? "0.72rem" : "0.76rem", fontWeight: 700, color: href ? "#2563eb" : TEXT_SUB, "&:hover": href ? { textDecoration: "underline" } : {} }}>
          <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>อิง{r.kind === "contract" ? "สัญญา" : "งาน"} {r.label}</Box>
          {href && <ChevronRight sx={{ fontSize: 15 }} />}
        </Box>
      ) : <Typography component="span" sx={{ fontSize: "0.72rem", color: "#94a3b8" }}>ไม่ได้อิงงาน</Typography>}
    </Stack>
  );
};
/**
 * ✅ (10 พ.ย. 2569 ผู้ใช้: "งานที่มีใบเสนอราคา 2 ใบ แต่อนุมัติแค่ใบเดียว ให้กดบันทึกได้งานแยกได้ · ยอดจะไม่ตรงและผิดพลาด")
 *    ใบเสนอราคาในงาน (จาก AI อ่านไฟล์ — เลขที่ + ยอด) · ไม่มีผล AI = แยกจากเลขที่ที่กรอกไว้ (ไม่มียอดรายใบ)
 */
// 🔁 (10 พ.ย. 2569 ผู้ใช้: "ให้อิง และแสดงตามไฟล์ที่แนบ และสามารถกดดูไฟล์ได้ด้วย")
//    รายการอิงไฟล์ใบเสนอราคาที่แนบ (ฉบับปัจจุบัน): AI อ่านแล้ว = 1 ใบต่อใบเสนอราคา + ไฟล์ของใบนั้น · ไฟล์ที่ AI ไม่ได้จับคู่ = การ์ดของไฟล์นั้นเอง
//    ไม่มีผล AI = 1 การ์ดต่อไฟล์ (เลขที่ตามลำดับถ้าจำนวนตรงกัน) · ไม่มีไฟล์เลย = ตามเลขที่ที่กรอกไว้
//    ⚠️ เลขไฟล์ของ AI (เริ่ม 1) นับเฉพาะรูป/PDF ฉบับปัจจุบัน ไม่เกิน 8 ไฟล์ล่าสุด — ตรงกับ server (services/QuotationScan.js)
const quoteListOf = (a) => {
  const cur = (a?.quotationFiles || []).filter((f) => f?.fileUrl && !f.supersededAt);
  const scannable = cur.filter((f) => { const k = fileKindOf(f.fileName, f.fileUrl); return k.isImage || k.key === "pdf"; }).slice(-8);
  const ai = Array.isArray(a?.quotationAiFilled?.quotations) ? a.quotationAiFilled.quotations : [];
  const nos = quoteNos(a);
  const used = new Set();
  const list = [];
  ai.forEach((q, i) => {
    const files = (Array.isArray(q.files) ? q.files : []).map((n) => scannable[n - 1]).filter(Boolean);
    files.forEach((f) => used.add(f));
    const no = String(q.quotationNo || "").trim() || (files[0]?.fileName || `ใบที่ ${i + 1}`);
    list.push({ no, amount: Number(q.grandTotal) > 0 ? Number(q.grandTotal) : null, files });
  });
  const rest = cur.filter((f) => !used.has(f));
  if (!ai.length && rest.length) {
    rest.forEach((f, i) => list.push({ no: nos.length === rest.length ? nos[i] : nos.length === 1 && rest.length === 1 ? nos[0] : f.fileName || `ไฟล์ที่ ${i + 1}`, amount: null, files: [f] }));
  } else if (ai.length) {
    rest.forEach((f) => list.push({ no: f.fileName || "ไฟล์แนบ", amount: null, files: [f] }));
  } else {
    nos.forEach((no) => list.push({ no, amount: null, files: [] }));
  }
  // เลขที่ซ้ำ (เช่น AI อ่านเลขเดียวกันจาก 2 ไฟล์) → รวมการ์ด
  const merged = [];
  list.forEach((q) => {
    const m = merged.find((x) => x.no === q.no);
    if (m) { m.files = [...m.files, ...q.files]; if (m.amount == null) m.amount = q.amount; } else merged.push({ ...q });
  });
  // ใบเดียวที่ยังไม่รู้ยอด = ใช้มูลค่าที่กรอกไว้
  if (merged.length === 1 && merged[0].amount == null && Number(a?.quotationAmount) > 0) merged[0].amount = Number(a.quotationAmount);
  return merged;
};
/** ยอดที่ได้งานจริง — ได้บางใบ = ยอดที่อนุมัติ · ไม่ระบุ = ยอดเต็มใบเสนอราคา */
const wonAmountOf = (a) => (a?.quotationApprovedAmount != null ? Number(a.quotationApprovedAmount) : Number(a?.quotationAmount) || 0);
const REQ_COLOR = "#c2410c";
const reqLabel = (r) => (r?.action === "approve" ? "ได้งาน" : "ไม่ได้งาน");
const ReqPill = ({ r, sx }) => (
  <Box component="span" title={`${r.by || "-"} ขอบันทึกผล “${reqLabel(r)}” — รอแอดมินอนุมัติ`}
    sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, height: 22, px: 0.9, borderRadius: 99, whiteSpace: "nowrap",
      bgcolor: "#fff7ed", color: REQ_COLOR, border: `1px solid ${alpha(REQ_COLOR, 0.35)}`, fontSize: "0.7rem", fontWeight: 800, ...sx }}>
    <HourglassTop sx={{ fontSize: 13 }} />รออนุมัติผล: {reqLabel(r)}
  </Box>
);

/** ป้ายกำหนดติดตาม — เลยกำหนด (แดง) / วันนี้ (ส้ม) / อีก N วัน (เทา) */
const DueChip = ({ info }) => {
  if (!info) return null;
  const d = info.daysUntilDue;
  const [label, color] = d < 0 ? [`เลยกำหนด ${-d} วัน`, "#dc2626"] : d === 0 ? ["ตามวันนี้", "#d97706"] : [`ตามอีก ${d} วัน`, TEXT_SUB];
  return <Typography component="span" sx={{ fontSize: "0.74rem", fontWeight: 700, color, whiteSpace: "nowrap" }}>{label}</Typography>;
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
    // 🔁 (26 ต.ค. 2569 ผู้ใช้: "ส่วนเมนูด้านบนมันใหญ่ไป ลดขนาดให้กระทัดรัด พอดี") ตัวเลขสรุปเตี้ยลง
    px: { xs: 1.25, sm: 1.4 }, py: { xs: 0.9, sm: 0.85 }, borderRadius: 2.5, bgcolor: "#fff",
    border: `1px solid ${active ? "#334155" : BORDER}`, boxShadow: active ? "inset 0 -3px 0 #334155" : "0 1px 2px rgba(15,23,42,.04)",
    transition: "border-color .15s", "&:hover": onClick ? { borderColor: "#94a3b8" } : {},
  }}>
    <Typography noWrap sx={{ fontSize: "0.74rem", color: TEXT_SUB, fontWeight: 700 }}>{label}</Typography>
    <Typography noWrap sx={{ fontWeight: 900, fontSize: { xs: "1.05rem", sm: "1.12rem" }, color: alert ? color : TEXT_MAIN, lineHeight: 1.3 }}>{value}</Typography>
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

/** ป้าย "AI" — ช่องที่ AI อ่านจากไฟล์แล้วเติมให้ (ยังไม่มีคนแก้) ให้รู้ว่าควรตรวจ */
const aiFilled = (a, key) => (a?.quotationAiFilled?.fields || []).includes(key);
/** ✅ (19 ต.ค. 2569 ผู้ใช้: "ให้แสดงเลขที่ให้ครบด้วย") งานหนึ่งมีได้หลายใบ — แยกเลขที่ทุกใบ (ไม่ซ้ำ) แสดงครบทุกเลข */
const quoteNos = (a) => [...new Set(String(a?.quotationNo || "").split(/\s*[,;\n]\s*/).map((x) => x.trim()).filter(Boolean))];
const AiTag = ({ title = "AI อ่านจากไฟล์แล้วเติมให้ — ตรวจแล้วแก้ได้ที่ปุ่มแก้ไข" }) => (
  <Box component="span" title={title} sx={{ ml: 0.5, px: 0.6, height: 16, display: "inline-flex", alignItems: "center", borderRadius: 99, bgcolor: "#f3e8ff", color: "#7c3aed", fontSize: "0.6rem", fontWeight: 900, verticalAlign: "middle", letterSpacing: 0.3 }}>AI</Box>
);

/** ช่องข้อมูล: ป้าย · ค่า (ว่าง = "ยังไม่กรอก" จาง / warn = ส้ม "ยังไม่ระบุ") · คำอธิบายเล็ก */
const Field = ({ label, children, warn, danger, sub, big, ai }) => {
  const empty = children === "" || children == null;
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: "0.68rem", color: TEXT_SUB, fontWeight: 700 }}>{label}{ai && !empty && <AiTag />}</Typography>
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
  // 🔁 (10 พ.ย. 2569 ผู้ใช้: "สีสันหน้านี้ดูเข้มไป ไม่เข้าธีม ไม่แมทกัน") ปุ่มทุกแถวใช้น้ำเงินธีมหลัก — แดงเหลือเฉพาะป้ายเตือน
  follow_up: { label: "บันทึกติดตาม", primary: true },
  sent: { label: "อัปเดตผล", primary: true },
  revising: { label: "แนบฉบับแก้ไข", primary: true },
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
    <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 3, overflowX: "auto", boxShadow: "none" }}>
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
            const req = reqOf(a);
            const act = req ? { label: "ตรวจคำขอ", primary: true, color: REQ_COLOR } : ACTION[job.groupKey] || { label: "เปิด" };
            const actColor = act.color || "#2563eb";
            return (
              <Box component="tr" key={a._id} onClick={() => onOpen(job)}
                sx={{ cursor: "pointer", "&:hover": { bgcolor: "#f8fafc" }, "&:last-child td": { borderBottom: 0 },
                  boxShadow: req ? `inset 3px 0 0 ${REQ_COLOR}` : job.groupKey === "follow_up" ? `inset 3px 0 0 ${alpha(m.color, 0.55)}` : "none" }}>
                <Box component="td" sx={{ ...td, width: 96 }}><DateCell start={a.start} end={a.end} allDay={a.allDay} /></Box>
                <Box component="td" sx={{ ...td, minWidth: 180, maxWidth: 230 }}>
                  {a.quoteOnly ? <QuoteRefLine a={a} dense /> : <JobKindTag event={a} />}
                  <Typography sx={{ mt: 0.5, fontSize: "0.86rem", fontWeight: 800, color: TEXT_MAIN }}>{jobText(a) || "งาน"}</Typography>
                  {a.jobNo && <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8" }}>{a.jobNo}</Typography>}
                </Box>
                <Box component="td" sx={{ ...td, minWidth: 170, maxWidth: 230 }}>
                  <Typography sx={{ fontSize: "0.84rem", fontWeight: 800, color: TEXT_MAIN, overflowWrap: "anywhere" }}>{a.company || a.site || "ไม่ระบุลูกค้า"}</Typography>
                  {a.site && a.site !== a.company && <Typography sx={{ ...sub, overflowWrap: "anywhere" }}>{a.site}</Typography>}
                </Box>
                <Box component="td" sx={{ ...td, minWidth: 150 }}>
                  {quoteNos(a).length ? quoteNos(a).map((no, i) => (
                    <Typography key={no} sx={{ fontSize: "0.82rem", fontWeight: 800, color: TEXT_MAIN, whiteSpace: "nowrap" }}>
                      {no}{i === 0 && aiFilled(a, "quotationNo") && <AiTag />}
                    </Typography>
                  )) : <Typography sx={{ fontSize: "0.82rem", fontWeight: 800, color: "#94a3b8" }}>ไม่มีเลขที่</Typography>}
                  {quoteNos(a).length > 1 && <Typography sx={{ ...sub, color: "#7c3aed", fontWeight: 800 }}>{quoteNos(a).length} ใบ</Typography>}
                  {quoteRevOf(a) > 0 && <Typography sx={{ ...sub, color: "#7c3aed", fontWeight: 800 }}>ฉบับแก้ไข {revLabel(quoteRevOf(a))}</Typography>}
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
                      <Typography sx={{ fontWeight: 900, fontSize: "0.9rem", color: TEXT_MAIN, fontVariantNumeric: "tabular-nums" }}>{aiFilled(a, "quotationAmount") && <AiTag />} {baht(a.quotationAmount)}</Typography>
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
                    bgcolor: alpha(m.color, 0.09), color: m.color, fontSize: "0.76rem", fontWeight: 700 }}>
                    <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: m.color }} />{m.label}
                  </Box>
                  {req && <ReqPill r={req} sx={{ mt: 0.5 }} />}
                </Box>
                <Box component="td" sx={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                  <Stack direction="row" alignItems="center" gap={0.5} justifyContent="flex-end">
                    <Button size="small" onClick={(e) => { e.stopPropagation(); onOpen(job); }}
                      sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, height: 32, px: 1.5, boxShadow: "none",
                        ...(act.primary ? { bgcolor: alpha(actColor, 0.1), color: actColor, "&:hover": { bgcolor: alpha(actColor, 0.18) } } : { color: TEXT_SUB, border: `1px solid ${BORDER}`, "&:hover": { bgcolor: "#f8fafc" } }) }}>
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
  const req = reqOf(a);
  const act = req ? { label: "ตรวจคำขอ", primary: true, color: REQ_COLOR } : ACTION[job.groupKey] || { label: "เปิด" };
  const actColor = act.color || "#2563eb";
  const files = a.quotationFiles || [];
  const info = job.info;
  return (
    <Box onClick={() => onOpen(job)} role="button"
      sx={{ bgcolor: "#fff", border: `1px solid ${BORDER}`, borderLeft: req ? `3px solid ${REQ_COLOR}` : job.groupKey === "follow_up" ? `3px solid ${alpha(m.color, 0.55)}` : `1px solid ${BORDER}`, borderRadius: 3, cursor: "pointer", overflow: "hidden", "&:active": { bgcolor: "#f8fafc" } }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ px: 1.5, py: 1, bgcolor: "#f8fafc", borderBottom: `1px solid ${BORDER}` }}>
        <Box sx={{ flex: 1, minWidth: 0 }}><Owner name={ownerOf(a)} size={24} /></Box>
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, height: 24, px: 1, borderRadius: 99, whiteSpace: "nowrap", flexShrink: 0,
          bgcolor: alpha(m.color, 0.12), color: m.color, border: `1px solid ${alpha(m.color, 0.35)}`, fontSize: "0.72rem", fontWeight: 800 }}>
          <Box component="span" sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: m.color }} />{m.label}
        </Box>
      </Stack>
      {req && <Box sx={{ px: 1.5, pt: 0.9 }}><ReqPill r={req} /></Box>}
      <Box sx={{ px: 1.5, pt: 1.1, pb: 1.25 }}>
        <Stack direction="row" gap={1} alignItems="flex-start">
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {a.quoteOnly ? <QuoteRefLine a={a} dense /> : <JobKindTag event={a} />}
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
          <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.78rem", fontWeight: 700, color: a.quotationNo ? TEXT_MAIN : "#94a3b8", overflowWrap: "anywhere" }}>
            {quoteNos(a).length ? `เลขที่ ${quoteNos(a).join(", ")}${quoteNos(a).length > 1 ? ` (${quoteNos(a).length} ใบ)` : ""}` : "ไม่มีเลขที่"}{quoteRevOf(a) > 0 ? ` · ฉบับแก้ไข ${revLabel(quoteRevOf(a))}` : ""}{a.quotationDate ? ` · ${thaiDate(a.quotationDate)}` : ""}
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
              ...(act.primary ? { bgcolor: alpha(actColor, 0.1), color: actColor, "&:hover": { bgcolor: alpha(actColor, 0.18) } } : { color: TEXT_SUB, border: `1px solid ${BORDER}` }) }}>
            {act.label}
          </Button>
        </Stack>
      </Box>
    </Box>
  );
};

// ─── กล่องยืนยันการตัดสินใจของลูกค้า (อนุมัติ = เลข PO · ปฏิเสธ = เหตุผลบังคับ · ส่ง = วันที่ส่ง) ─────
const DecisionDialog = ({ mode, onClose, onConfirm, busy, resetInfo, asRequest = false, req = null, a = null, onPreview }) => {
  const [date, setDate] = useState(moment().format("YYYY-MM-DD"));
  const [po, setPo] = useState("");
  // ✅ (10 พ.ย. 2569) ได้งานบางใบ + ยอดที่อนุมัติจริง · แนบหลักฐาน (PO / อีเมล / หนังสือตอบรับ) ได้ในกล่องเดียว
  const quotes = useMemo(() => quoteListOf(a), [a]);
  const [picked, setPicked] = useState([]);
  const [amount, setAmount] = useState("");
  // 🔁 (10 พ.ย. 2569 ผู้ใช้: "ยอดที่ลูกค้าอนุมัติ ให้เลือกใบเสนอราคาได้เลย ไม่ต้องพิมพ์เอง ทำได้ง่ายๆ ดูง่าย")
  //    ติ๊กใบที่ได้ = ยอดคำนวณให้เอง · พิมพ์ยอดเองเฉพาะกรณีต่อรองราคา (กด "ระบุยอดเอง")
  const [manual, setManual] = useState(false);
  const [files, setFiles] = useState([]);
  const fileRef = useRef(null);
  const phone = useMediaQuery("(max-width:600px)");
  // ✅ (10 พ.ย. 2569 ผู้ใช้: "ถ้ามียอดอยู่แล้วไม่ต้องให้กรอกอีก ดึงมาได้เลย" · "ให้ AI อ่านต้องติ๊กเลือกไฟล์ก่อน · ไฟล์ที่มีราคาแล้วไม่ต้องอ่านซ้ำ")
  //    AI อ่านเฉพาะไฟล์ของใบที่ติ๊กและยังไม่รู้ยอด (ทีละไฟล์ · ไม่บันทึกทับผลอ่านเดิมของงาน) → ยอดเติมในกล่องนี้ทันที
  const [aiAmt, setAiAmt] = useState({}); // { fileKey: number | null(อ่านไม่ได้) }
  const [scan, setScan] = useState({ busy: false, error: "" });
  const fileKey = (f) => String(f?._id || f?.fileUrl || "");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!mode) return;
    // อนุมัติคำขอ = เติมค่าตามที่ช่างขอมา (แก้ได้ก่อนอนุมัติ)
    const fromReq = mode === "approveRequest" && req;
    setDate(fromReq && req.decidedAt ? moment(req.decidedAt).format("YYYY-MM-DD") : moment().format("YYYY-MM-DD"));
    setPo(fromReq ? req.poNo || "" : "");
    setNote(fromReq ? req.note || "" : "");
    const all = quotes.map((q) => q.no);
    setPicked(fromReq && req.approvedNos?.length ? req.approvedNos.filter((n) => all.includes(n)) : all);
    const reqAmount = fromReq && req.approvedAmount != null ? Number(req.approvedAmount) : null;
    setAmount(reqAmount != null ? String(reqAmount) : "");
    // คำขอระบุยอดที่ไม่ตรงกับผลรวมใบที่เลือก = ยอดต่อรอง → เปิดช่องพิมพ์ให้เห็น
    const sel = fromReq && req.approvedNos?.length ? req.approvedNos : all;
    const sum = quotes.length && quotes.every((q) => q.amount != null) ? quotes.filter((q) => sel.includes(q.no)).reduce((t, q) => t + q.amount, 0) : null;
    setManual(reqAmount != null && (sum == null || Math.abs(sum - reqAmount) > 0.005));
    setFiles([]);
    setScan({ busy: false, error: "" });
    setAiAmt({});
    // ⚠️ ตั้งค่าเริ่มต้นตอนเปิดกล่องเท่านั้น — ข้อมูลงานอัปเดต (เช่น AI อ่านยอดเสร็จ) ต้องไม่ล้างใบที่ผู้ใช้เลือกไว้
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, req]);
  if (!mode) return null;
  const reqIsApprove = req?.action === "approve";
  // ยอดรายใบ: จากใบเสนอราคา/ผลอ่านเดิม · ไม่มี = ผลที่ AI เพิ่งอ่านในกล่องนี้ (ทุกไฟล์ของใบต้องอ่านได้)
  const eq = quotes.map((q) => {
    if (q.amount != null || !q.files.length) return q;
    const vals = q.files.map((f) => aiAmt[fileKey(f)]);
    return vals.every((v) => typeof v === "number") ? { ...q, amount: Math.round(vals.reduce((t, v) => t + v, 0) * 100) / 100, ai: true } : q;
  });
  const multi = eq.length > 1;
  const pickedQ = eq.filter((q) => picked.includes(q.no));
  const pickedKnown = pickedQ.length > 0 && pickedQ.every((q) => q.amount != null);
  const pickedSum = Math.round(pickedQ.reduce((t, q) => t + (q.amount || 0), 0) * 100) / 100;
  const partial = multi && picked.length < eq.length;
  const togglePick = (no) => setPicked((p) => (p.includes(no) ? p.filter((x) => x !== no) : [...p, no]));
  // ✅ (10 พ.ย. 2569 ผู้ใช้: "ให้ตัดเฉพาะใบที่ติ๊กได้งาน ไม่ใช่ตัดรวมทั้งหมด แบบนี้จะติดตามใบที่เหลือไม่ได้")
  //    ใบที่ไม่ได้ติ๊ก → แยกไปเป็นใบเสนอราคาแยก (อิงงานนี้) ติดตามต่อได้ · งานนี้เหลือเฉพาะใบที่ได้งาน + ยอดของใบนั้น
  const restQ = partial ? eq.filter((q) => !picked.includes(q.no)) : [];
  const restAmount = restQ.length && restQ.every((q) => q.amount != null) ? Math.round(restQ.reduce((t, q) => t + q.amount, 0) * 100) / 100 : null;
  const split = restQ.length ? { fileIds: restQ.flatMap((q) => q.files.map((f) => f._id)).filter(Boolean), nos: restQ.map((q) => q.no), amount: restAmount } : null;
  // ยอดอัตโนมัติ: รู้ยอดทุกใบที่ติ๊ก = ผลรวม · ได้ทุกใบ = มูลค่าเต็มที่กรอกไว้ · นอกนั้น = ไม่ทราบ
  const autoAmount = pickedKnown ? pickedSum : !partial && a?.quotationAmount != null ? Number(a.quotationAmount) : null;
  // 🔁 (10 พ.ย. 2569 ผู้ใช้: "ถ้าไม่ทราบยอดต้องบังคับให้กรอกด้วย · เฉพาะตรงบันทึกได้งาน") ไม่ทราบยอด = ต้องกรอกยอดที่ลูกค้าอนุมัติ
  const needManual = autoAmount == null;
  // ใบที่ติ๊กแต่ยังไม่รู้ยอด และมีไฟล์ให้ AI อ่าน (ไฟล์ที่มีราคาแล้วไม่อ่านซ้ำ)
  const scanTargets = pickedQ.filter((q) => q.amount == null && q.files.length).flatMap((q) => q.files).filter((f) => aiAmt[fileKey(f)] === undefined && f._id);
  const runScan = async () => {
    setScan({ busy: true, error: "" });
    let failed = 0;
    for (const f of scanTargets) {
      try {
        // eslint-disable-next-line no-await-in-loop -- อ่านทีละไฟล์
        const r = (await EventService.ScanQuotation(a._id, f._id, false))?.result || {};
        const qs = (r.quotations || []).map((q) => Number(q.grandTotal) || 0).filter((n) => n > 0);
        const amt = qs.length ? qs.reduce((t, n) => t + n, 0) : Number(r.grandTotal) > 0 ? Number(r.grandTotal) : null;
        setAiAmt((m) => ({ ...m, [fileKey(f)]: amt }));
        if (amt == null) failed += 1;
      } catch {
        failed += 1;
        setAiAmt((m) => ({ ...m, [fileKey(f)]: null }));
      }
    }
    setScan({ busy: false, error: failed ? `AI อ่านยอดไม่ได้ ${failed} ไฟล์ — กรอกยอดเองด้านล่าง` : "" });
  };
  const meta = {
    send: { title: "ส่งใบเสนอราคาให้ลูกค้าแล้ว · เริ่มนับติดตาม", color: "#2563eb", btn: "เริ่มนับติดตาม", dateLabel: "วันที่ส่งให้ลูกค้า" },
    resend: { title: "ส่งใบเสนอราคาฉบับแก้ไขให้ลูกค้าแล้ว", color: "#2563eb", btn: "บันทึก · เริ่มนับใหม่", dateLabel: "วันที่ส่งฉบับแก้ไข" },
    approve: { title: "ได้งาน — ลูกค้าตอบรับใบเสนอราคา", color: "#15803d", btn: "บันทึก · ได้งาน", dateLabel: "วันที่ลูกค้าตอบรับ" },
    reject: { title: "ไม่ได้งาน — ลูกค้าไม่รับใบเสนอราคา", color: "#b91c1c", btn: "บันทึก · ไม่ได้งาน", dateLabel: "วันที่ลูกค้าแจ้ง" },
    // ✅ (19 ต.ค. 2569 ผู้ใช้: "ปุ่มแก้ผลให้มีคอนเฟิร์มก่อน กันกดพลาด และมีคำอธิบายชัดเจน")
    reset: { title: "แก้ผลใบเสนอราคา?", color: "#b45309", btn: "ยืนยัน · แก้ผล", noDate: true },
    approveRequest: {
      title: `อนุมัติผล “${reqLabel(req)}” ตามคำขอ`, color: reqIsApprove ? "#15803d" : "#b91c1c", btn: `อนุมัติ · ${reqLabel(req)}`,
      dateLabel: reqIsApprove ? "วันที่ลูกค้าตอบรับ" : "วันที่ลูกค้าแจ้ง",
    },
    rejectRequest: { title: "ไม่อนุมัติคำขอบันทึกผล", color: REQ_COLOR, btn: "ไม่อนุมัติ · ส่งกลับ", noDate: true },
  }[mode];
  // ✅ คนที่ไม่ใช่แอดมิน: ได้งาน/ไม่ได้งาน = ส่งคำขอ (สถานะยังไม่เปลี่ยนจนกว่าแอดมินอนุมัติ)
  const requesting = asRequest && (mode === "approve" || mode === "reject");
  const title = requesting ? `ส่งคำขอ: ${meta.title}` : meta.title;
  const btn = requesting ? "ส่งคำขอ · รอแอดมินอนุมัติ" : meta.btn;
  const poMode = mode === "approve" || (mode === "approveRequest" && reqIsApprove);
  const noteMode = mode === "approve" || mode === "reject" || mode === "approveRequest" || mode === "rejectRequest";
  const noteRequired = mode === "reject" || mode === "rejectRequest" || (mode === "approveRequest" && !reqIsApprove);
  const useManual = manual || (poMode && needManual);
  const amountNum = amount === "" ? null : Number(amount);
  const amountBad = useManual && amountNum !== null && (!Number.isFinite(amountNum) || amountNum < 0);
  const finalAmount = useManual ? amountNum : autoAmount;
  const invalid = (noteRequired && !note.trim()) || (poMode && quotes.length > 0 && picked.length === 0) || (poMode && amountBad) || (poMode && needManual && (amountNum === null || amountBad));
  const evidenceMode = mode === "approve" || mode === "reject" || mode === "approveRequest";
  // 🔁 (10 พ.ย. 2569 ผู้ใช้: "แนบไฟล์ และเลขที่ PO ควรอยู่ใกล้กัน ไม่ให้งง") หลักฐานจากลูกค้าอยู่กล่องเดียว: เลขที่ PO + ไฟล์
  const evidence = (
            <Box sx={{ p: 1.25, borderRadius: 2, border: `1px solid ${BORDER}`, bgcolor: "#fff" }}>
              <input ref={fileRef} type="file" hidden multiple accept="image/*,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={(e) => { const fl = Array.from(e.target.files || []); e.target.value = ""; if (fl.length) setFiles((x) => [...x, ...fl].slice(0, 10)); }} />
              <Typography sx={{ display: "flex", alignItems: "center", gap: 0.6, fontSize: "0.84rem", fontWeight: 800, color: TEXT_MAIN }}>
                <AttachFile sx={{ fontSize: 18, color: "#2563eb" }} />
                {poMode ? "หลักฐานการสั่งซื้อจากลูกค้า" : "หลักฐานจากลูกค้า"} <Box component="span" sx={{ fontWeight: 600, color: TEXT_SUB }}>· ไม่บังคับ</Box>
              </Typography>
              <Typography sx={{ fontSize: "0.72rem", color: TEXT_SUB, mb: 1 }}>{poMode ? "เลขที่ PO และไฟล์ PO / หนังสือตอบรับ / อีเมลยืนยัน" : "อีเมล / หนังสือแจ้งไม่รับ"}</Typography>
              {poMode && (
                <TextField size="small" fullWidth label="เลขที่ PO / ใบสั่งซื้อของลูกค้า" value={po} onChange={(e) => setPo(e.target.value)} inputProps={{ maxLength: 60 }} sx={{ mb: 1 }} />
              )}
              {files.length > 0 && (
                <Box sx={{ mb: 0.75, px: 1.25, border: `1px solid ${BORDER}`, borderRadius: 2 }}>
                  {files.map((f, i) => (
                    <Stack key={`${f.name}-${i}`} direction="row" alignItems="center" gap={1.25} sx={{ py: 0.75, borderTop: i ? "1px solid #f1f5f9" : 0, minWidth: 0 }}>
                      <FileKindThumb name={f.name} size={34} />
                      <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.82rem", fontWeight: 700, color: TEXT_MAIN }}>{f.name}</Typography>
                      <IconButton size="small" aria-label="เอาไฟล์ออก" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} sx={{ color: "#94a3b8" }}><Close sx={{ fontSize: 17 }} /></IconButton>
                    </Stack>
                  ))}
                </Box>
              )}
              <Button size="small" fullWidth startIcon={<AttachFile sx={{ fontSize: 16 }} />} onClick={() => fileRef.current?.click()} disabled={busy}
                sx={{ height: 40, textTransform: "none", fontWeight: 800, borderRadius: 2, border: "1px dashed #93c5fd", color: "#2563eb", bgcolor: "#f8fbff", "&:hover": { bgcolor: "#eff6ff" } }}>
                {files.length ? "แนบไฟล์เพิ่ม" : "แนบไฟล์หลักฐาน"}
              </Button>
            </Box>
  );
  const noteLabel = mode === "rejectRequest" ? "เหตุผลที่ไม่อนุมัติ * (ส่งกลับให้ผู้ขอ)"
    : (mode === "reject" || (mode === "approveRequest" && !reqIsApprove)) ? "เหตุผลที่ไม่ได้งาน *" : "หมายเหตุ (ถ้ามี)";
  return (
    // 🔁 (26 ต.ค. 2569 ผู้ใช้: "หน้าอื่นๆด้วยที่มีขนาดเล็กไป") กว้างขึ้น (sm) — วันที่กับเลข PO อยู่แถวเดียวกัน
    // 🔁 (10 พ.ย. 2569 ผู้ใช้: "ขยายออกอีก และไม่ให้เลยขอบ จัดวางให้สมบูรณ์") กว้างขึ้น (720) · ชื่อไฟล์ยาวตัดคำ ไม่ล้นแนวนอน · มือถือเต็มจอ ปุ่มติดล่าง
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="md" fullScreen={phone}
      PaperProps={{ sx: { borderRadius: phone ? 0 : 3, maxWidth: phone ? "100%" : 720 } }}>
      <DialogTitle sx={{ display: "flex", alignItems: "flex-start", gap: 1, fontWeight: 900, fontSize: "1.05rem", color: meta.color, pb: 1, pr: 1.5, borderBottom: phone ? `1px solid ${BORDER}` : 0 }}>
        <Box component="span" sx={{ flex: 1, minWidth: 0, pt: 0.5 }}>{title}</Box>
        <IconButton size="small" aria-label="ปิด" onClick={onClose} disabled={busy} sx={{ flexShrink: 0, color: TEXT_SUB }}><Close fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ overflowX: "hidden", pt: "14px !important" }}>
        {/* 🐛 (10 พ.ย. 2569 ผู้ใช้: "สระหาย") เว้นบนให้ป้ายลอยของช่องวันที่ (สระบน ที่/ตอบ) ไม่ถูกตัด */}
        <Stack spacing={1.5} sx={{ pt: 1.25 }}>
          {requesting && (
            <Alert severity="info" icon={<HourglassTop />} sx={{ borderRadius: 2, "& .MuiAlert-message": { fontSize: "0.82rem" } }}>
              ผลจะยังไม่เปลี่ยนจนกว่าแอดมิน (ฝ่ายบริหาร/การเงิน) อนุมัติ — ระบบแจ้งเตือนแอดมินให้ทันที
            </Alert>
          )}
          {(mode === "approveRequest" || mode === "rejectRequest") && req && (
            <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: "#fff7ed", border: `1px solid ${alpha(REQ_COLOR, 0.3)}` }}>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 800, color: REQ_COLOR }}>
                {req.by || "-"} ขอบันทึกผล “{reqLabel(req)}”{req.at ? ` · ${formatThai(req.at, "D MMM HH:mm")}` : ""}
              </Typography>
              <Typography sx={{ fontSize: "0.8rem", color: "#475569", mt: 0.25 }}>
                {[req.decidedAt ? `ลูกค้าตอบ ${thaiDate(req.decidedAt)}` : "", req.poNo ? `PO ${req.poNo}` : "", req.note].filter(Boolean).join(" · ") || "ไม่มีรายละเอียดเพิ่ม"}
              </Typography>
            </Box>
          )}
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
          {!meta.noDate && (
            <Box sx={{ maxWidth: { sm: 320 } }}>
              <ThaiDatePicker label={meta.dateLabel} value={date} onChange={(v) => setDate(v || moment().format("YYYY-MM-DD"))} />
            </Box>
          )}
          {poMode && (
            <Box>
              <Typography sx={{ display: "flex", alignItems: "center", gap: 0.6, fontSize: "0.84rem", fontWeight: 800, color: TEXT_MAIN, mb: 0.75 }}>
                <RequestQuote sx={{ fontSize: 18, color: "#2563eb" }} />
                {quotes.length ? "ลูกค้าอนุมัติใบไหน?" : "ยอดที่ลูกค้าอนุมัติ"}
                {multi && <Box component="span" sx={{ fontWeight: 600, color: TEXT_SUB }}> · แตะเพื่อเลือก ({picked.length}/{quotes.length} ใบ)</Box>}
              </Typography>
              {quotes.length > 0 && (
                // 🐛 (10 พ.ย. 2569 ผู้ใช้: "จอมือถือ จัดวางให้ดี") ชื่อไฟล์ยาวดันการ์ดล้นจอ — คอลัมน์ minmax(0,1fr) ให้ตัด "…" แทน
                <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 0.75 }}>
                  {eq.map((q) => {
                    const on = picked.includes(q.no);
                    return (
                      <Box key={q.no} role="checkbox" tabIndex={0} aria-checked={on} onClick={() => togglePick(q.no)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); togglePick(q.no); } }}
                        sx={{ display: "flex", alignItems: "center", gap: 1.25, width: "100%", textAlign: "left", font: "inherit", cursor: "pointer", boxSizing: "border-box",
                          px: 1.25, py: 1, borderRadius: 2, transition: "all .15s",
                          border: `1.5px solid ${on ? "#16a34a" : BORDER}`, bgcolor: on ? "#f0fdf4" : "#fff", "&:hover": { borderColor: on ? "#16a34a" : "#94a3b8" } }}>
                        {on
                          ? <CheckCircle sx={{ fontSize: 24, color: "#16a34a", flexShrink: 0 }} />
                          : <Box sx={{ width: 20, height: 20, m: "2px", borderRadius: "50%", flexShrink: 0, border: "2px solid #cbd5e1" }} />}
                        {q.files.length > 0 && (
                          <Stack direction="row" gap={0.5} sx={{ flexShrink: 0 }}>
                            {q.files.slice(0, 2).map((f, fi) => (
                              <Box key={fi} role="button" tabIndex={0} title={`ดูไฟล์ ${f.fileName || ""}`}
                                onClick={(e) => { e.stopPropagation(); onPreview?.(f.fileUrl, f.fileName); }}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onPreview?.(f.fileUrl, f.fileName); } }}
                                sx={{ borderRadius: 1.5, cursor: "zoom-in", "&:hover": { boxShadow: "0 0 0 2px #93c5fd" } }}>
                                <FileKindThumb name={f.fileName} url={f.fileUrl} size={40} />
                              </Box>
                            ))}
                          </Stack>
                        )}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography noWrap sx={{ fontSize: "0.88rem", fontWeight: 800, color: on ? TEXT_MAIN : TEXT_SUB }}>{q.no}</Typography>
                          {q.files.length > 0 && (
                            <Typography noWrap sx={{ fontSize: "0.72rem", color: TEXT_SUB }}>
                              {q.files[0].fileName !== q.no ? q.files[0].fileName : "แตะรูปเพื่อดูไฟล์"}{q.files.length > 1 ? ` +${q.files.length - 1} ไฟล์` : ""}
                            </Typography>
                          )}
                        </Box>
                        <Typography sx={{ fontSize: "0.9rem", fontWeight: q.amount != null ? 900 : 700, color: on ? (q.amount != null ? TEXT_MAIN : "#b45309") : "#94a3b8", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                          {q.ai && <AiTag title="AI อ่านยอดจากไฟล์ — ตรวจก่อนบันทึก" />} {q.amount != null ? baht(q.amount) : q.files.some((f) => aiAmt[fileKey(f)] === null) ? "อ่านยอดไม่ได้" : "ไม่ทราบยอด"}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              )}
              {(scanTargets.length > 0 || scan.busy || scan.error) && (
                <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 0.75, flexWrap: "wrap" }}>
                  <Typography sx={{ fontSize: "0.74rem", color: scan.error ? "#b45309" : TEXT_SUB }}>
                    {scan.busy ? `AI กำลังอ่านยอด ${scanTargets.length || ""} ไฟล์…` : scan.error || "ใบที่เลือกยังไม่รู้ยอด"}
                  </Typography>
                  {!scan.busy && scanTargets.length > 0 && (
                    <Button size="small" onClick={runScan} sx={{ textTransform: "none", fontWeight: 800, color: "#7c3aed", py: 0, minHeight: 0 }}>
                      ✦ ให้ AI อ่านยอดใบที่เลือก ({scanTargets.length} ไฟล์)
                    </Button>
                  )}
                </Stack>
              )}
              {quotes.length > 0 && picked.length === 0 && <Typography sx={{ mt: 0.5, fontSize: "0.76rem", color: "#b91c1c", fontWeight: 700 }}>เลือกอย่างน้อย 1 ใบ — ถ้าลูกค้าไม่รับทุกใบ ให้กด “ไม่ได้งาน”</Typography>}
              {split && (
                <Stack direction="row" gap={1} alignItems="flex-start" sx={{ mt: 1, px: 1.25, py: 1, borderRadius: 2, bgcolor: "#eff6ff", border: "1px solid #bfdbfe" }}>
                  <Autorenew sx={{ fontSize: 18, color: "#2563eb", mt: 0.1, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: "0.78rem", color: "#1e3a8a", lineHeight: 1.5 }}>
                    <b>ได้งาน {picked.length} ใบ</b> · อีก {restQ.length} ใบ ({restQ.map((q) => q.no).join(", ")}{restAmount != null ? ` · ${baht(restAmount)}` : ""}) <b>แยกไปติดตามต่อ</b> เป็นใบเสนอราคาแยกที่อิงงานนี้ — ไม่ปิดทิ้ง ประวัติการติดตามติดไปด้วย
                  </Typography>
                </Stack>
              )}
              {/* สรุปยอดได้งาน (คำนวณให้) · พิมพ์เองเฉพาะต่อรองราคา */}
              {!useManual && (
                <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 1, px: 1.25, py: 1, borderRadius: 2, bgcolor: "#f8fafc", border: `1px solid ${BORDER}` }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.72rem", color: TEXT_SUB, fontWeight: 700 }}>ยอดได้งาน{partial ? ` · ${picked.length} จาก ${quotes.length} ใบ` : ""}</Typography>
                    <Typography sx={{ fontSize: "1.1rem", fontWeight: 900, color: autoAmount != null ? "#15803d" : "#94a3b8", fontVariantNumeric: "tabular-nums" }}>
                      {autoAmount != null ? baht(autoAmount) : "ไม่ทราบยอด"}
                    </Typography>
                  </Box>
                  <Button size="small" onClick={() => { setManual(true); setAmount(autoAmount != null ? String(autoAmount) : ""); }}
                    sx={{ flexShrink: 0, textTransform: "none", fontWeight: 800, color: "#2563eb" }}>ระบุยอดเอง</Button>
                </Stack>
              )}
              {useManual && (
                <Box sx={{ mt: 1 }}>
                  <TextField size="small" fullWidth autoFocus={manual} label="ยอดที่ลูกค้าอนุมัติ (บาท)" type="number" value={amount}
                    onChange={(e) => setAmount(e.target.value)} error={amountBad || (needManual && amountNum === null)} inputProps={{ min: 0, step: "any" }}
                    helperText={needManual ? `ไม่ทราบยอด — กรอกยอดที่ลูกค้าอนุมัติ *${a?.quotationAmount != null ? ` (มูลค่ารวมทุกใบ ${baht(a.quotationAmount)})` : ""}` : `ต่อรองราคา / ยอดไม่ตรงใบเสนอราคา${autoAmount != null ? ` · ยอดตามใบที่เลือก ${baht(autoAmount)}` : ""}`} />
                  {manual && !needManual && (
                    <Button size="small" onClick={() => { setManual(false); setAmount(""); }} sx={{ mt: 0.25, textTransform: "none", fontWeight: 700, color: TEXT_SUB }}>ใช้ยอดตามใบที่เลือก</Button>
                  )}
                </Box>
              )}
            </Box>
          )}
          {evidenceMode && poMode && evidence}
          {noteMode && (
            <TextField size="small" multiline minRows={3} label={noteLabel} value={note}
              onChange={(e) => setNote(e.target.value)} error={invalid && note !== ""} inputProps={{ maxLength: 500 }}
              placeholder={mode === "rejectRequest" ? "เช่น ยังไม่มี PO ยืนยัน / ลูกค้ายังไม่ได้ตอบจริง" : noteRequired ? "เช่น ราคาสูงกว่าเจ้าอื่น / เลื่อนโครงการ / ใช้ผู้รับเหมาเดิม" : ""} />
          )}
          {evidenceMode && !poMode && evidence}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 1.5, borderTop: `1px solid ${BORDER}`, pb: phone ? "calc(12px + env(safe-area-inset-bottom))" : 1.5, "& > button": { flex: phone ? 1 : "0 0 auto", minHeight: 44 } }}>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: "none", color: TEXT_SUB }}>ยกเลิก</Button>
        <Button variant="contained" disabled={busy || invalid}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : poMode || mode === "approve" ? <CheckCircle /> : mode === "reject" ? <Cancel /> : null}
          onClick={() => onConfirm({
          date, po: po.trim(), note: note.trim(), files,
          // ส่งเฉพาะตอนได้งาน: เลือกไม่ครบทุกใบ = ระบุใบ · ยอดต่างจากยอดเต็ม/ได้บางใบ = ระบุยอด
          ...(poMode ? {
            approvedNos: partial ? picked : [],
            approvedAmount: finalAmount !== null && (partial || finalAmount !== Number(a?.quotationAmount)) ? finalAmount : null,
            split,
          } : {}),
        })}
          sx={{ textTransform: "none", fontWeight: 800, boxShadow: "none", bgcolor: meta.color, "&:hover": { bgcolor: meta.color, filter: "brightness(.92)" } }}>
          {busy ? "กำลังบันทึก..." : btn}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * ✅ (26 ต.ค. 2569 ผู้ใช้: "ให้สามารถกดแก้ไขใบเสนอราคาแล้วเริ่มติดตามใหม่ บางทีเสนอราคาไปแล้วลูกค้ามีให้แก้ไขรายละเอียด
 *    เลยจำเป็นต้องออกใบเสนอราคาใบใหม่ ที่นี้จะงงว่าเอกสารเดิมที่ส่งไปแล้วมันไม่สามารถแก้ไขได้")
 *    ออกฉบับแก้ไข: ระบุสิ่งที่ลูกค้าขอแก้ + แนบไฟล์ฉบับใหม่ → ฉบับเดิมถูกเก็บเป็นประวัติ (🔒 ดูได้ ลบไม่ได้)
 *    → เริ่มนับติดตามใหม่ทันที · AI อ่านเลขที่/มูลค่าจากฉบับใหม่ · แจ้งผู้เกี่ยวข้อง
 */
const ReviseDialog = ({ a, open, onClose, onConfirm }) => {
  const [reason, setReason] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef();
  useEffect(() => { if (open) { setReason(""); setFiles([]); setBusy(false); } }, [open]);
  if (!open) return null;
  const rev = quoteRevOf(a);
  const ok = reason.trim() && files.length > 0 && !busy;
  const submit = async () => {
    if (!ok) return;
    setBusy(true);
    const done = await onConfirm({ reason: reason.trim(), files });
    setBusy(false);
    if (done) onClose();
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 900, fontSize: "1.05rem", color: "#7c3aed", pb: 0.5 }}>
        ออกใบเสนอราคาฉบับแก้ไข {revLabel(rev + 1)}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: "#f5f3ff", border: "1px solid #ddd6fe" }}>
            <Typography component="ul" sx={{ m: 0, pl: 2.25, fontSize: "0.8rem", color: "#4c1d95", lineHeight: 1.65 }}>
              <li>ฉบับเดิม <b>{revLabel(rev)}{a.quotationNo ? ` · ${a.quotationNo}` : ""}</b> ที่ส่งลูกค้าไปแล้ว เก็บเป็นประวัติ — ดู/ดาวน์โหลดได้ <b>แก้/ลบไม่ได้</b></li>
              <li>แนบไฟล์ฉบับใหม่แล้ว ระบบ<b>เริ่มนับติดตามใหม่</b>ทันที (นับครั้งที่ติดตามใหม่ของฉบับนี้)</li>
              <li>AI อ่านเลขที่ · วันที่ · มูลค่า จากฉบับใหม่ให้เอง (ตรวจ/แก้ได้ภายหลัง) · แจ้งผู้เกี่ยวข้องอัตโนมัติ</li>
            </Typography>
          </Box>
          <TextField size="small" multiline minRows={3} label="ลูกค้าขอแก้อะไร *" value={reason} onChange={(e) => setReason(e.target.value)}
            inputProps={{ maxLength: 300 }} placeholder="เช่น ขอส่วนลดเพิ่ม 5% / ตัดรายการปั๊มสำรองออก / เปลี่ยนรุ่นอุปกรณ์" />
          <Box>
            <input ref={inputRef} type="file" hidden multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              onChange={(e) => { const list = Array.from(e.target.files || []); if (list.length) setFiles(list); e.target.value = ""; }} />
            <Button variant="outlined" startIcon={<AttachFile />} onClick={() => inputRef.current?.click()} disabled={busy}
              sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, borderStyle: files.length ? "solid" : "dashed", color: "#7c3aed", borderColor: "#c4b5fd" }}>
              {files.length ? "เปลี่ยนไฟล์ฉบับใหม่" : "แนบไฟล์ใบเสนอราคาฉบับใหม่ *"}
            </Button>
            {files.map((f) => (
              <Typography key={f.name} noWrap sx={{ mt: 0.5, fontSize: "0.8rem", fontWeight: 700, color: "#334155" }}>📄 {f.name}</Typography>
            ))}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: "none", color: TEXT_SUB }}>ยกเลิก</Button>
        <Button variant="contained" disabled={!ok} onClick={submit} startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <Autorenew />}
          sx={{ textTransform: "none", fontWeight: 800, boxShadow: "none", bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8", boxShadow: "none" } }}>
          {busy ? "กำลังบันทึก..." : `ออกฉบับ ${revLabel(rev + 1)} · เริ่มนับใหม่`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/** ประวัติฉบับเดิมของใบเสนอราคา (ใหม่ → เก่า) */
const RevisionHistory = ({ a, onPreview }) => {
  const list = (a.quotationRevisions || []).slice().reverse();
  if (!list.length) return null;
  const ST = { sent: "ส่งแล้ว รอลูกค้าตอบ", approved: "ได้งาน", rejected: "ไม่ได้งาน" };
  return (
    <Section title={`ฉบับเดิมที่ส่งลูกค้าแล้ว · ${list.length} ฉบับ`} icon={<History />}>
      <Stack spacing={1}>
        {list.map((r) => (
          <Box key={r.rev} sx={{ p: 1.25, borderRadius: 2, border: `1px solid ${BORDER}`, bgcolor: "#fcfdfe" }}>
            <Stack direction="row" alignItems="center" gap={0.75} sx={{ flexWrap: "wrap" }}>
              <Box component="span" sx={{ px: 0.9, height: 22, display: "inline-flex", alignItems: "center", borderRadius: 99, bgcolor: "#f1f5f9", color: "#334155", fontSize: "0.72rem", fontWeight: 900 }}>
                🔒 {revLabel(r.rev)}
              </Box>
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 800, color: TEXT_MAIN }}>
                {[r.quotationNo, r.amount ? baht(r.amount) : ""].filter(Boolean).join(" · ") || "ไม่มีเลขที่"}
              </Typography>
              <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>
                {[r.sentAt ? `ส่ง ${thaiDate(r.sentAt)}` : "", ST[r.status] || "", r.followUps ? `ติดตาม ${r.followUps} ครั้ง` : ""].filter(Boolean).join(" · ")}
              </Typography>
            </Stack>
            <Typography sx={{ fontSize: "0.8rem", color: "#475569", mt: 0.5 }}>
              ลูกค้าขอแก้: {r.reason || "-"} <Box component="span" sx={{ color: TEXT_SUB }}>— {r.by || "-"}{r.at ? ` · ${formatThai(moment(r.at).locale("th"), "D MMM YY HH:mm")}` : ""}</Box>
            </Typography>
            {(r.files || []).length > 0 && (
              <Stack direction="row" gap={0.5} sx={{ mt: 0.75, flexWrap: "wrap" }}>
                {r.files.map((f) => (
                  <Box key={f.fileUrl} component="button" type="button" onClick={() => onPreview(f.fileUrl, f.fileName)}
                    sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, height: 24, px: 0.9, maxWidth: 260, border: 0, borderRadius: 99, cursor: "pointer", font: "inherit",
                      bgcolor: "#f1f5f9", color: "#334155", fontSize: "0.72rem", fontWeight: 700 }}>
                    <AttachFile sx={{ fontSize: 14 }} />
                    <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.fileName}</Box>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        ))}
      </Stack>
    </Section>
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
              <Field label="เลขที่" warn={!a.quotationNo} ai={aiFilled(a, "quotationNo")}>{a.quotationNo}</Field>
              <Field label="มูลค่า" ai={aiFilled(a, "quotationAmount")} warn={!a.quotationAmount} sub={a.quotationAmount ? (a.quotationVatIncluded ? "รวม VAT แล้ว" : "ก่อน VAT") : ""} big>
                {a.quotationAmount ? baht(a.quotationAmount) : ""}
              </Field>
              <Field label="วันที่ใบเสนอราคา" ai={aiFilled(a, "quotationDate")}>{a.quotationDate ? thaiDate(a.quotationDate) : ""}</Field>
              <Field label="ยืนราคาถึง" ai={aiFilled(a, "quotationValidUntil")} danger={isExpired(a)} sub={isExpired(a) ? "หมดอายุแล้ว" : ""}>{a.quotationValidUntil ? thaiDate(a.quotationValidUntil) : ""}</Field>
            </Box>
          </Box>
          <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: "#f8fafc", border: `1px solid ${BORDER}` }}>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, color: TEXT_SUB, mb: 0.75, letterSpacing: 0.2 }}>ผู้ติดต่อลูกค้า (คนรับใบเสนอราคา)</Typography>
            <Field label="ชื่อ" ai={aiFilled(a, "quotationContact")}>{contact.name || a.contactName}</Field>
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
                sx={{ textTransform: "none", fontWeight: 700, boxShadow: "none", borderRadius: 2, bgcolor: "#fff7ed", color: "#c2410c", backgroundImage: "none", border: "1px solid #fed7aa", "&:hover": { bgcolor: "#ffedd5", boxShadow: "none" } }}>กรอกให้ครบ</Button>
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
const FollowUpSection = ({ a, onSubmit, onPreview, canFollow, formRef }) => {
  const followUps = a.quotationFollowUps || [];
  const rev = quoteRevOf(a);
  const curCount = currentFollowUps(a).length;
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
  const nextNo = curCount + 1;
  return (
    <Section title={`การติดตามลูกค้า${curCount ? ` · ติดตามแล้ว ${curCount} ครั้ง` : ""}${rev ? ` (${revLabel(rev)})` : ""}`} icon={<EventRepeat />}>
      {/* 🔁 (19 ต.ค. 2569 ผู้ใช้: "ดูแล้วไม่สวย ดูรก และตรงแนบไฟล์สังเกตยาก")
          กล่องเขียนแบบเดียว (composer): หัว = ครั้งที่ + ช่องทาง · กลาง = ข้อความ · ล่าง = แนบหลักฐาน (ปุ่มชัด) · นัดครั้งถัดไป · บันทึก */}
      {canWrite && (
        <Box ref={formRef} sx={{ mb: followUps.length ? 2 : 0, borderRadius: 2.5, border: `1px solid ${BORDER}`, bgcolor: "#fff", overflow: "hidden",
          "&:focus-within": { borderColor: "#93c5fd", boxShadow: "0 0 0 3px rgba(37,99,235,.10)" } }}>
          <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} gap={1} sx={{ px: 1.5, pt: 1.25, pb: 0.75 }}>
            <Typography sx={{ flex: 1, fontSize: "0.88rem", fontWeight: 800, color: TEXT_MAIN }}>
              ติดตามครั้งที่ {nextNo}{rev ? ` · ${revLabel(rev)}` : ""} <Box component="span" sx={{ fontWeight: 600, color: TEXT_SUB, fontSize: "0.78rem" }}>· ติดต่อทาง</Box>
            </Typography>
            <Stack direction="row" sx={{ p: 0.4, borderRadius: 2, bgcolor: "#f1f5f9", gap: 0.4, flexWrap: "wrap" }}>
              {CHANNELS.map((c) => {
                const on = channel === c.value;
                return (
                  <Box key={c.value} component="button" type="button" onClick={() => setChannel(c.value)}
                    sx={{ height: 28, px: 1.25, border: 0, borderRadius: 1.5, cursor: "pointer", font: "inherit", fontSize: "0.78rem", fontWeight: on ? 800 : 600,
                      bgcolor: on ? "#fff" : "transparent", color: on ? "#1d4ed8" : "#475569", boxShadow: on ? "0 1px 2px rgba(15,23,42,.12)" : "none" }}>
                    {c.label}
                  </Box>
                );
              })}
            </Stack>
          </Stack>
          <TextField multiline minRows={4} maxRows={14} fullWidth placeholder="ลูกค้าว่าอย่างไร เช่น รอเข้าที่ประชุมสิ้นเดือน / ขอส่วนลดเพิ่ม 5% / ให้โทรกลับวันศุกร์"
            value={note} onChange={(e) => setNote(e.target.value)}
            sx={{ px: 0.5, "& .MuiOutlinedInput-root": { fontSize: "0.92rem", lineHeight: 1.6, alignItems: "flex-start", "& fieldset": { border: 0 } } }} />
          {file && (
            <Stack direction="row" alignItems="center" gap={0.5} sx={{ mx: 1.5, mb: 1, px: 1, py: 0.5, width: "fit-content", maxWidth: "calc(100% - 24px)", borderRadius: 2, bgcolor: "#eff6ff", color: "#1d4ed8" }}>
              <AttachFile sx={{ fontSize: 16 }} />
              <Typography noWrap sx={{ fontSize: "0.78rem", fontWeight: 700, minWidth: 0 }}>{file.name}</Typography>
              <IconButton size="small" onClick={() => setFile(null)} sx={{ p: 0.25, color: "#1d4ed8" }}><Close sx={{ fontSize: 15 }} /></IconButton>
            </Stack>
          )}
          <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} gap={1} sx={{ px: 1.5, py: 1.1, bgcolor: "#f8fafc", borderTop: `1px solid ${BORDER}` }}>
            <input ref={inputRef} type="file" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <Button variant="outlined" startIcon={<AttachFile />} onClick={() => inputRef.current?.click()}
              sx={{ height: 38, textTransform: "none", fontWeight: 800, borderRadius: 2, color: "#334155", borderColor: "#cbd5e1", bgcolor: "#fff", flexShrink: 0, "&:hover": { borderColor: "#2563eb", color: "#2563eb", bgcolor: "#fff" } }}>
              {file ? "เปลี่ยนไฟล์หลักฐาน" : "แนบหลักฐาน"}
            </Button>
            <Box sx={{ width: { xs: "100%", sm: 230 }, flexShrink: 0 }} title={`ไม่ระบุ = ระบบเตือนให้ติดตามอีก ${WARNING_DAYS_AFTER_SENT} วัน`}>
              <ThaiDatePicker label="นัดครั้งถัดไป (ถ้ามี)" value={next} onChange={(v) => setNext(v || "")} />
            </Box>
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" disabled={!note.trim() || busy} startIcon={<Save sx={{ fontSize: 18 }} />} onClick={submit}
              sx={{ height: 40, px: 2.5, textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: "#2563eb", flexShrink: 0, "&:hover": { bgcolor: "#1d4ed8", boxShadow: "none" } }}>
              {busy ? "กำลังบันทึก..." : "บันทึกการติดตาม"}
            </Button>
          </Stack>
        </Box>
      )}

      {followUps.length > 0 ? (
        <Box>
          <Typography sx={{ fontSize: "0.76rem", fontWeight: 800, color: TEXT_SUB, mb: 1 }}>ประวัติการติดตาม (ล่าสุดอยู่บน)</Typography>
          <Stack spacing={1}>
            {followUps.slice().reverse().map((x, i) => (
              <Box key={x._id || i} sx={{ p: 1.25, borderRadius: 2, border: `1px solid ${BORDER}`, bgcolor: i === 0 ? "#fff" : "#fcfdfe", boxShadow: i === 0 ? "inset 3px 0 0 #2563eb" : "none" }}>
                <Stack direction="row" alignItems="center" gap={0.75} sx={{ flexWrap: "wrap" }}>
                  <Box component="span" sx={{ px: 0.9, height: 22, display: "inline-flex", alignItems: "center", borderRadius: 99, bgcolor: i === 0 ? "#2563eb" : "#e6e9ef", color: i === 0 ? "#fff" : "#334155", fontSize: "0.72rem", fontWeight: 900 }}>
                    ครั้งที่ {x.attemptNumber}
                  </Box>
                  {rev > 0 && (
                    <Box component="span" sx={{ px: 0.75, height: 22, display: "inline-flex", alignItems: "center", borderRadius: 99, fontSize: "0.68rem", fontWeight: 800,
                      color: (Number(x.revision) || 0) === rev ? "#7c3aed" : TEXT_SUB, bgcolor: (Number(x.revision) || 0) === rev ? "#f5f3ff" : "#f1f5f9" }}>
                      {(Number(x.revision) || 0) === rev ? "" : "ฉบับเดิม "}{revLabel(x.revision)}
                    </Box>
                  )}
                  {x.channel && <Chip size="small" label={channelLabel(x.channel)} sx={{ height: 22, fontSize: "0.7rem", fontWeight: 800, bgcolor: "#f1f5f9" }} />}
                  <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>{formatThai(moment(x.contactedAt).locale("th"), "D MMM YY · HH:mm")} น. · {x.userName}</Typography>
                </Stack>
                {x.note && <Typography sx={{ fontSize: "0.88rem", color: "#1e293b", whiteSpace: "pre-wrap", mt: 0.6, lineHeight: 1.6 }}>{x.note}</Typography>}
                {x.evidenceFileUrl && (
                  // 🔁 (10 พ.ย. 2569 ผู้ใช้: "หลักฐานให้แสดงรูปแบบไฟล์ด้วย ให้สวยงาม") ภาพย่อ/ป้ายชนิดไฟล์ + ชื่อไฟล์ · กดดู
                  <Box component="button" type="button" onClick={() => onPreview(x.evidenceFileUrl, x.evidenceFileName)}
                    sx={{ mt: 0.75, display: "flex", alignItems: "center", gap: 1, maxWidth: "100%", p: 0.6, pr: 1.25, border: `1px solid ${BORDER}`, borderRadius: 2, cursor: "pointer", font: "inherit",
                      bgcolor: "#fff", textAlign: "left", "&:hover": { borderColor: "#93c5fd", bgcolor: "#f8fbff" } }}>
                    <FileKindThumb name={x.evidenceFileName} url={x.evidenceFileUrl} size={36} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: "0.8rem", fontWeight: 700, color: TEXT_MAIN }}>{x.evidenceFileName || "หลักฐาน"}</Typography>
                      <Typography sx={{ fontSize: "0.7rem", color: "#2563eb", fontWeight: 700 }}>หลักฐานการติดตาม · แตะเพื่อดู</Typography>
                    </Box>
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
/** เอกสารผลลัพธ์ (PO / หนังสือตอบรับ / อีเมลแจ้งไม่รับ) — แถวชิปไฟล์ + ปุ่มแนบ (กะทัดรัด) */
const ResultDocs = ({ a, k, onUpload, onDelete, onPreview, uploading, progress }) => {
  const ref = useRef();
  const files = a.quotationResultFiles || [];
  return (
    <Box sx={{ mt: 1.25 }}>
      <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, color: TEXT_SUB, mb: 0.5 }}>
        เอกสารผลลัพธ์ <Box component="span" sx={{ fontWeight: 600, color: "#94a3b8" }}>· {k === "approved" ? "PO / หนังสือตอบรับ" : "อีเมล / หนังสือแจ้งไม่รับ"} (ถ้ามี)</Box>
      </Typography>
      {/* 🔁 (10 พ.ย. 2569 ผู้ใช้: "Module การจัดการไฟล์และรูปภาพ รูปแบบเดียวกันทั้งแอพ") — แถวไฟล์ชุดกลาง */}
      {(files.length > 0 || uploading) && (
        <Box sx={{ mb: 0.75, px: 1.25, py: 0.25, border: `1px solid ${BORDER}`, borderRadius: 2, bgcolor: "#fff" }}>
          <AttachmentList files={files} emptyText={null}
            onOpen={(f) => onPreview(f.fileUrl, f.fileName)}
            onDelete={async (f) => { await onDelete(a._id, "quotationResult", f._id); }}
            uploading={uploading ? { progress: progress || 0 } : null} />
        </Box>
      )}
      <Stack direction="row" gap={0.75} alignItems="center" sx={{ flexWrap: "wrap" }}>
        <input ref={ref} type="file" hidden multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => { const fl = e.target.files; if (fl?.length) onUpload(fl, a._id, "quotationResult"); e.target.value = ""; }} />
        <Button size="small" startIcon={<AttachFile sx={{ fontSize: 15 }} />} onClick={() => ref.current?.click()} disabled={uploading}
          sx={{ height: 30, px: 1.25, textTransform: "none", fontWeight: 800, borderRadius: 99, border: "1px dashed #94a3b8", color: "#334155", whiteSpace: "nowrap", flexShrink: 0 }}>
          {uploading ? `กำลังอัปโหลด ${progress || 0}%` : files.length ? "แนบเพิ่ม" : "แนบเอกสาร"}
        </Button>
      </Stack>
    </Box>
  );
};

/**
 * ✅ (19 ต.ค. 2569 ผู้ใช้: "อยากให้วิเคราะห์ข้อมูลในภาพหรือไฟล์อัตโนมัติเลยว่าราคารวมเท่าไรที่แนบ")
 * 🔁 (19 ต.ค. 2569 ผู้ใช้: "ราคาไม่ตรงมั่ว · เลขที่ด้วย · ให้ดูว่ามีกี่ใบกี่ไฟล์ด้วย ให้สมบูรณ์")
 *    AI อ่าน "ทุกไฟล์" ของงานพร้อมกัน → สรุป "ใบเสนอราคา N ใบ จาก M ไฟล์" รายใบ: เลขที่ · วันที่ · ยอดรวม · อยู่ไฟล์ไหน
 *    เซิร์ฟเวอร์เติมให้เอง (ช่องว่าง/ช่องที่ AI เติมไว้) — ยอดที่ไม่เห็นครบหรือบวกไม่ตรงจะไม่เติม แล้วบอกเหตุผลไว้
 * ⚠️ ฟีเจอร์ปิดเองถ้าเซิร์ฟเวอร์ไม่มี ANTHROPIC_API_KEY (ไม่มีกล่องนี้ ไม่ error)
 */
let scanAvailability = null; // แคชทั้งแอป — ถามเซิร์ฟเวอร์ครั้งเดียว
const isScannable = (f) => /^image\//.test(f?.fileType || "") || /pdf/i.test(f?.fileType || "") || /\.(png|jpe?g|webp|gif|pdf)$/i.test(f?.fileName || "");
const QuoteScanBox = ({ a }) => {
  const files = (a.quotationFiles || []).filter(isScannable);
  const info = a.quotationAiFilled || {};
  const quotes = Array.isArray(info.quotations) ? info.quotations : [];
  const [enabled, setEnabled] = useState(scanAvailability);
  const [state, setState] = useState({ status: "idle", count: null, error: "" });
  const [showNote, setShowNote] = useState(false);
  useEffect(() => {
    if (scanAvailability !== null) return;
    EventService.BillingScanAvailability().then((r) => { scanAvailability = Boolean(r?.enabled); setEnabled(scanAvailability); }).catch(() => { scanAvailability = false; setEnabled(false); });
  }, []);
  const run = useCallback(async () => {
    setState({ status: "filling", count: files.length, error: "" });
    try {
      await EventService.ScanQuotation(a._id, null, true);
      setState({ status: "idle", count: files.length, error: "" }); // ผลมาทาง realtime (หน้าโหลดใหม่เอง)
    } catch (err) {
      setState({ status: "error", count: files.length, error: err?.response?.data?.message || "อ่านไฟล์ไม่สำเร็จ" });
    }
  }, [a._id, files.length]);
  // ข้อมูลยังไม่ครบ + ยังไม่เคยอ่านไฟล์ชุดนี้ → อ่านเองอัตโนมัติ (ไฟล์ที่แนบใหม่ เซิร์ฟเวอร์อ่านเองหลังอัปโหลดอยู่แล้ว)
  useEffect(() => {
    if (!enabled || !files.length || !missingInfo(a)) return;
    if (state.count === files.length || info.fileCount === files.length) return;
    run();
  }, [enabled, files.length, a, info.fileCount, state.count, run]);
  // AI เคยเติมด้วยรุ่นเก่า (อ่านแค่ไฟล์ล่าสุด · ไม่มีสรุปรายใบ) → อ่านทุกไฟล์ใหม่หนึ่งครั้ง ให้เลขที่/ยอดครบทุกใบ
  useEffect(() => {
    if (!enabled || !files.length || !info.at || Array.isArray(info.quotations) || state.count !== null) return;
    if (!(info.fields || []).length || missingInfo(a)) return; // ข้อมูลไม่ครบ = effect ด้านบนอ่านให้แล้ว
    run();
  }, [enabled, files.length, a, info.at, info.quotations, info.fields, state.count, run]);

  if (!enabled || !files.length) return null;
  const box = { mt: 1.25, p: 1.5, borderRadius: 2.5, border: "1px solid #ddd6fe", bgcolor: "#faf5ff" };
  if (state.status === "filling") {
    return (
      <Stack direction="row" alignItems="center" gap={1} sx={box}>
        <CircularProgress size={16} sx={{ color: "#7c3aed" }} />
        <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: "#6d28d9" }}>AI กำลังอ่านไฟล์ใบเสนอราคาทั้ง {files.length} ไฟล์ — แยกว่ามีกี่ใบ แล้วเติมเลขที่ · ยอดรวม · วันที่ · ผู้ติดต่อ…</Typography>
      </Stack>
    );
  }
  if (state.status === "error") {
    return (
      <Stack direction="row" alignItems="center" gap={1} sx={{ ...box, bgcolor: "#fff7ed", borderColor: "#fed7aa" }}>
        <Typography sx={{ flex: 1, fontSize: "0.82rem", color: "#9a3412" }}>{state.error} · กรอกเองได้ที่ปุ่ม “กรอกให้ครบ”</Typography>
        <Button size="small" onClick={run} sx={{ textTransform: "none", fontWeight: 800 }}>ลองใหม่</Button>
      </Stack>
    );
  }
  if (!info.at) {
    return (
      <Button size="small" onClick={run} sx={{ mt: 0.75, textTransform: "none", fontWeight: 800, color: "#7c3aed" }}>
        ✦ ให้ AI อ่านไฟล์ทั้ง {files.length} ไฟล์ แล้วเติมข้อมูลให้
      </Button>
    );
  }
  const stale = info.fileCount && info.fileCount !== files.length;
  const sum = quotes.reduce((s, q) => s + (Number(q.grandTotal) || 0), 0);
  const allTotals = quotes.length > 0 && quotes.every((q) => Number(q.grandTotal) > 0);
  const warn = Boolean(info.note) || (info.confidence && info.confidence !== "high") || quotes.some((q) => q.issues?.length);
  // 🔁 (10 พ.ย. 2569 ผู้ใช้: "ตรง AI ไม่ต้องให้ความยาวแบบนี้ ให้กระชับ ไม่กินพื้นที่ และเข้าใจง่าย")
  //    หัวบรรทัดเดียว (จำนวนใบ · ยอดรวม · อ่านใหม่) → แถวละใบ (เลขที่ · ยอด) → จุดที่ควรตรวจพับไว้ ("ควรตรวจ ▾" กดดูรายละเอียด)
  return (
    <Box sx={{ ...box, p: 1.25 }}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.82rem", fontWeight: 800, color: "#6d28d9" }}>
          ✦ AI อ่าน {quotes.length ? `${quotes.length} ใบ` : "ไม่พบใบเสนอราคา"}{quotes.length > 1 && allTotals ? <Box component="span" sx={{ color: TEXT_MAIN }}> · รวม {baht(sum)}</Box> : ""}
        </Typography>
        <Button size="small" onClick={run} sx={{ textTransform: "none", fontWeight: 800, color: "#7c3aed", minWidth: 0, py: 0 }}>อ่านใหม่</Button>
      </Stack>
      {quotes.length > 0 && (
        <Box sx={{ mt: 0.75, borderRadius: 2, border: "1px solid #ede9fe", bgcolor: "#fff", overflow: "hidden" }}>
          {quotes.map((q, i) => (
            <Stack key={`${q.quotationNo}-${i}`} direction="row" alignItems="center" gap={1} sx={{ px: 1.1, py: 0.65, borderTop: i ? "1px solid #f5f3ff" : 0, minWidth: 0 }}>
              <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.82rem", fontWeight: 700, color: q.quotationNo ? TEXT_MAIN : "#94a3b8" }}>
                {q.quotationNo || "อ่านเลขที่ไม่ได้"}
                {q.quotationDate && <Box component="span" sx={{ fontWeight: 500, color: TEXT_SUB, fontSize: "0.72rem" }}> · {thaiDate(q.quotationDate)}</Box>}
              </Typography>
              {Number(q.grandTotal) > 0
                ? <Typography sx={{ flexShrink: 0, fontSize: "0.86rem", fontWeight: 800, color: TEXT_MAIN, fontVariantNumeric: "tabular-nums" }}>{baht(q.grandTotal)}</Typography>
                : <Typography sx={{ flexShrink: 0, fontSize: "0.74rem", fontWeight: 700, color: "#b45309" }}>ไม่ทราบยอด</Typography>}
            </Stack>
          ))}
        </Box>
      )}
      {(warn || stale) && (
        <Box sx={{ mt: 0.6 }}>
          <Box component="button" type="button" onClick={() => setShowNote((v) => !v)}
            sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, p: 0, border: 0, bgcolor: "transparent", font: "inherit", cursor: "pointer", fontSize: "0.74rem", fontWeight: 700, color: "#b45309" }}>
            ⚠ {stale ? `ไฟล์เปลี่ยน (ตอนนี้ ${files.length} ไฟล์) — กด "อ่านใหม่"` : "มีจุดที่ควรตรวจ"} {!stale && (showNote ? "▴" : "▾")}
          </Box>
          {showNote && !stale && (
            <Typography sx={{ mt: 0.4, fontSize: "0.72rem", color: "#92400e", lineHeight: 1.5 }}>
              {[...quotes.filter((q) => q.issues?.length).map((q) => `${q.quotationNo || "ใบ"}: ${q.issues.join(" · ")}`), info.note].filter(Boolean).join(" — ")}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};

/** แก้/เติมรายละเอียดผลลัพธ์ภายหลัง — วันที่ลูกค้าตอบ · เลข PO (ได้งาน) · หมายเหตุ/เหตุผล (เปิดจากปุ่มมุมขวาบน) */
const ResultDetails = ({ a, k, onSave, open, onClose, isFinance = false }) => {
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({});
  // ✅ (10 พ.ย. 2569) ฝ่ายบริหาร/การเงินแก้ "ยอดที่ลูกค้าอนุมัติ" ภายหลังได้ (ได้งานบางใบ/ต่อรองราคา) · ว่าง = ยอดเต็มใบเสนอราคา
  useEffect(() => { if (open) setF({ date: ymd(a.quotationDecisionAt), po: a.quotationPoNo || "", note: a.quotationDecisionNote || "", amount: a.quotationApprovedAmount != null ? String(a.quotationApprovedAmount) : "" }); }, [open, a.quotationDecisionAt, a.quotationPoNo, a.quotationDecisionNote, a.quotationApprovedAmount]);
  const amountBad = f.amount !== "" && f.amount != null && (!Number.isFinite(Number(f.amount)) || Number(f.amount) < 0);
  const setOpen = (v) => { if (!v) onClose(); };
  const invalid = (k === "rejected" && !String(f.note || "").trim()) || amountBad;
  const save = async () => {
    setBusy(true);
    const amountChanged = isFinance && k === "approved" && String(f.amount ?? "") !== (a.quotationApprovedAmount != null ? String(a.quotationApprovedAmount) : "");
    const ok = await onSave({
      quotationDecisionAt: f.date || "", quotationDecisionNote: f.note,
      ...(k === "approved" ? { quotationPoNo: f.po } : {}),
      ...(amountChanged ? { quotationApprovedAmount: f.amount === "" ? null : Number(f.amount) } : {}),
    });
    setBusy(false);
    if (ok) setOpen(false);
  };
  if (!open) return null;
  return (
    <Box sx={{ mt: 1.25, p: 1.25, borderRadius: 2, bgcolor: "#f8fafc", border: `1px solid ${BORDER}` }}>
      <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", sm: k === "approved" ? "1fr 1fr" : "1fr" } }}>
        <ThaiDatePicker label="วันที่ลูกค้าตอบ" value={f.date} onChange={(v) => setF((x) => ({ ...x, date: v || "" }))} />
        {k === "approved" && <TextField size="small" label="เลขที่ PO / ใบสั่งซื้อของลูกค้า" value={f.po} onChange={(e) => setF((x) => ({ ...x, po: e.target.value }))} inputProps={{ maxLength: 60 }} />}
        {k === "approved" && isFinance && (
          <TextField size="small" type="number" label="ยอดที่ลูกค้าอนุมัติ (บาท)" value={f.amount ?? ""} error={amountBad}
            onChange={(e) => setF((x) => ({ ...x, amount: e.target.value }))} inputProps={{ min: 0, step: "any" }}
            helperText={a.quotationAmount != null ? `เว้นว่าง = ยอดเต็ม ${baht(a.quotationAmount)}` : "เว้นว่าง = ยอดเต็มใบเสนอราคา"} />
        )}
      </Box>
      <TextField size="small" fullWidth multiline minRows={2} sx={{ mt: 1.25 }} label={k === "rejected" ? "เหตุผลที่ไม่ได้งาน *" : "หมายเหตุ (ถ้ามี)"}
        value={f.note} onChange={(e) => setF((x) => ({ ...x, note: e.target.value }))} error={invalid} inputProps={{ maxLength: 500 }} />
      <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 1.25 }}>
        <Button onClick={() => setOpen(false)} disabled={busy} sx={{ textTransform: "none", color: TEXT_SUB }}>ยกเลิก</Button>
        <Button variant="contained" startIcon={<Save />} disabled={busy || invalid} onClick={save}
          sx={{ textTransform: "none", fontWeight: 800, boxShadow: "none", borderRadius: 2, bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8", boxShadow: "none" } }}>
          {busy ? "กำลังบันทึก..." : "บันทึกรายละเอียดผล"}
        </Button>
      </Stack>
    </Box>
  );
};

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
  job, currentUser, onClose, onQuotation, onFollowUp, onComment, onFileUpload, onDeleteFile, onPreview, upload, onRevise, onEditQuote, onCancelQuote,
}) => {
  const fullScreen = useMediaQuery("(max-width:600px)");
  const navigate = useNavigate();
  const [decision, setDecision] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [editResult, setEditResult] = useState(false);
  const [revising, setRevising] = useState(false);
  const followRef = useRef(null);
  const filesRef = useRef(null);
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

  const req = reqOf(a);
  const isRequester = req && String(req.byId) === String(currentUser?.userId || currentUser?._id || "");
  const confirmDecision = async ({ date, po, note, files = [], approvedNos = [], approvedAmount = null, split = null }) => {
    setBusy(true);
    const action = decision === "resend" || decision === "send" ? "send" : decision;
    const isApprove = action === "approve" || (action === "approveRequest" && req?.action === "approve");
    const body = action === "reset" ? { action }
      : action === "rejectRequest" ? { action, reason: note }
      : { action, ...(action === "send" ? { sentAt: date } : { decidedAt: date, poNo: po, decisionNote: note, ...(isApprove ? { approvedNos, approvedAmount, ...(split ? { split } : {}) } : {}) }) };
    const ok = await onQuotation(job, body);
    // ✅ (10 พ.ย. 2569) หลักฐานผลลัพธ์ (PO / อีเมล) — อัปโหลดหลังบันทึกผลสำเร็จ เข้าช่อง "เอกสารผลลัพธ์"
    if (ok && files.length) await onFileUpload(files, a._id, "quotationResult");
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
    if (k === "revising") {
      // ✅ (26 ต.ค. 2569) ออกฉบับแก้ไขแล้ว แต่ยังไม่ได้แนบไฟล์ฉบับใหม่ (เช่นอัปโหลดไม่สำเร็จ)
      return {
        title: `แนบใบเสนอราคาฉบับแก้ไข ${revLabel(quoteRevOf(a))}`,
        tone: "#7c3aed",
        text: "แนบไฟล์ฉบับใหม่ในกล่องใบเสนอราคาด้านล่าง — แนบแล้วระบบเริ่มนับติดตามใหม่ให้ทันที (ฉบับเดิมเก็บเป็นประวัติแล้ว)",
        primary: { label: "ไปที่กล่องใบเสนอราคา", icon: <AttachFile />, onClick: () => filesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }) },
      };
    }
    if (open) {
      return {
        title: due,
        tone: k === "follow_up" ? "#dc2626" : null,
        text: k === "follow_up"
          ? "ถึงเวลาโทร/ทักลูกค้าแล้ว — บันทึกผลทุกครั้งที่ติดต่อ ระบบจะนับรอบถัดไปให้"
          : isFinance
            ? "รอลูกค้าตัดสินใจ — ติดต่อแล้วบันทึกผลไว้ เมื่อลูกค้าตอบ กด “ได้งาน” หรือ “ไม่ได้งาน”"
            : "รอลูกค้าตัดสินใจ — ติดต่อแล้วบันทึกผลไว้ เมื่อลูกค้าตอบ กดส่งคำขอ “ได้งาน/ไม่ได้งาน” ให้แอดมินอนุมัติ",
        stats: true,
        decide: !req,
        primary: { label: "บันทึกการติดตาม", icon: <EventRepeat />, onClick: goFollow },
      };
    }
    return null;
  })();

  return (
    <Dialog open onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="md" PaperProps={{ sx: { borderRadius: fullScreen ? 0 : 3, bgcolor: "#f8fafc" } }}>
      {/* ── หัว: ลูกค้า/โครงการ · งาน · มูลค่า ── */}
      <Box sx={{ px: { xs: 1.75, sm: 2.5 }, pt: 1.75, pb: 1.5, bgcolor: "#fff", borderBottom: `1px solid ${BORDER}` }}>
        <Stack direction="row" spacing={1.25} alignItems="flex-start">
          <Box sx={{ width: 42, height: 42, borderRadius: 2.5, flexShrink: 0, display: "grid", placeItems: "center", bgcolor: "#eff6ff", color: "#2563eb" }}>
            <RequestQuote />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, color: TEXT_SUB, letterSpacing: 0.2 }}>ใบเสนอราคา{a.quotationNo ? ` · ${a.quotationNo}` : ""}{quoteRevOf(a) ? ` · ${revLabel(quoteRevOf(a))}` : ""}</Typography>
            <Typography sx={{ fontWeight: 900, fontSize: "1.05rem", color: TEXT_MAIN, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {siteText(a)}
            </Typography>
            <Typography noWrap sx={{ fontSize: "0.76rem", color: TEXT_SUB }}>
              {a.quoteOnly
                ? [jobText(a), `เพิ่มเมื่อ ${thaiDate(a.createdAt || a.start)}`, ownerOf(a) ? `ผู้รับผิดชอบ ${ownerOf(a)}` : ""].filter(Boolean).join(" · ")
                : [jobText(a), a.time ? `ครั้งที่ ${formatRoundLabel(a.time, a.visitCount, a)}` : "", formatEventDateRange(a), ownerOf(a) ? `ผู้รับผิดชอบ ${ownerOf(a)}` : ""].filter(Boolean).join(" · ")}
            </Typography>
            {a.quoteOnly && (
              <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 0.5, flexWrap: "wrap" }}>
                <QuoteRefLine a={a} />
                {onEditQuote && (
                  <Button size="small" startIcon={<Edit sx={{ fontSize: 15 }} />} onClick={() => onEditQuote(a)}
                    sx={{ textTransform: "none", fontWeight: 800, py: 0, minHeight: 0, fontSize: "0.74rem", color: "#2563eb" }}>แก้ไข / เปลี่ยนการอ้างอิง</Button>
                )}
                {onCancelQuote && k !== "approved" && (
                  <Button size="small" onClick={() => onCancelQuote(a)}
                    sx={{ textTransform: "none", fontWeight: 700, py: 0, minHeight: 0, fontSize: "0.74rem", color: TEXT_SUB }}>ยกเลิกใบนี้</Button>
                )}
              </Stack>
            )}
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
            // 🔁 (10 พ.ย. 2569) ขั้นปัจจุบันใช้น้ำเงินธีมหลัก (เดิมสีสถานะ = แดงทั้งแถบ ดูเข้ม) · สีผลลัพธ์เฉพาะขั้นสุดท้าย
            const color = final ? m.color : done ? "#16a34a" : cur ? "#2563eb" : "#cbd5e1";
            const FinalIcon = k === "approved" ? CheckCircle : Cancel;
            const lineColor = i <= step ? (i < step || final ? "#16a34a" : color) : "#e6e9ef";
            return (
              <Box key={s.key} sx={{ position: "relative", textAlign: "center", px: 0.5 }}>
                {/* เส้นเชื่อมอยู่ "ใต้" วงกลม (zIndex 0) และเริ่ม-จบที่ขอบวง ไม่ลากทับตัวเลข */}
                {i > 0 && <Box sx={{ position: "absolute", top: 13, right: "calc(50% + 18px)", left: "calc(-50% + 18px)", height: 2, borderRadius: 1, bgcolor: lineColor, zIndex: 0 }} />}
                <Box sx={{ position: "relative", zIndex: 1, mx: "auto", width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center",
                  fontSize: "0.78rem", fontWeight: 900, color: done || cur || final ? "#fff" : "#94a3b8", bgcolor: done || cur || final ? color : "#fff",
                  border: `2px solid ${color}`, boxShadow: cur ? `0 0 0 4px ${alpha(color, 0.18)}` : "none" }}>
                  {final ? <FinalIcon sx={{ fontSize: 18 }} /> : done ? <Check sx={{ fontSize: 17 }} /> : i + 1}
                </Box>
                {/* 🔁 (10 พ.ย. 2569 ผู้ใช้: "หน้ามือถือให้จัดวางให้ดูง่าย") มือถือ: ชื่อขั้นตัดบรรทัดได้ ไม่ถูกตัด "…" */}
                <Typography sx={{ mt: 0.5, fontSize: { xs: "0.66rem", sm: "0.78rem" }, lineHeight: 1.25, whiteSpace: { xs: "normal", sm: "nowrap" }, overflow: "hidden", textOverflow: "ellipsis", fontWeight: cur || final ? 900 : 700, color: cur || final ? color : done ? TEXT_MAIN : "#94a3b8" }}>
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
            // 🔁 (10 พ.ย. 2569 ผู้ใช้: "สีดูเข้มไป ไม่เข้าธีม") กล่องขาวขอบเทา · แถบซ้ายน้ำเงิน · เลยกำหนด = ป้ายแดงเล็ก (ไม่ระบายทั้งกล่อง)
            <Box sx={{ p: { xs: 1.5, sm: 1.75 }, borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${BORDER}`, boxShadow: `inset 4px 0 0 ${next.tone && next.tone !== "#dc2626" ? next.tone : "#2563eb"}` }}>
              <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, color: TEXT_SUB, letterSpacing: 0.3 }}>ขั้นตอนถัดไป</Typography>
              <Stack direction="row" alignItems="center" gap={0.75} sx={{ mt: 0.15, flexWrap: "wrap" }}>
                {next.tone === "#dc2626" && (
                  <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, height: 22, px: 0.9, borderRadius: 99, bgcolor: "#fef2f2", color: "#b91c1c", fontSize: "0.72rem", fontWeight: 800 }}>
                    <WarningAmber sx={{ fontSize: 14 }} />ต้องติดตาม
                  </Box>
                )}
                <Typography sx={{ fontSize: "1rem", fontWeight: 900, color: next.tone && next.tone !== "#dc2626" ? next.tone : TEXT_MAIN }}>{next.title}</Typography>
              </Stack>
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
                <Box sx={{ display: "grid", gap: 1, mt: 1.5, gridTemplateColumns: { xs: next.decide ? "1fr 1fr" : "1fr", sm: next.decide ? "1.2fr 1fr 1fr" : "auto" }, justifyContent: "start",
                  "& > .MuiButton-contained": { gridColumn: { xs: next.decide ? "1 / -1" : "auto", sm: "auto" } } }}>
                  {next.primary && (
                    <Button variant="contained" startIcon={next.primary.icon} onClick={next.primary.onClick}
                      sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", height: 42, px: 2.5, bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8", boxShadow: "none" } }}>
                      {next.primary.label}
                    </Button>
                  )}
                  {next.decide && (
                    <>
                      {/* ปุ่มรองโทนเทา · สีเฉพาะไอคอน — ไม่แย่งสายตาปุ่มหลัก */}
                      <Button variant="outlined" startIcon={<CheckCircle sx={{ color: "#16a34a" }} />} onClick={() => setDecision("approve")}
                        sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, height: 42, color: TEXT_MAIN, borderColor: BORDER, bgcolor: "#fff", "&:hover": { borderColor: "#16a34a", bgcolor: "#f0fdf4" } }}>{isFinance ? "ได้งาน" : "ขอบันทึก ได้งาน"}</Button>
                      <Button variant="outlined" startIcon={<Cancel sx={{ color: "#dc2626" }} />} onClick={() => setDecision("reject")}
                        sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, height: 42, color: TEXT_MAIN, borderColor: BORDER, bgcolor: "#fff", "&:hover": { borderColor: "#dc2626", bgcolor: "#fef2f2" } }}>{isFinance ? "ไม่ได้งาน" : "ขอบันทึก ไม่ได้งาน"}</Button>
                    </>
                  )}
                </Box>
              )}
            </Box>
          )}

          {/* ── คำขอบันทึกผลที่รอแอดมินอนุมัติ ── */}
          {req && (
            <Box sx={{ p: { xs: 1.5, sm: 1.75 }, borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${alpha(REQ_COLOR, 0.4)}`, boxShadow: `inset 4px 0 0 ${REQ_COLOR}` }}>
              <Stack direction="row" spacing={1.25} alignItems="flex-start">
                <HourglassTop sx={{ color: REQ_COLOR, fontSize: 26, mt: 0.25 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, color: TEXT_SUB, letterSpacing: 0.3 }}>รอแอดมินอนุมัติผล</Typography>
                  <Typography sx={{ fontSize: "1rem", fontWeight: 900, color: REQ_COLOR }}>
                    {req.by || "-"} ขอบันทึกผล “{reqLabel(req)}”
                  </Typography>
                  <Box sx={{ display: "grid", gap: 0.75, mt: 1, gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, minmax(0, 1fr))" } }}>
                    <MiniStat label="ส่งคำขอเมื่อ" value={req.at ? formatThai(req.at, "D MMM YY HH:mm") : ""} />
                    <MiniStat label="วันที่ลูกค้าตอบ" value={req.decidedAt ? thaiDate(req.decidedAt) : ""} />
                    {req.action === "approve" && <MiniStat label="เลขที่ PO ลูกค้า" value={req.poNo} />}
                  </Box>
                  {req.note && <Typography sx={{ fontSize: "0.84rem", color: "#334155", mt: 1 }}>{req.action === "reject" ? "เหตุผล: " : "หมายเหตุ: "}{req.note}</Typography>}
                  {!isFinance && (
                    <Typography sx={{ fontSize: "0.78rem", color: TEXT_SUB, mt: 1 }}>ผลจะเปลี่ยนเมื่อแอดมิน (ฝ่ายบริหาร/การเงิน) อนุมัติ — ระหว่างนี้ยังติดตามลูกค้าต่อได้ตามปกติ</Typography>
                  )}
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1.5 }}>
                    {isFinance && (
                      <>
                        <Button variant="contained" startIcon={<Check />} onClick={() => setDecision("approveRequest")} disabled={busy}
                          sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", height: 40, px: 2,
                            bgcolor: req.action === "approve" ? "#15803d" : "#b91c1c", "&:hover": { bgcolor: req.action === "approve" ? "#166534" : "#991b1b", boxShadow: "none" } }}>
                          อนุมัติ · {reqLabel(req)}
                        </Button>
                        <Button variant="outlined" startIcon={<Undo />} onClick={() => setDecision("rejectRequest")} disabled={busy}
                          sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, height: 40, color: REQ_COLOR, borderColor: alpha(REQ_COLOR, 0.45) }}>
                          ไม่อนุมัติ
                        </Button>
                      </>
                    )}
                    {(isRequester || isFinance) && (
                      <Button onClick={async () => { setBusy(true); await onQuotation(job, { action: "cancelRequest" }); setBusy(false); }} disabled={busy}
                        sx={{ textTransform: "none", fontWeight: 700, color: TEXT_SUB }}>ยกเลิกคำขอ</Button>
                    )}
                  </Stack>
                </Box>
              </Stack>
            </Box>
          )}

          {/* ── ผลลัพธ์ (ได้งาน / ไม่ได้งาน) ── */}
          {["approved", "rejected"].includes(k) && (
            <Box sx={{ p: { xs: 1.5, sm: 1.75 }, borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${alpha(k === "approved" ? "#16a34a" : "#dc2626", 0.35)}`, boxShadow: `inset 4px 0 0 ${k === "approved" ? "#16a34a" : "#dc2626"}` }}>
              <Stack direction="row" spacing={1.25} alignItems="flex-start">
                {k === "approved" ? <CheckCircle sx={{ color: "#16a34a", fontSize: 28 }} /> : <Cancel sx={{ color: "#dc2626", fontSize: 28 }} />}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {/* 🔁 (26 ต.ค. 2569 ผู้ใช้: "หน้ามันเพี้ยนๆ") ปุ่มแก้อยู่บรรทัดหัวข้อ — เดิมอยู่คอลัมน์ขวา บีบเนื้อหาบนมือถือจนตัวหนังสือแตกเป็นคำๆ */}
                  <Stack direction="row" alignItems="center" gap={0.25}>
                    <Typography sx={{ flex: 1, fontSize: "0.68rem", fontWeight: 800, color: TEXT_SUB, letterSpacing: 0.3 }}>ผลลัพธ์</Typography>
                    {!editResult && (
                      <Button size="small" startIcon={<Edit sx={{ fontSize: 16 }} />} onClick={() => setEditResult(true)}
                        sx={{ textTransform: "none", fontWeight: 800, py: 0.25, minHeight: 0, color: k === "approved" && !a.quotationPoNo ? "#b45309" : "#2563eb" }}>
                        {k === "approved" && !a.quotationPoNo ? "เติมเลข PO" : "แก้รายละเอียด"}
                      </Button>
                    )}
                    {isFinance && (
                      <Button size="small" startIcon={<Undo sx={{ fontSize: 16 }} />} onClick={() => setDecision("reset")} disabled={busy}
                        sx={{ textTransform: "none", fontWeight: 700, py: 0.25, minHeight: 0, color: TEXT_SUB }}>แก้ผล</Button>
                    )}
                  </Stack>
                  <Typography sx={{ fontSize: "1rem", fontWeight: 900, color: k === "approved" ? "#15803d" : "#b91c1c" }}>
                    {k === "approved" ? "ได้งาน — ลูกค้าตอบรับใบเสนอราคา" : "ไม่ได้งาน — ลูกค้าไม่รับใบเสนอราคา"}
                  </Typography>
                  <Box sx={{ display: "grid", gap: 0.75, mt: 1, gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, minmax(0, 1fr))" } }}>
                    <MiniStat label="วันที่ลูกค้าตอบ" value={a.quotationDecisionAt ? thaiDate(a.quotationDecisionAt) : ""} />
                    {k === "approved" && <MiniStat label="เลขที่ PO ลูกค้า" value={a.quotationPoNo} />}
                    {k === "approved" && a.quotationApprovedAmount != null && <MiniStat label="ยอดที่อนุมัติ" value={baht(a.quotationApprovedAmount)} />}
                    <MiniStat label="บันทึกโดย" value={a.quotationDecisionBy} />
                  </Box>
                  {/* ✅ (10 พ.ย. 2569) ได้งานบางใบ → ใบที่เหลือแยกไปติดตามต่อ · กดไปที่ใบนั้น */}
                  {k === "approved" && a.quotationSplitTo && (
                    <Box component="button" type="button" onClick={() => navigate(`/finance?tab=quotations&jobId=${a.quotationSplitTo}`)}
                      sx={{ mt: 1, display: "flex", alignItems: "center", gap: 0.75, width: "100%", textAlign: "left", font: "inherit", cursor: "pointer",
                        px: 1.25, py: 0.9, borderRadius: 2, border: "1px solid #bfdbfe", bgcolor: "#eff6ff", color: "#1d4ed8", "&:hover": { bgcolor: "#dbeafe" } }}>
                      <Autorenew sx={{ fontSize: 18, flexShrink: 0 }} />
                      <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.82rem", fontWeight: 800 }}>ใบที่ยังไม่ได้งาน แยกไปติดตามต่อแล้ว — เปิดดู</Typography>
                      <ChevronRight sx={{ fontSize: 18 }} />
                    </Box>
                  )}
                  {k === "approved" && a.quotationApprovedNos?.length > 0 && (
                    <Typography sx={{ fontSize: "0.84rem", color: "#b45309", fontWeight: 700, mt: 1 }}>
                      ได้งานบางใบ: {a.quotationApprovedNos.join(", ")}{quoteListOf(a).length ? ` (จาก ${quoteListOf(a).length} ใบ)` : ""}
                    </Typography>
                  )}
                  {a.quotationDecisionNote && <Typography sx={{ fontSize: "0.84rem", color: "#334155", mt: 1 }}>{k === "rejected" ? "เหตุผล: " : "หมายเหตุ: "}{a.quotationDecisionNote}</Typography>}
                  {/* 🔁 (19 ต.ค. 2569 ผู้ใช้: "ตรงนี้ยังดูรกๆ") เอกสารผลลัพธ์เป็นแถวเดียว: ชิปไฟล์ (กดดู) + ปุ่มแนบ · แก้รายละเอียดอยู่มุมขวาบน */}
                  <ResultDocs a={a} k={k} onUpload={onFileUpload} onDelete={onDeleteFile} onPreview={onPreview}
                    uploading={upload.busy && upload.eventId === a._id && upload.type === "quotationResult"} progress={upload.progress} />
                  <ResultDetails a={a} k={k} isFinance={isFinance} onSave={(body) => onQuotation(job, body)} open={editResult} onClose={() => setEditResult(false)} />
                </Box>
              </Stack>
            </Box>
          )}

          {/* ── ③ ใบเสนอราคา: ไฟล์ + ข้อมูล (เห็นเสมอ) ── */}
          <Section title={`ใบเสนอราคา${quoteRevOf(a) ? ` · ฉบับปัจจุบัน ${revLabel(quoteRevOf(a))}` : ""}`} icon={<Description />}>
            <Box ref={filesRef} />
            <FileUploadSection
              eventId={a._id} type="quotation" label="ไฟล์ใบเสนอราคา" permEvent={a}
              files={a.quotationFiles} applicable={a.quotationApplicable}
              onUpload={onFileUpload} onDelete={onDeleteFile} onPreview={onPreview}
              uploading={upload.busy && upload.eventId === a._id && upload.type === "quotation"} progress={upload.progress} currentUser={currentUser}
            />
            <QuoteScanBox a={a} />
            {/* ✅ (26 ต.ค. 2569) ลูกค้าให้แก้ → ออกฉบับใหม่ (ฉบับเดิมที่ส่งไปแล้วล็อกไว้เป็นประวัติ)
                🎨 (1 พ.ย. 2569) กล่องเทาอ่อน + ปุ่มรองเส้นขอบ — ไม่แย่งสายตาปุ่มหลัก "บันทึกการติดตาม" (เดิมม่วงทึบ) */}
            {onRevise && !req && (["sent", "follow_up", "rejected"].includes(k) || (k === "approved" && isFinance)) && (
              <Box sx={{ mt: 1, p: 1.25, borderRadius: 2, bgcolor: "#f7f8fa", border: "1px dashed #d6dae1", display: "flex", alignItems: { sm: "center" }, flexDirection: { xs: "column", sm: "row" }, gap: 1 }}>
                <Typography sx={{ flex: 1, fontSize: "0.8rem", color: "#4b5563" }}>
                  ลูกค้าขอแก้รายละเอียด? ไฟล์ที่ส่งไปแล้วแก้ไม่ได้ — ออกฉบับใหม่ ({revLabel(quoteRevOf(a) + 1)}) แล้วระบบเริ่มนับติดตามใหม่
                </Typography>
                <Button size="small" variant="outlined" startIcon={<Autorenew sx={{ fontSize: 16 }} />} onClick={() => setRevising(true)}
                  sx={{ flexShrink: 0, textTransform: "none", fontWeight: 700, borderRadius: 2, bgcolor: "#fff", color: "#2563eb", borderColor: "#bfdbfe", "&:hover": { borderColor: "#2563eb", bgcolor: "#eff6ff" } }}>
                  แก้ไขใบเสนอราคา · ออกฉบับใหม่
                </Button>
              </Box>
            )}
            <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px dashed ${BORDER}` }}>
              <InfoSection a={a} isFinance={isFinance} canEdit onSave={(body) => onQuotation(job, body)} inline />
            </Box>
          </Section>

          <RevisionHistory a={a} onPreview={onPreview} />

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
      <ReviseDialog a={a} open={revising} onClose={() => setRevising(false)} onConfirm={(p) => onRevise(job, p)} />
      <DecisionDialog mode={decision} busy={busy} onClose={() => setDecision(null)} onConfirm={confirmDecision}
        asRequest={!isFinance} req={req} a={a} onPreview={onPreview}
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
      const fin = can(userData, "editFinance");
      toast(body.action === "approve" ? (fin ? "บันทึกแล้ว: ได้งาน" : "ส่งคำขอ “ได้งาน” แล้ว — รอแอดมินอนุมัติ")
        : body.action === "reject" ? (fin ? "บันทึกแล้ว: ไม่ได้งาน" : "ส่งคำขอ “ไม่ได้งาน” แล้ว — รอแอดมินอนุมัติ")
        : body.action === "approveRequest" ? "อนุมัติผลแล้ว" : body.action === "rejectRequest" ? "ไม่อนุมัติ — ส่งกลับผู้ขอแล้ว" : body.action === "cancelRequest" ? "ยกเลิกคำขอแล้ว"
        : body.action === "send" ? "เริ่มนับวันติดตามแล้ว" : body.action === "reset" ? "แก้ผลแล้ว — กลับไปรอลูกค้าตอบ" : "บันทึกข้อมูลใบเสนอราคาแล้ว");
      return true;
    } catch (err) {
      toast(errMsg(err, "บันทึกไม่สำเร็จ"), "error");
      return false;
    }
  }, [fetchJobs, toast, userData]);
  const onFollowUp = useCallback(async (job, payload) => {
    try {
      const res = await EventService.AddQuotationFollowUp(job.anchor._id, payload);
      await fetchJobs(true);
      // ✅ (26 ต.ค. 2569 ผู้ใช้: "มีแจ้งเตือนตอนกดบันทึกติดตาม") บอกครั้งที่ · นัดครั้งถัดไป · ว่าแจ้งผู้เกี่ยวข้องแล้ว
      const no = res?.attemptNumber;
      const nextTxt = payload.nextFollowUpAt ? `นัดติดตามครั้งถัดไป ${thaiDate(payload.nextFollowUpAt)}` : `ระบบเตือนติดตามอีกครั้งใน ${WARNING_DAYS_AFTER_SENT} วัน`;
      toast(`✓ บันทึกการติดตาม${no ? `ครั้งที่ ${no}` : ""}แล้ว · ${nextTxt} · แจ้งผู้รับผิดชอบแล้ว`);
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
    setUpload({ busy: true, eventId, type, progress: 0 }); // type: แยกหลอดโหลดของแต่ละช่อง (เดิมขึ้นทุกช่องของงานเดียวกัน)
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
      setUpload({ busy: false, eventId: null, type: null, progress: 0 });
    }
  }, [fetchJobs, toast]);
  const onDeleteFile = useCallback(async (eventId, type, fileId) => {
    try { await EventService.DeleteFile(eventId, type, fileId); toast("ลบไฟล์เรียบร้อย"); await fetchJobs(true); } catch (err) { toast(errMsg(err, "ลบไฟล์ไม่สำเร็จ"), "error"); }
  }, [fetchJobs, toast]);
  // ✅ (26 ต.ค. 2569) ออกใบเสนอราคาฉบับแก้ไข: บันทึกฉบับใหม่ → แนบไฟล์ฉบับใหม่ (เซิร์ฟเวอร์เริ่มนับติดตามใหม่เมื่อแนบ)
  const onRevise = useCallback(async (job, { reason, files }) => {
    const id = job.anchor._id;
    const rev = (Number(job.anchor.quotationRevision) || 0) + 1;
    try {
      await EventService.UpdateQuotation(id, { action: "revise", reason });
    } catch (err) {
      toast(errMsg(err, "ออกฉบับแก้ไขไม่สำเร็จ"), "error");
      return false;
    }
    setUpload({ busy: true, eventId: id, type: "quotation", progress: 0 });
    let ok = 0;
    try {
      for (const file of files) {
        // eslint-disable-next-line no-await-in-loop -- อัปโหลดทีละไฟล์ให้แถบความคืบหน้าถูกต้อง
        await EventService.Upload(id, file, "quotation", {
          onUploadProgress: (pe) => setUpload((u) => ({ ...u, progress: Math.min(99, Math.round((pe.loaded * 100) / pe.total)) })),
        });
        ok += 1;
      }
      toast(`✓ ออกใบเสนอราคาฉบับแก้ไข ${revLabel(rev)} แล้ว · เริ่มนับติดตามใหม่ · แจ้งผู้เกี่ยวข้องแล้ว`);
    } catch (err) {
      toast(ok ? `แนบฉบับใหม่ได้ ${ok}/${files.length} ไฟล์ — แนบที่เหลือในกล่องใบเสนอราคา` : "บันทึกฉบับแก้ไขแล้ว แต่แนบไฟล์ไม่สำเร็จ — แนบไฟล์ฉบับใหม่ในกล่องใบเสนอราคาอีกครั้ง", "error");
    } finally {
      await fetchJobs(true);
      setUpload({ busy: false, eventId: null, type: null, progress: 0 });
    }
    return true;
  }, [fetchJobs, toast]);

  return { onQuotation, onFollowUp, onComment, onFileUpload, onDeleteFile, onRevise, upload };
}

/**
 * 🔁 (21 ต.ค. 2569 ผู้ใช้: "บันทึกงาน แนบใบเสนอราคาตอนทำเสร็จ แล้วใบเสนอราคาให้เข้าไปดำเนินการได้")
 *    บันทึกงาน (ไม่ลงตาราง) ที่แนบใบเสนอราคา ไม่อยู่ใน event-op → ดึงจากรายการงานรอลงตารางมาต่อท้าย
 *    ใช้วันที่ทำเสร็จ/วันที่บันทึกแทนวันเข้างาน
 */
async function withQuotedNotes(events) {
  try {
    // ⚠️ ต้องขอรวมที่ทำเสร็จแล้วด้วย — ค่าเริ่มต้นตัดบันทึกที่ทำเสร็จ (noteDoneAt) ออก ซึ่งคือตัวที่แนบใบเสนอราคา
    // ✅ (10 พ.ย. 2569) + ใบเสนอราคาแยก (quoteOnly) — ขอรวมมาด้วย (ค่าเริ่มต้น server ตัดออก)
    const dr = await EventService.GetDraftEvents({ includeCancelled: true, quotes: "1" });
    const have = new Set(events.map((e) => String(e._id)));
    const notes = (dr?.drafts || [])
      .filter((d) => !d.cancelledAt && !have.has(String(d._id)) && (d.quoteOnly || (d.intakeNote && ((d.quotationFiles || []).length || d.quotationStatus))))
      .map((d) => (d.quoteOnly
        ? { ...d, start: d.createdAt || d.start, end: d.createdAt || d.end }
        : { ...d, start: d.start || d.noteDoneAt || d.intakeAt, end: d.end || d.noteDoneAt || d.intakeAt, title: d.title || "บันทึกงาน", site: d.site || d.description?.slice(0, 60) || "" }));
    return [...events, ...notes];
  } catch {
    return events;
  }
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
      setEvents(await withQuotedNotes(res?.userEvents || []));
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
  // ✅ (10 พ.ย. 2569) เพิ่ม/แก้ใบเสนอราคาแยก · ลิงก์ ?newQuote=contract:<id> | event:<id> | 1 (เช่น จากหน้าภาพรวมงาน "เสนอราคาต่อสัญญา")
  const [quoteDlg, setQuoteDlg] = useState({ open: false, initial: null, edit: null });
  const [preview, setPreview] = useState({ url: null, name: "" });
  const [snackbar, setSnackbar] = useState({ open: false, msg: "", severity: "success" });
  const topRef = useRef(null);

  const toast = (msg, severity = "success") => setSnackbar({ open: true, msg, severity });

  const fetchJobs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // ⚠️ detail = ขอ activityLog มาด้วย (ประวัติใบเสนอราคาในกล่องรายละเอียด)
      const res = await EventService.getEventOp({ detail: true });
      setEvents(await withQuotedNotes(res?.userEvents || []));
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

  useEffect(() => {
    const nq = searchParams.get("newQuote");
    if (!nq || loading) return;
    const [kind, id] = nq.split(":");
    setQuoteDlg({ open: true, edit: null, initial: kind === "contract" && id ? { kind: "contract", contractGroupId: id } : kind === "event" && id ? { kind: "event", eventId: id } : null });
    setSearchParams((prev) => { const next = new URLSearchParams(prev); next.delete("newQuote"); return next; }, { replace: true });
  }, [searchParams, setSearchParams, loading]);
  const cancelQuote = async (a) => {
    const r = await Swal.fire({ title: "ยกเลิกใบเสนอราคานี้?", input: "text", inputLabel: "เหตุผล (ถ้ามี)", inputPlaceholder: "เช่น เพิ่มซ้ำ / ลูกค้าไม่ต้องการแล้ว",
      showCancelButton: true, confirmButtonText: "ยกเลิกใบนี้", cancelButtonText: "ไม่ยกเลิก", confirmButtonColor: "#dc2626", reverseButtons: true });
    if (!r.isConfirmed) return;
    try { await EventService.UpdateQuoteRef(a._id, { cancel: true, reason: r.value || "" }); toast("ยกเลิกใบเสนอราคาแล้ว"); setDetailId(""); fetchJobs(true); }
    catch (err) { toast(err?.response?.data?.message || "ยกเลิกไม่สำเร็จ", "error"); }
  };

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
    const c = { all: base.length, open: 0, incomplete: 0, decision_req: 0 };
    base.forEach((j) => {
      c[j.groupKey] = (c[j.groupKey] || 0) + 1; if (OPEN.includes(j.groupKey)) c.open += 1; if (missingInfo(j.anchor)) c.incomplete += 1;
      if (reqOf(j.anchor)) c.decision_req += 1;
    });
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
      // ✅ (10 พ.ย. 2569) ได้งานบางใบ = นับยอดที่อนุมัติจริง ไม่ใช่ยอดเต็มทุกใบ
      approvedValue: approved.reduce((t, j) => t + wonAmountOf(j.anchor), 0), approvedCount: approved.length,
      winRate: decided ? Math.round((approved.length / decided) * 100) : null, decided,
      urgentValue: sum(base.filter((j) => j.groupKey === "follow_up")),
    };
  }, [base]);

  const visible = useMemo(() => {
    let list = base;
    if (status === "open") list = base.filter((j) => OPEN.includes(j.groupKey));
    else if (status === "incomplete") list = base.filter((j) => missingInfo(j.anchor));
    else if (status === "decision_req") list = base.filter((j) => reqOf(j.anchor));
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

  const { onQuotation, onFollowUp, onComment, onFileUpload, onDeleteFile, onRevise, upload } = useQuotationActions(fetchJobs, toast, userData);

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
    // 🔁 (26 ต.ค. 2569 ผู้ใช้: "สถานะหน้าติดตามใบเสนอราคาให้สอดคล้องกับปัจจุบันด้วย") ชื่อบนแถบ = ชื่อป้ายสถานะในตาราง/การ์ดเป๊ะ
    //    (เดิมแถบใช้ชื่อย่อ "ตามด่วน/รอตอบ/รอไฟล์" แต่แถวใช้ "ถึงเวลาติดตาม/รอลูกค้าตอบ/..." อ่านแล้วไม่ตรงกัน)
    { value: "open", label: "กำลังดำเนินการ", count: counts.open, unit: "ใบ", icon: <Apps />, color: "#475569" },
    // ✅ คำขอ ได้งาน/ไม่ได้งาน ที่รอแอดมินอนุมัติ — แสดงเมื่อมี
    ...(counts.decision_req > 0 || status === "decision_req" ? [{
      value: "decision_req", label: "รออนุมัติผล", count: counts.decision_req, unit: "ใบ", icon: <HourglassTop />, color: REQ_COLOR, alert: counts.decision_req > 0,
    }] : []),
    // ✅ โชว์เฉพาะสถานะที่มีใบอยู่จริง (หรือกำลังเลือกอยู่) — การ์ดเลข 0 เรียงเต็มแถวทำให้รกตา
    ...STATUS_ORDER.filter((s) => (counts[s] || 0) > 0 || status === s).map((s) => {
      const m = STATUS[s];
      const Icon = m.icon;
      return { value: s, label: m.label, count: counts[s] || 0, unit: "ใบ", icon: <Icon />, color: s === "follow_up" ? m.color : "#475569", alert: s === "follow_up" };
    }),
    { value: "all", label: "ทั้งหมด", count: counts.all, unit: "ใบ", icon: <Insights />, color: "#475569" },
  ];

  const filterBar = (
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}
        sx={isDesktop ? { mb: 1.5, p: 1, bgcolor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 3, boxShadow: "none" } : {}}>
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
          <ExportExcelButton onClick={doExport} loading={exporting} disabled={!visible.length} count={visible.length} />
        </Stack>
      </Stack>
  );
  const tilesEl = <ViewTiles value={status} onChange={setStatus} isMobile={!isDesktop} compact groups={[{ title: "", items: tiles }]} />;
  const statusLabel = status === "open" ? "กำลังดำเนินการ" : status === "all" ? "ทั้งหมด" : status === "incomplete" ? "ข้อมูลไม่ครบ" : status === "decision_req" ? "รออนุมัติผล" : STATUS[status]?.label || "";

  return (
    <Box sx={PAGE_SX}>
      {/* ── หัวเพจ ── */}
      {/* 🔁 (10 พ.ย. 2569 ผู้ใช้: "จัดวางหัวหน้ามือถือใหม่ให้กระชับ ดูง่าย สวยงาม") มือถือ: ไม่มีกรอบ · ชื่อหน้าบรรทัดเดียว + จำนวนใบ/เวลาอัปเดตบรรทัดเล็ก · ปุ่ม Excel/ตัวกรองขนาดเท่ากัน */}
      <Box sx={{ borderRadius: { xs: 0, sm: 3 }, border: { xs: 0, sm: `1px solid ${BORDER}` }, bgcolor: { xs: "transparent", sm: "#fff" }, px: { xs: 0.25, sm: 2 }, py: { xs: 0.5, sm: 1.5 }, mb: { xs: 1, sm: 1.5 } }}>
        <Stack direction="row" alignItems="center" spacing={{ xs: 1.1, sm: 1.5 }}>
          <Box sx={{ width: { xs: 34, sm: 40 }, height: { xs: 34, sm: 40 }, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#eff6ff", color: "#2563eb", "& svg": { fontSize: 22 } }}>
            <RequestQuote />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography noWrap sx={{ fontWeight: 800, fontSize: { xs: "1.05rem", sm: "1.35rem" }, color: TEXT_MAIN, lineHeight: 1.25 }}>ติดตามใบเสนอราคา</Typography>
            <Typography noWrap sx={{ fontSize: "0.74rem", color: TEXT_SUB, display: { xs: "none", sm: "block" } }}>
              แนบใบเสนอราคา → เริ่มนับติดตามอัตโนมัติทันที → ติดตามลูกค้า (ทุก {WARNING_DAYS_AFTER_SENT} วัน หรือตามนัด) → ได้งาน / ไม่ได้งาน
              {lastRefreshed ? ` · อัปเดต ${moment(lastRefreshed).format("HH:mm")}` : ""}
            </Typography>
            <Typography noWrap sx={{ fontSize: "0.72rem", color: TEXT_SUB, display: { xs: "block", sm: "none" } }}>
              {visible.length} ใบ{lastRefreshed ? ` · อัปเดต ${moment(lastRefreshed).format("HH:mm")}` : ""}
            </Typography>
          </Box>
          {/* ✅ (10 พ.ย. 2569) เพิ่มใบเสนอราคาแยก — อิงงาน/สัญญาได้ หรือไม่อิง */}
          <Button variant="contained" startIcon={<AddRounded sx={{ fontSize: "19px !important" }} />} onClick={() => setQuoteDlg({ open: true, initial: null, edit: null })}
            sx={{ display: { xs: "none", sm: "inline-flex" }, flexShrink: 0, height: 40, px: 2, borderRadius: 2.5, textTransform: "none", fontWeight: 800, boxShadow: "none", bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8", boxShadow: "none" } }}>
            เพิ่มใบเสนอราคา
          </Button>
          <IconButton aria-label="เพิ่มใบเสนอราคา" onClick={() => setQuoteDlg({ open: true, initial: null, edit: null })}
            sx={{ display: { xs: "inline-flex", sm: "none" }, width: 40, height: 40, borderRadius: 2.5, bgcolor: "#2563eb", color: "#fff", "&:hover": { bgcolor: "#1d4ed8" } }}>
            <AddRounded sx={{ fontSize: 22 }} />
          </IconButton>
          <Tooltip title="รีเฟรช">
            <IconButton onClick={() => fetchJobs()} sx={{ border: `1px solid ${BORDER}`, borderRadius: 2, display: { xs: "none", md: "inline-flex" } }}><Refresh sx={{ fontSize: 20 }} /></IconButton>
          </Tooltip>
          {/* ✅ มือถือ: ค้นหา/ตัวกรอง/สถานะ ซ่อนในแผ่นล่าง (เหมือนหน้าใบเบิก/ใบขอซื้อ) — ผู้ใช้สั่ง 2 ต.ค. 2569 */}
          {/* ✅ Excel ต้องกดได้เสมอ (แท็บเล็ต/มือถือด้วย) — ไม่ซ่อนไว้ในแผ่นตัวกรองอย่างเดียว */}
          {!isDesktop && (
            <ExportExcelButton onClick={doExport} loading={exporting} disabled={!visible.length} compact />
          )}
          {!isDesktop && (
            <IconButton aria-label="ค้นหาและตัวกรอง" onClick={() => setFiltersOpen(true)}
              sx={{ width: 40, height: 40, borderRadius: 2.5, border: `1px solid ${BORDER}`, bgcolor: activeFilters ? "#eff6ff" : "#fff", color: activeFilters ? "#2563eb" : TEXT_MAIN }}>
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
          gridTemplateColumns: { xs: "none", md: "repeat(5, 1fr)" }, gridAutoFlow: { xs: "column", md: "row" }, gridAutoColumns: { xs: "40%", md: "auto" },
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
          onFileUpload={onFileUpload} onDeleteFile={onDeleteFile} onRevise={onRevise} onPreview={(url, name) => setPreview({ url, name })} upload={upload}
          onEditQuote={(a) => setQuoteDlg({ open: true, initial: null, edit: a })} onCancelQuote={cancelQuote}
        />
      )}
      <QuoteOnlyDialog open={quoteDlg.open} events={events} initial={quoteDlg.initial} edit={quoteDlg.edit}
        onClose={() => setQuoteDlg({ open: false, initial: null, edit: null })}
        onUploadFiles={onFileUpload}
        onSaved={async (id) => {
          const wasEdit = Boolean(quoteDlg.edit);
          setQuoteDlg({ open: false, initial: null, edit: null });
          toast(wasEdit ? "บันทึกการแก้ไขแล้ว" : "เพิ่มใบเสนอราคาแล้ว");
          await fetchJobs(true);
          if (id) setDetailId(id);
        }} />
      <FilePreviewDialog previewUrl={preview.url} previewFileName={preview.name} onClose={() => setPreview({ url: null, name: "" })} />
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((p) => ({ ...p, open: false }))} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snackbar.severity} variant="filled" sx={{ borderRadius: 2 }}>{snackbar.msg}</Alert>
      </Snackbar>
    </Box>
  );
}

// ใช้ในเทสต์ (ได้งานบางใบ · ยอดอนุมัติ · แนบหลักฐาน)
export { DecisionDialog, quoteListOf, wonAmountOf };
