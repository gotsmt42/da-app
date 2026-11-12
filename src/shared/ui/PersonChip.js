import { useMemo, useState } from "react";
import { Avatar, Box, ButtonBase, Drawer, IconButton, InputAdornment, Menu, MenuItem, Stack, TextField, Tooltip, Typography, useMediaQuery } from "@mui/material";
import { CloseRounded, SearchRounded } from "@mui/icons-material";
import { SORTER } from "@/shared/utils/sheetPicker";
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

/**
 * ป้ายประ "ยังไม่มอบหมาย" — ใช้แทนชิปเมื่อยังไม่มีผู้รับผิดชอบ
 * ✅ (10 ต.ค. 2569 ผู้ใช้: "สีสันยังดูรกๆ ตัดกัน มองยาก แก้ไขให้มืออาชีพ") — เดิมส้ม ตัดกับสีอื่นในการ์ด
 *    ตอนนี้: กดมอบหมายได้ = ตัวหนังสือน้ำเงิน (สีปุ่มของแอป) · ดูอย่างเดียว = เทา
 */
export function UnassignedChip({ label = "ยังไม่มอบหมาย", action = false }) {
  return (
    <Box component="span" sx={{
      display: "inline-flex", alignItems: "center", px: 1, py: 0.3, borderRadius: 99, whiteSpace: "nowrap",
      fontSize: "0.72rem", fontWeight: 700, color: action ? "#2563eb" : "#64748b",
      border: "1px dashed", borderColor: action ? "#bfdbfe" : "#cbd5e1", bgcolor: "#fff",
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
    : <UnassignedChip label={onAssign ? "+ มอบหมาย" : "ยังไม่มอบหมาย"} action={Boolean(onAssign)} />;
  if (!onAssign) return chip;
  return (
    <ButtonBase
      onClick={(e) => { e.stopPropagation(); onAssign(e.currentTarget); }}
      aria-label={responsible ? `ผู้รับผิดชอบ ${responsible} — กดเพื่อเปลี่ยน` : "มอบหมายผู้รับผิดชอบ"}
      sx={{ borderRadius: 99, display: "inline-flex", alignItems: "center", gap: 0.4, "&:hover .co-assign-edit": { opacity: 1 }, "&:focus-visible": { outline: "2px solid #dc2626", outlineOffset: 2 } }}
    >
      {chip}
      {responsible && <Box component="span" className="co-assign-edit" sx={{ fontSize: "0.7rem", color: "#94a3b8", opacity: 0.6, transition: "opacity .15s" }}>✎</Box>}
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
export function AssignResponsibleMenu({ anchorEl, onClose, employees = [], value, onPick, title = "มอบหมายผู้รับผิดชอบ" }) {
  const [q, setQ] = useState("");
  const avatars = useAvatarMap(employees);
  const names = useMemo(
    () => [...new Set((employees || []).map((e) => e?.fname).filter(Boolean))].sort((a, b) => SORTER.compare(a, b)),
    [employees],
  );
  const shown = names.filter((n) => !q.trim() || n.toLowerCase().includes(q.trim().toLowerCase()));
  const [askClear, setAskClear] = useState(false);
  const pick = (n) => { onPick(n); setQ(""); setAskClear(false); };
  const mobile = useMediaQuery("(max-width:600px)");
  // ✅ (12 พ.ย. 2569 ผู้ใช้: "ยกเลิกมอบหมายก็ให้มีคอนเฟิร์มให้กดก่อนด้วย") ถามยืนยันในหน้าต่างเดียวกันก่อนล้างค่า
  const confirmBar = askClear && (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mx: mobile ? 1.75 : 1, mb: 1, px: 1.25, py: 1, borderRadius: "12px", bgcolor: "#fff7ed", border: "1px solid #fed7aa" }}>
      <Typography sx={{ flex: 1, fontSize: "0.84rem", fontWeight: 700, color: "#9a3412" }}>ยกเลิกการมอบหมาย “{value}” ?</Typography>
      <ButtonBase onClick={() => pick("")} sx={{ height: 34, px: 1.5, borderRadius: "10px", bgcolor: "#dc2626", color: "#fff", fontFamily: "inherit", fontSize: "0.82rem", fontWeight: 800 }}>ยืนยัน</ButtonBase>
      <ButtonBase onClick={() => setAskClear(false)} sx={{ height: 34, px: 1.25, borderRadius: "10px", color: "#475569", fontFamily: "inherit", fontSize: "0.82rem", fontWeight: 700 }}>ไม่</ButtonBase>
    </Stack>
  );
  /**
   * 🔁 (12 พ.ย. 2569 ผู้ใช้: "select ข้อมูลก็ทำให้เหมือนกับหน้า event ด้วย ทั้ง 2 หน้า ให้ดูง่าย จอมือถือ")
   *    มือถือ = แผ่นเลือกจากล่าง แบบเดียวกับหน้าต่างเลือกในฟอร์มงาน (ช่องค้นหาติดบน · แถวใหญ่มีรูป · วงเลือกท้ายแถว · ลากลงปิดได้)
   *    คอม = เมนูเดิม · เรียง A-Z แบบเดียวกัน (อังกฤษก่อน แล้วไทย ก-ฮ)
   */
  if (mobile) {
    const close = () => { setQ(""); setAskClear(false); onClose(); };
    return (
      <Drawer anchor="bottom" open={Boolean(anchorEl)} onClose={close} onClick={(e) => e.stopPropagation()}
        sx={{ zIndex: 20040 }}
        PaperProps={{ sx: { height: "82%", borderRadius: "18px 18px 0 0", display: "flex", flexDirection: "column", overflow: "hidden" } }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.75, pt: 1.5, pb: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>{title}</Typography>
            <Typography sx={{ fontSize: "0.8rem", color: "#64748b" }}>{names.length} คน</Typography>
          </Box>
          {value && (
            <ButtonBase onClick={() => setAskClear(true)} sx={{ height: 40, px: 1.5, borderRadius: "12px", bgcolor: "#fff7ed", color: "#b45309", fontFamily: "inherit", fontSize: "0.84rem", fontWeight: 700 }}>ยกเลิกมอบหมาย</ButtonBase>
          )}
          <IconButton onClick={close} aria-label="ปิด" sx={{ width: 40, height: 40, borderRadius: "12px", bgcolor: "#f1f5f9" }}><CloseRounded /></IconButton>
        </Stack>
        {confirmBar}
        <Box sx={{ px: 1.75, pb: 1.25 }} onKeyDown={(e) => e.stopPropagation()}>
          <TextField fullWidth placeholder="ค้นหาชื่อ" value={q} onChange={(e) => setQ(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded sx={{ color: "#94a3b8" }} /></InputAdornment> }}
            sx={{ "& .MuiOutlinedInput-root": { height: 48, borderRadius: "12px", bgcolor: "#f8fafc", fontSize: "0.95rem" } }} />
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", px: 1.75, pb: 2 }}>
          {shown.length > 0 ? (
            <Box sx={{ border: "1px solid #e6e9ef", borderRadius: "14px", overflow: "hidden" }}>
              {shown.map((n, i) => {
                const cur = n === value;
                return (
                  <ButtonBase key={n} onClick={() => pick(n)}
                    sx={{ width: "100%", justifyContent: "flex-start", gap: 1.25, minHeight: 56, px: 1.5, fontFamily: "inherit", bgcolor: cur ? "#eff6ff" : "#fff", borderTop: i ? "1px solid #eef2f7" : 0 }}>
                    <Avatar src={avatars.get(n)} sx={{ width: 36, height: 36, fontSize: "0.85rem", fontWeight: 800, bgcolor: personColor(n) }}>{personInitial(n)}</Avatar>
                    <Typography sx={{ flex: 1, textAlign: "left", fontSize: "0.95rem", fontWeight: cur ? 800 : 600, color: cur ? "#1d4ed8" : "#0f172a" }}>{n}</Typography>
                    <Box sx={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, boxSizing: "border-box",
                      ...(cur ? { bgcolor: "#2563eb", color: "#fff", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 900 } : { border: "2px solid #cbd5e1" }) }}>{cur ? "✓" : ""}</Box>
                  </ButtonBase>
                );
              })}
            </Box>
          ) : <Typography sx={{ py: 4, textAlign: "center", fontSize: "0.9rem", color: "#64748b" }}>ไม่พบชื่อ</Typography>}
        </Box>
      </Drawer>
    );
  }
  return (
    <Menu
      open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={() => { setQ(""); setAskClear(false); onClose(); }}
      onClick={(e) => e.stopPropagation()}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }} transformOrigin={{ vertical: "top", horizontal: "left" }}
      slotProps={{ paper: { sx: { borderRadius: 2.5, width: 260, mt: 0.5, border: "1px solid #e6e9ef", boxShadow: "0 12px 32px rgba(15,23,42,.14)" } } }}
      MenuListProps={{ dense: true, sx: { py: 0.5 } }}
    >
      <Box sx={{ px: 1.5, pt: 0.75, pb: 0.5 }} onKeyDown={(e) => e.stopPropagation()}>
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: "#64748b", mb: 0.75 }}>{title}</Typography>
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
            {n === value && <Typography sx={{ fontSize: "0.8rem", color: "#2563eb", fontWeight: 800 }}>✓</Typography>}
          </MenuItem>
        ))}
        {shown.length === 0 && <Typography sx={{ px: 2, py: 1, fontSize: "0.8rem", color: "#94a3b8" }}>ไม่พบชื่อ</Typography>}
      </Box>
      {value && (
        <Box sx={{ borderTop: "1px solid #eef2f7", mt: 0.5, pt: 0.5 }}>
          {askClear ? confirmBar : (
            <MenuItem onClick={() => setAskClear(true)} sx={{ mx: 0.5, borderRadius: 1.5, color: "#b45309", fontSize: "0.8rem" }}>
              ยกเลิกการมอบหมาย
            </MenuItem>
          )}
        </Box>
      )}
    </Menu>
  );
}
