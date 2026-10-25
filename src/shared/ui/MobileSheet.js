/**
 * MobileSheet — หน้าต่างรายละเอียดแบบ "แผ่นเลื่อนขึ้นจากล่าง" บนมือถือ (ใช้ร่วมทุกหน้า)
 *
 * ✅ (20 ต.ค. 2569 ผู้ใช้: "ให้ทุกหน้าเลื่อนขึ้นแค่แบบนี้ แต่สมูท สมบูรณ์ เพื่อที่จะเลื่อนลงปิดได้ง่ายๆ")
 *    มือถือ: เลื่อนขึ้นจากขอบล่าง สูง 92% ของจอ มุมบนโค้ง มีขีดจับด้านบน — ลากลงเพื่อปิด
 *    (ลากที่หัวแผ่น หรือที่เนื้อหาตอนเลื่อนอยู่บนสุด) · จอใหญ่: กล่อง Dialog ปกติ
 * ⚠️ ใช้ SwipeableDrawer ของ MUI — เนื้อหาที่เลื่อนได้ข้างใน MUI แยกให้เองว่าจะเลื่อนเนื้อหาหรือลากปิด
 * 🔁 (24 ต.ค. 2569 ผู้ใช้: "กดเปิดแถบเลื่อนขึ้นมา ให้เลื่อนขึ้นจนเต็ม สวยงาม สมูท ไม่แลค")
 *    • เต็มจอ (100dvh) · หัวแผ่นเว้นขอบบนของเครื่อง (safe-area)
 *    • เลื่อนขึ้นทันทีที่แตะ — เนื้อหาหนักๆ วาดตามหลัง 1 เฟรม (ท่าเลื่อนวิ่งบน GPU ไม่รอเนื้อหา จึงไม่กระตุก)
 *    • จังหวะเลื่อนแบบแอปมือถือ (เร็วตอนต้น ค่อยๆ หยุด)
 * 🔁 (25 ต.ค. 2569 ผู้ใช้: "เปิดดูเอกสารกระพริบวาบๆ ช่วงแรก · เลื่อนลงปิดเร็วๆ ดูแข็งๆ วาบๆ ไม่สมูท")
 *    • เนื้อหาวาดแบบ "แบ่งเป็นช่วงๆ" (startTransition) — เบราว์เซอร์ยังวาดท่าเลื่อนได้ทุกเฟรมระหว่างวาดเนื้อหา
 *      แล้วเนื้อหาค่อยๆ จางเข้า (ไม่โผล่ปุบ · ไม่มีโครงหลอกสลับไปมาให้วาบ)
 *    • ปิดแล้วเนื้อหายังอยู่จนแผ่นเลื่อนพ้นจอ (เดิมเนื้อหาหายทันทีที่เริ่มปิด → แผ่นเปล่าวาบลงไป)
 *    • พื้นหลังมืดจางตามนิ้วตอนลากลง (เดิมปิดไว้บน Android → ลากแล้วพื้นหลังดำค้าง แล้วหายวาบ)
 */
import { startTransition, useEffect, useState } from "react";
import { Box, Dialog, IconButton, Stack, SwipeableDrawer, Typography, useMediaQuery } from "@mui/material";
import { Close } from "@mui/icons-material";

const iOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

/** จังหวะเลื่อนของแผ่นล่าง (ใช้ร่วมกับแผ่นล่างอื่นในแอป ให้รู้สึกเหมือนกันทุกหน้า) */
export const SHEET_EASING = { enter: "cubic-bezier(.32,.72,0,1)", exit: "cubic-bezier(.4,0,1,1)" };
export const SHEET_DURATION = { enter: 340, exit: 220 };
export const SHEET_PAPER_SX = {
  height: "100dvh", maxHeight: "100dvh", borderTopLeftRadius: 16, borderTopRightRadius: 16,
  overflow: "hidden", display: "flex", flexDirection: "column", bgcolor: "#f8fafc",
  willChange: "transform", contain: "layout paint",
};

/**
 * เปิดแล้วรอ 1 เฟรมค่อยวาดเนื้อหา — ให้แผ่นเริ่มเลื่อนทันที ไม่ค้างรอเนื้อหาหนักๆ
 * ปิดแล้วคงเนื้อหาไว้จนท่าปิดจบ (lingerMs) — แผ่นไม่ว่างเปล่าตอนกำลังเลื่อนลง
 */
export function useDeferredOpen(open, lingerMs = SHEET_DURATION.exit + 60) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => setReady(false), lingerMs);
      return () => clearTimeout(t);
    }
    // ให้แผ่นได้วาดบนจอก่อน 1 เฟรม แล้ววาดเนื้อหาแบบไม่ขวางจอ (React แบ่งงานเป็นช่วงสั้นๆ คืนจังหวะให้เบราว์เซอร์วาดท่าเลื่อน)
    const id = requestAnimationFrame(() => startTransition(() => setReady(true)));
    return () => cancelAnimationFrame(id);
  }, [open, lingerMs]);
  return ready;
}

/** คง true ไว้อีกครู่หลังปิด — ใช้กับเนื้อหาที่ผู้เรียกวาดเองตาม open (เช่น `{open ? <Body/> : null}`) */
export function useLinger(open, ms = SHEET_DURATION.exit + 60) {
  const [on, setOn] = useState(open);
  useEffect(() => {
    if (open) { setOn(true); return undefined; }
    const t = setTimeout(() => setOn(false), ms);
    return () => clearTimeout(t);
  }, [open, ms]);
  return open || on;
}

/** โครงจางๆ ระหว่างรอเนื้อหา (สูงพอให้แผ่นไม่ดูว่าง) */
export const SheetPlaceholder = () => (
  <Box sx={{ p: 2, display: "grid", gap: 1.25 }}>
    {[72, 120, 96].map((h, i) => (
      <Box key={i} sx={{ height: h, borderRadius: 3, bgcolor: "#fff", border: "1px solid #e2e8f0", opacity: 0.7 }} />
    ))}
  </Box>
);

/** ห่อเนื้อหาที่วาดตามหลัง — จางเข้าพร้อมขยับขึ้นเล็กน้อย 0.16 วินาที (ไม่โผล่ปุบ) */
export const FadeIn = ({ children }) => (
  <Box sx={{
    "@keyframes ttSheetFadeIn": { from: { opacity: 0, transform: "translateY(6px)" }, to: { opacity: 1, transform: "none" } },
    animation: "ttSheetFadeIn .16s ease-out",
  }}>{children}</Box>
);

/**
 * @param title / subtitle  หัวแผ่น · actions = ปุ่มข้างหัว (เช่น "ดูในปฏิทิน")
 * @param maxWidth          ความกว้าง Dialog บนจอใหญ่
 */
export default function MobileSheet({ open, onClose, title, subtitle, actions, children, maxWidth = "md", bodySx }) {
  const isMobile = useMediaQuery("(max-width:599.95px)");
  const ready = useDeferredOpen(open && isMobile);
  const head = (
    <Box sx={{ position: "sticky", top: 0, zIndex: 2, bgcolor: "#fff", borderBottom: "1px solid #e2e8f0", pt: isMobile ? "env(safe-area-inset-top)" : 0 }}>
      {isMobile && <Box sx={{ width: 40, height: 5, borderRadius: 99, bgcolor: "#cbd5e1", mx: "auto", mt: 1 }} />}
      <Stack direction="row" alignItems="center" gap={1} sx={{ px: 2, py: isMobile ? 1 : 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {title && <Typography noWrap sx={{ fontWeight: 900, fontSize: "1rem", color: "#0f172a", lineHeight: 1.3 }}>{title}</Typography>}
          {subtitle && <Typography noWrap sx={{ fontSize: "0.76rem", color: "#64748b" }}>{subtitle}</Typography>}
        </Box>
        {actions}
        <IconButton size="small" onClick={onClose} aria-label="ปิด"><Close fontSize="small" /></IconButton>
      </Stack>
    </Box>
  );
  const body = (
    <Box sx={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", bgcolor: "#f8fafc", ...bodySx }}>
      {!isMobile ? children : ready ? <FadeIn>{children}</FadeIn> : null}
    </Box>
  );

  if (isMobile) {
    return (
      <SwipeableDrawer anchor="bottom" open={open} onClose={onClose} onOpen={() => {}}
        disableSwipeToOpen disableDiscovery={iOS}
        transitionDuration={SHEET_DURATION} SlideProps={{ easing: SHEET_EASING }}
        ModalProps={{ keepMounted: false }}
        PaperProps={{ className: "tt-swipe-native", sx: SHEET_PAPER_SX }}>
        {head}
        {body}
      </SwipeableDrawer>
    );
  }
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth={maxWidth}
      PaperProps={{ sx: { borderRadius: 3, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "90vh" } }}>
      {head}
      {body}
    </Dialog>
  );
}
