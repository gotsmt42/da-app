/* eslint-disable no-unused-vars */
/**
 * Customer/index.js — v4
 *
 * เปลี่ยนจาก v3:
 *   ❌ ตัด MUI Table (คอลัมน์ตายตัว 6 คอลัมน์) ทิ้ง — ยังเป็นเลย์เอาต์ desktop-first อยู่ดี ต้อง
 *      ซ่อน/บีบคอลัมน์บนจอเล็ก อ่านยากบนมือถือ
 *   ✅ เปลี่ยนเป็นการ์ดวางซ้อนกันแนวตั้ง (CustomerCard) อ่านง่ายเหมือนกันทั้งจอเล็ก/จอใหญ่:
 *        - โครงการ (cSite) เป็นชื่อหลัก เพราะเป็นฟิลด์เดียวที่บังคับกรอก บริษัทเป็นบรรทัดรองถ้ามี
 *        - แสดงเฉพาะข้อมูลที่มีจริง (ผู้ติดต่อ/เบอร์/อีเมล/ที่อยู่/เลขผู้เสียภาษี) ไม่โชว์ "—"
 *          หรือชิป "ไม่มี..." เกลื่อนการ์ดอีกต่อไป เพราะฟิลด์เหล่านี้ไม่บังคับกรอกแล้ว
 *        - ตัดสถิติ "ข้อมูลไม่ครบ" และคำเตือน "ข้อมูลติดต่อยังไม่ครบถ้วน" ออก (ไม่สื่อความหมาย
 *          อีกต่อไปเมื่อฟิลด์พวกนี้เป็นทางเลือก ไม่ใช่ข้อผิดพลาด)
 *        - ตัดฟิลด์ "ชื่อโปรเจค" (row.projName) ที่ไม่มีอยู่จริงใน schema ออก (โชว์ "—" เปล่าๆ มาตลอด)
 *   ✅ คงฟีเจอร์เดิมทั้งหมด: สถิติสรุป (เหลือ 2 การ์ด), ค้นหา, กรองโครงการเดียวจาก Dashboard,
 *      เพิ่ม/แก้ไขลูกค้า, ลบ, Export CSV, ประวัติงานรายปี, Snackbar, Pagination
 *
 * หมายเหตุ: handleUpdateCustomer เรียก CustomerService.UpdateCustomer(id, data)
 * โปรดตรวจสอบว่ามีเมธอดนี้จริงในฝั่ง service
 */

import React, { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import CustomerService from "../../../services/CustomerService";
import EventService from "../../../services/EventService";
import Swal from "sweetalert2";
import moment from "moment";
import "moment/locale/th";

import {
  Modal, TextField, Button, Snackbar, Alert, Box, Stack, Typography, Avatar,
  Chip, IconButton, Tooltip, Divider, Grid, Skeleton, InputAdornment,
  useMediaQuery, TablePagination, Collapse,
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
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import WorkHistoryIcon from "@mui/icons-material/WorkHistory";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import AssignmentIcon from "@mui/icons-material/Assignment";
import CircleIcon from "@mui/icons-material/Circle";
import FilterAltIcon from "@mui/icons-material/FilterAlt";

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

// ✅ การ์ดรายชื่อลูกค้า — เดิมใช้ MUI Table (คอลัมน์ตายตัว 6 คอลัมน์) ซึ่งบนมือถือต้องบีบ/ซ่อน
// คอลัมน์จนอ่านยาก เปลี่ยนเป็นการ์ดวางซ้อนกันแนวตั้งแทน อ่านง่ายทั้งจอเล็ก/จอใหญ่เหมือนกัน
const CustomerCardBox = styled(Box)(({ theme }) => ({
  background: theme.palette.background.paper,
  borderRadius: 14,
  border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
  overflow: "hidden",
  transition: "box-shadow .15s ease",
  "&:hover": { boxShadow: `0 2px 10px ${alpha(theme.palette.common.black, 0.06)}` },
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

// ✅ สีสถานะงาน — ใช้โทนเดียวกับหน้า Dashboard/Operation ให้เห็นภาพเดียวกันทั้งแอป
const STATUS_COLORS = {
  "กำลังรอยืนยัน": "#f59e0b",
  "ยืนยันแล้ว": "#3b82f6",
  "กำลังดำเนินการ": "#8b5cf6",
  "ดำเนินการเสร็จสิ้น": "#10b981",
};
const statusColor = (status) => STATUS_COLORS[status] || "#64748b";

// ✅ เดิมบังคับกรอกบริษัท+อีเมลด้วย ทั้งที่งานจริงบางโครงการยังไม่มีข้อมูลสองอย่างนี้ตอนสร้าง
// (เช่น เพิ่งมีชื่อไซต์งานให้ก่อน) — บังคับแค่ "โครงการ" ช่องเดียว ที่เหลือกรอกทีหลังได้
const FIELD_CONFIG = [
  { name: "cCompany", label: "บริษัท / นิติบุคคล", icon: <BusinessIcon fontSize="small" />, group: "org" },
  { name: "cSite",    label: "โครงการ / ไซต์งาน",   icon: <ApartmentIcon fontSize="small" />, required: true, group: "org" },
  { name: "tax",      label: "เลขประจำตัวผู้เสียภาษี", icon: <BadgeIcon fontSize="small" />, maxLength: 13, group: "org" },
  { name: "cName",    label: "ชื่อผู้ติดต่อ",        icon: <PersonIcon fontSize="small" />, group: "contact" },
  { name: "cEmail",   label: "อีเมล",                icon: <EmailIcon fontSize="small" />, group: "contact" },
  { name: "tel",      label: "เบอร์โทรศัพท์",         icon: <PhoneIcon fontSize="small" />, maxLength: 10, group: "contact" },
  { name: "address",  label: "ที่อยู่",               icon: <HomeIcon fontSize="small" />, multiline: true, group: "contact" },
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

// ─── CustomerCard: การ์ดลูกค้าแบบวางซ้อนกันแนวตั้ง (มือถือ-first) ───────
// เดิมเป็นแถวตาราง 6 คอลัมน์คงที่ ต้องซ่อน/บีบคอลัมน์บนจอเล็ก อ่านยาก — เปลี่ยนเป็นการ์ด
// เดียวที่โชว์เฉพาะข้อมูลที่มีจริง (ไม่มีค่าก็ไม่โชว์แถวนั้นเลย แทนการโชว์ "—"/ชิป "ไม่มี..."
// เกลื่อนทุกใบ เพราะบริษัท/อีเมล/เบอร์/ที่อยู่ ไม่บังคับกรอกแล้ว)
const CustomerCard = ({ row, events, onEdit, onDelete, onCopy }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [openYears, setOpenYears] = useState({}); // ✅ ค่าเริ่มต้นเปิดเฉพาะปีล่าสุดตอน compute ด้านล่าง

  // ✅ โครงการ (cSite) คือฟิลด์เดียวที่บังคับกรอกแล้ว ใช้เป็นชื่อหลัก/สีอวาตาร์แทนบริษัท
  const primaryLabel = row.cSite || row.cCompany || "ไม่ระบุชื่อ";
  const initial = (row.cSite || row.cCompany || "?").charAt(0).toUpperCase();
  const color = colorFromName(row.cSite || row.cCompany || "");

  // ✅ งานที่ทำให้โครงการนี้ — Event ไม่มี customerId อ้างอิงโดยตรง ผูกด้วยการเทียบ
  // company+site ตรงตัว (เหมือน pattern ที่ AddEvent.js ใช้ upsert ลูกค้าอยู่แล้ว)
  const customerEvents = useMemo(
    () => (events || []).filter((e) => e.company === row.cCompany && e.site === row.cSite),
    [events, row.cCompany, row.cSite],
  );

  // ✅ จัดกลุ่มเป็น ปี → ประเภทงาน (title เช่น PM/Service) → รายการงาน เรียงปีใหม่สุดก่อน
  const yearGroups = useMemo(() => {
    const byYear = {};
    customerEvents.forEach((e) => {
      const year = moment(e.start || e.date).format("YYYY");
      if (!byYear[year]) byYear[year] = { jobs: [], typeCounts: {} };
      byYear[year].jobs.push(e);
      const type = e.title || "ไม่ระบุประเภท";
      byYear[year].typeCounts[type] = (byYear[year].typeCounts[type] || 0) + 1;
    });
    return Object.entries(byYear)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([year, data]) => ({
        year,
        jobs: data.jobs.sort((a, b) => new Date(b.start || b.date) - new Date(a.start || a.date)),
        typeCounts: Object.entries(data.typeCounts).sort((a, b) => b[1] - a[1]),
      }));
  }, [customerEvents]);

  const toggleYear = (year) => setOpenYears((p) => ({ ...p, [year]: !p[year] }));

  // ✅ มีค่าอะไรก็โชว์แค่นั้น — เดิมโชว์ชิป "ไม่มีอีเมล"/"ไม่มีเบอร์" ทุกใบเป็นค่าเริ่มต้น
  // ซึ่งตอนนี้เป็นเรื่องปกติ (ไม่บังคับกรอกแล้ว) ไม่ใช่สิ่งที่ต้องเตือนอีกต่อไป
  const contactChips = [
    row.cName && { icon: <PersonIcon sx={{ fontSize: 13 }} />, label: row.cName },
    row.tel && { icon: <PhoneIcon sx={{ fontSize: 13 }} />, label: row.tel, onClick: () => onCopy(row.tel, "เบอร์โทร") },
    row.cEmail && { icon: <EmailIcon sx={{ fontSize: 13 }} />, label: row.cEmail, onClick: () => onCopy(row.cEmail, "อีเมล") },
  ].filter(Boolean);

  const detailFields = [
    row.tax && { label: "เลขประจำตัวผู้เสียภาษี", value: row.tax },
    row.address && { label: "ที่อยู่", value: row.address },
  ].filter(Boolean);

  return (
    <CustomerCardBox>
      <Stack
        direction="row" alignItems="center" gap={1.25}
        onClick={() => setOpen(p => !p)}
        sx={{ p: 1.5, cursor: "pointer" }}
      >
        <Avatar sx={{ width: 38, height: 38, fontSize: "0.9rem", fontWeight: 700, flexShrink: 0, bgcolor: alpha(color, 0.15), color }}>
          {initial}
        </Avatar>
        <Box minWidth={0} flex={1}>
          <Typography fontWeight={700} fontSize="0.88rem" noWrap>{primaryLabel}</Typography>
          {row.cCompany && row.cSite && (
            <Stack direction="row" alignItems="center" gap={0.4}>
              <BusinessIcon sx={{ fontSize: 11, color: "text.disabled" }} />
              <Typography variant="caption" color="text.secondary" noWrap>{row.cCompany}</Typography>
            </Stack>
          )}
        </Box>
        <Tooltip title="แก้ไข">
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEdit(row); }}>
            <EditIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="ลบ">
          <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); onDelete(row._id); }}>
            <DeleteIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
        {open ? <ExpandLessIcon fontSize="small" sx={{ color: "text.disabled" }} /> : <ExpandMoreIcon fontSize="small" sx={{ color: "text.disabled" }} />}
      </Stack>

      {contactChips.length > 0 && (
        <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ px: 1.5, pb: 1.5 }}>
          {contactChips.map((c, i) => (
            <Chip
              key={i} size="small" variant="outlined" icon={c.icon} label={c.label}
              onClick={c.onClick ? (e) => { e.stopPropagation(); c.onClick(); } : undefined}
              deleteIcon={c.onClick ? <ContentCopyIcon sx={{ fontSize: "11px !important" }} /> : undefined}
              onDelete={c.onClick}
              sx={{ fontSize: "0.7rem", height: 24, maxWidth: "100%" }}
            />
          ))}
        </Stack>
      )}

      <Collapse in={open} timeout="auto" unmountOnExit>
        <Box sx={{ px: 1.5, pb: 2, pt: 1, borderTop: "1px solid", borderColor: alpha("#000", 0.06) }}>
          {detailFields.length > 0 && (
            <Stack spacing={1.25} sx={{ mb: 2 }}>
              {detailFields.map((f) => (
                <Box key={f.label}>
                  <SectionLabel>{f.label}</SectionLabel>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>{f.value}</Typography>
                </Box>
              ))}
            </Stack>
          )}

          {/* ─── ประวัติงานรายปี — งานที่ทำให้โครงการนี้ แยกเป็นปี → ประเภทงาน (PM/Service/...) ─── */}
          <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5 }}>
            <WorkHistoryIcon sx={{ fontSize: 16, color: "text.secondary" }} />
            <SectionLabel>ประวัติงานรายปี</SectionLabel>
            <Chip size="small" label={`${customerEvents.length} งานทั้งหมด`}
              sx={{ height: 20, fontSize: "0.65rem", bgcolor: alpha("#667eea", 0.1), color: "#667eea" }} />
          </Stack>

          {yearGroups.length === 0 ? (
            <Typography variant="caption" color="text.disabled">ยังไม่มีประวัติงานของโครงการนี้ในระบบ</Typography>
          ) : (
            <Stack spacing={1}>
              {yearGroups.map(({ year, jobs, typeCounts }, idx) => {
                // ✅ ค่าเริ่มต้น: เปิดเฉพาะปีล่าสุด (แถวแรกหลังเรียงใหม่สุดก่อน) ปีอื่นพับไว้ ไม่ให้รกตา
                const isYearOpen = openYears[year] ?? idx === 0;
                return (
                  <Box key={year} sx={{
                    border: "1px solid", borderColor: alpha("#000", 0.08), borderRadius: 2, overflow: "hidden",
                  }}>
                    <Stack
                      direction="row" alignItems="center" justifyContent="space-between"
                      onClick={() => toggleYear(year)}
                      sx={{ px: 1.5, py: 1, cursor: "pointer", bgcolor: alpha("#667eea", 0.04), "&:hover": { bgcolor: alpha("#667eea", 0.08) } }}
                    >
                      <Stack direction="row" alignItems="center" gap={1}>
                        <ChevronRightIcon sx={{ fontSize: 16, transition: "transform .15s", transform: isYearOpen ? "rotate(90deg)" : "none", color: "text.secondary" }} />
                        <Typography fontWeight={700} fontSize="0.82rem">ปี {year}</Typography>
                        <Chip size="small" label={`${jobs.length} งาน`} sx={{ height: 18, fontSize: "0.62rem" }} />
                      </Stack>
                      <Stack direction="row" gap={0.5} flexWrap="wrap" justifyContent="flex-end">
                        {typeCounts.map(([type, count]) => (
                          <Chip key={type} size="small" label={`${type} · ${count}`}
                            sx={{ height: 18, fontSize: "0.6rem", fontWeight: 700, bgcolor: alpha(colorFromName(type), 0.12), color: colorFromName(type) }} />
                        ))}
                      </Stack>
                    </Stack>

                    <Collapse in={isYearOpen} timeout="auto" unmountOnExit>
                      <Stack divider={<Divider />}>
                        {jobs.map((job) => (
                          <Stack
                            key={job.id || job._id}
                            direction="row" alignItems="center" gap={1.25}
                            onClick={() => navigate(`/operation/${job.id || job._id}`)}
                            sx={{ px: 1.5, py: 1, cursor: "pointer", "&:hover": { bgcolor: alpha("#000", 0.02) } }}
                          >
                            <AssignmentIcon sx={{ fontSize: 15, color: colorFromName(job.title || ""), flexShrink: 0 }} />
                            <Box flex={1} minWidth={0}>
                              <Stack direction="row" alignItems="center" gap={0.6} flexWrap="wrap">
                                <Typography fontWeight={700} fontSize="0.76rem">{job.title || "ไม่ระบุประเภท"}</Typography>
                                {job.system && <Typography variant="caption" color="text.secondary">· {job.system}</Typography>}
                                {job.docNo && <Typography variant="caption" color="text.disabled">· #{job.docNo}</Typography>}
                              </Stack>
                              <Typography variant="caption" color="text.secondary">
                                {moment(job.start || job.date).format("D MMM YYYY")}
                                {job.team && ` · ทีม ${job.team}`}
                              </Typography>
                            </Box>
                            <Chip
                              size="small"
                              icon={<CircleIcon sx={{ fontSize: "8px !important" }} />}
                              label={job.status || "ไม่ระบุ"}
                              sx={{
                                height: 20, fontSize: "0.62rem", fontWeight: 700, flexShrink: 0,
                                bgcolor: alpha(statusColor(job.status), 0.12), color: statusColor(job.status),
                                "& .MuiChip-icon": { color: statusColor(job.status) },
                              }}
                            />
                            <ChevronRightIcon sx={{ fontSize: 15, color: "text.disabled", flexShrink: 0 }} />
                          </Stack>
                        ))}
                      </Stack>
                    </Collapse>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Box>
      </Collapse>
    </CustomerCardBox>
  );
};

// ═══════════════════════════════════════════════════════════════════════
const Customer = () => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery("(max-width:600px)");
  moment.locale("th");

  // ✅ มาจากการ์ด "โครงการที่มีงานมากที่สุด" ในหน้า Dashboard (/customer?company=X&site=Y) —
  // กรองแบบตรงตัวเป๊ะๆ (ไม่ใช่ substring search ธรรมดา) ให้เห็นแค่โครงการนั้นโครงการเดียวจริงๆ
  const [searchParams, setSearchParams] = useSearchParams();
  const projectFilter = useMemo(() => {
    const company = searchParams.get("company");
    const site = searchParams.get("site");
    return (company || site) ? { company: company || "", site: site || "" } : null;
  }, [searchParams]);
  const clearProjectFilter = () => setSearchParams({});

  const [searchTerm, setSearchTerm] = useState("");
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  // ✅ งานทั้งหมด (CalendarEvent) — ใช้คำนวณ "โครงการนี้ทำงานอะไรไปบ้างแต่ละปี" ในแถวขยายรายละเอียด
  // ผูกกับลูกค้าด้วยการเทียบ company+site ตรงๆ เพราะ Event ไม่มี customerId อ้างอิงโดยตรง
  const [events, setEvents] = useState([]);

  const [modalOpenInsert, setModalOpenInsert] = useState(false);
  const [modalOpenEdit, setModalOpenEdit] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [editedData, setEditedData] = useState({});
  const [formErrors, setFormErrors] = useState({});

  const [newCustomerData, setNewCustomerData] = useState(EMPTY_FORM);
  const [alert, setAlert] = useState({ open: false, message: "", severity: "info" });

  // ตาราง: เรียงลำดับ + pagination
  const [order, setOrder] = useState("asc");
  const [orderBy, setOrderBy] = useState("cSite"); // ✅ โครงการเป็นฟิลด์บังคับ ใช้เรียงเริ่มต้นแทนบริษัท (ไม่บังคับกรอกแล้ว)
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    fetchCustomers();
    EventService.getEvents()
      .then((res) => setEvents(res?.userEvents || []))
      .catch((error) => console.error("Error fetching events for customer history:", error));
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

  // ✅ บังคับกรอกแค่ "โครงการ" — บริษัท/อีเมลกรอกทีหลังได้ แต่ถ้ากรอกอีเมลมาก็ยังเช็ครูปแบบให้ถูกต้องอยู่
  const validateForm = (form) => {
    const errs = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.cSite) errs.cSite = "กรุณากรอกชื่อโครงการ";
    if (form.cEmail && !emailRegex.test(form.cEmail)) errs.cEmail = "กรุณากรอกอีเมลให้ถูกต้อง";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ✅ บริษัท+โครงการซ้ำกัน (ทั้งคู่พร้อมกัน) ถูกกันไว้ที่ backend แล้วด้วย unique index
  // (คืน 409 พร้อมข้อความ "มีโครงการนี้อยู่แล้ว") เดิม catch ตรงนี้โชว์ข้อความรวมๆ
  // "ไม่สามารถเพิ่ม/แก้ไขลูกค้าได้" ทุกกรณี ผู้ใช้ไม่รู้เลยว่าที่จริงคือชื่อซ้ำ ไม่ใช่ error อื่น
  const getSaveErrorMessage = (error) =>
    error?.response?.status === 409
      ? (error.response.data || "มีบริษัทและโครงการนี้อยู่แล้ว ห้ามซ้ำกัน")
      : "กรุณาลองใหม่อีกครั้ง";

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
      Swal.fire({ title: "เพิ่มลูกค้าไม่สำเร็จ", text: getSaveErrorMessage(error), icon: "error" });
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
      Swal.fire({ title: "แก้ไขข้อมูลไม่สำเร็จ", text: getSaveErrorMessage(error), icon: "error" });
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
    // ✅ กรองตรงตัวเป๊ะๆ ตามโครงการที่กดมาจาก Dashboard — ทับตัวค้นหาข้อความปกติไว้ก่อน
    if (projectFilter) {
      return customers.filter((customer) =>
        customer.cCompany === projectFilter.company && customer.cSite === projectFilter.site
      );
    }
    const lowerSearch = searchTerm.toLowerCase();
    return customers.filter((customer) =>
      customer.cCompany?.toLowerCase().includes(lowerSearch) ||
      customer.cSite?.toLowerCase().includes(lowerSearch) ||
      customer.cEmail?.toLowerCase().includes(lowerSearch)
    );
  }, [customers, searchTerm, projectFilter]);

  const sortedCustomers = useMemo(
    () => filteredCustomers.slice().sort(getComparator(order, orderBy)),
    [filteredCustomers, order, orderBy]
  );

  const paginatedCustomers = useMemo(
    () => sortedCustomers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [sortedCustomers, page, rowsPerPage]
  );

  useEffect(() => { setPage(0); }, [searchTerm]);

  // ✅ ตัด "ข้อมูลไม่ครบ" ออก — เดิมนับลูกค้าที่ขาดอีเมล/เบอร์/ที่อยู่ แต่ตอนนี้สามอย่างนี้ไม่บังคับ
  // กรอกแล้ว ทำให้ทุกรายการ (แทบ 100%) ขึ้นเป็น "ไม่ครบ" เสมอ กลายเป็นค่าที่ไม่สื่อความหมายอะไร
  const stats = useMemo(() => {
    const total = customers.length;
    const thisMonth = customers.filter(c =>
      c.createdAt && moment(c.createdAt).format("YYYY-MM") === moment().format("YYYY-MM")
    ).length;
    return { total, thisMonth };
  }, [customers]);

  const statCards = [
    { label: "ลูกค้าทั้งหมด", value: stats.total, bar: "linear-gradient(135deg,#667eea,#764ba2)", icon: <GroupsIcon />, sub: "บริษัท/โครงการที่ดูแลอยู่" },
    { label: "เพิ่มเดือนนี้", value: stats.thisMonth, bar: "linear-gradient(135deg,#10b981,#059669)", icon: <CalendarMonthIcon />, sub: moment().format("MMMM YYYY") },
  ];

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
            <Grid item xs={6} key={s.label}>
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

        {/* ✅ แบนเนอร์ตัวกรองโครงการเดียว — มาจากการ์ด "โครงการที่มีงานมากที่สุด" ในหน้า Dashboard
            ต้องมีทางออกชัดเจนเสมอ ไม่งั้นผู้ใช้จะติดอยู่กับลิสต์ 1 แถวโดยไม่รู้จะกลับไปดูทั้งหมดยังไง */}
        {projectFilter && (
          <Box sx={{
            display: "flex", alignItems: "center", gap: 1, mb: 2, px: 2, py: 1.25,
            borderRadius: 2, bgcolor: alpha("#dc2626", 0.06), border: "1px solid", borderColor: alpha("#dc2626", 0.2),
          }}>
            <FilterAltIcon sx={{ fontSize: 18, color: "#dc2626" }} />
            <Typography variant="body2" sx={{ flex: 1, fontWeight: 600, color: "#991b1b" }}>
              กำลังแสดงเฉพาะโครงการ: {projectFilter.company && projectFilter.site
                ? `${projectFilter.company} · ${projectFilter.site}`
                : (projectFilter.company || projectFilter.site)}
            </Typography>
            <Button size="small" startIcon={<ClearIcon fontSize="small" />} onClick={clearProjectFilter}
              sx={{ color: "#dc2626", textTransform: "none", fontWeight: 700, borderRadius: 2 }}>
              ดูทั้งหมด
            </Button>
          </Box>
        )}

        {/* Search */}
        <GlassCard sx={{ p: 2, mb: 2.5 }}>
          <TextField
            placeholder="ค้นหาบริษัท, โครงการ, อีเมล..."
            variant="outlined"
            size="small"
            fullWidth
            value={searchTerm}
            onChange={(e) => {
              if (projectFilter) clearProjectFilter(); // ✅ พิมพ์ค้นหาเองแล้วให้ยกเลิกตัวกรองโครงการเดิมทันที
              setSearchTerm(e.target.value);
            }}
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

        {/* ✅ เรียงลำดับ — เดิมกดที่หัวคอลัมน์ตาราง ตอนนี้ไม่มีหัวตารางแล้ว เหลือปุ่มเดียวสลับทิศทาง */}
        {!loading && filteredCustomers.length > 0 && (
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
            <Button
              size="small" onClick={() => handleSort("cSite")}
              sx={{ textTransform: "none", fontSize: "0.75rem", color: "text.secondary", fontWeight: 600 }}
            >
              เรียงตามโครงการ {order === "asc" ? "A → Z" : "Z → A"}
            </Button>
          </Stack>
        )}

        {/* List */}
        {loading ? (
          <Stack spacing={1.25}>
            {[1, 2, 3, 4].map(i => <Skeleton key={i} variant="rounded" height={64} sx={{ borderRadius: 2 }} />)}
          </Stack>
        ) : filteredCustomers.length === 0 ? (
          <GlassCard sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
            <FolderOpenIcon sx={{ fontSize: 48, opacity: 0.25, mb: 1 }} />
            <Typography fontWeight={600}>
              {projectFilter ? "ไม่พบโครงการนี้ในระบบแล้ว" : searchTerm ? "ไม่พบลูกค้าที่ตรงกับการค้นหา" : "ยังไม่มีข้อมูลลูกค้า"}
            </Typography>
            <Typography variant="body2" color="text.disabled">
              {projectFilter ? "อาจถูกลบไปแล้ว" : searchTerm ? "ลองเปลี่ยนคำค้นหาดูอีกครั้ง" : "กด “เพิ่มข้อมูลลูกค้าใหม่” เพื่อเริ่มต้น"}
            </Typography>
          </GlassCard>
        ) : (
          <>
            <Stack spacing={1.25}>
              {paginatedCustomers.map((row) => (
                <CustomerCard
                  key={row._id}
                  row={row}
                  events={events}
                  onEdit={handleEditOpen}
                  onDelete={handleDeleteRow}
                  onCopy={handleCopy}
                />
              ))}
            </Stack>
            <GlassCard sx={{ mt: 1.5, overflow: "hidden" }}>
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
              />
            </GlassCard>
          </>
        )}
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