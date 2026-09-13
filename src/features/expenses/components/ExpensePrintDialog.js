/**
 * ExpensePrintDialog — ดูตัวอย่าง / พิมพ์ / แชร์ / ดาวน์โหลด ใบเบิก Advance และใบเคลม (A4 หน้าเดียว)
 *
 * ✅ ต่างจาก DocumentPreviewDialog ของทะเบียนเอกสาร: ใบเบิกมีเลขที่ตั้งแต่ตอนส่งขออนุมัติแล้ว จึงไม่มีขั้น
 * "ยืนยันออกเลข" — กล่องนี้มีหน้าที่เดียวคือเอาเอกสารออกไปจากแอป (กระดาษ/LINE/อีเมล)
 *
 * ⚠️ พิมพ์: สั่ง print() ที่ iframe ซ่อนซึ่งโหลด PDF ไว้ — ได้กล่องพิมพ์ของเบราว์เซอร์ทันทีโดยไม่ต้องเปิด
 * แท็บใหม่ แต่ Safari บน iOS และเบราว์เซอร์ในแอป (LINE) ทำไม่ได้ จึงถอยไปเปิด PDF ในแท็บใหม่ให้กดพิมพ์/
 * แชร์จากตัวอ่าน PDF ของเครื่องแทน ไม่ปล่อยให้กดแล้วเงียบ
 */
import { useEffect, useRef, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography, IconButton,
  Alert, CircularProgress, useMediaQuery,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Close, Print, Share, Download, OpenInNew, PictureAsPdf } from "@mui/icons-material";

import { canShareFile } from "@/features/documents/components/DocumentPreviewDialog";
import { generateExpensePdf } from "../utils/expensePdf";
import KindBadge from "./KindBadge";
import { KIND_META, statusMeta, TEXT_SUB, BORDER_MAIN } from "../expenseMeta";

const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export default function ExpensePrintDialog({ open, expense, onClose }) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const [pdf, setPdf] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const printFrameRef = useRef(null);
  const urlRef = useRef("");

  const meta = KIND_META[expense?.kind] || KIND_META.advance;

  useEffect(() => {
    if (!open || !expense) return undefined;
    let alive = true;
    setPdf(null); setError(""); setNotice("");
    generateExpensePdf({ expense, mode: "blob" })
      .then((out) => {
        if (!alive) { URL.revokeObjectURL(out.url); return; }
        urlRef.current = out.url;
        setPdf(out);
      })
      .catch((err) => {
        console.error("สร้าง PDF ใบเบิกไม่สำเร็จ:", err);
        if (alive) setError("สร้างเอกสารไม่สำเร็จ — ลองใหม่อีกครั้ง");
      });
    return () => {
      alive = false;
      // ⚠️ คืนหน่วยความจำ blob ทุกครั้งที่ปิด/สลับใบ (outputDocument โหมด blob ไม่ revoke ให้เอง)
      if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = ""; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- สร้างใหม่เมื่อเปิดหรือใบ/สถานะเปลี่ยนเท่านั้น
  }, [open, expense?._id, expense?.status, expense?.updatedAt]);

  const openTab = () => { if (pdf?.url) window.open(pdf.url, "_blank"); };

  const handlePrint = () => {
    if (!pdf?.url) return;
    if (isMobile || isIOS()) { openTab(); setNotice("เปิดเอกสารในแท็บใหม่แล้ว — กดพิมพ์หรือแชร์จากตัวอ่าน PDF ได้เลย"); return; }
    const frame = printFrameRef.current;
    try {
      frame.onload = () => {
        try { frame.contentWindow.focus(); frame.contentWindow.print(); }
        catch { openTab(); }
      };
      frame.src = pdf.url;
    } catch {
      openTab();
    }
  };

  const handleDownload = () => {
    if (!pdf?.url) return;
    const a = document.createElement("a");
    a.href = pdf.url;
    a.download = pdf.fileName;
    a.click();
  };

  const handleShare = async () => {
    if (!pdf?.blob) return;
    const file = new File([pdf.blob], pdf.fileName, { type: "application/pdf" });
    if (!canShareFile(file)) {
      setNotice("เบราว์เซอร์นี้แชร์ไฟล์โดยตรงไม่ได้ — กด \"ดาวน์โหลด\" แล้วแนบไฟล์ส่งเองได้เลย");
      return;
    }
    try {
      await navigator.share({ files: [file], title: pdf.fileName, text: `${meta.label} ${expense.docNo} · ${expense.subject}` });
    } catch (err) {
      if (err?.name !== "AbortError") setNotice("แชร์ไม่สำเร็จ — ลองใหม่ หรือใช้ปุ่มดาวน์โหลดแทน");
    }
  };

  if (!expense) return null;
  const st = statusMeta(expense.status, expense.kind);

  return (
    <Dialog
      open={open} onClose={onClose} fullWidth maxWidth="md" fullScreen={isMobile}
      PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3, height: isMobile ? "100%" : "92vh" } }}
    >
      <DialogTitle sx={{ p: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{
          px: { xs: 2, sm: 2.5 }, py: 1.5, borderBottom: `1px solid ${alpha(meta.color, 0.25)}`,
          borderTop: `5px solid ${meta.color}`, bgcolor: meta.soft,
        }}>
          <Box sx={{
            width: 38, height: 38, borderRadius: 2.5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            bgcolor: meta.color, color: "#fff",
          }}>
            <PictureAsPdf sx={{ fontSize: 21 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
              <KindBadge kind={expense.kind} />
              <Typography sx={{ fontWeight: 900, fontSize: "1.02rem", lineHeight: 1.3, color: meta.dark }} noWrap>{expense.docNo}</Typography>
            </Stack>
            <Typography variant="caption" sx={{ color: TEXT_SUB }} noWrap component="div">
              A4 หน้าเดียว · สถานะ {st.label}
            </Typography>
          </Box>
          <IconButton onClick={onClose}><Close /></IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 0, bgcolor: "#525659", display: "flex", flexDirection: "column" }}>
        {error && <Alert severity="error" sx={{ borderRadius: 0 }}>{error}</Alert>}
        {notice && <Alert severity="info" onClose={() => setNotice("")} sx={{ borderRadius: 0, "& .MuiAlert-message": { fontSize: "0.8rem" } }}>{notice}</Alert>}
        <Box sx={{ flex: 1, minHeight: 0, position: "relative" }}>
          {pdf?.url ? (
            <Box component="iframe" title="ตัวอย่างใบเบิก" src={pdf.url} sx={{ width: "100%", height: "100%", border: "none", display: "block" }} />
          ) : !error && (
            <Stack alignItems="center" justifyContent="center" sx={{ height: "100%", color: "#fff" }} spacing={1.5}>
              <CircularProgress size={28} sx={{ color: "#fff" }} />
              <Typography variant="caption">กำลังจัดหน้าเอกสาร...</Typography>
            </Stack>
          )}
        </Box>
        {/* iframe ซ่อนสำหรับสั่งพิมพ์ — แยกจากตัวแสดงตัวอย่าง ไม่งั้นการเปลี่ยน src จะทำให้ตัวอย่างกระพริบ */}
        <iframe ref={printFrameRef} title="พิมพ์ใบเบิก" style={{ position: "fixed", right: 0, bottom: 0, width: 0, height: 0, border: 0 }} />
      </DialogContent>

      <DialogActions sx={{ px: { xs: 1, sm: 2 }, py: 1.25, borderTop: `1px solid ${BORDER_MAIN}`, gap: { xs: 0.25, sm: 1 }, flexWrap: "wrap" }}>
        <Button onClick={openTab} disabled={!pdf} startIcon={<OpenInNew sx={{ fontSize: 18 }} />}
          sx={{ textTransform: "none", fontWeight: 700, color: TEXT_SUB, mr: "auto", display: { xs: "none", sm: "inline-flex" } }}>
          เปิดแท็บใหม่
        </Button>
        <Button onClick={handleDownload} disabled={!pdf} startIcon={<Download sx={{ fontSize: 18 }} />} sx={{ textTransform: "none", fontWeight: 700 }}>
          ดาวน์โหลด
        </Button>
        <Button onClick={handleShare} disabled={!pdf} startIcon={<Share sx={{ fontSize: 18 }} />} sx={{ textTransform: "none", fontWeight: 700 }}>
          แชร์
        </Button>
        <Button
          variant="contained" onClick={handlePrint} disabled={!pdf} startIcon={<Print sx={{ fontSize: 18 }} />}
          sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", px: 2.25, bgcolor: meta.color, "&:hover": { bgcolor: meta.dark, boxShadow: "none" } }}
        >
          พิมพ์
        </Button>
      </DialogActions>
    </Dialog>
  );
}
