/**
 * ItemInsight — แผงข้อมูลสินค้า 1 รายการ: ใครยืมอยู่ · ใครจองไว้ · ใครเบิกไป · ประวัติการเคลื่อนไหว
 *
 * ✅ (27 ต.ค. 2569 ผู้ใช้: "อยากให้กดลิงก์ดูได้เลยใครเบิก ยืมไป ให้ดูข้อมูลได้ง่าย")
 *   เปิดจากชื่อสินค้า หรือกดตัวเลข "จองไว้" / "ยืมออก" ในตาราง · แต่ละแถวกดเปิดใบเบิกนั้นได้ทันที
 *   ⚠️ ผู้ดูแลคลังเห็นทุกใบในแผนก · พนักงานทั่วไปเห็นเฉพาะใบของตัวเอง (server จำกัดไว้)
 */
import { useEffect, useMemo, useState } from "react";
import { Drawer, Box, Stack, Typography, IconButton, ButtonBase, Avatar, Skeleton, useMediaQuery } from "@mui/material";
import { Close, ChevronRight } from "@mui/icons-material";

import JobTypeChip from "@/shared/ui/JobTypeChip";
import { thaiDate, thaiDateTime } from "@/shared/utils/thaiDate";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import StockService from "../services/StockService";
import { TEXT_MAIN, TEXT_SUB, BORDER_MAIN, MOVE_TYPES, KINDS, available, fmt, jobOf } from "../stockMeta";
import { Thumb, KindTag } from "./StockBits";

const Stat = ({ label, value, unit, color }) => (
  <Box sx={{ flex: 1, minWidth: 0, textAlign: "center", py: 1, borderRadius: 2.5, bgcolor: "#f8fafc", border: `1px solid ${BORDER_MAIN}` }}>
    <Typography sx={{ fontSize: "0.72rem", color: TEXT_SUB, fontWeight: 700 }}>{label}</Typography>
    <Typography sx={{ fontWeight: 900, fontSize: "1.25rem", color: color || TEXT_MAIN, lineHeight: 1.2 }}>{fmt(value)}</Typography>
    <Typography sx={{ fontSize: "0.68rem", color: TEXT_SUB }}>{unit}</Typography>
  </Box>
);

const Group = ({ title, tone, count, empty, children }) => (
  <Box sx={{ mb: 2 }}>
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
      <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: tone }} />
      <Typography sx={{ fontWeight: 800, fontSize: "0.88rem", flex: 1 }}>{title}</Typography>
      <Typography sx={{ fontSize: "0.76rem", color: TEXT_SUB, fontWeight: 700 }}>{count}</Typography>
    </Stack>
    {count ? <Box sx={{ border: `1px solid ${BORDER_MAIN}`, borderRadius: 2.5, overflow: "hidden", bgcolor: "#fff" }}>{children}</Box>
      : <Typography sx={{ fontSize: "0.8rem", color: "#94a3b8", px: 1 }}>{empty}</Typography>}
  </Box>
);

/** แถวคน — รูปย่อชื่อ · ชื่อ + เลขใบ/งาน · จำนวน · ลูกศรเปิดใบ */
const PersonRow = ({ r, qty, unit, sub, tone, onOpen }) => (
  <ButtonBase onClick={() => onOpen(r._id)} sx={{ width: "100%", justifyContent: "flex-start", textAlign: "left", fontFamily: "inherit", gap: 1.25, px: 1.25, py: 1,
    borderTop: `1px solid ${BORDER_MAIN}`, "&:first-of-type": { borderTop: 0 }, "&:hover": { bgcolor: "#f8fafc" } }}>
    <Avatar sx={{ width: 32, height: 32, fontSize: "0.82rem", fontWeight: 800, bgcolor: personColor(r.requester?.name) }}>{personInitial(r.requester?.name)}</Avatar>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography noWrap sx={{ fontWeight: 700, fontSize: "0.88rem" }}>{r.requester?.name}</Typography>
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
        <JobTypeChip job={jobOf(r)} />
        <Typography noWrap sx={{ fontSize: "0.74rem", color: TEXT_SUB, minWidth: 0 }}>{r.docNo} · {sub}</Typography>
      </Stack>
    </Box>
    <Typography sx={{ fontWeight: 900, fontSize: "1rem", color: tone, whiteSpace: "nowrap" }}>{fmt(qty)} <Box component="span" sx={{ fontSize: "0.72rem", color: TEXT_SUB, fontWeight: 600 }}>{unit}</Box></Typography>
    <ChevronRight sx={{ fontSize: 18, color: "#cbd5e1" }} />
  </ButtonBase>
);

export default function ItemInsight({ item, dept, requests = [], onClose, onOpenRequest }) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const [moves, setMoves] = useState(null);
  useEffect(() => {
    if (!item) return undefined;
    let alive = true;
    setMoves(null);
    StockService.moves(dept, item._id).then((m) => alive && setMoves(m)).catch(() => alive && setMoves([]));
    return () => { alive = false; };
  }, [item, dept]);

  const id = String(item?._id || "");
  const groups = useMemo(() => {
    const withLine = requests.map((r) => ({ r, l: (r.lines || []).find((x) => String(x.item) === id) })).filter((x) => x.l);
    return {
      loans: withLine.filter(({ r, l }) => r.status === "issued" && l.kind === "asset" && l.qty - (l.returnedQty || 0) > 0),
      reserved: withLine.filter(({ r }) => r.status === "pending"),
      issued: withLine.filter(({ r, l }) => ["issued", "returned"].includes(r.status) && l.kind !== "asset").slice(0, 10),
    };
  }, [requests, id]);

  const today = new Date(new Date().toDateString());
  return (
    <Drawer anchor={isMobile ? "bottom" : "right"} open={Boolean(item)} onClose={onClose}
      PaperProps={{ sx: { width: isMobile ? "100%" : 440, maxHeight: isMobile ? "90vh" : "100%", borderRadius: isMobile ? "16px 16px 0 0" : 0, bgcolor: "#f8fafc" } }}>
      {item && (
        <>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: 2, bgcolor: "#fff", borderBottom: `1px solid ${BORDER_MAIN}` }}>
            <Thumb item={item} size={56} radius={3} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: "1rem", lineHeight: 1.3 }}>{item.name}</Typography>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.25 }}>
                <KindTag kind={item.kind} />
                <Typography noWrap sx={{ fontSize: "0.76rem", color: TEXT_SUB }}>{[item.code, item.category, item.location].filter(Boolean).join(" · ")}</Typography>
              </Stack>
            </Box>
            <IconButton onClick={onClose}><Close /></IconButton>
          </Stack>
          <Box sx={{ p: 2, overflowY: "auto" }}>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <Stat label="เบิกได้" value={available(item)} unit={item.unit} color="#16a34a" />
              <Stat label="จองไว้" value={item.reserved} unit={item.unit} color="#d97706" />
              {item.kind === "asset" && <Stat label="ยืมออก" value={item.onLoan} unit={item.unit} color={KINDS.asset.color} />}
              {item.damaged > 0 && <Stat label="รอซ่อม" value={item.damaged} unit={item.unit} color="#b45309" />}
            </Stack>

            {item.kind === "asset" && (
              <Group title="ใครยืมอยู่" tone={KINDS.asset.color} count={groups.loans.length} empty="ไม่มีใครยืมอยู่">
                {groups.loans.map(({ r, l }) => {
                  const overdue = r.dueReturnAt && new Date(r.dueReturnAt) < today;
                  return (
                    <PersonRow key={r._id} r={r} qty={l.qty - (l.returnedQty || 0)} unit={l.unit} tone={KINDS.asset.color} onOpen={onOpenRequest}
                      sub={r.dueReturnAt ? `คืน ${thaiDate(r.dueReturnAt)}${overdue ? " · เลยกำหนด" : ""}` : `ยืมเมื่อ ${thaiDate(r.issuedAt)}`} />
                  );
                })}
              </Group>
            )}
            <Group title="จองไว้ · รออนุมัติ" tone="#d97706" count={groups.reserved.length} empty="ไม่มีใบที่รออนุมัติ">
              {groups.reserved.map(({ r, l }) => <PersonRow key={r._id} r={r} qty={l.qty} unit={l.unit} tone="#d97706" onOpen={onOpenRequest} sub={`ยื่น ${thaiDate(r.createdAt)}`} />)}
            </Group>
            {item.kind !== "asset" && (
              <Group title="เบิกไปล่าสุด" tone="#dc2626" count={groups.issued.length} empty="ยังไม่มีการเบิก">
                {groups.issued.map(({ r, l }) => <PersonRow key={r._id} r={r} qty={l.qty} unit={l.unit} tone={TEXT_MAIN} onOpen={onOpenRequest} sub={`จ่าย ${thaiDate(r.issuedAt)}`} />)}
              </Group>
            )}

            <Typography sx={{ fontWeight: 800, fontSize: "0.88rem", mb: 0.75 }}>ประวัติการเคลื่อนไหว</Typography>
            {!moves ? <Skeleton variant="rounded" height={120} /> : !moves.length ? (
              <Typography sx={{ fontSize: "0.8rem", color: "#94a3b8" }}>ยังไม่มีประวัติ</Typography>
            ) : (
              <Box sx={{ border: `1px solid ${BORDER_MAIN}`, borderRadius: 2.5, overflow: "hidden", bgcolor: "#fff" }}>
                {moves.slice(0, 30).map((m, i) => {
                  const t = MOVE_TYPES[m.type] || MOVE_TYPES.adjust;
                  const c = t.neutral ? t.color : m.qty > 0 ? "#16a34a" : "#dc2626";
                  return (
                    <Stack key={m._id} direction="row" spacing={1} alignItems="center" sx={{ px: 1.25, py: 0.9, borderTop: i ? `1px solid ${BORDER_MAIN}` : 0 }}>
                      <Box sx={{ width: 3, alignSelf: "stretch", borderRadius: 2, bgcolor: t.color }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography noWrap sx={{ fontSize: "0.82rem", fontWeight: 700 }}>
                          <Box component="span" sx={{ color: t.color }}>{t.label}</Box>{m.docNo ? ` · ${m.docNo}` : ""}
                        </Typography>
                        <Typography noWrap sx={{ fontSize: "0.72rem", color: TEXT_SUB }}>{m.by?.name} · {thaiDateTime(m.at)}{m.note ? ` · ${m.note}` : ""}</Typography>
                      </Box>
                      <Box sx={{ textAlign: "right" }}>
                        <Typography sx={{ fontWeight: 900, fontSize: "0.9rem", color: c }}>{t.neutral ? "" : m.qty > 0 ? "+" : ""}{fmt(m.qty)}</Typography>
                        <Typography sx={{ fontSize: "0.68rem", color: TEXT_SUB }}>คงเหลือ {fmt(m.balance)}</Typography>
                      </Box>
                    </Stack>
                  );
                })}
              </Box>
            )}
          </Box>
        </>
      )}
    </Drawer>
  );
}
