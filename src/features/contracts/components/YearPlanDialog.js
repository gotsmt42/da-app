/**
 * YearPlanDialog — "แผนงานทั้งปี" ของทุกสัญญา (ปุ่มหัวหน้าภาพรวมงาน)
 *
 * ✅ (26 พ.ย. 2569 ผู้ใช้: "อยากให้หน้าภาพรวมงานสามารถกดออกแผนงานทั้งปี … และต่อเป็นต่อปีด้วยนะ")
 *    ตารางแถวละสัญญา × 12 เดือนของปี พ.ศ. ที่เลือก — ช่องที่มีงานบอกครั้งที่ สีตามสถานะจริง
 *    หัวคอลัมน์รวม "งานต่อเดือน" (ดูภาระงานล่วงหน้า) · สลับปีได้ · รวมปีถัดไปของสัญญาที่ยังไม่ต่อ (ประมาณการ)
 * ✅ (26 พ.ย. 2569 ผู้ใช้: "ทำให้สามารถติดตามแผนงานทั้งปีที่ส่งไปแล้ว มีการลงตามนี้จริงไหม")
 *    ป้ายต่อสัญญา: ยังไม่ส่งแผน / ส่งแผนแล้ว·ตรง x/y / ไม่ตรงแผน n · ตัวกรอง "ไม่ตรงแผน" = รายการที่ต้องตามงาน
 * ✅ (26 พ.ย. 2569 ผู้ใช้: "ทำให้ดูในมือถือ และจัดการส่วนนี้ได้ง่ายๆ สวยงาม") มือถือ = เลือกเดือนจากแถบเลื่อน
 *    แล้วเห็นการ์ดของสัญญาที่ต้องเข้าเดือนนั้น (หรือ "ทั้งปี" = การ์ดพร้อมแถบ 12 เดือน) แทนตารางกว้าง
 */
import { useMemo, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, Box, Stack, Typography, Button, IconButton, Switch, FormControlLabel,
  TextField, InputAdornment, CircularProgress, Tooltip, useMediaQuery,
} from "@mui/material";
import {
  CloseRounded as Close, CalendarViewMonthRounded as CalendarViewMonth, ChevronLeftRounded as ChevronLeft,
  ChevronRightRounded as ChevronRight, SearchRounded as Search, GridOnRounded as Grid, ChevronRightRounded as Go,
} from "@mui/icons-material";
import Swal from "sweetalert2";
import {
  buildContractPlan, suggestFirstMonth, roundsByMonthOfYear, PLAN_STATES, TH_MONTHS, monthKeyOf, sentPlanOf, adherenceOf, ADHERENCE, thaiMonthLabel,
} from "@/shared/utils/contractPlan";
import { formatEventDateRange } from "@/shared/utils/formatDateRange";
import { thaiDate } from "@/shared/utils/thaiDate";
import { INK, INK_2, MUTED, FAINT, LINE, SURFACE, ACCENT, ACCENT_SOFT } from "@/shared/ui/PageKit";

const OUTLINE_SX = { textTransform: "none", fontWeight: 700, color: INK_2, borderRadius: 2, border: `1px solid ${LINE}`, bgcolor: "#fff", whiteSpace: "nowrap", px: 1.5, "&:hover": { bgcolor: SURFACE } };
const COL_W = 54;

const FILTERS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "problem", label: "ไม่ตรงแผน", color: "#b91c1c" },
  { key: "sent", label: "ส่งแผนแล้ว", color: "#15803d" },
  { key: "unsent", label: "ยังไม่ส่งแผน" },
];
const matchFilter = (x, key) => (key === "all" ? true
  : key === "sent" ? x.sent.docs.length > 0
  : key === "unsent" ? x.sent.docs.length === 0
  : x.adh.counts.problem > 0);

/** ป้ายการส่งแผน/การลงตามแผน ของสัญญา */
const SentBadge = ({ x }) => {
  const { sent, adh } = x;
  const base = { display: "inline-flex", alignItems: "center", flexShrink: 0, height: 18, px: 0.7, borderRadius: 99, fontSize: "0.62rem", fontWeight: 800, whiteSpace: "nowrap" };
  if (!sent.docs.length) return <Box component="span" sx={{ ...base, color: MUTED, bgcolor: SURFACE, border: `1px solid ${LINE}` }}>ยังไม่ส่งแผน</Box>;
  const tip = `ส่งลูกค้าแล้ว เลขที่ ${sent.last.docNumber || "-"} · ${thaiDate(sent.last.issuedAt)}`
    + ` — ตรง ${adh.counts.ontime} · คลาด ${adh.counts.shifted} · เลยเดือน ${adh.counts.missed} · ยังไม่ถึง ${adh.counts.upcoming + adh.counts.due}`;
  const problem = adh.counts.problem > 0;
  return (
    <Tooltip title={tip}>
      <Box component="span" sx={{ ...base, color: problem ? "#b91c1c" : "#15803d", bgcolor: problem ? "#fef2f2" : "#f0fdf4", border: `1px solid ${problem ? "#fecaca" : "#bbf7d0"}` }}>
        {problem ? `ไม่ตรงแผน ${adh.counts.problem}` : adh.counts.ontime ? `ส่งแผนแล้ว · ตรง ${adh.counts.ontime}/${adh.counts.total}` : "ส่งแผนแล้ว"}
      </Box>
    </Tooltip>
  );
};

const RoundChip = ({ r, per, small }) => {
  const st = PLAN_STATES[r.state];
  return (
    <Box component="span" sx={{ display: "inline-block", minWidth: small ? 0 : 36, px: small ? 0.4 : 0.5, py: 0.15, borderRadius: 1.25, fontSize: small ? "0.66rem" : "0.74rem", fontWeight: 800, textAlign: "center",
      color: st.color, bgcolor: st.bg, border: `1px ${r.projected ? "dashed" : "solid"} ${st.color}40`, lineHeight: 1.45 }}>
      {r.inYear}/{per}
    </Box>
  );
};

/**
 * @param contracts  สัญญาจริงที่ผ่านตัวกรองของหน้า
 * @param renewalOf  Map key → สัญญาที่ต่อแล้ว · prevOf Map key → สัญญาฉบับก่อน
 * @param onOpenContract เปิดแผนของสัญญาเดียว
 */
export default function YearPlanDialog({ open, onClose, contracts = [], renewalOf, prevOf, onOpenContract, initialMonth }) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const nowKey = monthKeyOf(new Date());
  const thisYear = new Date().getFullYear() + 543;
  const [year, setYear] = useState(thisYear);
  const [projected, setProjected] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  // กรองเฉพาะสัญญาที่มีงานในเดือนนี้ (0–11) · มือถือเริ่มที่เดือนปัจจุบัน
  const [month, setMonth] = useState(() => (initialMonth !== undefined ? initialMonth : isMobile ? new Date().getMonth() : null));
  const [exporting, setExporting] = useState(false);

  const all = useMemo(() => contracts.map((c) => {
    const s = suggestFirstMonth(c, { prev: prevOf?.get(c.key) || null });
    const plan = buildContractPlan(c, s.month, { extraYears: projected && !renewalOf?.has(c.key) ? 1 : 0 });
    const cells = roundsByMonthOfYear(plan, year);
    const firstIdx = cells.findIndex((x) => x.length);
    const sent = sentPlanOf(c);
    const adh = adherenceOf(plan, sent);
    return { contract: c, plan, cells, estimated: s.source !== "saved", note: s.note, count: cells.reduce((n, x) => n + x.length, 0), firstIdx, sent, adh };
  }).filter((x) => x.count > 0)
    .sort((a, b) => a.firstIdx - b.firstIdx || String(a.contract.company || "").localeCompare(String(b.contract.company || ""), "th")),
  [contracts, renewalOf, prevOf, year, projected]);

  const filterCounts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, all.filter((x) => matchFilter(x, f.key)).length])), [all]);
  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((x) => matchFilter(x, filter)
      && (!q || [x.contract.contractNo, x.contract.company, x.contract.site, x.contract.title, x.contract.system].some((v) => String(v || "").toLowerCase().includes(q))));
  }, [all, query, filter]);
  const rows = useMemo(() => (month === null ? base : base.filter((x) => x.cells[month].length)), [base, month]);
  const perMonth = useMemo(() => Array.from({ length: 12 }, (_, m) => base.reduce((n, x) => n + x.cells[m].length, 0)), [base]);
  const maxPerMonth = Math.max(1, ...perMonth);
  const estimatedCount = all.filter((x) => x.estimated).length;
  const ce = year - 543;
  const changeYear = (d) => { setYear((y) => y + d); setMonth(isMobile && year + d === thisYear ? new Date().getMonth() : null); };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const { exportYearPlanExcel } = await import("../utils/contractPlanExport");
      await exportYearPlanExcel({ year, items: rows, includeProjected: projected });
    } catch (err) {
      Swal.fire({ icon: "error", title: "ส่งออกไม่สำเร็จ", text: err?.message || "" });
    } finally {
      setExporting(false);
    }
  };

  const filterChips = (
    <Stack direction="row" spacing={0.75} sx={{ overflowX: "auto", pb: 0.25, "&::-webkit-scrollbar": { display: "none" } }}>
      {FILTERS.map((f) => {
        const on = filter === f.key;
        return (
          <Box key={f.key} component="button" type="button" onClick={() => setFilter(f.key)} aria-pressed={on}
            sx={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 0.6, height: 32, px: 1.25, borderRadius: 99, cursor: "pointer", font: "inherit",
              fontSize: "0.8rem", fontWeight: 700, border: `1px solid ${on ? ACCENT : LINE}`, bgcolor: on ? ACCENT_SOFT : "#fff", color: on ? ACCENT : INK_2 }}>
            {f.color && <Box component="span" sx={{ width: 7, height: 7, borderRadius: 99, bgcolor: f.color }} />}
            {f.label}
            <Box component="span" sx={{ fontSize: "0.72rem", fontWeight: 800, color: on ? ACCENT : MUTED }}>{filterCounts[f.key]}</Box>
          </Box>
        );
      })}
    </Stack>
  );

  // ── มือถือ: การ์ด ─────────────────────────────────────────
  const MobileCard = ({ x }) => {
    const c = x.contract;
    const inMonth = month === null ? [] : x.cells[month];
    return (
      <Box component="button" type="button" onClick={() => onOpenContract?.(c)}
        sx={{ display: "block", width: "100%", textAlign: "left", font: "inherit", cursor: "pointer", p: 1.5, borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${LINE}`,
          borderLeft: `4px solid ${x.adh.counts.problem ? "#ef4444" : x.sent.docs.length ? "#22c55e" : "#cbd5e1"}` }}>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.9rem", fontWeight: 800, color: INK, minWidth: 0 }} noWrap>{c.contractNo || "ไม่มีเลขที่"}</Typography>
          <SentBadge x={x} />
          <Box sx={{ flex: 1 }} />
          <Go sx={{ fontSize: 20, color: FAINT, flexShrink: 0 }} />
        </Stack>
        <Typography sx={{ fontSize: "0.78rem", color: INK_2 }} noWrap>{[c.site, c.company].filter(Boolean).join(" · ")}</Typography>
        <Typography sx={{ fontSize: "0.7rem", color: MUTED }} noWrap>
          {[c.title, c.system].filter(Boolean).join(" · ")} · ทุก {x.plan.interval} เดือน{x.estimated ? " · เดือนครั้งที่ 1 ยังเป็นค่าประมาณ" : ""}
        </Typography>
        {month !== null ? (
          <Stack spacing={0.6} sx={{ mt: 1, pt: 1, borderTop: `1px dashed ${LINE}` }}>
            {inMonth.map((r) => {
              const a = x.adh.rows.get(r.time);
              return (
                <Stack key={r.time} direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 0.4 }}>
                  <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: INK_2 }}>ครั้งที่ {r.inYear}/{x.plan.per}</Typography>
                  <Box component="span" sx={{ px: 0.8, py: 0.1, borderRadius: 99, fontSize: "0.68rem", fontWeight: 800, color: PLAN_STATES[r.state].color, bgcolor: PLAN_STATES[r.state].bg }}>
                    {PLAN_STATES[r.state].short || PLAN_STATES[r.state].label}
                  </Box>
                  {r.visits.length > 0 && <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{r.visits.map((v) => formatEventDateRange(v)).join(", ")}</Typography>}
                  {a && a.status !== "upcoming" && a.status !== "due" && (
                    <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: ADHERENCE[a.status].color }}>
                      {a.status === "shifted" ? `คลาด ${a.diff > 0 ? "+" : ""}${a.diff} เดือนจากที่แจ้ง (${thaiMonthLabel(a.sentMonth)})` : ADHERENCE[a.status].short}
                    </Typography>
                  )}
                </Stack>
              );
            })}
          </Stack>
        ) : (
          <Box sx={{ mt: 1, display: "grid", gridTemplateColumns: "repeat(12, minmax(0,1fr))", gap: 0.3 }}>
            {x.cells.map((list, i) => (
              <Box key={i} sx={{ textAlign: "center", minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.56rem", color: `${ce}-${String(i + 1).padStart(2, "0")}` === nowKey ? ACCENT : FAINT, fontWeight: 700 }} noWrap>{TH_MONTHS[i].replace(".", "").slice(0, 3)}</Typography>
                <Box sx={{ height: 20, display: "grid", placeItems: "center", borderRadius: 1, bgcolor: list.length ? PLAN_STATES[list[0].state].bg : SURFACE }}>
                  {list.length > 0 && <Typography sx={{ fontSize: "0.66rem", fontWeight: 900, color: PLAN_STATES[list[0].state].color }}>{list[0].inYear}</Typography>}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl" fullScreen={isMobile} PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3, height: { sm: "92vh" } } }}>
      <DialogTitle sx={{ p: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: { xs: 1.5, sm: 2.5 }, py: { xs: 1.1, sm: 1.5 }, borderBottom: `1px solid ${LINE}` }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, display: { xs: "none", sm: "grid" }, placeItems: "center", bgcolor: ACCENT_SOFT, color: ACCENT, flexShrink: 0 }}>
            <CalendarViewMonth />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "1.05rem", fontWeight: 800, color: INK, lineHeight: 1.3 }}>แผนงานทั้งปี</Typography>
            <Typography sx={{ fontSize: "0.76rem", color: MUTED }} noWrap>
              {all.length} สัญญามีงานในปี {year} · รวม {all.reduce((n, x) => n + x.count, 0)} ครั้ง
            </Typography>
          </Box>
          <Stack direction="row" alignItems="center" sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 2, flexShrink: 0 }}>
            <IconButton size="small" onClick={() => changeYear(-1)} aria-label="ปีก่อน"><ChevronLeft /></IconButton>
            <Typography sx={{ px: { xs: 0.5, sm: 1.25 }, fontSize: "0.92rem", fontWeight: 800, color: INK, textAlign: "center" }}>ปี {year}</Typography>
            <IconButton size="small" onClick={() => changeYear(1)} aria-label="ปีถัดไป"><ChevronRight /></IconButton>
          </Stack>
          <IconButton onClick={onClose} aria-label="ปิด" sx={{ ml: { xs: -0.5, sm: 0 } }}><Close /></IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ px: { xs: 1.25, sm: 2.5 }, py: { xs: 1.25, sm: 2 }, bgcolor: SURFACE, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {/* แถบเครื่องมือ */}
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.1} alignItems={{ md: "center" }} sx={{ mt: { xs: 0.5, sm: 1 }, mb: 1.25 }}>
          {filterChips}
          <TextField size="small" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาสัญญา / ลูกค้า / โครงการ"
            sx={{ bgcolor: "#fff", width: { md: 280 } }} InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18, color: FAINT }} /></InputAdornment> }} />
          <Box sx={{ flex: 1, display: { xs: "none", md: "block" } }} />
          <Stack direction="row" alignItems="center" spacing={1} justifyContent="space-between">
            <FormControlLabel sx={{ mr: 0 }}
              control={<Switch size="small" checked={projected} onChange={(e) => setProjected(e.target.checked)} />}
              label={<Typography sx={{ fontSize: "0.8rem", color: INK_2 }}>รวมปีถัดไป <Box component="span" sx={{ color: MUTED }}>(สัญญาที่ยังไม่ต่อ)</Box></Typography>} />
            <Button onClick={exportExcel} disabled={!rows.length || exporting}
              startIcon={exporting ? <CircularProgress size={14} /> : <Grid sx={{ fontSize: 18, color: "#217346" }} />} sx={{ ...OUTLINE_SX, flexShrink: 0 }}>
              Excel ({rows.length})
            </Button>
          </Stack>
        </Stack>

        {isMobile ? (
          <>
            {/* เลือกเดือน — แถบเลื่อน: ทั้งปี + 12 เดือน (ตัวเลข = จำนวนงาน) */}
            <Stack direction="row" spacing={0.6} sx={{ overflowX: "auto", pb: 1, mb: 0.5, mx: -1.25, px: 1.25, "&::-webkit-scrollbar": { display: "none" } }}>
              {[null, ...TH_MONTHS.map((_, i) => i)].map((m) => {
                const on = month === m;
                const n = m === null ? base.length : perMonth[m];
                const isNow = m !== null && `${ce}-${String(m + 1).padStart(2, "0")}` === nowKey;
                return (
                  <Box key={m ?? "all"} component="button" type="button" onClick={() => setMonth(m)} aria-pressed={on}
                    sx={{ flexShrink: 0, minWidth: m === null ? 64 : 52, py: 0.6, px: 0.75, borderRadius: 2, cursor: "pointer", font: "inherit", textAlign: "center",
                      border: `1px solid ${on ? ACCENT : isNow ? "#bfdbfe" : LINE}`, bgcolor: on ? ACCENT : "#fff", color: on ? "#fff" : INK_2 }}>
                    <Typography sx={{ fontSize: "0.76rem", fontWeight: 800, lineHeight: 1.3 }}>{m === null ? "ทั้งปี" : TH_MONTHS[m]}</Typography>
                    <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, opacity: on ? 0.9 : 1, color: on ? "#fff" : n ? INK : FAINT, lineHeight: 1.3 }}>
                      {m === null ? `${n} สัญญา` : `${n} งาน`}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
            <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: MUTED, mb: 0.75, px: 0.25 }}>
              {month === null ? `ทั้งปี ${year} · ${rows.length} สัญญา` : `${thaiMonthLabel(`${ce}-${String(month + 1).padStart(2, "0")}`, { full: true })} · ต้องเข้า ${rows.length} สัญญา`}
            </Typography>
            <Stack spacing={1}>
              {rows.map((x) => <MobileCard key={x.contract.key} x={x} />)}
            </Stack>
          </>
        ) : (
          <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 2.5 }}>
            <Box component="table" sx={{ borderCollapse: "separate", borderSpacing: 0, width: "100%", minWidth: 280 + COL_W * 12,
              "& th, & td": { borderBottom: `1px solid ${LINE}`, p: 0 } }}>
              <Box component="thead" sx={{ position: "sticky", top: 0, zIndex: 3, bgcolor: "#fff" }}>
                <Box component="tr">
                  <Box component="th" sx={{ position: "sticky", left: 0, zIndex: 4, bgcolor: "#fff", textAlign: "left", px: "12px !important", py: "8px !important", minWidth: 280, borderRight: `1px solid ${LINE}` }}>
                    <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: MUTED }}>สัญญา</Typography>
                    <Typography sx={{ fontSize: "0.68rem", color: FAINT }}>แตะเดือนเพื่อกรอง · แตะแถวเพื่อตั้งแผน/ดูรายละเอียด</Typography>
                  </Box>
                  {TH_MONTHS.map((m, i) => {
                    const key = `${ce}-${String(i + 1).padStart(2, "0")}`;
                    const on = month === i;
                    return (
                      <Box component="th" key={m} sx={{ width: COL_W, minWidth: COL_W, bgcolor: on ? ACCENT_SOFT : "#fff" }}>
                        <Box component="button" type="button" onClick={() => setMonth(on ? null : i)} aria-pressed={on}
                          sx={{ width: "100%", border: 0, bgcolor: "transparent", cursor: "pointer", font: "inherit", py: 0.75, px: 0.25 }}>
                          <Typography sx={{ fontSize: "0.74rem", fontWeight: 800, color: key === nowKey || on ? ACCENT : INK_2 }}>{m}</Typography>
                          <Box sx={{ mx: "auto", mt: 0.4, width: 22, height: 26, display: "flex", alignItems: "flex-end", bgcolor: SURFACE, borderRadius: 0.75, overflow: "hidden" }}>
                            <Box sx={{ width: "100%", height: `${(perMonth[i] / maxPerMonth) * 100}%`, bgcolor: on ? ACCENT : "#93c5fd", transition: "height .2s" }} />
                          </Box>
                          <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: perMonth[i] ? INK : FAINT, mt: 0.25 }}>{perMonth[i]}</Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
              <Box component="tbody">
                {rows.map((x) => {
                  const c = x.contract;
                  return (
                    <Box component="tr" key={c.key} onClick={() => onOpenContract?.(c)} sx={{ cursor: "pointer", "&:hover td": { bgcolor: "#f8fafc" } }}>
                      <Box component="td" sx={{ position: "sticky", left: 0, zIndex: 2, bgcolor: "#fff", px: "12px !important", py: "7px !important", borderRight: `1px solid ${LINE}`, maxWidth: 280,
                        boxShadow: `inset 3px 0 0 ${x.adh.counts.problem ? "#ef4444" : x.sent.docs.length ? "#22c55e" : "transparent"}` }}>
                        <Stack direction="row" spacing={0.6} alignItems="center" sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: INK, minWidth: 0 }} noWrap>{c.contractNo || "ไม่มีเลขที่"}</Typography>
                          <SentBadge x={x} />
                          {x.estimated && (
                            <Tooltip title={`ยังไม่ได้บันทึกเดือนครั้งที่ 1 — ${x.note}`}>
                              <Box component="span" sx={{ flexShrink: 0, px: 0.6, borderRadius: 99, fontSize: "0.6rem", fontWeight: 800, color: "#b45309", bgcolor: "#fffbeb", border: "1px solid #fde68a" }}>ประมาณ</Box>
                            </Tooltip>
                          )}
                        </Stack>
                        <Typography sx={{ fontSize: "0.74rem", color: INK_2 }} noWrap>{[c.site, c.company].filter(Boolean).join(" · ")}</Typography>
                        <Typography sx={{ fontSize: "0.68rem", color: MUTED }} noWrap>ทุก {x.plan.interval} เดือน · {[c.title, c.system].filter(Boolean).join(" · ")}</Typography>
                      </Box>
                      {x.cells.map((list, i) => (
                        <Box component="td" key={i} sx={{ textAlign: "center", bgcolor: month === i ? "#f5f9ff" : "#fff" }}>
                          {list.map((r) => {
                            const a = x.adh.rows.get(r.time);
                            const tip = [`${r.label} · ${PLAN_STATES[r.state].label}`, a ? `แจ้งลูกค้า ${thaiMonthLabel(a.sentMonth)} · ${ADHERENCE[a.status].label}` : ""].filter(Boolean).join("\n");
                            return (
                              <Tooltip key={r.time} title={<span style={{ whiteSpace: "pre-line" }}>{tip}</span>}>
                                <Box component="span" sx={{ display: "inline-block", my: 0.25, position: "relative" }}>
                                  <RoundChip r={r} per={x.plan.per} />
                                  {a && (a.status === "shifted" || a.status === "missed") && (
                                    <Box component="span" sx={{ position: "absolute", top: -3, right: -3, width: 8, height: 8, borderRadius: 99, bgcolor: ADHERENCE[a.status].color, border: "1.5px solid #fff" }} />
                                  )}
                                </Box>
                              </Tooltip>
                            );
                          })}
                        </Box>
                      ))}
                    </Box>
                  );
                })}
              </Box>
            </Box>
            {!rows.length && (
              <Box sx={{ py: 6, textAlign: "center" }}>
                <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK_2 }}>ไม่มีสัญญาที่ตรงเงื่อนไขในปี {year}{month !== null ? ` เดือน ${TH_MONTHS[month]}` : ""}</Typography>
                <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>ลองเปลี่ยนปี ตัวกรอง หรือล้างคำค้น</Typography>
              </Box>
            )}
          </Box>
        )}
        {isMobile && !rows.length && (
          <Box sx={{ py: 5, textAlign: "center" }}>
            <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: INK_2 }}>ไม่มีงานที่ตรงเงื่อนไข</Typography>
            <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>ลองเลือกเดือนอื่น หรือ “ทั้งปี”</Typography>
          </Box>
        )}

        {/* คำอธิบายสี */}
        <Stack direction="row" sx={{ flexWrap: "wrap", columnGap: 1.25, rowGap: 0.5, mt: 1.25, alignItems: "center" }}>
          {Object.entries(PLAN_STATES).map(([k, st]) => (
            <Stack key={k} direction="row" spacing={0.5} alignItems="center">
              <Box sx={{ width: 12, height: 12, borderRadius: 0.75, bgcolor: st.bg, border: `1px ${k === "projected" ? "dashed" : "solid"} ${st.color}80` }} />
              <Typography sx={{ fontSize: "0.7rem", color: MUTED }}>{st.short || st.label}</Typography>
            </Stack>
          ))}
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Box sx={{ width: 8, height: 8, borderRadius: 99, bgcolor: "#b91c1c" }} />
            <Typography sx={{ fontSize: "0.7rem", color: MUTED }}>ไม่ตรงกับแผนที่ส่งลูกค้า</Typography>
          </Stack>
          {estimatedCount > 0 && (
            <Typography sx={{ fontSize: "0.7rem", color: "#b45309", ml: { sm: "auto" } }}>
              {estimatedCount} สัญญายังไม่ได้บันทึกเดือนครั้งที่ 1 (ป้าย “ประมาณ”) — แตะเพื่อตั้งค่า
            </Typography>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
