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
  Table, TableBody, TableCell, TableHead, TableRow, Collapse, Drawer, Badge,
} from "@mui/material";
import {
  Search, Close, Refresh, RequestQuote, Send, CheckCircle, Cancel, Autorenew, HourglassTop, WarningAmber, ChevronRight,
  AttachFile, Chat, OpenInNew, History, Apps, Description, Edit, Phone, Email, EventRepeat, Undo, Save, Insights, ExpandMore, Tune,
} from "@mui/icons-material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileExcel } from "@fortawesome/free-solid-svg-icons";

import useRealtime from "@/shared/realtime/useRealtime";
import { useAuth } from "@/features/auth/AuthContext";
import EventService from "@/shared/services/EventService";
import { FileUploadSection, CommentThread, FilePreviewDialog } from "@/features/operation/components/OperationBoard";
import { getOverdueGroupKey } from "@/shared/utils/overdueJobs";
import { WARNING_DAYS_AFTER_SENT, getFollowUpInfo, resolveQuotationGroup } from "@/shared/utils/quotationTracking";
import { formatEventDateRange } from "@/shared/utils/formatDateRange";
import { formatRoundLabel } from "@/shared/utils/contractRounds";
import { formatThai, thaiDate } from "@/shared/utils/thaiDate";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import { can } from "@/shared/utils/roles";
import ViewTiles from "@/shared/ui/ViewTiles";
import SelectField from "@/shared/ui/SelectField";
import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import useCloseOnPick from "@/shared/hooks/useCloseOnPick";

const TEXT_MAIN = "#0f172a";
const TEXT_SUB = "#64748b";
const BORDER = "#e2e8f0";
const PAGE_SIZE = 15;

/** สถานะย่อยของใบ — ลำดับ = ลำดับขั้นตอนจริง (ใช้ทั้งการ์ดสถานะและการเรียง) */
const STATUS = {
  follow_up: { label: "ต้องติดตามด่วน", short: "ตามด่วน", color: "#dc2626", icon: WarningAmber },
  sent: { label: "รอลูกค้าตอบ", short: "รอตอบ", color: "#2563eb", icon: Send },
  revising: { label: "ลูกค้าขอแก้ไข", short: "ขอแก้ไข", color: "#7c3aed", icon: Autorenew },
  // ✅ ไม่มีขั้น "ส่งลูกค้า" แล้ว — มีไฟล์แต่ยังไม่เริ่มนับ = รอช่างส่งงาน (services/quotationAutoStart.js)
  not_sent: { label: "รอช่างส่งงาน", short: "รอส่งงาน", color: "#d97706", icon: HourglassTop },
  waiting_file: { label: "รอแนบใบเสนอราคา", short: "รอไฟล์", color: "#64748b", icon: AttachFile },
  approved: { label: "อนุมัติแล้ว", short: "อนุมัติ", color: "#15803d", icon: CheckCircle },
  rejected: { label: "ปฏิเสธ", short: "ปฏิเสธ", color: "#94a3b8", icon: Cancel },
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

/** ✅ ผู้ใช้สั่ง "แก้สีสันไม่ให้รกตา" — ป้ายสถานะพื้นเทาอ่อน + จุดสีเล็กๆ (สีอยู่ที่จุดเท่านั้น ยกเว้นต้องตามด่วน) */
const StatusChip = ({ k, size = "small" }) => {
  const m = STATUS[k] || STATUS.not_sent;
  return (
    <Box component="span" sx={{
      display: "inline-flex", alignItems: "center", gap: 0.6, height: size === "small" ? 22 : 26, px: 1, borderRadius: 999,
      bgcolor: "#f8fafc", color: k === "follow_up" ? m.color : "#334155", border: `1px solid ${BORDER}`,
      fontSize: size === "small" ? "0.72rem" : "0.8rem", fontWeight: 700, whiteSpace: "nowrap",
    }}>
      <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: m.color, flexShrink: 0 }} />{m.label}
    </Box>
  );
};

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

const KV = ({ label, children, color }) => (
  <Box sx={{ minWidth: 0 }}>
    <Typography sx={{ fontSize: "0.7rem", color: TEXT_SUB, fontWeight: 700 }}>{label}</Typography>
    <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: color || TEXT_MAIN, wordBreak: "break-word" }}>{children || "—"}</Typography>
  </Box>
);

// ─── ตาราง (จอใหญ่) ───────────────────────────────────────────────────────────
const DesktopTable = ({ jobs, onOpen, onPreview }) => (
  <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 3, overflowX: "auto", boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}>
    <Table size="small" sx={{ minWidth: 1080, "& th": { fontWeight: 800, color: TEXT_SUB, fontSize: "0.74rem", bgcolor: "#f8fafc", whiteSpace: "nowrap" } }}>
      <TableHead>
        <TableRow>
          <TableCell>ลูกค้า / โครงการ</TableCell>
          <TableCell>ใบเสนอราคา</TableCell>
          <TableCell>ผู้รับผิดชอบ</TableCell>
          <TableCell align="right">มูลค่า</TableCell>
          <TableCell>เริ่มนับ / ยืนราคา</TableCell>
          <TableCell>การติดตาม</TableCell>
          <TableCell>สถานะ</TableCell>
          <TableCell width={36} />
        </TableRow>
      </TableHead>
      <TableBody>
        {jobs.map((job) => {
          const a = job.anchor;
          const info = job.info;
          const files = a.quotationFiles || [];
          return (
            <TableRow key={a._id} hover onClick={() => onOpen(job)} sx={{ cursor: "pointer", "& td": { py: 1.1, borderColor: BORDER } }}>
              <TableCell sx={{ maxWidth: 300 }}>
                <Typography noWrap sx={{ fontWeight: 800, fontSize: "0.86rem", color: TEXT_MAIN }}>{siteText(a)}</Typography>
                <Typography noWrap sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>{jobText(a) || "—"}{a.time ? ` · ครั้งที่ ${formatRoundLabel(a.time, a.visitCount, a)}` : ""}</Typography>
              </TableCell>
              <TableCell sx={{ whiteSpace: "nowrap" }}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Typography sx={{ fontWeight: 700, fontSize: "0.84rem", color: a.quotationNo ? TEXT_MAIN : "#94a3b8" }}>{a.quotationNo || "ไม่มีเลขที่"}</Typography>
                  {files.length > 0 && (
                    <Tooltip title={`เปิดไฟล์ใบเสนอราคา${files.length > 1 ? ` (${files.length} ไฟล์)` : ""}`}>
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); onPreview(files[files.length - 1].fileUrl, files[files.length - 1].fileName); }} sx={{ p: 0.25, color: "#475569" }}>
                        <Description sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
                <Typography sx={{ fontSize: "0.72rem", color: TEXT_SUB }}>{a.quotationDate ? thaiDate(a.quotationDate) : `งาน ${formatEventDateRange(a)}`}</Typography>
              </TableCell>
              <TableCell sx={{ maxWidth: 170 }}><Owner name={ownerOf(a)} size={28} /></TableCell>
              <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                {a.quotationAmount ? (
                  <>
                    <Typography sx={{ fontWeight: 800, fontSize: "0.9rem", color: TEXT_MAIN }}>{baht(a.quotationAmount)}</Typography>
                    <Typography sx={{ fontSize: "0.68rem", color: TEXT_SUB }}>{a.quotationVatIncluded ? "รวม VAT" : "ก่อน VAT"}</Typography>
                  </>
                ) : <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: "#94a3b8" }}>ยังไม่ระบุ</Typography>}
              </TableCell>
              <TableCell sx={{ whiteSpace: "nowrap" }}>
                <Typography sx={{ fontSize: "0.8rem", color: a.quotationSentAt ? TEXT_MAIN : TEXT_SUB }}>{a.quotationSentAt ? thaiDate(a.quotationSentAt) : "ยังไม่เริ่มนับ"}</Typography>
                {a.quotationValidUntil && (
                  <Typography sx={{ fontSize: "0.7rem", fontWeight: isExpired(a) ? 800 : 500, color: isExpired(a) ? "#dc2626" : TEXT_SUB }}>
                    {isExpired(a) ? "หมดอายุ " : "ยืนราคาถึง "}{thaiDate(a.quotationValidUntil)}
                  </Typography>
                )}
              </TableCell>
              <TableCell sx={{ whiteSpace: "nowrap" }}>
                {info ? (
                  <>
                    <DueChip info={info} />
                    <Typography sx={{ fontSize: "0.7rem", color: TEXT_SUB }}>
                      {info.followUpCount ? `ตามแล้ว ${info.followUpCount} ครั้ง` : "ยังไม่เคยตาม"} · เงียบ {info.daysSinceLastContact} วัน
                    </Typography>
                  </>
                ) : a.quotationDecisionAt ? (
                  <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>ตอบกลับ {thaiDate(a.quotationDecisionAt)}{a.quotationPoNo ? ` · PO ${a.quotationPoNo}` : ""}</Typography>
                ) : <Typography sx={{ fontSize: "0.74rem", color: "#cbd5e1" }}>—</Typography>}
              </TableCell>
              <TableCell><StatusChip k={job.groupKey} /></TableCell>
              <TableCell><ChevronRight sx={{ color: "#cbd5e1" }} /></TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  </Box>
);

// ─── การ์ด (มือถือ) ───────────────────────────────────────────────────────────
const MobileCard = ({ job, onOpen }) => {
  const a = job.anchor;
  const m = STATUS[job.groupKey] || STATUS.not_sent;
  return (
    <Box onClick={() => onOpen(job)} role="button" sx={{ p: 1.5, bgcolor: "#fff", border: `1px solid ${BORDER}`, borderLeft: `3px solid ${job.groupKey === "follow_up" ? m.color : "#cbd5e1"}`, borderRadius: 2.5, cursor: "pointer", "&:active": { bgcolor: "#f8fafc" } }}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: "0.9rem", color: TEXT_MAIN, lineHeight: 1.35 }}>{siteText(a)}</Typography>
          <Typography noWrap sx={{ fontSize: "0.76rem", color: TEXT_SUB }}>{jobText(a) || "—"}</Typography>
        </Box>
        <Box sx={{ textAlign: "right", flexShrink: 0 }}>
          <Typography sx={{ fontWeight: 900, fontSize: "0.92rem", color: a.quotationAmount ? TEXT_MAIN : "#94a3b8" }}>{a.quotationAmount ? baht(a.quotationAmount) : "ไม่ระบุมูลค่า"}</Typography>
          <Typography sx={{ fontSize: "0.7rem", color: TEXT_SUB }}>{a.quotationNo || "ไม่มีเลขที่"}</Typography>
        </Box>
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1, pt: 1, borderTop: `1px solid ${BORDER}` }}>
        <StatusChip k={job.groupKey} />
        <Box sx={{ flex: 1, minWidth: 0 }}>{job.info ? <DueChip info={job.info} /> : null}</Box>
        <Typography noWrap sx={{ fontSize: "0.74rem", color: TEXT_SUB, maxWidth: 120 }}>{ownerOf(a) || "ไม่ระบุ"}</Typography>
      </Stack>
    </Box>
  );
};

// ─── กล่องยืนยันการตัดสินใจของลูกค้า (อนุมัติ = เลข PO · ปฏิเสธ = เหตุผลบังคับ · ส่ง = วันที่ส่ง) ─────
const DecisionDialog = ({ mode, onClose, onConfirm, busy }) => {
  const [date, setDate] = useState(moment().format("YYYY-MM-DD"));
  const [po, setPo] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => { if (mode) { setDate(moment().format("YYYY-MM-DD")); setPo(""); setNote(""); } }, [mode]);
  if (!mode) return null;
  const meta = {
    send: { title: "เริ่มนับติดตามใบเสนอราคา", color: "#2563eb", btn: "เริ่มนับ", dateLabel: "เริ่มนับจากวันที่" },
    resend: { title: "ส่งใบเสนอราคาฉบับแก้ไขให้ลูกค้าแล้ว", color: "#2563eb", btn: "บันทึก · เริ่มนับใหม่", dateLabel: "วันที่ส่งฉบับแก้ไข" },
    approve: { title: "ลูกค้าอนุมัติใบเสนอราคา", color: "#15803d", btn: "ยืนยันอนุมัติ", dateLabel: "วันที่ลูกค้าอนุมัติ" },
    reject: { title: "ลูกค้าปฏิเสธใบเสนอราคา", color: "#b91c1c", btn: "ยืนยันปฏิเสธ", dateLabel: "วันที่ลูกค้าแจ้ง" },
  }[mode];
  const invalid = mode === "reject" && !note.trim();
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 900, fontSize: "1rem", color: meta.color }}>{meta.title}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          <ThaiDatePicker label={meta.dateLabel} value={date} onChange={(v) => setDate(v || moment().format("YYYY-MM-DD"))} />
          {mode === "approve" && <TextField size="small" label="เลขที่ PO / ใบสั่งซื้อของลูกค้า (ถ้ามี)" value={po} onChange={(e) => setPo(e.target.value)} inputProps={{ maxLength: 60 }} />}
          {(mode === "approve" || mode === "reject") && (
            <TextField size="small" multiline minRows={2} label={mode === "reject" ? "เหตุผลที่ลูกค้าปฏิเสธ *" : "หมายเหตุ (ถ้ามี)"} value={note}
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
const InfoSection = ({ a, isFinance, canEdit, onSave, bare = false }) => {
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
        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)" } }}>
          <KV label="เลขที่" color={a.quotationNo ? undefined : "#b45309"}>{a.quotationNo || "ยังไม่ระบุ"}</KV>
          <KV label="วันที่ใบเสนอราคา">{a.quotationDate ? thaiDate(a.quotationDate) : ""}</KV>
          <KV label="ยืนราคาถึง" color={isExpired(a) ? "#dc2626" : undefined}>{a.quotationValidUntil ? `${thaiDate(a.quotationValidUntil)}${isExpired(a) ? " (หมดอายุ)" : ""}` : ""}</KV>
          <KV label="มูลค่า" color={a.quotationAmount ? undefined : "#b45309"}>
            {a.quotationAmount ? `${baht(a.quotationAmount)} ${a.quotationVatIncluded ? "(รวม VAT)" : "(ก่อน VAT)"}` : "ยังไม่ระบุ"}
          </KV>
          <KV label="ผู้ติดต่อลูกค้า">{contact.name || a.contactName}</KV>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.7rem", color: TEXT_SUB, fontWeight: 700 }}>ติดต่อ</Typography>
            <Stack spacing={0.25}>
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
              {!contact.phone && !a.contactTel && !contact.email && <Typography sx={{ fontSize: "0.88rem", fontWeight: 700 }}>—</Typography>}
            </Stack>
          </Box>
        </Box>
      )}
    </>
  );
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
const FollowUpSection = ({ a, onSubmit, onPreview, canFollow, formRef }) => {
  const followUps = a.quotationFollowUps || [];
  const [note, setNote] = useState("");
  const [channel, setChannel] = useState("phone");
  const [next, setNext] = useState("");
  const [showNext, setShowNext] = useState(false);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef();
  const submit = async () => {
    if (!note.trim() || busy) return;
    setBusy(true);
    const ok = await onSubmit({ note: note.trim(), channel, nextFollowUpAt: next, file });
    setBusy(false);
    if (ok) { setNote(""); setFile(null); setNext(""); setShowNext(false); }
  };
  const canWrite = canFollow && ["sent", "revising"].includes(a.quotationStatus);
  return (
    <Section title={`การติดตามลูกค้า${followUps.length ? ` · ${followUps.length} ครั้ง` : ""}`} icon={<EventRepeat />}>
      {/* ✅ ฟอร์มอยู่บนสุด (สิ่งที่ทำบ่อยที่สุด) · ช่องทางเป็นปุ่มกดเลือก ไม่ต้องเปิดเมนู · นัดวันถัดไปซ่อนไว้จนกว่าจะใช้ */}
      {canWrite && (
        <Stack ref={formRef} spacing={1} sx={{ mb: followUps.length ? 1.75 : 0 }}>
          <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75 }}>
            {CHANNELS.map((c) => (
              <Chip key={c.value} label={c.label} size="small" onClick={() => setChannel(c.value)}
                sx={{
                  height: 28, fontWeight: 700, borderRadius: 1.5,
                  bgcolor: channel === c.value ? "#eff6ff" : "#fff", color: channel === c.value ? "#1d4ed8" : "#334155",
                  border: `1px solid ${channel === c.value ? "#bfdbfe" : BORDER}`,
                }} />
            ))}
          </Stack>
          <TextField multiline minRows={2} size="small" placeholder="ผลการติดตาม เช่น ลูกค้ารอเข้าที่ประชุมสิ้นเดือน / ขอส่วนลดเพิ่ม 5%"
            value={note} onChange={(e) => setNote(e.target.value)} sx={{ "& .MuiOutlinedInput-root": { bgcolor: "#fff", borderRadius: 2 } }} />
          <Collapse in={showNext} unmountOnExit>
            <ThaiDatePicker label="นัดติดตามครั้งถัดไป" value={next} onChange={(v) => setNext(v || "")} />
          </Collapse>
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
            <input ref={inputRef} type="file" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <Button size="small" startIcon={<AttachFile sx={{ fontSize: 16 }} />} onClick={() => inputRef.current?.click()}
              sx={{ textTransform: "none", fontWeight: 700, color: TEXT_SUB, maxWidth: 180 }}>
              <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file ? file.name : "หลักฐาน"}</Box>
            </Button>
            {file && <IconButton size="small" onClick={() => setFile(null)}><Close sx={{ fontSize: 16 }} /></IconButton>}
            {!showNext && (
              <Button size="small" startIcon={<EventRepeat sx={{ fontSize: 16 }} />} onClick={() => setShowNext(true)}
                sx={{ textTransform: "none", fontWeight: 700, color: TEXT_SUB }}>นัดวันตามต่อ</Button>
            )}
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" disabled={!note.trim() || busy} startIcon={<Save sx={{ fontSize: 17 }} />} onClick={submit}
              sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", px: 2, width: { xs: "100%", sm: "auto" } }}>
              {busy ? "กำลังบันทึก..." : "บันทึกการติดตาม"}
            </Button>
          </Stack>
        </Stack>
      )}

      {followUps.length > 0 ? (
        <Stack spacing={0} sx={{ position: "relative", pl: 2.25, pt: canWrite ? 1.5 : 0, borderTop: canWrite ? `1px solid ${BORDER}` : "none", "&::before": { content: '""', position: "absolute", left: 6, top: canWrite ? 20 : 6, bottom: 6, width: 2, bgcolor: BORDER } }}>
          {followUps.slice().reverse().map((x, i) => (
            <Box key={x._id || i} sx={{ position: "relative", pb: 1.25 }}>
              <Box sx={{ position: "absolute", left: -20.5, top: 4, width: 11, height: 11, borderRadius: "50%", bgcolor: i === 0 ? "#2563eb" : "#cbd5e1", border: "2px solid #fff" }} />
              <Stack direction="row" spacing={1} alignItems="baseline" sx={{ flexWrap: "wrap" }}>
                <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: TEXT_MAIN }}>ครั้งที่ {x.attemptNumber}</Typography>
                {x.channel && <Chip size="small" label={channelLabel(x.channel)} sx={{ height: 18, fontSize: "0.66rem", fontWeight: 700 }} />}
                <Typography sx={{ fontSize: "0.72rem", color: TEXT_SUB }}>{formatThai(moment(x.contactedAt).locale("th"), "D MMM YY HH:mm")} · {x.userName}</Typography>
              </Stack>
              {x.note && <Typography sx={{ fontSize: "0.84rem", color: "#334155", whiteSpace: "pre-wrap", mt: 0.25 }}>{x.note}</Typography>}
              {x.evidenceFileUrl && (
                <Button size="small" startIcon={<AttachFile sx={{ fontSize: 15 }} />} onClick={() => onPreview(x.evidenceFileUrl, x.evidenceFileName)}
                  sx={{ textTransform: "none", fontSize: "0.72rem", p: 0, minWidth: 0, mt: 0.25 }}>หลักฐาน</Button>
              )}
            </Box>
          ))}
        </Stack>
      ) : !canWrite ? (
        <Typography sx={{ fontSize: "0.82rem", color: TEXT_SUB }}>
          {a.quotationStatus ? "ไม่มีบันทึกการติดตาม" : "บันทึกการติดตามได้เมื่อระบบเริ่มนับ (แนบใบเสนอราคา + ส่งงานแล้ว)"}
        </Typography>
      ) : null}
    </Section>
  );
};

// ─── กล่องรายละเอียด ─────────────────────────────────────────────────────────
// ✅ ผู้ใช้สั่ง (3 ต.ค. 2569): ตัดขั้น "ส่งลูกค้า" — ระบบเริ่มนับติดตามเองเมื่อแนบใบเสนอราคาและส่งงานแล้ว
//    (server: services/quotationAutoStart.js) · จัดลำดับใหม่ตามสิ่งที่ทำบ่อย: สถานะ+ปุ่ม → ไฟล์ → ติดตาม → ข้อมูล
const STEPS = [["file", "แนบใบเสนอราคา"], ["job", "ส่งงาน"], ["follow", "ติดตาม"], ["done", "ผลลัพธ์"]];
const stepIndex = (k) => ({ waiting_file: 0, not_sent: 1, sent: 2, follow_up: 2, revising: 2, approved: 3, rejected: 3 }[k] ?? 0);

const DetailDialog = ({
  job, currentUser, onClose, onQuotation, onFollowUp, onComment, onFileUpload, onDeleteFile, onPreview, upload,
}) => {
  const fullScreen = useMediaQuery("(max-width:600px)");
  const navigate = useNavigate();
  const [decision, setDecision] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
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

  const confirmDecision = async ({ date, po, note }) => {
    setBusy(true);
    const action = decision === "resend" || decision === "send" ? "send" : decision;
    const body = { action, ...(action === "send" ? { sentAt: date } : { decidedAt: date, poNo: po, decisionNote: note }) };
    const ok = await onQuotation(job, body);
    setBusy(false);
    if (ok) setDecision(null);
  };
  const goFollow = () => {
    const el = followRef.current;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => el?.querySelector("textarea")?.focus(), 350);
  };

  // ── การ์ดสถานะ: บอกว่าตอนนี้อยู่ตรงไหน + ปุ่มที่ต้องกดต่อ (ปุ่มหลักปุ่มเดียว) ──
  const banner = (() => {
    if (k === "waiting_file") {
      return { title: "รอแนบใบเสนอราคา", text: "แนบไฟล์ในส่วน \"ใบเสนอราคา\" ด้านล่าง — เมื่อแนบแล้วและงานส่งเสร็จ ระบบเริ่มนับวันติดตามให้เอง" };
    }
    if (k === "not_sent") {
      return {
        title: "แนบใบเสนอราคาแล้ว · รอช่างส่งงาน",
        text: "ระบบจะเริ่มนับวันติดตามให้เองทันทีที่ช่างส่งงาน/ปิดงาน",
        extra: isFinance ? [["send", "เริ่มนับตอนนี้", <EventRepeat key="i" />]] : [],
      };
    }
    if (open) {
      const due = !info ? "" : info.needsFollowUp ? `เลยกำหนดติดตาม ${-info.daysUntilDue} วัน` : info.daysUntilDue === 0 ? "ครบกำหนดติดตามวันนี้" : `ติดตามครั้งถัดไปอีก ${info.daysUntilDue} วัน`;
      const sub = !info ? "" : `เริ่มนับ ${thaiDate(a.quotationSentAt)} · ติดต่อล่าสุด ${thaiDate(info.lastContactAt)} · ครบกำหนด ${thaiDate(info.dueAt)}${info.scheduled ? " (นัดไว้)" : ""}`;
      return { title: k === "revising" ? `ลูกค้าขอแก้ไข · ${due}` : due, text: sub, follow: true };
    }
    return null;
  })();

  return (
    <Dialog open onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="md" PaperProps={{ sx: { borderRadius: fullScreen ? 0 : 3, bgcolor: "#f8fafc" } }}>
      {/* ── หัว: ชื่องาน 1 บรรทัด + มูลค่า · ขั้นตอนเป็นแถบบาง ── */}
      <Box sx={{ px: { xs: 1.75, sm: 2.5 }, pt: 1.5, pb: 1.25, bgcolor: "#fff", borderBottom: `1px solid ${BORDER}` }}>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 900, fontSize: "1.02rem", color: TEXT_MAIN, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {siteText(a)}
            </Typography>
            <Typography noWrap sx={{ fontSize: "0.76rem", color: TEXT_SUB }}>
              {[jobText(a), a.time ? `ครั้งที่ ${formatRoundLabel(a.time, a.visitCount, a)}` : "", formatEventDateRange(a)].filter(Boolean).join(" · ")}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" aria-label="ปิด" sx={{ mt: -0.25 }}><Close /></IconButton>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
          <StatusChip k={k} />
          {a.quotationNo && <Typography noWrap sx={{ fontSize: "0.76rem", fontWeight: 700, color: TEXT_SUB }}>{a.quotationNo}</Typography>}
          <Box sx={{ flex: 1 }} />
          <Typography noWrap sx={{ fontWeight: 900, fontSize: "1rem", color: a.quotationAmount ? TEXT_MAIN : "#b45309" }}>
            {a.quotationAmount ? baht(a.quotationAmount) : "ไม่ระบุมูลค่า"}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} sx={{ mt: 1.25 }}>
          {STEPS.map(([key, label], i) => {
            const done = i < step || (i === 3 && step === 3);
            const cur = i === step && step < 3;
            const color = i === 3 && step === 3 ? m.color : done ? "#15803d" : cur ? m.color : "#cbd5e1";
            return (
              <Box key={key} sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ height: 3, borderRadius: 2, bgcolor: done || cur ? color : "#e2e8f0" }} />
                <Typography noWrap sx={{ fontSize: "0.68rem", fontWeight: cur || done ? 800 : 600, color: done || cur ? color : "#94a3b8", mt: 0.35 }}>
                  {i === 3 && step === 3 ? m.label : label}
                </Typography>
              </Box>
            );
          })}
        </Stack>
      </Box>

      <DialogContent sx={{ px: { xs: 1.5, sm: 2.5 }, py: 1.75 }}>
        <Stack spacing={1.5}>
          {/* ── การ์ดสถานะ + ปุ่ม ── */}
          {banner && (
            <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${BORDER}`, borderLeft: `4px solid ${m.color}` }}>
              <Typography sx={{ fontSize: "0.9rem", fontWeight: 900, color: k === "follow_up" ? "#b91c1c" : TEXT_MAIN }}>{banner.title}</Typography>
              {banner.text && <Typography sx={{ fontSize: "0.78rem", color: TEXT_SUB, mt: 0.25 }}>{banner.text}</Typography>}
              {banner.follow && (
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "1.3fr 1fr 1fr" }, gap: 1, mt: 1.25 }}>
                  <Button variant="contained" startIcon={<EventRepeat />} onClick={goFollow}
                    sx={{ gridColumn: { xs: "1 / -1", sm: "auto" }, textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none" }}>บันทึกการติดตาม</Button>
                  <Button variant="outlined" startIcon={<CheckCircle sx={{ color: "#15803d" }} />} onClick={() => setDecision("approve")}
                    sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, color: "#334155", borderColor: BORDER, bgcolor: "#fff" }}>อนุมัติ</Button>
                  <Button variant="outlined" startIcon={<Cancel sx={{ color: "#b91c1c" }} />} onClick={() => setDecision("reject")}
                    sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, color: "#334155", borderColor: BORDER, bgcolor: "#fff" }}>ปฏิเสธ</Button>
                </Box>
              )}
              {banner.extra?.length > 0 && (
                <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
                  {banner.extra.map(([key, label, icon]) => (
                    <Button key={key} size="small" variant="outlined" startIcon={icon} onClick={() => setDecision(key)}
                      sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, color: "#334155", borderColor: BORDER }}>{label}</Button>
                  ))}
                </Stack>
              )}
            </Box>
          )}
          {/* ── ผลการตัดสินใจ ── */}
          {["approved", "rejected"].includes(k) && (
            <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${BORDER}`, borderLeft: `4px solid ${m.color}` }}>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.9rem", fontWeight: 900, color: TEXT_MAIN }}>
                    {k === "approved" ? "ลูกค้าอนุมัติใบเสนอราคา" : "ลูกค้าปฏิเสธใบเสนอราคา"}{a.quotationPoNo ? ` · PO ${a.quotationPoNo}` : ""}
                  </Typography>
                  {a.quotationDecisionNote && <Typography sx={{ fontSize: "0.82rem", color: "#334155", mt: 0.25 }}>{k === "rejected" ? "เหตุผล: " : ""}{a.quotationDecisionNote}</Typography>}
                  <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB, mt: 0.25 }}>
                    {a.quotationDecisionAt ? thaiDate(a.quotationDecisionAt) : ""}{a.quotationDecisionBy ? ` · บันทึกโดย ${a.quotationDecisionBy}` : ""}
                  </Typography>
                </Box>
                {isFinance && (
                  <Button size="small" startIcon={<Undo sx={{ fontSize: 16 }} />} onClick={async () => { setBusy(true); await onQuotation(job, { action: "reset" }); setBusy(false); }} disabled={busy}
                    sx={{ textTransform: "none", fontWeight: 700, color: TEXT_SUB, flexShrink: 0 }}>ย้อนสถานะ</Button>
                )}
              </Stack>
            </Box>
          )}

          {/* ── ไฟล์ใบเสนอราคา ── */}
          <Box sx={{ border: `1px solid ${BORDER}`, borderRadius: 2.5, bgcolor: "#fff", p: 1.5 }}>
            <FileUploadSection
              eventId={a._id} type="quotation" label="ใบเสนอราคา"
              files={a.quotationFiles} applicable={a.quotationApplicable}
              onUpload={onFileUpload} onDelete={onDeleteFile} onPreview={onPreview}
              uploading={upload.busy && upload.eventId === a._id} progress={upload.progress} currentUser={currentUser}
            />
            {open && (
              <Button size="small" startIcon={<Autorenew sx={{ fontSize: 16 }} />} onClick={() => setDecision("resend")}
                sx={{ mt: 0.5, textTransform: "none", fontWeight: 700, color: TEXT_SUB }}>ส่งฉบับแก้ไขแล้ว (เริ่มนับใหม่)</Button>
            )}
          </Box>

          {(open || (a.quotationFollowUps || []).length > 0) && (
            <FollowUpSection a={a} canFollow formRef={followRef} onPreview={onPreview} onSubmit={(payload) => onFollowUp(job, payload)} />
          )}

          {/* ── ข้อมูลใบเสนอราคา: สรุปบรรทัดเดียว กดเพื่อดู/แก้ ── */}
          <Box sx={{ border: `1px solid ${BORDER}`, borderRadius: 2.5, bgcolor: "#fff", overflow: "hidden" }}>
            <Button fullWidth onClick={() => setShowInfo((v) => !v)} endIcon={<ExpandMore sx={{ transform: showInfo ? "rotate(180deg)" : "none", transition: "transform .2s" }} />}
              sx={{ textTransform: "none", justifyContent: "space-between", px: 1.75, py: 1.1, color: TEXT_MAIN, "& .MuiButton-endIcon": { ml: 1 } }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                <RequestQuote sx={{ fontSize: 18, color: TEXT_SUB }} />
                <Typography sx={{ fontWeight: 800, fontSize: "0.88rem" }}>ข้อมูลใบเสนอราคา</Typography>
                {missingInfo(a) && <Typography noWrap sx={{ fontSize: "0.74rem", fontWeight: 700, color: "#b45309" }}>· ยังไม่ครบ</Typography>}
              </Stack>
            </Button>
            <Collapse in={showInfo} unmountOnExit>
              <Box sx={{ borderTop: `1px solid ${BORDER}` }}>
                <InfoSection a={a} isFinance={isFinance} canEdit onSave={(body) => onQuotation(job, body)} bare />
              </Box>
            </Collapse>
          </Box>

          <Section title={`คุยกับช่าง${(a.comments || []).length ? ` · ${a.comments.length}` : ""}`} icon={<Chat />}>
            <CommentThread comments={a.comments} onSend={(message) => onComment(job, message)} myRole={currentUser} />
          </Section>

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
      <DecisionDialog mode={decision} busy={busy} onClose={() => setDecision(null)} onConfirm={confirmDecision} />
    </Dialog>
  );
};

const LogRow = ({ l }) => (
  <Stack direction="row" spacing={1} alignItems="baseline">
    <Typography sx={{ fontSize: "0.72rem", color: TEXT_SUB, whiteSpace: "nowrap", minWidth: 96 }}>{formatThai(moment(l.timestamp).locale("th"), "D MMM YY HH:mm")}</Typography>
    <Typography sx={{ fontSize: "0.8rem", color: "#334155", minWidth: 0 }}>{l.detail}{l.userName ? <Box component="span" sx={{ color: TEXT_SUB }}> — {l.userName}</Box> : null}</Typography>
  </Stack>
);

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
  const [upload, setUpload] = useState({ busy: false, eventId: null, progress: 0 });
  const topRef = useRef(null);

  const toast = (msg, severity = "success") => setSnackbar({ open: true, msg, severity });
  const errMsg = (err, fallback) => err?.response?.data?.message || err?.response?.data?.err || err?.message || fallback;

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

  // ── บันทึก ──
  const onQuotation = useCallback(async (job, body) => {
    try {
      await EventService.UpdateQuotation(job.anchor._id, body);
      await fetchJobs(true);
      toast(body.action === "approve" ? "บันทึก: ลูกค้าอนุมัติแล้ว" : body.action === "reject" ? "บันทึก: ลูกค้าปฏิเสธ" : body.action === "send" ? "เริ่มนับวันติดตามแล้ว" : body.action === "reset" ? "ย้อนสถานะแล้ว" : "บันทึกข้อมูลแล้ว");
      return true;
    } catch (err) {
      toast(errMsg(err, "บันทึกไม่สำเร็จ"), "error");
      return false;
    }
  }, [fetchJobs]);
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
  }, [fetchJobs]);
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
  }, [fetchJobs, userData]);
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
  }, [fetchJobs]);
  const onDeleteFile = useCallback(async (eventId, type, fileId) => {
    try { await EventService.DeleteFile(eventId, type, fileId); toast("ลบไฟล์เรียบร้อย"); await fetchJobs(true); } catch { toast("ลบไฟล์ไม่สำเร็จ", "error"); }
  }, [fetchJobs]);

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
    <Box sx={{ px: { xs: 0, sm: 2.5 }, py: { xs: 1.25, sm: 2.5 }, maxWidth: 1500, mx: "auto" }}>
      {/* ── หัวเพจ ── */}
      <Box sx={{ borderRadius: 3, border: `1px solid ${BORDER}`, bgcolor: "#fff", px: { xs: 1.5, sm: 2 }, py: { xs: 1.25, sm: 1.5 }, mb: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2.5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#eff6ff", color: "#2563eb" }}>
            <RequestQuote />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 900, fontSize: { xs: "1.1rem", sm: "1.25rem" }, color: TEXT_MAIN, lineHeight: 1.25 }}>ติดตามใบเสนอราคา</Typography>
            <Typography noWrap sx={{ fontSize: "0.76rem", color: TEXT_SUB }}>
              แนบใบเสนอราคา + ส่งงาน → เริ่มนับเอง → ติดตาม (ทุก {WARNING_DAYS_AFTER_SENT} วัน หรือตามนัด) → อนุมัติ / ปฏิเสธ
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
          <Kpi label="อนุมัติแล้ว" value={baht(stats.approvedValue)} sub={`${stats.approvedCount} ใบ`} color="#15803d" onClick={() => setStatus("approved")} active={status === "approved"} />
          <Kpi label="อัตราปิดการขาย" value={stats.winRate === null ? "—" : `${stats.winRate}%`} sub={stats.decided ? `อนุมัติ ${stats.approvedCount} จาก ${stats.decided} ใบที่ได้คำตอบ` : "ยังไม่มีใบที่ได้คำตอบ"} color="#0f172a" />
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
            : <Stack spacing={1}>{pageRows.map((j) => <MobileCard key={j.anchor._id} job={j} onOpen={(x) => setDetailId(x.anchor._id)} />)}</Stack>}
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
