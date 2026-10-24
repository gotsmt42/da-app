/**
 * AttendanceRefs — "บันทึกเข้างาน" ของงานที่ใบเบิกอ้างอิง แยกตามวัน
 *
 * ✅ (24 ต.ค. 2569 ผู้ใช้: "ถ้ามีการอิงกับงานไหน ให้ดึงรูปและรายละเอียดบันทึกเข้างานมาด้วย · ทำให้ง่ายและสวยงาม")
 *    ใบค่าจ้างผู้รับเหมาคิดรายวัน — ทุกวันที่เบิกเห็นได้ทันทีว่ามีบันทึกเข้างานจริงไหม เวลาเท่าไร ใครบันทึก รูปหน้างาน
 *    (ใช้ตรวจกับจำนวนวัน/คนที่เบิกได้ทันที ไม่ต้องไปเปิดหน้างานทีละงาน)
 * ⚠️ อ่านสดจากระบบบันทึกเข้างาน (ไม่คัดลอกเก็บในใบ) — แก้/อนุมัติแก้เวลาในงาน ใบเบิกเห็นค่าล่าสุดเสมอ
 * ⚠️ คนที่ไม่มีสิทธิ์ดูงานนั้น = ไม่แสดงอะไร (ไม่ขึ้นข้อผิดพลาด)
 */
import { useEffect, useMemo, useState } from "react";
import moment from "moment";
import { Box, ButtonBase, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { CheckCircleRounded, HelpOutlineRounded } from "@mui/icons-material";
import AttendanceService from "@/shared/services/AttendanceService";
import { thumbUrl } from "@/shared/utils/cloudinaryImage";

const GREEN = "#16a34a";
const MUTED = "#64748b";

/** Map "YYYY-MM-DD" → [{ at, outAt, by, note, summary, photos, job }] ของงานที่ระบุ */
export function useAttendanceByDay(eventIds) {
  const key = [...new Set((eventIds || []).filter(Boolean).map(String))].sort().join(",");
  const [map, setMap] = useState(() => new Map());
  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (!ids.length) { setMap(new Map()); return undefined; }
    let alive = true;
    Promise.all(ids.map((id) => AttendanceService.ofEvent(id, { group: true }).then((r) => r?.attendance || []).catch(() => [])))
      .then((lists) => {
        if (!alive) return;
        const m = new Map();
        const seen = new Set();
        lists.flat().forEach((r) => {
          if (!r?.checkIn?.at || seen.has(String(r._id))) return;
          seen.add(String(r._id));
          const day = r.workDay || moment(r.checkIn.at).utcOffset(7).format("YYYY-MM-DD");
          const list = m.get(day) || [];
          list.push({
            id: r._id, at: r.checkIn.at, outAt: r.checkOut?.at || null,
            by: r.userName || "", note: r.checkIn?.note || "", summary: r.checkOut?.summary || "",
            photos: [...(r.checkIn?.photos || []), ...(r.checkOut?.photos || [])].filter((p) => p?.fileUrl),
            team: (r.team || []).length,
          });
          m.set(day, list);
        });
        setMap(m);
      });
    return () => { alive = false; };
  }, [key]);
  return map;
}

/**
 * แถบบันทึกเข้างานของ 1 วัน (ใต้แถววันในใบเบิก)
 * @param entries  รายการของวันนั้น (จาก useAttendanceByDay) · ไม่มี = แสดง "ไม่มีบันทึก" แบบจาง
 * @param onOpen   (url, name, list) เปิดดูรูป (เลื่อนดูรูปอื่นของวันเดียวกันได้)
 */
export function AttendanceDayStrip({ entries, onOpen, hasJobs = true }) {
  const photos = useMemo(() => (entries || []).flatMap((e) => e.photos), [entries]);
  if (!hasJobs) return null;
  if (!entries?.length) {
    return (
      <Stack direction="row" alignItems="center" gap={0.5} sx={{ gridColumn: "1 / -1", color: "#94a3b8" }}>
        <HelpOutlineRounded sx={{ fontSize: 14 }} />
        <Typography sx={{ fontSize: "0.72rem" }}>ไม่มีบันทึกเข้างานของวันนี้ในงานที่อ้างอิง</Typography>
      </Stack>
    );
  }
  const t = (d) => moment(d).utcOffset(7).format("HH:mm");
  return (
    <Box sx={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 1, px: 1, py: 0.6, borderRadius: 1.5, bgcolor: alpha(GREEN, 0.06), border: `1px solid ${alpha(GREEN, 0.18)}`, minWidth: 0 }}>
      <CheckCircleRounded sx={{ fontSize: 16, color: GREEN, flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: "0.76rem", fontWeight: 800, color: "#14532d" }}>
          บันทึกเข้างาน {entries.map((e) => `${t(e.at)}${e.outAt ? `–${t(e.outAt)}` : ""}`).join(", ")}
          <Box component="span" sx={{ fontWeight: 600, color: MUTED }}>
            {" · "}{[...new Set(entries.map((e) => e.by).filter(Boolean))].join(", ") || "ไม่ระบุ"}
            {entries.some((e) => e.team) ? ` · ทีม ${Math.max(...entries.map((e) => e.team || 0))} คน` : ""}
          </Box>
        </Typography>
        {(entries[0].note || entries[0].summary) && (
          <Typography noWrap sx={{ fontSize: "0.7rem", color: MUTED }}>{entries.map((e) => e.summary || e.note).filter(Boolean).join(" · ")}</Typography>
        )}
      </Box>
      {photos.length > 0 && (
        <Stack direction="row" gap={0.4} sx={{ flexShrink: 0 }}>
          {photos.slice(0, 3).map((p, i) => (
            <ButtonBase key={p.fileUrl} onClick={() => onOpen?.(p.fileUrl, p.fileName || `รูป ${i + 1}`, photos)}
              sx={{ position: "relative", width: 34, height: 34, borderRadius: 1, overflow: "hidden", border: "1px solid #e2e8f0" }}>
              <Box component="img" src={thumbUrl(p.fileUrl, 80)} alt="" loading="lazy" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
              {i === 2 && photos.length > 3 && (
                <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", bgcolor: "rgba(15,23,42,.55)", color: "#fff", fontSize: "0.7rem", fontWeight: 800 }}>+{photos.length - 3}</Box>
              )}
            </ButtonBase>
          ))}
        </Stack>
      )}
    </Box>
  );
}
