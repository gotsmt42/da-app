/**
 * WorkerKpiPanel — ยอดแยกรายคน + KPI (หน้าผลงานรายบุคคล)
 *
 * ✅ (17 พ.ย. 2569 ผู้ใช้: "ทำสรุปรายงาน ยอดของแต่ละคนแยกกันให้ชัดเจน · วิธีเช็ค KPI ช่าง")
 * 🔁 (17 พ.ย. 2569 ผู้ใช้: "จะจัดการการแสดงผลรวมยังไง ถ้ามีพนักงานหลายคนในหน้าเดียว")
 * 🔁 (17 พ.ย. 2569 ผู้ใช้: "จัดการให้ดูง่าย มองง่ายกว่านี้ เข้าใจง่าย ไม่ซับซ้อน · สีสันไม่รก ไม่ลายตา")
 *    • หลายคน = ตารางเดียว 1 แถวต่อคน คอลัมน์น้อย: ชื่อ · มูลค่างานที่ทำ · สัดส่วน · ครั้ง/วัน · ต่อวัน · ข้อมูล (✓ ครบ / ต้องแก้ N)
 *      + แถวรวมท้ายตาราง · กดหัวคอลัมน์เพื่อเรียง · กดแถว = ดูรายละเอียดคนนั้น
 *    • คนเดียว = แผงรายละเอียด: ตัวเลขหลัก 4 ช่อง · ความครบของข้อมูล (✓/!) · รายการงานที่ต้องแก้ (กด = เปิดงาน)
 *    • สี: ตัวเลขเป็นสีเข้มปกติ · สีใช้เฉพาะสถานะ (เขียว = ครบ · ส้ม = ต้องแก้) · ไม่มีแดง/แถบสีหลายสี
 *    • ตัวเลข/เกณฑ์/คำอธิบายมาจาก utils/workerKpi.js ที่เดียว (ใช้ร่วมกับ Excel)
 * 🔁 (17 พ.ย. 2569 ผู้ใช้: "ให้เด้งเป็นการ์ดขึ้นมาแทนไหม ให้ง่ายต่อการดู · วิเคราะห์ความเหมาะสม")
 *    กดแถวในตาราง = เด้งแผงรายละเอียดของคนนั้นขึ้นมาทับ (มือถือ = แผ่นจากล่าง · จอคอม = กล่องกลางจอ — MobileSheet)
 *    เหตุผล: ตารางเทียบยังอยู่ที่เดิม ปิดแล้วกดคนถัดไปได้ทันที (เดิมกด = กรองทั้งหน้า หน้ากระโดด เสียบริบทการเทียบ)
 *    ในแผง: ตัวเลขหลัก · ความครบของข้อมูล · งานที่ต้องแก้ · แนวโน้มรายเดือนของคนนั้น
 *    อยากเจาะลึก (รายการเข้างานทั้งหมดของคนนั้น) = ปุ่มท้ายแผง "ดูทั้งหน้าเฉพาะคนนี้" → กรองทั้งหน้าแบบเดิม
 */
import { useMemo, useState } from "react";
import { Box, Button, ButtonBase, Collapse, Stack, Typography, useMediaQuery } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { CheckCircleRounded, ErrorRounded, MenuBookRounded, ExpandMoreRounded, ChevronRightRounded, ArrowDownwardRounded,
  EventAvailableRounded, CalendarMonthRounded, InsightsRounded, PaymentsRounded, ReportProblemRounded } from "@mui/icons-material";
import { INK, MUTED, LINE, ACCENT } from "@/shared/ui/PageKit";
import { thaiDate } from "@/shared/utils/thaiDate";
import { ReportSection, PersonAvatar, R_CARD, baht } from "./ReportKit";
import MobileSheet from "@/shared/ui/MobileSheet";
import useElementWidth from "@/shared/hooks/useElementWidth";
import { monthLabel } from "../utils/reportPeriod";
import { buildPersonKpis, sortPeople, formatKpi, RATE_KPIS, KPI_DEFS, KPI_GUIDE, ISSUE_DEFS } from "../utils/workerKpi";

/* 🔁 (20 พ.ย. 2569 ผู้ใช้: "หน้าผลงานรายบุคคล สีสันมันยังดูไม่สวย ไม่สดใส ไม่คลีน ทื่อๆ และดูแล้วยังมองยาก")
   โทนเดียวกับกล่องสรุปมูลค่า (WorkValueSummary) ที่ผู้ใช้รับแล้ว — สดใสแต่มืออาชีพ:
   • หัวผลงานพื้นฟ้าอ่อนไล่ขาว · ตัวเลขหลักมีไอคอนสีพื้นอ่อนบอกความหมาย
   • ความครบของข้อมูล = แถบความคืบหน้าสีตามเป้า (เขียว ถึงเป้า · ส้ม ยังไม่ถึง) อ่านได้ทันทีโดยไม่ต้องคิด %
   • สิ่งที่ต้องแก้ = ป้ายเล็กสีส้มอ่อนทีละเรื่อง (เดิมเป็นประโยคสีส้มยาวต่อกัน ตัดท้าย อ่านยาก)
   • ตาราง: แถบเทียบยอดกับคนที่สูงสุด · "ลงมูลค่าแล้ว" เป็นแถบสี · อันดับ 1–3 มีวงสีฟ้า
   🔁 (20 พ.ย. 2569 ผู้ใช้: "สียังดูรกอยู่") ลดสีให้เหลือ 3 ความหมายเท่านั้น:
     น้ำเงิน = ข้อมูล/ตัวที่เลือก · เขียว = ครบ/ถึงเป้า · ส้ม = ป้าย "ต้องแก้ N" จุดเดียวต่อคน/ต่องาน
     ป้ายรายการที่ขาด = เทาอ่อน (อ่านง่าย ไม่แย่งสายตา) · ไอคอนตัวเลขหลักสีเดียว · บทบาท/เข้างาน/สถานะ เป็นข้อความเทา */
const OK = "#15803d";
const OK_SOFT = "#f0fdf4";
const WARN = "#b45309";
const WARN_SOFT = "#fffbeb";
const WARN_LINE = "#fde68a";
const FAINT = "#94a3b8";
const TRACK = "#e8edf4";
const ACCENT_SOFT = "#eff6ff";
const SHOW_FIRST_ROWS = 15;
const NUM = { fontVariantNumeric: "tabular-nums" };
// 🔁 (17 พ.ย. 2569 ผู้ใช้: "ขยายให้เต็ม · ทำให้สมูทดูดีกว่านี้") เปลี่ยนคน/มุมมอง = ค่อยๆ ปรากฏ · แถว hover นุ่ม
const FADE_IN = { "@keyframes kpiIn": { from: { opacity: 0, transform: "translateY(6px)" }, to: { opacity: 1, transform: "none" } }, animation: "kpiIn .28s ease-out" };
const ROW_HOVER = { transition: "background-color .15s ease", "&:hover": { bgcolor: "#f8fbff" } };

/** ป้ายเม็ดยาพื้นอ่อน (ไม่มีขอบ) */
const Pill = ({ tone = "slate", children, sx }) => {
  const t = { ok: [OK, OK_SOFT], warn: [WARN, WARN_SOFT], blue: [ACCENT, ACCENT_SOFT], slate: ["#475569", "#f1f5f9"] }[tone] || ["#475569", "#f1f5f9"];
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, height: 22, px: 0.9, borderRadius: 99, whiteSpace: "nowrap",
      fontSize: "0.7rem", fontWeight: 800, color: t[0], bgcolor: t[1], ...sx }}>
      {children}
    </Box>
  );
};

/** สถานะข้อมูลของคน — ใช้ทั้งตารางและแผงรายละเอียด */
function DataStatus({ p, size = "sm" }) {
  const big = size === "lg";
  if (!p.past) return <Typography component="span" sx={{ fontSize: big ? "0.84rem" : "0.78rem", color: FAINT }}>ยังไม่มีงานที่ผ่านไป</Typography>;
  const ok = p.issueCount === 0;
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: big ? 1.1 : 0.9, height: big ? 28 : 24, borderRadius: 99,
      bgcolor: ok ? OK_SOFT : WARN_SOFT, color: ok ? OK : WARN,
      fontSize: big ? "0.8rem" : "0.74rem", fontWeight: 800, whiteSpace: "nowrap" }}>
      {ok ? <CheckCircleRounded sx={{ fontSize: big ? 17 : 15 }} /> : <ErrorRounded sx={{ fontSize: big ? 17 : 15 }} />}
      {ok ? "ข้อมูลครบ" : `ต้องแก้ ${p.issueCount}`}
    </Box>
  );
}

/** แถบความคืบหน้า — สีตามสถานะ */
const Bar = ({ value, color = ACCENT, height = 6 }) => (
  <Box sx={{ height, borderRadius: 99, bgcolor: TRACK, overflow: "hidden" }}>
    <Box sx={{ width: `${Math.max(0, Math.min(1, value || 0)) * 100}%`, height: "100%", bgcolor: color, borderRadius: 99, transition: "width .45s ease" }} />
  </Box>
);
const ShareBar = ({ share }) => <Bar value={share} color={alpha(ACCENT, 0.7)} height={5} />;

/** สี/สถานะของ "ลงมูลค่าแล้ว x/y" */
const fillTone = (done, base) => (!base ? FAINT : done >= base ? OK : done === 0 ? "#cbd5e1" : ACCENT);

/** ไอคอนในวงพื้นอ่อน */
const IconBadge = ({ icon: Icon, color, size = 34 }) => (
  <Box sx={{ width: size, height: size, borderRadius: "10px", flexShrink: 0, display: "grid", placeItems: "center", bgcolor: alpha(color, 0.1), color }}>
    <Icon sx={{ fontSize: size * 0.56 }} />
  </Box>
);

// ── ตารางเทียบทุกคน ────────────────────────────────────────────────────────────
// 🔁 (17 พ.ย. 2569 ผู้ใช้: "รองรับทุกขนาดหน้าจอ") เลือกรูปตาม "ความกว้างของกล่องจริง" (useElementWidth) ไม่ใช่ความกว้างจอ
// 🔁 (17 พ.ย. 2569 ผู้ใช้: "ข้อมูลตรงนี้ยังดูงง ไม่เข้าใจว่าแต่ละแถวคืออะไร")
//    • หัวคอลัมน์ 2 บรรทัด: ชื่อ + หน่วย/ความหมายสั้นๆ · แยก "เข้างาน" กับ "วันทำงาน" คนละคอลัมน์
//    • ยังไม่ลงมูลค่าเลย = "ยังไม่ลง" (ไม่ใช่ ฿0) · คอลัมน์ "ลงมูลค่าแล้ว x/y"
//    • ความครบของข้อมูล บอกว่าขาดอะไรกี่รายการ · คำอธิบายทุกคอลัมน์ใต้ตาราง
//    ≥1060 = ครบทุกคอลัมน์ · 760–1059 = ตัดลงมูลค่าแล้ว · <760 = รายการย่อ
// 🔁 (17 พ.ย. 2569 ผู้ใช้: "ยอดที่ลงไม่นำมารวมกัน แยกเป็นผลงานของแต่ละคน") แสดงรายคนอย่างเดียว ไม่มียอดรวมทุกคน
const COLS = "48px minmax(180px, 1fr) 150px 74px 82px 112px 116px 230px 20px";
const COLS_MID = "40px minmax(150px, 1fr) 128px 62px 70px 100px 200px 18px";
const W_FULL = 1060;
const W_MID = 760;

/** ขาดอะไรบ้าง — ป้ายสั้นทีละเรื่อง (ชื่อสั้น · จำนวน) */
const BRIEF = [["missingValue", "มูลค่า"], ["noCheckIn", "เข้างาน"], ["notClosed", "ขอปิด"], ["noReport", "Report"], ["docsIncomplete", "เอกสาร PM"], ["noSummary", "สรุปงาน"]];
const BRIEF_FULL = { missingValue: "ไม่ลงมูลค่า", noCheckIn: "ไม่กดเข้างาน", notClosed: "ไม่ขอปิดงาน", noReport: "ไม่มี Service Report", docsIncomplete: "เอกสาร PM ไม่ครบ", noSummary: "ไม่มีสรุปงาน" };
const issueItems = (p) => BRIEF.map(([k, label]) => ({ k, label, n: p.issues?.[k]?.length || 0 })).filter((x) => x.n > 0);
const issueTitle = (p) => issueItems(p).map((x) => `${BRIEF_FULL[x.k]} ${x.n}`).join(" · ");

function IssueChips({ p, max = 3, justify = "center" }) {
  const items = issueItems(p);
  if (!items.length) return null;
  const shown = items.slice(0, max);
  return (
    <Stack direction="row" title={issueTitle(p)} sx={{ mt: 0.5, gap: 0.4, flexWrap: "wrap", justifyContent: justify }}>
      {shown.map((x) => (
        <Box key={x.k} component="span" sx={{ height: 20, px: 0.7, borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: 0.35, whiteSpace: "nowrap",
          fontSize: "0.66rem", fontWeight: 700, color: "#475569", bgcolor: "#f1f5f9" }}>
          {x.label}<Box component="span" sx={{ fontWeight: 900, ...NUM }}>{x.n}</Box>
        </Box>
      ))}
      {items.length > max && <Box component="span" sx={{ height: 20, px: 0.6, display: "inline-flex", alignItems: "center", fontSize: "0.66rem", fontWeight: 800, color: FAINT }}>+{items.length - max}</Box>}
    </Stack>
  );
}

function SortHead({ label, sub, k, sortBy, onSort, align = "right" }) {
  const active = sortBy === k;
  return (
    <ButtonBase onClick={() => onSort(k)} title="กดเพื่อเรียง"
      sx={{ flexDirection: "column", alignItems: align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start", fontFamily: "inherit",
        px: 1.25, py: 1.1, color: active ? ACCENT : MUTED, "&:hover": { color: active ? ACCENT : INK } }}>
      <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, fontSize: "0.76rem", fontWeight: 800 }}>
        {label}{active && <ArrowDownwardRounded sx={{ fontSize: 14 }} />}
      </Box>
      {sub && <Box component="span" sx={{ fontSize: "0.66rem", fontWeight: 500, color: FAINT }}>{sub}</Box>}
    </ButtonBase>
  );
}
const Head = ({ children, sub, align = "left" }) => (
  <Box sx={{ px: 1.25, py: 1.1, textAlign: align }}>
    <Typography sx={{ fontSize: "0.76rem", fontWeight: 800, color: MUTED, lineHeight: 1.35 }}>{children}</Typography>
    {sub && <Typography sx={{ fontSize: "0.66rem", color: FAINT, lineHeight: 1.3 }}>{sub}</Typography>}
  </Box>
);

/** มูลค่างานที่ทำ — ยังไม่ลงสักครั้ง = "ยังไม่ลง" (ไม่ใช่ ฿0) */
const ValueText = ({ p, size = "1rem" }) => (p.valued
  ? <Typography sx={{ fontSize: size, fontWeight: 900, color: INK, ...NUM }}>{baht(p.total)}</Typography>
  : <Pill tone="slate" sx={{ color: FAINT }}>ยังไม่ลง</Pill>);

/** สถานะข้อมูล + ขาดอะไร */
const DataCell = ({ p, align = "center" }) => (
  <Box sx={{ textAlign: align, minWidth: 0 }}>
    <DataStatus p={p} />
    <IssueChips p={p} justify={align === "center" ? "center" : "flex-start"} />
  </Box>
);

/** อันดับ — 1–3 วงสีฟ้า */
const Rank = ({ n }) => (
  <Box sx={{ width: 26, height: 26, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: "0.78rem", fontWeight: 900, ...NUM,
    ...(n <= 3 ? { bgcolor: n === 1 ? ACCENT : ACCENT_SOFT, color: n === 1 ? "#fff" : ACCENT } : { color: FAINT }) }}>
    {n}
  </Box>
);

const TABLE_LEGEND = "มูลค่างานที่ทำ = ผลรวม \"มูลค่าครั้งนี้\" ที่คนนั้นลงเองทุกงาน (แถบ = เทียบกับคนที่สูงสุด) · เข้างาน = จำนวนงานที่อยู่ในทีม (งานหลายวันนับ 1) · วันทำงาน = รวมวันที่อยู่ในทีม · ต่อวัน = มูลค่าที่ลง ÷ วันของงานที่ลงแล้ว · ความครบของข้อมูล = งานที่ผ่านไปแล้วแต่ยังขาด: ลงมูลค่า · กดเข้างาน · ขอปิดงาน · Service Report · เอกสารงาน PM · สรุปงานที่ทำ";

function KpiTable({ rows, total, team, sortBy, onSort, avatarOf, onPick }) {
  const [boxRef, width] = useElementWidth();
  const wideScreen = useMediaQuery("(min-width:900px)");
  const w = width || (wideScreen ? W_FULL : 0); // ยังไม่ได้วัด = เดาจากจอ (กันกระพริบ)
  const mobile = w < W_MID;
  const mid = !mobile && w < W_FULL;
  const cols = mid ? COLS_MID : COLS;
  const maxTotal = Math.max(1, ...rows.map((p) => (p.valued ? p.total : 0)));

  if (mobile) {
    return (
      <Box ref={boxRef}>
        <Box sx={R_CARD}>
          {rows.map((p, i) => (
            <ButtonBase key={p.name} component="div" onClick={onPick ? () => onPick(p.name) : undefined} disabled={!onPick}
              sx={{ display: "flex", alignItems: "flex-start", gap: 1.25, width: "100%", px: 1.5, py: 1.35, textAlign: "left", fontFamily: "inherit", borderTop: i ? `1px solid ${LINE}` : 0, ...ROW_HOVER }}>
              <Box sx={{ position: "relative", flexShrink: 0 }}>
                <PersonAvatar name={p.name} avatar={avatarOf?.(p.name)} size={40} />
                {i < 3 && <Box sx={{ position: "absolute", right: -4, bottom: -4, boxShadow: "0 0 0 2px #fff", borderRadius: "50%" }}><Rank n={i + 1} /></Box>}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" alignItems="center" gap={1}>
                  <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.95rem", fontWeight: 800, color: INK }}>{p.name}</Typography>
                  <ValueText p={p} />
                </Stack>
                {p.valued > 0 && <Box sx={{ mt: 0.6 }}><ShareBar share={p.total / maxTotal} /></Box>}
                <Typography sx={{ fontSize: "0.74rem", color: "#475569", mt: 0.6 }}>
                  เข้างาน <b>{p.visits}</b> ครั้ง · <b>{p.days}</b> วัน · ลงมูลค่าแล้ว <b style={{ color: p.visits && p.valued >= p.visits ? OK : INK }}>{p.valued}/{p.visits}</b>
                  {p.perDay !== null ? ` · ต่อวัน ${formatKpi("perDay", p.perDay)}` : ""}
                </Typography>
                <Stack direction="row" alignItems="center" gap={0.75} sx={{ mt: 0.6, flexWrap: "wrap" }}>
                  <DataStatus p={p} />
                  <IssueChips p={p} max={4} justify="flex-start" />
                </Stack>
              </Box>
            </ButtonBase>
          ))}
          <Stack direction="row" alignItems="center" sx={{ px: 1.5, py: 1.25, bgcolor: "#f8fafc", borderTop: `1px solid ${LINE}` }}>
            <Typography sx={{ flex: 1, fontSize: "0.86rem", fontWeight: 800, color: INK }}>{total} คน · เข้างานรวม {team.visits} ครั้ง</Typography>
          </Stack>
        </Box>
        <Typography sx={{ mt: 0.75, px: 0.5, fontSize: "0.7rem", color: FAINT, lineHeight: 1.5 }}>{TABLE_LEGEND}</Typography>
      </Box>
    );
  }

  const cell = { px: mid ? 1 : 1.25, py: 1.35, minWidth: 0, display: "flex", alignItems: "center" };
  const right = { ...cell, justifyContent: "flex-end" };
  const center = { ...cell, justifyContent: "center" };
  const num = (v, strong, unit) => (
    <Typography sx={{ fontSize: "0.9rem", fontWeight: strong ? 900 : 700, color: "#334155", ...NUM }}>
      {v}{unit && <Box component="span" sx={{ ml: 0.35, fontSize: "0.68rem", fontWeight: 600, color: FAINT }}>{unit}</Box>}
    </Typography>
  );
  const fill = (done, base, strong) => {
    const c = fillTone(done, base);
    return (
      <Box sx={{ width: "100%", maxWidth: 84, textAlign: "center" }}>
        <Typography sx={{ fontSize: "0.86rem", fontWeight: strong ? 900 : 800, color: c === OK ? OK : c === "#cbd5e1" ? MUTED : INK, ...NUM }}>{done} / {base}</Typography>
        <Box sx={{ mt: 0.4 }}><Bar value={base ? done / base : 0} color={c} height={4} /></Box>
      </Box>
    );
  };
  return (
    <Box ref={boxRef}>
      <Box sx={R_CARD}>
        <Box sx={{ display: "grid", gridTemplateColumns: cols, alignItems: "end", bgcolor: "#f8fafc", borderBottom: `1px solid ${LINE}` }}>
          <Head align="center">อันดับ</Head>
          <Head sub="กดแถวเพื่อดูรายละเอียด">ผู้ปฏิบัติงาน</Head>
          <SortHead label="มูลค่างานที่ทำ" sub="ก่อน VAT" k="total" sortBy={sortBy} onSort={onSort} />
          <Head align="center" sub="งาน">เข้างาน</Head>
          <Head align="center" sub="วัน">วันทำงาน</Head>
          <SortHead label="ต่อวัน" sub="มูลค่า ÷ วัน" k="perDay" sortBy={sortBy} onSort={onSort} />
          {!mid && <Head align="center" sub="ครั้งที่ลง / ทั้งหมด">ลงมูลค่าแล้ว</Head>}
          <SortHead label="ความครบของข้อมูล" sub="สิ่งที่ยังขาด" k="issues" sortBy={sortBy} onSort={onSort} align="center" />
          <Box />
        </Box>
        {rows.map((p, i) => (
          <ButtonBase key={p.name} component="div" onClick={onPick ? () => onPick(p.name) : undefined} disabled={!onPick}
            sx={{ display: "grid", gridTemplateColumns: cols, alignItems: "center", width: "100%", textAlign: "left", fontFamily: "inherit",
              borderTop: i ? `1px solid ${LINE}` : 0, ...ROW_HOVER }}>
            <Box sx={center}><Rank n={i + 1} /></Box>
            <Box sx={{ ...cell, gap: 1.25 }}>
              <PersonAvatar name={p.name} avatar={avatarOf?.(p.name)} size={mid ? 32 : 36} />
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: "0.92rem", fontWeight: 800, color: INK }}>{p.name}</Typography>
                <Typography noWrap sx={{ fontSize: "0.72rem", color: MUTED }}>
                  {p.lead ? <><Box component="span" sx={{ color: ACCENT, fontWeight: 700 }}>หัวหน้าทีม {p.lead} ครั้ง</Box> · </> : ""}{p.last ? `ล่าสุด ${thaiDate(p.last)}` : ""}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ ...right, flexDirection: "column", alignItems: "flex-end", justifyContent: "center", gap: 0.5 }}>
              <ValueText p={p} />
              {p.valued > 0 && <Box sx={{ width: "100%", maxWidth: 110 }}><ShareBar share={p.total / maxTotal} /></Box>}
            </Box>
            <Box sx={center}>{num(p.visits)}</Box>
            <Box sx={center}>{num(p.days)}</Box>
            <Box sx={right}><Typography sx={{ fontSize: "0.9rem", fontWeight: 800, color: p.perDay === null ? FAINT : INK, ...NUM }}>{p.perDay === null ? "—" : formatKpi("perDay", p.perDay)}</Typography></Box>
            {!mid && <Box sx={center}>{fill(p.valued, p.visits)}</Box>}
            <Box sx={center}><DataCell p={p} /></Box>
            <ChevronRightRounded sx={{ fontSize: 18, color: "#cbd5e1" }} />
          </ButtonBase>
        ))}
        <Box sx={{ display: "grid", gridTemplateColumns: cols, alignItems: "center", bgcolor: "#f8fafc", borderTop: `1px solid ${LINE}` }}>
          <Box />
          {/* แถวสรุป — เฉพาะจำนวน (ไม่มียอดเงินรวมทุกคน ตามกติกา "ไม่นำมารวมกัน") */}
          <Box sx={cell}><Typography sx={{ fontSize: "0.86rem", fontWeight: 800, color: INK }}>รวม {total} คน{rows.length < total ? ` (แสดง ${rows.length})` : ""}</Typography></Box>
          <Box sx={right}><Typography sx={{ fontSize: "0.72rem", color: FAINT }}>รายคน ไม่รวมกัน</Typography></Box>
          <Box sx={center}>{num(team.visits, true)}</Box>
          <Box sx={center}>{num(team.days, true)}</Box>
          <Box />
          {!mid && <Box sx={center}>{fill(team.valued, team.visits, true)}</Box>}
          <Box sx={center}><DataCell p={team} /></Box>
          <Box />
        </Box>
      </Box>
      <Typography sx={{ mt: 0.75, px: 0.5, fontSize: "0.72rem", color: FAINT, lineHeight: 1.5 }}>{TABLE_LEGEND}</Typography>
    </Box>
  );
}

// ── รายละเอียดคนเดียว ──────────────────────────────────────────────────────────
/** ช่องตัวเลข — ไอคอนสีพื้นอ่อนบอกความหมาย + ตัวเลขเข้ม */
function BigStat({ icon, color, label, value, sub, empty }) {
  return (
    <Stack direction="row" alignItems="center" gap={1.25} sx={{ px: { xs: 1.25, sm: 1.75 }, py: 1.35, minWidth: 0 }}>
      <IconBadge icon={icon} color={color} />
      <Box sx={{ minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED }}>{label}</Typography>
        {empty
          ? <Typography noWrap sx={{ fontSize: "0.88rem", fontWeight: 700, color: FAINT, lineHeight: 1.6 }}>{empty}</Typography>
          : <Typography noWrap sx={{ fontSize: "1.12rem", fontWeight: 900, color: INK, lineHeight: 1.3, ...NUM }}>{value}</Typography>}
        {sub && <Typography noWrap sx={{ fontSize: "0.68rem", color: FAINT }}>{sub}</Typography>}
      </Box>
    </Stack>
  );
}

const SubTitle = ({ children, right }) => (
  <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1, minHeight: 28 }}>
    <Typography sx={{ flex: 1, fontSize: "0.92rem", fontWeight: 800, color: INK }}>{children}</Typography>
    {right}
  </Stack>
);

const timeOf = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }); };
/** สถานะงานของแถว — คำเดียวกับหน้าการดำเนินงาน */
const jobStateOf = (r) => (r.done ? { text: "เสร็จสิ้น", tone: "ok" } : r.closeRequested ? { text: "รอตรวจปิดงาน", tone: "warn" } : { text: r.status || "—", tone: "slate" });

/** แถวงาน 1 รายการของคนนั้น — วันที่ · งาน · บทบาท/เข้างาน/สถานะ · มูลค่างานที่ทำ · สิ่งที่ต้องแก้ */
function EntryRow({ r, issues, first, onOpen }) {
  const d = r.date ? r.date.split("-") : [];
  const st = jobStateOf(r);
  return (
    <ButtonBase component="div" onClick={onOpen}
      sx={{ display: "flex", alignItems: "flex-start", gap: 1.35, width: "100%", px: 1.5, py: 1.25, textAlign: "left", fontFamily: "inherit",
        borderTop: first ? 0 : `1px solid ${LINE}`, ...ROW_HOVER }}>
      <Box sx={{ width: 50, flexShrink: 0, textAlign: "center", borderRadius: "11px", border: `1px solid ${LINE}`, overflow: "hidden", bgcolor: "#fff" }}>
        <Box sx={{ bgcolor: "#f1f5f9", fontSize: "0.62rem", fontWeight: 800, color: MUTED, py: 0.2 }}>{(() => { const t = r.date ? thaiDate(r.date).split(" ") : []; return t.length > 2 ? `${t[1]} ${String(t[2]).slice(-2)}` : ""; })()}</Box>
        <Box sx={{ fontSize: "1.1rem", fontWeight: 900, color: INK, lineHeight: 1.45 }}>{d[2] ? Number(d[2]) : "-"}</Box>
        {r.days > 1 && <Box sx={{ fontSize: "0.6rem", color: MUTED, pb: 0.2 }}>{r.days} วัน</Box>}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: "0.92rem", fontWeight: 800, color: INK }}>{r.site || r.company || "-"}</Typography>
        <Typography noWrap sx={{ fontSize: "0.76rem", color: "#475569" }}>
          {[r.title, r.system, r.time ? `ครั้งที่ ${r.time}` : "", r.jobNo].filter(Boolean).join(" · ") || "—"}
        </Typography>
        {/* บทบาท · เข้างาน · สถานะ = ข้อความเทาบรรทัดเดียว (สีเฉพาะ ✓ ที่ทำครบแล้ว) */}
        <Typography sx={{ mt: 0.45, fontSize: "0.74rem", color: MUTED, lineHeight: 1.5 }}>
          <Box component="span" sx={{ fontWeight: 700, color: "#334155" }}>{r.lead ? "หัวหน้าทีม" : "ลูกทีม"}</Box>{r.teamSize > 1 ? ` · ทีม ${r.teamSize} คน` : ""}
          {" · "}{r.checkIns?.length
            ? <><Box component="span" sx={{ color: OK, fontWeight: 800 }}>✓</Box> เข้างาน {timeOf(r.checkIns[0])}{r.checkIns.length > 1 ? ` (${r.checkIns.length} วัน)` : ""}</>
            : <Box component="span" sx={{ color: FAINT }}>ไม่มีบันทึกเข้างาน</Box>}
          {" · "}{st.tone === "ok" ? <Box component="span" sx={{ color: OK, fontWeight: 800 }}>✓ {st.text}</Box> : st.text}
        </Typography>
        {issues?.length > 0 && (
          <Stack direction="row" alignItems="center" sx={{ mt: 0.6, flexWrap: "wrap", gap: 0.5 }}>
            <Box component="span" sx={{ height: 21, px: 0.75, borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: 0.35, whiteSpace: "nowrap",
              fontSize: "0.68rem", fontWeight: 800, color: WARN, bgcolor: WARN_SOFT }}>
              <ErrorRounded sx={{ fontSize: 13 }} />ต้องแก้
            </Box>
            {issues.map((t) => (
              <Box key={t} component="span" sx={{ height: 21, px: 0.75, borderRadius: "6px", display: "inline-flex", alignItems: "center", whiteSpace: "nowrap",
                fontSize: "0.68rem", fontWeight: 600, color: "#475569", bgcolor: "#f1f5f9" }}>{t}</Box>
            ))}
          </Stack>
        )}
      </Box>
      <Box sx={{ textAlign: "right", flexShrink: 0, pt: 0.2 }}>
        {r.value === null || r.value === undefined
          ? <Pill tone="slate" sx={{ color: FAINT }}>ยังไม่ลง</Pill>
          : <Typography sx={{ fontSize: "0.98rem", fontWeight: 900, color: INK, ...NUM }}>{baht(r.value)}</Typography>}
        {r.valueLegacy && <Typography sx={{ mt: 0.25, fontSize: "0.66rem", color: FAINT }}>ยอดเดิม</Typography>}
      </Box>
      <ChevronRightRounded sx={{ fontSize: 18, color: "#cbd5e1", mt: 0.25 }} />
    </ButtonBase>
  );
}

/** ปุ่มกรอง — เลือกอยู่ = พื้นสี (ทั้งหมด น้ำเงิน · ต้องแก้ ส้ม) + ตัวเลขในวง */
const FilterPill = ({ active, onClick, children, count, warn }) => {
  const c = ACCENT; // เลือกอยู่ = น้ำเงินเสมอ (สีของตัวที่เลือกทั้งระบบ)
  return (
    <ButtonBase onClick={onClick} sx={{ height: 30, pl: 1.25, pr: 0.6, gap: 0.6, borderRadius: 99, fontFamily: "inherit", fontSize: "0.76rem", fontWeight: 800,
      color: active ? "#fff" : "#475569", bgcolor: active ? c : "#fff", border: `1px solid ${active ? c : LINE}`, transition: "background-color .15s ease, border-color .15s ease",
      "&:hover": { borderColor: c } }}>
      {children}
      <Box component="span" sx={{ minWidth: 20, height: 20, px: 0.5, borderRadius: 99, display: "inline-grid", placeItems: "center", fontSize: "0.68rem", fontWeight: 900, ...NUM,
        bgcolor: active ? "rgba(255,255,255,.25)" : (warn && count ? WARN_SOFT : "#f1f5f9"), color: active ? "#fff" : (warn && count ? WARN : "#475569") }}>{count}</Box>
    </ButtonBase>
  );
};

/**
 * แผงรายละเอียดของ 1 คน
 * @param entries        แถวงานของคนนี้ (ช่วงที่เลือก) — แสดงรายการงานละเอียด
 * @param defaultFilter  "all" | "issues" — รายการที่เปิดมาก่อน
 * @param months         แนวโน้มรายเดือน (แสดงเมื่อมีมากกว่า 1 เดือน)
 */
function PersonDetail({ p, avatar, teamSize, onOpenJob, months, entries = [], defaultFilter = "all" }) {
  // ปัญหาของแต่ละงาน (id แถว → ป้าย) — งานเดียวมีได้หลายปัญหา รวมไว้แถวเดียว
  const issuesById = useMemo(() => {
    const m = new Map();
    p.issueList.filter((x) => x.key !== "legacy").forEach((x) => x.entries.forEach((r) => {
      m.set(r.id, [...(m.get(r.id) || []), ISSUE_DEFS[x.key].label]);
    }));
    return m;
  }, [p]);
  const sorted = useMemo(() => entries.slice().sort((a, b) => b.date.localeCompare(a.date)), [entries]);
  const issueRows = sorted.filter((r) => issuesById.has(r.id));
  const [filter, setFilter] = useState(defaultFilter === "issues" && issueRows.length ? "issues" : "all");
  const [showAll, setShowAll] = useState(false);
  const list = filter === "issues" ? issueRows : sorted;
  const shown = showAll ? list : list.slice(0, 8);
  // 🔁 (17 พ.ย. 2569 ผู้ใช้: "จัดให้ดูง่าย ลงตัว สวยงามกว่านี้") จัดตามความกว้างจริงของกล่อง
  //    กว้าง = คอลัมน์ซ้ายแคบ (ความครบของข้อมูล) · ขวากว้าง (งานที่เข้า)
  const [boxRef, boxW] = useElementWidth();
  const wide = boxW >= 900;
  const statCols = boxW && boxW < 620 ? 2 : 4;
  const fillC = fillTone(p.valued, p.visits);

  return (
    <Box ref={boxRef} sx={R_CARD}>
      {/* หัว: คน + ยอดใหญ่ — พื้นฟ้าอ่อนไล่ขาว (ชุดเดียวกับกล่องเด่นในหน้าสรุปมูลค่า) */}
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} gap={1.5}
        sx={{ px: { xs: 1.5, sm: 2.25 }, py: 2, background: `linear-gradient(135deg, ${ACCENT_SOFT} 0%, #ffffff 72%)`, borderBottom: `1px solid ${LINE}` }}>
        <Stack direction="row" alignItems="center" gap={1.5} sx={{ flex: 1, minWidth: 0 }}>
          <PersonAvatar name={p.name} avatar={avatar} size={56} />
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: "1.2rem", fontWeight: 900, color: INK }}>{p.name}</Typography>
            <Typography noWrap sx={{ fontSize: "0.78rem", color: MUTED }}>
              {p.jobs} งาน · <Box component="span" sx={{ color: ACCENT, fontWeight: 700 }}>หัวหน้าทีม {p.lead} ครั้ง</Box>{p.last ? ` · เข้างานล่าสุด ${thaiDate(p.last)}` : ""}
            </Typography>
          </Box>
        </Stack>
        <Box sx={{ textAlign: { xs: "left", sm: "right" }, flexShrink: 0, px: { xs: 1.5, sm: 0 }, py: { xs: 1.1, sm: 0 }, borderRadius: { xs: 2.5, sm: 0 }, bgcolor: { xs: "rgba(255,255,255,.7)", sm: "transparent" } }}>
          <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: MUTED }}>มูลค่างานที่ทำ (ก่อน VAT)</Typography>
          <Typography sx={{ fontSize: { xs: "1.55rem", sm: "1.8rem" }, fontWeight: 900, color: INK, lineHeight: 1.15, ...NUM }}>{p.valued ? baht(p.total) : <Box component="span" sx={{ fontSize: "1.1rem", color: FAINT }}>ยังไม่ลง</Box>}</Typography>
          <Stack direction="row" alignItems="center" gap={0.75} sx={{ mt: 0.6, justifyContent: { xs: "flex-start", sm: "flex-end" } }}>
            <Box sx={{ width: 90 }}><Bar value={p.visits ? p.valued / p.visits : 0} color={fillC} height={5} /></Box>
            <Typography sx={{ fontSize: "0.72rem", color: MUTED, ...NUM }}>ลงมูลค่าแล้ว <b style={{ color: fillC === "#cbd5e1" ? MUTED : fillC }}>{p.valued}/{p.visits}</b> ครั้ง</Typography>
          </Stack>
        </Box>
      </Stack>

      {/* ตัวเลขหลัก 4 ช่อง — ไอคอนสีบอกความหมาย */}
      <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${statCols}, minmax(0, 1fr))`, borderBottom: `1px solid ${LINE}`,
        "& > *": { borderLeft: `1px solid ${LINE}` }, [`& > *:nth-of-type(${statCols}n+1)`]: { borderLeft: 0 },
        ...(statCols === 2 ? { "& > *:nth-of-type(n+3)": { borderTop: `1px solid ${LINE}` } } : {}) }}>
        <BigStat icon={EventAvailableRounded} color={ACCENT} label="เข้างาน" value={`${p.visits} ครั้ง`} sub={p.upcoming ? `ยังไม่ถึงวัน/กำลังทำ ${p.upcoming}` : `ผ่านไปแล้ว ${p.past} ครั้ง`} />
        <BigStat icon={CalendarMonthRounded} color={ACCENT} label="วันทำงาน" value={`${p.days} วัน`} sub={p.visits ? `เฉลี่ย ${(p.days / p.visits).toFixed(1)} วัน/ครั้ง` : undefined} />
        <BigStat icon={InsightsRounded} color={ACCENT} label="เฉลี่ยต่อครั้ง" value={formatKpi("avgPerVisit", p.avgPerVisit)} empty={p.avgPerVisit === null ? "ยังไม่มียอด" : null}
          sub={p.valued ? `คิดจาก ${p.valued} ครั้งที่ลงแล้ว` : "ลงมูลค่าแล้วจึงคำนวณได้"} />
        <BigStat icon={PaymentsRounded} color={ACCENT} label="มูลค่าต่อวันทำงาน" value={formatKpi("perDay", p.perDay)} empty={p.perDay === null ? "ยังไม่มียอด" : null}
          sub={p.valuedDays ? `คิดจาก ${p.valuedDays} วันที่ลงแล้ว` : undefined} />
      </Box>

      <Box sx={{ display: "grid", gap: wide ? 3 : 2.25, px: { xs: 1.5, sm: 2 }, py: 2, gridTemplateColumns: wide ? "minmax(300px, 380px) minmax(0, 1fr)" : "1fr" }}>
        {/* ความครบของข้อมูล — แถบความคืบหน้าสีตามเป้า */}
        <Box>
          <SubTitle right={<DataStatus p={p} size="lg" />}>ความครบของข้อมูล</SubTitle>
          {/* 🔁 (17 พ.ย. 2569 ผู้ใช้: "ความครบของข้อมูลควรมีมากกว่านี้ ให้สมบูรณ์") 2 กลุ่ม: ของคนนี้ · ของงานที่อยู่ในทีม */}
          {[["self", "ของคนนี้"], ["job", "ของงานที่อยู่ในทีม (รับผิดชอบร่วมกัน)"]].map(([scope, title]) => (
            <Box key={scope} sx={{ mb: 1.25 }}>
              <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, color: FAINT, mb: 0.6, px: 0.25, letterSpacing: ".02em" }}>{title}</Typography>
              <Box sx={{ borderRadius: "12px", border: `1px solid ${LINE}`, overflow: "hidden" }}>
                {RATE_KPIS.filter((d) => d.scope === scope).map((d, i) => {
                  const done = p[d.num] || 0;
                  const base = p[d.base] || 0;
                  const pct = base ? Math.round((done / base) * 100) : 0;
                  const hit = base > 0 && pct >= d.good;
                  const full = base > 0 && done === base;
                  const c = !base ? FAINT : hit ? OK : ACCENT; // ถึงเป้า = เขียว · ยังไม่ถึง = น้ำเงิน (สถานะดูจากไอคอนหน้าแถว)
                  return (
                    <Box key={d.key} title={d.desc} sx={{ px: 1.35, py: 1.05, borderTop: i ? `1px solid ${LINE}` : 0 }}>
                      <Stack direction="row" alignItems="center" gap={1}>
                        {!base ? <CheckCircleRounded sx={{ fontSize: 18, color: "#e2e8f0" }} />
                          : full || hit ? <CheckCircleRounded sx={{ fontSize: 18, color: OK }} /> : <ErrorRounded sx={{ fontSize: 18, color: "#f59e0b" }} />}
                        <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.86rem", fontWeight: 700, color: "#334155" }}>{d.label}</Typography>
                        {base > 0
                          ? <Typography sx={{ fontSize: "0.92rem", fontWeight: 900, color: hit ? OK : INK, ...NUM }}>{pct}%</Typography>
                          : <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>ไม่มีงานที่ต้องนับ</Typography>}
                      </Stack>
                      {base > 0 && (
                        <Box sx={{ pl: 3.25, mt: 0.6 }}>
                          <Box sx={{ position: "relative" }}>
                            <Bar value={done / base} color={c} height={6} />
                            {/* เส้นเป้า */}
                            <Box title={`เป้า ${d.good}%`} sx={{ position: "absolute", top: -2, bottom: -2, left: `${d.good}%`, width: 2, borderRadius: 1, bgcolor: alpha(INK, 0.25) }} />
                          </Box>
                          <Stack direction="row" sx={{ mt: 0.4 }}>
                            <Typography sx={{ flex: 1, fontSize: "0.68rem", color: FAINT, ...NUM }}>{done} / {base} ครั้ง</Typography>
                            <Typography sx={{ fontSize: "0.68rem", color: FAINT }}>เป้า ≥{d.good}%{d.key === "docsRate" ? " · เฉพาะงาน PM" : ""}</Typography>
                          </Stack>
                        </Box>
                      )}
                      {d.key === "doneRate" && p.pastPending > 0 && (
                        <Typography sx={{ pl: 3.25, mt: 0.25, fontSize: "0.7rem", color: MUTED }}>รวมรอแอดมินตรวจปิด {p.pastPending} ครั้ง</Typography>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          ))}
          <Typography sx={{ mt: 0.25, fontSize: "0.72rem", color: FAINT, lineHeight: 1.5 }}>
            นับเฉพาะงานที่ผ่านไปแล้ว ({p.past} ครั้ง) — งานที่ยังไม่ถึงวันไม่นับว่าขาด · เส้นเทาในแถบ = เป้า · ชี้ที่แต่ละข้อเพื่อดูความหมาย
          </Typography>

          {months?.length > 1 && (
            <Box sx={{ mt: 2 }}>
              <SubTitle>แนวโน้มรายเดือน</SubTitle>
              <Box sx={{ borderRadius: "12px", border: `1px solid ${LINE}`, overflow: "hidden" }}>
                {months.map((m, i) => {
                  const max = Math.max(1, ...months.map((x) => x.total));
                  return (
                    <Stack key={m.key} direction="row" alignItems="center" gap={1.25} sx={{ px: 1.35, py: 0.95, borderTop: i ? `1px solid ${LINE}` : 0 }}>
                      <Typography sx={{ width: 64, flexShrink: 0, fontSize: "0.78rem", fontWeight: 700, color: "#334155" }}>{monthLabel(m.key)}</Typography>
                      <Box sx={{ flex: 1 }}><Bar value={m.total / max} color={ACCENT} height={6} /></Box>
                      <Typography sx={{ width: 44, textAlign: "right", fontSize: "0.72rem", color: MUTED, ...NUM }}>{m.visits} ครั้ง</Typography>
                      <Typography sx={{ width: 84, textAlign: "right", fontSize: "0.84rem", fontWeight: 800, color: INK, ...NUM }}>{baht(m.total)}</Typography>
                    </Stack>
                  );
                })}
              </Box>
            </Box>
          )}
        </Box>

        {/* รายการงานของคนนี้ */}
        <Box sx={{ minWidth: 0 }}>
          <SubTitle right={(
            <Stack direction="row" gap={0.75}>
              <FilterPill active={filter === "all"} count={sorted.length} onClick={() => { setFilter("all"); setShowAll(false); }}>ทั้งหมด</FilterPill>
              <FilterPill warn active={filter === "issues"} count={issueRows.length} onClick={() => { setFilter("issues"); setShowAll(false); }}>ต้องแก้</FilterPill>
            </Stack>
          )}>
            งานที่เข้า
          </SubTitle>
          {!list.length ? (
            <Stack direction="row" alignItems="center" gap={1} sx={{ px: 1.5, py: 1.5, borderRadius: "12px", bgcolor: OK_SOFT, border: `1px solid ${alpha(OK, 0.18)}`, color: OK }}>
              <CheckCircleRounded sx={{ fontSize: 18 }} />
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 800 }}>{filter === "issues" ? "ไม่มีงานที่ต้องแก้ — ข้อมูลครบ ใช้ประเมินได้" : "ไม่มีงานในช่วงนี้"}</Typography>
            </Stack>
          ) : (
            <Box sx={{ borderRadius: "12px", border: `1px solid ${LINE}`, overflow: "hidden" }}>
              {shown.map((r, i) => (
                <EntryRow key={r.id} r={r} issues={issuesById.get(r.id)} first={i === 0} onOpen={() => onOpenJob?.(r.eventId)} />
              ))}
              {list.length > 8 && (
                <Button fullWidth size="small" onClick={() => setShowAll((v) => !v)}
                  sx={{ height: 40, borderTop: `1px solid ${LINE}`, borderRadius: 0, textTransform: "none", fontWeight: 800, color: ACCENT, bgcolor: "#fbfdff", "&:hover": { bgcolor: ACCENT_SOFT } }}>
                  {showAll ? "แสดงน้อยลง" : `ดูทั้งหมด ${list.length} งาน`}
                </Button>
              )}
            </Box>
          )}
          <Typography sx={{ mt: 0.75, fontSize: "0.72rem", color: FAINT }}>กดงานเพื่อเปิดดู/แก้ไข · มูลค่าในรายการ = มูลค่างานที่คนนี้ทำ (ก่อน VAT)</Typography>
        </Box>
      </Box>
    </Box>
  );
}

// ── คู่มือ ────────────────────────────────────────────────────────────────────
/** คู่มือวิธีเช็ค KPI — 4 ข้อ + ความหมายของตัวเลข (พับไว้ ไม่กินที่) */
export function KpiGuide({ defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Box sx={{ ...R_CARD, mb: { xs: 2.5, sm: 3 } }}>
      <ButtonBase onClick={() => setOpen((v) => !v)} sx={{ display: "flex", alignItems: "center", gap: 1.25, width: "100%", px: 1.75, py: 1.25, textAlign: "left", fontFamily: "inherit", ...ROW_HOVER }}>
        <MenuBookRounded sx={{ fontSize: 20, color: MUTED }} />
        <Typography sx={{ flex: 1, fontSize: "0.92rem", fontWeight: 800, color: INK }}>วิธีเช็ค KPI ช่าง (4 ข้อ)</Typography>
        <ExpandMoreRounded sx={{ color: MUTED, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
      </ButtonBase>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ px: 1.75, pb: 1.75, display: "grid", gap: { xs: 2, md: 3 }, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
          <Stack spacing={1.25}>
            {KPI_GUIDE.map((g, i) => (
              <Stack key={g.title} direction="row" gap={1.1}>
                <Box sx={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", bgcolor: "#f1f5f9", color: INK, fontSize: "0.74rem", fontWeight: 900 }}>{i + 1}</Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.86rem", fontWeight: 800, color: INK }}>{g.title}</Typography>
                  <Typography sx={{ fontSize: "0.8rem", color: "#475569", lineHeight: 1.55 }}>{g.text}</Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
          <Box>
            <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: MUTED, mb: 0.75 }}>ตัวเลขแต่ละตัวหมายถึง</Typography>
            <Stack spacing={0.75}>
              {KPI_DEFS.filter((d) => d.key !== "leadRate").map((d) => (
                <Typography key={d.key} sx={{ fontSize: "0.8rem", color: "#475569", lineHeight: 1.5 }}>
                  <b style={{ color: INK }}>{d.label}</b>{d.good !== undefined ? ` (เป้า ${d.good}%)` : ""} — {d.desc}
                </Typography>
              ))}
            </Stack>
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}

/**
 * @param entries        แถว "คน × งาน" ที่กรองแล้ว
 * @param avatarOf       (name) → url รูป
 * @param activePerson   ชื่อที่เลือกอยู่ ("all" = ทุกคน)
 * @param onPickPerson   (name) → กรองเฉพาะคนนั้น · ไม่ส่ง = กดไม่ได้ (ช่างดูของตัวเอง)
 * @param onOpenJob      (eventId) → เปิดรายละเอียดงาน
 */
export default function WorkerKpiPanel({ entries, avatarOf, activePerson = "all", onPickPerson, onOpenJob }) {
  const { people, team } = useMemo(() => buildPersonKpis(entries), [entries]);
  const [sortBy, setSortBy] = useState("total");
  const [showAll, setShowAll] = useState(false);
  const [openName, setOpenName] = useState(null);
  const list = useMemo(() => sortPeople(people, sortBy), [people, sortBy]);
  const openP = openName ? people.find((x) => x.name === openName) : null;
  // รายเดือนของคนที่เปิดอยู่ (ล่าสุดก่อน · 6 เดือน)
  const openEntries = useMemo(() => (openName ? entries.filter((r) => r.name === openName) : []), [entries, openName]);
  const openMonths = useMemo(() => {
    if (!openName) return [];
    const m = new Map();
    openEntries.forEach((r) => {
      const k = r.date.slice(0, 7);
      const x = m.get(k) || { key: k, total: 0, visits: 0 };
      x.visits += 1; x.total += r.value || 0;
      m.set(k, x);
    });
    return [...m.values()].sort((a, b) => b.key.localeCompare(a.key)).slice(0, 6);
  }, [openEntries, openName]);
  if (!people.length) return null;
  const multi = people.length > 1;
  const shown = showAll ? list : list.slice(0, SHOW_FIRST_ROWS);

  return (
    <ReportSection title={multi ? "ยอดแยกรายคน" : `ผลงานของ ${people[0].name}`}
      hint={multi ? "มูลค่างานที่แต่ละคนทำ (ก่อน VAT) · กดแถวเพื่อดูรายละเอียดของคนนั้น" : "มูลค่างานที่ทำ (ก่อน VAT) · ความครบของข้อมูล · งานที่ต้องแก้"}
      right={!multi && onPickPerson && activePerson !== "all" ? (
        <Button size="small" variant="outlined" onClick={() => onPickPerson("all")} sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2 }}>‹ ดูทุกคน</Button>
      ) : null}>
      {multi && team.issueCount > 0 && (
        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.25, px: 1.5, py: 1, borderRadius: "12px", border: `1px solid ${WARN_LINE}`, bgcolor: WARN_SOFT }}>
          <ReportProblemRounded sx={{ fontSize: 19, color: "#d97706" }} />
          <Typography sx={{ fontSize: "0.82rem", color: "#78350f" }}>
            ยังมีงานที่ข้อมูลไม่ครบ <b>{team.issueCount}</b> รายการ — ยอดของบางคนอาจต่ำกว่าจริง ดูคอลัมน์ "ความครบของข้อมูล"
          </Typography>
        </Stack>
      )}
      <Box key={multi ? "all" : people[0].name} sx={FADE_IN}>
      {multi ? (
        <>
          <KpiTable rows={shown} total={people.length} team={team} sortBy={sortBy} onSort={setSortBy} avatarOf={avatarOf} onPick={setOpenName} />
          {list.length > SHOW_FIRST_ROWS && (
            <Button fullWidth onClick={() => setShowAll((v) => !v)} sx={{ mt: 1, textTransform: "none", fontWeight: 800, borderRadius: 2 }}>
              {showAll ? "แสดงน้อยลง" : `ดูทั้งหมด ${list.length} คน`}
            </Button>
          )}
        </>
      ) : (
        <PersonDetail p={people[0]} avatar={avatarOf?.(people[0].name)} teamSize={1} onOpenJob={onOpenJob}
          entries={entries} />
      )}
      </Box>

      {/* แผงรายละเอียดที่เด้งขึ้นเมื่อกดแถว */}
      <MobileSheet open={Boolean(openP)} onClose={() => setOpenName(null)} maxWidth="lg"
        title="ผลงานรายบุคคล" subtitle="มูลค่างานที่ทำ · ความครบของข้อมูล · งานที่เข้าทั้งหมด"
        footer={openP ? (
          <Stack direction="row" gap={1} justifyContent="flex-end">
            {onPickPerson && (
              <Button variant="outlined" onClick={() => { onPickPerson(openP.name); setOpenName(null); }}
                sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2 }}>ดูทั้งหน้าเฉพาะ {openP.name}</Button>
            )}
            <Button variant="contained" disableElevation onClick={() => setOpenName(null)}
              sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, minWidth: 96 }}>ปิด</Button>
          </Stack>
        ) : null}>
        {openP && (
          <Box sx={{ p: { xs: 1.25, sm: 2 } }}>
            <PersonDetail key={openP.name} p={openP} avatar={avatarOf?.(openP.name)} teamSize={people.length} onOpenJob={onOpenJob}
              months={openMonths} entries={openEntries} />
          </Box>
        )}
      </MobileSheet>
    </ReportSection>
  );
}
