/**
 * TechAgenda — มุมมอง "รายการ" ของตารางงานช่าง (คู่แฝดของ SalesAgenda)
 *
 * ✅ ผู้ใช้สั่ง (8 ต.ค. 2569): "ทำหน้าแบบนี้ของช่างด้วย ให้สวยงาม สมบูรณ์"
 *   • TechTopBar — หัวหน้า "ตารางงานช่าง" + ตัวเลข (งานวันนี้ · ค้างปิดงาน · รออนุมัติ · เสร็จเดือนนี้) + ปุ่ม "เพิ่มงาน"
 *   • TechAgenda — แท็บ งานที่จะถึง · ต้องติดตาม · เสร็จสิ้น — งานหนึ่งอยู่แท็บเดียวเสมอ:
 *       งานที่จะถึง  = ยังไม่เสร็จ · วันทำงานยังไม่ผ่านไป · ไม่ได้ค้างรออนุมัติ
 *       ต้องติดตาม   = เลยวันทำงานแล้วยังไม่ปิดงาน · รออนุมัติงาน · ขอปิดงานรออนุมัติ
 *       เสร็จสิ้น     = ดำเนินการเสร็จสิ้น (ล่าสุดก่อน)
 *   ⚠️ ข้อมูลชุดเดียวกับปฏิทิน (filteredCalendarEvents) ตัวกรอง/ค้นหาด้านบนจึงมีผลกับทั้งสองมุมมอง
 */
import { useMemo } from "react";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import { Box, Stack, Typography, Button, ButtonBase } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Add, FileDownloadOutlined, ChevronRight, EngineeringOutlined, Groups2Outlined } from "@mui/icons-material";
import { formatThai } from "@/shared/utils/thaiDate";
import { INK, INK_2, MUTED, FAINT, LINE, SURFACE, PRIMARY_BTN_SX } from "@/shared/ui/PageKit";
import { Kpi, usePaged, ListPager } from "./SalesAgenda";

const AMBER = "#d97706";
const RED = "#dc2626";
const GREEN = "#16a34a";
const DONE = "ดำเนินการเสร็จสิ้น";

/** สีสถานะงานช่าง — ชุดเดียวกับป้ายอธิบายสีของปฏิทิน (statusLegend) */
export const TECH_STATUS_COLOR = {
  "กำลังรอยืนยัน": "#64748b",
  "ยืนยันแล้ว": "#2563eb",
  "กำลังดำเนินการ": "#a16207",
  [DONE]: GREEN,
};

const isTechRow = (e) => !e?.extendedProps?.isHoliday && String(e?.department ?? e?.extendedProps?.department ?? "service") !== "sales";

const rowOf = (e) => {
  const start = moment(e.start);
  let end = e.end ? moment(e.end) : start.clone().add(1, "day");
  if (e.allDay && e.end) end = end.clone().subtract(1, "ms");
  const startTime = e.extendedProps?.startTime || "";
  const endTime = e.extendedProps?.endTime || "";
  const team = [e.team, ...(e.teamMembers || e.extendedProps?.teamMembers || []).map((m) => m?.name)]
    .filter(Boolean).filter((n, i, a) => a.indexOf(n) === i);
  const multiDay = !end.isSame(start, "day");
  return {
    id: String(e._id || e.id),
    e, start, end,
    st: e.status || "กำลังรอยืนยัน",
    approval: e.approvalStatus || "approved",
    closeReq: Boolean(e.closeRequested) && e.status !== DONE,
    time: startTime ? `${startTime}${endTime ? `–${endTime}` : ""}` : (multiDay ? `ถึง ${formatThai(end, "D MMM")}` : "ทั้งวัน"),
    // ✅ (8 ต.ค. 2569 "สีประเภทงานไม่ตรงหน้าปฏิทิน") ใช้คู่สีของงานเอง (พื้น + ตัวหนังสือ) ชุดเดียวกับการ์ดบนปฏิทิน
    color: e.backgroundColor || "#64748b",
    textColor: e.textColor || "#ffffff",
    team,
  };
};

/** จัดงานเข้าแท็บ (งานละ 1 แท็บ) */
const classify = (rows) => {
  const today = moment().startOf("day");
  const upcoming = [];
  const follow = [];
  const done = [];
  rows.forEach((r) => {
    if (r.st === DONE) { done.push(r); return; }
    if (r.approval === "pending") { follow.push({ ...r, note: { text: "รออนุมัติงาน — ยังเริ่มงานไม่ได้", color: AMBER } }); return; }
    if (r.approval === "rejected") { follow.push({ ...r, note: { text: "ไม่อนุมัติ — แก้ไขแล้วส่งขออนุมัติใหม่", color: RED } }); return; }
    if (r.closeReq) { follow.push({ ...r, note: { text: "ขอปิดงานแล้ว — รออนุมัติปิดงาน", color: "#0d9488" } }); return; }
    if (r.end.isBefore(today)) {
      const late = today.diff(r.end.clone().startOf("day"), "days");
      follow.push({ ...r, note: { text: `เลยวันทำงาน ${late} วัน — ยังไม่ปิดงาน`, color: RED } });
      return;
    }
    upcoming.push(r);
  });
  return { upcoming, follow, done };
};

/** ตัวเลขสรุปของหัวหน้า */
export const techSummary = (events) => {
  const today = moment().startOf("day");
  const rows = (events || []).filter(isTechRow).map(rowOf);
  const { follow } = classify(rows);
  return {
    today: rows.filter((r) => r.st !== DONE && !r.start.isAfter(today, "day") && !r.end.isBefore(today)).length,
    overdue: follow.filter((r) => r.note?.color === RED && r.approval === "approved").length,
    waiting: follow.filter((r) => r.approval === "pending" || r.closeReq).length,
    doneMonth: rows.filter((r) => r.st === DONE && r.start.isSame(today, "month")).length,
  };
};

/** หัวหน้าตารางงานช่าง */
export function TechTopBar({ events, onAdd, onTab, onExport, exportDisabled, title = "ตารางงานช่าง", sub, canAdd = true }) {
  const s = useMemo(() => techSummary(events), [events]);
  return (
    <Box sx={{ mb: { xs: 1, sm: 1.5 } }}>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: { xs: 1, sm: 1.25 } }}>
        <Box sx={{ width: { xs: 34, sm: 40 }, height: { xs: 34, sm: 40 }, borderRadius: 2.5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: alpha(RED, 0.1), color: RED }}>
          <EngineeringOutlined />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900, fontSize: { xs: "1rem", sm: "1.15rem" }, color: INK, lineHeight: 1.25 }}>{title}</Typography>
          <Typography noWrap sx={{ fontSize: { xs: "0.72rem", sm: "0.78rem" }, color: MUTED }}>{sub || "งานเข้าหน้างานของทีมช่าง · วันนี้ งานที่จะถึง และงานที่ต้องติดตาม"}</Typography>
        </Box>
        {onExport && (
          <Button variant="outlined" onClick={onExport} disabled={exportDisabled} startIcon={<FileDownloadOutlined />}
            sx={{ display: { xs: "none", sm: "inline-flex" }, textTransform: "none", fontWeight: 800, borderRadius: 2, color: "#15803d", borderColor: "#bbf7d0", "&:hover": { borderColor: "#16a34a", bgcolor: "#f0fdf4" } }}>
            Excel
          </Button>
        )}
        {canAdd && (
          <Button variant="contained" startIcon={<Add />} onClick={onAdd} sx={{ ...PRIMARY_BTN_SX, bgcolor: RED, "&:hover": { bgcolor: "#b91c1c", boxShadow: "none" }, px: { xs: 1.25, sm: 2 }, py: { xs: 0.5, sm: 0.75 }, fontSize: { xs: "0.82rem", sm: "0.875rem" } }}>
            <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>เพิ่มงาน</Box>
            <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>เพิ่ม</Box>
          </Button>
        )}
      </Stack>
      <Stack direction="row" spacing={{ xs: 0.75, sm: 1 }}>
        <Kpi label="งานวันนี้" value={s.today} color={INK} onClick={() => onTab("upcoming")} />
        <Kpi label="ค้างปิดงาน" value={s.overdue} color={RED} onClick={() => onTab("follow")} />
        <Kpi label="รออนุมัติ" value={s.waiting} color={AMBER} onClick={() => onTab("follow")} />
        <Box sx={{ flex: 1, minWidth: 0, display: { xs: "none", sm: "flex" } }}>
          <Kpi label="เสร็จเดือนนี้" value={s.doneMonth} color={GREEN} onClick={() => onTab("done")} />
        </Box>
      </Stack>
    </Box>
  );
}

/** แถวงาน 1 รายการ */
function Row({ r, onOpen }) {
  const c = TECH_STATUS_COLOR[r.st] || MUTED;
  const isDone = r.st === DONE;
  return (
    <ButtonBase onClick={() => onOpen(r.id)}
      sx={{
        width: "100%", display: "flex", alignItems: "stretch", textAlign: "left", gap: 1.25, px: 1.5, py: 1.25,
        borderTop: `1px solid ${LINE}`, "&:first-of-type": { borderTop: 0 }, "&:hover": { bgcolor: SURFACE },
      }}>
      <Box sx={{ width: 52, flexShrink: 0, pt: 0.25 }}>
        <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: /^\d/.test(r.time) ? INK : MUTED, lineHeight: 1.3, fontVariantNumeric: "tabular-nums" }}>
          {/^\d/.test(r.time) ? r.time.split("–")[0] : r.time}
        </Typography>
        {/^\d/.test(r.time) && r.time.includes("–") && <Typography sx={{ fontSize: "0.7rem", color: MUTED }}>{r.time.split("–")[1]}</Typography>}
      </Box>
      <Box sx={{ width: 4, borderRadius: 2, flexShrink: 0, bgcolor: r.color, boxShadow: "inset 0 0 0 1px rgba(15,23,42,.12)" }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0, flexWrap: "wrap", rowGap: 0.4 }}>
          <Box component="span" sx={{ px: 0.75, height: 20, display: "inline-flex", alignItems: "center", borderRadius: 1, fontSize: "0.7rem", fontWeight: 800, color: r.textColor, bgcolor: r.color, border: "1px solid rgba(15,23,42,.14)", whiteSpace: "nowrap", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
            {r.e.title || "งาน"}
          </Box>
          <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, height: 20, px: 0.8, borderRadius: 99, fontSize: "0.66rem", fontWeight: 800, bgcolor: alpha(c, 0.1), color: c, whiteSpace: "nowrap" }}>
            <Box component="span" sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: c }} />{isDone ? "เสร็จสิ้น" : r.st}
          </Box>
        </Stack>
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 800, color: INK, lineHeight: 1.35, mt: 0.3, overflowWrap: "anywhere" }}>
          {r.e.site || "-"}
        </Typography>
        <Typography noWrap sx={{ fontSize: "0.76rem", color: MUTED }}>
          {[r.e.company && r.e.company !== r.e.site ? r.e.company : "", r.e.system || ""].filter(Boolean).join(" · ") || "ไม่ระบุลูกค้า"}
        </Typography>
        {r.team.length > 0 && (
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25, color: INK_2 }}>
            <Groups2Outlined sx={{ fontSize: 15, color: FAINT }} />
            <Typography noWrap sx={{ fontSize: "0.76rem", fontWeight: 600 }}>{r.team.join(", ")}</Typography>
          </Stack>
        )}
        {r.note && <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: r.note.color, mt: 0.3 }}>{r.note.text}</Typography>}
      </Box>
      <ChevronRight sx={{ color: FAINT, fontSize: 20, flexShrink: 0 }} />
    </ButtonBase>
  );
}

function DayGroup({ day, rows, onOpen }) {
  const today = moment().startOf("day");
  const d = moment(day);
  const rel = d.isSame(today, "day") ? "วันนี้" : d.isSame(today.clone().add(1, "day"), "day") ? "พรุ่งนี้" : d.isSame(today.clone().subtract(1, "day"), "day") ? "เมื่อวาน" : "";
  return (
    <Box sx={{ mb: 1.5 }}>
      <Stack direction="row" alignItems="baseline" spacing={0.75} sx={{ px: 0.5, mb: 0.6 }}>
        {rel && <Typography sx={{ fontSize: "0.82rem", fontWeight: 900, color: rel === "วันนี้" ? RED : INK }}>{rel}</Typography>}
        <Typography sx={{ fontSize: "0.8rem", fontWeight: rel ? 600 : 800, color: rel ? MUTED : INK }}>{formatThai(d, "dddd D MMM YY")}</Typography>
        <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>· {rows.length} งาน</Typography>
      </Stack>
      <Box sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, overflow: "hidden" }}>
        {rows.map((r) => <Row key={r.id} r={r} onOpen={onOpen} />)}
      </Box>
    </Box>
  );
}

const groupByDay = (rows, dayOf) => {
  const map = new Map();
  rows.forEach((r) => {
    const k = dayOf(r).format("YYYY-MM-DD");
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  });
  return [...map.entries()];
};
const timeKey = (r) => (/^\d/.test(r.time) ? r.time.slice(0, 5) : "00:00");

/** มุมมองรายการของตารางงานช่าง */
export default function TechAgenda({ events, onOpen, onAdd, canAdd = true, tab, onTab }) {
  const today = moment().startOf("day");
  const rows = useMemo(() => (events || []).filter(isTechRow).map(rowOf), [events]);
  const { upcoming, follow, done } = useMemo(() => {
    const c = classify(rows);
    return {
      upcoming: c.upcoming.sort((a, b) => a.start - b.start || timeKey(a).localeCompare(timeKey(b))),
      follow: c.follow.sort((a, b) => a.start - b.start),
      done: c.done.sort((a, b) => b.start - a.start),
    };
  }, [rows]);

  const tabs = [
    { k: "upcoming", label: "งานที่จะถึง", n: upcoming.length, desc: "งานวันนี้และวันถัดไปที่ยังไม่เสร็จ (งานหลายวันที่ยังทำอยู่แสดงที่วันนี้)" },
    { k: "follow", label: "ต้องติดตาม", n: follow.length, color: RED, desc: "เลยวันทำงานแต่ยังไม่ปิดงาน · รออนุมัติงาน · ขอปิดงานรออนุมัติ" },
    { k: "done", label: "เสร็จสิ้น", n: done.length, desc: "งานที่ดำเนินการเสร็จสิ้นแล้ว (ล่าสุดก่อน)" },
  ];
  const cur = tabs.find((t) => t.k === tab) || tabs[0];
  const full = cur.k === "follow" ? follow : cur.k === "done" ? done : upcoming;
  const pg = usePaged(full, cur.k);
  const list = pg.items;
  // งานหลายวันที่เริ่มไปแล้วแต่ยังไม่จบ → แสดงในกลุ่ม "วันนี้"
  const dayOf = (r) => (cur.k === "upcoming" && r.start.isBefore(today) ? today : r.start);

  return (
    <Box ref={pg.topRef} sx={{ scrollMarginTop: 80 }}>
      <Stack direction="row" spacing={0.75} sx={{ mb: 0.75, overflowX: "auto", pb: 0.25 }}>
        {tabs.map((t) => {
          const on = cur.k === t.k;
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
      <Typography sx={{ px: 0.5, mb: 1.5, fontSize: "0.76rem", color: MUTED }}>{cur.desc}</Typography>

      {list.length === 0 ? (
        <Box sx={{ py: 5, px: 2, textAlign: "center", bgcolor: "#fff", border: `1px dashed ${LINE}`, borderRadius: 3 }}>
          <EngineeringOutlined sx={{ fontSize: 34, color: FAINT }} />
          <Typography sx={{ mt: 0.75, fontWeight: 800, color: INK_2 }}>
            {cur.k === "follow" ? "ไม่มีงานที่ต้องติดตาม" : cur.k === "done" ? "ยังไม่มีงานที่เสร็จสิ้น" : "ไม่มีงานที่จะถึง"}
          </Typography>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
            {cur.k === "follow" ? "ทุกงานปิดงานและได้รับอนุมัติเรียบร้อย" : canAdd ? "กด “เพิ่มงาน” เพื่อลงงานใหม่" : ""}
          </Typography>
          {cur.k === "upcoming" && canAdd && (
            <Button startIcon={<Add />} onClick={onAdd} sx={{ mt: 1.5, textTransform: "none", fontWeight: 800, color: RED }}>เพิ่มงาน</Button>
          )}
        </Box>
      ) : cur.k === "follow" ? (
        <Box sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, overflow: "hidden" }}>
          {list.map((r) => <Row key={r.id} r={r} onOpen={onOpen} />)}
        </Box>
      ) : (
        groupByDay(list, dayOf).map(([day, rs]) => <DayGroup key={day} day={day} rows={rs} onOpen={onOpen} />)
      )}

      <ListPager {...pg} accent={RED} />
    </Box>
  );
}
