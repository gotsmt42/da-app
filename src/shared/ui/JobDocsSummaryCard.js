/**
 * JobDocsSummaryCard — กล่องสรุป "เอกสารประจำงาน" (ครบกี่รายการ · แถบความคืบหน้า · เช็กลิสต์ 4 ชนิด · ปุ่มดู/ตรวจเอกสาร)
 *
 * ✅ (10 ต.ค. 2569) เดิมอยู่ในการ์ดหน้าการดำเนินงาน (OperationBoard)
 * ✅ (26 ต.ค. 2569 ผู้ใช้: "อยากให้การแสดงแบบนี้ไปอยู่ใน editEvent ด้วย") แยกเป็นตัวกลาง ใช้ทั้งการ์ดงานและฟอร์มแก้ไขงานบนปฏิทิน
 * @param event    งาน (ต้องมีฟิลด์ไฟล์เอกสาร + *Applicable)
 * @param onOpen   กด "ดู / ตรวจเอกสาร" · ไม่ส่ง = ไม่มีปุ่ม
 */
import { Box, Stack, Typography, Button, LinearProgress } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { CheckCircle, RadioButtonUnchecked, Description, TaskAlt } from "@mui/icons-material";
import { INK, MUTED, ACCENT } from "@/shared/ui/PageKit";
import { BTN as MBTN, CARD } from "@/shared/ui/modernUi";
import { JOB_DOC_TYPES, isDocComplete, isDocRequired } from "@/shared/utils/jobDocTypes";

export default function JobDocsSummaryCard({ event, onOpen, openLabel = "ดู / ตรวจเอกสาร", sx }) {
  const done = JOB_DOC_TYPES.filter((t) => isDocComplete(event, t.key)).length;
  const total = JOB_DOC_TYPES.length;
  const allDone = done === total;
  const tone = allDone ? "#16a34a" : ACCENT;
  return (
    <Box sx={{ ...CARD, mt: 1.5, p: { xs: 1.75, sm: 2 }, borderColor: alpha(tone, 0.3), boxShadow: `0 1px 2px rgba(15,23,42,.04), 0 8px 20px -12px ${alpha(tone, 0.45)}`, ...sx }}>
      <Stack direction="row" alignItems="center" gap={1.25}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2.5, flexShrink: 0, display: "grid", placeItems: "center", bgcolor: alpha(tone, 0.12), color: tone }}>
          {allDone ? <TaskAlt sx={{ fontSize: 22 }} /> : <Description sx={{ fontSize: 22 }} />}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.98rem", fontWeight: 900, color: INK }}>เอกสารประจำงาน</Typography>
          <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>
            {allDone ? "ครบแล้ว — พร้อมปิดงาน" : `ช่างแนบ/ระบุแล้ว ${done} จาก ${total} รายการ`}
          </Typography>
        </Box>
        <Typography sx={{ flexShrink: 0, fontSize: "1.35rem", fontWeight: 900, color: tone, fontVariantNumeric: "tabular-nums" }}>
          {done}/{total}
        </Typography>
      </Stack>
      <LinearProgress variant="determinate" value={(done / total) * 100}
        sx={{ mt: 1.25, height: 6, borderRadius: 5, bgcolor: alpha(MUTED, 0.12), "& .MuiLinearProgress-bar": { bgcolor: tone, borderRadius: 5 } }} />
      <Box sx={{ mt: 1.25, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75 }}>
        {JOB_DOC_TYPES.map((t) => {
          const ok = isDocComplete(event, t.key);
          const files = (event[t.field] || []).length;
          return (
            <Stack key={t.key} direction="row" alignItems="center" gap={0.6} sx={{ minWidth: 0 }}>
              {ok
                ? <CheckCircle sx={{ fontSize: 17, color: "#16a34a", flexShrink: 0 }} />
                : <RadioButtonUnchecked sx={{ fontSize: 17, color: "#cbd5e1", flexShrink: 0 }} />}
              <Typography noWrap sx={{ fontSize: "0.8rem", fontWeight: ok ? 600 : 800, color: ok ? MUTED : INK }}>
                {t.label}{files > 1 ? ` · ${files}` : ""}{!ok && isDocRequired(event, t.key) ? " *" : ""}
              </Typography>
            </Stack>
          );
        })}
      </Box>
      {onOpen && (
        <Button fullWidth variant="outlined" disableElevation onClick={onOpen}
          startIcon={<Description />} sx={{ ...MBTN.outline(tone), mt: 1.5 }}>
          {openLabel}
        </Button>
      )}
    </Box>
  );
}
