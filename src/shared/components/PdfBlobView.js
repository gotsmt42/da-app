/**
 * PdfBlobView — แสดงไฟล์ PDF (blob URL) ในกล่องดูไฟล์ ใช้ได้ทั้งจอคอมและมือถือ
 *
 * ✅ ผู้ใช้แจ้ง (3 ต.ค. 2569): "หน้าใบเสนอราคา แก้ไขให้เปิด PDF ได้ด้วยในมือถือ"
 *    🐛 เดิมทุกกล่องดูไฟล์ฝัง <iframe src=blob:…> อย่างเดียว — Chrome บน Android ไม่มีตัวอ่าน PDF ในหน้าเว็บ
 *    จึงขึ้นแค่ไอคอน PDF + ชื่อไฟล์เป็นรหัสมั่ว + ปุ่ม "เปิด" ที่กดแล้วไม่ไปไหน
 * ✅ มือถือ/Safari: วาดทุกหน้าเป็นภาพด้วย pdf.js (ระบบเดียวกับหน้าพิมพ์เอกสาร — shared/utils/pdfRaster)
 *    จอคอม: ใช้ตัวอ่าน PDF ของเบราว์เซอร์ตามเดิม (เลือกข้อความ/ค้นหาได้)
 */
import { useEffect, useMemo, useState } from "react";
import { Box, Stack, Button, Typography } from "@mui/material";
import { OpenInNew } from "@mui/icons-material";
import PageLoader from "@/shared/ui/PageLoader";
import { renderPdfToImages, revokePageImages, prefersImagePrint } from "@/shared/utils/pdfRaster";

export default function PdfBlobView({ url, height = 780, title = "PDF" }) {
  const imageMode = useMemo(() => prefersImagePrint(), []);
  const [pages, setPages] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!imageMode || !url) return undefined;
    let alive = true;
    let owned = null;
    setPages(null); setFailed(false);
    (async () => {
      try {
        const blob = await (await fetch(url)).blob();
        const imgs = await renderPdfToImages(blob);
        owned = imgs;
        if (!alive) { revokePageImages(imgs); return; }
        setPages(imgs);
      } catch (err) {
        console.error("แปลง PDF เป็นภาพไม่สำเร็จ:", err);
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; revokePageImages(owned); };
  }, [imageMode, url]);

  if (!url) return null;
  if (!imageMode) {
    return <iframe src={url} width="100%" height={`${height}px`} style={{ border: "none", display: "block" }} title={title} />;
  }
  if (failed) {
    return (
      <Stack alignItems="center" spacing={1.5} sx={{ py: 6, px: 2, textAlign: "center" }}>
        <Typography sx={{ fontSize: "0.9rem", color: "#64748b" }}>แสดงตัวอย่างในเครื่องนี้ไม่ได้</Typography>
        <Button variant="contained" startIcon={<OpenInNew />} onClick={() => window.open(url, "_blank")}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, boxShadow: "none" }}>เปิดไฟล์ PDF</Button>
      </Stack>
    );
  }
  if (!pages) return <PageLoader variant="inline" label="กำลังเปิดไฟล์ PDF…" />;
  return (
    <Stack spacing={1.25} alignItems="center" sx={{ p: { xs: 1, sm: 2 }, bgcolor: "#525659", minHeight: "100%" }}>
      {pages.map((pg, i) => (
        <Box key={pg.url} component="img" src={pg.url} alt={`หน้า ${i + 1}`}
          sx={{ display: "block", width: "100%", maxWidth: 900, height: "auto", bgcolor: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,.35)" }} />
      ))}
      <Typography sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,.75)", pb: 1 }}>{pages.length} หน้า · ซูมด้วยสองนิ้วได้</Typography>
    </Stack>
  );
}
