/**
 * ExpensePrintDialog — ดูตัวอย่าง / พิมพ์ / แชร์ / ดาวน์โหลด ใบเบิก Advance, ใบเคลม และ "ฟอร์มใบเคลมเปล่า"
 *
 * ✅ ต่างจาก DocumentPreviewDialog ของทะเบียนเอกสาร: ใบเบิกมีเลขที่ตั้งแต่ตอนส่งขออนุมัติแล้ว จึงไม่มีขั้น
 * "ยืนยันออกเลข" — กล่องนี้มีหน้าที่เดียวคือเอาเอกสารออกไปจากแอป (กระดาษ/LINE/อีเมล)
 *
 * ── การพิมพ์มี 2 ทาง แล้วแต่เบราว์เซอร์ ────────────────────────────────────────────────────────
 *   • จอคอม (Chrome/Edge/Firefox): สั่ง print() ที่ iframe ซ่อนซึ่งโหลด PDF ไว้ — ได้เส้น/ตัวอักษรแบบเวกเตอร์
 *   • มือถือ/แท็บเล็ต/Safari: วาด PDF เป็นภาพไว้ล่วงหน้าแล้วพิมพ์ด้วย window.print() ของหน้าเว็บ
 *     (ดูเหตุผลเต็มที่ shared/utils/pdfRaster.js)
 *     🐛 เดิมมือถือถอยไป "เปิด PDF ในแท็บใหม่" อย่างเดียว — บน Android แท็บใหม่เป็นหน้าขาว (Chrome ไม่มีตัว
 *     อ่าน PDF) และตัวอย่างในกล่องก็ว่างเปล่า ผู้ใช้จึงกดพิมพ์ไม่ได้เลย
 *
 * ── ฟอร์มใบเคลมเปล่า (prop `blank`) ─────────────────────────────────────────────────────────────
 *   • variant "advance": ขอรหัสฟอร์มจาก server ก่อน (server บันทึกลงประวัติใบ Advance) แล้วค่อยสร้าง PDF
 *     ⚠️ ห้ามสร้าง PDF ด้วยรหัสสุ่มเองถ้าขอจาก server ไม่สำเร็จ — กระดาษที่อ้างว่า "ลงทะเบียนในประวัติใบ"
 *     แต่ไม่มีอยู่จริงคือเอกสารที่หลอกผู้ตรวจ แสดง error แทน
 *   • variant "empty": รหัสสุ่มในเครื่อง ระบุชัดบนกระดาษว่าไม่ผูกใบ Advance
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography, IconButton,
  Alert, CircularProgress, useMediaQuery,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Close, Print, Share, Download, OpenInNew, PictureAsPdf, EditNote } from "@mui/icons-material";

import { canShareFile } from "@/features/documents/components/DocumentPreviewDialog";
import {
  renderPdfToImages, revokePageImages, preparePagePrint, prefersImagePrint, isInAppBrowser,
} from "@/shared/utils/pdfRaster";
import { generateExpensePdf } from "../utils/expensePdf";
import { generateBlankClaimPdf, localFormCode } from "../utils/expenseBlankPdf";
import ExpenseService, { errorText } from "../services/ExpenseService";
import KindBadge from "./KindBadge";
import { KIND_META, slipKind, statusMeta, TEXT_SUB, BORDER_MAIN } from "../expenseMeta";

const IN_APP_NOTICE = "เบราว์เซอร์ในแอป (เช่น LINE) สั่งพิมพ์ไม่ได้ — กดเมนู ⋮ เลือก \"เปิดในเบราว์เซอร์\" แล้วกดพิมพ์อีกครั้ง หรือใช้ปุ่มแชร์/ดาวน์โหลดแทน";

/**
 * @param {object}  [expense]  ใบจาก API — โหมดพิมพ์เอกสารจริง
 * @param {object}  [blank]    { variant: "empty"|"advance"|"reimburse", advance?, printedBy } — โหมดฟอร์มเปล่า
 */
export default function ExpensePrintDialog({ open, expense, blank, onClose }) {
  const isMobile = useMediaQuery("(max-width:600px)");
  // ตัดสินครั้งเดียวต่อการเปิดหน้า — ชนิดเครื่องไม่เปลี่ยนระหว่างใช้งาน
  const imageMode = useMemo(() => prefersImagePrint(), []);
  const [pdf, setPdf] = useState(null);
  const [pages, setPages] = useState(null);
  const [rasterFailed, setRasterFailed] = useState(false);
  const [formInfo, setFormInfo] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const printFrameRef = useRef(null);
  const printerRef = useRef(null);

  // ⚠️ slipKind ไม่ใช่ expense.kind — ใบสำรองจ่ายต้องได้สี/ป้ายของตัวเอง ไม่ใช่ป้าย CLAIM สีม่วง
  const kind = blank ? (blank.variant === "reimburse" ? "reimburse" : "claim") : slipKind(expense);
  /** ชื่อเรียกฟอร์มเปล่าตามชนิดเอกสาร — ใช้ทั้งหัวกล่อง ชื่อไฟล์ และหัวข้อตอนสั่งพิมพ์ */
  const blankName = blank?.variant === "reimburse" ? "ฟอร์มใบเบิกค่าใช้จ่าย (สำรองจ่าย)" : "ฟอร์มใบเคลม";
  const meta = KIND_META[kind] || KIND_META.advance;
  // ⚠️ ใช้คีย์ข้อความแทน object — ฟอร์มแม่ re-render ทุกครั้งที่พิมพ์ ถ้าผูกกับ object ตรงๆ จะสร้าง PDF
  // (และขอรหัสฟอร์มใหม่จาก server) ซ้ำทุกตัวอักษรที่พิมพ์
  const jobKey = blank
    ? `blank:${blank.variant}:${blank.advance?._id || ""}`
    : `doc:${expense?._id}:${expense?.status}:${expense?.updatedAt}`;

  useEffect(() => {
    if (!open || (!expense && !blank)) return undefined;
    let alive = true;
    const owned = { url: "", pages: null, printer: null };
    setPdf(null); setPages(null); setRasterFailed(false); setFormInfo(null); setError(""); setNotice("");

    (async () => {
      let out;
      try {
        if (blank) {
          const form = blank.variant === "advance"
            ? await ExpenseService.issueBlankClaimForm(blank.advance._id)
            : { code: localFormCode(), issuedAt: new Date().toISOString(), issuedBy: blank.printedBy || "" };
          if (!alive) return;
          setFormInfo(form);
          out = await generateBlankClaimPdf({ variant: blank.variant, advance: blank.advance, form, mode: "blob" });
        } else {
          /**
           * ✅ ลายเซ็นอิเล็กทรอนิกส์ที่ผนึกไว้ในใบ — โหลดก่อนแล้วฝังลงไฟล์
           * ✅ ใบเคลมพิมพ์คู่กับใบ Advance ที่อ้างถึง (หน้า 2) จึงต้องโหลดลายเซ็นของใบนั้นมาด้วย
           * ⚠️ โหลดไม่ได้ก็ยังพิมพ์ได้ — หน้า 2 จะเว้นช่องลงนามไว้ให้เซ็นมือ (signatures() คืน {} เมื่อพลาด)
           */
          const advanceId = expense?.kind === "claim" ? expense?.advanceDoc?._id : null;
          const [signatures, advanceSignatures] = await Promise.all([
            expense?._id ? ExpenseService.signatures(expense._id) : null,
            advanceId ? ExpenseService.signatures(advanceId) : null,
          ]);
          out = await generateExpensePdf({
            expense,
            signatures: signatures ? { ...signatures, advance: advanceSignatures || {} } : null,
            mode: "blob",
          });
        }
      } catch (err) {
        console.error("สร้าง PDF ไม่สำเร็จ:", err);
        if (alive) {
          setError(err?.response
            ? errorText(err, "ออกรหัสฟอร์มไม่สำเร็จ")
            : "สร้างเอกสารไม่สำเร็จ — ลองใหม่อีกครั้ง");
        }
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
        // ⚠️ ปล่อยภาพให้หน้าจอ "หลัง" เตรียมหน้าพิมพ์เสร็จ — ปุ่มพิมพ์เปิดใช้ตาม pages ถ้าปล่อยก่อน
        // จะมีช่วงสั้นๆ ที่กดพิมพ์ได้แต่ยังไม่มีอะไรให้พิมพ์ แล้วหลุดไปทางสำรอง (เปิดแท็บใหม่) โดยไม่จำเป็น
        setPages(imgs);
      } catch (err) {
        // ⚠️ วาดเป็นภาพไม่สำเร็จ (เช่น เน็ตหลุดตอนโหลด pdf.js) ไม่ใช่เหตุให้ทั้งกล่องใช้ไม่ได้ —
        // ไฟล์ PDF มีอยู่แล้ว ยังดาวน์โหลด/แชร์/เปิดแท็บใหม่ได้ครบ
        console.error("แปลงเอกสารเป็นภาพไม่สำเร็จ:", err);
        if (alive) setRasterFailed(true);
      }
    })();

    return () => {
      alive = false;
      owned.printer?.dispose();
      printerRef.current = null;
      revokePageImages(owned.pages);
      // ⚠️ คืนหน่วยความจำ blob ทุกครั้งที่ปิด/สลับใบ (outputDocument โหมด blob ไม่ revoke ให้เอง)
      if (owned.url) URL.revokeObjectURL(owned.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- สร้างใหม่เมื่อเปิดหรือใบ/สถานะเปลี่ยนเท่านั้น (ดู jobKey)
  }, [open, jobKey, imageMode]);

  const openTab = () => { if (pdf?.url) window.open(pdf.url, "_blank"); };

  const handlePrint = () => {
    if (!pdf?.url) return;
    if (imageMode) {
      if (isInAppBrowser()) setNotice(IN_APP_NOTICE);
      if (printerRef.current) {
        printerRef.current.print();
        return;
      }
      openTab();
      setNotice("เตรียมหน้าพิมพ์ในเครื่องนี้ไม่สำเร็จ — เปิดเอกสารในแท็บใหม่แล้ว กดพิมพ์จากตัวอ่าน PDF หรือใช้ปุ่มดาวน์โหลดแทน");
      return;
    }
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
    // ⚠️ navigator.share ใช้ได้เฉพาะหน้าเว็บที่เปิดผ่าน https — เปิดด้วย IP ในวง LAN ปุ่มจะไม่มีทางทำงาน
    // บอกเหตุผลตรงๆ ดีกว่าขึ้นว่า "เบราว์เซอร์ไม่รองรับ" ซึ่งทำให้ผู้ใช้เข้าใจผิดว่าเครื่องมีปัญหา
    if (!window.isSecureContext) {
      setNotice("การแชร์ไฟล์ใช้ได้เมื่อเปิดระบบผ่านลิงก์ https เท่านั้น — กด \"ดาวน์โหลด\" แล้วแนบไฟล์ส่งเองได้");
      return;
    }
    if (isInAppBrowser()) {
      setNotice(IN_APP_NOTICE);
      return;
    }
    const title = blank ? `${blankName} ${formInfo?.code || ""}` : `${meta.label} ${expense.docNo} · ${expense.subject}`;
    const file = new File([pdf.blob], pdf.fileName, { type: "application/pdf" });
    let files = canShareFile(file) ? [file] : null;
    // ✅ บางเครื่องแชร์ไฟล์ PDF ไม่ได้แต่แชร์รูปได้ (เช่น ส่งเข้า LINE จาก Android บางรุ่น) —
    // ถ้ามีภาพหน้าเอกสารอยู่แล้วให้ถอยไปแชร์ภาพแทน ดีกว่าบอกว่าแชร์ไม่ได้
    // ⚠️ ห้าม await อะไรก่อนเรียก navigator.share — Safari ยอมให้แชร์เฉพาะในจังหวะที่ผู้ใช้แตะปุ่ม
    // รอโหลดอะไรคั่นกลางแล้วจังหวะนั้นหลุด ได้ NotAllowedError (ภาพจึงเก็บ blob ไว้ตั้งแต่ตอนวาด)
    if (!files && pages?.length) {
      const imgs = pages.map((p, i) => new File([p.blob], `${pdf.safeName}${pages.length > 1 ? `-${i + 1}` : ""}.png`, { type: "image/png" }));
      if (canShareFile(imgs[0])) files = imgs;
    }
    if (!files) {
      setNotice("เครื่องนี้แชร์ไฟล์โดยตรงไม่ได้ — กด \"ดาวน์โหลด\" แล้วแนบไฟล์ส่งเองได้เลย");
      return;
    }
    try {
      await navigator.share({ files, title: pdf.fileName, text: title });
    } catch (err) {
      if (err?.name !== "AbortError") setNotice("แชร์ไม่สำเร็จ — ลองใหม่ หรือใช้ปุ่มดาวน์โหลดแทน");
    }
  };

  if (!expense && !blank) return null;
  const printReady = imageMode ? Boolean(pages) || rasterFailed : Boolean(pdf);
  const preparing = Boolean(pdf) && imageMode && !pages && !rasterFailed;

  const headTitle = blank ? `${blankName}เปล่า · กรอกด้วยลายมือ` : expense.docNo;
  const headSub = blank
    ? (formInfo
      ? `รหัสฟอร์ม ${formInfo.code}${blank.variant === "advance" ? ` · บันทึกในประวัติใบ ${blank.advance.docNo} แล้ว` : blank.variant === "reimburse" ? " · ใบสำรองจ่ายไม่มี Advance" : " · ไม่ผูกใบ Advance"}`
      : blank.variant === "advance" ? "กำลังออกรหัสฟอร์ม..." : "A4")
    : `A4 หน้าเดียว · สถานะ ${statusMeta(expense.status, kind).label}`;

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
            {blank ? <EditNote sx={{ fontSize: 22 }} /> : <PictureAsPdf sx={{ fontSize: 21 }} />}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
              <KindBadge kind={kind} />
              <Typography sx={{ fontWeight: 900, fontSize: "1.02rem", lineHeight: 1.3, color: meta.dark }} noWrap>{headTitle}</Typography>
            </Stack>
            <Typography variant="caption" sx={{ color: TEXT_SUB }} noWrap component="div">{headSub}</Typography>
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
            // ✅ มือถือ: แสดงภาพหน้าเอกสาร (iframe PDF เป็นหน้าว่างบน Android) — ซูมด้วยนิ้วได้ตามปกติ
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
              <Typography variant="caption">
                {blank?.variant === "advance" && !formInfo ? "กำลังออกรหัสฟอร์ม..." : preparing ? "กำลังเตรียมหน้าพิมพ์..." : "กำลังจัดหน้าเอกสาร..."}
              </Typography>
            </Stack>
          )}
        </Box>
        {/* iframe ซ่อนสำหรับสั่งพิมพ์บนจอคอม — แยกจากตัวแสดงตัวอย่าง ไม่งั้นการเปลี่ยน src จะทำให้ตัวอย่างกระพริบ */}
        {!imageMode && (
          <iframe ref={printFrameRef} title="พิมพ์เอกสาร" style={{ position: "fixed", right: 0, bottom: 0, width: 0, height: 0, border: 0 }} />
        )}
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
          variant="contained" onClick={handlePrint} disabled={!pdf || !printReady}
          startIcon={preparing ? <CircularProgress size={15} color="inherit" /> : <Print sx={{ fontSize: 18 }} />}
          sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", px: 2.25, bgcolor: meta.color, "&:hover": { bgcolor: meta.dark, boxShadow: "none" } }}
        >
          {preparing ? "กำลังเตรียม..." : "พิมพ์"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
