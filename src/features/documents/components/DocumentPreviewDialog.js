/**
 * DocumentPreviewDialog — กล่อง "ดูตัวอย่างเอกสารก่อนออกจริง" ใช้ร่วมกันทั้งใบแจ้งเข้างานและใบส่งมอบงาน
 *
 * ✅ ทำไมต้องมีขั้นตอนนี้ (ตามที่ผู้ใช้ขอ): เอกสารทั้ง 2 ชนิดถูกส่งออกไปหาลูกค้าในนามบริษัทและ "กินเลขที่
 * เอกสารเดินหน้าอย่างเดียว" ตอนกดออก — ออกผิดแล้วย้อนไม่ได้ การได้เห็นหน้ากระดาษจริงก่อนกดยืนยันจึงเป็น
 * ด่านสุดท้ายที่กันความผิดพลาดได้จริง
 *
 * ── ลำดับการทำงาน 2 ขั้น ─────────────────────────────────────────────────────
 *   ขั้นที่ 1  ตัวอย่าง (issued=false) — เลขที่เป็นเลข "ที่จะได้" จากการ peek เท่านั้น ยังไม่กินเลขจริง
 *              ปุ่มหลักคือ "ยืนยันออกเอกสาร"
 *   ขั้นที่ 2  ออกแล้ว (issued=true)  — ปุ่มเปลี่ยนเป็น ดาวน์โหลด / แชร์ / ส่งอีเมล / พิมพ์
 * ⚠️ ปุ่มดาวน์โหลด/แชร์/อีเมล อยู่ในขั้นที่ 2 เท่านั้นโดยตั้งใจ — ไฟล์ขั้นตัวอย่างยังไม่มีเลขที่จริง
 *
 * ✅ ผู้ใช้สั่ง (3 ต.ค. 2569): "preview ต่างๆ ให้ใช้ระบบแบบหน้าอื่นๆ" — ใช้กลไกเดียวกับ PdfPrintDialog
 *    (ใบเบิก/ใบขอซื้อ): มือถือ/Safari วาดหน้าเอกสารเป็นภาพ (Android แสดง PDF ใน iframe ไม่ได้ เห็นแค่ปุ่ม
 *    "เปิด" กับชื่อไฟล์มั่ว) · พิมพ์ได้ในกล่อง · หัวกล่อง/แถบปุ่มหน้าตาเดียวกันทุกเอกสาร
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Stack, Typography,
  Button, IconButton, Alert, useMediaQuery, CircularProgress,
} from "@mui/material";
import {
  Close, ArrowBack, Download, Share, OpenInNew, TaskAlt, MailOutline, Print, PictureAsPdf, InfoOutlined,
} from "@mui/icons-material";

import EmailDocumentDialog from "@/shared/components/EmailDocumentDialog";
import { renderPdfToImages, revokePageImages, preparePagePrint, prefersImagePrint, isInAppBrowser } from "@/shared/utils/pdfRaster";
import { INK, INK_2, MUTED, LINE, PRIMARY_BTN_SX, SUCCESS_BTN_SX, ACCENT } from "@/shared/ui/PageKit";

const IN_APP_NOTICE = "เบราว์เซอร์ในแอป (เช่น LINE) สั่งพิมพ์ไม่ได้ — กดเมนู ⋮ เลือก \"เปิดในเบราว์เซอร์\" แล้วกดพิมพ์อีกครั้ง หรือใช้ปุ่มแชร์/ดาวน์โหลดแทน";

/**
 * ✅ แชร์ไฟล์ตรงจากเบราว์เซอร์ (Web Share API ระดับไฟล์)
 * ⚠️ ต้องเช็ค canShare({files}) ไม่ใช่แค่ navigator.share — เดสก์ท็อปหลายตัวมี share แต่แชร์ "ไฟล์" ไม่ได้
 */
export const canShareFile = (file) => {
  try {
    return Boolean(navigator?.canShare?.({ files: [file] }));
  } catch {
    return false;
  }
};

const BTN_SX = { textTransform: "none", fontWeight: 700, color: INK_2, minWidth: 0 };

const DocumentPreviewDialog = ({
  open, onClose, title, accent = ACCENT,
  preview,          // { url, blob, fileName } — ไฟล์ที่กำลังแสดงอยู่
  issued,           // ออกเลขจริงแล้วหรือยัง
  docNumber,        // เลขที่ที่กำลังแสดง (ตัวอย่าง หรือ เลขจริง)
  busy, error,
  onBack, onConfirm,
  // ✅ ส่งทางอีเมล — { docType, refId, defaultTo, recipientName, project, audience, customerMatch } · ไม่ส่ง = ไม่มีปุ่ม
  email,
}) => {
  const isMobile = useMediaQuery("(max-width:600px)");
  const imageMode = useMemo(() => prefersImagePrint(), []);
  const [pages, setPages] = useState(null);
  const [rasterFailed, setRasterFailed] = useState(false);
  const [notice, setNotice] = useState("");
  const [mailOpen, setMailOpen] = useState(false);
  const printFrameRef = useRef(null);
  const printerRef = useRef(null);

  // ✅ มือถือ: วาดหน้าเอกสารเป็นภาพทุกครั้งที่ไฟล์เปลี่ยน (ตัวอย่าง → ฉบับออกจริง)
  useEffect(() => {
    setNotice("");
    if (!open || !imageMode || !preview?.blob) { setPages(null); setRasterFailed(false); return undefined; }
    let alive = true;
    const owned = { pages: null, printer: null };
    setPages(null); setRasterFailed(false);
    (async () => {
      try {
        const imgs = await renderPdfToImages(preview.blob);
        owned.pages = imgs;
        if (!alive) { revokePageImages(imgs); return; }
        const printer = await preparePagePrint(imgs, { title: preview.fileName });
        if (!alive) { printer.dispose(); return; }
        owned.printer = printer;
        printerRef.current = printer;
        setPages(imgs);
      } catch (err) {
        console.error("แปลงเอกสารเป็นภาพไม่สำเร็จ:", err);
        if (alive) setRasterFailed(true);
      }
    })();
    return () => {
      alive = false;
      owned.printer?.dispose();
      printerRef.current = null;
      revokePageImages(owned.pages);
    };
  }, [open, imageMode, preview?.blob, preview?.fileName]);

  const openTab = () => { if (preview?.url) window.open(preview.url, "_blank"); };

  const handlePrint = () => {
    if (!preview?.url) return;
    if (imageMode) {
      if (isInAppBrowser()) setNotice(IN_APP_NOTICE);
      if (printerRef.current) { printerRef.current.print(); return; }
      openTab();
      return;
    }
    const frame = printFrameRef.current;
    try {
      frame.onload = () => { try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch { openTab(); } };
      frame.src = preview.url;
    } catch { openTab(); }
  };

  const handleDownload = () => {
    if (!preview?.url) return;
    const link = document.createElement("a");
    link.href = preview.url;
    link.download = preview.fileName;
    link.click();
  };

  const handleShare = async () => {
    if (!preview?.blob) return;
    if (!window.isSecureContext) { setNotice("การแชร์ไฟล์ใช้ได้เมื่อเปิดระบบผ่านลิงก์ https เท่านั้น — กด \"ดาวน์โหลด\" แล้วแนบไฟล์ส่งเองได้"); return; }
    if (isInAppBrowser()) { setNotice(IN_APP_NOTICE); return; }
    const file = new File([preview.blob], preview.fileName, { type: "application/pdf" });
    let files = canShareFile(file) ? [file] : null;
    if (!files && pages?.length) {
      const imgs = pages.map((p, i) => new File([p.blob], `${preview.fileName.replace(/\.pdf$/i, "")}${pages.length > 1 ? `-${i + 1}` : ""}.png`, { type: "image/png" }));
      if (canShareFile(imgs[0])) files = imgs;
    }
    if (!files) { setNotice("เครื่องนี้แชร์ไฟล์โดยตรงไม่ได้ — กด \"ดาวน์โหลด\" แล้วแนบไฟล์ส่งเองได้เลย"); return; }
    try {
      await navigator.share({ files, title: preview.fileName, text: title });
    } catch (err) {
      // ⚠️ ผู้ใช้กดยกเลิกแผงแชร์เองก็เข้ามาทางนี้ (AbortError) — ไม่ใช่ความผิดพลาด
      if (err?.name !== "AbortError") setNotice("แชร์ไม่สำเร็จ — ลองใหม่อีกครั้ง หรือใช้ปุ่มดาวน์โหลดแทน");
    }
  };

  const preparing = imageMode && Boolean(preview?.blob) && !pages && !rasterFailed;
  const printReady = imageMode ? Boolean(pages) || rasterFailed : Boolean(preview?.url);

  return (
    <Dialog
      open={open}
      // ✅ ปิดได้เฉพาะปุ่มเท่านั้น — เผลอแตะพื้นหลังทีเดียวแล้วหลุดออกไปทั้งกระบวนการ
      onClose={(_, reason) => {
        if (busy) return;
        if (reason === "backdropClick" || reason === "escapeKeyDown") return;
        onClose?.();
      }}
      fullWidth maxWidth="md" fullScreen={isMobile}
      PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3, height: isMobile ? "100%" : "92vh" } }}
    >
      <DialogTitle sx={{ p: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: { xs: 2, sm: 2.5 }, py: 1.5, borderBottom: `1px solid ${LINE}` }}>
          <Box sx={{
            width: 38, height: 38, borderRadius: 2.5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            bgcolor: issued ? "#16a34a" : accent, color: "#fff",
          }}>
            {issued ? <TaskAlt sx={{ fontSize: 21 }} /> : <PictureAsPdf sx={{ fontSize: 21 }} />}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography noWrap sx={{ fontWeight: 900, fontSize: "1.02rem", lineHeight: 1.3, color: INK }}>
              {issued ? `${title} · ออกแล้ว` : `ตัวอย่าง${title}`}
            </Typography>
            <Typography noWrap sx={{ fontSize: "0.76rem", color: MUTED }}>
              {issued ? `เลขที่ ${docNumber || "-"} · บันทึกเข้าทะเบียนแล้ว` : `เลขที่ที่จะได้ ${docNumber || "-"} · ยังไม่ใช้จนกว่าจะยืนยัน`}
            </Typography>
          </Box>
          <IconButton onClick={onClose} disabled={busy} aria-label="ปิด"><Close /></IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 0, bgcolor: "#525659", display: "flex", flexDirection: "column" }}>
        {error && <Alert severity="error" sx={{ borderRadius: 0 }}>{error}</Alert>}
        {!issued && (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1, bgcolor: "#fffbeb", borderBottom: "1px solid #fde68a" }}>
            <InfoOutlined sx={{ fontSize: 18, color: "#b45309", flexShrink: 0 }} />
            <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: "#92400e" }}>
              ตรวจให้ครบก่อนยืนยัน — ยืนยันแล้วเลขที่จะถูกใช้ และงานนี้จะออกใบนี้ซ้ำไม่ได้
            </Typography>
          </Stack>
        )}
        {notice && <Alert severity="info" onClose={() => setNotice("")} sx={{ borderRadius: 0, "& .MuiAlert-message": { fontSize: "0.8rem" } }}>{notice}</Alert>}
        {rasterFailed && !notice && (
          <Alert severity="warning" sx={{ borderRadius: 0, "& .MuiAlert-message": { fontSize: "0.8rem" } }}>
            แสดงตัวอย่างในเครื่องนี้ไม่ได้ — กด "เปิดแท็บใหม่" เพื่อดูไฟล์
          </Alert>
        )}

        <Box sx={{ flex: 1, minHeight: 0, position: "relative", overflow: imageMode ? "auto" : "hidden" }}>
          {imageMode && pages ? (
            <Stack spacing={1.5} alignItems="center" sx={{ p: { xs: 1, sm: 2 } }}>
              {pages.map((p, i) => (
                <Box key={p.url} component="img" src={p.url} alt={`หน้า ${i + 1}`}
                  sx={{ display: "block", width: "100%", maxWidth: 820, height: "auto", bgcolor: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,.35)" }} />
              ))}
            </Stack>
          ) : !imageMode && preview?.url ? (
            <Box component="iframe" title="ตัวอย่างเอกสาร" src={preview.url} sx={{ width: "100%", height: "100%", border: "none", display: "block" }} />
          ) : !rasterFailed && (
            <Stack alignItems="center" justifyContent="center" sx={{ height: "100%", color: "#fff" }} spacing={1.5}>
              <CircularProgress size={28} sx={{ color: "#fff" }} />
              <Typography variant="caption">{preparing ? "กำลังจัดหน้าเอกสาร..." : "กำลังสร้างตัวอย่างเอกสาร..."}</Typography>
            </Stack>
          )}
          {busy && preview?.url && (
            <Stack alignItems="center" justifyContent="center" spacing={1.5}
              sx={{ position: "absolute", inset: 0, bgcolor: "rgba(15,23,42,.55)", color: "#fff" }}>
              <CircularProgress size={30} sx={{ color: "#fff" }} />
              <Typography variant="caption" sx={{ fontWeight: 700 }}>กำลังออกเลขที่เอกสาร...</Typography>
            </Stack>
          )}
        </Box>
        {!imageMode && <iframe ref={printFrameRef} title="พิมพ์เอกสาร" style={{ position: "fixed", right: 0, bottom: 0, width: 0, height: 0, border: 0 }} />}
      </DialogContent>

      <DialogActions sx={{ px: { xs: 1, sm: 2 }, py: 1.25, borderTop: `1px solid ${LINE}`, gap: { xs: 0.25, sm: 1 }, flexWrap: "wrap" }}>
        {issued ? (
          <>
            <Button onClick={openTab} disabled={!preview?.url} startIcon={<OpenInNew sx={{ fontSize: 18 }} />}
              sx={{ ...BTN_SX, color: MUTED, mr: "auto", display: { xs: "none", sm: "inline-flex" } }}>เปิดแท็บใหม่</Button>
            <Button onClick={handleDownload} disabled={!preview?.url} startIcon={<Download sx={{ fontSize: 18 }} />} sx={BTN_SX}>ดาวน์โหลด</Button>
            <Button onClick={handleShare} disabled={!preview?.blob} startIcon={<Share sx={{ fontSize: 18 }} />} sx={BTN_SX}>แชร์</Button>
            {email && (
              <Button onClick={() => setMailOpen(true)} disabled={!preview?.blob} startIcon={<MailOutline sx={{ fontSize: 18 }} />} sx={BTN_SX}>อีเมล</Button>
            )}
            <Button variant="contained" onClick={handlePrint} disabled={!printReady}
              startIcon={preparing ? <CircularProgress size={15} color="inherit" /> : <Print sx={{ fontSize: 18 }} />}
              sx={{ ...PRIMARY_BTN_SX, px: 2.25 }}>
              {preparing ? "กำลังเตรียม..." : "พิมพ์"}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onBack} disabled={busy} startIcon={<ArrowBack sx={{ fontSize: 18 }} />} sx={{ ...BTN_SX, color: MUTED, mr: "auto" }}>
              กลับไปแก้ไข
            </Button>
            <Button onClick={openTab} disabled={busy || !preview?.url} startIcon={<OpenInNew sx={{ fontSize: 18 }} />}
              sx={{ ...BTN_SX, color: MUTED, display: { xs: "none", sm: "inline-flex" } }}>เปิดแท็บใหม่</Button>
            <Button variant="contained" onClick={onConfirm} disabled={busy || !preview?.url}
              startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <TaskAlt sx={{ fontSize: 18 }} />}
              sx={{ ...SUCCESS_BTN_SX, px: 2.25 }}>
              {busy ? "กำลังออกเอกสาร..." : "ยืนยันออกเอกสาร"}
            </Button>
          </>
        )}
      </DialogActions>
      {email && issued && (
        <EmailDocumentDialog
          open={mailOpen} onClose={() => setMailOpen(false)}
          attachment={preview} docType={email.docType || title} docNo={docNumber}
          refId={email.refId} defaultTo={email.defaultTo} recipientName={email.recipientName}
          project={email.project} audience={email.audience} customerMatch={email.customerMatch}
        />
      )}
    </Dialog>
  );
};

export default DocumentPreviewDialog;
