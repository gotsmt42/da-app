/**
 * PageKit — ชิ้นส่วนโครงหน้ามาตรฐานของแอป (หัวเพจ · ตัวเลขสรุป · แถบค้นหา · สถานะว่าง · ป้ายสถานะ)
 *
 * ✅ ผู้ใช้วางกฎการออกแบบ (2 ต.ค. 2569 "จำกฏนี้ไว้ด้วย"):
 *   1) สีไม่เยอะ  2) ตัวอักษรชัด  3) ช่องว่างพอดี  4) จัดแนวแม่น  5) component เหมือนกันทุกหน้า  6) กดแล้วเดาได้
 *   → หน้าที่ปรับใหม่ใช้ชิ้นส่วนจากไฟล์นี้ แทนการเขียนกล่อง/การ์ดเองทีละหน้า (ซึ่งเป็นต้นเหตุที่แต่ละหน้าหน้าตาไม่เหมือนกัน)
 *   โครงเดียวกับหน้าใบเบิก / ใบขอซื้อ / ติดตามใบเสนอราคา: หัวเพจกล่องขาว → ตัวเลขสรุป → แถบค้นหา → รายการ
 * ⚠️ สีหลักเป็นเทา-น้ำเงินเข้ม (slate) · สีอื่นใช้แค่ "จุด" เล็กๆ หรือเมื่อเป็นเรื่องที่ต้องจัดการด่วน (แดง)
 */
import { Box, Stack, Typography, TextField, InputAdornment, IconButton } from "@mui/material";
import { Search, Close } from "@mui/icons-material";

export const INK = "#0f172a";
export const INK_2 = "#334155";
export const MUTED = "#64748b";
export const FAINT = "#94a3b8";
export const LINE = "#e2e8f0";
export const SURFACE = "#f8fafc";
export const DANGER = "#dc2626";
export const CARD_SHADOW = "0 1px 2px rgba(15,23,42,.04)";
/**
 * ✅ สีหลักของการกระทำ (ผู้ใช้สั่ง 3 ต.ค. 2569: "ปุ่ม/ธีมไม่อยากให้เป็นสีดำ ดูอึมครึม ใช้ตามสถานะได้แต่ไม่มากไป")
 *    ปุ่มหลัก/รายการที่เลือก = น้ำเงิน · สำเร็จ = เขียว · อันตราย = แดง · ที่เหลือเป็นเทาอ่อน
 */
export const ACCENT = "#2563eb";
export const ACCENT_DARK = "#1d4ed8";
export const ACCENT_SOFT = "#eff6ff";
export const ACCENT_LINE = "#bfdbfe";
export const SUCCESS = "#16a34a";
/** รายการที่ถูกเลือก (แบ่งหน้า/ตัวสลับ/ชิป) — พื้นฟ้าอ่อน ตัวน้ำเงิน ไม่ใช่พื้นทึบ */
export const SELECTED_SX = { bgcolor: `${ACCENT_SOFT} !important`, color: `${ACCENT_DARK} !important`, borderColor: `${ACCENT_LINE} !important` };

/** หัวเพจ: ไอคอนกล่องฟ้าอ่อน · ชื่อ · คำอธิบาย · (ด้านขวา) ปุ่ม/ตัวเลข */
export function PageHeader({ icon, title, subtitle, actions }) {
  return (
    <Box sx={{ borderRadius: 3, border: `1px solid ${LINE}`, bgcolor: "#fff", px: { xs: 1.5, sm: 2 }, py: { xs: 1.25, sm: 1.5 }, mb: 1.5, boxShadow: CARD_SHADOW }}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2.5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: ACCENT_SOFT, color: ACCENT, "& svg": { fontSize: 22 } }}>
          {icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontWeight: 900, fontSize: { xs: "1.1rem", sm: "1.25rem" }, color: INK, lineHeight: 1.25 }}>{title}</Typography>
          {subtitle && <Typography noWrap sx={{ fontSize: "0.76rem", color: MUTED }}>{subtitle}</Typography>}
        </Box>
        {actions && <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>{actions}</Stack>}
      </Stack>
    </Box>
  );
}

/** กล่องตัวเลขสรุป — ตัวเลขสีเข้มเสมอ ยกเว้น alert (แดง) · กดได้ถ้ามี onClick */
export function Kpi({ label, value, sub, alert, onClick, active }) {
  return (
    <Box component={onClick ? "button" : "div"} type={onClick ? "button" : undefined} onClick={onClick} sx={{
      textAlign: "left", font: "inherit", cursor: onClick ? "pointer" : "default", minWidth: 0, width: "100%",
      p: { xs: 1.25, sm: 1.5 }, borderRadius: 2.5,
      // ✅ ช่องที่เลือกอยู่ = ขอบ/เส้นล่างน้ำเงิน (ผู้ใช้ไม่เอาพื้นเข้ม/ดำ)
      border: `1px solid ${active ? ACCENT_LINE : LINE}`, bgcolor: active ? ACCENT_SOFT : "#fff", boxShadow: active ? `inset 0 -3px 0 ${ACCENT}` : CARD_SHADOW,
      transition: "border-color .15s", "&:hover": onClick ? { borderColor: FAINT } : {},
    }}>
      <Typography noWrap sx={{ fontSize: "0.74rem", color: MUTED, fontWeight: 700 }}>{label}</Typography>
      <Typography noWrap sx={{ fontWeight: 900, fontSize: { xs: "1.1rem", sm: "1.3rem" }, color: alert ? DANGER : INK, lineHeight: 1.3, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
      {sub && <Typography noWrap sx={{ fontSize: "0.7rem", color: MUTED }}>{sub}</Typography>}
    </Box>
  );
}

/** แถวตัวเลขสรุป — จอใหญ่เป็นตาราง n ช่อง · มือถือแถวเดียวเลื่อนแนวนอน (ไม่กินจอก่อนถึงรายการ) */
export function KpiRow({ children, columns = 4 }) {
  // แท็บเล็ต: ตารางไม่เลื่อน (4 ช่องต่อแถว หรือ 3 ช่องถ้ามีมากกว่า 4) — ต้องเห็นครบโดยไม่ต้องปัด
  const tablet = columns <= 4 ? columns : 3;
  return (
    <Box sx={{
      display: "grid", gap: 1, mb: 1.5,
      gridTemplateColumns: { xs: "none", sm: `repeat(${tablet}, minmax(0, 1fr))`, md: `repeat(${columns}, minmax(0, 1fr))` },
      gridAutoFlow: { xs: "column", sm: "row" }, gridAutoColumns: { xs: "44%", sm: "auto" },
      overflowX: { xs: "auto", sm: "visible" }, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" },
    }}>
      {children}
    </Box>
  );
}

/** แถบค้นหา/ตัวกรอง กล่องขาว — ช่องค้นหาซ้าย ตัวกรองขวา */
export function FilterBar({ search, onSearch, placeholder = "ค้นหา", children }) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}
      sx={{ mb: 1.5, p: 1, bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, boxShadow: CARD_SHADOW }}>
      <TextField size="small" placeholder={placeholder} value={search} onChange={(e) => onSearch(e.target.value)}
        sx={{ flex: 1, minWidth: 0, "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: SURFACE, height: 40, "& fieldset": { borderColor: "transparent" }, "&:hover fieldset": { borderColor: LINE }, "&.Mui-focused": { bgcolor: "#fff" } } }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 19, color: MUTED }} /></InputAdornment>,
          endAdornment: search ? <InputAdornment position="end"><IconButton size="small" aria-label="ล้างคำค้นหา" onClick={() => onSearch("")}><Close sx={{ fontSize: 17 }} /></IconButton></InputAdornment> : null,
        }} />
      {children && <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>{children}</Stack>}
    </Stack>
  );
}

/** กล่องรายการสีขาว (ใส่ตาราง/รายการการ์ด) */
export function Panel({ children, sx }) {
  return <Box sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, overflow: "hidden", boxShadow: CARD_SHADOW, ...sx }}>{children}</Box>;
}

export function EmptyState({ icon, title, hint, action }) {
  return (
    <Stack alignItems="center" spacing={1} sx={{ py: 6, px: 2, bgcolor: "#fff", border: `1px dashed ${LINE}`, borderRadius: 3, textAlign: "center" }}>
      <Box sx={{ color: "#cbd5e1", "& svg": { fontSize: 44 } }}>{icon}</Box>
      <Typography sx={{ fontWeight: 700, color: MUTED }}>{title}</Typography>
      {hint && <Typography sx={{ fontSize: "0.8rem", color: FAINT }}>{hint}</Typography>}
      {action}
    </Stack>
  );
}

/** ป้ายแบบเรียบ: พื้นเทาอ่อน + จุดสี (สีอยู่ที่จุดเท่านั้น) */
export function DotLabel({ color = FAINT, children, strong }) {
  return (
    <Box component="span" sx={{
      display: "inline-flex", alignItems: "center", gap: 0.6, height: 22, px: 1, borderRadius: 999, maxWidth: "100%",
      bgcolor: SURFACE, border: `1px solid ${LINE}`, color: strong ? color : INK_2, fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap",
    }}>
      <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />
      <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>{children}</Box>
    </Box>
  );
}

/** หัวตารางมาตรฐาน */
export const TABLE_HEAD_SX = { "& th": { fontWeight: 800, color: MUTED, fontSize: "0.74rem", bgcolor: SURFACE, whiteSpace: "nowrap", borderColor: LINE } };
export const TABLE_ROW_SX = { "& td": { py: 1.1, borderColor: LINE }, "&:last-child td": { borderBottom: 0 } };

/** ปุ่มหลักของหน้า (น้ำเงิน) */
export const PRIMARY_BTN_SX = { textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: ACCENT, color: "#fff", whiteSpace: "nowrap", "&:hover": { bgcolor: ACCENT_DARK, boxShadow: "none" } };
/** ปุ่มยืนยันที่ "สำเร็จ/ออกจริง" (เขียว) */
export const SUCCESS_BTN_SX = { ...PRIMARY_BTN_SX, bgcolor: SUCCESS, "&:hover": { bgcolor: "#15803d", boxShadow: "none" } };
/** ปุ่มไอคอนกรอบ (รีเฟรช ฯลฯ) */
export const ICON_BTN_SX = { width: 40, height: 40, border: `1px solid ${LINE}`, borderRadius: 2, color: INK_2, bgcolor: "#fff" };
