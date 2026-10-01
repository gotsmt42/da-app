import { useMemo, useState } from "react";
import { Avatar, Box, ButtonBase, Menu, MenuItem, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import { hasValidAvatar } from "@/shared/utils/user";

/**
 * ชิปแสดง "คน" — รูป/อักษรย่อสีประจำตัว + ชื่อ (สีเดียวกับทุกหน้าที่ใช้ personColor)
 *
 * ✅ ใช้เน้น "ผู้รับผิดชอบ" และ "ผู้เข้าทำงาน" ให้เห็นทันทีว่าใครเกี่ยวข้องกับงาน แทนชื่อคั่นจุลภาคยาวๆ
 *
 * @param name    ชื่อ (fname)
 * @param avatar  URL รูปโปรไฟล์ (ไม่มี = อักษรย่อ)
 * @param badge   ข้อความเล็กต่อท้าย เช่น "หัวหน้า"
 * @param strong  เน้นมากขึ้น (พื้นสีประจำตัว) — ใช้กับผู้รับผิดชอบ
 */
export function PersonChip({ name, avatar, badge, strong = false, size = 22, title }) {
  const color = personColor(name);
  return (
    <Tooltip title={title || name} disableInteractive>
      <Box component="span" sx={{
        display: "inline-flex", alignItems: "center", gap: 0.6, maxWidth: "100%",
        pl: 0.25, pr: 1, py: 0.25, borderRadius: 99,
        bgcolor: strong ? alpha(color, 0.1) : "#f1f5f9",
        border: "1px solid", borderColor: strong ? alpha(color, 0.3) : "transparent",
      }}>
        <Avatar src={avatar} sx={{ width: size, height: size, fontSize: size * 0.48, fontWeight: 800, bgcolor: color }}>
          {personInitial(name)}
        </Avatar>
        <Typography component="span" noWrap sx={{ fontSize: "0.78rem", fontWeight: strong ? 800 : 600, color: "#0f172a", minWidth: 0 }}>
          {name}
        </Typography>
        {badge && (
          <Typography component="span" sx={{ fontSize: "0.62rem", fontWeight: 700, color, bgcolor: "#fff", px: 0.5, borderRadius: 1, lineHeight: 1.5, flexShrink: 0 }}>
            {badge}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
}

/** ป้ายประ "ยังไม่มอบหมาย" — ใช้แทนชิปเมื่อยังไม่มีผู้รับผิดชอบ */
export function UnassignedChip({ label = "ยังไม่มอบหมาย" }) {
  return (
    <Box component="span" sx={{
      display: "inline-flex", alignItems: "center", px: 1, py: 0.3, borderRadius: 99, whiteSpace: "nowrap",
      fontSize: "0.72rem", fontWeight: 700, color: "#b45309",
      border: "1px dashed", borderColor: alpha("#d97706", 0.5), bgcolor: alpha("#f59e0b", 0.06),
    }}>
      {label}
    </Box>
  );
}

/**
 * ชิปผู้รับผิดชอบที่ "กดเพื่อเปลี่ยน" ได้ (ส่ง onAssign มาเมื่อผู้ใช้มีสิทธิ์มอบหมาย) — ไม่มีสิทธิ์ = แสดงเฉยๆ
 * @param onAssign (anchorEl) => void
 */
export function AssignableResponsible({ responsible, avatars, onAssign, size }) {
  const chip = responsible
    ? <PersonChip name={responsible} avatar={avatars?.get(responsible)} strong size={size} title={onAssign ? "กดเพื่อเปลี่ยนผู้รับผิดชอบ" : `ผู้รับผิดชอบงาน: ${responsible}`} />
    : <UnassignedChip label={onAssign ? "+ มอบหมาย" : "ยังไม่มอบหมาย"} />;
  if (!onAssign) return chip;
  return (
    <ButtonBase
      onClick={(e) => { e.stopPropagation(); onAssign(e.currentTarget); }}
      aria-label={responsible ? `ผู้รับผิดชอบ ${responsible} — กดเพื่อเปลี่ยน` : "มอบหมายผู้รับผิดชอบ"}
      sx={{ borderRadius: 99, display: "inline-flex", alignItems: "center", gap: 0.4, "&:hover .co-assign-edit": { opacity: 1 }, "&:focus-visible": { outline: "2px solid #dc2626", outlineOffset: 2 } }}
    >
      {chip}
      <Box component="span" className="co-assign-edit" sx={{ fontSize: "0.7rem", color: "#94a3b8", opacity: 0.6, transition: "opacity .15s" }}>✎</Box>
    </ButtonBase>
  );
}

/** แผนที่ ชื่อ → รูปโปรไฟล์ จากรายชื่อพนักงาน */
export function useAvatarMap(employees) {
  return useMemo(() => {
    const m = new Map();
    (employees || []).forEach((e) => { if (e?.fname && hasValidAvatar(e.imageUrl) && !m.has(e.fname)) m.set(e.fname, e.imageUrl); });
    return m;
  }, [employees]);
}

/** รายชื่อทีมไม่ซ้ำ — หัวหน้าทีมก่อน แล้วลูกทีม */
export const teamNamesOf = (job) =>
  [...new Set([job?.team, ...((job?.teamMembers || []).map((m) => m?.name))].filter(Boolean))];

/**
 * แถว "ผู้รับผิดชอบ · ผู้เข้าทำงาน" สำหรับการ์ดงาน
 * @param responsible ชื่อผู้รับผิดชอบ
 * @param team        รายชื่อผู้เข้าทำงาน (ตัวแรก = หัวหน้าทีม)
 */
export function PeopleRow({ responsible, team = [], avatars, onAssign }) {
  const label = (text) => (
    <Typography component="span" sx={{ fontSize: "0.68rem", fontWeight: 800, color: "#64748b", letterSpacing: ".02em", mr: 0.25, whiteSpace: "nowrap" }}>
      {text}
    </Typography>
  );
  return (
    <Stack direction={{ xs: "column", sm: "row" }} gap={{ xs: 0.75, sm: 2 }} alignItems={{ sm: "center" }} flexWrap="wrap"
      sx={{ mt: 1, mb: 0.5, p: 1, borderRadius: 2, bgcolor: "#f8fafc", border: "1px solid #eef2f7" }}>
      <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap" sx={{ minWidth: 0 }}>
        {label("ผู้รับผิดชอบ")}
        <AssignableResponsible responsible={responsible} avatars={avatars} onAssign={onAssign} />
      </Stack>
      <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap" sx={{ minWidth: 0 }}>
        {label("ผู้เข้าทำงาน")}
        {team.length
          ? team.map((n, i) => (
            <PersonChip key={n} name={n} avatar={avatars?.get(n)} badge={i === 0 && team.length > 1 ? "หัวหน้า" : undefined}
              title={i === 0 ? `หัวหน้าทีมเข้างาน: ${n}` : `ลูกทีม: ${n}`} />
          ))
          : <Typography component="span" sx={{ fontSize: "0.75rem", color: "#94a3b8" }}>ยังไม่ระบุ</Typography>}
      </Stack>
    </Stack>
  );
}

/**
 * เมนูเลือก/เปลี่ยน "ผู้รับผิดชอบ" — รายชื่อพนักงานพร้อมรูป + ช่องค้นหา + ตัวเลือก "ยังไม่มอบหมาย"
 * ใช้ได้ทุกหน้าที่แสดงผู้รับผิดชอบ (การดำเนินงาน ฯลฯ) — บันทึกผ่านเส้นทางเดียวกับหน้าภาพรวมงาน ค่าจึงตรงกันทุกหน้า
 * @param anchorEl  ตำแหน่งที่เมนูเกาะ (null = ปิด)
 * @param employees รายชื่อพนักงาน [{ fname, imageUrl, jobTitle }]
 * @param value     ผู้รับผิดชอบปัจจุบัน
 * @param onPick    (name) => void — "" = ยกเลิกการมอบหมาย
 */
export function AssignResponsibleMenu({ anchorEl, onClose, employees = [], value, onPick }) {
  const [q, setQ] = useState("");
  const avatars = useAvatarMap(employees);
  const names = useMemo(
    () => [...new Set((employees || []).map((e) => e?.fname).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th")),
    [employees],
  );
  const shown = names.filter((n) => !q.trim() || n.toLowerCase().includes(q.trim().toLowerCase()));
  const pick = (n) => { onPick(n); setQ(""); };
  return (
    <Menu
      open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={() => { setQ(""); onClose(); }}
      onClick={(e) => e.stopPropagation()}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }} transformOrigin={{ vertical: "top", horizontal: "left" }}
      slotProps={{ paper: { sx: { borderRadius: 2.5, width: 260, mt: 0.5, border: "1px solid #e2e8f0", boxShadow: "0 12px 32px rgba(15,23,42,.14)" } } }}
      MenuListProps={{ dense: true, sx: { py: 0.5 } }}
    >
      <Box sx={{ px: 1.5, pt: 0.75, pb: 0.5 }} onKeyDown={(e) => e.stopPropagation()}>
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: "#64748b", mb: 0.75 }}>มอบหมายผู้รับผิดชอบ</Typography>
        <TextField
          size="small" fullWidth autoFocus placeholder="ค้นหาชื่อ" value={q} onChange={(e) => setQ(e.target.value)}
          sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, fontSize: "0.82rem" } }}
        />
      </Box>
      <Box sx={{ maxHeight: 280, overflowY: "auto" }}>
        {shown.map((n) => (
          <MenuItem key={n} selected={n === value} onClick={() => pick(n)} sx={{ mx: 0.5, borderRadius: 1.5, gap: 1 }}>
            <Avatar src={avatars.get(n)} sx={{ width: 24, height: 24, fontSize: "0.72rem", fontWeight: 800, bgcolor: personColor(n) }}>{personInitial(n)}</Avatar>
            <Typography sx={{ flex: 1, fontSize: "0.84rem", fontWeight: n === value ? 800 : 500 }}>{n}</Typography>
            {n === value && <Typography sx={{ fontSize: "0.8rem", color: "#dc2626", fontWeight: 800 }}>✓</Typography>}
          </MenuItem>
        ))}
        {shown.length === 0 && <Typography sx={{ px: 2, py: 1, fontSize: "0.8rem", color: "#94a3b8" }}>ไม่พบชื่อ</Typography>}
      </Box>
      {value && (
        <Box sx={{ borderTop: "1px solid #eef2f7", mt: 0.5, pt: 0.5 }}>
          <MenuItem onClick={() => pick("")} sx={{ mx: 0.5, borderRadius: 1.5, color: "#b45309", fontSize: "0.8rem" }}>
            ยกเลิกการมอบหมาย
          </MenuItem>
        </Box>
      )}
    </Menu>
  );
}
