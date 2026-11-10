/**
 * RefQuotesBar — ใบเสนอราคาแยกที่ "อิงงานนี้" แสดงในหน้างาน (การดำเนินงาน · งานของช่าง · งานเข้า)
 * ✅ (10 พ.ย. 2569 ผู้ใช้: "ใบเสนอราคาแยกที่อิงงาน ยังไม่ขึ้นป้ายในหน้างานนั้นเอง ทำให้สมบูรณ์")
 *    ป้ายละ 1 ใบ: เรื่อง · สถานะ (ชื่อ/สีชุดเดียวกับหน้าติดตามใบเสนอราคา) · กดเปิดใบนั้นในหน้าติดตามใบเสนอราคา
 *    งานหลายวัน = ทุกวันของงานเห็นใบเดียวกัน (อิงด้วย jobGroupId)
 *
 * ข้อมูล: โหลดรายการใบเสนอราคาแยกครั้งเดียวทั้งแอป (แคชในหน่วยความจำ) · มีการบันทึกงาน (realtime "events") = โหลดใหม่
 *    ไม่ยิงคำขอแยกทีละการ์ด
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { RequestQuoteRounded, ChevronRightRounded } from "@mui/icons-material";
import EventService from "@/shared/services/EventService";
import useRealtime from "@/shared/realtime/useRealtime";
import { resolveQuotationGroup, QUOTE_STATUS } from "@/shared/utils/quotationTracking";

let cache = null; // { list, at }
let inflight = null;
const subs = new Set();
const STALE_MS = 60_000;

const load = (force = false) => {
  if (!force && cache && Date.now() - cache.at < STALE_MS) return Promise.resolve(cache.list);
  if (inflight) return inflight;
  inflight = EventService.GetDraftEvents({ quotes: "only" })
    .then((r) => {
      cache = { list: (r?.drafts || []).filter((d) => !d.cancelledAt && d.quoteRef?.kind === "event"), at: Date.now() };
      subs.forEach((fn) => fn(cache.list));
      return cache.list;
    })
    .catch(() => cache?.list || [])
    .finally(() => { inflight = null; });
  return inflight;
};

/** ใบเสนอราคาแยกทั้งหมดที่อิงงาน (ใช้ร่วมกันทุกการ์ด) */
export function useRefQuotes() {
  const [list, setList] = useState(cache?.list || []);
  useEffect(() => {
    subs.add(setList);
    load().then(setList);
    return () => { subs.delete(setList); };
  }, []);
  useRealtime("events", () => { load(true); });
  return list;
}

/** ใบที่อิงงานนี้ (วันไหนของงานก็ได้) */
export const refQuotesOf = (list, event) => {
  if (!event?._id) return [];
  return (list || []).filter((q) => q.quoteRef?.eventId === String(event._id) || (event.jobGroupId && q.quoteRef?.jobGroupId === String(event.jobGroupId)));
};

export default function RefQuotesBar({ event, sx }) {
  const navigate = useNavigate();
  const all = useRefQuotes();
  const mine = refQuotesOf(all, event);
  if (!mine.length) return null;
  return (
    <Box sx={{ px: 1.25, py: 1, borderRadius: 2.5, border: "1px solid #dbeafe", bgcolor: "#f8fbff", ...sx }}>
      <Typography sx={{ display: "flex", alignItems: "center", gap: 0.6, fontSize: "0.78rem", fontWeight: 800, color: "#1e293b", mb: 0.75 }}>
        <RequestQuoteRounded sx={{ fontSize: 17, color: "#2563eb" }} />ใบเสนอราคาแยกที่อิงงานนี้ <Box component="span" sx={{ color: "#64748b", fontWeight: 600 }}>· {mine.length} ใบ</Box>
      </Typography>
      <Stack spacing={0.6}>
        {mine.map((q) => {
          const st = QUOTE_STATUS[resolveQuotationGroup(q) || "waiting_file"] || QUOTE_STATUS.waiting_file;
          return (
            <Box key={q._id} component="button" type="button" onClick={(e) => { e.stopPropagation(); navigate(`/finance?tab=quotations&jobId=${q._id}`); }}
              sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%", minWidth: 0, textAlign: "left", font: "inherit", cursor: "pointer",
                px: 1, py: 0.75, borderRadius: 2, border: "1px solid #e6e9ef", bgcolor: "#fff", "&:hover": { borderColor: "#93c5fd" } }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: "0.82rem", fontWeight: 800, color: "#0f172a" }}>{q.title || "ใบเสนอราคา"}</Typography>
                <Typography noWrap sx={{ fontSize: "0.7rem", color: "#64748b" }}>
                  {[q.quotationNo, q.quotationAmount ? `฿${Number(q.quotationAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 })}` : "", q.responsiblePerson].filter(Boolean).join(" · ") || "ยังไม่มีเลขที่"}
                </Typography>
              </Box>
              <Box component="span" sx={{ flexShrink: 0, display: "inline-flex", alignItems: "center", height: 22, px: 0.9, borderRadius: 99, fontSize: "0.68rem", fontWeight: 800, whiteSpace: "nowrap",
                color: st.color, bgcolor: alpha(st.color, 0.1) }}>{st.short || st.label}</Box>
              <ChevronRightRounded sx={{ fontSize: 18, color: "#94a3b8", flexShrink: 0 }} />
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
