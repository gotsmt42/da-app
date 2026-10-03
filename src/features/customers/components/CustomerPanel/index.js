/**
 * CustomerPanel — ทะเบียนลูกค้า (เพิ่ม / แก้ไข / ลบ · ข้อมูลติดต่อ · ประวัติงานรายปี)
 *
 * ✅ v5 (ผู้ใช้สั่ง 2 ต.ค. 2569 "หน้าลูกค้าทำให้สวยงาม และครบถ้วน" + กฎออกแบบ 6 ข้อ:
 *    สีน้อย · ตัวอักษรชัด · ช่องว่างพอดี · จัดแนวแม่น · component เหมือนหน้าอื่น · กดแล้วเดาได้)
 *   เดิม: การ์ดสถิติไล่สี + ปุ่มเขียว · การ์ดรายการต้องกดกางถึงเห็นที่อยู่/ภาษี/ประวัติ · ชิปประเภทงานหลายสี
 *   ตอนนี้ (ชิ้นส่วนจาก shared/ui/PageKit — หน้าตาเดียวกับหน้าพนักงาน/ใบเบิก/ใบเสนอราคา):
 *     หัวเพจ (ส่งออก CSV + ปุ่มเพิ่มสีเข้ม) → ตัวเลขสรุป → ค้นหา + เรียงตาม → ตาราง (ข้อมูลติดต่อครบในแถวเดียว
 *     + จำนวนงาน) · แท็บเล็ต/มือถือ = การ์ด · กดแถว = กล่องรายละเอียด (ข้อมูลครบ + ประวัติงานรายปี)
 *   ✅ คงฟีเจอร์เดิมครบ: กรองโครงการเดียวจาก Dashboard (?company=&site=) · เพิ่ม/แก้ไข/ลบ · กันชื่อซ้ำ (409) · CSV · เรียลไทม์
 */
import { useMemo, useState, useEffect } from "react";
import useRealtime from "@/shared/realtime/useRealtime";
import { useNavigate, useSearchParams } from "react-router-dom";
import CustomerService from "@/shared/services/CustomerService";
import EventService from "@/shared/services/EventService";
import Swal from "sweetalert2";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import { resolveOperationGroup } from "@/shared/utils/overdueJobs";
import {
  TextField, Button, Snackbar, Alert, Box, Stack, Typography, Avatar, IconButton, Tooltip, Skeleton, useMediaQuery,
  Pagination, Dialog, DialogContent, DialogActions, Table, TableHead, TableBody, TableRow, TableCell, Collapse,
} from "@mui/material";
import {
  Apartment, Add, Edit, DeleteOutline, Close, Download, ContentCopy, ChevronRight, Phone, Email, Person, Place, Receipt,
  FilterAlt, WorkHistory,
} from "@mui/icons-material";
import { formatThai } from "@/shared/utils/thaiDate";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import SelectField from "@/shared/ui/SelectField";
import {
  PageHeader, Kpi, KpiRow, FilterBar, Panel, EmptyState, DotLabel, INK, INK_2, MUTED, FAINT, LINE, SURFACE, DANGER,
  CARD_SHADOW, TABLE_HEAD_SX, TABLE_ROW_SX, PRIMARY_BTN_SX, ICON_BTN_SX,
} from "@/shared/ui/PageKit";

const EMPTY_FORM = { cCompany: "", cSite: "", cEmail: "", cName: "", address: "", tel: "", tax: "" };
const PAGE_SIZE = 15;

// ✅ สีจุดสถานะงาน — ความหมายเดียวกับหน้าการดำเนินงาน (ใช้เป็นจุดเล็กเท่านั้น)
const STATUS_COLORS = { "กำลังรอยืนยัน": "#d97706", "ยืนยันแล้ว": "#2563eb", "กำลังดำเนินการ": "#7c3aed", "ดำเนินการเสร็จสิ้น": "#16a34a" };
const statusColor = (status) => STATUS_COLORS[status] || FAINT;

// ✅ บังคับแค่ "โครงการ" ช่องเดียว — บริษัท/อีเมล/เบอร์/ที่อยู่ กรอกทีหลังได้
const FIELDS = [
  { name: "cSite", label: "โครงการ / ไซต์งาน *", group: "org", wide: true },
  { name: "cCompany", label: "บริษัท / นิติบุคคล", group: "org" },
  { name: "tax", label: "เลขประจำตัวผู้เสียภาษี", group: "org", maxLength: 13, inputMode: "numeric" },
  { name: "cName", label: "ชื่อผู้ติดต่อ", group: "contact" },
  { name: "tel", label: "เบอร์โทรศัพท์", group: "contact", maxLength: 10, inputMode: "tel" },
  { name: "cEmail", label: "อีเมล", group: "contact", wide: true, inputMode: "email" },
  { name: "address", label: "ที่อยู่ (สำหรับออกเอกสาร)", group: "contact", wide: true, multiline: true },
];
const FIELD_SX = { "& .MuiOutlinedInput-root": { borderRadius: 2 } };
const titleOfRow = (r) => r.cSite || r.cCompany || "ไม่ระบุชื่อ";
/** งานของโครงการนี้ — Event ไม่มี customerId จึงเทียบ company+site ตรงตัว (เหมือนตอนลงงานใน AddEvent) */
const eventsOf = (events, r) => (events || []).filter((e) => (e.company || "") === (r.cCompany || "") && (e.site || "") === (r.cSite || ""));

const CustomerFormDialog = ({ open, mode, data, errors, onChange, onClose, onSubmit, fullScreen }) => {
  const group = (key, title) => (
    <Box sx={{ mb: 2.25 }}>
      <Typography sx={{ fontSize: "0.76rem", fontWeight: 800, color: MUTED, mb: 1 }}>{title}</Typography>
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
        {FIELDS.filter((f) => f.group === key).map((f) => (
          <TextField key={f.name} label={f.label} name={f.name} size="small" value={data[f.name] || ""} onChange={onChange}
            multiline={f.multiline} minRows={f.multiline ? 2 : undefined}
            error={Boolean(errors[f.name])} helperText={errors[f.name] || undefined}
            inputProps={{ ...(f.maxLength ? { maxLength: f.maxLength } : {}), ...(f.inputMode ? { inputMode: f.inputMode } : {}) }}
            sx={{ ...FIELD_SX, gridColumn: f.wide ? { sm: "1 / -1" } : undefined }} />
        ))}
      </Box>
    </Box>
  );
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen} PaperProps={{ sx: { borderRadius: fullScreen ? 0 : 3 } }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2.5, py: 1.75, borderBottom: `1px solid ${LINE}` }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: SURFACE, border: `1px solid ${LINE}`, display: "flex", alignItems: "center", justifyContent: "center", color: INK_2 }}>
          {mode === "add" ? <Add sx={{ fontSize: 20 }} /> : <Edit sx={{ fontSize: 18 }} />}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900, fontSize: "1.02rem", color: INK }}>{mode === "add" ? "เพิ่มลูกค้าใหม่" : "แก้ไขข้อมูลลูกค้า"}</Typography>
          <Typography noWrap sx={{ fontSize: "0.76rem", color: MUTED }}>{mode === "add" ? "บังคับแค่ชื่อโครงการ — ข้อมูลอื่นกรอกทีหลังได้" : titleOfRow(data)}</Typography>
        </Box>
        <IconButton size="small" aria-label="ปิด" onClick={onClose}><Close /></IconButton>
      </Stack>
      <DialogContent sx={{ px: 2.5, py: 2.25 }}>
        {group("org", "ข้อมูลโครงการ / บริษัท")}
        {group("contact", "ข้อมูลผู้ติดต่อ")}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.75, borderTop: `1px solid ${LINE}` }}>
        <Button onClick={onClose} sx={{ textTransform: "none", fontWeight: 700, color: MUTED }}>ยกเลิก</Button>
        <Button variant="contained" onClick={onSubmit} sx={PRIMARY_BTN_SX}>{mode === "add" ? "บันทึกลูกค้าใหม่" : "บันทึกการแก้ไข"}</Button>
      </DialogActions>
    </Dialog>
  );
};

/** กล่องรายละเอียดลูกค้า: ข้อมูลติดต่อครบ + ประวัติงานรายปี (กดงานไปหน้าการดำเนินงาน) */
const CustomerDetailDialog = ({ row, events, onClose, onEdit, onDelete, fullScreen }) => {
  const navigate = useNavigate();
  const [openYears, setOpenYears] = useState({});
  const jobs = useMemo(() => (row ? eventsOf(events, row) : []), [events, row]);
  const years = useMemo(() => {
    const byYear = {};
    jobs.forEach((e) => {
      const y = formatThai(moment(e.start || e.date), "YYYY");
      (byYear[y] = byYear[y] || []).push(e);
    });
    return Object.entries(byYear).sort((a, b) => b[0].localeCompare(a[0]))
      .map(([year, list]) => ({ year, list: list.sort((a, b) => new Date(b.start || b.date) - new Date(a.start || a.date)) }));
  }, [jobs]);
  if (!row) return null;
  const name = titleOfRow(row);
  const info = [
    [Person, row.cName],
    [Phone, row.tel, row.tel && `tel:${row.tel}`],
    [Email, row.cEmail, row.cEmail && `mailto:${row.cEmail}`],
    [Place, row.address],
    [Receipt, row.tax && `เลขผู้เสียภาษี ${row.tax}`],
  ].filter(([, v]) => v);
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen} PaperProps={{ sx: { borderRadius: fullScreen ? 0 : 3, bgcolor: SURFACE } }}>
      <Box sx={{ px: 2.5, py: 2, bgcolor: "#fff", borderBottom: `1px solid ${LINE}` }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Avatar variant="rounded" sx={{ width: 40, height: 40, borderRadius: 2, fontWeight: 800, bgcolor: personColor(name) }}>{personInitial(name)}</Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography noWrap sx={{ fontWeight: 900, fontSize: "1.02rem", color: INK }}>{name}</Typography>
            <Typography noWrap sx={{ fontSize: "0.76rem", color: MUTED }}>{row.cCompany && row.cSite ? row.cCompany : "ทะเบียนลูกค้า"} · งาน {jobs.length} รายการ</Typography>
          </Box>
          <IconButton aria-label="ปิด" onClick={onClose}><Close /></IconButton>
        </Stack>
      </Box>
      <DialogContent sx={{ px: 2.5, py: 2 }}>
        <Stack spacing={2}>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: "0.84rem", color: INK, mb: 0.75 }}>ข้อมูลติดต่อ</Typography>
            <Box sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 2.5, p: 1.5, display: "grid", gap: 0.9 }}>
              {info.length ? info.map(([Icon, v, href]) => (
                <Stack key={v} direction="row" spacing={1} alignItems="flex-start">
                  <Icon sx={{ fontSize: 17, color: MUTED, mt: 0.2 }} />
                  <Typography component={href ? "a" : "span"} href={href || undefined}
                    sx={{ fontSize: "0.86rem", color: href ? "#2563eb" : INK, textDecoration: "none", whiteSpace: "pre-line", wordBreak: "break-word" }}>{v}</Typography>
                </Stack>
              )) : <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>ยังไม่ได้กรอกข้อมูลติดต่อ — กด "แก้ไข" เพื่อเพิ่ม</Typography>}
            </Box>
          </Box>

          <Box>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
              <WorkHistory sx={{ fontSize: 17, color: MUTED }} />
              <Typography sx={{ fontWeight: 800, fontSize: "0.84rem", color: INK }}>ประวัติงานรายปี</Typography>
            </Stack>
            {!years.length ? (
              <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>ยังไม่มีงานของโครงการนี้ในระบบ</Typography>
            ) : (
              <Stack spacing={1}>
                {years.map(({ year, list }, idx) => {
                  const open = openYears[year] ?? idx === 0;
                  return (
                    <Box key={year} sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 2.5, overflow: "hidden" }}>
                      <Stack direction="row" alignItems="center" spacing={1} onClick={() => setOpenYears((p) => ({ ...p, [year]: !open }))}
                        sx={{ px: 1.5, py: 1, cursor: "pointer", "&:hover": { bgcolor: SURFACE } }}>
                        <ChevronRight sx={{ fontSize: 18, color: MUTED, transition: "transform .15s", transform: open ? "rotate(90deg)" : "none" }} />
                        <Typography sx={{ flex: 1, fontWeight: 800, fontSize: "0.84rem", color: INK }}>ปี {year}</Typography>
                        <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{list.length} งาน</Typography>
                      </Stack>
                      <Collapse in={open} unmountOnExit>
                        {list.map((job) => (
                          <Stack key={job._id} direction="row" spacing={1.1} alignItems="center"
                            onClick={() => { const g = resolveOperationGroup(job); navigate(`/operation/${job._id}${g ? `?group=${g}` : ""}`); }}
                            sx={{ px: 1.5, py: 1, borderTop: `1px solid ${LINE}`, cursor: "pointer", "&:hover": { bgcolor: SURFACE } }}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography noWrap sx={{ fontSize: "0.82rem", fontWeight: 700, color: INK }}>{[job.title || "ไม่ระบุประเภท", job.system].filter(Boolean).join(" · ")}</Typography>
                              <Typography noWrap sx={{ fontSize: "0.72rem", color: MUTED }}>
                                {formatThai(moment(job.start || job.date), "D MMM YYYY")}{job.team ? ` · ทีม ${job.team}` : ""}{job.docNo ? ` · #${job.docNo}` : ""}
                              </Typography>
                            </Box>
                            <DotLabel color={statusColor(job.status)}>{job.status || "ไม่ระบุ"}</DotLabel>
                            <ChevronRight sx={{ fontSize: 18, color: "#cbd5e1" }} />
                          </Stack>
                        ))}
                      </Collapse>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5, bgcolor: "#fff", borderTop: `1px solid ${LINE}` }}>
        <Button startIcon={<DeleteOutline />} onClick={() => onDelete(row._id)} sx={{ textTransform: "none", fontWeight: 700, color: MUTED, "&:hover": { color: DANGER } }}>ลบ</Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<Edit />} onClick={() => onEdit(row)} sx={PRIMARY_BTN_SX}>แก้ไข</Button>
      </DialogActions>
    </Dialog>
  );
};

const RowActions = ({ row, onEdit, onDelete }) => (
  <Stack direction="row" spacing={0.25} justifyContent="flex-end">
    <Tooltip title="แก้ไข"><IconButton size="small" aria-label="แก้ไข" onClick={(e) => { e.stopPropagation(); onEdit(row); }} sx={{ color: INK_2 }}><Edit sx={{ fontSize: 18 }} /></IconButton></Tooltip>
    <Tooltip title="ลบ"><IconButton size="small" aria-label="ลบ" onClick={(e) => { e.stopPropagation(); onDelete(row._id); }} sx={{ color: MUTED, "&:hover": { color: DANGER } }}><DeleteOutline sx={{ fontSize: 19 }} /></IconButton></Tooltip>
  </Stack>
);

const CopyBtn = ({ text, label, onCopy }) => (
  <Tooltip title={`คัดลอก${label}`}>
    <IconButton size="small" aria-label={`คัดลอก${label}`} onClick={(e) => { e.stopPropagation(); onCopy(text, label); }} sx={{ p: 0.4, color: FAINT, "&:hover": { color: INK_2 } }}>
      <ContentCopy sx={{ fontSize: 14 }} />
    </IconButton>
  </Tooltip>
);

const Who = ({ row, size = 34 }) => {
  const name = titleOfRow(row);
  return (
    <Stack direction="row" spacing={1.1} alignItems="center" sx={{ minWidth: 0 }}>
      <Avatar variant="rounded" sx={{ width: size, height: size, borderRadius: 2, fontSize: size * 0.4, fontWeight: 800, bgcolor: personColor(name), flexShrink: 0 }}>{personInitial(name)}</Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography noWrap sx={{ fontWeight: 800, fontSize: "0.88rem", color: INK, lineHeight: 1.3 }}>{name}</Typography>
        <Typography noWrap sx={{ fontSize: "0.72rem", color: MUTED, lineHeight: 1.3 }}>{row.cCompany && row.cSite ? row.cCompany : row.tax ? `ภาษี ${row.tax}` : "ไม่ระบุบริษัท"}</Typography>
      </Box>
    </Stack>
  );
};

const Customer = () => {
  const isSmallScreen = useMediaQuery("(max-width:600px)");
  // ✅ แท็บเล็ตใช้การ์ด — ตารางกว้างบนจอ 820px ต้องเลื่อนข้างถึงจะเห็นปุ่มแก้ไข/ลบ
  const useCards = useMediaQuery("(max-width:899px)");
  const [detailId, setDetailId] = useState("");
  const [sortBy, setSortBy] = useState("site");
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

  const [page, setPage] = useState(0);

  useEffect(() => {
    fetchCustomers();
    EventService.getEvents()
      .then((res) => setEvents(res?.userEvents || []))
      .catch((error) => console.error("Error fetching events for customer history:", error));
  }, []);

  const fetchCustomers = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await CustomerService.getCustomers();
      setCustomers(res.userCustomers || []);
    } catch (error) {
      console.error("Error fetching customer data:", error);
      if (!silent) setAlert({ open: true, message: "โหลดข้อมูลลูกค้าไม่สำเร็จ", severity: "error" });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // ✅ เรียลไทม์: เพิ่ม/แก้/ลบลูกค้าจากเครื่องอื่น → ทะเบียนอัปเดตทันที
  useRealtime("customers", () => { fetchCustomers(true); });

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
    if (!text) return;
    navigator.clipboard?.writeText(text)
      .then(() => setAlert({ open: true, message: `คัดลอก${label}แล้ว`, severity: "success" }))
      .catch(() => setAlert({ open: true, message: "คัดลอกไม่สำเร็จ", severity: "error" }));
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

  // ─── Derived data ──────────────────────────────────────────────────
  const filteredCustomers = useMemo(() => {
    // ✅ กรองตรงตัวเป๊ะๆ ตามโครงการที่กดมาจาก Dashboard — ทับตัวค้นหาข้อความปกติไว้ก่อน
    if (projectFilter) {
      return customers.filter((customer) =>
        customer.cCompany === projectFilter.company && customer.cSite === projectFilter.site
      );
    }
    const lowerSearch = searchTerm.trim().toLowerCase();
    return customers.filter((c) => !lowerSearch
      || [c.cCompany, c.cSite, c.cEmail, c.cName, c.tel, c.tax, c.address].some((v) => String(v || "").toLowerCase().includes(lowerSearch)));
  }, [customers, searchTerm, projectFilter]);

  // จำนวนงานต่อโครงการ (นับครั้งเดียว ใช้ทั้งตาราง/การ์ด/เรียงลำดับ)
  const jobCounts = useMemo(() => {
    const m = new Map();
    events.forEach((e) => { const k = `${e.company || ""}|${e.site || ""}`; m.set(k, (m.get(k) || 0) + 1); });
    return m;
  }, [events]);
  const jobCountOf = (r) => jobCounts.get(`${r.cCompany || ""}|${r.cSite || ""}`) || 0;

  const sortedCustomers = useMemo(() => {
    const by = (f) => (a, b) => String(a[f] || "~").localeCompare(String(b[f] || "~"), "th");
    const list = filteredCustomers.slice();
    if (sortBy === "company") return list.sort((a, b) => by("cCompany")(a, b) || by("cSite")(a, b));
    if (sortBy === "jobs") return list.sort((a, b) => jobCountOf(b) - jobCountOf(a) || by("cSite")(a, b));
    if (sortBy === "newest") return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return list.sort(by("cSite"));
  }, [filteredCustomers, sortBy, jobCounts]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPage(0); }, [searchTerm, sortBy, projectFilter]);

  // ✅ ตัด "ข้อมูลไม่ครบ" ออก — เดิมนับลูกค้าที่ขาดอีเมล/เบอร์/ที่อยู่ แต่ตอนนี้สามอย่างนี้ไม่บังคับ
  // กรอกแล้ว ทำให้ทุกรายการ (แทบ 100%) ขึ้นเป็น "ไม่ครบ" เสมอ กลายเป็นค่าที่ไม่สื่อความหมายอะไร
  const stats = useMemo(() => {
    const total = customers.length;
    const thisMonth = customers.filter(c =>
      c.createdAt && moment(c.createdAt).format("YYYY-MM") === moment().format("YYYY-MM")
    ).length;
    const companies = new Set(customers.map((c) => String(c.cCompany || "").trim().toLowerCase()).filter(Boolean)).size;
    const withJobs = customers.filter((c) => jobCountOf(c) > 0).length;
    const jobs = customers.reduce((n, c) => n + jobCountOf(c), 0);
    const noContact = customers.filter((c) => !c.tel && !c.cEmail).length;
    return { total, thisMonth, companies, withJobs, jobs, noContact };
  }, [customers, jobCounts]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageCount = Math.max(1, Math.ceil(sortedCustomers.length / PAGE_SIZE));
  const cur = Math.min(page, pageCount - 1);
  const pageRows = sortedCustomers.slice(cur * PAGE_SIZE, cur * PAGE_SIZE + PAGE_SIZE);
  const openAdd = () => { setNewCustomerData(EMPTY_FORM); setFormErrors({}); setModalOpenInsert(true); };
  const detailRow = customers.find((c) => c._id === detailId) || null;

  return (
    <>
      <Box sx={{ p: { xs: 1.25, sm: 2.5 }, maxWidth: 1400, mx: "auto" }}>
        <PageHeader
          icon={<Apartment />}
          title="ทะเบียนลูกค้า"
          subtitle="โครงการ / บริษัท · ผู้ติดต่อ · ที่อยู่และเลขผู้เสียภาษีสำหรับออกเอกสาร"
          actions={(
            <>
              <Tooltip title="ส่งออกรายชื่อเป็นไฟล์ CSV (เปิดด้วย Excel ได้)">
                <span><IconButton onClick={handleExportCSV} disabled={!filteredCustomers.length} sx={ICON_BTN_SX} aria-label="ส่งออก CSV"><Download sx={{ fontSize: 20 }} /></IconButton></span>
              </Tooltip>
              <Button variant="contained" startIcon={<Add />} onClick={openAdd} sx={{ ...PRIMARY_BTN_SX, height: 40, px: { xs: 1.5, sm: 2 } }}>
                <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>เพิ่มลูกค้า</Box>
                <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>เพิ่ม</Box>
              </Button>
            </>
          )}
        />

        {loading ? (
          <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, mb: 1.5 }}>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={76} sx={{ borderRadius: 2.5 }} />)}
          </Box>
        ) : (
          <KpiRow columns={4}>
            <Kpi label="โครงการทั้งหมด" value={`${stats.total} รายการ`} sub={`${stats.companies} บริษัท`} />
            <Kpi label="มีงานในระบบ" value={`${stats.withJobs} รายการ`} sub={`งานรวม ${stats.jobs} รายการ`} />
            <Kpi label="ไม่มีข้อมูลติดต่อ" value={`${stats.noContact} รายการ`} sub="ไม่มีทั้งเบอร์และอีเมล" />
            <Kpi label="เพิ่มเดือนนี้" value={`${stats.thisMonth} รายการ`} sub={formatThai(moment(), "MMMM YYYY")} />
          </KpiRow>
        )}

        {/* ✅ ตัวกรองโครงการเดียว (มาจากการ์ดใน Dashboard) — ต้องมีทางออกชัดเจนเสมอ */}
        {projectFilter && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5, px: 1.5, py: 1, borderRadius: 2.5, bgcolor: "#fff", border: `1px solid ${LINE}`, borderLeft: "4px solid #2563eb" }}>
            <FilterAlt sx={{ fontSize: 18, color: MUTED }} />
            <Typography sx={{ flex: 1, fontSize: "0.84rem", fontWeight: 700, color: INK }}>
              แสดงเฉพาะ: {[projectFilter.company, projectFilter.site].filter(Boolean).join(" · ")}
            </Typography>
            <Button size="small" onClick={clearProjectFilter} sx={{ textTransform: "none", fontWeight: 700, color: INK_2 }}>ดูทั้งหมด</Button>
          </Stack>
        )}

        <FilterBar search={searchTerm} onSearch={(v) => { if (projectFilter) clearProjectFilter(); setSearchTerm(v); }} placeholder="ค้นหาโครงการ / บริษัท / ผู้ติดต่อ / เบอร์ / อีเมล">
          <SelectField label="เรียงตาม" value={sortBy} onChange={(e) => setSortBy(e.target.value)} sx={{ minWidth: { xs: 0, sm: 190 }, flex: { xs: 1, sm: "none" } }}>
            <option value="site">ชื่อโครงการ ก-ฮ</option>
            <option value="company">ชื่อบริษัท ก-ฮ</option>
            <option value="jobs">งานมากที่สุด</option>
            <option value="newest">เพิ่มล่าสุด</option>
          </SelectField>
        </FilterBar>

        {loading ? (
          <Stack spacing={1}>{[1, 2, 3, 4].map((i) => <Skeleton key={i} variant="rounded" height={useCards ? 110 : 56} sx={{ borderRadius: 2.5 }} />)}</Stack>
        ) : filteredCustomers.length === 0 ? (
          <EmptyState icon={<Apartment />}
            title={projectFilter ? "ไม่พบโครงการนี้ในระบบแล้ว" : searchTerm ? "ไม่พบลูกค้าที่ตรงกับการค้นหา" : "ยังไม่มีข้อมูลลูกค้า"}
            hint={projectFilter ? "อาจถูกลบไปแล้ว" : searchTerm ? "ลองเปลี่ยนคำค้นหา" : "กด \"เพิ่มลูกค้า\" เพื่อเริ่มต้น"}
            action={!searchTerm && !projectFilter ? <Button variant="contained" startIcon={<Add />} onClick={openAdd} sx={PRIMARY_BTN_SX}>เพิ่มลูกค้า</Button> : null} />
        ) : useCards ? (
          <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
            {pageRows.map((row) => (
              <Box key={row._id} role="button" onClick={() => setDetailId(row._id)}
                sx={{ p: 1.5, bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, cursor: "pointer", boxShadow: CARD_SHADOW, "&:active": { bgcolor: SURFACE } }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ flex: 1, minWidth: 0 }}><Who row={row} /></Box>
                  <RowActions row={row} onEdit={handleEditOpen} onDelete={handleDeleteRow} />
                </Stack>
                <Box sx={{ mt: 1.25, pt: 1.25, borderTop: `1px solid ${LINE}`, display: "grid", gap: 0.6 }}>
                  {row.cName && <Typography noWrap sx={{ fontSize: "0.82rem", color: INK_2, display: "flex", alignItems: "center", gap: 0.75 }}><Person sx={{ fontSize: 16, color: MUTED }} />{row.cName}</Typography>}
                  {row.tel && (
                    <Typography component="a" href={`tel:${row.tel}`} onClick={(e) => e.stopPropagation()}
                      sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK_2, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 0.75 }}>
                      <Phone sx={{ fontSize: 16, color: MUTED }} />{row.tel}
                    </Typography>
                  )}
                  {row.cEmail && (
                    <Typography component="a" href={`mailto:${row.cEmail}`} onClick={(e) => e.stopPropagation()} noWrap
                      sx={{ fontSize: "0.8rem", color: INK_2, textDecoration: "none", display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                      <Email sx={{ fontSize: 16, color: MUTED, flexShrink: 0 }} /><Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>{row.cEmail}</Box>
                    </Typography>
                  )}
                  {!row.cName && !row.tel && !row.cEmail && <Typography sx={{ fontSize: "0.8rem", color: FAINT }}>ยังไม่มีข้อมูลติดต่อ</Typography>}
                  <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>งานในระบบ {jobCountOf(row)} รายการ</Typography>
                </Box>
              </Box>
            ))}
          </Box>
        ) : (
          <Panel sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 960, ...TABLE_HEAD_SX }}>
              <TableHead>
                <TableRow>
                  <TableCell>โครงการ / บริษัท</TableCell>
                  <TableCell>ผู้ติดต่อ</TableCell>
                  <TableCell>เบอร์โทร</TableCell>
                  <TableCell>อีเมล</TableCell>
                  <TableCell align="right">งาน</TableCell>
                  <TableCell sx={{ width: 96 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {pageRows.map((row) => (
                  <TableRow key={row._id} hover onClick={() => setDetailId(row._id)} sx={{ cursor: "pointer", ...TABLE_ROW_SX }}>
                    <TableCell sx={{ maxWidth: 300 }}><Who row={row} /></TableCell>
                    <TableCell sx={{ maxWidth: 180 }}><Typography noWrap sx={{ fontSize: "0.84rem", color: row.cName ? INK : FAINT }}>{row.cName || "—"}</Typography></TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {row.tel ? (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Typography sx={{ fontSize: "0.84rem", color: INK, fontVariantNumeric: "tabular-nums" }}>{row.tel}</Typography>
                          <CopyBtn text={row.tel} label="เบอร์โทร" onCopy={handleCopy} />
                        </Stack>
                      ) : <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>—</Typography>}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 240 }}>
                      {row.cEmail ? (
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
                          <Typography noWrap sx={{ fontSize: "0.84rem", color: INK, minWidth: 0 }}>{row.cEmail}</Typography>
                          <CopyBtn text={row.cEmail} label="อีเมล" onCopy={handleCopy} />
                        </Stack>
                      ) : <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>—</Typography>}
                    </TableCell>
                    <TableCell align="right">
                      <Typography sx={{ fontSize: "0.88rem", fontWeight: jobCountOf(row) ? 800 : 500, color: jobCountOf(row) ? INK : FAINT, fontVariantNumeric: "tabular-nums" }}>{jobCountOf(row) || "—"}</Typography>
                    </TableCell>
                    <TableCell align="right"><RowActions row={row} onEdit={handleEditOpen} onDelete={handleDeleteRow} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}

        {!loading && filteredCustomers.length > 0 && (
          <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" spacing={1} sx={{ mt: 1.5 }}>
            <Typography sx={{ flex: 1, fontSize: "0.76rem", color: MUTED }}>
              {pageCount > 1 ? `แสดง ${cur * PAGE_SIZE + 1}–${cur * PAGE_SIZE + pageRows.length} จาก ` : ""}{filteredCustomers.length} รายการ
            </Typography>
            {pageCount > 1 && (
              <Pagination count={pageCount} page={cur + 1} onChange={(_, n) => setPage(n - 1)} shape="rounded" size={useCards ? "small" : "medium"} siblingCount={useCards ? 0 : 1}
                sx={{ "& .Mui-selected": { bgcolor: "#eff6ff !important", color: "#1d4ed8", borderColor: "#bfdbfe" } }} />
            )}
          </Stack>
        )}
      </Box>

      {detailRow && (
        <CustomerDetailDialog row={detailRow} events={events} fullScreen={isSmallScreen} onClose={() => setDetailId("")}
          onEdit={(r) => { setDetailId(""); handleEditOpen(r); }} onDelete={(id) => { setDetailId(""); handleDeleteRow(id); }} />
      )}
      <CustomerFormDialog open={modalOpenInsert} mode="add" data={newCustomerData} errors={formErrors} onChange={handleChange}
        onClose={() => setModalOpenInsert(false)} onSubmit={handleAddCustomer} fullScreen={isSmallScreen} />
      <CustomerFormDialog open={modalOpenEdit} mode="edit" data={editedData} errors={formErrors} onChange={handleEditChange}
        onClose={() => setModalOpenEdit(false)} onSubmit={handleUpdateCustomer} fullScreen={isSmallScreen} />

      <Snackbar open={alert.open} autoHideDuration={2500} onClose={() => setAlert((p) => ({ ...p, open: false }))} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={alert.severity} variant="filled" onClose={() => setAlert((p) => ({ ...p, open: false }))} sx={{ borderRadius: 2, fontWeight: 600 }}>{alert.message}</Alert>
      </Snackbar>
    </>
  );
};

export default Customer;
