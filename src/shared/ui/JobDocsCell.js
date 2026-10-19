/**
 * JobDocsCell — ช่อง "เอกสารที่แนบ" ในตาราง (การดำเนินงาน · งานของฉัน)
 * ✅ (19 ต.ค. 2569 ผู้ใช้: "ทำให้ตรงข้อมูลจริง · ใบเสนอราคาต้องติดตาม ให้มีปุ่มเปิดฟอร์มติดตามตรงนี้ ดำเนินการได้เลย")
 *    🐛 เดิมนับแค่จำนวนไฟล์ (เช่น "รายงาน 9") ขณะที่การ์ดงานบอก "Service Report ยังไม่แนบ" (ต้องติ๊กยืนยันด้วย)
 *       → ใช้ตรรกะเดียวกับการ์ด (isDocComplete / isDocRequired) แสดงครบ 4 ชนิด + "x/4 รายการ"
 *    • ใบเสนอราคาที่อยู่ในระบบติดตาม: สถานะ + ปุ่ม "ติดตาม" เปิดกล่องใบเสนอราคา (ตัวเดียวกับหน้าติดตาม) ทับหน้าเลย
 */
import { Suspense, useState } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { CheckCircleRounded, RadioButtonUncheckedRounded, RemoveCircleOutlineRounded } from "@mui/icons-material";
import { JOB_DOC_TYPES, isDocComplete, isDocRequired } from "@/shared/utils/jobDocTypes";
import { resolveQuotationGroup } from "@/shared/utils/quotationTracking";
import { useAuth } from "@/features/auth/AuthContext";
import { can } from "@/shared/utils/roles";
import lazyWithRetry from "@/shared/utils/lazyWithRetry";

const QuotationDialogHost = lazyWithRetry(() => import("@/features/finance/pages/QuotationTracking").then((m) => ({ default: m.QuotationDialogHost })));

const QUOTE = {
  waiting_file: ["รอแนบไฟล์", "#d97706", "แนบ"], not_sent: ["กำลังเริ่มนับ", "#d97706", "เปิด"], sent: ["รอลูกค้าตอบ", "#2563eb", "ติดตาม"],
  follow_up: ["ถึงเวลาติดตาม", "#dc2626", "ติดตาม"], revising: ["ลูกค้าขอแก้ไข", "#7c3aed", "ติดตาม"], approved: ["ได้งาน", "#16a34a", "เปิด"], rejected: ["ไม่ได้งาน", "#64748b", "เปิด"],
};

export default function JobDocsCell({ event }) {
  const { userData } = useAuth() || {};
  const [quoteOpen, setQuoteOpen] = useState(false);
  if (!event) return null;
  const done = JOB_DOC_TYPES.filter((t) => isDocComplete(event, t.key)).length;
  const all = done === JOB_DOC_TYPES.length;
  const qKey = resolveQuotationGroup(event);
  const q = QUOTE[qKey];
  const canQuote = can(userData, "viewFinance");
  return (
    <Box onClick={(e) => e.stopPropagation()} sx={{ cursor: "default", minWidth: 0 }}>
      <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, color: all ? "#15803d" : "#64748b", mb: 0.3 }}>
        {done}/{JOB_DOC_TYPES.length} รายการ{all ? " · พร้อมปิดงาน" : ""}
      </Typography>
      <Stack spacing={0.25}>
        {JOB_DOC_TYPES.map((t) => {
          const n = (event[t.field] || []).length;
          const ok = isDocComplete(event, t.key);
          const notNeeded = ok && !n && event[`${t.key}Applicable`] === false;
          const required = isDocRequired(event, t.key);
          const Icon = notNeeded ? RemoveCircleOutlineRounded : ok ? CheckCircleRounded : RadioButtonUncheckedRounded;
          const iconColor = notNeeded ? "#94a3b8" : ok ? "#16a34a" : required ? "#d97706" : "#cbd5e1";
          const isQuote = t.key === "quotation";
          return (
            <Stack key={t.key} direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
              <Icon sx={{ fontSize: 14, color: iconColor, flexShrink: 0 }} />
              <Typography noWrap sx={{ fontSize: "0.74rem", fontWeight: ok ? 700 : 600, color: ok ? "#334155" : "#94a3b8" }}>
                {t.label}{n ? ` ${n}` : ""}{notNeeded ? " · ไม่มี" : !ok && required ? " *" : ""}
              </Typography>
              {isQuote && q && (
                <>
                  <Typography noWrap sx={{ fontSize: "0.7rem", fontWeight: 800, color: q[1] }}>· {q[0]}</Typography>
                  {canQuote && (
                    <Box component="button" type="button" onClick={() => setQuoteOpen(true)}
                      sx={{ ml: 0.25, px: 0.75, height: 20, border: `1px solid ${alpha(q[1], 0.45)}`, borderRadius: 99, bgcolor: qKey === "follow_up" ? q[1] : "#fff",
                        color: qKey === "follow_up" ? "#fff" : q[1], font: "inherit", fontSize: "0.66rem", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                      {q[2]} ›
                    </Box>
                  )}
                </>
              )}
            </Stack>
          );
        })}
      </Stack>
      {quoteOpen && (
        <Suspense fallback={null}>
          <QuotationDialogHost eventId={event._id} onClose={() => setQuoteOpen(false)} />
        </Suspense>
      )}
    </Box>
  );
}
