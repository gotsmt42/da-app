/**
 * WorkerReport.js — ผลงานรายบุคคล (แท็บใน "การดำเนินงาน")
 *
 * ✅ (4 พ.ย. 2569 ผู้ใช้: "ทำให้ระบบลงแผนงานแยกรายบุคคลต่อช่างอย่างชัดเจน ... ตรวจสอบย้อนหลังว่าช่างคนไหนเข้างานที่ไหน
 *    มูลค่าต่อครั้ง แยกคน ค้นหาได้ง่าย export ชัดเจน รวมยอดต่อเดือน ปี หรือเลือกดูได้สมบูรณ์")
 * 🎨 หน้าตาแบบหน้าแรก (Agoda) — หัวข้อใหญ่บนพื้นหน้า · การ์ดขาวมุมโค้ง · รายการจัดอันดับ · ตัวสลับแคปซูล (components/ReportKit)
 *
 * บนลงล่าง: ตัวกรอง → ยอดรวมตามตัวกรอง → สรุปยอดและ KPI รายคน (+ วิธีเช็ค KPI) → รายเดือน/รายปี → บันทึกเข้างาน (กด = เด้งรายละเอียดงาน)
 * ⚠️ อ่านจาก /events/event-op (slim) ตัวเดียวกับหน้าการดำเนินงาน — ช่างที่ไม่มีสิทธิ์ดูทุกงาน = เห็นเฉพาะของตัวเอง
 * ⚠️ หน่วยนับ/มูลค่า: ดูหัวไฟล์ utils/workerLog.js
 */
import { useEffect, useMemo, useState } from "react";
import moment from "moment";
import { useSearchParams } from "react-router-dom";
import { Box, Chip, CircularProgress, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import { EngineeringRounded, SearchRounded } from "@mui/icons-material";

import SectionTabs from "@/shared/ui/SectionTabs";
import SelectField from "@/shared/ui/SelectField";
import PersonSelectField from "@/shared/ui/PersonSelectField";
import usePermissions from "@/shared/hooks/usePermissions";
import { useAuth } from "@/features/auth/AuthContext";
import EventService from "@/shared/services/EventService";
import AuthService from "@/shared/services/authService";
import AttendanceService from "@/shared/services/AttendanceService";
import JobQuickView from "@/shared/ui/JobQuickView";
import { PAGE_SX, PageHeader, INK, MUTED, LINE } from "@/shared/ui/PageKit";
import PeriodFilter from "../components/PeriodFilter";
import { ReportSection, Segmented, TotalRow, Stat, TotalHero, FilterCard, BarRow, PersonAvatar, R_CARD, baht } from "../components/ReportKit";
import WorkerKpiPanel, { KpiGuide } from "../components/WorkerKpiPanel";
import { periodRange, periodText, monthLabel } from "../utils/reportPeriod";
import { buildWorkerEntries, filterEntries, summarizeEntries } from "../utils/workerLog";
import ExportExcelButton from "@/shared/ui/ExportExcelButton";
import ReportScopeBar from "../components/ReportScopeBar";


export default function WorkerReport() {
  const { can } = usePermissions();
  const { userData } = useAuth();
  const viewAll = can("viewAllJobs") || can("approveJobs");
  const myName = userData?.fname || "";
  // ✅ (17 พ.ย. 2569) ?person=ชื่อ — เปิดมาที่ผลงานของคนนั้น (กดจากการ์ด "ผลงานรายคน" หน้าแรก) · ?period=lastMonth|year ช่วงเดียวกับหน้าแรก
  const [searchParams] = useSearchParams();

  const [events, setEvents] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [error, setError] = useState("");
  const [employees, setEmployees] = useState([]);
  const [period, setPeriod] = useState({
    preset: ["month", "lastMonth", "year"].includes(searchParams.get("period")) ? searchParams.get("period") : "month", month: moment().format("YYYY-MM"), year: moment().format("YYYY"),
    from: moment().startOf("month").format("YYYY-MM-DD"), to: moment().format("YYYY-MM-DD"),
  });
  const [quickId, setQuickId] = useState(null);
  const [person, setPerson] = useState(() => searchParams.get("person") || "all");
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
    valueMode === "has" ? "เฉพาะที่บันทึกมูลค่างานที่ทำแล้ว" : valueMode === "missing" ? "เฉพาะที่ยังไม่บันทึกมูลค่างานที่ทำ" : "",
  ].filter(Boolean).join(" · ");

  const periodRows = periodBy === "year" ? summary.byYear.slice().reverse() : summary.byMonth.slice().reverse();
  const periodMax = Math.max(1, ...periodRows.map((p) => p.total));
  const visitMax = Math.max(1, ...periodRows.map((p) => p.visits));
  const single = effPerson !== "all" || t.people <= 1; // คนเดียว = แสดงยอดเงินของคนนั้นได้

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
        subtitle="มูลค่างานที่แต่ละคนทำ แยกรายคน · KPI ช่าง · รายเดือน/รายปี"
        actions={exportBtn} />
      {/* ✅ (17 พ.ย. 2569 ผู้ใช้: "2 แท็บนี้ข้อมูลเหมือนกันไหม") หน้านี้นับอะไร + เทียบกับสรุปผลการดำเนินงาน */}
      <ReportScopeBar scope="workers" />

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
        {/* 🔁 (17 พ.ย. 2569) กรองตาม "มูลค่างานที่ทำ" ที่แต่ละคนบันทึกเอง (ยอดรายคน) — ไม่ใช่มูลค่าครั้งนี้ของงาน */}
        <SelectField label="มูลค่างานที่ทำ (รายคน)" value={valueMode} onChange={(e) => setValueMode(e.target.value)} sx={{ minWidth: 170 }}>
          <option value="all">ทั้งหมด</option>
          <option value="has">บันทึกแล้ว</option>
          <option value="missing">ยังไม่บันทึก</option>
        </SelectField>
      </FilterCard>

      {error && <Typography sx={{ color: "#dc2626", fontSize: "0.85rem", mb: 1 }}>{error}</Typography>}

      {/* ── ลำดับความสำคัญของหน้า ──
          🔁 (17 พ.ย. 2569 ผู้ใช้: "จัดวางให้มองง่าย อันไหนควรเด่น อันไหนควรมาก่อน ให้มืออาชีพ")
          1) ภาพรวมการเข้างาน (จำนวน — แสดงเมื่อดูหลายคน · ดูคนเดียว = แผงของคนนั้นเป็นตัวหลักแทน ไม่ซ้ำ)
          🔁 (17 พ.ย. 2569 ผู้ใช้: "ยอดที่ลงไม่นำมารวมกัน แยกเป็นผลงานของแต่ละคน") ไม่มียอดเงินรวมทุกคน — ยอดเงินดูรายคนเท่านั้น
          2) ยอดแยกรายคน (ตาราง/แผงรายละเอียด)  3) แนวโน้มรายเดือน  4) วิธีเช็ค KPI (อ้างอิง ท้ายหน้า) */}
      {entries.length > 0 && t.people > 1 && (
        <TotalHero
          label="ภาพรวมการเข้างาน"
          value={`${t.people} คน`}
          sub={periodLabel}
          stats={[
            <Stat key="j" label="จำนวนงาน" value={`${t.jobs} งาน`} />,
            <Stat key="v" label="เข้างาน (คน × งาน)" value={`${t.visits} ครั้ง`} />,
            <Stat key="d" label="วันทำงานรวม" value={`${t.days} วัน`} />,
            <Stat key="m" label="บันทึกมูลค่าแล้ว" value={`${t.valued} / ${t.visits}`} tone={t.missing ? "#b45309" : undefined} />,
          ]}
          note={<>"มูลค่าครั้งนี้" ที่ช่างแต่ละคนลง = ผลงานของคนนั้น ไม่นำมารวมกัน — ดูยอดของแต่ละคนในตารางด้านล่าง</>}
        />
      )}

      {entries.length === 0 ? (
        <Box sx={{ ...R_CARD, textAlign: "center", py: 6 }}>
          <Typography sx={{ fontWeight: 800, color: INK, fontSize: "1.05rem" }}>ไม่พบการเข้างานในช่วงที่เลือก</Typography>
          <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>ลองเปลี่ยนช่วงเวลา หรือล้างคำค้นหา</Typography>
        </Box>
      ) : (
        <>
          {/* ── สรุปยอดและ KPI รายคน ──
              🔁 (17 พ.ย. 2569 ผู้ใช้: "ทำสรุปรายงาน ยอดของแต่ละคนแยกกันให้ชัดเจน และมีวิธีแนะนำว่าจะเช็ค KPI ยังไง")
              แทน "อันดับผู้ปฏิบัติงาน" เดิม — การ์ดต่อคน (มูลค่างานที่ทำ · ต่อวัน · อัตรา % เทียบเกณฑ์ · รายการที่ต้องแก้)
              ตัวเลข/เกณฑ์อยู่ที่ utils/workerKpi.js ที่เดียว (ใช้ร่วมกับ Excel) */}
          <WorkerKpiPanel entries={entries} avatarOf={avatarOf} activePerson={person}
            onPickPerson={viewAll ? setPerson : undefined} onOpenJob={setQuickId} />

          {/* ── รายเดือน / รายปี ── */}
          <ReportSection title={periodBy === "year" ? "แนวโน้มรายปี" : "แนวโน้มรายเดือน"}
            hint={effPerson !== "all" ? `${effPerson} · มูลค่างานที่ทำ และจำนวนครั้งที่เข้างาน` : "จำนวนครั้งที่เข้างาน และจำนวนคน (ยอดเงินดูรายคน)"}
            right={<Segmented value={periodBy} onChange={setPeriodBy} options={[["month", "รายเดือน"], ["year", "รายปี"]]} />}>
            <Box sx={R_CARD}>
              {/* ดูคนเดียว = มูลค่าของคนนั้นรายเดือน · ดูทุกคน = จำนวนครั้ง (ไม่รวมยอดเงินของหลายคน) */}
              {periodRows.map((p) => (
                <BarRow key={p.key} label={periodBy === "year" ? `ปี ${Number(p.key) + 543}` : monthLabel(p.key)}
                  pct={(single ? p.total / periodMax : p.visits / visitMax) * 100}
                  value={single ? baht(p.total) : `${p.visits} ครั้ง`}
                  sub={single ? `${p.visits} ครั้ง${p.missing ? ` · ยังไม่ลง ${p.missing}` : ""}` : `${p.people} คน${p.missing ? ` · ยังไม่ลงมูลค่า ${p.missing}` : ""}`} />
              ))}
              <TotalRow label="รวม" value={single ? baht(t.total) : `${t.visits} ครั้ง`} valueSub={single ? `${t.visits} ครั้ง` : `${t.people} คน`} />
            </Box>
          </ReportSection>

          {/* 🔁 (17 พ.ย. 2569 ผู้ใช้: "ตรงนี้ควรตัดออกไหม มีหน้าบันทึกงานอยู่แล้ว") ตัดรายการเข้างานทั้งหมดออก —
              ซ้ำกับแท็บ "ประวัติเข้างาน" และแผงรายละเอียดรายคน (กดชื่อ = เห็นงานที่เข้าทุกงานของคนนั้น) · Excel ยังมีชีตบันทึกเข้างานครบ */}

          {/* อ้างอิง — ท้ายหน้า พับไว้ */}
          <KpiGuide />
        </>
      )}
      <JobQuickView eventId={quickId} onClose={() => setQuickId(null)} employees={employees} showValue />
    </Box>
  );
}
