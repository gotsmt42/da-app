/**
 * OtPage — ระบบ OT (ใบขออนุมัติทำงานล่วงเวลา)
 *
 *   /ot            ใบ OT (ของฉัน · หัวหน้าเห็นทั้งหมด)
 *   /ot/approvals  รอดำเนินการ (ผู้ตรวจสอบ/ผู้อนุมัติ)
 *   /ot/report     รายงานรายเดือนสำหรับทำเงินเดือน + ปิดรอบจ่าย (ผู้ดูแลค่าจ้าง)
 *   /ot/wages      ค่าจ้างต่อชั่วโมง (ผู้ดูแลค่าจ้าง)
 *   /ot/<id>       เปิดใบนั้นทันที — ลิงก์จากแจ้งเตือน
 *
 * ✅ ผู้ใช้สั่ง (28 ก.ย. 2569): "ทำระบบเบิกโอทีด้วย ให้มืออาชีพ และสมบูรณ์"
 * ✅ โทนเรียบแบบเดียวกับระบบเบิก (ผู้ใช้เคยแจ้งว่าสีเยอะแล้วรกตา) — สีเหลือแค่ปุ่มหลักกับป้ายสถานะ
 * 🎨 (25 พ.ย. 2569 ผู้ใช้: "จัดวางข้อมูลต่างๆให้ดูง่ายใช้ง่าย" · "ทำให้สวยงามด้วย")
 *    • ตัวเลขสรุปเป็นการ์ดขนาดพอดี (เดิมยืดเต็มจอ ตัวเลขลอยห่างกัน) · ตัดกล่อง "ชั่วโมงเดือนนี้" บนหัวเพจที่ซ้ำกับการ์ดสรุป
 *    • ตัวกรองสถานะ + ช่องค้นหาอยู่แถวเดียวกัน · รายการจัดกลุ่มตามเดือนเสมอ (เลิกคอลัมน์ "เดือน" ที่ซ้ำ)
 *    • ตารางเพิ่มคอลัมน์ "วันที่ทำ OT" (เห็นว่าลงวันไหนโดยไม่ต้องเปิดใบ) · ความกว้างคอลัมน์คงที่ ไม่ยืดห่าง
 *    • รายงานรายเดือน: แยกคอลัมน์ "รอปิดรอบ / ปิดรอบแล้ว / ยังไม่อนุมัติ" + แถวรวม · ใบในรอบกดเปิดดูได้
 *    • เปิดใบจากแท็บรอดำเนินการ/รายงาน แล้วปิด = กลับแท็บเดิม (เดิมเด้งไปแท็บใบ OT)
 */
import { Children, useCallback, useEffect, useMemo, useState } from "react";
import { alpha } from "@mui/material/styles";
import { Link as RouterLink, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Box, Stack, Typography, Button, TextField, InputAdornment, Skeleton, Alert, Pagination, IconButton,
  Table, TableHead, TableRow, TableCell, TableBody, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  useMediaQuery, ButtonBase, Avatar,
} from "@mui/material";
import JobTypeChip from "@/shared/ui/JobTypeChip";
import { AddRounded as Add, AccessTimeRounded as AccessTime, SearchRounded as Search, CloseRounded as Close, ChevronLeftRounded as ChevronLeft, ChevronRightRounded as ChevronRight, TaskAltRounded as TaskAlt, InboxRounded as Inbox, AppsRounded as Apps, CalendarMonthRounded as CalendarMonth } from "@mui/icons-material";
import moment from "moment";

import usePermissions from "@/shared/hooks/usePermissions";
import useRealtime from "@/shared/realtime/useRealtime";
import { refreshAppBadges } from "@/shared/hooks/useAppBadges";
import { thaiDate } from "@/shared/utils/thaiDate";
import OtService, { errorText } from "../services/OtService";
import ViewTiles from "@/shared/ui/ViewTiles";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import OtFormDialog, { loadOtBasket } from "../components/OtFormDialog";
import { useAuth } from "@/features/auth/AuthContext";
import OtDetailDialog from "../components/OtDetailDialog";
import HoursFigure from "../components/HoursFigure";
import OtStatusBadge from "../components/OtStatusBadge";
import { useHolidays } from "../components/OtDayInfo";
import {
  OT_ACCENT, OT_ACTION, OT_ACTION_DARK, TEXT_MAIN, TEXT_SUB, BORDER_MAIN, OT_TYPES, STATUS_ORDER, otStatus, hoursText, money, periodLabel, lineJobs,
} from "../otMeta";
import { PAGE_SX } from "@/shared/ui/PageKit";
import ExportExcelButton from "@/shared/ui/ExportExcelButton";

const DARK = "#334155";
const PAGE_SIZE = 10;

const peopleCount = (r) => new Set((r.lines || []).map((l) => l.person.userId)).size;
/** ชั่วโมงแยกตามประเภท OT ของใบ → [{ type, hours }] */
const byTypeOf = (r) => OT_TYPES.map((t) => ({ t, hours: (r.lines || []).filter((l) => l.type === t.value).reduce((s, l) => s + (l.hours || 0), 0) })).filter((x) => x.hours > 0);
// 🎨 (28 พ.ย. 2569 ผู้ใช้: "การแสดงเวลารวมดูแปลกๆ มองยาก") ชื่อประเภทเต็ม ไม่ตัด "ทำงานวันห…" · ชั่วโมงชิดขวาตรงกันทุกแถว
const TypeBreakdown = ({ r }) => (
  <Box sx={{ display: "inline-grid", gridTemplateColumns: "auto auto", columnGap: 1, rowGap: 0.2, alignItems: "baseline", textAlign: "left" }}>
    {byTypeOf(r).map(({ t, hours }) => [
      <Typography key={`${t.value}-l`} noWrap sx={{ fontSize: "0.72rem", color: TEXT_SUB }}>{t.label}</Typography>,
      <Typography key={`${t.value}-h`} sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#334155", whiteSpace: "nowrap", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{hoursText(hours)}</Typography>,
    ])}
  </Box>
);
const otDays = (r) => [...new Set((r.lines || []).map((l) => moment(l.date).format("YYYY-MM-DD")))].sort();
/**
 * หัวข้อวันที่ของใบ
 * 🐛 (28 พ.ย. 2569 ผู้ใช้: "การแสดงแบบนี้จะเข้าใจผิดว่าทำงาน 10–27 ซึ่งมันกำกวม") ใช้ "วันแรก – วันสุดท้าย" เฉพาะวันที่ติดกันจริง
 *    วันไม่ติดกัน = บอกเดือน + จำนวนวัน ("ต.ค. 2569 · 3 วัน") แล้วให้ชิปบอกว่าวันไหนบ้าง
 */
const otRangeText = (days) => {
  if (!days.length) return "—";
  const [f, l] = [days[0], days[days.length - 1]];
  if (f === l) return thaiDate(f);
  const [fd, fm, fy] = thaiDate(f).split(" ");
  const [ld, lm, ly] = thaiDate(l).split(" ");
  const contiguous = moment(l).diff(moment(f), "days") === days.length - 1;
  if (contiguous) {
    if (fy !== ly) return `${fd} ${fm} ${fy} – ${ld} ${lm} ${ly} (ติดกัน ${days.length} วัน)`;
    return `${fm === lm ? `${fd} – ${ld} ${lm} ${ly}` : `${fd} ${fm} – ${ld} ${lm} ${ly}`} (ติดกัน ${days.length} วัน)`;
  }
  if (fm === lm && fy === ly) return `${fm} ${fy} · ${days.length} วัน`;
  return `${fm}${fy !== ly ? ` ${fy}` : ""} – ${lm} ${ly} · ${days.length} วัน`;
};
const DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
/**
 * วันที่ทำ OT ของใบ — 🎨 (28 พ.ย. 2569 ผู้ใช้: "กรณีที่ลงหลายวันแบบนี้จัดวางให้สวยงาม และดูได้ง่าย")
 *   เดิมเป็นข้อความยาว "4, 14, 15, 21, 22, 28, 29 พ.ย. 2569" อ่านยาก → ช่วงวันที่ตัวหนา + ชิปวันที่ (เสาร์/อาทิตย์สีอ่อนแดง)
 *   + "7 วัน · 7 รายการ" · ข้ามเดือน ชิปบอกเดือนด้วย · เกิน 12 วัน ย่อ +N
 */
const DaysCell = ({ r, compact = false }) => {
  const days = otDays(r);
  const multiMonth = new Set(days.map((d) => d.slice(0, 7))).size > 1;
  const shown = days.slice(0, compact ? 8 : 12);
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography noWrap sx={{ fontSize: compact ? "0.8rem" : "0.84rem", fontWeight: 700, color: TEXT_MAIN, lineHeight: 1.4 }}>{otRangeText(days)}</Typography>
      {days.length > 1 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: "4px", mt: 0.5 }}>
          {shown.map((d) => {
            const dow = moment(d).day();
            const off = dow === 0 || dow === 6;
            return (
              <Box key={d} component="span" title={`${DOW[dow]}. ${thaiDate(d)}`}
                sx={{ minWidth: 24, height: 22, px: 0.5, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 1,
                  fontSize: "0.7rem", fontWeight: 700, fontVariantNumeric: "tabular-nums",
                  color: off ? "#b91c1c" : "#334155", bgcolor: off ? "#fef2f2" : "#f1f5f9", border: `1px solid ${off ? "#fee2e2" : "#e2e8f0"}` }}>
                {multiMonth ? `${Number(d.slice(8))}/${Number(d.slice(5, 7))}` : Number(d.slice(8))}
              </Box>
            );
          })}
          {days.length > shown.length && <Box component="span" sx={{ fontSize: "0.7rem", fontWeight: 700, color: TEXT_SUB, alignSelf: "center" }}>+{days.length - shown.length}</Box>}
        </Box>
      )}
      <Typography sx={{ fontSize: "0.72rem", color: TEXT_SUB, mt: days.length > 1 ? 0.5 : 0 }}>{(r.lines || []).length} รายการ</Typography>
    </Box>
  );
};
/** งานที่อิง (ไม่ซ้ำ) — ประเภทงานคือคำแรกของชื่องาน ("PM · Fire Alarm · …") ใช้ทำสีชิป */
const jobsList = (r) => [...new Set((r.lines || []).flatMap((l) => lineJobs(l).map((j) => j.jobTitle)).filter(Boolean))];
const JobLine = ({ title, wrap = false }) => {
  const [type, ...rest] = String(title).split(" · ");
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
      <JobTypeChip job={{ title: type }} />
      <Typography noWrap={!wrap} sx={{ fontSize: "0.84rem", color: TEXT_MAIN, minWidth: 0, lineHeight: 1.35 }}>{rest.join(" · ") || type}</Typography>
    </Stack>
  );
};
const Jobs = ({ r, max = 2, wrap = false }) => {
  const list = jobsList(r);
  if (!list.length) return <Typography sx={{ fontSize: "0.82rem", color: TEXT_SUB }}>—</Typography>;
  return (
    <Stack spacing={0.5} sx={{ minWidth: 0 }}>
      {list.slice(0, max).map((j) => <JobLine key={j} title={j} wrap={wrap} />)}
      {list.length > max && <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>+ อีก {list.length - max} งาน</Typography>}
    </Stack>
  );
};

/** การ์ดใบ OT บนมือถือ — ผู้ยื่น + ชั่วโมงตัวใหญ่ · งานที่อิง (สีตามประเภท) · เลขที่/วันที่ + สถานะ */
const RowCard = ({ r, onOpen }) => (
  <Box role="button" onClick={() => onOpen(r._id)} sx={{ p: 1.5, bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 3, cursor: "pointer", "&:active": { bgcolor: "#f8fafc" } }}>
    <Stack direction="row" spacing={1.25} alignItems="center">
      <Avatar sx={{ width: 36, height: 36, fontSize: "0.9rem", fontWeight: 800, bgcolor: personColor(r.requester?.name), flexShrink: 0 }}>{personInitial(r.requester?.name)}</Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontWeight: 800, fontSize: "0.95rem", color: TEXT_MAIN }}>{r.requester?.name || "-"}</Typography>
        <Typography noWrap sx={{ fontSize: "0.76rem", color: TEXT_SUB }}>{r.docNo} · {thaiDate(r.docDate)}</Typography>
      </Box>
      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
        <HoursFigure hours={r.totalHours} size="1.3rem" />
        <Typography sx={{ fontSize: "0.7rem", color: TEXT_SUB, fontWeight: 700 }}>ชั่วโมงรวม</Typography>
      </Box>
    </Stack>
    <Box sx={{ mt: 1.25 }}><Jobs r={r} /></Box>
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1.25, pt: 1.25, borderTop: `1px solid ${BORDER_MAIN}` }}>
      <Box sx={{ flex: 1, minWidth: 0 }}><DaysCell r={r} compact /></Box>
      <OtStatusBadge status={r.status} short />
    </Stack>
  </Box>
);

/**
 * ตารางใบ OT (จอใหญ่) — 🎨 (25 พ.ย. 2569) ความกว้างคอลัมน์คงที่ (เดิมยืดตามจอ ตัวเลขลอยห่างจากชื่อ อ่านข้ามแถวยาก)
 *   เลขที่/ยื่นเมื่อ · ผู้ยื่น · งานที่อิง · วันที่ทำ OT · ชั่วโมง · สถานะ — เดือนอยู่บนหัวกลุ่มแล้ว จึงไม่มีคอลัมน์เดือน
 */
const RowTable = ({ rows, onOpen }) => (
  <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 3, overflowX: "auto" }}>
    <Table size="small" sx={{ minWidth: 1120, tableLayout: "fixed", "& th": { fontWeight: 800, color: TEXT_SUB, fontSize: "0.74rem", bgcolor: "#f8fafc", whiteSpace: "nowrap", py: 1, borderColor: BORDER_MAIN },
      "& td": { py: 1.25, borderColor: BORDER_MAIN, verticalAlign: "middle" }, "& tbody tr:last-of-type td": { borderBottom: 0 } }}>
      {/* 🎨 (28 พ.ย. 2569 ผู้ใช้: "จุดไหนที่ควรเด่นสำหรับเมนูนี้") ชั่วโมงคือสิ่งที่ต้องเห็นก่อน — คอลัมน์ชั่วโมงตัวใหญ่ + แยกประเภทเล็กๆ ใต้ตัวเลข
          (เดิมแยกประเภทเป็นอีกคอลัมน์ ตัดคำ "ทำงานวันห…" และตัวเลขซ้ำ 2 ที่) · สถานะกว้างพอไม่ตัดคำ */}
      <colgroup>
        <col style={{ width: 150 }} /><col style={{ width: 170 }} /><col /><col style={{ width: 190 }} /><col style={{ width: 210 }} /><col style={{ width: 150 }} />
      </colgroup>
      <TableHead>
        <TableRow>
          <TableCell>เลขที่ / ยื่นเมื่อ</TableCell><TableCell>ผู้ยื่น</TableCell><TableCell>งานที่อิง</TableCell>
          <TableCell>วันที่ทำ OT</TableCell><TableCell align="right">ชั่วโมง</TableCell><TableCell sx={{ pl: "24px !important" }}>สถานะ</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r._id} hover onClick={() => onOpen(r._id)} sx={{ cursor: "pointer" }}>
            <TableCell>
              <Typography noWrap sx={{ fontWeight: 800, fontSize: "0.86rem", color: TEXT_MAIN }}>{r.docNo}</Typography>
              <Typography noWrap sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>{thaiDate(r.docDate)}</Typography>
            </TableCell>
            <TableCell>
              <Stack direction="row" spacing={1.1} alignItems="center" sx={{ minWidth: 0 }}>
                <Avatar sx={{ width: 30, height: 30, fontSize: "0.8rem", fontWeight: 800, bgcolor: personColor(r.requester?.name), flexShrink: 0 }}>{personInitial(r.requester?.name)}</Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography noWrap sx={{ fontWeight: 700, fontSize: "0.86rem" }}>{r.requester?.name}</Typography>
                  {peopleCount(r) > 1 && <Typography sx={{ fontSize: "0.72rem", color: TEXT_SUB }}>{peopleCount(r)} คน</Typography>}
                </Box>
              </Stack>
            </TableCell>
            <TableCell sx={{ minWidth: 0 }}><Jobs r={r} wrap /></TableCell>
            <TableCell>
              <DaysCell r={r} />
            </TableCell>
            <TableCell align="right">
              <HoursFigure hours={r.totalHours} size="1.15rem" />
              {byTypeOf(r).length > 1 && <Box sx={{ mt: 0.4 }}><TypeBreakdown r={r} /></Box>}
              {byTypeOf(r).length === 1 && <Typography sx={{ fontSize: "0.72rem", color: TEXT_SUB }}>{byTypeOf(r)[0].t.label}</Typography>}
            </TableCell>
            <TableCell sx={{ pl: "24px !important" }}><OtStatusBadge status={r.status} short /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </Box>
);

/** เดือนของใบ (รอบ OT) — ✅ ผู้ใช้: "ให้แสดงเดือนตรงรายการให้ชัดเจน ไม่ต้องแยกค้นหาข้างบน" */
const monthOf = (r) => r.period || moment(r.docDate).format("YYYY-MM");
/**
 * 🎨 (25 พ.ย. 2569 ผู้ใช้: "จัดวางให้สวยงาม สมบูรณ์" · "สีสันไม่ต้องรก")
 * แถบตัวเลขสรุปเป็นการ์ดเดียวเต็มแถว แบ่งช่องด้วยเส้นบาง (เดิมการ์ดแยกกว้างไม่เท่ากัน เหลือที่ว่างครึ่งจอ)
 * สีเหลือแค่จุดเล็กหน้าหัวข้อ
 */
const Stat = ({ label, value, unit, hours, tone, hint }) => (
  <Box sx={{ minWidth: 0, px: { xs: 1.5, sm: 2 }, py: 1.4 }}>
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
      {tone && <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: tone, flexShrink: 0 }} />}
      <Typography sx={{ fontSize: "0.76rem", color: TEXT_SUB, fontWeight: 700 }} noWrap>{label}</Typography>
    </Stack>
    {hours != null ? (
      // ✅ ชั่วโมง = ตัวเลข + หน่วยเล็กทุกส่วน ("54 ชม. 30 น.") — เดิมขึ้น "54 30 น. ชม."
      <Box sx={{ mt: 0.25 }}><HoursFigure hours={hours} size="1.45rem" muted={!hours} /></Box>
    ) : (
      <Typography sx={{ fontWeight: 900, fontSize: "1.45rem", color: TEXT_MAIN, lineHeight: 1.25, mt: 0.25 }} noWrap>
        {value}<Box component="span" sx={{ fontSize: "0.8rem", color: TEXT_SUB, fontWeight: 600, ml: 0.5 }}>{unit}</Box>
      </Typography>
    )}
    {hint && <Typography sx={{ fontSize: "0.7rem", color: TEXT_SUB }} noWrap>{hint}</Typography>}
  </Box>
);
const StatRow = ({ children, sx }) => {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: `repeat(${items.length}, minmax(0, 1fr))` },
      bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 3, overflow: "hidden", mb: 1.5, ...sx }}>
      {items.map((c, i) => (
        <Box key={i} sx={{ minWidth: 0, borderLeft: { xs: i % 2 ? `1px solid ${BORDER_MAIN}` : 0, md: i ? `1px solid ${BORDER_MAIN}` : 0 }, borderTop: { xs: i >= 2 ? `1px solid ${BORDER_MAIN}` : 0, md: 0 } }}>{c}</Box>
      ))}
    </Box>
  );
};

/** ปุ่มหลักของเมนู — น้ำเงินระบบ พื้นเรียบ (ธีมมือถือใส่ไล่สีให้ปุ่ม contained — ปิดไว้ให้เหมือนทุกจอ) */
const PRIMARY_SX = {
  flexShrink: 0, textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", whiteSpace: "nowrap",
  bgcolor: OT_ACTION, backgroundImage: "none", "&:hover": { bgcolor: OT_ACTION_DARK, backgroundImage: "none", boxShadow: "none" },
};

/** ── รายงานรายเดือน + ปิดรอบจ่าย ─────────────────────────────────────── */
const ReportView = ({ reloadKey, canClose, onOpen, isDesktop = true }) => {
  const [period, setPeriod] = useState(moment().format("YYYY-MM"));
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [closing, setClosing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [toast, setToast] = useState("");
  const load = useCallback(() => {
    setError("");
    OtService.report(period).then(setData).catch((err) => setError(errorText(err, "โหลดรายงานไม่สำเร็จ")));
  }, [period]);
  useEffect(() => { setData(null); load(); }, [load, reloadKey]);
  const shift = (n) => setPeriod((p) => moment(`${p}-01`).add(n, "month").format("YYYY-MM"));
  const sum = (f) => money((data?.people || []).reduce((s, p) => s + f(p), 0));

  const doClose = async () => {
    setClosing(true);
    try {
      const r = await OtService.closePayroll(period);
      setToast(`ปิดรอบแล้ว ${r.closed} ใบ — ส่งชั่วโมง OT ให้ฝ่ายบุคคล/บัญชีแล้ว`);
      setConfirm(false);
      load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setClosing(false);
    }
  };

  return (
    <Box sx={{ pt: 1 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5, flexWrap: "wrap", rowGap: 1 }}>
        <IconButton size="small" onClick={() => shift(-1)} sx={{ border: `1px solid ${BORDER_MAIN}`, bgcolor: "#fff" }}><ChevronLeft /></IconButton>
        <Typography sx={{ fontWeight: 900, fontSize: "1.05rem", minWidth: 110, textAlign: "center" }}>{periodLabel(period)}</Typography>
        <IconButton size="small" onClick={() => shift(1)} sx={{ border: `1px solid ${BORDER_MAIN}`, bgcolor: "#fff" }}><ChevronRight /></IconButton>
        <Box sx={{ flex: 1 }} />
        <ExportExcelButton disabled={!data?.people?.length}
          onClick={async () => { const { exportOtReport } = await import("../utils/otExcelExport"); exportOtReport(data); }} />
        {canClose && (
          <Button variant="contained" startIcon={<TaskAlt />} disabled={!data?.approvedCount} onClick={() => setConfirm(true)}
            sx={PRIMARY_SX}>
            ปิดรอบ{data?.approvedCount ? ` (${data.approvedCount} ใบ)` : ""}
          </Button>
        )}
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError("")}>{error}</Alert>}
      {toast && <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setToast("")}>{toast}</Alert>}
      {!data ? <Skeleton variant="rounded" height={240} /> : (
        <>
          <StatRow>
            {/* 🎨 (28 พ.ย. 2569 ผู้ใช้: "หน้ามือถือ ให้ดูง่าย ข้อมูลไม่รก") มือถือ 4 ช่อง 2×2 (จำนวนคนบอกในรายชื่อด้านล่าง) */}
            {isDesktop && <Stat label="พนักงานที่มี OT" value={data.people.length} unit="คน" tone={OT_ACTION} />}
            <Stat label="ชั่วโมงที่อนุมัติแล้ว" hours={sum((p) => p.approved.hours + p.paid.hours)} tone="#16a34a" />
            <Stat label="รอปิดรอบ" hours={sum((p) => p.approved.hours)} tone="#d97706" hint={data.approvedCount ? `${data.approvedCount} ใบ พร้อมปิดรอบ` : "ไม่มีใบรอปิดรอบ"} />
            <Stat label="ปิดรอบแล้ว" hours={sum((p) => p.paid.hours)} tone="#64748b" />
            <Stat label="ยังไม่ผ่านอนุมัติ" hours={sum((p) => p.waiting.hours)} tone="#94a3b8" hint="ไม่นับในรอบนี้จนกว่าจะอนุมัติ" />
          </StatRow>
          {!data.people.length ? (
            <Stack alignItems="center" sx={{ py: 6, bgcolor: "#fff", border: `1px dashed ${BORDER_MAIN}`, borderRadius: 2.5 }}>
              <Inbox sx={{ fontSize: 40, color: "#cbd5e1" }} />
              <Typography sx={{ color: TEXT_SUB, fontWeight: 700 }}>ไม่มี OT ในรอบนี้</Typography>
            </Stack>
          ) : !isDesktop ? (
            /* มือถือ: การ์ดรายคน — ชั่วโมงอนุมัติรวมตัวใหญ่ · แยกประเภทเฉพาะที่มี · รอปิดรอบ/ปิดรอบแล้ว/ยังไม่อนุมัติ บรรทัดล่าง (เดิมตารางกว้าง หัวคอลัมน์ทับกัน) */
            <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 3, overflow: "hidden" }}>
              <Stack direction="row" alignItems="center" sx={{ px: 1.5, py: 1, bgcolor: "#f8fafc", borderBottom: `1px solid ${BORDER_MAIN}` }}>
                <Typography sx={{ flex: 1, fontSize: "0.8rem", fontWeight: 800, color: TEXT_SUB }}>พนักงาน {data.people.length} คน</Typography>
                <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: TEXT_SUB }}>อนุมัติแล้ว</Typography>
              </Stack>
              {data.people.map((p, i) => {
                const types = OT_TYPES.map((t) => ({ t, v: p.approved.byType[t.value]?.hours || 0 })).filter((x) => x.v > 0);
                const extra = [
                  p.approved.hours ? { k: "รอปิดรอบ", v: p.approved.hours, c: "#b45309" } : null,
                  p.paid.hours ? { k: "ปิดรอบแล้ว", v: p.paid.hours, c: TEXT_SUB } : null,
                  p.waiting.hours ? { k: "ยังไม่อนุมัติ", v: p.waiting.hours, c: "#94a3b8" } : null,
                ].filter(Boolean);
                return (
                  <Box key={p.userId} sx={{ px: 1.5, py: 1.25, borderTop: i ? `1px solid ${BORDER_MAIN}` : 0 }}>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Avatar sx={{ width: 32, height: 32, fontSize: "0.8rem", fontWeight: 800, bgcolor: personColor(p.name), flexShrink: 0 }}>{personInitial(p.name)}</Avatar>
                      <Typography noWrap sx={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: "0.9rem" }}>{p.name}</Typography>
                      <HoursFigure hours={p.approved.hours + p.paid.hours} size="1.15rem" muted={!(p.approved.hours + p.paid.hours)} />
                    </Stack>
                    {(types.length > 0 || extra.length > 0) && (
                      <Stack direction="row" spacing={1.5} useFlexGap sx={{ mt: 0.75, pl: 5.5, flexWrap: "wrap", rowGap: 0.4 }}>
                        {types.map(({ t, v }) => (
                          <Typography key={t.value} sx={{ fontSize: "0.74rem", color: TEXT_SUB, display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                            <Box component="span" sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: t.color }} />{t.label} <b style={{ color: TEXT_MAIN }}>{hoursText(v)}</b>
                          </Typography>
                        ))}
                        {extra.map((x) => (
                          <Typography key={x.k} sx={{ fontSize: "0.74rem", color: x.c }}>{x.k} <b>{hoursText(x.v)}</b></Typography>
                        ))}
                      </Stack>
                    )}
                  </Box>
                );
              })}
            </Box>
          ) : (
            <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 3, overflowX: "auto" }}>
              <Table size="small" sx={{ minWidth: 880, tableLayout: "fixed", "& th": { fontWeight: 800, color: TEXT_SUB, fontSize: "0.74rem", bgcolor: "#f8fafc", whiteSpace: "nowrap", py: 1 },
                "& td": { borderColor: BORDER_MAIN, py: 1.1, whiteSpace: "nowrap" }, "& th.grp": { color: "#334155", borderBottom: `2px solid ${BORDER_MAIN}` } }}>
                <colgroup>
                  <col style={{ width: 220 }} />{OT_TYPES.map((t) => <col key={t.value} />)}<col style={{ width: 120 }} /><col style={{ width: 120 }} /><col style={{ width: 120 }} /><col style={{ width: 130 }} />
                </colgroup>
                <TableHead>
                  <TableRow>
                    <TableCell rowSpan={2}>พนักงาน</TableCell>
                    <TableCell className="grp" colSpan={OT_TYPES.length} align="center">ชั่วโมงที่อนุมัติแล้ว แยกตามประเภท</TableCell>
                    <TableCell rowSpan={2} align="right">รวมอนุมัติ</TableCell>
                    <TableCell rowSpan={2} align="right">รอปิดรอบ</TableCell>
                    <TableCell rowSpan={2} align="right">ปิดรอบแล้ว</TableCell>
                    <TableCell rowSpan={2} align="right">ยังไม่อนุมัติ</TableCell>
                  </TableRow>
                  <TableRow>
                    {OT_TYPES.map((t) => (
                      <TableCell key={t.value} align="right">
                        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
                          <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: t.color }} /><span>{t.label}</span>
                        </Stack>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.people.map((p) => (
                    <TableRow key={p.userId} hover>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                          <Avatar sx={{ width: 28, height: 28, fontSize: "0.76rem", fontWeight: 800, bgcolor: personColor(p.name), flexShrink: 0 }}>{personInitial(p.name)}</Avatar>
                          <Typography noWrap sx={{ fontWeight: 700, fontSize: "0.86rem", minWidth: 0 }}>{p.name}</Typography>
                        </Stack>
                      </TableCell>
                      {OT_TYPES.map((t) => {
                        // ⚠️ server รวม "อนุมัติแล้ว + ปิดรอบแล้ว" ไว้ใน approved.byType อยู่แล้ว (routes/ot.js /report) — ห้ามบวก paid ซ้ำ
                        const v = p.approved.byType[t.value]?.hours || 0;
                        return <TableCell key={t.value} align="right" sx={{ color: v ? TEXT_MAIN : "#cbd5e1" }}>{v ? hoursText(v) : "—"}</TableCell>;
                      })}
                      <TableCell align="right" sx={{ fontWeight: 900, fontSize: "0.92rem" }}>{hoursText(p.approved.hours + p.paid.hours)}</TableCell>
                      <TableCell align="right" sx={{ color: p.approved.hours ? "#b45309" : "#cbd5e1", fontWeight: p.approved.hours ? 800 : 400 }}>{p.approved.hours ? hoursText(p.approved.hours) : "—"}</TableCell>
                      <TableCell align="right" sx={{ color: p.paid.hours ? TEXT_SUB : "#cbd5e1" }}>{p.paid.hours ? hoursText(p.paid.hours) : "—"}</TableCell>
                      <TableCell align="right" sx={{ color: p.waiting.hours ? TEXT_SUB : "#cbd5e1" }}>{p.waiting.hours ? hoursText(p.waiting.hours) : "—"}</TableCell>
                    </TableRow>
                  ))}
                  {data.people.length > 1 && (
                    <TableRow sx={{ "& td": { bgcolor: "#f8fafc", fontWeight: 900, borderBottom: 0 } }}>
                      <TableCell>รวมทั้งหมด</TableCell>
                      {OT_TYPES.map((t) => {
                        const v = sum((p) => p.approved.byType[t.value]?.hours || 0);
                        return <TableCell key={t.value} align="right">{v ? hoursText(v) : "—"}</TableCell>;
                      })}
                      <TableCell align="right">{hoursText(sum((p) => p.approved.hours + p.paid.hours))}</TableCell>
                      <TableCell align="right">{hoursText(sum((p) => p.approved.hours))}</TableCell>
                      <TableCell align="right">{hoursText(sum((p) => p.paid.hours))}</TableCell>
                      <TableCell align="right">{hoursText(sum((p) => p.waiting.hours))}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
          )}
          {data.docs.length > 0 && (
            <Box sx={{ mt: 1.5 }}>
              <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: TEXT_SUB, mb: 0.75 }}>ใบในรอบนี้ ({data.docs.length}) — กดเพื่อเปิดดู</Typography>
              <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap", rowGap: 0.75 }}>
                {data.docs.map((d) => {
                  const st = otStatus(d.status);
                  return (
                    <ButtonBase key={d._id || d.docNo} onClick={() => d._id && onOpen?.(d._id)} sx={{
                      gap: 0.75, px: 1.1, py: 0.6, borderRadius: 2, fontFamily: "inherit", bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`,
                      "&:hover": { borderColor: OT_ACTION, bgcolor: alpha(OT_ACTION, 0.04) },
                    }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: st.color }} />
                      <Typography component="span" sx={{ fontSize: "0.8rem", fontWeight: 800, color: TEXT_MAIN }}>{d.docNo}</Typography>
                      <Typography component="span" sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>{d.requester?.name || ""} · {hoursText(d.totalHours)} · {st.short || st.label}</Typography>
                    </ButtonBase>
                  );
                })}
              </Stack>
            </Box>
          )}
        </>
      )}
      <Dialog open={confirm} onClose={() => !closing && setConfirm(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 800 }}>ปิดรอบ OT · {periodLabel(period)}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: TEXT_SUB }}>
            ใบที่อนุมัติแล้ว {data?.approvedCount || 0} ใบ รวม {hoursText(sum((p) => p.approved.hours))} จะถูกบันทึกว่า “ปิดรอบแล้ว” (ส่งชั่วโมงให้ฝ่ายบุคคล/บัญชี) และแจ้งพนักงาน —
            ใบที่ยังไม่อนุมัติจะไม่ถูกแตะ
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirm(false)} disabled={closing} sx={{ textTransform: "none", color: TEXT_SUB }}>ยกเลิก</Button>
          <Button variant="contained" onClick={doClose} disabled={closing} startIcon={closing ? <CircularProgress size={15} color="inherit" /> : <TaskAlt />}
            sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: OT_ACCENT }}>ยืนยันปิดรอบ</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default function OtPage({ view: viewProp = "mine" }) {
  const { can } = usePermissions();
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // ✅ เปิดใบจากแท็บรอดำเนินการ/รายงาน (/ot/<id>) — ข้างหลังยังเป็นแท็บเดิม ปิดแล้วกลับแท็บเดิม
  const view = routeId ? (location.state?.fromView || viewProp) : viewProp;
  const isDesktop = useMediaQuery("(min-width:900px)");
  const canUse = can("requestExpense") || can("viewAllExpenses");
  const canHandle = can("reviewExpense") || can("approveExpense");
  const canMoney = can("viewAllExpenses");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ open: false, request: null });
  const [detailId, setDetailId] = useState(routeId || "");
  const [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState(false);
  // รายการ OT รอส่ง (เพิ่มจากหน้างาน) — ปุ่มบอกจำนวน · อ่านใหม่ทุกครั้งที่ปิดฟอร์ม
  const { userData } = useAuth();
  const [basketN, setBasketN] = useState(0);
  useEffect(() => { if (!form.open) setBasketN(loadOtBasket(String(userData?.userId || "")).length); }, [form.open, userData?.userId]);
  const holidays = useHolidays(null);

  useEffect(() => { if (routeId) setDetailId(routeId); }, [routeId]);
  const refresh = useCallback(() => { setReloadKey((k) => k + 1); refreshAppBadges(); }, []);
  useRealtime("ot", () => setReloadKey((k) => k + 1));

  useEffect(() => {
    if (!canUse || view === "report" || view === "wages") return undefined;
    let alive = true;
    OtService.list(view === "inbox" ? { status: "pending,reviewed" } : {})
      .then((r) => alive && setRows(r)).catch((err) => alive && setError(errorText(err, "โหลดรายการไม่สำเร็จ")))
      .finally(() => alive && setLoading(false));
    OtService.summary().then((s) => alive && setSummary(s)).catch(() => {});
    return () => { alive = false; };
  }, [view, reloadKey, canUse]);
  useEffect(() => { setPage(1); }, [status, q, view]);

  const base = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => !needle || [r.docNo, r.subject, r.requester?.name, ...(r.lines || []).map((l) => l.person.name)]
      .some((v) => String(v || "").toLowerCase().includes(needle)));
  }, [rows, q]);
  const liveHours = (list) => list.filter((r) => !["cancelled", "rejected"].includes(r.status)).reduce((t, r) => t + (r.totalHours || 0), 0);
  /**
   * ✅ (28 พ.ย. 2569 ผู้ใช้: "ตัวไหนปิดรอบแล้วให้แยกออกไปเลย ไม่ต้องมาแสดงหน้าแรกให้ดูงง" · "ให้แสดงแค่เดือนที่แล้วกับเดือนนี้พอ")
   *    แท็บ "ใบ OT" = ใบเดือนนี้ + เดือนที่แล้ว ที่ยังไม่ปิดรอบ (สิ่งที่ต้องติดตาม)
   *    แท็บ "ย้อนหลัง / ปิดรอบแล้ว" = ที่เหลือทั้งหมด (ปิดรอบแล้วทุกเดือน + ใบที่เก่ากว่าเดือนที่แล้ว) — ไม่มีใบไหนหายไป
   *    ตัวเลขสรุปชั่วโมงของเดือนนี้ยังนับจากทุกใบ (base) — ใบปิดรอบก็เป็นชั่วโมงที่อนุมัติของเดือนนั้น
   *    ⚠️ ใบรอตรวจ/รออนุมัติที่เก่ากว่านั้น ผู้ตรวจ/ผู้อนุมัติยังเห็นครบในแท็บ "รอดำเนินการ" (ไม่จำกัดเดือน)
   */
  const recentFrom = moment().subtract(1, "month").format("YYYY-MM");
  const isHistory = (r) => r.status === "paid" || monthOf(r) < recentFrom;
  const scoped = useMemo(() => (view === "closed" ? base.filter(isHistory) : view === "mine" ? base.filter((r) => !isHistory(r)) : base),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, view, recentFrom]);
  const closedCount = useMemo(() => rows.filter(isHistory).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, recentFrom]);
  const historyMatches = view === "mine" && q.trim() ? base.filter(isHistory).length : 0;
  const monthList = useMemo(() => {
    const m = new Map();
    scoped.forEach((r) => { const k = monthOf(r); m.set(k, [...(m.get(k) || []), r]); });
    return [...m.entries()].sort((x, y) => y[0].localeCompare(x[0]));
  }, [scoped]);
  const thisMonth = moment().format("YYYY-MM");
  const inMonth = scoped;
  const counts = useMemo(() => inMonth.reduce((c, r) => ({ ...c, [r.status]: (c[r.status] || 0) + 1 }), {}), [inMonth]);
  const visible = status === "all" || view !== "mine" ? inMonth : inMonth.filter((r) => r.status === status);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const cur = Math.min(page, pageCount);
  const pageRows = visible.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);

  // ✅ (27 ต.ค. 2569 ผู้ใช้: "หน้า OT ให้ Export Excel ได้ด้วยให้ครบถ้วน") — ส่งออกตามที่เห็น (ค้นหา/สถานะที่เลือก)
  const exportExcel = async () => {
    setExporting(true);
    try {
      const { exportOtList } = await import("../utils/otExcelExport");
      await exportOtList({ requests: visible, holidays, scopeLabel: [status === "all" ? "ทุกสถานะ" : otStatus(status).label, q.trim() ? `ค้นหา “${q.trim()}”` : ""].filter(Boolean).join(" · ") });
    } catch (err) {
      setError(errorText(err, "ส่งออก Excel ไม่สำเร็จ"));
    } finally {
      setExporting(false);
    }
  };

  if (!canUse) return <Navigate to="/dashboard" replace />;
  if (view === "wages") return <Navigate to="/ot" replace />;
  if (view === "report" && !canMoney) return <Navigate to="/ot" replace />;
  if (view === "inbox" && !canHandle) return <Navigate to="/ot" replace />;

  const openDetail = (id) => { setDetailId(id); navigate(`/ot/${id}`, { replace: Boolean(routeId), state: { fromView: view } }); };
  const closeDetail = () => {
    setDetailId(""); setNotice("");
    if (routeId) navigate({ inbox: "/ot/approvals", closed: "/ot/closed", report: "/ot/report", wages: "/ot/wages" }[view] || "/ot", { replace: true });
  };

  const tabs = [
    // 🎨 (28 พ.ย. 2569 ผู้ใช้: "หน้ามือถือ ทำให้ดูง่าย ข้อมูลไม่รก") มือถือใช้ชื่อสั้น — แท็บอยู่ในจอเดียวไม่ต้องเลื่อน
    { to: "/ot", label: "ใบ OT", key: "mine" },
    ...(canHandle ? [{ to: "/ot/approvals", label: "รอดำเนินการ", short: "รอดำเนินการ", count: summary?.inbox || 0, key: "inbox" }] : []),
    { to: "/ot/closed", label: "ย้อนหลัง / ปิดรอบแล้ว", short: "ย้อนหลัง", key: "closed" },
    // 🔁 (27 ต.ค. 2569) ไม่มีเรื่องเงินในระบบ OT — เหลือรายงานชั่วโมงรายเดือน (เลิกหน้า "ค่าจ้างต่อชั่วโมง")
    ...(canMoney ? [{ to: "/ot/report", label: "รายงานชั่วโมงรายเดือน", short: "รายงาน", key: "report" }] : []),
  ];

  const inboxGroups = view === "inbox" ? [
    ...(can("reviewExpense") ? [{ key: "pending", title: "รอตรวจสอบ", rows: base.filter((r) => r.status === "pending") }] : []),
    ...(can("approveExpense") ? [{ key: "reviewed", title: "รออนุมัติ", rows: base.filter((r) => r.status === "reviewed") }] : []),
  ].filter((g) => g.rows.length) : [];

  const renderRows = (list) => (isDesktop ? <RowTable rows={list} onOpen={openDetail} /> : <Stack spacing={1}>{list.map((r) => <RowCard key={r._id} r={r} onOpen={openDetail} />)}</Stack>);

  return (
    <Box sx={PAGE_SX}>
      {/* 🎨 (27 ต.ค. 2569 ผู้ใช้: "UX UI ดูยาก ไม่สวย ไม่ทันสมัย สีไม่เหมือน advance") หัวเพจ + แถบเมนูแบบเดียวกับหน้าใบ Advance */}
      <Box sx={{ borderRadius: 3, border: `1px solid ${BORDER_MAIN}`, bgcolor: "#fff", px: { xs: 1.5, sm: 2 }, py: { xs: 1.25, sm: 1.75 }, mb: 1.5 }}>
        {/* 🎨 (28 พ.ย. 2569 ผู้ใช้: "การจัดวางจุดต่างๆ สีสันที่ใช้ ยังมองยาก…สวยงามมืออาชีพ")
            ชื่อเมนู · Excel อยู่แถวเดียวกัน (มือถือเดิม Excel ลอยอยู่แถวของตัวเอง) · ปุ่มหลัก "ยื่นขอ OT" สีน้ำเงินระบบปุ่มเดียวที่เด่น */}
        <Stack direction="row" alignItems="center" spacing={{ xs: 1, sm: 2 }}>
          <Stack direction="row" alignItems="center" spacing={{ xs: 1.25, sm: 1.5 }} sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ width: { xs: 36, sm: 40 }, height: { xs: 36, sm: 40 }, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: alpha(OT_ACCENT, 0.12), color: OT_ACCENT, "& svg": { fontSize: { xs: 20, sm: 22 }, filter: "drop-shadow(0 2px 3px rgba(17,24,39,.15))" } }}>
              <AccessTime />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: { xs: "1.08rem", sm: "1.2rem" }, color: TEXT_MAIN, lineHeight: 1.3 }}>OT · ทำงานล่วงเวลา</Typography>
              <Typography variant="caption" sx={{ color: TEXT_SUB, display: { xs: "none", sm: "block" }, lineHeight: 1.35 }}>
                พนักงานกรอกชั่วโมง OT ของตัวเอง อิงงาน · แอดมินตรวจสอบ → อนุมัติ
              </Typography>
            </Box>
          </Stack>
          {view !== "report" && (
            <ExportExcelButton onClick={exportExcel} loading={exporting} disabled={loading || !visible.length} count={visible.length} />
          )}
          <Button variant="contained" startIcon={<Add />} onClick={() => setForm({ open: true, request: null })}
            sx={{ ...PRIMARY_SX, display: { xs: "none", sm: "inline-flex" } }}>
            {basketN ? `ฉบับร่าง OT (${basketN})` : "ยื่นขอ OT"}
          </Button>
        </Stack>
        <Button fullWidth variant="contained" startIcon={<Add />} onClick={() => setForm({ open: true, request: null })}
          sx={{ ...PRIMARY_SX, display: { xs: "flex", sm: "none" }, mt: 1.25, height: 42 }}>
          {basketN ? `ฉบับร่าง OT (${basketN})` : "ยื่นขอ OT"}
        </Button>
        <Box component="nav" aria-label="เมนู OT"
          sx={{ display: "flex", gap: { xs: 0.25, sm: 0.5 }, mt: { xs: 1.25, sm: 1.5 }, mb: { xs: -1.25, sm: -1.75 }, mx: { xs: -1.5, sm: -2 }, px: { xs: 1, sm: 1.5 },
            borderTop: `1px solid ${BORDER_MAIN}`, overflowX: "auto", "&::-webkit-scrollbar": { display: "none" }, scrollbarWidth: "none" }}>
          {tabs.map((t) => {
            const on = view === t.key;
            return (
              <ButtonBase key={t.key} component={RouterLink} to={t.to} aria-current={on ? "page" : undefined}
                sx={{ flexShrink: 0, gap: 0.75, px: { xs: 1.25, sm: 1.5 }, py: 1.1, fontFamily: "inherit", whiteSpace: "nowrap", fontSize: "0.84rem", fontWeight: on ? 800 : 600,
                  color: on ? OT_ACTION : TEXT_SUB, borderBottom: `2px solid ${on ? OT_ACTION : "transparent"}`, mb: "-1px", "&:hover": { color: on ? OT_ACTION : TEXT_MAIN } }}>
                {isDesktop ? t.label : t.short || t.label}
                {t.count > 0 && (
                  <Box component="span" sx={{ minWidth: 20, height: 20, px: 0.6, borderRadius: 99, display: "inline-flex", alignItems: "center", justifyContent: "center",
                    bgcolor: "#fef3c7", color: "#92400e", fontSize: "0.7rem", fontWeight: 800 }}>{t.count}</Box>
                )}
              </ButtonBase>
            );
          })}
        </Box>
      </Box>

      {view === "report" && <ReportView reloadKey={reloadKey} canClose={can("disburseExpense")} onOpen={openDetail} isDesktop={isDesktop} />}

      {(view === "mine" || view === "inbox" || view === "closed") && (
        <>
          {view === "mine" && (monthList.length > 0 || closedCount > 0) && (
            <StatRow>
              <Stat label={isDesktop ? `ยื่นแล้ว · ${periodLabel(thisMonth)}` : "ยื่นแล้ว · เดือนนี้"} hours={liveHours(base.filter((r) => monthOf(r) === thisMonth))} tone={OT_ACTION} hint="ไม่นับใบที่ยกเลิก/ตีกลับ" />
              {isDesktop && <Stat label={`อนุมัติแล้ว · ${periodLabel(thisMonth)}`} hours={liveHours(base.filter((r) => monthOf(r) === thisMonth).filter((r) => ["approved", "paid"].includes(r.status)))} tone="#16a34a" hint="รวมใบที่ปิดรอบแล้ว" />}
              <Stat label={isDesktop ? "รอตรวจสอบ / อนุมัติ" : "รอตรวจ/อนุมัติ"} hours={liveHours(inMonth.filter((r) => ["pending", "reviewed"].includes(r.status)))} tone="#d97706" hint={`${(counts.pending || 0) + (counts.reviewed || 0)} ใบ`} />
              {(counts.rejected || 0) > 0
                ? <Stat label="ถูกตีกลับ · ต้องแก้" value={counts.rejected} unit="ใบ" tone="#dc2626" hint="เปิดใบแล้วกดแก้ไข/ส่งใหม่" />
                : isDesktop && <Stat label="ใบ OT · 2 เดือนล่าสุด" value={inMonth.length} unit="ใบ" tone="#94a3b8" hint={closedCount ? `ย้อนหลัง / ปิดรอบแล้ว ${closedCount} ใบ แยกไว้อีกแท็บ` : "เดือนนี้ + เดือนที่แล้ว"} />}
            </StatRow>
          )}
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} alignItems={{ md: "center" }} sx={{ mb: 1.5 }}>
            {view === "mine" && !isDesktop && (
              <Stack direction="row" spacing={0.75} sx={{ overflowX: "auto", pb: 0.25, "&::-webkit-scrollbar": { display: "none" }, scrollbarWidth: "none" }}>
                {[{ value: "all", label: "ทั้งหมด", count: inMonth.length, color: "#475569" },
                  ...STATUS_ORDER.filter((st) => st === status || (counts[st] || 0) > 0).map((st) => ({ value: st, label: otStatus(st).short || otStatus(st).label, count: counts[st] || 0, color: otStatus(st).color }))]
                  .map((o) => {
                    const on = status === o.value;
                    return (
                      <ButtonBase key={o.value} onClick={() => setStatus(o.value)} aria-pressed={on}
                        sx={{ flexShrink: 0, gap: 0.75, height: 34, px: 1.5, borderRadius: 99, fontFamily: "inherit", fontSize: "0.8rem", fontWeight: on ? 800 : 600,
                          color: on ? OT_ACTION : "#334155", bgcolor: on ? "#eff6ff" : "#fff", border: `1px solid ${on ? "#bfdbfe" : BORDER_MAIN}` }}>
                        {o.value !== "all" && <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: o.color }} />}
                        {o.label}
                        <Box component="span" sx={{ fontWeight: 800, color: on ? OT_ACTION : TEXT_SUB, fontVariantNumeric: "tabular-nums" }}>{o.count}</Box>
                      </ButtonBase>
                    );
                  })}
              </Stack>
            )}
            {view === "mine" && isDesktop && (
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <ViewTiles compact value={status} onChange={setStatus} isMobile={!isDesktop} groups={[{ title: "", items: [
                  { value: "all", label: "ทุกสถานะ", count: inMonth.length, unit: "ใบ", icon: <Apps />, color: "#475569" },
                  ...STATUS_ORDER.filter((st) => st === status || (counts[st] || 0) > 0).map((st) => ({
                    value: st, label: otStatus(st).label, shortLabel: otStatus(st).short || otStatus(st).label, count: counts[st] || 0, unit: "ใบ",
                    icon: <Box component="span" sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: otStatus(st).color, display: "inline-block" }} />,
                    color: otStatus(st).color, alert: st === "rejected",
                  })),
                ] }]} />
              </Box>
            )}
            <TextField size="small" placeholder="ค้นหาเลขที่ / เรื่อง / ชื่อพนักงาน" value={q} onChange={(e) => setQ(e.target.value)}
              sx={{ width: { xs: "100%", md: view === "mine" ? 320 : "100%" }, flexShrink: 0, bgcolor: "#fff", "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 19, color: TEXT_SUB }} /></InputAdornment>,
                endAdornment: q ? <InputAdornment position="end"><IconButton size="small" onClick={() => setQ("")}><Close sx={{ fontSize: 17 }} /></IconButton></InputAdornment> : null,
              }} />
          </Stack>
          {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
          {loading ? <Stack spacing={1}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={isDesktop ? 52 : 96} />)}</Stack>
            : view === "inbox" ? (
              inboxGroups.length ? (
                <Stack spacing={2.5}>
                  {inboxGroups.map((g) => (
                    <Box key={g.key}>
                      {/* หัวกลุ่มแบบเดียวกับหัวเดือน — จุดสีสถานะ · ชื่อ · จำนวนใบ · เส้น · ชั่วโมงรวม */}
                      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1 }}>
                        <Stack direction="row" spacing={0.9} alignItems="center">
                          <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: otStatus(g.key).color }} />
                          <Typography sx={{ fontWeight: 900, fontSize: "1.02rem", color: TEXT_MAIN }}>{g.title}</Typography>
                          <Box component="span" sx={{ px: 0.8, height: 20, display: "inline-flex", alignItems: "center", borderRadius: 99, bgcolor: "#f1f5f9", color: "#334155", fontSize: "0.72rem", fontWeight: 800 }}>{g.rows.length} ใบ</Box>
                        </Stack>
                        <Box sx={{ flex: 1, height: 1, bgcolor: BORDER_MAIN }} />
                        <Typography sx={{ fontSize: "0.8rem", color: TEXT_SUB, fontWeight: 700, whiteSpace: "nowrap" }}>{hoursText(liveHours(g.rows))}</Typography>
                      </Stack>
                      {renderRows(g.rows)}
                    </Box>
                  ))}
                </Stack>
              ) : <Stack alignItems="center" sx={{ py: 6, bgcolor: "#fff", border: `1px dashed ${BORDER_MAIN}`, borderRadius: 2.5 }}><Typography sx={{ color: TEXT_SUB, fontWeight: 700 }}>ไม่มีใบ OT ที่รอดำเนินการ 🎉</Typography></Stack>
            ) : visible.length ? (
              <>
                {/* ✅ หัวเดือนเสมอ (เดือนเดียวก็มี) — เดือนเดียว = แบ่งหน้าละ 10 ใบ · หลายเดือน = แสดงครบทุกเดือน */}
                <Stack spacing={2}>
                    {monthList.map(([k]) => {
                      const all = visible.filter((r) => monthOf(r) === k);
                      const list = monthList.length > 1 ? all : pageRows;
                      if (!list.length) return null;
                      return (
                        <Box key={k}>
                          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1 }}>
                            <Stack direction="row" spacing={0.75} alignItems="center"><CalendarMonth sx={{ fontSize: 19, color: "#94a3b8" }} />
                              <Typography sx={{ fontWeight: 900, fontSize: "1.02rem", color: TEXT_MAIN }}>{periodLabel(k)}{k === thisMonth ? " (เดือนนี้)" : ""}</Typography></Stack>
                            <Box sx={{ flex: 1, height: 1, bgcolor: BORDER_MAIN }} />
                            <Typography sx={{ fontSize: "0.8rem", color: TEXT_SUB, fontWeight: 700 }}>{all.length} ใบ · {hoursText(liveHours(all))}</Typography>
                          </Stack>
                          {renderRows(list)}
                        </Box>
                      );
                    })}
                </Stack>
                {monthList.length <= 1 && pageCount > 1 && (
                  <Stack alignItems="center" sx={{ mt: 1.5 }}>
                    <Pagination count={pageCount} page={cur} onChange={(_, n) => { setPage(n); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      shape="rounded" size={isDesktop ? "medium" : "small"} siblingCount={isDesktop ? 1 : 0}
                      sx={{ "& .Mui-selected": { bgcolor: `${DARK} !important`, color: "#fff" } }} />
                  </Stack>
                )}
                <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 1, textAlign: "right" }}>
                  {/* มือถือ + เดือนเดียว = ยอดซ้ำกับหัวเดือนด้านบน → เหลือแค่ลิงก์ย้อนหลัง */}
                  {(isDesktop || monthList.length > 1) && <>{visible.length} ใบ · รวม {hoursText(liveHours(visible))} (ไม่นับใบที่ยกเลิก/ตีกลับ)</>}
                  {view === "mine" && closedCount > 0 && (
                    <>{(isDesktop || monthList.length > 1) ? " · " : ""}<Box component={RouterLink} to="/ot/closed" sx={{ color: OT_ACTION, fontWeight: 700, textDecoration: "none" }}>ย้อนหลัง / ปิดรอบแล้ว {closedCount} ใบ ›</Box></>
                  )}
                </Typography>
              </>
            ) : (
              <Stack alignItems="center" spacing={1.25} sx={{ py: 6, bgcolor: "#fff", border: `1px dashed ${BORDER_MAIN}`, borderRadius: 2.5 }}>
                <AccessTime sx={{ fontSize: 40, color: "#cbd5e1" }} />
                <Typography sx={{ color: TEXT_SUB, fontWeight: 700 }}>
                  {view === "closed" ? (q.trim() ? "ไม่พบรายการตามที่ค้นหา" : "ยังไม่มีใบที่ปิดรอบ")
                    : rows.length ? (inMonth.length || q.trim() ? "ไม่พบรายการตามตัวกรอง" : "ไม่มีใบ OT เดือนนี้และเดือนที่แล้วที่ยังไม่ปิดรอบ") : "ยังไม่มีใบ OT"}
                </Typography>
                {/* ค้นหาแล้วไม่เจอในแท็บนี้ แต่มีในย้อนหลัง → บอกให้รู้ (ไม่ใช่ว่าไม่มีใบนั้น) */}
                {view === "mine" && (historyMatches > 0 || (!q.trim() && closedCount > 0 && !inMonth.length)) && (
                  <Button component={RouterLink} to="/ot/closed" size="small" sx={{ textTransform: "none", fontWeight: 800, color: OT_ACTION }}>
                    {historyMatches > 0 ? `พบในย้อนหลัง / ปิดรอบแล้ว ${historyMatches} ใบ ›` : `ดูย้อนหลัง / ปิดรอบแล้ว ${closedCount} ใบ ›`}
                  </Button>
                )}
              </Stack>
            )}
        </>
      )}

      <OtDetailDialog open={Boolean(detailId)} id={detailId} reloadKey={reloadKey} notice={notice} onClose={closeDetail} onChanged={refresh}
        onEdit={(r) => setForm({ open: true, request: r })} />
      <OtFormDialog open={form.open} request={form.request} onClose={() => setForm((f) => ({ ...f, open: false }))}
        onSaved={(r, { created, fileWarn }) => {
          setForm({ open: false, request: null });
          refresh();
          setNotice(fileWarn || (created ? `ส่งใบ ${r.docNo} แล้ว — รอตรวจสอบ` : "บันทึกการแก้ไขแล้ว"));
          if (r?._id) openDetail(r._id);
        }} />
    </Box>
  );
}
