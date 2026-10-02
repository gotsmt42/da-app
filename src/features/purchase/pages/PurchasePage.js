/**
 * PurchasePage — ใบขอซื้อสินค้า (PR)
 *   /purchase            ใบขอซื้อ (ของฉัน · ผู้จัดการ/จัดซื้อเห็นทั้งหมด)
 *   /purchase/approvals  รอดำเนินการ — ตรวจสอบ · อนุมัติ · สั่งซื้อ · รับของ
 *   /purchase/<id>       เปิดใบนั้นทันที (ลิงก์จากแจ้งเตือน)
 *
 * ✅ ผู้ใช้สั่ง (2 ต.ค. 2569): "ยังเป็นรูปแบบเก่าอยู่ ให้อัปเดตให้เหมือนใบอื่นๆ" + "ทำให้สวยงาม"
 *    → ใช้โครงเดียวกับหน้าใบเบิก (ExpensesPage + ExpenseList) ทุกส่วน:
 *      หัวเพจ (ไอคอน · ชื่อ · คำอธิบาย · ลิงก์ไปหน้าอื่น · ตัวเลขเงินขวา · ปุ่มหลัก) → แถบค้นหากล่องขาว →
 *      แผง "ตามผู้ขอ" (ResponsibleSummary) → การ์ดสถานะ (ViewTiles) → ตาราง (ผู้ขอมีรูป/อักษรย่อ) / การ์ดมือถือ
 *      มือถือ: ปุ่มตัวกรองมุมขวาบน เปิดแผ่นล่าง (เหมือนใบเบิก)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  Box, Stack, Typography, Button, Chip, TextField, InputAdornment, Skeleton, Alert, Pagination, IconButton, Avatar,
  Table, TableHead, TableRow, TableCell, TableBody, useMediaQuery, Drawer, Badge,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Add, ShoppingCart, Search, Close, WarningAmber, ChevronRight, Apps, Inbox, Tune, HourglassTop, FactCheck, LocalShipping,
  Inventory2, CheckCircle, Undo, Block,
} from "@mui/icons-material";
import moment from "moment";

import usePermissions from "@/shared/hooks/usePermissions";
import useRealtime from "@/shared/realtime/useRealtime";
import useCloseOnPick from "@/shared/hooks/useCloseOnPick";
import { refreshAppBadges } from "@/shared/hooks/useAppBadges";
import { thaiDate } from "@/shared/utils/thaiDate";
import ViewTiles from "@/shared/ui/ViewTiles";
import ResponsibleSummary from "@/shared/ui/ResponsibleSummary";
import SelectField from "@/shared/ui/SelectField";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import { hasValidAvatar } from "@/shared/utils/user";
import ExpenseService from "@/features/expenses/services/ExpenseService";
import PurchaseService, { errorText } from "../services/PurchaseService";
import PrFormDialog from "../components/PrFormDialog";
import PrDetailDialog from "../components/PrDetailDialog";
import PrStatusBadge from "../components/PrStatusBadge";
import {
  PR_ACCENT, PR_DARK, DARK, TEXT_MAIN, TEXT_SUB, BORDER_MAIN, STATUS_ORDER, prStatus, priorityMeta, baht, prJobText, receiveProgress,
} from "../prMeta";

const PAGE_SIZE = 10;
const STATUS_ICON = {
  pending: HourglassTop, reviewed: FactCheck, approved: ShoppingCart, ordered: LocalShipping, partial: Inventory2,
  received: CheckCircle, rejected: Undo, cancelled: Block,
};
const PERIODS = [
  { value: "all", label: "ทุกช่วงเวลา" },
  { value: "month", label: "เดือนนี้" },
  { value: "3m", label: "3 เดือนล่าสุด" },
  { value: "year", label: "ปีนี้" },
];
const inPeriod = (r, p) => {
  if (p === "all") return true;
  const d = moment(r.docDate);
  if (p === "month") return d.isSameOrAfter(moment().startOf("month"));
  if (p === "3m") return d.isSameOrAfter(moment().subtract(2, "months").startOf("month"));
  return d.isSameOrAfter(moment().startOf("year"));
};
const isLate = (r) => r.neededBy && !["received", "cancelled"].includes(r.status) && moment(r.neededBy).isBefore(moment(), "day");
const amountOf = (r) => (r.status === "cancelled" ? 0 : Number(r.actualTotal || r.estTotal) || 0);
/** เลขที่ "PR-00012/2569" → เรียงใหม่ → เก่า (ปีก่อน แล้วเลขลำดับ) เหมือนหน้าใบเบิก */
const docKey = (r) => { const m = String(r?.docNo || "").match(/(\d+)\/(\d{4})$/); return m ? [Number(m[2]), Number(m[1])] : [0, 0]; };
const byDocNoDesc = (a, b) => { const [ya, na] = docKey(a); const [yb, nb] = docKey(b); return (yb - ya) || (nb - na); };

const CrossLink = ({ to, label }) => (
  <Chip component={RouterLink} to={to} clickable size="small"
    label={<span>{label} <ChevronRight sx={{ fontSize: 13, verticalAlign: "-2px" }} /></span>}
    sx={{ height: 26, fontWeight: 700, fontSize: "0.76rem", bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, color: TEXT_SUB, "& .MuiChip-label": { px: 1 } }} />
);

/** ผู้ขอ — รูป/อักษรย่อสีประจำคน (ชุดเดียวกับหน้าใบเบิก/ภาพรวมงาน) + ชื่อตัวหนา + ตำแหน่ง */
const Requester = ({ r, avatars, size = 34 }) => {
  const name = r.requester?.name || "-";
  return (
    <Stack direction="row" spacing={1.1} alignItems="center" sx={{ minWidth: 0 }}>
      <Avatar src={avatars?.get(String(r.requester?.userId || "")) || undefined}
        sx={{ width: size, height: size, fontSize: size * 0.42, fontWeight: 800, bgcolor: personColor(name), flexShrink: 0 }}>
        {personInitial(name)}
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography noWrap sx={{ fontWeight: 800, fontSize: "0.88rem", color: TEXT_MAIN, lineHeight: 1.3 }}>{name}</Typography>
        {r.requester?.position && <Typography noWrap sx={{ fontSize: "0.72rem", color: TEXT_SUB, lineHeight: 1.3 }}>{r.requester.position}</Typography>}
      </Box>
    </Stack>
  );
};

/** ป้ายชนิดเอกสาร "PR" แบบอ่อน — ตำแหน่งเดียวกับป้าย ADVANCE/CLAIM ในหน้าใบเบิก */
const PrBadge = () => (
  <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, px: 0.75, height: 20, borderRadius: 999, bgcolor: alpha(PR_ACCENT, 0.1), color: PR_DARK, fontSize: "0.64rem", fontWeight: 800, letterSpacing: "0.02em", flexShrink: 0 }}>
    <ShoppingCart sx={{ fontSize: 13 }} />PR
  </Box>
);

const StatusCell = ({ r }) => {
  const p = priorityMeta(r.priority);
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
      <PrStatusBadge status={r.status} short />
      {r.priority !== "normal" && <Box component="span" sx={{ px: 0.8, height: 22, display: "inline-flex", alignItems: "center", borderRadius: 1.5, bgcolor: p.color, color: "#fff", fontSize: "0.7rem", fontWeight: 800 }}>{p.label}</Box>}
      {isLate(r) && <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, height: 22, px: 0.8, borderRadius: 1.5, bgcolor: "#dc2626", color: "#fff", fontSize: "0.7rem", fontWeight: 800 }}><WarningAmber sx={{ fontSize: 14 }} />เลยวันต้องใช้</Box>}
    </Stack>
  );
};

const AmountCell = ({ r }) => (
  <Box sx={{ textAlign: "right", flexShrink: 0 }}>
    <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", color: TEXT_MAIN, whiteSpace: "nowrap" }}>{baht(r.actualTotal || r.estTotal)}</Typography>
    {r.status === "partial" ? <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 600, whiteSpace: "nowrap" }}>รับแล้ว {Math.round(receiveProgress(r) * 100)}%</Typography>
      : r.actualTotal ? <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 600, whiteSpace: "nowrap" }}>ยอดสั่งซื้อจริง</Typography> : null}
  </Box>
);

const MobileCard = ({ r, onOpen, avatars }) => (
  <Box onClick={() => onOpen(r._id)} role="button" sx={{ p: 1.5, bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 3, cursor: "pointer", boxShadow: "0 1px 2px rgba(15,23,42,.04)", "&:active": { bgcolor: "#f8fafc" } }}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Box sx={{ flex: 1, minWidth: 0 }}><Requester r={r} avatars={avatars} size={32} /></Box>
      <AmountCell r={r} />
    </Stack>
    <Typography sx={{ mt: 1, fontWeight: 600, fontSize: "0.88rem", color: TEXT_MAIN, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.subject}</Typography>
    <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 0.25 }} noWrap>
      {[r.docNo, thaiDate(r.docDate), `${r.items?.length || 0} รายการ`, r.neededBy ? `ต้องใช้ ${thaiDate(r.neededBy)}` : ""].filter(Boolean).join(" · ")}
    </Typography>
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1, pt: 1, borderTop: `1px solid ${BORDER_MAIN}` }}>
      <PrBadge />
      <Box sx={{ flex: 1 }} />
      <StatusCell r={r} />
    </Stack>
  </Box>
);

const DesktopTable = ({ rows, onOpen, avatars }) => (
  <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 3, overflowX: "auto", boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}>
    <Table size="small" sx={{ minWidth: 900, "& th": { fontWeight: 800, color: TEXT_SUB, fontSize: "0.76rem", bgcolor: "#f8fafc", whiteSpace: "nowrap" } }}>
      <TableHead>
        <TableRow>
          <TableCell>ผู้ขอซื้อ</TableCell><TableCell>เลขที่ / วันที่</TableCell><TableCell>เรื่อง · งาน</TableCell>
          <TableCell>ต้องใช้ภายใน</TableCell><TableCell align="right">ยอด</TableCell><TableCell>สถานะ</TableCell><TableCell width={36} />
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r._id} hover onClick={() => onOpen(r._id)} sx={{ cursor: "pointer", "& td": { py: 1.2, borderColor: BORDER_MAIN }, "&:last-child td": { borderBottom: 0 } }}>
            <TableCell sx={{ maxWidth: 240 }}><Requester r={r} avatars={avatars} /></TableCell>
            <TableCell sx={{ whiteSpace: "nowrap" }}>
              <Stack direction="row" spacing={0.75} alignItems="center"><PrBadge /><Typography sx={{ fontWeight: 700, fontSize: "0.85rem", color: TEXT_MAIN }}>{r.docNo}</Typography></Stack>
              <Typography variant="caption" sx={{ color: TEXT_SUB }}>{thaiDate(r.docDate)}</Typography>
            </TableCell>
            <TableCell sx={{ maxWidth: 380 }}>
              <Typography sx={{ fontWeight: 600, fontSize: "0.86rem" }} noWrap>{r.subject}</Typography>
              <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }} noWrap>
                {[r.eventId ? prJobText(r.job) : "", r.order?.supplier ? `ร้าน ${r.order.supplier}` : "", `${r.items?.length || 0} รายการ`].filter(Boolean).join(" · ")}
              </Typography>
            </TableCell>
            <TableCell sx={{ whiteSpace: "nowrap", color: isLate(r) ? "#dc2626" : TEXT_MAIN, fontWeight: isLate(r) ? 800 : 400, fontSize: "0.84rem" }}>{r.neededBy ? thaiDate(r.neededBy) : "—"}</TableCell>
            <TableCell align="right"><AmountCell r={r} /></TableCell>
            <TableCell><StatusCell r={r} /></TableCell>
            <TableCell><ChevronRight sx={{ color: "#cbd5e1" }} /></TableCell>
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
  const [period, setPeriod] = useState("all");
  const [person, setPerson] = useState("all");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [avatars, setAvatars] = useState(() => new Map());
  const [form, setForm] = useState({ open: false, request: null });
  const [detailId, setDetailId] = useState(routeId || "");
  const [notice, setNotice] = useState("");
  const topRef = useRef(null);

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
  useEffect(() => {
    if (!canBuy) return;
    ExpenseService.people()
      .then((list) => setAvatars(new Map(list.filter((u) => hasValidAvatar(u.imageUrl)).map((u) => [String(u.userId), u.imageUrl]))))
      .catch(() => {});
  }, [canBuy]);
  useEffect(() => { setPage(1); }, [status, q, view, period, person]);

  const matchQ = useCallback((r) => {
    const needle = q.trim().toLowerCase();
    return !needle || [r.docNo, r.subject, r.requester?.name, r.job?.title, r.job?.site, r.order?.supplier, r.order?.poNo, ...(r.items || []).map((i) => i.description)]
      .some((v) => String(v || "").toLowerCase().includes(needle));
  }, [q]);
  const scoped = useMemo(() => [...rows].sort(byDocNoDesc).filter((r) => matchQ(r) && inPeriod(r, period)), [rows, matchQ, period]);
  const base = useMemo(() => scoped.filter((r) => person === "all" || r.requester?.userId === person), [scoped, person]);

  // ✅ แผง "ใบขอซื้อตามผู้ขอ" — นับจากคำค้น/ช่วงเวลาเดียวกัน แต่ไม่กรองผู้ขอ (เหมือนหน้าใบเบิก)
  const personRows = useMemo(() => scoped.map((r) => ({ responsiblePerson: r.requester?.name || "-", userId: String(r.requester?.userId || ""), total: amountOf(r) })), [scoped]);
  const selectedName = person === "all" ? "all" : (personRows.find((x) => x.userId === person)?.responsiblePerson || "all");
  const pickPerson = (name) => setPerson(name === "all" ? "all" : (personRows.find((x) => x.responsiblePerson === name)?.userId || "all"));
  const avatarPeople = useMemo(() => {
    const seen = new Map();
    rows.forEach((r) => { const id = String(r.requester?.userId || ""); if (avatars.get(id)) seen.set(r.requester?.name, avatars.get(id)); });
    return [...seen].map(([fname, imageUrl]) => ({ fname, imageUrl }));
  }, [rows, avatars]);
  const personOptions = useMemo(() => {
    const m = new Map();
    personRows.forEach((x) => { if (!x.userId) return; const p = m.get(x.userId) || { id: x.userId, name: x.responsiblePerson, count: 0 }; p.count += 1; m.set(x.userId, p); });
    return [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "th"));
  }, [personRows]);
  const showPeople = view !== "inbox" && canBuy && personOptions.length > 1;

  const counts = useMemo(() => {
    const c = { all: base.length, late: 0 };
    base.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; if (isLate(r)) c.late += 1; });
    return c;
  }, [base]);
  const visible = useMemo(() => {
    if (view === "inbox" || status === "all") return base;
    if (status === "late") return base.filter(isLate);
    return base.filter((r) => r.status === status);
  }, [base, status, view]);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const cur = Math.min(page, pageCount);
  const pageRows = visible.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);

  const activeFilters = (q.trim() ? 1 : 0) + (person !== "all" ? 1 : 0) + (period !== "all" ? 1 : 0) + (view !== "inbox" && status !== "all" ? 1 : 0);
  useCloseOnPick(filtersOpen, () => setFiltersOpen(false), { status, person, period });

  if (!canUse) return <Navigate to="/dashboard" replace />;
  if (view === "inbox" && !canHandle) return <Navigate to="/purchase" replace />;

  const openDetail = (id) => { setDetailId(id); navigate(`/purchase/${id}`, { replace: Boolean(routeId) }); };
  const closeDetail = () => { setDetailId(""); setNotice(""); if (routeId) navigate(view === "inbox" ? "/purchase/approvals" : "/purchase", { replace: true }); };
  const goPage = (n) => { setPage(n); topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  // ── หัวเพจ: ลิงก์ไปอีกหน้า + ตัวเลขเงินด้านขวา (แบบเดียวกับหน้าใบเบิก) ──
  const crossLinks = [
    ...(view !== "mine" ? [{ to: "/purchase", label: "ใบขอซื้อ" }] : []),
    ...(canHandle && view !== "inbox" ? [{ to: "/purchase/approvals", label: `รอดำเนินการ${summary?.inbox ? ` (${summary.inbox})` : ""}` }] : []),
    { to: "/expenses/advances", label: "ระบบเบิก" },
  ];
  const waitingAmount = rows.filter((r) => ["approved", "ordered", "partial"].includes(r.status)).reduce((s, r) => s + amountOf(r), 0);

  const filterBar = (
    <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}
      sx={isDesktop ? { mb: 1.5, p: 1, bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 3, boxShadow: "0 1px 2px rgba(15,23,42,.04)" } : { "& > *": { width: "100%" } }}>
      <TextField size="small" placeholder="ค้นหาเลขที่ / เรื่อง / สินค้า / ร้านค้า / PO" value={q} onChange={(e) => setQ(e.target.value)}
        sx={{ flex: 1, minWidth: 0, "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: "#f8fafc", height: 40, "& fieldset": { borderColor: "transparent" }, "&:hover fieldset": { borderColor: BORDER_MAIN }, "&.Mui-focused": { bgcolor: "#fff" } } }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 19, color: TEXT_SUB }} /></InputAdornment>,
          endAdornment: q ? <InputAdornment position="end"><IconButton size="small" aria-label="ล้างคำค้นหา" onClick={() => setQ("")}><Close sx={{ fontSize: 17 }} /></IconButton></InputAdornment> : null,
        }} />
      <Stack direction="row" spacing={1} useFlexGap alignItems="center" sx={{ minWidth: 0 }}>
        {showPeople && !isDesktop && (
          <SelectField label="ผู้ขอซื้อ" value={person} onChange={(e) => setPerson(e.target.value)} sx={{ minWidth: 0, flex: "1 1 0" }}>
            <option value="all">ทุกคน ({personRows.length})</option>
            {personOptions.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.count})</option>)}
          </SelectField>
        )}
        {view !== "inbox" && (
          <SelectField label="ช่วงเวลา" value={period} onChange={(e) => setPeriod(e.target.value)} sx={{ minWidth: { xs: 0, md: 150 }, flex: { xs: "1 1 0", md: "none" } }}>
            {PERIODS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </SelectField>
        )}
      </Stack>
    </Stack>
  );

  const statusTiles = view !== "inbox" && (() => {
    const keys = ["all", "late", ...STATUS_ORDER].filter((s) => s === "all" || s === status || (counts[s] || 0) > 0);
    const items = keys.map((s) => {
      if (s === "all") return { value: "all", label: "ทุกสถานะ", count: counts.all || 0, unit: "ใบ", icon: <Apps />, color: "#475569" };
      if (s === "late") return { value: "late", label: "เลยวันต้องใช้", shortLabel: "เลยกำหนด", count: counts.late || 0, unit: "ใบ", icon: <WarningAmber />, color: "#dc2626", alert: true };
      const st = prStatus(s);
      const Icon = STATUS_ICON[s] || Apps;
      return { value: s, label: st.label, shortLabel: st.short || String(st.label).split(" · ")[0], count: counts[s] || 0, unit: "ใบ", icon: <Icon />, color: st.color, alert: s === "rejected" };
    });
    return <ViewTiles value={status} onChange={setStatus} isMobile={!isDesktop} groups={[{ title: "", items }]} />;
  })();

  const groups = view === "inbox" ? [
    ...(can("reviewExpense") ? [{ key: "pending", title: "รอตรวจสอบ", hint: "ตรวจรายการ ความจำเป็น และราคาประมาณการ", rows: base.filter((r) => r.status === "pending") }] : []),
    ...(can("approveExpense") ? [{ key: "reviewed", title: "รออนุมัติ", hint: "ตรวจสอบแล้ว รอผู้อนุมัติ", rows: base.filter((r) => r.status === "reviewed") }] : []),
    ...(canBuy ? [
      { key: "approved", title: "รอสั่งซื้อ", hint: "อนุมัติแล้ว — บันทึกร้านค้า เลขที่ PO และราคาจริง", rows: base.filter((r) => r.status === "approved") },
      { key: "ordered", title: "รอรับของ", hint: "สั่งซื้อแล้ว — บันทึกรับของเมื่อของมาถึง", rows: base.filter((r) => ["ordered", "partial"].includes(r.status)) },
    ] : []),
  ].filter((g) => g.rows.length) : [];

  const renderRows = (list) => (isDesktop ? <DesktopTable rows={list} onOpen={openDetail} avatars={avatars} />
    : <Stack spacing={1}>{list.map((r) => <MobileCard key={r._id} r={r} onOpen={openDetail} avatars={avatars} />)}</Stack>);
  const empty = (text, action) => (
    <Stack alignItems="center" spacing={1.25} sx={{ py: 6, px: 2, bgcolor: "#fff", border: `1px dashed ${BORDER_MAIN}`, borderRadius: 2.5, textAlign: "center" }}>
      <Inbox sx={{ fontSize: 44, color: "#cbd5e1" }} />
      <Typography sx={{ fontWeight: 700, color: TEXT_SUB }}>{text}</Typography>
      {action}
    </Stack>
  );

  return (
    <Box sx={{ p: { xs: 1.25, sm: 2.5 }, maxWidth: 1500, mx: "auto" }}>
      {/* ── หัวเพจ (โครงเดียวกับหน้าใบเบิก) ── */}
      <Box sx={{ borderRadius: 3, border: `1px solid ${BORDER_MAIN}`, bgcolor: "#fff", px: { xs: 1.5, sm: 2 }, py: { xs: 1.25, sm: 1.75 }, mb: 1.5 }}>
        <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} spacing={{ xs: 1.25, sm: 2 }}>
          <Stack direction="row" alignItems="center" spacing={{ xs: 1.25, sm: 1.5 }} sx={{ flex: 1, minWidth: 0, position: "relative", pr: { xs: 6, sm: 0 } }}>
            <IconButton aria-label="ค้นหาและตัวกรอง" onClick={() => setFiltersOpen(true)}
              sx={{ display: { xs: "inline-flex", md: "none" }, position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", width: 42, height: 42, borderRadius: 2.5, border: `1px solid ${BORDER_MAIN}`, bgcolor: activeFilters ? alpha(PR_ACCENT, 0.08) : "#fff", color: activeFilters ? PR_ACCENT : TEXT_MAIN }}>
              <Badge badgeContent={activeFilters} color="error" sx={{ "& .MuiBadge-badge": { fontSize: "0.62rem", height: 16, minWidth: 16 } }}><Tune sx={{ fontSize: 21 }} /></Badge>
            </IconButton>
            <Box sx={{ width: { xs: 36, sm: 40 }, height: { xs: 36, sm: 40 }, borderRadius: 2.5, ml: "0 !important", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: PR_ACCENT, color: "#fff" }}>
              <ShoppingCart />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 900, fontSize: { xs: "1.12rem", sm: "1.3rem" }, color: TEXT_MAIN, lineHeight: 1.25 }}>
                {view === "inbox" ? "ใบขอซื้อ · รอดำเนินการ" : "ใบขอซื้อสินค้า (PR)"}
              </Typography>
              <Typography variant="caption" sx={{ color: TEXT_SUB, display: { xs: "none", sm: "block" }, lineHeight: 1.35 }}>
                ขอซื้อ → ตรวจสอบ/อนุมัติ → ฝ่ายจัดซื้อสั่งซื้อ → รับของ · ติดตามได้ทุกขั้น
              </Typography>
              <Box sx={{ display: { xs: "none", sm: "block" } }}>
                <Stack direction="row" spacing={0.75} sx={{ mt: 0.75, overflowX: "auto", "&::-webkit-scrollbar": { display: "none" }, scrollbarWidth: "none" }}>
                  {crossLinks.map((l) => <CrossLink key={l.to} {...l} />)}
                </Stack>
              </Box>
            </Box>
          </Stack>
          <Box sx={{ display: { xs: "block", sm: "none" }, minWidth: 0 }}>
            <Stack direction="row" spacing={0.75} sx={{ overflowX: "auto", "&::-webkit-scrollbar": { display: "none" }, scrollbarWidth: "none" }}>
              {crossLinks.map((l) => <CrossLink key={l.to} {...l} />)}
            </Stack>
          </Box>
          <Box sx={{ flexShrink: 0, display: "flex", flexDirection: { xs: "row", sm: "column" }, alignItems: { xs: "center", sm: "flex-end" }, justifyContent: "space-between", gap: 1, px: 1.5, py: { xs: 1, sm: 0 }, borderRadius: { xs: 2, sm: 0 }, bgcolor: { xs: "#f8fafc", sm: "transparent" }, border: { xs: `1px solid ${BORDER_MAIN}`, sm: 0 }, borderLeft: { sm: `1px solid ${BORDER_MAIN}` } }}>
            <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: TEXT_SUB, whiteSpace: "nowrap" }}>ยอดรอสั่งซื้อ/รับของ</Typography>
            <Typography sx={{ fontWeight: 900, fontSize: { xs: "1.05rem", sm: "1.1rem" }, color: TEXT_MAIN, lineHeight: 1.25, whiteSpace: "nowrap" }}>{baht(waitingAmount)}</Typography>
          </Box>
          <Button variant="contained" startIcon={<Add />} onClick={() => setForm({ open: true, request: null })}
            sx={{ flexShrink: 0, textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", whiteSpace: "nowrap", bgcolor: PR_ACCENT, "&:hover": { bgcolor: PR_DARK, boxShadow: "none" } }}>
            ออกใบขอซื้อ
          </Button>
        </Stack>
      </Box>

      <Box ref={topRef} sx={{ scrollMarginTop: 72 }}>
        {isDesktop ? filterBar : (
          <>
            {activeFilters > 0 && (
              <Stack direction="row" spacing={0.75} useFlexGap sx={{ mb: 1.25, flexWrap: "wrap" }}>
                {status !== "all" && view !== "inbox" && <Chip size="small" label={`สถานะ: ${status === "late" ? "เลยวันต้องใช้" : prStatus(status).short || prStatus(status).label}`} onDelete={() => setStatus("all")} sx={{ fontWeight: 700 }} />}
                {q.trim() && <Chip size="small" label={`ค้นหา: ${q.trim()}`} onDelete={() => setQ("")} sx={{ fontWeight: 700, maxWidth: "100%" }} />}
                {person !== "all" && <Chip size="small" label={`ผู้ขอ: ${selectedName}`} onDelete={() => setPerson("all")} sx={{ fontWeight: 700 }} />}
                {period !== "all" && <Chip size="small" label={PERIODS.find((x) => x.value === period)?.label} onDelete={() => setPeriod("all")} sx={{ fontWeight: 700 }} />}
              </Stack>
            )}
            <Drawer anchor="bottom" open={filtersOpen} onClose={() => setFiltersOpen(false)}
              PaperProps={{ sx: { borderTopLeftRadius: 18, borderTopRightRadius: 18, px: 2, pt: 1, pb: "calc(16px + env(safe-area-inset-bottom))", maxHeight: "85vh" } }}>
              <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: "#cbd5e1", mx: "auto", mb: 1.25 }} />
              <Stack direction="row" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography sx={{ flex: 1, fontWeight: 800, fontSize: "1rem", color: TEXT_MAIN }}>ค้นหาและตัวกรอง</Typography>
                {activeFilters > 0 && <Button size="small" onClick={() => { setQ(""); setPerson("all"); setPeriod("all"); setStatus("all"); }} sx={{ textTransform: "none", fontWeight: 700, color: "#dc2626" }}>ล้างทั้งหมด</Button>}
                <IconButton size="small" aria-label="ปิด" onClick={() => setFiltersOpen(false)}><Close /></IconButton>
              </Stack>
              {filterBar}
              {statusTiles && (
                <Box sx={{ mt: 1.75, "& > div": { mb: 0 } }}>
                  <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: TEXT_SUB, mb: 0.75 }}>สถานะ</Typography>
                  {statusTiles}
                </Box>
              )}
              <Button fullWidth variant="contained" onClick={() => setFiltersOpen(false)}
                sx={{ mt: 2, py: 1.1, textTransform: "none", fontWeight: 800, borderRadius: 2.5, boxShadow: "none", bgcolor: DARK, "&:hover": { bgcolor: "#1e293b", boxShadow: "none" } }}>
                ดูผลลัพธ์ {visible.length.toLocaleString()} ใบ
              </Button>
            </Drawer>
          </>
        )}

        {showPeople && isDesktop && (
          <ResponsibleSummary rows={personRows} unit="ใบ" value={selectedName} onChange={pickPerson} employees={avatarPeople} isMobile={false}
            title="ใบขอซื้อตามผู้ขอ" hint="กดที่ชื่อเพื่อดูเฉพาะใบของคนนั้น · กดซ้ำเพื่อดูทุกคน · ยอดเงิน = ยอดสั่งซื้อจริง (ถ้ามี) หรือยอดประมาณการ (ไม่รวมใบที่ยกเลิก)"
            amountOf={(x) => x.total} formatAmount={baht} />
        )}
        {isDesktop && statusTiles}

        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
        {loading ? <Stack spacing={1}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={isDesktop ? 52 : 96} />)}</Stack>
          : view === "inbox" ? (
            groups.length ? (
              <Stack spacing={2.5}>
                {groups.map((g) => (
                  <Box key={g.key}>
                    <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 1 }}>
                      <Typography sx={{ fontWeight: 800, fontSize: "0.98rem" }}>{g.title}</Typography>
                      <Chip size="small" label={g.rows.length} sx={{ height: 20, fontWeight: 800 }} />
                      <Typography variant="caption" sx={{ color: TEXT_SUB, display: { xs: "none", sm: "inline" } }}>{g.hint}</Typography>
                    </Stack>
                    {renderRows(g.rows)}
                  </Box>
                ))}
              </Stack>
            ) : empty("ไม่มีใบขอซื้อที่รอดำเนินการ 🎉")
          ) : visible.length ? (
            <>
              {renderRows(pageRows)}
              {pageCount > 1 && (
                <Stack alignItems="center" sx={{ mt: 1.5 }}>
                  <Pagination count={pageCount} page={cur} onChange={(_, n) => goPage(n)} shape="rounded" size={isDesktop ? "medium" : "small"} siblingCount={isDesktop ? 1 : 0}
                    sx={{ "& .Mui-selected": { bgcolor: `${DARK} !important`, color: "#fff" } }} />
                </Stack>
              )}
              <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 1, textAlign: "right" }}>
                {pageCount > 1 ? `แสดง ${(cur - 1) * PAGE_SIZE + 1}–${(cur - 1) * PAGE_SIZE + pageRows.length} จาก ` : ""}{visible.length} ใบ · รวม {baht(visible.reduce((s, r) => s + amountOf(r), 0))} (ไม่รวมใบที่ยกเลิก)
              </Typography>
            </>
          ) : empty(
            rows.length ? "ไม่พบรายการตามตัวกรอง" : "ยังไม่มีใบขอซื้อ",
            rows.length ? (
              <Button size="small" variant="outlined" onClick={() => { setStatus("all"); setQ(""); setPerson("all"); setPeriod("all"); }}
                sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, color: TEXT_MAIN, borderColor: BORDER_MAIN }}>ล้างตัวกรอง · ดูทั้งหมด</Button>
            ) : (
              <Button variant="contained" startIcon={<Add />} onClick={() => setForm({ open: true, request: null })}
                sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: PR_ACCENT, "&:hover": { bgcolor: PR_DARK } }}>ออกใบขอซื้อ</Button>
            ),
          )}
      </Box>

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
