/**
 * StaffPanel — ทะเบียนพนักงาน (เพิ่ม / แก้ไข / ลบ บัญชีผู้ใช้ · Rank · ตำแหน่งในเอกสาร)
 *
 * ✅ v3 (ผู้ใช้สั่ง 2 ต.ค. 2569 "ปรับ UI ใหม่ทั้งหมด ให้ดูสวยงามมืออาชีพ" + กฎ 6 ข้อ:
 *    สีน้อย · ตัวอักษรชัด · ช่องว่างพอดี · จัดแนวแม่น · component เหมือนหน้าอื่น · กดแล้วเดาได้)
 *   เดิม: การ์ดสถิติแถบไล่สี + ไอคอนสีจัด 3 ใบเรียงยาวเต็มจอมือถือ · ปุ่มเพิ่มสีเขียว · ป้ายสิทธิ์ 7 สี ·
 *         ต้องกดลูกศรกางแถวถึงจะเห็นตำแหน่ง/ชื่อผู้ใช้
 *   ตอนนี้ (ชิ้นส่วนจาก shared/ui/PageKit — หน้าตาเดียวกับหน้าใบเบิก/ใบขอซื้อ/ใบเสนอราคา):
 *         หัวเพจ + ปุ่มหลักสีเข้ม → ตัวเลขสรุป → ค้นหา + กรอง Rank → ตาราง (ข้อมูลครบในแถวเดียว ไม่ต้องกาง)
 *         มือถือ = การ์ดต่อคน (กดเบอร์โทรออกได้เลย) · ป้าย Rank พื้นเทา + จุดสี
 *   ✅ คงพฤติกรรมเดิมครบ: ยืนยันรหัสผ่านก่อนเพิ่มผู้ใช้/เปลี่ยน Rank · ตั้ง/แก้บัญชีที่สูงกว่าตัวเองไม่ได้ ·
 *      อัปเดต session ถ้าแก้บัญชีตัวเอง · เรียลไทม์
 */
import { useEffect, useMemo, useState } from "react";
import useRealtime from "@/shared/realtime/useRealtime";
import AuthService from "@/shared/services/authService";
import API from "@/shared/api/axiosInstance";
import Swal from "sweetalert2";

import {
  TextField, Button, Snackbar, Alert, Box, Stack, Typography, Avatar, IconButton, Tooltip, Skeleton,
  useMediaQuery, Table, TableBody, TableCell, TableHead, TableRow, TableSortLabel, Pagination,
  MenuItem, Dialog, DialogContent, DialogActions,
} from "@mui/material";
import {
  Add, Edit, DeleteOutline, Close, Badge as BadgeIcon, Phone, Email, ContentCopy, VpnKey, WarningAmber,
} from "@mui/icons-material";

import { useAuth } from "@/features/auth/AuthContext";
import {
  ALL_ROLES, ROLES, isRole, canAssignRole, canManageUserOfRole, TECHNICIAN_ROLES, rankLabel,
  systemRoleOf, SYSTEM_ROLES, SYSTEM_ROLE_LABEL, titleOf,
} from "@/shared/utils/roles";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import SelectField from "@/shared/ui/SelectField";
import {
  PageHeader, Kpi, KpiRow, FilterBar, Panel, EmptyState, DotLabel, INK, INK_2, MUTED, FAINT, LINE, SURFACE, DANGER,
  CARD_SHADOW, TABLE_HEAD_SX, TABLE_ROW_SX, PRIMARY_BTN_SX,
} from "@/shared/ui/PageKit";

/** สีจุดของ Rank — ไล่ระดับเข้มตามลำดับชั้น (ใช้เป็นจุดเล็กๆ เท่านั้น) */
const RANK_DOT = {
  [ROLES.DIRECTOR]: "#0f172a",
  [ROLES.MANAGER]: "#334155",
  [ROLES.ADMIN]: "#475569",
  [ROLES.TECH_LEAD]: "#2563eb",
  [ROLES.TECHNICIAN]: "#60a5fa",
  [ROLES.SALE]: "#8b5cf6",
  [ROLES.USER]: "#cbd5e1",
};

/**
 * ป้าย Rank ของคนนั้น — ⚠️ ค่าที่ระบบไม่รู้จัก (ข้อมูลเก่าสะกดผิด) ต้องเตือนให้เห็น ไม่งั้นบัญชีนั้นจะถูก
 * ปฏิเสธเงียบๆ ทุกหน้าโดยไม่มีใครรู้สาเหตุ · ชื่ออ่านสดด้วย rankLabel() (องค์กรเปลี่ยนชื่อ Rank ได้)
 */
const rankMetaOf = (role) => {
  const key = String(role || "").trim().toLowerCase();
  if (RANK_DOT[key]) return { label: rankLabel(key), color: RANK_DOT[key] };
  return { label: key ? `Rank ไม่ถูกต้อง (${role})` : "ยังไม่กำหนด Rank", color: DANGER, invalid: true };
};

const EMPTY_FORM = { fname: "", lname: "", tel: "", email: "", username: "", password: "", role: "", jobTitle: "" };
const fullNameOf = (u) => `${u.fname || ""} ${u.lname || ""}`.trim();

const COLUMNS = [
  { id: "fname", label: "พนักงาน", sortable: true },
  { id: "jobTitle", label: "ตำแหน่ง (ในเอกสาร)", sortable: false },
  { id: "role", label: "Rank", sortable: true },
  { id: "tel", label: "เบอร์โทร", sortable: true },
  { id: "email", label: "อีเมล", sortable: true },
  { id: "actions", label: "", sortable: false, align: "right" },
];

const comparator = (a, b, orderBy) => {
  const av = (orderBy === "role" ? rankLabel(a.role) : a[orderBy] || "").toString().toLowerCase();
  const bv = (orderBy === "role" ? rankLabel(b.role) : b[orderBy] || "").toString().toLowerCase();
  return av.localeCompare(bv, "th");
};
const getComparator = (order, orderBy) => (order === "desc" ? (a, b) => -comparator(a, b, orderBy) : (a, b) => comparator(a, b, orderBy));

const FIELD_SX = { "& .MuiOutlinedInput-root": { borderRadius: 2 } };
const Label = ({ children }) => <Typography sx={{ fontSize: "0.76rem", fontWeight: 800, color: MUTED, mb: 1 }}>{children}</Typography>;

// ─── ฟอร์มเพิ่ม/แก้ไข ──────────────────────────────────────────────────────
const EmployeeFormDialog = ({ open, mode, data, onChange, onClose, onSubmit, fullScreen, me }) => (
  <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen} PaperProps={{ sx: { borderRadius: fullScreen ? 0 : 3 } }}>
    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2.5, py: 1.75, borderBottom: `1px solid ${LINE}` }}>
      <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: SURFACE, border: `1px solid ${LINE}`, display: "flex", alignItems: "center", justifyContent: "center", color: INK_2 }}>
        {mode === "add" ? <Add sx={{ fontSize: 20 }} /> : <Edit sx={{ fontSize: 18 }} />}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 900, fontSize: "1.02rem", color: INK }}>{mode === "add" ? "เพิ่มผู้ใช้ใหม่" : "แก้ไขข้อมูลผู้ใช้"}</Typography>
        <Typography noWrap sx={{ fontSize: "0.76rem", color: MUTED }}>{mode === "add" ? "กรอกข้อมูลให้ครบทุกช่องที่มี *" : fullNameOf(data) || data.username}</Typography>
      </Box>
      <IconButton size="small" aria-label="ปิด" onClick={onClose}><Close /></IconButton>
    </Stack>
    <DialogContent sx={{ px: 2.5, py: 2.25 }}>
      <Label>ข้อมูลส่วนตัว</Label>
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, mb: 2.5 }}>
        <TextField label="ชื่อ *" name="fname" size="small" value={data.fname || ""} onChange={onChange} sx={FIELD_SX} />
        <TextField label="นามสกุล *" name="lname" size="small" value={data.lname || ""} onChange={onChange} sx={FIELD_SX} />
        <TextField label="เบอร์โทร *" name="tel" size="small" value={data.tel || ""} onChange={onChange} inputProps={{ maxLength: 10, inputMode: "tel" }} helperText="ตัวเลข 10 หลัก" sx={FIELD_SX} />
        <TextField label="อีเมล *" name="email" size="small" value={data.email || ""} onChange={onChange} inputProps={{ inputMode: "email" }} sx={FIELD_SX} />
      </Box>
      <Label>บัญชีผู้ใช้และตำแหน่ง</Label>
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
        <TextField label="ชื่อผู้ใช้ (ใช้เข้าระบบ) *" name="username" size="small" value={data.username || ""} onChange={onChange} sx={FIELD_SX} />
        {mode === "add" && (
          <TextField label="รหัสผ่าน *" name="password" type="password" size="small" value={data.password || ""} onChange={onChange} helperText="อย่างน้อย 6 ตัวอักษร" sx={FIELD_SX} />
        )}
        {/* 🔒 ตั้ง Rank ที่สูงกว่าตัวเองไม่ได้ (server บังคับซ้ำ ดู da-app-server/src/routes/auth.js) */}
        <TextField select label="Rank · ตำแหน่งในองค์กร *" name="role" size="small" value={data.role || ""} onChange={onChange} sx={FIELD_SX}>
          {ALL_ROLES.filter((r) => canAssignRole(me, r)).map((r) => <MenuItem key={r} value={r}>{rankLabel(r)}</MenuItem>)}
        </TextField>
        {mode === "add" && (
          <TextField label="ตำแหน่งที่พิมพ์ในเอกสาร" name="jobTitle" size="small" value={data.jobTitle || ""} onChange={onChange} helperText="เว้นว่าง = ใช้ชื่อ Rank" sx={FIELD_SX} />
        )}
      </Box>
    </DialogContent>
    <DialogActions sx={{ px: 2.5, py: 1.75, borderTop: `1px solid ${LINE}` }}>
      <Button onClick={onClose} sx={{ textTransform: "none", fontWeight: 700, color: MUTED }}>ยกเลิก</Button>
      <Button variant="contained" onClick={onSubmit} sx={PRIMARY_BTN_SX}>{mode === "add" ? "ถัดไป: ยืนยันรหัสผ่าน" : "บันทึกการแก้ไข"}</Button>
    </DialogActions>
  </Dialog>
);

// ─── ยืนยันรหัสผ่าน (เพิ่มผู้ใช้ / เปลี่ยน Rank) ───────────────────────────────
const PasswordConfirmDialog = ({ open, value, onChange, onClose, onConfirm, title, description, confirmLabel = "ยืนยัน", busy = false }) => (
  <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
    <DialogContent sx={{ px: 2.5, pt: 2.5 }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 2 }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 2, flexShrink: 0, bgcolor: SURFACE, border: `1px solid ${LINE}`, display: "flex", alignItems: "center", justifyContent: "center", color: INK_2 }}>
          <VpnKey sx={{ fontSize: 18 }} />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 900, fontSize: "1rem", color: INK }}>{title}</Typography>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 0.25 }}>{description}</Typography>
        </Box>
      </Stack>
      <TextField label="รหัสผ่านของคุณ" type="password" fullWidth size="small" autoFocus value={value} onChange={onChange}
        onKeyDown={(e) => { if (e.key === "Enter" && !busy) onConfirm(); }} sx={FIELD_SX} />
    </DialogContent>
    <DialogActions sx={{ px: 2.5, pb: 2 }}>
      <Button onClick={onClose} sx={{ textTransform: "none", fontWeight: 700, color: MUTED }}>ยกเลิก</Button>
      <Button variant="contained" disabled={busy} onClick={onConfirm} sx={PRIMARY_BTN_SX}>{busy ? "กำลังตรวจสอบ..." : confirmLabel}</Button>
    </DialogActions>
  </Dialog>
);

/** ป้าย Rank + Role ในระบบ (แสดง Role เฉพาะคนที่ดูแลระบบได้ — Member ไม่ต้องแสดง) */
const RankCell = ({ row }) => {
  const meta = rankMetaOf(row.role);
  const sys = systemRoleOf(row);
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
      {meta.invalid ? (
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontSize: "0.72rem", fontWeight: 800, color: DANGER }}>
          <WarningAmber sx={{ fontSize: 15 }} />{meta.label}
        </Box>
      ) : <DotLabel color={meta.color}>{meta.label}</DotLabel>}
      {sys !== SYSTEM_ROLES.MEMBER && (
        <Box component="span" sx={{ fontSize: "0.68rem", fontWeight: 800, color: MUTED, px: 0.75, height: 20, display: "inline-flex", alignItems: "center", border: `1px solid ${LINE}`, borderRadius: 1 }}>
          {SYSTEM_ROLE_LABEL[sys]}
        </Box>
      )}
    </Stack>
  );
};

const Person = ({ row, size = 34 }) => {
  const name = fullNameOf(row) || row.username || "-";
  return (
    <Stack direction="row" spacing={1.1} alignItems="center" sx={{ minWidth: 0 }}>
      <Avatar sx={{ width: size, height: size, fontSize: size * 0.4, fontWeight: 800, bgcolor: personColor(name), flexShrink: 0 }}>{personInitial(name)}</Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography noWrap sx={{ fontWeight: 800, fontSize: "0.88rem", color: INK, lineHeight: 1.3 }}>{name}</Typography>
        <Typography noWrap sx={{ fontSize: "0.72rem", color: MUTED, lineHeight: 1.3 }}>@{row.username || "-"}</Typography>
      </Box>
    </Stack>
  );
};

/** ปุ่มแก้/ลบ — 🔒 บัญชีระดับสูงกว่าตัวเองกดไม่ได้ พร้อมบอกเหตุผล (ดีกว่ากดแล้วโดน server ปฏิเสธ) */
const RowActions = ({ row, me, onEdit, onDelete }) => {
  const manageable = canManageUserOfRole(me, row.role);
  const hint = `ต้องให้ผู้จัดการเป็นคนจัดการบัญชีระดับ${rankMetaOf(row.role).label}`;
  return (
    <Stack direction="row" spacing={0.25} justifyContent="flex-end">
      <Tooltip title={manageable ? "แก้ไข" : hint} describeChild>
        <span><IconButton size="small" aria-label="แก้ไข" disabled={!manageable} onClick={(e) => { e.stopPropagation(); onEdit(row); }} sx={{ color: INK_2 }}><Edit sx={{ fontSize: 18 }} /></IconButton></span>
      </Tooltip>
      <Tooltip title={manageable ? "ลบ" : hint} describeChild>
        <span><IconButton size="small" aria-label="ลบ" disabled={!manageable} onClick={(e) => { e.stopPropagation(); onDelete(row._id); }} sx={{ color: MUTED, "&:hover": { color: DANGER } }}><DeleteOutline sx={{ fontSize: 19 }} /></IconButton></span>
      </Tooltip>
    </Stack>
  );
};

const CopyBtn = ({ text, label, onCopy }) => (
  <Tooltip title={`คัดลอก${label}`}>
    <IconButton size="small" aria-label={`คัดลอก${label}`} onClick={(e) => { e.stopPropagation(); onCopy(text, label); }} sx={{ p: 0.4, color: FAINT, "&:hover": { color: INK_2 } }}>
      <ContentCopy sx={{ fontSize: 14 }} />
    </IconButton>
  </Tooltip>
);

const Employee = () => {
  const isSmallScreen = useMediaQuery("(max-width:600px)");
  // ✅ แท็บเล็ตใช้การ์ดเหมือนมือถือ — ตารางกว้าง 900px บนจอ 820px ต้องเลื่อนข้างถึงจะเห็นปุ่มแก้ไข/ลบ
  const useCards = useMediaQuery("(max-width:899px)");
  const { userData, updateUserData } = useAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [rankFilter, setRankFilter] = useState("all");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [modalOpenInsert, setModalOpenInsert] = useState(false);
  const [modalOpenEdit, setModalOpenEdit] = useState(false);
  const [modalOpenPasswordConfirm, setModalOpenPasswordConfirm] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editedData, setEditedData] = useState({});
  const [newUserData, setNewUserData] = useState(EMPTY_FORM);
  const [passwordConfirm, setPasswordConfirm] = useState("");
  /** คำขอเปลี่ยนสิทธิ์ที่รอการยืนยันด้วยรหัสผ่าน (null = กล่องรหัสผ่านนี้ใช้กับการเพิ่มผู้ใช้) */
  const [pendingRoleChange, setPendingRoleChange] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [alert, setAlert] = useState({ open: false, message: "", severity: "info" });

  // ตาราง: เรียงลำดับ + pagination
  const [order, setOrder] = useState("asc");
  const [orderBy, setOrderBy] = useState("fname");
  const [page, setPage] = useState(0);
  const rowsPerPage = 10;

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const getAllUser = await AuthService.getAllUserData();
      setUsers(getAllUser.allUser || []);
    } catch (error) {
      console.error("Error fetching user data:", error);
      if (!silent) setAlert({ open: true, message: "โหลดข้อมูลผู้ใช้ไม่สำเร็จ", severity: "error" });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // ✅ เรียลไทม์: เพิ่ม/แก้สิทธิ์/ลบพนักงานจากเครื่องอื่น → ทะเบียนอัปเดตทันที
  useRealtime("users", () => { fetchUsers(true); });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewUserData(p => ({ ...p, [name]: name === "tel" ? value.replace(/[^0-9]/g, "") : value }));
  };

  const handleChangeEdit = (e) => {
    const { name, value } = e.target;
    setEditedData(p => ({ ...p, [name]: name === "tel" ? value.replace(/[^0-9]/g, "") : value }));
  };

  const validateForm = () => {
    const { fname, lname, tel, email, username, password, role } = newUserData;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const telRegex = /^[0-9]{10}$/;

    if (!fname || !lname || !tel || !email || !username || !password || !role) {
      setAlert({ open: true, message: "กรุณากรอกข้อมูลให้ครบทุกช่อง!", severity: "error" });
      return false;
    }
    if (!emailRegex.test(email)) {
      setAlert({ open: true, message: "กรุณากรอกอีเมลให้ถูกต้อง!", severity: "error" });
      return false;
    }
    if (!telRegex.test(tel)) {
      setAlert({ open: true, message: "เบอร์โทรต้องเป็นตัวเลข 10 หลัก!", severity: "error" });
      return false;
    }
    if (password.length < 6) {
      setAlert({ open: true, message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร!", severity: "error" });
      return false;
    }
    if (!ALL_ROLES.includes(role)) {
      setAlert({ open: true, message: "กรุณาเลือกสิทธิ์ของผู้ใช้!", severity: "error" });
      return false;
    }
    return true;
  };

  const validateEditForm = () => {
    const { fname, lname, tel, email, username, role } = editedData;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const telRegex = /^[0-9]{10}$/;

    if (!fname || !lname || !tel || !email || !username || !role) {
      setAlert({ open: true, message: "กรุณากรอกข้อมูลให้ครบทุกช่อง!", severity: "error" });
      return false;
    }
    if (!emailRegex.test(email)) {
      setAlert({ open: true, message: "กรุณากรอกอีเมลให้ถูกต้อง!", severity: "error" });
      return false;
    }
    if (!telRegex.test(tel)) {
      setAlert({ open: true, message: "เบอร์โทรต้องเป็นตัวเลข 10 หลัก!", severity: "error" });
      return false;
    }
    if (!ALL_ROLES.includes(role)) {
      setAlert({ open: true, message: "กรุณาเลือกสิทธิ์ของผู้ใช้!", severity: "error" });
      return false;
    }
    return true;
  };

  const validateAdminPassword = async () => {
    try {
      // ✅ server ตรวจกับบัญชีของคนที่ล็อกอินอยู่ (req.userId) — เดิมส่งอีเมลตายตัวของแอดมินคนหนึ่งไปด้วยโดยไม่ได้ใช้
      const response = await API.post("/auth/validate-password", { password: passwordConfirm });
      if (!response.data.valid) {
        Swal.fire({
          title: "รหัสผ่านไม่ถูกต้อง!",
          text: "กรุณาลองใหม่",
          icon: "error",
          willOpen: () => { document.querySelector(".swal2-container").style.zIndex = 1500; },
          customClass: { popup: "swal2-front" },
        });
        return false;
      }
      return true;
    } catch (error) {
      console.error("Error validating admin password:", error);
      Swal.fire({
        title: "เกิดข้อผิดพลาด!",
        text: "ไม่สามารถตรวจสอบรหัสผ่านได้",
        icon: "error",
        willOpen: () => { document.querySelector(".swal2-container").style.zIndex = 1500; },
        customClass: { popup: "swal2-front" },
      });
      return false;
    }
  };

  const handleOpenPasswordConfirmModal = () => {
    if (!validateForm()) return;
    setModalOpenInsert(false);
    setModalOpenPasswordConfirm(true);
  };

  const handleAddUser = async () => {
    const isPasswordValid = await validateAdminPassword();
    if (!isPasswordValid) return;

    try {
      const requestData = {
        fname: newUserData.fname.trim(),
        lname: newUserData.lname.trim(),
        tel: newUserData.tel.trim(),
        email: newUserData.email.trim(),
        username: newUserData.username.trim(),
        password: newUserData.password.trim(),
        role: newUserData.role.trim(),
        jobTitle: (newUserData.jobTitle || "").trim(),
      };

      const response = await API.post("/auth/signup", requestData);

      if (response.data) {
        await fetchUsers();
        setModalOpenPasswordConfirm(false);
        setNewUserData(EMPTY_FORM);
        setPasswordConfirm("");

        Swal.fire({
          title: "สำเร็จ!",
          text: "เพิ่มผู้ใช้สำเร็จ!",
          icon: "success",
          willOpen: () => { document.querySelector(".swal2-container").style.zIndex = 1500; },
          customClass: { popup: "swal2-front" },
        });
      }
    } catch (error) {
      console.error("Error adding user:", error);
      const errorMessage = error.response?.data?.err || "เกิดข้อผิดพลาดในการเพิ่มผู้ใช้!";
      Swal.fire({
        title: "เกิดข้อผิดพลาด!",
        text: errorMessage,
        icon: "error",
        willOpen: () => { document.querySelector(".swal2-container").style.zIndex = 1500; },
        customClass: { popup: "swal2-front" },
      });
    }
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setEditedData({
      _id: user._id,
      fname: user.fname,
      lname: user.lname,
      tel: user.tel,
      email: user.email,
      username: user.username,
      role: user.role,
    });
    setModalOpenEdit(true);
  };

  /**
   * ✅ ผู้ใช้สั่ง: "เปลี่ยนสิทธิ์ต้องกรอกรหัสผ่านของ user ที่เปลี่ยนเพื่อยืนยัน"
   * — การให้/ถอดอำนาจในระบบต้องยืนยันตัวตนซ้ำ กันเครื่องที่เปิดทิ้งไว้ถูกใช้ยกระดับสิทธิ์
   * ⚠️ กล่องนี้เป็นแค่ UX — server ตรวจรหัสผ่านซ้ำเสมอ (ยิง API ตรงโดยไม่ผ่านหน้าจอก็ไม่รอด)
   */
  const handleEditUser = async () => {
    if (!validateEditForm()) return;
    if (!editedData._id) {
      Swal.fire({ title: "เกิดข้อผิดพลาด!", text: "ไม่พบข้อมูลผู้ใช้ที่ต้องการแก้ไข", icon: "error" });
      return;
    }
    // ⚠️ ส่ง role ไปเฉพาะตอนที่ "เปลี่ยนจริง" — การส่งสิทธิ์เดิมติดไปทุกครั้งทำให้คำขอธรรมดา
    // (แก้ชื่อ/เบอร์) กลายเป็น "คำขอเปลี่ยนสิทธิ์" ในสายตา server โดยไม่จำเป็น
    const payload = { ...editedData };
    const roleChanged = Boolean(selectedUser) && String(payload.role || "") !== String(selectedUser.role || "");
    if (!roleChanged) delete payload.role;

    if (roleChanged) {
      setPendingRoleChange(payload);
      setPasswordConfirm("");
      setModalOpenEdit(false);
      setModalOpenPasswordConfirm(true);
      return;
    }
    await submitUserUpdate(payload);
  };

  /** ยิงคำขอแก้ไขจริง — confirmPassword จะมีเฉพาะตอนเปลี่ยนสิทธิ์ */
  const submitUserUpdate = async (payload, confirmPassword) => {
    try {
      const response = await API.put(`/auth/user/${payload._id}`, confirmPassword ? { ...payload, confirmPassword } : payload);
      if (response.status === 200) {
        const { user, token } = response.data;

        if (userData && user._id && userData.userId && user._id.toString() === userData.userId.toString()) {
          localStorage.setItem("token", token);
          localStorage.setItem("payload", JSON.stringify(user));
          updateUserData(user);
        }

        setModalOpenEdit(false);
        setModalOpenPasswordConfirm(false);
        setPendingRoleChange(null);
        setPasswordConfirm("");
        setSelectedUser(null);
        setEditedData({});
        await fetchUsers();

        Swal.fire({ title: "สำเร็จ!", text: "อัปเดตข้อมูลผู้ใช้เรียบร้อย", icon: "success" });
      }
    } catch (error) {
      console.error("Error updating user:", error);
      // ⚠️ ต้องโชว์เหตุผลจาก server เสมอ — กฎเรื่องสิทธิ์ (เช่น "เปลี่ยนสิทธิ์ของตัวเองไม่ได้")
      // ถ้ากลืนเป็นข้อความกลางๆ ผู้ใช้จะไม่รู้เลยว่าติดอะไรและต้องทำอย่างไรต่อ
      Swal.fire({
        title: "เกิดข้อผิดพลาด!",
        text: error?.response?.data?.message || "ไม่สามารถอัปเดตข้อมูลผู้ใช้ได้",
        icon: "error",
        // ⚠️ กล่องรหัสผ่านเป็น Modal ซ้อนอยู่ — ถ้าไม่ดัน z-index ข้อความ error จะโผล่ใต้กล่อง
        willOpen: () => { const c = document.querySelector(".swal2-container"); if (c) c.style.zIndex = 1500; },
      });
    }
  };

  /** กดยืนยันในกล่องรหัสผ่าน — ตัดสินจากงานที่ค้างอยู่ว่าเป็น "เพิ่มผู้ใช้" หรือ "เปลี่ยนสิทธิ์" */
  const handlePasswordConfirm = async () => {
    if (!passwordConfirm.trim()) {
      setAlert({ open: true, message: "กรุณากรอกรหัสผ่านของคุณ", severity: "error" });
      return;
    }
    if (pendingRoleChange) {
      setConfirmBusy(true);
      try {
        await submitUserUpdate(pendingRoleChange, passwordConfirm.trim());
      } finally {
        setConfirmBusy(false);
      }
      return;
    }
    await handleAddUser();
  };

  const handleDeleteRow = async (userId) => {
    Swal.fire({
      title: "คุณแน่ใจหรือไม่?",
      text: "เมื่อลบแล้วจะไม่สามารถกู้คืนข้อมูลได้!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "ใช่, ลบเลย!",
      cancelButtonText: "ยกเลิก",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const response = await API.delete(`/auth/user/${userId}`);
          if (response.status === 200) {
            await fetchUsers();
            Swal.fire("ลบสำเร็จ!", "ผู้ใช้ถูกลบออกจากระบบแล้ว", "success");
          }
        } catch (error) {
          console.error("Error deleting user:", error);
          Swal.fire("เกิดข้อผิดพลาด!", "ไม่สามารถลบผู้ใช้ได้", "error");
        }
      }
    });
  };

  const handleCopy = (text, label) => {
    if (!text) return;
    navigator.clipboard?.writeText(text)
      .then(() => setAlert({ open: true, message: `คัดลอก${label}แล้ว`, severity: "success" }))
      .catch(() => setAlert({ open: true, message: "คัดลอกไม่สำเร็จ", severity: "error" }));
  };

  const handleSort = (field) => {
    const isAsc = orderBy === field && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(field);
  };


  // ─── Derived data ──────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    const lowerSearch = searchTerm.trim().toLowerCase();
    return users.filter((user) => {
      if (rankFilter === "admin" && !isRole(user, ROLES.DIRECTOR, ROLES.ADMIN, ROLES.MANAGER)) return false;
      if (rankFilter === "staff" && !isRole(user, ...TECHNICIAN_ROLES, ROLES.SALE)) return false;
      if (rankFilter === "invalid" && !rankMetaOf(user.role).invalid) return false;
      if (rankFilter.startsWith("r:") && String(user.role || "").toLowerCase() !== rankFilter.slice(2)) return false;
      return !lowerSearch || [user.fname, user.lname, fullNameOf(user), user.email, user.tel, user.username, titleOf(user)]
        .some((v) => String(v || "").toLowerCase().includes(lowerSearch));
    });
  }, [users, searchTerm, rankFilter]);

  const sortedUsers = useMemo(
    () => filteredUsers.slice().sort(getComparator(order, orderBy)),
    [filteredUsers, order, orderBy]
  );

  useEffect(() => { setPage(0); }, [searchTerm, rankFilter]);

  const stats = useMemo(() => {
    const total = users.length;
    const admin = users.filter((u) => isRole(u, ROLES.DIRECTOR, ROLES.ADMIN, ROLES.MANAGER)).length;
    const staff = users.filter((u) => isRole(u, ...TECHNICIAN_ROLES, ROLES.SALE)).length;
    const invalid = users.filter((u) => rankMetaOf(u.role).invalid).length;
    return { total, admin, staff, invalid };
  }, [users]);


  const pageCount = Math.max(1, Math.ceil(sortedUsers.length / rowsPerPage));
  const cur = Math.min(page, pageCount - 1);
  const pageRows = sortedUsers.slice(cur * rowsPerPage, cur * rowsPerPage + rowsPerPage);
  const openAdd = () => { setNewUserData(EMPTY_FORM); setModalOpenInsert(true); };

  return (
    <>
      <Box sx={{ p: { xs: 1.25, sm: 2.5 }, maxWidth: 1400, mx: "auto" }}>
        <PageHeader
          icon={<BadgeIcon />}
          title="ทะเบียนพนักงาน"
          subtitle="บัญชีผู้ใช้ · Rank (ตำแหน่งในองค์กร) · ตำแหน่งที่พิมพ์ในเอกสาร"
          actions={(
            <Button variant="contained" startIcon={<Add />} onClick={openAdd} sx={{ ...PRIMARY_BTN_SX, height: 40, px: { xs: 1.5, sm: 2 } }}>
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>เพิ่มผู้ใช้</Box>
              <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>เพิ่ม</Box>
            </Button>
          )}
        />

        {loading ? (
          <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, mb: 1.5 }}>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={76} sx={{ borderRadius: 2.5 }} />)}
          </Box>
        ) : (
          <KpiRow columns={4}>
            <Kpi label="ผู้ใช้ทั้งหมด" value={`${stats.total} คน`} onClick={() => setRankFilter("all")} active={rankFilter === "all"} />
            <Kpi label="ผู้บริหาร / แอดมิน" value={`${stats.admin} คน`} sub="กรรมการ · ผู้จัดการ · แอดมิน" onClick={() => setRankFilter("admin")} active={rankFilter === "admin"} />
            <Kpi label="ทีมช่าง / เซล" value={`${stats.staff} คน`} onClick={() => setRankFilter("staff")} active={rankFilter === "staff"} />
            <Kpi label="Rank ไม่ถูกต้อง" value={`${stats.invalid} คน`} sub={stats.invalid ? "บัญชีจะใช้งานไม่ได้ — กดแก้ไข" : "ทุกบัญชีถูกต้อง"} alert={stats.invalid > 0}
              onClick={stats.invalid ? () => setRankFilter("invalid") : undefined} active={rankFilter === "invalid"} />
          </KpiRow>
        )}

        <FilterBar search={searchTerm} onSearch={setSearchTerm} placeholder="ค้นหาชื่อ / ชื่อผู้ใช้ / อีเมล / เบอร์โทร">
          <SelectField label="Rank" value={rankFilter} onChange={(e) => setRankFilter(e.target.value)} sx={{ minWidth: { xs: 0, sm: 200 }, flex: { xs: 1, sm: "none" } }}>
            <option value="all">ทุก Rank ({users.length})</option>
            <option value="admin">ผู้บริหาร / แอดมิน</option>
            <option value="staff">ทีมช่าง / เซล</option>
            {ALL_ROLES.map((r) => <option key={r} value={`r:${r}`}>{rankLabel(r)}</option>)}
            {stats.invalid > 0 && <option value="invalid">Rank ไม่ถูกต้อง ({stats.invalid})</option>}
          </SelectField>
        </FilterBar>

        {loading ? (
          <Stack spacing={1}>{[1, 2, 3, 4].map((i) => <Skeleton key={i} variant="rounded" height={useCards ? 120 : 56} sx={{ borderRadius: 2.5 }} />)}</Stack>
        ) : filteredUsers.length === 0 ? (
          <EmptyState icon={<BadgeIcon />}
            title={searchTerm || rankFilter !== "all" ? "ไม่พบผู้ใช้ตามตัวกรอง" : "ยังไม่มีผู้ใช้"}
            hint={searchTerm || rankFilter !== "all" ? "ลองเปลี่ยนคำค้นหาหรือ Rank" : "กด \"เพิ่มผู้ใช้\" เพื่อเริ่มต้น"}
            action={!searchTerm && rankFilter === "all" ? <Button variant="contained" startIcon={<Add />} onClick={openAdd} sx={PRIMARY_BTN_SX}>เพิ่มผู้ใช้</Button> : null} />
        ) : useCards ? (
          <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
            {pageRows.map((row) => (
              <Box key={row._id} sx={{ p: 1.5, bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, boxShadow: CARD_SHADOW }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ flex: 1, minWidth: 0 }}><Person row={row} /></Box>
                  <RowActions row={row} me={userData} onEdit={openEditModal} onDelete={handleDeleteRow} />
                </Stack>
                <Box sx={{ mt: 1.25, pt: 1.25, borderTop: `1px solid ${LINE}`, display: "grid", gap: 0.75 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                    <RankCell row={row} />
                    {titleOf(row) && titleOf(row) !== rankMetaOf(row.role).label && (
                      <Typography noWrap sx={{ fontSize: "0.76rem", color: MUTED, minWidth: 0 }}>{titleOf(row)}</Typography>
                    )}
                  </Stack>
                  {row.tel && (
                    <Typography component="a" href={`tel:${row.tel}`} sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK_2, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 0.75 }}>
                      <Phone sx={{ fontSize: 16, color: MUTED }} />{row.tel}
                    </Typography>
                  )}
                  {row.email && (
                    <Typography component="a" href={`mailto:${row.email}`} noWrap sx={{ fontSize: "0.8rem", color: INK_2, textDecoration: "none", display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                      <Email sx={{ fontSize: 16, color: MUTED, flexShrink: 0 }} /><Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>{row.email}</Box>
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        ) : (
          <Panel sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 900, ...TABLE_HEAD_SX }}>
              <TableHead>
                <TableRow>
                  {COLUMNS.map((c) => (
                    <TableCell key={c.id} align={c.align || "left"} sx={c.id === "actions" ? { width: 96 } : undefined}>
                      {c.sortable ? (
                        <TableSortLabel active={orderBy === c.id} direction={orderBy === c.id ? order : "asc"} onClick={() => handleSort(c.id)}>{c.label}</TableSortLabel>
                      ) : c.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {pageRows.map((row) => (
                  <TableRow key={row._id} hover sx={TABLE_ROW_SX}>
                    <TableCell sx={{ maxWidth: 260 }}><Person row={row} /></TableCell>
                    <TableCell sx={{ maxWidth: 220 }}><Typography noWrap sx={{ fontSize: "0.84rem", color: titleOf(row) ? INK : FAINT }}>{titleOf(row) || "—"}</Typography></TableCell>
                    <TableCell><RankCell row={row} /></TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {row.tel ? (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Typography sx={{ fontSize: "0.84rem", color: INK, fontVariantNumeric: "tabular-nums" }}>{row.tel}</Typography>
                          <CopyBtn text={row.tel} label="เบอร์โทร" onCopy={handleCopy} />
                        </Stack>
                      ) : <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>—</Typography>}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 260 }}>
                      {row.email ? (
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
                          <Typography noWrap sx={{ fontSize: "0.84rem", color: INK, minWidth: 0 }}>{row.email}</Typography>
                          <CopyBtn text={row.email} label="อีเมล" onCopy={handleCopy} />
                        </Stack>
                      ) : <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>—</Typography>}
                    </TableCell>
                    <TableCell align="right"><RowActions row={row} me={userData} onEdit={openEditModal} onDelete={handleDeleteRow} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}

        {!loading && filteredUsers.length > 0 && (
          <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" spacing={1} sx={{ mt: 1.5 }}>
            <Typography sx={{ flex: 1, fontSize: "0.76rem", color: MUTED }}>
              {pageCount > 1 ? `แสดง ${cur * rowsPerPage + 1}–${cur * rowsPerPage + pageRows.length} จาก ` : ""}{filteredUsers.length} คน
            </Typography>
            {pageCount > 1 && (
              <Pagination count={pageCount} page={cur + 1} onChange={(_, n) => setPage(n - 1)} shape="rounded" size={isSmallScreen ? "small" : "medium"}
                sx={{ "& .Mui-selected": { bgcolor: `${INK_2} !important`, color: "#fff" } }} />
            )}
          </Stack>
        )}
      </Box>

      <EmployeeFormDialog open={modalOpenInsert} mode="add" data={newUserData} onChange={handleChange}
        onClose={() => setModalOpenInsert(false)} onSubmit={handleOpenPasswordConfirmModal} fullScreen={isSmallScreen} me={userData} />
      <EmployeeFormDialog open={modalOpenEdit} mode="edit" data={editedData} onChange={handleChangeEdit}
        onClose={() => setModalOpenEdit(false)} onSubmit={handleEditUser} fullScreen={isSmallScreen} me={userData} />
      <PasswordConfirmDialog
        open={modalOpenPasswordConfirm}
        value={passwordConfirm}
        onChange={(e) => setPasswordConfirm(e.target.value)}
        onClose={() => { setModalOpenPasswordConfirm(false); setPendingRoleChange(null); setPasswordConfirm(""); }}
        onConfirm={handlePasswordConfirm}
        busy={confirmBusy}
        title={pendingRoleChange ? "ยืนยันการเปลี่ยน Rank" : "ยืนยันรหัสผ่าน"}
        description={pendingRoleChange
          ? `เปลี่ยน Rank ของ ${[pendingRoleChange.fname, pendingRoleChange.lname].filter(Boolean).join(" ")} เป็น "${rankLabel(pendingRoleChange.role)}" — กรอกรหัสผ่านของคุณเพื่อยืนยัน`
          : "กรอกรหัสผ่านของคุณเพื่อยืนยันการเพิ่มผู้ใช้ใหม่"}
        confirmLabel={pendingRoleChange ? "ยืนยันเปลี่ยน Rank" : "เพิ่มผู้ใช้"}
      />

      <Snackbar open={alert.open} autoHideDuration={2500} onClose={() => setAlert((p) => ({ ...p, open: false }))} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={alert.severity} variant="filled" onClose={() => setAlert((p) => ({ ...p, open: false }))} sx={{ borderRadius: 2, fontWeight: 600 }}>{alert.message}</Alert>
      </Snackbar>
    </>
  );
};

export default Employee;
