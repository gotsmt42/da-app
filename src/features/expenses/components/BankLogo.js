/**
 * BankLogo — สัญลักษณ์ธนาคาร (สีประจำธนาคาร + ตัวย่อ)
 *
 * ✅ ผู้ใช้ขอ: "อยากให้แสดงโลโก้หรือสัญลักษณ์ของธนาคารนั้นๆ ด้วย ทำให้ดูง่าย สวยงาม และเด่น
 * เพราะบัญชีจะได้เข้าใจง่าย" — คนไทยจำธนาคารจาก "สี" ก่อนชื่อเสมอ (เขียว = กสิกร · ม่วง = ไทยพาณิชย์
 * · ฟ้า = กรุงไทย) ป้ายสีจึงทำให้กวาดตาหาบัญชีถูกใบได้เร็วกว่าการอ่านชื่อธนาคารทีละบรรทัด
 *
 * ✅ (6 ต.ค. 2569) ผู้ใช้ขอ "อยากได้ icon ธนาคารที่ใช้จริง" — ใช้โลโก้จริงจากแพ็กเกจ thai-banks-logo (ISC)
 *    เก็บไว้ในแอปเองที่ public/banks/<CODE>.png (200×200 วงกลม) ไม่โหลดจากเว็บอื่น — ออฟไลน์/ลิงก์ตายก็ยังขึ้น
 *    ⚠️ ชื่อไฟล์ = code ใน bankMeta.js · เพิ่มธนาคารใหม่ต้องวางไฟล์โลโก้ชื่อเดียวกันด้วย
 * ⚠️ ถ้าโหลดรูปไม่ได้ (ไม่มีไฟล์/รหัสแปลก) → กลับไปใช้ป้ายสีประจำธนาคาร + ตัวย่อแบบเดิมอัตโนมัติ
 */
import { useState } from "react";
import { Box } from "@mui/material";
import { bankMeta, bankLogoUrl } from "../bankMeta";

/**
 * @param {string} code  รหัสธนาคาร (ดู bankMeta.js)
 * @param {number} size  ความกว้าง/สูงเป็น px
 */
export default function BankLogo({ code, size = 34, sx }) {
  const bank = bankMeta(code);
  const url = bankLogoUrl(code);
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return (
      <Box
        component="img" src={url} alt={bank.short} loading="lazy" onError={() => setFailed(true)}
        sx={{
          width: size, height: size, flexShrink: 0, borderRadius: "50%", objectFit: "contain", bgcolor: "#fff",
          boxShadow: "0 1px 3px rgba(15,23,42,0.18)", userSelect: "none", ...sx,
        }}
      />
    );
  }
  // ตัวย่อยาวไม่เท่ากัน (K / ttb / CIMB) — ย่อขนาดอักษรตามความยาวให้เต็มป้ายพอดีทุกธนาคาร
  const chars = bank.mark.length;
  const fontSize = size * (chars <= 1 ? 0.5 : chars === 2 ? 0.4 : chars === 3 ? 0.32 : 0.26);
  return (
    <Box
      aria-hidden
      sx={{
        width: size, height: size, flexShrink: 0, borderRadius: size * 0.29,
        display: "flex", alignItems: "center", justifyContent: "center",
        bgcolor: bank.color,
        // สีอ่อน (กรุงศรี) ตัวขาวอ่านไม่ออก — ใช้ตัวเข้มแทน และมีขอบบางกันจมไปกับพื้นขาว
        color: bank.darkText ? "#1f2937" : "#ffffff",
        border: bank.darkText ? "1px solid rgba(15,23,42,0.12)" : "none",
        fontWeight: 900, fontSize, lineHeight: 1, letterSpacing: chars > 2 ? "-0.02em" : 0,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        boxShadow: "0 1px 3px rgba(15,23,42,0.18)",
        userSelect: "none",
        ...sx,
      }}
    >
      {bank.mark}
    </Box>
  );
}
