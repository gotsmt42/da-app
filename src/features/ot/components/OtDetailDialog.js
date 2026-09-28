/**
 * OtDetailDialog — รายละเอียดใบ OT + ปุ่มตามขั้น (ตรวจสอบ → อนุมัติ → จ่ายพร้อมเงินเดือน)
 * ⚠️ ซ่อนปุ่มตามสิทธิ์เหมือนระบบเบิก — ตัวตัดสินจริงอยู่ที่ server (routes/ot.js)
 * 🔒 ยอดเงินของคนอื่นที่ server ตัดมาเป็น null แสดงเป็น "—" (ไม่มีสิทธิ์ดูค่าจ้าง)
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography, IconButton, Alert, Skeleton,
  useMediaQuery, TextField, CircularProgress, Tooltip, Divider,
} from "@mui/material";
import { Close, Edit, Undo, Block, FactCheck, CheckCircle, DoneAll, History, AccessTime } from "@mui/icons-material";

import { thaiDate, thaiDateTime } from "@/shared/utils/thaiDate";
import { useAuth } from "@/features/auth/AuthContext";
import usePermissions from "@/shared/hooks/usePermissions";
import OtService, { errorText } from "../services/OtService";
import OtStatusBadge from "./OtStatusBadge";
import {
  OT_ACCENT, TEXT_MAIN, TEXT_SUB, BORDER_MAIN, typeMeta, hoursText, baht, money, periodLabel, OT_TYPES,
} from "../otMeta";

const Card = ({ title, icon, children, action }) => (
  <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 2.5, p: { xs: 1.5, sm: 2 }, mb: 1.5 }}>
    {title && (
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
        {icon}
        <Typography sx={{ fontWeight: 800, fontSize: "0.9rem", flex: 1 }}>{title}</Typography>
        {action}
      </Stack>
    )}
    {children}
  </Box>
);

const Stat = ({ label, value, sub }) => (
  <Box sx={{ minWidth: 0 }}>
    <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 700 }}>{label}</Typography>
    <Typography sx={{ fontWeight: 900, fontSize: "1.2rem", color: TEXT_MAIN, lineHeight: 1.2 }}>{value}</Typography>
    {sub && <Typography variant="caption" sx={{ color: TEXT_SUB }}>{sub}</Typography>}
  </Box>
);

const ACTIONS = {
  review: { title: "ตรวจสอบใบ OT", button: "ยืนยันผลตรวจสอบ", color: "#b45309", body: "ยืนยันว่าเวลาและงานที่ทำถูกต้อง — ระบบคำนวณเงินจากค่าจ้างปัจจุบันแล้วส่งต่อให้ผู้อนุมัติ" },
  reviewApprove: { title: "ตรวจสอบและอนุมัติ", button: "ยืนยันทั้งสองขั้น", color: "#059669", body: "บันทึกทั้งขั้นตรวจสอบและอนุมัติ — OT จะรวมจ่ายกับเงินเดือนของรอบนั้น" },
  approve: { title: "อนุมัติ OT", button: "ยืนยันอนุมัติ", color: "#059669", body: "อนุมัติแล้ว OT จะรวมจ่ายกับเงินเดือนของรอบนั้น" },
  reject: { title: "ตีกลับให้แก้ไข", button: "ตีกลับ", color: "#dc2626", body: "ผู้ยื่นจะได้รับแจ้งพร้อมเหตุผล และแก้ส่งใหม่ในใบเดิมได้" },
  cancel: { title: "ยกเลิกใบ OT", button: "ยืนยันยกเลิก", color: "#64748b", body: "ยกเลิกแล้วย้อนกลับไม่ได้" },
};

export default function OtDetailDialog({ open, id, reloadKey = 0, notice, onClose, onChanged, onEdit }) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const isDesktop = useMediaQuery("(min-width:900px)");
  const { userData } = useAuth();
  const { can } = usePermissions();
  const [doc, setDoc] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [action, setAction] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [toast, setToast] = useState("");

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
  const moneyAll = e?.moneyVisible === "all";

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
      setToast({ review: "ตรวจสอบแล้ว — ส่งต่อให้ผู้อนุมัติ", reviewApprove: "อนุมัติแล้ว — รอจ่ายพร้อมเงินเดือน", approve: "อนุมัติแล้ว — รอจ่ายพร้อมเงินเดือน", reject: "ตีกลับแล้ว", cancel: "ยกเลิกแล้ว" }[action]);
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
    approved: `อนุมัติโดย ${e.approvedBy?.name || "-"} — รวมจ่ายกับเงินเดือนรอบ ${periodLabel(e.period)}`,
    paid: `จ่ายพร้อมเงินเดือนรอบ ${periodLabel(e.payroll?.period || e.period)} แล้ว${e.payroll?.at ? ` · บันทึก ${thaiDate(e.payroll.at)}` : ""}`,
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
              <Card>
                <Typography sx={{ fontWeight: 800, fontSize: "1.02rem", lineHeight: 1.35 }}>{e.subject}</Typography>
                <Typography variant="caption" sx={{ color: TEXT_SUB }}>
                  ยื่นโดย {e.requester?.name}{e.requester?.position ? ` (${e.requester.position})` : ""} · {thaiDate(e.docDate)} · รอบเงินเดือน {periodLabel(e.period)}
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)" }, gap: 1.5, mt: 1.5 }}>
                  <Stat label="ชั่วโมงรวม" value={hoursText(e.totalHours)} sub={`${e.lines.length} รายการ`} />
                  <Stat label="พนักงาน" value={`${byPerson.length} คน`} />
                  <Stat label={moneyAll ? "ค่า OT รวม" : "ค่า OT ของฉัน"} value={e.totalAmount ? baht(e.totalAmount) : "—"}
                    sub={["pending", "rejected"].includes(e.status) ? "ยืนยันยอดตอนตรวจสอบ" : "จ่ายพร้อมเงินเดือน"} />
                </Box>
                {nextText && (
                  <Alert severity={e.status === "rejected" ? "error" : e.status === "paid" ? "success" : "info"} sx={{ mt: 1.5, borderRadius: 2, py: 0.25, "& .MuiAlert-message": { fontSize: "0.84rem", fontWeight: 600 } }}>
                    {nextText}
                  </Alert>
                )}
              </Card>

              {byPerson.length > 1 && (
                <Card title="สรุปรายคน">
                  <Stack divider={<Divider flexItem />} spacing={0.75}>
                    {byPerson.map((p) => (
                      <Stack key={p.name} direction="row" alignItems="center" spacing={1}>
                        <Typography sx={{ fontWeight: 700, fontSize: "0.88rem", flex: 1, minWidth: 0 }} noWrap>{p.name}</Typography>
                        <Typography variant="caption" sx={{ color: TEXT_SUB, display: { xs: "none", sm: "block" } }}>
                          {OT_TYPES.filter((t) => p.byType[t.value]).map((t) => `${t.short} ${hoursText(p.byType[t.value])}`).join(" · ")}
                        </Typography>
                        <Typography sx={{ fontWeight: 800, fontSize: "0.88rem", minWidth: 80, textAlign: "right" }}>{hoursText(p.hours)}</Typography>
                        <Typography sx={{ fontWeight: 800, fontSize: "0.88rem", minWidth: 80, textAlign: "right" }}>{p.hidden ? "—" : baht(p.amount)}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Card>
              )}

              <Card title={`รายการ OT (${e.lines.length})`}>
                <Stack divider={<Divider flexItem />} spacing={1}>
                  {e.lines.map((l) => {
                    const tm = typeMeta(l.type);
                    return (
                      <Box key={l._id} sx={{ display: "grid", gap: 0.5, alignItems: "center", gridTemplateColumns: isDesktop ? "150px 1fr 130px 90px 100px" : "1fr auto" }}>
                        <Box>
                          <Typography sx={{ fontWeight: 800, fontSize: "0.86rem" }}>{thaiDate(l.date)}</Typography>
                          <Typography variant="caption" sx={{ color: TEXT_SUB }}>{l.start}–{l.end}{l.breakMin ? ` · พัก ${l.breakMin} น.` : ""}</Typography>
                        </Box>
                        <Box sx={{ minWidth: 0, gridColumn: isDesktop ? "auto" : "1 / -1", order: isDesktop ? 0 : 3 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: "0.86rem" }} noWrap>{l.person.name}</Typography>
                          <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }} noWrap>{[l.jobTitle, l.task].filter(Boolean).join(" · ") || "-"}</Typography>
                        </Box>
                        <Box component="span" sx={{ justifySelf: isDesktop ? "start" : "end", display: "inline-flex", alignItems: "center", px: 0.8, height: 22, borderRadius: 1.5, bgcolor: tm.bg, color: tm.color, fontSize: "0.72rem", fontWeight: 800, whiteSpace: "nowrap" }}>
                          {tm.label} ×{l.multiplier}
                        </Box>
                        <Typography sx={{ fontWeight: 800, fontSize: "0.88rem", textAlign: "right", display: isDesktop ? "block" : "none" }}>{hoursText(l.hours)}</Typography>
                        <Typography sx={{ fontWeight: 800, fontSize: "0.88rem", textAlign: "right", display: isDesktop ? "block" : "none" }}>{l.amount === null ? "—" : l.amount ? baht(l.amount) : "—"}</Typography>
                        {!isDesktop && (
                          <Typography variant="caption" sx={{ gridColumn: "1 / -1", order: 4, color: TEXT_SUB }}>
                            <b style={{ color: TEXT_MAIN }}>{hoursText(l.hours)}</b>{l.amount ? ` · ${baht(l.amount)}` : ""}
                          </Typography>
                        )}
                      </Box>
                    );
                  })}
                </Stack>
                {e.note && <Typography variant="body2" sx={{ color: TEXT_SUB, mt: 1.5 }}>หมายเหตุ: {e.note}</Typography>}
              </Card>

              <Card title="ประวัติ" icon={<History sx={{ fontSize: 18, color: TEXT_SUB }} />}>
                <Stack spacing={1}>
                  {[...(e.activityLog || [])].reverse().map((a, i) => (
                    <Box key={a._id || i}>
                      <Typography sx={{ fontSize: "0.84rem", fontWeight: 600 }}>{a.detail}</Typography>
                      <Typography variant="caption" sx={{ color: TEXT_SUB }}>{a.userName} · {thaiDateTime(a.timestamp)}</Typography>
                    </Box>
                  ))}
                </Stack>
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

