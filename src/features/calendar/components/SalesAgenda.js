/**
 * SalesAgenda — หน้าตาของ "ตารางนัดหมายเซล" ที่แยกจากตารางงานช่างให้ชัด
 *
 * ✅ ผู้ใช้สั่ง (8 ต.ค. 2569): "หน้า event มันเหมือนช่างมากเกินไป อาจจะสับสน แก้ไขให้สมบูรณ์ · UI ไม่สวย จัดการใหม่ให้ใช้งานและดูง่าย"
 *   • SalesTopBar — หัวหน้า "ตารางนัดหมาย" + ตัวเลขสรุป (วันนี้ · ต้องติดตาม · รอปิดงาน · ปิดงานเดือนนี้)
 *     + ปุ่ม "เพิ่มนัดหมาย" + สลับมุมมอง รายการ/ปฏิทิน
 *   • SalesAgenda — มุมมอง "รายการ" (ค่าเริ่มต้นบนมือถือ): แบ่งแท็บ ที่จะถึง · ต้องติดตาม · ที่ผ่านมา
 *     จัดกลุ่มตามวัน แต่ละแถว = เวลา · ไอคอนประเภท · สถานที่ · ลูกค้า · สถานะ · จำนวนรูป
 *   ⚠️ ข้อมูลชุดเดียวกับปฏิทิน (filteredCalendarEvents) ตัวกรอง/ค้นหาด้านบนจึงมีผลกับทั้งสองมุมมอง
 */
import { useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import { Box, Stack, Typography, Button, ButtonBase, Pagination } from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Add, FileDownloadOutlined, ViewAgendaOutlined, CalendarMonthOutlined, PhotoCameraOutlined, ChevronRight, EventAvailableOutlined,
} from "@mui/icons-material";
import { formatThai } from "@/shared/utils/thaiDate";
import { INK, INK_2, MUTED, FAINT, LINE, SURFACE, ACCENT, PRIMARY_BTN_SX } from "@/shared/ui/PageKit";
import { SALES_TYPE_META, salesStatusMeta, toSalesStatus } from "../salesAppointmentTypes";

const AMBER = "#d97706";
const TEAL = "#0d9488";
const GREEN = "#16a34a";

const isSalesRow = (e) => !e?.extendedProps?.isHoliday && String(e?.department ?? e?.extendedProps?.department) === "sales";

/** ข้อมูลที่ใช้แสดงของนัด 1 รายการ */
const rowOf = (e) => {
  const start = moment(e.start);
  const st = toSalesStatus(e.status);
  const startTime = e.extendedProps?.startTime || "";
  const endTime = e.extendedProps?.endTime || "";
  return {
    id: String(e._id || e.id),
    e, start, st,
    time: startTime ? `${startTime}${endTime ? `–${endTime}` : ""}` : "ทั้งวัน",
    type: SALES_TYPE_META[e.title] || SALES_TYPE_META["อื่นๆ"],
    photos: (e.sitePhotoFiles || e.extendedProps?.sitePhotoFiles || []).length,
    owner: [e.user?.fname, e.user?.lname].filter(Boolean).join(" "),
  };
};

/** ตัวเลขสรุปของหัวหน้า */
export const salesSummary = (events) => {
  const today = moment().startOf("day");
  const rows = (events || []).filter(isSalesRow).map(rowOf);
  return {
    today: rows.filter((r) => r.start.isSame(today, "day") && (r.st === "นัดหมายแล้ว" || r.st === "เลื่อนนัด")).length,
    overdue: rows.filter((r) => r.start.isBefore(today) && (r.st === "นัดหมายแล้ว" || r.st === "เลื่อนนัด")).length,
    toClose: rows.filter((r) => r.st === "เข้าพบแล้ว").length,
    closedMonth: rows.filter((r) => r.st === "ปิดงานแล้ว" && moment(r.e.salesClosedAt || r.e.start).isSame(today, "month")).length,
  };
};

export function Kpi({ label, value, color = INK, onClick, active }) {
  return (
    <ButtonBase onClick={onClick} disabled={!onClick}
      sx={{
        flex: 1, minWidth: 0, display: "block", textAlign: "left", px: { xs: 1.1, sm: 1.5 }, py: { xs: 0.7, sm: 1.1 }, borderRadius: 2.5,
        bgcolor: active ? alpha(color, 0.06) : "#fff", border: `1px solid ${active ? alpha(color, 0.4) : LINE}`,
      }}>
      <Typography noWrap sx={{ fontSize: { xs: "0.66rem", sm: "0.7rem" }, fontWeight: 700, color: MUTED }}>{label}</Typography>
      <Typography sx={{ fontSize: { xs: "1.1rem", sm: "1.35rem" }, fontWeight: 900, lineHeight: 1.2, color: value ? color : FAINT, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
    </ButtonBase>
  );
}

/** หัวหน้าตารางนัดหมาย */
export function SalesTopBar({ events, onAdd, onTab, onExport, exportDisabled, title = "ตารางนัดหมาย", sub, showKpis = true }) {
  const s = useMemo(() => salesSummary(events), [events]);
  return (
    <Box sx={{ mb: { xs: 1, sm: 1.5 } }}>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: { xs: 1, sm: 1.25 } }}>
        <Box sx={{ width: { xs: 34, sm: 40 }, height: { xs: 34, sm: 40 }, borderRadius: 2.5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: alpha(ACCENT, 0.1), color: ACCENT }}>
          <EventAvailableOutlined />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900, fontSize: { xs: "1rem", sm: "1.15rem" }, color: INK, lineHeight: 1.25 }}>{title}</Typography>
          <Typography noWrap sx={{ fontSize: { xs: "0.72rem", sm: "0.78rem" }, color: MUTED }}>{sub || "นัดเข้าพบลูกค้า · สำรวจหน้างาน · นำเสนอ · ติดตามผล"}</Typography>
        </Box>
        {onExport && (
          <Button variant="outlined" onClick={onExport} disabled={exportDisabled} startIcon={<FileDownloadOutlined />}
            sx={{ display: { xs: "none", sm: "inline-flex" }, textTransform: "none", fontWeight: 800, borderRadius: 2, color: "#15803d", borderColor: "#bbf7d0", "&:hover": { borderColor: "#16a34a", bgcolor: "#f0fdf4" } }}>
            Excel
          </Button>
        )}
        <Button variant="contained" startIcon={<Add />} onClick={onAdd} sx={{ ...PRIMARY_BTN_SX, px: { xs: 1.25, sm: 2 }, py: { xs: 0.5, sm: 0.75 }, fontSize: { xs: "0.82rem", sm: "0.875rem" } }}>
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>เพิ่มนัดหมาย</Box>
          <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>เพิ่ม</Box>
        </Button>
      </Stack>

      {showKpis && <Stack direction="row" spacing={{ xs: 0.75, sm: 1 }} sx={{ mb: { xs: 1, sm: 1.25 } }}>
        <Kpi label="นัดวันนี้" value={s.today} color={ACCENT} onClick={() => onTab("upcoming")} />
        <Kpi label="เลยวันนัด" value={s.overdue} color={AMBER} onClick={() => onTab("follow")} />
        <Kpi label="รอปิดงาน" value={s.toClose} color={TEAL} onClick={() => onTab("follow")} />
        <Box sx={{ flex: 1, minWidth: 0, display: { xs: "none", sm: "flex" } }}>
          <Kpi label="ปิดงานเดือนนี้" value={s.closedMonth} color={GREEN} onClick={() => onTab("history")} />
        </Box>
      </Stack>}

    </Box>
  );
}

/**
 * แบ่งหน้าของมุมมองรายการ (8 ต.ค. 2569 ผู้ใช้: "ทำระบบแบ่งหน้าที่ควรมีด้วย") — ใช้ร่วมกันทั้งฝ่ายขายและช่าง
 * หน้าละ PAGE_SIZE รายการ · กลับหน้า 1 เมื่อเปลี่ยนแท็บ/ข้อมูล (ตัวกรอง/ค้นหา) · เลื่อนกลับหัวรายการเมื่อเปลี่ยนหน้า
 */
export const PAGE_SIZE = 15;
export function usePaged(list, resetKey) {
  const [page, setPage] = useState(1);
  const topRef = useRef(null);
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  useEffect(() => { setPage(1); }, [resetKey, list.length]);
  const cur = Math.min(page, pageCount);
  const items = list.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);
  const go = (p) => {
    setPage(p);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  return { items, page: cur, pageCount, total: list.length, go, topRef };
}
export function ListPager({ page, pageCount, total, go, accent = ACCENT }) {
  if (total <= PAGE_SIZE) return null;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);
  return (
    <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" justifyContent="space-between" spacing={1}
      sx={{ mt: 1.5, px: 1.5, py: 1, bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3 }}>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
        แสดง <b style={{ color: INK }}>{from}–{to}</b> จาก <b style={{ color: INK }}>{total}</b> รายการ
      </Typography>
      <Pagination count={pageCount} page={page} onChange={(_, p) => go(p)} shape="rounded" size="small" siblingCount={1}
        sx={{ "& .MuiPaginationItem-root.Mui-selected": { bgcolor: alpha(accent, 0.1), color: accent, fontWeight: 800, border: `1px solid ${alpha(accent, 0.35)}` }, "& .MuiPaginationItem-root.Mui-selected:hover": { bgcolor: alpha(accent, 0.16) } }} />
    </Stack>
  );
}

/** ปุ่มสลับมุมมอง รายการ/ปฏิทิน แบบกะทัดรัด (วางในแถวค้นหา) */
export function SalesViewToggle({ view, onView, accent = ACCENT }) {
  return (
    <Stack direction="row" sx={{ p: "3px", borderRadius: "10px", bgcolor: "#eef2f7", flexShrink: 0 }}>
      {[
        { k: "list", label: "รายการ", icon: <ViewAgendaOutlined sx={{ fontSize: 18 }} /> },
        { k: "calendar", label: "ปฏิทิน", icon: <CalendarMonthOutlined sx={{ fontSize: 18 }} /> },
      ].map((o) => (
        <ButtonBase key={o.k} onClick={() => onView(o.k)} title={o.label} aria-label={o.label} aria-pressed={view === o.k}
          sx={{
            gap: 0.6, height: 32, px: { xs: 1, sm: 1.5 }, borderRadius: "8px", fontSize: "0.8rem", fontWeight: 800,
            color: view === o.k ? accent : MUTED, bgcolor: view === o.k ? "#fff" : "transparent",
            boxShadow: view === o.k ? "0 1px 2px rgba(15,23,42,.12)" : "none",
          }}>
          {o.icon}
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>{o.label}</Box>
        </ButtonBase>
      ))}
    </Stack>
  );
}

/** แถวนัด 1 รายการ */
function Row({ r, onOpen, showOwner, note }) {
  const sm = salesStatusMeta(r.st);
  const cancelled = r.st === "ยกเลิกนัด";
  return (
    <ButtonBase onClick={() => onOpen(r.id)}
      sx={{
        width: "100%", display: "flex", alignItems: "stretch", textAlign: "left", gap: 1.25, px: 1.5, py: 1.25,
        borderTop: `1px solid ${LINE}`, "&:first-of-type": { borderTop: 0 }, "&:hover": { bgcolor: SURFACE },
        opacity: cancelled ? 0.6 : 1,
      }}>
      <Box sx={{ width: 52, flexShrink: 0, pt: 0.25 }}>
        <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: r.time === "ทั้งวัน" ? MUTED : INK, lineHeight: 1.3, fontVariantNumeric: "tabular-nums" }}>
          {r.time === "ทั้งวัน" ? "ทั้งวัน" : r.time.split("–")[0]}
        </Typography>
        {r.time.includes("–") && <Typography sx={{ fontSize: "0.7rem", color: MUTED }}>{r.time.split("–")[1]}</Typography>}
      </Box>
      <Box sx={{ width: 3, borderRadius: 2, flexShrink: 0, bgcolor: cancelled ? FAINT : r.type.color }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: cancelled ? MUTED : r.type.color, whiteSpace: "nowrap" }}>{r.type.icon} {r.e.title}</Typography>
          <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, height: 20, px: 0.8, borderRadius: 99, fontSize: "0.66rem", fontWeight: 800, bgcolor: alpha(sm.color, 0.1), color: sm.color, whiteSpace: "nowrap" }}>
            <Box component="span" sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: sm.color }} />{r.st}
          </Box>
        </Stack>
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 800, color: INK, lineHeight: 1.35, mt: 0.2, overflowWrap: "anywhere", textDecoration: cancelled ? "line-through" : "none" }}>
          {r.e.site || "-"}
        </Typography>
        <Typography noWrap sx={{ fontSize: "0.76rem", color: MUTED }}>
          {[r.e.company && r.e.company !== r.e.site ? r.e.company : "", r.e.contactName ? `คุณ${String(r.e.contactName).replace(/^คุณ\s*/, "")}` : "", showOwner && r.owner ? `ฝ่ายขาย: ${r.owner}` : ""].filter(Boolean).join(" · ") || "ไม่ระบุลูกค้า"}
        </Typography>
        {note && <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: note.color, mt: 0.3 }}>{note.text}</Typography>}
      </Box>
      <Stack alignItems="flex-end" justifyContent="space-between" sx={{ flexShrink: 0 }}>
        <ChevronRight sx={{ color: FAINT, fontSize: 20 }} />
        {r.photos > 0 && (
          <Stack direction="row" spacing={0.3} alignItems="center" sx={{ color: MUTED }}>
            <PhotoCameraOutlined sx={{ fontSize: 14 }} />
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 700 }}>{r.photos}</Typography>
          </Stack>
        )}
      </Stack>
    </ButtonBase>
  );
}

/** กลุ่มของวัน */
function DayGroup({ day, rows, onOpen, showOwner, noteOf }) {
  const today = moment().startOf("day");
  const d = moment(day);
  const rel = d.isSame(today, "day") ? "วันนี้" : d.isSame(today.clone().add(1, "day"), "day") ? "พรุ่งนี้" : d.isSame(today.clone().subtract(1, "day"), "day") ? "เมื่อวาน" : "";
  return (
    <Box sx={{ mb: 1.5 }}>
      <Stack direction="row" alignItems="baseline" spacing={0.75} sx={{ px: 0.5, mb: 0.6 }}>
        {rel && <Typography sx={{ fontSize: "0.82rem", fontWeight: 900, color: rel === "วันนี้" ? ACCENT : INK }}>{rel}</Typography>}
        <Typography sx={{ fontSize: "0.8rem", fontWeight: rel ? 600 : 800, color: rel ? MUTED : INK }}>{formatThai(d, "dddd D MMM YY")}</Typography>
        <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>· {rows.length} นัด</Typography>
      </Stack>
      <Box sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, overflow: "hidden" }}>
        {rows.map((r) => <Row key={r.id} r={r} onOpen={onOpen} showOwner={showOwner} note={noteOf?.(r)} />)}
      </Box>
    </Box>
  );
}

const groupByDay = (rows) => {
  const map = new Map();
  rows.forEach((r) => {
    const k = r.start.format("YYYY-MM-DD");
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  });
  return [...map.entries()];
};

const timeKey = (r) => (r.time === "ทั้งวัน" ? "00:00" : r.time.slice(0, 5));

/** มุมมองรายการ */
export default function SalesAgenda({ events, onOpen, onAdd, showOwner, tab, onTab }) {
  const today = moment().startOf("day");
  const rows = useMemo(() => (events || []).filter(isSalesRow).map(rowOf), [events]);

  // ✅ (8 ต.ค. 2569 ผู้ใช้: "กดที่จะถึง แต่แสดงงานที่ปิดแล้ว") แต่ละนัดอยู่แท็บเดียวเสมอ ตามสถานะ:
  //    ที่จะถึง = นัดหมายแล้ว/เลื่อนนัด วันนี้เป็นต้นไป · ต้องติดตาม = เลยวันนัดยังไม่เข้าพบ + เข้าพบแล้วรอปิด
  //    ประวัติ = ปิดงานแล้ว/ยกเลิกนัด
  const isOpen = (r) => r.st === "นัดหมายแล้ว" || r.st === "เลื่อนนัด";
  const upcoming = useMemo(
    () => rows.filter((r) => isOpen(r) && !r.start.isBefore(today)).sort((a, b) => a.start - b.start || timeKey(a).localeCompare(timeKey(b))),
    [rows], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const follow = useMemo(() => {
    const overdue = rows.filter((r) => isOpen(r) && r.start.isBefore(today));
    const toClose = rows.filter((r) => r.st === "เข้าพบแล้ว");
    return [...overdue, ...toClose].sort((a, b) => a.start - b.start);
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const past = useMemo(
    () => rows.filter((r) => r.st === "ปิดงานแล้ว" || r.st === "ยกเลิกนัด").sort((a, b) => b.start - a.start || timeKey(b).localeCompare(timeKey(a))),
    [rows], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const tabs = [
    { k: "upcoming", label: "นัดที่จะถึง", n: upcoming.length, desc: "นัดวันนี้และวันถัดไปที่ยังไม่ได้เข้าพบ" },
    { k: "follow", label: "ต้องติดตาม", n: follow.length, color: AMBER, desc: "เลยวันนัดแต่ยังไม่บันทึกเข้าพบ · เข้าพบแล้วแต่ยังไม่ปิดงาน" },
    { k: "history", label: "ปิดงาน/ยกเลิก", n: past.length, desc: "นัดที่ปิดงานแล้ว หรือยกเลิกไปแล้ว (ล่าสุดก่อน)" },
  ];

  const followNote = (r) => (r.st === "เข้าพบแล้ว"
    ? { text: "เข้าพบแล้ว — สรุปผลแล้วกดปิดงาน", color: TEAL }
    : { text: `เลยวันนัด ${today.diff(r.start.clone().startOf("day"), "days")} วัน — ยังไม่บันทึกเข้าพบ`, color: AMBER });

  const full = tab === "follow" ? follow : tab === "history" ? past : upcoming;
  const pg = usePaged(full, tab);
  const list = pg.items;

  return (
    <Box ref={pg.topRef} sx={{ scrollMarginTop: 80 }}>
      <Stack direction="row" spacing={0.75} sx={{ mb: 0.75, overflowX: "auto", pb: 0.25 }}>
        {tabs.map((t) => {
          const on = tab === t.k;
          return (
            <ButtonBase key={t.k} onClick={() => onTab(t.k)}
              sx={{
                flexShrink: 0, gap: 0.6, px: 1.5, py: 0.7, borderRadius: 99, fontSize: "0.82rem", fontWeight: 800,
                border: `1px solid ${on ? INK : LINE}`, bgcolor: on ? INK : "#fff", color: on ? "#fff" : INK_2,
              }}>
              {t.label}
              <Box component="span" sx={{ minWidth: 20, height: 20, px: 0.6, borderRadius: 99, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", bgcolor: on ? "rgba(255,255,255,.18)" : t.color && t.n ? alpha(t.color, 0.12) : SURFACE, color: on ? "#fff" : t.color && t.n ? t.color : MUTED }}>
                {t.n}
              </Box>
            </ButtonBase>
          );
        })}
      </Stack>
      <Typography sx={{ px: 0.5, mb: 1.5, fontSize: "0.76rem", color: MUTED }}>
        {tabs.find((t) => t.k === tab)?.desc}
      </Typography>

      {list.length === 0 ? (
        <Box sx={{ py: 5, px: 2, textAlign: "center", bgcolor: "#fff", border: `1px dashed ${LINE}`, borderRadius: 3 }}>
          <EventAvailableOutlined sx={{ fontSize: 34, color: FAINT }} />
          <Typography sx={{ mt: 0.75, fontWeight: 800, color: INK_2 }}>
            {tab === "follow" ? "ไม่มีนัดที่ต้องติดตาม" : tab === "history" ? "ยังไม่มีนัดที่ปิดงานหรือยกเลิก" : "ไม่มีนัดที่จะถึง"}
          </Typography>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
            {tab === "follow" ? "ทุกนัดบันทึกเข้าพบและปิดงานเรียบร้อย" : "กด “เพิ่มนัดหมาย” เพื่อลงนัดใหม่"}
          </Typography>
          {tab !== "follow" && (
            <Button startIcon={<Add />} onClick={onAdd} sx={{ mt: 1.5, textTransform: "none", fontWeight: 800 }}>เพิ่มนัดหมาย</Button>
          )}
        </Box>
      ) : tab === "follow" ? (
        <Box sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, overflow: "hidden" }}>
          {list.map((r) => <Row key={r.id} r={r} onOpen={onOpen} showOwner={showOwner} note={followNote(r)} />)}
        </Box>
      ) : (
        groupByDay(list).map(([day, rs]) => <DayGroup key={day} day={day} rows={rs} onOpen={onOpen} showOwner={showOwner} />)
      )}

      <ListPager {...pg} />
    </Box>
  );
}
