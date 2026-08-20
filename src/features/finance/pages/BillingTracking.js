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
import "@/shared/utils/momentThaiLocale";
import {
  Box, Stack, Typography, TextField, InputAdornment, IconButton, Chip, Skeleton,
  Paper, Tooltip, ToggleButton, ToggleButtonGroup, useMediaQuery, Pagination,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Search, Clear, Refresh, ReceiptLong, WarningAmber, CheckCircle, FolderOpen, HourglassEmpty,
} from "@mui/icons-material";
import { useAuth } from "@/features/auth/AuthContext";
import EventService from "@/shared/services/EventService";
import BillingDialog from "../components/BillingDialog";
import { billingStatus, baht, round2, BILLING_STATE_META } from "@/shared/utils/billing";
import { formatThai } from "@/shared/utils/thaiDate";

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

export default function BillingTracking() {
  const { userData, loading: authLoading } = useAuth();
  const role = (userData?.role || "").toLowerCase();
  // ✅ ช่างเข้าดู/อัปเดตการเงินของงานตัวเองได้ด้วย (ตามที่ผู้ใช้ระบุ) — ไม่ว่าจะเป็นผู้รับผิดชอบ
  // หัวหน้าทีม หรือลูกทีม ⚠️ ไม่ต้องกรองข้อมูลเองในหน้านี้ เพราะ getEventOp() ฝั่ง server คืนเฉพาะ
  // งานที่ผู้ใช้คนนั้นมีชื่ออยู่ให้อยู่แล้ว (ดู GET /event-op) และทุก route ที่บันทึกข้อมูลการเงินก็เช็ค
  // สิทธิ์รายงานซ้ำอีกชั้น (requireEventFinanceAccess) — ฝั่งจอจึงไม่ต้องกันซ้ำและไม่ควรกันด้วย role
  const canAccess = ["admin", "manager", "technician", "user"].includes(role);
  const isMobile = useMediaQuery("(max-width:900px)");

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("attention");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState(null);   // งานที่กำลังเปิดกล่องจัดการ

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

  // ✅ กล่องจัดการเป็นของกลาง (features/finance/components/BillingDialog.js) — หน้านี้มีหน้าที่แค่ "เลือกงาน"
  // แล้วรับ event ตัวใหม่กลับมาอัปเดตลงรายการ ไม่ต้องรู้เรื่องฟอร์ม/ภาษี/การเรียก API เลย
  const handleSaved = (updated) => {
    setEvents((prev) => prev.map((e) => (e._id === updated._id ? updated : e)));
    setTarget(updated);
  };

  if (authLoading) return null;
  if (!canAccess) return <Navigate to="/dashboard" replace />;

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
                  key={e._id} variant="outlined" onClick={() => setTarget(e)}
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
                          <Chip size="small" label={`ครบกำหนด ${formatThai(moment(e.billing.dueAt), "DD/MM/YY")}`}
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
      <BillingDialog
        event={target}
        onClose={() => setTarget(null)}
        onSaved={handleSaved}
      />
    </Box>
  );
}
