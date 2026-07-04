/* eslint-disable no-unused-vars */
/**
 * Customer/index.js — v3
 *
 * เปลี่ยนจาก v2:
 *   ❌ ตัดการใช้ DataTableComponent / DataTableColumns / Expanded (react-data-table-component) ทิ้งทั้งหมด
 *   ✅ สร้างตารางเองใหม่ทั้งหมดด้วย MUI Table ล้วนๆ:
 *        - หัวคอลัมน์กดเรียงลำดับได้ (TableSortLabel)
 *        - แถวขยายดูรายละเอียดเพิ่มเติมได้ (Collapse) แทนที่ expandableRowsComponent เดิม
 *        - Pagination จริงของ MUI (TablePagination)
 *        - คอลัมน์แอคชัน (แก้ไข/ลบ) เป็นไอคอนอยู่ในแถวเลย ไม่ต้องเปิดเมนู
 *        - บริษัท+โครงการ รวมเป็นเซลล์เดียว มี avatar ตัวอักษรแรก สีตาม hash ชื่อ
 *        - อีเมล/เบอร์โทร มีปุ่มคัดลอกในตัว
 *   ✅ คงฟีเจอร์เดิมทั้งหมด: สถิติสรุป, ค้นหา, เพิ่ม/แก้ไขลูกค้า, ลบ, Export CSV, Snackbar
 *
 * หมายเหตุ: handleUpdateCustomer เรียก CustomerService.UpdateCustomer(id, data)
 * โปรดตรวจสอบว่ามีเมธอดนี้จริงในฝั่ง service
 */

import React, { useMemo, useState, useEffect } from "react";
import CustomerService from "../../../services/CustomerService";
import Swal from "sweetalert2";
import moment from "moment";
import "moment/locale/th";

import {
  Modal, TextField, Button, Snackbar, Alert, Box, Stack, Typography, Avatar,
  Chip, IconButton, Tooltip, Divider, Grid, Skeleton, InputAdornment,
  useMediaQuery, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TableSortLabel, TablePagination, Collapse,
} from "@mui/material";
import { styled, alpha, useTheme } from "@mui/material/styles";

import BusinessIcon from "@mui/icons-material/Business";
import ApartmentIcon from "@mui/icons-material/Apartment";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import PersonIcon from "@mui/icons-material/Person";
import HomeIcon from "@mui/icons-material/Home";
import BadgeIcon from "@mui/icons-material/Badge";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import DownloadIcon from "@mui/icons-material/Download";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import GroupsIcon from "@mui/icons-material/Groups";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";

// ─── Styled ─────────────────────────────────────────────────────────────
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

const EMPTY_FORM = { cCompany: "", cSite: "", cEmail: "", cName: "", address: "", tel: "", tax: "" };

const FIELD_CONFIG = [
  { name: "cCompany", label: "บริษัท / นิติบุคคล", icon: <BusinessIcon fontSize="small" />, required: true, group: "org" },
  { name: "cSite",    label: "โครงการ / ไซต์งาน",   icon: <ApartmentIcon fontSize="small" />, required: true, group: "org" },
  { name: "tax",      label: "เลขประจำตัวผู้เสียภาษี", icon: <BadgeIcon fontSize="small" />, maxLength: 13, group: "org" },
  { name: "cName",    label: "ชื่อผู้ติดต่อ",        icon: <PersonIcon fontSize="small" />, group: "contact" },
  { name: "cEmail",   label: "อีเมล",                icon: <EmailIcon fontSize="small" />, required: true, group: "contact" },
  { name: "tel",      label: "เบอร์โทรศัพท์",         icon: <PhoneIcon fontSize="small" />, maxLength: 10, group: "contact" },
  { name: "address",  label: "ที่อยู่",               icon: <HomeIcon fontSize="small" />, multiline: true, group: "contact" },
];

const HEAD_CELLS = [
  { id: "expand",    label: "",           sortable: false, width: 44 },
  { id: "cCompany",  label: "บริษัท / โครงการ", sortable: true },
  { id: "cName",     label: "ผู้ติดต่อ",   sortable: true },
  { id: "cEmail",    label: "อีเมล",       sortable: true },
  { id: "tel",       label: "เบอร์โทร",    sortable: true },
  { id: "actions",   label: "จัดการ",      sortable: false, width: 96, align: "right" },
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

// ─── CustomerFormModal (ใช้ร่วมกันทั้งเพิ่ม/แก้ไข) ──────────────────────
const CustomerFormModal = ({ open, mode, data, errors, onChange, onClose, onSubmit, isSmallScreen }) => {
const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  padding: isSmallScreen ? 2.5 : 3.5,
  bgcolor: "background.paper",   // ✅ ใช้ bgcolor แทน background ให้ MUI map เข้า theme
  width: isSmallScreen ? "92%" : "540px",
  maxWidth: "540px",
  borderRadius: 3,
  overflowY: "auto",
  maxHeight: "90vh",
  boxShadow: "0 24px 64px rgba(0,0,0,0.24)",
  outline: "none",
};

  const renderGroup = (groupKey, title) => (
    <Box sx={{ mb: 2.5 }}>
      <SectionLabel sx={{ display: "block", mb: 1 }}>{title}</SectionLabel>
      <Grid container spacing={1.5}>
        {FIELD_CONFIG.filter(f => f.group === groupKey).map(f => (
          <Grid item xs={12} sm={f.name === "address" ? 12 : 6} key={f.name}>
            <TextField
              label={f.label}
              name={f.name}
              fullWidth
              size="small"
              required={f.required}
              multiline={f.multiline}
              minRows={f.multiline ? 2 : undefined}
              value={data[f.name] || ""}
              onChange={onChange}
              error={Boolean(errors[f.name])}
              helperText={errors[f.name] || " "}
              inputProps={f.maxLength ? { maxLength: f.maxLength } : undefined}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Box sx={{ color: "text.disabled", display: "flex" }}>{f.icon}</Box>
                  </InputAdornment>
                ),
              }}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );

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
                {mode === "add" ? "เพิ่มลูกค้าใหม่" : "แก้ไขข้อมูลลูกค้า"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {mode === "add" ? "กรอกข้อมูลบริษัทและผู้ติดต่อให้ครบถ้วน" : `${data.cCompany || ""}`}
              </Typography>
            </Box>
          </Stack>
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </Stack>

        <Divider sx={{ mb: 2.5 }} />

        {renderGroup("org", "ข้อมูลบริษัท")}
        {renderGroup("contact", "ข้อมูลผู้ติดต่อ")}

        <Stack direction="row" gap={1.5} sx={{ mt: 1 }}>
          <Button variant="outlined" color="inherit" fullWidth onClick={onClose} sx={{ borderRadius: 2 }}>
            ยกเลิก
          </Button>
          <Button variant="contained" color={mode === "add" ? "success" : "primary"} fullWidth
            onClick={onSubmit} sx={{ borderRadius: 2, fontWeight: 700 }}>
            {mode === "add" ? "บันทึกลูกค้าใหม่" : "บันทึกการแก้ไข"}
          </Button>
        </Stack>
      </Box>
    </Modal>
  );
};

// ─── CustomerRow: แถวหลัก + แถวขยายรายละเอียด ───────────────────────────
const CustomerRow = ({ row, isSmallScreen, onEdit, onDelete, onCopy }) => {
  const [open, setOpen] = useState(false);
  const initial = (row.cCompany || "?").charAt(0).toUpperCase();
  const color = colorFromName(row.cCompany || "");
  const isComplete = row.cEmail && row.tel && row.address;

  return (
    <>
      <BodyRow>
        <TableCell sx={{ width: 44 }}>
          <IconButton size="small" onClick={() => setOpen(p => !p)}>
            {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </TableCell>

        <TableCell sx={{ minWidth: 220 }}>
          <Stack direction="row" alignItems="center" gap={1.25} sx={{ py: 0.5, minWidth: 0 }}>
            <Avatar sx={{ width: 34, height: 34, fontSize: "0.85rem", fontWeight: 700, flexShrink: 0, bgcolor: alpha(color, 0.15), color }}>
              {initial}
            </Avatar>
            <Box minWidth={0}>
              <Typography fontWeight={700} fontSize="0.85rem" noWrap>{row.cCompany || "—"}</Typography>
              <Stack direction="row" alignItems="center" gap={0.4}>
                <ApartmentIcon sx={{ fontSize: 12, color: "text.disabled" }} />
                <Typography variant="caption" color="text.secondary" noWrap>{row.cSite || "ไม่ระบุโครงการ"}</Typography>
              </Stack>
            </Box>
          </Stack>
        </TableCell>

        {!isSmallScreen && (
          <TableCell>
            <Typography variant="body2" fontWeight={600} fontSize="0.8rem">{row.cName || "—"}</Typography>
          </TableCell>
        )}

        <TableCell>
          {row.cEmail ? (
            <Stack direction="row" alignItems="center" gap={0.5} sx={{ minWidth: 0 }}>
              <EmailIcon sx={{ fontSize: 15, color: "text.disabled", flexShrink: 0 }} />
              <Typography variant="body2" noWrap sx={{ fontSize: "0.8rem", maxWidth: 180 }}>{row.cEmail}</Typography>
              <Tooltip title="คัดลอกอีเมล">
                <IconButton size="small" sx={{ p: 0.4 }} onClick={() => onCopy(row.cEmail, "อีเมล")}>
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
                      <SectionLabel>ผู้ติดต่อ</SectionLabel>
                      <Typography variant="body2" fontWeight={600}>{row.cName || "—"}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <SectionLabel>เบอร์โทร</SectionLabel>
                      <Typography variant="body2">{row.tel || "—"}</Typography>
                    </Grid>
                  </>
                )}
                <Grid item xs={12} sm={4}>
                  <SectionLabel>ชื่อโปรเจค</SectionLabel>
                  <Typography variant="body2">{row.projName || "—"}</Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <SectionLabel>เลขประจำตัวผู้เสียภาษี</SectionLabel>
                  <Typography variant="body2">{row.tax || "—"}</Typography>
                </Grid>
                <Grid item xs={12} sm={isSmallScreen ? 12 : 8}>
                  <SectionLabel>ที่อยู่</SectionLabel>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>{row.address || "—"}</Typography>
                </Grid>
              </Grid>
              {!isComplete && (
                <Chip
                  size="small" icon={<WarningAmberIcon sx={{ fontSize: 14 }} />}
                  label="ข้อมูลติดต่อยังไม่ครบถ้วน"
                  sx={{ mt: 1.5, height: 22, fontSize: "0.68rem", bgcolor: alpha("#f59e0b", 0.1), color: "#d97706" }}
                />
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════
const Customer = () => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery("(max-width:600px)");
  moment.locale("th");

  const [searchTerm, setSearchTerm] = useState("");
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [modalOpenInsert, setModalOpenInsert] = useState(false);
  const [modalOpenEdit, setModalOpenEdit] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [editedData, setEditedData] = useState({});
  const [formErrors, setFormErrors] = useState({});

  const [newCustomerData, setNewCustomerData] = useState(EMPTY_FORM);
  const [alert, setAlert] = useState({ open: false, message: "", severity: "info" });

  // ตาราง: เรียงลำดับ + pagination
  const [order, setOrder] = useState("asc");
  const [orderBy, setOrderBy] = useState("cCompany");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await CustomerService.getCustomers();
      setCustomers(res.userCustomers || []);
    } catch (error) {
      console.error("Error fetching customer data:", error);
      setAlert({ open: true, message: "โหลดข้อมูลลูกค้าไม่สำเร็จ", severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewCustomerData(p => ({ ...p, [name]: name === "tel" ? value.replace(/[^0-9]/g, "") : value }));
    if (formErrors[name]) setFormErrors(p => ({ ...p, [name]: "" }));
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditedData(p => ({ ...p, [name]: name === "tel" ? value.replace(/[^0-9]/g, "") : value }));
    if (formErrors[name]) setFormErrors(p => ({ ...p, [name]: "" }));
  };

  const validateForm = (form) => {
    const errs = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.cCompany) errs.cCompany = "กรุณากรอกชื่อบริษัท";
    if (!form.cSite) errs.cSite = "กรุณากรอกชื่อโครงการ";
    if (!form.cEmail || !emailRegex.test(form.cEmail)) errs.cEmail = "กรุณากรอกอีเมลให้ถูกต้อง";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAddCustomer = async () => {
    if (!validateForm(newCustomerData)) return;
    try {
      const res = await CustomerService.AddCustomer(newCustomerData);
      setCustomers(prev => [...prev, res.data]);
      setModalOpenInsert(false);
      setNewCustomerData(EMPTY_FORM);
      setFormErrors({});
      Swal.fire({ title: "สำเร็จ!", text: "เพิ่มลูกค้าเรียบร้อย", icon: "success" });
      await fetchCustomers();
    } catch (error) {
      console.error("Error adding customer:", error);
      Swal.fire({ title: "เกิดข้อผิดพลาด!", text: "ไม่สามารถเพิ่มลูกค้าได้", icon: "error" });
    }
  };

  const handleUpdateCustomer = async () => {
    if (!validateForm(editedData)) return;
    try {
      await CustomerService.UpdateCustomer(selectedRow?._id, editedData);
      setModalOpenEdit(false);
      setFormErrors({});
      Swal.fire({ title: "สำเร็จ!", text: "แก้ไขข้อมูลลูกค้าเรียบร้อย", icon: "success" });
      await fetchCustomers();
    } catch (error) {
      console.error("Error updating customer:", error);
      Swal.fire({ title: "เกิดข้อผิดพลาด!", text: "ไม่สามารถแก้ไขข้อมูลได้", icon: "error" });
    }
  };

  const handleDeleteRow = async (customerId) => {
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
          await CustomerService.DeleteCustomer(customerId);
          Swal.fire("ลบสำเร็จ!", "", "success");
          await fetchCustomers();
        } catch (error) {
          console.error("Error deleting customer:", error);
          Swal.fire("เกิดข้อผิดพลาด!", "", "error");
        }
      }
    });
  };

  const handleEditOpen = (row) => {
    setSelectedRow(row);
    setEditedData(row);
    setFormErrors({});
    setModalOpenEdit(true);
  };

  const handleCopy = (text, label) => {
    copyToClipboard(text, () => setAlert({ open: true, message: `คัดลอก${label}แล้ว`, severity: "success" }));
  };

  const handleExportCSV = () => {
    const headers = ["บริษัท", "โครงการ", "อีเมล", "ผู้ติดต่อ", "ที่อยู่", "เบอร์โทร", "เลขผู้เสียภาษี"];
    const rows = filteredCustomers.map(c => [c.cCompany, c.cSite, c.cEmail, c.cName, c.address, c.tel, c.tax]);
    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${(c || "").toString().replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers_${moment().format("YYYYMMDD")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setAlert({ open: true, message: "Export CSV เรียบร้อย", severity: "success" });
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
  const filteredCustomers = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    return customers.filter((customer) =>
      customer.cCompany?.toLowerCase().includes(lowerSearch) ||
      customer.cSite?.toLowerCase().includes(lowerSearch) ||
      customer.cEmail?.toLowerCase().includes(lowerSearch)
    );
  }, [customers, searchTerm]);

  const sortedCustomers = useMemo(
    () => filteredCustomers.slice().sort(getComparator(order, orderBy)),
    [filteredCustomers, order, orderBy]
  );

  const paginatedCustomers = useMemo(
    () => sortedCustomers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [sortedCustomers, page, rowsPerPage]
  );

  useEffect(() => { setPage(0); }, [searchTerm]);

  const stats = useMemo(() => {
    const total = customers.length;
    const thisMonth = customers.filter(c =>
      c.createdAt && moment(c.createdAt).format("YYYY-MM") === moment().format("YYYY-MM")
    ).length;
    const incomplete = customers.filter(c => !c.cEmail || !c.tel || !c.address).length;
    return { total, thisMonth, incomplete };
  }, [customers]);

  const statCards = [
    { label: "ลูกค้าทั้งหมด", value: stats.total, bar: "linear-gradient(135deg,#667eea,#764ba2)", icon: <GroupsIcon />, sub: "บริษัท/โครงการที่ดูแลอยู่" },
    { label: "เพิ่มเดือนนี้", value: stats.thisMonth, bar: "linear-gradient(135deg,#10b981,#059669)", icon: <CalendarMonthIcon />, sub: moment().format("MMMM YYYY") },
    { label: "ข้อมูลไม่ครบ", value: stats.incomplete, bar: "linear-gradient(135deg,#f59e0b,#d97706)", icon: <WarningAmberIcon />, sub: "ขาดอีเมล/เบอร์/ที่อยู่" },
  ];

  const visibleHeadCells = HEAD_CELLS.filter(c => !isSmallScreen || !["cName", "tel"].includes(c.id));

  return (
    <>
      <Box sx={{ px: { xs: 1, sm: 2, md: 3 }, py: 3, maxWidth: 1400, mx: "auto" }}>

        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h5" fontWeight={800} letterSpacing={-0.5}>ข้อมูลลูกค้า</Typography>
            <Typography variant="body2" color="text.secondary">
              {loading ? "กำลังโหลด..." : `${filteredCustomers.length} รายการ${searchTerm ? ` · ค้นหา "${searchTerm}"` : ""}`}
            </Typography>
          </Box>
          <Stack direction="row" gap={1}>
            <Tooltip title="Export CSV">
              <IconButton onClick={handleExportCSV} size="small"
                sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained" color="success" startIcon={<AddIcon />}
              onClick={() => { setNewCustomerData(EMPTY_FORM); setFormErrors({}); setModalOpenInsert(true); }}
              sx={{ borderRadius: 2, fontWeight: 700, textTransform: "none" }}
            >
              เพิ่มข้อมูลลูกค้าใหม่
            </Button>
          </Stack>
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
            placeholder="ค้นหาบริษัท, โครงการ, อีเมล..."
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
          ) : filteredCustomers.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
              <FolderOpenIcon sx={{ fontSize: 48, opacity: 0.25, mb: 1 }} />
              <Typography fontWeight={600}>
                {searchTerm ? "ไม่พบลูกค้าที่ตรงกับการค้นหา" : "ยังไม่มีข้อมูลลูกค้า"}
              </Typography>
              <Typography variant="body2" color="text.disabled">
                {searchTerm ? "ลองเปลี่ยนคำค้นหาดูอีกครั้ง" : "กด “เพิ่มข้อมูลลูกค้าใหม่” เพื่อเริ่มต้น"}
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
                    {paginatedCustomers.map((row) => (
                      <CustomerRow
                        key={row._id}
                        row={row}
                        isSmallScreen={isSmallScreen}
                        onEdit={handleEditOpen}
                        onDelete={handleDeleteRow}
                        onCopy={handleCopy}
                      />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={filteredCustomers.length}
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
      <CustomerFormModal
        open={modalOpenInsert}
        mode="add"
        data={newCustomerData}
        errors={formErrors}
        onChange={handleChange}
        onClose={() => setModalOpenInsert(false)}
        onSubmit={handleAddCustomer}
        isSmallScreen={isSmallScreen}
      />

      {/* Edit modal */}
      <CustomerFormModal
        open={modalOpenEdit}
        mode="edit"
        data={editedData}
        errors={formErrors}
        onChange={handleEditChange}
        onClose={() => setModalOpenEdit(false)}
        onSubmit={handleUpdateCustomer}
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

export default Customer;