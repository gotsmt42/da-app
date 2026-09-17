/**
 * SignaturePad — ช่องเซ็นชื่อด้วยนิ้ว/เมาส์ (คืนค่าเป็น PNG พื้นโปร่งใส)
 *
 * ✅ ใช้ Pointer Events ตัวเดียวคุมทั้งนิ้ว ปากกา และเมาส์ — ช่างเซ็นบนมือถือเป็นการใช้งานหลัก
 * ✅ เส้นเรียบด้วยเส้นโค้งผ่านจุดกลาง (quadratic midpoint) ไม่ใช่ลากเส้นตรงจุดต่อจุด ซึ่งจะได้
 * ลายเซ็นเป็นเหลี่ยมหักๆ ดูเหมือนกราฟ ไม่เหมือนลายมือ
 * ✅ ความหนาเส้นแปรตามความเร็วการลาก (ลากเร็ว = เส้นบาง) ให้ใกล้ปากกาจริง
 *
 * ⚠️ canvas ต้องปรับตาม devicePixelRatio ไม่งั้นบนมือถือจะได้เส้นหยาบเป็นบันได
 * ⚠️ ใส่ touchAction: "none" เสมอ — ไม่งั้นการลากนิ้วบนช่องเซ็นจะกลายเป็นการเลื่อนหน้าจอ
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { Undo, DeleteOutline } from "@mui/icons-material";

import { canvasToSignaturePng } from "@/shared/utils/signatureImage";

const INK = "#111840";

const SignaturePad = forwardRef(function SignaturePad({ height = 190, onChange, disabled = false }, ref) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  /** ภาพ ณ ก่อนเริ่มเส้นปัจจุบัน — ใช้ทำปุ่มย้อนกลับทีละเส้น (ไม่เก็บทุกจุด ประหยัดหน่วยความจำ) */
  const history = useRef([]);
  const [hasInk, setHasInk] = useState(false);

  const ctxOf = () => canvasRef.current?.getContext("2d");

  /** ปรับความละเอียด canvas ให้ตรงกับขนาดจริงบนจอ (คงภาพเดิมไว้ด้วย) */
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.round(wrap.clientWidth * ratio);
    const h = Math.round(height * ratio);
    if (canvas.width === w && canvas.height === h) return;
    const prev = canvas.width ? canvas.toDataURL("image/png") : "";
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;
    if (prev && hasInk) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, w, h);
      img.src = prev;
    }
  }, [height, hasInk]);

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [resize]);

  const pointOf = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scale = canvasRef.current.width / rect.width;
    return { x: (e.clientX - rect.left) * scale, y: (e.clientY - rect.top) * scale, t: performance.now() };
  };

  const start = (e) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const canvas = canvasRef.current;
    history.current = [...history.current.slice(-9), canvas.toDataURL("image/png")];
    drawing.current = true;
    last.current = pointOf(e);
    // จุดเดียว (แตะแล้วปล่อย) ต้องมีหมึกติดด้วย — คนเซ็นจุดท้ายชื่อบ่อย
    const ctx = ctxOf();
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, 1.6 * (canvas.width / 900), 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
  };

  const move = (e) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = ctxOf();
    const p = pointOf(e);
    const prev = last.current;
    const dist = Math.hypot(p.x - prev.x, p.y - prev.y);
    const speed = dist / Math.max(1, p.t - prev.t);
    const base = canvas.width / 260;
    ctx.lineWidth = Math.max(base * 0.55, base * (1.25 - Math.min(speed * 0.35, 0.75)));
    // เส้นโค้งผ่านจุดกลางระหว่างสองจุด = ลายเส้นลื่นไม่เป็นเหลี่ยม
    const mid = { x: (prev.x + p.x) / 2, y: (prev.y + p.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.quadraticCurveTo(prev.x, prev.y, mid.x, mid.y);
    ctx.stroke();
    last.current = p;
    if (!hasInk) setHasInk(true);
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    setHasInk(true);
    onChange?.(true);
  };

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    history.current = [];
    setHasInk(false);
    onChange?.(false);
  }, [onChange]);

  const undo = () => {
    const prev = history.current.pop();
    const canvas = canvasRef.current;
    const ctx = ctxOf();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!prev) { setHasInk(false); onChange?.(false); return; }
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      const still = history.current.length > 0;
      setHasInk(still || true);
    };
    img.src = prev;
  };

  useImperativeHandle(ref, () => ({
    /** @returns {string} PNG dataURL · "" = ยังไม่ได้เซ็น */
    toPng: () => (canvasRef.current ? canvasToSignaturePng(canvasRef.current) : ""),
    clear,
    isEmpty: () => !hasInk,
  }), [hasInk, clear]);

  return (
    <Box>
      <Box
        ref={wrapRef}
        sx={{
          position: "relative", height, borderRadius: 2, overflow: "hidden",
          border: "1px dashed #cbd5e1", bgcolor: "#fff",
          // เส้นบรรทัดจางๆ ให้เซ็นตรงแนว เหมือนช่องเซ็นบนกระดาษ
          backgroundImage: "linear-gradient(to bottom, transparent calc(72% - 1px), #e2e8f0 72%, transparent calc(72% + 1px))",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
          style={{ width: "100%", height: "100%", display: "block", touchAction: "none", cursor: disabled ? "default" : "crosshair" }}
        />
        {!hasInk && (
          <Typography
            sx={{
              position: "absolute", left: 0, right: 0, top: "48%", textAlign: "center",
              color: "#94a3b8", fontSize: "0.85rem", pointerEvents: "none",
            }}
          >
            เซ็นชื่อด้วยนิ้วหรือเมาส์ในกรอบนี้
          </Typography>
        )}
      </Box>
      <Stack direction="row" spacing={1} sx={{ mt: 0.75 }}>
        <Button size="small" startIcon={<Undo />} onClick={undo} disabled={disabled || !hasInk}
          sx={{ textTransform: "none", color: "#64748b" }}>
          ย้อนกลับ
        </Button>
        <Button size="small" startIcon={<DeleteOutline />} onClick={clear} disabled={disabled || !hasInk}
          sx={{ textTransform: "none", color: "#64748b" }}>
          ล้างทั้งหมด
        </Button>
      </Stack>
    </Box>
  );
});

export default SignaturePad;
