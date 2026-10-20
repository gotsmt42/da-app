/**
 * HeaderTaskBell — ปุ่ม "งานที่ต้องทำ" บนแถบบน (แยกจากกระดิ่งการแจ้งเตือน)
 *
 * ✅ (20 ต.ค. 2569 ผู้ใช้: "เตือนช่างว่ามีงานที่ไม่กดรับทราบ ไม่กดบันทึกงานเมื่อถึงเวลา … ให้ทำเป็นรูปแบบแจ้งเตือนตรง header
 *    แทน ให้แยกเมนูแจ้งเตือนออกมา")
 *    ไอคอนคลิปบอร์ด + ตัวเลขแดง = จำนวนงานที่ต้องลงมือตอนนี้ (ยังไม่บันทึกเข้างานวันนี้ · ยังไม่รับทราบ · ยังไม่ยืนยันนัด)
 *    กดแล้วเห็นรายการทีละงาน แยกหมวด · กดงาน = ไปที่การ์ดงานนั้นในงานของฉัน
 *    มือถือ: แผ่นเลื่อนขึ้นจากล่าง (ลากลงปิด) · จอคอม: กล่องลอยใต้ปุ่ม
 *    เห็นเฉพาะคนที่มีหน้างานของฉัน (ช่าง/ผู้รับผิดชอบ/หัวหน้าทีม/แอดมิน)
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Box, Button, ButtonBase, IconButton, Popover, Stack, SwipeableDrawer, Tooltip, Typography, useMediaQuery } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { AssignmentLateOutlined, AssignmentTurnedInOutlined, ThumbUpAltOutlined, EventAvailableOutlined, LoginRounded, ChevronRight, Close } from "@mui/icons-material";
import useAppBadges from "@/shared/hooks/useAppBadges";
import useMyAttention from "@/shared/hooks/useMyAttention";
import { useAuth } from "@/features/auth/AuthContext";
import { can } from "@/shared/utils/roles";
import { ATTENTION_META, attentionDayText } from "@/shared/utils/myJobAttention";

const ICON = { checkin: <LoginRounded />, ack: <ThumbUpAltOutlined />, confirm: <EventAvailableOutlined /> };
const LINE = "#e2e8f0";
/** สิ่งที่ต้องกด (สั้น ชัด) */
const ACTION = { checkin: "กดบันทึกเข้างาน", ack: "กดรับทราบงาน", confirm: "กดยืนยันนัดหมาย" };
/** แยกตามบทบาทของฉันในงาน */
const ROLES = [
  { key: "head", label: "ในฐานะหัวหน้าทีมเข้างาน", keys: ["checkin"] },
  { key: "resp", label: "ในฐานะผู้รับผิดชอบงาน", keys: ["ack", "confirm"] },
];

export default function HeaderTaskBell() {
  const { userData } = useAuth() || {};
  const { events } = useAppBadges(userData);
  const att = useMyAttention(events, userData);
  const isMobile = useMediaQuery("(max-width:600px)");
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState(null);
  const open = Boolean(anchor);
  const close = () => setAnchor(null);
  if (!userData || !(can(userData, "receiveDispatch") || can(userData, "viewAllJobs"))) return null;

  const go = (url) => { close(); navigate(url); };

  const content = (
    <Box sx={{ display: "flex", flexDirection: "column", maxHeight: isMobile ? "80vh" : 520 }}>
      {isMobile && <Box sx={{ width: 40, height: 5, borderRadius: 99, bgcolor: "#cbd5e1", mx: "auto", mt: 1 }} />}
      <Stack direction="row" alignItems="center" gap={1} sx={{ px: 2, py: 1.25, borderBottom: `1px solid ${LINE}`, flexShrink: 0 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900, fontSize: "1.02rem", color: "#0f172a" }}>งานที่ต้องทำตอนนี้</Typography>
          <Typography sx={{ fontSize: "0.74rem", color: "#64748b" }}>{att.total ? `${att.total} งาน · กันลืม` : "ไม่มีงานค้างให้กด"}</Typography>
        </Box>
        <IconButton size="small" aria-label="ปิด" onClick={close}><Close fontSize="small" /></IconButton>
      </Stack>
      <Box sx={{ overflowY: "auto", overscrollBehavior: "contain" }}>
        {!att.total ? (
          <Stack alignItems="center" gap={0.75} sx={{ py: 4, px: 2, color: "#16a34a" }}>
            <AssignmentTurnedInOutlined sx={{ fontSize: 40 }} />
            <Typography sx={{ fontWeight: 800, fontSize: "0.9rem", color: "#0f172a" }}>เรียบร้อยดี ไม่มีอะไรค้าง</Typography>
            <Typography sx={{ fontSize: "0.76rem", color: "#64748b", textAlign: "center" }}>รับทราบ · ยืนยันนัด · บันทึกเข้างานวันนี้ ครบแล้ว</Typography>
          </Stack>
        ) : ROLES.filter((r) => r.keys.some((k) => att[k].length)).map((role) => (
          // ✅ (20 ต.ค. 2569 ผู้ใช้: "แยกเป็นบุคคล ไม่รวมกัน ตามผู้รับผิดชอบ หรือหัวหน้างาน · ทำให้ดูง่ายกว่านี้")
          //    แยกตามบทบาทของฉันในงานนั้น: ผู้รับผิดชอบงาน (รับทราบ · ยืนยันนัด) · หัวหน้าทีมเข้างาน (บันทึกเข้างาน)
          <Box key={role.key} sx={{ pb: 0.5 }}>
            <Stack direction="row" alignItems="center" gap={0.75} sx={{ px: 2, pt: 1.5, pb: 0.75 }}>
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 900, color: "#64748b", letterSpacing: 0.3 }}>{role.label}</Typography>
              <Box sx={{ flex: 1, height: 1, bgcolor: LINE }} />
            </Stack>
            {role.keys.flatMap((k) => att[k].map((e) => ({ k, e }))).map(({ k, e }) => {
              const m = ATTENTION_META[k];
              return (
                <ButtonBase key={`${k}-${e._id}`} onClick={() => go(`/technician/jobs?job=${e._id}`)}
                  sx={{ mx: 1.25, mb: 1, width: "calc(100% - 20px)", display: "flex", alignItems: "center", gap: 1.25, p: 1.25, textAlign: "left", fontFamily: "inherit",
                    borderRadius: 2.5, border: `1px solid ${alpha(m.color, 0.3)}`, bgcolor: alpha(m.color, 0.04), "&:hover": { bgcolor: alpha(m.color, 0.08) } }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: 2.5, flexShrink: 0, display: "grid", placeItems: "center", bgcolor: m.color, color: "#fff", "& svg": { fontSize: 21 } }}>{ICON[k]}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.8rem", fontWeight: 900, color: m.color, lineHeight: 1.3 }}>{ACTION[k]} · {attentionDayText(e)}</Typography>
                    <Typography noWrap sx={{ fontSize: "0.9rem", fontWeight: 800, color: "#0f172a", lineHeight: 1.35 }}>{e.site || e.company || "ไม่ระบุโครงการ"}</Typography>
                    <Typography noWrap sx={{ fontSize: "0.72rem", color: "#64748b" }}>{[e.title, e.system, e.jobNo].filter(Boolean).join(" · ")}</Typography>
                  </Box>
                  <ChevronRight sx={{ fontSize: 22, color: m.color, flexShrink: 0 }} />
                </ButtonBase>
              );
            })}
          </Box>
        ))}
      </Box>
      <Box sx={{ p: 1.25, borderTop: `1px solid ${LINE}`, flexShrink: 0, pb: isMobile ? "calc(10px + env(safe-area-inset-bottom))" : 1.25 }}>
        <Button fullWidth onClick={() => go("/technician/jobs")} sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2 }}>ไปที่งานของฉัน</Button>
      </Box>
    </Box>
  );

  return (
    <>
      <Tooltip title={att.total ? `งานที่ต้องทำตอนนี้ ${att.total} งาน` : "งานที่ต้องทำ"}>
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} size="small" aria-label={att.total ? `งานที่ต้องทำตอนนี้ ${att.total} งาน` : "งานที่ต้องทำ"}
          sx={{ border: "1px solid rgba(255,255,255,0.18)", borderRadius: 2, color: att.total ? "#fecaca" : "#fff" }}>
          <Badge badgeContent={att.total} color="error" max={99}>
            {att.total ? <AssignmentLateOutlined fontSize="small" /> : <AssignmentTurnedInOutlined fontSize="small" />}
          </Badge>
        </IconButton>
      </Tooltip>
      {isMobile ? (
        <SwipeableDrawer anchor="bottom" open={open} onClose={close} onOpen={() => {}} disableSwipeToOpen
          transitionDuration={{ enter: 260, exit: 200 }}
          PaperProps={{ sx: { borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: "hidden" } }}>
          {content}
        </SwipeableDrawer>
      ) : (
        <Popover open={open} anchorEl={anchor} onClose={close}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
          PaperProps={{ sx: { mt: 1, borderRadius: 3, width: 400, maxWidth: "94vw", boxShadow: "0 12px 40px rgba(15,23,42,.18)", overflow: "hidden" } }}>
          {content}
        </Popover>
      )}
    </>
  );
}

