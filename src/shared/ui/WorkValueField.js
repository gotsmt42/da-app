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
 *
 * 🔁 (20 พ.ย. 2569 ผู้ใช้: "ช่องใส่มูลค่ามันยังดูแปลกๆ หน้าจอคอมดูยาก ไม่สวย และยาวเกินไป")
 *    เดิมแบบย่อ (ตาราง/การ์ด) กางช่องกรอก + ปุ่ม + VAT + ค่าแนะนำ ลงในช่องตารางเลย และช่องนั้นห้ามตัดบรรทัด
 *    → คอลัมน์ยืดยาวเกือบครึ่งจอ ดันคอลัมน์อื่นออกไป
 *    → แบบย่อ: กดดินสอแล้วเปิด "กล่องลอย" ขนาดพอดี (กว้าง ~360px) ใต้ตัวเลข — ตารางไม่ขยับ
 *    → ทุกแบบใช้หน้าตาเดียวกัน: ช่องตัวเลขใหญ่ชิดขวา (฿ … บาท) · VAT · ค่าแนะนำเป็นการ์ดตัดบรรทัดได้ · ปุ่มบันทึกขวาล่าง
 */
import React, { useRef, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Box, Button, IconButton, Popover, Stack, TextField, Typography, InputAdornment, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { EditRounded as Edit, PaymentsRounded as Payments, AutoAwesomeRounded as AutoAwesome } from "@mui/icons-material";
import { suggestWorkValue, vatParts, vatLabel, hasWorkValue, contractVatInfo } from "@/shared/utils/workValue";

const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e6e9ef";
const ACCENT = "#2563eb";

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
 * @param label        หัวข้อ (แบบเต็ม + หัวกล่องลอยของแบบย่อ) · ค่าเริ่ม "มูลค่างานครั้งนี้"
 * @param noSuggest    ไม่เติมค่าแนะนำ — ✅ (17 พ.ย. 2569) มูลค่ารายคน: ค่าแนะนำคือยอดทั้งงาน ไม่ใช่ของคนนั้น
 */
// ที่มาของยอดที่บันทึกไว้ (workValueSource) — แสดงเล็กๆ ให้ตรวจได้ว่ายอดมาจากไหน
const SOURCE_TEXT = { contract: "จากมูลค่าสัญญา ÷ ครั้ง", job: "จากมูลค่างานรวม", quotation: "จากใบเสนอราคา", ai: "AI อ่านจากไฟล์" };

export default function WorkValueField({ value, vatIncluded = false, event, onSave, disabled = false, compact = false, label = "มูลค่างานครั้งนี้", noSuggest = false, emptyText, source: savedSource = "" }) {
  const has = hasWorkValue(value);
  const ct = contractVatInfo(event);
  const anchorRef = useRef(null);
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
  const close = () => { if (!saving) setEditing(false); };
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

  /* ── ตัวแก้ไข (ใช้ทั้งกล่องลอยของแบบย่อ และแบบเต็ม) ── */
  const site = event && [event.site && event.site !== "-" ? event.site : "", event.title].filter(Boolean).join(" · ");
  const editor = (
    <Box sx={{ width: "100%" }} onClick={(e) => e.stopPropagation()}>
      {compact && (
        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.25 }}>
          <Box sx={{ width: 32, height: 32, borderRadius: "10px", flexShrink: 0, display: "grid", placeItems: "center", bgcolor: "#eff6ff", color: ACCENT }}>
            <Payments sx={{ fontSize: 18 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.9rem", fontWeight: 800, color: INK, lineHeight: 1.3 }}>{label}</Typography>
            {site && <Typography noWrap sx={{ fontSize: "0.72rem", color: MUTED }}>{site}</Typography>}
          </Box>
        </Stack>
      )}
      <TextField
        fullWidth size="small" autoFocus value={text}
        onChange={(e) => { setText(e.target.value); setSource("manual"); setHint(""); }}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") close(); }}
        placeholder="0" error={invalid}
        helperText={invalid ? "ใส่เป็นตัวเลข 0 ขึ้นไป" : "งานที่ไม่คิดเงินใส่ 0 · ลบให้ว่าง = ล้างค่า"}
        inputProps={{ inputMode: "decimal", autoComplete: "off", "aria-label": label, style: { textAlign: "right" } }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><Box component="span" sx={{ fontWeight: 800, color: "#94a3b8" }}>฿</Box></InputAdornment>,
          endAdornment: <InputAdornment position="end"><Box component="span" sx={{ fontSize: "0.8rem", color: MUTED }}>บาท</Box></InputAdornment>,
        }}
        FormHelperTextProps={{ sx: { mx: 0.25, mt: 0.5, fontSize: "0.7rem", color: invalid ? "#dc2626" : "#94a3b8" } }}
        sx={{
          "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: "#fff", height: 46 },
          "& .MuiOutlinedInput-input": { fontSize: "1.1rem", fontWeight: 800, color: INK, fontVariantNumeric: "tabular-nums" },
        }}
      />

      {/* VAT (งานสัญญาใช้ VAT ของมูลค่าสัญญา) */}
      {ct ? (
        <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 1, px: 1.25, py: 0.85, borderRadius: 2, bgcolor: "#f8fafc", border: `1px solid ${LINE}` }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#1d4ed8" }}>งานสัญญา{ct.hasValue ? ` · มูลค่าสัญญา ฿${fmt(ct.jobValue)}` : ""}</Typography>
            <Typography sx={{ fontSize: "0.74rem", lineHeight: 1.4, color: ct.set && ct.hasValue ? MUTED : "#b45309" }}>{ct.text}</Typography>
          </Box>
          {event?.contractGroupId && (
            <Button component={RouterLink} to={`/contracts?contract=${encodeURIComponent(event.contractGroupId)}`} size="small" variant="outlined"
              sx={{ flexShrink: 0, textTransform: "none", fontWeight: 700, fontSize: "0.74rem", borderRadius: 2, borderColor: "#bfdbfe", color: ACCENT, px: 1.25, minWidth: 0 }}>
              ดูสัญญา ›
            </Button>
          )}
        </Stack>
      ) : (
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{ mt: 1 }}>
          <ToggleButtonGroup size="small" exclusive value={vat ? "1" : "0"} onChange={(_, v) => v !== null && setVat(v === "1")}
            sx={{ bgcolor: "#f1f5f9", p: 0.25, borderRadius: 2, "& .MuiToggleButton-root": { border: 0, borderRadius: "7px !important", px: 1.25, py: 0.3, textTransform: "none", fontSize: "0.76rem", fontWeight: 700, color: MUTED },
              "& .Mui-selected": { bgcolor: "#fff !important", color: "#1d4ed8 !important", boxShadow: "0 1px 2px rgba(15,23,42,.12)" } }}>
            <ToggleButton value="0">ก่อน VAT</ToggleButton>
            <ToggleButton value="1">รวม VAT 7%</ToggleButton>
          </ToggleButtonGroup>
          {parts && (
            <Typography sx={{ ml: "auto", fontSize: "0.74rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>
              {vat ? `ก่อน VAT ฿${fmt2(parts.net)}` : `รวม VAT ฿${fmt2(parts.gross)}`}
            </Typography>
          )}
        </Stack>
      )}

      {/* ค่าแนะนำ — การ์ดเล็ก ตัดบรรทัดได้ (ไม่ยืดความกว้าง) */}
      {sugg && (
        <Stack direction="row" gap={1} alignItems="center" sx={{ mt: 1, px: 1.25, py: 0.9, borderRadius: 2, bgcolor: "#eff6ff", border: "1px solid #dbeafe" }}>
          <AutoAwesome sx={{ fontSize: 16, color: ACCENT, flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.8rem", color: "#1e3a8a", lineHeight: 1.35 }}>
              แนะนำ <Box component="span" sx={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>฿{fmt(sugg.amount)}</Box>
            </Typography>
            <Typography sx={{ fontSize: "0.7rem", color: "#3b5bdb", lineHeight: 1.4 }}>
              {`จาก${sugg.hint}`}{sugg.source === "job" ? " · ใช้เมื่องานนี้เข้าครั้งเดียว" : ""}
            </Typography>
          </Box>
          <Button size="small" variant="outlined" onClick={useSuggestion}
            sx={{ flexShrink: 0, minWidth: 0, px: 1.25, height: 30, textTransform: "none", fontWeight: 800, fontSize: "0.74rem", borderRadius: 2, bgcolor: "#fff", borderColor: "#bfdbfe" }}>
            ใช้ค่านี้
          </Button>
        </Stack>
      )}
      {hint && (
        <Stack direction="row" gap={0.75} alignItems="center" sx={{ mt: 1, px: 1.25, py: 0.75, borderRadius: 2, bgcolor: "#eff6ff", color: "#1e40af" }}>
          <AutoAwesome sx={{ fontSize: 15, flexShrink: 0 }} />
          <Typography sx={{ fontSize: "0.74rem", lineHeight: 1.45 }}>ใช้ค่าจาก{hint} — ตรวจแล้วกดบันทึก</Typography>
        </Stack>
      )}

      <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ mt: 1.5 }}>
        <Button size="small" onClick={close} disabled={saving} sx={{ height: 36, px: 1.75, borderRadius: 2, textTransform: "none", fontWeight: 700, color: MUTED }}>ยกเลิก</Button>
        <Button size="small" variant="contained" disableElevation disabled={invalid || saving} onClick={save}
          sx={{ height: 36, px: 2.25, borderRadius: 2, textTransform: "none", fontWeight: 800, bgcolor: ACCENT, "&:hover": { bgcolor: "#1d4ed8" } }}>
          {saving ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
      </Stack>
    </Box>
  );

  if (compact) {
    return (
      <>
        <Box component="span" ref={anchorRef} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
          {has
            ? <Typography component="span" sx={{ fontSize: "0.86rem", fontWeight: 700, color: "#1e293b", fontVariantNumeric: "tabular-nums" }}>
                ฿{fmt(value)} <Box component="span" sx={{ fontSize: "0.7rem", fontWeight: 500, color: MUTED }}>{vatLabel(vatIncluded)}</Box>
                {SOURCE_TEXT[savedSource] && <Box component="span" sx={{ ml: 0.5, fontSize: "0.66rem", fontWeight: 600, color: savedSource === "job" ? "#b45309" : "#94a3b8" }}>· {SOURCE_TEXT[savedSource]}</Box>}
              </Typography>
            : <Typography component="span" sx={{ fontSize: "0.8rem", fontWeight: 600, color: "#94a3b8" }}>ยังไม่ใส่</Typography>}
          {!disabled && (
            <IconButton size="small" onClick={start} title={has ? "แก้มูลค่างาน" : "ใส่มูลค่างาน"} aria-label={has ? "แก้มูลค่างาน" : "ใส่มูลค่างาน"}
              sx={{ p: 0.4, color: editing ? ACCENT : MUTED, bgcolor: editing ? "#eff6ff" : "transparent" }}>
              <Edit sx={{ fontSize: 15 }} />
            </IconButton>
          )}
        </Box>
        <Popover
          open={editing} anchorEl={anchorRef.current} onClose={close}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
          onClick={(e) => e.stopPropagation()}
          slotProps={{ paper: { sx: { mt: 0.75, width: 360, maxWidth: "calc(100vw - 24px)", p: 1.75, borderRadius: 3, border: `1px solid ${LINE}`, boxShadow: "0 18px 44px -12px rgba(15,23,42,.28)", whiteSpace: "normal", textAlign: "left" } } }}
        >
          {editor}
        </Popover>
      </>
    );
  }

  if (editing) return editor;

  const shownParts = has ? vatParts(value, Boolean(vatIncluded)) : null;
  return (
    <Stack direction="row" alignItems="center" gap={1.25}
      sx={{ px: 1.5, py: 1.1, borderRadius: 2, border: "1px solid", borderColor: has ? "#dbeafe" : "#fde68a", bgcolor: has ? "#f8fbff" : "#fffbeb" }}>
      <Payments sx={{ fontSize: 20, color: has ? ACCENT : "#d97706" }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: MUTED }}>{label}</Typography>
        {has ? (
          <>
            <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", lineHeight: 1.3 }}>
              ฿{fmt(value)} <Box component="span" sx={{ fontSize: "0.74rem", fontWeight: 500, color: MUTED }}>{vatLabel(vatIncluded)}</Box>
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
            ...(has ? {} : { bgcolor: ACCENT, "&:hover": { bgcolor: "#1d4ed8" } }) }}>
          {has ? "แก้ไข" : "ใส่มูลค่า"}
        </Button>
      )}
    </Stack>
  );
}
