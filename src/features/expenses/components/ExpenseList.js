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
  Box, Stack, Typography, Chip, TextField, InputAdornment, Button, Table, TableHead, TableRow,
  TableCell, TableBody, useMediaQuery, Skeleton, Alert, IconButton, Pagination, Avatar,
  ToggleButtonGroup, ToggleButton, Drawer,
} from "@mui/material";
import { Search, Add, WarningAmber, ChevronRight, Inbox, Close, Apps } from "@mui/icons-material";

import { thaiDate } from "@/shared/utils/thaiDate";
import usePermissions from "@/shared/hooks/usePermissions";
import ExpenseService, { errorText } from "../services/ExpenseService";
import KindBadge from "./KindBadge";
import StatusBadge, { STATUS_ICON } from "./StatusBadge";
import SelectField from "@/shared/ui/SelectField";
import useCloseOnPick from "@/shared/hooks/useCloseOnPick";
import ViewTiles from "@/shared/ui/ViewTiles";
import ResponsibleSummary from "@/shared/ui/ResponsibleSummary";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import { hasValidAvatar } from "@/shared/utils/user";
import {
  KIND_META, statusMeta, STATUS_FILTERS, CLAIM_TYPE_FILTERS, baht, differenceMeta, isOverdueClear, jobText, slipKind, TEXT_SUB, TEXT_MAIN, BORDER_MAIN, personFullName, installmentText, money,
} from "../expenseMeta";

const PERIODS = [
  { value: "all", label: "ทุกช่วงเวลา" },
  { value: "month", label: "เดือนนี้" },
  { value: "3m", label: "3 เดือนล่าสุด" },
  { value: "year", label: "ปีนี้" },
];

/**
 * เลขที่ "ADV-00012/2569" → [2569, 12] ใช้เรียงใหม่ → เก่า
 * ⚠️ เทียบเป็นตัวเลข ไม่ใช่ตัวอักษร — ไม่งั้น 00100 กับ 00099 และปีที่ต่างกันจะเรียงผิด
 * ใบที่ไม่มีเลขที่ (ไม่ควรมี) ไปอยู่ท้ายสุด · เลขเท่ากันต่างชุด (CLM/RMB) ใช้เวลาสร้างตัดสิน
 */
const docKey = (e) => {
  const m = String(e?.docNo || "").match(/(\d+)\/(\d{4})$/);
  return m ? [Number(m[2]), Number(m[1])] : [0, 0];
};
const byDocNoDesc = (a, b) => {
  const [ya, na] = docKey(a);
  const [yb, nb] = docKey(b);
  return (yb - ya) || (nb - na) || (new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
};

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
const StatusText = ({ e }) => (
  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0, flexWrap: "wrap", rowGap: 0.5 }}>
    <StatusBadge status={e.status} kind={slipKind(e)} />
    {isOverdueClear(e) && (
      <Box component="span" sx={{
        display: "inline-flex", alignItems: "center", gap: 0.4, height: 22, px: 0.8, borderRadius: 1.5,
        bgcolor: "#dc2626", color: "#fff", fontSize: "0.7rem", fontWeight: 800,
      }}>
        <WarningAmber sx={{ fontSize: 14 }} />เลยกำหนด
      </Box>
    )}
  </Stack>
);

/**
 * ผู้เบิก — ✅ ผู้ใช้: "เน้นดูชื่อผู้เบิก" — รูป/อักษรย่อสีประจำคน (ชุดเดียวกับหน้าภาพรวมงาน) + ชื่อตัวหนา + ตำแหน่ง
 */
const Requester = ({ e, avatars, size = 34 }) => {
  const name = personFullName(e.requester) || "-";
  return (
    <Stack direction="row" spacing={1.1} alignItems="center" sx={{ minWidth: 0 }}>
      <Avatar src={avatars?.get(String(e.requester?.userId || "")) || undefined}
        sx={{ width: size, height: size, fontSize: size * 0.42, fontWeight: 800, bgcolor: personColor(name), flexShrink: 0 }}>
        {personInitial(name)}
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography noWrap sx={{ fontWeight: 800, fontSize: "0.88rem", color: TEXT_MAIN, lineHeight: 1.3 }}>{name}</Typography>
        {e.requester?.position && (
          <Typography noWrap sx={{ fontSize: "0.72rem", color: TEXT_SUB, lineHeight: 1.3 }}>{e.requester.position}</Typography>
        )}
      </Box>
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

const MobileCard = ({ e, onOpen, avatars }) => (
  <Box onClick={() => onOpen(e._id)} role="button" sx={{
    p: 1.5, bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 3, cursor: "pointer",
    boxShadow: "0 1px 2px rgba(15,23,42,.04)", "&:active": { bgcolor: "#f8fafc" },
  }}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Box sx={{ flex: 1, minWidth: 0 }}><Requester e={e} avatars={avatars} size={32} /></Box>
      <AmountCell e={e} />
    </Stack>
    <Typography sx={{
      mt: 1, fontWeight: 600, fontSize: "0.88rem", color: TEXT_MAIN, lineHeight: 1.4,
      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
    }}>
      {e.subject}
    </Typography>
    <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 0.25 }} noWrap>
      {[e.docNo, thaiDate(e.docDate), refLabel(e)].filter(Boolean).join(" · ")}
    </Typography>
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1, pt: 1, borderTop: `1px solid ${BORDER_MAIN}` }}>
      <KindBadge kind={slipKind(e)} variant="soft" />
      <Box sx={{ flex: 1 }} />
      <StatusText e={e} />
    </Stack>
  </Box>
);

const DesktopTable = ({ rows, onOpen, avatars }) => (
  <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 3, overflowX: "auto", boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}>
    <Table size="small" sx={{ minWidth: 820, "& th": { fontWeight: 800, color: TEXT_SUB, fontSize: "0.76rem", bgcolor: "#f8fafc", whiteSpace: "nowrap" } }}>
      <TableHead>
        <TableRow>
          <TableCell>ผู้เบิก</TableCell>
          <TableCell>เลขที่ / วันที่</TableCell>
          <TableCell>เรื่อง · งาน</TableCell>
          <TableCell align="right">ยอด</TableCell>
          <TableCell>สถานะ</TableCell>
          <TableCell width={36} />
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((e) => (
          <TableRow key={e._id} hover onClick={() => onOpen(e._id)} sx={{ cursor: "pointer", "& td": { py: 1.2, borderColor: BORDER_MAIN }, "&:last-child td": { borderBottom: 0 } }}>
            <TableCell sx={{ maxWidth: 240 }}><Requester e={e} avatars={avatars} /></TableCell>
            <TableCell sx={{ whiteSpace: "nowrap" }}>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <KindBadge kind={slipKind(e)} variant="soft" />
                <Typography sx={{ fontWeight: 700, fontSize: "0.85rem", color: TEXT_MAIN }}>{e.docNo}</Typography>
              </Stack>
              <Typography variant="caption" sx={{ color: TEXT_SUB }}>{thaiDate(e.docDate)}</Typography>
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

export default function ExpenseList({
  mode, status: statusProp, claimType = "all", onClaimTypeChange, onStatusChange, onOpen, onCreate, reloadKey,
  // ✅ มือถือ: ปุ่มเปิดตัวกรองอยู่บนหัวเพจ (ExpensesPage) — แผงค้นหา/ตัวกรองเปิดเป็นแผ่นล่าง (bottom sheet)
  mobileFiltersOpen = false, onMobileFiltersClose, onActiveFiltersChange,
}) {
  const isDesktop = useMediaQuery("(min-width:900px)");
  const { can } = usePermissions();
  const viewAll = can("viewAllExpenses");
  const [searchParams] = useSearchParams();
  const kind = mode === "inbox" ? null : mode;

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
  const [avatars, setAvatars] = useState(() => new Map());
  useEffect(() => {
    if (!viewAll) return;
    ExpenseService.people()
      .then((list) => setAvatars(new Map(list.filter((u) => hasValidAvatar(u.imageUrl)).map((u) => [String(u.userId), u.imageUrl]))))
      .catch(() => {});
  }, [viewAll]);
  const [q, setQ] = useState("");
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


  const base = useMemo(() => {
    const needle = q.trim().toLowerCase();
    // ✅ เรียงตามเลขที่เอกสาร ใหม่ → เก่า (ผู้ใช้สั่ง "ยังเรียงตามเลขนะ") — ปีก่อน แล้วเลขลำดับ
    return [...rows].sort(byDocNoDesc).filter((e) => {
      if (person !== "all" && e.requester?.userId !== person) return false;
      if (!needle) return true;
      return [e.docNo, e.subject, e.requester?.name, e.requester?.fullName, e.job?.title, e.job?.site, e.job?.company, e.advance?.docNo, e.to, e.contractor?.name,
        ...(e.items || []).map((it) => it.description), ...(e.items || []).map((it) => it.person?.name || "")]
        .some((v) => String(v || "").toLowerCase().includes(needle));
    });
  }, [rows, q, person]);

  // ✅ แผง "ใบเบิกตามผู้เบิก" — นับจากคำค้นเดียวกัน แต่ไม่กรองผู้เบิก (เลือกคนหนึ่งแล้วยังเห็นของทุกคน)
  const personRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((e) => !needle || [e.docNo, e.subject, e.requester?.name, e.requester?.fullName, e.job?.title, e.job?.site, e.job?.company, e.advance?.docNo, e.contractor?.name]
        .some((v) => String(v || "").toLowerCase().includes(needle)))
      .map((e) => ({ responsiblePerson: personFullName(e.requester), userId: String(e.requester?.userId || ""), total: e.status === "cancelled" ? 0 : Number(e.total) || 0 }));
  }, [rows, q]);
  const selectedName = person === "all" ? "all" : (personRows.find((r) => r.userId === person)?.responsiblePerson || "all");
  const pickPerson = (name) => setPerson(name === "all" ? "all" : (personRows.find((r) => r.responsiblePerson === name)?.userId || "all"));
  const avatarPeople = useMemo(() => {
    const seen = new Map();
    rows.forEach((e) => { const id = String(e.requester?.userId || ""); if (avatars.get(id)) seen.set(personFullName(e.requester), avatars.get(id)); });
    return [...seen].map(([fname, imageUrl]) => ({ fname, imageUrl }));
  }, [rows, avatars]);

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
   * ✅ ผู้ใช้: "ปุ่มดูยาก สับสน รกตา" — เดิมมี 4 แถวก่อนถึงรายการ (ช่องค้นหา+select 2 ช่อง · ชิปชนิดใบ · ชิปสถานะ
   *    · และแถบตัวเลขซ้ำกับชิปสถานะอีกชุดด้านบน) → เหลือ:
   *    1. แถบตัวกรองกล่องขาวแถวเดียว (ค้นหา · ชนิดใบ · ช่วงเวลา)
   *    2. แผงผู้เบิก (หัวหน้า) — กดชื่อดูเฉพาะคนนั้น แทน select ผู้เบิก
   *    3. การ์ดสถานะ (ViewTiles) ชุดเดียวกับหน้าภาพรวมงาน — ตัวเลขตามตัวกรอง
   */
  const showPeople = mode !== "inbox" && viewAll && new Set(personRows.map((r) => r.userId)).size > 1;
  // รายชื่อผู้เบิก + จำนวนใบ — ใช้กับ select บนมือถือ (จอแคบ แผงการ์ดต้องปัดดู ผู้ใช้แจ้งว่าดูยาก)
  const personOptions = useMemo(() => {
    const m = new Map();
    personRows.forEach((r) => { if (!r.userId) return; const p = m.get(r.userId) || { id: r.userId, name: r.responsiblePerson, count: 0 }; p.count += 1; m.set(r.userId, p); });
    return [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "th"));
  }, [personRows]);

  // จำนวนตัวกรองที่เปิดอยู่ — ป้ายตัวเลขบนปุ่มตัวกรองของหัวเพจ (มือถือ)
  const activeFilterCount = (q.trim() ? 1 : 0) + (person !== "all" ? 1 : 0) + (period !== "all" ? 1 : 0) + (kind === "claim" && claimType !== "all" ? 1 : 0)
    + (kind && status !== "all" ? 1 : 0);
  const statusLabel = status === "overdue" ? "เลยกำหนดเคลียร์" : kind && status !== "all" ? String(statusMeta(status, kind).label).split(" · ")[0] : "";
  useEffect(() => { onActiveFiltersChange?.(activeFilterCount); }, [activeFilterCount]); // eslint-disable-line react-hooks/exhaustive-deps
  // ✅ มือถือ: เลือกสถานะ/ผู้เบิก/ช่วงเวลา/ชนิดใบแล้วปิดแผ่นทันที (ช่องค้นหาไม่ปิด — ยังพิมพ์อยู่)
  useCloseOnPick(mobileFiltersOpen, () => onMobileFiltersClose?.(), { status, person, period, claimType });

  const filterBar = (
    <Stack
      direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}
      sx={isDesktop
        ? { mb: 1.5, p: 1, bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 3, boxShadow: "0 1px 2px rgba(15,23,42,.04)" }
        : { "& > *": { width: "100%" } }}
    >
      <TextField
        size="small" placeholder="ค้นหาเลขที่ / เรื่อง / ผู้เบิก / งาน" value={q} onChange={(ev) => setQ(ev.target.value)}
        sx={{
          flex: 1, minWidth: 0,
          "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: "#f8fafc", height: 40, "& fieldset": { borderColor: "transparent" }, "&:hover fieldset": { borderColor: BORDER_MAIN }, "&.Mui-focused": { bgcolor: "#fff" } },
        }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 19, color: TEXT_SUB }} /></InputAdornment>,
          endAdornment: q ? (
            <InputAdornment position="end">
              <IconButton size="small" aria-label="ล้างคำค้นหา" onClick={() => setQ("")}><Close sx={{ fontSize: 17 }} /></IconButton>
            </InputAdornment>
          ) : null,
        }}
      />
      {/* ⚠️ มือถือ: ห่อบรรทัด — ปุ่มชนิดใบเคลมเต็มแถว แล้ว select ผู้เบิก/ช่วงเวลาแบ่งครึ่งแถวถัดไป (เดิมล้นจอ) */}
      <Stack direction="row" spacing={1} useFlexGap alignItems="center" sx={{ minWidth: 0, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        {/* ชนิดใบเคลม — ปุ่มแบ่งส่วนในแถวเดียวกัน (เดิมเป็นชิปอีกแถวแยก) */}
        {kind === "claim" && onClaimTypeChange && (
          <ToggleButtonGroup
            size="small" exclusive value={claimType} onChange={(_, v) => v && onClaimTypeChange(v)}
            sx={{
              flex: { xs: "1 1 100%", md: "0 0 auto" }, minWidth: { xs: 0, md: "auto" }, bgcolor: "#f1f5f9", p: 0.4, gap: 0.4, borderRadius: 2.5, height: 40,
              "& .MuiToggleButton-root": {
                flex: { xs: 1, md: "0 0 auto" }, border: "0 !important", m: "0 !important", borderRadius: "8px !important", textTransform: "none", fontWeight: 700, fontSize: "0.8rem",
                color: TEXT_SUB, px: { xs: 0.75, md: 1.75 }, whiteSpace: "nowrap", minWidth: { xs: 0, md: "auto" },
                "&:hover": { bgcolor: "rgba(255,255,255,.6)" },
                "&.Mui-selected": { bgcolor: "#fff", color: TEXT_MAIN, boxShadow: "0 1px 3px rgba(15,23,42,.12)" },
                "&.Mui-selected:hover": { bgcolor: "#fff" },
              },
            }}
          >
            {CLAIM_TYPE_FILTERS.map((t) => <ToggleButton key={t.value} value={t.value}>{t.label}</ToggleButton>)}
          </ToggleButtonGroup>
        )}
        {/* ✅ มือถือ: ผู้เบิกเป็น select (แผงการ์ดใช้บนจอใหญ่เท่านั้น) */}
        {showPeople && !isDesktop && (
          <SelectField label="ผู้เบิก" value={person} onChange={(ev) => setPerson(ev.target.value)} sx={{ minWidth: 0, flex: "1 1 0" }}>
            <option value="all">ทุกคน ({personRows.length})</option>
            {personOptions.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.count})</option>)}
          </SelectField>
        )}
        {mode !== "inbox" && (
          <SelectField label="ช่วงเวลา" value={period} onChange={(ev) => setPeriod(ev.target.value)} sx={{ minWidth: { xs: 0, md: 150 }, flex: { xs: "1 1 0", md: "none" } }}>
            {PERIODS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </SelectField>
        )}
      </Stack>
    </Stack>
  );

  const peoplePanel = showPeople && isDesktop && (
    <ResponsibleSummary
      rows={personRows}
      unit="ใบ"
      value={selectedName}
      onChange={pickPerson}
      employees={avatarPeople}
      isMobile={!isDesktop}
      title="ใบเบิกตามผู้เบิก"
      hint="กดที่ชื่อเพื่อดูเฉพาะใบของคนนั้น · กดซ้ำเพื่อดูทุกคน · ยอดเงิน = ยอดรวมในใบ (ไม่รวมใบที่ยกเลิก)"
      amountOf={(r) => r.total}
      formatAmount={baht}
    />
  );

  // สถานะ: ทั้งหมด + สถานะที่มีใบ (ตัวที่เลือกอยู่แสดงเสมอแม้เป็น 0)
  const statusTiles = kind && (() => {
    const keys = ["all", ...(kind === "advance" ? ["overdue"] : []), ...STATUS_FILTERS[kind]]
      .filter((s) => s === "all" || s === status || (counts[s] || 0) > 0);
    const items = keys.map((s) => {
      if (s === "all") return { value: "all", label: "ทุกสถานะ", count: counts.all || 0, unit: "ใบ", icon: <Apps />, color: "#475569" };
      if (s === "overdue") return { value: "overdue", label: "เลยกำหนดเคลียร์", shortLabel: "เลยกำหนด", count: counts.overdue || 0, unit: "ใบ", icon: <WarningAmber />, color: "#dc2626", alert: true };
      const st = statusMeta(s, kind);
      const Icon = STATUS_ICON[s] || Apps;
      return { value: s, label: st.label, shortLabel: String(st.label).split(" · ")[0], count: counts[s] || 0, unit: "ใบ", icon: <Icon />, color: st.color, alert: s === "rejected" };
    });
    return <ViewTiles value={status} onChange={setStatus} isMobile={!isDesktop} groups={[{ title: "", items }]} />;
  })();

  const renderRows = (list) => (isDesktop
    ? <DesktopTable rows={list} onOpen={onOpen} avatars={avatars} />
    : <Stack spacing={1}>{list.map((e) => <MobileCard key={e._id} e={e} onOpen={onOpen} avatars={avatars} />)}</Stack>);

  const empty = (text, action) => (
    <Stack alignItems="center" spacing={1.25} sx={{ py: 6, px: 2, bgcolor: "#fff", border: `1px dashed ${BORDER_MAIN}`, borderRadius: 2.5, textAlign: "center" }}>
      <Inbox sx={{ fontSize: 44, color: "#cbd5e1" }} />
      <Typography sx={{ fontWeight: 700, color: TEXT_SUB }}>{text}</Typography>
      {action}
    </Stack>
  );

  return (
    <Box ref={topRef} sx={{ pt: 2, scrollMarginTop: 72 }}>
      {isDesktop ? filterBar : (
        <>
          {/* ── มือถือ: ตัวกรองที่เปิดอยู่เป็นชิปกดลบได้ (แผงเต็มอยู่ในแผ่นล่าง เปิดจากปุ่มบนหัวเพจ) ── */}
          {activeFilterCount > 0 && (
            <Stack direction="row" spacing={0.75} useFlexGap sx={{ mb: 1.25, flexWrap: "wrap" }}>
              {statusLabel && <Chip size="small" label={`สถานะ: ${statusLabel}`} onDelete={() => setStatus("all")} sx={{ fontWeight: 700 }} />}
              {q.trim() && <Chip size="small" label={`ค้นหา: ${q.trim()}`} onDelete={() => setQ("")} sx={{ fontWeight: 700, maxWidth: "100%" }} />}
              {person !== "all" && <Chip size="small" label={`ผู้เบิก: ${selectedName === "all" ? "-" : selectedName}`} onDelete={() => setPerson("all")} sx={{ fontWeight: 700 }} />}
              {period !== "all" && <Chip size="small" label={PERIODS.find((x) => x.value === period)?.label} onDelete={() => setPeriod("all")} sx={{ fontWeight: 700 }} />}
              {kind === "claim" && claimType !== "all" && onClaimTypeChange && (
                <Chip size="small" label={CLAIM_TYPE_FILTERS.find((x) => x.value === claimType)?.label} onDelete={() => onClaimTypeChange("all")} sx={{ fontWeight: 700 }} />
              )}
            </Stack>
          )}
          <Drawer
            anchor="bottom" open={mobileFiltersOpen} onClose={() => onMobileFiltersClose?.()}
            PaperProps={{ sx: { borderTopLeftRadius: 18, borderTopRightRadius: 18, px: 2, pt: 1, pb: "calc(16px + env(safe-area-inset-bottom))", maxHeight: "85vh" } }}
          >
            <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: "#cbd5e1", mx: "auto", mb: 1.25 }} />
            <Stack direction="row" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography sx={{ flex: 1, fontWeight: 800, fontSize: "1rem", color: TEXT_MAIN }}>ค้นหาและตัวกรอง</Typography>
              {activeFilterCount > 0 && (
                <Button size="small" onClick={() => { setQ(""); setPerson("all"); setPeriod("all"); setStatus("all"); if (kind === "claim") onClaimTypeChange?.("all"); }}
                  sx={{ textTransform: "none", fontWeight: 700, color: "#dc2626" }}>
                  ล้างทั้งหมด
                </Button>
              )}
              <IconButton size="small" aria-label="ปิด" onClick={() => onMobileFiltersClose?.()}><Close /></IconButton>
            </Stack>
            {filterBar}
            {/* ✅ สถานะ — อยู่ในแผ่นเดียวกับตัวกรอง (ผู้ใช้ขอ) ไม่กินจอเหนือรายการ */}
            {statusTiles && (
              <Box sx={{ mt: 1.75, "& > div": { mb: 0 } }}>
                <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: TEXT_SUB, mb: 0.75 }}>สถานะ</Typography>
                {statusTiles}
              </Box>
            )}
            <Button
              fullWidth variant="contained" onClick={() => onMobileFiltersClose?.()}
              sx={{ mt: 2, py: 1.1, textTransform: "none", fontWeight: 800, borderRadius: 2.5, boxShadow: "none", bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8", boxShadow: "none" } }}
            >
              ดูผลลัพธ์ {visible.length.toLocaleString()} ใบ
            </Button>
          </Drawer>
        </>
      )}
      {peoplePanel}
      {isDesktop && statusTiles}
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
                sx={{ "& .Mui-selected": { bgcolor: "#eff6ff !important", color: "#1d4ed8", borderColor: "#bfdbfe" } }} />
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
