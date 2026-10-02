import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { refreshInbox, markInboxRead } from "@/shared/hooks/useInbox";
import { Box, ButtonBase, IconButton, Slide, Typography } from "@mui/material";
import { Close } from "@mui/icons-material";

/**
 * แบนเนอร์แจ้งเตือนในแอป (แบบ LINE) + เสียงเตือน — ใช้ตอน "แอปเปิดอยู่บนจอ"
 *
 * ✅ ผู้ใช้ขอ: "อยากให้เด้งแสดงข้อมูลในหน้ามือถือเลย แบบแจ้งเตือนไลน์ · ทำเสียงแจ้งเตือนด้วย"
 *   • แอปปิด/อยู่เบื้องหลัง → service worker (public/push-sw.js) โชว์แจ้งเตือนระบบของมือถือ (เสียงของเครื่อง)
 *   • แอปเปิดอยู่ → service worker ส่ง message "app-push" มาที่นี่ → เด้งแบนเนอร์บนสุด + เสียง + สั่น
 *     (ไม่โชว์แจ้งเตือนระบบซ้ำ เดี๋ยวได้ 2 อันพร้อมกัน)
 *
 * ⚠️ เสียงสร้างด้วย Web Audio (ไม่ต้องมีไฟล์เสียง) — เบราว์เซอร์อนุญาตให้เล่นเสียงได้หลังผู้ใช้แตะหน้าจอแล้ว
 *   อย่างน้อยครั้งหนึ่ง (กฎ autoplay) จึงปลดล็อก AudioContext ตอนแตะครั้งแรก · ถ้ายังไม่เคยแตะ = เงียบแต่ยังเด้งแบนเนอร์
 */
const AUTO_HIDE_MS = 6000;

let audioCtx = null;
const unlockAudio = () => {
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch { /* เบราว์เซอร์ไม่รองรับ — เงียบไว้ */ }
};

/** เสียง "ติ๊ง-ติ๊ง" สองโน้ตสั้นๆ แบบแอปแชท */
const playChime = () => {
  try {
    if (!audioCtx || audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;
    [[880, 0], [1320, 0.13]].forEach(([freq, at]) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.25, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.32);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.35);
    });
  } catch { /* เงียบไว้ */ }
};

export default function InAppPushBanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const [msg, setMsg] = useState(null);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);

  const hide = useCallback(() => {
    setOpen(false);
    clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    // ปลดล็อกเสียงตอนผู้ใช้แตะ/คลิกครั้งแรก (กฎ autoplay ของเบราว์เซอร์)
    window.addEventListener("pointerdown", unlockAudio, { passive: true });
    window.addEventListener("keydown", unlockAudio);
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return undefined;
    const onMessage = (e) => {
      // ✅ กดแจ้งเตือนบนมือถือตอนแอปเปิดค้างอยู่เบื้องหลัง → service worker ส่งมาให้เปลี่ยนหน้าแบบ SPA + อ่านแล้ว
      if (e.data?.type === "open-url") {
        if (e.data.nid) markInboxRead(e.data.nid);
        if (e.data.url) navigate(e.data.url);
        return;
      }
      if (e.data?.type !== "app-push") return;
      refreshInbox();
      setMsg(e.data.payload || {});
      setOpen(true);
      playChime();
      try { navigator.vibrate?.([120, 60, 120]); } catch { /* ไม่รองรับ */ }
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setOpen(false), AUTO_HIDE_MS);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
      clearTimeout(timer.current);
    };
  }, [navigate]);

  // ✅ เปิดแอปจากการกดแจ้งเตือนตอนแอปปิดอยู่ → URL มี ?_n=<id> → ทำเครื่องหมายอ่านแล้ว แล้วลบพารามิเตอร์ทิ้ง
  //    (ไม่ลบ = เมนูที่เทียบ query แบบตรงตัวจะไม่ติดสว่าง และกดย้อนกลับแล้วนับซ้ำ)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nid = params.get("_n");
    if (!nid) return;
    markInboxRead(nid);
    params.delete("_n");
    const q = params.toString();
    navigate(`${location.pathname}${q ? `?${q}` : ""}${location.hash}`, { replace: true });
  }, [location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!msg) return null;

  return (
    <Slide direction="down" in={open} mountOnEnter unmountOnExit>
      <Box
        role="alert"
        sx={{
          position: "fixed", zIndex: 2000, top: "calc(8px + env(safe-area-inset-top))", left: 0, right: 0,
          mx: "auto", px: 1, width: "100%", maxWidth: 480, pointerEvents: "none",
        }}
      >
        <Box
          sx={{
            pointerEvents: "auto", display: "flex", alignItems: "flex-start", gap: 1.25, p: 1.25, pr: 0.5,
            borderRadius: 3.5, bgcolor: "rgba(255,255,255,.97)", backdropFilter: "blur(10px)",
            border: "1px solid #e2e8f0", boxShadow: "0 12px 32px -8px rgba(15,23,42,.35)",
          }}
        >
          <ButtonBase
            onClick={() => { hide(); if (msg.nid) markInboxRead(msg.nid); if (msg.url) navigate(msg.url); }}
            sx={{ flex: 1, minWidth: 0, display: "flex", alignItems: "flex-start", gap: 1.25, textAlign: "left", borderRadius: 2.5 }}
          >
            <Box component="img" src="/app-icon-192.png?v=16" alt="" sx={{ width: 38, height: 38, borderRadius: 2.5, flexShrink: 0 }} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#64748b", lineHeight: 1.3 }}>TidTam · ตอนนี้</Typography>
              <Typography sx={{ fontSize: "0.9rem", fontWeight: 800, color: "#0f172a", lineHeight: 1.35 }} noWrap>{msg.title || "แจ้งเตือน"}</Typography>
              {msg.body && (
                <Typography sx={{
                  fontSize: "0.82rem", color: "#334155", lineHeight: 1.4,
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                }}>
                  {msg.body}
                </Typography>
              )}
            </Box>
          </ButtonBase>
          <IconButton size="small" aria-label="ปิดการแจ้งเตือน" onClick={hide} sx={{ color: "#94a3b8" }}>
            <Close sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </Box>
    </Slide>
  );
}
