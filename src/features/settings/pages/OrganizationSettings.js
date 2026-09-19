/**
 * OrganizationSettings — ตั้งค่าองค์กร: โลโก้ · ข้อมูลบริษัทบนเอกสาร · ค่าตั้งต้น
 *
 * ✅ ผู้ใช้สั่ง: "หน้าการตั้งค่า อยากให้ปรับเปลี่ยนได้เอง เช่น Logo แอพ / การแสดงผลต่างๆ"
 * เดิมค่าพวกนี้ฝังในโค้ด (public/logo-*.png และ ISSUER ใน deliveryNotePdf.js) เปลี่ยนทีต้อง deploy ใหม่
 *
 * ค่าที่ตั้งที่นี่มีผลกับ 3 ที่พร้อมกัน — มีตัวอย่างให้ดูก่อนบันทึกทุกช่อง:
 *   1. โลโก้บนหัวเว็บ / หน้าเข้าสู่ระบบ
 *   2. หัวกระดาษของเอกสาร PDF ทุกใบ (ใบเบิก · ใบเคลม · ใบส่งมอบงาน · ใบแจ้งเข้างาน)
 *   3. ตราประทับบนเอกสาร
 *
 * 🔒 เข้าได้เฉพาะผู้มีสิทธิ์จัดการระบบ (manageAll) — server บังคับซ้ำอีกชั้นที่ routes/settings.js
 */
import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Box, Stack, Typography, TextField, Button, Alert, Snackbar, CircularProgress, Divider, Chip, Tooltip
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Business, Image as ImageIcon, Save, RestartAlt, UploadFile, Description } from "@mui/icons-material";

import usePermissions from "@/shared/hooks/usePermissions";
import useOrgSettings from "@/shared/hooks/useOrgSettings";
import OrgSettingService, { ORG_FALLBACK } from "@/shared/services/OrgSettingService";
import { thaiDateTime } from "@/shared/utils/thaiDate";

const ACCENT = "#0f766e";
const TEXT_SUB = "#64748b";
const BORDER = "#e2e8f0";

/** ช่องรูป 3 ช่อง — บอกให้ชัดว่ารูปนี้ไปโผล่ตรงไหน ไม่งั้นอัปสลับช่องกันแน่นอน */
const IMAGE_SLOTS = [
  {
    slot: "app", field: "logoUrl", title: "โลโก้แอป",
    desc: "แสดงบนหัวเว็บและหน้าเข้าสู่ระบบ · ค่าเริ่มต้นคือโลโก้ PlanNgan ของแอป — เลือกชุดอื่นหรืออัปโหลดโลโก้บริษัททับได้",
    dark: true,
  },
  {
    slot: "letterhead", field: "letterheadUrl", title: "โลโก้หัวกระดาษ (เอกสาร PDF)",
    desc: "พิมพ์กลางหัวกระดาษทุกใบ · ⚠️ ควรตัดขอบว่างรอบโลโก้ออกก่อน ไม่งั้นหัวกระดาษจะมีช่องว่างเกิน",
  },
  {
    slot: "stamp", field: "stampUrl", title: "ตราประทับบริษัท",
    desc: "ใช้ประทับบนใบส่งมอบงาน/ใบแจ้งเข้างาน · PNG พื้นหลังโปร่งใส",
  },
];

const FIELDS = [
  { key: "nameTh", label: "ชื่อบริษัท (ภาษาไทย) *", full: true, max: 160 },
  { key: "nameEn", label: "ชื่อบริษัท (ภาษาอังกฤษ)", full: true, max: 160 },
  { key: "address", label: "ที่อยู่", full: true, max: 300, rows: 2 },
  { key: "taxId", label: "เลขประจำตัวผู้เสียภาษี (พิมพ์ทั้งบรรทัดตามที่ต้องการให้ขึ้นบนเอกสาร)", full: true, max: 120 },
  { key: "tel", label: "โทรศัพท์", max: 60 },
  { key: "email", label: "อีเมล", max: 120 },
  { key: "website", label: "เว็บไซต์", max: 160 },
];

const Section = ({ icon: Icon, title, hint, children }) => (
  <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 2.5, p: { xs: 1.5, sm: 2.25 }, mb: 1.75 }}>
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: hint ? 0.25 : 1.5 }}>
      <Icon sx={{ fontSize: 20, color: ACCENT }} />
      <Typography sx={{ fontWeight: 900, fontSize: "1rem" }}>{title}</Typography>
    </Stack>
    {hint && <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mb: 1.5 }}>{hint}</Typography>}
    {children}
  </Box>
);

/** ช่องอัปโหลดรูปหนึ่งช่อง พร้อมตัวอย่างรูปที่ใช้อยู่จริง */
const ImageSlot = ({ meta, value, busy, presets = [], onPick, onReset, onUsePreset }) => {
  const inputRef = useRef(null);
  const isDefault = !value || value === ORG_FALLBACK[meta.field];
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}
      sx={{ py: 1.25 }}
    >
      <Box sx={{
        width: { xs: "100%", sm: 150 }, height: 74, flexShrink: 0, borderRadius: 2, border: `1px solid ${BORDER}`,
        bgcolor: meta.dark ? "#0f172a" : "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", p: 1,
      }}>
        {value
          ? <Box component="img" src={value} alt={meta.title} sx={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          : <Typography variant="caption" sx={{ color: TEXT_SUB }}>ไม่มีรูป</Typography>}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap" useFlexGap>
          <Typography sx={{ fontWeight: 800, fontSize: "0.9rem" }}>{meta.title}</Typography>
          {isDefault && <Chip size="small" label="ค่าเริ่มต้นของระบบ" sx={{ height: 19, fontSize: "0.68rem", fontWeight: 700 }} />}
        </Stack>
        <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>{meta.desc}</Typography>
      </Box>
      {/* ✅ ผู้ใช้สั่ง: "วางชุดเดิมไว้ด้วย หรือให้เลือกได้" — กดรูปที่ติดมากับแอปได้เลย ไม่ต้องไปหาไฟล์มาอัป */}
      {presets.length > 0 && (
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 0.75, flexShrink: 0 }}>
          {presets.map((b) => {
            const active = value === b.url;
            return (
              <Tooltip key={b.key} title={active ? `ใช้ ${b.label} อยู่` : `ใช้ ${b.label}`} describeChild>
                <Box
                  component="button" type="button" disabled={busy || active}
                  onClick={() => onUsePreset(b.key)}
                  sx={{
                    width: 84, height: 46, p: 0.5, borderRadius: 1.5, cursor: active ? "default" : "pointer",
                    border: `1.5px solid ${active ? ACCENT : BORDER}`,
                    bgcolor: meta.dark ? "#0f172a" : "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: busy ? 0.5 : 1,
                    "&:hover": { borderColor: ACCENT },
                  }}
                >
                  <Box component="img" src={b.url} alt={b.label}
                    sx={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                </Box>
              </Tooltip>
            );
          })}
        </Stack>
      )}
      <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0 }}>
        <input
          ref={inputRef} type="file" hidden accept="image/png,image/jpeg,image/webp"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPick(f); }}
        />
        <Button
          size="small" variant="outlined" startIcon={<UploadFile sx={{ fontSize: 17 }} />} disabled={busy}
          onClick={() => inputRef.current?.click()}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}
        >
          เปลี่ยนรูป
        </Button>
        {!isDefault && (
          <Button size="small" color="inherit" disabled={busy} onClick={onReset} sx={{ textTransform: "none", fontWeight: 700, color: TEXT_SUB }}>
            ใช้ค่าเริ่มต้น
          </Button>
        )}
      </Stack>
    </Stack>
  );
};

export default function OrganizationSettings() {
  const { can } = usePermissions();
  const live = useOrgSettings();
  // รายการรูปที่ติดมากับแอป — server ส่งมาพร้อม GET /settings (อ่านหลัง live เปลี่ยนทุกครั้งเพื่อให้ได้ค่าล่าสุด)
  const builtin = OrgSettingService.builtinImages();
  const [form, setForm] = useState(live);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // ค่าจากเซิร์ฟเวอร์เปลี่ยน (โหลดเสร็จ/คนอื่นแก้) — ดึงมาแสดง เว้นแต่กำลังพิมพ์ค้างอยู่
  useEffect(() => { if (!dirty) setForm(live); }, [live, dirty]);

  if (!can("manageSystem")) return <Navigate to="/about" replace />;

  const set = (key) => (e) => { setDirty(true); setForm((f) => ({ ...f, [key]: e.target.value })); };

  const save = async () => {
    setBusy(true); setError("");
    try {
      await OrgSettingService.update({
        ...Object.fromEntries(FIELDS.map((f) => [f.key, form[f.key] || ""])),
        advanceClearDays: Number(form.advanceClearDays) || ORG_FALLBACK.advanceClearDays,
      });
      setDirty(false);
      setToast("บันทึกการตั้งค่าแล้ว — เอกสารที่ออกหลังจากนี้จะใช้ข้อมูลใหม่ทันที");
    } catch (err) {
      setError(err?.response?.data?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const pickImage = async (slot, file) => {
    setBusy(true); setError("");
    try {
      await OrgSettingService.uploadImage(slot, file);
      setToast("เปลี่ยนรูปแล้ว");
    } catch (err) {
      setError(err?.response?.data?.message || "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  /** เลือกรูปที่ติดมากับแอป (PlanNgan / ชุดเดิม) — เร็วกว่าไปหาไฟล์มาอัปโหลดใหม่ */
  const applyPresetImage = async (slot, key) => {
    setBusy(true); setError("");
    try {
      await OrgSettingService.applyBuiltinImage(slot, key);
      setToast("เปลี่ยนรูปแล้ว");
    } catch (err) {
      setError(err?.response?.data?.message || "ทำรายการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const resetImage = async (slot) => {
    setBusy(true); setError("");
    try {
      await OrgSettingService.update({ [`clear_${slot}`]: true });
      setToast("กลับไปใช้รูปเริ่มต้นแล้ว");
    } catch (err) {
      setError(err?.response?.data?.message || "ทำรายการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 1.25, sm: 2.5 }, maxWidth: 980, mx: "auto" }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2.5, bgcolor: ACCENT, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Business />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 900, fontSize: "1.3rem", color: "#0f172a", lineHeight: 1.25 }}>ตั้งค่าองค์กร</Typography>
          <Typography variant="caption" sx={{ color: TEXT_SUB }}>
            โลโก้ · ข้อมูลบริษัทที่พิมพ์บนเอกสาร · ค่าตั้งต้นของระบบเบิก
            {live.updatedAt ? ` · แก้ล่าสุด ${thaiDateTime(live.updatedAt)}${live.updatedBy ? ` โดย ${live.updatedBy}` : ""}` : ""}
          </Typography>
        </Box>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError("")}>{error}</Alert>}

      <Section icon={ImageIcon} title="โลโก้และตราประทับ" hint="อัปโหลดแล้วมีผลทันทีทุกหน้าจอและเอกสารที่ออกหลังจากนี้ (PNG / JPG / WebP ไม่เกิน 3 MB)">
        <Stack divider={<Divider flexItem />}>
          {IMAGE_SLOTS.map((meta) => (
            <ImageSlot
              key={meta.slot} meta={meta} value={live[meta.field]} busy={busy}
              presets={builtin[meta.slot] || []}
              onPick={(file) => pickImage(meta.slot, file)}
              onReset={() => resetImage(meta.slot)}
              onUsePreset={(key) => applyPresetImage(meta.slot, key)}
            />
          ))}
        </Stack>
      </Section>

      <Section icon={Description} title="ข้อมูลบริษัทบนเอกสาร" hint="พิมพ์อยู่หัวกระดาษของเอกสาร PDF ทุกใบที่ออกจากระบบ">
        {/* ✅ ตัวอย่างหัวกระดาษจริง — เห็นผลก่อนบันทึก ไม่ต้องออกเอกสารมาลองทีละใบ */}
        <Box sx={{ border: `1px dashed ${BORDER}`, borderRadius: 2, p: 2, mb: 2, bgcolor: alpha(ACCENT, 0.03), textAlign: "center" }}>
          <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mb: 1 }}>ตัวอย่างหัวกระดาษ</Typography>
          {live.letterheadUrl && (
            <Box component="img" src={live.letterheadUrl} alt="" sx={{ height: 44, objectFit: "contain", mb: 0.5 }} />
          )}
          <Typography sx={{ fontWeight: 800, fontSize: "1rem", lineHeight: 1.35 }}>{form.nameTh || "—"}</Typography>
          <Typography sx={{ fontSize: "0.82rem" }}>{form.nameEn}</Typography>
          <Typography sx={{ fontSize: "0.76rem", color: TEXT_SUB }}>{form.address}</Typography>
          <Typography sx={{ fontSize: "0.76rem", color: TEXT_SUB }}>{form.taxId}</Typography>
          <Box sx={{ height: 2, bgcolor: ACCENT, mt: 1, borderRadius: 1 }} />
        </Box>

        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
          {FIELDS.map((f) => (
            <TextField
              key={f.key} size="small" label={f.label} value={form[f.key] || ""} onChange={set(f.key)}
              multiline={Boolean(f.rows)} minRows={f.rows} inputProps={{ maxLength: f.max }}
              sx={{ gridColumn: f.full ? { sm: "1 / -1" } : undefined }}
              error={f.key === "nameTh" && !String(form.nameTh || "").trim()}
              helperText={f.key === "nameTh" && !String(form.nameTh || "").trim() ? "ต้องมีชื่อบริษัท — ใช้พิมพ์บนเอกสารทุกใบ" : undefined}
            />
          ))}
        </Box>
      </Section>

      <Section icon={RestartAlt} title="ค่าตั้งต้นของระบบเบิก">
        <TextField
          size="small" type="number" label="กำหนดเคลียร์ Advance (วัน)"
          value={form.advanceClearDays ?? ""} onChange={set("advanceClearDays")}
          inputProps={{ min: 1, max: 90 }}
          helperText="นับจากวันที่อนุมัติเบิกจ่าย — ใช้เมื่อผู้อนุมัติเบิกจ่ายไม่ได้ระบุวันเอง และใช้เตือนเมื่อเลยกำหนด"
          sx={{ maxWidth: 320 }}
        />
      </Section>

      <Stack direction="row" spacing={1} justifyContent="flex-end">
        {dirty && (
          <Button onClick={() => { setForm(live); setDirty(false); }} disabled={busy} sx={{ textTransform: "none", fontWeight: 700, color: TEXT_SUB }}>
            ยกเลิกการแก้ไข
          </Button>
        )}
        <Button
          variant="contained" onClick={save} disabled={busy || !dirty || !String(form.nameTh || "").trim()}
          startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <Save sx={{ fontSize: 18 }} />}
          sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: ACCENT, "&:hover": { bgcolor: "#115e59", boxShadow: "none" } }}
        >
          บันทึกการตั้งค่า
        </Button>
      </Stack>

      <Snackbar open={Boolean(toast)} autoHideDuration={3000} onClose={() => setToast("")} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="success" variant="filled" onClose={() => setToast("")}>{toast}</Alert>
      </Snackbar>
    </Box>
  );
}
