/**
 * SheetSelectField — ช่องเลือกสำหรับฟอร์ม React (MUI) ที่เปิด "แผ่นรายการ" ชุดเดียวกับฟอร์มลงงาน/แก้ไขงาน
 *
 * ✅ (13 พ.ย. 2569 ผู้ใช้: "หน้าฟอร์ม ux ui ยังเหมือนเดิม รวมถึงรูปแบบ Select การจัดวาง สีสัน ยังดูยาก")
 *    ฟอร์มที่เป็น React ใช้ตัวนี้แทน Autocomplete / TextField select → หน้าตาและการใช้งานเหมือนกันทั้งแอป:
 *    ป้ายชื่อด้านบน · ช่องขาวขอบเทา สูง 44 · แตะแล้วแผ่นรายการเลื่อนขึ้น (ค้นหาบนสุด · เรียง ก-ฮ · ปัดลงปิด)
 *
 * @param options      [{ value, label, sub?, icon?, person?, avatar? }]  sub = บรรทัดเล็กใต้ชื่อ · icon = HTML สั้น (เช่น โลโก้) แทนอักษรย่อ
 *                     person = รายชื่อคน → รูปโปรไฟล์จริง (avatar) · ไม่มีรูป = อักษรย่อบนสีประจำตัว (ชุดเดียวกับ PersonChip ทั้งแอป)
 * @param allowCreate  พิมพ์ค่าใหม่ที่ไม่มีในรายการได้ (onChange(value, true))
 * @param renderValue  (option, value) => ReactNode — แสดงค่าที่เลือกในช่อง
 * @param sort         false = คงลำดับเดิม (เช่น อัตราภาษี)
 * @param dense        ช่องเตี้ย (36) สำหรับวางในแถวรายการ
 * @param startIcon    ไอคอนหน้าค่าในช่อง
 */
import { useRef } from "react";
import { Avatar, Box, ButtonBase, Typography } from "@mui/material";
import { ExpandMoreRounded } from "@mui/icons-material";
import { openSheetPicker, SORTER } from "@/shared/utils/sheetPicker";
import { escapeHtml } from "@/shared/utils/escapeHtml";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import { hasValidAvatar } from "@/shared/utils/user";

/** วงกลมรูปคน (HTML) — รูปจริงทับอักษรย่อสีประจำตัว · รูปเสีย = เหลืออักษรย่อ */
const personHtml = (name, url) => {
  const letter = `<span style="flex-shrink:0;width:32px;height:32px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff;background:${personColor(name)}">${escapeHtml(personInitial(name))}</span>`;
  return hasValidAvatar(url)
    ? `<span style="position:relative;flex-shrink:0;width:32px;height:32px">${letter}<img src="${escapeHtml(url)}" alt="" onerror="this.remove()" style="position:absolute;inset:0;width:32px;height:32px;border-radius:50%;object-fit:cover"></span>`
    : letter;
};
const initialOf = (text) => escapeHtml((String(text).trim().replace(/^[^\p{L}\p{N}]+/u, "").replace(/^[เแโใไ]/, "") || String(text)).slice(0, 1).toUpperCase());

export default function SheetSelectField({
  label, value, options = [], onChange, placeholder = "— เลือก —", allowCreate = false, title, error, helperText,
  required, disabled, sort = true, renderValue, sx, dense = false, startIcon,
}) {
  const ref = useRef(null);
  const cur = options.find((o) => String(o.value) === String(value ?? ""));
  const has = value !== undefined && value !== null && String(value) !== "";

  const open = () => {
    if (disabled) return;
    const host = ref.current?.closest(".MuiDialog-paper") || document.body;
    const items = options.map((o) => {
      const text = String(o.label ?? o.value);
      return {
        value: String(o.value),
        label: text,
        search: `${o.value} ${text} ${o.sub || ""}`.toLowerCase(),
        html: `${o.icon || (o.person ? personHtml(text, o.avatar) : `<span class="tt-si-av" aria-hidden="true">${initialOf(text) || "•"}</span>`)}<span class="tt-si-txt"><span style="display:block;font-weight:700">${escapeHtml(text)}</span>${o.sub ? `<span style="display:block;font-size:12px;font-weight:500;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(o.sub)}</span>` : ""}</span>`,
      };
    });
    if (sort) items.sort((a, b) => SORTER.compare(a.label, b.label));
    openSheetPicker({
      host, title: title || String(label || "เลือก").replace(/\s*\*$/, ""), items, current: String(value ?? ""), allowCreate,
      onPick: (v, isNew) => onChange?.(isNew ? v : (options.find((o) => String(o.value) === v)?.value ?? v), Boolean(isNew)),
    });
    // นอกหน้าต่าง (ไม่มี Dialog) — แผ่นต้องลอยทับทั้งจอ
    if (host === document.body) {
      const ov = host.querySelector(":scope > .tt-sheet");
      if (ov) { ov.style.position = "fixed"; ov.style.zIndex = "1500"; }
    }
  };

  return (
    <Box sx={{ minWidth: 0, ...sx }}>
      {label && (
        <Typography component="div" sx={{ fontSize: "0.8rem", fontWeight: 700, color: error ? "#d32f2f" : "#334155", mb: 0.5, lineHeight: 1.35 }}>
          {label}{required && <Box component="span" sx={{ color: "#ef4444" }}> *</Box>}
        </Typography>
      )}
      <ButtonBase ref={ref} onClick={open} disabled={disabled} aria-haspopup="dialog"
        sx={{
          width: "100%", minHeight: dense ? 36 : 44, px: dense ? 1.1 : 1.5, gap: 1, justifyContent: "space-between", textAlign: "left", fontFamily: "inherit",
          borderRadius: "10px", border: `1.5px solid ${error ? "#d32f2f" : "#cbd5e1"}`, bgcolor: disabled ? "#f8fafc" : "#fff",
          transition: "border-color .15s", "&:hover": { borderColor: error ? "#d32f2f" : "#94a3b8" },
        }}>
        {startIcon}
        {has && cur?.person && (
          <Avatar src={hasValidAvatar(cur.avatar) ? cur.avatar : undefined}
            sx={{ width: dense ? 22 : 26, height: dense ? 22 : 26, fontSize: dense ? 11 : 12, fontWeight: 800, bgcolor: personColor(cur.label), flexShrink: 0 }}>
            {personInitial(cur.label)}
          </Avatar>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {has
            ? <Typography component="div" noWrap sx={{ fontSize: dense ? "0.84rem" : "0.92rem", fontWeight: 600, color: "#0f172a" }}>{renderValue ? renderValue(cur, value) : (cur?.label ?? value)}</Typography>
            : <Typography noWrap sx={{ fontSize: dense ? "0.82rem" : "0.9rem", color: "#94a3b8" }}>{placeholder}</Typography>}
        </Box>
        <ExpandMoreRounded sx={{ color: "#64748b", flexShrink: 0 }} />
      </ButtonBase>
      {helperText && <Typography sx={{ fontSize: "0.72rem", color: error ? "#d32f2f" : "#64748b", mt: 0.4, ml: 0.25, lineHeight: 1.4 }}>{helperText}</Typography>}
    </Box>
  );
}

/**
 * หน้าตาช่องกรอก MUI ในฟอร์มให้เหมือนฟอร์มลงงาน — ใส่ใน sx ของ DialogContent
 * ป้ายชื่ออยู่เหนือช่อง (ไม่ลอยทับขอบ) · ช่องขาวขอบเทา 1.5px มุมมน 10 · สูง 44 · โฟกัสขอบน้ำเงิน
 * ⚠️ มีผลกับ TextField แบบ outlined เท่านั้น (variant="standard" ในแถวรายการไม่โดน)
 */
export const FORM_FIELD_SX = {
  "& .MuiFormControl-root > .MuiInputLabel-root:not(.MuiInputLabel-standard)": {
    position: "static", transform: "none", maxWidth: "100%", mb: 0.5, fontSize: "0.8rem", fontWeight: 700, color: "#334155", lineHeight: 1.35, whiteSpace: "normal",
  },
  "& .MuiFormControl-root > .MuiInputLabel-root.Mui-error": { color: "#d32f2f" },
  "& .MuiOutlinedInput-root": { bgcolor: "#fff", borderRadius: "10px", minHeight: 44 },
  "& .MuiOutlinedInput-notchedOutline": { top: 0, borderWidth: "1.5px !important", borderColor: "#cbd5e1" },
  "& .MuiOutlinedInput-notchedOutline legend": { display: "none" },
  "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#94a3b8" },
  "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#2563eb" },
  "& .MuiOutlinedInput-root.Mui-error .MuiOutlinedInput-notchedOutline": { borderColor: "#d32f2f" },
  "& .MuiOutlinedInput-root .MuiInputBase-input::placeholder": { opacity: "0.55 !important" },
  "& .MuiFormHelperText-root": { mx: 0.25, fontSize: "0.72rem" },
};
