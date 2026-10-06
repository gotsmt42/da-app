/**
 * ExpensesPage — โครงหน้าของระบบเบิก ใช้ร่วมกัน 4 หน้าที่ "แยก URL จริง" ไม่ใช่แท็บรวมหน้าเดียว
 *
 *   /expenses/advances    ใบเบิก Advance   (เขียวอมฟ้า)
 *   /expenses/claims      ใบเคลม            (ม่วง)
 *   /expenses/contractors ใบเบิกค่าจ้างผู้รับเหมา (น้ำเงินเข้ม)
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
import { Box, Stack, Typography, Button, IconButton, Badge, ButtonBase } from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Add, Payments, ReceiptLong, FactCheck, Insights, WarningAmber, AccountBalanceWallet, Engineering, Tune,
} from "@mui/icons-material";

import usePermissions from "@/shared/hooks/usePermissions";
import { refreshAppBadges } from "@/shared/hooks/useAppBadges";
import ExpenseService from "../services/ExpenseService";
import ExpenseList from "../components/ExpenseList";
import ExpenseFormDialog from "../components/ExpenseFormDialog";
import ContractorFormDialog from "../components/ContractorFormDialog";
import ExpenseDetailDialog from "../components/ExpenseDetailDialog";
import MyExpenseTasks from "../components/MyExpenseTasks";
import { useAuth } from "@/features/auth/AuthContext";
import ExpenseReport from "./ExpenseReport";
import { KIND_META, slipMeta, baht, TEXT_SUB, TEXT_MAIN, BORDER_MAIN } from "../expenseMeta";

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
  /**
   * ✅ ใบเบิกค่าจ้างผู้รับเหมา (ผู้ใช้สั่ง 28 ก.ย. 2569) — หน้าของตัวเอง เพราะผู้รับเงินเป็นคนนอก
   * มีงวดงาน/หัก ณ ที่จ่าย/มัดจำ ที่ใบของพนักงานไม่มี (ปนกับใบเคลมจะกรองยากและยอดรวมผิดความหมาย)
   */
  contractor: {
    path: "/expenses/contractors",
    title: "ใบเบิกค่าจ้างผู้รับเหมา",
    icon: Engineering,
    color: KIND_META.contractor.color,
    dark: KIND_META.contractor.dark,
    soft: KIND_META.contractor.soft,
    sub: "เบิกค่าแรง/ค่าจ้างเหมาตามงวดงาน · หัก ณ ที่จ่ายและเงินมัดจำ · จ่ายตรงเข้าบัญชีผู้รับเหมา",
    action: "ออกใบค่าจ้าง",
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
      bgcolor: "#fff",
      border: `1px solid ${active ? "#334155" : alert ? alpha("#dc2626", 0.4) : BORDER_MAIN}`,
      boxShadow: active ? "inset 0 0 0 1px #334155" : "none",
      transition: "border-color .15s",
      "&:hover": onClick ? { borderColor: color } : undefined,
    }}
  >
    <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 700, display: "block", lineHeight: 1.3 }} noWrap>
      {alert && <WarningAmber sx={{ fontSize: 13, color: "#dc2626", mr: 0.4, verticalAlign: "-2px" }} />}
      {label}
    </Typography>
    {/* ✅ ตัวเลขทุกช่องสีเดียวกัน (ยกเว้นเตือน) — เดิมแต่ละช่องคนละสี อ่านแล้วตาลาย (ผู้ใช้แจ้ง) */}
    <Typography sx={{ fontWeight: 900, fontSize: "1.15rem", color: alert ? "#dc2626" : TEXT_MAIN, lineHeight: 1.25 }} noWrap>
      {value}
    </Typography>
  </Box>
);


export default function ExpensesPage({ view: viewProp }) {
  const { can } = usePermissions();
  const { userData } = useAuth();
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
  /** ฟอร์มใบค่าจ้างผู้รับเหมาเป็นคนละตัวกับฟอร์มใบของพนักงาน (ดู ContractorFormDialog) */
  const isContractorForm = form.kind === "claim" && form.claimType === "contractor";
  const [notice, setNotice] = useState(null);
  // มือถือ: แผงค้นหา/ตัวกรองของรายการ เปิดจากปุ่มมุมขวาบนของหัวเพจ
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState(0);
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
  const isList = view === "advance" || view === "claim" || view === "contractor" || view === "inbox";

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
   * @param {"advance"|"claim"|"reimburse"|"contractor"} slip ชนิดที่ผู้ใช้กด (reimburse/contractor = ใบเคลมชนิดย่อย)
   * ⚠️ "reimburse" ไม่ใช่ kind จริงในฐานข้อมูล ต้องแปลงเป็น kind=claim + claimType=reimburse ตรงนี้
   * จุดเดียว ไม่ปล่อยให้คำว่า reimburse หลุดไปถึง API
   */
  const openCreate = (slip, advance = null) => setForm({
    open: true,
    kind: slip === "reimburse" || slip === "contractor" ? "claim" : slip,
    claimType: slip === "reimburse" || slip === "contractor" ? slip : "clear",
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
    // ⚠️ ของตัวเองแสดงอยู่ในกล่อง "ใบเบิกของคุณที่ค้างอยู่" ด้านล่างแล้ว — ตัวเลขนี้จึงมีไว้ให้หัวหน้าดูภาพรวมทั้งทีมเท่านั้น
    if (viewAll) stats.push({ key: "__await", label: "Advance ที่ยังไม่เคลียร์ (ทั้งทีม)", value: summary?.awaitingClaim ?? "–", color: KIND_META.advance.color });
  } else if (view === "contractor") {
    const c = summary?.contractor;
    stats.push({ key: "pending", label: "รอตรวจสอบ", value: c?.pending ?? "–", color: "#d97706", onClick: () => pick("pending") });
    stats.push({ key: "reviewed", label: "รออนุมัติ", value: c?.reviewing ?? "–", color: "#b45309", onClick: () => pick("reviewed") });
    stats.push({ key: "approved", label: "รออนุมัติเบิกจ่าย", value: c?.toPay ?? "–", color: meta.color, onClick: () => pick("approved") });
    stats.push({ key: "__ctrmoney", label: "ยอดรอจ่ายผู้รับเหมา (สุทธิ)", value: c ? baht(c.toPayAmount) : "–", color: meta.dark });
  } else if (view === "inbox") {
    // ✅ ตัวเลขตามขั้นของสายอนุมัติ 3 ส่วน — การ์ดของขั้นที่ตัวเองไม่ได้รับผิดชอบไม่ต้องโชว์ให้รก
    if (canReview) stats.push({ key: "__p", label: "รอตรวจสอบ", value: summary?.pending ?? "–", color: "#d97706" });
    if (canApprove) stats.push({ key: "__r", label: "รออนุมัติ", value: summary?.reviewing ?? "–", color: "#b45309" });
    if (canDisburse) {
      stats.push({ key: "__t", label: "รออนุมัติเบิกจ่าย · Advance", value: summary?.toPay ?? "–", color: "#2563eb" });
      stats.push({ key: "__s", label: "รออนุมัติเบิกจ่าย · ใบเคลม", value: summary?.toSettle ?? "–", color: KIND_META.claim.color });
    }
    if (summary?.overdueClear > 0) stats.push({ key: "__o", label: "เลยกำหนดเคลียร์", value: summary.overdueClear, color: "#dc2626", alert: true });
  }

  // ตัวเลขเงินที่การ์ดสถานะในรายการไม่มี — ย้ายขึ้นหัวเพจ
  const headerStats = stats.filter((s) => !s.onClick && !s.alert);

  // ── ลิงก์ไปหน้าอื่นในระบบเดียวกัน ─────────────────────────────────────
  // ✅ แถบเมนูของระบบเบิกแบบคงที่ (ผู้ใช้: "ยังดูแปลกๆ ไม่ลงตัว") — เดิมเป็นชิปลิงก์ "ไปหน้าอื่น" ที่รายการเปลี่ยนไปทุกหน้า
  //    และไม่มีหน้าปัจจุบัน → ตอนนี้ครบทุกหน้า ลำดับเดิมเสมอ หน้าที่อยู่ไฮไลต์สีของหน้านั้น
  const navItems = [
    { key: "advance", to: "/expenses/advances", label: "ใบ Advance", color: KIND_META.advance.color },
    { key: "claim", to: "/expenses/claims", label: "ใบเคลม", color: KIND_META.claim.color },
    { key: "contractor", to: "/expenses/contractors", label: "ผู้รับเหมา", color: KIND_META.contractor.color },
    ...(canHandle ? [{ key: "inbox", to: "/expenses/approvals", label: "รอดำเนินการ", color: INBOX_COLOR }] : []),
    { key: "report", to: "/expenses/report", label: "รายงาน", color: REPORT_COLOR },
  ];

  return (
    <Box sx={{ px: { xs: 0, sm: 2.5 }, py: { xs: 1.25, sm: 2.5 }, maxWidth: 1500, mx: "auto" }}>
      {/* ── หัวหน้าเพจ: สีประจำหน้า + ปุ่มหลักปุ่มเดียว ─────────────────── */}
      <Box sx={{
        // ✅ หัวหน้าเพจพื้นขาว — สีประจำหน้าเหลือแค่ไอคอนกับปุ่มหลัก (เดิมพื้นสี + ขอบสี + แถบบนสี)
        borderRadius: 3, border: `1px solid ${BORDER_MAIN}`,
        bgcolor: "#fff", px: { xs: 1.5, sm: 2 }, py: { xs: 1.25, sm: 1.75 }, mb: 1.5,
      }}>
        <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} spacing={{ xs: 1.25, sm: 2 }}>
          <Stack direction="row" alignItems={{ xs: "center", sm: "center" }} spacing={{ xs: 1.25, sm: 1.5 }} sx={{ flex: 1, minWidth: 0, position: "relative", pr: { xs: 6, sm: 0 } }}>
            {/* ✅ มือถือ: ปุ่มค้นหา/ตัวกรอง มุมขวาบน (ผู้ใช้ขอ — เดิมแผงค้นหากินจอครึ่งหนึ่งก่อนถึงรายการ) */}
            {(
              <IconButton
                aria-label="ค้นหาและตัวกรอง" onClick={() => setMobileFiltersOpen(true)}
                sx={{
                  display: { xs: "inline-flex", md: "none" }, position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)",
                  width: 42, height: 42, borderRadius: 2.5, border: `1px solid ${BORDER_MAIN}`, bgcolor: activeFilters ? alpha(meta.color, 0.08) : "#fff",
                  color: activeFilters ? meta.color : TEXT_MAIN,
                }}
              >
                <Badge badgeContent={activeFilters} color="error" sx={{ "& .MuiBadge-badge": { fontSize: "0.62rem", height: 16, minWidth: 16 } }}>
                  <Tune sx={{ fontSize: 21 }} />
                </Badge>
              </IconButton>
            )}
            <Box sx={{
              width: { xs: 34, sm: 38 }, height: { xs: 34, sm: 38 }, borderRadius: 2.25, ml: "0 !important", // ⚠️ ปุ่มตัวกรอง (absolute) เป็นลูกตัวแรกของ Stack — ไม่งั้นไอคอนโดนเว้นซ้าย "& svg": { fontSize: { xs: 20, sm: 24 } }, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
              bgcolor: meta.color, color: "#fff",
            }}>
              <Icon />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: { xs: "1.08rem", sm: "1.2rem" }, color: TEXT_MAIN, lineHeight: 1.3 }}>
                {meta.title}
              </Typography>
              {/* ✅ มือถือ: ซ่อนคำอธิบาย (ยาว ตัดเป็น 2–3 บรรทัด ดันเนื้อหาลง) — ชื่อหน้าบอกอยู่แล้ว */}
              <Typography variant="caption" sx={{ color: TEXT_SUB, display: { xs: "none", sm: "block" }, lineHeight: 1.35 }}>
                {meta.sub}
              </Typography>
            </Box>
          </Stack>
          {/* ตัวเลขเงินของหน้านี้ — จอใหญ่: คอลัมน์ขวามีเส้นคั่น · มือถือ: แถบเทาอ่อนแถวเดียว (ป้ายซ้าย ตัวเลขขวา) */}
          {isList && view !== "inbox" && headerStats.map((st) => (
            <Box key={st.key} sx={{
              flexShrink: 0, display: "flex", flexDirection: { xs: "row", sm: "column" }, alignItems: { xs: "center", sm: "flex-end" },
              justifyContent: "space-between", gap: 1,
              px: 1.5, py: { xs: 1, sm: 0 }, borderRadius: { xs: 2, sm: 0 }, bgcolor: { xs: "#f8fafc", sm: "transparent" },
              border: { xs: `1px solid ${BORDER_MAIN}`, sm: 0 }, borderLeft: { sm: `1px solid ${BORDER_MAIN}` },
            }}>
              <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: TEXT_SUB, whiteSpace: "nowrap" }}>{st.label}</Typography>
              <Typography sx={{ fontWeight: 900, fontSize: { xs: "1.05rem", sm: "1.1rem" }, color: TEXT_MAIN, lineHeight: 1.25, whiteSpace: "nowrap" }}>{st.value}</Typography>
            </Box>
          ))}
          {meta.action && (canRequest || viewAll) && (
            <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
              <Button
                variant="contained" startIcon={view === "claim" ? <ReceiptLong /> : view === "contractor" ? <Engineering /> : <Add />}
                onClick={() => openCreate(view === "claim" ? "claim" : view === "contractor" ? "contractor" : "advance")}
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
                    // ปุ่มรองเป็นขอบเทา ตัวดำ — สีของใบสำรองจ่ายเหลือแค่ที่ไอคอน
                    color: TEXT_MAIN, borderColor: BORDER_MAIN, bgcolor: "#fff",
                    "& .MuiButton-startIcon": { color: KIND_META[meta.action2.kind].color },
                    "&:hover": { borderColor: "#94a3b8", bgcolor: "#f8fafc" },
                  }}
                >
                  {meta.action2.label}
                </Button>
              )}
            </Stack>
          )}
        </Stack>
        {/* ── แถบเมนูระบบเบิก (ติดขอบล่างของหัวเพจ) — หน้าปัจจุบัน: ตัวสีของหน้า + เส้นใต้ · มือถือเลื่อนซ้าย-ขวาได้ ── */}
        <Box
          component="nav" aria-label="เมนูระบบเบิก"
          sx={{
            display: "flex", gap: { xs: 0.25, sm: 0.5 }, mt: { xs: 1.25, sm: 1.5 }, mb: { xs: -1.25, sm: -1.75 }, mx: { xs: -1.5, sm: -2 }, px: { xs: 1, sm: 1.5 },
            borderTop: `1px solid ${BORDER_MAIN}`, overflowX: "auto", "&::-webkit-scrollbar": { display: "none" }, scrollbarWidth: "none",
          }}
        >
          {navItems.map((n) => {
            const on = n.key === view;
            return (
              <ButtonBase
                key={n.key} component={RouterLink} to={n.to} aria-current={on ? "page" : undefined}
                sx={{
                  flexShrink: 0, px: { xs: 1.25, sm: 1.5 }, py: 1.1, fontFamily: "inherit", whiteSpace: "nowrap",
                  fontSize: "0.84rem", fontWeight: on ? 800 : 600, color: on ? n.color : TEXT_SUB,
                  borderBottom: `2px solid ${on ? n.color : "transparent"}`, mb: "-1px",
                  "&:hover": { color: on ? n.color : TEXT_MAIN },
                }}
              >
                {n.label}
              </ButtonBase>
            );
          })}
        </Box>
      </Box>

      {/* ── แถบตัวเลขของหน้านี้ (เลื่อนแนวนอนบนจอแคบ) ─────────────────── */}
      {/* ⚠️ หน้ารายการ (Advance/เคลม/ผู้รับเหมา) มีการ์ดสถานะที่กดกรองได้อยู่ในรายการแล้ว — แสดงเฉพาะตัวเลขเงิน
          ที่การ์ดสถานะไม่มี (เดิมโชว์ "รอตรวจสอบ/รออนุมัติ" ซ้ำสองชุด ผู้ใช้แจ้งว่าสับสน รกตา) */}
      {!(isList && view !== "inbox") && stats.length > 0 && (
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


      {/* ✅ สิ่งที่ป้ายตัวเลขบนเมนู "ใบเคลม"/"ใบ Advance" นับไว้ — ต้องเห็นและกดทำต่อได้ทันทีที่เข้ามา
          (ผู้ใช้แจ้งว่าป้ายขึ้นแต่เข้ามาแล้วไม่เจออะไร) · ชื่อกล่องเรียกตามสิ่งที่มันเป็น: ใบเบิก ไม่ใช่ "งาน" */}
      {(view === "claim" || view === "advance" || view === "contractor") && canRequest && (
        <MyExpenseTasks
          view={view}
          userId={userData?.userId}
          reloadKey={reloadKey}
          onOpen={openDetail}
          onCreateClaim={(advance) => openCreate("claim", advance)}
          onEdit={(expense) => setForm({ open: true, kind: expense.kind, claimType: expense.claimType || "clear", expense, advance: null })}
        />
      )}

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
          mobileFiltersOpen={mobileFiltersOpen}
          onMobileFiltersClose={() => setMobileFiltersOpen(false)}
          onActiveFiltersChange={setActiveFilters}
        />
      ) : (
        <ExpenseReport
          onOpen={openDetail} reloadKey={reloadKey}
          mobileFiltersOpen={mobileFiltersOpen}
          onMobileFiltersClose={() => setMobileFiltersOpen(false)}
          onActiveFiltersChange={setActiveFilters}
        />
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
          setDetailKind(needsMyAction ? "inbox" : e?.claimType === "contractor" ? "contractor" : e?.kind || null);
        }}
        onClose={closeDetail}
        onChanged={refresh}
        onOpenOther={(id) => { setNotice(null); openDetail(id); }}
        onEdit={(expense) => setForm({ open: true, kind: expense.kind, claimType: expense.claimType || "clear", expense, advance: null })}
        onCreateClaim={(advance) => openCreate("claim", advance)}
      />

      <ContractorFormDialog
        open={form.open && isContractorForm}
        expense={form.expense}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
        onSaved={onSaved}
      />

      <ExpenseFormDialog
        open={form.open && !isContractorForm}
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
