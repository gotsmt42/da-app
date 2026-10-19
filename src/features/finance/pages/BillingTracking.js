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
 *
 * 🔁 (19 ต.ค. 2569 ผู้ใช้: "เวลากดต้องลิงก์ไปบิลนั้นให้เจาะจง · หน้าติดตามบิลปรับ UX/UI ให้ดูง่าย สวยงาม")
 *    • ?jobId= (จากหน้างานเข้า/แจ้งเตือน) → เปิดกล่องจัดการบิลของงานนั้นทันที + ไฮไลต์แถว
 *    • โครงชุดเดียวกับทุกหน้า (PageKit): หัวเพจ → ตัวเลขสรุป → แถบสถานะ → ค้นหา → ตาราง (มือถือเป็นการ์ด) → แบ่งหน้า
 *    • ตาราง: วันที่ · งาน · ลูกค้า/โครงการ · ใบวางบิล (เลขที่/วันที่/เปิดไฟล์) · ครบกำหนด · ยอด/ค้างรับ · สถานะ · ปุ่มสิ่งที่ต้องทำ
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import useRealtime from "@/shared/realtime/useRealtime";
import { Navigate, useSearchParams } from "react-router-dom";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import { Box, Stack, Typography, IconButton, Skeleton, Tooltip, useMediaQuery, Button, ButtonBase } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Refresh, ReceiptLong, ChevronRight, AttachFileRounded } from "@mui/icons-material";
import { useAuth } from "@/features/auth/AuthContext";
import EventService from "@/shared/services/EventService";
import BillingDialog from "../components/BillingDialog";
import { billingStatus, baht, round2, BILLING_STATE_META } from "@/shared/utils/billing";
import { formatThai } from "@/shared/utils/thaiDate";
import { can } from "@/shared/utils/roles";
import { PAGE_SX, PageHeader, Kpi, KpiRow, FilterBar, EmptyState, ICON_BTN_SX, INK, INK_2, MUTED, LINE, SURFACE } from "@/shared/ui/PageKit";
import DateCell from "@/shared/ui/DateCell";
import JobKindTag from "@/shared/ui/JobKindTag";
import usePaged, { PageBar } from "@/shared/ui/usePaged";

const BLUE = "#2563eb";

// ⚠️ "ยังไม่วางบิล" ตั้งใจนับเฉพาะงานที่ทำเสร็จแล้วเท่านั้น — งานที่ยังไม่ได้เข้าไปทำยังไม่ถึงคิววางบิล
// ถ้านับทุกงาน แท็บนี้จะมีงานในอนาคตปนมาเป็นร้อยจนหาของจริงไม่เจอ
const DONE_STATUS = "ดำเนินการเสร็จสิ้น";

const TABS = [
  { key: "attention", label: "ต้องตาม", color: "#dc2626" },
  { key: "not_invoiced", label: "ยังไม่วางบิล", color: "#d97706" },
  { key: "overdue", label: "เลยกำหนดชำระ", color: "#dc2626" },
  { key: "unpaid", label: "รอชำระ", color: "#2563eb" },
  { key: "partial", label: "ชำระบางส่วน", color: "#f59e0b" },
  { key: "paid", label: "ชำระครบ", color: "#16a34a" },
  { key: "all", label: "ทั้งหมด", color: "#0f172a" },
];

/** ปุ่มสิ่งที่ต้องทำต่อของแถว */
const actionOf = (state) => ({
  not_invoiced: { label: "วางบิล", primary: true },
  overdue: { label: "ตามเงิน / รับเงิน", primary: true, color: "#dc2626" },
  partial: { label: "รับเงินเพิ่ม", primary: true },
  unpaid: { label: "บันทึกรับเงิน" },
  paid: { label: "ดูใบวางบิล" },
}[state] || { label: "เปิด" });

const stateColor = (status) => (status.state === "not_invoiced" ? "#d97706" : BILLING_STATE_META[status.state]?.color || MUTED);

const StatePill = ({ status }) => {
  const color = stateColor(status);
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, height: 26, px: 1.1, borderRadius: 99, whiteSpace: "nowrap",
      bgcolor: alpha(color, 0.12), color, border: `1px solid ${alpha(color, 0.35)}`, fontSize: "0.76rem", fontWeight: 800 }}>
      <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: color }} />{status.label}
    </Box>
  );
};

const lastInvoiceFile = (e) => { const f = e.invoiceFiles || []; return f[f.length - 1] || null; };
const SUB = { fontSize: "0.74rem", color: MUTED, lineHeight: 1.45 };

/** เลขที่/วันที่ใบวางบิล + ปุ่มเปิดไฟล์ใบวางบิล */
function InvoiceInfo({ e, status }) {
  const f = lastInvoiceFile(e);
  if (status.state === "not_invoiced" && !f) return <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: "#d97706" }}>ยังไม่วางบิล</Typography>;
  return (
    <Box>
      <Typography sx={{ fontSize: "0.82rem", fontWeight: 800, color: INK }}>{e.billing?.invoiceNo || "ไม่มีเลขที่"}</Typography>
      {e.billing?.invoicedAt && <Typography sx={SUB}>วางบิล {formatThai(moment(e.billing.invoicedAt), "D MMM YY")}</Typography>}
      {f && (
        <Box component="a" href={f.fileUrl} target="_blank" rel="noreferrer" onClick={(ev) => ev.stopPropagation()} title={f.fileName}
          sx={{ mt: 0.4, display: "inline-flex", alignItems: "center", gap: 0.4, height: 22, px: 0.85, borderRadius: 99, bgcolor: alpha(BLUE, 0.08), color: BLUE, fontSize: "0.7rem", fontWeight: 800, textDecoration: "none", "&:hover": { bgcolor: alpha(BLUE, 0.14) } }}>
          <AttachFileRounded sx={{ fontSize: 13 }} />เปิดใบวางบิล
        </Box>
      )}
    </Box>
  );
}

function ActionBtn({ status, onClick }) {
  const a = actionOf(status.state);
  const color = a.color || BLUE;
  return (
    <Button size="small" onClick={(ev) => { ev.stopPropagation(); onClick(); }}
      sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, height: 32, px: 1.5, whiteSpace: "nowrap", boxShadow: "none",
        ...(a.primary ? { bgcolor: color, color: "#fff", "&:hover": { bgcolor: color, filter: "brightness(.92)" } } : { color, border: `1px solid ${alpha(color, 0.4)}` }) }}>
      {a.label}
    </Button>
  );
}

export default function BillingTracking() {
  const { userData, loading: authLoading } = useAuth();
  // ✅ ช่างเข้าดู/อัปเดตการเงินของงานตัวเองได้ด้วย — getEventOp() ฝั่ง server คืนเฉพาะงานที่ผู้ใช้มีชื่ออยู่
  //    และทุก route ที่บันทึกข้อมูลการเงินเช็คสิทธิ์ซ้ำ (requireEventFinanceAccess) จึงไม่กรองซ้ำที่จอ
  const canAccess = can(userData, "viewFinance");
  const isMobile = useMediaQuery("(max-width:900px)");
  const [searchParams, setSearchParams] = useSearchParams();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  /* เปิดแท็บที่ลิงก์เจาะจงมา (?status=overdue จากแจ้งเตือน) — ใช้ชื่อ status ไม่ใช่ tab (tab = แท็บหน้ารวมการเงิน) */
  const [tab, setTab] = useState(() => {
    const wanted = new URLSearchParams(window.location.search).get("status");
    return TABS.some((t) => t.key === wanted) ? wanted : "attention";
  });
  const [target, setTarget] = useState(null);   // งานที่กำลังเปิดกล่องจัดการ
  const [highlight, setHighlight] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await EventService.getEventOp().catch(() => ({ userEvents: [] }));
      setEvents(res?.userEvents || []);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  // ✅ เรียลไทม์: บันทึกวางบิล/รับเงินจากเครื่องอื่น → สถานะการเก็บเงินอัปเดตทันที
  useRealtime("events", () => { load(true); });

  // ── ประกอบแถว ── งานที่ระบุ "ไม่ต้องวางบิล" และยังไม่เคยวางบิล ไม่ต้องอยู่ในรายการติดตาม
  const rows = useMemo(() => events.filter((e) => e.invoiceApplicable !== false || e.billing?.invoicedAt).map((e) => ({
    event: e,
    status: billingStatus(e.billing),
  })), [events]);

  // ✅ ลิงก์เจาะจงบิล (?jobId=) → เปิดกล่องของงานนั้นเลย · สลับแท็บ "ทั้งหมด" ให้เห็นแถว + ไฮไลต์
  useEffect(() => {
    const jobId = searchParams.get("jobId");
    if (!jobId || loading) return;
    const hit = events.find((e) => String(e._id) === jobId) || events.find((e) => String(e.jobGroupId || "") === jobId);
    if (hit) {
      setTab("all");
      setSearch("");
      setTarget(hit);
      setHighlight(String(hit._id));
    }
    setSearchParams((prev) => { const n = new URLSearchParams(prev); n.delete("jobId"); return n; }, { replace: true });
  }, [searchParams, loading, events, setSearchParams]);
  useEffect(() => {
    if (!highlight) return undefined;
    const t1 = setTimeout(() => document.getElementById(`bill-${highlight}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
    const t2 = setTimeout(() => setHighlight(""), 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [highlight]);

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
        [e.company, e.site, e.title, e.system, e.contractNo, e.jobNo, e.billing?.invoiceNo]
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

  const size = isMobile ? 8 : 20;
  const pg = usePaged(filtered, size);
  const { setPage } = pg;
  useEffect(() => { setPage(1); }, [tab, search, setPage]);
  // ไฮไลต์จากลิงก์ → ไปหน้าที่มีแถวนั้น
  useEffect(() => {
    if (!highlight) return;
    const i = filtered.findIndex((r) => String(r.event._id) === highlight);
    if (i >= 0) setPage(Math.floor(i / size) + 1);
  }, [highlight, filtered, size, setPage]);
  const goPage = (n) => { setPage(n); window.scrollTo({ top: 0, behavior: "smooth" }); };

  // ✅ กล่องจัดการเป็นของกลาง (BillingDialog) — หน้านี้แค่เลือกงาน แล้วรับ event ตัวใหม่กลับมาอัปเดตรายการ
  const handleSaved = (updated) => {
    setEvents((prev) => prev.map((e) => (e._id === updated._id ? updated : e)));
    setTarget(updated);
  };

  if (authLoading) return null;
  if (!canAccess) return <Navigate to="/dashboard" replace />;

  const th = { textAlign: "left", fontSize: "0.74rem", fontWeight: 800, color: MUTED, px: 1.25, py: 1.1, borderBottom: `1px solid ${LINE}`, whiteSpace: "nowrap", bgcolor: SURFACE };
  const td = { fontSize: "0.82rem", color: INK_2, px: 1.25, py: 1.2, borderBottom: `1px solid ${LINE}`, verticalAlign: "top" };

  return (
    <Box sx={PAGE_SX}>
      <PageHeader icon={<ReceiptLong />} title="ติดตามการวางบิล / รับเงิน" subtitle="วางบิลต่อครั้งที่เข้างาน · รับเงินแบ่งจ่ายได้ · กดแถวเพื่อวางบิล/บันทึกรับเงิน"
        actions={<Tooltip title="โหลดข้อมูลใหม่"><IconButton onClick={() => load()} sx={ICON_BTN_SX}><Refresh fontSize="small" /></IconButton></Tooltip>} />

      <KpiRow columns={4}>
        <Kpi label="วางบิลแล้ว (สุทธิ)" value={loading ? "…" : baht(totals.invoiced)} />
        <Kpi label="รับเงินแล้ว" value={loading ? "…" : baht(totals.received)} />
        <Kpi label="ค้างรับ" value={loading ? "…" : baht(totals.outstanding)} onClick={() => setTab("unpaid")} active={tab === "unpaid"} />
        <Kpi label="เลยกำหนดชำระ" value={loading ? "…" : baht(totals.overdue)} alert={totals.overdue > 0} onClick={() => setTab("overdue")} active={tab === "overdue"} />
      </KpiRow>

      {/* แถบสถานะ — จุดสี + จำนวน · กดเพื่อกรอง */}
      <Stack direction="row" gap={0.75} sx={{ mb: 1.5, p: 0.75, bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, overflowX: "auto", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
        {TABS.map((t) => {
          const on = tab === t.key;
          const n = counts[t.key] ?? 0;
          const hot = (t.key === "attention" || t.key === "overdue") && n > 0;
          return (
            <ButtonBase key={t.key} onClick={() => setTab(t.key)}
              sx={{ flexShrink: 0, height: 34, px: 1.25, gap: 0.75, borderRadius: 2.5, fontFamily: "inherit", whiteSpace: "nowrap",
                fontSize: "0.82rem", fontWeight: on ? 800 : 600, color: on ? t.color : "#475569", bgcolor: on ? alpha(t.color, 0.08) : "transparent",
                border: `1px solid ${on ? alpha(t.color, 0.45) : "transparent"}` }}>
              {t.key !== "all" && <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: t.color }} />}
              {t.label}
              <Box component="span" sx={{ minWidth: 20, height: 20, px: 0.6, borderRadius: 99, display: "inline-grid", placeItems: "center", fontSize: "0.72rem", fontWeight: 800,
                bgcolor: hot ? "#dc2626" : on ? t.color : "#f1f5f9", color: hot || on ? "#fff" : MUTED }}>{n}</Box>
            </ButtonBase>
          );
        })}
      </Stack>

      <FilterBar search={search} onSearch={setSearch} placeholder="ค้นหาลูกค้า / โครงการ / เลขที่งาน / เลขที่ใบวางบิล" />

      {loading ? (
        <Stack spacing={1}>{[1, 2, 3, 4].map((i) => <Skeleton key={i} variant="rounded" height={64} sx={{ borderRadius: 3 }} />)}</Stack>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<ReceiptLong />} title="ไม่พบรายการในหมวดนี้" hint={tab === "attention" ? "ไม่มีบิลที่ต้องตาม 🎉" : undefined} />
      ) : isMobile ? (
        <>
          <Stack spacing={1}>
            {pg.rows.map(({ event: e, status }) => {
              const color = stateColor(status);
              return (
                <Box key={e._id} id={`bill-${e._id}`} onClick={() => setTarget(e)} role="button"
                  sx={{ p: 1.5, bgcolor: "#fff", border: `1px solid ${LINE}`, borderLeft: `3px solid ${color}`, borderRadius: 3, cursor: "pointer",
                    ...(highlight === String(e._id) ? { outline: `3px solid ${BLUE}`, outlineOffset: 2 } : {}) }}>
                  <Stack direction="row" gap={1} alignItems="flex-start">
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <JobKindTag event={e} />
                      <Typography sx={{ mt: 0.5, fontWeight: 800, fontSize: "0.9rem", color: INK }}>{e.company || e.site || "ไม่ระบุลูกค้า"}</Typography>
                      <Typography noWrap sx={SUB}>{[e.site !== e.company ? e.site : "", e.title, e.system].filter(Boolean).join(" · ")}</Typography>
                    </Box>
                    <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                      <Typography sx={{ fontWeight: 900, fontSize: "0.95rem", color: status.net ? INK : "#94a3b8" }}>{status.net ? baht(status.net) : "—"}</Typography>
                      {status.outstanding > 0 && status.state !== "paid" && <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color }}>ค้าง {baht(status.outstanding)}</Typography>}
                    </Box>
                  </Stack>
                  <Box sx={{ mt: 0.75 }}><InvoiceInfo e={e} status={status} /></Box>
                  <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 1, pt: 1, borderTop: `1px solid ${LINE}` }}>
                    <StatePill status={status} />
                    <Box sx={{ flex: 1 }} />
                    <ActionBtn status={status} onClick={() => setTarget(e)} />
                  </Stack>
                </Box>
              );
            })}
          </Stack>
          <PageBar {...pg} setPage={goPage} unit="รายการ" />
        </>
      ) : (
        <>
          <Box sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, overflowX: "auto", boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}>
            <Box component="table" sx={{ width: "100%", minWidth: 1200, borderCollapse: "collapse" }}>
              <thead>
                <tr>{["วันที่เข้างาน", "งาน", "ลูกค้า / โครงการ", "ใบวางบิล", "ครบกำหนดชำระ", "ยอดสุทธิ / ค้างรับ", "สถานะ", ""].map((h, i) => (
                  <Box component="th" key={i} sx={{ ...th, ...(i === 5 ? { textAlign: "right" } : {}) }}>{h}</Box>
                ))}</tr>
              </thead>
              <tbody>
                {pg.rows.map(({ event: e, status }) => {
                  const color = stateColor(status);
                  const hl = highlight === String(e._id);
                  return (
                    <Box component="tr" key={e._id} id={`bill-${e._id}`} onClick={() => setTarget(e)}
                      sx={{ cursor: "pointer", scrollMarginTop: "90px", bgcolor: hl ? alpha(BLUE, 0.06) : "#fff", "&:hover": { bgcolor: hl ? alpha(BLUE, 0.08) : SURFACE },
                        "&:last-child td": { borderBottom: 0 }, boxShadow: `inset 3px 0 0 ${color}` }}>
                      <Box component="td" sx={{ ...td, width: 96 }}><DateCell start={e.start} end={e.end} allDay={e.allDay} /></Box>
                      <Box component="td" sx={{ ...td, minWidth: 190, maxWidth: 240 }}>
                        <JobKindTag event={e} />
                        <Typography sx={{ mt: 0.5, fontSize: "0.86rem", fontWeight: 800, color: INK }}>{[e.title, e.system].filter(Boolean).join(" · ") || "งาน"}</Typography>
                        {(e.jobNo || e.contractNo) && <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8" }}>{e.jobNo || `สัญญา ${e.contractNo}`}</Typography>}
                      </Box>
                      <Box component="td" sx={{ ...td, minWidth: 180, maxWidth: 240 }}>
                        <Typography sx={{ fontSize: "0.84rem", fontWeight: 800, color: INK, overflowWrap: "anywhere" }}>{e.company || "ไม่ระบุลูกค้า"}</Typography>
                        {e.site && e.site !== e.company && <Typography sx={{ ...SUB, overflowWrap: "anywhere" }}>{e.site}</Typography>}
                      </Box>
                      <Box component="td" sx={{ ...td, minWidth: 150 }}><InvoiceInfo e={e} status={status} /></Box>
                      <Box component="td" sx={{ ...td, whiteSpace: "nowrap" }}>
                        {e.billing?.dueAt ? (
                          <>
                            <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: status.state === "overdue" ? "#dc2626" : INK_2 }}>{formatThai(moment(e.billing.dueAt), "D MMM YY")}</Typography>
                            {status.state === "overdue" && <Typography sx={{ ...SUB, color: "#dc2626", fontWeight: 800 }}>เลย {status.overdueDays} วัน</Typography>}
                            {status.state !== "paid" && status.state !== "overdue" && <Typography sx={SUB}>อีก {Math.max(0, moment(e.billing.dueAt).startOf("day").diff(moment().startOf("day"), "days"))} วัน</Typography>}
                          </>
                        ) : <Typography sx={{ fontSize: "0.76rem", color: "#cbd5e1" }}>—</Typography>}
                      </Box>
                      <Box component="td" sx={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                        {status.state === "not_invoiced" ? <Typography sx={{ fontSize: "0.76rem", color: "#94a3b8" }}>ยังไม่มียอด</Typography> : (
                          <>
                            <Typography sx={{ fontSize: "0.9rem", fontWeight: 900, color: INK, fontVariantNumeric: "tabular-nums" }}>{baht(status.net)}</Typography>
                            {status.outstanding > 0 && status.state !== "paid"
                              ? <Typography sx={{ fontSize: "0.74rem", fontWeight: 800, color }}>ค้าง {baht(status.outstanding)}</Typography>
                              : <Typography sx={{ ...SUB, color: "#16a34a", fontWeight: 700 }}>รับครบแล้ว</Typography>}
                          </>
                        )}
                      </Box>
                      <Box component="td" sx={{ ...td, minWidth: 140 }}><StatePill status={status} /></Box>
                      <Box component="td" sx={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                        <Stack direction="row" alignItems="center" gap={0.5} justifyContent="flex-end">
                          <ActionBtn status={status} onClick={() => setTarget(e)} />
                          <ChevronRight sx={{ fontSize: 20, color: "#cbd5e1" }} />
                        </Stack>
                      </Box>
                    </Box>
                  );
                })}
              </tbody>
            </Box>
          </Box>
          <PageBar {...pg} setPage={goPage} unit="รายการ" />
        </>
      )}

      {/* ── กล่องจัดการใบวางบิล ─────────────────────────────────────────── */}
      <BillingDialog event={target} onClose={() => setTarget(null)} onSaved={handleSaved} />
    </Box>
  );
}
