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
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import useRealtime from "@/shared/realtime/useRealtime";
import {
  Box, Stack, Typography, IconButton, Tooltip, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Skeleton,
  Chip, MenuItem, Menu, Pagination, useMediaQuery, Collapse, Divider, Alert, CircularProgress, Checkbox,
} from "@mui/material";
import { RefreshRounded as Refresh, TuneRounded as Tune, DescriptionRounded as Description, EventAvailableRounded as EventAvailable, MoreVertRounded as MoreVert, EditNoteRounded as EditNote, OpenInNewRounded as OpenInNew, Inventory2Rounded as Inventory2, VisibilityRounded as Visibility, VisibilityOffRounded as VisibilityOff, EditRounded as EditIcon, FiberNewRounded, DownloadRounded as Download, SwapHorizRounded as SwapHoriz, CloseRounded as CloseIcon } from "@mui/icons-material";
import EventService from "@/shared/services/EventService";
import JobCalendarPicker from "@/shared/ui/JobCalendarPicker";
import { useHolidays } from "@/features/ot/components/OtDayInfo";
import lazyWithRetry from "@/shared/utils/lazyWithRetry";

import SelectField from "@/shared/ui/SelectField";
import MobileFilterSheet, { FilterSheetButton, ActiveFilterChips, SheetOptions, SheetSearch, SheetLabel } from "@/shared/ui/MobileFilterSheet";
import {
  PageHeader, Kpi, KpiRow, FilterBar, Panel, EmptyState, DotLabel,
  INK, INK_2, MUTED, FAINT, LINE, SURFACE, ACCENT_DARK, TABLE_HEAD_SX, TABLE_ROW_SX, ICON_BTN_SX,
  PAGE_SX,
} from "@/shared/ui/PageKit";
import { Link, useSearchParams } from "react-router-dom";
import "@/shared/utils/momentThaiLocale";
import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import { thaiDateNumeric } from "@/shared/utils/thaiDate";
import Swal from "@/shared/ui/swal";
import { jsPDF } from "jspdf";
import thSarabunFont from "@/assets/fonts/THSarabunNew_base64";
import { useAuth } from "@/features/auth/AuthContext";
import IssuedDocumentService from "@/shared/services/IssuedDocumentService";
import { saveAs } from "file-saver";
import { zipBlobs } from "@/shared/utils/zipStore";
import { generateWorkNoticePdf } from "../utils/workNoticePdf";
import { generateDeliveryNotePdf } from "../utils/deliveryNotePdf";
import DocumentPreviewDialog from "../components/DocumentPreviewDialog";
import { can } from "@/shared/utils/roles";

// กล่องออกเอกสารโหลดเมื่อกดใช้เท่านั้น (ฟอร์มยาว + ตัวสร้าง PDF)
const WorkNoticeDialog = lazyWithRetry(() => import("../components/WorkNoticeDialog"));
const DeliveryNoteDialog = lazyWithRetry(() => import("../components/DeliveryNoteDialog"));

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

/**
 * ✅ (25 พ.ย. 2569) ใบที่แก้ไขย้อนหลัง / ออกใหม่แทน — บอกในทะเบียนให้ตามได้ว่าใบไหนเป็นฉบับล่าสุด
 */
const RevisionTag = ({ r }) => {
  const text = r.supersededByNumber ? `ถูกแทนด้วย ${r.supersededByNumber}`
    : r.supersedesNumber ? `แทนใบ ${r.supersedesNumber}`
    : r.revisionNo ? `แก้ไข ${r.revisionNo} ครั้ง` : "";
  if (!text) return null;
  return (
    <Box component="span" sx={{ display: "inline-block", mt: 0.25, px: 0.75, borderRadius: 1, fontSize: "0.66rem", fontWeight: 800, lineHeight: "18px", whiteSpace: "nowrap",
      bgcolor: "#f1f5f9", color: "#475569" }}>{text}</Box>
  );
};

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
  // 🐛 (26 พ.ย. 2569 ผู้ใช้: "more กดแล้วไปขึ้นมุมจอ") เดิมยึดปุ่มที่กด (anchorEl) — แถวถูกวาดใหม่ตอนเปิดเมนู ปุ่มเดิมหลุดจากหน้า
  //    เมนูจึงเด้งไปมุมซ้ายบน → จำ "ตำแหน่งบนจอ" ของปุ่มแทน (anchorPosition) ไม่ขึ้นกับการวาดใหม่
  const [menu, setMenu] = useState(null); // { pos: {top,left}, row }
  /**
   * ✅ (26 พ.ย. 2569 ผู้ใช้: "ขอเพิ่มเมนูสำหรับออกใบแจ้งงาน ใบส่งมอบงานแยกออกมา ไม่ใช่ออกได้แค่ใน event ของงาน")
   * ออกเอกสารจากหน้านี้ได้เลย: เลือกงานจากปฏิทิน (หรือไม่ผูกงาน — ผู้มีสิทธิ์แก้เอกสาร) → กล่องออกเอกสารตัวเดิม
   * เมนู ⋮ → แก้ไขเอกสาร (เลขเดิม) / ออกใบใหม่แทน (เลขใหม่) ใช้กล่องเดียวกัน
   * issue = { type: "notice"|"delivery", step: "pick"|"form", job, docOverride, initialMode }
   */
  const [issue, setIssue] = useState(null);
  const [issueBusy, setIssueBusy] = useState(false);
  /**
   * ✅ (28 พ.ย. 2569 ผู้ใช้: "ทำให้มี select เลือกเพื่อเลือกดาวน์โหลด หรือดำเนินการต่างๆ แบบหลายไฟล์ทีเดียว")
   *    ติ๊กเลือกหลายใบ (ข้ามหน้า/ตัวกรองได้ — จำตาม id) → ดาวน์โหลด PDF (หลายใบ = ZIP ไฟล์เดียว) / เปลี่ยนสถานะทีเดียว
   *    ใบที่ยกเลิกแล้วเลือกไม่ได้ (ดู/พิมพ์ไม่ได้ และเปลี่ยนสถานะไม่ได้)
   */
  const [selected, setSelected] = useState(() => new Map()); // id → row
  const [bulk, setBulk] = useState(null); // { label, done, total } ระหว่างทำงาน
  const [bulkMenu, setBulkMenu] = useState(null); // anchor ของเมนูเปลี่ยนสถานะ
  const holidays = useHolidays(null);

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
  useEffect(() => {
    setSelected((prev) => {
      if (!prev.size) return prev;
      let changed = false;
      const next = new Map(prev);
      rows.forEach((r) => {
        if (!next.has(r._id)) return;
        changed = true;
        if (r.status === "cancelled") next.delete(r._id); else next.set(r._id, r);
      });
      return changed ? next : prev;
    });
  }, [rows]);

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
    /**
     * ✅ (28 พ.ย. 2569 ผู้ใช้: "หน้าเอกสาร ถ้ามีการกดยกเลิก ไม่ให้สามารถดู หรือพิมพ์เอกสารได้")
     *    ใบที่ยกเลิกแล้วเปิดดู/พิมพ์/ส่งอีเมลไม่ได้ — กันเอาใบที่ไม่ใช้แล้วไปพิมพ์ส่งลูกค้าผิด (เลขที่ยังเก็บไว้ในทะเบียน)
     */
    if (row?.status === "cancelled") {
      Swal.fire({
        title: "เอกสารนี้ถูกยกเลิกแล้ว",
        text: `ใบ ${row.docNumber || ""} ยกเลิกแล้ว จึงดูหรือพิมพ์ไม่ได้ — ถ้ายังต้องใช้ ให้ออกเอกสารใบใหม่`,
        icon: "info",
        confirmButtonColor: ACCENT,
      });
      return;
    }
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
    // ยกเลิก = ดู/พิมพ์ใบนี้ไม่ได้อีก และย้อนกลับไม่ได้ — ถามก่อน
    if (next === "cancelled") {
      const ok = await Swal.fire({
        title: `ยกเลิกใบ ${row.docNumber || ""}?`,
        text: "ยกเลิกแล้วจะดู พิมพ์ หรือส่งอีเมลใบนี้ไม่ได้อีก และเปลี่ยนกลับไม่ได้ (เลขที่ยังถูกใช้ไปแล้ว) — ถ้าต้องการแก้เนื้อหา ใช้ \"แก้ไขเอกสาร\" หรือ \"ออกใบใหม่แทน\"",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "ยกเลิกใบนี้",
        cancelButtonText: "ไม่ยกเลิก",
        confirmButtonColor: "#dc2626",
        reverseButtons: true,
      });
      if (!ok.isConfirmed) return;
    }
    try {
      await IssuedDocumentService.update(row._id, { status: next });
      // ✅ อัปเดตในตารางทันทีโดยไม่ต้องโหลดใหม่ทั้งหน้า — แต่ยอดนับตามสถานะด้านบนต้องขอใหม่
      setRows((prev) => prev.map((r) => (r._id === row._id ? { ...r, status: next } : r)));
      fetchRows();
    } catch (err) {
      Swal.fire({ title: "เปลี่ยนสถานะไม่สำเร็จ", text: err?.response?.data?.message || "กรุณาลองใหม่", icon: "error" });
    }
  };

  // ── เลือกหลายใบ ──
  const selectable = (r) => r?.status !== "cancelled";
  const toggleRow = (r) => setSelected((prev) => {
    const next = new Map(prev);
    if (next.has(r._id)) next.delete(r._id); else next.set(r._id, r);
    return next;
  });
  const pageSelectable = rows.filter(selectable);
  const pageAllOn = pageSelectable.length > 0 && pageSelectable.every((r) => selected.has(r._id));
  const pageSomeOn = pageSelectable.some((r) => selected.has(r._id));
  const togglePage = () => setSelected((prev) => {
    const next = new Map(prev);
    if (pageAllOn) pageSelectable.forEach((r) => next.delete(r._id));
    else pageSelectable.forEach((r) => next.set(r._id, r));
    return next;
  });
  const clearSelected = () => setSelected(new Map());

  /** ดาวน์โหลด PDF ของใบที่เลือก — 1 ใบ = PDF · หลายใบ = ZIP ไฟล์เดียว (สร้างจาก formSnapshot เหมือนปุ่มดู) */
  const bulkDownload = async () => {
    const list = [...selected.values()].filter(selectable);
    const ready = list.filter((r) => r.formSnapshot && Object.keys(r.formSnapshot).length);
    const noData = list.length - ready.length;
    if (!ready.length) {
      Swal.fire({ title: "ดาวน์โหลดไม่ได้", text: "ใบที่เลือกไม่มีข้อมูลที่ใช้สร้างเอกสารเก็บไว้", icon: "info", confirmButtonColor: ACCENT });
      return;
    }
    setBulk({ label: "กำลังสร้าง PDF", done: 0, total: ready.length });
    const files = [];
    let failed = 0;
    for (const r of ready) {
      try {
        const gen = r.docType === "notice" ? generateWorkNoticePdf : generateDeliveryNotePdf;
        // eslint-disable-next-line no-await-in-loop
        const { url, blob, fileName } = await gen({ jsPDF, thSarabunFont, form: r.formSnapshot, mode: "blob" });
        if (url) URL.revokeObjectURL(url);
        files.push({ name: fileName || `${r.docNumber || "document"}.pdf`, blob });
      } catch {
        failed += 1;
      }
      setBulk((b) => (b ? { ...b, done: b.done + 1 } : b));
    }
    try {
      if (files.length === 1) saveAs(files[0].blob, files[0].name);
      else if (files.length > 1) {
        setBulk((b) => (b ? { ...b, label: "กำลังรวมเป็น ZIP" } : b));
        const zip = await zipBlobs(files);
        saveAs(zip, `เอกสาร ${files.length} ใบ ${thaiDateNumeric(new Date()).replace(/\//g, "-")}.zip`);
      }
    } finally {
      setBulk(null);
    }
    const skipped = [noData ? `ไม่มีข้อมูลสร้างเอกสาร ${noData} ใบ` : "", failed ? `สร้างไม่สำเร็จ ${failed} ใบ` : ""].filter(Boolean);
    if (skipped.length) Swal.fire({ title: `ดาวน์โหลดแล้ว ${files.length} ใบ`, text: `ข้าม: ${skipped.join(" · ")}`, icon: "info", confirmButtonColor: ACCENT });
  };

  /** เปลี่ยนสถานะหลายใบ — เฉพาะใบที่ผู้ใช้มีสิทธิ์ (แอดมิน/คนออกใบ) · ยกเลิก = ถามก่อน */
  const bulkStatus = async (next) => {
    setBulkMenu(null);
    const list = [...selected.values()].filter((r) => selectable(r) && r.status !== next);
    const allowed = list.filter(canEditRow);
    const denied = list.length - allowed.length;
    if (!allowed.length) {
      Swal.fire({ title: "ไม่มีใบที่เปลี่ยนได้", text: denied ? `ไม่มีสิทธิ์เปลี่ยนสถานะ ${denied} ใบ (เปลี่ยนได้เฉพาะใบที่ตัวเองออก)` : `ใบที่เลือกเป็น "${STATUS_META[next].label}" อยู่แล้ว`, icon: "info", confirmButtonColor: ACCENT });
      return;
    }
    const ok = await Swal.fire({
      title: `เปลี่ยนเป็น "${STATUS_META[next].label}" ${allowed.length} ใบ?`,
      text: next === "cancelled"
        ? "ยกเลิกแล้วจะดู พิมพ์ หรือส่งอีเมลใบเหล่านี้ไม่ได้อีก และเปลี่ยนกลับไม่ได้"
        : [allowed.map((r) => r.docNumber).slice(0, 8).join(", ") + (allowed.length > 8 ? " …" : ""), denied ? `(ข้าม ${denied} ใบที่ไม่มีสิทธิ์)` : ""].filter(Boolean).join(" "),
      icon: next === "cancelled" ? "warning" : "question",
      showCancelButton: true,
      confirmButtonText: next === "cancelled" ? "ยกเลิกใบเหล่านี้" : "เปลี่ยนสถานะ",
      cancelButtonText: "ไม่ทำ",
      confirmButtonColor: next === "cancelled" ? "#dc2626" : ACCENT,
      reverseButtons: true,
    });
    if (!ok.isConfirmed) return;
    setBulk({ label: "กำลังเปลี่ยนสถานะ", done: 0, total: allowed.length });
    let failed = 0;
    for (const r of allowed) {
      // eslint-disable-next-line no-await-in-loop
      try { await IssuedDocumentService.update(r._id, { status: next }); } catch { failed += 1; }
      setBulk((b) => (b ? { ...b, done: b.done + 1 } : b));
    }
    setBulk(null);
    clearSelected();
    fetchRows(true);
    if (failed || denied) {
      Swal.fire({ title: `เปลี่ยนแล้ว ${allowed.length - failed} ใบ`, text: [failed ? `ไม่สำเร็จ ${failed} ใบ` : "", denied ? `ไม่มีสิทธิ์ ${denied} ใบ` : ""].filter(Boolean).join(" · "), icon: failed ? "warning" : "info", confirmButtonColor: ACCENT });
    }
  };

  /** งานเต็ม ๆ ของเอกสาร (กล่องออกเอกสารใช้ข้อมูลงานเติมฟอร์ม) — ไม่ได้/ไม่มีงาน = {} (ใบที่ไม่ผูกงาน) */
  const loadJob = async (id, fallback = {}) => {
    if (!id) return {};
    try { return (await EventService.GetEventById(id)) || fallback; } catch { return fallback; }
  };
  const startIssue = (type) => { setMenu(null); setIssue({ type, step: "pick" }); };
  const onPickJob = async ({ jobs: picked }) => {
    const j = picked[0];
    if (!j && !canEdit) {
      Swal.fire({ title: "ต้องเลือกงาน", text: "ออกเอกสารได้เฉพาะงานที่คุณเกี่ยวข้อง — เลือกงานจากปฏิทินก่อน", icon: "info", confirmButtonColor: ACCENT });
      return;
    }
    setIssueBusy(true);
    const job = j ? await loadJob(j._id, j) : {};
    setIssueBusy(false);
    setIssue((cur) => (cur ? { ...cur, step: "form", job } : cur));
  };
  const startChangeDoc = async (row, initialMode) => {
    setMenu(null);
    setIssueBusy(true);
    const job = await loadJob(row.eventId);
    setIssueBusy(false);
    setIssue({ type: row.docType, step: "form", job, docOverride: row, initialMode });
  };
  const closeIssue = () => { setIssue(null); fetchRows(); };

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
      {r.status === "cancelled" ? (
        <Tooltip title="ยกเลิกแล้ว — ดู/พิมพ์ไม่ได้">
          <span><IconButton size="small" disabled aria-label="ยกเลิกแล้ว ดูไม่ได้"><VisibilityOff sx={{ fontSize: 19, color: "#cbd5e1" }} /></IconButton></span>
        </Tooltip>
      ) : (
        <Tooltip title="ดูเอกสาร · พิมพ์ · ส่งอีเมล">
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); openPreview(r); }} sx={{ color: INK_2 }}><Visibility sx={{ fontSize: 19 }} /></IconButton>
        </Tooltip>
      )}
      {canEditRow(r) && (
        <IconButton size="small" aria-label="จัดการ" onClick={(e) => {
          e.stopPropagation();
          const rc = e.currentTarget.getBoundingClientRect();
          setMenu({ pos: { top: rc.bottom + 4, left: rc.right }, row: r });
        }} sx={{ color: MUTED }}>
          <MoreVert sx={{ fontSize: 19 }} />
        </IconButton>
      )}
    </Stack>
  );

  return (
    <Box sx={PAGE_SX}>
      {/* ✅ ผู้ใช้สั่ง (3 ต.ค. 2569): "หน้าเอกสารยังไม่เข้าธีม ดูข้อมูลยาก" — ใช้ชุด PageKit เดียวกับทุกหน้า
          (หัวกล่องขาว · ตัวเลขสรุปกดกรองได้ · แถบค้นหา · รายการพื้นขาว สีน้อย) */}
      <PageHeader
        icon={<Description />}
        title="เอกสารที่ออกจากระบบ"
        subtitle="ใบแจ้งเข้างาน · ใบส่งมอบงาน ที่ระบบออกให้ — ดู พิมพ์ ส่งอีเมล และติดตามสถานะการเซ็นรับ"
        actions={(
          <Stack direction="row" spacing={1} alignItems="center">
            {/* ✅ (26 พ.ย. 2569 ผู้ใช้: "ให้ปุ่มออกใบงาน มาเพิ่มตรงนี้") ออกเอกสารได้จากหน้านี้ ไม่ต้องเข้าไปในงาน */}
            <Button variant="contained" disableElevation onClick={() => startIssue("notice")} startIcon={<EventAvailable sx={{ fontSize: 18 }} />}
              sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, height: 40, px: { xs: 1.25, sm: 1.75 }, whiteSpace: "nowrap", bgcolor: DOC_TYPE_META.notice.color, "&:hover": { bgcolor: "#0369a1" } }}>
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>ออกใบแจ้งเข้างาน</Box>
              <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>แจ้งเข้างาน</Box>
            </Button>
            <Button variant="contained" disableElevation onClick={() => startIssue("delivery")} startIcon={<Description sx={{ fontSize: 18 }} />}
              sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, height: 40, px: { xs: 1.25, sm: 1.75 }, whiteSpace: "nowrap", bgcolor: DOC_TYPE_META.delivery.color, "&:hover": { bgcolor: "#b91c1c" } }}>
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>ออกใบส่งมอบงาน</Box>
              <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>ส่งมอบงาน</Box>
            </Button>
            {isMobile
              ? <FilterSheetButton count={(appliedSearch ? 1 : 0) + (status !== "all" ? 1 : 0) + filterCount} onClick={() => setSheetOpen(true)} />
              : <Tooltip title="โหลดใหม่"><IconButton onClick={() => fetchRows()} sx={ICON_BTN_SX}><Refresh sx={{ fontSize: 20 }} /></IconButton></Tooltip>}
          </Stack>
        )}
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

      {/* แถบทำงานกับใบที่เลือก — โผล่เมื่อเลือกอย่างน้อย 1 ใบ */}
      {selected.size > 0 && (
        <Stack direction="row" alignItems="center" spacing={1} useFlexGap
          sx={{ mb: 1.25, px: { xs: 1.25, sm: 1.75 }, py: 1, flexWrap: "wrap", rowGap: 1, bgcolor: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 3 }}>
          <Typography sx={{ fontSize: "0.86rem", fontWeight: 800, color: "#1e3a8a", mr: "auto" }}>
            {bulk ? `${bulk.label} ${bulk.done}/${bulk.total}…` : `เลือกแล้ว ${selected.size} ใบ`}
            {!bulk && [...selected.keys()].some((id) => !rows.some((r) => r._id === id)) && (
              <Box component="span" sx={{ ml: 0.75, fontWeight: 600, fontSize: "0.74rem", color: "#3b5bdb" }}>(รวมหน้าอื่น)</Box>
            )}
          </Typography>
          <Button size="small" variant="contained" disableElevation onClick={bulkDownload} disabled={Boolean(bulk)}
            startIcon={bulk ? <CircularProgress size={14} color="inherit" /> : <Download />}
            sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, bgcolor: ACCENT, backgroundImage: "none", "&:hover": { bgcolor: ACCENT_DARK } }}>
            {selected.size > 1 ? `ดาวน์โหลด PDF (ZIP ${selected.size} ใบ)` : "ดาวน์โหลด PDF"}
          </Button>
          <Button size="small" onClick={(e) => setBulkMenu(e.currentTarget)} disabled={Boolean(bulk)} startIcon={<SwapHoriz />}
            sx={{ ...OUTLINE_SX, height: 32, color: ACCENT_DARK, borderColor: "#bfdbfe" }}>
            เปลี่ยนสถานะ
          </Button>
          <Button size="small" onClick={clearSelected} disabled={Boolean(bulk)} startIcon={<CloseIcon sx={{ fontSize: 16 }} />}
            sx={{ textTransform: "none", fontWeight: 700, color: MUTED }}>
            ล้างที่เลือก
          </Button>
        </Stack>
      )}
      <Menu open={Boolean(bulkMenu)} anchorEl={bulkMenu} onClose={() => setBulkMenu(null)} PaperProps={{ sx: { borderRadius: 2.5, minWidth: 220 } }}>
        <Typography sx={{ px: 2, pt: 1, pb: 0.5, fontSize: "0.74rem", fontWeight: 800, color: MUTED }}>เปลี่ยน {selected.size} ใบเป็น</Typography>
        {STATUS_ORDER.map((st) => (
          <MenuItem key={st} onClick={() => bulkStatus(st)} sx={{ fontSize: "0.86rem", color: st === "cancelled" ? "#b91c1c" : undefined }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: STATUS_META[st].color, mr: 1.25, flexShrink: 0 }} />
            {STATUS_META[st].label}
          </MenuItem>
        ))}
      </Menu>

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
              sx={{ px: 1.75, py: 1.5, borderTop: i ? `1px solid ${LINE}` : "none", cursor: r.status === "cancelled" ? "default" : "pointer", opacity: r.status === "cancelled" ? 0.55 : 1, "&:active": { bgcolor: r.status === "cancelled" ? "transparent" : SURFACE } }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Checkbox size="small" checked={selected.has(r._id)} disabled={!selectable(r)} onClick={(e) => e.stopPropagation()} onChange={() => toggleRow(r)}
                  inputProps={{ "aria-label": `เลือก ${r.docNumber}` }} sx={{ p: 0.25, ml: -0.5 }} />
                <Typography sx={{ fontWeight: 900, fontSize: "0.92rem", color: INK, fontVariantNumeric: "tabular-nums" }}>{r.docNumber}</Typography>
                <RevisionTag r={r} />
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
            <Table size="small" sx={{ minWidth: 920, tableLayout: "fixed" }}>
              <TableHead sx={TABLE_HEAD_SX}>
                <TableRow>
                  <TableCell padding="checkbox" sx={{ width: 44 }}>
                    <Checkbox size="small" checked={pageAllOn} indeterminate={!pageAllOn && pageSomeOn} disabled={!pageSelectable.length} onChange={togglePage}
                      inputProps={{ "aria-label": "เลือกทุกใบในหน้านี้" }} />
                  </TableCell>
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
                  <TableRow key={r._id} hover={r.status !== "cancelled"} onClick={() => openPreview(r)}
                    selected={selected.has(r._id)}
                    sx={{ ...TABLE_ROW_SX, cursor: r.status === "cancelled" ? "default" : "pointer", opacity: r.status === "cancelled" ? 0.55 : 1 }}>
                    <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                      <Checkbox size="small" checked={selected.has(r._id)} disabled={!selectable(r)} onChange={() => toggleRow(r)}
                        inputProps={{ "aria-label": `เลือก ${r.docNumber}` }} />
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontWeight: 800, fontSize: "0.84rem", color: INK, fontVariantNumeric: "tabular-nums" }}>{r.docNumber}</Typography>
                      <RevisionTag r={r} />
                    </TableCell>
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
      <Menu open={Boolean(menu)} onClose={() => setMenu(null)} anchorReference="anchorPosition" anchorPosition={menu?.pos}
        transformOrigin={{ vertical: "top", horizontal: "right" }} PaperProps={{ sx: { borderRadius: 2.5, minWidth: 240 } }}>
        {menu?.row && menu.row.status !== "cancelled" && [
          <MenuItem key="edit" onClick={() => startChangeDoc(menu.row, "edit")} sx={{ fontSize: "0.86rem", py: 1 }}>
            <EditIcon sx={{ fontSize: 18, mr: 1.25, color: ACCENT }} />
            <Box>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 700 }}>แก้ไขเอกสาร</Typography>
              <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>เลขที่เดิม · เก็บฉบับก่อนแก้ไว้</Typography>
            </Box>
          </MenuItem>,
          <MenuItem key="reissue" onClick={() => startChangeDoc(menu.row, "reissue")} sx={{ fontSize: "0.86rem", py: 1 }}>
            <FiberNewRounded sx={{ fontSize: 18, mr: 1.25, color: ACCENT }} />
            <Box>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 700 }}>ออกใบใหม่แทน</Typography>
              <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>เลขที่ใหม่ · ยกเลิกใบนี้ให้อัตโนมัติ</Typography>
            </Box>
          </MenuItem>,
          <Divider key="d0" sx={{ my: 0.5 }} />,
        ]}
        {/* ใบที่ยกเลิกแล้ว = จบ เปลี่ยนสถานะกลับไม่ได้ (ไม่งั้นกลับมาดู/พิมพ์ได้อีก) */}
        {menu?.row?.status === "cancelled" ? (
          <Typography sx={{ px: 2, py: 1, maxWidth: 280, fontSize: "0.78rem", color: MUTED }}>ใบนี้ยกเลิกแล้ว — ดู พิมพ์ หรือเปลี่ยนสถานะไม่ได้</Typography>
        ) : <Typography sx={{ px: 2, pt: 1, pb: 0.5, display: "block", fontSize: "0.74rem", fontWeight: 800, color: MUTED }}>เปลี่ยนสถานะเป็น</Typography>}
        {menu?.row?.status !== "cancelled" && STATUS_ORDER.map((s) => {
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

      {/* ── ออกเอกสารจากหน้านี้: เลือกงาน → กล่องออกเอกสาร ── */}
      <JobCalendarPicker open={issue?.step === "pick"} onClose={() => setIssue(null)} mode="jobs" max={1} onlyMine="auto" holidays={holidays}
        title={issue?.type === "delivery" ? "เลือกงานที่จะออกใบส่งมอบงาน" : "เลือกงานที่จะออกใบแจ้งเข้างาน"}
        subtitle={canEdit ? "แตะวันในปฏิทิน → แตะงาน → ตกลง · ไม่เลือกงาน = ออกใบที่ไม่ผูกงาน (กรอกเอง)" : "แตะวันในปฏิทิน → แตะงานที่คุณเกี่ยวข้อง → ตกลง"}
        accent={DOC_TYPE_META[issue?.type]?.color || ACCENT} accentDark={issue?.type === "delivery" ? "#b91c1c" : "#0369a1"}
        onPick={onPickJob} />
      {issueBusy && (
        <Box sx={{ position: "fixed", inset: 0, zIndex: 1500, display: "grid", placeItems: "center", bgcolor: "rgba(15,23,42,.18)" }}>
          <CircularProgress />
        </Box>
      )}
      {issue?.step === "form" && (
        <Suspense fallback={null}>
          {issue.type === "delivery" ? (
            <DeliveryNoteDialog open onClose={closeIssue} job={issue.job || {}} docOverride={issue.docOverride || null} initialMode={issue.initialMode || null} />
          ) : (
            <WorkNoticeDialog open onClose={closeIssue} job={issue.job || {}} canUseRunningNumber={canEdit}
              docOverride={issue.docOverride || null} initialMode={issue.initialMode || null} />
          )}
        </Suspense>
      )}

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
