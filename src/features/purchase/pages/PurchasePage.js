/**
 * PurchasePage — ใบขอซื้อสินค้า (PR)
 *   /purchase            ใบขอซื้อ (ของฉัน · ผู้จัดการ/จัดซื้อเห็นทั้งหมด)
 *   /purchase/approvals  รอดำเนินการ — ตรวจสอบ · อนุมัติ · สั่งซื้อ · รับของ
 *   /purchase/<id>       เปิดใบนั้นทันที (ลิงก์จากแจ้งเตือน)
 * ✅ ผู้ใช้สั่ง (2 ต.ค. 2569): "เพิ่มระบบออกใบขอซื้อสินค้า PR ให้รายละเอียดครบถ้วน และมืออาชีพ สมบูรณ์"
 * ✅ โทนเรียบแบบเดียวกับระบบเบิก/OT — สีเหลือแค่ปุ่มหลักกับป้ายสถานะ
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  Box, Stack, Typography, Button, Chip, TextField, InputAdornment, Skeleton, Alert, Pagination, IconButton,
  Table, TableHead, TableRow, TableCell, TableBody, useMediaQuery,
} from "@mui/material";
import { Add, ShoppingCart, Search, Close, WarningAmber } from "@mui/icons-material";
import moment from "moment";

import usePermissions from "@/shared/hooks/usePermissions";
import useRealtime from "@/shared/realtime/useRealtime";
import { refreshAppBadges } from "@/shared/hooks/useAppBadges";
import { thaiDate } from "@/shared/utils/thaiDate";
import PurchaseService, { errorText } from "../services/PurchaseService";
import PrFormDialog from "../components/PrFormDialog";
import PrDetailDialog from "../components/PrDetailDialog";
import PrStatusBadge from "../components/PrStatusBadge";
import {
  PR_ACCENT, PR_DARK, DARK, TEXT_MAIN, TEXT_SUB, BORDER_MAIN, STATUS_ORDER, prStatus, priorityMeta, baht, prJobText, receiveProgress,
} from "../prMeta";

const PAGE_SIZE = 10;
const isLate = (r) => r.neededBy && !["received", "cancelled"].includes(r.status) && moment(r.neededBy).isBefore(moment(), "day");

const Pill = ({ label, value, alert, active, onClick }) => (
  <Box role={onClick ? "button" : undefined} onClick={onClick} sx={{
    flex: "0 0 auto", minWidth: 118, px: 1.5, py: 1, borderRadius: 2.5, bgcolor: "#fff", cursor: onClick ? "pointer" : "default",
    border: `1px solid ${active ? DARK : alert ? "#fca5a5" : BORDER_MAIN}`, boxShadow: active ? `inset 0 0 0 1px ${DARK}` : "none",
  }}>
    <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 700, display: "block" }} noWrap>{label}</Typography>
    <Typography sx={{ fontWeight: 900, fontSize: "1.15rem", color: alert ? "#dc2626" : TEXT_MAIN }} noWrap>{value}</Typography>
  </Box>
);

const Tags = ({ r }) => {
  const p = priorityMeta(r.priority);
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
      <PrStatusBadge status={r.status} short />
      {r.priority !== "normal" && <Box component="span" sx={{ px: 0.8, height: 22, display: "inline-flex", alignItems: "center", borderRadius: 1.5, bgcolor: p.color, color: "#fff", fontSize: "0.7rem", fontWeight: 800 }}>{p.label}</Box>}
      {isLate(r) && <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.3, color: "#dc2626", fontSize: "0.72rem", fontWeight: 800 }}><WarningAmber sx={{ fontSize: 14 }} />เลยวันต้องใช้</Box>}
      {r.status === "partial" && <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 700 }}>รับแล้ว {Math.round(receiveProgress(r) * 100)}%</Typography>}
    </Stack>
  );
};

const RowCard = ({ r, onOpen }) => (
  <Box role="button" onClick={() => onOpen(r._id)} sx={{ p: 1.5, bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 2.5, cursor: "pointer", "&:active": { bgcolor: "#f8fafc" } }}>
    <Stack direction="row" spacing={1.25} alignItems="flex-start">
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: "0.93rem", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.subject}</Typography>
        <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }} noWrap>
          {[r.docNo, thaiDate(r.docDate), r.requester?.name, `${r.items?.length || 0} รายการ`].join(" · ")}
        </Typography>
      </Box>
      <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", flexShrink: 0 }}>{baht(r.actualTotal || r.estTotal)}</Typography>
    </Stack>
    <Box sx={{ mt: 1 }}><Tags r={r} /></Box>
  </Box>
);

const RowTable = ({ rows, onOpen }) => (
  <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 2.5, overflowX: "auto" }}>
    <Table size="small" sx={{ minWidth: 900, "& th": { fontWeight: 800, color: TEXT_SUB, fontSize: "0.76rem", bgcolor: "#f8fafc", whiteSpace: "nowrap" } }}>
      <TableHead>
        <TableRow>
          <TableCell>เลขที่ / วันที่</TableCell><TableCell>ผู้ขอ</TableCell><TableCell>เรื่อง · งาน</TableCell>
          <TableCell>ต้องใช้ภายใน</TableCell><TableCell align="right">ยอด</TableCell><TableCell>สถานะ</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r._id} hover onClick={() => onOpen(r._id)} sx={{ cursor: "pointer", "& td": { py: 1.1, borderColor: BORDER_MAIN } }}>
            <TableCell sx={{ whiteSpace: "nowrap" }}>
              <Typography sx={{ fontWeight: 700, fontSize: "0.85rem" }}>{r.docNo}</Typography>
              <Typography variant="caption" sx={{ color: TEXT_SUB }}>{thaiDate(r.docDate)}</Typography>
            </TableCell>
            <TableCell sx={{ whiteSpace: "nowrap" }}>{r.requester?.name}</TableCell>
            <TableCell sx={{ maxWidth: 380 }}>
              <Typography noWrap sx={{ fontSize: "0.86rem", fontWeight: 600 }}>{r.subject}</Typography>
              <Typography variant="caption" noWrap sx={{ color: TEXT_SUB, display: "block" }}>{[`${r.items?.length || 0} รายการ`, r.eventId ? prJobText(r.job) : ""].filter(Boolean).join(" · ")}</Typography>
            </TableCell>
            <TableCell sx={{ whiteSpace: "nowrap", color: isLate(r) ? "#dc2626" : TEXT_MAIN, fontWeight: isLate(r) ? 800 : 400 }}>{r.neededBy ? thaiDate(r.neededBy) : "—"}</TableCell>
            <TableCell align="right" sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>{baht(r.actualTotal || r.estTotal)}</TableCell>
            <TableCell><Tags r={r} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </Box>
);

export default function PurchasePage({ view = "mine" }) {
  const { can } = usePermissions();
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery("(min-width:900px)");
  const canUse = can("requestExpense") || can("viewAllExpenses");
  const canBuy = can("viewAllExpenses");
  const canHandle = can("reviewExpense") || can("approveExpense") || canBuy;

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
  useRealtime("purchase", () => setReloadKey((k) => k + 1));

  useEffect(() => {
    if (!canUse) return undefined;
    let alive = true;
    PurchaseService.list(view === "inbox" ? { status: "pending,reviewed,approved,ordered,partial" } : {})
      .then((r) => alive && setRows(r)).catch((err) => alive && setError(errorText(err, "โหลดรายการไม่สำเร็จ")))
      .finally(() => alive && setLoading(false));
    PurchaseService.summary().then((s) => alive && setSummary(s)).catch(() => {});
    return () => { alive = false; };
  }, [view, reloadKey, canUse]);
  useEffect(() => { setPage(1); }, [status, q, view]);

  const base = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => !needle || [r.docNo, r.subject, r.requester?.name, r.job?.title, r.job?.site, r.order?.supplier, r.order?.poNo, ...(r.items || []).map((i) => i.description)]
      .some((v) => String(v || "").toLowerCase().includes(needle)));
  }, [rows, q]);
  const counts = useMemo(() => base.reduce((c, r) => ({ ...c, [r.status]: (c[r.status] || 0) + 1 }), {}), [base]);
  const visible = status === "all" ? base
    : status === "late" ? base.filter(isLate)
      : status === "ordered" ? base.filter((r) => ["ordered", "partial"].includes(r.status))
        : base.filter((r) => r.status === status);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const cur = Math.min(page, pageCount);
  const pageRows = visible.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);

  if (!canUse) return <Navigate to="/dashboard" replace />;
  if (view === "inbox" && !canHandle) return <Navigate to="/purchase" replace />;

  const openDetail = (id) => { setDetailId(id); navigate(`/purchase/${id}`, { replace: Boolean(routeId) }); };
  const closeDetail = () => { setDetailId(""); setNotice(""); if (routeId) navigate(view === "inbox" ? "/purchase/approvals" : "/purchase", { replace: true }); };

  const groups = view === "inbox" ? [
    ...(can("reviewExpense") ? [{ key: "pending", title: "รอตรวจสอบ", rows: base.filter((r) => r.status === "pending") }] : []),
    ...(can("approveExpense") ? [{ key: "reviewed", title: "รออนุมัติ", rows: base.filter((r) => r.status === "reviewed") }] : []),
    ...(canBuy ? [
      { key: "approved", title: "รอสั่งซื้อ", rows: base.filter((r) => r.status === "approved") },
      { key: "ordered", title: "รอรับของ", rows: base.filter((r) => ["ordered", "partial"].includes(r.status)) },
    ] : []),
  ].filter((g) => g.rows.length) : [];

  const renderRows = (list) => (isDesktop ? <RowTable rows={list} onOpen={openDetail} /> : <Stack spacing={1}>{list.map((r) => <RowCard key={r._id} r={r} onOpen={openDetail} />)}</Stack>);
  const toggle = (s) => setStatus((x) => (x === s ? "all" : s));
  const lateCount = base.filter(isLate).length;

  return (
    <Box sx={{ p: { xs: 1.25, sm: 2.5 }, maxWidth: 1500, mx: "auto" }}>
      <Box sx={{ borderRadius: 3, border: `1px solid ${BORDER_MAIN}`, bgcolor: "#fff", px: { xs: 1.5, sm: 2 }, py: { xs: 1.25, sm: 1.75 }, mb: 1.5 }}>
        <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} spacing={{ xs: 1.25, sm: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: 2.5, bgcolor: PR_ACCENT, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><ShoppingCart /></Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 900, fontSize: { xs: "1.12rem", sm: "1.3rem" }, color: TEXT_MAIN, lineHeight: 1.25 }}>ใบขอซื้อสินค้า (PR)</Typography>
              <Typography variant="caption" sx={{ color: TEXT_SUB }}>ขอซื้อ → ตรวจสอบ/อนุมัติ → สั่งซื้อ → รับของ · ติดตามได้ทุกขั้น</Typography>
            </Box>
          </Stack>
          <Button variant="contained" startIcon={<Add />} onClick={() => setForm({ open: true, request: null })}
            sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: PR_ACCENT, whiteSpace: "nowrap", "&:hover": { bgcolor: PR_DARK, boxShadow: "none" } }}>
            ออกใบขอซื้อ
          </Button>
        </Stack>
      </Box>

      <Stack direction="row" spacing={0.75} sx={{ mb: 1.5, overflowX: "auto", pb: 0.5 }}>
        {[{ to: "/purchase", label: "ใบขอซื้อ", key: "mine" }, ...(canHandle ? [{ to: "/purchase/approvals", label: `รอดำเนินการ${summary?.inbox ? ` (${summary.inbox})` : ""}`, key: "inbox" }] : [])].map((t) => (
          <Chip key={t.key} component={RouterLink} to={t.to} clickable label={t.label}
            sx={{ flexShrink: 0, height: 32, fontWeight: 800, borderRadius: 2, bgcolor: view === t.key ? DARK : "#fff", color: view === t.key ? "#fff" : TEXT_SUB, border: `1px solid ${view === t.key ? DARK : BORDER_MAIN}` }} />
        ))}
      </Stack>

      {view === "mine" && (
        <Stack direction="row" spacing={1} sx={{ mb: 1.25, overflowX: "auto", pb: 0.5 }}>
          <Pill label="รอตรวจสอบ" value={summary?.pending ?? "–"} active={status === "pending"} onClick={() => toggle("pending")} />
          <Pill label="รออนุมัติ" value={summary?.reviewing ?? "–"} active={status === "reviewed"} onClick={() => toggle("reviewed")} />
          <Pill label="รอสั่งซื้อ" value={summary?.toOrder ?? "–"} active={status === "approved"} onClick={() => toggle("approved")} />
          <Pill label="รอรับของ" value={summary?.toReceive ?? "–"} active={status === "ordered"} onClick={() => toggle("ordered")} />
          {lateCount > 0 && <Pill label="เลยวันต้องใช้" value={lateCount} alert active={status === "late"} onClick={() => toggle("late")} />}
          {summary?.rejectedMine > 0 && <Pill label="ถูกตีกลับ (ของฉัน)" value={summary.rejectedMine} alert active={status === "rejected"} onClick={() => toggle("rejected")} />}
        </Stack>
      )}

      <TextField size="small" fullWidth placeholder="ค้นหาเลขที่ / เรื่อง / สินค้า / ร้านค้า / PO" value={q} onChange={(e) => setQ(e.target.value)} sx={{ mb: 1.25, bgcolor: "#fff", "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
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
                  {s !== "all" && <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: active ? "#fff" : prStatus(s).color }} />}
                  <span>{s === "all" ? "ทุกสถานะ" : prStatus(s).short || prStatus(s).label} <b>{n}</b></span>
                </Stack>}
                sx={{ flexShrink: 0, height: 30, fontWeight: 700, fontSize: "0.78rem", borderRadius: 2, bgcolor: active ? DARK : "#fff", color: active ? "#fff" : TEXT_MAIN, border: `1px solid ${active ? DARK : BORDER_MAIN}` }} />
            );
          })}
        </Stack>
      )}

      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
      {loading ? <Stack spacing={1}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={isDesktop ? 52 : 96} />)}</Stack>
        : view === "inbox" ? (
          groups.length ? (
            <Stack spacing={2.5}>
              {groups.map((g) => (
                <Box key={g.key}>
                  <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 1 }}>
                    <Typography sx={{ fontWeight: 800 }}>{g.title}</Typography>
                    <Chip size="small" label={g.rows.length} sx={{ height: 20, fontWeight: 800 }} />
                  </Stack>
                  {renderRows(g.rows)}
                </Box>
              ))}
            </Stack>
          ) : <Stack alignItems="center" sx={{ py: 6, bgcolor: "#fff", border: `1px dashed ${BORDER_MAIN}`, borderRadius: 2.5 }}><Typography sx={{ color: TEXT_SUB, fontWeight: 700 }}>ไม่มีใบขอซื้อที่รอดำเนินการ 🎉</Typography></Stack>
        ) : visible.length ? (
          <>
            {renderRows(pageRows)}
            {pageCount > 1 && (
              <Stack alignItems="center" sx={{ mt: 1.5 }}>
                <Pagination count={pageCount} page={cur} onChange={(_, n) => { setPage(n); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  shape="rounded" size={isDesktop ? "medium" : "small"} siblingCount={isDesktop ? 1 : 0} sx={{ "& .Mui-selected": { bgcolor: `${DARK} !important`, color: "#fff" } }} />
              </Stack>
            )}
            <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 1, textAlign: "right" }}>
              {visible.length} ใบ · ประมาณการรวม {baht(visible.filter((r) => r.status !== "cancelled").reduce((s, r) => s + (r.actualTotal || r.estTotal || 0), 0))}
            </Typography>
          </>
        ) : (
          <Stack alignItems="center" spacing={1.25} sx={{ py: 6, bgcolor: "#fff", border: `1px dashed ${BORDER_MAIN}`, borderRadius: 2.5 }}>
            <ShoppingCart sx={{ fontSize: 40, color: "#cbd5e1" }} />
            <Typography sx={{ color: TEXT_SUB, fontWeight: 700 }}>{rows.length ? "ไม่พบรายการตามตัวกรอง" : "ยังไม่มีใบขอซื้อ"}</Typography>
          </Stack>
        )}

      <PrDetailDialog open={Boolean(detailId)} id={detailId} reloadKey={reloadKey} notice={notice} onClose={closeDetail} onChanged={refresh}
        onEdit={(r) => setForm({ open: true, request: r })} />
      <PrFormDialog open={form.open} request={form.request} onClose={() => setForm((f) => ({ ...f, open: false }))}
        onSaved={(r, { created, warn }) => {
          setForm({ open: false, request: null });
          refresh();
          setNotice(warn || (created ? `ส่งใบขอซื้อ ${r.docNo} แล้ว — รอตรวจสอบ` : "บันทึกการแก้ไขแล้ว"));
          if (r?._id) openDetail(r._id);
        }} />
    </Box>
  );
}
