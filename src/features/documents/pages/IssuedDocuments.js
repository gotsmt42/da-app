/**
 * IssuedDocuments — "ทะเบียนเอกสารที่ออกแล้ว" (ใบแจ้งเข้างาน / ใบส่งมอบงาน)
 *
 * ✅ ทำไมต้องมีหน้านี้ (ตามที่ผู้ใช้ขอ): เอกสาร 2 ชนิดนี้กิน "เลขที่เอกสารเดินหน้าอย่างเดียว" ตอนกดออก
 * — เลขถูกใช้ไปจริงและซ้ำไม่ได้ แต่เดิมระบบไม่เคยบันทึกไว้เลยว่าเลขไหนเป็นของใบอะไร ออกให้โครงการไหน
 * ใครออก และส่งถึงลูกค้าหรือยัง พอลูกค้าโทรมาถามถึงใบเก่าก็ตามอะไรไม่ได้เลยนอกจากไล่ถามคนที่ออก
 * ✅ หน้านี้คือทะเบียนกลาง: ค้นหา/กรอง/เรียกดูย้อนหลังได้ และเปลี่ยนสถานะติดตามได้ในตารางเลย
 *
 * ⚠️ สิทธิ์: อ่าน + ดูตัวอย่างเอกสาร ได้ทุก role · "เปลี่ยนสถานะ/แก้บันทึก" ได้เมื่อเป็นแอดมิน/ผู้จัดการ
 * หรือเป็น "คนที่ออกใบนั้นเอง" (ช่างออกใบแจ้งเข้างานได้ จึงต้องตามสถานะใบของตัวเองได้ด้วย ไม่ต้องรบกวน
 * แอดมินทุกใบ) — server บังคับกฎเดียวกันอีกชั้นเสมอ ไม่เชื่อการซ่อนปุ่มฝั่งจอ (routes/issuedDocument.js)
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box, Stack, Typography, TextField, InputAdornment, IconButton, Tooltip, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Skeleton,
  Chip, MenuItem, Menu, Pagination, useMediaQuery, Collapse, Divider, Alert,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Search, Close, Refresh, FilterList, Description, EventAvailable, MoreVert,
  EditNote, OpenInNew, Inventory2, Visibility,
} from "@mui/icons-material";
import { Link } from "react-router-dom";
import "@/shared/utils/momentThaiLocale";
import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import { thaiDateNumeric } from "@/shared/utils/thaiDate";
import Swal from "sweetalert2";
import { jsPDF } from "jspdf";
import thSarabunFont from "@/assets/fonts/THSarabunNew_base64";
import { useAuth } from "@/features/auth/AuthContext";
import IssuedDocumentService from "@/shared/services/IssuedDocumentService";
import { generateWorkNoticePdf } from "../utils/workNoticePdf";
import { generateDeliveryNotePdf } from "../utils/deliveryNotePdf";
import DocumentPreviewDialog from "../components/DocumentPreviewDialog";
import { can } from "@/shared/utils/roles";

const ACCENT = "#dc2626";
const SURFACE_SUBTLE = "#f8fafc";
const BORDER_MAIN = "#e2e8f0";
const BORDER_SOFT = "#eef2f7";
const TEXT_SUB = "#64748b";

// ✅ ชนิดเอกสารใช้สีเดียวกับกล่องออกเอกสารของมัน (ฟ้า = ใบแจ้งเข้างาน, แดง = ใบส่งมอบงาน)
// ผู้ใช้จึงกวาดตาแยกออกทันทีว่าแถวไหนเป็นเอกสารชนิดไหน โดยไม่ต้องอ่านตัวหนังสือ
const DOC_TYPE_META = {
  notice: { label: "ใบแจ้งเข้างาน", color: "#0284c7", icon: <EventAvailable sx={{ fontSize: 15 }} /> },
  delivery: { label: "ใบส่งมอบงาน", color: "#dc2626", icon: <Description sx={{ fontSize: 15 }} /> },
};

// ✅ สถานะไล่ตามลำดับการใช้งานจริงหลังออกเอกสาร — สีไล่จาก "เพิ่งออก" (เทา) ไปจนถึง "จบแล้ว" (เขียว)
// ⚠️ "ยกเลิก" ไม่ได้ลบแถวทิ้ง เอกสารที่กินเลขไปแล้วต้องคงอยู่ในทะเบียนเสมอ ไม่งั้นเลขจะขาดช่วงโดยไม่มี
// อะไรอธิบายว่าหายไปไหน
const STATUS_META = {
  issued: { label: "ออกแล้ว", color: "#64748b", desc: "ออกเลขที่เรียบร้อย ยังไม่ได้ส่งให้ลูกค้า" },
  sent: { label: "ส่งให้ลูกค้าแล้ว", color: "#0284c7", desc: "ส่งไปแล้ว รอลูกค้าตอบรับ/เซ็นรับ" },
  acknowledged: { label: "ลูกค้ารับแล้ว", color: "#16a34a", desc: "ลูกค้ารับทราบ/เซ็นรับเรียบร้อย" },
  cancelled: { label: "ยกเลิก", color: "#b45309", desc: "ยกเลิกใบนี้ (เลขที่ยังถูกใช้ไปแล้ว)" },
};
const STATUS_ORDER = ["issued", "sent", "acknowledged", "cancelled"];

// ⚠️ เดิมประกอบ พ.ศ. เองตรงนี้ — ย้ายไปใช้ตัวกลางที่ shared/utils/thaiDate แล้ว
const thaiDate = thaiDateNumeric;

const IssuedDocuments = () => {
  const isMobile = useMediaQuery("(max-width:900px)");
  const { userData } = useAuth();
  const canEdit = can(userData, "editDocuments");

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState({});
  // ✅ ยอดรวมของชิป "ทั้งหมด" — มาจาก server แยกจาก total ของรายการที่กรองสถานะแล้ว (ดู totalAll
  // ใน routes/issuedDocument.js) ไม่งั้นกดชิปสถานะแล้วยอด "ทั้งหมด" จะหดตามไปด้วยซึ่งผิดความหมาย
  const [totalAll, setTotalAll] = useState(0);
  // ✅ ดูตัวอย่างเอกสารย้อนหลัง — สร้างไฟล์ใหม่จาก formSnapshot ที่บันทึกไว้ตอนออกจริง
  const [preview, setPreview] = useState(null);
  const [previewRow, setPreviewRow] = useState(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  // ✅ คำค้นที่ "ยิงจริง" แยกจากคำที่กำลังพิมพ์ — ไม่งั้นทุกตัวอักษรที่พิมพ์ = 1 คำขอไปที่ server
  const [appliedSearch, setAppliedSearch] = useState("");
  const [docType, setDocType] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menu, setMenu] = useState(null); // { anchor, row }

  // ✅ จอคอม 10 แถว / มือถือ 5 แถว ต่อหน้า — จอแคบแสดงเป็นการ์ดแนวตั้งซึ่งสูงกว่าแถวตารางหลายเท่า
  // ถ้าใส่จำนวนเท่ากันจะต้องเลื่อนยาวมากกว่าจะถึงปุ่มเปลี่ยนหน้า
  const PAGE_SIZE = isMobile ? 5 : 10;

  // ⚠️ หน่วง 400ms ก่อนยิงค้นหา — พิมพ์คำยาวๆ จะยิงคำขอครั้งเดียวตอนหยุดพิมพ์ ไม่ใช่ทุกตัวอักษร
  useEffect(() => {
    const t = setTimeout(() => { setAppliedSearch(search.trim()); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await IssuedDocumentService.list({
        page, limit: PAGE_SIZE,
        ...(appliedSearch ? { q: appliedSearch } : {}),
        ...(docType !== "all" ? { docType } : {}),
        ...(status !== "all" ? { status } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      });
      setRows(res.items || []);
      setTotal(res.total || 0);
      setTotalAll(res.totalAll ?? res.total ?? 0);
      setStatusCounts(res.statusCounts || {});
    } catch (err) {
      setError(err?.response?.data?.message || "โหลดทะเบียนเอกสารไม่สำเร็จ");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, PAGE_SIZE, appliedSearch, docType, status, from, to]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // 🐛 กันหน้าค้างเกินจำนวนหน้าจริง (เช่น กรองจนเหลือน้อยลงหลังอยู่หน้า 5) — ตารางจะว่างเปล่าโดยไม่มี
  // อะไรอธิบาย เทียบ pattern เดียวกับ safePage ในหน้า "ภาพรวมงาน"
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const activeFilters = useMemo(() => {
    const list = [];
    if (appliedSearch) list.push(`ค้นหา "${appliedSearch}"`);
    if (docType !== "all") list.push(DOC_TYPE_META[docType]?.label);
    if (status !== "all") list.push(STATUS_META[status]?.label);
    if (from) list.push(`ตั้งแต่ ${thaiDate(from)}`);
    if (to) list.push(`ถึง ${thaiDate(to)}`);
    return list.filter(Boolean);
  }, [appliedSearch, docType, status, from, to]);

  const clearFilters = () => {
    setSearch(""); setAppliedSearch(""); setDocType("all"); setStatus("all");
    setFrom(""); setTo(""); setPage(1);
  };

  // ✅ แก้ไขได้เมื่อ "เป็นแอดมิน/ผู้จัดการ" หรือ "เป็นคนออกใบนั้นเอง" — ตรงกับที่ server บังคับไว้
  // (routes/issuedDocument.js) ช่างจึงอัปเดตสถานะใบของตัวเองได้ ไม่ต้องรบกวนแอดมินทุกใบ
  const canEditRow = (row) =>
    canEdit || String(row?.issuedBy || "") === String(userData?.userId || userData?._id || "");

  // ✅ ดูตัวอย่างเอกสารย้อนหลัง — สร้างไฟล์ใหม่จาก formSnapshot ที่บันทึกไว้ตอนออกจริง
  // ⚠️ ไม่ได้เก็บไฟล์ PDF ไว้ในฐานข้อมูล (ดู models/IssuedDocument.js) — เก็บ "ข้อมูลที่ใช้สร้าง"
  // แทน ซึ่งเล็กกว่าหลายร้อยเท่าและสร้างไฟล์ใบเดิมออกมาได้ตรงกับที่ส่งลูกค้าไปเป๊ะๆ
  const openPreview = async (row) => {
    setMenu(null);
    const form = row?.formSnapshot;
    if (!form || Object.keys(form).length === 0) {
      Swal.fire({
        title: "ดูตัวอย่างไม่ได้",
        text: "ใบนี้ไม่มีข้อมูลที่ใช้สร้างเอกสารเก็บไว้ (อาจถูกบันทึกไว้ก่อนระบบทะเบียนจะรองรับ)",
        icon: "info",
      });
      return;
    }
    setPreviewRow(row);
    setPreview(null);
    setPreviewBusy(true);
    try {
      const gen = row.docType === "notice" ? generateWorkNoticePdf : generateDeliveryNotePdf;
      const { url, blob, fileName } = await gen({ jsPDF, thSarabunFont, form, mode: "blob" });
      setPreview({ url, blob, fileName });
    } catch {
      setPreviewRow(null);
      Swal.fire({ title: "สร้างตัวอย่างไม่สำเร็จ", text: "กรุณาลองใหม่อีกครั้ง", icon: "error" });
    } finally {
      setPreviewBusy(false);
    }
  };

  // ⚠️ คืนหน่วยความจำของไฟล์ตัวอย่างทั้งตอนเปิดใบใหม่ทับและตอนออกจากหน้า — โหมด "blob" ไม่ revoke ให้
  useEffect(() => {
    const url = preview?.url;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [preview?.url]);

  const changeStatus = async (row, next) => {
    setMenu(null);
    try {
      await IssuedDocumentService.update(row._id, { status: next });
      // ✅ อัปเดตในตารางทันทีโดยไม่ต้องโหลดใหม่ทั้งหน้า — แต่ยอดนับตามสถานะด้านบนต้องขอใหม่
      setRows((prev) => prev.map((r) => (r._id === row._id ? { ...r, status: next } : r)));
      fetchRows();
    } catch (err) {
      Swal.fire({ title: "เปลี่ยนสถานะไม่สำเร็จ", text: err?.response?.data?.message || "กรุณาลองใหม่", icon: "error" });
    }
  };

  const editNote = async (row) => {
    setMenu(null);
    const { value, isConfirmed } = await Swal.fire({
      title: "บันทึกเพิ่มเติม",
      input: "textarea",
      inputValue: row.note || "",
      inputPlaceholder: "เช่น ส่งทางอีเมลแล้ว 12/8 · ลูกค้าขอเลื่อนวันเข้า",
      showCancelButton: true,
      confirmButtonText: "บันทึก",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: ACCENT,
    });
    if (!isConfirmed) return;
    try {
      await IssuedDocumentService.update(row._id, { note: value || "" });
      setRows((prev) => prev.map((r) => (r._id === row._id ? { ...r, note: value || "" } : r)));
    } catch (err) {
      Swal.fire({ title: "บันทึกไม่สำเร็จ", text: err?.response?.data?.message || "กรุณาลองใหม่", icon: "error" });
    }
  };

  const StatusChip = ({ value }) => {
    const meta = STATUS_META[value] || STATUS_META.issued;
    return (
      <Tooltip title={meta.desc}>
        <Chip
          size="small" label={meta.label}
          sx={{ height: 22, fontSize: "0.7rem", fontWeight: 700, bgcolor: alpha(meta.color, 0.12), color: meta.color }}
        />
      </Tooltip>
    );
  };

  const TypeChip = ({ value }) => {
    const meta = DOC_TYPE_META[value];
    if (!meta) return <span>-</span>;
    return (
      <Chip
        size="small" icon={meta.icon} label={meta.label}
        sx={{
          height: 22, fontSize: "0.7rem", fontWeight: 700,
          bgcolor: alpha(meta.color, 0.1), color: meta.color,
          "& .MuiChip-icon": { color: meta.color, ml: 0.5 },
        }}
      />
    );
  };

  return (
    <Box sx={{ maxWidth: 1500, mx: "auto" }}>
      {/* ── หัวหน้า ─────────────────────────────────────────────────────── */}
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} spacing={1.5} sx={{ mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: "1.3rem", lineHeight: 1.3 }}>
            ทะเบียนเอกสาร
          </Typography>
          <Typography variant="caption" sx={{ color: TEXT_SUB }}>
            ใบแจ้งเข้างาน / ใบส่งมอบงาน ที่ออกเลขที่ไปแล้วทั้งหมด — ค้นหาและเรียกดูย้อนหลังได้
          </Typography>
        </Box>
        <Tooltip title="โหลดใหม่">
          <IconButton onClick={fetchRows} sx={{ color: TEXT_SUB }}><Refresh /></IconButton>
        </Tooltip>
      </Stack>

      {/* ── แถบสรุปตามสถานะ — กดเพื่อกรองได้เลย ──────────────────────────── */}
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", rowGap: 1 }} useFlexGap>
        <Chip
          label={`ทั้งหมด ${totalAll.toLocaleString()}`}
          onClick={() => { setStatus("all"); setPage(1); }}
          sx={{
            fontWeight: 800,
            bgcolor: status === "all" ? alpha(ACCENT, 0.12) : SURFACE_SUBTLE,
            color: status === "all" ? ACCENT : TEXT_SUB,
            border: `1px solid ${status === "all" ? alpha(ACCENT, 0.4) : BORDER_MAIN}`,
          }}
        />
        {STATUS_ORDER.map((s) => {
          const meta = STATUS_META[s];
          const on = status === s;
          return (
            <Chip
              key={s} label={`${meta.label} ${(statusCounts[s] || 0).toLocaleString()}`}
              onClick={() => { setStatus(on ? "all" : s); setPage(1); }}
              sx={{
                fontWeight: 700,
                bgcolor: on ? alpha(meta.color, 0.15) : SURFACE_SUBTLE,
                color: on ? meta.color : TEXT_SUB,
                border: `1px solid ${on ? alpha(meta.color, 0.45) : BORDER_MAIN}`,
              }}
            />
          );
        })}
      </Stack>

      {/* ── ค้นหา + ตัวกรอง ──────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 3, borderColor: BORDER_MAIN }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
          <TextField
            size="small" fullWidth value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาเลขที่เอกสาร / โครงการ / บริษัท / เรื่อง / ผู้ออก"
            InputProps={{
              startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 19, color: "text.disabled" }} /></InputAdornment>,
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearch("")}><Close sx={{ fontSize: 16 }} /></IconButton>
                </InputAdornment>
              ) : null,
            }}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
          />
          <TextField
            select size="small" value={docType}
            onChange={(e) => { setDocType(e.target.value); setPage(1); }}
            sx={{ width: { xs: "100%", md: 190 }, flexShrink: 0, "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
          >
            <MenuItem value="all">ทุกชนิดเอกสาร</MenuItem>
            {Object.entries(DOC_TYPE_META).map(([k, v]) => (
              <MenuItem key={k} value={k}>{v.label}</MenuItem>
            ))}
          </TextField>
          <Button
            onClick={() => setFiltersOpen((v) => !v)}
            startIcon={<FilterList sx={{ fontSize: 18 }} />}
            sx={{
              textTransform: "none", fontWeight: 700, flexShrink: 0, borderRadius: 2.5, px: 2,
              color: filtersOpen || from || to ? ACCENT : TEXT_SUB,
              bgcolor: filtersOpen || from || to ? alpha(ACCENT, 0.06) : "transparent",
            }}
          >
            ช่วงวันที่
          </Button>
        </Stack>

        <Collapse in={filtersOpen || Boolean(from || to)}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ mt: 1.25 }} alignItems={{ sm: "center" }}>
            <ThaiDatePicker
              label="ออกตั้งแต่วันที่" fullWidth={false}
              value={from} onChange={(v) => { setFrom(v); setPage(1); }}
              textFieldProps={{ sx: { width: { xs: "100%", sm: 210 } } }}
            />
            <ThaiDatePicker
              label="ถึงวันที่" fullWidth={false}
              value={to} onChange={(v) => { setTo(v); setPage(1); }}
              textFieldProps={{ sx: { width: { xs: "100%", sm: 210 } } }}
            />
          </Stack>
        </Collapse>

        {activeFilters.length > 0 && (
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1.25, flexWrap: "wrap", rowGap: 0.75 }} useFlexGap>
            <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 700 }}>กรองอยู่:</Typography>
            {activeFilters.map((f) => (
              <Chip key={f} size="small" variant="outlined" label={f}
                sx={{ height: 21, fontSize: "0.68rem", color: TEXT_SUB, borderColor: alpha("#0f172a", 0.18) }} />
            ))}
            <Button size="small" onClick={clearFilters} startIcon={<Close sx={{ fontSize: 14 }} />}
              sx={{ textTransform: "none", fontWeight: 700, color: ACCENT, minWidth: 0 }}>
              ล้างทั้งหมด
            </Button>
          </Stack>
        )}
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      {/* ── ตาราง ────────────────────────────────────────────────────────── */}
      {loading ? (
        <Skeleton variant="rounded" height={320} sx={{ borderRadius: 3 }} />
      ) : rows.length === 0 ? (
        <Paper variant="outlined" sx={{ textAlign: "center", py: 6, borderRadius: 3, borderStyle: "dashed" }}>
          <Box sx={{
            width: 62, height: 62, borderRadius: "50%", mx: "auto", mb: 1.5,
            display: "flex", alignItems: "center", justifyContent: "center",
            bgcolor: alpha(ACCENT, 0.06), color: alpha(ACCENT, 0.6),
          }}>
            <Inventory2 sx={{ fontSize: 29 }} />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 460, mx: "auto", px: 2 }}>
            {activeFilters.length > 0
              ? `ไม่พบเอกสารที่ตรงกับเงื่อนไขที่กรองอยู่ (${activeFilters.join(" · ")})`
              : "ยังไม่มีเอกสารในทะเบียน — เอกสารจะถูกบันทึกที่นี่อัตโนมัติเมื่อกดยืนยันออกเอกสารจากหน้างาน"}
          </Typography>
          {activeFilters.length > 0 && (
            <Button size="small" variant="outlined" onClick={clearFilters} startIcon={<Close sx={{ fontSize: 16 }} />}
              sx={{ mt: 1.5, textTransform: "none", fontWeight: 700, borderRadius: 2, borderColor: alpha(ACCENT, 0.5), color: ACCENT }}>
              ล้างตัวกรองทั้งหมด
            </Button>
          )}
        </Paper>
      ) : isMobile ? (
        /* ── มุมมองการ์ดสำหรับจอมือถือ ────────────────────────────────────
           🐛 ที่แก้: ตารางนี้ตั้ง minWidth 900px ไว้ (8 คอลัมน์) บนจอ 375px จึงต้องปัดซ้าย-ขวาหลายจอ
           กว่าจะอ่านครบ 1 แถว และพอปัดไปคอลัมน์ขวาสุดก็ลืมไปแล้วว่ากำลังอ่านใบไหนอยู่
           ✅ จอแคบเปลี่ยนเป็นการ์ดแนวตั้ง — ข้อมูลชุดเดียวกันครบทุกตัว แค่เรียงตามลำดับที่ตาต้องการ
           (เลขที่+ชนิด → โครงการ+เรื่อง → งาน → หมายเหตุ → สถานะ+วันที่+ผู้ออก+ปุ่ม) ไม่ต้องปัดจอเลย */
        <Stack spacing={1.25}>
          {rows.map((r) => {
            const typeMeta = DOC_TYPE_META[r.docType];
            return (
              <Paper
                key={r._id} variant="outlined"
                sx={{
                  p: 1.75, borderRadius: 3, borderColor: BORDER_MAIN,
                  boxShadow: "0 1px 2px rgba(15,23,42,0.05)",
                  // ✅ แถบสีชนิดเอกสารที่ขอบซ้าย — แยกใบแจ้งเข้างาน/ใบส่งมอบงานออกจากกันได้ตั้งแต่
                  // กวาดตาผ่าน ไม่ต้องอ่านชิป (ชิปยังอยู่ครบสำหรับคนที่อยากอ่านให้แน่ใจ)
                  borderLeft: `4px solid ${typeMeta?.color || ACCENT}`,
                  opacity: r.status === "cancelled" ? 0.6 : 1,
                }}
              >
                <Stack direction="row" alignItems="flex-start" spacing={1}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: "0.9rem", color: ACCENT, fontVariantNumeric: "tabular-nums", lineHeight: 1.3 }}>
                      {r.docNumber}
                    </Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: "0.88rem", lineHeight: 1.35, mt: 0.25 }}>
                      {r.site || "—"}
                    </Typography>
                  </Box>
                  <TypeChip value={r.docType} />
                </Stack>

                {(r.subject || r.customerCompany) && (
                  <Typography variant="caption" sx={{ display: "block", color: TEXT_SUB, mt: 0.5, lineHeight: 1.45 }}>
                    {r.subject || r.customerCompany}
                  </Typography>
                )}
                {(r.workLabel || r.roundLabel) && (
                  <Typography variant="caption" sx={{ display: "block", color: TEXT_SUB, mt: 0.25 }}>
                    {[r.workLabel, r.roundLabel && `ครั้งที่ ${r.roundLabel}`].filter(Boolean).join("  ·  ")}
                  </Typography>
                )}
                {r.note && (
                  <Typography variant="caption" sx={{ display: "block", mt: 0.5, color: "#b45309", fontStyle: "italic", lineHeight: 1.45 }}>
                    📝 {r.note}
                  </Typography>
                )}

                <Stack
                  direction="row" alignItems="center" spacing={1}
                  sx={{ mt: 1.25, pt: 1.25, borderTop: `1px solid ${BORDER_SOFT}` }}
                >
                  <StatusChip value={r.status} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" sx={{ display: "block", color: "text.disabled", fontSize: "0.68rem", lineHeight: 1.4 }}>
                      {thaiDate(r.issuedAt)}{r.issuedByName ? ` · ${r.issuedByName}` : ""}
                    </Typography>
                  </Box>
                  <IconButton size="small" onClick={() => openPreview(r)} sx={{ color: "text.disabled" }}>
                    <Visibility sx={{ fontSize: 19 }} />
                  </IconButton>
                  {canEditRow(r) && (
                    <IconButton size="small" onClick={(e) => setMenu({ anchor: e.currentTarget, row: r })} sx={{ color: "text.disabled" }}>
                      <MoreVert sx={{ fontSize: 19 }} />
                    </IconButton>
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3, borderColor: BORDER_MAIN, overflowX: "auto" }}>
          <Table size="small" sx={{
            minWidth: 900,
            "& th, & td": { border: "none", borderBottom: `1px solid ${BORDER_SOFT}` },
            "& td": { py: 1 },
          }}>
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.75rem", bgcolor: SURFACE_SUBTLE, color: TEXT_SUB, borderBottom: `1px solid ${BORDER_MAIN}` } }}>
                <TableCell sx={{ width: 130 }}>เลขที่เอกสาร</TableCell>
                <TableCell sx={{ width: 145 }}>ชนิด</TableCell>
                <TableCell sx={{ width: 95 }}>วันที่ออก</TableCell>
                <TableCell>โครงการ / เรื่อง</TableCell>
                <TableCell sx={{ width: 150 }}>งาน</TableCell>
                <TableCell sx={{ width: 130 }}>ผู้ออก</TableCell>
                <TableCell sx={{ width: 150 }}>สถานะ</TableCell>
                <TableCell sx={{ width: 86 }} align="center" />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r, idx) => (
                <TableRow
                  key={r._id}
                  sx={{
                    bgcolor: idx % 2 ? SURFACE_SUBTLE : "#fff",
                    transition: "background-color .12s",
                    "&:hover": { bgcolor: alpha(ACCENT, 0.04) },
                    // ✅ ใบที่ยกเลิกแล้วจางลงทั้งแถว — ยังอยู่ในทะเบียน (เลขถูกใช้ไปแล้ว) แต่ไม่ควรเด่น
                    // เท่าใบที่ยังใช้งานอยู่ เวลากวาดตาหาใบจริงจะได้ไม่สะดุด
                    opacity: r.status === "cancelled" ? 0.55 : 1,
                  }}
                >
                  <TableCell>
                    <Typography sx={{ fontWeight: 800, fontSize: "0.82rem", color: ACCENT, fontVariantNumeric: "tabular-nums" }}>
                      {r.docNumber}
                    </Typography>
                  </TableCell>
                  <TableCell><TypeChip value={r.docType} /></TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: "0.8rem", fontVariantNumeric: "tabular-nums" }}>
                      {thaiDate(r.issuedAt)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 340 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: "0.83rem", lineHeight: 1.35 }}>
                      {r.site || "—"}
                    </Typography>
                    <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", lineHeight: 1.35 }}>
                      {r.subject || r.customerCompany || ""}
                    </Typography>
                    {r.note && (
                      <Typography variant="caption" sx={{ display: "block", mt: 0.25, color: "#b45309", fontStyle: "italic" }}>
                        📝 {r.note}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: "0.78rem" }}>{r.workLabel || "—"}</Typography>
                    {r.roundLabel && (
                      <Typography variant="caption" sx={{ color: TEXT_SUB }}>ครั้งที่ {r.roundLabel}</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: "0.78rem" }}>{r.issuedByName || "—"}</Typography>
                  </TableCell>
                  <TableCell><StatusChip value={r.status} /></TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={0.25} justifyContent="center">
                      {/* ✅ ดูตัวอย่างได้ทุก role — เป็นการอ่านอย่างเดียว ไม่ได้แก้อะไรในทะเบียน */}
                      <Tooltip title="ดูตัวอย่างเอกสาร">
                        <IconButton size="small" onClick={() => openPreview(r)} sx={{ color: "text.disabled" }}>
                          <Visibility sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                      {canEditRow(r) && (
                        <IconButton size="small" onClick={(e) => setMenu({ anchor: e.currentTarget, row: r })} sx={{ color: "text.disabled" }}>
                          <MoreVert sx={{ fontSize: 18 }} />
                        </IconButton>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ── เมนูจัดการแต่ละแถว ───────────────────────────────────────────── */}
      <Menu
        anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)}
        PaperProps={{ sx: { borderRadius: 2.5, minWidth: 230 } }}
      >
        <Typography variant="caption" sx={{ px: 2, pt: 1, pb: 0.5, display: "block", fontWeight: 800, color: TEXT_SUB }}>
          เปลี่ยนสถานะเป็น
        </Typography>
        {STATUS_ORDER.map((s) => {
          const meta = STATUS_META[s];
          const current = menu?.row?.status === s;
          return (
            <MenuItem
              key={s} disabled={current} onClick={() => changeStatus(menu.row, s)}
              sx={{ fontSize: "0.85rem", fontWeight: current ? 800 : 500 }}
            >
              <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: meta.color, mr: 1.25, flexShrink: 0 }} />
              {meta.label}{current ? " (ปัจจุบัน)" : ""}
            </MenuItem>
          );
        })}
        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={() => editNote(menu.row)} sx={{ fontSize: "0.85rem" }}>
          <EditNote sx={{ fontSize: 18, mr: 1.25, color: TEXT_SUB }} /> บันทึกเพิ่มเติม
        </MenuItem>
        {menu?.row?.eventId && (
          <MenuItem
            component={Link} to={`/operation/${menu.row.eventId}`} onClick={() => setMenu(null)}
            sx={{ fontSize: "0.85rem" }}
          >
            <OpenInNew sx={{ fontSize: 17, mr: 1.25, color: TEXT_SUB }} /> เปิดงานต้นทาง
          </MenuItem>
        )}
      </Menu>

      {/* ✅ กล่องดูตัวอย่างเอกสารย้อนหลัง — ใช้กล่องเดียวกับตอนออกเอกสาร (issued=true จึงแสดงปุ่ม
          เปิดแท็บใหม่ / ดาวน์โหลด / แชร์ และไม่มีปุ่มยืนยันออกซ้ำ เพราะใบนี้ออกไปแล้ว) */}
      {previewRow && (
        <DocumentPreviewDialog
          open
          title={DOC_TYPE_META[previewRow.docType]?.label || "เอกสาร"}
          accent={DOC_TYPE_META[previewRow.docType]?.color || ACCENT}
          accentDark={previewRow.docType === "notice" ? "#0369a1" : "#b91c1c"}
          preview={preview}
          issued
          docNumber={previewRow.docNumber}
          busy={previewBusy}
          onClose={() => { setPreviewRow(null); setPreview(null); }}
        />
      )}

      {/* ── แบ่งหน้า ─────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <Stack alignItems="center" sx={{ mt: 2.5 }}>
          <Pagination
            count={totalPages} page={Math.min(page, totalPages)} onChange={(_, p) => setPage(p)}
            color="standard" shape="rounded"
            sx={{ "& .Mui-selected": { bgcolor: `${alpha(ACCENT, 0.12)} !important`, color: ACCENT, fontWeight: 800 } }}
          />
          <Typography variant="caption" sx={{ mt: 0.75, color: TEXT_SUB }}>
            ทั้งหมด {total.toLocaleString()} ฉบับ · หน้า {Math.min(page, totalPages)}/{totalPages}
          </Typography>
        </Stack>
      )}
    </Box>
  );
};

export default IssuedDocuments;
