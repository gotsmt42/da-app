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
  TableCell, TableBody, useMediaQuery, Skeleton, Alert, IconButton, Menu, Pagination,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Search, Add, WarningAmber, ChevronRight, Inbox, FilterList, Close } from "@mui/icons-material";

import { thaiDate } from "@/shared/utils/thaiDate";
import usePermissions from "@/shared/hooks/usePermissions";
import ExpenseService, { errorText } from "../services/ExpenseService";
import KindBadge from "./KindBadge";
import {
  KIND_META, statusMeta, STATUS_FILTERS, CLAIM_TYPE_FILTERS, baht, differenceMeta, isOverdueClear, jobText, slipKind, TEXT_SUB, TEXT_MAIN, BORDER_MAIN, personFullName, installmentText, money,
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
  { key: "settle", cap: "disburseExpense", title: "รออนุมัติเบิกจ่าย · ส่วนต่างใบเคลม", hint: "ขั้นที่ 3 จาก 3 — จ่ายส่วนต่างเพิ่ม / ยืนยันรับเงินคืน", match: (e) => slipKind(e) === "claim" && e.status === "approved" },
  // ⚠️ คนละงานกับข้างบน — ใบสำรองจ่ายคือพนักงานควักเงินตัวเองรออยู่ ไม่ใช่การปิดส่วนต่างของเงินที่จ่ายไปแล้ว
  { key: "reimburse", cap: "disburseExpense", title: "รออนุมัติเบิกจ่าย · คืนค่าสำรองจ่าย", hint: "ขั้นที่ 3 จาก 3 — อนุมัติแล้ว รอโอนคืนให้ผู้เบิก", match: (e) => slipKind(e) === "reimburse" && e.status === "approved" },
  // ✅ เงินออกไปหาคนนอก (ผู้รับเหมา) — แยกกลุ่มให้ผู้อนุมัติเบิกจ่ายเห็นชัดว่าเป็นค่าจ้าง ไม่ใช่เงินพนักงาน
  { key: "contractor", cap: "disburseExpense", title: "รออนุมัติเบิกจ่าย · ค่าจ้างผู้รับเหมา", hint: "ขั้นที่ 3 จาก 3 — อนุมัติแล้ว รอโอนยอดสุทธิให้ผู้รับเหมา", match: (e) => slipKind(e) === "contractor" && e.status === "approved" },
  { key: "overdue", cap: "viewAllExpenses", title: "Advance เลยกำหนดเคลียร์", hint: "จ่ายเงินไปแล้วแต่ยังไม่ส่งใบเคลม", match: (e) => isOverdueClear(e) },
];

/**
 * ข้อความอ้างอิงใต้เลขที่ใบ — ใบเคลมบอกว่าเคลียร์ใบไหน · ใบสำรองจ่ายบอกว่า "ไม่มี Advance"
 * ⚠️ ใบสำรองจ่ายต้องบอกให้ชัดว่าไม่มีใบอ้างอิง ไม่ใช่ปล่อยว่าง — ว่างไว้จะดูเหมือนข้อมูลหาย
 */
const refLabel = (e) => {
  // ⚠️ ใบสำรองจ่ายมีป้ายชนิดใบบอกอยู่แล้ว — ไม่ต้องพูดซ้ำในบรรทัดรอง (ผู้ใช้แจ้งว่ารกตา)
  if (slipKind(e) === "reimburse") return "";
  if (slipKind(e) === "contractor") return [e.contractor?.name, installmentText(e.installment)].filter(Boolean).join(" · ");
  if (e.kind === "claim" && e.advance?.docNo) return `อ้าง ${e.advance.docNo}`;
  return "";
};

/**
 * สถานะแบบ "จุดสี + ข้อความ" — ✅ ผู้ใช้แจ้ง "สีสันรกตาเกินไป ทำให้มองง่าย ใช้ง่าย"
 * เดิมเป็นชิปพื้นสีทุกแถว บวกแถบซ้ายสี + ป้ายทึบ + เลขที่สี + ยอดส่วนต่างสี = 4–5 สีต่อการ์ดเดียว
 * ตอนนี้แต่ละแถวเหลือสีแค่ 2 จุดเล็ก (ป้ายชนิดใบแบบอ่อน + จุดสถานะ) ที่เหลือเป็นขาว-ดำ-เทา
 */
const StatusText = ({ e }) => {
  const st = statusMeta(e.status, slipKind(e));
  return (
    <Stack direction="row" spacing={0.6} alignItems="center" sx={{ minWidth: 0 }}>
      <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: st.color, flexShrink: 0 }} />
      <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: TEXT_MAIN }} noWrap>{st.label}</Typography>
      {isOverdueClear(e) && (
        <Typography sx={{ fontSize: "0.74rem", fontWeight: 800, color: "#dc2626", display: "inline-flex", alignItems: "center", gap: 0.25 }} noWrap>
          <WarningAmber sx={{ fontSize: 14 }} />เลยกำหนด
        </Typography>
      )}
    </Stack>
  );
};

/** บรรทัดเล็กใต้ยอด — บอกเฉพาะเมื่อมีข้อมูลที่ยอดรวมไม่ได้บอก (ส่วนต่างใบเคลม / ยอดสุทธิผู้รับเหมา) */
const amountNote = (e) => {
  const kind = slipKind(e);
  if (kind === "contractor") return money(e.difference) !== money(e.total) ? `สุทธิ ${baht(e.difference)}` : "";
  if (kind !== "claim") return "";
  const d = differenceMeta(e.difference, kind);
  return d.amount ? `${d.short} ${baht(d.amount)}` : "";
};

const AmountCell = ({ e }) => (
  <Box sx={{ textAlign: "right", flexShrink: 0 }}>
    <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", color: TEXT_MAIN, whiteSpace: "nowrap" }}>{baht(e.total)}</Typography>
    {amountNote(e) && <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 600, whiteSpace: "nowrap" }}>{amountNote(e)}</Typography>}
  </Box>
);

const MobileCard = ({ e, onOpen }) => (
  <Box onClick={() => onOpen(e._id)} role="button" sx={{
    p: 1.5, bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 2.5, cursor: "pointer",
    "&:active": { bgcolor: "#f8fafc" },
  }}>
    <Stack direction="row" spacing={1.25} alignItems="flex-start">
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* เรื่องคือสิ่งที่คนหา — ตัวหนาบรรทัดแรก (ยาวได้ 2 บรรทัด) */}
        <Typography sx={{
          fontWeight: 700, fontSize: "0.93rem", color: TEXT_MAIN, lineHeight: 1.4,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {e.subject}
        </Typography>
        <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 0.25 }} noWrap>
          {[e.docNo, thaiDate(e.docDate), personFullName(e.requester), refLabel(e)].filter(Boolean).join(" · ")}
        </Typography>
      </Box>
      <AmountCell e={e} />
    </Stack>
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
      <KindBadge kind={slipKind(e)} variant="soft" />
      <StatusText e={e} />
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
            <TableCell sx={{ whiteSpace: "nowrap" }}>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <KindBadge kind={slipKind(e)} variant="soft" />
                <Typography sx={{ fontWeight: 700, fontSize: "0.85rem", color: TEXT_MAIN }}>{e.docNo}</Typography>
              </Stack>
              <Typography variant="caption" sx={{ color: TEXT_SUB }}>{thaiDate(e.docDate)}</Typography>
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
            <TableCell><StatusText e={e} /></TableCell>
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
    // ⚠️ หน้าใบเคลม "ทั้งหมด" = ใบของพนักงาน (staff) — ใบค่าจ้างผู้รับเหมาอยู่หน้าของตัวเอง ไม่ปนเข้ามา
    const params = mode === "inbox"
      ? { status: "pending,reviewed,approved,paid" }
      : kind === "contractor"
        ? { kind: "claim", claimType: "contractor", ...periodRange(period) }
        : { kind, ...(kind === "claim" ? { claimType: claimType !== "all" ? claimType : "staff" } : {}), ...periodRange(period) };
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
      return [e.docNo, e.subject, e.requester?.name, e.requester?.fullName, e.job?.title, e.job?.site, e.job?.company, e.advance?.docNo, e.to, e.contractor?.name,
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
   * ✅ แบ่งหน้า 10 ใบต่อหน้า (ผู้ใช้สั่ง) — รายการยาวเลื่อนหาไม่ไหว โดยเฉพาะบนมือถือ
   * ⚠️ เปลี่ยนตัวกรอง/คำค้น/ชนิดใบ = กลับไปหน้า 1 เสมอ ไม่งั้นค้างอยู่หน้าที่ไม่มีข้อมูลแล้วดูเหมือนว่างเปล่า
   */
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [status, q, person, period, claimType, mode]);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const curPage = Math.min(page, pageCount);
  const pageRows = visible.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);
  const topRef = useRef(null);
  const goPage = (n) => {
    setPage(n);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
        // ✅ ตัวเลือกที่เลือกอยู่ = พื้นเทาเข้ม ตัวขาว (สีเดียวทั้งแอป) — ไม่ใช้สีประจำชนิดใบ ลดสีที่แย่งสายตา
        const c = "#334155";
        return (
          <Chip
            key={t.value} clickable onClick={() => onClaimTypeChange(t.value)} label={t.label}
            sx={{
              flexShrink: 0, height: 32, fontWeight: 800, fontSize: "0.8rem", borderRadius: 2,
              bgcolor: active ? c : "#fff", color: active ? "#fff" : TEXT_SUB,
              border: `1px solid ${active ? c : BORDER_MAIN}`,
              "&:hover": { bgcolor: active ? c : alpha(c, 0.06) },
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
        const dark = "#334155";
        return (
          <Chip
            key={s} clickable onClick={() => setStatus(s)}
            label={(
              <Stack direction="row" spacing={0.6} alignItems="center" component="span">
                {s !== "all" && <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: active ? "#fff" : st.color }} />}
                <span>{st.label} <b style={{ marginLeft: 2 }}>{n}</b></span>
              </Stack>
            )}
            sx={{
              flexShrink: 0, height: 30, fontWeight: 700, fontSize: "0.78rem", borderRadius: 2,
              bgcolor: active ? dark : "#fff", color: active ? "#fff" : TEXT_MAIN,
              border: `1px solid ${active ? dark : BORDER_MAIN}`,
              "&:hover": { bgcolor: active ? dark : alpha(dark, 0.06) },
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
    <Box ref={topRef} sx={{ pt: 2, scrollMarginTop: 72 }}>
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
          {renderRows(pageRows)}
          {pageCount > 1 && (
            <Stack alignItems="center" sx={{ mt: 1.5 }}>
              <Pagination count={pageCount} page={curPage} onChange={(_, n) => goPage(n)} shape="rounded" size={isDesktop ? "medium" : "small"}
                siblingCount={isDesktop ? 1 : 0}
                sx={{ "& .Mui-selected": { bgcolor: "#334155 !important", color: "#fff" } }} />
            </Stack>
          )}
          <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 1, textAlign: "right" }}>
            {pageCount > 1 ? `แสดง ${(curPage - 1) * PAGE_SIZE + 1}–${(curPage - 1) * PAGE_SIZE + pageRows.length} จาก ` : ""}{visible.length} ใบ · รวม {baht(visible.filter((e) => e.status !== "cancelled").reduce((s, e) => s + (Number(e.total) || 0), 0))} (ไม่รวมใบที่ยกเลิก)
          </Typography>
        </>
      ) : (
        empty(
          rows.length ? "ไม่พบรายการตามตัวกรอง"
            : kind === "contractor" ? "ยังไม่มีใบเบิกค่าจ้างผู้รับเหมา"
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
