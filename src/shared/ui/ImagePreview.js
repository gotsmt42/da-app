/**
 * ImagePreview — ตัวดูรูปที่เปิดเร็ว + ซูม/เลื่อนได้สะดวก (ใช้ร่วมทุกกล่องดูไฟล์ในแอป)
 *
 * ✅ (19 ต.ค. 2569 ผู้ใช้: "การเปิดไฟล์ยังเป็นรูปแบบเก่า มันช้า") รูปย่อเบลอขึ้นทันที → รูปคมซ้อนเมื่อโหลดเสร็จ
 * 🔁 (19 ต.ค. 2569 ผู้ใช้: "แก้ไขการซูมเอกสาร มันซูมยาก และเอกสารเล็กไป ทำให้ดี")
 *    • เปิดมา "พอดีความกว้าง" เมื่อรูปเป็นแนวตั้งยาว (เอกสาร/ภาพหน้าจอมือถือ) — ไม่ย่อจนตัวหนังสืออ่านไม่ออก
 *    • แถบควบคุมล่าง: − / % / + · พอดีความกว้าง · พอดีจอ
 *    • ล้อเมาส์ = ซูมตรงตำแหน่งเมาส์ · ลาก = เลื่อน · ดับเบิลคลิก/แตะสองครั้ง = ซูม 2 เท่าตรงจุดนั้น / กลับพอดี
 *    • มือถือ: ถ่างสองนิ้วซูม · นิ้วเดียวเลื่อน
 *    • ซูมเกิน 1.5 เท่า โหลดรูปความละเอียดสูงเพิ่มให้คมชัด
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Stack, Typography, CircularProgress, IconButton, Tooltip } from "@mui/material";
import { Add, Remove, FitScreen, SwapHoriz } from "@mui/icons-material";
import { getOptimizedImageUrl } from "@/shared/utils/cloudinaryImage";

const MIN = 0.5;
const MAX = 6;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export default function ImagePreview({ url, name }) {
  const boxRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [nat, setNat] = useState(null);           // ขนาดจริงของรูป (px)
  const [box, setBox] = useState({ w: 0, h: 0 });  // ขนาดพื้นที่แสดง
  const [view, setView] = useState({ s: 1, x: 0, y: 0 }); // s = มาตราส่วนจริง (1 = 1px รูป : 1px จอ)
  const [hiRes, setHiRes] = useState(false);
  const pointers = useRef(new Map());
  const pinch = useRef(null);
  const lastTap = useRef(0);

  const fitW = Math.min(2000, Math.round((window.innerWidth || 1200) * Math.min(window.devicePixelRatio || 1, 2)));
  const thumb = getOptimizedImageUrl(url, { width: 48 });
  const src = getOptimizedImageUrl(url, { width: hiRes ? 3000 : fitW });

  // ขนาดพื้นที่แสดง
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scales = useCallback(() => {
    if (!nat || !box.w) return { contain: 1, width: 1 };
    const contain = Math.min(box.w / nat.w, box.h / nat.h);
    const width = (box.w - 24) / nat.w;
    return { contain, width };
  }, [nat, box]);

  /** จัดรูปไว้กลางแนวนอน · ชิดบนเมื่อสูงเกินจอ */
  const placeAt = useCallback((s) => {
    if (!nat) return { s, x: 0, y: 0 };
    const w = nat.w * s; const h = nat.h * s;
    return { s, x: (box.w - w) / 2, y: h > box.h ? 12 : (box.h - h) / 2 };
  }, [nat, box]);

  const fitScreen = useCallback(() => setView(placeAt(scales().contain)), [placeAt, scales]);
  const fitWidth = useCallback(() => setView(placeAt(scales().width)), [placeAt, scales]);

  // มุมมองเริ่มต้น: รูปแนวตั้งยาว (เอกสาร) = พอดีความกว้าง แต่ไม่เกิน 2.5 เท่าของพอดีจอ · อื่นๆ = พอดีจอ
  const initialized = useRef(false);
  useEffect(() => {
    if (!nat || !box.w || initialized.current) return;
    initialized.current = true;
    const { contain, width } = scales();
    const tall = nat.h / nat.w > 1.25;
    setView(placeAt(tall ? Math.min(width, contain * 2.5, 2) : contain));
  }, [nat, box, scales, placeAt]);

  useEffect(() => { if (view.s > 1.5 * (fitW / (nat?.w || fitW))) setHiRes(true); }, [view.s, fitW, nat]);

  /** ซูมรอบจุด (cx, cy) ในพื้นที่แสดง */
  const zoomAt = useCallback((factor, cx, cy) => {
    setView((v) => {
      const { contain } = scales();
      const s = clamp(v.s * factor, contain * MIN, Math.max(MAX, contain * 4));
      const k = s / v.s;
      return { s, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
    });
  }, [scales]);
  const zoomCenter = (factor) => zoomAt(factor, box.w / 2, box.h / 2);

  const onWheel = (e) => {
    e.preventDefault();
    const r = boxRef.current.getBoundingClientRect();
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
  };
  // ล้อเมาส์ต้อง passive: false เพื่อกันหน้าเลื่อน
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  const onPointerDown = (e) => {
    boxRef.current.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y) };
    }
    // แตะ/คลิกสองครั้ง = ซูม 2 เท่าตรงจุด หรือกลับพอดีจอ
    const now = Date.now();
    if (now - lastTap.current < 280 && pointers.current.size === 1) {
      const r = boxRef.current.getBoundingClientRect();
      const { contain } = scales();
      if (view.s > contain * 1.6) fitScreen(); else zoomAt(2, e.clientX - r.left, e.clientY - r.top);
      lastTap.current = 0;
    } else lastTap.current = now;
  };
  const onPointerMove = (e) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const r = boxRef.current.getBoundingClientRect();
      zoomAt(d / pinch.current.d, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      pinch.current.d = d;
      return;
    }
    setView((v) => ({ ...v, x: v.x + (cur.x - prev.x), y: v.y + (cur.y - prev.y) }));
  };
  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const { contain } = scales();
  const pct = nat ? Math.round((view.s / contain) * 100) : 100;
  const btn = { color: "#fff", width: 36, height: 36, "&:hover": { bgcolor: "rgba(255,255,255,.12)" } };

  return (
    <Box ref={boxRef}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      sx={{ position: "relative", bgcolor: "#0f172a", height: { xs: "calc(100vh - 66px)", sm: "min(84vh, 900px)" }, overflow: "hidden",
        touchAction: "none", cursor: pointers.current.size ? "grabbing" : "grab", userSelect: "none" }}>
      {!loaded && thumb !== url && (
        <Box component="img" src={thumb} alt="" aria-hidden sx={{ position: "absolute", inset: 0, m: "auto", maxWidth: "100%", maxHeight: "100%", height: "100%", objectFit: "contain", filter: "blur(14px)", opacity: 0.8 }} />
      )}
      <Box component="img" src={src} alt={name || ""} draggable={false} decoding="async"
        onLoad={(e) => { setLoaded(true); if (!nat) setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight }); }}
        sx={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0", maxWidth: "none", pointerEvents: "none",
          width: nat ? nat.w : "auto", height: nat ? nat.h : "auto",
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`, opacity: loaded && nat ? 1 : 0, transition: "opacity .2s",
          boxShadow: "0 10px 40px rgba(0,0,0,.45)", bgcolor: "#fff" }} />

      {!loaded && (
        <Stack direction="row" alignItems="center" gap={1} sx={{ position: "absolute", left: "50%", bottom: 72, transform: "translateX(-50%)", px: 1.5, py: 0.75, borderRadius: 99, bgcolor: "rgba(15,23,42,.8)", color: "#fff" }}>
          <CircularProgress size={14} sx={{ color: "#fff" }} />
          <Typography sx={{ fontSize: "0.78rem", fontWeight: 700 }}>กำลังโหลดรูป…</Typography>
        </Stack>
      )}

      {/* แถบควบคุม */}
      <Stack direction="row" alignItems="center" gap={0.25} onPointerDown={(e) => e.stopPropagation()}
        sx={{ position: "absolute", left: "50%", bottom: 16, transform: "translateX(-50%)", px: 0.75, py: 0.5, borderRadius: 99,
          bgcolor: "rgba(15,23,42,.85)", border: "1px solid rgba(255,255,255,.15)", backdropFilter: "blur(6px)", cursor: "default" }}>
        <Tooltip title="ย่อ"><IconButton onClick={() => zoomCenter(1 / 1.3)} sx={btn}><Remove /></IconButton></Tooltip>
        <Typography sx={{ minWidth: 52, textAlign: "center", color: "#fff", fontSize: "0.82rem", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{pct}%</Typography>
        <Tooltip title="ขยาย"><IconButton onClick={() => zoomCenter(1.3)} sx={btn}><Add /></IconButton></Tooltip>
        <Box sx={{ width: 1, height: 22, bgcolor: "rgba(255,255,255,.2)", mx: 0.5 }} />
        <Tooltip title="พอดีความกว้าง"><IconButton onClick={fitWidth} sx={btn}><SwapHoriz /></IconButton></Tooltip>
        <Tooltip title="พอดีจอ"><IconButton onClick={fitScreen} sx={btn}><FitScreen /></IconButton></Tooltip>
      </Stack>
      <Typography sx={{ position: "absolute", right: 12, top: 10, fontSize: "0.7rem", color: "rgba(255,255,255,.55)", pointerEvents: "none", display: { xs: "none", sm: "block" } }}>
        ล้อเมาส์ = ซูม · ลาก = เลื่อน · ดับเบิลคลิก = ซูมตรงจุด
      </Typography>
    </Box>
  );
}
