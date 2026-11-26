/**
 * ThaiMonthSelect — เลือก "เดือน + ปี พ.ศ." ช่องเดียว (ค่า "YYYY-MM" ค.ศ.)
 *
 * ✅ (26 พ.ย. 2569) ใช้กับใบแจ้งเข้างานแบบระบุแค่เดือน และแผนงานทั้งปีของสัญญา — รายการเรียงต่อกันเป็นปีๆ
 *    มีหัวปี พ.ศ. คั่น เลื่อนหาได้ในรายการเดียว ไม่ต้องสลับ 2 ช่อง (เดือน/ปี) ให้สับสน
 */
import { useMemo } from "react";
import { TextField, MenuItem, ListSubheader } from "@mui/material";
import { TH_MONTHS_FULL, addMonthsKey, isMonthKey, monthDiff, monthKeyOf } from "@/shared/utils/contractPlan";

/**
 * @param {string} value "YYYY-MM" หรือ ""
 * @param {(v: string) => void} onChange
 * @param {string} [around] เดือนกึ่งกลางของรายการ (ไม่ส่ง = value หรือเดือนนี้)
 * @param {number} [before] จำนวนเดือนก่อน around · [after] หลัง around
 * @param {string} [emptyLabel] มีค่า = เลือก "ไม่ระบุ" ได้
 * @param {string} [min] / [max] เดือนแรก/สุดท้ายที่เลือกได้ ("YYYY-MM" รวมเดือนนั้น) — เดือนที่เลือกไม่ได้ไม่โชว์ในรายการเลย
 *   ✅ (26 พ.ย. 2569 ผู้ใช้: "ตัวเลือกเดือนถ้าไม่สามารถเลือกได้ ก็ให้ไม่ต้องมี select กันสับสน")
 */
export default function ThaiMonthSelect({
  value, onChange, label, around, before = 18, after = 42, emptyLabel = "", size = "small", fullWidth = true, sx, helperText, error, disabled, min, max,
}) {
  const options = useMemo(() => {
    const center = isMonthKey(around) ? around : isMonthKey(value) ? value : monthKeyOf(new Date());
    let from = addMonthsKey(center, -before);
    let to = addMonthsKey(center, after);
    if (isMonthKey(value)) {
      if (monthDiff(from, value) < 0) from = value;
      if (monthDiff(value, to) < 0) to = value;
    }
    from = `${from.slice(0, 4)}-01`;
    to = `${to.slice(0, 4)}-12`;
    if (isMonthKey(min) && monthDiff(from, min) > 0) from = min;
    if (isMonthKey(max) && monthDiff(max, to) > 0) to = max;
    const out = [];
    for (let k = from; monthDiff(k, to) >= 0; k = addMonthsKey(k, 1)) out.push(k);
    return out;
  }, [around, value, before, after, min, max]);

  const items = [];
  if (emptyLabel) items.push(<MenuItem key="__empty" value=""><em style={{ color: "#94a3b8", fontStyle: "normal" }}>{emptyLabel}</em></MenuItem>);
  options.forEach((k, idx) => {
    const [y, m] = k.split("-").map(Number);
    // หัวปีทุกต้นปี + ต้นรายการ (รายการที่เริ่มกลางปีเพราะมี min ต้องรู้ว่าเป็นปีไหน)
    if (m === 1 || idx === 0) {
      items.push(
        <ListSubheader key={`h${y}`} sx={{ lineHeight: "30px", fontSize: "0.72rem", fontWeight: 800, color: "#475569", bgcolor: "#f8fafc" }}>
          ปี {y + 543}
        </ListSubheader>,
      );
    }
    items.push(<MenuItem key={k} value={k} sx={{ fontSize: "0.86rem", pl: 3 }}>{TH_MONTHS_FULL[m - 1]} {y + 543}</MenuItem>);
  });

  return (
    <TextField
      select size={size} fullWidth={fullWidth} label={label} value={isMonthKey(value) ? value : ""} disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)} sx={sx} helperText={helperText} error={error}
      SelectProps={{
        displayEmpty: Boolean(emptyLabel),
        renderValue: (v) => {
          if (!isMonthKey(v)) return emptyLabel ? <span style={{ color: "#94a3b8" }}>{emptyLabel}</span> : "";
          const [y, m] = v.split("-").map(Number);
          return `${TH_MONTHS_FULL[m - 1]} ${y + 543}`;
        },
        MenuProps: { PaperProps: { sx: { maxHeight: 340 } } },
      }}
      InputLabelProps={emptyLabel ? { shrink: true } : undefined}
    >
      {items}
    </TextField>
  );
}
