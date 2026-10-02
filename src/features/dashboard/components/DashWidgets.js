/**
 * DashWidgets — กล่องข้อมูลบนหน้าแรก (ใต้เมนูหลัก) ชุดเดียวกันทุกกล่อง
 *
 * ✅ ผู้ใช้สั่ง (2 ต.ค. 2569) "หน้าแรกทำ UI/จัดวางชุดนี้ให้สวยงาม มืออาชีพ + ใช้กฎที่บอก"
 *   เดิม: แต่ละกล่องหน้าตาคนละแบบ (กล่องส้ม · กล่องชมพู · ป้ายพื้นสี · ไอคอนอีโมจิ 🏢💻👷 · แถบไล่สีแดง)
 *   ตอนนี้: กล่องขาวขอบเทาแบบเดียวกันทุกกล่อง — หัวกล่อง (ชื่อ · จำนวน · "ดูทั้งหมด") → แถวรายการ
 *          (หัวข้อตัวหนา · รายละเอียดสีเทา · ค่าด้านขวาชิดขวา) · สีใช้แค่จุดเล็ก/ตัวเลขแดงเมื่อต้องจัดการจริง
 */
import { Link } from "react-router-dom";
import { Box, Stack, Typography, Skeleton, IconButton } from "@mui/material";
import { ChevronRight, ChevronLeft } from "@mui/icons-material";
import { INK, INK_2, MUTED, FAINT, LINE, SURFACE, DANGER, CARD_SHADOW } from "@/shared/ui/PageKit";

/** กล่องข้อมูล: หัว (ชื่อ + จำนวน + ลิงก์ดูทั้งหมด) + เนื้อหา */
export function Widget({ title, count, hint, to, toLabel = "ดูทั้งหมด", children, footer, sx }) {
  return (
    <Box sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, boxShadow: CARD_SHADOW, overflow: "hidden", mb: 2, ...sx }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1.4, borderBottom: `1px solid ${LINE}` }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="baseline" spacing={0.75}>
            <Typography noWrap sx={{ fontWeight: 800, fontSize: "0.95rem", color: INK }}>{title}</Typography>
            {count !== undefined && count !== null && (
              <Typography component="span" sx={{ fontSize: "0.78rem", fontWeight: 700, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{count}</Typography>
            )}
          </Stack>
          {hint && <Typography noWrap sx={{ fontSize: "0.72rem", color: FAINT }}>{hint}</Typography>}
        </Box>
        {to && (
          <Box component={Link} to={to} sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, fontSize: "0.78rem", fontWeight: 700, color: INK_2, textDecoration: "none", flexShrink: 0, "&:hover": { color: INK } }}>
            {toLabel}<ChevronRight sx={{ fontSize: 17 }} />
          </Box>
        )}
      </Stack>
      {children}
      {footer}
    </Box>
  );
}

/** แถวรายการ — ลิงก์ (to) หรือปุ่ม (onClick) · leading = จุด/อวาตาร์/ลำดับ · trailing = ค่าด้านขวา */
export function Row({ to, onClick, leading, title, sub, trailing, trailingSub, danger, chevron = true, dense }) {
  const inner = (
    <>
      {leading && <Box sx={{ flexShrink: 0, display: "flex" }}>{leading}</Box>}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontWeight: 800, fontSize: "0.88rem", color: INK, lineHeight: 1.35 }}>{title}</Typography>
        {sub && <Typography noWrap sx={{ fontSize: "0.76rem", color: MUTED, lineHeight: 1.35 }}>{sub}</Typography>}
      </Box>
      {(trailing || trailingSub) && (
        <Box sx={{ textAlign: "right", flexShrink: 0 }}>
          {trailing && <Typography sx={{ fontWeight: 800, fontSize: "0.82rem", color: danger ? DANGER : INK_2, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{trailing}</Typography>}
          {trailingSub && <Typography sx={{ fontSize: "0.7rem", color: FAINT, whiteSpace: "nowrap" }}>{trailingSub}</Typography>}
        </Box>
      )}
      {chevron && (to || onClick) && <ChevronRight sx={{ fontSize: 18, color: "#cbd5e1", flexShrink: 0 }} />}
    </>
  );
  const sx = {
    display: "flex", alignItems: "center", gap: 1.25, px: 2, py: dense ? 1 : 1.25, textDecoration: "none", color: "inherit",
    width: "100%", textAlign: "left", font: "inherit", bgcolor: "#fff",
    border: 0, borderTop: `1px solid ${LINE}`, "&:first-of-type": { borderTop: 0 },
    cursor: to || onClick ? "pointer" : "default", "&:hover": to || onClick ? { bgcolor: SURFACE } : {},
  };
  if (to) return <Box component={Link} to={to} sx={sx}>{inner}</Box>;
  if (onClick) return <Box component="button" type="button" onClick={onClick} sx={sx}>{inner}</Box>;
  return <Box sx={sx}>{inner}</Box>;
}

export const Dot = ({ color }) => <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color, mt: "1px" }} />;

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
