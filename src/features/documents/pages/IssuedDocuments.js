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
import useRealtime from "@/shared/realtime/useRealtime";
import {
  Box, Stack, Typography, IconButton, Tooltip, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Skeleton,
  Chip, MenuItem, Menu, Pagination, useMediaQuery, Collapse, Divider, Alert,
} from "@mui/material";
import {
  Refresh, Tune, Description, EventAvailable, MoreVert,
  EditNote, OpenInNew, Inventory2, Visibility,
} from "@mui/icons-material";
import SelectField from "@/shared/ui/SelectField";
import MobileFilterSheet, { FilterSheetButton, ActiveFilterChips, SheetOptions, SheetSearch, SheetLabel } from "@/shared/ui/MobileFilterSheet";
import {
  PageHeader, Kpi, KpiRow, FilterBar, Panel, EmptyState, DotLabel,
  INK, INK_2, MUTED, FAINT, LINE, SURFACE, ACCENT_DARK, TABLE_HEAD_SX, TABLE_ROW_SX, ICON_BTN_SX,
} from "@/shared/ui/PageKit";
import { Link, useSearchParams } from "react-router-dom";
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

const ACCENT = "#2563eb";
const OUTLINE_SX = { textTransform: "none", fontWeight: 700, borderRadius: 2, height: 40, px: 1.75, color: INK_2, border: `1px solid ${LINE}`, bgcolor: "#fff", whiteSpace: "nowrap" };

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

  // ✅ ?q= จากลิงก์ "เปิดในทะเบียนเอกสาร" ในกล่องออกเอกสาร — เปิดมาแล้วค้นเลขที่ใบนั้นให้เลย
  const [searchParams] = useSearchParams();
  const initialQ = searchParams.get("q") || "";
  const [search, setSearch] = useState(initialQ);
  // ✅ คำค้นที่ "ยิงจริง" แยกจากคำที่กำลังพิมพ์ — ไม่งั้นทุกตัวอักษรที่พิมพ์ = 1 คำขอไปที่ server
  const [appliedSearch, setAppliedSearch] = useState(initialQ);
  const [docType, setDocType] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [menu, setMenu] = useState(null); // { anchor, row }

  // ✅ จอคอม 10 แถว / มือถือ 5 แถว ต่อหน้า — จอแคบแสดงเป็นการ์ดแนวตั้งซึ่งสูงกว่าแถวตารางหลายเท่า
  // ถ้าใส่จำนวนเท่ากันจะต้องเลื่อนยาวมากกว่าจะถึงปุ่มเปลี่ยนหน้า
  const PAGE_SIZE = isMobile ? 5 : 10;

  // ⚠️ หน่วง 400ms ก่อนยิงค้นหา — พิมพ์คำยาวๆ จะยิงคำขอครั้งเดียวตอนหยุดพิมพ์ ไม่ใช่ทุกตัวอักษร
  useEffect(() => {
    const t = setTimeout(() => { setAppliedSearch(search.trim()); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchRows = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setError(""); }
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

  // ✅ เรียลไทม์: ออกเอกสาร/ยกเลิกเอกสารจากเครื่องอื่น → ทะเบียนอัปเดตทันที
  useRealtime("documents", () => { fetchRows(true); });

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
      confirmButtonColor: "#2563eb",
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
    return <Tooltip title={meta.desc}><span><DotLabel color={meta.color}>{meta.label}</DotLabel></span></Tooltip>;
  };

  /** ชนิดเอกสาร — ไอคอนสีเล็ก + ชื่อ (สีอยู่ที่ไอคอนเท่านั้น) */
  const TypeLabel = ({ value }) => {
    const meta = DOC_TYPE_META[value];
    if (!meta) return <span>-</span>;
    return (
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: meta.color, minWidth: 0 }}>
        {meta.icon}
        <Typography noWrap sx={{ fontSize: "0.76rem", fontWeight: 700, color: INK_2 }}>{meta.label}</Typography>
      </Stack>
    );
  };

  const filterCount = (docType !== "all" ? 1 : 0) + (from ? 1 : 0) + (to ? 1 : 0);
  const RowActions = ({ r }) => (
    <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
      <Tooltip title="ดูเอกสาร · พิมพ์ · ส่งอีเมล">
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); openPreview(r); }} sx={{ color: INK_2 }}><Visibility sx={{ fontSize: 19 }} /></IconButton>
      </Tooltip>
      {canEditRow(r) && (
        <IconButton size="small" aria-label="จัดการ" onClick={(e) => { e.stopPropagation(); setMenu({ anchor: e.currentTarget, row: r }); }} sx={{ color: MUTED }}>
          <MoreVert sx={{ fontSize: 19 }} />
        </IconButton>
      )}
    </Stack>
  );

  return (
    <Box sx={{ maxWidth: 1500, mx: "auto", p: { xs: 1.25, sm: 2 } }}>
      {/* ✅ ผู้ใช้สั่ง (3 ต.ค. 2569): "หน้าเอกสารยังไม่เข้าธีม ดูข้อมูลยาก" — ใช้ชุด PageKit เดียวกับทุกหน้า
          (หัวกล่องขาว · ตัวเลขสรุปกดกรองได้ · แถบค้นหา · รายการพื้นขาว สีน้อย) */}
      <PageHeader
        icon={<Description />}
        title="ทะเบียนเอกสาร"
        subtitle="ใบแจ้งเข้างาน / ใบส่งมอบงาน ที่ออกจากระบบ — ดู พิมพ์ ส่งอีเมล และติดตามสถานะ"
        actions={isMobile
          ? <FilterSheetButton count={(appliedSearch ? 1 : 0) + (status !== "all" ? 1 : 0) + filterCount} onClick={() => setSheetOpen(true)} />
          : <Tooltip title="โหลดใหม่"><IconButton onClick={() => fetchRows()} sx={ICON_BTN_SX}><Refresh sx={{ fontSize: 20 }} /></IconButton></Tooltip>}
      />

      {/* ✅ มือถือ: ตัวเลขสรุป/ค้นหา/ตัวกรอง อยู่ในแผ่นล่าง (แบบหน้าใบเบิก) — เหลือแค่ชิปตัวกรองที่ใช้อยู่เหนือรายการ */}
      {isMobile && (
        <>
          <ActiveFilterChips items={[
            appliedSearch && { key: "q", label: `ค้นหา: ${appliedSearch}`, onDelete: () => setSearch("") },
            status !== "all" && { key: "s", label: `สถานะ: ${STATUS_META[status]?.label}`, onDelete: () => { setStatus("all"); setPage(1); } },
            docType !== "all" && { key: "t", label: DOC_TYPE_META[docType]?.label, onDelete: () => { setDocType("all"); setPage(1); } },
            from && { key: "f", label: `ตั้งแต่ ${thaiDate(from)}`, onDelete: () => { setFrom(""); setPage(1); } },
            to && { key: "to", label: `ถึง ${thaiDate(to)}`, onDelete: () => { setTo(""); setPage(1); } },
          ].filter(Boolean)} />
          <MobileFilterSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onClear={clearFilters}
            activeCount={activeFilters.length} resultLabel={`ดูผลลัพธ์ ${total.toLocaleString()} ฉบับ`}>
            <SheetSearch value={search} onChange={setSearch} placeholder="ค้นหาเลขที่ / โครงการ / บริษัท / เรื่อง" />
            <SheetLabel>สถานะ</SheetLabel>
            <SheetOptions value={status} onChange={(v) => { setStatus(v); setPage(1); }}
              options={[{ value: "all", label: "ทั้งหมด", count: totalAll }, ...STATUS_ORDER.map((st) => ({ value: st, label: STATUS_META[st].label, count: statusCounts[st] || 0 }))]} />
            <SheetLabel>ชนิดเอกสาร</SheetLabel>
            <SheetOptions value={docType} onChange={(v) => { setDocType(v); setPage(1); }}
              options={[{ value: "all", label: "ทุกชนิด" }, ...Object.entries(DOC_TYPE_META).map(([k, v]) => ({ value: k, label: v.label }))]} />
            <SheetLabel>ช่วงวันที่ออก</SheetLabel>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
              <ThaiDatePicker label="ตั้งแต่" value={from} onChange={(v) => { setFrom(v); setPage(1); }} />
              <ThaiDatePicker label="ถึง" value={to} onChange={(v) => { setTo(v); setPage(1); }} />
            </Box>
          </MobileFilterSheet>
        </>
      )}

      {!isMobile && <>
      <KpiRow columns={5}>
        <Kpi label="ทั้งหมด" value={totalAll.toLocaleString()} sub="ฉบับ" active={status === "all"} onClick={() => { setStatus("all"); setPage(1); }} />
        {STATUS_ORDER.map((s) => (
          <Kpi key={s} label={STATUS_META[s].label} value={(statusCounts[s] || 0).toLocaleString()} sub="ฉบับ"
            active={status === s} onClick={() => { setStatus(status === s ? "all" : s); setPage(1); }} />
        ))}
      </KpiRow>

      <FilterBar search={search} onSearch={setSearch} placeholder="ค้นหาเลขที่ / โครงการ / บริษัท / เรื่อง / ผู้ออก">
        <Button onClick={() => setFiltersOpen((v) => !v)} startIcon={<Tune sx={{ fontSize: 18 }} />}
          sx={{ ...OUTLINE_SX, width: { xs: "100%", sm: "auto" }, ...(filterCount ? { color: ACCENT_DARK, borderColor: "#bfdbfe", bgcolor: "#eff6ff" } : {}) }}>
          ตัวกรอง{filterCount ? ` · ${filterCount}` : ""}
        </Button>
      </FilterBar>

      <Collapse in={filtersOpen}>
        <Box sx={{ mb: 1.5, p: 1.5, bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" } }}>
          <SelectField label="ชนิดเอกสาร" value={docType} onChange={(e) => { setDocType(e.target.value); setPage(1); }}>
            <option value="all">ทุกชนิด</option>
            {Object.entries(DOC_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </SelectField>
          <ThaiDatePicker label="ออกตั้งแต่วันที่" value={from} onChange={(v) => { setFrom(v); setPage(1); }} />
          <ThaiDatePicker label="ถึงวันที่" value={to} onChange={(v) => { setTo(v); setPage(1); }} />
        </Box>
      </Collapse>

      </>}

      {!isMobile && activeFilters.length > 0 && (
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1.25, flexWrap: "wrap", rowGap: 0.75 }} useFlexGap>
          <Typography sx={{ fontSize: "0.76rem", color: MUTED, fontWeight: 700 }}>กรองอยู่:</Typography>
          {activeFilters.map((f) => <Chip key={f} size="small" label={f} sx={{ height: 22, fontSize: "0.72rem", fontWeight: 600, bgcolor: "#fff", border: `1px solid ${LINE}` }} />)}
          <Button size="small" onClick={clearFilters} sx={{ textTransform: "none", fontWeight: 700, color: ACCENT_DARK, minWidth: 0 }}>ล้างทั้งหมด</Button>
        </Stack>
      )}

      {error && <Alert severity="error" sx={{ mb: 1.5, borderRadius: 2 }}>{error}</Alert>}

      {loading ? (
        <Skeleton variant="rounded" height={320} sx={{ borderRadius: 3 }} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Inventory2 />}
          title={activeFilters.length ? "ไม่พบเอกสารที่ตรงกับตัวกรอง" : "ยังไม่มีเอกสารในทะเบียน"}
          hint={activeFilters.length ? activeFilters.join(" · ") : "เอกสารจะถูกบันทึกที่นี่อัตโนมัติเมื่อกดยืนยันออกเอกสารจากหน้างาน"}
          action={activeFilters.length ? <Button size="small" onClick={clearFilters} sx={{ ...OUTLINE_SX, mt: 1 }}>ล้างตัวกรอง</Button> : null} />
      ) : isMobile ? (
        /* ── มือถือ: รายการการ์ด — เลขที่+ชนิด · โครงการ · เรื่อง · สถานะ/วันที่/ปุ่ม ── */
        <Panel>
          {rows.map((r, i) => (
            <Box key={r._id} onClick={() => openPreview(r)} role="button"
              sx={{ px: 1.75, py: 1.5, borderTop: i ? `1px solid ${LINE}` : "none", cursor: "pointer", opacity: r.status === "cancelled" ? 0.55 : 1, "&:active": { bgcolor: SURFACE } }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography sx={{ fontWeight: 900, fontSize: "0.92rem", color: INK, fontVariantNumeric: "tabular-nums" }}>{r.docNumber}</Typography>
                <Box sx={{ flex: 1 }} />
                <TypeLabel value={r.docType} />
              </Stack>
              <Typography sx={{ fontWeight: 700, fontSize: "0.88rem", color: INK, mt: 0.5, lineHeight: 1.35 }}>{r.site || "—"}</Typography>
              {(r.subject || r.customerCompany) && (
                <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {r.subject || r.customerCompany}
                </Typography>
              )}
              {r.note && <Typography sx={{ fontSize: "0.76rem", color: "#92400e", mt: 0.25 }}>หมายเหตุ: {r.note}</Typography>}
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                <StatusChip value={r.status} />
                <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.74rem", color: FAINT }}>
                  {thaiDate(r.issuedAt)}{r.issuedByName ? ` · ${r.issuedByName}` : ""}
                </Typography>
                <RowActions r={r} />
              </Stack>
            </Box>
          ))}
        </Panel>
      ) : (
        <Panel>
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 880, tableLayout: "fixed" }}>
              <TableHead sx={TABLE_HEAD_SX}>
                <TableRow>
                  <TableCell sx={{ width: 110 }}>เลขที่</TableCell>
                  <TableCell sx={{ width: 130 }}>ชนิด</TableCell>
                  <TableCell>โครงการ / เรื่อง</TableCell>
                  <TableCell sx={{ width: 160 }}>งาน</TableCell>
                  <TableCell sx={{ width: 120 }}>ออกเมื่อ / โดย</TableCell>
                  <TableCell sx={{ width: 150 }}>สถานะ</TableCell>
                  <TableCell sx={{ width: 84 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r._id} hover onClick={() => openPreview(r)}
                    sx={{ ...TABLE_ROW_SX, cursor: "pointer", opacity: r.status === "cancelled" ? 0.55 : 1 }}>
                    <TableCell><Typography sx={{ fontWeight: 800, fontSize: "0.84rem", color: INK, fontVariantNumeric: "tabular-nums" }}>{r.docNumber}</Typography></TableCell>
                    <TableCell><TypeLabel value={r.docType} /></TableCell>
                    <TableCell sx={{ maxWidth: 360 }}>
                      <Typography noWrap sx={{ fontWeight: 700, fontSize: "0.84rem", color: INK }}>{r.site || "—"}</Typography>
                      <Typography noWrap sx={{ fontSize: "0.74rem", color: MUTED }}>{r.subject || r.customerCompany || ""}</Typography>
                      {r.note && <Typography noWrap sx={{ fontSize: "0.72rem", color: "#92400e" }}>หมายเหตุ: {r.note}</Typography>}
                    </TableCell>
                    <TableCell>
                      <Typography noWrap sx={{ fontSize: "0.8rem", color: INK_2 }}>{r.workLabel || "—"}</Typography>
                      {r.roundLabel && <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>ครั้งที่ {r.roundLabel}</Typography>}
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: "0.8rem", color: INK_2, fontVariantNumeric: "tabular-nums" }}>{thaiDate(r.issuedAt)}</Typography>
                      <Typography noWrap sx={{ fontSize: "0.72rem", color: MUTED }}>{r.issuedByName || "—"}</Typography>
                    </TableCell>
                    <TableCell><StatusChip value={r.status} /></TableCell>
                    <TableCell align="right"><RowActions r={r} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Panel>
      )}

      {/* ── เมนูจัดการแต่ละแถว ── */}
      <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)} PaperProps={{ sx: { borderRadius: 2.5, minWidth: 230 } }}>
        <Typography sx={{ px: 2, pt: 1, pb: 0.5, display: "block", fontSize: "0.74rem", fontWeight: 800, color: MUTED }}>เปลี่ยนสถานะเป็น</Typography>
        {STATUS_ORDER.map((s) => {
          const meta = STATUS_META[s];
          const current = menu?.row?.status === s;
          return (
            <MenuItem key={s} disabled={current} onClick={() => changeStatus(menu.row, s)} sx={{ fontSize: "0.86rem", fontWeight: current ? 800 : 500 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: meta.color, mr: 1.25, flexShrink: 0 }} />
              {meta.label}{current ? " (ปัจจุบัน)" : ""}
            </MenuItem>
          );
        })}
        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={() => editNote(menu.row)} sx={{ fontSize: "0.86rem" }}>
          <EditNote sx={{ fontSize: 18, mr: 1.25, color: MUTED }} /> บันทึกเพิ่มเติม
        </MenuItem>
        {menu?.row?.eventId && (
          <MenuItem component={Link} to={`/operation/${menu.row.eventId}`} onClick={() => setMenu(null)} sx={{ fontSize: "0.86rem" }}>
            <OpenInNew sx={{ fontSize: 17, mr: 1.25, color: MUTED }} /> เปิดงานต้นทาง
          </MenuItem>
        )}
      </Menu>

      {/* ✅ กล่องดูเอกสารย้อนหลัง — ตัวเดียวกับตอนออกเอกสาร (ดู/พิมพ์/แชร์/ส่งอีเมล) */}
      {previewRow && (
        <DocumentPreviewDialog
          open
          title={DOC_TYPE_META[previewRow.docType]?.label || "เอกสาร"}
          accent={DOC_TYPE_META[previewRow.docType]?.color || ACCENT}
          preview={preview}
          issued
          docNumber={previewRow.docNumber}
          busy={previewBusy}
          onClose={() => { setPreviewRow(null); setPreview(null); }}
          email={{
            docType: DOC_TYPE_META[previewRow.docType]?.label || "เอกสาร",
            refId: String(previewRow.eventId || previewRow._id || ""),
            defaultTo: [],
            customerMatch: { company: previewRow.customerCompany, site: previewRow.site },
            recipientName: previewRow.formSnapshot?.attention || "",
            project: previewRow.site || "",
            audience: "customer",
          }}
        />
      )}

      {totalPages > 1 && (
        <Stack alignItems="center" spacing={0.75} sx={{ mt: 2 }}>
          <Pagination count={totalPages} page={Math.min(page, totalPages)} onChange={(_, p) => setPage(p)} shape="rounded" />
          <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>ทั้งหมด {total.toLocaleString()} ฉบับ · หน้า {Math.min(page, totalPages)}/{totalPages}</Typography>
        </Stack>
      )}
    </Box>
  );
};

export default IssuedDocuments;
