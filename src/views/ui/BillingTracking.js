/**
 * BillingTracking.js — "ติดตามการวางบิล / รับเงิน" (ครึ่งท้ายของสายงานที่เดิมขาดไปทั้งท่อน)
 *
 * เดิมระบบรู้แค่ "มูลค่าสัญญา" กับ "ยอดที่เสนอราคาไป" และรู้แค่ว่าส่งใบแจ้งหนี้แล้วหรือยัง
 * (documentSentInvoice เป็น boolean เฉยๆ) — ตอบไม่ได้เลยว่าเดือนนี้วางบิลไปเท่าไร เก็บเงินได้เท่าไร
 * ค้างรับเท่าไร ใครค้างนานสุด
 *
 * ⚠️ ยอดภาษีทั้งหมดคำนวณที่ server เท่านั้นแล้วเก็บค่าไว้ (ดู da-app-server/utils/billing.js)
 * หน้านี้ "แสดงสิ่งที่บันทึกไว้จริง" ไม่ได้คำนวณยอดที่จะบันทึกเอง — ยกเว้นตัวอย่างระหว่างพิมพ์ในฟอร์ม
 * ⚠️ วางบิล "ต่อครั้งที่เข้างาน" ตามที่บริษัททำจริง (สัญญา 4 ครั้ง = วางบิล 4 ใบ) แถวในหน้านี้จึงเป็น
 * งานรายครั้ง ไม่ใช่รายสัญญา
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import moment from "moment";
import "moment/locale/th";
import {
  Box, Stack, Typography, TextField, InputAdornment, IconButton, Chip, Skeleton,
  Paper, Dialog, DialogTitle, DialogContent, DialogActions, Button, Tooltip, Divider,
  ToggleButton, ToggleButtonGroup, useMediaQuery, Pagination, Alert, MenuItem,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Search, Clear, Refresh, ReceiptLong, Payments, WarningAmber, CheckCircle,
  FolderOpen, AddCircleOutline, DeleteOutline, HourglassEmpty,
} from "@mui/icons-material";
import { useAuth } from "../../auth/AuthContext";
import EventService from "../../services/EventService";
import { billingStatus, previewAmounts, paidTotal, baht, round2, BILLING_STATE_META } from "../../utils/billing";

const ACCENT = "#0891b2";
const TEXT_SUB = "#64748b";

// ⚠️ "ยังไม่วางบิล" ตั้งใจนับเฉพาะงานที่ทำเสร็จแล้วเท่านั้น — งานที่ยังไม่ได้เข้าไปทำยังไม่ถึงคิววางบิล
// ถ้านับทุกงาน แท็บนี้จะมีงานในอนาคตปนมาเป็นร้อยจนหาของจริงไม่เจอ
const DONE_STATUS = "ดำเนินการเสร็จสิ้น";

const TABS = [
  { key: "attention", label: "ต้องตาม" },
  { key: "not_invoiced", label: "ยังไม่วางบิล" },
  { key: "overdue", label: "เลยกำหนด" },
  { key: "unpaid", label: "รอชำระ" },
  { key: "partial", label: "ชำระบางส่วน" },
  { key: "paid", label: "ชำระครบ" },
  { key: "all", label: "ทั้งหมด" },
];

const EMPTY_INVOICE = {
  invoiceNo: "", invoicedAt: moment().format("YYYY-MM-DD"),
  creditTermDays: 30, amountBeforeVat: "", vatRate: 7, whtRate: 3, note: "",
};

export default function BillingTracking() {
  const { userData, loading: authLoading } = useAuth();
  const role = (userData?.role || "").toLowerCase();
  const isAdminOrManager = ["admin", "manager"].includes(role);
  const isMobile = useMediaQuery("(max-width:900px)");

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("attention");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState(null);        // งานที่กำลังเปิดกล่องจัดการ
  const [form, setForm] = useState(EMPTY_INVOICE);
  const [payForm, setPayForm] = useState({ amount: "", paidAt: moment().format("YYYY-MM-DD"), method: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await EventService.getEventOp().catch(() => ({ userEvents: [] }));
      setEvents(res?.userEvents || []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // ── ประกอบแถว ─────────────────────────────────────────────────────────
  const rows = useMemo(() => events.map((e) => ({
    event: e,
    status: billingStatus(e.billing),
  })), [events]);

  const counts = useMemo(() => {
    const c = { not_invoiced: 0, unpaid: 0, partial: 0, overdue: 0, paid: 0, all: rows.length };
    rows.forEach(({ event, status }) => {
      if (status.state === "not_invoiced") {
        if (event.status === DONE_STATUS) c.not_invoiced += 1;
        return;
      }
      c[status.state] += 1;
    });
    c.attention = c.not_invoiced + c.overdue + c.partial;
    return c;
  }, [rows]);

  const totals = useMemo(() => rows.reduce((a, { status }) => {
    if (status.state === "not_invoiced") return a;
    return {
      invoiced: round2(a.invoiced + status.net),
      received: round2(a.received + status.paid),
      outstanding: round2(a.outstanding + Math.max(0, status.outstanding)),
      overdue: round2(a.overdue + (status.state === "overdue" ? Math.max(0, status.outstanding) : 0)),
    };
  }, { invoiced: 0, received: 0, outstanding: 0, overdue: 0 }), [rows]);

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    let list = rows;
    if (tab === "not_invoiced") {
      list = rows.filter(({ event, status }) => status.state === "not_invoiced" && event.status === DONE_STATUS);
    } else if (tab === "attention") {
      // เรียงตามความเร่งด่วน: เลยกำหนดก่อน แล้วชำระบางส่วน แล้วงานเสร็จที่ยังไม่วางบิล
      list = rows.filter(({ event, status }) =>
        status.state === "overdue" || status.state === "partial"
        || (status.state === "not_invoiced" && event.status === DONE_STATUS));
    } else if (tab !== "all") {
      list = rows.filter(({ status }) => status.state === tab);
    }
    if (kw) {
      list = list.filter(({ event: e }) =>
        [e.company, e.site, e.title, e.system, e.contractNo, e.billing?.invoiceNo]
          .some((v) => (v || "").toLowerCase().includes(kw)));
    }
    const rank = { overdue: 0, partial: 1, not_invoiced: 2, unpaid: 3, paid: 4 };
    return list.slice().sort((a, b) => {
      if (tab === "attention") {
        const r = (rank[a.status.state] ?? 9) - (rank[b.status.state] ?? 9);
        if (r !== 0) return r;
        return (b.status.overdueDays || 0) - (a.status.overdueDays || 0);
      }
      const ad = a.event.billing?.invoicedAt || a.event.start || 0;
      const bd = b.event.billing?.invoicedAt || b.event.start || 0;
      return new Date(bd) - new Date(ad);
    });
  }, [rows, tab, search]);

  const pageSize = isMobile ? 6 : 12;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  useEffect(() => { setPage(1); }, [tab, search]);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // ── การจัดการ ─────────────────────────────────────────────────────────
  const openDialog = (event) => {
    const b = event.billing || {};
    setTarget(event);
    setError("");
    setForm(b.invoicedAt ? {
      invoiceNo: b.invoiceNo || "",
      invoicedAt: moment(b.invoicedAt).format("YYYY-MM-DD"),
      creditTermDays: b.creditTermDays ?? 30,
      amountBeforeVat: b.amountBeforeVat ?? "",
      vatRate: b.vatRate ?? 7,
      whtRate: b.whtRate ?? 3,
      note: b.note || "",
    } : {
      ...EMPTY_INVOICE,
      // เติมยอดตั้งต้นจากมูลค่างานที่บันทึกไว้แล้ว — ส่วนใหญ่วางบิลตามยอดนี้ ไม่ต้องพิมพ์ซ้ำ
      amountBeforeVat: event.jobValue || event.quotationAmount || "",
    });
    setPayForm({ amount: "", paidAt: moment().format("YYYY-MM-DD"), method: "", note: "" });
  };

  const refreshTarget = (updated) => {
    setEvents((prev) => prev.map((e) => (e._id === updated._id ? updated : e)));
    setTarget(updated);
  };

  const saveInvoice = async () => {
    if (!target) return;
    setSaving(true); setError("");
    try {
      const res = await EventService.SaveBilling(target._id, {
        ...form, amountBeforeVat: Number(form.amountBeforeVat),
      });
      refreshTarget(res.event);
    } catch (err) {
      setError(err?.response?.data?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const addPayment = async () => {
    if (!target) return;
    setSaving(true); setError("");
    try {
      const res = await EventService.AddPayment(target._id, { ...payForm, amount: Number(payForm.amount) });
      refreshTarget(res.event);
      setPayForm({ amount: "", paidAt: moment().format("YYYY-MM-DD"), method: "", note: "" });
    } catch (err) {
      setError(err?.response?.data?.message || "บันทึกรับเงินไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const removePayment = async (paymentId) => {
    if (!target) return;
    setSaving(true); setError("");
    try {
      const res = await EventService.DeletePayment(target._id, paymentId);
      refreshTarget(res.event);
    } catch (err) {
      setError(err?.response?.data?.message || "ลบรายการไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) return null;
  if (!isAdminOrManager) return <Navigate to="/dashboard" replace />;

  const preview = previewAmounts({
    amountBeforeVat: form.amountBeforeVat, vatRate: form.vatRate, whtRate: form.whtRate,
  });
  const targetStatus = target ? billingStatus(target.billing) : null;

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2 }, maxWidth: 1400, mx: "auto" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: "1.05rem", sm: "1.25rem" } }}>ติดตามการวางบิล / รับเงิน</Typography>
          <Typography variant="caption" sx={{ color: TEXT_SUB }}>วางบิลต่อครั้งที่เข้างาน · รับเงินแบ่งจ่ายได้</Typography>
        </Box>
        <Tooltip title="โหลดข้อมูลใหม่"><IconButton onClick={load} size="small"><Refresh /></IconButton></Tooltip>
      </Stack>

      <Box sx={{
        display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" },
        gap: 1, mb: 2, p: 1.5, borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "background.paper",
      }}>
        {[
          { label: "วางบิลแล้ว (สุทธิ)", value: totals.invoiced, color: ACCENT, icon: <ReceiptLong sx={{ fontSize: 16 }} /> },
          { label: "รับเงินแล้ว", value: totals.received, color: "#10b981", icon: <CheckCircle sx={{ fontSize: 16 }} /> },
          { label: "ค้างรับ", value: totals.outstanding, color: "#f59e0b", icon: <HourglassEmpty sx={{ fontSize: 16 }} /> },
          { label: "เลยกำหนดชำระ", value: totals.overdue, color: "#dc2626", icon: <WarningAmber sx={{ fontSize: 16 }} /> },
        ].map((s, i) => (
          <Box key={i} sx={{ textAlign: "center", minWidth: 0 }}>
            <Box sx={{ color: s.color, mb: 0.25 }}>{s.icon}</Box>
            {loading ? <Skeleton width={70} sx={{ mx: "auto" }} /> : (
              <Typography fontWeight={800} sx={{ fontSize: "1rem", overflow: "hidden", textOverflow: "ellipsis" }}>{baht(s.value)}</Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem" }}>{s.label}</Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ mb: 2, overflowX: "auto", pb: 0.5 }}>
        <ToggleButtonGroup value={tab} exclusive size="small" onChange={(_, v) => v && setTab(v)} sx={{ width: "max-content" }}>
          {TABS.map((t) => (
            <ToggleButton key={t.key} value={t.key} sx={{ textTransform: "none", fontWeight: 700, px: 1.4, fontSize: "0.73rem", whiteSpace: "nowrap" }}>
              {t.label} ({counts[t.key] ?? 0})
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      <TextField
        fullWidth size="small" placeholder="ค้นหาลูกค้า / โครงการ / เลขที่ใบวางบิล..."
        value={search} onChange={(e) => setSearch(e.target.value)} sx={{ mb: 2 }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18, color: search ? ACCENT : "text.disabled" }} /></InputAdornment>,
          endAdornment: search ? (
            <InputAdornment position="end"><IconButton size="small" onClick={() => setSearch("")}><Clear sx={{ fontSize: 16 }} /></IconButton></InputAdornment>
          ) : null,
        }}
      />

      {loading ? (
        <Stack spacing={1.5}>{[1, 2, 3, 4].map((i) => <Skeleton key={i} variant="rounded" height={78} sx={{ borderRadius: 3 }} />)}</Stack>
      ) : filtered.length === 0 ? (
        <Paper variant="outlined" sx={{ textAlign: "center", py: 6, borderRadius: 3, borderStyle: "dashed" }}>
          <FolderOpen sx={{ fontSize: 32, color: alpha(ACCENT, 0.5), mb: 1 }} />
          <Typography variant="body2" color="text.secondary">ไม่พบรายการในหมวดนี้</Typography>
        </Paper>
      ) : (
        <>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
            {paged.map(({ event: e, status }) => {
              const meta = BILLING_STATE_META[status.state];
              return (
                <Paper
                  key={e._id} variant="outlined" onClick={() => openDialog(e)}
                  sx={{
                    p: 1.6, borderRadius: 3, cursor: "pointer", transition: "all .15s",
                    borderLeft: `3px solid ${meta.color}`,
                    "&:hover": { borderColor: ACCENT, boxShadow: `0 2px 12px ${alpha(ACCENT, 0.15)}` },
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: "0.88rem" }} noWrap>{e.company || "ไม่ระบุลูกค้า"}</Typography>
                      <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }} noWrap>
                        {[e.site, e.title, e.time ? `ครั้งที่ ${e.time}` : ""].filter(Boolean).join(" · ")}
                      </Typography>
                      <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.6 }}>
                        <Chip size="small" label={status.label}
                          sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700, bgcolor: alpha(meta.color, 0.12), color: meta.color }} />
                        {e.billing?.invoiceNo && (
                          <Chip size="small" label={e.billing.invoiceNo}
                            sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700, bgcolor: alpha("#0f172a", 0.06), color: TEXT_SUB }} />
                        )}
                        {e.billing?.dueAt && status.state !== "paid" && (
                          <Chip size="small" label={`ครบกำหนด ${moment(e.billing.dueAt).format("DD/MM/YY")}`}
                            sx={{ height: 20, fontSize: "0.65rem", bgcolor: alpha("#0f172a", 0.06), color: TEXT_SUB }} />
                        )}
                      </Stack>
                    </Box>
                    <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                      {status.state === "not_invoiced" ? (
                        <Typography variant="caption" sx={{ color: TEXT_SUB }}>ยังไม่มียอด</Typography>
                      ) : (
                        <>
                          <Typography sx={{ fontWeight: 800, fontSize: "0.92rem" }}>{baht(status.net)}</Typography>
                          {status.outstanding > 0 && (
                            <Typography variant="caption" sx={{ color: meta.color, fontWeight: 700, display: "block" }}>
                              ค้าง {baht(status.outstanding)}
                            </Typography>
                          )}
                        </>
                      )}
                    </Box>
                  </Stack>
                </Paper>
              );
            })}
          </Box>
          {pageCount > 1 && (
            <Stack alignItems="center" sx={{ mt: 2 }}>
              <Pagination count={pageCount} page={safePage} onChange={(_, p) => setPage(p)} size="small" color="primary" />
            </Stack>
          )}
        </>
      )}

      {/* ── กล่องจัดการใบวางบิล ─────────────────────────────────────────── */}
      <Dialog open={Boolean(target)} onClose={() => !saving && setTarget(null)} fullWidth maxWidth="sm" fullScreen={isMobile}>
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: "1rem" }} noWrap>{target?.company || "ไม่ระบุลูกค้า"}</Typography>
          <Typography variant="caption" sx={{ color: TEXT_SUB }}>
            {[target?.site, target?.title, target?.time ? `ครั้งที่ ${target.time}` : ""].filter(Boolean).join(" · ")}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Typography sx={{ fontWeight: 800, fontSize: "0.85rem", mb: 1 }}>ข้อมูลใบวางบิล</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.25, mb: 1.5 }}>
            <TextField size="small" label="เลขที่ใบวางบิล" value={form.invoiceNo}
              onChange={(e) => setForm((f) => ({ ...f, invoiceNo: e.target.value }))} />
            <TextField size="small" type="date" label="วันที่วางบิล" InputLabelProps={{ shrink: true }}
              value={form.invoicedAt} onChange={(e) => setForm((f) => ({ ...f, invoicedAt: e.target.value }))} />
            <TextField size="small" type="number" label="ยอดก่อน VAT (บาท)" value={form.amountBeforeVat}
              onChange={(e) => setForm((f) => ({ ...f, amountBeforeVat: e.target.value }))}
              InputProps={{ startAdornment: <InputAdornment position="start">฿</InputAdornment> }} />
            <TextField size="small" type="number" label="เครดิตเทอม (วัน)" value={form.creditTermDays}
              onChange={(e) => setForm((f) => ({ ...f, creditTermDays: e.target.value }))} />
            <TextField select size="small" label="VAT" value={form.vatRate}
              onChange={(e) => setForm((f) => ({ ...f, vatRate: e.target.value }))}>
              <MenuItem value={7}>7%</MenuItem>
              <MenuItem value={0}>ไม่คิด VAT</MenuItem>
            </TextField>
            <TextField select size="small" label="ภาษีหัก ณ ที่จ่าย" value={form.whtRate}
              onChange={(e) => setForm((f) => ({ ...f, whtRate: e.target.value }))}>
              <MenuItem value={3}>3% (งานบริการ)</MenuItem>
              <MenuItem value={1}>1%</MenuItem>
              <MenuItem value={0}>ไม่หัก</MenuItem>
            </TextField>
          </Box>

          {/* ✅ ตัวอย่างยอดระหว่างพิมพ์ — ให้เห็นยอดที่ลูกค้าต้องโอนจริงก่อนกดบันทึก
              ⚠️ ค่าที่บันทึกจริงคำนวณใหม่ที่ server เสมอ ตรงนี้เป็นแค่ภาพตัวอย่าง */}
          <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: alpha(ACCENT, 0.05), mb: 1.5 }}>
            <Stack direction="row" justifyContent="space-between"><Typography variant="body2">ยอดก่อน VAT</Typography><Typography variant="body2">{baht(preview.amountBeforeVat)}</Typography></Stack>
            <Stack direction="row" justifyContent="space-between"><Typography variant="body2">VAT {form.vatRate}%</Typography><Typography variant="body2">+{baht(preview.vatAmount)}</Typography></Stack>
            <Stack direction="row" justifyContent="space-between"><Typography variant="body2">หัก ณ ที่จ่าย {form.whtRate}%</Typography><Typography variant="body2">−{baht(preview.whtAmount)}</Typography></Stack>
            <Divider sx={{ my: 0.75 }} />
            <Stack direction="row" justifyContent="space-between">
              <Typography sx={{ fontWeight: 800, fontSize: "0.9rem" }}>ยอดที่ลูกค้าต้องโอน</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: "0.9rem", color: ACCENT }}>{baht(preview.netAmount)}</Typography>
            </Stack>
          </Box>
          <TextField fullWidth size="small" label="หมายเหตุ" value={form.note} multiline minRows={1}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} sx={{ mb: 1 }} />
          <Button variant="contained" onClick={saveInvoice} disabled={saving || !form.amountBeforeVat}
            sx={{ bgcolor: ACCENT, textTransform: "none", fontWeight: 700, "&:hover": { bgcolor: "#0e7490" } }}>
            {saving ? "กำลังบันทึก..." : target?.billing?.invoicedAt ? "อัปเดตใบวางบิล" : "บันทึกการวางบิล"}
          </Button>

          {targetStatus && targetStatus.state !== "not_invoiced" && (
            <>
              <Divider sx={{ my: 2 }} />
              <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
                <Typography sx={{ fontWeight: 800, fontSize: "0.85rem" }}>การรับเงิน</Typography>
                <Typography variant="caption" sx={{ color: TEXT_SUB }}>
                  รับแล้ว {baht(paidTotal(target.billing))} / {baht(targetStatus.net)}
                  {targetStatus.outstanding > 0 && ` · ค้าง ${baht(targetStatus.outstanding)}`}
                </Typography>
              </Stack>

              <Stack spacing={0.5} sx={{ mb: 1.5 }}>
                {(target.billing?.payments || []).map((p) => (
                  <Stack key={p._id} direction="row" alignItems="center" spacing={1}
                    sx={{ p: 0.9, borderRadius: 2, bgcolor: alpha("#10b981", 0.06) }}>
                    <Payments sx={{ fontSize: 15, color: "#10b981" }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: "0.82rem" }}>{baht(p.amount)}</Typography>
                      <Typography variant="caption" sx={{ color: TEXT_SUB }}>
                        {moment(p.paidAt).format("DD/MM/YYYY")}{p.method ? ` · ${p.method}` : ""}{p.recordedByName ? ` · บันทึกโดย ${p.recordedByName}` : ""}
                      </Typography>
                    </Box>
                    <Tooltip title="ลบรายการนี้">
                      <span>
                        <IconButton size="small" disabled={saving} onClick={() => removePayment(p._id)}>
                          <DeleteOutline sx={{ fontSize: 16 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                ))}
                {(target.billing?.payments || []).length === 0 && (
                  <Typography variant="body2" sx={{ color: TEXT_SUB }}>ยังไม่มีการรับเงิน</Typography>
                )}
              </Stack>

              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.25, mb: 1 }}>
                <TextField size="small" type="number" label="ยอดรับ (บาท)" value={payForm.amount}
                  onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
                  InputProps={{ startAdornment: <InputAdornment position="start">฿</InputAdornment> }} />
                <TextField size="small" type="date" label="วันที่รับเงิน" InputLabelProps={{ shrink: true }}
                  value={payForm.paidAt} onChange={(e) => setPayForm((f) => ({ ...f, paidAt: e.target.value }))} />
                <TextField size="small" label="ช่องทาง (เช่น โอน / เช็ค)" value={payForm.method}
                  onChange={(e) => setPayForm((f) => ({ ...f, method: e.target.value }))} />
                <TextField size="small" label="หมายเหตุ" value={payForm.note}
                  onChange={(e) => setPayForm((f) => ({ ...f, note: e.target.value }))} />
              </Box>
              <Button startIcon={<AddCircleOutline sx={{ fontSize: 17 }} />} onClick={addPayment}
                disabled={saving || !payForm.amount}
                sx={{ textTransform: "none", fontWeight: 700, color: "#10b981" }}>
                บันทึกรับเงิน
              </Button>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setTarget(null)} disabled={saving} sx={{ textTransform: "none" }}>ปิด</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
