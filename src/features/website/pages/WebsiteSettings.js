import { useEffect, useRef, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box, Button, CircularProgress, FormControlLabel, IconButton, Link, MenuItem, Skeleton, Stack, Switch,
  TextField, Tooltip, Typography,
} from "@mui/material";
import {
  Add, AddPhotoAlternate, ArrowDownward, ArrowUpward, Close, HideImage, Save, Star, StarBorder, Visibility, VisibilityOff,
} from "@mui/icons-material";

import ImageManager from "../components/ImageManager";
import { StringListEditor, cleanList } from "../components/ListEditors";
import { ConfirmDialog, FieldLabel, UI, WebPageHeader, cardSx, useFeedback } from "../components/WebsiteUi";
import WebsiteService, { errorText } from "../services/WebsiteService";
import { SERVICES } from "../utils/webContent";

/**
 * หลังบ้าน: การแสดงผลของเว็บไซต์ + ยี่ห้อ
 *
 * ⚠️ ช่องทางติดต่อ (เบอร์ อีเมล LINE Facebook) ไม่ได้ตั้งที่นี่ — ใช้ชุดเดียวกับ "ตั้งค่าองค์กร"
 *    ที่แสดงบนหัวแอปอยู่แล้ว มีลิงก์พาไปให้ ไม่ทำช่องซ้ำสองที่ให้ข้อมูลไม่ตรงกัน
 * ⚠️ ตัวเลขบนหน้าแรกต้องพิสูจน์ได้ — ลูกค้า B2B ตรวจจริงตอนคัดผู้รับเหมา
 */

const SECTION_TOGGLES = [
  ["showStats", "ตัวเลขของบริษัท", "แถบตัวเลขใต้ส่วนหัวของหน้าแรก"],
  ["showProjects", "ผลงานบนหน้าแรก", "ซ่อนเองอัตโนมัติถ้ายังไม่มีผลงานที่เผยแพร่"],
  ["showBrands", "ยี่ห้อที่ติดตั้ง", "รายชื่อยี่ห้อท้ายหน้าแรก"],
  ["showArticles", "เมนูบทความ", "ปิดได้ช่วงที่ยังไม่มีบทความ — เมนูและ sitemap จะไม่มีบทความ"],
];

export default function WebsiteSettings() {
  const fb = useFeedback();
  const [s, setS] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    WebsiteService.getSettings().then(setS).catch((err) => fb.fail(errorText(err, "โหลดการตั้งค่าไม่สำเร็จ")));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (v) => { setS((x) => ({ ...x, [k]: v })); setDirty(true); };
  /** รูปของบริการ — เก็บเป็นรายการ {slug, image} · ไม่มีรูป = เอารายการนั้นออก (เว็บกลับไปใช้ภาพประกอบ) */
  const serviceImg = (slug) => (s.serviceImages || []).find((x) => x.slug === slug)?.image;
  const setServiceImg = (slug, image) =>
    set("serviceImages")([...(s.serviceImages || []).filter((x) => x.slug !== slug), ...(image ? [{ slug, image }] : [])]);
  const setStat = (i, k, v) => set("stats")(s.stats.map((st, j) => (j === i ? { ...st, [k]: v } : st)));

  const save = async () => {
    setSaving(true);
    try {
      const saved = await WebsiteService.saveSettings({
        ...s,
        serviceAreas: cleanList(s.serviceAreas),
        stats: s.stats.filter((st) => String(st.label).trim()).map((st) => ({ ...st, value: Number(st.value) || 0 })),
      });
      setS(saved);
      setDirty(false);
      fb.ok("บันทึกแล้ว — เว็บไซต์อัปเดตภายในไม่กี่วินาที");
    } catch (err) {
      fb.fail(errorText(err, "บันทึกไม่สำเร็จ"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto", px: { xs: 1.5, sm: 2, md: 3 }, py: { xs: 2, sm: 3 } }}>
      <WebPageHeader title="การแสดงผลเว็บไซต์" subtitle="ส่วนที่แสดงบนหน้าแรก ตัวเลขของบริษัท เวลาทำการ พื้นที่ให้บริการ และยี่ห้อ" sitePath="" />
      {fb.node}

      {!s ? <Skeleton variant="rounded" height={420} /> : (
        <Stack spacing={2}>
          <Box sx={cardSx}>
            <Typography sx={{ fontWeight: 800, mb: 0.5 }}>ช่องทางติดต่อบนเว็บไซต์</Typography>
            <Typography sx={{ color: UI.sub, fontSize: "0.88rem" }}>
              เบอร์โทร อีเมล LINE และ Facebook ใช้ชุดเดียวกับที่ตั้งไว้ใน{" "}
              <Link component={RouterLink} to="/settings/organization" sx={{ fontWeight: 700 }}>ตั้งค่าองค์กร</Link>
              {" "}— แก้ที่นั่นที่เดียว เว็บไซต์เปลี่ยนตามอัตโนมัติ ช่องทางที่เว้นว่างจะไม่แสดงบนเว็บ
            </Typography>
          </Box>

          <Box sx={cardSx}>
            <Typography sx={{ fontWeight: 800, mb: 1.5 }}>ส่วนที่แสดงบนเว็บ</Typography>
            <Stack spacing={0.5}>
              {SECTION_TOGGLES.map(([k, label, hint]) => (
                <FormControlLabel key={k} control={<Switch checked={Boolean(s[k])} onChange={(e) => set(k)(e.target.checked)} />}
                  label={<Box><Typography sx={{ fontWeight: 600, fontSize: "0.92rem" }}>{label}</Typography><Typography sx={{ color: UI.sub, fontSize: "0.78rem" }}>{hint}</Typography></Box>}
                  sx={{ alignItems: "flex-start", "& .MuiSwitch-root": { mt: -0.5 } }} />
              ))}
            </Stack>
          </Box>

          <Box sx={cardSx}>
            <Typography sx={{ fontWeight: 800 }}>ตัวเลขของบริษัท</Typography>
            <Typography sx={{ color: UI.sub, fontSize: "0.82rem", mb: 1.5 }}>
              ⚠️ ใส่เฉพาะตัวเลขที่ยืนยันได้จริง — ลบแถวที่ยังไม่มีข้อมูลยืนยันออกดีกว่าใส่เลขประมาณ
            </Typography>
            <Stack spacing={1.25}>
              {s.stats.map((st, i) => (
                <Stack key={i} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}
                  sx={{ p: { xs: 1, sm: 0 }, border: { xs: `1px solid ${UI.border}`, sm: "none" }, borderRadius: 2 }}>
                  <TextField size="small" type="number" label="ตัวเลข" value={st.value} onChange={(e) => setStat(i, "value", e.target.value)} sx={{ width: { sm: 110 } }} />
                  <TextField size="small" label="ต่อท้าย" value={st.suffix} onChange={(e) => setStat(i, "suffix", e.target.value.slice(0, 8))} sx={{ width: { sm: 90 } }} placeholder="+ หรือ /7" />
                  <TextField size="small" label="ป้าย" value={st.label} onChange={(e) => setStat(i, "label", e.target.value.slice(0, 60))} sx={{ flex: 1 }} />
                  <TextField size="small" label="คำอธิบายเล็ก" value={st.note} onChange={(e) => setStat(i, "note", e.target.value.slice(0, 120))} sx={{ flex: 1.3 }} />
                  <Tooltip title="ลบแถวนี้"><IconButton size="small" onClick={() => set("stats")(s.stats.filter((_, j) => j !== i))} aria-label="ลบแถวนี้"><Close sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                </Stack>
              ))}
              {s.stats.length < 6 && (
                <Box><Button size="small" startIcon={<Add />} onClick={() => set("stats")([...s.stats, { value: 0, suffix: "+", label: "", note: "" }])}
                  sx={{ textTransform: "none", fontWeight: 700, color: UI.accent }}>เพิ่มตัวเลข</Button></Box>
              )}
            </Stack>
          </Box>

          <Box sx={cardSx}>
            <Typography sx={{ fontWeight: 800, mb: 1.5 }}>เวลาทำการและข้อความสำคัญ</Typography>
            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" } }}>
              <TextField size="small" label="วันธรรมดา" value={s.businessHoursWeekdays} onChange={(e) => set("businessHoursWeekdays")(e.target.value.slice(0, 80))} />
              <TextField size="small" label="วันเสาร์" value={s.businessHoursSaturday} onChange={(e) => set("businessHoursSaturday")(e.target.value.slice(0, 80))} />
              <TextField size="small" label="วันหยุด" value={s.businessHoursClosed} onChange={(e) => set("businessHoursClosed")(e.target.value.slice(0, 80))} />
            </Box>
            <TextField size="small" fullWidth label="ข้อความงานฉุกเฉิน (หน้าติดต่อเรา)" value={s.emergencyNote} onChange={(e) => set("emergencyNote")(e.target.value.slice(0, 200))} sx={{ mt: 2 }} />
            <TextField size="small" fullWidth label="ประกาศบนแถบบนสุดของเว็บ (ว่าง = ไม่แสดง)" value={s.announcement} onChange={(e) => set("announcement")(e.target.value.slice(0, 200))}
              placeholder="เช่น หยุดทำการ 12–16 เม.ย. งานฉุกเฉินติดต่อได้ตามปกติ" sx={{ mt: 2 }} />
          </Box>

          <Box sx={cardSx}>
            <FieldLabel hint="แสดงบนหน้าเกี่ยวกับเรา และใช้ในข้อมูลสำหรับผลค้นหาแบบท้องถิ่นของ Google">พื้นที่ให้บริการ</FieldLabel>
            <StringListEditor value={s.serviceAreas} onChange={set("serviceAreas")} placeholder="เช่น นนทบุรี" addText="เพิ่มพื้นที่" max={30} maxLength={60} itemLabel="พื้นที่ให้บริการ" />
          </Box>

          <Box sx={cardSx}>
            <Typography sx={{ fontWeight: 800 }}>รูปของแต่ละบริการ</Typography>
            <Typography sx={{ color: UI.sub, fontSize: "0.82rem", mb: 1.5 }}>
              แสดงบนการ์ดบริการหน้าแรกและหน้าบริการ · ยังไม่อัป = เว็บใช้ภาพประกอบที่ติดมากับเว็บ ·
              แนะนำภาพถ่ายงานจริงแนวนอน (สัดส่วนประมาณ 16:10) · กด "บันทึก" ด้านล่างหลังอัป
            </Typography>
            <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
              {SERVICES.map((sv) => {
                const img = serviceImg(sv.value);
                return (
                  <ImageManager key={sv.value} single label={sv.label} value={img ? [img] : []}
                    onChange={(list) => setServiceImg(sv.value, list[0] || null)} onError={fb.fail}
                    hint="ภาพแนวนอนจะถูกครอปแบบเดียวกับที่เห็นนี้ · กด บันทึก ด้านล่างเพื่อขึ้นเว็บ" />
                );
              })}
            </Box>
          </Box>

          <BrandManager onOk={fb.ok} onFail={fb.fail} />
        </Stack>
      )}

      {/* ปุ่มบันทึกติดขอบล่าง — หน้ายาว ต้องกดบันทึกได้โดยไม่ต้องเลื่อนกลับขึ้นไปหาปุ่ม
          🐛 เดิมใช้ position:fixed เต็มความกว้างหน้าต่าง แถบจึงไปทับเมนูข้างซ้ายด้วย (เห็นจากภาพหน้าจอจริง)
          ✅ sticky = ติดขอบล่างเฉพาะภายในคอลัมน์เนื้อหา ไม่ล้นไปทับส่วนอื่นของแอป */}
      {s && (
        <Box sx={{ position: "sticky", bottom: 0, zIndex: 5, mt: 2, mx: { xs: -1.5, sm: -2, md: -3 }, bgcolor: "rgba(255,255,255,0.97)", borderTop: `1px solid ${UI.border}`, py: 1.25, px: { xs: 1.5, sm: 2, md: 3 }, pb: "calc(10px + env(safe-area-inset-bottom, 0px))" }}>
          <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="flex-end">
            {dirty && <Typography sx={{ color: "#b45309", fontSize: "0.85rem", fontWeight: 600 }}>มีการแก้ไขที่ยังไม่บันทึก</Typography>}
            <Button variant="contained" startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save />} disabled={!dirty || saving} onClick={save}
              sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, bgcolor: UI.accent, "&:hover": { bgcolor: "#b91c1c" } }}>
              บันทึกการแสดงผล
            </Button>
          </Stack>
        </Box>
      )}
    </Box>
  );
}

/** ยี่ห้อ — บันทึกทีละรายการทันที (ไม่รวมกับปุ่มบันทึกด้านล่าง) เพราะเป็นคนละคอลเลกชัน */
function BrandManager({ onOk, onFail }) {
  const [brands, setBrands] = useState(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Fire Alarm");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [logoFor, setLogoFor] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => { WebsiteService.list("brands").then(setBrands).catch((err) => { setBrands([]); onFail(errorText(err, "โหลดยี่ห้อไม่สำเร็จ")); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = async (b, body) => {
    setBusy(true);
    try {
      const saved = await WebsiteService.update("brands", b._id, body);
      setBrands((list) => list.map((x) => (x._id === saved._id ? saved : x)));
    } catch (err) { onFail(errorText(err)); } finally { setBusy(false); }
  };

  /**
   * โลโก้ — อัปแล้วบันทึกทันที (เหมือนปุ่มอื่นในกล่องนี้)
   * ⚠️ ไม่อัป = เว็บใช้โลโก้ตั้งต้นที่ฝังในโค้ด (Notifier Edwards Hochiki Asenware GST) หรือแสดงเป็นชื่อ
   *    โลโก้เก่าที่ถูกแทน/เอาออก server ลบไฟล์ใน Cloudinary ให้เอง
   */
  const uploadLogo = async (file) => {
    const b = logoFor;
    setLogoFor(null);
    if (!b || !file) return;
    if (!["image/png", "image/webp", "image/jpeg"].includes(file.type)) return onFail("โลโก้ต้องเป็น PNG / WebP / JPG (แนะนำ PNG พื้นโปร่งใส)");
    if (file.size > 5 * 1024 * 1024) return onFail("ไฟล์โลโก้ใหญ่เกิน 5 MB");
    setBusy(true);
    try {
      const r = await WebsiteService.upload(file, undefined, { kind: "logo" });
      const saved = await WebsiteService.update("brands", b._id, { logo: { url: r.url, publicId: r.publicId, width: r.width, height: r.height, alt: b.name } });
      setBrands((list) => list.map((x) => (x._id === saved._id ? saved : x)));
      onOk(`อัปโลโก้ ${b.name} แล้ว`);
    } catch (err) { onFail(errorText(err, "อัปโลโก้ไม่สำเร็จ")); } finally { setBusy(false); }
  };

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const order = (brands || []).reduce((m, b) => Math.max(m, b.order || 0), 0) + 1;
      const saved = await WebsiteService.create("brands", { name: name.trim(), category: category.trim() || "อื่น ๆ", order, status: "published" });
      setBrands((list) => [...list, saved]);
      setName("");
      onOk(`เพิ่มยี่ห้อ ${saved.name} แล้ว`);
    } catch (err) { onFail(errorText(err, "เพิ่มยี่ห้อไม่สำเร็จ")); } finally { setBusy(false); }
  };

  /** สลับลำดับกับรายการข้างเคียง แล้วบันทึกทั้งคู่ */
  const move = async (i, dir) => {
    const j = i + dir;
    if (!brands || j < 0 || j >= brands.length) return;
    const a = brands[i], b = brands[j];
    const next = [...brands];
    next[i] = { ...b, order: a.order }; next[j] = { ...a, order: b.order };
    if (a.order === b.order) { next[i].order = i; next[j].order = j; }
    setBrands(next);
    setBusy(true);
    try {
      await Promise.all([WebsiteService.update("brands", next[i]._id, { order: next[i].order }), WebsiteService.update("brands", next[j]._id, { order: next[j].order })]);
    } catch (err) { onFail(errorText(err)); } finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await WebsiteService.remove("brands", deleting._id);
      setBrands((list) => list.filter((x) => x._id !== deleting._id));
      setDeleting(null);
      onOk("ลบยี่ห้อแล้ว");
    } catch (err) { onFail(errorText(err)); } finally { setBusy(false); }
  };

  return (
    <Box sx={cardSx}>
      <Typography sx={{ fontWeight: 800 }}>ยี่ห้อที่แสดงบนเว็บ</Typography>
      <Typography sx={{ color: UI.sub, fontSize: "0.82rem", mb: 1.5 }}>
        ⭐ = แบรนด์หลัก (แสดงใหญ่ ขึ้นก่อน) · กดกรอบรูปเพื่ออัปโลโก้ — ใช้ไฟล์ PNG พื้นโปร่งใสจริง ระบบตัดขอบว่างให้อัตโนมัติ · ยี่ห้อที่ไม่ได้อัป เว็บใช้โลโก้ที่ติดมากับเว็บหรือแสดงเป็นชื่อ · บันทึกทันทีที่กด
      </Typography>
      {!brands ? <Skeleton variant="rounded" height={160} /> : (
        <Stack spacing={0.75}>
          {/* 🐛 เดิมทุกอย่างอยู่แถวเดียว บนมือถือปุ่มล้นขอบขวา และชื่อยี่ห้อถูกบีบจนหายไป (ผู้ใช้ส่งภาพหน้าจอมา)
              ✅ มือถือ: บรรทัดบน = ดาว · โลโก้ · ชื่อ+หมวด / บรรทัดล่าง = ปุ่มจัดการชิดขวา
                 จอกว้าง: อยู่บรรทัดเดียวกันเหมือนเดิม */}
          {brands.map((b, i) => (
            <Box key={b._id} sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 1, rowGap: 0.5, px: 1, py: 0.75, border: `1px solid ${UI.border}`, borderRadius: 2, opacity: b.status === "published" ? 1 : 0.55 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: "1 1 240px", minWidth: 0 }}>
                <Tooltip title={b.featured ? "เลิกเป็นแบรนด์หลัก" : "ตั้งเป็นแบรนด์หลัก"}>
                  <IconButton size="small" disabled={busy} onClick={() => patch(b, { featured: !b.featured })} aria-label={`สลับแบรนด์หลัก ${b.name}`}>
                    {b.featured ? <Star sx={{ fontSize: 20, color: "#f59e0b" }} /> : <StarBorder sx={{ fontSize: 20 }} />}
                  </IconButton>
                </Tooltip>
                <Tooltip title={b.logo?.url ? "เปลี่ยนโลโก้" : "อัปโลโก้"}>
                  <Box component="button" type="button" disabled={busy} aria-label={`${b.logo?.url ? "เปลี่ยน" : "อัป"}โลโก้ ${b.name}`}
                    onClick={() => { setLogoFor(b); fileRef.current?.click(); }}
                    sx={{ width: 84, height: 40, flexShrink: 0, display: "grid", placeItems: "center", p: 0.5, cursor: "pointer", bgcolor: "#fff", border: `1px ${b.logo?.url ? "solid" : "dashed"} ${UI.border}`, borderRadius: 1.5, color: UI.sub, "&:hover": { borderColor: UI.accent } }}>
                    {b.logo?.url
                      ? <Box component="img" src={b.logo.url} alt="" sx={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                      : <AddPhotoAlternate sx={{ fontSize: 20 }} />}
                  </Box>
                </Tooltip>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, lineHeight: 1.3 }} noWrap>{b.name}</Typography>
                  <Typography sx={{ color: UI.sub, fontSize: "0.78rem" }} noWrap>{b.category}{b.status !== "published" && " · ซ่อนอยู่"}</Typography>
                </Box>
              </Stack>
              <Stack direction="row" alignItems="center" sx={{ ml: "auto" }}>
                {b.logo?.url && (
                  <Tooltip title="เอาโลโก้ที่อัปออก (กลับไปใช้โลโก้ตั้งต้น/ชื่อ)">
                    <IconButton size="small" disabled={busy} onClick={() => patch(b, { logo: null })} aria-label={`เอาโลโก้ ${b.name} ออก`}><HideImage sx={{ fontSize: 18 }} /></IconButton>
                  </Tooltip>
                )}
                <Tooltip title={b.status === "published" ? "ซ่อนจากเว็บ" : "แสดงบนเว็บ"}>
                  <IconButton size="small" disabled={busy} onClick={() => patch(b, { status: b.status === "published" ? "draft" : "published" })} aria-label={`ซ่อน/แสดง ${b.name}`}>
                    {b.status === "published" ? <Visibility sx={{ fontSize: 18 }} /> : <VisibilityOff sx={{ fontSize: 18 }} />}
                  </IconButton>
                </Tooltip>
                <IconButton size="small" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={`เลื่อน ${b.name} ขึ้น`}><ArrowUpward sx={{ fontSize: 17 }} /></IconButton>
                <IconButton size="small" disabled={busy || i === brands.length - 1} onClick={() => move(i, 1)} aria-label={`เลื่อน ${b.name} ลง`}><ArrowDownward sx={{ fontSize: 17 }} /></IconButton>
                <IconButton size="small" disabled={busy} onClick={() => setDeleting(b)} aria-label={`ลบ ${b.name}`}><Close sx={{ fontSize: 18 }} /></IconButton>
              </Stack>
            </Box>
          ))}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ pt: 1 }}>
            <TextField size="small" label="ชื่อยี่ห้อ" value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} onKeyDown={(e) => e.key === "Enter" && add()} sx={{ flex: 1 }} />
            <TextField select size="small" label="หมวด" value={category} onChange={(e) => setCategory(e.target.value)} sx={{ minWidth: 160 }}>
              {["Fire Alarm", "Fire Protection", "Fire Pump", "CCTV", "Access Control", "อื่น ๆ"].map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
            <Button variant="outlined" startIcon={<Add />} disabled={busy || !name.trim()} onClick={add} sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}>เพิ่มยี่ห้อ</Button>
          </Stack>
        </Stack>
      )}
      <input ref={fileRef} type="file" hidden accept="image/png,image/webp,image/jpeg"
        onChange={(e) => { uploadLogo(e.target.files?.[0]); e.target.value = ""; }} />
      <ConfirmDialog open={Boolean(deleting)} busy={busy} onCancel={() => setDeleting(null)} onConfirm={remove}
        title={`ลบยี่ห้อ ${deleting?.name || ""}?`} detail="ยี่ห้อจะหายจากเว็บไซต์ (สินค้าของยี่ห้อนี้ยังอยู่) — ถ้าแค่อยากซ่อน กดปุ่มรูปตาแทน" />
    </Box>
  );
}
