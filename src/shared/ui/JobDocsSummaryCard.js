/**
 * JobDocsSummaryCard — กล่องสรุป "เอกสารประจำงาน" (ครบกี่รายการ · แถบความคืบหน้า · เช็กลิสต์ 4 ชนิด · ปุ่มดู/ตรวจเอกสาร)
 *
 * ✅ (10 ต.ค. 2569) เดิมอยู่ในการ์ดหน้าการดำเนินงาน (OperationBoard)
 * ✅ (26 ต.ค. 2569 ผู้ใช้: "อยากให้การแสดงแบบนี้ไปอยู่ใน editEvent ด้วย") แยกเป็นตัวกลาง ใช้ทั้งการ์ดงานและฟอร์มแก้ไขงานบนปฏิทิน
 * @param event    งาน (ต้องมีฟิลด์ไฟล์เอกสาร + *Applicable)
 * @param onOpen   กด "ดู / ตรวจเอกสาร" · ไม่ส่ง = ไม่มีปุ่ม
 * @param expanded (ไม่บังคับ) true/false = ปุ่มเป็นตัวย่อ/ขยายรายการเอกสารใต้กล่อง (มีลูกศรบอกสถานะ)
 * @param children (ไม่บังคับ) รายการเอกสาร — วางไว้ "ในกรอบเดียวกัน" ตอน expanded
 *
 * 🔁 (12 พ.ย. 2569 ผู้ใช้: "ทำให้เอกสารงาน ให้มันดูอยู่ในกรอบเดียว ให้สังเกตง่ายๆ")
 *    ส่ง children มา = กรอบเดียว: หัวสรุป (กดย่อ/ขยาย) → การ์ดเอกสาร 4 ชนิดอยู่ข้างใน
 *    เช็กลิสต์ 2×2 แสดงตลอด · ขยายอยู่ = ไม่มีปุ่มใหญ่ซ้ำ (ย่อได้จากหัวกรอบ)
 */
import { Box, Stack, Typography, Button, ButtonBase, Collapse, LinearProgress } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { CheckCircleRounded as CheckCircle, RadioButtonUncheckedRounded as RadioButtonUnchecked, DescriptionRounded as Description, TaskAltRounded as TaskAlt, ExpandMoreRounded as ExpandMore } from "@mui/icons-material";
import { INK, MUTED, ACCENT } from "@/shared/ui/PageKit";
import { BTN as MBTN, CARD } from "@/shared/ui/modernUi";
import { JOB_DOC_TYPES, isDocComplete, isDocRequired } from "@/shared/utils/jobDocTypes";

export default function JobDocsSummaryCard({ event, onOpen, openLabel = "ดู / ตรวจเอกสาร", expanded, sx, children }) {
  const done = JOB_DOC_TYPES.filter((t) => isDocComplete(event, t.key)).length;
  const total = JOB_DOC_TYPES.length;
  const allDone = done === total;
  const tone = allDone ? "#16a34a" : ACCENT;
  return (
    // 🔁 (12 พ.ย. 2569 ผู้ใช้: "ระยะห่างขอบข้างการ์ดข้างในดูเยอะไป ลดลงให้พอดี") มีรายการเอกสารข้างใน = ขอบข้างแคบลง
    <Box sx={{ ...CARD, mt: 1.5, p: children ? { xs: 1.25, sm: 1.75 } : { xs: 1.75, sm: 2 }, borderColor: alpha(tone, 0.3), boxShadow: `0 1px 2px rgba(15,23,42,.04), 0 8px 20px -12px ${alpha(tone, 0.45)}`, ...sx }}>
      <Stack direction="row" alignItems="center" gap={1.25}
        {...(children && onOpen ? { component: ButtonBase, onClick: onOpen, "aria-expanded": Boolean(expanded) } : {})}
        sx={children && onOpen ? { width: "100%", textAlign: "left", fontFamily: "inherit", borderRadius: "10px" } : undefined}>
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
        {children && onOpen && (
          <Stack alignItems="center" sx={{ flexShrink: 0, color: MUTED, ml: -0.25 }}>
            <ExpandMore sx={{ fontSize: 22, transition: "transform .2s", transform: expanded ? "rotate(180deg)" : "none" }} />
            <Typography component="span" sx={{ fontSize: "0.66rem", fontWeight: 700, lineHeight: 1 }}>{expanded ? "ย่อ" : "แสดง"}</Typography>
          </Stack>
        )}
      </Stack>
      <LinearProgress variant="determinate" value={(done / total) * 100}
        sx={{ mt: 1.25, height: 6, borderRadius: 5, bgcolor: alpha(MUTED, 0.12), "& .MuiLinearProgress-bar": { bgcolor: tone, borderRadius: 5 } }} />
      {/* 🔁 (12 พ.ย. 2569 ผู้ใช้: "เวลาขยาย ให้มันคงเหลือช่องติ๊กด้วย ให้ดูง่าย") เช็กลิสต์แสดงตลอด ทั้งย่อและขยาย */}
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
      {children && (
        <Collapse in={Boolean(expanded)} timeout={220} unmountOnExit>
          {/* การ์ดเอกสารข้างในกรอบ — พื้นเทาอ่อน ไม่มีเงา แยกจากกรอบนอกชัด */}
          <Box sx={{ mt: 1.25, pt: 1.25, mx: { xs: -0.5, sm: 0 }, borderTop: "1px solid #eef2f7",
            "& .tt-doc-card": { bgcolor: "#f8fafc", borderColor: "#eef2f7", px: { xs: 1.1, sm: 1.5 }, borderRadius: "12px" } }}>{children}</Box>
        </Collapse>
      )}
      {onOpen && !(children && expanded) && (
        <Button fullWidth variant="outlined" disableElevation onClick={onOpen}
          startIcon={<Description />}
          endIcon={expanded === undefined ? undefined : <ExpandMore sx={{ transition: "transform .2s", transform: expanded ? "rotate(180deg)" : "none" }} />}
          aria-expanded={expanded === undefined ? undefined : expanded}
          sx={{ ...MBTN.outline(tone), mt: 1.5 }}>
          {openLabel}
        </Button>
      )}
    </Box>
  );
}
