/**
 * RolePermissions — ตั้งค่าสิทธิ์ 2 ชั้นที่แยกจากกัน (ผู้ใช้สั่งให้แยก)
 *
 *   แท็บ 1 "สิทธิ์ตามตำแหน่ง (Rank)" — กรรมการผู้จัดการ/แอดมินช่าง/ช่างเทคนิค ...
 *                                     เปลี่ยน "ชื่อ" ได้ · ติ๊กว่าตำแหน่งไหนเห็นเมนูอะไร/ทำอะไรได้
 *   แท็บ 2 "ผู้ดูแลระบบ (Role)"      — Super Admin / Admin / Member
 *                                     ชื่อภาษาอังกฤษ คงที่ · ตั้งให้ผู้ใช้เป็นรายคน · ตั้งได้เฉพาะ Super Admin
 *
 * 🔁 (25 พ.ย. 2569 ผู้ใช้ — ปรับหน้านี้ทั้งหน้า):
 *   "ตรวจสอบการตั้งค่าต่างๆให้สอดคล้อง และตรง ใช้งานได้หมดไม่ผิดเพี้ยน · จัดการได้ง่าย ดูง่าย สวยงาม"
 *   "ปรับรูปแบบการเลือกให้ใช้ง่าย" · "ชื่อหัวข้อ...ให้เข้าใจง่าย สื่อความหมาย ไม่กำกวม"
 *   "ทำปุ่มต้องกดบันทึกก่อนทุกครั้งหลังแก้ไข เพื่อกันข้อผิดพลาด" · "กดเปิดปิดย่อขยายแต่ละหัวข้อได้"
 *   "ถ้าเป็น super admin ให้จัดการได้ทั้งหมด"
 *   • ติ๊ก/เลื่อนสวิตช์ = "ร่าง" เท่านั้น (ยังไม่มีผลกับใคร) → แถบล่าง "ตรวจสอบและบันทึก" → สรุปรายการ → บันทึก
 *     ออกจากหน้าทั้งที่ยังไม่บันทึก = ถามก่อน (กดเมนู/ลิงก์ในแอป และปิด/รีเฟรชแท็บ)
 *   • ตั้งทีละตำแหน่ง (หลัก) + ตารางเทียบทุกตำแหน่ง · แต่ละหัวข้อย่อ/ขยายได้ (จำไว้ในเครื่อง)
 *   • ทุกข้อบอกผลทั้งสองทาง "เปิด: … / ปิด: …" (ข้อที่มีผลอยู่ตอนนี้ตัวเข้ม) — คำอธิบายอยู่ที่ shared/utils/permissionCatalog.js
 *   • ค่าที่แสดง = ค่าที่ใช้จริงเสมอ (เดิมตำแหน่งที่ล็อกไว้ติ๊กครบทุกช่อง "สิทธิ์เต็ม" แต่จริงๆ ไม่ครบ)
 *     ช่องที่ไม่มีผลกับตำแหน่งนั้น (capNotApplicable) แสดง "ไม่มีผล" ไม่ให้ติ๊กหลอกตา
 *   • Super Admin แก้ได้ทุกตำแหน่ง รวมกรรมการผู้จัดการ (server เลิกล็อกแล้ว — LOCKED_ROLES ว่าง · ถ้า server ยังส่ง locked มา หน้าจอยังรองรับ)
 *   • Role: เลือกด้วยปุ่ม 3 ช่องในแถว · ตัวกรองเป็นปุ่มนับจำนวน · กดชื่อตำแหน่งเพื่อไปดูสิทธิ์ของตำแหน่งนั้น
 *
 * 🔒 กติกากันล็อกตัวเอง (server บังคับซ้ำที่ routes/settings.js และ routes/auth.js):
 *   • ต้องเหลือ Super Admin อย่างน้อย 1 คน · เปลี่ยน Role ของตัวเองไม่ได้
 *   • เปลี่ยน Role ต้องยืนยันด้วยรหัสผ่านของคนที่กด
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Box, Stack, Typography, Checkbox, Alert, Snackbar, CircularProgress, Tooltip, Collapse,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Avatar, AvatarGroup,
  Switch, ButtonBase, InputAdornment, useMediaQuery,
} from "@mui/material";
import PageLoader from "@/shared/ui/PageLoader";
import { alpha } from "@mui/material/styles";
import {
  AdminPanelSettingsRounded as AdminPanelSettings, LockRounded as Lock, InfoOutlined, EditRounded as Edit,
  BadgeRounded as BadgeIcon, SaveRounded as Save, CheckCircleRounded as CheckCircle,
  RemoveCircleOutlineRounded as RemoveCircleOutline, ViewListRounded, GridOnRounded, RestartAltRounded,
  SearchRounded, ArrowForwardRounded, ChevronRightRounded, ExpandMoreRounded, UnfoldMoreRounded, UnfoldLessRounded,
} from "@mui/icons-material";

import usePermissions from "@/shared/hooks/usePermissions";
import { useAuth } from "@/features/auth/AuthContext";
import PermissionService from "@/shared/services/PermissionService";
import OrgSettingService from "@/shared/services/OrgSettingService";
import AuthService from "@/shared/services/authService";
import useRealtime from "@/shared/realtime/useRealtime";
import { systemRoleOf, SYSTEM_ROLE_LABEL, rankLabel, titleOf, normalizeRole } from "@/shared/utils/roles";
import { PERMISSION_GROUPS, CAP_TITLE, CAP_NEEDS, capNotApplicable } from "@/shared/utils/permissionCatalog";
import { PAGE_SX } from "@/shared/ui/PageKit";

const BLUE = "#2563eb"; // ✅ น้ำเงินตามธีมแอป (ปุ่ม/การเลือกใช้น้ำเงินทั้งแอป)
const BLUE_DARK = "#1d4ed8";
const AMBER = "#b45309"; // ⚠️ สีส้ม = "ต้องดู" (ยังไม่บันทึก) ตามกติกาสีของแอป
const AMBER_BG = "#fffbeb";
const AMBER_LINE = "#fcd34d";
const INK = "#0f172a";
const INK_2 = "#334155";
const SUB = "#64748b";
const FAINT = "#94a3b8";
const BORDER = "#e6e9ef";
const SOFT = "#f8fafc";
const ROLE_ORDER = ["superadmin", "admin", "member"];
const VIEW_KEY = "perm.orgView";
const OPEN_KEY = "perm.openGroups";

const SWITCH_SX = {
  "& .MuiSwitch-switchBase.Mui-checked": { color: BLUE },
  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: BLUE, opacity: 0.55 },
};

/**
 * สิ่งที่แต่ละ Role ทำได้ — ตรงกับ config/roles.js + routes/auth.js ฝั่ง server
 * ✅ (8 ต.ค. 2569 ผู้ใช้: "สิทธิ์ไม่ให้รวมสิทธิ์ระบบ") Role = สิทธิ์ "ตั้งค่า/ดูแลระบบ" เท่านั้น
 *    งานทุกอย่าง (รวมข้อมูลหลัก เว็บไซต์ คำขอจากเว็บ) ใช้ได้ตามที่ติ๊กให้ Rank ของคนนั้นในแท็บแรก
 * ⚠️ Admin แตะบัญชีได้ "ระดับเดียวกันหรือต่ำกว่า" (canManageUserOfRole: ระดับตัวเอง >= ระดับเป้าหมาย) — เดิมเขียนว่า "ต่ำกว่า"
 */
const ROLE_DETAIL = {
  superadmin: {
    tone: BLUE_DARK, th: "ผู้ดูแลระบบสูงสุด",
    can: ["ตั้งค่าองค์กร (โลโก้ ข้อมูลบริษัทบนเอกสาร ค่าตั้งต้นของระบบ)", "ตั้งค่าสิทธิ์ของทุกตำแหน่ง (รวมกรรมการผู้จัดการ) และตั้ง Role ให้ผู้อื่น", "เพิ่ม/แก้ไข/ปิดบัญชีผู้ใช้ได้ทุกตำแหน่ง"],
    cannot: ["ได้สิทธิ์ทำงานเพิ่มเอง — งานใช้ได้ตามที่ติ๊กให้ตำแหน่ง (Rank) ของตัวเอง", "เปลี่ยน Role ของตัวเอง (กันล็อกตัวเองออก)"],
  },
  admin: {
    tone: "#60a5fa", th: "ผู้ดูแลบัญชีผู้ใช้",
    can: ["เพิ่ม/แก้ไขบัญชีผู้ใช้ที่ตำแหน่งระดับเดียวกันหรือต่ำกว่าตัวเอง"],
    cannot: ["ตั้งค่าองค์กร · ตั้งค่าสิทธิ์ · ตั้ง Role", "ได้สิทธิ์ทำงานเพิ่มเอง — งานใช้ได้ตามตำแหน่ง (Rank)"],
  },
  member: {
    tone: FAINT, th: "ผู้ใช้งานทั่วไป",
    can: ["ใช้งานตามสิทธิ์ของตำแหน่ง (Rank) เท่านั้น"],
    cannot: ["จัดการผู้ใช้และตั้งค่าระบบ"],
  },
};

const readLS = (k, fallback) => { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ไม่มีที่เก็บ = จำไม่ได้ ไม่เป็นไร */ } };
const fullName = (u) => [u?.fname, u?.lname].filter(Boolean).join(" ") || u?.username || "";
const avatarSrc = (u) => (u?.imageUrl?.startsWith("http") ? u.imageUrl : undefined);

/* ───────────────────────── ชิ้นส่วนเล็ก ───────────────────────── */

/** ปุ่มเลือกแบบแถบ (แท็บ · มุมมอง · ตัวกรอง · Role) — หน้าตาเดียวกันทุกจุด */
const Segmented = ({ value, onChange, options, size = "md", fullWidth = false, disabled = false, ariaLabel }) => (
  <Box role="radiogroup" aria-label={ariaLabel} sx={{
    display: fullWidth ? "grid" : "inline-grid", gridAutoFlow: "column", gridAutoColumns: fullWidth ? "minmax(max-content, 1fr)" : "auto",
    gap: 0.25, p: 0.4, borderRadius: 2.5, bgcolor: "#f1f5f9", border: `1px solid ${BORDER}`,
    width: fullWidth ? "100%" : "auto", maxWidth: "100%", opacity: disabled ? 0.55 : 1,
  }}>
    {options.map((o) => {
      const on = o.value === value;
      return (
        <ButtonBase key={o.value} role="radio" aria-checked={on} disabled={disabled || o.disabled}
          onClick={() => { if (!on) onChange(o.value); }}
          sx={{
            gap: 0.6, minWidth: 0, px: size === "sm" ? 1.1 : 1.6, py: size === "sm" ? 0.55 : 0.85, borderRadius: 2, fontFamily: "inherit",
            bgcolor: on ? "#fff" : "transparent", color: on ? BLUE : SUB, boxShadow: on ? "0 1px 3px rgba(15,23,42,.12)" : "none",
            transition: "background-color .15s, color .15s", "&:hover": { color: on ? BLUE : INK_2 },
          }}>
          {o.dot && <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: o.dot, flexShrink: 0 }} />}
          {o.icon}
          <Typography noWrap component="span" sx={{ fontSize: size === "sm" ? "0.78rem" : "0.85rem", fontWeight: on ? 800 : 700, color: "inherit" }}>{o.label}</Typography>
          {o.count != null && (
            <Box component="span" sx={{ px: 0.7, borderRadius: 99, fontSize: "0.68rem", fontWeight: 800, lineHeight: "18px", bgcolor: on ? alpha(BLUE, 0.1) : "#e2e8f0", color: on ? BLUE : SUB }}>{o.count}</Box>
          )}
          {o.alert > 0 && (
            <Box component="span" title="ยังไม่บันทึก" sx={{ px: 0.7, borderRadius: 99, fontSize: "0.68rem", fontWeight: 800, lineHeight: "18px", bgcolor: AMBER_BG, color: AMBER, border: `1px solid ${AMBER_LINE}` }}>{o.alert}</Box>
          )}
        </ButtonBase>
      );
    })}
  </Box>
);

const TAG_TONE = {
  blue: { bg: "#eff6ff", fg: BLUE, line: "transparent" },
  muted: { bg: "#f1f5f9", fg: SUB, line: "transparent" },
  amber: { bg: AMBER_BG, fg: AMBER, line: AMBER_LINE },
};
const Tag = ({ children, tone = "blue", icon }) => {
  const t = TAG_TONE[tone] || TAG_TONE.blue;
  return (
    <Box component="span" sx={{
      display: "inline-flex", alignItems: "center", gap: 0.4, px: 0.8, py: 0.1, borderRadius: 99, fontSize: "0.66rem", fontWeight: 800, whiteSpace: "nowrap", lineHeight: 1.5,
      bgcolor: t.bg, color: t.fg, border: `1px solid ${t.line}`,
    }}>{icon}{children}</Box>
  );
};

const Bar = ({ value, total }) => (
  <Box sx={{ height: 4, borderRadius: 99, bgcolor: "#e2e8f0", overflow: "hidden" }}>
    <Box sx={{ width: `${total ? Math.round((value / total) * 100) : 0}%`, height: "100%", bgcolor: BLUE, borderRadius: 99, transition: "width .25s" }} />
  </Box>
);

/** บรรทัด "เปิด: … / ปิด: …" — บรรทัดที่มีผลอยู่ตอนนี้ตัวเข้ม อีกบรรทัดจาง */
const EffectLine = ({ kind, active, children }) => (
  <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ mt: 0.4 }}>
    <Box component="span" sx={{
      flexShrink: 0, mt: "1px", px: 0.6, minWidth: 30, textAlign: "center", borderRadius: 1, fontSize: "0.64rem", fontWeight: 800, lineHeight: "17px",
      ...(active
        ? { bgcolor: kind === "on" ? BLUE : "#64748b", color: "#fff" }
        : { color: FAINT, boxShadow: `inset 0 0 0 1px ${"#e2e8f0"}` }),
    }}>{kind === "on" ? "เปิด" : "ปิด"}</Box>
    <Typography component="span" sx={{ fontSize: "0.76rem", lineHeight: 1.5, color: active ? INK_2 : FAINT, fontWeight: active ? 600 : 400 }}>{children}</Typography>
  </Stack>
);

/** คำอธิบายเต็มของสิทธิ์ (ไอคอน i ของตารางเทียบ) */
const CapTip = ({ it }) => (
  <Box sx={{ p: 0.25, maxWidth: 320 }}>
    <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, mb: 0.5 }}>{it.title}</Typography>
    <Typography sx={{ fontSize: "0.74rem", lineHeight: 1.5 }}><b>เปิด:</b> {it.on}</Typography>
    <Typography sx={{ fontSize: "0.74rem", lineHeight: 1.5, mt: 0.25 }}><b>ปิด:</b> {it.off}</Typography>
    {it.needs && <Typography sx={{ fontSize: "0.7rem", lineHeight: 1.5, mt: 0.5, opacity: 0.85 }}>ต้องมีสิทธิ์ “{CAP_TITLE[it.needs]}” ด้วย — เปิดข้อนี้แล้วระบบเปิดให้เอง</Typography>}
  </Box>
);

/** สิทธิ์ 1 แถว (มุมมองทีละตำแหน่ง) — กดตรงไหนของแถวก็สลับได้ (ทั้งแถวเป็น <label> ของสวิตช์) */
const CapRow = ({ it, checked, locked, busy, na, pending, wasOn, offDefault, onToggle, first }) => {
  const interactive = !na && !locked && !busy;
  return (
    <Box component={interactive ? "label" : "div"} sx={{
      position: "relative", display: "flex", alignItems: "flex-start", gap: 1.5,
      pr: { xs: 1.25, sm: 2 }, py: 1.4, pl: it.needs ? { xs: 3, sm: 4.5 } : { xs: 1.75, sm: 2.25 },
      borderTop: first ? 0 : `1px solid ${BORDER}`, cursor: interactive ? "pointer" : "default",
      bgcolor: pending ? AMBER_BG : "transparent", transition: "background-color .12s",
      ...(interactive && !pending && { "&:hover": { bgcolor: SOFT } }),
      "&::before": pending ? { content: '""', position: "absolute", left: 0, top: 0, bottom: 0, width: 3, bgcolor: "#f59e0b" } : undefined,
    }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap", rowGap: 0.25 }}>
          <Typography component="span" sx={{ fontSize: "0.9rem", fontWeight: 800, lineHeight: 1.4, color: na ? FAINT : INK }}>
            {it.needs && <Box component="span" sx={{ color: FAINT, mr: 0.5 }}>↳</Box>}{it.title}
          </Typography>
          {pending && <Tag tone="amber">ยังไม่บันทึก · เดิม{wasOn ? "เปิด" : "ปิด"}</Tag>}
          {!pending && offDefault && <Tag tone="muted">ต่างจากค่าเริ่มต้น</Tag>}
        </Stack>
        {na ? (
          <Typography component="span" sx={{ display: "block", fontSize: "0.74rem", color: SUB, mt: 0.4, lineHeight: 1.5 }}>{na}</Typography>
        ) : (
          <>
            <EffectLine kind="on" active={checked}>{it.on}</EffectLine>
            <EffectLine kind="off" active={!checked}>{it.off}</EffectLine>
            {it.needs && (
              <Typography component="span" sx={{ display: "block", fontSize: "0.7rem", color: FAINT, mt: 0.5, lineHeight: 1.5 }}>
                ต้องมีสิทธิ์ “{CAP_TITLE[it.needs]}” ด้วย — เปิดข้อนี้แล้วระบบเปิดให้เอง
              </Typography>
            )}
          </>
        )}
      </Box>
      <Stack alignItems="center" sx={{ flexShrink: 0, mt: -0.5, minWidth: 58 }}>
        {na ? <Box sx={{ mt: 0.75 }}><Tag tone="muted">ไม่มีผล</Tag></Box> : (
          <>
            <Switch checked={checked} disabled={locked || busy} onChange={(e) => onToggle(e.target.checked)}
              inputProps={{ "aria-label": it.title }} sx={SWITCH_SX} />
            <Typography component="span" sx={{ fontSize: "0.68rem", fontWeight: 800, mt: -0.5, color: checked ? BLUE : FAINT }}>{checked ? "เปิด" : "ปิด"}</Typography>
          </>
        )}
      </Stack>
    </Box>
  );
};

/** หัวข้อกลุ่มสิทธิ์ที่กดย่อ/ขยายได้ */
const GroupHeader = ({ group, open, onToggle, right, dense = false }) => (
  <ButtonBase onClick={onToggle} aria-expanded={open} sx={{
    width: "100%", justifyContent: "flex-start", textAlign: "left", fontFamily: "inherit", gap: 1,
    px: { xs: 1.5, sm: 2 }, py: dense ? 0.8 : 1.1, bgcolor: dense ? "transparent" : SOFT,
    borderBottom: dense || !open ? "1px solid transparent" : `1px solid ${BORDER}`,
    "&:hover": { bgcolor: dense ? "transparent" : "#f1f5f9", "& .gh-title": { color: BLUE } },
  }}>
    <ExpandMoreRounded sx={{ fontSize: 20, color: SUB, flexShrink: 0, transition: "transform .2s", transform: open ? "rotate(0deg)" : "rotate(-90deg)" }} />
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography className="gh-title" sx={{ fontWeight: 900, fontSize: "0.86rem", color: INK }}>{group.title}</Typography>
      {group.note && <Typography sx={{ fontSize: "0.72rem", color: SUB }}>{group.note}</Typography>}
    </Box>
    {right}
  </ButtonBase>
);

/** กล่องยืนยันด้วยรหัสผ่าน — การเปลี่ยน Role คือการให้/ถอดอำนาจ ต้องยืนยันตัวตนซ้ำเสมอ */
const ConfirmRoleDialog = ({ change, busy, error, onCancel, onConfirm }) => {
  const [password, setPassword] = useState("");
  useEffect(() => { if (change) setPassword(""); }, [change]);
  if (!change) return null;
  const { user, from, to } = change;
  const d = ROLE_DETAIL[to] || ROLE_DETAIL.member;
  return (
    <Dialog open fullWidth maxWidth="xs" onClose={() => !busy && onCancel()} PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 800, pb: 0.5 }}>เปลี่ยน Role ของ {fullName(user)}</DialogTitle>
      <DialogContent>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ my: 1 }}>
          <Tag tone="muted">{SYSTEM_ROLE_LABEL[from]}</Tag>
          <ArrowForwardRounded sx={{ fontSize: 16, color: FAINT }} />
          <Tag>{SYSTEM_ROLE_LABEL[to]} · {d.th}</Tag>
        </Stack>
        <Box sx={{ mb: 2, p: 1.25, borderRadius: 2, bgcolor: SOFT, border: `1px solid ${BORDER}` }}>
          <Typography sx={{ fontSize: "0.74rem", fontWeight: 800, color: SUB, mb: 0.5 }}>{SYSTEM_ROLE_LABEL[to]} ทำได้</Typography>
          {d.can.map((x) => (
            <Stack key={x} direction="row" spacing={0.75} alignItems="flex-start">
              <CheckCircle sx={{ fontSize: 14, color: "#16a34a", mt: 0.25 }} />
              <Typography sx={{ fontSize: "0.78rem", color: INK_2, lineHeight: 1.5 }}>{x}</Typography>
            </Stack>
          ))}
          <Typography sx={{ fontSize: "0.72rem", color: SUB, mt: 0.5 }}>ตำแหน่งในองค์กร (Rank) และสิทธิ์ทำงานไม่เปลี่ยน</Typography>
        </Box>
        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
        <TextField
          autoFocus fullWidth size="small" type="password" label="รหัสผ่านของคุณ"
          value={password} onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && password && !busy) onConfirm(password); }}
          helperText="ยืนยันว่าเป็นคุณจริง ก่อนเปลี่ยน Role ของคนนี้"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} disabled={busy} sx={{ textTransform: "none", color: SUB }}>ยกเลิก</Button>
        <Button
          variant="contained" disableElevation disabled={busy || !password} onClick={() => onConfirm(password)}
          startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <Save sx={{ fontSize: 17 }} />}
          sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, bgcolor: BLUE, "&:hover": { bgcolor: BLUE_DARK } }}
        >
          ยืนยันเปลี่ยน Role
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/* ───────────────────────── หน้า ───────────────────────── */

export default function RolePermissions() {
  const { can, role: myRole } = usePermissions();
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("org");
  const [orgView, setOrgView] = useState(() => (readLS(VIEW_KEY, "rank") === "matrix" ? "matrix" : "rank"));
  const [openGroups, setOpenGroups] = useState(() => { const v = readLS(OPEN_KEY, null); return Array.isArray(v) ? v : [PERMISSION_GROUPS[0].key]; });
  const [selRank, setSelRank] = useState("");
  const [data, setData] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  /** ✅ ร่างการแก้ไข { rank: { cap: true|false } } — ยังไม่ส่ง server จนกว่าจะกด "บันทึก" */
  const [draft, setDraft] = useState({});
  const [reviewOpen, setReviewOpen] = useState(false);
  const [leaveTo, setLeaveTo] = useState(null);        // ลิงก์ที่กดไว้ตอนยังไม่บันทึก (รอถามก่อนออก)
  const [rename, setRename] = useState(null);         // { rank, label }
  const [roleChange, setRoleChange] = useState(null); // { user, from, to }
  const [confirmError, setConfirmError] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  // ✅ (5 ต.ค. 2569) มือถือ: ตาราง 7 คอลัมน์บีบไม่ลง → ใช้มุมมองทีละตำแหน่งเสมอ (เลือกตำแหน่งจากแถบเลื่อน)
  const isMobile = useMediaQuery("(max-width:900px)");

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [matrix, all] = await Promise.all([
        PermissionService.matrix(),
        AuthService.getAllUserData().catch(() => ({ allUser: [] })),
      ]);
      setData(matrix);
      setUsers(all?.allUser || []);
    } catch (err) {
      setError(err?.response?.data?.message || "โหลดตารางสิทธิ์ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  // ⚠️ ข้อมูลใหม่จากเครื่องอื่นมาแทนค่า "ที่บันทึกแล้ว" เท่านั้น — ร่างที่กำลังแก้อยู่ไม่หาย (เก็บแยกใน draft)
  useRealtime(["settings", "users"], () => { load({ silent: true }); });

  const ranks = useMemo(() => data?.ranks || [], [data]);
  const caps = useMemo(() => data?.capabilities || [], [data]);
  /** กลุ่มสิทธิ์ที่จะแสดง — เฉพาะที่ server ให้ปรับได้ · สิทธิ์ใหม่ที่ยังไม่มีคำอธิบายไปอยู่กลุ่ม "อื่นๆ" (ไม่หายเงียบ) */
  const groups = useMemo(() => {
    const known = new Set();
    const list = PERMISSION_GROUPS.map((g) => ({ ...g, items: g.items.filter((it) => { known.add(it.cap); return caps.includes(it.cap); }) }))
      .filter((g) => g.items.length);
    const extra = caps.filter((c) => !known.has(c));
    if (extra.length) list.push({ key: "other", title: "อื่นๆ", items: extra.map((c) => ({ cap: c, title: c, on: "ทำได้", off: "ทำไม่ได้" })) });
    return list;
  }, [caps]);

  /** รายการที่แก้แล้วยังไม่บันทึก (เทียบกับค่าที่บันทึกล่าสุดเสมอ — แก้กลับเป็นค่าเดิม = ไม่นับ) */
  const pendingList = useMemo(() => Object.entries(draft).flatMap(([rank, m]) => Object.entries(m)
    .filter(([cap, v]) => Boolean(data?.effective?.[cap]?.includes(rank)) !== v)
    .map(([cap, v]) => ({ rank, cap, next: v }))), [draft, data]);
  const dirty = pendingList.length > 0;

  /**
   * 🔒 ออกจากหน้าทั้งที่ยังไม่บันทึก = ถามก่อน
   *   • ปิด/รีเฟรชแท็บ → beforeunload ของเบราว์เซอร์
   *   • กดเมนู/ลิงก์ในแอป → ดักคลิก <a> ตั้งแต่ชั้น document (ก่อน <Link> ของ React ทำงาน) แล้วถามด้วยกล่องของเรา
   * ⚠️ แอปใช้ <BrowserRouter> + useRoutes (ไม่ใช่ data router) จึงใช้ useBlocker ของ react-router ไม่ได้
   */
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ""; };
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target?.closest?.("a[href]");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaveTo(url.pathname + url.search + url.hash);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  // 🔒 หน้านี้เป็นการตั้งค่าระดับระบบ — เฉพาะ Super Admin (server กันซ้ำอีกชั้น)
  if (!can("manageSystem")) return <Navigate to="/about" replace />;
  if (loading) return <PageLoader label="กำลังโหลดสิทธิ์…" />;

  /* ── ค่าที่บันทึกแล้ว / ค่าในร่าง / ค่าเริ่มต้น ── */
  const savedOn = (rank, cap) => Boolean(data?.effective?.[cap]?.includes(rank));
  const valueOf = (rank, cap) => (draft[rank] && cap in draft[rank] ? draft[rank][cap] : savedOn(rank, cap));
  const isPending = (rank, cap) => valueOf(rank, cap) !== savedOn(rank, cap);
  const isDefault = (rank, cap) => Boolean(data?.defaults?.[cap]?.includes(rank));
  const applicable = (rank) => caps.filter((c) => !capNotApplicable(rank, c));
  const onCount = (rank) => applicable(rank).filter((c) => valueOf(rank, c)).length;
  const offDefaultOf = (rank) => applicable(rank).filter((c) => valueOf(rank, c) !== isDefault(rank, c));
  const pendingOf = (rank) => pendingList.filter((p) => p.rank === rank);
  const peopleOf = (rank) => users.filter((u) => normalizeRole(u) === rank);
  const rankName = (rank) => ranks.find((r) => r.rank === rank)?.label || rankLabel(rank);
  const isOpen = (key) => openGroups.includes(key);
  const setOpen = (keys) => { setOpenGroups(keys); writeLS(OPEN_KEY, keys); };
  const toggleGroup = (key) => setOpen(isOpen(key) ? openGroups.filter((k) => k !== key) : [...openGroups, key]);
  const allOpen = groups.every((g) => isOpen(g.key));

  /**
   * แก้ในร่าง — ใช้กติกาเดียวกับ server (CAP_REQUIRES): เปิด "แก้ไข" = เปิด "ดู" ให้ด้วย · ปิด "ดู" = ปิด "แก้ไข" ด้วย
   * ร่างจึงตรงกับผลที่จะได้หลังบันทึกเป๊ะ ไม่มีเซอร์ไพรส์ตอนกดบันทึก
   */
  const setCap = (rank, cap, next) => {
    const changes = { [cap]: next };
    const linked = [];
    if (next && CAP_NEEDS[cap] && !valueOf(rank, CAP_NEEDS[cap])) { changes[CAP_NEEDS[cap]] = true; linked.push(CAP_NEEDS[cap]); }
    if (!next) Object.entries(CAP_NEEDS).forEach(([dep, need]) => { if (need === cap && valueOf(rank, dep)) { changes[dep] = false; linked.push(dep); } });
    setDraft((d) => {
      const r = { ...(d[rank] || {}) };
      Object.entries(changes).forEach(([c, v]) => { if (savedOn(rank, c) === v) delete r[c]; else r[c] = v; });
      const n = { ...d, [rank]: r };
      if (!Object.keys(r).length) delete n[rank];
      return n;
    });
    if (linked.length) setToast(`${next ? "เปิด" : "ปิด"} ${linked.map((c) => `“${CAP_TITLE[c] || c}”`).join(" · ")} ให้ด้วย เพราะต้องใช้คู่กัน (ยังไม่บันทึก)`);
  };

  /** คืนค่าเริ่มต้นของตำแหน่ง — ลงร่างเหมือนการติ๊กเอง (ยังต้องกดบันทึก) */
  const resetRankDraft = (rank) => {
    setDraft((d) => {
      const r = {};
      caps.forEach((c) => { if (savedOn(rank, c) !== isDefault(rank, c)) r[c] = isDefault(rank, c); });
      const n = { ...d };
      if (Object.keys(r).length) n[rank] = r; else delete n[rank];
      return n;
    });
    setToast(`ตั้ง ${rankName(rank)} กลับเป็นค่าเริ่มต้นในร่างแล้ว — ตรวจดูแล้วกด “บันทึก”`);
  };

  /**
   * บันทึกทุกรายการในร่าง — ส่งทีละสิทธิ์ (endpoint เดิม · server ลบส่วนต่างทิ้งเมื่อเท่าค่าเริ่มต้น)
   * ⚠️ อ่านค่าล่าสุดจากคำตอบทุกครั้ง: server เปิด/ปิดช่องคู่กันให้เอง บางรายการจึงตรงแล้วไม่ต้องส่งซ้ำ
   * ⚠️ พังกลางทาง = เก็บส่วนที่บันทึกได้แล้ว · ร่างที่เหลือยังอยู่ให้กดบันทึกซ้ำได้
   */
  const saveAll = async () => {
    const list = pendingList;
    if (!list.length) return;
    setSaving("all"); setError("");
    let eff = data.effective;
    let done = 0;
    try {
      for (const { rank, cap, next } of list) {
        if (Boolean(eff?.[cap]?.includes(rank)) !== next) {
          const res = await PermissionService.setOne({ rank, capability: cap, allowed: next });
          if (res?.effective) eff = res.effective;
        }
        done += 1;
      }
      setData((cur) => ({ ...cur, effective: eff }));
      setDraft({});
      setReviewOpen(false);
      setToast(`บันทึกแล้ว ${list.length} รายการ — มีผลกับทุกคนในตำแหน่งนั้นภายในไม่กี่วินาที`);
    } catch (err) {
      setData((cur) => ({ ...cur, effective: eff }));
      setReviewOpen(false);
      setError(`บันทึกได้ ${done} จาก ${list.length} รายการ — ${err?.response?.data?.message || "ลองกดบันทึกอีกครั้ง"}`);
    } finally {
      setSaving("");
    }
  };

  const saveRename = async () => {
    const { rank, label } = rename;
    setSaving(`name:${rank}`); setError("");
    try {
      await PermissionService.renameRanks({ [rank]: label.trim() });
      await OrgSettingService.load({ force: true }); // ชื่อใหม่มีผลกับทุกหน้าจอทันที
      setRename(null);
      await load({ silent: true });
      setToast("เปลี่ยนชื่อตำแหน่งแล้ว");
    } catch (err) {
      setError(err?.response?.data?.message || "เปลี่ยนชื่อไม่สำเร็จ");
    } finally {
      setSaving("");
    }
  };

  const applyRole = async (password) => {
    const { user, to } = roleChange;
    setSaving(`tier:${user._id}`); setConfirmError("");
    try {
      await AuthService.UpdateUser(user._id, { systemRole: to, confirmPassword: password });
      setRoleChange(null);
      await load({ silent: true });
      setToast(`ตั้ง ${user.fname || user.username} เป็น ${SYSTEM_ROLE_LABEL[to]} แล้ว`);
    } catch (err) {
      setConfirmError(err?.response?.data?.message || "เปลี่ยน Role ไม่สำเร็จ");
    } finally {
      setSaving("");
    }
  };

  const openRank = (rank) => { setSelRank(rank); setOrgView("rank"); writeLS(VIEW_KEY, "rank"); setTab("org"); };
  const view = isMobile ? "rank" : orgView;
  const cur = ranks.find((r) => r.rank === selRank) || ranks[0];
  const busyAll = saving === "all";

  /* ───────────── แท็บ Rank: มุมมองทีละตำแหน่ง ───────────── */
  const renderRankItem = (r, compact) => {
    const on = r.rank === cur?.rank;
    const n = onCount(r.rank);
    const pend = pendingOf(r.rank).length;
    return (
      <ButtonBase key={r.rank} onClick={() => setSelRank(r.rank)} aria-pressed={on} sx={{
        display: "flex", flexDirection: "column", alignItems: "stretch", textAlign: "left", fontFamily: "inherit",
        flexShrink: 0, width: compact ? "auto" : "100%", minWidth: compact ? 150 : 0, px: 1.4, py: compact ? 0.8 : 1.1, borderRadius: 2.5,
        border: "1px solid", borderColor: on ? BLUE : compact ? BORDER : "transparent", bgcolor: on ? alpha(BLUE, 0.06) : compact ? "#fff" : "transparent",
        transition: "background-color .12s", "&:hover": { bgcolor: on ? alpha(BLUE, 0.08) : SOFT },
      }}>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.86rem", fontWeight: 800, color: on ? BLUE : INK }}>{r.label}</Typography>
          {r.locked && <Lock sx={{ fontSize: 13, color: FAINT }} />}
          {pend > 0 && <Tag tone="amber">{pend}</Tag>}
        </Stack>
        <Typography sx={{ fontSize: "0.7rem", color: SUB, mt: 0.15, mb: compact ? 0 : 0.6 }}>{peopleOf(r.rank).length} คน · เปิด {n}/{applicable(r.rank).length}</Typography>
        {!compact && <Bar value={n} total={applicable(r.rank).length} />}
      </ButtonBase>
    );
  };

  const renderRankPanel = () => {
    if (!cur) return null;
    const people = peopleOf(cur.rank);
    const n = onCount(cur.rank);
    const total = applicable(cur.rank).length;
    const offDefault = offDefaultOf(cur.rank);
    const pend = pendingOf(cur.rank).length;
    const lockedOff = cur.locked ? groups.flatMap((g) => g.items).filter((it) => !capNotApplicable(cur.rank, it.cap) && !savedOn(cur.rank, it.cap)) : [];
    return (
      <Box sx={{ minWidth: 0 }}>
        {/* หัวตำแหน่งที่กำลังตั้ง */}
        <Box sx={{ mb: 1.5, p: { xs: 1.5, sm: 2 }, bgcolor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 3 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: SUB }}>กำลังตั้งสิทธิ์ของตำแหน่ง</Typography>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontWeight: 900, fontSize: "1.15rem", color: INK, minWidth: 0 }}>{cur.label}</Typography>
                {cur.locked && <Tag tone="muted" icon={<Lock sx={{ fontSize: 12 }} />}>ล็อกไว้</Tag>}
                <Tooltip title="เปลี่ยนชื่อตำแหน่ง">
                  <IconButton size="small" onClick={() => setRename({ rank: cur.rank, label: cur.label })} aria-label="เปลี่ยนชื่อตำแหน่ง">
                    <Edit sx={{ fontSize: 17, color: SUB }} />
                  </IconButton>
                </Tooltip>
              </Stack>
              <Typography sx={{ fontSize: "0.78rem", color: SUB }}>
                {people.length} คนในตำแหน่งนี้ · เปิดอยู่ {n} จาก {total} สิทธิ์
                {offDefault.length > 0 && ` · ต่างจากค่าเริ่มต้น ${offDefault.length} ข้อ`}
              </Typography>
              <Box sx={{ mt: 0.75, maxWidth: 380 }}><Bar value={n} total={total} /></Box>
            </Box>
            <Stack direction="row" spacing={1.25} alignItems="center" justifyContent={{ xs: "space-between", sm: "flex-end" }}>
              {people.length ? (
                <AvatarGroup max={5} sx={{ "& .MuiAvatar-root": { width: 30, height: 30, fontSize: 13, fontWeight: 800, borderColor: "#fff" } }}>
                  {people.map((u) => (
                    <Tooltip key={u._id} title={fullName(u)}><Avatar src={avatarSrc(u)}>{(u.fname || u.username || "?").charAt(0)}</Avatar></Tooltip>
                  ))}
                </AvatarGroup>
              ) : (
                <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>ยังไม่มีใครในตำแหน่งนี้</Typography>
              )}
              {!cur.locked && (
                <Tooltip title="ตั้งทุกข้อของตำแหน่งนี้กลับเป็นค่าตั้งต้นของระบบ (ลงในร่าง ยังต้องกดบันทึก)">
                  <span>
                    <Button size="small" variant="outlined" disabled={!offDefault.length || busyAll} onClick={() => resetRankDraft(cur.rank)}
                      startIcon={<RestartAltRounded sx={{ fontSize: 17 }} />}
                      sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, flexShrink: 0, color: BLUE, borderColor: alpha(BLUE, 0.4) }}>
                      คืนค่าเริ่มต้น
                    </Button>
                  </span>
                </Tooltip>
              )}
            </Stack>
          </Stack>
          {cur.locked && (
            <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ mt: 1.25, p: 1.1, borderRadius: 2, bgcolor: SOFT, border: `1px solid ${BORDER}` }}>
              <Lock sx={{ fontSize: 15, color: SUB, mt: 0.2 }} />
              <Typography sx={{ fontSize: "0.76rem", color: INK_2, lineHeight: 1.55 }}>
                ตำแหน่งนี้ล็อกไว้ที่เซิร์ฟเวอร์ แก้สิทธิ์ไม่ได้ — ค่าที่เห็นคือที่ใช้งานจริง
                {lockedOff.length > 0 && <> · ไม่มี: {lockedOff.map((it) => `“${it.title}”`).join(" · ")}</>}
              </Typography>
            </Stack>
          )}
        </Box>

        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75, px: 0.25 }}>
          <Typography sx={{ fontSize: "0.76rem", fontWeight: 800, color: SUB }}>
            สิทธิ์ทั้งหมด {groups.length} หัวข้อ{pend > 0 && <Box component="span" sx={{ color: AMBER }}> · แก้ไขแล้ว {pend} ข้อ (ยังไม่บันทึก)</Box>}
          </Typography>
          <Button size="small" onClick={() => setOpen(allOpen ? [] : groups.map((g) => g.key))}
            startIcon={allOpen ? <UnfoldLessRounded sx={{ fontSize: 17 }} /> : <UnfoldMoreRounded sx={{ fontSize: 17 }} />}
            sx={{ textTransform: "none", fontWeight: 700, color: BLUE }}>
            {allOpen ? "ย่อทุกหัวข้อ" : "ขยายทุกหัวข้อ"}
          </Button>
        </Stack>

        {groups.map((group) => {
          const items = group.items;
          const usable = items.filter((it) => !capNotApplicable(cur.rank, it.cap));
          const gOn = usable.filter((it) => valueOf(cur.rank, it.cap)).length;
          const gPend = items.filter((it) => isPending(cur.rank, it.cap)).length;
          const open = isOpen(group.key);
          return (
            <Box key={group.key} sx={{ mb: 1.25, bgcolor: "#fff", border: `1px solid ${gPend ? AMBER_LINE : BORDER}`, borderRadius: 3, overflow: "hidden" }}>
              <GroupHeader group={group} open={open} onToggle={() => toggleGroup(group.key)} right={(
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexShrink: 0 }}>
                  {gPend > 0 && <Tag tone="amber">ยังไม่บันทึก {gPend}</Tag>}
                  <Typography sx={{ fontSize: "0.74rem", fontWeight: 800, color: gOn ? BLUE : FAINT }}>เปิด {gOn}/{usable.length}</Typography>
                </Stack>
              )} />
              <Collapse in={open} timeout={180} unmountOnExit>
                {items.map((it, i) => (
                  <CapRow key={it.cap} it={it} first={i === 0}
                    checked={valueOf(cur.rank, it.cap)} locked={cur.locked} busy={busyAll}
                    na={capNotApplicable(cur.rank, it.cap)} pending={isPending(cur.rank, it.cap)} wasOn={savedOn(cur.rank, it.cap)}
                    offDefault={!cur.locked && valueOf(cur.rank, it.cap) !== isDefault(cur.rank, it.cap)}
                    onToggle={(next) => setCap(cur.rank, it.cap, next)} />
                ))}
              </Collapse>
            </Box>
          );
        })}
      </Box>
    );
  };

  /* ───────────── แท็บ Rank: ตารางเทียบทุกตำแหน่ง ───────────── */
  const renderMatrix = () => (
    <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 3, overflow: "hidden" }}>
      {/* ✅ กล่องเลื่อนของตัวเอง = หัวตาราง (ชื่อตำแหน่ง) ค้างอยู่ด้านบนตอนเลื่อนลง · คอลัมน์ชื่อสิทธิ์ค้างด้านซ้าย */}
      <Box sx={{ overflow: "auto", maxHeight: "calc(100vh - 300px)", minHeight: 320 }}>
        <Box component="table" sx={{ borderCollapse: "separate", borderSpacing: 0, width: "100%", minWidth: 820 }}>
          <Box component="thead">
            <Box component="tr">
              <Box component="th" sx={{ position: "sticky", top: 0, left: 0, zIndex: 4, bgcolor: SOFT, textAlign: "left", px: 2, py: 1.25, borderBottom: `1px solid ${BORDER}`, boxShadow: `inset -1px 0 0 ${BORDER}`, minWidth: 300, width: 340 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: "0.84rem", fontWeight: 900, color: INK }}>สิ่งที่ตำแหน่งนั้นทำได้</Typography>
                    <Typography sx={{ fontSize: "0.7rem", color: SUB, fontWeight: 500 }}>ติ๊ก = ทำได้ · กดชื่อตำแหน่งเพื่อดูคำอธิบายเต็ม</Typography>
                  </Box>
                  <Tooltip title={allOpen ? "ย่อทุกหัวข้อ" : "ขยายทุกหัวข้อ"}>
                    <IconButton size="small" onClick={() => setOpen(allOpen ? [] : groups.map((g) => g.key))}>
                      {allOpen ? <UnfoldLessRounded sx={{ fontSize: 18 }} /> : <UnfoldMoreRounded sx={{ fontSize: 18 }} />}
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Box>
              {ranks.map((r) => {
                const n = onCount(r.rank);
                const pend = pendingOf(r.rank).length;
                return (
                  <Box component="th" key={r.rank} sx={{ position: "sticky", top: 0, zIndex: 3, bgcolor: SOFT, p: 0.5, borderBottom: `1px solid ${BORDER}`, minWidth: 108, verticalAlign: "top" }}>
                    <ButtonBase onClick={() => openRank(r.rank)} sx={{ width: "100%", flexDirection: "column", px: 0.75, py: 0.75, borderRadius: 2, fontFamily: "inherit", "&:hover": { bgcolor: alpha(BLUE, 0.06) } }}>
                      <Stack direction="row" alignItems="center" spacing={0.4}>
                        <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, lineHeight: 1.25, color: INK }}>{r.label}</Typography>
                        {r.locked && <Lock sx={{ fontSize: 12, color: FAINT }} />}
                      </Stack>
                      <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, color: pend ? AMBER : SUB, mt: 0.25 }}>
                        {pend ? `แก้ ${pend} ข้อ · ยังไม่บันทึก` : `${peopleOf(r.rank).length} คน · ${n}/${applicable(r.rank).length}`}
                      </Typography>
                      <Box sx={{ width: "70%", mt: 0.5 }}><Bar value={n} total={applicable(r.rank).length} /></Box>
                    </ButtonBase>
                  </Box>
                );
              })}
            </Box>
          </Box>
          <Box component="tbody">
            {groups.map((group) => {
              const open = isOpen(group.key);
              return [
                <Box component="tr" key={group.key}>
                  <Box component="td" colSpan={ranks.length + 1} sx={{ p: 0, bgcolor: SOFT, borderBottom: `1px solid ${BORDER}` }}>
                    <Box sx={{ position: "sticky", left: 0, width: "fit-content", maxWidth: "100%" }}>
                      <GroupHeader dense group={{ title: group.title }} open={open} onToggle={() => toggleGroup(group.key)} />
                    </Box>
                  </Box>
                </Box>,
                ...(open ? group.items.map((it) => (
                  <Box component="tr" key={it.cap} sx={{ "&:hover > td": { bgcolor: SOFT } }}>
                    <Box component="td" sx={{ position: "sticky", left: 0, zIndex: 1, bgcolor: "#fff", py: 0.9, pr: 1, pl: it.needs ? 4 : 2.5, borderBottom: `1px solid ${BORDER}`, boxShadow: `inset -1px 0 0 ${BORDER}` }}>
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.82rem", fontWeight: 700, color: INK, lineHeight: 1.4 }}>
                          {it.needs && <Box component="span" sx={{ color: FAINT, mr: 0.5 }}>↳</Box>}{it.title}
                        </Typography>
                        <Tooltip title={<CapTip it={it} />} placement="right" arrow>
                          <InfoOutlined sx={{ fontSize: 16, color: FAINT, flexShrink: 0, cursor: "help" }} />
                        </Tooltip>
                      </Stack>
                    </Box>
                    {ranks.map((r) => {
                      const na = capNotApplicable(r.rank, it.cap);
                      const on = valueOf(r.rank, it.cap);
                      const pending = !na && isPending(r.rank, it.cap);
                      const tip = na || (r.locked ? `${r.label} ล็อกไว้ — ค่าที่ใช้งานจริง` : pending ? `ยังไม่บันทึก (เดิม${savedOn(r.rank, it.cap) ? "เปิด" : "ปิด"})` : "");
                      return (
                        <Box component="td" key={r.rank} sx={{ textAlign: "center", borderBottom: `1px solid ${BORDER}`, py: 0.25, ...(pending && { bgcolor: `${AMBER_BG} !important`, boxShadow: `inset 0 0 0 1px ${AMBER_LINE}` }) }}>
                          <Tooltip title={tip} describeChild>
                            <span>
                              {na ? (
                                <Typography component="span" sx={{ display: "inline-block", width: 38, color: "#cbd5e1", fontWeight: 800 }}>—</Typography>
                              ) : (
                                <Checkbox checked={on} disabled={r.locked || busyAll} onChange={(e) => setCap(r.rank, it.cap, e.target.checked)}
                                  inputProps={{ "aria-label": `${it.title} · ${r.label}` }}
                                  sx={{ p: 1, "&.Mui-checked": { color: pending ? "#d97706" : BLUE }, "&.Mui-disabled.Mui-checked": { color: alpha(BLUE, 0.35) } }} />
                              )}
                            </span>
                          </Tooltip>
                        </Box>
                      );
                    })}
                  </Box>
                )) : []),
              ];
            })}
          </Box>
        </Box>
      </Box>
    </Box>
  );

  /* ───────────── แถบบันทึก (ติดขอบล่างจอ) ───────────── */
  const pendingRanks = [...new Set(pendingList.map((p) => p.rank))];
  // มือถือ: ซ่อนแถบตอนไม่มีอะไรต้องบันทึก (จอเล็ก ไม่กินที่) · จอใหญ่: แสดงตลอดให้รู้ว่าต้องกดบันทึกเสมอ
  const renderSaveBar = () => (!dirty && isMobile ? null : (
    <Box sx={{ position: "sticky", bottom: "calc(var(--app-bottom-nav-h, 0px) + 12px)", zIndex: 6, mt: 2 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 1, sm: 1.5 }} alignItems={{ sm: "center" }} sx={{
        p: 1.25, pl: 2, borderRadius: 3, bgcolor: "#fff", border: `1px solid ${dirty ? AMBER_LINE : BORDER}`,
        boxShadow: dirty ? "0 10px 30px rgba(15,23,42,.14)" : "0 2px 8px rgba(15,23,42,.06)",
      }}>
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
          {dirty
            ? <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#f59e0b", flexShrink: 0, boxShadow: `0 0 0 4px ${AMBER_BG}` }} />
            : <CheckCircle sx={{ fontSize: 20, color: "#16a34a" }} />}
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: "0.9rem", color: dirty ? AMBER : INK }}>
              {dirty ? `แก้ไขแล้ว ${pendingList.length} ข้อ ใน ${pendingRanks.length} ตำแหน่ง — ยังไม่บันทึก` : "บันทึกครบแล้ว"}
            </Typography>
            <Typography sx={{ fontSize: "0.74rem", color: SUB }}>
              {dirty ? "ยังไม่มีผลกับผู้ใช้ จนกว่าจะกด “ตรวจสอบและบันทึก”" : "ติ๊ก/เลื่อนสวิตช์เพื่อแก้ — ทุกการแก้ไขต้องกดบันทึกก่อนจึงมีผล"}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button onClick={() => setDraft({})} disabled={!dirty || busyAll} sx={{ textTransform: "none", fontWeight: 700, color: SUB }}>ยกเลิกการแก้ไข</Button>
          <Button variant="contained" disableElevation disabled={!dirty || busyAll} onClick={() => setReviewOpen(true)}
            startIcon={busyAll ? <CircularProgress size={15} color="inherit" /> : <Save sx={{ fontSize: 18 }} />}
            sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, px: 2.25, bgcolor: BLUE, "&:hover": { bgcolor: BLUE_DARK } }}>
            ตรวจสอบและบันทึก
          </Button>
        </Stack>
      </Stack>
    </Box>
  ));

  /* ───────────── แท็บ Role ───────────── */
  const q = userQuery.trim().toLowerCase();
  const roleCount = (r) => users.filter((u) => systemRoleOf(u) === r).length;
  const shownUsers = users
    .filter((u) => roleFilter === "all" || systemRoleOf(u) === roleFilter)
    .filter((u) => !q || [u.fname, u.lname, u.username, u.email, rankLabel(u)].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
    .sort((x, y) => ROLE_ORDER.indexOf(systemRoleOf(x)) - ROLE_ORDER.indexOf(systemRoleOf(y))
      || String(x.fname || x.username).localeCompare(String(y.fname || y.username), "th"));
  const roleOptions = (data?.roles || []).map((t) => ({ value: t.systemRole, label: t.label, dot: (ROLE_DETAIL[t.systemRole] || ROLE_DETAIL.member).tone }));

  const renderRoleTab = () => (
    <>
      <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1.5, px: 1.75, py: 1.1, borderRadius: 3, bgcolor: "#eff6ff", border: `1px solid ${alpha(BLUE, 0.15)}` }}>
        <InfoOutlined sx={{ fontSize: 18, color: BLUE, mt: 0.1 }} />
        <Typography sx={{ fontSize: "0.8rem", color: INK_2, lineHeight: 1.55 }}>
          Role คือสิทธิ์ <b>ดูแลระบบ</b> (จัดการผู้ใช้ · ตั้งค่า) เท่านั้น — <b>ไม่เพิ่มสิทธิ์ทำงาน</b> · งานที่ทำได้มาจากตำแหน่ง (Rank) ในแท็บ “สิทธิ์ตามตำแหน่ง”
        </Typography>
      </Stack>

      {/* ── 3 Role: ทำอะไรได้ / ทำอะไรไม่ได้ ── */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" }, gap: 1.25, mb: 2 }}>
        {(data?.roles || []).map((t) => {
          const d = ROLE_DETAIL[t.systemRole] || ROLE_DETAIL.member;
          return (
            <Box key={t.systemRole} sx={{ p: 1.75, borderRadius: 3, bgcolor: "#fff", border: `1px solid ${BORDER}` }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: d.tone, flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 900, fontSize: "1rem", color: INK, lineHeight: 1.25 }}>{t.label}</Typography>
                  <Typography sx={{ fontSize: "0.72rem", color: SUB }}>{d.th}</Typography>
                </Box>
                <Typography sx={{ fontWeight: 900, fontSize: "1.05rem", color: INK }}>{roleCount(t.systemRole)}<Box component="span" sx={{ fontSize: "0.72rem", color: SUB, fontWeight: 700, ml: 0.4 }}>คน</Box></Typography>
              </Stack>
              <Stack spacing={0.4}>
                {d.can.map((x) => (
                  <Stack key={x} direction="row" spacing={0.75} alignItems="flex-start">
                    <CheckCircle sx={{ fontSize: 15, color: "#16a34a", mt: 0.2 }} />
                    <Typography sx={{ fontSize: "0.78rem", color: INK_2, lineHeight: 1.45 }}>{x}</Typography>
                  </Stack>
                ))}
                {d.cannot.map((x) => (
                  <Stack key={x} direction="row" spacing={0.75} alignItems="flex-start">
                    <RemoveCircleOutline sx={{ fontSize: 15, color: FAINT, mt: 0.2 }} />
                    <Typography sx={{ fontSize: "0.78rem", color: SUB, lineHeight: 1.45 }}>ไม่ได้: {x}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          );
        })}
      </Box>

      {/* ── ผู้ใช้แต่ละคน ── */}
      <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 3, overflow: "hidden" }}>
        <Box sx={{ px: 2, py: 1.25, bgcolor: SOFT, borderBottom: `1px solid ${BORDER}` }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 900, fontSize: "0.95rem", color: INK }}>ตั้ง Role ให้ผู้ใช้แต่ละคน ({users.length} คน)</Typography>
              <Typography sx={{ fontSize: "0.74rem", color: SUB }}>กดเลือก Role ในแถวของคนนั้น → ยืนยันด้วยรหัสผ่านของคุณ จึงมีผล · ต้องเหลือ Super Admin อย่างน้อย 1 คน</Typography>
            </Box>
            <TextField size="small" placeholder="ค้นหาชื่อ / ชื่อผู้ใช้ / ตำแหน่ง" value={userQuery} onChange={(e) => setUserQuery(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded sx={{ fontSize: 18, color: FAINT }} /></InputAdornment> }}
              sx={{ width: { xs: "100%", sm: 270 }, "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "#fff" } }} />
          </Stack>
          <Box sx={{ mt: 1.25, overflowX: "auto", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
            <Segmented size="sm" ariaLabel="กรองตาม Role" value={roleFilter} onChange={setRoleFilter}
              options={[{ value: "all", label: "ทั้งหมด", count: users.length }, ...roleOptions.map((o) => ({ ...o, count: roleCount(o.value) }))]} />
          </Box>
        </Box>
        {/* หัวคอลัมน์ (จอใหญ่) */}
        <Box sx={{ display: { xs: "none", md: "grid" }, gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr) 360px", gap: 2, px: 2, py: 0.9, borderBottom: `1px solid ${BORDER}` }}>
          {["ผู้ใช้", "ตำแหน่งในองค์กร (Rank) — กดเพื่อดูสิทธิ์", "Role (สิทธิ์ดูแลระบบ)"].map((h) => (
            <Typography key={h} sx={{ fontSize: "0.72rem", fontWeight: 800, color: SUB }}>{h}</Typography>
          ))}
        </Box>
        {shownUsers.length === 0 && <Typography sx={{ p: 2, fontSize: "0.86rem", color: SUB }}>ไม่พบผู้ใช้</Typography>}
        {shownUsers.map((u) => {
          const tier = systemRoleOf(u);
          const isSelf = String(u._id) === String(userData?.userId || "");
          const rank = normalizeRole(u);
          const rName = ranks.find((r) => r.rank === rank)?.label || rankLabel(u);
          const busy = saving === `tier:${u._id}`;
          return (
            <Box key={u._id} sx={{
              display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", md: "minmax(0, 1.3fr) minmax(0, 1fr) 360px" }, gap: { xs: 1, md: 2 }, alignItems: "center",
              px: 2, py: 1.2, borderTop: `1px solid ${BORDER}`, "&:first-of-type": { borderTop: 0 }, "&:hover": { bgcolor: SOFT },
            }}>
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
                <Avatar src={avatarSrc(u)} sx={{ width: 36, height: 36, fontSize: 15, fontWeight: 800 }}>{(u.fname || u.username || "?").charAt(0)}</Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography noWrap component="div" sx={{ fontWeight: 800, fontSize: "0.9rem", color: INK }}>
                    {fullName(u)}{isSelf && <Box component="span" sx={{ ml: 0.75, px: 0.75, py: 0.1, borderRadius: 99, fontSize: "0.64rem", fontWeight: 800, bgcolor: "#eff6ff", color: BLUE }}>คุณ</Box>}
                  </Typography>
                  <Typography noWrap sx={{ fontSize: "0.74rem", color: SUB }}>
                    @{u.username}<Box component="span" sx={{ display: { md: "none" } }}> · {rName}</Box>
                  </Typography>
                </Box>
              </Stack>
              <Box sx={{ display: { xs: "none", md: "block" }, minWidth: 0 }}>
                {rank ? (
                  <Tooltip title="ดูสิทธิ์ของตำแหน่งนี้">
                    <ButtonBase onClick={() => openRank(rank)} sx={{ maxWidth: "100%", gap: 0.25, px: 0.75, py: 0.25, ml: -0.75, borderRadius: 1.5, fontFamily: "inherit", "&:hover": { bgcolor: alpha(BLUE, 0.06), "& .rk": { color: BLUE } } }}>
                      <Typography noWrap className="rk" sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK_2 }}>{rName}</Typography>
                      <ChevronRightRounded sx={{ fontSize: 16, color: FAINT }} />
                    </ButtonBase>
                  </Tooltip>
                ) : <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>ยังไม่ได้ตั้งตำแหน่ง</Typography>}
                {titleOf(u) && titleOf(u) !== rName && <Typography noWrap sx={{ fontSize: "0.72rem", color: SUB }}>ในเอกสาร: {titleOf(u)}</Typography>}
              </Box>
              <Tooltip title={isSelf ? "เปลี่ยน Role ของตัวเองไม่ได้ (กันล็อกตัวเองออกจากระบบ)" : ""} describeChild>
                <Box sx={{ minWidth: 0 }}>
                  <Segmented size="sm" fullWidth ariaLabel={`Role ของ ${fullName(u)}`} value={tier} disabled={isSelf || busy || Boolean(roleChange)}
                    options={roleOptions}
                    onChange={(to) => { setConfirmError(""); setRoleChange({ user: u, from: tier, to }); }} />
                </Box>
              </Tooltip>
            </Box>
          );
        })}
      </Box>
    </>
  );

  return (
    <Box sx={PAGE_SX}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: "#eff6ff", color: BLUE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <AdminPanelSettings />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900, fontSize: "1.35rem", color: INK, lineHeight: 1.25 }}>ตั้งค่าสิทธิ์</Typography>
          <Typography sx={{ fontSize: "0.82rem", color: SUB }}>
            กำหนดว่าแต่ละ <b>ตำแหน่ง</b> เห็นเมนูอะไร ทำงานอะไรได้ · และใครเป็น <b>ผู้ดูแลระบบ</b> (จัดการผู้ใช้ · ตั้งค่า)
          </Typography>
        </Box>
      </Stack>

      {/* แท็บหลัก + มุมมองของแท็บตำแหน่ง */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} alignItems={{ md: "center" }} justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Segmented ariaLabel="ประเภทสิทธิ์" value={tab} onChange={setTab} fullWidth={isMobile}
          options={[
            { value: "org", label: isMobile ? "ตามตำแหน่ง" : "สิทธิ์ตามตำแหน่ง (Rank)", icon: <AdminPanelSettings sx={{ fontSize: 18 }} />, count: isMobile ? null : ranks.length, alert: pendingList.length },
            { value: "system", label: isMobile ? "ผู้ดูแลระบบ" : "ผู้ดูแลระบบ (Role)", icon: <BadgeIcon sx={{ fontSize: 18 }} />, count: isMobile ? null : users.length },
          ]} />
        {tab === "org" && !isMobile && (
          <Segmented size="sm" ariaLabel="มุมมอง" value={orgView} onChange={(v) => { setOrgView(v); writeLS(VIEW_KEY, v); }}
            options={[
              { value: "rank", label: "ตั้งทีละตำแหน่ง", icon: <ViewListRounded sx={{ fontSize: 17 }} /> },
              { value: "matrix", label: "เทียบทุกตำแหน่ง", icon: <GridOnRounded sx={{ fontSize: 17 }} /> },
            ]} />
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError("")}>{error}</Alert>}

      {tab === "system" ? renderRoleTab() : (
        <>
          <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1.5, px: 1.75, py: 1.1, borderRadius: 3, bgcolor: "#eff6ff", border: `1px solid ${alpha(BLUE, 0.15)}` }}>
            <InfoOutlined sx={{ fontSize: 18, color: BLUE, mt: 0.1 }} />
            <Typography sx={{ fontSize: "0.8rem", color: INK_2, lineHeight: 1.55 }}>
              เลือกตำแหน่ง → เปิด/ปิดสิทธิ์ที่ต้องการ → กด <b>“ตรวจสอบและบันทึก”</b> ด้านล่าง จึงมีผลกับ <b>ทุกคนในตำแหน่งนั้น</b> (เมนูเปลี่ยนเอง ไม่ต้องออกจากระบบ) ·
              สิทธิ์ “แก้ไข” เปิดสิทธิ์ “ดู” ที่ต้องใช้คู่กันให้อัตโนมัติ
            </Typography>
          </Stack>

          {view === "matrix" ? renderMatrix() : isMobile ? (
            <>
              <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: SUB, mb: 0.75, px: 0.25 }}>เลือกตำแหน่ง</Typography>
              <Stack direction="row" spacing={0.75} sx={{ mb: 1.5, overflowX: "auto", pb: 0.5, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
                {ranks.map((r) => renderRankItem(r, true))}
              </Stack>
              {renderRankPanel()}
            </>
          ) : (
            <Box sx={{ display: "grid", gridTemplateColumns: "250px minmax(0, 1fr)", gap: 2, alignItems: "start" }}>
              <Box sx={{ position: "sticky", top: 84, p: 0.75, bgcolor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 3 }}>
                <Typography sx={{ px: 1, pt: 0.5, pb: 0.75, fontSize: "0.72rem", fontWeight: 800, color: SUB }}>เลือกตำแหน่ง ({ranks.length})</Typography>
                <Stack spacing={0.25}>{ranks.map((r) => renderRankItem(r, false))}</Stack>
              </Box>
              {renderRankPanel()}
            </Box>
          )}

          <Typography variant="caption" sx={{ color: SUB, display: "block", mt: 1.25 }}>
            ระบบตรวจสิทธิ์ซ้ำที่เซิร์ฟเวอร์ทุกครั้งที่บันทึกข้อมูล · คุณอยู่ตำแหน่ง {rankName(myRole)} · Role {SYSTEM_ROLE_LABEL[systemRoleOf(userData)]}
          </Typography>

          {renderSaveBar()}
        </>
      )}

      {/* ตรวจสอบก่อนบันทึก — สรุปทุกข้อที่จะเปลี่ยน แยกตามตำแหน่ง */}
      <Dialog open={reviewOpen} fullWidth maxWidth="sm" onClose={() => !busyAll && setReviewOpen(false)} PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800, pb: 0.5 }}>ตรวจสอบก่อนบันทึก</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: SUB, mb: 1.5 }}>
            จะเปลี่ยนสิทธิ์ {pendingList.length} ข้อ ใน {pendingRanks.length} ตำแหน่ง — มีผลกับผู้ใช้ {pendingRanks.reduce((s, r) => s + peopleOf(r).length, 0)} คนทันทีที่บันทึก
          </Typography>
          <Stack spacing={1.25}>
            {pendingRanks.map((rank) => (
              <Box key={rank} sx={{ border: `1px solid ${BORDER}`, borderRadius: 2.5, overflow: "hidden" }}>
                <Stack direction="row" alignItems="center" sx={{ px: 1.5, py: 0.9, bgcolor: SOFT, borderBottom: `1px solid ${BORDER}` }}>
                  <Typography sx={{ flex: 1, fontWeight: 900, fontSize: "0.86rem", color: INK }}>{rankName(rank)}</Typography>
                  <Typography sx={{ fontSize: "0.72rem", color: SUB, fontWeight: 700 }}>{peopleOf(rank).length} คน</Typography>
                </Stack>
                {pendingOf(rank).map(({ cap, next }) => (
                  <Stack key={cap} direction="row" spacing={1} alignItems="center" sx={{ px: 1.5, py: 0.8, borderTop: `1px solid ${BORDER}`, "&:first-of-type": { borderTop: 0 } }}>
                    <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.8rem", fontWeight: 700, color: INK_2 }}>{CAP_TITLE[cap] || cap}</Typography>
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
                      <Tag tone="muted">{next ? "ปิด" : "เปิด"}</Tag>
                      <ArrowForwardRounded sx={{ fontSize: 14, color: FAINT }} />
                      <Tag tone={next ? "blue" : "amber"}>{next ? "เปิด" : "ปิด"}</Tag>
                    </Stack>
                  </Stack>
                ))}
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setReviewOpen(false)} disabled={busyAll} sx={{ textTransform: "none", color: SUB }}>กลับไปแก้ไข</Button>
          <Button
            variant="contained" disableElevation disabled={busyAll || !dirty} onClick={saveAll}
            startIcon={busyAll ? <CircularProgress size={15} color="inherit" /> : <Save sx={{ fontSize: 17 }} />}
            sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, bgcolor: BLUE, "&:hover": { bgcolor: BLUE_DARK } }}
          >
            บันทึก {pendingList.length} ข้อ
          </Button>
        </DialogActions>
      </Dialog>

      {/* ออกจากหน้าทั้งที่ยังไม่บันทึก */}
      <Dialog open={Boolean(leaveTo)} fullWidth maxWidth="xs" onClose={() => setLeaveTo(null)} PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800, pb: 0.5 }}>ยังไม่ได้บันทึกสิทธิ์</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: SUB }}>
            แก้ไขไว้ {pendingList.length} ข้อ ยังไม่บันทึก — ถ้าออกจากหน้านี้ การแก้ไขจะหายและไม่มีผลกับใคร
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { const to = leaveTo; setLeaveTo(null); setDraft({}); navigate(to); }} sx={{ textTransform: "none", color: "#b91c1c", fontWeight: 700 }}>ออกโดยไม่บันทึก</Button>
          <Button variant="contained" disableElevation onClick={() => { setLeaveTo(null); setTab("org"); setReviewOpen(true); }}
            sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, bgcolor: BLUE, "&:hover": { bgcolor: BLUE_DARK } }}>
            อยู่ต่อและบันทึก
          </Button>
        </DialogActions>
      </Dialog>

      {/* เปลี่ยนชื่อตำแหน่ง */}
      <Dialog open={Boolean(rename)} fullWidth maxWidth="xs" onClose={() => setRename(null)} PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800, pb: 0.5 }}>เปลี่ยนชื่อตำแหน่ง</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: SUB, mb: 2 }}>
            เปลี่ยนเฉพาะชื่อที่แสดงทุกที่ในระบบ (เมนู · ป้ายตำแหน่ง · ข้อความแจ้งเตือน · เอกสาร) —
            สิทธิ์และผู้ใช้ในตำแหน่งนี้ไม่เปลี่ยน · เว้นว่างเพื่อกลับไปใช้ชื่อเริ่มต้น ·
            ไม่เกี่ยวกับ Role (Super Admin / Admin / Member) ซึ่งเปลี่ยนชื่อไม่ได้
          </Typography>
          <TextField
            autoFocus fullWidth size="small" label="ชื่อตำแหน่ง" value={rename?.label || ""}
            onChange={(e) => setRename((c) => ({ ...c, label: e.target.value }))}
            onKeyDown={(e) => { if (e.key === "Enter" && !saving.startsWith("name:")) saveRename(); }}
            inputProps={{ maxLength: 60 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRename(null)} sx={{ textTransform: "none", color: SUB }}>ยกเลิก</Button>
          <Button
            variant="contained" disableElevation onClick={saveRename} disabled={saving.startsWith("name:")}
            sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, bgcolor: BLUE, "&:hover": { bgcolor: BLUE_DARK } }}
          >
            บันทึกชื่อ
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmRoleDialog
        change={roleChange}
        busy={saving.startsWith("tier:")}
        error={confirmError}
        onCancel={() => { setRoleChange(null); setConfirmError(""); }}
        onConfirm={applyRole}
      />

      <Snackbar open={Boolean(toast)} autoHideDuration={3200} onClose={() => setToast("")} anchorOrigin={{ vertical: "top", horizontal: "center" }}>
        {/* ร่าง (ยังไม่บันทึก) = แจ้งเฉยๆ สีน้ำเงิน · บันทึกสำเร็จ = เขียว */}
        <Alert severity={/ยังไม่บันทึก|ในร่าง/.test(toast) ? "info" : "success"} variant="filled" onClose={() => setToast("")}>{toast}</Alert>
      </Snackbar>
    </Box>
  );
}
