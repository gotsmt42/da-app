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
  Box, Stack, Typography, Checkbox, Alert, Snackbar, CircularProgress, Tooltip, Chip,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, MenuItem, Select, Avatar,
  Switch, ButtonBase, useMediaQuery,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { AdminPanelSettings, Lock, InfoOutlined, Edit, Badge as BadgeIcon, Save, CheckCircle, RemoveCircleOutline } from "@mui/icons-material";

import usePermissions from "@/shared/hooks/usePermissions";
import { useAuth } from "@/features/auth/AuthContext";
import PermissionService from "@/shared/services/PermissionService";
import OrgSettingService from "@/shared/services/OrgSettingService";
import AuthService from "@/shared/services/authService";
import useRealtime from "@/shared/realtime/useRealtime";
import { systemRoleOf, SYSTEM_ROLE_LABEL, rankLabel, titleOf } from "@/shared/utils/roles";

const ACCENT = "#2563eb"; // ✅ น้ำเงินตามธีมแอป (ผู้ใช้: "ไม่เอาสีม่วง")
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
    title: "งานและตารางงาน",
    items: [
      ["viewAllJobs", "เห็นงานของทุกคน",
        "ติ๊ก = เห็นงานทุกงานในตารางงาน หน้าการดำเนินงาน แดชบอร์ด รายงานงาน และติดตามใบเสนอราคา · ไม่ติ๊ก = เห็นเฉพาะงานที่ตัวเองสร้าง เป็นผู้รับผิดชอบ หรืออยู่ในทีมเข้างาน", "server"],
      ["viewServiceCalendar", "เปิดดู “ตารางงานช่าง” ได้ (ดูอย่างเดียว)",
        "สำหรับคนนอกฝ่ายบริการ เช่น เซล — เช็กว่าช่างว่างวันไหนก่อนนัดลูกค้า · เพิ่ม/แก้/ย้ายงานช่างไม่ได้ ถ้าต้องการให้ติ๊ก “แก้ไขงานของคนอื่น” เพิ่ม", "server"],
      ["editAnyJob", "แก้ไข / ย้ายวัน / ลบ งานของคนอื่น",
        "ไม่ติ๊ก = แก้ได้เฉพาะงานที่ตัวเองสร้างหรือเป็นผู้รับผิดชอบ", "server"],
      ["editOperation", "เปิดเมนู “การดำเนินงาน” และอัปเดตงานได้ทุกงานที่มองเห็น",
        "เปลี่ยนสถานะ มอบหมายผู้รับผิดชอบ แนบเอกสารแทนช่าง · ช่างที่ติ๊ก “รับงานที่ได้รับมอบหมาย” ใช้เมนู “งานของฉัน” แทน และอัปเดตได้เฉพาะงานของตัวเอง", "ui"],
      ["approveJobs", "อนุมัติแผนงาน และอนุมัติ/ไม่อนุมัติการปิดงาน",
        "แผนงานที่ช่าง/เซลสร้างเองจะรอที่ “คำขอลงงาน” จนกว่าคนที่มีสิทธิ์นี้อนุมัติ · คำขอปิดงานจากช่างก็ต้องให้คนที่มีสิทธิ์นี้อนุมัติ", "server"],
    ],
  },
  {
    title: "แจ้งงานและคำขอลงงาน",
    items: [
      ["requestDispatch", "แจ้งงานให้ช่าง (เมนู “แจ้งงานให้ช่าง”)",
        "ส่งรายละเอียดงานพร้อมใบเสนอราคา/PO ให้ฝ่ายช่างจัดคิว · เห็นเฉพาะใบที่ตัวเองแจ้ง เลือกช่างหรือนัดวันเองไม่ได้", "server"],
      ["assignDispatch", "จัดคิว “คำขอลงงาน” — ลงแผนงาน เลือกช่าง ตีกลับ",
        "เห็นคำขอของทุกคน ทั้งที่เซลแจ้งเข้ามาและแผนงานที่ช่างสร้างเอง · แก้ไข/ยกเลิกใบของคนอื่นได้", "server"],
      ["receiveDispatch", "รับงานที่ได้รับมอบหมาย (เมนู “งานของฉัน”)",
        "สำหรับช่างหน้างาน — แนบเอกสารประจำงาน คุยกับแอดมิน ขอปิดงาน · ไม่ติ๊ก = ชื่อไม่ขึ้นในรายชื่อให้มอบหมายงาน", "server"],
    ],
  },
  {
    title: "เอกสาร · ใบเสนอราคา · สัญญา",
    items: [
      ["viewDocuments", "เปิดเมนู “เอกสาร” (ไฟล์แนบของงาน · ทะเบียนเอกสารที่ออกจากระบบ)",
        "ไม่ติ๊ก = เมนูเอกสารหาย และเปิดหน้าเอกสารตรงๆ ก็ถูกพากลับหน้าแรก · ค่าเริ่มต้น: ทุก Rank ยกเว้นเซล", "ui"],
      ["editDocuments", "ออกเลขที่และแก้ไขเอกสารที่ออกจากระบบ (ใบแจ้งเข้างาน · ใบส่งมอบงาน)",
        "เปลี่ยนสถานะ/ยกเลิกเอกสารในทะเบียนได้ · ไม่ติ๊ก = เปิดดู พิมพ์ และส่งอีเมลได้อย่างเดียว", "server"],
      ["viewFinance", "เปิดเมนู “ใบเสนอราคา / การเงิน” (ติดตามใบเสนอราคา · วางบิล/รับเงิน)",
        "เห็นตามขอบเขตงานของตัวเอง (ดู “เห็นงานของทุกคน”) · บันทึกการติดตามลูกค้าได้ · ไม่ติ๊ก = เมนูนี้หาย", "ui"],
      ["editFinance", "แก้มูลค่า/VAT ใบเสนอราคา · เริ่มนับ/ย้อนสถานะ · บันทึกวางบิลและรับเงิน",
        "ต้องติ๊ก “เปิดเมนูใบเสนอราคา / การเงิน” คู่กันเสมอ", "server"],
      ["viewContracts", "เปิดเมนู “ภาพรวมงาน” (สัญญาบริการ · รอบเข้างาน · งานทั่วไป/โปรเจค)",
        "ดูอย่างเดียว · เห็นว่าสัญญาไหนใกล้หมดอายุหรือเลยกำหนดเข้ารอบ", "ui"],
      ["editContracts", "เพิ่ม / แก้ไข / ต่ออายุสัญญา และจัดรอบเข้างาน",
        "ต้องติ๊ก “เปิดเมนูภาพรวมงาน” คู่กันเสมอ", "server"],
      ["createSalesPlan", "ลงนัดหมายลูกค้าในตารางงานฝ่ายขาย (แผนงานของฉัน)",
        "คนละตารางกับตารางงานช่าง · ไม่ติ๊ก = สร้างนัดหมายฝ่ายขายไม่ได้", "ui"],
    ],
  },
  {
    title: "เบิกค่าใช้จ่าย · OT · ใบขอซื้อ (สายอนุมัติ 3 ส่วน)",
    items: [
      ["requestExpense", "ส่วนที่ 1 — ยื่นของตัวเอง: ใบเบิก Advance · ใบเคลม · ค่าจ้างผู้รับเหมา · OT · ใบขอซื้อ",
        "เห็นเฉพาะใบของตัวเอง และแก้ได้จนกว่าจะถูกตรวจสอบ · ไม่ติ๊ก = เมนูเบิกค่าใช้จ่าย OT และจัดซื้อหาย", "server"],
      ["reviewExpense", "ส่วนที่ 2 มือแรก — ตรวจสอบใบของคนอื่น แล้วส่งต่อให้ผู้อนุมัติ",
        "ใช้กับใบเบิก OT และใบขอซื้อ · ตรวจแล้วระบบแจ้งผู้อนุมัติทันที · ตีกลับให้แก้ได้", "server"],
      ["approveExpense", "ส่วนที่ 2 มือสอง — อนุมัติใบที่ผ่านการตรวจสอบแล้ว",
        "คนตรวจกับคนอนุมัติต้องเป็นคนละคน (ยกเว้นตำแหน่งที่ระบบกำหนดให้ทำได้ทั้งสองขั้น) · อนุมัติแล้วเงินยังไม่ออก", "server"],
      ["disburseExpense", "ส่วนที่ 3 — อนุมัติเบิกจ่าย (ยืนยันการจ่ายเงิน) · ปิดรอบจ่าย OT",
        "ขั้นสุดท้าย · ใบ Advance เริ่มนับกำหนดเคลียร์ตามจำนวนวันใน “ตั้งค่าองค์กร”", "server"],
      ["viewAllExpenses", "เห็นใบของทุกคน ยื่นแทนคนอื่น ดูรายงาน · สั่งซื้อและรับของในใบขอซื้อ · ค่าจ้าง OT",
        "ไม่ติ๊ก = เห็นเฉพาะใบของตัวเอง", "server"],
    ],
  },
  {
    title: "ข้อมูลหลัก",
    items: [
      ["manageMasterData", "จัดการข้อมูลหลัก: ลูกค้า · พนักงาน/ภาระงานทีมช่าง · ประเภทงานและระบบงาน",
        "รวมถึงแก้ลิงก์แผนที่ของทุกโครงการ และดูว่าใครตั้งลายเซ็นแล้วบ้าง · การเพิ่ม/ลบผู้ใช้และตั้งค่าระบบกำหนดด้วย Role (แท็บแรก)", "server"],
    ],
  },
  {
    title: "เว็บไซต์บริษัท",
    items: [
      ["manageWebsite", "แก้เนื้อหาเว็บไซต์บริษัท (สินค้า · ผลงาน · บทความ · การแสดงผล)",
        "บันทึกแล้วขึ้นเว็บสาธารณะทันที · ค่าเริ่มต้น: เฉพาะ Super Admin", "server"],
      ["viewLeads", "ดูและจัดการคำขอจากเว็บไซต์ (ติดต่อ / ขอใบเสนอราคา)",
        "มีชื่อ เบอร์โทร อีเมลของลูกค้า (ข้อมูลส่วนบุคคล) · ค่าเริ่มต้น: Super Admin และ Admin", "server"],
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
  // ✅ (5 ต.ค. 2569) ผู้ใช้: "หน้ามือถือมันเพี้ยน ไม่สมบูรณ์" — ตาราง 7 คอลัมน์บีบไม่ลงจอมือถือ
  //    มือถือ: เลือก Rank ทีละตำแหน่ง แล้วเห็นรายการสิทธิ์พร้อมสวิตช์ (อ่านเต็มบรรทัด กดง่าย)
  const isMobile = useMediaQuery("(max-width:900px)");
  const [mobileRank, setMobileRank] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

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

  /** สิ่งที่แต่ละ Role ทำได้ — ตรงกับ config/roles.js ฝั่ง server (manageAll / manageSystem / SYSTEM_GRANTS) */
  const ROLE_DETAIL = {
    superadmin: {
      tone: "#1d4ed8", bg: "#eff6ff",
      can: ["ทุกเมนูและทุกสิทธิ์ในตาราง Rank โดยไม่ต้องติ๊ก", "ตั้งค่าองค์กร · ตั้งค่าสิทธิ์ · ตั้ง Role ให้ผู้อื่น", "เพิ่ม/แก้ไข/ลบผู้ใช้ทุกตำแหน่ง รวมถึงกรรมการผู้จัดการ", "จัดการเว็บไซต์บริษัทและคำขอจากลูกค้า"],
      cannot: ["ข้ามสายอนุมัติค่าใช้จ่าย (ยังเป็นไปตาม Rank)", "เปลี่ยน Role ของตัวเอง"],
    },
    admin: {
      tone: "#0f766e", bg: "#f0fdfa",
      can: ["เพิ่ม/แก้ไขผู้ใช้ (เฉพาะตำแหน่งต่ำกว่าตัวเอง)", "จัดการข้อมูลหลัก: ลูกค้า · พนักงาน · ประเภทงาน", "ดูและจัดการคำขอจากเว็บไซต์"],
      cannot: ["ตั้งค่าองค์กร · ตั้งค่าสิทธิ์ · ตั้ง Role"],
    },
    member: {
      tone: "#475569", bg: "#f8fafc",
      can: ["ใช้งานตามสิทธิ์ของ Rank (ตำแหน่งในองค์กร) เท่านั้น"],
      cannot: ["จัดการผู้ใช้และตั้งค่าระบบ"],
    },
  };
  const q = userQuery.trim().toLowerCase();
  const shownUsers = users
    .filter((u) => roleFilter === "all" || systemRoleOf(u) === roleFilter)
    .filter((u) => !q || [u.fname, u.lname, u.username, u.email, rankLabel(u.role)].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
    .sort((x, y) => ["superadmin", "admin", "member"].indexOf(systemRoleOf(x)) - ["superadmin", "admin", "member"].indexOf(systemRoleOf(y))
      || String(x.fname || x.username).localeCompare(String(y.fname || y.username), "th"));
  const capCount = (r) => (data?.capabilities || []).filter((c) => r.locked || isOn(r.rank, c)).length;
  const totalCaps = (data?.capabilities || []).length;

  return (
    <Box sx={{ p: { xs: 1.25, sm: 2.5 }, maxWidth: 1240, mx: "auto" }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: "#eff6ff", color: ACCENT, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <AdminPanelSettings />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900, fontSize: "1.35rem", color: "#0f172a", lineHeight: 1.25 }}>ตั้งค่าสิทธิ์</Typography>
          <Typography sx={{ fontSize: "0.82rem", color: TEXT_SUB }}>
            สิทธิ์มี 2 ชั้น · <b>Role</b> = ใครดูแลระบบได้แค่ไหน (ตั้งรายคน) · <b>Rank</b> = ตำแหน่งในบริษัททำงานอะไรได้บ้าง (ตั้งรายตำแหน่ง)
          </Typography>
        </Box>
      </Stack>

      {/* แท็บแบบปุ่มคู่ */}
      <Box sx={{ display: { xs: "grid", sm: "inline-flex" }, gridTemplateColumns: "1fr 1fr", width: { xs: "100%", sm: "auto" }, p: 0.5, mb: 2, borderRadius: 3, bgcolor: "#f1f5f9", border: `1px solid ${BORDER}` }}>
        {[["system", "Role · ตำแหน่งในระบบ", <BadgeIcon key="i" sx={{ fontSize: 18 }} />, users.length + " คน"], ["org", "Rank · ตำแหน่งในองค์กร", <AdminPanelSettings key="i" sx={{ fontSize: 18 }} />, ranks.length + " ตำแหน่ง"]].map(([v, label, icon, sub]) => {
          const on = tab === v;
          return (
            <ButtonBase key={v} onClick={() => setTab(v)} sx={{
              gap: 0.75, px: { xs: 1.25, sm: 2 }, py: 0.9, borderRadius: 2.5, fontFamily: "inherit",
              bgcolor: on ? "#fff" : "transparent", color: on ? ACCENT : TEXT_SUB, boxShadow: on ? "0 1px 3px rgba(15,23,42,.12)" : "none",
            }}>
              {icon}
              <Typography sx={{ fontWeight: 800, fontSize: "0.86rem", color: "inherit", whiteSpace: "nowrap" }}>
                <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>{label}</Box>
                <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>{label.split(" · ")[0]}</Box>
              </Typography>
              <Typography sx={{ display: { xs: "none", sm: "block" }, fontSize: "0.72rem", color: TEXT_SUB }}>{sub}</Typography>
            </ButtonBase>
          );
        })}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError("")}>{error}</Alert>}

      {tab === "system" ? (
        <>
          {/* ── 3 Role: ทำอะไรได้ / ทำอะไรไม่ได้ ── */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" }, gap: 1.25, mb: 2 }}>
            {systemRoles.map((t) => {
              const d = ROLE_DETAIL[t.systemRole] || ROLE_DETAIL.member;
              const count = users.filter((u) => systemRoleOf(u) === t.systemRole).length;
              const on = roleFilter === t.systemRole;
              return (
                <ButtonBase key={t.systemRole} onClick={() => setRoleFilter(on ? "all" : t.systemRole)} sx={{
                  display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "flex-start", textAlign: "left", p: 1.75, borderRadius: 3, fontFamily: "inherit", bgcolor: "#fff",
                  border: `1px solid ${on ? d.tone : BORDER}`, boxShadow: on ? `0 0 0 1px ${d.tone}` : "0 1px 2px rgba(15,23,42,.04)",
                }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <Box sx={{ width: 32, height: 32, borderRadius: 2, bgcolor: d.bg, color: d.tone, display: "flex", alignItems: "center", justifyContent: "center" }}><BadgeIcon sx={{ fontSize: 18 }} /></Box>
                    <Typography sx={{ flex: 1, fontWeight: 900, fontSize: "1rem", color: "#0f172a" }}>{t.label}</Typography>
                    <Typography sx={{ fontWeight: 900, fontSize: "1.1rem", color: d.tone }}>{count}<Box component="span" sx={{ fontSize: "0.72rem", color: TEXT_SUB, fontWeight: 700, ml: 0.4 }}>คน</Box></Typography>
                  </Stack>
                  <Stack spacing={0.4}>
                    {d.can.map((x) => (
                      <Stack key={x} direction="row" spacing={0.75} alignItems="flex-start">
                        <CheckCircle sx={{ fontSize: 15, color: "#16a34a", mt: 0.2 }} />
                        <Typography sx={{ fontSize: "0.78rem", color: "#334155", lineHeight: 1.45 }}>{x}</Typography>
                      </Stack>
                    ))}
                    {d.cannot.map((x) => (
                      <Stack key={x} direction="row" spacing={0.75} alignItems="flex-start">
                        <RemoveCircleOutline sx={{ fontSize: 15, color: "#94a3b8", mt: 0.2 }} />
                        <Typography sx={{ fontSize: "0.78rem", color: TEXT_SUB, lineHeight: 1.45 }}>ไม่ได้: {x}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </ButtonBase>
              );
            })}
          </Box>

          {/* ── ผู้ใช้แต่ละคน ── */}
          <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 3, overflow: "hidden" }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} sx={{ px: 2, py: 1.25, bgcolor: "#f8fafc", borderBottom: `1px solid ${BORDER}` }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 900, fontSize: "0.95rem", color: "#0f172a" }}>
                  ผู้ใช้ในระบบ {roleFilter !== "all" ? `· ${SYSTEM_ROLE_LABEL[roleFilter]} ` : ""}({shownUsers.length}{shownUsers.length !== users.length ? `/${users.length}` : ""})
                </Typography>
                <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>เลือก Role ให้แต่ละคน · ต้องยืนยันด้วยรหัสผ่านของคุณ · ต้องเหลือ Super Admin อย่างน้อย 1 คน</Typography>
              </Box>
              <TextField size="small" placeholder="ค้นหาชื่อ / ชื่อผู้ใช้ / ตำแหน่ง" value={userQuery} onChange={(e) => setUserQuery(e.target.value)}
                sx={{ width: { xs: "100%", sm: 260 }, "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "#fff" } }} />
            </Stack>
            {/* หัวคอลัมน์ (จอใหญ่) */}
            <Box sx={{ display: { xs: "none", md: "grid" }, gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) 210px", gap: 2, px: 2, py: 0.9, borderBottom: `1px solid ${BORDER}` }}>
              {["ผู้ใช้", "ตำแหน่งในองค์กร (Rank)", "Role ในระบบ"].map((h) => (
                <Typography key={h} sx={{ fontSize: "0.72rem", fontWeight: 800, color: TEXT_SUB }}>{h}</Typography>
              ))}
            </Box>
            {shownUsers.length === 0 && <Typography sx={{ p: 2, fontSize: "0.86rem", color: TEXT_SUB }}>ไม่พบผู้ใช้</Typography>}
            {shownUsers.map((u) => {
              const tier = systemRoleOf(u);
              const d = ROLE_DETAIL[tier] || ROLE_DETAIL.member;
              const isSelf = String(u._id) === String(userData?.userId || "");
              const name = [u.fname, u.lname].filter(Boolean).join(" ") || u.username;
              return (
                <Box key={u._id} sx={{
                  display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr) auto", md: "minmax(0, 1.4fr) minmax(0, 1fr) 210px" }, gap: { xs: 1, md: 2 }, alignItems: "center",
                  px: 2, py: 1.1, borderTop: `1px solid ${BORDER}`, "&:first-of-type": { borderTop: 0 }, "&:hover": { bgcolor: "#f8fafc" },
                }}>
                  <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
                    <Avatar src={u.imageUrl?.startsWith("http") ? u.imageUrl : undefined} sx={{ width: 36, height: 36, fontSize: 15, fontWeight: 800 }}>
                      {(u.fname || u.username || "?").charAt(0)}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography noWrap component="div" sx={{ fontWeight: 800, fontSize: "0.9rem", color: "#0f172a" }}>
                        {name}{isSelf && <Box component="span" sx={{ ml: 0.75, px: 0.75, py: 0.1, borderRadius: 99, fontSize: "0.64rem", fontWeight: 800, bgcolor: "#eff6ff", color: ACCENT }}>คุณ</Box>}
                      </Typography>
                      <Typography noWrap sx={{ fontSize: "0.74rem", color: TEXT_SUB }}>
                        @{u.username}<Box component="span" sx={{ display: { md: "none" } }}> · {rankLabel(u.role)}</Box>
                      </Typography>
                    </Box>
                  </Stack>
                  <Box sx={{ display: { xs: "none", md: "block" }, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: "0.86rem", fontWeight: 700, color: "#334155" }}>{rankLabel(u.role)}</Typography>
                    {titleOf(u) && titleOf(u) !== rankLabel(u.role) && <Typography noWrap sx={{ fontSize: "0.72rem", color: TEXT_SUB }}>ในเอกสาร: {titleOf(u)}</Typography>}
                  </Box>
                  <Tooltip title={isSelf ? "เปลี่ยน Role ของตัวเองไม่ได้ (กันล็อกตัวเองออกจากระบบ)" : ""} describeChild>
                    <span>
                      <Select
                        size="small" value={tier} disabled={isSelf || saving === `tier:${u._id}`}
                        onChange={(e) => { setConfirmError(""); setTierChange({ user: u, systemRole: e.target.value }); }}
                        renderValue={(v) => (
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: (ROLE_DETAIL[v] || d).tone }} />
                            <span>{SYSTEM_ROLE_LABEL[v]}</span>
                          </Stack>
                        )}
                        sx={{ width: { xs: 136, md: "100%" }, fontWeight: 800, fontSize: "0.85rem", borderRadius: 2, bgcolor: "#fff" }}
                      >
                        {systemRoles.map((t) => (
                          <MenuItem key={t.systemRole} value={t.systemRole} sx={{ fontSize: "0.85rem", fontWeight: 700 }}>{t.label}</MenuItem>
                        ))}
                      </Select>
                    </span>
                  </Tooltip>
                </Box>
              );
            })}
          </Box>
        </>
      ) : (
        <>
          {/* คำอธิบายย่อ + สัญลักษณ์ */}
          <Stack direction={{ xs: "column", md: "row" }} spacing={{ xs: 0.75, md: 2.5 }} sx={{ mb: 1.5, px: 1.75, py: 1.25, borderRadius: 3, bgcolor: "#fff", border: `1px solid ${BORDER}` }}>
            <Stack direction="row" spacing={0.75} alignItems="center"><InfoOutlined sx={{ fontSize: 17, color: ACCENT }} /><Typography sx={{ fontSize: "0.8rem", color: "#334155" }}>ติ๊กแล้วบันทึกทันที มีผลกับทุกคนในตำแหน่งนั้น</Typography></Stack>
            <Stack direction="row" spacing={0.75} alignItems="center"><Box component="span" sx={{ px: 0.75, borderRadius: 1, fontSize: "0.62rem", fontWeight: 800, bgcolor: alpha("#0f766e", 0.12), color: "#0f766e" }}>บังคับจริง</Box><Typography sx={{ fontSize: "0.78rem", color: TEXT_SUB }}>server ตรวจซ้ำทุกครั้ง</Typography></Stack>
            <Stack direction="row" spacing={0.75} alignItems="center"><Box component="span" sx={{ px: 0.75, borderRadius: 1, fontSize: "0.62rem", fontWeight: 800, bgcolor: alpha("#64748b", 0.12), color: "#475569" }}>เมนู/หน้า</Box><Typography sx={{ fontSize: "0.78rem", color: TEXT_SUB }}>คุมการเห็นเมนู · ข้อมูลยังกรองตามเจ้าของงาน</Typography></Stack>
            <Stack direction="row" spacing={0.75} alignItems="center"><Lock sx={{ fontSize: 15, color: TEXT_SUB }} /><Typography sx={{ fontSize: "0.78rem", color: TEXT_SUB }}>{ranks.find((r) => r.locked)?.label || "กรรมการผู้จัดการ"} สิทธิ์เต็มเสมอ</Typography></Stack>
          </Stack>
          {isMobile ? (() => {
            const cur = ranks.find((r) => r.rank === mobileRank) || ranks.find((r) => !r.locked) || ranks[0];
            if (!cur) return null;
            return (
              <>
                {/* ── เลือก Rank ── */}
                <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: TEXT_SUB, mb: 0.75, px: 0.25 }}>เลือกตำแหน่งที่จะตั้งสิทธิ์</Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75, mb: 1.5 }}>
                  {ranks.map((r) => {
                    const on = r.rank === cur.rank;
                    const count = (data?.capabilities || []).filter((c) => r.locked || isOn(r.rank, c)).length;
                    return (
                      <ButtonBase key={r.rank} onClick={() => setMobileRank(r.rank)} sx={{
                        justifyContent: "space-between", gap: 0.75, px: 1.25, py: 1, borderRadius: 2.5, fontFamily: "inherit", textAlign: "left",
                        border: "1px solid", borderColor: on ? ACCENT : BORDER, bgcolor: on ? alpha(ACCENT, 0.06) : "#fff",
                        boxShadow: on ? `inset 0 0 0 1px ${ACCENT}` : "none",
                      }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography noWrap sx={{ fontSize: "0.84rem", fontWeight: 800, color: on ? ACCENT : "#0f172a" }}>{r.label}</Typography>
                          <Typography sx={{ fontSize: "0.68rem", color: TEXT_SUB }}>{r.locked ? "สิทธิ์เต็ม" : `${count} สิทธิ์`}</Typography>
                        </Box>
                        {r.locked && <Lock sx={{ fontSize: 15, color: TEXT_SUB }} />}
                      </ButtonBase>
                    );
                  })}
                </Box>

                {/* ── หัวของ Rank ที่เลือก ── */}
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1, px: 1.5, py: 1.1, borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${BORDER}` }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: TEXT_SUB }}>กำลังตั้งสิทธิ์ของ</Typography>
                    <Typography noWrap sx={{ fontWeight: 900, fontSize: "1rem", color: "#0f172a" }}>{cur.label}</Typography>
                  </Box>
                  <Button size="small" startIcon={<Edit sx={{ fontSize: 16 }} />} onClick={() => setRename({ rank: cur.rank, label: cur.label })}
                    sx={{ textTransform: "none", fontWeight: 700, color: ACCENT, flexShrink: 0 }}>
                    เปลี่ยนชื่อ
                  </Button>
                </Stack>
                {cur.locked && (
                  <Alert severity="info" icon={<Lock />} sx={{ mb: 1 }}>{cur.label}มีสิทธิ์เต็มเสมอ แก้ไม่ได้</Alert>
                )}

                {/* ── รายการสิทธิ์ ── */}
                {GROUPS.map((group) => {
                  const items = group.items.filter(([cap]) => (data?.capabilities || []).includes(cap));
                  if (!items.length) return null;
                  return (
                    <Box key={group.title} sx={{ mb: 1.25, bgcolor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 2.5, overflow: "hidden" }}>
                      <Typography sx={{ px: 1.5, py: 0.9, fontWeight: 900, fontSize: "0.8rem", color: ACCENT, bgcolor: alpha(ACCENT, 0.05), borderBottom: `1px solid ${BORDER}` }}>
                        {group.title}
                      </Typography>
                      {items.map(([cap, label, hint, scope], i) => {
                        const busy = saving === `${cur.rank}:${cap}`;
                        const checked = cur.locked ? true : isOn(cur.rank, cap);
                        return (
                          <Stack key={cap} direction="row" alignItems="flex-start" spacing={1}
                            sx={{ px: 1.5, py: 1.1, borderTop: i ? `1px solid ${BORDER}` : 0 }}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: "#0f172a", lineHeight: 1.4 }}>{label}</Typography>
                              <Chip size="small" label={scope === "ui" ? "เมนู/หน้า" : "บังคับจริง"}
                                sx={{ mt: 0.4, height: 17, fontSize: "0.6rem", fontWeight: 800,
                                  bgcolor: scope === "ui" ? alpha("#64748b", 0.12) : alpha("#0f766e", 0.12),
                                  color: scope === "ui" ? "#475569" : "#0f766e" }} />
                              {hint && <Typography sx={{ fontSize: "0.74rem", color: TEXT_SUB, mt: 0.4, lineHeight: 1.45 }}>{hint}</Typography>}
                            </Box>
                            <Switch
                              checked={checked} disabled={cur.locked || busy}
                              onChange={(e) => toggle(cur.rank, cap, e.target.checked)}
                              sx={{ flexShrink: 0, mt: -0.5, "& .MuiSwitch-switchBase.Mui-checked": { color: ACCENT }, "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: ACCENT } }}
                            />
                          </Stack>
                        );
                      })}
                    </Box>
                  );
                })}
              </>
            );
          })() : (
          <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 2.5, overflow: "hidden" }}>
            <Box sx={{ overflowX: "auto" }}>
              <Box component="table" sx={{ borderCollapse: "collapse", width: "100%", minWidth: 780 }}>
                <Box component="thead">
                  <Box component="tr">
                    <Box component="th" sx={{ position: "sticky", left: 0, zIndex: 2, bgcolor: "#f8fafc", textAlign: "left", p: 1.25, borderBottom: `1px solid ${BORDER}`, minWidth: 380, fontSize: "0.85rem" }}>
                      สิทธิ์
                      <Typography variant="caption" sx={{ display: "block", color: TEXT_SUB, fontWeight: 500 }}>
                        ติ๊ก = ตำแหน่งนั้นทำได้ · ไม่ติ๊ก = เมนู/ปุ่มนั้นหายไป
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
                          {r.locked ? (
                            <Chip size="small" icon={<Lock sx={{ fontSize: "13px !important" }} />} label="สิทธิ์เต็ม"
                              sx={{ height: 18, fontSize: "0.63rem", fontWeight: 700, bgcolor: alpha(ACCENT, 0.1), color: ACCENT }} />
                          ) : (
                            <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, color: TEXT_SUB }}>{capCount(r)}/{totalCaps} สิทธิ์</Typography>
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
                        <Box component="tr" key={cap} sx={{ "&:hover > td": { bgcolor: "#f8fafc" } }}>
                          <Box component="td" sx={{ position: "sticky", left: 0, zIndex: 1, bgcolor: "#fff", p: 1.25, borderBottom: `1px solid ${BORDER}`, boxShadow: `1px 0 0 ${BORDER}` }}>
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

          )}

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
            sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, boxShadow: "none", bgcolor: ACCENT, "&:hover": { bgcolor: "#1d4ed8", boxShadow: "none" } }}
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
