/** ชิ้นส่วนที่ใช้ซ้ำในระบบสต๊อก — ป้าย · รูปสินค้า · กล่องหัวข้อฟอร์ม */
import { Box, Stack, Typography } from "@mui/material";
import { Category, Handyman } from "@mui/icons-material";
import { kindMeta, reqStatus, TEXT_MAIN, TEXT_SUB, BORDER_MAIN, STOCK_ACCENT } from "../stockMeta";

const pill = { display: "inline-flex", alignItems: "center", px: 0.9, height: 22, borderRadius: 99, fontSize: "0.72rem", fontWeight: 800, whiteSpace: "nowrap", flexShrink: 0 };

export const KindTag = ({ kind }) => {
  const m = kindMeta(kind);
  return <Box component="span" sx={{ ...pill, bgcolor: m.bg, color: m.color }}>{m.label}</Box>;
};

export const ReqBadge = ({ status, label }) => {
  const m = reqStatus(status);
  return (
    <Box component="span" sx={{ ...pill, gap: 0.5, px: 1, height: 24, bgcolor: m.bg, color: m.color }}>
      <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: m.color }} />
      {label || m.label}
    </Box>
  );
};

/**
 * รูปสินค้า — มีรูปแสดงรูป (ครอปสี่เหลี่ยม) · ไม่มีรูปแสดงไอคอนตามชนิดบนพื้นสีอ่อน
 * ✅ ผู้ใช้: "ให้ใส่รูปสินค้าได้ด้วย และแสดงให้สวยงาม ไม่รก" — ขนาดเดียวกันทุกแถว ไม่ดันเลย์เอาต์
 */
export const Thumb = ({ item, size = 40, radius = 2 }) => {
  const url = item?.photo?.url;
  return (
    <Box sx={{ width: size, height: size, borderRadius: radius, flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
      bgcolor: "#f1f5f9", color: "#94a3b8", border: `1px solid ${BORDER_MAIN}`, "& svg": { fontSize: size * 0.5 } }}>
      {url
        ? <Box component="img" src={url.replace("/upload/", `/upload/c_fill,w_${size * 3},h_${size * 3},q_auto,f_auto/`)} alt="" loading="lazy" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : item?.kind === "asset" ? <Handyman /> : <Category />}
    </Box>
  );
};

/** ช่องกรอก — ป้ายอยู่เหนือช่อง (อ่านง่ายกว่าป้ายลอย) · พื้นขาว มุมมน */
export const FIELD_SX = {
  "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "#fff" },
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#d7dde5" },
};
export const Label = ({ children, required, hint }) => (
  <Stack direction="row" alignItems="baseline" spacing={0.75} sx={{ mb: 0.6 }}>
    <Typography sx={{ fontWeight: 700, fontSize: "0.82rem", color: TEXT_MAIN }}>
      {children}{required && <Box component="span" sx={{ color: "#dc2626", ml: 0.25 }}>*</Box>}
    </Typography>
    {hint && <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>{hint}</Typography>}
  </Stack>
);

/** กล่องหัวข้อในฟอร์ม — เลขขั้นตอนในวงกลม + ชื่อ + คำอธิบายสั้น */
export const Section = ({ n, title, hint, error, children, right }) => (
  <Box sx={{ bgcolor: "#fff", borderRadius: 3, border: `1px solid ${error ? "#fca5a5" : BORDER_MAIN}`, p: { xs: 1.5, sm: 2 } }}>
    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1.5 }}>
      {n && (
        <Box sx={{ width: 26, height: 26, borderRadius: "50%", bgcolor: STOCK_ACCENT, color: "#fff", fontWeight: 800, fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</Box>
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", color: TEXT_MAIN, lineHeight: 1.3 }}>{title}</Typography>
        {hint && <Typography sx={{ fontSize: "0.76rem", color: TEXT_SUB, lineHeight: 1.35 }}>{hint}</Typography>}
      </Box>
      {right}
    </Stack>
    {children}
  </Box>
);
