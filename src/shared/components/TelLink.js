import React, { useState } from "react";
import { Box, Tooltip, IconButton } from "@mui/material";
import PhoneIphone from "@mui/icons-material/PhoneIphone";
import ContentCopy from "@mui/icons-material/ContentCopy";
import Check from "@mui/icons-material/Check";

/**
 * ☎️ เบอร์โทรที่ "กดโทรออกได้ + คัดลอกได้" — ของกลางที่ทุกหน้าที่แสดงเบอร์ผู้ติดต่อใช้ร่วมกัน
 * (ภาพรวมงาน · หน้าการดำเนินงาน ทั้งแบบตารางและการ์ด)
 *
 * ⚠️ ทำไมต้องมีทั้ง 2 ทาง ไม่ใช่เลือกอย่างใดอย่างหนึ่ง:
 *   • กดโทร (tel:) — ใช้ได้จริงบนมือถือ/แท็บเล็ตที่ช่างถือไปหน้างาน กดทีเดียวโทรออกเลย
 *   • ปุ่มคัดลอก — บนเดสก์ท็อป ลิงก์ tel: มักไม่มีแอปรองรับ กดแล้วไม่เกิดอะไรขึ้น (หรือเด้งหา
 *     โปรแกรมที่ไม่ได้ติดตั้ง) คนที่นั่งหน้าคอมต้องการ "เอาเบอร์ไปวางในไลน์/โทรศัพท์ตั้งโต๊ะ" มากกว่า
 *
 * ⚠️ href ต้องตัดทุกอย่างที่ไม่ใช่ตัวเลข/+ ออกก่อนเสมอ — คนกรอกเบอร์กันคนละแบบ ("081-234-5678",
 * "081 234 5678", "02-123-4567 ต่อ 5") ถ้าใส่ดิบๆ ลง tel: บางเครื่องจะโทรผิดเบอร์หรือกดไม่ติดเลย
 * ✅ ตัวหนังสือที่แสดงและค่าที่คัดลอกยังเป็นค่าที่ผู้ใช้พิมพ์ไว้เป๊ะๆ (อ่านง่ายกว่าเลขติดกันยาว และเบอร์
 * ที่มี "ต่อ 5" ต้องคัดลอกไปครบ) — แปลงเฉพาะ href ที่ใช้โทรเท่านั้น
 *
 * ⚠️ stopPropagation จำเป็นเสมอ — คอมโพเนนต์นี้ถูกวางในเซลล์ตาราง/การ์ดที่คลิกแล้วเข้าโหมดแก้ไข
 * หรือเปิดกล่องรายละเอียด ถ้าไม่หยุด event ไว้ การกดโทร/คัดลอกจะกลายเป็นการเปิดอย่างอื่นแทน
 */
const TelLink = ({ tel, size = "0.75rem", showIcon = true, showCopy = true }) => {
  const [copied, setCopied] = useState(false);
  const raw = String(tel || "").trim();
  if (!raw) return null;
  const dial = raw.replace(/[^\d+]/g, "");

  const handleCopy = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      // ⚠️ navigator.clipboard ใช้ได้เฉพาะ secure context (https/localhost) — บนเครื่องที่เปิดผ่าน
      // http ในวงแลน (ซึ่งเป็นวิธีที่ทีมช่างใช้จริงบางเครื่อง) จะไม่มีให้เรียกเลย ต้องมีทางสำรอง
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(raw);
      } else {
        const ta = document.createElement("textarea");
        ta.value = raw;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      // กลับเป็นไอคอนเดิมเอง — ไม่ต้องมี toast/snackbar ให้รกจอ แค่บอกว่า "คัดลอกแล้ว" ตรงจุดที่กด
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* คัดลอกไม่ได้ (เบราว์เซอร์ปฏิเสธสิทธิ์) — ผู้ใช้ยังลากคลุมคัดลอกเองได้ตามปกติ */
    }
  };

  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.15 }}>
      <Tooltip title={`โทรหา ${raw}`}>
        <Box
          component="a"
          href={`tel:${dial}`}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          sx={{
            display: "inline-flex", alignItems: "center", gap: 0.35,
            fontSize: size, fontWeight: 600, color: "#0ea5e9",
            textDecoration: "none", whiteSpace: "nowrap",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          {showIcon && <PhoneIphone sx={{ fontSize: "1em" }} />}
          {raw}
        </Box>
      </Tooltip>
      {showCopy && (
        <Tooltip title={copied ? "คัดลอกแล้ว" : "คัดลอกเบอร์"}>
          <IconButton
            size="small"
            onClick={handleCopy}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label="คัดลอกเบอร์โทร"
            sx={{
              p: 0.2, color: copied ? "#16a34a" : "text.disabled",
              "&:hover": { color: copied ? "#16a34a" : "#0ea5e9", bgcolor: "transparent" },
            }}
          >
            {copied ? <Check sx={{ fontSize: 13 }} /> : <ContentCopy sx={{ fontSize: 13 }} />}
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

export default TelLink;
