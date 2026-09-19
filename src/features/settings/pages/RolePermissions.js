/**
 * RolePermissions — ตั้งค่าสิทธิ์ 2 ชั้นที่แยกจากกัน (ผู้ใช้สั่งให้แยก)
 *
 *   แท็บ 1 "Role · ตำแหน่งในระบบ"  — Super Admin / Admin / Member
 *                                  ชื่อภาษาอังกฤษ คงที่ · ตั้งให้ผู้ใช้เป็นรายคน · ตั้งได้เฉพาะ Super Admin
 *   แท็บ 2 "Rank · ตำแหน่งในองค์กร" — กรรมการผู้จัดการ/แอดมินช่าง/ช่างเทคนิค ...
 *                                  เปลี่ยน "ชื่อ" ได้ · ติ๊กว่า Rank ไหนเห็นเมนูอะไร/ทำอะไรได้
 *
 * 🔒 กติกากันล็อกตัวเอง (server บังคับซ้ำที่ routes/settings.js และ routes/auth.js):
 *   • Rank กรรมการผู้จัดการมีสิทธิ์เต็มเสมอ แก้ไม่ได้
 *   • ต้องเหลือ Super Admin อย่างน้อย 1 คน · เปลี่ยน Role ของตัวเองไม่ได้
 *   • เปลี่ยน Role ต้องยืนยันด้วยรหัสผ่านของคนที่กด
 */
import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Box, Stack, Typography, Checkbox, Alert, Snackbar, CircularProgress, Tooltip, Chip, Tabs, Tab,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, MenuItem, Select, Avatar,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { AdminPanelSettings, Lock, InfoOutlined, Edit, Badge as BadgeIcon, Save } from "@mui/icons-material";

import usePermissions from "@/shared/hooks/usePermissions";
import { useAuth } from "@/features/auth/AuthContext";
import PermissionService from "@/shared/services/PermissionService";
import OrgSettingService from "@/shared/services/OrgSettingService";
import AuthService from "@/shared/services/authService";
import useRealtime from "@/shared/realtime/useRealtime";
import { systemRoleOf, SYSTEM_ROLE_LABEL, rankLabel, titleOf } from "@/shared/utils/roles";

const ACCENT = "#7c3aed";
const SYS_ACCENT = "#0f766e";
const TEXT_SUB = "#64748b";
const BORDER = "#e2e8f0";

/**
 * คำอธิบายสิทธิ์ของ Rank — [คีย์, ติ๊กแล้วทำอะไรได้, ไม่ติ๊กแล้วเกิดอะไรขึ้น]
 *
 * ✅ ผู้ใช้สั่ง: "ใส่ความหมายให้ละเอียด ไม่กำกวม เช่นระบุว่าช่างเห็นแค่ของตัวเอง"
 * กติกาที่เขียนไว้ต้อง: ระบุ "เมนู/หน้าไหน" และ "ฝ่ายไหน" เสมอ — ห้ามเขียนกว้างๆ อย่าง "ดูงานได้"
 * ⚠️ ระบบมี 2 ฝ่ายที่มีปฏิทินแยกกัน: ฝ่ายบริการ (คิวงานช่าง) กับ ฝ่ายขาย (นัดหมายลูกค้า)
 * ⚠️ ต้องครอบคลุม EDITABLE_CAPABILITIES ฝั่ง server (สิทธิ์ไหนไม่มีในนี้ แถวนั้นจะหายไปจากตาราง)
 */
const GROUPS = [
  {
    title: "งานและปฏิทิน",
    items: [
      ["viewAllJobs", "เห็นงานของทุกคน ทั้งฝ่ายบริการและฝ่ายขาย",
        "ไม่ติ๊ก = เห็นเฉพาะงานที่ตัวเองสร้างหรือถูกระบุเป็นผู้รับผิดชอบ — เช่น ช่างเทคนิคจะเห็นแค่งานของตัวเองในปฏิทิน แดชบอร์ด และรายการใบเสนอราคา", "server"],
      ["viewServiceCalendar", "เปิดเมนู ปฏิทินงาน > ฝ่ายบริการ (คิวงานช่าง) ได้",
        "เปิดดูคิวช่างได้อย่างเดียว — จะเพิ่ม/แก้/ย้ายงานของฝ่ายบริการต้องติ๊ก “แก้ไขงานของคนอื่น” เพิ่ม · ช่องนี้มีไว้ให้เซลเช็กคิวช่างก่อนนัดลูกค้า (ปฏิทินฝ่ายขายเปิดได้อยู่แล้วโดยไม่ต้องใช้สิทธิ์นี้)", "server"],
      ["editAnyJob", "แก้ไข / ย้ายวัน / ลบงานของคนอื่นได้ทั้ง 2 ปฏิทิน",
        "ไม่ติ๊ก = แก้ได้เฉพาะงานที่ตัวเองสร้างหรือเป็นผู้รับผิดชอบ งานคนอื่นกดแก้ไม่ได้", "server"],
      ["editOperation", "เปิดเมนู “การดำเนินงาน” และอัปเดตสถานะ/ความคืบหน้า/รูปหน้างาน",
        "ช่างที่ติ๊ก “ถูกมอบหมายงานได้” เข้าหน้านี้ได้อยู่แล้วแต่อัปเดตได้เฉพาะงานที่ตัวเองรับ · ติ๊กช่องนี้ = อัปเดตได้ทุกงานที่มองเห็น", "ui"],
      ["approveJobs", "อนุมัติแผนงาน และอนุมัติคำขอปิดงานในปฏิทิน",
        "ไม่ติ๊ก = สร้างงานและกดขอปิดงานได้ แต่งานจะค้างอยู่จนกว่าคนที่มีสิทธิ์นี้จะกดอนุมัติ", "server"],
    ],
  },
  {
    title: "ใบมอบหมายงานช่าง (Dispatch)",
    items: [
      ["requestDispatch", "เปิดใบขอลงงานถึงฝ่ายบริการ (เมนู “คำขอลงงานของฉัน”)",
        "เห็นเฉพาะคำขอที่ตัวเองเปิด — คำขอของคนอื่นไม่เห็น และมอบหมายช่างเองไม่ได้", "server"],
      ["assignDispatch", "เปิดเมนู “คิวคำขอลงงาน” จัดคิว และเลือกช่างผู้รับงาน",
        "เห็นคำขอของทุกคนในบริษัท ไม่ใช่แค่ของตัวเอง · รวมถึงแก้ไข ยกเลิก หรือปิดคำขอของคนอื่น", "server"],
      ["receiveDispatch", "ถูกเลือกเป็นผู้รับงานได้ และอัปเดตเฉพาะงานที่ตัวเองรับ",
        "สำหรับช่างหน้างาน — ไม่ติ๊ก = ชื่อไม่ขึ้นในรายชื่อให้เลือกตอนมอบหมายงาน", "server"],
    ],
  },
  {
    title: "เอกสารและการเงิน",
    items: [
      ["viewDocuments", "เปิดเมนู “เอกสาร” (ไฟล์แนบของงาน · ทะเบียนเอกสารที่ออกแล้ว)",
        "ไม่ติ๊ก = เมนูเอกสารหายไปทั้งหมด และเปิด /documents เองก็ถูกพากลับไปหน้าแรก · ค่าเริ่มต้น: ทุก Rank ยกเว้นเซล", "ui"],
      ["editDocuments", "ออกเลขที่เอกสาร และแก้เอกสารที่ออกไปแล้ว (ใบส่งมอบงาน · ใบแจ้งหนี้ · ใบเสร็จ)",
        "ไม่ติ๊ก = เปิดดูและสั่งพิมพ์ได้อย่างเดียว ออกเลขที่ใหม่หรือแก้ของเดิมไม่ได้", "server"],
      ["viewFinance", "เปิดเมนู “การเงิน” (ใบเสนอราคา · ติดตามวางบิล · ติดตามการชำระเงิน)",
        "เปิดดูอย่างเดียว · ไม่ติ๊ก = เมนูการเงินหายไปทั้งหมด และพิมพ์ลิงก์ /finance เองก็ถูกปฏิเสธ", "ui"],
      ["editFinance", "แก้สถานะใบเสนอราคา บันทึกวางบิล และบันทึกรับเงิน",
        "ต้องติ๊ก “เปิดเมนูการเงิน” คู่กันเสมอ — ติ๊กแต่ช่องนี้อย่างเดียวจะเข้าหน้าไม่ได้", "server"],
      ["viewContracts", "เปิดเมนู “สัญญาบริการ” ดูสัญญาและรอบเข้า PM ของลูกค้า",
        "เปิดดูอย่างเดียว รวมถึงเห็นว่ารอบไหนถึงกำหนดเข้าบริการ", "ui"],
      ["editContracts", "สร้าง / แก้ / ต่ออายุสัญญา และกำหนดรอบเข้าบริการ (PM)",
        "ต้องติ๊ก “เปิดเมนูสัญญาบริการ” คู่กันเสมอ", "server"],
      ["createSalesPlan", "เปิดเมนู “งานขาย” สร้างงานขายและนัดหมายลูกค้าในปฏิทินฝ่ายขาย",
        "คนละปฏิทินกับคิวงานช่าง — ไม่ติ๊ก = เมนูงานขายหายไปทั้งหมด", "ui"],
    ],
  },
  {
    title: "ระบบเบิกค่าใช้จ่าย (สายอนุมัติ 3 ส่วน)",
    items: [
      ["requestExpense", "ส่วนที่ 1 — ออกใบเบิกล่วงหน้า (Advance) และใบเคลมของตัวเอง",
        "เห็นและแก้ได้เฉพาะใบของตัวเอง และเฉพาะตอนที่ยังไม่ถูกตรวจสอบ — ใบของคนอื่นไม่เห็น", "server"],
      ["reviewExpense", "ส่วนที่ 2 (มือแรก) — ตรวจสอบใบเบิกของคนอื่นก่อนส่งให้อนุมัติ",
        "ตรวจเสร็จ ระบบแจ้งเตือนคนที่มีสิทธิ์อนุมัติทันที — คนตรวจกับคนอนุมัติต้องเป็นคนละคน", "server"],
      ["approveExpense", "ส่วนที่ 2 (มือสอง) — อนุมัติใบเบิกที่ผ่านการตรวจสอบแล้ว",
        "อนุมัติแล้วเงินยังไม่ออก — การจ่ายจริงอยู่ที่ส่วนที่ 3", "server"],
      ["disburseExpense", "ส่วนที่ 3 — อนุมัติเบิกจ่าย ยืนยันว่าจ่ายเงินให้ผู้ขอแล้วจริง",
        "ขั้นสุดท้ายของสาย · กดแล้วระบบเริ่มนับกำหนดเคลียร์ Advance ตามจำนวนวันที่ตั้งไว้ใน ตั้งค่าองค์กร", "server"],
      ["viewAllExpenses", "เห็นใบเบิกของทุกคน ออกใบเบิกแทนคนอื่น และเปิดรายงานสรุปค่าใช้จ่าย",
        "ไม่ติ๊ก = เห็นเฉพาะใบเบิกของตัวเอง (เช่น ช่างเทคนิคเห็นแค่ใบที่ตัวเองเบิก)", "server"],
    ],
  },
  {
    title: "ข้อมูลหลัก",
    items: [
      ["manageMasterData", "เปิดเมนูข้อมูลหลัก: ทะเบียนลูกค้า · ทะเบียนพนักงาน/ทีมช่าง · ประเภทงาน/ระบบ · สินค้า/สต็อก · ลายเซ็น",
        "ไม่ติ๊ก = เมนูเหล่านี้หาย และเปิด /customers /staff /worktype /product เองไม่ได้ · ไม่รวมการเพิ่ม/ลบผู้ใช้และตั้งค่าระบบ สองอย่างนั้นกำหนดด้วย Role ที่แท็บแรก", "server"],
    ],
  },
];

/** กล่องยืนยันด้วยรหัสผ่าน — การเปลี่ยน Role คือการให้/ถอดอำนาจ ต้องยืนยันตัวตนซ้ำเสมอ */
const ConfirmDialog = ({ open, title, detail, busy, error, onCancel, onConfirm }) => {
  const [password, setPassword] = useState("");
  useEffect(() => { if (open) setPassword(""); }, [open]);
  if (!open) return null;
  return (
    <Dialog open fullWidth maxWidth="xs" onClose={() => !busy && onCancel()}>
      <DialogTitle sx={{ fontWeight: 800, pb: 0.5 }}>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: TEXT_SUB, mb: 2 }}>{detail}</Typography>
        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
        <TextField
          autoFocus fullWidth size="small" type="password" label="รหัสผ่านของคุณ"
          value={password} onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && password) onConfirm(password); }}
          helperText="ยืนยันว่าเป็นคุณจริง ก่อนเปลี่ยน Role ของคนนี้"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} disabled={busy} sx={{ textTransform: "none", color: TEXT_SUB }}>ยกเลิก</Button>
        <Button
          variant="contained" disabled={busy || !password} onClick={() => onConfirm(password)}
          startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <Save sx={{ fontSize: 17 }} />}
          sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: SYS_ACCENT, "&:hover": { bgcolor: "#115e59", boxShadow: "none" } }}
        >
          ยืนยันเปลี่ยน Role
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default function RolePermissions() {
  const { can, role: myRole } = usePermissions();
  const { userData } = useAuth();
  const [tab, setTab] = useState("system");
  const [data, setData] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [rename, setRename] = useState(null);     // { rank, label }
  const [tierChange, setTierChange] = useState(null); // { user, systemRole } — เปลี่ยน Role ของผู้ใช้รายคน
  const [confirmError, setConfirmError] = useState("");

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
  useRealtime(["settings", "users"], () => { load({ silent: true }); });

  // 🔒 หน้านี้เป็นการตั้งค่าระดับระบบ — เฉพาะผู้ดูแลระบบสูงสุด (server กันซ้ำอีกชั้น)
  if (!can("manageSystem")) return <Navigate to="/about" replace />;

  /** Role = ตำแหน่งในระบบ (Super Admin/Admin/Member) · Rank = ตำแหน่งในองค์กร */
  const systemRoles = data?.roles || [];
  const ranks = data?.ranks || [];
  const isOn = (rank, cap) => Boolean(data?.effective?.[cap]?.includes(rank));

  const toggle = async (rank, cap, next) => {
    setSaving(`${rank}:${cap}`); setError("");
    setData((cur) => {
      const effective = { ...cur.effective };
      const list = new Set(effective[cap] || []);
      if (next) list.add(rank); else list.delete(rank);
      return { ...cur, effective: { ...effective, [cap]: [...list] } };
    });
    try {
      const res = await PermissionService.setOne({ rank, capability: cap, allowed: next });
      setData((cur) => ({ ...cur, ...res }));
      setToast("บันทึกสิทธิ์แล้ว — มีผลกับทุกคนทันที");
    } catch (err) {
      setError(err?.response?.data?.message || "บันทึกสิทธิ์ไม่สำเร็จ");
      load({ silent: true });
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
      setToast("เปลี่ยนชื่อ Rank แล้ว");
    } catch (err) {
      setError(err?.response?.data?.message || "เปลี่ยนชื่อไม่สำเร็จ");
    } finally {
      setSaving("");
    }
  };

  const applyTier = async (password) => {
    const { user, systemRole } = tierChange;
    setSaving(`tier:${user._id}`); setConfirmError("");
    try {
      await AuthService.UpdateUser(user._id, { systemRole, confirmPassword: password });
      setTierChange(null);
      await load({ silent: true });
      setToast(`ตั้ง ${user.fname || user.username} เป็น Role: ${SYSTEM_ROLE_LABEL[systemRole]} แล้ว`);
    } catch (err) {
      setConfirmError(err?.response?.data?.message || "เปลี่ยน Role ไม่สำเร็จ");
    } finally {
      setSaving("");
    }
  };

  if (loading) return <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress size={28} /></Box>;

  return (
    <Box sx={{ p: { xs: 1.25, sm: 2.5 }, maxWidth: 1200, mx: "auto" }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2.5, bgcolor: ACCENT, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <AdminPanelSettings />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 900, fontSize: "1.3rem", color: "#0f172a", lineHeight: 1.25 }}>ตั้งค่าสิทธิ์</Typography>
          <Typography variant="caption" sx={{ color: TEXT_SUB }}>
            แยกกันชัดเจน — <b>Role</b> คือตำแหน่งในระบบ (ใครดูแลระบบ) · <b>Rank</b> คือตำแหน่งในองค์กร (ทำงานอะไรได้บ้าง)
          </Typography>
        </Box>
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1.5, borderBottom: `1px solid ${BORDER}`, "& .MuiTab-root": { textTransform: "none", fontWeight: 800 } }}>
        <Tab value="system" label="Role · ตำแหน่งในระบบ" icon={<BadgeIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
        <Tab value="org" label="Rank · ตำแหน่งในองค์กร" icon={<AdminPanelSettings sx={{ fontSize: 18 }} />} iconPosition="start" />
      </Tabs>

      {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError("")}>{error}</Alert>}

      {tab === "system" ? (
        <>
          <Alert severity="info" icon={<InfoOutlined />} sx={{ mb: 1.5 }}>
            <b>Role</b> = ตำแหน่งในระบบ (Super Admin / Admin / Member) — คนละเรื่องกับ <b>Rank</b> ที่เป็นตำแหน่งในบริษัท ·
            ใช้ชื่ออังกฤษและเปลี่ยนชื่อไม่ได้ · ตั้งได้เฉพาะ Super Admin · ต้องยืนยันด้วยรหัสผ่าน ·
            ต้องเหลือ Super Admin อย่างน้อย 1 คนเสมอ
          </Alert>

          {/* ── 3 Role ของระบบ ── */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 1, mb: 2 }}>
            {systemRoles.map((t) => (
              <Box key={t.systemRole} sx={{ p: 1.5, borderRadius: 2.5, border: `1px solid ${alpha(SYS_ACCENT, 0.3)}`, bgcolor: alpha(SYS_ACCENT, 0.04) }}>
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <BadgeIcon sx={{ fontSize: 18, color: SYS_ACCENT }} />
                  <Typography sx={{ fontWeight: 900, fontSize: "0.95rem" }}>{t.label}</Typography>
                  <Chip size="small" label={users.filter((u) => systemRoleOf(u) === t.systemRole).length} sx={{ height: 19, fontWeight: 800 }} />
                </Stack>
                <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 0.5 }}>{t.desc}</Typography>
              </Box>
            ))}
          </Box>

          {/* ── ผู้ใช้แต่ละคนอยู่ Role ไหน ── */}
          <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 2.5, overflow: "hidden" }}>
            <Box sx={{ px: 2, py: 1.25, bgcolor: "#f8fafc", borderBottom: `1px solid ${BORDER}` }}>
              <Typography sx={{ fontWeight: 900, fontSize: "0.92rem" }}>ผู้ใช้ในระบบ ({users.length}) — เลือก Role ให้แต่ละคน</Typography>
            </Box>
            <Stack divider={<Box sx={{ borderTop: `1px solid ${BORDER}` }} />}>
              {users.map((u) => {
                const tier = systemRoleOf(u);
                const isSelf = String(u._id) === String(userData?.userId || "");
                return (
                  <Stack key={u._id} direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} spacing={1.25} sx={{ px: 2, py: 1.1 }}>
                    <Avatar src={u.imageUrl?.startsWith("http") ? u.imageUrl : undefined} sx={{ width: 32, height: 32, fontSize: 14 }}>
                      {(u.fname || u.username || "?").charAt(0)}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: "0.9rem" }} noWrap>
                        {[u.fname, u.lname].filter(Boolean).join(" ") || u.username}
                        {isSelf && <Chip size="small" label="คุณ" sx={{ ml: 0.75, height: 18, fontSize: "0.65rem", fontWeight: 800 }} />}
                      </Typography>
                      <Typography variant="caption" sx={{ color: TEXT_SUB }}>
                        Rank: {rankLabel(u.role)}{titleOf(u) && titleOf(u) !== rankLabel(u.role) ? ` · ${titleOf(u)}` : ""}
                      </Typography>
                    </Box>
                    <Tooltip title={isSelf ? "เปลี่ยน Role ของตัวเองไม่ได้" : ""} describeChild>
                      <span>
                        <Select
                          size="small" value={tier} disabled={isSelf || saving === `tier:${u._id}`}
                          onChange={(e) => { setConfirmError(""); setTierChange({ user: u, systemRole: e.target.value }); }}
                          sx={{ minWidth: 190, fontWeight: 700, fontSize: "0.85rem" }}
                        >
                          {systemRoles.map((t) => (
                            <MenuItem key={t.systemRole} value={t.systemRole} sx={{ fontSize: "0.85rem" }}>{t.label}</MenuItem>
                          ))}
                        </Select>
                      </span>
                    </Tooltip>
                  </Stack>
                );
              })}
            </Stack>
          </Box>
        </>
      ) : (
        <>
          <Alert severity="info" icon={<InfoOutlined />} sx={{ mb: 1.5 }}>
            <b>Rank</b> คือตำแหน่งในองค์กร — เปลี่ยน “ชื่อ” ได้ (กดไอคอนดินสอที่หัวคอลัมน์) ·
            {" "}{ranks.find((r) => r.locked)?.label || "กรรมการผู้จัดการ"} มีสิทธิ์เต็มเสมอ แก้ไม่ได้ ·
            ติ๊กแล้วบันทึกทันที · ส่วนสิทธิ์ดูแลระบบอยู่ที่แท็บ Role
          </Alert>

          <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 2.5, overflow: "hidden" }}>
            <Box sx={{ overflowX: "auto" }}>
              <Box component="table" sx={{ borderCollapse: "collapse", width: "100%", minWidth: 780 }}>
                <Box component="thead">
                  <Box component="tr">
                    <Box component="th" sx={{ position: "sticky", left: 0, zIndex: 2, bgcolor: "#f8fafc", textAlign: "left", p: 1.25, borderBottom: `1px solid ${BORDER}`, minWidth: 260, fontSize: "0.85rem" }}>
                      สิ่งที่ Rank นี้ทำได้ / เมนูที่เห็น
                      <Typography variant="caption" sx={{ display: "block", color: TEXT_SUB, fontWeight: 500 }}>
                        ☑ = ทำได้ · ☐ = ทำไม่ได้ (เมนูและหน้านั้นหายไปทันที)
                        <br />ป้าย “บังคับจริง” = เซิร์ฟเวอร์ปฏิเสธซ้ำอีกชั้น · ป้าย “เมนู/หน้า” = คุมการเข้าถึงหน้านั้น ส่วนข้อมูลถูกกรองตามเจ้าของงานอยู่แล้ว
                      </Typography>
                    </Box>
                    {ranks.map((r) => (
                      <Box component="th" key={r.rank} sx={{ p: 1, borderBottom: `1px solid ${BORDER}`, bgcolor: "#f8fafc", minWidth: 104 }}>
                        <Stack alignItems="center" spacing={0.25}>
                          <Stack direction="row" alignItems="center" spacing={0.25}>
                            <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, lineHeight: 1.25 }}>{r.label}</Typography>
                            <Tooltip title="เปลี่ยนชื่อ Rank" describeChild>
                              <IconButton size="small" onClick={() => setRename({ rank: r.rank, label: r.label })} sx={{ p: 0.25 }}>
                                <Edit sx={{ fontSize: 13, color: TEXT_SUB }} />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                          {r.locked && (
                            <Chip size="small" icon={<Lock sx={{ fontSize: "13px !important" }} />} label="สิทธิ์เต็ม"
                              sx={{ height: 18, fontSize: "0.63rem", fontWeight: 700, bgcolor: alpha(ACCENT, 0.1), color: ACCENT }} />
                          )}
                        </Stack>
                      </Box>
                    ))}
                  </Box>
                </Box>
                <Box component="tbody">
                  {GROUPS.map((group) => ([
                    <Box component="tr" key={group.title}>
                      <Box component="td" colSpan={ranks.length + 1} sx={{ p: 0.9, pl: 1.25, bgcolor: alpha(ACCENT, 0.05), borderBottom: `1px solid ${BORDER}` }}>
                        <Typography sx={{ fontWeight: 900, fontSize: "0.82rem", color: ACCENT }}>{group.title}</Typography>
                      </Box>
                    </Box>,
                    ...group.items
                      .filter(([cap]) => (data?.capabilities || []).includes(cap))
                      .map(([cap, label, hint, scope]) => (
                        <Box component="tr" key={cap} sx={{ "&:hover": { bgcolor: "#f8fafc" } }}>
                          <Box component="td" sx={{ position: "sticky", left: 0, zIndex: 1, bgcolor: "inherit", p: 1.25, borderBottom: `1px solid ${BORDER}` }}>
                            <Stack direction="row" alignItems="flex-start" spacing={0.5}>
                              <Typography sx={{ fontSize: "0.86rem", fontWeight: 700 }}>{label}</Typography>
                              {/* ✅ บอกความจริงว่าสิทธิ์นี้บังคับลึกแค่ไหน — อย่าให้ผู้ดูแลเข้าใจว่ากันได้มากกว่าความจริง */}
                              <Tooltip
                                describeChild
                                title={scope === "ui"
                                  ? "คุมการเห็นเมนูและการเข้าหน้า — ส่วนข้อมูลที่เห็นในหน้า เซิร์ฟเวอร์กรองตามเจ้าของงานอีกชั้นเสมอ"
                                  : "เซิร์ฟเวอร์บังคับจริง — ไม่ติ๊กแล้วพิมพ์ URL หรือยิง API เองก็ทำไม่ได้"}
                              >
                                <Chip
                                  size="small" label={scope === "ui" ? "เมนู/หน้า" : "บังคับจริง"}
                                  sx={{
                                    height: 17, fontSize: "0.6rem", fontWeight: 800, flexShrink: 0,
                                    bgcolor: scope === "ui" ? alpha("#64748b", 0.12) : alpha("#0f766e", 0.12),
                                    color: scope === "ui" ? "#475569" : "#0f766e",
                                  }}
                                />
                              </Tooltip>
                            </Stack>
                            {hint && <Typography variant="caption" sx={{ color: TEXT_SUB }}>{hint}</Typography>}
                          </Box>
                          {ranks.map((r) => {
                            const busy = saving === `${r.rank}:${cap}`;
                            return (
                              <Box component="td" key={r.rank} sx={{ borderBottom: `1px solid ${BORDER}`, textAlign: "center" }}>
                                <Tooltip title={r.locked ? `${r.label}มีสิทธิ์เต็มเสมอ` : ""} describeChild>
                                  <span>
                                    <Checkbox
                                      size="small" checked={r.locked ? true : isOn(r.rank, cap)} disabled={r.locked || busy}
                                      onChange={(e) => toggle(r.rank, cap, e.target.checked)}
                                      sx={{ "&.Mui-checked": { color: ACCENT } }}
                                    />
                                  </span>
                                </Tooltip>
                              </Box>
                            );
                          })}
                        </Box>
                      )),
                  ]))}
                </Box>
              </Box>
            </Box>
          </Box>

          <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 1.25 }}>
            ⚠️ การซ่อนเมนูเป็นเพียงการจัดหน้าจอ — ระบบยังตรวจสิทธิ์ซ้ำที่เซิร์ฟเวอร์ทุกครั้งที่บันทึกข้อมูลจริง ·
            คุณกำลังใช้ Rank: {ranks.find((r) => r.rank === myRole)?.label || rankLabel(myRole)} · Role: {SYSTEM_ROLE_LABEL[systemRoleOf(userData)]}
          </Typography>
        </>
      )}

      {/* เปลี่ยนชื่อ Rank (ตำแหน่งในองค์กร) */}
      <Dialog open={Boolean(rename)} fullWidth maxWidth="xs" onClose={() => setRename(null)}>
        <DialogTitle sx={{ fontWeight: 800, pb: 0.5 }}>เปลี่ยนชื่อ Rank</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: TEXT_SUB, mb: 2 }}>
            เปลี่ยนเฉพาะชื่อที่แสดงทุกที่ในระบบ (เมนู · ป้ายตำแหน่ง · ข้อความแจ้งเตือน · เอกสาร) —
            สิทธิ์และข้อมูลผู้ใช้ที่อยู่ใน Rank นี้ไม่เปลี่ยน · เว้นว่างเพื่อกลับไปใช้ชื่อเริ่มต้น ·
            ไม่เกี่ยวกับ Role (Super Admin / Admin / Member) ซึ่งเปลี่ยนชื่อไม่ได้
          </Typography>
          <TextField
            autoFocus fullWidth size="small" label="ชื่อ Rank" value={rename?.label || ""}
            onChange={(e) => setRename((cur) => ({ ...cur, label: e.target.value }))}
            inputProps={{ maxLength: 60 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRename(null)} sx={{ textTransform: "none", color: TEXT_SUB }}>ยกเลิก</Button>
          <Button
            variant="contained" onClick={saveRename} disabled={saving.startsWith("name:")}
            sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: ACCENT, "&:hover": { bgcolor: "#6d28d9", boxShadow: "none" } }}
          >
            บันทึกชื่อ
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(tierChange)}
        title="เปลี่ยน Role (ตำแหน่งในระบบ)"
        detail={tierChange
          ? `ตั้ง ${[tierChange.user.fname, tierChange.user.lname].filter(Boolean).join(" ") || tierChange.user.username} เป็น Role "${SYSTEM_ROLE_LABEL[tierChange.systemRole]}" — Rank ในองค์กรไม่เปลี่ยน`
          : ""}
        busy={saving.startsWith("tier:")}
        error={confirmError}
        onCancel={() => { setTierChange(null); setConfirmError(""); }}
        onConfirm={applyTier}
      />

      <Snackbar open={Boolean(toast)} autoHideDuration={2600} onClose={() => setToast("")} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="success" variant="filled" onClose={() => setToast("")}>{toast}</Alert>
      </Snackbar>
    </Box>
  );
}
