/**
 * CheckDialog — หน้าต่างเช็คอินเข้างานของหัวหน้าทีม (10 ต.ค. 2569)
 *
 * เวลา (จาก server) · ตำแหน่ง GPS + ระยะห่างจากหน้างาน · รูปหน้างาน (บังคับ) · หมายเหตุ
 * 🧹 (11 ต.ค. 2569 ผู้ใช้: "ตัดระบบเช็คเอาต์ออก ช่างต้องวิ่งหลายงาน") — เหลือเช็คอินอย่างเดียว
 *
 * 🔒 ไม่มีช่องให้ใส่เวลาเลย — เวลาที่บันทึกคือเวลา server ตอนกด "ยืนยัน"
 *    นาฬิกาบนหน้าจอเทียบกับเวลา server (serverNow) ไม่ใช่นาฬิกาเครื่อง
 * 📷 รูปอัปโหลดเข้า "ไฟล์แนบ" ของงานทันทีที่เลือก (ชุดเดียวกับที่แอดมินเห็น) — กดยกเลิก = ลบรูปที่เพิ่งอัปทิ้ง
 * 📍 ไม่อนุญาตตำแหน่ง/หาไม่เจอ ยังเช็คอินได้ — บันทึกว่า "ไม่มีพิกัด" ให้แอดมินเห็น
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box, Stack, Typography, Button, ButtonBase, Dialog, DialogContent, DialogActions, IconButton, TextField,
  CircularProgress, useMediaQuery,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Close, LoginRounded, MyLocationRounded, LocationOffRounded, AddAPhotoOutlined, AccessTimeRounded,
  CheckCircleRounded, RefreshRounded, LockClockOutlined, CheckRounded, DescriptionOutlined,
} from "@mui/icons-material";
import EventService from "@/shared/services/EventService";
import { BTN as MBTN, CARD } from "@/shared/ui/modernUi";
import AttendanceService from "@/shared/services/AttendanceService";
import { INK, MUTED, FAINT, LINE, SURFACE, ACCENT, ACCENT_SOFT, ACCENT_LINE } from "@/shared/ui/PageKit";
import {
  NOTE_PRESETS, ON_SITE_M, getPosition, distanceM, fmtDistance, fmtTime,
} from "../attendanceMeta";

const GREEN = "#16a34a";
const AMBER = "#d97706";

/**
 * หัวข้อย่อยในหน้าต่าง — ✅ (10 ต.ค. 2569 ผู้ใช้: "ยังไม่สวย ดูยาก ปุ่มล้าสมัย การจัดวางให้ดูง่ายกว่านี้")
 * แต่ละหัวข้อเป็นการ์ดขาวของตัวเองบนพื้นเทาอ่อน (แบบแอปมือถือสมัยใหม่) แทนเส้นคั่นบางๆ — แยกเรื่องชัด อ่านทีละกล่อง
 */
const Section = ({ title, hint, required, children }) => (
  <Box sx={{ ...CARD, p: 2, mb: 1.5 }}>
    <Stack direction="row" alignItems="baseline" flexWrap="wrap" columnGap={0.75} sx={{ mb: 1.25 }}>
      <Typography sx={{ fontSize: "0.95rem", fontWeight: 900, color: INK }}>
        {title}{required && <Box component="span" sx={{ color: "#dc2626" }}> *</Box>}
      </Typography>
      {hint && <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>{hint}</Typography>}
    </Stack>
    {children}
  </Box>
);

const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: "12px", bgcolor: "#fff" } };

/** ตารางภาพย่อ/ไฟล์ที่อัปแล้ว + ช่องเพิ่ม (ถ้ามี onAdd) */
function FileGrid({ items, uploading = 0, onRemove, onAdd, addLabel, highlight }) {
  return (
    <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))" }}>
      {items.map((p) => (
        <Box key={p.fileId} sx={{ position: "relative", pt: "100%", borderRadius: 2, overflow: "hidden", border: `1px solid ${LINE}`, bgcolor: SURFACE }}>
          {isImg(p) ? (
            <Box component="img" src={p.fileUrl} alt={p.fileName} sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <Stack alignItems="center" justifyContent="center" spacing={0.5} sx={{ position: "absolute", inset: 0, p: 1 }}>
              <DescriptionOutlined sx={{ fontSize: 26, color: /\.pdf$/i.test(p.fileName || "") ? "#dc2626" : MUTED }} />
              <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, color: INK, textAlign: "center", wordBreak: "break-all", lineHeight: 1.25,
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.fileName}</Typography>
            </Stack>
          )}
          <IconButton size="small" aria-label="ลบไฟล์" onClick={() => onRemove(p)}
            sx={{ position: "absolute", top: 3, right: 3, width: 24, height: 24, bgcolor: alpha(INK, 0.55), color: "#fff", "&:hover": { bgcolor: "#dc2626" } }}>
            <Close sx={{ fontSize: 15 }} />
          </IconButton>
        </Box>
      ))}
      {Array.from({ length: uploading }).map((_, i) => (
        <Box key={`u${i}`} sx={{ pt: "100%", position: "relative", borderRadius: 2, border: `1px dashed ${LINE}`, bgcolor: SURFACE }}>
          <CircularProgress size={22} sx={{ position: "absolute", top: "calc(50% - 11px)", left: "calc(50% - 11px)" }} />
        </Box>
      ))}
      {onAdd && (
        <ButtonBase onClick={onAdd}
          sx={{ position: "relative", pt: "100%", borderRadius: 2, border: `1.5px dashed ${highlight ? ACCENT : ACCENT_LINE}`, bgcolor: ACCENT_SOFT, color: ACCENT,
            boxShadow: highlight ? `0 0 0 3px ${alpha(ACCENT, 0.15)}` : "none" }}>
          <Stack alignItems="center" justifyContent="center" spacing={0.25} sx={{ position: "absolute", inset: 0 }}>
            <AddAPhotoOutlined />
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 800 }}>{addLabel}</Typography>
          </Stack>
        </ButtonBase>
      )}
    </Box>
  );
}

const isImg = (f) => /^image\//.test(f?.fileType || "") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f?.fileName || "");

/**
 * @param event   งาน (ใบของวันนั้น)
 * @param onDone  ({ attendance }) => void
 * @param zIndex  อยู่ในฟอร์ม SweetAlert (EditEvent) — ต้องลอยเหนือ .swal2-container (z-index 20000)
 */
export default function CheckDialog({ open, event, onClose, onDone, zIndex }) {
  const fullScreen = useMediaQuery("(max-width:600px)");
  const [offset, setOffset] = useState(0); // serverNow − Date.now()
  const [now, setNow] = useState(Date.now());
  const [site, setSite] = useState(null);
  const [pos, setPos] = useState(null); // null = กำลังหา
  const [photos, setPhotos] = useState([]); // [{ fileId, fileUrl, fileName, fileType }]
  const [uploading, setUploading] = useState(0);
  const [notePreset, setNotePreset] = useState("");
  const [noteExtra, setNoteExtra] = useState("");
  const note = [notePreset, noteExtra.trim()].filter(Boolean).join(" — ");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef(null);
  const doneRef = useRef(false);

  const locate = async () => {
    setPos(null);
    setPos(await getPosition());
  };

  // เปิดหน้าต่าง → ขอเวลา server + พิกัดหน้างาน · หาตำแหน่งเครื่องพร้อมกัน
  useEffect(() => {
    if (!open || !event?._id) return undefined;
    doneRef.current = false;
    setPhotos([]); setNotePreset(""); setNoteExtra(""); setErr(""); setSite(null);
    AttendanceService.ofEvent(event._id, { site: true })
      .then((r) => {
        if (r?.serverNow) setOffset(new Date(r.serverNow).getTime() - Date.now());
        if (r?.site) setSite(r.site);
      })
      .catch(() => {});
    locate();
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?._id]);

  const serverNow = now + offset;
  const dist = pos?.gps === "ok" && site ? distanceM(site, pos) : null;

  // ── รูปหน้างาน: อัปโหลดเข้า "ไฟล์แนบ" ของงานทันทีที่เลือก ──
  const onPick = async (e) => {
    const picked = [...(e.target.files || [])];
    e.target.value = "";
    if (!picked.length) return;
    setErr("");
    setUploading((n) => n + picked.length);
    for (const [i, f] of picked.entries()) {
      try {
        // ⚠️ ตั้งชื่อใหม่ไม่ให้ซ้ำ — iPhone ส่งชื่อ image.jpg ทุกรูป (ที่เก็บไฟล์จะเขียนทับรูปเดิม)
        const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
        const file = new File([f], `checkin_${Date.now()}_${i}.${ext}`, { type: f.type });
        const saved = await EventService.Upload(event._id, file, "sitePhoto");
        setPhotos((prev) => [...prev, { fileId: String(saved.fileId), fileUrl: saved.fileUrl, fileName: saved.fileName, fileType: saved.fileType }]);
      } catch (e2) {
        setErr(e2?.response?.data?.message || "อัปโหลดไม่สำเร็จบางไฟล์ — ลองใหม่อีกครั้ง");
      }
      setUploading((n) => n - 1);
    }
  };
  const removePhoto = (p) => {
    setPhotos((prev) => prev.filter((x) => x.fileId !== p.fileId));
    EventService.DeleteFile(event._id, "sitePhoto", p.fileId).catch(() => {});
  };

  // ปิดโดยไม่ยืนยัน → ลบไฟล์ที่เพิ่งอัป (ไม่ให้ค้างในงานแบบไม่มีที่มา)
  const cancel = () => {
    if (saving) return;
    if (!doneRef.current) photos.forEach((p) => EventService.DeleteFile(event._id, "sitePhoto", p.fileId).catch(() => {}));
    onClose();
  };

  // ✅ (10 ต.ค. 2569 ผู้ใช้: "การเช็คอินต้องอัปรูปภาพหน้างานก่อนถึงจะกดได้") — server เช็คซ้ำ
  const needPhoto = !photos.length;
  const canSubmit = !saving && !uploading && pos !== null && !needPhoto;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setErr("");
    const gpsPayload = pos?.gps === "ok" ? { gps: "ok", lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy } : { gps: pos?.gps || "unavailable" };
    try {
      const data = await AttendanceService.checkIn({ eventId: event._id, ...gpsPayload, note, photoIds: photos.map((p) => p.fileId) });
      doneRef.current = true;
      onDone?.(data);
    } catch (e) {
      setErr(e?.response?.data?.message || "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  // ── ตำแหน่ง ──
  const locationCard = useMemo(() => {
    if (pos === null) {
      return { icon: <CircularProgress size={18} />, title: "กำลังหาตำแหน่ง…", sub: "เปิด GPS ไว้จะได้ตำแหน่งแม่นขึ้น", tone: MUTED };
    }
    if (pos.gps === "denied") {
      return { icon: <LocationOffRounded />, title: "ไม่ได้อนุญาตให้ใช้ตำแหน่ง", sub: "ยังบันทึกได้ — ระบบจะบันทึกว่า \"ไม่มีพิกัด\" · เปิดสิทธิ์ตำแหน่งในเบราว์เซอร์แล้วกดหาใหม่", tone: AMBER };
    }
    if (pos.gps !== "ok") {
      return { icon: <LocationOffRounded />, title: "หาตำแหน่งไม่เจอ", sub: "ยังบันทึกได้ — ลองออกไปที่โล่งแล้วกดหาใหม่", tone: AMBER };
    }
    const acc = pos.accuracy ? `แม่นยำ ±${Math.round(pos.accuracy)} ม.` : "";
    if (dist == null) {
      return { icon: <MyLocationRounded />, title: "ได้ตำแหน่งแล้ว", sub: [acc, site ? "" : "ยังไม่มีพิกัดหน้างานในทะเบียนลูกค้า — บันทึกพิกัดอย่างเดียว"].filter(Boolean).join(" · "), tone: ACCENT };
    }
    return dist <= ON_SITE_M
      ? { icon: <CheckCircleRounded />, title: `อยู่ที่หน้างาน · ${fmtDistance(dist)}`, sub: acc, tone: GREEN }
      : { icon: <MyLocationRounded />, title: `ห่างจากหน้างาน ${fmtDistance(dist)}`, sub: [acc, "ยังบันทึกได้ แอดมินจะเห็นระยะห่างนี้"].filter(Boolean).join(" · "), tone: AMBER };
  }, [pos, dist, site]);

  const jobLabel = [event?.title, event?.site || event?.company].filter(Boolean).join(" · ");

  return (
    <Dialog open={open} onClose={cancel} fullScreen={fullScreen} fullWidth maxWidth="sm" sx={zIndex ? { zIndex } : undefined}
      PaperProps={{ sx: { borderRadius: fullScreen ? 0 : 3, bgcolor: "#fff" } }}>
      {/* หัว */}
      <Stack direction="row" alignItems="center" gap={1.25} sx={{ px: 2.5, pt: 2, pb: 1.5, borderBottom: `1px solid ${LINE}` }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2.5, display: "grid", placeItems: "center", bgcolor: ACCENT_SOFT, color: ACCENT, flexShrink: 0 }}>
          <LoginRounded />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900, fontSize: "1.05rem", color: INK }}>เข้างาน · ถ่ายรูปหน้างาน</Typography>
          <Typography noWrap sx={{ fontSize: "0.78rem", color: MUTED }}>{[jobLabel, event?.jobNo].filter(Boolean).join(" · ")}</Typography>
        </Box>
        <IconButton onClick={cancel} aria-label="ปิด"><Close /></IconButton>
      </Stack>

      <DialogContent sx={{ px: { xs: 1.5, sm: 2.5 }, pt: "16px !important", pb: 1, bgcolor: "#f4f6f9" }}>
        {/* เวลา */}
        <Box sx={{ ...CARD, mb: 1.5, p: 2 }}>
          <Stack direction="row" alignItems="center" gap={1.5}>
            <AccessTimeRounded sx={{ color: ACCENT, fontSize: 28 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: "1.9rem", fontWeight: 900, color: INK, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
                {fmtTime(serverNow)}
              </Typography>
              <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>เวลาเข้างาน = เวลาที่กดยืนยัน</Typography>
            </Box>
          </Stack>
          <Stack direction="row" alignItems="center" gap={0.6} sx={{ mt: 1.25, pt: 1, borderTop: `1px dashed ${LINE}` }}>
            <LockClockOutlined sx={{ fontSize: 15, color: FAINT }} />
            <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>บันทึกเวลาจากเซิร์ฟเวอร์ แก้จากเครื่องไม่ได้ · ต้องการแก้ ขอผ่านแอดมิน</Typography>
          </Stack>
        </Box>

        {/* ตำแหน่ง */}
        <Section title="ตำแหน่งปัจจุบัน">
          <Stack direction="row" alignItems="center" gap={1.25} sx={{ p: 1.5, borderRadius: 2.5, border: `1px solid ${alpha(locationCard.tone, 0.3)}`, bgcolor: alpha(locationCard.tone, 0.05) }}>
            <Box sx={{ color: locationCard.tone, display: "flex", "& svg": { fontSize: 22 } }}>{locationCard.icon}</Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.9rem", fontWeight: 800, color: INK }}>{locationCard.title}</Typography>
              {locationCard.sub && <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.45 }}>{locationCard.sub}</Typography>}
            </Box>
            {pos !== null && (
              <Button size="small" onClick={locate} startIcon={<RefreshRounded />} sx={{ flexShrink: 0, fontWeight: 800, color: ACCENT }}>หาใหม่</Button>
            )}
          </Stack>
        </Section>

        {/* รูปก่อนเริ่มงาน — บังคับอย่างน้อย 1 รูป */}
        <Section title="รูปหน้างาน" required hint={needPhoto ? "ต้องมีอย่างน้อย 1 รูป จึงกดเข้างานได้" : `${photos.length} รูป · บันทึกเป็นไฟล์แนบของงานนี้`}>
          <FileGrid items={photos} uploading={uploading} onRemove={removePhoto} onAdd={() => fileRef.current?.click()} addLabel="ถ่าย/เลือกรูป" highlight={needPhoto} />
          <input ref={fileRef} type="file" hidden multiple accept="image/*,.heic,.heif" onChange={onPick} />
        </Section>

        <Section title="หมายเหตุ" hint="ไม่บังคับ">
            {/* ✅ (10 ต.ค. 2569 ผู้ใช้: "ตรงเลือกหมายเหตุให้เลือกง่ายกว่านี้ ดูเล็กๆ อ่านยาก ไม่สวย")
                เดิมเป็นชิปเล็กๆ ตัดบรรทัดไม่เป็นระเบียบ — ตอนนี้เป็นแถวเต็มความกว้าง สูงพอกดด้วยนิ้ว
                มีไอคอน + ตัวหนังสือขนาดปกติ + วงกลมเลือก (กดซ้ำ = ยกเลิก) · พิมพ์เพิ่มเติมได้ช่องล่าง */}
            <Stack spacing={1}>
              {NOTE_PRESETS.map(({ text, Icon }) => {
                const on = notePreset === text;
                return (
                  <ButtonBase key={text} onClick={() => setNotePreset(on ? "" : text)} role="radio" aria-checked={on}
                    sx={{ justifyContent: "flex-start", gap: 1.5, px: 1.75, minHeight: 52, borderRadius: 2.5, fontFamily: "inherit",
                      border: `1.5px solid ${on ? ACCENT : LINE}`, bgcolor: on ? ACCENT_SOFT : "#fff", transition: "all .12s" }}>
                    <Icon sx={{ fontSize: 22, color: on ? ACCENT : MUTED }} />
                    <Typography sx={{ flex: 1, textAlign: "left", fontSize: "0.95rem", fontWeight: on ? 800 : 600, color: on ? ACCENT : INK }}>{text}</Typography>
                    <Box sx={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center",
                      border: `2px solid ${on ? ACCENT : "#cbd5e1"}`, bgcolor: on ? ACCENT : "#fff" }}>
                      {on && <CheckRounded sx={{ fontSize: 15, color: "#fff" }} />}
                    </Box>
                  </ButtonBase>
                );
              })}
            </Stack>
            <TextField fullWidth multiline minRows={2} label="รายละเอียดเพิ่มเติม (ถ้ามี)" value={noteExtra}
              onChange={(e) => setNoteExtra(e.target.value)} inputProps={{ maxLength: 400 }} sx={{ ...fieldSx, mt: 1.5 }} />
        </Section>
        {err && <Typography sx={{ mt: 2, fontSize: "0.82rem", fontWeight: 700, color: "#dc2626" }}>{err}</Typography>}
      </DialogContent>

      <DialogActions sx={{ px: { xs: 1.5, sm: 2.5 }, py: 1.25, borderTop: `1px solid ${LINE}`, gap: 1, bgcolor: "#fff" }}>
        <Button onClick={cancel} disabled={saving} sx={{ ...MBTN.ghost, px: 2 }}>ยกเลิก</Button>
        <Button variant="contained" disableElevation onClick={submit} disabled={!canSubmit}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <LoginRounded />}
          sx={{ ...MBTN.primary, flex: { xs: 1, sm: "0 0 auto" }, px: 3.5 }}>
          {saving ? "กำลังบันทึก…" : needPhoto ? "ถ่ายรูปก่อนกดเข้างาน" : "ยืนยันเข้างาน"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
