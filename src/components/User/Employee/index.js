/* eslint-disable no-unused-vars */
/**
 * Employee/index.js — v2
 *
 * เปลี่ยนจากเดิม:
 *   ❌ ตัดการใช้ DataTableComponent / DataTableColumns / Expanded (react-data-table-component) ทิ้งทั้งหมด
 *   ✅ สร้างตารางเองใหม่ทั้งหมดด้วย MUI Table ล้วนๆ ให้หน้าตาตรงกับ Customer/index.js:
 *        - หัวคอลัมน์กดเรียงลำดับได้ (TableSortLabel)
 *        - แถวขยายดูรายละเอียดเพิ่มเติมได้ (Collapse)
 *        - Pagination จริงของ MUI (TablePagination)
 *        - คอลัมน์แอคชัน (แก้ไข/ลบ) เป็นไอคอนอยู่ในแถวเลย
 *        - ชื่อ-นามสกุล มี avatar ตัวอักษรแรก สีตาม hash ชื่อ
 *        - สิทธิ์ผู้ใช้ (role) แสดงเป็น Chip สี
 *        - สถิติสรุป: ผู้ใช้ทั้งหมด / ผู้ดูแลระบบ / ทีมงาน
 *   🐞 แก้บั๊ก UI เดิม:
 *        - modal พื้นหลังเพี้ยน/ไม่กึ่งกลางแน่นอน → ใช้ position:absolute + translate มาจัดกึ่งกลาง แทน margin:auto
 *        - ฟอร์มเพิ่มผู้ใช้มี state "rank" แต่ไม่มีช่องกรอกจริง → เพิ่มช่องกรอกยศ/ตำแหน่งให้ครบ
 *        - reset ฟอร์มหลังเพิ่มผู้ใช้ไม่ครบทุก field (ขาด role, rank) → แก้ให้ reset ครบ
 *   ✅ คงฟีเจอร์เดิมทั้งหมด: ค้นหา, เพิ่ม/แก้ไขผู้ใช้, ยืนยันรหัสผ่าน Admin ก่อนเพิ่ม, ลบ, อัปเดต session ของผู้ใช้ที่ล็อกอินอยู่, Snackbar
 */

import React, { useEffect, useMemo, useState } from "react";
import AuthService from "../../../services/authService";
import API from "../../../API/axiosInstance";
import Swal from "sweetalert2";

import {
  Modal, TextField, Button, Snackbar, Alert, Box, Stack, Typography, Avatar,
  Chip, IconButton, Tooltip, Divider, Grid, Skeleton, InputAdornment,
  useMediaQuery, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TableSortLabel, TablePagination, Collapse, Select, MenuItem,
  InputLabel, FormControl,
} from "@mui/material";
import { styled, alpha, useTheme } from "@mui/material/styles";

import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import EmailIcon from "@mui/icons-material/Email";
import LockIcon from "@mui/icons-material/Lock";
import PhoneIcon from "@mui/icons-material/Phone";
import PersonIcon from "@mui/icons-material/Person";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import GroupsIcon from "@mui/icons-material/Groups";
import ShieldIcon from "@mui/icons-material/Shield";
import EngineeringIcon from "@mui/icons-material/Engineering";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import MilitaryTechIcon from "@mui/icons-material/MilitaryTech";
import VpnKeyIcon from "@mui/icons-material/VpnKey";

import { useAuth } from "../../../auth/AuthContext";

// ─── Styled (ให้ตรงกับ Customer/index.js) ───────────────────────────────
const GlassCard = styled(Box)(({ theme }) => ({
  background: alpha(theme.palette.background.paper, 0.9),
  backdropFilter: "blur(10px)",
  borderRadius: 16,
  border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  boxShadow: `0 4px 24px ${alpha(theme.palette.common.black, 0.06)}`,
}));

const StatCard = styled(GlassCard)(({ barColor }) => ({
  position: "relative",
  overflow: "hidden",
  padding: 20,
  "&::before": {
    content: '""',
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: 4,
    background: barColor || "linear-gradient(90deg, #667eea, #764ba2)",
  },
}));

const SectionLabel = styled(Typography)(({ theme }) => ({
  fontSize: "0.7rem",
  fontWeight: 700,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: theme.palette.text.secondary,
}));

const HeadCell = styled(TableCell)(({ theme }) => ({
  fontSize: "0.7rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: theme.palette.text.secondary,
  background: alpha(theme.palette.primary.main, 0.04),
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
  whiteSpace: "nowrap",
}));

const BodyRow = styled(TableRow)(({ theme }) => ({
  "&:hover": { background: alpha(theme.palette.primary.main, 0.03) },
  "& > td": { borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}` },
}));

// ─── Constants / Helpers ────────────────────────────────────────────────
const AVATAR_PALETTE = ["#667eea", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

const colorFromName = (name = "") => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
};

const copyToClipboard = (text, cb) => {
  if (!text) return;
  navigator.clipboard.writeText(text);
  cb?.();
};

const ROLE_META = {
  admin: { label: "Admin", color: "#ef4444", icon: <ShieldIcon sx={{ fontSize: 14 }} /> },
  technician: { label: "Technician", color: "#3b82f6", icon: <EngineeringIcon sx={{ fontSize: 14 }} /> },
  editor: { label: "Editor", color: "#8b5cf6", icon: <PersonIcon sx={{ fontSize: 14 }} /> },
};

const EMPTY_FORM = { fname: "", lname: "", tel: "", email: "", username: "", password: "", role: "", rank: "" };

const HEAD_CELLS = [
  { id: "expand",  label: "",             sortable: false, width: 44 },
  { id: "fname",   label: "ชื่อ-นามสกุล", sortable: true },
  { id: "email",   label: "อีเมล",         sortable: true },
  { id: "tel",     label: "เบอร์โทร",      sortable: true },
  { id: "role",    label: "สิทธิ์",         sortable: true },
  { id: "actions", label: "จัดการ",        sortable: false, width: 96, align: "right" },
];

const comparator = (a, b, orderBy) => {
  const av = (a[orderBy] || "").toString().toLowerCase();
  const bv = (b[orderBy] || "").toString().toLowerCase();
  if (bv < av) return -1;
  if (bv > av) return 1;
  return 0;
};

const getComparator = (order, orderBy) =>
  order === "desc" ? (a, b) => comparator(a, b, orderBy) : (a, b) => -comparator(a, b, orderBy);

// ─── EmployeeFormModal (ใช้ร่วมกันทั้งเพิ่ม/แก้ไข) ──────────────────────
const EmployeeFormModal = ({ open, mode, data, onChange, onClose, onSubmit, isSmallScreen }) => {
  const modalStyle = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    padding: isSmallScreen ? 2.5 : 3.5,
    bgcolor: "background.paper",
    width: isSmallScreen ? "92%" : "540px",
    maxWidth: "540px",
    borderRadius: 3,
    overflowY: "auto",
    maxHeight: "90vh",
    boxShadow: "0 24px 64px rgba(0,0,0,0.24)",
    outline: "none",
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={modalStyle}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" gap={1.25}>
            <Avatar sx={{
              bgcolor: alpha(mode === "add" ? "#10b981" : "#3b82f6", 0.15),
              color: mode === "add" ? "#10b981" : "#3b82f6", width: 38, height: 38,
            }}>
              {mode === "add" ? <AddIcon fontSize="small" /> : <EditIcon fontSize="small" />}
            </Avatar>
            <Box>
              <Typography fontWeight={800} fontSize="1.05rem">
                {mode === "add" ? "เพิ่มผู้ใช้ใหม่" : "แก้ไขข้อมูลผู้ใช้"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {mode === "add" ? "กรอกข้อมูลผู้ใช้และสิทธิ์การเข้าถึงให้ครบถ้วน" : `${data.fname || ""} ${data.lname || ""}`}
              </Typography>
            </Box>
          </Stack>
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </Stack>

        <Divider sx={{ mb: 2.5 }} />

        <SectionLabel sx={{ display: "block", mb: 1 }}>ข้อมูลส่วนตัว</SectionLabel>
        <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="ชื่อ" name="fname" fullWidth size="small" required
              value={data.fname || ""} onChange={onChange}
              InputProps={{ startAdornment: (<InputAdornment position="start"><PersonIcon fontSize="small" sx={{ color: "text.disabled" }} /></InputAdornment>) }}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="นามสกุล" name="lname" fullWidth size="small" required
              value={data.lname || ""} onChange={onChange}
              InputProps={{ startAdornment: (<InputAdornment position="start"><PersonIcon fontSize="small" sx={{ color: "text.disabled" }} /></InputAdornment>) }}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="เบอร์โทร" name="tel" fullWidth size="small" required
              value={data.tel || ""} onChange={onChange} inputProps={{ maxLength: 10 }}
              InputProps={{ startAdornment: (<InputAdornment position="start"><PhoneIcon fontSize="small" sx={{ color: "text.disabled" }} /></InputAdornment>) }}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="อีเมล" name="email" fullWidth size="small" required
              value={data.email || ""} onChange={onChange}
              InputProps={{ startAdornment: (<InputAdornment position="start"><EmailIcon fontSize="small" sx={{ color: "text.disabled" }} /></InputAdornment>) }}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
            />
          </Grid>
        </Grid>

        <SectionLabel sx={{ display: "block", mb: 1 }}>บัญชีผู้ใช้ &amp; สิทธิ์</SectionLabel>
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="ชื่อผู้ใช้" name="username" fullWidth size="small" required
              value={data.username || ""} onChange={onChange}
              InputProps={{ startAdornment: (<InputAdornment position="start"><AccountCircleIcon fontSize="small" sx={{ color: "text.disabled" }} /></InputAdornment>) }}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
            />
          </Grid>
          {mode === "add" && (
            <Grid item xs={12} sm={6}>
              <TextField
                label="รหัสผ่าน" name="password" type="password" fullWidth size="small" required
                value={data.password || ""} onChange={onChange}
                InputProps={{ startAdornment: (<InputAdornment position="start"><LockIcon fontSize="small" sx={{ color: "text.disabled" }} /></InputAdornment>) }}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              />
            </Grid>
          )}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel id="role-label">สิทธิ์ของผู้ใช้</InputLabel>
              <Select
                labelId="role-label" name="role" label="สิทธิ์ของผู้ใช้"
                value={data.role || ""} onChange={onChange}
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="technician">Technician</MenuItem>
                <MenuItem value="editor">Editor</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          {mode === "add" && (
            <Grid item xs={12} sm={6}>
              <TextField
                label="ยศ / ตำแหน่ง" name="rank" fullWidth size="small"
                value={data.rank || ""} onChange={onChange}
                InputProps={{ startAdornment: (<InputAdornment position="start"><MilitaryTechIcon fontSize="small" sx={{ color: "text.disabled" }} /></InputAdornment>) }}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              />
            </Grid>
          )}
        </Grid>

        <Stack direction="row" gap={1.5} sx={{ mt: 3 }}>
          <Button variant="outlined" color="inherit" fullWidth onClick={onClose} sx={{ borderRadius: 2 }}>
            ยกเลิก
          </Button>
          <Button variant="contained" color={mode === "add" ? "success" : "primary"} fullWidth
            onClick={onSubmit} sx={{ borderRadius: 2, fontWeight: 700 }}>
            {mode === "add" ? "ถัดไป: ยืนยันรหัสผ่าน Admin" : "บันทึกการแก้ไข"}
          </Button>
        </Stack>
      </Box>
    </Modal>
  );
};

// ─── PasswordConfirmModal ────────────────────────────────────────────────
const PasswordConfirmModal = ({ open, value, onChange, onClose, onConfirm, isSmallScreen }) => {
  const modalStyle = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    padding: isSmallScreen ? 2.5 : 3.5,
    bgcolor: "background.paper",
    width: isSmallScreen ? "92%" : "420px",
    maxWidth: "420px",
    borderRadius: 3,
    boxShadow: "0 24px 64px rgba(0,0,0,0.24)",
    outline: "none",
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={modalStyle}>
        <Stack direction="row" alignItems="center" gap={1.25} sx={{ mb: 2 }}>
          <Avatar sx={{ bgcolor: alpha("#f59e0b", 0.15), color: "#d97706", width: 38, height: 38 }}>
            <VpnKeyIcon fontSize="small" />
          </Avatar>
          <Box>
            <Typography fontWeight={800} fontSize="1.05rem">ยืนยันรหัสผ่าน Admin</Typography>
            <Typography variant="caption" color="text.secondary">เพื่อความปลอดภัยก่อนเพิ่มผู้ใช้ใหม่</Typography>
          </Box>
        </Stack>
        <Divider sx={{ mb: 2.5 }} />
        <TextField
          label="รหัสผ่านของคุณ" name="passwordConfirm" type="password" fullWidth size="small"
          value={value} onChange={onChange}
          InputProps={{ startAdornment: (<InputAdornment position="start"><LockIcon fontSize="small" sx={{ color: "text.disabled" }} /></InputAdornment>) }}
          sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
        />
        <Stack direction="row" gap={1.5} sx={{ mt: 3 }}>
          <Button variant="outlined" color="inherit" fullWidth onClick={onClose} sx={{ borderRadius: 2 }}>
            ยกเลิก
          </Button>
          <Button variant="contained" color="warning" fullWidth onClick={onConfirm} sx={{ borderRadius: 2, fontWeight: 700 }}>
            ยืนยัน
          </Button>
        </Stack>
      </Box>
    </Modal>
  );
};

// ─── EmployeeRow: แถวหลัก + แถวขยายรายละเอียด ───────────────────────────
const EmployeeRow = ({ row, isSmallScreen, onEdit, onDelete, onCopy }) => {
  const [open, setOpen] = useState(false);
  const fullName = `${row.fname || ""} ${row.lname || ""}`.trim();
  const initial = (row.fname || "?").charAt(0).toUpperCase();
  const color = colorFromName(fullName || row.fname || "");
  const roleMeta = ROLE_META[row.role] || { label: row.role || "ไม่ระบุ", color: "#94a3b8", icon: <PersonIcon sx={{ fontSize: 14 }} /> };

  return (
    <>
      <BodyRow>
        <TableCell sx={{ width: 44 }}>
          <IconButton size="small" onClick={() => setOpen(p => !p)}>
            {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </TableCell>

        <TableCell sx={{ minWidth: 200 }}>
          <Stack direction="row" alignItems="center" gap={1.25} sx={{ py: 0.5, minWidth: 0 }}>
            <Avatar sx={{ width: 34, height: 34, fontSize: "0.85rem", fontWeight: 700, flexShrink: 0, bgcolor: alpha(color, 0.15), color }}>
              {initial}
            </Avatar>
            <Box minWidth={0}>
              <Typography fontWeight={700} fontSize="0.85rem" noWrap>{fullName || "—"}</Typography>
              <Stack direction="row" alignItems="center" gap={0.4}>
                <AccountCircleIcon sx={{ fontSize: 12, color: "text.disabled" }} />
                <Typography variant="caption" color="text.secondary" noWrap>{row.username || "ไม่มีชื่อผู้ใช้"}</Typography>
              </Stack>
            </Box>
          </Stack>
        </TableCell>

        <TableCell>
          {row.email ? (
            <Stack direction="row" alignItems="center" gap={0.5} sx={{ minWidth: 0 }}>
              <EmailIcon sx={{ fontSize: 15, color: "text.disabled", flexShrink: 0 }} />
              <Typography variant="body2" noWrap sx={{ fontSize: "0.8rem", maxWidth: 180 }}>{row.email}</Typography>
              <Tooltip title="คัดลอกอีเมล">
                <IconButton size="small" sx={{ p: 0.4 }} onClick={() => onCopy(row.email, "อีเมล")}>
                  <ContentCopyIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          ) : (
            <Chip label="ไม่มีอีเมล" size="small" variant="outlined" sx={{ fontSize: "0.68rem", height: 22, color: "text.disabled" }} />
          )}
        </TableCell>

        {!isSmallScreen && (
          <TableCell>
            {row.tel ? (
              <Stack direction="row" alignItems="center" gap={0.5}>
                <PhoneIcon sx={{ fontSize: 15, color: "text.disabled" }} />
                <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>{row.tel}</Typography>
                <Tooltip title="คัดลอกเบอร์โทร">
                  <IconButton size="small" sx={{ p: 0.4 }} onClick={() => onCopy(row.tel, "เบอร์โทร")}>
                    <ContentCopyIcon sx={{ fontSize: 13 }} />
                  </IconButton>
                </Tooltip>
              </Stack>
            ) : (
              <Chip label="ไม่มีเบอร์" size="small" variant="outlined" sx={{ fontSize: "0.68rem", height: 22, color: "text.disabled" }} />
            )}
          </TableCell>
        )}

        {!isSmallScreen && (
          <TableCell>
            <Chip
              size="small" icon={roleMeta.icon} label={roleMeta.label}
              sx={{ height: 22, fontSize: "0.68rem", fontWeight: 700, bgcolor: alpha(roleMeta.color, 0.1), color: roleMeta.color, "& .MuiChip-icon": { color: roleMeta.color } }}
            />
          </TableCell>
        )}

        <TableCell align="right">
          <Stack direction="row" gap={0.25} justifyContent="flex-end">
            <Tooltip title="แก้ไข">
              <IconButton size="small" onClick={() => onEdit(row)}><EditIcon sx={{ fontSize: 17 }} /></IconButton>
            </Tooltip>
            <Tooltip title="ลบ">
              <IconButton size="small" color="error" onClick={() => onDelete(row._id)}><DeleteIcon sx={{ fontSize: 17 }} /></IconButton>
            </Tooltip>
          </Stack>
        </TableCell>
      </BodyRow>

      <TableRow>
        <TableCell colSpan={6} sx={{ p: 0, border: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ px: 3, py: 2, background: theme => alpha(theme.palette.primary.main, 0.02) }}>
              <Grid container spacing={2}>
                {isSmallScreen && (
                  <>
                    <Grid item xs={12} sm={4}>
                      <SectionLabel>เบอร์โทร</SectionLabel>
                      <Typography variant="body2">{row.tel || "—"}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <SectionLabel>สิทธิ์</SectionLabel>
                      <Chip
                        size="small" icon={roleMeta.icon} label={roleMeta.label}
                        sx={{ height: 22, fontSize: "0.68rem", fontWeight: 700, bgcolor: alpha(roleMeta.color, 0.1), color: roleMeta.color }}
                      />
                    </Grid>
                  </>
                )}
                <Grid item xs={12} sm={4}>
                  <SectionLabel>ยศ / ตำแหน่ง</SectionLabel>
                  <Typography variant="body2">{row.rank || "—"}</Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <SectionLabel>ชื่อผู้ใช้ (Username)</SectionLabel>
                  <Typography variant="body2">{row.username || "—"}</Typography>
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════
const Employee = () => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery("(max-width:600px)");
  const { userData, updateUserData } = useAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [modalOpenInsert, setModalOpenInsert] = useState(false);
  const [modalOpenEdit, setModalOpenEdit] = useState(false);
  const [modalOpenPasswordConfirm, setModalOpenPasswordConfirm] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editedData, setEditedData] = useState({});
  const [newUserData, setNewUserData] = useState(EMPTY_FORM);
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const [alert, setAlert] = useState({ open: false, message: "", severity: "info" });

  // ตาราง: เรียงลำดับ + pagination
  const [order, setOrder] = useState("asc");
  const [orderBy, setOrderBy] = useState("fname");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const getAllUser = await AuthService.getAllUserData();
      setUsers(getAllUser.allUser || []);
    } catch (error) {
      console.error("Error fetching user data:", error);
      setAlert({ open: true, message: "โหลดข้อมูลผู้ใช้ไม่สำเร็จ", severity: "error" });
    } finally {
      setLoading(false);
    }
  };

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
    if (!["admin", "technician", "editor"].includes(role)) {
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
    if (!["admin", "technician", "editor"].includes(role)) {
      setAlert({ open: true, message: "กรุณาเลือกสิทธิ์ของผู้ใช้!", severity: "error" });
      return false;
    }
    return true;
  };

  const validateAdminPassword = async () => {
    try {
      const response = await API.post("/auth/validate-password", {
        email: "gotsmtdd@gmail.com",
        password: passwordConfirm,
      });
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
        rank: (newUserData.rank || "").trim(),
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

  const handleEditUser = async () => {
    if (!validateEditForm()) return;
    if (!editedData._id) {
      Swal.fire({ title: "เกิดข้อผิดพลาด!", text: "ไม่พบข้อมูลผู้ใช้ที่ต้องการแก้ไข", icon: "error" });
      return;
    }

    try {
      const response = await API.put(`/auth/user/${editedData._id}`, editedData);
      if (response.status === 200) {
        const { user, token } = response.data;

        if (userData && user._id && userData.userId && user._id.toString() === userData.userId.toString()) {
          localStorage.setItem("token", token);
          localStorage.setItem("payload", JSON.stringify(user));
          updateUserData(user);
        }

        setModalOpenEdit(false);
        setSelectedUser(null);
        setEditedData({});
        await fetchUsers();

        Swal.fire({ title: "สำเร็จ!", text: "อัปเดตข้อมูลผู้ใช้เรียบร้อย", icon: "success" });
      }
    } catch (error) {
      console.error("Error updating user:", error);
      Swal.fire({ title: "เกิดข้อผิดพลาด!", text: "ไม่สามารถอัปเดตข้อมูลผู้ใช้ได้", icon: "error" });
    }
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
    copyToClipboard(text, () => setAlert({ open: true, message: `คัดลอก${label}แล้ว`, severity: "success" }));
  };

  const handleSort = (field) => {
    const isAsc = orderBy === field && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(field);
  };

  const handleChangePage = (_, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  // ─── Derived data ──────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    return users.filter((user) =>
      user.fname?.toLowerCase().includes(lowerSearch) ||
      user.lname?.toLowerCase().includes(lowerSearch) ||
      user.email?.toLowerCase().includes(lowerSearch) ||
      user.tel?.toLowerCase().includes(lowerSearch) ||
      user.username?.toLowerCase().includes(lowerSearch)
    );
  }, [users, searchTerm]);

  const sortedUsers = useMemo(
    () => filteredUsers.slice().sort(getComparator(order, orderBy)),
    [filteredUsers, order, orderBy]
  );

  const paginatedUsers = useMemo(
    () => sortedUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [sortedUsers, page, rowsPerPage]
  );

  useEffect(() => { setPage(0); }, [searchTerm]);

  const stats = useMemo(() => {
    const total = users.length;
    const admin = users.filter(u => u.role === "admin").length;
    const staff = users.filter(u => u.role === "technician" || u.role === "editor").length;
    return { total, admin, staff };
  }, [users]);

  const statCards = [
    { label: "ผู้ใช้ทั้งหมด", value: stats.total, bar: "linear-gradient(135deg,#667eea,#764ba2)", icon: <GroupsIcon />, sub: "บัญชีในระบบทั้งหมด" },
    { label: "ผู้ดูแลระบบ", value: stats.admin, bar: "linear-gradient(135deg,#ef4444,#dc2626)", icon: <ShieldIcon />, sub: "สิทธิ์ Admin" },
    { label: "ทีมงาน", value: stats.staff, bar: "linear-gradient(135deg,#3b82f6,#8b5cf6)", icon: <EngineeringIcon />, sub: "Technician / Editor" },
  ];

  const visibleHeadCells = HEAD_CELLS.filter(c => !isSmallScreen || !["tel", "role"].includes(c.id));

  return (
    <>
      <Box sx={{ px: { xs: 1, sm: 2, md: 3 }, py: 3, maxWidth: 1400, mx: "auto" }}>

        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h5" fontWeight={800} letterSpacing={-0.5}>จัดการผู้ใช้งานระบบ</Typography>
            <Typography variant="body2" color="text.secondary">
              {loading ? "กำลังโหลด..." : `${filteredUsers.length} รายการ${searchTerm ? ` · ค้นหา "${searchTerm}"` : ""}`}
            </Typography>
          </Box>
          <Button
            variant="contained" color="success" startIcon={<AddIcon />}
            onClick={() => { setNewUserData(EMPTY_FORM); setModalOpenInsert(true); }}
            sx={{ borderRadius: 2, fontWeight: 700, textTransform: "none" }}
          >
            เพิ่มผู้ใช้ใหม่
          </Button>
        </Stack>

        {/* Stat cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {statCards.map(s => (
            <Grid item xs={12} sm={4} key={s.label}>
              <StatCard barColor={s.bar}>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                  <Box>
                    <SectionLabel sx={{ mb: 0.5, display: "block" }}>{s.label}</SectionLabel>
                    {loading ? (
                      <Skeleton width={48} height={40} />
                    ) : (
                      <Typography variant="h4" fontWeight={800} sx={{ lineHeight: 1 }}>{s.value}</Typography>
                    )}
                    <Typography variant="caption" color="text.secondary">{s.sub}</Typography>
                  </Box>
                  <Box sx={{ p: 1, borderRadius: 2, background: s.bar, color: "#fff", display: "flex" }}>
                    {s.icon}
                  </Box>
                </Stack>
              </StatCard>
            </Grid>
          ))}
        </Grid>

        {/* Search */}
        <GlassCard sx={{ p: 2, mb: 2.5 }}>
          <TextField
            placeholder="🔍 ค้นหาชื่อ, อีเมล, เบอร์โทร, ชื่อผู้ใช้..."
            variant="outlined"
            size="small"
            fullWidth
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: "text.disabled" }} /></InputAdornment>
              ),
              endAdornment: searchTerm ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchTerm("")}><ClearIcon fontSize="small" /></IconButton>
                </InputAdornment>
              ) : null,
              sx: { borderRadius: 2 },
            }}
          />
        </GlassCard>

        {/* Table */}
        <GlassCard sx={{ overflow: "hidden" }}>
          {loading ? (
            <Stack spacing={1.5} sx={{ p: 2 }}>
              {[1, 2, 3, 4].map(i => <Skeleton key={i} variant="rounded" height={52} sx={{ borderRadius: 2 }} />)}
            </Stack>
          ) : filteredUsers.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
              <FolderOpenIcon sx={{ fontSize: 48, opacity: 0.25, mb: 1 }} />
              <Typography fontWeight={600}>
                {searchTerm ? "ไม่พบผู้ใช้ที่ตรงกับการค้นหา" : "ยังไม่มีข้อมูลผู้ใช้"}
              </Typography>
              <Typography variant="body2" color="text.disabled">
                {searchTerm ? "ลองเปลี่ยนคำค้นหาดูอีกครั้ง" : "กด “เพิ่มผู้ใช้ใหม่” เพื่อเริ่มต้น"}
              </Typography>
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {visibleHeadCells.map(cell => (
                        <HeadCell key={cell.id} align={cell.align || "left"} sx={{ width: cell.width }}>
                          {cell.sortable ? (
                            <TableSortLabel
                              active={orderBy === cell.id}
                              direction={orderBy === cell.id ? order : "asc"}
                              onClick={() => handleSort(cell.id)}
                            >
                              {cell.label}
                            </TableSortLabel>
                          ) : cell.label}
                        </HeadCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedUsers.map((row) => (
                      <EmployeeRow
                        key={row._id}
                        row={row}
                        isSmallScreen={isSmallScreen}
                        onEdit={openEditModal}
                        onDelete={handleDeleteRow}
                        onCopy={handleCopy}
                      />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={filteredUsers.length}
                page={page}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                rowsPerPageOptions={[5, 10, 25, 50]}
                labelRowsPerPage="แถวต่อหน้า"
                labelDisplayedRows={({ from, to, count }) => `${from}–${to} จาก ${count}`}
                sx={{ borderTop: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}
              />
            </>
          )}
        </GlassCard>
      </Box>

      {/* Add modal */}
      <EmployeeFormModal
        open={modalOpenInsert}
        mode="add"
        data={newUserData}
        onChange={handleChange}
        onClose={() => setModalOpenInsert(false)}
        onSubmit={handleOpenPasswordConfirmModal}
        isSmallScreen={isSmallScreen}
      />

      {/* Edit modal */}
      <EmployeeFormModal
        open={modalOpenEdit}
        mode="edit"
        data={editedData}
        onChange={handleChangeEdit}
        onClose={() => setModalOpenEdit(false)}
        onSubmit={handleEditUser}
        isSmallScreen={isSmallScreen}
      />

      {/* Admin password confirm modal */}
      <PasswordConfirmModal
        open={modalOpenPasswordConfirm}
        value={passwordConfirm}
        onChange={(e) => setPasswordConfirm(e.target.value)}
        onClose={() => setModalOpenPasswordConfirm(false)}
        onConfirm={handleAddUser}
        isSmallScreen={isSmallScreen}
      />

      <Snackbar
        open={alert.open}
        autoHideDuration={2500}
        onClose={() => setAlert(p => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={alert.severity} onClose={() => setAlert(p => ({ ...p, open: false }))} sx={{ borderRadius: 2, fontWeight: 600 }}>
          {alert.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default Employee;