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
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  Box, Stack, Typography, Button, Chip, TextField, InputAdornment, Skeleton, Alert, Pagination, IconButton,
  Table, TableHead, TableRow, TableCell, TableBody, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  useMediaQuery, ButtonBase, Avatar,
} from "@mui/material";
import JobTypeChip from "@/shared/ui/JobTypeChip";
import { Add, AccessTime, Search, Close, ChevronLeft, ChevronRight, FileDownload, TaskAlt, Inbox, Apps, CalendarMonth } from "@mui/icons-material";
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
import OtStatusBadge from "../components/OtStatusBadge";
import { useHolidays } from "../components/OtDayInfo";
import {
  OT_ACCENT, OT_DARK, TEXT_MAIN, TEXT_SUB, BORDER_MAIN, OT_TYPES, STATUS_ORDER, otStatus, hoursText, money, periodLabel,
} from "../otMeta";
import { PAGE_SX } from "@/shared/ui/PageKit";

const DARK = "#334155";
const PAGE_SIZE = 10;

const Pill = ({ label, value, alert, active, onClick }) => (
  <Box role={onClick ? "button" : undefined} onClick={onClick} sx={{
    flex: "0 0 auto", minWidth: 118, px: 1.5, py: 1, borderRadius: 2.5, bgcolor: "#fff", cursor: onClick ? "pointer" : "default",
    border: `1px solid ${active ? DARK : alert ? "#fca5a5" : BORDER_MAIN}`, boxShadow: active ? `inset 0 0 0 1px ${DARK}` : "none",
  }}>
    <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 700, display: "block" }} noWrap>{label}</Typography>
    <Typography sx={{ fontWeight: 900, fontSize: "1.15rem", color: alert ? "#dc2626" : TEXT_MAIN }} noWrap>{value}</Typography>
  </Box>
);

const peopleCount = (r) => new Set((r.lines || []).map((l) => l.person.userId)).size;
/** งานที่อิง (ไม่ซ้ำ) — ประเภทงานคือคำแรกของชื่องาน ("PM · Fire Alarm · …") ใช้ทำสีชิป */
const jobsList = (r) => [...new Set((r.lines || []).map((l) => l.jobTitle).filter(Boolean))];
const JobLine = ({ title }) => {
  const [type, ...rest] = String(title).split(" · ");
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
      <JobTypeChip job={{ title: type }} />
      <Typography noWrap sx={{ fontSize: "0.84rem", color: TEXT_MAIN, minWidth: 0 }}>{rest.join(" · ") || type}</Typography>
    </Stack>
  );
};
const Jobs = ({ r, max = 2 }) => {
  const list = jobsList(r);
  if (!list.length) return <Typography sx={{ fontSize: "0.82rem", color: TEXT_SUB }}>—</Typography>;
  return (
    <Stack spacing={0.5} sx={{ minWidth: 0 }}>
      {list.slice(0, max).map((j) => <JobLine key={j} title={j} />)}
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
        <Typography sx={{ fontWeight: 900, fontSize: "1.3rem", lineHeight: 1, color: TEXT_MAIN }}>{hoursText(r.totalHours).replace(" ชม.", "")}</Typography>
        <Typography sx={{ fontSize: "0.7rem", color: TEXT_SUB, fontWeight: 700 }}>ชั่วโมง</Typography>
      </Box>
    </Stack>
    <Box sx={{ mt: 1.25 }}><Jobs r={r} /></Box>
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1.25, pt: 1.25, borderTop: `1px solid ${BORDER_MAIN}` }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
        <MonthTag r={r} />
        <Typography sx={{ fontSize: "0.76rem", color: TEXT_SUB }} noWrap>{(r.lines || []).length} รายการ</Typography>
      </Stack>
      <OtStatusBadge status={r.status} short />
    </Stack>
  </Box>
);

const RowTable = ({ rows, onOpen }) => (
  <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 3, overflowX: "auto" }}>
    <Table size="small" sx={{ minWidth: 820, "& th": { fontWeight: 800, color: TEXT_SUB, fontSize: "0.76rem", bgcolor: "#f8fafc", whiteSpace: "nowrap", py: 1.1, borderColor: BORDER_MAIN },
      "& td": { py: 1.25, borderColor: BORDER_MAIN }, "& tbody tr:last-of-type td": { borderBottom: 0 } }}>
      <TableHead>
        <TableRow>
          <TableCell>เดือน</TableCell><TableCell>ผู้ยื่น</TableCell><TableCell>เลขที่ / วันที่</TableCell><TableCell>งานที่อิง</TableCell>
          <TableCell align="right">รายการ</TableCell><TableCell align="right">ชั่วโมง</TableCell><TableCell>สถานะ</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r._id} hover onClick={() => onOpen(r._id)} sx={{ cursor: "pointer" }}>
            <TableCell sx={{ whiteSpace: "nowrap" }}><MonthTag r={r} /></TableCell>
            <TableCell sx={{ whiteSpace: "nowrap" }}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Avatar sx={{ width: 32, height: 32, fontSize: "0.82rem", fontWeight: 800, bgcolor: personColor(r.requester?.name) }}>{personInitial(r.requester?.name)}</Avatar>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: "0.88rem" }}>{r.requester?.name}</Typography>
                  {peopleCount(r) > 1 && <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>{peopleCount(r)} คน</Typography>}
                </Box>
              </Stack>
            </TableCell>
            <TableCell sx={{ whiteSpace: "nowrap" }}>
              <Typography sx={{ fontWeight: 700, fontSize: "0.86rem" }}>{r.docNo}</Typography>
              <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>{thaiDate(r.docDate)}</Typography>
            </TableCell>
            <TableCell sx={{ maxWidth: 420 }}><Jobs r={r} /></TableCell>
            <TableCell align="right" sx={{ color: TEXT_SUB, whiteSpace: "nowrap" }}>{(r.lines || []).length}</TableCell>
            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
              <Typography component="span" sx={{ fontWeight: 900, fontSize: "1.02rem" }}>{hoursText(r.totalHours).replace(" ชม.", "")}</Typography>
              <Typography component="span" sx={{ ml: 0.5, fontSize: "0.76rem", color: TEXT_SUB }}>ชม.</Typography>
            </TableCell>
            <TableCell><OtStatusBadge status={r.status} short /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </Box>
);

/** เดือนของใบ (รอบ OT) — ✅ ผู้ใช้: "ให้แสดงเดือนตรงรายการให้ชัดเจน ไม่ต้องแยกค้นหาข้างบน" */
const monthOf = (r) => r.period || moment(r.docDate).format("YYYY-MM");
const MonthTag = ({ r }) => (
  <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 1, height: 26, borderRadius: 2, flexShrink: 0,
    bgcolor: "#ecfeff", color: OT_DARK, border: "1px solid #a5f3fc", fontSize: "0.8rem", fontWeight: 800, whiteSpace: "nowrap" }}>
    <CalendarMonth sx={{ fontSize: 15 }} />{periodLabel(monthOf(r))}
  </Box>
);

const Stat = ({ label, value, unit, tone }) => (
  <Box sx={{ flex: "1 1 0", minWidth: 120, px: 1.75, py: 1.25, bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 3, position: "relative", overflow: "hidden" }}>
    <Box sx={{ position: "absolute", left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2, bgcolor: tone }} />
    <Typography sx={{ fontSize: "0.76rem", color: TEXT_SUB, fontWeight: 700 }} noWrap>{label}</Typography>
    <Typography sx={{ fontWeight: 900, fontSize: "1.35rem", color: TEXT_MAIN, lineHeight: 1.25 }} noWrap>
      {value}<Box component="span" sx={{ fontSize: "0.8rem", color: TEXT_SUB, fontWeight: 600, ml: 0.5 }}>{unit}</Box>
    </Typography>
  </Box>
);

/** ── รายงานรายเดือน + ปิดรอบจ่าย ─────────────────────────────────────── */
const ReportView = ({ reloadKey, canClose }) => {
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
        <Button variant="outlined" startIcon={<FileDownload />} disabled={!data?.people?.length}
          onClick={async () => { const { exportOtReport } = await import("../utils/otExcelExport"); exportOtReport(data); }}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, bgcolor: "#fff", color: TEXT_MAIN, borderColor: BORDER_MAIN }}>ส่งออก Excel</Button>
        {canClose && (
          <Button variant="contained" startIcon={<TaskAlt />} disabled={!data?.approvedCount} onClick={() => setConfirm(true)}
            sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: OT_ACCENT, "&:hover": { bgcolor: OT_DARK, boxShadow: "none" } }}>
            ปิดรอบ{data?.approvedCount ? ` (${data.approvedCount} ใบ)` : ""}
          </Button>
        )}
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError("")}>{error}</Alert>}
      {toast && <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setToast("")}>{toast}</Alert>}
      {!data ? <Skeleton variant="rounded" height={240} /> : (
        <>
          <Stack direction="row" spacing={1} sx={{ mb: 1.5, overflowX: "auto", pb: 0.5 }}>
            <Pill label="พนักงานที่มี OT" value={`${data.people.length} คน`} />
            <Pill label="ชั่วโมงอนุมัติแล้ว" value={hoursText(sum((p) => p.approved.hours + p.paid.hours))} />
            <Pill label="อนุมัติแล้ว · รอปิดรอบ" value={hoursText(sum((p) => p.approved.hours))} />
            <Pill label="ปิดรอบแล้ว" value={hoursText(sum((p) => p.paid.hours))} />
            <Pill label="ยังไม่ผ่านอนุมัติ" value={hoursText(sum((p) => p.waiting.hours))} />
          </Stack>
          {!data.people.length ? (
            <Stack alignItems="center" sx={{ py: 6, bgcolor: "#fff", border: `1px dashed ${BORDER_MAIN}`, borderRadius: 2.5 }}>
              <Inbox sx={{ fontSize: 40, color: "#cbd5e1" }} />
              <Typography sx={{ color: TEXT_SUB, fontWeight: 700 }}>ไม่มี OT ในรอบนี้</Typography>
            </Stack>
          ) : (
            <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 2.5, overflowX: "auto" }}>
              <Table size="small" sx={{ minWidth: 760, "& th": { fontWeight: 800, color: TEXT_SUB, fontSize: "0.76rem", bgcolor: "#f8fafc", whiteSpace: "nowrap" }, "& td": { borderColor: BORDER_MAIN } }}>
                <TableHead>
                  <TableRow>
                    <TableCell>พนักงาน</TableCell>
                    {OT_TYPES.map((t) => <TableCell key={t.value} align="right">{t.label}</TableCell>)}
                    <TableCell align="right">รวมอนุมัติ</TableCell><TableCell align="right">สถานะ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.people.map((p) => (
                    <TableRow key={p.userId}>
                      <TableCell sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{p.name}</TableCell>
                      {OT_TYPES.map((t) => (
                        <TableCell key={t.value} align="right" sx={{ whiteSpace: "nowrap" }}>
                          {p.approved.byType[t.value] ? hoursText(p.approved.byType[t.value].hours) : "—"}
                        </TableCell>
                      ))}
                      <TableCell align="right" sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>{hoursText(p.approved.hours + p.paid.hours)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap", fontSize: "0.78rem", color: TEXT_SUB }}>
                        {p.approved.hours ? `รอปิดรอบ ${hoursText(p.approved.hours)}` : p.paid.hours ? "ปิดรอบแล้ว" : "—"}
                        {p.waiting.hours ? ` · รออนุมัติ ${hoursText(p.waiting.hours)}` : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
          {data.docs.length > 0 && (
            <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 1 }}>
              ใบในรอบนี้: {data.docs.map((d) => d.docNo).join(", ")}
            </Typography>
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

export default function OtPage({ view = "mine" }) {
  const { can } = usePermissions();
  const { id: routeId } = useParams();
  const navigate = useNavigate();
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
  const monthList = useMemo(() => {
    const m = new Map();
    base.forEach((r) => { const k = monthOf(r); m.set(k, [...(m.get(k) || []), r]); });
    return [...m.entries()].sort((x, y) => y[0].localeCompare(x[0]));
  }, [base]);
  const thisMonth = moment().format("YYYY-MM");
  const inMonth = base;
  const counts = useMemo(() => inMonth.reduce((c, r) => ({ ...c, [r.status]: (c[r.status] || 0) + 1 }), {}), [inMonth]);
  const visible = status === "all" ? inMonth : inMonth.filter((r) => r.status === status);
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
    if (routeId) navigate({ inbox: "/ot/approvals", report: "/ot/report", wages: "/ot/wages" }[view] || "/ot", { replace: true });
  };

  const tabs = [
    { to: "/ot", label: "ใบ OT", key: "mine" },
    ...(canHandle ? [{ to: "/ot/approvals", label: `รอดำเนินการ${summary?.inbox ? ` (${summary.inbox})` : ""}`, key: "inbox" }] : []),
    // 🔁 (27 ต.ค. 2569) ไม่มีเรื่องเงินในระบบ OT — เหลือรายงานชั่วโมงรายเดือน (เลิกหน้า "ค่าจ้างต่อชั่วโมง")
    ...(canMoney ? [{ to: "/ot/report", label: "รายงานชั่วโมงรายเดือน", key: "report" }] : []),
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
        <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} spacing={{ xs: 1.25, sm: 2 }}>
          <Stack direction="row" alignItems="center" spacing={{ xs: 1.25, sm: 1.5 }} sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ width: { xs: 34, sm: 38 }, height: { xs: 34, sm: 38 }, borderRadius: 2.25, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: OT_ACCENT, color: "#fff", "& svg": { fontSize: { xs: 20, sm: 24 } } }}>
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
            <Box sx={{ flexShrink: 0, display: "flex", flexDirection: { xs: "row", sm: "column" }, alignItems: { xs: "center", sm: "flex-end" }, justifyContent: "space-between", gap: 1,
              px: 1.5, py: { xs: 1, sm: 0 }, borderRadius: { xs: 2, sm: 0 }, bgcolor: { xs: "#f8fafc", sm: "transparent" }, border: { xs: `1px solid ${BORDER_MAIN}`, sm: 0 }, borderLeft: { sm: `1px solid ${BORDER_MAIN}` } }}>
              <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: TEXT_SUB, whiteSpace: "nowrap" }}>ชั่วโมง {periodLabel(thisMonth)}</Typography>
              <Typography sx={{ fontWeight: 900, fontSize: { xs: "1.05rem", sm: "1.1rem" }, color: TEXT_MAIN, lineHeight: 1.25, whiteSpace: "nowrap" }}>
                {hoursText(liveHours(base.filter((r) => monthOf(r) === thisMonth)))}
              </Typography>
            </Box>
          )}
          {view !== "report" && (
            <Button variant="outlined" startIcon={<FileDownload />} onClick={exportExcel} disabled={exporting || loading || !visible.length}
              sx={{ flexShrink: 0, textTransform: "none", fontWeight: 700, borderRadius: 2, whiteSpace: "nowrap", color: "#334155", borderColor: "#e2e8f0", bgcolor: "#fff",
                "& .MuiButton-startIcon": { color: "#16a34a" }, "&:hover": { borderColor: "#16a34a", bgcolor: "#fff" } }}>
              {exporting ? "กำลังส่งออก…" : "Excel"}
            </Button>
          )}
          <Button variant="contained" startIcon={<Add />} onClick={() => setForm({ open: true, request: null })}
            sx={{ flexShrink: 0, textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: OT_ACCENT, whiteSpace: "nowrap", "&:hover": { bgcolor: OT_DARK, boxShadow: "none" } }}>
            {basketN ? `ส่งรายการ OT (${basketN})` : "ยื่นขอ OT"}
          </Button>
        </Stack>
        <Box component="nav" aria-label="เมนู OT"
          sx={{ display: "flex", gap: { xs: 0.25, sm: 0.5 }, mt: { xs: 1.25, sm: 1.5 }, mb: { xs: -1.25, sm: -1.75 }, mx: { xs: -1.5, sm: -2 }, px: { xs: 1, sm: 1.5 },
            borderTop: `1px solid ${BORDER_MAIN}`, overflowX: "auto", "&::-webkit-scrollbar": { display: "none" }, scrollbarWidth: "none" }}>
          {tabs.map((t) => {
            const on = view === t.key;
            const c = t.key === "inbox" ? "#d97706" : t.key === "report" ? "#1d4ed8" : OT_ACCENT;
            return (
              <ButtonBase key={t.key} component={RouterLink} to={t.to} aria-current={on ? "page" : undefined}
                sx={{ flexShrink: 0, px: { xs: 1.25, sm: 1.5 }, py: 1.1, fontFamily: "inherit", whiteSpace: "nowrap", fontSize: "0.84rem", fontWeight: on ? 800 : 600,
                  color: on ? c : TEXT_SUB, borderBottom: `2px solid ${on ? c : "transparent"}`, mb: "-1px", "&:hover": { color: on ? c : TEXT_MAIN } }}>
                {t.label}
              </ButtonBase>
            );
          })}
        </Box>
      </Box>

      {view === "report" && <ReportView reloadKey={reloadKey} canClose={can("disburseExpense")} />}

      {(view === "mine" || view === "inbox") && (
        <>
          <TextField size="small" fullWidth placeholder="ค้นหาเลขที่ / เรื่อง / ชื่อพนักงาน" value={q} onChange={(e) => setQ(e.target.value)} sx={{ mb: 1.25, bgcolor: "#fff", "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 19, color: TEXT_SUB }} /></InputAdornment>,
              endAdornment: q ? <InputAdornment position="end"><IconButton size="small" onClick={() => setQ("")}><Close sx={{ fontSize: 17 }} /></IconButton></InputAdornment> : null,
            }} />
          {view === "mine" && monthList.length > 0 && (
            <>
              <Stack direction="row" spacing={1} sx={{ mb: 1.5, overflowX: "auto", pb: 0.25 }}>
                <Stat label="อนุมัติเดือนนี้" value={hoursText(liveHours(inMonth.filter((r) => monthOf(r) === thisMonth).filter((r) => ["approved", "paid"].includes(r.status)))).replace(" ชม.", "")} unit="ชม." tone="#16a34a" />
                <Stat label="รออนุมัติ" value={hoursText(liveHours(inMonth.filter((r) => ["pending", "reviewed"].includes(r.status)))).replace(" ชม.", "")} unit="ชม." tone="#d97706" />
                <Stat label="ใบทั้งหมด" value={inMonth.length} unit="ใบ" tone={OT_ACCENT} />
                {(counts.rejected || 0) > 0 && <Stat label="ถูกตีกลับ" value={counts.rejected} unit="ใบ" tone="#dc2626" />}
              </Stack>
            </>
          )}
          {view === "mine" && (
            <Box sx={{ mb: 1.5 }}>
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
          {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
          {loading ? <Stack spacing={1}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={isDesktop ? 52 : 96} />)}</Stack>
            : view === "inbox" ? (
              inboxGroups.length ? (
                <Stack spacing={2.5}>
                  {inboxGroups.map((g) => (
                    <Box key={g.key}>
                      <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 1 }}>
                        <Typography sx={{ fontWeight: 800 }}>{g.title}</Typography>
                        <Chip size="small" label={g.rows.length} sx={{ height: 20, fontWeight: 800 }} />
                      </Stack>
                      {renderRows(g.rows)}
                    </Box>
                  ))}
                </Stack>
              ) : <Stack alignItems="center" sx={{ py: 6, bgcolor: "#fff", border: `1px dashed ${BORDER_MAIN}`, borderRadius: 2.5 }}><Typography sx={{ color: TEXT_SUB, fontWeight: 700 }}>ไม่มีใบ OT ที่รอดำเนินการ 🎉</Typography></Stack>
            ) : visible.length ? (
              <>
                {monthList.length > 1 ? (
                  <Stack spacing={2}>
                    {monthList.map(([k]) => {
                      const list = visible.filter((r) => monthOf(r) === k);
                      if (!list.length) return null;
                      return (
                        <Box key={k}>
                          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1 }}>
                            <Stack direction="row" spacing={0.75} alignItems="center"><CalendarMonth sx={{ fontSize: 20, color: OT_ACCENT }} />
                              <Typography sx={{ fontWeight: 900, fontSize: "1.02rem", color: TEXT_MAIN }}>{periodLabel(k)}{k === thisMonth ? " (เดือนนี้)" : ""}</Typography></Stack>
                            <Box sx={{ flex: 1, height: 1, bgcolor: BORDER_MAIN }} />
                            <Typography sx={{ fontSize: "0.8rem", color: TEXT_SUB, fontWeight: 700 }}>{list.length} ใบ · {hoursText(liveHours(list))}</Typography>
                          </Stack>
                          {renderRows(list)}
                        </Box>
                      );
                    })}
                  </Stack>
                ) : renderRows(pageRows)}
                {monthList.length <= 1 && pageCount > 1 && (
                  <Stack alignItems="center" sx={{ mt: 1.5 }}>
                    <Pagination count={pageCount} page={cur} onChange={(_, n) => { setPage(n); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      shape="rounded" size={isDesktop ? "medium" : "small"} siblingCount={isDesktop ? 1 : 0}
                      sx={{ "& .Mui-selected": { bgcolor: `${DARK} !important`, color: "#fff" } }} />
                  </Stack>
                )}
                <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 1, textAlign: "right" }}>
                  {visible.length} ใบ · รวม {hoursText(liveHours(visible))} (ไม่นับใบที่ยกเลิก/ตีกลับ)
                </Typography>
              </>
            ) : (
              <Stack alignItems="center" spacing={1.25} sx={{ py: 6, bgcolor: "#fff", border: `1px dashed ${BORDER_MAIN}`, borderRadius: 2.5 }}>
                <AccessTime sx={{ fontSize: 40, color: "#cbd5e1" }} />
                <Typography sx={{ color: TEXT_SUB, fontWeight: 700 }}>{rows.length ? (inMonth.length ? "ไม่พบรายการตามตัวกรอง" : "ไม่พบรายการตามตัวกรอง") : "ยังไม่มีใบ OT"}</Typography>
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
