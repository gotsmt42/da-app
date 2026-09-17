/**
 * ExpensesPage — โครงหน้าของระบบเบิก ใช้ร่วมกัน 4 หน้าที่ "แยก URL จริง" ไม่ใช่แท็บรวมหน้าเดียว
 *
 *   /expenses/advances    ใบเบิก Advance   (เขียวอมฟ้า)
 *   /expenses/claims      ใบเคลม            (ม่วง)
 *   /expenses/approvals   รอดำเนินการ       (ส้ม — เฉพาะผู้มีสิทธิ์อนุมัติ)
 *   /expenses/report      รายงานย้อนหลัง    (น้ำเงินเข้ม)
 *   /expenses/<id>        เปิดใบนั้นทันที — ลิงก์จากแจ้งเตือนทุกตัวชี้มาที่นี่
 *
 * 🐛 ที่แก้ (ผู้ใช้แจ้ง: "ใบ advance และ claim ควรแยกหน้ากัน ... ดูแล้วรวมๆ งง และดูรก"):
 * เดิมทั้ง 4 มุมมองอยู่ใน URL เดียว (/expenses?tab=) หน้าจอหนึ่งหน้าจึงต้องแบกทุกอย่างพร้อมกัน —
 * หัวข้อรวม + ปุ่มออกใบ 2 ปุ่ม + การ์ดสรุป 5 ใบ (ของทั้งสองชนิดปนกัน) + แถบแท็บ + แถบตัวกรอง +
 * ชิปสถานะ + รายการ = บนมือถือกว่าจะเห็นรายการแรกต้องเลื่อนเกือบสองจอ และ "เลขของใบไหน" ก็แยกไม่ออก
 *
 * ✅ ตอนนี้แต่ละหน้ามีของเฉพาะของตัวเอง: สีประจำชนิดใบ · ปุ่มหลักปุ่มเดียว · ตัวเลขสรุปเฉพาะที่
 * เกี่ยวกับหน้านั้น (แถบเดียว ไม่ใช่การ์ด 5 ใบ) · ชิปสถานะของชนิดนั้น · รายการ
 * ⚠️ การสลับไปอีกหน้าใช้เมนู (แถบล่างมือถือ/เมนูข้าง) เป็นหลัก — ในหน้ามีแค่ลิงก์ข้อความเล็กๆ ไว้
 * เผื่อคนที่เข้ามาจากแจ้งเตือน ไม่เอาแถบแท็บกลับมาอีกเพราะนั่นคือสิ่งที่ทำให้หน้ารกตั้งแต่แรก
 */
import { useCallback, useEffect, useState } from "react";
import useRealtime from "@/shared/realtime/useRealtime";
import { Link as RouterLink, Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Box, Stack, Typography, Button, Chip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Add, Payments, ReceiptLong, FactCheck, Insights, ChevronRight, WarningAmber, AccountBalanceWallet,
} from "@mui/icons-material";

import usePermissions from "@/shared/hooks/usePermissions";
import { refreshAppBadges } from "@/shared/hooks/useAppBadges";
import ExpenseService from "../services/ExpenseService";
import ExpenseList from "../components/ExpenseList";
import ExpenseFormDialog from "../components/ExpenseFormDialog";
import ExpenseDetailDialog from "../components/ExpenseDetailDialog";
import ExpenseReport from "./ExpenseReport";
import { KIND_META, slipMeta, baht, TEXT_SUB, BORDER_MAIN } from "../expenseMeta";

const INBOX_COLOR = "#d97706";
const REPORT_COLOR = "#1d4ed8";

/** ป้ายประจำหน้า — สี/ไอคอน/ชื่อ/คำอธิบาย/ปุ่มหลัก ของแต่ละหน้า */
export const VIEW_META = {
  advance: {
    path: "/expenses/advances",
    title: "ใบเบิก Advance",
    icon: Payments,
    color: KIND_META.advance.color,
    dark: KIND_META.advance.dark,
    soft: KIND_META.advance.soft,
    sub: "ขอเบิกเงินล่วงหน้าไปใช้ในงาน · อนุมัติแล้วรับเงิน แล้วเคลียร์ด้วยใบเคลม",
    action: "ออกใบ Advance",
  },
  claim: {
    path: "/expenses/claims",
    title: "ใบเคลม (Claim)",
    icon: ReceiptLong,
    color: KIND_META.claim.color,
    dark: KIND_META.claim.dark,
    soft: KIND_META.claim.soft,
    sub: "เคลียร์เงิน Advance ที่รับไปแล้ว · หรือเบิกคืนค่าที่สำรองจ่ายเอง",
    action: "ออกใบเคลม",
    /**
     * ✅ ปุ่มที่สองของหน้าใบเคลม — ใบสำรองจ่าย (ผู้ใช้: "บางทีช่างออกค่าใช้จ่ายไปก่อนไม่ advance")
     * ⚠️ ไม่แยกเป็นหน้า/เมนูใหม่โดยตั้งใจ — ผู้ใช้เคยแจ้งว่าเมนูซ้ำหลายจุดแล้วดูรก ใบสองแบบนี้เป็น
     * "ขอเงินคืนตามที่ใช้จริง" เหมือนกัน ต่างแค่เคยรับเงินล่วงหน้าไปหรือยัง จึงอยู่หน้าเดียวกันแล้วแยก
     * ด้วยแถบตัวกรอง + สี + ป้ายชนิดใบ
     */
    action2: { label: "สำรองจ่ายเอง", kind: "reimburse", icon: AccountBalanceWallet },
  },
  inbox: {
    path: "/expenses/approvals",
    title: "รอดำเนินการ",
    icon: FactCheck,
    color: INBOX_COLOR,
    dark: "#b45309",
    soft: "#fffbeb",
    sub: "คิวงานตามขั้น — ตรวจสอบ · อนุมัติ · อนุมัติเบิกจ่าย",
    action: "",
  },
  report: {
    path: "/expenses/report",
    title: "รายงานการเบิก",
    icon: Insights,
    color: REPORT_COLOR,
    dark: "#1e3a8a",
    soft: "#eff6ff",
    sub: "ย้อนหลังตามช่วงเวลา · ใครค้างเท่าไร · งานไหนใช้งบเท่าไร",
    action: "",
  },
};

/** ตัวเลขสรุปแบบ "แถบเดียว" — เล็กกว่าการ์ด กดแล้วกรองในหน้าเดิม ไม่กระโดดไปหน้าอื่น */
const StatPill = ({ label, value, color, active, alert, onClick }) => (
  <Box
    role={onClick ? "button" : undefined}
    onClick={onClick}
    sx={{
      flex: "0 0 auto", minWidth: 118, px: 1.5, py: 1, borderRadius: 2.5, cursor: onClick ? "pointer" : "default",
      bgcolor: active ? alpha(color, 0.1) : "#fff",
      border: `1px solid ${active ? color : alert ? alpha("#dc2626", 0.4) : BORDER_MAIN}`,
      transition: "border-color .15s",
      "&:hover": onClick ? { borderColor: color } : undefined,
    }}
  >
    <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 700, display: "block", lineHeight: 1.3 }} noWrap>
      {alert && <WarningAmber sx={{ fontSize: 13, color: "#dc2626", mr: 0.4, verticalAlign: "-2px" }} />}
      {label}
    </Typography>
    <Typography sx={{ fontWeight: 900, fontSize: "1.15rem", color: alert ? "#dc2626" : color, lineHeight: 1.25 }} noWrap>
      {value}
    </Typography>
  </Box>
);

/** ลิงก์ข้อความเล็กๆ ไปอีกหน้าในระบบเดียวกัน (แทนแถบแท็บเดิม) */
const CrossLink = ({ to, label, color }) => (
  <Chip
    component={RouterLink} to={to} clickable size="small"
    label={<span>{label} <ChevronRight sx={{ fontSize: 13, verticalAlign: "-2px" }} /></span>}
    sx={{ height: 26, fontWeight: 700, fontSize: "0.76rem", bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, color, "& .MuiChip-label": { px: 1 } }}
  />
);

export default function ExpensesPage({ view: viewProp }) {
  const { can } = usePermissions();
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const canRequest = can("requestExpense");
  const canReview = can("reviewExpense");
  const canApprove = can("approveExpense");
  const canDisburse = can("disburseExpense");
  /** เข้ากล่อง "รอดำเนินการ" ได้ทุกคนที่มีขั้นของตัวเอง (ตรวจสอบ / อนุมัติ / อนุมัติเบิกจ่าย) */
  const canHandle = canReview || canApprove || canDisburse;
  const viewAll = can("viewAllExpenses");

  const [summary, setSummary] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [detailId, setDetailId] = useState(routeId || "");
  // ⚠️ เข้ามาจากลิงก์แจ้งเตือน (/expenses/<id>) ยังไม่รู้ว่าเป็นใบชนิดไหนจนกว่ากล่องรายละเอียดจะโหลดเสร็จ
  // — พอรู้แล้วค่อยสลับพื้นหลัง/ปลายทางตอนปิดให้ตรงชนิด ไม่ต้องยิง API ซ้ำอีกรอบเพื่อถามแค่ชนิดใบ
  const [detailKind, setDetailKind] = useState(null);
  const [form, setForm] = useState({ open: false, kind: "advance", claimType: "clear", expense: null, advance: null });
  const [notice, setNotice] = useState(null);
  const [status, setStatus] = useState(searchParams.get("status") || "all");
  // ตัวกรองชนิดย่อยของหน้าใบเคลม: all | clear | reimburse (ลิงก์จากเมนู/แจ้งเตือนส่งมาทาง ?type= ได้)
  const [claimType, setClaimType] = useState(searchParams.get("type") || "all");

  /**
   * หน้าที่เปิดใบนี้มา — ✅ ผู้ใช้ขอ "กดเข้าไปอยากให้ตรงหน้าที่มันแจ้งเตือนเลย"
   * 🐛 เดิมเปิดใบจากกล่อง "รอดำเนินการ" แล้วพื้นหลังสลับเป็นหน้าตามชนิดใบ ปิดแล้วไปโผล่หน้าใบเคลม/Advance
   * ✅ จำหน้าต้นทางไว้ใน location.state (ไม่ใส่ใน URL — ลิงก์แจ้งเตือน /expenses/<id> ต้องสั้นเหมือนเดิม)
   */
  const fromView = location.state?.fromView;
  const view = routeId ? (fromView || detailKind || viewProp || "advance") : (viewProp || "advance");
  const meta = VIEW_META[view] || VIEW_META.advance;
  const Icon = meta.icon;
  // ⚠️ ต้องดึงออกมาเป็นตัวแปรขึ้นต้นด้วยตัวใหญ่ก่อนใช้เป็นแท็ก — <meta.action2.icon /> อ่านยากและ
  // พังทันทีถ้าหน้านั้นไม่มีปุ่มที่สอง
  const Action2Icon = meta.action2?.icon || Add;
  const isList = view === "advance" || view === "claim" || view === "inbox";

  useEffect(() => { if (routeId) setDetailId(routeId); }, [routeId]);
  useEffect(() => { setStatus(searchParams.get("status") || "all"); }, [searchParams]);
  useEffect(() => { setClaimType(searchParams.get("type") || "all"); }, [searchParams]);

  useEffect(() => {
    let alive = true;
    ExpenseService.summary().then((s) => alive && setSummary(s)).catch(() => {});
    return () => { alive = false; };
  }, [reloadKey]);

  const refresh = useCallback(() => {
    setReloadKey((k) => k + 1);
    refreshAppBadges(); // ป้ายตัวเลขบนเมนูต้องขยับทันทีหลังอนุมัติ/ส่งใบ ไม่ใช่รอรอบ poll ถัดไป
  }, []);

  // ✅ เรียลไทม์: ใครก็ตามส่ง/ตรวจสอบ/อนุมัติ/เบิกจ่ายใบไหน → รายการ ตัวเลขสรุป และใบที่เปิดอยู่อัปเดตเองทันที
  // (รายการ/ใบที่เปิดอยู่โหลดแบบเงียบ — ไม่กระพริบเป็นโครงโหลด)
  useRealtime("expenses", () => setReloadKey((k) => k + 1));

  const openDetail = useCallback((id) => {
    setDetailId(id);
    // ✅ จำว่าเปิดมาจากหน้าไหน (กล่องรอดำเนินการ / ใบ Advance / ใบเคลม) ปิดแล้วต้องกลับมาหน้าเดิม
    navigate(
      { pathname: `/expenses/${id}`, search: location.search },
      { replace: Boolean(routeId), state: { fromView: fromView || (routeId ? detailKind : viewProp) || "advance" } },
    );
  }, [navigate, location.search, routeId, fromView, detailKind, viewProp]);

  const closeDetail = () => {
    setDetailId("");
    setNotice(null);
    if (routeId) navigate({ pathname: (VIEW_META[fromView] || VIEW_META[detailKind] || meta).path, search: location.search }, { replace: true });
  };

  /**
   * @param {"advance"|"claim"|"reimburse"} slip ชนิดที่ผู้ใช้กด (reimburse = ใบเคลมชนิดสำรองจ่าย)
   * ⚠️ "reimburse" ไม่ใช่ kind จริงในฐานข้อมูล ต้องแปลงเป็น kind=claim + claimType=reimburse ตรงนี้
   * จุดเดียว ไม่ปล่อยให้คำว่า reimburse หลุดไปถึง API
   */
  const openCreate = (slip, advance = null) => setForm({
    open: true,
    kind: slip === "reimburse" ? "claim" : slip,
    claimType: slip === "reimburse" ? "reimburse" : "clear",
    expense: null,
    advance,
  });

  const onSaved = (expense, { created, warn }) => {
    setForm((f) => ({ ...f, open: false }));
    refresh();
    setNotice({ severity: warn ? "warning" : "success", text: warn || (created ? `ส่ง${slipMeta(expense).label} ${expense.docNo} แล้ว — รออนุมัติ` : "บันทึกการแก้ไขแล้ว") });
    if (expense?._id) openDetail(expense._id);
  };

  if (!canRequest && !viewAll) return <Navigate to="/dashboard" replace />;
  if (view === "inbox" && !canHandle) return <Navigate to="/expenses/advances" replace />;

  const pick = (s) => setStatus((cur) => (cur === s ? "all" : s));

  // ── ตัวเลขสรุปเฉพาะของหน้านี้ ──────────────────────────────────────────
  const stats = [];
  if (view === "advance") {
    stats.push({ key: "pending", label: "รอตรวจสอบ", value: summary?.pending ?? "–", color: "#d97706", onClick: () => pick("pending") });
    stats.push({ key: "reviewed", label: "รออนุมัติ", value: summary?.reviewing ?? "–", color: "#b45309", onClick: () => pick("reviewed") });
    stats.push({ key: "approved", label: "รออนุมัติเบิกจ่าย", value: summary?.toPay ?? "–", color: "#2563eb", onClick: () => pick("approved") });
    stats.push({
      key: summary?.overdueClear ? "overdue" : "paid", label: "รอเคลียร์", value: summary?.awaitingClaim ?? "–",
      color: "#0369a1", onClick: () => pick(summary?.overdueClear ? "overdue" : "paid"),
    });
    if (summary?.overdueClear > 0) {
      stats.push({ key: "overdue", label: "เลยกำหนดเคลียร์", value: summary.overdueClear, color: "#dc2626", alert: true, onClick: () => pick("overdue") });
    }
    stats.push({ key: "__money", label: "ยอดเงินค้างเคลียร์", value: summary ? baht(summary.outstandingAmount) : "–", color: meta.color });
  } else if (view === "claim") {
    stats.push({ key: "pending", label: "รอตรวจสอบ", value: summary?.pending ?? "–", color: "#d97706", onClick: () => pick("pending") });
    stats.push({ key: "reviewed", label: "รออนุมัติ", value: summary?.reviewing ?? "–", color: "#b45309", onClick: () => pick("reviewed") });
    // ⚠️ ป้ายต้องตรงกับชนิดที่กำลังกรองอยู่ — ใบสำรองจ่ายไม่มี "ส่วนต่าง" ให้ปิด มีแต่เงินที่ต้องจ่ายคืน
    // (ตัวเลขเป็นยอดรวมของทั้งสองชนิดจาก /summary — เป็นคิวเดียวกันของฝ่ายบัญชี)
    stats.push({
      key: "approved", label: "รออนุมัติเบิกจ่าย",
      value: summary?.toSettle ?? "–", color: meta.color, onClick: () => pick("approved"),
    });
    stats.push({ key: "__await", label: "Advance ที่ยังไม่เคลียร์", value: summary?.awaitingClaim ?? "–", color: KIND_META.advance.color });
  } else if (view === "inbox") {
    // ✅ ตัวเลขตามขั้นของสายอนุมัติ 4 ขั้น — การ์ดของขั้นที่ตัวเองไม่ได้รับผิดชอบไม่ต้องโชว์ให้รก
    if (canReview) stats.push({ key: "__p", label: "รอตรวจสอบ", value: summary?.pending ?? "–", color: "#d97706" });
    if (canApprove) stats.push({ key: "__r", label: "รออนุมัติ", value: summary?.reviewing ?? "–", color: "#b45309" });
    if (canDisburse) {
      stats.push({ key: "__t", label: "รออนุมัติเบิกจ่าย · Advance", value: summary?.toPay ?? "–", color: "#2563eb" });
      stats.push({ key: "__s", label: "รออนุมัติเบิกจ่าย · ใบเคลม", value: summary?.toSettle ?? "–", color: KIND_META.claim.color });
    }
    if (summary?.overdueClear > 0) stats.push({ key: "__o", label: "เลยกำหนดเคลียร์", value: summary.overdueClear, color: "#dc2626", alert: true });
  }

  // ── ลิงก์ไปหน้าอื่นในระบบเดียวกัน ─────────────────────────────────────
  const crossLinks = [];
  if (view !== "advance") crossLinks.push({ to: "/expenses/advances", label: "ใบ Advance", color: KIND_META.advance.dark });
  if (view !== "claim") crossLinks.push({ to: "/expenses/claims", label: "ใบเคลม", color: KIND_META.claim.dark });
  if (canHandle && view !== "inbox") crossLinks.push({ to: "/expenses/approvals", label: "รอดำเนินการ", color: INBOX_COLOR });
  if (view !== "report") crossLinks.push({ to: "/expenses/report", label: "รายงาน", color: REPORT_COLOR });

  return (
    <Box sx={{ p: { xs: 1.25, sm: 2.5 }, maxWidth: 1500, mx: "auto" }}>
      {/* ── หัวหน้าเพจ: สีประจำหน้า + ปุ่มหลักปุ่มเดียว ─────────────────── */}
      <Box sx={{
        borderRadius: 3, border: `1px solid ${alpha(meta.color, 0.3)}`, borderTop: `4px solid ${meta.color}`,
        bgcolor: meta.soft, px: { xs: 1.5, sm: 2 }, py: { xs: 1.25, sm: 1.75 }, mb: 1.5,
      }}>
        <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} spacing={{ xs: 1.25, sm: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{
              width: 40, height: 40, borderRadius: 2.5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
              bgcolor: meta.color, color: "#fff",
            }}>
              <Icon />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 900, fontSize: { xs: "1.12rem", sm: "1.3rem" }, color: meta.dark, lineHeight: 1.25 }}>
                {meta.title}
              </Typography>
              <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", lineHeight: 1.35 }}>
                {meta.sub}
              </Typography>
            </Box>
          </Stack>
          {meta.action && (canRequest || viewAll) && (
            <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
              <Button
                variant="contained" startIcon={view === "claim" ? <ReceiptLong /> : <Add />}
                onClick={() => openCreate(view === "claim" ? "claim" : "advance")}
                sx={{
                  flex: { xs: 1, sm: "none" }, textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", whiteSpace: "nowrap",
                  bgcolor: meta.color, "&:hover": { bgcolor: meta.dark, boxShadow: "none" },
                }}
              >
                {meta.action}
              </Button>
              {/* ปุ่มที่สองเป็นแบบเส้นขอบ + สีของใบสำรองจ่าย — เห็นว่าเป็นคนละเอกสารตั้งแต่ยังไม่กด */}
              {meta.action2 && (
                <Button
                  variant="outlined" startIcon={<Action2Icon />}
                  onClick={() => openCreate(meta.action2.kind)}
                  sx={{
                    flex: { xs: 1, sm: "none" }, textTransform: "none", fontWeight: 800, borderRadius: 2, whiteSpace: "nowrap",
                    color: KIND_META[meta.action2.kind].dark, borderColor: KIND_META[meta.action2.kind].color,
                    bgcolor: "#fff",
                    "&:hover": { borderColor: KIND_META[meta.action2.kind].dark, bgcolor: KIND_META[meta.action2.kind].soft },
                  }}
                >
                  {meta.action2.label}
                </Button>
              )}
            </Stack>
          )}
        </Stack>
      </Box>

      {/* ── แถบตัวเลขของหน้านี้ (เลื่อนแนวนอนบนจอแคบ) ─────────────────── */}
      {stats.length > 0 && (
        <Stack
          direction="row" spacing={1}
          sx={{ mb: 1.25, overflowX: "auto", pb: 0.5, "&::-webkit-scrollbar": { display: "none" }, scrollbarWidth: "none" }}
        >
          {/* ⚠️ ต้องดึง key ออกจากอ็อบเจกต์ก่อน spread — ส่ง key ไปกับ {...s} React เตือนทุกครั้งที่ render */}
          {stats.map(({ key, ...pill }) => (
            <StatPill key={`${key}-${pill.label}`} {...pill} active={Boolean(pill.onClick) && status === key} />
          ))}
        </Stack>
      )}

      {/* ── ทางไปหน้าอื่นของระบบเบิก ────────────────────────────────── */}
      <Stack direction="row" spacing={0.75} sx={{ mb: 0.5, overflowX: "auto", pb: 0.5, "&::-webkit-scrollbar": { display: "none" }, scrollbarWidth: "none" }}>
        {crossLinks.map((l) => <CrossLink key={l.to} {...l} />)}
      </Stack>

      {isList ? (
        <ExpenseList
          mode={view === "inbox" ? "inbox" : view}
          status={status}
          claimType={claimType}
          onClaimTypeChange={setClaimType}
          onStatusChange={setStatus}
          onOpen={openDetail}
          onCreate={(k) => openCreate(k)}
          reloadKey={reloadKey}
        />
      ) : (
        <ExpenseReport onOpen={openDetail} reloadKey={reloadKey} />
      )}

      <ExpenseDetailDialog
        open={Boolean(detailId)}
        expenseId={detailId}
        reloadKey={reloadKey}
        notice={notice}
        onLoaded={(e) => {
          /**
           * ✅ เปิดจากลิงก์แจ้งเตือน (ไม่มีหน้าต้นทาง) และใบนี้ "รอให้ฉันลงมือ" → พื้นหลัง/ปิดแล้วไปกล่องรอดำเนินการ
           * เพราะแจ้งเตือนแบบนี้คืองานในคิวของหัวหน้า ไม่ใช่การเปิดดูรายการตามชนิดใบ
           */
          // ✅ "รอฉันลงมือ" ตามขั้นของตัวเองเท่านั้น (กรรมการเปิดใบรอตรวจสอบ = แค่เปิดดู ไม่ใช่งานในคิว)
          const needsMyAction = (e?.status === "pending" && canReview)
            || (e?.status === "reviewed" && canApprove)
            || (e?.status === "approved" && canDisburse);
          setDetailKind(needsMyAction ? "inbox" : e?.kind || null);
        }}
        onClose={closeDetail}
        onChanged={refresh}
        onOpenOther={(id) => { setNotice(null); openDetail(id); }}
        onEdit={(expense) => setForm({ open: true, kind: expense.kind, expense, advance: null })}
        onCreateClaim={(advance) => openCreate("claim", advance)}
      />

      <ExpenseFormDialog
        open={form.open}
        kind={form.kind}
        claimType={form.claimType}
        expense={form.expense}
        advance={form.advance}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
        onSaved={onSaved}
      />
    </Box>
  );
}
