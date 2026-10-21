/**
 * MultiDayGroup — งานหลายช่วงวัน (ไม่ต่อเนื่อง) ชุดเดียวกันทั้งหน้าการดำเนินงานและงานของฉัน
 *
 * ✅ ผู้ใช้สั่ง (3 ต.ค. 2569): "ทำให้มองแล้วรู้ว่างานมีหลายช่วงวัน · รูปแบบต้องเหมือนกันกับหน้างานของฉัน"
 *    การ์ดซ้อนเป็นปึก + ป้ายน้ำเงิน "งานหลายช่วงวัน · N ช่วง" + หัวพื้นเทาอ่อน
 * 🔁 (20 ต.ค. 2569 ผู้ใช้: "แยกให้ละเอียดและชัดเจน พวกงานไม่ต่อเนื่อง หลายช่วงวัน ทำให้สมบูรณ์ และถูกต้อง")
 *    • หัวการ์ด: ช่วงไหน "วันนี้" · บันทึกเข้างานแล้วกี่วันจากทั้งหมด · ป้ายทุกช่วงมีเลขลำดับและสีตามสถานะจริง
 *        ✓ เขียว = บันทึกครบ · ส้ม = ผ่านไปแล้วแต่บันทึกไม่ครบ · น้ำเงินทึบ = ช่วงวันนี้ · ขาว = ยังไม่ถึง
 *    • รายการช่วง (SessionList): ช่วงปัจจุบัน/ถัดไปขึ้นก่อน → ช่วงที่ยังไม่ถึง → ช่วงที่ผ่านมา (พับไว้) — ไม่ยาวเหยียด 15 การ์ด
 *    • ทุกช่วงมีแถบหัว "ช่วงที่ k/N · วันที่ · สถานะ · บันทึกแล้ว x/y วัน"
 */
import { useEffect, useMemo, useState } from "react";
import moment from "moment";
import { Box, ButtonBase, Collapse, IconButton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { DateRange, CalendarMonth, Description, ExpandLess, ExpandMore, CheckRounded } from "@mui/icons-material";
import AttendanceService from "@/shared/services/AttendanceService";
import useRealtime from "@/shared/realtime/useRealtime";
import { formatThai } from "@/shared/utils/thaiDate";
import { FLOW_SINCE } from "@/shared/utils/jobFlow";
import { GroupSessionContext } from "./groupSessionContext";
const PRIMARY = { primary: true };
const FOLLOWER = { primary: false };

/** sx ของกรอบการ์ดกลุ่ม (ใส่ให้ Card/Box ภายนอก) */
export const multiDayCardSx = (statusColor = "#94a3b8") => ({
  mb: 3, borderRadius: 4, bgcolor: "background.paper", overflow: "visible",
  border: "1px solid #e2e8f0", borderLeft: `4px solid ${statusColor}`,
  boxShadow: "0 5px 0 -1px #fff, 0 5px 0 0 #cbd5e1, 0 10px 0 -2px #fff, 0 10px 0 -1px #e2e8f0, 0 1px 3px rgba(15,23,42,.06)",
});

const bkk = (d) => moment(d).utcOffset(7);
const dayStart = (s) => bkk(s.start).startOf("day");
const dayEnd = (s) => {
  const a = dayStart(s);
  const b = s.end ? bkk(s.end).subtract(s.allDay ? 1 : 0, "days").startOf("day") : a.clone();
  return b.isBefore(a) ? a : b;
};
const plannedDaysOf = (s) => dayEnd(s).diff(dayStart(s), "days") + 1;
const rangeLabel = (s) => {
  const a = dayStart(s); const b = dayEnd(s);
  if (a.isSame(b, "day")) return formatThai(a, "D MMM");
  return a.isSame(b, "month") ? `${a.format("D")}–${formatThai(b, "D MMM")}` : `${formatThai(a, "D MMM")} – ${formatThai(b, "D MMM")}`;
};

/**
 * บันทึกเข้างานของทั้งกลุ่ม → Map<eventId, Set<"YYYY-MM-DD">> (เวลาไทย) · null = ยังโหลดไม่เสร็จ
 * ⚠️ เรียกครั้งเดียวต่อกลุ่ม (ส่งต่อให้หัวการ์ด/รายการช่วง) — ไม่ยิงซ้ำทุกช่วง
 */
export function useGroupAttendance(sessions, enabled = true) {
  const anchorId = sessions?.[0]?._id;
  const grouped = enabled && (sessions || []).length > 1;
  const [map, setMap] = useState(null);
  const load = () => {
    if (!grouped || !anchorId) return;
    AttendanceService.ofEvent(anchorId, { group: true })
      .then((d) => {
        const m = new Map();
        (d?.attendance || []).forEach((r) => {
          const at = r.checkIn?.at;
          if (!at) return;
          const k = String(r.eventId);
          if (!m.has(k)) m.set(k, new Set());
          m.get(k).add(bkk(at).format("YYYY-MM-DD"));
        });
        setMap(m);
      })
      .catch(() => setMap((p) => p || new Map()));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- โหลดใหม่เมื่อเปลี่ยนกลุ่ม
  useEffect(load, [anchorId, grouped]);
  useRealtime("attendance", () => { load(); });
  return map;
}

const EMPTY = new Set();
/** บันทึกของช่วงนั้น — โหลดแล้วแต่ไม่มีบันทึก = เซตว่าง (ไม่ใช่ "ไม่รู้") */
const recOf = (att, s) => (att ? att.get(String(s._id)) || EMPTY : undefined);

/** สถานะของแต่ละช่วงวัน */
export function sessionStateOf(s, recorded) {
  const today = moment().utcOffset(7).startOf("day");
  const planned = plannedDaysOf(s);
  const done = Math.min(recorded ? recorded.size : 0, planned);
  const closed = s.status === "ดำเนินการเสร็จสิ้น";
  if (!today.isBefore(dayStart(s)) && !today.isAfter(dayEnd(s))) {
    const dayNo = today.diff(dayStart(s), "days") + 1;
    const todayDone = recorded?.has(today.format("YYYY-MM-DD"));
    return { key: "today", label: `วันนี้ · วันที่ ${dayNo}/${planned}${todayDone ? " ✓" : ""}`, color: "#2563eb", planned, done, todayDone };
  }
  if (today.isBefore(dayStart(s))) {
    const inDays = dayStart(s).diff(today, "days");
    return { key: "upcoming", label: inDays === 1 ? "พรุ่งนี้" : `อีก ${inDays} วัน`, color: "#64748b", planned, done };
  }
  if (closed || (recorded && done >= planned)) return { key: "done", label: `บันทึกครบ ${planned} วัน`, color: "#16a34a", planned, done };
  // 🐛 (20 ต.ค. 2569) ช่วงที่จบก่อนเริ่มใช้ระบบบันทึกเข้างาน — ไม่มีบันทึกเป็นเรื่องปกติ ไม่ใช่ "บันทึกไม่ครบ"
  if (dayEnd(s).isBefore(moment(FLOW_SINCE).utcOffset(7).startOf("day")) && !done) return { key: "legacy", label: "ก่อนเริ่มใช้ระบบบันทึก", color: "#64748b", planned, done };
  if (!recorded) return { key: "past", label: "ผ่านไปแล้ว", color: "#64748b", planned, done };
  return { key: "missing", label: done ? `บันทึก ${done}/${planned} วัน` : "ไม่ได้บันทึกเข้างาน", color: "#d97706", planned, done };
}

/** เรียงช่วงตามความสำคัญ: วันนี้ → ถัดไป (ใกล้สุดก่อน) → ผ่านมาแล้ว (ล่าสุดก่อน) */
export function orderSessions(sessions, att) {
  const asc = sessions.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
  const withState = asc.map((s, i) => ({ s, order: i + 1, st: sessionStateOf(s, recOf(att, s)) }));
  const now = withState.filter((x) => x.st.key === "today");
  const next = withState.filter((x) => x.st.key === "upcoming");
  const past = withState.filter((x) => !["today", "upcoming"].includes(x.st.key)).reverse();
  return { now, next, past, total: asc.length };
}

/**
 * @param sessions ทุกช่วงของงาน · anchorId = ช่วงที่ถือเอกสาร/ขอปิดงาน · title = ชื่องานบรรทัดหลัก · att = useGroupAttendance
 */
export default function MultiDayGroupHeader({ sessions, anchorId, title, expanded, onToggle, att }) {
  const sorted = sessions.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
  const last = sorted.reduce((l, s) => (dayEnd(s).isAfter(dayEnd(l)) ? s : l), sorted[0]);
  const totalWorkDays = sessions.reduce((sum, s) => sum + plannedDaysOf(s), 0);
  const recordedTotal = att ? sessions.reduce((n, s) => n + Math.min(att.get(String(s._id))?.size || 0, plannedDaysOf(s)), 0) : null;
  const anchor = sessions.find((s) => s._id === anchorId) || sessions[0];
  const { now, next } = orderSessions(sessions, att);
  const focus = now[0] || next[0];

  return (
    <Box onClick={onToggle} sx={{ px: 2, py: 1.5, cursor: "pointer", bgcolor: "#f8fafc", borderRadius: "14px 14px 0 0", borderBottom: expanded ? "1px solid #e2e8f0" : "none" }}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, height: 24, pl: 0.75, pr: 1, borderRadius: 999, bgcolor: "#2563eb", color: "#fff", fontSize: "0.72rem", fontWeight: 800, whiteSpace: "nowrap" }}>
          <DateRange sx={{ fontSize: 15 }} /> งานหลายช่วงวัน · {sessions.length} ช่วง
        </Box>
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" sx={{ color: "#94a3b8", mr: -0.75 }} onClick={(e) => { e.stopPropagation(); onToggle?.(); }} aria-label={expanded ? "พับ" : "กาง"}>
          {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
        </IconButton>
      </Stack>
      <Typography sx={{ mt: 0.5, fontWeight: 800, fontSize: "0.95rem", color: "#0f172a", lineHeight: 1.35 }}>{title}</Typography>
      <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{ mt: 0.5 }}>
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", height: 22, px: 1, borderRadius: 999, bgcolor: "#eff6ff", color: "#1d4ed8", fontSize: "0.72rem", fontWeight: 800 }}>
          เข้างาน {totalWorkDays} วัน{recordedTotal !== null ? ` · บันทึกแล้ว ${recordedTotal}` : ""}
        </Box>
        <Typography sx={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 0.4 }}>
          <CalendarMonth sx={{ fontSize: 14, color: "#94a3b8" }} />{formatThai(dayStart(sorted[0]), "D MMM")} – {formatThai(dayEnd(last), "D MMM YYYY")}
        </Typography>
      </Stack>
      {/* ตอนนี้อยู่ช่วงไหน — สำคัญที่สุดของงานหลายช่วง */}
      {focus && (
        <Stack direction="row" alignItems="center" gap={0.75} sx={{ mt: 1, px: 1.1, py: 0.7, borderRadius: 2, bgcolor: alpha(focus.st.color, 0.08), border: `1px solid ${alpha(focus.st.color, 0.25)}` }}>
          <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: focus.st.color, flexShrink: 0 }} />
          <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: focus.st.color }}>
            {focus.st.key === "today" ? "ตอนนี้" : "ถัดไป"}: ช่วงที่ {focus.order}/{sessions.length} · {rangeLabel(focus.s)}
          </Typography>
          <Typography noWrap sx={{ fontSize: "0.74rem", color: "#475569", minWidth: 0 }}>· {focus.st.label}</Typography>
        </Stack>
      )}
      <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 1 }}>
        {sorted.map((s, i) => {
          const st = sessionStateOf(s, recOf(att, s));
          const solid = st.key === "today";
          const tone = { done: "#16a34a", missing: "#d97706", today: "#2563eb" }[st.key];
          return (
            <Box key={s._id} component="span" title={`ช่วงที่ ${i + 1} · ${rangeLabel(s)} · ${st.label}`} sx={{
              display: "inline-flex", alignItems: "center", gap: 0.35, height: 22, px: 0.8, borderRadius: 999, fontSize: "0.7rem", whiteSpace: "nowrap",
              fontWeight: tone ? 800 : 600, bgcolor: solid ? tone : tone ? alpha(tone, 0.08) : "#fff", color: solid ? "#fff" : tone || "#475569",
              border: `1px solid ${tone ? alpha(tone, solid ? 1 : 0.35) : "#cbd5e1"}`,
            }}>
              <Box component="span" sx={{ opacity: 0.7, fontWeight: 900 }}>{i + 1}</Box>
              {rangeLabel(s)}
              {st.key === "done" && <CheckRounded sx={{ fontSize: 13 }} />}
              {st.key === "missing" && <Box component="span" sx={{ fontWeight: 900 }}>!</Box>}
            </Box>
          );
        })}
      </Stack>
      <Stack direction="row" gap={1.25} flexWrap="wrap" sx={{ mt: 0.75 }}>
        {[["#16a34a", "บันทึกครบ"], ["#d97706", "บันทึกไม่ครบ"], ["#2563eb", "วันนี้"], ["#94a3b8", "ยังไม่ถึง"]].map(([c, l]) => (
          <Typography key={l} sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, fontSize: "0.66rem", color: "#94a3b8" }}>
            <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: c }} />{l}
          </Typography>
        ))}
      </Stack>
      <Typography sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5, fontSize: "0.72rem", color: "#94a3b8" }}>
        <Description sx={{ fontSize: 13 }} />
        เอกสาร/ขอปิดงาน อยู่ที่ช่วงวันที่ {formatThai(dayStart(anchor), "D MMM")} (ช่วงล่าสุด)
      </Typography>
    </Box>
  );
}

/** แถบหัวของแต่ละช่วง: ช่วงที่ k/N · วันที่ · สถานะ · (ถือเอกสาร) */
export function SessionBar({ order, total, session, st, isAnchor }) {
  return (
    <Stack direction="row" alignItems="center" gap={1} sx={{ px: 2, py: 0.85, bgcolor: st.key === "today" ? alpha("#2563eb", 0.06) : "#f8fafc", borderBottom: "1px solid #e2e8f0", flexWrap: "wrap", rowGap: 0.5 }}>
      <Typography sx={{ fontSize: "0.76rem", fontWeight: 900, color: "#0f172a", whiteSpace: "nowrap" }}>ช่วงที่ {order}/{total}</Typography>
      {/* 🐛 (21 ต.ค. 2569 ผู้ใช้: "ตัวหนังสือทับกัน") วันที่ไม่หดจนป้ายสถานะทับ — ที่ไม่พอ ป้ายลงบรรทัดใหม่แทน */}
      <Typography sx={{ flex: "1 0 auto", fontSize: "0.74rem", fontWeight: 600, color: "#64748b", whiteSpace: "nowrap" }}>{rangeLabel(session)} · {plannedDaysOf(session)} วัน</Typography>
      <Box component="span" sx={{ flexShrink: 0, px: 0.9, height: 22, display: "inline-flex", alignItems: "center", borderRadius: 99, fontSize: "0.68rem", fontWeight: 800,
        color: st.color, bgcolor: alpha(st.color, 0.1) }}>{st.label}</Box>
      {isAnchor && (
        <Box component="span" sx={{ flexShrink: 0, px: 0.9, height: 22, display: "inline-flex", alignItems: "center", borderRadius: 99, fontSize: "0.66rem", fontWeight: 800, color: "#2563eb", bgcolor: "#eff6ff", border: "1px solid #bfdbfe" }}>
          ถือเอกสาร/ขอปิดงาน
        </Box>
      )}
    </Stack>
  );
}

/**
 * รายการช่วงวัน — วันนี้/ถัดไปขึ้นก่อน · ช่วงที่ผ่านมาพับไว้ (กดดูได้) · แต่ละช่วงอยู่ในกรอบของตัวเอง
 * @param renderCard (session) => การ์ดงานของช่วงนั้น
 */
export function SessionList({ sessions, anchorId, att, renderCard }) {
  const { now, next, past, total } = useMemo(() => orderSessions(sessions, att), [sessions, att]);
  const [showPast, setShowPast] = useState(false);
  // ไม่มีช่วงปัจจุบัน/ถัดไปเลย (งานจบหมดแล้ว) → เปิดช่วงที่ผ่านมาให้เลย
  const pastOpen = showPast || (!now.length && !next.length);
  // ช่วงที่ถือเอกสาร/ขอปิดงาน ต้องเห็นเสมอ แม้อยู่ในกลุ่มที่ผ่านมา
  const anchorPast = past.find((x) => x.s._id === anchorId);
  // ช่วงหลัก = ช่วงบนสุดที่แสดง (วันนี้ → ถัดไป → ช่วงที่ถือเอกสาร) — ปุ่มรับทราบ/ยืนยันนัด (มีผลทั้งงาน) อยู่ที่ช่วงนี้ช่วงเดียว
  const primaryId = (now[0] || next[0] || anchorPast || past[0])?.s._id;
  const frame = (x) => (
    <GroupSessionContext.Provider key={x.s._id} value={x.s._id === primaryId ? PRIMARY : FOLLOWER}>
    <Box sx={{ bgcolor: "#fff", border: `1px solid ${x.st.key === "today" ? alpha("#2563eb", 0.4) : "#e2e8f0"}`, borderRadius: 3, overflow: "hidden", boxShadow: "0 1px 2px rgba(15,23,42,.05)" }}>
      <SessionBar order={x.order} total={total} session={x.s} st={x.st} isAnchor={x.s._id === anchorId} />
      {renderCard(x.s)}
    </Box>
    </GroupSessionContext.Provider>
  );
  return (
    <Stack spacing={1.25}>
      {[...now, ...next.slice(0, now.length ? 1 : 2)].map(frame)}
      {/* ช่วงถัดๆ ไปเป็นรายการวันที่สั้นๆ — ยกเว้นช่วงที่ถือเอกสาร/ขอปิดงาน ต้องเป็นการ์ดเสมอ */}
      {(() => {
        const rest = next.slice(now.length ? 1 : 2);
        const anchorNext = rest.find((x) => x.s._id === anchorId);
        const others = rest.filter((x) => x.s._id !== anchorId);
        return (<>
          {others.length > 0 && <NextMore list={others} total={total} />}
          {anchorNext && frame(anchorNext)}
        </>);
      })()}
      {anchorPast && !pastOpen && frame(anchorPast)}
      {past.length > 0 && (
        <ButtonBase onClick={() => setShowPast((v) => !v)} sx={{ justifyContent: "flex-start", gap: 0.75, px: 1.5, py: 1, borderRadius: 2.5, border: "1px dashed #cbd5e1", bgcolor: "#fff", fontFamily: "inherit" }}>
          <Typography sx={{ flex: 1, textAlign: "left", fontSize: "0.8rem", fontWeight: 800, color: "#475569" }}>
            ช่วงที่ผ่านมา {past.length} ช่วง
            <Box component="span" sx={{ ml: 0.75, fontWeight: 600, color: "#94a3b8" }}>
              {past.filter((x) => x.st.key === "missing").length ? `· บันทึกไม่ครบ ${past.filter((x) => x.st.key === "missing").length} ช่วง` : ""}
            </Box>
          </Typography>
          {pastOpen ? <ExpandLess sx={{ fontSize: 20, color: "#94a3b8" }} /> : <ExpandMore sx={{ fontSize: 20, color: "#94a3b8" }} />}
        </ButtonBase>
      )}
      <Collapse in={pastOpen} unmountOnExit>
        <Stack spacing={1.25}>{past.filter((x) => pastOpen || x.s._id !== anchorId).map(frame)}</Stack>
      </Collapse>
    </Stack>
  );
}

/** ช่วงถัดๆ ไปที่ยังไม่ถึง — แสดงเป็นรายการวันที่สั้นๆ (ไม่ต้องมีการ์ดเต็มทุกช่วง) */
function NextMore({ list, total }) {
  return (
    <Box sx={{ px: 1.5, py: 1, borderRadius: 2.5, border: "1px solid #e2e8f0", bgcolor: "#fff" }}>
      <Typography sx={{ fontSize: "0.76rem", fontWeight: 800, color: "#475569", mb: 0.5 }}>ช่วงถัดไปอีก {list.length} ช่วง</Typography>
      <Stack direction="row" gap={0.5} flexWrap="wrap">
        {list.map((x) => (
          <Box key={x.s._id} component="span" sx={{ px: 0.8, height: 22, display: "inline-flex", alignItems: "center", gap: 0.4, borderRadius: 99, fontSize: "0.7rem", fontWeight: 600, color: "#475569", border: "1px solid #cbd5e1" }}>
            <Box component="span" sx={{ fontWeight: 900, opacity: 0.7 }}>{x.order}/{total}</Box>{rangeLabel(x.s)}
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
