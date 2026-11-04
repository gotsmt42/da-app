/**
 * PeriodFilter — ช่องเลือกช่วงเวลาของรายงาน (ชุดเดียวทั้ง "สรุปผลการดำเนินงาน" และ "ผลงานรายบุคคล")
 *
 * 🔁 (4 พ.ย. 2569 ผู้ใช้: "ธีม ux ui ฟอร์มต่างๆให้เข้ากันด้วย ตามที่บอกแบบ Agoda")
 *    เดิม "เลือกเดือน" ใช้ช่องเดือนของเบราว์เซอร์ → ขึ้นภาษาอังกฤษ (November 2026) หน้าตาไม่เข้ากับแอป
 *    → เดือน/ปีเป็นช่องเลือกภาษาไทย ปี พ.ศ. หน้าตาเดียวกับช่องอื่น (SelectField) · กำหนดช่วงเอง = ThaiDatePicker
 *
 * @param value  { preset, month: "YYYY-MM", year: "YYYY", from, to }
 * @param onChange (patch) => void
 * @param years  ["YYYY", …] ปีที่มีข้อมูล (ค.ศ.)
 */
import { Box } from "@mui/material";
import moment from "moment";
import SelectField from "@/shared/ui/SelectField";
import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import { THAI_MONTHS_FULL } from "@/shared/utils/thaiDate";
import { PERIOD_PRESETS } from "../utils/reportPeriod";

export default function PeriodFilter({ value, onChange, years = [], presets = PERIOD_PRESETS }) {
  const { preset, month, year, from, to } = value;
  const yearList = [...new Set([...years, moment().format("YYYY"), month.slice(0, 4), year])].sort().reverse();
  const [mY, mM] = month.split("-");
  return (
    <>
      <SelectField label="ช่วงเวลา" value={preset} onChange={(e) => onChange({ preset: e.target.value })} sx={{ minWidth: 160 }}>
        {presets.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
      </SelectField>
      {preset === "pickMonth" && (
        <Box sx={{ display: "flex", gap: 1 }}>
          <SelectField label="เดือน" value={mM} onChange={(e) => onChange({ month: `${mY}-${e.target.value}` })} sx={{ minWidth: 140, flex: 1 }}>
            {THAI_MONTHS_FULL.map((n, i) => <option key={n} value={String(i + 1).padStart(2, "0")}>{n}</option>)}
          </SelectField>
          <SelectField label="ปี (พ.ศ.)" value={mY} onChange={(e) => onChange({ month: `${e.target.value}-${mM}` })} sx={{ minWidth: 110 }}>
            {yearList.map((y) => <option key={y} value={y}>{Number(y) + 543}</option>)}
          </SelectField>
        </Box>
      )}
      {preset === "pickYear" && (
        <SelectField label="ปี (พ.ศ.)" value={year} onChange={(e) => onChange({ year: e.target.value })} sx={{ minWidth: 120 }}>
          {yearList.map((y) => <option key={y} value={y}>{Number(y) + 543}</option>)}
        </SelectField>
      )}
      {preset === "custom" && (
        <Box sx={{ display: "flex", gap: 1 }}>
          <Box sx={{ flex: 1, minWidth: 150 }}><ThaiDatePicker label="ตั้งแต่" value={from} onChange={(v) => onChange({ from: v || "" })} /></Box>
          <Box sx={{ flex: 1, minWidth: 150 }}><ThaiDatePicker label="ถึง" value={to} onChange={(v) => onChange({ to: v || "" })} /></Box>
        </Box>
      )}
    </>
  );
}
