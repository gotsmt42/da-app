/**
 * modernUi — ชุดสไตล์ปุ่ม/การ์ดแบบใหม่ (10 ต.ค. 2569)
 *
 * ✅ ผู้ใช้: "ยังไม่สวย ดูยาก ปุ่มยังดูล้าสมัย การจัดวางให้ดูง่ายกว่านี้"
 *    ปุ่มเดิมเป็นปุ่ม MUI มาตรฐาน (สี่เหลี่ยมมุมมนน้อย สูงไม่เท่ากัน ขอบเส้น) ดูเก่า
 *    ✅ ปุ่มใหม่: สูงเท่ากัน 48–52px · มุมมน 14px · ตัวหนา · ปุ่มหลักมีเงาสีอ่อนให้ดูลอย
 *       ปุ่มรอง = "tonal" (พื้นสีอ่อน ไม่มีเส้นขอบ) · ปุ่มเงียบ = ghost
 *    ✅ การ์ด: ขาว มุมมน 16px · เส้นขอบจาง + เงาบางมาก — แบ่งกลุ่มข้อมูลชัดโดยไม่ต้องใช้สีพื้น
 * ใช้กับ <Button variant="contained" disableElevation sx={BTN.primary}> (ตัว sx ทับสไตล์เดิมของ MUI ให้หมด)
 */
const BLUE = "#2563eb";
const BLUE_DARK = "#1d4ed8";
const GREEN = "#16a34a";
const GREEN_DARK = "#15803d";

// ✅ (10 ต.ค. 2569 ผู้ใช้: "ปุ่มใหญ่เกินไป") ลดความสูง 48/52 → 42/46px · มุมมน 12px
const base = {
  minHeight: 42, px: 2.25, borderRadius: "12px", textTransform: "none", letterSpacing: 0,
  fontWeight: 800, fontSize: "0.92rem", gap: 0.25, whiteSpace: "nowrap",
  "& .MuiButton-startIcon": { mr: 0.75 },
  "& .MuiButton-startIcon > *:nth-of-type(1)": { fontSize: 19 },
  transition: "background-color .15s, box-shadow .15s, transform .08s",
  "&:active": { transform: "scale(0.985)" },
  "&.Mui-disabled": { bgcolor: "#eef2f6", color: "#94a3b8", boxShadow: "none", borderColor: "transparent" },
};

export const BTN = {
  /** ปุ่มหลัก — 1 ปุ่มต่อหนึ่งกลุ่ม */
  primary: {
    ...base, minHeight: 46, bgcolor: BLUE, color: "#fff",
    boxShadow: "0 6px 14px -8px rgba(37,99,235,.6)",
    "&:hover": { bgcolor: BLUE_DARK, boxShadow: "0 10px 22px -8px rgba(37,99,235,.7)" },
  },
  /** ยืนยันขั้นสุดท้าย (ขอปิดงาน) */
  success: {
    ...base, minHeight: 46, bgcolor: GREEN, color: "#fff",
    boxShadow: "0 6px 14px -8px rgba(22,163,74,.55)",
    "&:hover": { bgcolor: GREEN_DARK },
  },
  /** ปุ่มรอง — พื้นฟ้าอ่อน ตัวน้ำเงิน */
  tonal: { ...base, bgcolor: "#eff6ff", color: BLUE_DARK, boxShadow: "none", "&:hover": { bgcolor: "#dbeafe" } },
  /** ปุ่มเงียบ — ยกเลิก/ทางเลือกรอง */
  ghost: { ...base, bgcolor: "transparent", color: "#475569", boxShadow: "none", "&:hover": { bgcolor: "#f1f5f9" } },
  /**
   * ปุ่มเส้นขอบ (outline) — พื้นใส เส้นขอบ + ตัวหนังสือสีเดียวกัน (ผู้ใช้: "อยากให้สีใส แบบ outline")
   * ใช้ BTN.outline(สี) เช่น BTN.outline("#16a34a")
   */
  outline: (color = BLUE) => ({
    ...base, bgcolor: "transparent", color, border: `1.5px solid ${color}`, boxShadow: "none",
    "&:hover": { bgcolor: `${color}0f`, borderColor: color },
  }),
  /** ปุ่มเทาอ่อน — แนบไฟล์/เครื่องมือ */
  soft: { ...base, bgcolor: "#f1f5f9", color: "#0f172a", boxShadow: "none", "&:hover": { bgcolor: "#e2e8f0" } },
};

/** การ์ดขาวมาตรฐาน */
export const CARD = {
  bgcolor: "#fff", borderRadius: "16px", border: "1px solid #e8edf3",
  boxShadow: "0 1px 2px rgba(15,23,42,.04), 0 6px 16px -10px rgba(15,23,42,.10)",
};

/** หัวข้อย่อยในการ์ด (ตัวเล็ก หนา สีเทา) */
export const EYEBROW = { fontSize: "0.74rem", fontWeight: 800, color: "#64748b", letterSpacing: ".02em" };
