/**
 * ExpenseList — รายการใบเบิก Advance / ใบเคลม / กล่องงานรอดำเนินการของหัวหน้า
 *
 * ✅ จอคอม = ตาราง (อ่านเทียบกันหลายใบ) · จอมือถือ = การ์ด (แตะง่าย) — ไม่ใช่ตารางยืดบนมือถือ
 * ✅ ตัวกรองสถานะเป็นชิปพร้อมตัวเลข — เห็นทันทีว่าค้างกี่ใบในแต่ละขั้นโดยไม่ต้องกดดูทีละอัน
 * ⚠️ ขอบเขตข้อมูล (ช่างเห็นเฉพาะของตัวเอง) บังคับที่ server — หน้านี้แสดงเท่าที่ได้รับมา
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Box, Stack, Typography, Chip, TextField, InputAdornment, MenuItem, Button, Table, TableHead, TableRow,
  TableCell, TableBody, useMediaQuery, Skeleton, Alert, IconButton, Menu,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Search, Add, WarningAmber, ChevronRight, Inbox, FilterList, Close } from "@mui/icons-material";

import { thaiDate } from "@/shared/utils/thaiDate";
import usePermissions from "@/shared/hooks/usePermissions";
import ExpenseService, { errorText } from "../services/ExpenseService";
import KindBadge from "./KindBadge";
import {
  KIND_META, statusMeta, STATUS_FILTERS, CLAIM_TYPE_FILTERS, baht, differenceMeta, isOverdueClear, jobText, slipKind, slipMeta, TEXT_SUB, TEXT_MAIN, BORDER_MAIN, personFullName,
} from "../expenseMeta";

const PERIODS = [
  { value: "all", label: "ทุกช่วงเวลา" },
  { value: "month", label: "เดือนนี้" },
  { value: "3m", label: "3 เดือนล่าสุด" },
  { value: "year", label: "ปีนี้" },
];

const periodRange = (p) => {
  const now = new Date();
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (p === "month") return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
  if (p === "3m") return { from: iso(new Date(now.getFullYear(), now.getMonth() - 2, 1)), to: iso(now) };
  if (p === "year") return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(now) };
  return {};
};

/** กลุ่มในกล่องงานของหัวหน้า — เรียงตามความเร่งด่วนของ "สิ่งที่ต้องทำ" */
/**
 * กลุ่มในกล่อง "รอดำเนินการ" — เรียงตามสายอนุมัติ 3 ส่วน (ส่วนที่ 2 แยกเป็นสองมือ: ตรวจสอบ → อนุมัติ)
 * ✅ cap = สิทธิ์ของขั้นนั้น → แต่ละคนเห็นเฉพาะกลุ่มที่ตัวเองลงมือได้จริง (ผู้ใช้กำหนดว่าใครทำขั้นไหน)
 *   แอดมินช่าง: รอตรวจสอบ · ผู้จัดการแผนกช่าง: ครบทุกขั้น · กรรมการผู้จัดการ: รออนุมัติเบิกจ่าย
 */
const INBOX_GROUPS = [
  { key: "review", cap: "reviewExpense", title: "รอตรวจสอบ", hint: "ขั้นที่ 2 จาก 3 — ตรวจรายการและหลักฐาน แล้วส่งต่อให้ผู้จัดการแผนกช่างอนุมัติ", match: (e) => e.status === "pending" },
  { key: "approve", cap: "approveExpense", title: "รออนุมัติ", hint: "ขั้นที่ 2 จาก 3 — แอดมินตรวจสอบแล้ว รอผู้จัดการแผนกช่างอนุมัติ", match: (e) => e.status === "reviewed" },
  { key: "pay", cap: "disburseExpense", title: "รออนุมัติเบิกจ่าย · Advance", hint: "ขั้นที่ 3 จาก 3 — อนุมัติแล้ว รออนุมัติเบิกจ่ายและบันทึกการจ่ายเงิน", match: (e) => e.kind === "advance" && e.status === "approved" },
  { key: "settle", cap: "disburseExpense", title: "รออนุมัติเบิกจ่าย · ส่วนต่างใบเคลม", hint: "ขั้นที่ 3 จาก 3 — จ่ายส่วนต่างเพิ่ม / ยืนยันรับเงินคืน", match: (e) => e.kind === "claim" && e.status === "approved" && slipKind(e) !== "reimburse" },
  // ⚠️ คนละงานกับข้างบน — ใบสำรองจ่ายคือพนักงานควักเงินตัวเองรออยู่ ไม่ใช่การปิดส่วนต่างของเงินที่จ่ายไปแล้ว
  { key: "reimburse", cap: "disburseExpense", title: "รออนุมัติเบิกจ่าย · คืนค่าสำรองจ่าย", hint: "ขั้นที่ 3 จาก 3 — อนุมัติแล้ว รอโอนคืนให้ผู้เบิก", match: (e) => slipKind(e) === "reimburse" && e.status === "approved" },
  { key: "overdue", cap: "viewAllExpenses", title: "Advance เลยกำหนดเคลียร์", hint: "จ่ายเงินไปแล้วแต่ยังไม่ส่งใบเคลม", match: (e) => isOverdueClear(e) },
];

/**
 * ข้อความอ้างอิงใต้เลขที่ใบ — ใบเคลมบอกว่าเคลียร์ใบไหน · ใบสำรองจ่ายบอกว่า "ไม่มี Advance"
 * ⚠️ ใบสำรองจ่ายต้องบอกให้ชัดว่าไม่มีใบอ้างอิง ไม่ใช่ปล่อยว่าง — ว่างไว้จะดูเหมือนข้อมูลหาย
 */
const refLabel = (e) => {
  if (slipKind(e) === "reimburse") return "สำรองจ่ายเอง · ไม่มี Advance";
  if (e.kind === "claim" && e.advance?.docNo) return `อ้าง ${e.advance.docNo}`;
  return "";
};

const StatusChip = ({ e }) => {
  const st = statusMeta(e.status, slipKind(e));
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
      <Chip size="small" label={st.label} sx={{ height: 22, fontSize: "0.72rem", fontWeight: 800, bgcolor: alpha(st.color, 0.12), color: st.color }} />
      {isOverdueClear(e) && (
        <Chip size="small" icon={<WarningAmber sx={{ fontSize: "14px !important" }} />} label="เลยกำหนด"
          sx={{ height: 22, fontSize: "0.7rem", fontWeight: 800, bgcolor: alpha("#dc2626", 0.1), color: "#dc2626" }} />
      )}
    </Stack>
  );
};

const AmountCell = ({ e }) => {
  if (e.kind !== "claim") return <Typography sx={{ fontWeight: 800, fontSize: "0.92rem", color: TEXT_MAIN }}>{baht(e.total)}</Typography>;
  const d = differenceMeta(e.difference, slipKind(e));
  return (
    <Box>
      <Typography sx={{ fontWeight: 800, fontSize: "0.92rem", color: TEXT_MAIN }}>{baht(e.total)}</Typography>
      <Typography variant="caption" sx={{ color: d.color, fontWeight: 700, whiteSpace: "nowrap" }}>
        {d.amount ? `${d.short} ${baht(d.amount)}` : "พอดี"}
      </Typography>
    </Box>
  );
};

const MobileCard = ({ e, onOpen }) => (
  <Box onClick={() => onOpen(e._id)} role="button" sx={{
    p: 1.5, bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 2.5, cursor: "pointer",
    // ✅ แถบซ้ายเป็นสีประจำชนิดใบ (ไม่ใช่สีสถานะ) — ผู้ใช้ขอให้แยก Advance/Claim ได้ชัดเจนตั้งแต่มองรายการ
    borderLeft: `5px solid ${slipMeta(e).color}`, "&:active": { bgcolor: "#f8fafc" },
  }}>
    <Stack direction="row" spacing={1.25} alignItems="flex-start">
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="baseline" spacing={1}>
          <KindBadge kind={slipKind(e)} />
          <Typography sx={{ fontWeight: 800, fontSize: "0.84rem", color: slipMeta(e).dark, flex: 1 }} noWrap>{e.docNo}</Typography>
          <AmountCell e={e} />
        </Stack>
        <Typography sx={{ fontWeight: 700, fontSize: "0.92rem", color: TEXT_MAIN, lineHeight: 1.35 }}>{e.subject}</Typography>
        <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }} noWrap>
          {thaiDate(e.docDate)} · {personFullName(e.requester)}{refLabel(e) ? ` · ${refLabel(e)}` : ""}{e.job?.title ? ` · ${jobText(e.job)}` : ""}
        </Typography>
        <Box sx={{ mt: 0.75 }}><StatusChip e={e} /></Box>
      </Box>
    </Stack>
  </Box>
);

const DesktopTable = ({ rows, onOpen }) => (
  <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 2.5, overflowX: "auto" }}>
    <Table size="small" sx={{ minWidth: 820, "& th": { fontWeight: 800, color: TEXT_SUB, fontSize: "0.76rem", bgcolor: "#f8fafc", whiteSpace: "nowrap" } }}>
      <TableHead>
        <TableRow>
          <TableCell>เลขที่ / วันที่</TableCell>
          <TableCell>ผู้เบิก</TableCell>
          <TableCell>เรื่อง · งาน</TableCell>
          <TableCell align="right">ยอด</TableCell>
          <TableCell>สถานะ</TableCell>
          <TableCell width={36} />
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((e) => (
          <TableRow key={e._id} hover onClick={() => onOpen(e._id)} sx={{ cursor: "pointer", "& td": { py: 1.1, borderColor: BORDER_MAIN } }}>
            <TableCell sx={{ whiteSpace: "nowrap", boxShadow: `inset 5px 0 0 ${slipMeta(e).color}`, pl: 2.25 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <KindBadge kind={slipKind(e)} />
                    <Typography sx={{ fontWeight: 800, fontSize: "0.85rem", color: slipMeta(e).dark }}>{e.docNo}</Typography>
                  </Stack>
                  <Typography variant="caption" sx={{ color: TEXT_SUB }}>{thaiDate(e.docDate)}</Typography>
                </Box>
              </Stack>
            </TableCell>
            <TableCell sx={{ whiteSpace: "nowrap" }}>
              <Typography sx={{ fontWeight: 700, fontSize: "0.85rem" }}>{personFullName(e.requester)}</Typography>
              <Typography variant="caption" sx={{ color: TEXT_SUB }}>{e.requester?.position}</Typography>
            </TableCell>
            <TableCell sx={{ maxWidth: 380 }}>
              <Typography sx={{ fontWeight: 600, fontSize: "0.86rem" }} noWrap>{e.subject}</Typography>
              <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }} noWrap>
                {[refLabel(e), jobText(e.job), `${e.items?.length || 0} รายการ`].filter(Boolean).join(" · ")}
              </Typography>
            </TableCell>
            <TableCell align="right"><AmountCell e={e} /></TableCell>
            <TableCell><StatusChip e={e} /></TableCell>
            <TableCell><ChevronRight sx={{ color: "#cbd5e1" }} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </Box>
);

export default function ExpenseList({ mode, status: statusProp, claimType = "all", onClaimTypeChange, onStatusChange, onOpen, onCreate, reloadKey }) {
  const isDesktop = useMediaQuery("(min-width:900px)");
  const { can } = usePermissions();
  const viewAll = can("viewAllExpenses");
  const [searchParams] = useSearchParams();
  const kind = mode === "inbox" ? null : mode;
  const meta = kind ? KIND_META[kind] : null;

  const initialStatus = statusProp || searchParams.get("status");
  const [status, setStatusState] = useState(kind && (STATUS_FILTERS[kind].includes(initialStatus) || initialStatus === "overdue") ? initialStatus : "all");
  // ⚠️ ตัวกรองสถานะเป็นของ "หน้า" ไม่ใช่ของรายการ — แถบตัวเลขด้านบนกับชิปในรายการต้องชี้ค่าเดียวกัน
  // ไม่งั้นกดตัวเลขด้านบนแล้วชิปยังค้างที่ "ทั้งหมด" ผู้ใช้จะอ่านไม่ออกว่ากำลังดูอะไรอยู่
  const setStatus = (v) => { setStatusState(v); onStatusChange?.(v); };
  useEffect(() => {
    if (statusProp !== undefined && statusProp !== status) setStatusState(statusProp || "all");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ตามค่าจากหน้าแม่เท่านั้น
  }, [statusProp]);
  const [period, setPeriod] = useState("all");
  const [person, setPerson] = useState("all");
  const [q, setQ] = useState("");
  const [filterAnchor, setFilterAnchor] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const lastQueryRef = useRef("");
  useEffect(() => {
    let alive = true;
    // ⚠️ กรองชนิดย่อยที่ server (ไม่ใช่กรองในหน้า) — รายการถูกจำกัดจำนวนแถวไว้ ถ้ากรองทีหลังจะได้
    // ใบสำรองจ่ายไม่ครบเมื่อมีใบเคลมเยอะกว่าเพดาน
    // 🐛 เดิมไม่มี "reviewed" → ใบที่ตรวจสอบแล้วรออนุมัติขั้นสุดท้ายไม่เคยโผล่ในกล่องนี้ ทั้งที่ป้ายนับไปแล้ว
    const params = mode === "inbox"
      ? { status: "pending,reviewed,approved,paid" }
      : { kind, ...(kind === "claim" && claimType !== "all" ? { claimType } : {}), ...periodRange(period) };
    // ✅ โหลดซ้ำด้วยตัวกรองเดิม (ข้อมูลเปลี่ยนจากที่อื่น/เรียลไทม์) → ไม่ขึ้นโครงโหลดทับรายการที่ดูอยู่
    const queryKey = JSON.stringify([mode, params]);
    if (queryKey !== lastQueryRef.current) setLoading(true);
    lastQueryRef.current = queryKey;
    setError("");
    ExpenseService.list(params)
      .then((r) => { if (alive) setRows(r); })
      .catch((err) => { if (alive) setError(errorText(err, "โหลดรายการไม่สำเร็จ")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [mode, kind, claimType, period, reloadKey]);

  const people = useMemo(() => {
    const map = new Map();
    rows.forEach((e) => { if (e.requester?.userId) map.set(e.requester.userId, e.requester.name); });
    return [...map.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]), "th"));
  }, [rows]);

  const base = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((e) => {
      if (person !== "all" && e.requester?.userId !== person) return false;
      if (!needle) return true;
      return [e.docNo, e.subject, e.requester?.name, e.requester?.fullName, e.job?.title, e.job?.site, e.job?.company, e.advance?.docNo, e.to,
        ...(e.items || []).map((it) => it.description), ...(e.items || []).map((it) => it.person?.name || "")]
        .some((v) => String(v || "").toLowerCase().includes(needle));
    });
  }, [rows, q, person]);

  const counts = useMemo(() => {
    const c = { all: base.length, overdue: 0 };
    base.forEach((e) => { c[e.status] = (c[e.status] || 0) + 1; if (isOverdueClear(e)) c.overdue += 1; });
    return c;
  }, [base]);

  const visible = useMemo(() => {
    if (mode === "inbox" || status === "all") return base;
    if (status === "overdue") return base.filter(isOverdueClear);
    return base.filter((e) => e.status === status);
  }, [base, status, mode]);

  /**
   * ⚠️ จอแคบ: ช่องค้นหา + ช่องเลือกช่วงเวลา + ช่องเลือกคน เรียงกัน 3 แถวกินจอไปครึ่งหนึ่งก่อนเห็นรายการแรก
   * — ย้ายสองช่องหลังไปไว้หลังปุ่ม "ตัวกรอง" (ป้ายบอกจำนวนตัวกรองที่เปิดอยู่) เหลือช่องค้นหาแถวเดียว
   */
  const activeFilters = (period !== "all" ? 1 : 0) + (person !== "all" ? 1 : 0);
  const selects = (
    <>
      {mode !== "inbox" && (
        <TextField select size="small" label="ช่วงเวลา" value={period} onChange={(ev) => setPeriod(ev.target.value)}
          sx={{ minWidth: 150, bgcolor: "#fff", "& .MuiOutlinedInput-root": { borderRadius: 2 } }}>
          {PERIODS.map((x) => <MenuItem key={x.value} value={x.value}>{x.label}</MenuItem>)}
        </TextField>
      )}
      {viewAll && people.length > 1 && (
        <TextField select size="small" label="ผู้เบิก" value={person} onChange={(ev) => setPerson(ev.target.value)}
          sx={{ minWidth: 160, bgcolor: "#fff", "& .MuiOutlinedInput-root": { borderRadius: 2 } }}>
          <MenuItem value="all">ทุกคน</MenuItem>
          {people.map(([id, name]) => <MenuItem key={id} value={id}>{name}</MenuItem>)}
        </TextField>
      )}
    </>
  );
  const hasSelects = mode !== "inbox" || (viewAll && people.length > 1);

  const filterBar = (
    <Stack direction="row" spacing={1} sx={{ mb: 1.25 }} alignItems="center">
      <TextField
        size="small" placeholder="ค้นหาเลขที่ / เรื่อง / ผู้เบิก / งาน" value={q} onChange={(ev) => setQ(ev.target.value)}
        sx={{ flex: 1, minWidth: 0, bgcolor: "#fff", "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 19, color: TEXT_SUB }} /></InputAdornment>,
          endAdornment: q ? (
            <InputAdornment position="end">
              <IconButton size="small" aria-label="ล้างคำค้นหา" onClick={() => setQ("")}><Close sx={{ fontSize: 17 }} /></IconButton>
            </InputAdornment>
          ) : null,
        }}
      />
      {hasSelects && (isDesktop ? (
        <Stack direction="row" spacing={1}>{selects}</Stack>
      ) : (
        <>
          <Button
            variant="outlined" size="medium" onClick={(ev) => setFilterAnchor(ev.currentTarget)}
            startIcon={<FilterList sx={{ fontSize: 18 }} />}
            sx={{ flexShrink: 0, textTransform: "none", fontWeight: 700, borderRadius: 2, bgcolor: "#fff", borderColor: BORDER_MAIN, color: TEXT_MAIN, px: 1.5 }}
          >
            ตัวกรอง{activeFilters ? " (" + activeFilters + ")" : ""}
          </Button>
          <Menu
            anchorEl={filterAnchor} open={Boolean(filterAnchor)} onClose={() => setFilterAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
            slotProps={{ paper: { sx: { p: 1.5, borderRadius: 2.5, minWidth: 230 } } }}
          >
            <Stack spacing={1.5}>{selects}</Stack>
          </Menu>
        </>
      ))}
    </Stack>
  );

  /**
   * ⚠️ แถวนี้อยู่ "เหนือ" ชิปสถานะเสมอ — มันเปลี่ยนว่ากำลังดูเอกสารชนิดไหน ซึ่งเป็นคำถามที่ต้องตอบก่อน
   * คำถามว่าใบอยู่ขั้นไหน (ถ้าสลับลำดับกัน คนอ่านจะนึกว่าชิปสถานะเป็นของชนิดที่เลือกอยู่แถวบน)
   */
  const claimTypeChips = kind === "claim" && onClaimTypeChange && (
    <Stack direction="row" spacing={0.75} sx={{ mb: 1.25, overflowX: "auto", pb: 0.25, "&::-webkit-scrollbar": { display: "none" } }}>
      {CLAIM_TYPE_FILTERS.map((t) => {
        const active = claimType === t.value;
        const c = t.kind ? KIND_META[t.kind].color : TEXT_MAIN;
        return (
          <Chip
            key={t.value} clickable onClick={() => onClaimTypeChange(t.value)} label={t.label}
            sx={{
              flexShrink: 0, height: 32, fontWeight: 800, fontSize: "0.8rem", borderRadius: 2,
              bgcolor: active ? alpha(c, 0.12) : "#fff", color: active ? c : TEXT_SUB,
              border: `1px solid ${active ? c : BORDER_MAIN}`,
              "&:hover": { bgcolor: alpha(c, 0.08) },
            }}
          />
        );
      })}
    </Stack>
  );

  const statusChips = kind && (
    <Stack direction="row" spacing={0.75} sx={{ mb: 1.5, overflowX: "auto", pb: 0.5, "&::-webkit-scrollbar": { display: "none" } }}>
      {["all", ...(kind === "advance" ? ["overdue"] : []), ...STATUS_FILTERS[kind]].map((s) => {
        // ⚠️ "ทุกสถานะ" ไม่ใช่ "ทั้งหมด" — หน้าใบเคลมมีแถวชิดชนิดเอกสารอยู่เหนือขึ้นไปซึ่งมีคำว่า
        // "ทั้งหมด" อยู่แล้ว ถ้าสองแถวขึ้นคำเดียวกันจะแยกไม่ออกว่าอันไหนกรองอะไร
        const st = s === "all" ? { label: "ทุกสถานะ", color: meta.color } : s === "overdue" ? { label: "เลยกำหนดเคลียร์", color: "#dc2626" } : statusMeta(s, kind);
        const n = counts[s] || 0;
        if (s !== "all" && s !== status && n === 0) return null;
        const active = status === s;
        return (
          <Chip
            key={s} clickable onClick={() => setStatus(s)}
            label={<span>{st.label} <b style={{ marginLeft: 2 }}>{n}</b></span>}
            sx={{
              flexShrink: 0, height: 30, fontWeight: 700, fontSize: "0.78rem", borderRadius: 2,
              bgcolor: active ? st.color : "#fff", color: active ? "#fff" : TEXT_MAIN,
              border: `1px solid ${active ? st.color : BORDER_MAIN}`,
              "&:hover": { bgcolor: active ? st.color : alpha(st.color, 0.08) },
            }}
          />
        );
      })}
    </Stack>
  );

  const renderRows = (list) => (isDesktop
    ? <DesktopTable rows={list} onOpen={onOpen} />
    : <Stack spacing={1}>{list.map((e) => <MobileCard key={e._id} e={e} onOpen={onOpen} />)}</Stack>);

  const empty = (text, action) => (
    <Stack alignItems="center" spacing={1.25} sx={{ py: 6, px: 2, bgcolor: "#fff", border: `1px dashed ${BORDER_MAIN}`, borderRadius: 2.5, textAlign: "center" }}>
      <Inbox sx={{ fontSize: 44, color: "#cbd5e1" }} />
      <Typography sx={{ fontWeight: 700, color: TEXT_SUB }}>{text}</Typography>
      {action}
    </Stack>
  );

  return (
    <Box sx={{ pt: 2 }}>
      {filterBar}
      {claimTypeChips}
      {statusChips}
      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
      {loading ? (
        <Stack spacing={1}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={isDesktop ? 52 : 96} />)}</Stack>
      ) : mode === "inbox" ? (
        (() => {
          const groups = INBOX_GROUPS
            .filter((g) => can(g.cap))
            .map((g) => ({ ...g, rows: base.filter(g.match) }))
            .filter((g) => g.rows.length);
          if (!groups.length) return empty("ไม่มีรายการที่รอดำเนินการ 🎉");
          return (
            <Stack spacing={2.5}>
              {groups.map((g) => (
                <Box key={g.key}>
                  <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 1 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: "0.98rem" }}>{g.title}</Typography>
                    <Chip size="small" label={g.rows.length} sx={{ height: 20, fontWeight: 800 }} />
                    <Typography variant="caption" sx={{ color: TEXT_SUB, display: { xs: "none", sm: "inline" } }}>{g.hint}</Typography>
                  </Stack>
                  {renderRows(g.rows)}
                </Box>
              ))}
            </Stack>
          );
        })()
      ) : visible.length ? (
        <>
          {renderRows(visible)}
          <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 1, textAlign: "right" }}>
            {visible.length} ใบ · รวม {baht(visible.filter((e) => e.status !== "cancelled").reduce((s, e) => s + (Number(e.total) || 0), 0))} (ไม่รวมใบที่ยกเลิก)
          </Typography>
        </>
      ) : (
        empty(
          rows.length ? "ไม่พบรายการตามตัวกรอง"
            : kind === "claim" ? (claimType === "reimburse" ? "ยังไม่มีใบสำรองจ่าย" : "ยังไม่มีใบเคลม")
              : "ยังไม่มีใบเบิก Advance",
          !rows.length && onCreate && (can("requestExpense") || viewAll) && (
            (() => {
              // ปุ่มในสถานะว่างต้องตรงกับชนิดที่กำลังกรองอยู่ ไม่ใช่เปิดฟอร์มอีกชนิดให้เสมอ
              const emptyKind = kind === "claim" && claimType === "reimburse" ? "reimburse" : kind;
              return (
                <Button variant="contained" startIcon={<Add />} onClick={() => onCreate(emptyKind)}
                  sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: KIND_META[emptyKind].color, "&:hover": { bgcolor: KIND_META[emptyKind].dark } }}>
                  ออก{KIND_META[emptyKind].label}
                </Button>
              );
            })()
          )
        )
      )}
    </Box>
  );
}
