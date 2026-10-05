/**
 * FloatPersonPicker — ช่องเลือกช่าง/เซลในแถบเปลี่ยนเดือนลอยของหน้าตารางงาน
 *
 * ✅ ผู้ใช้สั่ง (5 ต.ค. 2569): "select ไม่สวย" — เดิมเป็น <select> ของเบราว์เซอร์ (รายการกล่องเหลี่ยมสีเทา)
 *    เปลี่ยนเป็นเมนูลอยขึ้นด้านบน มุมโค้ง มีรูป/อักษรย่อสีประจำตัวของแต่ละคน และเครื่องหมายถูกที่คนที่เลือก
 */
import { useState } from "react";
import { Avatar, Box, ButtonBase, Popover, Stack, Typography } from "@mui/material";
import { Check, Groups, Person, ExpandLess } from "@mui/icons-material";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import { hasValidAvatar } from "@/shared/utils/user";

const nameOf = (p) => (p.fname ? `${p.fname} ${p.lname || ""}`.trim() : p.username || "");

export default function FloatPersonPicker({ value, onChange, options = [], allLabel = "ช่างทุกคน", title = "เลือกช่าง" }) {
  const [anchor, setAnchor] = useState(null);
  const current = options.find((p) => p._id === value);
  const pick = (id) => { onChange(id); setAnchor(null); };

  const Row = ({ id, label, avatar }) => {
    const on = (id || "") === (value || "");
    return (
      <ButtonBase onClick={() => pick(id)} sx={{
        width: "100%", justifyContent: "flex-start", gap: 1.25, px: 1.25, py: 0.9, borderRadius: 2, fontFamily: "inherit",
        bgcolor: on ? "#eff6ff" : "transparent", "&:hover": { bgcolor: on ? "#eff6ff" : "#f8fafc" },
      }}>
        {avatar}
        <Typography noWrap sx={{ flex: 1, minWidth: 0, textAlign: "left", fontSize: "0.88rem", fontWeight: on ? 800 : 600, color: on ? "#1d4ed8" : "#0f172a" }}>
          {label}
        </Typography>
        {on && <Check sx={{ fontSize: 18, color: "#2563eb" }} />}
      </ButtonBase>
    );
  };

  return (
    <>
      <ButtonBase
        onClick={(e) => setAnchor(e.currentTarget)}
        className={`ec-month-float-person${value ? " is-set" : ""}`}
        aria-haspopup="listbox" aria-expanded={Boolean(anchor)}
      >
        {current ? (
          <Avatar src={hasValidAvatar(current.imageUrl) ? current.imageUrl : undefined}
            sx={{ width: 24, height: 24, fontSize: 12, fontWeight: 800, bgcolor: personColor(current.fname || current.username) }}>
            {personInitial(current.fname || current.username)}
          </Avatar>
        ) : (
          <Person sx={{ fontSize: 18, opacity: 0.7 }} />
        )}
        <span className="ec-month-float-person-label">{current ? nameOf(current) : allLabel}</span>
        <ExpandLess sx={{ fontSize: 18, opacity: 0.6, transform: anchor ? "none" : "rotate(180deg)", transition: "transform .15s" }} />
      </ButtonBase>

      <Popover
        open={Boolean(anchor)} anchorEl={anchor} onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "right" }}
        slotProps={{ paper: { sx: { mt: -1, width: 280, maxWidth: "calc(100vw - 24px)", borderRadius: 3, border: "1px solid #e2e8f0", boxShadow: "0 18px 40px rgba(15,23,42,.18)" } } }}
      >
        <Box sx={{ px: 1.75, pt: 1.25, pb: 0.5 }}>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: "#64748b", letterSpacing: ".02em" }}>{title}</Typography>
        </Box>
        <Stack spacing={0.25} sx={{ p: 0.75, pt: 0.25, maxHeight: 340, overflowY: "auto" }}>
          <Row id="" label={allLabel} avatar={
            <Box sx={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#f1f5f9", color: "#475569" }}>
              <Groups sx={{ fontSize: 18 }} />
            </Box>
          } />
          {options.map((p) => {
            const n = p.fname || p.username;
            return (
              <Row key={p._id} id={p._id} label={nameOf(p)} avatar={
                <Avatar src={hasValidAvatar(p.imageUrl) ? p.imageUrl : undefined}
                  sx={{ width: 30, height: 30, fontSize: 13, fontWeight: 800, bgcolor: personColor(n) }}>
                  {personInitial(n)}
                </Avatar>
              } />
            );
          })}
        </Stack>
      </Popover>
    </>
  );
}
