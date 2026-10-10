/**
 * PersonSelectField — ช่องเลือก "ชื่อคน" แบบมีรูป/อักษรย่อ (ใช้แทน <select> ธรรมดาทุกจุดที่เลือกชื่อ)
 *
 * ✅ ผู้ใช้สั่ง (6 ต.ค. 2569): "การเลือกชื่อ ให้สวยและชัดเจนแบบนี้" — อ้างอิงเมนูเลือกช่างในหน้าตารางงาน
 *    (FloatPersonPicker): หัวเมนู · แถว "ทุกคน" ไอคอนกลุ่ม · แต่ละคนมีรูป/อักษรย่อสีประจำตัว · ✓ ที่คนที่เลือก
 * ✅ ตอนปิดหน้าตาเหมือนช่องกรอกอื่นในแถบตัวกรอง (ขอบมน · ป้ายลอย · สูง 40px) — วางคู่กับ SelectField ได้กลมกลืน
 *
 * @param label     ป้ายลอยบนช่อง ("" = ไม่มีป้าย — ใช้เมื่อมีหัวข้อกำกับอยู่แล้วด้านบน)
 * @param value     id ที่เลือก · allValue = ทุกคน
 * @param onChange  (id) => void
 * @param options   [{ id, name, avatar?, count?, note? }]  count = ตัวเลขชิปด้านขวา · note = บรรทัดเล็กใต้ชื่อ
 * @param allLabel / allCount / allValue / title / unit
 * @param allIcon   ไอคอนของแถว allValue (ค่าปริยาย = ไอคอนกลุ่ม · เช่นใช้ "ยังไม่ระบุ" แทน "ทุกคน")
 * @param disabled  ดูได้อย่างเดียว เปิดเมนูไม่ได้
 */
import { useState } from "react";
import { Avatar, Box, ButtonBase, Popover, Stack, Typography } from "@mui/material";
import { Check, Groups, ExpandMore, PersonOff } from "@mui/icons-material";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import { hasValidAvatar } from "@/shared/utils/user";

const BORDER = "#cbd5e1";

const PersonAvatar = ({ name, avatar, size = 30 }) => (
  <Avatar
    src={hasValidAvatar(avatar) ? avatar : undefined}
    sx={{ width: size, height: size, fontSize: size * 0.42, fontWeight: 800, bgcolor: personColor(name), flexShrink: 0 }}
  >
    {personInitial(name)}
  </Avatar>
);

export default function PersonSelectField({
  label = "ชื่อพนักงาน", value, onChange, options = [],
  allLabel = "ทุกคน", allCount, allValue = "all", title = "เลือกชื่อ", unit = "", allIcon: AllIcon = Groups, disabled = false, sx,
}) {
  const [anchor, setAnchor] = useState(null);
  const isAll = value === allValue || value == null || value === "";
  const current = isAll ? null : options.find((o) => o.id === value);
  const pick = (id) => { onChange(id); setAnchor(null); };

  const Row = ({ id, name, avatar, count, note, icon }) => {
    const on = id === (isAll ? allValue : value);
    return (
      <ButtonBase
        onClick={() => pick(id)} role="option" aria-selected={on}
        sx={{
          width: "100%", justifyContent: "flex-start", gap: 1.25, px: 1.25, py: 0.85, borderRadius: 2, fontFamily: "inherit",
          bgcolor: on ? "#eff6ff" : "transparent", "&:hover": { bgcolor: on ? "#eff6ff" : "#f8fafc" },
        }}
      >
        {icon || <PersonAvatar name={name} avatar={avatar} />}
        <Box sx={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <Typography noWrap sx={{ fontSize: "0.88rem", fontWeight: on ? 800 : 600, color: on ? "#1d4ed8" : "#0f172a", lineHeight: 1.35 }}>{name}</Typography>
          {note && <Typography noWrap sx={{ fontSize: "0.7rem", color: "#64748b", lineHeight: 1.3 }}>{note}</Typography>}
        </Box>
        {count != null && (
          <Box component="span" sx={{
            flexShrink: 0, fontSize: "0.72rem", fontWeight: 800, px: 0.85, py: 0.15, borderRadius: 99,
            bgcolor: on ? "#dbeafe" : "#f1f5f9", color: on ? "#1d4ed8" : "#475569", fontVariantNumeric: "tabular-nums",
          }}>
            {count}{unit ? ` ${unit}` : ""}
          </Box>
        )}
        <Box sx={{ width: 18, flexShrink: 0, display: "flex" }}>{on && <Check sx={{ fontSize: 18, color: "#2563eb" }} />}</Box>
      </ButtonBase>
    );
  };

  return (
    <>
      {/* ช่องตอนปิด — ขอบ/ป้ายลอยแบบเดียวกับ TextField outlined */}
      <ButtonBase
        onClick={(e) => setAnchor(e.currentTarget)} disabled={disabled}
        aria-haspopup="listbox" aria-expanded={Boolean(anchor)} aria-label={label || title}
        sx={{
          position: "relative", height: 40, minWidth: 0, px: 1.25, gap: 1, borderRadius: 2.5, fontFamily: "inherit",
          justifyContent: "flex-start", bgcolor: disabled ? "#f8fafc" : "#fff",
          border: "1px solid", borderColor: anchor ? "#2563eb" : BORDER,
          boxShadow: anchor ? "0 0 0 1px #2563eb" : "none",
          "&:hover": { borderColor: anchor ? "#2563eb" : "#94a3b8" },
          ...sx,
        }}
      >
        {label && <Typography component="span" sx={{
          position: "absolute", top: -9, left: 10, px: 0.5, bgcolor: "#fff", lineHeight: 1.3, borderRadius: 1,
          fontSize: "0.72rem", color: anchor ? "#2563eb" : "#64748b", fontWeight: 500, pointerEvents: "none",
        }}>
          {label}
        </Typography>}
        {current ? (
          <PersonAvatar name={current.name} avatar={current.avatar} size={24} />
        ) : (
          <Box sx={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#f1f5f9", color: "#475569", flexShrink: 0 }}>
            <AllIcon sx={{ fontSize: 15 }} />
          </Box>
        )}
        <Typography noWrap sx={{ flex: 1, minWidth: 0, textAlign: "left", fontSize: "0.92rem", fontWeight: current ? 700 : 500, color: "#0f172a" }}>
          {current ? current.name : allLabel}
        </Typography>
        {!disabled && <ExpandMore sx={{ fontSize: 20, color: "#64748b", flexShrink: 0, transform: anchor ? "rotate(180deg)" : "none", transition: "transform .15s" }} />}
      </ButtonBase>

      <Popover
        open={Boolean(anchor)} anchorEl={anchor} onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: {
          mt: 0.75, width: Math.max(280, anchor?.offsetWidth || 0), maxWidth: "calc(100vw - 24px)",
          borderRadius: 3, border: "1px solid #e2e8f0", boxShadow: "0 18px 40px rgba(15,23,42,.18)",
        } } }}
      >
        <Box sx={{ px: 1.75, pt: 1.25, pb: 0.5 }}>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: "#64748b", letterSpacing: ".02em" }}>{title}</Typography>
        </Box>
        <Stack spacing={0.25} role="listbox" sx={{ p: 0.75, pt: 0.25, maxHeight: 360, overflowY: "auto" }}>
          <Row
            id={allValue} name={allLabel} count={allCount}
            icon={(
              <Box sx={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#f1f5f9", color: "#475569", flexShrink: 0 }}>
                <AllIcon sx={{ fontSize: 18 }} />
              </Box>
            )}
          />
          {options.map((o) => (
            <Row
              key={o.id} {...o}
              icon={o.unassigned ? (
                <Box sx={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#fff7ed", color: "#d97706", flexShrink: 0 }}>
                  <PersonOff sx={{ fontSize: 17 }} />
                </Box>
              ) : undefined}
            />
          ))}
        </Stack>
      </Popover>
    </>
  );
}
