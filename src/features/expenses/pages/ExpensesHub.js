/**
 * ExpensesHub — หน้า "เบิกค่าใช้จ่าย" (ใบเบิก Advance · ใบเคลม · รอดำเนินการ · รายงานย้อนหลัง)
 *
 * ✅ URL:
 *   /expenses?tab=advances|claims|approvals|report   เลือกแท็บ (เก็บใน URL ตามแบบ TabbedPage)
 *   /expenses/<id>                                   เปิดใบนั้นทันที — ลิงก์จากแจ้งเตือนทุกตัวชี้มาที่นี่
 *   &status=paid                                     ตัวกรองสถานะเริ่มต้นของแท็บรายการ
 * ⚠️ ปิดกล่องรายละเอียดแล้วต้องถอด /<id> ออกจาก URL (คงแท็บเดิมไว้) ไม่งั้นรีเฟรชหน้าจะเด้งเปิดใบเดิมซ้ำ
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Box, Stack, Typography, Button } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Add, Payments, ReceiptLong, FactCheck, Insights, AccountBalanceWallet } from "@mui/icons-material";

import TabbedPage from "@/shared/ui/TabbedPage";
import usePermissions from "@/shared/hooks/usePermissions";
import ExpenseService from "../services/ExpenseService";
import ExpenseList from "../components/ExpenseList";
import ExpenseFormDialog from "../components/ExpenseFormDialog";
import ExpenseDetailDialog from "../components/ExpenseDetailDialog";
import ExpenseReport from "./ExpenseReport";
import { KIND_META, EXPENSE_ACCENT, baht, TEXT_SUB, TEXT_MAIN, BORDER_MAIN } from "../expenseMeta";

const SummaryCard = ({ label, value, sub, color, onClick, alert }) => (
  <Box
    role="button" onClick={onClick}
    sx={{
      p: { xs: 1.25, sm: 1.5 }, borderRadius: 2.5, cursor: "pointer", minWidth: 0,
      bgcolor: alert ? alpha("#dc2626", 0.05) : "#fff",
      border: `1px solid ${alert ? alpha("#dc2626", 0.35) : BORDER_MAIN}`,
      transition: "border-color .15s, box-shadow .15s",
      "&:hover": { borderColor: color, boxShadow: `0 2px 10px ${alpha(color, 0.12)}` },
    }}
  >
    <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 700, display: "block" }} noWrap>{label}</Typography>
    <Typography sx={{ fontWeight: 900, fontSize: { xs: "1.2rem", sm: "1.45rem" }, color, lineHeight: 1.2 }} noWrap>{value}</Typography>
    <Typography variant="caption" sx={{ color: alert ? "#dc2626" : TEXT_SUB, fontWeight: alert ? 700 : 400, display: "block" }} noWrap>{sub || " "}</Typography>
  </Box>
);

export default function ExpensesHub() {
  const { can } = usePermissions();
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const canRequest = can("requestExpense");
  const canApprove = can("approveExpense");
  const viewAll = can("viewAllExpenses");

  const [summary, setSummary] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [detailId, setDetailId] = useState(routeId || "");
  const [form, setForm] = useState({ open: false, kind: "advance", expense: null, advance: null });
  const [notice, setNotice] = useState(null);

  useEffect(() => { if (routeId) setDetailId(routeId); }, [routeId]);

  useEffect(() => {
    let alive = true;
    ExpenseService.summary().then((s) => alive && setSummary(s)).catch(() => {});
    return () => { alive = false; };
  }, [reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  const openDetail = useCallback((id) => {
    setDetailId(id);
    navigate({ pathname: `/expenses/${id}`, search: location.search }, { replace: Boolean(routeId) });
  }, [navigate, location.search, routeId]);

  const closeDetail = () => {
    setDetailId("");
    setNotice(null);
    if (routeId) navigate({ pathname: "/expenses", search: location.search }, { replace: true });
  };

  const goTab = (tab, status) => {
    const next = new URLSearchParams();
    next.set("tab", tab);
    if (status) next.set("status", status);
    navigate({ pathname: "/expenses", search: `?${next.toString()}` }, { replace: true });
  };

  const openCreate = (kind, advance = null) => setForm({ open: true, kind, expense: null, advance });

  const onSaved = (expense, { created, warn }) => {
    setForm((f) => ({ ...f, open: false }));
    refresh();
    setNotice({ severity: warn ? "warning" : "success", text: warn || (created ? `ส่ง${KIND_META[expense.kind].label} ${expense.docNo} แล้ว — รออนุมัติ` : "บันทึกการแก้ไขแล้ว") });
    if (expense?._id) openDetail(expense._id);
  };

  const tabs = useMemo(() => [
    {
      key: "advances", label: "ใบเบิก Advance", icon: <Payments sx={{ fontSize: 18 }} />,
      render: () => <ExpenseList mode="advance" onOpen={openDetail} onCreate={(k) => openCreate(k)} reloadKey={reloadKey} />,
    },
    {
      key: "claims", label: "ใบเคลม", icon: <ReceiptLong sx={{ fontSize: 18 }} />,
      render: () => <ExpenseList mode="claim" onOpen={openDetail} onCreate={(k) => openCreate(k)} reloadKey={reloadKey} />,
    },
    canApprove && {
      key: "approvals",
      label: `รอดำเนินการ${summary ? ` (${(summary.pending || 0) + (summary.toPay || 0) + (summary.toSettle || 0)})` : ""}`,
      icon: <FactCheck sx={{ fontSize: 18 }} />,
      render: () => <ExpenseList mode="inbox" onOpen={openDetail} reloadKey={reloadKey} />,
    },
    {
      key: "report", label: "รายงานย้อนหลัง", icon: <Insights sx={{ fontSize: 18 }} />,
      render: () => <ExpenseReport onOpen={openDetail} reloadKey={reloadKey} />,
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openCreate ไม่ขึ้นกับ state ที่เปลี่ยน
  ], [canApprove, summary, reloadKey, openDetail]);

  if (!canRequest && !viewAll) return <Navigate to="/dashboard" replace />;

  const activeTab = searchParams.get("tab");

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2.5 }, maxWidth: 1500, mx: "auto" }}>
      {/* ── หัวหน้าเพจ ─────────────────────────────────────────────── */}
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} spacing={{ xs: 1.25, sm: 2 }} sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{
            width: 42, height: 42, borderRadius: 2.5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            bgcolor: alpha(EXPENSE_ACCENT, 0.12), color: EXPENSE_ACCENT,
          }}>
            <AccountBalanceWallet />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 900, fontSize: { xs: "1.15rem", sm: "1.35rem" }, color: TEXT_MAIN, lineHeight: 1.25 }}>เบิกค่าใช้จ่าย</Typography>
            <Typography variant="caption" sx={{ color: TEXT_SUB }}>
              {viewAll ? "ใบเบิก Advance และใบเคลมของทุกคน · อนุมัติ · จ่ายเงิน · ติดตามยอดค้าง" : "เบิกเงินล่วงหน้า แล้วเคลียร์ด้วยใบเคลมพร้อมใบเสร็จ"}
            </Typography>
          </Box>
        </Stack>
        {(canRequest || viewAll) && (
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained" startIcon={<Add />} onClick={() => openCreate("advance")}
              sx={{ flex: { xs: 1, sm: "none" }, textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", whiteSpace: "nowrap", bgcolor: KIND_META.advance.color, "&:hover": { bgcolor: KIND_META.advance.dark, boxShadow: "none" } }}
            >
              ออกใบ Advance
            </Button>
            <Button
              variant="outlined" startIcon={<ReceiptLong />} onClick={() => openCreate("claim")}
              sx={{ flex: { xs: 1, sm: "none" }, textTransform: "none", fontWeight: 800, borderRadius: 2, whiteSpace: "nowrap", bgcolor: "#fff", color: KIND_META.claim.color, borderColor: alpha(KIND_META.claim.color, 0.5) }}
            >
              ออกใบเคลม
            </Button>
          </Stack>
        )}
      </Stack>

      {/* ── ตัวเลขสรุป (กดแล้วพาไปรายการที่ตรงกัน) ─────────────────────── */}
      {activeTab !== "report" && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, 1fr)" }, gap: 1, mb: 0.5 }}>
          <SummaryCard label="รออนุมัติ" value={summary ? summary.pending : "–"} sub={canApprove ? "แตะเพื่อพิจารณา" : "ใบของคุณที่รอหัวหน้า"} color="#d97706"
            onClick={() => (canApprove ? goTab("approvals") : goTab("advances", "pending"))} />
          <SummaryCard label="อนุมัติแล้ว รอจ่าย" value={summary ? summary.toPay : "–"} sub="ใบ Advance" color="#2563eb" onClick={() => goTab("advances", "approved")} />
          <SummaryCard label="รับเงินแล้ว รอเคลียร์" value={summary ? summary.awaitingClaim : "–"}
            sub={summary?.overdueClear ? `เลยกำหนด ${summary.overdueClear} ใบ` : "ยังไม่ส่งใบเคลม"} alert={summary?.overdueClear > 0}
            color="#0369a1" onClick={() => goTab("advances", summary?.overdueClear ? "overdue" : "paid")} />
          <SummaryCard label="รอปิดส่วนต่าง" value={summary ? summary.toSettle : "–"} sub="ใบเคลม รอคืน/จ่ายเพิ่ม" color={KIND_META.claim.color} onClick={() => goTab("claims", "approved")} />
          <Box sx={{ gridColumn: { xs: "1 / -1", md: "auto" } }}>
            <SummaryCard label="ยอดเงินค้างเคลียร์" value={summary ? baht(summary.outstandingAmount) : "–"} sub="Advance ที่จ่ายแล้ว ยังไม่เคลียร์" color={EXPENSE_ACCENT} onClick={() => goTab("report")} />
          </Box>
        </Box>
      )}

      {/* ⚠️ key ผูกกับตัวกรองสถานะใน URL — การ์ดสรุปเปลี่ยน ?status= แล้วรายการต้องเริ่มตัวกรองใหม่ */}
      <TabbedPage key={searchParams.get("status") || "-"} tabs={tabs} accent={EXPENSE_ACCENT} />

      <ExpenseDetailDialog
        open={Boolean(detailId)}
        expenseId={detailId}
        reloadKey={reloadKey}
        notice={notice}
        onClose={closeDetail}
        onChanged={refresh}
        onOpenOther={(id) => { setNotice(null); openDetail(id); }}
        onEdit={(expense) => setForm({ open: true, kind: expense.kind, expense, advance: null })}
        onCreateClaim={(advance) => openCreate("claim", advance)}
      />

      <ExpenseFormDialog
        open={form.open}
        kind={form.kind}
        expense={form.expense}
        advance={form.advance}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
        onSaved={onSaved}
      />

    </Box>
  );
}
