/**
 * PdfPagesView — แสดงหน้าเอกสาร PDF (ที่วาดเป็นภาพแล้ว) บนมือถือ พร้อมซูมในตัว
 *
 * ✅ (25 ต.ค. 2569 ผู้ใช้: "ยังไม่แก้ไขปัญหา pdf แบบนี้เลย" — รูปจอ: ตอนถ่างนิ้วซูม ตัวหนังสือขนาดต่างกันซ้อนกัน
 *    + กล่องเทาว่างๆ เต็มจอ) สาเหตุ: เดิมปล่อยให้ "ทั้งหน้าเว็บ" ซูมด้วยสองนิ้ว — เบราว์เซอร์ต้องวาดภาพหน้าเอกสาร
 *    ขนาดใหญ่ใหม่ทั้งแผ่นทุกระดับซูม การ์ดจอมือถือวาดไม่ทัน/หน่วยความจำไม่พอ จึงเห็นภาพเก่าซ้อนภาพใหม่และช่องเทา
 *    (ชั้นการ์ดจอ will-change ที่ใส่รอบก่อนยิ่งกินหน่วยความจำเพิ่ม — เอาออกแล้ว)
 * ✅ ซูมในกล่องนี้เอง (เหมือนแอปอ่าน PDF):
 *    • ถ่างนิ้ว: ระหว่างถ่างย่อ/ขยายด้วย transform (ลื่น) · ปล่อยนิ้วแล้วจัดหน้าใหม่ตามขนาดจริง (คมชัด ไม่ซ้อน)
 *    • แตะสองครั้ง = ซูม 2 เท่าตรงจุดที่แตะ / กลับพอดีจอ · ปุ่ม − ⤢ + มุมขวาล่าง
 *    • กล่องนี้ห้ามเบราว์เซอร์ซูมทั้งหน้า (touch-action) — เลื่อนขึ้นลง/ซ้ายขวาได้ปกติ
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Box, IconButton, Stack, Typography } from "@mui/material";
import { AddRounded, RemoveRounded, FitScreenRounded } from "@mui/icons-material";

const MIN = 1;
const MAX = 3.5;
const PAD = 8;
const GAP = 12;
const clamp = (z) => Math.min(MAX, Math.max(MIN, z));
const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

/**
 * @param pages  [{ url, width, height }]
 * @param footer ข้อความใต้หน้าสุดท้าย (เช่น "3 หน้า")
 * @param maxWidth ความกว้างหน้าตอนพอดีจอ (px)
 */
export default function PdfPagesView({ pages = [], footer, maxWidth = 820, sx }) {
  const boxRef = useRef(null);
  const innerRef = useRef(null);
  const [boxW, setBoxW] = useState(0);
  const [zoom, setZoom] = useState(1);
  const pinch = useRef(null);
  const anchor = useRef(null);
  const lastTap = useRef(0);

  // ความกว้างกล่อง → ความกว้างหน้าตอนพอดีจอ
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const update = () => setBoxW(el.clientWidth);
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  const fitW = Math.max(120, Math.min(maxWidth, boxW - PAD * 2));
  const pageW = Math.round(fitW * zoom);

  /** เปลี่ยนระดับซูม โดยให้จุด (cx, cy) บนจอ ยังชี้ตำแหน่งเดิมของเอกสาร */
  const zoomTo = useCallback((next, cx, cy) => {
    const el = boxRef.current;
    if (!el) return;
    const z = clamp(next);
    const r = el.getBoundingClientRect();
    const px = (cx ?? r.left + r.width / 2) - r.left;
    const py = (cy ?? r.top + r.height / 2) - r.top;
    anchor.current = { ratio: z / zoom, x: el.scrollLeft + px, y: el.scrollTop + py, px, py };
    setZoom(z);
  }, [zoom]);

  // หลังจัดหน้าใหม่ — เลื่อนให้จุดที่ซูมอยู่ที่เดิม
  useLayoutEffect(() => {
    const a = anchor.current;
    const el = boxRef.current;
    if (!a || !el) return;
    anchor.current = null;
    el.scrollLeft = a.x * a.ratio - a.px;
    el.scrollTop = a.y * a.ratio - a.py;
  }, [zoom]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const onStart = (e) => {
      if (e.touches.length === 2) {
        const [a, b] = e.touches;
        pinch.current = { d0: dist(a, b), cx: (a.clientX + b.clientX) / 2, cy: (a.clientY + b.clientY) / 2, scale: 1 };
        if (innerRef.current) innerRef.current.style.transition = "none";
      } else if (e.touches.length === 1) {
        // แตะสองครั้ง
        const now = Date.now();
        if (now - lastTap.current < 300) {
          const t = e.touches[0];
          zoomTo(zoom > 1.2 ? 1 : 2, t.clientX, t.clientY);
          lastTap.current = 0;
        } else lastTap.current = now;
      }
    };
    const onMove = (e) => {
      const p = pinch.current;
      if (!p || e.touches.length !== 2) return;
      if (e.cancelable) e.preventDefault();
      const [a, b] = e.touches;
      p.scale = clamp(zoom * (dist(a, b) / p.d0)) / zoom;
      const inner = innerRef.current;
      if (inner) {
        const r = el.getBoundingClientRect();
        inner.style.transformOrigin = `${el.scrollLeft + p.cx - r.left}px ${el.scrollTop + p.cy - r.top}px`;
        inner.style.transform = `scale(${p.scale})`;
      }
    };
    const onEnd = (e) => {
      const p = pinch.current;
      if (!p || e.touches.length >= 2) return;
      pinch.current = null;
      const inner = innerRef.current;
      if (inner) { inner.style.transform = ""; inner.style.transformOrigin = ""; }
      if (Math.abs(p.scale - 1) > 0.02) zoomTo(zoom * p.scale, p.cx, p.cy);
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [zoom, zoomTo]);

  const btn = { width: 40, height: 40, bgcolor: "rgba(15,23,42,.72)", color: "#fff", "&:hover": { bgcolor: "rgba(15,23,42,.85)" }, "&.Mui-disabled": { color: "rgba(255,255,255,.35)", bgcolor: "rgba(15,23,42,.5)" } };

  return (
    <Box sx={{ position: "relative", height: "100%", minHeight: 0, bgcolor: "#525659", ...sx }}>
      <Box ref={boxRef} data-no-swipe={zoom > 1 ? "" : undefined}
        sx={{ position: "absolute", inset: 0, overflow: "auto", overscrollBehavior: "contain", touchAction: "pan-x pan-y", WebkitOverflowScrolling: "touch" }}>
        <Stack ref={innerRef} alignItems="center" sx={{ p: `${PAD}px`, gap: `${GAP}px`, width: Math.max(boxW, pageW + PAD * 2), boxSizing: "border-box" }}>
          {pages.map((p, i) => (
            <Box key={p.url} component="img" src={p.url} alt={`หน้า ${i + 1}`} draggable={false}
              sx={{ display: "block", width: pageW, height: Math.round(pageW * (p.height / p.width)), flexShrink: 0,
                bgcolor: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,.35)", userSelect: "none", WebkitUserSelect: "none" }} />
          ))}
          {footer && <Typography sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,.75)", pb: 1, alignSelf: "center" }}>{footer}</Typography>}
        </Stack>
      </Box>
      <Stack direction="row" gap={0.75} sx={{ position: "absolute", right: 12, bottom: 12, zIndex: 2 }}>
        <IconButton aria-label="ย่อ" onClick={() => zoomTo(zoom - 0.5)} disabled={zoom <= MIN} sx={btn}><RemoveRounded /></IconButton>
        {zoom > 1 && <IconButton aria-label="พอดีจอ" onClick={() => zoomTo(1)} sx={btn}><FitScreenRounded /></IconButton>}
        <IconButton aria-label="ขยาย" onClick={() => zoomTo(zoom + 0.5)} disabled={zoom >= MAX} sx={btn}><AddRounded /></IconButton>
      </Stack>
    </Box>
  );
}
