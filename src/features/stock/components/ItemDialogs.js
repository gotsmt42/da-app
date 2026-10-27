/**
 * ItemDialogs — ผู้ดูแลคลัง: เพิ่ม/แก้สินค้า (ItemFormDialog) · รับเข้า/ตรวจนับ (AdjustDialog)
 *
 * 🎨 (27 ต.ค. 2569 ผู้ใช้: "ไม่สวย ดูยาก" · "ให้ใส่รูปสินค้าได้ด้วย และแสดงให้สวยงาม ไม่รก")
 *    จอกว้าง 2 คอลัมน์: ซ้าย = รูป + ชนิด · ขวา = ข้อมูล (ป้ายเหนือช่อง) · มือถือเรียงลงมาคอลัมน์เดียว
 */
import { useEffect, useRef, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography, TextField, Alert,
  Switch, CircularProgress, useMediaQuery, InputAdornment, IconButton, ButtonBase,
} from "@mui/material";
import { Close, AddPhotoAlternate, DeleteOutline, CheckCircle, Category, Handyman } from "@mui/icons-material";

import { prepareUploadFile, ACCEPT_IMAGE } from "@/shared/utils/fileUpload";
import StockService, { errorText } from "../services/StockService";
import { STOCK_ACCENT, STOCK_DARK, TEXT_MAIN, TEXT_SUB, BORDER_MAIN, KINDS, available, fmt } from "../stockMeta";
import { FIELD_SX, Label, Thumb } from "./StockBits";

const BTN = { textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", px: 2.5, bgcolor: STOCK_ACCENT, "&:hover": { bgcolor: STOCK_DARK, boxShadow: "none" } };
const UNITS = ["ชิ้น", "อัน", "ตัว", "ม้วน", "เมตร", "กล่อง", "แพ็ค", "ชุด", "ลิตร", "เครื่อง"];
const KIND_ICON = { consumable: <Category />, asset: <Handyman /> };

const blank = { name: "", kind: "consumable", category: "", unit: "ชิ้น", qty: "", minQty: "", location: "", note: "", code: "", active: true };

const DialogHead = ({ title, sub, onClose, busy }) => (
  <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, py: 1.5, borderBottom: `1px solid ${BORDER_MAIN}` }}>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontWeight: 800, fontSize: "1.08rem", color: TEXT_MAIN }}>{title}</Typography>
      {sub && <Typography sx={{ fontSize: "0.78rem", color: TEXT_SUB }}>{sub}</Typography>}
    </Box>
    <IconButton onClick={onClose} disabled={busy}><Close /></IconButton>
  </DialogTitle>
);

/** ช่องรูปสินค้า — กดเลือกรูป (มือถือเปิดกล้อง/คลังรูปได้) · ดูตัวอย่างทันที · ลบได้ */
const PhotoPicker = ({ item, preview, onPick, onRemove, error }) => {
  const ref = useRef(null);
  const url = preview || item?.photo?.url;
  return (
    <Box>
      <ButtonBase onClick={() => ref.current?.click()} sx={{ width: "100%", aspectRatio: "1 / 1", maxHeight: { xs: 220, sm: "none" }, borderRadius: 3, overflow: "hidden", position: "relative",
        border: url ? `1px solid ${BORDER_MAIN}` : "2px dashed #d7dde5", bgcolor: url ? "#f8fafc" : "#fafafa", "&:hover .ov": { opacity: 1 } }}>
        {url ? (
          <>
            <Box component="img" src={url} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <Box className="ov" sx={{ position: "absolute", inset: 0, bgcolor: "rgba(15,23,42,.45)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, opacity: 0, transition: "opacity .15s", fontWeight: 700, fontSize: "0.85rem" }}>
              <AddPhotoAlternate sx={{ fontSize: 20 }} />เปลี่ยนรูป
            </Box>
          </>
        ) : (
          <Stack alignItems="center" spacing={0.5} sx={{ color: TEXT_SUB }}>
            <AddPhotoAlternate sx={{ fontSize: 38, color: "#94a3b8" }} />
            <Typography sx={{ fontWeight: 700, fontSize: "0.86rem", color: TEXT_MAIN }}>เพิ่มรูปสินค้า</Typography>
            <Typography sx={{ fontSize: "0.74rem" }}>ถ่ายรูป หรือเลือกจากเครื่อง</Typography>
          </Stack>
        )}
      </ButtonBase>
      <input ref={ref} type="file" accept={ACCEPT_IMAGE} hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPick(f); }} />
      {url && (
        <Button size="small" startIcon={<DeleteOutline />} onClick={onRemove} sx={{ mt: 0.75, textTransform: "none", color: TEXT_SUB, fontWeight: 600 }}>ลบรูป</Button>
      )}
      {error && <Typography sx={{ color: "#dc2626", fontSize: "0.76rem", mt: 0.5 }}>{error}</Typography>}
    </Box>
  );
};

export function ItemFormDialog({ open, item, dept, categories = [], onClose, onSaved }) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const editing = Boolean(item?._id);
  const [f, setF] = useState(blank);
  const [photo, setPhoto] = useState({ file: null, preview: "", remove: false, error: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setError("");
    setPhoto({ file: null, preview: "", remove: false, error: "" });
    setF(editing ? { ...blank, ...item, qty: "", minQty: item.minQty || "" } : blank);
  }, [open, editing, item]);
  useEffect(() => () => { if (photo.preview) URL.revokeObjectURL(photo.preview); }, [photo.preview]);
  const set = (patch) => setF((cur) => ({ ...cur, ...patch }));

  const pick = async (file) => {
    const r = await prepareUploadFile(file, { imagesOnly: true });
    if (!r.ok) { setPhoto((p) => ({ ...p, error: r.message || "ใช้ไฟล์นี้ไม่ได้" })); return; }
    setPhoto({ file: r.file, preview: URL.createObjectURL(r.file), remove: false, error: "" });
  };

  const save = async () => {
    if (!f.name.trim()) { setError("กรุณาระบุชื่อ"); return; }
    setBusy(true); setError("");
    try {
      const body = { name: f.name, kind: f.kind, category: f.category, unit: f.unit, minQty: Number(f.minQty) || 0, location: f.location, note: f.note };
      let saved = editing
        ? await StockService.updateItem(item._id, { ...body, code: f.code, active: f.active })
        : await StockService.addItem({ ...body, dept, qty: Number(f.qty) || 0 });
      if (photo.file) saved = await StockService.uploadPhoto(saved._id, photo.file);
      else if (photo.remove && item?.photo?.url) saved = await StockService.removePhoto(saved._id);
      onSaved(saved, { created: !editing });
    } catch (err) {
      setError(errorText(err, "บันทึกไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  const shownItem = photo.remove ? null : item;
  return (
    <Dialog open={open} onClose={() => !busy && onClose()} fullWidth maxWidth="md" fullScreen={isMobile}>
      <DialogHead title={editing ? "แก้ไขสินค้า / ทรัพย์สิน" : "เพิ่มสินค้า / ทรัพย์สิน"} sub={editing ? `${item.code} · ${item.name}` : "เพิ่มเข้าคลังของแผนก"} onClose={onClose} busy={busy} />
      <DialogContent sx={{ bgcolor: "#f8fafc", pt: "20px !important" }}>
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "220px minmax(0,1fr)" }, alignItems: "start" }}>
          {/* ซ้าย: รูป + ชนิด */}
          <Stack spacing={2}>
            <PhotoPicker item={shownItem} preview={photo.preview} error={photo.error} onPick={pick}
              onRemove={() => setPhoto({ file: null, preview: "", remove: true, error: "" })} />
            <Box>
              <Label required>ชนิด</Label>
              <Stack spacing={1}>
                {Object.entries(KINDS).map(([k, m]) => {
                  const on = f.kind === k;
                  return (
                    <ButtonBase key={k} onClick={() => set({ kind: k })}
                      sx={{ justifyContent: "flex-start", gap: 1.25, p: 1.25, borderRadius: 2.5, textAlign: "left", fontFamily: "inherit",
                        border: `1.5px solid ${on ? m.color : BORDER_MAIN}`, bgcolor: on ? m.bg : "#fff" }}>
                      <Box sx={{ width: 34, height: 34, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: on ? m.color : "#f1f5f9", color: on ? "#fff" : TEXT_SUB, "& svg": { fontSize: 19 } }}>
                        {KIND_ICON[k]}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: "0.86rem", color: on ? m.color : TEXT_MAIN }}>{m.full}</Typography>
                        <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>{m.hint}</Typography>
                      </Box>
                      {on && <CheckCircle sx={{ fontSize: 19, color: m.color }} />}
                    </ButtonBase>
                  );
                })}
              </Stack>
            </Box>
          </Stack>

          {/* ขวา: ข้อมูล */}
          <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER_MAIN}`, borderRadius: 3, p: { xs: 1.5, sm: 2 }, display: "grid", gap: 1.75, gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
            <Box sx={{ gridColumn: "1 / -1" }}>
              <Label required>ชื่อ</Label>
              <TextField fullWidth size="small" sx={FIELD_SX} value={f.name} onChange={(e) => set({ name: e.target.value })} autoFocus={!editing && !isMobile}
                placeholder={f.kind === "asset" ? "เช่น สว่านไร้สาย Makita, บันไดอะลูมิเนียม 6 ขั้น" : "เช่น สายไฟ VCT 2x1.5, เทปพันสายไฟ"} />
            </Box>
            <Box>
              <Label>หมวดหมู่</Label>
              <TextField fullWidth size="small" sx={FIELD_SX} value={f.category} onChange={(e) => set({ category: e.target.value })} inputProps={{ list: "stock-cats" }} placeholder="เช่น สายไฟ" />
              <datalist id="stock-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </Box>
            <Box>
              <Label>หน่วยนับ</Label>
              <TextField fullWidth size="small" sx={FIELD_SX} value={f.unit} onChange={(e) => set({ unit: e.target.value })} inputProps={{ list: "stock-units" }} />
              <datalist id="stock-units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
            </Box>
            {!editing && (
              <Box>
                <Label>ยอดตั้งต้น</Label>
                <TextField fullWidth size="small" type="number" sx={FIELD_SX} value={f.qty} onChange={(e) => set({ qty: e.target.value })} placeholder="0"
                  inputProps={{ min: 0, inputMode: "numeric" }} InputProps={{ endAdornment: <InputAdornment position="end">{f.unit}</InputAdornment> }} />
              </Box>
            )}
            <Box sx={editing ? { gridColumn: "1 / -1" } : undefined}>
              <Label hint="0 = ไม่เตือน">แจ้งใกล้หมดเมื่อต่ำกว่า</Label>
              <TextField fullWidth size="small" type="number" sx={FIELD_SX} value={f.minQty} onChange={(e) => set({ minQty: e.target.value })} placeholder="0"
                inputProps={{ min: 0, inputMode: "numeric" }} InputProps={{ endAdornment: <InputAdornment position="end">{f.unit}</InputAdornment> }} />
            </Box>
            <Box sx={{ gridColumn: editing ? "auto" : "1 / -1" }}>
              <Label>ที่เก็บ</Label>
              <TextField fullWidth size="small" sx={FIELD_SX} value={f.location} onChange={(e) => set({ location: e.target.value })} placeholder="เช่น ตู้ A ชั้น 2" />
            </Box>
            {editing && (
              <Box>
                <Label>รหัส</Label>
                <TextField fullWidth size="small" sx={FIELD_SX} value={f.code} onChange={(e) => set({ code: e.target.value })} />
              </Box>
            )}
            <Box sx={{ gridColumn: "1 / -1" }}>
              <Label>หมายเหตุ</Label>
              <TextField fullWidth size="small" sx={FIELD_SX} value={f.note} onChange={(e) => set({ note: e.target.value })} multiline minRows={2} placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" />
            </Box>
            {editing && (
              <Stack direction="row" alignItems="center" spacing={1} sx={{ gridColumn: "1 / -1", p: 1.25, borderRadius: 2, bgcolor: "#f8fafc", border: `1px solid ${BORDER_MAIN}` }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: "0.86rem" }}>{f.active ? "เปิดใช้งาน — เบิกได้" : "ปิดใช้งาน — ซ่อนจากรายการเบิก"}</Typography>
                  <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>เปลี่ยนยอดใช้ปุ่ม “รับเข้า” หรือ “ตรวจนับ” — ทุกครั้งบันทึกในประวัติ</Typography>
                </Box>
                <Switch checked={f.active} onChange={(e) => set({ active: e.target.checked })} />
              </Stack>
            )}
          </Box>
        </Box>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5, borderTop: `1px solid ${BORDER_MAIN}` }}>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: "none", color: TEXT_SUB, fontWeight: 700 }}>ยกเลิก</Button>
        <Button variant="contained" onClick={save} disabled={busy} startIcon={busy ? <CircularProgress size={15} color="inherit" /> : null} sx={BTN}>
          {editing ? "บันทึก" : "เพิ่มเข้าคลัง"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const Box3 = ({ label, value, color }) => (
  <Box sx={{ flex: 1, textAlign: "center", py: 1.1, borderRadius: 2.5, bgcolor: "#f8fafc", border: `1px solid ${BORDER_MAIN}` }}>
    <Typography sx={{ color: TEXT_SUB, fontWeight: 700, fontSize: "0.74rem" }}>{label}</Typography>
    <Typography sx={{ fontWeight: 900, fontSize: "1.2rem", color: color || TEXT_MAIN }}>{value}</Typography>
  </Box>
);

/** mode: "in" = รับเข้า · "count" = ตรวจนับ (กรอกยอดที่นับได้จริง) */
export function AdjustDialog({ open, item, mode, onClose, onSaved }) {
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (open) { setQty(mode === "count" ? String(item?.qty ?? "") : ""); setNote(""); setError(""); } }, [open, mode, item]);
  if (!item) return null;
  const n = Math.floor(Number(qty));
  const valid = qty !== "" && Number.isFinite(n) && (mode === "in" ? n > 0 : n >= 0);
  const after = mode === "in" ? item.qty + (valid ? n : 0) : valid ? n : item.qty;
  const diff = after - item.qty;

  const save = async () => {
    setBusy(true); setError("");
    try {
      onSaved(await StockService.adjust(item._id, mode, n, note), mode);
    } catch (err) {
      setError(errorText(err, "บันทึกไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} fullWidth maxWidth="xs">
      <DialogHead title={mode === "in" ? "รับเข้าคลัง" : "ตรวจนับ / ปรับยอด"} onClose={onClose} busy={busy} />
      <DialogContent sx={{ pt: "16px !important" }}>
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
          <Thumb item={item} size={48} />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, color: TEXT_MAIN }} noWrap>{item.name}</Typography>
            <Typography sx={{ fontSize: "0.76rem", color: TEXT_SUB }}>{item.code} · เบิกได้ {fmt(available(item))} {item.unit}{item.reserved ? ` · จองไว้ ${fmt(item.reserved)}` : ""}</Typography>
          </Box>
        </Stack>
        <Label required hint={mode === "count" ? "นับเฉพาะของที่อยู่ในคลัง ไม่รวมที่ยืมออก" : ""}>{mode === "in" ? "จำนวนที่รับเข้า" : "ยอดที่นับได้จริง"}</Label>
        <TextField autoFocus fullWidth type="number" sx={FIELD_SX} value={qty} onChange={(e) => setQty(e.target.value)}
          inputProps={{ min: 0, inputMode: "numeric", style: { fontSize: "1.2rem", fontWeight: 800 } }}
          InputProps={{ endAdornment: <InputAdornment position="end">{item.unit}</InputAdornment> }} />
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          <Box3 label="ก่อน" value={fmt(item.qty)} />
          <Box3 label={mode === "in" ? "เพิ่ม" : "ผลต่าง"} value={`${diff > 0 ? "+" : ""}${fmt(diff)}`} color={diff > 0 ? "#16a34a" : diff < 0 ? "#dc2626" : TEXT_SUB} />
          <Box3 label="หลัง" value={fmt(after)} />
        </Stack>
        <Box sx={{ mt: 2 }}>
          <Label>หมายเหตุ</Label>
          <TextField fullWidth size="small" sx={FIELD_SX} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder={mode === "in" ? "เช่น ซื้อตาม PR-00012" : "เช่น ตรวจนับประจำเดือน"} />
        </Box>
        {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5, borderTop: `1px solid ${BORDER_MAIN}` }}>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: "none", color: TEXT_SUB, fontWeight: 700 }}>ยกเลิก</Button>
        <Button variant="contained" onClick={save} disabled={busy || !valid || (mode === "count" && diff === 0)} sx={BTN}
          startIcon={busy ? <CircularProgress size={15} color="inherit" /> : null}>บันทึก</Button>
      </DialogActions>
    </Dialog>
  );
}
