/**
 * MobileFilterSheet — ค้นหา/ตัวกรองบนมือถือแบบแผ่นเลื่อนจากล่าง (แบบเดียวกับหน้าใบเบิก Advance/เคลม)
 *
 * ✅ ผู้ใช้สั่ง (3 ต.ค. 2569): "ตัวกรองต่างๆ หน้ามือถือให้เอาไปซ่อนแบบหน้าอื่นๆ เช่นหน้า Advance ทำให้จอไม่รกและดูง่าย"
 *    มือถือ: ปุ่ม "ตัวกรอง" (มีตัวเลขจำนวนที่ใช้อยู่) → เปิดแผ่นล่าง · ตัวกรองที่ใช้อยู่แสดงเป็นชิปกดลบได้เหนือรายการ
 */
import { useState } from "react";
import { Box, Stack, Typography, Button, IconButton, Drawer, Chip, Badge, useMediaQuery } from "@mui/material";
import { Close, Tune } from "@mui/icons-material";
import { INK, INK_2, MUTED, LINE } from "./PageKit";

/** ปุ่มเปิดแผ่นตัวกรอง — ใส่ไว้ที่หัวเพจ/แถวเครื่องมือ */
export function FilterSheetButton({ count = 0, onClick, label = "ตัวกรอง" }) {
  return (
    <Badge badgeContent={count} color="primary" overlap="rectangular" invisible={!count}
      sx={{ "& .MuiBadge-badge": { fontWeight: 800, top: 4, right: 4 } }}>
      <Button onClick={onClick} startIcon={<Tune sx={{ fontSize: 18 }} />}
        sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, height: 40, px: 1.5, color: INK_2, border: `1px solid ${LINE}`, bgcolor: "#fff", whiteSpace: "nowrap" }}>
        {label}
      </Button>
    </Badge>
  );
}

/** ชิปตัวกรองที่ใช้อยู่ — items: [{ key, label, onDelete }] */
export function ActiveFilterChips({ items = [] }) {
  if (!items.length) return null;
  return (
    <Stack direction="row" spacing={0.75} useFlexGap sx={{ mb: 1.25, flexWrap: "wrap" }}>
      {items.map((it) => (
        <Chip key={it.key} size="small" label={it.label} onDelete={it.onDelete}
          sx={{ fontWeight: 700, maxWidth: "100%", bgcolor: "#fff", border: `1px solid ${LINE}` }} />
      ))}
    </Stack>
  );
}

export default function MobileFilterSheet({ open, onClose, onClear, activeCount = 0, resultLabel, title = "ค้นหาและตัวกรอง", children }) {
  return (
    <Drawer anchor="bottom" open={open} onClose={onClose}
      PaperProps={{ sx: { borderTopLeftRadius: 18, borderTopRightRadius: 18, px: 2, pt: 1, pb: "calc(16px + env(safe-area-inset-bottom))", maxHeight: "85vh" } }}>
      <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: "#cbd5e1", mx: "auto", mb: 1.25 }} />
      <Stack direction="row" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography sx={{ flex: 1, fontWeight: 800, fontSize: "1rem", color: INK }}>{title}</Typography>
        {activeCount > 0 && onClear && (
          <Button size="small" onClick={onClear} sx={{ textTransform: "none", fontWeight: 700, color: "#dc2626" }}>ล้างทั้งหมด</Button>
        )}
        <IconButton size="small" aria-label="ปิด" onClick={onClose}><Close /></IconButton>
      </Stack>
      <Stack spacing={1.5}>{children}</Stack>
      <Button fullWidth variant="contained" onClick={onClose}
        sx={{ mt: 2, py: 1.1, textTransform: "none", fontWeight: 800, borderRadius: 2.5, boxShadow: "none", bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8", boxShadow: "none" } }}>
        {resultLabel || "ดูผลลัพธ์"}
      </Button>
    </Drawer>
  );
}

/** หัวข้อย่อยในแผ่นตัวกรอง */
export const SheetLabel = ({ children }) => (
  <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: MUTED, mb: -0.75 }}>{children}</Typography>
);

/** ตัวเลือกแบบปุ่ม 2 คอลัมน์ (สถานะ/ชนิด) — options: [{ value, label, count }] */
export function SheetOptions({ options = [], value, onChange }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Button key={o.value} onClick={() => onChange(o.value)}
            sx={{
              justifyContent: "space-between", textTransform: "none", fontWeight: 700, borderRadius: 2, px: 1.5, py: 1, minWidth: 0,
              color: on ? "#1d4ed8" : INK_2, bgcolor: on ? "#eff6ff" : "#fff", border: `1px solid ${on ? "#bfdbfe" : LINE}`,
            }}>
            <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{o.label}</Box>
            {o.count != null && <Box component="span" sx={{ ml: 1, fontWeight: 900, color: on ? "#1d4ed8" : MUTED }}>{o.count}</Box>}
          </Button>
        );
      })}
    </Box>
  );
}

/** ช่องค้นหาในแผ่นตัวกรอง */
export function SheetSearch({ value, onChange, placeholder = "ค้นหา" }) {
  return (
    <Box component="label" sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, height: 44, borderRadius: 2.5, border: `1px solid ${LINE}`, bgcolor: "#f8fafc" }}>
      <Box component="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type="search"
        sx={{ flex: 1, minWidth: 0, border: 0, outline: 0, bgcolor: "transparent", font: "inherit", fontSize: "0.95rem", color: INK }} />
      {value && <IconButton size="small" aria-label="ล้างคำค้นหา" onClick={() => onChange("")}><Close sx={{ fontSize: 17 }} /></IconButton>}
    </Box>
  );
}

/**
 * FilterArea — ห่อ "ตัวเลขสรุป (KpiRow) + แถบค้นหา (FilterBar)" ของหน้าใดก็ได้
 *   จอใหญ่: แสดงตามเดิม · มือถือ: ย้ายทั้งก้อนเข้าแผ่นล่าง เหลือแถว [สรุปผล · ปุ่มตัวกรอง] + ชิปตัวกรองที่ใช้อยู่
 * ⚠️ ใช้ CSS ปรับ KpiRow/FilterBar ที่อยู่ในแผ่น (คลาส pk-*) — ไม่ต้องเขียนตัวกรองซ้ำ 2 ชุดในแต่ละหน้า
 */
export function FilterArea({ children, count = 0, chips = [], onClear, resultLabel, summary }) {
  const mobile = useMediaQuery("(max-width:600px)");
  const [open, setOpen] = useState(false);
  if (!mobile) return <>{children}</>;
  return (
    <>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
        <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.84rem", fontWeight: 700, color: MUTED }}>{summary}</Typography>
        <FilterSheetButton count={count} onClick={() => setOpen(true)} />
      </Stack>
      <ActiveFilterChips items={chips.filter(Boolean)} />
      <MobileFilterSheet open={open} onClose={() => setOpen(false)} onClear={onClear} activeCount={count} resultLabel={resultLabel}>
        <Box sx={{
          "& .pk-kpirow": { gridTemplateColumns: "1fr 1fr", gridAutoFlow: "row", gridAutoColumns: "auto", overflowX: "visible", mb: 1.5 },
          "& .pk-filterbar": { p: 0, border: 0, boxShadow: "none", mb: 0 },
          "& .pk-filterbar-extra": { flexDirection: "column", alignItems: "stretch", gap: 1, "& > *": { width: "100% !important", ml: "0 !important" } },
        }}>
          {children}
        </Box>
      </MobileFilterSheet>
    </>
  );
}
