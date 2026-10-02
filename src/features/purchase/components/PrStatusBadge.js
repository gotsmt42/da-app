/** PrStatusBadge — ป้ายสถานะใบขอซื้อ (ไอคอน + คำ บนพื้นสีอ่อน) หน้าตาเดียวกับป้ายระบบเบิก/OT */
import { Box } from "@mui/material";
import { HourglassTop, FactCheck, ShoppingCart, LocalShipping, Inventory2, CheckCircle, Undo, Block, HelpOutline } from "@mui/icons-material";
import { prStatus } from "../prMeta";

const ICON = {
  pending: HourglassTop, reviewed: FactCheck, approved: ShoppingCart, ordered: LocalShipping, partial: Inventory2,
  received: CheckCircle, rejected: Undo, cancelled: Block,
};

export default function PrStatusBadge({ status, short = false, sx }) {
  const st = prStatus(status);
  const Icon = ICON[status] || HelpOutline;
  return (
    <Box component="span" sx={{
      display: "inline-flex", alignItems: "center", gap: 0.5, flexShrink: 0, maxWidth: "100%",
      px: 0.8, height: 22, borderRadius: 1.5, bgcolor: st.bg, color: st.color, border: `1px solid ${st.border}`,
      fontSize: "0.72rem", fontWeight: 800, lineHeight: 1, whiteSpace: "nowrap", ...sx,
    }}>
      <Icon sx={{ fontSize: 14 }} />
      <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>{short ? st.short || st.label : st.label}</Box>
    </Box>
  );
}
