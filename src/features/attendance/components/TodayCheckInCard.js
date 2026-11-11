/**
 * TodayCheckInCard — "บันทึกเข้างานวันนี้" บนหน้าแรก (ช่าง / ทุกคนที่มีชื่อในทีมงานวันนี้)
 *
 * ✅ (11 พ.ย. 2569 ผู้ใช้: "บังคับทุกคนที่มีชื่อในงานบันทึกเข้างานเอง · เอามาแสดงแถบหน้า dashboard ของช่างด้วย
 *    จัดวางให้ดูมืออาชีพและไม่รก")
 *    • แสดงเฉพาะเมื่อวันนี้มีงานที่ฉันอยู่ในทีม (หัวหน้าทีม/ลูกทีม) — ไม่มีงาน = ไม่แสดงอะไรเลย
 *    • หัว: "บันทึกเข้างานวันนี้" + บันทึกแล้ว x/y · แถวละงาน: ชื่องาน · โครงการ · ✓ เวลา หรือปุ่ม "บันทึกเข้างาน"
 *    • แสดงไม่เกิน 3 งาน (ที่ยังไม่บันทึกขึ้นก่อน) · มากกว่านั้นมีลิงก์ "ดูทั้งหมด"
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import moment from "moment";
import { Box, ButtonBase, Stack, Typography } from "@mui/material";
import { LoginRounded, CheckCircleRounded, ChevronRightRounded, PlaceRounded } from "@mui/icons-material";
import AttendanceService from "@/shared/services/AttendanceService";

const CLOSED = "ดำเนินการเสร็จสิ้น";
const dayKey = (d) => moment(d).utcOffset(7).format("YYYY-MM-DD");

/** ฉันอยู่ในทีมของงานนี้ (หัวหน้าทีม / ลูกทีม) */
const onTeam = (e, me, fname) => (e.resPerson && String(e.resPerson) === me)
  || (fname && e.team === fname)
  || (e.teamMembers || []).some((m) => (m?.userId && String(m.userId) === me) || (fname && m?.name === fname));

/**
 * @param events    งานวันนี้ (หน้าแม่กรองวันแล้ว)
 * @param userData  ผู้ใช้ปัจจุบัน
 */
export default function TodayCheckInCard({ events = [], userData, sx }) {
  const me = String(userData?.userId || "");
  const fname = userData?.fname || "";
  const jobs = useMemo(() => {
    const seen = new Set();
    return events.filter((e) => e && e.status !== CLOSED && e.department !== "sales" && !e.noVisit && !e.unscheduled
      && e.approvalStatus !== "pending" && e.approvalStatus !== "rejected" && onTeam(e, me, fname)
      && !seen.has(String(e._id)) && seen.add(String(e._id)));
  }, [events, me, fname]);
  const [mine, setMine] = useState(null); // eventId → เวลาเข้างานวันนี้

  useEffect(() => {
    if (!jobs.length || !me) return undefined;
    let alive = true;
    const today = dayKey(new Date());
    AttendanceService.list({ from: today, to: today, userId: me })
      .then((r) => {
        if (!alive) return;
        const m = new Map();
        (r?.attendance || []).filter((a) => String(a.userId) === me && a.checkIn?.at && dayKey(a.checkIn.at) === today)
          .forEach((a) => { m.set(String(a.eventId), a.checkIn.at); if (a.jobGroupId) m.set(`g:${a.jobGroupId}`, a.checkIn.at); });
        setMine(m);
      })
      .catch(() => alive && setMine(new Map()));
    return () => { alive = false; };
  }, [jobs.length, me]);

  if (!jobs.length) return null;
  const doneAt = (e) => mine?.get(String(e._id)) || (e.jobGroupId ? mine?.get(`g:${e.jobGroupId}`) : null) || null;
  const doneCount = jobs.filter(doneAt).length;
  const sorted = [...jobs].sort((a, b) => Boolean(doneAt(a)) - Boolean(doneAt(b)) || String(a.startTime || "").localeCompare(String(b.startTime || "")));
  const shown = sorted.slice(0, 3);
  const allDone = mine && doneCount === jobs.length;

  return (
    <Box sx={{ bgcolor: "#fff", border: "1px solid #e6e9ef", borderRadius: 3, overflow: "hidden", ...sx }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ px: 1.75, py: 1.1, borderBottom: "1px solid #f1f5f9" }}>
        <Box sx={{ width: 30, height: 30, borderRadius: "9px", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: allDone ? "#f0fdf4" : "#eff6ff", color: allDone ? "#16a34a" : "#2563eb" }}>
          <PlaceRounded sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.92rem", fontWeight: 800, color: "#0f172a", lineHeight: 1.3 }}>บันทึกเข้างานวันนี้</Typography>
          <Typography sx={{ fontSize: "0.72rem", color: "#64748b" }}>ทุกคนในทีมกดบันทึกของตัวเอง · ถ่ายรูป + ตำแหน่ง</Typography>
        </Box>
        {mine && (
          <Box component="span" sx={{ flexShrink: 0, px: 1, py: 0.3, borderRadius: 99, fontSize: "0.74rem", fontWeight: 800,
            color: allDone ? "#15803d" : "#b45309", bgcolor: allDone ? "#f0fdf4" : "#fffbeb", border: `1px solid ${allDone ? "#bbf7d0" : "#fde68a"}` }}>
            บันทึกแล้ว {doneCount}/{jobs.length}
          </Box>
        )}
      </Stack>
      {shown.map((e, i) => {
        const at = doneAt(e);
        return (
          <ButtonBase key={e._id} component={Link} to={`/operation/${e._id}`}
            sx={{ width: "100%", display: "flex", alignItems: "center", gap: 1.25, px: 1.75, py: 1, textAlign: "left", fontFamily: "inherit",
              borderTop: i ? "1px solid #f1f5f9" : 0, "&:hover": { bgcolor: "#f8fafc" } }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: "0.86rem", fontWeight: 700, color: "#0f172a" }}>{[e.title, e.system].filter(Boolean).join(" · ") || "งาน"}</Typography>
              <Typography noWrap sx={{ fontSize: "0.74rem", color: "#64748b" }}>{[e.site || e.company, e.startTime ? `${e.startTime} น.` : ""].filter(Boolean).join(" · ")}</Typography>
            </Box>
            {at ? (
              <Stack direction="row" alignItems="center" gap={0.4} sx={{ flexShrink: 0, color: "#16a34a" }}>
                <CheckCircleRounded sx={{ fontSize: 17 }} />
                <Typography sx={{ fontSize: "0.82rem", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{moment(at).utcOffset(7).format("HH:mm")}</Typography>
              </Stack>
            ) : (
              <Box component="span" sx={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 0.5, height: 32, px: 1.25, borderRadius: 2,
                bgcolor: "#2563eb", color: "#fff", fontSize: "0.78rem", fontWeight: 800 }}>
                <LoginRounded sx={{ fontSize: 16 }} />บันทึกเข้างาน
              </Box>
            )}
          </ButtonBase>
        );
      })}
      {jobs.length > shown.length && (
        <ButtonBase component={Link} to="/technician/jobs"
          sx={{ width: "100%", justifyContent: "center", gap: 0.25, py: 0.9, borderTop: "1px solid #f1f5f9", fontFamily: "inherit", fontSize: "0.8rem", fontWeight: 700, color: "#2563eb" }}>
          ดูทั้งหมด {jobs.length} งาน <ChevronRightRounded sx={{ fontSize: 17 }} />
        </ButtonBase>
      )}
    </Box>
  );
}
