import { useEffect, useMemo, useState } from "react";
import {
  Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  IconButton, InputAdornment, Skeleton, Stack, Switch, TextField, Tooltip, Typography, useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Add, Close, DeleteOutline, Edit, Search, Star } from "@mui/icons-material";

import ImageManager from "../components/ImageManager";
import { StringListEditor, cleanList } from "../components/ListEditors";
import { ConfirmDialog, EmptyBox, FieldLabel, StatusChip, UI, WebPageHeader, cardSx, useFeedback } from "../components/WebsiteUi";
import WebsiteService, { errorText } from "../services/WebsiteService";
import { SERVICES, SLUG_RE, serviceLabel, slugify, thaiShort } from "../utils/webContent";

/**
 * หลังบ้าน: ผลงานบนเว็บไซต์ (/projects)
 *
 * ⚠️ ผลงานต้องเป็นงานที่บริษัททำจริงเท่านั้น และชื่อลูกค้าต้องได้รับอนุญาตก่อน (เว้นว่างได้ —
 *    เว็บแสดง "ขอสงวนชื่อลูกค้า") ย้ำไว้ในฟอร์มด้วย
 * ⚠️ slug เปลี่ยนหลังเผยแพร่แล้ว = ลิงก์เดิมที่ Google/ลูกค้าเก็บไว้กลายเป็น 404 — เตือนตอนแก้
 */

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { slug: "", title: "", customer: "", location: "", systems: [], completedAt: today(), summary: "", scope: [], challenge: "", solution: "", result: "", images: [], status: "draft", featured: false };

export default function WebsiteProjects() {
  const fb = useFeedback();
  const [items, setItems] = useState(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    WebsiteService.list("projects").then(setItems).catch((err) => { setItems([]); fb.fail(errorText(err, "โหลดผลงานไม่สำเร็จ")); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (items || []).filter((p) => !s || [p.title, p.customer, p.location].some((x) => String(x || "").toLowerCase().includes(s)));
  }, [items, q]);

  const save = async (form) => {
    setBusy(true);
    try {
      const body = { ...form, scope: cleanList(form.scope) };
      const saved = form._id ? await WebsiteService.update("projects", form._id, body) : await WebsiteService.create("projects", body);
      setItems((list) => (form._id ? list.map((x) => (x._id === saved._id ? saved : x)) : [saved, ...list]));
      setEditing(null);
      fb.ok(saved.status === "published" ? "บันทึกแล้ว — ขึ้นเว็บไซต์เรียบร้อย" : "บันทึกเป็นฉบับร่างแล้ว (ยังไม่ขึ้นเว็บ)");
    } catch (err) {
      fb.fail(errorText(err, "บันทึกผลงานไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await WebsiteService.remove("projects", deleting._id);
      setItems((list) => list.filter((x) => x._id !== deleting._id));
      setDeleting(null);
      fb.ok("ลบผลงานแล้ว");
    } catch (err) {
      fb.fail(errorText(err, "ลบไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 1.5, sm: 2, md: 3 }, py: { xs: 2, sm: 3 } }}>
      <WebPageHeader
        title="ผลงานบนเว็บไซต์"
        subtitle="โครงการที่ส่งมอบแล้ว — โจทย์หน้างาน แนวทางแก้ และผลลัพธ์ พร้อมรูปหน้างาน"
        sitePath="/projects"
        actions={<Button variant="contained" startIcon={<Add />} onClick={() => setEditing({ ...EMPTY })}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, bgcolor: UI.accent, "&:hover": { bgcolor: "#b91c1c" } }}>เพิ่มผลงาน</Button>}
      />
      {fb.node}
      <TextField value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อโครงการ ลูกค้า สถานที่" size="small" fullWidth sx={{ mb: 2 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18 }} /></InputAdornment> }} />

      {items === null ? (
        <Stack spacing={1}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={84} />)}</Stack>
      ) : items.length === 0 ? (
        <EmptyBox title="ยังไม่มีผลงาน" detail="เว็บไซต์จะแสดง “กำลังรวบรวมผลงาน” จนกว่าจะมีผลงานที่เผยแพร่ — เพิ่มโครงการจริงที่ส่งมอบแล้ว พร้อมรูปหน้างาน"
          action={<Button variant="outlined" startIcon={<Add />} onClick={() => setEditing({ ...EMPTY })} sx={{ textTransform: "none", fontWeight: 700 }}>เพิ่มผลงานแรก</Button>} />
      ) : (
        <Stack spacing={1}>
          {shown.map((p) => (
            <Box key={p._id} sx={{ ...cardSx, p: 1.25, display: "flex", gap: 1.5, alignItems: "center" }}>
              <Box sx={{ width: 88, height: 58, flexShrink: 0, borderRadius: 1.5, bgcolor: UI.soft, overflow: "hidden", border: `1px solid ${UI.border}` }}>
                {p.images?.[0] && <Box component="img" src={p.images[0].url} alt="" loading="lazy" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography sx={{ fontWeight: 800, fontSize: "0.95rem" }} noWrap>{p.title}</Typography>
                  <StatusChip status={p.status} />
                  {p.featured && <Star sx={{ fontSize: 17, color: "#f59e0b" }} />}
                </Stack>
                <Typography sx={{ color: UI.sub, fontSize: "0.82rem" }} noWrap>
                  {p.location} · ส่งมอบ {thaiShort(p.completedAt)} · {(p.systems || []).map(serviceLabel).join(", ")} · {p.images?.length || 0} รูป
                </Typography>
              </Box>
              <Tooltip title="แก้ไข"><IconButton onClick={() => setEditing({ ...EMPTY, ...p, completedAt: String(p.completedAt || "").slice(0, 10) })} aria-label={`แก้ไข ${p.title}`}><Edit sx={{ fontSize: 19 }} /></IconButton></Tooltip>
              <Tooltip title="ลบ"><IconButton color="error" onClick={() => setDeleting(p)} aria-label={`ลบ ${p.title}`}><DeleteOutline sx={{ fontSize: 19 }} /></IconButton></Tooltip>
            </Box>
          ))}
        </Stack>
      )}

      {editing && <ProjectEditor initial={editing} busy={busy} onCancel={() => setEditing(null)} onSave={save} onError={fb.fail} />}
      <ConfirmDialog open={Boolean(deleting)} busy={busy} onCancel={() => setDeleting(null)} onConfirm={remove}
        title={`ลบผลงาน "${deleting?.title || ""}"?`}
        detail="ผลงานและรูปทั้งหมดจะถูกลบถาวร ลิงก์ของหน้านี้จะใช้ไม่ได้อีก — ถ้าแค่อยากซ่อน ให้เปลี่ยนเป็นฉบับร่างแทน" />
    </Box>
  );
}

function ProjectEditor({ initial, busy, onCancel, onSave, onError }) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [f, setF] = useState(initial);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const wasPublished = initial._id && initial.status === "published";
  const slugChanged = wasPublished && f.slug !== initial.slug;
  const slugOk = SLUG_RE.test(f.slug);
  const missing = [
    !f.title.trim() && "ชื่อโครงการ", !slugOk && "ลิงก์ (slug)", !f.location.trim() && "สถานที่",
    !f.systems.length && "ระบบ", !f.completedAt && "วันที่ส่งมอบ", !f.summary.trim() && "สรุปย่อ",
  ].filter(Boolean);
  const toggleSystem = (v) => set("systems")(f.systems.includes(v) ? f.systems.filter((x) => x !== v) : [...f.systems, v]);

  return (
    <Dialog open fullScreen={mobile} maxWidth="md" fullWidth onClose={busy ? undefined : onCancel} scroll="paper">
      <DialogTitle sx={{ fontWeight: 800, display: "flex", alignItems: "center", pr: 1 }}>
        <Box sx={{ flex: 1 }}>{initial._id ? "แก้ไขผลงาน" : "เพิ่มผลงาน"}</Box>
        <IconButton onClick={onCancel} disabled={busy} aria-label="ปิด"><Close /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <ImageManager value={f.images} onChange={set("images")} onError={onError} max={24} label="รูปหน้างาน" />

          <Box>
            <FieldLabel required htmlFor="pj-title">ชื่อโครงการ</FieldLabel>
            <TextField id="pj-title" size="small" fullWidth value={f.title} inputProps={{ maxLength: 200 }}
              onChange={(e) => { const t = e.target.value; setF((x) => ({ ...x, title: t, slug: x._id || x.slugTouched ? x.slug : slugify(t) })); }}
              placeholder="เช่น ปรับปรุงระบบแจ้งเหตุเพลิงไหม้ อาคารสำนักงาน 8 ชั้น" />
          </Box>
          <Box>
            <FieldLabel required hint="ส่วนท้ายของลิงก์ ภาษาอังกฤษตัวเล็ก ตัวเลข และขีด (-) เท่านั้น เช่น office-fire-alarm-2569" htmlFor="pj-slug">ลิงก์ (slug)</FieldLabel>
            <TextField id="pj-slug" size="small" fullWidth value={f.slug} inputProps={{ maxLength: 120 }}
              onChange={(e) => setF((x) => ({ ...x, slug: e.target.value.toLowerCase().replace(/\s+/g, "-"), slugTouched: true }))}
              error={Boolean(f.slug) && !slugOk}
              helperText={
                slugChanged ? "⚠️ ผลงานนี้เผยแพร่แล้ว — เปลี่ยนลิงก์แล้วลิงก์เดิมที่เคยแชร์ไปจะใช้ไม่ได้"
                  : f.slug && !slugOk ? "ใช้ได้เฉพาะ a-z 0-9 และขีด (-) ห้ามขึ้นต้น/ลงท้ายด้วยขีด"
                    : f.slug ? `ลิงก์: /projects/${f.slug}` : "ชื่อภาษาไทยสร้างลิงก์ให้อัตโนมัติไม่ได้ — กรุณาพิมพ์เอง"
              }
              FormHelperTextProps={{ sx: { color: slugChanged ? "#b45309" : undefined, fontWeight: slugChanged ? 700 : 400 } }} />
          </Box>

          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 180px" } }}>
            <Box>
              <FieldLabel hint="ต้องได้รับอนุญาตจากลูกค้าก่อน — ว่างไว้ = “ขอสงวนชื่อลูกค้า”" htmlFor="pj-customer">ลูกค้า</FieldLabel>
              <TextField id="pj-customer" size="small" fullWidth value={f.customer} onChange={(e) => set("customer")(e.target.value)} inputProps={{ maxLength: 200 }} />
            </Box>
            <Box>
              <FieldLabel required htmlFor="pj-location">สถานที่</FieldLabel>
              <TextField id="pj-location" size="small" fullWidth value={f.location} onChange={(e) => set("location")(e.target.value)} inputProps={{ maxLength: 150 }} placeholder="เช่น จังหวัดนนทบุรี" />
            </Box>
            <Box>
              <FieldLabel required htmlFor="pj-date">วันที่ส่งมอบ</FieldLabel>
              <TextField id="pj-date" size="small" fullWidth type="date" value={f.completedAt} onChange={(e) => set("completedAt")(e.target.value)} />
            </Box>
          </Box>

          <Box>
            <FieldLabel required hint="ใช้เป็นตัวกรองบนหน้าผลงาน และลิงก์ไปหน้าบริการ">ระบบที่ทำ</FieldLabel>
            <Stack direction="row" flexWrap="wrap" useFlexGap sx={{ columnGap: 1 }}>
              {SERVICES.map((s) => (
                <FormControlLabel key={s.value} control={<Checkbox size="small" checked={f.systems.includes(s.value)} onChange={() => toggleSystem(s.value)} />}
                  label={<Typography sx={{ fontSize: "0.88rem" }}>{s.label}</Typography>} />
              ))}
            </Stack>
          </Box>

          <Box>
            <FieldLabel required hint="1–2 ประโยค แสดงบนการ์ดผลงาน" htmlFor="pj-summary">สรุปย่อ</FieldLabel>
            <TextField id="pj-summary" size="small" fullWidth multiline minRows={2} value={f.summary} onChange={(e) => set("summary")(e.target.value)} inputProps={{ maxLength: 500 }} />
          </Box>
          <Box>
            <FieldLabel hint="สิ่งที่ทำในโครงการนี้ ทีละข้อ">ขอบเขตงาน</FieldLabel>
            <StringListEditor value={f.scope} onChange={set("scope")} placeholder="เช่น เปลี่ยนตู้ควบคุมเป็นระบบระบุตำแหน่ง" addText="เพิ่มขอบเขตงาน" itemLabel="ขอบเขตงาน" />
          </Box>
          {[
            ["challenge", "โจทย์และปัญหาหน้างาน", "สภาพเดิม/ข้อจำกัดที่ต้องแก้ — ส่วนที่ทำให้ผลงานน่าเชื่อถือกว่ารูปอย่างเดียว"],
            ["solution", "แนวทางที่เลือกใช้", "เลือกทำแบบนี้เพราะอะไร"],
            ["result", "ผลลัพธ์", "ได้อะไรหลังส่งมอบ วัดได้ยิ่งดี"],
          ].map(([k, label, hint]) => (
            <Box key={k}>
              <FieldLabel hint={hint} htmlFor={`pj-${k}`}>{label}</FieldLabel>
              <TextField id={`pj-${k}`} size="small" fullWidth multiline minRows={3} value={f[k]} onChange={(e) => set(k)(e.target.value)} inputProps={{ maxLength: 3000 }} />
            </Box>
          ))}

          <FormControlLabel control={<Switch checked={Boolean(f.featured)} onChange={(e) => set("featured")(e.target.checked)} />}
            label={<Typography sx={{ fontSize: "0.9rem" }}>ผลงานเด่น (แสดงบนหน้าแรก)</Typography>} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5, gap: 1, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          {missing.length > 0 && <Typography sx={{ color: UI.sub, fontSize: "0.8rem" }}>ยังไม่ได้กรอก: {missing.join(" · ")}</Typography>}
        </Box>
        <Button onClick={() => onSave({ ...f, status: "draft" })} disabled={busy || missing.length > 0} color="inherit" sx={{ textTransform: "none", fontWeight: 700 }}>บันทึกฉบับร่าง</Button>
        <Button onClick={() => onSave({ ...f, status: "published" })} disabled={busy || missing.length > 0} variant="contained"
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, bgcolor: UI.accent, "&:hover": { bgcolor: "#b91c1c" } }}>
          {f.status === "published" ? "บันทึก (เผยแพร่อยู่)" : "บันทึกและเผยแพร่"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
