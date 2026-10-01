import { Children, Fragment, isValidElement, useRef, useState } from "react";
import { ListSubheader, MenuItem, TextField } from "@mui/material";
import { alpha } from "@mui/material/styles";

/**
 * ช่องเลือก (select) แบบเมนูสวยๆ ของ MUI — ใช้แทน <TextField select SelectProps={{ native: true }}>
 *
 * 🐛 ทำไมต้องมี: select แบบ native เปิดรายการของระบบปฏิบัติการ (Windows/มือถือ) ซึ่งหน้าตาไม่เข้ากับแอป
 *    ตัวอักษร/ระยะห่าง/สีไม่ตรงกับส่วนอื่นเลย ผู้ใช้บอกว่า "UI ของ Select ไม่สวย"
 * ✅ ใช้แทนได้ทันที: รับ props เหมือน TextField และรับลูกเป็น <option>/<optgroup> แบบเดิม — แปลงเป็น MenuItem ให้เอง
 *    จุดที่เรียกใช้ไม่ต้องเขียนรายการตัวเลือกใหม่
 * ⚠️ ค่าที่ได้จาก onChange เป็น "สตริง" เสมอเหมือน native (ค่าตัวเลข เช่น ปี จะเป็น "2026") — โค้ดเดิมที่เขียนไว้
 *    รองรับ native อยู่แล้วจึงทำงานเหมือนเดิมทุกอย่าง
 *
 * โหมดแก้ไขในตาราง (inline): ส่ง autoOpen + onMenuClose
 *    เมนูเปิดทันทีที่โผล่ · เลือกแล้ว onChange ทำงาน (จุดเรียกใช้บันทึกเอง) · ปิดเมนูโดยไม่ได้เลือก → onMenuClose
 *    ⚠️ ห้ามใช้ onBlur บันทึกในโหมดนี้ — เปิดเมนูแล้วช่องเสียโฟกัสทันที จะบันทึกค่าเดิมทิ้งก่อนได้เลือก
 */
const ACCENT = "#dc2626";

const toItems = (children) => {
  const out = [];
  const walk = (nodes) => {
    Children.forEach(nodes, (node) => {
      if (!isValidElement(node)) return;
      if (node.type === Fragment) { walk(node.props.children); return; }
      if (node.type === "optgroup") {
        out.push(<ListSubheader key={`g-${node.props.label}`} sx={{ lineHeight: "30px", fontSize: "0.72rem", fontWeight: 800, color: "#64748b" }}>{node.props.label}</ListSubheader>);
        walk(node.props.children);
        return;
      }
      if (node.type === "option") {
        const value = node.props.value === undefined ? "" : String(node.props.value);
        out.push(
          <MenuItem key={`o-${value}-${out.length}`} value={value} disabled={node.props.disabled}>
            {node.props.children}
          </MenuItem>,
        );
      }
    });
  };
  walk(children);
  return out;
};

export default function SelectField({ children, SelectProps = {}, InputLabelProps, autoOpen = false, onMenuClose, onChange, value, size = "small", sx, ...props }) {
  const [open, setOpen] = useState(Boolean(autoOpen));
  const pickedRef = useRef(false);
  // native ถูกทิ้งโดยตั้งใจ — คอมโพเนนต์นี้มีไว้เลิกใช้ native
  // eslint-disable-next-line no-unused-vars
  const { native, MenuProps, ...restSelect } = SelectProps;

  return (
    <TextField
      select
      size={size}
      value={value === undefined || value === null ? "" : String(value)}
      onChange={(e) => { pickedRef.current = true; onChange?.(e); }}
      InputLabelProps={{ shrink: true, ...InputLabelProps }}
      sx={{
        "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "background.paper", transition: "box-shadow .15s" },
        "& .MuiOutlinedInput-root.Mui-focused": { boxShadow: `0 0 0 3px ${alpha(ACCENT, 0.12)}` },
        "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: ACCENT, borderWidth: 1.5 },
        "& .MuiInputLabel-root.Mui-focused": { color: ACCENT },
        "& .MuiSelect-icon": { color: "#94a3b8" },
        ...sx,
      }}
      SelectProps={{
        ...restSelect,
        displayEmpty: true,
        open,
        onOpen: () => { pickedRef.current = false; setOpen(true); },
        onClose: () => {
          setOpen(false);
          if (!pickedRef.current) onMenuClose?.();
        },
        MenuProps: {
          ...MenuProps,
          PaperProps: {
            ...(MenuProps?.PaperProps || {}),
            sx: {
              mt: 0.5, borderRadius: 2.5, maxHeight: 360, minWidth: 180,
              border: "1px solid #e2e8f0", boxShadow: "0 12px 32px rgba(15,23,42,.14)",
              "& .MuiMenu-list": { py: 0.5 },
              "& .MuiMenuItem-root": {
                fontSize: "0.86rem", mx: 0.5, my: 0.15, borderRadius: 1.5, minHeight: 34, pr: 4, position: "relative",
                "&:hover, &.Mui-focusVisible": { bgcolor: "#f1f5f9" },
                "&.Mui-selected.Mui-focusVisible": { bgcolor: alpha(ACCENT, 0.11) },
                "&.Mui-selected": { bgcolor: alpha(ACCENT, 0.07), color: ACCENT, fontWeight: 700 },
                "&.Mui-selected:hover": { bgcolor: alpha(ACCENT, 0.11) },
                "&.Mui-selected::after": { content: '"✓"', position: "absolute", right: 12, fontWeight: 800 },
              },
              ...(MenuProps?.PaperProps?.sx || {}),
            },
          },
        },
      }}
      {...props}
    >
      {toItems(children)}
    </TextField>
  );
}

