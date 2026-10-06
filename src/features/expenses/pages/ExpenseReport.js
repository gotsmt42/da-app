/**
 * ExpenseReport — รายงานย้อนหลังการเบิก Advance / เคลม (ติดตามงบประมาณ)
 *
 * ✅ ตอบคำถามที่ผู้ใช้ต้องการ "รู้ได้ทันที": เบิกไปเท่าไร · ใช้จริงเท่าไร · เงินค้างอยู่กับใคร · ต้องคืน/จ่ายเพิ่ม
 * เท่าไร — แยกตามคน / ตามงาน / ตามหมวด / รายเดือน ในหน้าเดียว
 * ⚠️ ช่างเห็นเฉพาะของตัวเอง (server กรอง) — หัวหน้าเห็นทั้งบริษัทและกรองรายคนได้
 * ⚠️ ไม่มีเพดานงบ (ตามที่ผู้ใช้เลือก "ติดตามยอดและรายงาน") — หน้านี้รายงานอย่างเดียว ไม่บล็อกการเบิก
 */
import { useEffect, useMemo, useRef, useState } from "react";
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
import { CalendarMonth, Insights, WarningAmber, Close, ExpandMore, Groups } from "@mui/icons-material";

import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import SelectField from "@/shared/ui/SelectField";
import PersonSelectField from "@/shared/ui/PersonSelectField";
import usePaged, { PageBar } from "@/shared/ui/usePaged";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileExcel } from "@fortawesome/free-solid-svg-icons";
import useCloseOnPick from "@/shared/hooks/useCloseOnPick";
import { thaiDate, THAI_MONTHS_SHORT } from "@/shared/utils/thaiDate";
import usePermissions from "@/shared/hooks/usePermissions";
import ExpenseService, { errorText } from "../services/ExpenseService";
import { buildExpenseReport, buildPersonLedger, personBreakdown, filterByCategory } from "../utils/expenseReport";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import {
  KIND_META, statusMeta, categoryMeta, EXPENSE_CATEGORIES, baht, differenceMeta, TEXT_SUB, TEXT_MAIN, BORDER_MAIN, personFullName, installmentText,
} from "../expenseMeta";
import KindBadge from "../components/KindBadge";
import StatusBadge from "../components/StatusBadge";

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

/**
 * ใบที่ค้างอยู่ในสายอนุมัติ 3 ส่วน — ✅ ผู้ใช้สั่งให้หน้ารายงานตรงกับลำดับการเบิกใหม่
 * ⚠️ นับตามช่วงเวลา/ตัวกรองเดียวกับรายงานทั้งหน้า (ไม่ใช่คิวงานสดของทั้งบริษัท — คิวสดอยู่ที่ "รอดำเนินการ")
 */
const PIPELINE_STEPS = [
  // ✅ ส่วนที่ 2 รวม "ตรวจสอบ" กับ "อนุมัติ" ไว้ด้วยกัน (ผู้ใช้สั่งให้เหลือ 3 ส่วน) — ยังแยกตัวเลขให้เห็นว่าค้างที่มือไหน
  { key: "review", no: 2, title: "รอตรวจสอบ/อนุมัติ", who: "แอดมินช่าง ตรวจสอบ → ผู้จัดการแผนกช่าง อนุมัติ", color: "#b45309" },
  { key: "disburse", no: 3, title: "รออนุมัติเบิกจ่าย", who: "ผู้จัดการแผนกช่าง / กรรมการผู้จัดการ", color: "#2563eb" },
];

/** รวมตัวเลขของสองมือในส่วนที่ 2 เข้าด้วยกัน */
const pipelineOf = (pipeline, key) => {
  if (key !== "review") return pipeline?.disburse || {};
  const r = pipeline?.review || {};
  const a = pipeline?.approve || {};
  const sum = (f) => (Number(r[f]) || 0) + (Number(a[f]) || 0);
  return {
    count: sum("count"), advance: sum("advance"), claim: sum("claim"), reimburse: sum("reimburse"), amount: sum("amount"),
    waitReview: Number(r.count) || 0, waitApprove: Number(a.count) || 0,
  };
};

/**
 * ใบที่ค้างตามขั้นอนุมัติ — ✅ ผู้ใช้: "ทำให้กระชับขึ้น" (เดิมกล่องพื้นสี 5 บรรทัดต่อขั้น)
 * ตอนนี้ 2 บรรทัดต่อขั้น: [ขั้นที่ · ชื่อขั้น ...... N ใบ · ยอด] / [มีอะไรค้าง · ใครต้องทำ]
 * ขั้นที่ไม่มีใบค้างจางลง สายตาไปเกาะขั้นที่มีงานรอก่อน
 */
const Pipeline = ({ pipeline }) => (
  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" }, gap: 1 }}>
    {PIPELINE_STEPS.map((s) => {
      const p = pipelineOf(pipeline, s.key);
      const parts = [
        p.advance ? `Advance ${p.advance}` : "",
        p.claim ? `ใบเคลม ${p.claim}` : "",
        p.reimburse ? `สำรองจ่าย ${p.reimburse}` : "",
      ].filter(Boolean).join(" · ");
      const money = s.key === "disburse"
        ? (p.count ? `จ่ายออก ${baht(p.payOut)}${p.payIn ? ` · รับคืน ${baht(p.payIn)}` : ""}` : "")
        : (p.count ? baht(p.amount) : "");
      return (
        <Box key={s.key} sx={{
          px: 1.5, py: 1.1, borderRadius: 2, bgcolor: "#fff", minWidth: 0,
          border: `1px solid ${BORDER_MAIN}`, borderLeft: `4px solid ${p.count ? s.color : BORDER_MAIN}`,
          opacity: p.count ? 1 : 0.65,
        }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography component="span" sx={{ fontSize: "0.7rem", fontWeight: 800, color: s.color, whiteSpace: "nowrap" }}>ขั้นที่ {s.no}/3</Typography>
            <Typography sx={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: "0.88rem", color: TEXT_MAIN }} noWrap>{s.title}</Typography>
            <Typography sx={{ fontWeight: 800, fontSize: "1rem", color: p.count ? s.color : TEXT_SUB, whiteSpace: "nowrap" }}>{p.count || 0} ใบ</Typography>
            {money && <Typography sx={{ fontWeight: 700, fontSize: "0.82rem", color: TEXT_MAIN, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>· {money}</Typography>}
          </Stack>
          <Typography sx={{ fontSize: "0.72rem", color: TEXT_SUB, mt: 0.25 }} noWrap>
            {p.count ? `${parts}${s.key !== "disburse" && (p.waitReview || p.waitApprove) ? ` (รอตรวจสอบ ${p.waitReview} · รออนุมัติ ${p.waitApprove})` : ""} · ` : "ไม่มีใบค้าง · "}ผู้ดำเนินการ: {s.who}
          </Typography>
        </Box>
      );
    })}
  </Box>
);

const ADV = KIND_META.advance.color;
const ACT = KIND_META.claim.color;
/** ใบสำรองจ่าย — เงินที่พนักงานออกไปก่อน ยังไม่ผ่านระบบเบิกล่วงหน้าเลย */
const RMB = KIND_META.reimburse.color;

/** กราฟแท่งรายเดือน: จ่ายล่วงหน้า vs ใช้จริง (CSS ล้วน ไม่ต้องพึ่งไลบรารีกราฟ) */
const MonthBars = ({ rows }) => {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.advanced, r.actual, r.requested, r.reimburse)));
  if (!rows.length) return <Typography variant="body2" sx={{ color: TEXT_SUB }}>ไม่มีข้อมูล</Typography>;
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Stack direction="row" spacing={1.25} alignItems="flex-end" sx={{ height: 190, minWidth: rows.length * 52, pt: 1 }}>
        {rows.map((r) => (
          <Tooltip key={r.key} arrow title={`${monthLabel(r.key)} · ขอเบิก ${baht(r.requested)} · จ่ายแล้ว ${baht(r.advanced)} · ใช้จริง ${baht(r.actual)} · ค้าง ${baht(r.outstanding)}${r.reimburse ? ` · สำรองจ่าย ${baht(r.reimburse)}` : ""}`}>
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
        {[["จ่ายล่วงหน้าให้พนักงาน", ADV], ["ใช้จริง (อนุมัติ)", ACT], ["พนักงานสำรองจ่าย", RMB]].map(([l, c]) => (
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
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.4 }}>
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 700 }}>
                <Box component="span" sx={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", bgcolor: cat.color, mr: 0.75 }} />
                {cat.label}
              </Typography>
              <Typography sx={{ fontSize: "0.78rem", color: TEXT_SUB }}>
                ตั้งเบิก {baht(r.planned)} · <b style={{ color: TEXT_MAIN }}>ใช้จริง {baht(r.actual)}</b>
                {r.reimburse ? <> · <b style={{ color: RMB }}>สำรองจ่าย {baht(r.reimburse)}</b></> : null}
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
  if (!r.requested && r.actual) return { text: "เคลมเพิ่ม", hint: "ไม่มีในใบเบิก — บรรทัดนี้มีแค่ในใบเคลม", color: "#7c3aed" };
  if (r.requested && !r.actual) return { text: "ไม่มีในใบเคลม", color: "#94a3b8" };
  const d = r.actual - r.requested;
  if (Math.abs(d) < 0.005) return { text: "พอดี", color: "#16a34a" };
  return d > 0 ? { text: `+${baht(d)}`, hint: "ใช้เกินยอดเบิก", color: "#dc2626" } : { text: `−${baht(-d)}`, hint: "ใช้น้อยกว่ายอดเบิก (เหลือคืน)", color: "#0369a1" };
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
  return (
    <Box sx={{ border: `1px solid ${BORDER_MAIN}`, borderRadius: 2, overflow: "hidden", bgcolor: "#fff" }}>
      <Table size="small" sx={{
        "& th": { fontWeight: 600, color: TEXT_SUB, fontSize: "0.72rem", bgcolor: "#f8fafc", whiteSpace: "nowrap", py: 0.9, borderColor: BORDER_MAIN },
        "& td": { fontSize: "0.82rem", color: TEXT_MAIN, borderColor: "#f1f5f9", py: 0.85, verticalAlign: "top" },
      }}>
        <TableHead>
          <TableRow>
            <TableCell>เลขที่ใบ</TableCell>
            <TableCell>วันที่</TableCell>
            <TableCell>หมวด</TableCell>
            <TableCell align="right">ขอเบิก</TableCell>
            <TableCell align="right"><Box component="span" sx={{ color: ACT }}>●</Box> ใช้จริง</TableCell>
            <TableCell align="right">ส่วนต่าง</TableCell>
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
                        {(g.byOther || g.shared.length > 0) && (
                          <Typography sx={{ fontSize: "0.7rem", color: TEXT_SUB, mt: 0.15 }}>
                            {g.byOther ? `เบิกโดย ${g.requester}` : ""}{g.byOther && g.shared.length ? " · " : ""}{g.shared.length ? `ใบนี้มีของ ${g.shared.join(", ")}` : ""}
                          </Typography>
                        )}
                      </>
                    )}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap", color: `${TEXT_SUB} !important` }}>{first ? thaiDate(g.date) : ""}</TableCell>
                  <TableCell>{r.label}</TableCell>
                  <TableCell align="right" sx={{ ...NUM, fontWeight: 600, color: g.kind === "reimburse" ? `${RMB} !important` : undefined }}>{baht(r.requested)}</TableCell>
                  <TableCell align="right" sx={{ ...NUM, fontWeight: 600, color: hasClaim ? `${ACT} !important` : "#cbd5e1 !important" }}>{hasClaim ? baht(r.actual) : g.kind === "reimburse" ? "—" : "ยังไม่เคลม"}</TableCell>
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

const LedgerRow = ({ p, holder, onOpen, isDesktop }) => {
  const [open, setOpen] = useState(false);
  const slips = useMemo(() => slipGroups(p.lines), [p.lines]);
  const slipPg = usePaged(slips, 8);
  // ป้ายแจ้งเตือนจากมุม "ผู้เบิก" (เงินอยู่กับใคร) — โชว์เฉพาะที่มียอด จะได้ไม่รก
  const alerts = holder ? [
    holder.outstanding > 0 && { text: `เงินยังไม่เคลียร์ ${baht(holder.outstanding)}${holder.overdue ? " · เลยกำหนด" : ""}`, color: holder.overdue ? "#dc2626" : "#0369a1" },
    holder.refundDue > 0 && { text: `รอคืนเงินบริษัท ${baht(holder.refundDue)}`, color: "#d97706" },
    holder.extraDue > 0 && { text: `รอบริษัทจ่ายเพิ่ม ${baht(holder.extraDue)}`, color: "#2563eb" },
    holder.reimburseDue > 0 && { text: `รอจ่ายคืนสำรองจ่าย ${baht(holder.reimburseDue)}`, color: RMB },
  ].filter(Boolean) : [];
  const cells = [
    // ✅ สีชุดเดียวกับกล่องสรุปด้านบนของหน้า (ขอเบิก = เข้ม · จ่ายล่วงหน้า = เขียว · ใช้จริง = ม่วง · สำรองจ่าย = ส้ม)
    { label: "ยอดของคนนี้ (ขอเบิก)", value: p.requested, color: TEXT_MAIN },
    { label: "จ่ายล่วงหน้าแล้ว", value: p.advanced, color: ADV },
    { label: "ใช้จริง (เคลมอนุมัติ)", value: p.actual, color: ACT },
    { label: "สำรองจ่าย (อนุมัติ)", value: p.reimburse, color: RMB },
    { label: "ค่าใช้จ่ายอนุมัติรวม", value: p.approvedCost, color: TEXT_MAIN },
  ];
  return (
    <Box sx={{ border: `1px solid ${BORDER_MAIN}`, borderRadius: 2.5, overflow: "hidden", bgcolor: "#fff" }}>
      <Box
        role="button" tabIndex={0} onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v) => !v); } }}
        sx={{ p: 1.5, cursor: "pointer", "&:hover": { bgcolor: "#f8fafc" } }}
      >
        <Stack direction="row" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1.25}>
          <Avatar sx={{ width: 40, height: 40, bgcolor: personColor(p.label), fontWeight: 800, fontSize: "1rem" }}>{personInitial(p.label)}</Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            {/* ✅ ผู้ใช้: "ตรงนี้ไม่สวย" — ชื่อ + จำนวนรายการบรรทัดเดียว · สรุปเบิกข้ามคนเป็นบรรทัดเดียวคั่นด้วยเส้นบาง (ไม่มีกล่องเทาซ้อน)
                ป้ายเงินค้างย้ายไปชิดขวาข้างลูกศร (มือถือห่อลงล่าง) */}
            <Stack direction="row" alignItems="baseline" spacing={0.75} sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: "1rem", color: TEXT_MAIN, lineHeight: 1.3 }} noWrap>{p.label}</Typography>
              <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB, whiteSpace: "nowrap" }}>{p.lines.length} รายการ</Typography>
            </Stack>
            <Stack
              direction="row" useFlexGap flexWrap="wrap" alignItems="center" sx={{ mt: 0.35, columnGap: 1.25, rowGap: 0.25 }}
              divider={<Box sx={{ width: "1px", height: 12, bgcolor: BORDER_MAIN }} />}
            >
              {[
                ["เบิกเอง", p.self],
                ["คนอื่นเบิกให้", p.byOthers],
                ["เบิกให้คนอื่น", p.forOthers],
                ["คนอื่นเคลมให้", p.claimedByOthers],
                ["เคลมให้คนอื่น", p.claimedForOthers],
              ].filter(([, v]) => v > 0).map(([label, v]) => (
                <Typography key={label} component="span" sx={{ fontSize: "0.76rem", color: TEXT_SUB, whiteSpace: "nowrap" }}>
                  {label} <Box component="span" sx={{ color: TEXT_MAIN, fontWeight: 700, ...NUM }}>{baht(v)}</Box>
                </Typography>
              ))}
            </Stack>
            {alerts.length > 0 && (
              <Stack direction="row" useFlexGap flexWrap="wrap" spacing={0.5} sx={{ mt: 0.75, display: { xs: "flex", sm: "none" } }}>
                {alerts.map((al) => <AlertTag key={al.text} {...al} />)}
              </Stack>
            )}
          </Box>
          {alerts.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ display: { xs: "none", sm: "flex" }, flexShrink: 0 }}>
              {alerts.map((al) => <AlertTag key={al.text} {...al} />)}
            </Stack>
          )}
          <ExpandMore sx={{ color: TEXT_SUB, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none" }} />
        </Stack>
        {isDesktop ? (
          <Box sx={{ mt: 1.25, display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 0.75 }}>
            {cells.map((c) => (
              <Box key={c.label} sx={{ px: 1.25, py: 1, borderRadius: 2, bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.7rem", color: TEXT_SUB, fontWeight: 700 }} noWrap>{c.label}</Typography>
                <Typography sx={{ fontSize: "1.05rem", fontWeight: 800, color: c.value ? c.color : "#cbd5e1", lineHeight: 1.3, ...NUM }}>{baht(c.value)}</Typography>
              </Box>
            ))}
          </Box>
        ) : (
          // ✅ มือถือ: กล่องเดียว ป้ายซ้าย-ตัวเลขขวา (เดิม 5 กล่องซ้อนกัน 3 แถว กินจอ ผู้ใช้แจ้งว่ารก)
          <Box sx={{ mt: 1, px: 1.25, py: 0.5, borderRadius: 2, bgcolor: "#f8fafc", border: `1px solid ${BORDER_MAIN}` }}>
            {cells.map((c, ci) => (
              <Stack key={c.label} direction="row" alignItems="baseline" justifyContent="space-between" spacing={1}
                sx={{ py: 0.6, borderTop: ci ? `1px dashed ${BORDER_MAIN}` : 0 }}>
                <Typography sx={{ fontSize: "0.8rem", color: TEXT_SUB }}>{c.label}</Typography>
                <Typography sx={{ fontSize: ci === 0 || ci === cells.length - 1 ? "0.98rem" : "0.9rem", fontWeight: 800, color: c.value ? c.color : "#cbd5e1", ...NUM }}>{baht(c.value)}</Typography>
              </Stack>
            ))}
          </Box>
        )}
      </Box>

      <Collapse in={open} unmountOnExit>
        <Box sx={{ px: 1.5, pb: 1.5, pt: 0.5, borderTop: `1px solid ${BORDER_MAIN}`, bgcolor: "#fcfdfe" }}>
          {/* ✅ ผู้ใช้: "ข้อมูลยังดูยาก รก สับสน" — เดิมเป็นตารางเบิก + ตารางเคลมแยกกัน ซ้ำวันที่/เลขที่/สถานะทุกบรรทัด
              และต้องจับคู่เองว่าบรรทัดเบิกไหนเคลียร์ด้วยบรรทัดเคลมไหน
              → การ์ดละ 1 ใบ: หัวการ์ด = เลขที่ใบ (Advance → ใบเคลม) · วันที่ · ใครเบิก · สถานะ
                 เนื้อการ์ด = ทีละหมวด  ขอเบิก | ใช้จริง | ส่วนต่าง  วางคู่กันในแถวเดียว */}
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
};

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
                  <Typography component={RouterLink} to={eventLinkOf(r)} sx={{ flex: 1, minWidth: 0, fontSize: "0.86rem", fontWeight: 600, color: TEXT_MAIN, lineHeight: 1.4, textDecoration: "none", "&:active": { color: "#2563eb" } }}>
                    {r.label} <CalendarMonth sx={{ fontSize: 14, color: "#94a3b8", verticalAlign: "-2px" }} />
                  </Typography>
                ) : (
                  <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.86rem", fontWeight: 600, color: TEXT_MAIN, lineHeight: 1.4 }}>{r.label}</Typography>
                )}
                <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB, whiteSpace: "nowrap" }}>{r.count} ใบ</Typography>
              </Stack>
              <Stack direction="row" useFlexGap flexWrap="wrap" sx={{ mt: 0.35, columnGap: 1.5, rowGap: 0.25, fontSize: "0.76rem", color: TEXT_SUB }}>
                <span>จ่ายล่วงหน้า <b style={{ color: ADV, ...NUM }}>{baht(r.advanced)}</b></span>
                <span>ใช้จริง <b style={{ color: ACT, ...NUM }}>{baht(r.actual)}</b></span>
                {r.outstanding > 0 && <span>ยังไม่เคลียร์ <b style={{ color: "#0369a1", ...NUM }}>{baht(r.outstanding)}</b></span>}
                {r.reimburse > 0 && <span>สำรองจ่าย <b style={{ color: RMB, ...NUM }}>{baht(r.reimburse)}</b></span>}
              </Stack>
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
      "& th": { fontWeight: 600, color: TEXT_SUB, fontSize: "0.74rem", whiteSpace: "nowrap", bgcolor: "#f8fafc", py: 1 },
      "& td": { fontSize: "0.84rem", color: TEXT_MAIN, borderColor: "#f1f5f9", py: 1, verticalAlign: "top", fontVariantNumeric: "tabular-nums" },
    }}>
      <TableHead>
        <TableRow>
          <TableCell>{firstHeader}</TableCell>
          <TableCell align="right">ใบ</TableCell>
          <TableCell align="right">จ่ายล่วงหน้าให้พนักงาน</TableCell>
          <TableCell align="right">ใช้จริง</TableCell>
          <TableCell align="right">ยังไม่เคลียร์ (อยู่กับพนักงาน)</TableCell>
          <TableCell align="right">พนักงานสำรองจ่าย</TableCell>
          <TableCell align="right">ส่วนต่างที่ยังไม่จบ</TableCell>
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
                        sx={{ fontSize: "0.84rem", fontWeight: 600, color: TEXT_MAIN, lineHeight: 1.4, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 0.5, "&:hover": { color: "#2563eb", textDecoration: "underline" } }}>
                        {m ? m[1] : r.label}
                        <CalendarMonth sx={{ fontSize: 15, color: "#94a3b8" }} />
                      </Typography>
                    ) : (
                      <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: TEXT_MAIN, lineHeight: 1.4 }}>{m ? m[1] : r.label}</Typography>
                    )}
                    {m && <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB, lineHeight: 1.4 }}>{m[2]}</Typography>}
                  </>
                );
              })()}
            </TableCell>
            <TableCell align="right" sx={{ color: `${TEXT_SUB} !important` }}>{r.count}</TableCell>
            <TableCell align="right">{r.advanced ? baht(r.advanced) : <span style={{ color: "#cbd5e1" }}>—</span>}</TableCell>
            <TableCell align="right">{r.actual ? baht(r.actual) : <span style={{ color: "#cbd5e1" }}>—</span>}</TableCell>
            <TableCell align="right" sx={{ color: r.outstanding ? "#0284c7 !important" : "#cbd5e1 !important", fontWeight: r.outstanding ? 700 : 400 }}>
              {r.outstanding ? baht(r.outstanding) : "—"}{r.overdue ? <WarningAmber sx={{ fontSize: 14, color: "#dc2626", ml: 0.5, verticalAlign: "-2px" }} /> : null}
            </TableCell>
            <TableCell align="right" sx={{ color: r.reimburse ? `${RMB} !important` : "#cbd5e1 !important", fontWeight: r.reimburse ? 700 : 400, whiteSpace: "nowrap" }}>
              {r.reimburse ? baht(r.reimburse) : "—"}
              {r.reimburseDue ? <span style={{ display: "block", fontSize: "0.72rem", fontWeight: 700 }}>รออนุมัติเบิกจ่ายคืน {baht(r.reimburseDue)}</span> : null}
            </TableCell>
            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
              {/* ⚠️ ต้องบอกทิศทางเงินเสมอ — "คืน ฿3,000" ลอยๆ อ่านไม่ออกว่าใครคืนให้ใคร */}
              {r.refundDue ? <span style={{ color: "#d97706", fontWeight: 600 }}>พนักงานคืนบริษัท {baht(r.refundDue)}</span> : null}
              {r.refundDue && r.extraDue ? <br /> : null}
              {r.extraDue ? <span style={{ color: "#2563eb", fontWeight: 600 }}>บริษัทจ่ายเพิ่ม {baht(r.extraDue)}</span> : null}
              {!r.refundDue && !r.extraDue ? <span style={{ color: "#cbd5e1" }}>—</span> : null}
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
  // ✅ กรองทีละหมวดค่าใช้จ่าย (ผู้ใช้: "อยากดูแค่เบี้ยเลี้ยง หรือค่าน้ำมัน") — กรองที่ระดับรายการก่อนคำนวณทุกอย่าง
  //    ตัวเลขสรุป / กราฟ / รายบุคคล / รายใบ / Excel จึงเป็นหมวดเดียวกันหมดเสมอ (ดู filterByCategory)
  const [category, setCategory] = useState("all");
  const catView = useMemo(() => filterByCategory(rawRows, rawReimburse, category), [rawRows, rawReimburse, category]);
  const allRows = catView.advances;
  const allReimburse = catView.reimbursements;
  // ใบผู้รับเหมา: แสดงเฉพาะใบที่มีรายการหมวดนั้น (ยอดสุทธิหลังหักภาษี/มัดจำคิดทั้งใบ จึงไม่ตัดยอดรายบรรทัด)
  const allCtr = useMemo(() => (category === "all" ? rawCtr : rawCtr.filter((r) => (r.items || []).some((i) => (i.category || "other") === category))), [rawCtr, category]);
  // ตัวเลือกหมวด = เฉพาะหมวดที่มีรายการจริงในช่วงเวลานี้ (เรียงตามลำดับมาตรฐาน)
  const categoryOptions = useMemo(() => {
    const n = new Map();
    const add = (items) => (items || []).forEach((i) => { const k = i.category || "other"; n.set(k, (n.get(k) || 0) + 1); });
    rawRows.forEach((a) => { add(a.items); add(a.claim?.items); });
    rawReimburse.forEach((r) => add(r.items));
    return EXPENSE_CATEGORIES.filter((c) => n.has(c.value)).map((c) => ({ ...c, count: n.get(c.value) }));
  }, [rawRows, rawReimburse]);
  const categoryLabel = category === "all" ? "" : categoryMeta(category).label;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
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
    if (viewAll) ExpenseService.people().then(setPeople).catch(() => {});
  }, [viewAll]);

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
  const ofPerson = (r) => person === "all" || String(r.requester?.userId || "") === person;
  const rows = useMemo(() => allRows.filter(ofPerson), [allRows, person]); // eslint-disable-line react-hooks/exhaustive-deps
  const reimburseRows = useMemo(() => allReimburse.filter(ofPerson), [allReimburse, person]); // eslint-disable-line react-hooks/exhaustive-deps
  const ctrRows = useMemo(() => allCtr.filter(ofPerson), [allCtr, person]); // eslint-disable-line react-hooks/exhaustive-deps

  // แถวสำหรับแผงผู้เบิก — ใบ Advance + สำรองจ่าย + ค่าจ้างผู้รับเหมา (ชุดเดียวกับที่ตัวกรองผู้เบิกเดิมครอบ)
  // ⚠️ ไม่รวมใบค่าจ้างผู้รับเหมา — ตัวเลขสรุป/รายบุคคลไม่นับใบพวกนี้ (ผู้รับเงินเป็นคนนอก มีแผงของตัวเอง)
  //    ถ้านับรวม จำนวนใบ/ยอดในรายชื่อจะไม่ตรงกับตัวเลขสรุปทันทีที่มีใบผู้รับเหมาในช่วงเวลานั้น
  const personRows = useMemo(() => [...allRows, ...allReimburse].map((r) => ({
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

  const report = useMemo(() => buildExpenseReport(rows, { reimbursements: reimburseRows }), [rows, reimburseRows]);
  // ✅ แบ่งหน้ารายการที่ยาวขึ้นเรื่อยๆ ตามเวลา (ผู้ใช้สั่ง) — 10 ต่อหน้า
  const advPg = usePaged(report.rows, 10);
  const rmbPg = usePaged(report.reimburseRows, 10);
  const ctrPg = usePaged(ctrRows, 10);
  // ✅ รายบุคคลตามชื่อในรายการ — ⚠️ ต้องคิดจาก "ทุกใบ" ไม่ใช่ rows ที่กรองผู้เบิกแล้ว: เลือกนาย B อยู่
  // ก็ต้องเห็นเงินที่นาย A เบิกให้ B ด้วย (ใบพวกนั้นผู้เบิกเป็น A จึงหลุดจากตัวกรองผู้เบิก)
  const ledgerAll = useMemo(() => buildPersonLedger(allRows, allReimburse), [allRows, allReimburse]);
  // รายชื่อใน select: ผู้เบิก + คนที่ถูกเบิกให้อย่างเดียว (ไม่มีใบที่ตัวเองเป็นผู้เบิก) ต่อท้าย
  const nameOptions = useMemo(() => {
    const seen = new Set(personOptions.map((p) => p.id));
    const extra = ledgerAll.filter((l) => l.userId && !seen.has(l.userId)).map((l) => ({ id: l.userId, name: l.label, count: 0 }));
    return [...personOptions, ...extra.sort((a, b) => a.name.localeCompare(b.name, "th"))];
  }, [personOptions, ledgerAll]);
  const ledger = useMemo(() => (person === "all" ? ledgerAll : ledgerAll.filter((p) => p.userId === person)), [ledgerAll, person]);
  // ✅ เลือกดูคนเดียว: หมวด/รายเดือน ยึด "ชื่อในรายการ" (รวมที่คนอื่นเบิกให้) — ผู้ใช้ขอให้สอดคล้องกับแผงรายบุคคล
  const personView = useMemo(() => (person !== "all" && ledger[0] ? personBreakdown(ledger[0]) : null), [person, ledger]);
  const viewByMonth = personView ? personView.byMonth : report.byMonth;
  const viewByCategory = personView ? personView.byCategory : report.byCategory;
  const ledgerPg = usePaged(ledger, 10);
  const hasData = rows.length > 0 || reimburseRows.length > 0 || ctrRows.length > 0;
  const t = report.totals;
  const periodLabel = from || to ? `${from ? thaiDate(from) : "เริ่มต้น"} – ${to ? thaiDate(to) : "ปัจจุบัน"}` : "ทั้งหมด";
  const usage = t.advanced ? Math.round((t.actual / Math.max(t.advanced - t.outstanding, 1)) * 100) : 0;

  const doExport = async () => {
    setExporting(true);
    try {
      const { exportExpenseReport } = await import("../utils/expenseExcelExport");
      // ⚠️ เลือกดูคนเดียว: ชีตหมวด/รายเดือนในไฟล์ต้องเหมือนบนจอ (ตามชื่อในรายการ)
      await exportExpenseReport({ ...report, byCategory: viewByCategory, byMonth: viewByMonth }, { periodLabel: categoryLabel ? `${periodLabel} · เฉพาะหมวด ${categoryLabel}` : periodLabel, ledger, fileName: `รายงานการเบิก${categoryLabel ? ` (${categoryLabel})` : ""} ${moment().format("YYYY-MM-DD")}` });
    } catch (err) {
      setError(errorText(err, "ส่งออก Excel ไม่สำเร็จ"));
    } finally {
      setExporting(false);
    }
  };

  // จำนวนตัวกรองที่ต่างจากค่าเริ่มต้น (ปีนี้ · ทุกคน) — ป้ายบนปุ่มตัวกรองของหัวเพจ (มือถือ)
  const activeFilterCount = (preset !== "year" ? 1 : 0) + (person !== "all" ? 1 : 0) + (category !== "all" ? 1 : 0);
  useEffect(() => { onActiveFiltersChange?.(activeFilterCount); }, [activeFilterCount]); // eslint-disable-line react-hooks/exhaustive-deps
  // ✅ มือถือ: เลือกช่วงเวลา/ผู้เบิกแล้วปิดแผ่นทันที — ยกเว้น "กำหนดเอง" (ยังต้องเลือกวันที่ในแผ่น)
  useCloseOnPick(mobileFiltersOpen, () => onMobileFiltersClose?.(), { preset, person, category }, (_, next) => next.preset === "custom");

  // ✅ แถบตัวกรองแถวเดียว (กล่องขาวชุดเดียวกับหน้าภาพรวมงาน) — จอใหญ่วางบนหน้า · มือถืออยู่ในแผ่นล่าง
  const filterBox = (
    <Stack
      direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}
      sx={isDesktop
        ? { mb: 1.5, p: 1, bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 3, boxShadow: "0 1px 2px rgba(15,23,42,.04)" }
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
      {viewAll && nameOptions.length > 1 && (
        <PersonSelectField
          label="ชื่อพนักงาน" title="เลือกพนักงาน" value={person} onChange={setPerson}
          allLabel="ทุกคน" allCount={personRows.length} unit="ใบ"
          options={nameOptions.map((p) => ({
            id: p.id, name: p.name, count: p.count || undefined,
            avatar: people.find((u) => u.userId === p.id)?.imageUrl,
            note: p.count ? "" : "ถูกเบิกให้ (ไม่เคยเป็นผู้เบิก)",
          }))}
          sx={{ minWidth: { xs: "100%", md: 260 } }}
        />
      )}
      {categoryOptions.length > 1 && (
        <SelectField label="หมวดค่าใช้จ่าย" value={category} onChange={(e) => setCategory(e.target.value)} sx={{ minWidth: { md: 190 } }}>
          <option value="all">ทุกหมวด</option>
          {categoryOptions.map((c) => <option key={c.value} value={c.value}>{c.label} ({c.count} รายการ)</option>)}
        </SelectField>
      )}
      <Box sx={{ flex: 1, display: { xs: "none", md: "block" } }} />
      <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 600 }}>{periodLabel} · อิงวันที่ของใบ Advance</Typography>
      <Button variant="outlined" startIcon={<FontAwesomeIcon icon={faFileExcel} style={{ fontSize: 16, color: "#217346" }} />} onClick={doExport} disabled={loading || exporting || !hasData}
        sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, bgcolor: "#fff", color: TEXT_MAIN, borderColor: BORDER_MAIN, "&:hover": { borderColor: "#217346", bgcolor: "#f0fdf4" } }}>
        {exporting ? "กำลังส่งออก..." : "ส่งออก Excel"}
      </Button>
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
          {/* ── ตัวเลขหลัก ─────────────────────────────────────────── */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)", lg: "repeat(7, 1fr)" }, gap: 1, mb: 1.5 }}>
            {/* ✅ สายอนุมัติ 3 ส่วน — บอกด้วยว่าในยอดที่ยังไม่ผ่านอนุมัติ ค้างอยู่ที่ขั้นรออนุมัติเท่าไร */}
            <Kpi
              label="ยอดขอเบิก"
              value={baht(t.requested)}
              sub={`${t.count} ใบ · ยังไม่ผ่านอนุมัติ ${baht(t.pending)}${t.reviewing ? ` (ในนั้นรออนุมัติ ${baht(t.reviewing)})` : ""}`}
              color={TEXT_MAIN}
            />
            <Kpi label="จ่ายล่วงหน้าให้พนักงานแล้ว" value={baht(t.advanced)} sub={t.toPay ? `รออนุมัติเบิกจ่ายอีก ${baht(t.toPay)}` : "ไม่มีรายการรออนุมัติเบิกจ่าย"} color={ADV} />
            <Kpi label="ใช้จริง (อนุมัติ)" value={baht(t.actual)} sub={t.advanced - t.outstanding > 0 ? `${usage}% ของยอดที่เคลียร์แล้ว` : " "} color={ACT} />
            <Kpi label="เงินที่ยังอยู่กับพนักงาน" value={baht(t.outstanding)} sub={t.overdue ? `เลยกำหนดเคลียร์ ${t.overdue} ใบ` : "ยังไม่มีใบเลยกำหนด"} color={t.overdue ? "#dc2626" : "#0284c7"} followup active={t.outstanding > 0} />
            <Kpi label="รอพนักงานคืนเงินบริษัท" value={baht(t.refundDue)} sub={`รอยืนยันรับคืน · คืนแล้ว ${baht(t.refunded)}`} color="#d97706" followup active={t.refundDue > 0} />
            <Kpi label="รอบริษัทจ่ายเพิ่มให้พนักงาน" value={baht(t.extraDue)} sub={`รออนุมัติเบิกจ่าย · จ่ายแล้ว ${baht(t.extraPaid)}`} color="#2563eb" followup active={t.extraDue > 0} />
            {/* ✅ เงินที่พนักงานสำรองจ่ายเอง — ไม่ได้ผ่านยอด "จ่ายล่วงหน้า" เลย ถ้าไม่มีช่องนี้ยอดกลุ่มนี้จะหายไปทั้งก้อน */}
            <Kpi
              label="พนักงานสำรองจ่าย (อนุมัติ)" value={baht(t.reimburse)}
              sub={t.reimburseDue ? `รออนุมัติเบิกจ่ายคืน ${baht(t.reimburseDue)}` : `${t.reimburseCount} ใบ · จ่ายคืนพนักงานแล้ว ${baht(t.reimbursePaid)}`}
              color={RMB} highlight={t.reimburseDue > 0}
            />
          </Box>

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
            <Box sx={{ mb: 1.5, px: 1.5, py: 1, borderRadius: 2, bgcolor: "#f5f3ff", border: "1px solid #ddd6fe", fontSize: "0.8rem", color: "#4c1d95", lineHeight: 1.5 }}>
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
              <Panel title="สถานะตามขั้นอนุมัติ" hint="ส่งขอเบิก → ตรวจสอบ/อนุมัติ → อนุมัติเบิกจ่าย · ใบที่ยังค้างในช่วงเวลานี้">
                <Pipeline pipeline={report.pipeline} />
              </Panel>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "3fr 2fr" }, gap: 1.5 }}>
                <Panel title="รายเดือน" hint={personView ? "จ่ายล่วงหน้า เทียบ ใช้จริง · ตามชื่อในรายการ (รวมที่คนอื่นเบิกให้)" : "จ่ายล่วงหน้า เทียบ ใช้จริง"}><MonthBars rows={viewByMonth} /></Panel>
                <Panel title="ตามหมวดค่าใช้จ่าย" hint={personView ? "แถบจาง = ตั้งเบิก · แถบเข้ม = ใช้จริง · ตามชื่อในรายการ (รวมที่คนอื่นเบิกให้)" : "แถบจาง = ตั้งเบิก · แถบเข้ม = ใช้จริง"}><CategoryBars rows={viewByCategory} /></Panel>
              </Box>

              {/* 🧹 เดิมสลับ "ผู้เบิก / งาน" — ส่วนผู้เบิกซ้ำกับแผงรายบุคคล (ตัวเลขเงินค้าง/ส่วนต่างย้ายไปเป็นป้ายในแถวรายบุคคลแล้ว)
                  เหลือมุมมองตามงานอย่างเดียว */}
              <Panel title="สรุปตามงาน" hint="งานไหนใช้งบไปเท่าไร · เงินที่ยังไม่เคลียร์ของแต่ละงาน">
                <GroupTable rows={report.byJob} firstHeader="งาน" />
              </Panel>

              {ledger.length > 0 && (
                <Panel
                  title={`รายบุคคล (${ledger.length} คน)`}
                  hint="นับยอดตามชื่อในรายการ (เบิกให้ลูกทีม = ยอดของลูกทีม) · กดชื่อเพื่อดูทีละใบ"
                  action={<Groups sx={{ color: "#7c3aed" }} />}
                >
                  <Stack spacing={1}>
                    {ledgerPg.rows.map((p) => <LedgerRow key={p.key} p={p} holder={report.byPerson.find((b) => b.key === p.userId)} onOpen={onOpen} isDesktop={isDesktop} />)}
                  </Stack>
                  <PageBar {...ledgerPg} unit="คน" />
                </Panel>
              )}

              {/* ✅ ใบค่าจ้างผู้รับเหมา — เงินที่จ่ายให้คนนอก · ยอดหัก ณ ที่จ่ายรวมใช้เตรียมยื่น ภ.ง.ด.3/53 ของเดือน */}
              {ctrRows.length > 0 && (() => {
                const live = ctrRows.filter((r) => r.status !== "cancelled");
                const done = live.filter((r) => ["approved", "settled"].includes(r.status));
                const sumOf = (list, f) => list.reduce((s, r) => s + (Number(f(r)) || 0), 0);
                const CTR = KIND_META.contractor;
                return (
                  <Panel
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
                  title="รายใบทั้งหมด"
                  hint="ใบสำรองจ่าย — พนักงานออกเงินเองไปก่อน ไม่มีใบ Advance ให้เทียบ · กดที่แถวเพื่อเปิดใบ"
                  action={<ToggleButtonGroup size="small" exclusive value={docTab} onChange={(_, v) => v && setDocTab(v)}
                    sx={{ "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 700, px: 1.25, py: 0.35 } }}>
                    <ToggleButton value="advance">Advance + ใบเคลม ({report.rows.length})</ToggleButton>
                    <ToggleButton value="reimburse">สำรองจ่าย ({report.reimburseRows.length})</ToggleButton>
                  </ToggleButtonGroup>}
                >
                  <Box sx={{ overflowX: "auto" }}>
                    <Table size="small" sx={{ minWidth: 680, "& th": { fontWeight: 800, color: TEXT_SUB, fontSize: "0.74rem", whiteSpace: "nowrap", bgcolor: "#f8fafc" }, "& td": { fontSize: "0.82rem", borderColor: BORDER_MAIN } }}>
                      <TableHead>
                        <TableRow>
                          <TableCell>เลขที่ / วันที่</TableCell>
                          <TableCell>ผู้เบิก</TableCell>
                          <TableCell>เรื่อง · งาน</TableCell>
                          <TableCell align="right">ยอดจ่ายคืน</TableCell>
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
              <Panel title="รายใบทั้งหมด" hint="ใบ Advance คู่กับใบเคลมที่เคลียร์ใบนั้น (แถวเดียวกัน) — กดเลขที่เพื่อเปิดใบ"
                action={report.reimburseRows.length > 0 ? <ToggleButtonGroup size="small" exclusive value={docTab} onChange={(_, v) => v && setDocTab(v)}
                    sx={{ "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 700, px: 1.25, py: 0.35 } }}>
                    <ToggleButton value="advance">Advance + ใบเคลม ({report.rows.length})</ToggleButton>
                    <ToggleButton value="reimburse">สำรองจ่าย ({report.reimburseRows.length})</ToggleButton>
                  </ToggleButtonGroup> : undefined}>
                {isDesktop ? (
                  <Box sx={{ overflowX: "auto" }}>
                    <Table size="small" sx={{ minWidth: 900, "& th": { fontWeight: 800, color: TEXT_SUB, fontSize: "0.74rem", whiteSpace: "nowrap", bgcolor: "#f8fafc" }, "& td": { fontSize: "0.82rem", borderColor: BORDER_MAIN } }}>
                      <TableHead>
                        <TableRow>
                          <TableCell>เลขที่ / วันที่</TableCell>
                          <TableCell>ผู้เบิก</TableCell>
                          <TableCell>เรื่อง · งาน</TableCell>
                          <TableCell align="right">เบิก</TableCell>
                          <TableCell align="right">ใบเคลม · ใช้จริง</TableCell>
                          <TableCell align="right">ส่วนต่าง</TableCell>
                          <TableCell>สถานะ</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {advPg.rows.map((a) => {
                          const st = { ...statusMeta(a.status, "advance"), status: a.status, kind: "advance" };
                          const d = a.claim ? differenceMeta(a.claim.difference) : null;
                          return (
                            <TableRow key={a._id} hover onClick={() => onOpen?.(a._id)} sx={{ cursor: "pointer" }}>
                              <TableCell sx={{ whiteSpace: "nowrap" }}><b>{a.docNo}</b><br /><span style={{ color: TEXT_SUB }}>{thaiDate(a.docDate)}</span></TableCell>
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
                                ) : <span style={{ color: TEXT_SUB }}>ยังไม่เคลม</span>}
                              </TableCell>
                              <TableCell align="right" sx={{ color: d?.color, fontWeight: 700, whiteSpace: "nowrap" }}>{d ? (d.amount ? `${d.short} ${baht(d.amount)}` : "พอดี") : "—"}</TableCell>
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
                      const d = a.claim ? differenceMeta(a.claim.difference) : null;
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
                              {d ? (d.amount ? `${d.short} ${baht(d.amount)}` : "ใช้พอดี") : st.label}
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
    </Box>
  );
}
