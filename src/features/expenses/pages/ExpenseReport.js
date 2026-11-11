/**
 * ExpenseReport — รายงานย้อนหลังการเบิก Advance / เคลม (ติดตามงบประมาณ)
 *
 * ✅ ตอบคำถามที่ผู้ใช้ต้องการ "รู้ได้ทันที": เบิกไปเท่าไร · ใช้จริงเท่าไร · เงินค้างอยู่กับใคร · ต้องคืน/จ่ายเพิ่ม
 * เท่าไร — แยกตามคน / ตามงาน / ตามหมวด / รายเดือน ในหน้าเดียว
 * ⚠️ ช่างเห็นเฉพาะของตัวเอง (server กรอง) — หัวหน้าเห็นทั้งบริษัทและกรองรายคนได้
 * ⚠️ ไม่มีเพดานงบ (ตามที่ผู้ใช้เลือก "ติดตามยอดและรายงาน") — หน้านี้รายงานอย่างเดียว ไม่บล็อกการเบิก
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import { Link as RouterLink } from "react-router-dom";
import {
  Box, Stack, Typography, Button, Alert, Skeleton, Table, TableHead, TableRow, TableCell, Drawer, IconButton,
  TableBody, ToggleButtonGroup, ToggleButton, useMediaQuery, Tooltip, Chip,
  Collapse,
  Avatar,
  ButtonBase,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { CalendarMonthRounded as CalendarMonth, BarChartRounded as BarChart, DonutLargeRounded as DonutLarge, WorkRounded as Work, EngineeringRounded as Engineering, ReceiptLongRounded as ReceiptLong, InsightsRounded as Insights, WarningAmberRounded as WarningAmber, CloseRounded as Close, ExpandMoreRounded as ExpandMore, GroupsRounded as Groups } from "@mui/icons-material";

import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import SelectField from "@/shared/ui/SelectField";
import PersonSelectField from "@/shared/ui/PersonSelectField";
import usePaged, { PageBar } from "@/shared/ui/usePaged";
import useCloseOnPick from "@/shared/hooks/useCloseOnPick";
import { thaiDate, THAI_MONTHS_SHORT } from "@/shared/utils/thaiDate";
import usePermissions from "@/shared/hooks/usePermissions";
import ExpenseService, { errorText } from "../services/ExpenseService";
import { buildExpenseReport, buildPersonLedger, personBreakdown, filterByCategory, applyBasis } from "../utils/expenseReport";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import { hasValidAvatar } from "@/shared/utils/user";
import {
  KIND_META, statusMeta, categoryMeta, EXPENSE_CATEGORIES, baht, TEXT_SUB, TEXT_MAIN, BORDER_MAIN, personFullName, installmentText, MONEY_TERMS as MT,
} from "../expenseMeta";
import KindBadge from "../components/KindBadge";
import StatusBadge from "../components/StatusBadge";
import ExportExcelButton from "@/shared/ui/ExportExcelButton";
import ExpenseBulkPrint from "../components/ExpenseBulkPrint";
import ExportPdfButton from "@/shared/ui/ExportPdfButton";

const PRESETS = [
  { value: "month", label: "เดือนนี้", range: () => [moment().startOf("month"), moment()] },
  { value: "lastMonth", label: "เดือนที่แล้ว", range: () => [moment().subtract(1, "month").startOf("month"), moment().subtract(1, "month").endOf("month")] },
  { value: "quarter", label: "ไตรมาสนี้", range: () => [moment().startOf("quarter"), moment()] },
  { value: "year", label: "ปีนี้", range: () => [moment().startOf("year"), moment()] },
  { value: "12m", label: "12 เดือนล่าสุด", range: () => [moment().subtract(11, "months").startOf("month"), moment()] },
  { value: "all", label: "ทั้งหมด", range: () => [null, null] },
  { value: "custom", label: "กำหนดเอง", range: null },
];

const monthLabel = (key) => {
  const [y, m] = String(key).split("-").map(Number);
  return y ? `${THAI_MONTHS_SHORT[m - 1]} ${String(y + 543).slice(-2)}` : "-";
};

/**
 * กล่องตัวเลขสรุป — ✅ ผู้ใช้: "จัดสีให้มืออาชีพ พอดี เข้าใจง่าย ไม่จืด"
 * ระบบสีของทั้งหน้า (ใช้ความหมายเดียวกันทุกจุด):
 *   ยอดหลัก (core)      — ตัวเลขเป็นสีของมันเสมอ + แถบสีบางด้านบน
 *                          ขอเบิก = เข้ม · จ่ายล่วงหน้า = เขียว · ใช้จริง = ม่วง · สำรองจ่าย = ส้ม
 *   ยอดที่ต้องติดตาม (followup) — เงินค้าง / รอคืน / รอจ่ายเพิ่ม: เป็น 0 = ตัวเลขจางสงบ ไม่แย่งสายตา
 *                          มีค่า = ตัวเลขเป็นสี + พื้นอ่อน + แถบบน (ต้องมีคนลงมือ)
 */
const Kpi = ({ label, value, sub, color, highlight, followup = false, active }) => {
  const on = followup ? Boolean(active) : true;
  const tint = followup ? on : highlight;
  return (
    <Box sx={{
      position: "relative", overflow: "hidden",
      p: { xs: 1.25, sm: 1.5 }, pt: { xs: 1.5, sm: 1.75 }, borderRadius: 2.5, minWidth: 0,
      bgcolor: tint ? alpha(color, 0.06) : "#fff",
      border: `1px solid ${tint ? alpha(color, 0.3) : BORDER_MAIN}`,
      "&::before": on ? { content: '""', position: "absolute", top: 0, left: 0, right: 0, height: 3, bgcolor: color } : {},
    }}>
      <Stack direction="row" alignItems="center" spacing={0.6} sx={{ minWidth: 0 }}>
        <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: on ? color : "#cbd5e1", flexShrink: 0 }} />
        <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 700, lineHeight: 1.3 }} noWrap>{label}</Typography>
      </Stack>
      <Typography sx={{
        fontWeight: 800, fontSize: { xs: "1.08rem", sm: "1.3rem" }, lineHeight: 1.25, mt: 0.4,
        color: on ? color : "#94a3b8", fontVariantNumeric: "tabular-nums",
      }} noWrap>
        {value}
      </Typography>
      {sub && <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 0.15 }} noWrap>{sub}</Typography>}
    </Box>
  );
};

/**
 * แผงหนึ่งหัวข้อของรายงาน — ✅ ผู้ใช้: "หัวข้อการสรุปทำให้ชัดเจน เด่น สวยงาม แต่ไม่รกตา"
 * หัวแผง = ไอคอนในกรอบสีอ่อนตามความหมายของหัวข้อ · ชื่อหัวข้อตัวใหญ่ขึ้น · คำอธิบายจาง · เส้นคั่นบางใต้หัวแผง
 */
/**
 * 🔁 (26 ต.ค. 2569 ผู้ใช้: "หน้ารายงานเบิกให้กดพับปิดได้ทุกหัวข้อด้วย ให้สวยงาม ดูง่าย")
 *    กดหัวแผง (หรือลูกศรขวา) = พับ/กาง · จำสถานะไว้ในเครื่อง (เปิดหน้าใหม่ยังพับเหมือนเดิม) · ปุ่มด้านขวาของหัวแผงกดได้ตามปกติ ไม่พับ
 */
const PANEL_KEY = (title) => `expReport.fold.${String(title || "").replace(/\s*\(.*\)\s*$/, "").trim()}`;
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
        sx={{ columnGap: 1.25, rowGap: 1, px: { xs: 1.5, sm: 2 }, py: { xs: 1.25, sm: 1.4 }, borderBottom: folded ? "none" : `1px solid #f1f5f9`,
          cursor: "pointer", userSelect: "none", transition: "background-color .15s", "&:hover": { bgcolor: "#f8fafc" } }}>
        {icon && (
          <Box sx={{
            width: 34, height: 34, borderRadius: 2, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            bgcolor: alpha(color, 0.1), color, "& svg": { fontSize: 19 },
          }}>
            {icon}
          </Box>
        )}
        <Box sx={{ flex: "1 1 200px", minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: "0.98rem", sm: "1.05rem" }, color: TEXT_MAIN, lineHeight: 1.35 }}>{title}</Typography>
          {hint && <Typography sx={{ fontSize: "0.76rem", color: TEXT_SUB, lineHeight: 1.45 }}>{hint}</Typography>}
        </Box>
        {/* ⚠️ มือถือ: ปุ่มด้านขวาลงบรรทัดใหม่เต็มความกว้าง — ไม่งั้นชื่อหัวข้อถูกบีบจนตัดทีละคำ · ซ่อนตอนพับ */}
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

const ADV = KIND_META.advance.color;
/** 🎨 (11 พ.ย. 2569 ผู้ใช้: "สีสัน ธีมให้สอดคล้องกับแอพ") — สีชนิดเงินใช้สีชนิดใบของระบบเบิก (ตรงกับป้าย/PDF)
 *    ยอดหลัก (ค่าใช้จ่ายจริงรวม) = น้ำเงินหลักของแอป · ทุกยอด "ต้องติดตาม" = เหลืองอำพันสีเดียว · เลยกำหนด = แดง */
const PRIMARY = "#2563eb";
/** กล่องตัวเลขแยกชนิดเงิน — พื้นอ่อน + ตัวเลขสีเข้มของชนิดนั้น (สีเดียวกับระบบเบิก) · ยอด 0 = กล่องเทาจาง */
const TONE = {
  advance: { fg: KIND_META.advance.dark, bg: KIND_META.advance.soft, bd: alpha(KIND_META.advance.color, 0.28) },
  actual: { fg: KIND_META.claim.dark, bg: KIND_META.claim.soft, bd: alpha(KIND_META.claim.color, 0.28) },
  reimburse: { fg: KIND_META.reimburse.dark, bg: KIND_META.reimburse.soft, bd: alpha(KIND_META.reimburse.color, 0.28) },
  total: { fg: "#1d4ed8", bg: "#eff6ff", bd: "#bfdbfe" },
};
/** 🔁 (11 พ.ย. 2569 ผู้ใช้: "กรอบใหญ่ไป ไม่ทันสมัย") — ตัวเลขเรียบไม่มีกรอบ: จุดสี + ป้าย · ตัวเลขสีชนิดเงิน · ยอดรวม = เม็ดฟ้าอ่อน */
/**
 * ✅ (11 พ.ย. 2569 ผู้ใช้: "ใช้คำให้ดูง่าย สอดคล้องกับตารางอื่น หัวข้อตารางที่เป็นประเภทเดียวกันให้เหมือนกัน")
 *    หัวตารางทุกตารางในหน้านี้ใช้รูปแบบเดียวกับ "สรุปตามงาน" · คอลัมน์เงินมีจุดสีชนิดเงินหน้าชื่อ
 */
const TH_SX = { fontWeight: 700, color: "#475569", fontSize: "0.82rem", whiteSpace: "nowrap", bgcolor: "#f8fafc", py: 1.25, verticalAlign: "middle", borderBottom: `1px solid ${BORDER_MAIN}` };
const TD_SX = { fontSize: "0.88rem", color: TEXT_MAIN, borderColor: "#f1f5f9", py: 1.1, verticalAlign: "top", fontVariantNumeric: "tabular-nums" };
const HeadDot = ({ color, children }) => (
  <>
    <Box component="span" sx={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", bgcolor: color, mr: 0.6, verticalAlign: "1px" }} />
    {children}
  </>
);
/** ส่วนต่างของใบเคลม — คำเดียวกันทุกตาราง: คืน ฿ (พนักงานคืนบริษัท) · จ่ายเพิ่ม ฿ (บริษัทจ่ายเพิ่ม) · พอดี */
const diffText = (diff) => {
  const d = Number(diff) || 0;
  if (Math.abs(d) < 0.005) return { text: "พอดี", color: "#16a34a" };
  return d < 0
    ? { text: `คืน ${baht(-d)}`, color: FOLLOW, hint: "ใช้น้อยกว่าที่เบิก — พนักงานคืนเงินบริษัท" }
    : { text: `จ่ายเพิ่ม ${baht(d)}`, color: "#1d4ed8", hint: "ใช้เกินที่เบิก — บริษัทจ่ายเพิ่มให้พนักงาน" };
};

const MoneyTile = ({ label, full, value, tone, strong = false }) => {
  const t = TONE[tone];
  const on = Number(value) > 0;
  return (
    <Box title={full} sx={{ minWidth: 0, textAlign: "right" }}>
      <Typography noWrap sx={{ fontSize: "0.7rem", fontWeight: 600, color: TEXT_SUB, lineHeight: 1.4 }}>
        <Box component="span" sx={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", bgcolor: on || strong ? t.fg : "#cbd5e1", mr: 0.5, verticalAlign: "1px" }} />
        {label}
      </Typography>
      {strong ? (
        <Box component="span" sx={{ display: "inline-block", mt: 0.25, px: 1, py: 0.15, borderRadius: 999, bgcolor: t.bg, color: t.fg, fontSize: "1rem", fontWeight: 800, lineHeight: 1.4, ...NUM }}>{baht(value)}</Box>
      ) : (
        <Typography sx={{ fontSize: "0.98rem", fontWeight: 800, color: on ? t.fg : "#cbd5e1", lineHeight: 1.4, mt: 0.25, ...NUM }}>{baht(value)}</Typography>
      )}
    </Box>
  );
};
const FOLLOW = "#d97706";
const LATE = "#dc2626";
const ACT = KIND_META.claim.color;
/** ใบสำรองจ่าย — เงินที่พนักงานออกไปก่อน ยังไม่ผ่านระบบเบิกล่วงหน้าเลย */
const RMB = KIND_META.reimburse.color;

/**
 * ✅ (11 พ.ย. 2569) แถบ "วิธีอ่านตัวเลข" — เงินมี 2 ทาง อธิบายด้วยคำชุดเดียวกับทุกตัวเลขในหน้า (MONEY_TERMS)
 */
const FlowDot = ({ color, label }) => (
  <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, whiteSpace: "nowrap", fontWeight: 700, color: TEXT_MAIN }}>
    <Box component="span" sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color }} />{label}
  </Box>
);
const HowToRead = () => (
  <Box sx={{ mb: 1.25, px: 1.5, py: 1, borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, fontSize: "0.78rem", color: TEXT_SUB }}>
    <Stack direction={{ xs: "column", md: "row" }} useFlexGap sx={{ columnGap: 3, rowGap: 0.6 }} alignItems={{ md: "center" }} flexWrap="wrap">
      <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
        <b style={{ color: TEXT_SUB }}>บริษัทจ่ายก่อน:</b>
        <FlowDot color={ADV} label={MT.advanced} /><span>→</span><FlowDot color={ACT} label={MT.actual} /><span>→ คืน / จ่ายเพิ่มส่วนต่าง</span>
      </Stack>
      <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
        <b style={{ color: TEXT_SUB }}>พนักงานจ่ายก่อน:</b>
        <FlowDot color={RMB} label={MT.reimburse} /><span>→ บริษัทจ่ายคืน</span>
      </Stack>
      <span><b style={{ color: TEXT_MAIN }}>{MT.totalCost}</b> = ใช้จริง + สำรองจ่าย</span>
    </Stack>
  </Box>
);

/** กราฟแท่งรายเดือน: จ่ายล่วงหน้า vs ใช้จริง (CSS ล้วน ไม่ต้องพึ่งไลบรารีกราฟ) */
const MonthBars = ({ rows }) => {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.advanced, r.actual, r.requested, r.reimburse)));
  if (!rows.length) return <Typography variant="body2" sx={{ color: TEXT_SUB }}>ไม่มีข้อมูล</Typography>;
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Stack direction="row" spacing={1.25} alignItems="flex-end" sx={{ height: 190, minWidth: rows.length * 52, pt: 1 }}>
        {rows.map((r) => (
          <Tooltip key={r.key} arrow title={`${monthLabel(r.key)} · ${MT.advanced} ${baht(r.advanced)} · ${MT.actual} ${baht(r.actual)} · ${MT.outstanding} ${baht(r.outstanding)}${r.reimburse ? ` · ${MT.reimburse} ${baht(r.reimburse)}` : ""}`}>
            <Stack alignItems="center" sx={{ flex: 1, minWidth: 40, height: "100%" }} justifyContent="flex-end">
              <Stack direction="row" spacing={0.4} alignItems="flex-end" sx={{ height: "calc(100% - 22px)", width: "100%", justifyContent: "center" }}>
                <Box sx={{ width: "38%", maxWidth: 18, height: `${(r.advanced / max) * 100}%`, minHeight: r.advanced ? 3 : 0, bgcolor: ADV, borderRadius: "4px 4px 0 0" }} />
                <Box sx={{ width: "38%", maxWidth: 18, height: `${(r.actual / max) * 100}%`, minHeight: r.actual ? 3 : 0, bgcolor: ACT, borderRadius: "4px 4px 0 0" }} />
                {/* แท่งที่สามโผล่เฉพาะเดือนที่มีใบสำรองจ่ายจริง — ไม่งั้นกราฟจะมีช่องว่างเปล่าทุกเดือน */}
                {r.reimburse > 0 && (
                  <Box sx={{ width: "38%", maxWidth: 18, height: `${(r.reimburse / max) * 100}%`, minHeight: 3, bgcolor: RMB, borderRadius: "4px 4px 0 0" }} />
                )}
              </Stack>
              <Typography sx={{ fontSize: "0.68rem", color: TEXT_SUB, mt: 0.5, whiteSpace: "nowrap" }}>{monthLabel(r.key)}</Typography>
            </Stack>
          </Tooltip>
        ))}
      </Stack>
      <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
        {[[MT.advanced, ADV], [MT.actual, ACT], [MT.reimburse, RMB]].map(([l, c]) => (
          <Stack key={l} direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: c }} />
            <Typography variant="caption" sx={{ color: TEXT_SUB }}>{l}</Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
};

const CategoryBars = ({ rows }) => {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.planned, r.actual, r.reimburse || 0)));
  if (!rows.length) return <Typography variant="body2" sx={{ color: TEXT_SUB }}>ไม่มีข้อมูล</Typography>;
  return (
    <Stack spacing={1.25}>
      {rows.map((r) => {
        const cat = categoryMeta(r.key);
        return (
          <Box key={r.key}>
            {/* มือถือ: ชื่อหมวดบรรทัดบน ตัวเลขบรรทัดล่าง — ไม่ให้ชื่อหมวดถูกบีบจนตัดกลางคำ ("ค่าน้ำ / มัน") */}
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={{ xs: 0.15, sm: 1 }} sx={{ mb: 0.4 }}>
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                <Box component="span" sx={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", bgcolor: cat.color, mr: 0.75 }} />
                {cat.label}
              </Typography>
              <Typography sx={{ fontSize: "0.78rem", color: TEXT_SUB }}>
                {MT.advanced} {baht(r.planned)} · <b style={{ color: TEXT_MAIN }}>ใช้จริง {baht(r.actual)}</b>
                {r.reimburse ? <> · <b style={{ color: RMB }}>{MT.reimburse} {baht(r.reimburse)}</b></> : null}
              </Typography>
            </Stack>
            <Box sx={{ position: "relative", height: 10, borderRadius: 5, bgcolor: "#f1f5f9", overflow: "hidden" }}>
              <Box sx={{ position: "absolute", inset: 0, width: `${(r.planned / max) * 100}%`, bgcolor: alpha(cat.color, 0.25) }} />
              <Box sx={{ position: "absolute", top: 2, bottom: 2, left: 0, width: `${(r.actual / max) * 100}%`, bgcolor: cat.color, borderRadius: 5 }} />
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
};

/** หมวด · รายละเอียด — ไม่ต่อรายละเอียดซ้ำถ้าเป็นคำเดียวกับชื่อหมวด ("เบี้ยเลี้ยง · เบี้ยเลี้ยง") */
const lineText = (l) => {
  const cat = categoryMeta(l.category).label;
  const desc = String(l.description || "").trim();
  return desc && desc !== cat ? `${cat} · ${desc}` : cat;
};


/**
 * รายบุคคล "ตามชื่อในแต่ละรายการ" — ✅ ผู้ใช้ขอ: นาย A เบิกเบี้ยเลี้ยงใส่ชื่อนาย B ต้องรู้ว่านาย B ถูกเบิกให้เท่าไร
 * แถวสรุปต่อคน (กดเพื่อกางดูรายการทีละบรรทัด: ใบไหน · ใครเบิกให้ · หมวด · ยอด)
 */
/**
 * จัดบรรทัดของคนหนึ่งเป็น "ต่อใบ" — ใบ Advance กับใบเคลมของมันอยู่การ์ดเดียวกัน · ใบสำรองจ่ายเป็นการ์ดของตัวเอง
 * ในแต่ละใบรวมบรรทัดหมวดเดียวกันเป็นแถวเดียว: requested (ขอเบิก) เทียบ actual (ใช้จริง)
 */
const slipGroups = (lines) => {
  const map = new Map();
  lines.forEach((l) => {
    const gid = String(l.parentId || l.docId);
    if (!map.has(gid)) {
      map.set(gid, {
        id: gid, kind: l.source === "reimburse" ? "reimburse" : "advance",
        docId: l.source === "claim" ? l.parentId : l.docId, docNo: l.parentNo || l.docNo, date: l.parentDate || l.date,
        requester: l.requester, byOther: l.byOther, status: "", claimNo: "", claimId: "", claimStatus: "", rows: new Map(), shared: new Set(),
      });
    }
    const g = map.get(gid);
    if (l.source === "claim") { g.claimNo = l.docNo; g.claimId = l.docId; g.claimStatus = l.status; } else g.status = l.status;
    (l.sharedWith || []).forEach((n) => g.shared.add(n));
    const rk = l.category || "other";
    if (!g.rows.has(rk)) g.rows.set(rk, { key: rk, label: lineText(l), requested: 0, actual: 0 });
    const r = g.rows.get(rk);
    if (l.source === "claim") r.actual += Number(l.amount) || 0; else r.requested += Number(l.amount) || 0;
  });
  return [...map.values()]
    .map((g) => {
      const rows = [...g.rows.values()];
      return { ...g, rows, shared: [...g.shared], requested: rows.reduce((t, r) => t + r.requested, 0), actual: rows.reduce((t, r) => t + r.actual, 0) };
    })
    .sort((x, y) => String(y.date || "").localeCompare(String(x.date || "")) || String(y.docNo).localeCompare(String(x.docNo)));
};


/** ส่วนต่างของแถว — สีเฉพาะที่มีความหมาย (เกิน = แดง · เหลือ = ฟ้า · พอดี = เขียว) */
const diffOf = (r, hasClaim) => {
  if (!hasClaim) return { text: "—", color: "#cbd5e1" };
  if (!r.requested && r.actual) return { text: "เคลมเพิ่ม", hint: "ไม่มีในใบเบิก — บรรทัดนี้มีแค่ในใบเคลม", color: "#0284c7" };
  if (r.requested && !r.actual) return { text: "ไม่มีในใบเคลม", color: "#94a3b8" };
  const d = r.actual - r.requested;
  return diffText(d);
};

const NUM = { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };

/** ป้ายสถานะเล็ก สีอ่อน (ใช้ซ้ำทุกแถว) */
const MiniStatus = ({ g }) => {
  const hasClaim = Boolean(g.claimNo);
  const st = hasClaim ? statusMeta(g.claimStatus, "claim") : statusMeta(g.status, g.kind === "reimburse" ? "reimburse" : "advance");
  return (
    <Box component="span" sx={{ fontSize: "0.7rem", fontWeight: 700, px: 0.75, py: 0.15, borderRadius: 1, bgcolor: st.bg, color: st.color, whiteSpace: "nowrap" }}>
      {st.label}
    </Box>
  );
};

/** เลขที่ใบ (Advance → ใบเคลม) กดเปิดได้ · ตัวเข้มเดียวกันทั้งคู่ ไม่ใช้สีแข่งกัน */
const DocLink = ({ id, no, onOpen }) => {
  const color = /^CLM/.test(no) ? ACT : /^RMB/.test(no) ? RMB : ADV;
  return (
    <ButtonBase onClick={(e) => { e.stopPropagation(); onOpen?.(id); }}
      sx={{ fontFamily: "inherit", fontSize: "0.8rem", fontWeight: 700, color, borderRadius: 0.5, "&:hover": { textDecoration: "underline" } }}>
      {no}
    </ButtonBase>
  );
};

/**
 * รายการของคนหนึ่ง — ✅ ผู้ใช้: "ยังดูยาก ตาลาย ตัวอักษรไม่มืออาชีพ"
 *   เดิม: การ์ดกล่องละใบ + หัวคอลัมน์ซ้ำทุกใบ + สีหลายสีในบรรทัดเดียว
 *   ตอนนี้: ตารางเดียว หัวคอลัมน์ครั้งเดียว · ใบเดียวกันจัดเป็นกลุ่ม (เลขที่/วันที่/สถานะโชว์บรรทัดแรกของกลุ่ม)
 *   สลับพื้นทีละใบ · ตัวเลขชิดขวาแบบตัวเลขเท่ากัน · สีเฉพาะช่องส่วนต่างและป้ายสถานะ
 */
const SlipTable = ({ groups, onOpen, isDesktop }) => {
  if (!isDesktop) {
    return (
      <Stack divider={<Box sx={{ borderTop: `1px solid ${BORDER_MAIN}` }} />} sx={{ border: `1px solid ${BORDER_MAIN}`, borderRadius: 2, bgcolor: "#fff" }}>
        {groups.map((g) => {
          const hasClaim = Boolean(g.claimNo);
          return (
            <Box key={g.id} sx={{ px: 1.25, py: 1 }}>
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <Box sx={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                  <DocLink id={g.docId} no={g.docNo} onOpen={onOpen} />
                  {hasClaim && <><Typography component="span" sx={{ color: "#cbd5e1", fontSize: "0.8rem" }}>→</Typography><DocLink id={g.claimId} no={g.claimNo} onOpen={onOpen} /></>}
                </Box>
                <MiniStatus g={g} />
              </Stack>
              <Typography sx={{ fontSize: "0.72rem", color: TEXT_SUB, mt: 0.15 }}>
                {thaiDate(g.date)} · {g.byOther ? `เบิกโดย ${g.requester}` : "เบิกเอง"}{g.shared.length ? ` · ใบนี้มีของ ${g.shared.join(", ")}` : ""}
              </Typography>
              {g.rows.map((r) => {
                const df = diffOf(r, hasClaim);
                return (
                  <Stack key={r.key} direction="row" alignItems="baseline" spacing={1} sx={{ mt: 0.5 }}>
                    <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.82rem", color: TEXT_MAIN }}>{r.label}</Typography>
                    <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: g.kind === "reimburse" ? RMB : TEXT_MAIN, ...NUM }}>{baht(r.requested)}</Typography>
                    <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: hasClaim ? ACT : "#cbd5e1", ...NUM }}>→ {hasClaim ? baht(r.actual) : "—"}</Typography>
                    <Typography sx={{ fontSize: "0.76rem", fontWeight: 600, color: df.color, minWidth: 56, textAlign: "right", ...NUM }}>{df.text}</Typography>
                  </Stack>
                );
              })}
            </Box>
          );
        })}
      </Stack>
    );
  }
  const hasRmb = groups.some((g) => g.kind === "reimburse");
  return (
    <Box sx={{ border: `1px solid ${BORDER_MAIN}`, borderRadius: 2, overflow: "hidden", bgcolor: "#fff" }}>
      <Table size="small" sx={{ "& th": TH_SX, "& td": TD_SX }}>
        <TableHead>
          <TableRow>
            <TableCell>เลขที่ / วันที่</TableCell>
            <TableCell>หมวด</TableCell>
            <TableCell align="right" title={MT.advancedHint}><HeadDot color={ADV}>{MT.advanced}</HeadDot></TableCell>
            <TableCell align="right" title={MT.actualHint}><HeadDot color={ACT}>{MT.actual}</HeadDot></TableCell>
            {hasRmb && <TableCell align="right" title={MT.reimburseHint}><HeadDot color={RMB}>{MT.reimburse}</HeadDot></TableCell>}
            <TableCell align="right">ส่วนต่าง (คืน / จ่ายเพิ่ม)</TableCell>
            <TableCell>สถานะ</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {groups.map((g, gi) => {
            const hasClaim = Boolean(g.claimNo);
            const shade = gi % 2 === 1 ? "#fbfcfe" : "#fff";
            return g.rows.map((r, ri) => {
              const df = diffOf(r, hasClaim);
              const first = ri === 0;
              const last = ri === g.rows.length - 1;
              return (
                <TableRow key={`${g.id}-${r.key}`} sx={{ bgcolor: shade, "& td": last ? { borderBottom: `1px solid ${BORDER_MAIN}` } : { borderBottom: 0 } }}>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {first && (
                      <>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          {g.kind === "reimburse" && <Typography component="span" sx={{ fontSize: "0.7rem", color: TEXT_SUB }}>สำรองจ่าย</Typography>}
                          <DocLink id={g.docId} no={g.docNo} onOpen={onOpen} />
                          {hasClaim && <><Typography component="span" sx={{ color: "#cbd5e1" }}>→</Typography><DocLink id={g.claimId} no={g.claimNo} onOpen={onOpen} /></>}
                        </Box>
                        <Typography sx={{ fontSize: "0.76rem", color: TEXT_SUB, mt: 0.15 }}>
                          {thaiDate(g.date)}{g.byOther ? ` · เบิกโดย ${g.requester}` : ""}{g.shared.length ? ` · ใบนี้มีของ ${g.shared.join(", ")}` : ""}
                        </Typography>
                      </>
                    )}
                  </TableCell>
                  <TableCell>{r.label}</TableCell>
                  {/* ใบสำรองจ่าย: ยอดอยู่คอลัมน์สำรองจ่าย · เบิกล่วงหน้า/ใช้จริงเป็น "—" (ไม่มีใบ Advance) */}
                  <TableCell align="right" sx={{ ...NUM, fontWeight: 600, color: g.kind === "reimburse" ? "#cbd5e1 !important" : undefined }}>{g.kind === "reimburse" ? "—" : baht(r.requested)}</TableCell>
                  <TableCell align="right" sx={{ ...NUM, fontWeight: 600, color: hasClaim ? `${ACT} !important` : "#cbd5e1 !important" }}>{hasClaim ? baht(r.actual) : g.kind === "reimburse" ? "—" : "ยังไม่ส่งเคลม"}</TableCell>
                  {hasRmb && <TableCell align="right" sx={{ ...NUM, fontWeight: 600, color: g.kind === "reimburse" ? `${RMB} !important` : "#cbd5e1 !important" }}>{g.kind === "reimburse" ? baht(r.requested) : "—"}</TableCell>}
                  <TableCell align="right" sx={{ ...NUM, fontWeight: 600, color: `${df.color} !important` }} title={df.hint || ""}>{df.text}</TableCell>
                  <TableCell>{first ? <MiniStatus g={g} /> : null}</TableCell>
                </TableRow>
              );
            });
          })}
        </TableBody>
      </Table>
    </Box>
  );
};

/** ป้ายเงินค้าง (แถวรายบุคคล) — จุดสี + ข้อความ บนพื้นอ่อน ขอบบาง */
const AlertTag = ({ text, color }) => (
  <Box component="span" sx={{
    display: "inline-flex", alignItems: "center", gap: 0.6, fontSize: "0.74rem", fontWeight: 700, whiteSpace: "nowrap",
    px: 1, py: 0.35, borderRadius: 99, color, bgcolor: `${color}0f`, border: `1px solid ${color}33`,
  }}>
    <Box component="span" sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: color }} />
    {text}
  </Box>
);

const LedgerRow = memo(({ p, holder, onOpen, isDesktop, avatar }) => {
  const [open, setOpen] = useState(false);
  const slips = useMemo(() => slipGroups(p.lines), [p.lines]);
  const slipPg = usePaged(slips, 8);
  // ป้ายแจ้งเตือนจากมุม "ผู้เบิก" (เงินอยู่กับใคร) — โชว์เฉพาะที่มียอด จะได้ไม่รก
  const alerts = holder ? [
    holder.outstanding > 0 && { text: `${MT.outstanding} ${baht(holder.outstanding)}${holder.overdue ? " · เลยกำหนด" : ""}`, color: holder.overdue ? LATE : FOLLOW },
    holder.refundDue > 0 && { text: `${MT.refundDue} ${baht(holder.refundDue)}`, color: FOLLOW },
    holder.extraDue > 0 && { text: `${MT.extraDue} ${baht(holder.extraDue)}`, color: FOLLOW },
    holder.reimburseDue > 0 && { text: `${MT.reimburseDue} ${baht(holder.reimburseDue)}`, color: FOLLOW },
  ].filter(Boolean) : [];
  const cells = [
    // ✅ สีชุดเดียวกับกล่องสรุปด้านบนของหน้า (ขอเบิก = เข้ม · จ่ายล่วงหน้า = เขียว · ใช้จริง = ม่วง · สำรองจ่าย = ส้ม)
    // ป้ายสั้น — อยู่เป็นคอลัมน์แคบในแถวเดียวกับชื่อ (ความหมายเต็มอยู่ใน title ตอนชี้)
    // 🔁 (11 พ.ย. 2569) 4 ช่อง คำเดียวกับกล่องสรุปบนสุด · ช่องสุดท้าย = ค่าใช้จ่ายจริงรวม (ใช้จริง + สำรองจ่าย) ตัวหนา
    { label: MT.advanced, full: MT.advancedHint, value: p.advanced, color: TONE.advance.fg, tone: "advance" },
    { label: MT.actual, full: MT.actualHint, value: p.actual, color: TONE.actual.fg, tone: "actual" },
    { label: MT.reimburse, full: MT.reimburseHint, value: p.reimburse, color: TONE.reimburse.fg, tone: "reimburse" },
    { label: MT.totalCost, full: MT.totalCostHint, value: p.approvedCost, color: TONE.total.fg, tone: "total", total: true },
  ];
  return (
    <Box sx={{ border: `1px solid ${BORDER_MAIN}`, borderRadius: 2.5, overflow: "hidden", bgcolor: "#fff" }}>
      <Box
        role="button" tabIndex={0} onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v) => !v); } }}
        sx={{ px: 1.5, py: { xs: 1.25, md: 1 }, cursor: "pointer", "&:hover": { bgcolor: "#f8fafc" } }}
      >
        <Stack direction="row" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1.25}>
          {/* ✅ (11 พ.ย. 2569 ผู้ใช้: "รูปให้แสดงตามรูป user จริง") — รูปโปรไฟล์จริง · ไม่มีรูป/โหลดไม่ได้ = ตัวอักษรย่อสีประจำคน (ขนาดคงที่ ไม่ดันแถว) */}
          <Avatar src={avatar || undefined} alt={p.label} imgProps={{ loading: "lazy", decoding: "async", referrerPolicy: "no-referrer" }}
            sx={{ width: 34, height: 34, flexShrink: 0, bgcolor: personColor(p.label), fontWeight: 800, fontSize: "0.9rem" }}>{personInitial(p.label)}</Avatar>
          <Box sx={{ minWidth: 0, flex: isDesktop ? "1.6 1 0" : 1 }}>
            {/* ✅ ผู้ใช้: "ตรงนี้ให้มีแค่ชื่อกับสถานะที่ยังค้างก็พอ ข้อมูลอื่นๆ เอาไปไว้ข้างใน"
                → แถวที่ปิดอยู่ = ชื่อ · จำนวนรายการ · ป้ายเงินค้าง · สรุปเบิก/เคลมข้ามคนย้ายไปอยู่ในส่วนที่กางออก */}
            <Stack direction="row" alignItems="center" useFlexGap flexWrap="wrap" sx={{ minWidth: 0, columnGap: 0.75, rowGap: 0.4 }}>
              <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", color: TEXT_MAIN, lineHeight: 1.3 }} noWrap>{p.label}</Typography>
              <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB, whiteSpace: "nowrap" }}>{p.lines.length} รายการ</Typography>
              {alerts.map((al) => <AlertTag key={al.text} {...al} />)}
            </Stack>
          </Box>
          {isDesktop && (
            // ✅ ผู้ใช้: "ย่อให้กระชับลงอีกหน่อย" — 5 ตัวเลขเป็นคอลัมน์ในแถวเดียวกับชื่อ (เดิมกล่อง 5 ใบอีกแถว)
            // 🔁 (11 พ.ย. 2569 ผู้ใช้: "การแบ่งตีจัดวางยังดูสับสน สีมันกลมกลืนไป แบ่งสี") — กล่องละชนิดเงิน พื้นอ่อนคนละสี
            //    เบิกล่วงหน้า → ใช้จริง (ลูกศรบอกว่าเป็นคู่กัน) · สำรองจ่าย แยกกลุ่ม · ค่าใช้จ่ายจริงรวม กล่องน้ำเงินท้ายแถว
            <Box sx={{ flex: "0 1 640px", minWidth: 0, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr)) minmax(0, 1.15fr)", columnGap: 2.5, alignItems: "end" }}>
              <MoneyTile {...cells[0]} />
              <MoneyTile {...cells[1]} />
              <MoneyTile {...cells[2]} />
              <MoneyTile {...cells[3]} strong />
            </Box>
          )}
          <ExpandMore sx={{ color: TEXT_SUB, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none" }} />
        </Stack>
      </Box>

      <Collapse in={open} unmountOnExit>
        <Box sx={{ px: 1.5, pb: 1.5, pt: 0.5, borderTop: `1px solid ${BORDER_MAIN}`, bgcolor: "#fcfdfe" }}>
          {/* ✅ ผู้ใช้: "ข้อมูลยังดูยาก รก สับสน" — เดิมเป็นตารางเบิก + ตารางเคลมแยกกัน ซ้ำวันที่/เลขที่/สถานะทุกบรรทัด
              และต้องจับคู่เองว่าบรรทัดเบิกไหนเคลียร์ด้วยบรรทัดเคลมไหน
              → การ์ดละ 1 ใบ: หัวการ์ด = เลขที่ใบ (Advance → ใบเคลม) · วันที่ · ใครเบิก · สถานะ
                 เนื้อการ์ด = ทีละหมวด  ขอเบิก | ใช้จริง | ส่วนต่าง  วางคู่กันในแถวเดียว */}
            <Stack
              direction="row" useFlexGap flexWrap="wrap" alignItems="center" sx={{ mt: 1, columnGap: 1.25, rowGap: 0.25 }}
              divider={<Box sx={{ width: "1px", height: 12, bgcolor: BORDER_MAIN }} />}
            >
              {[
                ["ขอเบิกทั้งหมด", p.requested],
                ["เบิกเอง", p.self],
                ["คนอื่นเบิกให้", p.byOthers],
                ["เบิกให้คนอื่น", p.forOthers],
                ["คนอื่นเคลมให้", p.claimedByOthers],
                ["เคลมให้คนอื่น", p.claimedForOthers],
              ].filter(([, v]) => v > 0).map(([label, v]) => (
                <Typography key={label} component="span" sx={{ fontSize: "0.78rem", color: TEXT_SUB, whiteSpace: "nowrap" }}>
                  {label} <Box component="span" sx={{ color: TEXT_MAIN, fontWeight: 700, ...NUM }}>{baht(v)}</Box>
                </Typography>
              ))}
            </Stack>
        {!isDesktop && (
            // ✅ มือถือ: กล่องเดียว ป้ายซ้าย-ตัวเลขขวา (เดิม 5 กล่องซ้อนกัน 3 แถว กินจอ ผู้ใช้แจ้งว่ารก)
            <Box sx={{ mt: 1, px: 1.25, py: 0.5, borderRadius: 2, bgcolor: "#f8fafc", border: `1px solid ${BORDER_MAIN}` }}>
              {cells.map((c, ci) => (
                <Stack key={c.label} direction="row" alignItems="baseline" justifyContent="space-between" spacing={1}
                  sx={{ py: 0.6, borderTop: ci ? `1px ${c.total ? "solid" : "dashed"} ${BORDER_MAIN}` : 0 }}>
                  <Typography sx={{ fontSize: "0.8rem", color: c.total ? TEXT_MAIN : TEXT_SUB, fontWeight: c.total ? 800 : 400 }}>
                    <Box component="span" sx={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", bgcolor: c.color, mr: 0.75, verticalAlign: "1px" }} />{c.label}
                  </Typography>
                  <Typography sx={{ fontSize: c.total ? "1rem" : "0.9rem", fontWeight: 800, color: c.value ? c.color : "#cbd5e1", ...NUM }}>{baht(c.value)}</Typography>
                </Stack>
              ))}
            </Box>
          )}
          {(p.requesters.length > 0 || p.beneficiaries.length > 0) && (
            <Typography sx={{ mt: 1, fontSize: "0.78rem", color: TEXT_SUB, lineHeight: 1.6 }}>
              {p.requesters.length > 0 && <>คนอื่นเบิกให้ — {p.requesters.map((r) => `${r.name} ${baht(r.amount)}`).join(", ")}</>}
              {p.requesters.length > 0 && p.beneficiaries.length > 0 && "   ·   "}
              {p.beneficiaries.length > 0 && <>เบิกให้คนอื่น — {p.beneficiaries.map((r) => `${r.name} ${baht(r.amount)}`).join(", ")}</>}
            </Typography>
          )}
          <Box sx={{ mt: 1 }}>
            <SlipTable groups={slipPg.rows} onOpen={onOpen} isDesktop={isDesktop} />
          </Box>
          <PageBar {...slipPg} unit="ใบ" />
        </Box>
      </Collapse>
    </Box>
  );
});
LedgerRow.displayName = "LedgerRow";

/** ลิงก์ไปงานบนปฏิทิน — รูปแบบเดียวกับปุ่ม "ดูในปฏิทิน" หน้าการดำเนินงาน (ไม่ผูกงาน = ไม่มีลิงก์) */
const eventLinkOf = (r) => (r.key && r.key !== "__none__" && r.key !== "-"
  ? `/event?event=${r.key}${r.jobStart ? `&date=${moment(r.jobStart).format("YYYY-MM-DD")}` : ""}&t=${Date.now()}`
  : null);

const GroupTable = ({ rows, firstHeader, onPick }) => {
  const pg = usePaged(rows, 10);
  const wide = useMediaQuery("(min-width:900px)");
  if (!wide) {
    return (
      <>
        <Stack divider={<Box sx={{ borderTop: `1px solid ${BORDER_MAIN}` }} />}>
          {pg.rows.map((r) => (
            <Box key={r.key} onClick={onPick ? () => onPick(r) : undefined} sx={{ py: 1, cursor: onPick ? "pointer" : "default" }}>
              <Stack direction="row" alignItems="baseline" spacing={1}>
                {eventLinkOf(r) ? (
                  <Box component={RouterLink} to={eventLinkOf(r)} sx={{ flex: 1, minWidth: 0, textDecoration: "none", "&:active": { opacity: 0.7 } }}>
                    {(() => {
                      const m = String(r.label).match(/^(.*?)\s+(ครั้งที่\s.*)$/);
                      return (
                        <>
                          <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: TEXT_MAIN, lineHeight: 1.4 }}>
                            {m ? m[1] : r.label} <CalendarMonth sx={{ fontSize: 14, color: "#94a3b8", verticalAlign: "-2px" }} />
                          </Typography>
                          {m && <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB, lineHeight: 1.4 }}>{m[2]}</Typography>}
                        </>
                      );
                    })()}
                  </Box>
                ) : (
                  <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.86rem", fontWeight: 600, color: TEXT_MAIN, lineHeight: 1.4 }}>{r.label}</Typography>
                )}
                <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB, whiteSpace: "nowrap" }}>{r.count} ใบ</Typography>
              </Stack>
              <Stack direction="row" useFlexGap flexWrap="wrap" sx={{ mt: 0.35, columnGap: 1.5, rowGap: 0.25, fontSize: "0.76rem", color: TEXT_SUB }}>
                <span>{MT.advanced} <b style={{ color: ADV, ...NUM }}>{baht(r.advanced)}</b></span>
                <span>{MT.actual} <b style={{ color: ACT, ...NUM }}>{baht(r.actual)}</b></span>
                {r.reimburse > 0 && <span>{MT.reimburse} <b style={{ color: RMB, ...NUM }}>{baht(r.reimburse)}</b></span>}
                {r.outstanding > 0 && <span>{MT.outstanding} <b style={{ color: r.overdue ? LATE : FOLLOW, ...NUM }}>{baht(r.outstanding)}</b></span>}
              </Stack>
              <Typography sx={{ mt: 0.35, fontSize: "0.78rem", color: TEXT_MAIN }}>
                {MT.totalCost} <b style={NUM}>{baht(r.actual + r.reimburse)}</b>
              </Typography>
            </Box>
          ))}
        </Stack>
        <PageBar {...pg} unit="งาน" />
      </>
    );
  }
  return (
  <>

  <Box sx={{ overflowX: "auto" }}>
    {/* ✅ ผู้ใช้: "ตาลาย ดูยาก · ชื่องานตัวเข้มทั้งหมด ทำให้อ่านยาก" — ชื่องานตัวปกติ 2 บรรทัด (ครั้งที่/ช่วงวันที่เป็นบรรทัดรอง)
        ตัวเลขน้ำหนักเดียวกัน ชิดขวาแบบตัวเลขเท่ากัน · ยอด 0 เป็น "—" จาง · สีเฉพาะยอดที่ต้องติดตาม */}
    <Table size="small" sx={{
      minWidth: 640,
      "& th": { fontWeight: 700, color: "#475569", fontSize: "0.82rem", whiteSpace: "nowrap", bgcolor: "#f8fafc", py: 1.25, verticalAlign: "middle", borderBottom: `1px solid ${BORDER_MAIN}` },
      "& td": { fontSize: "0.9rem", color: TEXT_MAIN, borderColor: "#f1f5f9", py: 1.25, verticalAlign: "top", fontVariantNumeric: "tabular-nums" },
    }}>
      <TableHead>
        {/* 🔁 (11 พ.ย. 2569 ผู้ใช้: "หัวตารางไม่สวย ไม่ตรง text เล็กไป") — หัวแถวเดียว ป้ายอยู่ระดับเดียวกันทุกคอลัมน์
              จุดสีหน้าชื่อ = ชนิดเงิน (สีเดียวกับกล่องสรุป/แถบวิธีอ่าน) · คอลัมน์ยอดรวมคั่นด้วยเส้นซ้าย */}
        <TableRow>
          <TableCell>{firstHeader}</TableCell>
          <TableCell align="right">ใบ</TableCell>
          <TableCell align="right" title={MT.advancedHint}><Box component="span" sx={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", bgcolor: ADV, mr: 0.6, verticalAlign: "1px" }} />{MT.advanced}</TableCell>
          <TableCell align="right" title={MT.actualHint}><Box component="span" sx={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", bgcolor: ACT, mr: 0.6, verticalAlign: "1px" }} />{MT.actual}</TableCell>
          <TableCell align="right" title={MT.outstandingHint}>{MT.outstanding}</TableCell>
          <TableCell align="right" title={MT.reimburseHint}><Box component="span" sx={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", bgcolor: RMB, mr: 0.6, verticalAlign: "1px" }} />{MT.reimburse}</TableCell>
          <TableCell align="right" title={MT.totalCostHint} sx={{ color: `${TEXT_MAIN} !important`, fontWeight: "800 !important", borderLeft: `1px solid ${BORDER_MAIN}` }}>{MT.totalCost}</TableCell>
          <TableCell align="right">รอปิดยอด</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {pg.rows.map((r) => (
          <TableRow key={r.key} hover={Boolean(onPick)} onClick={onPick ? () => onPick(r) : undefined} sx={{ cursor: onPick ? "pointer" : "default" }}>
            <TableCell sx={{ minWidth: 220 }}>
              {(() => {
                // แยก "ครั้งที่ … · ช่วงวันที่ …" ไปเป็นบรรทัดรอง — ชื่องานหลักอ่านได้เต็ม ไม่ถูกตัด "…"
                const m = String(r.label).match(/^(.*?)\s+(ครั้งที่\s.*)$/);
                const to = eventLinkOf(r);
                return (
                  <>
                    {to ? (
                      // ✅ กดชื่องานเพื่อไปดูงานนั้นบนปฏิทิน (ผู้ใช้ขอ) — เปิดเดือน/วันของงานแล้วไฮไลต์การ์ดให้
                      <Typography component={RouterLink} to={to} title="ดูงานนี้ในปฏิทิน"
                        sx={{ fontSize: "0.9rem", fontWeight: 600, color: TEXT_MAIN, lineHeight: 1.4, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 0.5, "&:hover": { color: "#2563eb", textDecoration: "underline" } }}>
                        {m ? m[1] : r.label}
                        <CalendarMonth sx={{ fontSize: 15, color: "#94a3b8" }} />
                      </Typography>
                    ) : (
                      <Typography sx={{ fontSize: "0.9rem", fontWeight: 600, color: TEXT_MAIN, lineHeight: 1.4 }}>{m ? m[1] : r.label}</Typography>
                    )}
                    {m && <Typography sx={{ fontSize: "0.78rem", color: TEXT_SUB, lineHeight: 1.4 }}>{m[2]}</Typography>}
                  </>
                );
              })()}
            </TableCell>
            <TableCell align="right" sx={{ color: `${TEXT_SUB} !important` }}>{r.count}</TableCell>
            <TableCell align="right">{r.advanced ? baht(r.advanced) : <span style={{ color: "#cbd5e1" }}>—</span>}</TableCell>
            <TableCell align="right">{r.actual ? baht(r.actual) : <span style={{ color: "#cbd5e1" }}>—</span>}</TableCell>
            <TableCell align="right" sx={{ color: r.outstanding ? `${r.overdue ? LATE : FOLLOW} !important` : "#cbd5e1 !important", fontWeight: r.outstanding ? 700 : 400 }}>
              {r.outstanding ? baht(r.outstanding) : "—"}{r.overdue ? <WarningAmber sx={{ fontSize: 14, color: "#dc2626", ml: 0.5, verticalAlign: "-2px" }} /> : null}
            </TableCell>
            <TableCell align="right" sx={{ color: r.reimburse ? `${RMB} !important` : "#cbd5e1 !important", fontWeight: r.reimburse ? 700 : 400, whiteSpace: "nowrap" }}>
              {r.reimburse ? baht(r.reimburse) : "—"}
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: "800 !important", whiteSpace: "nowrap", borderLeft: `1px solid ${BORDER_MAIN}`, color: r.actual + r.reimburse ? undefined : "#cbd5e1 !important" }}>
              {r.actual + r.reimburse ? baht(r.actual + r.reimburse) : "—"}
            </TableCell>
            <TableCell align="right" sx={{ whiteSpace: "nowrap", fontSize: "0.84rem !important" }}>
              {/* ⚠️ ต้องบอกทิศทางเงินเสมอ — "คืน ฿3,000" ลอยๆ อ่านไม่ออกว่าใครคืนให้ใคร */}
              {[
                r.refundDue ? <span key="r" style={{ color: FOLLOW, fontWeight: 600 }}>{MT.refundDue} {baht(r.refundDue)}</span> : null,
                r.extraDue ? <span key="e" style={{ color: FOLLOW, fontWeight: 600 }}>{MT.extraDue} {baht(r.extraDue)}</span> : null,
                r.reimburseDue ? <span key="d" style={{ color: FOLLOW, fontWeight: 600 }}>{MT.reimburseDue} {baht(r.reimburseDue)}</span> : null,
              ].filter(Boolean).reduce((acc, el, i) => (i ? [...acc, <br key={`b${i}`} />, el] : [el]), [])}
              {!r.refundDue && !r.extraDue && !r.reimburseDue ? <span style={{ color: "#cbd5e1" }}>—</span> : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </Box>
  <PageBar {...pg} unit="งาน" />
  </>
  );
};

export default function ExpenseReport({ onOpen, reloadKey, mobileFiltersOpen = false, onMobileFiltersClose, onActiveFiltersChange }) {
  const isDesktop = useMediaQuery("(min-width:900px)");
  const { can } = usePermissions();
  const viewAll = can("viewAllExpenses");
  const [preset, setPreset] = useState("year");
  const [from, setFrom] = useState(moment().startOf("year").format("YYYY-MM-DD"));
  const [to, setTo] = useState(moment().format("YYYY-MM-DD"));
  const [person, setPerson] = useState("all");
  const [people, setPeople] = useState([]);
  const [rawRows, setRows] = useState([]);
  // ⚠️ ใบสำรองจ่ายมาคนละก้อนกับใบ Advance (ไม่มีใบไหนให้ผูก) — เก็บแยกแล้วส่งเข้าตัวสรุปพร้อมกัน
  const [rawReimburse, setReimburseRows] = useState([]);
  // ใบค่าจ้างผู้รับเหมา — แสดงเป็นก้อนของตัวเอง (ไม่เข้าสูตรเงินของพนักงาน: ผู้รับเงินเป็นคนนอก)
  const [rawCtr, setCtrRows] = useState([]);
  // ใบเคลมในช่วงนี้ ที่ใบ Advance อยู่ก่อนช่วง (ใช้เฉพาะโหมดนับตามวันที่ใบเคลม)
  const [rawCarry, setCarryRows] = useState([]);
  /**
   * ✅ (11 พ.ย. 2569 ผู้ใช้เลือก "มีปุ่มสลับได้ทั้ง 2 แบบ") นับยอดใช้จริงเข้าช่วงเวลาตาม
   *    🔁 (11 พ.ย. 2569 ผู้ใช้: "ใช้ค่าตั้งต้นอิง Advance แบบเดิม") advance = วันที่ใบ Advance (ค่าเริ่มต้น · แบบเดิม)
   *    claim = วันที่ใบเคลม (ค่าใช้จ่ายจริงของเดือน) · จำค่าที่เลือกไว้ในเครื่อง (คีย์ใหม่ — ค่าที่เคยลองเลือกไว้ไม่ทับค่าเริ่มต้น)
   */
  const [basis, setBasisState] = useState(() => { try { return localStorage.getItem("tt-exp-basis-v2") === "claim" ? "claim" : "advance"; } catch { return "advance"; } });
  const setBasis = (v) => { setBasisState(v); try { localStorage.setItem("tt-exp-basis-v2", v); } catch { /* ignore */ } };
  // ✅ กรองทีละหมวดค่าใช้จ่าย (ผู้ใช้: "อยากดูแค่เบี้ยเลี้ยง หรือค่าน้ำมัน") — กรองที่ระดับรายการก่อนคำนวณทุกอย่าง
  //    ตัวเลขสรุป / กราฟ / รายบุคคล / รายใบ / Excel จึงเป็นหมวดเดียวกันหมดเสมอ (ดู filterByCategory)
  const [category, setCategory] = useState("all");
  const catView = useMemo(() => filterByCategory(rawRows, rawReimburse, category), [rawRows, rawReimburse, category]);
  const catCarry = useMemo(() => filterByCategory(rawCarry, [], category).advances, [rawCarry, category]);
  const allReimburse = catView.reimbursements;
  // ใบผู้รับเหมา: แสดงเฉพาะใบที่มีรายการหมวดนั้น (ยอดสุทธิหลังหักภาษี/มัดจำคิดทั้งใบ จึงไม่ตัดยอดรายบรรทัด)
  const allCtr = useMemo(() => (category === "all" ? rawCtr : rawCtr.filter((r) => (r.items || []).some((i) => (i.category || "other") === category))), [rawCtr, category]);
  // ตัวเลือกหมวด = เฉพาะหมวดที่มีรายการจริงในช่วงเวลานี้ (เรียงตามลำดับมาตรฐาน)
  const categoryOptions = useMemo(() => {
    const n = new Map();
    const add = (items) => (items || []).forEach((i) => { const k = i.category || "other"; n.set(k, (n.get(k) || 0) + 1); });
    rawRows.forEach((a) => { add(a.items); add(a.claim?.items); });
    rawReimburse.forEach((r) => add(r.items));
    // 🐛 (11 พ.ย. 2569 ผู้ใช้: "ทำไมเลือกช่วงเวลาแล้วตัวเลือกอื่นหาย") — เดิมแสดงเฉพาะหมวดที่มีในช่วงนั้น และซ่อนทั้งช่อง
    //    เมื่อมีไม่ถึง 2 หมวด (ช่วงที่ยังไม่มีใบ = ช่องหายไปเลย เปลี่ยนกลับไม่ได้) → แสดงทุกหมวดเสมอ บอกจำนวนในช่วงนี้
    return EXPENSE_CATEGORIES.map((c) => ({ ...c, count: n.get(c.value) || 0 }));
  }, [rawRows, rawReimburse]);
  const categoryLabel = category === "all" ? "" : categoryMeta(category).label;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false); // ✅ (11 พ.ย. 2569) พิมพ์หลายใบพร้อมกัน
  const [docTab, setDocTab] = useState("advance");

  const applyPreset = (value) => {
    setPreset(value);
    const p = PRESETS.find((x) => x.value === value);
    if (!p?.range) return;
    const [a, b] = p.range();
    setFrom(a ? a.format("YYYY-MM-DD") : "");
    setTo(b ? b.format("YYYY-MM-DD") : "");
  };

  useEffect(() => {
    ExpenseService.people().then(setPeople).catch(() => {});
  }, []);
  const avatarOf = useMemo(() => new Map(people.filter((u) => hasValidAvatar(u.imageUrl)).map((u) => [String(u.userId), u.imageUrl])), [people]);

  const lastParamsRef = useRef("");
  useEffect(() => {
    let alive = true;
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    // ✅ ตัวกรองเดิม (ข้อมูลเปลี่ยนแบบเรียลไทม์) → อัปเดตตัวเลขเงียบๆ ไม่ล้างรายงานเป็นโครงโหลด
    const paramsKey = JSON.stringify(params);
    if (paramsKey !== lastParamsRef.current) setLoading(true);
    lastParamsRef.current = paramsKey;
    setError("");
    ExpenseService.report(params)
      .then((r) => {
        if (!alive) return;
        setRows(r.advances);
        setCarryRows(r.carryIn || []);
        setReimburseRows(r.reimbursements);
        setCtrRows(r.contractors);
      })
      .catch((err) => alive && setError(errorText(err, "โหลดรายงานไม่สำเร็จ")))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [from, to, reloadKey]);

  // ✅ กรองผู้เบิกฝั่งหน้าจอ (เดิมส่ง userId ไปให้ server) — server กรองทุกก้อนด้วย requester.userId อย่างเดียว
  // ผลจึงเหมือนเดิมทุกตัวเลข แต่แผง "ใบเบิกตามผู้เบิก" ยังเห็นตัวเลขของทุกคนครบแม้เลือกคนหนึ่งอยู่
  // (ถ้ากรองที่ server พอกดคนหนึ่ง คนอื่นจะหายจากแผงหมด — แบบเดียวกับแผงผู้รับผิดชอบหน้าภาพรวมงาน)
  const allRows = useMemo(() => applyBasis(catView.advances, catCarry, basis, from, to), [catView.advances, catCarry, basis, from, to]);
  const ofPerson = (r) => person === "all" || String(r.requester?.userId || "") === person;
  const rows = useMemo(() => allRows.filter(ofPerson), [allRows, person]); // eslint-disable-line react-hooks/exhaustive-deps
  const reimburseRows = useMemo(() => allReimburse.filter(ofPerson), [allReimburse, person]); // eslint-disable-line react-hooks/exhaustive-deps
  const ctrRows = useMemo(() => allCtr.filter(ofPerson), [allCtr, person]); // eslint-disable-line react-hooks/exhaustive-deps

  // แถวสำหรับแผงผู้เบิก — ใบ Advance + สำรองจ่าย + ค่าจ้างผู้รับเหมา (ชุดเดียวกับที่ตัวกรองผู้เบิกเดิมครอบ)
  // ⚠️ ไม่รวมใบค่าจ้างผู้รับเหมา — ตัวเลขสรุป/รายบุคคลไม่นับใบพวกนี้ (ผู้รับเงินเป็นคนนอก มีแผงของตัวเอง)
  //    ถ้านับรวม จำนวนใบ/ยอดในรายชื่อจะไม่ตรงกับตัวเลขสรุปทันทีที่มีใบผู้รับเหมาในช่วงเวลานั้น
  const personRows = useMemo(() => [...allRows.filter((r) => r._adv !== false), ...allReimburse].map((r) => ({
    responsiblePerson: personFullName(r.requester),
    userId: String(r.requester?.userId || ""),
    total: Number(r.total) || 0,
  })), [allRows, allReimburse]);
  const selectedName = person === "all" ? "all" : (personRows.find((r) => r.userId === person)?.responsiblePerson
    || people.find((p) => p.userId === person)?.fullName || "all");
  const personOptions = useMemo(() => {
    const m = new Map();
    personRows.forEach((r) => { if (!r.userId) return; const p = m.get(r.userId) || { id: r.userId, name: r.responsiblePerson, count: 0 }; p.count += 1; m.set(r.userId, p); });
    return [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "th"));
  }, [personRows]);

  const report = useMemo(() => buildExpenseReport(rows, { reimbursements: reimburseRows, basis }), [rows, reimburseRows, basis]);
  // ✅ แบ่งหน้ารายการที่ยาวขึ้นเรื่อยๆ ตามเวลา (ผู้ใช้สั่ง) — 10 ต่อหน้า
  const advPg = usePaged(report.rows, 10);
  const rmbPg = usePaged(report.reimburseRows, 10);
  const ctrPg = usePaged(ctrRows, 10);
  // ✅ รายบุคคลตามชื่อในรายการ — ⚠️ ต้องคิดจาก "ทุกใบ" ไม่ใช่ rows ที่กรองผู้เบิกแล้ว: เลือกนาย B อยู่
  // ก็ต้องเห็นเงินที่นาย A เบิกให้ B ด้วย (ใบพวกนั้นผู้เบิกเป็น A จึงหลุดจากตัวกรองผู้เบิก)
  const ledgerAll = useMemo(() => buildPersonLedger(allRows, allReimburse, { basis }), [allRows, allReimburse, basis]);
  // รายชื่อใน select: ผู้เบิก + คนที่ถูกเบิกให้อย่างเดียว (ไม่มีใบที่ตัวเองเป็นผู้เบิก) ต่อท้าย
  const nameOptions = useMemo(() => {
    const seen = new Set(personOptions.map((p) => p.id));
    const extra = ledgerAll.filter((l) => l.userId && !seen.has(l.userId)).map((l) => ({ id: l.userId, name: l.label, count: 0, beneficiary: true }));
    extra.forEach((x) => seen.add(x.id));
    // 🐛 (11 พ.ย. 2569) พนักงานที่ไม่มีใบในช่วงนี้ก็ต้องเลือกได้ — เดิมรายชื่อมาจากใบในช่วงอย่างเดียว ช่วงว่าง = ช่องหายทั้งช่อง
    const rest = people
      .filter((u) => u.userId && !seen.has(String(u.userId)))
      .map((u) => ({ id: String(u.userId), name: u.fullName || [u.fname, u.lname].filter(Boolean).join(" ") || u.username || "-", count: 0, idle: true }));
    return [...personOptions, ...extra.sort((a, b) => a.name.localeCompare(b.name, "th")), ...rest.sort((a, b) => a.name.localeCompare(b.name, "th"))];
  }, [personOptions, ledgerAll, people]);
  const ledger = useMemo(() => (person === "all" ? ledgerAll : ledgerAll.filter((p) => p.userId === person)), [ledgerAll, person]);
  // ✅ เลือกดูคนเดียว: หมวด/รายเดือน ยึด "ชื่อในรายการ" (รวมที่คนอื่นเบิกให้) — ผู้ใช้ขอให้สอดคล้องกับแผงรายบุคคล
  const personView = useMemo(() => (person !== "all" && ledger[0] ? personBreakdown(ledger[0]) : null), [person, ledger]);
  const viewByMonth = personView ? personView.byMonth : report.byMonth;
  const viewByCategory = personView ? personView.byCategory : report.byCategory;
  const ledgerPg = usePaged(ledger, 10);
  const holderOf = useMemo(() => new Map(report.byPerson.map((b) => [b.key, b])), [report.byPerson]);
  const hasData = rows.length > 0 || reimburseRows.length > 0 || ctrRows.length > 0;
  const t = report.totals;
  const periodLabel = from || to ? `${from ? thaiDate(from) : "เริ่มต้น"} – ${to ? thaiDate(to) : "ปัจจุบัน"}` : "ทั้งหมด";
  const usage = t.advanced ? Math.round((t.actual / Math.max(t.advanced - t.outstanding, 1)) * 100) : 0;

  const doExport = async () => {
    setExporting(true);
    try {
      const { exportExpenseReport } = await import("../utils/expenseExcelExport");
      // ⚠️ เลือกดูคนเดียว: ชีตหมวด/รายเดือนในไฟล์ต้องเหมือนบนจอ (ตามชื่อในรายการ)
      await exportExpenseReport({ ...report, byCategory: viewByCategory, byMonth: viewByMonth }, { periodLabel: `${categoryLabel ? `${periodLabel} · เฉพาะหมวด ${categoryLabel}` : periodLabel} · นับยอดใช้จริงตามวันที่${basis === "claim" ? "ใบเคลม" : "ใบ Advance"}`, ledger, fileName: `รายงานเบิก-เคลม${categoryLabel ? ` (${categoryLabel})` : ""} ${moment().format("YYYY-MM-DD")}` });
    } catch (err) {
      setError(errorText(err, "ส่งออก Excel ไม่สำเร็จ"));
    } finally {
      setExporting(false);
    }
  };

  // จำนวนตัวกรองที่ต่างจากค่าเริ่มต้น (ปีนี้ · ทุกคน) — ป้ายบนปุ่มตัวกรองของหัวเพจ (มือถือ)
  /**
   * ✅ (11 พ.ย. 2569 ผู้ใช้: "พิมพ์ PDF รวมทุกใบได้ ตามการ Filter หมดทั้งหมด")
   *    ทุกใบตามตัวกรองของหน้า (ช่วงเวลา · พนักงาน · หมวด) ทุกชนิดในไฟล์เดียว:
   *    • ใบ Advance ที่เคลมแล้ว = พิมพ์ใบเคลม (มีใบ Advance แนบเป็นหน้า 2 อยู่แล้ว) · ยังไม่เคลม = พิมพ์ใบ Advance — ไม่พิมพ์ซ้ำ
   *    • ใบสำรองจ่าย · ใบค่าจ้างผู้รับเหมา
   *    ⚠️ กรองหมวดอยู่ = เลือกใบที่มีรายการหมวดนั้น แต่พิมพ์ "ทั้งใบ" ตามเอกสารจริง (ยอดในรายการเลือกใช้ยอดเต็มของใบ)
   */
  const bulkDocs = useMemo(() => {
    const full = new Map();
    [...rawRows, ...rawReimburse].forEach((x) => { full.set(String(x._id), x); if (x.claim) full.set(String(x.claim._id), x.claim); });
    const fullTotal = (d) => (full.has(String(d._id)) ? full.get(String(d._id)).total : d.total);
    return [
      ...report.rows.map((a) => (a.claim && a.claim.status !== "cancelled"
        ? { ...a.claim, kind: "claim", claimType: a.claim.claimType || "clear", requester: a.claim.requester || a.requester, subject: a.subject, job: a.job, total: fullTotal(a.claim) }
        : { ...a, total: fullTotal(a) })),
      ...report.reimburseRows.map((r) => ({ ...r, kind: "claim", claimType: "reimburse", total: fullTotal(r) })),
      ...(category === "all" ? ctrRows.map((r) => ({ ...r, kind: "claim", claimType: "contractor" })) : []),
    ];
  }, [report.rows, report.reimburseRows, ctrRows, rawRows, rawReimburse, category]);
  const bulkLive = bulkDocs.filter((d) => d.status !== "cancelled").length;
  const bulkButton = <ExportPdfButton onClick={() => setBulkOpen(true)} disabled={loading || bulkLive === 0} label="พิมพ์ PDF ทั้งหมด" count={bulkLive} />;

  const activeFilterCount = (preset !== "year" ? 1 : 0) + (person !== "all" ? 1 : 0) + (category !== "all" ? 1 : 0);
  useEffect(() => { onActiveFiltersChange?.(activeFilterCount); }, [activeFilterCount]); // eslint-disable-line react-hooks/exhaustive-deps
  // ✅ มือถือ: เลือกช่วงเวลา/ผู้เบิกแล้วปิดแผ่นทันที — ยกเว้น "กำหนดเอง" (ยังต้องเลือกวันที่ในแผ่น)
  useCloseOnPick(mobileFiltersOpen, () => onMobileFiltersClose?.(), { preset, person, category }, (_, next) => next.preset === "custom");

  // ✅ แถบตัวกรองแถวเดียว (กล่องขาวชุดเดียวกับหน้าภาพรวมงาน) — จอใหญ่วางบนหน้า · มือถืออยู่ในแผ่นล่าง
  const filterBox = (
    <Stack
      direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}
      sx={isDesktop
        ? { mb: 1.5, p: 1, bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 3, boxShadow: "none" }
        : { "& > *": { width: "100%" } }}
    >
      <SelectField label="ช่วงเวลา" value={preset} onChange={(e) => applyPreset(e.target.value)} sx={{ minWidth: 170 }}>
        {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
      </SelectField>
      {preset === "custom" && (
        <Stack direction="row" spacing={1} sx={{ flex: { md: "none" } }}>
          <Box sx={{ flex: 1, minWidth: 150 }}><ThaiDatePicker label="ตั้งแต่" value={from} onChange={(v) => setFrom(v || "")} /></Box>
          <Box sx={{ flex: 1, minWidth: 150 }}><ThaiDatePicker label="ถึง" value={to} onChange={(v) => setTo(v || "")} /></Box>
        </Stack>
      )}
      {/* ✅ เลือกชื่อเป็น select ทุกขนาดจอ (ผู้ใช้ขอ — แบบเดียวกับหน้าอื่น) · จอใหญ่ยังมีการ์ดผู้เบิกให้กดด้วย
          รายชื่อรวมคนที่ "ถูกเบิกให้" อย่างเดียว (ไม่เคยเป็นผู้เบิก) ด้วย — เลือกดูยอดของเขาได้ */}
      {viewAll && (
        <PersonSelectField
          label="ชื่อพนักงาน" title="เลือกพนักงาน" value={person} onChange={setPerson}
          allLabel="ทุกคน" allCount={personRows.length} unit="ใบ"
          options={nameOptions.map((p) => ({
            id: p.id, name: p.name, count: p.count || undefined,
            avatar: avatarOf.get(String(p.id)),
            note: p.count ? "" : p.idle ? "ไม่มีใบในช่วงนี้" : "ถูกเบิกให้ (ไม่เคยเป็นผู้เบิก)",
          }))}
          sx={{ minWidth: { xs: "100%", md: 260 } }}
        />
      )}
      <SelectField label="หมวดค่าใช้จ่าย" value={category} onChange={(e) => setCategory(e.target.value)} sx={{ minWidth: { md: 190 } }}>
        <option value="all">ทุกหมวด</option>
        {categoryOptions.map((c) => <option key={c.value} value={c.value}>{c.label}{c.count ? ` (${c.count} รายการ)` : " (ไม่มีในช่วงนี้)"}</option>)}
      </SelectField>
      {/* 🔁 (11 พ.ย. 2569 ผู้ใช้: "เอามาติดด้านซ้าย · ยังดูไม่ลงตัว") ช่องเลือกหน้าตาเดียวกับตัวกรองอื่นในแถว ต่อจากหมวดค่าใช้จ่าย */}
      <SelectField label="นับยอดใช้จริงตาม" value={basis} onChange={(e) => setBasis(e.target.value)} sx={{ minWidth: { md: 190 } }}>
        <option value="advance">วันที่ใบ Advance</option>
        <option value="claim">วันที่ใบเคลม</option>
      </SelectField>
      <Box sx={{ flex: 1, display: { xs: "none", md: "block" } }} />
      <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 600 }}>{periodLabel}</Typography>
      {bulkButton}
      <ExportExcelButton onClick={doExport} loading={exporting} disabled={loading || !hasData} />
    </Stack>
  );

  return (
    <Box sx={{ pt: 2 }}>
      {/* ── ตัวกรอง ─────────────────────────────────────────────────── */}
      {isDesktop ? filterBox : (
        <>
          {/* ── มือถือ: บอกช่วงเวลา/ผู้เบิกที่กำลังดูเป็นบรรทัดเล็ก (แผงเต็มอยู่ในแผ่นล่าง เปิดจากปุ่มบนหัวเพจ) ── */}
          <Stack direction="row" spacing={0.75} useFlexGap alignItems="center" sx={{ mb: 1.25, flexWrap: "wrap" }}>
            <Chip size="small" label={PRESETS.find((p) => p.value === preset)?.label || periodLabel} sx={{ fontWeight: 700, bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}` }} />
            {person !== "all" && <Chip size="small" label={`ผู้เบิก: ${selectedName}`} onDelete={() => setPerson("all")} sx={{ fontWeight: 700 }} />}
            {categoryLabel && <Chip size="small" label={`หมวด: ${categoryLabel}`} onDelete={() => setCategory("all")} sx={{ fontWeight: 700 }} />}
            <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 600 }}>{periodLabel}</Typography>
            <Box sx={{ ml: "auto" }}>{bulkButton}</Box>
          </Stack>
          <Drawer
            anchor="bottom" open={mobileFiltersOpen} onClose={() => onMobileFiltersClose?.()}
            PaperProps={{ sx: { borderTopLeftRadius: 18, borderTopRightRadius: 18, px: 2, pt: 1, pb: "calc(16px + env(safe-area-inset-bottom))", maxHeight: "85vh" } }}
          >
            <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: "#cbd5e1", mx: "auto", mb: 1.25 }} />
            <Stack direction="row" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography sx={{ flex: 1, fontWeight: 800, fontSize: "1rem", color: TEXT_MAIN }}>ตัวกรองรายงาน</Typography>
              {activeFilterCount > 0 && (
                <Button size="small" onClick={() => { applyPreset("year"); setPerson("all"); setCategory("all"); }} sx={{ textTransform: "none", fontWeight: 700, color: "#dc2626" }}>
                  ล้างทั้งหมด
                </Button>
              )}
              <IconButton size="small" aria-label="ปิด" onClick={() => onMobileFiltersClose?.()}><Close /></IconButton>
            </Stack>
            {filterBox}
            <Button
              fullWidth variant="contained" onClick={() => onMobileFiltersClose?.()}
              sx={{ mt: 2, py: 1.1, textTransform: "none", fontWeight: 800, borderRadius: 2.5, boxShadow: "none", bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8", boxShadow: "none" } }}
            >
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
      ) : (
        <>
          {/* ── ตัวเลขหลัก ── 🔁 (11 พ.ย. 2569 ผู้ใช้: "เช็คยอดที่ใช้จ่ายจริง ยอดเคลม และสำรองจ่าย อ่านแล้วมองยาก แยกยาก")
                แถวบน = ค่าใช้จ่ายจริง และที่มาของเงิน 3 ทาง · แถวล่าง = ยอดที่ยังต้องมีคนลงมือ (0 = จางสงบ) */}
          <HowToRead />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 1 }}>
            <Kpi label={MT.totalCost} value={baht(t.actual + t.reimburse)}
              sub={`ใช้จริง ${baht(t.actual)} + สำรองจ่าย ${baht(t.reimburse)}`} color={PRIMARY} highlight />
            <Kpi label={MT.advanced} value={baht(t.advanced)}
              sub={t.toPay ? `อนุมัติแล้ว รอโอนอีก ${baht(t.toPay)}` : `${t.count} ใบ · ขอเบิกรวม ${baht(t.requested)}`} color={ADV} />
            <Kpi label={MT.actual} value={baht(t.actual)}
              sub={basis === "claim"
                ? (t.carriedIn ? `รวมเคลมของ Advance ก่อนช่วง ${baht(t.carriedIn)}` : "ตามวันที่ใบเคลมในช่วงนี้")
                : t.advanced - t.outstanding > 0 ? `${usage}% ของยอดเบิกล่วงหน้าที่เคลมแล้ว` : "ยังไม่มีใบเคลมที่อนุมัติ"} color={ACT} />
            <Kpi label={MT.reimburse} value={baht(t.reimburse)}
              sub={`${t.reimburseCount} ใบ · จ่ายคืนพนักงานแล้ว ${baht(t.reimbursePaid)}`} color={RMB} />
          </Box>
          <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 1.75, mb: 0.75 }}>
            <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: TEXT_MAIN }}>ยอดที่ต้องติดตาม</Typography>
            <Typography sx={{ fontSize: "0.72rem", color: TEXT_SUB }}>มีตัวเลข = ยังมีคนต้องลงมือ</Typography>
          </Stack>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 1 }}>
            <Kpi label={MT.outstanding} value={baht(t.outstanding)}
              sub={t.overdue ? `เลยกำหนดส่งเคลม ${t.overdue} ใบ` : "เบิกไปแล้ว ยังไม่ส่งใบเคลม"} color={t.overdue ? LATE : FOLLOW} followup active={t.outstanding > 0} />
            <Kpi label={MT.refundDue} value={baht(t.refundDue)}
              sub={`ใช้น้อยกว่าที่เบิก · คืนแล้ว ${baht(t.refunded)}`} color={FOLLOW} followup active={t.refundDue > 0} />
            <Kpi label={MT.extraDue} value={baht(t.extraDue)}
              sub={`ใช้เกินที่เบิก · จ่ายแล้ว ${baht(t.extraPaid)}`} color={FOLLOW} followup active={t.extraDue > 0} />
            <Kpi label={MT.reimburseDue} value={baht(t.reimburseDue)}
              sub="สำรองจ่ายอนุมัติแล้ว รอโอนคืนพนักงาน" color={FOLLOW} followup active={t.reimburseDue > 0} />
          </Box>
          {/* ✅ ใบข้ามเดือน — บอกให้ชัดว่ากำลังนับแบบไหน และมีใบข้ามช่วงเท่าไร (ตัวเลขด้านบนตรวจย้อนได้) */}
          {(t.carriedInCount > 0 || t.claimedLaterCount > 0 || basis === "advance") && (
            <Stack direction="row" alignItems="flex-start" gap={0.75} sx={{ mt: 1, px: 1.25, py: 0.85, borderRadius: 2, bgcolor: "#f8fafc", border: `1px solid ${BORDER_MAIN}` }}>
              <CalendarMonth sx={{ fontSize: 17, color: TEXT_SUB, mt: 0.1 }} />
              <Typography sx={{ fontSize: "0.78rem", color: TEXT_SUB, lineHeight: 1.55 }}>
                {basis === "claim" ? (
                  <>
                    <b style={{ color: TEXT_MAIN }}>นับยอดใช้จริงตามวันที่ใบเคลม</b>
                    {t.carriedInCount > 0 && <> · รวมใบเคลมของ Advance ก่อนช่วงนี้ {t.carriedInCount} ใบ <b style={{ color: ACT }}>{baht(t.carriedIn)}</b></>}
                    {t.claimedLaterCount > 0 && <> · Advance ในช่วงนี้ที่เคลมหลังช่วง {t.claimedLaterCount} ใบ <b style={{ color: TEXT_MAIN }}>{baht(t.claimedLater)}</b> (เคลียร์แล้ว ไม่นับเป็นค้างเคลม · ยอดใช้จริงไปอยู่ช่วงของใบเคลม)</>}
                  </>
                ) : (
                  <><b style={{ color: TEXT_MAIN }}>นับยอดใช้จริงตามวันที่ใบ Advance</b> · ใบเคลมนับเข้าช่วงเดียวกับใบ Advance ของมัน แม้เคลมเดือนถัดไป — สลับเป็น “วันที่ใบเคลม” เพื่อดูค่าใช้จ่ายจริงของเดือน</>
                )}
              </Typography>
            </Stack>
          )}
          {(t.pending > 0 || t.reimbursePending > 0) && (
            <Typography sx={{ mt: 1, fontSize: "0.76rem", color: TEXT_SUB }}>
              ยังไม่ผ่านอนุมัติ (ไม่นับในตัวเลขด้านบน): เบิกล่วงหน้า {baht(t.pending)}{t.reimbursePending ? ` · สำรองจ่าย ${baht(t.reimbursePending)}` : ""}
            </Typography>
          )}
          <Box sx={{ mb: 1.5 }} />

          {/* ✅ เลือกดูคนเดียว: บอกให้ชัดว่ากล่องตัวเลขด้านบนนับ "ใบที่คนนี้เป็นผู้เบิก" (เงินอยู่กับใคร) ส่วนแผงด้านล่างนับตามชื่อในรายการ */}
          {/* ✅ กำลังกรองหมวด — บอกชัดๆ ว่าทุกตัวเลขในหน้านี้เป็นของหมวดเดียว (กันอ่านผิดว่าเป็นยอดทั้งหมด) */}
          {categoryLabel && (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5, px: 1.5, py: 1, borderRadius: 2, bgcolor: "#f0f9ff", border: "1px solid #bae6fd" }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: categoryMeta(category).color, flexShrink: 0 }} />
              <Typography sx={{ flex: 1, fontSize: "0.82rem", color: "#0c4a6e" }}>
                ตัวเลขทั้งหน้านี้เป็น <b>เฉพาะหมวด {categoryLabel}</b> — ยอดใบคิดจากรายการหมวดนี้เท่านั้น
              </Typography>
              <Button size="small" onClick={() => setCategory("all")} sx={{ textTransform: "none", fontWeight: 700 }}>ดูทุกหมวด</Button>
            </Stack>
          )}
          {personView && ledger[0] && (ledger[0].byOthers > 0 || ledger[0].forOthers > 0) && (
            <Box sx={{ mb: 1.5, px: 1.5, py: 1, borderRadius: 2, bgcolor: "#f0f9ff", border: "1px solid #bae6fd", fontSize: "0.8rem", color: "#075985", lineHeight: 1.5 }}>
              ตัวเลขด้านบนนับเฉพาะใบที่ <b>{ledger[0].label}</b> เป็นผู้เบิก ·
              ยอดของ {ledger[0].label} ตามชื่อในรายการ <b>{baht(ledger[0].requested)}</b>
              {ledger[0].byOthers > 0 && <> (รวมที่คนอื่นเบิกให้ {baht(ledger[0].byOthers)})</>}
              {ledger[0].forOthers > 0 && <> · เบิกให้คนอื่น {baht(ledger[0].forOthers)}</>}
              {" "}— แผงรายเดือน / หมวด / รายบุคคลด้านล่างนับตามชื่อในรายการ
            </Box>
          )}
          {!hasData ? (
            <Stack alignItems="center" spacing={1} sx={{ py: 6, bgcolor: "#fff", border: `1px dashed ${BORDER_MAIN}`, borderRadius: 2.5 }}>
              <Insights sx={{ fontSize: 44, color: "#cbd5e1" }} />
              <Typography sx={{ fontWeight: 700, color: TEXT_SUB }}>ไม่มีใบเบิกในช่วงเวลานี้</Typography>
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              {/* 🧹 (11 พ.ย. 2569 ผู้ใช้: "ไม่น่าต้องแสดงถ้าไม่จำเป็นกับรายงาน แสดงยอด") ตัดแผงสถานะตามขั้นอนุมัติ — ใบที่ยังไม่ผ่านอนุมัติบอกเป็นบรรทัดใต้ยอดแล้ว */}
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "3fr 2fr" }, gap: 1.5 }}>
                <Panel icon={<BarChart />} color={ADV} title="รายเดือน" hint={personView ? "เบิกล่วงหน้า เทียบ ใช้จริง และสำรองจ่าย · ตามชื่อในรายการ (รวมที่คนอื่นเบิกให้)" : "เบิกล่วงหน้า เทียบ ใช้จริง และสำรองจ่าย"}><MonthBars rows={viewByMonth} /></Panel>
                <Panel icon={<DonutLarge />} color="#ea580c" title="ตามหมวดค่าใช้จ่าย" hint={personView ? "แถบจาง = เบิกล่วงหน้า · แถบเข้ม = ใช้จริง · ตามชื่อในรายการ (รวมที่คนอื่นเบิกให้)" : "แถบจาง = เบิกล่วงหน้า · แถบเข้ม = ใช้จริง"}><CategoryBars rows={viewByCategory} /></Panel>
              </Box>

              {/* 🔁 (11 พ.ย. 2569 ผู้ใช้: "เอาสรุปรายบุคคลขึ้นมาก่อน สรุปตามงาน") */}
              {ledger.length > 0 && (
                <Panel
                  icon={<Groups />} color={ACT}
                  title={`รายบุคคล (${ledger.length} คน)`}
                  hint="ยอดของแต่ละคนนับตามชื่อในรายการ (เบิกให้ลูกทีม = ยอดของลูกทีม) · กดชื่อเพื่อดูทีละใบ"
                >
                  <Stack spacing={1}>
                    {ledgerPg.rows.map((p) => <LedgerRow key={p.key} p={p} holder={holderOf.get(p.userId)} onOpen={onOpen} isDesktop={isDesktop} avatar={avatarOf.get(String(p.userId))} />)}
                  </Stack>
                  <PageBar {...ledgerPg} unit="คน" />
                </Panel>
              )}

              {/* 🧹 เดิมสลับ "ผู้เบิก / งาน" — ส่วนผู้เบิกซ้ำกับแผงรายบุคคล (ตัวเลขเงินค้าง/ส่วนต่างย้ายไปเป็นป้ายในแถวรายบุคคลแล้ว)
                  เหลือมุมมองตามงานอย่างเดียว */}
              <Panel icon={<Work />} color="#2563eb" title="สรุปตามงาน" hint={`แต่ละงานใช้เงินไปเท่าไร · ${MT.totalCost} = ${MT.totalCostHint} · กดชื่องานเพื่อดูในปฏิทิน`}>
                <GroupTable rows={report.byJob} firstHeader="งาน" />
              </Panel>

              {/* ✅ ใบค่าจ้างผู้รับเหมา — เงินที่จ่ายให้คนนอก · ยอดหัก ณ ที่จ่ายรวมใช้เตรียมยื่น ภ.ง.ด.3/53 ของเดือน */}
              {ctrRows.length > 0 && (() => {
                const live = ctrRows.filter((r) => r.status !== "cancelled");
                const done = live.filter((r) => ["approved", "settled"].includes(r.status));
                const sumOf = (list, f) => list.reduce((s, r) => s + (Number(f(r)) || 0), 0);
                const CTR = KIND_META.contractor;
                return (
                  <Panel
                    icon={<Engineering />} color={KIND_META.contractor.color}
                    title={`ใบค่าจ้างผู้รับเหมา (${ctrRows.length})`}
                    hint="ค่าจ้างเหมา/ค่าแรงที่จ่ายให้ผู้รับเหมา · ยอดหัก ณ ที่จ่ายใช้ประกอบการยื่นภาษี"
                  >
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 1, mb: 1.5 }}>
                      <Kpi label="ค่าจ้าง (อนุมัติแล้ว)" value={baht(sumOf(done, (r) => r.total))} sub={`${done.length} ใบ`} color={CTR.color} />
                      <Kpi label="หัก ณ ที่จ่ายรวม" value={baht(sumOf(done, (r) => r.deductions?.wht))} sub="นำส่งสรรพากร · ออก 50 ทวิ" color="#b45309" />
                      <Kpi label="จ่ายผู้รับเหมาแล้ว (สุทธิ)" value={baht(sumOf(done.filter((r) => r.status === "settled"), (r) => r.difference))} sub=" " color="#059669" />
                      <Kpi label="รออนุมัติเบิกจ่าย (สุทธิ)" value={baht(sumOf(done.filter((r) => r.status === "approved"), (r) => r.difference))}
                        sub={`ยังไม่ผ่านอนุมัติ ${baht(sumOf(live.filter((r) => ["pending", "reviewed", "rejected"].includes(r.status)), (r) => r.difference))}`}
                        color={CTR.dark} highlight={done.some((r) => r.status === "approved")} />
                    </Box>
                    <Box sx={{ overflowX: "auto" }}>
                      <Table size="small" sx={{ minWidth: 820, "& th": { fontWeight: 800, color: TEXT_SUB, fontSize: "0.74rem", whiteSpace: "nowrap", bgcolor: "#f8fafc" }, "& td": { fontSize: "0.82rem", borderColor: BORDER_MAIN } }}>
                        <TableHead>
                          <TableRow>
                            <TableCell>เลขที่ / วันที่</TableCell>
                            <TableCell>ผู้รับเหมา · งวด</TableCell>
                            <TableCell>งาน</TableCell>
                            <TableCell align="right">ค่าจ้าง</TableCell>
                            <TableCell align="right">หัก ณ ที่จ่าย</TableCell>
                            <TableCell align="right">จ่ายสุทธิ</TableCell>
                            <TableCell>สถานะ</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {ctrPg.rows.map((r) => {
                            const st = { ...statusMeta(r.status, "contractor"), status: r.status, kind: "contractor" };
                            return (
                              <TableRow key={r._id} hover onClick={() => onOpen?.(r._id)} sx={{ cursor: "pointer" }}>
                                <TableCell sx={{ whiteSpace: "nowrap" }}>
                                  <Stack direction="row" spacing={0.75} alignItems="center"><KindBadge kind="contractor" /><b>{r.docNo}</b></Stack>
                                  <span style={{ color: TEXT_SUB }}>{thaiDate(r.docDate)}</span>
                                </TableCell>
                                <TableCell sx={{ maxWidth: 220 }}>
                                  <Typography noWrap sx={{ fontSize: "inherit", fontWeight: 700 }}>{r.contractor?.name || "-"}</Typography>
                                  <Typography noWrap variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>{installmentText(r.installment) || "ไม่ระบุงวด"} · ผู้จัดทำ {personFullName(r.requester)}</Typography>
                                </TableCell>
                                <TableCell sx={{ maxWidth: 260 }}>
                                  <Typography noWrap sx={{ fontSize: "inherit" }}>{r.job?.title ? `${r.job.title}${r.job.site ? ` · ${r.job.site}` : ""}` : "ไม่ผูกงาน"}</Typography>
                                </TableCell>
                                <TableCell align="right">{baht(r.total)}</TableCell>
                                <TableCell align="right" sx={{ color: "#b45309" }}>{r.deductions?.wht ? baht(r.deductions.wht) : "—"}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 800, color: CTR.dark }}>{baht(r.difference)}</TableCell>
                                <TableCell><StatusBadge status={st.status} kind={st.kind} /></TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </Box>
                    <PageBar {...ctrPg} unit="ใบ" />
                  </Panel>
                );
              })()}

              {/* ✅ รวมรายใบ Advance + ใบสำรองจ่าย เป็นแผงเดียว สลับด้วยปุ่ม (เดิมเป็น 2 แผงคนละที่ หน้าตาเดียวกัน) */}
              {docTab === "reimburse" && (
                <Panel
                  icon={<ReceiptLong />} color="#475569"
                  title="รายใบทั้งหมด"
                  hint="ใบสำรองจ่าย — พนักงานจ่ายเงินตัวเองไปก่อน แล้วเบิกคืนจากบริษัท · กดที่แถวเพื่อเปิดใบ"
                  action={<Stack direction="row" spacing={1} alignItems="center"><ToggleButtonGroup size="small" exclusive value={docTab} onChange={(_, v) => v && setDocTab(v)}
                    sx={{ "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 700, px: 1.25, py: 0.35 } }}>
                    <ToggleButton value="advance">เบิกล่วงหน้า + เคลม ({report.rows.length})</ToggleButton>
                    <ToggleButton value="reimburse">สำรองจ่าย ({report.reimburseRows.length})</ToggleButton>
                  </ToggleButtonGroup></Stack>}
                >
                  <Box sx={{ overflowX: "auto" }}>
                    <Table size="small" sx={{ minWidth: 680, "& th": TH_SX, "& td": { ...TD_SX, verticalAlign: "middle" } }}>
                      <TableHead>
                        <TableRow>
                          <TableCell>เลขที่ / วันที่</TableCell>
                          <TableCell>ผู้เบิก</TableCell>
                          <TableCell>เรื่อง · งาน</TableCell>
                          <TableCell align="right" title={MT.reimburseHint}><HeadDot color={RMB}>{MT.reimburse}</HeadDot></TableCell>
                          <TableCell>สถานะ</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rmbPg.rows.map((r) => {
                          const st = { ...statusMeta(r.status, "reimburse"), status: r.status, kind: "reimburse" };
                          return (
                            <TableRow key={r._id} hover onClick={() => onOpen?.(r._id)} sx={{ cursor: "pointer" }}>
                              <TableCell sx={{ whiteSpace: "nowrap" }}>
                                <Stack direction="row" spacing={0.75} alignItems="center">
                                  <KindBadge kind="reimburse" />
                                  <b>{r.docNo}</b>
                                </Stack>
                                <span style={{ color: TEXT_SUB }}>{thaiDate(r.docDate)}</span>
                              </TableCell>
                              <TableCell sx={{ whiteSpace: "nowrap" }}>{personFullName(r.requester)}</TableCell>
                              <TableCell sx={{ maxWidth: 320 }}>
                                <Typography noWrap sx={{ fontSize: "inherit", fontWeight: 600 }}>{r.subject}</Typography>
                                <Typography noWrap variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>{r.job?.title ? `${r.job.title}${r.job.site ? ` · ${r.job.site}` : ""}` : "ไม่ผูกงาน"}</Typography>
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 800, color: RMB }}>{baht(r.total)}</TableCell>
                              <TableCell><StatusBadge status={st.status} kind={st.kind} /></TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </Box>
                  <PageBar {...rmbPg} unit="ใบ" />
                </Panel>
              )}

              {docTab === "advance" && (
              <Panel icon={<ReceiptLong />} color="#475569" title="รายใบทั้งหมด" hint="1 แถว = ใบเบิกล่วงหน้า 1 ใบ คู่กับใบเคลมของใบนั้น · กดเลขที่เพื่อเปิดใบ"
                action={<Stack direction="row" spacing={1} alignItems="center">{report.reimburseRows.length > 0 ? <ToggleButtonGroup size="small" exclusive value={docTab} onChange={(_, v) => v && setDocTab(v)}
                    sx={{ "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 700, px: 1.25, py: 0.35 } }}>
                    <ToggleButton value="advance">เบิกล่วงหน้า + เคลม ({report.rows.length})</ToggleButton>
                    <ToggleButton value="reimburse">สำรองจ่าย ({report.reimburseRows.length})</ToggleButton>
                  </ToggleButtonGroup> : null}</Stack>}>
                {isDesktop ? (
                  <Box sx={{ overflowX: "auto" }}>
                    <Table size="small" sx={{ minWidth: 900, "& th": TH_SX, "& td": { ...TD_SX, verticalAlign: "middle" } }}>
                      <TableHead>
                        <TableRow>
                          <TableCell>เลขที่ / วันที่</TableCell>
                          <TableCell>ผู้เบิก</TableCell>
                          <TableCell>เรื่อง · งาน</TableCell>
                          <TableCell align="right" title={MT.advancedHint}><HeadDot color={ADV}>{MT.advanced}</HeadDot></TableCell>
                          <TableCell align="right" title={MT.actualHint}><HeadDot color={ACT}>{MT.actual}</HeadDot></TableCell>
                          <TableCell align="right">ส่วนต่าง (คืน / จ่ายเพิ่ม)</TableCell>
                          <TableCell>สถานะ</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {advPg.rows.map((a) => {
                          const st = { ...statusMeta(a.status, "advance"), status: a.status, kind: "advance" };
                          const d = a.claim ? diffText(a.claim.difference) : null;
                          return (
                            <TableRow key={a._id} hover onClick={() => onOpen?.(a._id)} sx={{ cursor: "pointer" }}>
                              <TableCell sx={{ whiteSpace: "nowrap" }}>
                                <b>{a.docNo}</b><br /><span style={{ color: TEXT_SUB }}>{thaiDate(a.docDate)}</span>
                                {a._advEarlier && <Box component="span" sx={{ display: "block", mt: 0.25, fontSize: "0.68rem", fontWeight: 700, color: "#0369a1" }}>Advance ก่อนช่วง · นับเฉพาะใบเคลม</Box>}
                                {a._claimLater && <Box component="span" sx={{ display: "block", mt: 0.25, fontSize: "0.68rem", fontWeight: 700, color: TEXT_SUB }}>เคลมหลังช่วง ({thaiDate(a.claim?.docDate)})</Box>}
                              </TableCell>
                              <TableCell sx={{ whiteSpace: "nowrap" }}>{a.requester?.name}</TableCell>
                              <TableCell sx={{ maxWidth: 320 }}>
                                <Typography noWrap sx={{ fontSize: "inherit", fontWeight: 600 }}>{a.subject}</Typography>
                                <Typography noWrap variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>{a.job?.title ? `${a.job.title}${a.job.site ? ` · ${a.job.site}` : ""}` : "ไม่ผูกงาน"}</Typography>
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>{baht(a.total)}</TableCell>
                              <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                                {a.claim ? (
                                  <>
                                    <ButtonBase onClick={(e) => { e.stopPropagation(); onOpen?.(a.claim._id); }} sx={{ fontFamily: "inherit", fontSize: "0.72rem", fontWeight: 800, color: ACT, borderRadius: 1, "&:hover": { textDecoration: "underline" } }}>
                                      {a.claim.docNo}
                                    </ButtonBase>
                                    <Box sx={{ fontWeight: 700 }}>{baht(a.claim.total)}</Box>
                                  </>
                                ) : <span style={{ color: TEXT_SUB }}>ยังไม่ส่งเคลม</span>}
                              </TableCell>
                              <TableCell align="right" title={d?.hint || ""} sx={{ color: d ? `${d.color} !important` : "#cbd5e1 !important", fontWeight: 700, whiteSpace: "nowrap" }}>{d ? d.text : "—"}</TableCell>
                              <TableCell><StatusBadge status={st.status} kind={st.kind} /></TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </Box>
                ) : (
                  <Stack spacing={1}>
                    {advPg.rows.map((a) => {
                      const st = { ...statusMeta(a.status, "advance"), status: a.status, kind: "advance" };
                      const d = a.claim ? diffText(a.claim.difference) : null;
                      return (
                        <Box key={a._id} onClick={() => onOpen?.(a._id)} sx={{ p: 1.25, border: `1px solid ${BORDER_MAIN}`, borderLeft: `4px solid ${st.color}`, borderRadius: 2, cursor: "pointer" }}>
                          <Stack direction="row" justifyContent="space-between" spacing={1}>
                            <Typography sx={{ fontWeight: 800, fontSize: "0.82rem" }}>{a.docNo}</Typography>
                            <Typography sx={{ fontWeight: 800, fontSize: "0.9rem" }}>{baht(a.total)}</Typography>
                          </Stack>
                          <Typography sx={{ fontWeight: 600, fontSize: "0.86rem" }} noWrap>{a.subject}</Typography>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
                            <Typography variant="caption" sx={{ color: TEXT_SUB }} noWrap>
                              {thaiDate(a.docDate)} · {a.requester?.name}
                              {a.claim && <Box component="span" sx={{ color: ACT, fontWeight: 800 }}> · {a.claim.docNo} ใช้จริง {baht(a.claim.total)}</Box>}
                            </Typography>
                            <Typography variant="caption" sx={{ color: d ? d.color : st.color, fontWeight: 800, whiteSpace: "nowrap" }}>
                              {d ? d.text : st.label}
                            </Typography>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                )}
                <PageBar {...advPg} unit="ใบ" />
              </Panel>
              )}
            </Stack>
          )}
        </>
      )}
      <ExpenseBulkPrint open={bulkOpen} onClose={() => setBulkOpen(false)} docs={bulkDocs} kind="advance"
        label={`ใบเบิก-เคลม ${periodLabel}`}
        note={`ทุกใบตามตัวกรอง: ${periodLabel}${person !== "all" ? ` · ${selectedName}` : " · ทุกคน"}${categoryLabel ? ` · หมวด ${categoryLabel} (พิมพ์ทั้งใบตามเอกสารจริง)` : ""} — ใบที่เคลมแล้วพิมพ์เป็นใบเคลมพร้อมใบ Advance แนบ`} />
    </Box>
  );
}
