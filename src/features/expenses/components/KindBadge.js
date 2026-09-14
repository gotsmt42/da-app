/**
 * KindBadge — ป้ายทึบบอกชนิดใบ (ADVANCE / CLAIM / สำรองจ่าย)
 * ⚠️ รับ "ชนิดที่ใช้แสดงผล" (slipKind) ไม่ใช่ e.kind ดิบ — ใบสำรองจ่ายมี kind = "claim" เหมือนใบเคลม
 *
 * ✅ ผู้ใช้ขอให้ "แยกได้ง่ายชัดเจน" — สีอย่างเดียวไม่พอสำหรับคนตาบอดสีหรือหน้าจอกลางแดด จึงมีทั้ง
 * พื้นทึบ + ไอคอนคนละรูป + คำภาษาอังกฤษตัวใหญ่ที่คนในบริษัทเรียกกันจริง
 */
import { Box } from "@mui/material";
import { Payments, ReceiptLong, AccountBalanceWallet } from "@mui/icons-material";
import { KIND_META } from "../expenseMeta";

export default function KindBadge({ kind, size = "small", sx }) {
  const m = KIND_META[kind] || KIND_META.advance;
  const big = size === "medium";
  const Icon = kind === "reimburse" ? AccountBalanceWallet : kind === "claim" ? ReceiptLong : Payments;
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex", alignItems: "center", gap: 0.4, flexShrink: 0,
        px: big ? 1 : 0.75, height: big ? 24 : 20, borderRadius: 999,
        bgcolor: m.color, color: "#fff",
        fontSize: big ? "0.72rem" : "0.64rem", fontWeight: 900, letterSpacing: "0.06em", lineHeight: 1,
        ...sx,
      }}
    >
      <Icon sx={{ fontSize: big ? 15 : 13 }} />
      {m.badge}
    </Box>
  );
}
