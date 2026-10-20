/**
 * MobileSheet — หน้าต่างรายละเอียดแบบ "แผ่นเลื่อนขึ้นจากล่าง" บนมือถือ (ใช้ร่วมทุกหน้า)
 *
 * ✅ (20 ต.ค. 2569 ผู้ใช้: "ให้ทุกหน้าเลื่อนขึ้นแค่แบบนี้ แต่สมูท สมบูรณ์ เพื่อที่จะเลื่อนลงปิดได้ง่ายๆ")
 *    มือถือ: เลื่อนขึ้นจากขอบล่าง สูง 92% ของจอ มุมบนโค้ง มีขีดจับด้านบน — ลากลงเพื่อปิด
 *    (ลากที่หัวแผ่น หรือที่เนื้อหาตอนเลื่อนอยู่บนสุด) · จอใหญ่: กล่อง Dialog ปกติ
 * ⚠️ ใช้ SwipeableDrawer ของ MUI — เนื้อหาที่เลื่อนได้ข้างใน MUI แยกให้เองว่าจะเลื่อนเนื้อหาหรือลากปิด
 */
import { Box, Dialog, IconButton, Stack, SwipeableDrawer, Typography, useMediaQuery } from "@mui/material";
import { Close } from "@mui/icons-material";

const iOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

/**
 * @param title / subtitle  หัวแผ่น · actions = ปุ่มข้างหัว (เช่น "ดูในปฏิทิน")
 * @param maxWidth          ความกว้าง Dialog บนจอใหญ่
 */
export default function MobileSheet({ open, onClose, title, subtitle, actions, children, maxWidth = "md", bodySx }) {
  const isMobile = useMediaQuery("(max-width:599.95px)");
  const head = (
    <Box sx={{ position: "sticky", top: 0, zIndex: 2, bgcolor: "#fff", borderBottom: "1px solid #e2e8f0" }}>
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
  const body = <Box sx={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", bgcolor: "#f8fafc", ...bodySx }}>{children}</Box>;

  if (isMobile) {
    return (
      <SwipeableDrawer anchor="bottom" open={open} onClose={onClose} onOpen={() => {}}
        disableSwipeToOpen disableDiscovery={iOS} disableBackdropTransition={!iOS}
        transitionDuration={{ enter: 260, exit: 200 }}
        ModalProps={{ keepMounted: false }}
        PaperProps={{ sx: { height: "92dvh", maxHeight: "92dvh", borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: "hidden", display: "flex", flexDirection: "column", bgcolor: "#f8fafc" } }}>
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
