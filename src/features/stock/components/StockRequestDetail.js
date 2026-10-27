/**
 * StockRequestDetail — ใบเบิกของ (ดู · อนุมัติ · รับคืน · พิมพ์ PDF)
 *
 * 🎨 (27 ต.ค. 2569 ผู้ใช้: "ใบเบิกทำให้สวยงาม ทันสมัย รายละเอียดครบ และสามารถทำเป็นเอกสาร PDF ออกมาได้ด้วย")
 *    แถบขั้นตอน (ยื่น → อนุมัติ/จ่าย → คืนครบ) · ข้อมูลเป็นตาราง 2 คอลัมน์ · รายการมีรูปสินค้า · ประวัติแบบไทม์ไลน์
 * ✅ (ผู้ใช้: "กดอนุมัติควรมีการยืนยันอีกชั้น ไม่ใช่กดแล้วทำเลย กันพลาด")
 *    ทุกปุ่มที่เปลี่ยนยอด/สถานะ (อนุมัติ · ไม่อนุมัติ · ยกเลิก · รับคืน) ต้องผ่านกล่องยืนยันที่สรุปผลให้เห็นก่อน
 *   ผู้ยื่น: ยกเลิก (ตอนรออนุมัติ)
 *   ผู้ดูแลคลัง: อนุมัติจ่ายของ (ตัดยอด) · ไม่อนุมัติ (ปล่อยยอดจอง) · รับคืนทรัพย์สิน (ทีละรายการ/ครบ)
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography, TextField, IconButton, Alert,
  CircularProgress, Skeleton, useMediaQuery, Avatar,
} from "@mui/material";
import {
  Close, TaskAlt, DoNotDisturbAlt, AssignmentReturn, PictureAsPdf, Check, WarningAmber,
} from "@mui/icons-material";

import useRealtime from "@/shared/realtime/useRealtime";
import JobTypeChip from "@/shared/ui/JobTypeChip";
import PdfPrintDialog from "@/shared/components/PdfPrintDialog";
import { thaiDate, thaiDateTime } from "@/shared/utils/thaiDate";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import StockService, { errorText } from "../services/StockService";
import { STOCK_ACCENT, STOCK_DARK, TEXT_MAIN, TEXT_SUB, BORDER_MAIN, outstanding, fmt, jobOf, reqStatus } from "../stockMeta";
import { KindTag, ReqBadge, Thumb, FIELD_SX, Label } from "./StockBits";

const BTN = { textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", whiteSpace: "nowrap" };
const CARD = { bgcolor: "#fff", borderRadius: 3, border: `1px solid ${BORDER_MAIN}` };

/** แถบขั้นตอน — เห็นทันทีว่าใบอยู่ตรงไหนของวงจร */
const Steps = ({ doc }) => {
  const asset = (doc.lines || []).some((l) => l.kind === "asset");
  const stopped = ["rejected", "cancelled"].includes(doc.status);
  const steps = [
    { label: "ยื่นใบเบิก", at: doc.createdAt, done: true },
    stopped
      ? { label: reqStatus(doc.status).label, at: doc.rejectedAt || doc.cancelledAt, done: true, bad: true }
      : { label: "อนุมัติ · จ่ายของ", at: doc.issuedAt, done: Boolean(doc.issuedAt) },
    ...(asset && !stopped ? [{ label: "คืนทรัพย์สินครบ", at: doc.status === "returned" ? doc.updatedAt : null, done: doc.status === "returned" }] : []),
  ];
  return (
    <Stack direction="row" alignItems="flex-start" sx={{ ...CARD, px: { xs: 1.25, sm: 2 }, py: 1.5 }}>
      {steps.map((s, i) => {
        const tone = s.bad ? "#dc2626" : s.done ? "#16a34a" : "#cbd5e1";
        return (
          <Stack key={s.label} direction="row" alignItems="flex-start" sx={{ flex: i < steps.length - 1 ? 1 : "0 0 auto", minWidth: 0 }}>
            <Stack alignItems="center" sx={{ width: { xs: 92, sm: 130 }, flexShrink: 0 }}>
              <Box sx={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                bgcolor: s.done ? tone : "#fff", border: `2px solid ${tone}`, color: s.done ? "#fff" : TEXT_SUB, fontWeight: 800, fontSize: "0.8rem" }}>
                {s.bad ? <Close sx={{ fontSize: 17 }} /> : s.done ? <Check sx={{ fontSize: 17 }} /> : i + 1}
              </Box>
              <Typography sx={{ mt: 0.6, fontSize: "0.78rem", fontWeight: 800, color: s.done ? TEXT_MAIN : TEXT_SUB, textAlign: "center", lineHeight: 1.3 }}>{s.label}</Typography>
              <Typography sx={{ fontSize: "0.7rem", color: TEXT_SUB, textAlign: "center" }}>{s.at ? thaiDate(s.at) : "รอดำเนินการ"}</Typography>
            </Stack>
            {i < steps.length - 1 && <Box sx={{ flex: 1, height: 2, mt: "13px", mx: -2, bgcolor: steps[i + 1].done ? (steps[i + 1].bad ? "#fecaca" : "#bbf7d0") : "#e2e8f0" }} />}
          </Stack>
        );
      })}
    </Stack>
  );
};

const Info = ({ label, children }) => (
  <Box sx={{ minWidth: 0 }}>
    <Typography sx={{ fontSize: "0.72rem", color: TEXT_SUB, fontWeight: 700, mb: 0.25 }}>{label}</Typography>
    <Box sx={{ fontSize: "0.88rem", fontWeight: 600, color: TEXT_MAIN }}>{children}</Box>
  </Box>
);

export default function StockRequestDetail({ id, open, canManage, myId, items = [], deptLabels = {}, onClose, onChanged }) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // "issue" | "reject" | "cancel" | "return"
  const [reason, setReason] = useState("");
  const [ret, setRet] = useState({});
  const [pdfOpen, setPdfOpen] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    StockService.request(id).then(setDoc).catch((err) => setError(errorText(err, "โหลดใบเบิกไม่สำเร็จ")));
  }, [id]);
  useEffect(() => { if (open) { setDoc(null); setError(""); setConfirm(null); setReason(""); load(); } }, [open, load]);
  useRealtime("stock", load, { enabled: open && !confirm });

  const photoOf = useMemo(() => new Map(items.map((it) => [String(it._id), it])), [items]);

  const run = async (fn) => {
    setBusy(true); setError("");
    try {
      const r = await fn();
      setDoc(r); setConfirm(null); setReason(""); onChanged?.(r);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const mine = doc && doc.requester?.userId === myId;
  const left = outstanding(doc);
  const assetLines = (doc?.lines || []).filter((l) => l.kind === "asset" && l.qty - (l.returnedQty || 0) > 0);
  const overdue = doc?.status === "issued" && left > 0 && doc.dueReturnAt && new Date(doc.dueReturnAt) < new Date(new Date().toDateString());
  const totalUnits = (doc?.lines || []).reduce((t, l) => t + l.qty, 0);
  const deptLabel = deptLabels[doc?.dept] || doc?.dept || "";
  const openReturn = () => {
    setRet(Object.fromEntries(assetLines.map((l) => [l._id, l.qty - (l.returnedQty || 0)])));
    setConfirm("return");
  };

  const CONFIRM = {
    issue: { title: "ยืนยันอนุมัติและจ่ายของ", tone: STOCK_ACCENT, icon: <TaskAlt />, label: "ยืนยันอนุมัติ · ตัดยอด",
      text: "ระบบจะตัดยอดออกจากคลังทันทีตามรายการด้านล่าง และแจ้งผู้เบิกให้มารับของ — ย้อนกลับไม่ได้", act: () => StockService.issue(doc._id) },
    reject: { title: "ไม่อนุมัติใบเบิกนี้", tone: "#dc2626", icon: <DoNotDisturbAlt />, label: "ยืนยันไม่อนุมัติ",
      text: "ยอดที่จองไว้จะคืนเข้าคลัง และแจ้งผู้เบิกพร้อมเหตุผล", act: () => StockService.reject(doc._id, reason.trim()), need: !reason.trim() },
    cancel: { title: "ยกเลิกใบเบิกนี้", tone: "#475569", icon: <Close />, label: "ยืนยันยกเลิก",
      text: "ยอดที่จองไว้จะคืนเข้าคลัง — ยกเลิกแล้วแก้กลับไม่ได้ ต้องยื่นใบใหม่", act: () => StockService.cancel(doc._id) },
    return: { title: "รับคืนทรัพย์สิน", tone: "#0f766e", icon: <AssignmentReturn />, label: "ยืนยันรับคืน",
      text: "ตรวจของที่ได้รับคืนจริง แล้วใส่จำนวน — ยอดจะกลับเข้าคลังทันที",
      act: () => StockService.returnItems(doc._id, Object.entries(ret).map(([lineId, qty]) => ({ lineId, qty }))), need: !Object.values(ret).some((n) => n > 0) },
  };
  const c = confirm && CONFIRM[confirm];

  return (
    <>
      <Dialog open={open} onClose={() => !busy && onClose()} fullWidth maxWidth="md" fullScreen={isMobile}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.25, py: 1.5, borderBottom: `1px solid ${BORDER_MAIN}` }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography sx={{ fontWeight: 800, fontSize: "1.1rem" }} noWrap>ใบเบิกของ {doc?.docNo || ""}</Typography>
              {doc && <ReqBadge status={doc.status} label={doc.status === "issued" && left > 0 ? `ยืมอยู่ ${fmt(left)}` : undefined} />}
            </Stack>
            {doc && <Typography sx={{ fontSize: "0.78rem", color: TEXT_SUB }}>ยื่นเมื่อ {thaiDateTime(doc.createdAt)} · คลัง{deptLabel}</Typography>}
          </Box>
          {doc && (
            <Button size="small" variant="outlined" startIcon={<PictureAsPdf />} onClick={() => setPdfOpen(true)}
              sx={{ ...BTN, fontWeight: 700, color: "#334155", borderColor: "#e2e8f0", display: { xs: "none", sm: "inline-flex" } }}>PDF</Button>
          )}
          <IconButton onClick={onClose} disabled={busy}><Close /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ bgcolor: "#f8fafc", pt: "16px !important" }}>
          {!doc ? (error ? <Alert severity="error">{error}</Alert> : <Stack spacing={1.25}><Skeleton variant="rounded" height={80} /><Skeleton variant="rounded" height={200} /></Stack>) : (
            <Stack spacing={1.5}>
              <Steps doc={doc} />

              {/* ข้อมูลใบ */}
              <Box sx={{ ...CARD, p: { xs: 1.5, sm: 2 } }}>
                <Stack direction="row" spacing={1.25} alignItems="center" sx={{ pb: 1.5, mb: 1.5, borderBottom: `1px solid ${BORDER_MAIN}` }}>
                  <Avatar sx={{ width: 40, height: 40, fontWeight: 800, bgcolor: personColor(doc.requester?.name) }}>{personInitial(doc.requester?.name)}</Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography noWrap sx={{ fontWeight: 800 }}>{doc.requester?.name}</Typography>
                    <Typography noWrap sx={{ fontSize: "0.78rem", color: TEXT_SUB }}>ผู้เบิก{doc.requester?.position ? ` · ${doc.requester.position}` : ""}</Typography>
                  </Box>
                </Stack>
                <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, minmax(0,1fr))" } }}>
                  <Box sx={{ gridColumn: "1 / -1" }}>
                    <Info label="ใช้กับงาน">
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                        <JobTypeChip job={jobOf(doc)} />
                        <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, minWidth: 0 }}>{doc.jobTitle || "-"}</Typography>
                      </Stack>
                    </Info>
                  </Box>
                  <Info label="จำนวน">{fmt(doc.lines.length)} รายการ · {fmt(totalUnits)} หน่วย</Info>
                  <Info label="อนุมัติ / จ่ายของ">{doc.issuedAt ? <>{doc.issuedBy?.name}<Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>{thaiDateTime(doc.issuedAt)}</Typography></> : <Box component="span" sx={{ color: TEXT_SUB }}>—</Box>}</Info>
                  <Info label="กำหนดคืน">
                    {doc.dueReturnAt ? <Box component="span" sx={{ color: overdue ? "#dc2626" : TEXT_MAIN }}>{thaiDate(doc.dueReturnAt)}{overdue ? " · เลยกำหนด" : ""}</Box> : <Box component="span" sx={{ color: TEXT_SUB }}>—</Box>}
                  </Info>
                  <Info label="ยืมค้างคืน">{left ? <Box component="span" sx={{ color: "#7c3aed" }}>{fmt(left)} หน่วย</Box> : <Box component="span" sx={{ color: TEXT_SUB }}>—</Box>}</Info>
                  {doc.note && <Box sx={{ gridColumn: "1 / -1" }}><Info label="หมายเหตุ"><Typography sx={{ fontSize: "0.86rem", whiteSpace: "pre-wrap" }}>{doc.note}</Typography></Info></Box>}
                </Box>
              </Box>

              {doc.status === "rejected" && <Alert severity="error" icon={<DoNotDisturbAlt />}><b>ไม่อนุมัติ:</b> {doc.rejectReason} — {doc.rejectedBy?.name} · {thaiDateTime(doc.rejectedAt)}</Alert>}
              {doc.status === "pending" && (
                <Alert severity="info" icon={false} sx={{ fontSize: "0.82rem", borderRadius: 2.5 }}>จองยอดไว้ให้แล้ว — คนอื่นเบิกของชุดนี้ซ้ำไม่ได้ · ตัดยอดจริงเมื่อผู้ดูแลคลังอนุมัติ</Alert>
              )}

              {/* รายการ */}
              <Box sx={{ ...CARD, overflow: "hidden" }}>
                <Stack direction="row" alignItems="center" sx={{ px: { xs: 1.5, sm: 2 }, py: 1.25, borderBottom: `1px solid ${BORDER_MAIN}` }}>
                  <Typography sx={{ fontWeight: 800, fontSize: "0.92rem", flex: 1 }}>รายการ</Typography>
                  <Typography sx={{ fontSize: "0.78rem", color: TEXT_SUB, fontWeight: 700 }}>{fmt(doc.lines.length)} รายการ</Typography>
                </Stack>
                {doc.lines.map((l, i) => {
                  const owe = l.kind === "asset" ? Math.max(0, l.qty - (l.returnedQty || 0)) : 0;
                  const it = photoOf.get(String(l.item)) || { kind: l.kind };
                  return (
                    <Stack key={l._id} direction="row" spacing={1.5} alignItems="center" sx={{ px: { xs: 1.5, sm: 2 }, py: 1.25, borderTop: i ? `1px solid ${BORDER_MAIN}` : 0 }}>
                      <Thumb item={it} size={44} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: "0.92rem" }}>{l.name}</Typography>
                        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.25, flexWrap: "wrap", rowGap: 0.25 }}>
                          <KindTag kind={l.kind} />
                          <Typography sx={{ fontSize: "0.76rem", color: TEXT_SUB }}>{l.code}</Typography>
                          {l.kind === "asset" && ["issued", "returned"].includes(doc.status) && (
                            <Typography sx={{ fontSize: "0.76rem", color: owe ? "#7c3aed" : "#0f766e", fontWeight: 700 }}>
                              {owe ? `ค้างคืน ${fmt(owe)}` : "คืนครบแล้ว"}
                            </Typography>
                          )}
                        </Stack>
                      </Box>
                      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                        <Typography sx={{ fontWeight: 900, fontSize: "1.1rem", lineHeight: 1.1 }}>{fmt(l.qty)}</Typography>
                        <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>{l.unit}</Typography>
                      </Box>
                    </Stack>
                  );
                })}
              </Box>

              {/* ประวัติ */}
              <Box sx={{ ...CARD, p: { xs: 1.5, sm: 2 } }}>
                <Typography sx={{ fontWeight: 800, fontSize: "0.92rem", mb: 1.25 }}>ประวัติการดำเนินการ</Typography>
                {(doc.activityLog || []).slice().reverse().map((a, i, arr) => (
                  <Stack key={i} direction="row" spacing={1.25}>
                    <Stack alignItems="center" sx={{ width: 12 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: "50%", mt: 0.6, bgcolor: i ? "#cbd5e1" : STOCK_ACCENT }} />
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
            {doc.status === "pending" && (mine || canManage) && (
              <Button onClick={() => setConfirm("cancel")} sx={{ ...BTN, fontWeight: 700, color: TEXT_SUB }}>ยกเลิกใบ</Button>
            )}
            <Button size="small" variant="outlined" startIcon={<PictureAsPdf />} onClick={() => setPdfOpen(true)}
              sx={{ ...BTN, fontWeight: 700, color: "#334155", borderColor: "#e2e8f0", display: { xs: "inline-flex", sm: "none" } }}>PDF</Button>
            <Box sx={{ flex: 1 }} />
            {canManage && doc.status === "pending" && (
              <>
                <Button variant="outlined" color="error" onClick={() => setConfirm("reject")} sx={BTN} startIcon={<DoNotDisturbAlt />}>ไม่อนุมัติ</Button>
                <Button variant="contained" onClick={() => setConfirm("issue")} startIcon={<TaskAlt />}
                  sx={{ ...BTN, bgcolor: STOCK_ACCENT, "&:hover": { bgcolor: STOCK_DARK, boxShadow: "none" } }}>อนุมัติ · จ่ายของ</Button>
              </>
            )}
            {canManage && doc.status === "issued" && left > 0 && (
              <Button variant="contained" onClick={openReturn} startIcon={<AssignmentReturn />}
                sx={{ ...BTN, bgcolor: "#0f766e", "&:hover": { bgcolor: "#115e59", boxShadow: "none" } }}>รับคืนทรัพย์สิน</Button>
            )}
            {!(canManage && (doc.status === "pending" || (doc.status === "issued" && left > 0))) && (
              <Button onClick={onClose} sx={{ ...BTN, fontWeight: 700, color: TEXT_SUB }}>ปิด</Button>
            )}
          </DialogActions>
        )}
      </Dialog>

      {/* กล่องยืนยัน — กันกดพลาด */}
      <Dialog open={Boolean(c)} onClose={() => !busy && setConfirm(null)} fullWidth maxWidth="xs">
        {c && (
          <>
            <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.25, pb: 1 }}>
              <Box sx={{ width: 38, height: 38, borderRadius: 2.5, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: `${c.tone}14`, color: c.tone }}>{c.icon}</Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 800, fontSize: "1.02rem" }}>{c.title}</Typography>
                <Typography sx={{ fontSize: "0.78rem", color: TEXT_SUB }}>{doc?.docNo} · {doc?.requester?.name}</Typography>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ p: 1.25, borderRadius: 2, bgcolor: "#fffbeb", border: "1px solid #fde68a", mb: 1.5 }}>
                <WarningAmber sx={{ fontSize: 18, color: "#d97706", mt: 0.15 }} />
                <Typography sx={{ fontSize: "0.82rem", color: "#78350f" }}>{c.text}</Typography>
              </Stack>
              {confirm === "return" ? (
                <Stack spacing={1}>
                  {assetLines.map((l) => {
                    const owe = l.qty - (l.returnedQty || 0);
                    return (
                      <Stack key={l._id} direction="row" spacing={1.25} alignItems="center">
                        <Thumb item={photoOf.get(String(l.item)) || { kind: l.kind }} size={36} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography noWrap sx={{ fontWeight: 700, fontSize: "0.86rem" }}>{l.name}</Typography>
                          <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>ค้างคืน {fmt(owe)} {l.unit}</Typography>
                        </Box>
                        <TextField size="small" type="number" value={ret[l._id] ?? 0} sx={{ ...FIELD_SX, width: 84 }}
                          onChange={(e) => setRet((cur) => ({ ...cur, [l._id]: Math.min(owe, Math.max(0, Math.floor(Number(e.target.value) || 0))) }))}
                          inputProps={{ min: 0, max: owe, inputMode: "numeric", style: { textAlign: "center", fontWeight: 800 } }} />
                      </Stack>
                    );
                  })}
                </Stack>
              ) : (
                <Box sx={{ border: `1px solid ${BORDER_MAIN}`, borderRadius: 2, overflow: "hidden" }}>
                  {doc.lines.map((l, i) => (
                    <Stack key={l._id} direction="row" alignItems="center" sx={{ px: 1.25, py: 0.9, borderTop: i ? `1px solid ${BORDER_MAIN}` : 0 }}>
                      <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.86rem" }}>{l.name}</Typography>
                      <Typography sx={{ fontWeight: 800, fontSize: "0.86rem", color: confirm === "issue" ? "#dc2626" : TEXT_MAIN, whiteSpace: "nowrap" }}>
                        {confirm === "issue" ? "−" : ""}{fmt(l.qty)} {l.unit}
                      </Typography>
                    </Stack>
                  ))}
                </Box>
              )}
              {confirm === "reject" && (
                <Box sx={{ mt: 1.5 }}>
                  <Label required>เหตุผลที่ไม่อนุมัติ</Label>
                  <TextField autoFocus fullWidth size="small" sx={FIELD_SX} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เช่น ของไม่ตรงกับงาน / ให้ใช้รุ่นอื่นแทน" />
                </Box>
              )}
              {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setConfirm(null)} disabled={busy} sx={{ ...BTN, fontWeight: 700, color: TEXT_SUB }}>กลับ</Button>
              <Button variant="contained" disabled={busy || c.need} onClick={() => run(c.act)}
                startIcon={busy ? <CircularProgress size={15} color="inherit" /> : c.icon}
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
          const { generateStockPdf } = await import("../utils/stockPdf");
          return generateStockPdf({ request: doc, deptLabel, mode: "blob" });
        }}
        title={doc?.docNo || "ใบเบิกของ"}
        subtitle={doc ? `ใบเบิกของ · ${doc.jobTitle || ""}` : ""}
        badge={<Box component="span" sx={{ px: 0.9, height: 20, display: "inline-flex", alignItems: "center", borderRadius: 999, bgcolor: STOCK_ACCENT, color: "#fff", fontSize: "0.66rem", fontWeight: 900, letterSpacing: "0.06em" }}>SR</Box>}
        color={STOCK_ACCENT} dark={STOCK_DARK}
        shareText={doc ? `ใบเบิกของ ${doc.docNo} · ${doc.jobTitle || ""}` : ""}
        email={doc ? { docType: "ใบเบิกของ", docNo: doc.docNo, refId: String(doc._id), project: doc.jobTitle, audience: "internal" } : undefined}
      />
    </>
  );
}
