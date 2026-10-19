/**
 * ImagePreview — ตัวดูรูปที่เปิดเร็ว (ใช้ร่วมทุกกล่องดูไฟล์ในแอป)
 */
import { useState } from "react";
import { Box, Stack, Typography, CircularProgress } from "@mui/material";
import { getOptimizedImageUrl } from "@/shared/utils/cloudinaryImage";

// ─── ImagePreview — เปิดรูปเร็ว ─────────────────────────────────────────
// ✅ (19 ต.ค. 2569 ผู้ใช้: "การเปิดไฟล์ยังเป็นรูปแบบเก่า มันช้า ทำให้ดีกว่านี้")
//    🐛 เดิมโหลดรูปกว้าง 1600px ทุกครั้งแล้วจอขาวรอจนเสร็จ (รูปถ่ายเอกสาร 2-4 MB บนเน็ตมือถือรอหลายวินาที)
//    ✅ 1) โชว์รูปย่อเบลอทันที (ขนาดเล็กมาก โหลดเสร็จเกือบทันที) → 2) รูปคมชัดขนาดพอดีจอซ้อนขึ้นมาเมื่อโหลดเสร็จ
//       3) พื้นหลังเข้มแบบตัวดูรูป · พอดีจอเสมอ · แตะรูปเพื่อซูมเต็มขนาด / แตะอีกครั้งกลับพอดีจอ
const ImagePreview = ({ url, name }) => {
  const [loaded, setLoaded] = useState(false);
  const [zoom, setZoom] = useState(false);
  const fitW = Math.min(2000, Math.round((window.innerWidth || 1200) * Math.min(window.devicePixelRatio || 1, 2)));
  const thumb = getOptimizedImageUrl(url, { width: 48 });
  const full = getOptimizedImageUrl(url, { width: zoom ? 2400 : fitW });
  return (
    <Box onClick={() => setZoom((z) => !z)} sx={{
      position: "relative", bgcolor: "#0f172a", minHeight: { xs: "calc(100vh - 66px)", sm: "min(80vh, 820px)" }, display: "grid", placeItems: zoom ? "start center" : "center",
      overflow: "auto", cursor: zoom ? "zoom-out" : "zoom-in",
    }}>
      {/* รูปย่อเบลอ — เห็นภาพทันทีระหว่างรอรูปเต็ม */}
      {!loaded && thumb !== url && (
        <Box component="img" src={thumb} alt="" aria-hidden sx={{ position: "absolute", inset: 0, m: "auto", maxWidth: "100%", maxHeight: "100%", width: "auto", height: "100%", objectFit: "contain", filter: "blur(14px)", transform: "scale(1.02)", opacity: 0.8 }} />
      )}
      <Box component="img" src={full} alt={name || ""} decoding="async" onLoad={() => setLoaded(true)} sx={{
        position: "relative", display: "block", transition: "opacity .25s", opacity: loaded ? 1 : 0,
        ...(zoom ? { maxWidth: "none", width: "auto" } : { maxWidth: "100%", maxHeight: { xs: "calc(100vh - 66px)", sm: "min(80vh, 820px)" }, objectFit: "contain" }),
      }} />
      {!loaded && (
        <Stack direction="row" alignItems="center" gap={1} sx={{ position: "absolute", left: "50%", bottom: 16, transform: "translateX(-50%)", px: 1.5, py: 0.75, borderRadius: 99, bgcolor: "rgba(15,23,42,.75)", color: "#fff" }}>
          <CircularProgress size={14} sx={{ color: "#fff" }} />
          <Typography sx={{ fontSize: "0.78rem", fontWeight: 700 }}>กำลังโหลดรูปความละเอียดเต็ม…</Typography>
        </Stack>
      )}
      {loaded && !zoom && (
        <Typography sx={{ position: "absolute", right: 12, bottom: 10, fontSize: "0.7rem", color: "rgba(255,255,255,.6)", pointerEvents: "none" }}>แตะรูปเพื่อซูม</Typography>
      )}
    </Box>
  );
};

export default ImagePreview;
