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
import { CheckCircleRounded, ErrorRounded, MenuBookRounded, ExpandMoreRounded, ChevronRightRounded, ArrowDownwardRounded } from "@mui/icons-material";
import { INK, MUTED, LINE, ACCENT } from "@/shared/ui/PageKit";
import { thaiDate } from "@/shared/utils/thaiDate";
import { ReportSection, PersonAvatar, R_CARD, baht } from "./ReportKit";
import MobileSheet from "@/shared/ui/MobileSheet";
import useElementWidth from "@/shared/hooks/useElementWidth";
import { monthLabel } from "../utils/reportPeriod";
import { buildPersonKpis, sortPeople, formatKpi, RATE_KPIS, KPI_DEFS, KPI_GUIDE, ISSUE_DEFS } from "../utils/workerKpi";

const OK = "#15803d";
const WARN = "#b45309";
const FAINT = "#94a3b8";
const SHOW_FIRST_ROWS = 15;
const NUM = { fontVariantNumeric: "tabular-nums" };
// 🔁 (17 พ.ย. 2569 ผู้ใช้: "ขยายให้เต็ม · ทำให้สมูทดูดีกว่านี้") เปลี่ยนคน/มุมมอง = ค่อยๆ ปรากฏ · แถว hover นุ่ม
const FADE_IN = { "@keyframes kpiIn": { from: { opacity: 0, transform: "translateY(6px)" }, to: { opacity: 1, transform: "none" } }, animation: "kpiIn .28s ease-out" };
const ROW_HOVER = { transition: "background-color .15s ease", "&:hover": { bgcolor: "#f8fafc" } };

/** สถานะข้อมูลของคน — ใช้ทั้งตารางและแผงรายละเอียด (จุดเดียวที่มีสี) */
function DataStatus({ p, size = "sm" }) {
  const big = size === "lg";
  if (!p.past) return <Typography component="span" sx={{ fontSize: big ? "0.84rem" : "0.78rem", color: FAINT }}>ยังไม่มีงานที่ผ่านไป</Typography>;
  const ok = p.issueCount === 0;
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: big ? 1.1 : 0.9, py: big ? 0.35 : 0.2, borderRadius: 99,
      bgcolor: alpha(ok ? OK : WARN, 0.09), color: ok ? OK : WARN, fontSize: big ? "0.82rem" : "0.76rem", fontWeight: 800, whiteSpace: "nowrap" }}>
      {ok ? <CheckCircleRounded sx={{ fontSize: big ? 17 : 15 }} /> : <ErrorRounded sx={{ fontSize: big ? 17 : 15 }} />}
      {ok ? "ครบ" : `ต้องแก้ ${p.issueCount}`}
    </Box>
  );
}

/** แถบสัดส่วน — สีเดียว อ่อน ไม่แย่งสายตาจากตัวเลข */
const ShareBar = ({ share }) => (
  <Box sx={{ height: 5, borderRadius: 3, bgcolor: "#eef2f7", overflow: "hidden" }}>
    <Box sx={{ width: `${Math.round((share || 0) * 100)}%`, height: "100%", bgcolor: alpha(ACCENT, 0.55), borderRadius: 3, transition: "width .4s ease" }} />
  </Box>
);

// ── ตารางเทียบทุกคน ────────────────────────────────────────────────────────────
// 🔁 (17 พ.ย. 2569 ผู้ใช้: "รองรับทุกขนาดหน้าจอ") เลือกรูปตาม "ความกว้างของกล่องจริง" (useElementWidth) ไม่ใช่ความกว้างจอ
// 🔁 (17 พ.ย. 2569 ผู้ใช้: "ข้อมูลตรงนี้ยังดูงง ไม่เข้าใจว่าแต่ละแถวคืออะไร")
//    • หัวคอลัมน์ 2 บรรทัด: ชื่อ + หน่วย/ความหมายสั้นๆ · แยก "เข้างาน" กับ "วันทำงาน" คนละคอลัมน์ (เดิม "2 / 5" ไม่รู้ว่าอะไร)
//    • ยังไม่ลงมูลค่าเลย = "ยังไม่ลง" (ไม่ใช่ ฿0 ที่ดูเหมือนทำงานได้ศูนย์บาท) · เพิ่มคอลัมน์ "ลงมูลค่าแล้ว x/y"
//    • ความครบของข้อมูล บอกว่าขาดอะไรกี่รายการ (ไม่ลงมูลค่า / ไม่กดเข้างาน / ไม่ขอปิด) · คำอธิบายทุกคอลัมน์ใต้ตาราง
//    ≥1180 = ครบทุกคอลัมน์ · 760–1179 = ตัดสัดส่วน/ลงมูลค่าแล้ว · <760 = รายการย่อ
// 🔁 (17 พ.ย. 2569 ผู้ใช้: "ยอดที่ลงไม่นำมารวมกัน แยกเป็นผลงานของแต่ละคน") ตัดสัดส่วนในทีม/ยอดรวมทุกคนออก — แสดงรายคนอย่างเดียว
const COLS = "40px minmax(170px, 1fr) 132px 78px 86px 120px 112px 196px 20px";
const COLS_MID = "34px minmax(150px, 1fr) 118px 66px 74px 108px 180px 18px";
const W_FULL = 1060;
const W_MID = 760;

/** ขาดอะไรบ้าง — ข้อความสั้นใต้ป้ายสถานะ */
const BRIEF = [["missingValue", "ไม่ลงมูลค่า"], ["noCheckIn", "ไม่กดเข้างาน"], ["notClosed", "ไม่ขอปิด"], ["noReport", "ไม่มี Report"], ["docsIncomplete", "เอกสาร PM"], ["noSummary", "ไม่มีสรุปงาน"]];
const issueBrief = (p) => BRIEF.map(([k, label]) => (p.issues?.[k]?.length ? `${label} ${p.issues[k].length}` : "")).filter(Boolean).join(" · ");

function SortHead({ label, sub, k, sortBy, onSort, align = "right" }) {
  const active = sortBy === k;
  return (
    <ButtonBase onClick={() => onSort(k)} title="กดเพื่อเรียง"
      sx={{ flexDirection: "column", alignItems: align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start", fontFamily: "inherit",
        px: 1.25, py: 1, color: active ? INK : MUTED, "&:hover": { color: INK } }}>
      <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, fontSize: "0.76rem", fontWeight: 800 }}>
        {label}{active && <ArrowDownwardRounded sx={{ fontSize: 14 }} />}
      </Box>
      {sub && <Box component="span" sx={{ fontSize: "0.66rem", fontWeight: 500, color: FAINT }}>{sub}</Box>}
    </ButtonBase>
  );
}
const Head = ({ children, sub, align = "left" }) => (
  <Box sx={{ px: 1.25, py: 1, textAlign: align }}>
    <Typography sx={{ fontSize: "0.76rem", fontWeight: 800, color: MUTED, lineHeight: 1.35 }}>{children}</Typography>
    {sub && <Typography sx={{ fontSize: "0.66rem", color: FAINT, lineHeight: 1.3 }}>{sub}</Typography>}
  </Box>
);

/** มูลค่างานที่ทำ — ยังไม่ลงสักครั้ง = "ยังไม่ลง" (ไม่ใช่ ฿0) */
const ValueText = ({ p, size = "1rem" }) => (p.valued
  ? <Typography sx={{ fontSize: size, fontWeight: 900, color: INK, ...NUM }}>{baht(p.total)}</Typography>
  : <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: FAINT }}>ยังไม่ลง</Typography>);

/** สถานะข้อมูล + ขาดอะไร */
const DataCell = ({ p, align = "center" }) => (
  <Box sx={{ textAlign: align, minWidth: 0 }}>
    <DataStatus p={p} />
    {p.issueCount > 0 && <Typography noWrap sx={{ mt: 0.3, fontSize: "0.68rem", color: MUTED }}>{issueBrief(p)}</Typography>}
  </Box>
);

const TABLE_LEGEND = "มูลค่างานที่ทำ = ผลรวม \"มูลค่าครั้งนี้\" ที่คนนั้นลงเองทุกงาน · เข้างาน = จำนวนงานที่อยู่ในทีม (งานหลายวันนับ 1) · วันทำงาน = รวมวันที่อยู่ในทีม · ต่อวัน = มูลค่าที่ลง ÷ วันของงานที่ลงแล้ว · ความครบของข้อมูล = งานที่ผ่านไปแล้วแต่ยังขาด: ลงมูลค่า · กดเข้างาน · ขอปิดงาน · Service Report · เอกสารงาน PM · สรุปงานที่ทำ";

function KpiTable({ rows, total, team, sortBy, onSort, avatarOf, onPick }) {
  const [boxRef, width] = useElementWidth();
  const wideScreen = useMediaQuery("(min-width:900px)");
  const w = width || (wideScreen ? W_FULL : 0); // ยังไม่ได้วัด = เดาจากจอ (กันกระพริบ)
  const mobile = w < W_MID;
  const mid = !mobile && w < W_FULL;
  const cols = mid ? COLS_MID : COLS;

  if (mobile) {
    return (
      <Box ref={boxRef}>
        <Box sx={R_CARD}>
          {rows.map((p, i) => (
            <ButtonBase key={p.name} component="div" onClick={onPick ? () => onPick(p.name) : undefined} disabled={!onPick}
              sx={{ display: "flex", alignItems: "flex-start", gap: 1.25, width: "100%", px: 1.5, py: 1.25, textAlign: "left", fontFamily: "inherit", borderTop: i ? `1px solid ${LINE}` : 0, ...ROW_HOVER }}>
              <PersonAvatar name={p.name} avatar={avatarOf?.(p.name)} size={38} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" alignItems="baseline" gap={1}>
                  <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.95rem", fontWeight: 800, color: INK }}>{p.name}</Typography>
                  <ValueText p={p} />
                </Stack>
                <Typography sx={{ fontSize: "0.74rem", color: "#475569", mt: 0.4 }}>
                  เข้างาน {p.visits} ครั้ง · {p.days} วัน · บันทึกมูลค่าแล้ว {p.valued}/{p.visits}{p.perDay !== null ? ` · ต่อวัน ${formatKpi("perDay", p.perDay)}` : ""}
                </Typography>
                <Stack direction="row" alignItems="center" gap={0.75} sx={{ mt: 0.5, flexWrap: "wrap" }}>
                  <DataStatus p={p} />
                  {p.issueCount > 0 && <Typography sx={{ fontSize: "0.7rem", color: MUTED }}>{issueBrief(p)}</Typography>}
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

  const cell = { px: mid ? 1 : 1.25, py: 1.25, minWidth: 0, display: "flex", alignItems: "center" };
  const right = { ...cell, justifyContent: "flex-end" };
  const center = { ...cell, justifyContent: "center" };
  const num = (v, strong) => <Typography sx={{ fontSize: "0.88rem", fontWeight: strong ? 800 : 600, color: "#334155", ...NUM }}>{v}</Typography>;
  return (
    <Box ref={boxRef}>
      <Box sx={R_CARD}>
        <Box sx={{ display: "grid", gridTemplateColumns: cols, alignItems: "end", bgcolor: "#f8fafc", borderBottom: `1px solid ${LINE}` }}>
          <Head align="center">#</Head>
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
            <Box sx={center}><Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: FAINT }}>{i + 1}</Typography></Box>
            <Box sx={{ ...cell, gap: 1.25 }}>
              <PersonAvatar name={p.name} avatar={avatarOf?.(p.name)} size={mid ? 30 : 34} />
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: "0.92rem", fontWeight: 800, color: INK }}>{p.name}</Typography>
                <Typography noWrap sx={{ fontSize: "0.72rem", color: MUTED }}>
                  {p.lead ? `หัวหน้าทีม ${p.lead} ครั้ง · ` : ""}{p.last ? `ล่าสุด ${thaiDate(p.last)}` : ""}
                </Typography>
              </Box>
            </Box>
            <Box sx={right}><ValueText p={p} /></Box>
            <Box sx={center}>{num(p.visits)}</Box>
            <Box sx={center}>{num(p.days)}</Box>
            <Box sx={right}><Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: p.perDay === null ? FAINT : INK, ...NUM }}>{p.perDay === null ? "—" : formatKpi("perDay", p.perDay)}</Typography></Box>
            {!mid && <Box sx={center}>{num(`${p.valued} / ${p.visits}`)}</Box>}
            <Box sx={center}><DataCell p={p} /></Box>
            <ChevronRightRounded sx={{ fontSize: 18, color: "#cbd5e1" }} />
          </ButtonBase>
        ))}
        <Box sx={{ display: "grid", gridTemplateColumns: cols, alignItems: "center", bgcolor: "#f8fafc", borderTop: `1px solid ${LINE}` }}>
          <Box />
          {/* แถวสรุป — เฉพาะจำนวน (ไม่มียอดเงินรวมทุกคน ตามกติกา "ไม่นำมารวมกัน") */}
          <Box sx={cell}><Typography sx={{ fontSize: "0.86rem", fontWeight: 800, color: INK }}>{total} คน{rows.length < total ? ` (แสดง ${rows.length})` : ""}</Typography></Box>
          <Box sx={right}><Typography sx={{ fontSize: "0.72rem", color: FAINT }}>รายคน ไม่รวมกัน</Typography></Box>
          <Box sx={center}>{num(team.visits, true)}</Box>
          <Box sx={center}>{num(team.days, true)}</Box>
          <Box />
          {!mid && <Box sx={center}>{num(`${team.valued} / ${team.visits}`, true)}</Box>}
          <Box sx={center}><DataCell p={team} /></Box>
          <Box />
        </Box>
      </Box>
      <Typography sx={{ mt: 0.75, px: 0.5, fontSize: "0.72rem", color: FAINT, lineHeight: 1.5 }}>{TABLE_LEGEND}</Typography>
    </Box>
  );
}

// ── รายละเอียดคนเดียว ──────────────────────────────────────────────────────────
/** ช่องตัวเลขในแถบสถิติ (แถบเดียวคั่นเส้น — ไม่เป็นกล่องลอยหลายใบ) */
function BigStat({ label, value, sub, empty }) {
  return (
    <Box sx={{ px: { xs: 1.5, sm: 2 }, py: 1.25, minWidth: 0 }}>
      <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: MUTED }}>{label}</Typography>
      {empty
        ? <Typography noWrap sx={{ fontSize: "0.9rem", fontWeight: 700, color: FAINT, lineHeight: 1.75 }}>{empty}</Typography>
        : <Typography noWrap sx={{ fontSize: "1.15rem", fontWeight: 900, color: INK, ...NUM }}>{value}</Typography>}
      {sub && <Typography noWrap sx={{ fontSize: "0.7rem", color: MUTED }}>{sub}</Typography>}
    </Box>
  );
}

const SubTitle = ({ children, right }) => (
  <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1, minHeight: 28 }}>
    <Typography sx={{ flex: 1, fontSize: "0.9rem", fontWeight: 800, color: INK }}>{children}</Typography>
    {right}
  </Stack>
);

const timeOf = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }); };
/** สถานะงานของแถว — คำเดียวกับหน้าการดำเนินงาน */
const jobStateOf = (r) => (r.done ? { text: "เสร็จสิ้น", ok: true } : r.closeRequested ? { text: "รอตรวจปิดงาน" } : { text: r.status || "—" });

/** แถวงาน 1 รายการของคนนั้น — วันที่ · งาน · บทบาท/เข้างาน/สถานะ · มูลค่างานที่ทำ · ปัญหา */
function EntryRow({ r, issues, first, onOpen }) {
  const d = r.date ? r.date.split("-") : [];
  const st = jobStateOf(r);
  const meta = { fontSize: "0.72rem", color: MUTED, whiteSpace: "nowrap" };
  return (
    <ButtonBase component="div" onClick={onOpen}
      sx={{ display: "flex", alignItems: "flex-start", gap: 1.25, width: "100%", px: 1.25, py: 1.1, textAlign: "left", fontFamily: "inherit",
        borderTop: first ? 0 : `1px solid ${LINE}`, ...ROW_HOVER }}>
      <Box sx={{ width: 48, flexShrink: 0, textAlign: "center", borderRadius: "10px", border: `1px solid ${LINE}`, overflow: "hidden", bgcolor: "#fff" }}>
        <Box sx={{ bgcolor: "#f1f5f9", fontSize: "0.62rem", fontWeight: 800, color: MUTED, py: 0.15 }}>{(() => { const t = r.date ? thaiDate(r.date).split(" ") : []; return t.length > 2 ? `${t[1]} ${String(t[2]).slice(-2)}` : ""; })()}</Box>
        <Box sx={{ fontSize: "1.05rem", fontWeight: 900, color: INK, lineHeight: 1.4 }}>{d[2] ? Number(d[2]) : "-"}</Box>
        {r.days > 1 && <Box sx={{ fontSize: "0.6rem", color: MUTED, pb: 0.15 }}>{r.days} วัน</Box>}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: "0.9rem", fontWeight: 800, color: INK }}>{r.site || r.company || "-"}</Typography>
        <Typography noWrap sx={{ fontSize: "0.76rem", color: "#475569" }}>
          {[r.title, r.system, r.time ? `ครั้งที่ ${r.time}` : "", r.jobNo].filter(Boolean).join(" · ") || "—"}
        </Typography>
        <Stack direction="row" sx={{ mt: 0.4, flexWrap: "wrap", columnGap: 1.25, rowGap: 0.25 }}>
          <Typography component="span" sx={{ ...meta, fontWeight: 700, color: r.lead ? INK : MUTED }}>{r.lead ? "หัวหน้าทีม" : "ลูกทีม"}{r.teamSize > 1 ? ` · ทีม ${r.teamSize} คน` : ""}</Typography>
          <Typography component="span" sx={meta}>{r.checkIns?.length ? `✓ กดเข้างาน ${timeOf(r.checkIns[0])}${r.checkIns.length > 1 ? ` (${r.checkIns.length} วัน)` : ""}` : "ไม่มีบันทึกเข้างาน"}</Typography>
          <Typography component="span" sx={{ ...meta, color: st.ok ? OK : MUTED, fontWeight: st.ok ? 800 : 400 }}>{st.ok ? "✓ " : ""}{st.text}</Typography>
        </Stack>
        {issues?.length > 0 && (
          <Typography sx={{ mt: 0.35, fontSize: "0.72rem", fontWeight: 800, color: WARN }}>ต้องแก้: {issues.join(" · ")}</Typography>
        )}
      </Box>
      <Box sx={{ textAlign: "right", flexShrink: 0, pt: 0.2 }}>
        {r.value === null || r.value === undefined
          ? <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: FAINT }}>ยังไม่ลง</Typography>
          : <Typography sx={{ fontSize: "0.95rem", fontWeight: 900, color: INK, ...NUM }}>{baht(r.value)}</Typography>}
        {r.valueLegacy && <Typography sx={{ fontSize: "0.66rem", color: FAINT }}>ยอดเดิม</Typography>}
      </Box>
      <ChevronRightRounded sx={{ fontSize: 18, color: "#cbd5e1", mt: 0.25 }} />
    </ButtonBase>
  );
}

const FilterPill = ({ active, onClick, children }) => (
  <ButtonBase onClick={onClick} sx={{ px: 1.25, py: 0.4, borderRadius: 99, fontFamily: "inherit", fontSize: "0.76rem", fontWeight: 800,
    color: active ? "#fff" : "#475569", bgcolor: active ? INK : "#f1f5f9", transition: "background-color .15s ease" }}>
    {children}
  </ButtonBase>
);

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
  //    กว้าง = คอลัมน์ซ้ายแคบ (ความครบของข้อมูล) · ขวากว้าง (งานที่เข้า) · แถบสถิติ 4 ช่องเส้นคั่น
  const [boxRef, boxW] = useElementWidth();
  const wide = boxW >= 900;
  const statCols = boxW && boxW < 560 ? 2 : 4;

  return (
    <Box ref={boxRef} sx={R_CARD}>
      {/* หัว: คน + ยอดใหญ่ */}
      <Stack direction="row" alignItems="center" gap={1.5} sx={{ px: { xs: 1.5, sm: 2 }, py: 1.75 }}>
        <PersonAvatar name={p.name} avatar={avatar} size={52} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: "1.15rem", fontWeight: 900, color: INK }}>{p.name}</Typography>
          <Typography noWrap sx={{ fontSize: "0.78rem", color: MUTED }}>
            {p.jobs} งาน · หัวหน้าทีม {p.lead} ครั้ง{p.last ? ` · เข้างานล่าสุด ${thaiDate(p.last)}` : ""}
          </Typography>
        </Box>
        <Box sx={{ textAlign: "right", flexShrink: 0 }}>
          <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: MUTED }}>มูลค่างานที่ทำ (ก่อน VAT)</Typography>
          <Typography sx={{ fontSize: { xs: "1.4rem", sm: "1.7rem" }, fontWeight: 900, color: INK, lineHeight: 1.15, ...NUM }}>{baht(p.total)}</Typography>
          <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>
            บันทึกมูลค่าแล้ว {p.valued}/{p.visits} ครั้ง
          </Typography>
        </Box>
      </Stack>

      <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${statCols}, minmax(0, 1fr))`, bgcolor: "#f8fafc", borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`,
        "& > *": { borderLeft: `1px solid ${LINE}` }, [`& > *:nth-of-type(${statCols}n+1)`]: { borderLeft: 0 },
        ...(statCols === 2 ? { "& > *:nth-of-type(n+3)": { borderTop: `1px solid ${LINE}` } } : {}) }}>
        <BigStat label="เข้างาน" value={`${p.visits} ครั้ง`} sub={p.upcoming ? `ยังไม่ถึงวัน/กำลังทำ ${p.upcoming}` : `ผ่านไปแล้ว ${p.past} ครั้ง`} />
        <BigStat label="วันทำงาน" value={`${p.days} วัน`} sub={p.visits ? `เฉลี่ย ${(p.days / p.visits).toFixed(1)} วัน/ครั้ง` : undefined} />
        <BigStat label="เฉลี่ยต่อครั้ง" value={formatKpi("avgPerVisit", p.avgPerVisit)} empty={p.avgPerVisit === null ? "ยังไม่มียอด" : null}
          sub={p.valued ? `คิดจาก ${p.valued} ครั้งที่ลงแล้ว` : "ลงมูลค่าแล้วจึงคำนวณได้"} />
        <BigStat label="มูลค่าต่อวันทำงาน" value={formatKpi("perDay", p.perDay)} empty={p.perDay === null ? "ยังไม่มียอด" : null}
          sub={p.valuedDays ? `คิดจาก ${p.valuedDays} วันที่ลงแล้ว` : undefined} />
      </Box>

      <Box sx={{ display: "grid", gap: wide ? 3 : 2, px: { xs: 1.5, sm: 2 }, py: 2, gridTemplateColumns: wide ? "minmax(300px, 380px) minmax(0, 1fr)" : "1fr" }}>
        {/* ความครบของข้อมูล */}
        <Box>
          <SubTitle right={<DataStatus p={p} size="lg" />}>ความครบของข้อมูล</SubTitle>
          {/* 🔁 (17 พ.ย. 2569 ผู้ใช้: "ความครบของข้อมูลควรมีมากกว่านี้ ให้สมบูรณ์") 2 กลุ่ม: ของคนนี้ · ของงานที่อยู่ในทีม */}
          {[["self", "ของคนนี้"], ["job", "ของงานที่อยู่ในทีม (รับผิดชอบร่วมกัน)"]].map(([scope, title]) => (
            <Box key={scope} sx={{ mb: 1 }}>
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: MUTED, mb: 0.5, px: 0.25 }}>{title}</Typography>
              <Box sx={{ borderRadius: 2, border: `1px solid ${LINE}` }}>
                {RATE_KPIS.filter((d) => d.scope === scope).map((d, i) => {
                  const done = p[d.num] || 0;
                  const base = p[d.base] || 0;
                  const ok = base > 0 && done === base;
                  return (
                    <Box key={d.key} title={d.desc} sx={{ px: 1.25, py: 0.9, borderTop: i ? `1px solid ${LINE}` : 0 }}>
                      <Stack direction="row" alignItems="center" gap={1}>
                        {!base ? <CheckCircleRounded sx={{ fontSize: 18, color: "#e2e8f0" }} />
                          : ok ? <CheckCircleRounded sx={{ fontSize: 18, color: OK }} /> : <ErrorRounded sx={{ fontSize: 18, color: WARN }} />}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: "#334155" }}>{d.label}</Typography>
                          <Typography sx={{ fontSize: "0.68rem", color: FAINT }}>เป้า ≥{d.good}%{d.key === "docsRate" ? " · นับเฉพาะงาน PM" : ""}</Typography>
                        </Box>
                        <Box sx={{ textAlign: "right" }}>
                          <Typography sx={{ fontSize: "0.84rem", fontWeight: 800, color: base ? INK : FAINT, ...NUM }}>{base ? `${done} / ${base}` : "ไม่มีงานที่ต้องนับ"}</Typography>
                          {base > 0 && <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: ok ? OK : WARN, ...NUM }}>{Math.round((done / base) * 100)}%</Typography>}
                        </Box>
                      </Stack>
                      {d.key === "doneRate" && p.pastPending > 0 && (
                        <Typography sx={{ pl: 3.25, fontSize: "0.7rem", color: MUTED }}>รวมรอแอดมินตรวจปิด {p.pastPending} ครั้ง</Typography>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          ))}
          <Typography sx={{ mt: 0.5, fontSize: "0.72rem", color: FAINT, lineHeight: 1.5 }}>
            นับเฉพาะงานที่ผ่านไปแล้ว ({p.past} ครั้ง) — งานที่ยังไม่ถึงวันไม่นับว่าขาด · ชี้ที่แต่ละข้อเพื่อดูความหมาย
          </Typography>

          {months?.length > 1 && (
            <Box sx={{ mt: 2 }}>
              <SubTitle>แนวโน้มรายเดือน</SubTitle>
              <Box sx={{ borderRadius: 2, border: `1px solid ${LINE}` }}>
                {months.map((m, i) => {
                  const max = Math.max(1, ...months.map((x) => x.total));
                  return (
                    <Stack key={m.key} direction="row" alignItems="center" gap={1.25} sx={{ px: 1.25, py: 0.9, borderTop: i ? `1px solid ${LINE}` : 0 }}>
                      <Typography sx={{ width: 64, flexShrink: 0, fontSize: "0.78rem", fontWeight: 700, color: "#334155" }}>{monthLabel(m.key)}</Typography>
                      <Box sx={{ flex: 1 }}><ShareBar share={m.total / max} /></Box>
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
            <Stack direction="row" gap={0.5}>
              <FilterPill active={filter === "all"} onClick={() => { setFilter("all"); setShowAll(false); }}>ทั้งหมด {sorted.length}</FilterPill>
              <FilterPill active={filter === "issues"} onClick={() => { setFilter("issues"); setShowAll(false); }}>ต้องแก้ {issueRows.length}</FilterPill>
            </Stack>
          )}>
            งานที่เข้า
          </SubTitle>
          {!list.length ? (
            <Stack direction="row" alignItems="center" gap={1} sx={{ px: 1.25, py: 1.5, borderRadius: 2, border: `1px solid ${LINE}`, color: OK }}>
              <CheckCircleRounded sx={{ fontSize: 18 }} />
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 800 }}>{filter === "issues" ? "ไม่มีงานที่ต้องแก้ — ข้อมูลครบ ใช้ประเมินได้" : "ไม่มีงานในช่วงนี้"}</Typography>
            </Stack>
          ) : (
            <Box sx={{ borderRadius: 2, border: `1px solid ${LINE}`, overflow: "hidden" }}>
              {shown.map((r, i) => (
                <EntryRow key={r.id} r={r} issues={issuesById.get(r.id)} first={i === 0} onOpen={() => onOpenJob?.(r.eventId)} />
              ))}
              {list.length > 8 && (
                <Button fullWidth size="small" onClick={() => setShowAll((v) => !v)} sx={{ borderTop: `1px solid ${LINE}`, borderRadius: 0, textTransform: "none", fontWeight: 800 }}>
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
        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.25, px: 1.5, py: 0.9, borderRadius: "12px", border: `1px solid ${LINE}`, bgcolor: "#fff" }}>
          <ErrorRounded sx={{ fontSize: 18, color: WARN }} />
          <Typography sx={{ fontSize: "0.82rem", color: "#334155" }}>
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
