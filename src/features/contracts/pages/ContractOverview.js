/**
 * ContractOverview.js — "ภาพรวมสัญญา"
 *
 * จัดกลุ่มงานที่ผูกด้วย contractGroupId เดียวกัน (ครั้งที่ 1-N ของสัญญาเดียวกัน — ดู AddEvent.js
 * โหมด "สัญญาแบบหลายครั้ง") ให้แสดงเป็นตาราง 1 แถวต่อสัญญา คอลัมน์ตรงกับตาราง Excel ที่ใช้ติดตาม
 * สัญญาบริการอยู่แล้ว (บริษัท/โครงการ/ระบบ/ประเภทงาน/เลขที่สัญญา/ใบเสนอราคา/ระยะเวลา/จำนวนครั้ง/
 * วันที่เข้างานแต่ละครั้ง/ทีมของแต่ละครั้ง/มูลค่างาน/ผู้รับผิดชอบ) — งานเก่าที่ยังไม่มี contractGroupId
 * (สร้างก่อนมีฟีเจอร์นี้) ถูกจัดเป็นสัญญา 1 ครั้งของตัวเอง ไม่หายไปจากตาราง
 *
 * ✅ "ทีมที่เข้างาน" (team) ≠ "ผู้รับผิดชอบ" (responsiblePerson) — สองฟิลด์อิสระจากกันโดยสมบูรณ์ คนที่
 * รับผิดชอบสัญญา/ลูกค้ารายนี้โดยรวม (ผู้รับผิดชอบ) ไม่ควรเปลี่ยนตามทีมที่เข้างานแต่ละครั้ง — แก้ไข
 * ผู้รับผิดชอบได้ตรงคอลัมน์ "ผู้รับผิดชอบ" ในตารางนี้เลย (งานเก่าที่ยังไม่เคยตั้งค่านี้เลย fallback ไปใช้
 * ค่าทีมของครั้งที่ 1 แสดงแทนก่อน) ดู groupEventsByContract ใน shared/utils/contractOverdue.js
 *
 * ✅ "ทีมที่เข้างาน" ไม่มีคอลัมน์สรุประดับสัญญาแยกต่างหากแล้ว (ตัดออกตามที่ผู้ใช้ขอ — สัญญาที่มีหลายครั้ง
 * แต่ละครั้งอาจเข้าโดยคนละทีมกันจริง มีคอลัมน์เดียวจะทำให้แก้ไขแล้ว sync ทับทุกครั้งผิดๆ) แสดง/แก้ไข
 * อยู่ในช่อง "ครั้งที่ N" ของแต่ละครั้งโดยตรงแทน (อิงจาก visit.team ของ document นั้นๆ — ดู
 * beginRoundTeamEdit/commitRoundTeamEdit) แก้ทีละครั้งเท่านั้น ไม่กระทบครั้งอื่น/ไม่ sync กับผู้รับผิดชอบ
 *
 * ✅ แก้ไขได้เฉพาะแอดมิน/manager (isAdminOrManager คุมทุกจุดที่แก้ไขข้อมูล) แต่ช่างเข้ามาดูงานของ
 * ตัวเองได้ด้วย (canView) — ข้อมูลถูกกรองเหลือแค่งานของตัวเองให้แล้วตั้งแต่ฝั่ง backend
 * (GET /events/event-op, /events/drafts เช็ค resPerson/team/userId ให้อยู่แล้ว) จึงไม่ต้องกรองซ้ำที่นี่
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Link, useSearchParams } from "react-router-dom";
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import Swal from "sweetalert2";
import {
  Box, Stack, Typography, TextField, InputAdornment, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableFooter, TableRow, Paper, Skeleton,
  Dialog, DialogTitle, DialogContent, DialogActions, ToggleButtonGroup, ToggleButton,
  Button, Autocomplete, Alert, Chip, Checkbox, Pagination, useMediaQuery, Badge,
  TableSortLabel, Menu, MenuItem, ListItemIcon, ListItemText, Collapse, CircularProgress, Portal,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Search, FolderOpen, Add, Close,
  PlaylistAdd, MergeType, GroupWork, DeleteOutline, WarningAmber,
  AddLink, LinkOff, Build, Engineering, ExpandMore, ExpandLess,
  CalendarMonth, PersonOutline, Category, Assignment, Description, HourglassEmpty, Apps, DeviceHub,
  SwapHoriz, TableChart, FilterList, ViewAgenda, TableRows, SwipeLeft, ChevronLeft, ChevronRight,
  AddCircleOutline, Check, Autorenew, EventBusy, History, Apartment, Timelapse,
} from "@mui/icons-material";
import { useAuth } from "@/features/auth/AuthContext";
import EventService from "@/shared/services/EventService";
import CustomerService from "@/shared/services/CustomerService";
// ✅ ตำแหน่งหน้างานบน Google Maps — ตัวเดียวกับหน้าการดำเนินงาน/ปฏิทิน (ดูหัวไฟล์ SiteMapLink.js)
import SiteMapLink from "@/shared/ui/SiteMapLink";
import AuthService from "@/shared/services/authService";
import JobTypeService from "@/shared/services/JobTypeService";
import SystemTypeService from "@/shared/services/SystemTypeService";
import { formatEventDateRange } from "@/shared/utils/formatDateRange";
import { resolveOperationGroup } from "@/shared/utils/overdueJobs";
import { countUsedRounds, visitsPerYear, INTERVAL_MONTHS_PRESETS } from "@/shared/utils/contractRounds";
import { groupEventsByContract, nextVisitOverdueInfo, contractStatusInfo, isExpiredContract, contractCompleteness } from "@/shared/utils/contractOverdue";
// ✅ สถานะการวางบิล/รับเงิน — ของกลางชุดเดียวกับหน้า "วางบิล / รับเงิน" (/billing) ห้ามคำนวณซ้ำที่นี่
import { contractBillingSummary, baht as bahtFmt } from "@/shared/utils/billing";
import BillingDialog from "@/features/finance/components/BillingDialog";
import BillingChip from "@/features/finance/components/BillingChip";
import JobDocsChip from "@/features/documents/components/JobDocsChip";
import JobDocsDialog from "@/features/documents/components/JobDocsDialog";
import { escapeHtml } from "@/shared/utils/escapeHtml";
import DeliveryNoteDialog from "@/features/documents/components/DeliveryNoteDialog";
import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import { thaiDateNumeric, formatThai } from "@/shared/utils/thaiDate";
import { can, DEPARTMENT, DEPARTMENT_LABEL } from "@/shared/utils/roles";

const ACCENT = "#dc2626";
// ✅ สีแบรนด์ของ Excel — ใช้กับปุ่มส่งออกโดยเฉพาะ ให้เห็นปุ๊บรู้ทันทีว่าคือไฟล์ Excel ไม่ต้องอ่าน tooltip
const EXCEL_GREEN = "#217346";
// ✅ เพดานจำนวนครั้งของสัญญา — บังคับทุกจุดที่ตั้งค่านี้ (ฟอร์มเพิ่มสัญญา/แก้ไข inline/จัดกลุ่มเป็นสัญญา
// ทั้งฝั่งจอและฝั่ง backend) และใช้เป็นเพดานตอนคำนวณจำนวนคอลัมน์ "ครั้งที่ N" ของตารางด้วย (กันไว้อีก
// ชั้น เผื่อมีข้อมูลเก่า/จากที่อื่นที่หลุดรอดมาสูงกว่านี้ — ไม่งั้นตารางทั้งหน้าจะกว้างจนพังได้)
const MAX_VISIT_COUNT = 12;
// ✅ จำนวนวันที่ที่โชว์ในเซลล์ "ครั้งที่ N" ก่อนพับที่เหลือ (ดู expandedVisitCells) — 3 พอดีกับความสูงแถว
// ปกติของแถวอื่นๆ ในตาราง ทำให้ทุกแถวสูงเท่ากันเป็นระเบียบ ไม่มีแถวไหนพุ่งสูงกว่าเพื่อนเป็นเท่าตัว
const VISIT_CELL_PREVIEW = 3;

// ── โทนสีกลางของหน้า (เฉดเทาอมฟ้า "slate") ────────────────────────────────────
// ✅ เดิมหน้านี้ใช้ "สีแดงแบรนด์" เป็นสีพื้นผิวด้วย (หัวตารางพื้นชมพู #fef2f2 + ตัวหนังสือแดงเข้ม + เส้นใต้
// แดงหนา 2px + แถวสรุปพื้นแดงจาง) ผลคือแดงกลายเป็น "สีพื้นหลัง" ที่เห็นตลอดเวลาจนชินตา พอมีของที่แดง
// จริงๆ เพราะสำคัญ (เลยกำหนด/หมดอายุ/ยอดรวม) ก็จมหายไปกับพื้น ไม่เหลือน้ำหนักให้เตือนอะไรได้เลย —
// และเป็นลุคที่ดูเก่าแบบ admin panel ยุคก่อน
// ✅ หลักใหม่: พื้นผิวทั้งหมดเป็นกลาง (ขาว/เทาอ่อน) เก็บสีแดงไว้ใช้เฉพาะ "จุดที่ต้องการให้สายตาไปหยุด"
// เท่านั้น — ปุ่มหลัก, แท็บที่เลือกอยู่, ตัวกรองที่ทำงานอยู่, คำเตือน, ยอดรวม
const SURFACE_SUBTLE = "#f8fafc";   // slate-50  — พื้นหัวตาราง/แถบเครื่องมือ
const SURFACE_STRIPE = "#fbfcfd";   // แถบสลับสีของแถว (ทึบ ไม่ใช่สีโปร่งแสง — คอลัมน์ที่ตรึงไว้ต้องใช้)
const BORDER_MAIN = "#e2e8f0";      // slate-200 — เส้นขอบนอก/เส้นใต้หัวตาราง
const BORDER_SOFT = "#eef2f7";      // เส้นคั่นระหว่างแถว
const BORDER_HAIR = "#f4f6fa";      // เส้นคั่นระหว่างคอลัมน์ — จางมากจนเกือบไม่เห็น แค่พอเป็นแนวสายตา
const TEXT_SUB = "#64748b";         // slate-500 — ตัวหนังสือรอง/หัวคอลัมน์

// ✅ สไตล์แท็บสลับมุมมอง — เปลี่ยนจาก "ปุ่มมีกรอบเรียงติดกัน" (ลุคเก่า) เป็น segmented control แบบที่
// iOS/แอปสมัยใหม่ใช้กัน: รางพื้นเทาอ่อนทรงแคปซูล ตัวที่เลือกอยู่เป็นการ์ดสีขาวลอยขึ้นมามีเงาบางๆ
// อ่านง่ายกว่าเดิมมากเพราะ "ตัวที่เลือก" ต่างจากพื้นด้วยความสว่าง+เงา ไม่ใช่แค่สีพื้นแดงจางที่ต้องเพ่ง
// ⚠️ "ตัวที่เลือกอยู่" ใช้สีเข้มเป็นกลาง (ไม่ใช่สีแดงแบรนด์) โดยตั้งใจ — แท็บคือ "ตอนนี้อยู่หน้าไหน"
// ซึ่งเป็นสถานะการนำทาง ไม่ใช่คำเตือนหรือปุ่มที่อยากให้กด ถ้าย้อมแดงด้วยจะไปแข่งน้ำหนักสายตากับ
// ปุ่ม "เพิ่มสัญญาใหม่" / ป้าย "หมดอายุแล้ว" / ยอดรวม ที่แดงอยู่แล้ว จนสุดท้ายไม่มีอะไรเด่นสักอย่าง
// (ปัญหา "สีกลบกันเอง" ที่ผู้ใช้เจอ) — ความต่างระหว่างเลือก/ไม่เลือกมาจากพื้นขาว+เงา+ตัวหนาแทน
// ซึ่งอ่านออกทันทีอยู่แล้วโดยไม่ต้องพึ่งสี
const VIEW_TAB_SX = {
  textTransform: "none", fontSize: "0.8rem", fontWeight: 600, px: 1.5, py: 0.6, whiteSpace: "nowrap",
  border: "none !important", borderRadius: "999px !important", color: TEXT_SUB,
  transition: "background-color .15s, color .15s, box-shadow .15s",
  "&:hover": { bgcolor: alpha("#0f172a", 0.04) },
  "&.Mui-selected": {
    color: "#0f172a", bgcolor: "#fff", fontWeight: 700,
    boxShadow: "0 1px 2px rgba(15,23,42,0.14), 0 0 0 1px rgba(15,23,42,0.05)",
    "&:hover": { bgcolor: "#fff" },
  },
};
// ✅ รางของ segmented control — ครอบ ToggleButtonGroup ทั้งกลุ่มไว้
const VIEW_TAB_GROUP_SX = {
  flexWrap: "nowrap", bgcolor: "#f1f5f9", borderRadius: 999, p: "3px", gap: "2px",
  "& .MuiToggleButtonGroup-grouped": { m: 0, border: "none" },
};

// ✅ สีเดียวกับ OP_COLOR ในหน้า Operation/index.js ให้ตรงกันทั้งแอป — ใช้ไล่สีลิงก์ "ครั้งที่ N"
// ตามสถานะจริงของแต่ละครั้ง (ไม่ใช่สีแดงเดียวทุกอันเหมือนเดิม ซึ่งดูไม่ออกว่าครั้งไหนเสร็จหรือยัง)
const STATUS_COLOR = {
  "กำลังรอยืนยัน": "#f59e0b",
  "ยืนยันแล้ว": "#3b82f6",
  "กำลังดำเนินการ": "#8b5cf6",
  "ดำเนินการเสร็จสิ้น": "#10b981",
};

/**
 * 🏢 ป้ายกำกับแผนกเจ้าของสัญญา — สีประจำสายงานชุดเดียวกับที่ใช้ทั้งแอป (แดง = สายบริการ/ช่าง · ม่วง = สายขาย)
 * ดูหัวปฏิทิน/แถบแท็บ/แดชบอร์ด ที่ใช้คู่สีเดียวกันนี้อยู่แล้ว — คนใช้จำสีได้ทันทีโดยไม่ต้องอ่านตัวหนังสือ
 * ⚠️ เป็น "ข้อมูลประกอบ" ล้วนๆ ไว้ดู/กรอง/ออกรายงานในหน้านี้เท่านั้น ไม่มีผลกับหน้าอื่นเลยแม้แต่หน้าเดียว
 * — เก็บแยกเป็นฟิลด์ departmentTag คนละตัวกับฟิลด์ department ที่คุมว่างานไปโผล่ในปฏิทิน/หน้าการ
 * ดำเนินงานของใคร (departmentScope ฝั่ง server) ติดป้ายว่าเป็นของฝ่ายขายแล้วช่างยังเห็นงานครบเหมือนเดิม
 */
const DEPARTMENT_META = {
  [DEPARTMENT.SERVICE]: { label: DEPARTMENT_LABEL[DEPARTMENT.SERVICE], short: "บริการ", color: "#dc2626", bg: "rgba(220,38,38,0.10)" },
  [DEPARTMENT.SALES]: { label: DEPARTMENT_LABEL[DEPARTMENT.SALES], short: "ขาย", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
};
// ⚠️ งานเก่าที่ยังไม่เคยติดป้ายไม่มีค่าเก็บไว้ — ถือเป็น "ฝ่ายบริการ" ตามที่ผู้ใช้สั่งให้ตั้งต้นเป็น Services
// ทั้งหมดก่อน จึงไม่ต้อง migrate ข้อมูลเดิมสักใบ และตัวกรอง "ฝ่ายบริการ" ก็ยังเจองานเก่าครบ
const departmentMeta = (v) => DEPARTMENT_META[v || DEPARTMENT.SERVICE] || DEPARTMENT_META[DEPARTMENT.SERVICE];
const DEPARTMENT_OPTIONS = Object.entries(DEPARTMENT_META).map(([value, m]) => ({ value, label: m.label }));

/**
 * ✅ "ช่องสถานะสัญญาแถวนี้ควรขึ้นว่าอะไร" — ของกลางที่ทั้งตาราง การ์ดมือถือ ตัวกรอง ช่องค้นหา และไฟล์
 * Excel ใช้ร่วมกัน ทั้ง 5 จุดจึงพูดตรงกันเสมอโดยอัตโนมัติ
 *
 * ลำดับความสำคัญ (บนลงล่าง):
 *   1. หมายเหตุที่คนกรอกพิมพ์เอง — คนย่อมรู้สถานะจริงดีกว่าสูตรที่ดูแค่วันที่ในสัญญา
 *   2. สถานะอัตโนมัติจากวันสิ้นสุดสัญญา (หมดอายุ / ใกล้หมดอายุ / มีผลบังคับใช้)
 *   3. "ข้อมูลไม่ครบ" — คำนวณสถานะไม่ได้เพราะยังไม่ได้กรอกวันสิ้นสุด (หรือช่องจำเป็นอื่นๆ)
 *   4. ไม่มีสถานะจริงๆ (แถวที่ไม่ใช่สัญญาและข้อมูลครบแล้ว)
 * ⚠️ ข้อ 3 สำคัญ: เดิมกรณีนี้ขึ้นเป็นขีดว่างเฉยๆ ซึ่งแยกไม่ออกจากข้อ 4 เลย คนกรอกจึงไม่มีทางรู้ว่า
 * ต้องไปเติมอะไรตรงไหน (ดู contractCompleteness ใน shared/utils/contractOverdue.js)
 */
const CONTRACT_STATUS_KIND = {
  note: { color: "#0f172a", bg: "rgba(15,23,42,0.08)" },
  incomplete: { color: "#b45309", bg: "rgba(245,158,11,0.14)" },
};
/**
 * ✅ "สถานะจริง" ของแถวนี้มีอะไรบ้าง — คืนเป็น "หลายค่า" ได้โดยตั้งใจ ใช้กับตัวกรอง/การนับเท่านั้น
 *
 * ⚠️ ต่างจาก statusDisplay ด้านล่างซึ่งเลือกมาแสดงได้ค่าเดียว (หมายเหตุที่พิมพ์เองทับสถานะอัตโนมัติ) —
 * ถ้าเอาตรรกะ "ทับ" อันนั้นมาใช้กับตัวกรองด้วย สัญญาที่หมดอายุแล้วแต่บังเอิญมีคนพิมพ์หมายเหตุไว้จะ
 * หลุดออกจากตัวกรอง "หมดอายุแล้ว" ทั้งที่มันหมดอายุจริง — ซึ่งเป็นการซ่อนของที่ต้องรีบต่อสัญญา
 * ✅ "มีหมายเหตุที่พิมพ์เอง" จึงเป็นแท็กเสริมที่ติดเพิ่มได้ ไม่ใช่กลุ่มที่ดึงแถวออกจากกลุ่มอื่น
 */
const statusKinds = (c) => {
  const st = contractStatusInfo(c);
  const kinds = [];
  if (st) kinds.push(st.state);
  else if (contractCompleteness(c).missing.length > 0) kinds.push("incomplete");
  if ((c.statusNote || "").trim()) kinds.push("note");
  return kinds;
};

const statusDisplay = (c) => {
  const note = (c.statusNote || "").trim();
  if (note) {
    // ⚠️ หมายเหตุทับ "ข้อความ" ที่แสดง แต่ห้ามทับ "ความจริง" — ถ้าสัญญาหมดอายุ/ใกล้หมดอายุอยู่จริง
    // ต้องยังมีร่องรอยให้เห็น ไม่งั้นการพิมพ์หมายเหตุกลายเป็นการซ่อนวันหมดอายุไปจากสายตาทั้งตาราง
    const auto = contractStatusInfo(c);
    const warn = auto && (auto.state === "expired" || auto.state === "expiring") ? auto : null;
    return {
      kind: "note", label: note,
      color: CONTRACT_STATUS_KIND.note.color, bg: CONTRACT_STATUS_KIND.note.bg,
      missing: contractCompleteness(c).missing, auto: warn,
    };
  }
  const st = contractStatusInfo(c);
  const { missing } = contractCompleteness(c);
  if (st) return { kind: st.state, label: st.label, color: st.color, bg: alpha(st.color, 0.12), missing };
  if (missing.length > 0) {
    return {
      kind: "incomplete", label: "ข้อมูลไม่ครบ",
      color: CONTRACT_STATUS_KIND.incomplete.color, bg: CONTRACT_STATUS_KIND.incomplete.bg, missing,
    };
  }
  return { kind: "none", label: "", color: TEXT_SUB, bg: "transparent", missing: [] };
};
// ตัวเลือกของตัวกรอง "สถานะสัญญา" — เทียบด้วย kind ซึ่งเป็นคีย์คงที่ ไม่ใช่ข้อความที่แก้ถ้อยคำเมื่อไหร่
// ตัวกรองก็พังเงียบๆ (label ของ "ใกล้หมดอายุ" มีจำนวนวันต่อท้ายด้วย เทียบข้อความไม่ได้ตั้งแต่ต้น)
/**
 * ✅ ช่วงเวลาสำเร็จรูป — เลือกจาก dropdown ทีเดียวจบ ไม่ต้องกดปฏิทิน 2 ครั้งทุกครั้งที่อยากดูเดือนนี้/ปีนี้
 *
 * ⚠️ คำนวณช่วงตอน "กรองจริง" ทุกครั้ง ไม่ใช่ตอนกดเลือกแล้วเก็บวันที่ตายตัวไว้ — ถ้าเก็บไว้ ผู้ใช้ที่เปิด
 * หน้าค้างข้ามเที่ยงคืน/ข้ามเดือนจะเห็น "เดือนปัจจุบัน" ที่ค้างอยู่ที่เดือนเก่าโดยไม่รู้ตัว
 * ⚠️ "ปีหน้า" มีไว้เพราะหน้านี้เป็นเรื่องสัญญาโดยเฉพาะ — คำถามที่ถูกถามบ่อยที่สุดคือ "ปีหน้ามีสัญญา
 * อะไรที่ยังมีผลอยู่บ้าง" (ใช้วางแผนต่อสัญญา/กำลังคน) ซึ่งเป็นคำถามเกี่ยวกับอนาคต ต่างจากรายงาน
 * ทั่วไปที่มองย้อนหลังอย่างเดียว
 */
// ✅ ค่าพิเศษของตัวกรอง "ช่วงเวลา" — ที่เหลือเป็นเลขปีตรงๆ (ดู availableYears)
// ⚠️ ตัวกรอง "ปี" กับ "ช่วงเวลาสัญญา" เคยเป็น 2 ช่องแยกกัน ซึ่งซ้ำซ้อนกันเอง (ทั้งคู่คือ "จะดูช่วงไหน")
// และขัดกันได้ด้วย เช่นเลือกปี 2569 แต่เลือกช่วงเป็นปีหน้า แล้วได้ตารางว่างโดยไม่มีอะไรอธิบาย —
// ยุบเหลือช่องเดียวตามที่ผู้ใช้สั่ง: เลือกปีก็ได้ หรือเลือก "เลือกช่วงวันที่เอง…" เพื่อกรอกช่วงเองก็ได้
const YEAR_FILTER_ALL = "all";
const YEAR_FILTER_NONE = "none";      // ยังไม่ระบุปี (ไม่มีวันสัญญาและไม่เคยลงวันที่เข้างานเลย)
const YEAR_FILTER_CUSTOM = "custom";  // กรอกช่วงวันที่เอง (ใช้คู่กับ dateFrom/dateTo)
// คืนช่วงที่จะใช้กรองจริงตอนเลือก "เลือกช่วงวันที่เอง…" — null = ยังไม่ได้กรอกวันไหนเลย จึงยังไม่กรอง
const resolveCustomRange = (from, to) => {
  if (!from && !to) return null;
  return { from: from ? moment(from).startOf("day") : null, to: to ? moment(to).endOf("day") : null };
};

const STATUS_FILTER_OPTIONS = [
  { value: "active", label: "มีผลบังคับใช้" },
  { value: "expiring", label: "ใกล้หมดอายุ" },
  { value: "expired", label: "หมดอายุแล้ว" },
  { value: "incomplete", label: "ข้อมูลไม่ครบ" },
  { value: "note", label: "มีหมายเหตุที่พิมพ์เอง" },
];

// ✅ ป้ายแผนก 1 ชิ้น — ใช้ตัวเดียวกันทั้งตารางเดสก์ท็อปและการ์ดมือถือ ไม่ก๊อป JSX ไปวางสองที่
// (ก๊อปแล้วมีวันหนึ่งที่แก้สีที่เดียวลืมอีกที่ แล้วสองหน้าจอแสดงคนละแบบโดยไม่มีใครรู้)
const DepartmentPill = ({ value }) => {
  const meta = departmentMeta(value);
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex", alignItems: "center", gap: 0.4,
        px: 0.9, py: 0.25, borderRadius: 999,
        bgcolor: meta.bg, color: meta.color,
        fontSize: "0.7rem", fontWeight: 800, whiteSpace: "nowrap",
        border: `1px solid ${alpha(meta.color, 0.28)}`,
      }}
    >
      <Apartment sx={{ fontSize: 12 }} />
      {meta.label}
    </Box>
  );
};

// ✅ ช่องว่างเดิมใช้ "-" สีเทาเฉยๆ แต่ปนกับ "-" ที่เป็นลิงก์ (สีแดง) ในคอลัมน์ครั้งที่ N ดูแยกยาก
// ว่าอันไหนกดได้ — ใช้ตัวกลมจางๆ แทน ให้ต่างจากลิงก์ชัดเจนขึ้น
const Dash = () => <Box component="span" sx={{ color: "text.disabled", opacity: 0.6 }}>–</Box>;

// ✅ ตัวเลขเงินทุกจุดในหน้านี้ต้องมี "฿" นำหน้าเสมอ — ในตารางเดียวกันมีทั้ง "จำนวนครั้ง" "ครั้งที่ N"
// "รอบเข้า (เดือน)" และ "มูลค่างาน" ปนกันอยู่ ตัวเลขเปล่าๆ อย่าง 88,000 กับ 12 จึงแยกด้วยสายตาไม่ออก
// ว่าช่องไหนคือจำนวนเงิน (โดยเฉพาะบนมือถือที่คอลัมน์หัวตารางเลื่อนหลุดจอไปแล้ว) — ตรงกับที่หน้า
// "ติดตามใบเสนอราคา" ใช้อยู่ก่อนแล้ว ให้ทั้งแอปอ่านตัวเลขเงินได้แบบเดียวกันหมด
const hasMoney = (v) => v != null && v !== "" && !Number.isNaN(Number(v));
const formatBaht = (v) => `฿${Number(v).toLocaleString()}`;

// ✅ "ผู้รับผิดชอบ" ที่ยังไม่เคยมอบหมาย — เดิมช่องนี้ fallback ไปแสดงชื่อ "หัวหน้าทีมเข้างานของครั้งที่ 1"
// แทน ทำให้ดูเหมือนมอบหมายไว้แล้วทั้งที่ยังไม่เคย และเปลี่ยนตามทุกครั้งที่แก้ทีม (ดู groupEventsByContract
// ใน shared/utils/contractOverdue.js) — ตัด fallback ออกแล้ว จึงต้องมีสถานะว่างที่ "สื่อความหมาย" แทนขีดเปล่าๆ
// ให้รู้ว่าเป็นงานที่ยังต้องไปมอบหมายเพิ่ม ไม่ใช่ข้อมูลหาย
const unassignedResponsibleDisplay = (v) =>
  v || (
    <Box component="span" sx={{ color: "#b45309", fontSize: "0.72rem", fontWeight: 600, whiteSpace: "nowrap" }}>
      ยังไม่มอบหมาย
    </Box>
  );

// ✅ "สถานะงาน" — แทนที่คอลัมน์ "คืบหน้า" เดิม (เลข X/Y เฉยๆ ไม่รู้ว่าตอนนี้อยู่ขั้นไหนจริงๆ) อิงจาก
// event ที่ "เกี่ยวข้องที่สุดตอนนี้" ของแต่ละแถวโดยตรง (ครั้งที่ลงตารางจริงล่าสุด ไม่นับแผนงานล่วงหน้าที่
// ยังไม่มีวันที่) ใช้สี/ความหมายเดียวกับ STATUS_COLOR ที่ใช้ทั่วแอปอยู่แล้ว (ปฏิทิน/หน้าดำเนินงาน) — คงเลข
// จำนวนครั้งที่เสร็จไว้เป็นรายละเอียดรองใน tooltip ไม่ให้ข้อมูลเดิมหายไปเลย
const jobStatusInfo = (c) => {
  const relevantVisit = c.visits
    .filter((v) => !v.unscheduled)
    .sort((a, b) => new Date(b.start || b.date) - new Date(a.start || a.date))[0];
  if (!relevantVisit) return { label: "ยังไม่ลงตาราง", color: "#9ca3af", round: null };
  return {
    label: relevantVisit.status || "กำลังรอยืนยัน",
    color: STATUS_COLOR[relevantVisit.status] || "#9ca3af",
    round: Number(relevantVisit.time) || 1,
  };
};

// ✅ "คืบหน้า" — สัญญาจริงนับเป็นจำนวนครั้งที่ทำเสร็จแล้ว (X/Y) ส่วนงานทั่วไป/โปรเจค/ยังไม่จัดกลุ่มไม่มี
// แนวคิด "หลายครั้ง" จึงใช้สถานะของงานตรงๆ แทน — แยกออกมาเป็นฟังก์ชันกลางเพื่อให้ตารางบนจอกับไฟล์ Excel
// ที่ส่งออกใช้ตรรกะเดียวกันเป๊ะๆ (เดิมเขียนฝังอยู่ในเซลล์ตารางที่เดียว ไฟล์ที่ส่งออกจึงไม่มีคอลัมน์นี้เลย)
// ⚠️ นับความคืบหน้าเป็น "ครั้ง" ไม่ใช่ document — ครั้งที่เข้างานไม่ต่อเนื่อง (หลาย document ต่อครั้ง)
// นับว่าเสร็จก็ต่อเมื่อทุก document ของครั้งนั้นเสร็จหมดแล้ว
const progressInfo = (c, countUsedRoundsFn) => {
  if (!c.isRealContract) {
    const info = jobStatusInfo(c);
    return { label: info.label, color: info.color };
  }
  const byRound = new Map();
  c.visits.filter((v) => !v.unscheduled).forEach((v) => {
    const key = String(v.time);
    if (!byRound.has(key)) byRound.set(key, []);
    byRound.get(key).push(v);
  });
  let doneCount = 0;
  byRound.forEach((docs) => { if (docs.every((d) => d.status === "ดำเนินการเสร็จสิ้น")) doneCount += 1; });
  // 🐛 BUG ที่แก้ (ผู้ใช้แจ้งซ้ำ 2 รอบพร้อมภาพ: "ยังเพี้ยน...ทั้งที่จะเป็น 0/3" — รอบเข้าโชว์ "ปีละ 3
  // ครั้ง" (intervalMonths=4) ชัดเจน แต่คืบหน้ายังค้าง 0/4): เดิม total ยึด c.visitCount เป็นหลักเสมอ
  // ซึ่งเป็นค่าที่บันทึกแยกต่างหาก — sync ตอน commit แก้ intervalMonths ผ่านเซลล์นี้เท่านั้น (ดู
  // commitEdit) สัญญาเก่าที่ตั้ง intervalMonths ไว้ก่อนมีฟีเจอร์นี้ หรือที่กรอกผ่านช่องอื่นโดยไม่เคยกดแก้
  // ตรงนี้เลยสักครั้ง จึงยังค้างค่าเก่าที่ไม่ตรงกับรอบเข้าที่โชว์อยู่ตรงหน้า ดูเหมือนฟีเจอร์ไม่ทำงานทั้งที่
  // อีกจุดก็ทำงานถูกอยู่
  // ✅ ให้ "รอบเข้า" (intervalMonths) เป็นตัวกำหนด total ก่อนเสมอเมื่อหารลงตัว (สัญญาที่นี่ทั้งหมดเป็น
  // สัญญารายปี — ปีละ N ครั้งก็คือจำนวนครั้งทั้งหมดของสัญญานั้นแหละ) วิธีนี้แก้ตรงกันทั้งจอทันทีไม่ว่า
  // สัญญาจะเก่าหรือใหม่ โดยไม่ต้องไล่แก้ทีละใบ/ไม่ต้องยิง API เขียนทับข้อมูลเดิม — หารไม่ลงตัว (เช่น
  // ทุก 5 เดือน) หรือยังไม่ระบุรอบเข้าเลย ถึง fallback ไปที่ visitCount ที่บันทึกไว้เหมือนเดิม
  const total = visitsPerYear(c.intervalMonths) || c.visitCount || countUsedRoundsFn(c.visits);
  return {
    label: `${doneCount}/${total}`,
    color: doneCount === 0 ? "#9ca3af" : doneCount >= total ? STATUS_COLOR["ดำเนินการเสร็จสิ้น"] : "#f59e0b",
  };
};

// ✅ "สถานะสัญญา" — เทียบ contractEnd กับวันนี้ ช่วยเตือนต่ออายุล่วงหน้า แทนต้องไล่เช็คคอลัมน์
// "สิ้นสุด" เองทีละแถว ใช้ทั้งในตารางและไฟล์ CSV ที่ส่งออก (ใช้ฟังก์ชันเดียวกัน กันข้อมูลไม่ตรงกัน)
// ⚠️ contractStatusInfo / isExpiredContract ย้ายไปเป็นของกลางที่ shared/utils/contractOverdue.js แล้ว
// (หน้า "ภาพรวมลูกค้า" ใช้ชุดเดียวกัน) — ห้ามก๊อปกลับมาไว้ที่นี่ ไม่งั้นเกณฑ์จะเพี้ยนไม่ตรงกันอีก

// ค่าแท็บมุมมองทั้งหมดที่ยอมรับจาก ?view= (กันค่าขยะจาก URL ทำให้ตารางว่างเปล่าโดยไม่รู้สาเหตุ)
// ✅ ประวัติการแก้ไขข้อมูลสัญญา — ฝั่ง server push activityLog เข้า "ทุกครั้ง" ในสัญญาพร้อมกัน
// (updateMany) รายการเดียวกันจึงซ้ำอยู่ในทุก visit ต้องรวบแล้วตัดซ้ำก่อนแสดงเสมอ
// ⚠️ ตัดซ้ำด้วย timestamp+detail+ผู้แก้ ไม่ใช่ _id — subdocument ที่ push พร้อมกันคนละ document
// ได้ _id คนละตัวเสมอ ตัดด้วย _id จึงไม่มีอะไรถูกตัดเลยสักรายการ
// ⚠️ ต้องอ่านจากทุก visit ไม่ใช่แค่ visit แรก — ครั้งที่เพิ่มเข้าสัญญาทีหลังจะไม่มีประวัติช่วงก่อนหน้า
const contractEditHistory = (c) => {
  const seen = new Set();
  const out = [];
  for (const v of c?.visits || []) {
    for (const log of v?.activityLog || []) {
      if (log?.action !== "contract_updated") continue;
      const key = `${new Date(log.timestamp).getTime()}|${log.userId || ""}|${log.detail || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(log);
    }
  }
  return out.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

const VIEW_FILTER_VALUES = ["contracts", "overdue", "expired", "general", "project", "ungrouped", "all"];

// ✅ ยืด/หดความกว้างคอลัมน์ได้เองเหมือน Excel — เดิม fix ความกว้างตายตัวทุกคอลัมน์ (CELL_TRUNCATE)
// พอชื่อบริษัท/โครงการยาวๆ ก็โดนตัดด้วย ... เสมอ ต้อง hover ดู tooltip ทุกครั้ง ให้ผู้ใช้ลากขยายเองได้
// ตามที่ต้องการแทน — เก็บลง localStorage ด้วย (ไม่ใช่แค่ state ในหน้านี้) จะได้จำค่าที่ปรับไว้ข้ามการ
// ออกจากหน้า/ปิดแท็บ/เปิดใหม่ ไม่ต้องมาลากปรับความกว้างซ้ำทุกครั้งที่กลับเข้ามาดู
// ✅ ยุบคอลัมน์ที่เกี่ยวข้องกันให้อยู่ช่องเดียว (ซ้อนเป็น 2 บรรทัด) ตามที่ผู้ใช้ขอ — เดิมตารางมี 18
// คอลัมน์ ต้องเลื่อนแนวนอนตลอดและหลายคอลัมน์แคบจนหัวข้อโดนตัดเหลือ "ส..." / "ค..." อ่านไม่ออกว่าคืออะไร
//   เลขที่สัญญา + ใบเสนอราคา        → docRef   (เลขที่เอกสาร)
//   บริษัท + โครงการ                 → customer (ลูกค้า / โครงการ)
//   ประเภทงาน + ระบบ                → work     (งาน)
//   เริ่มต้น + สิ้นสุด + รอบเข้า      → period   (ระยะเวลาสัญญา)
//   จำนวนครั้ง + คืบหน้า             → progress (ครั้ง / คืบหน้า)
// เหลือ 9 คอลัมน์ และหัวตารางเหลือแถวเดียว (ไม่ต้องมีหัวข้อกลุ่มคลุม 2 ชั้นอีกต่อไป)
// ⚠️ ทุกช่องยังแก้ไข inline ได้ครบทุกฟิลด์เหมือนเดิม — EditableCell รับ prop `Wrapper` อยู่แล้ว จึงซ้อน
// หลายฟิลด์ในเซลล์เดียวได้โดยไม่ต้องแก้ตรรกะการแก้ไขเลย
const DEFAULT_COL_WIDTHS = {
  checkbox: 42, actions: 50,
  docRef: 150, docNo: 150,
  customer: 230, work: 165,
  period: 190,
  jobValue: 110, commission: 110, status: 168, progress: 110, responsiblePerson: 130, remark: 190,
  departmentTag: 112,
};
// ✅ ความกว้างคอลัมน์ "แยกกันทุกแท็บ" — เก็บซ้อนอีกชั้นเป็น { [แท็บ]: { [คอลัมน์]: ความกว้าง } }
// ⚠️ เดิมเก็บเป็นชุดเดียวใช้ร่วมกันทุกแท็บ ซึ่งใช้งานจริงไม่ได้เลย เพราะแต่ละแท็บมีคอลัมน์ไม่เหมือนกัน
// (แท็บสัญญามีเลขที่สัญญา/ระยะเวลา/จำนวนครั้ง ส่วนแท็บงานทั่วไปมี "เอกสารเลขที่" มาแทน) ปรับความกว้าง
// ให้พอดีในแท็บหนึ่งแล้วสลับไปอีกแท็บก็เพี้ยนทันที ต้องมาไล่ปรับใหม่ทุกครั้งที่สลับไปมา
// ✅ ใช้คีย์ localStorage ใหม่ (…colWidthsByTab) ไม่ทับของเดิม — ค่าเก่าที่เคยปรับไว้จะถูกละทิ้งไปเอง
// โดยไม่ต้องเขียนโค้ดแปลงข้อมูล (เป็นแค่ค่าความกว้างหน้าจอ ไม่ใช่ข้อมูลผู้ใช้ที่เสียหายไม่ได้) และไม่มี
// ทางอ่านค่าเก่าผิดรูปแบบมาใช้จนพัง เพราะคนละคีย์กันคนละอันเลย
const COL_WIDTHS_STORAGE_KEY = "contractOverview.colWidthsByTab";
const loadStoredColWidths = () => {
  try {
    const raw = localStorage.getItem(COL_WIDTHS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};
// ✅ จอมือถือสลับดูได้ 2 รูปแบบ: "การ์ด" (ค่าเริ่มต้น — อ่านทีละงานครบทุกฟิลด์โดยไม่ต้องเลื่อนซ้ายขวา)
// กับ "ตาราง" (ตารางชุดเดียวกับจอคอมเป๊ะๆ ทั้งคอลัมน์/การแก้ไข inline/ยอดรวมท้ายตาราง — เลื่อนซ้ายขวา
// เอาเพื่อดูคอลัมน์ที่เกินจอ) ⚠️ ไม่ใช่โค้ดคนละชุด: มุมมองตารางบนมือถือคือ JSX ก้อนเดียวกับจอคอม
// เพียงแต่เติม sx เฉพาะมือถือเข้าไป (ตัวอักษรเล็กลง + ตรึงคอลัมน์แรกไว้ให้รู้ว่ากำลังอ่านแถวไหนอยู่)
// จึงไม่มีทางที่ข้อมูล/สิทธิ์แก้ไขของ 2 ฝั่งจะหลุดไม่ตรงกันในอนาคต
const MOBILE_VIEW_STORAGE_KEY = "contractOverview.mobileView";
const loadStoredMobileView = () => {
  try {
    return localStorage.getItem(MOBILE_VIEW_STORAGE_KEY) === "table" ? "table" : "card";
  } catch {
    return "card";
  }
};
// ✅ ความกว้างคอลัมน์ชุดย่อสำหรับ "ตารางบนจอมือถือ" โดยเฉพาะ — ค่าเริ่มต้นของจอคอมถูกตั้งไว้ให้อ่านสบาย
// บนจอกว้าง พอเอามาใช้บนจอ 375px ตารางจะยาวรวมเกิน 1,300px = ต้องปัดหลายรอบมากกว่าจะเห็นครบ ซึ่งเป็น
// สาเหตุหลักที่ผู้ใช้บอกว่า "เลื่อนตารางยาก" ชุดนี้บีบให้เหลือราวๆ 900px โดยไม่ตัดคอลัมน์ไหนทิ้งเลย
// ⚠️ เป็นแค่ "ค่าเริ่มต้นของโหมดมือถือ" — ถ้าผู้ใช้เคยลากปรับความกว้างคอลัมน์นั้นไว้เอง ค่าที่ปรับไว้
// ยังชนะเสมอ (ดู colWidth) ไม่ไปทับของที่ตั้งใจตั้งไว้
const MOBILE_COL_WIDTHS = {
  docRef: 118, docNo: 118,
  customer: 168, work: 128,
  period: 148,
  jobValue: 88, commission: 88, status: 100, progress: 84, responsiblePerson: 104,
  departmentTag: 92,
};
// ✅ จัดกลุ่ม "งานรายครั้ง" ของแถวหนึ่งไว้ล่วงหน้าครั้งเดียว แล้วแคชไว้ตาม reference ของ c.visits
//
// ⚠️ เดิมทุกช่อง "ครั้งที่ N" เรียก c.visits.filter(...).sort(...) เองในตอน render — 1 แถวมีได้ถึง
// 12 ช่อง แปลว่าไล่อ่าน c.visits ซ้ำ 12 รอบต่อแถว ต่อการ render 1 ครั้ง และหน้านี้ render ใหม่ทั้งหน้า
// ทุกครั้งที่ state ใดๆ เปลี่ยน (มี useState 58 ตัวในคอมโพเนนต์เดียว) — แค่กดเปิดกล่องก็คำนวณใหม่หมด
//
// ✅ WeakMap คีย์ด้วยตัว array เอง: contracts มาจาก useMemo อยู่แล้ว c.visits จึงเป็น reference เดิม
// ตราบใดที่ข้อมูลไม่เปลี่ยน — พอข้อมูลเปลี่ยน array ใหม่ก็ไม่เจอในแคชแล้วคำนวณใหม่เองอัตโนมัติ
// (ไม่ต้องเขียนโค้ดล้างแคช ซึ่งเป็นจุดที่พลาดกันบ่อยที่สุดของการทำแคช) และ WeakMap ปล่อยให้ GC เก็บ
// ข้อมูลเก่าได้เองเมื่อไม่มีใครอ้างถึงแล้ว
// ✅ ผลพลอยได้ที่สำคัญ: array ที่คืนกลับมามี reference คงที่ข้าม render — memo() ของ BillingChip
// จึงทำงานได้จริง (ถ้าสร้าง array ใหม่ทุกครั้ง memo จะไม่มีผลเลยเพราะ prop เปลี่ยนตลอด)
const roundVisitsCache = new WeakMap();
const EMPTY_ROUND_VISITS = [];
const visitsByRound = (visits) => {
  let map = roundVisitsCache.get(visits);
  if (map) return map;
  map = new Map();
  visits.forEach((v) => {
    if (v.unscheduled) return;
    const n = Number(v.time) || 1;   // งานที่ไม่เคยเลือกครั้งที่ ให้ตกไปครั้งที่ 1 (เกณฑ์เดิม)
    if (!map.has(n)) map.set(n, []);
    map.get(n).push(v);
  });
  map.forEach((arr) => arr.sort((a, b) => new Date(a.start || a.date) - new Date(b.start || b.date)));
  roundVisitsCache.set(visits, map);
  return map;
};
const roundVisitsOf = (c, n) => visitsByRound(c.visits).get(n) || EMPTY_ROUND_VISITS;

/**
 * ค่าคอมคิดเป็นกี่ % ของมูลค่างาน — ค่าคำนวณสดเพื่อ "อ่านประกอบ" เท่านั้น ไม่เคยถูกบันทึก
 * ⚠️ คืน null เมื่อยังไม่มีมูลค่างาน — 0% กับ "คิดไม่ได้เพราะยังไม่รู้มูลค่างาน" คนละความหมายกัน
 */
const commissionPct = (c) => {
  const base = Number(c.jobValue);
  const com = Number(c.commission);
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(com) || com <= 0) return null;
  const pct = (com / base) * 100;
  // ทศนิยม 2 ตำแหน่งเฉพาะตอนที่ปัดเป็นจำนวนเต็มแล้วเพี้ยน — ไม่งั้นได้ "10.00%" รกตา
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}% ของมูลค่างาน`;
};

/** หัวข้อกล่องเอกสาร — บอกให้ครบว่ากำลังดูเอกสารของงานไหน ครั้งไหน */
const docsTitleFor = (c, n) =>
  [c.isRealContract ? `ครั้งที่ ${n}` : null, c.company, c.site, c.title]
    .filter(Boolean).join(" · ");

// ⚠️ ต้องอยู่นอก component — เดิมประกาศไว้ข้างในทำให้ได้ Set ตัวใหม่ทุก render ซึ่งไปทำให้
// useCallback ที่อ้างถึงมันเปลี่ยน reference ทุกครั้งตามไปด้วย แล้ว memo ของแถวตารางก็พังทั้งสาย
// (ค่าคงที่ล้วน ไม่มีเหตุผลต้องอยู่ใน component ตั้งแต่แรก)
const BASIC_INFO_FIELDS = new Set(["company", "site", "system", "title"]);

const VISIT_COL_DEFAULT_WIDTH = 110;
// 🐛 BUG ที่แก้ (ผู้ใช้แจ้งพร้อมภาพ: ตารางบนมือถือ "ไม่เพี้ยน" — วันที่ขาดตัวเลข "20 – 26 ส.ค. 2569"
// เห็นเป็น "0 – 26 ส.ค. 2569", ชื่อทีมชนกับป้ายวางบิล/เอกสารจนอ่านไม่ออก): เดิม 94px แคบเกินไปสำหรับ
// เนื้อหาจริงในเซลล์ "ครั้งที่ N" (วันที่ช่วงเดือนเดียวกันยาวสุดถึง "DD – DD MMM YYYY" ~18 ตัวอักษร +
// ชื่อทีม + ชิปวางบิล/เอกสาร) — ข้อความจัดกึ่งกลาง (align="center") ทับ overflow:hidden พอกว้างไม่พอ
// เบราว์เซอร์ตัดจากทั้ง 2 ฝั่งของกึ่งกลางเท่าๆ กัน (ไม่ใช่ตัดท้ายแบบมี "..." ให้เห็น) ตัวเลขต้นวันที่
// จึงหายไปเงียบๆ โดยไม่มีสัญญาณว่าถูกตัด ✅ ขยายให้พอกับเนื้อหาจริง — โหมดตารางบนมือถือเลื่อนซ้าย-ขวา
// อยู่แล้วเป็นปกติ (มีปุ่มลูกศร + คำแนะนำ "ปัดซ้าย-ขวา" อยู่แล้ว) กว้างขึ้นอีกหน่อยต่อคอลัมน์จึงไม่เสียอะไร
// แลกกับอ่านออกครบทุกตัวอักษรจริงๆ
const MOBILE_VISIT_COL_WIDTH = 132;
const MIN_COL_WIDTH = 50;

const AUTO_FIT_PADDING = 20; // ✅ กันเนื้อหาแนบขอบเซลล์พอดีเป๊ะจนดูอึดอัดหลัง auto-fit

// ✅ resizable=false — ปิดแถบลากปรับความกว้างทั้งหมด ใช้กับ "ตารางบนจอมือถือ" โดยเฉพาะ
// ⚠️ นี่คือสาเหตุตรงๆ อีกข้อที่ทำให้ปัดเลื่อนตารางบนมือถือยาก: แถบลากเป็น Box กว้าง 24px คร่อมขอบขวา
// ของหัวคอลัมน์ทุกคอลัมน์ และตั้ง touchAction:"none" ไว้ (จำเป็นสำหรับการลาก) — ผลคือทั้งแถวหัวตาราง
// มีแถบ "ห้ามเบราว์เซอร์เลื่อน" ขวางอยู่เป็นระยะๆ นิ้วที่ปัดโดนแถบพวกนี้เข้าจะไม่เลื่อนตารางเลย
// กลายเป็นเริ่มลากปรับความกว้างคอลัมน์แทน ซึ่งบนจอเล็กแทบไม่มีใครตั้งใจจะทำอยู่แล้ว (จิ้มให้ตรง 24px
// ด้วยนิ้วยากมาก) — ตัดทิ้งไปเลยบนมือถือ แล้วใช้ค่าความกว้างชุดย่อ (MOBILE_COL_WIDTHS) แทน
const ResizableTh = ({ width, align = "left", children, onResize, rowSpan = 1, columnKey, tableRef, sortable = false, sortDirection = null, onSort, resizable = true }) => {
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
      {/* 🐛 BUG ที่แก้ (คำอธิบายบังข้อมูลแถวแรก): ทูลทิปของ MUI วางไว้ "ด้านล่าง" ตัวที่ชี้เป็นค่าเริ่มต้น
          ตัวจับปรับความกว้างอยู่ที่หัวตาราง กล่องดำๆ ของทูลทิปจึงไปคลุมทับเซลล์แถวแรกพอดี (ช่องวันที่
          สัญญา/มูลค่างาน) — แค่เอาเมาส์ผ่านขอบคอลัมน์ก็บังข้อมูลและกดเซลล์แถวแรกไม่ได้ ต้องขยับเมาส์
          หนีก่อนทุกครั้ง ✅ ย้ายไปแสดงด้านบนหัวตารางแทน ซึ่งเป็นที่ว่างอยู่แล้ว ไม่ทับอะไรเลย */}
      {resizable && (
      <Tooltip title="ลากเพื่อปรับความกว้าง · ดับเบิลคลิก/แตะ 2 ครั้งเพื่อพอดีอัตโนมัติ" enterDelay={500} placement="top">
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
      )}
    </TableCell>
  );
};

// ✅ แก้ไขข้อมูลสัญญาได้ตรงในช่องตารางเลยเหมือน Excel (ไม่ต้องเปิด dialog แยก) — ใช้ได้เฉพาะแถวที่
// เป็นสัญญาจริง (isRealContract) เท่านั้น เพราะอิงจากการอัปเดตผ่าน contractGroupId ซึ่งงานเก่าที่ยัง
// ไม่จัดกลุ่มไม่มี — ต้องอยู่นอกคอมโพเนนต์หลัก (module scope) ไม่งั้นทุก re-render จะได้ function
// identity ใหม่ ทำให้ React มองเป็นคนละคอมโพเนนต์แล้ว unmount/remount ช่องที่กำลังพิมพ์อยู่ (โฟกัสหลุด)
/**
 * ✅ ตัวเลือกด่วน "เข้าปีละกี่ครั้ง" — กดชิปแล้วตั้งค่า "รอบเข้า" (intervalMonths) ให้ทันที แทนที่จะ
 * ต้องคิดเลขเองว่า "ปีละ 4 ครั้ง" ต้องกรอกเลขเดือนเท่าไหร่ (ตามที่ผู้ใช้ขอ: "แก้ไขจำนวนครั้งที่เข้า
 * ต่อปีได้ด้วย") ใช้ร่วมกันทั้งช่องแก้ไขในตาราง/การ์ด (ผ่าน editType="intervalMonths" ใน EditableCell)
 * และฟอร์ม "เพิ่มสัญญาใหม่"/"ย้ายเข้าสัญญาที่มีอยู่" — ทุกจุดพูดหน่วยเดียวกัน
 *
 * ⚠️ ไม่ได้แทนที่ช่องกรอกจำนวนเดือนแบบตัวเลขทิ้ง — ตั้งใจวางคู่กัน: ชิปเป็นทางลัดสำหรับ 6 รอบที่พบบ่อย
 * ที่สุด (ปีละ 12/6/4/3/2/1 ครั้ง) ส่วนช่องตัวเลขข้างล่างยังกรอกรอบที่ไม่ลงตัว (เช่น ทุก 5 เดือน) ได้
 * เหมือนเดิมทุกประการ — สัญญาบางฉบับมีรอบเข้าไม่ปกติจริงๆ (ดูคอมเมนต์ที่ visitsPerYear())
 * ⚠️ ต้องอยู่ module scope เหมือน EditableCell/FieldRow ด้านล่าง ไม่งั้นทุก re-render ของ
 * ContractOverview จะได้ function identity ใหม่ ทำให้ React unmount/remount ชิปทิ้งทุกครั้ง
 * (โฟกัส/hover state หลุด แม้ไม่ใช่ input ที่พิมพ์อยู่ก็เสียความลื่นไหลโดยไม่จำเป็น)
 */
const IntervalMonthsQuickPicks = ({ value, onPick, disabled, size = "small" }) => (
  <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
    {INTERVAL_MONTHS_PRESETS.map((p) => {
      const selected = String(value) === String(p.months);
      return (
        <Chip
          key={p.months}
          label={`ปีละ ${p.perYear} ครั้ง`}
          size={size}
          disabled={disabled}
          onClick={() => onPick(String(p.months))}
          // 🐛 BUG ที่แก้ (กดชิปในตาราง/การ์ดแล้วไม่บันทึกเลย): ช่องกรอกจำนวนเดือนที่วางคู่กันมี
          // onBlur={commit} — คลิกชิปทำให้ช่องนั้นเสียโฟกัส "ก่อน" event คลิกของชิปเองจะยิง (ลำดับ
          // เบราว์เซอร์ปกติ: mousedown ที่ปุ่มอื่นสั่ง blur ทันที ก่อน click จะเกิดด้วยซ้ำ) — onBlur
          // เห็นค่าเดิมที่ยังไม่เปลี่ยน (draft ค่าเก่า) จึงมองว่า "ไม่มีอะไรเปลี่ยน" แล้วปิดโหมดแก้ไขทิ้ง
          // (commitEdit เซ็ต editingCell=null) ก่อนที่ onClick ของชิปจะยิง onCommit ค่าใหม่จริงตามมา —
          // commitEdit เช็ค editingCell ที่ null ไปแล้วนั้น จึง return ทันทีแบบเงียบๆ ไม่บันทึกอะไรเลย
          // ✅ preventDefault ตอน mousedown กันไม่ให้โฟกัสหลุดจากช่องกรอกเลยตั้งแต่ต้น (เทคนิคมาตรฐาน
          // เดียวกับที่ MUI Autocomplete ใช้กันตัวเลือกใน dropdown ปิดตัวเองตอนคลิก) — onClick ของชิป
          // ยังทำงานตามปกติ แค่ไม่มี blur แทรกมาก่อนอีกต่อไป
          onMouseDown={(e) => e.preventDefault()}
          title={p.label}
          sx={{
            fontSize: size === "small" ? "0.68rem" : "0.72rem",
            fontWeight: 700,
            height: size === "small" ? 22 : 26,
            bgcolor: selected ? ACCENT : alpha(ACCENT, 0.08),
            color: selected ? "#fff" : ACCENT,
            "&:hover": { bgcolor: selected ? ACCENT : alpha(ACCENT, 0.16) },
          }}
        />
      );
    })}
  </Stack>
);

// ✅ Wrapper (default TableCell) — ให้ใช้ตัวเดียวกันได้ทั้งในตารางเดสก์ท็อป (TableCell จริง) และการ์ด
// บนมือถือ (Box ธรรมดา ไม่มี <table> ห่ออยู่) โดยไม่ต้องแยกโค้ด edit/select/autocomplete ซ้ำสองที่ —
// ดู renderMobileCard ด้านล่างที่เรียกใช้ตัวนี้ซ้ำกับ Wrapper={Box}
/**
 * ⚠️ ระหว่างแก้ไข ช่องนี้ถือ "ค่าที่กำลังพิมพ์" ไว้เองใน state ของตัวเอง (draft) ไม่ได้ยิงขึ้นไปให้
 * คอมโพเนนต์แม่ทุกตัวอักษร
 *
 * 🐛 ปัญหาที่แก้ (พิมพ์แล้วหน่วงทั้งหน้า): เดิม value ของ input ผูกกับ state `editValue` ที่อยู่ใน
 * ContractOverview (ไฟล์ 5,000 บรรทัด มี useState 58 ตัว) — พิมพ์ 1 ตัวอักษร = setState ที่แม่ =
 * ทั้งหน้า render ใหม่ทั้งหมด: 10 แถว × ~20 ช่อง + Tooltip นับร้อย + กล่องทุกใบ ต่อ "ทุกตัวอักษร"
 * ✅ ตอนนี้พิมพ์อยู่ในช่องนี้ล้วนๆ แม่ไม่รู้เรื่องเลยจนกว่าจะกด Enter / คลิกออก (onCommit) ซึ่งเป็น
 * จังหวะที่ต้องยิง API อยู่แล้ว
 * ⚠️ ยังส่ง onChangeValue ต่อให้แม่ด้วย (ถ้ามี) เพื่อไม่ให้จุดที่ยังอ่าน editValue อยู่พัง — แต่จุดที่
 * เป็น hot path จริง (ตารางหลัก) ไม่ได้ส่ง onChangeValue มาแล้ว
 */
const EditableCell = ({
  value, editing, editValue, editType = "text", editOptions, width, align, editable, saving,
  formatDisplay, title, onStartEdit, onChangeValue, onCommit, onCancel, columnKey, Wrapper = TableCell, placeholder,
  // ✅ allowEmpty=false — ช่องที่ "ต้องมีค่าเสมอ" (เช่น แผนก ซึ่ง server ปฏิเสธค่าว่างอยู่แล้ว) ไม่ต้องมี
  // ตัวเลือก "— ไม่ระบุ —" ให้เลือกไปแล้วเจอ error กลับมา
  allowEmpty = true,
  // ✅ noClip — ปิดการตัดข้อความบรรทัดเดียว (nowrap + ellipsis) สำหรับช่องที่ "ข้อความคือเนื้อหา" จริงๆ
  // เช่นรายชื่อช่องที่ยังไม่ได้กรอกในการ์ดมือถือ ซึ่งถ้าโดนตัดเหลือ "..." ก็เท่ากับไม่ได้บอกอะไรเลย
  // ⚠️ ไม่เปิดเป็นค่าเริ่มต้น — ตารางเดสก์ท็อปต้องคุมความสูงแถวให้เท่ากันทุกแถว ไม่งั้นกวาดสายตาไม่ได้
  noClip = false,
}) => {
  const [draft, setDraft] = useState(editValue ?? "");
  // 🐛 BUG ที่แก้ (กดแล้วปฏิทินเด้งแล้วหายทันที): popup ของ DatePicker ทำให้ช่องกรอกเสียโฟกัส
  // ทันทีที่เปิด — ถ้าเก็บสถานะนี้ไว้ใน useState ค่าจะยังไม่อัปเดตในรอบ event เดียวกัน (React รวม
  // setState ไว้) onBlur จึงยังเห็นค่าเก่าแล้วสั่ง commit() ปิดโหมดแก้ไขทิ้ง = ปฏิทินถูก unmount
  // ทันทีที่เพิ่งเปิด ✅ ref เซ็ตค่าได้ทันทีโดยไม่ต้องรอรอบ render ถัดไป
  const pickerOpenRef = useRef(false);
  // ⚠️ seed ใหม่ทุกครั้งที่ "เพิ่งเข้าโหมดแก้ไข" เท่านั้น — ถ้า sync ทุกครั้งที่ editValue เปลี่ยน
  // ค่าที่พิมพ์อยู่จะโดนเขียนทับกลับไปเรื่อยๆ จนพิมพ์ไม่ได้
  const wasEditing = useRef(false);
  useEffect(() => {
    if (editing && !wasEditing.current) setDraft(editValue ?? "");
    wasEditing.current = editing;
  }, [editing, editValue]);

  const change = (v) => { setDraft(v); onChangeValue?.(v); };
  const commit = () => onCommit?.(draft);

  const baseSx = {
    width, maxWidth: width,
    ...(noClip ? {} : { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }),
    ...(align ? { textAlign: align } : {}),
  };

  if (!editable) {
    return <Wrapper align={align} title={title} data-col-key={columnKey} sx={baseSx}>{formatDisplay ? formatDisplay(value) : (value || <Dash />)}</Wrapper>;
  }

  if (!editing) {
    return (
      <Wrapper
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
      </Wrapper>
    );
  }

  return (
    <Wrapper align={align} data-col-key={columnKey} sx={{ width, p: "2px 4px" }}>
      {editType === "select" ? (
        <TextField
          select autoFocus size="small" fullWidth value={draft} disabled={saving}
          onChange={(e) => change(e.target.value)}
          onBlur={commit}
          SelectProps={{ native: true }}
          sx={{ "& .MuiOutlinedInput-input": { py: 0.5, fontSize: "0.8rem" } }}
        >
          {allowEmpty && <option value="">— ไม่ระบุ —</option>}
          {/* ✅ รองรับทั้งรายการสตริงเปล่าๆ (ค่าที่แสดง = ค่าที่บันทึก เช่น ชื่อทีม) และแบบ
              { value, label } (ค่าที่บันทึกกับป้ายที่คนอ่านคนละอัน เช่น แผนก: "sales" → "ฝ่ายขาย")
              — ห้ามบันทึกป้ายภาษาไทยลงฐานข้อมูลเด็ดขาด server รับเฉพาะค่าใน enum เท่านั้น */}
          {(editOptions || []).map((o) => {
            const val = typeof o === "object" ? o.value : o;
            const label = typeof o === "object" ? o.label : o;
            return <option key={val} value={val}>{label}</option>;
          })}
        </TextField>
      ) : editType === "autocomplete" ? (
        // ✅ เลือกจากรายชื่อที่มีอยู่แล้วในระบบได้ (กันพิมพ์ผิด/สะกดต่างกันจนกลายเป็นคนละชื่อ) หรือจะ
        // พิมพ์เอาใหม่เองก็ได้ (freeSolo — ไม่บังคับต้องมีในรายการเดิม เผื่อเป็นระบบ/ประเภทงานใหม่จริงๆ
        // ที่ยังไม่เคยมีใครกรอกไว้) เทียบ pattern เดียวกับฟอร์ม "เพิ่มสัญญาใหม่" ด้านล่างเป๊ะๆ
        <Autocomplete
          freeSolo autoFocus size="small" fullWidth disabled={saving}
          options={editOptions || []}
          inputValue={draft}
          onInputChange={(_, v) => change(v)}
          renderInput={(params) => (
            <TextField
              {...params}
              autoFocus
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commit(); }
                if (e.key === "Escape") onCancel();
              }}
              sx={{ "& .MuiOutlinedInput-input": { py: 0.5, fontSize: "0.8rem" } }}
            />
          )}
        />
      ) : editType === "date" ? (
        // ✅ ปฏิทิน พ.ศ. เต็มรูปแบบแทน <input type="date"> ของเบราว์เซอร์ ซึ่งบังคับให้แสดง พ.ศ.
        // ไม่ได้ และลำดับวัน/เดือนก็เปลี่ยนไปตามภาษาของเครื่องผู้ใช้ (ดู ThaiDatePicker)
        // ✅ autoOpen — คลิกช่องในตารางครั้งเดียวต้องได้ปฏิทินเลย ไม่ใช่ต้องคลิกซ้ำอีกทีที่ไอคอน
        <ThaiDatePicker
          value={draft}
          onChange={change}
          autoOpen
          onOpen={() => { pickerOpenRef.current = true; }}
          onClose={() => { pickerOpenRef.current = false; }}
          // ✅ เลือกวันจากปฏิทินเสร็จ = บันทึกเลย ไม่ต้องให้ผู้ใช้ไปคลิกที่อื่นเพื่อยืนยันอีกที
          // ⚠️ ส่งค่าที่เพิ่งเลือกเข้า onCommit ตรงๆ ไม่ใช้ draft เพราะ setState ยังไม่ทันมีผล
          onAccept={(v) => onCommit?.(v && v.isValid() ? v.format("YYYY-MM-DD") : "")}
          disabled={saving}
          textFieldProps={{
            onBlur: () => { if (!pickerOpenRef.current) commit(); },
            onKeyDown: (e) => {
              if (e.key === "Enter") { e.preventDefault(); commit(); }
              if (e.key === "Escape") onCancel();
            },
            sx: { "& .MuiOutlinedInput-input": { py: 0.5, fontSize: "0.8rem" } },
          }}
        />
      ) : editType === "intervalMonths" ? (
        // ✅ "รอบเข้า" — ชิปเลือกด่วนเป็นจำนวนครั้ง/ปี วางคู่กับช่องกรอกจำนวนเดือนแบบเดิม (ดูเหตุผลที่
        // IntervalMonthsQuickPicks ด้านบนไฟล์) กดชิปแล้วบันทึกทันทีโดยไม่ต้องกดออกจากช่องก่อน
        <Stack spacing={0.5}>
          <TextField
            autoFocus size="small" fullWidth type="number" disabled={saving}
            value={draft}
            onChange={(e) => change(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commit(); }
              if (e.key === "Escape") onCancel();
            }}
            inputProps={{ min: 1, max: 24 }}
            sx={{ "& .MuiOutlinedInput-input": { py: 0.5, fontSize: "0.8rem" } }}
          />
          <IntervalMonthsQuickPicks
            value={draft}
            disabled={saving}
            onPick={(months) => { change(months); onCommit?.(months); }}
          />
        </Stack>
      ) : (
        <TextField
          autoFocus size="small" fullWidth type={editType} disabled={saving}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => change(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            if (e.key === "Escape") onCancel();
          }}
          sx={{ "& .MuiOutlinedInput-input": { py: 0.5, fontSize: "0.8rem" } }}
        />
      )}
    </Wrapper>
  );
};

// ✅ 1 แถวข้อมูล = ป้ายชื่อฟิลด์ + EditableCell (Wrapper={Box}) — ใช้ในการ์ดมือถือแทนคอลัมน์ตาราง
// เดสก์ท็อป ให้ทุกฟิลด์อ่านง่าย/แก้ไขได้เหมือนกันทุกประการ แค่จัดวางแนวตั้งแทนแนวนอน (ไม่ต้องเลื่อนจอ
// ซ้าย-ขวาหาข้อมูลเหมือนตารางเดิมบนจอแคบ)
const FieldRow = ({ label, hideIfEmptyReadOnly, ...cellProps }) => {
  if (hideIfEmptyReadOnly && !cellProps.editable && !cellProps.value) return null;
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 0.6, minHeight: 34, borderBottom: "1px solid", borderColor: alpha("#0f172a", 0.06) }}>
      <Typography variant="caption" sx={{ width: 96, flexShrink: 0, color: "text.secondary", fontWeight: 700, fontSize: "0.72rem" }}>{label}</Typography>
      <EditableCell Wrapper={Box} width="100%" {...cellProps} />
    </Stack>
  );
};

// ✅ 1 ช่องในแถบสรุปหัวการ์ดมือถือ (ประเภทงาน / ระบบ / มูลค่างาน) — ป้ายกำกับตัวเล็กด้านบน ค่าด้านล่าง
// วางเรียงแนวนอน 3 ช่องจบในบรรทัดเดียว ต่างจาก FieldRow ที่เป็นป้าย-ค่าแนวนอนทีละแถว (ยาวเกินไปถ้าเอามา
// ไว้ในหัวการ์ดที่ต้องกระชับ) ⚠️ ต้องอยู่ module scope เหมือน EditableCell/FieldRow ไม่งั้นทุก re-render
// React จะมองเป็นคนละคอมโพเนนต์แล้ว remount ช่องที่กำลังพิมพ์อยู่จนโฟกัสหลุด
const CardMetaCell = ({ label, align, children }) => (
  <Box sx={{ minWidth: 0, textAlign: align || "left" }}>
    <Typography
      variant="caption"
      sx={{ display: "block", color: "text.secondary", fontWeight: 700, fontSize: "0.62rem", lineHeight: 1.6, letterSpacing: "0.02em" }}
    >
      {label}
    </Typography>
    {children}
  </Box>
);

// ✅ ค่าเริ่มต้นของ "ฟอร์มสร้างสัญญา" — ใช้ร่วมกันทั้งไดอะล็อก "เพิ่มสัญญาใหม่" และแถวร่างในตาราง
// ✅ วันที่เข้างานครั้งที่ 1 — ไม่บังคับ (บางสัญญายังไม่รู้วันที่แน่นอนตอนสร้าง) กรอกมาจะลงตารางเป็น
// ครั้งที่ 1 จริงทันที ไม่กรอกจะบันทึกเป็นฉบับร่าง (unscheduled) — ฉบับร่างของสัญญาจะไม่โผล่ใน
// แผงงานล่วงหน้าของหน้าปฏิทินเลย (ดู visibleDrafts ใน EventCalendar/index.js) กันไม่ให้ถูกลบทิ้ง
// แบบไม่ตั้งใจจากที่นั่นจนสัญญาทั้งอันหายไปจากตาราง (ดู groupEventsByContract) — จัดการ/เพิ่มวันที่
// ครั้งที่ 1 ได้ที่ปุ่ม + ในตารางนี้เท่านั้น (ยังมี safeguard คำเตือนซ้ำอีกชั้นที่ handleDeleteDraftClick
// เผื่อกรณีอื่นที่เข้าถึงฉบับร่างนี้ได้)
const EMPTY_CONTRACT_FORM = {
  company: "", site: "", title: "", system: "", responsiblePerson: "", firstVisitTeam: "",
  contractNo: "", quotationNo: "", contractStart: "", contractEnd: "", visitCount: "", intervalMonths: "", jobValue: "",
  firstVisitStart: "", firstVisitEnd: "",
};

// ✅ ช่องกรอกในแถวร่างใช้ทรง "ขีดเส้นใต้" (variant standard) ไม่ใช่กล่องขอบสี่เหลี่ยม — กล่องมีขอบครบ
// 4 ด้าน 10 กล่องเรียงกันในแถวเดียวกลายเป็นตารางซ้อนตาราง ตัวหนังสือในกล่องเล็กจนอ่านยากและหน้าตา
// เหมือนฟอร์มยุคเก่า — แบบขีดเส้นใต้ทำให้ค่าที่กรอกแล้วอ่านเหมือน "ข้อความในตาราง" ปกติ เหลือแค่เส้นประ
// บางๆ ใต้ช่องไว้บอกว่า "ตรงนี้กรอกได้" แล้วเส้นจะเข้มเป็นสีแบรนด์ตอนโฟกัส
const INLINE_FIELD_SX = {
  "& .MuiInput-root": {
    fontSize: "0.82rem",
    "&:before": { borderBottom: `1px dashed ${alpha("#0f172a", 0.22)}` },
    "&:hover:not(.Mui-disabled):before": { borderBottom: `1px solid ${alpha(ACCENT, 0.55)}` },
    "&:after": { borderBottom: `2px solid ${ACCENT}` },
  },
  "& .MuiInput-input": { py: 0.3 },
  "& input::placeholder": { fontSize: "0.74rem", opacity: 0.75 },
};

// ─── แถวร่าง "เพิ่มสัญญาใหม่" ท้ายตาราง ────────────────────────────────────
// ⚠️ ต้องเป็นคอมโพเนนต์แยกที่ module scope และ "ถือค่าที่กำลังพิมพ์ไว้เป็น state ของตัวเอง" ไม่ใช่เขียนลง
// state ของหน้าหลัก — เดิมทุกตัวอักษรที่พิมพ์ไป setForm ของ ContractOverview ทำให้ทั้งหน้าเรนเดอร์ใหม่
// (ตาราง 10 แถว × 12 ช่อง ที่แต่ละช่องมี sx ของตัวเอง ซึ่ง MUI ต้องคำนวณ CSS ใหม่ทุกครั้ง) พิมพ์ทีเดียว
// เลยหน่วงทั้งหน้า — ตอนนี้พิมพ์แล้วเรนเดอร์ใหม่แค่แถวนี้แถวเดียว ส่วนหน้าหลักไม่ถูกแตะเลยจนกว่าจะกดบันทึก
// ⚠️ อยู่ module scope เหมือน EditableCell/FieldRow ด้วยเหตุผลเดียวกัน — ถ้าประกาศข้างในหน้าหลัก ทุก
// re-render React จะมองเป็นคนละคอมโพเนนต์แล้ว remount ช่องที่กำลังพิมพ์อยู่จนโฟกัสหลุด
const InlineAddRow = ({
  showCheckboxes, hideContractOnlyColumns, visitColumns, totalColCount,
  siteOptions, companyOptions, titleOptions, systemOptions, teamOptions,
  suggestContractNo, isContractNoTaken, saving, formError, onSave, onCancel,
}) => {
  // เลขที่สัญญาแนะนำคำนวณ "ครั้งเดียวตอนแถวโผล่" (useState initializer) ไม่ใช่ทุก re-render
  const [draft, setDraft] = useState(() => ({ ...EMPTY_CONTRACT_FORM, contractNo: suggestContractNo() }));
  const set = (field) => (val) => setDraft((d) => ({ ...d, [field]: val }));

  const badRange = Boolean(draft.contractStart && draft.contractEnd && moment(draft.contractEnd).isBefore(moment(draft.contractStart)));
  const noTaken = isContractNoTaken(draft.contractNo);
  // ✅ บอกตรงๆ ว่า "ยังขาดอะไร" แทนที่จะปล่อยให้ปุ่มบันทึกเป็นสีเทาเฉยๆ แล้วต้องเดาเองว่าทำไมกดไม่ได้
  const missing = [];
  if (!draft.site.trim()) missing.push("โครงการ");
  if (!draft.title.trim()) missing.push("ประเภทงาน");
  if (!draft.system.trim()) missing.push("ระบบ");
  if (!draft.visitCount) missing.push("จำนวนครั้ง");
  const blocked = missing.length > 0 || badRange || noTaken;

  // ช่องเลือก/พิมพ์เอง 4 ช่อง (โครงการ/บริษัท/ประเภทงาน/ระบบ) — โครงสร้างเหมือนกันหมด ต่างแค่ตัวเลือก
  const suggestField = (field, options, placeholder, extraSx, autoFocus) => (
    <Autocomplete
      freeSolo fullWidth options={options} inputValue={draft[field]}
      onInputChange={(_, v) => set(field)(v)}
      // ปุ่มลูกศรกินที่ในคอลัมน์แคบๆ และไม่จำเป็น — รายการตัวเลือกเด้งเองตอนพิมพ์อยู่แล้ว
      forcePopupIcon={false}
      renderInput={(params) => (
        <TextField {...params} variant="standard" placeholder={placeholder} autoFocus={autoFocus} sx={{ ...INLINE_FIELD_SX, ...extraSx }} />
      )}
    />
  );

  return (
    <>
      {/* ⚠️ ช่องที่ไม่ได้กรอกตอนสร้าง (สถานะสัญญา/ครั้งที่ N) ใส่ขีดจางๆ ไว้เฉยๆ — เดิมใส่ข้อความอธิบาย
          ไว้ในช่องพวกนี้ กลายเป็นตัวหนังสือเล็กๆ กระจายเต็มแถวแย่งสายตาไปจากช่องที่ต้องกรอกจริง */}
      <TableRow
        sx={{
          bgcolor: alpha(ACCENT, 0.035),
          "& td": { py: 0.75, borderBottom: "none", verticalAlign: "middle" },
          // แถบสีที่ขอบซ้ายสุด = "แถวนี้ไม่ใช่ข้อมูลจริง กำลังสร้างอยู่" เห็นแวบเดียวก็แยกออก
          "& td:first-of-type": { boxShadow: `inset 3px 0 0 ${ACCENT}` },
          // ✅ โผล่มาแบบเลื่อนลงสั้นๆ — ไม่ใช่กระตุกโผล่ทันทีจนดูเหมือนหน้าค้างแล้วเด้ง
          "@keyframes coDraftIn": { from: { opacity: 0, transform: "translateY(-6px)" }, to: { opacity: 1, transform: "none" } },
          animation: "coDraftIn .16s ease-out",
        }}
      >
        {showCheckboxes && <TableCell padding="checkbox" />}
        {/* ✅ แผนกของแถวที่กำลังสร้าง — ตั้งต้นเป็นฝ่ายบริการเสมอตามค่าเริ่มต้นของทั้งระบบ เปลี่ยนทีหลัง
            ได้ด้วยการคลิกที่ป้ายในแถวปกติ (ไม่ทำเป็นช่องกรอกตรงนี้ เพราะแถวสร้างใหม่ควรถามเฉพาะข้อมูล
            ที่ "ต้องรู้ตั้งแต่แรก" เท่านั้น) ⚠️ ต้องมีช่องนี้ไว้ ไม่งั้นคอลัมน์ทั้งแถวเลื่อนไป 1 ช่อง */}
        <TableCell align="center"><DepartmentPill value={DEPARTMENT.SERVICE} /></TableCell>
        {!hideContractOnlyColumns && (
          <TableCell>
            <TextField
              fullWidth variant="standard" placeholder="เลขที่สัญญา" value={draft.contractNo}
              onChange={(e) => set("contractNo")(e.target.value)} error={noTaken}
              sx={INLINE_FIELD_SX}
            />
            <TextField
              fullWidth variant="standard" placeholder="ใบเสนอราคา" value={draft.quotationNo}
              onChange={(e) => set("quotationNo")(e.target.value)}
              sx={{ ...INLINE_FIELD_SX, mt: 0.5 }}
            />
          </TableCell>
        )}
        {hideContractOnlyColumns && <TableCell><Dash /></TableCell>}
        <TableCell>
          {suggestField("site", siteOptions, "โครงการ *", null, true)}
          {suggestField("company", companyOptions, "บริษัท", { mt: 0.5 })}
        </TableCell>
        <TableCell>
          {suggestField("title", titleOptions, "ประเภทงาน *")}
          {suggestField("system", systemOptions, "ระบบ *", { mt: 0.5 })}
        </TableCell>
        {!hideContractOnlyColumns && (
          <TableCell>
            {/* ✅ ช่องวันที่ 2 ช่องซ้อนกันโดยไม่มีป้ายกำกับ = แยกไม่ออกว่าอันไหนเริ่ม อันไหนสิ้นสุด
                (ทั้งคู่ขึ้น dd/mm/yyyy เหมือนกันเป๊ะตอนยังว่าง) — ติดป้ายสั้นๆ ไว้หน้าช่องเลย */}
            {[
              { label: "เริ่ม", field: "contractStart", error: false },
              { label: "ถึง", field: "contractEnd", error: badRange },
            ].map((d, i) => (
              <ThaiDatePicker
                key={d.field}
                variant="standard"
                value={draft[d.field]}
                onChange={set(d.field)}
                error={d.error}
                textFieldProps={{
                  InputProps: {
                    startAdornment: (
                      <Box component="span" sx={{ fontSize: "0.68rem", color: "text.disabled", mr: 0.75, flexShrink: 0, width: 20 }}>
                        {d.label}
                      </Box>
                    ),
                  },
                  sx: { ...INLINE_FIELD_SX, ...(i > 0 ? { mt: 0.5 } : {}) },
                }}
              />
            ))}
          </TableCell>
        )}
        <TableCell>
          <TextField
            fullWidth variant="standard" type="number" placeholder="มูลค่า" value={draft.jobValue}
            onChange={(e) => set("jobValue")(e.target.value)}
            inputProps={{ min: 0, style: { textAlign: "right" } }}
            InputProps={{ startAdornment: <InputAdornment position="start" sx={{ mr: 0.25, "& p": { fontSize: "0.8rem" } }}>฿</InputAdornment> }}
            sx={INLINE_FIELD_SX}
          />
        </TableCell>
        {!hideContractOnlyColumns && <TableCell align="center"><Dash /></TableCell>}
        {/* คอลัมน์ "คืบหน้า" ของแถวปกติคือ X/Y ครั้ง — ตอนสร้างจึงเป็นที่ของ "Y" (จำนวนครั้งทั้งหมด) */}
        <TableCell align="center">
          <TextField
            fullWidth variant="standard" type="number" placeholder="กี่ครั้ง *" value={draft.visitCount}
            onChange={(e) => set("visitCount")(e.target.value)}
            inputProps={{ min: 1, max: MAX_VISIT_COUNT, style: { textAlign: "center" } }}
            sx={INLINE_FIELD_SX}
          />
        </TableCell>
        {visitColumns.map((n) => <TableCell key={n} align="center"><Dash /></TableCell>)}
        <TableCell>
          <TextField
            select fullWidth variant="standard" value={draft.responsiblePerson}
            onChange={(e) => set("responsiblePerson")(e.target.value)}
            SelectProps={{ native: true }}
            sx={INLINE_FIELD_SX}
          >
            <option value="">ผู้รับผิดชอบ</option>
            {teamOptions.map((name) => <option key={name} value={name}>{name}</option>)}
          </TextField>
        </TableCell>
        {/* ✅ ช่องหมายเหตุของแถวที่กำลังสร้าง — เว้นไว้ก่อนได้ กรอกทีหลังในแถวปกติก็ได้
            ⚠️ ต้องมีช่องนี้ไว้เสมอ ไม่งั้นคอลัมน์ทั้งแถวเลื่อนไป 1 ช่อง (เทียบช่องแผนกที่ต้นแถว) */}
        <TableCell><Dash /></TableCell>
        <TableCell />
      </TableRow>

      {/* ✅ แถบสรุป+ปุ่มอยู่ใต้แถว กินความกว้างเต็มตาราง — เดิมยัดปุ่ม ✓/✕ ไว้ในคอลัมน์ "จัดการ" ที่กว้าง
          แค่ 50px ปุ่มเลยเล็กจิ๋วเบียดกันจนแทบมองไม่เห็นว่ากดตรงไหนถึงจะบันทึก และตอนยังกรอกไม่ครบก็เป็น
          วงกลมสีเทาที่ไม่บอกอะไรเลย — ย้ายมาเป็นปุ่มมีข้อความเต็มตัว พร้อมบอกว่ายังขาดช่องไหนอยู่ */}
      <TableRow sx={{ bgcolor: alpha(ACCENT, 0.035), "& td": { borderBottom: `1px solid ${alpha(ACCENT, 0.22)}` } }}>
        <TableCell colSpan={totalColCount} sx={{ py: 0.75, boxShadow: `inset 3px 0 0 ${ACCENT}` }}>
          <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} spacing={1}>
            <Chip
              size="small" label="สัญญาใหม่ · ยังไม่ได้บันทึก"
              sx={{ height: 20, fontSize: "0.66rem", fontWeight: 700, bgcolor: alpha(ACCENT, 0.1), color: ACCENT, flexShrink: 0 }}
            />
            <Typography
              variant="caption"
              sx={{ flex: 1, minWidth: 0, fontSize: "0.7rem", color: formError ? ACCENT : "text.secondary", fontWeight: formError ? 700 : 400 }}
            >
              {formError
                || (noTaken ? "เลขที่สัญญานี้ถูกใช้ไปแล้ว" : "")
                || (badRange ? "วันที่สิ้นสุดสัญญาต้องไม่ก่อนวันที่เริ่ม" : "")
                || (missing.length > 0
                  ? `ยังต้องกรอก: ${missing.join(" · ")}`
                  : 'พร้อมบันทึกแล้ว — วันที่เข้างานแต่ละครั้งมาลงทีหลังได้ที่ช่อง "ครั้งที่ N"')}
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0 }}>
              <Button
                size="small" onClick={onCancel} disabled={saving}
                sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.75rem", color: "text.secondary", minWidth: 0, px: 1.25 }}
              >
                ยกเลิก
              </Button>
              {/* ⚠️ ปุ่มนี้คือจุดเดียวที่ข้อมูลถูกส่งขึ้นเซิร์ฟเวอร์จริง — ปิดไว้จนกว่าช่องบังคับจะครบและ
                  ไม่มีค่าที่ขัดกันเอง กันสร้างสัญญาที่ข้อมูลไม่ครบ (หน้าหลักตรวจซ้ำอีกชั้นใน handleAddSubmit) */}
              <Button
                size="small" variant="contained" onClick={() => onSave(draft)} disabled={blocked || saving}
                startIcon={saving ? <CircularProgress size={13} sx={{ color: "inherit" }} /> : <Check sx={{ fontSize: 16 }} />}
                sx={{
                  textTransform: "none", fontWeight: 700, fontSize: "0.75rem", borderRadius: 2,
                  boxShadow: "none", bgcolor: ACCENT, px: 1.75,
                  "&:hover": { bgcolor: "#b91c1c", boxShadow: "none" },
                }}
              >
                {saving ? "กำลังบันทึก…" : "บันทึกสัญญา"}
              </Button>
            </Stack>
          </Stack>
        </TableCell>
      </TableRow>
    </>
  );
};

export default function ContractOverview() {
  const isMobile = useMediaQuery("(max-width:600px)");
  const { userData } = useAuth();
  const role = userData?.role?.toLowerCase();
  const isAdminOrManager = can(role, "editContracts");
  // ✅ ช่างเข้าดูหน้านี้ได้ด้วย (เห็นแค่งานของตัวเอง — กรองมาจาก backend แล้ว) แต่แก้ไขไม่ได้
  // isAdminOrManager ยังคงคุมทุกจุดที่แก้ไขข้อมูลเหมือนเดิมทั้งหมด เทียบ pattern เดียวกับ
  // QuotationTracking.js (canAccess/isAdminOrManager แยกกัน)
  const canView = can(role, "viewContracts");

  const [searchParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  // ✅ งานรายครั้งที่กำลังเปิดกล่อง "วางบิล / รับเงิน" — จัดการได้จากตารางนี้เลย ไม่ต้องข้ามไปหน้า /billing
  // ⚠️ เก็บเป็น id ไม่ใช่ object — ตัว object จะเก่าค้างทันทีที่ events ถูกอัปเดตหลังบันทึก ทำให้กล่อง
  // ยังโชว์ยอดเดิมทั้งที่บันทึกไปแล้ว (ต้องปิดเปิดใหม่ถึงจะเห็น) ซึ่งดูเหมือนบันทึกไม่ติด
  const [billingTargetId, setBillingTargetId] = useState(null);
  // ✅ เอกสารของงาน (Service Report / ใบเสนอราคา / ใบวางบิล / ใบส่งมอบงาน) ที่ช่างแนบจากหน้า
  // การดำเนินงาน — เปิดดูจากตารางนี้ได้เลย ไม่ต้องข้ามหน้าไปหาทีละงาน
  // ⚠️ เก็บ "ครั้งที่กำลังเปิด" เป็น key ของแถว+เลขครั้ง ไม่ใช่เก็บ array ของ visits ตรงๆ — array จะ
  // เก่าค้างทันทีที่ข้อมูลอัปเดต ทำให้กล่องยังโชว์ไฟล์ชุดเดิมทั้งที่เพิ่งมีการเปลี่ยนแปลง (บั๊กแบบเดียว
  // กับที่เจอตอนทำกล่องวางบิล จึงใช้วิธีเดียวกัน)
  const [docsTarget, setDocsTarget] = useState(null);   // { rowKey, round, title }
  const [loading, setLoading] = useState(true);
  // ✅ ?q= — เปิดมาพร้อมค้นหาคำที่กำหนดไว้ล่วงหน้าได้เลย (เทียบ pattern เดียวกับ ?view=overdue ด้านล่าง)
  // ใช้กับลิงก์ "เจาะจง" จาก Dashboard.js ที่กดจากรายการสัญญาเลยกำหนดตัวใดตัวหนึ่ง ให้เด้งมาที่แท็บ
  // เลยกำหนด + ค้นหาชื่อบริษัท/โครงการนั้นให้ทันที แทนที่จะเปิดมาเจอทั้งลิสต์แล้วต้องมานั่งหาเอง
  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  // ✅ พับตัวกรอง (ประเภทงาน/ระบบ/ผู้รับผิดชอบ/ปี) ไว้บนจอมือถือ — เดิมกางเรียงเต็มความกว้าง 4-5 ช่อง
  // ซ้อนกันลงมา กินพื้นที่เกือบเต็มจอก่อนจะถึงข้อมูลจริงสักแถว ต้องเลื่อนผ่านทุกครั้งที่เข้าหน้านี้
  // ปิดไว้เป็นค่าเริ่มต้นเสมอ (ตัวเลขบนปุ่มบอกอยู่แล้วว่ามีตัวกรองทำงานอยู่กี่ตัว จึงไม่ต้องกางให้เห็น)
  // — จอใหญ่ไม่ได้รับผลกระทบเลย ยังเรียงอยู่แถวเดียวกับช่องค้นหาเหมือนเดิมทุกประการ
  const [filtersOpen, setFiltersOpen] = useState(false);
  // ✅ งานส่วนใหญ่ในระบบยังเป็นงานเก่าที่ยังไม่ได้จัดกลุ่มเป็นสัญญา (สร้างก่อนมีฟีเจอร์นี้) เดิม fallback
  // ให้ทุกงานเก่าขึ้นเป็น "สัญญา" 1 แถวของตัวเอง ทำให้ตารางท่วมไปด้วยแถวที่ไม่มีข้อมูลสัญญาจริงเลย
  // (ขึ้น "-" เกือบทุกช่อง) ดูรก/ไม่มีประโยชน์ — ใช้แท็บสลับมุมมองแทน switch เดียว (เทียบ pattern
  // เดียวกับแท็บประเภทเอกสารในหน้า "ไฟล์") ค่าเริ่มต้นโชว์เฉพาะสัญญาจริงก่อน กันรกตารางเหมือนเดิม
  // ✅ ?view=overdue — เปิดมาที่แท็บ "เลยกำหนด/คงค้าง" ได้ตรงๆ จากลิงก์แจ้งเตือน push (ดู
  // checkAndNotifyOverdueContracts ฝั่ง backend) แทนที่จะเปิดมาแท็บเริ่มต้นแล้วต้องกดกรองเอง
  // ⚠️ เดิมรู้จักแค่ ?view=overdue ค่าอื่นตกลง "contracts" หมด — ลิงก์เจาะจงมาที่แท็บอื่นจึงไม่เคยทำงาน
  const [viewFilter, setViewFilter] = useState(
    () => (VIEW_FILTER_VALUES.includes(searchParams.get("view")) ? searchParams.get("view") : "contracts")
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
      // ✅ scope:"responsible" — หน้านี้เป็น "สรุปภาพรวมความรับผิดชอบ" (มูลค่างาน/คืบหน้า/ยอดรวม)
      // ช่างจึงต้องเห็นเฉพาะงานที่ระบุตัวเองเป็น "ผู้รับผิดชอบหลัก" ไว้ตรงๆ เท่านั้น ไม่อิงทีมที่เข้างาน
      // และไม่รวมงานที่ยังไม่มอบหมาย — งานที่แค่ไปช่วยทำแต่ไม่ได้รับผิดชอบ ไม่ควรถูกนับรวมในยอดของตัวเอง
      // ⚠️ ส่งเฉพาะหน้านี้หน้าเดียว — การดำเนินงาน/งานของฉัน/แดชบอร์ด/ปฏิทิน ยังใช้ตัวกรองเดิมทุกประการ
      // (ดู strictResponsibleOrClauses ฝั่ง server) ช่างยังเห็นงานที่ตัวเองต้องไปทำครบเหมือนเดิม
      // ⚠️ แอดมิน/manager ไม่ได้รับผลอะไร — ฝั่ง server เห็นทุกงานอยู่แล้วไม่ว่าจะส่ง scope มาหรือไม่
      const scopeOpts = { scope: "responsible" };
      const [res, draftsRes] = await Promise.all([
        EventService.getEventOp(scopeOpts).catch(() => ({ userEvents: [] })),
        EventService.GetDraftEvents(scopeOpts).catch(() => ({ drafts: [] })),
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
  // ✅ ย้าย logic จัดกลุ่มไปไว้ที่ shared/utils/contractOverdue.js แล้ว (ใช้ซ้ำที่ Header.js ด้วยสำหรับป้าย
  // สรุปจำนวนสัญญาเกินกำหนดบนมือถือ) กันตรรกะเพี้ยนไม่ตรงกันระหว่างสองจุด
  const billingTarget = useMemo(
    () => (billingTargetId ? events.find((e) => String(e._id) === String(billingTargetId)) || null : null),
    [events, billingTargetId],
  );
  // ✅ callback คงที่ — ป้ายวางบิลถูก memo ไว้ (features/finance/components/BillingChip.js) ถ้าส่งฟังก์ชัน
  // ที่สร้างใหม่ทุก render เข้าไป memo จะไม่ช่วยอะไรเลย เพราะ prop เปลี่ยนทุกครั้งอยู่ดี
  const handleOpenBilling = useCallback((target) => setBillingTargetId(target._id), []);
  const handleCloseDocs = useCallback(() => setDocsTarget(null), []);
  const handleOpenDocs = useCallback((rowKey, round, title) => setDocsTarget({ rowKey, round, title }), []);
  const handleCloseBilling = useCallback(() => setBillingTargetId(null), []);
  const handleBillingSaved = useCallback((updated) => {
    setEvents((prev) => prev.map((e) => (String(e._id) === String(updated._id) ? { ...e, ...updated } : e)));
  }, []);


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
  // ⚠️ ไม่โชว์ช่องติ๊กในแท็บ "สัญญาหมดอายุ" — ช่องติ๊กมีไว้เลือกงานเก่าไปรวมเป็นสัญญา แต่แถวในแท็บนี้
  // เป็นสัญญาจริงที่ผูกกลุ่มไปแล้วทุกแถว (isRealContract) เลือกไปก็ทำอะไรต่อไม่ได้ มีแต่กินความกว้าง
  // ดึงงานของครั้งที่กำลังเปิดกล่องเอกสารอยู่ — คำนวณสดจาก contracts ไม่ใช่ค่าที่เก็บไว้ตอนกด
  const docsRoundVisits = useMemo(() => {
    if (!docsTarget) return null;
    const row = contracts.find((c) => c.key === docsTarget.rowKey);
    return row ? roundVisitsOf(row, docsTarget.round) : null;
  }, [docsTarget, contracts]);

  const showCheckboxes = isAdminOrManager && viewFilter !== "contracts" && viewFilter !== "expired";
  // ✅ เลือกได้เฉพาะงานที่ยัง "ไม่จัดกลุ่ม" จริงๆ เท่านั้น — งานทั่วไป/งานโปรเจคถูกยืนยันหมวดหมู่ไปแล้ว
  // (isConfirmedGeneral/isConfirmedProject) ไม่ใช่เป้าหมายของ "จัดกลุ่มเป็นสัญญา" อีกต่อไป มี checkbox
  // ให้เลือกไว้จะสับสน/กดผิดได้ — ตัดออกตามที่ผู้ใช้ขอ ใช้ตัวเดียวกันทั้งตาราง/การ์ดมือถือ กันสองจุด
  // ไม่ตรงกัน (ครอบคลุมแท็บ "ทั้งหมด" ที่มีแถวหลายประเภทปนกันด้วย ไม่ใช่แค่ 2 แท็บที่ระบุมา)
  const isSelectableForMerge = (c) => !c.isRealContract && !c.isConfirmedGeneral && !c.isConfirmedProject;
  // ✅ ซ่อนคอลัมน์ที่เป็นข้อมูลระดับสัญญาล้วนๆ (เลขที่เอกสาร/ระยะเวลา/จำนวนครั้ง/มูลค่างาน/สถานะสัญญา)
  // ตอนดูแท็บที่ไม่ใช่สัญญาจริงทั้งคู่ ("ยังไม่จัดกลุ่ม" และ "งานทั่วไป") — แถวพวกนี้เป็น "-" ว่างเปล่า
  // ทุกช่องเสมอไม่ว่าจะยืนยันเป็นงานทั่วไปแล้วหรือยัง (isConfirmedGeneral ไม่เกี่ยวอะไรกับ contractGroupId
  // เลย) ⚠️ เดิมให้แท็บ "งานทั่วไป" ยังคงโชว์ไว้ต่างจากแท็บ "ยังไม่จัดกลุ่ม" แต่พบว่าข้อมูลที่โชว์
  // (เช่น "จำนวนครั้ง 1") เป็นค่าที่คำนวณมั่วจากตรรกะของสัญญา ไม่ใช่ข้อมูลจริงที่มีใครกรอกไว้เลย รกตา
  // และดูเหมือนมีข้อมูลสัญญาทั้งที่จริงไม่มี ต้องซ่อนเหมือนกันทั้ง 2 แท็บ
  const hideContractOnlyColumns = viewFilter === "ungrouped" || viewFilter === "general" || viewFilter === "project";

  // ✅ ปุ่ม/เมนูเลือกมุมมองบนจอมือถือ — แทนแท็บเรียงแถวยาวที่ล้นออกนอกจอจนผู้ใช้ไม่รู้ว่ามีอยู่
  // (ดูเหตุผลเต็มตรงที่เรนเดอร์แท็บ)
  const [viewMenuAnchor, setViewMenuAnchor] = useState(null);

  // ✅ รูปแบบการแสดงผลบนจอมือถือ (การ์ด/ตาราง) — จำค่าไว้ใน localStorage ให้เปิดหน้านี้ครั้งหน้าได้
  // มุมมองที่เลือกไว้เลย ไม่ต้องมากดสลับใหม่ทุกครั้ง (ดูเหตุผลเต็มที่ MOBILE_VIEW_STORAGE_KEY)
  const [mobileView, setMobileView] = useState(loadStoredMobileView);
  // ✅ แถบยอดรวมตรึงท้ายจอ เริ่มแบบพับไว้ (ดูเหตุผลที่ renderMobileSummaryBar) — กางแล้วเห็นคำเตือน
  // ยอดที่ยังกรอกไม่ครบ + ขอบเขตตัวกรองที่ยอดนี้นับมาจาก
  const [summaryBarOpen, setSummaryBarOpen] = useState(false);
  const handleMobileViewChange = (_, next) => {
    // ⚠️ ToggleButtonGroup ส่ง null มาเมื่อกดปุ่มที่เลือกอยู่ซ้ำ (= ยกเลิกการเลือก) — ต้องเมินทิ้ง
    // ไม่งั้นจะกลายเป็นสถานะ "ไม่ได้เลือกมุมมองไหนเลย" ซึ่งไม่มีความหมายในบริบทนี้
    if (!next) return;
    setMobileView(next);
    try { localStorage.setItem(MOBILE_VIEW_STORAGE_KEY, next); } catch { /* โหมดส่วนตัว/พื้นที่เต็ม — แค่ไม่จำค่า ไม่ใช่เรื่องคอขาดบาดตาย */ }
  };
  // ✅ ใช้ตารางแทนการ์ดก็ต่อเมื่ออยู่บนมือถือ "และ" ผู้ใช้เลือกไว้ — จอใหญ่เป็นตารางเสมออยู่แล้ว
  const useMobileTable = isMobile && mobileView === "table";

  // ✅ ความกว้างคอลัมน์ที่ผู้ใช้ลากปรับเอง (key เฉพาะที่ต่างจากค่าเริ่มต้นเท่านั้น) — โหลดจาก
  // localStorage ตอนเปิดหน้า (lazy initializer) แล้วบันทึกกลับทุกครั้งที่ปรับ จะได้จำค่าไว้ข้ามการออก
  // จากหน้า/รีเฟรช ไม่ใช่แค่ระหว่างที่ยังเปิดหน้านี้ค้างอยู่เหมือนเดิม
  // ✅ เก็บแยกกันทุกแท็บ (colWidthsByTab[viewFilter]) — ปรับความกว้างในแท็บไหนมีผลเฉพาะแท็บนั้น สลับ
  // ไปแท็บอื่นได้ความกว้างของแท็บนั้นเองที่เคยปรับไว้ ไม่ลากกันไปมา (ดูเหตุผลเต็มที่ COL_WIDTHS_STORAGE_KEY)
  const [colWidthsByTab, setColWidthsByTab] = useState(loadStoredColWidths);
  // ⚠️ ต้องห่อ useMemo — ไม่งั้นได้ object ใหม่ทุก render (กรณี `|| {}`) ทำให้ useMemo ที่รับ colWidths
  // เป็น dependency ด้านล่าง (totalTableWidth/tableCssVars) คำนวณใหม่ทุก render จนหมดประโยชน์ที่ memo ไว้
  const colWidths = useMemo(() => colWidthsByTab[viewFilter] || {}, [colWidthsByTab, viewFilter]);
  // 🐛 BUG ที่แก้ (ตารางบนมือถือคอลัมน์กว้างมหาศาลจนเห็นทีละคอลัมน์ และหาช่องมูลค่างานไม่เจอ):
  // เดิมให้ "ค่าที่ผู้ใช้ลากปรับเอง" (colWidths) ชนะเสมอ แม้ตอนดูบนมือถือ — แต่ค่าพวกนั้นถูกลาก/
  // ดับเบิลคลิกพอดีเนื้อหาไว้ตอนอยู่บนจอคอมซึ่งกว้าง 1,400px+ คอลัมน์เดียวกว้าง 300-400px ได้สบายๆ
  // พอเอามาใช้บนจอ 375px ก็กลายเป็นคอลัมน์เดียวกินเต็มจอ ต้องปัดทีละคอลัมน์กว่าจะถึงมูลค่างาน
  // ✅ บนมือถือใช้ชุดความกว้างของมือถือเสมอ ไม่สนค่าที่เคยลากไว้บนจอคอม — บนมือถือปิดการลากปรับ
  // ความกว้างอยู่แล้ว (ดู resizable ที่ ResizableTh) จึงไม่มีทางที่ผู้ใช้ตั้งใจตั้งค่าไว้สำหรับจอนี้ตั้งแต่ต้น
  // ⚠️ ค่าที่ลากไว้บนจอคอมไม่ได้ถูกลบทิ้ง — กลับไปดูบนจอคอมเมื่อไหร่ก็ได้ความกว้างเดิมที่ตั้งไว้ครบ
  const colWidth = useCallback((key) => {
    if (useMobileTable) {
      return MOBILE_COL_WIDTHS[key]
        ?? (key.startsWith("visit_") ? MOBILE_VISIT_COL_WIDTH : undefined)
        ?? DEFAULT_COL_WIDTHS[key]
        ?? VISIT_COL_DEFAULT_WIDTH;
    }
    return colWidths[key] ?? DEFAULT_COL_WIDTHS[key] ?? VISIT_COL_DEFAULT_WIDTH;
  }, [colWidths, useMobileTable]);
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
  const handleColResize = (key) => (w) => setColWidthsByTab((prev) => {
    // ✅ อัปเดตเฉพาะแท็บที่กำลังเปิดอยู่ ไม่แตะค่าของแท็บอื่นเลย
    const next = { ...prev, [viewFilter]: { ...(prev[viewFilter] || {}), [key]: w } };
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
  /**
   * ✅ "ช่วงเวลาของงานนี้" — ของกลางที่ตัวกรองปี / อายุสัญญา / ช่วงวันที่ ใช้ร่วมกันทั้งหมด
   *
   * ⚠️ ต้อง fallback ไปหาวันที่เข้างานจริงเสมอเมื่อยังไม่ได้กรอกวันสัญญา — งานทั่วไป/โปรเจคไม่มีวันเริ่ม/
   * สิ้นสุดสัญญาตามธรรมชาติของมัน ถ้าดูแค่ 2 ฟิลด์นั้นงานพวกนี้จะกลายเป็น "ไม่มีช่วงเวลา" ทั้งหมด แล้ว
   * หลุดจากตัวกรองช่วงวันที่ไปทั้งแท็บ ทั้งที่มันมีวันเข้างานจริงอยู่ชัดเจน
   */
  const contractPeriod = (c) => {
    const visitDates = (c.visits || []).map((v) => v.start).filter(Boolean).sort();
    const start = c.contractStart || visitDates[0] || null;
    const end = c.contractEnd || visitDates[visitDates.length - 1] || start;
    return start ? { start: moment(start), end: moment(end || start) } : null;
  };

  // 🐛 BUG ที่แก้ (สัญญา 2-3 ปี หายไปจากปีกลาง): เดิมคืน "ปีที่เริ่ม" ปีเดียว สัญญา 01/2569–12/2571
  // จึงโผล่เฉพาะตอนเลือกปี 2569 เท่านั้น พอเลือก 2570/2571 หายไปเลยทั้งที่สัญญายังมีผลอยู่จริงในปีนั้น
  // ✅ คืน "ทุกปีที่สัญญาครอบคลุม" แทน — ตัวกรองปีจะเจอสัญญาหลายปีได้ครบทุกปีที่มันยังมีผลอยู่
  const contractYears = (c) => {
    const p = contractPeriod(c);
    if (!p) return [];
    const from = p.start.year();
    const to = Math.max(from, p.end.year());
    const out = [];
    for (let y = from; y <= to; y += 1) out.push(y);
    return out;
  };
  // ปีเริ่มต้นของสัญญา — ยังจำเป็นสำหรับที่ที่ต้องการ "ปีเดียว" จริงๆ (เช่นจับกลุ่มงานเก่าที่ยังไม่ผูกสัญญา)
  const contractYear = (c) => {
    const p = contractPeriod(c);
    return p ? p.start.year() : null;
  };

  // ✅ อายุสัญญาเป็น "จำนวนปี" — ตามที่ผู้ใช้ขอให้แยกค้นหาได้ เพราะสัญญา 2 ปี/3 ปี มีเงื่อนไขการดูแล
  // และการวางบิลต่างจากสัญญาปีต่อปีอย่างสิ้นเชิง แต่เดิมดูรวมกันหมดในตารางเดียวโดยไม่มีทางแยก
  // ⚠️ คิดจากจำนวนเดือนแล้วปัดขึ้น ไม่ใช่ลบปีกัน — สัญญา 01/01/2569–31/12/2569 (11.97 เดือน) ต้องได้
  // 1 ปี ส่วน 01/07/2569–30/06/2571 (23.97 เดือน) ต้องได้ 2 ปี ซึ่งการลบปีกันตรงๆ จะได้ 1 กับ 2 ผิดทั้งคู่
  const contractDurationYears = (c) => {
    const p = contractPeriod(c);
    if (!p || !c.contractStart || !c.contractEnd) return null;
    const months = p.end.diff(p.start, "months", true);
    if (!(months > 0)) return null;
    return Math.max(1, Math.round(months / 12));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contracts]);

  // ✅ ตัวเลือกปีสำหรับกรองตาราง — ดึงจากปีที่มีข้อมูลจริง บวกปีปัจจุบันเสมอ (แม้ยังไม่มีสัญญาปีนี้เลย
  // ก็ตาม) เพราะเป็นค่าเริ่มต้นของตัวกรองด้านล่าง กันกรณี dropdown ไม่มีปีปัจจุบันให้เลือกตั้งแต่แรก
  const currentYear = moment().year();
  const availableYears = useMemo(() => {
    const years = new Set([currentYear]);
    contracts.forEach((c) => { contractYears(c).forEach((y) => years.add(y)); });
    return [...years].sort((a, b) => b - a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contracts]);
  // ✅ ค่าเริ่มต้นคือ "ทุกช่วงเวลา" ตามที่ผู้ใช้สั่ง — เดิมล็อกเป็นปีปัจจุบันให้เองตั้งแต่เปิดหน้ามา ซึ่ง
  // เป็นตัวกรองที่ผู้ใช้ไม่ได้ตั้งเองแต่ซ่อนข้อมูลไปแล้ว จุดนี้ทำให้เข้าใจผิดบ่อยที่สุดในหน้านี้ว่า
  // "เห็นครบทุกอย่างแล้ว" ทั้งที่สัญญาของปีอื่นถูกกรองทิ้งไปเงียบๆ — เปิดมาเห็นครบก่อน แล้วค่อยกรองเอง
  // ✅ ?year= — ยังรองรับเหมือนเดิมสำหรับ "ลิงก์เจาะจงข้ามหน้า" (เช่นปุ่ม "ดูในภาพรวมงาน" จากฟอร์ม
  // แก้ไขงานในปฏิทิน) ที่ส่ง year=all มาเพื่อกันไม่ให้ตัวกรองปีบังสัญญาที่ลิงก์ชี้มา — ตอนนี้ค่าเริ่มต้น
  // เป็น all อยู่แล้วจึงไม่จำเป็นเท่าเดิม แต่คงไว้เพื่อให้ลิงก์เก่าที่ส่ง year=<ปี> มายังทำงานได้ถูกต้อง
  const [yearFilter, setYearFilter] = useState(
    () => searchParams.get("year") || YEAR_FILTER_ALL
  );
  // ✅ จำนวนแถวที่ยัง "ระบุปีไม่ได้" (สัญญาเปล่าที่ยังไม่กรอกวันที่เริ่มสัญญา/ยังไม่ลงวันที่เข้างานเลย) —
  // แถวพวกนี้แสดงในทุกปีอยู่แล้ว (ดู applyCommonFilters) แต่มีตัวเลือกแยกไว้ให้กรองดูเฉพาะกลุ่มนี้ได้ด้วย
  // เผื่อต้องการไล่เก็บตกว่ามีสัญญาไหนค้างยังไม่ได้ลงวันที่บ้าง — โผล่เฉพาะตอนมีจริงเท่านั้น กันรกตัวเลือก
  const unknownYearCount = useMemo(
    () => contracts.filter((c) => contractYear(c) === null).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contracts]
  );
  // ✅ กรองตามผู้รับผิดชอบ — แยกจากช่องค้นหาข้อความอิสระ ให้เลือกจากรายชื่อจริงได้เลย ไม่ต้องพิมพ์เอง
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  // ✅ กรองตามประเภทงาน (เช่น PM/Service/ติดตั้ง ฯลฯ) — เพิ่มตามที่ผู้ใช้ขอ เทียบ pattern เดียวกับ
  // ตัวกรองปี/ผู้รับผิดชอบด้านบนทุกประการ (เลือกจากรายชื่อประเภทงานจริงในระบบ ไม่ต้องพิมพ์เอง)
  const [titleFilter, setTitleFilter] = useState("all");
  // ✅ กรองตามระบบ (เช่น Fire Alarm/CCTV/Access Control ฯลฯ) — เทียบ pattern เดียวกับตัวกรองประเภทงาน
  // ด้านบนเป๊ะๆ (เลือกจากรายชื่อระบบจริงที่ตั้งค่าไว้ในระบบ ไม่ต้องพิมพ์เอง) เดิมค้นหาระบบได้แค่ผ่านช่อง
  // ค้นหาข้อความอิสระ ซึ่งพิมพ์ผิด/สะกดไม่ตรงก็หาไม่เจอ และปนกับผลลัพธ์จากฟิลด์อื่นที่บังเอิญมีคำเดียวกัน
  const [systemFilter, setSystemFilter] = useState("all");
  // ✅ กรองตามป้ายกำกับแผนกเจ้าของสัญญา (ฝ่ายบริการ/ฝ่ายขาย) — ตามที่ผู้ใช้ขอให้ "ค้นหาแยกได้ชัดเจน"
  // ⚠️ กรองจากป้ายที่ติดไว้ในหน้านี้ล้วนๆ ไม่เกี่ยวกับขอบเขตการมองเห็นของ role ใดๆ ทั้งสิ้น
  const [departmentFilter, setDepartmentFilter] = useState("all");
  // ✅ กรองตามสถานะสัญญา — ตามที่ผู้ใช้ขอให้ "ค้นหาสถานะสัญญาได้ด้วย" เดิมสถานะเป็นค่าคำนวณที่เห็นได้
  // อย่างเดียว ไล่หาสัญญาที่ใกล้หมดอายุต้องกวาดตาดูทีละแถวเอง (แท็บ "สัญญาหมดอายุ" ครอบเฉพาะที่หมด
  // ไปแล้ว ไม่ครอบที่กำลังจะหมด ซึ่งเป็นกลุ่มที่ต้องรีบต่อสัญญาจริงๆ)
  const [statusFilter, setStatusFilter] = useState("all");
  // ✅ กรองตามอายุสัญญาเป็นจำนวนปี — ดูเหตุผลที่ contractDurationYears
  const [durationFilter, setDurationFilter] = useState("all");
  // ✅ ช่วงวันที่ที่กรอกเอง — ใช้เฉพาะตอนตัวกรองช่วงเวลาเป็น "เลือกช่วงวันที่เอง…" เท่านั้น
  // ⚠️ เก็บเป็นสตริง YYYY-MM-DD เหมือนช่องวันที่อื่นทั้งหน้า (ThaiDatePicker รับ/คืนรูปแบบนี้)
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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

  // ✅ การ์ดมือถือ — พับไว้เป็นค่าเริ่มต้นเสมอ โชว์แค่ข้อมูลจำเป็น (บริษัท/โครงการ/สถานะ/คืบหน้า) กดเพื่อ
  // กางดูรายละเอียดทีหลัง (เทียบ pattern เดียวกับการ์ดงานในหน้า "การดำเนินงาน" — Operation/index.js
  // expanded state ต่อการ์ด) กันหน้าจอแคบยาวเกินไปจนต้องเลื่อนหาข้อมูลที่ต้องการทุกครั้ง
  const [expandedCards, setExpandedCards] = useState(new Set());
  const toggleCardExpand = (key) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  // ✅ ซ้อนอีกชั้นเฉพาะส่วน "ครั้งที่เข้างาน" ในการ์ด — สัญญาที่มีหลายครั้ง (สูงสุด 12) ทำให้การ์ดที่กาง
  // อยู่แล้วยาวมากถ้าโชว์ทุกครั้งตลอด พับไว้เป็นสรุปย่อก่อนเสมอ กดดูทั้งหมดทีหลังได้ตามต้องการ
  const [expandedRounds, setExpandedRounds] = useState(new Set());
  const toggleRoundsExpand = (key) => {
    setExpandedRounds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  // ✅ "ครั้งที่ N" ครั้งเดียวมีได้หลายวันที่ (เข้างานไม่ติดกัน — เว้นช่วงแล้วกลับมาเข้าอีก ถือเป็นครั้ง
  // เดียวกัน ดู openExtendVisitDialog) เดิมโชว์ทุกวันซ้อนกันหมดในเซลล์เดียว งานที่แบ่งเข้า 6-7 ช่วงจะดัน
  // ให้แถวนั้นสูงกว่าแถวอื่นเป็นเท่าตัว ตารางเลยดูสูงๆ ต่ำๆ ไม่เป็นระเบียบ (ตามที่ผู้ใช้เจอ) — โชว์แค่
  // VISIT_CELL_PREVIEW วันแรกก่อน ที่เหลือพับไว้หลังปุ่ม "+ อีก N วัน" กดกางดูครบได้ทุกเมื่อ
  // ⚠️ พับ "ต่อเซลล์" ไม่ใช่ต่อแถว (คีย์ = แถว|ครั้งที่) เพราะแต่ละครั้งในแถวเดียวกันมีจำนวนวันไม่เท่ากัน
  // กางครั้งที่ 1 ไม่ควรไปกางครั้งที่ 2 ที่ไม่เกี่ยวกันด้วย
  const [expandedVisitCells, setExpandedVisitCells] = useState(new Set());
  const toggleVisitCell = (key) => {
    setExpandedVisitCells((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ⚠️ BUG ที่แก้: เดิมเลขบนแท็บ ("สัญญา (N)"/"งานทั่วไป (N)"/"ทั้งหมด (N)") นับจาก `contracts` ดิบ
  // ทั้งก้อน ไม่ผ่านตัวกรองปี/ผู้รับผิดชอบ/คำค้นหาเลย ในขณะที่ตัวเลขใต้หัวข้อ ("N งาน") กับการแบ่งหน้า
  // (pagination) นับจาก `filtered` ซึ่งผ่านตัวกรองครบ — พอ yearFilter ค่าเริ่มต้นล็อกปีปัจจุบันไว้อยู่แล้ว
  // (ดู yearFilter ด้านบน) ตัวเลขสองชุดนี้เลยไม่ตรงกันเสมอ (แท็บบอก 98 แต่ตารางโชว์แค่ 11 ตามปีที่กรอง)
  // ทำให้ดูเหมือนแบ่งหน้าพัง — ทางแก้คือให้ตัวเลขบนแท็บผ่านตัวกรองชุดเดียวกันกับ `filtered` ด้วย ต่างกัน
  // แค่ "กลุ่มประเภท" (สัญญา/งานทั่วไป/ทั้งหมด) ก่อนนับ ให้ตัวเลขทุกจุดในหน้านี้ตรงกันเสมอ
  // @param {{ignoreYear?: boolean}} opts — ignoreYear ใช้เฉพาะแท็บ "สัญญาหมดอายุ" ที่ต้องมองข้ามปี
  //   (ดูเหตุผลที่ expiredCount) ตัวกรองอื่นยังมีผลครบทุกตัวตามปกติ
  // @param {string} [skip] ชื่อตัวกรองที่จะข้ามไปไม่ใช้ในรอบนี้ — ใช้ตอนนับจำนวนต่อตัวเลือกของตัวกรองนั้น
  //   เอง (faceted count): เลข "ฝ่ายขาย (7)" ต้องหมายถึง "ถ้ากดฝ่ายขายจะเหลือ 7 แถว" จึงต้องกรองด้วย
  //   ตัวกรองอื่นทุกตัว "ยกเว้นตัวมันเอง" — ถ้ากรองด้วยตัวเองด้วย พอเลือกฝ่ายบริการอยู่ ตัวเลขของ
  //   ฝ่ายขายจะกลายเป็น 0 ทันที ทั้งที่มีของอยู่จริง
  const applyCommonFilters = (list, { ignoreYear = false, skip } = {}) => {
    let base = list;
    // 🐛 BUG ที่แก้ (สร้างสัญญาแล้วหายไปเลย): เดิมกรองด้วย String(contractYear(c)) === yearFilter ตรงๆ —
    // สัญญาที่ยัง "ระบุปีไม่ได้" (ไม่ได้กรอกวันที่เริ่มสัญญา และยังไม่ลงวันที่เข้างานสักครั้ง = สัญญาเปล่า
    // ที่เพิ่งสร้าง ซึ่งเป็นเรื่องปกติมากตามที่ผู้ใช้ต้องการ) จะได้ contractYear = null → "null" ไม่มีทาง
    // ตรงกับปีไหนเลย → ถูกซ่อนหายทันทีที่สร้างเสร็จ ทั้งที่ตัวกรองปีตั้งค่าเริ่มต้นเป็นปีปัจจุบันไว้อยู่แล้ว
    // (ผู้ใช้ไม่ได้ตั้งเอง) = "เพิ่มสัญญาแล้วไม่เห็นในตาราง" โดยไม่มีอะไรบอกสาเหตุเลย
    // ✅ แถวที่ระบุปีไม่ได้ให้ผ่านตัวกรองปีเสมอ (ไม่มีปีให้ขัดแย้งกับตัวกรอง จึงไม่ควรถูกซ่อน) แล้วเพิ่ม
    // ตัวเลือก "ยังไม่ระบุปี" ไว้ให้กรองดูเฉพาะกลุ่มนี้ได้ด้วยถ้าต้องการ (ดู unknownYearCount ด้านล่าง)
    if (ignoreYear) {
      // ข้ามตัวกรองปีไปเลย
    } else if (yearFilter === YEAR_FILTER_NONE) {
      base = base.filter((c) => contractYears(c).length === 0);
    } else if (yearFilter === YEAR_FILTER_CUSTOM) {
      // ✅ ช่วงวันที่ที่กรอกเอง = "ช่วงของตัวสัญญาเอง" ตามที่ผู้ใช้ระบุ — ช่อง "จากวันที่" เทียบกับ
      // วันเริ่มสัญญา และช่อง "ถึงวันที่" เทียบกับวันสิ้นสุดสัญญา สัญญาจะติดมาก็ต่อเมื่อทั้งวันเริ่ม
      // และวันสิ้นสุด "อยู่ในช่วงที่กรอก" ทั้งคู่ (ไม่ใช่แค่คาบเกี่ยวกันบางส่วน)
      // 🐛 BUG ที่แก้: เดิมใช้เกณฑ์ "ช่วงซ้อนทับกัน" (overlap) — ค้น 01/01/2570–06/02/2570 แล้วได้
      // สัญญา 01/04/2569–31/03/2570 ติดมาด้วย เพราะมันคาบช่วงนั้นอยู่ ทั้งที่ไม่ได้เริ่มหรือจบในช่วง
      // ที่ถามเลยสักวัน ซึ่งไม่ตรงกับที่ผู้ใช้ต้องการ (ถามหา "สัญญาที่เริ่ม-จบ ในช่วงนี้")
      // ⚠️ กรอกช่องเดียวก็ใช้ได้: กรอกแต่ "จากวันที่" = สัญญาที่เริ่มตั้งแต่วันนั้นเป็นต้นไป (ไม่สนวันจบ)
      // กรอกแต่ "ถึงวันที่" = สัญญาที่สิ้นสุดภายในวันนั้น (ไม่สนวันเริ่ม)
      // ⚠️ แถวที่ไม่มีวันที่เลยถูกตัดออกโดยตั้งใจ — ต่างจากการเลือกปีที่ปล่อยผ่าน เพราะการถาม
      // ช่วงวันที่เจาะจงคือการถามคำถามที่แถวเหล่านั้นตอบไม่ได้
      const range = resolveCustomRange(dateFrom, dateTo);
      if (range) {
        base = base.filter((c) => {
          const p = contractPeriod(c);
          if (!p) return false;
          if (range.from && p.start.isBefore(range.from)) return false;
          if (range.to && p.end.isAfter(range.to)) return false;
          return true;
        });
      }
    } else if (yearFilter !== YEAR_FILTER_ALL) {
      // ✅ สัญญาหลายปีต้องโผล่ในทุกปีที่มันยังมีผลอยู่ (ดู contractYears) ไม่ใช่แค่ปีที่เซ็นสัญญา
      base = base.filter((c) => {
        const ys = contractYears(c);
        return ys.length === 0 || ys.some((y) => String(y) === String(yearFilter));
      });
    }
    // ✅ กรองตามอายุสัญญา (1 ปี / 2 ปี / 3 ปี ...) — ตามที่ผู้ใช้ขอให้ "แยกค้นหางานต่อปี"
    if (durationFilter !== "all" && skip !== "duration") {
      base = durationFilter === "none"
        ? base.filter((c) => contractDurationYears(c) === null)
        : base.filter((c) => String(contractDurationYears(c)) === String(durationFilter));
    }
    // ✅ กรองตาม "ผู้รับผิดชอบงาน" (เจ้าของงานโดยรวม) — เดิมตัวกรองนี้กรองตาม "ทีมที่เข้างาน"
    // (allRoundTeamNames = ทุกคนที่เคยเข้างานครั้งไหนก็ได้) ซึ่งเป็นคนละเรื่องกันโดยสิ้นเชิง: ทีมเปลี่ยน
    // ได้ทุกครั้งที่เข้างาน ส่วนผู้รับผิดชอบคือคนที่ติดตามงานนี้ทั้งหมด — การกรอง "งานของใคร" ในหน้านี้
    // ต้องหมายถึงผู้รับผิดชอบเสมอ (ตรงกับที่หน้าอื่นๆ ใช้ตัดสินสิทธิ์/การมองเห็นทั้งแอป) ไม่งั้นเลือกชื่อ
    // คนหนึ่งแล้วได้สัญญาที่เขาแค่ไปช่วยเข้างานครั้งเดียวติดมาด้วย ทั้งที่ไม่ได้รับผิดชอบสัญญานั้นเลย
    // ⚠️ ช่องค้นหาข้อความอิสระด้านบนยังค้นทั้งผู้รับผิดชอบและชื่อทีมทุกครั้งเหมือนเดิม (ดูท้ายฟังก์ชันนี้)
    // — ตัวกรองนี้เจาะจงเฉพาะผู้รับผิดชอบเท่านั้น
    if (skip === "responsible") {
      // ข้ามตัวกรองผู้รับผิดชอบไปทั้งก้อน (ดู skip ที่หัวฟังก์ชัน)
    } else if (responsibleFilter === "unassigned") {
      // ✅ ตัวเลือกพิเศษ — ไล่เก็บสัญญาที่ยังไม่เคยมอบหมายผู้รับผิดชอบ (ขึ้น "ยังไม่มอบหมาย" ในตาราง)
      // ซึ่งเดิมไม่มีทางกรองหาได้เลย ต้องไล่ดูทีละแถวเอง
      base = base.filter((c) => !c.responsiblePerson);
    } else if (responsibleFilter !== "all") {
      base = base.filter((c) => c.responsiblePerson === responsibleFilter);
    }
    if (titleFilter !== "all") {
      base = base.filter((c) => (c.title || "") === titleFilter);
    }
    if (systemFilter !== "all") {
      base = base.filter((c) => (c.system || "") === systemFilter);
    }
    // ✅ กรองตามแผนก — เทียบผ่านค่าที่ fallback แล้วเสมอ ไม่เทียบ c.departmentTag ดิบ เพราะงานเก่าที่ยังไม่มี
    // ฟิลด์นี้ต้องนับเป็น "ฝ่ายบริการ" (ตรงกับ default ของ schema และตัวกรองฝั่ง server) ไม่งั้นเลือก
    // "ฝ่ายบริการ" แล้วงานเก่าทั้งระบบจะหายหมดทั้งที่หน้าจอแสดงว่าเป็นฝ่ายบริการอยู่
    if (departmentFilter !== "all" && skip !== "department") {
      base = base.filter((c) => (c.departmentTag || DEPARTMENT.SERVICE) === departmentFilter);
    }
    // ✅ กรองตามสถานะสัญญา — เทียบด้วย kind ซึ่งเป็นคีย์คงที่ (ดู statusDisplay) ไม่ใช่ข้อความบนจอ
    if (statusFilter !== "all" && skip !== "status") {
      base = base.filter((c) => statusKinds(c).includes(statusFilter));
    }
    const kw = search.trim().toLowerCase();
    if (!kw) return base;
    // ✅ ค้นหา "ผู้รับผิดชอบ" ด้วย ไม่ใช่แค่ team — คนละฟิลด์กันแล้วตั้งแต่แยกเป็นอิสระ (ดู
    // groupEventsByContract ใน shared/utils/contractOverdue.js) — allRoundTeamNames ครอบคลุมทุกครั้ง ไม่ใช่
    // แค่ทีมของครั้งที่ 1 เหมือน c.team เดิม
    // ✅ ค้นด้วยชื่อแผนกได้ด้วย (พิมพ์ "ขาย" แล้วเจอสัญญาของฝ่ายขายทั้งหมด) — ค้นจาก "ป้ายภาษาไทย"
    // ที่เห็นบนจอ ไม่ใช่ค่าดิบ "sales" ที่ผู้ใช้ไม่มีทางรู้ว่าต้องพิมพ์อะไร
    // ✅ ค้นสถานะสัญญาได้ด้วย — พิมพ์ "หมดอายุ"/"ใกล้หมด"/"ข้อมูลไม่ครบ" หรือข้อความในหมายเหตุที่
    // พิมพ์เองไว้ ก็เจอทั้งชุด ค้นจาก "ข้อความที่เห็นบนจอ" ตัวเดียวกับที่ตารางแสดง (statusDisplay)
    // ไม่ใช่ค่าดิบภายใน ผู้ใช้จึงพิมพ์ตามที่ตาเห็นได้เลยโดยไม่ต้องรู้ว่าเบื้องหลังเก็บเป็นอะไร
    // ✅ รวมรายชื่อช่องที่ยังไม่ได้กรอกเข้าไปด้วย (เช่นพิมพ์ "มูลค่างาน" เจอทุกแถวที่ยังไม่ใส่มูลค่า)
    return base.filter((c) => {
      const sd = statusDisplay(c);
      return [c.company, c.site, c.system, c.title, c.contractNo, c.quotationNo, c.responsiblePerson,
        departmentMeta(c.departmentTag).label, sd.label, contractStatusInfo(c)?.label, c.remark, ...(sd.missing || [])]
        .some((v) => (v || "").toLowerCase().includes(kw)) ||
        (c.allRoundTeamNames || []).some((name) => name.toLowerCase().includes(kw));
    });
  };

  // ✅ งานที่ไม่มี contractGroupId แบ่งเป็น 2 กลุ่มจริงๆ ไม่ใช่กองเดียวกันอีกต่อไป — ค่าเริ่มต้นคือ
  // "ยังไม่จัดกลุ่ม" (isConfirmedGeneral ยังไม่ true) จนกว่าจะกดยืนยันเป็น "งานทั่วไป" เอง (หรือย้ายเข้า
  // สัญญา ซึ่งจะทำให้ isRealContract=true แทน) กันงานเก่าที่ยังไม่มีใครไล่ดูจริงๆ ถูกเข้าใจผิดว่าเป็น
  // "งานทั่วไป" ที่ยืนยันแล้วทั้งที่จริงยังไม่มีใครตรวจสอบเลย
  const realContractCount = useMemo(
    () => applyCommonFilters(contracts.filter((c) => c.isRealContract)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contracts, yearFilter, responsibleFilter, titleFilter, systemFilter, departmentFilter, statusFilter, durationFilter, dateFrom, dateTo, search]
  );
  const hiddenJobCount = useMemo(
    () => applyCommonFilters(contracts.filter((c) => !c.isRealContract && !c.isConfirmedGeneral && !c.isConfirmedProject)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contracts, yearFilter, responsibleFilter, titleFilter, systemFilter, departmentFilter, statusFilter, durationFilter, dateFrom, dateTo, search]
  );
  const confirmedGeneralCount = useMemo(
    () => applyCommonFilters(contracts.filter((c) => !c.isRealContract && c.isConfirmedGeneral)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contracts, yearFilter, responsibleFilter, titleFilter, systemFilter, departmentFilter, statusFilter, durationFilter, dateFrom, dateTo, search]
  );
  const confirmedProjectCount = useMemo(
    () => applyCommonFilters(contracts.filter((c) => !c.isRealContract && c.isConfirmedProject)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contracts, yearFilter, responsibleFilter, titleFilter, systemFilter, departmentFilter, statusFilter, durationFilter, dateFrom, dateTo, search]
  );
  const allFilteredCount = useMemo(
    () => applyCommonFilters(contracts).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contracts, yearFilter, responsibleFilter, titleFilter, systemFilter, departmentFilter, statusFilter, durationFilter, dateFrom, dateTo, search]
  );
  // ✅ สัญญาที่ "เลยกำหนดเข้ารอบถัดไป/คงค้าง" — รอบล่าสุดผ่านมาเกินระยะห่างที่กำหนด (intervalMonths)
  // แล้วแต่ยังไม่มีวันที่/แผนงานล่วงหน้าของรอบถัดไปเลย (ดู nextVisitOverdueInfo) เดิมมีแค่ badge เตือน
  // ทีละแถวในตาราง ไม่มีทางกรองดูเฉพาะกลุ่มนี้รวดเดียวเลย — เพิ่มเป็นแท็บมุมมองแยกต่างหาก
  const overdueCount = useMemo(
    () => applyCommonFilters(contracts.filter((c) => c.isRealContract && nextVisitOverdueInfo(c))).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contracts, yearFilter, responsibleFilter, titleFilter, systemFilter, departmentFilter, statusFilter, durationFilter, dateFrom, dateTo, search]
  );

  // ✅ สัญญาที่เลยวันสิ้นสุดมาแล้ว — กลุ่มที่ต้องไล่ต่ออายุ/ปิดงาน เดิมมีแต่ชิปสีแดงเตือนทีละแถว ต้อง
  // ไล่กวาดสายตาหาเองทั้งตาราง ไม่มีทางกรองดูรวดเดียว
  // ⚠️ นับ "ทุกปี" เสมอ ไม่ผูกกับตัวกรองปี ต่างจากแท็บอื่นโดยตั้งใจ — สัญญาที่หมดอายุแล้วเกือบทั้งหมด
  // เริ่มต้นในปีก่อนๆ ถ้านับตามตัวกรองปี (ค่าเริ่มต้น = ปีปัจจุบัน) ตัวเลขจะเป็น 0 แทบตลอดเวลา
  const expiredCount = useMemo(
    () => applyCommonFilters(contracts.filter(isExpiredContract), { ignoreYear: true }).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contracts, responsibleFilter, titleFilter, systemFilter, departmentFilter, statusFilter, durationFilter, dateFrom, dateTo, search]
  );

  // ✅ สลับแท็บผ่านฟังก์ชันเดียว (ทั้งปุ่มบนจอคอมและเมนูบนมือถือ) เพราะการเข้าแท็บ "สัญญาหมดอายุ" ต้อง
  // ปลดตัวกรองปีเป็น "ทุกปี" ไปด้วย — ตัวกรองปีตั้งต้นเป็นปีปัจจุบัน แต่สัญญาที่หมดอายุแล้วเกือบทั้งหมด
  // เริ่มในปีก่อนๆ ถ้าไม่ปลดให้ ผู้ใช้จะกดเข้ามาเจอ "ไม่พบรายการ" ทั้งที่ตัวเลขบนแท็บขึ้นเลขอยู่
  // ⚠️ ตั้งใจให้ช่อง "ปี" เปลี่ยนเป็น "ทุกปี" ให้เห็นกับตา ไม่ใช่แอบข้ามตัวกรองไว้เบื้องหลัง — ไม่งั้น
  // ช่องปีจะโชว์ 2569 อยู่ทั้งที่ตารางแสดงทุกปี ซึ่งหลอกตาหนักกว่าเดิม
  // ✅ กล่องประวัติการแก้ไขสัญญา — เก็บทั้งก้อน c ไว้เลย เพื่อให้หัวกล่องบอกได้ว่าเป็นสัญญาไหน
  const [historyContract, setHistoryContract] = useState(null);

  const selectView = useCallback((v) => {
    if (!v) return;
    setViewFilter(v);
    if (v === "expired") setYearFilter("all");
  }, []);

  // ✅ "แถวทั้งหมดของแท็บที่เปิดอยู่" ก่อนตัวกรองย่อยใดๆ — แยกออกมาเป็นของกลางเพราะมี 2 คนใช้:
  // ตัวตาราง (filtered) และตัวนับจำนวนในตัวเลือกของตัวกรองแต่ละอัน ทั้งคู่ต้องอิงแท็บเดียวกันเสมอ
  const viewBase = useMemo(() => {
    if (viewFilter === "expired") return contracts.filter(isExpiredContract);
    return viewFilter === "all" ? contracts
      : viewFilter === "overdue" ? contracts.filter((c) => c.isRealContract && nextVisitOverdueInfo(c))
      : viewFilter === "ungrouped" ? contracts.filter((c) => !c.isRealContract && !c.isConfirmedGeneral && !c.isConfirmedProject)
      : viewFilter === "general" ? contracts.filter((c) => !c.isRealContract && c.isConfirmedGeneral)
      : viewFilter === "project" ? contracts.filter((c) => !c.isRealContract && c.isConfirmedProject)
      : contracts.filter((c) => c.isRealContract);
  }, [contracts, viewFilter]);

  const filtered = useMemo(() => {
    // ⚠️ แท็บสัญญาหมดอายุข้ามตัวกรองปีเหมือนตอนนับ ไม่งั้นตัวเลขบนแท็บกับจำนวนแถวในตารางจะไม่ตรงกัน
    return applyCommonFilters(viewBase, { ignoreYear: viewFilter === "expired" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewBase, search, viewFilter, yearFilter, responsibleFilter, titleFilter, systemFilter, departmentFilter, statusFilter, durationFilter, dateFrom, dateTo]);

  // ✅ จำนวนต่อตัวเลือกของตัวกรอง "แผนก" และ "สถานะสัญญา" — โชว์ในตัวเลือกเลย ให้รู้ตั้งแต่ยังไม่กด
  // 🐛 BUG ที่แก้ (ตัวเลขไม่ตรงกับที่เห็นในตาราง): เดิมนับจาก contracts ทั้งชุดของทั้งระบบ ไม่สนใจว่า
  // กำลังเปิดแท็บไหนหรือกรองอะไรค้างไว้ — เปิดแท็บ "งานสัญญา" ที่มี 12 แถว แต่ตัวเลือกกลับขึ้น
  // "ฝ่ายบริการ (455)" ซึ่งไม่ตรงกับอะไรบนหน้าจอเลยสักตัว
  // ✅ ตอนนี้อิงจาก "แถบที่เปิดอยู่" + ตัวกรองอื่นที่ตั้งไว้ทั้งหมด ยกเว้นตัวมันเอง (ดู skip ที่
  // applyCommonFilters) ตัวเลขจึงอ่านได้ตรงตัวว่า "ถ้ากดอันนี้จะเหลือกี่แถว" และรวมกันแล้วเท่ากับ
  // จำนวนแถวที่เห็นอยู่จริงเสมอ
  const departmentCounts = useMemo(() => {
    const counts = {};
    applyCommonFilters(viewBase, { ignoreYear: viewFilter === "expired", skip: "department" })
      .forEach((c) => {
        const key = c.departmentTag || DEPARTMENT.SERVICE;
        counts[key] = (counts[key] || 0) + 1;
      });
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewBase, search, viewFilter, yearFilter, responsibleFilter, titleFilter, systemFilter, statusFilter, durationFilter, dateFrom, dateTo]);

  // ⚠️ 1 แถวติดได้หลายสถานะพร้อมกัน (เช่น "หมดอายุแล้ว" + "มีหมายเหตุที่พิมพ์เอง" — ดู statusKinds)
  // ผลรวมของทุกตัวเลือกจึงมากกว่าจำนวนแถวได้ ซึ่งถูกต้องแล้วและตั้งใจ: แต่ละตัวเลขยังตอบคำถามเดิม
  // ว่า "ถ้ากดอันนี้จะเหลือกี่แถว" ได้ตรงตัวอยู่
  const statusCounts = useMemo(() => {
    const counts = {};
    applyCommonFilters(viewBase, { ignoreYear: viewFilter === "expired", skip: "status" })
      .forEach((c) => { statusKinds(c).forEach((k) => { counts[k] = (counts[k] || 0) + 1; }); });
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewBase, search, viewFilter, yearFilter, responsibleFilter, titleFilter, systemFilter, departmentFilter, durationFilter, dateFrom, dateTo]);

  // ✅ ตัวเลือกของตัวกรอง "อายุสัญญา" — สร้างจากอายุที่มีอยู่จริงในแท็บนี้เท่านั้น ไม่ hardcode 1/2/3 ปี
  // ไว้ตายตัว (ที่ไหนมีสัญญา 5 ปีก็ต้องเลือกได้ ที่ไหนมีแต่ปีต่อปีก็ไม่ต้องมีตัวเลือกที่กดแล้วว่างเปล่า)
  const durationOptions = useMemo(() => {
    const counts = {};
    let none = 0;
    applyCommonFilters(viewBase, { ignoreYear: viewFilter === "expired", skip: "duration" })
      .forEach((c) => {
        const d = contractDurationYears(c);
        if (d === null) none += 1;
        else counts[d] = (counts[d] || 0) + 1;
      });
    return {
      years: Object.keys(counts).map(Number).sort((a, b) => a - b).map((y) => ({ value: String(y), label: `${y} ปี`, count: counts[y] })),
      none,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewBase, search, viewFilter, yearFilter, responsibleFilter, titleFilter, systemFilter, departmentFilter, statusFilter, dateFrom, dateTo]);

  // ✅ จำนวนงานที่ยังไม่เคยมอบหมายผู้รับผิดชอบ — ตัวเลือกในตัวกรองผู้รับผิดชอบ ให้ไล่เก็บงานที่ตกหล่น
  // ได้ในคลิกเดียว (เดิมต้องไล่ดูทีละแถวเอง) โผล่เฉพาะตอนมีจริง — นับแบบเดียวกับ 2 ตัวด้านบนเป๊ะๆ
  // (อิงแท็บที่เปิดอยู่ + ตัวกรองอื่น ยกเว้นตัวกรองผู้รับผิดชอบเอง) ตัวเลขทั้งแถวเครื่องมือจึงพูดตรงกัน
  const unassignedResponsibleCount = useMemo(
    () => applyCommonFilters(viewBase, { ignoreYear: viewFilter === "expired", skip: "responsible" })
      .filter((c) => !c.responsiblePerson).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewBase, search, viewFilter, yearFilter, titleFilter, systemFilter, departmentFilter, statusFilter, durationFilter, dateFrom, dateTo]
  );

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
    commission: (c) => (c.commission != null && c.commission !== "" ? Number(c.commission) : null),
    responsiblePerson: (c) => c.responsiblePerson || "",
    // เรียงด้วย "ป้ายภาษาไทย" ไม่ใช่ค่าดิบ — ผู้ใช้คาดหวังลำดับตามที่ตาเห็น (ขาย ก่อน บริการ) ไม่ใช่
    // ตามค่าที่เก็บในฐานข้อมูล (sales ก่อน service ซึ่งบังเอิญตรงกันในกรณีนี้ แต่จะเพี้ยนทันทีถ้าเพิ่มแผนกใหม่)
    departmentTag: (c) => departmentMeta(c.departmentTag).label,
    remark: (c) => c.remark || "",
    // ⚠️ เรียงตาม "ความเร่งด่วน" ไม่ใช่ตามตัวอักษรของข้อความ — หมดอายุแล้วต้องมาก่อนใกล้หมดอายุเสมอ
    // ถ้าเรียงตามข้อความ "ข้อมูลไม่ครบ" จะมาก่อน "หมดอายุแล้ว" ซึ่งกลับหัวกลับหางกับสิ่งที่คนอยากเห็น
    status: (c) => {
      const order = { expired: 0, incomplete: 1, expiring: 2, note: 3, active: 4, none: 5 };
      const sd = statusDisplay(c);
      return `${order[sd.kind] ?? 9}${sd.label}`;
    },
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

  // ✅ แสดงแค่หน้าละ 10 แถว (มือถือ 5 แถวทั้งแบบการ์ดและแบบตาราง — จอแคบต้องเลื่อนลงหาปุ่มเปลี่ยนหน้า
  // ไกลเกินไปถ้าใช้เลขเดียวกับจอกว้าง) — เดิมโชว์ทุกแถวรวดเดียว (สูงสุดเป็นร้อย) ต้องเลื่อนในกรอบตาราง
  // ยาวๆ ตลอดเวลา ตัดเป็นหน้าให้สั้นกระชับแทน (ตัวกรอง/ค้นหายังใช้กับข้อมูลทั้งหมดเหมือนเดิม แค่ตัดแสดงผล)
  // ✅ 5 แถวยังช่วยให้คอลัมน์ "ครั้งที่ N" ของแต่ละหน้าแคบลงอีก เพราะจำนวนคอลัมน์คิดจากแถวในหน้านั้น
  // (ดู visitColumns) — ยิ่งแถวต่อหน้าน้อย โอกาสที่สัญญาครั้งเยอะๆ จะลากคอลัมน์ว่างมาให้ทั้งหน้าก็ยิ่งน้อย
  const PAGE_SIZE = isMobile ? 5 : 10;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search, viewFilter, yearFilter, responsibleFilter, titleFilter, systemFilter, sortConfig, isMobile, useMobileTable]);
  // ✅ ป้องกันพลาด: ล้างการเลือกทุกครั้งที่สลับแท็บมุมมอง — เดิมการเลือกค้างข้ามแท็บได้ (checkbox มีเฉพาะ
  // บางแท็บ ดู showCheckboxes) ทำให้เลือกงานไว้ในแท็บหนึ่ง สลับไปอีกแท็บที่มองไม่เห็นแถวพวกนั้นแล้ว แต่แถบ
  // "เลือกไว้ N งาน" ยังลอยอยู่ + กด "จัดกลุ่มเป็นสัญญา" ได้ทันที = รวมงานที่มองไม่เห็นอยู่ตรงหน้าเข้าด้วยกัน
  // โดยไม่มีทางตรวจทานก่อนเลย ซึ่งเป็นการกระทำที่ย้อนกลับเองไม่ได้ง่ายๆ
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { clearSelection(); }, [viewFilter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // 🐛 BUG ที่แก้ (ตารางว่างเปล่าทั้งที่หัวข้อบอกว่ามี N สัญญา): เดิมตัดแถวด้วย `page` ดิบๆ ซึ่งรีเซ็ตเป็น 1
  // เฉพาะตอนเปลี่ยนตัวกรอง/คำค้นหาเท่านั้น — แต่จำนวนแถวลดลงเองได้อีกหลายทางโดยที่ตัวกรองไม่เปลี่ยนเลย
  // (auto-refresh ทุก 15 วินาทีแล้วมีคนอื่นลบ/ย้ายงาน, ลบสัญญาเอง, จัดหมวดหมู่แถวออกไปจากแท็บนี้ ฯลฯ)
  // พอ page ค้างเกินจำนวนหน้าจริง slice จะได้ [] → ตารางว่างเปล่าสนิทโดยไม่มีอะไรอธิบาย ต้องกดเปลี่ยน
  // ตัวกรองไปมาเองถึงจะกลับมา — clamp ไว้เสมอ (เทียบ pattern เดียวกับ draftsSafePage ใน Dashboard.js)
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(
    () => sortedFiltered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sortedFiltered, safePage, PAGE_SIZE]
  );

  // ✅ นับจากแถวที่แสดงอยู่จริง (ไม่ใช่ `contracts` ทั้งก้อนแบบเดิม) — เดิมถ้ามีสัญญาไหนสักอันในระบบที่มี
  // จำนวนครั้งเยอะ (เช่น 24) ตารางจะโชว์คอลัมน์ "ครั้งที่ 1-24" ตลอด แม้กรองปี/ค้นหาจนเหลือแต่สัญญา
  // 2-4 ครั้งอยู่ก็ตาม กว้างเกินจำเป็นและไม่ตรงกับสิ่งที่กรองไว้จริง
  // ✅ แถวที่ไม่ใช่สัญญาจริง (งานทั่วไป/ยังไม่จัดกลุ่ม) ไม่มี visitCount ให้ใช้ (ดู groupEventsByContract)
  // แต่ยังต้องดึง "ครั้งที่" จริงที่บันทึกไว้ในแต่ละ document (field time) มานับด้วย ไม่งั้นงานที่เคย
  // เลือก "ครั้งที่ 2" ไว้ตอนเพิ่มงานจะไม่มีคอลัมน์ให้แสดงเลย (ตารางมีแค่คอลัมน์เท่าที่สัญญาอื่นต้องการ)
  const rowMaxRound = (c) => c.isRealContract
    ? (c.visitCount || countUsedRounds(c.visits))
    : Math.max(1, ...c.visits.map((v) => Number(v.time) || 1));
  // 🐛 BUG ที่แก้ (คอลัมน์ "ครั้งที่ N" ว่างเปล่ายาวเป็นพรืดจนเปลืองหน้าจอ): เดิมจำนวนคอลัมน์คำนวณจาก
  // rowMaxRound ซึ่งคืนค่า visitCount = "จำนวนครั้งที่วางแผนไว้ทั้งสัญญา" — สัญญาเดียวที่ตั้งไว้ 12 ครั้ง
  // แต่เพิ่งลงจริงไป 1 ครั้ง ก็ลากให้ทั้งตารางต้องมีคอลัมน์ครั้งที่ 1-12 ทันที ทั้งที่ครั้งที่ 3-12 ว่าง
  // เปล่าทุกแถวไม่มีข้อมูลอะไรเลยสักตัว (ดูภาพที่ผู้ใช้ส่งมา — ครั้งที่ 3 ถึง 11 ว่างหมดทั้งคอลัมน์)
  // ✅ เปลี่ยนมานับจาก "ครั้งที่มีข้อมูลจริง" แทน แล้วเผื่ออีก 1 ช่องไว้ให้ปุ่ม "+ เพิ่มครั้งถัดไป" เท่านั้น
  // (ยังกดเพิ่มครั้งถัดไปได้ครบเหมือนเดิมทุกประการ พอเพิ่มแล้วคอลัมน์ถัดไปจะโผล่มาเองอัตโนมัติ) และยัง
  // ไม่เกิน visitCount ที่ตั้งไว้อยู่ดี
  const rowVisibleRounds = (c) => {
    if (!c.isRealContract) return Math.max(1, ...c.visits.map((v) => Number(v.time) || 1));
    // ⚠️ นับรวมแผนงานล่วงหน้าที่ยังไม่มีวันที่ (unscheduled) ด้วย — ช่องพวกนั้นมีป้าย "รอวางแผน" แสดงอยู่
    // ถือว่ามีข้อมูลแล้ว ถ้าไม่นับคอลัมน์จะหายไปทั้งที่มีอะไรให้ดู
    const maxWithData = c.visits.reduce((m, v) => Math.max(m, Number(v.time) || 1), 0);
    const nextOpenRound = countUsedRounds(c.visits.filter((v) => !v.unscheduled)) + 1;
    return Math.min(rowMaxRound(c), Math.max(maxWithData, nextOpenRound));
  };
  // ✅ Math.min กับ MAX_VISIT_COUNT ไว้อีกชั้น — แม้ทุกจุดตั้งค่าจะเช็ค ≤12 แล้ว เผื่อมีข้อมูลเก่า/
  // นำเข้าจากที่อื่นที่หลุดรอดเกินมา ตารางจะไม่มีทางเรนเดอร์คอลัมน์เกิน MAX_VISIT_COUNT ได้เด็ดขาด
  const roundColumnsFor = (rows) => {
    const max = Math.min(MAX_VISIT_COUNT, rows.reduce((m, c) => Math.max(m, rowVisibleRounds(c)), 1));
    return Array.from({ length: max }, (_, i) => i + 1);
  };
  // 🐛 BUG ที่แก้ (คอลัมน์ "ครั้งที่ N" ว่างทั้งคอลัมน์ในหน้าที่เปิดอยู่): เดิมนับจาก `filtered` = ทุกแถวที่
  // ผ่านตัวกรอง "ทุกหน้ารวมกัน" — แต่ตารางแสดงทีละ 10 แถว ถ้ามีสัญญาเข้าทุก 3 เดือน (6 ครั้ง) ไปตกอยู่
  // หน้า 3 ทุกหน้าที่เหลือก็ต้องลากคอลัมน์ครั้งที่ 5-6 ที่ว่างเปล่าทั้งคอลัมน์ติดไปด้วย ทำให้ตารางกว้าง
  // เกินจำเป็น ต้องเลื่อนผ่านช่องว่างหลายจอกว่าจะถึงคอลัมน์ท้ายๆ อย่าง "ผู้รับผิดชอบ" (ดูภาพที่ผู้ใช้ส่งมา)
  // ✅ นับจาก `pagedRows` = เฉพาะแถวที่แสดงอยู่ในหน้านี้จริงๆ คอลัมน์จะโผล่/หายเองตามข้อมูลของแต่ละหน้า
  const visitColumns = useMemo(
    () => roundColumnsFor(pagedRows),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pagedRows]
  );
  // ⚠️ ไฟล์ Excel ส่งออก "ทุกหน้ารวมกัน" (sortedFiltered) จึงต้องใช้จำนวนคอลัมน์ของทั้งชุดข้อมูล ไม่ใช่ของ
  // หน้าที่บังเอิญเปิดค้างไว้ตอนกดส่งออก ไม่งั้นข้อมูลครั้งที่ของแถวหน้าอื่นจะหายไปจากไฟล์แบบเงียบๆ
  const exportVisitColumns = useMemo(
    () => roundColumnsFor(filtered),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered]
  );
  const totalTableWidth = useMemo(() => {
    let total = colWidth("actions") + (showCheckboxes ? colWidth("checkbox") : 0);
    // ✅ jobValue ย้ายออกจาก contractOnlyKeys — แสดงทุกแท็บแล้ว (งานทั่วไป/โปรเจค/ยังไม่จัดกลุ่มก็มี
    // มูลค่างานของตัวเองได้ ข้อมูลมีอยู่ในฐานข้อมูลอยู่แล้วทุกแถว แค่เดิมไม่ได้แสดงให้เห็น)
    // ✅ ยุบคอลัมน์ที่อ่านคู่กันเสมอให้เหลือช่องเดียว (ดูหัวตาราง/แถวข้อมูล): เลขที่สัญญา+ใบเสนอราคา →
    // docRef, บริษัท+โครงการ → customer, ประเภทงาน+ระบบ → work, เริ่ม+สิ้นสุด+รอบเข้า → period,
    // จำนวนครั้งทั้งหมด → รวมอยู่ในป้าย "คืบหน้า" (progress) แล้ว — คีย์ย่อยเดิมไม่มีคอลัมน์ของตัวเองอีก
    // ต่อไป จึงต้องไม่นับความกว้างซ้ำตรงนี้ ไม่งั้นตารางจะกว้างเกินจริงจนมีที่ว่างค้างท้ายแถว
    const contractOnlyKeys = ["docRef", "period", "status"];
    ["customer", "work", "jobValue", "commission", "progress", "responsiblePerson"].forEach((k) => { total += colWidth(k); });
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
  }, [colWidths, showCheckboxes, visitColumns, hideContractOnlyColumns, useMobileTable]);
  // ✅ ค่าความกว้างจริงของทุกคอลัมน์ ตั้งเป็น CSS custom property ไว้ที่ <Table> ตัวเดียว (ผ่าน style
  // prop ปกติของ React) ให้ทุกเซลล์ลูกอ้างอิงผ่าน var(--col-<key>) — เห็นผลทันทีทุกครั้งที่ colWidths
  // เปลี่ยนจริง (โหลดจาก localStorage ตอนเปิดหน้า/auto-fit/commit ท้ายการลาก) โดยไม่ต้องแตะ sx ของเซลล์
  // แต่ละใบเลยสักคอลัมน์ — ดู handleColResize/colVar ด้านบนสำหรับเหตุผลที่ย้ายมาใช้กลไกนี้แทนตัวเลขตรงๆ
  const tableCssVars = useMemo(() => {
    const vars = { "--col-total": `${totalTableWidth}px` };
    ["docRef", "docNo", "customer", "work", "period", "jobValue", "commission", "status", "progress", "responsiblePerson"].forEach((k) => {
      vars[`--col-${k}`] = `${colWidth(k)}px`;
    });
    visitColumns.forEach((n) => { vars[`--col-visit_${n}`] = `${colWidth(`visit_${n}`)}px`; });
    return vars;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colWidths, totalTableWidth, visitColumns, useMobileTable]);

  // ✅ สไตล์เสริม "เฉพาะตอนดูตารางบนจอมือถือ" — ตัวตารางเป็น JSX ก้อนเดียวกับจอคอมทุกประการ ไม่ได้
  // เขียนตารางแยกอีกชุด (ดู MOBILE_VIEW_STORAGE_KEY) แค่ย่อขนาดตัวอักษร/ระยะขอบในเซลล์ให้พอดีจอแคบ
  // ⛔ ไม่ตรึง (freeze) คอลัมน์ใดไว้กับขอบซ้ายแล้ว ตามที่ผู้ใช้ขอ — เดิมตรึงคอลัมน์เลขที่เอกสารไว้ให้รู้ว่า
  //    กำลังอ่านแถวไหน แต่ผลจริงบนจอแคบคือคอลัมน์ที่ตรึงกินพื้นที่จอไปก้อนหนึ่งตลอดเวลา แถมมีเนื้อหา
  //    คอลัมน์อื่นวิ่งลอดอยู่ข้างหลังจนดูสับสนว่าตกลงช่องที่เห็นเป็นของคอลัมน์ไหนกันแน่ ตอนนี้ทุกคอลัมน์
  //    เลื่อนไปพร้อมกันเป็นตารางเดียวตรงไปตรงมา ส่วนการกลับไปดูว่า "แถวนี้คืองานอะไร" กดปุ่ม ‹ เลื่อน
  //    กลับมาคอลัมน์แรกได้ทันที (ดูปุ่มลูกศรที่ลอยอยู่ข้างตาราง)
  // ⚠️ พอไม่ตรึงแล้วก็ไม่ต้องสลับไป border-collapse:separate อีก (ที่ต้องสลับเพราะ position:sticky ใช้กับ
  //    collapse ไม่ได้ เส้นขอบจะเลื่อนหนีไปกับตาราง) ใช้ collapse ของตารางหลักตามเดิมได้เลย เส้นไม่ซ้อนกัน
  const mobileTableSx = useMemo(() => {
    if (!useMobileTable) return null;
    return {
      // ⚠️ คีย์นี้ทับของตารางหลักทั้งก้อน (ไม่ได้ merge ทีละ property) จึงต้องเขียนเส้นขอบซ้ำให้ครบ
      // ตามตารางหลัก ไม่งั้นตารางบนมือถือจะกลายเป็นไม่มีเส้นคั่นเลย
      "& th, & td": {
        border: "none",
        borderBottom: `1px solid ${BORDER_SOFT}`,
        borderRight: `1px solid ${BORDER_HAIR}`,
        fontSize: "0.76rem",
        px: 0.75,
      },
      "& tfoot td": { bgcolor: SURFACE_SUBTLE },
    };
  }, [useMobileTable]);

  // ── ตัวช่วยเลื่อนตารางแนวนอน ────────────────────────────────────────────────
  // ✅ ปัญหาที่ผู้ใช้เจอ ("เลื่อนตารางบนมือถือยาก") ไม่ได้มีสาเหตุเดียว แก้ครบทุกข้อดังนี้:
  //  1. แถบลากปรับความกว้างคอลัมน์ตั้ง touchAction:"none" ขวางอยู่ทั่วแถวหัวตาราง → ปิดทิ้งบนมือถือ
  //     (ดูคอมเมนต์ที่ ResizableTh)
  //  2. ตารางกว้างรวมเกิน 1,300px บนจอ 375px → ใช้ความกว้างคอลัมน์ชุดย่อ (ดู MOBILE_COL_WIDTHS)
  //  3. iOS Safari ตีความการปัดแนวนอนใกล้ขอบจอเป็น "ปัดย้อนกลับหน้าเว็บ" แย่งไปจากตาราง →
  //     overscrollBehaviorX:"contain" บอกเบราว์เซอร์ว่าการเลื่อนจบที่กล่องนี้ ห้ามส่งต่อ
  //  4. มือถือซ่อน scrollbar เป็นค่าเริ่มต้น → ไม่มีอะไรบอกเลยว่า "ยังมีคอลัมน์ต่อทางขวาอีกนะ" และไม่รู้
  //     ว่าตอนนี้เลื่อนมาถึงไหนแล้ว → ทำ scrollbar บางๆ ให้เห็นตลอด + ปุ่มลูกศรกดเลื่อนทีละหน้า
  // ตัวนี้คือส่วนที่ 4: ติดตามว่ายังเลื่อนไปทางไหนได้อีกบ้าง เพื่อซ่อน/แสดงปุ่มลูกศรให้ตรงความจริง
  const tableScrollRef = useRef(null);
  const [tableScroll, setTableScroll] = useState({ canLeft: false, canRight: false });
  const syncTableScroll = useCallback(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    // ⚠️ เผื่อ 2px — ค่า scrollLeft ของเบราว์เซอร์เป็นทศนิยมได้ (จอ retina/ซูม) ถ้าเทียบเท่ากันเป๊ะๆ
    // ปุ่มจะกะพริบค้างอยู่ทั้งที่เลื่อนสุดทางแล้ว
    const canRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    const canLeft = el.scrollLeft > 2;
    setTableScroll((prev) => (prev.canLeft === canLeft && prev.canRight === canRight ? prev : { canLeft, canRight }));
  }, []);
  // ✅ ต้องคำนวณใหม่เมื่อ "สิ่งที่ทำให้ตารางกว้างขึ้น/แคบลง" เปลี่ยน ไม่ใช่แค่ตอนเลื่อน — สลับแท็บ
  // (คอลัมน์ไม่เท่ากัน) / สลับมุมมอง / เปลี่ยนหน้า / ปรับความกว้างคอลัมน์ ล้วนเปลี่ยนความกว้างรวมทั้งนั้น
  useEffect(() => {
    syncTableScroll();
    const el = tableScrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(syncTableScroll);
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncTableScroll, useMobileTable, viewFilter, totalTableWidth, loading, filtered.length]);
  // ✅ เปลี่ยนหน้า/สลับแท็บแล้วให้ตารางเลื่อนกลับมาคอลัมน์แรกเสมอ — จำเป็นมากขึ้นตั้งแต่จำนวนคอลัมน์
  // "ครั้งที่ N" คิดจากแถวในหน้านั้นๆ (ดู visitColumns) เพราะหน้าถัดไปอาจมีคอลัมน์น้อยกว่าหน้าที่เพิ่งดู
  // อยู่ ถ้าปล่อยให้ค้างอยู่กลางตาราง ผู้ใช้จะเจอหน้าใหม่ที่เปิดมาแล้วเห็นแต่ช่องท้ายๆ หรือช่องว่าง
  useEffect(() => {
    const el = tableScrollRef.current;
    if (el) el.scrollLeft = 0;
  }, [safePage, viewFilter]);
  const scrollTableBy = (dir) => {
    const el = tableScrollRef.current;
    if (!el) return;
    // ✅ เลื่อนทีละ 80% ของความกว้างที่เห็น (ไม่ใช่ 100%) — เหลือคอลัมน์เดิมค้างไว้ให้เห็นนิดหน่อย
    // จะได้รู้ว่าเลื่อนต่อจากตรงไหน ไม่ใช่กระโดดไปจนหลุดบริบททั้งหมด
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  // ✅ สรุปยอดมูลค่างาน — คิดจาก `filtered` (ทุกแถวที่ผ่านตัวกรอง ทุกหน้ารวมกัน) ไม่ใช่แค่ 10 แถวที่เห็น
  // อยู่ในหน้านี้ เพราะ "ยอดรวมทั้งหมด" ต้องหมายถึงทั้งชุดข้อมูลที่กรองไว้เสมอ ไม่งั้นตัวเลขจะเปลี่ยนไป
  // มาทุกครั้งที่กดเปลี่ยนหน้า ซึ่งไม่มีความหมายทางบัญชีเลย — ป้ายกำกับใน UI ระบุชัดว่า "ทุกหน้า"
  // ✅ นับ "ยังไม่ระบุมูลค่า" แยกไว้ด้วย — สำคัญมากต่อความน่าเชื่อถือของยอดรวม เพราะถ้ามีแถวที่ยังไม่ได้
  // กรอกมูลค่าปนอยู่ ยอดรวมนี้คือ "ยอดเท่าที่กรอกแล้ว" ไม่ใช่ยอดจริงทั้งหมด ต้องบอกให้เห็นตรงๆ ไม่ใช่
  // ปล่อยให้เข้าใจผิดว่าครบแล้ว (ยอดเงินที่ดูเหมือนสมบูรณ์ทั้งที่ขาดข้อมูลคือความเสี่ยงในการตัดสินใจ)
  const jobValueSummary = useMemo(() => {
    let total = 0;
    let filledCount = 0;
    filtered.forEach((c) => {
      const n = Number(c.jobValue);
      if (c.jobValue !== null && c.jobValue !== undefined && c.jobValue !== "" && !Number.isNaN(n)) {
        total += n;
        filledCount += 1;
      }
    });
    return { total, filledCount, missingCount: filtered.length - filledCount, rowCount: filtered.length };
  }, [filtered]);

  // ✅ ยอดรวมค่าคอม — ใช้ "filtered" ชุดเดียวกับยอดรวมมูลค่างานเป๊ะๆ จะได้อ่านเทียบกันได้ตรงๆ ว่างาน
  // ชุดนี้มูลค่าเท่านี้ จ่ายคอมไปเท่านี้ คิดเป็นกี่ %
  // ⚠️ เปอร์เซ็นต์รวมคิดจาก "ผลรวมคอม ÷ ผลรวมมูลค่างาน" ไม่ใช่เฉลี่ยของ % รายแถว — แถวที่มูลค่า
  // 5 ล้านกับแถวที่มูลค่า 5 หมื่นต้องถ่วงน้ำหนักต่างกัน ไม่งั้นตัวเลขจะเพี้ยนไปคนละเรื่อง
  const commissionSummary = useMemo(() => {
    let total = 0;
    let filledCount = 0;
    filtered.forEach((c) => {
      const n = Number(c.commission);
      if (c.commission !== null && c.commission !== undefined && c.commission !== "" && !Number.isNaN(n)) {
        total += n;
        filledCount += 1;
      }
    });
    return { total, filledCount };
  }, [filtered]);

  // ✅ จำนวนคอลัมน์ก่อน/หลังช่อง "มูลค่างาน" — ใช้ทำแถวสรุปท้ายตาราง (TableFooter) ให้ยอดรวมตกลงมา
  // ตรงใต้คอลัมน์มูลค่างานพอดีเสมอ ⚠️ ต้องตรงกับลำดับคอลัมน์จริงในหัวตาราง/แถวข้อมูลเป๊ะๆ ถ้าเพิ่ม/ลด
  // คอลัมน์ตรงไหนต้องมาปรับตรงนี้ด้วย ไม่งั้นยอดรวมจะเลื่อนไปอยู่ผิดคอลัมน์
  // ✅ สรุปการวางบิล/รับเงินของทุกแถวที่กรองอยู่ (ทุกหน้า ไม่ใช่เฉพาะหน้าที่เปิด) — ชุดข้อมูลเดียวกับ
  // ยอดรวมมูลค่างานด้านล่างเป๊ะๆ (sortedFiltered) จะได้อ่านเทียบกันได้ตรงๆ ว่า "งานมูลค่าเท่านี้
  // วางบิลไปแล้วเท่าไร เก็บเงินได้เท่าไร เหลือเก็บเท่าไร"
  const billingSummary = useMemo(() => sortedFiltered.reduce((acc, c) => {
    const bs = contractBillingSummary(c.visits);
    if (!bs) return acc;
    return {
      net: acc.net + bs.net,
      paid: acc.paid + bs.paid,
      outstanding: acc.outstanding + bs.outstanding,
      overdueRows: acc.overdueRows + (bs.state === "overdue" ? 1 : 0),
      notInvoicedRows: acc.notInvoicedRows + (bs.invoicedCount < bs.totalCount ? 1 : 0),
    };
  }, { net: 0, paid: 0, outstanding: 0, overdueRows: 0, notInvoicedRows: 0 }), [sortedFiltered]);

  const footerColSpan = useMemo(() => {
    const before =
      (showCheckboxes ? 1 : 0) +
      1 +                                    // departmentTag (ป้ายกำกับแผนก — คอลัมน์แรกสุด)
      1 +                                    // docNo | docRef (เลขที่สัญญา+ใบเสนอราคายุบเป็นช่องเดียว)
      2 +                                    // customer (บริษัท+โครงการ) / work (ประเภทงาน+ระบบ)
      (hideContractOnlyColumns ? 0 : 1);    // period (เริ่ม+สิ้นสุด+รอบเข้า)
    const after =
      (hideContractOnlyColumns ? 0 : 1) +   // status
      1 +                                    // progress
      visitColumns.length +
      1 +                                    // responsiblePerson
      1 +                                    // remark (หมายเหตุ)
      1;                                     // actions
    return { before, after };
  }, [showCheckboxes, hideContractOnlyColumns, visitColumns.length]);


  // ✅ สรุปว่าตอนนี้มีตัวกรองอะไรทำงานอยู่บ้าง — ใช้อธิบายตอนตารางว่าง (กันเข้าใจผิดว่าข้อมูลหาย) และ
  // ผูกกับปุ่ม "ล้างตัวกรองทั้งหมด" ให้กลับมาเห็นข้อมูลได้ในคลิกเดียว ไม่ต้องไล่รีเซ็ตเองทีละช่อง
  // ⚠️ ไม่รวม viewFilter (แท็บมุมมอง) — เป็นการเลือกว่าจะดูอะไรอยู่ ไม่ใช่ "ตัวกรองซ้อน" ที่ควรถูกล้าง
  const activeFilterLabels = useMemo(() => {
    const labels = [];
    if (search.trim()) labels.push(`ค้นหา "${search.trim()}"`);
    if (titleFilter !== "all") labels.push(`ประเภทงาน ${titleFilter}`);
    if (systemFilter !== "all") labels.push(`ระบบ ${systemFilter}`);
    if (responsibleFilter === "unassigned") labels.push("ยังไม่มอบหมายผู้รับผิดชอบ");
    else if (responsibleFilter !== "all") labels.push(`ผู้รับผิดชอบ ${responsibleFilter}`);
    if (yearFilter === YEAR_FILTER_NONE) labels.push("ยังไม่ระบุปี");
    else if (yearFilter === YEAR_FILTER_CUSTOM) {
      // ⚠️ แสดงเป็น พ.ศ. ให้ตรงกับที่กรอกในช่อง (ทั้งหน้าใช้ พ.ศ. หมด) ไม่ใช่ ค.ศ. ที่เก็บอยู่เบื้องหลัง
      if (dateFrom && dateTo) labels.push(`สัญญาช่วง ${thaiDateNumeric(dateFrom)} – ${thaiDateNumeric(dateTo)}`);
      else if (dateFrom) labels.push(`เริ่มสัญญาตั้งแต่ ${thaiDateNumeric(dateFrom)}`);
      else if (dateTo) labels.push(`สิ้นสุดสัญญาภายใน ${thaiDateNumeric(dateTo)}`);
    }
    // ⚠️ ป้ายนี้ต้องเป็น พ.ศ. เหมือนที่โชว์ใน dropdown (ค่าที่เก็บเป็น ค.ศ. — ดูคอมเมนต์ที่ตัวเลือกปี)
    else if (yearFilter !== YEAR_FILTER_ALL) labels.push(`ปี ${Number(yearFilter) + 543}`);
    if (departmentFilter !== "all") labels.push(`แผนก ${departmentMeta(departmentFilter).label}`);
    if (statusFilter !== "all") {
      labels.push(`สถานะ ${STATUS_FILTER_OPTIONS.find((o) => o.value === statusFilter)?.label || statusFilter}`);
    }
    if (durationFilter === "none") labels.push("ยังไม่ระบุอายุสัญญา");
    else if (durationFilter !== "all") labels.push(`สัญญา ${durationFilter} ปี`);
    return labels;
  }, [search, titleFilter, systemFilter, responsibleFilter, yearFilter, departmentFilter, statusFilter, durationFilter, dateFrom, dateTo]);
  const hasActiveFilters = activeFilterLabels.length > 0;
  // ✅ จำนวนตัวกรองแบบ dropdown ที่ทำงานอยู่ (ไม่นับช่องค้นหา ซึ่งบนมือถือโชว์อยู่ตลอดอยู่แล้ว) — ใช้เป็น
  // ตัวเลขบนปุ่ม "ตัวกรอง" ให้รู้ว่ามีตัวกรองซ่อนอยู่กี่ตัวโดยไม่ต้องกางออกมาดู — ตอนนี้ตัวกรองทุกตัว
  // เริ่มต้นที่ "ทุก…" หมด ตัวเลขนี้จึงเป็น 0 ตอนเปิดหน้ามาเสมอ และทุกครั้งที่ขึ้นเลข = ผู้ใช้กดเอง
  const activeDropdownFilterCount = useMemo(
    () => [titleFilter, systemFilter, responsibleFilter, yearFilter, departmentFilter, statusFilter, durationFilter]
      .filter((v) => v !== "all").length
      // ⚠️ เลือก "เลือกช่วงวันที่เอง…" ค้างไว้แต่ยังไม่กรอกวันไหนเลย = ยังไม่ได้กรองอะไร
      // (ตรงกับ applyCommonFilters ที่ข้ามการกรองไปในกรณีนั้น) — yearFilter เองถูกนับไปแล้วด้านบน
      - ((yearFilter === YEAR_FILTER_CUSTOM && !resolveCustomRange(dateFrom, dateTo)) ? 1 : 0),
    [titleFilter, systemFilter, responsibleFilter, yearFilter, departmentFilter, statusFilter, durationFilter, dateFrom, dateTo]
  );
  const clearAllFilters = () => {
    setSearch("");
    setTitleFilter("all");
    setSystemFilter("all");
    setResponsibleFilter("all");
    setYearFilter("all");
    setDepartmentFilter("all");
    setStatusFilter("all");
    setDurationFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  // ✅ ป้ายชื่อแท็บมุมมองปัจจุบันแบบเต็ม — ใช้ในแถบสรุปยอดรวม (ต้องอ่านแล้วเข้าใจทันทีว่ากำลังดูชุดไหน)
  // ⚠️ ตั้งใจแยกจากตารางชื่อย่อใน exportLabels ด้านล่างซึ่งใช้ตั้ง "ชื่อไฟล์" ที่ส่งออก — ชื่อไฟล์ห้ามมี
  // "/" (ตัวคั่นพาธ) และควรสั้นกว่านี้ จึงใช้ชื่อย่อคนละชุดกันโดยเจตนา ไม่ใช่ความซ้ำซ้อนที่ควรยุบรวม
  const VIEW_LABELS = {
    contracts: "งานสัญญา / งานรายปี", overdue: "เลยกำหนดเข้ารอบถัดไป", general: "งานทั่วไป",
    project: "งานโปรเจค", ungrouped: "งานเก่าที่ยังไม่จัดกลุ่ม", all: "ทั้งหมด",
  };
  // ✅ "ตอนนี้ยอดรวมนี้มาจากอะไรบ้าง" — แจกแจงเงื่อนไขที่กรองอยู่จริงทั้งหมดให้เห็นครบทีละอย่าง (แท็บ
  // มุมมอง + ตัวกรองทุกช่อง + คำค้นหา) ตามที่ผู้ใช้ขอ — ยอดเงินที่ไม่บอกว่านับจากชุดข้อมูลไหน ตีความ
  // ผิดได้ง่ายมาก (โดยเฉพาะตัวกรองปีซึ่งตั้งค่าเริ่มต้นเป็นปีปัจจุบันไว้เองตั้งแต่แรก ผู้ใช้ไม่ได้ตั้ง
  // จึงไม่มีทางเดารู้เลยว่ายอดที่เห็นไม่ได้รวมทุกปี) — ต่างจาก activeFilterLabels ตรงที่รวมแท็บมุมมอง
  // ด้วยเสมอ เพราะแท็บก็เป็นตัวจำกัดขอบเขตของยอดรวมเหมือนกัน แม้จะไม่ใช่ "ตัวกรองซ้อน" ที่ปุ่มล้างจะล้าง
  const summaryScopeLabels = useMemo(
    () => [`แท็บ: ${VIEW_LABELS[viewFilter] || "ทั้งหมด"}`, ...activeFilterLabels],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewFilter, activeFilterLabels]
  );

  // ✅ ชื่อไฟล์ที่ส่งออกบอกได้ในตัวว่าเป็นข้อมูลชุดไหน ณ วันไหน — เดิมเป็น "contracts.csv" ตายตัวเสมอ
  // ส่งออกหลายแท็บ/หลายปีมาเทียบกันทีก็ทับกันเองในโฟลเดอร์ดาวน์โหลดทุกครั้ง (contracts (1).csv,
  // contracts (2).csv ...) แยกไม่ออกว่าไฟล์ไหนคืออะไร ต้องเปิดดูทีละไฟล์เอง
  const exportLabels = useMemo(() => {
    const viewLabel = {
      contracts: "งานสัญญา", overdue: "เลยกำหนด", expired: "สัญญาหมดอายุ", general: "งานทั่วไป",
      project: "งานโปรเจค", ungrouped: "ยังไม่จัดกลุ่ม", all: "ทั้งหมด",
    }[viewFilter] || "ทั้งหมด";
    // ⚠️ เป็น พ.ศ. ให้ตรงกับที่เลือกบนหน้าจอ — ชื่อไฟล์กับหัวรายงานต้องอ่านแล้วตรงกับตัวเลือกที่กดไป
    // ไม่งั้นเจ้านายเปิดไฟล์มาเห็น "2026" ทั้งที่บนจอเลือก "2569" แล้วสงสัยว่าส่งไฟล์ผิดปีมาให้หรือเปล่า
    const yearLabel = yearFilter === YEAR_FILTER_ALL ? "ทุกช่วงเวลา"
      : yearFilter === YEAR_FILTER_NONE ? "ยังไม่ระบุปี"
      : yearFilter === YEAR_FILTER_CUSTOM ? "ช่วงที่เลือกเอง"
      : String(Number(yearFilter) + 543);
    return { viewLabel, yearLabel };
  }, [viewFilter, yearFilter]);

  // ✅ สร้างไฟล์ Excel จริง (.xlsx) — ดูเหตุผลที่ต้องเลิกใช้ CSV และรายละเอียดการจัดรูปแบบทั้งหมดที่
  // src/features/contracts/utils/contractExcelExport.js — ส่งฟังก์ชันที่หน้าจอใช้อยู่ (contractStatusInfo/
  // formatEventDateRange/visitsPerYear) เข้าไปด้วย เพื่อให้ข้อมูลในไฟล์ตรงกับที่เห็นบนจอเป๊ะๆ เสมอ
  const [exporting, setExporting] = useState(false);
  const handleExportExcel = async () => {
    if (exporting || filtered.length === 0) return;
    setExporting(true);
    try {
      // โหลดโมดูลตอนกดจริงเท่านั้น (exceljs เป็นไลบรารีก้อนใหญ่) — ไม่ให้ไปถ่วงเวลาโหลดหน้าของทุกคน
      // ที่แค่เข้ามาดูตาราง ทั้งที่ส่วนใหญ่ไม่ได้กดส่งออกทุกครั้ง
      const { exportContractsToExcel } = await import("../utils/contractExcelExport");
      await exportContractsToExcel({
        rows: sortedFiltered, // ✅ ใช้ลำดับเดียวกับที่เรียงอยู่บนจอ ไม่ใช่ลำดับดิบ
        visitColumns: exportVisitColumns, // ⚠️ ของทั้งชุด ไม่ใช่ของหน้าที่เปิดอยู่ (ดู exportVisitColumns)
        meta: {
          fileName: `ภาพรวมงาน-${exportLabels.viewLabel}-${exportLabels.yearLabel}-${moment().format("YYYYMMDD")}.xlsx`,
          viewLabel: exportLabels.viewLabel,
          yearLabel: exportLabels.yearLabel,
          filterSummary: hasActiveFilters ? `ตัวกรอง: ${activeFilterLabels.join(" · ")}` : "ไม่ได้กรองเพิ่มเติม",
          exportedAt: formatThai(new Date(), "DD/MM/YYYY HH:mm"),
        },
        contractStatusInfo,
        formatEventDateRange,
        visitsPerYear,
        // ✅ ส่งฟังก์ชันกลางตัวเดียวกับที่ตารางบนจอใช้เข้าไป — คอลัมน์ "คืบหน้า" ในไฟล์จึงตรงกับบนจอเสมอ
        progressLabel: (c) => progressInfo(c, countUsedRounds).label,
        // ✅ ข้อความสถานะและรายชื่อช่องที่ยังไม่ได้กรอก — ฟังก์ชันกลางตัวเดียวกับที่ตาราง/การ์ดมือถือใช้
        // ไฟล์ที่ส่งออกจึงเขียนเหมือนที่เห็นบนจอทุกตัวอักษร รวมถึงหมายเหตุที่คนพิมพ์ทับไว้เองด้วย
        // ⚠️ ในไฟล์ที่ส่งออกไม่มี tooltip/จุดสีให้ชี้ดู — ถ้าหมายเหตุที่พิมพ์เองบังสถานะจริงไว้ ต้องเขียน
        // สถานะจริงต่อท้ายในวงเล็บตรงๆ ไม่งั้นเจ้านายอ่านรายงานแล้วไม่มีทางรู้ว่าสัญญานี้หมดอายุไปแล้ว
        statusLabel: (c) => {
          const sd = statusDisplay(c);
          return sd.auto ? `${sd.label} (${sd.auto.label})` : sd.label;
        },
        missingFields: (c) => contractCompleteness(c).missing.join(" · "),
        durationYears: contractDurationYears,
      });
    } catch (err) {
      Swal.fire({
        title: "ส่งออกไม่สำเร็จ",
        text: err?.message || "กรุณาลองใหม่อีกครั้ง",
        icon: "error",
      });
    } finally {
      setExporting(false);
    }
  };

  // ── ฟอร์ม "เพิ่มสัญญาใหม่" ─────────────────────────────────────────────
  // ✅ เดิมต้องออกจากหน้านี้ไปเปิดปฏิทินแล้วคลิกวันที่เพื่อสร้างงานแบบ "สัญญาแบบหลายครั้ง" เท่านั้น
  // (ดู AddEvent.js) — เพิ่มฟอร์มแบบเดียวกันไว้ในหน้านี้เลย ให้เพิ่มสัญญาใหม่ได้โดยไม่ต้องสลับหน้า
  // 🐛 BUG ที่แก้ (สัญญาใหม่ไม่เคยมีผู้รับผิดชอบจริงสักใบ): เดิมฟอร์มนี้ให้เลือก "ทีมที่เข้างาน" แล้วส่ง
  // team/resPerson ระดับสัญญา ซึ่งขัดกับโมเดลที่ตกลงกันไว้ 2 ข้อพร้อมกัน —
  //   1) "ทีมที่เข้างาน" เป็นของ "แต่ละครั้ง" ไม่ใช่ของทั้งสัญญา (คนละครั้งเข้าคนละทีมได้) จึงตัดคอลัมน์
  //      ระดับสัญญาออกไปแล้ว แก้ที่ช่อง "ครั้งที่ N" แทน — ฟอร์มนี้ยังตั้งค่าระดับสัญญาอยู่ที่เดียว
  //   2) ตอนสร้างสัญญา สิ่งที่ admin/manager ต้องมอบหมายคือ "ผู้รับผิดชอบงาน" (คนที่ติดตามงานนี้ทั้งหมด)
  //      แต่ payload ไม่เคยส่ง responsiblePerson/responsiblePersonId เลย → rawResponsiblePerson ว่าง
  //      เสมอ → สิทธิ์ที่ต้อง "มอบหมายไว้ชัดเจนก่อน" (แก้ไขทีมรายครั้ง — ดู canEditRoundTeam) ไม่เคย
  //      ทำงาน และคอลัมน์ "ผู้รับผิดชอบ" ที่เห็นเป็นแค่ค่า fallback จาก team (ดู groupEventsByContract)
  //      ซึ่งดูเหมือนมอบหมายแล้วทั้งที่ยังไม่เคยมอบหมายจริง
  // ✅ เปลี่ยนช่องนี้เป็น "ผู้รับผิดชอบงาน" ส่ง responsiblePerson/responsiblePersonId ตรงๆ ส่วนทีมที่เข้างาน
  // ย้ายไปเป็นช่องแยกที่โผล่เฉพาะตอนระบุวันที่ครั้งที่ 1 (ผูกกับครั้งที่ 1 เท่านั้น ไม่ใช่ทั้งสัญญา)
  // ⚠️ ตัวค่าเริ่มต้นย้ายไป module scope (EMPTY_CONTRACT_FORM) แล้ว — แถวร่างในตาราง (InlineAddRow)
  // ซึ่งอยู่นอกคอมโพเนนต์นี้ต้องใช้ชุดเดียวกัน จะได้ไม่มีค่าเริ่มต้น 2 ชุดที่หลุดจากกันได้
  const emptyForm = EMPTY_CONTRACT_FORM;
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(emptyForm);

  const setField = (field) => (val) => setForm((f) => ({ ...f, [field]: val }));

  // ✅ พิมพ์เลขเดือนเอง = ข้อมูลอ้างอิงอิสระ ไม่แตะ "จำนวนครั้งทั้งหมด" ด้านบน (งานจริงเลื่อน/ชนกันได้
  // ตลอด ผู้ใช้ต้องกำหนดจำนวนครั้งจริงเองได้เสมอ) — แต่ถ้ากดปุ่มลัด "ปีละ N ครั้ง" ด้านล่าง จะเซ็ต
  // "จำนวนครั้งทั้งหมด" ให้ตรงกันไปด้วยในคลิกเดียว (ตามที่ผู้ใช้ขอ: "ตรงคืบหน้าให้สอดคล้องกับจำนวนรอบ
  // ด้วย" — ดู pickInterval ด้านล่าง) ยังแก้ตัวเลขทั้งสองช่องเองทับได้ตามปกติหลังกดถ้าไม่ตรงกรณี
  const intervalPreviewText = "ไม่บังคับ — พิมพ์เลขเองไม่กระทบจำนวนครั้งด้านบน กดปุ่มลัดด้านล่างจะปรับให้ตรงกันอัตโนมัติ";
  // ✅ ปุ่มลัด "ปีละ N ครั้ง" เซ็ตทั้ง intervalMonths และ visitCount ให้สอดคล้องกันในคลิกเดียว —
  // แยกออกมาเพราะใช้ซ้ำกับฟอร์ม "ย้ายเข้าสัญญาที่มีอยู่" ด้านล่างด้วย (pickMergeInterval)
  const pickInterval = (months) => setForm((f) => ({ ...f, intervalMonths: months, visitCount: String(visitsPerYear(months) || f.visitCount) }));

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
  // ✅ ตัวเลือกของ "ตัวกรองระบบ" = ระบบที่ตั้งค่าไว้ในระบบ + ระบบที่มีอยู่จริงในข้อมูลแต่ยังไม่ได้ตั้งค่าไว้
  // ⚠️ ต้องรวม 2 ทางเสมอ เพราะช่องแก้ไข "ระบบ" ในตารางเป็นแบบ freeSolo (พิมพ์ชื่อระบบใหม่เองได้ ไม่บังคับ
  // เลือกจากรายการ — ดู EditableCell editType="autocomplete") งานเก่าจำนวนมากจึงมีชื่อระบบที่ไม่มีในตาราง
  // ตั้งค่า ถ้าเอาแต่ lookups.systemTypes มาทำตัวเลือกอย่างเดียว ระบบพวกนั้นจะไม่มีให้เลือกในตัวกรองเลย
  // = กรองหางานเหล่านั้นไม่ได้ตลอดกาล ทั้งที่มองเห็นอยู่ในตารางตรงหน้า
  const systemFilterOptions = useMemo(() => {
    const names = new Set(lookups.systemTypes.map((s) => s.name).filter(Boolean));
    contracts.forEach((c) => { if (c.system) names.add(c.system); });
    return [...names].sort((a, b) => String(a).localeCompare(String(b), "th"));
  }, [lookups.systemTypes, contracts]);
  // ⚠️ ตัดชื่อซ้ำออกเสมอ — ทั้งระบบใช้ "ชื่อต้น" เป็นคีย์ระบุคน พนักงาน 2 คนที่ชื่อต้นเหมือนกัน
  // จึงยุบเป็นตัวเลือกเดียวโดยธรรมชาติ ถ้าไม่ตัดซ้ำจะได้ <option> คีย์ซ้ำ (React เตือน และตัวเลือก
  // ซ้ำกันสองบรรทัดที่กดแล้วให้ผลเหมือนกัน) — เรียงตามตัวอักษรไทยให้หาง่ายด้วย
  const teamOptions = useMemo(
    () => [...new Set(lookups.employees.map((e) => e.fname).filter(Boolean))].sort((x, y) => x.localeCompare(y, "th")),
    [lookups.employees]
  );
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
  const isContractNoTaken = useCallback((contractNo, excludeContractGroupId) => {
    const trimmed = (contractNo || "").trim();
    if (!trimmed) return false;
    return contracts.some((c) =>
      c.isRealContract && c.contractNo && c.contractNo.trim() === trimmed && c.key !== excludeContractGroupId
    );
  }, [contracts]);

  // ✅ ตรวจความถูกต้องสดๆ ระหว่างพิมพ์ — เตือนตรงช่องที่ผิดเลย และปิดปุ่ม "บันทึกสัญญา" ไว้จนกว่าจะครบ
  // แทนที่จะปล่อยให้กดแล้วค่อยเด้ง error ที่หัวฟอร์ม (ซึ่งบนจอมือถือต้องเลื่อนขึ้นไปอ่านเองว่าพลาดตรงไหน)
  const hasInvalidContractRange = Boolean(
    form.contractStart && form.contractEnd && moment(form.contractEnd).isBefore(moment(form.contractStart))
  );
  const isAddFormInvalid =
    !form.site.trim() || !form.title.trim() || !form.system.trim() || !form.visitCount ||
    hasInvalidContractRange || isContractNoTaken(form.contractNo);

  const openAddDialog = () => {
    setForm({ ...emptyForm, contractNo: suggestNextContractNo() });
    setFormError("");
    setInlineAddOpen(false); // ⚠️ ทั้งสองทางใช้ `form` ก้อนเดียวกัน เปิดพร้อมกันไม่ได้ (ดู openInlineAdd)
    setAddOpen(true);
  };
  const closeAddDialog = () => { if (!saving) setAddOpen(false); };

  // ── แถวร่าง "เพิ่มสัญญาใหม่" ท้ายตาราง ──────────────────────────────────
  // ✅ เดิมทางเดียวที่สร้างสัญญาใหม่ได้คือกดปุ่ม "เพิ่มสัญญาใหม่" มุมขวาบนแล้วกรอกในไดอะล็อกที่มี 12 ช่อง
  // = ต้อง "ออกจากตาราง" ไปกรอกฟอร์มแยกก่อนเสมอ แล้วค่อยกลับมาไล่หาว่าแถวใหม่ไปโผล่ตรงไหน — แถวร่างนี้
  // ให้กรอกในตำแหน่งเดียวกับคอลัมน์จริงของมันเลย เห็นทันทีว่าค่าที่กรอกจะไปอยู่ช่องไหนของตาราง
  // ⚠️ ใช้ state `form` + handleAddSubmit ตัวเดียวกับไดอะล็อกทุกประการ ไม่ได้เขียนตรรกะสร้าง/ตรวจสอบ
  // ขึ้นใหม่อีกชุด — ทางสร้างสัญญายังมีทางเดียวเสมอ แก้/เพิ่มกฎที่เดียวมีผลทั้งสองทางพร้อมกัน
  // ⚠️ เปิดได้ทีละทาง: เปิดแถวร่างอยู่แล้วกดปุ่มด้านบนจะปิดแถวร่างให้เอง (และกลับกัน) ไม่งั้นทั้งสองทาง
  // จะแก้ `form` ก้อนเดียวกันพร้อมกันจนค่าที่พิมพ์ในแถวร่างโผล่ไปอยู่ในไดอะล็อกแบบงงๆ
  const [inlineAddOpen, setInlineAddOpen] = useState(false);
  // ⚠️ ไม่แตะ state `form` ของหน้านี้เลย — แถวร่างถือค่าที่กำลังพิมพ์ไว้เองทั้งหมด (ดู InlineAddRow)
  // แล้วส่งกลับมาทีเดียวตอนกดบันทึก การเปิดแถวจึงเปลี่ยน state แค่ตัวเดียว เรนเดอร์ใหม่รอบเดียวจบ
  const openInlineAdd = () => {
    setFormError("");
    setAddOpen(false);
    setInlineAddOpen(true);
  };
  const closeInlineAdd = () => { if (!saving) { setInlineAddOpen(false); setFormError(""); } };
  // ✅ สลับแท็บแล้วปิดแถวร่างทิ้งเสมอ — แถวร่างเป็นของ "รายการที่กำลังดูอยู่" ถ้าปล่อยค้างข้ามแท็บ ผู้ใช้
  // จะเจอแถวที่กรอกไว้ครึ่งหนึ่งโผล่ในบริบทอื่นโดยไม่รู้ที่มา (เทียบเหตุผลเดียวกับ clearSelection)
  useEffect(() => { setInlineAddOpen(false); }, [viewFilter]);
  // ✅ แถวร่างนี้สร้าง "สัญญา" — แท็บที่ไม่ได้แสดงสัญญา (งานทั่วไป/งานโปรเจค/ยังไม่จัดกลุ่ม/เลยกำหนด)
  // ไม่ควรมีให้กด เพราะสัญญาที่เพิ่งบันทึกจะไม่โผล่ในแท็บนั้นเลย (คนละตัวกรอง) ผู้ใช้จะเข้าใจว่าบันทึกไม่ติด
  const canInlineAdd = isAdminOrManager && (viewFilter === "contracts" || viewFilter === "all");
  // จำนวนคอลัมน์ทั้งแถว — ใช้กับ colSpan ของแถวปุ่ม "+" และแถวข้อความแจ้งเตือน (ดู footerColSpan)
  // ⚠️ +2 = ช่อง "มูลค่างาน" กับ "ค่าคอม" ที่แถวสรุปท้ายตารางเรนเดอร์เป็นเซลล์ของตัวเอง (ไม่ได้อยู่ใน
  // before/after) ถ้าลืมนับ แถวที่ใช้ colSpan เต็มความกว้างจะสั้นกว่าตารางจริง 2 ช่องแล้วขอบตารางเบี้ยว
  const totalColCount = footerColSpan.before + 2 + footerColSpan.after;

  // ✅ วันที่เข้างานครั้งที่ 1 ไม่บังคับกรอกตอนสร้างสัญญา (ตามที่ผู้ใช้ยืนยัน — บางสัญญายังไม่รู้วันที่
  // แน่นอน) กรอกมาจะลงตารางจริงทันที ไม่กรอกจะบันทึกเป็นฉบับร่างไปเพิ่มวันที่ทีหลังได้ตามปกติ
  const handleAddSubmit = async (values = form) => {
    setFormError("");
    if (!values.site.trim())   { setFormError("กรุณาระบุชื่อโครงการ"); return; }
    if (!values.title.trim())  { setFormError("กรุณาระบุประเภทงาน"); return; }
    if (!values.system.trim()) { setFormError("กรุณาระบุระบบงาน"); return; }
    const visitCount = Number(values.visitCount);
    if (!visitCount || visitCount < 1) { setFormError("กรุณาระบุจำนวนครั้งทั้งหมดของสัญญา"); return; }
    // ✅ ห้ามใส่เกิน 12 — สัญญาที่มีจำนวนครั้งเยอะเกินไปจะทำให้ตาราง "ภาพรวมงาน" ต้องเรนเดอร์คอลัมน์
    // "ครั้งที่ N" เกินจำเป็น (visitColumns คำนวณจากค่าสูงสุดของแถวที่แสดงอยู่ในหน้านั้น — ตั้งค่านี้
    // สูงเกินไปแค่สัญญาเดียวก็ทำให้หน้าที่มีสัญญานั้นกว้างจนพังได้) เช็คซ้ำฝั่ง backend อีกชั้นด้วย (POST /draft)
    if (visitCount > MAX_VISIT_COUNT) { setFormError(`จำนวนครั้งทั้งหมดต้องไม่เกิน ${MAX_VISIT_COUNT} ครั้ง`); return; }
    // ✅ ไม่บังคับ — เว้นว่างได้ ไม่กระทบจำนวนครั้งด้านบน แค่ใช้เตือน "เกินกำหนดรอบถัดไป" ถ้าระบุมา
    if (values.intervalMonths) {
      const n = Number(values.intervalMonths);
      if (!n || n < 1 || n > 24) {
        setFormError("ระยะห่างระหว่างรอบต้องอยู่ระหว่าง 1-24 เดือน");
        return;
      }
    }
    if (isContractNoTaken(values.contractNo)) {
      setFormError(`เลขที่สัญญา "${values.contractNo.trim()}" ถูกใช้ไปแล้ว กรุณาตรวจสอบ`);
      return;
    }
    // 🐛 BUG ที่แก้: เดิมไม่เคยตรวจว่าวันสิ้นสุดสัญญาต้องไม่ก่อนวันเริ่มสัญญาเลย (ตรวจแค่วันที่ครั้งที่ 1)
    // สลับวันกันมาก็บันทึกผ่านได้ แล้วสัญญาจะขึ้นป้าย "หมดอายุแล้ว" สีแดงทันทีที่สร้างเสร็จ (ดู
    // contractStatusInfo) โดยไม่มีอะไรบอกว่าเพราะกรอกวันสลับกัน
    if (values.contractStart && values.contractEnd && moment(values.contractEnd).isBefore(moment(values.contractStart))) {
      setFormError("วันที่สิ้นสุดสัญญาต้องไม่ก่อนวันที่เริ่มสัญญา");
      return;
    }
    // ✅ วันที่เข้างานครั้งที่ 1 ไม่บังคับ (ตามที่ผู้ใช้ยืนยัน — บางสัญญายังไม่รู้วันที่แน่นอนตอนสร้าง)
    // แต่ถ้ากรอกมา ต้องถูกต้อง (สิ้นสุดไม่ก่อนเริ่ม)
    if (values.firstVisitEnd && moment(values.firstVisitEnd).isBefore(moment(values.firstVisitStart))) {
      setFormError("วันที่สิ้นสุดครั้งที่ 1 ต้องไม่ก่อนวันที่เริ่ม");
      return;
    }
    // 🐛 BUG ที่แก้: มูลค่างานเดิมรับค่าติดลบได้ (type="number" ไม่มี min และไม่เคยตรวจฝั่งจอเลย)
    if (values.jobValue && Number(values.jobValue) < 0) {
      setFormError("มูลค่างานต้องไม่ติดลบ");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        company: values.company.trim(),
        site: values.site.trim(),
        title: values.title.trim(),
        system: values.system.trim(),
        // ✅ "ผู้รับผิดชอบงาน" — คนที่ติดตามสัญญานี้ทั้งหมด มอบหมายโดย admin/manager ตอนสร้างสัญญา
        // (ไม่ใช่ทีมที่เข้างานซึ่งเป็นของแต่ละครั้ง ดูคอมเมนต์ที่ emptyForm) ต้องส่งค่าตรงๆ ไม่ผ่าน
        // fallback เท่านั้น สิทธิ์ที่ผูกกับ "ผู้รับผิดชอบตัวจริง" ถึงจะทำงาน (ดู rawResponsiblePersonId)
        responsiblePerson: values.responsiblePerson,
        responsiblePersonId: teamToId.get(values.responsiblePerson) || "",
        backgroundColor: "#3788d8",
        textColor: "#ffffff",
        fontSize: 8,
        isContractBatch: true,
        contractNo: values.contractNo.trim(),
        quotationNo: values.quotationNo.trim(),
        contractStart: values.contractStart,
        contractEnd: values.contractEnd,
        visitCount,
        intervalMonths: values.intervalMonths ? Number(values.intervalMonths) : undefined,
        jobValue: values.jobValue ? Number(values.jobValue) : undefined,
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

      // ✅ มีวันที่ → ลงตารางเป็นครั้งที่ 1 จริงทันที (เทียบ pattern เดียวกับ openAddVisitDialog/
      // handleAddVisitSubmit ในไฟล์นี้เป๊ะๆ) ไม่มีวันที่ → บันทึกเป็นฉบับร่าง (unscheduled) เหมือนเดิม
      // ⚠️ กรณีฉบับร่าง: ถ้าถูกลบทิ้งตอนยังไม่มีครั้งไหนลงตารางเลย สัญญาทั้งอันจะหายไปจากตาราง
      // "ภาพรวมงาน" ทันที (ไม่เหลือ document ไหนผูก contractGroupId นี้เลย) — เตือนไว้ชัดเจนแยกจาก
      // คำเตือนปกติแล้วที่ handleDeleteDraftClick (EventCalendar/index.js) กันลบพลาดโดยไม่รู้ตัว
      if (values.firstVisitStart) {
        await EventService.AddEvent({
          ...payload,
          // ✅ ทีมที่เข้างานผูกกับ "ครั้งที่ 1" ที่กำลังสร้างนี้เท่านั้น ไม่ใช่ค่าระดับสัญญา — ครั้งถัดๆ ไป
          // เลือกทีมของตัวเองแยกได้อิสระ (ดู beginRoundTeamEdit ในตาราง / กล่อง "เพิ่มครั้งถัดไป")
          team: values.firstVisitTeam,
          resPerson: teamToId.get(values.firstVisitTeam) || "",
          time: "1",
          dates: [{
            start: values.firstVisitStart,
            end: moment(values.firstVisitEnd || values.firstVisitStart).add(1, "days").format("YYYY-MM-DD"),
            date: values.firstVisitStart,
          }],
        });
      } else {
        // ✅ สัญญาเปล่า — ไม่ส่ง team/resPerson เลย ยังไม่มี "ครั้ง" ไหนให้ผูกทีม (ไปเลือกตอนลงวันที่จริง)
        await EventService.AddDraftEvent(payload);
      }

      setSaving(false);
      setAddOpen(false);
      setInlineAddOpen(false); // ✅ ปิดแถวร่างท้ายตารางด้วย — ฟังก์ชันนี้ใช้ร่วมกันทั้ง 2 ทางเข้า
      Swal.fire({
        title: "บันทึกสัญญาใหม่สำเร็จ ✅",
        text: values.firstVisitStart ? undefined : 'ยังไม่ได้ระบุวันที่เข้างาน — สัญญาถูกบันทึกเป็น "สัญญาเปล่า" กดชิป "📌 กดเพื่อลงวันที่" ที่ช่องครั้งที่ 1 ในตารางเมื่อรู้วันที่จริง',
        icon: "success",
        timer: values.firstVisitStart ? 1500 : 2500,
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

  // ⚠️ BUG ที่แก้: ช่อง "ครั้งที่" ของสัญญาที่ยังเป็นฉบับร่าง (สัญญาเปล่า ยังไม่ลงวันที่) เดิมโชว์ชิป
  // "📌 รอวางแผน" ที่ลิงก์ไป /event?draft=... เสมอ — แต่ฉบับร่างของสัญญาไม่โผล่ในแผงงานล่วงหน้าของ
  // ปฏิทินอีกต่อไปแล้ว (ดู visibleDrafts ใน EventCalendar/index.js) ลิงก์นั้นจึงพาไปหน้าที่ไม่มีการ์ดนี้
  // อยู่เลย = กดแล้วไม่เจออะไร และเพราะชิปนี้ถูกเช็คก่อนปุ่ม "+ เพิ่มครั้งถัดไป" ในลำดับ ternary เดียวกัน
  // ปุ่ม + ของครั้งที่ 1 จึงไม่มีวันโผล่ให้กดเลย → สัญญาเปล่าที่เพิ่งสร้างกลายเป็นลงวันที่ไม่ได้เลยทั้งใบ
  // ✅ สัญญา → ให้กดชิปเปิดกล่อง "เพิ่มครั้งที่ 1" ในหน้านี้แทน (handleAddVisitSubmit แปลงฉบับร่างเดิม
  // เป็นครั้งจริงให้เองผ่าน PUT /:id/schedule ไม่สร้าง record ซ้ำ) ส่วนงานทั่วไป/โปรเจคยังอยู่ในแผงงาน
  // ล่วงหน้าตามปกติ ใช้ลิงก์เดิมต่อไปได้
  const pendingDraftChip = useCallback((c, pendingDraft) => {
    if (c.isRealContract) {
      return isAdminOrManager
        ? { label: "📌 กดเพื่อลงวันที่", tip: "สัญญานี้ยังไม่ได้ลงวันที่เข้างาน — กดเพื่อระบุวันที่ครั้งที่ 1", props: { onClick: () => openAddVisitDialog(c), sx: { cursor: "pointer" } } }
        : { label: "📌 รอลงวันที่", tip: "สัญญานี้ยังไม่ได้ลงวันที่เข้างาน (แอดมิน/manager เป็นผู้ระบุ)", props: {} };
    }
    return {
      label: "📌 รอวางแผน",
      tip: "วางแผนล่วงหน้าไว้แล้ว ยังไม่ได้ลงวันที่จริง — กดเพื่อไปดูงานนี้",
      props: {
        component: Link,
        to: `/event?draft=${pendingDraft._id}${pendingDraft.plannedMonth ? `&month=${pendingDraft.plannedMonth}` : ""}`,
      },
    };
  }, [isAdminOrManager]);

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
  // ✅ เหมือน pickInterval ของฟอร์ม "เพิ่มสัญญาใหม่" — กดปุ่มลัด "ปีละ N ครั้ง" เซ็ตทั้ง intervalMonths
  // และ visitCount ให้ตรงกันในคลิกเดียว (ทับค่าเริ่มต้น visitCount ที่ตั้งจากจำนวนงานที่เลือกไว้ตอนเปิด
  // ฟอร์มได้ตามปกติ — ผู้ใช้พิมพ์ทับเองแยกได้เสมออยู่แล้วถ้าไม่ตรงกรณี)
  const pickMergeInterval = (months) => setMergeForm((f) => ({ ...f, intervalMonths: months, visitCount: String(visitsPerYear(months) || f.visitCount) }));

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
    // 🐛 BUG ที่แก้: ฟอร์มนี้ขาดการตรวจช่วงวันที่สัญญาเหมือนกัน (เทียบ handleAddSubmit) — กรอกวันสลับกัน
    // แล้วสัญญาที่จัดกลุ่มเสร็จจะขึ้น "หมดอายุแล้ว" ทันทีโดยไม่รู้สาเหตุ
    if (mergeForm.contractStart && mergeForm.contractEnd && moment(mergeForm.contractEnd).isBefore(moment(mergeForm.contractStart))) {
      setMergeError("วันที่สิ้นสุดสัญญาต้องไม่ก่อนวันที่เริ่มสัญญา");
      return;
    }
    if (mergeForm.jobValue && Number(mergeForm.jobValue) < 0) {
      setMergeError("มูลค่างานต้องไม่ติดลบ");
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

  // ✅ ทีมที่เข้างานของ "แต่ละครั้ง" (visit) แยกต่างหากจาก editingCell ด้านบนโดยตั้งใจ — ด้านบนแก้
  // ระดับสัญญา/แถวทั้งแถว ส่วนนี้แก้เฉพาะ document เดียว (ครั้งเดียว) เท่านั้น ไม่ผูกกับ field/key ของ
  // แถวเลย ใช้ visitId เป็นตัวระบุแทน — เทียบเกณฑ์เดียวกับที่ user ขอ: แต่ละครั้งอาจเข้าโดยคนละทีมกัน
  // ไม่ควรมีปุ่มเดียวที่แก้แล้ว sync ทับทุกครั้งเหมือนคอลัมน์ "ทีมที่เข้างาน" ระดับสัญญาแบบเดิม
  const [roundTeamEdit, setRoundTeamEdit] = useState(null); // { visitId, value }
  const [roundTeamSaving, setRoundTeamSaving] = useState(false);

  // ✅ บริษัท/โครงการ/ระบบ/ประเภทงาน แก้ไขได้ทุกแถว (ทั้งสัญญาจริงและงานทั่วไป/โปรเจค/ยังไม่จัดกลุ่ม)
  // ต่างจากฟิลด์อื่น (เลขที่สัญญา/มูลค่างาน/ฯลฯ) ที่มีความหมายเฉพาะสัญญาจริงเท่านั้น — ดู BASIC_INFO_FIELDS


  // ✅ กติกากลางว่าฟิลด์ไหนแก้ไขได้กับแถวประเภทไหนบ้าง — ใช้ร่วมกันทั้ง editable prop ของ EditableCell
  // (คุมว่าคลิกแก้ไขได้ไหม) และ beginEdit ด้านล่าง กันสองจุดเช็คไม่ตรงกัน:
  // - company/site/system/title: แก้ได้ทุกแถวเสมอ (ระบุตัวงาน ไม่ผูกกับการจัดหมวดหมู่)
  // - docNo/responsiblePerson: แก้ได้เฉพาะแถวที่ "ตัดสินใจแล้ว" ว่าเป็นสัญญาจริง/งานทั่วไป/
  //   งานโปรเจค — ไม่ใช่แถว "ยังไม่จัดกลุ่ม" ซึ่งควรไปจัดหมวดหมู่ก่อน ค่อยมอบหมายคน/ผู้รับผิดชอบทีหลัง
  // - team: ไม่มีในนี้แล้ว — ตัดคอลัมน์ "ทีมที่เข้างาน" ระดับสัญญาออกไปตามที่ผู้ใช้ขอ (แต่ละครั้งอาจเข้า
  //   โดยคนละทีมกัน) แก้ไขทีมได้ที่ช่อง "ครั้งที่ N" แทน (ดู beginRoundTeamEdit/commitRoundTeamEdit)
  // - docNo/responsiblePerson/jobValue: แก้ได้เฉพาะแถวที่ "ตัดสินใจแล้ว" (สัญญาจริง/งานทั่วไป/งานโปรเจค)
  // - ฟิลด์ที่เหลือ (เลขที่สัญญา/ใบเสนอราคา/ระยะเวลา/จำนวนครั้ง): เฉพาะสัญญาจริงเท่านั้น
  // 🐛 BUG ที่แก้ (คลิกช่องมูลค่างานในแท็บงานทั่วไป/โปรเจคแล้วไม่มีอะไรเกิดขึ้น): ตอนเปิดให้คอลัมน์
  // "มูลค่างาน" แสดงทุกแท็บ ตั้ง editable={isAdminOrManager} ที่ตัวเซลล์ไว้แล้ว (ช่องจึงขึ้นเป็นรูปมือ/
  // ไฮไลต์ตอน hover เหมือนช่องที่แก้ได้ทุกประการ) แต่ลืมแก้ที่นี่ ซึ่ง jobValue ตกมาเข้าเงื่อนไขสุดท้าย
  // `return c.isRealContract` = false สำหรับงานทั่วไป/โปรเจค → beginEdit ตัดจบเงียบๆ ตั้งแต่บรรทัดแรก
  // กลายเป็นช่องที่ "ดูเหมือนแก้ได้แต่กดแล้วไม่มีอะไรเกิดขึ้นเลย" ซึ่งแย่กว่าช่องที่ล็อกไว้ชัดเจนเสียอีก
  const isClassifiedRow = (c) => c.isRealContract || c.isConfirmedGeneral || c.isConfirmedProject;
  const canEditField = useCallback((c, field) => {
    if (BASIC_INFO_FIELDS.has(field)) return true;
    // ✅ ป้ายกำกับแผนก: ติดได้ทุกแถวที่จัดหมวดหมู่แล้ว (สัญญาจริงส่งผ่าน contractGroupId ส่วนงานทั่วไป/
    // โปรเจคส่งผ่าน eventIds — ดู useBasicInfoEndpoint ใน commitEdit) แถว "ยังไม่จัดกลุ่ม" ยังไม่ให้ติด
    // เพราะยังไม่รู้ด้วยซ้ำว่ามันคืองานอะไร ควรจัดหมวดหมู่ให้เรียบร้อยก่อน
    if (field === "docNo" || field === "responsiblePerson" || field === "jobValue" || field === "commission"
      || field === "departmentTag" || field === "statusNote" || field === "remark") return isClassifiedRow(c);
    return c.isRealContract;
  }, []);

  const editOriginalValue = (c, field) => {
    if (field === "contractStart" || field === "contractEnd") return c[field] ? moment(c[field]).format("YYYY-MM-DD") : "";
    // ⚠️ document เก่าไม่มีฟิลด์นี้เลย (เพิ่งเพิ่มทีหลัง) ต้องอ่านเป็น "ฝ่ายบริการ" ให้ตรงกับที่แสดงในตาราง
    // ไม่งั้นการเลือก "ฝ่ายบริการ" บนแถวเก่าจะไม่ถูกมองว่า "ไม่ได้แก้" แล้วยิง PUT ทิ้งเปล่าๆ
    if (field === "departmentTag") return c.departmentTag || DEPARTMENT.SERVICE;
    return c[field] ?? "";
  };

  const beginEdit = useCallback((c, field) => {
    if (editSaving) return;
    if (!canEditField(c, field)) return;
    setEditingCell({ key: c.key, field });
    setEditValue(String(editOriginalValue(c, field)));
  }, [canEditField, editSaving]);
  const cancelEdit = () => { setEditingCell(null); setEditValue(""); };

  /**
   * @param {string} [nextValue] ค่าที่ช่องนั้นพิมพ์ไว้ — ส่งมาจาก EditableCell ตอนกด Enter/คลิกออก
   * ⚠️ ต้องรับค่าเข้ามา ไม่ใช่อ่าน editValue เอง เพราะตอนนี้ตัวที่พิมพ์อยู่ในช่อง (draft) ไม่ได้ sync
   * ขึ้นมาที่ state ของหน้านี้ทุกตัวอักษรแล้ว (ดูเหตุผลที่ EditableCell) — ถ้ายังอ่าน editValue จะได้
   * ค่าตั้งต้นตอนเริ่มแก้ไขเสมอ = แก้อะไรก็ไม่บันทึก
   * ⚠️ fallback ไป editValue ไว้สำหรับจุดที่ยังเรียก commitEdit(c) แบบไม่ส่งค่า (เช่น select ที่
   * เปลี่ยนค่าแล้ว commit ทันที) ยังทำงานได้เหมือนเดิม
   */
  const commitEdit = useCallback(async (c, nextValue) => {
    if (!editingCell || editingCell.key !== c.key) return;
    const field = editingCell.field;
    const rawValue = nextValue !== undefined ? nextValue : editValue;

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
    // เรนเดอร์คอลัมน์ "ครั้งที่ N" เกินจำเป็นจนหน้าพัง (ดู visitColumns / roundColumnsFor)
    if (field === "visitCount" && rawValue) {
      const n = Number(rawValue);
      if (!n || n < 1 || n > MAX_VISIT_COUNT) {
        Swal.fire({ title: "แก้ไขไม่สำเร็จ", text: `จำนวนครั้งทั้งหมดต้องอยู่ระหว่าง 1-${MAX_VISIT_COUNT} ครั้ง`, icon: "error" });
        setEditingCell(null);
        return;
      }
    }
    // ✅ ตามที่ผู้ใช้ขอ ("ตรงคืบหน้าให้สอดคล้องกับจำนวนรอบด้วย"): แก้ "รอบเข้า" เป็นค่าที่หารลงตัว (เช่น
    // ทุก 3 เดือน = ปีละ 4 ครั้ง — ไม่ว่าจะพิมพ์เลขเองหรือกดชิปลัดก็ตาม เพราะทั้งสองทางจบที่ onCommit
    // เดียวกัน) ให้ปรับ "จำนวนครั้งทั้งหมด" (visitCount) ตามไปในคราวเดียวกันเสมอ ไม่มีข้อยกเว้น — ไม่งั้น
    // คอลัมน์ "คืบหน้า" (X/Y ซึ่ง Y=visitCount) จะค้างเลขเดิมที่ไม่สัมพันธ์กับรอบที่เพิ่งตั้งใหม่เลย
    // 🐛 BUG ที่แก้ (ผู้ใช้แจ้ง: "ยังเพี้ยนไม่สมบูรณ์" พร้อมภาพ — ตั้งรอบใหม่เป็น "ปีละ 1 ครั้ง" แต่คืบหน้า
    // ยังค้างเป็น "2/6" เหมือนเดิม): เดิมมีเงื่อนไขกันไว้ "ไม่ sync ถ้าจำนวนที่ใช้ไปแล้ว > ค่าใหม่" (กลัว
    // คืบหน้ากลายเป็น 5/4 เกิน 100%) แต่ผลคือทำให้ค่าไม่ตรงกันแบบเงียบๆ ซึ่งดูเหมือนฟีเจอร์นี้ไม่ทำงาน
    // เลยพอเจอเคสนี้เข้า — ผู้ใช้ขอ "สอดคล้องกันเสมอ" ไม่ใช่ "สอดคล้องกันเฉพาะบางกรณี" ตัดเงื่อนไขกันทิ้ง
    // ✅ คืบหน้าเกิน 100% (เช่น 2/1) ไม่ใช่ปัญหาจริง — progressInfo ด้านบนไฟล์ถือว่า doneCount >= total
    // คือ "เสร็จแล้ว" (ขึ้นสีเขียวเหมือนกัน) อยู่แล้ว ไม่มีอะไรพังหรือดูผิดปกติเกินจำเป็น
    // ⚠️ รอบที่หารไม่ลงตัว (เช่น ทุก 5 เดือน) ไม่มี perYear ที่ชัดเจนให้ sync — ปล่อย visitCount เดิม
    let syncedVisitCount;
    if (field === "intervalMonths" && rawValue) {
      const perYear = visitsPerYear(rawValue);
      if (perYear) syncedVisitCount = perYear;
    }
    // 🐛 BUG ที่แก้: แก้ไข inline ก็ไม่เคยตรวจช่วงวันที่สัญญาเลย (ทั้งที่เป็นทางที่แก้วันที่บ่อยที่สุด) —
    // แก้วันสิ้นสุดให้ก่อนวันเริ่มได้ตามใจ แล้วสัญญาจะขึ้น "หมดอายุแล้ว" ทันที เทียบกับอีกฝั่งของช่วงที่
    // ไม่ได้แก้ (c.contractStart/c.contractEnd ตัวเดิม) ให้ครบทั้งสองทิศทาง
    if (field === "contractStart" || field === "contractEnd") {
      const nextStart = field === "contractStart" ? rawValue : (c.contractStart ? moment(c.contractStart).format("YYYY-MM-DD") : "");
      const nextEnd = field === "contractEnd" ? rawValue : (c.contractEnd ? moment(c.contractEnd).format("YYYY-MM-DD") : "");
      if (nextStart && nextEnd && moment(nextEnd).isBefore(moment(nextStart))) {
        Swal.fire({ title: "แก้ไขไม่สำเร็จ", text: "วันที่สิ้นสุดสัญญาต้องไม่ก่อนวันที่เริ่มสัญญา", icon: "error" });
        setEditingCell(null);
        return;
      }
    }
    if (field === "commission" && rawValue && Number(rawValue) < 0) {
      Swal.fire({ icon: "warning", title: "ค่าคอมมิชชั่นต้องไม่ติดลบ", confirmButtonColor: ACCENT });
      return;
    }
    if (field === "jobValue" && rawValue && Number(rawValue) < 0) {
      Swal.fire({ title: "แก้ไขไม่สำเร็จ", text: "มูลค่างานต้องไม่ติดลบ", icon: "error" });
      setEditingCell(null);
      return;
    }

    const payload = {};
    // 🐛 BUG ที่แก้ (ลบค่าเงินที่ใส่ผิดไว้ไม่ได้): เดิมช่องว่าง → undefined ซึ่ง JSON.stringify ตัดคีย์นั้น
    // ทิ้งไปเลยตอนส่ง backend จึงไม่เห็นฟิลด์ → มองว่า "ไม่ได้แก้" → ค่าเดิมค้างอยู่ตลอด ลบไม่ออกสักที
    // ✅ ส่ง null แทนสำหรับช่องจำนวนเงิน (มูลค่างาน/ค่าคอม) — backend รองรับการล้างค่าด้วย null/"" อยู่แล้ว
    // ทั้ง 2 route (ดู PUT /basic-info และ PUT /contract/:contractGroupId)
    // ⚠️ จำนวนครั้ง/ระยะห่างระหว่างรอบยังคงใช้ undefined เหมือนเดิมโดยตั้งใจ — 2 ตัวนี้เป็นโครงสร้างของ
    // สัญญา (จำนวนคอลัมน์ "ครั้งที่ N" คำนวณจากมัน) ล้างเป็นค่าว่างแล้วตารางจะเพี้ยนทั้งหน้า ไม่ใช่แค่
    // ช่องเดียวหาย — ถ้าอยากแก้ต้องใส่ตัวเลขใหม่ทับเท่านั้น
    if (field === "jobValue" || field === "commission") payload[field] = rawValue ? Number(rawValue) : null;
    else if (field === "visitCount" || field === "intervalMonths") payload[field] = rawValue ? Number(rawValue) : undefined;
    else if (field === "responsiblePerson") { payload.responsiblePerson = rawValue; payload.responsiblePersonId = teamToId.get(rawValue) || ""; }
    else payload[field] = rawValue;
    if (syncedVisitCount !== undefined) payload.visitCount = syncedVisitCount;

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
      // ✅ responsiblePerson: ถ้าเป็นสัญญาจริงยังผูกทุกครั้งพร้อมกันผ่าน contractGroupId เหมือนเดิม
      // (มอบหมายผู้รับผิดชอบทั้งสัญญา) แต่ถ้าเป็นงานทั่วไป/โปรเจค (ไม่มี contractGroupId จริง —
      // c.key เป็นแค่ "jgid:.../nogid:..." ใช้กับ UpdateContractFields ไม่ได้) ต้องผ่าน eventIds ตรงๆ แทน
      // ✅ jobValue: สัญญาจริงยังผูกทุกครั้งพร้อมกันผ่าน contractGroupId เหมือนเดิม (มูลค่าของทั้งสัญญา)
      // แต่งานทั่วไป/โปรเจค/ยังไม่จัดกลุ่มไม่มี contractGroupId จริง (c.key เป็นแค่ "jgid:.../nogid:...")
      // ต้องผ่าน eventIds ตรงๆ แทน — เทียบ pattern เดียวกับ responsiblePerson/docNo บรรทัดล่าง
      const useBasicInfoEndpoint =
        BASIC_INFO_FIELDS.has(field) ||
        field === "docNo" ||
        ((field === "responsiblePerson" || field === "jobValue" || field === "commission"
          || field === "departmentTag" || field === "statusNote" || field === "remark") && !c.isRealContract);
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
  }, [editValue, editingCell, events, isContractNoTaken, teamToId]);

  // ── แก้ไขทีมที่เข้างานของแต่ละ "ครั้ง" แยกทีละ document ────────────────────
  // ✅ ทำไมแยกจาก commitEdit ด้านบน: คอลัมน์ "ทีมที่เข้างาน" ระดับสัญญาแก้แล้วอัปเดตทุกครั้งพร้อมกันผ่าน
  // UpdateContractFields ซึ่งใช้ไม่ได้กับกรณีนี้ (แต่ละครั้งอาจเข้าโดยคนละทีมกันจริงๆ) ต้องอัปเดตทีละ
  // document ผ่าน UpdateBasicInfo (ใช้ eventIds ตรงๆ) — ไม่แตะ responsiblePerson เลยทั้งฟังก์ชัน
  // (คนละฟิลด์กันโดยสมบูรณ์ตามที่ผู้ใช้ยืนยัน)
  // ✅ นอกจาก admin/manager แล้ว "ผู้รับผิดชอบ" ของสัญญานี้แก้ไขทีมของแต่ละครั้งเองได้ด้วย (ตามที่ขอ) —
  // ใช้ rawResponsiblePersonId/rawResponsiblePerson (ค่าที่ตั้งไว้ตรงๆ ไม่ fallback ไปที่ team) เทียบ
  // pattern เดียวกับ canEditTeamAssignment ใน EditEvent.js เป๊ะๆ — ต้องมอบหมายไว้ชัดเจนก่อนเท่านั้น
  // (backend เช็คแบบเดียวกันเข้มงวดเหมือนกัน ดู PUT /basic-info)
  const canEditRoundTeam = useCallback((c) =>
    isAdminOrManager ||
    (c.rawResponsiblePersonId && c.rawResponsiblePersonId === userData?.userId) ||
    (c.rawResponsiblePerson && c.rawResponsiblePerson === userData?.fname), [isAdminOrManager, userData?.fname, userData?.userId]);

  // ✅ สิทธิ์แนบไฟล์ในกล่องเอกสาร — อิงจากแถว+ครั้งที่กดเปิดมาจริง (c ไม่อยู่ใน scope ตรงจุดที่เรนเดอร์
  // กล่อง เพราะกล่องอยู่ระดับหน้า ไม่ได้อยู่ในลูปของแถว)
  const docsCanUpload = useMemo(() => {
    if (!docsTarget) return false;
    const row = contracts.find((c) => c.key === docsTarget.rowKey);
    return row ? canEditRoundTeam(row) : false;
  }, [docsTarget, contracts, canEditRoundTeam]);

  // ✅ ผู้รับผิดชอบแก้ไขข้อมูลพื้นฐาน (บริษัท/โครงการ/ระบบ/ประเภทงาน/เอกสาร) ของ "งานทั่วไป/งานโปรเจค
  // ที่ตัวเองรับผิดชอบ" ได้ด้วยตามที่ผู้ใช้ขอ — ใช้ identity เดียวกับ canEditRoundTeam เป๊ะๆ (admin/
  // manager หรือผู้รับผิดชอบตัวจริง) แต่บังคับว่าต้องไม่ใช่งานตามสัญญาจริงด้วยเสมอ (สัญญาจริงยังคง
  // เฉพาะ admin/manager ทุกฟิลด์ ต้องผ่านการตรวจสอบจากส่วนกลางก่อนเสมอ — เทียบ backend PUT /basic-info)
  const canEditGeneralJob = useCallback((c) => !c.isRealContract && canEditRoundTeam(c), [canEditRoundTeam]);

  // 🐛 BUG ที่แก้ (แถวสัญญาจริงแก้ บริษัท/โครงการ/ระบบ/ประเภทงาน/เอกสาร ไม่ได้เลยแม้แต่แอดมิน):
  // ช่องพวกนี้เคยใช้ canEditGeneralJob(c) เป็นด่านเดียว ซึ่งนิยามไว้ว่า "ไม่ใช่สัญญาจริง และเป็นผู้รับผิดชอบ"
  // — ตัวนี้ถูกเพิ่มมาทีหลังเพื่อ "ขยายสิทธิ์" ให้ผู้รับผิดชอบงานทั่วไป/โปรเจคแก้งานตัวเองได้ แต่กลับถูกเอา
  // ไปแทนที่ด่านเดิม (isAdminOrManager) ทั้งหมด ผลคือแอดมิน/manager เสียสิทธิ์แก้ 4 ฟิลด์นี้บนแถวสัญญา
  // จริงไปโดยไม่ตั้งใจ — ขัดกับทั้ง canEditField (กติกากลางในไฟล์นี้ที่ระบุว่า 4 ฟิลด์นี้ "แก้ได้ทุกแถว
  // เสมอ") และฝั่ง backend (PUT /basic-info บล็อกเฉพาะคนที่ไม่ใช่แอดมิน/manager เท่านั้น)
  // ✅ รวมสองกติกาเข้าด้วยกันให้ถูกต้อง: แอดมิน/manager แก้ได้ทุกแถว "หรือ" ผู้รับผิดชอบแก้งานทั่วไป/
  // โปรเจคของตัวเองได้ แล้วยังผ่าน canEditField อีกชั้นเพื่อคุมว่าฟิลด์นั้นใช้ได้กับแถวประเภทนี้ไหม
  // (เช่น docNo ใช้ได้เฉพาะแถวที่จัดหมวดหมู่แล้ว ไม่ใช่แถว "ยังไม่จัดกลุ่ม")
  const canEditBasicField = useCallback((c, field) =>
    canEditField(c, field) && (isAdminOrManager || canEditGeneralJob(c)), [canEditField, canEditGeneralJob, isAdminOrManager]);

  const beginRoundTeamEdit = useCallback((visit, c) => {
    if (roundTeamSaving || !canEditRoundTeam(c)) return;
    setRoundTeamEdit({ visitId: visit._id, value: visit.team || "" });
  }, [canEditRoundTeam, roundTeamSaving]);
  const cancelRoundTeamEdit = () => setRoundTeamEdit(null);

  const commitRoundTeamEdit = useCallback(async (visit, explicitValue) => {
    if (!roundTeamEdit || roundTeamEdit.visitId !== visit._id) return;
    const rawValue = explicitValue !== undefined ? explicitValue : roundTeamEdit.value;
    if (rawValue === (visit.team || "")) { setRoundTeamEdit(null); return; }

    const payload = { team: rawValue, resPerson: teamToId.get(rawValue) || "" };
    const snapshot = events;
    setEvents((prev) => prev.map((e) => (String(e._id) === String(visit._id) ? { ...e, ...payload } : e)));
    setRoundTeamEdit(null);
    setRoundTeamSaving(true);
    try {
      await EventService.UpdateBasicInfo([visit._id], payload);
    } catch (err) {
      setEvents(snapshot);
      Swal.fire({
        title: "แก้ไขไม่สำเร็จ",
        text: err?.response?.data?.message || err.message,
        icon: "error",
      });
    } finally {
      setRoundTeamSaving(false);
    }
  }, [events, roundTeamEdit, teamToId]);

  // ── ลบสัญญา/งานทิ้ง ─────────────────────────────────────────────────────
  // ✅ สัญญาจริง (isRealContract) ลบทั้งก้อนทีเดียวผ่าน DELETE /contract/:contractGroupId (ทุกครั้งที่
  // ผูก contractGroupId เดียวกันหายไปพร้อมกัน) ส่วนแถวงานทั่วไป/ยังไม่จัดกลุ่ม (isRealContract=false)
  // อาจมีมากกว่า 1 document ต่อแถวได้แล้ว (งานเข้าหลายวันไม่ติดกัน ผูกด้วย jobGroupId — ดู
  // groupEventsByContract) ต้องลบทุก document ในกลุ่มพร้อมกัน ไม่ใช่แค่ document แรก ไม่งั้นวันอื่นๆ
  // ของงานเดียวกันจะค้างอยู่ในระบบทั้งที่ตั้งใจลบทั้งงาน — ทั้งคู่ยืนยันก่อนลบเสมอ เพราะลบแล้วกู้คืนไม่ได้
  // และเตือนเป็นพิเศษถ้ามีครั้งที่ "ดำเนินการเสร็จสิ้น" แล้วปนอยู่ (ประวัติงานจริงจะหายไปด้วย)
  const handleDeleteContract = useCallback(async (c) => {
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
  }, [selectedIds]);

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
  const handleDetachRound = useCallback(async (c, n) => {
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
  }, []);

  // ✅ แถวตารางถูก memo ไว้ — หัวใจของการแก้ "กดเปิดอะไรก็หน่วง"
  //
  // 🐛 ปัญหาที่แก้: คอมโพเนนต์นี้มี useState 58 ตัวในไฟล์เดียว 5,000+ บรรทัด state ตัวไหนเปลี่ยนก็ตาม
  // (เปิดกล่องวางบิล/เอกสาร/ประวัติ/เพิ่มสัญญา ฯลฯ) React จะ render ใหม่ทั้งหน้า รวมถึงแถวตารางทั้งหมด
  // 10 แถว × ~20 ช่อง ที่มี Tooltip/EditableCell นับร้อยตัว ทั้งที่ข้อมูลในแถวไม่ได้เปลี่ยนอะไรเลย
  //
  // ✅ พอ useMemo คืน "element array ตัวเดิม" React เทียบ reference แล้วข้ามการ reconcile ทั้ง subtree
  // ไปเลย — เปิดกล่องจึงไม่แตะแถวตารางอีกต่อไป
  //
  // ⚠️ ได้ผลก็ต่อเมื่อ dependency ทุกตัวมี reference คงที่ด้วย — ฟังก์ชันที่ประกาศในตัว component
  // จะเป็นตัวใหม่ทุก render ถ้าไม่ห่อ useCallback ซึ่งจะทำให้ memo นี้คำนวณใหม่ทุกครั้งและไม่ช่วยอะไรเลย
  // (ดูรายการ useCallback ด้านบน) · ห้ามใส่ eslint-disable ที่ dependency array นี้เด็ดขาด —
  // ถ้า dep ขาดจะกลายเป็น "แก้ข้อมูลแล้วตารางไม่อัปเดต" ซึ่งแย่กว่าหน่วงมาก
  const tableRows = useMemo(() => (
pagedRows.map((c, idx) => {
                // ✅ "ครั้งถัดไปที่ว่าง" — ใช้ตัดสินว่าจะโชว์ปุ่ม "+ เพิ่มครั้งถัดไป" ในช่องครั้งที่ไหน
                // (ย้ายมาจากคอลัมน์ actions แยกต่างหาก มาไว้ในช่องครั้งที่ของมันเองเลย พอเพิ่มสำเร็จแล้ว
                // ปุ่มจะขยับไปโผล่ที่ช่องครั้งถัดไปเองอัตโนมัติ เพราะคำนวณจากจำนวนครั้งที่ใช้ไปแล้วสดๆ ทุกครั้ง)
                const nextOpenRound = c.isRealContract
                  ? countUsedRounds(c.visits.filter((v) => !v.unscheduled)) + 1
                  : null;
                const overdueInfo = nextVisitOverdueInfo(c);
                // ✅ แถบสลับสีใช้สีทึบ (ไม่ใช่สีดำโปร่งแสง 2% แบบเดิม) — บนจอมือถือที่ตัวหนังสือเล็กและ
                // ต้องเลื่อนแนวนอน แถบสลับสีที่จางเกินไปจะช่วยไล่สายตาตามแถวไม่ได้จริง และตอน hover
                // ใช้สีแดงจางแทนสีเทากลางของ MUI ให้แถวที่ชี้อยู่เด่นขึ้น
                return (
                <TableRow
                  key={c.key}
                  sx={{
                    bgcolor: idx % 2 ? SURFACE_STRIPE : "#fff",
                    transition: "background-color .12s",
                    "&:hover": { bgcolor: alpha(ACCENT, 0.04) },
                  }}
                >
                  {showCheckboxes && (
                    <TableCell padding="checkbox" sx={{ width: colWidth("checkbox") }}>
                      {isSelectableForMerge(c) && (
                        <Checkbox
                          size="small"
                          checked={selectedIds.has(c.key)}
                          onChange={() => toggleSelect(c)}
                          sx={{ p: 0.5, "&.Mui-checked": { color: ACCENT } }}
                        />
                      )}
                    </TableCell>
                  )}
                  {/* ✅ ป้ายกำกับแผนกเจ้าของสัญญา — สีประจำสายงาน (แดง=บริการ · ม่วง=ขาย) ชุดเดียวกับทั้งแอป
                      กดที่ป้ายเพื่อเปลี่ยนแผนกได้เลย (แอดมิน/manager) — เป็นข้อมูลประกอบของหน้านี้ล้วนๆ
                      ไม่กระทบปฏิทิน/หน้าการดำเนินงานของใครทั้งสิ้น (ดู DEPARTMENT_META ด้านบน) */}
                  <TableCell data-col-key="departmentTag" align="center" sx={{ width: colVar("departmentTag") }}>
                    <EditableCell
                      Wrapper={Box} align="center"
                      editable={isAdminOrManager} columnKey="departmentTag"
                      editType="select" editOptions={DEPARTMENT_OPTIONS} allowEmpty={false}
                      editing={editingCell?.key === c.key && editingCell?.field === "departmentTag"}
                      value={c.departmentTag || DEPARTMENT.SERVICE} editValue={editValue} saving={editSaving}
                      title={isAdminOrManager
                        ? `แผนก${departmentMeta(c.departmentTag).label} — คลิกเพื่อเปลี่ยนแผนก`
                        : `แผนก${departmentMeta(c.departmentTag).label}`}
                      formatDisplay={(v) => <DepartmentPill value={v} />}
                      onStartEdit={() => beginEdit(c, "departmentTag")}
                      onCommit={(v) => commitEdit(c, v)}
                      onCancel={cancelEdit}
                    />
                  </TableCell>

                  {/* ✅ เลขที่สัญญา + ใบเสนอราคา ซ้อนกันในช่องเดียว — บรรทัดบนคือเลขที่สัญญา (ตัวหลัก
                      สีแบรนด์ตัวหนา) บรรทัดล่างคือใบเสนอราคา (ตัวเล็กสีจาง) ทั้งคู่ยังคลิกแก้ไขได้แยกกัน
                      ตามปกติ เพราะ EditableCell รับ Wrapper={Box} ให้เรนเดอร์โดยไม่สร้าง <td> ของตัวเอง */}
                  {!hideContractOnlyColumns && (
                    <TableCell data-col-key="docRef" sx={{ width: colVar("docRef"), maxWidth: colVar("docRef") }}>
                      <Stack spacing={0.15}>
                        <EditableCell
                          Wrapper={Box}
                          editable={isAdminOrManager && c.isRealContract} columnKey="contractNo"
                          editing={editingCell?.key === c.key && editingCell?.field === "contractNo"}
                          value={c.contractNo} editValue={editValue} saving={editSaving}
                          title={c.contractNo}
                          formatDisplay={(v) => (v
                            ? <span style={{ color: ACCENT, fontWeight: 700 }}>{v}</span>
                            : <span style={{ color: "#cbd5e1" }}>— ไม่มีเลขที่สัญญา —</span>)}
                          onStartEdit={() => beginEdit(c, "contractNo")}
                          onCommit={(v) => commitEdit(c, v)}
                          onCancel={cancelEdit}
                        />
                        <EditableCell
                          Wrapper={Box}
                          editable={isAdminOrManager && c.isRealContract} columnKey="quotationNo"
                          editing={editingCell?.key === c.key && editingCell?.field === "quotationNo"}
                          value={c.quotationNo} editValue={editValue} saving={editSaving}
                          title={c.quotationNo}
                          formatDisplay={(v) => (
                            <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                              {v ? `ใบเสนอราคา ${v}` : "ใบเสนอราคา —"}
                            </span>
                          )}
                          onStartEdit={() => beginEdit(c, "quotationNo")}
                          onCommit={(v) => commitEdit(c, v)}
                          onCancel={cancelEdit}
                        />
                      </Stack>
                    </TableCell>
                  )}
                  {/* ✅ โผล่แทนกลุ่มเลขที่สัญญา/ใบเสนอราคาด้านบนตอนซ่อนคอลัมน์ระดับสัญญา (ดูหัวตาราง) —
                      แก้ไขได้เฉพาะแถวที่จัดหมวดหมู่แล้ว (สัญญาจริง/งานทั่วไป/งานโปรเจค) ไม่ใช่แถว
                      "ยังไม่จัดกลุ่ม" เหมือน "ผู้รับผิดชอบ" ด้านล่าง (ดู canEditField) */}
                  {hideContractOnlyColumns && (
                    <EditableCell
                      editable={canEditBasicField(c, "docNo")} columnKey="docNo"
                      editing={editingCell?.key === c.key && editingCell?.field === "docNo"}
                      value={c.docNo} editValue={editValue} saving={editSaving}
                      width={colVar("docNo")} title={c.docNo}
                      onStartEdit={() => beginEdit(c, "docNo")}
                      onCommit={(v) => commitEdit(c, v)}
                      onCancel={cancelEdit}
                    />
                  )}
                  {/* ✅ บริษัท + โครงการ ซ้อนในช่องเดียว — บรรทัดบน "โครงการ" (ตัวหลักที่คนจำงานได้)
                      บรรทัดล่าง "บริษัท" (ตัวเล็กสีจาง) ทั้งคู่คลิกแก้ไขได้แยกกันตามปกติ
                      ⚠️ สลับลำดับจากเดิม (เดิมบริษัทมาก่อนโครงการ) เพราะจากข้อมูลจริงช่องบริษัทมักว่าง
                      ทั้งคอลัมน์ ส่วนโครงการมีค่าเสมอ — เอาตัวที่มีข้อมูลจริงขึ้นก่อนจะอ่านง่ายกว่า */}
                  <TableCell data-col-key="customer" sx={{ width: colVar("customer"), maxWidth: colVar("customer") }}>
                    <Stack spacing={0.15}>
                      <EditableCell
                        Wrapper={Box}
                        editable={canEditBasicField(c, "site")} columnKey="site"
                        editing={editingCell?.key === c.key && editingCell?.field === "site"}
                        value={c.site} editValue={editValue} saving={editSaving}
                        title={c.site}
                        formatDisplay={(v) => (v
                          ? <span style={{ fontWeight: 700, color: "#0f172a" }}>{v}</span>
                          : <span style={{ color: "#cbd5e1" }}>— ไม่ระบุโครงการ —</span>)}
                        onStartEdit={() => beginEdit(c, "site")}
                        onCommit={(v) => commitEdit(c, v)}
                        onCancel={cancelEdit}
                      />
                      {/* ✅ ที่เพิ่ม (ผู้ใช้ขอ: "หน้าภาพรวมงานด้วย เพิ่มให้สวยงาม และกดดูได้ง่าย")
                          ⚠️ ใช้โหมด compact — ตารางนี้คอลัมน์กว้างจำกัดและปรับขนาดได้ ถ้าใส่ปุ่มเต็ม
                          แบบหน้าอื่นจะดันความกว้างจนตารางเสียทรง · เหลือหมุดเล็กๆ: เขียว = มีพิกัดแล้ว
                          กดเปิดนำทางทันที · เทา = ยังไม่มี กดแล้วไปค้นหาใน Maps ให้เลย
                          ⚠️ สิทธิ์แก้ = editContracts ของหน้านี้เอง ไม่ตั้งเกณฑ์ใหม่ */}
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <EditableCell
                            Wrapper={Box}
                            editable={canEditBasicField(c, "company")} columnKey="company"
                            editing={editingCell?.key === c.key && editingCell?.field === "company"}
                            value={c.company} editValue={editValue} saving={editSaving}
                            title={c.company}
                            formatDisplay={(v) => (
                              <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                                🏢 {v || "ไม่ระบุบริษัท"}
                              </span>
                            )}
                            onStartEdit={() => beginEdit(c, "company")}
                            onCommit={(v) => commitEdit(c, v)}
                            onCancel={cancelEdit}
                          />
                        </Box>
                        <SiteMapLink compact company={c.company} site={c.site} canEdit={isAdminOrManager} />
                      </Stack>
                    </Stack>
                  </TableCell>

                  {/* ✅ ประเภทงาน + ระบบ ซ้อนในช่องเดียว — ทั้งคู่ตอบคำถามเดียวกันว่า "งานนี้คืองานอะไร" */}
                  <TableCell data-col-key="work" sx={{ width: colVar("work"), maxWidth: colVar("work") }}>
                    <Stack spacing={0.15}>
                      <EditableCell
                        Wrapper={Box}
                        editable={canEditBasicField(c, "title")} columnKey="title" editType="autocomplete" editOptions={titleOptions}
                        editing={editingCell?.key === c.key && editingCell?.field === "title"}
                        value={c.title} editValue={editValue} saving={editSaving}
                        title={c.title}
                        formatDisplay={(v) => (v
                          ? <span style={{ fontWeight: 600, color: "#0f172a" }}>{v}</span>
                          : <Dash />)}
                        onStartEdit={() => beginEdit(c, "title")}
                        onCommit={(v) => commitEdit(c, v)}
                        onCancel={cancelEdit}
                      />
                      <EditableCell
                        Wrapper={Box}
                        editable={canEditBasicField(c, "system")} columnKey="system" editType="autocomplete" editOptions={systemOptions}
                        editing={editingCell?.key === c.key && editingCell?.field === "system"}
                        value={c.system} editValue={editValue} saving={editSaving}
                        title={c.system}
                        formatDisplay={(v) => (
                          <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                            💻 {v || "ไม่ระบุระบบ"}
                          </span>
                        )}
                        onStartEdit={() => beginEdit(c, "system")}
                        onCommit={(v) => commitEdit(c, v)}
                        onCancel={cancelEdit}
                      />
                    </Stack>
                  </TableCell>

                  {/* ✅ เริ่มต้น + สิ้นสุด + รอบเข้า ซ้อนในช่องเดียว "ระยะเวลาสัญญา" — เดิมแยก 3 คอลัมน์
                      แคบจนวันที่โดนตัดเหลือ "01/..." อ่านไม่ออกทั้งที่เป็นข้อมูลหลักของสัญญา
                      🐛 BUG ที่แก้ (คลิกแก้วันที่สัญญายาก): เดิมวางวันเริ่ม–วันสิ้นสุดไว้ "บรรทัดเดียวกัน"
                      คั่นด้วยขีด ทั้งคู่จึงได้ความกว้างแค่ครึ่งช่อง (~85px) ผลคือ 3 อย่างพร้อมกัน —
                        1) ตัวเลขปีโดนตัดเป็น "01/01/2..." อ่านไม่ออกว่าปีอะไร
                        2) พื้นที่ให้คลิกเล็กมากและอยู่ชิดขอบคอลัมน์ (ที่มีตัวปรับความกว้างคอลัมน์คร่อมอยู่)
                           กดพลาดไปโดนตัวปรับความกว้างแทนบ่อย
                        3) พอคลิกติดแล้ว ช่องเลือกวันที่ (input type=date) ถูกบีบให้แคบกว่าตัวมันเองต้องการ
                           ปุ่มปฏิทินเลยหลุดออกนอกช่อง กดเลือกวันไม่ได้จริง
                      ✅ แยกเป็นคนละบรรทัด ติดป้าย "เริ่ม"/"ถึง" ไว้หน้าแต่ละอัน — แต่ละวันได้ความกว้าง
                      เต็มช่อง อ่านครบ คลิกได้ทั้งแถบ และตอนแก้ไขช่องวันที่ก็กว้างพอให้กดปฏิทินได้จริง */}
                  {!hideContractOnlyColumns && (
                    <TableCell data-col-key="period" sx={{ width: colVar("period"), maxWidth: colVar("period") }}>
                      <Stack spacing={0.15}>
                        {[
                          { field: "contractStart", label: "เริ่ม", value: c.contractStart, tip: "วันเริ่มสัญญา — คลิกเพื่อแก้ไข", start: true },
                          { field: "contractEnd", label: "ถึง", value: c.contractEnd, tip: "วันสิ้นสุดสัญญา — คลิกเพื่อแก้ไข", start: false },
                        // alignItems="stretch" — ให้แถบคลิกสูงเต็มบรรทัด (ไม่ใช่สูงเท่าตัวหนังสือ)
                        // พื้นที่กดจึงเป็นสี่เหลี่ยมเต็มๆ ไม่ใช่เส้นบางๆ ที่ต้องเล็งให้ตรงตัวเลข
                        ].map((d) => (
                          <Stack key={d.field} direction="row" alignItems="stretch" spacing={0.6} sx={{ minHeight: 21 }}>
                            {/* ✅ จุดกลมเล็กๆ หน้าบรรทัด — จุดทึบ = จุดเริ่ม, จุดกลวง = จุดจบ อ่านเป็น
                                "ไทม์ไลน์" ได้ทันทีโดยไม่ต้องอ่านตัวหนังสือ (ป้าย "เริ่ม/ถึง" ยังอยู่ครบ
                                สำหรับคนที่อยากอ่านให้แน่ใจ) — แทนที่จะเป็นตัวหนังสือเทาลอยๆ 2 บรรทัด */}
                            <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                              <Box
                                sx={{
                                  width: 6, height: 6, borderRadius: "50%",
                                  bgcolor: d.start ? alpha(ACCENT, 0.75) : "transparent",
                                  border: d.start ? "none" : `1.5px solid ${alpha(ACCENT, 0.5)}`,
                                }}
                              />
                            </Box>
                            <Box
                              component="span"
                              sx={{ width: 22, flexShrink: 0, fontSize: "0.63rem", color: "text.disabled", display: "flex", alignItems: "center", letterSpacing: "0.01em" }}
                            >
                              {d.label}
                            </Box>
                            {/* กล่องนี้ทำให้ EditableCell ยืดเต็มพื้นที่ที่เหลือ = แถบคลิกกว้างเต็มช่อง
                                (ไม่ใช่กว้างเท่าตัวหนังสือเหมือนเดิม ซึ่งเป็นเป้าที่เล็กเกินไปสำหรับนิ้ว) */}
                            <Box sx={{ flex: 1, minWidth: 0, display: "flex", "& > *": { flex: 1, display: "flex", alignItems: "center" } }}>
                              <EditableCell
                                Wrapper={Box} width="100%"
                                editable={isAdminOrManager && c.isRealContract} columnKey={d.field}
                                editing={editingCell?.key === c.key && editingCell?.field === d.field}
                                value={d.value} editValue={editValue} editType="date" saving={editSaving}
                                title={isAdminOrManager && c.isRealContract ? d.tip : undefined}
                                // ✅ tabular-nums = ตัวเลขทุกตัวกว้างเท่ากัน วันเริ่ม/วันจบจึงเรียงตรงกัน
                                // เป๊ะทุกหลัก (11/08 กับ 14/08 ไม่เหลื่อมกันเหมือนฟอนต์ปกติ) — รายละเอียด
                                // เล็กๆ ที่ทำให้ตารางตัวเลขดูเป็นระเบียบขึ้นมาก
                                formatDisplay={(v) => (v
                                  ? (
                                    <Box component="span" sx={{ fontWeight: 600, fontSize: "0.8rem", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>
                                      {thaiDateNumeric(v)}
                                    </Box>
                                  )
                                  : isAdminOrManager && c.isRealContract
                                  // ✅ ช่องว่างที่กดได้ควรบอกว่า "กดแล้วได้อะไร" — เดิมเป็นขีด "–" เฉยๆ
                                  // ดูเหมือนข้อมูลหายมากกว่าจะเป็นที่ให้กรอก
                                  ? <Box component="span" sx={{ fontSize: "0.72rem", color: "text.disabled", fontStyle: "italic" }}>ระบุวันที่</Box>
                                  : <Dash />)}
                                onStartEdit={() => beginEdit(c, d.field)}
                                onCommit={(v) => commitEdit(c, v)}
                                onCancel={cancelEdit}
                              />
                            </Box>
                          </Stack>
                        ))}
                        <EditableCell
                          Wrapper={Box}
                          editable={isAdminOrManager && c.isRealContract} columnKey="intervalMonths"
                          editing={editingCell?.key === c.key && editingCell?.field === "intervalMonths"}
                          value={c.intervalMonths} editValue={editValue} editType="intervalMonths" saving={editSaving}
                          title={c.intervalMonths ? undefined : "ยังไม่ได้ระบุ — ระบบใช้ค่าเริ่มต้น 3 เดือนในการเตือนรอบถัดไป"}
                          // ✅ รอบเข้าเป็นป้ายเล็กๆ มีพื้นหลังอ่อน + ไอคอนจริง แทนอีโมจิ 🔁 ที่เรนเดอร์
                          // ต่างกันไปในแต่ละเครื่อง (บนวินโดวส์ขึ้นเป็นกล่องสี่เหลี่ยมสีน้ำเงินทึบๆ ดูแปลกปลอม
                          // ไม่เข้ากับอะไรเลย) — ป้ายนี้แยกตัวเองออกจาก "วันที่" ด้านบนชัดเจนโดยไม่ต้องมีเส้นคั่น
                          // ✅ โชว์ "ปีละ N ครั้ง" ต่อท้ายด้วยเมื่อหารลงตัว (ผู้ใช้ขอให้ดูจำนวนครั้ง/ปีได้
                          // ตรงนี้เลย ไม่ต้องเปิด Excel export ถึงจะเห็น — เดิมค่านี้คำนวณแต่ไม่เคยแสดงบนจอ)
                          formatDisplay={(v) => (
                            <Box
                              component="span"
                              sx={{
                                display: "inline-flex", alignItems: "center", gap: 0.4, mt: 0.15,
                                px: 0.6, py: 0.1, borderRadius: 1,
                                bgcolor: alpha("#0f172a", v ? 0.05 : 0.03),
                                color: v ? "text.secondary" : "text.disabled",
                                fontSize: "0.67rem", fontWeight: v ? 600 : 400, whiteSpace: "nowrap",
                              }}
                            >
                              <Autorenew sx={{ fontSize: 12 }} />
                              {v
                                ? `ทุก ${v} เดือน${visitsPerYear(v) ? ` (ปีละ ${visitsPerYear(v)} ครั้ง)` : ""}`
                                : "ยังไม่ระบุรอบเข้า"}
                            </Box>
                          )}
                          onStartEdit={() => beginEdit(c, "intervalMonths")}
                          onCommit={(v) => commitEdit(c, v)}
                          onCancel={cancelEdit}
                        />
                      </Stack>
                    </TableCell>
                  )}
                  {/* ✅ มูลค่างาน — อยู่นอกบล็อก hideContractOnlyColumns แล้ว จึงแสดงทุกแท็บ (ลำดับ
                      คอลัมน์ในแท็บสัญญายังเหมือนเดิมเป๊ะ เพราะวางไว้ตำแหน่งเดิมระหว่างจำนวนครั้งกับ
                      สถานะสัญญา) — แก้ไขได้ทุกแถวสำหรับแอดมิน/manager ไม่จำกัดเฉพาะสัญญาจริงอีกต่อไป */}
                  <EditableCell
                    editable={isAdminOrManager && canEditField(c, "jobValue")} columnKey="jobValue"
                    editing={editingCell?.key === c.key && editingCell?.field === "jobValue"}
                    value={c.jobValue} editValue={editValue} editType="number" saving={editSaving}
                    width={colVar("jobValue")} align="right"
                    formatDisplay={(v) => (hasMoney(v) ? formatBaht(v) : <Dash />)}
                    onStartEdit={() => beginEdit(c, "jobValue")}
                    onCommit={(v) => commitEdit(c, v)}
                    onCancel={cancelEdit}
                  />
                  {/* ⚠️ โชว์ % ของมูลค่างานเป็นข้อมูลประกอบเท่านั้น ไม่ได้เก็บลงฐานข้อมูล — ค่าที่ตกลง
                      กับลูกค้าคือ "จำนวนเงิน" ถ้าเก็บเป็น % แล้ววันหนึ่งมูลค่างานถูกแก้ ค่าคอมจะเปลี่ยน
                      ตามเองเงียบๆ ทั้งที่ตกลงกันเป็นตัวเงินไปแล้ว (ดูเหตุผลเต็มที่ models/Events.js) */}
                  <EditableCell
                    editable={isAdminOrManager && canEditField(c, "commission")} columnKey="commission"
                    editing={editingCell?.key === c.key && editingCell?.field === "commission"}
                    value={c.commission} editValue={editValue} editType="number" saving={editSaving}
                    width={colVar("commission")} align="right"
                    formatDisplay={(v) => (hasMoney(v) ? (
                      <Stack spacing={0} alignItems="flex-end">
                        <Box component="span">{formatBaht(v)}</Box>
                        {commissionPct(c) && (
                          <Box component="span" sx={{ fontSize: "0.65rem", color: TEXT_SUB, lineHeight: 1.2 }}>
                            {commissionPct(c)}
                          </Box>
                        )}
                      </Stack>
                    ) : <Dash />)}
                    onStartEdit={() => beginEdit(c, "commission")}
                    onCommit={(v) => commitEdit(c, v)}
                    onCancel={cancelEdit}
                  />
                  {/* ✅ สถานะสัญญา — ระบบเติมข้อความให้อัตโนมัติ (หมดอายุ/ใกล้หมดอายุ/มีผลบังคับใช้ หรือ
                      "ข้อมูลไม่ครบ" พร้อมบอกว่าขาดช่องไหน) และ "คลิกพิมพ์ทับได้" ตามที่ผู้ใช้ขอ — บางสถานะ
                      จริงในการทำงาน เช่น "รอลูกค้าเซ็นกลับ" ระบบไม่มีทางเดาเองได้จากวันที่ในสัญญา
                      ⚠️ ปล่อยช่องให้ว่าง = กลับไปใช้ข้อความอัตโนมัติ (ไม่ได้แปลว่า "ไม่มีสถานะ") */}
                  {!hideContractOnlyColumns && (
                  <TableCell data-col-key="status" align="center" sx={{ width: colVar("status") }}>
                    {(() => {
                      const sd = statusDisplay(c);
                      const hint = sd.missing.length > 0 ? `ยังไม่ได้กรอก: ${sd.missing.join(" · ")}` : "";
                      return (
                        <EditableCell
                          Wrapper={Box} align="center"
                          editable={isAdminOrManager} columnKey="statusNote"
                          editing={editingCell?.key === c.key && editingCell?.field === "statusNote"}
                          value={c.statusNote || ""} editValue={editValue} saving={editSaving}
                          placeholder="พิมพ์หมายเหตุสถานะ"
                          title={[
                            sd.kind === "note" ? "หมายเหตุที่พิมพ์เอง" : sd.label || "ยังไม่มีสถานะ",
                            hint,
                            isAdminOrManager ? "คลิกเพื่อพิมพ์แก้ไข (เว้นว่างเพื่อกลับไปใช้ข้อความอัตโนมัติ)" : "",
                          ].filter(Boolean).join("\n")}
                          formatDisplay={() => (sd.kind === "none" ? <Dash /> : (
                            <Stack direction="row" spacing={0.4} alignItems="center" justifyContent="center">
                              <Chip
                                label={sd.label} size="small"
                                sx={{
                                  height: 20, maxWidth: "100%", fontSize: "0.7rem", fontWeight: 700,
                                  bgcolor: sd.bg, color: sd.color,
                                  "& .MuiChip-label": { px: 0.9, overflow: "hidden", textOverflow: "ellipsis" },
                                }}
                              />
                              {/* ⚠️ ยังเตือน "ข้อมูลไม่ครบ" ต่อแม้จะคำนวณสถานะได้แล้ว/พิมพ์หมายเหตุทับไว้ —
                                  ช่องที่ขาดไม่ได้หายไปไหนเพราะมีคนพิมพ์หมายเหตุ ถ้าซ่อนตรงนี้จะกลายเป็น
                                  ว่าการพิมพ์หมายเหตุ "กลบ" ของที่ยังไม่ได้กรอกไปเงียบๆ */}
                              {sd.missing.length > 0 && sd.kind !== "incomplete" && (
                                <Tooltip title={hint}>
                                  <WarningAmber sx={{ fontSize: 14, color: "#b45309" }} />
                                </Tooltip>
                              )}
                              {/* จุดสีบอกสถานะจริงที่ระบบคำนวณได้ ตอนที่หมายเหตุพิมพ์เองบังข้อความไว้ */}
                              {sd.auto && (
                                <Tooltip title={`ระบบคำนวณจากวันสิ้นสุดสัญญาว่า: ${sd.auto.label}`}>
                                  <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: sd.auto.color, flexShrink: 0 }} />
                                </Tooltip>
                              )}
                            </Stack>
                          ))}
                          onStartEdit={() => beginEdit(c, "statusNote")}
                          onCommit={(v) => commitEdit(c, v)}
                          onCancel={cancelEdit}
                        />
                      );
                    })()}
                  </TableCell>
                  )}
                  {/* ✅ ยุบคอลัมน์ "จำนวนครั้งทั้งหมด" มารวมกับ "คืบหน้า" — ป้ายคืบหน้าเขียน "เสร็จ/ทั้งหมด"
                      อยู่แล้ว (ดู progressInfo) ตัวเลขทั้งหมดจึงซ้ำกันทั้งคอลัมน์ ไม่ต้องแยกช่องอีก
                      สิ่งที่เคยมีเฉพาะช่องนั้นและต้องยกมาด้วยคือจุดแดงเตือน "เลยกำหนดรอบถัดไป" — ย้ายมา
                      อยู่ข้างป้ายคืบหน้าตรงนี้แทน ความหมายยังคู่กันพอดี (คืบหน้าไปถึงไหน / ค้างรอบไหนอยู่) */}
                  <TableCell data-col-key="progress" align="center" sx={{ width: colVar("progress") }}>
                    {(() => {
                      // ✅ ใช้ progressInfo (ฟังก์ชันกลาง) ตัวเดียวกับที่ไฟล์ Excel ที่ส่งออกใช้ กันตัวเลข
                      // บนจอกับในไฟล์ไม่ตรงกัน — ดูรายละเอียดตรรกะที่นิยามของ progressInfo ด้านบน
                      const info = progressInfo(c, countUsedRounds);
                      return (
                        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                          <Chip
                            label={info.label} size="small"
                            sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700, bgcolor: alpha(info.color, 0.12), color: info.color }}
                          />
                          {overdueInfo && (
                            <Tooltip title={`รอบล่าสุด ${thaiDateNumeric(overdueInfo.lastVisitDate)} — ต้องเข้ารอบถัดไปภายใน ${overdueInfo.intervalMonths} เดือน เกินกำหนดแล้ว ${overdueInfo.monthsOverdue} เดือน ยังไม่ได้ลงแผนงานครั้งถัดไป`}>
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
                    const roundVisits = roundVisitsOf(c, n);
                    const pendingDraft = roundVisits.length === 0 && c.visits.find((v) => v.unscheduled && (Number(v.time) || 1) === n);
                    // ✅ ครั้งเดียวมีได้หลายวันที่ — โชว์แค่ 3 วันแรกก่อน ที่เหลือพับไว้ กันแถวสูงผิดปกติ
                    // (ดู VISIT_CELL_PREVIEW) เมื่อกางแล้วปุ่มจะเปลี่ยนเป็น "ย่อ" กลับได้เสมอ
                    const visitCellKey = `${c.key}|${n}`;
                    const visitCellExpanded = expandedVisitCells.has(visitCellKey);
                    const shownVisits = visitCellExpanded ? roundVisits : roundVisits.slice(0, VISIT_CELL_PREVIEW);
                    const hiddenVisitCount = roundVisits.length - shownVisits.length;
                    return (
                      <TableCell key={n} data-col-key={`visit_${n}`} align="center" sx={{ width: colVar(`visit_${n}`), overflow: "hidden" }}>
                        {roundVisits.length > 0 ? (
                          <Stack spacing={0.25} alignItems="center">
                            {shownVisits.map((visit) => (
                              <Box key={visit._id} sx={{ textAlign: "center" }}>
                                <Link
                                  to={`/operation/${visit._id}${resolveOperationGroup(visit) ? `?group=${resolveOperationGroup(visit)}` : ""}`}
                                  style={{ color: STATUS_COLOR[visit.status] || ACCENT, fontWeight: 600, textDecoration: "none", fontSize: "0.78rem", whiteSpace: "nowrap" }}
                                >
                                  {formatEventDateRange(visit)}
                                </Link>
                                {/* ✅ ทีมที่เข้างานของ "ครั้งนี้" โดยเฉพาะ — อิงจาก visit.team ของ
                                    document นี้ตรงๆ (ข้อมูลเดิมที่มีอยู่แล้ว ไม่ใช่ค่ารวมระดับสัญญา)
                                    เพราะแต่ละครั้งอาจเข้าโดยคนละทีมกัน แก้ไขแยกทีละครั้งได้เลยที่นี่
                                    (ไม่ sync กับทีมครั้งอื่น/ผู้รับผิดชอบสัญญา — ดู commitRoundTeamEdit) */}
                                {roundTeamEdit?.visitId === visit._id ? (
                                  <TextField
                                    select autoFocus size="small" variant="standard" value={roundTeamEdit.value}
                                    disabled={roundTeamSaving}
                                    onChange={(e) => commitRoundTeamEdit(visit, e.target.value)}
                                    onBlur={() => commitRoundTeamEdit(visit)}
                                    onKeyDown={(e) => { if (e.key === "Escape") cancelRoundTeamEdit(); }}
                                    SelectProps={{ native: true }}
                                    sx={{ mt: 0.25, width: "100%", "& .MuiInputBase-input": { fontSize: "0.68rem", py: 0.2, textAlign: "center" } }}
                                  >
                                    <option value="">— ไม่ระบุ —</option>
                                    {teamOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                                  </TextField>
                                ) : (
                                  <Typography
                                    variant="caption"
                                    onClick={() => beginRoundTeamEdit(visit, c)}
                                    title={canEditRoundTeam(c) ? "คลิกเพื่อแก้ไขทีมของครั้งนี้" : (visit.team || "")}
                                    sx={{
                                      display: "block", fontSize: "0.65rem", lineHeight: 1.3, whiteSpace: "nowrap",
                                      color: visit.team ? "text.secondary" : "text.disabled",
                                      cursor: canEditRoundTeam(c) ? "pointer" : "default",
                                      "&:hover": canEditRoundTeam(c) ? { color: ACCENT, textDecoration: "underline" } : {},
                                    }}
                                  >
                                    👷 {visit.team || (canEditRoundTeam(c) ? "ระบุทีม" : "-")}
                                  </Typography>
                                )}
                              </Box>
                            ))}
                            {/* ✅ ปุ่มกาง/ย่อรายการวันที่ที่เหลือของครั้งนี้ — บอกจำนวนที่ซ่อนอยู่ให้ชัด
                                จะได้รู้ว่ายังมีข้อมูลอีก ไม่ใช่ตัดทิ้งเงียบๆ */}
                            {(hiddenVisitCount > 0 || visitCellExpanded) && (
                              <Box
                                component="button" type="button"
                                onClick={() => toggleVisitCell(visitCellKey)}
                                sx={{
                                  border: "none", bgcolor: "transparent", cursor: "pointer", p: 0,
                                  fontSize: "0.65rem", fontWeight: 700, fontFamily: "inherit",
                                  color: TEXT_SUB, whiteSpace: "nowrap",
                                  "&:hover": { color: ACCENT, textDecoration: "underline" },
                                }}
                              >
                                {visitCellExpanded ? "ย่อ" : `+ อีก ${hiddenVisitCount} วัน`}
                              </Box>
                            )}
                            {/* ✅ วางบิล "ทีเดียวต่อครั้ง" ไม่ใช่ต่อ document — งานเดียวกันที่เข้าหลายช่วง
                                ไม่ต่อเนื่อง (เช่น 21 ส.ค. แล้วเว้นไป 31 ส.ค.–4 ก.ย.) ยังเป็นครั้งเดียวกัน
                                จึงมีใบวางบิลใบเดียว ป้ายนี้จึงอยู่ท้ายรายการวันที่ 1 อัน ไม่ใช่ใต้ทุกวันที่ */}
                            {/* ✅ วางบิล + เอกสารของครั้งนี้อยู่บรรทัดเดียวกัน — ทั้งคู่คือ "สถานะของครั้งนี้"
                                เหมือนกัน และรวมบรรทัดช่วยไม่ให้แถวสูงขึ้นอีกชั้น (1 แถวมีได้ 12 ช่อง) */}
                            <Stack direction="row" alignItems="center" justifyContent="center" gap={0.5} sx={{ flexWrap: "wrap" }}>
                              <BillingChip
                                roundVisits={roundVisits}
                                canManage={isAdminOrManager}
                                onOpen={handleOpenBilling}
                              />
                              <JobDocsChip
                                roundVisits={roundVisits}
                                rowKey={c.key}
                                round={n}
                                title={docsTitleFor(c, n)}
                                onOpen={handleOpenDocs}
                                canUpload={canEditRoundTeam(c)}
                              />
                            </Stack>
                            {/* ✅ แถวปุ่มจัดการครั้งนี้ (เพิ่มวันต่อเนื่อง / ย้ายครั้งที่ / แยกออกจากสัญญา)
                                ⚠️ ไม่แสดงบนตารางจอมือถือ — ช่อง "ครั้งที่ N" กว้างแค่ 94px แต่ต้องใส่
                                วันที่ + ชื่อทีม + ปุ่มอีก 3 ตัวซ้อนลงไป ทำให้เซลล์แน่นจนอ่านวันที่ไม่รู้เรื่อง
                                และตัวปุ่มเองเล็กแค่ 14px กดด้วยนิ้วแทบไม่โดนอยู่ดี — ทั้ง 3 อย่างยังทำได้ครบ
                                จากมุมมองการ์ดบนมือถือ และจากตารางบนจอคอม */}
                            {/* ✅ ผู้รับผิดชอบสัญญานี้จัดการครั้งของตัวเองได้ด้วย (ไม่ใช่แค่ admin/manager)
                                — ใช้ canEditRoundTeam ซึ่งเป็นนิยาม "ผู้รับผิดชอบตัวจริง" ชุดเดียวกับที่
                                ใช้คุมการแก้ทีมรายครั้งอยู่แล้ว จะได้ไม่มีนิยามสิทธิ์ 2 ชุดในไฟล์เดียวกัน
                                ⚠️ "แยกออกจากสัญญา" ยังเป็นของ admin/manager เท่านั้น (ดูปุ่มที่ 3) */}
                            {canEditRoundTeam(c) && c.isRealContract && !useMobileTable && (
                              <Stack direction="row" spacing={0.25}>
                                <Tooltip title="เพิ่มวันที่ต่อเนื่อง (เข้างานไม่ติดกัน)">
                                  <IconButton
                                    size="small" onClick={() => openExtendVisitDialog(c, n)}
                                    sx={{ p: 0.25, color: "text.disabled", transition: "background-color .15s, color .15s", "&:hover": { color: ACCENT, bgcolor: alpha(ACCENT, 0.1) } }}
                                  >
                                    <Add sx={{ fontSize: 14 }} />
                                  </IconButton>
                                </Tooltip>
                                {/* ✅ ย้ายครั้งนี้ไปเป็นครั้งที่อื่นได้อิสระ (ยกทั้งวันที่/สถานะ/ทีม/
                                    ประวัติงาน) — ปลายทางที่มีข้อมูลอยู่แล้วจะสลับที่กัน ไม่เขียนทับ */}
                                <Tooltip title="ย้ายครั้งนี้ไปเป็นครั้งที่อื่น">
                                  <IconButton
                                    size="small" onClick={() => openMoveRoundDialog(c, n)}
                                    sx={{ p: 0.25, color: "text.disabled", transition: "background-color .15s, color .15s", "&:hover": { color: ACCENT, bgcolor: alpha(ACCENT, 0.1) } }}
                                  >
                                    <SwapHoriz sx={{ fontSize: 14 }} />
                                  </IconButton>
                                </Tooltip>
                                {/* ⚠️ เฉพาะ admin/manager — "แยกออกจากสัญญา" ดึงครั้งนั้นออกจากสัญญา
                                    ไปเป็นงานลอย ซึ่งกระทบทั้งจำนวนครั้งที่ใช้ไป/ความคืบหน้า/ยอดรวมของ
                                    สัญญาทั้งใบ และย้อนกลับเองไม่ได้ในคลิกเดียว ผู้รับผิดชอบจึงไม่ควรทำเอง */}
                                {isAdminOrManager && (
                                  <Tooltip title="แยกครั้งนี้ออกจากสัญญา (ย้ายเป็นงานเก่าที่ยังไม่จัดกลุ่ม)">
                                    <IconButton
                                      size="small" onClick={() => handleDetachRound(c, n)}
                                      sx={{ p: 0.25, color: "text.disabled", transition: "background-color .15s, color .15s", "&:hover": { color: ACCENT, bgcolor: alpha(ACCENT, 0.1) } }}
                                    >
                                      <LinkOff sx={{ fontSize: 14 }} />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Stack>
                            )}
                          </Stack>
                        ) : pendingDraft ? (
                          // ✅ กดได้เลย — สัญญาเปิดกล่อง "เพิ่มครั้งที่ 1" ในหน้านี้เลย ส่วนงานทั่วไป/
                          // โปรเจคพาไปหน้าปฏิทิน เจาะจงการ์ดนั้นในแผงงานล่วงหน้า (ดู pendingDraftChip
                          // ซึ่งอธิบายเหตุผลที่ต้องแยกปลายทางกันไว้ละเอียดแล้ว) เห็นชัดว่ากดได้จาก
                          // พื้นหลังชิป + ขีดเส้นใต้ตอน hover เหมือนลิงก์อื่นในตารางนี้
                          (() => {
                            const chip = pendingDraftChip(c, pendingDraft);
                            return (
                              <Tooltip title={chip.tip}>
                                <Box
                                  {...chip.props}
                                  sx={{
                                    fontSize: "0.72rem", color: "#b45309", fontWeight: 600, whiteSpace: "nowrap",
                                    textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 0.4,
                                    px: 0.75, py: 0.25, borderRadius: 1.5, bgcolor: alpha("#f59e0b", 0.1),
                                    border: "1px solid", borderColor: alpha("#f59e0b", 0.3),
                                    transition: "background-color 0.15s ease, border-color 0.15s ease",
                                    "&:hover": { bgcolor: alpha("#f59e0b", 0.2), borderColor: "#b45309", textDecoration: "underline" },
                                    ...(chip.props.sx || {}),
                                  }}
                                >
                                  {chip.label}
                                </Box>
                              </Tooltip>
                            );
                          })()
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
                  {/* ✅ คอลัมน์ "ทีมที่เข้างาน" ระดับสัญญาถูกตัดออก (ทีมของแต่ละครั้งแก้ไขได้ในช่อง
                      "ครั้งที่ N" ด้านบนแล้ว) — "ผู้รับผิดชอบ" ด้านล่างเป็นฟิลด์อิสระ แก้ไข inline
                      ได้ตามปกติ ไม่ผูก/ไม่ sync กับทีมที่เข้างานเลย (ดูคอมเมนต์ที่หัวตาราง) */}
                  <EditableCell
                    editable={isAdminOrManager && canEditField(c, "responsiblePerson")} columnKey="responsiblePerson"
                    editing={editingCell?.key === c.key && editingCell?.field === "responsiblePerson"}
                    value={c.responsiblePerson} editValue={editValue} editType="select" editOptions={teamOptions} saving={editSaving}
                    width={colVar("responsiblePerson")}
                    title={c.responsiblePerson || "ยังไม่ได้มอบหมายผู้รับผิดชอบ"}
                    formatDisplay={unassignedResponsibleDisplay}
                    onStartEdit={() => beginEdit(c, "responsiblePerson")}
                    onCommit={(v) => commitEdit(c, v)}
                    onCancel={cancelEdit}
                  />
                  {/* ✅ หมายเหตุ — คลิกพิมพ์ได้เลยเหมือนช่องอื่น ข้อความยาวถูกตัดด้วย … แต่ยังอ่านเต็มได้
                      จาก tooltip (และการ์ดมือถือแสดงเต็มไม่ตัด) */}
                  <EditableCell
                    editable={isAdminOrManager && canEditField(c, "remark")} columnKey="remark"
                    editing={editingCell?.key === c.key && editingCell?.field === "remark"}
                    value={c.remark} editValue={editValue} saving={editSaving}
                    width={colVar("remark")}
                    placeholder="พิมพ์หมายเหตุ"
                    title={c.remark || (isAdminOrManager ? "คลิกเพื่อเพิ่มหมายเหตุ" : "ไม่มีหมายเหตุ")}
                    formatDisplay={(v) => (v
                      ? <Box component="span" sx={{ fontSize: "0.78rem", color: "text.secondary" }}>{v}</Box>
                      : <Dash />)}
                    onStartEdit={() => beginEdit(c, "remark")}
                    onCommit={(v) => commitEdit(c, v)}
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
                        {/* ✅ ประวัติการแก้ไข — เฉพาะสัญญาจริง เพราะข้อมูลสัญญา (มูลค่า/วันที่/เลขที่)
                            แก้ได้จากตารางนี้โดยตรงและมีผลกับทุกครั้งในสัญญาพร้อมกัน จึงต้องตามกลับได้
                            ⚠️ จางลงเมื่อยังไม่เคยมีการแก้ไข — บอกได้ทันทีว่ากดไปก็ไม่มีอะไร */}
                        {c.isRealContract && (
                          <Tooltip title={contractEditHistory(c).length > 0
                            ? `ประวัติการแก้ไขข้อมูลสัญญา (${contractEditHistory(c).length} ครั้ง)`
                            : "ยังไม่เคยมีการแก้ไขข้อมูลสัญญานี้"}>
                            <span>
                              <IconButton
                                size="small" onClick={() => setHistoryContract(c)}
                                disabled={contractEditHistory(c).length === 0}
                                sx={{ color: "text.disabled", transition: "background-color .15s, color .15s", "&:hover": { color: ACCENT, bgcolor: alpha(ACCENT, 0.1) } }}
                              >
                                <History fontSize="small" />
                              </IconButton>
                            </span>
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
              })
  // 🐛 BUG ที่แก้ (จอขาวทันทีที่เปิดหน้า): dependency array ถูก "ประเมินทุก render" ไม่ใช่ตอน callback
  // ทำงาน — เดิมมี roundTeamEdit.value อยู่ในนี้ ซึ่ง eslint แนะนำมาตามที่โค้ดเขียนไว้ใน JSX (ตรงนั้น
  // อยู่ในเงื่อนไข roundTeamEdit?.visitId === ... จึงปลอดภัย) แต่พอย้ายมาอยู่ใน dep array มันไม่มี
  // เงื่อนไขคุมแล้ว และ roundTeamEdit เริ่มต้นเป็น null → TypeError ตั้งแต่ render แรก
  // ⚠️ ทุก dep ที่เป็นการเข้าถึงสมาชิกของ state ที่มีโอกาสเป็น null ต้องใช้ ?. เสมอ
  ), [beginEdit, beginRoundTeamEdit, canEditBasicField, canEditField, canEditRoundTeam, colWidth, commitEdit, commitRoundTeamEdit, editSaving, editValue, editingCell?.field, editingCell?.key, expandedVisitCells, handleDeleteContract, handleDetachRound, handleOpenBilling, handleOpenDocs, hideContractOnlyColumns, isAdminOrManager, pagedRows, pendingDraftChip, roundTeamEdit?.value, roundTeamEdit?.visitId, roundTeamSaving, selectedIds, showCheckboxes, systemOptions, teamOptions, titleOptions, useMobileTable, visitColumns]);

  // ── ย้าย "ครั้งที่ N" ไปครั้งที่อื่นได้อย่างอิสระ ──────────────────────────
  // ✅ ย้ายยกทั้งครั้ง (วันที่/สถานะ/ทีม/ประวัติงานทุก document ของครั้งนั้นติดไปด้วยครบ ไม่ใช่แค่เลข) —
  // งานจริงเลื่อน/สลับรอบกันได้เสมอ เดิมแก้ไม่ได้เลยนอกจากลบทิ้งแล้วสร้างใหม่ (ประวัติงานหายหมด)
  // ✅ ปลายทางที่มีครั้งอยู่แล้ว = สลับที่กัน (ไม่เขียนทับ) ข้อมูลทั้งสองครั้งอยู่ครบเสมอ
  const [moveRoundTarget, setMoveRoundTarget] = useState(null); // { contract, fromRound } | null
  const [moveRoundValue, setMoveRoundValue] = useState("");
  const [moveRoundSaving, setMoveRoundSaving] = useState(false);
  const openMoveRoundDialog = (contract, fromRound) => {
    setMoveRoundTarget({ contract, fromRound });
    setMoveRoundValue("");
  };
  const closeMoveRoundDialog = () => { setMoveRoundTarget(null); setMoveRoundValue(""); };

  const handleMoveRoundSubmit = async () => {
    if (!moveRoundTarget || moveRoundSaving) return;
    const { contract: c, fromRound } = moveRoundTarget;
    const to = Number(moveRoundValue);
    if (!Number.isInteger(to) || to < 1 || to > MAX_VISIT_COUNT) {
      Swal.fire({ title: "ย้ายไม่สำเร็จ", text: `ครั้งที่ปลายทางต้องอยู่ระหว่าง 1-${MAX_VISIT_COUNT}`, icon: "error" });
      return;
    }
    if (to === fromRound) { closeMoveRoundDialog(); return; }

    // ✅ ถามยืนยันเมื่อปลายทางมีครั้งอยู่แล้ว — บอกให้ชัดว่าจะ "สลับที่กัน" ไม่ใช่ทับข้อมูลหาย
    const targetVisits = c.visits.filter((v) => !v.unscheduled && Number(v.time) === to);
    if (targetVisits.length > 0) {
      const result = await Swal.fire({
        icon: "question",
        title: `สลับครั้งที่ ${fromRound} ↔ ${to}?`,
        html: `
          <div style="text-align:left;font-size:13px;">
            ครั้งที่ ${to} มีข้อมูลอยู่แล้ว — ระบบจะ<b>สลับที่กัน</b> ไม่ได้เขียนทับ<br/>
            ข้อมูลวันที่/สถานะ/ทีม/ประวัติงานของทั้งสองครั้งยังอยู่ครบทุกอย่าง
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: "สลับที่กัน",
        confirmButtonColor: "#dc2626",
        cancelButtonText: "ยกเลิก",
      });
      if (!result.isConfirmed) return;
    }

    setMoveRoundSaving(true);
    try {
      const res = await EventService.MoveContractRound(c.key, { fromTime: fromRound, toTime: to });
      closeMoveRoundDialog();
      // ✅ ดึงข้อมูลใหม่ทั้งชุดหลังย้ายเสร็จ — ครั้งที่ (time) เป็นตัวจัดกลุ่มแถว/เรียงคอลัมน์ทั้งตาราง
      // แก้ทีเดียวกระทบหลายแถว/หลายคอลัมน์พร้อมกัน อัปเดตเฉพาะจุดแบบ optimistic ไม่ครอบคลุมพอ
      await fetchData(true);
      Swal.fire({
        title: res?.swapped ? `สลับครั้งที่ ${fromRound} ↔ ${to} สำเร็จ ✅` : `ย้ายไปครั้งที่ ${to} สำเร็จ ✅`,
        icon: "success", timer: 1400, showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({
        title: "ย้ายไม่สำเร็จ",
        text: err?.response?.data?.message || err.message,
        icon: "error",
      });
    } finally {
      setMoveRoundSaving(false);
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

  // ── ออกใบส่งมอบงานจากแถวในตาราง ────────────────────────────────────────
  // ⚠️ แถวในตารางนี้เป็น "ระดับสัญญา" (รวมหลายครั้งเข้าด้วยกัน — ดู groupEventsByContract) ไม่ใช่
  // งานเดี่ยว จึงต้องเลือกก่อนว่าจะออกใบให้ "ครั้งไหน" — ใช้ครั้งล่าสุดที่ลงตารางจริง (ไม่ใช่แผนงาน
  // ล่วงหน้าที่ยังไม่มีวันที่) เพราะเป็นครั้งที่เพิ่งทำเสร็จและกำลังจะส่งมอบตามลำดับงานจริง
  // ✅ ถ้าแถวนั้นยังไม่เคยลงวันที่จริงเลย ก็ยังออกได้ โดยใช้ข้อมูลระดับสัญญาเป็นตัวตั้งแทน
  // (ผู้ใช้แก้วันที่เองได้ในกล่อง) ดีกว่าปิดปุ่มเงียบๆ จนไม่รู้ว่าทำไมกดไม่ได้
  const [deliveryNoteJob, setDeliveryNoteJob] = useState(null);
  const openDeliveryNoteFromRow = () => {
    const c = classifyMenuTarget;
    closeClassifyMenu();
    if (!c) return;
    const latestVisit = c.visits
      .filter((v) => !v.unscheduled)
      .sort((a, b) => new Date(b.start || b.date) - new Date(a.start || a.date))[0];
    // ⚠️ ต้องหิ้ว contractNo ไปด้วย — ตัวเลือก "อ้างถึง" ในกล่องออกเอกสารสร้างจากเลขเอกสารที่ติดมากับ
    // งาน (ดู referencePresetsFor) ถ้าไม่ส่งไป สัญญาที่ไม่มีใบเสนอราคาจะไม่มีตัวเลือกให้อ้างอิงเลย
    setDeliveryNoteJob(latestVisit || {
      company: c.company, site: c.site, title: c.title, system: c.system,
      quotationNo: c.quotationNo, contractNo: c.contractNo, docNo: c.docNo,
      responsiblePerson: c.responsiblePerson,
    });
  };

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

  // ── แถบยอดรวมตรึงท้ายจอ (เฉพาะมือถือ) ──────────────────────────────────────
  // 🐛 BUG ที่แก้ (ยอดรวมหายไปบนมือถือ): ตารางมีแถวสรุปท้ายตาราง (TableFooter) อยู่แล้ว แต่บนจอมือถือ
  // แถวนั้นตกไปอยู่ใต้คอลัมน์ "มูลค่างาน" ซึ่งอยู่นอกจอไปทางขวา ต้องปัดไปหาถึงจะเห็น ส่วนมุมมองการ์ด
  // ก็ไม่มีที่ให้วางแถวสรุปเลย — และเดิมที่เอาไปวางเป็นการ์ดบนสุด ก็หายไปทันทีที่เลื่อนดูรายการ
  // ✅ ตรึงไว้ท้ายจอแทน เห็นตลอดเวลาไม่ว่าจะเลื่อนอยู่ตรงไหน (ยอดรวมคือสิ่งที่คนเปิดหน้านี้มาดู)
  // ⚠️ ต้องยิงผ่าน Portal ไปแปะที่ <body> — position:fixed จะยึดกับ "ขอบจอ" ก็ต่อเมื่อไม่มีบรรพบุรุษ
  // ตัวไหนสร้าง containing block ทับ ซึ่ง layout ของแอปนี้มีทั้ง .pageWrapper (overflow-x:hidden)
  // และ .contentArea (ได้ class .blur-content ที่ใส่ filter จริงตอนเปิดเมนูมือถือ) พอโดนตัวใดตัวหนึ่ง
  // จับ แถบก็จะไปยึดกับกล่องนั้นแทนแล้วหลุดออกนอกพื้นที่ที่มองเห็นไปเลย
  // ⚠️ ตัวเลขมาจาก jobValueSummary ตัวเดียวกับฝั่งเดสก์ท็อปเป๊ะ ไม่ได้คำนวณซ้ำอีกชุด
  const renderMobileSummaryBar = () => (
    <Portal>
      <Paper
        elevation={0}
        sx={{
          position: "fixed", left: 0, right: 0, bottom: 0,
          // ต่ำกว่า Dialog (1300) และแถบเมนูมือถือ (10000) — ไม่บังของที่ต้องอยู่บนสุด
          zIndex: 1200,
          borderRadius: 0, borderTop: `1px solid ${BORDER_MAIN}`,
          bgcolor: "#fff", boxShadow: "0 -2px 12px rgba(15,23,42,0.1)",
          px: 2, pt: 1.25, pb: 1.5,
        }}
      >
        {/* ✅ แตะที่แถบเพื่อกาง/ย่อรายละเอียด — แถบตรึงต้องเตี้ยที่สุดเท่าที่จะทำได้ (มันกินพื้นที่จอ
            ตลอดเวลา) จึงโชว์แค่ยอดรวมกับจำนวนรายการก่อน ส่วนคำเตือน/ขอบเขตตัวกรองพับไว้ให้กดดู */}
        <Stack
          direction="row" alignItems="center" spacing={1}
          onClick={() => setSummaryBarOpen((o) => !o)}
          sx={{ cursor: "pointer", userSelect: "none" }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 700, display: "block", lineHeight: 1.3 }}>
              รวมมูลค่างานทั้งหมด
            </Typography>
            <Typography variant="caption" sx={{ color: "text.disabled" }}>
              {jobValueSummary.filledCount.toLocaleString()}/{jobValueSummary.rowCount.toLocaleString()} รายการ · ทุกหน้า
            </Typography>
          </Box>
          {/* ✅ เตือนแบบย่อตอนพับอยู่ — ถ้ายอดยังไม่ครบต้องรู้ตั้งแต่ยังไม่ได้กางดู ไม่งั้นเอายอดไปใช้ผิด */}
          {jobValueSummary.missingCount > 0 && !summaryBarOpen && (
            <Tooltip title={`ยังไม่ได้กรอกมูลค่า ${jobValueSummary.missingCount} รายการ`}>
              <WarningAmber sx={{ fontSize: 18, color: "#b45309", flexShrink: 0 }} />
            </Tooltip>
          )}
          <Stack spacing={0} alignItems="flex-end">
            <Typography sx={{ fontWeight: 800, fontSize: "1.2rem", color: ACCENT, whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
              {formatBaht(jobValueSummary.total)}
            </Typography>
            {/* ✅ ยอดรวมค่าคอมอยู่ใต้ยอดมูลค่างานในแถบเดียวกัน — บนมือถือไม่มีแถวสรุปท้ายตารางให้อ่าน
                ⚠️ โผล่เฉพาะตอนมีค่าคอมจริง ไม่งั้นแถบนี้จะมี ฿0 ห้อยอยู่ตลอดเวลาโดยไม่มีความหมาย */}
            {commissionSummary.total > 0 && (
              <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#7c3aed", whiteSpace: "nowrap" }}>
                คอม {formatBaht(commissionSummary.total)}
              </Typography>
            )}
          </Stack>
          {summaryBarOpen ? <ExpandMore sx={{ fontSize: 20, color: TEXT_SUB }} /> : <ExpandLess sx={{ fontSize: 20, color: TEXT_SUB }} />}
        </Stack>

        <Collapse in={summaryBarOpen}>
          {jobValueSummary.missingCount > 0 && (
            <Typography
              variant="caption"
              sx={{ mt: 1, display: "flex", alignItems: "center", gap: 0.5, color: "#b45309", fontWeight: 600 }}
            >
              <WarningAmber sx={{ fontSize: 13 }} />
              ยังไม่ได้กรอกมูลค่า {jobValueSummary.missingCount} รายการ — ยอดนี้เป็นยอดเท่าที่กรอกแล้ว
            </Typography>
          )}
          {/* ✅ แจกแจงขอบเขตของยอดรวม (แท็บ + ตัวกรอง + คำค้นหา) เหมือนฝั่งเดสก์ท็อป — กันตีความยอด
              ผิดว่าเป็นยอดทั้งระบบ ทั้งที่จริงถูกกรองอยู่ */}
          <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: "wrap", rowGap: 0.5 }}>
            {summaryScopeLabels.map((label) => (
              <Chip
                key={label} size="small" variant="outlined" label={label}
                sx={{
                  height: 19, fontSize: "0.65rem", fontWeight: 600, maxWidth: "100%",
                  color: "text.secondary", borderColor: alpha("#0f172a", 0.18),
                  "& .MuiChip-label": { px: 0.75, overflow: "hidden", textOverflow: "ellipsis" },
                }}
              />
            ))}
          </Stack>
        </Collapse>
      </Paper>
    </Portal>
  );

  // ── การ์ดสำหรับจอมือถือ (isMobile) ──────────────────────────────────────────
  // ✅ ตารางเดิม (20 กว่าคอลัมน์) ต้องเลื่อนซ้าย-ขวาหลายรอบกว่าจะเห็นข้อมูลครบบนจอแคบ — จัดเรียงข้อมูล
  // เดียวกันทั้งหมดใหม่เป็นการ์ดแนวตั้งแทน (ไม่มีข้อมูลไหนหายไป แค่เปลี่ยนทิศทางการอ่าน) ใช้ FieldRow/
  // EditableCell(Wrapper={Box}) ตัวเดียวกับตารางเดสก์ท็อปทุกจุดที่แก้ไขได้ ให้พฤติกรรม/สิทธิ์ตรงกันเป๊ะๆ
  // ไม่ต้องดูแลตรรกะ 2 ชุดแยกกัน
  const renderMobileCard = (c) => {
    const nextOpenRound = c.isRealContract
      ? countUsedRounds(c.visits.filter((v) => !v.unscheduled)) + 1
      : null;
    const overdueInfo = nextVisitOverdueInfo(c);
    const isRoundsExpanded = expandedRounds.has(c.key);
    const latestVisit = c.visits
      .filter((v) => !v.unscheduled)
      .sort((a, b) => new Date(b.start || b.date) - new Date(a.start || a.date))[0];
    const fp = (field) => ({
      editing: editingCell?.key === c.key && editingCell?.field === field,
      editValue, saving: editSaving,
      onStartEdit: () => beginEdit(c, field),
      onCommit: (v) => commitEdit(c, v),
      onCancel: cancelEdit,
    });
    const jobTypeLabel = c.isRealContract ? "งานสัญญา/รายปี" : c.isConfirmedGeneral ? "งานทั่วไป" : c.isConfirmedProject ? "งานโปรเจค" : "ยังไม่จัดกลุ่ม";
    // ⚠️ งานสัญญาใช้สีคราม ไม่ใช่สีแดงแบรนด์ — ป้ายนี้เป็น "หมวดหมู่ของงาน" (ข้อมูลอ้างอิงเฉยๆ) แต่ป้าย
    // ที่วางติดกันข้างล่างคือ "สถานะสัญญา" ซึ่งแดงจริงตอนหมดอายุ/ใกล้หมดอายุ ถ้าหมวดหมู่แดงด้วยจะเห็น
    // ป้ายแดง 2 อันซ้อนกันแล้วแยกไม่ออกว่าอันไหนคือคำเตือนที่ต้องรีบจัดการ (ปัญหา "สีกลบกันเอง")
    const jobTypeColor = c.isRealContract ? "#6366f1" : c.isConfirmedGeneral ? "#10b981" : c.isConfirmedProject ? "#3b82f6" : "#9ca3af";

    // ✅ งานทั่วไป/งานโปรเจค (ไม่ใช่สัญญาจริง) เปลี่ยนจาก "คืบหน้า" (X/Y เฉยๆ) เป็น "สถานะงาน" จริง
    // อิงจาก event ตรงๆ (ดู jobStatusInfo) — สัญญาจริงยังคงโชว์ "X/Y ครั้ง" แบบเดิมทุกประการตามที่ยืนยัน
    // 🐛 BUG ที่แก้: เดิมก๊อปตรรกะคำนวณ total/doneCount ของ progressInfo() มาเขียนซ้ำไว้ที่นี่อีกชุด —
    // พอแก้สูตร total ที่ progressInfo() (ให้ยึดรอบเข้าก่อนเมื่อหารลงตัว) ที่นี่จะไม่รู้ด้วยเลย การ์ดมือถือ
    // กับตารางเดสก์ท็อปเลยโชว์ "คืบหน้า" ไม่ตรงกันได้ทันที ✅ เรียก progressInfo() ตัวเดียวกันแทน กันเกิด
    // จุดที่ 2 แบบนี้ซ้ำอีกในอนาคต (ไฟล์ Excel ที่ส่งออกก็เรียกตัวนี้อยู่แล้ว ดู progressLabel ด้านบนไฟล์)
    const { label: progressLabel, color: progressColor } = progressInfo(c, countUsedRounds);

    const isExpanded = expandedCards.has(c.key);

    return (
      <Paper key={c.key} variant="outlined" sx={{ borderRadius: 3, p: 1.75, borderColor: BORDER_MAIN, boxShadow: "0 1px 2px rgba(15,23,42,0.05)" }}>
        {/* หัวการ์ด — ส่วนที่โชว์เสมอ: บริษัท/โครงการ + หมวดหมู่งาน(สัญญา/ทั่วไป/โปรเจค) + สถานะสัญญา
            แล้วต่อด้วยแถบสรุป ประเภทงาน/ระบบ/มูลค่างาน และแถวคืบหน้า — ครบพอให้ตัดสินใจได้ว่าใบไหน
            คืองานที่กำลังหาโดยไม่ต้องกางสักใบ ที่เหลือกด "รายละเอียด" เพื่อกางดูเพิ่ม (เทียบ pattern
            เดียวกับการ์ดงานในหน้า "การดำเนินงาน") กันการ์ดยาวเกินไปตอนมีหลายรายการในหน้าเดียว */}
        <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mb: isExpanded ? 0.5 : 0 }}>
          {showCheckboxes && isSelectableForMerge(c) && (
            <Checkbox
              size="small" checked={selectedIds.has(c.key)} onChange={() => toggleSelect(c)}
              sx={{ p: 0.5, mt: -0.5, "&.Mui-checked": { color: ACCENT } }}
            />
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <EditableCell
              Wrapper={Box} editable={canEditBasicField(c, "company")} value={c.company} width="100%"
              formatDisplay={(v) => <Typography sx={{ fontWeight: 800, fontSize: "0.98rem", lineHeight: 1.25, wordBreak: "break-word" }}>{v || <Dash />}</Typography>}
              {...fp("company")}
            />
            <EditableCell
              Wrapper={Box} editable={canEditBasicField(c, "site")} value={c.site} width="100%"
              formatDisplay={(v) => <Typography sx={{ fontSize: "0.82rem", color: "text.secondary", wordBreak: "break-word" }}>{v || <Dash />}</Typography>}
              {...fp("site")}
            />
            {/* ✅ การ์ดมือถือ — ใช้ปุ่มเต็ม (ไม่ใช่ compact) เพราะบนมือถือคือจังหวะที่กำลังจะออกรถ
                ต้องแตะง่ายที่สุด ต่างจากตารางบนจอคอมที่พื้นที่จำกัดกว่า */}
            <Box sx={{ mt: 0.75 }}>
              <SiteMapLink company={c.company} site={c.site} canEdit={isAdminOrManager} />
            </Box>
          </Box>
          <Stack alignItems="flex-end" spacing={0.5} sx={{ flexShrink: 0 }}>
            {/* ✅ ป้ายแผนกอยู่บนหัวการ์ดเลย ไม่ต้องกางดู — ตรงกับที่เดสก์ท็อปวางแผนกเป็นคอลัมน์แรกสุด
                (แก้ค่าได้ที่แถว "แผนก" ในส่วนรายละเอียดที่กางออกมา) */}
            <DepartmentPill value={c.departmentTag} />
            <Chip label={jobTypeLabel} size="small" sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700, bgcolor: alpha(jobTypeColor, 0.12), color: jobTypeColor }} />
            {/* 🐛 BUG ที่แก้: ชิปนี้เคยอ่านจาก contractStatusInfo ตรงๆ ผลคือ (1) แถวที่ข้อมูลยังไม่ครบ
                ไม่มีชิปอะไรขึ้นเลย เงียบสนิทจนแยกไม่ออกจาก "ไม่มีสถานะ" และ (2) หมายเหตุที่คนพิมพ์ทับไว้
                ไม่ถูกนำมาแสดง หัวการ์ดมือถือกับตารางเดสก์ท็อปจึงบอกสถานะคนละอย่างของแถวเดียวกัน
                ✅ ใช้ statusDisplay ตัวเดียวกับทุกที่ — ทั้งแอปพูดตรงกันเสมอ */}
            {(() => {
              const sd = statusDisplay(c);
              return sd.kind === "none" ? null : (
                <Chip
                  label={sd.label} size="small"
                  sx={{
                    height: 20, maxWidth: 160, fontSize: "0.65rem", fontWeight: 700,
                    bgcolor: sd.bg, color: sd.color,
                    "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" },
                  }}
                />
              );
            })()}
            {/* ✅ สถานะวางบิล/รับเงินอยู่บนหัวการ์ดเลย ไม่ต้องกางดู — เป็นสิ่งที่ต้องเห็นพร้อมสถานะสัญญา
                ⚠️ ซ่อนชิป "ยังไม่วางบิล" ทิ้ง เพราะเป็นค่าเริ่มต้นของเกือบทุกแถวในช่วงแรกที่เริ่มใช้ระบบ
                ถ้าโชว์ทุกใบจะกลายเป็นเสียงรบกวนที่กลบชิปที่มีความหมายจริงจนหมด */}
            {(() => {
              const bs = contractBillingSummary(c.visits);
              if (!bs || bs.state === "not_invoiced") return null;
              return (
                <Chip
                  label={bs.state === "overdue" && bs.overdueDays > 0 ? `เลยกำหนดชำระ ${bs.overdueDays} วัน` : bs.label}
                  size="small"
                  sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700, bgcolor: alpha(bs.color, 0.12), color: bs.color }}
                />
              );
            })()}
          </Stack>
        </Stack>

        {/* ✅ แถบสรุปหัวการ์ด — "ประเภทงาน / ระบบ / มูลค่างาน" ต้องเห็นทันทีโดยไม่ต้องกด "รายละเอียด"
            เดิม 3 ฟิลด์นี้อยู่ในส่วนที่พับไว้ทั้งหมด การ์ดที่ยังพับอยู่จึงบอกได้แค่ชื่อโครงการกับความคืบหน้า
            มองไม่ออกเลยว่าเป็นงานอะไร ระบบไหน มูลค่าเท่าไหร่ ต้องกางทีละใบถึงจะรู้ (ดูภาพที่ผู้ใช้ส่งมา)
            ⚠️ ใช้ EditableCell ตัวเดียวกับที่เคยอยู่ในส่วนพับ พร้อมเงื่อนไขสิทธิ์เดิมเป๊ะๆ จึงยังแตะแก้ไขได้
            ตรงนี้เลย — และเป็นการ "ย้าย" ไม่ใช่ "เพิ่ม" (ลบ FieldRow เดิมในส่วนพับออกแล้ว) กันข้อมูล
            เดียวกันโผล่ซ้ำ 2 ที่ในการ์ดใบเดียว ซึ่งจะทำให้การ์ดยาวขึ้นโดยไม่ได้ข้อมูลเพิ่ม */}
        <Box
          sx={{
            mt: 1, px: 1, py: 0.75, borderRadius: 2, bgcolor: alpha("#0f172a", 0.025),
            display: "grid",
            // minmax(0,…) จำเป็นทั้ง 3 ช่อง — ไม่งั้นช่องที่ข้อความยาว (เช่นระบบ "Fire Alarm & CCTV")
            // จะดันความกว้างขั้นต่ำของตัวเองจนกริดล้นออกนอกการ์ดแทนที่จะตัดด้วย ellipsis
            // ⚠️ ช่องมูลค่ามีพื้นขั้นต่ำ 84px — ตอนแตะแก้ไขจะกลายเป็นช่องกรอกตัวเลข ถ้าปล่อยให้กว้าง
            // ตามเนื้อหา (auto ล้วน) ช่องกรอกจะหดจนพิมพ์เลขหลักหมื่นแล้วมองไม่เห็นตัวที่พิมพ์
            gridTemplateColumns: "minmax(0,1fr) minmax(0,1.1fr) minmax(84px,auto)",
            columnGap: 1, alignItems: "start",
          }}
        >
          <CardMetaCell label="ประเภทงาน">
            <EditableCell
              Wrapper={Box} width="100%" editable={canEditBasicField(c, "title")} editType="autocomplete" editOptions={titleOptions}
              value={c.title} title={c.title}
              formatDisplay={(v) => <Typography component="span" sx={{ fontSize: "0.82rem", fontWeight: 700, lineHeight: 1.35 }}>{v || <Dash />}</Typography>}
              {...fp("title")}
            />
          </CardMetaCell>
          <CardMetaCell label="ระบบ">
            <EditableCell
              Wrapper={Box} width="100%" editable={canEditBasicField(c, "system")} editType="autocomplete" editOptions={systemOptions}
              value={c.system} title={c.system}
              formatDisplay={(v) => <Typography component="span" sx={{ fontSize: "0.82rem", lineHeight: 1.35, color: v ? "text.primary" : undefined }}>{v || <Dash />}</Typography>}
              {...fp("system")}
            />
          </CardMetaCell>
          <CardMetaCell label="มูลค่างาน" align="right">
            <EditableCell
              Wrapper={Box} width="100%" editable={isAdminOrManager && canEditField(c, "jobValue")} editType="number" value={c.jobValue}
              // ✅ ยังไม่กรอกมูลค่า = บอกตรงๆ ด้วยสีส้มเตือน ไม่ใช่ขีด "–" เงียบๆ ให้เข้าใจว่าเป็นงานไม่มี
              // มูลค่า — ตรงกับคำเตือน "ยังไม่ได้กรอกมูลค่า N รายการ" ในกล่องสรุปยอดรวมด้านบนของหน้า
              formatDisplay={(v) => (hasMoney(v)
                ? <Typography component="span" sx={{ fontSize: "0.88rem", fontWeight: 800, letterSpacing: "-0.01em" }}>{formatBaht(v)}</Typography>
                : <Typography component="span" sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#b45309" }}>ยังไม่ระบุ</Typography>)}
              {...fp("jobValue")}
            />
          </CardMetaCell>
        </Box>

        <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.75 }}>
          <Chip label={progressLabel} size="small" sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700, bgcolor: alpha(progressColor, 0.12), color: progressColor }} />
          {overdueInfo && (
            <Tooltip title={`รอบล่าสุด ${thaiDateNumeric(overdueInfo.lastVisitDate)} — เกินกำหนดรอบถัดไปแล้ว ${overdueInfo.monthsOverdue} เดือน`}>
              <Chip icon={<WarningAmber sx={{ fontSize: 14 }} />} label="เกินกำหนด" size="small" sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700, bgcolor: alpha("#dc2626", 0.12), color: "#dc2626" }} />
            </Tooltip>
          )}
          <Box sx={{ flex: 1 }} />
          <Button
            size="small" onClick={() => toggleCardExpand(c.key)}
            endIcon={isExpanded ? <ExpandLess sx={{ fontSize: 16 }} /> : <ExpandMore sx={{ fontSize: 16 }} />}
            // ✅ เป็นกลาง ไม่ใช่สีแดง — ปุ่มนี้โผล่ซ้ำทุกใบการ์ด ถ้าย้อมแดงด้วยจะกลายเป็นจุดแดงเรียงลงมา
            // ทั้งหน้าจนไปกลบป้ายเตือนจริงๆ (เกินกำหนด/หมดอายุแล้ว) ที่อยู่ในการ์ดเดียวกัน
            sx={{ textTransform: "none", fontSize: "0.72rem", fontWeight: 700, color: TEXT_SUB, minWidth: 0, px: 1, "&:hover": { color: ACCENT } }}
          >
            {isExpanded ? "ย่อ" : "รายละเอียด"}
          </Button>
        </Stack>

        <Collapse in={isExpanded}>
        <Box sx={{ mt: 1 }}>
        {/* ⚠️ "ประเภทงาน"/"ระบบ" ไม่ได้อยู่ตรงนี้แล้ว — ย้ายขึ้นไปอยู่แถบสรุปหัวการ์ดที่เห็นตลอดโดยไม่ต้อง
            กางการ์ด (ดูคอมเมนต์ที่แถบสรุป) แก้ไขได้เหมือนเดิมทุกประการที่ตำแหน่งใหม่ */}

        {/* เอกสาร: เลขที่สัญญา/ใบเสนอราคา (สัญญาจริง) หรือเลขที่เอกสาร (งานทั่วไป/โปรเจค) */}
        {c.isRealContract ? (
          <>
            <FieldRow label="เลขที่สัญญา" editable={isAdminOrManager} value={c.contractNo} formatDisplay={(v) => (v ? <span style={{ color: ACCENT, fontWeight: 600 }}>{v}</span> : <Dash />)} {...fp("contractNo")} />
            <FieldRow label="ใบเสนอราคา" editable={isAdminOrManager} value={c.quotationNo} {...fp("quotationNo")} />
          </>
        ) : (
          <FieldRow label="เลขที่เอกสาร" editable={canEditBasicField(c, "docNo")} value={c.docNo} {...fp("docNo")} />
        )}

        {/* ✅ ป้ายกำกับแผนก — ตัวเดียวกับคอลัมน์ "แผนก" ของตารางเดสก์ท็อปเป๊ะๆ (ป้าย/สี/สิทธิ์แก้ไข)
            มือถือจึงไม่ได้ข้อมูลน้อยกว่าเดสก์ท็อป ซึ่งเป็นกติกาของการ์ดมือถือทั้งใบในหน้านี้ */}
        <FieldRow
          label="แผนก"
          editable={isAdminOrManager && canEditField(c, "departmentTag")}
          editType="select" editOptions={DEPARTMENT_OPTIONS} allowEmpty={false}
          value={c.departmentTag || DEPARTMENT.SERVICE}
          formatDisplay={(v) => <DepartmentPill value={v} />}
          {...fp("departmentTag")}
        />

        {/* ✅ สถานะสัญญา — ข้อความอัตโนมัติ + พิมพ์ทับได้ เหมือนคอลัมน์เดียวกันบนตารางเดสก์ท็อปเป๊ะๆ
            (ใช้ statusDisplay ตัวเดียวกัน ข้อความจึงตรงกันทั้ง 2 หน้าจอเสมอ) */}
        {(() => {
          const sd = statusDisplay(c);
          const hint = sd.missing.length > 0 ? `ยังไม่ได้กรอก: ${sd.missing.join(" · ")}` : "";
          return (
            <FieldRow
              label="สถานะสัญญา" noClip
              editable={isAdminOrManager && canEditField(c, "statusNote")}
              value={c.statusNote || ""}
              placeholder="พิมพ์หมายเหตุสถานะ"
              title={hint}
              formatDisplay={() => (sd.kind === "none" ? <Dash /> : (
                <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
                  <Chip
                    label={sd.label} size="small"
                    sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700, bgcolor: sd.bg, color: sd.color }}
                  />
                  {/* บนมือถือไม่มี hover ให้ชี้ดู tooltip — เขียนรายชื่อช่องที่ขาดออกมาตรงๆ เลย */}
                  {hint && (
                    <Typography variant="caption" sx={{ color: "#b45309", fontSize: "0.66rem", lineHeight: 1.4 }}>
                      {hint}
                    </Typography>
                  )}
                  {sd.auto && (
                    <Typography variant="caption" sx={{ color: sd.auto.color, fontSize: "0.66rem", fontWeight: 700 }}>
                      ({sd.auto.label})
                    </Typography>
                  )}
                </Stack>
              ))}
              {...fp("statusNote")}
            />
          );
        })()}

        {/* ครั้งที่เข้างาน — แสดง/แก้ไขทีมของแต่ละครั้งแยกกัน (canEditRoundTeam) — พับ/กางแยกอีกชั้นจาก
            การ์ดหลัก (expandedRounds) เพราะสัญญาที่มีหลายครั้ง (สูงสุด 12) ทำให้ยาวเกินไปถ้าโชว์ตลอด
            เริ่มพับไว้ โชว์แค่สรุปย่อ (จำนวนครั้ง + ครั้งล่าสุด) กดดูทั้งหมดทีหลังได้ตามต้องการ */}
        <Box sx={{ py: 0.75 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.72rem" }}>
              {/* ✅ งานทั่วไป/โปรเจค/ยังไม่จัดกลุ่ม ไม่มีแนวคิด "หลายครั้ง" แบบสัญญาจริง (มีแค่คอลัมน์
                  เดียวอยู่แล้ว) — เปลี่ยนหัวข้อเป็น "วันที่เข้างาน" ตามที่ผู้ใช้ขอ แทน "ครั้งที่เข้างาน (N ครั้ง)"
                  ซึ่งไม่มีความหมายตอน N=1 เสมอ */}
              {c.isRealContract ? `ครั้งที่เข้างาน (${rowMaxRound(c)} ครั้ง)` : "วันที่เข้างาน"}
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Button
              size="small" onClick={() => toggleRoundsExpand(c.key)}
              endIcon={isRoundsExpanded ? <ExpandLess sx={{ fontSize: 14 }} /> : <ExpandMore sx={{ fontSize: 14 }} />}
              sx={{ textTransform: "none", fontSize: "0.68rem", fontWeight: 700, color: ACCENT, minWidth: 0, px: 0.75, py: 0.25 }}
            >
              {isRoundsExpanded ? "ย่อ" : "ดูทั้งหมด"}
            </Button>
          </Stack>
          {!isRoundsExpanded && (
            <Typography variant="caption" sx={{ display: "block", fontSize: "0.72rem", color: "text.secondary", mt: 0.25 }}>
              {latestVisit
                ? (c.isRealContract
                  ? `ล่าสุด: ครั้งที่ ${Number(latestVisit.time) || 1} · ${formatEventDateRange(latestVisit)}${latestVisit.team ? ` · 👷 ${latestVisit.team}` : ""}`
                  : `${formatEventDateRange(latestVisit)}${latestVisit.team ? ` · 👷 ${latestVisit.team}` : ""}`)
                : "ยังไม่ลงตารางจริง"}
            </Typography>
          )}
          <Collapse in={isRoundsExpanded}>
          <Stack spacing={0.75} sx={{ mt: 0.5 }}>
            {Array.from({ length: rowMaxRound(c) }, (_, i) => i + 1).map((n) => {
              const roundVisits = roundVisitsOf(c, n);
              const pendingDraft = roundVisits.length === 0 && c.visits.find((v) => v.unscheduled && (Number(v.time) || 1) === n);
              return (
                <Stack key={n} direction="row" alignItems="flex-start" spacing={1} sx={{ p: 0.75, borderRadius: 1.5, bgcolor: alpha("#0f172a", 0.025) }}>
                  <Chip label={n} size="small" sx={{ height: 20, minWidth: 20, fontSize: "0.68rem", fontWeight: 700, bgcolor: alpha(ACCENT, 0.1), color: ACCENT }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    {roundVisits.length > 0 ? (
                      <>
                      {roundVisits.map((visit) => (
                        <Box key={visit._id} sx={{ mb: 0.25 }}>
                          <Link
                            to={`/operation/${visit._id}${resolveOperationGroup(visit) ? `?group=${resolveOperationGroup(visit)}` : ""}`}
                            style={{ color: STATUS_COLOR[visit.status] || ACCENT, fontWeight: 600, textDecoration: "none", fontSize: "0.8rem" }}
                          >
                            {formatEventDateRange(visit)}
                          </Link>
                          {roundTeamEdit?.visitId === visit._id ? (
                            <TextField
                              select autoFocus size="small" variant="standard" value={roundTeamEdit.value}
                              disabled={roundTeamSaving}
                              onChange={(e) => commitRoundTeamEdit(visit, e.target.value)}
                              onBlur={() => commitRoundTeamEdit(visit)}
                              onKeyDown={(e) => { if (e.key === "Escape") cancelRoundTeamEdit(); }}
                              SelectProps={{ native: true }}
                              sx={{ mt: 0.25, width: "100%", "& .MuiInputBase-input": { fontSize: "0.75rem", py: 0.3 } }}
                            >
                              <option value="">— ไม่ระบุ —</option>
                              {teamOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                            </TextField>
                          ) : (
                            <Typography
                              variant="caption" onClick={() => beginRoundTeamEdit(visit, c)}
                              sx={{
                                display: "block", fontSize: "0.72rem", color: visit.team ? "text.secondary" : "text.disabled",
                                cursor: canEditRoundTeam(c) ? "pointer" : "default",
                              }}
                            >
                              👷 {visit.team || (canEditRoundTeam(c) ? "ระบุทีม" : "-")}
                            </Typography>
                          )}
                        </Box>
                      ))}
                      {/* ✅ ป้ายวางบิลอยู่ท้ายครั้ง 1 อัน (ไม่ใช่ใต้ทุกวันที่) — วางบิลทีเดียวต่อครั้ง */}
                      <Stack direction="row" alignItems="center" gap={0.75} sx={{ flexWrap: "wrap", mt: 0.25 }}>
                        <BillingChip
                          roundVisits={roundVisits}
                          canManage={isAdminOrManager}
                          onOpen={handleOpenBilling}
                          compact={false}
                        />
                        <JobDocsChip
                          roundVisits={roundVisits}
                          rowKey={c.key}
                          round={n}
                          title={docsTitleFor(c, n)}
                          onOpen={handleOpenDocs}
                          canUpload={canEditRoundTeam(c)}
                          compact={false}
                        />
                      </Stack>
                      </>
                    ) : pendingDraft ? (
                      (() => {
                        const chip = pendingDraftChip(c, pendingDraft);
                        return (
                          <Tooltip title={chip.tip}>
                            <Box
                              {...chip.props}
                              sx={{
                                fontSize: "0.75rem", color: "#b45309", fontWeight: 600, textDecoration: "none",
                                ...(chip.props.sx || {}),
                              }}
                            >
                              {chip.label}
                            </Box>
                          </Tooltip>
                        );
                      })()
                    ) : isAdminOrManager && c.isRealContract && n === nextOpenRound ? (
                      <IconButton size="small" onClick={() => openAddVisitDialog(c)} sx={{ color: overdueInfo ? "#dc2626" : ACCENT, p: 0.25 }}>
                        <PlaylistAdd fontSize="small" />
                      </IconButton>
                    ) : (
                      <Dash />
                    )}
                  </Box>
                  {/* ✅ ผู้รับผิดชอบจัดการครั้งของตัวเองได้ด้วย — กติกาเดียวกับฝั่งตาราง (canEditRoundTeam)
                      ⚠️ "แยกออกจากสัญญา" ยังเป็นของ admin/manager เท่านั้น */}
                  {canEditRoundTeam(c) && c.isRealContract && roundVisits.length > 0 && (
                    <Stack direction="row" spacing={0.25}>
                      <IconButton size="small" onClick={() => openExtendVisitDialog(c, n)} sx={{ p: 0.25, color: "text.disabled" }}>
                        <Add sx={{ fontSize: 14 }} />
                      </IconButton>
                      {/* ✅ ย้ายครั้งนี้ไปเป็นครั้งที่อื่นได้อิสระ (ยกทั้งวันที่/สถานะ/ทีม/ประวัติงาน) */}
                      <IconButton size="small" onClick={() => openMoveRoundDialog(c, n)} sx={{ p: 0.25, color: "text.disabled" }}>
                        <SwapHoriz sx={{ fontSize: 14 }} />
                      </IconButton>
                      {isAdminOrManager && (
                        <IconButton size="small" onClick={() => handleDetachRound(c, n)} sx={{ p: 0.25, color: "text.disabled" }}>
                          <LinkOff sx={{ fontSize: 14 }} />
                        </IconButton>
                      )}
                    </Stack>
                  )}
                </Stack>
              );
            })}
          </Stack>
          </Collapse>
        </Box>

        {/* ระยะเวลา/จำนวนครั้ง/มูลค่างาน — เฉพาะสัญญาจริงเท่านั้น (งานทั่วไป/โปรเจคไม่มีแนวคิดนี้) */}
        {c.isRealContract && (
          <>
            <FieldRow label="เริ่มสัญญา" editable={isAdminOrManager} editType="date" value={c.contractStart} formatDisplay={(v) => (v ? thaiDateNumeric(v) : <Dash />)} {...fp("contractStart")} />
            <FieldRow label="สิ้นสุดสัญญา" editable={isAdminOrManager} editType="date" value={c.contractEnd} formatDisplay={(v) => (v ? thaiDateNumeric(v) : <Dash />)} {...fp("contractEnd")} />
            <FieldRow
              label="รอบเข้า" editable={isAdminOrManager} editType="intervalMonths" value={c.intervalMonths}
              formatDisplay={(v) => (v ? `ทุก ${v} เดือน${visitsPerYear(v) ? ` (ปีละ ${visitsPerYear(v)} ครั้ง)` : ""}` : <Dash />)}
              {...fp("intervalMonths")}
            />
            {/* ✅ ค่าคอมอยู่ในรายละเอียดที่กางดู ไม่ได้อยู่แถบสรุปหัวการ์ด — แถบนั้นมี 3 ช่องพอดีจอแล้ว
                (ประเภทงาน/ระบบ/มูลค่างาน) เพิ่มช่องที่ 4 จะแคบจนตัวเลขตกบรรทัดบนมือถือ */}
            <FieldRow
              label="ค่าคอมให้ลูกค้า" editable={isAdminOrManager && canEditField(c, "commission")} editType="number"
              value={c.commission}
              formatDisplay={(v) => (hasMoney(v)
                ? <Box component="span">{formatBaht(v)}{commissionPct(c) ? <Box component="span" sx={{ fontSize: "0.72rem", color: TEXT_SUB, ml: 0.5 }}>({commissionPct(c)})</Box> : null}</Box>
                : <Dash />)}
              {...fp("commission")}
            />
            <FieldRow label="จำนวนครั้ง" editable={isAdminOrManager} editType="number" value={c.visitCount} {...fp("visitCount")} />
          </>
        )}

        {/* ⚠️ "มูลค่างาน" ย้ายขึ้นไปอยู่แถบสรุปหัวการ์ดแล้วเช่นกัน (แสดงทุกแท็บเหมือนเดิม ไม่ได้จำกัดแค่
            สัญญาจริง เพราะงานทั่วไป/โปรเจค/ยังไม่จัดกลุ่มก็มีมูลค่าของตัวเองได้ ตรงกับคอลัมน์ฝั่งเดสก์ท็อป) */}

        {/* ✅ ยอดวางบิล/รับเงิน — โผล่เฉพาะเมื่อเคยวางบิลแล้วจริงเท่านั้น ไม่งั้นการ์ดทุกใบจะมีบล็อกนี้
            ที่ขึ้น ฿0 ทั้งหมดตั้งแต่วันแรกที่เริ่มใช้ระบบ ซึ่งดูเหมือนตัวเลขพังมากกว่า "ยังไม่มีข้อมูล" */}
        {(() => {
          const bs = contractBillingSummary(c.visits);
          if (!bs || bs.invoicedCount === 0) return null;
          return (
            <Box sx={{ mt: 1, p: 1.1, borderRadius: 2, bgcolor: alpha(bs.color, 0.06) }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.4 }}>
                <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: bs.color }}>
                  วางบิลแล้ว {bs.invoicedCount}/{bs.totalCount} ครั้ง
                </Typography>
                <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: bs.color }}>
                  {bs.state === "overdue" && bs.overdueDays > 0 ? `เลยกำหนด ${bs.overdueDays} วัน` : bs.label}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" sx={{ fontVariantNumeric: "tabular-nums" }}>
                {[
                  { k: "ยอดวางบิล", v: bs.net },
                  { k: "รับแล้ว", v: bs.paid },
                  { k: "ค้างรับ", v: bs.outstanding },
                ].map((it) => (
                  <Box key={it.k} sx={{ textAlign: "center", flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.62rem", color: TEXT_SUB }}>{it.k}</Typography>
                    <Typography sx={{ fontSize: "0.78rem", fontWeight: 800 }} noWrap>{bahtFmt(it.v)}</Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          );
        })()}

        {/* ผู้รับผิดชอบ — ฟิลด์อิสระจากทีมที่เข้างานทุกครั้งด้านบนโดยสมบูรณ์ */}
        <FieldRow label="ผู้รับผิดชอบ" editable={isAdminOrManager && canEditField(c, "responsiblePerson")} editType="select" editOptions={teamOptions} value={c.responsiblePerson} formatDisplay={unassignedResponsibleDisplay} {...fp("responsiblePerson")} />
        {/* ✅ หมายเหตุ — noClip เพราะข้อความคือเนื้อหาทั้งหมดของช่องนี้ ถ้าโดนตัดเหลือ "..." บนมือถือ
            (ซึ่งไม่มี hover ให้ชี้ดู tooltip) ก็เท่ากับไม่ได้บอกอะไรเลย */}
        <FieldRow
          label="หมายเหตุ" noClip
          editable={isAdminOrManager && canEditField(c, "remark")}
          value={c.remark}
          placeholder="พิมพ์หมายเหตุ"
          formatDisplay={(v) => (v
            ? <Typography variant="body2" sx={{ fontSize: "0.8rem", color: "text.secondary", whiteSpace: "pre-wrap" }}>{v}</Typography>
            : <Dash />)}
          {...fp("remark")}
        />

        {/* ปุ่มจัดการ — เฉพาะแอดมิน/manager เทียบ pattern เดียวกับคอลัมน์ actions ในตารางเดสก์ท็อป */}
        {isAdminOrManager && (
          <Stack direction="row" justifyContent="flex-end" spacing={0.5} sx={{ mt: 1, pt: 1, borderTop: "1px solid", borderColor: alpha("#0f172a", 0.08) }}>
            {!c.isRealContract && (
              <Tooltip title="จัดหมวดหมู่งาน (ทั่วไป/โปรเจค)">
                <IconButton
                  size="small" onClick={(e) => openClassifyMenu(e, c)}
                  sx={{ color: c.isConfirmedGeneral ? "#10b981" : c.isConfirmedProject ? "#3b82f6" : "text.disabled" }}
                >
                  {c.isConfirmedGeneral ? <Build fontSize="small" /> : c.isConfirmedProject ? <Engineering fontSize="small" /> : <HourglassEmpty fontSize="small" />}
                </IconButton>
              </Tooltip>
            )}
            {!c.isRealContract && (
              <Tooltip title="ย้ายเข้างานสัญญา / งานรายปี">
                <IconButton size="small" onClick={() => openAttachDialog(c)} sx={{ color: "text.disabled" }}>
                  <AddLink fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {c.isRealContract && (
              <Tooltip title="ประวัติการแก้ไขข้อมูลสัญญา">
                <span>
                  <IconButton
                    size="small" onClick={() => setHistoryContract(c)}
                    disabled={contractEditHistory(c).length === 0}
                    sx={{ color: "text.disabled" }}
                  >
                    <History fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            <Tooltip title={c.isRealContract ? "ลบสัญญานี้ทั้งหมด" : "ลบงานนี้"}>
              <IconButton size="small" onClick={() => handleDeleteContract(c)} sx={{ color: "text.disabled" }}>
                <DeleteOutline fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
        </Box>
        </Collapse>
      </Paper>
    );
  };

  // ✅ ตัวกรอง dropdown ทั้ง 4 ช่อง — แยกเป็นฟังก์ชันเดียวใช้ร่วมกันทั้งจอมือถือ (อยู่ในแผงพับ) และ
  // จอใหญ่ (เรียงแถวเดียวกับช่องค้นหา) ไม่ก็อปปี้ JSX 2 ชุด กันแก้ที่เดียวแล้วอีกที่ตกหล่น
  const renderFilterFields = () => (
    <>
      {/* ✅ กรองตามประเภทงาน (PM/Service/ติดตั้ง ฯลฯ) — เลือกจากรายชื่อประเภทงานจริงที่ตั้งค่าไว้ในระบบ */}
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
      {/* ✅ กรองตามระบบ (Fire Alarm/CCTV/Access Control ฯลฯ) — เดิมหาระบบได้แค่ผ่านช่องค้นหาข้อความ
          อิสระ ซึ่งพิมพ์ไม่ตรงก็ไม่เจอ และปนกับผลจากฟิลด์อื่นที่บังเอิญมีคำเดียวกัน */}
      <TextField
        select size="small" label="ระบบ" value={systemFilter}
        onChange={(e) => setSystemFilter(e.target.value)}
        SelectProps={{ native: true }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <DeviceHub sx={{ fontSize: 18, color: systemFilter !== "all" ? ACCENT : "text.disabled" }} />
            </InputAdornment>
          ),
        }}
        sx={{
          width: { xs: "100%", sm: 170 }, flexShrink: 0,
          "& .MuiOutlinedInput-root": {
            borderRadius: 2.5,
            bgcolor: systemFilter !== "all" ? alpha(ACCENT, 0.06) : "background.paper",
            "& fieldset": systemFilter !== "all" ? { borderColor: alpha(ACCENT, 0.45) } : {},
            "&:hover fieldset": systemFilter !== "all" ? { borderColor: ACCENT } : {},
          },
          "& .MuiInputLabel-root": systemFilter !== "all" ? { color: ACCENT, fontWeight: 700 } : {},
        }}
      >
        <option value="all">ทุกระบบ</option>
        {systemFilterOptions.map((name) => <option key={name} value={name}>{name}</option>)}
      </TextField>
      {/* ✅ กรองตามป้ายกำกับแผนก — ตามที่ผู้ใช้ขอให้ "ค้นหาแยกได้ชัดเจน" ระหว่างงานฝ่ายบริการกับฝ่ายขาย
          ✅ เปิดให้ทุก role ที่เข้าหน้านี้ได้ใช้ (ไม่ใช่แค่แอดมิน) — ป้ายนี้เป็นข้อมูลประกอบของแถวที่เห็นอยู่
          ตรงหน้าอยู่แล้ว การกรองจึงไม่ได้เปิดเผยอะไรใหม่ ต่างจาก "สิทธิ์แก้ป้าย" ที่ยังจำกัดแอดมิน/manager
          ✅ ติดจำนวนจริงต่อแผนกไว้ในตัวเลือกเลย — รู้ตั้งแต่ยังไม่กดว่าแต่ละแผนกมีกี่สัญญา ไม่ต้องลองกด
          ทีละอันเพื่อดูว่ามีข้อมูลไหม (เทียบ pattern เดียวกับ "ยังไม่มอบหมาย" ของตัวกรองผู้รับผิดชอบ) */}
      <TextField
        select size="small" label="แผนก" value={departmentFilter}
        onChange={(e) => setDepartmentFilter(e.target.value)}
        SelectProps={{ native: true }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Apartment sx={{ fontSize: 18, color: departmentFilter !== "all" ? departmentMeta(departmentFilter).color : "text.disabled" }} />
            </InputAdornment>
          ),
        }}
        sx={{
          width: { xs: "100%", sm: 165 }, flexShrink: 0,
          "& .MuiOutlinedInput-root": {
            borderRadius: 2.5,
            bgcolor: departmentFilter !== "all" ? departmentMeta(departmentFilter).bg : "background.paper",
            "& fieldset": departmentFilter !== "all" ? { borderColor: alpha(departmentMeta(departmentFilter).color, 0.45) } : {},
            "&:hover fieldset": departmentFilter !== "all" ? { borderColor: departmentMeta(departmentFilter).color } : {},
          },
          "& .MuiInputLabel-root": departmentFilter !== "all" ? { color: departmentMeta(departmentFilter).color, fontWeight: 700 } : {},
        }}
      >
        <option value="all">ทุกแผนก</option>
        {DEPARTMENT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label} ({departmentCounts[o.value] || 0})
          </option>
        ))}
      </TextField>
      {/* ✅ กรองตามสถานะสัญญา — ตามที่ผู้ใช้ขอให้ "ค้นหาสถานะสัญญาได้ด้วย"
          ⚠️ กรองด้วย kind (คีย์คงที่) ไม่ใช่ข้อความบนจอ — ดูเหตุผลที่ STATUS_FILTER_OPTIONS
          ✅ "ข้อมูลไม่ครบ" เป็นตัวเลือกหนึ่งในนี้ด้วย จึงไล่เก็บสัญญาที่ยังกรอกไม่ครบทั้งหมดได้ในคลิกเดียว
          ซึ่งเป็นงานที่เดิมทำไม่ได้เลยนอกจากกวาดตาดูทีละแถว */}
      <TextField
        select size="small" label="สถานะสัญญา" value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        SelectProps={{ native: true }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Autorenew sx={{ fontSize: 18, color: statusFilter !== "all" ? ACCENT : "text.disabled" }} />
            </InputAdornment>
          ),
        }}
        sx={{
          width: { xs: "100%", sm: 190 }, flexShrink: 0,
          "& .MuiOutlinedInput-root": {
            borderRadius: 2.5,
            bgcolor: statusFilter !== "all" ? alpha(ACCENT, 0.06) : "background.paper",
            "& fieldset": statusFilter !== "all" ? { borderColor: alpha(ACCENT, 0.45) } : {},
            "&:hover fieldset": statusFilter !== "all" ? { borderColor: ACCENT } : {},
          },
          "& .MuiInputLabel-root": statusFilter !== "all" ? { color: ACCENT, fontWeight: 700 } : {},
        }}
      >
        <option value="all">ทุกสถานะ</option>
        {STATUS_FILTER_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label} ({statusCounts[o.value] || 0})
          </option>
        ))}
      </TextField>
      {/* ✅ ซ่อนสำหรับช่าง — ข้อมูลที่ช่างเห็นถูกกรองเหลือแค่งานของตัวเองมาจาก backend อยู่แล้วเสมอ
          ตัวกรองนี้มีประโยชน์แค่ตอนแอดมิน/manager ที่เห็นงานของทุกคนต้องกรองหาเฉพาะบางคน */}
      {isAdminOrManager && (
        <TextField
          select size="small" label="ผู้รับผิดชอบงาน" value={responsibleFilter}
          onChange={(e) => setResponsibleFilter(e.target.value)}
          SelectProps={{ native: true }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <PersonOutline sx={{ fontSize: 18, color: responsibleFilter !== "all" ? ACCENT : "text.disabled" }} />
              </InputAdornment>
            ),
          }}
          sx={{
            width: { xs: "100%", sm: 185 }, flexShrink: 0,
            "& .MuiOutlinedInput-root": {
              borderRadius: 2.5,
              bgcolor: responsibleFilter !== "all" ? alpha(ACCENT, 0.06) : "background.paper",
              "& fieldset": responsibleFilter !== "all" ? { borderColor: alpha(ACCENT, 0.45) } : {},
              "&:hover fieldset": responsibleFilter !== "all" ? { borderColor: ACCENT } : {},
            },
            "& .MuiInputLabel-root": responsibleFilter !== "all" ? { color: ACCENT, fontWeight: 700 } : {},
          }}
        >
          <option value="all">ทุกคน</option>
          {/* ✅ ไล่เก็บสัญญาที่ยังไม่เคยมอบหมายผู้รับผิดชอบ — โผล่เฉพาะตอนมีจริง (กันตัวเลือกรก) */}
          {unassignedResponsibleCount > 0 && (
            <option value="unassigned">— ยังไม่มอบหมาย ({unassignedResponsibleCount}) —</option>
          )}
          {teamOptions.map((name) => <option key={name} value={name}>{name}</option>)}
        </TextField>
      )}
      {/* ✅ กรองตามอายุสัญญา (1 ปี / 2 ปี / 3 ปี ...) — ตามที่ผู้ใช้ขอให้ "แยกค้นหางานต่อปี" เพราะสัญญา
          หลายปีมีเงื่อนไขการดูแล/วางบิลต่างจากสัญญาปีต่อปีชัดเจน แต่เดิมปนกันอยู่ในตารางเดียวโดยไม่มี
          ทางแยกดูเลย ⚠️ ตัวเลือกสร้างจากอายุที่มีอยู่จริงในแท็บนี้เท่านั้น (ดู durationOptions)
          — กดตัวเลือกไหนก็ต้องมีข้อมูลเสมอ ไม่มีตัวเลือกที่กดแล้วว่างเปล่า */}
      {(durationOptions.years.length > 0 || durationOptions.none > 0) && (
        <TextField
          select size="small" label="อายุสัญญา" value={durationFilter}
          onChange={(e) => setDurationFilter(e.target.value)}
          SelectProps={{ native: true }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Timelapse sx={{ fontSize: 18, color: durationFilter !== "all" ? ACCENT : "text.disabled" }} />
              </InputAdornment>
            ),
          }}
          sx={{
            width: { xs: "100%", sm: 172 }, flexShrink: 0,
            "& .MuiOutlinedInput-root": {
              borderRadius: 2.5,
              bgcolor: durationFilter !== "all" ? alpha(ACCENT, 0.06) : "background.paper",
              "& fieldset": durationFilter !== "all" ? { borderColor: alpha(ACCENT, 0.45) } : {},
              "&:hover fieldset": durationFilter !== "all" ? { borderColor: ACCENT } : {},
            },
            "& .MuiInputLabel-root": durationFilter !== "all" ? { color: ACCENT, fontWeight: 700 } : {},
          }}
        >
          <option value="all">ทุกอายุสัญญา</option>
          {durationOptions.years.map((o) => (
            <option key={o.value} value={o.value}>{o.label} ({o.count})</option>
          ))}
          {durationOptions.none > 0 && <option value="none">ยังไม่ระบุ ({durationOptions.none})</option>}
        </TextField>
      )}
      {/* ✅ ตัวกรองช่วงเวลา — ช่องเดียวคุมทั้ง "เลือกปี" และ "เลือกช่วงวันที่เอง"
          🐛 BUG ที่แก้: เดิมแยกเป็น 2 ช่อง ("ปี" กับ "ช่วงเวลาสัญญา") ซึ่งซ้ำซ้อนกันเอง — ทั้งคู่ตอบคำถาม
          เดียวกันว่า "จะดูช่วงไหน" และตั้งขัดกันได้ด้วย (เลือกปี 2569 แต่เลือกช่วงเป็นปีหน้า แล้วได้ตาราง
          ว่างเปล่าโดยไม่มีอะไรอธิบายว่าเพราะอะไร) ยุบเหลือช่องเดียวตามที่ผู้ใช้สั่ง
          ✅ สัญญาหลายปีโผล่ครบทุกปีที่ยังมีผล ไม่ใช่แค่ปีที่เซ็น (ดู contractYears)
          ⚠️ ค่าเริ่มต้นล็อกปีปัจจุบันไว้ตั้งแต่แรก + เน้นสีตอนกรองอยู่ ให้เห็นชัดว่ากำลังดูแค่ช่วงเดียว
          ไม่ใช่ทั้งหมด ซึ่งเป็นจุดที่ผู้ใช้เข้าใจผิดบ่อยที่สุดในหน้านี้ */}
      <TextField
        select size="small" label="ช่วงเวลา" value={yearFilter}
        onChange={(e) => {
          const v = e.target.value;
          setYearFilter(v);
          // ⚠️ ออกจากโหมดกรอกช่วงเองเมื่อไหร่ ต้องล้างวันที่ที่ค้างไว้ทิ้งด้วย ไม่งั้นกดกลับมาอีกครั้ง
          // จะเจอวันเก่าค้างอยู่แล้วตารางกรองทันทีโดยที่ผู้ใช้ไม่ได้สั่ง
          if (v !== YEAR_FILTER_CUSTOM) { setDateFrom(""); setDateTo(""); }
        }}
        SelectProps={{ native: true }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <CalendarMonth sx={{ fontSize: 18, color: yearFilter !== "all" ? ACCENT : "text.disabled" }} />
            </InputAdornment>
          ),
        }}
        sx={{
          width: { xs: "100%", sm: 178 }, flexShrink: 0,
          "& .MuiOutlinedInput-root": {
            borderRadius: 2.5,
            bgcolor: yearFilter !== "all" ? alpha(ACCENT, 0.06) : "background.paper",
            "& fieldset": yearFilter !== "all" ? { borderColor: alpha(ACCENT, 0.45) } : {},
            "&:hover fieldset": yearFilter !== "all" ? { borderColor: ACCENT } : {},
          },
          "& .MuiInputLabel-root": yearFilter !== "all" ? { color: ACCENT, fontWeight: 700 } : {},
        }}
      >
        <option value={YEAR_FILTER_ALL}>ทุกช่วงเวลา</option>
        {/* ⚠️ ติดป้าย "(ปีปัจจุบัน)" ไว้ที่ปีนี้ — เดิมตัวกรองตั้งค่าเริ่มต้นเป็นปีปัจจุบันให้เองโดยผู้ใช้ไม่ได้
            เลือก ถ้าไม่บอกว่าปีไหนคือปีปัจจุบัน คนจะไม่รู้ว่าตัวเลขที่ค้างอยู่นั้นคือค่าเริ่มต้นหรือตัวเองเผลอกด */}
        {/* ⚠️ แสดงเป็น พ.ศ. แต่ "ค่าที่เก็บยังเป็น ค.ศ." โดยตั้งใจ — ทั้งหน้าเทียบปีจาก contractYears()
            ซึ่งอ่านจาก moment().year() (ค.ศ.) และลิงก์ข้ามหน้าที่ส่ง ?year= มาก็เป็น ค.ศ. ถ้าเปลี่ยนค่า
            เป็น พ.ศ. ด้วยจะไม่ตรงกับอะไรเลยแล้วตารางว่างทุกครั้งที่เลือกปี — แปลงเฉพาะตอนแสดงผลเท่านั้น
            (วันที่ทุกจุดในหน้านี้แสดงเป็น พ.ศ. อยู่แล้ว ตัวเลือกปีจึงต้องเป็น พ.ศ. ให้ตรงกัน) */}
        {availableYears.map((y) => (
          <option key={y} value={y}>{y === currentYear ? `${y + 543} (ปีปัจจุบัน)` : y + 543}</option>
        ))}
        {/* ✅ สัญญาที่ยังไม่ได้กรอกวันที่เริ่มสัญญาและยังไม่ลงวันที่เข้างานเลย — ปกติเห็นอยู่ในทุกปีอยู่แล้ว
            ตัวเลือกนี้ไว้กรองดูเฉพาะกลุ่มนี้เวลาต้องการไล่เก็บตกว่าเหลือสัญญาไหนค้างยังไม่ได้ลงวันที่ */}
        {unknownYearCount > 0 && <option value={YEAR_FILTER_NONE}>ยังไม่ระบุปี ({unknownYearCount})</option>}
        <option value={YEAR_FILTER_CUSTOM}>เลือกช่วงวันที่เอง…</option>
      </TextField>

      {yearFilter === YEAR_FILTER_CUSTOM && (
        <Stack
          direction="row" alignItems="center" spacing={0.75}
          sx={{
            width: { xs: "100%", sm: "auto" }, flexShrink: 0,
            px: 1, py: 0.25, borderRadius: 2.5,
            border: "1px solid",
            borderColor: (dateFrom || dateTo) ? alpha(ACCENT, 0.45) : "divider",
            bgcolor: (dateFrom || dateTo) ? alpha(ACCENT, 0.06) : "background.paper",
          }}
        >
          <ThaiDatePicker
            value={dateFrom}
            onChange={setDateFrom}
            label="เริ่มสัญญาตั้งแต่"
            textFieldProps={{
              variant: "standard",
              InputProps: { disableUnderline: true },
              // ⚠️ ต้องบังคับ shrink — ช่องวันที่ที่ยังว่างจะโชว์ placeholder "วว/ดด/ปปปป" ของตัวเอง
              // ซึ่ง MUI ไม่นับว่า "มีค่า" ป้ายกำกับจึงไม่ยกขึ้นแล้วไปทับตัวหนังสือในช่องจนอ่านไม่ออกทั้งคู่
              InputLabelProps: { shrink: true },
              sx: { width: { xs: "50%", sm: 132 }, "& input": { fontSize: "0.8rem", py: 0.5 } },
            }}
          />
          <Box component="span" sx={{ color: "text.disabled", fontSize: "0.8rem", flexShrink: 0, pt: 1.2 }}>–</Box>
          <ThaiDatePicker
            value={dateTo}
            onChange={setDateTo}
            label="สิ้นสุดภายใน"
            minDate={dateFrom || undefined}
            textFieldProps={{
              variant: "standard",
              InputProps: { disableUnderline: true },
              // ⚠️ ต้องบังคับ shrink — ช่องวันที่ที่ยังว่างจะโชว์ placeholder "วว/ดด/ปปปป" ของตัวเอง
              // ซึ่ง MUI ไม่นับว่า "มีค่า" ป้ายกำกับจึงไม่ยกขึ้นแล้วไปทับตัวหนังสือในช่องจนอ่านไม่ออกทั้งคู่
              InputLabelProps: { shrink: true },
              sx: { width: { xs: "50%", sm: 132 }, "& input": { fontSize: "0.8rem", py: 0.5 } },
            }}
          />
          {(dateFrom || dateTo) && (
            <IconButton
              size="small" title="ล้างช่วงวันที่"
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              sx={{ p: 0.25, flexShrink: 0, mt: 1 }}
            >
              <Close sx={{ fontSize: 15 }} />
            </IconButton>
          )}
        </Stack>
      )}
    </>
  );

  // ✅ กันคนนอก (role อื่น) เปิดหน้านี้ตรงๆ ผ่าน URL — เทียบ pattern เดียวกับ QuotationTracking.js
  if (!loading && !canView) return <Navigate to="/dashboard" replace />;

  return (
    // ✅ จอมือถือแทบไม่ต้องเว้นบนเลย — มีแถวปุ่มย้อนกลับของ layout คั่นให้อยู่แล้ว (ดู FullLayout.css
    // app-page-container) และขอบซ้าย-ขวาก็ให้ Container ชั้นนอกจัดการพอ ไม่ต้องซ้อนอีกชั้น
    <Box sx={{ px: { xs: 0, sm: 2 }, pt: { xs: 0.5, sm: 2 }, pb: 4 }}>
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
            {/* ✅ แท็บ "เลยกำหนด/คงค้าง" กรองเฉพาะ isRealContract เหมือนแท็บ "งานสัญญา" ทุกประการ (ดู
                filtered) แถวทั้งหมดจึงเป็นสัญญา ไม่ใช่ "งาน" — เดิมเช็คแค่ viewFilter==="contracts"
                ทำให้แท็บนี้ขึ้นหน่วยผิดเป็น "งาน" */}
            <Typography variant="caption" color="text.secondary">
              {loading
                ? "กำลังโหลด..."
                : `${filtered.length} ${viewFilter === "contracts" || viewFilter === "overdue" ? "สัญญา" : "งาน"}`}
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
          {/* ✅ ปุ่ม "รีเฟรช" ถูกตัดออกตามที่ผู้ใช้ขอ — หน้านี้ดึงข้อมูลใหม่เองอัตโนมัติอยู่แล้ว (ดู
              useEffect ที่ตั้ง interval ไว้) และทุกการแก้ไขในตารางก็ดึงข้อมูลใหม่ให้ทันทีหลังบันทึกสำเร็จ
              จึงแทบไม่มีกรณีที่ต้องกดรีเฟรชเอง */}
          {/* ✅ เปลี่ยนจาก CSV เป็นไฟล์ Excel (.xlsx) จริง — CSV เป็นข้อความล้วนตามนิยาม ใส่สี/ตัวหนา/
              เส้นขอบ/ความกว้างคอลัมน์ไม่ได้เลยแม้แต่อย่างเดียว (ดู contractExcelExport.js) */}
          {/* ✅ เปลี่ยนจากปุ่มไอคอนกลมสีแดง (ไอคอนลูกศรดาวน์โหลดทั่วไป) เป็นปุ่มมีข้อความ "Excel" สีเขียว
              ตามสีแบรนด์ Excel (#217346) — เดิมเป็นวงกลมสีเดียวกับปุ่มรีเฟรชข้างๆ ดูไม่ออกว่าปุ่มไหนคือ
              ส่งออก ต้องเอาเมาส์ไปชี้อ่าน tooltip ทุกครั้ง (บนมือถือไม่มี hover ยิ่งเดาไม่ได้เลย) */}
          <Tooltip title={filtered.length === 0 ? "ไม่มีข้อมูลให้ส่งออก" : `ส่งออก ${filtered.length} รายการที่กรองอยู่เป็นไฟล์ Excel (.xlsx)`}>
            <span>
              <Button
                onClick={handleExportExcel}
                disabled={exporting || filtered.length === 0}
                variant="outlined"
                startIcon={<TableChart sx={{ fontSize: 18, color: EXCEL_GREEN }} />}
                // ✅ เดิมทั้งปุ่มเป็นสีเขียว (ตัวหนังสือ+ขอบ) วางคู่กับปุ่มแดง "เพิ่มสัญญาใหม่" — กลายเป็น
                // 2 ปุ่มสีจัดขนาดเท่ากันแข่งกันดึงสายตา ทั้งที่ "ส่งออก" เป็นงานรอง ไม่ใช่สิ่งที่คนเปิด
                // หน้านี้มาทำเป็นอันดับแรก → เหลือสีเขียวไว้แค่ที่ไอคอน (พอให้รู้ว่าเป็น Excel) ส่วนตัว
                // ปุ่มเป็นกลาง ปล่อยให้ปุ่มแดงเป็นปุ่มหลักที่เด่นที่สุดบนหน้าเพียงตัวเดียว
                sx={{
                  flexShrink: 0, textTransform: "none", fontWeight: 700, borderRadius: 2.5,
                  color: "text.primary", borderColor: BORDER_MAIN, bgcolor: "background.paper",
                  "&:hover": { bgcolor: SURFACE_SUBTLE, borderColor: alpha("#0f172a", 0.28) },
                }}
              >
                {exporting ? "กำลังสร้าง..." : "Export Excel"}
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      {/* ✅ บอกให้ชัดว่าโหมดนี้ดูอย่างเดียวตั้งใจ ไม่ใช่ปุ่มหาย/หน้าพัง — เทียบข้อความเดียวกับกล่อง
          "ข้อมูลสัญญา" แบบดูอย่างเดียวใน EditEvent.js ให้โทน/คำพูดตรงกันทั้งแอป */}
      {!isAdminOrManager && (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
          มุมมองสำหรับดูงานของคุณ — แก้ไขข้อมูลได้ที่หน้า "แผนงาน" หรือ "การดำเนินงาน"
        </Alert>
      )}

      {/* ── สลับมุมมอง ────────────────────────────────────────────────────────
          🐛 BUG ที่แก้ (ผู้ใช้ไม่รู้ว่ามีแท็บอื่นอยู่): เดิมแท็บทั้ง 6 เรียงเป็นแถวเดียวยาวเกินจอมือถือ
          แล้วให้ปัดซ้าย-ขวาเอา — บนจอ 375px จึงเห็นแค่แท็บแรกกับครึ่งแท็บที่สอง ที่เหลือ (งานทั่วไป/
          งานโปรเจค/ยังไม่จัดกลุ่ม/ทั้งหมด) หลุดออกนอกจอโดยไม่มีอะไรบอกเลยว่ามีอยู่ ผู้ใช้ที่ไม่บังเอิญ
          ปัดโดนจะไม่มีวันรู้ว่าฟีเจอร์พวกนี้มีอยู่จริง
          ✅ จอมือถือ: เปลี่ยนเป็นปุ่มเดียวเต็มความกว้าง บอกว่าตอนนี้ดูมุมมองไหนอยู่ กดแล้วกางเมนูเห็น
          ทุกมุมมองพร้อมจำนวนรายการครบในครั้งเดียว ไม่มีอะไรถูกซ่อน
          ✅ จอใหญ่: ยังเป็นแท็บเรียงแถวเหมือนเดิม (มีที่พอให้เห็นครบอยู่แล้ว จะได้สลับได้ในคลิกเดียว)
          ⚠️ ทั้ง 2 แบบอ่านจาก VIEW_OPTIONS ชุดเดียวกัน — เพิ่ม/แก้มุมมองที่เดียวแล้วตรงกันทั้งคู่เสมอ */}
      {!loading && (() => {
        const viewGroups = [
          // กลุ่มที่ 1: "เลยกำหนด/คงค้าง" เป็นกลุ่มย่อยของ "งานสัญญา/งานรายปี" เสมอ (ตัวกรองข้างในคือ
          // isRealContract ทั้งคู่ แค่ "เลยกำหนด" กรองซ้ำเฉพาะที่เกินกำหนดรอบถัดไปด้วย) — ครอบรางเดียว
          // กันให้เห็นว่าเป็นคู่เดียวกัน ไม่ใช่หมวดคู่ขนานแบบทั่วไป/โปรเจค
          [
            // ✅ ไอคอน/สีตรงกับเมนู "จัดหมวดหมู่งาน" ของแต่ละแถวเป๊ะๆ (เขียว=ทั่วไป, น้ำเงิน=โปรเจค)
            { value: "contracts", label: "งานสัญญา / งานรายปี", count: realContractCount, icon: <Description sx={{ fontSize: 15 }} /> },
            // ✅ แสดงตลอดแม้ count=0 เหมือนแท็บอื่น — เดิมซ่อนตอนไม่มี ทำให้เข้าใจว่าฟีเจอร์นี้หายไป
            { value: "overdue", label: "เลยกำหนด / คงค้าง", count: overdueCount, icon: <WarningAmber sx={{ fontSize: 15, color: ACCENT }} /> },
            // ✅ สีแดงชุดเดียวกับชิป "หมดอายุแล้ว" ในคอลัมน์สถานะสัญญา — กดจากแท็บแล้วเจอชิปสีเดียวกัน
            // ทั้งตาราง เชื่อมโยงกันได้ทันทีว่ากำลังดูกลุ่มไหนอยู่
            { value: "expired", label: "สัญญาหมดอายุ", count: expiredCount, icon: <EventBusy sx={{ fontSize: 15, color: "#dc2626" }} /> },
          ],
          // กลุ่มที่ 2: หมวดหมู่คู่ขนานจริง (งานหนึ่งเป็นได้แค่หมวดเดียวในกลุ่มนี้)
          [
            { value: "general", label: "งานทั่วไป", count: confirmedGeneralCount, icon: <Build sx={{ fontSize: 15, color: "#10b981" }} /> },
            { value: "project", label: "งานโปรเจค", count: confirmedProjectCount, icon: <Engineering sx={{ fontSize: 15, color: "#3b82f6" }} /> },
            // ✅ ซ่อนสำหรับช่าง — แท็บนี้มีไว้ช่วยแอดมินหางานเก่าไปจัดหมวดหมู่/รวมเป็นสัญญา (ฟีเจอร์ที่
            // ช่างกดไม่ได้อยู่แล้ว) ไม่มีประโยชน์กับช่างเลย มีแต่จะรกตัวเลือก
            ...(isAdminOrManager ? [{ value: "ungrouped", label: "งานเก่าที่ยังไม่จัดกลุ่ม", count: hiddenJobCount, icon: <HourglassEmpty sx={{ fontSize: 15 }} /> }] : []),
            { value: "all", label: "ทั้งหมด", count: allFilteredCount, icon: <Apps sx={{ fontSize: 15 }} /> },
          ],
        ];
        const allViews = viewGroups.flat();
        const currentView = allViews.find((v) => v.value === viewFilter) || allViews[0];

        if (isMobile) {
          return (
            <Box sx={{ mb: 2 }}>
              <Button
                fullWidth onClick={(e) => setViewMenuAnchor(e.currentTarget)}
                startIcon={currentView.icon}
                endIcon={<ExpandMore />}
                sx={{
                  justifyContent: "space-between", textTransform: "none", borderRadius: 2.5,
                  border: "1px solid", borderColor: BORDER_MAIN, bgcolor: "background.paper",
                  color: "text.primary", fontWeight: 700, py: 1.1, px: 1.5,
                  "&:hover": { bgcolor: SURFACE_SUBTLE, borderColor: BORDER_MAIN },
                }}
              >
                <Box component="span" sx={{ flex: 1, textAlign: "left", ml: 0.5 }}>
                  {currentView.label}
                  <Box component="span" sx={{ ml: 0.75, color: TEXT_SUB, fontWeight: 600 }}>
                    ({currentView.count})
                  </Box>
                </Box>
              </Button>
              <Menu
                open={Boolean(viewMenuAnchor)} anchorEl={viewMenuAnchor}
                onClose={() => setViewMenuAnchor(null)}
                // ✅ กว้างเท่าปุ่มพอดี ให้รู้สึกว่าเป็น "ช่องเดียวกันที่กางออกมา" ไม่ใช่เมนูลอยแยก
                slotProps={{ paper: { sx: { width: viewMenuAnchor?.offsetWidth, borderRadius: 2.5, mt: 0.5 } } }}
              >
                {allViews.map((v, idx) => (
                  <MenuItem
                    key={v.value}
                    selected={v.value === viewFilter}
                    onClick={() => { selectView(v.value); setViewMenuAnchor(null); }}
                    // ✅ เว้นเส้นคั่นระหว่าง 2 กลุ่ม — สื่อว่า "เลยกำหนด" เป็นกลุ่มย่อยของงานสัญญา
                    // ส่วนที่เหลือเป็นหมวดคู่ขนาน เหมือนที่จอใหญ่ครอบรางแยกกัน
                    sx={{
                      py: 1.1,
                      ...(idx === viewGroups[0].length ? { borderTop: `1px solid ${BORDER_SOFT}`, mt: 0.5, pt: 1.35 } : {}),
                      "&.Mui-selected": { bgcolor: alpha(ACCENT, 0.08), "&:hover": { bgcolor: alpha(ACCENT, 0.12) } },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 30 }}>{v.icon}</ListItemIcon>
                    <ListItemText
                      primary={v.label}
                      primaryTypographyProps={{ fontSize: "0.86rem", fontWeight: v.value === viewFilter ? 700 : 500 }}
                    />
                    <Typography variant="caption" sx={{ color: TEXT_SUB, fontWeight: 700, ml: 1 }}>
                      {v.count}
                    </Typography>
                  </MenuItem>
                ))}
              </Menu>
            </Box>
          );
        }

        return (
          <Box sx={{
            mb: 2, overflowX: "auto", pb: 0.5, WebkitOverflowScrolling: "touch",
            "&::-webkit-scrollbar": { height: 4 },
          }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "max-content" }}>
              {viewGroups.map((group, gi) => (
                <ToggleButtonGroup
                  key={gi} size="small" exclusive value={viewFilter}
                  onChange={(_, v) => selectView(v)}
                  sx={VIEW_TAB_GROUP_SX}
                >
                  {group.map((v) => (
                    <ToggleButton key={v.value} value={v.value} sx={VIEW_TAB_SX}>
                      <Box component="span" sx={{ display: "inline-flex", mr: 0.5 }}>{v.icon}</Box>
                      {v.label} ({v.count})
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              ))}
            </Box>
          </Box>
        );
      })()}

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

      {/* 🐛 BUG ที่แก้ (ตัวเลขไม่ตรงกับที่จะถูกจัดกลุ่มจริง): เดิมเช็ค/นับจาก selectedIds ดิบๆ แต่ตอนกด
          "จัดกลุ่มเป็นสัญญา" ใช้ selectedContracts (กรองเฉพาะแถวที่ยังมีอยู่จริงใน contracts) — พอมีคนอื่น
          ลบ/ย้าย/จัดหมวดหมู่งานที่เลือกไว้ออกไประหว่างนั้น (auto-refresh ทุก 15 วินาที) id ที่หายไปจะยัง
          ค้างอยู่ใน selectedIds ทำให้แถบบอก "เลือกไว้ 3 งาน" แต่จริงๆ จะถูกจัดกลุ่มแค่ 2 — และถ้าหายหมด
          ทุกแถวก็ยังขึ้นแถบค้างอยู่ทั้งที่ไม่เหลืออะไรให้ทำ นับจาก selectedContracts ให้ตรงกับของจริงเสมอ */}
      {selectedContracts.length > 0 && (
        <Paper variant="outlined" sx={{ p: 1.25, mb: 2, borderRadius: 3, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", bgcolor: alpha(ACCENT, 0.06), borderColor: alpha(ACCENT, 0.4) }}>
          <Typography variant="body2" fontWeight={700} sx={{ flex: 1 }}>เลือกไว้ {selectedContracts.length} งาน</Typography>
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

      {/* ── แถบค้นหา + ตัวกรอง ────────────────────────────────────────────────
          ✅ จอมือถือ: โชว์แค่ช่องค้นหา + ปุ่ม "ตัวกรอง" (มีตัวเลขบอกจำนวนตัวกรองที่ทำงานอยู่) ส่วน
          dropdown ทั้ง 4 ช่องพับซ่อนไว้ กดกางเมื่อต้องใช้ — เดิมกางเรียงเต็มความกว้างซ้อนกันลงมาหมด
          กินพื้นที่เกือบเต็มจอก่อนถึงข้อมูลจริงสักแถว
          ✅ จอใหญ่: เหมือนเดิมทุกประการ (ช่องค้นหา + ทุก dropdown เรียงแถวเดียวกัน ไม่มีปุ่มพับ) */}
      <Box sx={{ mb: 2 }}>
        {/* 🐛 BUG ที่แก้ (ตัวกรองล้นออกนอกจอ): แถวนี้ไม่เคยตั้ง flexWrap ไว้ พอตัวกรองเพิ่มขึ้นเรื่อยๆ
            (แผนก/สถานะ/อายุสัญญา/ช่วงวันที่) ช่องท้ายๆ จะดันทะลุขอบขวาออกไปนอกจอจนกดไม่ได้เลย
            ✅ ให้ห่อลงบรรทัดใหม่แทนเมื่อพื้นที่ไม่พอ — ช่องค้นหายังกินพื้นที่ที่เหลือของบรรทัดแรกเหมือนเดิม
            แต่มีความกว้างขั้นต่ำกันไม่ให้ถูกบีบจนพิมพ์ไม่ได้ */}
        <Stack direction={{ xs: "column", sm: "row" }} gap={1.5} sx={{ flexWrap: { sm: "wrap" } }}>
          <Stack direction="row" gap={1} sx={{ flex: 1, minWidth: { sm: 260 } }}>
            <TextField
              fullWidth size="small"
              placeholder={isMobile ? "ค้นหางาน..." : "ค้นหาบริษัท / โครงการ / เลขที่สัญญา / ผู้รับผิดชอบ..."}
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
            {/* ✅ ปุ่มพับ/กางตัวกรอง — เฉพาะจอมือถือ (จอใหญ่มีที่พอให้ทุกช่องอยู่แถวเดียวกันอยู่แล้ว) */}
            {isMobile && (
              <Badge
                badgeContent={activeDropdownFilterCount} color="error"
                sx={{ "& .MuiBadge-badge": { fontWeight: 700, fontSize: "0.62rem", height: 16, minWidth: 16 } }}
              >
                <IconButton
                  onClick={() => setFiltersOpen((o) => !o)}
                  aria-label={filtersOpen ? "ซ่อนตัวกรอง" : "แสดงตัวกรอง"}
                  sx={{
                    border: "1px solid", borderRadius: 2.5, flexShrink: 0, width: 40, height: 40,
                    borderColor: filtersOpen || activeDropdownFilterCount > 0 ? alpha(ACCENT, 0.5) : "divider",
                    color: filtersOpen || activeDropdownFilterCount > 0 ? ACCENT : "text.secondary",
                    bgcolor: filtersOpen ? alpha(ACCENT, 0.08) : "background.paper",
                    transition: "background-color .15s, border-color .15s, color .15s",
                  }}
                >
                  <FilterList sx={{ fontSize: 20 }} />
                </IconButton>
              </Badge>
            )}
          </Stack>
          {/* ✅ บนมือถือห่อ dropdown ทั้งชุดไว้ใน Collapse — จอใหญ่ render ตรงๆ ไม่ผ่าน Collapse เลย
              (Collapse ที่ in=true ตลอดยังแทรก div ครอบเพิ่มอยู่ดี ซึ่งจะไปทำลายการเรียงแถวของ Stack) */}
          {isMobile ? (
            <Collapse in={filtersOpen} unmountOnExit>
              <Stack gap={1.5} sx={{ pt: 0.5 }}>
                {renderFilterFields()}
                {/* ✅ ล้างตัวกรองได้จากในแผงนี้เลย ไม่ต้องไล่ตั้งกลับทีละช่อง (จอใหญ่มีปุ่มนี้อยู่ในกล่อง
                    "ไม่พบรายการ" อยู่แล้ว แต่บนมือถือกว่าจะเลื่อนไปเจอต้องผ่านการ์ดทั้งหมดก่อน) */}
                {hasActiveFilters && (
                  <Button
                    size="small" onClick={clearAllFilters} startIcon={<Close sx={{ fontSize: 15 }} />}
                    sx={{ alignSelf: "flex-start", textTransform: "none", color: "text.secondary" }}
                  >
                    ล้างตัวกรองทั้งหมด
                  </Button>
                )}
              </Stack>
            </Collapse>
          ) : renderFilterFields()}
        </Stack>
      </Box>

      {/* ── สลับรูปแบบการแสดงผลบนจอมือถือ (การ์ด / ตาราง) ────────────────────────
          ✅ มุมมอง "การ์ด" อ่านทีละงานได้ครบทุกฟิลด์โดยไม่ต้องเลื่อนซ้ายขวา แต่เทียบข้ามงานยาก
          (ต้องเลื่อนขึ้นลงทีละใบ) ส่วนมุมมอง "ตาราง" คือตารางชุดเดียวกับจอคอมทุกประการ — เห็นหลายงาน
          เรียงกันในคราวเดียว เทียบวันที่/สถานะ/มูลค่าข้ามแถวได้ทันที และเรียงลำดับด้วยการแตะหัวคอลัมน์ได้
          แลกกับต้องเลื่อนซ้ายขวาดูคอลัมน์ที่เกินจอ — ไม่มีอันไหน "ดีกว่า" ตายตัว ให้ผู้ใช้เลือกเองตาม
          สิ่งที่กำลังจะทำ แล้วจำค่าไว้ให้ (ดู MOBILE_VIEW_STORAGE_KEY)
          ✅ โชว์จำนวนรายการคู่กันไปเลย จะได้รู้ว่ากำลังดูข้อมูลกี่งานอยู่โดยไม่ต้องเลื่อนไปท้ายสุด */}
      {isMobile && !loading && filtered.length > 0 && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
            {filtered.length.toLocaleString()} รายการ
          </Typography>
          <ToggleButtonGroup
            exclusive size="small" value={mobileView} onChange={handleMobileViewChange}
            aria-label="รูปแบบการแสดงผล"
            // ✅ ใช้ทรง segmented control ชุดเดียวกับแท็บมุมมองด้านบน (VIEW_TAB_GROUP_SX/VIEW_TAB_SX)
            // ให้ "ปุ่มสลับ" ทุกตัวในหน้านี้หน้าตาเหมือนกันหมด ไม่ใช่คนละสไตล์กันคนละที่
            sx={{ ...VIEW_TAB_GROUP_SX, "& .MuiToggleButton-root": { ...VIEW_TAB_SX, gap: 0.5, px: 1.25 } }}
          >
            <ToggleButton value="card" aria-label="มุมมองการ์ด">
              <ViewAgenda sx={{ fontSize: 16 }} /> การ์ด
            </ToggleButton>
            <ToggleButton value="table" aria-label="มุมมองตาราง">
              <TableRows sx={{ fontSize: 16 }} /> ตาราง
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      )}

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
          {/* ✅ บอกให้ชัดว่า "ว่างเพราะอะไร" และกดอะไรได้บ้าง — เดิมโทษช่องค้นหาอย่างเดียว ทั้งที่ตัวกรอง
              ปี/ประเภทงาน/ทีม ก็ทำให้ตารางว่างได้เหมือนกัน (โดยเฉพาะตัวกรองปีซึ่งตั้งค่าเริ่มต้นเป็นปี
              ปัจจุบันไว้เองตั้งแต่แรก ผู้ใช้ไม่ได้ตั้ง จึงไม่มีทางเดาได้เลยว่าข้อมูลถูกกรองอยู่) — ไล่บอก
              ตัวกรองที่เปิดอยู่จริงพร้อมปุ่มล้างทั้งหมดในคลิกเดียว กันเข้าใจผิดว่า "ข้อมูลหาย/ระบบพัง" */}
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 460, mx: "auto", px: 2 }}>
            {hasActiveFilters
              ? `ไม่พบรายการที่ตรงกับเงื่อนไขที่กรองอยู่ (${activeFilterLabels.join(" · ")})`
              : viewFilter === "contracts" && hiddenJobCount > 0
              ? 'ยังไม่มีสัญญาแบบหลายครั้ง — กดแท็บ "งานเก่าในระบบที่ยังไม่จัดกลุ่ม" ด้านบนเพื่อดูงานที่มีอยู่ หรือกด "เพิ่มสัญญาใหม่"'
              : "ยังไม่มีข้อมูลในมุมมองนี้"}
          </Typography>
          {hasActiveFilters && (
            <Button
              size="small" variant="outlined" onClick={clearAllFilters}
              startIcon={<Close sx={{ fontSize: 16 }} />}
              sx={{ mt: 1.5, textTransform: "none", fontWeight: 700, borderRadius: 2, borderColor: alpha(ACCENT, 0.5), color: ACCENT }}
            >
              ล้างตัวกรองทั้งหมด
            </Button>
          )}
          {/* ✅ ตารางว่าง = ไม่มีแถวให้แถวร่างท้ายตารางไปเกาะ (ตอนไม่มีข้อมูลจะเรนเดอร์กล่องนี้แทนทั้งตาราง)
              ต้องมีทางเริ่มต้นสร้างสัญญาแรกจากตรงนี้ด้วย ไม่งั้นหน้าจอที่ว่างเปล่าจะไม่มีอะไรให้ทำต่อเลย
              ⚠️ ไม่โชว์ตอนที่ว่างเพราะตัวกรอง — สิ่งที่ต้องทำตอนนั้นคือล้างตัวกรอง ไม่ใช่สร้างสัญญาใหม่ */}
          {canInlineAdd && !hasActiveFilters && (
            <Button
              size="small" variant="contained" onClick={openAddDialog}
              startIcon={<AddCircleOutline sx={{ fontSize: 18 }} />}
              sx={{ mt: 1.5, textTransform: "none", fontWeight: 700, borderRadius: 2, bgcolor: ACCENT, "&:hover": { bgcolor: "#b91c1c" } }}
            >
              เพิ่มสัญญาใหม่
            </Button>
          )}
        </Paper>
      ) : isMobile && mobileView === "card" ? (
        <Stack spacing={1.5}>
          {/* ✅ ยอดรวมย้ายไปเป็นแถบตรึงท้ายจอแล้ว (ดู renderMobileSummaryBar) — เห็นตลอดเวลาไม่ว่า
              จะเลื่อนอยู่ตรงไหน ดีกว่าวางไว้บนสุดแล้วหายไปทันทีที่เลื่อนดูรายการ */}
          {pagedRows.map((c) => renderMobileCard(c))}
          {/* ✅ ท้ายรายการการ์ดมีทางเพิ่มสัญญาใหม่เหมือนท้ายตาราง — มุมมองการ์ดไม่มีคอลัมน์ให้กรอกตรงจุด
              จึงเปิดไดอะล็อกแทน (ทางเดียวกับปุ่มด้านบน) ไม่ทำฟอร์มในการ์ดซ้ำอีกชุด */}
          {canInlineAdd && (
            <Button
              fullWidth onClick={openAddDialog}
              startIcon={<AddCircleOutline sx={{ fontSize: 20 }} />}
              sx={{
                textTransform: "none", fontWeight: 700, fontSize: "0.85rem", color: ACCENT,
                py: 1.5, borderRadius: 3, border: `1px dashed ${alpha(ACCENT, 0.4)}`,
                "&:hover": { bgcolor: alpha(ACCENT, 0.05), borderColor: ACCENT },
              }}
            >
              เพิ่มสัญญาใหม่
            </Button>
          )}
        </Stack>
      ) : (
        <>
        {/* ✅ บอกให้รู้ตั้งแต่แรกว่าตารางกว้างเกินจอและปัดดูต่อได้ — ไม่งั้นคนที่เพิ่งสลับมาโหมดตารางจะ
            เห็นแค่ 2-3 คอลัมน์แรกแล้วนึกว่าข้อมูลที่เหลือหายไป (ไม่มีคอลัมน์ตรึงแล้ว ทุกคอลัมน์เลื่อน
            ไปพร้อมกันหมด กด ‹ เพื่อกลับมาคอลัมน์เลขที่เอกสารได้ ดู mobileTableSx) */}
        {useMobileTable && (
          <>
            <Stack
              direction="row" alignItems="center" spacing={0.5}
              sx={{ mb: 0.75, color: "text.disabled" }}
            >
              <SwipeLeft sx={{ fontSize: 15 }} />
              <Typography variant="caption">
                ปัดซ้าย-ขวา หรือกดปุ่ม ‹ › เพื่อดูคอลัมน์ที่เหลือ · แตะช่องเพื่อแก้ไข
              </Typography>
            </Stack>
          </>
        )}
        <Box sx={{ position: "relative" }}>
        {/* ✅ ปุ่มลูกศรเลื่อนตารางทีละหน้า — ตัวช่วยหลักที่แก้ปัญหา "เลื่อนตารางบนมือถือยาก" โดยตรง
            ปัดนิ้วยังทำได้เหมือนเดิมทุกอย่าง นี่เป็นแค่ทางเลือกที่แน่นอนกว่า (กดโดนก็เลื่อนแน่ๆ ไม่ต้อง
            ลุ้นว่านิ้วจะปัดโดนแถบไหน หรือเบราว์เซอร์จะแย่งการปัดไปทำอย่างอื่น) และตัวปุ่มเองทำหน้าที่
            บอกด้วยว่า "ยังมีคอลัมน์ต่อไปทางนั้นอีก" — พอเลื่อนสุดทางแล้วปุ่มด้านนั้นจะหายไปเอง
            ⚠️ ลอยทับตารางตรงกลางความสูงพอดี จะได้กดถึงโดยไม่ต้องเลื่อนหน้ากลับขึ้นไปข้างบน */}
        {useMobileTable && [
          { dir: -1, show: tableScroll.canLeft, side: { left: 4 }, icon: <ChevronLeft />, label: "เลื่อนไปทางซ้าย" },
          { dir: 1, show: tableScroll.canRight, side: { right: 4 }, icon: <ChevronRight />, label: "เลื่อนไปทางขวา" },
        ].map((b) => b.show && (
          <IconButton
            key={b.dir} onClick={() => scrollTableBy(b.dir)} aria-label={b.label} size="small"
            sx={{
              position: "absolute", top: "50%", transform: "translateY(-50%)", ...b.side, zIndex: 5,
              width: 34, height: 34, bgcolor: "#fff", color: ACCENT,
              boxShadow: "0 2px 10px rgba(15,23,42,0.22)",
              "&:hover": { bgcolor: "#fff" },
            }}
          >
            {b.icon}
          </IconButton>
        ))}
        <TableContainer
          ref={tableScrollRef}
          onScroll={syncTableScroll}
          component={Paper} variant="outlined"
          sx={{
            borderRadius: 3, overflowX: "auto", overflowY: "hidden",
            // ✅ ให้เลื่อนแนวนอนด้วยนิ้วลื่นแบบมือถือ (momentum scroll) บน iOS Safari — เดิมไม่มี ทำให้
            // เลื่อนดูคอลัมน์ที่เกินจอกระตุกๆ ต้องปาดหลายทีกว่าจะเลื่อนได้จริง
            WebkitOverflowScrolling: "touch",
            // ✅ กันเบราว์เซอร์เอาการปัดแนวนอนของตารางไปใช้เป็น "ปัดย้อนกลับหน้าเว็บ" (iOS Safari/Chrome
            // Android ทำแบบนี้เมื่อปัดใกล้ขอบจอ) — เป็นสาเหตุที่ปัดแล้วเหมือนตารางไม่ขยับบ่อยๆ
            overscrollBehaviorX: "contain",
            borderColor: BORDER_MAIN, boxShadow: "0 1px 2px rgba(15,23,42,0.05)",
            // ✅ แถบเลื่อนบางๆ ที่เห็นได้ตลอด — มือถือ/แมคซ่อน scrollbar เป็นค่าเริ่มต้น ทำให้ไม่มีอะไร
            // บอกเลยว่าตารางยังมีต่อทางขวา และเลื่อนมาถึงไหนแล้ว (ผู้ใช้ถึงรู้สึกว่า "เลื่อนยาก")
            "&::-webkit-scrollbar": { height: 8 },
            "&::-webkit-scrollbar-track": { bgcolor: BORDER_SOFT, borderRadius: 999 },
            "&::-webkit-scrollbar-thumb": {
              bgcolor: alpha("#0f172a", 0.22), borderRadius: 999,
              "&:hover": { bgcolor: alpha("#0f172a", 0.35) },
            },
            scrollbarWidth: "thin",
            scrollbarColor: `${alpha("#0f172a", 0.22)} ${BORDER_SOFT}`,
          }}
        >
          <Table
            ref={tableRef}
            size="small"
            style={tableCssVars}
            sx={{
              // 🐛 BUG ที่แก้ (หัวตารางไม่เต็มความกว้าง ดูแหว่ง): เดิมบังคับความกว้างตารางเท่ากับผลรวม
              // ความกว้างคอลัมน์เป๊ะๆ (--col-total) — พอเป็นแท็บที่มีคอลัมน์น้อย (งานทั่วไป/งานโปรเจค/
              // ยังไม่จัดกลุ่ม ซึ่งซ่อนคอลัมน์ระดับสัญญาไปหลายช่อง) ผลรวมจะน้อยกว่าความกว้างจอ ตารางเลย
              // จบก่อนถึงขอบขวาของกรอบ เหลือพื้นที่ขาวๆ ค้างไว้ข้างหลังหัวตาราง ดูเหมือนตารางแหว่ง
              // ✅ max() = "กว้างเท่าผลรวมคอลัมน์ แต่อย่างน้อยต้องเต็มกรอบเสมอ" — ถ้าคอลัมน์รวมกันแล้ว
              // ยังไม่เต็ม เบราว์เซอร์จะเกลี่ยพื้นที่ที่เหลือให้ทุกคอลัมน์ตามสัดส่วน (table-layout:fixed)
              // ได้ตารางเต็มกรอบพอดีทุกแท็บ ส่วนแท็บที่คอลัมน์เยอะจนล้นจอก็ยังเลื่อนแนวนอนได้เหมือนเดิม
              tableLayout: "fixed", width: "max(var(--col-total, 100%), 100%)",
              // ✅ เดิมใช้ stickyHeader + borderCollapse "separate" คู่กัน ทำให้หัวตารางเรนเดอร์เพี้ยน
              // (เห็นกรอบแดงเป็นก้อนๆ ตอนเลื่อน) — ตอนนี้แสดงแค่ 20 แถวต่อหน้าอยู่แล้ว ตารางไม่สูงจน
              // ต้อง sticky หัวอีกต่อไป ตัด stickyHeader ออก แล้วใช้ borderCollapse ปกติแทนก็พอ ไม่เพี้ยน
              borderCollapse: "collapse",
              // ✅ เดิมตีเส้นขอบเข้ม (ดำ 10%) ครบทั้ง 4 ด้านของทุกเซลล์ = ลุค "ตารางสเปรดชีต" ที่ทำให้
              // หน้าดูเก่าและรกที่สุด เพราะเส้นตารางมีน้ำหนักสายตาแข่งกับตัวข้อมูลเองตลอดเวลา —
              // เปลี่ยนเป็นเน้น "เส้นคั่นแถวแนวนอน" เป็นหลัก ส่วนเส้นแบ่งคอลัมน์แนวตั้งจางลงจนเกือบ
              // มองไม่เห็น (เหลือไว้แค่พอเป็นแนวสายตาให้ตัวเลขในคอลัมน์แคบๆ อย่าง "ครั้งที่ N" ไม่ไหลปนกัน)
              "& th, & td": { border: "none", borderBottom: `1px solid ${BORDER_SOFT}`, borderRight: `1px solid ${BORDER_HAIR}` },
              "& th:last-of-type, & td:last-of-type": { borderRight: "none" },
              "& td": { py: 0.85 },
              // ✅ แถวสุดท้ายก่อนถึงแถวสรุปไม่ต้องมีเส้นใต้ซ้ำกับเส้นคั่นของแถวสรุปเอง
              "& tbody tr:last-of-type td": { borderBottom: "none" },
              // ⚠️ ต้องอยู่ล่างสุด — ทับค่าด้านบนบางส่วนตอนดูตารางบนมือถือ (ดู mobileTableSx)
              ...(mobileTableSx || {}),
            }}
          >
            <TableHead>
              {/* ✅ หัวตารางแถวเดียว — เดิมเป็นหัว 2 ชั้น (กลุ่ม "อ้างอิงเอกสารเลขที่"/"ระยะเวลา" ใช้
                  colSpan คลุมคอลัมน์ย่อยแถวล่าง ที่เหลือใช้ rowSpan คลุม 2 แถว) ซึ่งเกิดขึ้นเพราะมี 18
                  คอลัมน์จนต้องจัดกลุ่มให้อ่านรู้เรื่อง พอยุบคอลัมน์ที่อ่านคู่กันเสมอให้เหลือช่องเดียวแล้ว
                  (ดูคอมเมนต์ที่ DEFAULT_COL_WIDTHS) เหลือ 9 คอลัมน์ หัวชั้นที่ 2 จึงไม่จำเป็นอีกต่อไป —
                  หัวเดียวจบ กวาดสายตาแนวนอนรอบเดียวก็รู้ว่าคอลัมน์ไหนคืออะไร ⚠️ ลำดับคอลัมน์ตรงนี้ต้อง
                  ตรงกับแถวข้อมูลและ footerColSpan เป๊ะๆ ถ้าเพิ่ม/ลดต้องไปแก้ทั้ง 3 จุดพร้อมกัน */}
              {/* ✅ หัวตารางเป็นกลาง (เทาอ่อน + ตัวหนังสือเทาเข้ม) แทนพื้นชมพู+ตัวหนังสือแดงเข้ม+เส้นใต้
                  แดงหนา 2px แบบเดิม — หัวตารางคือ "ป้ายกำกับ" ไม่ใช่ข้อมูล จึงไม่ควรแย่งสายตาไปจาก
                  ตัวข้อมูลข้างล่าง สีแดงถูกเก็บไว้ใช้เฉพาะหัวคอลัมน์ที่กำลังเรียงลำดับอยู่ (ดู ResizableTh)
                  ซึ่งเป็นสถานะที่ผู้ใช้ต้องรู้จริงๆ ว่าตอนนี้ตารางเรียงตามอะไรอยู่ */}
              <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.75rem", bgcolor: SURFACE_SUBTLE, borderBottom: `1px solid ${BORDER_MAIN} !important`, color: TEXT_SUB, letterSpacing: "0.015em" } }}>
                {showCheckboxes && <TableCell padding="checkbox" sx={{ width: colWidth("checkbox") }} />}
                {/* ✅ ป้ายกำกับแผนก — คอลัมน์แรกสุดตามที่ผู้ใช้ขอ เป็นการ "แบ่งสายงาน" ที่กว้างที่สุดของ
                    ทั้งตาราง (งานนี้เป็นของสายไหน) จึงควรอ่านเจอก่อนรายละเอียดของงานแต่ละใบ และเมื่อกด
                    เรียงคอลัมน์นี้ ตารางจะจัดกลุ่มตามแผนกให้ทั้งชุดโดยที่ป้ายสียังอยู่ริมซ้ายเรียงเป็นแถบเดียว
                    ⚠️ ลำดับคอลัมน์ต้องตรงกับแถวข้อมูลและ footerColSpan เป๊ะๆ (ดูคอมเมนต์หัวตารางด้านบน) */}
                <ResizableTh width={colWidth("departmentTag")} align="center" columnKey="departmentTag" tableRef={tableRef} resizable={!useMobileTable} onResize={handleColResize("departmentTag")} sortable sortDirection={sortConfig.key === "departmentTag" ? sortConfig.direction : null} onSort={handleSortClick}>แผนก</ResizableTh>
                {/* ✅ เลขที่สัญญา + ใบเสนอราคา ยุบเป็นช่องเดียว (ซ้อน 2 บรรทัด) — เรียงตามเลขที่สัญญา
                    ซึ่งเป็นตัวหลักที่คนใช้ค้นหา/อ้างอิง ส่วนแท็บงานทั่วไป/โปรเจคใช้ "เอกสารเลขที่" แทน */}
                {!hideContractOnlyColumns && (
                  <ResizableTh width={colWidth("docRef")} columnKey="docRef" tableRef={tableRef} resizable={!useMobileTable} onResize={handleColResize("docRef")} sortable sortDirection={sortConfig.key === "contractNo" ? sortConfig.direction : null} onSort={() => handleSortClick("contractNo")}>เลขที่เอกสาร</ResizableTh>
                )}
                {hideContractOnlyColumns && (
                  <ResizableTh width={colWidth("docNo")} columnKey="docNo" tableRef={tableRef} resizable={!useMobileTable} onResize={handleColResize("docNo")} sortable sortDirection={sortConfig.key === "docNo" ? sortConfig.direction : null} onSort={handleSortClick}>เอกสารเลขที่</ResizableTh>
                )}
                {/* ✅ บริษัท + โครงการ ยุบเป็นช่องเดียว — เป็นข้อมูล "ลูกค้ารายเดียวกัน" ที่อ่านคู่กันเสมอ
                    (เดิมแยก 2 คอลัมน์ และคอลัมน์บริษัทมักว่างเปล่าทั้งคอลัมน์ กินที่ฟรีๆ) */}
                <ResizableTh width={colWidth("customer")} columnKey="customer" tableRef={tableRef} resizable={!useMobileTable} onResize={handleColResize("customer")} sortable sortDirection={sortConfig.key === "site" ? sortConfig.direction : null} onSort={() => handleSortClick("site")}>โครงการ / บริษัท</ResizableTh>
                {/* ✅ ประเภทงาน + ระบบ ยุบเป็นช่องเดียว — ทั้งคู่คือ "งานนี้คืองานอะไร" เหมือนกัน */}
                <ResizableTh width={colWidth("work")} columnKey="work" tableRef={tableRef} resizable={!useMobileTable} onResize={handleColResize("work")} sortable sortDirection={sortConfig.key === "title" ? sortConfig.direction : null} onSort={() => handleSortClick("title")}>งาน</ResizableTh>
                {/* ✅ เริ่มต้น + สิ้นสุด + รอบเข้า ยุบเป็นช่องเดียว "ระยะเวลาสัญญา" — เดิมแยก 3 คอลัมน์
                    แคบๆ จนวันที่โดนตัดเหลือ "01/..." อ่านไม่ได้ทั้งที่เป็นข้อมูลสำคัญ */}
                {!hideContractOnlyColumns && (
                  <ResizableTh width={colWidth("period")} columnKey="period" tableRef={tableRef} resizable={!useMobileTable} onResize={handleColResize("period")} sortable sortDirection={sortConfig.key === "contractStart" ? sortConfig.direction : null} onSort={() => handleSortClick("contractStart")}>ระยะเวลาสัญญา</ResizableTh>
                )}
                {/* ✅ มูลค่างาน — แสดงทุกแท็บแล้ว (เดิมเฉพาะแท็บสัญญา) งานทั่วไป/โปรเจค/ยังไม่จัดกลุ่ม
                    ก็มีมูลค่าของตัวเองได้เหมือนกัน ข้อมูลมีอยู่ในฐานข้อมูลทุกแถวอยู่แล้ว แค่เดิมไม่ได้
                    แสดงให้เห็น — ดูยอดรวมท้ายตาราง (TableFooter) ที่สรุปให้ทุกแท็บเช่นกัน */}
                <ResizableTh width={colWidth("jobValue")} align="center" columnKey="jobValue" tableRef={tableRef} resizable={!useMobileTable} onResize={handleColResize("jobValue")} sortable sortDirection={sortConfig.key === "jobValue" ? sortConfig.direction : null} onSort={handleSortClick}>มูลค่างาน (฿)</ResizableTh>
                {/* ✅ ค่าคอมมิชชั่นที่จ่ายให้ฝั่งลูกค้า — วางติดมูลค่างานเพราะอ่านคู่กันเสมอ
                    (คอมเท่านี้จากงานมูลค่าเท่านี้ คิดเป็นกี่ % ดูได้ทันทีโดยไม่ต้องเลื่อนหา) */}
                <ResizableTh width={colWidth("commission")} align="center" columnKey="commission" tableRef={tableRef} resizable={!useMobileTable} onResize={handleColResize("commission")} sortable sortDirection={sortConfig.key === "commission" ? sortConfig.direction : null} onSort={handleSortClick}>ค่าคอมลูกค้า (฿)</ResizableTh>
                {!hideContractOnlyColumns && (
                  <ResizableTh width={colWidth("status")} align="center" columnKey="status" tableRef={tableRef} resizable={!useMobileTable} onResize={handleColResize("status")} sortable sortDirection={sortConfig.key === "status" ? sortConfig.direction : null} onSort={handleSortClick}>สถานะสัญญา</ResizableTh>
                )}
                {/* 🐛 BUG ที่แก้ (หัวคอลัมน์ไม่ตรงกับข้อมูลข้างใน): ช่องนี้แสดง 2 แบบตามชนิดแถว — สัญญาจริง
                    โชว์ "X/Y ครั้ง" (คืบหน้า) ส่วนงานทั่วไป/โปรเจค/ยังไม่จัดกลุ่มโชว์ป้ายสถานะงาน (ดู
                    jobStatusInfo ในเซลล์) แต่หัวคอลัมน์เขียน "คืบหน้า" ตายตัวเสมอ — ในแท็บที่มีแต่แถวที่
                    ไม่ใช่สัญญา (hideContractOnlyColumns) ทุกแถวจึงโชว์สถานะ แต่หัวบอกว่าคืบหน้า อ่านแล้ว
                    เข้าใจผิดทันที ต้องเปลี่ยนหัวตามชนิดข้อมูลที่แสดงจริงในแท็บนั้นๆ */}
                <ResizableTh width={colWidth("progress")} align="center" columnKey="progress" tableRef={tableRef} resizable={!useMobileTable} onResize={handleColResize("progress")}>
                  {hideContractOnlyColumns ? "สถานะงาน" : "คืบหน้า"}
                </ResizableTh>
                {/* ✅ งานทั่วไป/โปรเจค/ยังไม่จัดกลุ่ม (hideContractOnlyColumns) ไม่มีแนวคิด "หลายครั้ง"
                    แบบสัญญาจริงเลย (แทบทุกแถวมีแค่คอลัมน์เดียวอยู่แล้ว) หัวข้อ "ครั้งที่ 1" จึงดูแปลก/
                    ไม่มีความหมาย — เปลี่ยนเป็น "วันที่เข้างาน" แทนตามที่ผู้ใช้ขอ ส่วนแท็บที่มีสัญญาจริงปนอยู่
                    ด้วย (ทั้งหมด/สัญญา/เลยกำหนด) ยังคงใช้ "ครั้งที่ N" เหมือนเดิม เพราะมีหลายครั้งจริง */}
                {visitColumns.map((n) => (
                  <ResizableTh key={n} width={colWidth(`visit_${n}`)} align="center" columnKey={`visit_${n}`} tableRef={tableRef} resizable={!useMobileTable} onResize={handleColResize(`visit_${n}`)}>
                    {hideContractOnlyColumns ? "วันที่เข้างาน" : `ครั้งที่ ${n}`}
                  </ResizableTh>
                ))}
                {/* ✅ คอลัมน์ "ทีมที่เข้างาน" ระดับสัญญาถูกตัดออกตามที่ผู้ใช้ขอ — ทีมของแต่ละครั้งแสดง/
                    แก้ไขอยู่ในช่อง "ครั้งที่ N" อยู่แล้ว (ดู RoundTeamCell ในแถวข้อมูล) ไม่ต้องมีคอลัมน์
                    สรุประดับสัญญาซ้ำซ้อนอีก — "ผู้รับผิดชอบ" ด้านล่างเป็นฟิลด์อิสระจากทีมที่เข้างานโดย
                    สมบูรณ์ (คนรับผิดชอบสัญญานี้โดยรวมไม่ควรเปลี่ยนตามทีมที่เข้างานแต่ละครั้ง) ยังคงอยู่
                    เหมือนเดิม แก้ไข inline ได้ตามปกติ (ดู responsiblePerson/responsiblePersonId) */}
                <ResizableTh width={colWidth("responsiblePerson")} columnKey="responsiblePerson" tableRef={tableRef} resizable={!useMobileTable} onResize={handleColResize("responsiblePerson")} sortable sortDirection={sortConfig.key === "responsiblePerson" ? sortConfig.direction : null} onSort={handleSortClick}>ผู้รับผิดชอบ</ResizableTh>
                {/* ✅ หมายเหตุ — บันทึกอิสระของงานนั้น (เช่น "ลูกค้าขอเลื่อนรอบ 2" / "ต้องแจ้ง รปภ. ล่วงหน้า")
                    ⚠️ คนละช่องกับ "สถานะสัญญา" ที่พิมพ์ทับได้โดยตั้งใจ — ถ้าใช้ช่องเดียวกัน การจดโน้ต
                    ธรรมดาจะไปกลบสถานะหมดอายุ/ใกล้หมดอายุบนหน้าจอทันที (ดู statusDisplay)
                    ⚠️ วางท้ายสุดก่อนคอลัมน์ปุ่ม เพราะเป็นข้อมูลเสริมที่ยาวไม่แน่นอน ไม่ควรไปดันคอลัมน์
                    หลักที่ต้องกวาดสายตาเทียบกันทุกแถวให้เลื่อนหนีไปทางขวา */}
                <ResizableTh width={colWidth("remark")} columnKey="remark" tableRef={tableRef} resizable={!useMobileTable} onResize={handleColResize("remark")} sortable sortDirection={sortConfig.key === "remark" ? sortConfig.direction : null} onSort={handleSortClick}>หมายเหตุ</ResizableTh>
                <TableCell align="center" sx={{ width: colWidth("actions") }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {tableRows}

              {/* ✅ แถวสุดท้ายของตาราง = ทางลัดสร้างสัญญาใหม่ "ในตาราง" (ดูคอมเมนต์ที่ openInlineAdd)
                  ปิดอยู่ = แถวปุ่ม + บางๆ เต็มความกว้าง / เปิดอยู่ = แถวร่างที่กรอกได้ตรงคอลัมน์จริง
                  ⚠️ ต้องยังไม่ถือว่าเป็นข้อมูลจริงจนกว่าจะกด "บันทึก" — ระหว่างกรอกยังไม่มีอะไรถูกส่งไป
                  ที่เซิร์ฟเวอร์เลยสักฟิลด์ (ต่างจากช่องแก้ไขในแถวปกติที่บันทึกทันทีเมื่อออกจากช่อง) */}
              {canInlineAdd && !inlineAddOpen && (
                <TableRow sx={{ "& td": { borderBottom: "none" } }}>
                  <TableCell colSpan={totalColCount} sx={{ p: 0 }}>
                    <Button
                      fullWidth onClick={openInlineAdd}
                      startIcon={<AddCircleOutline sx={{ fontSize: 19 }} />}
                      sx={{
                        justifyContent: "flex-start", textTransform: "none", fontWeight: 700,
                        fontSize: "0.8rem", color: alpha(ACCENT, 0.85), py: 1, px: 1.5, borderRadius: 0,
                        // เส้นประ = "ช่องว่างที่รอให้เติม" ไม่ใช่แถวข้อมูลจริง — แยกออกจากแถวข้างบนชัดเจน
                        borderTop: `1px dashed ${alpha(ACCENT, 0.3)}`,
                        transition: "background-color .15s, color .15s",
                        "&:hover": { bgcolor: alpha(ACCENT, 0.06), color: ACCENT },
                      }}
                    >
                      เพิ่มสัญญาใหม่ในตาราง
                      <Box component="span" sx={{ ml: 1, fontWeight: 400, fontSize: "0.72rem", color: "text.disabled" }}>
                        กรอกในตารางได้เลย
                      </Box>
                    </Button>
                  </TableCell>
                </TableRow>
              )}

              {canInlineAdd && inlineAddOpen && (
                <InlineAddRow
                  showCheckboxes={showCheckboxes}
                  hideContractOnlyColumns={hideContractOnlyColumns}
                  visitColumns={visitColumns}
                  totalColCount={totalColCount}
                  siteOptions={siteOptions}
                  companyOptions={companyOptions}
                  titleOptions={titleOptions}
                  systemOptions={systemOptions}
                  teamOptions={teamOptions}
                  suggestContractNo={suggestNextContractNo}
                  isContractNoTaken={isContractNoTaken}
                  saving={saving}
                  formError={formError}
                  onSave={handleAddSubmit}
                  onCancel={closeInlineAdd}
                />
              )}
            </TableBody>
            {/* ✅ แถวสรุปยอดรวมท้ายตาราง — ยอดรวมของ "ทุกแถวที่ผ่านตัวกรอง" (ทุกหน้ารวมกัน) ไม่ใช่แค่
                แถวที่เห็นในหน้านี้ จึงระบุกำกับไว้ชัดเจนกันเข้าใจผิด และบอกจำนวนแถวที่ยังไม่ได้กรอก
                มูลค่าไว้ด้วย เพราะถ้ามีแถวพวกนั้นปนอยู่ ยอดนี้คือ "เท่าที่กรอกแล้ว" ยังไม่ใช่ยอดจริง */}
            <TableFooter>
              {/* ✅ พื้นแถวสรุปเป็นเทาอ่อนเป็นกลาง (เดิมพื้นแดงจาง + เส้นบนแดงหนา) — เก็บสีแดงไว้ที่
                  "ตัวเลขยอดรวม" ตัวเดียวพอ ซึ่งเป็นสิ่งที่คนเปิดหน้านี้มาหาจริงๆ ให้เด่นชิ้นเดียวไปเลย
                  ดีกว่าทำทั้งแถวให้แดงจนตัวเลขไม่ต่างจากตัวหนังสือรอบๆ */}
              <TableRow
                sx={{
                  bgcolor: SURFACE_SUBTLE,
                  "& td": { borderTop: `2px solid ${BORDER_MAIN}`, borderBottom: "none", py: 1.25 },
                }}
              >
                <TableCell colSpan={footerColSpan.before} align="right" sx={{ fontWeight: 700, color: "text.primary" }}>
                  <Stack spacing={0.5} alignItems="flex-end">
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end" sx={{ flexWrap: "wrap" }}>
                      <span>รวมมูลค่างานทั้งหมด</span>
                      <Chip
                        size="small"
                        label={`${jobValueSummary.filledCount.toLocaleString()}/${jobValueSummary.rowCount.toLocaleString()} รายการ · ทุกหน้า`}
                        sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700, bgcolor: alpha("#0f172a", 0.06), color: TEXT_SUB }}
                      />
                      {jobValueSummary.missingCount > 0 && (
                        <Tooltip title={`มี ${jobValueSummary.missingCount} รายการที่ยังไม่ได้กรอกมูลค่างาน — ยอดรวมนี้จึงเป็นยอดเท่าที่กรอกแล้ว (${jobValueSummary.filledCount} รายการ) ยังไม่ใช่ยอดจริงทั้งหมด`}>
                          <Chip
                            size="small" icon={<WarningAmber sx={{ fontSize: 13 }} />}
                            label={`ยังไม่ระบุมูลค่า ${jobValueSummary.missingCount}`}
                            sx={{
                              height: 20, fontSize: "0.68rem", fontWeight: 700, cursor: "help",
                              bgcolor: alpha("#f59e0b", 0.15), color: "#b45309",
                              "& .MuiChip-icon": { color: "#b45309" },
                            }}
                          />
                        </Tooltip>
                      )}
                    </Stack>
                    {/* ✅ แจกแจงว่ายอดรวมนี้นับจากชุดข้อมูลไหนบ้าง (แท็บ + ตัวกรองทุกช่อง + คำค้นหา) ตาม
                        ที่ผู้ใช้ขอ — กันตีความยอดผิดว่าเป็นยอดทั้งระบบ ทั้งที่จริงถูกกรองอยู่ */}
                    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end" sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
                      {summaryScopeLabels.map((label) => (
                        <Chip
                          key={label} size="small" variant="outlined" label={label}
                          sx={{
                            height: 19, fontSize: "0.65rem", fontWeight: 600, maxWidth: 260,
                            color: "text.secondary", borderColor: alpha("#0f172a", 0.18),
                            "& .MuiChip-label": { px: 0.75, overflow: "hidden", textOverflow: "ellipsis" },
                          }}
                        />
                      ))}
                    </Stack>
                  </Stack>
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ fontWeight: 800, fontSize: "1rem", color: ACCENT, whiteSpace: "nowrap" }}
                >
                  {formatBaht(jobValueSummary.total)}
                </TableCell>
                {/* ✅ ยอดรวมค่าคอมตกลงมาใต้คอลัมน์ค่าคอมพอดี อ่านคู่กับยอดมูลค่างานได้ทันที
                    ⚠️ % รวมคิดจาก "ผลรวมคอม ÷ ผลรวมมูลค่างาน" ไม่ใช่เฉลี่ยของ % รายแถว */}
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  <Stack spacing={0} alignItems="flex-end">
                    <Box component="span" sx={{ fontWeight: 800, fontSize: "1rem", color: "#7c3aed" }}>
                      {formatBaht(commissionSummary.total)}
                    </Box>
                    {commissionSummary.total > 0 && jobValueSummary.total > 0 && (
                      <Box component="span" sx={{ fontSize: "0.68rem", color: TEXT_SUB, fontWeight: 600 }}>
                        {((commissionSummary.total / jobValueSummary.total) * 100).toFixed(2)}% ของมูลค่างาน
                      </Box>
                    )}
                  </Stack>
                </TableCell>
                <TableCell colSpan={footerColSpan.after} />
              </TableRow>

              {/* ✅ แถวสรุปการวางบิล/รับเงิน — อ่านคู่กับยอดมูลค่างานบรรทัดบนได้ทันทีว่า "งานมูลค่าเท่านี้
                  ออกบิลไปแล้วเท่าไร เก็บได้เท่าไร เหลือเก็บเท่าไร" ซึ่งเดิมไม่มีทางรู้จากหน้านี้เลย
                  ⚠️ โผล่เฉพาะเมื่อมีการวางบิลจริงแล้วเท่านั้น — ระบบเพิ่งเริ่มใช้ ถ้าโชว์ ฿0 ทุกช่อง
                  ตั้งแต่วันแรกจะดูเหมือนตัวเลขพัง มากกว่าดูเหมือน "ยังไม่มีข้อมูล" */}
              {billingSummary.net > 0 && (
                <TableRow sx={{ bgcolor: SURFACE_SUBTLE, "& td": { borderBottom: "none", py: 1, pt: 0 } }}>
                  <TableCell colSpan={totalColCount} sx={{ px: 2 }}>
                    <Stack
                      direction="row" spacing={1} alignItems="center" justifyContent="flex-end"
                      sx={{ flexWrap: "wrap", rowGap: 0.5 }}
                    >
                      <Typography sx={{ fontWeight: 700, fontSize: "0.78rem", color: TEXT_SUB }}>
                        วางบิล / รับเงิน (ชุดข้อมูลเดียวกับด้านบน)
                      </Typography>
                      {[
                        { label: "วางบิลแล้ว", value: billingSummary.net, color: ACCENT },
                        { label: "รับเงินแล้ว", value: billingSummary.paid, color: "#10b981" },
                        { label: "ค้างรับ", value: billingSummary.outstanding, color: "#f59e0b" },
                      ].map((it) => (
                        <Chip
                          key={it.label} size="small"
                          label={`${it.label} ${bahtFmt(it.value)}`}
                          sx={{ height: 22, fontSize: "0.72rem", fontWeight: 700, bgcolor: alpha(it.color, 0.12), color: it.color }}
                        />
                      ))}
                      {billingSummary.overdueRows > 0 && (
                        <Chip
                          size="small" icon={<WarningAmber sx={{ fontSize: 13 }} />}
                          label={`เลยกำหนดชำระ ${billingSummary.overdueRows} รายการ`}
                          sx={{
                            height: 22, fontSize: "0.72rem", fontWeight: 700,
                            bgcolor: alpha("#dc2626", 0.12), color: "#dc2626",
                            "& .MuiChip-icon": { color: "#dc2626" },
                          }}
                        />
                      )}
                      {billingSummary.notInvoicedRows > 0 && (
                        <Tooltip title="รายการที่ยังวางบิลไม่ครบทุกครั้งที่เข้างาน — ยอด 'วางบิลแล้ว' จึงยังไม่ใช่ยอดเต็มของงานชุดนี้">
                          <Chip
                            size="small" label={`ยังวางบิลไม่ครบ ${billingSummary.notInvoicedRows} รายการ`}
                            sx={{ height: 22, fontSize: "0.72rem", fontWeight: 700, cursor: "help", bgcolor: alpha("#64748b", 0.12), color: "#475569" }}
                          />
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              )}
            </TableFooter>
          </Table>
        </TableContainer>
        </Box>
        </>
      )}

      {!loading && filtered.length > PAGE_SIZE && (
        <Stack direction="row" justifyContent="center" sx={{ mt: 2 }}>
          <Pagination
            count={totalPages} page={safePage}
            onChange={(_, v) => setPage(v)}
            color="primary" shape="rounded" size={isMobile ? "large" : "small"}
            sx={{
              "& .Mui-selected": { bgcolor: `${ACCENT} !important`, color: "#fff" },
              ...(isMobile ? { "& .MuiPaginationItem-root": { minWidth: 40, height: 40, fontSize: "1rem" } } : {}),
            }}
          />
        </Stack>
      )}

      {/* ✅ แถบยอดรวมตรึงท้ายจอ (มือถือเท่านั้น) — ใช้ร่วมกันทั้งมุมมองการ์ดและมุมมองตาราง
          ⚠️ ตัวเว้นระยะต้องอยู่ "หลัง" ปุ่มเปลี่ยนหน้า ไม่ใช่ก่อน — ไม่งั้นแถบที่ลอยอยู่ท้ายจอจะไปทับ
          ปุ่มเปลี่ยนหน้าตอนเลื่อนลงสุด จนกดเปลี่ยนหน้าไม่ได้เลย */}
      {isMobile && !loading && filtered.length > 0 && (
        <>
          <Box sx={{ height: 84 }} />
          {renderMobileSummaryBar()}
        </>
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
        {/* ✅ ออกใบส่งมอบงานจากหน้าภาพรวมงานได้ด้วย — จุดนี้ตอบโจทย์คนละแบบกับ 2 จุดแรก: ใช้ตอน
            "ไล่ออกเอกสารย้อนหลังทีละงาน" จากตารางรวม (เห็นทุกงานเรียงกันอยู่แล้ว ไม่ต้องเปิดทีละใบ)
            ⚠️ ใช้ข้อมูลของ "ครั้งล่าสุดที่ลงตารางจริง" เป็นตัวตั้ง เพราะแถวในตารางนี้เป็นระดับสัญญา
            (รวมหลายครั้ง) ไม่ใช่งานเดี่ยว — วันที่เสร็จของสัญญาทั้งใบไม่มีความหมาย ต้องอิงครั้งจริง */}
        {isAdminOrManager && (
          <MenuItem onClick={openDeliveryNoteFromRow}>
            <ListItemIcon><Description fontSize="small" sx={{ color: ACCENT }} /></ListItemIcon>
            <ListItemText>ออกใบส่งมอบงาน</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {deliveryNoteJob && (
        <DeliveryNoteDialog
          open
          onClose={() => setDeliveryNoteJob(null)}
          job={deliveryNoteJob}
        />
      )}

      {addOpen && (
        <Dialog open onClose={closeAddDialog} fullWidth maxWidth="sm" fullScreen={isMobile}>
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
            {/* ✅ "ผู้รับผิดชอบงาน" ไม่ใช่ "ทีมที่เข้างาน" — คนละเรื่องกันโดยสมบูรณ์ (ดูคอมเมนต์ที่
                emptyForm) ผู้รับผิดชอบ = คนที่ติดตามสัญญานี้ทั้งหมด (เห็นในหน้าดำเนินงาน/งานคงค้าง/
                ติดตามใบเสนอราคา และแก้ไขทีมของแต่ละครั้งเองได้) ส่วนทีมที่เข้างานเลือกแยกรายครั้ง */}
            <TextField
              select fullWidth size="small" label="ผู้รับผิดชอบงาน"
              value={form.responsiblePerson} onChange={(e) => setField("responsiblePerson")(e.target.value)}
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
              helperText="คนที่ติดตามสัญญานี้ทั้งหมด — เลือกทีมที่เข้างานแยกรายครั้งได้ในตารางภายหลัง"
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
              <ThaiDatePicker label="วันที่เริ่มสัญญา"
                value={form.contractStart} onChange={setField("contractStart")} />
              {/* ✅ เตือนทันทีตั้งแต่กรอกผิด ไม่ต้องรอกดบันทึกแล้วค่อยเด้ง error ด้านบนสุดของฟอร์ม
                  (ซึ่งอยู่ไกลจากช่องที่ผิดจนต้องเลื่อนหาเอง) — ปุ่มบันทึกก็ถูกปิดไปด้วย ดู isAddFormInvalid */}
              <ThaiDatePicker label="วันที่สิ้นสุดสัญญา"
                value={form.contractEnd} onChange={setField("contractEnd")}
                error={hasInvalidContractRange}
                helperText={hasInvalidContractRange ? "ต้องไม่ก่อนวันที่เริ่มสัญญา" : ""} />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField fullWidth size="small" type="number" label="จำนวนครั้งทั้งหมด *" value={form.visitCount}
                onChange={(e) => setField("visitCount")(e.target.value)} inputProps={{ min: 1, max: MAX_VISIT_COUNT }}
                helperText={`สูงสุด ${MAX_VISIT_COUNT} ครั้ง`} />
              {/* ✅ ฿ นำหน้าช่องกรอก — บอกหน่วยตั้งแต่ตอนกรอก ไม่ต้องเดาว่าใส่เป็นบาทหรือหลักพัน
                  (เทียบ pattern เดียวกับช่อง "มูลค่าใบเสนอราคา" ในหน้าติดตามใบเสนอราคา) */}
              <TextField fullWidth size="small" type="number" label="มูลค่างาน (บาท)" value={form.jobValue}
                onChange={(e) => setField("jobValue")(e.target.value)} inputProps={{ min: 0 }}
                InputProps={{ startAdornment: <InputAdornment position="start">฿</InputAdornment> }} />
            </Stack>
            <Stack spacing={0.75}>
              {/* ✅ ระยะห่างระหว่างรอบ — พิมพ์เลขเดือนเองตรงๆ = ข้อมูลอ้างอิงอิสระ ไม่บังคับ ไม่แตะ
                  "จำนวนครั้งทั้งหมด" ด้านบน (งานจริงเลื่อน/ชนกันได้เสมอ จำนวนครั้งจริงยังกำหนดเองแยกได้
                  เสมอ) ใช้แค่เตือน "เกินกำหนดรอบถัดไป" ในตาราง/พุชแจ้งเตือน — แต่ถ้ากดปุ่มลัด "ปีละ N
                  ครั้ง" ด้านล่างแทน จะปรับ "จำนวนครั้งทั้งหมด" ให้ตรงกันไปในตัว (ดู pickInterval) */}
              <TextField fullWidth size="small" type="number" label="เข้าทุกกี่เดือน" value={form.intervalMonths}
                onChange={(e) => setField("intervalMonths")(e.target.value)} inputProps={{ min: 1, max: 24 }}
                helperText={intervalPreviewText} />
              {/* ✅ ทางลัด "เข้าปีละกี่ครั้ง" — กดแล้วกรอกเลขเดือนด้านบนให้อัตโนมัติ ไม่ต้องคิดเลขเอง
                  (ตามที่ผู้ใช้ขอ: "แก้ไขจำนวนครั้งที่เข้าต่อปีได้ด้วย") ยังพิมพ์เลขเดือนเองตรงๆ ได้ปกติ
                  สำหรับรอบที่ไม่ลงตัว (เช่น ทุก 5 เดือน) — กดปุ่มลัดยังปรับ "จำนวนครั้งทั้งหมด" ด้านบนให้
                  ตรงกันไปด้วยในตัว (ดู pickInterval) */}
              <IntervalMonthsQuickPicks value={form.intervalMonths} onPick={pickInterval} />
            </Stack>

            {/* ✅ ไม่บังคับ — เว้นว่างได้ถ้ายังไม่รู้วันที่เข้างานแน่นอน (บันทึกเป็นฉบับร่างไปเพิ่มวันที่
                ทีหลังได้ที่ปุ่ม "+" ในตารางตามปกติ) กรอกมาจะลงตารางเป็นครั้งที่ 1 จริงทันที */}
            <Typography variant="caption" fontWeight={700} color="text.secondary">วันที่เข้างานครั้งที่ 1 (ถ้ารู้แล้ว)</Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <ThaiDatePicker label="วันที่เริ่ม"
                value={form.firstVisitStart} onChange={setField("firstVisitStart")} />
              <ThaiDatePicker label="วันที่สิ้นสุด"
                value={form.firstVisitEnd} onChange={setField("firstVisitEnd")}
                helperText="เว้นว่าง = วันเดียวกับวันที่เริ่ม" disabled={!form.firstVisitStart} />
            </Stack>
            {/* ✅ ทีมที่เข้างานเป็นของ "ครั้ง" ไม่ใช่ของสัญญา — จึงโผล่เฉพาะตอนกำลังสร้างครั้งที่ 1 จริง
                (มีวันที่แล้ว) เท่านั้น ถ้าเป็นสัญญาเปล่ายังไม่มีครั้งไหนให้ผูกทีม ไม่ต้องมีช่องนี้ให้สับสน */}
            {form.firstVisitStart && (
              <TextField
                select fullWidth size="small" label="ทีมที่เข้างานครั้งที่ 1"
                value={form.firstVisitTeam} onChange={(e) => setField("firstVisitTeam")(e.target.value)}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true }}
                helperText="เฉพาะครั้งที่ 1 — ครั้งถัดไปเลือกทีมของตัวเองแยกได้"
              >
                <option value="">— ไม่ระบุ —</option>
                {teamOptions.map((name) => <option key={name} value={name}>{name}</option>)}
              </TextField>
            )}
            {!form.firstVisitStart && (
              <Alert severity="info" sx={{ fontSize: "0.8rem" }}>
                ยังไม่ระบุ = บันทึกสัญญาไว้ก่อน (จะไม่โผล่ในแผงงานล่วงหน้าของหน้าปฏิทิน — จัดการที่หน้านี้
                เท่านั้น) แล้วไปเพิ่มวันที่เข้างานครั้งที่ 1 ทีหลังได้ที่ปุ่ม "+ เพิ่มครั้งถัดไป" ในตาราง
                เมื่อรู้วันที่จริง
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={closeAddDialog} disabled={saving} sx={{ textTransform: "none" }}>ยกเลิก</Button>
          {/* ✅ ปิดปุ่มไว้จนกว่าจะกรอกครบ/ถูกต้อง — กันกดแล้วเด้ง error ซ้ำๆ โดยไม่รู้ว่าขาดอะไร
              (ช่องบังคับมี * กำกับอยู่แล้ว เห็นได้ทันทีว่าเหลือช่องไหน) */}
          <Button
            variant="contained" onClick={() => handleAddSubmit()} disabled={saving || isAddFormInvalid}
            sx={{ bgcolor: ACCENT, textTransform: "none", fontWeight: 700, "&:hover": { bgcolor: "#b91c1c" } }}
          >
            {saving ? "กำลังบันทึก..." : "บันทึกสัญญา"}
          </Button>
        </DialogActions>
      </Dialog>
      )}

      {/* ── ย้าย "ครั้งที่ N" ไปครั้งที่อื่น ──────────────────────────────────── */}
      {/* ✅ เลือกปลายทางจากรายการครั้งที่ 1..จำนวนครั้งทั้งหมด พร้อมบอกสถานะของแต่ละครั้งกำกับไว้ ให้เห็น
          ตั้งแต่ก่อนกดว่าปลายทางว่างอยู่หรือมีข้อมูลแล้ว (ถ้ามี = จะสลับที่กัน ไม่ใช่เขียนทับ) */}
      {/* ⚠️ disableEnforceFocus จำเป็นตรงนี้ เพราะกล่องนี้เป็นจุดเดียวที่ตั้งใจเปิดกล่องยืนยัน
          (SweetAlert2 — ตอนปลายทางมีข้อมูลอยู่แล้วจึงต้องถามก่อนสลับ) ซ้อนขึ้นมาบน Dialog ที่ยังเปิดค้าง
          อยู่ — ปกติ MUI Modal จะ "ล็อกโฟกัส" ไว้ในตัวเองเสมอ พอ SweetAlist2 โฟกัสปุ่มของมัน MUI จะดึง
          โฟกัสกลับมาทันที ทำให้กดปุ่มยืนยันด้วยคีย์บอร์ด (Enter/Tab) ไม่ได้ — ปิดการล็อกโฟกัสเฉพาะกล่องนี้
          กล่องอื่นในหน้ายังล็อกโฟกัสตามปกติเหมือนเดิม (z-index ที่เคยทำให้กล่องยืนยันไปอยู่ด้านหลัง แก้รวม
          ไว้ที่ src/index.css แล้ว) */}
      {Boolean(moveRoundTarget) && (
        <Dialog open onClose={closeMoveRoundDialog} fullWidth maxWidth="xs" fullScreen={isMobile} disableEnforceFocus>
        <DialogTitle sx={{ fontWeight: 800 }}>
          ย้ายครั้งที่ {moveRoundTarget?.fromRound} ไปเป็นครั้งที่...
        </DialogTitle>
        <DialogContent dividers>
          {moveRoundTarget && (
            <Stack spacing={1.5} sx={{ pt: 0.5 }}>
              <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: alpha(ACCENT, 0.05) }}>
                <Typography variant="body2" fontWeight={700}>
                  {moveRoundTarget.contract.company || "-"} · {moveRoundTarget.contract.site || "-"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {moveRoundTarget.contract.title} · {moveRoundTarget.contract.system}
                  {moveRoundTarget.contract.contractNo ? ` · เลขที่สัญญา ${moveRoundTarget.contract.contractNo}` : ""}
                </Typography>
                <Typography variant="caption" sx={{ display: "block", mt: 0.5, color: "text.secondary" }}>
                  วันที่ของครั้งที่ {moveRoundTarget.fromRound}:{" "}
                  {moveRoundTarget.contract.visits
                    .filter((v) => !v.unscheduled && Number(v.time) === moveRoundTarget.fromRound)
                    .map((v) => formatEventDateRange(v))
                    .join(", ") || "-"}
                </Typography>
              </Box>
              <Alert severity="info" sx={{ py: 0.5 }}>
                ย้ายทั้งวันที่ สถานะ ทีมที่เข้างาน และประวัติงานของครั้งนี้ไปพร้อมกันทั้งหมด — ถ้าครั้งที่ปลายทางมีข้อมูลอยู่แล้ว ระบบจะสลับที่กันให้ ไม่มีข้อมูลไหนถูกลบ
              </Alert>
              <TextField
                select fullWidth size="small" label="ย้ายไปเป็นครั้งที่ *"
                value={moveRoundValue}
                onChange={(e) => setMoveRoundValue(e.target.value)}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true }}
              >
                <option value="">— เลือกครั้งที่ —</option>
                {Array.from(
                  { length: Math.min(MAX_VISIT_COUNT, Math.max(Number(moveRoundTarget.contract.visitCount) || 0, rowMaxRound(moveRoundTarget.contract))) },
                  (_, i) => i + 1
                )
                  .filter((n) => n !== moveRoundTarget.fromRound)
                  .map((n) => {
                    const occupied = moveRoundTarget.contract.visits.some((v) => !v.unscheduled && Number(v.time) === n);
                    return (
                      <option key={n} value={n}>
                        ครั้งที่ {n} {occupied ? "(มีข้อมูลอยู่แล้ว — จะสลับที่กัน)" : "(ว่าง)"}
                      </option>
                    );
                  })}
              </TextField>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeMoveRoundDialog} disabled={moveRoundSaving} sx={{ textTransform: "none" }}>ยกเลิก</Button>
          <Button
            variant="contained" onClick={handleMoveRoundSubmit}
            disabled={moveRoundSaving || !moveRoundValue}
            sx={{ bgcolor: ACCENT, textTransform: "none", fontWeight: 700, "&:hover": { bgcolor: "#b91c1c" } }}
          >
            {moveRoundSaving ? "กำลังย้าย..." : "ย้าย"}
          </Button>
        </DialogActions>
      </Dialog>
      )}

      {Boolean(addVisitTarget) && (
        <Dialog open onClose={closeAddVisitDialog} fullWidth maxWidth="xs" fullScreen={isMobile}>
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
              <ThaiDatePicker label="วันที่เริ่ม"
                value={newVisitStart} onChange={setNewVisitStart} />
              <ThaiDatePicker label="วันที่สิ้นสุด"
                value={newVisitEnd} onChange={setNewVisitEnd} />
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
      )}

      {/* ✅ ย้ายงานทั่วไปเข้าสัญญาที่มีอยู่แล้ว — แก้ไขกรณีจัดกลุ่มผิด (สร้างเป็นงานเดี่ยวทั้งที่จริง
          ควรอยู่ในสัญญานี้) ต่างจากปุ่ม "จัดกลุ่มเป็นสัญญา" ที่สร้างสัญญาใหม่เสมอ */}
      {Boolean(attachTarget) && (
        <Dialog open onClose={closeAttachDialog} fullWidth maxWidth="xs" fullScreen={isMobile}>
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
      )}

      {mergeOpen && (
        <Dialog open onClose={closeMergeDialog} fullWidth maxWidth="sm" fullScreen={isMobile}>
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
              <ThaiDatePicker label="วันที่เริ่มสัญญา"
                value={mergeForm.contractStart} onChange={setMergeField("contractStart")} />
              <ThaiDatePicker label="วันที่สิ้นสุดสัญญา"
                value={mergeForm.contractEnd} onChange={setMergeField("contractEnd")} />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                fullWidth size="small" type="number" label="จำนวนครั้งทั้งหมด" value={mergeForm.visitCount}
                onChange={(e) => setMergeField("visitCount")(e.target.value)} inputProps={{ min: 1, max: MAX_VISIT_COUNT }}
                helperText={`ค่าเริ่มต้น = จำนวนงานที่เลือก (${selectedContracts.length}) — สูงสุด ${MAX_VISIT_COUNT} ครั้ง`}
              />
              {/* ✅ min:0 ให้ตรงกับฟอร์ม "เพิ่มสัญญาใหม่" (มีการตรวจฝั่ง JS อยู่แล้วทั้งคู่) */}
              <TextField fullWidth size="small" type="number" label="มูลค่างาน (บาท)" value={mergeForm.jobValue}
                onChange={(e) => setMergeField("jobValue")(e.target.value)} inputProps={{ min: 0 }}
                InputProps={{ startAdornment: <InputAdornment position="start">฿</InputAdornment> }} />
            </Stack>
            <Stack spacing={0.75}>
              <TextField
                fullWidth size="small" type="number" label="เข้าทุกกี่เดือน" value={mergeForm.intervalMonths}
                onChange={(e) => setMergeField("intervalMonths")(e.target.value)} inputProps={{ min: 1, max: 24 }}
                helperText="ไม่บังคับ — พิมพ์เลขเองไม่กระทบจำนวนครั้งด้านบน กดปุ่มลัดด้านล่างจะปรับให้ตรงกันอัตโนมัติ"
              />
              {/* ✅ ทางลัด "เข้าปีละกี่ครั้ง" — เหมือนกับฟอร์ม "เพิ่มสัญญาใหม่" ทุกประการ กดแล้วปรับ
                  "จำนวนครั้งทั้งหมด" ด้านบนให้ตรงกันไปด้วย (ทับค่าเริ่มต้นจากจำนวนงานที่เลือกได้ ดู
                  pickMergeInterval) */}
              <IntervalMonthsQuickPicks value={mergeForm.intervalMonths} onPick={pickMergeInterval} />
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
      )}

      {/* ── ประวัติการแก้ไขข้อมูลสัญญา ────────────────────────────────────────
          ✅ ข้อมูลสัญญาแก้ inline ได้จากตารางนี้โดยตรง และทุกครั้งที่แก้มีผลกับ "ทุกครั้งในสัญญา"
          พร้อมกัน (updateMany ฝั่ง server) — คลิกพลาดช่องเดียวก็เปลี่ยนมูลค่างาน/วันหมดอายุทั้งสัญญา
          กล่องนี้คือทางเดียวที่จะตามกลับได้ว่าใครแก้ เมื่อไหร่ จากค่าอะไรเป็นค่าอะไร */}
      {Boolean(historyContract) && (
        <Dialog open onClose={() => setHistoryContract(null)} fullWidth maxWidth="sm" fullScreen={isMobile}>
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <History sx={{ fontSize: 20, color: ACCENT }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: "1rem", lineHeight: 1.3 }}>ประวัติการแก้ไขข้อมูลสัญญา</Typography>
              {historyContract && (
                <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {[historyContract.contractNo, historyContract.company, historyContract.site].filter(Boolean).join(" · ") || "ไม่ระบุชื่อสัญญา"}
                </Typography>
              )}
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ px: { xs: 2, sm: 3 } }}>
          {(() => {
            const logs = historyContract ? contractEditHistory(historyContract) : [];
            if (logs.length === 0) {
              return (
                <Typography variant="body2" sx={{ color: TEXT_SUB, textAlign: "center", py: 4 }}>
                  ยังไม่เคยมีการแก้ไขข้อมูลสัญญานี้
                </Typography>
              );
            }
            return (
              <Stack sx={{ py: 1 }}>
                {logs.map((log, i) => (
                  <Stack key={`${log.timestamp}-${i}`} direction="row" spacing={1.5} sx={{ position: "relative" }}>
                    {/* เส้นไทม์ไลน์ + จุด — ลากต่อเนื่องทุกรายการยกเว้นรายการสุดท้าย */}
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", pt: 0.5 }}>
                      <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: i === 0 ? ACCENT : alpha("#0f172a", 0.25), flexShrink: 0 }} />
                      {i < logs.length - 1 && <Box sx={{ width: "1px", flex: 1, bgcolor: alpha("#0f172a", 0.12), my: 0.5 }} />}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0, pb: i < logs.length - 1 ? 2 : 0 }}>
                      <Stack direction="row" alignItems="baseline" spacing={1} flexWrap="wrap">
                        <Typography sx={{ fontWeight: 700, fontSize: "0.85rem" }}>{log.userName || "ไม่ทราบชื่อ"}</Typography>
                        <Typography variant="caption" sx={{ color: TEXT_SUB }}>
                          {formatThai(log.timestamp, "D MMM YYYY HH:mm [น.]")}
                        </Typography>
                      </Stack>
                      {/* ✅ แยกเป็นบรรทัดละ 1 ฟิลด์ (server ต่อด้วย " · ") — แก้ทีเดียวหลายช่องแล้วยัง
                          ไล่อ่านทีละช่องได้ ไม่ใช่ข้อความยาวพืดบรรทัดเดียว */}
                      <Stack sx={{ mt: 0.5 }} spacing={0.35}>
                        {String(log.detail || "").split(" · ").filter(Boolean).map((line, li) => (
                          <Typography
                            key={li} variant="body2"
                            sx={{ fontSize: "0.82rem", color: "text.secondary", wordBreak: "break-word" }}
                          >
                            {line}
                          </Typography>
                        ))}
                      </Stack>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            );
          })()}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setHistoryContract(null)} sx={{ textTransform: "none" }}>ปิด</Button>
        </DialogActions>
      </Dialog>
      )}

      {/* ✅ กล่อง "วางบิล / รับเงิน" ของงานรายครั้ง — ตัวเดียวกับที่หน้า /billing ใช้ (ของกลาง)
          จัดการจากตารางนี้ได้เลยโดยไม่ต้องเปลี่ยนหน้า แล้วตารางอัปเดตยอดให้ทันทีที่บันทึกเสร็จ */}
      <BillingDialog
        event={billingTarget}
        onClose={handleCloseBilling}
        onSaved={handleBillingSaved}
      />

      {/* ✅ เอกสารของงานรายครั้ง — ดึงข้อมูลสดจาก contracts ทุกครั้งที่ render ไม่ได้เก็บ array ไว้
          ตอนกด จึงไม่มีทางโชว์ไฟล์ชุดที่เก่าค้าง */}
      <JobDocsDialog
        roundVisits={docsRoundVisits}
        title={docsTarget?.title}
        onClose={handleCloseDocs}
        canUpload={docsCanUpload}
        onUploaded={() => fetchData(true)}
      />
    </Box>
  );
}
