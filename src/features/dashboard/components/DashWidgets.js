/**
 * DashWidgets — กล่องข้อมูลบนหน้าแรก (ใต้เมนูหลัก) ชุดเดียวกันทุกกล่อง
 *
 * ✅ ผู้ใช้สั่ง (2 ต.ค. 2569) "หน้าแรกทำ UI/จัดวางชุดนี้ให้สวยงาม มืออาชีพ + ใช้กฎที่บอก"
 *   กล่องขาวขอบเทาแบบเดียวกันทุกกล่อง — หัวกล่อง (ชื่อ · จำนวน · "ดูทั้งหมด") → แถวรายการ
 * ✅ (9 ต.ค. 2569 ผู้ใช้: "แสดงโล้นๆ เกินไป ไม่ดึงดูด ดูข้อมูลได้ยาก") เพิ่มจุดยึดสายตาโดยไม่รก
 *   - หัวกล่องมีไอคอนในช่องพื้นอ่อน (สีประจำกล่อง) + จำนวนเป็นป้ายกลม
 *   - แถบสรุปใต้หัวกล่อง (summary) เป็นป้ายเล็กสีอ่อน เช่น "เลยกำหนด 2 · เดือนหน้า 6"
 *   - ค่าด้านขวาเป็นป้ายพื้นอ่อน (Pill) แทนตัวหนังสือลอยๆ · วันที่เป็นช่องปฏิทินเล็ก (DateTile)
 */
import { Link } from "react-router-dom";
import { Box, Stack, Typography, Skeleton, IconButton } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ChevronRight, ChevronLeft } from "@mui/icons-material";
import { INK, INK_2, MUTED, FAINT, LINE, SURFACE, CARD_SHADOW, ACCENT } from "@/shared/ui/PageKit";

/** ป้ายพื้นอ่อน — ใช้แสดงสถานะ/ค่าด้านขวาของแถว */
export function Pill({ color = MUTED, solid, icon, children, sx }) {
  return (
    <Box component="span" sx={{
      display: "inline-flex", alignItems: "center", gap: 0.4, height: 24, px: 1, borderRadius: 99,
      fontSize: "0.72rem", fontWeight: 800, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums",
      color: solid ? "#fff" : color, bgcolor: solid ? color : alpha(color, 0.1),
      ...sx,
    }}>
      {icon}{children}
    </Box>
  );
}

/** ช่องปฏิทินเล็ก — วันที่ตัวใหญ่ + เดือนตัวเล็ก (หรือข้อความสั้น เช่น เวลา) */
export function DateTile({ top, bottom, color = INK_2, strong }) {
  return (
    <Box sx={{
      width: 46, minHeight: 44, borderRadius: 2, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      bgcolor: strong ? alpha(color, 0.1) : SURFACE, border: `1px solid ${strong ? alpha(color, 0.25) : LINE}`,
    }}>
      <Typography sx={{ fontSize: String(top).length > 5 ? "0.74rem" : "0.92rem", fontWeight: 900, color: strong ? color : INK, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{top}</Typography>
      {bottom && <Typography sx={{ fontSize: "0.62rem", fontWeight: 700, color: strong ? color : MUTED, lineHeight: 1.2 }}>{bottom}</Typography>}
    </Box>
  );
}

/** ช่องไอคอนพื้นอ่อน (หัวกล่อง / หน้าแถว) */
export function IconTile({ icon: Icon, color = ACCENT, size = 32 }) {
  if (!Icon) return null;
  return (
    <Box sx={{ width: size, height: size, borderRadius: 2, flexShrink: 0, display: "grid", placeItems: "center", bgcolor: alpha(color, 0.1), color }}>
      <Icon sx={{ fontSize: size * 0.56 }} />
    </Box>
  );
}

/** กล่องข้อมูล: หัว (ไอคอน + ชื่อ + จำนวน + ลิงก์ดูทั้งหมด) + แถบสรุป + เนื้อหา */
export function Widget({ title, count, hint, icon, tone = ACCENT, summary, to, toLabel = "ดูทั้งหมด", children, footer, sx }) {
  return (
    <Box sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, boxShadow: CARD_SHADOW, overflow: "hidden", mb: 2, breakInside: "avoid", ...sx }}>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 2, py: 1.4, borderBottom: `1px solid ${LINE}` }}>
        <IconTile icon={icon} color={tone} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <Typography noWrap sx={{ fontWeight: 800, fontSize: "0.95rem", color: INK }}>{title}</Typography>
            {count !== undefined && count !== null && count !== "" && (
              <Box component="span" sx={{ px: 0.8, height: 20, display: "inline-flex", alignItems: "center", borderRadius: 99, fontSize: "0.72rem", fontWeight: 800, color: tone, bgcolor: alpha(tone, 0.1), fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{count}</Box>
            )}
          </Stack>
          {hint && <Typography noWrap sx={{ fontSize: "0.72rem", color: FAINT }}>{hint}</Typography>}
        </Box>
        {to && (
          <Box component={Link} to={to} sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, fontSize: "0.78rem", fontWeight: 700, color: ACCENT, textDecoration: "none", flexShrink: 0, "&:hover": { color: "#1d4ed8" } }}>
            {toLabel}<ChevronRight sx={{ fontSize: 17 }} />
          </Box>
        )}
      </Stack>
      {summary && (
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ px: 2, py: 1, bgcolor: SURFACE, borderBottom: `1px solid ${LINE}` }}>
          {summary}
        </Stack>
      )}
      {children}
      {footer}
    </Box>
  );
}

/** แถวรายการ — ลิงก์ (to) หรือปุ่ม (onClick) · leading = จุด/อวาตาร์/ช่องวันที่ · trailing = ค่าด้านขวา */
export function Row({ to, onClick, leading, title, sub, trailing, trailingSub, danger, chevron = true, dense }) {
  const inner = (
    <>
      {leading && <Box sx={{ flexShrink: 0, display: "flex" }}>{leading}</Box>}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontWeight: 800, fontSize: "0.88rem", color: INK, lineHeight: 1.35 }}>{title}</Typography>
        {sub && <Typography noWrap component="div" sx={{ fontSize: "0.76rem", color: MUTED, lineHeight: 1.35 }}>{sub}</Typography>}
      </Box>
      {(trailing || trailingSub) && (
        <Box sx={{ textAlign: "right", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          {trailing && <Typography component="div" sx={{ fontWeight: 800, fontSize: "0.82rem", color: danger ? "#dc2626" : INK_2, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{trailing}</Typography>}
          {trailingSub && <Typography sx={{ fontSize: "0.7rem", color: FAINT, whiteSpace: "nowrap", mt: 0.25 }}>{trailingSub}</Typography>}
        </Box>
      )}
      {chevron && (to || onClick) && <ChevronRight sx={{ fontSize: 18, color: "#cbd5e1", flexShrink: 0 }} />}
    </>
  );
  const sx = {
    display: "flex", alignItems: "center", gap: 1.25, px: 2, py: dense ? 1 : 1.2, textDecoration: "none", color: "inherit",
    width: "100%", textAlign: "left", font: "inherit", bgcolor: "#fff",
    border: 0, borderTop: `1px solid ${LINE}`, "&:first-of-type": { borderTop: 0 },
    cursor: to || onClick ? "pointer" : "default", transition: "background-color .12s",
    "&:hover": to || onClick ? { bgcolor: alpha(ACCENT, 0.035) } : {},
  };
  if (to) return <Box component={Link} to={to} sx={sx}>{inner}</Box>;
  if (onClick) return <Box component="button" type="button" onClick={onClick} sx={sx}>{inner}</Box>;
  return <Box sx={sx}>{inner}</Box>;
}

export const Dot = ({ color }) => <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />;

export function Empty({ text }) {
  return <Typography sx={{ px: 2, py: 2.5, fontSize: "0.82rem", color: FAINT, textAlign: "center" }}>{text}</Typography>;
}

export function Loading({ rows = 3 }) {
  return (
    <Stack spacing={1} sx={{ p: 2 }}>
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} variant="rounded" height={34} sx={{ borderRadius: 1.5 }} />)}
    </Stack>
  );
}

/** แบ่งหน้าเล็กท้ายกล่อง */
export function Pager({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return (
    <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} sx={{ py: 1, borderTop: `1px solid ${LINE}` }}>
      <IconButton size="small" aria-label="หน้าก่อนหน้า" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft sx={{ fontSize: 18 }} /></IconButton>
      <Typography sx={{ fontSize: "0.76rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>หน้า {page} / {pages}</Typography>
      <IconButton size="small" aria-label="หน้าถัดไป" disabled={page >= pages} onClick={() => onChange(page + 1)}><ChevronRight sx={{ fontSize: 18 }} /></IconButton>
    </Stack>
  );
}

/** หัวข้อกลุ่มเล็ก (ใช้แยกช่วงในหน้า) */
export const GroupTitle = ({ children }) => (
  <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: MUTED, mb: 1, mt: 0.5 }}>{children}</Typography>
);
