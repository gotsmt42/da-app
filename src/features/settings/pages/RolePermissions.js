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
  Box, Stack, Typography, Checkbox, Alert, Snackbar, CircularProgress, Tooltip,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, MenuItem, Select, Avatar,
  Switch, ButtonBase, useMediaQuery,
} from "@mui/material";
import PageLoader from "@/shared/ui/PageLoader";
import { alpha } from "@mui/material/styles";
import { AdminPanelSettings, Lock, InfoOutlined, Edit, Badge as BadgeIcon, Save, CheckCircle, RemoveCircleOutline } from "@mui/icons-material";

import usePermissions from "@/shared/hooks/usePermissions";
import { useAuth } from "@/features/auth/AuthContext";
import PermissionService from "@/shared/services/PermissionService";
import OrgSettingService from "@/shared/services/OrgSettingService";
import AuthService from "@/shared/services/authService";
import useRealtime from "@/shared/realtime/useRealtime";
import { systemRoleOf, SYSTEM_ROLE_LABEL, rankLabel, titleOf, normalizeRole } from "@/shared/utils/roles";

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
      { cap: "viewAllJobs", title: "เห็นงานของทุกคน", desc: "เห็นทุกงานในตารางงานช่าง หน้าการดำเนินงาน แดชบอร์ด รายงานงาน และใบเสนอราคา · ได้เมนูตารางงานฝ่ายขายด้วย", off: "เห็นเฉพาะงานที่ตัวเองสร้าง เป็นผู้รับผิดชอบ หรืออยู่ในทีมเข้างาน" },
      { cap: "viewServiceCalendar", title: "ดูตารางงานช่าง (อ่านอย่างเดียว)", desc: "สำหรับคนนอกฝ่ายช่าง เช่น ฝ่ายขาย — เช็กว่าช่างว่างวันไหนก่อนนัดลูกค้า · เปิดดูรายละเอียดได้ แต่แก้ไม่ได้", off: "ไม่มีเมนู “ตารางงานช่าง (ดูอย่างเดียว)”" },
      { cap: "editAnyJob", title: "แก้ไข ย้ายวัน และลบงานของคนอื่น", desc: "แก้ได้ทุกงานที่มองเห็นในตารางงาน", off: "แก้ได้เฉพาะงานที่ตัวเองสร้างหรือเป็นผู้รับผิดชอบ" },
      { cap: "editOperation", title: "ใช้หน้า “การดำเนินงาน”", desc: "เปลี่ยนสถานะงาน มอบหมายผู้รับผิดชอบ แนบเอกสารแทนช่าง · ได้เมนู “รายงานงาน” ด้วย", off: "ไม่มีเมนูการดำเนินงาน (ช่างใช้เมนู “งานของฉัน” แทน)" },
      { cap: "approveJobs", title: "อนุมัติแผนงาน และอนุมัติการปิดงาน", desc: "แผนงานที่ช่างหรือฝ่ายขายลงเอง และคำขอปิดงานจากช่าง ต้องรอคนที่มีสิทธิ์นี้อนุมัติ", off: "อนุมัติไม่ได้ — แผนงานที่ตัวเองลงต้องรอคนอื่นอนุมัติ" },
    ],
  },
  {
    title: "แจ้งงาน · มอบหมายงาน · นัดหมายลูกค้า",
    items: [
      { cap: "requestDispatch", title: "แจ้งงานให้ช่าง", desc: "ส่งงานพร้อมใบเสนอราคา/PO เข้าคิวให้ฝ่ายช่าง · เห็นเฉพาะใบที่ตัวเองแจ้ง · คนที่มีสิทธิ์ “จัดคิวคำขอลงงาน” จะไม่เห็นเมนูนี้ (ลงงานเองได้อยู่แล้ว)", off: "ไม่มีเมนู “แจ้งงานให้ช่าง”" },
      { cap: "assignDispatch", title: "จัดคิวคำขอลงงาน", desc: "เห็นคำขอทุกใบ (จากฝ่ายขายและแผนงานที่ช่างลงเอง) · ลงแผนงาน เลือกช่าง ตีกลับ หรือยกเลิก", off: "ไม่มีเมนู “คำขอลงงาน”" },
      { cap: "receiveDispatch", title: "รับงานที่ได้รับมอบหมาย (งานของฉัน)", desc: "สำหรับช่างหน้างาน — เมนู “งานของฉัน” แนบเอกสารประจำงาน คุยกับแอดมิน และขอปิดงาน", off: "ไม่มีเมนูงานของฉัน และไม่มีชื่อในรายชื่อช่างตอนมอบหมายงาน" },
      { cap: "createSalesPlan", title: "ลงนัดหมายลูกค้า (ตารางงานฝ่ายขาย)", desc: "สร้าง/แก้นัดหมายของตัวเองในตารางงานฝ่ายขาย ซึ่งแยกจากตารางงานช่าง", off: "ลงนัดหมายฝ่ายขายไม่ได้" },
    ],
  },
  {
    title: "ภาพรวมงาน · เอกสาร · การเงิน",
    items: [
      { cap: "viewContracts", title: "เปิดเมนู “ภาพรวมงาน” และ “งานปิดแล้ว · ประวัติ”", desc: "ดูสัญญาบริการ รอบเข้างาน งานทั่วไป/โปรเจค (เห็นตามขอบเขตของ “เห็นงานของทุกคน”)", off: "ไม่มีเมนูภาพรวมงาน" },
      { cap: "editContracts", title: "เพิ่ม แก้ไข และต่ออายุสัญญา · จัดรอบเข้างาน", needs: "viewContracts", desc: "", off: "ดูได้อย่างเดียว" },
      { cap: "viewDocuments", title: "เปิดเมนู “เอกสาร”", desc: "ไฟล์แนบของงาน และทะเบียนเอกสารที่ออกจากระบบ (เปิดดู พิมพ์ ส่งอีเมล)", off: "ไม่มีเมนูเอกสาร" },
      { cap: "editDocuments", title: "ออกเลขที่และแก้ไขเอกสาร (ใบแจ้งเข้างาน · ใบส่งมอบงาน)", needs: "viewDocuments", desc: "เปลี่ยนสถานะหรือยกเลิกเอกสารในทะเบียน", off: "เปิดดู พิมพ์ และส่งอีเมลได้อย่างเดียว" },
      { cap: "viewFinance", title: "เปิดเมนู “ใบเสนอราคา / การเงิน”", desc: "ติดตามใบเสนอราคาและการวางบิลของงานที่ตัวเองเห็น · บันทึกการติดตามลูกค้าได้", off: "ไม่มีเมนูใบเสนอราคา / การเงิน" },
      { cap: "editFinance", title: "แก้มูลค่า/VAT · บันทึกวางบิลและรับเงิน", needs: "viewFinance", desc: "เริ่มนับหรือย้อนสถานะใบเสนอราคาได้", off: "ดูได้อย่างเดียว" },
    ],
  },
  {
    title: "เบิกค่าใช้จ่าย · OT · ใบขอซื้อ",
    note: "ลำดับการอนุมัติ: ผู้ยื่น → ตรวจสอบ → อนุมัติ → อนุมัติเบิกจ่าย",
    items: [
      { cap: "requestExpense", title: "ยื่นใบของตัวเอง", desc: "ใบเบิก Advance · ใบเคลม · ค่าจ้างผู้รับเหมา · OT · ใบขอซื้อ — เห็นเฉพาะใบของตัวเอง แก้ได้จนกว่าจะถูกตรวจสอบ", off: "ไม่มีเมนูเบิกค่าใช้จ่าย จัดซื้อ และ OT" },
      { cap: "reviewExpense", title: "ขั้นตรวจสอบ", desc: "ตรวจใบของคนอื่น แล้วส่งต่อให้ผู้อนุมัติ หรือตีกลับให้แก้ · ได้เมนู “รอดำเนินการ”", off: "ตรวจสอบใบไม่ได้" },
      { cap: "approveExpense", title: "ขั้นอนุมัติ", desc: "อนุมัติใบที่ผ่านการตรวจสอบแล้ว (อนุมัติแล้วเงินยังไม่ออก) · คนตรวจกับคนอนุมัติต้องเป็นคนละคน", off: "อนุมัติใบไม่ได้" },
      { cap: "disburseExpense", title: "ขั้นอนุมัติเบิกจ่าย (จ่ายเงิน)", desc: "ยืนยันการจ่ายเงิน และปิดรอบจ่าย OT · ใบ Advance เริ่มนับวันเคลียร์ตาม “ตั้งค่าองค์กร”", off: "จ่ายเงินไม่ได้" },
      { cap: "viewAllExpenses", title: "เห็นใบของทุกคน", desc: "ยื่นแทนคนอื่น ดูรายงานทั้งบริษัท สั่งซื้อ/รับของในใบขอซื้อ และตั้งค่าจ้าง OT", off: "เห็นเฉพาะใบของตัวเอง" },
    ],
  },
  {
    title: "ข้อมูลหลัก · เว็บไซต์บริษัท",
    items: [
      { cap: "manageMasterData", title: "จัดการข้อมูลหลัก", desc: "ลูกค้า · พนักงาน/ภาระงานทีมช่าง · ประเภทงานและระบบงาน · ลิงก์แผนที่ของโครงการ", off: "ไม่มีเมนูข้อมูลหลัก" },
      { cap: "manageWebsite", title: "แก้เนื้อหาเว็บไซต์บริษัท", desc: "สินค้า · ผลงาน · บทความ · การแสดงผล — บันทึกแล้วขึ้นเว็บทันที", off: "ไม่มีเมนูแก้เว็บไซต์" },
      { cap: "viewLeads", title: "ดูคำขอจากเว็บไซต์", desc: "ติดต่อ / ขอใบเสนอราคา — มีชื่อ เบอร์โทร อีเมลของลูกค้า (ข้อมูลส่วนบุคคล)", off: "ไม่มีเมนูคำขอจากเว็บไซต์" },
    ],
  },
];
const CAP_TITLE = Object.fromEntries(GROUPS.flatMap((g) => g.items.map((i) => [i.cap, i.title])));

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

/** ข้อความของสิทธิ์ 1 แถว: ชื่อ · ใช้ทำอะไร · ปิดแล้วเป็นอย่างไร · ต้องใช้คู่กับอะไร */
const CapText = ({ it }) => (
  <Box sx={{ flex: 1, minWidth: 0 }}>
    <Typography sx={{ fontSize: "0.86rem", fontWeight: 800, color: "#0f172a", lineHeight: 1.4 }}>
      {it.needs && <Box component="span" sx={{ color: "#94a3b8", mr: 0.5 }}>↳</Box>}{it.title}
    </Typography>
    {it.desc && <Typography sx={{ fontSize: "0.75rem", color: "#475569", mt: 0.25, lineHeight: 1.5 }}>{it.desc}</Typography>}
    <Typography sx={{ fontSize: "0.72rem", color: TEXT_SUB, mt: 0.25, lineHeight: 1.5 }}>
      <Box component="span" sx={{ fontWeight: 800 }}>ถ้าปิด:</Box> {it.off}
      {it.needs && <> · ต้องใช้คู่กับ “{CAP_TITLE[it.needs]}” (ระบบเปิดให้เอง)</>}
    </Typography>
  </Box>
);

export default function RolePermissions() {
  const { can, role: myRole } = usePermissions();
  const { userData } = useAuth();
  const [tab, setTab] = useState("org");
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
      const linked = (res?.linked || []).map((c) => `“${CAP_TITLE[c] || c}”`).join(" · ");
      setToast(linked
        ? `บันทึกแล้ว — ${next ? "เปิด" : "ปิด"} ${linked} ให้ด้วย เพราะต้องใช้คู่กัน`
        : "บันทึกสิทธิ์แล้ว — มีผลกับทุกคนในตำแหน่งนี้ทันที");
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

  if (loading) return <PageLoader label="กำลังโหลดสิทธิ์…" />;

  /** สิ่งที่แต่ละ Role ทำได้ — ตรงกับ config/roles.js ฝั่ง server (manageAll / manageSystem / SYSTEM_GRANTS) */
  // ✅ (8 ต.ค. 2569 ผู้ใช้: "สิทธิ์ไม่ให้รวมสิทธิ์ระบบ") Role = สิทธิ์ "ตั้งค่า/ดูแลระบบ" เท่านั้น
  //    งานทุกอย่าง (รวมข้อมูลหลัก เว็บไซต์ คำขอจากเว็บ) ใช้ได้ตามที่ติ๊กให้ Rank ของคนนั้นในแท็บแรก
  const ROLE_DETAIL = {
    superadmin: {
      tone: "#1d4ed8", bg: "#eff6ff",
      can: ["ตั้งค่าองค์กร (โลโก้ ข้อมูลบริษัทบนเอกสาร ค่าตั้งต้นของระบบ)", "ตั้งค่าสิทธิ์ของทุกตำแหน่ง และตั้ง Role ให้ผู้อื่น", "เพิ่ม/แก้ไข/ปิดบัญชีผู้ใช้ได้ทุกตำแหน่ง"],
      cannot: ["ได้สิทธิ์ทำงานเพิ่มเอง — งานใช้ได้ตามที่ติ๊กให้ตำแหน่ง (Rank) ของตัวเองเท่านั้น", "เปลี่ยน Role ของตัวเอง"],
    },
    admin: {
      tone: "#0f766e", bg: "#f0fdfa",
      can: ["เพิ่ม/แก้ไขบัญชีผู้ใช้ (เฉพาะตำแหน่งต่ำกว่าตัวเอง)"],
      cannot: ["ตั้งค่าองค์กร · ตั้งค่าสิทธิ์ · ตั้ง Role", "ได้สิทธิ์ทำงานเพิ่มเอง — ใช้ได้ตามตำแหน่ง (Rank)"],
    },
    member: {
      tone: "#475569", bg: "#f8fafc",
      can: ["ใช้งานตามสิทธิ์ของตำแหน่ง (Rank) เท่านั้น"],
      cannot: ["จัดการผู้ใช้และตั้งค่าระบบ"],
    },
  };

  const q = userQuery.trim().toLowerCase();
  const shownUsers = users
    .filter((u) => roleFilter === "all" || systemRoleOf(u) === roleFilter)
    .filter((u) => !q || [u.fname, u.lname, u.username, u.email, rankLabel(u)].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
    .sort((x, y) => ["superadmin", "admin", "member"].indexOf(systemRoleOf(x)) - ["superadmin", "admin", "member"].indexOf(systemRoleOf(y))
      || String(x.fname || x.username).localeCompare(String(y.fname || y.username), "th"));
  const peopleIn = (rank) => users.filter((u) => normalizeRole(u) === rank).length;
  const capCount = (r) => (data?.capabilities || []).filter((c) => r.locked || isOn(r.rank, c)).length;
  const totalCaps = (data?.capabilities || []).length;

  return (
    <Box sx={{ px: { xs: 0, sm: 2.5 }, py: { xs: 1.25, sm: 2.5 }, maxWidth: 1240, mx: "auto" }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: "#eff6ff", color: ACCENT, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <AdminPanelSettings />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900, fontSize: "1.35rem", color: "#0f172a", lineHeight: 1.25 }}>ตั้งค่าสิทธิ์</Typography>
          <Typography sx={{ fontSize: "0.82rem", color: TEXT_SUB }}>
            <b>ตามตำแหน่งงาน</b> = แต่ละตำแหน่งเห็นเมนูอะไรและทำงานอะไรได้ · <b>ผู้ดูแลระบบ</b> = ใครจัดการผู้ใช้และตั้งค่าระบบได้ (ตั้งรายคน)
          </Typography>
        </Box>
      </Stack>

      {/* แท็บแบบปุ่มคู่ */}
      <Box sx={{ display: { xs: "grid", sm: "inline-flex" }, gridTemplateColumns: "1fr 1fr", width: { xs: "100%", sm: "auto" }, p: 0.5, mb: 2, borderRadius: 3, bgcolor: "#f1f5f9", border: `1px solid ${BORDER}` }}>
        {[["org", "สิทธิ์ตามตำแหน่งงาน · Rank", <AdminPanelSettings key="i" sx={{ fontSize: 18 }} />, ranks.length + " ตำแหน่ง"], ["system", "ผู้ดูแลระบบ · Role", <BadgeIcon key="i" sx={{ fontSize: 18 }} />, users.length + " คน"]].map(([v, label, icon, sub]) => {
          const on = tab === v;
          return (
            <ButtonBase key={v} onClick={() => setTab(v)} sx={{
              gap: 0.75, px: { xs: 1.25, sm: 2 }, py: 0.9, borderRadius: 2.5, fontFamily: "inherit",
              bgcolor: on ? "#fff" : "transparent", color: on ? ACCENT : TEXT_SUB, boxShadow: on ? "0 1px 3px rgba(15,23,42,.12)" : "none",
            }}>
              {icon}
              <Typography sx={{ fontWeight: 800, fontSize: "0.86rem", color: "inherit", whiteSpace: "nowrap" }}>
                <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>{label}</Box>
                <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>{v === "org" ? "ตามตำแหน่ง" : "ผู้ดูแลระบบ"}</Box>
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
                        @{u.username}<Box component="span" sx={{ display: { md: "none" } }}> · {rankLabel(u)}</Box>
                      </Typography>
                    </Box>
                  </Stack>
                  <Box sx={{ display: { xs: "none", md: "block" }, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: "0.86rem", fontWeight: 700, color: "#334155" }}>{rankLabel(u)}</Typography>
                    {titleOf(u) && titleOf(u) !== rankLabel(u) && <Typography noWrap sx={{ fontSize: "0.72rem", color: TEXT_SUB }}>ในเอกสาร: {titleOf(u)}</Typography>}
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
          {/* ── คำอธิบายสั้น ── */}
          <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1.5, px: 1.75, py: 1.25, borderRadius: 3, bgcolor: "#f8fafc", border: `1px solid ${BORDER}` }}>
            <InfoOutlined sx={{ fontSize: 18, color: ACCENT, mt: 0.1 }} />
            <Typography sx={{ fontSize: "0.8rem", color: "#334155", lineHeight: 1.55 }}>
              เปิด/ปิดแล้ว <b>บันทึกทันที</b> และมีผลกับ <b>ทุกคนในตำแหน่งนั้น</b> ภายในไม่กี่วินาที (เมนูของเขาเปลี่ยนเอง ไม่ต้องออกจากระบบ) ·
              สิทธิ์ “แก้ไข” จะเปิดเมนูที่ต้องใช้คู่กันให้อัตโนมัติ · {ranks.find((r) => r.locked)?.label || "กรรมการผู้จัดการ"}มีสิทธิ์เต็มเสมอ
            </Typography>
          </Stack>
          {isMobile ? (() => {
            const cur = ranks.find((r) => r.rank === mobileRank) || ranks.find((r) => !r.locked) || ranks[0];
            if (!cur) return null;
            return (
              <>
                {/* ── เลือกตำแหน่ง — แถบเลื่อนแนวนอน ── */}
                <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: TEXT_SUB, mb: 0.75, px: 0.25 }}>เลือกตำแหน่ง</Typography>
                <Stack direction="row" spacing={0.75} sx={{ mb: 1.5, overflowX: "auto", pb: 0.5, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
                  {ranks.map((r) => {
                    const on = r.rank === cur.rank;
                    return (
                      <ButtonBase key={r.rank} onClick={() => setMobileRank(r.rank)} sx={{
                        flexShrink: 0, flexDirection: "column", alignItems: "flex-start", px: 1.4, py: 0.8, borderRadius: 2.5, fontFamily: "inherit", textAlign: "left",
                        border: "1px solid", borderColor: on ? ACCENT : BORDER, bgcolor: on ? alpha(ACCENT, 0.06) : "#fff",
                      }}>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Typography noWrap sx={{ fontSize: "0.84rem", fontWeight: 800, color: on ? ACCENT : "#0f172a" }}>{r.label}</Typography>
                          {r.locked && <Lock sx={{ fontSize: 13, color: TEXT_SUB }} />}
                        </Stack>
                        <Typography sx={{ fontSize: "0.68rem", color: TEXT_SUB }}>{peopleIn(r.rank)} คน · {r.locked ? "สิทธิ์เต็ม" : `${capCount(r)}/${totalCaps} สิทธิ์`}</Typography>
                      </ButtonBase>
                    );
                  })}
                </Stack>

                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1, px: 1.5, py: 1.1, borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${BORDER}` }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: TEXT_SUB }}>กำลังตั้งสิทธิ์ของ · {peopleIn(cur.rank)} คน</Typography>
                    <Typography noWrap sx={{ fontWeight: 900, fontSize: "1rem", color: "#0f172a" }}>{cur.label}</Typography>
                  </Box>
                  <Button size="small" startIcon={<Edit sx={{ fontSize: 16 }} />} onClick={() => setRename({ rank: cur.rank, label: cur.label })}
                    sx={{ textTransform: "none", fontWeight: 700, color: ACCENT, flexShrink: 0 }}>
                    เปลี่ยนชื่อ
                  </Button>
                </Stack>
                {cur.locked && <Alert severity="info" icon={<Lock />} sx={{ mb: 1 }}>{cur.label}มีสิทธิ์เต็มเสมอ แก้ไม่ได้</Alert>}

                {GROUPS.map((group) => {
                  const items = group.items.filter((it) => (data?.capabilities || []).includes(it.cap));
                  if (!items.length) return null;
                  return (
                    <Box key={group.title} sx={{ mb: 1.25, bgcolor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 2.5, overflow: "hidden" }}>
                      <Box sx={{ px: 1.5, py: 0.9, bgcolor: "#f8fafc", borderBottom: `1px solid ${BORDER}` }}>
                        <Typography sx={{ fontWeight: 900, fontSize: "0.82rem", color: "#0f172a" }}>{group.title}</Typography>
                        {group.note && <Typography sx={{ fontSize: "0.7rem", color: TEXT_SUB }}>{group.note}</Typography>}
                      </Box>
                      {items.map((it, i) => {
                        const busy = saving === `${cur.rank}:${it.cap}`;
                        const checked = cur.locked ? true : isOn(cur.rank, it.cap);
                        return (
                          <Stack key={it.cap} direction="row" alignItems="flex-start" spacing={1}
                            sx={{ pr: 1.5, py: 1.1, pl: it.needs ? 3 : 1.5, borderTop: i ? `1px solid ${BORDER}` : 0 }}>
                            <CapText it={it} />
                            <Switch
                              checked={checked} disabled={cur.locked || busy}
                              onChange={(e) => toggle(cur.rank, it.cap, e.target.checked)}
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
              <Box component="table" sx={{ borderCollapse: "collapse", width: "100%", minWidth: 860 }}>
                <Box component="thead">
                  <Box component="tr">
                    <Box component="th" sx={{ position: "sticky", left: 0, zIndex: 2, bgcolor: "#f8fafc", textAlign: "left", p: 1.25, borderBottom: `1px solid ${BORDER}`, minWidth: 400, fontSize: "0.85rem" }}>
                      สิทธิ์
                      <Typography variant="caption" sx={{ display: "block", color: TEXT_SUB, fontWeight: 500 }}>ติ๊ก = ตำแหน่งนั้นทำได้</Typography>
                    </Box>
                    {ranks.map((r) => (
                      <Box component="th" key={r.rank} sx={{ p: 1, borderBottom: `1px solid ${BORDER}`, bgcolor: "#f8fafc", minWidth: 104, verticalAlign: "top" }}>
                        <Stack alignItems="center" spacing={0.25}>
                          <Stack direction="row" alignItems="center" spacing={0.25}>
                            <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, lineHeight: 1.25 }}>{r.label}</Typography>
                            <Tooltip title="เปลี่ยนชื่อตำแหน่ง" describeChild>
                              <IconButton size="small" onClick={() => setRename({ rank: r.rank, label: r.label })} sx={{ p: 0.25 }}>
                                <Edit sx={{ fontSize: 13, color: TEXT_SUB }} />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                          <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, color: TEXT_SUB }}>
                            {peopleIn(r.rank)} คน · {r.locked ? "สิทธิ์เต็ม" : `${capCount(r)}/${totalCaps}`}
                          </Typography>
                        </Stack>
                      </Box>
                    ))}
                  </Box>
                </Box>
                <Box component="tbody">
                  {GROUPS.map((group) => ([
                    <Box component="tr" key={group.title}>
                      <Box component="td" colSpan={ranks.length + 1} sx={{ p: 0.9, pl: 1.25, bgcolor: "#f8fafc", borderBottom: `1px solid ${BORDER}` }}>
                        <Typography component="span" sx={{ fontWeight: 900, fontSize: "0.82rem", color: "#0f172a" }}>{group.title}</Typography>
                        {group.note && <Typography component="span" sx={{ ml: 1, fontSize: "0.72rem", color: TEXT_SUB }}>{group.note}</Typography>}
                      </Box>
                    </Box>,
                    ...group.items
                      .filter((it) => (data?.capabilities || []).includes(it.cap))
                      .map((it) => (
                        <Box component="tr" key={it.cap} sx={{ "&:hover > td": { bgcolor: "#f8fafc" } }}>
                          <Box component="td" sx={{ position: "sticky", left: 0, zIndex: 1, bgcolor: "#fff", p: 1.25, pl: it.needs ? 3.5 : 1.25, borderBottom: `1px solid ${BORDER}`, boxShadow: `1px 0 0 ${BORDER}` }}>
                            <CapText it={it} />
                          </Box>
                          {ranks.map((r) => {
                            const busy = saving === `${r.rank}:${it.cap}`;
                            return (
                              <Box component="td" key={r.rank} sx={{ borderBottom: `1px solid ${BORDER}`, textAlign: "center" }}>
                                <Tooltip title={r.locked ? `${r.label}มีสิทธิ์เต็มเสมอ` : ""} describeChild>
                                  <span>
                                    <Checkbox
                                      size="small" checked={r.locked ? true : isOn(r.rank, it.cap)} disabled={r.locked || busy}
                                      onChange={(e) => toggle(r.rank, it.cap, e.target.checked)}
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
            ระบบตรวจสิทธิ์ซ้ำที่เซิร์ฟเวอร์ทุกครั้งที่บันทึกข้อมูล · คุณอยู่ตำแหน่ง {ranks.find((r) => r.rank === myRole)?.label || rankLabel(myRole)} · Role {SYSTEM_ROLE_LABEL[systemRoleOf(userData)]}
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
