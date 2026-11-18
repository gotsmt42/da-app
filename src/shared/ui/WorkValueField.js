/**
 * ✅ (2 พ.ย. 2569 ผู้ใช้: "ให้ใส่แยกได้ด้วยสิ") ช่อง "มูลค่างานครั้งนี้" ใส่/แก้ได้ทุกเมื่อ ไม่ต้องรอขอปิดงาน
 *    ใช้ทั้งหน้างานของช่าง และการ์ดงานในหน้าการดำเนินงาน (แอดมินเติมงานเก่าย้อนหลัง/แก้ค่าที่ใส่ผิด)
 *    onSave(number | null, { workValueVatIncluded, workValueSource }) — null = ล้างค่า
 *
 * 🔁 (10 พ.ย. 2569 ผู้ใช้: "ให้ใส่อัตโนมัติ · เลือกได้ว่ายอดบวก VAT หรือยอด Net · ทำให้สอดคล้องกันทั้งหมด")
 *    • เลือก "ก่อน VAT" / "รวม VAT 7%" · แสดงอีกฝั่งของยอดทันที (สูตรเดียวกับฟอร์มแก้ไขงาน — shared/utils/workValue.js)
 *    🔁 (10 พ.ย. 2569) งานสัญญา = ไม่มีตัวเลือก VAT · ใช้การระบุ VAT ของมูลค่าสัญญาที่หน้าภาพรวมงาน
 *    • ยังไม่เคยใส่ + มีข้อมูลพอ (สัญญา ÷ ครั้ง / มูลค่างานรวม / ใบเสนอราคาที่ได้งาน) → แสดงค่าแนะนำ บอกที่มา + ปุ่ม "ใช้ค่านี้"
 *      🔁 (18 พ.ย. 2569) ไม่เติมลงช่องให้เอง — ต้องกด "ใช้ค่านี้" (กันยอดทั้งงานถูกบันทึกเป็นยอดครั้งนี้โดยไม่ตั้งใจ)
 */
import React, { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Box, Button, IconButton, Stack, TextField, Typography, InputAdornment, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { EditRounded as Edit, PaymentsRounded as Payments, AutoAwesomeRounded as AutoAwesome } from "@mui/icons-material";
import { suggestWorkValue, vatParts, vatLabel, hasWorkValue, contractVatInfo } from "@/shared/utils/workValue";

const parseBaht = (v) => {
  const t = String(v ?? "").replace(/[,\s฿]/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};
const fmt = (n) => Number(n).toLocaleString("th-TH", { maximumFractionDigits: 2 });
const fmt2 = (n) => Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * @param value        มูลค่าที่บันทึกไว้
 * @param vatIncluded  ค่าที่บันทึกไว้รวม VAT แล้วหรือไม่
 * @param event        ข้อมูลงาน (ใช้หาค่าแนะนำอัตโนมัติ) — ไม่ส่ง = ไม่แนะนำ
 * @param label        หัวข้อ (แบบเต็ม) · ค่าเริ่ม "มูลค่างานครั้งนี้"
 * @param noSuggest    ไม่เติมค่าแนะนำ — ✅ (17 พ.ย. 2569) มูลค่ารายคน: ค่าแนะนำคือยอดทั้งงาน ไม่ใช่ของคนนั้น
 */
// ที่มาของยอดที่บันทึกไว้ (workValueSource) — แสดงเล็กๆ ให้ตรวจได้ว่ายอดมาจากไหน
const SOURCE_TEXT = { contract: "จากมูลค่าสัญญา ÷ ครั้ง", job: "จากมูลค่างานรวม", quotation: "จากใบเสนอราคา", ai: "AI อ่านจากไฟล์" };

export default function WorkValueField({ value, vatIncluded = false, event, onSave, disabled = false, compact = false, label = "มูลค่างานครั้งนี้", noSuggest = false, emptyText, source: savedSource = "" }) {
  const has = hasWorkValue(value);
  const ct = contractVatInfo(event);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [vat, setVat] = useState(Boolean(vatIncluded));
  const [source, setSource] = useState("");
  const [hint, setHint] = useState("");
  const [sugg, setSugg] = useState(null); // ค่าแนะนำ — ใส่เมื่อกด "ใช้ค่านี้" เท่านั้น
  const [saving, setSaving] = useState(false);
  const parsed = parseBaht(text);
  const invalid = Number.isNaN(parsed);
  const parts = parsed > 0 ? vatParts(parsed, vat) : null;

  // 🔁 (18 พ.ย. 2569 ผู้ใช้: "ทำไมยอดเยอะขนาดนี้" → "ทำให้มีประสิทธิภาพและเช็คข้อมูลได้ง่าย")
  //    ไม่เติมค่าแนะนำลงช่องเอง (กดบันทึกโดยไม่ทันดู = ยอดทั้งงานกลายเป็นยอดครั้งนี้) — แสดงค่าแนะนำ + ปุ่ม "ใช้ค่านี้"
  const start = () => {
    const sg = has || noSuggest ? null : suggestWorkValue(event);
    setText(has ? fmt(value) : "");
    setVat(ct ? ct.vatIncluded : Boolean(vatIncluded));
    setSource(has ? "" : "manual");
    setHint("");
    setSugg(sg);
    setEditing(true);
  };
  const useSuggestion = () => {
    if (!sugg) return;
    setText(fmt(sugg.amount));
    if (!ct && sugg.vatIncluded !== null) setVat(sugg.vatIncluded);
    setSource(sugg.source);
    setHint(sugg.hint);
    setSugg(null);
  };
  const save = async () => {
    if (invalid) return;
    setSaving(true);
    try {
      await onSave?.(parsed, { workValueVatIncluded: ct ? ct.vatIncluded : vat, workValueSource: parsed === null ? "" : (source || "manual") });
      setEditing(false);
    } catch {
      // ผู้เรียกแจ้งข้อผิดพลาดเอง — ค้างช่องไว้ให้ลองใหม่ได้
    } finally { setSaving(false); }
  };

  if (editing) {
    return (
      <Box sx={{ width: "100%" }} onClick={(e) => e.stopPropagation()}>
        <Stack direction="row" gap={0.75} alignItems="flex-start" flexWrap="wrap">
          <TextField
            size="small" autoFocus value={text} onChange={(e) => { setText(e.target.value); setSource("manual"); setHint(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            placeholder="เช่น 15,000 (ไม่คิดเงินใส่ 0)" error={invalid}
            helperText={invalid ? "ใส่เป็นตัวเลข 0 ขึ้นไป" : undefined}
            inputProps={{ inputMode: "decimal", autoComplete: "off" }}
            InputProps={{ endAdornment: <InputAdornment position="end">บาท</InputAdornment> }}
            sx={{ flex: "1 1 140px", minWidth: 140, "& .MuiOutlinedInput-root": { borderRadius: 2, fontSize: "0.86rem", bgcolor: "#fff" } }}
          />
          <Button size="small" variant="contained" disableElevation disabled={invalid || saving} onClick={save}
            sx={{ height: 40, borderRadius: 2, textTransform: "none", fontWeight: 700, minWidth: 0, px: 1.5 }}>
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
          <Button size="small" onClick={() => setEditing(false)} sx={{ height: 40, textTransform: "none", minWidth: 0, color: "#64748b" }}>ยกเลิก</Button>
        </Stack>
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{ mt: 0.75 }}>
          {ct ? (
            <Stack direction="row" alignItems="center" gap={1} sx={{ flex: "1 1 100%", px: 1.25, py: 0.75, borderRadius: 2, bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: "#1d4ed8" }}>งานสัญญา{ct.hasValue ? ` · มูลค่าสัญญา ฿${fmt(ct.jobValue)}` : ""}</Typography>
                <Typography sx={{ fontSize: "0.74rem", lineHeight: 1.4, color: ct.set && ct.hasValue ? "#64748b" : "#b45309" }}>{ct.text}</Typography>
              </Box>
              <Button component={RouterLink} to={`/contracts?contract=${encodeURIComponent(event.contractGroupId)}`} size="small" variant="outlined"
                sx={{ flexShrink: 0, textTransform: "none", fontWeight: 700, fontSize: "0.74rem", borderRadius: 2, borderColor: "#bfdbfe", color: "#2563eb", px: 1.25, minWidth: 0 }}>
                ดูสัญญา ›
              </Button>
            </Stack>
          ) : (
          <ToggleButtonGroup size="small" exclusive value={vat ? "1" : "0"} onChange={(_, v) => v !== null && setVat(v === "1")}
            sx={{ bgcolor: "#f1f5f9", p: 0.25, borderRadius: 2, "& .MuiToggleButton-root": { border: 0, borderRadius: "7px !important", px: 1.25, py: 0.25, textTransform: "none", fontSize: "0.76rem", fontWeight: 600, color: "#64748b" },
              "& .Mui-selected": { bgcolor: "#fff !important", color: "#1d4ed8 !important", boxShadow: "0 1px 2px rgba(15,23,42,.12)" } }}>
            <ToggleButton value="0">ก่อน VAT (Net)</ToggleButton>
            <ToggleButton value="1">รวม VAT 7%</ToggleButton>
          </ToggleButtonGroup>
          )}
          {parts && (
            <Typography sx={{ fontSize: "0.74rem", color: "#64748b", fontVariantNumeric: "tabular-nums" }}>
              {vat ? `ก่อน VAT ฿${fmt2(parts.net)}` : `รวม VAT ฿${fmt2(parts.gross)}`}
            </Typography>
          )}
        </Stack>
        {sugg && (
          <Stack direction="row" gap={0.75} alignItems="center" sx={{ mt: 0.75, px: 1, py: 0.6, borderRadius: 1.5, bgcolor: "#eff6ff", color: "#1e40af" }}>
            <AutoAwesome sx={{ fontSize: 14 }} />
            <Typography sx={{ flex: 1, fontSize: "0.74rem", lineHeight: 1.45 }}>
              ค่าแนะนำ <b>฿{fmt(sugg.amount)}</b> จาก{sugg.hint}{sugg.source === "job" ? " — ใช้เมื่องานนี้เข้าครั้งเดียว (ยอดทั้งงาน)" : ""}
            </Typography>
            <Button size="small" variant="outlined" onClick={useSuggestion}
              sx={{ flexShrink: 0, minWidth: 0, px: 1.25, py: 0.25, textTransform: "none", fontWeight: 800, fontSize: "0.74rem", borderRadius: 1.5 }}>
              ใช้ค่านี้
            </Button>
          </Stack>
        )}
        {hint && (
          <Stack direction="row" gap={0.5} alignItems="flex-start" sx={{ mt: 0.75, px: 1, py: 0.6, borderRadius: 1.5, bgcolor: "#eff6ff", color: "#1e40af" }}>
            <AutoAwesome sx={{ fontSize: 14, mt: 0.2 }} />
            <Typography sx={{ fontSize: "0.74rem", lineHeight: 1.45 }}>ใช้ค่าจาก{hint} — ตรวจแล้วกดบันทึก</Typography>
          </Stack>
        )}
      </Box>
    );
  }

  if (compact) {
    return (
      <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
        {has
          ? <Typography component="span" sx={{ fontSize: "0.86rem", fontWeight: 700, color: "#1e293b" }}>
              ฿{fmt(value)} <Box component="span" sx={{ fontSize: "0.7rem", fontWeight: 500, color: "#64748b" }}>{vatLabel(vatIncluded)}</Box>
              {SOURCE_TEXT[savedSource] && <Box component="span" sx={{ ml: 0.5, fontSize: "0.66rem", fontWeight: 600, color: savedSource === "job" ? "#b45309" : "#94a3b8" }}>· {SOURCE_TEXT[savedSource]}</Box>}
            </Typography>
          : <Typography component="span" sx={{ fontSize: "0.8rem", fontWeight: 600, color: "#d97706" }}>ยังไม่ใส่</Typography>}
        {!disabled && (
          <IconButton size="small" onClick={start} title={has ? "แก้มูลค่างาน" : "ใส่มูลค่างาน"} sx={{ p: 0.4, color: "#64748b" }}>
            <Edit sx={{ fontSize: 15 }} />
          </IconButton>
        )}
      </Box>
    );
  }

  const shownParts = has ? vatParts(value, Boolean(vatIncluded)) : null;
  return (
    <Stack direction="row" alignItems="center" gap={1.25}
      sx={{ px: 1.5, py: 1.1, borderRadius: 2, border: "1px solid", borderColor: has ? "#dbeafe" : "#fde68a", bgcolor: has ? "#f8fbff" : "#fffbeb" }}>
      <Payments sx={{ fontSize: 20, color: has ? "#2563eb" : "#d97706" }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: "#64748b" }}>{label}</Typography>
        {has ? (
          <>
            <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", lineHeight: 1.3 }}>
              ฿{fmt(value)} <Box component="span" sx={{ fontSize: "0.74rem", fontWeight: 500, color: "#64748b" }}>{vatLabel(vatIncluded)}</Box>
            </Typography>
            {shownParts && Number(value) > 0 && (
              <Typography sx={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                {vatIncluded ? `ก่อน VAT ฿${fmt2(shownParts.net)}` : `รวม VAT ฿${fmt2(shownParts.gross)}`}
              </Typography>
            )}
          </>
        ) : <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: "#b45309" }}>{emptyText || "ยังไม่ใส่ (ไม่บังคับ — งานที่ไม่มีมูลค่าเว้นว่างได้)"}</Typography>}
      </Box>
      {!disabled && (
        <Button size="small" variant={has ? "text" : "contained"} disableElevation onClick={start} startIcon={<Edit sx={{ fontSize: 15 }} />}
          sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700, flexShrink: 0,
            ...(has ? {} : { bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8" } }) }}>
          {has ? "แก้ไข" : "ใส่มูลค่า"}
        </Button>
      )}
    </Stack>
  );
}
