/**
 * AnnualPlanDialog — "แผนงานทั้งปี" ของสัญญาเดียว (เมนู ⋮ ของแถวสัญญาในหน้าภาพรวมงาน)
 *
 * ✅ (26 พ.ย. 2569 ผู้ใช้: "อยากให้หน้าภาพรวมงานสามารถกดออกแผนงานทั้งปีโดยคำนวณจากการเข้างาน ระบุเดือนของ
 *    ครั้งที่ 1 แล้ว เดือนต่อๆ ไปให้คำนวณตามจำนวนทุกกี่เดือน ปี ที่ระบุไว้อยู่แล้ว ทำให้มันสมบูรณ์ และต่อเป็นต่อปีด้วยนะ")
 * 🔁 (26 พ.ย. 2569 ผู้ใช้: "ยังดูสับสน งงๆ อะไรคืออะไร และให้สามารถกดเลือกเดือนเองได้ด้วย แต่แค่ใส่ค่าที่คำนวณมาก่อน")
 *    เหลือสิ่งเดียวให้ดู: ตาราง "ครั้งที่ → เดือนที่จะเข้า → การเข้างานจริง"
 *      • ทุกครั้งมีช่องเลือกเดือน — ระบบเติมค่าที่คำนวณไว้ก่อน (ครั้งที่ 1 + ทุก N เดือน) เลือกใหม่ได้ทุกช่อง
 *      • แก้ครั้งที่ 1 = ครั้งที่ยังไม่ได้แก้เองเลื่อนตามทั้งหมด · ครั้งที่แก้เองมีป้าย "เลือกเอง" + ปุ่มกลับไปใช้ค่าคำนวณ
 *      • เข้างานจริงคนละเดือนกับแผน → ปุ่ม "ใช้เดือนที่ลงจริง"
 *    แถบภาพรวม 12 เดือนด้านบน · ดูปีถัดไป (ถ้าต่อสัญญา) · บันทึกแผนไว้กับสัญญา
 * 🔁 (26 พ.ย. 2569 ผู้ใช้: "เอกสารทำให้เป็นรูปแบบคล้ายๆ ของใบแจ้งเข้างานปกติ มีที่เซ็น … ใส่ลายเซ็นอิเล็กได้")
 *    "ออกเอกสารแผนงาน" = ใบแจ้งเข้างานแบบระบุแค่เดือน (หัวจดหมาย · เรียน/อ้างถึง · ที่เซ็นลูกค้า + ผู้ออก · ลายเซ็นอิเล็กทรอนิกส์)
 * ✅ (26 พ.ย. 2569 ผู้ใช้: "ทำให้สามารถติดตามแผนงานทั้งปีที่ส่งไปแล้ว มีการลงตามนี้จริงไหม")
 *    ออกเอกสารแล้ว server เก็บ "แผนที่ส่งลูกค้า" ไว้กับสัญญา → แถบสรุป ตรง/คลาด/เลยเดือน + ทุกครั้งบอกเดือนที่แจ้งลูกค้า
 */
import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Stack, Typography, Button, IconButton, CircularProgress, useMediaQuery,
} from "@mui/material";
import {
  CloseRounded as Close, EventNoteRounded as EventNote, GridOnRounded as Grid, SaveRounded as Save, DescriptionRounded as Description,
  ArrowForwardRounded as ArrowForward, ReplayRounded as Replay, AddRounded as Add, RemoveRounded as Remove, CheckCircleRounded as CheckCircle,
  WarningAmberRounded as WarningAmber, MarkEmailReadRounded as Sent,
} from "@mui/icons-material";
import Swal from "sweetalert2";
import EventService from "@/shared/services/EventService";
import ThaiMonthSelect from "@/shared/ui/ThaiMonthSelect";
import { useAuth } from "@/features/auth/AuthContext";
import usePermissions from "@/shared/hooks/usePermissions";
import lazyWithRetry from "@/shared/utils/lazyWithRetry";
import { formatEventDateRange } from "@/shared/utils/formatDateRange";
import {
  buildContractPlan, suggestFirstMonth, thaiMonthLabel, addMonthsKey, monthKeyOf, PLAN_STATES, isMonthKey, compactOverrides, planYearSpanLabel,
  sentPlanOf, adherenceOf, ADHERENCE,
} from "@/shared/utils/contractPlan";
import { thaiDate } from "@/shared/utils/thaiDate";
import { workVerbFor } from "@/features/documents/utils/workNoticePdf";
import { INK, INK_2, MUTED, FAINT, LINE, SURFACE, ACCENT, ACCENT_SOFT, ACCENT_LINE, PRIMARY_BTN_SX } from "@/shared/ui/PageKit";

const WorkNoticeDialog = lazyWithRetry(() => import("@/features/documents/components/WorkNoticeDialog"));

const OUTLINE_SX = { textTransform: "none", fontWeight: 700, color: INK_2, borderRadius: 2, border: `1px solid ${LINE}`, bgcolor: "#fff", whiteSpace: "nowrap", px: 1.5, "&:hover": { bgcolor: SURFACE } };
const LINK_SX = { textTransform: "none", fontWeight: 700, fontSize: "0.72rem", minWidth: 0, p: 0, px: 0.5, lineHeight: 1.6, borderRadius: 1 };
const MANUAL = "#b45309";

/** ป้ายสถานะการเข้างานจริง — สี/ข้อความชุดเดียวกับตารางทั้งปีและ Excel (PLAN_STATES) */
const StateChip = ({ state }) => {
  const st = PLAN_STATES[state] || PLAN_STATES.planned;
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", height: 22, px: 0.9, borderRadius: 99, fontSize: "0.7rem", fontWeight: 800, whiteSpace: "nowrap",
      color: st.color, bgcolor: st.bg, border: state === "projected" ? `1px dashed ${FAINT}` : `1px solid ${st.color}26` }}>
      {st.short || st.label}
    </Box>
  );
};

/** แถบภาพรวม: 12 เดือนนับจากครั้งที่ 1 (แผนยาวกว่าปี = ขึ้นแถวใหม่) — ช่องที่มีงานบอกครั้งที่ สีตามสถานะ */
const Overview = ({ rounds, per }) => {
  if (!rounds.length) return null;
  const from = rounds[0].month;
  const last = rounds[rounds.length - 1].month;
  const span = Math.max(12, Math.ceil((Number(last.slice(0, 4)) * 12 + Number(last.slice(5)) - (Number(from.slice(0, 4)) * 12 + Number(from.slice(5))) + 1) / 12) * 12);
  const byMonth = new Map();
  rounds.forEach((r) => { if (!byMonth.has(r.month)) byMonth.set(r.month, r); });
  const nowKey = monthKeyOf(new Date());
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(6, minmax(0,1fr))", sm: "repeat(12, minmax(0,1fr))" }, gap: 0.5 }}>
      {Array.from({ length: Math.min(span, 72) }, (_, i) => {
        const key = addMonthsKey(from, i);
        const r = byMonth.get(key);
        const st = r ? PLAN_STATES[r.state] : null;
        const isNow = key === nowKey;
        return (
          <Box key={key} title={r ? `ครั้งที่ ${r.inYear}/${per} · ${st.label}` : undefined} sx={{
            minWidth: 0, textAlign: "center", borderRadius: 1.5, py: 0.55, position: "relative",
            border: `1px ${r?.projected ? "dashed" : "solid"} ${r ? `${st.color}40` : isNow ? ACCENT_LINE : LINE}`,
            bgcolor: r ? st.bg : isNow ? ACCENT_SOFT : "#fff",
          }}>
            <Typography sx={{ fontSize: "0.64rem", color: r ? st.color : isNow ? ACCENT : FAINT, fontWeight: 700, lineHeight: 1.35 }} noWrap>
              {isNow ? "เดือนนี้" : thaiMonthLabel(key)}
            </Typography>
            <Typography sx={{ fontSize: "0.8rem", fontWeight: 900, color: r ? st.color : "transparent", lineHeight: 1.3 }} noWrap>
              {r ? `ครั้งที่ ${r.inYear}` : "–"}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};

/**
 * @param contract     แถวสัญญา (groupEventsByContract)
 * @param prevContract สัญญาฉบับก่อน (ต่อมาเป็นฉบับนี้) — เดาเดือนครั้งที่ 1 ต่อจากแผนเดิม
 * @param nextContract สัญญาที่ต่อแล้ว (ถ้ามี)
 * @param canEdit      บันทึกแผนไว้กับสัญญาได้ (editContracts)
 */
export default function AnnualPlanDialog({ open, onClose, contract: c, prevContract = null, nextContract = null, canEdit = false, onSaved, onOpenContract }) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const { userData } = useAuth();
  const { can } = usePermissions();
  const suggestion = useMemo(() => (c ? suggestFirstMonth(c, { prev: prevContract }) : null), [c, prevContract]);
  const [firstMonth, setFirstMonth] = useState("");
  const [overrides, setOverrides] = useState([]);
  const [saved, setSaved] = useState({ first: "", ov: [] });
  const [touched, setTouched] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState(null); // { job, planPreset }

  useEffect(() => {
    if (!open || !c) return;
    const first = isMonthKey(c.planFirstMonth) ? c.planFirstMonth : "";
    const ov = compactOverrides(c.planMonths);
    setFirstMonth(first || suggestion?.month || "");
    setOverrides(ov);
    setSaved({ first, ov });
    setTouched(false);
    setShowNext(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ตั้งค่าใหม่ทุกครั้งที่เปิด/เปลี่ยนสัญญา
  }, [open, c?.key]);

  const plan = useMemo(
    () => (c && firstMonth ? buildContractPlan(c, firstMonth, { overrides, extraYears: showNext && !nextContract ? 1 : 0 }) : null),
    [c, firstMonth, overrides, showNext, nextContract],
  );
  if (!c) return null;

  const sent = sentPlanOf(c);
  const adh = adherenceOf(plan, sent);
  const rounds = plan?.rounds || [];
  const real = rounds.filter((r) => !r.projected);
  const multiYear = (plan?.groups || []).filter((g) => !g.projected).length > 1;
  const manualCount = real.filter((r) => r.manual).length;
  const neverSaved = !saved.first;
  const dirty = firstMonth !== saved.first || JSON.stringify(compactOverrides(overrides)) !== JSON.stringify(saved.ov);

  const setRoundMonth = (r, v) => {
    if (!isMonthKey(v)) return;
    setTouched(true);
    if (r.time === 1) { setFirstMonth(v); return; }
    setOverrides((prev) => {
      const next = [...prev];
      while (next.length < r.time) next.push("");
      next[r.time - 1] = v === r.computedMonth ? "" : v;
      return compactOverrides(next);
    });
  };
  const resetRound = (r) => { setTouched(true); setOverrides((prev) => compactOverrides(prev.map((m, i) => (i === r.time - 1 ? "" : m)))); };
  const resetAll = () => { setTouched(true); setOverrides([]); };

  const save = async () => {
    setSaving(true);
    try {
      const ov = compactOverrides(real.map((r) => (r.manual ? r.month : "")));
      await EventService.UpdateContractFields(c.key, { planFirstMonth: firstMonth, planMonths: ov });
      setSaved({ first: firstMonth, ov });
      setOverrides(ov);
      setTouched(false);
      onSaved?.();
      Swal.fire({ icon: "success", title: "บันทึกแผนแล้ว ✅", timer: 1200, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "บันทึกไม่สำเร็จ", text: err?.response?.data?.message || err.message });
    } finally {
      setSaving(false);
    }
  };

  const close = async () => {
    if (touched && dirty && canEdit) {
      const res = await Swal.fire({
        icon: "question", title: "ยังไม่ได้บันทึกแผน", text: "เดือนที่เลือกไว้จะหายไป ถ้าปิดตอนนี้",
        showCancelButton: true, confirmButtonText: "ปิดโดยไม่บันทึก", cancelButtonText: "กลับไปบันทึก", confirmButtonColor: "#64748b", reverseButtons: true,
      });
      if (!res.isConfirmed) return;
    }
    onClose?.();
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const { exportContractPlanExcel } = await import("../utils/contractPlanExport");
      await exportContractPlanExcel({ contract: c, plan: { ...plan, rounds: real, groups: plan.groups.filter((g) => !g.projected) } });
    } catch (err) {
      Swal.fire({ icon: "error", title: "ส่งออกไม่สำเร็จ", text: err?.message || "" });
    } finally {
      setExporting(false);
    }
  };

  /** เอกสารแผนงาน = ใบแจ้งเข้างานแบบระบุแค่เดือน (ไม่ผูกงานรายครั้ง · อ้างเลขที่สัญญา) ใช้เดือนบนจอตอนนี้ */
  const issueDocument = () => {
    const detail = [workVerbFor(c.title), c.system && `ระบบ ${c.system}`].filter(Boolean).join(" ");
    // time = ครั้งที่ (นับรวมทุกปี) — server ใช้บันทึก "แผนที่ส่งลูกค้าแล้ว" ไว้ติดตาม
    const monthRows = real.map((r) => ({ time: r.time, month: r.month, monthTo: "", round: multiYear ? r.label : `${r.inYear}/${plan.per}`, detail }));
    setNotice({
      job: {
        contractGroupId: c.key, company: c.company, site: c.site, title: c.title, system: c.system, contractNo: c.contractNo, quotationNo: c.quotationNo,
        contractStart: c.contractStart, contractEnd: c.contractEnd, contractYears: c.contractYears, intervalMonths: c.intervalMonths,
        visitCount: c.visitCount, responsiblePerson: c.responsiblePerson, start: firstMonth ? `${firstMonth}-01` : c.contractStart,
      },
      planPreset: { planYearLabel: planYearSpanLabel(monthRows.map((r) => r.month)), monthRows },
    });
  };

  // ── แถวของตาราง ──
  const helperFor = (r) => {
    if (r.projected) return { text: "ประมาณการ — ยังไม่ได้ต่อสัญญา", color: FAINT };
    if (r.time === 1) return { text: `ตั้งต้น · ครั้งต่อไปบวกทีละ ${plan.interval} เดือน`, color: ACCENT };
    if (r.manual) return { text: "เลือกเอง", color: MANUAL, reset: true };
    return { text: "คำนวณให้", color: FAINT };
  };
  const gridCols = { xs: "minmax(0,1fr)", sm: "112px minmax(0,230px) minmax(0,1fr)" };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="md" fullScreen={isMobile} PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3 } }}>
      <DialogTitle sx={{ p: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: { xs: 1.75, sm: 2.5 }, py: 1.5, borderBottom: `1px solid ${LINE}` }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: ACCENT_SOFT, color: ACCENT, flexShrink: 0 }}>
            <EventNote />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "1.05rem", fontWeight: 800, color: INK, lineHeight: 1.3 }}>แผนงานทั้งปี</Typography>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED }} noWrap>
              {[c.contractNo, c.site || c.company, [c.title, c.system].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}
            </Typography>
          </Box>
          <IconButton onClick={close} aria-label="ปิด"><Close /></IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ px: { xs: 1.5, sm: 2.5 }, py: 2, bgcolor: SURFACE }}>
        {/* วิธีใช้ 3 ขั้น — บอกตรงๆ ว่าอะไรคืออะไร */}
        <Box sx={{ mt: 1, mb: 1.75, display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 0.75 }}>
          {[
            ["1", "เลือกเดือนของครั้งที่ 1"],
            ["2", plan ? `ครั้งต่อไปเติมให้ทุก ${plan.interval} เดือน` : "ครั้งต่อไประบบเติมให้"],
            ["3", "เดือนไหนไม่ตรง เลือกใหม่ได้เลย"],
          ].map(([n, t]) => (
            <Stack key={n} direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.4, sm: 1 }} alignItems={{ xs: "flex-start", sm: "center" }}
              sx={{ px: { xs: 1, sm: 1.25 }, py: { xs: 0.75, sm: 0.9 }, borderRadius: 2, bgcolor: "#fff", border: `1px solid ${LINE}` }}>
              <Box sx={{ width: 22, height: 22, borderRadius: 99, flexShrink: 0, display: "grid", placeItems: "center", fontSize: "0.74rem", fontWeight: 900, color: "#fff", bgcolor: ACCENT }}>{n}</Box>
              <Typography sx={{ fontSize: { xs: "0.72rem", sm: "0.8rem" }, fontWeight: 700, color: INK_2, lineHeight: 1.35 }}>{t}</Typography>
            </Stack>
          ))}
        </Box>

        {/* ✅ แผนที่ส่งลูกค้าแล้ว — สรุปว่าลงงานตามที่แจ้งไหม */}
        {sent.docs.length > 0 && adh.counts.total > 0 && (
          <Box sx={{ mb: 1.75, p: { xs: 1.25, sm: 1.5 }, borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${adh.counts.problem ? "#fecaca" : "#bbf7d0"}`,
            borderLeft: `4px solid ${adh.counts.problem ? "#ef4444" : "#22c55e"}` }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                <Sent sx={{ fontSize: 22, color: adh.counts.problem ? "#ef4444" : "#16a34a", flexShrink: 0 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.86rem", fontWeight: 800, color: INK }}>
                    ส่งแผนให้ลูกค้าแล้ว · เลขที่ {sent.last.docNumber || "-"}
                  </Typography>
                  <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>
                    {thaiDate(sent.last.issuedAt)}{sent.last.sentByName ? ` · โดย ${sent.last.sentByName}` : ""}{sent.docs.length > 1 ? ` · ส่งทั้งหมด ${sent.docs.length} ฉบับ (ใช้ฉบับล่าสุดของแต่ละครั้ง)` : ""}
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.6 }}>
                {[
                  ["ontime", adh.counts.ontime], ["shifted", adh.counts.shifted], ["missed", adh.counts.missed], ["upcoming", adh.counts.upcoming + adh.counts.due],
                ].filter(([, n]) => n > 0).map(([k, n]) => (
                  <Box key={k} sx={{ px: 0.9, py: 0.25, borderRadius: 99, fontSize: "0.72rem", fontWeight: 800, color: ADHERENCE[k].color, bgcolor: ADHERENCE[k].bg, border: `1px solid ${ADHERENCE[k].color}30` }}>
                    {ADHERENCE[k].short} {n}
                  </Box>
                ))}
              </Stack>
            </Stack>
          </Box>
        )}

        {plan?.intervalAssumed && (
          <Typography sx={{ mb: 1.25, px: 0.5, fontSize: "0.74rem", color: MANUAL }}>
            สัญญานี้ยังไม่ได้ตั้ง “เข้าทุกกี่เดือน” — ใช้ทุก {plan.interval} เดือนไว้ก่อน (แก้ได้ที่ “แก้ไขข้อมูล” ของสัญญา)
          </Typography>
        )}
        {!real.length && (
          <Box sx={{ p: 2.5, borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${LINE}`, textAlign: "center" }}>
            <Typography sx={{ fontWeight: 700, color: INK_2 }}>ยังคำนวณแผนไม่ได้</Typography>
            <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>สัญญานี้ยังไม่มีจำนวนครั้ง/รอบเข้า — ตั้งได้ที่ “แก้ไขข้อมูล”</Typography>
          </Box>
        )}

        {real.length > 0 && (
          <>
            {/* ภาพรวม */}
            <Box sx={{ p: { xs: 1.25, sm: 1.5 }, mb: 1.75, borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${LINE}` }}>
              <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 1 }}>
                <Typography sx={{ fontSize: "0.86rem", fontWeight: 800, color: INK }}>ภาพรวม</Typography>
                <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>
                  {thaiMonthLabel(real[0].month, { full: true })} – {thaiMonthLabel(real[real.length - 1].month, { full: true })} · {real.length} ครั้ง
                </Typography>
              </Stack>
              <Overview rounds={rounds} per={plan.per} />
            </Box>

            {/* ตารางรายครั้ง */}
            <Box sx={{ borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${LINE}`, overflow: "hidden" }}>
              <Box sx={{ display: { xs: "none", sm: "grid" }, gridTemplateColumns: gridCols, columnGap: 2, px: 2, py: 1, bgcolor: SURFACE, borderBottom: `1px solid ${LINE}` }}>
                {["ครั้งที่", "เดือนที่จะเข้า", "การเข้างานจริง"].map((h) => (
                  <Typography key={h} sx={{ fontSize: "0.72rem", fontWeight: 800, color: MUTED }}>{h}</Typography>
                ))}
              </Box>
              {rounds.map((r, idx) => {
                const h = helperFor(r);
                const yearHead = (multiYear || r.projected) && (idx === 0 || rounds[idx - 1].yearIdx !== r.yearIdx);
                const g = plan.groups.find((x) => x.yearIdx === r.yearIdx);
                const offPlan = r.actualMonth && r.actualMonth !== r.month;
                return (
                  <Fragment key={r.time}>
                    {yearHead && (
                      <Box sx={{ px: 2, py: 0.6, bgcolor: r.projected ? "#fafafa" : ACCENT_SOFT, borderBottom: `1px solid ${LINE}` }}>
                        <Typography sx={{ fontSize: "0.74rem", fontWeight: 800, color: r.projected ? MUTED : ACCENT }}>
                          ปีที่ {r.yearIdx}{g?.label ? ` · ${g.label}` : ""}{r.projected ? " · ถ้าต่อสัญญา (ประมาณการ)" : ""}
                        </Typography>
                      </Box>
                    )}
                    <Box sx={{
                      display: "grid", gridTemplateColumns: gridCols, columnGap: 2, rowGap: 0.75, alignItems: "center",
                      px: { xs: 1.5, sm: 2 }, py: 1.1, borderBottom: `1px solid ${LINE}`, opacity: r.projected ? 0.75 : 1,
                    }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ width: 28, height: 28, borderRadius: 99, flexShrink: 0, display: "grid", placeItems: "center", fontSize: "0.8rem", fontWeight: 900,
                          color: r.projected ? MUTED : ACCENT, bgcolor: r.projected ? SURFACE : ACCENT_SOFT, border: `1px solid ${r.projected ? LINE : ACCENT_LINE}` }}>
                          {r.inYear}
                        </Box>
                        <Typography sx={{ fontSize: "0.84rem", fontWeight: 800, color: INK_2, whiteSpace: "nowrap" }}>ครั้งที่ {r.inYear}/{plan.per}</Typography>
                      </Stack>
                      <Box sx={{ minWidth: 0 }}>
                        {r.projected ? (
                          <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: MUTED, py: 0.6 }}>{thaiMonthLabel(r.month, { full: true })}</Typography>
                        ) : (
                          <ThaiMonthSelect value={r.month} onChange={(v) => setRoundMonth(r, v)} around={r.month}
                            sx={{ "& .MuiOutlinedInput-root": { bgcolor: "#fff", fontWeight: 700, ...(r.manual ? { "& fieldset": { borderColor: `${MANUAL}80` } } : {}) } }} />
                        )}
                        <Stack direction="row" alignItems="center" sx={{ mt: 0.35, minHeight: 18, flexWrap: "wrap" }}>
                          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: h.color }}>{h.text}</Typography>
                          {h.reset && (
                            <Button size="small" onClick={() => resetRound(r)} startIcon={<Replay sx={{ fontSize: "13px !important" }} />} sx={{ ...LINK_SX, ml: 0.75, color: ACCENT }}>
                              ใช้ค่าคำนวณ ({thaiMonthLabel(r.computedMonth)})
                            </Button>
                          )}
                        </Stack>
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
                          <StateChip state={r.state} />
                          {r.visits.length > 0 && (
                            <Typography sx={{ fontSize: "0.78rem", color: INK_2, fontWeight: 600 }}>{r.visits.map((v) => formatEventDateRange(v)).join(", ")}</Typography>
                          )}
                        </Stack>
                        {(() => {
                          const a = adh.rows.get(r.time);
                          if (!a) return null;
                          const st = ADHERENCE[a.status];
                          return (
                            <Typography sx={{ mt: 0.4, fontSize: "0.7rem", fontWeight: 700, color: st.color }}>
                              แจ้งลูกค้า {thaiMonthLabel(a.sentMonth)} · {a.status === "shifted" ? `คลาด ${a.diff > 0 ? "+" : ""}${a.diff} เดือน` : st.short}
                              {a.sentMonth !== r.month && !r.visits.length ? " · แผนตอนนี้ต่างจากที่แจ้ง" : ""}
                            </Typography>
                          );
                        })()}
                        {offPlan && (
                          <Stack direction="row" alignItems="center" sx={{ mt: 0.4, flexWrap: "wrap" }}>
                            <Typography sx={{ fontSize: "0.7rem", color: MANUAL, fontWeight: 700 }}>ลงจริงคนละเดือนกับแผน</Typography>
                            <Button size="small" onClick={() => setRoundMonth(r, r.actualMonth)} sx={{ ...LINK_SX, ml: 0.75, color: ACCENT }}>
                              ใช้เดือนที่ลงจริง ({thaiMonthLabel(r.actualMonth)})
                            </Button>
                          </Stack>
                        )}
                        {(r.afterEnd || r.beforeStart) && (
                          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.4, color: MANUAL }}>
                            <WarningAmber sx={{ fontSize: 14 }} />
                            <Typography sx={{ fontSize: "0.7rem", fontWeight: 700 }}>{r.afterEnd ? "เลยวันสิ้นสุดสัญญา" : "ก่อนวันเริ่มสัญญา"}</Typography>
                          </Stack>
                        )}
                      </Box>
                    </Box>
                  </Fragment>
                );
              })}
              {/* ต่อปีถัดไป */}
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} sx={{ px: { xs: 1.5, sm: 2 }, py: 1.1 }}>
                {nextContract ? (
                  <Button size="small" onClick={() => onOpenContract?.(nextContract)} endIcon={<ArrowForward sx={{ fontSize: 16 }} />} sx={{ ...OUTLINE_SX, alignSelf: "flex-start" }}>
                    ต่อสัญญาแล้ว — ดูแผนของ {nextContract.contractNo || "ฉบับใหม่"}
                  </Button>
                ) : (
                  <Button size="small" onClick={() => setShowNext((v) => !v)} startIcon={showNext ? <Remove sx={{ fontSize: 16 }} /> : <Add sx={{ fontSize: 16 }} />}
                    sx={{ ...OUTLINE_SX, alignSelf: "flex-start", borderStyle: "dashed", color: MUTED }}>
                    {showNext ? "ซ่อนปีถัดไป" : `ดูปีถัดไป (ถ้าต่อสัญญา เริ่ม ${thaiMonthLabel(plan.nextYearFirst)})`}
                  </Button>
                )}
                <Box sx={{ flex: 1 }} />
                {manualCount > 0 && (
                  <Button size="small" onClick={resetAll} startIcon={<Replay sx={{ fontSize: 16 }} />} sx={{ ...OUTLINE_SX, alignSelf: "flex-start", color: MANUAL }}>
                    คำนวณใหม่ทุกครั้ง (ล้างที่เลือกเอง {manualCount})
                  </Button>
                )}
              </Stack>
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: { xs: 1.5, sm: 2.5 }, py: 1.25, borderTop: `1px solid ${LINE}`, gap: 1, flexWrap: "wrap" }}>
        <Box sx={{ flexBasis: { xs: "100%", sm: "auto" }, mr: { sm: "auto" }, minWidth: 0 }}>
          {canEdit && (dirty ? (
            <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: MANUAL }}>
              {neverSaved && !touched ? "ยังไม่ได้บันทึกแผนของสัญญานี้ (ระบบเดาเดือนครั้งที่ 1 ให้)" : "มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก"}
            </Typography>
          ) : (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: "#15803d" }}>
              <CheckCircle sx={{ fontSize: 16 }} />
              <Typography sx={{ fontSize: "0.78rem", fontWeight: 700 }}>บันทึกแผนไว้กับสัญญาแล้ว</Typography>
            </Stack>
          ))}
        </Box>
        <Button onClick={exportExcel} disabled={!real.length || exporting}
          startIcon={exporting ? <CircularProgress size={14} /> : <Grid sx={{ fontSize: 18, color: "#217346" }} />} sx={OUTLINE_SX}>
          Excel
        </Button>
        {canEdit && (
          <Button onClick={save} disabled={!dirty || saving || !real.length}
            startIcon={saving ? <CircularProgress size={14} /> : <Save sx={{ fontSize: 18 }} />}
            sx={{ ...OUTLINE_SX, ...(dirty ? { color: ACCENT, borderColor: ACCENT_LINE, bgcolor: ACCENT_SOFT } : {}) }}>
            บันทึกแผน
          </Button>
        )}
        <Button variant="contained" onClick={issueDocument} disabled={!real.length}
          startIcon={<Description sx={{ fontSize: 18 }} />} sx={{ ...PRIMARY_BTN_SX, px: 1.75, flex: { xs: "1 1 100%", sm: "none" } }}>
          ออกเอกสารแผนงาน (มีที่เซ็น)
        </Button>
      </DialogActions>

      {notice && (
        <Suspense fallback={null}>
          <WorkNoticeDialog open onClose={() => { setNotice(null); onSaved?.(); }} job={notice.job} planPreset={notice.planPreset}
            issuer={userData} canUseRunningNumber={can("editDocuments")} />
        </Suspense>
      )}
    </Dialog>
  );
}
