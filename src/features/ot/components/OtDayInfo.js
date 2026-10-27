/**
 * OtDayInfo — ข้อมูลวันหยุดของวันที่ลง OT (ชุดเดียวกับวันหยุดบนปฏิทินงาน: GET /api/holidays)
 *
 * ✅ (27 ต.ค. 2569 ผู้ใช้: "อยากให้แสดงข้อมูลวันหยุดใน event ด้วย นำมาแสดงให้ชัดเจน สวยงาม ตามวันที่เลือกลง OT")
 *   แถบใต้วันที่ของแต่ละรายการ: วันหยุดนักขัตฤกษ์ (ชื่อ + ราชการ/ธนาคาร) · วันหยุดประจำสัปดาห์ · วันทำงานปกติ
 * ⚠️ ดึงครั้งเดียวต่อการเปิดแอป (เก็บไว้ในตัวแปรระดับโมดูล) — ข้อมูลไม่กี่สิบรายการ ไม่เปลี่ยนระหว่างวัน
 */
import { useEffect, useState } from "react";
import moment from "moment";
import { Box, Stack, Typography } from "@mui/material";
import { thaiDate } from "@/shared/utils/thaiDate";
import { Celebration, Weekend, WorkOutline } from "@mui/icons-material";
import API from "@/shared/api/axiosInstance";
import { TEXT_MAIN, TEXT_SUB, restDaysOf } from "../otMeta";

let cache = null;
let pending = null;
const loadHolidays = () => {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = API.get("/holidays")
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : data?.holidays || data?.data || [];
        cache = new Map(list.filter((h) => h?.date).map((h) => [String(h.date).slice(0, 10), { name: h.name_thai || h.name || "วันหยุด", type: h.type || "" }]));
        return cache;
      })
      .catch(() => { pending = null; return new Map(); });
  }
  return pending;
};

/** Map วันที่ (YYYY-MM-DD) → { name, type } · ระหว่างโหลดใช้ cfg.holidays จาก /ot/config แทน */
export function useHolidays(cfg) {
  const [map, setMap] = useState(cache);
  useEffect(() => { let alive = true; loadHolidays().then((m) => alive && setMap(m)); return () => { alive = false; }; }, []);
  if (map?.size) return map;
  return new Map(Object.entries(cfg?.holidays || {}).map(([d, name]) => [d, { name, type: "" }]));
}

const DAY_TH = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

/** ข้อมูลวันแบบสั้น — ใช้ซ้ำในหน้ารายละเอียด */
export const dayKind = (date, holidays, cfg) => {
  if (!date) return null;
  const h = holidays?.get(date);
  if (h) return { kind: "public", label: h.name, sub: h.type };
  const dow = moment(date).day();
  if (restDaysOf(cfg).includes(dow)) return { kind: "rest", label: `วันหยุดประจำสัปดาห์ (${DAY_TH[dow]})` };
  return { kind: "work", label: `วันทำงาน (${DAY_TH[dow]})` };
};

/**
 * 🎨 (27 ต.ค. 2569 ผู้ใช้: "แถบตัวนี้ดูงงสับสน จัดวางและทำให้ดี")
 *   บรรทัดเดียวอ่านจบ: [ไอคอน] วันอะไร วันที่เท่าไร · [ป้ายชนิดวัน] — บรรทัดล่างบอกชื่อวันหยุด หรือกติกา OT ของวันนั้น
 *   เลิกแถบ "วันหยุดเดือนนี้" (ปุ่มเยอะ ทำให้สับสน — เลือกวันจากช่องวันที่แทน)
 */
const TONE = {
  public: { icon: <Celebration />, color: "#b91c1c", bg: "#fef2f2", border: "#fecaca", tag: "วันหยุดนักขัตฤกษ์" },
  rest: { icon: <Weekend />, color: "#b45309", bg: "#fffbeb", border: "#fde68a", tag: "วันหยุดประจำสัปดาห์" },
  work: { icon: <WorkOutline />, color: "#475569", bg: "#f8fafc", border: "#e2e8f0", tag: "วันทำงาน" },
};
const RULE = {
  work: "OT วันทำงาน เริ่มหลังเลิกงาน 17:30",
  rest: "ทำงานวันหยุด 08:30–17:30 · หลัง 17:30 นับเป็น OT วันหยุด",
  public: "ทำงานวันหยุด 08:30–17:30 · หลัง 17:30 นับเป็น OT วันหยุด",
};

export default function OtDayInfo({ date, cfg, holidays }) {
  const d = dayKind(date, holidays, cfg);
  if (!d) return null;
  const t = TONE[d.kind];
  const dow = DAY_TH[moment(date).day()];
  return (
    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ borderRadius: 2.5, border: `1px solid ${t.border}`, bgcolor: t.bg, px: 1.5, py: 1 }}>
      <Box sx={{ width: 32, height: 32, borderRadius: 2, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#fff", color: t.color, border: `1px solid ${t.border}`, "& svg": { fontSize: 18 } }}>
        {t.icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.88rem", fontWeight: 800, color: TEXT_MAIN, lineHeight: 1.35 }} noWrap>
          วัน{dow}ที่ {thaiDate(date)}
          {d.kind === "public" && <Box component="span" sx={{ color: t.color }}> · {d.label}</Box>}
        </Typography>
        <Typography sx={{ fontSize: "0.76rem", color: TEXT_SUB, lineHeight: 1.35 }} noWrap>{RULE[d.kind]}</Typography>
      </Box>
      <Box component="span" sx={{ flexShrink: 0, px: 1, height: 24, display: "inline-flex", alignItems: "center", borderRadius: 99, bgcolor: "#fff", border: `1px solid ${t.border}`,
        color: t.color, fontSize: "0.72rem", fontWeight: 800, whiteSpace: "nowrap" }}>{t.tag}</Box>
    </Stack>
  );
}
