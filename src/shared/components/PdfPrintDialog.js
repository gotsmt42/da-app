/**
 * PdfPrintDialog — กล่อง "ดูตัวอย่าง / พิมพ์ / แชร์ / ดาวน์โหลด" เอกสาร PDF แบบเดียวกันทุกระบบ
 *
 * ✅ ผู้ใช้สั่ง (2 ต.ค. 2569): ใบขอซื้อ "ยังเป็นรูปแบบเก่า ให้อัปเดตให้เหมือนใบอื่นๆ" — เดิมกดพิมพ์แล้วเปิด PDF
 *    ดิบในแท็บใหม่ (มือถือ Android เป็นหน้าขาว) ต่างจากใบเบิกที่มีกล่องตัวอย่าง + พิมพ์/แชร์/ดาวน์โหลด
 * ✅ ยกกลไกจาก features/expenses/components/ExpensePrintDialog.js มาเป็นตัวกลาง (ทางพิมพ์ 2 ทางตามเบราว์เซอร์ ·
 *    มือถือวาดเป็นภาพ · แชร์ไฟล์/ภาพ · คืนหน่วยความจำ) — เอกสารชนิดใหม่ใช้ตัวนี้ ไม่ต้องเขียนซ้ำ
 *
 * @param {() => Promise<{blob: Blob, url: string, fileName: string, safeName: string}>} generate  สร้าง PDF (โหมด blob)
 * @param {string} jobKey   เปลี่ยนเมื่อเนื้อหาเปลี่ยน (สร้างใหม่) — อย่าผูกกับ object ที่สร้างใหม่ทุก render
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography, IconButton, Alert, CircularProgress, useMediaQuery,
} from "@mui/material";
import { Close, Print, Share, Download, OpenInNew, PictureAsPdf } from "@mui/icons-material";

import { canShareFile } from "@/features/documents/components/DocumentPreviewDialog";
import { renderPdfToImages, revokePageImages, preparePagePrint, prefersImagePrint, isInAppBrowser } from "@/shared/utils/pdfRaster";

const IN_APP_NOTICE = "เบราว์เซอร์ในแอป (เช่น LINE) สั่งพิมพ์ไม่ได้ — กดเมนู ⋮ เลือก \"เปิดในเบราว์เซอร์\" แล้วกดพิมพ์อีกครั้ง หรือใช้ปุ่มแชร์/ดาวน์โหลดแทน";
const TEXT_SUB = "#64748b";
const BORDER_MAIN = "#e2e8f0";

export default function PdfPrintDialog({ open, onClose, generate, jobKey, title, subtitle, badge, color = "#334155", dark, shareText }) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const imageMode = useMemo(() => prefersImagePrint(), []);
  const [pdf, setPdf] = useState(null);
  const [pages, setPages] = useState(null);
  const [rasterFailed, setRasterFailed] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const printFrameRef = useRef(null);
  const printerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    const owned = { url: "", pages: null, printer: null };
    setPdf(null); setPages(null); setRasterFailed(false); setError(""); setNotice("");
    (async () => {
      let out;
      try {
        out = await generate();
      } catch (err) {
        console.error("สร้าง PDF ไม่สำเร็จ:", err);
        if (alive) setError("สร้างเอกสารไม่สำเร็จ — ลองใหม่อีกครั้ง");
        return;
      }
      if (!alive) { URL.revokeObjectURL(out.url); return; }
      owned.url = out.url;
      setPdf(out);
      if (!imageMode) return;
      try {
        const imgs = await renderPdfToImages(out.blob);
        owned.pages = imgs;
        if (!alive) { revokePageImages(imgs); return; }
        const printer = await preparePagePrint(imgs, { title: out.safeName });
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
      if (owned.url) URL.revokeObjectURL(owned.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- สร้างใหม่เมื่อเปิดหรือเนื้อหาเปลี่ยนเท่านั้น (jobKey)
  }, [open, jobKey, imageMode]);

  const openTab = () => { if (pdf?.url) window.open(pdf.url, "_blank"); };
  const handlePrint = () => {
    if (!pdf?.url) return;
    if (imageMode) {
      if (isInAppBrowser()) setNotice(IN_APP_NOTICE);
      if (printerRef.current) { printerRef.current.print(); return; }
      openTab();
      setNotice("เตรียมหน้าพิมพ์ในเครื่องนี้ไม่สำเร็จ — เปิดเอกสารในแท็บใหม่แล้ว กดพิมพ์จากตัวอ่าน PDF หรือใช้ปุ่มดาวน์โหลดแทน");
      return;
    }
    const frame = printFrameRef.current;
    try {
      frame.onload = () => { try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch { openTab(); } };
      frame.src = pdf.url;
    } catch { openTab(); }
  };
  const handleDownload = () => {
    if (!pdf?.url) return;
    const a = document.createElement("a");
    a.href = pdf.url; a.download = pdf.fileName; a.click();
  };
  const handleShare = async () => {
    if (!pdf?.blob) return;
    if (!window.isSecureContext) { setNotice("การแชร์ไฟล์ใช้ได้เมื่อเปิดระบบผ่านลิงก์ https เท่านั้น — กด \"ดาวน์โหลด\" แล้วแนบไฟล์ส่งเองได้"); return; }
    if (isInAppBrowser()) { setNotice(IN_APP_NOTICE); return; }
    const file = new File([pdf.blob], pdf.fileName, { type: "application/pdf" });
    let files = canShareFile(file) ? [file] : null;
    // ⚠️ ห้าม await ก่อน navigator.share (Safari) — ภาพเก็บ blob ไว้ตั้งแต่ตอนวาดแล้ว
    if (!files && pages?.length) {
      const imgs = pages.map((p, i) => new File([p.blob], `${pdf.safeName}${pages.length > 1 ? `-${i + 1}` : ""}.png`, { type: "image/png" }));
      if (canShareFile(imgs[0])) files = imgs;
    }
    if (!files) { setNotice("เครื่องนี้แชร์ไฟล์โดยตรงไม่ได้ — กด \"ดาวน์โหลด\" แล้วแนบไฟล์ส่งเองได้เลย"); return; }
    try { await navigator.share({ files, title: pdf.fileName, text: shareText || title }); } catch (err) {
      if (err?.name !== "AbortError") setNotice("แชร์ไม่สำเร็จ — ลองใหม่ หรือใช้ปุ่มดาวน์โหลดแทน");
    }
  };

  const printReady = imageMode ? Boolean(pages) || rasterFailed : Boolean(pdf);
  const preparing = Boolean(pdf) && imageMode && !pages && !rasterFailed;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" fullScreen={isMobile}
      PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3, height: isMobile ? "100%" : "92vh" } }}>
      <DialogTitle sx={{ p: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: { xs: 2, sm: 2.5 }, py: 1.5, borderBottom: `1px solid ${BORDER_MAIN}` }}>
          <Box sx={{ width: 38, height: 38, borderRadius: 2.5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: color, color: "#fff" }}>
            <PictureAsPdf sx={{ fontSize: 21 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
              {badge}
              <Typography sx={{ fontWeight: 900, fontSize: "1.02rem", lineHeight: 1.3, color: dark || color }} noWrap>{title}</Typography>
            </Stack>
            {subtitle && <Typography variant="caption" sx={{ color: TEXT_SUB }} noWrap component="div">{subtitle}</Typography>}
          </Box>
          <IconButton onClick={onClose} aria-label="ปิด"><Close /></IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ p: 0, bgcolor: "#525659", display: "flex", flexDirection: "column" }}>
        {error && <Alert severity="error" sx={{ borderRadius: 0 }}>{error}</Alert>}
        {notice && <Alert severity="info" onClose={() => setNotice("")} sx={{ borderRadius: 0, "& .MuiAlert-message": { fontSize: "0.8rem" } }}>{notice}</Alert>}
        {rasterFailed && !notice && (
          <Alert severity="warning" sx={{ borderRadius: 0, "& .MuiAlert-message": { fontSize: "0.8rem" } }}>
            แสดงตัวอย่างในเครื่องนี้ไม่ได้ — ไฟล์พร้อมแล้ว กดดาวน์โหลด/แชร์ หรือพิมพ์ (จะเปิดในแท็บใหม่) ได้ตามปกติ
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
          ) : !imageMode && pdf?.url ? (
            <Box component="iframe" title="ตัวอย่างเอกสาร" src={pdf.url} sx={{ width: "100%", height: "100%", border: "none", display: "block" }} />
          ) : !error && !rasterFailed && (
            <Stack alignItems="center" justifyContent="center" sx={{ height: "100%", color: "#fff" }} spacing={1.5}>
              <CircularProgress size={28} sx={{ color: "#fff" }} />
              <Typography variant="caption">{preparing ? "กำลังเตรียมหน้าพิมพ์..." : "กำลังจัดหน้าเอกสาร..."}</Typography>
            </Stack>
          )}
        </Box>
        {!imageMode && <iframe ref={printFrameRef} title="พิมพ์เอกสาร" style={{ position: "fixed", right: 0, bottom: 0, width: 0, height: 0, border: 0 }} />}
      </DialogContent>
      <DialogActions sx={{ px: { xs: 1, sm: 2 }, py: 1.25, borderTop: `1px solid ${BORDER_MAIN}`, gap: { xs: 0.25, sm: 1 }, flexWrap: "wrap" }}>
        <Button onClick={openTab} disabled={!pdf} startIcon={<OpenInNew sx={{ fontSize: 18 }} />}
          sx={{ textTransform: "none", fontWeight: 700, color: TEXT_SUB, mr: "auto", display: { xs: "none", sm: "inline-flex" } }}>เปิดแท็บใหม่</Button>
        <Button onClick={handleDownload} disabled={!pdf} startIcon={<Download sx={{ fontSize: 18 }} />} sx={{ textTransform: "none", fontWeight: 700 }}>ดาวน์โหลด</Button>
        <Button onClick={handleShare} disabled={!pdf} startIcon={<Share sx={{ fontSize: 18 }} />} sx={{ textTransform: "none", fontWeight: 700 }}>แชร์</Button>
        <Button variant="contained" onClick={handlePrint} disabled={!pdf || !printReady}
          startIcon={preparing ? <CircularProgress size={15} color="inherit" /> : <Print sx={{ fontSize: 18 }} />}
          sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", px: 2.25, bgcolor: color, "&:hover": { bgcolor: dark || color, boxShadow: "none" } }}>
          {preparing ? "กำลังเตรียม..." : "พิมพ์"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
