/**
 * SignatureSettingsDialog — ตั้งค่า "ลายเซ็นอิเล็กทรอนิกส์" ของผู้ใช้เอง
 *
 * ✅ ผู้ใช้ขอ: เซ็ตลายเซ็นไว้ที่ user แล้วระบบนำไปใช้กับเอกสาร PDF ที่ออกทั้งหมด
 * เซ็นครั้งเดียวที่นี่ → ใบเบิก/ใบเคลมที่ตัวเองออกหรืออนุมัติ และใบแจ้งเข้างาน/ใบส่งมอบงานที่ตัวเอง
 * เป็นผู้ลงนาม จะมีลายเซ็นขึ้นให้อัตโนมัติ ไม่ต้องพรินต์มาเซ็นมือแล้วสแกนกลับเข้าระบบทุกใบ
 *
 * ✅ 2 วิธี: วาดเอง (นิ้ว/เมาส์) หรืออัปโหลดรูปลายเซ็นบนกระดาษ — ระบบลบพื้นหลังและครอปให้เอง
 * ✅ ต้องกดยอมรับเงื่อนไขก่อนบันทึกทุกครั้ง (หลักฐานความยินยอมใช้แทนการเซ็นมือ)
 *
 * ⚠️ ลบลายเซ็น = เลิกใช้กับใบ "ใหม่" เท่านั้น ใบที่ลงนามไปแล้วยังพิมพ์ซ้ำได้เหมือนเดิมตามกฎหมาย
 * เอกสาร (ดู da-app-server/src/models/SignatureImage.js)
 */
import { useEffect, useRef, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography, IconButton,
  Tabs, Tab, Alert, CircularProgress, Checkbox, FormControlLabel, Chip, Divider, useMediaQuery,
} from "@mui/material";
import {
  Close, Save, DeleteOutline, UploadFile, Draw, CheckCircle, HistoryEdu,
} from "@mui/icons-material";
import Swal from "sweetalert2";

import SignaturePad from "@/shared/components/SignaturePad";
import SignatureService from "@/shared/services/SignatureService";
import { dataUrlBytes, fileToSignaturePng } from "@/shared/utils/signatureImage";
import { useAuth } from "@/features/auth/AuthContext";
import { thaiDateTime } from "@/shared/utils/thaiDate";

const ACCENT = "#dc2626";
const TEXT_SUB = "#64748b";

/** ตัวอย่างการวางลายเซ็นบนเอกสารจริง — ให้ผู้ใช้เห็นก่อนบันทึกว่าออกมาหน้าตาแบบไหนในใบ PDF */
const DocumentPreview = ({ image, name, position }) => (
  <Box sx={{ border: "1px solid #e2e8f0", borderRadius: 2, p: 2, bgcolor: "#fff" }}>
    <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 700, display: "block", mb: 1 }}>
      ตัวอย่างบนเอกสาร
    </Typography>
    <Box sx={{ maxWidth: 240, mx: "auto", textAlign: "center" }}>
      <Box sx={{ height: 52, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
        {image
          ? <Box component="img" src={image} alt="" sx={{ maxHeight: 50, maxWidth: "100%", objectFit: "contain" }} />
          : <Typography sx={{ color: "#cbd5e1", fontSize: "0.8rem", pb: 1 }}>(ยังไม่มีลายเซ็น)</Typography>}
      </Box>
      <Box sx={{ borderBottom: "1px dotted #94a3b8", mb: 0.75 }} />
      <Typography sx={{ fontSize: "0.85rem", fontWeight: 700 }}>( {name || "ชื่อ-นามสกุล"} )</Typography>
      <Typography sx={{ fontSize: "0.8rem", color: TEXT_SUB }}>{position || "ตำแหน่ง"}</Typography>
    </Box>
  </Box>
);

export default function SignatureSettingsDialog({ open, onClose, onSaved }) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const { userData } = useAuth();
  const padRef = useRef(null);
  const fileRef = useRef(null);

  const [tab, setTab] = useState(0);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [padInk, setPadInk] = useState(false);

  const fullName = [userData?.fname, userData?.lname].filter(Boolean).join(" ") || userData?.username || "";

  useEffect(() => {
    if (!open) return;
    setTab(0); setDraft(""); setConsent(false); setError(""); setPadInk(false);
    setLoading(true);
    SignatureService.me({ force: true })
      .then((sig) => setCurrent(sig))
      .finally(() => setLoading(false));
  }, [open]);

  /** ✅ ดึงรูปจากกระดานวาดตอน "กดบันทึก" เท่านั้น — ระหว่างวาดไม่ต้องแปลงรูปทุกเส้นให้เครื่องช้า */
  const collect = async () => {
    if (tab === 0) {
      const png = padRef.current?.toPng() || "";
      if (!png) return { error: "กรุณาเซ็นชื่อในกรอบก่อน" };
      return { image: png, method: "draw" };
    }
    if (!draft) return { error: "กรุณาเลือกไฟล์รูปลายเซ็น" };
    return { image: draft, method: "upload" };
  };

  const pickFile = async (file) => {
    setError("");
    try {
      const png = await fileToSignaturePng(file);
      setDraft(png);
    } catch (err) {
      setDraft("");
      setError(err.message || "อ่านไฟล์รูปไม่สำเร็จ");
    }
  };

  const save = async () => {
    setError("");
    const got = await collect();
    if (got.error) { setError(got.error); return; }
    if (!consent) { setError("กรุณากดยอมรับเงื่อนไขการใช้ลายเซ็นอิเล็กทรอนิกส์"); return; }
    // ⚠️ กันเคสรูปถ่ายความละเอียดสูงที่ยังใหญ่เกินหลังบีบ — บอกก่อนยิง ไม่ให้ไปเจอ error จาก server
    if (dataUrlBytes(got.image) > 300 * 1024) {
      setError("ไฟล์ลายเซ็นใหญ่เกิน 300 KB — ลองครอปรูปให้เหลือเฉพาะลายเซ็นก่อนอัปโหลด");
      return;
    }
    setSaving(true);
    try {
      const sig = await SignatureService.save({ image: got.image, method: got.method, consent: true });
      setCurrent(sig);
      setDraft("");
      setConsent(false);
      padRef.current?.clear();
      setPadInk(false);
      onSaved?.(sig);
      Swal.fire({ title: "บันทึกลายเซ็นแล้ว", icon: "success", timer: 1300, showConfirmButton: false });
    } catch (err) {
      setError(err?.response?.data?.message || "บันทึกลายเซ็นไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await Swal.fire({
      title: "ลบลายเซ็นของฉัน?",
      html: "ใบใหม่จะพิมพ์ออกมาเป็นช่องว่างให้เซ็นด้วยมือ<br/><b>เอกสารที่ลงนามไปแล้วยังคงลายเซ็นเดิมไว้</b>",
      icon: "warning", showCancelButton: true, confirmButtonText: "ลบลายเซ็น", cancelButtonText: "ยกเลิก",
      confirmButtonColor: ACCENT,
    });
    if (!ok.isConfirmed) return;
    setSaving(true);
    try {
      await SignatureService.remove();
      setCurrent(null);
      onSaved?.(null);
    } catch (err) {
      setError(err?.response?.data?.message || "ลบลายเซ็นไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const previewImage = tab === 0 ? (padInk ? "" : current?.image || "") : draft || current?.image || "";

  return (
    <Dialog open={open} onClose={() => !saving && onClose?.()} fullWidth maxWidth="sm" fullScreen={isMobile}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.25}>
          <HistoryEdu sx={{ color: ACCENT }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: "1rem" }}>ลายเซ็นอิเล็กทรอนิกส์</Typography>
            <Typography variant="caption" sx={{ color: TEXT_SUB }}>
              ใช้กับเอกสาร PDF ที่คุณเป็นผู้ออกหรือผู้อนุมัติ
            </Typography>
          </Box>
          <IconButton onClick={onClose} disabled={saving}><Close /></IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ bgcolor: "#f8fafc" }}>
        {loading ? (
          <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress size={22} /></Stack>
        ) : (
          <Stack spacing={1.75}>
            {error && <Alert severity="error" onClose={() => setError("")} sx={{ borderRadius: 2 }}>{error}</Alert>}

            {current ? (
              <Alert icon={<CheckCircle fontSize="small" />} severity="success" sx={{ borderRadius: 2, "& .MuiAlert-message": { width: "100%" } }}>
                <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
                  <Typography sx={{ fontSize: "0.85rem", fontWeight: 700 }}>ตั้งลายเซ็นไว้แล้ว</Typography>
                  <Chip size="small" label={current.method === "upload" ? "อัปโหลดรูป" : "วาดเอง"} sx={{ height: 20, fontSize: "0.7rem" }} />
                  <Typography variant="caption" sx={{ color: TEXT_SUB }}>
                    อัปเดต {thaiDateTime(current.updatedAt)}
                  </Typography>
                </Stack>
              </Alert>
            ) : (
              <Alert severity="info" sx={{ borderRadius: 2, fontSize: "0.85rem" }}>
                ยังไม่ได้ตั้งลายเซ็น — เอกสารที่ออกจะเว้นช่องไว้ให้เซ็นด้วยมือตามเดิม
              </Alert>
            )}

            <DocumentPreview image={previewImage} name={fullName} position={userData?.position || userData?.role || ""} />

            <Box sx={{ bgcolor: "#fff", border: "1px solid #e2e8f0", borderRadius: 2 }}>
              <Tabs
                value={tab}
                onChange={(_, v) => { setTab(v); setError(""); }}
                sx={{
                  minHeight: 42, borderBottom: "1px solid #f1f5f9",
                  "& .MuiTab-root": { minHeight: 42, textTransform: "none", fontWeight: 700, fontSize: "0.85rem" },
                  "& .Mui-selected": { color: `${ACCENT} !important` },
                  "& .MuiTabs-indicator": { backgroundColor: ACCENT },
                }}
              >
                <Tab icon={<Draw sx={{ fontSize: 17 }} />} iconPosition="start" label="เซ็นเอง" />
                <Tab icon={<UploadFile sx={{ fontSize: 17 }} />} iconPosition="start" label="อัปโหลดรูปลายเซ็น" />
              </Tabs>
              <Box sx={{ p: 1.5 }}>
                {tab === 0 ? (
                  <SignaturePad ref={padRef} onChange={setPadInk} height={isMobile ? 160 : 190} />
                ) : (
                  <Stack spacing={1}>
                    <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); e.target.value = ""; }} />
                    <Button variant="outlined" startIcon={<UploadFile />} onClick={() => fileRef.current?.click()}
                      sx={{ textTransform: "none", fontWeight: 700, borderColor: "#cbd5e1", color: "#334155" }}>
                      เลือกรูปลายเซ็น
                    </Button>
                    <Typography variant="caption" sx={{ color: TEXT_SUB }}>
                      เซ็นบนกระดาษขาวแล้วถ่ายรูปในที่สว่าง · ระบบจะลบพื้นหลังและครอปให้เอง (PNG / JPG / WEBP)
                    </Typography>
                    {draft && (
                      <Box sx={{ mt: 0.5, p: 1, border: "1px dashed #cbd5e1", borderRadius: 2, textAlign: "center", bgcolor: "#fff" }}>
                        <Box component="img" src={draft} alt="" sx={{ maxHeight: 90, maxWidth: "100%", objectFit: "contain" }} />
                        <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 0.5 }}>
                          พื้นหลังถูกลบแล้ว · {Math.max(1, Math.round(dataUrlBytes(draft) / 1024))} KB
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                )}
              </Box>
            </Box>

            <Box sx={{ bgcolor: "#fff", border: "1px solid #e2e8f0", borderRadius: 2, p: 1.5 }}>
              <FormControlLabel
                control={<Checkbox size="small" checked={consent} onChange={(e) => setConsent(e.target.checked)} sx={{ "&.Mui-checked": { color: ACCENT } }} />}
                label={(
                  <Typography sx={{ fontSize: "0.82rem", lineHeight: 1.45 }}>
                    ข้าพเจ้ายินยอมให้ระบบใช้ลายเซ็นนี้แทนการลงนามด้วยมือ ในเอกสารที่ข้าพเจ้าเป็นผู้ออกหรือผู้อนุมัติเอง
                    และรับผิดชอบต่อเอกสารที่ลงนามด้วยลายเซ็นนี้
                  </Typography>
                )}
              />
              <Divider sx={{ my: 1 }} />
              <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", lineHeight: 1.5 }}>
                🔒 ลายเซ็นของคุณถูกเก็บแยกจากข้อมูลผู้ใช้ทั่วไป · ไม่มีใครดึงรูปลายเซ็นของคุณไปใช้ได้
                ระบบจะผนึกลายเซ็นลงเอกสารเฉพาะตอนที่<b>คุณกดออกใบหรือกดอนุมัติเอง</b>เท่านั้น
              </Typography>
            </Box>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.5 }}>
        {current && (
          <Button onClick={remove} disabled={saving} startIcon={<DeleteOutline />}
            sx={{ textTransform: "none", color: TEXT_SUB, mr: "auto" }}>
            ลบลายเซ็น
          </Button>
        )}
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: "none", color: TEXT_SUB }}>ปิด</Button>
        <Button
          variant="contained" onClick={save} disabled={saving || loading}
          startIcon={saving ? <CircularProgress size={15} color="inherit" /> : <Save />}
          sx={{ textTransform: "none", fontWeight: 800, bgcolor: ACCENT, "&:hover": { bgcolor: "#b91c1c" } }}
        >
          {current ? "บันทึกลายเซ็นใหม่" : "บันทึกลายเซ็น"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
