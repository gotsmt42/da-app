/**
 * BillingChip.js — สถานะวางบิลของ "ครั้งที่ N" 1 ครั้ง แบบกดจัดการได้
 *
 * ⚠️ ระดับ "ครั้ง" ไม่ใช่ระดับ document — งานเดียวกันที่เข้าหลายช่วงไม่ต่อเนื่อง (21 ส.ค. แล้วเว้นไป
 * 31 ส.ค.–4 ก.ย.) ยังเป็นครั้งเดียวกันและวางบิลใบเดียว จึงรับ roundVisits ทั้งชุดเข้ามาแล้วให้
 * roundBillingStatus เป็นคนตัดสินว่าใบไหนคือใบของครั้งนี้ (ดู shared/utils/billing.js)
 *
 * ⚠️ ต้องเตี้ยที่สุดเท่าที่จะทำได้ — ช่อง "ครั้งที่ N" มีวันที่ + ทีม + แถวปุ่มจัดการอยู่แล้ว และมีได้ถึง
 * 12 ช่องต่อแถว ทุกพิกเซลที่เพิ่มคูณ 12 เสมอ จึงไม่ใช้ Chip ของ MUI (สูง 20px + padding)
 * ✅ ยังไม่วางบิล = ปุ่ม ฿ เล็กๆ ตัวเดียว (ไม่กินบรรทัด) · วางบิลแล้ว = ข้อความสั้นบรรทัดเดียว
 */
import { memo } from "react";
import { Box, Typography, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { roundBillingStatus, baht, BILLING_STATE_META } from "@/shared/utils/billing";

/**
 * @param {Array}    props.roundVisits  document ทั้งหมดของครั้งนี้
 * @param {boolean}  props.canManage    เปิดกล่องจัดการได้ไหม (เฉพาะแอดมิน/manager)
 * @param {Function} props.onOpen       รับ document ตัวแทนที่ถือใบวางบิลของครั้งนี้
 * @param {boolean}  props.compact      true = ตารางเดสก์ท็อป · false = การ์ดมือถือ
 */
const BILL_ACCENT = "#0891b2";

function BillingChip({ roundVisits = [], canManage, onOpen, compact = true }) {
  const st = roundBillingStatus(roundVisits);
  if (!st.target) return null;

  const meta = BILLING_STATE_META[st.state];
  const open = () => onOpen?.(st.target);

  // ── ยังไม่วางบิล: ปุ่มไอคอนจางๆ ตัวเดียว ไม่กินบรรทัด ──────────────────────
  // ⚠️ ช่วงแรกที่เริ่มใช้ระบบ ทุกครั้งจะอยู่สถานะนี้ทั้งตาราง ถ้าทำเป็นข้อความ "+ วางบิล" ทุกช่อง
  // ตารางจะเต็มไปด้วยคำเดียวกันซ้ำ 12 ช่องต่อแถวจนกลบข้อมูลจริงที่อยู่ในช่องเดียวกัน
  if (st.state === "not_invoiced") {
    if (!canManage) return null;
    // ⚠️ เดิมใช้ไอคอนเอกสาร (ReceiptLong) ซึ่งหน้าตาเหมือนไอคอน "ไฟล์/เอกสาร" อีกหลายตัวในตาราง
    // เดียวกัน แยกไม่ออกว่าอันไหนคืออะไร — ป้าย "+ ฿" อ่านออกทันทีว่าเป็นเรื่องเงินและกดเพื่อเพิ่ม
    // ✅ ยังกว้างแค่ ~28px จึงไม่กินที่มากกว่าไอคอนเดิม (ช่องกว้าง 110px และมีได้ 12 ช่องต่อแถว)
    return (
      <Tooltip title="ยังไม่ได้วางบิลครั้งนี้ — คลิกเพื่อบันทึกการวางบิล" placement="top">
        <Box
          component="button" type="button"
          onClick={(e) => { e.stopPropagation(); open(); }}
          sx={{
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 0.15,
            px: 0.6, py: 0.05, borderRadius: 1, cursor: "pointer", fontFamily: "inherit",
            fontSize: compact ? "0.64rem" : "0.72rem", fontWeight: 800, lineHeight: 1.5,
            color: "text.disabled", bgcolor: "transparent",
            border: "1px dashed", borderColor: "divider",
            transition: "color .15s, border-color .15s, background-color .15s",
            "&:hover": { color: BILL_ACCENT, borderColor: BILL_ACCENT, bgcolor: alpha(BILL_ACCENT, 0.08) },
          }}
        >
          <Box component="span" sx={{ fontSize: "0.85em" }}>+</Box>฿
        </Box>
      </Tooltip>
    );
  }

  // ── วางบิลแล้ว: ข้อความสั้นบรรทัดเดียว มีจุดสีนำหน้า ───────────────────────
  const text = st.state === "overdue" ? `เลย ${st.overdueDays} วัน`
    : st.state === "paid" ? "รับครบ"
      : st.outstanding > 0 ? `ค้าง ${baht(st.outstanding).replace("฿", "")}`
        : st.label;

  const tip = [
    st.label,
    st.target.billing?.invoiceNo ? `เลขที่ ${st.target.billing.invoiceNo}` : null,
    `ยอดวางบิล ${baht(st.net)}`,
    st.paid > 0 ? `รับแล้ว ${baht(st.paid)}` : null,
    st.outstanding > 0 ? `ค้างรับ ${baht(st.outstanding)}` : null,
    st.target.billing?.dueAt ? `ครบกำหนด ${new Date(st.target.billing.dueAt).toLocaleDateString("th-TH")}` : null,
    // ⚠️ เตือนเคสข้อมูลเก่าที่มีใบวางบิลมากกว่า 1 ใบในครั้งเดียว — ยอดด้านบนรวมให้แล้วทุกใบ
    // แต่กดแก้ไขได้ทีละใบ จึงต้องบอกให้รู้ ไม่ใช่ปล่อยให้งงว่าทำไมแก้แล้วยอดไม่ตรง
    st.extraInvoices > 0 ? `⚠️ ครั้งนี้มีใบวางบิล ${st.extraInvoices + 1} ใบ (ปกติควรมีใบเดียว)` : null,
    canManage ? "— คลิกเพื่อจัดการ" : null,
  ].filter(Boolean).join(" · ");

  return (
    <Tooltip title={tip} placement="top">
      <Typography
        component={canManage ? "button" : "span"}
        type={canManage ? "button" : undefined}
        onClick={canManage ? (e) => { e.stopPropagation(); open(); } : undefined}
        sx={{
          display: "inline-flex", alignItems: "center", gap: 0.35,
          border: "none", bgcolor: "transparent", p: 0, m: 0, fontFamily: "inherit",
          whiteSpace: "nowrap", lineHeight: 1.4,
          fontSize: compact ? "0.64rem" : "0.72rem",
          fontWeight: 700,
          color: meta.color,
          cursor: canManage ? "pointer" : "default",
          "&:hover": canManage ? { textDecoration: "underline" } : {},
        }}
      >
        <Box component="span" sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: meta.color, flexShrink: 0 }} />
        {text}
        {st.extraInvoices > 0 && <Box component="span" sx={{ color: "#f59e0b" }}>⚠</Box>}
      </Typography>
    </Tooltip>
  );
}

// ✅ memo — ตารางภาพรวมงานมีป้ายนี้ได้ถึง 12 อันต่อแถว × 10 แถว การกดเปิดกล่องใดๆ ในหน้าจะทำให้
// คอมโพเนนต์แม่ (5,000 บรรทัด) render ใหม่ทั้งหมด ถ้าไม่ memo ป้ายทุกอันจะคำนวณสถานะใหม่หมดทุกครั้ง
// ⚠️ ได้ผลจริงก็ต่อเมื่อ prop ที่ส่งเข้ามามี reference คงที่ด้วย (ดู roundVisitsByRound / handleOpenBilling
// ที่ ContractOverview.js) — ถ้าแม่สร้าง array/ฟังก์ชันใหม่ทุก render memo จะไม่ช่วยอะไรเลย
export default memo(BillingChip);
