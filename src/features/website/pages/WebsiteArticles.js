import { useEffect, useState } from "react";
import {
  Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem,
  Skeleton, Stack, TextField, Tooltip, Typography, useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Add, Close, DeleteOutline, Edit } from "@mui/icons-material";

import ArticleBlockEditor from "../components/ArticleBlockEditor";
import ImageManager from "../components/ImageManager";
import { StringListEditor, cleanList } from "../components/ListEditors";
import { ConfirmDialog, EmptyBox, FieldLabel, StatusChip, UI, WebPageHeader, cardSx, useFeedback } from "../components/WebsiteUi";
import WebsiteService, { errorText } from "../services/WebsiteService";
import { SERVICES, SLUG_RE, slugify, thaiShort } from "../utils/webContent";

/**
 * หลังบ้าน: บทความบนเว็บไซต์ (/articles)
 * ⚠️ บทความคือช่องทางที่ดึงคนจาก Google มาได้มากที่สุดในระยะยาว — ช่อง "คำอธิบาย" คือข้อความที่ขึ้น
 *    ใต้ชื่อในผลค้นหา จึงบังคับกรอกและบอกความยาวที่เหมาะไว้
 * ⚠️ ถ้าอ้างกฎหมาย/มาตรฐาน ให้วิศวกรตรวจก่อนเผยแพร่เสมอ (บทความผิดคือความเสี่ยงของบริษัท)
 */

const EMPTY = { slug: "", title: "", description: "", category: "Fire Alarm", relatedService: "fire-alarm", keywords: [], cover: null, body: [{ type: "p", text: "" }], status: "draft" };

/** บล็อกว่างไม่ส่งขึ้น server — ผู้ใช้กดเพิ่มเผื่อแล้วไม่ได้พิมพ์ ต้องไม่กลายเป็นช่องว่างบนเว็บ */
const cleanBody = (body) =>
  (body || [])
    .map((b) => {
      if (b.type === "list") return { type: "list", items: cleanList(b.items) };
      if (b.type === "table") return { type: "table", head: b.head.map((h) => h.trim()), rows: b.rows.filter((r) => r.some((c) => c.trim())) };
      // ⚠️ บล็อกรูปไม่มีช่อง text — ถ้าเผลอส่งผ่านสาขาข้างล่างจะกลายเป็น text ว่างแล้วโดนตัดทิ้งทั้งบล็อก
      if (b.type === "image") return { type: "image", image: b.image || null, caption: String(b.caption || "").trim() };
      return { type: b.type, text: String(b.text || "").trim() };
    })
    .filter((b) => (b.type === "list" ? b.items.length : b.type === "table" ? b.rows.length : b.type === "image" ? b.image?.url : b.text));

export default function WebsiteArticles() {
  const fb = useFeedback();
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    WebsiteService.list("articles").then(setItems).catch((err) => { setItems([]); fb.fail(errorText(err, "โหลดบทความไม่สำเร็จ")); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (form) => {
    setBusy(true);
    try {
      const body = { ...form, keywords: cleanList(form.keywords), body: cleanBody(form.body), cover: form.cover || null };
      // ⚠️ ต้องส่ง null ตรงๆ ตอนเอารูปปกออก — undefined จะหายไปตอนแปลงเป็น JSON แล้ว server ไม่รู้ว่าต้องลบ
      const saved = form._id ? await WebsiteService.update("articles", form._id, body) : await WebsiteService.create("articles", body);
      setItems((list) => (form._id ? list.map((x) => (x._id === saved._id ? saved : x)) : [saved, ...list]));
      setEditing(null);
      fb.ok(saved.status === "published" ? "บันทึกแล้ว — ขึ้นเว็บไซต์เรียบร้อย" : "บันทึกเป็นฉบับร่างแล้ว (ยังไม่ขึ้นเว็บ)");
    } catch (err) {
      fb.fail(errorText(err, "บันทึกบทความไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await WebsiteService.remove("articles", deleting._id);
      setItems((list) => list.filter((x) => x._id !== deleting._id));
      setDeleting(null);
      fb.ok("ลบบทความแล้ว");
    } catch (err) {
      fb.fail(errorText(err, "ลบไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 1.5, sm: 2, md: 3 }, py: { xs: 2, sm: 3 } }}>
      <WebPageHeader title="บทความบนเว็บไซต์" subtitle="ความรู้งานระบบสำหรับเจ้าของอาคาร — ช่วยให้ลูกค้าค้นเจอบริษัทผ่าน Google" sitePath="/articles"
        actions={<Button variant="contained" startIcon={<Add />} onClick={() => setEditing({ ...EMPTY })}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, bgcolor: UI.accent, "&:hover": { bgcolor: "#b91c1c" } }}>เขียนบทความ</Button>} />
      {fb.node}
      {items === null ? (
        <Stack spacing={1}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={76} />)}</Stack>
      ) : items.length === 0 ? (
        <EmptyBox title="ยังไม่มีบทความ" detail="บทความที่ตอบคำถามที่ลูกค้าสงสัยจริง คือสิ่งที่ทำให้เว็บติดอันดับ Google ได้ในระยะยาว" />
      ) : (
        <Stack spacing={1}>
          {items.map((a) => (
            <Box key={a._id} sx={{ ...cardSx, p: 1.5, display: "flex", gap: 1.5, alignItems: "center" }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography sx={{ fontWeight: 800, fontSize: "0.95rem" }} noWrap>{a.title}</Typography>
                  <StatusChip status={a.status} />
                </Stack>
                <Typography sx={{ color: UI.sub, fontSize: "0.82rem" }} noWrap>
                  {a.category} · {a.publishedAt ? `เผยแพร่ ${thaiShort(a.publishedAt)}` : "ยังไม่เคยเผยแพร่"} · แก้ล่าสุด {thaiShort(a.updatedAt)}{a.updatedBy?.name ? ` โดย ${a.updatedBy.name}` : ""}
                </Typography>
              </Box>
              <Tooltip title="แก้ไข"><IconButton onClick={() => setEditing({ ...EMPTY, ...a, cover: a.cover || null })} aria-label={`แก้ไข ${a.title}`}><Edit sx={{ fontSize: 19 }} /></IconButton></Tooltip>
              <Tooltip title="ลบ"><IconButton color="error" onClick={() => setDeleting(a)} aria-label={`ลบ ${a.title}`}><DeleteOutline sx={{ fontSize: 19 }} /></IconButton></Tooltip>
            </Box>
          ))}
        </Stack>
      )}
      {editing && <ArticleEditor initial={editing} busy={busy} onCancel={() => setEditing(null)} onSave={save} onError={fb.fail} />}
      <ConfirmDialog open={Boolean(deleting)} busy={busy} onCancel={() => setDeleting(null)} onConfirm={remove}
        title={`ลบบทความ "${deleting?.title || ""}"?`} detail="บทความจะถูกลบถาวร ลิงก์ที่เคยแชร์หรือที่ Google เก็บไว้จะใช้ไม่ได้ — ถ้าแค่อยากซ่อน ให้เปลี่ยนเป็นฉบับร่างแทน" />
    </Box>
  );
}

function ArticleEditor({ initial, busy, onCancel, onSave, onError }) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [f, setF] = useState(initial);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const slugOk = SLUG_RE.test(f.slug);
  const slugChanged = initial._id && initial.status === "published" && f.slug !== initial.slug;
  const descLen = [...f.description].length;
  const missing = [!f.title.trim() && "ชื่อบทความ", !slugOk && "ลิงก์ (slug)", !f.description.trim() && "คำอธิบาย", !f.category.trim() && "หมวด", !cleanBody(f.body).length && "เนื้อหา"].filter(Boolean);

  return (
    <Dialog open fullScreen={mobile} maxWidth="md" fullWidth onClose={busy ? undefined : onCancel} scroll="paper">
      <DialogTitle sx={{ fontWeight: 800, display: "flex", alignItems: "center", pr: 1 }}>
        <Box sx={{ flex: 1 }}>{initial._id ? "แก้ไขบทความ" : "เขียนบทความ"}</Box>
        <IconButton onClick={onCancel} disabled={busy} aria-label="ปิด"><Close /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Box>
            <FieldLabel required hint="ใช้คำที่ลูกค้าพิมพ์ค้นหาจริง เช่น “Fire Alarm แบบไหนดี”" htmlFor="a-title">ชื่อบทความ</FieldLabel>
            <TextField id="a-title" size="small" fullWidth value={f.title} inputProps={{ maxLength: 200 }}
              onChange={(e) => { const t = e.target.value; setF((x) => ({ ...x, title: t, slug: x._id || x.slugTouched ? x.slug : slugify(t) })); }} />
          </Box>
          <Box>
            <FieldLabel required hint="ภาษาอังกฤษตัวเล็ก ตัวเลข และขีด (-) เช่น fire-alarm-pm-checklist" htmlFor="a-slug">ลิงก์ (slug)</FieldLabel>
            <TextField id="a-slug" size="small" fullWidth value={f.slug} inputProps={{ maxLength: 120 }}
              onChange={(e) => setF((x) => ({ ...x, slug: e.target.value.toLowerCase().replace(/\s+/g, "-"), slugTouched: true }))}
              error={Boolean(f.slug) && !slugOk}
              helperText={slugChanged ? "⚠️ บทความนี้เผยแพร่แล้ว — เปลี่ยนลิงก์แล้วลิงก์เดิมจะใช้ไม่ได้" : f.slug && !slugOk ? "ใช้ได้เฉพาะ a-z 0-9 และขีด (-)" : f.slug ? `ลิงก์: /articles/${f.slug}` : "ชื่อภาษาไทยสร้างลิงก์ให้อัตโนมัติไม่ได้ — กรุณาพิมพ์เอง"}
              FormHelperTextProps={{ sx: { color: slugChanged ? "#b45309" : undefined, fontWeight: slugChanged ? 700 : 400 } }} />
          </Box>
          <Box>
            <FieldLabel required hint="ข้อความที่ขึ้นใต้ชื่อบทความในผลค้นหา Google — เหมาะที่สุดราว 80–160 ตัวอักษร" htmlFor="a-desc">คำอธิบาย</FieldLabel>
            <TextField id="a-desc" size="small" fullWidth multiline minRows={2} value={f.description} onChange={(e) => set("description")(e.target.value)} inputProps={{ maxLength: 400 }}
              helperText={`${descLen} ตัวอักษร${descLen > 160 ? " — ยาวเกิน Google จะตัดท้าย" : descLen > 0 && descLen < 80 ? " — สั้นไปนิด" : ""}`} />
          </Box>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
            <Box>
              <FieldLabel required htmlFor="a-cat">หมวด</FieldLabel>
              <TextField id="a-cat" size="small" fullWidth value={f.category} onChange={(e) => set("category")(e.target.value)} inputProps={{ maxLength: 60 }} />
            </Box>
            <Box>
              <FieldLabel hint="ขึ้นเป็นกล่องแนะนำบริการข้างบทความ">บริการที่เกี่ยวข้อง</FieldLabel>
              <TextField select size="small" fullWidth SelectProps={{ SelectDisplayProps: { "aria-label": "บริการที่เกี่ยวข้อง" } }} value={f.relatedService} onChange={(e) => set("relatedService")(e.target.value)}>
                <MenuItem value="">ไม่ระบุ</MenuItem>
                {SERVICES.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </TextField>
            </Box>
          </Box>
          <ImageManager single value={f.cover ? [f.cover] : []} onChange={(arr) => set("cover")(arr[0] || null)} onError={onError} label="รูปปก (ไม่บังคับ) — ใช้ตอนแชร์ลิงก์" />
          <Box>
            <FieldLabel hint="คำที่อยากให้บทความนี้ติดผลค้นหา ทีละคำ">คำค้นหา</FieldLabel>
            <StringListEditor value={f.keywords} onChange={set("keywords")} placeholder="เช่น pm fire alarm" addText="เพิ่มคำค้น" max={15} maxLength={80} itemLabel="คำค้นหา" />
          </Box>
          <Box>
            <FieldLabel required>เนื้อหา</FieldLabel>
            <ArticleBlockEditor value={f.body} onChange={set("body")} onError={onError} />
          </Box>
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
