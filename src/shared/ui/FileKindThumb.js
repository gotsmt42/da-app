import { useState } from "react";
import { Box } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { fileKindOf } from "@/shared/utils/fileKind";

/**
 * ภาพย่อไฟล์ — รูป = ภาพจริง (โหลดไม่ได้ = ป้าย "รูป") · อื่นๆ = ป้ายสีตามชนิด (PDF แดง · XLS เขียว · DOC น้ำเงิน)
 * ✅ (10 พ.ย. 2569 ผู้ใช้: "ให้แสดงรูปแบบไฟล์ด้วย ให้สวยงามเช่น PDF Excel หรือรูปภาพ")
 */
export default function FileKindThumb({ name, url, size = 40 }) {
  const k = fileKindOf(name, url);
  const [broken, setBroken] = useState(false);
  const box = { width: size, height: size, borderRadius: 1.5, flexShrink: 0, overflow: "hidden" };
  if (k.isImage && url && !broken) {
    return (
      <Box component="img" src={url} alt="" loading="lazy" onError={() => setBroken(true)}
        sx={{ ...box, objectFit: "cover", display: "block", bgcolor: "#f1f5f9", border: "1px solid #e6e9ef" }} />
    );
  }
  return (
    <Box sx={{ ...box, display: "grid", placeItems: "center", bgcolor: alpha(k.color, 0.1), color: k.color,
      fontSize: size >= 40 ? "0.7rem" : "0.62rem", fontWeight: 900, letterSpacing: ".02em" }}>
      {k.label}
    </Box>
  );
}
