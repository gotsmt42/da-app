/**
 * ServiceReportAiBar — แถบ "สรุปด้วย AI" ใต้ไฟล์ Service Report (ใช้ร่วม: หน้าการดำเนินงาน · งานของฉัน)
 * ✅ (25 ต.ค. 2569 ผู้ใช้: "ให้อ่าน Service Report ของช่าง แล้วกดสร้างสรุปออกมาเป็น PDF")
 *    ป้ายบอกสถานะสรุป (ยังไม่สรุป / ร่าง / ยืนยันแล้ว) + ปุ่มเปิดหน้าต่างสรุป
 * ⚠️ หน้าต่างสรุป (มี jsPDF + ฟอนต์ไทย ~0.5MB) โหลดเมื่อกดเปิดเท่านั้น — ไม่ถ่วงการเปิดหน้า/การ์ดงาน
 */
import { Suspense, useState } from "react";
import { Box, ButtonBase, Stack, Typography } from "@mui/material";
import { AutoAwesome, ChevronRight } from "@mui/icons-material";
import lazyWithRetry from "@/shared/utils/lazyWithRetry";
import { ACCENT, ACCENT_SOFT, MUTED } from "@/shared/ui/PageKit";

const ServiceReportSummaryDialog = lazyWithRetry(() => import("./ServiceReportSummaryDialog"));

const STATUS = {
  "": { text: "ให้ AI อ่านใบแล้วสรุปเป็นรายงาน PDF", tone: MUTED },
  draft: { text: "สรุปแล้ว (ร่าง) · รอตรวจและยืนยัน", tone: "#b45309" },
  confirmed: { text: "สรุปยืนยันแล้ว · พร้อมออก PDF", tone: "#15803d" },
};

export default function ServiceReportAiBar({ event, onChanged, sx }) {
  const [open, setOpen] = useState(false);
  // สถานะล่าสุดจากหน้าต่างสรุป — หน้าจอของคนที่กดเองไม่ได้รับสัญญาณเรียลไทม์ของตัวเอง จึงจำไว้ที่นี่
  const [localStatus, setLocalStatus] = useState(null);
  if (!event?._id) return null;
  const status = localStatus ?? event.serviceReportAi?.status ?? "";
  const st = STATUS[status] || STATUS[""];
  return (
    <>
      <ButtonBase onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        sx={{ width: "100%", justifyContent: "flex-start", gap: 1, px: 1.25, py: 0.9, borderRadius: "12px", bgcolor: ACCENT_SOFT,
          border: "1px solid #dbeafe", textAlign: "left", fontFamily: "inherit", ...sx }}>
        <Box sx={{ width: 30, height: 30, borderRadius: "9px", display: "grid", placeItems: "center", bgcolor: "#fff", color: ACCENT, flexShrink: 0 }}>
          <AutoAwesome sx={{ fontSize: 17 }} />
        </Box>
        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: "0.84rem", color: ACCENT, lineHeight: 1.3 }}>
            {status ? "ดูสรุป Service Report" : "สรุปด้วย AI"}
          </Typography>
          <Typography noWrap sx={{ fontSize: "0.72rem", color: st.tone, lineHeight: 1.35 }}>{st.text}</Typography>
        </Stack>
        <ChevronRight sx={{ fontSize: 20, color: ACCENT }} />
      </ButtonBase>
      {open && (
        <Suspense fallback={null}>
          <ServiceReportSummaryDialog open={open} onClose={() => setOpen(false)} event={event} onChanged={(st2) => { setLocalStatus(st2); onChanged?.(st2); }} />
        </Suspense>
      )}
    </>
  );
}
