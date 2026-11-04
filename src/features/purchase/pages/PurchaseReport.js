/**
 * PurchaseReport — รายงานใบขอซื้อสินค้า (PR) แยกเป็นหน้าของตัวเอง (/purchase/report)
 *
 * ✅ ผู้ใช้สั่ง (2 ต.ค. 2569): "ทำรายงานแยกออกมาด้วย เอกสารจัดซื้อ PR"
 * ✅ (2 พ.ย. 2569 ผู้ใช้: "หน้ารายงานขอซื้อทำให้ละเอียดสมบูรณ์ แบบหน้ารายงานการเบิก")
 *   โครงเดียวกับ ExpenseReport: กล่องตัวเลขมีแถบสี · แผงพับได้ (จำในเครื่อง) · ขั้นที่ค้าง + ผู้ดำเนินการ ·
 *   รายเดือน + ตามประเภท · ร้านค้า + ระยะเวลาดำเนินการ · ใบเลยวันต้องใช้ · รายบุคคล (กางดูทีละใบ) ·
 *   สรุปตามงาน/ร้านค้า (กดชื่องานไปปฏิทิน) · สินค้า · รายใบ (แท็บ ทั้งหมด/ค้าง/เลยกำหนด) · แบ่งหน้าทุกตาราง ·
 *   มือถือ: ตัวกรองอยู่ในแผ่นล่าง
 * ⚠️ คำนวณจากรายการใบที่ server คืนมา (server กรองสิทธิ์แล้ว — คนทั่วไปเห็นเฉพาะใบของตัวเอง)
 */
import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, Navigate, useNavigate } from "react-router-dom";
import moment from "moment";
import {
  Box, Stack, Typography, Button, Alert, Skeleton, Table, TableHead, TableRow, TableCell, TableBody, Chip,
  ToggleButtonGroup, ToggleButton, Tooltip, useMediaQuery, Collapse, IconButton, Drawer, Avatar, Badge,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  InsightsRounded as Insights, ChevronRightRounded as ChevronRight, AssessmentRounded as Assessment, WarningAmberRounded as WarningAmber,
  FactCheckRounded as FactCheck, BarChartRounded as BarChart, DonutLargeRounded as DonutLarge, WorkRounded as Work, GroupsRounded as Groups,
  ReceiptLongRounded as ReceiptLong, StorefrontRounded as Storefront, TimerRounded as Timer, Inventory2Rounded as Inventory2,
  ExpandMoreRounded as ExpandMore, CloseRounded as Close, TuneRounded as Tune, CalendarMonthRounded as CalendarMonth,
} from "@mui/icons-material";

import usePermissions from "@/shared/hooks/usePermissions";
import useRealtime from "@/shared/realtime/useRealtime";
import useCloseOnPick from "@/shared/hooks/useCloseOnPick";
import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import SelectField from "@/shared/ui/SelectField";
import PersonSelectField from "@/shared/ui/PersonSelectField";
import usePaged, { PageBar } from "@/shared/ui/usePaged";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import { thaiDate, THAI_MONTHS_SHORT } from "@/shared/utils/thaiDate";
import PurchaseService, { errorText } from "../services/PurchaseService";
import PrStatusBadge from "../components/PrStatusBadge";
import {
  PR_ACCENT, TEXT_MAIN, TEXT_SUB, BORDER_MAIN, PR_CATEGORIES, prStatus, priorityMeta, categoryLabel, baht, fmtQty, prJobText,
} from "../prMeta";
import { buildPrReport, isLate, pendingReceiveOf, amountOf } from "../utils/prReport";
import { PAGE_SX } from "@/shared/ui/PageKit";
import ExportExcelButton from "@/shared/ui/ExportExcelButton";

const PRESETS = [
  { value: "month", label: "เดือนนี้", range: () => [moment().startOf("month"), moment()] },
  { value: "lastMonth", label: "เดือนที่แล้ว", range: () => [moment().subtract(1, "month").startOf("month"), moment().subtract(1, "month").endOf("month")] },
  { value: "quarter", label: "ไตรมาสนี้", range: () => [moment().startOf("quarter"), moment()] },
  { value: "year", label: "ปีนี้", range: () => [moment().startOf("year"), moment()] },
  { value: "12m", label: "12 เดือนล่าสุด", range: () => [moment().subtract(11, "months").startOf("month"), moment()] },
  { value: "all", label: "ทั้งหมด", range: () => [null, null] },
  { value: "custom", label: "กำหนดเอง", range: null },
];
const EST = "#94a3b8";
const NUM = { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
const DASH = <span style={{ color: "#cbd5e1" }}>—</span>;
const TABLE_SX = {
  "& th": { fontWeight: 600, color: TEXT_SUB, fontSize: "0.74rem", whiteSpace: "nowrap", bgcolor: "#f8fafc", py: 1 },
  "& td": { fontSize: "0.84rem", color: TEXT_MAIN, borderColor: "#f1f5f9", py: 1, fontVariantNumeric: "tabular-nums" },
};
/** สีประจำประเภทการซื้อ (ใช้ทั้งแถบและจุด) */
const CAT_COLOR = { material: "#2563eb", tool: "#0d9488", consumable: "#ea580c", asset: "#7c3aed", service: "#db2777", other: "#64748b" };
const catColor = (k) => CAT_COLOR[k] || CAT_COLOR.other;
const OPEN = ["pending", "reviewed", "rejected", "approved", "ordered", "partial"];

const monthLabel = (key) => {
  const [y, m] = String(key).split("-").map(Number);
  return y ? `${THAI_MONTHS_SHORT[m - 1]} ${String(y + 543).slice(-2)}` : "-";
};
const daysText = (v) => (v == null ? "—" : v < 1 ? "ภายในวันเดียว" : `${v.toLocaleString("th-TH", { maximumFractionDigits: 1 })} วัน`);
const sortByDoc = (a, b) => String(b.docNo).localeCompare(String(a.docNo), "en", { numeric: true });

/** กล่องตัวเลข — ระบบสีเดียวกับรายงานการเบิก: ยอดหลักเป็นสีเสมอ · ยอดที่ต้องติดตาม เป็น 0 = จางสงบ */
const Kpi = ({ label, value, sub, color, highlight, followup = false, active }) => {
  const on = followup ? Boolean(active) : true;
  const tint = followup ? on : highlight;
  return (
    <Box sx={{
      position: "relative", overflow: "hidden", p: { xs: 1.25, sm: 1.5 }, pt: { xs: 1.5, sm: 1.75 }, borderRadius: 2.5, minWidth: 0,
      bgcolor: tint ? alpha(color, 0.06) : "#fff", border: `1px solid ${tint ? alpha(color, 0.3) : BORDER_MAIN}`,
      "&::before": on ? { content: '""', position: "absolute", top: 0, left: 0, right: 0, height: 3, bgcolor: color } : {},
    }}>
      <Stack direction="row" alignItems="center" spacing={0.6} sx={{ minWidth: 0 }}>
        <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: on ? color : "#cbd5e1", flexShrink: 0 }} />
        <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 700, lineHeight: 1.3 }} noWrap>{label}</Typography>
      </Stack>
      <Typography sx={{ fontWeight: 800, fontSize: { xs: "1.08rem", sm: "1.3rem" }, lineHeight: 1.25, mt: 0.4, color: on ? color : "#94a3b8", ...NUM }} noWrap>{value}</Typography>
      {sub && <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 0.15 }} noWrap>{sub}</Typography>}
    </Box>
  );
};

/** แผงหัวข้อ — กดหัวแผงเพื่อพับ/กาง · จำสถานะไว้ในเครื่อง (แบบรายงานการเบิก) */
const PANEL_KEY = (title) => `prReport.fold.${String(title || "").replace(/\s*\(.*\)\s*$/, "").trim()}`;
const readFold = (title) => { try { return localStorage.getItem(PANEL_KEY(title)) === "1"; } catch { return false; } };
const Panel = ({ title, hint, children, action, icon, color = "#475569" }) => {
  const [folded, setFolded] = useState(() => readFold(title));
  const toggle = () => setFolded((f) => {
    try { localStorage.setItem(PANEL_KEY(title), f ? "0" : "1"); } catch { /* ไม่มีที่เก็บ = ไม่จำ */ }
    return !f;
  });
  return (
    <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 2.5, minWidth: 0, overflow: "hidden", alignSelf: folded ? "start" : "stretch" }}>
      <Stack direction="row" alignItems="center" useFlexGap flexWrap={{ xs: "wrap", sm: "nowrap" }} onClick={toggle} role="button" aria-expanded={!folded}
        sx={{ columnGap: 1.25, rowGap: 1, px: { xs: 1.5, sm: 2 }, py: { xs: 1.25, sm: 1.4 }, borderBottom: folded ? "none" : "1px solid #f1f5f9",
          cursor: "pointer", userSelect: "none", transition: "background-color .15s", "&:hover": { bgcolor: "#f8fafc" } }}>
        {icon && (
          <Box sx={{ width: 34, height: 34, borderRadius: 2, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: alpha(color, 0.1), color, "& svg": { fontSize: 19 } }}>
            {icon}
          </Box>
        )}
        <Box sx={{ flex: "1 1 200px", minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: "0.98rem", sm: "1.05rem" }, color: TEXT_MAIN, lineHeight: 1.35 }}>{title}</Typography>
          {hint && <Typography sx={{ fontSize: "0.76rem", color: TEXT_SUB, lineHeight: 1.45 }}>{hint}</Typography>}
        </Box>
        {action && !folded && (
          <Box onClick={(e) => e.stopPropagation()} sx={{ flexShrink: 0, width: { xs: "100%", sm: "auto" }, order: { xs: 3, sm: 0 }, "& .MuiToggleButtonGroup-root": { width: { xs: "100%", sm: "auto" } }, "& .MuiToggleButton-root": { flex: { xs: 1, sm: "none" } } }}>{action}</Box>
        )}
        <Tooltip title={folded ? "กางหัวข้อนี้" : "พับหัวข้อนี้"}>
          <IconButton size="small" aria-label={folded ? "กาง" : "พับ"} onClick={(e) => { e.stopPropagation(); toggle(); }}
            sx={{ flexShrink: 0, color: TEXT_SUB, bgcolor: folded ? "#f1f5f9" : "transparent", "& svg": { transition: "transform .2s", transform: folded ? "rotate(-90deg)" : "none" } }}>
            <ExpandMore />
          </IconButton>
        </Tooltip>
      </Stack>
      <Collapse in={!folded} timeout={220} unmountOnExit>
        <Box sx={{ p: { xs: 1.5, sm: 2 } }}>{children}</Box>
      </Collapse>
    </Box>
  );
};

const toggleSx = { "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 700, px: 1.25, py: 0.35 } };

/** ขั้นที่ใบค้างอยู่ — 4 ขั้นตามสายงานจัดซื้อ · บอกว่าใครต้องทำต่อ · ขั้นที่ไม่มีใบค้างจางลง */
const PIPELINE_STEPS = [
  { no: 1, statuses: ["pending"], title: "รอตรวจสอบ", who: "ผู้ตรวจสอบ" },
  { no: 2, statuses: ["reviewed"], title: "รออนุมัติ", who: "ผู้อนุมัติ" },
  { no: 3, statuses: ["approved"], title: "อนุมัติแล้ว · รอสั่งซื้อ", who: "ฝ่ายจัดซื้อ" },
  { no: 4, statuses: ["ordered", "partial"], title: "สั่งซื้อแล้ว · รอรับของ", who: "ผู้รับของ / ฝ่ายจัดซื้อ" },
];
const Pipeline = ({ rows, byStatus }) => (
  <>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" }, gap: 1 }}>
      {PIPELINE_STEPS.map((s) => {
        const list = rows.filter((r) => s.statuses.includes(r.status));
        const color = prStatus(s.statuses[0]).color;
        const money = s.no === 4 ? list.reduce((a, r) => a + pendingReceiveOf(r), 0) : list.reduce((a, r) => a + amountOf(r), 0);
        const late = list.filter(isLate).length;
        return (
          <Box key={s.no} sx={{ px: 1.5, py: 1.1, borderRadius: 2, minWidth: 0, border: `1px solid ${BORDER_MAIN}`, borderLeft: `4px solid ${list.length ? color : BORDER_MAIN}`, opacity: list.length ? 1 : 0.65 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography component="span" sx={{ fontSize: "0.7rem", fontWeight: 800, color, whiteSpace: "nowrap" }}>ขั้นที่ {s.no}/4</Typography>
              <Typography sx={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: "0.88rem", color: TEXT_MAIN }} noWrap>{s.title}</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: "1rem", color: list.length ? color : TEXT_SUB, whiteSpace: "nowrap" }}>{list.length} ใบ</Typography>
            </Stack>
            <Typography sx={{ fontSize: "0.72rem", color: TEXT_SUB, mt: 0.25 }} noWrap>
              {list.length ? `${s.no === 4 ? "ค้างรับ" : "ยอด"} ${baht(money)}${late ? ` · เลยวันต้องใช้ ${late} ใบ` : ""} · ` : "ไม่มีใบค้าง · "}ผู้ดำเนินการ: {s.who}
            </Typography>
          </Box>
        );
      })}
    </Box>
    <Stack direction="row" useFlexGap flexWrap="wrap" sx={{ mt: 1.25, columnGap: 2, rowGap: 0.5 }}>
      {["received", "rejected", "cancelled"].map((k) => (
        <Typography key={k} sx={{ fontSize: "0.78rem", color: TEXT_SUB }}>
          <Box component="span" sx={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", bgcolor: prStatus(k).color, mr: 0.75 }} />
          {prStatus(k).short || prStatus(k).label} <b style={{ color: TEXT_MAIN }}>{byStatus[k]?.count || 0} ใบ</b>
          {k === "received" && byStatus[k]?.amount ? ` · ${baht(byStatus[k].amount)}` : ""}
        </Typography>
      ))}
    </Stack>
  </>
);

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

/** ตามประเภทการซื้อ — แถบจาง = ประมาณการ · แถบเข้ม = สั่งซื้อจริง */
const CategoryBars = ({ rows }) => {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.est, r.actual)));
  if (!rows.length) return <Typography variant="body2" sx={{ color: TEXT_SUB }}>ไม่มีข้อมูล</Typography>;
  return (
    <Stack spacing={1.25}>
      {rows.map((r) => {
        const c = catColor(r.key);
        return (
          <Box key={r.key}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={{ xs: 0.15, sm: 1 }} sx={{ mb: 0.4 }}>
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                <Box component="span" sx={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", bgcolor: c, mr: 0.75 }} />
                {r.label} <span style={{ color: TEXT_SUB, fontWeight: 500 }}>· {r.count} ใบ</span>
              </Typography>
              <Typography sx={{ fontSize: "0.78rem", color: TEXT_SUB }}>
                ประมาณการ {baht(r.est)} · <b style={{ color: TEXT_MAIN }}>ซื้อจริง {baht(r.actual)}</b>
              </Typography>
            </Stack>
            <Box sx={{ position: "relative", height: 10, borderRadius: 5, bgcolor: "#f1f5f9", overflow: "hidden" }}>
              <Box sx={{ position: "absolute", inset: 0, width: `${(r.est / max) * 100}%`, bgcolor: alpha(c, 0.25) }} />
              <Box sx={{ position: "absolute", top: 2, bottom: 2, left: 0, width: `${(r.actual / max) * 100}%`, bgcolor: c, borderRadius: 5 }} />
            </Box>
          </Box>
        );
      })}
    </Stack>
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
            <Typography sx={{ fontSize: "0.78rem", color: TEXT_SUB, whiteSpace: "nowrap" }}>
              {r.count} ใบ{r.pendingReceive ? <> · ค้างรับ <b style={{ color: prStatus("ordered").color }}>{baht(r.pendingReceive)}</b></> : null} · <b style={{ color: TEXT_MAIN }}>{baht(r.actual)}</b>
            </Typography>
          </Stack>
          <Box sx={{ height: 8, borderRadius: 4, bgcolor: "#f1f5f9", overflow: "hidden" }}>
            <Box sx={{ height: "100%", width: `${(r.actual / max) * 100}%`, bgcolor: PR_ACCENT, borderRadius: 4 }} />
          </Box>
        </Box>
      ))}
      {rows.length > 8 && <Typography variant="caption" sx={{ color: TEXT_SUB }}>อีก {rows.length - 8} ร้าน — ดูครบในแผง “สรุปตามร้านค้า” ด้านล่าง</Typography>}
    </Stack>
  );
};

/** ระยะเวลาดำเนินการเฉลี่ยในแต่ละขั้น */
const LeadTime = ({ lt }) => {
  const steps = [
    { label: "ขอซื้อ → อนุมัติ", v: lt.approve, color: prStatus("reviewed").color },
    { label: "อนุมัติ → สั่งซื้อ", v: lt.order, color: prStatus("approved").color },
    { label: "สั่งซื้อ → รับของครบ", v: lt.receive, color: prStatus("ordered").color },
  ];
  const max = Math.max(1, ...steps.map((s) => s.v.avg || 0));
  return (
    <Stack spacing={1.25}>
      {steps.map((s) => (
        <Box key={s.label}>
          <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 0.4 }}>
            <Typography sx={{ fontSize: "0.82rem", fontWeight: 700 }}>{s.label}</Typography>
            <Typography sx={{ fontSize: "0.78rem", color: TEXT_SUB, whiteSpace: "nowrap" }}>
              <b style={{ color: s.v.avg == null ? TEXT_SUB : TEXT_MAIN }}>{daysText(s.v.avg)}</b>{s.v.n ? ` · จาก ${s.v.n} ใบ` : ""}
            </Typography>
          </Stack>
          <Box sx={{ height: 8, borderRadius: 4, bgcolor: "#f1f5f9", overflow: "hidden" }}>
            <Box sx={{ height: "100%", width: `${((s.v.avg || 0) / max) * 100}%`, minWidth: s.v.avg != null ? 4 : 0, bgcolor: s.color, borderRadius: 4 }} />
          </Box>
        </Box>
      ))}
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ pt: 1, borderTop: `1px dashed ${BORDER_MAIN}` }}>
        <Typography sx={{ fontSize: "0.82rem", color: TEXT_SUB }}>รวมตั้งแต่ขอซื้อจนรับของครบ</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: "1rem", color: TEXT_MAIN, ...NUM }}>{daysText(lt.total.avg)}</Typography>
      </Stack>
    </Stack>
  );
};

/** ลิงก์ไปงานบนปฏิทิน (ไม่ผูกงาน = ไม่มีลิงก์) */
const eventLinkOf = (key) => (key && key !== "-" ? `/event?event=${key}&t=${Date.now()}` : null);

/** สรุปตามงาน / ร้านค้า — แบ่งหน้า · มือถือเป็นรายการ 2 บรรทัด */
const GroupTable = ({ rows, firstHeader, linkJob, unit }) => {
  const pg = usePaged(rows, 10);
  const wide = useMediaQuery("(min-width:900px)");
  const name = (r) => {
    const to = linkJob ? eventLinkOf(r.key) : null;
    return to ? (
      <Typography component={RouterLink} to={to} title="ดูงานนี้ในปฏิทิน"
        sx={{ fontSize: "0.84rem", fontWeight: 600, color: TEXT_MAIN, lineHeight: 1.4, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 0.5, "&:hover": { color: "#2563eb", textDecoration: "underline" } }}>
        {r.label}<CalendarMonth sx={{ fontSize: 15, color: "#94a3b8" }} />
      </Typography>
    ) : <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: TEXT_MAIN, lineHeight: 1.4 }}>{r.label}</Typography>;
  };
  if (!wide) {
    return (
      <>
        <Stack divider={<Box sx={{ borderTop: `1px solid ${BORDER_MAIN}` }} />}>
          {pg.rows.map((r) => (
            <Box key={r.key} sx={{ py: 1 }}>
              <Stack direction="row" alignItems="baseline" spacing={1}>
                <Box sx={{ flex: 1, minWidth: 0 }}>{name(r)}</Box>
                <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB, whiteSpace: "nowrap" }}>{r.count} ใบ</Typography>
              </Stack>
              <Stack direction="row" useFlexGap flexWrap="wrap" sx={{ mt: 0.35, columnGap: 1.5, rowGap: 0.25, fontSize: "0.76rem", color: TEXT_SUB }}>
                <span>ประมาณการ <b style={{ color: TEXT_MAIN, ...NUM }}>{baht(r.est)}</b></span>
                <span>ซื้อจริง <b style={{ color: PR_ACCENT, ...NUM }}>{baht(r.actual)}</b></span>
                {r.pendingReceive > 0 && <span>ค้างรับ <b style={{ color: prStatus("ordered").color, ...NUM }}>{baht(r.pendingReceive)}</b></span>}
                {r.late > 0 && <span style={{ color: "#dc2626", fontWeight: 700 }}>เลยวันต้องใช้ {r.late} ใบ</span>}
              </Stack>
            </Box>
          ))}
        </Stack>
        <PageBar {...pg} unit={unit} />
      </>
    );
  }
  return (
    <>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 760, ...TABLE_SX }}>
          <TableHead>
            <TableRow>
              <TableCell>{firstHeader}</TableCell>
              <TableCell align="right">ใบ</TableCell>
              <TableCell align="right">ประมาณการ</TableCell>
              <TableCell align="right">สั่งซื้อจริง</TableCell>
              <TableCell align="right">รอตรวจสอบ/อนุมัติ</TableCell>
              <TableCell align="right">รอสั่งซื้อ</TableCell>
              <TableCell align="right">ของค้างรับ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pg.rows.map((r) => (
              <TableRow key={r.key} hover>
                <TableCell sx={{ minWidth: 220 }}>
                  {name(r)}
                  {r.late > 0 && <Typography sx={{ fontSize: "0.72rem", color: "#dc2626", fontWeight: 700 }}>เลยวันต้องใช้ {r.late} ใบ</Typography>}
                </TableCell>
                <TableCell align="right" sx={{ color: `${TEXT_SUB} !important` }}>{r.count}</TableCell>
                <TableCell align="right">{r.est ? baht(r.est) : DASH}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>{r.actual ? baht(r.actual) : DASH}</TableCell>
                <TableCell align="right" sx={{ color: r.waitApproval ? `${prStatus("pending").color} !important` : undefined }}>{r.waitApproval ? baht(r.waitApproval) : DASH}</TableCell>
                <TableCell align="right" sx={{ color: r.waitOrder ? `${prStatus("approved").color} !important` : undefined }}>{r.waitOrder ? baht(r.waitOrder) : DASH}</TableCell>
                <TableCell align="right" sx={{ color: r.pendingReceive ? `${prStatus("ordered").color} !important` : undefined, fontWeight: r.pendingReceive ? 700 : 400 }}>{r.pendingReceive ? baht(r.pendingReceive) : DASH}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <PageBar {...pg} unit={unit} />
    </>
  );
};

const AlertTag = ({ text, color }) => (
  <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 0.85, py: 0.1, borderRadius: 99, fontSize: "0.7rem", fontWeight: 700, color, bgcolor: alpha(color, 0.08), border: `1px solid ${alpha(color, 0.25)}`, whiteSpace: "nowrap" }}>
    <Box component="span" sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: color }} />
    {text}
  </Box>
);

/** ใบขอซื้อแบบย่อ (ใช้ในแถวรายบุคคลที่กางออก และรายการบนมือถือ) */
const DocCard = ({ r, onOpen }) => {
  const st = prStatus(r.status);
  return (
    <Box onClick={() => onOpen(r._id)} sx={{ p: 1.25, border: `1px solid ${BORDER_MAIN}`, borderLeft: `4px solid ${st.color}`, borderRadius: 2, cursor: "pointer", bgcolor: "#fff", "&:hover": { bgcolor: "#f8fafc" } }}>
      <Stack direction="row" justifyContent="space-between" spacing={1}>
        <Typography sx={{ fontWeight: 800, fontSize: "0.82rem" }}>{r.docNo}</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: "0.9rem", ...NUM }}>{baht(r.actualTotal || r.estTotal)}</Typography>
      </Stack>
      <Typography sx={{ fontWeight: 600, fontSize: "0.86rem" }} noWrap>{r.subject}</Typography>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
        <Typography variant="caption" sx={{ color: TEXT_SUB, minWidth: 0 }} noWrap>
          {thaiDate(r.docDate)} · {r.requester?.name}{r.order?.supplier ? ` · ${r.order.supplier}` : ""}
        </Typography>
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
          {isLate(r) && <WarningAmber titleAccess="เลยวันต้องใช้" sx={{ fontSize: 15, color: "#dc2626" }} />}
          <Typography variant="caption" sx={{ color: st.color, fontWeight: 800, whiteSpace: "nowrap" }}>{st.short || st.label}</Typography>
        </Stack>
      </Stack>
    </Box>
  );
};

/** แถวรายบุคคล — ชื่อ + ป้ายสิ่งที่ค้าง · จอใหญ่มีตัวเลข 4 ช่องในแถว · กดเพื่อกางดูทีละใบ */
const PersonRow = ({ g, docs, onOpen, isDesktop }) => {
  const [open, setOpen] = useState(false);
  const pg = usePaged(docs, 8);
  const alerts = [
    g.waitApproval > 0 && { text: `รอตรวจสอบ/อนุมัติ ${baht(g.waitApproval)}`, color: prStatus("pending").color },
    g.waitOrder > 0 && { text: `รอสั่งซื้อ ${baht(g.waitOrder)}`, color: prStatus("approved").color },
    g.pendingReceive > 0 && { text: `ของค้างรับ ${baht(g.pendingReceive)}`, color: prStatus("ordered").color },
    g.late > 0 && { text: `เลยวันต้องใช้ ${g.late} ใบ`, color: "#dc2626" },
  ].filter(Boolean);
  const cells = [
    { label: "ขอซื้อ", value: g.est, color: TEXT_MAIN },
    { label: "สั่งซื้อจริง", value: g.actual, color: PR_ACCENT },
    { label: "ค้างรับ", value: g.pendingReceive, color: prStatus("ordered").color },
    { label: "รับครบ", value: g.received, color: prStatus("received").color, unit: "ใบ" },
  ];
  const fmt = (c) => (c.unit ? `${c.value || 0} ${c.unit}` : baht(c.value));
  return (
    <Box sx={{ border: `1px solid ${BORDER_MAIN}`, borderRadius: 2.5, overflow: "hidden", bgcolor: "#fff" }}>
      <Box role="button" tabIndex={0} onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v) => !v); } }}
        sx={{ px: 1.5, py: { xs: 1.25, md: 1 }, cursor: "pointer", "&:hover": { bgcolor: "#f8fafc" } }}>
        <Stack direction="row" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1.25}>
          <Avatar sx={{ width: 34, height: 34, bgcolor: personColor(g.label), fontWeight: 800, fontSize: "0.9rem" }}>{personInitial(g.label)}</Avatar>
          <Box sx={{ minWidth: 0, flex: isDesktop ? "1.6 1 0" : 1 }}>
            <Stack direction="row" alignItems="center" useFlexGap flexWrap="wrap" sx={{ minWidth: 0, columnGap: 0.75, rowGap: 0.4 }}>
              <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", color: TEXT_MAIN, lineHeight: 1.3 }} noWrap>{g.label}</Typography>
              <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB, whiteSpace: "nowrap" }}>{g.count} ใบ</Typography>
              {alerts.map((al) => <AlertTag key={al.text} {...al} />)}
            </Stack>
          </Box>
          {isDesktop && (
            <Box sx={{ flex: "2.4 1 0", minWidth: 0, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", columnGap: 1.5 }}>
              {cells.map((c) => (
                <Box key={c.label} sx={{ minWidth: 0, textAlign: "right" }}>
                  <Typography sx={{ fontSize: "0.68rem", color: TEXT_SUB, fontWeight: 600 }} noWrap>{c.label}</Typography>
                  <Typography sx={{ fontSize: "0.95rem", fontWeight: 800, color: c.value ? c.color : "#cbd5e1", lineHeight: 1.3, ...NUM }}>{fmt(c)}</Typography>
                </Box>
              ))}
            </Box>
          )}
          <ExpandMore sx={{ color: TEXT_SUB, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none" }} />
        </Stack>
      </Box>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ px: 1.5, pb: 1.5, pt: 1, borderTop: `1px solid ${BORDER_MAIN}`, bgcolor: "#fcfdfe" }}>
          {!isDesktop && (
            <Box sx={{ mb: 1, px: 1.25, py: 0.5, borderRadius: 2, bgcolor: "#f8fafc", border: `1px solid ${BORDER_MAIN}` }}>
              {cells.map((c, ci) => (
                <Stack key={c.label} direction="row" alignItems="baseline" justifyContent="space-between" spacing={1} sx={{ py: 0.6, borderTop: ci ? `1px dashed ${BORDER_MAIN}` : 0 }}>
                  <Typography sx={{ fontSize: "0.8rem", color: TEXT_SUB }}>{c.label}</Typography>
                  <Typography sx={{ fontSize: "0.92rem", fontWeight: 800, color: c.value ? c.color : "#cbd5e1", ...NUM }}>{fmt(c)}</Typography>
                </Stack>
              ))}
            </Box>
          )}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 1 }}>
            {pg.rows.map((r) => <DocCard key={r._id} r={r} onOpen={onOpen} />)}
          </Box>
          <PageBar {...pg} unit="ใบ" />
        </Box>
      </Collapse>
    </Box>
  );
};

/** ตารางรายใบ (จอใหญ่) */
const DocTable = ({ rows, onOpen }) => (
  <Box sx={{ overflowX: "auto" }}>
    <Table size="small" sx={{ minWidth: 1040, ...TABLE_SX, "& td": { ...TABLE_SX["& td"], verticalAlign: "top" } }}>
      <TableHead>
        <TableRow>
          <TableCell>เลขที่ / วันที่</TableCell>
          <TableCell>ผู้ขอซื้อ</TableCell>
          <TableCell>เรื่อง · งาน</TableCell>
          <TableCell>ต้องใช้ภายใน</TableCell>
          <TableCell>ร้านค้า · PO</TableCell>
          <TableCell align="right">ประมาณการ</TableCell>
          <TableCell align="right">สั่งซื้อจริง</TableCell>
          <TableCell>สถานะ</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r) => {
          const pri = priorityMeta(r.priority);
          const late = isLate(r);
          return (
            <TableRow key={r._id} hover onClick={() => onOpen(r._id)} sx={{ cursor: "pointer" }}>
              <TableCell sx={{ whiteSpace: "nowrap" }}><b>{r.docNo}</b><br /><span style={{ color: TEXT_SUB }}>{thaiDate(r.docDate)}</span></TableCell>
              <TableCell sx={{ whiteSpace: "nowrap" }}>{r.requester?.name || "-"}</TableCell>
              <TableCell sx={{ maxWidth: 300 }}>
                <Typography noWrap sx={{ fontSize: "inherit", fontWeight: 600 }}>{r.subject}</Typography>
                <Typography noWrap variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>
                  <Box component="span" sx={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", bgcolor: catColor(r.category), mr: 0.5 }} />
                  {categoryLabel(r.category)} · {r.eventId ? prJobText(r.job) : "ไม่ผูกงาน"}
                </Typography>
              </TableCell>
              <TableCell sx={{ whiteSpace: "nowrap" }}>
                {r.neededBy ? <span style={{ color: late ? "#dc2626" : TEXT_MAIN, fontWeight: late ? 700 : 400 }}>{thaiDate(r.neededBy)}</span> : DASH}
                {r.priority && r.priority !== "normal" && <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: pri.color }}>{pri.label}</Typography>}
                {late && <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#dc2626" }}>เลยมา {moment().diff(moment(r.neededBy), "days")} วัน</Typography>}
              </TableCell>
              <TableCell sx={{ maxWidth: 200 }}>
                <Typography noWrap sx={{ fontSize: "inherit" }}>{r.order?.supplier || DASH}</Typography>
                {r.order?.poNo && <Typography noWrap variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>PO {r.order.poNo}</Typography>}
              </TableCell>
              <TableCell align="right" sx={{ color: r.status === "cancelled" ? `${TEXT_SUB} !important` : undefined, textDecoration: r.status === "cancelled" ? "line-through" : "none" }}>{baht(r.estTotal)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>
                {r.actualTotal ? baht(r.actualTotal) : DASH}
                {pendingReceiveOf(r) > 0 && <span style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: prStatus("ordered").color }}>ค้างรับ {baht(pendingReceiveOf(r))}</span>}
              </TableCell>
              <TableCell><PrStatusBadge status={r.status} short /></TableCell>
            </TableRow>
          );
        })}
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
  const [category, setCategory] = useState("all");
  const [group, setGroup] = useState("job");
  const [docTab, setDocTab] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

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

  const applyPreset = (value) => {
    setPreset(value);
    const p = PRESETS.find((x) => x.value === value);
    if (!p?.range) return;
    const [a, b] = p.range();
    setFrom(a ? a.format("YYYY-MM-DD") : "");
    setTo(b ? b.format("YYYY-MM-DD") : "");
  };

  // ช่วงเวลา (วันที่ใบ) + ประเภท → ใช้กับทั้งหน้า · ผู้ขอกรองหลังจากนั้น (ตัวเลือกผู้ขอยังเห็นครบทุกคนในช่วง)
  const inRange = useMemo(() => allRows.filter((r) => {
    const d = moment(r.docDate);
    return (!from || d.isSameOrAfter(from, "day")) && (!to || d.isSameOrBefore(to, "day"))
      && (category === "all" || (r.category || "material") === category);
  }), [allRows, from, to, category]);
  const rows = useMemo(() => inRange.filter((r) => person === "all" || String(r.requester?.userId || "") === person).sort(sortByDoc), [inRange, person]);
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
  const categoryOptions = useMemo(() => {
    const n = new Map();
    allRows.forEach((r) => { const k = r.category || "material"; n.set(k, (n.get(k) || 0) + 1); });
    return PR_CATEGORIES.filter((c) => n.has(c.value)).map((c) => ({ ...c, count: n.get(c.value) }));
  }, [allRows]);

  const report = useMemo(() => buildPrReport(rows), [rows]);
  const t = report.totals;
  const docsByPerson = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => { const k = String(r.requester?.userId || r.requester?.name || "-"); if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
    return m;
  }, [rows]);
  const docRows = useMemo(() => (docTab === "open" ? rows.filter((r) => OPEN.includes(r.status)) : docTab === "late" ? report.lateRows : rows), [docTab, rows, report.lateRows]);
  const docPg = usePaged(docRows, 15);
  const personPg = usePaged(report.byPerson, 10);
  const itemPg = usePaged(report.topItems, 10);
  const periodLabel = from || to ? `${from ? thaiDate(from) : "เริ่มต้น"} – ${to ? thaiDate(to) : "ปัจจุบัน"}` : "ทั้งหมด";
  const catText = category === "all" ? "" : categoryLabel(category);
  const selectedName = personOptions.find((p) => p.id === person)?.name || "";
  const openCount = rows.filter((r) => OPEN.includes(r.status)).length;

  const activeFilterCount = (preset !== "year" ? 1 : 0) + (person !== "all" ? 1 : 0) + (category !== "all" ? 1 : 0);
  useCloseOnPick(filtersOpen, () => setFiltersOpen(false), { preset, person, category }, (_, next) => next.preset === "custom");

  if (!canUse) return <Navigate to="/dashboard" replace />;

  const openPr = (id) => navigate(`/purchase/${id}`);
  const doExport = async () => {
    setExporting(true);
    try {
      const { exportPrReport } = await import("../utils/prExcelExport");
      await exportPrReport(report, rows, {
        periodLabel: catText ? `${periodLabel} · เฉพาะ${catText}` : periodLabel,
        fileName: `รายงานใบขอซื้อ${catText ? ` (${catText})` : ""} ${moment().format("YYYY-MM-DD")}`,
      });
    } catch (err) {
      setError(errorText(err, "ส่งออก Excel ไม่สำเร็จ"));
    } finally {
      setExporting(false);
    }
  };

  const groupMeta = {
    job: { title: "สรุปตามงาน / โครงการ", hint: "งานไหนใช้ของไปเท่าไร · กดชื่องานเพื่อดูในปฏิทิน", header: "งาน / โครงการ", rows: report.byJob, unit: "งาน" },
    supplier: { title: "สรุปตามร้านค้า", hint: "เฉพาะใบที่สั่งซื้อแล้ว · ยอดซื้อและของที่ยังค้างรับของแต่ละร้าน", header: "ร้านค้า", rows: report.bySupplier, unit: "ร้าน" },
  }[group];

  const filterBox = (
    <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}
      sx={isDesktop ? { mb: 1.5, p: 1, bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 3 } : { "& > *": { width: "100%" } }}>
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
        <PersonSelectField label="ผู้ขอซื้อ" title="เลือกผู้ขอซื้อ" value={person} onChange={setPerson}
          allLabel="ทุกคน" allCount={inRange.length} unit="ใบ"
          options={personOptions.map((p) => ({ id: p.id, name: p.name, count: p.count }))}
          sx={{ minWidth: { xs: "100%", md: 240 } }} />
      )}
      {categoryOptions.length > 1 && (
        <SelectField label="ประเภทการซื้อ" value={category} onChange={(e) => setCategory(e.target.value)} sx={{ minWidth: { md: 200 } }}>
          <option value="all">ทุกประเภท</option>
          {categoryOptions.map((c) => <option key={c.value} value={c.value}>{c.label} ({c.count})</option>)}
        </SelectField>
      )}
      <Box sx={{ flex: 1, display: { xs: "none", md: "block" } }} />
      <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 600 }}>{periodLabel} · อิงวันที่ของใบขอซื้อ</Typography>
      <ExportExcelButton onClick={doExport} loading={exporting} disabled={loading || !rows.length} />
    </Stack>
  );

  return (
    <Box sx={PAGE_SX}>
      {/* ── หัวเพจ (โครงเดียวกับหน้าใบขอซื้อ) ── */}
      <Box sx={{ borderRadius: 3, border: `1px solid ${BORDER_MAIN}`, bgcolor: "#fff", px: { xs: 1.5, sm: 2 }, py: { xs: 1.25, sm: 1.75 }, mb: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={{ xs: 1.25, sm: 1.5 }}>
          <Box sx={{ width: { xs: 36, sm: 40 }, height: { xs: 36, sm: 40 }, borderRadius: 2.5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: PR_ACCENT, color: "#fff" }}>
            <Assessment />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontWeight: 900, fontSize: { xs: "1.12rem", sm: "1.3rem" }, color: TEXT_MAIN, lineHeight: 1.25 }}>รายงานการจัดซื้อ (PR)</Typography>
            <Typography variant="caption" sx={{ color: TEXT_SUB, display: { xs: "none", sm: "block" } }}>
              ยอดขอซื้อ · ซื้อจริง · ค้างอนุมัติ/สั่งซื้อ/รับของ · ระยะเวลาดำเนินการ · ตามผู้ขอ งาน ประเภท และร้านค้า
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ mt: 0.75, overflowX: "auto", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
              {[{ to: "/purchase", label: "ใบขอซื้อ" }, ...(can("reviewExpense") || can("approveExpense") || viewAll ? [{ to: "/purchase/approvals", label: "รอดำเนินการ" }] : [])].map((l) => (
                <Chip key={l.to} component={RouterLink} to={l.to} clickable size="small"
                  label={<span>{l.label} <ChevronRight sx={{ fontSize: 13, verticalAlign: "-2px" }} /></span>}
                  sx={{ height: 26, fontWeight: 700, fontSize: "0.76rem", bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, color: TEXT_SUB, "& .MuiChip-label": { px: 1 } }} />
              ))}
            </Stack>
          </Box>
          {!isDesktop && (
            <IconButton onClick={() => setFiltersOpen(true)} aria-label="ตัวกรอง" sx={{ border: `1px solid ${BORDER_MAIN}`, borderRadius: 2, flexShrink: 0 }}>
              <Badge color="primary" badgeContent={activeFilterCount} invisible={!activeFilterCount}><Tune /></Badge>
            </IconButton>
          )}
        </Stack>
      </Box>

      {/* ── ตัวกรอง — จอใหญ่บนหน้า · มือถือในแผ่นล่าง ── */}
      {isDesktop ? filterBox : (
        <>
          <Stack direction="row" spacing={0.75} useFlexGap alignItems="center" sx={{ mb: 1.25, flexWrap: "wrap" }}>
            <Chip size="small" label={PRESETS.find((p) => p.value === preset)?.label || periodLabel} sx={{ fontWeight: 700, bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}` }} />
            {person !== "all" && <Chip size="small" label={`ผู้ขอ: ${selectedName}`} onDelete={() => setPerson("all")} sx={{ fontWeight: 700 }} />}
            {catText && <Chip size="small" label={catText} onDelete={() => setCategory("all")} sx={{ fontWeight: 700 }} />}
            <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 600 }}>{periodLabel}</Typography>
          </Stack>
          <Drawer anchor="bottom" open={filtersOpen} onClose={() => setFiltersOpen(false)}
            PaperProps={{ sx: { borderTopLeftRadius: 18, borderTopRightRadius: 18, px: 2, pt: 1, pb: "calc(16px + env(safe-area-inset-bottom))", maxHeight: "85vh" } }}>
            <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: "#cbd5e1", mx: "auto", mb: 1.25 }} />
            <Stack direction="row" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography sx={{ flex: 1, fontWeight: 800, fontSize: "1rem", color: TEXT_MAIN }}>ตัวกรองรายงาน</Typography>
              {activeFilterCount > 0 && (
                <Button size="small" onClick={() => { applyPreset("year"); setPerson("all"); setCategory("all"); }} sx={{ textTransform: "none", fontWeight: 700, color: "#dc2626" }}>ล้างทั้งหมด</Button>
              )}
              <IconButton size="small" aria-label="ปิด" onClick={() => setFiltersOpen(false)}><Close /></IconButton>
            </Stack>
            {filterBox}
            <Button fullWidth variant="contained" onClick={() => setFiltersOpen(false)}
              sx={{ mt: 2, py: 1.1, textTransform: "none", fontWeight: 800, borderRadius: 2.5, boxShadow: "none", bgcolor: PR_ACCENT, "&:hover": { bgcolor: "#3730a3", boxShadow: "none" } }}>
              ดูรายงาน
            </Button>
          </Drawer>
        </>
      )}

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
            <Kpi label="ยอดขอซื้อ (ประมาณการ)" value={baht(t.est)} sub={`${t.count} ใบ${report.byStatus.cancelled ? ` · ยกเลิก ${report.byStatus.cancelled.count}` : ""}`} color={TEXT_MAIN} />
            <Kpi label="สั่งซื้อจริง" value={baht(t.actual)} sub={`${t.ordered} ใบ · รับครบ ${t.received} ใบ`} color={PR_ACCENT} />
            <Kpi label="ประหยัดจากประมาณการ" value={baht(report.saving)}
              sub={report.saving ? `${report.savingPct > 0 ? "ต่ำกว่า" : "สูงกว่า"}ประมาณการ ${Math.abs(report.savingPct)}%` : "เทียบเฉพาะใบที่สั่งซื้อแล้ว"}
              color={report.saving < 0 ? "#b91c1c" : "#15803d"} />
            <Kpi label="รอตรวจสอบ/อนุมัติ" value={baht(t.waitApproval)} sub={`${(report.byStatus.pending?.count || 0) + (report.byStatus.reviewed?.count || 0)} ใบ${report.byStatus.rejected ? ` · ตีกลับ ${report.byStatus.rejected.count}` : ""}`}
              color={prStatus("pending").color} followup active={t.waitApproval > 0} />
            <Kpi label="อนุมัติแล้ว · รอสั่งซื้อ" value={baht(t.waitOrder)} sub={`${report.byStatus.approved?.count || 0} ใบ`} color={prStatus("approved").color} followup active={t.waitOrder > 0} />
            <Kpi label="ของค้างรับ (มูลค่า)" value={baht(t.pendingReceive)} sub={t.late ? `เลยวันต้องใช้ ${t.late} ใบ` : "ไม่มีใบเลยวันต้องใช้"}
              color={t.late ? "#dc2626" : prStatus("ordered").color} followup active={t.pendingReceive > 0 || t.late > 0} />
          </Box>

          {catText && (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.5, py: 1, borderRadius: 2, bgcolor: "#f0f9ff", border: "1px solid #bae6fd" }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: catColor(category), flexShrink: 0 }} />
              <Typography sx={{ flex: 1, fontSize: "0.82rem", color: "#0c4a6e" }}>ตัวเลขทั้งหน้านี้เป็น <b>เฉพาะ{catText}</b></Typography>
              <Button size="small" onClick={() => setCategory("all")} sx={{ textTransform: "none", fontWeight: 700 }}>ดูทุกประเภท</Button>
            </Stack>
          )}

          <Panel icon={<FactCheck />} color="#d97706" title="สถานะตามขั้นดำเนินการ" hint="ขอซื้อ → ตรวจสอบ → อนุมัติ → สั่งซื้อ → รับของ · ใบที่ยังค้างในช่วงเวลานี้ และใครต้องทำต่อ">
            <Pipeline rows={rows} byStatus={report.byStatus} />
          </Panel>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "3fr 2fr" }, gap: 1.5 }}>
            <Panel icon={<BarChart />} color={PR_ACCENT} title="รายเดือน" hint="ยอดขอซื้อ (ประมาณการ) เทียบ สั่งซื้อจริง"><MonthBars rows={report.byMonth} /></Panel>
            <Panel icon={<DonutLarge />} color="#ea580c" title="ตามประเภทการซื้อ" hint="แถบจาง = ประมาณการ · แถบเข้ม = สั่งซื้อจริง"><CategoryBars rows={report.byCategory} /></Panel>
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "3fr 2fr" }, gap: 1.5 }}>
            <Panel icon={<Storefront />} color="#0e7490" title="ร้านค้าที่สั่งซื้อมากที่สุด" hint="ตามยอดสั่งซื้อจริง · มูลค่าของที่ยังค้างรับ"><SupplierBars rows={report.bySupplier} /></Panel>
            <Panel icon={<Timer />} color="#6d28d9" title="ระยะเวลาดำเนินการเฉลี่ย" hint="นับจากเวลาจริงในใบ · เฉพาะใบที่ผ่านขั้นนั้นแล้ว"><LeadTime lt={report.leadTime} /></Panel>
          </Box>

          {report.lateRows.length > 0 && (
            <Panel icon={<WarningAmber />} color="#dc2626" title={`เลยวันต้องใช้ (${report.lateRows.length})`} hint="ใบที่ยังไม่รับของครบ แต่เลยวันที่ผู้ขอต้องใช้แล้ว — เรียงจากเลยนานที่สุด">
              <Stack divider={<Box sx={{ borderTop: `1px solid ${BORDER_MAIN}` }} />}>
                {report.lateRows.slice(0, 10).map((r) => (
                  <Stack key={r._id} direction="row" alignItems="center" spacing={1.25} onClick={() => openPr(r._id)} sx={{ py: 0.9, cursor: "pointer", "&:hover": { bgcolor: "#f8fafc" } }}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography noWrap sx={{ fontSize: "0.86rem", fontWeight: 700, color: TEXT_MAIN }}>{r.docNo} · {r.subject}</Typography>
                      <Typography noWrap sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>
                        {r.requester?.name} · ต้องใช้ {thaiDate(r.neededBy)}{r.order?.supplier ? ` · ${r.order.supplier}` : ""}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: "#dc2626", whiteSpace: "nowrap" }}>เลย {moment().diff(moment(r.neededBy), "days")} วัน</Typography>
                    <Box sx={{ flexShrink: 0 }}><PrStatusBadge status={r.status} short /></Box>
                  </Stack>
                ))}
              </Stack>
              {report.lateRows.length > 10 && <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 1 }}>ดูครบทุกใบที่แท็บ “เลยวันต้องใช้” ในแผงรายใบด้านล่าง</Typography>}
            </Panel>
          )}

          {report.byPerson.length > 0 && (
            <Panel icon={<Groups />} color={PR_ACCENT} title={`รายบุคคล (${report.byPerson.length} คน)`} hint="ใครขอซื้อไปเท่าไร · ค้างอยู่ขั้นไหน · กดชื่อเพื่อดูทีละใบ">
              <Stack spacing={1}>
                {personPg.rows.map((g) => <PersonRow key={g.key} g={g} docs={docsByPerson.get(g.key) || []} onOpen={openPr} isDesktop={isDesktop} />)}
              </Stack>
              <PageBar {...personPg} unit="คน" />
            </Panel>
          )}

          <Panel icon={group === "job" ? <Work /> : <Storefront />} color="#2563eb" title={groupMeta.title} hint={groupMeta.hint}
            action={(
              <ToggleButtonGroup size="small" exclusive value={group} onChange={(_, v) => v && setGroup(v)} sx={toggleSx}>
                <ToggleButton value="job">งาน ({report.byJob.length})</ToggleButton>
                <ToggleButton value="supplier">ร้านค้า ({report.bySupplier.length})</ToggleButton>
              </ToggleButtonGroup>
            )}>
            {groupMeta.rows.length
              ? <GroupTable key={group} rows={groupMeta.rows} firstHeader={groupMeta.header} linkJob={group === "job"} unit={groupMeta.unit} />
              : <Typography variant="body2" sx={{ color: TEXT_SUB }}>ไม่มีข้อมูล</Typography>}
          </Panel>

          <Panel icon={<Inventory2 />} color="#0d9488" title={`สินค้าที่ขอซื้อ (${report.topItems.length} รายการ)`} hint="รวมตามชื่อสินค้าและหน่วย · ราคาใช้ราคาจริงถ้าสั่งซื้อแล้ว · ไม่รวมใบยกเลิก">
            {isDesktop ? (
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
                    {itemPg.rows.map((g) => (
                      <TableRow key={g.key}>
                        <TableCell sx={{ fontWeight: 600, maxWidth: 360 }}><Typography noWrap sx={{ fontSize: "inherit", fontWeight: "inherit" }}>{g.name}</Typography></TableCell>
                        <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{fmtQty(g.qty)} {g.unit}</TableCell>
                        <TableCell align="right" sx={{ color: `${TEXT_SUB} !important` }}>{g.docs}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: "nowrap", color: `${TEXT_SUB} !important` }}>
                          {!g.minPrice ? "—" : g.minPrice === g.maxPrice ? baht(g.minPrice) : `${baht(g.minPrice)} – ${baht(g.maxPrice)}`}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800 }}>{baht(g.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            ) : (
              <Stack divider={<Box sx={{ borderTop: `1px solid ${BORDER_MAIN}` }} />}>
                {itemPg.rows.map((g) => (
                  <Box key={g.key} sx={{ py: 0.9 }}>
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, minWidth: 0 }}>{g.name}</Typography>
                      <Typography sx={{ fontSize: "0.88rem", fontWeight: 800, ...NUM }}>{baht(g.amount)}</Typography>
                    </Stack>
                    <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>
                      {fmtQty(g.qty)} {g.unit} · {g.docs} ใบ{g.minPrice ? ` · ${g.minPrice === g.maxPrice ? baht(g.minPrice) : `${baht(g.minPrice)} – ${baht(g.maxPrice)}`}/หน่วย` : ""}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
            <PageBar {...itemPg} unit="รายการ" />
          </Panel>

          <Panel icon={<ReceiptLong />} color="#475569" title="รายใบทั้งหมด" hint="กดที่แถวเพื่อเปิดใบขอซื้อ"
            action={(
              <ToggleButtonGroup size="small" exclusive value={docTab} onChange={(_, v) => v && setDocTab(v)} sx={toggleSx}>
                <ToggleButton value="all">ทั้งหมด ({rows.length})</ToggleButton>
                <ToggleButton value="open">ค้างดำเนินการ ({openCount})</ToggleButton>
                {report.lateRows.length > 0 && <ToggleButton value="late">เลยวันต้องใช้ ({report.lateRows.length})</ToggleButton>}
              </ToggleButtonGroup>
            )}>
            {!docRows.length ? <Typography variant="body2" sx={{ color: TEXT_SUB }}>ไม่มีใบในกลุ่มนี้</Typography>
              : isDesktop ? <DocTable rows={docPg.rows} onOpen={openPr} />
                : <Stack spacing={1}>{docPg.rows.map((r) => <DocCard key={r._id} r={r} onOpen={openPr} />)}</Stack>}
            <PageBar {...docPg} unit="ใบ" />
          </Panel>
        </Stack>
      )}
    </Box>
  );
}
