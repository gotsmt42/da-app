/**
 * MyActionAlerts — กล่อง "ต้องทำตอนนี้" บนหน้าแรก (ช่าง/ผู้รับผิดชอบ/หัวหน้าทีม)
 *
 * ✅ (20 ต.ค. 2569 ผู้ใช้: "เตือนช่างตั้งแต่หน้าแรกเลยว่ามีงานที่ไม่กดรับทราบ ไม่กดบันทึกงานเมื่อถึงเวลา
 *    ให้ชัดเจน ป้องกันการผิดพลาด กันลืม ให้สวยงาม สมบูรณ์")
 *    3 เรื่องที่ลืมบ่อย — กดแล้วไปที่งานนั้นในงานของฉันทันที
 *      1) ยังไม่รับทราบงาน (ผู้รับผิดชอบ · ไม่มีผู้รับผิดชอบ = หัวหน้าทีม)
 *      2) รับทราบแล้ว ยังไม่ยืนยันนัดหมาย
 *      3) ถึงวันเข้างานแล้ว (รวมวันที่ 2,3… ของงานหลายวัน) หัวหน้าทีมยังไม่บันทึกเข้างานของวันนี้
 *    ไม่มีอะไรค้าง = ไม่แสดงกล่อง (ไม่กินพื้นที่)
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import moment from "moment";
import { Box, ButtonBase, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ThumbUpAltOutlined, EventAvailableOutlined, LoginRounded, ChevronRight } from "@mui/icons-material";
import AttendanceService from "@/shared/services/AttendanceService";
import useRealtime from "@/shared/realtime/useRealtime";
import { ackTracked } from "@/shared/utils/jobFlow";
import { formatThai } from "@/shared/utils/thaiDate";

const OPEN = ["กำลังรอยืนยัน", "ยืนยันแล้ว", "กำลังดำเนินการ"];
const bkk = (d) => moment(d).utcOffset(7);
/** วันแรก/วันสุดท้ายของงาน (allDay: end = วันถัดไป 00:00 — กติกาเดียวกับทั้งแอป) */
const spanOf = (e) => {
  const first = bkk(e.start).startOf("day");
  let last = e.end ? bkk(e.end).subtract(e.allDay ? 1 : 0, "day").startOf("day") : first.clone();
  if (last.isBefore(first)) last = first.clone();
  return { first, last };
};

export default function MyActionAlerts({ events, userData }) {
  const me = String(userData?.userId || "");
  const fname = userData?.fname || "";
  const [todayRows, setTodayRows] = useState(null);
  const today = moment().utcOffset(7).format("YYYY-MM-DD");

  const load = () => AttendanceService.list({ from: today, to: today })
    .then((d) => setTodayRows(new Set((d?.attendance || []).map((r) => String(r.eventId)))))
    .catch(() => setTodayRows(new Set()));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- โหลดตอนเปิดหน้า/เปลี่ยนวัน
  useEffect(() => { load(); }, [today]);
  useRealtime("attendance", () => { load(); });

  const groups = useMemo(() => {
    const ack = []; const confirm = []; const checkin = [];
    const seen = { ack: new Set(), confirm: new Set(), checkin: new Set() };
    const push = (list, key, e) => { const k = String(e.jobGroupId || e._id); if (seen[key].has(k)) return; seen[key].add(k); list.push(e); };
    const now0 = moment().utcOffset(7).startOf("day");
    (events || []).forEach((e) => {
      if (!e || e.unscheduled || e.department === "sales" || e.cancelledAt || !OPEN.includes(e.status) || e.closeRequested) return;
      if (["pending", "rejected"].includes(e.approvalStatus)) return;
      const isResp = String(e.responsiblePersonId || "") === me || (fname && e.responsiblePerson === fname);
      const isHead = String(e.resPerson || "") === me || (fname && e.team === fname);
      const hasResp = Boolean(e.responsiblePersonId || e.responsiblePerson);
      const canAck = hasResp ? isResp : isHead;
      const acked = (e.acks || []).length > 0 || !ackTracked(e);
      if (canAck && e.status === "กำลังรอยืนยัน" && !e.ackDeclined?.userId) {
        if (!acked) push(ack, "ack", e);
        else push(confirm, "confirm", e);
        return;
      }
      const headish = isHead || (!e.team && !e.resPerson && isResp);
      if (headish && ["ยืนยันแล้ว", "กำลังดำเนินการ"].includes(e.status) && todayRows) {
        const { first, last } = spanOf(e);
        if (!now0.isBefore(first) && !now0.isAfter(last) && !todayRows.has(String(e._id))) push(checkin, "checkin", e);
      }
    });
    const byStart = (a, b) => new Date(a.start) - new Date(b.start);
    return { ack: ack.sort(byStart), confirm: confirm.sort(byStart), checkin: checkin.sort(byStart) };
  }, [events, me, fname, todayRows]);

  const rows = [
    { key: "checkin", list: groups.checkin, color: "#dc2626", icon: <LoginRounded />, title: "ถึงวันเข้างาน · ยังไม่บันทึกเข้างาน", hint: "ถึงหน้างานแล้วกด “บันทึกเข้างาน” พร้อมถ่ายรูป" },
    { key: "ack", list: groups.ack, color: "#d97706", icon: <ThumbUpAltOutlined />, title: "ยังไม่กดรับทราบงาน", hint: "กดรับทราบ (หรือปฏิเสธพร้อมเหตุผล)" },
    { key: "confirm", list: groups.confirm, color: "#2563eb", icon: <EventAvailableOutlined />, title: "ยังไม่ยืนยันนัดหมาย", hint: "ยืนยันวันกับลูกค้าแล้วกด “ยืนยันนัดหมาย”" },
  ].filter((r) => r.list.length);
  if (!rows.length) return null;

  const label = (e) => `${e.site || e.company || e.title || "งาน"}`;
  const dayText = (e) => {
    const { first, last } = spanOf(e);
    const n = last.diff(first, "days") + 1;
    if (n > 1 && !moment().utcOffset(7).isBefore(first, "day")) return `วันที่ ${moment().utcOffset(7).startOf("day").diff(first, "days") + 1}/${n}`;
    return first.isSame(moment().utcOffset(7), "day") ? "วันนี้" : formatThai(first, "D MMM");
  };

  return (
    <Box sx={{ mb: 2, bgcolor: "#fff", border: `1px solid ${alpha("#dc2626", 0.25)}`, borderRadius: 3, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,23,42,.06)" }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ px: 1.75, py: 1, bgcolor: "#fef2f2", borderBottom: `1px solid ${alpha("#dc2626", 0.15)}` }}>
        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#dc2626", boxShadow: `0 0 0 4px ${alpha("#dc2626", 0.15)}` }} />
        <Typography sx={{ flex: 1, fontWeight: 900, fontSize: "0.92rem", color: "#991b1b" }}>ต้องทำตอนนี้</Typography>
        <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: "#b91c1c" }}>{rows.reduce((n, r) => n + r.list.length, 0)} งาน</Typography>
      </Stack>
      {rows.map((r, i) => (
        <ButtonBase key={r.key} component={Link} to={`/technician/jobs?job=${r.list[0]._id}`}
          sx={{ width: "100%", display: "flex", alignItems: "center", gap: 1.25, px: 1.75, py: 1.15, textAlign: "left", fontFamily: "inherit", textDecoration: "none",
            borderTop: i ? `1px solid ${LINE}` : 0, "&:hover": { bgcolor: "#f8fafc" } }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2.5, flexShrink: 0, display: "grid", placeItems: "center", bgcolor: alpha(r.color, 0.1), color: r.color, "& svg": { fontSize: 20 } }}>{r.icon}</Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 800, color: "#0f172a", lineHeight: 1.3 }}>
              {r.title} <Box component="span" sx={{ ml: 0.4, px: 0.7, borderRadius: 99, bgcolor: r.color, color: "#fff", fontSize: "0.72rem", fontWeight: 900 }}>{r.list.length}</Box>
            </Typography>
            <Typography noWrap sx={{ fontSize: "0.74rem", color: "#475569" }}>
              {r.list.slice(0, 2).map((e) => `${label(e)} (${dayText(e)})`).join(" · ")}{r.list.length > 2 ? ` · และอีก ${r.list.length - 2}` : ""}
            </Typography>
            <Typography noWrap sx={{ fontSize: "0.68rem", color: "#94a3b8" }}>{r.hint}</Typography>
          </Box>
          <ChevronRight sx={{ fontSize: 20, color: "#cbd5e1", flexShrink: 0 }} />
        </ButtonBase>
      ))}
    </Box>
  );
}

const LINE = "#e2e8f0";
