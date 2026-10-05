/**
 * SignatureSettingsDialog — ตั้งค่า "ลายเซ็นอิเล็กทรอนิกส์" ของผู้ใช้เอง
 *
 * ✅ ผู้ใช้ขอ: เซ็ตลายเซ็นไว้ที่ user แล้วระบบนำไปใช้กับเอกสาร PDF ที่ออกทั้งหมด
 * ✅ (5 ต.ค. 2569) ผู้ใช้: "หน้าลายเซ็นทำยาก และไม่สวย ปรับปรุงให้มืออาชีพและสมบูรณ์"
 *   • 2 หน้าจอชัดเจน: "ลายเซ็นปัจจุบัน" (ดูตัวอย่างบนเอกสาร + ปุ่มเปลี่ยน/ลบ) กับ "ตั้งลายเซ็นใหม่"
 *     (เดิมทุกอย่างกองในหน้าเดียว — ทั้งตัวอย่าง กระดานเซ็น เงื่อนไข — ทั้งที่ตั้งไว้แล้ว)
 *   • ขั้นตอนมีเลข 1-2-3: เลือกวิธี → เซ็น/อัปโหลด → ยืนยัน · ตัวอย่างบนเอกสารอัปเดตทันทีหลังเซ็นแต่ละเส้น
 *   • ปุ่มบันทึกกดได้เมื่อพร้อมจริง (มีลายเซ็น + ติ๊กยินยอม) และบอกว่ายังขาดอะไร
 *   • ธีมน้ำเงินของแอป · สีแดงเฉพาะการลบ
 * ⚠️ ลบลายเซ็น = เลิกใช้กับใบ "ใหม่" เท่านั้น ใบที่ลงนามไปแล้วยังพิมพ์ซ้ำได้เหมือนเดิม (ดู server models/SignatureImage.js)
 */
import { useEffect, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogActions, Button, Box, Stack, Typography, IconButton, Alert, CircularProgress,
  Checkbox, ButtonBase, useMediaQuery, Snackbar,
} from "@mui/material";
import {
  Close, DeleteOutline, UploadFile, Draw, CheckCircle, HistoryEdu, Edit, LockOutlined, ArrowBack, ImageOutlined,
} from "@mui/icons-material";

import SignaturePad from "@/shared/components/SignaturePad";
import SignatureService from "@/shared/services/SignatureService";
import { dataUrlBytes, fileToSignaturePng } from "@/shared/utils/signatureImage";
import { useAuth } from "@/features/auth/AuthContext";
import { thaiDateTime } from "@/shared/utils/thaiDate";
import { titleOf, rankLabel } from "@/shared/utils/roles";
import { INK, INK_2, MUTED, FAINT, LINE, SURFACE, ACCENT, ACCENT_SOFT, ACCENT_LINE } from "@/shared/ui/PageKit";

const RED = "#dc2626";

/** ตัวอย่างการวางลายเซ็นบนเอกสารจริง (ช่องลงนามท้ายใบ) */
const DocumentPreview = ({ image, name, position, big }) => (
  <Box sx={{ position: "relative", px: 2, pt: 1.5, pb: 2, borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${LINE}`, backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 23px, #f8fafc 23px, #f8fafc 24px)" }}>
    <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, color: FAINT, letterSpacing: ".04em" }}>ตัวอย่างช่องลงนามบนเอกสาร PDF</Typography>
    <Box sx={{ maxWidth: 260, mx: "auto", textAlign: "center", mt: 1 }}>
      <Box sx={{ height: big ? 72 : 56, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
        {image
          ? <Box component="img" src={image} alt="ลายเซ็น" sx={{ maxHeight: big ? 70 : 54, maxWidth: "100%", objectFit: "contain" }} />
          : <Typography sx={{ color: "#cbd5e1", fontSize: "0.8rem", pb: 1 }}>(ลายเซ็นจะอยู่ตรงนี้)</Typography>}
      </Box>
      <Box sx={{ borderBottom: `1px dotted ${FAINT}`, mb: 0.75 }} />
      <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>( {name || "ชื่อ-นามสกุล"} )</Typography>
      <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{position || "ตำแหน่ง"}</Typography>
    </Box>
  </Box>
);

const Step = ({ n, title, hint, children, done }) => (
  <Box>
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
      <Box sx={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.76rem", fontWeight: 900, bgcolor: done ? "#16a34a" : ACCENT, color: "#fff" }}>
        {done ? <CheckCircle sx={{ fontSize: 16 }} /> : n}
      </Box>
      <Typography sx={{ fontWeight: 800, fontSize: "0.92rem", color: INK }}>{title}</Typography>
      {hint && <Typography sx={{ fontSize: "0.74rem", color: MUTED, display: { xs: "none", sm: "block" } }}>{hint}</Typography>}
    </Stack>
    {children}
  </Box>
);

export default function SignatureSettingsDialog({ open, onClose, onSaved }) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const { userData } = useAuth();
  const padRef = useRef(null);
  const fileRef = useRef(null);

  const [mode, setMode] = useState("view");   // view = ดูลายเซ็นปัจจุบัน · edit = ตั้งใหม่
  const [method, setMethod] = useState("draw");
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");     // รูปจากการอัปโหลด
  const [drawn, setDrawn] = useState("");     // รูปจากกระดานเซ็น (อัปเดตทุกเส้น)
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [askDelete, setAskDelete] = useState(false);
  const [toast, setToast] = useState("");

  const fullName = [userData?.fname, userData?.lname].filter(Boolean).join(" ") || userData?.username || "";
  const position = titleOf(userData) || rankLabel(userData) || "";

  const reset = () => { setDraft(""); setDrawn(""); setConsent(false); setError(""); padRef.current?.clear?.(); };

  useEffect(() => {
    if (!open) return;
    setMethod("draw"); setAskDelete(false); reset();
    setLoading(true);
    SignatureService.me({ force: true })
      .then((sig) => { setCurrent(sig); setMode(sig ? "view" : "edit"); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onPadChange = (hasInk) => setDrawn(hasInk ? padRef.current?.toPng() || "" : "");

  const pickFile = async (file) => {
    setError("");
    try { setDraft(await fileToSignaturePng(file)); }
    catch (err) { setDraft(""); setError(err.message || "อ่านไฟล์รูปไม่สำเร็จ"); }
  };

  const image = method === "draw" ? drawn : draft;
  const tooBig = image && dataUrlBytes(image) > 300 * 1024;
  const missing = !image ? (method === "draw" ? "เซ็นชื่อในกรอบ" : "เลือกรูปลายเซ็น") : !consent ? "ติ๊กยินยอมการใช้ลายเซ็น" : tooBig ? "ไฟล์ใหญ่เกิน 300 KB" : "";

  const save = async () => {
    if (missing) { setError(`ยังไม่ครบ: ${missing}`); return; }
    setSaving(true); setError("");
    try {
      const sig = await SignatureService.save({ image, method: method === "draw" ? "draw" : "upload", consent: true });
      setCurrent(sig);
      onSaved?.(sig);
      reset();
      setMode("view");
      setToast("บันทึกลายเซ็นแล้ว — ใช้กับเอกสารใบถัดไปที่คุณออกหรืออนุมัติ");
    } catch (err) {
      setError(err?.response?.data?.message || "บันทึกลายเซ็นไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await SignatureService.remove();
      setCurrent(null); onSaved?.(null);
      setAskDelete(false); setMode("edit");
      setToast("ลบลายเซ็นแล้ว");
    } catch (err) {
      setError(err?.response?.data?.message || "ลบลายเซ็นไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose?.()} fullWidth maxWidth="sm" fullScreen={isMobile}
      PaperProps={{ sx: { borderRadius: { sm: 3 } } }}>
      {/* หัว */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: { xs: 2, sm: 2.5 }, py: 1.75, borderBottom: `1px solid ${LINE}` }}>
        {mode === "edit" && current ? (
          <IconButton size="small" onClick={() => { reset(); setMode("view"); }} disabled={saving} aria-label="กลับ"><ArrowBack /></IconButton>
        ) : (
          <Box sx={{ width: 38, height: 38, borderRadius: 2.5, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: ACCENT_SOFT, color: ACCENT }}>
            <HistoryEdu />
          </Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900, fontSize: "1.02rem", color: INK }}>{mode === "edit" ? (current ? "เปลี่ยนลายเซ็น" : "ตั้งลายเซ็นอิเล็กทรอนิกส์") : "ลายเซ็นอิเล็กทรอนิกส์"}</Typography>
          <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>ใช้แทนการเซ็นมือ ในเอกสาร PDF ที่คุณเป็นผู้ออกหรือผู้อนุมัติ</Typography>
        </Box>
        <IconButton onClick={onClose} disabled={saving} aria-label="ปิด"><Close /></IconButton>
      </Stack>

      <DialogContent sx={{ bgcolor: SURFACE, px: { xs: 2, sm: 2.5 }, py: 2 }}>
        {loading ? (
          <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress size={26} /></Stack>
        ) : mode === "view" && current ? (
          /* ── ลายเซ็นปัจจุบัน ── */
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.5, py: 1.1, borderRadius: 2.5, bgcolor: "#f0fdf4", border: "1px solid #bbf7d0" }}>
              <CheckCircle sx={{ color: "#16a34a", fontSize: 20 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 800, fontSize: "0.88rem", color: "#166534" }}>ตั้งลายเซ็นไว้แล้ว</Typography>
                <Typography sx={{ fontSize: "0.74rem", color: "#15803d" }}>
                  {current.method === "upload" ? "อัปโหลดจากรูป" : "เซ็นบนหน้าจอ"} · อัปเดต {thaiDateTime(current.updatedAt)}
                </Typography>
              </Box>
            </Stack>
            <DocumentPreview image={current.image} name={fullName} position={position} big />
            <Box sx={{ px: 1.5, py: 1.25, borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${LINE}` }}>
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: INK_2, mb: 0.5 }}>ลายเซ็นนี้ถูกใช้ที่ไหน</Typography>
              <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.6 }}>
                ใบเบิก Advance · ใบเคลม · ใบเบิกค่าจ้างผู้รับเหมา · ใบขอซื้อ (ช่องผู้ขอ/ผู้ตรวจสอบ/ผู้อนุมัติ ที่เป็นคุณ)
                และใบแจ้งเข้างาน / ใบส่งมอบงานที่คุณเป็นผู้ลงนาม
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ px: 0.5 }}>
              <LockOutlined sx={{ fontSize: 16, color: MUTED, mt: 0.2 }} />
              <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.55 }}>
                เก็บแยกจากข้อมูลผู้ใช้ทั่วไป · ไม่มีใครดึงรูปลายเซ็นของคุณไปใช้ได้ · ระบบผนึกลงเอกสารเฉพาะตอนที่คุณกดออกใบหรืออนุมัติเอง
              </Typography>
            </Stack>
            {askDelete && (
              <Alert severity="warning" sx={{ borderRadius: 2.5 }}
                action={(
                  <Stack direction="row" spacing={0.5}>
                    <Button size="small" onClick={() => setAskDelete(false)} disabled={saving} sx={{ textTransform: "none", color: INK_2 }}>ยกเลิก</Button>
                    <Button size="small" variant="contained" onClick={remove} disabled={saving}
                      sx={{ textTransform: "none", fontWeight: 800, bgcolor: RED, boxShadow: "none", "&:hover": { bgcolor: "#b91c1c", boxShadow: "none" } }}>ลบ</Button>
                  </Stack>
                )}>
                ลบลายเซ็น? ใบใหม่จะเว้นช่องให้เซ็นมือ · เอกสารที่ลงนามไปแล้วยังคงลายเซ็นเดิม
              </Alert>
            )}
          </Stack>
        ) : (
          /* ── ตั้ง/เปลี่ยนลายเซ็น ── */
          <Stack spacing={2.25}>
            {error && <Alert severity="error" onClose={() => setError("")} sx={{ borderRadius: 2.5 }}>{error}</Alert>}

            <Step n={1} title="เลือกวิธี" done={Boolean(image)}>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                {[["draw", "เซ็นบนหน้าจอ", "ใช้นิ้วหรือเมาส์", <Draw key="i" />], ["upload", "อัปโหลดรูป", "เซ็นบนกระดาษแล้วถ่ายรูป", <ImageOutlined key="i" />]].map(([k, t, d, ic]) => {
                  const on = method === k;
                  return (
                    <ButtonBase key={k} onClick={() => { setMethod(k); setError(""); }} sx={{
                      justifyContent: "flex-start", gap: 1.25, p: 1.25, borderRadius: 2.5, textAlign: "left", fontFamily: "inherit",
                      bgcolor: on ? ACCENT_SOFT : "#fff", border: `1.5px solid ${on ? ACCENT : LINE}`,
                    }}>
                      <Box sx={{ color: on ? ACCENT : MUTED, display: "flex" }}>{ic}</Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: "0.86rem", color: on ? "#1d4ed8" : INK }}>{t}</Typography>
                        <Typography sx={{ fontSize: "0.7rem", color: MUTED }}>{d}</Typography>
                      </Box>
                    </ButtonBase>
                  );
                })}
              </Box>
            </Step>

            <Step n={2} title={method === "draw" ? "เซ็นชื่อในกรอบ" : "เลือกรูปลายเซ็น"} hint={method === "draw" ? "เซ็นเหนือเส้นให้ใหญ่พอดีกรอบ" : "ระบบลบพื้นหลังและครอปให้เอง"} done={Boolean(image)}>
              <Box sx={{ p: 1.25, bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 2.5 }}>
                {method === "draw" ? (
                  <SignaturePad ref={padRef} onChange={onPadChange} height={isMobile ? 180 : 200} />
                ) : (
                  <>
                    <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); e.target.value = ""; }} />
                    {draft ? (
                      <Stack alignItems="center" spacing={1} sx={{ py: 1 }}>
                        <Box component="img" src={draft} alt="" sx={{ maxHeight: 110, maxWidth: "100%", objectFit: "contain" }} />
                        <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>ลบพื้นหลังแล้ว · {Math.max(1, Math.round(dataUrlBytes(draft) / 1024))} KB</Typography>
                        <Button size="small" startIcon={<UploadFile />} onClick={() => fileRef.current?.click()} sx={{ textTransform: "none", fontWeight: 700, color: ACCENT }}>เลือกรูปใหม่</Button>
                      </Stack>
                    ) : (
                      <ButtonBase onClick={() => fileRef.current?.click()} sx={{
                        width: "100%", flexDirection: "column", gap: 0.75, py: 4, borderRadius: 2, fontFamily: "inherit",
                        border: `1.5px dashed ${ACCENT_LINE}`, bgcolor: ACCENT_SOFT, color: ACCENT, "&:hover": { borderColor: ACCENT },
                      }}>
                        <UploadFile sx={{ fontSize: 32 }} />
                        <Typography sx={{ fontWeight: 800, fontSize: "0.9rem" }}>เลือกรูปลายเซ็น</Typography>
                        <Typography sx={{ fontSize: "0.72rem", color: MUTED, px: 2 }}>เซ็นด้วยปากกาสีเข้มบนกระดาษขาว ถ่ายในที่สว่าง · PNG / JPG / WEBP</Typography>
                      </ButtonBase>
                    )}
                  </>
                )}
              </Box>
              {image && <Box sx={{ mt: 1.25 }}><DocumentPreview image={image} name={fullName} position={position} /></Box>}
            </Step>

            <Step n={3} title="ยืนยันการใช้ลายเซ็น" done={consent}>
              <ButtonBase onClick={() => setConsent((v) => !v)} sx={{
                width: "100%", alignItems: "flex-start", gap: 1, p: 1.25, borderRadius: 2.5, textAlign: "left", fontFamily: "inherit",
                bgcolor: consent ? ACCENT_SOFT : "#fff", border: `1px solid ${consent ? ACCENT_LINE : LINE}`,
              }}>
                <Checkbox checked={consent} size="small" sx={{ p: 0, mt: 0.1, "&.Mui-checked": { color: ACCENT } }} tabIndex={-1} />
                <Typography sx={{ fontSize: "0.82rem", lineHeight: 1.5, color: INK_2 }}>
                  ข้าพเจ้ายินยอมให้ระบบใช้ลายเซ็นนี้แทนการลงนามด้วยมือ ในเอกสารที่ข้าพเจ้าเป็นผู้ออกหรือผู้อนุมัติเอง
                  และรับผิดชอบต่อเอกสารที่ลงนามด้วยลายเซ็นนี้
                </Typography>
              </ButtonBase>
              <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mt: 1, px: 0.5 }}>
                <LockOutlined sx={{ fontSize: 15, color: MUTED, mt: 0.2 }} />
                <Typography sx={{ fontSize: "0.72rem", color: MUTED, lineHeight: 1.5 }}>
                  เก็บแยกจากข้อมูลผู้ใช้ทั่วไป · ผนึกลงเอกสารเฉพาะตอนที่คุณกดออกใบหรืออนุมัติเอง
                </Typography>
              </Stack>
            </Step>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: { xs: 2, sm: 2.5 }, py: 1.5, borderTop: `1px solid ${LINE}`, gap: 1, flexWrap: { xs: "wrap", sm: "nowrap" }, "& > :not(style) ~ :not(style)": { ml: 0 } }}>
        {mode === "view" && current ? (
          <>
            <Button onClick={() => setAskDelete(true)} disabled={saving || askDelete} startIcon={<DeleteOutline />}
              sx={{ textTransform: "none", fontWeight: 700, color: RED, mr: "auto" }}>
              ลบลายเซ็น
            </Button>
            <Button onClick={onClose} sx={{ textTransform: "none", fontWeight: 700, color: MUTED }}>ปิด</Button>
            <Button variant="contained" startIcon={<Edit />} onClick={() => { reset(); setMode("edit"); }}
              sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: ACCENT, "&:hover": { bgcolor: "#1d4ed8", boxShadow: "none" } }}>
              เปลี่ยนลายเซ็น
            </Button>
          </>
        ) : (
          <>
            <Typography sx={{ mr: "auto", width: { xs: "100%", sm: "auto" }, fontSize: "0.74rem", color: missing ? "#b45309" : "#16a34a", fontWeight: 700 }}>
              {loading ? "" : missing ? `ยังขาด: ${missing}` : "พร้อมบันทึก"}
            </Typography>
            <Button onClick={() => (current ? (reset(), setMode("view")) : onClose?.())} disabled={saving} sx={{ textTransform: "none", fontWeight: 700, color: MUTED }}>
              ยกเลิก
            </Button>
            <Button variant="contained" onClick={save} disabled={saving || loading || Boolean(missing)}
              startIcon={saving ? <CircularProgress size={15} color="inherit" /> : <CheckCircle />}
              sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: ACCENT, "&:hover": { bgcolor: "#1d4ed8", boxShadow: "none" } }}>
              {current ? "บันทึกลายเซ็นใหม่" : "บันทึกลายเซ็น"}
            </Button>
          </>
        )}
      </DialogActions>

      <Snackbar open={Boolean(toast)} autoHideDuration={2600} onClose={() => setToast("")} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="success" variant="filled" onClose={() => setToast("")}>{toast}</Alert>
      </Snackbar>
    </Dialog>
  );
}
