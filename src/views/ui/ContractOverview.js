/**
 * ContractOverview.js — "ภาพรวมสัญญา" (เฉพาะแอดมิน/manager)
 *
 * จัดกลุ่มงานที่ผูกด้วย contractGroupId เดียวกัน (ครั้งที่ 1-N ของสัญญาเดียวกัน — ดู AddEvent.js
 * โหมด "สัญญาแบบหลายครั้ง") ให้แสดงเป็นตาราง 1 แถวต่อสัญญา คอลัมน์ตรงกับตาราง Excel ที่ใช้ติดตาม
 * สัญญาบริการอยู่แล้ว (บริษัท/โครงการ/ระบบ/ประเภทงาน/เลขที่สัญญา/ใบเสนอราคา/ระยะเวลา/จำนวนครั้ง/
 * วันที่เข้างานแต่ละครั้ง/มูลค่างาน/ผู้รับผิดชอบ) — งานเก่าที่ยังไม่มี contractGroupId (สร้างก่อนมี
 * ฟีเจอร์นี้) ถูกจัดเป็นสัญญา 1 ครั้งของตัวเอง ไม่หายไปจากตาราง
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import moment from "moment";
import "moment/locale/th";
import Swal from "sweetalert2";
import {
  Box, Stack, Typography, TextField, InputAdornment, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Skeleton,
  Dialog, DialogTitle, DialogContent, DialogActions, ToggleButtonGroup, ToggleButton,
  Button, Autocomplete, Alert, Chip, Checkbox, Pagination, useMediaQuery, Badge,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Search, Refresh, Download, FolderOpen, Add, Close,
  PlaylistAdd, MergeType, GroupWork, DeleteOutline, WarningAmber,
  AddLink, LinkOff, CheckCircle, CheckCircleOutline,
  CalendarMonth, PersonOutline,
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
import { countUsedRounds } from "../../utils/contractRounds";
import { groupEventsByContract, nextVisitOverdueInfo } from "../../utils/contractOverdue";

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

// ✅ "สถานะสัญญา" — เทียบ contractEnd กับวันนี้ ช่วยเตือนต่ออายุล่วงหน้า แทนต้องไล่เช็คคอลัมน์
// "สิ้นสุด" เองทีละแถว ใช้ทั้งในตารางและไฟล์ CSV ที่ส่งออก (ใช้ฟังก์ชันเดียวกัน กันข้อมูลไม่ตรงกัน)
const contractStatusInfo = (c) => {
  if (!c.isRealContract || !c.contractEnd) return null;
  const daysLeft = moment(c.contractEnd).startOf("day").diff(moment().startOf("day"), "days");
  if (daysLeft < 0) return { label: "หมดอายุแล้ว", color: "#dc2626" };
  if (daysLeft <= 60) return { label: `ใกล้หมดอายุ · ${daysLeft} วัน`, color: "#f59e0b" };
  return { label: "มีผลบังคับใช้", color: "#10b981" };
};

// ✅ ยืด/หดความกว้างคอลัมน์ได้เองเหมือน Excel — เดิม fix ความกว้างตายตัวทุกคอลัมน์ (CELL_TRUNCATE)
// พอชื่อบริษัท/โครงการยาวๆ ก็โดนตัดด้วย ... เสมอ ต้อง hover ดู tooltip ทุกครั้ง ให้ผู้ใช้ลากขยายเองได้
// ตามที่ต้องการแทน — เก็บลง localStorage ด้วย (ไม่ใช่แค่ state ในหน้านี้) จะได้จำค่าที่ปรับไว้ข้ามการ
// ออกจากหน้า/ปิดแท็บ/เปิดใหม่ ไม่ต้องมาลากปรับความกว้างซ้ำทุกครั้งที่กลับเข้ามาดู
const DEFAULT_COL_WIDTHS = {
  checkbox: 42, actions: 50,
  contractNo: 120, quotationNo: 120,
  company: 170, site: 170, system: 110, title: 170,
  contractStart: 100, contractEnd: 100,
  visitCount: 80, jobValue: 100, status: 130, progress: 90, team: 120,
};
const COL_WIDTHS_STORAGE_KEY = "contractOverview.colWidths";
const loadStoredColWidths = () => {
  try {
    const raw = localStorage.getItem(COL_WIDTHS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};
const VISIT_COL_DEFAULT_WIDTH = 110;
const MIN_COL_WIDTH = 50;

const AUTO_FIT_PADDING = 20; // ✅ กันเนื้อหาแนบขอบเซลล์พอดีเป๊ะจนดูอึดอัดหลัง auto-fit
const AUTO_FIT_MAX_WIDTH = 420;

const ResizableTh = ({ width, align = "left", children, onResize, rowSpan = 1, columnKey, tableRef }) => {
  // ✅ ดับเบิลคลิก/แตะ 2 ครั้งที่ขอบคอลัมน์ = ปรับความกว้างพอดีเนื้อหาอัตโนมัติเหมือน Excel
  // ⚠️ เดิมวัดจาก cell.scrollWidth ตรงๆ (เซลล์จริงในตาราง table-layout:fixed) แต่ table-layout:fixed
  // "ล็อก" ความกว้างคอลัมน์ไว้แล้วตามที่กำหนด ทำให้ scrollWidth มักได้แค่ค่าความกว้างปัจจุบันของเซลล์เอง
  // (ไม่ใช่ความกว้างเนื้อหาจริงที่ล้นออกมา) — ผลคือกดดับเบิลคลิกกี่ทีก็ได้แค่ "ความกว้างเดิม + padding"
  // บวกเพิ่มไปเรื่อยๆ ไม่เคยลู่เข้าค่าที่พอดีจริงสักที (bug ที่ผู้ใช้เจอ "ขยายขึ้นเรื่อยๆ")
  // ✅ แก้โดย clone เซลล์ออกมานอกตาราง ปลดล็อกความกว้าง (width:auto, whiteSpace:nowrap) แล้วค่อยวัด
  // scrollWidth ของตัวโคลน ซึ่งไม่ติดข้อจำกัดของ table-layout:fixed อีกต่อไป จึงได้ความกว้างเนื้อหาจริง
  // ล้วนๆ ตามจำนวนตัวอักษร/ไอคอนข้างในเป๊ะๆ ทุกครั้งไม่ว่าจะกดกี่รอบก็ตาม (idempotent)
  const handleAutoFit = () => {
    const table = tableRef?.current;
    if (!table || !columnKey) return;
    const cells = table.querySelectorAll(`[data-col-key="${columnKey}"]`);
    let maxWidth = 0;
    cells.forEach((cell) => {
      // ✅ ไม่ก็อปปี้ font/padding มาใส่เป็น inline style เอง (ของเดิมทำแบบนั้นแล้วพัง) — cloneNode
      // เก็บ class ของ MUI ไว้ครบอยู่แล้ว (เป็น global stylesheet ใช้ได้แม้ย้าย DOM ไปไหนก็ตาม) แค่
      // override เฉพาะคุณสมบัติที่ "ล็อกความกว้างไว้" เท่านั้นก็พอ ปล่อยให้ font/padding มาจาก class เดิม
      // เป๊ะๆ — ที่ผ่านมาก็อปปี้ shorthand "font" มาด้วย ซึ่งบางเบราว์เซอร์/เว็บวิวมือถือคำนวณ
      // getComputedStyle().font ไม่ครบ (คืนค่าว่าง/ผิด) ทำให้ตัวโคลนวัดความกว้างผิดเพี้ยนไปเลย
      const clone = cell.cloneNode(true);
      Object.assign(clone.style, {
        display: "inline-block",
        position: "fixed",
        visibility: "hidden",
        pointerEvents: "none",
        top: "-9999px",
        left: "-9999px",
        width: "auto",
        minWidth: "0",
        maxWidth: "none",
        whiteSpace: "nowrap",
      });
      document.body.appendChild(clone);
      maxWidth = Math.max(maxWidth, clone.scrollWidth);
      document.body.removeChild(clone);
    });
    if (maxWidth > 0) {
      onResize(Math.min(AUTO_FIT_MAX_WIDTH, Math.max(MIN_COL_WIDTH, Math.ceil(maxWidth) + AUTO_FIT_PADDING)));
    }
  };

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
  // ✅ เช็คดับเบิลคลิก/แตะเองจากช่วงเวลาระหว่าง 2 ครั้งกด แทนพึ่ง native "onDoubleClick" event ล้วนๆ —
  // ของเดิมใช้ onDoubleClick แยกต่างหากแต่ไม่ทำงาน (ทุก mousedown เริ่ม drag session ของตัวเองก่อนเสมอ
  // ซึ่งไปรบกวนจังหวะที่เบราว์เซอร์ใช้ตัดสิน dblclick) เช็คเองจากเวลาที่ผ่านไปชัวร์กว่า ไม่ต้องพึ่งเบราว์เซอร์
  const lastMouseDownRef = useRef(0);
  const lastTouchRef = useRef(0);
  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const now = Date.now();
    if (now - lastMouseDownRef.current < 400) {
      lastMouseDownRef.current = 0;
      handleAutoFit();
      return;
    }
    lastMouseDownRef.current = now;
    startDrag(e.clientX);
  };
  const handleTouchStart = (e) => {
    e.stopPropagation();
    const now = Date.now();
    // ✅ หน้าจอมือถือแตะแม่นน้อยกว่าเมาส์คลิก ให้เวลาห่างระหว่าง 2 แตะกว้างกว่าฝั่งเมาส์หน่อย (500ms)
    // กันเผลอแตะไม่ทันจังหวะแล้วโดนตีความเป็นลากแทน
    if (now - lastTouchRef.current < 500) {
      lastTouchRef.current = 0;
      handleAutoFit();
      return;
    }
    lastTouchRef.current = now;
    if (e.touches[0]) startDrag(e.touches[0].clientX);
  };
  return (
    <TableCell
      align={align}
      rowSpan={rowSpan}
      data-col-key={columnKey}
      sx={{ position: "relative", width, minWidth: width, maxWidth: width, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", userSelect: "none" }}
    >
      {children}
      <Tooltip title="ลากเพื่อปรับความกว้าง · ดับเบิลคลิก/แตะ 2 ครั้งเพื่อพอดีอัตโนมัติ" enterDelay={500}>
        <Box
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          sx={{
            // ✅ กว้างขึ้นจาก 8 → 24px บนพื้นที่แตะ (แต่มองด้วยตายังแคบเท่าเดิม เพราะ hover สีจะแสดงแค่
            // แถบกลางบางๆ) นิ้วมือกดเจาะจงจุดแคบๆ ยากกว่าเมาส์เยอะ ต้องมี hit-area ใหญ่กว่านี้ถึงจะกดโดน
            // ทุกครั้ง — เดิม 16px บนจอมือถือยังพลาดง่าย โดยเฉพาะตอนต้องแตะซ้ำ 2 ครั้งให้ตรงจุดเดิม
            position: "absolute", top: 0, right: -12, bottom: 0, width: 24, cursor: "col-resize", zIndex: 3,
            touchAction: "none",
            display: "flex", justifyContent: "center",
            // ✅ เส้นแบ่งบางๆ ตลอดเวลา (ไม่ใช่แค่ตอน hover) ให้เห็นชัดว่าคอลัมน์นี้ลากขยายได้ — ของเดิม
            // ต้องเอาเมาส์ไปชี้ถึงจะรู้ว่ามีจุดลากตรงนี้อยู่ ดูไม่ออกเลยตอนแรก
            "&::after": { content: '""', width: "1px", height: "60%", alignSelf: "center", bgcolor: alpha("#0f172a", 0.12), transition: "background-color .15s" },
            "&:hover": { bgcolor: alpha("#dc2626", 0.5) },
            "&:hover::after": { bgcolor: ACCENT },
            "&:active": { bgcolor: alpha("#dc2626", 0.6) },
          }}
        />
      </Tooltip>
    </TableCell>
  );
};

// ✅ แก้ไขข้อมูลสัญญาได้ตรงในช่องตารางเลยเหมือน Excel (ไม่ต้องเปิด dialog แยก) — ใช้ได้เฉพาะแถวที่
// เป็นสัญญาจริง (isRealContract) เท่านั้น เพราะอิงจากการอัปเดตผ่าน contractGroupId ซึ่งงานเก่าที่ยัง
// ไม่จัดกลุ่มไม่มี — ต้องอยู่นอกคอมโพเนนต์หลัก (module scope) ไม่งั้นทุก re-render จะได้ function
// identity ใหม่ ทำให้ React มองเป็นคนละคอมโพเนนต์แล้ว unmount/remount ช่องที่กำลังพิมพ์อยู่ (โฟกัสหลุด)
const EditableCell = ({
  value, editing, editValue, editType = "text", editOptions, width, align, editable, saving,
  formatDisplay, title, onStartEdit, onChangeValue, onCommit, onCancel, columnKey,
}) => {
  const baseSx = { width, maxWidth: width, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

  if (!editable) {
    return <TableCell align={align} title={title} data-col-key={columnKey} sx={baseSx}>{formatDisplay ? formatDisplay(value) : (value || <Dash />)}</TableCell>;
  }

  if (!editing) {
    return (
      <TableCell
        align={align}
        title={title || "คลิกเพื่อแก้ไข"}
        data-col-key={columnKey}
        onClick={onStartEdit}
        sx={{
          ...baseSx, cursor: "pointer", transition: "background-color .12s, box-shadow .12s",
          "&:hover": { bgcolor: alpha(ACCENT, 0.07), boxShadow: `inset 0 0 0 1px ${alpha(ACCENT, 0.35)}` },
        }}
      >
        {formatDisplay ? formatDisplay(value) : (value || <Dash />)}
      </TableCell>
    );
  }

  return (
    <TableCell align={align} data-col-key={columnKey} sx={{ width, p: "2px 4px" }}>
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
  // ✅ ย้าย logic จัดกลุ่มไปไว้ที่ utils/contractOverdue.js แล้ว (ใช้ซ้ำที่ Header.js ด้วยสำหรับป้าย
  // สรุปจำนวนสัญญาเกินกำหนดบนมือถือ) กันตรรกะเพี้ยนไม่ตรงกันระหว่างสองจุด
  const contracts = useMemo(
    () =>
      groupEventsByContract(events).sort(
        (a, b) =>
          (a.company || "").localeCompare(b.company || "", "th") ||
          (a.site || "").localeCompare(b.site || "", "th")
      ),
    [events]
  );

  // ✅ เลือกจัดกลุ่มเป็นสัญญาได้เฉพาะตอนมองเห็นงานเก่าที่ยังไม่จัดกลุ่ม (แท็บ "งานเก่า.../ทั้งหมด")
  // แท็บ "สัญญา" ล้วนๆ ไม่มีอะไรให้เลือกจัดกลุ่มอยู่แล้ว (ทุกแถวมีสัญญาอยู่แล้วทั้งหมด)
  const showCheckboxes = viewFilter !== "contracts";
  // ✅ ซ่อนคอลัมน์ "เลขที่เอกสาร" (สัญญา/ใบเสนอราคา) ตอนดูแท็บที่ไม่ใช่สัญญาจริง — งานเก่าที่ยังไม่
  // จัดกลุ่ม/งานทั่วไปไม่มีเลขที่สัญญา/ใบเสนอราคาอยู่แล้ว (เป็น "-" ทุกแถวเสมอ) โชว์ไว้มีแต่จะรกตาราง
  const showDocNoColumns = viewFilter !== "ungrouped" && viewFilter !== "general";

  // ✅ ความกว้างคอลัมน์ที่ผู้ใช้ลากปรับเอง (key เฉพาะที่ต่างจากค่าเริ่มต้นเท่านั้น) — โหลดจาก
  // localStorage ตอนเปิดหน้า (lazy initializer) แล้วบันทึกกลับทุกครั้งที่ปรับ จะได้จำค่าไว้ข้ามการออก
  // จากหน้า/รีเฟรช ไม่ใช่แค่ระหว่างที่ยังเปิดหน้านี้ค้างอยู่เหมือนเดิม
  const [colWidths, setColWidths] = useState(loadStoredColWidths);
  const colWidth = (key) => colWidths[key] ?? DEFAULT_COL_WIDTHS[key] ?? VISIT_COL_DEFAULT_WIDTH;
  const handleColResize = (key) => (w) => setColWidths((prev) => {
    const next = { ...prev, [key]: w };
    try { localStorage.setItem(COL_WIDTHS_STORAGE_KEY, JSON.stringify(next)); } catch {}
    return next;
  });
  // ✅ ใช้หา DOM ของตารางจริงตอนดับเบิลคลิกขอบคอลัมน์เพื่อวัดความกว้างเนื้อหาที่แท้จริง (auto-fit)
  const tableRef = useRef(null);

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

  // ✅ ตัวเลือกปีสำหรับกรองตาราง — ดึงจากปีที่มีข้อมูลจริง บวกปีปัจจุบันเสมอ (แม้ยังไม่มีสัญญาปีนี้เลย
  // ก็ตาม) เพราะเป็นค่าเริ่มต้นของตัวกรองด้านล่าง กันกรณี dropdown ไม่มีปีปัจจุบันให้เลือกตั้งแต่แรก
  const currentYear = moment().year();
  const availableYears = useMemo(() => {
    const years = new Set([currentYear]);
    contracts.forEach((c) => { const y = contractYear(c); if (y) years.add(y); });
    return [...years].sort((a, b) => b - a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contracts]);
  // ✅ ค่าเริ่มต้นแสดงปีปัจจุบันก่อนเสมอ (ไม่ใช่ "ทุกปี" เหมือนเดิม) เปลี่ยนดูปีอื่นได้จาก dropdown
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  // ✅ กรองตามผู้รับผิดชอบ — แยกจากช่องค้นหาข้อความอิสระ ให้เลือกจากรายชื่อจริงได้เลย ไม่ต้องพิมพ์เอง
  const [teamFilter, setTeamFilter] = useState("all");

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

  // ⚠️ BUG ที่แก้: เดิมเลขบนแท็บ ("สัญญา (N)"/"งานทั่วไป (N)"/"ทั้งหมด (N)") นับจาก `contracts` ดิบ
  // ทั้งก้อน ไม่ผ่านตัวกรองปี/ผู้รับผิดชอบ/คำค้นหาเลย ในขณะที่ตัวเลขใต้หัวข้อ ("N งาน") กับการแบ่งหน้า
  // (pagination) นับจาก `filtered` ซึ่งผ่านตัวกรองครบ — พอ yearFilter ค่าเริ่มต้นล็อกปีปัจจุบันไว้อยู่แล้ว
  // (ดู yearFilter ด้านบน) ตัวเลขสองชุดนี้เลยไม่ตรงกันเสมอ (แท็บบอก 98 แต่ตารางโชว์แค่ 11 ตามปีที่กรอง)
  // ทำให้ดูเหมือนแบ่งหน้าพัง — ทางแก้คือให้ตัวเลขบนแท็บผ่านตัวกรองชุดเดียวกันกับ `filtered` ด้วย ต่างกัน
  // แค่ "กลุ่มประเภท" (สัญญา/งานทั่วไป/ทั้งหมด) ก่อนนับ ให้ตัวเลขทุกจุดในหน้านี้ตรงกันเสมอ
  const applyCommonFilters = (list) => {
    let base = list;
    if (yearFilter !== "all") {
      base = base.filter((c) => String(contractYear(c)) === String(yearFilter));
    }
    // ✅ กรองตามผู้รับผิดชอบแบบเจาะจง (เลือกจากรายชื่อจริง) แยกจากช่องค้นหาข้อความอิสระด้านบน —
    // c.team อาจเป็นชื่อหลายคนต่อกันด้วย ", " (ทีมงาน/ลูกทีมเพิ่มเติม) ใช้ includes เทียบเป็นสตริงย่อยพอ
    if (teamFilter !== "all") {
      base = base.filter((c) => (c.team || "").includes(teamFilter));
    }
    const kw = search.trim().toLowerCase();
    if (!kw) return base;
    return base.filter((c) =>
      [c.company, c.site, c.system, c.title, c.contractNo, c.quotationNo, c.team]
        .some((v) => (v || "").toLowerCase().includes(kw))
    );
  };

  // ✅ งานที่ไม่มี contractGroupId แบ่งเป็น 2 กลุ่มจริงๆ ไม่ใช่กองเดียวกันอีกต่อไป — ค่าเริ่มต้นคือ
  // "ยังไม่จัดกลุ่ม" (isConfirmedGeneral ยังไม่ true) จนกว่าจะกดยืนยันเป็น "งานทั่วไป" เอง (หรือย้ายเข้า
  // สัญญา ซึ่งจะทำให้ isRealContract=true แทน) กันงานเก่าที่ยังไม่มีใครไล่ดูจริงๆ ถูกเข้าใจผิดว่าเป็น
  // "งานทั่วไป" ที่ยืนยันแล้วทั้งที่จริงยังไม่มีใครตรวจสอบเลย
  const realContractCount = useMemo(
    () => applyCommonFilters(contracts.filter((c) => c.isRealContract)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contracts, yearFilter, teamFilter, search]
  );
  const hiddenJobCount = useMemo(
    () => applyCommonFilters(contracts.filter((c) => !c.isRealContract && !c.isConfirmedGeneral)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contracts, yearFilter, teamFilter, search]
  );
  const confirmedGeneralCount = useMemo(
    () => applyCommonFilters(contracts.filter((c) => !c.isRealContract && c.isConfirmedGeneral)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contracts, yearFilter, teamFilter, search]
  );
  const allFilteredCount = useMemo(
    () => applyCommonFilters(contracts).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contracts, yearFilter, teamFilter, search]
  );

  const filtered = useMemo(() => {
    const base = viewFilter === "all" ? contracts
      : viewFilter === "ungrouped" ? contracts.filter((c) => !c.isRealContract && !c.isConfirmedGeneral)
      : viewFilter === "general" ? contracts.filter((c) => !c.isRealContract && c.isConfirmedGeneral)
      : contracts.filter((c) => c.isRealContract);
    return applyCommonFilters(base);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contracts, search, viewFilter, yearFilter, teamFilter]);

  // ✅ นับจาก `filtered` (ไม่ใช่ `contracts` ทั้งก้อนแบบเดิม) — เดิมถ้ามีสัญญาไหนสักอันในระบบที่มี
  // จำนวนครั้งเยอะ (เช่น 24) ตารางจะโชว์คอลัมน์ "ครั้งที่ 1-24" ตลอด แม้กรองปี/ค้นหาจนเหลือแต่สัญญา
  // 2-4 ครั้งอยู่ก็ตาม กว้างเกินจำเป็นและไม่ตรงกับสิ่งที่กรองไว้จริง
  const maxVisitCount = useMemo(
    () => filtered.reduce((max, c) => Math.max(max, c.visitCount || 0), 1),
    [filtered]
  );
  const visitColumns = useMemo(
    () => Array.from({ length: maxVisitCount }, (_, i) => i + 1),
    [maxVisitCount]
  );
  const totalTableWidth = useMemo(() => {
    let total = colWidth("actions") + (showCheckboxes ? colWidth("checkbox") : 0);
    [
      "contractNo", "quotationNo", "company", "site", "system", "title",
      "contractStart", "contractEnd", "visitCount", "jobValue", "status", "progress", "team",
    ].forEach((k) => { total += colWidth(k); });
    visitColumns.forEach((n) => { total += colWidth(`visit_${n}`); });
    return total;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colWidths, showCheckboxes, visitColumns]);

  // ✅ แสดงแค่หน้าละ 10 แถว — เดิมโชว์ทุกแถวรวดเดียว (สูงสุดเป็นร้อย) ต้องเลื่อนในกรอบตารางยาวๆ
  // ตลอดเวลา ตัดเป็นหน้าให้สั้นกระชับแทน (ตัวกรอง/ค้นหายังใช้กับข้อมูลทั้งหมดเหมือนเดิม แค่ตัดแสดงผล)
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search, viewFilter, yearFilter, teamFilter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedRows = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  const csvData = useMemo(
    () => filtered.map((c) => {
      const st = contractStatusInfo(c);
      const row = {
        เลขที่สัญญา: c.contractNo || "",
        ใบเสนอราคา: c.quotationNo || "",
        บริษัท: c.company || "",
        โครงการ: c.site || "",
        ระบบ: c.system || "",
        ประเภทงาน: c.title || "",
        วันที่เริ่มสัญญา: c.contractStart ? moment(c.contractStart).format("YYYY-MM-DD") : "",
        วันที่สิ้นสุดสัญญา: c.contractEnd ? moment(c.contractEnd).format("YYYY-MM-DD") : "",
        จำนวนครั้ง: c.visitCount || "",
        "มูลค่างาน/1ปี": c.jobValue ?? "",
        สถานะสัญญา: st?.label || "",
      };
      // ✅ นับเฉพาะครั้งที่ลงตารางจริงเหมือนตารางในหน้านี้ (เดิม CSV รวมแผนงานล่วงหน้าที่ยังไม่มีวันที่
      // จริงเข้าไปด้วย ทำให้ export ไม่ตรงกับสิ่งที่ตารางแสดงจริง)
      visitColumns.forEach((n) => {
        const visit = c.visits.find((v) => !v.unscheduled && Number(v.time) === n);
        const pendingDraft = !visit && c.visits.find((v) => v.unscheduled && Number(v.time) === n);
        row[`ครั้งที่${n}`] = visit ? formatEventDateRange(visit) : pendingDraft ? "รอวางแผน" : "";
      });
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

  // ✅ แนะนำเลขที่สัญญาถัดไปให้อัตโนมัติ (ตัวอักษรนำหน้า + ลำดับ + ปี พ.ศ. เช่น FAPTY02-2569) จากเลขที่
  // สัญญาจริงที่มีอยู่แล้วในระบบ — ขึ้นปีใหม่เริ่มนับ 01 ใหม่ ยังแก้ไขเองได้เสมอ (แค่ค่าเริ่มต้นในช่อง
  // ไม่ได้บังคับรูปแบบ) ถ้ายังไม่เคยมีสัญญารูปแบบนี้มาก่อนเลย fallback ไปใช้ตัวอักษรนำหน้า "FAPTY"
  const CONTRACT_NO_PATTERN = /^([A-Za-z]+)(\d+)-(\d{4})$/;
  const suggestNextContractNo = () => {
    const buddhistYear = moment().year() + 543;
    const parsed = contracts
      .filter((c) => c.isRealContract && c.contractNo)
      .map((c) => {
        const m = c.contractNo.trim().match(CONTRACT_NO_PATTERN);
        return m ? { prefix: m[1], seq: Number(m[2]), width: m[2].length, year: Number(m[3]) } : null;
      })
      .filter(Boolean);
    const thisYear = parsed.filter((p) => p.year === buddhistYear);
    if (thisYear.length > 0) {
      const top = thisYear.reduce((a, b) => (b.seq > a.seq ? b : a));
      return `${top.prefix}${String(top.seq + 1).padStart(top.width, "0")}-${buddhistYear}`;
    }
    const latest = parsed.sort((a, b) => b.year - a.year || b.seq - a.seq)[0];
    const prefix = latest?.prefix || "FAPTY";
    const width = latest?.width || 2;
    return `${prefix}${String(1).padStart(width, "0")}-${buddhistYear}`;
  };

  // ✅ เลขที่สัญญาห้ามซ้ำกับสัญญาอื่น (ไม่นับตัวเอง) — เช็คฝั่ง client ก่อนเพื่อ feedback ทันที ไม่ต้องรอ
  // round-trip ไป backend (ซึ่งเช็คซ้ำอีกชั้นอยู่แล้วเป็นตัวที่เชื่อถือได้จริง กัน race)
  const isContractNoTaken = (contractNo, excludeContractGroupId) => {
    const trimmed = (contractNo || "").trim();
    if (!trimmed) return false;
    return contracts.some((c) =>
      c.isRealContract && c.contractNo && c.contractNo.trim() === trimmed && c.key !== excludeContractGroupId
    );
  };

  const openAddDialog = () => {
    setForm({ ...emptyForm, contractNo: suggestNextContractNo() });
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
    if (isContractNoTaken(form.contractNo)) {
      setFormError(`เลขที่สัญญา "${form.contractNo.trim()}" ถูกใช้ไปแล้ว กรุณาตรวจสอบ`);
      return;
    }

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
  const [addVisitTarget, setAddVisitTarget] = useState(null); // { contract, extendRound } | null — extendRound: null = เพิ่มครั้งใหม่, N = ต่อวันที่ไม่ต่อเนื่องให้ครั้งที่ N
  const [newVisitStart, setNewVisitStart] = useState("");
  const [newVisitEnd, setNewVisitEnd] = useState("");
  const [newVisitTeam, setNewVisitTeam] = useState("");
  const [addVisitError, setAddVisitError] = useState("");
  const [addVisitSaving, setAddVisitSaving] = useState(false);

  const openAddVisitDialog = (contract) => {
    setAddVisitTarget({ contract, extendRound: null });
    setNewVisitStart("");
    setNewVisitEnd("");
    setNewVisitTeam(contract.team === "-" ? "" : (contract.visits[0]?.team || ""));
    setAddVisitError("");
  };
  // ✅ ต่อวันที่เข้างานไม่ต่อเนื่อง (เว้นช่วงแล้วกลับมาเข้าอีก) ให้ "ครั้งเดิม" ที่มีอยู่แล้ว — แยกจาก
  // "+ เพิ่มครั้งถัดไป" ด้านบนซึ่งเป็นการเพิ่มครั้งใหม่ ดูรายละเอียดที่ handleAddVisitSubmit
  const openExtendVisitDialog = (contract, roundNumber) => {
    const roundVisits = contract.visits.filter((v) => !v.unscheduled && Number(v.time) === roundNumber);
    setAddVisitTarget({ contract, extendRound: roundNumber });
    setNewVisitStart("");
    setNewVisitEnd("");
    setNewVisitTeam(roundVisits[0]?.team || (contract.team === "-" ? "" : contract.team));
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
      const { contract: c, extendRound } = addVisitTarget;
      const endDate = moment(newVisitEnd || newVisitStart).add(1, "days").format("YYYY-MM-DD");

      if (extendRound != null) {
        // ✅ ต่อวันที่ไม่ต่อเนื่องให้ "ครั้งเดิม" (extendRound) ไม่ใช่ครั้งใหม่ — ต้องผูก jobGroupId
        // เดียวกันกับ document เดิมของครั้งนี้ ถ้าครั้งนี้ยังไม่เคยถูกต่อมาก่อน (ยังไม่มี jobGroupId)
        // ต้องย้อนกลับไปใส่ jobGroupId ให้ document เดิมก่อน (เทียบ pattern เดียวกับ EditEvent.js
        // ที่ใช้ทำแบบนี้กับงานทั่วไปอยู่แล้ว — ดูคอมเมนต์ backend PUT /:id "ใช้ตอนแก้ไข event เดี่ยว
        // แล้วเพิ่มวันที่อื่นให้กลายเป็นงานเดียวกันภายหลัง") backend เช็คว่า jobGroupId ตรงกับของเดิม
        // ถึงจะไม่ถือว่าเป็นครั้งซ้ำ/เกินโควตา (ดู POST /events)
        const roundVisits = c.visits.filter((v) => !v.unscheduled && Number(v.time) === extendRound);
        const holder = roundVisits.find((v) => v.jobGroupId) || roundVisits[0];
        const jobGroupId = holder.jobGroupId || `${holder._id}-${Date.now()}`;
        if (!holder.jobGroupId) {
          await EventService.UpdateEvent(holder._id, { jobGroupId });
        }
        const payload = {
          company: c.company || "",
          site: c.site || "",
          title: c.title || "",
          system: c.system || "",
          time: String(extendRound),
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
          jobGroupId,
          contractNo: c.contractNo || "",
          quotationNo: c.quotationNo || "",
          contractStart: c.contractStart || "",
          contractEnd: c.contractEnd || "",
          visitCount: c.visitCount,
          jobValue: c.jobValue,
          dates: [{ start: newVisitStart, end: endDate, date: newVisitStart }],
        };
        await EventService.AddEvent(payload);
        setAddVisitSaving(false);
        setAddVisitTarget(null);
        Swal.fire({ title: `เพิ่มวันที่ต่อเนื่องให้ครั้งที่ ${extendRound} สำเร็จ ✅`, icon: "success", timer: 1200, showConfirmButton: false });
        await fetchData();
        return;
      }

      // ✅ สัญญาที่เพิ่งสร้างแบบฉบับร่าง (ยังไม่มีครั้งไหนลงตารางเลย) จะมี record เดียวเป็น
      // unscheduled:true ปนอยู่ใน visits — ต้องนับ "ครั้งถัดไป" จากครั้งที่ลงตารางจริงเท่านั้น
      // ไม่นับฉบับร่างเป็นครั้งที่ 1 ไปเลย (มันยังไม่ใช่ครั้งจริงจนกว่าจะใส่วันที่)
      const realVisits = c.visits.filter((v) => !v.unscheduled);
      const placeholder = c.visits.find((v) => v.unscheduled);
      const nextIndex = countUsedRounds(realVisits) + 1;

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
    if (isContractNoTaken(mergeForm.contractNo)) {
      setMergeError(`เลขที่สัญญา "${mergeForm.contractNo.trim()}" ถูกใช้ไปแล้ว กรุณาตรวจสอบ`);
      return;
    }
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

    if (field === "contractNo" && isContractNoTaken(rawValue, c.key)) {
      Swal.fire({ title: "แก้ไขไม่สำเร็จ", text: `เลขที่สัญญา "${rawValue.trim()}" ถูกใช้ไปแล้ว กรุณาตรวจสอบ`, icon: "error" });
      setEditingCell(null);
      return;
    }

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

  // ── ลบสัญญา/งานทิ้ง ─────────────────────────────────────────────────────
  // ✅ สัญญาจริง (isRealContract) ลบทั้งก้อนทีเดียวผ่าน DELETE /contract/:contractGroupId (ทุกครั้งที่
  // ผูก contractGroupId เดียวกันหายไปพร้อมกัน) ส่วนแถวงานเก่าที่ยังไม่จัดกลุ่ม (isRealContract=false)
  // คือ event เดี่ยวๆ อยู่แล้ว ลบผ่าน DeleteEvent ตัวเดียวพอ — ทั้งคู่ยืนยันก่อนลบเสมอ เพราะลบแล้ว
  // กู้คืนไม่ได้ และเตือนเป็นพิเศษถ้ามีครั้งที่ "ดำเนินการเสร็จสิ้น" แล้วปนอยู่ (ประวัติงานจริงจะหายไปด้วย)
  const handleDeleteContract = async (c) => {
    const doneCount = c.visits.filter((v) => v.status === "ดำเนินการเสร็จสิ้น").length;
    const result = await Swal.fire({
      icon: "warning",
      title: c.isRealContract ? "ลบสัญญานี้ทั้งหมด?" : "ลบงานนี้?",
      html: `
        <div style="text-align:left;font-size:13px;">
          <b>${c.company || "-"} · ${c.site || "-"}</b><br/>
          ${c.title} · ${c.system}<br/>
          ${c.isRealContract ? `จะลบทั้งสัญญา ${c.visits.length} รายการ (ทุกครั้งที่)` : "จะลบงานนี้ 1 รายการ"}
          ${doneCount > 0 ? `<br/><b style="color:#dc2626;">⚠️ มี ${doneCount} ครั้งที่ดำเนินการเสร็จสิ้นแล้ว จะถูกลบไปด้วย</b>` : ""}
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "ลบ",
      confirmButtonColor: "#dc2626",
      cancelButtonText: "ยกเลิก",
    });
    if (!result.isConfirmed) return;
    try {
      if (c.isRealContract) {
        await EventService.DeleteContract(c.key);
      } else {
        await EventService.DeleteEvent(c.visits[0]._id);
      }
      if (selectedIds.has(c.key)) toggleSelect(c);
      Swal.fire({ title: "ลบสำเร็จ ✅", icon: "success", timer: 1200, showConfirmButton: false });
      await fetchData();
    } catch (err) {
      Swal.fire({
        title: "ลบไม่สำเร็จ",
        text: err?.response?.data?.message || err.message,
        icon: "error",
      });
    }
  };

  // ── ย้ายงานเข้า/ออกจากสัญญา (แก้ไขกรณีจัดกลุ่มผิด) ──────────────────────────
  // ✅ ทิศทาง "เข้า": เลือกงานทั่วไป (isRealContract=false) แล้วเลือกสัญญาที่มีอยู่แล้ว + ครั้งที่ว่าง
  // ต่างจาก "จัดกลุ่มเป็นสัญญา" (handleMergeSubmit) ที่สร้างสัญญาใหม่เสมอ — ตัวนี้ผูกเข้ากับสัญญาเดิม
  const [attachTarget, setAttachTarget] = useState(null); // งานทั่วไป (c) ที่กำลังจะย้ายเข้าสัญญา
  const [attachContractId, setAttachContractId] = useState("");
  const [attachRound, setAttachRound] = useState("");
  const [attachSaving, setAttachSaving] = useState(false);
  const [attachError, setAttachError] = useState("");

  const openAttachDialog = (c) => {
    setAttachTarget(c);
    setAttachContractId("");
    setAttachRound("");
    setAttachError("");
  };
  const closeAttachDialog = () => { if (!attachSaving) setAttachTarget(null); };

  // ✅ เลือกได้เฉพาะสัญญาจริงที่ยังมีครั้งว่างเหลืออยู่ — เต็มแล้วไม่มีที่ให้ย้ายเข้า
  const attachableContracts = useMemo(
    () => contracts.filter((x) => x.isRealContract && countUsedRounds(x.visits) < x.visitCount),
    [contracts]
  );
  const selectedAttachContract = useMemo(
    () => attachableContracts.find((x) => x.key === attachContractId) || null,
    [attachableContracts, attachContractId]
  );
  // ✅ สถานะรายครั้งของสัญญาปลายทาง (ว่าง/ลงตารางแล้ว/รอวางแผน) เทียบ pattern เดียวกับ renderRoundGrid
  // ใน AddEvent.js — เลือกย้ายเข้าได้เฉพาะครั้งที่ "ว่าง" เท่านั้น
  const attachRoundOptions = useMemo(() => {
    if (!selectedAttachContract) return [];
    return Array.from({ length: selectedAttachContract.visitCount }, (_, i) => i + 1).map((n) => {
      const scheduled = selectedAttachContract.visits.some((v) => !v.unscheduled && Number(v.time) === n);
      const pending = selectedAttachContract.visits.some((v) => v.unscheduled && Number(v.time) === n);
      return { n, status: scheduled ? "scheduled" : pending ? "pending" : "open" };
    });
  }, [selectedAttachContract]);

  const handleAttachSubmit = async () => {
    if (!attachContractId) { setAttachError("กรุณาเลือกสัญญาปลายทาง"); return; }
    if (!attachRound) { setAttachError("กรุณาเลือกครั้งที่"); return; }
    setAttachSaving(true);
    setAttachError("");
    try {
      await EventService.AttachToContract(attachContractId, {
        eventId: attachTarget.visits[0]._id,
        time: attachRound,
      });
      setAttachSaving(false);
      setAttachTarget(null);
      Swal.fire({ title: "ย้ายเข้าสัญญาสำเร็จ ✅", icon: "success", timer: 1200, showConfirmButton: false });
      await fetchData();
    } catch (err) {
      setAttachSaving(false);
      setAttachError(err?.response?.data?.message || "ย้ายเข้าสัญญาไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
  };

  // ✅ ทิศทาง "ออก": แยกครั้งที่ N ออกจากสัญญา กลับไปเป็นงานเก่าที่ยังไม่จัดกลุ่ม (ต้องกดยืนยันแยกอีกที
  // ถึงจะกลายเป็น "งานทั่วไป" จริงๆ) — ทำงานกับทั้งครั้ง (ทุก record ที่
  // แชร์ contractGroupId+time เดียวกัน) ในคำขอเดียว ไม่ใช่แค่ record เดียว เผื่อครั้งนี้เข้างานไม่ต่อเนื่อง
  const handleDetachRound = async (c, n) => {
    const result = await Swal.fire({
      icon: "warning",
      title: `แยกครั้งที่ ${n} ออกจากสัญญา?`,
      html: `
        <div style="text-align:left;font-size:13px;">
          <b>${c.company || "-"} · ${c.site || "-"}</b><br/>
          งานนี้จะกลายเป็น "งานเก่าในระบบที่ยังไม่จัดกลุ่ม" แยกจากสัญญานี้ — ข้อมูลวันที่/สถานะ/ประวัติงานยังอยู่ครบ ไม่ถูกลบ
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "แยกออก",
      confirmButtonColor: "#dc2626",
      cancelButtonText: "ยกเลิก",
    });
    if (!result.isConfirmed) return;
    try {
      await EventService.DetachFromContract(c.key, { time: n });
      Swal.fire({ title: "แยกออกจากสัญญาสำเร็จ ✅", icon: "success", timer: 1200, showConfirmButton: false });
      await fetchData();
    } catch (err) {
      Swal.fire({
        title: "แยกออกไม่สำเร็จ",
        text: err?.response?.data?.message || err.message,
        icon: "error",
      });
    }
  };

  // ✅ ยืนยัน/ยกเลิกยืนยันว่างานนี้เป็น "งานทั่วไป" จริงๆ — ค่าเริ่มต้นของงานที่ไม่มี contractGroupId
  // คือ "ยังไม่จัดกลุ่ม" เสมอ (แท็บ "งานเก่าในระบบที่ยังไม่จัดกลุ่ม") จนกว่าจะกดยืนยันตรงนี้ ถึงจะย้าย
  // ไปแท็บ "งานทั่วไป" — กดซ้ำเพื่อยกเลิกยืนยันได้เช่นกัน (ย้ายกลับไปกอง "ยังไม่จัดกลุ่ม" เหมือนเดิม)
  const handleToggleGeneral = async (c) => {
    try {
      await EventService.MarkAsGeneral(c.visits[0]._id, !c.isConfirmedGeneral);
      await fetchData();
    } catch (err) {
      Swal.fire({
        title: c.isConfirmedGeneral ? "ยกเลิกยืนยันไม่สำเร็จ" : "ยืนยันไม่สำเร็จ",
        text: err?.response?.data?.message || err.message,
        icon: "error",
      });
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
          <Typography variant="h6" fontWeight={800}>ภาพรวมงาน</Typography>
          <Typography variant="caption" color="text.secondary">
            {loading ? "กำลังโหลด..." : `${filtered.length} ${viewFilter === "contracts" ? "สัญญา" : "งาน"}`}
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
            <ToggleButton value="general" sx={VIEW_TAB_SX}>งานทั่วไป ({confirmedGeneralCount})</ToggleButton>
            <ToggleButton value="ungrouped" sx={VIEW_TAB_SX}>งานเก่าในระบบที่ยังไม่จัดกลุ่ม ({hiddenJobCount})</ToggleButton>
            <ToggleButton value="all" sx={VIEW_TAB_SX}>ทั้งหมด ({allFilteredCount})</ToggleButton>
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
        {/* ✅ เน้นสีตอนกรองปีเจาะจงอยู่ (ไม่ใช่ "ทุกปี") ให้เห็นชัดว่ากำลังดูข้อมูลแค่ปีเดียว ไม่ใช่ทั้งหมด
            — เดิมหน้าตาเหมือนช่องเปล่าๆ ทั่วไป มองไม่ออกว่ามีตัวกรองทำงานอยู่ (ทั้งที่ค่าเริ่มต้นล็อก
            ปีปัจจุบันไว้ตั้งแต่แรกอยู่แล้ว ไม่ใช่ "ทุกปี") */}
        <TextField
          select size="small" label="ปี" value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          SelectProps={{ native: true }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <CalendarMonth sx={{ fontSize: 18, color: yearFilter !== "all" ? ACCENT : "text.disabled" }} />
              </InputAdornment>
            ),
          }}
          sx={{
            width: { xs: "100%", sm: 155 }, flexShrink: 0,
            "& .MuiOutlinedInput-root": {
              borderRadius: 2.5,
              bgcolor: yearFilter !== "all" ? alpha(ACCENT, 0.06) : "background.paper",
              "& fieldset": yearFilter !== "all" ? { borderColor: alpha(ACCENT, 0.45) } : {},
              "&:hover fieldset": yearFilter !== "all" ? { borderColor: ACCENT } : {},
            },
            "& .MuiInputLabel-root": yearFilter !== "all" ? { color: ACCENT, fontWeight: 700 } : {},
          }}
        >
          <option value="all">ทุกปี</option>
          {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
        </TextField>
        {/* ✅ กรองตามผู้รับผิดชอบเจาะจงจากรายชื่อจริง — แยกจากช่องค้นหาข้อความด้านบนซึ่งพิมพ์ค้นหาแบบ
            อิสระ (บางส่วน/สะกดผิดก็เจอ) ส่วนอันนี้เลือกจาก dropdown ให้ตรงเป๊ะไม่ต้องพิมพ์เอง —
            เน้นสีเหมือนช่องปีด้านบนตอนเลือกคนใดคนหนึ่งอยู่ (ไม่ใช่ "ทุกคน") ให้ชัดเจนสอดคล้องกัน */}
        <TextField
          select size="small" label="ผู้รับผิดชอบ" value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          SelectProps={{ native: true }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <PersonOutline sx={{ fontSize: 18, color: teamFilter !== "all" ? ACCENT : "text.disabled" }} />
              </InputAdornment>
            ),
          }}
          sx={{
            width: { xs: "100%", sm: 185 }, flexShrink: 0,
            "& .MuiOutlinedInput-root": {
              borderRadius: 2.5,
              bgcolor: teamFilter !== "all" ? alpha(ACCENT, 0.06) : "background.paper",
              "& fieldset": teamFilter !== "all" ? { borderColor: alpha(ACCENT, 0.45) } : {},
              "&:hover fieldset": teamFilter !== "all" ? { borderColor: ACCENT } : {},
            },
            "& .MuiInputLabel-root": teamFilter !== "all" ? { color: ACCENT, fontWeight: 700 } : {},
          }}
        >
          <option value="all">ทุกคน</option>
          {teamOptions.map((name) => <option key={name} value={name}>{name}</option>)}
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
            ref={tableRef}
            size="small"
            sx={{
              tableLayout: "fixed", width: totalTableWidth,
              // ✅ เดิมใช้ stickyHeader + borderCollapse "separate" คู่กัน ทำให้หัวตารางเรนเดอร์เพี้ยน
              // (เห็นกรอบแดงเป็นก้อนๆ ตอนเลื่อน) — ตอนนี้แสดงแค่ 20 แถวต่อหน้าอยู่แล้ว ตารางไม่สูงจน
              // ต้อง sticky หัวอีกต่อไป ตัด stickyHeader ออก แล้วใช้ borderCollapse ปกติแทนก็พอ ไม่เพี้ยน
              borderCollapse: "collapse",
              "& th, & td": { border: "1px solid", borderColor: alpha("#0f172a", 0.1) },
              "& td": { py: 0.75 },
            }}
          >
            <TableHead>
              {/* ✅ หัวตาราง 2 แถว เทียบเค้าโครงเอกสารอ้างอิง Excel ที่ใช้ติดตามสัญญาอยู่แล้ว — กลุ่ม
                  "อ้างอิงเอกสารเลขที่" (เลขที่สัญญา/ใบเสนอราคา) กับ "ระยะเวลา" (เริ่มสัญญา/สิ้นสุด)
                  ใช้ colSpan คลุม 2 คอลัมน์ย่อยแถวล่าง ส่วนคอลัมน์อื่นที่ไม่มีกลุ่มใช้ rowSpan คลุม 2 แถว */}
              <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "#fef2f2", borderBottom: `2px solid ${ACCENT} !important`, color: "#7f1d1d", letterSpacing: "0.01em" } }}>
                {showCheckboxes && <TableCell padding="checkbox" rowSpan={2} sx={{ width: colWidth("checkbox") }} />}
                <TableCell align="center" colSpan={2}>เลขที่เอกสาร</TableCell>
                <ResizableTh width={colWidth("company")} rowSpan={2} columnKey="company" tableRef={tableRef} onResize={handleColResize("company")}>บริษัท</ResizableTh>
                <ResizableTh width={colWidth("site")} rowSpan={2} columnKey="site" tableRef={tableRef} onResize={handleColResize("site")}>โครงการ</ResizableTh>
                <ResizableTh width={colWidth("system")} rowSpan={2} columnKey="system" tableRef={tableRef} onResize={handleColResize("system")}>ระบบ</ResizableTh>
                <ResizableTh width={colWidth("title")} rowSpan={2} columnKey="title" tableRef={tableRef} onResize={handleColResize("title")}>ประเภทงาน</ResizableTh>
                <TableCell align="center" colSpan={2}>ระยะเวลา</TableCell>
                <ResizableTh width={colWidth("visitCount")} align="center" rowSpan={2} columnKey="visitCount" tableRef={tableRef} onResize={handleColResize("visitCount")}>จำนวนครั้ง</ResizableTh>
                <ResizableTh width={colWidth("jobValue")} align="right" rowSpan={2} columnKey="jobValue" tableRef={tableRef} onResize={handleColResize("jobValue")}>มูลค่างาน/1ปี</ResizableTh>
                <ResizableTh width={colWidth("status")} align="center" rowSpan={2} columnKey="status" tableRef={tableRef} onResize={handleColResize("status")}>สถานะสัญญา</ResizableTh>
                <ResizableTh width={colWidth("progress")} align="center" rowSpan={2} columnKey="progress" tableRef={tableRef} onResize={handleColResize("progress")}>คืบหน้า</ResizableTh>
                {visitColumns.map((n) => (
                  <ResizableTh key={n} width={colWidth(`visit_${n}`)} align="center" rowSpan={2} columnKey={`visit_${n}`} tableRef={tableRef} onResize={handleColResize(`visit_${n}`)}>ครั้งที่ {n}</ResizableTh>
                ))}
                <ResizableTh width={colWidth("team")} rowSpan={2} columnKey="team" tableRef={tableRef} onResize={handleColResize("team")}>ผู้รับผิดชอบ</ResizableTh>
                <TableCell align="center" rowSpan={2} sx={{ width: colWidth("actions") }} />
              </TableRow>
              <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "#fef2f2", borderBottom: `2px solid ${ACCENT} !important`, color: "#7f1d1d", letterSpacing: "0.01em" } }}>
                <ResizableTh width={colWidth("contractNo")} columnKey="contractNo" tableRef={tableRef} onResize={handleColResize("contractNo")}>สัญญา</ResizableTh>
                <ResizableTh width={colWidth("quotationNo")} columnKey="quotationNo" tableRef={tableRef} onResize={handleColResize("quotationNo")}>ใบเสนอราคา</ResizableTh>
                <ResizableTh width={colWidth("contractStart")} columnKey="contractStart" tableRef={tableRef} onResize={handleColResize("contractStart")}>เริ่มต้น</ResizableTh>
                <ResizableTh width={colWidth("contractEnd")} columnKey="contractEnd" tableRef={tableRef} onResize={handleColResize("contractEnd")}>สิ้นสุด</ResizableTh>
              </TableRow>
            </TableHead>
            <TableBody>
              {pagedRows.map((c, idx) => {
                // ✅ "ครั้งถัดไปที่ว่าง" — ใช้ตัดสินว่าจะโชว์ปุ่ม "+ เพิ่มครั้งถัดไป" ในช่องครั้งที่ไหน
                // (ย้ายมาจากคอลัมน์ actions แยกต่างหาก มาไว้ในช่องครั้งที่ของมันเองเลย พอเพิ่มสำเร็จแล้ว
                // ปุ่มจะขยับไปโผล่ที่ช่องครั้งถัดไปเองอัตโนมัติ เพราะคำนวณจากจำนวนครั้งที่ใช้ไปแล้วสดๆ ทุกครั้ง)
                const nextOpenRound = c.isRealContract
                  ? countUsedRounds(c.visits.filter((v) => !v.unscheduled)) + 1
                  : null;
                const overdueInfo = nextVisitOverdueInfo(c);
                return (
                <TableRow
                  key={c.key} hover
                  sx={{ bgcolor: idx % 2 ? alpha("#0f172a", 0.02) : "transparent", transition: "background-color .12s" }}
                >
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
                  <EditableCell
                    editable={c.isRealContract} columnKey="contractNo"
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
                    editable={c.isRealContract} columnKey="quotationNo"
                    editing={editingCell?.key === c.key && editingCell?.field === "quotationNo"}
                    value={c.quotationNo} editValue={editValue} saving={editSaving}
                    width={colWidth("quotationNo")} title={c.quotationNo}
                    onStartEdit={() => beginEdit(c, "quotationNo")}
                    onChangeValue={setEditValue}
                    onCommit={() => commitEdit(c)}
                    onCancel={cancelEdit}
                  />
                  <TableCell data-col-key="company" sx={{ width: colWidth("company"), maxWidth: colWidth("company"), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.company}>{c.company || <Dash />}</TableCell>
                  <TableCell data-col-key="site" sx={{ width: colWidth("site"), maxWidth: colWidth("site"), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.site}>{c.site || <Dash />}</TableCell>
                  <TableCell data-col-key="system" sx={{ width: colWidth("system"), maxWidth: colWidth("system"), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.system}>{c.system || <Dash />}</TableCell>
                  <TableCell data-col-key="title" sx={{ width: colWidth("title"), maxWidth: colWidth("title"), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.title}>{c.title || <Dash />}</TableCell>
                  <EditableCell
                    editable={c.isRealContract} columnKey="contractStart"
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
                    editable={c.isRealContract} columnKey="contractEnd"
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
                    editable={c.isRealContract} columnKey="visitCount"
                    editing={editingCell?.key === c.key && editingCell?.field === "visitCount"}
                    value={c.visitCount} editValue={editValue} editType="number" saving={editSaving}
                    width={colWidth("visitCount")} align="center"
                    // ✅ เตือนถ้ารอบล่าสุดผ่านมาเกิน 3 เดือนแล้วแต่ยังไม่ได้ลงแผนงานครั้งถัดไปเลย — วงกลม
                    // สีแดงทึบ (ไม่ใช่แค่ไอคอนสีแดงบนพื้นขาว) ให้เห็นชัดแม้เป็นภาพนิ่ง ไม่ต้องรอดูอนิเมชัน
                    formatDisplay={(v) => (
                      <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                        <span>{v || <Dash />}</span>
                        {overdueInfo && (
                          <Tooltip title={`รอบล่าสุด ${overdueInfo.lastVisitDate.format("DD/MM/YYYY")} — เกินกำหนดรอบถัดไปแล้ว ${overdueInfo.monthsOverdue} เดือน ยังไม่ได้ลงแผนงานครั้งถัดไป`}>
                            <Box
                              component="span"
                              sx={{
                                display: "inline-flex", alignItems: "center", justifyContent: "center",
                                width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                                bgcolor: "#dc2626", color: "#fff",
                                animation: "contractOverviewPulse 1.6s ease-in-out infinite",
                                "@keyframes contractOverviewPulse": {
                                  "0%, 100%": { boxShadow: `0 0 0 0 ${alpha("#dc2626", 0.5)}` },
                                  "50%": { boxShadow: `0 0 0 4px ${alpha("#dc2626", 0)}` },
                                },
                              }}
                            >
                              <WarningAmber sx={{ fontSize: 12 }} />
                            </Box>
                          </Tooltip>
                        )}
                      </Stack>
                    )}
                    onStartEdit={() => beginEdit(c, "visitCount")}
                    onChangeValue={setEditValue}
                    onCommit={() => commitEdit(c)}
                    onCancel={cancelEdit}
                  />
                  <EditableCell
                    editable={c.isRealContract} columnKey="jobValue"
                    editing={editingCell?.key === c.key && editingCell?.field === "jobValue"}
                    value={c.jobValue} editValue={editValue} editType="number" saving={editSaving}
                    width={colWidth("jobValue")} align="right"
                    formatDisplay={(v) => (v != null && v !== "" ? Number(v).toLocaleString() : <Dash />)}
                    onStartEdit={() => beginEdit(c, "jobValue")}
                    onChangeValue={setEditValue}
                    onCommit={() => commitEdit(c)}
                    onCancel={cancelEdit}
                  />
                  <TableCell data-col-key="status" align="center" sx={{ width: colWidth("status") }}>
                    {(() => {
                      const st = contractStatusInfo(c);
                      return st ? (
                        <Chip
                          label={st.label} size="small"
                          sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700, bgcolor: alpha(st.color, 0.12), color: st.color }}
                        />
                      ) : <Dash />;
                    })()}
                  </TableCell>
                  <TableCell data-col-key="progress" align="center" sx={{ width: colWidth("progress") }}>
                    {(() => {
                      // ✅ นับความคืบหน้าเป็น "ครั้ง" ไม่ใช่ document — ครั้งที่เข้างานไม่ต่อเนื่อง (หลาย
                      // document ต่อครั้ง) นับว่า "เสร็จ" ก็ต่อเมื่อทุก document ของครั้งนั้นเสร็จหมดแล้ว
                      const byRound = new Map();
                      c.visits.filter((v) => !v.unscheduled).forEach((v) => {
                        const key = String(v.time);
                        if (!byRound.has(key)) byRound.set(key, []);
                        byRound.get(key).push(v);
                      });
                      let doneCount = 0;
                      byRound.forEach((docs) => { if (docs.every((d) => d.status === "ดำเนินการเสร็จสิ้น")) doneCount += 1; });
                      const total = c.visitCount || countUsedRounds(c.visits);
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
                    const withinCount = n <= (c.visitCount || countUsedRounds(c.visits));
                    if (!withinCount) {
                      return <TableCell key={n} data-col-key={`visit_${n}`} align="center" sx={{ width: colWidth(`visit_${n}`), bgcolor: "action.hover" }} />;
                    }
                    // ✅ นับว่า "ถึงรอบแล้ว" เฉพาะครั้งที่ลงตารางจริงเท่านั้น (!unscheduled) — ถ้าเป็นแค่
                    // แผนงานล่วงหน้าที่จองครั้งนี้ไว้ (ยังไม่มีวันที่จริง) ให้ยังถือว่า "ว่าง" อยู่ในตาราง
                    // สัญญานี้ แต่โชว์ป้ายบอกว่ากำลังรอวางแผนอยู่ แทนที่จะเป็นขีดว่างเฉยๆ กันสับสนว่ายังไม่ได้จอง
                    // ✅ ครั้งที่เข้างานไม่ต่อเนื่อง (เว้นช่วงแล้วกลับมาเข้าอีก) จะมีมากกว่า 1 document ต่อ
                    // ครั้ง — ใช้ filter หาทุกอันแทน find อันเดียว โชว์ซ้อนกันเป็นแถวในเซลล์เดียว
                    // ✅ เรียงตามวันที่เข้างานจริง (เก่า→ใหม่) เสมอ — เดิมโชว์ตามลำดับที่ document ถูกสร้าง
                    // (เช่น ต่อวันที่ย้อนหลังทีหลัง) ทำให้วันที่ในเซลล์เดียวกันโผล่สลับก่อนหลังไม่ตรงความจริง
                    // ดูเหมือนข้อมูลมั่ว/ไม่ได้จัดกลุ่มให้ ทั้งที่จริงเป็นงานเดียวกัน (jobGroupId เดียวกัน) แค่โชว์ผิดลำดับ
                    const roundVisits = c.visits
                      .filter((v) => !v.unscheduled && Number(v.time) === n)
                      .sort((a, b) => new Date(a.start || a.date) - new Date(b.start || b.date));
                    const pendingDraft = roundVisits.length === 0 && c.visits.find((v) => v.unscheduled && Number(v.time) === n);
                    return (
                      <TableCell key={n} data-col-key={`visit_${n}`} align="center" sx={{ width: colWidth(`visit_${n}`), overflow: "hidden" }}>
                        {roundVisits.length > 0 ? (
                          <Stack spacing={0.25} alignItems="center">
                            {roundVisits.map((visit) => (
                              <Link
                                key={visit._id}
                                to={`/operation/${visit._id}${resolveOperationGroup(visit) ? `?group=${resolveOperationGroup(visit)}` : ""}`}
                                style={{ color: STATUS_COLOR[visit.status] || ACCENT, fontWeight: 600, textDecoration: "none", fontSize: "0.78rem", whiteSpace: "nowrap" }}
                              >
                                {formatEventDateRange(visit)}
                              </Link>
                            ))}
                            {c.isRealContract && (
                              <Stack direction="row" spacing={0.25}>
                                <Tooltip title="เพิ่มวันที่ต่อเนื่อง (เข้างานไม่ติดกัน)">
                                  <IconButton size="small" onClick={() => openExtendVisitDialog(c, n)} sx={{ p: 0.25, color: "text.disabled", "&:hover": { color: ACCENT } }}>
                                    <Add sx={{ fontSize: 14 }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="แยกครั้งนี้ออกจากสัญญา (ย้ายเป็นงานเก่าที่ยังไม่จัดกลุ่ม)">
                                  <IconButton size="small" onClick={() => handleDetachRound(c, n)} sx={{ p: 0.25, color: "text.disabled", "&:hover": { color: ACCENT } }}>
                                    <LinkOff sx={{ fontSize: 14 }} />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            )}
                          </Stack>
                        ) : pendingDraft ? (
                          // ✅ กดได้เลย — พาไปหน้าปฏิทิน เจาะจงงานนี้ในแผงงานล่วงหน้าเลย (เดิมโชว์
                          // แค่ตัวหนังสือเฉยๆ กดไม่ได้ ต้องไปไล่หาเองว่าอยู่เดือนไหน/หน้าไหน) เห็นชัดว่า
                          // กดได้จากพื้นหลังชิป + ขีดเส้นใต้ตอน hover เหมือนลิงก์อื่นในตารางนี้
                          <Tooltip title="วางแผนล่วงหน้าไว้แล้ว ยังไม่ได้ลงวันที่จริง — กดเพื่อไปดูงานนี้">
                            <Box
                              component={Link}
                              to={`/event?draft=${pendingDraft._id}${pendingDraft.plannedMonth ? `&month=${pendingDraft.plannedMonth}` : ""}`}
                              sx={{
                                fontSize: "0.72rem", color: "#b45309", fontWeight: 600, whiteSpace: "nowrap",
                                textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 0.4,
                                px: 0.75, py: 0.25, borderRadius: 1.5, bgcolor: alpha("#f59e0b", 0.1),
                                border: "1px solid", borderColor: alpha("#f59e0b", 0.3),
                                transition: "background-color 0.15s ease, border-color 0.15s ease",
                                "&:hover": { bgcolor: alpha("#f59e0b", 0.2), borderColor: "#b45309", textDecoration: "underline" },
                              }}
                            >
                              📌 รอวางแผน
                            </Box>
                          </Tooltip>
                        ) : c.isRealContract && n === nextOpenRound ? (
                          // ✅ ปุ่ม "+ เพิ่มครั้งถัดไป" ย้ายมาอยู่ในช่องของครั้งที่มันเองเลย (เดิมอยู่ในคอลัมน์
                          // actions แยกต่างหาก มองไม่ออกว่ากดแล้วจะไปเพิ่มครั้งที่เท่าไหร่) พอเพิ่มสำเร็จแล้ว
                          // nextOpenRound จะขยับไปครั้งถัดไปเอง ปุ่มก็เลยย้ายไปโผล่ที่ช่องนั้นแทนอัตโนมัติ —
                          // ถ้าเลยกำหนด 3 เดือนแล้วด้วย (overdueInfo) ให้พื้นหลังปุ่มทึบแดงเห็นชัดแม้เป็น
                          // ภาพนิ่ง (ของเดิมแค่เปลี่ยนสีไอคอน ซึ่งเป็นสีแดงเดียวกับปุ่มปกติอยู่แล้ว มองไม่ออก
                          // ว่าต่างกันตรงไหน) + จุดแจ้งเตือนมุมขวาบนกะพริบเบาๆ เสริมอีกชั้น
                          <Tooltip title={overdueInfo ? `เกินกำหนดแล้ว ${overdueInfo.monthsOverdue} เดือน — กดเพื่อเพิ่มครั้งที่ ${n}` : `เพิ่มครั้งที่ ${n}`}>
                            <Badge
                              color="error" variant="dot" invisible={!overdueInfo}
                              sx={{
                                "& .MuiBadge-dot": {
                                  animation: "contractOverviewPulse 1.4s ease-in-out infinite",
                                  "@keyframes contractOverviewPulse": {
                                    "0%, 100%": { transform: "scale(1)", opacity: 1 },
                                    "50%": { transform: "scale(1.5)", opacity: 0.6 },
                                  },
                                },
                              }}
                            >
                              <IconButton
                                size="small" onClick={() => openAddVisitDialog(c)}
                                sx={overdueInfo ? {
                                  color: "#fff", bgcolor: "#dc2626",
                                  "&:hover": { bgcolor: "#b91c1c" },
                                } : { color: ACCENT }}
                              >
                                <PlaylistAdd fontSize="small" />
                              </IconButton>
                            </Badge>
                          </Tooltip>
                        ) : (
                          <Dash />
                        )}
                      </TableCell>
                    );
                  })}
                  <EditableCell
                    editable={c.isRealContract} columnKey="team"
                    editing={editingCell?.key === c.key && editingCell?.field === "team"}
                    value={c.team === "-" ? "" : c.team} editValue={editValue} editType="select" editOptions={teamOptions} saving={editSaving}
                    width={colWidth("team")} title={c.team}
                    onStartEdit={() => beginEdit(c, "team")}
                    onChangeValue={setEditValue}
                    onCommit={() => commitEdit(c)}
                    onCancel={cancelEdit}
                  />
                  <TableCell align="center" sx={{ width: colWidth("actions") }}>
                    {!c.isRealContract && (
                      <Tooltip title={c.isConfirmedGeneral ? "ยืนยันเป็นงานทั่วไปแล้ว — กดเพื่อยกเลิก" : "ยืนยันเป็นงานทั่วไป"}>
                        <IconButton
                          size="small" onClick={() => handleToggleGeneral(c)}
                          sx={{ color: c.isConfirmedGeneral ? "#10b981" : "text.disabled", "&:hover": { color: "#10b981" } }}
                        >
                          {c.isConfirmedGeneral ? <CheckCircle fontSize="small" /> : <CheckCircleOutline fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    )}
                    {!c.isRealContract && (
                      <Tooltip title="ย้ายเข้าสัญญาที่มีอยู่แล้ว">
                        <IconButton size="small" onClick={() => openAttachDialog(c)} sx={{ color: "text.disabled", "&:hover": { color: ACCENT } }}>
                          <AddLink fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title={c.isRealContract ? "ลบสัญญานี้ทั้งหมด" : "ลบงานนี้"}>
                      <IconButton size="small" onClick={() => handleDeleteContract(c)} sx={{ color: "text.disabled", "&:hover": { color: ACCENT } }}>
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
                );
              })}
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
              <TextField
                fullWidth size="small" label="เลขที่สัญญา" value={form.contractNo}
                onChange={(e) => setField("contractNo")(e.target.value)}
                error={isContractNoTaken(form.contractNo)}
                helperText={isContractNoTaken(form.contractNo) ? "เลขที่นี้ถูกใช้ไปแล้ว" : "ระบบแนะนำให้อัตโนมัติ แก้ไขเองได้"}
              />
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
          {addVisitTarget?.extendRound != null
            ? `เพิ่มวันที่ต่อเนื่อง — ครั้งที่ ${addVisitTarget.extendRound}`
            : `เพิ่มครั้งที่ ${addVisitTarget ? countUsedRounds(addVisitTarget.contract.visits.filter((v) => !v.unscheduled)) + 1 : ""} จาก ${addVisitTarget?.contract?.visitCount ?? ""}`}
          <IconButton size="small" onClick={closeAddVisitDialog}><Close fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {addVisitError && <Alert severity="error">{addVisitError}</Alert>}
            {addVisitTarget && (
              <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: alpha(ACCENT, 0.06) }}>
                <Typography variant="body2" fontWeight={700}>{addVisitTarget.contract.company || "-"} · {addVisitTarget.contract.site || "-"}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {addVisitTarget.contract.title} · {addVisitTarget.contract.system}
                  {addVisitTarget.contract.contractNo ? ` · เลขที่สัญญา ${addVisitTarget.contract.contractNo}` : ""}
                </Typography>
                {addVisitTarget.extendRound != null && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                    วันที่เดิมของครั้งนี้: {addVisitTarget.contract.visits
                      .filter((v) => !v.unscheduled && Number(v.time) === addVisitTarget.extendRound)
                      .map((v) => formatEventDateRange(v))
                      .join(", ")}
                  </Typography>
                )}
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

      {/* ✅ ย้ายงานทั่วไปเข้าสัญญาที่มีอยู่แล้ว — แก้ไขกรณีจัดกลุ่มผิด (สร้างเป็นงานเดี่ยวทั้งที่จริง
          ควรอยู่ในสัญญานี้) ต่างจากปุ่ม "จัดกลุ่มเป็นสัญญา" ที่สร้างสัญญาใหม่เสมอ */}
      <Dialog open={Boolean(attachTarget)} onClose={closeAttachDialog} fullWidth maxWidth="xs" fullScreen={isMobile}>
        <DialogTitle sx={{ fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          ย้ายเข้าสัญญาที่มีอยู่แล้ว
          <IconButton size="small" onClick={closeAttachDialog}><Close fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {attachTarget && (
              <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: alpha(ACCENT, 0.06) }}>
                <Typography variant="body2" fontWeight={700}>{attachTarget.company || "-"} · {attachTarget.site || "-"}</Typography>
                <Typography variant="caption" color="text.secondary">{attachTarget.title} · {attachTarget.system}</Typography>
              </Box>
            )}
            {attachError && <Alert severity="error">{attachError}</Alert>}
            <TextField
              select fullWidth size="small" label="เลือกสัญญาปลายทาง"
              value={attachContractId}
              onChange={(e) => { setAttachContractId(e.target.value); setAttachRound(""); }}
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
            >
              <option value="">— เลือกสัญญา —</option>
              {attachableContracts.map((x) => (
                <option key={x.key} value={x.key}>
                  {[x.company, x.site].filter(Boolean).join(" · ") || "(ไม่ระบุชื่อ)"}{x.contractNo ? ` · ${x.contractNo}` : ""}
                </option>
              ))}
            </TextField>
            {selectedAttachContract && (
              <Box>
                <Typography variant="caption" fontWeight={700} color="text.secondary">
                  เลือกครั้งที่ — ครั้งที่ลงตารางแล้ว (✅) เลือกได้เหมือนกัน จะต่อเป็นงานเดียวกัน (ไม่นับเป็นครั้งใหม่)
                </Typography>
                <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 0.75 }}>
                  {attachRoundOptions.map((opt) => {
                    const selectable = opt.status === "open" || opt.status === "scheduled";
                    return (
                    <Tooltip
                      key={opt.n}
                      title={opt.status === "scheduled" ? "ลงตารางแล้ว — เลือกเพื่อต่อเป็นงานเดียวกัน (ไม่นับครั้งใหม่)"
                        : opt.status === "pending" ? "มีแผนงานล่วงหน้าจองไว้แล้ว ยังไม่มีวันที่จริง — เลือกไม่ได้"
                        : "ครั้งว่าง"}
                    >
                      <span>
                        <Chip
                          label={opt.status === "scheduled" ? `✅ ${opt.n}` : opt.status === "pending" ? `📌 ${opt.n}` : opt.n}
                          clickable={selectable}
                          disabled={!selectable}
                          onClick={() => selectable && setAttachRound(String(opt.n))}
                          color={String(attachRound) === String(opt.n) ? "error" : "default"}
                          variant={String(attachRound) === String(opt.n) ? "filled" : "outlined"}
                          sx={{ fontWeight: 700 }}
                        />
                      </span>
                    </Tooltip>
                    );
                  })}
                </Stack>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={closeAttachDialog} disabled={attachSaving} sx={{ textTransform: "none" }}>ยกเลิก</Button>
          <Button
            variant="contained" onClick={handleAttachSubmit} disabled={attachSaving || !attachContractId || !attachRound}
            sx={{ bgcolor: ACCENT, textTransform: "none", fontWeight: 700, "&:hover": { bgcolor: "#b91c1c" } }}
          >
            {attachSaving ? "กำลังบันทึก..." : "ย้ายเข้าสัญญา"}
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
              <TextField
                fullWidth size="small" label="เลขที่สัญญา" value={mergeForm.contractNo}
                onChange={(e) => setMergeField("contractNo")(e.target.value)}
                error={isContractNoTaken(mergeForm.contractNo)}
                helperText={isContractNoTaken(mergeForm.contractNo) ? "เลขที่นี้ถูกใช้ไปแล้ว" : ""}
              />
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
