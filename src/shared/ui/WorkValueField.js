/**
 * ✅ (2 พ.ย. 2569 ผู้ใช้: "ให้ใส่แยกได้ด้วยสิ") ช่อง "มูลค่างานครั้งนี้" ใส่/แก้ได้ทุกเมื่อ ไม่ต้องรอขอปิดงาน
 *    ใช้ทั้งหน้างานของช่าง และการ์ดงานในหน้าการดำเนินงาน (แอดมินเติมงานเก่าย้อนหลัง/แก้ค่าที่ใส่ผิด)
 *    onSave(number | null) — null = ล้างค่า
 */
import React, { useState } from "react";
import { Box, Button, IconButton, Stack, TextField, Typography, InputAdornment } from "@mui/material";
import { EditRounded as Edit, PaymentsRounded as Payments } from "@mui/icons-material";

const parseBaht = (v) => {
  const t = String(v ?? "").replace(/[,\s฿]/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};
const fmt = (n) => Number(n).toLocaleString("th-TH", { maximumFractionDigits: 2 });

export default function WorkValueField({ value, onSave, disabled = false, compact = false }) {
  const has = value !== null && value !== undefined && value !== "";
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const parsed = parseBaht(text);
  const invalid = Number.isNaN(parsed);

  const start = () => { setText(has ? fmt(value) : ""); setEditing(true); };
  const save = async () => {
    if (invalid) return;
    setSaving(true);
    try { await onSave?.(parsed); setEditing(false); } finally { setSaving(false); }
  };

  if (editing) {
    return (
      <Stack direction="row" gap={0.75} alignItems="flex-start" sx={{ width: "100%" }} onClick={(e) => e.stopPropagation()}>
        <TextField
          size="small" autoFocus value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          placeholder="เช่น 15,000 (ไม่คิดเงินใส่ 0)" error={invalid}
          helperText={invalid ? "ใส่เป็นตัวเลข 0 ขึ้นไป" : undefined}
          inputProps={{ inputMode: "decimal", autoComplete: "off" }}
          InputProps={{ endAdornment: <InputAdornment position="end">บาท</InputAdornment> }}
          sx={{ flex: 1, minWidth: 140, "& .MuiOutlinedInput-root": { borderRadius: 2, fontSize: "0.86rem", bgcolor: "#fff" } }}
        />
        <Button size="small" variant="contained" disableElevation disabled={invalid || saving} onClick={save}
          sx={{ height: 40, borderRadius: 2, textTransform: "none", fontWeight: 800, minWidth: 0, px: 1.5 }}>
          {saving ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
        <Button size="small" onClick={() => setEditing(false)} sx={{ height: 40, textTransform: "none", minWidth: 0, color: "#64748b" }}>ยกเลิก</Button>
      </Stack>
    );
  }

  if (compact) {
    return (
      <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
        {has
          ? <Typography component="span" sx={{ fontSize: "0.86rem", fontWeight: 800, color: "#0f172a" }}>฿{fmt(value)}</Typography>
          : <Typography component="span" sx={{ fontSize: "0.8rem", fontWeight: 700, color: "#d97706" }}>ยังไม่ใส่</Typography>}
        {!disabled && (
          <IconButton size="small" onClick={start} title={has ? "แก้มูลค่างาน" : "ใส่มูลค่างาน"} sx={{ p: 0.4, color: "#64748b" }}>
            <Edit sx={{ fontSize: 15 }} />
          </IconButton>
        )}
      </Box>
    );
  }

  return (
    <Stack direction="row" alignItems="center" gap={1.25}
      sx={{ px: 1.5, py: 1.1, borderRadius: 2, border: "1px solid", borderColor: has ? "#bbf7d0" : "#fde68a", bgcolor: has ? "#f0fdf4" : "#fffbeb" }}>
      <Payments sx={{ fontSize: 20, color: has ? "#059669" : "#d97706" }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b" }}>มูลค่างานครั้งนี้</Typography>
        {has
          ? <Typography sx={{ fontSize: "1rem", fontWeight: 900, color: "#065f46", lineHeight: 1.3 }}>฿{fmt(value)}</Typography>
          : <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: "#b45309" }}>ยังไม่ใส่ (ไม่บังคับ — งานที่ไม่มีมูลค่าเว้นว่างได้)</Typography>}
      </Box>
      {!disabled && (
        <Button size="small" variant={has ? "text" : "contained"} disableElevation onClick={start} startIcon={<Edit sx={{ fontSize: 15 }} />}
          sx={{ borderRadius: 2, textTransform: "none", fontWeight: 800, flexShrink: 0,
            ...(has ? {} : { bgcolor: "#f59e0b", "&:hover": { bgcolor: "#d97706" } }) }}>
          {has ? "แก้ไข" : "ใส่มูลค่า"}
        </Button>
      )}
    </Stack>
  );
}
