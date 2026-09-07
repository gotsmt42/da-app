/**
 * CustomerOverview.js — "ภาพรวมลูกค้า" (มุมมองรายลูกค้าแบบรวมทุกอย่างไว้จอเดียว)
 *
 * จุดที่ขาดอยู่เดิม: ข้อมูลของลูกค้ารายหนึ่งกระจายอยู่ 4 หน้าคนละที่ — สัญญาอยู่ที่ "ภาพรวมงาน",
 * งานค้างอยู่ที่ "การดำเนินงาน", ใบเสนอราคาอยู่ที่ "ติดตามใบเสนอราคา", เอกสารที่ออกไปแล้วอยู่ที่
 * "ทะเบียนเอกสาร" — เวลาลูกค้าโทรมาถามต้องเปิดไล่ทีละหน้าแล้วกรองชื่อเองทุกครั้ง
 *
 * ⚠️ หน้านี้ไม่เก็บข้อมูลใหม่เลยแม้แต่ฟิลด์เดียว — ประกอบจากของที่มีอยู่แล้วทั้งหมด และใช้ "ตรรกะกลาง"
 * ชุดเดียวกับหน้าอื่นเป๊ะๆ (groupEventsByContract / contractStatusInfo / getFollowUpInfo /
 * buildDaysPastDueMap) ห้ามคำนวณเกณฑ์ซ้ำเองในไฟล์นี้เด็ดขาด ไม่งั้นตัวเลขจะไม่ตรงกับหน้าต้นทาง
 * ซึ่งเป็นอาการที่ผู้ใช้จับได้ทันทีและทำให้เลิกเชื่อตัวเลขทั้งระบบ
 */
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import {
  Box, Stack, Typography, TextField, InputAdornment, IconButton, Chip, Skeleton,
  Paper, Divider, Dialog, DialogTitle, DialogContent, DialogActions, Button, Tooltip,
  ToggleButton, ToggleButtonGroup, useMediaQuery, Pagination,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Search, Clear, Refresh, Business, Description, WarningAmber, EventBusy,
  RequestQuote, FolderOpen, ArrowForwardIos, AttachMoney, OpenInNew, Assignment,
} from "@mui/icons-material";
import { useAuth } from "@/features/auth/AuthContext";
import EventService from "@/shared/services/EventService";
import IssuedDocumentService from "@/shared/services/IssuedDocumentService";
import {
  groupEventsByContract, isRoundOverdue, contractStatusInfo,
} from "@/shared/utils/contractOverdue";
import { buildDaysPastDueMap, isFlaggedDays, getOverdueGroupKey } from "@/shared/utils/overdueJobs";
import { getFollowUpInfo } from "@/shared/utils/quotationTracking";
import { formatThai } from "@/shared/utils/thaiDate";
import { can } from "@/shared/utils/roles";

const ACCENT = "#0891b2";
const TEXT_SUB = "#64748b";
const PAGE_SIZE_DESKTOP = 12;
const PAGE_SIZE_MOBILE = 6;

const SORT_OPTIONS = [
  { key: "attention", label: "ต้องดูก่อน" },
  { key: "value", label: "มูลค่าสูงสุด" },
  { key: "name", label: "ชื่อ ก-ฮ" },
];

const baht = (n) => `฿${Number(n || 0).toLocaleString("th-TH")}`;

// ⚠️ ลูกค้าถูกระบุด้วย "ชื่อบริษัทที่พิมพ์ไว้ในงาน" ไม่ใช่ id ในทะเบียนลูกค้า — เพราะงานจำนวนมาก
// (โดยเฉพาะงานเก่า) ไม่เคยผูกกับทะเบียนลูกค้าเลย ถ้ายึด id จะเห็นไม่ครบ
// ⚠️ ต้อง normalize ช่องว่าง/ตัวพิมพ์ก่อนเสมอ ไม่งั้น "บริษัท ก จำกัด" กับ "บริษัท ก  จำกัด"
// (เว้นวรรคเกิน 1 ตัว ซึ่งเกิดขึ้นจริงตลอดเวลาเวลาพิมพ์มือ) จะกลายเป็นลูกค้าคนละราย
const customerKey = (name) => (name || "").trim().replace(/\s+/g, " ").toLowerCase();

/** แถวรายการ "สิ่งที่ต้องติดตาม" — จุดสี + หัวข้อ + คำอธิบายรอง */
function TrackRow({ color, icon, title, sub }) {
  return (
    <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ p: 1, borderRadius: 2, bgcolor: alpha(color, 0.06) }}>
      <Box sx={{ color, mt: 0.15, flexShrink: 0, display: "flex" }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: "0.82rem", color }}>{title}</Typography>
        {sub && <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>{sub}</Typography>}
      </Box>
    </Stack>
  );
}

export default function CustomerOverview() {
  const { userData, loading: authLoading } = useAuth();
  const role = (userData?.role || "").toLowerCase();
  const isAdminOrManager = can(role, "manageMasterData");
  const isMobile = useMediaQuery("(max-width:900px)");
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("attention");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        // ⚠️ ทะเบียนเอกสารดึงได้สูงสุด 200 ใบต่อครั้งตามที่ API จำกัดไว้ — ใช้แค่ "นับ + โชว์ล่าสุด"
        // ต่อลูกค้าเท่านั้น ถ้าวันหนึ่งเอกสารเกิน 200 ใบ ตัวเลขนี้จะกลายเป็น "อย่างน้อย N ใบ" ไม่ใช่
        // ยอดจริง จึงมีปุ่มลิงก์ไปหน้าต้นทางให้กดดูตัวเต็มเสมอ ไม่ยึดตัวเลขในนี้เป็นทางการ
        const [resEvents, resDocs] = await Promise.all([
          EventService.getEventOp().catch(() => ({ userEvents: [] })),
          IssuedDocumentService.list({ limit: 200 }).catch(() => ({ items: [] })),
        ]);
        if (!alive) return;
        setEvents(resEvents?.userEvents || []);
        setDocs(resDocs?.items || resDocs?.docs || []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [reloadKey]);

  // ── ประกอบข้อมูลรายลูกค้า ────────────────────────────────────────────────
  const customers = useMemo(() => {
    if (events.length === 0) return [];

    const contracts = groupEventsByContract(events);
    const daysPastDueMap = buildDaysPastDueMap(events);

    const map = new Map();
    const bucket = (name) => {
      const key = customerKey(name);
      if (!key) return null;
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: (name || "").trim(),
          contracts: [], expired: [], expiring: [], overdueRounds: [],
          totalValue: 0, quotationPending: [], overdueJobKeys: new Set(),
          jobCount: 0, docs: [], lastActivity: null,
        });
      }
      return map.get(key);
    };

    contracts.forEach((c) => {
      const b = bucket(c.company);
      if (!b) return;
      // มูลค่างานนับรวมทุกแถว ไม่ใช่เฉพาะสัญญาจริง — งานทั่วไป/โปรเจคก็มีมูลค่าของตัวเอง
      b.totalValue += Number(c.jobValue) || 0;
      b.jobCount += 1;
      if (c.isRealContract) {
        b.contracts.push(c);
        const st = contractStatusInfo(c);
        if (st?.state === "expired") b.expired.push(c);
        else if (st?.state === "expiring") b.expiring.push(c);
        // ⚠️ นับเฉพาะที่เลยกำหนดจริง — ตัวเลขนี้อยู่ใต้ป้าย "เลยกำหนด" ถ้ารวมรอบที่ยังมาไม่ถึง
        // (คำเตือนสีส้ม) เข้าไปด้วย ตัวเลขจะโป่งขึ้นทั้งที่ไม่มีงานค้างเพิ่มขึ้นจริงสักงาน
        if (isRoundOverdue(c)) b.overdueRounds.push(c);
      }
    });

    events.forEach((e) => {
      const b = bucket(e.company);
      if (!b) return;
      if (e.quotationStatus === "sent") b.quotationPending.push(e);
      // ✅ งานค้างต้องนับเป็น "งาน" ไม่ใช่ "record" — งานเดียวที่เข้าหลายวันมีหลาย record
      // (getOverdueGroupKey คือลายเซ็นจัดกลุ่มชุดเดียวกับหน้าการดำเนินงาน/Dashboard)
      const days = daysPastDueMap.get(e._id);
      if (isFlaggedDays(days) && e.status !== "ดำเนินการเสร็จสิ้น") {
        b.overdueJobKeys.add(getOverdueGroupKey(e));
      }
      const stamp = e.updatedAt || e.end || e.start || e.date;
      if (stamp && moment(stamp).isValid() && (!b.lastActivity || moment(stamp).isAfter(b.lastActivity))) {
        b.lastActivity = moment(stamp);
      }
    });

    docs.forEach((d) => {
      const b = bucket(d.customerCompany);
      if (b) b.docs.push(d);
    });

    return [...map.values()].map((b) => ({
      ...b,
      overdueJobCount: b.overdueJobKeys.size,
      // ✅ "คะแนนต้องดูก่อน" — เรียงตามความเร่งด่วนจริง ไม่ใช่ตามตัวอักษร ผู้ใช้เปิดหน้านี้มาเพื่อรู้ว่า
      // "วันนี้ต้องโทรหาใคร" ไม่ใช่เพื่อไล่อ่านทุกราย · ถ่วงน้ำหนักตามความเสียหายถ้าปล่อยไว้:
      // สัญญาหมดอายุ (เสียรายได้ต่อเนื่องทั้งก้อน) > ใกล้หมด > งานค้าง > รอบยังไม่วางแผน > ใบเสนอราคาค้าง
      attention: b.expired.length * 100 + b.expiring.length * 40
        + b.overdueJobKeys.size * 20 + b.overdueRounds.length * 10 + b.quotationPending.length * 5,
    }));
  }, [events, docs]);

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    const list = kw ? customers.filter((c) => c.name.toLowerCase().includes(kw)) : customers;
    return list.slice().sort((a, b) => {
      if (sortBy === "value") return b.totalValue - a.totalValue || a.name.localeCompare(b.name, "th");
      if (sortBy === "name") return a.name.localeCompare(b.name, "th");
      return b.attention - a.attention || b.totalValue - a.totalValue;
    });
  }, [customers, search, sortBy]);

  const pageSize = isMobile ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  useEffect(() => { setPage(1); }, [search, sortBy]);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const totals = useMemo(() => customers.reduce((a, c) => ({
    customers: a.customers + 1,
    value: a.value + c.totalValue,
    expired: a.expired + c.expired.length,
    expiring: a.expiring + c.expiring.length,
    overdueJobs: a.overdueJobs + c.overdueJobCount,
    quotations: a.quotations + c.quotationPending.length,
  }), { customers: 0, value: 0, expired: 0, expiring: 0, overdueJobs: 0, quotations: 0 }), [customers]);

  if (authLoading) return null;
  if (!isAdminOrManager) return <Navigate to="/dashboard" replace />;

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2 }, maxWidth: 1400, mx: "auto" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: "1.05rem", sm: "1.25rem" } }}>ภาพรวมลูกค้า</Typography>
          <Typography variant="caption" sx={{ color: TEXT_SUB }}>
            สัญญา · งานค้าง · ใบเสนอราคา · เอกสาร ของลูกค้าแต่ละรายรวมไว้จอเดียว
          </Typography>
        </Box>
        <Tooltip title="โหลดข้อมูลใหม่">
          <IconButton onClick={() => setReloadKey((k) => k + 1)} size="small"><Refresh /></IconButton>
        </Tooltip>
      </Stack>

      <Box sx={{
        display: "grid",
        gridTemplateColumns: { xs: "repeat(3, 1fr)", sm: "repeat(6, 1fr)" },
        gap: 1, mb: 2, p: 1.5, borderRadius: 3, border: "1px solid", borderColor: "divider",
        bgcolor: "background.paper",
      }}>
        {[
          { label: "ลูกค้าทั้งหมด", value: totals.customers.toLocaleString(), color: ACCENT, icon: <Business sx={{ fontSize: 16 }} /> },
          { label: "มูลค่างานรวม", value: baht(totals.value), color: "#10b981", icon: <AttachMoney sx={{ fontSize: 16 }} /> },
          { label: "สัญญาหมดอายุ", value: totals.expired.toLocaleString(), color: "#dc2626", icon: <EventBusy sx={{ fontSize: 16 }} /> },
          { label: "ใกล้หมดอายุ", value: totals.expiring.toLocaleString(), color: "#f59e0b", icon: <WarningAmber sx={{ fontSize: 16 }} /> },
          { label: "งานค้าง", value: totals.overdueJobs.toLocaleString(), color: "#ef4444", icon: <Assignment sx={{ fontSize: 16 }} /> },
          { label: "ใบเสนอราคารอผล", value: totals.quotations.toLocaleString(), color: "#8b5cf6", icon: <RequestQuote sx={{ fontSize: 16 }} /> },
        ].map((s, i) => (
          <Box key={i} sx={{ textAlign: "center", minWidth: 0 }}>
            <Box sx={{ color: s.color, mb: 0.25 }}>{s.icon}</Box>
            {loading ? <Skeleton width={40} sx={{ mx: "auto" }} /> : (
              <Typography fontWeight={800} sx={{ fontSize: "1rem", overflow: "hidden", textOverflow: "ellipsis" }}>{s.value}</Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem" }}>{s.label}</Typography>
          </Box>
        ))}
      </Box>

      <Stack direction={{ xs: "column", sm: "row" }} gap={1} sx={{ mb: 2 }}>
        <TextField
          fullWidth size="small" placeholder="ค้นหาชื่อลูกค้า..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18, color: search ? ACCENT : "text.disabled" }} /></InputAdornment>,
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearch("")}><Clear sx={{ fontSize: 16 }} /></IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
        <ToggleButtonGroup value={sortBy} exclusive size="small" onChange={(_, v) => { if (v) setSortBy(v); }}>
          {SORT_OPTIONS.map((o) => (
            <ToggleButton key={o.key} value={o.key} sx={{ textTransform: "none", fontWeight: 700, px: 1.5, fontSize: "0.75rem", whiteSpace: "nowrap" }}>
              {o.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      {loading ? (
        <Stack spacing={1.5}>{[1, 2, 3, 4].map((i) => <Skeleton key={i} variant="rounded" height={84} sx={{ borderRadius: 3 }} />)}</Stack>
      ) : filtered.length === 0 ? (
        <Paper variant="outlined" sx={{ textAlign: "center", py: 6, borderRadius: 3, borderStyle: "dashed" }}>
          <FolderOpen sx={{ fontSize: 32, color: alpha(ACCENT, 0.5), mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {search ? "ไม่พบลูกค้าที่ตรงกับคำค้นหา" : "ยังไม่มีข้อมูลลูกค้า"}
          </Typography>
        </Paper>
      ) : (
        <>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
            {paged.map((c) => (
              <Paper
                key={c.key} variant="outlined" onClick={() => setSelected(c)}
                sx={{
                  p: 1.75, borderRadius: 3, cursor: "pointer", transition: "all .15s",
                  "&:hover": { borderColor: ACCENT, boxShadow: `0 2px 12px ${alpha(ACCENT, 0.15)}` },
                }}
              >
                <Stack direction="row" alignItems="flex-start" gap={1.25}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: 2, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    bgcolor: alpha(ACCENT, 0.1), color: ACCENT,
                  }}>
                    <Business sx={{ fontSize: 19 }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: "0.9rem" }} noWrap>{c.name}</Typography>
                    <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>
                      {c.contracts.length > 0 ? `${c.contracts.length} สัญญา · ` : ""}{baht(c.totalValue)}
                    </Typography>
                    <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.6 }}>
                      {c.expired.length > 0 && (
                        <Chip size="small" icon={<EventBusy sx={{ fontSize: 12 }} />} label={`${c.expired.length} หมดอายุ`}
                          sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700, bgcolor: alpha("#dc2626", 0.12), color: "#dc2626" }} />
                      )}
                      {c.expiring.length > 0 && (
                        <Chip size="small" icon={<WarningAmber sx={{ fontSize: 12 }} />} label={`${c.expiring.length} ใกล้หมดอายุ`}
                          sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700, bgcolor: alpha("#f59e0b", 0.12), color: "#f59e0b" }} />
                      )}
                      {c.overdueJobCount > 0 && (
                        <Chip size="small" label={`${c.overdueJobCount} งานค้าง`}
                          sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700, bgcolor: alpha("#ef4444", 0.12), color: "#ef4444" }} />
                      )}
                      {c.overdueRounds.length > 0 && (
                        <Chip size="small" label={`${c.overdueRounds.length} รอบยังไม่วางแผน`}
                          sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700, bgcolor: alpha(ACCENT, 0.12), color: ACCENT }} />
                      )}
                      {c.quotationPending.length > 0 && (
                        <Chip size="small" icon={<RequestQuote sx={{ fontSize: 12 }} />} label={`${c.quotationPending.length} ใบเสนอราคารอผล`}
                          sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700, bgcolor: alpha("#8b5cf6", 0.12), color: "#8b5cf6" }} />
                      )}
                      {c.attention === 0 && (
                        <Typography variant="caption" sx={{ color: "#10b981", fontWeight: 700 }}>ไม่มีรายการค้าง</Typography>
                      )}
                    </Stack>
                  </Box>
                  <ArrowForwardIos sx={{ fontSize: 13, color: "text.disabled", flexShrink: 0, mt: 0.5 }} />
                </Stack>
              </Paper>
            ))}
          </Box>

          {pageCount > 1 && (
            <Stack alignItems="center" sx={{ mt: 2 }}>
              <Pagination count={pageCount} page={safePage} onChange={(_, p) => setPage(p)} size="small" color="primary" />
            </Stack>
          )}
        </>
      )}

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} fullWidth maxWidth="sm" fullScreen={isMobile}>
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Business sx={{ fontSize: 20, color: ACCENT }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: "1rem", lineHeight: 1.3 }} noWrap>{selected?.name}</Typography>
              <Typography variant="caption" sx={{ color: TEXT_SUB }}>
                {selected?.lastActivity
                  ? `เคลื่อนไหวล่าสุด ${formatThai(moment(selected.lastActivity).locale("th"), "D MMM YYYY")}`
                  : "ยังไม่มีความเคลื่อนไหว"}
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {selected && (
            <Stack spacing={2} sx={{ py: 0.5 }}>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1 }}>
                {[
                  { label: "สัญญาทั้งหมด", value: `${selected.contracts.length} ฉบับ` },
                  { label: "มูลค่างานรวม", value: baht(selected.totalValue) },
                  { label: "งานทั้งหมด", value: `${selected.jobCount} รายการ` },
                  { label: "เอกสารที่ออกแล้ว", value: `${selected.docs.length} ใบ` },
                ].map((s, i) => (
                  <Box key={i} sx={{ p: 1.25, borderRadius: 2, bgcolor: alpha("#0f172a", 0.03) }}>
                    <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>{s.label}</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: "0.95rem" }}>{s.value}</Typography>
                  </Box>
                ))}
              </Box>

              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: "0.85rem", mb: 0.75 }}>สิ่งที่ต้องติดตาม</Typography>
                <Stack spacing={0.75}>
                  {selected.expired.map((c) => (
                    <TrackRow key={`ex-${c.key}`} color="#dc2626" icon={<EventBusy sx={{ fontSize: 15 }} />}
                      title={`สัญญาหมดอายุแล้ว${c.contractNo ? ` · ${c.contractNo}` : ""}`}
                      sub={`${c.site || "ไม่ระบุโครงการ"} · สิ้นสุด ${formatThai(moment(c.contractEnd), "DD/MM/YYYY")}`} />
                  ))}
                  {selected.expiring.map((c) => (
                    <TrackRow key={`eg-${c.key}`} color="#f59e0b" icon={<WarningAmber sx={{ fontSize: 15 }} />}
                      title={`${contractStatusInfo(c)?.label || "ใกล้หมดอายุ"}${c.contractNo ? ` · ${c.contractNo}` : ""}`}
                      sub={`${c.site || "ไม่ระบุโครงการ"} · สิ้นสุด ${formatThai(moment(c.contractEnd), "DD/MM/YYYY")}`} />
                  ))}
                  {selected.overdueRounds.map((c) => (
                    <TrackRow key={`or-${c.key}`} color={ACCENT} icon={<Description sx={{ fontSize: 15 }} />}
                      title={`ยังไม่ได้วางแผนรอบถัดไป${c.contractNo ? ` · ${c.contractNo}` : ""}`}
                      sub={c.site || "ไม่ระบุโครงการ"} />
                  ))}
                  {selected.quotationPending.map((e) => {
                    const info = getFollowUpInfo(e);
                    return (
                      <TrackRow key={`q-${e._id}`} color="#8b5cf6" icon={<RequestQuote sx={{ fontSize: 15 }} />}
                        title={`ใบเสนอราคารอผล${e.quotationAmount ? ` · ${baht(e.quotationAmount)}` : ""}`}
                        sub={`${e.site || e.title || "ไม่ระบุงาน"}${info?.daysSinceSent != null ? ` · ส่งไปแล้ว ${info.daysSinceSent} วัน` : ""}`} />
                    );
                  })}
                  {selected.overdueJobCount > 0 && (
                    <TrackRow color="#ef4444" icon={<Assignment sx={{ fontSize: 15 }} />}
                      title={`มีงานค้างเกินกำหนด ${selected.overdueJobCount} งาน`}
                      sub="ดูรายละเอียดรายงานได้ที่หน้าการดำเนินงาน" />
                  )}
                  {selected.attention === 0 && (
                    <Typography variant="body2" sx={{ color: "#10b981", fontWeight: 600, py: 1 }}>
                      ไม่มีรายการที่ต้องติดตามในตอนนี้
                    </Typography>
                  )}
                </Stack>
              </Box>

              {selected.docs.length > 0 && (
                <Box>
                  <Divider sx={{ mb: 1 }} />
                  <Typography sx={{ fontWeight: 800, fontSize: "0.85rem", mb: 0.75 }}>เอกสารที่ออกล่าสุด</Typography>
                  <Stack spacing={0.5}>
                    {selected.docs
                      .slice()
                      .sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt))
                      .slice(0, 5)
                      .map((d) => (
                        <Typography key={d._id} variant="body2" sx={{ fontSize: "0.8rem", color: "text.secondary" }}>
                          {formatThai(moment(d.issuedAt), "DD/MM/YY")} · {d.docNumber} · {d.docType === "workNotice" ? "ใบแจ้งเข้างาน" : "ใบส่งมอบงาน"}
                        </Typography>
                      ))}
                  </Stack>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1, flexWrap: "wrap" }}>
          <Button onClick={() => setSelected(null)} sx={{ textTransform: "none" }}>ปิด</Button>
          <Box sx={{ flex: 1 }} />
          {/* ✅ ลิงก์ต่อไปหน้าต้นทาง พร้อมคำค้นของลูกค้ารายนี้ — หน้านี้มีไว้ "เห็นภาพรวมแล้วกดไปทำต่อ"
              ไม่ได้มีไว้ทำงานแทนหน้าอื่น
              ⚠️ ต้องส่ง year=all ไปด้วยเสมอ — ตัวกรองปีที่หน้าภาพรวมงานตั้งต้นเป็นปีปัจจุบัน ถ้าไม่ส่งไป
              สัญญาปีก่อนๆ ของลูกค้ารายนี้ (ซึ่งคือกลุ่มที่หมดอายุแล้วเกือบทั้งหมด) จะไม่ขึ้นเลยสักรายการ */}
          <Button
            size="small" startIcon={<OpenInNew sx={{ fontSize: 15 }} />}
            onClick={() => selected && navigate(`/contracts?view=all&year=all&q=${encodeURIComponent(selected.name)}`)}
            sx={{ textTransform: "none", fontWeight: 700, color: ACCENT }}
          >
            ดูในภาพรวมงาน
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
