/**
 * JobKindTag — ป้ายประเภทงานในตาราง (งานสัญญา · งานโปรเจค · งานทั่วไป) + ครั้งที่ของงานสัญญา
 * ✅ (19 ต.ค. 2569 ผู้ใช้: "ใส่ประเภทงานไว้ด้วย เช่น งานสัญญา งานทั่วไป ทำให้ชัดเจน และสวยงาม")
 *    สีชุดเดียวกับแถบประเภทงานทั้งแอป (jobClassification.JOB_CLASS_META)
 */
import { Box } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { classifyJob, getJobClassMeta } from "@/shared/utils/jobClassification";
import { formatRoundLabel } from "@/shared/utils/contractRounds";

export default function JobKindTag({ event, sx }) {
  const kind = classifyJob(event) || "general";
  // งานส่งของ (ไม่เข้าหน้างาน) บอกตรงๆ — ไม่ใช่ "งานทั่วไป" ที่ต้องมีช่างเข้างาน
  const meta = event?.noVisit ? { label: "งานส่งของ", color: "#0891b2" } : (getJobClassMeta(kind) || getJobClassMeta("general"));
  const round = event?.time ? formatRoundLabel(event.time, event.visitCount, event) : "";
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, height: 22, px: 0.9, borderRadius: 99, whiteSpace: "nowrap",
      bgcolor: alpha(meta.color, 0.1), color: meta.color, border: `1px solid ${alpha(meta.color, 0.3)}`, fontSize: "0.7rem", fontWeight: 800, ...sx }}>
      <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: meta.color }} />
      {meta.label}
      {round && <Box component="span" sx={{ fontWeight: 700, opacity: 0.85 }}>· ครั้งที่ {round}</Box>}
    </Box>
  );
}
