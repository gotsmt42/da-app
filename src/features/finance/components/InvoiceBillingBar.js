/**
 * InvoiceBillingBar — แถบ "บันทึกการวางบิล" ใต้ช่องเอกสาร "ใบวางบิล" ของงาน
 *
 * ✅ (4 พ.ย. 2569 ผู้ใช้: "หน้าแนบเอกสารงาน ถ้ามีการแนบใบวางบิล ให้กดบันทึกวางบิลของงานนั้นๆ พร้อมจำนวนเงินให้สอดคล้อง
 *    และเชื่อมโยงกับหน้าบันทึกติดตามการวางบิล / รับเงิน ให้สมบูรณ์ จะได้ทำทีเดียว และป้องกันข้อผิดพลาดต่างๆด้วย")
 *    • แนบใบวางบิลแล้วแต่ยังไม่บันทึก → แถบเตือนสีส้ม + ปุ่ม "บันทึกการวางบิล" (แนบไฟล์ใหม่ = เปิดกล่องให้เองทันที)
 *    • บันทึกแล้ว → สรุป เลขที่ · ยอดสุทธิ · รับแล้ว · ค้างรับ · สถานะ + ปุ่ม "จัดการวางบิล / รับเงิน"
 *    • กล่องที่เปิด = BillingDialog ตัวเดียวกับหน้า "วางบิล / รับเงิน" (/billing) และหน้าภาพรวมงาน → ข้อมูลชุดเดียวกัน
 *      (มีปุ่มให้ AI อ่านใบวางบิลเติมเลขที่/ยอดให้ · VAT/หัก ณ ที่จ่าย/ยอดสุทธิ คิดที่เซิร์ฟเวอร์ — ไม่พิมพ์ซ้ำ ไม่คำนวณผิด)
 * ⚠️ สิทธิ์บันทึกตัดสินที่เซิร์ฟเวอร์ (editFinance หรือคนในงาน) — ไม่มีสิทธิ์ กล่องจะแจ้งเอง
 *
 * @param event      งาน (ต้องมี _id · billing)
 * @param filesCount จำนวนไฟล์ใบวางบิล — เพิ่มขึ้นระหว่างเปิดอยู่ + ยังไม่บันทึก = เปิดกล่องให้อัตโนมัติ
 * @param zIndex     เปิดซ้อนบนกล่อง Swal/แผ่นเอกสาร (ฟอร์มแก้ไขงาน)
 * @param onSaved    (event) => void — งานที่อัปเดตแล้ว
 */
import { useEffect, useRef, useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ReceiptLongRounded, WarningAmberRounded } from "@mui/icons-material";
import BillingDialog from "./BillingDialog";
import { billingStatus, baht, BILLING_STATE_META } from "@/shared/utils/billing";

export default function InvoiceBillingBar({ event, filesCount = 0, zIndex, onSaved, sx }) {
  const [ev, setEv] = useState(event);
  const [open, setOpen] = useState(false);
  const prevCount = useRef(filesCount);
  useEffect(() => { setEv((p) => ({ ...p, ...event, billing: event?.billing ?? p?.billing })); }, [event]);

  const st = billingStatus(ev?.billing);
  const invoiced = st.state !== "not_invoiced";

  // แนบใบวางบิลเพิ่มระหว่างเปิดหน้าอยู่ + ยังไม่ได้บันทึก = เปิดกล่องบันทึกให้เลย (ทำต่อทีเดียว)
  useEffect(() => {
    if (filesCount > prevCount.current && !invoiced) setOpen(true);
    prevCount.current = filesCount;
  }, [filesCount, invoiced]);

  if (!ev?._id || filesCount <= 0) return null;
  const tone = invoiced ? (BILLING_STATE_META[st.state]?.color || "#0891b2") : "#d97706";

  return (
    <>
      <Box onClick={(e) => e.stopPropagation()}
        sx={{ mt: 1, p: 1.25, borderRadius: 2, border: `1px solid ${alpha(tone, 0.35)}`, bgcolor: alpha(tone, 0.06), ...sx }}>
        <Stack direction="row" alignItems="center" spacing={1.25}>
          {invoiced ? <ReceiptLongRounded sx={{ color: tone, fontSize: 22 }} /> : <WarningAmberRounded sx={{ color: tone, fontSize: 22 }} />}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {invoiced ? (
              <>
                <Typography sx={{ fontSize: "0.84rem", fontWeight: 800, color: "#0f172a" }}>
                  วางบิลแล้ว{ev.billing?.invoiceNo ? ` · ${ev.billing.invoiceNo}` : ""} · <Box component="span" sx={{ color: tone }}>{st.label}</Box>
                </Typography>
                <Typography sx={{ fontSize: "0.76rem", color: "#475569" }}>
                  ยอดสุทธิ {baht(st.net)} · รับแล้ว {baht(st.paid)}{st.outstanding > 0 ? ` · ค้างรับ ${baht(st.outstanding)}` : ""}
                </Typography>
              </>
            ) : (
              <>
                <Typography sx={{ fontSize: "0.84rem", fontWeight: 800, color: "#92400e" }}>แนบเอกสารการเงินแล้ว — ยังไม่ได้บันทึกการวางบิล</Typography>
                <Typography sx={{ fontSize: "0.76rem", color: "#a16207" }}>บันทึกเลขที่และจำนวนเงิน เพื่อติดตามการรับเงินในหน้า "วางบิล / รับเงิน"</Typography>
              </>
            )}
          </Box>
          <Button size="small" variant={invoiced ? "outlined" : "contained"} disableElevation onClick={() => setOpen(true)}
            sx={{ flexShrink: 0, textTransform: "none", fontWeight: 800, borderRadius: 2, whiteSpace: "nowrap",
              ...(invoiced ? { color: tone, borderColor: alpha(tone, 0.5), bgcolor: "#fff" } : { bgcolor: "#d97706", "&:hover": { bgcolor: "#b45309" } }) }}>
            {invoiced ? "จัดการวางบิล / รับเงิน" : "บันทึกการวางบิล"}
          </Button>
        </Stack>
      </Box>
      {open && (
        <BillingDialog event={ev} zIndex={zIndex} onClose={() => setOpen(false)}
          onSaved={(updated) => { if (updated) { setEv((p) => ({ ...p, ...updated })); onSaved?.(updated); } }} />
      )}
    </>
  );
}
