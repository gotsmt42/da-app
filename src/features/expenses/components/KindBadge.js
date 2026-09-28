/**
 * KindBadge — ป้ายทึบบอกชนิดใบ (ADVANCE / CLAIM / สำรองจ่าย)
 * ⚠️ รับ "ชนิดที่ใช้แสดงผล" (slipKind) ไม่ใช่ e.kind ดิบ — ใบสำรองจ่ายมี kind = "claim" เหมือนใบเคลม
 *
 * ✅ ผู้ใช้ขอให้ "แยกได้ง่ายชัดเจน" — สีอย่างเดียวไม่พอสำหรับคนตาบอดสีหรือหน้าจอกลางแดด จึงมีทั้ง
 * พื้นทึบ + ไอคอนคนละรูป + คำภาษาอังกฤษตัวใหญ่ที่คนในบริษัทเรียกกันจริง
 */
import { Box } from "@mui/material";
import { Payments, ReceiptLong, AccountBalanceWallet, Engineering } from "@mui/icons-material";
import { KIND_META } from "../expenseMeta";

/**
 * @param {"solid"|"soft"} variant  solid = พื้นทึบ (หัวกล่องรายละเอียด/ฟอร์ม) · soft = พื้นอ่อน ตัวอักษรสี (ในรายการ)
 * ✅ ผู้ใช้แจ้ง "สีสันรกตาเกินไป" — ในรายการที่มีหลายใบเรียงกัน ป้ายทึบทุกแถวแย่งสายตากับเนื้อหา จึงใช้แบบ soft
 */
export default function KindBadge({ kind, size = "small", variant = "solid", sx }) {
  const m = KIND_META[kind] || KIND_META.advance;
  const big = size === "medium";
  const soft = variant === "soft";
  const Icon = kind === "contractor" ? Engineering : kind === "reimburse" ? AccountBalanceWallet : kind === "claim" ? ReceiptLong : Payments;
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex", alignItems: "center", gap: 0.4, flexShrink: 0,
        px: big ? 1 : 0.75, height: big ? 24 : 20, borderRadius: 999,
        bgcolor: soft ? m.soft : m.color, color: soft ? m.dark : "#fff",
        fontSize: big ? "0.72rem" : "0.64rem", fontWeight: soft ? 800 : 900, letterSpacing: soft ? "0.02em" : "0.06em", lineHeight: 1,
        ...sx,
      }}
    >
      <Icon sx={{ fontSize: big ? 15 : 13 }} />
      {m.badge}
    </Box>
  );
}
