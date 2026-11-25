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
// 🔁 (25 พ.ย. 2569) สีหลักเปลี่ยนจากแดงเป็นน้ำเงินระบบ — แดงสงวนให้เรื่องผิดปกติ/อันตรายเท่านั้น
//    done = หมวดนี้กรอกครบแล้ว → วงกลมเขียวพร้อมเครื่องหมายถูก (เห็นความคืบหน้าทั้งฟอร์มแวบเดียว)
export default function FormSection({ step, icon, title, hint, optional, action, accent = "#2563eb", done = false, id, children, sx }) {
  const tone = done ? "#16a34a" : accent;
  return (
    <Box id={id} sx={{ border: "1px solid #e6e9ef", borderRadius: 3, bgcolor: "background.paper", overflow: "hidden", scrollMarginTop: 12, ...sx }}>
      <Stack direction="row" alignItems="center" gap={1.25} sx={{ px: 2, py: 1.25, bgcolor: "#f8fafc", borderBottom: "1px solid #eef2f7" }}>
        <Box sx={{
          width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          bgcolor: done ? tone : alpha(tone, 0.1), color: done ? "#fff" : tone, fontSize: "0.8rem", fontWeight: 800,
          transition: "background-color .2s, color .2s",
          "& svg": { fontSize: 16 },
        }}>
          {done ? "✓" : (icon || step)}
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
