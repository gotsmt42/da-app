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
  Table, TableHead, TableRow, TableCell, TableBody, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  useMediaQuery,
} from "@mui/material";
import { Add, AccessTime, Search, Close, ChevronLeft, ChevronRight, FileDownload, TaskAlt, WarningAmber, Inbox } from "@mui/icons-material";
import moment from "moment";

import usePermissions from "@/shared/hooks/usePermissions";
import useRealtime from "@/shared/realtime/useRealtime";
import { refreshAppBadges } from "@/shared/hooks/useAppBadges";
import { thaiDate } from "@/shared/utils/thaiDate";
import OtService, { errorText } from "../services/OtService";
import OtFormDialog from "../components/OtFormDialog";
import OtDetailDialog from "../components/OtDetailDialog";
import OtStatusBadge from "../components/OtStatusBadge";
import {
  OT_ACCENT, OT_DARK, TEXT_MAIN, TEXT_SUB, BORDER_MAIN, OT_TYPES, STATUS_ORDER, otStatus, hoursText, baht, money, periodLabel,
} from "../otMeta";

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

const RowCard = ({ r, onOpen }) => (
  <Box role="button" onClick={() => onOpen(r._id)} sx={{ p: 1.5, bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 2.5, cursor: "pointer", "&:active": { bgcolor: "#f8fafc" } }}>
    <Stack direction="row" spacing={1.25} alignItems="flex-start">
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: "0.93rem", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.subject}</Typography>
        <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }} noWrap>
          {[r.docNo, thaiDate(r.docDate), r.requester?.name, `${peopleCount(r)} คน`].join(" · ")}
        </Typography>
      </Box>
      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
        <Typography sx={{ fontWeight: 800, fontSize: "0.95rem" }}>{hoursText(r.totalHours)}</Typography>
        {r.totalAmount > 0 && <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 600 }}>{baht(r.totalAmount)}</Typography>}
      </Box>
    </Stack>
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
      <OtStatusBadge status={r.status} short />
      <Typography variant="caption" sx={{ color: TEXT_SUB }}>รอบ {periodLabel(r.period)}</Typography>
    </Stack>
  </Box>
);

const RowTable = ({ rows, onOpen }) => (
  <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 2.5, overflowX: "auto" }}>
    <Table size="small" sx={{ minWidth: 820, "& th": { fontWeight: 800, color: TEXT_SUB, fontSize: "0.76rem", bgcolor: "#f8fafc", whiteSpace: "nowrap" } }}>
      <TableHead>
        <TableRow>
          <TableCell>เลขที่ / วันที่</TableCell><TableCell>ผู้ยื่น</TableCell><TableCell>เรื่อง</TableCell>
          <TableCell align="right">ชั่วโมง</TableCell><TableCell align="right">ค่า OT</TableCell><TableCell>รอบ</TableCell><TableCell>สถานะ</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r._id} hover onClick={() => onOpen(r._id)} sx={{ cursor: "pointer", "& td": { py: 1.1, borderColor: BORDER_MAIN } }}>
            <TableCell sx={{ whiteSpace: "nowrap" }}>
              <Typography sx={{ fontWeight: 700, fontSize: "0.85rem" }}>{r.docNo}</Typography>
              <Typography variant="caption" sx={{ color: TEXT_SUB }}>{thaiDate(r.docDate)}</Typography>
            </TableCell>
            <TableCell sx={{ whiteSpace: "nowrap" }}>{r.requester?.name}<Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>{peopleCount(r)} คน</Typography></TableCell>
            <TableCell sx={{ maxWidth: 360 }}><Typography noWrap sx={{ fontSize: "0.86rem", fontWeight: 600 }}>{r.subject}</Typography></TableCell>
            <TableCell align="right" sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>{hoursText(r.totalHours)}</TableCell>
            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{r.totalAmount > 0 ? baht(r.totalAmount) : "—"}</TableCell>
            <TableCell sx={{ whiteSpace: "nowrap" }}>{periodLabel(r.period)}</TableCell>
            <TableCell><OtStatusBadge status={r.status} short /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
  const waitingAmount = sum((p) => p.approved.amount);

  const doClose = async () => {
    setClosing(true);
    try {
      const r = await OtService.closePayroll(period);
      setToast(`ปิดรอบจ่ายแล้ว ${r.closed} ใบ · ${baht(r.amount)}`);
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
            ปิดรอบจ่าย{data?.approvedCount ? ` (${data.approvedCount} ใบ)` : ""}
          </Button>
        )}
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError("")}>{error}</Alert>}
      {toast && <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setToast("")}>{toast}</Alert>}
      {data?.missingRate?.length > 0 && (
        <Alert severity="warning" icon={<WarningAmber />} sx={{ mb: 1.5 }}>
          ยังไม่ได้ตั้งค่าจ้างต่อชั่วโมง: {data.missingRate.join(", ")} — ยอดเงินของคนกลุ่มนี้เป็น 0 จนกว่าจะตั้งค่า (เมนู “ค่าจ้างต่อชั่วโมง”)
        </Alert>
      )}
      {!data ? <Skeleton variant="rounded" height={240} /> : (
        <>
          <Stack direction="row" spacing={1} sx={{ mb: 1.5, overflowX: "auto", pb: 0.5 }}>
            <Pill label="พนักงานที่มี OT" value={`${data.people.length} คน`} />
            <Pill label="ชั่วโมงอนุมัติแล้ว" value={hoursText(sum((p) => p.approved.hours + p.paid.hours))} />
            <Pill label="รอจ่ายพร้อมเงินเดือน" value={baht(waitingAmount)} />
            <Pill label="จ่ายแล้ว" value={baht(sum((p) => p.paid.amount))} />
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
                    <TableCell align="right">รวมอนุมัติ</TableCell><TableCell align="right">ค่า OT</TableCell><TableCell align="right">สถานะเงิน</TableCell>
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
                      <TableCell align="right" sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>{baht(p.approved.amount + p.paid.amount)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap", fontSize: "0.78rem", color: TEXT_SUB }}>
                        {p.approved.amount ? `รอจ่าย ${baht(p.approved.amount)}` : p.paid.amount ? "จ่ายแล้ว" : "—"}
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
        <DialogTitle sx={{ fontWeight: 800 }}>ปิดรอบจ่าย OT · {periodLabel(period)}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: TEXT_SUB }}>
            ใบที่อนุมัติแล้ว {data?.approvedCount || 0} ใบ รวม {baht(waitingAmount)} จะถูกบันทึกว่า “จ่ายพร้อมเงินเดือนแล้ว” และแจ้งพนักงาน —
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

/** ── ค่าจ้างต่อชั่วโมง (ลับ) ─────────────────────────────────────────── */
const BASIS = [
  { value: "monthly", label: "เงินเดือน" },
  { value: "daily", label: "ค่าจ้างรายวัน" },
  { value: "hourly", label: "ต่อชั่วโมง" },
];
const WageRow = ({ row, hoursPerDay, onSaved }) => {
  const [basis, setBasis] = useState(row.basis);
  const [amount, setAmount] = useState(row.baseAmount ? String(row.baseAmount) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const dirty = basis !== row.basis || money(amount) !== money(row.baseAmount);
  const preview = money(basis === "monthly" ? Number(amount) / 30 / hoursPerDay : basis === "daily" ? Number(amount) / hoursPerDay : Number(amount));
  const save = async () => {
    setBusy(true); setErr("");
    try { onSaved(await OtService.saveWage(row.userId, { basis, baseAmount: Number(amount) || 0 })); } catch (e) { setErr(errorText(e)); } finally { setBusy(false); }
  };
  return (
    <Box sx={{ display: "grid", gap: 1, alignItems: "center", p: 1.25, borderBottom: `1px solid ${BORDER_MAIN}`, gridTemplateColumns: { xs: "1fr 1fr", md: "1.6fr 150px 160px 140px 90px" } }}>
      <Box sx={{ gridColumn: { xs: "1 / -1", md: "auto" }, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: "0.88rem" }} noWrap>{row.fullName}</Typography>
        <Typography variant="caption" sx={{ color: TEXT_SUB }} noWrap component="div">{row.position}{row.updatedAt ? ` · แก้ ${thaiDate(row.updatedAt)} ${row.updatedBy}` : ""}</Typography>
      </Box>
      <TextField select size="small" value={basis} onChange={(e) => setBasis(e.target.value)}>
        {BASIS.map((b) => <MenuItem key={b.value} value={b.value}>{b.label}</MenuItem>)}
      </TextField>
      <TextField size="small" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" inputProps={{ min: 0, step: "any" }}
        InputProps={{ endAdornment: <InputAdornment position="end">บาท</InputAdornment> }} error={Boolean(err)} helperText={err || undefined} />
      <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: preview ? TEXT_MAIN : "#dc2626" }}>
        {preview ? `${baht(preview)} / ชม.` : "ยังไม่ตั้ง"}
      </Typography>
      <Button size="small" variant={dirty ? "contained" : "outlined"} disabled={!dirty || busy} onClick={save}
        sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", ...(dirty ? { bgcolor: OT_ACCENT } : {}) }}>
        {busy ? "…" : "บันทึก"}
      </Button>
    </Box>
  );
};
const WagesView = () => {
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { OtService.wages().then(setData).catch((err) => setError(errorText(err))); }, []);
  const rows = (data?.rows || []).filter((r) => !q.trim() || r.fullName.toLowerCase().includes(q.trim().toLowerCase()));
  const onSaved = (w) => setData((d) => ({ ...d, rows: d.rows.map((r) => (r.userId === w.userId ? { ...r, ...w } : r)) }));
  return (
    <Box sx={{ pt: 1 }}>
      <Alert severity="info" sx={{ mb: 1.5, borderRadius: 2 }}>
        🔒 ข้อมูลลับ — เห็นเฉพาะผู้ดูแลค่าจ้าง · ค่าจ้างต่อชั่วโมง = เงินเดือน ÷ 30 ÷ {data?.hoursPerDay || 8} ชม. (ม.68 พ.ร.บ.คุ้มครองแรงงาน) ·
        แก้แล้วใบ OT ที่ตรวจสอบไปแล้วไม่เปลี่ยน (ใบที่รอตรวจสอบจะคิดใหม่ตอนตรวจ)
      </Alert>
      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
      <TextField size="small" fullWidth placeholder="ค้นหาชื่อพนักงาน" value={q} onChange={(e) => setQ(e.target.value)} sx={{ mb: 1.25, bgcolor: "#fff" }}
        InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 19 }} /></InputAdornment> }} />
      {!data ? <Skeleton variant="rounded" height={240} /> : (
        <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 2.5, overflow: "hidden" }}>
          {rows.map((r) => <WageRow key={r.userId} row={r} hoursPerDay={data.hoursPerDay} onSaved={onSaved} />)}
        </Box>
      )}
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
  const counts = useMemo(() => base.reduce((c, r) => ({ ...c, [r.status]: (c[r.status] || 0) + 1 }), {}), [base]);
  const visible = status === "all" ? base : base.filter((r) => r.status === status);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const cur = Math.min(page, pageCount);
  const pageRows = visible.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);

  if (!canUse) return <Navigate to="/dashboard" replace />;
  if ((view === "report" || view === "wages") && !canMoney) return <Navigate to="/ot" replace />;
  if (view === "inbox" && !canHandle) return <Navigate to="/ot" replace />;

  const openDetail = (id) => { setDetailId(id); navigate(`/ot/${id}`, { replace: Boolean(routeId), state: { fromView: view } }); };
  const closeDetail = () => {
    setDetailId(""); setNotice("");
    if (routeId) navigate({ inbox: "/ot/approvals", report: "/ot/report", wages: "/ot/wages" }[view] || "/ot", { replace: true });
  };

  const tabs = [
    { to: "/ot", label: "ใบ OT", key: "mine" },
    ...(canHandle ? [{ to: "/ot/approvals", label: `รอดำเนินการ${summary?.inbox ? ` (${summary.inbox})` : ""}`, key: "inbox" }] : []),
    ...(canMoney ? [{ to: "/ot/report", label: "รายงานรายเดือน", key: "report" }, { to: "/ot/wages", label: "ค่าจ้างต่อชั่วโมง", key: "wages" }] : []),
  ];

  const inboxGroups = view === "inbox" ? [
    ...(can("reviewExpense") ? [{ key: "pending", title: "รอตรวจสอบ", rows: base.filter((r) => r.status === "pending") }] : []),
    ...(can("approveExpense") ? [{ key: "reviewed", title: "รออนุมัติ", rows: base.filter((r) => r.status === "reviewed") }] : []),
  ].filter((g) => g.rows.length) : [];

  const renderRows = (list) => (isDesktop ? <RowTable rows={list} onOpen={openDetail} /> : <Stack spacing={1}>{list.map((r) => <RowCard key={r._id} r={r} onOpen={openDetail} />)}</Stack>);

  return (
    <Box sx={{ px: { xs: 0, sm: 2.5 }, py: { xs: 1.25, sm: 2.5 }, maxWidth: 1500, mx: "auto" }}>
      <Box sx={{ borderRadius: 3, border: `1px solid ${BORDER_MAIN}`, bgcolor: "#fff", px: { xs: 1.5, sm: 2 }, py: { xs: 1.25, sm: 1.75 }, mb: 1.5 }}>
        <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} spacing={{ xs: 1.25, sm: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: 2.5, bgcolor: OT_ACCENT, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><AccessTime /></Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 900, fontSize: { xs: "1.12rem", sm: "1.3rem" }, color: TEXT_MAIN, lineHeight: 1.25 }}>OT · ทำงานล่วงเวลา</Typography>
              <Typography variant="caption" sx={{ color: TEXT_SUB }}>ยื่นขอ OT ของตัวเองหรือทั้งทีม · ตรวจสอบ → อนุมัติ → จ่ายพร้อมเงินเดือน</Typography>
            </Box>
          </Stack>
          <Button variant="contained" startIcon={<Add />} onClick={() => setForm({ open: true, request: null })}
            sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: OT_ACCENT, whiteSpace: "nowrap", "&:hover": { bgcolor: OT_DARK, boxShadow: "none" } }}>
            ยื่นขอ OT
          </Button>
        </Stack>
      </Box>

      <Stack direction="row" spacing={0.75} sx={{ mb: 1.5, overflowX: "auto", pb: 0.5 }}>
        {tabs.map((t) => (
          <Chip key={t.key} component={RouterLink} to={t.to} clickable label={t.label}
            sx={{ flexShrink: 0, height: 32, fontWeight: 800, borderRadius: 2, bgcolor: view === t.key ? DARK : "#fff", color: view === t.key ? "#fff" : TEXT_SUB, border: `1px solid ${view === t.key ? DARK : BORDER_MAIN}` }} />
        ))}
      </Stack>

      {view === "report" && <ReportView reloadKey={reloadKey} canClose={can("disburseExpense")} />}
      {view === "wages" && <WagesView />}

      {(view === "mine" || view === "inbox") && (
        <>
          {view === "mine" && (
            <Stack direction="row" spacing={1} sx={{ mb: 1.25, overflowX: "auto", pb: 0.5 }}>
              <Pill label="รอตรวจสอบ" value={summary?.pending ?? "–"} active={status === "pending"} onClick={() => setStatus((s) => (s === "pending" ? "all" : "pending"))} />
              <Pill label="รออนุมัติ" value={summary?.reviewing ?? "–"} active={status === "reviewed"} onClick={() => setStatus((s) => (s === "reviewed" ? "all" : "reviewed"))} />
              <Pill label="รอจ่ายพร้อมเงินเดือน" value={summary?.approved ?? "–"} active={status === "approved"} onClick={() => setStatus((s) => (s === "approved" ? "all" : "approved"))} />
              {summary?.rejectedMine > 0 && <Pill label="ถูกตีกลับ (ของฉัน)" value={summary.rejectedMine} alert active={status === "rejected"} onClick={() => setStatus((s) => (s === "rejected" ? "all" : "rejected"))} />}
            </Stack>
          )}
          <TextField size="small" fullWidth placeholder="ค้นหาเลขที่ / เรื่อง / ชื่อพนักงาน" value={q} onChange={(e) => setQ(e.target.value)} sx={{ mb: 1.25, bgcolor: "#fff", "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 19, color: TEXT_SUB }} /></InputAdornment>,
              endAdornment: q ? <InputAdornment position="end"><IconButton size="small" onClick={() => setQ("")}><Close sx={{ fontSize: 17 }} /></IconButton></InputAdornment> : null,
            }} />
          {view === "mine" && (
            <Stack direction="row" spacing={0.75} sx={{ mb: 1.5, overflowX: "auto", pb: 0.5 }}>
              {["all", ...STATUS_ORDER].map((s) => {
                const n = s === "all" ? base.length : counts[s] || 0;
                if (s !== "all" && s !== status && !n) return null;
                const active = status === s;
                return (
                  <Chip key={s} clickable onClick={() => setStatus(s)}
                    label={<Stack direction="row" spacing={0.6} alignItems="center" component="span">
                      {s !== "all" && <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: active ? "#fff" : otStatus(s).color }} />}
                      <span>{s === "all" ? "ทุกสถานะ" : otStatus(s).short || otStatus(s).label} <b>{n}</b></span>
                    </Stack>}
                    sx={{ flexShrink: 0, height: 30, fontWeight: 700, fontSize: "0.78rem", borderRadius: 2, bgcolor: active ? DARK : "#fff", color: active ? "#fff" : TEXT_MAIN, border: `1px solid ${active ? DARK : BORDER_MAIN}` }} />
                );
              })}
            </Stack>
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
                {renderRows(pageRows)}
                {pageCount > 1 && (
                  <Stack alignItems="center" sx={{ mt: 1.5 }}>
                    <Pagination count={pageCount} page={cur} onChange={(_, n) => { setPage(n); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      shape="rounded" size={isDesktop ? "medium" : "small"} siblingCount={isDesktop ? 1 : 0}
                      sx={{ "& .Mui-selected": { bgcolor: `${DARK} !important`, color: "#fff" } }} />
                  </Stack>
                )}
                <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 1, textAlign: "right" }}>
                  {visible.length} ใบ · รวม {hoursText(visible.filter((r) => r.status !== "cancelled").reduce((s, r) => s + r.totalHours, 0))}
                </Typography>
              </>
            ) : (
              <Stack alignItems="center" spacing={1.25} sx={{ py: 6, bgcolor: "#fff", border: `1px dashed ${BORDER_MAIN}`, borderRadius: 2.5 }}>
                <AccessTime sx={{ fontSize: 40, color: "#cbd5e1" }} />
                <Typography sx={{ color: TEXT_SUB, fontWeight: 700 }}>{rows.length ? "ไม่พบรายการตามตัวกรอง" : "ยังไม่มีใบ OT"}</Typography>
              </Stack>
            )}
        </>
      )}

      <OtDetailDialog open={Boolean(detailId)} id={detailId} reloadKey={reloadKey} notice={notice} onClose={closeDetail} onChanged={refresh}
        onEdit={(r) => setForm({ open: true, request: r })} />
      <OtFormDialog open={form.open} request={form.request} onClose={() => setForm((f) => ({ ...f, open: false }))}
        onSaved={(r, { created }) => {
          setForm({ open: false, request: null });
          refresh();
          setNotice(created ? `ส่งใบ ${r.docNo} แล้ว — รอตรวจสอบ` : "บันทึกการแก้ไขแล้ว");
          if (r?._id) openDetail(r._id);
        }} />
    </Box>
  );
}
