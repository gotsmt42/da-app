/**
 * PurchaseReport — รายงานใบขอซื้อสินค้า (PR) แยกเป็นหน้าของตัวเอง (/purchase/report)
 *
 * ✅ ผู้ใช้สั่ง (2 ต.ค. 2569): "ทำรายงานแยกออกมาด้วย เอกสารจัดซื้อ PR"
 *   ตอบคำถามฝ่ายจัดซื้อ/ผู้บริหาร: ขอซื้อไปเท่าไร · ซื้อจริงเท่าไร (ประหยัดได้เท่าไร) · ค้างอยู่ขั้นไหน ·
 *   ของยังไม่มาเท่าไร · ซื้อร้านไหนมากสุด · งานไหนใช้ของเท่าไร · สินค้าอะไรซื้อบ่อย
 * ⚠️ คำนวณจากรายการใบที่ server คืนมา (server กรองสิทธิ์แล้ว — คนทั่วไปเห็นเฉพาะใบของตัวเอง)
 * ⚠️ หน้าตา/ตัวกรองชุดเดียวกับรายงานการเบิก (ExpenseReport) — ช่วงเวลาอิงวันที่ของใบขอซื้อ
 */
import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, Navigate, useNavigate } from "react-router-dom";
import moment from "moment";
import {
  Box, Stack, Typography, Button, Alert, Skeleton, Table, TableHead, TableRow, TableCell, TableBody, Chip,
  ToggleButtonGroup, ToggleButton, Tooltip, useMediaQuery, Pagination,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { FileDownload, Insights, ChevronRight, Assessment, WarningAmber } from "@mui/icons-material";

import usePermissions from "@/shared/hooks/usePermissions";
import useRealtime from "@/shared/realtime/useRealtime";
import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import SelectField from "@/shared/ui/SelectField";
import { thaiDate, THAI_MONTHS_SHORT } from "@/shared/utils/thaiDate";
import PurchaseService, { errorText } from "../services/PurchaseService";
import PrStatusBadge from "../components/PrStatusBadge";
import { PR_ACCENT, PR_DARK, TEXT_MAIN, TEXT_SUB, BORDER_MAIN, STATUS_ORDER, prStatus, baht, fmtQty, prJobText } from "../prMeta";
import { buildPrReport, isLate, pendingReceiveOf } from "../utils/prReport";

const PRESETS = [
  { value: "month", label: "เดือนนี้", range: () => [moment().startOf("month"), moment()] },
  { value: "lastMonth", label: "เดือนที่แล้ว", range: () => [moment().subtract(1, "month").startOf("month"), moment().subtract(1, "month").endOf("month")] },
  { value: "quarter", label: "ไตรมาสนี้", range: () => [moment().startOf("quarter"), moment()] },
  { value: "year", label: "ปีนี้", range: () => [moment().startOf("year"), moment()] },
  { value: "12m", label: "12 เดือนล่าสุด", range: () => [moment().subtract(11, "months").startOf("month"), moment()] },
  { value: "all", label: "ทั้งหมด", range: () => [null, null] },
  { value: "custom", label: "กำหนดเอง", range: null },
];
const ROWS_PER_PAGE = 15;
const EST = "#94a3b8";
const TABLE_SX = { "& th": { fontWeight: 800, color: TEXT_SUB, fontSize: "0.74rem", whiteSpace: "nowrap", bgcolor: "#f8fafc" }, "& td": { fontSize: "0.82rem", borderColor: BORDER_MAIN } };

const monthLabel = (key) => {
  const [y, m] = String(key).split("-").map(Number);
  return y ? `${THAI_MONTHS_SHORT[m - 1]} ${String(y + 543).slice(-2)}` : "-";
};

const Kpi = ({ label, value, sub, color = TEXT_MAIN, highlight }) => (
  <Box sx={{ p: { xs: 1.25, sm: 1.75 }, borderRadius: 2.5, bgcolor: highlight ? alpha(color, 0.06) : "#fff", border: `1px solid ${highlight ? alpha(color, 0.35) : BORDER_MAIN}`, minWidth: 0 }}>
    <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 700, display: "block", lineHeight: 1.3 }} noWrap>{label}</Typography>
    <Typography sx={{ fontWeight: 900, fontSize: { xs: "1.08rem", sm: "1.3rem" }, color, lineHeight: 1.25, mt: 0.25 }} noWrap>{value}</Typography>
    {sub && <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }} noWrap>{sub}</Typography>}
  </Box>
);

const Panel = ({ title, hint, children, action }) => (
  <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 2.5, p: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800, fontSize: "0.95rem" }}>{title}</Typography>
        {hint && <Typography variant="caption" sx={{ color: TEXT_SUB }}>{hint}</Typography>}
      </Box>
      {action}
    </Stack>
    {children}
  </Box>
);

/** สถานะตามขั้น — แถบยาวเดียว แบ่งสัดส่วนตามจำนวนใบ + รายการตัวเลขข้างใต้ */
const StatusPipeline = ({ byStatus, total }) => {
  const keys = STATUS_ORDER.filter((s) => byStatus[s]?.count);
  return (
    <Box>
      <Stack direction="row" sx={{ height: 12, borderRadius: 6, overflow: "hidden", bgcolor: "#f1f5f9" }}>
        {keys.map((s) => (
          <Tooltip key={s} arrow title={`${prStatus(s).label} · ${byStatus[s].count} ใบ`}>
            <Box sx={{ width: `${(byStatus[s].count / Math.max(total, 1)) * 100}%`, bgcolor: prStatus(s).color }} />
          </Tooltip>
        ))}
      </Stack>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" }, gap: 1, mt: 1.25 }}>
        {keys.map((s) => {
          const st = prStatus(s);
          return (
            <Stack key={s} direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, p: 1, borderRadius: 2, border: `1px solid ${BORDER_MAIN}` }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: st.color, flexShrink: 0 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: "0.78rem", fontWeight: 700, color: TEXT_MAIN }}>{st.short || st.label}</Typography>
                <Typography noWrap variant="caption" sx={{ color: TEXT_SUB }}>{byStatus[s].count} ใบ · {baht(byStatus[s].amount)}</Typography>
              </Box>
            </Stack>
          );
        })}
      </Box>
    </Box>
  );
};

/** กราฟแท่งรายเดือน: ประมาณการ vs สั่งซื้อจริง (CSS ล้วน แบบเดียวกับรายงานการเบิก) */
const MonthBars = ({ rows }) => {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.est, r.actual)));
  if (!rows.length) return <Typography variant="body2" sx={{ color: TEXT_SUB }}>ไม่มีข้อมูล</Typography>;
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Stack direction="row" spacing={1.25} alignItems="flex-end" sx={{ height: 190, minWidth: rows.length * 52, pt: 1 }}>
        {rows.map((r) => (
          <Tooltip key={r.key} arrow title={`${monthLabel(r.key)} · ${r.count} ใบ · ประมาณการ ${baht(r.est)} · สั่งซื้อจริง ${baht(r.actual)}`}>
            <Stack alignItems="center" sx={{ flex: 1, minWidth: 40, height: "100%" }} justifyContent="flex-end">
              <Stack direction="row" spacing={0.4} alignItems="flex-end" sx={{ height: "calc(100% - 22px)", width: "100%", justifyContent: "center" }}>
                <Box sx={{ width: "38%", maxWidth: 18, height: `${(r.est / max) * 100}%`, minHeight: r.est ? 3 : 0, bgcolor: EST, borderRadius: "4px 4px 0 0" }} />
                <Box sx={{ width: "38%", maxWidth: 18, height: `${(r.actual / max) * 100}%`, minHeight: r.actual ? 3 : 0, bgcolor: PR_ACCENT, borderRadius: "4px 4px 0 0" }} />
              </Stack>
              <Typography sx={{ fontSize: "0.68rem", color: TEXT_SUB, mt: 0.5, whiteSpace: "nowrap" }}>{monthLabel(r.key)}</Typography>
            </Stack>
          </Tooltip>
        ))}
      </Stack>
      <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
        {[["ประมาณการ (ขอซื้อ)", EST], ["สั่งซื้อจริง", PR_ACCENT]].map(([l, c]) => (
          <Stack key={l} direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: c }} />
            <Typography variant="caption" sx={{ color: TEXT_SUB }}>{l}</Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
};

/** ร้านค้า — แถบแนวนอนตามยอดสั่งซื้อจริง (สูงสุด 8 ร้าน) */
const SupplierBars = ({ rows }) => {
  const list = rows.slice(0, 8);
  const max = Math.max(1, ...list.map((r) => r.actual));
  if (!list.length) return <Typography variant="body2" sx={{ color: TEXT_SUB }}>ยังไม่มีใบที่สั่งซื้อในช่วงนี้</Typography>;
  return (
    <Stack spacing={1.25}>
      {list.map((r) => (
        <Box key={r.key}>
          <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 0.4 }}>
            <Typography noWrap sx={{ fontSize: "0.82rem", fontWeight: 700, minWidth: 0 }}>{r.label}</Typography>
            <Typography sx={{ fontSize: "0.78rem", color: TEXT_SUB, whiteSpace: "nowrap" }}>{r.count} ใบ · <b style={{ color: TEXT_MAIN }}>{baht(r.actual)}</b></Typography>
          </Stack>
          <Box sx={{ height: 8, borderRadius: 4, bgcolor: "#f1f5f9", overflow: "hidden" }}>
            <Box sx={{ height: "100%", width: `${(r.actual / max) * 100}%`, bgcolor: PR_ACCENT, borderRadius: 4 }} />
          </Box>
        </Box>
      ))}
    </Stack>
  );
};

const GroupTable = ({ rows, firstHeader, onPick }) => (
  <Box sx={{ overflowX: "auto" }}>
    <Table size="small" sx={{ minWidth: 720, ...TABLE_SX }}>
      <TableHead>
        <TableRow>
          <TableCell>{firstHeader}</TableCell>
          <TableCell align="right">ใบ</TableCell>
          <TableCell align="right">ประมาณการ</TableCell>
          <TableCell align="right">สั่งซื้อจริง</TableCell>
          <TableCell align="right">รออนุมัติ</TableCell>
          <TableCell align="right">รอสั่งซื้อ</TableCell>
          <TableCell align="right">ของค้างรับ</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.key} hover={Boolean(onPick)} onClick={onPick ? () => onPick(r) : undefined} sx={{ cursor: onPick ? "pointer" : "default" }}>
            <TableCell sx={{ fontWeight: 700, maxWidth: 300 }}>
              <Typography noWrap sx={{ fontSize: "inherit", fontWeight: "inherit" }}>
                {r.label}{r.late ? <WarningAmber titleAccess={`เลยวันต้องใช้ ${r.late} ใบ`} sx={{ fontSize: 14, color: "#dc2626", ml: 0.5, verticalAlign: "-2px" }} /> : null}
              </Typography>
            </TableCell>
            <TableCell align="right">{r.count}</TableCell>
            <TableCell align="right" sx={{ color: TEXT_SUB }}>{baht(r.est)}</TableCell>
            <TableCell align="right" sx={{ fontWeight: 800 }}>{r.actual ? baht(r.actual) : "—"}</TableCell>
            <TableCell align="right" sx={{ color: r.waitApproval ? prStatus("pending").color : TEXT_SUB }}>{r.waitApproval ? baht(r.waitApproval) : "—"}</TableCell>
            <TableCell align="right" sx={{ color: r.waitOrder ? prStatus("approved").color : TEXT_SUB }}>{r.waitOrder ? baht(r.waitOrder) : "—"}</TableCell>
            <TableCell align="right" sx={{ color: r.pendingReceive ? prStatus("ordered").color : TEXT_SUB, fontWeight: r.pendingReceive ? 700 : 400 }}>{r.pendingReceive ? baht(r.pendingReceive) : "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </Box>
);

export default function PurchaseReport() {
  const { can } = usePermissions();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery("(min-width:900px)");
  const canUse = can("requestPurchase") || can("viewAllExpenses");
  const viewAll = can("viewAllExpenses");

  const [preset, setPreset] = useState("year");
  const [from, setFrom] = useState(moment().startOf("year").format("YYYY-MM-DD"));
  const [to, setTo] = useState(moment().format("YYYY-MM-DD"));
  const [person, setPerson] = useState("all");
  const [group, setGroup] = useState("person");
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [page, setPage] = useState(1);

  useRealtime("purchase", () => setReloadKey((k) => k + 1));
  useEffect(() => {
    if (!canUse) return undefined;
    let alive = true;
    PurchaseService.list()
      .then((r) => alive && setAllRows(r))
      .catch((err) => alive && setError(errorText(err, "โหลดรายงานไม่สำเร็จ")))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [reloadKey, canUse]);
  useEffect(() => { setPage(1); }, [from, to, person]);

  const applyPreset = (value) => {
    setPreset(value);
    const p = PRESETS.find((x) => x.value === value);
    if (!p?.range) return;
    const [a, b] = p.range();
    setFrom(a ? a.format("YYYY-MM-DD") : "");
    setTo(b ? b.format("YYYY-MM-DD") : "");
  };

  // ช่วงเวลา (วันที่ใบ) → ใช้กับทั้งหน้า · ผู้ขอกรองหลังจากนั้น (ตัวเลือกผู้ขอยังเห็นครบทุกคนในช่วง)
  const inRange = useMemo(() => allRows.filter((r) => {
    const d = moment(r.docDate);
    return (!from || d.isSameOrAfter(from, "day")) && (!to || d.isSameOrBefore(to, "day"));
  }), [allRows, from, to]);
  const rows = useMemo(() => inRange
    .filter((r) => person === "all" || String(r.requester?.userId || "") === person)
    .sort((a, b) => String(b.docNo).localeCompare(String(a.docNo), "en", { numeric: true })), [inRange, person]);
  const personOptions = useMemo(() => {
    const m = new Map();
    inRange.forEach((r) => {
      const id = String(r.requester?.userId || "");
      if (!id) return;
      const p = m.get(id) || { id, name: r.requester?.name || "-", count: 0 };
      p.count += 1;
      m.set(id, p);
    });
    return [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "th"));
  }, [inRange]);

  const report = useMemo(() => buildPrReport(rows), [rows]);
  const t = report.totals;
  const periodLabel = from || to ? `${from ? thaiDate(from) : "เริ่มต้น"} – ${to ? thaiDate(to) : "ปัจจุบัน"}` : "ทั้งหมด";
  const pageCount = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  const cur = Math.min(page, pageCount);
  const pageRows = rows.slice((cur - 1) * ROWS_PER_PAGE, cur * ROWS_PER_PAGE);

  if (!canUse) return <Navigate to="/dashboard" replace />;

  const openPr = (id) => navigate(`/purchase/${id}`);
  const doExport = async () => {
    setExporting(true);
    try {
      const { exportPrReport } = await import("../utils/prExcelExport");
      await exportPrReport(report, rows, { periodLabel, fileName: `รายงานใบขอซื้อ ${moment().format("YYYY-MM-DD")}` });
    } catch (err) {
      setError(errorText(err, "ส่งออก Excel ไม่สำเร็จ"));
    } finally {
      setExporting(false);
    }
  };

  const groupMeta = {
    person: { title: "สรุปตามผู้ขอซื้อ", hint: "ใครขอซื้อไปเท่าไร · ค้างอยู่ขั้นไหน", header: "ผู้ขอซื้อ", rows: report.byPerson },
    job: { title: "สรุปตามงาน / โครงการ", hint: "งานไหนใช้ของไปเท่าไร", header: "งาน / โครงการ", rows: report.byJob },
    supplier: { title: "สรุปตามร้านค้า", hint: "เฉพาะใบที่สั่งซื้อแล้ว", header: "ร้านค้า", rows: report.bySupplier },
  }[group];

  return (
    <Box sx={{ px: { xs: 0, sm: 2.5 }, py: { xs: 1.25, sm: 2.5 }, maxWidth: 1500, mx: "auto" }}>
      {/* ── หัวเพจ (โครงเดียวกับหน้าใบขอซื้อ) ── */}
      <Box sx={{ borderRadius: 3, border: `1px solid ${BORDER_MAIN}`, bgcolor: "#fff", px: { xs: 1.5, sm: 2 }, py: { xs: 1.25, sm: 1.75 }, mb: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={{ xs: 1.25, sm: 1.5 }}>
          <Box sx={{ width: { xs: 36, sm: 40 }, height: { xs: 36, sm: 40 }, borderRadius: 2.5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: PR_ACCENT, color: "#fff" }}>
            <Assessment />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontWeight: 900, fontSize: { xs: "1.12rem", sm: "1.3rem" }, color: TEXT_MAIN, lineHeight: 1.25 }}>รายงานการจัดซื้อ (PR)</Typography>
            <Typography variant="caption" sx={{ color: TEXT_SUB, display: { xs: "none", sm: "block" } }}>
              ยอดขอซื้อ · ซื้อจริง · ค้างอนุมัติ/สั่งซื้อ/รับของ · ตามผู้ขอ งาน และร้านค้า
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ mt: 0.75, overflowX: "auto", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
              {[{ to: "/purchase", label: "ใบขอซื้อ" }, ...(can("reviewExpense") || can("approveExpense") || viewAll ? [{ to: "/purchase/approvals", label: "รอดำเนินการ" }] : [])].map((l) => (
                <Chip key={l.to} component={RouterLink} to={l.to} clickable size="small"
                  label={<span>{l.label} <ChevronRight sx={{ fontSize: 13, verticalAlign: "-2px" }} /></span>}
                  sx={{ height: 26, fontWeight: 700, fontSize: "0.76rem", bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, color: TEXT_SUB, "& .MuiChip-label": { px: 1 } }} />
              ))}
            </Stack>
          </Box>
        </Stack>
      </Box>

      {/* ── ตัวกรอง ── */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}
        sx={{ mb: 1.5, p: 1, bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 3, boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}>
        <SelectField label="ช่วงเวลา" value={preset} onChange={(e) => applyPreset(e.target.value)} sx={{ minWidth: 170 }}>
          {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </SelectField>
        {preset === "custom" && (
          <Stack direction="row" spacing={1}>
            <Box sx={{ flex: 1, minWidth: 150 }}><ThaiDatePicker label="ตั้งแต่" value={from} onChange={(v) => setFrom(v || "")} /></Box>
            <Box sx={{ flex: 1, minWidth: 150 }}><ThaiDatePicker label="ถึง" value={to} onChange={(v) => setTo(v || "")} /></Box>
          </Stack>
        )}
        {viewAll && personOptions.length > 1 && (
          <SelectField label="ผู้ขอซื้อ" value={person} onChange={(e) => setPerson(e.target.value)} sx={{ minWidth: 200 }}>
            <option value="all">ทุกคน ({inRange.length})</option>
            {personOptions.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.count})</option>)}
          </SelectField>
        )}
        <Box sx={{ flex: 1, display: { xs: "none", md: "block" } }} />
        <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 600 }}>{periodLabel} · อิงวันที่ของใบขอซื้อ</Typography>
        <Button variant="outlined" startIcon={<FileDownload />} onClick={doExport} disabled={loading || exporting || !rows.length}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, bgcolor: "#fff" }}>
          {exporting ? "กำลังส่งออก..." : "ส่งออก Excel"}
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}

      {loading ? (
        <Stack spacing={1.5}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(6, 1fr)" }, gap: 1 }}>
            {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} variant="rounded" height={82} />)}
          </Box>
          <Skeleton variant="rounded" height={240} />
        </Stack>
      ) : !rows.length ? (
        <Stack alignItems="center" spacing={1} sx={{ py: 6, bgcolor: "#fff", border: `1px dashed ${BORDER_MAIN}`, borderRadius: 2.5 }}>
          <Insights sx={{ fontSize: 44, color: "#cbd5e1" }} />
          <Typography sx={{ fontWeight: 700, color: TEXT_SUB }}>ไม่มีใบขอซื้อในช่วงเวลานี้</Typography>
        </Stack>
      ) : (
        <Stack spacing={1.5}>
          {/* ── ตัวเลขหลัก ── */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)", lg: "repeat(6, 1fr)" }, gap: 1 }}>
            <Kpi label="ยอดขอซื้อ (ประมาณการ)" value={baht(t.est)} sub={`${t.count} ใบ${report.byStatus.cancelled ? ` · ยกเลิก ${report.byStatus.cancelled.count}` : ""}`} />
            <Kpi label="สั่งซื้อจริง" value={baht(t.actual)} sub={`${t.ordered} ใบ · รับครบ ${t.received} ใบ`} color={PR_ACCENT} />
            <Kpi label="ประหยัดจากประมาณการ" value={baht(report.saving)}
              sub={report.saving ? `${report.savingPct > 0 ? "ต่ำกว่า" : "สูงกว่า"}ประมาณการ ${Math.abs(report.savingPct)}%` : "เทียบเฉพาะใบที่สั่งซื้อแล้ว"}
              color={report.saving < 0 ? "#b91c1c" : "#15803d"} />
            <Kpi label="รอตรวจสอบ/อนุมัติ" value={baht(t.waitApproval)} sub={`${(report.byStatus.pending?.count || 0) + (report.byStatus.reviewed?.count || 0)} ใบ`} color={prStatus("pending").color} />
            <Kpi label="อนุมัติแล้ว · รอสั่งซื้อ" value={baht(t.waitOrder)} sub={`${report.byStatus.approved?.count || 0} ใบ`} color={prStatus("approved").color} highlight={Boolean(report.byStatus.approved?.count)} />
            <Kpi label="ของค้างรับ (มูลค่า)" value={baht(t.pendingReceive)} sub={t.late ? `เลยวันต้องใช้ ${t.late} ใบ` : "ไม่มีใบเลยวันต้องใช้"}
              color={prStatus("ordered").color} highlight={t.late > 0} />
          </Box>

          <Panel title="สถานะใบขอซื้อ" hint="ขอซื้อ → ตรวจสอบ/อนุมัติ → สั่งซื้อ → รับของ · จำนวนใบและยอดในแต่ละขั้น">
            <StatusPipeline byStatus={report.byStatus} total={rows.length} />
          </Panel>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "3fr 2fr" }, gap: 1.5 }}>
            <Panel title="รายเดือน" hint="ยอดขอซื้อ (ประมาณการ) เทียบ สั่งซื้อจริง"><MonthBars rows={report.byMonth} /></Panel>
            <Panel title="ร้านค้าที่สั่งซื้อมากที่สุด" hint="ตามยอดสั่งซื้อจริง"><SupplierBars rows={report.bySupplier} /></Panel>
          </Box>

          <Panel
            title={groupMeta.title}
            hint={groupMeta.hint}
            action={(
              <ToggleButtonGroup size="small" exclusive value={group} onChange={(_, v) => v && setGroup(v)}
                sx={{ "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 700, px: 1.5, py: 0.4 } }}>
                <ToggleButton value="person">ผู้ขอ</ToggleButton>
                <ToggleButton value="job">งาน</ToggleButton>
                <ToggleButton value="supplier">ร้านค้า</ToggleButton>
              </ToggleButtonGroup>
            )}
          >
            {groupMeta.rows.length ? (
              <GroupTable rows={groupMeta.rows} firstHeader={groupMeta.header}
                onPick={viewAll && group === "person" ? (r) => { if (personOptions.some((p) => p.id === r.key)) setPerson(r.key); } : undefined} />
            ) : <Typography variant="body2" sx={{ color: TEXT_SUB }}>ไม่มีข้อมูล</Typography>}
          </Panel>

          <Panel title={`สินค้าที่ขอซื้อ (${report.topItems.length} รายการ)`} hint="รวมตามชื่อสินค้าและหน่วย · ราคาใช้ราคาจริงถ้าสั่งซื้อแล้ว · ไม่รวมใบยกเลิก">
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small" sx={{ minWidth: 640, ...TABLE_SX }}>
                <TableHead>
                  <TableRow>
                    <TableCell>สินค้า</TableCell>
                    <TableCell align="right">จำนวนรวม</TableCell>
                    <TableCell align="right">ใบ</TableCell>
                    <TableCell align="right">ราคา/หน่วย</TableCell>
                    <TableCell align="right">มูลค่ารวม</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.topItems.slice(0, 15).map((g) => (
                    <TableRow key={g.key}>
                      <TableCell sx={{ fontWeight: 700, maxWidth: 320 }}><Typography noWrap sx={{ fontSize: "inherit", fontWeight: "inherit" }}>{g.name}</Typography></TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{fmtQty(g.qty)} {g.unit}</TableCell>
                      <TableCell align="right">{g.docs}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap", color: TEXT_SUB }}>
                        {!g.minPrice ? "—" : g.minPrice === g.maxPrice ? baht(g.minPrice) : `${baht(g.minPrice)} – ${baht(g.maxPrice)}`}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800 }}>{baht(g.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            {report.topItems.length > 15 && (
              <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 1 }}>แสดง 15 อันดับแรกตามมูลค่า · ส่งออก Excel เพื่อดูครบทุกรายการ</Typography>
            )}
          </Panel>

          <Panel title={`รายใบขอซื้อ (${rows.length})`} hint="กดที่แถวเพื่อเปิดใบขอซื้อ">
            {isDesktop ? (
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small" sx={{ minWidth: 980, ...TABLE_SX }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>เลขที่ / วันที่</TableCell>
                      <TableCell>ผู้ขอซื้อ</TableCell>
                      <TableCell>เรื่อง · งาน</TableCell>
                      <TableCell>ร้านค้า · PO</TableCell>
                      <TableCell align="right">ประมาณการ</TableCell>
                      <TableCell align="right">สั่งซื้อจริง</TableCell>
                      <TableCell>สถานะ</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pageRows.map((r) => (
                      <TableRow key={r._id} hover onClick={() => openPr(r._id)} sx={{ cursor: "pointer" }}>
                        <TableCell sx={{ whiteSpace: "nowrap" }}><b>{r.docNo}</b><br /><span style={{ color: TEXT_SUB }}>{thaiDate(r.docDate)}</span></TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{r.requester?.name || "-"}</TableCell>
                        <TableCell sx={{ maxWidth: 320 }}>
                          <Typography noWrap sx={{ fontSize: "inherit", fontWeight: 600 }}>{r.subject}</Typography>
                          <Typography noWrap variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>{r.eventId ? prJobText(r.job) : "ไม่ผูกงาน"}</Typography>
                        </TableCell>
                        <TableCell sx={{ maxWidth: 200 }}>
                          <Typography noWrap sx={{ fontSize: "inherit" }}>{r.order?.supplier || "—"}</Typography>
                          {r.order?.poNo && <Typography noWrap variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>PO {r.order.poNo}</Typography>}
                        </TableCell>
                        <TableCell align="right" sx={{ color: r.status === "cancelled" ? TEXT_SUB : TEXT_MAIN, textDecoration: r.status === "cancelled" ? "line-through" : "none" }}>{baht(r.estTotal)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800 }}>
                          {r.actualTotal ? baht(r.actualTotal) : "—"}
                          {pendingReceiveOf(r) > 0 && <span style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: prStatus("ordered").color }}>ค้างรับ {baht(pendingReceiveOf(r))}</span>}
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <PrStatusBadge status={r.status} short />
                            {isLate(r) && <WarningAmber titleAccess="เลยวันต้องใช้" sx={{ fontSize: 16, color: "#dc2626" }} />}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            ) : (
              <Stack spacing={1}>
                {pageRows.map((r) => {
                  const st = prStatus(r.status);
                  return (
                    <Box key={r._id} onClick={() => openPr(r._id)} sx={{ p: 1.25, border: `1px solid ${BORDER_MAIN}`, borderLeft: `4px solid ${st.color}`, borderRadius: 2, cursor: "pointer" }}>
                      <Stack direction="row" justifyContent="space-between" spacing={1}>
                        <Typography sx={{ fontWeight: 800, fontSize: "0.82rem" }}>{r.docNo}</Typography>
                        <Typography sx={{ fontWeight: 800, fontSize: "0.9rem" }}>{baht(r.actualTotal || r.estTotal)}</Typography>
                      </Stack>
                      <Typography sx={{ fontWeight: 600, fontSize: "0.86rem" }} noWrap>{r.subject}</Typography>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
                        <Typography variant="caption" sx={{ color: TEXT_SUB }} noWrap>{thaiDate(r.docDate)} · {r.requester?.name}</Typography>
                        <Typography variant="caption" sx={{ color: st.color, fontWeight: 800, whiteSpace: "nowrap" }}>{st.short || st.label}</Typography>
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            )}
            {pageCount > 1 && (
              <Stack alignItems="center" sx={{ mt: 1.5 }}>
                <Pagination count={pageCount} page={cur} onChange={(_, n) => setPage(n)} shape="rounded" size={isDesktop ? "medium" : "small"} siblingCount={isDesktop ? 1 : 0}
                  sx={{ "& .Mui-selected": { bgcolor: `${PR_DARK} !important`, color: "#fff" } }} />
              </Stack>
            )}
          </Panel>
        </Stack>
      )}
    </Box>
  );
}
