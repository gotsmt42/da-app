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
  Box, Stack, Typography, Button, ButtonBase, Dialog, DialogContent, DialogActions, IconButton, TextField, Collapse,
  CircularProgress, useMediaQuery,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Close, LoginRounded, MyLocationRounded, LocationOffRounded, AddAPhotoOutlined, AccessTimeRounded,
  CheckCircleRounded, RefreshRounded, LockClockOutlined, CheckRounded, DescriptionOutlined, ExpandMoreRounded,
} from "@mui/icons-material";
import EventService from "@/shared/services/EventService";
import { BTN as MBTN, CARD } from "@/shared/ui/modernUi";
import AttendanceService from "@/shared/services/AttendanceService";
import { INK, MUTED, FAINT, LINE, SURFACE, ACCENT, ACCENT_SOFT, ACCENT_LINE } from "@/shared/ui/PageKit";
import {
  NOTE_PRESETS, ON_SITE_M, distanceM, fmtDistance, fmtTime, watchBestPosition, GPS_GOOD_M, GPS_OK_M, GPS_MIN_WAIT_MS,
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

/**
 * ✅ (15 ต.ค. 2569 ผู้ใช้: "ระบบแจ้งเตือนว่าผู้ใช้ต้องเปิด GPS ก่อน ทำให้หน้าตาสวยงามแบบมืออาชีพที่ใช้กันทั่วไป")
 * แผงขอให้เปิดตำแหน่ง — แบบแอปทั่วไป: ไอคอนใหญ่ · หัวข้อ · เหตุผลสั้นๆ · ขั้นตอนตามเครื่องที่ใช้อยู่ · ปุ่มลองอีกครั้ง
 * denied = ปฏิเสธสิทธิ์ไว้ (ต้องไปเปิดในตั้งค่า) · unavailable = เปิดสิทธิ์แล้วแต่หาสัญญาณ GPS ไม่ได้/ปิด GPS ทั้งเครื่อง
 */
const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
const IS_IOS = /iPhone|iPad|iPod/i.test(ua);
const GPS_STEPS = {
  denied: IS_IOS
    ? ["เปิด “การตั้งค่า” ของ iPhone", "ความเป็นส่วนตัวและความปลอดภัย → บริการหาตำแหน่ง → เปิด", "เลือกเบราว์เซอร์ที่ใช้ (Safari/Chrome) → “ขณะใช้แอป” และเปิด “ตำแหน่งที่แน่นอน”", "กลับมาที่หน้านี้ แล้วกด “ลองอีกครั้ง”"]
    : ["แตะไอคอน 🔒 / ⓘ ด้านหน้าช่องที่อยู่เว็บ", "เลือก “สิทธิ์” → “ตำแหน่ง” → “อนุญาต”", "เปิด “ตำแหน่ง” ในแถบด่วนของเครื่อง (ลากจากขอบบนลงมา)", "กลับมาที่หน้านี้ แล้วกด “ลองอีกครั้ง”"],
  unavailable: IS_IOS
    ? ["เปิด “การตั้งค่า” → ความเป็นส่วนตัวฯ → บริการหาตำแหน่ง ให้เป็น “เปิด”", "ออกไปที่โล่ง ห่างจากหลังคา/ผนังหนา", "กด “ลองอีกครั้ง”"]
    : ["ลากแถบด่วนจากขอบบนลงมา แล้วเปิด “ตำแหน่ง”", "ในการตั้งค่าตำแหน่ง เปิด “ความแม่นยำของตำแหน่ง (Google)”", "ออกไปที่โล่ง แล้วกด “ลองอีกครั้ง”"],
};
function GpsRequired({ kind, perm, secure, onRetry, onRequest, onSkip, skipped }) {
  // ✅ (15 ต.ค. 2569 ผู้ใช้: "การเปิดสิทธิ์ตำแหน่งควรให้กดเปิดจากหน้า UI ได้เลย")
  //    perm = "prompt" → เบราว์เซอร์ยังถามได้: ปุ่มเดียว "อนุญาตให้ใช้ตำแหน่ง" เด้งหน้าต่างอนุญาตของเครื่องขึ้นมาเลย
  //    perm = "denied" → เคยกดบล็อกไว้ เบราว์เซอร์ไม่ยอมให้เว็บถามซ้ำ (ข้อจำกัดของทุกเบราว์เซอร์) → บอกขั้นตอนเปิดเอง
  //    secure = false → เปิดผ่าน http:// (เช่นทดสอบผ่าน IP ในวง LAN) มือถือไม่ให้เว็บใช้ GPS เลย ต้องเปิดผ่าน https
  const canPrompt = secure && perm === "prompt";
  const steps = GPS_STEPS[kind] || GPS_STEPS.unavailable;
  if (!secure) {
    return (
      <Box sx={{ ...CARD, mb: 1.5, p: 2, border: `1px solid ${alpha(AMBER, 0.35)}` }}>
        <Stack direction="row" gap={1.25} alignItems="flex-start">
          <LocationOffRounded sx={{ color: AMBER, fontSize: 26, flexShrink: 0 }} />
          <Box>
            <Typography sx={{ fontSize: "0.95rem", fontWeight: 900, color: INK }}>ลิงก์นี้ใช้ GPS ไม่ได้</Typography>
            <Typography sx={{ mt: 0.4, fontSize: "0.82rem", color: MUTED, lineHeight: 1.55 }}>
              หน้านี้เปิดผ่าน <b>http://</b> (ไม่ปลอดภัย) มือถือจึงไม่อนุญาตให้เว็บใช้ตำแหน่ง — เปิดแอปผ่านลิงก์จริง <b>https://</b> แล้ว GPS จะใช้ได้ตามปกติ
            </Typography>
          </Box>
        </Stack>
        {!skipped ? (
          <Button fullWidth variant="outlined" onClick={onSkip} sx={{ ...MBTN.outline("#64748b"), mt: 1.75, minHeight: 42 }}>บันทึกโดยไม่มีพิกัด</Button>
        ) : (
          <Typography sx={{ mt: 1.25, textAlign: "center", fontSize: "0.76rem", color: AMBER, fontWeight: 700 }}>จะบันทึกแบบ “ไม่มีพิกัด”</Typography>
        )}
      </Box>
    );
  }
  return (
    <Box sx={{ ...CARD, mb: 1.5, overflow: "hidden", border: `1px solid ${alpha(AMBER, 0.35)}` }}>
      <Box sx={{ px: 2, pt: 2.25, pb: 1.75, textAlign: "center", background: `linear-gradient(180deg, ${alpha(AMBER, 0.1)}, #fff)` }}>
        <Box sx={{ mx: "auto", width: 64, height: 64, borderRadius: "50%", display: "grid", placeItems: "center", bgcolor: "#fff", color: AMBER,
          boxShadow: `0 0 0 8px ${alpha(AMBER, 0.12)}, 0 6px 16px -6px ${alpha(AMBER, 0.6)}` }}>
          <LocationOffRounded sx={{ fontSize: 32 }} />
        </Box>
        <Typography sx={{ mt: 1.75, fontSize: "1.05rem", fontWeight: 900, color: INK }}>
          {canPrompt ? "อนุญาตให้ใช้ตำแหน่งที่ตั้ง" : kind === "denied" ? "เปิดสิทธิ์ตำแหน่งที่ตั้งก่อนบันทึกเข้างาน" : "เปิด GPS ก่อนบันทึกเข้างาน"}
        </Typography>
        <Typography sx={{ mt: 0.5, fontSize: "0.82rem", color: MUTED, lineHeight: 1.55 }}>
          ระบบใช้ตำแหน่งยืนยันว่าเข้างานที่หน้างานจริง{kind === "denied" ? " — ตอนนี้เบราว์เซอร์ยังไม่ได้รับอนุญาต" : " — ตอนนี้หาสัญญาณ GPS ไม่ได้"}
        </Typography>
      </Box>
      <Box sx={{ px: 2, pb: 2 }}>
        {canPrompt ? (
          <>
            <Button fullWidth variant="contained" disableElevation onClick={onRequest} startIcon={<MyLocationRounded />} sx={{ ...MBTN.primary, minHeight: 48 }}>
              อนุญาตให้ใช้ตำแหน่ง
            </Button>
            <Typography sx={{ mt: 0.9, textAlign: "center", fontSize: "0.76rem", color: MUTED }}>กดแล้วเลือก “อนุญาต” ในหน้าต่างที่เด้งขึ้นมา</Typography>
          </>
        ) : (
        <>
        <Stack spacing={1}>
          {steps.map((t, i) => (
            <Stack key={t} direction="row" gap={1.25} alignItems="flex-start">
              <Box sx={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", bgcolor: ACCENT_SOFT, color: ACCENT, fontSize: "0.72rem", fontWeight: 900 }}>{i + 1}</Box>
              <Typography sx={{ fontSize: "0.84rem", color: INK, lineHeight: 1.55, pt: "1px" }}>{t}</Typography>
            </Stack>
          ))}
        </Stack>
        <Button fullWidth variant="contained" disableElevation onClick={onRetry} startIcon={<MyLocationRounded />} sx={{ ...MBTN.primary, mt: 2, minHeight: 46 }}>
          ลองอีกครั้ง
        </Button>
        <Typography sx={{ mt: 0.75, textAlign: "center", fontSize: "0.72rem", color: FAINT }}>เปิดสิทธิ์แล้ว ระบบจะหาตำแหน่งให้อัตโนมัติ</Typography>
        </>
        )}
        {!skipped ? (
          <ButtonBase onClick={onSkip} sx={{ display: "block", mx: "auto", mt: 1.25, px: 1, py: 0.5, borderRadius: 1, fontFamily: "inherit", fontSize: "0.76rem", color: MUTED, textDecoration: "underline" }}>
            เปิดไม่ได้จริงๆ — บันทึกโดยไม่มีพิกัด
          </ButtonBase>
        ) : (
          <Typography sx={{ mt: 1.25, textAlign: "center", fontSize: "0.76rem", color: AMBER, fontWeight: 700 }}>
            จะบันทึกแบบ “ไม่มีพิกัด” — แอดมินจะเห็นว่าไม่ได้ยืนยันตำแหน่ง
          </Typography>
        )}
      </Box>
    </Box>
  );
}

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
  const [noteOpen, setNoteOpen] = useState(false);
  const note = [notePreset, noteExtra.trim()].filter(Boolean).join(" — ");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef(null);
  const doneRef = useRef(false);

  // ✅ (15 ต.ค. 2569) ติดตามตำแหน่งต่อเนื่องจนปิดหน้าต่าง — ใช้ค่าที่แม่นที่สุดล่าสุดตอนกดบันทึก (ดู watchBestPosition)
  const stopWatchRef = useRef(null);
  const [locStart, setLocStart] = useState(Date.now());
  const [skipGps, setSkipGps] = useState(false);
  const secure = typeof window === "undefined" || window.isSecureContext !== false;
  const [perm, setPerm] = useState("unknown"); // granted | prompt | denied | unknown
  // ติดตามสถานะสิทธิ์ — ผู้ใช้ไปเปิดสิทธิ์แล้วกลับมา → หาตำแหน่งให้เองทันที ไม่ต้องกดลองอีกครั้ง
  useEffect(() => {
    if (!open || !navigator.permissions?.query) return undefined;
    let st; let alive = true;
    navigator.permissions.query({ name: "geolocation" }).then((r) => {
      if (!alive) return;
      st = r; setPerm(r.state);
      r.onchange = () => { setPerm(r.state); if (r.state === "granted") locate(); };
    }).catch(() => {});
    return () => { alive = false; if (st) st.onchange = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  // ปุ่ม "อนุญาตให้ใช้ตำแหน่ง" — ขอสิทธิ์ตรงๆ ให้เบราว์เซอร์เด้งหน้าต่างอนุญาตของเครื่อง แล้วเริ่มติดตามตำแหน่ง
  const requestPermission = () => {
    setPos(null);
    navigator.geolocation?.getCurrentPosition(() => locate(), () => locate(), { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  };
  const locate = () => {
    stopWatchRef.current?.();
    setSkipGps(false);
    setPos(null);
    setLocStart(Date.now());
    stopWatchRef.current = watchBestPosition((p) => setPos(p));
  };
  useEffect(() => () => stopWatchRef.current?.(), []);
  useEffect(() => { if (!open) { stopWatchRef.current?.(); stopWatchRef.current = null; } }, [open]);

  // เปิดหน้าต่าง → ขอเวลา server + พิกัดหน้างาน · หาตำแหน่งเครื่องพร้อมกัน
  useEffect(() => {
    if (!open || !event?._id) return undefined;
    doneRef.current = false;
    setPhotos([]); setNotePreset(""); setNoteExtra(""); setNoteOpen(false); setErr(""); setSite(null);
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
  // ✅ ตำแหน่งต้อง "แม่นพอ" ก่อนบันทึก: ±30 ม. บันทึกได้ทันที · ยังไม่แม่นพอ ต้องรอให้ GPS ปรับอย่างน้อย 15 วิ
  //    (ไม่มีสิทธิ์/หาไม่เจอ ยังบันทึกได้เหมือนเดิม — ระบบบันทึกว่าไม่มีพิกัด ให้แอดมินเห็น)
  const waitedMs = now - locStart;
  const gpsSettling = pos === null || (pos.gps === "ok" && pos.accuracy > GPS_GOOD_M && waitedMs < GPS_MIN_WAIT_MS);
  // ต้องเปิด GPS ก่อน — ไม่มีพิกัดจะบันทึกได้เฉพาะเมื่อผู้ใช้กด "เปิดไม่ได้จริงๆ" เอง
  const gpsMissing = pos !== null && pos.gps !== "ok";
  const gpsBlocked = gpsMissing && !skipGps;
  const canSubmit = !saving && !uploading && !gpsSettling && !gpsBlocked && !needPhoto;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setErr("");
    // ใช้ค่าที่แม่นที่สุดล่าสุด ณ ตอนกด (pos อัปเดตตลอดจาก watchBestPosition)
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
      return { icon: <CircularProgress size={18} />, title: "กำลังหาตำแหน่ง…", sub: "เปิด GPS (ตำแหน่งแบบแม่นยำสูง) และอยู่ในที่โล่งจะเร็วและแม่นขึ้น", tone: MUTED };
    }
    if (pos.gps === "denied") {
      return { icon: <LocationOffRounded />, title: "ไม่ได้อนุญาตให้ใช้ตำแหน่ง", sub: "ยังบันทึกได้ — ระบบจะบันทึกว่า \"ไม่มีพิกัด\" · เปิดสิทธิ์ตำแหน่งในเบราว์เซอร์แล้วกดหาใหม่", tone: AMBER };
    }
    if (pos.gps !== "ok") {
      return { icon: <LocationOffRounded />, title: "หาตำแหน่งไม่เจอ", sub: "ยังบันทึกได้ — ลองออกไปที่โล่งแล้วกดหาใหม่", tone: AMBER };
    }
    const acc = pos.accuracy ? `แม่นยำ ±${Math.round(pos.accuracy)} ม.` : "";
    // ยังไม่แม่นพอ → บอกให้รอ GPS ปรับค่า (ตัวเลขลดลงเรื่อยๆ ระหว่างรอ)
    if (pos.accuracy > GPS_GOOD_M && gpsSettling) {
      const left = Math.max(0, Math.ceil((GPS_MIN_WAIT_MS - waitedMs) / 1000));
      return { icon: <CircularProgress size={18} />, title: `กำลังปรับตำแหน่งให้แม่นยำ · ±${pos.accuracy} ม.`, sub: `รอสักครู่ (${left} วิ) — ถือเครื่องนิ่งๆ ในที่โล่ง ตัวเลขยิ่งน้อยยิ่งแม่น`, tone: ACCENT };
    }
    if (pos.accuracy > GPS_OK_M) {
      return { icon: <MyLocationRounded />, title: `ตำแหน่งยังคลาดเคลื่อนมาก · ±${pos.accuracy} ม.`, sub: "เปิด GPS แบบแม่นยำสูง / ออกไปที่โล่งแล้วรอสักครู่ · ยังบันทึกได้ แต่แอดมินจะเห็นว่าความแม่นยำต่ำ", tone: AMBER };
    }
    if (dist == null) {
      return { icon: <MyLocationRounded />, title: "ได้ตำแหน่งแล้ว", sub: [acc, site ? "" : "ยังไม่มีพิกัดหน้างานในทะเบียนลูกค้า — บันทึกพิกัดอย่างเดียว"].filter(Boolean).join(" · "), tone: ACCENT };
    }
    return dist <= ON_SITE_M
      ? { icon: <CheckCircleRounded />, title: `อยู่ที่หน้างาน · ${fmtDistance(dist)}`, sub: acc, tone: GREEN }
      : { icon: <MyLocationRounded />, title: `ห่างจากหน้างาน ${fmtDistance(dist)}`, sub: [acc, "ยังบันทึกได้ แอดมินจะเห็นระยะห่างนี้"].filter(Boolean).join(" · "), tone: AMBER };
  }, [pos, dist, site, gpsSettling, waitedMs]);

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
          <Typography sx={{ fontWeight: 900, fontSize: "1.05rem", color: INK }}>บันทึกเข้างานวันนี้</Typography>
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
              <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>วันที่เข้างาน {new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "long", year: "numeric" }).format(new Date(serverNow))} · เวลาเข้างาน = เวลาที่กดยืนยัน</Typography>
            </Box>
          </Stack>
          <Stack direction="row" alignItems="center" gap={0.6} sx={{ mt: 1.25, pt: 1, borderTop: `1px dashed ${LINE}` }}>
            <LockClockOutlined sx={{ fontSize: 15, color: FAINT }} />
            <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>บันทึกเวลาจากเซิร์ฟเวอร์ แก้จากเครื่องไม่ได้ · ต้องการแก้ ขอผ่านแอดมิน</Typography>
          </Stack>
        </Box>

        {/* ตำแหน่ง — ไม่มีสิทธิ์/หา GPS ไม่ได้ → แผงขอให้เปิด GPS (แบบแอปทั่วไป) */}
        {gpsMissing ? (
          <GpsRequired kind={pos.gps === "denied" ? "denied" : "unavailable"} perm={perm} secure={secure} onRetry={locate} onRequest={requestPermission} onSkip={() => setSkipGps(true)} skipped={skipGps} />
        ) : (
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
        )}

        {/* รูปก่อนเริ่มงาน — บังคับอย่างน้อย 1 รูป */}
        <Section title="รูปหน้างาน" required hint={needPhoto ? "ต้องมีอย่างน้อย 1 รูป จึงกดเข้างานได้" : `${photos.length} รูป · บันทึกเป็นไฟล์แนบของงานนี้`}>
          <FileGrid items={photos} uploading={uploading} onRemove={removePhoto} onAdd={() => fileRef.current?.click()} addLabel="ถ่าย/เลือกรูป" highlight={needPhoto} />
          <input ref={fileRef} type="file" hidden multiple accept="image/*,.heic,.heif" onChange={onPick} />
        </Section>

        <Box sx={{ ...CARD, mb: 1.5, overflow: "hidden" }}>
          <ButtonBase onClick={() => setNoteOpen((v) => !v)} aria-expanded={noteOpen}
            sx={{ width: "100%", justifyContent: "space-between", px: 2, py: 1.5, fontFamily: "inherit", textAlign: "left" }}>
            <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: INK }}>เพิ่มหมายเหตุ <Box component="span" sx={{ fontWeight: 400, color: MUTED }}>(ถ้ามี)</Box></Typography>
            <ExpandMoreRounded sx={{ color: MUTED, transform: noteOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
          </ButtonBase>
          <Collapse in={noteOpen} unmountOnExit>
            <Box sx={{ px: 2, pb: 2 }}>
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
            </Box>
          </Collapse>
        </Box>
        {err && <Typography sx={{ mt: 2, fontSize: "0.82rem", fontWeight: 700, color: "#dc2626" }}>{err}</Typography>}
      </DialogContent>

      <DialogActions sx={{ px: { xs: 1.5, sm: 2.5 }, py: 1.25, borderTop: `1px solid ${LINE}`, gap: 1, bgcolor: "#fff" }}>
        <Button onClick={cancel} disabled={saving} sx={{ ...MBTN.ghost, px: 2 }}>ยกเลิก</Button>
        <Button variant="contained" disableElevation onClick={submit} disabled={!canSubmit}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <LoginRounded />}
          sx={{ ...MBTN.primary, flex: { xs: 1, sm: "0 0 auto" }, px: 3.5 }}>
          {saving ? "กำลังบันทึก…" : needPhoto ? "ถ่ายรูปก่อนกดเข้างาน" : gpsSettling ? "รอตำแหน่งให้แม่นยำ…" : gpsBlocked ? "เปิด GPS ก่อนบันทึก" : "ยืนยันเข้างาน"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
