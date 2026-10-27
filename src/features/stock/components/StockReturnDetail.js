/**
 * StockReturnDetail — ใบคืนของ (RT): ดู · ตรวจรับ · ไม่รับคืน · ยกเลิก · PDF
 * ✅ (27 ต.ค. 2569 ผู้ใช้เลือก "ใบคืนของ + สภาพของ") ทุกปุ่มที่เปลี่ยนยอดผ่านกล่องยืนยันที่สรุปผลตามสภาพ
 *    (ปกติ → เข้าคลัง · ชำรุด → รอซ่อม · สูญหาย → ตัดจำหน่าย)
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography, TextField, IconButton, Alert,
  CircularProgress, Skeleton, useMediaQuery, Avatar,
} from "@mui/material";
import { Close, TaskAlt, DoNotDisturbAlt, PictureAsPdf, Check, WarningAmber, AssignmentReturn, InsertDriveFile } from "@mui/icons-material";

import useRealtime from "@/shared/realtime/useRealtime";
import JobTypeChip from "@/shared/ui/JobTypeChip";
import PdfPrintDialog from "@/shared/components/PdfPrintDialog";
import { thaiDate, thaiDateTime } from "@/shared/utils/thaiDate";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import StockService, { errorText } from "../services/StockService";
import { TEXT_MAIN, TEXT_SUB, BORDER_MAIN, CONDITIONS, rtStatus, fmt, jobOf } from "../stockMeta";
import { KindTag, Thumb, FIELD_SX, Label } from "./StockBits";

export const RT_TONE = "#0f766e";
const BTN = { textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", whiteSpace: "nowrap" };
const CARD = { bgcolor: "#fff", borderRadius: 3, border: `1px solid ${BORDER_MAIN}` };
const PDF_SX = { textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", whiteSpace: "nowrap", color: "#dc2626", borderColor: "#e2e8f0", bgcolor: "#fff", "&:hover": { bgcolor: "#fff", borderColor: "#dc2626" } };

export const RtBadge = ({ status }) => {
  const m = rtStatus(status);
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 1, height: 24, borderRadius: 99, bgcolor: m.bg, color: m.color, fontSize: "0.72rem", fontWeight: 800, whiteSpace: "nowrap" }}>
      <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: m.color }} />{m.label}
    </Box>
  );
};
export const CondTag = ({ condition }) => {
  const c = CONDITIONS[condition] || CONDITIONS.good;
  return <Box component="span" sx={{ display: "inline-flex", alignItems: "center", px: 0.9, height: 22, borderRadius: 99, bgcolor: c.bg, color: c.color, fontSize: "0.72rem", fontWeight: 800, whiteSpace: "nowrap" }}>{c.label}</Box>;
};

export default function StockReturnDetail({ id, open, canManage, myId, items = [], deptLabels = {}, onClose, onChanged }) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [reason, setReason] = useState("");
  const [pdfOpen, setPdfOpen] = useState(false);
  const photoOf = useMemo(() => new Map(items.map((it) => [String(it._id), it])), [items]);

  const load = useCallback(() => {
    if (!id) return;
    StockService.getReturn(id).then(setDoc).catch((err) => setError(errorText(err, "โหลดใบคืนไม่สำเร็จ")));
  }, [id]);
  useEffect(() => { if (open) { setDoc(null); setError(""); setConfirm(null); setReason(""); load(); } }, [open, load]);
  useRealtime("stock", load, { enabled: open && !confirm });

  const run = async (fn) => {
    setBusy(true); setError("");
    try { const r = await fn(); setDoc(r); setConfirm(null); onChanged?.(r); } catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  };

  const mine = doc && (doc.requester?.userId === myId || doc.createdBy?.userId === myId);
  const units = (doc?.lines || []).reduce((t, l) => t + l.qty, 0);
  const deptLabel = deptLabels[doc?.dept] || doc?.dept || "";
  const CONFIRM = {
    receive: { title: "ยืนยันตรวจรับคืน", tone: RT_TONE, icon: <TaskAlt />, label: "ยืนยันรับคืน", text: "ตรวจของจริงตรงกับรายการและสภาพแล้ว — ยอดในคลังจะเปลี่ยนตามด้านล่างทันที", act: () => StockService.receiveReturn(doc._id) },
    reject: { title: "ไม่รับคืน", tone: "#dc2626", icon: <DoNotDisturbAlt />, label: "ยืนยันไม่รับคืน", text: "ยอดในคลังไม่เปลี่ยน · แจ้งผู้คืนพร้อมเหตุผล ให้ยื่นใบใหม่ให้ถูกต้อง", act: () => StockService.rejectReturn(doc._id, reason.trim()), need: !reason.trim() },
    cancel: { title: "ยกเลิกใบคืน", tone: "#475569", icon: <Close />, label: "ยืนยันยกเลิก", text: "ยกเลิกแล้วแก้กลับไม่ได้ — ต้องยื่นใบใหม่", act: () => StockService.cancelReturn(doc._id) },
  };
  const c = confirm && CONFIRM[confirm];
  const effect = (l) => (l.condition === "good" ? `+${fmt(l.qty)} เข้าคลัง` : l.condition === "damaged" ? `+${fmt(l.qty)} รอซ่อม` : `−${fmt(l.qty)} ตัดจำหน่าย`);

  const steps = doc ? [
    { label: "ยื่นใบคืน", who: doc.createdBy?.name || doc.requester?.name, at: doc.createdAt, done: true },
    ["rejected", "cancelled"].includes(doc.status)
      ? { label: rtStatus(doc.status).label, who: (doc.rejectedBy || doc.cancelledBy)?.name, at: doc.rejectedAt || doc.cancelledAt, done: true, bad: true }
      : { label: "ตรวจรับคืน", who: doc.receivedBy?.name, at: doc.receivedAt, done: Boolean(doc.receivedAt) },
  ] : [];

  return (
    <>
      <Dialog open={open} onClose={() => !busy && onClose()} fullWidth maxWidth="md" fullScreen={isMobile}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.25, py: 1.5, borderBottom: `1px solid ${BORDER_MAIN}` }}>
          <Box sx={{ width: 38, height: 38, borderRadius: 2.5, bgcolor: RT_TONE, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><AssignmentReturn /></Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography sx={{ fontWeight: 800, fontSize: "1.08rem" }} noWrap>ใบคืนของ {doc?.docNo || ""}</Typography>
              {doc && <RtBadge status={doc.status} />}
            </Stack>
            {doc && <Typography sx={{ fontSize: "0.78rem", color: TEXT_SUB }} noWrap>อ้างใบเบิก {doc.requestDocNo} · คลัง{deptLabel}</Typography>}
          </Box>
          <IconButton onClick={onClose} disabled={busy}><Close /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ bgcolor: "#f8fafc", pt: "16px !important" }}>
          {!doc ? (error ? <Alert severity="error">{error}</Alert> : <Stack spacing={1.25}><Skeleton variant="rounded" height={80} /><Skeleton variant="rounded" height={200} /></Stack>) : (
            <Stack spacing={1.5}>
              <Stack direction="row" alignItems="flex-start" sx={{ ...CARD, px: 2, py: 1.5 }}>
                {steps.map((s, i) => {
                  const tone = s.bad ? "#dc2626" : s.done ? "#16a34a" : "#cbd5e1";
                  return (
                    <Stack key={i} direction="row" alignItems="flex-start" sx={{ flex: i < steps.length - 1 ? 1 : "0 0 auto" }}>
                      <Stack alignItems="center" sx={{ width: { xs: 100, sm: 140 }, flexShrink: 0 }}>
                        <Box sx={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: s.done ? tone : "#fff", border: `2px solid ${tone}`, color: s.done ? "#fff" : TEXT_SUB, fontWeight: 800 }}>
                          {s.bad ? <Close sx={{ fontSize: 17 }} /> : s.done ? <Check sx={{ fontSize: 17 }} /> : i + 1}
                        </Box>
                        <Typography sx={{ mt: 0.6, fontSize: "0.8rem", fontWeight: 800, color: s.bad ? "#dc2626" : s.done ? TEXT_MAIN : TEXT_SUB }}>{s.label}</Typography>
                        <Typography noWrap sx={{ fontSize: "0.7rem", color: TEXT_SUB, maxWidth: "100%" }}>{s.done ? s.who || "-" : "รอผู้ดูแลคลัง"}</Typography>
                        {s.done && s.at && <Typography sx={{ fontSize: "0.68rem", color: "#94a3b8" }}>{thaiDate(s.at)}</Typography>}
                      </Stack>
                      {i < steps.length - 1 && <Box sx={{ flex: 1, height: 2, mt: "13px", mx: -3, bgcolor: steps[i + 1].done ? (steps[i + 1].bad ? "#fecaca" : "#bbf7d0") : "#e2e8f0" }} />}
                    </Stack>
                  );
                })}
              </Stack>

              <Box sx={{ ...CARD, p: { xs: 1.5, sm: 2 } }}>
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Avatar sx={{ width: 40, height: 40, fontWeight: 800, bgcolor: personColor(doc.requester?.name) }}>{personInitial(doc.requester?.name)}</Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: 800 }}>{doc.requester?.name}</Typography>
                    <Typography noWrap sx={{ fontSize: "0.78rem", color: TEXT_SUB }}>
                      ผู้เบิก{doc.createdBy?.userId && doc.createdBy.userId !== doc.requester?.userId ? ` · ยื่นคืนแทนโดย ${doc.createdBy.name}` : ""} · {thaiDateTime(doc.createdAt)}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: "right" }}>
                    <Typography sx={{ fontWeight: 900, fontSize: "1.4rem", lineHeight: 1 }}>{fmt(units)}</Typography>
                    <Typography sx={{ fontSize: "0.72rem", color: TEXT_SUB, fontWeight: 700 }}>หน่วยที่คืน</Typography>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${BORDER_MAIN}`, minWidth: 0 }}>
                  <JobTypeChip job={jobOf(doc)} />
                  <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, minWidth: 0 }}>{doc.jobTitle || "-"}</Typography>
                </Stack>
                {doc.note && <Typography sx={{ mt: 1, fontSize: "0.84rem", color: TEXT_SUB }}><b style={{ color: TEXT_MAIN }}>หมายเหตุ:</b> {doc.note}</Typography>}
              </Box>
              {doc.status === "rejected" && <Alert severity="error"><b>ไม่รับคืน:</b> {doc.rejectReason} — {doc.rejectedBy?.name}</Alert>}

              <Box sx={{ ...CARD, overflow: "hidden" }}>
                <Typography sx={{ fontWeight: 800, fontSize: "0.92rem", px: 2, py: 1.25, borderBottom: `1px solid ${BORDER_MAIN}` }}>รายการที่คืน</Typography>
                {doc.lines.map((l, i) => (
                  <Stack key={l._id} direction="row" spacing={1.5} alignItems="center" sx={{ px: 2, py: 1.25, borderTop: i ? `1px solid ${BORDER_MAIN}` : 0 }}>
                    <Thumb item={photoOf.get(String(l.item)) || { kind: l.kind }} size={44} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: "0.92rem" }}>{l.name}</Typography>
                      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.25, flexWrap: "wrap", rowGap: 0.25 }}>
                        <CondTag condition={l.condition} />
                        <KindTag kind={l.kind} />
                        {l.note && <Typography sx={{ fontSize: "0.76rem", color: TEXT_SUB }}>{l.note}</Typography>}
                      </Stack>
                    </Box>
                    <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                      <Typography sx={{ fontWeight: 900, fontSize: "1.05rem" }}>{fmt(l.qty)}</Typography>
                      <Typography sx={{ fontSize: "0.72rem", color: TEXT_SUB }}>{l.unit}</Typography>
                    </Box>
                  </Stack>
                ))}
              </Box>

              {doc.photos?.length > 0 && (
                <Box sx={{ ...CARD, p: 2 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: "0.92rem", mb: 1 }}>ไฟล์แนบ · หลักฐาน ({doc.photos.length})</Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                    {doc.photos.map((p) => {
                      const img = !p.type || p.type.startsWith("image/");
                      return (
                        <Box key={p.url} component="a" href={p.url} target="_blank" rel="noreferrer" title={p.name || ""}
                          sx={{ width: 96, height: 96, borderRadius: 2, overflow: "hidden", border: `1px solid ${BORDER_MAIN}`, display: "block", textDecoration: "none" }}>
                          {img ? <Box component="img" src={p.url.replace("/upload/", "/upload/c_fill,w_240,h_240,q_auto,f_auto/")} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (
                            <Stack alignItems="center" justifyContent="center" spacing={0.25} sx={{ width: "100%", height: "100%", bgcolor: "#f8fafc", px: 0.75 }}>
                              <InsertDriveFile sx={{ fontSize: 30, color: "#dc2626" }} />
                              <Typography noWrap sx={{ fontSize: "0.66rem", color: TEXT_SUB, maxWidth: "100%" }}>{p.name || "ไฟล์"}</Typography>
                            </Stack>
                          )}
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              )}

              <Box sx={{ ...CARD, p: 2 }}>
                <Typography sx={{ fontWeight: 800, fontSize: "0.92rem", mb: 1.25 }}>ประวัติ</Typography>
                {(doc.activityLog || []).slice().reverse().map((a, i, arr) => (
                  <Stack key={i} direction="row" spacing={1.25}>
                    <Stack alignItems="center" sx={{ width: 12 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: "50%", mt: 0.6, bgcolor: i ? "#cbd5e1" : RT_TONE }} />
                      {i < arr.length - 1 && <Box sx={{ flex: 1, width: 2, bgcolor: "#e2e8f0", my: 0.25 }} />}
                    </Stack>
                    <Box sx={{ pb: i < arr.length - 1 ? 1.25 : 0, minWidth: 0 }}>
                      <Typography sx={{ fontSize: "0.86rem", fontWeight: 600 }}>{a.detail}</Typography>
                      <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>{a.userName} · {thaiDateTime(a.timestamp)}</Typography>
                    </Box>
                  </Stack>
                ))}
              </Box>
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          )}
        </DialogContent>
        {doc && (
          <DialogActions sx={{ px: 2, py: 1.5, borderTop: `1px solid ${BORDER_MAIN}`, gap: 1, "& > :not(style) ~ :not(style)": { ml: 0 } }}>
            {doc.status === "pending" && (mine || canManage) && <Button onClick={() => setConfirm("cancel")} sx={{ ...BTN, fontWeight: 700, color: TEXT_SUB }}>ยกเลิกใบ</Button>}
            <Button variant="outlined" startIcon={<PictureAsPdf />} onClick={() => setPdfOpen(true)} sx={PDF_SX}>พิมพ์ PDF</Button>
            <Box sx={{ flex: 1 }} />
            {canManage && doc.status === "pending" ? (
              <>
                <Button variant="outlined" color="error" onClick={() => setConfirm("reject")} startIcon={<DoNotDisturbAlt />} sx={BTN}>ไม่รับคืน</Button>
                <Button variant="contained" onClick={() => setConfirm("receive")} startIcon={<TaskAlt />} sx={{ ...BTN, bgcolor: RT_TONE, "&:hover": { bgcolor: "#115e59", boxShadow: "none" } }}>ตรวจรับคืน</Button>
              </>
            ) : <Button onClick={onClose} sx={{ ...BTN, fontWeight: 700, color: TEXT_SUB }}>ปิด</Button>}
          </DialogActions>
        )}
      </Dialog>

      <Dialog open={Boolean(c)} onClose={() => !busy && setConfirm(null)} fullWidth maxWidth="xs">
        {c && (
          <>
            <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.25, pb: 1 }}>
              <Box sx={{ width: 38, height: 38, borderRadius: 2.5, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: `${c.tone}14`, color: c.tone }}>{c.icon}</Box>
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: "1.02rem" }}>{c.title}</Typography>
                <Typography sx={{ fontSize: "0.78rem", color: TEXT_SUB }}>{doc?.docNo} · {doc?.requester?.name}</Typography>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Stack direction="row" spacing={1} sx={{ p: 1.25, borderRadius: 2, bgcolor: "#fffbeb", border: "1px solid #fde68a", mb: 1.5 }}>
                <WarningAmber sx={{ fontSize: 18, color: "#d97706", mt: 0.15 }} />
                <Typography sx={{ fontSize: "0.82rem", color: "#78350f" }}>{c.text}</Typography>
              </Stack>
              {confirm === "receive" && (
                <Box sx={{ border: `1px solid ${BORDER_MAIN}`, borderRadius: 2, overflow: "hidden" }}>
                  {doc.lines.map((l, i) => (
                    <Stack key={l._id} direction="row" alignItems="center" spacing={1} sx={{ px: 1.25, py: 0.9, borderTop: i ? `1px solid ${BORDER_MAIN}` : 0 }}>
                      <Thumb item={photoOf.get(String(l.item)) || { kind: l.kind }} size={30} />
                      <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.86rem" }}>{l.name}</Typography>
                      <CondTag condition={l.condition} />
                      <Typography sx={{ fontWeight: 800, fontSize: "0.82rem", color: (CONDITIONS[l.condition] || CONDITIONS.good).color, whiteSpace: "nowrap" }}>{effect(l)}</Typography>
                    </Stack>
                  ))}
                </Box>
              )}
              {confirm === "reject" && (
                <Box>
                  <Label required>เหตุผลที่ไม่รับคืน</Label>
                  <TextField autoFocus fullWidth size="small" sx={FIELD_SX} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เช่น จำนวนไม่ตรง / สภาพไม่ตรงกับที่แจ้ง" />
                </Box>
              )}
              {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setConfirm(null)} disabled={busy} sx={{ ...BTN, fontWeight: 700, color: TEXT_SUB }}>กลับ</Button>
              <Button variant="contained" disabled={busy || c.need} onClick={() => run(c.act)} startIcon={busy ? <CircularProgress size={15} color="inherit" /> : c.icon}
                sx={{ ...BTN, bgcolor: c.tone, "&:hover": { bgcolor: c.tone, filter: "brightness(0.92)", boxShadow: "none" } }}>{c.label}</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <PdfPrintDialog
        open={pdfOpen && Boolean(doc)}
        onClose={() => setPdfOpen(false)}
        jobKey={`${doc?._id}:${doc?.status}:${doc?.updatedAt}`}
        generate={async () => {
          const { generateReturnPdf } = await import("../utils/stockPdf");
          return generateReturnPdf({ doc, deptLabel, mode: "blob" });
        }}
        title={doc?.docNo || "ใบคืนของ"}
        subtitle={doc ? `ใบคืนของ · อ้าง ${doc.requestDocNo}` : ""}
        badge={<Box component="span" sx={{ px: 0.9, height: 20, display: "inline-flex", alignItems: "center", borderRadius: 999, bgcolor: RT_TONE, color: "#fff", fontSize: "0.66rem", fontWeight: 900 }}>RT</Box>}
        color={RT_TONE} dark="#115e59"
        shareText={doc ? `ใบคืนของ ${doc.docNo}` : ""}
        email={doc ? { docType: "ใบคืนของ", docNo: doc.docNo, refId: String(doc._id), project: doc.jobTitle, audience: "internal" } : undefined}
      />
    </>
  );
}
