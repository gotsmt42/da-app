/**
 * PdfBlobView — แสดงไฟล์ PDF (blob URL) ในกล่องดูไฟล์ ใช้ได้ทั้งจอคอมและมือถือ
 *
 * ✅ ผู้ใช้แจ้ง (3 ต.ค. 2569): "หน้าใบเสนอราคา แก้ไขให้เปิด PDF ได้ด้วยในมือถือ"
 *    🐛 เดิมทุกกล่องดูไฟล์ฝัง <iframe src=blob:…> อย่างเดียว — Chrome บน Android ไม่มีตัวอ่าน PDF ในหน้าเว็บ
 *    จึงขึ้นแค่ไอคอน PDF + ชื่อไฟล์เป็นรหัสมั่ว + ปุ่ม "เปิด" ที่กดแล้วไม่ไปไหน
 * ✅ มือถือ/Safari: วาดทุกหน้าเป็นภาพด้วย pdf.js (ระบบเดียวกับหน้าพิมพ์เอกสาร — shared/utils/pdfRaster)
 *    จอคอม: ใช้ตัวอ่าน PDF ของเบราว์เซอร์ตามเดิม (เลือกข้อความ/ค้นหาได้)
 * ✅ (25 ต.ค. 2569 ผู้ใช้: "แก้ไขอาการกระตุก หน่วงแลค เวลาเปิดไฟล์ pdf")
 *    • รอท่าเปิดกล่องจบก่อนค่อยเริ่มวาด (เดิมวาดชนกับท่าเลื่อนขึ้น = สะดุด)
 *    • หน้าแรกขึ้นทันทีที่วาดเสร็จ หน้าต่อไปทยอยตามมา (เดิมรอครบทุกหน้า) · มีแถบบอกความคืบหน้า
 *    • ดูอย่างเดียว ใช้ 150 dpi + JPEG — งานวาด/ถอดภาพเบากว่าเดิมราวครึ่งหนึ่ง ยังซูมอ่านตัวเล็กได้
 *    • จอคอม: ฝัง iframe หลังท่าเปิดกล่องจบ (ตัวอ่าน PDF ของเบราว์เซอร์หนัก โหลดพร้อมท่าเปิดแล้วกระตุก)
 */
import { useEffect, useMemo, useState } from "react";
import { Stack, Button, Typography } from "@mui/material";
import { OpenInNew } from "@mui/icons-material";
import PageLoader from "@/shared/ui/PageLoader";
import PdfPagesView from "@/shared/components/PdfPagesView";
import { renderPdfToImages, revokePageImages, prefersImagePrint } from "@/shared/utils/pdfRaster";

const OPEN_DELAY = 280; // ≈ ท่าเปิดกล่อง (Dialog/แผ่นเลื่อนขึ้น) ของทั้งแอป

export default function PdfBlobView({ url, height = 780, title = "PDF" }) {
  const imageMode = useMemo(() => prefersImagePrint(), []);
  const [pages, setPages] = useState(null);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [frameOn, setFrameOn] = useState(false);

  useEffect(() => {
    if (imageMode || !url) return undefined;
    setFrameOn(false);
    const t = setTimeout(() => setFrameOn(true), OPEN_DELAY);
    return () => clearTimeout(t);
  }, [imageMode, url]);

  useEffect(() => {
    if (!imageMode || !url) return undefined;
    let alive = true;
    let owned = null;
    setPages(null); setDone(false); setFailed(false);
    (async () => {
      try {
        const blob = await (await fetch(url)).blob();
        const imgs = await renderPdfToImages(blob, {
          dpi: 150, type: "image/jpeg", quality: 0.88, startDelay: OPEN_DELAY,
          isCancelled: () => !alive,
          onPage: (soFar) => { owned = soFar; setPages(soFar); },
        });
        owned = imgs;
        if (!alive) { revokePageImages(imgs); return; }
        setPages(imgs); setDone(true);
      } catch (err) {
        console.error("แปลง PDF เป็นภาพไม่สำเร็จ:", err);
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; revokePageImages(owned); };
  }, [imageMode, url]);

  if (!url) return null;
  if (!imageMode) {
    if (!frameOn) return <PageLoader variant="inline" label="กำลังเปิดไฟล์ PDF…" />;
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
  // ✅ ซูมในกล่องเอง (PdfPagesView) — ไม่ปล่อยให้ทั้งหน้าเว็บซูม (ภาพซ้อน/ช่องเทาบนมือถือ)
  return (
    <PdfPagesView pages={pages} maxWidth={900}
      footer={done ? `${pages.length} หน้า · ถ่างนิ้ว/แตะสองครั้งเพื่อซูม` : `กำลังเปิดหน้าถัดไป… (${pages.length} หน้าแล้ว)`}
      sx={{ height: { xs: "calc(100dvh - 72px)", sm: "80vh" } }} />
  );
}
