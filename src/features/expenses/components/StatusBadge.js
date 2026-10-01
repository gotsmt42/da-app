/**
 * StatusBadge — ป้ายสถานะของใบเบิก (ไอคอน + ข้อความ บนพื้นสีอ่อนของสถานะนั้น)
 *
 * ✅ ผู้ใช้แจ้ง (28 ก.ย. 2569): "สถานะต่างๆ ของใบมันแยกยาก ดูยาก ทำให้แยกกันชัดเจนแบบมืออาชีพ"
 * เดิมเป็นจุดสีเล็ก + ข้อความยาว ("อนุมัติแล้ว · รออนุมัติเบิกจ่าย") และหลายสถานะใช้สีใกล้กัน
 * ✅ ตอนนี้ทุกสถานะมี 3 อย่างที่ต่างกัน: สี (คนละโทนชัดเจน) · ไอคอน (แยกได้แม้ตาบอดสี) · คำสั้นที่บอกขั้นต่อไป
 *   รอตรวจสอบ ⏳ อำพัน · รออนุมัติ ✔︎ ม่วง · รออนุมัติเบิกจ่าย ฿ น้ำเงิน · รับเงินแล้ว/รอเคลียร์ ฟ้า ·
 *   ส่งเคลมแล้ว ชมพู · เสร็จสิ้น ✓ เขียว · ตีกลับ ↩ แดง · ยกเลิก ⊘ เทา
 * ⚠️ สี/คำมาจาก statusMeta() ใน expenseMeta.js ที่เดียว — ไอคอนอยู่ที่นี่เพราะ expenseMeta เป็นไฟล์ข้อมูลล้วน
 */
import { Box } from "@mui/material";
import {
  HourglassTop, FactCheck, Payments, AccountBalanceWallet, Sync, CheckCircle, Undo, Block, HelpOutline,
} from "@mui/icons-material";
import { statusMeta } from "../expenseMeta";

export const STATUS_ICON = {
  pending: HourglassTop,
  reviewed: FactCheck,
  approved: Payments,
  paid: AccountBalanceWallet,
  clearing: Sync,
  cleared: CheckCircle,
  settled: CheckCircle,
  rejected: Undo,
  cancelled: Block,
};

/**
 * @param {string} status
 * @param {string} kind     ชนิดใบที่ใช้แสดงผล (slipKind) — คำของบางสถานะต่างกันตามชนิดใบ
 * @param {"small"|"medium"} size
 */
export default function StatusBadge({ status, kind, size = "small", sx }) {
  const st = statusMeta(status, kind);
  const Icon = STATUS_ICON[status] || HelpOutline;
  const big = size === "medium";
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex", alignItems: "center", gap: 0.5, flexShrink: 0, maxWidth: "100%",
        px: big ? 1 : 0.8, height: big ? 26 : 22, borderRadius: 1.5,
        bgcolor: st.bg, color: st.color, border: `1px solid ${st.border}`,
        fontSize: big ? "0.78rem" : "0.72rem", fontWeight: 800, lineHeight: 1, whiteSpace: "nowrap",
        ...sx,
      }}
    >
      <Icon sx={{ fontSize: big ? 16 : 14 }} />
      <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>{st.label}</Box>
    </Box>
  );
}
