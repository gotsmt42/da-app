/**
 * JobReport.js — สรุปผลการดำเนินงาน (แท็บใน "การดำเนินงาน" · เดิมชื่อ "รายงานงาน")
 *
 * 🔁 (4 พ.ย. 2569 ผู้ใช้: "รายงานงาน ดูแล้วไม่เข้าใจ ข้อมูลไม่สอดคล้อง ดูยาก และสับสน แก้ไขให้สมบูรณ์ และแก้ชื่อเมนูใหม่ให้มืออาชีพ")
 *    • ตัวเลขทุกตัวใช้กติกาเดียวกับหน้าการดำเนินงาน (utils/jobSummary.js) — 1 งานอยู่สถานะเดียว ผลรวม = จำนวนงาน
 *    • กดรายการงาน = เด้งรายละเอียดงานขึ้นมาในหน้านี้ (JobQuickView) ไม่ย้ายหน้า
 *    • หน้าตาแบบหน้าแรก (Agoda) — components/ReportKit · ช่วงเวลาภาษาไทย (PeriodFilter)
 *
 * บนลงล่าง: ตัวกรอง → ภาพรวม (จำนวนงาน + 6 สถานะ) → งานค้างที่ต้องติดตาม → รายเดือน/รายปี → สรุปตามกลุ่ม → รายการงาน
 * ⚠️ อ่านจาก /events/event-op (slim) ตัวเดียวกับหน้าการดำเนินงาน — การมองเห็นเท่ากันอัตโนมัติ
 * ⚠️ "ค้างงาน" ต้องคิดจากงานทั้งหมดก่อนกรองช่วงวัน (buildDaysPastDueMap) — งานหลายวันจะไม่ถูกหั่น
 */
import { useEffect, useMemo, useState } from "react";
import moment from "moment";
import { Box, Button, ButtonBase, CircularProgress, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { AssessmentRounded, SearchRounded } from "@mui/icons-material";

import SectionTabs from "@/shared/ui/SectionTabs";
import SelectField from "@/shared/ui/SelectField";
import PersonSelectField from "@/shared/ui/PersonSelectField";
import usePaged, { PageBar } from "@/shared/ui/usePaged";
import usePermissions from "@/shared/hooks/usePermissions";
import EventService from "@/shared/services/EventService";
import AuthService from "@/shared/services/authService";
import JobQuickView from "@/shared/ui/JobQuickView";
import { buildDaysPastDueMap } from "@/shared/utils/overdueJobs";
import { THAI_MONTHS_SHORT } from "@/shared/utils/thaiDate";
import { PAGE_SX, PageHeader, INK, MUTED, LINE, ACCENT } from "@/shared/ui/PageKit";
import PeriodFilter from "../components/PeriodFilter";
import { ReportSection, Segmented, RankRow, TotalRow, Stat, TotalHero, FilterCard, BarRow, PersonAvatar, R_CARD, baht } from "../components/ReportKit";
import { periodRange, periodText, monthLabel } from "../utils/reportPeriod";
import { buildJobs, filterJobs, summarizeJobs, GROUP_BY_KEY } from "../utils/jobSummary";
import ExportExcelButton from "@/shared/ui/ExportExcelButton";

const GROUP_DIMS = [
  ["site", "โครงการ", "bySite"],
  ["system", "ระบบงาน", "bySystem"],
  ["title", "ประเภทงาน", "byTitle"],
  ["responsible", "ผู้รับผิดชอบ", "byResponsible"],
];

/** แถวงาน — ช่องวันที่ · โครงการ/งาน · คน · สถานะ/มูลค่า */
function JobRow({ j, avatarOf, onClick, showValue }) {
  const g = GROUP_BY_KEY[j.group];
  const d = moment(j.start);
  return (
    <ButtonBase onClick={onClick} component="div"
      sx={{ display: "flex", alignItems: "center", gap: { xs: 1.25, sm: 2 }, width: "100%", px: { xs: 1.5, sm: 2 }, py: 1.5, textAlign: "left", fontFamily: "inherit",
        borderTop: `1px solid ${LINE}`, "&:first-of-type": { borderTop: 0 }, bgcolor: "#fff", "&:hover": { bgcolor: alpha(ACCENT, 0.035) } }}>
      <Box sx={{ width: 54, flexShrink: 0, textAlign: "center", borderRadius: "12px", border: `1px solid ${LINE}`, overflow: "hidden" }}>
        <Box sx={{ bgcolor: "#f1f5f9", fontSize: "0.68rem", fontWeight: 800, color: MUTED, py: 0.25 }}>{THAI_MONTHS_SHORT[d.month()]} {String(d.year() + 543).slice(-2)}</Box>
        <Box sx={{ fontSize: "1.25rem", fontWeight: 900, color: INK, lineHeight: 1.35 }}>{d.date()}</Box>
        {j.visits > 1 && <Box sx={{ fontSize: "0.64rem", color: MUTED, pb: 0.25 }}>{j.visits} ช่วง</Box>}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: "0.98rem", fontWeight: 800, color: INK }}>{j.site || j.company || "-"}</Typography>
        <Typography noWrap sx={{ fontSize: "0.82rem", color: MUTED }}>{[j.title, j.system, j.time ? `ครั้งที่ ${j.time}` : "", j.jobNo].filter(Boolean).join(" · ")}</Typography>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 0.6, minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: "0.8rem", color: MUTED }}>
            ผู้รับผิดชอบ <b style={{ color: j.responsible ? INK : "#d97706" }}>{j.responsible || "ยังไม่มอบหมาย"}</b>
          </Typography>
          {j.workers.length > 0 && (
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
              <Stack direction="row" sx={{ "& > *:not(:first-of-type)": { ml: "-6px" } }}>
                {j.workers.slice(0, 4).map((n) => <Box key={n} sx={{ border: "2px solid #fff", borderRadius: "50%" }}><PersonAvatar name={n} avatar={avatarOf(n)} size={20} /></Box>)}
              </Stack>
              <Typography noWrap sx={{ fontSize: "0.78rem", color: MUTED, display: { xs: "none", sm: "block" } }}>{j.workers.join(", ")}</Typography>
            </Stack>
          )}
        </Stack>
      </Box>
      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
        <Box component="span" sx={{ display: "inline-block", fontSize: "0.76rem", fontWeight: 800, color: g.color, bgcolor: alpha(g.color, 0.1), borderRadius: "6px", px: 1, py: 0.3 }}>
          {g.label}{j.overdueDays ? ` ${j.overdueDays} วัน` : ""}
        </Box>
        {showValue && (
          <Typography sx={{ mt: 0.5, fontSize: "0.9rem", fontWeight: 800, color: j.value === null ? "#cbd5e1" : INK, fontVariantNumeric: "tabular-nums" }}>
            {j.value === null ? "—" : baht(j.value)}
          </Typography>
        )}
      </Box>
    </ButtonBase>
  );
}

export default function JobReport() {
  const { can } = usePermissions();
  const showValue = can("approveJobs") || can("viewAllJobs");

  const [events, setEvents] = useState(null);
  const [error, setError] = useState("");
  const [employees, setEmployees] = useState([]);
  const [period, setPeriod] = useState({
    preset: "month", month: moment().format("YYYY-MM"), year: moment().format("YYYY"),
    from: moment().startOf("month").format("YYYY-MM-DD"), to: moment().format("YYYY-MM-DD"),
  });
  const [responsible, setResponsible] = useState("all");
  const [system, setSystem] = useState("all");
  const [title, setTitle] = useState("all");
  const [q, setQ] = useState("");
  const [periodBy, setPeriodBy] = useState("month");
  const [dim, setDim] = useState("site");
  const [listGroup, setListGroup] = useState("all");
  const [quickId, setQuickId] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let alive = true;
    // ⚠️ slim = เฉพาะฟิลด์ที่ใช้สรุป (ไม่มีไฟล์แนบ/คอมเมนต์/ประวัติ) — รายละเอียดเต็มโหลดตอนเปิด JobQuickView
    EventService.getEventOp({ slim: true })
      .then((res) => { if (alive) setEvents(res?.userEvents || []); })
      .catch(() => { if (alive) { setEvents([]); setError("ดึงข้อมูลงานไม่สำเร็จ — ลองใหม่อีกครั้ง"); } });
    AuthService.getAllUserData().then((r) => { if (alive) setEmployees(r?.allUser || []); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const avatarOf = useMemo(() => {
    const m = new Map(employees.map((e) => [e.fname, e.imageUrl]));
    return (n) => m.get(n);
  }, [employees]);

  // ⚠️ วันค้างคิดจากงานทั้งหมดก่อนกรอง
  const allJobs = useMemo(() => (events ? buildJobs(events, buildDaysPastDueMap(events)) : []), [events]);
  const [rFrom, rTo] = periodRange(period.preset, period);
  const inPeriod = useMemo(() => filterJobs(allJobs, { from: rFrom, to: rTo }), [allJobs, rFrom, rTo]);
  const jobs = useMemo(() => filterJobs(inPeriod, { responsible, system, title, q }), [inPeriod, responsible, system, title, q]);
  const summary = useMemo(() => summarizeJobs(jobs), [jobs]);
  const t = summary.totals;

  // ตัวเลือกในตัวกรอง — นับจากงานในช่วงเวลา
  const optionsOf = (keyOf) => {
    const m = new Map();
    inPeriod.forEach((j) => { const k = keyOf(j); if (k) m.set(k, (m.get(k) || 0) + 1); });
    return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "th"));
  };
  const respOptions = useMemo(() => optionsOf((j) => j.responsible || "__none__"), [inPeriod]); // eslint-disable-line react-hooks/exhaustive-deps
  const systemOptions = useMemo(() => optionsOf((j) => j.system), [inPeriod]); // eslint-disable-line react-hooks/exhaustive-deps
  const titleOptions = useMemo(() => optionsOf((j) => j.title), [inPeriod]); // eslint-disable-line react-hooks/exhaustive-deps
  const years = useMemo(() => [...new Set(allJobs.map((j) => j.start.slice(0, 4)))], [allJobs]);

  const periodLabel = periodText(period.preset, rFrom, rTo);
  const filterLabel = [
    responsible !== "all" ? `ผู้รับผิดชอบ: ${responsible === "__none__" ? "ยังไม่มอบหมาย" : responsible}` : "",
    system !== "all" ? `ระบบ: ${system}` : "",
    title !== "all" ? `ประเภท: ${title}` : "",
    q.trim() ? `ค้นหา: ${q.trim()}` : "",
  ].filter(Boolean).join(" · ") || "ทุกงาน";

  const periodRows = periodBy === "year" ? summary.byYear : summary.byMonth;
  const periodMax = Math.max(1, ...periodRows.map((p) => p.total));
  const dimMeta = GROUP_DIMS.find((d) => d[0] === dim);
  const dimRows = summary[dimMeta[2]];
  const listJobs = listGroup === "all" ? jobs : jobs.filter((j) => j.group === listGroup);

  const overduePg = usePaged(summary.overdueJobs, 5);
  const dimPg = usePaged(dimRows, 10);
  const listPg = usePaged(listJobs, 20);

  const doExport = async () => {
    setExporting(true);
    try {
      const { exportJobSummary } = await import("../utils/jobSummaryExcel");
      await exportJobSummary(jobs, summary, {
        periodLabel, filterLabel, showValue,
        fileName: `สรุปผลการดำเนินงาน ${periodLabel.replace(/[/\\:*?"<>|]/g, "-")}`,
      });
    } catch (err) {
      setError(err?.message || "ส่งออก Excel ไม่สำเร็จ");
    } finally {
      setExporting(false);
    }
  };

  if (!events) return <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress size={26} /></Stack>;

  const exportBtn = <ExportExcelButton onClick={doExport} loading={exporting} disabled={!jobs.length} />;

  return (
    <Box sx={{ ...PAGE_SX, maxWidth: "none" }}>
      <SectionTabs group="operation" />
      <PageHeader icon={<AssessmentRounded />} title="สรุปผลการดำเนินงาน"
        subtitle="จำนวนงาน สถานะ งานค้าง และมูลค่างาน — ใช้กติกาเดียวกับหน้าการดำเนินงาน"
        actions={exportBtn} />

      {/* ── ตัวกรอง ── */}
      <FilterCard footer={`${periodLabel} · ${filterLabel} · นับตามวันเริ่มงาน · งานที่เข้าหลายวันนับเป็น 1 งาน`}>
        <PeriodFilter value={period} onChange={(patch) => setPeriod((p) => ({ ...p, ...patch }))} years={years} />
        <PersonSelectField label="ผู้รับผิดชอบ" title="เลือกผู้รับผิดชอบ" value={responsible} onChange={setResponsible}
          allLabel="ทุกคน" allCount={inPeriod.length} unit="งาน"
          options={respOptions.map(([name, n]) => (name === "__none__"
            ? { id: name, name: "ยังไม่มอบหมาย", count: n, unassigned: true }
            : { id: name, name, count: n, avatar: avatarOf(name) }))}
          sx={{ minWidth: { xs: "100%", md: 220 } }} />
        <SelectField label="ระบบงาน" value={system} onChange={(e) => setSystem(e.target.value)} sx={{ minWidth: 150 }}>
          <option value="all">ทุกระบบ</option>
          {systemOptions.map(([k, n]) => <option key={k} value={k}>{k} ({n})</option>)}
        </SelectField>
        <SelectField label="ประเภทงาน" value={title} onChange={(e) => setTitle(e.target.value)} sx={{ minWidth: 150 }}>
          <option value="all">ทุกประเภท</option>
          {titleOptions.map(([k, n]) => <option key={k} value={k}>{k} ({n})</option>)}
        </SelectField>
        <TextField size="small" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา โครงการ / บริษัท / เลขที่งาน / ชื่อช่าง"
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded sx={{ fontSize: 19, color: MUTED }} /></InputAdornment> }}
          sx={{ flex: 1, minWidth: { md: 240 }, "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "#fff" } }} />
      </FilterCard>

      {error && <Typography sx={{ color: "#dc2626", fontSize: "0.85rem", mb: 1 }}>{error}</Typography>}

      {/* ── ภาพรวม ── */}
      <TotalHero
        label="งานทั้งหมดตามตัวกรอง"
        value={`${t.total} งาน`}
        sub={`เสร็จสิ้น ${t.closed} งาน (${t.closeRate}%) · ยังไม่ปิด ${t.open} งาน · เข้างาน ${t.visits} ช่วง${showValue ? ` · มูลค่างานรวม ${baht(t.value)}` : ""}`}
        stats={summary.statusRows.map((g) => (
          <Stat key={g.key} label={g.label} value={`${g.count} งาน`} tone={g.count ? g.color : undefined}
            active={listGroup === g.key} onClick={() => setListGroup(listGroup === g.key ? "all" : g.key)} />
        ))}
        note={<>1 งานอยู่สถานะเดียว ผลรวมทุกสถานะ = {t.total} งาน · ค้างงาน = เลยวันเข้างานเกิน 1 สัปดาห์{t.severe ? <> (เกิน 2 สัปดาห์ <b style={{ color: "#dc2626" }}>{t.severe}</b> งาน)</> : ""} · กดสถานะเพื่อดูรายการ{showValue && t.missing ? ` · ยังไม่ใส่มูลค่า ${t.missing} งาน` : ""}</>}
      />

      {jobs.length === 0 ? (
        <Box sx={{ ...R_CARD, textAlign: "center", py: 6 }}>
          <Typography sx={{ fontWeight: 800, color: INK, fontSize: "1.05rem" }}>ไม่พบงานในช่วงที่เลือก</Typography>
          <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>ลองเปลี่ยนช่วงเวลา หรือล้างตัวกรอง</Typography>
        </Box>
      ) : (
        <>
          {/* ── งานค้างที่ต้องติดตาม ── */}
          {summary.overdueJobs.length > 0 && (
            <ReportSection title="งานค้างที่ต้องติดตาม" hint={`${summary.overdueJobs.length} งาน · เรียงจากค้างนานสุด · กดเพื่อดูรายละเอียด`}>
              <Box sx={{ ...R_CARD, borderColor: alpha("#dc2626", 0.3) }}>
                {overduePg.rows.map((j) => <JobRow key={j.key} j={j} avatarOf={avatarOf} showValue={showValue} onClick={() => setQuickId(j.eventId)} />)}
              </Box>
              <PageBar {...overduePg} unit="งาน" />
            </ReportSection>
          )}

          {/* ── รายเดือน / รายปี ── */}
          <ReportSection title={periodBy === "year" ? "สรุปรายปี" : "สรุปรายเดือน"} hint="จำนวนงาน · เสร็จสิ้น · ค้าง (ตามวันเริ่มงาน)"
            right={<Segmented value={periodBy} onChange={setPeriodBy} options={[["month", "รายเดือน"], ["year", "รายปี"]]} />}>
            <Box sx={R_CARD}>
              {periodRows.map((p) => (
                <BarRow key={p.key} label={periodBy === "year" ? `ปี ${Number(p.key) + 543}` : monthLabel(p.key)}
                  pct={(p.total / periodMax) * 100} value={`${p.total} งาน`}
                  sub={`เสร็จสิ้น ${p.closed} (${p.closeRate}%)${p.overdue ? ` · ค้าง ${p.overdue}` : ""}${showValue && p.value ? ` · ${baht(p.value)}` : ""}`} />
              ))}
              <TotalRow label="รวม" value={`${t.total} งาน`} valueSub={`เสร็จสิ้น ${t.closed} (${t.closeRate}%)${showValue ? ` · ${baht(t.value)}` : ""}`} />
            </Box>
          </ReportSection>

          {/* ── สรุปตามกลุ่ม ── */}
          <ReportSection title={`สรุปตาม${dimMeta[1]}`} hint="เรียงตามจำนวนงาน · อัตราปิดงาน = เสร็จสิ้น ÷ งานทั้งหมด"
            right={<Segmented value={dim} onChange={setDim} options={GROUP_DIMS.map(([k, label]) => [k, label])} />}>
            <Box sx={R_CARD}>
              {dimPg.rows.map((r, i) => (
                <RankRow key={r.key} rank={(dimPg.page - 1) * dimPg.size + i + 1}
                  leading={dim === "responsible" && r.key !== "ยังไม่มอบหมาย" ? <PersonAvatar name={r.key} avatar={avatarOf(r.key)} /> : null}
                  title={r.key}
                  sub={`เสร็จสิ้น ${r.closed} · ยังไม่ปิด ${r.open}${r.overdue ? ` · ค้าง ${r.overdue}` : ""} · ปิดแล้ว ${r.closeRate}%`}
                  value={`${r.total} งาน`}
                  valueSub={showValue && r.value ? baht(r.value) : ""} />
              ))}
              <TotalRow label={`รวม ${dimRows.length} รายการ`} value={`${t.total} งาน`} valueSub={showValue ? baht(t.value) : ""} />
            </Box>
            <PageBar {...dimPg} unit="รายการ" />
          </ReportSection>

          {/* ── รายการงาน ── */}
          <ReportSection title="รายการงาน" hint={`${listJobs.length} งาน · กดเพื่อดูรายละเอียดงาน`}
            right={listGroup !== "all" ? <Button size="small" onClick={() => setListGroup("all")} sx={{ textTransform: "none", fontWeight: 800 }}>ดูทุกสถานะ</Button> : null}>
            <Box sx={{ display: "flex", gap: 0.75, overflowX: "auto", pb: 1, mb: 0.5, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
              {[{ key: "all", label: "ทั้งหมด", count: t.total, color: ACCENT }, ...summary.statusRows].map((g) => {
                const on = listGroup === g.key;
                return (
                  <ButtonBase key={g.key} onClick={() => setListGroup(g.key)}
                    sx={{ flexShrink: 0, height: 36, px: 1.75, borderRadius: 99, fontFamily: "inherit", fontSize: "0.86rem", fontWeight: on ? 800 : 600,
                      border: `1.5px solid ${on ? ACCENT : LINE}`, color: on ? ACCENT : INK, bgcolor: on ? alpha(ACCENT, 0.06) : "#fff", gap: 0.75 }}>
                    {g.key !== "all" && <Box component="span" sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: g.color }} />}
                    {g.label}
                    <Box component="span" sx={{ fontSize: "0.76rem", fontWeight: 800, color: MUTED }}>{g.count}</Box>
                  </ButtonBase>
                );
              })}
            </Box>
            <Box sx={R_CARD}>
              {listPg.rows.map((j) => <JobRow key={j.key} j={j} avatarOf={avatarOf} showValue={showValue} onClick={() => setQuickId(j.eventId)} />)}
              {!listJobs.length && <Typography sx={{ p: 3, textAlign: "center", color: MUTED }}>ไม่มีงานในสถานะนี้</Typography>}
            </Box>
            <PageBar {...listPg} unit="งาน" />
          </ReportSection>
        </>
      )}
      <JobQuickView eventId={quickId} onClose={() => setQuickId(null)} employees={employees} showValue={showValue} />
    </Box>
  );
}
