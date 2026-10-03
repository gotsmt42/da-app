/**
 * CustomerOverview.js — "ภาพรวมลูกค้า" (มุมมองรายลูกค้าแบบรวมทุกอย่างไว้จอเดียว)
 *
 * จุดที่ขาดอยู่เดิม: ข้อมูลของลูกค้ารายหนึ่งกระจายอยู่ 4 หน้าคนละที่ — สัญญาอยู่ที่ "ภาพรวมงาน",
 * งานค้างอยู่ที่ "การดำเนินงาน", ใบเสนอราคาอยู่ที่ "ติดตามใบเสนอราคา", เอกสารที่ออกไปแล้วอยู่ที่
 * "ทะเบียนเอกสาร" — เวลาลูกค้าโทรมาถามต้องเปิดไล่ทีละหน้าแล้วกรองชื่อเองทุกครั้ง
 *
 * ✅ v2 (ผู้ใช้สั่ง 2 ต.ค. 2569 "หน้าลูกค้าทำให้สวยงาม และครบถ้วน" + กฎออกแบบ 6 ข้อ):
 *   🐛 หน้าขึ้น "ลูกค้า 0 ราย" ทั้งที่มีงาน: เดิมระบุลูกค้าด้วย "บริษัท" (company) อย่างเดียว แต่งานส่วนใหญ่
 *      กรอกแค่โครงการ (site) ช่องบริษัทว่าง → ทุกงานถูกทิ้งหมด · ตอนนี้ใช้ บริษัท → ถ้าว่างใช้โครงการ
 *   ✅ ครบถ้วน: รวมลูกค้าจาก "ทะเบียนลูกค้า" ด้วย — รายที่ยังไม่มีงานก็ขึ้น พร้อมข้อมูลติดต่อ (ผู้ติดต่อ/โทร/อีเมล/ที่อยู่/ภาษี)
 *   ✅ หน้าตาชุดเดียวกับหน้าอื่น (shared/ui/PageKit): สีน้อย ตัวเลขสีเข้ม แดงเฉพาะเรื่องต้องจัดการ ·
 *      จอใหญ่เป็นตาราง ตัวเลขชิดขวา · มือถือเป็นการ์ด · กดแถว = กล่องรายละเอียด
 *
 * ⚠️ หน้านี้ไม่เก็บข้อมูลใหม่เลย — ใช้ "ตรรกะกลาง" ชุดเดียวกับหน้าอื่นเป๊ะๆ (groupEventsByContract /
 * contractStatusInfo / getFollowUpInfo / buildDaysPastDueMap) ห้ามคำนวณเกณฑ์ซ้ำเองในไฟล์นี้
 */
import { FilterArea } from "@/shared/ui/MobileFilterSheet";
import { useEffect, useMemo, useRef, useState } from "react";
import useRealtime from "@/shared/realtime/useRealtime";
import { Navigate, useNavigate } from "react-router-dom";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import {
  Box, Stack, Typography, IconButton, Skeleton, Dialog, DialogContent, Button, Tooltip, useMediaQuery, Pagination, Avatar,
  Table, TableHead, TableBody, TableRow, TableCell,
} from "@mui/material";
import {
  Refresh, Business, Close, OpenInNew, ChevronRight, Phone, Email, Place, Person, Receipt,
} from "@mui/icons-material";
import { useAuth } from "@/features/auth/AuthContext";
import EventService from "@/shared/services/EventService";
import CustomerService from "@/shared/services/CustomerService";
import IssuedDocumentService from "@/shared/services/IssuedDocumentService";
import { groupEventsByContract, isRoundOverdue, contractStatusInfo } from "@/shared/utils/contractOverdue";
import { buildDaysPastDueMap, isFlaggedDays, getOverdueGroupKey } from "@/shared/utils/overdueJobs";
import { getFollowUpInfo } from "@/shared/utils/quotationTracking";
import { formatThai, thaiDate } from "@/shared/utils/thaiDate";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import { can } from "@/shared/utils/roles";
import SelectField from "@/shared/ui/SelectField";
import {
  PageHeader, Kpi, KpiRow, FilterBar, Panel, EmptyState, DotLabel, INK, INK_2, MUTED, FAINT, LINE, SURFACE, DANGER,
  CARD_SHADOW, TABLE_HEAD_SX, TABLE_ROW_SX, ICON_BTN_SX,
} from "@/shared/ui/PageKit";

const PAGE_SIZE = 15;
const SORT_OPTIONS = [
  { key: "attention", label: "ต้องดูก่อน" },
  { key: "value", label: "มูลค่างานสูงสุด" },
  { key: "recent", label: "เคลื่อนไหวล่าสุด" },
  { key: "name", label: "ชื่อ ก-ฮ" },
];
const FILTERS = [
  { key: "all", label: "ทุกราย" },
  { key: "attention", label: "มีเรื่องต้องติดตาม" },
  { key: "contract", label: "มีสัญญา" },
  { key: "idle", label: "ยังไม่มีงานในระบบ" },
];

const baht = (n) => `฿${Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
// ⚠️ normalize ช่องว่าง/ตัวพิมพ์ก่อนเสมอ ไม่งั้น "บริษัท ก  จำกัด" (เว้นวรรคเกิน) จะกลายเป็นคนละราย
const norm = (s) => String(s || "").trim().replace(/\s+/g, " ");
/** ชื่อลูกค้าของงาน/ทะเบียน — บริษัท ถ้าว่างใช้โครงการ (งานส่วนใหญ่กรอกแค่โครงการ) */
const nameOf = (company, site) => norm(company) || norm(site);

const Num = ({ v, alert, money }) => (
  <Typography component="span" sx={{ fontWeight: v ? 800 : 500, fontSize: "0.88rem", color: !v ? FAINT : alert ? DANGER : INK, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
    {v ? (money ? baht(v) : v) : "—"}
  </Typography>
);

/** แถว "สิ่งที่ต้องติดตาม" — จุดสี + หัวข้อ + คำอธิบาย (พื้นขาว ไม่ใช้พื้นสี) */
const TrackRow = ({ color, title, sub, onClick }) => (
  <Box onClick={onClick} sx={{ display: "flex", gap: 1.1, py: 1, px: 1.25, borderRadius: 2, border: `1px solid ${LINE}`, bgcolor: "#fff", cursor: onClick ? "pointer" : "default", "&:hover": onClick ? { borderColor: FAINT } : {} }}>
    <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color, mt: 0.75, flexShrink: 0 }} />
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography sx={{ fontWeight: 800, fontSize: "0.84rem", color: INK }}>{title}</Typography>
      {sub && <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{sub}</Typography>}
    </Box>
    {onClick && <ChevronRight sx={{ color: "#cbd5e1", alignSelf: "center" }} />}
  </Box>
);

const Section = ({ title, children, action }) => (
  <Box>
    <Stack direction="row" alignItems="center" sx={{ mb: 0.75 }}>
      <Typography sx={{ flex: 1, fontWeight: 800, fontSize: "0.84rem", color: INK }}>{title}</Typography>
      {action}
    </Stack>
    {children}
  </Box>
);

export default function CustomerOverview() {
  const { userData, loading: authLoading } = useAuth();
  const isAdminOrManager = can(userData, "manageMasterData");
  const isDesktop = useMediaQuery("(min-width:900px)");
  const fullScreen = useMediaQuery("(max-width:600px)");
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [registry, setRegistry] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("attention");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedKey, setSelectedKey] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const loadedOnceRef = useRef(false);
  useRealtime(["events", "documents", "customers"], () => setReloadKey((k) => k + 1));

  useEffect(() => {
    let alive = true;
    if (!loadedOnceRef.current) setLoading(true);
    (async () => {
      try {
        // ⚠️ ทะเบียนเอกสารดึงได้สูงสุด 200 ใบต่อครั้งตามที่ API จำกัด — ใช้แค่ "นับ + โชว์ล่าสุด" ต่อลูกค้า
        const [resEvents, resCustomers, resDocs] = await Promise.all([
          EventService.getEventOp().catch(() => ({ userEvents: [] })),
          CustomerService.getCustomers().catch(() => ({ userCustomers: [] })),
          IssuedDocumentService.list({ limit: 200 }).catch(() => ({ items: [] })),
        ]);
        if (!alive) return;
        setEvents(resEvents?.userEvents || []);
        setRegistry(resCustomers?.userCustomers || []);
        setDocs(resDocs?.items || resDocs?.docs || []);
        loadedOnceRef.current = true;
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [reloadKey]);

  // ── ประกอบข้อมูลรายลูกค้า ────────────────────────────────────────────────
  const customers = useMemo(() => {
    const map = new Map();
    const bucket = (name) => {
      const label = norm(name);
      const key = label.toLowerCase();
      if (!key) return null;
      if (!map.has(key)) {
        map.set(key, {
          key, name: label, sites: new Set(), records: [],
          contracts: [], expired: [], expiring: [], overdueRounds: [],
          totalValue: 0, quotationPending: [], overdueJobKeys: new Set(), jobKeys: new Set(),
          docs: [], lastActivity: null,
        });
      }
      return map.get(key);
    };

    // ทะเบียนลูกค้า — ทุกรายต้องขึ้น แม้ยังไม่มีงานในระบบ
    registry.forEach((c) => {
      const b = bucket(nameOf(c.cCompany, c.cSite));
      if (!b) return;
      b.records.push(c);
      if (norm(c.cSite)) b.sites.add(norm(c.cSite));
    });

    if (events.length) {
      const contracts = groupEventsByContract(events);
      const daysPastDueMap = buildDaysPastDueMap(events);
      contracts.forEach((c) => {
        const b = bucket(nameOf(c.company, c.site));
        if (!b) return;
        b.totalValue += Number(c.jobValue) || 0;
        if (c.isRealContract) {
          b.contracts.push(c);
          const st = contractStatusInfo(c);
          if (st?.state === "expired") b.expired.push(c);
          else if (st?.state === "expiring") b.expiring.push(c);
          if (isRoundOverdue(c)) b.overdueRounds.push(c);
        }
      });
      events.forEach((e) => {
        const b = bucket(nameOf(e.company, e.site));
        if (!b) return;
        if (norm(e.site)) b.sites.add(norm(e.site));
        b.jobKeys.add(getOverdueGroupKey(e));
        if (e.quotationStatus === "sent") b.quotationPending.push(e);
        const days = daysPastDueMap.get(e._id);
        if (isFlaggedDays(days) && e.status !== "ดำเนินการเสร็จสิ้น") b.overdueJobKeys.add(getOverdueGroupKey(e));
        const stamp = e.updatedAt || e.end || e.start || e.date;
        if (stamp && moment(stamp).isValid() && (!b.lastActivity || moment(stamp).isAfter(b.lastActivity))) b.lastActivity = moment(stamp);
      });
    }

    docs.forEach((d) => {
      const b = map.get(norm(d.customerCompany).toLowerCase());
      if (b) b.docs.push(d);
    });

    return [...map.values()].map((b) => {
      const contact = b.records.find((r) => r.cName || r.tel || r.cEmail) || b.records[0] || null;
      return {
        ...b,
        contact,
        siteList: [...b.sites],
        jobCount: b.jobKeys.size,
        overdueJobCount: b.overdueJobKeys.size,
        // ✅ "คะแนนต้องดูก่อน" ถ่วงตามความเสียหายถ้าปล่อยไว้: สัญญาหมดอายุ > ใกล้หมด > งานค้าง > รอบยังไม่วางแผน > ใบเสนอราคาค้าง
        attention: b.expired.length * 100 + b.expiring.length * 40 + b.overdueJobKeys.size * 20 + b.overdueRounds.length * 10 + b.quotationPending.length * 5,
      };
    });
  }, [events, registry, docs]);

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    const list = customers.filter((c) => {
      if (filter === "attention" && !c.attention) return false;
      if (filter === "contract" && !c.contracts.length) return false;
      if (filter === "idle" && c.jobCount) return false;
      return !kw || [c.name, ...c.siteList, c.contact?.cName, c.contact?.tel, c.contact?.cEmail].some((v) => String(v || "").toLowerCase().includes(kw));
    });
    return list.slice().sort((a, b) => {
      if (sortBy === "value") return b.totalValue - a.totalValue || a.name.localeCompare(b.name, "th");
      if (sortBy === "name") return a.name.localeCompare(b.name, "th");
      if (sortBy === "recent") return (b.lastActivity?.valueOf() || 0) - (a.lastActivity?.valueOf() || 0);
      return b.attention - a.attention || b.totalValue - a.totalValue || a.name.localeCompare(b.name, "th");
    });
  }, [customers, search, sortBy, filter]);

  useEffect(() => { setPage(1); }, [search, sortBy, filter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cur = Math.min(page, pageCount);
  const paged = filtered.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);
  const selected = customers.find((c) => c.key === selectedKey) || null;

  const totals = useMemo(() => customers.reduce((a, c) => ({
    customers: a.customers + 1,
    active: a.active + (c.jobCount ? 1 : 0),
    value: a.value + c.totalValue,
    expired: a.expired + c.expired.length,
    expiring: a.expiring + c.expiring.length,
    overdueJobs: a.overdueJobs + c.overdueJobCount,
    quotations: a.quotations + c.quotationPending.length,
    attention: a.attention + (c.attention ? 1 : 0),
  }), { customers: 0, active: 0, value: 0, expired: 0, expiring: 0, overdueJobs: 0, quotations: 0, attention: 0 }), [customers]);

  if (authLoading) return null;
  if (!isAdminOrManager) return <Navigate to="/dashboard" replace />;

  const flagsOf = (c) => [
    c.expired.length && { color: DANGER, text: `สัญญาหมดอายุ ${c.expired.length}`, strong: true },
    c.expiring.length && { color: "#d97706", text: `ใกล้หมดอายุ ${c.expiring.length}` },
    c.overdueJobCount && { color: DANGER, text: `งานค้าง ${c.overdueJobCount}`, strong: true },
    c.overdueRounds.length && { color: "#2563eb", text: `รอบยังไม่วางแผน ${c.overdueRounds.length}` },
    c.quotationPending.length && { color: "#7c3aed", text: `ใบเสนอราคารอผล ${c.quotationPending.length}` },
  ].filter(Boolean);

  const Who = ({ c, size = 34 }) => (
    <Stack direction="row" spacing={1.1} alignItems="center" sx={{ minWidth: 0 }}>
      <Avatar variant="rounded" sx={{ width: size, height: size, borderRadius: 2, fontSize: size * 0.4, fontWeight: 800, bgcolor: personColor(c.name) }}>{personInitial(c.name)}</Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography noWrap sx={{ fontWeight: 800, fontSize: "0.88rem", color: INK, lineHeight: 1.3 }}>{c.name}</Typography>
        <Typography noWrap sx={{ fontSize: "0.72rem", color: MUTED, lineHeight: 1.3 }}>
          {c.siteList.length > 1 ? `${c.siteList.length} โครงการ` : c.siteList[0] && c.siteList[0] !== c.name ? c.siteList[0] : c.records.length ? "ในทะเบียนลูกค้า" : "จากงานในระบบ"}
        </Typography>
      </Box>
    </Stack>
  );

  return (
    <Box sx={{ p: { xs: 1.25, sm: 2.5 }, maxWidth: 1400, mx: "auto" }}>
      <PageHeader
        icon={<Business />}
        title="ภาพรวมลูกค้า"
        subtitle="สัญญา · งานค้าง · ใบเสนอราคา · เอกสาร ของลูกค้าแต่ละรายในจอเดียว"
        actions={(
          <Tooltip title="โหลดข้อมูลใหม่">
            <IconButton onClick={() => setReloadKey((k) => k + 1)} sx={ICON_BTN_SX} aria-label="โหลดข้อมูลใหม่"><Refresh sx={{ fontSize: 20 }} /></IconButton>
          </Tooltip>
        )}
      />

      {/* ✅ มือถือ: ตัวเลขสรุป/ค้นหา/ตัวกรองอยู่ในแผ่นล่าง (FilterArea) — จอไม่รก (ผู้ใช้สั่ง 3 ต.ค. 2569) */}
      <FilterArea count={(search.trim() ? 1 : 0) + (filter !== "all" ? 1 : 0)} summary={`ลูกค้า ${totals.customers} ราย · ต้องติดตาม ${totals.attention}`}
        onClear={() => { setSearch(""); setFilter("all"); }}
        chips={[
          search.trim() && { key: "q", label: `ค้นหา: ${search.trim()}`, onDelete: () => setSearch("") },
          filter !== "all" && { key: "f", label: FILTERS.find((x) => x.key === filter)?.label, onDelete: () => setFilter("all") },
        ]}>
        {loading ? (
          <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, 1fr)" }, mb: 1.5 }}>
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} variant="rounded" height={76} sx={{ borderRadius: 2.5 }} />)}
          </Box>
        ) : (
          <KpiRow columns={5}>
            <Kpi label="ลูกค้าทั้งหมด" value={`${totals.customers} ราย`} sub={`มีงานในระบบ ${totals.active} ราย`} onClick={() => setFilter("all")} active={filter === "all"} />
            <Kpi label="มูลค่างานรวม" value={baht(totals.value)} sub="ตามมูลค่างาน/สัญญาที่บันทึก" />
            <Kpi label="ต้องติดตาม" value={`${totals.attention} ราย`} sub={`งานค้าง ${totals.overdueJobs} · ใบเสนอราคา ${totals.quotations}`} alert={totals.attention > 0}
              onClick={() => setFilter("attention")} active={filter === "attention"} />
            <Kpi label="สัญญาหมดอายุ" value={`${totals.expired} ฉบับ`} sub={totals.expiring ? `ใกล้หมดอีก ${totals.expiring} ฉบับ` : "ไม่มีสัญญาใกล้หมด"} alert={totals.expired > 0}
              onClick={() => setFilter("contract")} active={filter === "contract"} />
            <Kpi label="ยังไม่มีงานในระบบ" value={`${totals.customers - totals.active} ราย`} sub="มีในทะเบียนแต่ยังไม่เคยลงงาน" onClick={() => setFilter("idle")} active={filter === "idle"} />
          </KpiRow>
        )}
  
        <FilterBar search={search} onSearch={setSearch} placeholder="ค้นหาลูกค้า / โครงการ / ผู้ติดต่อ / เบอร์โทร">
          <SelectField label="แสดง" value={filter} onChange={(e) => setFilter(e.target.value)} sx={{ minWidth: { xs: 0, sm: 170 }, flex: { xs: 1, sm: "none" } }}>
            {FILTERS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </SelectField>
          <SelectField label="เรียงตาม" value={sortBy} onChange={(e) => setSortBy(e.target.value)} sx={{ minWidth: { xs: 0, sm: 170 }, flex: { xs: 1, sm: "none" } }}>
            {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </SelectField>
        </FilterBar>
      </FilterArea>

      {loading ? (
        <Stack spacing={1}>{[1, 2, 3, 4].map((i) => <Skeleton key={i} variant="rounded" height={isDesktop ? 56 : 110} sx={{ borderRadius: 2.5 }} />)}</Stack>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Business />} title={search || filter !== "all" ? "ไม่พบลูกค้าตามตัวกรอง" : "ยังไม่มีข้อมูลลูกค้า"}
          hint={search || filter !== "all" ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง" : "เพิ่มลูกค้าได้ที่แท็บ \"ทะเบียนลูกค้า\" หรือเมื่อลงงานในปฏิทิน"} />
      ) : isDesktop ? (
        <Panel sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 1000, ...TABLE_HEAD_SX }}>
            <TableHead>
              <TableRow>
                <TableCell>ลูกค้า</TableCell>
                <TableCell>ผู้ติดต่อ</TableCell>
                <TableCell align="right">งาน</TableCell>
                <TableCell align="right">สัญญา</TableCell>
                <TableCell align="right">มูลค่างาน</TableCell>
                <TableCell>ต้องติดตาม</TableCell>
                <TableCell>เคลื่อนไหวล่าสุด</TableCell>
                <TableCell width={32} />
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.map((c) => {
                const flags = flagsOf(c);
                return (
                  <TableRow key={c.key} hover onClick={() => setSelectedKey(c.key)} sx={{ cursor: "pointer", ...TABLE_ROW_SX }}>
                    <TableCell sx={{ maxWidth: 280 }}><Who c={c} /></TableCell>
                    <TableCell sx={{ maxWidth: 200 }}>
                      {c.contact?.cName || c.contact?.tel ? (
                        <>
                          <Typography noWrap sx={{ fontSize: "0.84rem", color: INK }}>{c.contact?.cName || "—"}</Typography>
                          {c.contact?.tel && <Typography noWrap sx={{ fontSize: "0.72rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>{c.contact.tel}</Typography>}
                        </>
                      ) : <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>—</Typography>}
                    </TableCell>
                    <TableCell align="right"><Num v={c.jobCount} /></TableCell>
                    <TableCell align="right"><Num v={c.contracts.length} /></TableCell>
                    <TableCell align="right"><Num v={c.totalValue} money /></TableCell>
                    <TableCell sx={{ maxWidth: 300 }}>
                      {flags.length ? (
                        <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
                          {flags.slice(0, 2).map((f) => <DotLabel key={f.text} color={f.color} strong={f.strong}>{f.text}</DotLabel>)}
                          {flags.length > 2 && <Typography sx={{ fontSize: "0.72rem", color: MUTED, alignSelf: "center" }}>+{flags.length - 2}</Typography>}
                        </Stack>
                      ) : <Typography sx={{ fontSize: "0.8rem", color: FAINT }}>ไม่มี</Typography>}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      <Typography sx={{ fontSize: "0.8rem", color: c.lastActivity ? INK_2 : FAINT }}>{c.lastActivity ? thaiDate(c.lastActivity) : "—"}</Typography>
                    </TableCell>
                    <TableCell><ChevronRight sx={{ color: "#cbd5e1" }} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Panel>
      ) : (
        <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
          {paged.map((c) => {
            const flags = flagsOf(c);
            return (
              <Box key={c.key} role="button" onClick={() => setSelectedKey(c.key)}
                sx={{ p: 1.5, bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, cursor: "pointer", boxShadow: CARD_SHADOW, "&:active": { bgcolor: SURFACE } }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ flex: 1, minWidth: 0 }}><Who c={c} /></Box>
                  <ChevronRight sx={{ color: "#cbd5e1" }} />
                </Stack>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", mt: 1.25, pt: 1.25, borderTop: `1px solid ${LINE}` }}>
                  {[["งาน", c.jobCount], ["สัญญา", c.contracts.length], ["มูลค่างาน", c.totalValue, true]].map(([l, v, money], i) => (
                    <Box key={l} sx={{ textAlign: "center", borderLeft: i ? `1px solid ${LINE}` : 0, minWidth: 0 }}>
                      <Num v={v} money={money} />
                      <Typography noWrap sx={{ fontSize: "0.66rem", color: MUTED }}>{l}</Typography>
                    </Box>
                  ))}
                </Box>
                {flags.length > 0 && (
                  <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap", mt: 1 }}>
                    {flags.map((f) => <DotLabel key={f.text} color={f.color} strong={f.strong}>{f.text}</DotLabel>)}
                  </Stack>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      {!loading && filtered.length > 0 && (
        <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" spacing={1} sx={{ mt: 1.5 }}>
          <Typography sx={{ flex: 1, fontSize: "0.76rem", color: MUTED }}>
            {pageCount > 1 ? `แสดง ${(cur - 1) * PAGE_SIZE + 1}–${(cur - 1) * PAGE_SIZE + paged.length} จาก ` : ""}{filtered.length} ราย
          </Typography>
          {pageCount > 1 && (
            <Pagination count={pageCount} page={cur} onChange={(_, n) => setPage(n)} shape="rounded" size={isDesktop ? "medium" : "small"} siblingCount={isDesktop ? 1 : 0}
              sx={{ "& .Mui-selected": { bgcolor: "#eff6ff !important", color: "#1d4ed8", borderColor: "#bfdbfe" } }} />
          )}
        </Stack>
      )}

      {/* ── กล่องรายละเอียดลูกค้า ── */}
      <Dialog open={Boolean(selected)} onClose={() => setSelectedKey("")} fullWidth maxWidth="sm" fullScreen={fullScreen} PaperProps={{ sx: { borderRadius: fullScreen ? 0 : 3, bgcolor: SURFACE } }}>
        {selected && (
          <>
            <Box sx={{ px: 2.5, py: 2, bgcolor: "#fff", borderBottom: `1px solid ${LINE}` }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ flex: 1, minWidth: 0 }}><Who c={selected} size={40} /></Box>
                <IconButton aria-label="ปิด" onClick={() => setSelectedKey("")}><Close /></IconButton>
              </Stack>
              <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.75 }}>
                {selected.lastActivity ? `เคลื่อนไหวล่าสุด ${formatThai(moment(selected.lastActivity).locale("th"), "D MMM YYYY")}` : "ยังไม่มีงานในระบบ"}
              </Typography>
            </Box>
            <DialogContent sx={{ px: 2.5, py: 2 }}>
              <Stack spacing={2}>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 2.5, py: 1.25 }}>
                  {[["งาน", selected.jobCount], ["สัญญา", selected.contracts.length], ["มูลค่างาน", selected.totalValue, true], ["เอกสาร", selected.docs.length]].map(([l, v, money], i) => (
                    <Box key={l} sx={{ textAlign: "center", borderLeft: i ? `1px solid ${LINE}` : 0, minWidth: 0, px: 0.5 }}>
                      <Num v={v} money={money} />
                      <Typography noWrap sx={{ fontSize: "0.68rem", color: MUTED }}>{l}</Typography>
                    </Box>
                  ))}
                </Box>

                <Section title="ข้อมูลติดต่อ">
                  {selected.contact ? (
                    <Box sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 2.5, p: 1.5, display: "grid", gap: 0.9 }}>
                      {[
                        [Person, selected.contact.cName],
                        [Phone, selected.contact.tel, selected.contact.tel && `tel:${selected.contact.tel}`],
                        [Email, selected.contact.cEmail, selected.contact.cEmail && `mailto:${selected.contact.cEmail}`],
                        [Place, selected.contact.address],
                        [Receipt, selected.contact.tax && `เลขผู้เสียภาษี ${selected.contact.tax}`],
                      ].filter(([, v]) => v).map(([Icon, v, href]) => (
                        <Stack key={v} direction="row" spacing={1} alignItems="flex-start">
                          <Icon sx={{ fontSize: 17, color: MUTED, mt: 0.2 }} />
                          <Typography component={href ? "a" : "span"} href={href || undefined}
                            sx={{ fontSize: "0.86rem", color: href ? "#2563eb" : INK, textDecoration: "none", whiteSpace: "pre-line", wordBreak: "break-word" }}>{v}</Typography>
                        </Stack>
                      ))}
                      {!selected.contact.cName && !selected.contact.tel && !selected.contact.cEmail && !selected.contact.address && !selected.contact.tax && (
                        <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>ยังไม่ได้กรอกข้อมูลติดต่อในทะเบียนลูกค้า</Typography>
                      )}
                    </Box>
                  ) : (
                    <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>ลูกค้ารายนี้ยังไม่อยู่ในทะเบียนลูกค้า (มาจากงานในระบบ) — เพิ่มได้ที่แท็บ "ทะเบียนลูกค้า"</Typography>
                  )}
                </Section>

                {selected.siteList.length > 0 && (
                  <Section title={`โครงการ (${selected.siteList.length})`}>
                    <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
                      {selected.siteList.map((s) => <DotLabel key={s} color={FAINT}>{s}</DotLabel>)}
                    </Stack>
                  </Section>
                )}

                <Section title="สิ่งที่ต้องติดตาม">
                  <Stack spacing={0.75}>
                    {selected.expired.map((c) => (
                      <TrackRow key={`ex-${c.key}`} color={DANGER} title={`สัญญาหมดอายุแล้ว${c.contractNo ? ` · ${c.contractNo}` : ""}`}
                        sub={`${c.site || "ไม่ระบุโครงการ"} · สิ้นสุด ${thaiDate(c.contractEnd)}`} />
                    ))}
                    {selected.expiring.map((c) => (
                      <TrackRow key={`eg-${c.key}`} color="#d97706" title={`${contractStatusInfo(c)?.label || "ใกล้หมดอายุ"}${c.contractNo ? ` · ${c.contractNo}` : ""}`}
                        sub={`${c.site || "ไม่ระบุโครงการ"} · สิ้นสุด ${thaiDate(c.contractEnd)}`} />
                    ))}
                    {selected.overdueRounds.map((c) => (
                      <TrackRow key={`or-${c.key}`} color="#2563eb" title={`ยังไม่ได้วางแผนรอบถัดไป${c.contractNo ? ` · ${c.contractNo}` : ""}`} sub={c.site || "ไม่ระบุโครงการ"} />
                    ))}
                    {selected.quotationPending.map((e) => {
                      const info = getFollowUpInfo(e);
                      return (
                        <TrackRow key={`q-${e._id}`} color="#7c3aed" onClick={() => navigate(`/finance?jobId=${e._id}`)}
                          title={`ใบเสนอราคารอผล${e.quotationAmount ? ` · ${baht(e.quotationAmount)}` : ""}`}
                          sub={`${e.site || e.title || "ไม่ระบุงาน"}${info ? ` · เงียบ ${info.daysSinceLastContact} วัน` : ""}`} />
                      );
                    })}
                    {selected.overdueJobCount > 0 && (
                      <TrackRow color={DANGER} title={`งานค้างเกินกำหนด ${selected.overdueJobCount} งาน`} sub="ดูรายละเอียดที่หน้าการดำเนินงาน"
                        onClick={() => navigate("/operation")} />
                    )}
                    {!selected.attention && <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>ไม่มีเรื่องที่ต้องติดตามตอนนี้</Typography>}
                  </Stack>
                </Section>

                {selected.docs.length > 0 && (
                  <Section title="เอกสารที่ออกล่าสุด">
                    <Box sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 2.5 }}>
                      {selected.docs.slice().sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt)).slice(0, 5).map((d, i) => (
                        <Stack key={d._id} direction="row" spacing={1} sx={{ px: 1.5, py: 1, borderTop: i ? `1px solid ${LINE}` : 0 }}>
                          <Typography sx={{ fontSize: "0.8rem", color: MUTED, minWidth: 74, fontVariantNumeric: "tabular-nums" }}>{formatThai(moment(d.issuedAt), "DD/MM/YY")}</Typography>
                          <Typography noWrap sx={{ fontSize: "0.82rem", color: INK, flex: 1, minWidth: 0 }}>{d.docNumber} · {d.docType === "workNotice" ? "ใบแจ้งเข้างาน" : "ใบส่งมอบงาน"}</Typography>
                        </Stack>
                      ))}
                    </Box>
                  </Section>
                )}

                {/* ⚠️ ต้องส่ง year=all ไปด้วยเสมอ — ไม่งั้นสัญญาปีก่อนๆ (กลุ่มที่หมดอายุแล้ว) จะไม่ขึ้น */}
                <Button fullWidth endIcon={<OpenInNew sx={{ fontSize: 17 }} />}
                  onClick={() => navigate(`/contracts?view=all&year=all&q=${encodeURIComponent(selected.name)}`)}
                  sx={{ textTransform: "none", fontWeight: 700, justifyContent: "space-between", border: `1px solid ${LINE}`, borderRadius: 2, color: INK_2, bgcolor: "#fff" }}>
                  ดูงานและสัญญาทั้งหมดในหน้าภาพรวมงาน
                </Button>
              </Stack>
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
}
