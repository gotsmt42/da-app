import { useState } from "react";
import { Box } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { fileKindOf } from "@/shared/utils/fileKind";
import { thumbUrl } from "@/shared/utils/cloudinaryImage";

/**
 * ภาพย่อไฟล์ — รูป = ภาพจริง (โหลดไม่ได้ = ป้าย "รูป") · อื่นๆ = ป้ายสีตามชนิด (PDF แดง · XLS เขียว · DOC น้ำเงิน)
 * ✅ (10 พ.ย. 2569 ผู้ใช้: "ให้แสดงรูปแบบไฟล์ด้วย ให้สวยงามเช่น PDF Excel หรือรูปภาพ")
 */
// 🔁 (10 พ.ย. 2569 ผู้ใช้: "อัพไฟล์รูปภาพแล้วชอบเด้งกระพริบ เหมือนโหลดรูปเบื้องหน้า · ให้โหลดเบื้องหลัง")
//    ภาพย่อขนาดเล็กจาก Cloudinary (ไม่โหลดรูปเต็ม) · โหลดเบื้องหลังบนพื้นเทา แล้วค่อยจางเข้า (ไม่เห็นรูปค่อยๆ วาดทีละแถบ)
//    localUrl = รูปในเครื่องระหว่างอัปโหลด (แสดงทันที) · busy = วงหมุนทับระหว่างอัปโหลด
export default function FileKindThumb({ name, url, localUrl, busy = false, size = 40 }) {
  const k = fileKindOf(name, url);
  const [broken, setBroken] = useState(false);
  const [ready, setReady] = useState(false);
  const box = { width: size, height: size, borderRadius: 1.5, flexShrink: 0, overflow: "hidden", position: "relative" };
  const src = localUrl || (url ? thumbUrl(url) || url : "");
  if (k.isImage && src && !broken) {
    return (
      <Box sx={{ ...box, bgcolor: "#eef2f6", border: "1px solid #e6e9ef" }}>
        <Box component="img" src={src} alt="" decoding="async" onLoad={() => setReady(true)} onError={() => setBroken(true)}
          sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: ready ? 1 : 0, transition: "opacity .25s" }} />
        {busy && (
          <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", bgcolor: "rgba(255,255,255,.55)" }}>
            <Box sx={{ width: 18, height: 18, borderRadius: "50%", border: "2.5px solid #bfdbfe", borderTopColor: "#2563eb", animation: "ttfk-spin .8s linear infinite", "@keyframes ttfk-spin": { to: { transform: "rotate(360deg)" } } }} />
          </Box>
        )}
      </Box>
    );
  }
  return (
    <Box sx={{ ...box, display: "grid", placeItems: "center", bgcolor: alpha(k.color, 0.1), color: k.color,
      fontSize: size >= 40 ? "0.7rem" : "0.62rem", fontWeight: 900, letterSpacing: ".02em" }}>
      {busy ? <Box sx={{ width: 18, height: 18, borderRadius: "50%", border: `2.5px solid ${alpha(k.color, 0.25)}`, borderTopColor: k.color, animation: "ttfk-spin .8s linear infinite", "@keyframes ttfk-spin": { to: { transform: "rotate(360deg)" } } }} /> : k.label}
    </Box>
  );
}
