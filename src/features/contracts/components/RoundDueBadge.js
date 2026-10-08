/**
 * RoundDueBadge — ป้ายเตือน "รอบเข้างาน" ชุดเดียวใช้ทั้งตาราง การ์ดมือถือ และหน้าหลัก
 *
 * ✅ (8 ต.ค. 2569 ผู้ใช้: "สัญลักษณ์การแจ้งเตือนถึงรอบต่างๆ ให้ชัดเจน จุดวางโอเค ไม่กำกวม สังเกตได้ง่าย")
 *   3 ระดับ สัญลักษณ์ + สีต่างกัน และบอก "ครั้งที่" กับ "เดือนที่ต้องเข้า" ในป้ายเลย (ไม่ต้องชี้ดู tooltip)
 *     🕒 ใกล้ถึงรอบ (เดือนหน้า)     อำพัน · พื้นอ่อน
 *     🔔 ถึงรอบเดือนนี้              แดง · พื้นอ่อน
 *     ⛔ เลยกำหนด N เดือน            แดงเข้ม · พื้นทึบ + กะพริบเบาๆ
 *   info = ผลจาก nextVisitOverdueInfo (shared/utils/contractOverdue.js)
 */
import { Box, Button, Stack, Typography } from "@mui/material";
import { alpha, keyframes } from "@mui/material/styles";
import { ScheduleOutlined, NotificationsActiveOutlined, ErrorOutline, Add } from "@mui/icons-material";

const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(153, 27, 27, .45); }
  50% { box-shadow: 0 0 0 5px rgba(153, 27, 27, 0); }
`;

const ICON = { due_soon: ScheduleOutlined, due_now: NotificationsActiveOutlined, overdue: ErrorOutline };
const HEAD = { due_soon: "ใกล้ถึงรอบ", due_now: "ถึงรอบเดือนนี้" };

/** ป้ายเล็ก (ในตาราง) — บรรทัดเดียว: สัญลักษณ์ + สถานะ · ครั้งที่ */
export function RoundDueChip({ info, sx }) {
  if (!info) return null;
  const Icon = ICON[info.state] || ScheduleOutlined;
  const solid = info.state === "overdue";
  return (
    <Box component="span" title={info.label}
      sx={{
        display: "inline-flex", alignItems: "center", gap: 0.5, maxWidth: "100%", height: 22, px: 0.9, borderRadius: 99,
        fontSize: "0.7rem", fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        color: solid ? "#fff" : info.color, bgcolor: solid ? info.color : alpha(info.color, 0.1),
        border: `1px solid ${solid ? info.color : alpha(info.color, 0.3)}`,
        ...(solid ? { animation: `${pulse} 2s ease-in-out infinite` } : {}),
        ...sx,
      }}>
      <Icon sx={{ fontSize: 14, flexShrink: 0 }} />
      <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
        {info.shortLabel} · {info.roundLabel.replace("ครั้งที่ ", "")}
      </Box>
    </Box>
  );
}

/** แถบเต็มความกว้าง (การ์ดมือถือ) — สถานะ + ครั้งที่ + เดือนที่ต้องเข้า + ปุ่มลงครั้งถัดไป */
export default function RoundDueBadge({ info, onAdd }) {
  if (!info) return null;
  const Icon = ICON[info.state] || ScheduleOutlined;
  const solid = info.state === "overdue";
  const head = HEAD[info.state] || `เลยกำหนด ${info.monthsOverdue} เดือน`;
  return (
    <Stack direction="row" alignItems="center" spacing={1}
      sx={{
        px: 1.25, py: 0.9, borderRadius: 2,
        bgcolor: solid ? info.color : alpha(info.color, 0.08),
        border: `1px solid ${solid ? info.color : alpha(info.color, 0.3)}`,
        color: solid ? "#fff" : info.color,
        ...(solid ? { animation: `${pulse} 2s ease-in-out infinite` } : {}),
      }}>
      <Icon sx={{ fontSize: 22, flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.84rem", fontWeight: 900, lineHeight: 1.3, color: "inherit" }}>{head}</Typography>
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, lineHeight: 1.35, color: solid ? "rgba(255,255,255,.9)" : "#475569" }}>
          {info.roundLabel} · ต้องเข้า {info.dueMonthLabel} · ยังไม่ได้ลงแผนงาน
        </Typography>
      </Box>
      {onAdd && (
        <Button size="small" variant={solid ? "contained" : "outlined"} disableElevation startIcon={<Add sx={{ fontSize: "16px !important" }} />}
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
          sx={{
            flexShrink: 0, height: 30, px: 1.1, borderRadius: 2, textTransform: "none", fontSize: "0.74rem", fontWeight: 800, whiteSpace: "nowrap",
            ...(solid
              ? { bgcolor: "#fff", color: info.color, "&:hover": { bgcolor: "#fef2f2" } }
              : { color: info.color, borderColor: alpha(info.color, 0.5), bgcolor: "#fff", "&:hover": { borderColor: info.color, bgcolor: "#fff" } }),
          }}>
          ลงครั้งถัดไป
        </Button>
      )}
    </Stack>
  );
}
