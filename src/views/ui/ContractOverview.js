/**
 * ContractOverview.js — "ภาพรวมสัญญา"
 *
 * จัดกลุ่มงานที่ผูกด้วย contractGroupId เดียวกัน (ครั้งที่ 1-N ของสัญญาเดียวกัน — ดู AddEvent.js
 * โหมด "สัญญาแบบหลายครั้ง") ให้แสดงเป็นตาราง 1 แถวต่อสัญญา คอลัมน์ตรงกับตาราง Excel ที่ใช้ติดตาม
 * สัญญาบริการอยู่แล้ว (บริษัท/โครงการ/ระบบ/ประเภทงาน/เลขที่สัญญา/ใบเสนอราคา/ระยะเวลา/จำนวนครั้ง/
 * วันที่เข้างานแต่ละครั้ง/มูลค่างาน/ทีมที่เข้างาน/ผู้รับผิดชอบ) — งานเก่าที่ยังไม่มี contractGroupId
 * (สร้างก่อนมีฟีเจอร์นี้) ถูกจัดเป็นสัญญา 1 ครั้งของตัวเอง ไม่หายไปจากตาราง
 *
 * ✅ "ทีมที่เข้างาน" (team) ≠ "ผู้รับผิดชอบ" (responsiblePerson) — สองฟิลด์อิสระจากกันโดยสมบูรณ์
 * แก้ไขแยกกันได้ในตารางนี้เลย ทีมที่เข้างานเปลี่ยนได้ทุกครั้งที่มอบหมายคนอื่นไปทำแทน แต่คนที่รับผิดชอบ
 * สัญญา/ลูกค้ารายนี้โดยรวมไม่ควรเปลี่ยนตาม (งานเก่าที่ยังไม่เคยตั้งค่าผู้รับผิดชอบเลย fallback ไปใช้
 * ค่าทีมเดิมแสดงแทนก่อน) ดู groupEventsByContract ใน utils/contractOverdue.js
 *
 * ✅ "ทีมที่เข้างาน" เองก็แยกหัวหน้า/ลูกทีมชัดเจน — teamLeaderName (คนเดียว แก้ไข/ผูก resPerson ได้
 * ตรงนี้) vs teamMemberNames (ผู้ช่วย แสดงผลอย่างเดียว ไม่กระทบสิทธิ์/แจ้งเตือน) คอลัมน์ในตารางย่อเป็น
 * "ชื่อหัวหน้า +N" แล้วโชว์รายชื่อเต็มใน tooltip ตอน hover
 *
 * ✅ แก้ไขได้เฉพาะแอดมิน/manager (isAdminOrManager คุมทุกจุดที่แก้ไขข้อมูล) แต่ช่างเข้ามาดูงานของ
 * ตัวเองได้ด้วย (canView) — ข้อมูลถูกกรองเหลือแค่งานของตัวเองให้แล้วตั้งแต่ฝั่ง backend
 * (GET /events/event-op, /events/drafts เช็ค resPerson/team/userId ให้อยู่แล้ว) จึงไม่ต้องกรองซ้ำที่นี่
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Link, useSearchParams } from "react-router-dom";
import moment from "moment";
import "moment/locale/th";
import Swal from "sweetalert2";
import {
  Box, Stack, Typography, TextField, InputAdornment, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Skeleton,
  Dialog, DialogTitle, DialogContent, DialogActions, ToggleButtonGroup, ToggleButton,
  Button, Autocomplete, Alert, Chip, Checkbox, Pagination, useMediaQuery, Badge,
  TableSortLabel, Menu, MenuItem, ListItemIcon, ListItemText,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Search, Refresh, Download, FolderOpen, Add, Close,
  PlaylistAdd, MergeType, GroupWork, DeleteOutline, WarningAmber,
  AddLink, LinkOff, Build, Engineering,
  CalendarMonth, PersonOutline, Category, Assignment, Description, HourglassEmpty, Apps,
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
import { countUsedRounds, visitsPerYear } from "../../utils/contractRounds";
import { groupEventsByContract, nextVisitOverdueInfo } from "../../utils/contractOverdue";
import { escapeHtml } from "../../utils/escapeHtml";

const ACCENT = "#dc2626";
// ✅ เพดานจำนวนครั้งของสัญญา — บังคับทุกจุดที่ตั้งค่านี้ (ฟอร์มเพิ่มสัญญา/แก้ไข inline/จัดกลุ่มเป็นสัญญา
// ทั้งฝั่งจอและฝั่ง backend) และใช้เป็นเพดานตอนคำนวณจำนวนคอลัมน์ "ครั้งที่ N" ของตารางด้วย (กันไว้อีก
// ชั้น เผื่อมีข้อมูลเก่า/จากที่อื่นที่หลุดรอดมาสูงกว่านี้ — ไม่งั้นตารางทั้งหน้าจะกว้างจนพังได้)
const MAX_VISIT_COUNT = 12;

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
  contractNo: 120, quotationNo: 120, docNo: 150,
  company: 170, site: 170, system: 110, title: 170,
  contractStart: 100, contractEnd: 100, intervalMonths: 96,
  visitCount: 92, jobValue: 100, status: 130, progress: 90, team: 120, responsiblePerson: 130,
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

const ResizableTh = ({ width, align = "left", children, onResize, rowSpan = 1, columnKey, tableRef, sortable = false, sortDirection = null, onSort }) => {
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
      // ⚠️ BUG ที่แก้ (auto-fit ไม่สมบูรณ์เมื่อข้อมูลยาว): เดิม clamp ไว้ที่ 420px เสมอ พอชื่อบริษัท/
      // โครงการยาวเกิน 420px (หลังบวก padding) auto-fit จะหยุดที่ 420 ทุกครั้ง ข้อความยังโดนตัด ...
      // อยู่ดีทั้งที่กดจัดพอดีอัตโนมัติไปแล้ว — ตารางเลื่อนแนวนอนได้อยู่แล้ว (overflowX บน
      // TableContainer) จึงไม่จำเป็นต้อง cap ความกว้างสูงสุดเลย ปล่อยให้กว้างเท่าที่เนื้อหาต้องการจริง
      onResize(Math.max(MIN_COL_WIDTH, Math.ceil(maxWidth) + AUTO_FIT_PADDING));
    }
  };

  // ✅ เดิมรองรับแค่ mousedown/mousemove (ลากด้วยเมาส์) — จอมือถือ/แท็บเล็ตไม่มีเมาส์ ลากปรับความกว้าง
  // คอลัมน์ไม่ได้เลย ต้องฟัง touch event คู่กันด้วยเพื่อให้ลากด้วยนิ้วได้เหมือนกัน (เทียบ pattern เดียวกัน
  // เกือบทั้งหมด แค่อ่านพิกัดจาก e.touches[0].clientX แทน e.clientX)
  // ⚠️ ประวัติการแก้ (3 รอบ กว่าจะได้ตัวที่ถูกต้อง):
  // 1) เดิมเรียก onResize (setState) ทุก mousemove จริง + เขียน localStorage ทุกครั้งด้วย → กระตุกมาก
  // 2) ลองเซ็ต element.style.width ตรงบนเซลล์ระหว่างลาก (ไม่ผ่าน React เลย) — inline style ที่เซ็ตตรงๆ
  //    แบบนั้นมี specificity สูงกว่า class ที่ MUI sx สร้างเสมอ พอลากคอลัมน์ไหนไปแล้ว inline style จะ
  //    "ค้าง" ถาวร ทำให้ auto-fit ครั้งต่อไปสั่ง React อัปเดต class ใหม่แล้วหน้าจอไม่ขยับตาม (ต้องรีเฟรช
  //    หน้าใหม่ DOM ถึงจะไม่มี inline style ค้างอีก) — bug ที่ผู้ใช้เจอ "กดไม่ได้เลย ต้องรีเฟรชถึงจะอัปเดต"
  // 3) ลองย้อนกลับมาเรียก onResize (setState) ทุกเฟรมของ requestAnimationFrame แทน (ไม่แตะ DOM ตรงๆ)
  //    ปลอดภัยจากบั๊กข้อ 2 ก็จริง แต่ทุกครั้งที่ setState ทำให้ทั้งตาราง (10 แถว x กว่า 15 คอลัมน์) ต้อง
  //    re-render ใหม่ ซ้ำยังต้องให้ MUI/emotion สร้าง CSS class ใหม่ให้ทุกเซลล์ที่ความกว้างเปลี่ยนทุกเฟรม
  //    ด้วย (serialize/hash/insertRule) รวมกันหนักเกินจะทัน 60fps จริง กลายเป็น "หน่วงมาก" แทน
  // ✅ ทางแก้ที่ถูกต้อง (รอบนี้): ย้ายไปใช้ CSS custom property (--col-<key> / --col-total ตั้งไว้ที่
  // <Table> เดียว ดู tableCssVars ในคอมโพเนนต์หลัก) ทุกเซลล์อ้างอิงความกว้างผ่าน var(--col-<key>) ซึ่งเป็น
  // "ค่าคงที่" ในมุมมองของ sx (ไม่เปลี่ยนตามตัวเลขจริงเลย) — ระหว่างลากจึงเซ็ต custom property ตรงบน DOM
  // ของ <table> เองได้เลย (ไม่ผ่าน React re-render สักครั้ง เร็วกว่าตั้งเยอะ แค่ 2 บรรทัด setProperty ต่อ
  // เฟรม) โดยไม่ชนกับบั๊กข้อ 2 อีกเลย เพราะทั้งการเขียนสดตอนลาก และตอน React re-render จริงหลัง commit
  // (ผ่าน style prop ของ <Table>) ต่างก็เขียนไปที่ custom property "ตัวเดียวกันเป๊ะ" ไม่ใช่ inline style
  // ปะทะ class แบบข้อ 2 — แล้วค่อยเรียก onResize (setState + localStorage) แค่ครั้งเดียวตอนปล่อยเมาส์/นิ้ว
  const startDrag = (startClientX) => {
    const startWidth = width;
    const table = tableRef?.current;
    const startTotalWidthPx = table ? table.getBoundingClientRect().width : 0;
    let rafId = null;
    let lastClientX = startClientX;

    const computeWidth = (clientX) => Math.max(MIN_COL_WIDTH, startWidth + (clientX - startClientX));
    const applyLive = (clientX) => {
      const newWidth = computeWidth(clientX);
      if (table && columnKey) {
        table.style.setProperty(`--col-${columnKey}`, `${newWidth}px`);
        table.style.setProperty("--col-total", `${startTotalWidthPx + (newWidth - startWidth)}px`);
      }
      return newWidth;
    };
    const scheduleUpdate = (clientX) => {
      lastClientX = clientX;
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        applyLive(lastClientX);
      });
    };
    const commit = () => {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      const finalWidth = applyLive(lastClientX);
      if (finalWidth !== startWidth) onResize(finalWidth);
    };
    const onMouseMove = (e) => scheduleUpdate(e.clientX);
    const onTouchMove = (e) => {
      if (e.touches[0]) { e.preventDefault(); scheduleUpdate(e.touches[0].clientX); }
    };
    const cleanup = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
    const onMouseUp = () => { cleanup(); commit(); };
    const onTouchEnd = () => { cleanup(); commit(); };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
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
  // ✅ อ้างอิงความกว้างผ่าน CSS var เสมอ (string คงที่ต่อ columnKey ไม่ขึ้นกับตัวเลข width จริงเลย) —
  // กัน emotion ต้องสร้าง class ใหม่ทุกครั้งที่ลาก/auto-fit แม้แต่ตอน commit เข้า React state จริงก็ตาม
  const cssWidth = `var(--col-${columnKey}, ${DEFAULT_COL_WIDTHS[columnKey] ?? VISIT_COL_DEFAULT_WIDTH}px)`;
  return (
    <TableCell
      align={align}
      rowSpan={rowSpan}
      data-col-key={columnKey}
      sx={{ position: "relative", width: cssWidth, minWidth: cssWidth, maxWidth: cssWidth, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", userSelect: "none" }}
    >
      {/* ✅ คลิกที่ป้ายชื่อคอลัมน์ (ไม่ใช่แถบลากขอบขวา) เพื่อเรียงลำดับ — คลิกแรก = น้อยไปมาก, คลิกซ้ำ
          = มากไปน้อย, คลิกอีกที = เลิกเรียง ใช้ TableSortLabel ของ MUI แทนลูกศรมือทำเอง ให้หน้าตา/
          พฤติกรรมตรงตามมาตรฐาน MUI ทั้งแอป (ไอคอนหมุนเปลี่ยนทิศทาง + ไฮไลต์สีตอนกำลังเรียงอยู่) */}
      {sortable ? (
        <TableSortLabel
          active={sortDirection !== null}
          direction={sortDirection || "asc"}
          onClick={() => onSort(columnKey)}
          sx={{
            "&.MuiTableSortLabel-root": { color: "inherit" },
            "&.Mui-active": { color: ACCENT },
            "& .MuiTableSortLabel-icon": { color: `${ACCENT} !important` },
          }}
        >
          {children}
        </TableSortLabel>
      ) : children}
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
      ) : editType === "autocomplete" ? (
        // ✅ เลือกจากรายชื่อที่มีอยู่แล้วในระบบได้ (กันพิมพ์ผิด/สะกดต่างกันจนกลายเป็นคนละชื่อ) หรือจะ
        // พิมพ์เอาใหม่เองก็ได้ (freeSolo — ไม่บังคับต้องมีในรายการเดิม เผื่อเป็นระบบ/ประเภทงานใหม่จริงๆ
        // ที่ยังไม่เคยมีใครกรอกไว้) เทียบ pattern เดียวกับฟอร์ม "เพิ่มสัญญาใหม่" ด้านล่างเป๊ะๆ
        <Autocomplete
          freeSolo autoFocus size="small" fullWidth disabled={saving}
          options={editOptions || []}
          inputValue={editValue}
          onInputChange={(_, v) => onChangeValue(v)}
          renderInput={(params) => (
            <TextField
              {...params}
              autoFocus
              onBlur={onCommit}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); onCommit(); }
                if (e.key === "Escape") onCancel();
              }}
              sx={{ "& .MuiOutlinedInput-input": { py: 0.5, fontSize: "0.8rem" } }}
            />
          )}
        />
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
  // ✅ ช่างเข้าดูหน้านี้ได้ด้วย (เห็นแค่งานของตัวเอง — กรองมาจาก backend แล้ว) แต่แก้ไขไม่ได้
  // isAdminOrManager ยังคงคุมทุกจุดที่แก้ไขข้อมูลเหมือนเดิมทั้งหมด เทียบ pattern เดียวกับ
  // QuotationTracking.js (canAccess/isAdminOrManager แยกกัน)
  const canView = ["admin", "manager", "technician"].includes(role);

  const [searchParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // ✅ งานส่วนใหญ่ในระบบยังเป็นงานเก่าที่ยังไม่ได้จัดกลุ่มเป็นสัญญา (สร้างก่อนมีฟีเจอร์นี้) เดิม fallback
  // ให้ทุกงานเก่าขึ้นเป็น "สัญญา" 1 แถวของตัวเอง ทำให้ตารางท่วมไปด้วยแถวที่ไม่มีข้อมูลสัญญาจริงเลย
  // (ขึ้น "-" เกือบทุกช่อง) ดูรก/ไม่มีประโยชน์ — ใช้แท็บสลับมุมมองแทน switch เดียว (เทียบ pattern
  // เดียวกับแท็บประเภทเอกสารในหน้า "ไฟล์") ค่าเริ่มต้นโชว์เฉพาะสัญญาจริงก่อน กันรกตารางเหมือนเดิม
  // ✅ ?view=overdue — เปิดมาที่แท็บ "เลยกำหนด/คงค้าง" ได้ตรงๆ จากลิงก์แจ้งเตือน push (ดู
  // checkAndNotifyOverdueContracts ฝั่ง backend) แทนที่จะเปิดมาแท็บเริ่มต้นแล้วต้องกดกรองเอง
  const [viewFilter, setViewFilter] = useState(
    () => (searchParams.get("view") === "overdue" ? "overdue" : "contracts")
  ); // "contracts" | "overdue" | "ungrouped" | "all"

  // ✅ ตัวเลือกฟอร์ม "เพิ่มสัญญาใหม่" — ดึงพร้อมกับ events ตอนเปิดหน้า ไม่ต้องรอกดปุ่มเพิ่มก่อนค่อยโหลด
  const [lookups, setLookups] = useState({ customers: [], employees: [], jobTypes: [], systemTypes: [] });

  // ✅ silent=true — ไม่ขึ้น <Skeleton> ทับตารางทั้งหน้า (ใช้ตอน sync ข้อมูลเงียบๆ หลังจากที่หน้าจอ
  // อัปเดตค่าที่แก้ไปแล้วแบบ optimistic ไปก่อนหน้านี้แล้ว — ไม่ใช่ตอนโหลดหน้าครั้งแรกซึ่งยังไม่มีอะไร
  // ให้โชว์อยู่ก่อน จึงยัง setLoading(true) ตามปกติ)
  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
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
      if (!silent) setEvents([]);
    } finally {
      if (!silent) setLoading(false);
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

  // ✅ ข้อมูลอัพเดตเรียลไทม์โดยไม่ต้องกดรีเฟรชเอง — เทียบ pattern เดียวกับ Operation/index.js (15s)
  // ใช้ fetchData(true) (silent — ไม่ตั้ง loading จึงไม่มี <Skeleton> วาบทับตาราง) เหมือนที่ใช้อยู่แล้ว
  // หลังทุกการบันทึก/แก้ไขในหน้านี้ ไม่กระทบเซลล์ที่กำลังแก้ไข inline ค้างอยู่ (editingCell ยึดด้วย
  // c.key ซึ่งเป็น string คงที่ ไม่ใช่ object reference ที่เปลี่ยนทุกครั้งที่ fetch ใหม่ และ editValue
  // เป็น state แยกต่างหาก ไม่ถูกเขียนทับจากข้อมูลที่ fetch มาใหม่)
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // ✅ ช่างดูอย่างเดียว ไม่มีทางเลือกงานไปจัดกลุ่มเป็นสัญญาได้ — ปิดตรงนี้จุดเดียวพอ ปิดพ่วงทั้งคอลัมน์
  // checkbox, กล่องแนะนำกลุ่มงานเก่า (showCheckboxes && ...) และแถบ "จัดกลุ่มเป็นสัญญา" (โผล่ต่อเมื่อ
  // มีการเลือกไว้เท่านั้น ซึ่งเป็นไปไม่ได้ถ้าไม่มี checkbox ให้กดตั้งแต่แรก)
  const showCheckboxes = isAdminOrManager && viewFilter !== "contracts";
  // ✅ ซ่อนคอลัมน์ที่เป็นข้อมูลระดับสัญญาล้วนๆ (เลขที่เอกสาร/ระยะเวลา/จำนวนครั้ง/มูลค่างาน/สถานะสัญญา)
  // ตอนดูแท็บที่ไม่ใช่สัญญาจริงทั้งคู่ ("ยังไม่จัดกลุ่ม" และ "งานทั่วไป") — แถวพวกนี้เป็น "-" ว่างเปล่า
  // ทุกช่องเสมอไม่ว่าจะยืนยันเป็นงานทั่วไปแล้วหรือยัง (isConfirmedGeneral ไม่เกี่ยวอะไรกับ contractGroupId
  // เลย) ⚠️ เดิมให้แท็บ "งานทั่วไป" ยังคงโชว์ไว้ต่างจากแท็บ "ยังไม่จัดกลุ่ม" แต่พบว่าข้อมูลที่โชว์
  // (เช่น "จำนวนครั้ง 1") เป็นค่าที่คำนวณมั่วจากตรรกะของสัญญา ไม่ใช่ข้อมูลจริงที่มีใครกรอกไว้เลย รกตา
  // และดูเหมือนมีข้อมูลสัญญาทั้งที่จริงไม่มี ต้องซ่อนเหมือนกันทั้ง 2 แท็บ
  const hideContractOnlyColumns = viewFilter === "ungrouped" || viewFilter === "general" || viewFilter === "project";
  // ✅ หัวตารางปกติมี 2 แถว (กลุ่ม "เลขที่เอกสาร"/"ระยะเวลา" คลุม 2 คอลัมน์ย่อยแถวล่าง) แต่ตอนซ่อน
  // คอลัมน์ระดับสัญญาทั้งหมดจะไม่มีแถวที่ 2 เหลือให้ colSpan ครอบแล้ว เหลือหัวตารางแค่แถวเดียว
  const headerRowSpan = hideContractOnlyColumns ? 1 : 2;

  // ✅ ความกว้างคอลัมน์ที่ผู้ใช้ลากปรับเอง (key เฉพาะที่ต่างจากค่าเริ่มต้นเท่านั้น) — โหลดจาก
  // localStorage ตอนเปิดหน้า (lazy initializer) แล้วบันทึกกลับทุกครั้งที่ปรับ จะได้จำค่าไว้ข้ามการออก
  // จากหน้า/รีเฟรช ไม่ใช่แค่ระหว่างที่ยังเปิดหน้านี้ค้างอยู่เหมือนเดิม
  const [colWidths, setColWidths] = useState(loadStoredColWidths);
  const colWidth = (key) => colWidths[key] ?? DEFAULT_COL_WIDTHS[key] ?? VISIT_COL_DEFAULT_WIDTH;
  // ⚠️ BUG ที่แก้ (ลากหน่วงมาก): เดิมช่วงลากอัปเดต React state (setColWidths) ทุกเฟรมของ
  // requestAnimationFrame อยู่ดี (แค่เลื่อนแค่การเขียน localStorage ไปตอนปล่อยเมาส์แทน) — แต่ทุกครั้งที่
  // setColWidths ทำให้ทั้งตาราง re-render ใหม่ (10 แถว x กว่า 15 คอลัมน์) และเลขความกว้างที่เปลี่ยนทุก
  // เฟรมยังทำให้ MUI (emotion) ต้องสร้าง CSS class ใหม่ให้ทุกเซลล์ที่ความกว้างเปลี่ยนซ้ำๆ ทุกเฟรมด้วย
  // (serialize/hash/insertRule) รวมกันแล้วหนักเกินจะทัน 60fps จริงๆ ต่อให้ throttle ด้วย rAF แล้วก็ตาม —
  // ย้ายไปใช้ CSS custom property (--col-<key> / --col-total) แทน ตั้งค่าครั้งเดียวผ่าน style ของ
  // <Table> (ดู tableCssVars ด้านล่าง) ให้ทุกเซลล์อ้างอิงผ่าน var(--col-<key>) คงที่ (ไม่เปลี่ยน class เลย
  // ไม่ว่าค่าจะเท่าไหร่) ส่วนระหว่างลากสดๆ ให้ ResizableTh เซ็ต custom property ตรงบน DOM ของ <table> เอง
  // (ไม่ผ่าน React re-render เลยสักครั้ง) แล้วค่อยเรียก onResize (setState+localStorage) แค่ครั้งเดียว
  // ตอนปล่อยเมาส์/นิ้วเท่านั้น — ไม่มีการ re-render ระหว่างลากอีกต่อไป ลื่นจริง ไม่มีบั๊กเดิมที่เคยเจอตอน
  // เปลี่ยนไปแตะ DOM ตรงๆ ด้วย (ดูคอมเมนต์ที่ ResizableTh) เพราะรอบนี้ทั้งการเขียนสดและการ re-render จริง
  // ตอน commit ต่างก็เขียนค่าไปที่ custom property ตัวเดียวกันเป๊ะๆ ไม่ใช่ inline style ปะทะ class อีกแล้ว
  const handleColResize = (key) => (w) => setColWidths((prev) => {
    const next = { ...prev, [key]: w };
    try { localStorage.setItem(COL_WIDTHS_STORAGE_KEY, JSON.stringify(next)); } catch {}
    return next;
  });
  // ✅ ใช้หา DOM ของตารางจริงตอนดับเบิลคลิกขอบคอลัมน์เพื่อวัดความกว้างเนื้อหาที่แท้จริง (auto-fit) และ
  // ตอนลากเพื่อเซ็ต custom property สดๆ ตรงบน DOM (ดูด้านบน)
  const tableRef = useRef(null);
  // ✅ ค่าคงที่ต่อคีย์คอลัมน์ (ไม่อิงตัวเลขความกว้างปัจจุบันเลย) ให้ sx ที่ใช้ var() นี้เหมือนเดิมทุก
  // re-render ไม่ว่าความกว้างจริงจะเปลี่ยนไปแค่ไหน — กัน emotion สร้าง class ใหม่ทุกครั้งที่ resize
  // (ค่าความกว้างจริงมาจาก custom property ที่ตั้งไว้ที่ <Table> ล้วนๆ เลขที่ใส่ไว้ตรงนี้เป็นแค่ fallback
  // เผื่อกรณีขอบเขต ไม่ได้ถูกใช้จริงตามปกติ)
  const colVar = (key) => `var(--col-${key}, ${DEFAULT_COL_WIDTHS[key] ?? VISIT_COL_DEFAULT_WIDTH}px)`;

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
    // ⚠️ BUG ที่แก้: เดิมแนะนำงานที่ถูกยืนยันเป็น "งานทั่วไป" แล้วด้วย (isConfirmedGeneral=true) ทั้งที่
    // แอดมินตัดสินใจไปแล้วว่าไม่ใช่สัญญา ไม่ควรมีระบบมาแนะนำย้อนแย้งซ้ำอีก — ตัดออก เหลือแนะนำเฉพาะงาน
    // ที่ยังไม่มีใครตัดสินใจอะไรเลย ("ยังไม่จัดกลุ่ม")
    const legacy = contracts.filter((c) => !c.isRealContract && !c.isConfirmedGeneral && !c.isConfirmedProject && (c.title || "").trim() === "PM");
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
  // ✅ กรองตามประเภทงาน (เช่น PM/Service/ติดตั้ง ฯลฯ) — เพิ่มตามที่ผู้ใช้ขอ เทียบ pattern เดียวกับ
  // ตัวกรองปี/ผู้รับผิดชอบด้านบนทุกประการ (เลือกจากรายชื่อประเภทงานจริงในระบบ ไม่ต้องพิมพ์เอง)
  const [titleFilter, setTitleFilter] = useState("all");

  const [selectedIds, setSelectedIds] = useState(new Set());
  const selectedContracts = useMemo(() => contracts.filter((c) => selectedIds.has(c.key)), [contracts, selectedIds]);
  // ⚠️ BUG ที่แก้ (จัดกลุ่มงานเก่ายากมากเพราะตั้งชื่อไม่ตรงกัน): เดิมล็อกไว้ว่าต้องเลือกงานที่
  // company/site/system/title ตรงกับตัวแรกที่เลือก "เป๊ะๆ" เท่านั้น (checkbox ของงานอื่นโดน disabled ไป
  // เลย) ตั้งใจกันรวมงานคนละเรื่องเข้าเป็น "สัญญา" เดียวกันโดยไม่ตั้งใจ — แต่งานเก่าในระบบจำนวนมากที่
  // "ควรเป็นสัญญาเดียวกันจริงๆ" กลับพิมพ์ชื่อบริษัท/โครงการ/ประเภทงานไม่ตรงกันเป๊ะ (สะกดต่างกันเล็กน้อย/
  // เว้นวรรคไม่เท่ากัน ฯลฯ) ทำให้ล็อกนี้กลายเป็นตัวบล็อกการจัดกลุ่มจริงเสียเอง ทั้งที่สุดท้ายผู้ใช้ต้อง
  // กรอกข้อมูลบริษัท/โครงการ/ประเภทงาน/ระบบที่จะใช้ร่วมกันทั้งกลุ่มในฟอร์ม "จัดกลุ่มเป็นสัญญา" อยู่แล้ว
  // (ดู mergeForm/handleMergeSubmit ด้านล่าง ซึ่งเซ็ตค่าเดียวกันทับทุกงานที่เลือกอยู่แล้ว) — เลิกบล็อกแล้ว
  // เปลี่ยนเป็นแค่เตือนแทน (ดู hasMixedSelection ที่ใช้แสดงคำเตือนใต้แถบ "เลือกไว้ N งาน") ให้เลือกงานที่
  // รู้อยู่แล้วว่าเป็นสัญญาเดียวกันจริงได้อิสระ โดยไม่ต้องไล่แก้ชื่อให้ตรงกันทีละงานก่อน
  const firstSelectedSignature = selectedContracts.length > 0 ? jobSignature(selectedContracts[0]) : null;
  const hasMixedSelection = selectedContracts.length > 1 && selectedContracts.some((c) => jobSignature(c) !== firstSelectedSignature);

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
    // ✅ กรองตามทีมที่เข้างานแบบเจาะจง (เลือกจากรายชื่อจริง) แยกจากช่องค้นหาข้อความอิสระด้านบน —
    // c.team อาจเป็นชื่อหลายคนต่อกันด้วย ", " (ทีมงาน/ลูกทีมเพิ่มเติม) ใช้ includes เทียบเป็นสตริงย่อยพอ
    if (teamFilter !== "all") {
      base = base.filter((c) => (c.team || "").includes(teamFilter));
    }
    if (titleFilter !== "all") {
      base = base.filter((c) => (c.title || "") === titleFilter);
    }
    const kw = search.trim().toLowerCase();
    if (!kw) return base;
    // ✅ ค้นหา "ผู้รับผิดชอบ" ด้วย ไม่ใช่แค่ team — คนละฟิลด์กันแล้วตั้งแต่แยกเป็นอิสระ (ดู
    // groupEventsByContract ใน utils/contractOverdue.js)
    return base.filter((c) =>
      [c.company, c.site, c.system, c.title, c.contractNo, c.quotationNo, c.team, c.responsiblePerson]
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
    [contracts, yearFilter, teamFilter, titleFilter, search]
  );
  const hiddenJobCount = useMemo(
    () => applyCommonFilters(contracts.filter((c) => !c.isRealContract && !c.isConfirmedGeneral && !c.isConfirmedProject)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contracts, yearFilter, teamFilter, titleFilter, search]
  );
  const confirmedGeneralCount = useMemo(
    () => applyCommonFilters(contracts.filter((c) => !c.isRealContract && c.isConfirmedGeneral)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contracts, yearFilter, teamFilter, titleFilter, search]
  );
  const confirmedProjectCount = useMemo(
    () => applyCommonFilters(contracts.filter((c) => !c.isRealContract && c.isConfirmedProject)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contracts, yearFilter, teamFilter, titleFilter, search]
  );
  const allFilteredCount = useMemo(
    () => applyCommonFilters(contracts).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contracts, yearFilter, teamFilter, titleFilter, search]
  );
  // ✅ สัญญาที่ "เลยกำหนดเข้ารอบถัดไป/คงค้าง" — รอบล่าสุดผ่านมาเกินระยะห่างที่กำหนด (intervalMonths)
  // แล้วแต่ยังไม่มีวันที่/แผนงานล่วงหน้าของรอบถัดไปเลย (ดู nextVisitOverdueInfo) เดิมมีแค่ badge เตือน
  // ทีละแถวในตาราง ไม่มีทางกรองดูเฉพาะกลุ่มนี้รวดเดียวเลย — เพิ่มเป็นแท็บมุมมองแยกต่างหาก
  const overdueCount = useMemo(
    () => applyCommonFilters(contracts.filter((c) => c.isRealContract && nextVisitOverdueInfo(c))).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contracts, yearFilter, teamFilter, titleFilter, search]
  );

  const filtered = useMemo(() => {
    const base = viewFilter === "all" ? contracts
      : viewFilter === "overdue" ? contracts.filter((c) => c.isRealContract && nextVisitOverdueInfo(c))
      : viewFilter === "ungrouped" ? contracts.filter((c) => !c.isRealContract && !c.isConfirmedGeneral && !c.isConfirmedProject)
      : viewFilter === "general" ? contracts.filter((c) => !c.isRealContract && c.isConfirmedGeneral)
      : viewFilter === "project" ? contracts.filter((c) => !c.isRealContract && c.isConfirmedProject)
      : contracts.filter((c) => c.isRealContract);
    return applyCommonFilters(base);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contracts, search, viewFilter, yearFilter, teamFilter, titleFilter]);

  // ✅ นับจาก `filtered` (ไม่ใช่ `contracts` ทั้งก้อนแบบเดิม) — เดิมถ้ามีสัญญาไหนสักอันในระบบที่มี
  // จำนวนครั้งเยอะ (เช่น 24) ตารางจะโชว์คอลัมน์ "ครั้งที่ 1-24" ตลอด แม้กรองปี/ค้นหาจนเหลือแต่สัญญา
  // 2-4 ครั้งอยู่ก็ตาม กว้างเกินจำเป็นและไม่ตรงกับสิ่งที่กรองไว้จริง
  // ✅ แถวที่ไม่ใช่สัญญาจริง (งานทั่วไป/ยังไม่จัดกลุ่ม) ไม่มี visitCount ให้ใช้ (ดู groupEventsByContract)
  // แต่ยังต้องดึง "ครั้งที่" จริงที่บันทึกไว้ในแต่ละ document (field time) มานับด้วย ไม่งั้นงานที่เคย
  // เลือก "ครั้งที่ 2" ไว้ตอนเพิ่มงานจะไม่มีคอลัมน์ให้แสดงเลย (ตารางมีแค่คอลัมน์เท่าที่สัญญาอื่นต้องการ)
  const rowMaxRound = (c) => c.isRealContract
    ? (c.visitCount || countUsedRounds(c.visits))
    : Math.max(1, ...c.visits.map((v) => Number(v.time) || 1));
  const maxVisitCount = useMemo(
    // ✅ Math.min กับ MAX_VISIT_COUNT ไว้อีกชั้น — แม้ทุกจุดตั้งค่าจะเช็ค ≤12 แล้ว เผื่อมีข้อมูลเก่า/
    // นำเข้าจากที่อื่นที่หลุดรอดเกินมา ตารางจะไม่มีทางเรนเดอร์คอลัมน์เกิน MAX_VISIT_COUNT ได้เด็ดขาด
    () => Math.min(MAX_VISIT_COUNT, filtered.reduce((max, c) => Math.max(max, rowMaxRound(c)), 1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered]
  );
  const visitColumns = useMemo(
    () => Array.from({ length: maxVisitCount }, (_, i) => i + 1),
    [maxVisitCount]
  );
  const totalTableWidth = useMemo(() => {
    let total = colWidth("actions") + (showCheckboxes ? colWidth("checkbox") : 0);
    const contractOnlyKeys = ["contractNo", "quotationNo", "contractStart", "contractEnd", "intervalMonths", "visitCount", "jobValue", "status"];
    ["company", "site", "system", "title", "progress", "team", "responsiblePerson"].forEach((k) => { total += colWidth(k); });
    if (!hideContractOnlyColumns) {
      contractOnlyKeys.forEach((k) => { total += colWidth(k); });
    } else {
      // ✅ คอลัมน์ "เอกสารเลขที่" (docNo) โผล่แทนที่กลุ่มเลขที่สัญญา/ใบเสนอราคาตอนซ่อนคอลัมน์ระดับ
      // สัญญา (ดูหัวตาราง) — งานทั่วไป/โปรเจคไม่มีเลขที่สัญญา แต่มีเลขที่เอกสารอ้างอิงทั่วไปแทนได้
      total += colWidth("docNo");
    }
    visitColumns.forEach((n) => { total += colWidth(`visit_${n}`); });
    return total;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colWidths, showCheckboxes, visitColumns, hideContractOnlyColumns]);
  // ✅ ค่าความกว้างจริงของทุกคอลัมน์ ตั้งเป็น CSS custom property ไว้ที่ <Table> ตัวเดียว (ผ่าน style
  // prop ปกติของ React) ให้ทุกเซลล์ลูกอ้างอิงผ่าน var(--col-<key>) — เห็นผลทันทีทุกครั้งที่ colWidths
  // เปลี่ยนจริง (โหลดจาก localStorage ตอนเปิดหน้า/auto-fit/commit ท้ายการลาก) โดยไม่ต้องแตะ sx ของเซลล์
  // แต่ละใบเลยสักคอลัมน์ — ดู handleColResize/colVar ด้านบนสำหรับเหตุผลที่ย้ายมาใช้กลไกนี้แทนตัวเลขตรงๆ
  const tableCssVars = useMemo(() => {
    const vars = { "--col-total": `${totalTableWidth}px` };
    ["contractNo", "quotationNo", "docNo", "company", "site", "system", "title", "contractStart", "contractEnd", "intervalMonths", "visitCount", "jobValue", "status", "progress", "team", "responsiblePerson"].forEach((k) => {
      vars[`--col-${k}`] = `${colWidth(k)}px`;
    });
    visitColumns.forEach((n) => { vars[`--col-visit_${n}`] = `${colWidth(`visit_${n}`)}px`; });
    return vars;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colWidths, totalTableWidth, visitColumns]);

  // ✅ เรียงลำดับตารางได้ด้วยการคลิกหัวตารางแต่ละช่อง (เฉพาะคอลัมน์ข้อมูลตรงๆ ที่เทียบค่าเดียวได้ —
  // ไม่รวม "สถานะสัญญา"/"คืบหน้า"/"ครั้งที่ N" ซึ่งเป็นค่าที่คำนวณจากหลายฟิลด์ ไม่มีค่าเดี่ยวให้เรียง)
  // คลิกครั้งแรก = น้อยไปมาก (asc) คลิกซ้ำคอลัมน์เดิม = มากไปน้อย (desc) คลิกอีกทีเลิกเรียง กลับไป
  // เรียงตามลำดับเดิม (ชื่อบริษัท/โครงการ จาก `contracts`) — ดู ResizableTh ที่ห่อ TableSortLabel ไว้
  // ✅ ค่าเริ่มต้นเรียงตาม "เลขที่สัญญา" น้อยไปมากอัตโนมัติเลย (FAPTY01, FAPTY02, ...) แทนที่จะปล่อย
  // ไม่เรียงอะไรเลยแบบเดิม — เลขรันตามลำดับความยาวหลักเท่ากัน (padStart เดียวกับตอนแนะนำเลขถัดไป)
  // ทำให้ localeCompare ธรรมดาก็เรียงถูกลำดับเป๊ะอยู่แล้วโดยไม่ต้องแยกฟังก์ชันแกะตัวเลขเอง
  const [sortConfig, setSortConfig] = useState({ key: "contractNo", direction: "asc" });
  const handleSortClick = (key) => {
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return { key: null, direction: "asc" };
    });
  };
  const SORT_VALUE_GETTERS = {
    contractNo: (c) => c.contractNo || "",
    quotationNo: (c) => c.quotationNo || "",
    docNo: (c) => c.docNo || "",
    company: (c) => c.company || "",
    site: (c) => c.site || "",
    system: (c) => c.system || "",
    title: (c) => c.title || "",
    contractStart: (c) => (c.contractStart ? new Date(c.contractStart).getTime() : null),
    contractEnd: (c) => (c.contractEnd ? new Date(c.contractEnd).getTime() : null),
    intervalMonths: (c) => (c.intervalMonths != null && c.intervalMonths !== "" ? Number(c.intervalMonths) : null),
    visitCount: (c) => (c.visitCount != null && c.visitCount !== "" ? Number(c.visitCount) : null),
    jobValue: (c) => (c.jobValue != null && c.jobValue !== "" ? Number(c.jobValue) : null),
    team: (c) => (c.team === "-" ? "" : c.team || ""),
    responsiblePerson: (c) => c.responsiblePerson || "",
  };
  const sortedFiltered = useMemo(() => {
    const getValue = sortConfig.key && SORT_VALUE_GETTERS[sortConfig.key];
    if (!getValue) return filtered;
    const dir = sortConfig.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      // ✅ แถวที่ไม่มีข้อมูลในคอลัมน์นี้ ("-"/ว่าง) ให้ตกไปอยู่ท้ายสุดเสมอไม่ว่าจะเรียงทิศทางไหน
      // กันแถวว่างกระโดดขึ้นไปปนบนสุดตอนเรียง "มากไปน้อย" ซึ่งดูสับสน
      const aEmpty = va === null || va === "";
      const bEmpty = vb === null || vb === "";
      if (aEmpty && bEmpty) return 0;
      if (aEmpty) return 1;
      if (bEmpty) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb), "th") * dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortConfig]);

  // ✅ แสดงแค่หน้าละ 10 แถว — เดิมโชว์ทุกแถวรวดเดียว (สูงสุดเป็นร้อย) ต้องเลื่อนในกรอบตารางยาวๆ
  // ตลอดเวลา ตัดเป็นหน้าให้สั้นกระชับแทน (ตัวกรอง/ค้นหายังใช้กับข้อมูลทั้งหมดเหมือนเดิม แค่ตัดแสดงผล)
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search, viewFilter, yearFilter, teamFilter, titleFilter, sortConfig]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedRows = useMemo(
    () => sortedFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [sortedFiltered, page]
  );

  const csvData = useMemo(
    () => filtered.map((c) => {
      const st = contractStatusInfo(c);
      const row = {
        เลขที่สัญญา: c.contractNo || "",
        ใบเสนอราคา: c.quotationNo || "",
        เอกสารเลขที่: c.docNo || "",
        บริษัท: c.company || "",
        โครงการ: c.site || "",
        ระบบ: c.system || "",
        ประเภทงาน: c.title || "",
        วันที่เริ่มสัญญา: c.contractStart ? moment(c.contractStart).format("YYYY-MM-DD") : "",
        วันที่สิ้นสุดสัญญา: c.contractEnd ? moment(c.contractEnd).format("YYYY-MM-DD") : "",
        "รอบเข้า (เดือน)": c.intervalMonths || "",
        "เข้าปีละ (ครั้ง)": visitsPerYear(c.intervalMonths) || "",
        จำนวนครั้ง: c.visitCount || "",
        "มูลค่างาน/1ปี": c.jobValue ?? "",
        สถานะสัญญา: st?.label || "",
      };
      // ✅ นับเฉพาะครั้งที่ลงตารางจริงเหมือนตารางในหน้านี้ (เดิม CSV รวมแผนงานล่วงหน้าที่ยังไม่มีวันที่
      // จริงเข้าไปด้วย ทำให้ export ไม่ตรงกับสิ่งที่ตารางแสดงจริง)
      // ⚠️ BUG ที่แก้: เดิมใช้ .find() (เจอแค่ 1 document) และเทียบ Number(v.time)===n ตรงๆ ไม่มี
      // fallback เหมือนตาราง — งานทั่วไปที่ time ว่าง หรือครั้งที่เข้างานไม่ต่อเนื่อง (หลาย document
      // ต่อครั้ง) จะ export ออกมาไม่ตรงกับที่ตารางแสดงจริง (ตกหล่น/ว่างเปล่าทั้งที่ตารางมีข้อมูล)
      visitColumns.forEach((n) => {
        const visits = c.visits.filter((v) => !v.unscheduled && (Number(v.time) || 1) === n);
        const pendingDraft = visits.length === 0 && c.visits.find((v) => v.unscheduled && (Number(v.time) || 1) === n);
        row[`ครั้งที่${n}`] = visits.length > 0
          ? visits.map((v) => formatEventDateRange(v)).join(", ")
          : pendingDraft ? "รอวางแผน" : "";
      });
      row["ทีมที่เข้างาน"] = c.team;
      row["หัวหน้าทีมเข้างาน"] = c.teamLeaderName || "";
      row["ลูกทีม"] = (c.teamMemberNames || []).join(", ");
      row["ผู้รับผิดชอบ"] = c.responsiblePerson || "";
      return row;
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, visitColumns]
  );

  // ── ฟอร์ม "เพิ่มสัญญาใหม่" ─────────────────────────────────────────────
  // ✅ เดิมต้องออกจากหน้านี้ไปเปิดปฏิทินแล้วคลิกวันที่เพื่อสร้างงานแบบ "สัญญาแบบหลายครั้ง" เท่านั้น
  // (ดู AddEvent.js) — เพิ่มฟอร์มแบบเดียวกันไว้ในหน้านี้เลย ให้เพิ่มสัญญาใหม่ได้โดยไม่ต้องสลับหน้า
  const emptyForm = {
    company: "", site: "", title: "", system: "", team: "",
    contractNo: "", quotationNo: "", contractStart: "", contractEnd: "", visitCount: "", intervalMonths: "", jobValue: "",
  };
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(emptyForm);

  const setField = (field) => (val) => setForm((f) => ({ ...f, [field]: val }));

  // ✅ แค่ข้อมูลอ้างอิงเฉยๆ ไม่ผูก/บังคับกับจำนวนครั้งจริง (visitCount ยังต้องกรอกเองอิสระเสมอ เพราะ
  // งานจริงเลื่อน/ชนกันได้ตลอด) ใช้แค่เป็นเกณฑ์เตือน "เกินกำหนดรอบถัดไป" เท่านั้น
  const intervalPreviewText = "ไม่บังคับ — ใช้เตือนเมื่อเกินกำหนดรอบถัดไปเท่านั้น ไม่เกี่ยวกับจำนวนครั้งด้านบน";

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
    // ✅ ห้ามใส่เกิน 12 — สัญญาที่มีจำนวนครั้งเยอะเกินไปจะทำให้ตาราง "ภาพรวมงาน" ต้องเรนเดอร์คอลัมน์
    // "ครั้งที่ N" เกินจำเป็น (maxVisitCount คำนวณจากค่าสูงสุดของทุกแถวที่กรองอยู่ในตาราง — ตั้งค่านี้
    // สูงเกินไปแค่สัญญาเดียวก็ทำให้ตารางทั้งหน้ากว้างจนพังได้) เช็คซ้ำฝั่ง backend อีกชั้นด้วย (POST /draft)
    if (visitCount > MAX_VISIT_COUNT) { setFormError(`จำนวนครั้งทั้งหมดต้องไม่เกิน ${MAX_VISIT_COUNT} ครั้ง`); return; }
    // ✅ ไม่บังคับ — เว้นว่างได้ ไม่กระทบจำนวนครั้งด้านบน แค่ใช้เตือน "เกินกำหนดรอบถัดไป" ถ้าระบุมา
    if (form.intervalMonths) {
      const n = Number(form.intervalMonths);
      if (!n || n < 1 || n > 24) {
        setFormError("ระยะห่างระหว่างรอบต้องอยู่ระหว่าง 1-24 เดือน");
        return;
      }
    }
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
        intervalMonths: form.intervalMonths ? Number(form.intervalMonths) : undefined,
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
      await fetchData(true);
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
          intervalMonths: c.intervalMonths,
          jobValue: c.jobValue,
          dates: [{ start: newVisitStart, end: endDate, date: newVisitStart }],
        };
        await EventService.AddEvent(payload);
        setAddVisitSaving(false);
        setAddVisitTarget(null);
        Swal.fire({ title: `เพิ่มวันที่ต่อเนื่องให้ครั้งที่ ${extendRound} สำเร็จ ✅`, icon: "success", timer: 1200, showConfirmButton: false });
        await fetchData(true);
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
          intervalMonths: c.intervalMonths,
          jobValue: c.jobValue,
          dates: [{ start: newVisitStart, end: endDate, date: newVisitStart }],
        };
        await EventService.AddEvent(payload);
      }

      setAddVisitSaving(false);
      setAddVisitTarget(null);
      Swal.fire({ title: `เพิ่มครั้งที่ ${nextIndex} สำเร็จ ✅`, icon: "success", timer: 1200, showConfirmButton: false });
      await fetchData(true);
    } catch (err) {
      setAddVisitSaving(false);
      setAddVisitError(err?.response?.data?.message || "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
  };

  // ── จัดกลุ่มงานเก่าที่เลือกไว้ ให้กลายเป็นสัญญาเดียวกัน ──────────────────────
  const emptyMergeForm = { contractNo: "", quotationNo: "", contractStart: "", contractEnd: "", visitCount: "", intervalMonths: "", jobValue: "" };
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
    // ✅ ห้ามใส่จำนวนครั้งทั้งหมดเกิน 12 — เทียบ pattern เดียวกับฟอร์ม "เพิ่มสัญญาใหม่" (handleAddSubmit)
    if (mergeForm.visitCount && Number(mergeForm.visitCount) > MAX_VISIT_COUNT) {
      setMergeError(`จำนวนครั้งทั้งหมดต้องไม่เกิน ${MAX_VISIT_COUNT} ครั้ง`);
      return;
    }
    // ✅ ยืนยันอีกชั้นเฉพาะตอนงานที่เลือกชื่อไม่ตรงกัน (hasMixedSelection) — เดิมปลดล็อกให้เลือกงานชื่อ
    // ไม่ตรงกันมารวมเป็นสัญญาเดียวกันได้แล้ว (กันจัดกลุ่มงานเก่ายากเกินไป ดู firstSelectedSignature/
    // hasMixedSelection ด้านบน) แต่พอไม่มีอะไรกันเลยก็เผลอกดพลาดรวมงานคนละเรื่องกันจริงๆ เข้าด้วยกันได้
    // ง่ายขึ้นเหมือนกัน (เดิมระบบกันไว้ให้อัตโนมัติ) เพิ่มยืนยันชัดๆ อีกทีเฉพาะกรณีนี้กันพลาด
    if (hasMixedSelection) {
      const confirmResult = await Swal.fire({
        icon: "warning",
        title: "ชื่อของงานที่เลือกไม่ตรงกันทั้งหมด",
        html: `
          <div style="text-align:left;font-size:13px;">
            มี ${selectedContracts.length} งานที่เลือกไว้ ซึ่งชื่อบริษัท/โครงการ/ประเภทงาน/ระบบไม่ตรงกันทั้งหมด<br/>
            ยืนยันว่าทั้งหมดนี้เป็น <b>สัญญาเดียวกันจริง</b> ใช่หรือไม่?
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: "ใช่ เป็นสัญญาเดียวกันจริง",
        confirmButtonColor: "#dc2626",
        cancelButtonText: "ยกเลิก",
      });
      if (!confirmResult.isConfirmed) return;
    }
    setMergeSaving(true);
    try {
      // ⚠️ BUG ที่แก้: เดิมส่ง event id ตัวแรกของแต่ละแถวเท่านั้น (สมมติว่า 1 แถว = 1 event เดียวเสมอ)
      // แต่ตอนนี้ "งานทั่วไป" ที่เข้าหลายวันไม่ติดกัน (jobGroupId เดียวกัน) รวมเป็น 1 แถวที่มีหลาย
      // document แล้ว (ดู groupEventsByContract) — ถ้าส่งแค่ document แรก วันอื่นๆ ของงานเดียวกันจะ
      // ไม่ถูกย้ายเข้าสัญญาใหม่ไปด้วย กลายเป็นข้อมูลค้างคาแยกกันคนละที่ ต้องส่งเป็น "กลุ่มของ id ต่อแถว"
      // (rounds) แทน ให้ backend รู้ว่า document ไหนควรอยู่ "ครั้งที่" เดียวกัน ไม่ใช่คนละครั้ง
      const rounds = selectedContracts.map((c) => c.visits.map((v) => v._id));
      await EventService.MergeIntoContract({
        rounds,
        contractNo: mergeForm.contractNo.trim(),
        quotationNo: mergeForm.quotationNo.trim(),
        contractStart: mergeForm.contractStart,
        contractEnd: mergeForm.contractEnd,
        intervalMonths: mergeForm.intervalMonths ? Number(mergeForm.intervalMonths) : undefined,
        visitCount: mergeForm.visitCount ? Number(mergeForm.visitCount) : rounds.length,
        jobValue: mergeForm.jobValue ? Number(mergeForm.jobValue) : undefined,
      });
      setMergeSaving(false);
      setMergeOpen(false);
      clearSelection();
      Swal.fire({ title: "จัดกลุ่มเป็นสัญญาสำเร็จ ✅", icon: "success", timer: 1200, showConfirmButton: false });
      await fetchData(true);
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

  // ✅ บริษัท/โครงการ/ระบบ/ประเภทงาน แก้ไขได้ทุกแถว (ทั้งสัญญาจริงและงานทั่วไป/โปรเจค/ยังไม่จัดกลุ่ม)
  // ต่างจากฟิลด์อื่น (เลขที่สัญญา/มูลค่างาน/ฯลฯ) ที่มีความหมายเฉพาะสัญญาจริงเท่านั้น — ดู BASIC_INFO_FIELDS
  const BASIC_INFO_FIELDS = new Set(["company", "site", "system", "title"]);

  // ✅ กติกากลางว่าฟิลด์ไหนแก้ไขได้กับแถวประเภทไหนบ้าง — ใช้ร่วมกันทั้ง editable prop ของ EditableCell
  // (คุมว่าคลิกแก้ไขได้ไหม) และ beginEdit ด้านล่าง กันสองจุดเช็คไม่ตรงกัน:
  // - company/site/system/title: แก้ได้ทุกแถวเสมอ (ระบุตัวงาน ไม่ผูกกับการจัดหมวดหมู่)
  // - team/docNo/responsiblePerson: แก้ได้เฉพาะแถวที่ "ตัดสินใจแล้ว" ว่าเป็นสัญญาจริง/งานทั่วไป/
  //   งานโปรเจค — ไม่ใช่แถว "ยังไม่จัดกลุ่ม" ซึ่งควรไปจัดหมวดหมู่ก่อน ค่อยมอบหมายคน/ผู้รับผิดชอบทีหลัง
  // - ฟิลด์ที่เหลือ (เลขที่สัญญา/ใบเสนอราคา/ระยะเวลา/จำนวนครั้ง/มูลค่างาน): เฉพาะสัญญาจริงเท่านั้น
  const isClassifiedRow = (c) => c.isRealContract || c.isConfirmedGeneral || c.isConfirmedProject;
  const canEditField = (c, field) => {
    if (BASIC_INFO_FIELDS.has(field)) return true;
    if (field === "team" || field === "docNo" || field === "responsiblePerson") return isClassifiedRow(c);
    return c.isRealContract;
  };

  const editOriginalValue = (c, field) => {
    if (field === "contractStart" || field === "contractEnd") return c[field] ? moment(c[field]).format("YYYY-MM-DD") : "";
    // ⚠️ BUG ที่แก้: เดิมใช้ c.team (string รวมหัวหน้า+ลูกทีมด้วย ", ") เป็นค่าเริ่มต้น — ถ้ามีลูกทีมด้วย
    // ค่านี้จะไม่ตรงกับตัวเลือกไหนใน dropdown เลย (teamOptions มีแค่ชื่อเดี่ยวๆ) ทำให้กล่องเลือกว่างเปล่า
    // ตอนเปิดแก้ไข ทั้งที่จริงมีหัวหน้าทีมอยู่แล้ว — ใช้ teamLeaderName (ชื่อหัวหน้าทีมเดี่ยวๆ) แทน
    if (field === "team") return c.teamLeaderName || "";
    return c[field] ?? "";
  };

  const beginEdit = (c, field) => {
    if (editSaving) return;
    if (!canEditField(c, field)) return;
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
    // ✅ บริษัท/โครงการ/ระบบ/ประเภทงาน เป็นข้อมูลระบุตัวงาน (ใช้ค้นหา/กรอง/จัดกลุ่มทั่วทั้งแอป) ห้ามลบ
    // จนว่างเปล่า ไม่งั้นงานนี้จะหาไม่เจอที่ไหนเลยหลังบันทึก
    if (BASIC_INFO_FIELDS.has(field) && !rawValue.trim()) {
      Swal.fire({ title: "แก้ไขไม่สำเร็จ", text: "ห้ามเว้นว่าง กรุณากรอกข้อมูล", icon: "error" });
      setEditingCell(null);
      return;
    }
    // ✅ ตรวจฝั่งจอก่อนยิง API (ข้อความเดียวกับที่ backend เช็คซ้ำอีกชั้น) ให้ผู้ใช้เห็นผลทันทีไม่ต้องรอ
    // round-trip — ระยะห่างระหว่างรอบเป็นข้อมูลอ้างอิงอิสระ ไม่เกี่ยวกับจำนวนครั้งจริง (visitCount)
    if (field === "intervalMonths" && rawValue) {
      const n = Number(rawValue);
      if (!n || n < 1 || n > 24) {
        Swal.fire({ title: "แก้ไขไม่สำเร็จ", text: "ระยะห่างระหว่างรอบต้องอยู่ระหว่าง 1-24 เดือน", icon: "error" });
        setEditingCell(null);
        return;
      }
    }
    // ✅ ห้ามใส่จำนวนครั้งทั้งหมดเกิน 12 — เทียบ pattern เดียวกับ intervalMonths ด้านบน กันตาราง
    // เรนเดอร์คอลัมน์ "ครั้งที่ N" เกินจำเป็นจนหน้าพัง (ดู maxVisitCount ด้านล่าง)
    if (field === "visitCount" && rawValue) {
      const n = Number(rawValue);
      if (!n || n < 1 || n > MAX_VISIT_COUNT) {
        Swal.fire({ title: "แก้ไขไม่สำเร็จ", text: `จำนวนครั้งทั้งหมดต้องอยู่ระหว่าง 1-${MAX_VISIT_COUNT} ครั้ง`, icon: "error" });
        setEditingCell(null);
        return;
      }
    }

    const payload = {};
    if (field === "jobValue" || field === "visitCount" || field === "intervalMonths") payload[field] = rawValue ? Number(rawValue) : undefined;
    else if (field === "team") { payload.team = rawValue; payload.resPerson = teamToId.get(rawValue) || ""; }
    else if (field === "responsiblePerson") { payload.responsiblePerson = rawValue; payload.responsiblePersonId = teamToId.get(rawValue) || ""; }
    else payload[field] = rawValue;

    // ⚠️ BUG ที่แก้: เดิม await fetchData() หลังบันทึกทุกครั้ง — ตั้ง loading=true ทำให้ทั้งตารางเปลี่ยน
    // เป็น <Skeleton> วาบให้เห็น แล้วค่อยเรนเดอร์ใหม่ทั้งหมด (เสียตำแหน่ง scroll/แถวที่กำลังดูอยู่) ทั้งที่
    // จริงๆ รู้ผลลัพธ์อยู่แล้วจากค่าที่พิมพ์เอง — อัปเดตค่าใน state ทันทีแบบ optimistic แทน (เหมือน
    // Excel/Notion กดแล้วเห็นผลทันที) เก็บ snapshot เดิมไว้เผื่อ backend ปฏิเสธ (เช่นแก้พร้อมกันจาก
    // อีกที่แล้วชนกัน) ค่อย revert คืนเฉพาะตอนนั้น ไม่ต้องรีเฟรชทั้งตารางในเคสบันทึกสำเร็จปกติเลย
    // ⚠️ BUG ที่แก้: เดิม match ด้วย e.contractGroupId === c.key เท่านั้น ใช้ไม่ได้กับแถวที่ไม่ใช่สัญญาจริง
    // (c.key เป็น "jgid:.../nogid:..." ไม่ตรงกับ contractGroupId ของ document ไหนเลย) — match ด้วย _id
    // ที่อยู่ใน c.visits โดยตรงแทน ใช้ได้ทั้งสัญญาจริงและงานทั่วไป/โปรเจค/ยังไม่จัดกลุ่มเหมือนกันหมด
    const snapshot = events;
    const visitIdSet = new Set(c.visits.map((v) => String(v._id)));
    setEvents((prev) => prev.map((e) => (visitIdSet.has(String(e._id)) ? { ...e, ...payload } : e)));
    setEditingCell(null);
    setEditSaving(true);
    try {
      // ✅ บริษัท/โครงการ/ระบบ/ประเภทงาน อัปเดตผ่าน eventIds ตรงๆ (ใช้ได้ทุกแถว) ส่วนฟิลด์อื่นที่มี
      // ความหมายเฉพาะสัญญาจริงยังผ่าน contractGroupId เหมือนเดิม (ฟิลด์เหล่านี้แก้ได้แค่แถวสัญญาจริงอยู่แล้ว)
      // ✅ docNo: เอกสารอ้างอิงต่อ "งาน" ไม่ใช่ต่อ "สัญญา" (งานทั่วไป/โปรเจคมีแค่ document เดียวต่อแถวอยู่
      // แล้ว ไม่มีแนวคิด "ทุกครั้งในสัญญาเดียวกัน" ให้ผูกร่วม) จึงผ่าน eventIds ตรงๆ เหมือน BASIC_INFO_FIELDS
      // ✅ team/responsiblePerson: ถ้าเป็นสัญญาจริงยังผูกทุกครั้งพร้อมกันผ่าน contractGroupId เหมือนเดิม
      // (มอบหมาย/กำหนดผู้รับผิดชอบทั้งสัญญา) แต่ถ้าเป็นงานทั่วไป/โปรเจค (ไม่มี contractGroupId จริง —
      // c.key เป็นแค่ "jgid:.../nogid:..." ใช้กับ UpdateContractFields ไม่ได้) ต้องผ่าน eventIds ตรงๆ แทน
      const useBasicInfoEndpoint =
        BASIC_INFO_FIELDS.has(field) ||
        field === "docNo" ||
        ((field === "team" || field === "responsiblePerson") && !c.isRealContract);
      if (useBasicInfoEndpoint) {
        await EventService.UpdateBasicInfo(c.visits.map((v) => v._id), payload);
      } else {
        await EventService.UpdateContractFields(c.key, payload);
      }
    } catch (err) {
      setEvents(snapshot);
      Swal.fire({
        title: "แก้ไขไม่สำเร็จ",
        text: err?.response?.data?.message || err.message,
        icon: "error",
      });
    } finally {
      setEditSaving(false);
    }
  };

  // ── ลบสัญญา/งานทิ้ง ─────────────────────────────────────────────────────
  // ✅ สัญญาจริง (isRealContract) ลบทั้งก้อนทีเดียวผ่าน DELETE /contract/:contractGroupId (ทุกครั้งที่
  // ผูก contractGroupId เดียวกันหายไปพร้อมกัน) ส่วนแถวงานทั่วไป/ยังไม่จัดกลุ่ม (isRealContract=false)
  // อาจมีมากกว่า 1 document ต่อแถวได้แล้ว (งานเข้าหลายวันไม่ติดกัน ผูกด้วย jobGroupId — ดู
  // groupEventsByContract) ต้องลบทุก document ในกลุ่มพร้อมกัน ไม่ใช่แค่ document แรก ไม่งั้นวันอื่นๆ
  // ของงานเดียวกันจะค้างอยู่ในระบบทั้งที่ตั้งใจลบทั้งงาน — ทั้งคู่ยืนยันก่อนลบเสมอ เพราะลบแล้วกู้คืนไม่ได้
  // และเตือนเป็นพิเศษถ้ามีครั้งที่ "ดำเนินการเสร็จสิ้น" แล้วปนอยู่ (ประวัติงานจริงจะหายไปด้วย)
  const handleDeleteContract = async (c) => {
    const doneCount = c.visits.filter((v) => v.status === "ดำเนินการเสร็จสิ้น").length;
    const result = await Swal.fire({
      icon: "warning",
      title: c.isRealContract ? "ลบสัญญานี้ทั้งหมด?" : "ลบงานนี้?",
      html: `
        <div style="text-align:left;font-size:13px;">
          <b>${escapeHtml(c.company) || "-"} · ${escapeHtml(c.site) || "-"}</b><br/>
          ${escapeHtml(c.title)} · ${escapeHtml(c.system)}<br/>
          ${c.visits.length > 1 ? `จะลบทั้งหมด ${c.visits.length} วัน (งานเดียวกัน)` : "จะลบงานนี้ 1 รายการ"}
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
        await Promise.all(c.visits.map((v) => EventService.DeleteEvent(v._id)));
      }
      if (selectedIds.has(c.key)) toggleSelect(c);
      Swal.fire({ title: "ลบสำเร็จ ✅", icon: "success", timer: 1200, showConfirmButton: false });
      await fetchData(true);
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
  // ✅ เรียงตามเลขที่สัญญา (ตัวเลข/ตัวอักษรปนกันก็เรียงถูก เช่น FAPTY01, FAPTY02, ... FAPTY10 — ใช้
  // { numeric: true } ให้เทียบเลขที่ฝังอยู่ในสตริงตามค่าจริง ไม่ใช่เทียบทีละตัวอักษรแบบ "10" มาก่อน "2")
  // ให้รายการในช่องค้นหาด้านล่าง (Autocomplete) ไล่ดูง่ายเป็นระเบียบ แทนที่จะเรียงตามลำดับที่ดึงมาจาก DB
  const sortedAttachableContracts = useMemo(
    () => [...attachableContracts].sort((a, b) => (a.contractNo || "").localeCompare(b.contractNo || "", "th", { numeric: true })),
    [attachableContracts]
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
      // ✅ ส่งทุก document ในแถว (ไม่ใช่แค่ตัวแรก) ให้ backend ย้ายเข้าสัญญาพร้อมกันทั้งหมด — งานทั่วไป
      // ที่เข้าหลายวันไม่ติดกัน (ผูกด้วย jobGroupId) ต้องย้ายไปเป็น "ครั้งเดียวกัน" ในสัญญาใหม่ทุกวัน
      // ไม่ใช่แค่วันแรก ไม่งั้นวันอื่นจะค้างเป็นงานทั่วไปแยกจากสัญญาที่เพิ่งย้ายไป
      await EventService.AttachToContract(attachContractId, {
        eventIds: attachTarget.visits.map((v) => v._id),
        time: attachRound,
      });
      setAttachSaving(false);
      setAttachTarget(null);
      Swal.fire({ title: "ย้ายเข้าสัญญาสำเร็จ ✅", icon: "success", timer: 1200, showConfirmButton: false });
      await fetchData(true);
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
          <b>${escapeHtml(c.company) || "-"} · ${escapeHtml(c.site) || "-"}</b><br/>
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
      await fetchData(true);
    } catch (err) {
      Swal.fire({
        title: "แยกออกไม่สำเร็จ",
        text: err?.response?.data?.message || err.message,
        icon: "error",
      });
    }
  };

  // ✅ จัดหมวดหมู่งานที่ไม่มี contractGroupId — "" (ยังไม่จัดกลุ่ม) / "general" (งานทั่วไป) / "project"
  // (งานโปรเจค) ค่าเริ่มต้นคือ "ยังไม่จัดกลุ่ม" เสมอ (แท็บ "งานเก่าในระบบที่ยังไม่จัดกลุ่ม") จนกว่าจะ
  // เลือกจากเมนูนี้ — ใช้เมนูเดียว 3 ตัวเลือกแทนปุ่มยืนยัน/ยกเลิกแยกกัน กันปุ่มรกช่อง actions เกินไป
  // ตอนมี 3 หมวดหมู่ให้เลือก (เดิมมีแค่ 2 สถานะ ใช้ปุ่มเดียวสลับ true/false พอ)
  const [classifyMenuAnchor, setClassifyMenuAnchor] = useState(null);
  const [classifyMenuTarget, setClassifyMenuTarget] = useState(null);
  const openClassifyMenu = (e, c) => { setClassifyMenuAnchor(e.currentTarget); setClassifyMenuTarget(c); };
  const closeClassifyMenu = () => { setClassifyMenuAnchor(null); setClassifyMenuTarget(null); };

  // ✅ 1 แถวอาจมีหลาย document ได้แล้ว (งานเข้าหลายวันไม่ติดกัน ผูกด้วย jobGroupId) ต้องจัดหมวดหมู่
  // พร้อมกันทุกวันในงานเดียวกัน ไม่งั้นบางวันจะอยู่คนละหมวดกับอีกวัน ทั้งที่จริงเป็นงานเดียวกัน
  const handleClassify = async (classification) => {
    const c = classifyMenuTarget;
    closeClassifyMenu();
    if (!c) return;
    try {
      await Promise.all(c.visits.map((v) => EventService.ClassifyJob(v._id, classification)));
      await fetchData(true);
    } catch (err) {
      Swal.fire({
        title: "จัดหมวดหมู่ไม่สำเร็จ",
        text: err?.response?.data?.message || err.message,
        icon: "error",
      });
    }
  };

  // ✅ กันคนนอก (role อื่น) เปิดหน้านี้ตรงๆ ผ่าน URL — เทียบ pattern เดียวกับ QuotationTracking.js
  if (!loading && !canView) return <Navigate to="/dashboard" replace />;

  return (
    <Box sx={{ px: { xs: 1.5, sm: 2 }, pt: 2, pb: 4 }}>
      {/* ✅ เดิมบังคับแถวเดียว (direction="row") ตลอด — จอมือถือแคบกว่าปุ่ม "เพิ่มสัญญาใหม่" +
          ปุ่มรีเฟรช + ปุ่มส่งออกรวมกัน ทำให้ล้นขอบจอ/ปุ่มถูกตัด สลับเป็นซ้อนกันคนละแถวบนจอแคบแทน
          (ชื่อหน้า/จำนวนอยู่แถวบน ปุ่มต่างๆ อยู่แถวล่าง เต็มความกว้าง) */}
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "flex-start" }} justifyContent="space-between" gap={1.25} sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" gap={1.25}>
          {/* ✅ ไอคอนป้ายหัวข้อ — ให้หน้านี้มีจุดเด่นตั้งแต่แวบแรก เทียบ pattern การ์ดหัวข้อสีพื้นหลัง
              วงกลมที่ใช้ทั่วไปในแอป (Dashboard/Operation) แทนตัวหนังสือเปล่าๆ */}
          <Box sx={{
            width: 40, height: 40, borderRadius: 2.5, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            bgcolor: alpha(ACCENT, 0.1), color: ACCENT,
          }}>
            <Assignment sx={{ fontSize: 22 }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={800}>{isAdminOrManager ? "ภาพรวมงาน" : "ภาพรวมงานของฉัน"}</Typography>
            <Typography variant="caption" color="text.secondary">
              {loading ? "กำลังโหลด..." : `${filtered.length} ${viewFilter === "contracts" ? "สัญญา" : "งาน"}`}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" gap={1}>
          {isAdminOrManager && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={openAddDialog}
              sx={{ bgcolor: ACCENT, textTransform: "none", fontWeight: 700, borderRadius: 2.5, flex: { xs: 1, sm: "initial" }, "&:hover": { bgcolor: "#b91c1c" } }}
            >
              เพิ่มสัญญาใหม่
            </Button>
          )}
          <Tooltip title="รีเฟรช">
            <IconButton
              onClick={() => { fetchData(); fetchLookups(); }}
              sx={{
                border: "1px solid", borderColor: "divider", borderRadius: "50%", flexShrink: 0,
                transition: "background-color .15s, border-color .15s, color .15s, transform .15s",
                "&:hover": { bgcolor: alpha(ACCENT, 0.08), borderColor: alpha(ACCENT, 0.4), color: ACCENT },
                "&:active": { transform: "rotate(180deg)" },
              }}
            >
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

      {/* ✅ บอกให้ชัดว่าโหมดนี้ดูอย่างเดียวตั้งใจ ไม่ใช่ปุ่มหาย/หน้าพัง — เทียบข้อความเดียวกับกล่อง
          "ข้อมูลสัญญา" แบบดูอย่างเดียวใน EditEvent.js ให้โทน/คำพูดตรงกันทั้งแอป */}
      {!isAdminOrManager && (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
          มุมมองสำหรับดูงานของคุณ — แก้ไขข้อมูลได้ที่หน้า "แผนงาน" หรือ "การดำเนินงาน"
        </Alert>
      )}

      {/* ✅ สลับมุมมองด้วยแท็บแบบชิป (เทียบ pattern เดียวกับแท็บประเภทเอกสารในหน้า "ไฟล์") แทน switch
          เปิด/ปิดตัวเดียว — ค่าเริ่มต้นอยู่ที่ "สัญญา" กันตารางรกด้วยงานเก่าเป็นร้อยแถวเหมือนเดิม แต่สลับ
          ไปดูงานเก่าที่ยังไม่จัดกลุ่มได้ชัดเจนกว่าเดิม (ไม่ต้องเดาว่า switch ตัวนี้หมายถึงอะไร) */}
      {!loading && (
        <Box sx={{
          mb: 2, overflowX: "auto", pb: 0.5, WebkitOverflowScrolling: "touch",
          "&::-webkit-scrollbar": { height: 4 },
        }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "max-content" }}>
            {/* ✅ แยกเป็น ToggleButtonGroup ต่างหาก ครอบด้วยกรอบร่วม — "เลยกำหนด/คงค้าง" เป็นกลุ่มย่อยของ
                "งานสัญญา/งานรายปี" เสมอ (ตัวกรองข้างในคือ isRealContract ทั้งคู่ แค่ "เลยกำหนด" กรองซ้ำ
                เฉพาะที่เกินกำหนดรอบถัดไปด้วย ไม่ใช่หมวดคู่ขนานแบบทั่วไป/โปรเจค/ยังไม่จัดกลุ่ม) เดิมอยู่
                แถวเดียวกับแท็บอื่นหมดจนดูเหมือนเป็นหมวดแยกอิสระเท่ากัน สับสนว่าเลือกได้พร้อมกันหรือเปล่า
                ครอบกรอบให้เห็นชัดว่าเป็นคู่เดียวกัน (ใช้คนละ ToggleButtonGroup ได้ปกติ — แค่ผูก value/
                onChange ตัวเดียวกัน MUI ไม่บังคับว่าต้องอยู่กลุ่มเดียวกันถึงจะ exclusive ร่วมกันได้) */}
            <ToggleButtonGroup
              size="small" exclusive value={viewFilter}
              onChange={(_, v) => v && setViewFilter(v)}
              sx={{
                flexWrap: "nowrap",
                border: "1.5px solid", borderColor: alpha(ACCENT, 0.25), borderRadius: 2.5, p: "2px",
              }}
            >
              {/* ✅ ใส่ไอคอนหน้าแต่ละแท็บ — สแกนหาแท็บที่ต้องการได้เร็วขึ้นด้วยสายตา ไม่ต้องอ่านตัวหนังสือ
                  ทีละคำ ไอคอน/สีตรงกับที่ใช้ในเมนู "จัดหมวดหมู่งาน" ของแต่ละแถวเป๊ะๆ (เขียว=ทั่วไป,
                  น้ำเงิน=โปรเจค) ให้จำง่ายว่าไอคอนแบบไหนคือหมวดไหน */}
              <ToggleButton value="contracts" sx={VIEW_TAB_SX}>
                <Description sx={{ fontSize: 15, mr: 0.5 }} /> งานสัญญา / งานรายปี ({realContractCount})
              </ToggleButton>
              {/* ✅ เดิมซ่อนแท็บนี้ตอน overdueCount=0 กันรก แต่กลับทำให้ผู้ใช้เข้าใจว่าฟีเจอร์นี้หายไป/ไม่มี
                  (แท็บอื่นๆ ทั้งหมดแสดงตลอดไม่ว่าจะมีข้อมูลกี่รายการ) ตอนนี้แสดงตลอดเหมือนแท็บอื่นให้สม่ำเสมอ
                  กัน แค่โชว์ (0) เฉยๆ ตอนไม่มีอะไรเกินกำหนด — โทนแดง/ไอคอนเตือนยังคงไว้ให้เด่นกว่าแท็บอื่น */}
              <ToggleButton value="overdue" sx={VIEW_TAB_SX}>
                <WarningAmber sx={{ fontSize: 15, mr: 0.5, color: "#dc2626" }} /> เลยกำหนด / คงค้าง ({overdueCount})
              </ToggleButton>
            </ToggleButtonGroup>

            {/* ✅ กลุ่มหมวดหมู่คู่ขนานจริง — แยกจากกันเองชัดเจน (งานหนึ่งเป็นได้แค่หมวดเดียวในกลุ่มนี้)
                ต่างจากคู่ "งานสัญญา/เลยกำหนด" ด้านบนที่เป็นความสัมพันธ์แบบกลุ่มใหญ่-กลุ่มย่อย */}
            <ToggleButtonGroup
              size="small" exclusive value={viewFilter}
              onChange={(_, v) => v && setViewFilter(v)}
              sx={{ flexWrap: "nowrap" }}
            >
              <ToggleButton value="general" sx={VIEW_TAB_SX}>
                <Build sx={{ fontSize: 15, mr: 0.5, color: "#10b981" }} /> งานทั่วไป ({confirmedGeneralCount})
              </ToggleButton>
              <ToggleButton value="project" sx={VIEW_TAB_SX}>
                <Engineering sx={{ fontSize: 15, mr: 0.5, color: "#3b82f6" }} /> งานโปรเจค ({confirmedProjectCount})
              </ToggleButton>
              {/* ✅ ซ่อนสำหรับช่าง — แท็บนี้มีไว้ช่วยแอดมินหางานเก่าที่ยังไม่จัดกลุ่มไปจัดหมวดหมู่/รวมเป็น
                  สัญญา (ฟีเจอร์ที่ช่างกดไม่ได้อยู่แล้ว ดู isAdminOrManager gate ที่ปุ่มต่างๆ) ไม่มีประโยชน์
                  อะไรกับช่างเลย มีแต่จะรกตัวเลือก */}
              {isAdminOrManager && (
                <ToggleButton value="ungrouped" sx={VIEW_TAB_SX}>
                  <HourglassEmpty sx={{ fontSize: 15, mr: 0.5 }} /> งานเก่าในระบบที่ยังไม่จัดกลุ่ม ({hiddenJobCount})
                </ToggleButton>
              )}
              <ToggleButton value="all" sx={VIEW_TAB_SX}>
                <Apps sx={{ fontSize: 15, mr: 0.5 }} /> ทั้งหมด ({allFilteredCount})
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>
      )}

      {/* ✅ ช่วยหางานเก่าที่น่าจะเป็นสัญญาเดียวกันให้ (company/site/system/title ตรงกันเป๊ะ) — เดิม
          ต้องไล่ดูเองทีละแถวจากงานเก่าเป็นร้อยรายการ กดปุ่มเดียวเลือกทั้งกลุ่มแล้วไปกรอกข้อมูลสัญญาต่อได้เลย
          ⚠️ BUG ที่แก้: legacyGroupSuggestions คำนวณจาก contracts ทั้งก้อนเสมอ (ไม่ผูกกับ viewFilter)
          เดิมโผล่ทุกแท็บที่ showCheckboxes=true (เลยกำหนด/ทั่วไป/โปรเจค/ทั้งหมด) ทั้งที่ตารางกำลังโชว์
          งานคนละกลุ่มกับที่แนะนำอยู่เลย (เช่น อยู่แท็บ "เลยกำหนด" ซึ่งเป็นสัญญาจริงอยู่แล้ว แต่กล่องดัน
          แนะนำงานที่ยังไม่จัดกลุ่ม) สับสน — จำกัดให้โผล่เฉพาะแท็บที่เกี่ยวข้องจริง (ยังไม่จัดกลุ่ม/ทั้งหมด) */}
      {!loading && showCheckboxes && legacyGroupSuggestions.length > 0 && (viewFilter === "ungrouped" || viewFilter === "all") && (
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
          {/* ✅ ไม่บล็อกการเลือกงานชื่อไม่ตรงกันอีกต่อไป (ดูเหตุผลที่ hasMixedSelection ด้านบน) แต่ยัง
              เตือนไว้ให้รู้ตัว กันเผลอเลือกงานคนละเรื่องกันจริงๆ มารวมเป็นสัญญาเดียวกันโดยไม่ได้ตั้งใจ */}
          {hasMixedSelection && (
            <Typography
              variant="caption"
              sx={{ width: "100%", display: "flex", alignItems: "center", gap: 0.5, color: "#b45309", fontWeight: 600 }}
            >
              <WarningAmber sx={{ fontSize: 14 }} />
              ชื่อบริษัท/โครงการ/ประเภทงาน/ระบบของงานที่เลือกไม่ตรงกันทั้งหมด — ระบบจะรวมเป็นสัญญาเดียว โดยใช้ข้อมูลที่กรอกในขั้นตอนถัดไปแทนของเดิมทุกงาน
            </Typography>
          )}
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
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 2.5, bgcolor: "background.paper",
              "&.Mui-focused fieldset": { borderColor: ACCENT, borderWidth: 1.5 },
            },
          }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 19, color: "text.disabled" }} /></InputAdornment>,
            // ✅ ปุ่มล้างคำค้นหา — เดิมต้องลากเมาส์เลือกข้อความแล้วลบเองทีละตัว โผล่เฉพาะตอนมีคำค้นหา
            // อยู่จริง (ไม่โผล่ค้างเป็นปุ่มเปล่าๆ ตอนช่องว่าง)
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearch("")} edge="end">
                  <Close sx={{ fontSize: 16 }} />
                </IconButton>
              </InputAdornment>
            ) : undefined,
          }}
        />
        {/* ✅ กรองตามประเภทงาน (PM/Service/ติดตั้ง ฯลฯ) — เทียบ pattern เดียวกับตัวกรองผู้รับผิดชอบ/ปี
            ด้านล่างเป๊ะๆ (เลือกจากรายชื่อประเภทงานจริงที่ตั้งค่าไว้ในระบบ) */}
        <TextField
          select size="small" label="ประเภทงาน" value={titleFilter}
          onChange={(e) => setTitleFilter(e.target.value)}
          SelectProps={{ native: true }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Category sx={{ fontSize: 18, color: titleFilter !== "all" ? ACCENT : "text.disabled" }} />
              </InputAdornment>
            ),
          }}
          sx={{
            width: { xs: "100%", sm: 170 }, flexShrink: 0,
            "& .MuiOutlinedInput-root": {
              borderRadius: 2.5,
              bgcolor: titleFilter !== "all" ? alpha(ACCENT, 0.06) : "background.paper",
              "& fieldset": titleFilter !== "all" ? { borderColor: alpha(ACCENT, 0.45) } : {},
              "&:hover fieldset": titleFilter !== "all" ? { borderColor: ACCENT } : {},
            },
            "& .MuiInputLabel-root": titleFilter !== "all" ? { color: ACCENT, fontWeight: 700 } : {},
          }}
        >
          <option value="all">ทุกประเภท</option>
          {titleOptions.map((name) => <option key={name} value={name}>{name}</option>)}
        </TextField>
        {/* ✅ ซ่อนสำหรับช่าง — ข้อมูลที่ช่างเห็นถูกกรองเหลือแค่งานของตัวเองมาจาก backend อยู่แล้วเสมอ
            (ดู canView/isAdminOrManager ด้านบน) ตัวกรอง "ทีมที่เข้างาน" มีประโยชน์แค่ตอนแอดมิน/manager
            ที่เห็นงานของทุกคนต้องกรองหาเฉพาะบางคน — สำหรับช่างมีแต่ชื่อตัวเองให้เลือกอยู่แล้ว มีแต่จะรก */}
        {isAdminOrManager && (
          <TextField
            select size="small" label="ทีมที่เข้างาน" value={teamFilter}
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
        )}
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
      </Stack>

      {loading ? (
        <Skeleton variant="rounded" height={280} sx={{ borderRadius: 3 }} />
      ) : filtered.length === 0 ? (
        <Paper variant="outlined" sx={{ textAlign: "center", py: 6, borderRadius: 3, borderStyle: "dashed" }}>
          <Box sx={{
            width: 64, height: 64, borderRadius: "50%", mx: "auto", mb: 1.5,
            display: "flex", alignItems: "center", justifyContent: "center",
            bgcolor: alpha(ACCENT, 0.06), color: alpha(ACCENT, 0.6),
          }}>
            <FolderOpen sx={{ fontSize: 30 }} />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420, mx: "auto", px: 2 }}>
            {search
              ? "ไม่พบสัญญาที่ตรงกับคำค้นหา"
              : hiddenJobCount > 0
              ? "ยังไม่มีสัญญาแบบหลายครั้ง — กดแท็บ \"งานเก่าในระบบที่ยังไม่จัดกลุ่ม\" ด้านบนเพื่อดูงานที่มีอยู่ หรือสร้างงานใหม่แบบ \"สัญญาแบบหลายครั้ง\" จากหน้าปฏิทิน"
              : "ยังไม่มีข้อมูลสัญญา"}
          </Typography>
        </Paper>
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
            style={tableCssVars}
            sx={{
              tableLayout: "fixed", width: "var(--col-total, 100%)",
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
                  ใช้ colSpan คลุม 2 คอลัมน์ย่อยแถวล่าง ส่วนคอลัมน์อื่นที่ไม่มีกลุ่มใช้ rowSpan คลุม 2 แถว —
                  แต่ตอนซ่อนคอลัมน์ระดับสัญญาทั้งหมด (hideContractOnlyColumns) แถวที่ 2 จะไม่มีอะไรเหลือ
                  เลย ไม่ต้อง render แถวนั้นอีกต่อไป เหลือหัวตารางแค่แถวเดียว (rowSpan ก็ต้องลดเหลือ 1 ตาม) */}
              <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "#fef2f2", borderBottom: `2px solid ${ACCENT} !important`, color: "#7f1d1d", letterSpacing: "0.01em" } }}>
                {showCheckboxes && <TableCell padding="checkbox" rowSpan={headerRowSpan} sx={{ width: colWidth("checkbox") }} />}
                {!hideContractOnlyColumns && <TableCell align="center" colSpan={2}>เลขที่เอกสาร</TableCell>}
                {/* ✅ โผล่แทนกลุ่ม "เลขที่เอกสาร" (เลขที่สัญญา/ใบเสนอราคา) ตอนดูแท็บงานทั่วไป/โปรเจค/
                    ยังไม่จัดกลุ่ม (hideContractOnlyColumns) — งานพวกนี้ไม่มีเลขที่สัญญา แต่มีเลขที่เอกสาร
                    อ้างอิงทั่วไป (PO/ใบสั่งงาน ฯลฯ) แทนได้ ใช้พื้นที่เดิมที่ว่างลงให้เกิดประโยชน์ */}
                {hideContractOnlyColumns && (
                  <ResizableTh width={colWidth("docNo")} rowSpan={headerRowSpan} columnKey="docNo" tableRef={tableRef} onResize={handleColResize("docNo")} sortable sortDirection={sortConfig.key === "docNo" ? sortConfig.direction : null} onSort={handleSortClick}>เอกสารเลขที่</ResizableTh>
                )}
                <ResizableTh width={colWidth("company")} rowSpan={headerRowSpan} columnKey="company" tableRef={tableRef} onResize={handleColResize("company")} sortable sortDirection={sortConfig.key === "company" ? sortConfig.direction : null} onSort={handleSortClick}>บริษัท</ResizableTh>
                <ResizableTh width={colWidth("site")} rowSpan={headerRowSpan} columnKey="site" tableRef={tableRef} onResize={handleColResize("site")} sortable sortDirection={sortConfig.key === "site" ? sortConfig.direction : null} onSort={handleSortClick}>โครงการ</ResizableTh>
                <ResizableTh width={colWidth("system")} rowSpan={headerRowSpan} columnKey="system" tableRef={tableRef} onResize={handleColResize("system")} sortable sortDirection={sortConfig.key === "system" ? sortConfig.direction : null} onSort={handleSortClick}>ระบบ</ResizableTh>
                <ResizableTh width={colWidth("title")} rowSpan={headerRowSpan} columnKey="title" tableRef={tableRef} onResize={handleColResize("title")} sortable sortDirection={sortConfig.key === "title" ? sortConfig.direction : null} onSort={handleSortClick}>ประเภทงาน</ResizableTh>
                {!hideContractOnlyColumns && <TableCell align="center" colSpan={3}>ระยะเวลา</TableCell>}
                {!hideContractOnlyColumns && (
                  <ResizableTh width={colWidth("visitCount")} align="center" rowSpan={headerRowSpan} columnKey="visitCount" tableRef={tableRef} onResize={handleColResize("visitCount")} sortable sortDirection={sortConfig.key === "visitCount" ? sortConfig.direction : null} onSort={handleSortClick}>จำนวนครั้ง</ResizableTh>
                )}
                {!hideContractOnlyColumns && (
                  <ResizableTh width={colWidth("jobValue")} align="right" rowSpan={headerRowSpan} columnKey="jobValue" tableRef={tableRef} onResize={handleColResize("jobValue")} sortable sortDirection={sortConfig.key === "jobValue" ? sortConfig.direction : null} onSort={handleSortClick}>มูลค่างาน</ResizableTh>
                )}
                {!hideContractOnlyColumns && (
                  <ResizableTh width={colWidth("status")} align="center" rowSpan={headerRowSpan} columnKey="status" tableRef={tableRef} onResize={handleColResize("status")}>สถานะสัญญา</ResizableTh>
                )}
                <ResizableTh width={colWidth("progress")} align="center" rowSpan={headerRowSpan} columnKey="progress" tableRef={tableRef} onResize={handleColResize("progress")}>คืบหน้า</ResizableTh>
                {visitColumns.map((n) => (
                  <ResizableTh key={n} width={colWidth(`visit_${n}`)} align="center" rowSpan={headerRowSpan} columnKey={`visit_${n}`} tableRef={tableRef} onResize={handleColResize(`visit_${n}`)}>ครั้งที่ {n}</ResizableTh>
                ))}
                <ResizableTh width={colWidth("team")} rowSpan={headerRowSpan} columnKey="team" tableRef={tableRef} onResize={handleColResize("team")} sortable sortDirection={sortConfig.key === "team" ? sortConfig.direction : null} onSort={handleSortClick}>ทีมที่เข้างาน</ResizableTh>
                {/* ✅ ฟิลด์อิสระจาก "ทีมที่เข้างาน" ด้านบนโดยสมบูรณ์ (team เปลี่ยนได้ทุกครั้งที่มอบหมาย
                    คนอื่นไปทำแทน แต่คนรับผิดชอบสัญญานี้โดยรวมไม่ควรเปลี่ยนตาม) แก้ไข inline ได้เหมือน
                    ทีมที่เข้างานทุกประการ แค่คนละฟิลด์ (ดู responsiblePerson/responsiblePersonId) —
                    งานเก่าที่ยังไม่เคยตั้งค่านี้เลย fallback ไปโชว์ค่าทีมเดิมแทนก่อน (ดู
                    groupEventsByContract) พอแก้ไขครั้งแรกจะกลายเป็นค่าอิสระทันที */}
                <ResizableTh width={colWidth("responsiblePerson")} rowSpan={headerRowSpan} columnKey="responsiblePerson" tableRef={tableRef} onResize={handleColResize("responsiblePerson")} sortable sortDirection={sortConfig.key === "responsiblePerson" ? sortConfig.direction : null} onSort={handleSortClick}>ผู้รับผิดชอบ</ResizableTh>
                <TableCell align="center" rowSpan={headerRowSpan} sx={{ width: colWidth("actions") }} />
              </TableRow>
              {!hideContractOnlyColumns && (
              <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "#fef2f2", borderBottom: `2px solid ${ACCENT} !important`, color: "#7f1d1d", letterSpacing: "0.01em" } }}>
                <ResizableTh width={colWidth("contractNo")} columnKey="contractNo" tableRef={tableRef} onResize={handleColResize("contractNo")} sortable sortDirection={sortConfig.key === "contractNo" ? sortConfig.direction : null} onSort={handleSortClick}>สัญญา</ResizableTh>
                <ResizableTh width={colWidth("quotationNo")} columnKey="quotationNo" tableRef={tableRef} onResize={handleColResize("quotationNo")} sortable sortDirection={sortConfig.key === "quotationNo" ? sortConfig.direction : null} onSort={handleSortClick}>ใบเสนอราคา</ResizableTh>
                <ResizableTh width={colWidth("contractStart")} columnKey="contractStart" tableRef={tableRef} onResize={handleColResize("contractStart")} sortable sortDirection={sortConfig.key === "contractStart" ? sortConfig.direction : null} onSort={handleSortClick}>เริ่มต้น</ResizableTh>
                <ResizableTh width={colWidth("contractEnd")} columnKey="contractEnd" tableRef={tableRef} onResize={handleColResize("contractEnd")} sortable sortDirection={sortConfig.key === "contractEnd" ? sortConfig.direction : null} onSort={handleSortClick}>สิ้นสุด</ResizableTh>
                <ResizableTh width={colWidth("intervalMonths")} align="center" columnKey="intervalMonths" tableRef={tableRef} onResize={handleColResize("intervalMonths")} sortable sortDirection={sortConfig.key === "intervalMonths" ? sortConfig.direction : null} onSort={handleSortClick}>รอบเข้า (เดือน)</ResizableTh>
              </TableRow>
              )}
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
                          onChange={() => toggleSelect(c)}
                          sx={{ p: 0.5, "&.Mui-checked": { color: ACCENT } }}
                        />
                      )}
                    </TableCell>
                  )}
                  {!hideContractOnlyColumns && (
                  <>
                  <EditableCell
                    editable={isAdminOrManager && c.isRealContract} columnKey="contractNo"
                    editing={editingCell?.key === c.key && editingCell?.field === "contractNo"}
                    value={c.contractNo} editValue={editValue} saving={editSaving}
                    width={colVar("contractNo")} title={c.contractNo}
                    formatDisplay={(v) => (v ? <span style={{ color: ACCENT, fontWeight: 600 }}>{v}</span> : <Dash />)}
                    onStartEdit={() => beginEdit(c, "contractNo")}
                    onChangeValue={setEditValue}
                    onCommit={() => commitEdit(c)}
                    onCancel={cancelEdit}
                  />
                  <EditableCell
                    editable={isAdminOrManager && c.isRealContract} columnKey="quotationNo"
                    editing={editingCell?.key === c.key && editingCell?.field === "quotationNo"}
                    value={c.quotationNo} editValue={editValue} saving={editSaving}
                    width={colVar("quotationNo")} title={c.quotationNo}
                    onStartEdit={() => beginEdit(c, "quotationNo")}
                    onChangeValue={setEditValue}
                    onCommit={() => commitEdit(c)}
                    onCancel={cancelEdit}
                  />
                  </>
                  )}
                  {/* ✅ โผล่แทนกลุ่มเลขที่สัญญา/ใบเสนอราคาด้านบนตอนซ่อนคอลัมน์ระดับสัญญา (ดูหัวตาราง) —
                      แก้ไขได้เฉพาะแถวที่จัดหมวดหมู่แล้ว (สัญญาจริง/งานทั่วไป/งานโปรเจค) ไม่ใช่แถว
                      "ยังไม่จัดกลุ่ม" เหมือน "ผู้รับผิดชอบ" ด้านล่าง (ดู canEditField) */}
                  {hideContractOnlyColumns && (
                    <EditableCell
                      editable={isAdminOrManager && canEditField(c, "docNo")} columnKey="docNo"
                      editing={editingCell?.key === c.key && editingCell?.field === "docNo"}
                      value={c.docNo} editValue={editValue} saving={editSaving}
                      width={colVar("docNo")} title={c.docNo}
                      onStartEdit={() => beginEdit(c, "docNo")}
                      onChangeValue={setEditValue}
                      onCommit={() => commitEdit(c)}
                      onCancel={cancelEdit}
                    />
                  )}
                  {/* ✅ บริษัท/โครงการ/ระบบ/ประเภทงาน — แก้ไข inline ได้ทุกแถวแล้ว (editable ไม่ผูกกับ
                      c.isRealContract เหมือนฟิลด์สัญญาอื่นๆ) เทียบ pattern เดียวกับ EditableCell ที่ใช้
                      กับคอลัมน์อื่นในตารางนี้ทุกประการ */}
                  <EditableCell
                    editable={isAdminOrManager} columnKey="company"
                    editing={editingCell?.key === c.key && editingCell?.field === "company"}
                    value={c.company} editValue={editValue} saving={editSaving}
                    width={colVar("company")} title={c.company}
                    onStartEdit={() => beginEdit(c, "company")}
                    onChangeValue={setEditValue}
                    onCommit={() => commitEdit(c)}
                    onCancel={cancelEdit}
                  />
                  <EditableCell
                    editable={isAdminOrManager} columnKey="site"
                    editing={editingCell?.key === c.key && editingCell?.field === "site"}
                    value={c.site} editValue={editValue} saving={editSaving}
                    width={colVar("site")} title={c.site}
                    onStartEdit={() => beginEdit(c, "site")}
                    onChangeValue={setEditValue}
                    onCommit={() => commitEdit(c)}
                    onCancel={cancelEdit}
                  />
                  <EditableCell
                    editable={isAdminOrManager} columnKey="system" editType="autocomplete" editOptions={systemOptions}
                    editing={editingCell?.key === c.key && editingCell?.field === "system"}
                    value={c.system} editValue={editValue} saving={editSaving}
                    width={colVar("system")} title={c.system}
                    onStartEdit={() => beginEdit(c, "system")}
                    onChangeValue={setEditValue}
                    onCommit={() => commitEdit(c)}
                    onCancel={cancelEdit}
                  />
                  <EditableCell
                    editable={isAdminOrManager} columnKey="title" editType="autocomplete" editOptions={titleOptions}
                    editing={editingCell?.key === c.key && editingCell?.field === "title"}
                    value={c.title} editValue={editValue} saving={editSaving}
                    width={colVar("title")} title={c.title}
                    onStartEdit={() => beginEdit(c, "title")}
                    onChangeValue={setEditValue}
                    onCommit={() => commitEdit(c)}
                    onCancel={cancelEdit}
                  />
                  {!hideContractOnlyColumns && (
                  <>
                  <EditableCell
                    editable={isAdminOrManager && c.isRealContract} columnKey="contractStart"
                    editing={editingCell?.key === c.key && editingCell?.field === "contractStart"}
                    value={c.contractStart} editValue={editValue} editType="date" saving={editSaving}
                    width={colVar("contractStart")}
                    formatDisplay={(v) => (v ? moment(v).format("DD/MM/YYYY") : <Dash />)}
                    onStartEdit={() => beginEdit(c, "contractStart")}
                    onChangeValue={setEditValue}
                    onCommit={() => commitEdit(c)}
                    onCancel={cancelEdit}
                  />
                  <EditableCell
                    editable={isAdminOrManager && c.isRealContract} columnKey="contractEnd"
                    editing={editingCell?.key === c.key && editingCell?.field === "contractEnd"}
                    value={c.contractEnd} editValue={editValue} editType="date" saving={editSaving}
                    width={colVar("contractEnd")}
                    formatDisplay={(v) => (v ? moment(v).format("DD/MM/YYYY") : <Dash />)}
                    onStartEdit={() => beginEdit(c, "contractEnd")}
                    onChangeValue={setEditValue}
                    onCommit={() => commitEdit(c)}
                    onCancel={cancelEdit}
                  />
                  <EditableCell
                    editable={isAdminOrManager && c.isRealContract} columnKey="intervalMonths"
                    editing={editingCell?.key === c.key && editingCell?.field === "intervalMonths"}
                    value={c.intervalMonths} editValue={editValue} editType="number" saving={editSaving}
                    width={colVar("intervalMonths")} align="center"
                    title={c.intervalMonths ? undefined : "ยังไม่ได้ระบุ — ระบบใช้ค่าเริ่มต้น 3 เดือนในการเตือนรอบถัดไป"}
                    formatDisplay={(v) => (v ? `ทุก ${v} เดือน` : <Dash />)}
                    onStartEdit={() => beginEdit(c, "intervalMonths")}
                    onChangeValue={setEditValue}
                    onCommit={() => commitEdit(c)}
                    onCancel={cancelEdit}
                  />
                  <EditableCell
                    editable={isAdminOrManager && c.isRealContract} columnKey="visitCount"
                    editing={editingCell?.key === c.key && editingCell?.field === "visitCount"}
                    value={c.visitCount} editValue={editValue} editType="number" saving={editSaving}
                    width={colVar("visitCount")} align="center"
                    // ✅ เตือนถ้ารอบล่าสุดผ่านมาเกินระยะห่างระหว่างรอบที่กำหนดไว้แล้วแต่ยังไม่ได้ลงแผนงาน
                    // ครั้งถัดไปเลย — วงกลมสีแดงทึบ (ไม่ใช่แค่ไอคอนสีแดงบนพื้นขาว) ให้เห็นชัดแม้เป็นภาพนิ่ง
                    // ไม่ต้องรอดูอนิเมชัน บรรทัดที่ 2 โชว์ "ปีละ N ครั้ง" เฉพาะตอนระยะห่างหารลงตัว (แค่
                    // ค่าอ้างอิงเฉยๆ ไม่ได้ผูก/บังคับกับจำนวนครั้งจริงที่แก้ไขในช่องนี้ได้อิสระ)
                    formatDisplay={(v) => {
                      const perYear = visitsPerYear(c.intervalMonths);
                      return (
                        <Stack spacing={0} alignItems="center">
                          <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                            <span>{v || <Dash />}</span>
                            {overdueInfo && (
                              <Tooltip title={`รอบล่าสุด ${overdueInfo.lastVisitDate.format("DD/MM/YYYY")} — ต้องเข้ารอบถัดไปภายใน ${overdueInfo.intervalMonths} เดือน เกินกำหนดแล้ว ${overdueInfo.monthsOverdue} เดือน ยังไม่ได้ลงแผนงานครั้งถัดไป`}>
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
                          {/* {v && perYear && (
                            <Typography variant="caption" sx={{ fontSize: "0.66rem", lineHeight: 1.1, color: "text.secondary" }}>
                              ปีละ {perYear} ครั้ง
                            </Typography>
                          )} */}
                        </Stack>
                      );
                    }}
                    onStartEdit={() => beginEdit(c, "visitCount")}
                    onChangeValue={setEditValue}
                    onCommit={() => commitEdit(c)}
                    onCancel={cancelEdit}
                  />
                  <EditableCell
                    editable={isAdminOrManager && c.isRealContract} columnKey="jobValue"
                    editing={editingCell?.key === c.key && editingCell?.field === "jobValue"}
                    value={c.jobValue} editValue={editValue} editType="number" saving={editSaving}
                    width={colVar("jobValue")} align="right"
                    formatDisplay={(v) => (v != null && v !== "" ? Number(v).toLocaleString() : <Dash />)}
                    onStartEdit={() => beginEdit(c, "jobValue")}
                    onChangeValue={setEditValue}
                    onCommit={() => commitEdit(c)}
                    onCancel={cancelEdit}
                  />
                  <TableCell data-col-key="status" align="center" sx={{ width: colVar("status") }}>
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
                  </>
                  )}
                  <TableCell data-col-key="progress" align="center" sx={{ width: colVar("progress") }}>
                    {(() => {
                      // ⚠️ BUG ที่แก้: แถวที่ไม่ใช่สัญญาจริง (งานทั่วไป/ยังไม่จัดกลุ่ม) ไม่มีแนวคิด "ครั้งที่"
                      // แบบสัญญาเลย เป็น "งานเดียว" เสมอ — ของเดิมยังใช้ตรรกะนับ "ครั้ง" จาก time เหมือน
                      // สัญญา ถ้า time ว่าง (ไม่เคยมีใครกรอก) total จะกลายเป็น 0 โชว์ป้าย "X/0" เพี้ยนๆ
                      // เทียบสถานะของงานนั้นตรงๆ แทน ไม่ต้องพึ่งตรรกะนับครั้งเลย
                      if (!c.isRealContract) {
                        const isDone = c.visits.length > 0 && c.visits.every((v) => v.status === "ดำเนินการเสร็จสิ้น");
                        const chipColor = isDone ? STATUS_COLOR["ดำเนินการเสร็จสิ้น"] : "#9ca3af";
                        return (
                          <Chip
                            label={isDone ? "1/1" : "0/1"} size="small"
                            sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700, bgcolor: alpha(chipColor, 0.12), color: chipColor }}
                          />
                        );
                      }
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
                    // ✅ แถวที่ไม่ใช่สัญญาจริง (งานทั่วไป/ยังไม่จัดกลุ่ม) ไม่มี visitCount ให้เทียบ (ดู
                    // groupEventsByContract) ใช้ rowMaxRound (คำนวณจาก field time จริงของแต่ละ document
                    // แทน — งานที่เคยเลือก "ครั้งที่ 2" ไว้ตอนเพิ่มงานจะไปโผล่ที่คอลัมน์ "ครั้งที่ 2" จริงๆ
                    // ไม่ใช่ถูกบังคับไปช่อง 1 เสมอเหมือนเดิม)
                    const withinCount = n <= rowMaxRound(c);
                    if (!withinCount) {
                      return <TableCell key={n} data-col-key={`visit_${n}`} align="center" sx={{ width: colVar(`visit_${n}`), bgcolor: "action.hover" }} />;
                    }
                    // ✅ นับว่า "ถึงรอบแล้ว" เฉพาะครั้งที่ลงตารางจริงเท่านั้น (!unscheduled) — ถ้าเป็นแค่
                    // แผนงานล่วงหน้าที่จองครั้งนี้ไว้ (ยังไม่มีวันที่จริง) ให้ยังถือว่า "ว่าง" อยู่ในตาราง
                    // สัญญานี้ แต่โชว์ป้ายบอกว่ากำลังรอวางแผนอยู่ แทนที่จะเป็นขีดว่างเฉยๆ กันสับสนว่ายังไม่ได้จอง
                    // ✅ ครั้งที่เข้างานไม่ต่อเนื่อง (เว้นช่วงแล้วกลับมาเข้าอีก) จะมีมากกว่า 1 document ต่อ
                    // ครั้ง — ใช้ filter หาทุกอันแทน find อันเดียว โชว์ซ้อนกันเป็นแถวในเซลล์เดียว
                    // ✅ เรียงตามวันที่เข้างานจริง (เก่า→ใหม่) เสมอ — เดิมโชว์ตามลำดับที่ document ถูกสร้าง
                    // (เช่น ต่อวันที่ย้อนหลังทีหลัง) ทำให้วันที่ในเซลล์เดียวกันโผล่สลับก่อนหลังไม่ตรงความจริง
                    // ดูเหมือนข้อมูลมั่ว/ไม่ได้จัดกลุ่มให้ ทั้งที่จริงเป็นงานเดียวกัน (jobGroupId เดียวกัน) แค่โชว์ผิดลำดับ
                    // ✅ "Number(v.time) || 1" — งานที่ไม่เคยเลือก "ครั้งที่" เลย (time ว่าง) ให้ตกไปอยู่
                    // ช่อง "ครั้งที่ 1" เป็นค่าเริ่มต้น แทนที่จะหายไปเลยไม่โชว์ที่ไหนสักช่อง
                    const roundVisits = c.visits
                      .filter((v) => !v.unscheduled && (Number(v.time) || 1) === n)
                      .sort((a, b) => new Date(a.start || a.date) - new Date(b.start || b.date));
                    const pendingDraft = roundVisits.length === 0 && c.visits.find((v) => v.unscheduled && (Number(v.time) || 1) === n);
                    return (
                      <TableCell key={n} data-col-key={`visit_${n}`} align="center" sx={{ width: colVar(`visit_${n}`), overflow: "hidden" }}>
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
                            {isAdminOrManager && c.isRealContract && (
                              <Stack direction="row" spacing={0.25}>
                                <Tooltip title="เพิ่มวันที่ต่อเนื่อง (เข้างานไม่ติดกัน)">
                                  <IconButton
                                    size="small" onClick={() => openExtendVisitDialog(c, n)}
                                    sx={{ p: 0.25, color: "text.disabled", transition: "background-color .15s, color .15s", "&:hover": { color: ACCENT, bgcolor: alpha(ACCENT, 0.1) } }}
                                  >
                                    <Add sx={{ fontSize: 14 }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="แยกครั้งนี้ออกจากสัญญา (ย้ายเป็นงานเก่าที่ยังไม่จัดกลุ่ม)">
                                  <IconButton
                                    size="small" onClick={() => handleDetachRound(c, n)}
                                    sx={{ p: 0.25, color: "text.disabled", transition: "background-color .15s, color .15s", "&:hover": { color: ACCENT, bgcolor: alpha(ACCENT, 0.1) } }}
                                  >
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
                        ) : isAdminOrManager && c.isRealContract && n === nextOpenRound ? (
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
                    editable={isAdminOrManager && canEditField(c, "team")} columnKey="team"
                    editing={editingCell?.key === c.key && editingCell?.field === "team"}
                    value={c.team === "-" ? "" : c.team} editValue={editValue} editType="select" editOptions={teamOptions} saving={editSaving}
                    width={colVar("team")}
                    // ✅ หัวหน้าทีมเข้างาน vs ลูกทีม — แยกให้ชัดทั้งในเซลล์ (ย่อ "ชื่อหัวหน้า +N") และ
                    // tooltip ตอน hover (รายชื่อเต็ม) แทนการโชว์ชื่อทุกคนต่อกันเฉยๆ แบบเดิมซึ่งดูปนกัน
                    // ไม่รู้ว่าใครเป็นหัวหน้า ใครเป็นลูกทีม
                    formatDisplay={() =>
                      c.teamLeaderName
                        ? (c.teamMemberNames?.length > 0
                          ? `${c.teamLeaderName} +${c.teamMemberNames.length}`
                          : c.teamLeaderName)
                        : (c.teamMemberNames?.length > 0 ? c.teamMemberNames.join(", ") : <Dash />)
                    }
                    title={
                      c.teamLeaderName
                        ? `หัวหน้าทีม: ${c.teamLeaderName}${c.teamMemberNames?.length > 0 ? ` · ลูกทีม: ${c.teamMemberNames.join(", ")}` : ""}`
                        : (c.teamMemberNames?.length > 0 ? `ลูกทีม: ${c.teamMemberNames.join(", ")}` : "")
                    }
                    onStartEdit={() => beginEdit(c, "team")}
                    onChangeValue={setEditValue}
                    onCommit={() => commitEdit(c)}
                    onCancel={cancelEdit}
                  />
                  {/* ✅ แก้ไขแยกอิสระจาก "ทีมที่เข้างาน" ด้านบนได้เลย — เทียบ pattern เดียวกับ EditableCell
                      ของ team ทุกประการ แค่ field/ค่าคนละตัวกัน (ดูคอมเมนต์ที่หัวตาราง) */}
                  <EditableCell
                    editable={isAdminOrManager && canEditField(c, "responsiblePerson")} columnKey="responsiblePerson"
                    editing={editingCell?.key === c.key && editingCell?.field === "responsiblePerson"}
                    value={c.responsiblePerson} editValue={editValue} editType="select" editOptions={teamOptions} saving={editSaving}
                    width={colVar("responsiblePerson")} title={c.responsiblePerson}
                    onStartEdit={() => beginEdit(c, "responsiblePerson")}
                    onChangeValue={setEditValue}
                    onCommit={() => commitEdit(c)}
                    onCancel={cancelEdit}
                  />
                  <TableCell align="center" sx={{ width: colWidth("actions") }}>
                    {/* ✅ เพิ่ม hover เป็นพื้นวงกลมสี (ไม่ใช่แค่เปลี่ยนสีตัวไอคอนเฉยๆ) ให้รู้สึกเหมือนปุ่มกด
                        ได้จริงชัดเจนขึ้น เทียบ pattern ปุ่มไอคอนวงกลมมาตรฐาน Material Design
                        ✅ ช่างดูอย่างเดียว — คอลัมน์นี้มีแต่ปุ่มแก้ไขข้อมูลล้วนๆ ซ่อนทั้งหมดไว้ในนี้ทีเดียว
                        แทนที่จะกันทีละปุ่ม (เหลือ TableCell ว่างไว้เฉยๆ กันตัวเลขความกว้างคอลัมน์เพี้ยน) */}
                    {isAdminOrManager && (
                      <>
                        {!c.isRealContract && (
                          <Tooltip title="จัดหมวดหมู่งาน (ทั่วไป/โปรเจค)">
                            <IconButton
                              size="small" onClick={(e) => openClassifyMenu(e, c)}
                              sx={{
                                color: c.isConfirmedGeneral ? "#10b981" : c.isConfirmedProject ? "#3b82f6" : "text.disabled",
                                transition: "background-color .15s, color .15s",
                                "&:hover": {
                                  color: c.isConfirmedProject ? "#3b82f6" : "#10b981",
                                  bgcolor: alpha(c.isConfirmedProject ? "#3b82f6" : "#10b981", 0.1),
                                },
                              }}
                            >
                              {c.isConfirmedGeneral ? <Build fontSize="small" /> : c.isConfirmedProject ? <Engineering fontSize="small" /> : <HourglassEmpty fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                        )}
                        {!c.isRealContract && (
                          <Tooltip title="ย้ายเข้างานสัญญา / งานรายปี">
                            <IconButton
                              size="small" onClick={() => openAttachDialog(c)}
                              sx={{ color: "text.disabled", transition: "background-color .15s, color .15s", "&:hover": { color: ACCENT, bgcolor: alpha(ACCENT, 0.1) } }}
                            >
                              <AddLink fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title={c.isRealContract ? "ลบสัญญานี้ทั้งหมด" : "ลบงานนี้"}>
                          <IconButton
                            size="small" onClick={() => handleDeleteContract(c)}
                            sx={{ color: "text.disabled", transition: "background-color .15s, color .15s", "&:hover": { color: ACCENT, bgcolor: alpha(ACCENT, 0.1) } }}
                          >
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
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

      {/* ✅ เมนูจัดหมวดหมู่งานทั่วไป/โปรเจค — Menu ตัวเดียวใช้ร่วมกันทุกแถว (ตำแหน่งขยับตาม anchorEl
          ที่กดล่าสุด) เทียบ pattern มาตรฐาน MUI แทนเปิด Dialog เต็มจอสำหรับแค่เลือก 1 ใน 3 ตัวเลือก */}
      <Menu anchorEl={classifyMenuAnchor} open={Boolean(classifyMenuAnchor)} onClose={closeClassifyMenu}>
        <MenuItem selected={!classifyMenuTarget?.isConfirmedGeneral && !classifyMenuTarget?.isConfirmedProject} onClick={() => handleClassify("")}>
          <ListItemIcon><HourglassEmpty fontSize="small" sx={{ color: "text.disabled" }} /></ListItemIcon>
          <ListItemText>ยังไม่จัดกลุ่ม</ListItemText>
        </MenuItem>
        <MenuItem selected={Boolean(classifyMenuTarget?.isConfirmedGeneral)} onClick={() => handleClassify("general")}>
          <ListItemIcon><Build fontSize="small" sx={{ color: "#10b981" }} /></ListItemIcon>
          <ListItemText>งานทั่วไป</ListItemText>
        </MenuItem>
        <MenuItem selected={Boolean(classifyMenuTarget?.isConfirmedProject)} onClick={() => handleClassify("project")}>
          <ListItemIcon><Engineering fontSize="small" sx={{ color: "#3b82f6" }} /></ListItemIcon>
          <ListItemText>งานโปรเจค</ListItemText>
        </MenuItem>
      </Menu>

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
              select fullWidth size="small" label="ทีมที่เข้างาน"
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
                onChange={(e) => setField("visitCount")(e.target.value)} inputProps={{ min: 1, max: MAX_VISIT_COUNT }}
                helperText={`สูงสุด ${MAX_VISIT_COUNT} ครั้ง`} />
              <TextField fullWidth size="small" type="number" label="มูลค่างาน" value={form.jobValue}
                onChange={(e) => setField("jobValue")(e.target.value)} />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              {/* ✅ ระยะห่างระหว่างรอบ — ข้อมูลอ้างอิงอิสระ ไม่บังคับ ไม่ผูก/บังคับกับ "จำนวนครั้งทั้งหมด"
                  ด้านบน (งานจริงเลื่อน/ชนกันได้เสมอ จำนวนครั้งจริงต้องให้ผู้ใช้เป็นคนกำหนดเองเท่านั้น) —
                  ใช้แค่เตือน "เกินกำหนดรอบถัดไป" ในตาราง/พุชแจ้งเตือน */}
              <TextField fullWidth size="small" type="number" label="เข้าทุกกี่เดือน" value={form.intervalMonths}
                onChange={(e) => setField("intervalMonths")(e.target.value)} inputProps={{ min: 1, max: 24 }}
                helperText={intervalPreviewText} />
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
              select fullWidth size="small" label="ทีมที่เข้างาน"
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
            {/* ✅ พิมพ์ค้นหาได้เลย (บริษัท/โครงการ/ประเภทงาน/ระบบงาน/เลขที่สัญญา — Autocomplete กรองจาก
                getOptionLabel ให้อัตโนมัติ) แทน native <select> เดิมที่ต้องไล่สโครลหาเองทีละบรรทัดเวลามี
                สัญญาเยอะๆ — รายการเรียงตามเลขที่สัญญาให้แล้ว (sortedAttachableContracts) และแต่ละตัวเลือก
                โชว์ 2 บรรทัด (ชื่อบริษัท/โครงการ + ประเภทงาน·ระบบงาน·เลขที่สัญญา·จำนวนครั้งที่ว่างเหลือ)
                ให้เห็นชัดเจนสวยงามกว่าบรรทัดเดียว — ⚠️ เดิมไม่โชว์ประเภทงาน/ระบบงานเลย เลือกยากตอนมีหลาย
                สัญญาของบริษัท/โครงการเดียวกันแต่คนละระบบ (เช่น Fire Alarm กับ CCTV) แยกไม่ออกว่าอันไหน */}
            <Autocomplete
              fullWidth size="small"
              options={sortedAttachableContracts}
              value={selectedAttachContract}
              onChange={(_, v) => { setAttachContractId(v?.key || ""); setAttachRound(""); }}
              getOptionLabel={(x) => `${[x.company, x.site].filter(Boolean).join(" · ") || "(ไม่ระบุชื่อ)"} · ${x.title || "-"} · ${x.system || "-"}${x.contractNo ? ` · ${x.contractNo}` : ""}`}
              isOptionEqualToValue={(a, b) => a.key === b.key}
              noOptionsText="ไม่พบสัญญาที่ตรงกับคำค้นหา"
              renderOption={(props, x) => (
                <Box component="li" {...props} sx={{ display: "flex !important", flexDirection: "column", alignItems: "flex-start !important", gap: 0.25, py: "6px !important" }}>
                  <Typography variant="body2" fontWeight={700}>
                    {[x.company, x.site].filter(Boolean).join(" · ") || "(ไม่ระบุชื่อ)"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {x.title || "-"} · {x.system || "-"} · {x.contractNo ? `เลขที่ ${x.contractNo}` : "ไม่มีเลขที่สัญญา"} · เหลือ {x.visitCount - countUsedRounds(x.visits)} ครั้ง
                  </Typography>
                </Box>
              )}
              renderInput={(params) => (
                <TextField {...params} label="เลือกสัญญาปลายทาง" placeholder="พิมพ์ค้นหาบริษัท/โครงการ/ประเภทงาน/ระบบงาน/เลขที่สัญญา" InputLabelProps={{ shrink: true }} />
              )}
            />
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
                onChange={(e) => setMergeField("visitCount")(e.target.value)} inputProps={{ min: 1, max: MAX_VISIT_COUNT }}
                helperText={`ค่าเริ่มต้น = จำนวนงานที่เลือก (${selectedContracts.length}) — สูงสุด ${MAX_VISIT_COUNT} ครั้ง`}
              />
              <TextField fullWidth size="small" type="number" label="มูลค่างาน" value={mergeForm.jobValue}
                onChange={(e) => setMergeField("jobValue")(e.target.value)} />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                fullWidth size="small" type="number" label="เข้าทุกกี่เดือน" value={mergeForm.intervalMonths}
                onChange={(e) => setMergeField("intervalMonths")(e.target.value)} inputProps={{ min: 1, max: 24 }}
                helperText="ไม่บังคับ — ใช้เตือนเมื่อเกินกำหนดรอบถัดไปเท่านั้น"
              />
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
