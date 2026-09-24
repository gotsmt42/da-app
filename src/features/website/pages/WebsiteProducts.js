import { useEffect, useMemo, useRef, useState } from "react";
import {
  Autocomplete, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  IconButton, InputAdornment, MenuItem, Skeleton, Stack, Switch, TextField, Tooltip, Typography, useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Add, Close, DeleteOutline, Edit, ImageNotSupported, PictureAsPdf, Search, Star, UploadFile } from "@mui/icons-material";

import ImageManager from "../components/ImageManager";
import { SpecsEditor, cleanSpecs } from "../components/ListEditors";
import { ConfirmDialog, EmptyBox, FieldLabel, StatusChip, UI, WebPageHeader, cardSx, useFeedback } from "../components/WebsiteUi";
import WebsiteService, { errorText } from "../services/WebsiteService";
import { PRODUCT_CATEGORIES } from "../utils/webContent";

/**
 * หลังบ้าน: สินค้าบนเว็บไซต์ (/products)
 *
 * ✅ บริษัทสั่ง "สินค้าต้องมีรูปภาพ" — เผยแพร่ไม่ได้จนกว่าจะมีรูปอย่างน้อย 1 รูป
 *    (บอกตั้งแต่ในฟอร์ม ไม่ต้องรอ server ปฏิเสธ · server ก็กันซ้ำอีกชั้น)
 * ⚠️ ไม่มีช่องราคาโดยตั้งใจ — ดูเหตุผลที่ da-app-server/src/models/WebProduct.js
 */

const EMPTY = { category: "fire-alarm", type: "", name: "", brand: "", model: "", description: "", specs: [], images: [], datasheet: null, status: "draft", featured: false, order: 0 };
const catLabel = (v) => PRODUCT_CATEGORIES.find((c) => c.value === v)?.label || v;

export default function WebsiteProducts() {
  const fb = useFeedback();
  const [items, setItems] = useState(null);
  const [brands, setBrands] = useState([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [p, b] = await Promise.all([WebsiteService.list("products"), WebsiteService.list("brands")]);
      setItems(p);
      setBrands(b.map((x) => x.name));
    } catch (err) {
      setItems([]);
      fb.fail(errorText(err, "โหลดรายการสินค้าไม่สำเร็จ"));
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (items || []).filter((p) =>
      (cat === "all" || p.category === cat) &&
      (status === "all" || p.status === status) &&
      (!s || [p.name, p.brand, p.model, p.type].some((f) => String(f || "").toLowerCase().includes(s))));
  }, [items, q, cat, status]);

  const counts = useMemo(() => ({
    published: (items || []).filter((p) => p.status === "published").length,
    draft: (items || []).filter((p) => p.status !== "published").length,
    noImage: (items || []).filter((p) => !(p.images || []).length).length,
  }), [items]);

  const save = async (form) => {
    setBusy(true);
    try {
      const body = { ...form, specs: cleanSpecs(form.specs), datasheet: form.datasheet || {} };
      const saved = form._id ? await WebsiteService.update("products", form._id, body) : await WebsiteService.create("products", body);
      setItems((list) => (form._id ? list.map((x) => (x._id === saved._id ? saved : x)) : [saved, ...list]));
      setEditing(null);
      fb.ok(saved.status === "published" ? "บันทึกแล้ว — ขึ้นเว็บไซต์เรียบร้อย" : "บันทึกเป็นฉบับร่างแล้ว (ยังไม่ขึ้นเว็บ)");
    } catch (err) {
      fb.fail(errorText(err, "บันทึกสินค้าไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await WebsiteService.remove("products", deleting._id);
      setItems((list) => list.filter((x) => x._id !== deleting._id));
      setDeleting(null);
      fb.ok("ลบสินค้าแล้ว");
    } catch (err) {
      fb.fail(errorText(err, "ลบไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 1.5, sm: 2, md: 3 }, py: { xs: 2, sm: 3 } }}>
      <WebPageHeader
        title="สินค้าบนเว็บไซต์"
        subtitle="เพิ่ม แก้ไข รูปภาพ และข้อมูลจำเพาะของสินค้าที่แสดงบนหน้า “สินค้า” ของเว็บไซต์บริษัท"
        sitePath="/products"
        actions={<Button variant="contained" startIcon={<Add />} onClick={() => setEditing({ ...EMPTY })}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, bgcolor: UI.accent, "&:hover": { bgcolor: "#b91c1c" } }}>เพิ่มสินค้า</Button>}
      />
      {fb.node}

      {/* สรุปสั้น — บอกทันทีว่ามีอะไรค้างให้ทำ (ร่างที่ยังไม่มีรูป = ยังขึ้นเว็บไม่ได้) */}
      {items && items.length > 0 && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          <Chip label={`เผยแพร่ ${counts.published}`} sx={{ fontWeight: 700, bgcolor: "#dcfce7", color: "#166534" }} />
          <Chip label={`ฉบับร่าง ${counts.draft}`} sx={{ fontWeight: 700 }} />
          {counts.noImage > 0 && (
            <Chip icon={<ImageNotSupported sx={{ fontSize: 16 }} />} label={`ยังไม่มีรูป ${counts.noImage} รายการ — เพิ่มรูปก่อนเผยแพร่`}
              onClick={() => { setStatus("draft"); setCat("all"); }} sx={{ fontWeight: 700, bgcolor: "#fef2f2", color: "#b91c1c" }} />
          )}
        </Stack>
      )}

      <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} sx={{ mb: 2 }}>
        <TextField value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ ยี่ห้อ รุ่น" size="small" fullWidth
          InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18 }} /></InputAdornment> }} />
        <TextField select size="small" value={cat} onChange={(e) => setCat(e.target.value)} sx={{ minWidth: 180 }} label="หมวด">
          <MenuItem value="all">ทุกหมวด</MenuItem>
          {PRODUCT_CATEGORIES.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 160 }} label="สถานะ">
          <MenuItem value="all">ทุกสถานะ</MenuItem>
          <MenuItem value="published">เผยแพร่</MenuItem>
          <MenuItem value="draft">ฉบับร่าง</MenuItem>
        </TextField>
      </Stack>

      {items === null ? (
        <Stack spacing={1}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={84} />)}</Stack>
      ) : items.length === 0 ? (
        <EmptyBox title="ยังไม่มีสินค้า" detail="เพิ่มสินค้าพร้อมรูปภาพและข้อมูลจำเพาะ แล้วกดเผยแพร่เพื่อแสดงบนเว็บไซต์" />
      ) : shown.length === 0 ? (
        <EmptyBox title="ไม่พบสินค้าที่ตรงกับตัวกรอง" detail="ลองเปลี่ยนคำค้นหรือล้างตัวกรอง" />
      ) : (
        <Stack spacing={1}>
          {shown.map((p) => (
            <Box key={p._id} sx={{ ...cardSx, p: 1.25, display: "flex", gap: 1.5, alignItems: "center" }}>
              <Box sx={{ width: 72, height: 58, flexShrink: 0, borderRadius: 1.5, border: `1px solid ${UI.border}`, bgcolor: UI.soft, display: "grid", placeItems: "center", overflow: "hidden" }}>
                {p.images?.[0]
                  ? <Box component="img" src={p.images[0].url} alt="" loading="lazy" sx={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  : <Tooltip title="ยังไม่มีรูป — เผยแพร่ไม่ได้"><ImageNotSupported sx={{ color: "#fca5a5" }} /></Tooltip>}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography sx={{ fontWeight: 800, fontSize: "0.95rem" }} noWrap>{p.name}</Typography>
                  <StatusChip status={p.status} />
                  {p.featured && <Tooltip title="สินค้าแนะนำ — ขึ้นก่อน"><Star sx={{ fontSize: 17, color: "#f59e0b" }} /></Tooltip>}
                </Stack>
                <Typography sx={{ color: UI.sub, fontSize: "0.82rem" }} noWrap>
                  {catLabel(p.category)} · {p.type} · <b>{p.brand}</b>{p.model ? ` · รุ่น ${p.model}` : ""} · {p.images?.length || 0} รูป
                </Typography>
              </Box>
              <Tooltip title="แก้ไข"><IconButton onClick={() => setEditing({ ...EMPTY, ...p })} aria-label={`แก้ไข ${p.name}`}><Edit sx={{ fontSize: 19 }} /></IconButton></Tooltip>
              <Tooltip title="ลบ"><IconButton color="error" onClick={() => setDeleting(p)} aria-label={`ลบ ${p.name}`}><DeleteOutline sx={{ fontSize: 19 }} /></IconButton></Tooltip>
            </Box>
          ))}
        </Stack>
      )}

      {editing && <ProductEditor initial={editing} brands={brands} busy={busy} onCancel={() => setEditing(null)} onSave={save} onError={fb.fail} />}
      <ConfirmDialog
        open={Boolean(deleting)} busy={busy} onCancel={() => setDeleting(null)} onConfirm={remove}
        title={`ลบ "${deleting?.name || ""}"?`}
        detail="สินค้านี้และรูปทั้งหมดของสินค้าจะถูกลบถาวร และหายจากเว็บไซต์ทันที — ถ้าแค่อยากซ่อนชั่วคราว ให้เปลี่ยนเป็นฉบับร่างแทน"
      />
    </Box>
  );
}

function ProductEditor({ initial, brands, busy, onCancel, onSave, onError }) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [f, setF] = useState(initial);
  const [pdfBusy, setPdfBusy] = useState(false);
  const pdfRef = useRef(null);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const hasImage = (f.images || []).length > 0;
  const missing = [!f.name.trim() && "ชื่อสินค้า", !f.type.trim() && "ประเภท", !f.brand.trim() && "ยี่ห้อ", !f.description.trim() && "คำอธิบาย"].filter(Boolean);

  const uploadPdf = async (file) => {
    if (!file) return;
    if (file.type !== "application/pdf") return onError("Datasheet ต้องเป็นไฟล์ PDF");
    setPdfBusy(true);
    try {
      const r = await WebsiteService.upload(file);
      setF((x) => ({ ...x, datasheet: { url: r.url, publicId: r.publicId, name: r.name, bytes: r.bytes } }));
    } catch (err) {
      onError(errorText(err, "อัปโหลด PDF ไม่สำเร็จ"));
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <Dialog open fullScreen={mobile} maxWidth="md" fullWidth onClose={busy ? undefined : onCancel} scroll="paper">
      <DialogTitle sx={{ fontWeight: 800, display: "flex", alignItems: "center", pr: 1 }}>
        <Box sx={{ flex: 1 }}>{initial._id ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}</Box>
        <IconButton onClick={onCancel} disabled={busy} aria-label="ปิด"><Close /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <ImageManager value={f.images} onChange={set("images")} onError={onError} label="รูปสินค้า (ต้องมีอย่างน้อย 1 รูปจึงจะเผยแพร่ได้)" />

          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
            <Box>
              <FieldLabel required>หมวดสินค้า</FieldLabel>
              <TextField select size="small" fullWidth SelectProps={{ SelectDisplayProps: { "aria-label": "หมวดสินค้า" } }} value={f.category} onChange={(e) => set("category")(e.target.value)}>
                {PRODUCT_CATEGORIES.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
              </TextField>
            </Box>
            <Box>
              <FieldLabel required htmlFor="p-type" hint="ใช้เป็นตัวกรองบนเว็บ เช่น ตู้ควบคุม · อุปกรณ์ตรวจจับ">ประเภท</FieldLabel>
              <TextField id="p-type" size="small" fullWidth value={f.type} onChange={(e) => set("type")(e.target.value)} inputProps={{ maxLength: 80 }} />
            </Box>
            <Box>
              <FieldLabel required htmlFor="p-brand" hint="เลือกจากรายชื่อยี่ห้อ หรือพิมพ์ใหม่">ยี่ห้อ</FieldLabel>
              <Autocomplete id="p-brand" freeSolo options={brands} value={f.brand} onInputChange={(_, v) => set("brand")(v)}
                renderInput={(p) => <TextField {...p} size="small" inputProps={{ ...p.inputProps, maxLength: 80 }} />} />
            </Box>
            <Box>
              <FieldLabel htmlFor="p-model" hint="รุ่นจริงตามแค็ตตาล็อกผู้ผลิต — ว่างได้">รุ่น</FieldLabel>
              <TextField id="p-model" size="small" fullWidth value={f.model} onChange={(e) => set("model")(e.target.value)} inputProps={{ maxLength: 120 }} />
            </Box>
          </Box>

          <Box>
            <FieldLabel required htmlFor="p-name">ชื่อสินค้า</FieldLabel>
            <TextField id="p-name" size="small" fullWidth value={f.name} onChange={(e) => set("name")(e.target.value)} inputProps={{ maxLength: 200 }}
              placeholder="เช่น ตู้ควบคุมระบบแจ้งเหตุเพลิงไหม้แบบระบุตำแหน่ง" />
          </Box>
          <Box>
            <FieldLabel required hint="บอกว่าเหมาะกับงานแบบไหน — ลูกค้าอ่านตรงนี้ก่อนตัดสินใจขอราคา" htmlFor="p-desc">คำอธิบาย</FieldLabel>
            <TextField id="p-desc" size="small" fullWidth multiline minRows={3} value={f.description} onChange={(e) => set("description")(e.target.value)} inputProps={{ maxLength: 1500 }} />
          </Box>

          <Box>
            <FieldLabel hint="แสดงเป็นตารางบนการ์ดสินค้า">ข้อมูลจำเพาะ</FieldLabel>
            <SpecsEditor value={f.specs} onChange={set("specs")} />
          </Box>

          <Box>
            <FieldLabel hint="เอกสารจากผู้ผลิต (PDF) — ขึ้นเป็นปุ่ม Datasheet บนการ์ด">Datasheet</FieldLabel>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              {f.datasheet?.url ? (
                <Chip icon={<PictureAsPdf />} label={f.datasheet.name || "datasheet.pdf"} onDelete={() => set("datasheet")(null)}
                  component="a" href={f.datasheet.url} target="_blank" rel="noopener noreferrer" clickable sx={{ fontWeight: 600 }} />
              ) : (
                <Button size="small" variant="outlined" color="inherit" startIcon={pdfBusy ? <CircularProgress size={14} /> : <UploadFile />}
                  disabled={pdfBusy} onClick={() => pdfRef.current?.click()} sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, borderColor: UI.border }}>
                  {pdfBusy ? "กำลังอัปโหลด…" : "อัปโหลด PDF"}
                </Button>
              )}
              <input ref={pdfRef} type="file" hidden accept="application/pdf" onChange={(e) => { uploadPdf(e.target.files?.[0]); e.target.value = ""; }} />
            </Stack>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
            <FormControlLabel control={<Switch checked={Boolean(f.featured)} onChange={(e) => set("featured")(e.target.checked)} />}
              label={<Typography sx={{ fontSize: "0.9rem" }}>สินค้าแนะนำ (ขึ้นก่อนในรายการ)</Typography>} />
            <TextField size="small" type="number" label="ลำดับ (น้อยขึ้นก่อน)" value={f.order} onChange={(e) => set("order")(Number(e.target.value) || 0)} sx={{ width: 180 }} />
          </Stack>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5, gap: 1, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          {missing.length > 0 && <Typography sx={{ color: UI.sub, fontSize: "0.8rem" }}>ยังไม่ได้กรอก: {missing.join(" · ")}</Typography>}
          {missing.length === 0 && !hasImage && <Typography sx={{ color: "#b91c1c", fontSize: "0.8rem", fontWeight: 600 }}>เพิ่มรูปอย่างน้อย 1 รูปเพื่อเผยแพร่ — ตอนนี้บันทึกเป็นฉบับร่างได้</Typography>}
        </Box>
        <Button onClick={() => onSave({ ...f, status: "draft" })} disabled={busy || missing.length > 0} color="inherit"
          sx={{ textTransform: "none", fontWeight: 700 }}>
          บันทึกฉบับร่าง
        </Button>
        <Tooltip title={!hasImage ? "ต้องมีรูปอย่างน้อย 1 รูป" : ""}>
          <span>
            <Button onClick={() => onSave({ ...f, status: "published" })} disabled={busy || missing.length > 0 || !hasImage} variant="contained"
              startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}
              sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, bgcolor: UI.accent, "&:hover": { bgcolor: "#b91c1c" } }}>
              {f.status === "published" ? "บันทึก (เผยแพร่อยู่)" : "บันทึกและเผยแพร่"}
            </Button>
          </span>
        </Tooltip>
      </DialogActions>
    </Dialog>
  );
}
