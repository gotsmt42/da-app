/**
 * ContractOverview.js — "ภาพรวมสัญญา" (เฉพาะแอดมิน/manager)
 *
 * จัดกลุ่มงานที่ผูกด้วย contractGroupId เดียวกัน (ครั้งที่ 1-N ของสัญญาเดียวกัน — ดู AddEvent.js
 * โหมด "สัญญาแบบหลายครั้ง") ให้แสดงเป็นตาราง 1 แถวต่อสัญญา คอลัมน์ตรงกับตาราง Excel ที่ใช้ติดตาม
 * สัญญาบริการอยู่แล้ว (บริษัท/โครงการ/ระบบ/ประเภทงาน/เลขที่สัญญา/ใบเสนอราคา/ระยะเวลา/จำนวนครั้ง/
 * วันที่เข้างานแต่ละครั้ง/มูลค่างาน/ผู้รับผิดชอบ) — งานเก่าที่ยังไม่มี contractGroupId (สร้างก่อนมี
 * ฟีเจอร์นี้) ถูกจัดเป็นสัญญา 1 ครั้งของตัวเอง ไม่หายไปจากตาราง
 */

import { useEffect, useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import moment from "moment";
import "moment/locale/th";
import Swal from "sweetalert2";
import {
  Box, Stack, Typography, TextField, InputAdornment, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Skeleton,
  Dialog, DialogTitle, DialogContent, DialogActions, ToggleButtonGroup, ToggleButton,
  Button, Autocomplete, Alert, Chip, Checkbox, Pagination, useMediaQuery,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Search, Refresh, Download, FolderOpen, Add, Close,
  PlaylistAdd, MergeType, GroupWork,
} from "@mui/icons-material";
import { CSVLink } from "react-csv";
import { useAuth } from "../../auth/AuthContext";
import EventService from "../../services/EventService";
import CustomerService from "../../services/CustomerService";
import AuthService from "../../services/authService";
import JobTypeService from "../../services/JobTypeService";
import SystemTypeService from "../../services/SystemTypeService";
import { formatEventDateRange } from "../../utils/formatDateRange";
import { resolveOperationGroup } from "../../utils/overdueJobs";

const ACCENT = "#dc2626";

// ✅ สไตล์แท็บชิปสลับมุมมอง เทียบ pattern เดียวกับตัวกรองประเภทเอกสารในหน้า "ไฟล์"
// (ServiceReportFiles.js) ให้ธีมสี/ทรงตรงกันทั้งแอป
const VIEW_TAB_SX = {
  textTransform: "none", fontSize: "0.8rem", fontWeight: 700, px: 1.5, py: 0.5, whiteSpace: "nowrap",
  "&.Mui-selected": {
    color: ACCENT, bgcolor: alpha(ACCENT, 0.12), borderColor: alpha(ACCENT, 0.4),
    "&:hover": { bgcolor: alpha(ACCENT, 0.18) },
  },
};

// ✅ สีเดียวกับ OP_COLOR ในหน้า Operation/index.js ให้ตรงกันทั้งแอป — ใช้ไล่สีลิงก์ "ครั้งที่ N"
// ตามสถานะจริงของแต่ละครั้ง (ไม่ใช่สีแดงเดียวทุกอันเหมือนเดิม ซึ่งดูไม่ออกว่าครั้งไหนเสร็จหรือยัง)
const STATUS_COLOR = {
  "กำลังรอยืนยัน": "#f59e0b",
  "ยืนยันแล้ว": "#3b82f6",
  "กำลังดำเนินการ": "#8b5cf6",
  "ดำเนินการเสร็จสิ้น": "#10b981",
};

// ✅ ช่องว่างเดิมใช้ "-" สีเทาเฉยๆ แต่ปนกับ "-" ที่เป็นลิงก์ (สีแดง) ในคอลัมน์ครั้งที่ N ดูแยกยาก
// ว่าอันไหนกดได้ — ใช้ตัวกลมจางๆ แทน ให้ต่างจากลิงก์ชัดเจนขึ้น
const Dash = () => <Box component="span" sx={{ color: "text.disabled", opacity: 0.6 }}>–</Box>;

// ✅ ยืด/หดความกว้างคอลัมน์ได้เองเหมือน Excel — เดิม fix ความกว้างตายตัวทุกคอลัมน์ (CELL_TRUNCATE)
// พอชื่อบริษัท/โครงการยาวๆ ก็โดนตัดด้วย ... เสมอ ต้อง hover ดู tooltip ทุกครั้ง ให้ผู้ใช้ลากขยายเองได้
// ตามที่ต้องการแทน (ความกว้างแต่ละคอลัมน์เก็บไว้ที่ colWidths state เฉพาะตอนเปิดหน้านี้ ไม่บันทึกถาวร)
const DEFAULT_COL_WIDTHS = {
  checkbox: 42, actions: 50,
  company: 170, site: 170, system: 110, title: 170,
  contractNo: 120, quotationNo: 120, contractStart: 100, contractEnd: 100,
  visitCount: 80, progress: 90, jobValue: 100, team: 120,
};
const VISIT_COL_DEFAULT_WIDTH = 110;
const MIN_COL_WIDTH = 50;

const ResizableTh = ({ width, align = "left", children, onResize }) => {
  // ✅ เดิมรองรับแค่ mousedown/mousemove (ลากด้วยเมาส์) — จอมือถือ/แท็บเล็ตไม่มีเมาส์ ลากปรับความกว้าง
  // คอลัมน์ไม่ได้เลย ต้องฟัง touch event คู่กันด้วยเพื่อให้ลากด้วยนิ้วได้เหมือนกัน (เทียบ pattern เดียวกัน
  // เกือบทั้งหมด แค่อ่านพิกัดจาก e.touches[0].clientX แทน e.clientX)
  const startDrag = (startClientX) => {
    const startWidth = width;
    const applyDelta = (clientX) => onResize(Math.max(MIN_COL_WIDTH, startWidth + (clientX - startClientX)));
    const onMouseMove = (e) => applyDelta(e.clientX);
    const onTouchMove = (e) => {
      if (e.touches[0]) { e.preventDefault(); applyDelta(e.touches[0].clientX); }
    };
    const cleanup = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", cleanup);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", cleanup);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", cleanup);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", cleanup);
  };
  const handleMouseDown = (e) => { e.preventDefault(); e.stopPropagation(); startDrag(e.clientX); };
  const handleTouchStart = (e) => {
    e.stopPropagation();
    if (e.touches[0]) startDrag(e.touches[0].clientX);
  };
  return (
    <TableCell
      align={align}
      sx={{ position: "relative", width, minWidth: width, maxWidth: width, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", userSelect: "none" }}
    >
      {children}
      <Box
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        sx={{
          // ✅ กว้างขึ้นจาก 8 → 16px บนพื้นที่แตะ (แต่มองด้วยตายังแคบเท่าเดิม เพราะ hover สีจะแสดงแค่
          // แถบกลางบางๆ) นิ้วมือกดเจาะจงจุดแคบๆ ยากกว่าเมาส์เยอะ ต้องมี hit-area ใหญ่กว่านี้ถึงจะกดโดน
          position: "absolute", top: 0, right: -8, bottom: 0, width: 16, cursor: "col-resize", zIndex: 3,
          touchAction: "none",
          "&:hover": { bgcolor: alpha("#dc2626", 0.5) },
          "&:active": { bgcolor: alpha("#dc2626", 0.6) },
        }}
      />
    </TableCell>
  );
};

// ✅ แก้ไขข้อมูลสัญญาได้ตรงในช่องตารางเลยเหมือน Excel (ไม่ต้องเปิด dialog แยก) — ใช้ได้เฉพาะแถวที่
// เป็นสัญญาจริง (isRealContract) เท่านั้น เพราะอิงจากการอัปเดตผ่าน contractGroupId ซึ่งงานเก่าที่ยัง
// ไม่จัดกลุ่มไม่มี — ต้องอยู่นอกคอมโพเนนต์หลัก (module scope) ไม่งั้นทุก re-render จะได้ function
// identity ใหม่ ทำให้ React มองเป็นคนละคอมโพเนนต์แล้ว unmount/remount ช่องที่กำลังพิมพ์อยู่ (โฟกัสหลุด)
const EditableCell = ({
  value, editing, editValue, editType = "text", editOptions, width, align, editable, saving,
  formatDisplay, title, onStartEdit, onChangeValue, onCommit, onCancel,
}) => {
  const baseSx = { width, maxWidth: width, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

  if (!editable) {
    return <TableCell align={align} title={title} sx={baseSx}>{formatDisplay ? formatDisplay(value) : (value || <Dash />)}</TableCell>;
  }

  if (!editing) {
    return (
      <TableCell
        align={align}
        title={title || "คลิกเพื่อแก้ไข"}
        onClick={onStartEdit}
        sx={{
          ...baseSx, cursor: "pointer",
          "&:hover": { bgcolor: alpha(ACCENT, 0.07), boxShadow: `inset 0 0 0 1px ${alpha(ACCENT, 0.35)}` },
        }}
      >
        {formatDisplay ? formatDisplay(value) : (value || <Dash />)}
      </TableCell>
    );
  }

  return (
    <TableCell align={align} sx={{ width, p: "2px 4px" }}>
      {editType === "select" ? (
        <TextField
          select autoFocus size="small" fullWidth value={editValue} disabled={saving}
          onChange={(e) => onChangeValue(e.target.value)}
          onBlur={onCommit}
          SelectProps={{ native: true }}
          sx={{ "& .MuiOutlinedInput-input": { py: 0.5, fontSize: "0.8rem" } }}
        >
          <option value="">— ไม่ระบุ —</option>
          {(editOptions || []).map((o) => <option key={o} value={o}>{o}</option>)}
        </TextField>
      ) : (
        <TextField
          autoFocus size="small" fullWidth type={editType} disabled={saving}
          value={editValue}
          onChange={(e) => onChangeValue(e.target.value)}
          onBlur={onCommit}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); onCommit(); }
            if (e.key === "Escape") onCancel();
          }}
          InputLabelProps={editType === "date" ? { shrink: true } : undefined}
          sx={{ "& .MuiOutlinedInput-input": { py: 0.5, fontSize: "0.8rem" } }}
        />
      )}
    </TableCell>
  );
};

export default function ContractOverview() {
  const isMobile = useMediaQuery("(max-width:600px)");
  const { userData } = useAuth();
  const role = userData?.role?.toLowerCase();
  const isAdminOrManager = ["admin", "manager"].includes(role);

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // ✅ งานส่วนใหญ่ในระบบยังเป็นงานเก่าที่ยังไม่ได้จัดกลุ่มเป็นสัญญา (สร้างก่อนมีฟีเจอร์นี้) เดิม fallback
  // ให้ทุกงานเก่าขึ้นเป็น "สัญญา" 1 แถวของตัวเอง ทำให้ตารางท่วมไปด้วยแถวที่ไม่มีข้อมูลสัญญาจริงเลย
  // (ขึ้น "-" เกือบทุกช่อง) ดูรก/ไม่มีประโยชน์ — ใช้แท็บสลับมุมมองแทน switch เดียว (เทียบ pattern
  // เดียวกับแท็บประเภทเอกสารในหน้า "ไฟล์") ค่าเริ่มต้นโชว์เฉพาะสัญญาจริงก่อน กันรกตารางเหมือนเดิม
  const [viewFilter, setViewFilter] = useState("contracts"); // "contracts" | "ungrouped" | "all"

  // ✅ ตัวเลือกฟอร์ม "เพิ่มสัญญาใหม่" — ดึงพร้อมกับ events ตอนเปิดหน้า ไม่ต้องรอกดปุ่มเพิ่มก่อนค่อยโหลด
  const [lookups, setLookups] = useState({ customers: [], employees: [], jobTypes: [], systemTypes: [] });

  const fetchData = async () => {
    setLoading(true);
    try {
      // ✅ สัญญาที่เพิ่งสร้างแบบ "ฉบับร่าง" (ยังไม่ลงวันที่เข้างานเลย) เป็น unscheduled:true ซึ่ง
      // getEventOp() (event-op) กรองทิ้งเสมอ — ต้องดึง drafts มารวมด้วย ไม่งั้นสัญญาที่เพิ่งสร้างจะ
      // ไม่โผล่ในตารางเลยจนกว่าจะมีครั้งที่ 1 ถูกลงตารางจริง
      const [res, draftsRes] = await Promise.all([
        EventService.getEventOp().catch(() => ({ userEvents: [] })),
        EventService.GetDraftEvents().catch(() => ({ drafts: [] })),
      ]);
      setEvents([...(res?.userEvents || []), ...(draftsRes?.drafts || [])]);
    } catch (err) {
      console.error("Error fetching contract overview:", err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchLookups = async () => {
    try {
      const [customers, employees, jobTypes, systemTypes] = await Promise.all([
        CustomerService.getCustomers().catch(() => null),
        AuthService.getAllUserData().catch(() => null),
        JobTypeService.getAll().catch(() => null),
        SystemTypeService.getAll().catch(() => null),
      ]);
      setLookups({
        customers: customers?.userCustomers || [],
        employees: employees?.allUser || [],
        jobTypes: jobTypes?.items || [],
        systemTypes: systemTypes?.items || [],
      });
    } catch (err) {
      console.error("Error fetching lookup options:", err);
    }
  };

  useEffect(() => { fetchData(); fetchLookups(); }, []);

  // ✅ จัดกลุ่มด้วย contractGroupId — งานเก่าที่ยังไม่มี (สร้างก่อนมีฟีเจอร์สัญญา) fallback เป็น
  // สัญญา 1 ครั้งของตัวเอง (key เฉพาะ _id) เทียบ pattern เดียวกับ getGroupKey ใน overdueJobs.js
  const contracts = useMemo(() => {
    const map = new Map();
    events.forEach((e) => {
      const key = e.contractGroupId || `nogid:${e._id}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    });
    return [...map.values()]
      .map((visits) => {
        const sorted = visits.slice().sort((a, b) => (Number(a.time) || 0) - (Number(b.time) || 0));
        const head = sorted[0];
        const teamNames = [head.team, ...(head.teamMembers || []).map((m) => m?.name)]
          .filter(Boolean)
          .filter((name, idx, arr) => arr.indexOf(name) === idx);
        return {
          key: head.contractGroupId || `nogid:${head._id}`,
          isRealContract: Boolean(head.contractGroupId),
          company: head.company,
          site: head.site,
          system: head.system,
          title: head.title,
          contractNo: head.contractNo,
          quotationNo: head.quotationNo,
          contractStart: head.contractStart,
          contractEnd: head.contractEnd,
          visitCount: head.visitCount || sorted.length,
          jobValue: head.jobValue,
          team: teamNames.join(", ") || "-",
          visits: sorted,
        };
      })
      .sort((a, b) =>
        (a.company || "").localeCompare(b.company || "", "th") ||
        (a.site || "").localeCompare(b.site || "", "th")
      );
  }, [events]);

  const maxVisitCount = useMemo(
    () => contracts.reduce((max, c) => Math.max(max, c.visitCount || 0), 1),
    [contracts]
  );
  const visitColumns = useMemo(
    () => Array.from({ length: maxVisitCount }, (_, i) => i + 1),
    [maxVisitCount]
  );

  // ✅ เลือกจัดกลุ่มเป็นสัญญาได้เฉพาะตอนมองเห็นงานเก่าที่ยังไม่จัดกลุ่ม (แท็บ "งานเก่า.../ทั้งหมด")
  // แท็บ "สัญญา" ล้วนๆ ไม่มีอะไรให้เลือกจัดกลุ่มอยู่แล้ว (ทุกแถวมีสัญญาอยู่แล้วทั้งหมด)
  const showCheckboxes = viewFilter !== "contracts";

  // ✅ ความกว้างคอลัมน์ที่ผู้ใช้ลากปรับเอง (key เฉพาะที่ต่างจากค่าเริ่มต้นเท่านั้น)
  const [colWidths, setColWidths] = useState({});
  const colWidth = (key) => colWidths[key] ?? DEFAULT_COL_WIDTHS[key] ?? VISIT_COL_DEFAULT_WIDTH;
  const handleColResize = (key) => (w) => setColWidths((prev) => ({ ...prev, [key]: w }));
  const totalTableWidth = useMemo(() => {
    let total = colWidth("actions") + (showCheckboxes ? colWidth("checkbox") : 0);
    [
      "company", "site", "system", "title", "contractNo", "quotationNo",
      "contractStart", "contractEnd", "visitCount", "progress", "jobValue", "team",
    ].forEach((k) => { total += colWidth(k); });
    visitColumns.forEach((n) => { total += colWidth(`visit_${n}`); });
    return total;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colWidths, showCheckboxes, visitColumns]);

  const realContractCount = useMemo(() => contracts.filter((c) => c.isRealContract).length, [contracts]);
  const hiddenJobCount = contracts.length - realContractCount;

  // ── จัดกลุ่มงานเก่าให้เป็นสัญญา ─────────────────────────────────────────
  const jobSignature = (c) => [c.company, c.site, c.system, c.title].map((v) => (v || "").trim().toLowerCase()).join("|");

  // ✅ "ปี" ของสัญญา — อิงวันที่เริ่มสัญญาก่อน (ถ้ามี) ไม่งั้น fallback ไปดูวันที่ของครั้งแรกที่มีจริง
  // ใช้ทั้งกรองปีในตาราง และเช็คว่างานเก่า 2 งานควรนับเป็นสัญญาเดียวกันไหม (ต้องปีเดียวกันด้วย)
  const contractYear = (c) => {
    if (c.contractStart) return moment(c.contractStart).year();
    if (c.visits[0]?.start) return moment(c.visits[0].start).year();
    return null;
  };

  // ✅ งานเก่าที่ company/site/system/title ตรงกันเป๊ะ "และ" อยู่ปีเดียวกัน (≥2 งาน) น่าจะเป็นสัญญา
  // เดียวกันที่ยังไม่เคยผูกไว้ (สร้างก่อนมีฟีเจอร์นี้) — แนะนำให้เลือกทั้งกลุ่มได้เลย แทนต้องไล่หาเอง
  // จากรายการเป็นร้อย — เดิมจับคู่แค่ company/site/system/title เฉยๆ ไม่ดูปี ทำให้เผลอแนะนำรวมงาน
  // PM ปี 2567 กับ 2569 เข้าด้วยกัน ทั้งที่จริงเป็นคนละสัญญา (สัญญาต่ออายุปีต่อปี ไม่ใช่สัญญาเดียวกัน)
  const legacyGroupSuggestions = useMemo(() => {
    // ✅ คัดเฉพาะงานประเภท "PM" — งานที่เข้าซ้ำเป็นรอบๆ ตามสัญญาจริงมักเป็น PM แทบทั้งหมด ส่วนงาน
    // ประเภทอื่น (Service/สำรวจหน้างาน/ติดตั้งอุปกรณ์ ฯลฯ) ส่วนใหญ่เป็นงานครั้งเดียวจบ ไม่ใช่สัญญา
    // แนะนำไปก็มีแต่จะกลุ่มมั่วๆ ที่ไม่ได้เป็นสัญญาเดียวกันจริง
    const legacy = contracts.filter((c) => !c.isRealContract && (c.title || "").trim() === "PM");
    const map = new Map();
    legacy.forEach((c) => {
      const year = contractYear(c) || "ไม่ระบุปี";
      const sig = `${jobSignature(c)}|${year}`;
      if (!map.has(sig)) map.set(sig, { items: [], year });
      map.get(sig).items.push(c);
    });
    return [...map.values()].filter((g) => g.items.length >= 2).sort((a, b) => b.items.length - a.items.length);
  }, [contracts]);

  // ✅ ตัวเลือกปีสำหรับกรองตาราง — ดึงจากปีที่มีข้อมูลจริงเท่านั้น เรียงปีล่าสุดก่อน
  const availableYears = useMemo(() => {
    const years = new Set();
    contracts.forEach((c) => { const y = contractYear(c); if (y) years.add(y); });
    return [...years].sort((a, b) => b - a);
  }, [contracts]);
  const [yearFilter, setYearFilter] = useState("all");

  const [selectedIds, setSelectedIds] = useState(new Set());
  const selectedContracts = useMemo(() => contracts.filter((c) => selectedIds.has(c.key)), [contracts, selectedIds]);
  // ✅ ล็อกไว้ว่าต้องเลือกงานที่ company/site/system/title ตรงกับตัวแรกที่เลือกเท่านั้น — กันรวมงาน
  // คนละเรื่องเข้าเป็น "สัญญา" เดียวกันโดยไม่ตั้งใจ ซึ่งจะทำให้ข้อมูลสัญญาเพี้ยน
  const lockedSignature = selectedContracts.length > 0 ? jobSignature(selectedContracts[0]) : null;

  const toggleSelect = (c) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(c.key)) next.delete(c.key);
      else next.add(c.key);
      return next;
    });
  };
  const selectGroup = (group) => setSelectedIds(new Set(group.map((c) => c.key)));
  const clearSelection = () => setSelectedIds(new Set());

  const filtered = useMemo(() => {
    let base = viewFilter === "all" ? contracts
      : viewFilter === "ungrouped" ? contracts.filter((c) => !c.isRealContract)
      : contracts.filter((c) => c.isRealContract);
    if (yearFilter !== "all") {
      base = base.filter((c) => String(contractYear(c)) === String(yearFilter));
    }
    const kw = search.trim().toLowerCase();
    if (!kw) return base;
    return base.filter((c) =>
      [c.company, c.site, c.system, c.title, c.contractNo, c.quotationNo, c.team]
        .some((v) => (v || "").toLowerCase().includes(kw))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contracts, search, viewFilter, yearFilter]);

  // ✅ แสดงแค่หน้าละ 20 แถว — เดิมโชว์ทุกแถวรวดเดียว (สูงสุดเป็นร้อย) ต้องเลื่อนในกรอบตารางยาวๆ
  // ตลอดเวลา ตัดเป็นหน้าให้สั้นกระชับแทน (ตัวกรอง/ค้นหายังใช้กับข้อมูลทั้งหมดเหมือนเดิม แค่ตัดแสดงผล)
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search, viewFilter, yearFilter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedRows = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  const csvData = useMemo(
    () => filtered.map((c) => {
      const row = {
        บริษัท: c.company || "",
        โครงการ: c.site || "",
        ระบบ: c.system || "",
        ประเภทงาน: c.title || "",
        เลขที่สัญญา: c.contractNo || "",
        ใบเสนอราคา: c.quotationNo || "",
        วันที่เริ่มสัญญา: c.contractStart ? moment(c.contractStart).format("YYYY-MM-DD") : "",
        วันที่สิ้นสุดสัญญา: c.contractEnd ? moment(c.contractEnd).format("YYYY-MM-DD") : "",
        จำนวนครั้ง: c.visitCount || "",
      };
      visitColumns.forEach((n) => {
        const visit = c.visits.find((v) => Number(v.time) === n);
        row[`ครั้งที่${n}`] = visit ? formatEventDateRange(visit) : "";
      });
      row["มูลค่างาน"] = c.jobValue ?? "";
      row["ผู้รับผิดชอบ"] = c.team;
      return row;
    }),
    [filtered, visitColumns]
  );

  // ── ฟอร์ม "เพิ่มสัญญาใหม่" ─────────────────────────────────────────────
  // ✅ เดิมต้องออกจากหน้านี้ไปเปิดปฏิทินแล้วคลิกวันที่เพื่อสร้างงานแบบ "สัญญาแบบหลายครั้ง" เท่านั้น
  // (ดู AddEvent.js) — เพิ่มฟอร์มแบบเดียวกันไว้ในหน้านี้เลย ให้เพิ่มสัญญาใหม่ได้โดยไม่ต้องสลับหน้า
  const emptyForm = {
    company: "", site: "", title: "", system: "", team: "",
    contractNo: "", quotationNo: "", contractStart: "", contractEnd: "", visitCount: "", jobValue: "",
  };
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(emptyForm);

  const setField = (field) => (val) => setForm((f) => ({ ...f, [field]: val }));

  const companyOptions = useMemo(
    () => [...new Set(lookups.customers.map((c) => c.cCompany).filter(Boolean))],
    [lookups.customers]
  );
  const siteOptions = useMemo(
    () => [...new Set(lookups.customers.map((c) => c.cSite).filter(Boolean))],
    [lookups.customers]
  );
  const titleOptions = useMemo(() => lookups.jobTypes.map((t) => t.name), [lookups.jobTypes]);
  const systemOptions = useMemo(() => lookups.systemTypes.map((s) => s.name), [lookups.systemTypes]);
  const teamOptions = useMemo(() => lookups.employees.map((e) => e.fname).filter(Boolean), [lookups.employees]);
  const teamToId = useMemo(() => new Map(lookups.employees.map((e) => [e.fname, e._id])), [lookups.employees]);

  const openAddDialog = () => {
    setForm(emptyForm);
    setFormError("");
    setAddOpen(true);
  };
  const closeAddDialog = () => { if (!saving) setAddOpen(false); };

  // ✅ ไม่ต้องระบุวันที่เข้างานเลยตอนสร้างสัญญา — บันทึกเป็น "ฉบับร่าง" (unscheduled) ที่มีแค่ข้อมูล
  // สัญญาไว้ก่อน ยังไม่มีครั้งไหนลงตารางจริงสักครั้ง แล้วค่อยไปกด "+ เพิ่มครั้งถัดไป" ทีละครั้งทีหลัง
  // เมื่อรู้วันที่จริงแล้ว (ดู handleAddVisitSubmit ด้านล่างที่แปลงฉบับร่างนี้เป็นครั้งที่ 1 จริง)
  const handleAddSubmit = async () => {
    setFormError("");
    if (!form.site.trim())   { setFormError("กรุณาระบุชื่อโครงการ"); return; }
    if (!form.title.trim())  { setFormError("กรุณาระบุประเภทงาน"); return; }
    if (!form.system.trim()) { setFormError("กรุณาระบุระบบงาน"); return; }
    const visitCount = Number(form.visitCount);
    if (!visitCount || visitCount < 1) { setFormError("กรุณาระบุจำนวนครั้งทั้งหมดของสัญญา"); return; }

    setSaving(true);
    try {
      const payload = {
        company: form.company.trim(),
        site: form.site.trim(),
        title: form.title.trim(),
        system: form.system.trim(),
        team: form.team,
        resPerson: teamToId.get(form.team) || "",
        backgroundColor: "#3788d8",
        textColor: "#ffffff",
        fontSize: 8,
        isContractBatch: true,
        contractNo: form.contractNo.trim(),
        quotationNo: form.quotationNo.trim(),
        contractStart: form.contractStart,
        contractEnd: form.contractEnd,
        visitCount,
        jobValue: form.jobValue ? Number(form.jobValue) : undefined,
      };

      // ✅ upsert เข้าตารางกลาง (บริษัท/โครงการ/ประเภทงาน/ระบบ) แบบ best-effort เหมือน AddEvent.js
      // ถ้าเป็นชื่อใหม่ที่ยังไม่มีในระบบ — ไม่ให้กระทบการบันทึกสัญญาหลักถ้าล้มเหลว
      const existingCustomer = lookups.customers.find((c) => c.cCompany === payload.company && c.cSite === payload.site);
      if (!existingCustomer && (payload.company || payload.site)) {
        await CustomerService.AddCustomer({ cCompany: payload.company, cSite: payload.site }).catch(() => {});
      }
      if (!lookups.jobTypes.some((t) => t.name === payload.title)) {
        await JobTypeService.add(payload.title).catch(() => {});
      }
      if (!lookups.systemTypes.some((s) => s.name === payload.system)) {
        await SystemTypeService.add(payload.system).catch(() => {});
      }

      await EventService.AddDraftEvent(payload);

      setSaving(false);
      setAddOpen(false);
      Swal.fire({
        title: "บันทึกสัญญา (ฉบับร่าง) สำเร็จ ✅",
        text: "ไปเพิ่มวันที่เข้างานครั้งแรกได้ที่ปุ่ม + ในตาราง",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
      await fetchData();
      await fetchLookups();
    } catch (err) {
      setSaving(false);
      // ✅ err.message ของ axios เป็นข้อความทั่วไป ไม่ใช่ข้อความ Thai ที่ backend ส่งมา (เช่น
      // รายละเอียดช่างชนกัน) — ต้องอ่านจาก response.data.message ก่อนเสมอ
      setFormError(err?.response?.data?.message || "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
  };

  // ── "+ เพิ่มครั้งถัดไป" — เติมครั้งใหม่เข้าสัญญาที่มีอยู่แล้ว ─────────────────
  // ✅ เดิมทุกทางเข้าสร้าง "ทั้งสัญญา" ในทีเดียวเท่านั้น (ต้องรู้ครบทุกวันที่ตั้งแต่แรก) ทั้งที่จริง
  // งานส่วนใหญ่ทยอยรู้วันที่ทีละครั้งตลอดปี — เพิ่มปุ่มนี้ให้เติมทีละครั้งได้ โดย backend จะกันไม่ให้
  // เกินจำนวน visitCount ที่ระบุไว้ตอนสร้างสัญญา (ดู POST /events)
  const [addVisitTarget, setAddVisitTarget] = useState(null); // contract object จาก `contracts`
  const [newVisitStart, setNewVisitStart] = useState("");
  const [newVisitEnd, setNewVisitEnd] = useState("");
  const [newVisitTeam, setNewVisitTeam] = useState("");
  const [addVisitError, setAddVisitError] = useState("");
  const [addVisitSaving, setAddVisitSaving] = useState(false);

  const openAddVisitDialog = (contract) => {
    setAddVisitTarget(contract);
    setNewVisitStart("");
    setNewVisitEnd("");
    setNewVisitTeam(contract.team === "-" ? "" : (contract.visits[0]?.team || ""));
    setAddVisitError("");
  };
  const closeAddVisitDialog = () => { if (!addVisitSaving) setAddVisitTarget(null); };

  const handleAddVisitSubmit = async () => {
    if (!addVisitTarget) return;
    if (!newVisitStart) { setAddVisitError("กรุณาระบุวันที่เข้างาน"); return; }
    if (moment(newVisitEnd || newVisitStart).isBefore(moment(newVisitStart))) {
      setAddVisitError("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม");
      return;
    }
    setAddVisitSaving(true);
    setAddVisitError("");
    try {
      const c = addVisitTarget;
      // ✅ สัญญาที่เพิ่งสร้างแบบฉบับร่าง (ยังไม่มีครั้งไหนลงตารางเลย) จะมี record เดียวเป็น
      // unscheduled:true ปนอยู่ใน visits — ต้องนับ "ครั้งถัดไป" จากครั้งที่ลงตารางจริงเท่านั้น
      // ไม่นับฉบับร่างเป็นครั้งที่ 1 ไปเลย (มันยังไม่ใช่ครั้งจริงจนกว่าจะใส่วันที่)
      const realVisits = c.visits.filter((v) => !v.unscheduled);
      const placeholder = c.visits.find((v) => v.unscheduled);
      const nextIndex = realVisits.length + 1;
      const endDate = moment(newVisitEnd || newVisitStart).add(1, "days").format("YYYY-MM-DD");

      if (placeholder) {
        // ✅ แปลงฉบับร่างเดิม (record เดียวกัน) ให้กลายเป็นครั้งที่ 1 จริง แทนการสร้าง record ใหม่ —
        // กันไม่ให้มีฉบับร่างค้างเป็นผีในระบบหลังจากมีครั้งจริงแล้ว
        await EventService.ScheduleDraftEvent(placeholder._id, {
          date: newVisitStart,
          start: newVisitStart,
          end: endDate,
          team: newVisitTeam,
          resPerson: teamToId.get(newVisitTeam) || "",
          time: String(nextIndex),
        });
      } else {
        const payload = {
          company: c.company || "",
          site: c.site || "",
          title: c.title || "",
          system: c.system || "",
          time: String(nextIndex),
          team: newVisitTeam,
          resPerson: teamToId.get(newVisitTeam) || "",
          teamMembers: [],
          backgroundColor: "#3788d8",
          textColor: "#ffffff",
          fontSize: 8,
          startTime: "",
          endTime: "",
          isContractBatch: true,
          contractGroupId: c.key,
          contractNo: c.contractNo || "",
          quotationNo: c.quotationNo || "",
          contractStart: c.contractStart || "",
          contractEnd: c.contractEnd || "",
          visitCount: c.visitCount,
          jobValue: c.jobValue,
          dates: [{ start: newVisitStart, end: endDate, date: newVisitStart }],
        };
        await EventService.AddEvent(payload);
      }

      setAddVisitSaving(false);
      setAddVisitTarget(null);
      Swal.fire({ title: `เพิ่มครั้งที่ ${nextIndex} สำเร็จ ✅`, icon: "success", timer: 1200, showConfirmButton: false });
      await fetchData();
    } catch (err) {
      setAddVisitSaving(false);
      setAddVisitError(err?.response?.data?.message || "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
  };

  // ── จัดกลุ่มงานเก่าที่เลือกไว้ ให้กลายเป็นสัญญาเดียวกัน ──────────────────────
  const emptyMergeForm = { contractNo: "", quotationNo: "", contractStart: "", contractEnd: "", visitCount: "", jobValue: "" };
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeForm, setMergeForm] = useState(emptyMergeForm);
  const [mergeError, setMergeError] = useState("");
  const [mergeSaving, setMergeSaving] = useState(false);

  const openMergeDialog = () => {
    setMergeForm({ ...emptyMergeForm, visitCount: String(selectedContracts.length) });
    setMergeError("");
    setMergeOpen(true);
  };
  const closeMergeDialog = () => { if (!mergeSaving) setMergeOpen(false); };
  const setMergeField = (field) => (val) => setMergeForm((f) => ({ ...f, [field]: val }));

  const handleMergeSubmit = async () => {
    setMergeError("");
    if (selectedContracts.length === 0) { setMergeError("กรุณาเลือกงานอย่างน้อย 1 รายการ"); return; }
    setMergeSaving(true);
    try {
      // ✅ งานเก่า (isRealContract=false) แต่ละ "สัญญา" ในตารางคือ 1 event เดียว (fallback key
      // ผูกตาม _id) จึงดึง event id ตัวแรกของแต่ละแถวที่เลือกมาส่งให้ backend ได้ตรงๆ
      const eventIds = selectedContracts.map((c) => c.visits[0]._id);
      await EventService.MergeIntoContract({
        eventIds,
        contractNo: mergeForm.contractNo.trim(),
        quotationNo: mergeForm.quotationNo.trim(),
        contractStart: mergeForm.contractStart,
        contractEnd: mergeForm.contractEnd,
        visitCount: mergeForm.visitCount ? Number(mergeForm.visitCount) : eventIds.length,
        jobValue: mergeForm.jobValue ? Number(mergeForm.jobValue) : undefined,
      });
      setMergeSaving(false);
      setMergeOpen(false);
      clearSelection();
      Swal.fire({ title: "จัดกลุ่มเป็นสัญญาสำเร็จ ✅", icon: "success", timer: 1200, showConfirmButton: false });
      await fetchData();
    } catch (err) {
      setMergeSaving(false);
      setMergeError(err?.response?.data?.message || "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
  };

  // ── แก้ไขข้อมูลสัญญาตรงในตารางเลย (inline, แบบ Excel) ──────────────────────
  // ✅ เดิมต้องเปิด dialog "เพิ่มครั้งถัดไป" หรือแก้ผ่านหน้าปฏิทินเท่านั้นถึงจะแก้เลขที่สัญญา/มูลค่างาน/
  // ผู้รับผิดชอบได้ — คลิกที่ช่องในตารางแล้วพิมพ์แก้ได้ทันที (Enter/คลิกที่อื่นเพื่อบันทึก, Esc ยกเลิก)
  const [editingCell, setEditingCell] = useState(null); // { key, field }
  const [editValue, setEditValue] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const editOriginalValue = (c, field) => {
    if (field === "contractStart" || field === "contractEnd") return c[field] ? moment(c[field]).format("YYYY-MM-DD") : "";
    if (field === "team") return c.team === "-" ? "" : c.team;
    return c[field] ?? "";
  };

  const beginEdit = (c, field) => {
    if (!c.isRealContract || editSaving) return;
    setEditingCell({ key: c.key, field });
    setEditValue(String(editOriginalValue(c, field)));
  };
  const cancelEdit = () => { setEditingCell(null); setEditValue(""); };

  const commitEdit = async (c) => {
    if (!editingCell || editingCell.key !== c.key) return;
    const field = editingCell.field;
    const rawValue = editValue;

    // ✅ ไม่เปลี่ยนแปลงจากเดิมเลย ไม่ต้องยิง API เปล่าๆ
    if (rawValue === String(editOriginalValue(c, field))) { setEditingCell(null); return; }

    setEditSaving(true);
    try {
      const payload = {};
      if (field === "jobValue" || field === "visitCount") payload[field] = rawValue ? Number(rawValue) : undefined;
      else if (field === "team") { payload.team = rawValue; payload.resPerson = teamToId.get(rawValue) || ""; }
      else payload[field] = rawValue;

      await EventService.UpdateContractFields(c.key, payload);
      setEditingCell(null);
      await fetchData();
    } catch (err) {
      Swal.fire({
        title: "แก้ไขไม่สำเร็จ",
        text: err?.response?.data?.message || err.message,
        icon: "error",
      });
      setEditingCell(null);
    } finally {
      setEditSaving(false);
    }
  };

  // ✅ กันช่างเปิดหน้านี้ตรงๆ ผ่าน URL — เทียบ pattern เดียวกับ TeamWorkload.js
  if (!loading && !isAdminOrManager) return <Navigate to="/dashboard" replace />;

  return (
    <Box sx={{ px: { xs: 1.5, sm: 2 }, pt: 2, pb: 4 }}>
      {/* ✅ เดิมบังคับแถวเดียว (direction="row") ตลอด — จอมือถือแคบกว่าปุ่ม "เพิ่มสัญญาใหม่" +
          ปุ่มรีเฟรช + ปุ่มส่งออกรวมกัน ทำให้ล้นขอบจอ/ปุ่มถูกตัด สลับเป็นซ้อนกันคนละแถวบนจอแคบแทน
          (ชื่อหน้า/จำนวนอยู่แถวบน ปุ่มต่างๆ อยู่แถวล่าง เต็มความกว้าง) */}
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "flex-start" }} justifyContent="space-between" gap={1.25} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6" fontWeight={800}>ภาพรวมสัญญา</Typography>
          <Typography variant="caption" color="text.secondary">
            {loading ? "กำลังโหลด..." : `${filtered.length} สัญญา`}
          </Typography>
        </Box>
        <Stack direction="row" gap={1}>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={openAddDialog}
            sx={{ bgcolor: ACCENT, textTransform: "none", fontWeight: 700, borderRadius: 2.5, flex: { xs: 1, sm: "initial" }, "&:hover": { bgcolor: "#b91c1c" } }}
          >
            เพิ่มสัญญาใหม่
          </Button>
          <Tooltip title="รีเฟรช">
            <IconButton onClick={() => { fetchData(); fetchLookups(); }} sx={{ border: "1px solid", borderColor: "divider", borderRadius: "50%", flexShrink: 0 }}>
              <Refresh sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
          {/* ✅ ห้ามเอา MUI IconButton/Tooltip ไปห่อ CSVLink ตรงๆ — CSVLink (react-csv) ไม่ได้ forward
              ref ให้ลูกอย่างถูกต้อง ทำให้ TouchRipple ของ IconButton หา DOM node ไม่เจอ เกิด error
              "Cannot read properties of undefined (reading 'addEventListener')" ตอนกลับมาโชว์ผลจาก
              Suspense — ใช้ <button> ธรรมดาแทน เหมือน pattern ที่ใช้งานได้จริงใน EventCalendar/index.js */}
          <CSVLink
            data={csvData}
            filename="contracts.csv"
            title="ส่งออก Excel/CSV"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
              border: `1px solid ${alpha(ACCENT, 0.4)}`, color: ACCENT, textDecoration: "none",
            }}
          >
            <Download sx={{ fontSize: 20 }} />
          </CSVLink>
        </Stack>
      </Stack>

      {/* ✅ สลับมุมมองด้วยแท็บแบบชิป (เทียบ pattern เดียวกับแท็บประเภทเอกสารในหน้า "ไฟล์") แทน switch
          เปิด/ปิดตัวเดียว — ค่าเริ่มต้นอยู่ที่ "สัญญา" กันตารางรกด้วยงานเก่าเป็นร้อยแถวเหมือนเดิม แต่สลับ
          ไปดูงานเก่าที่ยังไม่จัดกลุ่มได้ชัดเจนกว่าเดิม (ไม่ต้องเดาว่า switch ตัวนี้หมายถึงอะไร) */}
      {!loading && (
        <Box sx={{
          mb: 2, overflowX: "auto", pb: 0.5, WebkitOverflowScrolling: "touch",
          "&::-webkit-scrollbar": { height: 4 },
        }}>
          <ToggleButtonGroup
            size="small" exclusive value={viewFilter}
            onChange={(_, v) => v && setViewFilter(v)}
            sx={{ flexWrap: "nowrap", width: "max-content" }}
          >
            <ToggleButton value="contracts" sx={VIEW_TAB_SX}>สัญญา ({realContractCount})</ToggleButton>
            <ToggleButton value="ungrouped" sx={VIEW_TAB_SX}>งานเก่าในระบบที่ยังไม่จัดกลุ่ม ({hiddenJobCount})</ToggleButton>
            <ToggleButton value="all" sx={VIEW_TAB_SX}>ทั้งหมด ({contracts.length})</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}

      {/* ✅ ช่วยหางานเก่าที่น่าจะเป็นสัญญาเดียวกันให้ (company/site/system/title ตรงกันเป๊ะ) — เดิม
          ต้องไล่ดูเองทีละแถวจากงานเก่าเป็นร้อยรายการ กดปุ่มเดียวเลือกทั้งกลุ่มแล้วไปกรอกข้อมูลสัญญาต่อได้เลย */}
      {!loading && showCheckboxes && legacyGroupSuggestions.length > 0 && (
        <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 3, borderColor: alpha(ACCENT, 0.3), bgcolor: alpha(ACCENT, 0.03) }}>
          <Typography variant="caption" fontWeight={700} sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
            <GroupWork sx={{ fontSize: 16, color: ACCENT }} /> พบ {legacyGroupSuggestions.length} กลุ่มงานเก่าที่น่าจะเป็นสัญญาเดียวกัน
          </Typography>
          <Stack spacing={0.75}>
            {legacyGroupSuggestions.slice(0, 8).map((group) => {
              const head = group.items[0];
              const isThisSelected = group.items.every((c) => selectedIds.has(c.key));
              return (
                <Stack key={`${jobSignature(head)}|${group.year}`} direction="row" alignItems="center" gap={1} flexWrap="wrap">
                  <Typography variant="caption" sx={{ flex: 1, minWidth: 0 }} noWrap>
                    {head.company || "-"} · {head.site || "-"} · {head.title} · ปี {group.year} ({group.items.length} งาน)
                  </Typography>
                  <Button
                    size="small" variant={isThisSelected ? "contained" : "outlined"}
                    onClick={() => selectGroup(group.items)}
                    sx={isThisSelected
                      ? { bgcolor: ACCENT, textTransform: "none", fontSize: "0.7rem", py: 0.25 }
                      : { borderColor: alpha(ACCENT, 0.5), color: ACCENT, textTransform: "none", fontSize: "0.7rem", py: 0.25 }}
                  >
                    {isThisSelected ? "เลือกแล้ว" : "เลือกกลุ่มนี้"}
                  </Button>
                </Stack>
              );
            })}
          </Stack>
        </Paper>
      )}

      {selectedIds.size > 0 && (
        <Paper variant="outlined" sx={{ p: 1.25, mb: 2, borderRadius: 3, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", bgcolor: alpha(ACCENT, 0.06), borderColor: alpha(ACCENT, 0.4) }}>
          <Typography variant="body2" fontWeight={700} sx={{ flex: 1 }}>เลือกไว้ {selectedIds.size} งาน</Typography>
          <Button size="small" onClick={clearSelection} sx={{ textTransform: "none" }}>ล้างการเลือก</Button>
          <Button
            size="small" variant="contained" startIcon={<MergeType sx={{ fontSize: 16 }} />}
            onClick={openMergeDialog}
            sx={{ bgcolor: ACCENT, textTransform: "none", fontWeight: 700, "&:hover": { bgcolor: "#b91c1c" } }}
          >
            จัดกลุ่มเป็นสัญญา
          </Button>
        </Paper>
      )}

      <Stack direction={{ xs: "column", sm: "row" }} gap={1.5} sx={{ mb: 2 }}>
        <TextField
          fullWidth size="small"
          placeholder="ค้นหาบริษัท / โครงการ / เลขที่สัญญา / ผู้รับผิดชอบ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: "background.paper" } }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 19, color: "text.disabled" }} /></InputAdornment>,
          }}
        />
        {/* ✅ กรองตารางตามปีของสัญญา (อิงวันที่เริ่มสัญญา ไม่งั้นอิงวันที่ครั้งแรก) — เดิมต้องไล่สโครล
            หาเองว่าปีไหนมีสัญญาอะไรบ้าง ทั้งที่สัญญาส่วนใหญ่ต่ออายุปีต่อปี ดูทีละปีจะเจอเร็วกว่า */}
        <TextField
          select size="small" label="ปี" value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          SelectProps={{ native: true }}
          sx={{ width: { xs: "100%", sm: 140 }, flexShrink: 0, "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: "background.paper" } }}
        >
          <option value="all">ทุกปี</option>
          {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
        </TextField>
      </Stack>

      {loading ? (
        <Skeleton variant="rounded" height={280} sx={{ borderRadius: 3 }} />
      ) : filtered.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8, color: "text.disabled" }}>
          <FolderOpen sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
          <Typography variant="body2">
            {search
              ? "ไม่พบสัญญาที่ตรงกับคำค้นหา"
              : hiddenJobCount > 0
              ? "ยังไม่มีสัญญาแบบหลายครั้ง — กดแท็บ \"งานเก่าในระบบที่ยังไม่จัดกลุ่ม\" ด้านบนเพื่อดูงานที่มีอยู่ หรือสร้างงานใหม่แบบ \"สัญญาแบบหลายครั้ง\" จากหน้าปฏิทิน"
              : "ยังไม่มีข้อมูลสัญญา"}
          </Typography>
        </Box>
      ) : (
        <TableContainer
          component={Paper} variant="outlined"
          sx={{
            borderRadius: 3, overflowX: "auto", overflowY: "hidden",
            // ✅ ให้เลื่อนแนวนอนด้วยนิ้วลื่นแบบมือถือ (momentum scroll) บน iOS Safari — เดิมไม่มี ทำให้
            // เลื่อนดูคอลัมน์ที่เกินจอกระตุกๆ ต้องปาดหลายทีกว่าจะเลื่อนได้จริง
            WebkitOverflowScrolling: "touch",
            borderColor: alpha("#0f172a", 0.14), boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
          }}
        >
          <Table
            size="small"
            sx={{
              tableLayout: "fixed", width: totalTableWidth,
              // ✅ เดิมใช้ stickyHeader + borderCollapse "separate" คู่กัน ทำให้หัวตารางเรนเดอร์เพี้ยน
              // (เห็นกรอบแดงเป็นก้อนๆ ตอนเลื่อน) — ตอนนี้แสดงแค่ 20 แถวต่อหน้าอยู่แล้ว ตารางไม่สูงจน
              // ต้อง sticky หัวอีกต่อไป ตัด stickyHeader ออก แล้วใช้ borderCollapse ปกติแทนก็พอ ไม่เพี้ยน
              borderCollapse: "collapse",
              "& th, & td": { border: "1px solid", borderColor: alpha("#0f172a", 0.12) },
            }}
          >
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "#fef2f2", borderBottom: `2px solid ${ACCENT} !important`, color: "#7f1d1d" } }}>
                {showCheckboxes && <TableCell padding="checkbox" sx={{ width: colWidth("checkbox") }} />}
                <ResizableTh width={colWidth("company")} onResize={handleColResize("company")}>บริษัท</ResizableTh>
                <ResizableTh width={colWidth("site")} onResize={handleColResize("site")}>โครงการ</ResizableTh>
                <ResizableTh width={colWidth("system")} onResize={handleColResize("system")}>ระบบ</ResizableTh>
                <ResizableTh width={colWidth("title")} onResize={handleColResize("title")}>ประเภทงาน</ResizableTh>
                <ResizableTh width={colWidth("contractNo")} onResize={handleColResize("contractNo")}>เลขที่สัญญา</ResizableTh>
                <ResizableTh width={colWidth("quotationNo")} onResize={handleColResize("quotationNo")}>ใบเสนอราคา</ResizableTh>
                <ResizableTh width={colWidth("contractStart")} onResize={handleColResize("contractStart")}>เริ่มสัญญา</ResizableTh>
                <ResizableTh width={colWidth("contractEnd")} onResize={handleColResize("contractEnd")}>สิ้นสุด</ResizableTh>
                <ResizableTh width={colWidth("visitCount")} align="center" onResize={handleColResize("visitCount")}>จำนวนครั้ง</ResizableTh>
                <ResizableTh width={colWidth("progress")} align="center" onResize={handleColResize("progress")}>ความคืบหน้า</ResizableTh>
                {visitColumns.map((n) => (
                  <ResizableTh key={n} width={colWidth(`visit_${n}`)} align="center" onResize={handleColResize(`visit_${n}`)}>ครั้งที่ {n}</ResizableTh>
                ))}
                <ResizableTh width={colWidth("jobValue")} align="right" onResize={handleColResize("jobValue")}>มูลค่างาน</ResizableTh>
                <ResizableTh width={colWidth("team")} onResize={handleColResize("team")}>ผู้รับผิดชอบ</ResizableTh>
                <TableCell align="center" sx={{ width: colWidth("actions") }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {pagedRows.map((c, idx) => (
                <TableRow key={c.key} hover sx={{ bgcolor: idx % 2 ? "action.hover" : "transparent" }}>
                  {showCheckboxes && (
                    <TableCell padding="checkbox" sx={{ width: colWidth("checkbox") }}>
                      {!c.isRealContract && (
                        <Checkbox
                          size="small"
                          checked={selectedIds.has(c.key)}
                          disabled={Boolean(lockedSignature) && lockedSignature !== jobSignature(c) && !selectedIds.has(c.key)}
                          onChange={() => toggleSelect(c)}
                          sx={{ p: 0.5, "&.Mui-checked": { color: ACCENT } }}
                        />
                      )}
                    </TableCell>
                  )}
                  <TableCell sx={{ width: colWidth("company"), maxWidth: colWidth("company"), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.company}>{c.company || <Dash />}</TableCell>
                  <TableCell sx={{ width: colWidth("site"), maxWidth: colWidth("site"), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.site}>{c.site || <Dash />}</TableCell>
                  <TableCell sx={{ width: colWidth("system"), maxWidth: colWidth("system"), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.system}>{c.system || <Dash />}</TableCell>
                  <TableCell sx={{ width: colWidth("title"), maxWidth: colWidth("title"), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.title}>{c.title || <Dash />}</TableCell>
                  <EditableCell
                    editable={c.isRealContract}
                    editing={editingCell?.key === c.key && editingCell?.field === "contractNo"}
                    value={c.contractNo} editValue={editValue} saving={editSaving}
                    width={colWidth("contractNo")} title={c.contractNo}
                    formatDisplay={(v) => (v ? <span style={{ color: ACCENT, fontWeight: 600 }}>{v}</span> : <Dash />)}
                    onStartEdit={() => beginEdit(c, "contractNo")}
                    onChangeValue={setEditValue}
                    onCommit={() => commitEdit(c)}
                    onCancel={cancelEdit}
                  />
                  <EditableCell
                    editable={c.isRealContract}
                    editing={editingCell?.key === c.key && editingCell?.field === "quotationNo"}
                    value={c.quotationNo} editValue={editValue} saving={editSaving}
                    width={colWidth("quotationNo")} title={c.quotationNo}
                    onStartEdit={() => beginEdit(c, "quotationNo")}
                    onChangeValue={setEditValue}
                    onCommit={() => commitEdit(c)}
                    onCancel={cancelEdit}
                  />
                  <EditableCell
                    editable={c.isRealContract}
                    editing={editingCell?.key === c.key && editingCell?.field === "contractStart"}
                    value={c.contractStart} editValue={editValue} editType="date" saving={editSaving}
                    width={colWidth("contractStart")}
                    formatDisplay={(v) => (v ? moment(v).format("DD/MM/YYYY") : <Dash />)}
                    onStartEdit={() => beginEdit(c, "contractStart")}
                    onChangeValue={setEditValue}
                    onCommit={() => commitEdit(c)}
                    onCancel={cancelEdit}
                  />
                  <EditableCell
                    editable={c.isRealContract}
                    editing={editingCell?.key === c.key && editingCell?.field === "contractEnd"}
                    value={c.contractEnd} editValue={editValue} editType="date" saving={editSaving}
                    width={colWidth("contractEnd")}
                    formatDisplay={(v) => (v ? moment(v).format("DD/MM/YYYY") : <Dash />)}
                    onStartEdit={() => beginEdit(c, "contractEnd")}
                    onChangeValue={setEditValue}
                    onCommit={() => commitEdit(c)}
                    onCancel={cancelEdit}
                  />
                  <EditableCell
                    editable={c.isRealContract}
                    editing={editingCell?.key === c.key && editingCell?.field === "visitCount"}
                    value={c.visitCount} editValue={editValue} editType="number" saving={editSaving}
                    width={colWidth("visitCount")} align="center"
                    onStartEdit={() => beginEdit(c, "visitCount")}
                    onChangeValue={setEditValue}
                    onCommit={() => commitEdit(c)}
                    onCancel={cancelEdit}
                  />
                  <TableCell align="center" sx={{ width: colWidth("progress") }}>
                    {(() => {
                      const doneCount = c.visits.filter((v) => v.status === "ดำเนินการเสร็จสิ้น").length;
                      const total = c.visitCount || c.visits.length;
                      const chipColor = doneCount === 0 ? "#9ca3af" : doneCount >= total ? STATUS_COLOR["ดำเนินการเสร็จสิ้น"] : "#f59e0b";
                      return (
                        <Chip
                          label={`${doneCount}/${total}`} size="small"
                          sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700, bgcolor: alpha(chipColor, 0.12), color: chipColor }}
                        />
                      );
                    })()}
                  </TableCell>
                  {visitColumns.map((n) => {
                    const withinCount = n <= (c.visitCount || c.visits.length);
                    if (!withinCount) {
                      return <TableCell key={n} align="center" sx={{ width: colWidth(`visit_${n}`), bgcolor: "action.hover" }} />;
                    }
                    // ✅ นับว่า "ถึงรอบแล้ว" เฉพาะครั้งที่ลงตารางจริงเท่านั้น (!unscheduled) — ถ้าเป็นแค่
                    // แผนงานล่วงหน้าที่จองครั้งนี้ไว้ (ยังไม่มีวันที่จริง) ให้ยังถือว่า "ว่าง" อยู่ในตาราง
                    // สัญญานี้ แต่โชว์ป้ายบอกว่ากำลังรอวางแผนอยู่ แทนที่จะเป็นขีดว่างเฉยๆ กันสับสนว่ายังไม่ได้จอง
                    const visit = c.visits.find((v) => !v.unscheduled && Number(v.time) === n);
                    const pendingDraft = !visit && c.visits.find((v) => v.unscheduled && Number(v.time) === n);
                    return (
                      <TableCell key={n} align="center" sx={{ width: colWidth(`visit_${n}`), overflow: "hidden" }}>
                        {visit ? (
                          <Link
                            to={`/operation/${visit._id}${resolveOperationGroup(visit) ? `?group=${resolveOperationGroup(visit)}` : ""}`}
                            style={{ color: STATUS_COLOR[visit.status] || ACCENT, fontWeight: 600, textDecoration: "none", fontSize: "0.78rem", whiteSpace: "nowrap" }}
                          >
                            {formatEventDateRange(visit)}
                          </Link>
                        ) : pendingDraft ? (
                          <Tooltip title="วางแผนล่วงหน้าไว้แล้ว ยังไม่ได้ลงวันที่จริง">
                            <Box component="span" sx={{ fontSize: "0.72rem", color: "#b45309", fontWeight: 600, whiteSpace: "nowrap" }}>
                              📌 รอวางแผน
                            </Box>
                          </Tooltip>
                        ) : (
                          <Dash />
                        )}
                      </TableCell>
                    );
                  })}
                  <EditableCell
                    editable={c.isRealContract}
                    editing={editingCell?.key === c.key && editingCell?.field === "jobValue"}
                    value={c.jobValue} editValue={editValue} editType="number" saving={editSaving}
                    width={colWidth("jobValue")} align="right"
                    formatDisplay={(v) => (v != null && v !== "" ? Number(v).toLocaleString() : <Dash />)}
                    onStartEdit={() => beginEdit(c, "jobValue")}
                    onChangeValue={setEditValue}
                    onCommit={() => commitEdit(c)}
                    onCancel={cancelEdit}
                  />
                  <EditableCell
                    editable={c.isRealContract}
                    editing={editingCell?.key === c.key && editingCell?.field === "team"}
                    value={c.team === "-" ? "" : c.team} editValue={editValue} editType="select" editOptions={teamOptions} saving={editSaving}
                    width={colWidth("team")} title={c.team}
                    onStartEdit={() => beginEdit(c, "team")}
                    onChangeValue={setEditValue}
                    onCommit={() => commitEdit(c)}
                    onCancel={cancelEdit}
                  />
                  <TableCell align="center" sx={{ width: colWidth("actions") }}>
                    {c.isRealContract && c.visits.length < (c.visitCount || 0) && (
                      <Tooltip title={`เพิ่มครั้งที่ ${c.visits.filter((v) => !v.unscheduled).length + 1}`}>
                        <IconButton size="small" onClick={() => openAddVisitDialog(c)} sx={{ color: ACCENT }}>
                          <PlaylistAdd fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!loading && filtered.length > PAGE_SIZE && (
        <Stack direction="row" justifyContent="center" sx={{ mt: 2 }}>
          <Pagination
            count={totalPages} page={page}
            onChange={(_, v) => setPage(v)}
            color="primary" shape="rounded" size={isMobile ? "large" : "small"}
            sx={{
              "& .Mui-selected": { bgcolor: `${ACCENT} !important`, color: "#fff" },
              ...(isMobile ? { "& .MuiPaginationItem-root": { minWidth: 40, height: 40, fontSize: "1rem" } } : {}),
            }}
          />
        </Stack>
      )}

      <Dialog open={addOpen} onClose={closeAddDialog} fullWidth maxWidth="sm" fullScreen={isMobile}>
        <DialogTitle sx={{ fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          เพิ่มสัญญาใหม่
          <IconButton size="small" onClick={closeAddDialog}><Close fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {formError && <Alert severity="error">{formError}</Alert>}

            <Typography variant="caption" fontWeight={700} color="text.secondary">ข้อมูลโครงการ</Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Autocomplete
                freeSolo fullWidth options={companyOptions}
                inputValue={form.company}
                onInputChange={(_, v) => setField("company")(v)}
                renderInput={(params) => <TextField {...params} label="บริษัท" size="small" />}
              />
              <Autocomplete
                freeSolo fullWidth options={siteOptions}
                inputValue={form.site}
                onInputChange={(_, v) => setField("site")(v)}
                renderInput={(params) => <TextField {...params} label="โครงการ *" size="small" />}
              />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Autocomplete
                freeSolo fullWidth options={titleOptions}
                inputValue={form.title}
                onInputChange={(_, v) => setField("title")(v)}
                renderInput={(params) => <TextField {...params} label="ประเภทงาน *" size="small" />}
              />
              <Autocomplete
                freeSolo fullWidth options={systemOptions}
                inputValue={form.system}
                onInputChange={(_, v) => setField("system")(v)}
                renderInput={(params) => <TextField {...params} label="ระบบงาน *" size="small" />}
              />
            </Stack>
            <TextField
              select fullWidth size="small" label="ผู้รับผิดชอบ"
              value={form.team} onChange={(e) => setField("team")(e.target.value)}
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
            >
              <option value="">— ไม่ระบุ —</option>
              {teamOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            </TextField>

            <Typography variant="caption" fontWeight={700} color="text.secondary">ข้อมูลสัญญา</Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField fullWidth size="small" label="เลขที่สัญญา" value={form.contractNo}
                onChange={(e) => setField("contractNo")(e.target.value)} />
              <TextField fullWidth size="small" label="เลขที่ใบเสนอราคา" value={form.quotationNo}
                onChange={(e) => setField("quotationNo")(e.target.value)} />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField fullWidth size="small" type="date" label="วันที่เริ่มสัญญา" InputLabelProps={{ shrink: true }}
                value={form.contractStart} onChange={(e) => setField("contractStart")(e.target.value)} />
              <TextField fullWidth size="small" type="date" label="วันที่สิ้นสุดสัญญา" InputLabelProps={{ shrink: true }}
                value={form.contractEnd} onChange={(e) => setField("contractEnd")(e.target.value)} />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField fullWidth size="small" type="number" label="จำนวนครั้งทั้งหมด *" value={form.visitCount}
                onChange={(e) => setField("visitCount")(e.target.value)} inputProps={{ min: 1, max: 24 }} />
              <TextField fullWidth size="small" type="number" label="มูลค่างาน" value={form.jobValue}
                onChange={(e) => setField("jobValue")(e.target.value)} />
            </Stack>

            {/* ✅ ไม่ต้องระบุวันที่เข้างานเลยตอนนี้ — บันทึกเป็นฉบับร่างไว้ก่อน แล้วไปเพิ่มวันที่เข้างาน
                ทีละครั้งทีหลังที่ปุ่ม "+" ในตาราง เมื่อรู้วันที่จริงแล้ว (กันต้องเดา/กรอกวันที่ที่ยัง
                ไม่แน่นอนไปก่อน แล้วต้องมาแก้ทีหลังอยู่ดี) */}
            <Alert severity="info" sx={{ fontSize: "0.8rem" }}>
              ยังไม่ต้องระบุวันที่เข้างาน — บันทึกสัญญาไว้ก่อน แล้วไปเพิ่มวันที่แต่ละครั้งทีหลังได้ที่ปุ่ม
              "+ เพิ่มครั้งถัดไป" ในตารางเมื่อรู้วันที่จริง
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={closeAddDialog} disabled={saving} sx={{ textTransform: "none" }}>ยกเลิก</Button>
          <Button
            variant="contained" onClick={handleAddSubmit} disabled={saving}
            sx={{ bgcolor: ACCENT, textTransform: "none", fontWeight: 700, "&:hover": { bgcolor: "#b91c1c" } }}
          >
            {saving ? "กำลังบันทึก..." : "บันทึกสัญญา"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(addVisitTarget)} onClose={closeAddVisitDialog} fullWidth maxWidth="xs" fullScreen={isMobile}>
        <DialogTitle sx={{ fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          เพิ่มครั้งที่ {addVisitTarget ? addVisitTarget.visits.filter((v) => !v.unscheduled).length + 1 : ""} จาก {addVisitTarget?.visitCount}
          <IconButton size="small" onClick={closeAddVisitDialog}><Close fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {addVisitError && <Alert severity="error">{addVisitError}</Alert>}
            {addVisitTarget && (
              <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: alpha(ACCENT, 0.06) }}>
                <Typography variant="body2" fontWeight={700}>{addVisitTarget.company || "-"} · {addVisitTarget.site || "-"}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {addVisitTarget.title} · {addVisitTarget.system}
                  {addVisitTarget.contractNo ? ` · เลขที่สัญญา ${addVisitTarget.contractNo}` : ""}
                </Typography>
              </Box>
            )}
            <Stack direction="row" spacing={1.5}>
              <TextField size="small" type="date" fullWidth label="วันที่เริ่ม" InputLabelProps={{ shrink: true }}
                value={newVisitStart} onChange={(e) => setNewVisitStart(e.target.value)} />
              <TextField size="small" type="date" fullWidth label="วันที่สิ้นสุด" InputLabelProps={{ shrink: true }}
                value={newVisitEnd} onChange={(e) => setNewVisitEnd(e.target.value)} />
            </Stack>
            <TextField
              select fullWidth size="small" label="ผู้รับผิดชอบ"
              value={newVisitTeam} onChange={(e) => setNewVisitTeam(e.target.value)}
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
            >
              <option value="">— ไม่ระบุ —</option>
              {teamOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={closeAddVisitDialog} disabled={addVisitSaving} sx={{ textTransform: "none" }}>ยกเลิก</Button>
          <Button
            variant="contained" onClick={handleAddVisitSubmit} disabled={addVisitSaving}
            sx={{ bgcolor: ACCENT, textTransform: "none", fontWeight: 700, "&:hover": { bgcolor: "#b91c1c" } }}
          >
            {addVisitSaving ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={mergeOpen} onClose={closeMergeDialog} fullWidth maxWidth="sm" fullScreen={isMobile}>
        <DialogTitle sx={{ fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          จัดกลุ่มเป็นสัญญา ({selectedContracts.length} งาน)
          <IconButton size="small" onClick={closeMergeDialog}><Close fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {mergeError && <Alert severity="error">{mergeError}</Alert>}
            {selectedContracts[0] && (
              <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: alpha(ACCENT, 0.06) }}>
                <Typography variant="body2" fontWeight={700}>
                  {selectedContracts[0].company || "-"} · {selectedContracts[0].site || "-"}
                </Typography>
                <Typography variant="caption" color="text.secondary">{selectedContracts[0].title} · {selectedContracts[0].system}</Typography>
              </Box>
            )}
            <Alert severity="info" sx={{ fontSize: "0.8rem" }}>
              ระบบจะเรียง "ครั้งที่" ให้อัตโนมัติตามวันที่เข้างานจริงของแต่ละงานที่เลือก (เก่าสุด → ใหม่สุด)
            </Alert>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField fullWidth size="small" label="เลขที่สัญญา" value={mergeForm.contractNo}
                onChange={(e) => setMergeField("contractNo")(e.target.value)} />
              <TextField fullWidth size="small" label="เลขที่ใบเสนอราคา" value={mergeForm.quotationNo}
                onChange={(e) => setMergeField("quotationNo")(e.target.value)} />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField fullWidth size="small" type="date" label="วันที่เริ่มสัญญา" InputLabelProps={{ shrink: true }}
                value={mergeForm.contractStart} onChange={(e) => setMergeField("contractStart")(e.target.value)} />
              <TextField fullWidth size="small" type="date" label="วันที่สิ้นสุดสัญญา" InputLabelProps={{ shrink: true }}
                value={mergeForm.contractEnd} onChange={(e) => setMergeField("contractEnd")(e.target.value)} />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                fullWidth size="small" type="number" label="จำนวนครั้งทั้งหมด" value={mergeForm.visitCount}
                onChange={(e) => setMergeField("visitCount")(e.target.value)}
                helperText={`ค่าเริ่มต้น = จำนวนงานที่เลือก (${selectedContracts.length}) — แก้ได้ถ้ารู้ว่าสัญญาจริงมีมากกว่านี้`}
              />
              <TextField fullWidth size="small" type="number" label="มูลค่างาน" value={mergeForm.jobValue}
                onChange={(e) => setMergeField("jobValue")(e.target.value)} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={closeMergeDialog} disabled={mergeSaving} sx={{ textTransform: "none" }}>ยกเลิก</Button>
          <Button
            variant="contained" onClick={handleMergeSubmit} disabled={mergeSaving}
            sx={{ bgcolor: ACCENT, textTransform: "none", fontWeight: 700, "&:hover": { bgcolor: "#b91c1c" } }}
          >
            {mergeSaving ? "กำลังบันทึก..." : "จัดกลุ่มเป็นสัญญา"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
