/**
 * OtDayInfo — ข้อมูลวันหยุดของวันที่ลง OT (ชุดเดียวกับวันหยุดบนปฏิทินงาน: GET /api/holidays)
 *
 * ✅ (27 ต.ค. 2569 ผู้ใช้: "อยากให้แสดงข้อมูลวันหยุดใน event ด้วย นำมาแสดงให้ชัดเจน สวยงาม ตามวันที่เลือกลง OT")
 *   แถบใต้วันที่ของแต่ละรายการ: วันหยุดนักขัตฤกษ์ (ชื่อ + ราชการ/ธนาคาร) · วันหยุดประจำสัปดาห์ · วันทำงานปกติ
 *   + วันหยุดอื่นในเดือนเดียวกัน กดแล้วเปลี่ยนวันที่ของรายการนั้นได้ทันที
 * ⚠️ ดึงครั้งเดียวต่อการเปิดแอป (เก็บไว้ในตัวแปรระดับโมดูล) — ข้อมูลไม่กี่สิบรายการ ไม่เปลี่ยนระหว่างวัน
 */
import { useEffect, useState } from "react";
import moment from "moment";
import { Box, Stack, Typography, ButtonBase } from "@mui/material";
import { Celebration, Weekend, WorkOutline } from "@mui/icons-material";
import API from "@/shared/api/axiosInstance";
import { TEXT_MAIN, TEXT_SUB } from "../otMeta";

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
  if ((cfg?.restDays || [0]).includes(dow)) return { kind: "rest", label: `วันหยุดประจำสัปดาห์ (${DAY_TH[dow]})` };
  return { kind: "work", label: `วันทำงาน (${DAY_TH[dow]})` };
};

const TONE = {
  public: { icon: <Celebration />, color: "#b91c1c", bg: "#fef2f2", border: "#fecaca", title: "วันหยุดนักขัตฤกษ์" },
  rest: { icon: <Weekend />, color: "#b45309", bg: "#fffbeb", border: "#fde68a", title: "วันหยุด" },
  work: { icon: <WorkOutline />, color: "#475569", bg: "#f8fafc", border: "#e2e8f0", title: "วันทำงานปกติ" },
};

export default function OtDayInfo({ date, cfg, holidays, onPickDate }) {
  const d = dayKind(date, holidays, cfg);
  if (!d) return null;
  const t = TONE[d.kind];
  const month = moment(date).format("YYYY-MM");
  const others = [...(holidays?.entries() || [])]
    .filter(([k]) => k.startsWith(month) && k !== date)
    .sort(([a], [b]) => a.localeCompare(b));
  return (
    <Box sx={{ borderRadius: 2.5, border: `1px solid ${t.border}`, bgcolor: t.bg, px: 1.25, py: 1 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={{ width: 30, height: 30, borderRadius: 2, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#fff", color: t.color, border: `1px solid ${t.border}`, "& svg": { fontSize: 18 } }}>
          {t.icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: t.color, lineHeight: 1.3 }}>
            {t.title}{d.sub ? ` · ${d.sub}` : ""}
          </Typography>
          <Typography sx={{ fontSize: "0.88rem", fontWeight: 800, color: d.kind === "work" ? TEXT_MAIN : t.color, lineHeight: 1.35 }}>{d.label}</Typography>
        </Box>
        <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB, textAlign: "right", flexShrink: 0, display: { xs: "none", sm: "block" } }}>
          {d.kind === "work" ? "เวลางาน 08:30–17:30 · OT หลัง 17:30" : "ทำงานวันหยุด · ตั้งต้น 08:30–17:30"}
        </Typography>
      </Stack>
      {others.length > 0 && (
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1, pt: 1, borderTop: `1px dashed ${t.border}`, overflowX: "auto", "&::-webkit-scrollbar": { display: "none" }, scrollbarWidth: "none" }}>
          <Typography sx={{ fontSize: "0.72rem", color: TEXT_SUB, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>วันหยุดเดือนนี้</Typography>
          {others.map(([k, h]) => (
            <ButtonBase key={k} onClick={() => onPickDate?.(k)} title={`เลือกวันที่ ${moment(k).date()} — ${h.name}`}
              sx={{ flexShrink: 0, gap: 0.5, px: 1, height: 26, borderRadius: 99, bgcolor: "#fff", border: "1px solid #fecaca", fontFamily: "inherit", fontSize: "0.74rem", color: "#b91c1c", fontWeight: 700, whiteSpace: "nowrap",
                "&:hover": { bgcolor: "#fef2f2" } }}>
              <Box component="span" sx={{ fontWeight: 900 }}>{moment(k).date()}</Box>{h.name}
            </ButtonBase>
          ))}
        </Stack>
      )}
    </Box>
  );
}
