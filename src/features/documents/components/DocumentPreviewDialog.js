/**
 * DocumentPreviewDialog — กล่อง "ดูตัวอย่างเอกสารก่อนออกจริง" ใช้ร่วมกันทั้งใบแจ้งเข้างานและใบส่งมอบงาน
 *
 * ✅ ทำไมต้องมีขั้นตอนนี้ (ตามที่ผู้ใช้ขอ): เอกสารทั้ง 2 ชนิดถูกส่งออกไปหาลูกค้าในนามบริษัทและ "กินเลขที่
 * เอกสารเดินหน้าอย่างเดียว" ตอนกดออก — ออกผิดแล้วย้อนไม่ได้ ต้องออกใบใหม่ทับซึ่งทำให้เลขกระโดด และลูกค้า
 * ได้เอกสารผิดไปแล้ว การได้เห็นหน้ากระดาษจริงก่อนกดยืนยันจึงเป็นด่านสุดท้ายที่กันความผิดพลาดได้จริง
 * (ต่างจากการเดาจากฟอร์ม ซึ่งไม่มีทางรู้ว่าข้อความตัดบรรทัดยังไง ยาวเกินหน้าไหม ตราประทับทับอะไรหรือเปล่า)
 *
 * ── ลำดับการทำงาน 2 ขั้น ─────────────────────────────────────────────────────
 *   ขั้นที่ 1  ตัวอย่าง (issued=false) — เลขที่เป็นเลข "ที่จะได้" จากการ peek เท่านั้น ยังไม่กินเลขจริง
 *              ปุ่มหลักคือ "ยืนยันออกเอกสาร"
 *   ขั้นที่ 2  ออกแล้ว (issued=true)  — กินเลขจริงและสร้างไฟล์ใหม่ด้วยเลขนั้น ปุ่มเปลี่ยนเป็น
 *              เปิดแท็บใหม่ / ดาวน์โหลด / แชร์
 * ⚠️ ปุ่มดาวน์โหลด/แชร์อยู่ในขั้นที่ 2 เท่านั้นโดยตั้งใจ — ไฟล์ในขั้นตัวอย่างยังไม่มีเลขที่จริง ถ้าปล่อยให้
 * ดาวน์โหลด/ส่งให้ลูกค้าได้ตั้งแต่ตอนนั้น จะมีเอกสารที่เลขไม่ตรงกับทะเบียนหลุดออกไปโดยไม่มีใครรู้
 */
import { useEffect, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Stack, Typography,
  Button, IconButton, Chip, Alert, useMediaQuery, CircularProgress, Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Close, ArrowBack, Download, Share, OpenInNew, CheckCircle, TaskAlt, ContentCopy,
} from "@mui/icons-material";

const BORDER_MAIN = "#e2e8f0";
const TEXT_SUB = "#64748b";

/**
 * ✅ แชร์ไฟล์ตรงจากเบราว์เซอร์ (Web Share API ระดับไฟล์) — บนมือถือจะเด้งแผงแชร์ของเครื่องให้เลือกส่งเข้า
 * LINE / อีเมล / แอปอะไรก็ได้ที่ติดตั้งไว้ ซึ่งเป็นวิธีที่คนหน้างานใช้ส่งเอกสารให้ลูกค้าจริงๆ
 * ⚠️ ต้องเช็ค canShare({files}) ไม่ใช่แค่ navigator.share — เบราว์เซอร์เดสก์ท็อปหลายตัวมี share แต่แชร์
 * "ไฟล์" ไม่ได้ ถ้าเรียกไปเลยจะโยน error ทั้งที่ผู้ใช้ไม่ได้ทำอะไรผิด
 */
export const canShareFile = (file) => {
  try {
    return Boolean(navigator?.canShare?.({ files: [file] }));
  } catch {
    return false;
  }
};

const DocumentPreviewDialog = ({
  open, onClose, title, accent, accentDark,
  preview,          // { url, blob, fileName } — ไฟล์ที่กำลังแสดงอยู่
  issued,           // ออกเลขจริงแล้วหรือยัง
  docNumber,        // เลขที่ที่กำลังแสดง (ตัวอย่าง หรือ เลขจริง)
  busy, error,
  onBack, onConfirm,
}) => {
  const isMobile = useMediaQuery("(max-width:600px)");
  const [shareState, setShareState] = useState(""); // "", "ok", "unsupported", "fail"

  // รีเซ็ตสถานะปุ่มแชร์ทุกครั้งที่ไฟล์เปลี่ยน (ออกเอกสารใหม่/กลับไปแก้แล้วดูตัวอย่างใหม่)
  useEffect(() => { setShareState(""); }, [preview?.url]);

  const handleShare = async () => {
    if (!preview?.blob) return;
    const file = new File([preview.blob], preview.fileName, { type: "application/pdf" });
    if (!canShareFile(file)) { setShareState("unsupported"); return; }
    try {
      await navigator.share({ files: [file], title: preview.fileName, text: title });
      setShareState("ok");
    } catch (err) {
      // ⚠️ ผู้ใช้กดยกเลิกแผงแชร์เองก็เข้ามาทางนี้ (AbortError) — ไม่ใช่ความผิดพลาด ไม่ต้องขึ้นข้อความอะไร
      if (err?.name !== "AbortError") setShareState("fail");
    }
  };

  const handleDownload = () => {
    if (!preview?.url) return;
    const link = document.createElement("a");
    link.href = preview.url;
    link.download = preview.fileName;
    link.click();
  };

  const handleCopyName = async () => {
    try {
      await navigator.clipboard.writeText(preview?.fileName || "");
      setShareState("copied");
    } catch { /* คลิปบอร์ดถูกปิดกั้น — ไม่ใช่เรื่องคอขาดบาดตาย */ }
  };

  return (
    <Dialog
      open={open}
      // ✅ ปิดได้เฉพาะปุ่มเท่านั้น — กล่องนี้อยู่บนสุดของขั้นตอนที่กรอกมายาวแล้ว เผลอแตะพื้นหลังทีเดียว
      // (โดยเฉพาะบนมือถือ) แล้วหลุดออกไปทั้งกระบวนการ ต้องกรอกใหม่ทั้งใบ
      onClose={(_, reason) => {
        if (busy) return;
        if (reason === "backdropClick" || reason === "escapeKeyDown") return;
        onClose?.();
      }}
      fullWidth maxWidth="lg" fullScreen={isMobile}
      PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3, height: isMobile ? "100%" : "92vh" } }}
    >
      <DialogTitle sx={{ p: 0 }}>
        <Stack
          direction="row" alignItems="center" spacing={1.5}
          sx={{ px: 2.5, py: 1.75, borderBottom: `1px solid ${BORDER_MAIN}` }}
        >
          <Box sx={{
            width: 38, height: 38, borderRadius: 2.5, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            bgcolor: alpha(issued ? "#16a34a" : accent, 0.1), color: issued ? "#16a34a" : accent,
          }}>
            {issued ? <TaskAlt sx={{ fontSize: 21 }} /> : <CheckCircle sx={{ fontSize: 21 }} />}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: "1.02rem", lineHeight: 1.3 }}>
              {issued ? `ออกเอกสารแล้ว · ${title}` : `ตัวอย่างก่อนออก · ${title}`}
            </Typography>
            <Typography variant="caption" sx={{ color: TEXT_SUB }}>
              {issued
                ? `เลขที่ ${docNumber || "-"} — บันทึกเข้าทะเบียนเรียบร้อย ส่งให้ลูกค้าได้เลย`
                : `เลขที่ที่จะได้คือ ${docNumber || "-"} · ยังไม่ถูกใช้จนกว่าจะกดยืนยัน`}
            </Typography>
          </Box>
          <IconButton onClick={onClose} disabled={busy}><Close /></IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 0, bgcolor: "#525659", display: "flex", flexDirection: "column" }}>
        {error && <Alert severity="error" sx={{ borderRadius: 0 }}>{error}</Alert>}
        {!issued && (
          <Alert
            severity="info" icon={false}
            sx={{
              borderRadius: 0, py: 0.5, bgcolor: alpha(accent, 0.12), color: accentDark,
              "& .MuiAlert-message": { py: 0.5, fontSize: "0.78rem", fontWeight: 600 },
            }}
          >
            ตรวจดูให้ครบก่อนกดยืนยัน — เมื่อยืนยันแล้วเลขที่เอกสารจะถูกใช้ไปและย้อนกลับไม่ได้
          </Alert>
        )}
        {shareState === "unsupported" && (
          <Alert severity="warning" sx={{ borderRadius: 0, "& .MuiAlert-message": { fontSize: "0.8rem" } }}>
            เบราว์เซอร์นี้แชร์ไฟล์โดยตรงไม่ได้ — กด "ดาวน์โหลด" แล้วแนบไฟล์ส่งเองได้เลย
          </Alert>
        )}
        {shareState === "fail" && (
          <Alert severity="error" sx={{ borderRadius: 0, "& .MuiAlert-message": { fontSize: "0.8rem" } }}>
            แชร์ไม่สำเร็จ — ลองใหม่อีกครั้ง หรือใช้ปุ่มดาวน์โหลดแทน
          </Alert>
        )}

        {/* ✅ แสดงหน้ากระดาษจริงด้วย <iframe> ชี้ไปที่ blob ของไฟล์ — ไม่ต้องอัปโหลดไปไหนทั้งสิ้น
            ⚠️ เบราว์เซอร์บางตัว (โดยเฉพาะ Safari บน iOS) ไม่เรนเดอร์ PDF ใน iframe ให้ จึงมีปุ่ม
            "เปิดในแท็บใหม่" กำกับไว้เสมอเป็นทางออกสำรอง ไม่ใช่ปล่อยให้เจอกรอบว่างแล้วงงว่าพังหรือเปล่า */}
        <Box sx={{ flex: 1, minHeight: 0, position: "relative" }}>
          {preview?.url ? (
            <Box
              component="iframe" title="ตัวอย่างเอกสาร" src={preview.url}
              sx={{ width: "100%", height: "100%", border: "none", display: "block" }}
            />
          ) : (
            <Stack alignItems="center" justifyContent="center" sx={{ height: "100%", color: "#fff" }} spacing={1.5}>
              <CircularProgress size={28} sx={{ color: "#fff" }} />
              <Typography variant="caption">กำลังสร้างตัวอย่างเอกสาร...</Typography>
            </Stack>
          )}
          {busy && preview?.url && (
            <Stack
              alignItems="center" justifyContent="center" spacing={1.5}
              sx={{ position: "absolute", inset: 0, bgcolor: alpha("#0f172a", 0.55), color: "#fff" }}
            >
              <CircularProgress size={30} sx={{ color: "#fff" }} />
              <Typography variant="caption" sx={{ fontWeight: 700 }}>กำลังออกเลขที่เอกสาร...</Typography>
            </Stack>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.5, borderTop: `1px solid ${BORDER_MAIN}`, gap: 1, flexWrap: "wrap" }}>
        {issued ? (
          <>
            <Chip
              size="small" icon={<TaskAlt sx={{ fontSize: 15 }} />} label={`เลขที่ ${docNumber}`}
              sx={{ mr: "auto", fontWeight: 700, bgcolor: alpha("#16a34a", 0.12), color: "#15803d" }}
            />
            <Tooltip title="คัดลอกชื่อไฟล์">
              <IconButton size="small" onClick={handleCopyName} sx={{ color: TEXT_SUB }}>
                <ContentCopy sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Button
              onClick={() => window.open(preview?.url, "_blank")}
              startIcon={<OpenInNew sx={{ fontSize: 18 }} />}
              sx={{ textTransform: "none", fontWeight: 700, color: TEXT_SUB }}
            >
              เปิดแท็บใหม่
            </Button>
            <Button
              onClick={handleDownload} startIcon={<Download sx={{ fontSize: 18 }} />}
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              ดาวน์โหลด
            </Button>
            <Button
              variant="contained" onClick={handleShare} startIcon={<Share sx={{ fontSize: 18 }} />}
              sx={{
                textTransform: "none", fontWeight: 700, borderRadius: 2, boxShadow: "none",
                bgcolor: accent, px: 2, "&:hover": { bgcolor: accentDark, boxShadow: "none" },
              }}
            >
              แชร์เอกสาร
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={onBack} disabled={busy} startIcon={<ArrowBack sx={{ fontSize: 18 }} />}
              sx={{ mr: "auto", textTransform: "none", fontWeight: 700, color: TEXT_SUB }}
            >
              กลับไปแก้ไข
            </Button>
            <Button
              onClick={() => window.open(preview?.url, "_blank")} disabled={busy || !preview?.url}
              startIcon={<OpenInNew sx={{ fontSize: 18 }} />}
              sx={{ textTransform: "none", fontWeight: 700, color: TEXT_SUB }}
            >
              เปิดแท็บใหม่
            </Button>
            <Button
              variant="contained" onClick={onConfirm} disabled={busy || !preview?.url}
              startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <TaskAlt sx={{ fontSize: 18 }} />}
              sx={{
                textTransform: "none", fontWeight: 700, borderRadius: 2, boxShadow: "none",
                bgcolor: accent, px: 2, "&:hover": { bgcolor: accentDark, boxShadow: "none" },
              }}
            >
              {busy ? "กำลังออกเอกสาร..." : "ยืนยันออกเอกสาร"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DocumentPreviewDialog;
