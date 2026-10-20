/**
 * MyActionAlerts — กล่อง "ต้องทำตอนนี้" บนหน้าแรก (ช่าง/ผู้รับผิดชอบ/หัวหน้าทีม)
 *
 * ✅ (20 ต.ค. 2569 ผู้ใช้: "เตือนช่างตั้งแต่หน้าแรกเลยว่ามีงานที่ไม่กดรับทราบ ไม่กดบันทึกงานเมื่อถึงเวลา
 *    ให้ชัดเจน ป้องกันการผิดพลาด กันลืม ให้สวยงาม สมบูรณ์")
 *    3 เรื่องที่ลืมบ่อย (ตรรกะกลาง shared/utils/myJobAttention) — กดแล้วไปที่งานนั้นในงานของฉันทันที
 *    ไม่มีอะไรค้าง = ไม่แสดงกล่อง (ไม่กินพื้นที่)
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Box, ButtonBase, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ThumbUpAltOutlined, EventAvailableOutlined, LoginRounded, ChevronRight } from "@mui/icons-material";
import useTodayCheckins from "@/shared/hooks/useTodayCheckins";
import { attentionOf, ATTENTION_META, attentionDayText } from "@/shared/utils/myJobAttention";

const LINE = "#e2e8f0";
const ICON = { checkin: <LoginRounded />, ack: <ThumbUpAltOutlined />, confirm: <EventAvailableOutlined /> };

export default function MyActionAlerts({ events, userData }) {
  const todayCheckedIds = useTodayCheckins();
  const groups = useMemo(() => {
    const out = { checkin: [], ack: [], confirm: [] };
    const seen = new Set();
    (events || []).slice().sort((a, b) => new Date(a.start) - new Date(b.start)).forEach((e) => {
      const k = attentionOf(e, { userId: userData?.userId, fname: userData?.fname, todayCheckedIds });
      if (!k) return;
      const key = `${k}:${k === "checkin" ? e._id : e.jobGroupId || e._id}`;
      if (seen.has(key)) return;
      seen.add(key);
      out[k].push(e);
    });
    return out;
  }, [events, userData?.userId, userData?.fname, todayCheckedIds]);

  const rows = ["checkin", "ack", "confirm"].map((k) => ({ key: k, list: groups[k], ...ATTENTION_META[k] })).filter((r) => r.list.length);
  if (!rows.length) return null;

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
          <Box sx={{ width: 36, height: 36, borderRadius: 2.5, flexShrink: 0, display: "grid", placeItems: "center", bgcolor: alpha(r.color, 0.1), color: r.color, "& svg": { fontSize: 20 } }}>{ICON[r.key]}</Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 800, color: "#0f172a", lineHeight: 1.3 }}>
              {r.title} <Box component="span" sx={{ ml: 0.4, px: 0.7, borderRadius: 99, bgcolor: r.color, color: "#fff", fontSize: "0.72rem", fontWeight: 900 }}>{r.list.length}</Box>
            </Typography>
            <Typography noWrap sx={{ fontSize: "0.74rem", color: "#475569" }}>
              {r.list.slice(0, 2).map((e) => `${e.site || e.company || e.title || "งาน"} (${attentionDayText(e)})`).join(" · ")}{r.list.length > 2 ? ` · และอีก ${r.list.length - 2}` : ""}
            </Typography>
            <Typography noWrap sx={{ fontSize: "0.68rem", color: "#94a3b8" }}>{r.hint}</Typography>
          </Box>
          <ChevronRight sx={{ fontSize: 20, color: "#cbd5e1", flexShrink: 0 }} />
        </ButtonBase>
      ))}
    </Box>
  );
}
