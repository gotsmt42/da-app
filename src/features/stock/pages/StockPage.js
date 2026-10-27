/**
 * StockPage — สต๊อก · ทรัพย์สินแผนก (/stock?tab=items|requests|loans|moves&id=<ใบเบิก>)
 *
 * ✅ (27 ต.ค. 2569 ผู้ใช้: "ทำระบบสต๊อกสินค้าแผนก ต้องให้กรอกใบเบิกเพื่อขอเบิก และตัดยอดออกจากข้อมูล realtime
 *    ทำให้สมบูรณ์ สวยงาม และใช้งานง่าย" · "หรือเป็นทรัพย์สินแผนก")
 *   คงคลัง   — ยอดเบิกได้สดๆ ทุกเครื่อง (เรียลไทม์หมวด "stock") · กด “เบิก” ที่การ์ดได้ทันที
 *   ใบเบิก   — ของฉัน (ผู้ดูแลคลังเห็นทั้งแผนก + คิวรออนุมัติ)
 *   ยืมอยู่  — ทรัพย์สินที่ยังไม่คืน
 *   ประวัติ  — ทุกการเปลี่ยนยอด (รับเข้า · เบิกจ่าย · ยืม · คืน · ตรวจนับ)
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import {
  Box, Stack, Typography, Button, TextField, InputAdornment, Skeleton, Alert, IconButton, ButtonBase, Avatar, Menu, MenuItem, ListItemIcon,
  useMediaQuery, Snackbar, Table, TableHead, TableRow, TableCell, TableBody,
} from "@mui/material";
import {
  Add, Search, Close, Inventory2, AddBox, FactCheck, Edit, Apps, WarningAmber, Handyman, Category, Outbox, MoreHoriz, FileDownload,
} from "@mui/icons-material";

import usePermissions from "@/shared/hooks/usePermissions";
import useRealtime from "@/shared/realtime/useRealtime";
import { refreshAppBadges } from "@/shared/hooks/useAppBadges";
import { useAuth } from "@/features/auth/AuthContext";
import ViewTiles from "@/shared/ui/ViewTiles";
import JobTypeChip from "@/shared/ui/JobTypeChip";
import { PAGE_SX } from "@/shared/ui/PageKit";
import { thaiDate, thaiDateTime } from "@/shared/utils/thaiDate";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import StockService, { errorText } from "../services/StockService";
import {
  STOCK_ACCENT, STOCK_DARK, TEXT_MAIN, TEXT_SUB, BORDER_MAIN, KINDS, REQ_ORDER, MOVE_TYPES, reqStatus,
  available, isLow, isOut, outstanding, fmt, jobOf,
} from "../stockMeta";
import { ReqBadge, Thumb } from "../components/StockBits";
import { ItemFormDialog, AdjustDialog } from "../components/ItemDialogs";
import StockRequestForm from "../components/StockRequestForm";
import StockRequestDetail from "../components/StockRequestDetail";

const TABS = ["items", "requests", "loans", "moves"];
const CARD = { bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 3 };

const Empty = ({ icon, text }) => (
  <Stack alignItems="center" spacing={1} sx={{ py: 6, bgcolor: "#fff", border: `1px dashed ${BORDER_MAIN}`, borderRadius: 2.5 }}>
    <Box sx={{ color: "#cbd5e1", "& svg": { fontSize: 42 } }}>{icon}</Box>
    <Typography sx={{ color: TEXT_SUB, fontWeight: 700, textAlign: "center", px: 2 }}>{text}</Typography>
  </Stack>
);

/**
 * 🎨 (27 ต.ค. 2569 ผู้ใช้: "ทำ ux ui และปุ่มต่างๆให้ชัดเจน ดูง่าย และทันสมัยขึ้น")
 * ปุ่มจัดการมีชื่อกำกับทุกปุ่ม (เดิมเป็นไอคอนสีล้วน เดาไม่ออกว่าปุ่มไหนทำอะไร) · พื้นสีอ่อนตามความหมาย
 */
/** ปุ่มรองในแถว — โทนเทาเรียบเหมือนกันหมด (ผู้ใช้: "สีสันปุ่มดูเยอะ และรกเกินไป ไม่มืออาชีพ") */
const QUIET = { textTransform: "none", fontWeight: 700, borderRadius: 2, whiteSpace: "nowrap", color: "#334155", borderColor: "#e2e8f0", bgcolor: "#fff",
  "&:hover": { borderColor: "#cbd5e1", bgcolor: "#f8fafc" } };

/**
 * 🎨 (27 ต.ค. 2569 ผู้ใช้: "หน้าคอมทำแยกปุ่มแบบเดิม แยกสีปุ่มด้วย" · "แบบเมนูจืดชืดไป")
 * จอกว้าง: ปุ่มแยกกันครบ — พื้นขาวขอบบาง สีอยู่ที่ไอคอน+ขอบตอนชี้ (แยกความหมายชัด แต่ไม่ฉูดฉาด)
 * ปุ่มหลัก "เบิก/ยืม" ทึบสีประจำระบบปุ่มเดียวต่อแถว
 */
const ToneBtn = ({ icon, label, tone, onClick }) => (
  <Button size="small" variant="outlined" onClick={onClick} startIcon={icon}
    sx={{ ...QUIET, px: 1.25, "& .MuiButton-startIcon": { mr: 0.5, color: tone, "& svg": { fontSize: 18 } },
      "&:hover": { borderColor: tone, bgcolor: `${tone}0d`, color: tone } }}>
    {label}
  </Button>
);
const ManageBtns = ({ it, onAdjust, onEdit }) => (
  <>
    <ToneBtn icon={<AddBox />} label="รับเข้า" tone="#16a34a" onClick={() => onAdjust(it, "in")} />
    <ToneBtn icon={<FactCheck />} label="ตรวจนับ" tone="#d97706" onClick={() => onAdjust(it, "count")} />
    <ToneBtn icon={<Edit />} label="แก้ไข" tone="#2563eb" onClick={() => onEdit(it)} />
  </>
);
const RequestBtn = ({ it, onRequest }) => {
  const ok = available(it) > 0 && it.active !== false;
  return (
    <Button size="small" variant="contained" disabled={!ok} onClick={() => onRequest(it)}
      startIcon={it.kind === "asset" ? <Handyman /> : <Outbox />}
      sx={{ minWidth: 84, textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", whiteSpace: "nowrap",
        bgcolor: STOCK_ACCENT, "&:hover": { bgcolor: STOCK_DARK, boxShadow: "none" }, "&.Mui-disabled": { bgcolor: "#f1f5f9", color: "#94a3b8" } }}>
      {!ok ? (it.active === false ? "ปิดใช้งาน" : "หมด") : it.kind === "asset" ? "ยืม" : "เบิก"}
    </Button>
  );
};

/** มือถือ: ปุ่มจัดการพับเข้าเมนู “จัดการ” (ผู้ใช้: "จอมือถือยังดูรกๆ") — เหลือปุ่มหลักปุ่มเดียวบนการ์ด */
const ManageMenu = ({ it, onAdjust, onEdit }) => {
  const [anchor, setAnchor] = useState(null);
  const pick = (fn) => { setAnchor(null); fn(); };
  return (
    <>
      <Button size="small" variant="outlined" onClick={(e) => setAnchor(e.currentTarget)} endIcon={<MoreHoriz />} sx={QUIET}>
        จัดการ
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} PaperProps={{ sx: { borderRadius: 2.5, minWidth: 190 } }}>
        <MenuItem onClick={() => pick(() => onAdjust(it, "in"))}><ListItemIcon sx={{ color: "#16a34a" }}><AddBox fontSize="small" /></ListItemIcon>รับเข้าคลัง</MenuItem>
        <MenuItem onClick={() => pick(() => onAdjust(it, "count"))}><ListItemIcon sx={{ color: "#d97706" }}><FactCheck fontSize="small" /></ListItemIcon>ตรวจนับ / ปรับยอด</MenuItem>
        <MenuItem onClick={() => pick(() => onEdit(it))}><ListItemIcon sx={{ color: "#2563eb" }}><Edit fontSize="small" /></ListItemIcon>แก้ไขรายละเอียด</MenuItem>
      </Menu>
    </>
  );
};

/** ป้ายสถานะยอด — ใช้ทั้งการ์ดและตาราง */
const StockState = ({ it }) => {
  const out = isOut(it);
  const low = isLow(it);
  if (it.active === false) return <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 800 }}>ปิดใช้งาน</Typography>;
  const tone = out ? "#dc2626" : low ? "#d97706" : "#16a34a";
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 1, height: 24, borderRadius: 99, fontSize: "0.72rem", fontWeight: 800, whiteSpace: "nowrap",
      bgcolor: out ? "#fee2e2" : low ? "#fef3c7" : "#dcfce7", color: tone }}>
      <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: tone }} />
      {out ? "หมด" : low ? `ใกล้หมด (ต่ำกว่า ${fmt(it.minQty)})` : "พร้อมเบิก"}
    </Box>
  );
};


/** การ์ดสินค้า (มือถือ/แท็บเล็ต) — 3 ชั้นชัดๆ: ชื่อ + ยอดเบิกได้ · สถานะ · ปุ่ม */
const ItemCard = ({ it, canManage, onRequest, onAdjust, onEdit }) => {
  const av = available(it);
  const tone = isOut(it) ? "#dc2626" : isLow(it) ? "#d97706" : "#16a34a";
  const meta = [it.code, it.category, it.location].filter(Boolean).join(" · ");
  return (
    <Box sx={{ ...CARD, p: 1.5, display: "flex", flexDirection: "column", gap: 1.25, opacity: it.active === false ? 0.55 : 1 }}>
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Thumb item={it} size={52} radius={2.5} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", color: TEXT_MAIN, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {it.name}
          </Typography>
          <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }} noWrap>{meta}</Typography>
        </Box>
        <Box sx={{ textAlign: "right", flexShrink: 0, pl: 0.5 }}>
          <Typography sx={{ fontWeight: 900, fontSize: "1.5rem", lineHeight: 1, color: tone }}>{fmt(av)}</Typography>
          <Typography sx={{ fontSize: "0.7rem", color: TEXT_SUB, fontWeight: 700, mt: 0.25 }}>{it.unit}</Typography>
        </Box>
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
        <StockState it={it} />
        <Typography variant="caption" sx={{ color: TEXT_SUB }}>
          ในคลัง {fmt(it.qty)}{it.reserved > 0 ? ` · จอง ${fmt(it.reserved)}` : ""}{it.kind === "asset" && it.onLoan > 0 ? ` · ยืมออก ${fmt(it.onLoan)}` : ""}
        </Typography>
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center">
        {canManage && <ManageMenu it={it} onAdjust={onAdjust} onEdit={onEdit} />}
        <Box sx={{ flex: 1 }} />
        <RequestBtn it={it} onRequest={onRequest} />
      </Stack>
    </Box>
  );
};

/** ตัวกรองแบบแถบเลื่อนแถวเดียว (มือถือ) — แทนกล่อง 2×2 ที่กินที่ */
const FilterPills = ({ value, onChange, items }) => (
  <Stack direction="row" spacing={0.75} sx={{ mb: 1.25, overflowX: "auto", pb: 0.25, mx: -0.25, px: 0.25, "&::-webkit-scrollbar": { display: "none" }, scrollbarWidth: "none" }}>
    {items.map((o) => {
      const on = value === o.value;
      return (
        <ButtonBase key={o.value} onClick={() => onChange(o.value)}
          sx={{ flexShrink: 0, gap: 0.6, px: 1.25, height: 34, borderRadius: 99, fontFamily: "inherit", fontSize: "0.82rem", fontWeight: on ? 800 : 600,
            border: `1px solid ${on ? TEXT_MAIN : BORDER_MAIN}`, bgcolor: on ? TEXT_MAIN : "#fff", color: on ? "#fff" : TEXT_MAIN }}>
          {o.label}
          <Box component="span" sx={{ minWidth: 18, height: 18, px: 0.5, borderRadius: 99, fontSize: "0.7rem", fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center",
            bgcolor: o.alert && o.count ? "#dc2626" : on ? "rgba(255,255,255,.2)" : "#f1f5f9", color: o.alert && o.count ? "#fff" : on ? "#fff" : TEXT_SUB }}>{o.count}</Box>
        </ButtonBase>
      );
    })}
  </Stack>
);

/** 🎨 (27 ต.ค. 2569 ผู้ใช้: "ทำให้เป็นรูปแบบตาราง ให้สวยงามในคอม ดูง่าย") — จอกว้างใช้ตาราง · มือถือยังเป็นการ์ด */
const TABLE_SX = {
  "& th": { fontWeight: 800, color: TEXT_SUB, fontSize: "0.76rem", bgcolor: "#f8fafc", whiteSpace: "nowrap", py: 1.1, borderColor: BORDER_MAIN },
  "& td": { borderColor: BORDER_MAIN, py: 1.25, fontSize: "0.86rem" },
  "& tbody tr:hover td": { bgcolor: "#fafaf9" },
  "& tbody tr:last-of-type td": { borderBottom: 0 },
};
const Num = ({ v, color }) => (
  <Typography component="span" sx={{ fontWeight: 600, fontSize: "0.86rem", color: v ? (color || TEXT_MAIN) : "#cbd5e1" }}>{v ? fmt(v) : "—"}</Typography>
);

const ItemTable = ({ rows, canManage, onRequest, onAdjust, onEdit }) => (
  <Box sx={{ ...CARD, overflowX: "auto" }}>
    <Table size="small" sx={{ minWidth: 900, ...TABLE_SX }}>
      <TableHead>
        <TableRow>
          <TableCell>สินค้า / ทรัพย์สิน</TableCell><TableCell>หมวดหมู่</TableCell><TableCell>ที่เก็บ</TableCell>
          <TableCell align="right">ในคลัง</TableCell><TableCell align="right">จองไว้</TableCell><TableCell align="right">ยืมออก</TableCell>
          <TableCell align="right">เบิกได้</TableCell><TableCell>สถานะ</TableCell><TableCell align="right">{canManage ? "จัดการ" : ""}</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((it) => {
          const av = available(it);
          const out = isOut(it);
          const low = isLow(it);
          const tone = out ? "#dc2626" : low ? "#d97706" : "#16a34a";
          return (
            <TableRow key={it._id} hover sx={{ opacity: it.active === false ? 0.55 : 1 }}>
              <TableCell sx={{ minWidth: 240 }}>
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Thumb item={it} size={40} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", color: TEXT_MAIN, lineHeight: 1.35 }}>{it.name}</Typography>
                    <Typography variant="caption" sx={{ color: TEXT_SUB }}>{it.code} · {KINDS[it.kind]?.label}</Typography>
                  </Box>
                </Stack>
              </TableCell>
              <TableCell sx={{ color: it.category ? TEXT_MAIN : "#cbd5e1", whiteSpace: "nowrap" }}>{it.category || "—"}</TableCell>
              <TableCell sx={{ color: it.location ? TEXT_MAIN : "#cbd5e1", whiteSpace: "nowrap" }}>{it.location || "—"}</TableCell>
              <TableCell align="right"><Num v={it.qty} /></TableCell>
              <TableCell align="right"><Num v={it.reserved} color="#d97706" /></TableCell>
              <TableCell align="right"><Num v={it.kind === "asset" ? it.onLoan : 0} color={KINDS.asset.color} /></TableCell>
              <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                <Typography component="span" sx={{ fontWeight: 900, fontSize: "1.02rem", color: tone }}>{fmt(av)}</Typography>
                <Typography component="span" sx={{ ml: 0.5, fontSize: "0.76rem", color: TEXT_SUB }}>{it.unit}</Typography>
              </TableCell>
              <TableCell sx={{ whiteSpace: "nowrap" }}>
                <StockState it={it} />
              </TableCell>
              <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="flex-end">
                  {canManage && <ManageBtns it={it} onAdjust={onAdjust} onEdit={onEdit} />}
                  <RequestBtn it={it} onRequest={onRequest} />
                </Stack>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  </Box>
);

const RequestTable = ({ rows, onOpen }) => (
  <Box sx={{ ...CARD, overflowX: "auto" }}>
    <Table size="small" sx={{ minWidth: 900, ...TABLE_SX }}>
      <TableHead>
        <TableRow>
          <TableCell>เลขที่ / วันที่</TableCell><TableCell>ผู้ยื่น</TableCell><TableCell>งานที่อิง</TableCell><TableCell>รายการ</TableCell>
          <TableCell>กำหนดคืน</TableCell><TableCell>สถานะ</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r) => {
          const left = outstanding(r);
          const overdue = r.status === "issued" && left > 0 && r.dueReturnAt && new Date(r.dueReturnAt) < new Date(new Date().toDateString());
          return (
            <TableRow key={r._id} hover onClick={() => onOpen(r._id)} sx={{ cursor: "pointer" }}>
              <TableCell sx={{ whiteSpace: "nowrap" }}>
                <Typography sx={{ fontWeight: 700, fontSize: "0.86rem" }}>{r.docNo}</Typography>
                <Typography variant="caption" sx={{ color: TEXT_SUB }}>{thaiDate(r.createdAt)}</Typography>
              </TableCell>
              <TableCell sx={{ whiteSpace: "nowrap" }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Avatar sx={{ width: 26, height: 26, fontSize: "0.75rem", fontWeight: 800, bgcolor: personColor(r.requester?.name) }}>{personInitial(r.requester?.name)}</Avatar>
                  <span>{r.requester?.name}</span>
                </Stack>
              </TableCell>
              <TableCell sx={{ maxWidth: 320 }}>
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                  <JobTypeChip job={jobOf(r)} />
                  <Typography noWrap sx={{ fontSize: "0.84rem", minWidth: 0 }}>{r.jobTitle}</Typography>
                </Stack>
              </TableCell>
              <TableCell sx={{ maxWidth: 300 }}>
                <Typography noWrap sx={{ fontSize: "0.84rem" }}>{(r.lines || []).map((l) => `${l.name} ×${fmt(l.qty)}`).join(" · ")}</Typography>
              </TableCell>
              <TableCell sx={{ whiteSpace: "nowrap", color: overdue ? "#dc2626" : TEXT_SUB, fontWeight: overdue ? 800 : 400 }}>
                {r.dueReturnAt && left > 0 ? `${thaiDate(r.dueReturnAt)}${overdue ? " · เลยกำหนด" : ""}` : "—"}
              </TableCell>
              <TableCell><ReqBadge status={r.status} label={r.status === "issued" && left > 0 ? `ยืมอยู่ ${fmt(left)}` : undefined} /></TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  </Box>
);

/** แถวใบเบิก — ผู้ยื่น · งาน (สีประเภทงาน) · รายการย่อ · สถานะ */
const RequestRow = ({ r, onOpen }) => {
  const left = outstanding(r);
  const overdue = r.status === "issued" && left > 0 && r.dueReturnAt && new Date(r.dueReturnAt) < new Date(new Date().toDateString());
  return (
    <Box role="button" onClick={() => onOpen(r._id)} sx={{ ...CARD, p: 1.5, cursor: "pointer", "&:hover": { borderColor: "#cbd5e1" }, "&:active": { bgcolor: "#f8fafc" } }}>
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Avatar sx={{ width: 34, height: 34, fontSize: "0.9rem", fontWeight: 800, bgcolor: personColor(r.requester?.name), flexShrink: 0 }}>{personInitial(r.requester?.name)}</Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontWeight: 800, fontSize: "0.93rem" }}>{r.requester?.name}</Typography>
          <Typography noWrap variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>{r.docNo} · {thaiDate(r.createdAt)}</Typography>
        </Box>
        <ReqBadge status={r.status} label={r.status === "issued" && left > 0 ? `ยืมอยู่ ${fmt(left)}` : undefined} />
      </Stack>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1, minWidth: 0 }}>
        <JobTypeChip job={jobOf(r)} />
        <Typography noWrap sx={{ fontSize: "0.84rem", fontWeight: 600, color: TEXT_MAIN, minWidth: 0 }}>{r.jobTitle}</Typography>
      </Stack>
      <Typography variant="caption" sx={{ color: TEXT_SUB, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", mt: 0.5 }}>
        {(r.lines || []).map((l) => `${l.name} ×${fmt(l.qty)}`).join(" · ")}
      </Typography>
      {r.dueReturnAt && left > 0 && (
        <Typography variant="caption" sx={{ fontWeight: 700, color: overdue ? "#dc2626" : KINDS.asset.color, display: "block", mt: 0.25 }}>
          คืนภายใน {thaiDate(r.dueReturnAt)}{overdue ? " · เลยกำหนด" : ""}
        </Typography>
      )}
    </Box>
  );
};

const MoveRow = ({ m }) => {
  const t = MOVE_TYPES[m.type] || MOVE_TYPES.adjust;
  return (
    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ px: 1.5, py: 1.1, borderTop: `1px solid ${BORDER_MAIN}`, "&:first-of-type": { borderTop: 0 } }}>
      <Box sx={{ width: 4, alignSelf: "stretch", borderRadius: 2, bgcolor: t.color, flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontWeight: 700, fontSize: "0.88rem" }}>{m.itemName}</Typography>
        <Typography noWrap variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>
          <Box component="span" sx={{ color: t.color, fontWeight: 800 }}>{t.label}</Box>
          {m.docNo ? ` · ${m.docNo}` : ""}{m.jobTitle ? ` · ${m.jobTitle}` : m.note ? ` · ${m.note}` : ""}
        </Typography>
        <Typography noWrap variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>{m.by?.name} · {thaiDateTime(m.at)}</Typography>
      </Box>
      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
        <Typography sx={{ fontWeight: 900, color: m.qty > 0 ? "#16a34a" : "#dc2626" }}>{m.qty > 0 ? "+" : ""}{fmt(m.qty)}</Typography>
        <Typography variant="caption" sx={{ color: TEXT_SUB }}>คงเหลือ {fmt(m.balance)} {m.unit}</Typography>
      </Box>
    </Stack>
  );
};

export default function StockPage() {
  const { can } = usePermissions();
  const { userData } = useAuth();
  const myId = String(userData?._id || "");
  const isDesktop = useMediaQuery("(min-width:900px)");
  // ✅ "รองรับทุกขนาดจอ" — ตารางเฉพาะจอกว้างพอ (มีเมนูข้าง) · แท็บเล็ต/มือถือใช้การ์ด
  const isWide = useMediaQuery("(min-width:1200px)");
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get("tab")) ? params.get("tab") : "items";
  const openId = params.get("id") || "";
  const canUse = can("requestStock") || can("manageStock");

  const [cfg, setCfg] = useState(null);
  const [dept, setDept] = useState("");
  const [items, setItems] = useState(null);
  const [requests, setRequests] = useState(null);
  const [moves, setMoves] = useState(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  // ✅ (27 ต.ค. 2569 ผู้ใช้: "ให้ค้นหาแยกหมวดหมู่ได้ด้วย") — "" = ทุกหมวด · "-" = ยังไม่ระบุหมวด
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({ open: false, preset: null });
  const [itemForm, setItemForm] = useState({ open: false, item: null });
  const [adjust, setAdjust] = useState({ open: false, item: null, mode: "in" });
  const [toast, setToast] = useState("");
  const [exporting, setExporting] = useState(false);
  const canManage = Boolean(cfg?.canManage);

  useEffect(() => {
    if (!canUse) return;
    StockService.config().then((c) => { setCfg(c); setDept((d) => d || c.myDept); }).catch((err) => setError(errorText(err, "โหลดระบบสต๊อกไม่สำเร็จ")));
  }, [canUse]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  // ✅ เรียลไทม์ — ใครเบิก/อนุมัติ/รับเข้าที่เครื่องไหน ยอดทุกจอเปลี่ยนตาม
  useRealtime("stock", reload, { enabled: canUse });

  useEffect(() => {
    if (!dept) return undefined;
    let alive = true;
    StockService.items(dept, canManage).then((r) => alive && setItems(r)).catch((err) => alive && setError(errorText(err, "โหลดคลังไม่สำเร็จ")));
    StockService.requests(canManage ? { dept } : { scope: "mine" }).then((r) => alive && setRequests(r)).catch(() => alive && setRequests([]));
    if (tab === "moves") StockService.moves(dept).then((r) => alive && setMoves(r)).catch(() => alive && setMoves([]));
    return () => { alive = false; };
  }, [dept, canManage, tab, reloadKey]);

  const setTab = (t) => { const p = new URLSearchParams(params); p.set("tab", t); p.delete("id"); setParams(p, { replace: true }); };
  const openReq = (id) => { const p = new URLSearchParams(params); p.set("id", id); setParams(p); };
  const closeReq = () => { const p = new URLSearchParams(params); p.delete("id"); setParams(p, { replace: true }); };
  const changed = () => { reload(); refreshAppBadges(); };

  const categories = useMemo(() => [...new Set((items || []).map((i) => i.category).filter(Boolean))].sort(), [items]);
  const needle = q.trim().toLowerCase();
  const match = (vals) => !needle || vals.some((v) => String(v || "").toLowerCase().includes(needle));

  const catCount = useMemo(() => (items || []).reduce((c, it) => { const k = it.category || "-"; c[k] = (c[k] || 0) + 1; return c; }, {}), [items]);
  const itemsBase = useMemo(() => (items || [])
    .filter((it) => !cat || (it.category || "-") === cat)
    .filter((it) => match([it.name, it.code, it.category, it.location])),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- match ขึ้นกับ needle
    [items, needle, cat]);
  const lowCount = itemsBase.filter((it) => it.active !== false && (isLow(it) || isOut(it))).length;
  const shownItems = itemsBase.filter((it) => (kind === "all" ? true : kind === "low" ? isLow(it) || isOut(it) : it.kind === kind));

  const reqBase = useMemo(() => (requests || []).filter((r) => match([r.docNo, r.requester?.name, r.jobTitle, ...(r.lines || []).map((l) => l.name)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- match ขึ้นกับ needle
    [requests, needle]);
  const reqCounts = reqBase.reduce((c, r) => ({ ...c, [r.status]: (c[r.status] || 0) + 1 }), {});
  const pendingCount = (requests || []).filter((r) => r.status === "pending").length;
  const loans = reqBase.filter((r) => r.status === "issued" && outstanding(r) > 0);
  const loanCount = (requests || []).filter((r) => r.status === "issued" && outstanding(r) > 0).length;
  // ผู้ดูแลคลังเปิดแท็บใบเบิก → เริ่มที่ "รออนุมัติ" ถ้ามี
  const curStatus = status || (canManage && pendingCount ? "pending" : "all");
  const shownReqs = curStatus === "all" ? reqBase : reqBase.filter((r) => r.status === curStatus);
  const shownMoves = (moves || []).filter((m) => match([m.itemName, m.docNo, m.jobTitle, m.note, m.by?.name]));

  if (!canUse) return <Navigate to="/dashboard" replace />;
  const deptLabel = cfg?.depts?.find((d) => d.value === dept)?.label || "";
  const deptLabels = Object.fromEntries((cfg?.depts || []).map((d) => [d.value, d.label]));
  // ✅ (27 ต.ค. 2569 ผู้ใช้: "ทำ excel ดึงข้อมูลทั้งหมดให้สมบูรณ์") — คงคลัง · ใบเบิก · รายการเบิก · ประวัติ ของคลังที่เลือก
  const exportExcel = async () => {
    setExporting(true);
    try {
      const [{ exportStockExcel }, allMoves] = await Promise.all([import("../utils/stockExcel"), StockService.moves(dept)]);
      await exportStockExcel({ items: items || [], requests: requests || [], moves: allMoves, deptLabel });
    } catch (err) {
      setError(errorText(err, "ส่งออก Excel ไม่สำเร็จ"));
    } finally {
      setExporting(false);
    }
  };

  const tabs = [
    { key: "items", label: "คงคลัง", count: items?.length },
    { key: "requests", label: canManage ? "ใบเบิก" : "ใบเบิกของฉัน", count: canManage ? pendingCount : 0, alert: canManage && pendingCount > 0 },
    { key: "loans", label: "ยืมอยู่", count: loanCount },
    { key: "moves", label: "ประวัติ" },
  ];
  const gridSx = { display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" } };
  const loading = (v) => v === null;

  return (
    <Box sx={PAGE_SX}>
      {/* หัวเพจ + แท็บ — แบบเดียวกับหน้า OT / ใบ Advance */}
      <Box sx={{ ...CARD, px: { xs: 1.5, sm: 2 }, py: { xs: 1.25, sm: 1.75 }, mb: 1.5 }}>
        <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} spacing={{ xs: 1.25, sm: 2 }}>
          <Stack direction="row" alignItems="center" spacing={{ xs: 1.25, sm: 1.5 }} sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ width: { xs: 34, sm: 38 }, height: { xs: 34, sm: 38 }, borderRadius: 2.25, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: STOCK_ACCENT, color: "#fff", "& svg": { fontSize: { xs: 20, sm: 24 } } }}>
              <Inventory2 />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: { xs: "1.08rem", sm: "1.2rem" }, color: TEXT_MAIN, lineHeight: 1.3 }}>สต๊อก · ทรัพย์สินแผนก</Typography>
              <Typography variant="caption" sx={{ color: TEXT_SUB, display: { xs: "none", sm: "block" }, lineHeight: 1.35 }}>
                ยื่นใบเบิกอิงงาน → ผู้ดูแลคลังอนุมัติ = ตัดยอด · ทรัพย์สินยืมแล้วต้องคืน
              </Typography>
            </Box>
            {canManage && (
              <Button size="small" startIcon={<Add />} onClick={() => setItemForm({ open: true, item: null })}
                variant="outlined" sx={{ ...QUIET, display: { xs: "inline-flex", sm: "none" }, ml: "auto !important", flexShrink: 0 }}>
                สินค้า
              </Button>
            )}
          </Stack>
          {cfg?.depts?.length > 1 && (
            <Stack direction="row" sx={{ p: 0.4, borderRadius: 2.5, bgcolor: "#f1f5f9", flexShrink: 0 }}>
              {cfg.depts.map((d) => (
                <ButtonBase key={d.value} onClick={() => { setDept(d.value); setCat(""); setItems(null); setRequests(null); setMoves(null); }}
                  sx={{ flex: 1, px: 1.5, py: 0.6, borderRadius: 2, fontFamily: "inherit", fontSize: "0.82rem", whiteSpace: "nowrap",
                    fontWeight: dept === d.value ? 800 : 600, color: dept === d.value ? STOCK_DARK : TEXT_SUB,
                    bgcolor: dept === d.value ? "#fff" : "transparent", boxShadow: dept === d.value ? "0 1px 2px rgba(15,23,42,.12)" : "none" }}>
                  คลัง{d.label}
                </ButtonBase>
              ))}
            </Stack>
          )}
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            <Button variant="outlined" startIcon={<FileDownload />} onClick={exportExcel} disabled={exporting || !items}
              sx={{ ...QUIET, display: { xs: "none", sm: "inline-flex" }, "& .MuiButton-startIcon": { color: "#16a34a" } }}>
              {exporting ? "กำลังส่งออก…" : "Excel"}
            </Button>
            {canManage && (
              <Button variant="outlined" startIcon={<Add />} onClick={() => setItemForm({ open: true, item: null })}
                sx={{ ...QUIET, display: { xs: "none", sm: "inline-flex" } }}>
                เพิ่มสินค้า
              </Button>
            )}
            <Button variant="contained" startIcon={<Outbox />} onClick={() => setForm({ open: true, preset: null })} disabled={!items?.length}
              sx={{ flex: { xs: 1, sm: "none" }, textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: STOCK_ACCENT, whiteSpace: "nowrap", "&:hover": { bgcolor: STOCK_DARK, boxShadow: "none" } }}>
              ยื่นใบเบิก
            </Button>
          </Stack>
        </Stack>
        <Box component="nav" aria-label="เมนูสต๊อก"
          sx={{ display: "flex", gap: { xs: 0.25, sm: 0.5 }, mt: { xs: 1.25, sm: 1.5 }, mb: { xs: -1.25, sm: -1.75 }, mx: { xs: -1.5, sm: -2 }, px: { xs: 1, sm: 1.5 },
            borderTop: `1px solid ${BORDER_MAIN}`, overflowX: "auto", "&::-webkit-scrollbar": { display: "none" }, scrollbarWidth: "none" }}>
          {tabs.map((t) => {
            const on = tab === t.key;
            return (
              <ButtonBase key={t.key} onClick={() => setTab(t.key)} aria-current={on ? "page" : undefined}
                sx={{ flexShrink: 0, gap: 0.6, px: { xs: 1.25, sm: 1.5 }, py: 1.1, fontFamily: "inherit", whiteSpace: "nowrap", fontSize: "0.84rem", fontWeight: on ? 800 : 600,
                  color: on ? STOCK_ACCENT : TEXT_SUB, borderBottom: `2px solid ${on ? STOCK_ACCENT : "transparent"}`, mb: "-1px", "&:hover": { color: on ? STOCK_ACCENT : TEXT_MAIN } }}>
                {t.label}
                {t.count > 0 && (
                  <Box component="span" sx={{ minWidth: 18, height: 18, px: 0.5, borderRadius: 99, fontSize: "0.68rem", fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center",
                    bgcolor: t.alert ? "#dc2626" : "#f1f5f9", color: t.alert ? "#fff" : TEXT_SUB }}>{t.count}</Box>
                )}
              </ButtonBase>
            );
          })}
        </Box>
      </Box>

      <Stack direction="row" spacing={1} sx={{ mb: 1.25 }}>
        <TextField size="small" fullWidth value={q} onChange={(e) => setQ(e.target.value)} sx={{ flex: 1, minWidth: 0, bgcolor: "#fff", "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
          placeholder={tab === "items" ? (isDesktop ? "ค้นหาชื่อ / รหัส / ที่เก็บ" : "ค้นหาสินค้า") : (isDesktop ? "ค้นหาเลขที่ / ชื่อ / งาน / รายการ" : "ค้นหาใบเบิก")}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 19, color: TEXT_SUB }} /></InputAdornment>,
            endAdornment: q ? <InputAdornment position="end"><IconButton size="small" onClick={() => setQ("")}><Close sx={{ fontSize: 17 }} /></IconButton></InputAdornment> : null,
          }} />
        {tab === "items" && categories.length > 0 && (
          <TextField select size="small" value={cat} onChange={(e) => setCat(e.target.value)}
            SelectProps={{ displayEmpty: true, MenuProps: { PaperProps: { sx: { maxHeight: 360, borderRadius: 2 } } } }}
            sx={{ width: { xs: 132, sm: 220 }, flexShrink: 0, bgcolor: "#fff", "& .MuiOutlinedInput-root": { borderRadius: 2 },
              "& .MuiSelect-select": { fontWeight: cat ? 700 : 500, color: cat ? TEXT_MAIN : TEXT_SUB } }}>
            <MenuItem value="">ทุกหมวดหมู่ ({fmt((items || []).length)})</MenuItem>
            {categories.map((c) => <MenuItem key={c} value={c}>{c} ({fmt(catCount[c] || 0)})</MenuItem>)}
            {catCount["-"] > 0 && <MenuItem value="-" sx={{ color: TEXT_SUB }}>ไม่ระบุหมวด ({fmt(catCount["-"])})</MenuItem>}
          </TextField>
        )}
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError("")}>{error}</Alert>}

      {tab === "items" && (
        <>
          {!isDesktop ? (
            <FilterPills value={kind} onChange={setKind} items={[
              { value: "all", label: "ทั้งหมด", count: itemsBase.length },
              { value: "consumable", label: KINDS.consumable.label, count: itemsBase.filter((i) => i.kind === "consumable").length },
              { value: "asset", label: KINDS.asset.label, count: itemsBase.filter((i) => i.kind === "asset").length },
              { value: "low", label: "ใกล้หมด", count: lowCount, alert: true },
            ]} />
          ) : <Box sx={{ mb: 1.5 }}>
            <ViewTiles compact value={kind} onChange={setKind} isMobile={!isDesktop} groups={[{ title: "", items: [
              { value: "all", label: "ทั้งหมด", count: itemsBase.length, unit: "รายการ", icon: <Apps />, color: "#475569" },
              { value: "consumable", label: KINDS.consumable.full, shortLabel: KINDS.consumable.label, count: itemsBase.filter((i) => i.kind === "consumable").length, unit: "รายการ", icon: <Category />, color: KINDS.consumable.color },
              { value: "asset", label: KINDS.asset.full, shortLabel: KINDS.asset.label, count: itemsBase.filter((i) => i.kind === "asset").length, unit: "รายการ", icon: <Handyman />, color: KINDS.asset.color },
              { value: "low", label: "ใกล้หมด / หมด", shortLabel: "ใกล้หมด", count: lowCount, unit: "รายการ", icon: <WarningAmber />, color: "#d97706", alert: lowCount > 0 },
            ] }]} />
          </Box>}
          {loading(items) ? <Box sx={gridSx}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={150} />)}</Box>
            : shownItems.length ? (isWide ? (
              <ItemTable rows={shownItems} canManage={canManage}
                onRequest={(x) => setForm({ open: true, preset: x })}
                onAdjust={(x, mode) => setAdjust({ open: true, item: x, mode })}
                onEdit={(x) => setItemForm({ open: true, item: x })} />
            ) : (
              <Box sx={gridSx}>
                {shownItems.map((it) => (
                  <ItemCard key={it._id} it={it} canManage={canManage}
                    onRequest={(x) => setForm({ open: true, preset: x })}
                    onAdjust={(x, mode) => setAdjust({ open: true, item: x, mode })}
                    onEdit={(x) => setItemForm({ open: true, item: x })} />
                ))}
              </Box>
            )) : (
              <Empty icon={<Inventory2 />} text={items.length ? "ไม่พบรายการตามตัวกรอง"
                : canManage ? `คลัง${deptLabel}ยังว่าง — กด “เพิ่มสินค้า” เพื่อเริ่ม` : `คลัง${deptLabel}ยังไม่มีของ — แจ้งผู้ดูแลคลังให้เพิ่มรายการ`} />
            )}
        </>
      )}

      {tab === "requests" && (
        <>
          {!isDesktop ? (
            <FilterPills value={curStatus} onChange={setStatus} items={[
              { value: "all", label: "ทั้งหมด", count: reqBase.length },
              ...REQ_ORDER.filter((st) => st === curStatus || (reqCounts[st] || 0) > 0).map((st) => ({ value: st, label: reqStatus(st).label, count: reqCounts[st] || 0, alert: st === "pending" && canManage })),
            ]} />
          ) : <Box sx={{ mb: 1.5 }}>
            <ViewTiles compact value={curStatus} onChange={setStatus} isMobile={!isDesktop} groups={[{ title: "", items: [
              { value: "all", label: "ทุกสถานะ", count: reqBase.length, unit: "ใบ", icon: <Apps />, color: "#475569" },
              ...REQ_ORDER.filter((st) => st === curStatus || (reqCounts[st] || 0) > 0).map((st) => ({
                value: st, label: reqStatus(st).label, count: reqCounts[st] || 0, unit: "ใบ", color: reqStatus(st).color, alert: st === "pending" && canManage,
                icon: <Box component="span" sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: reqStatus(st).color, display: "inline-block" }} />,
              })),
            ] }]} />
          </Box>}
          {loading(requests) ? <Stack spacing={1}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={110} />)}</Stack>
            : shownReqs.length ? (isWide ? <RequestTable rows={shownReqs} onOpen={openReq} /> : <Box sx={gridSx}>{shownReqs.map((r) => <RequestRow key={r._id} r={r} onOpen={openReq} />)}</Box>)
              : <Empty icon={<Outbox />} text={requests.length ? "ไม่พบใบเบิกตามตัวกรอง" : "ยังไม่มีใบเบิก — กด “ยื่นใบเบิก” หรือปุ่ม “เบิก” ที่การ์ดสินค้า"} />}
        </>
      )}

      {tab === "loans" && (
        loading(requests) ? <Skeleton variant="rounded" height={120} />
          : loans.length ? (isWide ? <RequestTable rows={loans} onOpen={openReq} /> : <Box sx={gridSx}>{loans.map((r) => <RequestRow key={r._id} r={r} onOpen={openReq} />)}</Box>)
            : <Empty icon={<Handyman />} text={canManage ? "ไม่มีทรัพย์สินที่ยืมออกไป" : "คุณไม่มีทรัพย์สินที่ยืมค้างอยู่"} />
      )}

      {tab === "moves" && (
        loading(moves) ? <Skeleton variant="rounded" height={240} />
          : shownMoves.length ? <Box sx={{ ...CARD, overflow: "hidden" }}>{shownMoves.map((m) => <MoveRow key={m._id} m={m} />)}</Box>
            : <Empty icon={<FactCheck />} text="ยังไม่มีการเคลื่อนไหวของสต๊อก" />
      )}

      <StockRequestForm open={form.open} dept={dept} deptLabel={deptLabel} items={items || []} preset={form.preset}
        onClose={() => setForm({ open: false, preset: null })}
        onSaved={(r) => { setForm({ open: false, preset: null }); changed(); setToast(`ยื่นใบเบิก ${r.docNo} แล้ว — จองยอดไว้ รอผู้ดูแลคลังอนุมัติ`); openReq(r._id); }} />
      <StockRequestDetail open={Boolean(openId)} id={openId} canManage={canManage} myId={myId} items={items || []} deptLabels={deptLabels} onClose={closeReq}
        onChanged={(r) => { changed(); setToast({ issued: "อนุมัติแล้ว — ตัดยอดออกจากคลัง", rejected: "ไม่อนุมัติแล้ว — คืนยอดที่จองไว้", cancelled: "ยกเลิกแล้ว — คืนยอดที่จองไว้", returned: "รับคืนครบแล้ว" }[r.status] || "บันทึกแล้ว"); }} />
      <ItemFormDialog open={itemForm.open} item={itemForm.item} dept={dept} categories={categories}
        onClose={() => setItemForm({ open: false, item: null })}
        onSaved={(it, { created }) => { setItemForm({ open: false, item: null }); changed(); setToast(created ? `เพิ่ม ${it.name} (${it.code}) แล้ว` : "บันทึกแล้ว"); }} />
      <AdjustDialog open={adjust.open} item={adjust.item} mode={adjust.mode}
        onClose={() => setAdjust((a) => ({ ...a, open: false }))}
        onSaved={(it, mode) => { setAdjust((a) => ({ ...a, open: false })); changed(); setToast(mode === "in" ? `รับเข้าแล้ว — ${it.name} มี ${fmt(it.qty)} ${it.unit}` : `ปรับยอดแล้ว — ${it.name} ${fmt(it.qty)} ${it.unit}`); }} />
      <Snackbar open={Boolean(toast)} autoHideDuration={3500} onClose={() => setToast("")} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="success" variant="filled" onClose={() => setToast("")} sx={{ fontWeight: 700 }}>{toast}</Alert>
      </Snackbar>
    </Box>
  );
}
