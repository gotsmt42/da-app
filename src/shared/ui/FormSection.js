import { Box, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

/**
 * กล่องหมวดในฟอร์ม — หัวข้อ (มีเลขลำดับหรือไอคอน) + คำอธิบายสั้น + เนื้อหาในกรอบ
 *
 * ✅ ทำไมต้องมี: ฟอร์มยาวที่วางช่องเรียงต่อกันยาวเหยียด มีแค่ตัวหนังสือเทาเล็กๆ คั่นหมวด อ่านไม่ออกว่า
 *    ช่องไหนเป็นของเรื่องไหน — แบ่งเป็นกล่องชัดๆ ทีละเรื่อง กวาดตาแล้วรู้ทันทีว่ากรอกถึงไหน เหลืออะไร
 *
 * @param step     เลขลำดับในวงกลม (ใส่ icon แทนได้)
 * @param icon     ไอคอนแทนเลขลำดับ
 * @param title    หัวข้อหมวด
 * @param hint     คำอธิบายสั้นใต้หัวข้อ
 * @param optional แสดงป้าย "ไม่บังคับ"
 * @param action   ปุ่ม/ข้อความเล็กชิดขวาของหัวข้อ
 * @param accent   สีหลักของหมวด
 */
export default function FormSection({ step, icon, title, hint, optional, action, accent = "#dc2626", children, sx }) {
  return (
    <Box sx={{ border: "1px solid #e2e8f0", borderRadius: 3, bgcolor: "background.paper", overflow: "hidden", ...sx }}>
      <Stack direction="row" alignItems="center" gap={1.25} sx={{ px: 2, py: 1.25, bgcolor: "#f8fafc", borderBottom: "1px solid #eef2f7" }}>
        <Box sx={{
          width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          bgcolor: alpha(accent, 0.1), color: accent, fontSize: "0.8rem", fontWeight: 800,
          "& svg": { fontSize: 16 },
        }}>
          {icon || step}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: "0.9rem", lineHeight: 1.3 }}>
            {title}
            {optional && (
              <Box component="span" sx={{ ml: 0.75, px: 0.75, py: 0.1, borderRadius: 1, fontSize: "0.66rem", fontWeight: 700, color: "#64748b", bgcolor: "#eef2f7", verticalAlign: "1px" }}>
                ไม่บังคับ
              </Box>
            )}
          </Typography>
          {hint && <Typography sx={{ fontSize: "0.74rem", color: "#64748b", lineHeight: 1.4 }}>{hint}</Typography>}
        </Box>
        {action}
      </Stack>
      <Box sx={{ p: 2 }}>{children}</Box>
    </Box>
  );
}

/** แถวช่องกรอก 2 คอลัมน์บนจอใหญ่ / 1 คอลัมน์บนมือถือ — ระยะห่างเท่ากันทั้งฟอร์ม */
export function FieldGrid({ children, columns = 2, sx }) {
  return (
    <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: `repeat(${columns}, minmax(0, 1fr))` }, ...sx }}>
      {children}
    </Box>
  );
}
