/**
 * JobReport.js — รายงานงาน (คู่กับ "รายงานการเบิก" ของหมวดเบิกค่าใช้จ่าย)
 *
 * ✅ ผู้ใช้สั่ง: "เพิ่มรายงานในแถบเมนูงาน ให้เหมือนกับแถบเบิกค่าใช้จ่าย"
 *    จึงใช้โครงเดียวกับ ExpenseReport.js — ตัวเลือกช่วงเวลา → แถบตัวเลขสรุป → แผงกราฟ → ตารางสรุป
 *    คนที่ใช้รายงานการเบิกเป็นอยู่แล้ว จะใช้หน้านี้ได้ทันทีโดยไม่ต้องเรียนรู้ใหม่
 *
 * ⚠️ ไม่ได้ยิง endpoint ใหม่ — อ่านจาก /events/event-op ตัวเดียวกับหน้าการดำเนินงาน
 *    การมองเห็นจึงเท่ากับหน้านั้นเป๊ะโดยอัตโนมัติ (ช่างเห็นเฉพาะงานตัวเอง เซลเห็นของฝ่ายขาย)
 *    ถ้าแยกไปทำ endpoint ใหม่ จะต้องดูแลตัวกรองสิทธิ์สองชุดให้ตรงกันตลอดไป
 * ⚠️ "ค้างงาน" ใช้ buildDaysPastDueMap ตัวเดียวกับหน้าอื่น และต้องคำนวณจากงาน "ทั้งหมด"
 *    ก่อนกรองช่วงวันเสมอ — ไม่งั้นงานที่เข้าหลายวันจะถูกหั่นจนวันครบกำหนดเพี้ยน
 */
import { useEffect, useMemo, useState } from "react";
import {
  Box, Stack, Typography, ToggleButton, ToggleButtonGroup, CircularProgress, Alert, Tooltip,
  Table, TableBody, TableCell, TableHead, TableRow, LinearProgress,
} from "@mui/material";
import { Assessment } from "@mui/icons-material";
import moment from "moment";

import EventService from "@/shared/services/EventService";
import { buildDaysPastDueMap } from "@/shared/utils/overdueJobs";
import { THAI_MONTHS_SHORT } from "@/shared/utils/thaiDate";
import { buildJobReport } from "../utils/jobReport";

const ACCENT = "#8b5cf6";        // สีประจำหมวด "งาน" เดียวกับการ์ดเมนูหน้าแรก
const BORDER = "#e2e8f0";
const TEXT_SUB = "#64748b";

/** ช่วงเวลาชุดเดียวกับรายงานการเบิก — คนใช้สองหน้านี้สลับกันจะได้ไม่ต้องจำคนละชุด */
const PRESETS = [
  { value: "month", label: "เดือนนี้", range: () => [moment().startOf("month"), moment()] },
  { value: "lastMonth", label: "เดือนที่แล้ว", range: () => [moment().subtract(1, "month").startOf("month"), moment().subtract(1, "month").endOf("month")] },
  { value: "quarter", label: "ไตรมาสนี้", range: () => [moment().startOf("quarter"), moment()] },
  { value: "year", label: "ปีนี้", range: () => [moment().startOf("year"), moment()] },
  { value: "12m", label: "12 เดือนล่าสุด", range: () => [moment().subtract(11, "months").startOf("month"), moment()] },
  { value: "all", label: "ทั้งหมด", range: () => [null, null] },
];

const monthLabel = (key) => {
  const [y, m] = String(key).split("-");
  return `${THAI_MONTHS_SHORT[Number(m) - 1]} ${String(Number(y) + 543).slice(-2)}`;
};

const Kpi = ({ label, value, sub, color }) => (
  <Box sx={{ border: `1px solid ${BORDER}`, borderRadius: 2.5, p: 1.5, bgcolor: "#fff", minWidth: 0 }}>
    <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>{label}</Typography>
    <Typography sx={{ fontWeight: 900, fontSize: "1.35rem", lineHeight: 1.2, color: color || "#0f172a" }}>{value}</Typography>
    {sub && <Typography variant="caption" sx={{ color: TEXT_SUB }}>{sub}</Typography>}
  </Box>
);

const Panel = ({ title, hint, children }) => (
  <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 2.5, p: { xs: 1.5, sm: 2 }, mb: 1.75 }}>
    <Typography sx={{ fontWeight: 900, fontSize: "0.95rem" }}>{title}</Typography>
    {hint && <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mb: 1.25 }}>{hint}</Typography>}
    {children}
  </Box>
);

/** แถบสัดส่วนขั้นของงาน — อ่าน "คิวงานกองอยู่ขั้นไหน" ได้ในแวบเดียว */
const Pipeline = ({ rows, total }) => (
  <Stack spacing={0.9}>
    {rows.map((r) => (
      <Box key={r.key}>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>{r.label}</Typography>
          <Typography variant="caption" sx={{ color: TEXT_SUB }}>{r.count} งาน</Typography>
        </Stack>
        <LinearProgress
          variant="determinate" value={total ? (r.count / total) * 100 : 0}
          sx={{ height: 7, borderRadius: 4, bgcolor: "#f1f5f9", "& .MuiLinearProgress-bar": { bgcolor: r.color, borderRadius: 4 } }}
        />
      </Box>
    ))}
  </Stack>
);

/**
 * กราฟแท่งรายเดือน — แท่งจาง = งานทั้งหมด · แท่งเข้ม = ที่ปิดแล้ว
 * ⚠️ ความสูงคิดเทียบกับเดือนที่มากที่สุดเสมอ ไม่ใช่ค่าคงที่ ไม่งั้นเดือนที่งานน้อยจะเตี้ยจนมองไม่เห็น
 */
const MonthBars = ({ rows }) => {
  const max = Math.max(1, ...rows.map((r) => r.total));
  if (!rows.length) return <Typography variant="caption" sx={{ color: TEXT_SUB }}>ไม่มีงานในช่วงที่เลือก</Typography>;
  return (
    <Stack direction="row" alignItems="flex-end" spacing={0.75} sx={{ overflowX: "auto", pb: 0.5 }}>
      {rows.map((r) => (
        <Tooltip key={r.key} arrow title={`${monthLabel(r.key)} · ${r.total} งาน · ปิดแล้ว ${r.done} · ค้าง ${r.overdue}`}>
          <Box sx={{ minWidth: 34, textAlign: "center" }}>
            <Box sx={{ height: 90, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
              <Box sx={{ width: 18, height: `${(r.total / max) * 100}%`, bgcolor: "#ede9fe", borderRadius: "4px 4px 0 0", position: "relative" }}>
                <Box sx={{ position: "absolute", bottom: 0, left: 0, right: 0, height: r.total ? `${(r.done / r.total) * 100}%` : 0, bgcolor: ACCENT, borderRadius: "4px 4px 0 0" }} />
              </Box>
            </Box>
            <Typography variant="caption" sx={{ color: TEXT_SUB, fontSize: "0.65rem" }}>{monthLabel(r.key)}</Typography>
          </Box>
        </Tooltip>
      ))}
    </Stack>
  );
};

const SummaryTable = ({ rows, firstHeader }) => (
  <Table size="small">
    <TableHead>
      <TableRow>
        <TableCell sx={{ fontWeight: 800 }}>{firstHeader}</TableCell>
        <TableCell align="right" sx={{ fontWeight: 800 }}>งาน</TableCell>
        <TableCell align="right" sx={{ fontWeight: 800 }}>ปิดแล้ว</TableCell>
        <TableCell align="right" sx={{ fontWeight: 800 }}>ค้าง</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {rows.slice(0, 15).map((r) => (
        <TableRow key={r.key}>
          <TableCell sx={{ maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.key}</TableCell>
          <TableCell align="right">{r.total}</TableCell>
          <TableCell align="right">{r.done}</TableCell>
          <TableCell align="right" sx={{ color: r.overdue ? "#dc2626" : TEXT_SUB, fontWeight: r.overdue ? 800 : 400 }}>{r.overdue}</TableCell>
        </TableRow>
      ))}
      {!rows.length && (
        <TableRow><TableCell colSpan={4}><Typography variant="caption" sx={{ color: TEXT_SUB }}>ไม่มีข้อมูล</Typography></TableCell></TableRow>
      )}
    </TableBody>
  </Table>
);

export default function JobReport() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState("");
  const [preset, setPreset] = useState("12m");
  const [group, setGroup] = useState("customer");

  useEffect(() => {
    let alive = true;
    // ⚠️ endpoint นี้คืน { userEvents: [...] } ไม่ใช่อาร์เรย์ตรงๆ (เหมือนที่ OperationBoard ทำ)
    // ⚠️ slim = ขอเฉพาะฟิลด์ที่ใช้สรุป — รายงานไม่ได้แสดงไฟล์แนบ/คอมเมนต์/ประวัติกิจกรรม
    //    ที่ 1000 งาน แบบเต็มราว 3.6 MB ต่อการเปิดหนึ่งครั้ง แบบนี้เหลือราว 1 ใน 10
    EventService.getEventOp({ slim: true })
      .then((res) => { if (alive) setEvents(res?.userEvents || []); })
      .catch(() => { if (alive) { setEvents([]); setError("ดึงข้อมูลงานไม่สำเร็จ — ลองใหม่อีกครั้ง"); } });
    return () => { alive = false; };
  }, []);

  const report = useMemo(() => {
    if (!events) return null;
    const [a, b] = (PRESETS.find((p) => p.value === preset) || PRESETS[0]).range();
    return buildJobReport(events, {
      // ⚠️ คิดวันค้างจากงานทั้งหมดก่อนกรองช่วงเสมอ
      daysPastDueMap: buildDaysPastDueMap(events),
      from: a ? a.format("YYYY-MM-DD") : undefined,
      to: b ? b.format("YYYY-MM-DD") : undefined,
    });
  }, [events, preset]);

  if (!events) {
    return <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress size={26} /></Stack>;
  }

  return (
    <Box sx={{ p: { xs: 1.25, sm: 2.5 }, maxWidth: 1100, mx: "auto" }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2.5, bgcolor: ACCENT, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Assessment />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 900, fontSize: "1.3rem", color: "#0f172a", lineHeight: 1.25 }}>รายงานงาน</Typography>
          <Typography variant="caption" sx={{ color: TEXT_SUB }}>
            นับเป็น “งาน” — งานที่เข้าหลายวันไม่ติดกันนับเป็นงานเดียว ตรงกับการ์ดในหน้าการดำเนินงาน
          </Typography>
        </Box>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}

      <ToggleButtonGroup
        exclusive size="small" value={preset} onChange={(e, v) => v && setPreset(v)}
        sx={{ mb: 2, flexWrap: "wrap", gap: 0.5, "& .MuiToggleButton-root": { border: `1px solid ${BORDER}`, borderRadius: "999px !important", px: 1.5, textTransform: "none" } }}
      >
        {PRESETS.map((p) => <ToggleButton key={p.value} value={p.value}>{p.label}</ToggleButton>)}
      </ToggleButtonGroup>

      <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(5, 1fr)" }, mb: 1.75 }}>
        <Kpi label="งานทั้งหมด" value={report.total} sub={`${report.visits} ครั้งเข้างาน`} />
        <Kpi label="ปิดแล้ว" value={report.done} sub={`${report.doneRate}% ของทั้งหมด`} color="#10b981" />
        <Kpi label="กำลังดำเนินการ" value={report.inProgress} color={ACCENT} />
        <Kpi label="ใกล้ครบกำหนด" value={report.warning} sub="เลยกำหนด 1 สัปดาห์" color="#f59e0b" />
        <Kpi label="ค้างงาน" value={report.overdue} sub="เลยกำหนด 2 สัปดาห์" color="#dc2626" />
      </Box>

      <Panel title="คิวงานกองอยู่ขั้นไหน" hint="รอยืนยัน → ยืนยันแล้ว → กำลังดำเนินการ → เสร็จสิ้น">
        <Pipeline rows={report.pipeline} total={report.total} />
      </Panel>

      <Panel title="รายเดือน" hint="แท่งจาง = งานทั้งหมด · แท่งเข้ม = ที่ปิดแล้ว · นับตามวันเข้างานครั้งสุดท้ายของงานนั้น">
        <MonthBars rows={report.byMonth} />
      </Panel>

      <Panel title="ตามระบบงาน" hint="ระบบไหนมีงานเข้ามากที่สุดในช่วงที่เลือก">
        <SummaryTable rows={report.bySystem} firstHeader="ระบบงาน" />
      </Panel>

      <Panel
        title={group === "customer" ? "สรุปตามลูกค้า/โครงการ" : "สรุปตามทีมช่าง"}
        hint="แสดง 15 อันดับแรก · ช่องค้างเป็นสีแดงเมื่อมีงานเลยกำหนด 2 สัปดาห์"
      >
        <ToggleButtonGroup
          exclusive size="small" value={group} onChange={(e, v) => v && setGroup(v)}
          sx={{ mb: 1.25, "& .MuiToggleButton-root": { border: `1px solid ${BORDER}`, borderRadius: "999px !important", px: 1.5, textTransform: "none" } }}
        >
          <ToggleButton value="customer">ลูกค้า/โครงการ</ToggleButton>
          <ToggleButton value="team">ทีมช่าง</ToggleButton>
        </ToggleButtonGroup>
        <SummaryTable
          rows={group === "customer" ? report.byCustomer : report.byTeam}
          firstHeader={group === "customer" ? "ลูกค้า/โครงการ" : "ทีมช่าง"}
        />
      </Panel>
    </Box>
  );
}
