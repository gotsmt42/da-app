import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import moment from "moment";
import "moment/locale/th";

import {
  Box, IconButton, Badge, Tooltip, Popover, Typography, Stack,
  List, ListItem, ListItemAvatar, ListItemText, Avatar,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Notifications, NotificationsActive, HourglassTop, CheckCircle, Cancel, Chat,
} from "@mui/icons-material";

const NOTI_META = {
  close_requested: { icon: <HourglassTop sx={{ fontSize: 16 }} />, color: "#f59e0b" },
  close_approved: { icon: <CheckCircle sx={{ fontSize: 16 }} />, color: "#10b981" },
  close_rejected: { icon: <Cancel sx={{ fontSize: 16 }} />, color: "#ef4444" },
  comment: { icon: <Chat sx={{ fontSize: 16 }} />, color: "#3b82f6" },
};

// ✅ UI ล้วน (presentational) ใช้ร่วมกันได้ทุกที่ที่มี useEventNotifications อยู่แล้ว
// (หน้า Operation ที่มี events ในสโตร์อยู่แล้ว, และ Header ที่ fetch events เองเพื่อให้เห็น
// แจ้งเตือนได้ทุกหน้า ไม่ใช่แค่ตอนเปิดหน้า Operation ค้างไว้)
const NotificationBell = ({ notifications, unread, onItemClick, dark = false }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();

  const handleOpen = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleNotificationClick = (n) => {
    if (onItemClick) onItemClick(n.id);
    setAnchorEl(null);
    if (n.eventId) navigate(`/operation/${n.eventId}`);
  };

  return (
    <>
      <Tooltip title="การแจ้งเตือน">
        <IconButton
          onClick={handleOpen}
          size="small"
          sx={{
            border: "1px solid",
            borderColor: dark ? "rgba(255,255,255,0.18)" : "divider",
            borderRadius: 2,
            color: dark ? "#fff" : "inherit",
          }}
        >
          <Badge badgeContent={unread} color="error" max={9}>
            <Notifications fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ sx: { borderRadius: 3, width: 320, maxWidth: "92vw", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" } }}
      >
        <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <NotificationsActive sx={{ fontSize: 18, color: "primary.main" }} />
            <Typography fontWeight={700} fontSize="0.9rem">การแจ้งเตือน</Typography>
          </Stack>
        </Box>
        {notifications.length === 0 ? (
          <Box sx={{ p: 3, textAlign: "center", color: "text.disabled" }}>
            <Notifications sx={{ fontSize: 36, opacity: 0.25 }} />
            <Typography variant="body2">ยังไม่มีการแจ้งเตือน</Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ maxHeight: 360, overflowY: "auto" }}>
            {notifications.map((n, i) => {
              const meta = NOTI_META[n.type] || NOTI_META.close_requested;
              return (
                <ListItem
                  key={n.id}
                  divider={i < notifications.length - 1}
                  onClick={() => handleNotificationClick(n)}
                  sx={{
                    py: 1.25, px: 2, cursor: n.eventId ? "pointer" : "default",
                    opacity: n.read ? 0.5 : 1,
                    transition: "opacity 0.2s ease, background-color 0.15s ease",
                    "&:hover": n.eventId ? { bgcolor: (t) => alpha(t.palette.primary.main, 0.06) } : {},
                  }}
                >
                  <ListItemAvatar sx={{ minWidth: 36 }}>
                    <Avatar sx={{
                      width: 30, height: 30,
                      bgcolor: n.read ? alpha("#6b7280", 0.12) : alpha(meta.color, 0.12),
                      color: n.read ? "#6b7280" : meta.color,
                    }}>
                      {meta.icon}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography variant="caption" fontWeight={n.read ? 500 : 700}>{n.message}</Typography>
                    }
                    secondary={
                      <Stack>
                        <Typography variant="caption" color="text.secondary">{n.detail}</Typography>
                        <Typography variant="caption" color="text.disabled">
                          {moment(n.time).locale("th").fromNow()}
                        </Typography>
                      </Stack>
                    }
                  />
                </ListItem>
              );
            })}
          </List>
        )}
      </Popover>
    </>
  );
};

export default NotificationBell;
