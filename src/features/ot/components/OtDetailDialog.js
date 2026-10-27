/**
 * OtDetailDialog — รายละเอียดใบ OT + ปุ่มตามขั้น (ตรวจสอบ → อนุมัติ → จ่ายพร้อมเงินเดือน)
 * ⚠️ ซ่อนปุ่มตามสิทธิ์เหมือนระบบเบิก — ตัวตัดสินจริงอยู่ที่ server (routes/ot.js)
 * 🔒 ยอดเงินของคนอื่นที่ server ตัดมาเป็น null แสดงเป็น "—" (ไม่มีสิทธิ์ดูค่าจ้าง)
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography, IconButton, Alert, Skeleton,
  useMediaQuery, TextField, CircularProgress, Tooltip, Avatar,
} from "@mui/material";
import { Close, Edit, Undo, Block, FactCheck, CheckCircle, DoneAll, AccessTime, Check, CalendarMonth } from "@mui/icons-material";
import moment from "moment";

import { thaiDate, thaiDateTime } from "@/shared/utils/thaiDate";
import { useAuth } from "@/features/auth/AuthContext";
import usePermissions from "@/shared/hooks/usePermissions";
import OtService, { errorText } from "../services/OtService";
import OtStatusBadge from "./OtStatusBadge";
import JobTypeChip from "@/shared/ui/JobTypeChip";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import { useHolidays, dayKind } from "./OtDayInfo";
import {
  OT_ACCENT, TEXT_MAIN, TEXT_SUB, BORDER_MAIN, typeMeta, hoursText, money, periodLabel, OT_TYPES,
} from "../otMeta";

/**
 * 🎨 (27 ต.ค. 2569 ผู้ใช้: "ข้อมูลยังดูยาก ไม่เรียบร้อย ดูรก แก้ไขให้ดีกว่านี้")
 *   แถบขั้นตอน → สรุป (ผู้ยื่น + ชั่วโมงตัวใหญ่ + เดือน/ประเภท) → รายการจัดกลุ่มตามงาน → ประวัติแบบไทม์ไลน์
 */
const Card = ({ title, right, children, flush }) => (
  <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 3, mb: 1.5, overflow: "hidden" }}>
    {title && (
      <Stack direction="row" alignItems="center" sx={{ px: { xs: 1.5, sm: 2 }, py: 1.25, borderBottom: `1px solid ${BORDER_MAIN}` }}>
        <Typography sx={{ fontWeight: 800, fontSize: "0.92rem", flex: 1 }}>{title}</Typography>
        {right}
      </Stack>
    )}
    <Box sx={flush ? undefined : { p: { xs: 1.5, sm: 2 } }}>{children}</Box>
  </Box>
);

const Pill = ({ children, color = TEXT_SUB, bg = "#f1f5f9", icon }) => (
  <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 1, height: 26, borderRadius: 2, bgcolor: bg, color, fontSize: "0.78rem", fontWeight: 700, whiteSpace: "nowrap" }}>
    {icon}{children}
  </Box>
);

/** แถบขั้นตอน ยื่น → ตรวจสอบ → อนุมัติ (ตีกลับ/ยกเลิก = วงแดงแทนขั้นที่ค้าง) */
const Steps = ({ e }) => {
  const stopped = e.status === "rejected" || e.status === "cancelled";
  const steps = [
    { label: "ยื่นขอ", who: e.requester?.name, at: e.createdAt || e.docDate, done: true },
    { label: "ตรวจสอบ", who: e.reviewedBy?.name, at: e.reviewedAt, done: Boolean(e.reviewedAt) },
    { label: e.status === "paid" ? "อนุมัติ · ปิดรอบ" : "อนุมัติ", who: e.approvedBy?.name, at: e.approvedAt, done: Boolean(e.approvedAt) },
  ];
  if (stopped) {
    const i = steps.findIndex((s) => !s.done);
    steps[i < 0 ? steps.length - 1 : i] = { label: e.status === "rejected" ? "ตีกลับ" : "ยกเลิก", who: (e.rejectedBy || e.cancelledBy)?.name, at: e.rejectedAt || e.cancelledAt, done: true, bad: true };
  }
  return (
    <Stack direction="row" alignItems="flex-start" sx={{ bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 3, px: { xs: 1, sm: 2 }, py: 1.5, mb: 1.5 }}>
      {steps.map((s, i) => {
        const tone = s.bad ? "#dc2626" : s.done ? "#16a34a" : "#cbd5e1";
        const nextDone = steps[i + 1]?.done;
        return (
          <Stack key={i} direction="row" alignItems="flex-start" sx={{ flex: i < steps.length - 1 ? 1 : "0 0 auto", minWidth: 0 }}>
            <Stack alignItems="center" sx={{ width: { xs: 88, sm: 130 }, flexShrink: 0 }}>
              <Box sx={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                bgcolor: s.done ? tone : "#fff", border: `2px solid ${tone}`, color: s.done ? "#fff" : TEXT_SUB, fontWeight: 800, fontSize: "0.8rem" }}>
                {s.bad ? <Close sx={{ fontSize: 17 }} /> : s.done ? <Check sx={{ fontSize: 17 }} /> : i + 1}
              </Box>
              <Typography sx={{ mt: 0.6, fontSize: "0.8rem", fontWeight: 800, color: s.bad ? "#dc2626" : s.done ? TEXT_MAIN : TEXT_SUB }}>{s.label}</Typography>
              <Typography noWrap sx={{ fontSize: "0.7rem", color: TEXT_SUB, maxWidth: "100%" }}>{s.done ? s.who || "-" : "รอดำเนินการ"}</Typography>
              {s.at && s.done && <Typography sx={{ fontSize: "0.68rem", color: "#94a3b8" }}>{thaiDate(s.at)}</Typography>}
            </Stack>
            {i < steps.length - 1 && <Box sx={{ flex: 1, height: 2, mt: "13px", mx: { xs: -2.5, sm: -3 }, bgcolor: nextDone ? (steps[i + 1].bad ? "#fecaca" : "#bbf7d0") : "#e2e8f0" }} />}
          </Stack>
        );
      })}
    </Stack>
  );
};

/** ข้อความประวัติจาก server ใช้รอบแบบ "2026-10" — แปลงเป็นชื่อเดือนไทยตอนแสดง */
const prettyLog = (t) => String(t || "").replace(/(\d{4})-(\d{2})(?!-)/g, (m) => periodLabel(m));
const dayName = (d) => ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."][moment(d).day()];

const ACTIONS = {
  review: { title: "ตรวจสอบใบ OT", button: "ยืนยันผลตรวจสอบ", color: "#b45309", body: "ยืนยันว่าเวลา ชั่วโมง และงานที่อิงถูกต้อง — ส่งต่อให้ผู้อนุมัติ" },
  reviewApprove: { title: "ตรวจสอบและอนุมัติ", button: "ยืนยันทั้งสองขั้น", color: "#059669", body: "บันทึกทั้งขั้นตรวจสอบและอนุมัติ — ชั่วโมง OT ถูกนับเข้ารายงานรอบนั้น" },
  approve: { title: "อนุมัติ OT", button: "ยืนยันอนุมัติ", color: "#059669", body: "อนุมัติแล้ว ชั่วโมง OT ถูกนับเข้ารายงานรอบนั้น" },
  reject: { title: "ตีกลับให้แก้ไข", button: "ตีกลับ", color: "#dc2626", body: "ผู้ยื่นจะได้รับแจ้งพร้อมเหตุผล และแก้ส่งใหม่ในใบเดิมได้" },
  cancel: { title: "ยกเลิกใบ OT", button: "ยืนยันยกเลิก", color: "#64748b", body: "ยกเลิกแล้วย้อนกลับไม่ได้" },
};

export default function OtDetailDialog({ open, id, reloadKey = 0, notice, onClose, onChanged, onEdit }) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const { userData } = useAuth();
  const { can } = usePermissions();
  const [doc, setDoc] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [action, setAction] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [toast, setToast] = useState("");
  const [otCfg, setOtCfg] = useState(null);
  useEffect(() => { if (open && !otCfg) OtService.config().then(setOtCfg).catch(() => {}); }, [open, otCfg]);
  const holidays = useHolidays(otCfg);

  const load = useCallback(async () => {
    if (!id) return;
    setLoadError("");
    try { setDoc(await OtService.get(id)); } catch (err) { setLoadError(errorText(err, "เปิดใบนี้ไม่สำเร็จ")); }
  }, [id]);

  useEffect(() => { if (open) { setDoc(null); setAction(""); setToast(notice || ""); load(); } }, [open, load]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open && reloadKey) load(); }, [reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const me = String(userData?.userId || "");
  const e = doc;
  const involved = e && (e.requester?.userId === me || (e.memberIds || []).includes(me));
  const selfBlocked = involved && !can("approveOwnExpense");
  const isOwner = e && (e.requester?.userId === me || e.createdBy?.userId === me);
  const canReview = can("reviewExpense");
  const canApprove = can("approveExpense");
  const chain = canReview && canApprove && can("approveOwnReview");
  const reviewedByMe = e && e.reviewedBy?.userId === me;
  const canEdit = e && ["pending", "rejected"].includes(e.status) && (isOwner || can("viewAllExpenses"));
  const stepCap = e && { pending: "reviewExpense", reviewed: "approveExpense", approved: "disburseExpense" }[e.status];
  const canReject = Boolean(stepCap) && can(stepCap);
  const canCancel = e && ((isOwner && ["pending", "rejected"].includes(e.status))
    || (["pending", "rejected", "reviewed", "approved"].includes(e.status) && (canApprove || can("disburseExpense"))));

  const byPerson = useMemo(() => {
    const m = new Map();
    (e?.lines || []).forEach((l) => {
      const p = m.get(l.person.userId) || { name: l.person.name, hours: 0, amount: 0, hidden: false, byType: {} };
      p.hours += l.hours;
      if (l.amount === null) p.hidden = true; else p.amount = money(p.amount + l.amount);
      p.byType[l.type] = (p.byType[l.type] || 0) + l.hours;
      m.set(l.person.userId, p);
    });
    return [...m.values()];
  }, [e]);

  const run = async () => {
    setBusy(true); setActionError("");
    try {
      let updated;
      if (action === "review") updated = await OtService.review(e._id, text);
      if (action === "reviewApprove") { await OtService.review(e._id, text); updated = await OtService.approve(e._id, text); }
      if (action === "approve") updated = await OtService.approve(e._id, text);
      if (action === "reject") updated = await OtService.reject(e._id, text);
      if (action === "cancel") updated = await OtService.cancel(e._id, text);
      setDoc(updated);
      setToast({ review: "ตรวจสอบแล้ว — ส่งต่อให้ผู้อนุมัติ", reviewApprove: "อนุมัติแล้ว", approve: "อนุมัติแล้ว", reject: "ตีกลับแล้ว", cancel: "ยกเลิกแล้ว" }[action]);
      setAction(""); setText("");
      onChanged?.();
    } catch (err) {
      setActionError(errorText(err));
      if (action === "reviewApprove") load();
    } finally {
      setBusy(false);
    }
  };

  const nextText = !e ? "" : {
    pending: canReview && !selfBlocked ? "ขั้นที่ 2 จาก 3 · รอคุณตรวจสอบ" : "ขั้นที่ 2 จาก 3 · รอตรวจสอบ",
    reviewed: `ขั้นที่ 2 จาก 3 · ตรวจสอบโดย ${e.reviewedBy?.name || "-"} — ${canApprove && !selfBlocked ? "รอคุณอนุมัติ" : "รออนุมัติ"}`,
    approved: `อนุมัติโดย ${e.approvedBy?.name || "-"} — นับเข้ารายงานชั่วโมงรอบ ${periodLabel(e.period)}`,
    paid: `ปิดรอบ ${periodLabel(e.payroll?.period || e.period)} แล้ว (ส่งชั่วโมงให้ฝ่ายบุคคล/บัญชี)${e.payroll?.at ? ` · ${thaiDate(e.payroll.at)}` : ""}`,
    rejected: `ถูกตีกลับโดย ${e.rejectedBy?.name || "-"}: ${e.rejectReason || "-"}`,
    cancelled: `ยกเลิกโดย ${e.cancelledBy?.name || "-"}${e.cancelReason ? ` · ${e.cancelReason}` : ""}`,
  }[e.status];

  const cfg = ACTIONS[action];

  return (
    <>
      <Dialog open={open} onClose={() => !busy && onClose?.()} fullWidth maxWidth="md" fullScreen={isMobile} PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3 } }}>
        <DialogTitle sx={{ p: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: { xs: 2, sm: 2.5 }, py: 1.5, borderBottom: `1px solid ${BORDER_MAIN}` }}>
            <Box sx={{ width: 38, height: 38, borderRadius: 2.5, bgcolor: OT_ACCENT, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <AccessTime sx={{ fontSize: 21 }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 900, fontSize: "1.02rem", color: TEXT_MAIN }} noWrap>{e?.docNo || "ใบขออนุมัติ OT"}</Typography>
              {e && <OtStatusBadge status={e.status} sx={{ mt: 0.4 }} />}
            </Box>
            <IconButton onClick={onClose} disabled={busy}><Close /></IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ bgcolor: "#f8fafc", px: { xs: 1.25, sm: 2.5 }, pt: "14px !important" }}>
          {loadError && <Alert severity="error">{loadError}</Alert>}
          {!e && !loadError && <Stack spacing={1.5}><Skeleton variant="rounded" height={110} /><Skeleton variant="rounded" height={220} /></Stack>}
          {e && (
            <>
              {toast && <Alert severity="success" onClose={() => setToast("")} sx={{ mb: 1.5, borderRadius: 2 }}>{toast}</Alert>}
              <Steps e={e} />

              {/* สรุป */}
              <Card>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar sx={{ width: 44, height: 44, fontWeight: 800, bgcolor: personColor(e.requester?.name) }}>{personInitial(e.requester?.name)}</Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: 800, fontSize: "1rem" }}>{e.requester?.name}</Typography>
                    <Typography noWrap sx={{ fontSize: "0.78rem", color: TEXT_SUB }}>{e.requester?.position || "ผู้ยื่น"} · ยื่นเมื่อ {thaiDate(e.docDate)}</Typography>
                  </Box>
                  <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                    <Typography sx={{ fontWeight: 900, fontSize: "1.8rem", lineHeight: 1, color: TEXT_MAIN }}>{hoursText(e.totalHours).replace(" ชม.", "")}</Typography>
                    <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB, fontWeight: 700 }}>ชั่วโมงรวม</Typography>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={0.75} sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${BORDER_MAIN}`, flexWrap: "wrap", rowGap: 0.75 }}>
                  <Pill icon={<CalendarMonth sx={{ fontSize: 15 }} />} color="#0e7490" bg="#ecfeff">{periodLabel(e.period)}</Pill>
                  <Pill>{e.lines.length} รายการ</Pill>
                  {byPerson.length > 1 && <Pill>{byPerson.length} คน</Pill>}
                  {OT_TYPES.map((t) => {
                    const h = e.lines.filter((l) => l.type === t.value).reduce((s2, l) => s2 + l.hours, 0);
                    if (!h) return null;
                    const tm = typeMeta(t.value);
                    return <Pill key={t.value} color={tm.color} bg={tm.bg}>{tm.label} {hoursText(h)}</Pill>;
                  })}
                </Stack>
                {["rejected", "cancelled"].includes(e.status) && nextText && (
                  <Alert severity="error" sx={{ mt: 1.5, borderRadius: 2, py: 0.25, "& .MuiAlert-message": { fontSize: "0.84rem", fontWeight: 600 } }}>{nextText}</Alert>
                )}
                {e.note && <Typography sx={{ mt: 1.25, fontSize: "0.84rem", color: TEXT_SUB }}><b style={{ color: TEXT_MAIN }}>หมายเหตุ:</b> {e.note}</Typography>}
              </Card>

              {/* รายการ — จัดกลุ่มตามงานที่อิง */}
              <Card title="รายการ OT" right={<Typography sx={{ fontSize: "0.78rem", color: TEXT_SUB, fontWeight: 700 }}>{e.lines.length} รายการ · {hoursText(e.totalHours)}</Typography>} flush>
                {[...new Set(e.lines.map((l) => l.jobTitle || ""))].map((job, gi) => {
                  const list = e.lines.filter((l) => (l.jobTitle || "") === job).sort((x, y) => String(x.date).localeCompare(String(y.date)));
                  const [type, ...rest] = String(job).split(" · ");
                  return (
                    <Box key={job || gi} sx={{ borderTop: gi ? `1px solid ${BORDER_MAIN}` : 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ px: { xs: 1.5, sm: 2 }, py: 1, bgcolor: "#f8fafc" }}>
                        {job ? <JobTypeChip job={{ title: type }} /> : null}
                        <Typography noWrap sx={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: "0.86rem" }}>{job ? (rest.join(" · ") || type) : "ไม่ระบุงาน"}</Typography>
                        <Typography sx={{ fontSize: "0.78rem", color: TEXT_SUB, fontWeight: 700, whiteSpace: "nowrap" }}>{hoursText(list.reduce((t, l) => t + l.hours, 0))}</Typography>
                      </Stack>
                      {list.map((l) => {
                        const tm = typeMeta(l.type);
                        return (
                          <Stack key={l._id} direction="row" spacing={1.5} alignItems="center" sx={{ px: { xs: 1.5, sm: 2 }, py: 1.1, borderTop: `1px solid ${BORDER_MAIN}` }}>
                            <Box sx={{ width: 46, flexShrink: 0, textAlign: "center", py: 0.4, borderRadius: 2,
                              border: `1px solid ${dayKind(l.date, holidays, otCfg)?.kind === "work" ? BORDER_MAIN : "#fecaca"}`, bgcolor: dayKind(l.date, holidays, otCfg)?.kind === "work" ? "#fff" : "#fef2f2" }}>
                              <Typography sx={{ fontSize: "0.66rem", color: TEXT_SUB, fontWeight: 700, lineHeight: 1.2 }}>{dayName(l.date)}</Typography>
                              <Typography sx={{ fontSize: "1.05rem", fontWeight: 900, lineHeight: 1.1 }}>{moment(l.date).date()}</Typography>
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
                                <Typography sx={{ fontWeight: 800, fontSize: "0.9rem" }}>{l.start} – {l.end}</Typography>
                                <Box component="span" sx={{ px: 0.8, height: 22, display: "inline-flex", alignItems: "center", borderRadius: 1.5, bgcolor: tm.bg, color: tm.color, fontSize: "0.72rem", fontWeight: 800, whiteSpace: "nowrap" }}>
                                  {tm.label} ×{l.multiplier}
                                </Box>
                              </Stack>
                              {(() => {
                                const dk = dayKind(l.date, holidays, otCfg);
                                return dk && dk.kind !== "work" ? (
                                  <Typography noWrap sx={{ fontSize: "0.76rem", fontWeight: 700, color: dk.kind === "public" ? "#b91c1c" : "#b45309", mt: 0.25 }}>
                                    {dk.kind === "public" ? "🎌 " : ""}{dk.label}
                                  </Typography>
                                ) : null;
                              })()}
                              <Typography noWrap sx={{ fontSize: "0.78rem", color: TEXT_SUB, mt: 0.25 }}>
                                {[thaiDate(l.date), byPerson.length > 1 ? l.person.name : "", l.task].filter(Boolean).join(" · ")}
                              </Typography>
                            </Box>
                            <Typography sx={{ fontWeight: 900, fontSize: "1rem", whiteSpace: "nowrap" }}>{hoursText(l.hours)}</Typography>
                          </Stack>
                        );
                      })}
                    </Box>
                  );
                })}
              </Card>

              {byPerson.length > 1 && (
                <Card title="สรุปรายคน" flush>
                  {byPerson.map((p, i) => (
                    <Stack key={p.name} direction="row" alignItems="center" spacing={1.25} sx={{ px: { xs: 1.5, sm: 2 }, py: 1, borderTop: i ? `1px solid ${BORDER_MAIN}` : 0 }}>
                      <Avatar sx={{ width: 28, height: 28, fontSize: "0.75rem", fontWeight: 800, bgcolor: personColor(p.name) }}>{personInitial(p.name)}</Avatar>
                      <Typography sx={{ fontWeight: 700, fontSize: "0.88rem", flex: 1, minWidth: 0 }} noWrap>{p.name}</Typography>
                      <Typography sx={{ fontWeight: 800, fontSize: "0.9rem" }}>{hoursText(p.hours)}</Typography>
                    </Stack>
                  ))}
                </Card>
              )}

              <Card title="ประวัติ">
                {[...(e.activityLog || [])].reverse().map((a, i, arr) => (
                  <Stack key={a._id || i} direction="row" spacing={1.25}>
                    <Stack alignItems="center" sx={{ width: 12 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: "50%", mt: 0.6, bgcolor: i ? "#cbd5e1" : OT_ACCENT }} />
                      {i < arr.length - 1 && <Box sx={{ flex: 1, width: 2, bgcolor: "#e2e8f0", my: 0.25 }} />}
                    </Stack>
                    <Box sx={{ pb: i < arr.length - 1 ? 1.25 : 0, minWidth: 0 }}>
                      <Typography sx={{ fontSize: "0.86rem", fontWeight: 600 }}>{prettyLog(a.detail)}</Typography>
                      <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>{a.userName} · {thaiDateTime(a.timestamp)}</Typography>
                    </Box>
                  </Stack>
                ))}
              </Card>
            </>
          )}
        </DialogContent>

        {e && (
          <DialogActions sx={{ px: { xs: 1, sm: 2.5 }, py: 1.25, borderTop: `1px solid ${BORDER_MAIN}`, gap: 0.75, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {canCancel && <Button onClick={() => setAction("cancel")} startIcon={<Block />} sx={{ textTransform: "none", fontWeight: 700, color: TEXT_SUB, mr: "auto" }}>ยกเลิก</Button>}
            {canEdit && <Button onClick={() => onEdit?.(e)} startIcon={<Edit />} sx={{ textTransform: "none", fontWeight: 700 }}>{e.status === "rejected" ? "แก้ไข / ส่งใหม่" : "แก้ไข"}</Button>}
            {canReject && <Button onClick={() => setAction("reject")} disabled={selfBlocked} startIcon={<Undo />} sx={{ textTransform: "none", fontWeight: 700, color: "#dc2626" }}>ตีกลับ</Button>}
            {chain && e.status === "pending" && (
              <Tooltip title={selfBlocked ? "ใบที่ตัวเองมีชื่อ ต้องให้หัวหน้าท่านอื่นพิจารณา" : ""} describeChild><span>
                <Button variant="contained" disabled={selfBlocked} onClick={() => setAction("reviewApprove")} startIcon={<DoneAll />}
                  sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: "#059669", "&:hover": { bgcolor: "#047857", boxShadow: "none" } }}>ตรวจสอบและอนุมัติ</Button>
              </span></Tooltip>
            )}
            {canReview && e.status === "pending" && (
              <Tooltip title={selfBlocked ? "ตรวจสอบใบที่ตัวเองมีชื่อไม่ได้" : ""} describeChild><span>
                <Button variant={chain ? "outlined" : "contained"} disabled={selfBlocked} onClick={() => setAction("review")} startIcon={<FactCheck />}
                  sx={chain ? { textTransform: "none", fontWeight: 800, borderRadius: 2, color: "#b45309", borderColor: "#fcd34d" }
                    : { textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: "#b45309", "&:hover": { bgcolor: "#92400e", boxShadow: "none" } }}>
                  {chain ? "ตรวจสอบอย่างเดียว" : "ตรวจสอบ"}
                </Button>
              </span></Tooltip>
            )}
            {canApprove && e.status === "reviewed" && (
              <Tooltip title={selfBlocked ? "อนุมัติใบที่ตัวเองมีชื่อไม่ได้" : reviewedByMe && !can("approveOwnReview") ? "คุณเป็นผู้ตรวจสอบใบนี้แล้ว" : ""} describeChild><span>
                <Button variant="contained" disabled={selfBlocked || (reviewedByMe && !can("approveOwnReview"))} onClick={() => setAction("approve")} startIcon={<CheckCircle />}
                  sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: "#059669", "&:hover": { bgcolor: "#047857", boxShadow: "none" } }}>อนุมัติ</Button>
              </span></Tooltip>
            )}
          </DialogActions>
        )}
      </Dialog>

      <Dialog open={Boolean(action)} onClose={() => !busy && setAction("")} fullWidth maxWidth="xs">
        {cfg && (
          <>
            <DialogTitle sx={{ fontWeight: 800, pb: 0.5 }}>{cfg.title}</DialogTitle>
            <DialogContent>
              <Typography variant="body2" sx={{ color: TEXT_SUB, mb: 2 }}>{cfg.body}</Typography>
              {actionError && <Alert severity="error" sx={{ mb: 1.5 }}>{actionError}</Alert>}
              <TextField size="small" fullWidth autoFocus multiline minRows={2} value={text} onChange={(ev) => setText(ev.target.value)}
                label={action === "reject" ? "เหตุผลที่ตีกลับ *" : action === "cancel" ? "เหตุผล (ไม่บังคับ)" : "หมายเหตุ (ไม่บังคับ)"} inputProps={{ maxLength: 500 }} />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => { setAction(""); setActionError(""); }} disabled={busy} sx={{ textTransform: "none", color: TEXT_SUB }}>ปิด</Button>
              <Button variant="contained" onClick={run} disabled={busy || (action === "reject" && !text.trim())}
                startIcon={busy ? <CircularProgress size={15} color="inherit" /> : null}
                sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: cfg.color, "&:hover": { bgcolor: cfg.color, filter: "brightness(0.92)", boxShadow: "none" } }}>
                {cfg.button}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
}

