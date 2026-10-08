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
import { useMemo, useState } from "react";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import { Box, Stack, Typography, Button, ButtonBase } from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Add, ViewAgendaOutlined, CalendarMonthOutlined, PhotoCameraOutlined, ChevronRight, EventAvailableOutlined,
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
    today: rows.filter((r) => r.start.isSame(today, "day") && r.st !== "ยกเลิกนัด").length,
    overdue: rows.filter((r) => r.start.isBefore(today) && (r.st === "นัดหมายแล้ว" || r.st === "เลื่อนนัด")).length,
    toClose: rows.filter((r) => r.st === "เข้าพบแล้ว").length,
    closedMonth: rows.filter((r) => r.st === "ปิดงานแล้ว" && moment(r.e.salesClosedAt || r.e.start).isSame(today, "month")).length,
  };
};

function Kpi({ label, value, color = INK, onClick, active }) {
  return (
    <ButtonBase onClick={onClick} disabled={!onClick}
      sx={{
        flex: 1, minWidth: 0, display: "block", textAlign: "left", px: 1.5, py: 1.1, borderRadius: 2.5,
        bgcolor: active ? alpha(color, 0.06) : "#fff", border: `1px solid ${active ? alpha(color, 0.4) : LINE}`,
      }}>
      <Typography noWrap sx={{ fontSize: "0.7rem", fontWeight: 700, color: MUTED }}>{label}</Typography>
      <Typography sx={{ fontSize: "1.35rem", fontWeight: 900, lineHeight: 1.2, color: value ? color : FAINT, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
    </ButtonBase>
  );
}

/** หัวหน้าตารางนัดหมาย */
export function SalesTopBar({ events, view, onView, onAdd, onFollowUp, title = "ตารางนัดหมาย", sub }) {
  const s = useMemo(() => salesSummary(events), [events]);
  return (
    <Box sx={{ mb: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1.25 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2.5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: alpha(ACCENT, 0.1), color: ACCENT }}>
          <EventAvailableOutlined />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900, fontSize: "1.15rem", color: INK, lineHeight: 1.25 }}>{title}</Typography>
          <Typography noWrap sx={{ fontSize: "0.78rem", color: MUTED }}>{sub || "นัดเข้าพบลูกค้า · สำรวจหน้างาน · นำเสนอ · ติดตามผล"}</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={onAdd} sx={{ ...PRIMARY_BTN_SX, px: { xs: 1.5, sm: 2 } }}>
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>เพิ่มนัดหมาย</Box>
          <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>เพิ่ม</Box>
        </Button>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 1.25 }}>
        <Kpi label="วันนี้" value={s.today} color={ACCENT} />
        <Kpi label="เลยวันนัด" value={s.overdue} color={AMBER} onClick={s.overdue ? onFollowUp : undefined} />
        <Kpi label="รอปิดงาน" value={s.toClose} color={TEAL} onClick={s.toClose ? onFollowUp : undefined} />
        <Box sx={{ flex: 1, minWidth: 0, display: { xs: "none", sm: "block" } }}>
          <Kpi label="ปิดงานเดือนนี้" value={s.closedMonth} color={GREEN} />
        </Box>
      </Stack>

      {/* สลับมุมมอง */}
      <Stack direction="row" sx={{ p: 0.4, borderRadius: 2.5, bgcolor: "#eef2f7", width: { xs: "100%", sm: "auto" }, display: "inline-flex" }}>
        {[
          { k: "list", label: "รายการ", icon: <ViewAgendaOutlined sx={{ fontSize: 18 }} /> },
          { k: "calendar", label: "ปฏิทิน", icon: <CalendarMonthOutlined sx={{ fontSize: 18 }} /> },
        ].map((o) => (
          <ButtonBase key={o.k} onClick={() => onView(o.k)}
            sx={{
              flex: 1, gap: 0.75, px: 2, py: 0.75, borderRadius: 2, fontSize: "0.84rem", fontWeight: 800,
              color: view === o.k ? INK : MUTED, bgcolor: view === o.k ? "#fff" : "transparent",
              boxShadow: view === o.k ? "0 1px 2px rgba(15,23,42,.12)" : "none",
            }}>
            {o.icon}{o.label}
          </ButtonBase>
        ))}
      </Stack>
    </Box>
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
          {[r.e.company && r.e.company !== r.e.site ? r.e.company : "", showOwner && r.owner ? `เซล: ${r.owner}` : ""].filter(Boolean).join(" · ") || "ไม่ระบุลูกค้า"}
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
  const [pastLimit, setPastLimit] = useState(20);
  const today = moment().startOf("day");
  const rows = useMemo(() => (events || []).filter(isSalesRow).map(rowOf), [events]);

  const upcoming = useMemo(
    () => rows.filter((r) => !r.start.isBefore(today)).sort((a, b) => a.start - b.start || timeKey(a).localeCompare(timeKey(b))),
    [rows], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const follow = useMemo(() => {
    const overdue = rows.filter((r) => r.start.isBefore(today) && (r.st === "นัดหมายแล้ว" || r.st === "เลื่อนนัด"));
    const toClose = rows.filter((r) => r.st === "เข้าพบแล้ว");
    return [...overdue, ...toClose].sort((a, b) => a.start - b.start);
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const past = useMemo(
    () => rows.filter((r) => r.start.isBefore(today)).sort((a, b) => b.start - a.start || timeKey(b).localeCompare(timeKey(a))),
    [rows], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const tabs = [
    { k: "upcoming", label: "ที่จะถึง", n: upcoming.length },
    { k: "follow", label: "ต้องติดตาม", n: follow.length, color: AMBER },
    { k: "past", label: "ที่ผ่านมา", n: past.length },
  ];

  const followNote = (r) => (r.st === "เข้าพบแล้ว"
    ? { text: "เข้าพบแล้ว — สรุปผลแล้วกดปิดงาน", color: TEAL }
    : { text: `เลยวันนัด ${today.diff(r.start.clone().startOf("day"), "days")} วัน — ยังไม่บันทึกเข้าพบ`, color: AMBER });

  const list = tab === "follow" ? follow : tab === "past" ? past.slice(0, pastLimit) : upcoming;

  return (
    <Box>
      <Stack direction="row" spacing={0.75} sx={{ mb: 1.5, overflowX: "auto", pb: 0.25 }}>
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

      {list.length === 0 ? (
        <Box sx={{ py: 5, px: 2, textAlign: "center", bgcolor: "#fff", border: `1px dashed ${LINE}`, borderRadius: 3 }}>
          <EventAvailableOutlined sx={{ fontSize: 34, color: FAINT }} />
          <Typography sx={{ mt: 0.75, fontWeight: 800, color: INK_2 }}>
            {tab === "follow" ? "ไม่มีนัดที่ต้องติดตาม" : tab === "past" ? "ยังไม่มีนัดที่ผ่านมา" : "ยังไม่มีนัดที่จะถึง"}
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

      {tab === "past" && past.length > pastLimit && (
        <Box sx={{ textAlign: "center", mt: 1 }}>
          <Button onClick={() => setPastLimit((n) => n + 30)} sx={{ textTransform: "none", fontWeight: 800 }}>ดูเพิ่มเติม ({past.length - pastLimit})</Button>
        </Box>
      )}
    </Box>
  );
}
