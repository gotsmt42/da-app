/**
 * WorkerReport.js — ผลงานรายบุคคล (แท็บใน "การดำเนินงาน")
 *
 * ✅ (4 พ.ย. 2569 ผู้ใช้: "ทำให้ระบบลงแผนงานแยกรายบุคคลต่อช่างอย่างชัดเจน ... ตรวจสอบย้อนหลังว่าช่างคนไหนเข้างานที่ไหน
 *    มูลค่าต่อครั้ง แยกคน ค้นหาได้ง่าย export ชัดเจน รวมยอดต่อเดือน ปี หรือเลือกดูได้สมบูรณ์")
 * 🎨 หน้าตาแบบหน้าแรก (Agoda) — หัวข้อใหญ่บนพื้นหน้า · การ์ดขาวมุมโค้ง · รายการจัดอันดับ · ตัวสลับแคปซูล (components/ReportKit)
 *
 * บนลงล่าง: ตัวกรอง → ยอดรวมตามตัวกรอง → อันดับผู้ปฏิบัติงาน → รายเดือน/รายปี → บันทึกเข้างาน (กด = เด้งรายละเอียดงาน)
 * ⚠️ อ่านจาก /events/event-op (slim) ตัวเดียวกับหน้าการดำเนินงาน — ช่างที่ไม่มีสิทธิ์ดูทุกงาน = เห็นเฉพาะของตัวเอง
 * ⚠️ หน่วยนับ/มูลค่า: ดูหัวไฟล์ utils/workerLog.js
 */
import { useEffect, useMemo, useState } from "react";
import moment from "moment";
import { Box, Button, ButtonBase, Chip, CircularProgress, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { EngineeringRounded, SearchRounded } from "@mui/icons-material";

import SectionTabs from "@/shared/ui/SectionTabs";
import SelectField from "@/shared/ui/SelectField";
import PersonSelectField from "@/shared/ui/PersonSelectField";
import usePaged, { PageBar } from "@/shared/ui/usePaged";
import usePermissions from "@/shared/hooks/usePermissions";
import { useAuth } from "@/features/auth/AuthContext";
import EventService from "@/shared/services/EventService";
import AuthService from "@/shared/services/authService";
import AttendanceService from "@/shared/services/AttendanceService";
import JobQuickView from "@/shared/ui/JobQuickView";
import { thaiDate, THAI_MONTHS_SHORT } from "@/shared/utils/thaiDate";
import { PAGE_SX, PageHeader, INK, MUTED, LINE, ACCENT } from "@/shared/ui/PageKit";
import PeriodFilter from "../components/PeriodFilter";
import { ReportSection, Segmented, RankRow, TotalRow, Stat, TotalHero, FilterCard, BarRow, PersonAvatar, R_CARD, baht } from "../components/ReportKit";
import { periodRange, periodText, monthLabel } from "../utils/reportPeriod";
import { buildWorkerEntries, filterEntries, summarizeEntries, DONE_STATUS } from "../utils/workerLog";
import ExportExcelButton from "@/shared/ui/ExportExcelButton";

const STATUS_COLOR = { "กำลังรอยืนยัน": "#d97706", ยืนยันแล้ว: "#2563eb", กำลังดำเนินการ: "#7c3aed", [DONE_STATUS]: "#059669" };
const WARN = "#d97706";

/** แถวบันทึกเข้างาน — ช่องวันที่ · โครงการ/งาน · ผู้ปฏิบัติงาน · มูลค่า/สถานะ */
function LogRow({ r, avatar, onClick, showWorker }) {
  const tone = STATUS_COLOR[r.status] || MUTED;
  const d = moment(r.date);
  return (
    <ButtonBase onClick={onClick} component="div"
      sx={{ display: "flex", alignItems: "center", gap: { xs: 1.25, sm: 2 }, width: "100%", px: { xs: 1.5, sm: 2 }, py: 1.5, textAlign: "left", fontFamily: "inherit",
        borderTop: `1px solid ${LINE}`, "&:first-of-type": { borderTop: 0 }, bgcolor: "#fff", "&:hover": { bgcolor: alpha(ACCENT, 0.035) } }}>
      <Box sx={{ width: 54, flexShrink: 0, textAlign: "center", borderRadius: "12px", border: `1px solid ${LINE}`, overflow: "hidden" }}>
        <Box sx={{ bgcolor: "#f1f5f9", fontSize: "0.68rem", fontWeight: 800, color: MUTED, py: 0.25 }}>{THAI_MONTHS_SHORT[d.month()]} {String(d.year() + 543).slice(-2)}</Box>
        <Box sx={{ fontSize: "1.25rem", fontWeight: 900, color: INK, lineHeight: 1.35 }}>{d.date()}</Box>
        {r.days > 1 && <Box sx={{ fontSize: "0.64rem", color: MUTED, pb: 0.25 }}>{r.days} วัน</Box>}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: "0.98rem", fontWeight: 800, color: INK }}>{r.site || r.company || "-"}</Typography>
        <Typography noWrap sx={{ fontSize: "0.82rem", color: MUTED }}>
          {[r.title, r.system, r.time ? `ครั้งที่ ${r.time}` : "", r.jobNo].filter(Boolean).join(" · ")}
        </Typography>
        {showWorker && (
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.6 }}>
            <PersonAvatar name={r.name} avatar={avatar} size={22} />
            <Typography noWrap sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK }}>{r.name}</Typography>
            <Box component="span" sx={{ fontSize: "0.7rem", fontWeight: 800, color: r.lead ? "#1d4ed8" : MUTED, bgcolor: r.lead ? "#dbeafe" : "#f1f5f9", borderRadius: "6px", px: 0.75, py: 0.1, flexShrink: 0 }}>
              {r.lead ? "หัวหน้าทีม" : "ทีม"}
            </Box>
          </Stack>
        )}
      </Box>
      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
        {r.value === null
          ? <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: WARN }}>ยังไม่ใส่มูลค่า</Typography>
          : <Typography sx={{ fontSize: "1rem", fontWeight: 800, color: INK, fontVariantNumeric: "tabular-nums" }}>{baht(r.value)}</Typography>}
        <Stack direction="row" spacing={0.5} justifyContent="flex-end" sx={{ mt: 0.5 }}>
          {/* ✅ กดเข้างานจริงของคนนี้ (เวลาแรก) — ไม่มี = ยังไม่กด */}
          <Box component="span" sx={{ fontSize: "0.72rem", fontWeight: 800, borderRadius: "6px", px: 0.9, py: 0.2,
            color: r.checkIns?.length ? "#15803d" : "#b45309", bgcolor: r.checkIns?.length ? "#f0fdf4" : "#fffbeb" }}>
            {r.checkIns?.length ? `✓ เข้างาน ${moment(r.checkIns[0]).format("HH:mm")}${r.checkIns.length > 1 ? ` (${r.checkIns.length} วัน)` : ""}` : "ยังไม่กดเข้างาน"}
          </Box>
          <Box component="span" sx={{ fontSize: "0.72rem", fontWeight: 800, color: tone, bgcolor: alpha(tone, 0.1), borderRadius: "6px", px: 0.9, py: 0.2 }}>{r.status || "—"}</Box>
        </Stack>
      </Box>
    </ButtonBase>
  );
}

export default function WorkerReport() {
  const { can } = usePermissions();
  const { userData } = useAuth();
  const viewAll = can("viewAllJobs") || can("approveJobs");
  const myName = userData?.fname || "";

  const [events, setEvents] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [error, setError] = useState("");
  const [employees, setEmployees] = useState([]);
  const [period, setPeriod] = useState({
    preset: "month", month: moment().format("YYYY-MM"), year: moment().format("YYYY"),
    from: moment().startOf("month").format("YYYY-MM-DD"), to: moment().format("YYYY-MM-DD"),
  });
  const [quickId, setQuickId] = useState(null);
  const [person, setPerson] = useState("all");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [valueMode, setValueMode] = useState("all");
  const [periodBy, setPeriodBy] = useState("month");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let alive = true;
    EventService.getEventOp({ slim: true })
      .then((res) => { if (alive) setEvents(res?.userEvents || []); })
      .catch(() => { if (alive) { setEvents([]); setError("ดึงข้อมูลงานไม่สำเร็จ — ลองใหม่อีกครั้ง"); } });
    AuthService.getAllUserData().then((r) => { if (alive) setEmployees(r?.allUser || []); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // ✅ (4 พ.ย. 2569 ผู้ใช้: "เข้างานแยกรายคน ... ให้สอดคล้องกับที่จะแยกดูผลงาน และมูลค่างานแยกคน") บันทึกเข้างานรายคน (ทั้งงานที่ปิดแล้ว) ตามช่วงที่เลือก — ผูกกับแถว "คน × งาน"
  const [rFrom0, rTo0] = periodRange(period.preset, period);
  useEffect(() => {
    let alive = true;
    // เผื่อ 60 วันก่อนช่วง: งานที่เริ่มในช่วงอาจกดเข้างานวันหลังๆ — กรองตามงานอยู่แล้ว ไม่นับเกิน
    const from = rFrom0 ? moment(rFrom0).subtract(7, "days").format("YYYY-MM-DD") : undefined;
    const to = rTo0 ? moment(rTo0).add(60, "days").format("YYYY-MM-DD") : undefined;
    AttendanceService.list({ from, to, includeClosed: 1 })
      .then((r) => { if (alive) setAttendance(r?.attendance || []); })
      .catch(() => { if (alive) setAttendance([]); });
    return () => { alive = false; };
  }, [rFrom0, rTo0]);

  const avatarOf = useMemo(() => {
    const m = new Map(employees.map((e) => [e.fname, e.imageUrl]));
    return (n) => m.get(n);
  }, [employees]);

  const allEntries = useMemo(() => (events ? buildWorkerEntries(events, attendance) : []), [events, attendance]);
  const [rFrom, rTo] = periodRange(period.preset, period);
  const effPerson = viewAll ? person : (myName || "__none__");

  // ตัวเลือกคน — นับตามช่วงเวลา/ค้นหา/สถานะ (ไม่นับตัวกรองคนเอง) ให้เห็นว่าเลือกแล้วได้กี่ครั้ง
  const personOptions = useMemo(() => {
    const base = filterEntries(allEntries, { from: rFrom, to: rTo, q, status, valueMode });
    const m = new Map();
    base.forEach((r) => m.set(r.name, (m.get(r.name) || 0) + 1));
    return { list: [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "th")), total: base.length };
  }, [allEntries, rFrom, rTo, q, status, valueMode]);

  const entries = useMemo(
    () => filterEntries(allEntries, { from: rFrom, to: rTo, person: effPerson, q, status, valueMode }),
    [allEntries, rFrom, rTo, effPerson, q, status, valueMode],
  );
  const summary = useMemo(() => summarizeEntries(entries), [entries]);
  const t = summary.totals;

  const years = useMemo(() => [...new Set(allEntries.map((r) => r.date.slice(0, 4)))], [allEntries]);

  const periodLabel = periodText(period.preset, rFrom, rTo);
  const filterLabel = [
    effPerson !== "all" ? `ผู้ปฏิบัติงาน: ${effPerson}` : "ทุกคน",
    q.trim() ? `ค้นหา: ${q.trim()}` : "",
    status === "done" ? "เฉพาะงานที่เสร็จสิ้น" : status === "open" ? "เฉพาะงานที่ยังไม่ปิด" : "",
    valueMode === "has" ? "เฉพาะที่ใส่มูลค่าแล้ว" : valueMode === "missing" ? "เฉพาะที่ยังไม่ใส่มูลค่า" : "",
  ].filter(Boolean).join(" · ");

  const personPg = usePaged(summary.byPerson, 10);
  const logPg = usePaged(entries, 20);
  const periodRows = periodBy === "year" ? summary.byYear.slice().reverse() : summary.byMonth.slice().reverse();
  const periodMax = Math.max(1, ...periodRows.map((p) => p.total));
  const showWorker = effPerson === "all";

  const doExport = async () => {
    setExporting(true);
    try {
      const { exportWorkerLog } = await import("../utils/workerLogExcel");
      await exportWorkerLog(entries, summary, {
        periodLabel, filterLabel,
        fileName: `ผลงานรายบุคคล ${effPerson !== "all" ? `${effPerson} ` : ""}${periodLabel.replace(/[/\\:*?"<>|]/g, "-")}`,
      });
    } catch (err) {
      setError(err?.message || "ส่งออก Excel ไม่สำเร็จ");
    } finally {
      setExporting(false);
    }
  };

  if (!events) return <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress size={26} /></Stack>;

  const exportBtn = <ExportExcelButton onClick={doExport} loading={exporting} disabled={!entries.length} />;

  return (
    <Box sx={{ ...PAGE_SX, maxWidth: "none" }}>
      <SectionTabs group="operation" />
      <PageHeader icon={<EngineeringRounded />} title="ผลงานรายบุคคล"
        subtitle="ใครเข้างานที่ไหน เมื่อไร มูลค่าต่อครั้ง — แยกรายคน รวมยอดรายเดือน/รายปี"
        actions={exportBtn} />

      {/* ── ตัวกรอง ── */}
      <FilterCard footer={`${periodLabel} · ${filterLabel} · นับตามวันแรกที่เข้างาน`}>
        <PeriodFilter value={period} onChange={(patch) => setPeriod((p) => ({ ...p, ...patch }))} years={years} />
        {viewAll ? (
          <PersonSelectField label="ผู้ปฏิบัติงาน" title="เลือกผู้ปฏิบัติงาน" value={person} onChange={setPerson}
            allLabel="ทุกคน" allCount={personOptions.total} unit="ครั้ง"
            options={personOptions.list.map(([name, n]) => ({ id: name, name, count: n, avatar: avatarOf(name) }))}
            sx={{ minWidth: { xs: "100%", md: 230 } }} />
        ) : (
          <Chip avatar={<PersonAvatar name={myName} avatar={avatarOf(myName)} size={24} />} label={`ของฉัน: ${myName || "-"}`}
            sx={{ height: 40, borderRadius: 2, fontWeight: 700, bgcolor: "#fff", border: `1px solid ${LINE}` }} />
        )}
        <TextField size="small" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา โครงการ / บริษัท / ระบบ / เลขที่งาน"
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded sx={{ fontSize: 19, color: MUTED }} /></InputAdornment> }}
          sx={{ flex: 1, minWidth: { md: 240 }, "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "#fff" } }} />
        <SelectField label="สถานะงาน" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 140 }}>
          <option value="all">ทุกสถานะ</option>
          <option value="done">เสร็จสิ้นแล้ว</option>
          <option value="open">ยังไม่ปิด</option>
        </SelectField>
        <SelectField label="มูลค่างาน" value={valueMode} onChange={(e) => setValueMode(e.target.value)} sx={{ minWidth: 140 }}>
          <option value="all">ทั้งหมด</option>
          <option value="has">ใส่มูลค่าแล้ว</option>
          <option value="missing">ยังไม่ใส่มูลค่า</option>
        </SelectField>
      </FilterCard>

      {error && <Typography sx={{ color: "#dc2626", fontSize: "0.85rem", mb: 1 }}>{error}</Typography>}

      {/* ── ยอดรวมตามตัวกรอง ── */}
      <TotalHero
        label={effPerson !== "all" ? `มูลค่างานรวมของ ${effPerson}` : "มูลค่างานรวมตามตัวกรอง"}
        value={baht(t.total)}
        sub={`${periodLabel} · ${filterLabel}`}
        stats={[
          <Stat key="v" label="เข้างาน" value={`${t.visits} ครั้ง`} />,
          <Stat key="j" label="จำนวนงาน" value={`${t.jobs} งาน`} />,
          <Stat key="d" label="วันทำงานรวม" value={`${t.days} วัน`} />,
          <Stat key="p" label="ผู้ปฏิบัติงาน" value={`${t.people} คน`} />,
          <Stat key="c" label="กดเข้างานจริง" value={`${t.checked}/${t.visits} ครั้ง`} tone={t.checked < t.visits ? "#b45309" : "#15803d"} />,
          <Stat key="a" label="เฉลี่ยต่อครั้ง" value={t.valued ? baht(t.avg) : "–"} />,
          <Stat key="m" label="ยังไม่ใส่มูลค่า" value={`${t.missing} ครั้ง`} tone={t.missing ? WARN : undefined}
            active={valueMode === "missing"} onClick={t.missing || valueMode === "missing" ? () => setValueMode(valueMode === "missing" ? "all" : "missing") : undefined} />,
        ]}
        note={effPerson === "all" && t.people > 1
          ? <>ยอดนี้นับให้ทุกคนในทีมเต็มจำนวน · มูลค่างานจริง (นับงานละครั้ง) <b style={{ color: INK }}>{baht(t.jobValueTotal)}</b> จาก {t.jobs} งาน</>
          : null}
      />

      {entries.length === 0 ? (
        <Box sx={{ ...R_CARD, textAlign: "center", py: 6 }}>
          <Typography sx={{ fontWeight: 800, color: INK, fontSize: "1.05rem" }}>ไม่พบการเข้างานในช่วงที่เลือก</Typography>
          <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>ลองเปลี่ยนช่วงเวลา หรือล้างคำค้นหา</Typography>
        </Box>
      ) : (
        <>
          {/* ── อันดับผู้ปฏิบัติงาน ── */}
          {viewAll && (
            <ReportSection title="อันดับผู้ปฏิบัติงาน" hint="เรียงตามมูลค่างานรวม · กดชื่อเพื่อดูเฉพาะคนนั้น"
              right={person !== "all" ? <Button size="small" onClick={() => setPerson("all")} sx={{ textTransform: "none", fontWeight: 800 }}>ดูทุกคน</Button> : null}>
              <Box sx={R_CARD}>
                {personPg.rows.map((p, i) => (
                  <RankRow key={p.key} rank={(personPg.page - 1) * personPg.size + i + 1}
                    leading={<PersonAvatar name={p.key} avatar={avatarOf(p.key)} />}
                    title={p.key}
                    sub={`เข้างาน ${p.visits} ครั้ง · กดเข้างานจริง ${p.checked}/${p.visits} · หัวหน้าทีม ${p.lead} · ล่าสุด ${thaiDate(p.last)}`}
                    value={baht(p.total)}
                    valueSub={p.missing ? <span style={{ color: WARN, fontWeight: 700 }}>ยังไม่ใส่มูลค่า {p.missing} ครั้ง</span> : p.valued ? `เฉลี่ย ${baht(p.avg)} / ครั้ง` : ""}
                    active={person === p.key}
                    onClick={() => setPerson(person === p.key ? "all" : p.key)} />
                ))}
                <TotalRow label={`รวม ${summary.byPerson.length} คน · ${t.visits} ครั้ง`} value={baht(t.total)} valueSub={t.missing ? `ยังไม่ใส่มูลค่า ${t.missing} ครั้ง` : ""} />
              </Box>
              <PageBar {...personPg} unit="คน" />
            </ReportSection>
          )}

          {/* ── รายเดือน / รายปี ── */}
          <ReportSection title={periodBy === "year" ? "สรุปรายปี" : "สรุปรายเดือน"}
            hint={`${effPerson !== "all" ? `${effPerson} · ` : ""}มูลค่างานรวม และจำนวนครั้งที่เข้างาน`}
            right={<Segmented value={periodBy} onChange={setPeriodBy} options={[["month", "รายเดือน"], ["year", "รายปี"]]} />}>
            <Box sx={R_CARD}>
              {periodRows.map((p) => (
                <BarRow key={p.key} label={periodBy === "year" ? `ปี ${Number(p.key) + 543}` : monthLabel(p.key)}
                  pct={(p.total / periodMax) * 100} value={baht(p.total)}
                  sub={`${p.visits} ครั้ง · ${p.people} คน${p.missing ? ` · ยังไม่ใส่ ${p.missing}` : ""}`} />
              ))}
              <TotalRow label="รวม" value={baht(t.total)} valueSub={`${t.visits} ครั้ง`} />
            </Box>
          </ReportSection>

          {/* ── บันทึกเข้างาน ── */}
          <ReportSection title="บันทึกเข้างาน" hint={`${entries.length} รายการ · 1 รายการ = 1 คน × 1 งาน · กดเพื่อดูรายละเอียดงาน`}>
            <Box sx={R_CARD}>
              {logPg.rows.map((r) => (
                <LogRow key={r.id} r={r} avatar={avatarOf(r.name)} showWorker={showWorker} onClick={() => setQuickId(r.eventId)} />
              ))}
              <TotalRow label={`รวมทั้งหมด ${entries.length} รายการ (ทุกหน้า)`} value={baht(t.total)} />
            </Box>
            <PageBar {...logPg} unit="รายการ" />
          </ReportSection>
        </>
      )}
      <JobQuickView eventId={quickId} onClose={() => setQuickId(null)} employees={employees} showValue />
    </Box>
  );
}
