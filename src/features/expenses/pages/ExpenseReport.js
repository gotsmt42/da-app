/**
 * ExpenseReport — รายงานย้อนหลังการเบิก Advance / เคลม (ติดตามงบประมาณ)
 *
 * ✅ ตอบคำถามที่ผู้ใช้ต้องการ "รู้ได้ทันที": เบิกไปเท่าไร · ใช้จริงเท่าไร · เงินค้างอยู่กับใคร · ต้องคืน/จ่ายเพิ่ม
 * เท่าไร — แยกตามคน / ตามงาน / ตามหมวด / รายเดือน ในหน้าเดียว
 * ⚠️ ช่างเห็นเฉพาะของตัวเอง (server กรอง) — หัวหน้าเห็นทั้งบริษัทและกรองรายคนได้
 * ⚠️ ไม่มีเพดานงบ (ตามที่ผู้ใช้เลือก "ติดตามยอดและรายงาน") — หน้านี้รายงานอย่างเดียว ไม่บล็อกการเบิก
 */
import { useEffect, useMemo, useState } from "react";
import moment from "moment";
import {
  Box, Stack, Typography, TextField, MenuItem, Button, Alert, Skeleton, Table, TableHead, TableRow, TableCell,
  TableBody, ToggleButtonGroup, ToggleButton, useMediaQuery, Tooltip, Chip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { FileDownload, Insights, WarningAmber } from "@mui/icons-material";

import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import { thaiDate, THAI_MONTHS_SHORT } from "@/shared/utils/thaiDate";
import usePermissions from "@/shared/hooks/usePermissions";
import ExpenseService, { errorText } from "../services/ExpenseService";
import { buildExpenseReport } from "../utils/expenseReport";
import {
  KIND_META, statusMeta, categoryMeta, baht, differenceMeta, TEXT_SUB, TEXT_MAIN, BORDER_MAIN,
} from "../expenseMeta";
import KindBadge from "../components/KindBadge";

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

const Kpi = ({ label, value, sub, color, highlight }) => (
  <Box sx={{
    p: { xs: 1.25, sm: 1.75 }, borderRadius: 2.5, bgcolor: highlight ? alpha(color, 0.07) : "#fff",
    border: `1px solid ${highlight ? alpha(color, 0.35) : BORDER_MAIN}`, minWidth: 0,
  }}>
    <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 700, display: "block", lineHeight: 1.3 }} noWrap>{label}</Typography>
    <Typography sx={{ fontWeight: 900, fontSize: { xs: "1.08rem", sm: "1.35rem" }, color, lineHeight: 1.25, mt: 0.25 }} noWrap>{value}</Typography>
    {sub && <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }} noWrap>{sub}</Typography>}
  </Box>
);

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
        {[["จ่ายล่วงหน้าแล้ว", ADV], ["ใช้จริง (อนุมัติ)", ACT], ["สำรองจ่าย", RMB]].map(([l, c]) => (
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

const GroupTable = ({ rows, firstHeader, onPick }) => (
  <Box sx={{ overflowX: "auto" }}>
    <Table size="small" sx={{ minWidth: 640, "& th": { fontWeight: 800, color: TEXT_SUB, fontSize: "0.74rem", whiteSpace: "nowrap", bgcolor: "#f8fafc" }, "& td": { fontSize: "0.82rem", borderColor: BORDER_MAIN } }}>
      <TableHead>
        <TableRow>
          <TableCell>{firstHeader}</TableCell>
          <TableCell align="right">ใบ</TableCell>
          <TableCell align="right">จ่ายล่วงหน้า</TableCell>
          <TableCell align="right">ใช้จริง</TableCell>
          <TableCell align="right">ค้างเคลียร์</TableCell>
          <TableCell align="right">สำรองจ่าย</TableCell>
          <TableCell align="right">รอคืน / จ่ายเพิ่ม</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.key} hover={Boolean(onPick)} onClick={onPick ? () => onPick(r) : undefined} sx={{ cursor: onPick ? "pointer" : "default" }}>
            <TableCell sx={{ fontWeight: 700, maxWidth: 280 }}><Typography noWrap sx={{ fontSize: "inherit", fontWeight: "inherit" }}>{r.label}</Typography></TableCell>
            <TableCell align="right">{r.count}</TableCell>
            <TableCell align="right">{baht(r.advanced)}</TableCell>
            <TableCell align="right">{baht(r.actual)}</TableCell>
            <TableCell align="right" sx={{ color: r.outstanding ? "#0369a1" : TEXT_SUB, fontWeight: r.outstanding ? 800 : 400 }}>
              {baht(r.outstanding)}{r.overdue ? <WarningAmber sx={{ fontSize: 14, color: "#dc2626", ml: 0.5, verticalAlign: "-2px" }} /> : null}
            </TableCell>
            <TableCell align="right" sx={{ color: r.reimburse ? RMB : TEXT_SUB, fontWeight: r.reimburse ? 800 : 400, whiteSpace: "nowrap" }}>
              {r.reimburse ? baht(r.reimburse) : "—"}
              {r.reimburseDue ? <span style={{ display: "block", fontSize: "0.72rem", fontWeight: 700 }}>รอจ่ายคืน {baht(r.reimburseDue)}</span> : null}
            </TableCell>
            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
              {r.refundDue ? <span style={{ color: "#d97706", fontWeight: 700 }}>คืน {baht(r.refundDue)}</span> : null}
              {r.refundDue && r.extraDue ? " · " : null}
              {r.extraDue ? <span style={{ color: "#2563eb", fontWeight: 700 }}>เพิ่ม {baht(r.extraDue)}</span> : null}
              {!r.refundDue && !r.extraDue ? <span style={{ color: TEXT_SUB }}>—</span> : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </Box>
);

export default function ExpenseReport({ onOpen, reloadKey }) {
  const isDesktop = useMediaQuery("(min-width:900px)");
  const { can } = usePermissions();
  const viewAll = can("viewAllExpenses");
  const [preset, setPreset] = useState("year");
  const [from, setFrom] = useState(moment().startOf("year").format("YYYY-MM-DD"));
  const [to, setTo] = useState(moment().format("YYYY-MM-DD"));
  const [person, setPerson] = useState("all");
  const [people, setPeople] = useState([]);
  const [group, setGroup] = useState("person");
  const [rows, setRows] = useState([]);
  // ⚠️ ใบสำรองจ่ายมาคนละก้อนกับใบ Advance (ไม่มีใบไหนให้ผูก) — เก็บแยกแล้วส่งเข้าตัวสรุปพร้อมกัน
  const [reimburseRows, setReimburseRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

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

  useEffect(() => {
    let alive = true;
    setLoading(true); setError("");
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    if (person !== "all") params.userId = person;
    ExpenseService.report(params)
      .then((r) => {
        if (!alive) return;
        setRows(r.advances);
        setReimburseRows(r.reimbursements);
      })
      .catch((err) => alive && setError(errorText(err, "โหลดรายงานไม่สำเร็จ")))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [from, to, person, reloadKey]);

  const report = useMemo(() => buildExpenseReport(rows, { reimbursements: reimburseRows }), [rows, reimburseRows]);
  const hasData = rows.length > 0 || reimburseRows.length > 0;
  const t = report.totals;
  const periodLabel = from || to ? `${from ? thaiDate(from) : "เริ่มต้น"} – ${to ? thaiDate(to) : "ปัจจุบัน"}` : "ทั้งหมด";
  const usage = t.advanced ? Math.round((t.actual / Math.max(t.advanced - t.outstanding, 1)) * 100) : 0;

  const doExport = async () => {
    setExporting(true);
    try {
      const { exportExpenseReport } = await import("../utils/expenseExcelExport");
      await exportExpenseReport(report, { periodLabel, fileName: `รายงานการเบิก ${moment().format("YYYY-MM-DD")}` });
    } catch (err) {
      setError(errorText(err, "ส่งออก Excel ไม่สำเร็จ"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Box sx={{ pt: 2 }}>
      {/* ── ตัวกรอง ─────────────────────────────────────────────────── */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }} sx={{ mb: 1.5 }}>
        <TextField select size="small" label="ช่วงเวลา" value={preset} onChange={(e) => applyPreset(e.target.value)} sx={{ minWidth: 160, bgcolor: "#fff" }}>
          {PRESETS.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
        </TextField>
        {preset === "custom" && (
          <Stack direction="row" spacing={1} sx={{ flex: { md: "none" } }}>
            <Box sx={{ flex: 1, minWidth: 150 }}><ThaiDatePicker label="ตั้งแต่" value={from} onChange={(v) => setFrom(v || "")} /></Box>
            <Box sx={{ flex: 1, minWidth: 150 }}><ThaiDatePicker label="ถึง" value={to} onChange={(v) => setTo(v || "")} /></Box>
          </Stack>
        )}
        {viewAll && (
          <TextField select size="small" label="ผู้เบิก" value={person} onChange={(e) => setPerson(e.target.value)} sx={{ minWidth: 170, bgcolor: "#fff" }}>
            <MenuItem value="all">ทุกคน</MenuItem>
            {people.map((p) => <MenuItem key={p.userId} value={p.userId}>{p.fullName}</MenuItem>)}
          </TextField>
        )}
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" sx={{ color: TEXT_SUB }}>{periodLabel} · อิงวันที่ของใบ Advance</Typography>
        <Button variant="outlined" startIcon={<FileDownload />} onClick={doExport} disabled={loading || exporting || !hasData}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, bgcolor: "#fff" }}>
          {exporting ? "กำลังส่งออก..." : "ส่งออก Excel"}
        </Button>
      </Stack>

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
            <Kpi label="ยอดขอเบิก" value={baht(t.requested)} sub={`${t.count} ใบ · รออนุมัติ ${baht(t.pending)}`} color={TEXT_MAIN} />
            <Kpi label="จ่ายล่วงหน้าแล้ว" value={baht(t.advanced)} sub={t.toPay ? `รอจ่ายอีก ${baht(t.toPay)}` : "ไม่มีรายการรอจ่าย"} color={ADV} />
            <Kpi label="ใช้จริง (อนุมัติ)" value={baht(t.actual)} sub={t.advanced - t.outstanding > 0 ? `${usage}% ของยอดที่เคลียร์แล้ว` : " "} color={ACT} />
            <Kpi label="ค้างเคลียร์" value={baht(t.outstanding)} sub={t.overdue ? `เลยกำหนด ${t.overdue} ใบ` : "ไม่มีใบเลยกำหนด"} color="#0369a1" highlight={t.overdue > 0} />
            <Kpi label="รอรับเงินคืน" value={baht(t.refundDue)} sub={`คืนแล้ว ${baht(t.refunded)}`} color="#d97706" />
            <Kpi label="รอจ่ายเพิ่ม" value={baht(t.extraDue)} sub={`จ่ายเพิ่มแล้ว ${baht(t.extraPaid)}`} color="#1d4ed8" />
            {/* ✅ เงินที่พนักงานสำรองจ่ายเอง — ไม่ได้ผ่านยอด "จ่ายล่วงหน้า" เลย ถ้าไม่มีช่องนี้ยอดกลุ่มนี้จะหายไปทั้งก้อน */}
            <Kpi
              label="สำรองจ่าย (อนุมัติ)" value={baht(t.reimburse)}
              sub={t.reimburseDue ? `รอจ่ายคืน ${baht(t.reimburseDue)}` : `${t.reimburseCount} ใบ · จ่ายคืนแล้ว ${baht(t.reimbursePaid)}`}
              color={RMB} highlight={t.reimburseDue > 0}
            />
          </Box>

          {!hasData ? (
            <Stack alignItems="center" spacing={1} sx={{ py: 6, bgcolor: "#fff", border: `1px dashed ${BORDER_MAIN}`, borderRadius: 2.5 }}>
              <Insights sx={{ fontSize: 44, color: "#cbd5e1" }} />
              <Typography sx={{ fontWeight: 700, color: TEXT_SUB }}>ไม่มีใบเบิกในช่วงเวลานี้</Typography>
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "3fr 2fr" }, gap: 1.5 }}>
                <Panel title="รายเดือน" hint="จ่ายล่วงหน้า เทียบ ใช้จริง"><MonthBars rows={report.byMonth} /></Panel>
                <Panel title="ตามหมวดค่าใช้จ่าย" hint="แถบจาง = ตั้งเบิก · แถบเข้ม = ใช้จริง"><CategoryBars rows={report.byCategory} /></Panel>
              </Box>

              <Panel
                title={group === "person" ? "สรุปตามผู้เบิก" : "สรุปตามงาน"}
                hint={group === "person" ? "เงินค้างอยู่กับใครเท่าไร" : "งานไหนใช้งบไปเท่าไร"}
                action={(
                  <ToggleButtonGroup size="small" exclusive value={group} onChange={(_, v) => v && setGroup(v)}
                    sx={{ "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 700, px: 1.5, py: 0.4 } }}>
                    <ToggleButton value="person">ผู้เบิก</ToggleButton>
                    <ToggleButton value="job">งาน</ToggleButton>
                  </ToggleButtonGroup>
                )}
              >
                <GroupTable
                  rows={group === "person" ? report.byPerson : report.byJob}
                  firstHeader={group === "person" ? "ผู้เบิก" : "งาน"}
                  onPick={viewAll && group === "person" ? (r) => { if (r.key && r.key !== "-") setPerson(r.key); } : undefined}
                />
              </Panel>

              {report.reimburseRows.length > 0 && (
                <Panel
                  title={`ใบสำรองจ่าย (${report.reimburseRows.length})`}
                  hint="พนักงานออกเงินเองไปก่อน · ไม่มีใบ Advance ให้เทียบ"
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
                        {report.reimburseRows.map((r) => {
                          const st = statusMeta(r.status, "reimburse");
                          return (
                            <TableRow key={r._id} hover onClick={() => onOpen?.(r._id)} sx={{ cursor: "pointer" }}>
                              <TableCell sx={{ whiteSpace: "nowrap" }}>
                                <Stack direction="row" spacing={0.75} alignItems="center">
                                  <KindBadge kind="reimburse" />
                                  <b>{r.docNo}</b>
                                </Stack>
                                <span style={{ color: TEXT_SUB }}>{thaiDate(r.docDate)}</span>
                              </TableCell>
                              <TableCell sx={{ whiteSpace: "nowrap" }}>{r.requester?.name}</TableCell>
                              <TableCell sx={{ maxWidth: 320 }}>
                                <Typography noWrap sx={{ fontSize: "inherit", fontWeight: 600 }}>{r.subject}</Typography>
                                <Typography noWrap variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>{r.job?.title ? `${r.job.title}${r.job.site ? ` · ${r.job.site}` : ""}` : "ไม่ผูกงาน"}</Typography>
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 800, color: RMB }}>{baht(r.total)}</TableCell>
                              <TableCell><Chip size="small" label={st.label} sx={{ height: 20, fontSize: "0.7rem", fontWeight: 800, bgcolor: alpha(st.color, 0.12), color: st.color }} /></TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </Box>
                </Panel>
              )}

              <Panel title={`รายใบ Advance (${report.rows.length})`} hint="กดที่แถวเพื่อเปิดใบ Advance">
                {isDesktop ? (
                  <Box sx={{ overflowX: "auto" }}>
                    <Table size="small" sx={{ minWidth: 900, "& th": { fontWeight: 800, color: TEXT_SUB, fontSize: "0.74rem", whiteSpace: "nowrap", bgcolor: "#f8fafc" }, "& td": { fontSize: "0.82rem", borderColor: BORDER_MAIN } }}>
                      <TableHead>
                        <TableRow>
                          <TableCell>เลขที่ / วันที่</TableCell>
                          <TableCell>ผู้เบิก</TableCell>
                          <TableCell>เรื่อง · งาน</TableCell>
                          <TableCell align="right">เบิก</TableCell>
                          <TableCell align="right">ใช้จริง</TableCell>
                          <TableCell align="right">ส่วนต่าง</TableCell>
                          <TableCell>สถานะ</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {report.rows.map((a) => {
                          const st = statusMeta(a.status, "advance");
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
                              <TableCell align="right">{a.claim ? baht(a.claim.total) : "—"}</TableCell>
                              <TableCell align="right" sx={{ color: d?.color, fontWeight: 700, whiteSpace: "nowrap" }}>{d ? (d.amount ? `${d.short} ${baht(d.amount)}` : "พอดี") : "—"}</TableCell>
                              <TableCell><Chip size="small" label={st.label} sx={{ height: 20, fontSize: "0.7rem", fontWeight: 800, bgcolor: alpha(st.color, 0.12), color: st.color }} /></TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </Box>
                ) : (
                  <Stack spacing={1}>
                    {report.rows.map((a) => {
                      const st = statusMeta(a.status, "advance");
                      const d = a.claim ? differenceMeta(a.claim.difference) : null;
                      return (
                        <Box key={a._id} onClick={() => onOpen?.(a._id)} sx={{ p: 1.25, border: `1px solid ${BORDER_MAIN}`, borderLeft: `4px solid ${st.color}`, borderRadius: 2, cursor: "pointer" }}>
                          <Stack direction="row" justifyContent="space-between" spacing={1}>
                            <Typography sx={{ fontWeight: 800, fontSize: "0.82rem" }}>{a.docNo}</Typography>
                            <Typography sx={{ fontWeight: 800, fontSize: "0.9rem" }}>{baht(a.total)}</Typography>
                          </Stack>
                          <Typography sx={{ fontWeight: 600, fontSize: "0.86rem" }} noWrap>{a.subject}</Typography>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
                            <Typography variant="caption" sx={{ color: TEXT_SUB }} noWrap>{thaiDate(a.docDate)} · {a.requester?.name}</Typography>
                            <Typography variant="caption" sx={{ color: d ? d.color : st.color, fontWeight: 800, whiteSpace: "nowrap" }}>
                              {d ? (d.amount ? `${d.short} ${baht(d.amount)}` : "ใช้พอดี") : st.label}
                            </Typography>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </Panel>
            </Stack>
          )}
        </>
      )}
    </Box>
  );
}
