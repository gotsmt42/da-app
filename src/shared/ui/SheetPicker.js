/**
 * SheetPicker — แผ่นเลือกรายการ (React) หน้าตาเดียวกับแผ่นเลือกของฟอร์มลงงาน/แก้ไขงาน
 *
 * ✅ (13 พ.ย. 2569 ผู้ใช้: "Select งานยังเป็นแบบเดิมอยู่เลย") ใช้กับช่องที่ต้องค้นหาจาก server / เลือกได้หลายรายการ
 *    (เช่น ผูกงานในใบเบิก) ซึ่งแผ่นเลือกแบบ HTML (sheetPicker.js) ทำไม่ได้
 *    มือถือ = แผ่นเลื่อนขึ้นจากล่าง สูง 82% · คอม = หน้าต่างกลางจอ · ช่องค้นหาติดบนสุด · รายการเลื่อนได้ · ปุ่ม "เสร็จ" ท้ายแผ่น
 *
 * ใช้คู่กับ:
 *   <PickerField> — ช่องในฟอร์ม (ป้ายด้านบน · ช่องขาวขอบเทา) แตะแล้วเปิดแผ่น
 *   <SheetPickerRow> — แถวในแผ่น (วงกลม/ช่องติ๊กด้านขวา)
 */
import { Box, ButtonBase, CircularProgress, Dialog, Drawer, IconButton, InputBase, Stack, Typography, useMediaQuery } from "@mui/material";
import { CheckRounded, CloseRounded, ExpandMoreRounded, SearchRounded } from "@mui/icons-material";

const ACCENT = "#2563eb";

export function SheetPicker({ open, onClose, title, subtitle, query, onQuery, placeholder = "ค้นหา", loading, emptyText = "ไม่พบรายการ", count, children, doneLabel = "เสร็จ" }) {
  const mobile = useMediaQuery("(max-width:600px)");
  const body = (
    <Stack sx={{ height: "100%", minHeight: 0 }}>
      {mobile && <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: "#cbd5e1", mx: "auto", mt: 1 }} />}
      <Stack direction="row" alignItems="flex-start" gap={1} sx={{ px: 2, pt: mobile ? 1.25 : 2, pb: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: "1.05rem", color: "#0f172a", lineHeight: 1.3 }}>{title}</Typography>
          {subtitle && <Typography sx={{ fontSize: "0.76rem", color: "#64748b", mt: 0.25 }}>{subtitle}</Typography>}
        </Box>
        <IconButton onClick={onClose} aria-label="ปิด" sx={{ bgcolor: "#f1f5f9", width: 38, height: 38 }}><CloseRounded /></IconButton>
      </Stack>
      {onQuery && (
        <Stack direction="row" alignItems="center" gap={1} sx={{ mx: 2, mb: 1.25, px: 1.5, height: 44, borderRadius: "12px", border: "1px solid #e2e8f0", bgcolor: "#f8fafc" }}>
          <SearchRounded sx={{ fontSize: 20, color: "#94a3b8" }} />
          <InputBase value={query} onChange={(e) => onQuery(e.target.value)} placeholder={placeholder} autoFocus={!mobile}
            inputProps={{ type: "search", autoComplete: "off" }} sx={{ flex: 1, fontSize: "0.92rem", fontFamily: "inherit" }} />
          {loading && <CircularProgress size={16} />}
        </Stack>
      )}
      <Box data-no-swipe sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 2, pb: 1.5, WebkitOverflowScrolling: "touch" }}>
        {count === 0
          ? <Typography sx={{ textAlign: "center", color: "#94a3b8", fontSize: "0.86rem", py: 4 }}>{loading ? "กำลังค้นหา…" : emptyText}</Typography>
          : <Box sx={{ border: "1px solid #e6e9ef", borderRadius: "14px", overflow: "hidden", "& > * + *": { borderTop: "1px solid #eef2f7" } }}>{children}</Box>}
      </Box>
      <Box sx={{ px: 2, py: 1.25, borderTop: "1px solid #e6e9ef", bgcolor: "#fff" }}>
        <ButtonBase onClick={onClose} sx={{ width: "100%", height: 46, borderRadius: "12px", bgcolor: ACCENT, color: "#fff", fontWeight: 800, fontSize: "0.95rem", fontFamily: "inherit" }}>
          {doneLabel}
        </ButtonBase>
      </Box>
    </Stack>
  );
  if (mobile) {
    return (
      // 🐛 (13 พ.ย. 2569 ผู้ใช้: "กดผูกงาน แผ่นไปขึ้นข้างหลัง") Drawer ของ MUI ใช้ชั้น 1200 ต่ำกว่าหน้าต่าง (Dialog 1300) → ดันขึ้นเหนือหน้าต่างเสมอ
      <Drawer anchor="bottom" open={open} onClose={onClose} sx={{ zIndex: 1400 }}
        PaperProps={{ sx: { height: "82vh", borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: "hidden" } }}>
        {body}
      </Drawer>
    );
  }
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" sx={{ zIndex: 1400 }} PaperProps={{ sx: { height: "78vh", borderRadius: 3, overflow: "hidden" } }}>
      {body}
    </Dialog>
  );
}

/** แถวในแผ่นเลือก — multi = ช่องติ๊กสี่เหลี่ยม · ไม่ใช่ = วงกลม */
export function SheetPickerRow({ selected, disabled, multi = false, onClick, children }) {
  return (
    <ButtonBase onClick={onClick} disabled={disabled}
      sx={{ width: "100%", display: "flex", alignItems: "center", gap: 1.25, px: 1.5, py: 1.15, textAlign: "left", fontFamily: "inherit",
        bgcolor: selected ? "rgba(37,99,235,.06)" : "#fff", opacity: disabled ? 0.55 : 1, "&:hover": { bgcolor: selected ? "rgba(37,99,235,.09)" : "#f8fafc" } }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
      <Box sx={{
        width: 22, height: 22, flexShrink: 0, borderRadius: multi ? "6px" : "50%", display: "grid", placeItems: "center",
        border: `2px solid ${selected ? ACCENT : "#cbd5e1"}`, bgcolor: selected ? ACCENT : "#fff", color: "#fff",
      }}>
        {selected && <CheckRounded sx={{ fontSize: 16 }} />}
      </Box>
    </ButtonBase>
  );
}

/** ช่องในฟอร์ม (หน้าตาเดียวกับ SheetSelectField) — children = ค่าที่เลือก (ไม่ส่ง = placeholder) */
export function PickerField({ label, required, placeholder = "— เลือก —", onClick, error, helperText, disabled, children, sx }) {
  return (
    <Box sx={{ minWidth: 0, ...sx }}>
      {label && (
        <Typography component="div" sx={{ fontSize: "0.8rem", fontWeight: 700, color: error ? "#d32f2f" : "#334155", mb: 0.5, lineHeight: 1.35 }}>
          {label}{required && <Box component="span" sx={{ color: "#ef4444" }}> *</Box>}
        </Typography>
      )}
      <ButtonBase component="div" role="button" tabIndex={disabled ? -1 : 0} onClick={disabled ? undefined : onClick} aria-haspopup="dialog"
        sx={{
          width: "100%", minHeight: 44, px: 1.5, py: 0.75, gap: 1, justifyContent: "space-between", textAlign: "left", fontFamily: "inherit",
          borderRadius: "10px", border: `1.5px solid ${error ? "#d32f2f" : "#cbd5e1"}`, bgcolor: disabled ? "#f8fafc" : "#fff",
          cursor: disabled ? "default" : "pointer", "&:hover": { borderColor: disabled ? "#cbd5e1" : error ? "#d32f2f" : "#94a3b8" },
        }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {children || <Typography noWrap sx={{ fontSize: "0.9rem", color: "#94a3b8" }}>{placeholder}</Typography>}
        </Box>
        {!disabled && <ExpandMoreRounded sx={{ color: "#64748b", flexShrink: 0 }} />}
      </ButtonBase>
      {helperText && <Typography sx={{ fontSize: "0.72rem", color: error ? "#d32f2f" : "#64748b", mt: 0.4, ml: 0.25, lineHeight: 1.4 }}>{helperText}</Typography>}
    </Box>
  );
}
