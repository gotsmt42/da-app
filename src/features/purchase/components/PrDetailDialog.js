/**
 * PrDetailDialog — รายละเอียดใบขอซื้อ + ปุ่มตามขั้น
 *   ตรวจสอบ → อนุมัติ → (ฝ่ายจัดซื้อ) บันทึกสั่งซื้อ → รับของ (ทีละส่วนได้) → ปิดใบ
 * ⚠️ ซ่อนปุ่มตามสิทธิ์เหมือนระบบเบิก — ตัวตัดสินจริงอยู่ที่ server (routes/purchase.js)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import moment from "moment";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography, IconButton, Alert, Skeleton,
  useMediaQuery, TextField, CircularProgress, Tooltip, Divider, LinearProgress, MenuItem, Chip,
} from "@mui/material";
import {
  Close, Edit, Undo, Block, FactCheck, CheckCircle, DoneAll, History, ShoppingCart, LocalShipping, Inventory2, Print,
  AttachFile, DeleteOutline, Description, Image as ImageIcon, TaskAlt,
} from "@mui/icons-material";

import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import { ACCEPT_ALL } from "@/shared/utils/fileUpload";
import { thaiDate, thaiDateTime } from "@/shared/utils/thaiDate";
import { useAuth } from "@/features/auth/AuthContext";
import usePermissions from "@/shared/hooks/usePermissions";
import PurchaseService, { errorText } from "../services/PurchaseService";
import PrStatusBadge from "./PrStatusBadge";
import {
  PR_ACCENT, PR_DARK, TEXT_MAIN, TEXT_SUB, BORDER_MAIN, priorityMeta, fileKindLabel, fmtMoney, fmtQty, baht, prJobText, receiveProgress, money,
} from "../prMeta";

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
const Info = ({ label, children, span }) => (
  <Box sx={{ minWidth: 0, gridColumn: span ? "1 / -1" : "auto" }}>
    <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 600, display: "block" }}>{label}</Typography>
    <Box sx={{ fontSize: "0.9rem", fontWeight: 600, color: TEXT_MAIN, wordBreak: "break-word" }}>{children || "-"}</Box>
  </Box>
);

/** เส้นขั้นตอน 4 ขั้น */
const STEPS = [
  { label: "ขอซื้อ", done: () => true },
  { label: "ตรวจสอบ/อนุมัติ", done: (r) => ["approved", "ordered", "partial", "received"].includes(r.status) },
  { label: "สั่งซื้อ", done: (r) => ["ordered", "partial", "received"].includes(r.status) },
  { label: "รับของ", done: (r) => r.status === "received" },
];

const SIMPLE = {
  review: { title: "ตรวจสอบใบขอซื้อ", button: "ยืนยันผลตรวจสอบ", color: "#b45309", body: "ยืนยันว่ารายการและความจำเป็นถูกต้อง — ส่งต่อให้ผู้อนุมัติ" },
  reviewApprove: { title: "ตรวจสอบและอนุมัติ", button: "ยืนยันทั้งสองขั้น", color: "#059669", body: "บันทึกทั้งขั้นตรวจสอบและอนุมัติ — ใบจะไปรอฝ่ายจัดซื้อสั่งซื้อ" },
  approve: { title: "อนุมัติใบขอซื้อ", button: "ยืนยันอนุมัติ", color: "#059669", body: "อนุมัติแล้วฝ่ายจัดซื้อจะได้รับแจ้งให้สั่งซื้อ" },
  reject: { title: "ตีกลับให้แก้ไข", button: "ตีกลับ", color: "#dc2626", body: "ผู้ขอจะได้รับแจ้งพร้อมเหตุผล และแก้ส่งใหม่ในใบเดิมได้" },
  cancel: { title: "ยกเลิกใบขอซื้อ", button: "ยืนยันยกเลิก", color: "#64748b", body: "ยกเลิกแล้วย้อนกลับไม่ได้" },
};

export default function PrDetailDialog({ open, id, reloadKey = 0, notice, onClose, onChanged, onEdit }) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const { userData } = useAuth();
  const { can } = usePermissions();
  const [r, setR] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [action, setAction] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [toast, setToast] = useState("");
  const [order, setOrder] = useState({});
  const [recv, setRecv] = useState({});
  const [actionFiles, setActionFiles] = useState([]);
  const [printing, setPrinting] = useState(false);
  const fileRef = useRef(null);
  const actFileRef = useRef(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoadError("");
    try { setR(await PurchaseService.get(id)); } catch (err) { setLoadError(errorText(err, "เปิดใบนี้ไม่สำเร็จ")); }
  }, [id]);
  useEffect(() => { if (open) { setR(null); setAction(""); setToast(notice || ""); load(); } }, [open, load]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open && reloadKey) load(); }, [reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const me = String(userData?.userId || "");
  const isOwner = r && (r.requester?.userId === me || r.createdBy?.userId === me);
  const selfBlocked = r && r.requester?.userId === me && !can("approveOwnExpense");
  const canReview = can("reviewExpense");
  const canApprove = can("approveExpense");
  const canBuy = can("viewAllExpenses");
  const chain = canReview && canApprove && can("approveOwnReview");
  const reviewedByMe = r && r.reviewedBy?.userId === me;
  const canEdit = r && ["pending", "rejected"].includes(r.status) && (isOwner || canBuy);
  const rejectCap = r && { pending: "reviewExpense", reviewed: "approveExpense", approved: "viewAllExpenses" }[r.status];
  const canReject = Boolean(rejectCap) && can(rejectCap);
  const canCancel = r && ((isOwner && ["pending", "rejected"].includes(r.status))
    || (["pending", "rejected", "reviewed", "approved", "ordered"].includes(r.status) && (canApprove || canBuy)));
  const canOrder = r && canBuy && ["approved", "ordered", "partial"].includes(r.status);
  const canReceive = r && (isOwner || canBuy) && ["ordered", "partial"].includes(r.status);
  const canFiles = r && r.status !== "cancelled" && (isOwner || canBuy);

  const openAction = (a) => {
    setAction(a); setText(""); setActionError(""); setActionFiles([]);
    if (a === "order") {
      setOrder({
        supplier: r.order?.supplier || r.suggestedSupplier || "", supplierContact: r.order?.supplierContact || "", poNo: r.order?.poNo || "",
        orderedAt: r.order?.orderedAt ? moment(r.order.orderedAt).format("YYYY-MM-DD") : moment().format("YYYY-MM-DD"),
        expectedAt: r.order?.expectedAt ? moment(r.order.expectedAt).format("YYYY-MM-DD") : (r.neededBy ? moment(r.neededBy).format("YYYY-MM-DD") : ""),
        note: r.order?.note || "", vatRate: r.vatRate || 0,
        prices: Object.fromEntries(r.items.map((it) => [it._id, it.actualUnitPrice ?? it.estUnitPrice ?? ""])),
      });
    }
    if (a === "receive") {
      setRecv({ receivedAt: moment().format("YYYY-MM-DD"), qty: Object.fromEntries(r.items.map((it) => [it._id, Math.max(it.qty - it.receivedQty, 0)])) });
    }
  };

  const run = async () => {
    setBusy(true); setActionError("");
    try {
      let out;
      const files = actionFiles.map((file) => ({ file, kind: action === "order" ? "po" : "delivery" }));
      if (action === "review") out = await PurchaseService.review(r._id, text);
      if (action === "reviewApprove") { await PurchaseService.review(r._id, text); out = await PurchaseService.approve(r._id, text); }
      if (action === "approve") out = await PurchaseService.approve(r._id, text);
      if (action === "reject") out = await PurchaseService.reject(r._id, text);
      if (action === "cancel") out = await PurchaseService.cancel(r._id, text);
      if (action === "order") out = (await PurchaseService.order(r._id, order, files)).request;
      if (action === "receive") {
        const lines = Object.entries(recv.qty || {}).map(([itemId, qty]) => ({ itemId, qty: Number(qty) || 0 })).filter((l) => l.qty > 0);
        out = (await PurchaseService.receive(r._id, { lines, receivedAt: recv.receivedAt, note: text }, files)).request;
      }
      setR(out);
      setToast({
        review: "ตรวจสอบแล้ว — ส่งต่อให้ผู้อนุมัติ", reviewApprove: "อนุมัติแล้ว — รอฝ่ายจัดซื้อสั่งซื้อ", approve: "อนุมัติแล้ว — รอฝ่ายจัดซื้อสั่งซื้อ",
        reject: "ตีกลับแล้ว", cancel: "ยกเลิกแล้ว", order: "บันทึกการสั่งซื้อแล้ว",
        receive: out?.status === "received" ? "รับของครบแล้ว — ปิดใบเรียบร้อย" : "บันทึกรับของแล้ว",
      }[action]);
      setAction("");
      onChanged?.();
    } catch (err) {
      setActionError(errorText(err));
      if (action === "reviewApprove") load();
    } finally {
      setBusy(false);
    }
  };

  const uploadFiles = async (list) => {
    const files = Array.from(list || []).map((file) => ({ file, kind: file.type.startsWith("image/") ? "photo" : "other" }));
    if (!files.length) return;
    setBusy(true);
    try { setR((await PurchaseService.addFiles(r._id, files)).request); setToast("แนบไฟล์แล้ว"); onChanged?.(); } catch (err) { setToast(""); setLoadError(errorText(err)); } finally { setBusy(false); }
  };
  const removeFile = async (f) => {
    if (!window.confirm(`ลบไฟล์ "${f.fileName}" ?`)) return;
    setBusy(true);
    try { setR(await PurchaseService.removeFile(r._id, f._id)); } catch (err) { setLoadError(errorText(err)); } finally { setBusy(false); }
  };
  const print = async () => {
    setPrinting(true);
    try {
      const { generatePrPdf } = await import("../utils/prPdf");
      await generatePrPdf({ request: r, mode: isMobile ? "download" : "open" });
    } catch (err) {
      console.error(err);
      setLoadError("สร้างเอกสารไม่สำเร็จ — ลองใหม่อีกครั้ง");
    } finally {
      setPrinting(false);
    }
  };

  const nextText = !r ? "" : {
    pending: canReview && !selfBlocked ? "รอคุณตรวจสอบ" : "รอตรวจสอบ",
    reviewed: `ตรวจสอบโดย ${r.reviewedBy?.name || "-"} — ${canApprove && !selfBlocked ? "รอคุณอนุมัติ" : "รออนุมัติ"}`,
    approved: `อนุมัติโดย ${r.approvedBy?.name || "-"} — ${canBuy ? "รอคุณบันทึกการสั่งซื้อ" : "รอฝ่ายจัดซื้อสั่งซื้อ"}`,
    ordered: `สั่งซื้อจาก ${r.order?.supplier || "-"}${r.order?.expectedAt ? ` · กำหนดส่ง ${thaiDate(r.order.expectedAt)}` : ""} — รอรับของ`,
    partial: `รับของแล้วบางส่วน (${Math.round(receiveProgress(r) * 100)}%) — รอรับส่วนที่เหลือ`,
    received: `รับของครบเมื่อ ${thaiDate(r.receivedAt)} — ปิดใบแล้ว`,
    rejected: `ถูกตีกลับโดย ${r.rejectedBy?.name || "-"}: ${r.rejectReason || "-"}`,
    cancelled: `ยกเลิกโดย ${r.cancelledBy?.name || "-"}${r.cancelReason ? ` · ${r.cancelReason}` : ""}`,
  }[r.status];
  const late = r && r.neededBy && !["received", "cancelled"].includes(r.status) && moment(r.neededBy).isBefore(moment(), "day");
  const pr = priorityMeta(r?.priority);
  const cfg = SIMPLE[action];

  return (
    <>
      <Dialog open={open} onClose={() => !busy && onClose?.()} fullWidth maxWidth="md" fullScreen={isMobile} PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3 } }}>
        <DialogTitle sx={{ p: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: { xs: 2, sm: 2.5 }, py: 1.5, borderBottom: `1px solid ${BORDER_MAIN}` }}>
            <Box sx={{ width: 38, height: 38, borderRadius: 2.5, bgcolor: PR_ACCENT, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <ShoppingCart sx={{ fontSize: 21 }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 900, fontSize: "1.02rem", color: TEXT_MAIN }} noWrap>{r?.docNo || "ใบขอซื้อสินค้า"}</Typography>
              {r && (
                <Stack direction="row" spacing={0.75} sx={{ mt: 0.4 }}>
                  <PrStatusBadge status={r.status} />
                  {r.priority !== "normal" && <Chip size="small" label={pr.label} sx={{ height: 22, fontWeight: 800, bgcolor: pr.color, color: "#fff" }} />}
                </Stack>
              )}
            </Box>
            <IconButton onClick={onClose} disabled={busy}><Close /></IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ bgcolor: "#f8fafc", px: { xs: 1.25, sm: 2.5 }, pt: "14px !important" }}>
          {loadError && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setLoadError("")}>{loadError}</Alert>}
          {!r && !loadError && <Stack spacing={1.5}><Skeleton variant="rounded" height={110} /><Skeleton variant="rounded" height={220} /></Stack>}
          {r && (
            <>
              {toast && <Alert severity="success" onClose={() => setToast("")} sx={{ mb: 1.5, borderRadius: 2 }}>{toast}</Alert>}
              <Card>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: "1.05rem", lineHeight: 1.35 }}>{r.subject}</Typography>
                    <Typography variant="caption" sx={{ color: TEXT_SUB }}>ขอโดย {r.requester?.name}{r.requester?.position ? ` (${r.requester.position})` : ""} · {thaiDate(r.docDate)}</Typography>
                  </Box>
                  <Box sx={{ textAlign: { sm: "right" } }}>
                    <Typography variant="caption" sx={{ color: TEXT_SUB }}>{r.actualTotal ? "ยอดสั่งซื้อจริง" : "ยอดประมาณการ"}</Typography>
                    <Typography sx={{ fontWeight: 900, fontSize: "1.45rem", lineHeight: 1.1 }}>{baht(r.actualTotal || r.estTotal)}</Typography>
                    {r.actualTotal > 0 && <Typography variant="caption" sx={{ color: TEXT_SUB }}>ประมาณการ {baht(r.estTotal)}</Typography>}
                  </Box>
                </Stack>
                {/* เส้นขั้นตอน */}
                {r.status !== "cancelled" && (
                  <Stack direction="row" sx={{ mt: 1.75 }}>
                    {STEPS.map((s, i) => {
                      const done = s.done(r);
                      const cur = !done && (i === 0 || STEPS[i - 1].done(r));
                      const c = r.status === "rejected" && i === 1 ? "#dc2626" : done ? PR_ACCENT : cur ? PR_ACCENT : "#cbd5e1";
                      return (
                        <Box key={s.label} sx={{ flex: 1, textAlign: "center", position: "relative" }}>
                          {i > 0 && <Box sx={{ position: "absolute", top: 11, right: "50%", width: "100%", height: 2, bgcolor: done || cur ? "#c7d2fe" : "#e2e8f0" }} />}
                          <Box sx={{ width: 24, height: 24, mx: "auto", borderRadius: "50%", position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, bgcolor: done ? c : "#fff", color: done ? "#fff" : c, border: `2px solid ${c}` }}>
                            {done ? <TaskAlt sx={{ fontSize: 15 }} /> : i + 1}
                          </Box>
                          <Typography sx={{ fontSize: "0.74rem", fontWeight: done || cur ? 800 : 600, color: done || cur ? TEXT_MAIN : TEXT_SUB, mt: 0.5 }}>{s.label}</Typography>
                        </Box>
                      );
                    })}
                  </Stack>
                )}
                {nextText && <Alert severity={r.status === "rejected" ? "error" : r.status === "received" ? "success" : "info"} sx={{ mt: 1.5, borderRadius: 2, py: 0.25, "& .MuiAlert-message": { fontSize: "0.84rem", fontWeight: 600 } }}>{nextText}</Alert>}
                {late && <Alert severity="warning" sx={{ mt: 1, borderRadius: 2, py: 0.25 }}>เลยวันที่ต้องการใช้ ({thaiDate(r.neededBy)}) แล้ว</Alert>}
              </Card>

              <Card title="ข้อมูลการขอซื้อ">
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)" }, gap: 1.5 }}>
                  <Info label="เลขที่">{r.docNo}</Info>
                  <Info label="วันที่ขอ">{thaiDate(r.docDate)}</Info>
                  <Info label="ต้องการใช้ภายใน"><Box component="span" sx={{ color: late ? "#dc2626" : "inherit" }}>{r.neededBy ? thaiDate(r.neededBy) : "ไม่ระบุ"}</Box></Info>
                  <Info label="ความเร่งด่วน"><Box component="span" sx={{ color: pr.color }}>{pr.label}</Box></Info>
                  <Info label="สถานที่ส่งของ">{r.deliverTo}</Info>
                  <Info label="ร้านค้าที่แนะนำ">{r.suggestedSupplier}</Info>
                  <Info label="ใช้กับงาน / โครงการ" span>{r.eventId ? prJobText(r.job) : "ไม่ผูกงาน"}</Info>
                  {r.purpose && <Info label="วัตถุประสงค์" span>{r.purpose}</Info>}
                  {r.reviewedAt && <Info label="ผู้ตรวจสอบ">{r.reviewedBy?.name} · {thaiDate(r.reviewedAt)}</Info>}
                  {r.approvedAt && <Info label="ผู้อนุมัติ">{r.approvedBy?.name} · {thaiDate(r.approvedAt)}</Info>}
                  {r.note && <Info label="หมายเหตุ" span>{r.note}</Info>}
                </Box>
              </Card>

              <Card title={`รายการสินค้า (${r.items.length})`} action={["ordered", "partial", "received"].includes(r.status) && (
                <Typography variant="caption" sx={{ fontWeight: 800, color: TEXT_SUB }}>รับแล้ว {Math.round(receiveProgress(r) * 100)}%</Typography>
              )}>
                {["ordered", "partial", "received"].includes(r.status) && (
                  <LinearProgress variant="determinate" value={receiveProgress(r) * 100} sx={{ mb: 1.5, height: 6, borderRadius: 3, bgcolor: "#e0e7ff", "& .MuiLinearProgress-bar": { bgcolor: r.status === "received" ? "#15803d" : PR_ACCENT } }} />
                )}
                <Stack divider={<Divider flexItem />} spacing={1}>
                  {r.items.map((it, i) => {
                    const got = it.receivedQty || 0;
                    const showRecv = ["ordered", "partial", "received"].includes(r.status);
                    return (
                      <Stack key={it._id} direction="row" spacing={1.25} alignItems="flex-start">
                        <Typography sx={{ width: 20, color: TEXT_SUB, fontWeight: 700, fontSize: "0.82rem", pt: 0.2 }}>{i + 1}</Typography>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: "0.9rem" }}>{it.description}</Typography>
                          {it.spec && <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>{it.spec}</Typography>}
                          <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>
                            {fmtQty(it.qty)} {it.unit} × {it.actualUnitPrice !== null && it.actualUnitPrice !== undefined ? `${fmtMoney(it.actualUnitPrice)} (ราคาจริง)` : fmtMoney(it.estUnitPrice)}
                            {it.note ? ` · ${it.note}` : ""}
                          </Typography>
                          {showRecv && (
                            <Typography variant="caption" sx={{ fontWeight: 800, color: got >= it.qty ? "#15803d" : got > 0 ? "#be185d" : TEXT_SUB }}>
                              รับแล้ว {fmtQty(got)}/{fmtQty(it.qty)} {it.unit}
                            </Typography>
                          )}
                        </Box>
                        <Typography sx={{ fontWeight: 800, fontSize: "0.92rem" }}>{fmtMoney(it.actualAmount ?? it.estAmount)}</Typography>
                      </Stack>
                    );
                  })}
                </Stack>
                <Divider sx={{ my: 1.25 }} />
                <Stack spacing={0.25} alignItems="flex-end">
                  {r.vatRate > 0 && <Typography variant="body2" sx={{ color: TEXT_SUB }}>รวมก่อน VAT {fmtMoney(r.estSubtotal)} · VAT {r.vatRate}%</Typography>}
                  <Typography sx={{ fontWeight: 900 }}>ประมาณการรวม {fmtMoney(r.estTotal)}</Typography>
                  {r.actualTotal > 0 && (
                    <Typography sx={{ fontWeight: 900, color: r.actualTotal > r.estTotal ? "#b91c1c" : "#15803d" }}>
                      ยอดจริง {fmtMoney(r.actualTotal)} ({r.actualTotal > r.estTotal ? "+" : ""}{fmtMoney(money(r.actualTotal - r.estTotal))})
                    </Typography>
                  )}
                </Stack>
              </Card>

              {r.order?.orderedAt && (
                <Card title="การสั่งซื้อ" icon={<LocalShipping sx={{ fontSize: 18, color: PR_ACCENT }} />}>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)" }, gap: 1.5 }}>
                    <Info label="ร้านค้า / ผู้ขาย">{r.order.supplier}</Info>
                    <Info label="ผู้ติดต่อ / โทร">{r.order.supplierContact}</Info>
                    <Info label="เลขที่ PO">{r.order.poNo}</Info>
                    <Info label="วันที่สั่ง">{thaiDate(r.order.orderedAt)}</Info>
                    <Info label="กำหนดส่ง">{r.order.expectedAt ? thaiDate(r.order.expectedAt) : "-"}</Info>
                    <Info label="ผู้สั่งซื้อ">{r.order.by?.name}</Info>
                    {r.order.note && <Info label="หมายเหตุ" span>{r.order.note}</Info>}
                  </Box>
                </Card>
              )}

              {r.receipts?.length > 0 && (
                <Card title={`การรับของ (${r.receipts.length} ครั้ง)`} icon={<Inventory2 sx={{ fontSize: 18, color: PR_ACCENT }} />}>
                  <Stack spacing={1}>
                    {r.receipts.map((rc, i) => (
                      <Box key={rc._id || i}>
                        <Typography sx={{ fontSize: "0.86rem", fontWeight: 700 }}>{thaiDate(rc.at)} · รับโดย {rc.by?.name}</Typography>
                        <Typography variant="caption" sx={{ color: TEXT_SUB }}>{rc.lines.map((l) => `${l.description} ${fmtQty(l.qty)}`).join(" · ")}{rc.note ? ` · ${rc.note}` : ""}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </Card>
              )}

              <Card title={`เอกสารแนบ (${r.attachments?.length || 0})`} icon={<AttachFile sx={{ fontSize: 18, color: TEXT_SUB }} />}
                action={canFiles && <Button size="small" startIcon={<AttachFile />} disabled={busy} onClick={() => fileRef.current?.click()} sx={{ textTransform: "none", fontWeight: 700 }}>แนบเพิ่ม</Button>}>
                <input ref={fileRef} type="file" hidden multiple accept={ACCEPT_ALL} onChange={(ev) => { uploadFiles(ev.target.files); ev.target.value = ""; }} />
                {!r.attachments?.length ? <Typography variant="body2" sx={{ color: TEXT_SUB }}>ไม่มีไฟล์แนบ</Typography> : (
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 }}>
                    {r.attachments.map((f) => {
                      const isImg = String(f.fileType || "").startsWith("image/");
                      return (
                        <Stack key={f._id} direction="row" spacing={1} alignItems="center" sx={{ p: 0.75, border: `1px solid ${BORDER_MAIN}`, borderRadius: 2, minWidth: 0 }}>
                          <Box component="a" href={f.fileUrl} target="_blank" rel="noreferrer" sx={{ width: 40, height: 40, borderRadius: 1.5, overflow: "hidden", bgcolor: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: TEXT_SUB, flexShrink: 0 }}>
                            {isImg ? <Box component="img" src={f.fileUrl} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover" }} /> : String(f.fileType).includes("pdf") ? <Description /> : <ImageIcon />}
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography component="a" href={f.fileUrl} target="_blank" rel="noreferrer" sx={{ fontSize: "0.82rem", fontWeight: 700, color: TEXT_MAIN, textDecoration: "none", display: "block" }} noWrap>{f.fileName}</Typography>
                            <Typography variant="caption" sx={{ color: TEXT_SUB }} noWrap component="div">{fileKindLabel(f.kind)} · {f.uploadedBy} · {thaiDate(f.uploadedAt)}</Typography>
                          </Box>
                          {canFiles && <Tooltip title="ลบไฟล์"><IconButton size="small" disabled={busy} onClick={() => removeFile(f)}><DeleteOutline fontSize="small" /></IconButton></Tooltip>}
                        </Stack>
                      );
                    })}
                  </Box>
                )}
              </Card>

              <Card title="ประวัติ" icon={<History sx={{ fontSize: 18, color: TEXT_SUB }} />}>
                <Stack spacing={1}>
                  {[...(r.activityLog || [])].reverse().map((a, i) => (
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

        {r && (
          <DialogActions sx={{ px: { xs: 1, sm: 2.5 }, py: 1.25, borderTop: `1px solid ${BORDER_MAIN}`, gap: 0.75, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Button onClick={print} disabled={printing} startIcon={printing ? <CircularProgress size={15} /> : <Print />} sx={{ textTransform: "none", fontWeight: 700, mr: "auto" }}>พิมพ์ PDF</Button>
            {canCancel && <Button onClick={() => openAction("cancel")} startIcon={<Block />} sx={{ textTransform: "none", fontWeight: 700, color: TEXT_SUB }}>ยกเลิก</Button>}
            {canEdit && <Button onClick={() => onEdit?.(r)} startIcon={<Edit />} sx={{ textTransform: "none", fontWeight: 700 }}>{r.status === "rejected" ? "แก้ไข / ส่งใหม่" : "แก้ไข"}</Button>}
            {canReject && <Button onClick={() => openAction("reject")} disabled={selfBlocked} startIcon={<Undo />} sx={{ textTransform: "none", fontWeight: 700, color: "#dc2626" }}>ตีกลับ</Button>}
            {chain && r.status === "pending" && (
              <Tooltip title={selfBlocked ? "ใบของตัวเองต้องให้หัวหน้าท่านอื่นพิจารณา" : ""} describeChild><span>
                <Button variant="contained" disabled={selfBlocked} onClick={() => openAction("reviewApprove")} startIcon={<DoneAll />}
                  sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: "#059669", "&:hover": { bgcolor: "#047857", boxShadow: "none" } }}>ตรวจสอบและอนุมัติ</Button>
              </span></Tooltip>
            )}
            {canReview && r.status === "pending" && (
              <Tooltip title={selfBlocked ? "ตรวจสอบใบของตัวเองไม่ได้" : ""} describeChild><span>
                <Button variant={chain ? "outlined" : "contained"} disabled={selfBlocked} onClick={() => openAction("review")} startIcon={<FactCheck />}
                  sx={chain ? { textTransform: "none", fontWeight: 800, borderRadius: 2, color: "#b45309", borderColor: "#fcd34d" } : { textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: "#b45309" }}>
                  {chain ? "ตรวจสอบอย่างเดียว" : "ตรวจสอบ"}
                </Button>
              </span></Tooltip>
            )}
            {canApprove && r.status === "reviewed" && (
              <Tooltip title={selfBlocked ? "อนุมัติใบของตัวเองไม่ได้" : reviewedByMe && !can("approveOwnReview") ? "คุณเป็นผู้ตรวจสอบใบนี้แล้ว" : ""} describeChild><span>
                <Button variant="contained" disabled={selfBlocked || (reviewedByMe && !can("approveOwnReview"))} onClick={() => openAction("approve")} startIcon={<CheckCircle />}
                  sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: "#059669", "&:hover": { bgcolor: "#047857", boxShadow: "none" } }}>อนุมัติ</Button>
              </span></Tooltip>
            )}
            {canOrder && (
              <Button variant={r.status === "approved" ? "contained" : "outlined"} onClick={() => openAction("order")} startIcon={<ShoppingCart />}
                sx={r.status === "approved" ? { textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: PR_ACCENT, "&:hover": { bgcolor: PR_DARK, boxShadow: "none" } } : { textTransform: "none", fontWeight: 700, borderRadius: 2 }}>
                {r.status === "approved" ? "บันทึกสั่งซื้อ" : "แก้ข้อมูลสั่งซื้อ"}
              </Button>
            )}
            {canReceive && (
              <Button variant="contained" onClick={() => openAction("receive")} startIcon={<Inventory2 />}
                sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: "#0e7490", "&:hover": { bgcolor: "#155e75", boxShadow: "none" } }}>รับของ</Button>
            )}
          </DialogActions>
        )}
      </Dialog>

      {/* ── กล่องยืนยันขั้นทั่วไป ── */}
      <Dialog open={Boolean(cfg)} onClose={() => !busy && setAction("")} fullWidth maxWidth="xs">
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
              <Button onClick={() => setAction("")} disabled={busy} sx={{ textTransform: "none", color: TEXT_SUB }}>ปิด</Button>
              <Button variant="contained" onClick={run} disabled={busy || (action === "reject" && !text.trim())} startIcon={busy ? <CircularProgress size={15} color="inherit" /> : null}
                sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: cfg.color, "&:hover": { bgcolor: cfg.color, filter: "brightness(0.92)", boxShadow: "none" } }}>{cfg.button}</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* ── บันทึกสั่งซื้อ ── */}
      <Dialog open={action === "order"} onClose={() => !busy && setAction("")} fullWidth maxWidth="sm" fullScreen={isMobile}>
        <DialogTitle sx={{ fontWeight: 800, pb: 0.5 }}>บันทึกการสั่งซื้อ · {r?.docNo}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: TEXT_SUB, mb: 2 }}>ระบุร้านค้า เลขที่ PO และราคาจริง — ผู้ขอจะได้รับแจ้งว่าสั่งซื้อแล้วและกำหนดส่งเมื่อไร</Typography>
          {actionError && <Alert severity="error" sx={{ mb: 1.5 }}>{actionError}</Alert>}
          {r && action === "order" && (
            <Stack spacing={1.5}>
              <TextField size="small" label="ร้านค้า / ผู้ขาย *" value={order.supplier} onChange={(e) => setOrder((o) => ({ ...o, supplier: e.target.value }))} />
              <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: "1fr 1fr" }}>
                <TextField size="small" label="ผู้ติดต่อ / เบอร์โทร" value={order.supplierContact} onChange={(e) => setOrder((o) => ({ ...o, supplierContact: e.target.value }))} />
                <TextField size="small" label="เลขที่ PO" value={order.poNo} onChange={(e) => setOrder((o) => ({ ...o, poNo: e.target.value }))} />
                <ThaiDatePicker label="วันที่สั่งซื้อ" value={order.orderedAt} onChange={(v) => setOrder((o) => ({ ...o, orderedAt: v || o.orderedAt }))} />
                <ThaiDatePicker label="กำหนดส่ง" value={order.expectedAt} onChange={(v) => setOrder((o) => ({ ...o, expectedAt: v || "" }))} />
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: "0.86rem" }}>ราคาจริงต่อหน่วย</Typography>
              {r.items.map((it) => (
                <Stack key={it._id} direction="row" spacing={1} alignItems="center">
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.86rem", fontWeight: 700 }} noWrap>{it.description}</Typography>
                    <Typography variant="caption" sx={{ color: TEXT_SUB }}>{fmtQty(it.qty)} {it.unit} · ประมาณ {fmtMoney(it.estUnitPrice)}</Typography>
                  </Box>
                  <TextField size="small" type="number" value={order.prices?.[it._id] ?? ""} sx={{ width: 130 }} inputProps={{ min: 0, step: "any" }}
                    onChange={(e) => setOrder((o) => ({ ...o, prices: { ...o.prices, [it._id]: e.target.value } }))} />
                </Stack>
              ))}
              <TextField select size="small" label="VAT" value={order.vatRate} onChange={(e) => setOrder((o) => ({ ...o, vatRate: Number(e.target.value) }))}>
                <MenuItem value={0}>ไม่มี / ราคารวมแล้ว</MenuItem><MenuItem value={7}>บวก VAT 7%</MenuItem>
              </TextField>
              <Typography sx={{ fontWeight: 900, textAlign: "right" }}>
                ยอดสั่งซื้อ {baht(money(r.items.reduce((s, it) => s + it.qty * (Number(order.prices?.[it._id]) || 0), 0) * (1 + (order.vatRate || 0) / 100)))}
              </Typography>
              <TextField size="small" label="หมายเหตุ" value={order.note} onChange={(e) => setOrder((o) => ({ ...o, note: e.target.value }))} />
              <input ref={actFileRef} type="file" hidden multiple accept={ACCEPT_ALL} onChange={(e) => { setActionFiles((f) => [...f, ...Array.from(e.target.files || [])].slice(0, 10)); e.target.value = ""; }} />
              <Box>
                <Button size="small" startIcon={<AttachFile />} onClick={() => actFileRef.current?.click()} sx={{ textTransform: "none", fontWeight: 700 }}>แนบใบสั่งซื้อ / ใบเสนอราคา</Button>
                {actionFiles.map((f, i) => <Chip key={`${f.name}-${i}`} size="small" label={f.name} onDelete={() => setActionFiles((x) => x.filter((_, j) => j !== i))} sx={{ m: 0.25 }} />)}
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAction("")} disabled={busy} sx={{ textTransform: "none", color: TEXT_SUB }}>ปิด</Button>
          <Button variant="contained" onClick={run} disabled={busy || !String(order.supplier || "").trim()} startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <ShoppingCart />}
            sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: PR_ACCENT }}>บันทึกสั่งซื้อ</Button>
        </DialogActions>
      </Dialog>

      {/* ── รับของ ── */}
      <Dialog open={action === "receive"} onClose={() => !busy && setAction("")} fullWidth maxWidth="sm" fullScreen={isMobile}>
        <DialogTitle sx={{ fontWeight: 800, pb: 0.5 }}>บันทึกรับของ · {r?.docNo}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: TEXT_SUB, mb: 2 }}>ใส่จำนวนที่ได้รับจริงครั้งนี้ — รับไม่ครบก็บันทึกได้ ระบบจะรอรับส่วนที่เหลือ</Typography>
          {actionError && <Alert severity="error" sx={{ mb: 1.5 }}>{actionError}</Alert>}
          {r && action === "receive" && (
            <Stack spacing={1.25}>
              <ThaiDatePicker label="วันที่รับของ" value={recv.receivedAt} onChange={(v) => setRecv((x) => ({ ...x, receivedAt: v || x.receivedAt }))} />
              {r.items.map((it) => {
                const left = Math.max(it.qty - (it.receivedQty || 0), 0);
                return (
                  <Stack key={it._id} direction="row" spacing={1} alignItems="center" sx={{ opacity: left ? 1 : 0.5 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: "0.86rem", fontWeight: 700 }} noWrap>{it.description}</Typography>
                      <Typography variant="caption" sx={{ color: TEXT_SUB }}>สั่ง {fmtQty(it.qty)} · รับแล้ว {fmtQty(it.receivedQty || 0)} · เหลือ {fmtQty(left)} {it.unit}</Typography>
                    </Box>
                    <TextField size="small" type="number" disabled={!left} value={recv.qty?.[it._id] ?? 0} sx={{ width: 110 }} inputProps={{ min: 0, max: left, step: "any" }}
                      onChange={(e) => setRecv((x) => ({ ...x, qty: { ...x.qty, [it._id]: e.target.value } }))} />
                  </Stack>
                );
              })}
              <TextField size="small" label="หมายเหตุ" value={text} onChange={(e) => setText(e.target.value)} placeholder="เช่น ของชำรุด 1 ชิ้น รอเปลี่ยน" />
              <input ref={actFileRef} type="file" hidden multiple accept={ACCEPT_ALL} onChange={(e) => { setActionFiles((f) => [...f, ...Array.from(e.target.files || [])].slice(0, 10)); e.target.value = ""; }} />
              <Box>
                <Button size="small" startIcon={<AttachFile />} onClick={() => actFileRef.current?.click()} sx={{ textTransform: "none", fontWeight: 700 }}>แนบใบส่งของ / รูปของที่ได้รับ</Button>
                {actionFiles.map((f, i) => <Chip key={`${f.name}-${i}`} size="small" label={f.name} onDelete={() => setActionFiles((x) => x.filter((_, j) => j !== i))} sx={{ m: 0.25 }} />)}
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAction("")} disabled={busy} sx={{ textTransform: "none", color: TEXT_SUB }}>ปิด</Button>
          <Button variant="contained" onClick={run} disabled={busy} startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <Inventory2 />}
            sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: "#0e7490" }}>บันทึกรับของ</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

