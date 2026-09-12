import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid"; // for dayClick
import momentTimezonePlugin from "@fullcalendar/moment-timezone";

import interactionPlugin from "@fullcalendar/interaction";

import listPlugin from "@fullcalendar/list";

import Swal from "sweetalert2";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"; // Import FontAwesomeIcon component

import {
  faClockRotateLeft,
  faFileExcel,

  faHourglassHalf,
  faCheck,
  faCheckDouble,
  faFilter,
  faXmark,
  faLayerGroup,
} from "@fortawesome/free-solid-svg-icons"; // Import ไอคอนต่างๆ

import CustomerService from "@/shared/services/CustomerService";
import EventService from "@/shared/services/EventService";
import JobTypeService from "@/shared/services/JobTypeService";
import SystemTypeService from "@/shared/services/SystemTypeService";

import AuthService from "@/shared/services/authService";

import moment from "moment";

import { ThreeDots } from "react-loader-spinner";





import "./index.css";

import API from "@/shared/api/axiosInstance";
import { escapeHtml } from "@/shared/utils/escapeHtml";
import { getApprovalState, isPendingApproval, countPendingJobs } from "@/shared/utils/approvalStatus";
import { formatRoundLabel } from "@/shared/utils/contractRounds";
import { classifyJob, JOB_CLASS_META } from "@/shared/utils/jobClassification";

import thLocale from "@fullcalendar/core/locales/th"; // นำเข้า locale ภาษาไทย

import { useAuth } from "@/features/auth/AuthContext"; // ✅ ดึงข้อมูล Auth

// ⚠️ jsPDF / ฟอนต์ไทย ไม่ได้ถูก import ที่นี่แล้ว — ย้ายไปอยู่ในกล่องออกเอกสารแต่ละชนิด
// (WorkNoticeDialog / DeliveryNoteDialog) ซึ่งเป็นที่เดียวที่สร้าง PDF จริง
import TomSelect from "tom-select";
import "tom-select/dist/css/tom-select.css";



import { getAddEvent } from "../EventForms/AddEvent";
import { getAddSalesAppointment } from "../EventForms/AddSalesAppointment";
import { getEditSalesAppointment } from "../EventForms/EditSalesAppointment";
import { SALES_APPOINTMENT_TYPES, SALES_STATUSES, toSalesStatus } from "../../salesAppointmentTypes";
import { getEditEvent } from "../EventForms/EditEvent";
import DeliveryNoteDialog from "@/features/documents/components/DeliveryNoteDialog";
import WorkNoticeDialog from "@/features/documents/components/WorkNoticeDialog";
import { getSaveEventToDB } from "../EventForms/SaveEvent";
import { getEventDrop } from "../EventForms/EventDrop";
import { getEventResize } from "../EventForms/EventResize";
import { getFetchEvents } from "../EventForms/FetchEvents";
import { getDeleteEvent } from "../EventForms/DeleteEvent";
import { getAddDraftEvent } from "../EventForms/AddDraftEvent";

import UnscheduledPanel from "../UnscheduledPanel";
import { mountThaiDatePickers } from "@/shared/components/mountThaiDatePickers";
import { formatThai } from "@/shared/utils/thaiDate";
import { isRole, ROLES, DEPARTMENT } from "@/shared/utils/roles";
import { can } from "@/shared/utils/roles";

// ✅ คำอธิบายสถานะแบบยาว (ใช้เป็น tooltip ของไอคอนสถานะบน event)
const STATUS_DESCRIPTIONS = {
  ยกเลิก: "ยกเลิก",
  กำลังรอยืนยัน: "กำลังรอยืนยัน",
  ยืนยันแล้ว: "ยืนยันแล้ว",
  กำลังดำเนินการ: "กำลังดำเนินการ",
  ดำเนินการเสร็จสิ้น: "ดำเนินการเสร็จสิ้น",
  เสนอราคาแก้ไขแล้ว: "เสนอราคาแก้ไขแล้ว",
  วางบิลแล้วรอเก็บเงิน: "วางบิลแล้วรอเก็บเงิน",
  ดำเนินการเสร็จสิ้นเก็บเงินแล้ว: "ดำเนินการเสร็จสิ้นเก็บเงินแล้ว",
};

// ✅ แปลง FontAwesome icon object (เช่น faCheck) เป็น inline SVG string
// ใช้แทนการ mount ผ่าน ReactDOM.createRoot ใน eventDidMount เพราะ eventDidMount
// จะไม่ถูกเรียกซ้ำเมื่อ "ข้อมูล" ของ event เปลี่ยน (เช่น status) โดยที่ element ยังอยู่
// การฝัง SVG ไว้ใน eventContent (ที่ FullCalendar เรียกทุกครั้งที่ re-render event) ทำให้
// ไอคอนอัปเดตทันทีตาม status ใหม่ โดยไม่ต้องรีเฟรชหน้า
/**
 * readableOn(fg, bg) — คืนสี fg ที่ "อ่านออกแน่นอน" บนพื้น bg (คอนทราสต์ ≥ 4.5:1 ตามเกณฑ์ WCAG AA)
 *
 * ⚠️ จำเป็นเพราะป้ายประเภทงานใช้ "สีของงานเอง" เป็นสีตัวอักษร ซึ่งผู้ใช้เลือกได้อิสระทุกสี — สีอ่อนๆ
 * หรือสีกลางๆ บางสีวางบนป้ายพื้นขาวแล้วจางจนแทบมองไม่เห็น (วัดจริง: ฟ้าอมเขียว #0891b2 ได้ 3.7:1)
 * ✅ ไล่ผสมกับดำ (หรือขาวถ้าพื้นเข้ม) ทีละขั้นจนผ่านเกณฑ์ — ยังคง "เฉดสีเดิม" ไว้ จึงยังบอกประเภทงาน
 * ด้วยสีได้เหมือนเดิม แค่เข้ม/อ่อนขึ้นเท่าที่จำเป็น
 */
const readableOn = (fg, bg) => {
  const toRgb = (c) => {
    const m = String(c).trim();
    if (m.startsWith("#")) {
      const h = m.slice(1);
      const f = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
      if (f.length < 6) return null;
      return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16));
    }
    const n = m.match(/\d+(\.\d+)?/g);
    return n && n.length >= 3 ? n.slice(0, 3).map(Number) : null;
  };
  const lum = (rgb) =>
    rgb
      .map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); })
      .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]; return (hi + 0.05) / (lo + 0.05); };
  const f = toRgb(fg), b = toRgb(bg);
  if (!f || !b) return fg;
  // พื้นสว่าง → ไล่ให้ตัวอักษรเข้มขึ้น · พื้นเข้ม → ไล่ให้สว่างขึ้น
  const target = lum(b) > 0.5 ? [0, 0, 0] : [255, 255, 255];
  let cur = f;
  for (let i = 0; i < 12 && ratio(cur, b) < 4.5; i++) {
    cur = cur.map((v, k) => Math.round(v + (target[k] - v) * 0.12));
  }
  return `rgb(${cur[0]}, ${cur[1]}, ${cur[2]})`;
};
const faIconToSvg = (iconDef, { color = "#000000" } = {}) => {
  if (!iconDef?.icon) return "";
  const [width, height, , , svgPathData] = iconDef.icon;
  const paths = Array.isArray(svgPathData) ? svgPathData : [svgPathData];
  const pathsHtml = paths
    .map((d) => `<path fill="${color}" d="${d}"></path>`)
    .join("");
  // ⚠️ ขนาดเป็น 1em โดยตั้งใจ — ไอคอนโตตาม font-size ของ .ec-card-icon ซึ่งมาจากตัวแปร --ec-icon
  // ที่กำหนดไว้ "จุดเดียว" ใน index.css  เดิมส่งเป็น px จาก JS ทำให้ขนาดไอคอนถูกคุมคนละที่กับขนาด
  // ตัวหนังสือ เวลาจะย่อ/ขยายต้องตามแก้ 2 ไฟล์ และลืมแก้ฝั่งใดฝั่งหนึ่งได้ง่ายมาก
  return `<svg viewBox="0 0 ${width} ${height}" style="width:1em;height:1em;display:block;">${pathsHtml}</svg>`;
};

// ✅ ปุ่มย่อ/ขยายปฏิทิน (− 100% +) ถูกตัดออกตามที่ผู้ใช้ขอ — บนมือถือใช้การหุบ/กางนิ้ว (pinch-zoom)
// ของเบราว์เซอร์เองได้อยู่แล้ว (โค้ดปัดเปลี่ยนเดือนด้านล่างตั้งใจไม่แตะ touch-action เลย) และปัดซ้าย-ขวา
// เพื่อเลื่อนเดือนได้เหมือนเดิม จึงไม่จำเป็นต้องมีปุ่มซูมของตัวเองซ้ำอีกชุด
// 🐛 BUG ที่แก้ (ปฏิทินค้างขนาดผิดโดยแก้ไม่ได้เลย): ตอนตัดปุ่มออก ตัวแปร zoomIndex ยังโหลดค่าที่เคย
// บันทึกไว้จาก localStorage อยู่ และ setZoomIndex เหลือแต่ตัวเรียกที่ตายแล้ว — ใครที่เคยกดขยายไว้
// 175% (หรือย่อไว้ 70%) จะเปิดหน้าปฏิทินมาเจอขนาดนั้นค้างถาวร ไม่มีปุ่มให้กดกลับอีกแล้ว
// ✅ ตัดสถานะซูมออกทั้งชุด เริ่มที่ 100% เสมอทุกครั้งที่เปิดหน้า (ไม่อ่าน/ไม่เขียน localStorage อีก)

/**
 * 🗂️ การ์ดงานในปฏิทิน "พับ/กางได้" + จำค่าที่ผู้ใช้เลือกไว้
 *
 * ⚠️ ปัญหาที่แก้: การ์ดหนึ่งใบมีได้ถึง 7 บรรทัด (ชื่องาน · โครงการ · ระบบ · ครั้งที่ · ทีม · ผู้ติดต่อ ·
 * เวลา) วันไหนมีงาน 3-4 งานคือเต็มช่องวันจนอ่านอะไรไม่ออก
 *
 * ✅ ค่าเริ่มต้น = "กางไว้" (เห็นรายละเอียดครบ) ตามที่ผู้ใช้สั่ง — คนส่วนใหญ่เปิดปฏิทินมาเพื่อดูว่างาน
 * แต่ละใบคืออะไร การให้พับไว้ก่อนแปลว่าต้องกดทุกใบก่อนถึงจะได้ข้อมูลที่ต้องการจริงๆ
 * ✅ ถ้ากดปิด = ปิดค้างยาว จำไว้ข้ามการเปิด-ปิดแอป และ "แยกตามผู้ใช้" (คนละคนคนละค่า ใช้เครื่อง
 * เดียวกันก็ไม่ปนกัน)
 *
 * ⚠️ โครงสร้างที่เก็บเป็น "ค่าเริ่มต้น + รายการยกเว้น" ไม่ใช่ลิสต์ของการ์ดที่กางไว้ทั้งหมด:
 * ถ้าเก็บเป็นลิสต์ตรงๆ ทุกครั้งที่กางการ์ดใหม่ลิสต์จะยาวขึ้นเรื่อยๆ ไม่มีที่สิ้นสุด (งานเก่าที่ถูกลบไปแล้ว
 * ก็ยังค้างอยู่ในนั้นตลอดไป) ✅ แบบนี้เก็บเฉพาะ "ใบที่ต่างจากค่าเริ่มต้น" และการกดกาง/ย่อทั้งหมดจะ
 * ล้างรายการยกเว้นทิ้งทุกครั้ง ขนาดจึงคุมได้เองโดยธรรมชาติ (มี cap กันไว้อีกชั้นตอนบันทึก)
 *
 * ⚠️ ยังต้องเก็บสถานะไว้ "นอก React" เหมือนเดิม: eventContent ของ FullCalendar ถูกเรียกใหม่ทุกครั้ง
 * ที่ events เปลี่ยน ซึ่งเกิดทุก 30 วินาทีจาก background polling — ถ้าเก็บใน state การ toggle แต่ละครั้ง
 * จะ re-render ปฏิทินทั้งอัน (กระตุก) และการ์ดที่เพิ่งกางอาจถูกรีเซ็ตกลางคัน
 */
const CARD_PREF_KEY_PREFIX = "eventCalendar.cardState.";
// กันรายการยกเว้นบวมข้ามปี — เกินนี้ตัดตัวเก่าสุดทิ้ง (เป็นแค่ค่าความชอบในการแสดงผล ไม่ใช่ข้อมูลงาน)
const CARD_PREF_MAX_EXCEPTIONS = 300;

const cardPrefs = { def: true, ex: new Set(), key: null };

const loadCardPrefs = (userId) => {
  cardPrefs.key = CARD_PREF_KEY_PREFIX + (userId || "anonymous");
  cardPrefs.def = true;
  cardPrefs.ex = new Set();
  try {
    const raw = localStorage.getItem(cardPrefs.key);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.def === "boolean") cardPrefs.def = parsed.def;
    if (Array.isArray(parsed?.ex)) cardPrefs.ex = new Set(parsed.ex.map(String));
  } catch {
    /* ค่าที่เก็บไว้เสีย/อ่านไม่ได้ — ใช้ค่าเริ่มต้นไปเลย ไม่ควรทำให้ปฏิทินพังเพราะเรื่องแค่นี้ */
  }
};

const saveCardPrefs = () => {
  if (!cardPrefs.key) return;
  try {
    const ex = [...cardPrefs.ex].slice(-CARD_PREF_MAX_EXCEPTIONS);
    localStorage.setItem(cardPrefs.key, JSON.stringify({ def: cardPrefs.def, ex }));
  } catch {
    /* โควตาเต็ม/โหมดส่วนตัว — ไม่บันทึกก็ยังใช้งานได้ปกติในรอบนี้ */
  }
};

/** การ์ดใบนี้ควรกางอยู่ไหม = ค่าเริ่มต้น XOR อยู่ในรายการยกเว้น */
const isCardExpanded = (id) => cardPrefs.def !== cardPrefs.ex.has(String(id));

/** จำว่าใบนี้ถูกตั้งเป็นกาง/ย่อ — ถ้าตรงกับค่าเริ่มต้นอยู่แล้วก็ถอดออกจากรายการยกเว้น */
const rememberCardState = (id, expanded) => {
  const key = String(id);
  if (expanded === cardPrefs.def) cardPrefs.ex.delete(key);
  else cardPrefs.ex.add(key);
};

function EventCalendar() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { userData } = useAuth(); // ✅ เปลี่ยนจาก user → userData
  // ✅ เซลใช้ฟอร์ม/ชุดสีคนละชุดกับช่าง — เช็คจาก ROLES ตัวกลาง ไม่เขียนสตริงสด
  const isSaleUser = (userData?.role || "").toLowerCase() === ROLES.SALE;

  /**
   * แผนกที่กำลังเปิดดูอยู่ — มาจาก ?dept=sales (เมนู "ตารางงานเซล" ของแอดมิน)
   * ⚠️ ตัวนี้เปลี่ยนแค่ "ดูของใคร" ไม่ได้เปลี่ยนสิทธิ์ — ฝั่ง server ยอมให้ข้ามแผนกเฉพาะ
   * แอดมิน/ผู้จัดการ (ดู departmentScope) role อื่นเติม query เองก็ไม่มีผล
   */
  const requestedDept = searchParams.get("dept");
  /**
   * ✅ เซลเปิดดู "ตารางงานช่าง" ได้ (?dept=service) — อ่านอย่างเดียว ตามที่ผู้ใช้สั่ง
   * เหตุผล: เซลต้องรู้ว่าช่างว่างวันไหน/ติดงานที่ไหนอยู่ ก่อนไปรับปากลูกค้าเรื่องวันเข้างาน
   * ⚠️ "ผู้เยี่ยมชม" เท่านั้น — ไม่ได้เป็นเจ้าของงานไหนเลย จึงต้องล็อกทุกทางที่แก้ข้อมูลได้
   * (เพิ่มงาน / ลากเปลี่ยนวัน / ย่อขยาย / ฟอร์มแก้ไข) ดูจุดที่ใช้ isServiceObserver ด้านล่าง
   * ⚠️ ฝั่ง server กันไว้อีกชั้นอยู่แล้ว (PUT/DELETE ต้องเป็นเจ้าของ/ผู้ถูกมอบหมาย ไม่งั้น 403)
   * การล็อกฝั่งจอนี้มีไว้ให้ผู้ใช้ "ไม่กรอกเสียเที่ยว" ไม่ใช่เพื่อความปลอดภัย
   */
  const isServiceObserver =
    requestedDept === DEPARTMENT.SERVICE && can(userData, "viewServiceCalendar") && isSaleUser;
  const viewingDept =
    requestedDept === "sales" ? "sales" : isServiceObserver ? DEPARTMENT.SERVICE : undefined;
  const viewingSalesCalendar = viewingDept === "sales";
  // ✅ จุดเดียวที่ตอบว่า "ตอนนี้กำลังดูโลกของฝ่ายขายอยู่ไหม" — คุมทั้งแถบสี/ป้ายอธิบายสี/
  // แผงตัวกรอง/ฟอร์มเพิ่ม-แก้ไข/แผงงานล่วงหน้า
  // 🐛 BUG ที่แก้ (ผู้ใช้แจ้ง: เซลเปิด ?dept=service แล้วแถบสียังเป็นชุดของงานขาย):
  // แม้จะมีตัวนี้ไว้กันลืมแล้ว แต่ 3 จุด (คลาส ec-sales ที่เปลี่ยนชุดสีทั้งตาราง, แผงป้ายอธิบายสี
  // และฟอร์มเพิ่ม) ยังเขียน isSaleUser || viewingSalesCalendar สดอยู่ จึงตอบว่า "ใช่" กับเซล
  // ที่กำลังดูตารางช่าง — ต้องใช้ isSalesView ทุกจุด ห้ามเขียนเงื่อนไขสดซ้ำอีก
  // ⚠️ เซลที่กำลังเปิดดูตารางช่างอยู่ ต้องได้มุมมองของ "งานช่าง" (ป้ายสี/ตัวกรอง/ฟอร์ม) ไม่ใช่ของงานขาย
  // — ไม่งั้นจะเห็นป้ายสถานะของงานขายทับอยู่บนงานช่างซึ่งคนละชุดกันคนละความหมาย
  const isSalesView = (isSaleUser && !isServiceObserver) || viewingSalesCalendar;

  /**
   * งานชิ้นนี้เป็น "นัดหมายของฝ่ายขาย" หรือไม่ — ตัดสินจาก department ของตัวงานเสมอ
   *
   * 🐛 ที่แก้ (ผู้ใช้แจ้ง: แอดมินกดแก้ไขนัดของเซลแล้วได้ฟอร์มของช่าง): เดิมเช็คจาก isSaleUser
   * = "คนที่ล็อกอินอยู่เป็นเซลไหม" ซึ่งตอบผิดคำถาม แอดมิน/ผู้จัดการเปิดเมนู "ตารางงานเซล" แล้วกด
   * นัดหนึ่งอัน ระบบก็ยังยัดฟอร์มของช่าง (มีสัญญา/ครั้งที่/ทีมเข้างาน/ออกใบส่งของ) ให้ ซึ่งพอกด
   * บันทึกจะเขียนทับ title/สี/สถานะของนัดด้วยค่าของงานช่าง
   * ✅ ถามว่า "งานนี้เป็นของแผนกไหน" แทน — คำตอบเดียวกันไม่ว่าใครเป็นคนเปิด
   */
  const isSalesEvent = (ev) => {
    const dept = ev?.department ?? ev?.extendedProps?.department;
    return String(dept || "") === DEPARTMENT.SALES;
  };
  const isAdminOrManager = can(userData, "editAnyJob");

  const userId = userData?.userId; // หรือ field ที่เก็บ id ของ user

  // งานที่ปิดแล้ว (ดำเนินการเสร็จสิ้น) และผู้ใช้ไม่ใช่ admin/manager → ล็อก แก้ไขไม่ได้อีก
  const isJobLocked = (extendedProps) =>
    extendedProps?.status === "ดำเนินการเสร็จสิ้น" && !isAdminOrManager;

  // ✅ แก้ไขได้ถ้า: เป็น admin/manager, เป็นคนเพิ่ม event เอง, ได้รับมอบหมายเข้างาน
  // (resPerson ตรงกับ ID ตัวเอง หรือ team ตรงกับชื่อตัวเอง — เผื่อ event เก่าที่ยังไม่มี resPerson)
  // หรือเป็น "ผู้รับผิดชอบ" ของงานนี้ (responsiblePersonId/responsiblePerson — คนละแนวคิดกับทีมที่เข้างาน
  // ด้านบน อาจไม่ได้เข้างานเองแต่ยังรับผิดชอบอยู่) — ⚠️ BUG ที่แก้: เดิมเช็คแค่ isAdmin (ไม่รวม manager)
  // ทำให้ manager เปิดแก้ไขงานที่ไม่ใช่ของตัวเองไม่ได้เลย ทั้งที่ทุกจุดอื่นในแอปให้สิทธิ์ manager เท่า admin
  // เดิมยังไม่เช็ค responsiblePerson เลยด้วย ทำให้คนที่ถูกตั้งเป็น "ผู้รับผิดชอบ" (แต่ไม่ได้อยู่ใน
  // team/resPerson ของครั้งนี้) เปิดหน้าแก้ไขงานตัวเองไม่ได้เลย
  // ❌ ยกเว้น: งานที่ปิดแล้ว (ดำเนินการเสร็จสิ้น) ช่างแก้ไขไม่ได้อีก มีแค่ admin/manager เท่านั้น
  // ✅ "เกี่ยวข้องกับงานนี้ไหม" — เจ้าของงาน / ผู้ถูกมอบหมายเข้างาน / หัวหน้าทีม / ผู้รับผิดชอบ
  // ⚠️ ไม่รวมลูกทีม (teamMembers) โดยตั้งใจ — ดู canViewEventAsTeamMember ด้านล่าง
  const isJobParticipant = (extendedProps) =>
    isAdminOrManager ||
    extendedProps?.userId === userId ||
    (extendedProps?.resPerson && extendedProps.resPerson === userId) ||
    (extendedProps?.team && extendedProps.team === userData?.fname) ||
    (extendedProps?.responsiblePersonId && extendedProps.responsiblePersonId === userId) ||
    (extendedProps?.responsiblePerson && extendedProps.responsiblePerson === userData?.fname);

  const canEditEvent = (extendedProps) => {
    if (isJobLocked(extendedProps)) {
      return false;
    }
    return isJobParticipant(extendedProps);
  };

  // ✅ "ลูกทีม" ที่มีชื่ออยู่ในงานนี้ — เปิดดูรายละเอียดงานได้ แต่แก้ไขไม่ได้ (ฟอร์มล็อกให้เองทุกช่อง
  // ดู isTeamMemberViewer ใน EditEvent.js) จงใจแยกจาก canEditEvent ด้านบน ไม่รวมเข้าไปในนั้น เพราะ
  // canEditEvent ถูกใช้คุม "การแก้ไข" อีกหลายทาง (ลาก/ย่อขยายงานบนปฏิทิน, ลากไปแผนล่วงหน้า) ซึ่งลูกทีม
  // ต้องทำไม่ได้ — ถ้าเผลอรวมเข้าไป ลูกทีมจะลากงานเปลี่ยนวันได้ทันทีทั้งที่ตั้งใจให้ดูอย่างเดียว
  const canViewEventAsTeamMember = (extendedProps) =>
    (extendedProps?.teamMembers || []).some(
      (m) => (m?.userId && m.userId === userId) || (m?.name && m.name === userData?.fname)
    );

  /**
   * 🐛 BUG ที่แก้ (บางงานที่มีชื่อตัวเองอยู่ กดเข้าไปดูไม่ได้ เด้ง "คุณไม่มีสิทธิ์ดูแผนงานนี้"):
   * เดิมใช้ canEditEvent ตัวเดียวตัดสินทั้ง "แก้ได้" และ "เปิดดูได้" — แต่ canEditEvent คืน false ทันที
   * ถ้างานถูกล็อก (isJobLocked = ปิดงานแล้ว และไม่ใช่ admin/manager) ผลคือช่างที่เป็นหัวหน้าทีม/
   * ผู้รับผิดชอบ/คนสร้างงานเอง เปิดดูงานที่ "ตัวเองเพิ่งทำเสร็จ" ไม่ได้อีกเลย ทั้งที่ควรย้อนดูวันที่/
   * รายละเอียด/เอกสารของงานตัวเองได้ตลอด (และมักต้องดูตอนตามเรื่องเอกสาร/วางบิลหลังปิดงานด้วยซ้ำ)
   * ✅ แยก "เปิดดู" ออกมาเป็นสิทธิ์ของตัวเอง — ใครก็ตามที่เกี่ยวข้องกับงาน (รวมลูกทีม) เปิดดูได้เสมอ
   * ไม่ว่างานจะปิดแล้วหรือยัง ส่วนการ "แก้ไข" ยังใช้ canEditEvent เดิมที่ล็อกไว้ทุกประการ
   * ⚠️ ต้องไม่เอาไปใช้คุมการลาก/ย่อขยายงานบนปฏิทินเด็ดขาด — จุดพวกนั้นต้องใช้ canEditEvent เท่านั้น
   */
  // ✅ เซลที่เปิดดูตารางช่าง เปิดดูได้ทุกงาน (แต่แก้ไม่ได้เลย — ดู isServiceObserver)
  // ⚠️ ห้ามเอาไปรวมใน canEditEvent เด็ดขาด เพราะตัวนั้นคุมการลาก/ย่อขยายงานบนปฏิทินด้วย
  const canViewEvent = (extendedProps) =>
    isServiceObserver || isJobParticipant(extendedProps) || canViewEventAsTeamMember(extendedProps);

  const [events, setEvents] = useState([]);

  const [defaultTextColor, setDefaultTextColor] = useState("#FFFFFF"); // สีข้อความเริ่มต้น
  // ⚠️ เดิมใช้สีแดง #dc2626 (สีแบรนด์หลัก) เป็นค่าเริ่มต้น แต่สีแดงตอนนี้ถูกใช้สื่อความหมายอื่นไปแล้ว
  // ในปฏิทิน (กรอบประ = "ไม่อนุมัติ", วันหยุดราชการ) ทำให้งานใหม่ที่ยังไม่ได้เปลี่ยนสีเองปนกับสอง
  // อย่างนั้นจนแยกไม่ออกว่าคืองานอะไรกันแน่ — เปลี่ยนเป็นสีม่วงคราม #6366f1 แทน (สีเดียวกับไอคอน
  // แจ้งเตือน "งานใหม่" ใน NotificationBell.js) ให้สื่อว่า "งานใหม่" ตรงกันทั้งแอป ไม่ชนความหมายเดิม
  const [defaultBackgroundColor, setDefaultBackgroundColor] =
    useState("#6366f1"); // สีพื้นหลังเริ่มต้น

  const [defaultFontSize, setDefaultFontSize] = useState(8); //

  const [loading, setLoading] = useState(false); // เพิ่มสถานะการโหลด

  const [searchTerm, setSearchTerm] = useState(""); // 🔍 State สำหรับค้นหา
  const [selectedTechnician, setSelectedTechnician] = useState(""); // "" = ทุกคน, ไม่งั้นเก็บ _id
  const [selectedStatus, setSelectedStatus] = useState(""); // "" = ทุกสถานะ
  const [selectedJobType, setSelectedJobType] = useState(""); // "" = ทุกประเภทงาน (event.title)
  const [selectedSystem, setSelectedSystem] = useState(""); // "" = ทุกระบบ (event.system)
  const [selectedApproval, setSelectedApproval] = useState(""); // "" = ทุกสถานะอนุมัติ / "pending" / "rejected"
  const [showFilterPanel, setShowFilterPanel] = useState(false); // ✅ ซ่อนตัวกรองไว้ ไม่ให้เกะกะจอมือถือโดย default
  // ✅ ใช้แค่สลับหน้าตา/ข้อความของปุ่ม "กาง/ย่อทั้งหมด" เท่านั้น — สถานะจริงของแต่ละการ์ดอยู่ใน DOM
  // และ cardPrefs (ดู toggleAllCards) ที่ตั้งใจไม่ผูกกับ React เพื่อไม่ให้ปฏิทิน re-render
  // ⚠️ ต้อง loadCardPrefs ก่อนอ่านค่า — useState initializer ทำงานก่อน useEffect ทุกตัว และ
  // eventContent ก็ถูกเรียกตั้งแต่ render แรก ถ้าโหลดใน useEffect จะได้ค่า default ผิดไปหนึ่งจังหวะ
  // (การ์ดกางแวบหนึ่งแล้วค่อยพับ) ซึ่งเห็นได้ชัดมาก
  /**
   * 📱 ความกว้างคอลัมน์ของปฏิทินเดือนบนมือถือ (px ต่อ 1 วัน) + ปุ่มย่อ/ขยาย
   *
   * 🐛 ปัญหาที่แก้: จอ ~390px หาร 7 วัน = คอลัมน์ละ ~50px — ไม่ว่าจะลดขนาดตัวหนังสือแค่ไหน
   * ข้อความก็ถูกหั่นทีละตัวอักษรจนการ์ดสูง 300px อ่านไม่ออกอยู่ดี เพราะปัญหาคือ "ความกว้างไม่พอ"
   * ไม่ใช่ "ตัวหนังสือใหญ่ไป"
   * ✅ ให้ตารางมีความกว้างขั้นต่ำของตัวเอง แล้วปัดเลื่อนดูแนวนอนได้ — คอลัมน์กว้างพอให้อ่านรายละเอียด
   * ครบทุกบรรทัดจริงๆ แล้วให้ผู้ใช้ปรับเองได้ว่าจะเอากว้าง (อ่านง่าย) หรือแคบ (เห็นหลายวันพร้อมกัน)
   * ⚠️ จำค่าไว้ต่อผู้ใช้ — คนละคนถนัดคนละแบบ และคนเดิมไม่ควรต้องมาปรับใหม่ทุกครั้งที่เปิดแอป
   */
  const MOBILE_COL_KEY = "eventCalendar.mobileZoom.";
  /**
   * ระดับการซูมของตารางเดือนบนมือถือ — ระดับแรก (0) คือ "พอดีจอ"
   *
   * 🐛 ปัญหาที่แก้: เดิมค่าเริ่มต้นบังคับคอลัมน์กว้าง 108px ทำให้ตารางกว้างเกินจอตั้งแต่เปิดมา ต้องปัด
   * ซ้าย-ขวาตลอดเวลา และการ์ดของวันที่อยู่ริมจอถูกตัดครึ่งค้างไว้ ("เลยหน้าจอ")
   * ✅ ค่าเริ่มต้น = 0 = ไม่บังคับความกว้างเลย ตารางจึงพอดีจอเป๊ะ เห็นครบ 7 วันโดยไม่ต้องปัด
   * ✅ อยากอ่านรายละเอียดชัดๆ ค่อยกด + ทีละระดับ (แล้วค่อยปัดดู) — เลือกเองได้ตามสถานการณ์
   * ⚠️ เก็บเป็น "ระดับ" ไม่ใช่ตัวเลข px — ระดับ 0 ต้องหมายถึงพอดีจอเสมอไม่ว่าจอกว้างเท่าไหร่
   */
  const MOBILE_ZOOM_STEPS = [0, 95, 120, 150, 185, 220];
  const [mobileZoom, setMobileZoom] = useState(() => {
    try {
      const raw = localStorage.getItem(MOBILE_COL_KEY + (userData?.userId || "anonymous"));
      const n = Number(raw);
      if (Number.isInteger(n) && n >= 0 && n < MOBILE_ZOOM_STEPS.length) return n;
    } catch { /* อ่านไม่ได้ก็ใช้ค่าเริ่มต้น */ }
    return 0; // พอดีจอ
  });
  const mobileColW = MOBILE_ZOOM_STEPS[mobileZoom];
  const changeMobileCol = (dir) => {
    setMobileZoom((prev) => {
      const next = Math.min(MOBILE_ZOOM_STEPS.length - 1, Math.max(0, prev + dir));
      try {
        localStorage.setItem(MOBILE_COL_KEY + (userData?.userId || "anonymous"), String(next));
      } catch { /* โควตาเต็ม/โหมดส่วนตัว — ใช้งานรอบนี้ได้ตามปกติ */ }
      // ⚠️ ความกว้างเปลี่ยน = ความสูงของทุกการ์ดเปลี่ยนตาม ต้องให้ปฏิทินวัด/จัดแถวใหม่
      requestAnimationFrame(() => calendarRef.current?.getApi()?.updateSize());
      return next;
    });
  };

  const [allCardsExpanded, setAllCardsExpanded] = useState(() => {
    loadCardPrefs(userData?.userId);
    return cardPrefs.def;
  });
  // ✅ สลับผู้ใช้ (ล็อกเอาต์แล้วเข้าใหม่คนละคนบนเครื่องเดียวกัน) ต้องได้ค่าของคนใหม่ ไม่ใช่ค่าที่ค้างจาก
  // คนก่อนหน้า — initializer ด้านบนทำงานครั้งเดียวตอน mount เท่านั้น จึงต้องมีตัวนี้คู่กัน
  useEffect(() => {
    loadCardPrefs(userData?.userId);
    setAllCardsExpanded(cardPrefs.def);
  }, [userData?.userId]);

  // ✅ งาน "วางแผนล่วงหน้า" (ยังไม่ลงตาราง) — เก็บแยกจาก events ปกติเสมอ (backend ก็แยก query ให้
  // อยู่แล้ว) จัดกลุ่มดูทีละเดือนผ่าน draftMonth เริ่มที่เดือนปัจจุบัน
  const [drafts, setDrafts] = useState([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [showDraftsPanel, setShowDraftsPanel] = useState(false);
  const [draftMonth, setDraftMonth] = useState(moment().format("YYYY-MM"));
  // ✅ ?draft=<id>&month=YYYY-MM — ใช้ตอนกดลิงก์ "📌 รอวางแผน" จากตาราง ภาพรวมสัญญา (ContractOverview.js)
  // พาไปเจาะจงงานนั้นในแผงงานล่วงหน้าเลย แทนที่จะต้องมาไล่หาเองว่าอยู่เดือนไหน/หน้าไหน
  const [highlightDraftId, setHighlightDraftId] = useState("");

  // ✅ คัดลอก/วาง event — เก็บเป็น state เฉยๆ (ไม่ persist ข้าม reload) คัดลอกจากงานที่ลงตารางแล้ว
  // (ปุ่มใน EditEvent.js) หรือจากแผนงานล่วงหน้า (เมนู "···" ใน UnscheduledPanel.js) ก็ได้ ค้างอยู่ได้
  // จนกว่าจะกดยกเลิกเอง หรือคัดลอกทับด้วยงานอื่น — ไม่ auto clear หลังวางครั้งเดียว เพื่อวางซ้ำได้หลายวัน
  const [clipboardEvent, setClipboardEvent] = useState(null);

  const calendarRef = useRef(null);
  // ตัวช่วย "เปลี่ยนสถานะการ์ดแล้วจัดแถวใหม่พร้อมอนิเมชัน" — ถูกเซ็ตค่าจริงใน useEffect ของปุ่มพับ/กาง
  // (ต้องอยู่ใน ref เพราะ toggleAllCards อยู่คนละ scope กับตัวช่วยที่ประกาศไว้ใน useEffect นั้น)
  const ecReflowRef = useRef((fn) => fn());
  // ✅ กล่องครอบปฏิทิน — ใช้เป็นพื้นที่รับการปัดซ้าย-ขวาเปลี่ยนเดือนบนมือถือ ต้องเป็น element ของ React
  // เอง (ไม่ใช่ element ข้างในที่ FullCalendar สร้าง/ทิ้งใหม่เองตอนสลับมุมมอง) ดูเหตุผลเต็มที่ useEffect
  // ที่ผูก touch event ด้านล่าง
  const swipeAreaRef = useRef(null);
  // ✅ ใช้เช็คว่าตอนลากงานจากปฏิทินจริงออกมา (eventDragStop) ปล่อยเมาส์ทับแผงนี้หรือเปล่า
  // ถ้าใช่ = ลากกลับไปเป็นงานวางแผนล่วงหน้า (ดู handleEventDragStop ด้านล่าง)
  const draftsPanelRef = useRef(null);
  // ✅ เปิดแผงงานล่วงหน้าให้อัตโนมัติแค่ตอนโหลดครั้งแรกสุดถ้ามีงานอยู่จริง (ดู fetchDrafts) —
  // ป้องกันไม่ให้ auto เปิดซ้ำทับการปิดเองของผู้ใช้ทุกครั้งที่ fetch ใหม่ (เช่น silent refresh 30s)
  const hasAutoOpenedDraftsRef = useRef(false);

  // ⚠️ deps มี viewingDept — สลับเมนู "ตารางงานช่าง" ↔ "ตารางงานเซล" เปลี่ยนแค่ query param
  // โดยไม่ remount หน้า ถ้าไม่ใส่ deps ปฏิทินจะค้างข้อมูลของแผนกเดิมจนกว่าจะรีเฟรช
  useEffect(() => {
    fetchEventsFromDB();
    fetchDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingDept]);

  // ✅ ?draft=<id>&month=YYYY-MM (+ ?t=nonce กันกดลิงก์ซ้ำงานเดิมไม่เห็นผล) — เปิดแผงงานล่วงหน้า
  // สลับไปเดือนที่ถูกต้องให้อัตโนมัติ แล้วส่ง highlightDraftId ลงไปให้ UnscheduledPanel เลื่อนจอ/
  // ไฮไลต์การ์ดนั้นเอง (ดู UnscheduledPanel.js) — deps: [searchParams] ไม่ใช่ mount-only เพราะกดลิงก์
  // ซ้ำจากหน้าเดิม (React Router ไม่ remount) ต้องทำงานซ้ำได้ทุกครั้งที่ query เปลี่ยน
  useEffect(() => {
    const draftParam = searchParams.get("draft");
    const monthParam = searchParams.get("month");
    if (!draftParam) return;
    setShowDraftsPanel(true);
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      setDraftMonth(monthParam);
      calendarRef.current?.getApi()?.gotoDate(moment(monthParam, "YYYY-MM").format("YYYY-MM-DD"));
    }
    setHighlightDraftId(`${draftParam}|${searchParams.get("t") || Date.now()}`);
  }, [searchParams]);

  // ✅ ?event=<id>&date=YYYY-MM-DD (+ ?t=nonce) — เปิดปฏิทินไปที่เดือนของงานนั้นแล้วไฮไลต์การ์ดให้เห็น
  // ชัดสักครู่ ใช้กับปุ่ม "ดูในปฏิทิน" จากหน้าการดำเนินงาน/แผงรออนุมัติ ซึ่งเดิมไม่มีทางลิงก์มาที่ปฏิทิน
  // แบบเจาะจงงานได้เลย (มีแต่ ?draft= สำหรับงานที่ยังไม่ลงตาราง) ต้องมาไล่หาวันเองทุกครั้ง
  // ⚠️ deps: [searchParams] เหมือน ?draft= ด้านบน — กดลิงก์ซ้ำงานเดิมต้องทำงานซ้ำได้ (React Router
  // ไม่ remount หน้าเดิม) จึงต้องมี nonce ใน state ด้วย ไม่งั้นค่าเดิมทำให้ไม่มีอะไรเกิดขึ้น
  const [highlightEventId, setHighlightEventId] = useState(null);
  useEffect(() => {
    const eventParam = searchParams.get("event");
    if (!eventParam) return undefined;
    const dateParam = searchParams.get("date");
    if (dateParam && moment(dateParam, "YYYY-MM-DD", true).isValid()) {
      calendarRef.current?.getApi()?.gotoDate(dateParam);
    }
    setHighlightEventId(eventParam);
    // ✅ ถอดไฮไลต์เองหลัง 6 วิ — เป็นแค่ตัวช่วย "สะกิดตา" ตอนเพิ่งกดมา ไม่ใช่สถานะถาวรที่ต้องค้างไว้
    const t = setTimeout(() => setHighlightEventId(null), 6000);
    return () => clearTimeout(t);
  }, [searchParams]);

  /**
   * ✅ เลื่อนหน้าจอไปหางานที่ถูกลิงก์มาให้เอง
   * 🐛 ที่แก้: เดิมกด "ดูในปฏิทิน" แล้วปฏิทินเปลี่ยนไปเดือนที่ถูกต้องและใส่กรอบกะพริบให้จริง — แต่ไม่มี
   * อะไรพาสายตาไปถึงงานนั้น ปฏิทินเดือนหนึ่งสูงเกินหนึ่งหน้าจอเสมอ ถ้างานอยู่สัปดาห์ท้ายๆ ก็ตกอยู่ใต้
   * ขอบจอ ผู้ใช้เห็นแค่ปฏิทินเปล่าๆ แล้วต้องไล่เลื่อนหาเองอยู่ดี = ปุ่มแทบไม่ได้ช่วยอะไร
   * ⚠️ ต้องรอ FullCalendar เรนเดอร์เดือนใหม่ให้เสร็จก่อนถึงจะหา element เจอ และบางครั้งข้อมูลยังโหลด
   * ไม่เสร็จด้วยซ้ำ — จึงวนหาซ้ำทุก 100ms แทนการ setTimeout ครั้งเดียวแบบเดาเวลา (เดาสั้นไปก็ไม่เจอ
   * เดายาวไปก็รู้สึกหน่วง) เจอเมื่อไหร่หยุดทันที และเลิกหาเองหลัง ~3 วิ กันวนไม่จบถ้างานไม่อยู่ในเดือนนั้นจริง
   * ⚠️ อ้างอิงจาก class ที่ eventClassNames ใส่ให้ (.fc-event-linked-highlight) — เป็นตัวเดียวที่
   * ผูกกับ "งานที่ถูกไฮไลต์" อยู่แล้ว ไม่ต้องเพิ่ม data attribute ใหม่ให้ทุก event ทั้งปฏิทิน
   */
  useEffect(() => {
    if (!highlightEventId) return undefined;
    let tries = 0;
    const timer = setInterval(() => {
      const el = document.querySelector(".fc-event-linked-highlight");
      if (el) {
        clearInterval(timer);
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      } else if (++tries > 30) {
        clearInterval(timer);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [highlightEventId]);

  // ✅ FullCalendar v6 มี ResizeObserver ของตัวเองบน .fc คอยจับขนาด container ที่เปลี่ยนอยู่แล้ว
  // แต่โค้ดชุดนี้ไม่เคยถูกทดสอบกับการ "ย่อความกว้าง container ด้วย CSS" มาก่อน (เดิมปฏิทินกว้างเต็ม
  // จอเสมอ) — ตอนนี้เปิด/ปิดคอลัมน์งานวางแผนล่วงหน้าทำให้ .calendar-wrapper แคบ/กว้างขึ้นได้ สั่ง
  // updateSize() ซ้ำอีกชั้นหลังอนิเมชัน CSS จบ (~0.22s) กันตารางวัน/ความสูงแถวค้างค่าความกว้างเดิม
  // เป็นการเรียกที่ราคาถูกมาก เรียกเกินไม่มีผลเสีย ครอบคลุมทุกจุดที่ setShowDraftsPanel(true/false)
  useEffect(() => {
    const t = setTimeout(() => calendarRef.current?.getApi()?.updateSize(), 260);
    return () => clearTimeout(t);
  }, [showDraftsPanel]);

  // ✅ Realtime: รีเฟรชข้อมูลเงียบๆ ทุก 30 วินาที เพื่อให้เห็นการเปลี่ยนแปลง
  // จากคนอื่น (เพิ่ม/แก้ไข/ลบ event) โดยไม่ต้องกดรีเฟรชหน้าเอง
  useEffect(() => {
    const interval = setInterval(() => {
      fetchEventsFromDB(true);
      fetchDrafts(true);
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const today = moment().format("YYYY-MM-DD");

    // ⚠️ เดิมเช็ค event.extendedProps?.status ซึ่งใน state ธรรมดา (ก่อนส่งเข้า FullCalendar)
    // extendedProps มีแค่ userId/lastModifiedBy/startTime/endTime เท่านั้น ไม่มี status เลย
    // ทำให้เงื่อนไขนี้เป็นจริงเสมอ (undefined !== "กำลังดำเนินการ") และงานทุกงานของวันนี้
    // (รวมถึงงานที่ปิดแล้ว "ดำเนินการเสร็จสิ้น") ถูกดันสถานะกลับเป็น "กำลังดำเนินการ" ซ้ำๆ ทุกครั้งที่ fetch
    // แก้เป็นเช็คจาก event.status (ค่าจริงที่ top-level) และเปลี่ยนอัตโนมัติเฉพาะงานที่ "ยืนยันแล้ว" เท่านั้น
    // (ไม่แตะงานที่ปิดแล้ว/กำลังดำเนินการอยู่แล้ว/ยังไม่ยืนยัน)
    const eventsToUpdate = events.filter((event) => {
      const eventStartDate = moment(event.start).format("YYYY-MM-DD");
      return (
        eventStartDate === today &&
        !event.manualStatus &&
        event.status === "ยืนยันแล้ว" &&
        // ✅ งานที่ยังรออนุมัติ/ถูกปฏิเสธ ไม่ควรถูกดันสถานะอัตโนมัติ — ทำให้ดูเหมือนงานกำลังดำเนินการ
        // จริงทั้งที่ยังไม่ผ่านการอนุมัติเลย (backend อนุญาตให้ผ่านสถานะนี้อยู่แล้ว แต่ไม่ควรสับสน
        // ป้าย "⏳ รออนุมัติ" ที่โชว์อยู่บนการ์ด)
        getApprovalState(event) === "approved"
      );
    });

    if (eventsToUpdate.length === 0) return;

    const updatedEvents = events.map((event) => {
      const match = eventsToUpdate.find((e) => e.id === event.id);
      return match
        ? {
            ...event,
            status: "กำลังดำเนินการ",
            extendedProps: {
              ...event.extendedProps,
              status: "กำลังดำเนินการ",
            },
            manualStatus: false,
          }
        : event;
    });

    setEvents(updatedEvents);

    Promise.all(
      eventsToUpdate.map((event) =>
        EventService.UpdateEvent(event.id, {
          status: "กำลังดำเนินการ",
          manualStatus: false,
        }),
      ),
    )
      .then(() => {
        console.log("✅ อัปเดตสถานะเรียบร้อย");
      })
      .catch((error) => {
        console.error("❌ อัปเดตสถานะไม่สำเร็จ:", error);
      });
  }, [events]);

  useEffect(() => {
    // 🐛 BUG ที่แก้ (ปัดเปลี่ยนเดือนบนมือถือไม่ทำงานเลย — แก้มาแล้ว 2 รอบยังไม่หาย):
    // รอบก่อนๆ ใช้ไลบรารี Hammer ซึ่งต้องไปตั้ง CSS touch-action ให้ element ที่มันเกาะอยู่ เพื่อ "ยึด"
    // การลากแนวนอนมาจากเบราว์เซอร์ — แต่ปฏิทิน FullCalendar มีกล่องเลื่อน (.fc-scroller) ของตัวเอง
    // ซ้อนอยู่ข้างในหลายชั้น พอนิ้วเริ่มแตะบนกล่องพวกนั้น การลากแนวนอนจะถูกกล่องข้างในกินไปก่อน
    // Hammer จึงไม่เคยได้รับ swipe เลย ซ้ำการตั้ง touch-action ยังไปรบกวนการหุบ/กางนิ้วซูมอีก
    // ✅ เลิกใช้ Hammer สำหรับปฏิทิน เปลี่ยนมาอ่าน touch event ตรงๆ แทน โดย:
    //    1) ไม่ตั้ง touch-action และไม่เรียก preventDefault เลยสักจุด → การเลื่อนขึ้น-ลงและการหุบ/กาง
    //       นิ้วซูม ยังเป็นหน้าที่ของเบราว์เซอร์ 100% เหมือนตอนไม่มีโค้ดนี้อยู่
    //    2) ตัดสินว่า "ปัด" หรือไม่ ตอนปล่อยนิ้ว (touchend) จากระยะทางรวม ไม่ใช่ระหว่างลาก → ต่อให้
    //       กล่องข้างในจะกินการลากไปเลื่อนตัวเองด้วยก็ไม่กระทบ เพราะเราแค่ "ดู" ไม่ได้ไปแย่ง
    //    3) ฟังแบบ passive:true → เบราว์เซอร์ไม่ต้องรอโค้ดเราตัดสินใจก่อนเลื่อนจอ ไม่หน่วง
    const calendarEl = swipeAreaRef.current;
    if (!calendarEl) return;

    // ✅ อนิเมชันเลื่อนเข้าตามทิศทางที่ปัด — เดิมเดือนเปลี่ยนแบบตัดภาพทันที ปัดแล้วไม่แน่ใจว่าเปลี่ยนไหม
    const animate = (dir) => {
      const viewEl = calendarEl.querySelector(".fc-view-harness");
      if (!viewEl) return;
      viewEl.classList.remove("ec-slide-in-left", "ec-slide-in-right");
      // อ่าน offsetWidth เพื่อบังคับให้เบราว์เซอร์ commit การถอด class ก่อน (reflow) ไม่งั้นการใส่
      // class เดิมกลับเข้าไปทันทีในเฟรมเดียวกันจะไม่ถูกมองว่าเป็นการเริ่มอนิเมชันใหม่ = ปัดรัวๆ แล้วนิ่ง
      void viewEl.offsetWidth;
      viewEl.classList.add(dir === "next" ? "ec-slide-in-left" : "ec-slide-in-right");
    };

    // เกณฑ์ตัดสิน: ต้องลากแนวนอนอย่างน้อย 45px, แนวนอนต้องมากกว่าแนวตั้งชัดเจน (กันเลื่อนอ่านขึ้น-ลง
    // แล้วเผลอเปลี่ยนเดือน) และต้องจบภายใน 800ms (ลากค้างนานๆ = ตั้งใจเลื่อนดู ไม่ใช่ปัดเปลี่ยนหน้า)
    const MIN_DISTANCE = 45;
    const MAX_DURATION = 800;
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let tracking = false;

    // 🐛 BUG ที่แก้ (ซูมขยายปฏิทินแล้วปัดเลื่อนดูทีไร เปลี่ยนเดือนหนีทุกที): ตั้งแต่ตารางเดือนบนมือถือ
    // มีความกว้างของตัวเอง (ปัดเลื่อนดูแนวนอนได้ — ดู --ec-m-col) การลากแนวนอนมีความหมาย 2 อย่าง
    // ทับกัน คือ "เลื่อนดูวันอื่นในสัปดาห์" กับ "เปลี่ยนเดือน" ซึ่งผู้ใช้ตั้งใจอย่างแรกแทบทุกครั้ง
    // ✅ ถ้าเริ่มลากในกล่องที่เลื่อนแนวนอนได้ ให้ถือว่าการลากนั้นเป็นของกล่อง ไม่ใช่การเปลี่ยนเดือน —
    // เปลี่ยนเดือนใช้ปุ่ม ‹ › ที่อยู่บนหัวปฏิทินตรงนั้นอยู่แล้ว ชัดเจนกว่าและไม่พลาด
    // ⚠️ ยังปัดเปลี่ยนเดือนได้ตามปกติทุกที่ที่ไม่มีอะไรให้เลื่อนแนวนอน (จอคอม/มุมมองรายการ/ย่อจน
    // ตารางพอดีจอ) — พฤติกรรมเดิมจึงไม่หายไปไหน
    const scrollableXAt = (target) => {
      let el = target;
      while (el && el !== calendarEl) {
        if (el.scrollWidth - el.clientWidth > 4) {
          const ox = getComputedStyle(el).overflowX;
          if (ox === "auto" || ox === "scroll") return el;
        }
        el = el.parentElement;
      }
      return null;
    };

    const onTouchStart = (e) => {
      // นิ้วเดียวเท่านั้น — 2 นิ้วขึ้นไปคือกำลังหุบ/กางเพื่อซูม ต้องไม่ตีความเป็นการปัดเปลี่ยนเดือน
      if (e.touches.length !== 1) { tracking = false; return; }
      if (scrollableXAt(e.target)) { tracking = false; return; }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTime = Date.now();
      tracking = true;
    };
    // นิ้วที่ 2 แตะเพิ่มระหว่างทาง (เริ่มซูม) → ยกเลิกการนับเป็นการปัดทันที
    const onTouchMove = (e) => { if (e.touches.length > 1) tracking = false; };
    const onTouchEnd = (e) => {
      if (!tracking) return;
      tracking = false;
      const touch = e.changedTouches?.[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (Date.now() - startTime > MAX_DURATION) return;
      if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) <= Math.abs(dy) * 1.5) return;

      if (dx < 0) {
        calendarRef.current?.getApi().next();
        animate("next");
      } else {
        calendarRef.current?.getApi().prev();
        animate("prev");
      }
    };

    const opts = { passive: true };
    calendarEl.addEventListener("touchstart", onTouchStart, opts);
    calendarEl.addEventListener("touchmove", onTouchMove, opts);
    calendarEl.addEventListener("touchend", onTouchEnd, opts);
    calendarEl.addEventListener("touchcancel", onTouchEnd, opts);
    return () => {
      calendarEl.removeEventListener("touchstart", onTouchStart);
      calendarEl.removeEventListener("touchmove", onTouchMove);
      calendarEl.removeEventListener("touchend", onTouchEnd);
      calendarEl.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  /* ── กันเปิดฟอร์มจากการแตะที่ไม่ได้ตั้งใจ ─────────────────────────────────────────────────
     🐛 อาการที่ผู้ใช้แจ้ง 2 อย่าง ซึ่งมีรากเดียวกัน:
       1) ซูมด้วย 2 นิ้วแล้วฟอร์ม "เพิ่มแผนงาน"/"แก้ไขงาน" เด้งขึ้นมาเอง
       2) แตะโดนนิดเดียว (เช่นระหว่างปัดเลื่อนดู) ฟอร์มเพิ่มแผนงานก็เด้งแล้ว
     ⚠️ ราก: FullCalendar ตัดสินว่า "แตะ" จากนิ้วที่อยู่นิ่ง แล้วยิง dateClick/eventClick เอง
     ไม่ได้รอ click ของเบราว์เซอร์ (ซึ่งจะไม่ยิงหลัง pinch/scroll อยู่แล้ว) จึงกันด้วย preventDefault
     ที่ระดับเบราว์เซอร์ไม่ได้ ต้องมาตัดสินเองว่าการสัมผัสครั้งนั้น "เป็นการแตะจริงหรือเปล่า"
     ✅ นับว่าเป็นการแตะจริงก็ต่อเมื่อ: นิ้วเดียว · ขยับไม่เกิน 12px · ไม่เกิน 700ms · หน้าจอไม่ได้เลื่อน
     ถ้าไม่เข้าเกณฑ์ → ปิดการเปิดฟอร์มไว้ 500ms (เผื่อ event ที่ค้างในคิวยิงตามมาทีหลัง)
     ⚠️ "กดค้างแล้วเปลี่ยนใจปล่อยเฉยๆ" ไม่พึ่งเกณฑ์ 700ms นี้แล้ว — ตอนที่การลากจัดลำดับจับติดจริง
     มันจะสั่งปิดการเปิดฟอร์มเองทันที (ดู beginDrag) เพราะเวลากดค้างถูกลดเหลือ 240ms ซึ่งสั้นกว่า
     700ms มาก การพึ่งลำดับเวลาสองค่านี้จึงใช้ไม่ได้อีกต่อไป */
  const suppressUntilRef = useRef(0);
  useEffect(() => {
    const COOLDOWN = 500;
    const MOVE_SLOP = 12;
    const MAX_TAP_MS = 700;
    let st = null; // { x, y, t, scrollY, multi }

    const scrollPos = () => {
      const sc = document.querySelector(".fc-scroller");
      return (window.scrollY || 0) + (sc ? sc.scrollTop : 0);
    };
    const block = () => { suppressUntilRef.current = Date.now() + COOLDOWN; };

    const onStart = (e) => {
      if (!e.touches) return;
      if (e.touches.length > 1) {
        // นิ้วที่ 2 ลง = กำลังซูม — ปิดไว้จนกว่าจะยกครบแล้วพ้น cooldown
        if (st) st.multi = true;
        suppressUntilRef.current = Infinity;
        return;
      }
      const t = e.touches[0];
      st = { x: t.clientX, y: t.clientY, t: Date.now(), scrollY: scrollPos(), multi: false };
    };

    const onMove = (e) => {
      if (!st || !e.touches || e.touches.length !== 1) return;
      const t = e.touches[0];
      if (Math.abs(t.clientX - st.x) > MOVE_SLOP || Math.abs(t.clientY - st.y) > MOVE_SLOP) {
        st.moved = true;
      }
    };

    const onEnd = (e) => {
      if (e.touches && e.touches.length > 0) return; // ยังมีนิ้วเหลือ ยังไม่จบท่า
      if (suppressUntilRef.current === Infinity) {
        suppressUntilRef.current = Date.now() + COOLDOWN;
        st = null;
        return;
      }
      if (!st) return;
      const tooLong = Date.now() - st.t > MAX_TAP_MS;
      const scrolled = Math.abs(scrollPos() - st.scrollY) > 2;
      if (st.multi || st.moved || tooLong || scrolled) block();
      st = null;
    };

    // capture + passive — แค่สังเกตการณ์ ไม่ขวางการซูม/เลื่อนของเบราว์เซอร์
    const opts = { capture: true, passive: true };
    document.addEventListener("touchstart", onStart, opts);
    document.addEventListener("touchmove", onMove, opts);
    document.addEventListener("touchend", onEnd, opts);
    document.addEventListener("touchcancel", onEnd, opts);
    return () => {
      document.removeEventListener("touchstart", onStart, true);
      document.removeEventListener("touchmove", onMove, true);
      document.removeEventListener("touchend", onEnd, true);
      document.removeEventListener("touchcancel", onEnd, true);
    };
  }, []);
  /** true = สัมผัสครั้งล่าสุดไม่ใช่ "การแตะที่ตั้งใจ" (ซูม/ปัด/กดค้าง) → อย่าเพิ่งเปิดฟอร์ม */
  const isPinching = useCallback(() => Date.now() < suppressUntilRef.current, []);

  // ⚠️ generateWorkPermitPDF (+ Functions/GenPDF.js) ถูกลบทิ้งแล้ว — ใบแจ้งเข้าปฏิบัติงานย้ายไปออก
  // ผ่านกล่อง WorkNoticeDialog แบบเดียวกับใบส่งมอบงาน (ดู workNoticeJob ด้านล่าง) ซึ่งแก้ไขทุกช่องได้
  // ก่อนออกจริง ต่างจากของเดิมที่ยิง PDF ออกทันทีจาก toast ที่หายเองใน 5 วินาที

  // ✅ เดิมแดงสด/ฟ้า/เทา ไม่ตรงกับธีมสีแดงจากโลโก้ที่ใช้ทั่วแอป — ปรับให้อยู่ในโทนแดงเดียวกันหมด
  // แต่ยังไล่เฉดอ่อน-เข้มต่างกันพอให้แยกประเภทวันหยุดออกจากกันได้อยู่
  const HOLIDAY_COLORS = {
    public: "#dc2626", // วันหยุดราชการ — แดงหลักของธีม
    bank: "#7f1d1d", // วันหยุดธนาคาร — แดงเข้ม (ปลายไล่เฉดเดียวกับปุ่ม/แบรนด์)
    default: "#f87171", // อื่น ๆ — แดงอ่อน
  };

  const mapHolidayType = (type) => {
    if (!type) return "default";
    if (type.includes("ราชการ")) return "public";
    if (type.includes("ธนาคาร")) return "bank";
    return "default";
  };

  const fetchThaiHolidaysFromAPI = async () => {
    try {
      const { data } = await API.get("/holidays");

      // ✅ ตรวจสอบโครงสร้างข้อมูลที่ API ส่งมา
      let holidays = null;
      if (Array.isArray(data?.holidays)) {
        holidays = data.holidays;
      } else if (Array.isArray(data?.data)) {
        holidays = data.data;
      } else if (Array.isArray(data?.result?.data)) {
        holidays = data.result.data;
      } else if (Array.isArray(data)) {
        holidays = data;
      }

      if (!Array.isArray(holidays)) {
        console.warn("⚠️ โครงสร้างข้อมูลวันหยุดไม่ถูกต้อง:", data);
        return [];
      }

      // ✅ map ให้เป็นรูปแบบที่ FullCalendar ใช้ได้
      return holidays.map((h, idx) => ({
        id: h.id || h._id || `holiday-${idx}`, // ✅ ใส่ id ให้แน่ใจว่า unique
        title: h.name_thai || h.name || "ไม่ระบุชื่อวันหยุด",
        start: h.date || h.Date || null,
        color: HOLIDAY_COLORS[mapHolidayType(h.type)],
        extendedProps: {
          type: h.type || "public",
          isHoliday: true,
          raw: h,
        },
      }));
    } catch (error) {
      console.error(
        "❌ Error fetching holidays:",
        error.response?.status,
        error.response?.data || error.message,
      );

      // ✅ fallback mock data
      return [
        {
          title: "วันปีใหม่",
          start: "2026-01-01",
          color: HOLIDAY_COLORS.public,
          extendedProps: { type: "public" },
        },
        {
          title: "วันสงกรานต์",
          start: "2026-04-13",
          color: HOLIDAY_COLORS.public,
          extendedProps: { type: "public" },
        },
      ];
    }
  };

  const fetchEventsFromDB = async (silent = false) => {
    await getFetchEvents({
      defaultFontSize,
      setEvents,
      setLoading,
      EventService,
      fetchThaiHolidaysFromAPI,
      silent,
      dept: viewingDept,
    });
  };

  // ✅ งานวางแผนล่วงหน้า (unscheduled) — backend กรองแยกไว้จาก events ปกติแล้ว (ดู GET /events/drafts)
  //
  // 🐛 ที่แก้ (ผู้ใช้แจ้ง: "แผนล่วงหน้า ยังอิงของช่าง"): ฟังก์ชันนี้ไม่เคยส่ง dept ไปกับ
  // request เลย ตอนแอดมินเปิดเมนู "ตารางงานเซล" (?dept=sales) คำขอจึงยังใช้ scope ค่าเริ่มต้น
  // ของแอดมิน (ฝ่ายบริการ) แผงนี้เลยโชว์แผนงานล่วงหน้าของช่างทับอยู่บนปฏิทินเซล
  // ✅ ที่จริงแล้วนัดหมายของเซลไม่มีแนวคิด "วางแผนล่วงหน้าไม่ระบุวันที่" อยู่เลย (ฟอร์ม
  // AddSalesAppointment ต้องเลือกวันที่เสมอตั้งแต่ตอนสร้าง ไม่เคยสร้าง unscheduled:true) —
  // ไม่ใช่แค่กรองแผนกให้ถูก แต่ตัดการเรียก/แสดงทั้งแผงทิ้งไปเลยตอนอยู่ในโลกฝ่ายขาย กันไม่ให้
  // ข้อมูลฝ่ายช่างหลุดเข้ามาในเซสชันของเซล และกันปุ่มที่กดแล้วไม่มีวันมีอะไรให้เห็น
  const fetchDrafts = async (silent = false) => {
    // ⚠️ เซลที่เปิดดูตารางช่างก็ไม่ต้องดึงเหมือนกัน — GET /drafts ยังกรองตามแผนกของผู้ขอ
    // ถ้าดึงมาจะได้ "แผนล่วงหน้าของฝ่ายขาย" มาโผล่ในตารางช่าง ซึ่งผิดแผนกชัดๆ
    // ✅ อีกทั้งแผนงานล่วงหน้ายังไม่มีวันที่ จึงไม่ช่วยตอบคำถามเดียวที่เซลเปิดมาดู: "ช่างว่างวันไหน"
    if (isSalesView || isServiceObserver) { setDrafts([]); setShowDraftsPanel(false); return; }
    if (!silent) setDraftsLoading(true);
    try {
      const res = await EventService.GetDraftEvents();
      const list = Array.isArray(res?.drafts) ? res.drafts : [];
      setDrafts(list);
      // ✅ เปิดแผงงานล่วงหน้าอัตโนมัติแค่ครั้งแรกสุดที่โหลดสำเร็จ ถ้ามีงานอยู่จริง — หลังจากนั้น
      // ผู้ใช้เปิด/ปิดเองได้ตามปกติโดยไม่ถูก auto เปิดทับซ้ำอีกตอน refresh รอบถัดๆ ไป
      // ✅ ไม่นับฉบับร่างของสัญญา (มี contractGroupId) — ไม่โผล่ในแผงนี้อยู่แล้ว (ดู visibleDrafts)
      // จึงไม่ควรเป็นเหตุให้เปิดแผงอัตโนมัติด้วย
      if (!hasAutoOpenedDraftsRef.current) {
        hasAutoOpenedDraftsRef.current = true;
        if (list.some((d) => !d.contractGroupId)) setShowDraftsPanel(true);
      }
    } catch (error) {
      console.error("❌ Error fetching draft events:", error);
      if (!silent) setDrafts([]);
    } finally {
      if (!silent) setDraftsLoading(false);
    }
  };

  const saveEventToDB = async (newEvent) => {
    await getSaveEventToDB({ newEvent, EventService });
  };

  // ✅ ใช้ทั้งจากปุ่ม "คัดลอกงานนี้" ใน EditEvent.js และเมนู "···" ของแผนงานล่วงหน้าใน
  // UnscheduledPanel.js — เก็บ template ของงานไว้ใน state แล้วแจ้งเตือนสั้นๆ ว่าคัดลอกแล้ว
  // ผู้ใช้กดวันที่บนปฏิทินต่อเพื่อ "วาง" (ดู handleAddEvent ด้านล่าง ส่ง sourceEvent เข้าฟอร์มเพิ่มงาน)
  const handleCopyEvent = (sourceEvent) => {
    setClipboardEvent(sourceEvent);
    Swal.fire({
      toast: true,
      position: "top",
      icon: "success",
      title: "คัดลอกงานแล้ว — คลิกวันที่ที่ต้องการวาง",
      showConfirmButton: false,
      timer: 2500,
    });
  };

  const handleAddEvent = async (arg) => {
    // ❌ เซลที่เปิดดูตารางช่างอยู่ สร้างงานให้ช่างไม่ได้ — เป็นมุมมองอ่านอย่างเดียวล้วนๆ
    // ⚠️ ถ้าอยากให้ช่างไปทำงานให้ ต้องผ่าน "ใบแจ้งงาน" (/dispatch) ซึ่งเป็นทางที่ออกแบบไว้ให้ข้ามแผนก
    // และมีขั้นตอนอนุมัติ/มอบหมายครบ — บอกทางไปให้เลย ไม่ใช่แค่ปฏิเสธเฉยๆ
    if (isServiceObserver) {
      Swal.fire({
        icon: "info",
        title: "ดูได้อย่างเดียว",
        text: 'ตารางงานช่างเปิดให้ดูเพื่อเช็ควันว่างเท่านั้น — ถ้าต้องการให้ช่างเข้างาน ให้เปิด "ใบแจ้งงาน"',
        confirmButtonText: "เข้าใจแล้ว",
      });
      return;
    }
    // ✅ เซลได้ฟอร์ม "นัดหมาย" ของตัวเอง ไม่ใช่ฟอร์มงานของช่าง
    // ⚠️ ฟอร์มของช่างเริ่มด้วยขั้นตอน "ประเภทงาน: งานทั่วไป/โปรเจค/ตามสัญญา" แล้วต่อด้วย ระบบ/ทีม/
    // ครั้งที่/สัญญา ซึ่งไม่มีความหมายกับงานขายเลยสักช่อง (ดูเหตุผลเต็มที่ AddSalesAppointment.js)
    // ⚠️ แอดมินที่เปิดเมนู "ตารางงานเซล" (?dept=sales) ก็ต้องได้ฟอร์มนัดหมาย ไม่ใช่ฟอร์มงานช่าง
    // — ปฏิทินที่กำลังเปิดอยู่คือตัวบอกว่ากำลังจะสร้างของแผนกไหน
    if (isSalesView) {
      await getAddSalesAppointment({
        arg, userData, saveEventToDB, fetchEventsFromDB, Swal, moment,
        // ⚠️ ต้องส่ง department ไปด้วย — ฝั่ง server เดาจาก role ของผู้สร้าง ซึ่งกับแอดมินจะได้
        // "ฝ่ายบริการ" เสมอ นัดที่แอดมินสร้างจึงไปโผล่ในปฏิทินช่าง
        department: DEPARTMENT.SALES,
      });
      return;
    }
    await getAddEvent({
      arg,
      events,
      // ✅ ต้องส่ง drafts ด้วย เพื่อให้ตาราง "เลือกครั้งที่" เห็นครั้งที่ถูกจองไว้เป็นแผนงานล่วงหน้าอยู่แล้ว
      // ไม่ใช่แค่ครั้งที่ลงตารางแล้ว ไม่งั้นจะเสนอครั้งที่ซ้ำกับที่จองไว้ (ชนกับเช็คซ้ำฝั่ง backend)
      drafts,
      // ✅ ใช้โชว์ข้อความแจ้งช่าง/เซลว่างานที่สร้างจะต้องรออนุมัติก่อน (ดู isAdminOrManagerUser ในฟอร์ม)
      userData,
      setEvents,
      defaultTextColor,
      defaultBackgroundColor,
      setDefaultTextColor,
      setDefaultBackgroundColor,
      setDefaultFontSize,
      saveEventToDB,
      fetchEventsFromDB,
      fetchLookupOptions,
      // ✅ มีงานที่คัดลอกไว้อยู่ไหม (คลิปบอร์ด) — ถ้ามี ฟอร์มจะ prefill ให้จากตรงนี้ (ดู getAddEvent)
      sourceEvent: clipboardEvent,

      CustomerService,
      AuthService,
      JobTypeService,
      SystemTypeService,
      EventService,
      Swal,
      TomSelect,
      moment,
    });
  };

  const handleEditEvent = async (eventInfo) => {
    // ✅ เซลได้ฟอร์มแก้ไข "นัดหมาย" คู่แฝดของฟอร์มเพิ่ม ไม่ใช่ฟอร์มงานของช่าง
    // ⚠️ ฟอร์มของช่างมีแผงสัญญา/เอกสาร 4 ชนิด/ทีมเข้างาน/คำขอปิดงาน ซึ่งไม่มีอะไรเกี่ยวกับนัดของเซล
    const src = events.find((e) => String(e._id) === String(eventInfo?.event?.id));
    // ⚠️ เซลที่เปิดดูตารางช่างอยู่ ต้องได้ฟอร์มของงานช่าง (แบบอ่านอย่างเดียว) ไม่ใช่ฟอร์มนัดหมาย
    // — งานที่กดเปิดเป็นงานของช่าง ไม่ใช่นัดของตัวเอง
    if ((isSaleUser && !isServiceObserver) || isSalesEvent(src) || isSalesEvent(eventInfo?.event)) {
      await getEditSalesAppointment({
        eventInfo, events, EventService, fetchEventsFromDB, handleDeleteEvent, Swal, moment,
      });
      return;
    }
    await getEditEvent({
      navigate,
      events,
      setEvents,
      // ✅ เซลที่เข้ามาดูตารางช่าง — เปิดดูรายละเอียดได้ครบ แต่แก้อะไรไม่ได้เลยสักช่อง
      readOnly: isServiceObserver,
      fetchEventsFromDB,
      fetchLookupOptions,
      eventInfo,
      setLoading,
      onOpenWorkNotice: setWorkNoticeJob,
      onOpenDeliveryNote: setDeliveryNoteJob,
      handleDeleteEvent,
      handleUnscheduleEvent: handleUnscheduleViaButton,
      onCopyEvent: handleCopyEvent,
      EventService,
      CustomerService,
      AuthService,
      JobTypeService,
      SystemTypeService,
      Swal,
      TomSelect,
      moment,
      userData,
    });

    // await fetchEventsFromDB()
  };

  const handleDeleteEvent = async (id) => {
    await getDeleteEvent({
      setLoading,
      id,
      EventService,
      setEvents,
      fetchEventsFromDB,

      Swal,
    });
  };

  // ✅ ย้ายงานที่ลงตารางไปแล้วกลับไปเป็น "วางแผนล่วงหน้า" — ใช้ร่วมกันทั้ง 2 ทาง (ปุ่มใน
  // EditEvent.js / ลากวางบนแผงงานล่วงหน้า) แค่ต่างกันตรงจะถามเดือน/ยืนยันก่อนหรือไม่
  const unscheduleEvent = async (id, plannedMonth) => {
    try {
      await EventService.UnscheduleEvent(id, plannedMonth);
      await Promise.all([fetchEventsFromDB(), fetchDrafts()]);
      Swal.fire({
        title: "ย้ายไปแผนล่วงหน้าสำเร็จ ✅",
        icon: "success",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("❌ Error unscheduling event:", error);
      Swal.fire("❌ ย้ายไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
  };

  // ✅ ปุ่ม "ย้ายไปแผนล่วงหน้า" ใน EditEvent.js — ให้เลือกเดือน/ปีที่ตั้งใจเองก่อนเสมอ (ไม่ auto
  // เดาจากวันที่เดิมของงานเหมือนก่อนหน้านี้) การเลือกเดือนแล้วกด "ย้าย" ก็ถือเป็นการยืนยันในตัว
  // อยู่แล้ว จึงไม่ต้องมีกล่องยืนยัน "แน่ใจไหม" ซ้อนอีกชั้นก่อนหน้านั้น
  const handleUnscheduleViaButton = async (id) => {
    const { value: plannedMonth } = await Swal.fire({
      title: "ย้ายไปแผนวางล่วงหน้าเดือนไหน?",
      input: "month",
      inputValue: moment().format("YYYY-MM"),
      showCancelButton: true,
      confirmButtonText: "ย้าย",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#f59e0b",
      inputValidator: (value) => (!value ? "กรุณาเลือกเดือน/ปี" : undefined),
    });
    if (!plannedMonth) return;
    await unscheduleEvent(id, plannedMonth);
  };

  // ✅ ลากงานจากปฏิทินมาวางบนแผงงานล่วงหน้าโดยตรง — ไม่ต้องถามอะไรเลยตามที่ขอ (การลากมาวาง
  // เองคือการยืนยันความตั้งใจอยู่แล้ว) ใช้เดือนของวันที่เดิมของงานเป็นค่าเริ่มต้นแทน
  const handleUnscheduleViaDrag = async (id) => {
    await unscheduleEvent(id);
  };

  const handleEventDrop = async (arg) => {
    await getEventDrop({
      arg,
      events, // ✅ ใช้เช็คแจ้งเตือนทีมชนกันแบบไม่บล็อกหลังบันทึกสำเร็จ (ดู EventDrop.js)
      fetchEventsFromDB,
      setEvents,
      // ✅ ใช้เฉพาะตอนกด Alt/Cmd ค้างไว้ระหว่างลาก (ก๊อปปี้ไปสร้างเป็นงานใหม่ — ดู isCopyDrag ใน EventDrop.js)
      saveEventToDB,
      userData, // ✅ ใช้ตั้งชื่อผู้ทำรายการใน activityLog ตอนย้ายวันที่ (ดู EventDrop.js)

      EventService,
      Swal,
      moment,
    });
  };

  const handleEventResize = async (arg) => {
    await getEventResize({
      arg,
      events, // ✅ ใช้เช็คแจ้งเตือนทีมชนกันแบบไม่บล็อกหลังบันทึกสำเร็จ (ดู EventResize.js)
      fetchEventsFromDB,
      setEvents,
      userData, // ✅ ใช้ตั้งชื่อผู้ทำรายการใน activityLog ตอนปรับขนาดวันที่ (ดู EventResize.js)
      EventService,
      Swal,
      moment,
    });
  };

  const handleAddDraft = async () => {
    await getAddDraftEvent({
      defaultMonth: draftMonth,
      // ✅ ต้องส่ง events + drafts ให้ครบ เพื่อให้ขั้นตอน "งานตามสัญญา" หาสัญญาที่มีอยู่แล้ว และคำนวณ
      // "ครั้งที่ถัดไป" ถูกต้อง (ไม่ชนกับครั้งที่จองไปแล้วไม่ว่าจะลงตารางแล้วหรือยังเป็นแค่แผนงานก็ตาม)
      events,
      drafts,
      // ✅ ใช้โชว์ข้อความแจ้งช่าง/เซลว่างานที่สร้างจะต้องรออนุมัติก่อน (ดู isAdminOrManagerUser ในฟอร์ม)
      userData,
      // ✅ ถ้าใส่วันที่มาด้วยตอนบันทึก จะถูกลงตารางทันที (ย้ายจาก drafts ไปเป็น event จริง)
      // ต้อง refresh ทั้งคู่เผื่อกรณีนั้น ไม่ใช่แค่ fetchDrafts อย่างเดียว
      onSaved: () => Promise.all([fetchDrafts(), fetchEventsFromDB()]),
      CustomerService,
      AuthService,
      JobTypeService,
      SystemTypeService,
      EventService,
      Swal,
      TomSelect,
      moment,
    });
  };

  const handleEditDraftClick = async (draft) => {
    await getAddDraftEvent({
      defaultMonth: draftMonth,
      existingDraft: draft,
      events,
      drafts,
      // ✅ ใช้โชว์ข้อความแจ้งช่าง/เซลว่างานที่แก้ไขจะรออนุมัติใหม่ (ดู isAdminOrManagerUser ในฟอร์ม)
      userData,
      // ✅ ถ้าใส่วันที่มาด้วยตอนบันทึก จะถูกลงตารางทันที (ย้ายจาก drafts ไปเป็น event จริง)
      // ต้อง refresh ทั้งคู่เผื่อกรณีนั้น ไม่ใช่แค่ fetchDrafts อย่างเดียว
      onSaved: () => Promise.all([fetchDrafts(), fetchEventsFromDB()]),
      CustomerService,
      AuthService,
      JobTypeService,
      SystemTypeService,
      EventService,
      Swal,
      TomSelect,
      moment,
    });
  };

  // ✅ ใช้ทั้งตอนกดปุ่ม "ลงตาราง" เลือกวันที่เอง และตอนลากการ์ดวางบนปฏิทิน (handleEventReceive)
  // ✅ end ต้อง +1 วันเสมอ (เหมือน AddEvent.js) เพราะ event เป็น allDay:true โดย default —
  // FullCalendar ถือว่า end ของ all-day event เป็นแบบ exclusive ถ้าไม่ +1 งาน 1 วันจะโชว์ผิด/ไม่ขึ้นเลย
  // ✅ รองรับ dateRanges (งานเข้าหลายวันไม่ติดกัน) เป็นทางเลือกแทน startDate/endDate เดี่ยว —
  // backend /schedule เองก็รองรับ dates[] อยู่แล้ว (ดู POST / ที่สร้างงานหลายวันแบบเดียวกัน)
  const scheduleDraft = async (draftId, { startDate, endDate, dateRanges, startTime, endTime, team, resPerson, teamMembers } = {}) => {
    try {
      const payload = { startTime, endTime, team, resPerson, teamMembers };
      if (Array.isArray(dateRanges) && dateRanges.length > 0) {
        payload.dates = dateRanges.map((r) => ({
          start: r.start,
          end: moment(r.end).add(1, "days").format("YYYY-MM-DD"),
          date: r.start,
        }));
      } else {
        const effectiveEnd = endDate || startDate;
        payload.date = startDate;
        payload.start = startDate;
        payload.end = moment(effectiveEnd).add(1, "days").format("YYYY-MM-DD");
      }
      await EventService.ScheduleDraftEvent(draftId, payload);
      await Promise.all([fetchEventsFromDB(), fetchDrafts()]);
      Swal.fire({
        title: "ลงตารางสำเร็จ ✅",
        icon: "success",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("❌ Error scheduling draft event:", error);
      Swal.fire("❌ ลงตารางไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
  };

  // ✅ กล่อง "ลงตาราง" รวมทุกอย่างที่ตัดออกจากฟอร์มเพิ่ม/แก้ไขงานล่วงหน้าไว้ที่นี่แทน — วันที่เริ่ม/
  // สิ้นสุด (แยกกันเหมือนฟอร์มเพิ่มงานปกติ ไม่ใช่วันเดียวอีกต่อไป), เวลาเริ่ม/สิ้นสุด, และทีม
  // SweetAlert2 รองรับ input เดียวผ่าน `input` option ตรงๆ ไม่ได้ ต้องประกอบเป็น html เองแล้ว
  // อ่านค่าใน preConfirm แทน
  const handleScheduleDraftClick = async (draft) => {
    const defaultDate = moment(draft.plannedMonth, "YYYY-MM").startOf("month").format("YYYY-MM-DD");
    const teamToId = new Map(employeeList.map((e) => [e.fname, e._id]));
    // ✅ ป้องกัน stored XSS — ชื่อ/บริษัท/โครงการที่ผู้ใช้พิมพ์เองต้อง escape ก่อนต่อเป็น HTML string
    // เสมอ ไม่งั้นถ้ามีใครตั้งชื่อเป็น เช่น "><img src=x onerror="..."> จะยิง JavaScript ทันทีที่มีใคร
    // เปิดกล่อง "ลงตาราง" ของงานนั้นดู
    // ✅ ไม่ฝัง selected ในตัวเลือกดิบ (เทียบ plainTeamOpts ใน EditEvent.js) — ทั้งช่อง "ทีม" หลักและ
    // แถว "ลูกทีมเพิ่มเติม" ตอนนี้เป็น TomSelect ทั้งคู่ ตั้งค่าเริ่มต้นผ่าน ts.setValue(...) แทน เดิม
    // ใช้ teamOpts.replace(/ selected/g,"") ตัด attribute ออกสำหรับแถวลูกทีม ซึ่งจะพังทันทีถ้ามีชื่อ
    // พนักงานคนไหนมีคำว่า " selected" อยู่ในชื่อจริง
    const plainTeamOpts = employeeList
      .map((e) => `<option value="${escapeHtml(e.fname)}">${escapeHtml(e.fname)}</option>`)
      .join("");

    const rangeRowHtml = (startVal = "", endVal = "") => `
      <div class="swal-schedule-range-row" style="display:flex; gap:6px; align-items:center; margin-bottom:8px;">
        <input type="date" class="swal-schedule-range-start" style="flex:1; box-sizing:border-box; padding:9px 12px; border:1px solid #d9d9d9; border-radius:4px; font-size:14px;" value="${startVal}">
        <span style="flex-shrink:0; color:#94a3b8; font-weight:700;">–</span>
        <input type="date" class="swal-schedule-range-end" style="flex:1; box-sizing:border-box; padding:9px 12px; border:1px solid #d9d9d9; border-radius:4px; font-size:14px;" value="${endVal || startVal}">
        <button type="button" class="swal-schedule-range-remove" style="flex-shrink:0; width:34px; height:34px; border:1px solid #e2e8f0; background:#f1f5f9; border-radius:6px; cursor:pointer;">✕</button>
      </div>
    `;

    const { value: formValues } = await Swal.fire({
      title: "เลือกวันที่ลงตาราง",
      html: `
        <style>
          /* ✅ เดิมช่อง วันที่เริ่ม/สิ้นสุด และ เวลาเริ่ม/สิ้นสุด เรียงข้างกันตายตัวด้วย flex
             ทำให้บนจอมือถือแคบๆ ช่องแคบเกินไปจน input วันที่ล้นขอบจอ (input[type=date] ของ
             เบราว์เซอร์มีความกว้างขั้นต่ำของตัวเองบีบต่อไม่ได้) — สลับเป็นเรียงซ้อนกันทีละแถว
             เต็มความกว้างแทนเมื่อจอแคบ ให้พอดีจอเสมอ ไม่มีการล้น/ตัด */
          .swal-schedule-row-2col { display:flex; gap:8px; margin-bottom:12px; }
          .swal-schedule-row-2col > div { flex:1; text-align:left; min-width:0; }
          @media (max-width: 480px) {
            .swal-schedule-row-2col { flex-direction: column; gap: 10px; }
          }
          /* ✅ ช่อง "ทีม"/"ลูกทีมเพิ่มเติม" ในกล่องนี้เป็น TomSelect เหมือนฟอร์มเพิ่ม/แก้ไขงาน
             (พิมพ์เพิ่มชื่อเองได้) — สไตล์ .ts-control ให้หน้าตาเหมือน input อื่นๆ ในกล่องนี้ */
          .swal-schedule-team-member-row { display:flex; gap:6px; align-items:center; margin-bottom:6px; }
          .swal-schedule-team-member-row .ts-wrapper { flex:1 1 auto; min-width:0; }
          .swal-schedule-ts .ts-control {
            border: 1px solid #d9d9d9 !important; border-radius: 4px !important;
            padding: 7px 10px !important; font-size: 14px !important; min-height: 38px;
            box-shadow: none !important;
          }
          .swal-schedule-ts.focus .ts-control {
            border-color: #dc2626 !important; box-shadow: 0 0 0 3px rgba(220,38,38,.10) !important;
          }
          /* ✅ .swal2-html-container ของ Swal ตั้ง overflow:auto ไว้ (ต่างจากฟอร์มเพิ่ม/แก้ไขงานที่
             override เป็น hidden แล้วคุม scroll เอง) — dropdown ที่กางอยู่ในกล่องจะโดนตัดขาดทันที
             เพราะช่อง "ลูกทีม" อยู่ล่างสุดของป๊อปอัพพอดี จึงย้าย dropdown ไปแขวนที่ body แทน
             (dropdownParent:"body") แล้วดัน z-index ให้สูงกว่า .swal2-container (1060) */
          .ts-dropdown.swal-schedule-ts-dropdown { z-index: 1100; }
        </style>

        <div style="text-align:left; font-size:13px; color:#64748b; margin-bottom:14px;">
          ${escapeHtml(draft.title) || "งาน"} · ${escapeHtml([draft.company, draft.site].filter(Boolean).join(" · "))}
        </div>

        ${isPendingApproval(draft) ? `
        <div style="text-align:left; font-size:12.5px; color:#92400e; background:#fef3c7; border:1px solid #fde68a; border-radius:8px; padding:8px 12px; margin-bottom:14px;">
          ⏳ งานนี้ยังรออนุมัติ — ลงตารางได้ตามปกติ แต่จะยังขึ้นเป็น "รออนุมัติ" บนปฏิทินจนกว่าแอดมิน/manager จะอนุมัติ
        </div>
        ` : ""}

        <label style="display:flex; align-items:center; gap:8px; font-size:12.5px; font-weight:600; color:#374151; margin-bottom:12px; cursor:pointer;">
          <input type="checkbox" id="swal-schedule-multi-toggle" style="width:auto; cursor:pointer;">
          🗓️ งานนี้ต้องเข้างานหลายวัน (ไม่ติดกันก็ได้) — ถือเป็นงานเดียวกัน
        </label>

        <div id="swal-schedule-single-section">
          <div class="swal-schedule-row-2col">
            <div>
              <label style="font-size:12px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">📅 วันที่เริ่ม</label>
              <input id="swal-schedule-start-date" type="date" class="swal2-input" style="margin:0; width:100%; box-sizing:border-box;" value="${defaultDate}">
            </div>
            <div>
              <label style="font-size:12px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">📅 วันที่สิ้นสุด</label>
              <input id="swal-schedule-end-date" type="date" class="swal2-input" style="margin:0; width:100%; box-sizing:border-box;" value="${defaultDate}">
            </div>
          </div>
        </div>

        <div id="swal-schedule-multi-section" style="display:none; text-align:left;">
          <div id="swal-schedule-multi-list" style="margin-bottom:8px;"></div>
          <button type="button" id="swal-schedule-add-date-btn" style="margin-bottom:12px; padding:8px 14px; border:1px solid #e2e8f0; background:#f1f5f9; border-radius:6px; font-size:12.5px; font-weight:700; color:#475569; cursor:pointer;">➕ เพิ่มช่วงวันที่</button>
        </div>

        <div class="swal-schedule-row-2col">
          <div>
            <label style="font-size:12px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">🕐 เวลาเริ่ม</label>
            <input id="swal-schedule-start-time" type="text" class="swal2-input" placeholder="เช่น 08:30" style="margin:0; width:100%; box-sizing:border-box;" value="${escapeHtml(draft.startTime)}">
          </div>
          <div>
            <label style="font-size:12px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">🕔 เวลาสิ้นสุด</label>
            <input id="swal-schedule-end-time" type="text" class="swal2-input" placeholder="เช่น 17:00" style="margin:0; width:100%; box-sizing:border-box;" value="${escapeHtml(draft.endTime)}">
          </div>
        </div>
        <div style="text-align:left; margin-bottom:12px;">
          <label style="font-size:12px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">👷 ทีม</label>
          <select id="swal-schedule-team">
            <option value="">— ไม่ระบุ —</option>
            ${plainTeamOpts}
          </select>
        </div>

        <div style="text-align:left;">
          <label style="font-size:12px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">👥 ลูกทีมเพิ่มเติม (ถ้ามี)</label>
          <div id="swal-schedule-team-members-list" style="margin-bottom:6px;"></div>
          <button type="button" id="swal-schedule-add-team-member-btn" style="padding:8px 14px; border:1px solid #e2e8f0; background:#f1f5f9; border-radius:6px; font-size:12.5px; font-weight:700; color:#475569; cursor:pointer;">➕ เพิ่มลูกทีม</button>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "📅 ลงตาราง",
      cancelButtonText: "ยกเลิก",
      focusConfirm: false,
      didOpen: () => {
        // ✅ เปลี่ยนช่อง <input type="date"> ทุกช่องในกล่องนี้เป็นปฏิทิน พ.ศ. เดือนไทย
        // (ช่องเดิมถูกซ่อนไว้เป็นตัวเก็บค่า โค้ดที่อ่าน .value ตอนกดบันทึกจึงทำงานเหมือนเดิม)
        Swal.getPopup().__thaiDpCleanup = mountThaiDatePickers(Swal.getPopup());
        const multiToggle  = document.getElementById("swal-schedule-multi-toggle");
        const singleSection = document.getElementById("swal-schedule-single-section");
        const multiSection  = document.getElementById("swal-schedule-multi-section");
        const multiList     = document.getElementById("swal-schedule-multi-list");

        const addRow = (startVal = "", endVal = "") => {
          const wrapper = document.createElement("div");
          wrapper.innerHTML = rangeRowHtml(startVal, endVal);
          const row = wrapper.firstElementChild;
          row.querySelector(".swal-schedule-range-remove").addEventListener("click", () => {
            if (multiList.children.length > 1) row.remove();
          });
          multiList.appendChild(row);
        };
        addRow(defaultDate, defaultDate);

        document.getElementById("swal-schedule-add-date-btn")?.addEventListener("click", () => addRow());

        multiToggle?.addEventListener("change", () => {
          const isMulti = multiToggle.checked;
          singleSection.style.display = isMulti ? "none" : "";
          multiSection.style.display  = isMulti ? "" : "none";
        });

        // ✅ TomSelect ตัวแรกของไฟล์นี้ — ให้ช่อง "ทีม" กับ "ลูกทีมเพิ่มเติม" ในกล่องนี้ค้นหา/พิมพ์เพิ่ม
        // เองได้เหมือนช่องเดียวกันในฟอร์มเพิ่ม/แก้ไขงาน (AddEvent/EditEvent) ที่ทำไว้แล้ว
        const mkScheduleTs = (el, placeholder, prefillName = "") => {
          if (!el) return null;
          try {
            // ⚠️ เดิม fix ไว้ 7 ตัดรายชื่อพนักงานที่มีเกิน 7 คนทิ้งไปเงียบๆ (ห้องสมุด TomSelect ค่า
            // default จริงคือ 50 อยู่แล้ว) ทำให้ค้นหา/เลือกทีมหรือลูกทีม "หาไม่เจอ" เป็นบางที
            const ts = new TomSelect(el, {
              create: true,
              maxOptions: employeeList.length || 50,
              placeholder,
              sortField: { field: "text", direction: "asc" },
              allowEmptyOption: true,
              dropdownParent: "body", // ดูเหตุผลใน <style> ด้านบน
              wrapperClass: "ts-wrapper swal-schedule-ts",
              dropdownClass: "ts-dropdown swal-schedule-ts-dropdown",
            });
            if (prefillName) {
              ts.addOption({ value: prefillName, text: prefillName });
              ts.setValue(prefillName, true);
            } else {
              ts.clear(true);
            }
            return ts;
          } catch { return null; }
        };

        // ช่อง "ทีม" (ช่างหลัก) — prefill ด้วยทีมเดิมของแผนงานนี้
        mkScheduleTs(document.getElementById("swal-schedule-team"), "เลือกหรือพิมพ์ชื่อทีม", draft.team || "");

        // ✅ ลูกทีมเพิ่มเติม (คนที่ 2, 3, ... แสดงผลอย่างเดียว ไม่กระทบสิทธิ์แก้ไข/แจ้งเตือน)
        const teamMembersList = document.getElementById("swal-schedule-team-members-list");
        const addTeamMemberRow = (prefillName = "") => {
          const wrapper = document.createElement("div");
          wrapper.innerHTML = `
            <div class="swal-schedule-team-member-row">
              <select class="swal-schedule-team-member-select">
                <option value="">— เลือกลูกทีม —</option>
                ${plainTeamOpts}
              </select>
              <button type="button" class="swal-schedule-team-member-remove" style="flex-shrink:0; width:34px; height:34px; border:1px solid #e2e8f0; background:#f1f5f9; border-radius:6px; cursor:pointer;">✕</button>
            </div>
          `;
          const row = wrapper.firstElementChild;
          teamMembersList.appendChild(row); // ต้อง append ก่อน init (ดูคอมเมนต์ใน AddEvent.js)
          const ts = mkScheduleTs(row.querySelector(".swal-schedule-team-member-select"), "เลือกหรือพิมพ์ชื่อลูกทีม", prefillName);
          row.querySelector(".swal-schedule-team-member-remove").addEventListener("click", () => {
            // ✅ dropdownParent:"body" ทำให้ dropdown ไม่ได้เป็นลูกของแถวนี้อีกต่อไป — ต้อง destroy()
            // ก่อนเสมอ ไม่งั้น dropdown จะค้างอยู่ใน body ตลอดไปหลังลบแถว (ต่างจาก AddEvent/EditEvent
            // ที่ dropdown อยู่ในแถวเอง row.remove() เฉยๆ ยังพอเก็บกวาดฝั่ง DOM ให้ได้บางส่วน)
            ts?.destroy();
            row.remove();
          });
        };
        (draft.teamMembers || []).forEach((m) => addTeamMemberRow(m?.name || ""));
        document.getElementById("swal-schedule-add-team-member-btn")?.addEventListener("click", () => addTeamMemberRow());
      },
      // ✅ dropdownParent:"body" ต้องเก็บกวาดตอนปิดกล่องเสมอ (ไม่ใช่แค่ตอนกด ✕ ทีละแถว) ไม่งั้น
      // dropdown ที่ค้างอยู่ใน body จะกลายเป็น orphan element ถาวรทันทีที่ทั้งกล่องถูกปิด
      willClose: (popup) => {
        // ⚠️ คืนทรัพยากรของปฏิทิน พ.ศ. ที่ mount ไว้ด้วย ไม่งั้น React root จะค้างทุกครั้งที่เปิดกล่อง
        popup.__thaiDpCleanup?.();
        popup.querySelectorAll(".tomselected").forEach((el) => el.tomselect?.destroy());
      },
      preConfirm: () => {
        const isMultiDate = Boolean(document.getElementById("swal-schedule-multi-toggle")?.checked);
        const team = document.getElementById("swal-schedule-team")?.value || "";
        const teamMembers = [...document.querySelectorAll(".swal-schedule-team-member-select")]
          .map((sel) => sel.value)
          .filter(Boolean)
          .filter((name, idx, arr) => arr.indexOf(name) === idx)
          .map((name) => ({ userId: teamToId.get(name) || "", name }));

        const common = {
          startTime: document.getElementById("swal-schedule-start-time")?.value || "",
          endTime: document.getElementById("swal-schedule-end-time")?.value || "",
          team,
          resPerson: teamToId.get(team) || "",
          teamMembers,
        };

        if (isMultiDate) {
          const rows = [...document.querySelectorAll(".swal-schedule-range-row")];
          const dateRanges = [];
          for (const row of rows) {
            const s = row.querySelector(".swal-schedule-range-start")?.value;
            const e = row.querySelector(".swal-schedule-range-end")?.value || s;
            if (!s) continue;
            if (moment(e).isBefore(moment(s))) {
              Swal.showValidationMessage("แต่ละช่วงวันที่ วันสิ้นสุดต้องไม่ก่อนวันเริ่ม");
              return false;
            }
            dateRanges.push({ start: s, end: e });
          }
          if (dateRanges.length === 0) {
            Swal.showValidationMessage("กรุณาเลือกอย่างน้อย 1 ช่วงวันที่");
            return false;
          }
          return { ...common, dateRanges };
        }

        const startDate = document.getElementById("swal-schedule-start-date")?.value;
        const endDate   = document.getElementById("swal-schedule-end-date")?.value || startDate;
        if (!startDate) {
          Swal.showValidationMessage("กรุณาเลือกวันที่เริ่ม");
          return false;
        }
        if (moment(endDate).isBefore(moment(startDate))) {
          Swal.showValidationMessage("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม");
          return false;
        }
        return { ...common, startDate, endDate };
      },
    });
    if (formValues) {
      await scheduleDraft(draft._id, formValues);
    }
  };

  const handleDeleteDraftClick = async (draft) => {
    // ⚠️ กันลบสัญญาทั้งอันไปโดยไม่ตั้งใจ — สัญญาที่เพิ่งสร้างไว้แบบยังไม่ระบุวันที่เข้างาน (ดูฟอร์ม
    // "เพิ่มสัญญาใหม่" ใน ContractOverview.js) มี document เดียวในระบบคือฉบับร่างนี้ ถ้าลบทิ้งตอนยังไม่มี
    // ครั้งไหนลงตารางจริงเลย (ไม่มีทั้งใน events ที่ลงตารางแล้ว และไม่มีฉบับร่างอื่นค้างอยู่ผูก
    // contractGroupId เดียวกัน) จะไม่เหลือ record ไหนผูกสัญญานี้เลย สัญญาทั้งอันจะหายไปจากตาราง
    // "ภาพรวมงาน" ทันที (ดู groupEventsByContract) — ต้องเตือนแยกให้ชัดเจนกว่าคำเตือนลบงานปกติ
    const isSoleContractRecord = Boolean(draft.contractGroupId) && ![...events, ...drafts].some(
      (e) => String(e._id) !== String(draft._id) && e.contractGroupId === draft.contractGroupId
    );

    const result = await Swal.fire({
      title: isSoleContractRecord ? "⚠️ ลบแล้วสัญญาทั้งอันจะหายไปจากตาราง!" : "ลบงานวางแผนล่วงหน้านี้?",
      html: isSoleContractRecord
        ? `นี่เป็นครั้งเดียวที่เหลืออยู่ของสัญญานี้${draft.contractNo ? ` (เลขที่สัญญา ${draft.contractNo})` : ""} —
           ลบแล้วสัญญา <b>${[draft.company, draft.site].filter(Boolean).join(" · ") || "งานนี้"}</b>
           จะหายไปจากหน้า "ภาพรวมงาน" ทั้งหมดทันที (ต้องสร้างสัญญาใหม่ถ้าจะใช้อีก)`
        : `${draft.title || "งาน"} · ${[draft.company, draft.site].filter(Boolean).join(" · ")}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: isSoleContractRecord ? "เข้าใจแล้ว ลบเลย" : "ลบ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#dc2626",
    });
    if (!result.isConfirmed) return;
    try {
      await EventService.DeleteEvent(draft._id);
      await fetchDrafts();
    } catch (error) {
      console.error("❌ Error deleting draft event:", error);
      Swal.fire("❌ ลบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
  };

  // ✅ อนุมัติ/ไม่อนุมัติแผนงานที่ยังไม่มีวันที่ (ยังเป็น draft อยู่) — เรียกจาก UnscheduledPanel
  // (ปุ่ม "อนุมัติ/ไม่อนุมัติ" ในเมนู "···" ของแต่ละการ์ด) เฉพาะแอดมิน/manager เท่านั้นที่เห็นปุ่มนี้
  // (ดู isAdminOrManager ที่ส่งเป็น prop) ฝั่ง backend เช็คสิทธิ์ซ้ำอีกชั้นอยู่แล้วเป็นตัวที่เชื่อถือได้จริง
  const handleDecideDraftApproval = async (draft, decision) => {
    let reason;
    if (decision === "reject") {
      const { value, isConfirmed } = await Swal.fire({
        title: "ระบุเหตุผลที่ไม่อนุมัติ (ถ้ามี)",
        input: "textarea",
        inputPlaceholder: "เช่น ข้อมูลไม่ครบ/ซ้ำกับงานอื่น...",
        showCancelButton: true,
        confirmButtonText: "ไม่อนุมัติ",
        confirmButtonColor: "#dc2626",
        cancelButtonText: "ยกเลิก",
      });
      if (!isConfirmed) return;
      reason = value;
    }
    try {
      await EventService.DecideApproval(draft._id, decision, reason);
      await fetchDrafts(true);
      Swal.fire({
        title: decision === "approve" ? "อนุมัติแล้ว ✅" : "ไม่อนุมัติแล้ว ❌",
        icon: "success",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("❌ Error deciding approval:", error);
      Swal.fire("❌ ดำเนินการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
  };

  // ✅ เรียกเมื่อลากการ์ดจาก UnscheduledPanel มาวางบนปฏิทิน (FullCalendar Draggable + droppable
  // จับคู่กันเอง) — FullCalendar จะสร้าง event ชั่วคราวให้ก่อน ต้องลบทิ้งเสมอไม่ว่าผลจะเป็นอย่างไร
  // เพราะของจริงจะมาจาก fetchEventsFromDB() หลัง schedule สำเร็จแทน
  const handleEventReceive = async (info) => {
    const draftId = info.event.extendedProps?.draftId;
    const dateStr = info.event.startStr;
    info.event.remove();
    if (!draftId) return;
    await scheduleDraft(draftId, { startDate: dateStr });
  };

  // ✅ ระหว่างลากงานจากปฏิทินจริง ไฮไลต์แผงงานล่วงหน้าไว้เป็น drop-zone ให้เห็นชัดว่าลากมาวางตรงนี้ได้
  const handleEventDragStart = () => {
    draftsPanelRef.current?.classList.add("unscheduled-panel--drop-target");
  };

  // ✅ ลากงานที่ลงตารางแล้วออกจากปฏิทิน มาปล่อยทับแผงงานล่วงหน้า = ย้ายกลับไปเป็น unscheduled
  // (FullCalendar เองจะ revert ตำแหน่ง event กลับที่เดิมให้อัตโนมัติเพราะไม่ใช่ช่องวันที่ที่ถูกต้อง
  // เราแค่เรียก API ย้ายสถานะจริงแล้ว fetch ใหม่ทับ ไม่ต้องยุ่งกับตำแหน่ง event บนปฏิทินเอง)
  const handleEventDragStop = (info) => {
    draftsPanelRef.current?.classList.remove("unscheduled-panel--drop-target");

    const panelEl = draftsPanelRef.current;
    if (!panelEl || info.event.extendedProps?.isHoliday) return;

    const rect = panelEl.getBoundingClientRect();
    const { clientX, clientY } = info.jsEvent;
    const isOverPanel =
      clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    if (!isOverPanel) return;

    if (!canEditEvent(info.event.extendedProps)) {
      Swal.fire("❌ คุณไม่มีสิทธิ์แก้ไขแผนงานนี้");
      return;
    }
    // ❌ ห้ามย้ายกลับไปแผนล่วงหน้าเด็ดขาด ไม่มีข้อยกเว้นแม้แต่ admin/manager สำหรับงานที่ "เสร็จสิ้น/
    // ยืนยันแล้ว/กำลังดำเนินการ" — เทียบ pattern เดียวกับ canUnscheduleEvent ใน EditEvent.js
    // (canEditEvent ด้านบนไม่กันเคสนี้ เพราะ admin/manager ผ่าน canEditEvent เสมอไม่ว่างานจะปิดหรือไม่)
    // ⚠️ ต้องกันทางนี้ด้วย ไม่ใช่แค่ซ่อนปุ่มในฟอร์มแก้ไข — การลากการ์ดจากปฏิทินมาวางบนแผงงานล่วงหน้า
    // เป็นอีกทางหนึ่งที่ทำให้เกิด unschedule ได้ ถ้ากันแค่ปุ่มก็เลี่ยงได้ด้วยการลากอยู่ดี
    const UNSCHEDULE_BLOCKED_STATUSES = ["ดำเนินการเสร็จสิ้น", "ยืนยันแล้ว", "กำลังดำเนินการ"];
    const dragStatus = info.event.extendedProps?.status;
    if (UNSCHEDULE_BLOCKED_STATUSES.includes(dragStatus)) {
      Swal.fire(`❌ งานสถานะ "${dragStatus}" ไม่สามารถย้ายกลับไปแผนล่วงหน้าได้`);
      return;
    }
    handleUnscheduleViaDrag(info.event.id);
  };

  // ✅ ส่งออกงานที่กรองอยู่เป็นไฟล์ Excel (.xlsx) จริงพร้อมสี/หัวตาราง/ตัวกรอง/ยอดรวม — แทน CSV เดิม
  // ซึ่งเป็นข้อความล้วน ใส่รูปแบบอะไรไม่ได้เลย และ Excel ยังแปลงค่าเองมั่วๆ (ครั้งที่ "1/3" → วันที่)
  // โหลดโมดูลตอนกดจริงเท่านั้น (exceljs เป็นไลบรารีก้อนใหญ่) ไม่ให้ไปถ่วงเวลาโหลดหน้าปฏิทินของทุกคน
  const [exportingExcel, setExportingExcel] = useState(false);
  // ✅ งานที่กำลังจะออกใบส่งมอบ — หน้าแก้ไขงาน (SweetAlert2 + HTML ล้วน) เรนเดอร์ React Dialog
  // เองไม่ได้ จึงส่ง callback เข้าไปให้มันเรียกกลับมาตั้ง state ตัวนี้แทน แล้วเรนเดอร์กล่องที่นี่
  const [deliveryNoteJob, setDeliveryNoteJob] = useState(null);
  // ✅ งานที่กำลังจะออกใบแจ้งเข้าปฏิบัติงาน — กลไกเดียวกับ deliveryNoteJob ทุกประการ
  const [workNoticeJob, setWorkNoticeJob] = useState(null);
  const handleExportExcel = async () => {
    if (exportingExcel || filteredCalendarEvents.length === 0) return;
    setExportingExcel(true);
    try {
      const { exportCalendarEventsToExcel } = await import("@/features/calendar/utils/calendarExcelExport");
      // ✅ บอกในไฟล์ด้วยว่ายอดนี้มาจากการกรองแบบไหน — กันเปิดไฟล์ย้อนหลังแล้วเข้าใจผิดว่าเป็นงานทั้งระบบ
      const filterParts = [];
      if (searchTerm.trim()) filterParts.push(`ค้นหา "${searchTerm.trim()}"`);
      if (selectedJobType) filterParts.push(`ประเภทงาน ${selectedJobType}`);
      if (selectedSystem) filterParts.push(`ระบบ ${selectedSystem}`);
      if (selectedStatus) filterParts.push(`สถานะ ${selectedStatus}`);
      if (selectedApproval) filterParts.push(`การอนุมัติ ${selectedApproval}`);
      if (selectedTechnician) {
        const techName = technicianOptions.find((t) => t._id === selectedTechnician)?.fname;
        if (techName) filterParts.push(`ช่าง ${techName}`);
      }

      await exportCalendarEventsToExcel({
        // ✅ เรียงตามวันที่เริ่มเหมือนที่ตาเห็นบนปฏิทิน ไม่ใช่ลำดับดิบที่ดึงมาจากฐานข้อมูล
        rows: [...filteredCalendarEvents].sort((a, b) => new Date(a.start) - new Date(b.start)),
        meta: {
          fileName: `ตารางงาน-${moment().format("YYYYMMDD")}.xlsx`,
          filterSummary: filterParts.length > 0 ? `ตัวกรอง: ${filterParts.join(" · ")}` : "ไม่ได้กรองเพิ่มเติม",
          exportedAt: formatThai(moment(), "DD/MM/YYYY HH:mm"),
        },
        // ✅ ส่งฟังก์ชันที่หน้าจอใช้อยู่เข้าไปด้วย เพื่อให้ข้อมูลในไฟล์ตรงกับที่เห็นบนจอเป๊ะๆ เสมอ
        classifyJob,
        getApprovalState,
        formatRoundLabel,
      });
    } catch (error) {
      console.error("❌ Error exporting calendar to Excel:", error);
      Swal.fire({
        title: "ส่งออกไม่สำเร็จ",
        text: error?.message || "กรุณาลองใหม่อีกครั้ง",
        icon: "error",
      });
    } finally {
      setExportingExcel(false);
    }
  };

  const handleHighlightWeekends = useCallback(() => {
    requestAnimationFrame(() => {
      document.querySelectorAll(".fc-daygrid-day").forEach((cell) => {
        const dateStr = cell.getAttribute("data-date");
        const date = moment(dateStr);
        const currentMonth = moment(
          calendarRef.current.getApi().getDate(),
        ).month();
        const isWeekend = [6, 7].includes(date.isoWeekday());
        const isSameMonth = date.month() === currentMonth;

        // ✅ เดิมเหลืองอ่อน (#FFFFF4) ไม่ตรงกับธีมสีแดง — เปลี่ยนเป็นแดงอ่อนแบบเดียวกับที่ใช้กับ
        // เซลล์ "วันนี้" (ถ้าตรงกับวันนี้พอดี .fc-day-today จะ !important ทับสีนี้เองอยู่แล้ว)
        cell.style.backgroundColor = isWeekend && isSameMonth ? "#fef2f2" : "";
      });
    });
  }, []);

  // ✅ เดิมเดือนที่แสดงในปฏิทินจริง กับเดือนที่เปิดดูในแผงงานล่วงหน้าเป็นคนละ state แยกกันเลย
  // เลื่อนเดือนฝั่งไหนก็ไม่กระทบอีกฝั่ง สับสนว่าทำไมดูกันคนละเดือน — sync ให้เป็นเดือนเดียวกันเสมอ
  // ⚠️ ใช้ info.view.currentStart ที่ FullCalendar ส่งมาให้เอง แทน calendarRef.current.getApi()
  // — ตอน mount ครั้งแรก datesSet จะยิงจาก componentDidMount ภายในก่อนที่ React จะ assign ref
  // ให้ calendarRef เสร็จ (ref ยังเป็น null อยู่) ทำให้ .getApi() พังทันทีถ้าอ่านจาก ref ตรงๆ
  const handleDatesSet = useCallback((info) => {
    handleHighlightWeekends();
    const calendarMonth = moment(info.view.currentStart).format("YYYY-MM");
    setDraftMonth((prev) => (prev === calendarMonth ? prev : calendarMonth));
  }, [handleHighlightWeekends]);

  // ✅ ทิศทางกลับกัน: เลื่อนเดือนจากปุ่ม ‹ › ของแผงงานล่วงหน้าเอง ก็ต้องพาปฏิทินจริงตามไปเดือน
  // เดียวกันด้วย (handleDatesSet ด้านบนจะ sync draftMonth ให้ตรงกันเองอัตโนมัติหลังจากนี้)
  const handleDraftMonthChange = useCallback((newMonth) => {
    setDraftMonth(newMonth);
    calendarRef.current?.getApi()?.gotoDate(moment(newMonth, "YYYY-MM").format("YYYY-MM-DD"));
  }, []);

  const [employeeList, setEmployeeList] = useState([]);
  const [jobTypeOptions, setJobTypeOptions] = useState([]);
  const [systemOptions, setSystemOptions] = useState([]);

  useEffect(() => {
    (async () => {
      const res = await AuthService.getAllUserData();
      setEmployeeList(res?.allUser || []);
    })();
  }, []);

  // ✅ ตัวเลือก "ประเภทงาน"/"ระบบ" ในตัวกรอง — เดิมดึงเฉพาะค่าที่เคยใช้ในงานที่มีอยู่แล้ว
  // (เดายาก/ไม่ครบถ้วน) ตอนนี้มีตารางกลาง "ประเภทงาน"/"ระบบ" จัดการได้จริงที่ /worktype แล้ว
  // ดึงจากตรงนั้นแทน ให้ครบทุกตัวเลือกที่มีจริงในระบบ ไม่ใช่แค่ที่เคยถูกใช้ไปแล้ว
  const fetchLookupOptions = async () => {
    const [jobTypes, systemTypes] = await Promise.all([
      JobTypeService.getAll().catch(() => ({ items: [] })),
      SystemTypeService.getAll().catch(() => ({ items: [] })),
    ]);
    setJobTypeOptions((jobTypes?.items || []).map((t) => t.name).sort());
    setSystemOptions((systemTypes?.items || []).map((s) => s.name).sort());
  };

  useEffect(() => {
    fetchLookupOptions();
  }, []);

  // ✅ ช่างเทคนิคทั้งหมด — ใช้สร้าง dropdown ค้นหางานของช่างแต่ละคน (resPerson เก็บเป็น _id)
  const technicianOptions = useMemo(
    () => employeeList.filter((u) => isRole(u, ROLES.TECHNICIAN)),
    [employeeList],
  );

  // ✅ รายชื่อเซล — ใช้แทน technicianOptions ตอนแอดมิน/ผู้จัดการเปิดเมนู "ตารางงานเซล" กรองดูของ
  // เซลแต่ละคน (เซลเองเห็นแค่นัดของตัวเองอยู่แล้วจากขอบเขตฝั่ง server ไม่ต้องมีตัวกรองนี้)
  const salespersonOptions = useMemo(
    () => employeeList.filter((u) => isRole(u, ROLES.SALE)),
    [employeeList],
  );

  // ⚠️ แก้ตามที่ผู้ใช้ขอ: ฉบับร่างของ "สัญญา" (มี contractGroupId — สร้างจากฟอร์ม "เพิ่มสัญญาใหม่" ใน
  // ContractOverview.js ตอนยังไม่ระบุวันที่เข้างานครั้งที่ 1) ไม่ควรโผล่ปนอยู่ในแผงงานล่วงหน้าของหน้า
  // ปฏิทินนี้เลย — เพราะแผงนี้ออกแบบไว้ให้ลบ/ลากลงตารางได้อย่างอิสระสำหรับงานทั่วไป/โปรเจคที่ยังไม่มี
  // วันที่ ถ้ามีคนกดลบฉบับร่างของสัญญาจากตรงนี้โดยไม่รู้ว่าเป็นตัวยึดของทั้งสัญญา จะทำให้สัญญาทั้งอัน
  // หายไปจากหน้า "ภาพรวมงาน" ทันที — ให้ไปเพิ่มวันที่ครั้งที่ 1 ผ่านปุ่ม "+" ในตาราง "ภาพรวมงาน" แทน
  // เท่านั้น (ดู openAddVisitDialog ที่นั่น) ฉบับร่างของสัญญายังคงอยู่ในระบบ/นับรวมในตารางตามปกติ แค่ไม่
  // แสดงในแผงนี้เท่านั้น
  const visibleDrafts = useMemo(
    () => drafts.filter((d) => !d.contractGroupId),
    [drafts],
  );

  // ✅ กรอง drafts ที่ดึงมาทั้งหมดให้เหลือเฉพาะเดือนที่กำลังเปิดดูอยู่ในแผงงานล่วงหน้า
  const draftsForMonth = useMemo(
    () => visibleDrafts.filter((d) => d.plannedMonth === draftMonth),
    [visibleDrafts, draftMonth],
  );

  // ✅ ยอดรวม "งานรออนุมัติ" — แอดมิน/manager เห็นทั้งระบบ (มีสิทธิ์อนุมัติได้ทุกงาน) คนอื่นเห็นแค่ของ
  // ตัวเอง กันโชว์ตัวเลขที่กดอนุมัติเองไม่ได้อยู่ดี ดูแล้วงงว่าทำไมกดไม่ได้ — นับรวมทั้งงานที่มีวันที่แล้ว
  // (events) และแผนงานล่วงหน้าที่ยังไม่มีวันที่ (drafts) เข้าด้วยกัน
  const pendingApprovalCount = useMemo(
    () => countPendingJobs(events, drafts, { userId, isAdminOrManager }),
    [events, drafts, userId, isAdminOrManager]
  );

  // ⚠️ selectedSystem/selectedApproval ไม่มีช่องให้กรอกในแผงของฝ่ายขาย (ดู JSX ด้านล่าง) แต่ค่าเดิม
  // อาจค้างมาจากตอนเปิดปฏิทินช่างก่อนสลับมา (คนละ query string บนหน้าเดียวกัน ไม่ได้ remount) —
  // ไม่นับรวมตอนอยู่ในโลกฝ่ายขาย ไม่งั้น badge จำนวนตัวกรองจะขึ้นเลขที่ไม่ตรงกับที่เห็นบนจอ
  const activeFilterCount = [
    selectedTechnician, selectedStatus, selectedJobType,
    ...(isSalesView ? [] : [selectedSystem, selectedApproval]),
  ].filter(Boolean).length;
  const hasActiveFilters = Boolean(searchTerm) || activeFilterCount > 0;
  const clearFilters = () => {
    setSearchTerm("");
    setSelectedTechnician("");
    setSelectedStatus("");
    setSelectedJobType("");
    setSelectedSystem("");
    setSelectedApproval("");
  };

  const filteredCalendarEvents = useMemo(() => {
    const keyword = searchTerm.toLowerCase();
    // เผื่องานเก่าที่ยังไม่มี resPerson (ผูกด้วยชื่อ team แทน) ให้ยังกรองเจอได้เหมือนกัน
    const selectedTechnicianName = technicianOptions.find((t) => t._id === selectedTechnician)?.fname;

    return events.filter((event) => {
      // หาคนที่เป็นเจ้าของ event จาก employeeList
      const owner = employeeList.find(
        (emp) =>
          emp._id?.toString() === event.extendedProps?.userId?.toString(),
      );

      const ownerName = owner?.username?.toLowerCase() || "";

      const matchesKeyword = [
        event.title ?? "",
        event.site ?? "",
        event.company ?? "",
        event.system ?? "",
        event.team ?? "",
        event.time?.toString() ?? "",
        ownerName, // ✅ เพิ่มชื่อเจ้าของเข้าไปในเงื่อนไข search
      ].some((field) => field.toLowerCase().includes(keyword));

      // 🐛 ที่แก้ (ผู้ใช้แจ้ง: "อัปเดตสถานะแล้วดูเพี้ยนๆ"): นัดของเซลไม่มี resPerson/team/system
      // และสถานะเป็นคนละชุดกับงานช่าง (นัดหมายแล้ว/เข้าพบแล้ว/... ไม่ใช่ กำลังรอยืนยัน/ยืนยันแล้ว/...)
      // — ตัวกรองเดิมเทียบกับคำศัพท์ของช่างเสมอ นัดของเซลจึงไม่ตรงเงื่อนไขไหนเลยเวลาเลือกกรอง
      // ✅ แยกเทียบตามโลกที่กำลังดูอยู่ — matchesTechnician กลายเป็น "กรองตามเซล" โดยเทียบ userId
      // (นัดของเซลผูกกับ userId ของผู้สร้าง ไม่ใช่ resPerson/team ซึ่งเป็นแนวคิดของงานช่าง)
      const matchesTechnician = isSalesView
        ? !selectedTechnician || String(event.userId || "") === String(selectedTechnician)
        : !selectedTechnician ||
          event.resPerson === selectedTechnician ||
          (!event.resPerson && selectedTechnicianName && event.team === selectedTechnicianName);

      const matchesStatus = isSalesView
        ? !selectedStatus || toSalesStatus(event.status) === selectedStatus
        : !selectedStatus || event.status === selectedStatus;
      const matchesJobType = !selectedJobType || event.title === selectedJobType;
      // ⚠️ นัดของเซลไม่มีแนวคิด "ระบบ"/"การอนุมัติ" เลย (ดูคอมเมนต์ที่ core.js ฝั่ง server —
      // เซลไม่ต้องรออนุมัติ) ตัวกรองสองอันนี้จึงไม่มีให้เลือกในแผงของเซล (ดู JSX ด้านล่าง) แต่
      // ยังต้องส่งผ่านเสมอเป็น true กัน state เก่าจากตอนสลับมาจากปฏิทินช่างค้างกรองอยู่แบบไม่รู้ตัว
      const matchesSystem = isSalesView || !selectedSystem || event.system === selectedSystem;
      const matchesApproval = isSalesView || !selectedApproval || getApprovalState(event) === selectedApproval;

      return matchesKeyword && matchesTechnician && matchesStatus && matchesJobType && matchesSystem && matchesApproval;
    });
  }, [events, searchTerm, employeeList, selectedTechnician, selectedStatus, selectedJobType, selectedSystem, selectedApproval, technicianOptions, isSalesView]);

  const getStatusIcon = useCallback((status) => {
    const icons = {
      กำลังรอยืนยัน: faHourglassHalf,
      ยืนยันแล้ว: faCheck,
      กำลังดำเนินการ: faClockRotateLeft,
      ดำเนินการเสร็จสิ้น: faCheckDouble,
    };
    return icons[status] || null;
  }, []);

  const statusLegend = [
    // { label: "ยกเลิก", color: "#d33", icon: faTimesCircle },
    { label: "กำลังรอยืนยัน", color: "#888888", icon: faHourglassHalf },
    { label: "ยืนยันแล้ว", color: "#0c49ac", icon: faCheck },
    { label: "กำลังดำเนินการ", color: "#a1b50b", icon: faClockRotateLeft },
    // { label: "เสนอราคาแก้ไขแล้ว", color: "#f39c12", icon: faFileSignature },
    // { label: "วางบิลแล้วรอเก็บเงิน", color: "#9b59b6", icon: faFileInvoiceDollar },
    { label: "ดำเนินการเสร็จสิ้น", color: "#18b007", icon: faCheckDouble },
  ];

  // ✅ เดิมมี 2 dropdown แยกกัน ("ทุกสถานะ" กับ "ทุกสถานะอนุมัติ") ผู้ใช้ต้องเช็ค 2 ที่ถึงจะรู้ว่างานไหน
  // ต้องดูแล — รวมเป็นตัวเดียวให้เลือกสถานะงาน "หรือ" สถานะอนุมัติจากช่องเดียวกัน ยังคงเก็บเป็น 2 state
  // (selectedStatus/selectedApproval) เหมือนเดิมข้างในเพื่อไม่แตะตรรกะกรอง (matchesStatus/matchesApproval
  // ด้านบน) ใช้ prefix แยกว่าค่าที่เลือกเป็นสถานะงานหรือสถานะอนุมัติแค่ตอนแสดงผล/รับ event เท่านั้น
  const combinedStatusValue = selectedApproval ? `approval:${selectedApproval}` : selectedStatus ? `status:${selectedStatus}` : "";
  const handleCombinedStatusChange = (val) => {
    if (val.startsWith("approval:")) {
      setSelectedApproval(val.slice("approval:".length));
      setSelectedStatus("");
    } else if (val.startsWith("status:")) {
      setSelectedStatus(val.slice("status:".length));
      setSelectedApproval("");
    } else {
      setSelectedStatus("");
      setSelectedApproval("");
    }
  };


  /**
   * 🐛 ที่แก้ (ผู้ใช้แจ้งซ้ำ: "ยัง resized ไม่ได้เลย ถ้างานไหนมีใส่เวลา" / "ไม่มี icon ลากขึ้นเลย"):
   * ไล่เข้าไปดูซอร์สของ FullCalemdar เองแล้ว (@fullcalendar/core/internal-common.js) พบว่าไม่ใช่
   * config ที่ตั้งพลาด แต่เป็นข้อจำกัดที่ฝังอยู่ในอัลกอริทึมของมันเอง: มุมมองเดือน (dayGrid) ตัดสินว่า
   * event "จบที่ขอบวัน" (isEnd) โดยเทียบ event.end กับขอบเที่ยงคืนของวันนั้นตรงๆ
   * (isEnd = normalRange.end === slicedRange.end) — งาน allDay เก็บ end เป็นเที่ยงคืนอยู่แล้วเสมอ
   * จึงตรงกันเป๊ะ ได้ isEnd:true ทุกครั้ง แต่งานที่มีเวลา (เช่นจบ 16:30) ไม่มีวันตรงกับเที่ยงคืนเลย
   * isEnd จึงเป็น false เสมอ → ไม่มีการ์ดไหนได้ handle ลากขยายจากมุมมองเดือนเลยไม่ว่าจะตั้งค่าอะไร
   * ยืนยันจริงด้วยการเทียบ: สลับไปมุมมอง "สัปดาห์" (timeGrid) นัดเดียวกันมี resize handle ทันที
   * เพราะมุมมองนั้นไม่ได้ตัดสินจากขอบเที่ยงคืนแบบนี้ — เทียบกับปฏิทินทั่วไป (Google Calendar ฯลฯ)
   * ก็ลากปรับเวลานัดในมุมมองเดือนไม่ได้เหมือนกัน ต้องสลับไปสัปดาห์/วันเท่านั้น
   *
   * ✅ ผู้ใช้ยืนยันว่าต้องการใช้งานในมุมมองเดือนได้จริง — สร้าง handle ลากขยายของตัวเองแยกต่างหาก
   * (ไม่พึ่ง eventResize ของ FullCalendar เลย) เฉพาะงานที่มีเวลา (allDay:false) เท่านั้น โดย:
   *   1) วาดแท่งจับเล็กๆ ที่ขอบขวาของการ์ดเองใน eventContent ด้านล่าง (data-ec-resize="1")
   *   2) ฟัง pointer event ที่ document ทั้งก้อน (ไม่ใช่ต่อการ์ด) เพราะการ์ดถูกสร้าง/ทำลายใหม่ตลอด
   *      เวลา FullCalendar re-render — ผูกครั้งเดียวที่นี่ ไม่ต้อง cleanup/attach ซ้ำทุกครั้ง
   *   3) ระหว่างลาก หาช่องวันที่ใต้เมาส์ด้วย elementFromPoint แล้วไฮไลต์ไว้ให้เห็นว่าจะปล่อยตรงไหน
   *   4) ปล่อยเมาส์ = ขยาย "วันสิ้นสุด" ไปแตะช่องนั้น — กลายเป็นงานข้ามวัน (allDay:true) เหมือนงาน
   *      ของช่างที่ลากขยายในมุมมองเดือนได้ปกติอยู่แล้ว (เวลาที่กรอกไว้ยังอยู่ครบ กลายเป็นข้อมูล
   *      อ้างอิงเวลาเข้า/เลิกแต่ละวันแทน ไม่ใช่ตัวกำหนดกรอบเวลาบนปฏิทินอีกต่อไป — เทียบพฤติกรรม
   *      เดียวกับตอนสร้าง/แก้ไขนัดหลายวันในฟอร์ม ดู AddSalesAppointment.js/EditSalesAppointment.js)
   *   5) ลากไปวันเดียวกับที่เริ่มอยู่แล้ว = ไม่ทำอะไร (ยังเป็นนัดตรงเวลาเหมือนเดิม) ลากไปวันก่อนวันเริ่ม
   *      ไม่ได้เลย (เตือนแล้วไม่ทำอะไร)
   */
  useEffect(() => {
    let drag = null; // { eventId, moved }

    const findDayCell = (x, y) =>
      document.elementFromPoint(x, y)?.closest?.(".fc-daygrid-day[data-date]") || null;

    const clearHighlight = () => {
      document.querySelectorAll(".ec-day-drop-target").forEach((el) => el.classList.remove("ec-day-drop-target"));
    };

    const getPoint = (e) => (e.touches?.[0] || e.changedTouches?.[0] || e);

    // 🐛 ที่แก้ (ทดสอบจริงแล้วพบ): ลากจากแท่งจับนี้ กลับกลายเป็นลากทั้งการ์ดไปวันใหม่แทนการขยาย —
    // เพราะ mousedown ตัวเดียวกันไปโดน listener ลากทั้งการ์ดของ FullCalendar เองด้วย (ปกติมันกัน
    // ตัวเองด้วยการเช็ค elementClosest(target, '.fc-event-resizer') แต่ handle ของเราคนละคลาส มันจึง
    // ไม่รู้จัก) — จะยืมคลาส .fc-event-resizer ของมันมาใช้ก็เสี่ยงชนกับระบบ resize จริงของมันเองอีกที
    // (เช็คแค่ selector ไม่เช็คว่า resizable จริงไหม) ✅ ทางที่ปลอดภัยกว่า: ดัก mousedown ที่ document
    // ใน "capture phase" (ก่อนจะไหลลงไปถึง element เป้าหมายด้วยซ้ำ) แล้ว stopPropagation() ตรงนั้น
    // เลย — event จะไม่มีวันไปถึง listener ของ FullCalendar ที่ผูกอยู่ลึกกว่าเราเลย ไม่ต้องพึ่ง
    // ชื่อคลาสภายในของไลบรารีที่อาจเปลี่ยนได้ในเวอร์ชันถัดไป
    const onDown = (e) => {
      // ⚠️ กดที่ปุ่มพับ/กางการ์ด ต้องไม่เริ่มลากงาน — หยุดตั้งแต่ capture phase เหมือน data-ec-resize
      // (ดูเหตุผลเต็มที่คอมเมนต์ด้านบน) ไม่งั้นแค่แตะปุ่มก็กลายเป็นลากงานย้ายวันทันทีบนทัชสกรีน
      if (e.target.closest?.('[data-ec-toggle="1"]')) {
        e.stopPropagation();
        return;
      }
      // ปุ่มจับลากจัดลำดับมีตัวจัดการของตัวเอง (ดู useEffect "ลากจัดลำดับงานในวันเดียวกัน")
      if (e.target.closest?.('[data-ec-grip="1"]')) {
        e.stopPropagation();
        return;
      }
      const handle = e.target.closest?.('[data-ec-resize="1"]');
      if (!handle) return;
      e.preventDefault();
      e.stopPropagation();
      drag = { eventId: handle.dataset.eventId, moved: false };
      document.body.style.userSelect = "none";
    };

    const onMove = (e) => {
      if (!drag) return;
      drag.moved = true;
      const { clientX, clientY } = getPoint(e);
      clearHighlight();
      findDayCell(clientX, clientY)?.classList.add("ec-day-drop-target");
    };

    const onUp = async (e) => {
      if (!drag) return;
      const { eventId, moved } = drag;
      drag = null;
      document.body.style.userSelect = "";
      clearHighlight();
      if (!moved) return; // แค่กดเฉยๆ ไม่ได้ลาก ไม่ต้องทำอะไร (กันชนกับการคลิกเปิดฟอร์มแก้ไข)

      const { clientX, clientY } = getPoint(e);
      const cell = findDayCell(clientX, clientY);
      const targetDateStr = cell?.getAttribute("data-date");
      if (!targetDateStr) return;

      const ev = events.find((x) => String(x._id) === String(eventId));
      if (!ev) return;
      const startDateStr = moment(ev.start).format("YYYY-MM-DD");
      if (moment(targetDateStr).isBefore(startDateStr)) {
        Swal.fire({
          toast: true, position: "top", icon: "warning",
          title: "ลากไปก่อนวันเริ่มไม่ได้", showConfirmButton: false, timer: 2000,
        });
        return;
      }
      if (targetDateStr === startDateStr) return; // ลากกลับที่เดิม ไม่มีอะไรเปลี่ยน

      try {
        await EventService.UpdateEvent(eventId, {
          allDay: true,
          start: startDateStr,
          end: moment(targetDateStr).add(1, "day").format("YYYY-MM-DD"), // exclusive ตามแบบแผนทั้งแอป
        });
        await fetchEventsFromDB();
        Swal.fire({
          toast: true, position: "top", icon: "success",
          title: `ขยายเป็น ${moment(startDateStr).locale("th").format("D MMM")} – ${moment(targetDateStr).locale("th").format("D MMM YYYY")}`,
          showConfirmButton: false, timer: 2200,
        });
      } catch (err) {
        Swal.fire("เกิดข้อผิดพลาด", err?.response?.data?.message || "ขยายวันที่ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", "error");
      }
    };

    // ⚠️ true = capture phase — ต้องดักก่อน FullCalendar เสมอ (ดูเหตุผลเต็มที่ onDown ด้านบน)
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchstart", onDown, { capture: true, passive: false });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onUp);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchstart", onDown, true);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  /**
   * ปุ่มพับ/กางการ์ดงาน — ดักคลิกที่ document แล้วสลับคลาสบน DOM ตรงๆ
   *
   * ⚠️ ต้องดักใน capture phase + stopPropagation — ถ้าปล่อยให้ event ไหลต่อ FullCalendar จะจับเป็น
   * eventClick แล้วเปิดฟอร์มแก้ไขงานทับทันที กลายเป็นกดดูรายละเอียดไม่ได้เลยสักครั้ง
   * ⚠️ ไม่แตะ React state โดยตั้งใจ — การ์ดใบอื่นทั้งเดือนไม่ต้อง re-render ตาม การกางจึงลื่นสนิท
   * และไม่ไปรีเซ็ตอะไรที่ค้างอยู่ (เช่นฟอร์มที่เปิดค้าง/ตำแหน่ง scroll)
   * ⚠️ ผูกครั้งเดียวตอน mount ([]) — ตัวดักอ่านจาก DOM/Set เสมอ ไม่ได้ปิดทับค่าจาก render รอบไหน
   */
  useEffect(() => {
    /**
     * 🐛 BUG ที่แก้ (กางแล้วการ์ดทับกัน / พับแล้วเหลือช่องว่างค้าง / ขยับแบบแข็งๆ):
     *
     * งานที่กินหลายวันในมุมมองเดือนถูก FullCalendar วางเป็นแท่ง absolute โดยคำนวณ "top" ของแต่ละชั้น
     * (level) มาจากความสูงที่วัดได้ตอน render — พอเนื้อหาในการ์ดเปลี่ยนความสูงทีหลัง ค่า top ของแท่ง
     * ชั้นถัดไปยังเป็นค่าเดิม ผลคือกางแล้วทับกัน และพับแล้วเหลือช่องว่างค้างไว้เท่าความสูงเดิม
     *
     * ✅ วิธีแก้ 2 ชั้นที่ต้องทำคู่กัน:
     *   1) ให้ปฏิทินวัดใหม่แล้วจัดแถวใหม่ด้วย updateSize() ของตัวมันเอง → ตำแหน่ง "ปลายทาง" ถูกต้อง
     *      ทันที แถวของวันยืด/หดจริง และไม่มีการทับกันเลยแม้แต่เฟรมเดียว
     *   2) อนิเมตด้วยเทคนิค FLIP (First-Last-Invert-Play) → จำตำแหน่งเดิมไว้ก่อน พอ layout ใหม่เสร็จ
     *      ก็ดึงทุกแท่งกลับไปที่เดิมด้วย transform แล้วค่อยปล่อยให้ไหลไปตำแหน่งใหม่
     *
     * ⚠️ ทำไมต้อง FLIP ไม่ใช่อนิเมตความสูงตรงๆ: ถ้าอนิเมตความสูง ระหว่างนั้นแท่งอื่นยังอยู่ตำแหน่งเดิม
     * (top เป็นค่าคงที่ที่ FullCalendar ใส่ไว้) การ์ดที่กำลังขยายจะล้นไปทับ หรือไม่ก็ต้องสั่ง updateSize()
     * ใหม่ทุกเฟรมซึ่งหน่วงทั้งเดือน — FLIP ได้ทั้งความถูกต้องของ layout และความลื่นพร้อมกัน เพราะ
     * transform ไม่กระทบ layout เลย (เบราว์เซอร์อนิเมตบน compositor ไม่ต้องคำนวณ layout ซ้ำสักเฟรม)
     *
     * ⚠️ เทียบตำแหน่งด้วย "id ของงาน" ไม่ใช่ตัว element — updateSize() อาจสร้าง DOM ใหม่ ถ้าเก็บ
     * reference ของ element ไว้ตรงๆ จะกลายเป็นอ้างถึงของที่หลุดจากหน้าจอไปแล้วแล้วอนิเมตไม่ขึ้น
     */
    const HARNESS_SELECTOR = ".fc-daygrid-event-harness, .fc-timegrid-event-harness";
    // ⚠️ ต้องเท่ากับ --ec-anim ใน index.css เป๊ะๆ — การ์ดที่กำลังยืด/หด กับแท่งงานที่กำลังเลื่อนหลบ
    // ต้องวิ่งด้วยจังหวะและ easing เดียวกัน ไม่งั้นจะเห็นเป็น 2 จังหวะซ้อนกันแล้วรู้สึกสะดุด
    const FLIP_MS = 240;
    // ⚠️ ต้องตรงกับ easing ของ .ec-card.ec-anim-height ใน index.css เป๊ะๆ — การ์ดที่กำลังยืด/หด
    // กับแท่งงานที่กำลังเลื่อนหลบ ต้องวิ่งเป็นเส้นโค้งเดียวกัน ไม่งั้นเห็นเป็น 2 จังหวะแล้วรู้สึกสะดุด
    const FLIP_EASE = "cubic-bezier(.4, 0, .2, 1)";

    /**
     * คีย์ประจำ "ชิ้นส่วนของแท่งงาน" หนึ่งชิ้น
     *
     * 🐛 BUG ที่แก้ (กดเปิดงานหนึ่ง แล้วงานที่ยาวข้ามสัปดาห์กระโดดแปลกๆ): งานที่กินหลายวันจนล้นไป
     * สัปดาห์ถัดไปจะถูก FullCalendar ตัดเป็น "หลายชิ้น" คนละแถวกัน แต่ทุกชิ้นมี event id เดียวกันหมด
     * — เดิมใช้ id เป็นคีย์ตรงๆ ตำแหน่งของชิ้นหลังจึงไปเขียนทับชิ้นแรก พอ invert ก็ดึงทั้งสองชิ้นไป
     * ที่ตำแหน่งเดียวกัน (ของอีกสัปดาห์หนึ่ง) = กระโดดข้ามแถวแล้ววิ่งกลับ
     * ✅ ผูกวันที่ของช่องที่ชิ้นนั้นอยู่เข้าไปด้วย ชิ้นแต่ละชิ้นจึงมีคีย์ของตัวเองไม่ชนกัน
     */
    const segKeyOf = (card) => {
      const cell = card.closest("[data-date]");
      return `card:${card.getAttribute("data-ec-card")}@${cell?.getAttribute("data-date") || ""}`;
    };

    /**
     * จำตำแหน่งเดิมของ "แท่งงานทุกชิ้น" ตอนการ์ดยืด/หด
     *
     * 🐛 BUG ที่แก้ (แท่งงานบางใบกระโดดข้ามแถวแล้ววิ่งกลับ): เคยใส่ transform ให้ <tr> ของสัปดาห์ด้วย
     * เพื่อให้เส้นตารางเลื่อนตามไปด้วย — แต่ transform ของแม่ส่งผลกับลูกที่อยู่ข้างในเสมอ พอชดเชยที่
     * ลูกอีกชั้นในบางกรณีจึงกลายเป็นเลื่อนซ้ำสองเท่า (เห็นชัดมากกับแท่งที่ถูกตัดข้ามสัปดาห์ ซึ่งมีชิ้นส่วน
     * อยู่คนละแถวกัน) ✅ อนิเมตเฉพาะ "แท่งงาน" ชั้นเดียวจบ ไม่มีแม่-ลูกซ้อนกันให้คำนวณพลาดได้อีก
     * ⚠️ เส้นตาราง/ความสูงแถวจะปรับทันทีโดยไม่อนิเมต ซึ่งแทบไม่มีใครสังเกต (เป็นเส้นจางๆ พื้นหลัง)
     * ต่างจากแท่งงานที่เป็นก้อนสีทึบมีตัวหนังสือ — ถ้าอันนั้นกระโดดคือเห็นชัดทันที
     */
    const snapshotTops = () => {
      const map = new Map();
      document.querySelectorAll("[data-ec-card]").forEach((card) => {
        const h = card.closest(HARNESS_SELECTOR);
        if (h) map.set(segKeyOf(card), h.getBoundingClientRect().top);
      });
      return map;
    };

    /**
     * เปลี่ยนสถานะการ์ดแล้วจัดแถวใหม่พร้อมอนิเมชันลื่นๆ
     *
     * 🐛 BUG ที่แก้ (แท่งงานใบอื่นไม่ขยับตาม แล้วทับกันตลอดอนิเมชัน):
     * ลำดับสำคัญมาก — updateSize() วัด "ความสูงจริงของการ์ด ณ วินาทีที่เรียก" ถ้าเรียกตอนที่การ์ด
     * กำลังค่อยๆ ยืด (transition ยังวิ่งอยู่) มันจะวัดได้ความสูงเก่าแล้วจัดแถวเหมือนไม่มีอะไรเปลี่ยน
     * → แท่งอื่นไม่ถูกดันลง → การ์ดที่ยืดเสร็จแล้วก็ทับใบถัดไปอยู่ดี
     *
     * ✅ ลำดับที่ถูกต้อง (FLIP เต็มรูปแบบ ทั้งตำแหน่งและความสูง):
     *   1. จำตำแหน่งเดิมของทุกชิ้นไว้ (First)
     *   2. สลับคลาสโดย "ปิดอนิเมชันชั่วคราว" → การ์ดกระโดดไปความสูงสุดท้ายทันที
     *   3. updateSize() → ปฏิทินวัดความสูงสุดท้ายที่ถูกต้อง แล้วจองตำแหน่งปลายทางให้ทุกแท่ง (Last)
     *   4. ดึงทุกอย่างกลับไปสภาพเดิมด้วย transform + บังคับการ์ดให้กลับไปความสูงเริ่มต้น (Invert)
     *   5. เฟรมถัดไปเปิดอนิเมชันแล้วปล่อย → ทุกอย่างไหลไปที่ปลายทางพร้อมกัน (Play)
     *
     * ⚠️ ผลลัพธ์: พื้นที่ปลายทางถูกจองไว้ตั้งแต่เฟรมแรก การ์ดจึงค่อยๆ ขยายเข้าไปในที่ว่างของตัวเอง
     * ไม่มีทางทับใบอื่นได้เลยแม้แต่เฟรมเดียว ขณะที่แท่งอื่นก็เลื่อนหลบไปพร้อมกันด้วยจังหวะเดียวกัน
     */
    const reflowWithAnimation = (mutate) => {
      const before = snapshotTops();
      const cards = [...document.querySelectorAll("[data-ec-card]")];
      // จำสถานะเดิมด้วย "id ของงาน" ไม่ใช่ตัว element — element ชุดนี้อาจถูกสร้างใหม่หลัง updateSize()
      const wasExpandedById = new Map(
        cards.map((c) => [c.getAttribute("data-ec-card"), c.classList.contains("is-expanded")])
      );
      // 🐛 BUG ที่แก้ (กดเปิดใบเดียวแต่การ์ดอื่นอนิเมตตามหมด): เดิมใส่คลาส invert ให้ "ทุกใบ" ซึ่งบังคับ
      // ใบที่กางอยู่แล้วให้ยุบกลับไป 0fr ชั่วขณะแล้วค่อยกางใหม่ = เห็นทั้งหน้าจอกระพริบขยับพร้อมกันหมด
      // ✅ จำสถานะก่อนหน้าไว้ แล้ว invert เฉพาะใบที่ "สถานะเปลี่ยนจริง" เท่านั้น ใบที่ไม่ได้แตะจะอยู่นิ่ง
      // (ยังเลื่อนตำแหน่งตามแถวได้ตามปกติผ่าน transform ซึ่งเป็นคนละเรื่องกับการยืด/หดตัวเอง)
      // (2) ปิดอนิเมชันชั่วคราวแล้วสลับคลาส — ให้ความสูงเป็นค่าสุดท้ายทันที
      cards.forEach((c) => c.classList.add("ec-anim-off"));
      mutate();

      // (3) ให้ปฏิทินวัดความสูงสุดท้ายแล้วจัดตำแหน่งปลายทาง
      calendarRef.current?.getApi()?.updateSize();

      // 🐛 BUG ที่แก้ (บางแท่งกระโดดข้ามแถวแล้ววิ่งกลับ): updateSize() ทำให้ FullCalendar สร้าง DOM
      // ของงานใหม่ได้ — element ที่เก็บไว้ตั้งแต่ก่อนหน้านี้จะกลายเป็นของที่หลุดออกจากหน้าจอไปแล้ว
      // (detached) พอเอาไปใส่ transform จึงไม่มีผลอะไร ส่วนตัวจริงบนจอก็ไม่เคยถูก invert เลย
      // = เห็นเป็นแท่งนั้นโผล่ที่ตำแหน่งใหม่ทันทีทั้งที่ใบอื่นกำลังค่อยๆ เลื่อน
      // ✅ ดึงรายการใหม่จาก DOM จริงหลัง updateSize() เสมอ แล้วบังคับคลาสให้ตรงกับค่าที่บันทึกไว้
      // (eventContent อ่านจาก cardPrefs อยู่แล้ว ตัวที่สร้างใหม่จึงถูกต้องอยู่ก่อนแล้ว — ตรงนี้เป็น
      // การการันตีซ้ำให้ครอบคลุมกรณีที่ FullCalendar เลือกใช้ DOM เดิมต่อ)
      //
      // 🐛 BUG ที่แก้ (งานวันเดียวกดแล้วแท่งอื่นกระโดด ไม่ยอมเลื่อน): updateSize() ไม่ได้จัด layout ใหม่
      // เสร็จภายในบรรทัดนั้นเสมอไป — FullCalendar ทยอยทำต่อในคิวของเฟรมถัดไป ถ้าวัดตำแหน่งทันทีจะยัง
      // ได้ค่าเก่าอยู่ ทำให้ระยะ invert คำนวณได้ ~0 แล้วข้ามไป (ไม่ใส่ transform) พอเฟรมถัดมา layout
      // จริงขยับ แท่งนั้นจึงเด้งไปตำแหน่งใหม่ทันทีโดยไม่มีอนิเมชัน = กระโดดโดดๆ ใบเดียวกลางจอ
      // ✅ รอให้ผ่านไป 1 เฟรมก่อนแล้วค่อยวัด/invert/เล่นอนิเมชัน — ตำแหน่งปลายทางนิ่งแน่นอนแล้ว
      requestAnimationFrame(() => {
      // 🐛 BUG ที่แก้ (งานข้ามสัปดาห์: กางแล้วงานใบล่างในแถวถัดไปทับกัน): FullCalendar ต้องวัด 2 รอบ
      // สำหรับเคสนี้ — รอบแรกรู้แค่ว่า "ความสูงของแถวเปลี่ยน" แล้วดันทั้งแถวลง แต่ยังไม่ได้จัดลำดับ
      // ชั้นของงานที่อยู่ "ใต้แท่งที่สูงขึ้น" ภายในช่องวันเดียวกันใหม่ ผลคือใบล่างขยับแค่ครึ่งเดียวของ
      // ระยะที่ควรเป็น (ถูกดันตามแถว แต่ไม่ถูกดันตามแท่งที่สูงขึ้น) แล้วไปนั่งทับแท่งนั้นพอดี
      // ✅ เรียกซ้ำอีกรอบหลังผ่านไป 1 เฟรม — รอบนี้ค่าความสูงใหม่ถูกบันทึกไว้หมดแล้ว การจัดชั้นจึงถูกต้อง
      // 🐛 BUG ที่แก้ (งานข้ามสัปดาห์: กางแล้วงานใบล่างในแถวถัดไปทับกัน):
      // งานที่กินหลายวัน FullCalendar จะวาง "ตัวจริง" ไว้แค่ชิ้นเดียวแบบ absolute แล้วใส่ "ตัวสำรอง"
      // (คัดลอกเนื้อหาเดิม ซ่อนไว้ไม่ให้เห็น) ไว้ในช่องวันอื่นๆ ที่แท่งนั้นพาดผ่าน เพื่อ "จองความสูง"
      // ให้งานใบล่างในช่องเดียวกันรู้ว่าต้องเริ่มต่อจากตรงไหน
      // ⚠️ ตอนกดกาง เราสลับคลาสให้เฉพาะการ์ดที่กดเท่านั้น ตัวสำรองในช่องอื่นยังเป็นความสูงเดิม —
      // ปฏิทินจึงจองที่ไว้เท่าความสูงตอนพับ แล้วงานใบล่างก็ไปนั่งทับแท่งที่สูงขึ้นพอดี
      // ✅ ต้องบังคับคลาสให้ "ทุกชิ้นที่มี id เดียวกัน" (รวมตัวสำรอง) ให้ตรงกับค่าที่บันทึกไว้ "ก่อน"
      // สั่งวัดใหม่เสมอ — ลำดับตรงนี้สำคัญมาก ถ้าวัดก่อนแล้วค่อยแก้คลาส การวัดจะใช้ค่าเก่าทั้งหมด
      const liveCards = [...document.querySelectorAll("[data-ec-card]")];
      liveCards.forEach((c) => {
        c.classList.add("ec-anim-off");
        c.classList.toggle("is-expanded", isCardExpanded(c.getAttribute("data-ec-card")));
      });
      calendarRef.current?.getApi()?.updateSize();

      // (4) Invert — ดึงกลับไปสภาพก่อนกด
      //
      // ⚠️ ใส่ transform ที่ "แท่งงาน" ชั้นเดียวเท่านั้น ไม่แตะ <tr> ของสัปดาห์ — ดูเหตุผลที่ snapshotTops
      // (transform ของแม่ส่งผลกับลูก ทำให้เลื่อนซ้ำสองเท่าในบางกรณี)
      const moved = [];
      const applyInvert = (el, delta) => {
        if (Math.abs(delta) < 1) return;
        el.style.transition = "none";
        el.style.transform = `translateY(${delta}px)`;
        moved.push(el);
      };

      liveCards.forEach((card) => {
        const h = card.closest(HARNESS_SELECTOR);
        const key = segKeyOf(card);
        if (!h || !before.has(key)) return;
        applyInvert(h, before.get(key) - h.getBoundingClientRect().top);
      });

      const changed = liveCards.filter(
        (c) => wasExpandedById.get(c.getAttribute("data-ec-card")) !== c.classList.contains("is-expanded")
      );
      // ⚠️ ความสูงต้องอนิเมตเป็น "พิกเซลจริง" ไม่ใช่หน่วย fr — เบราว์เซอร์ไล่ค่า fr ไม่เป็นเส้นตรงกับ
      // พิกเซล ทำให้ช่วงต้นกระโดดเยอะช่วงท้ายลากยาว เห็นเป็นกระตุก (ดู .ec-card-detail ใน index.css)
      // ✅ วัด scrollHeight ตอนนี้ได้ค่าที่ถูกต้องแน่นอน เพราะ layout ปลายทางถูกจัดเสร็จแล้วในขั้นที่ 3
      const heights = changed.map((card) => {
        const detail = card.querySelector(".ec-card-detail");
        if (!detail) return null;
        const full = detail.scrollHeight;
        const expanding = card.classList.contains("is-expanded");
        detail.style.height = `${expanding ? 0 : full}px`; // Invert
        return { detail, to: expanding ? full : 0 };
      }).filter(Boolean);
      changed.forEach((c) => c.classList.add("ec-anim-invert"));

      // บังคับให้เบราว์เซอร์รับรู้สภาพ "ย้อนกลับ" ก่อน ไม่งั้นมันจะยุบ 2 สเต็ปเป็นสเต็ปเดียวแล้วไม่มีอนิเมชัน
      void document.body.getBoundingClientRect();

      // (5) Play
      requestAnimationFrame(() => {
        liveCards.forEach((c) => c.classList.remove("ec-anim-off"));
        changed.forEach((c) => {
          c.classList.remove("ec-anim-invert");
          c.classList.add("ec-anim-height");
        });
        heights.forEach(({ detail, to }) => { detail.style.height = `${to}px`; });
        moved.forEach((el) => {
          el.style.transition = `transform ${FLIP_MS}ms ${FLIP_EASE}`;
          el.style.transform = "";
        });
        // ล้าง inline style ทิ้งเมื่อจบ — ปล่อยค้างไว้จะไปชนกับการ render รอบถัดไปของ FullCalendar
        // ⚠️ ความสูงต้องคืนเป็น 0/auto ตามคลาส ไม่ใช่ค้างค่าพิกเซลไว้ — เนื้อหาสูงเปลี่ยนได้เอง
        // (ย่อจอแล้วข้อความขึ้นบรรทัดใหม่) ถ้าค้างพิกเซลไว้จะโดนตัดหรือเหลือที่ว่างทันที
        setTimeout(() => {
          moved.forEach((el) => { el.style.transition = ""; el.style.transform = ""; });
          heights.forEach(({ detail }) => { detail.style.height = ""; });
          changed.forEach((c) => c.classList.remove("ec-anim-height"));
        }, FLIP_MS + 80);
      });
      });
    };
    // ให้ปุ่ม "กาง/ย่อทั้งหมด" (อยู่นอก useEffect นี้) เรียกตัวเดียวกันได้ โดยไม่ต้องก๊อปตรรกะไปไว้ 2 ที่
    ecReflowRef.current = reflowWithAnimation;

    const setExpanded = (card, next) => {
      const id = card.getAttribute("data-ec-card");
      reflowWithAnimation(() => {
        card.classList.toggle("is-expanded", next);
        const btn = card.querySelector('[data-ec-toggle="1"]');
        if (btn) {
          btn.setAttribute("aria-expanded", String(next));
          btn.setAttribute("title", next ? "ย่อรายละเอียดงานนี้" : "ดูรายละเอียดงานนี้");
        }
        rememberCardState(id, next);
        saveCardPrefs();
      });
    };

    const onToggleClick = (e) => {
      const btn = e.target.closest?.('[data-ec-toggle="1"]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const card = btn.closest("[data-ec-card]");
      if (card) setExpanded(card, !card.classList.contains("is-expanded"));
    };

    // ✅ กดคีย์บอร์ดได้ด้วย (Enter/Space) — ปุ่มนี้เป็น div ที่ใส่ role="button" ไว้ จึงไม่ได้
    // พฤติกรรมคีย์บอร์ดมาให้เองเหมือน <button> จริง ต้องเติมเอง
    const onToggleKey = (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const btn = e.target.closest?.('[data-ec-toggle="1"]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const card = btn.closest("[data-ec-card]");
      if (card) setExpanded(card, !card.classList.contains("is-expanded"));
    };

    document.addEventListener("click", onToggleClick, true);
    document.addEventListener("keydown", onToggleKey, true);
    return () => {
      document.removeEventListener("click", onToggleClick, true);
      document.removeEventListener("keydown", onToggleKey, true);
    };
  }, []);

  /**
   * 📱 เลื่อนตารางมาที่ "วันนี้" ให้อัตโนมัติ เมื่อตารางกว้างเกินจอจนต้องปัดดู
   *
   * 🐛 ปัญหาที่แก้: พอตารางเดือนบนมือถือมีความกว้างของตัวเอง (ดู --ec-m-col) จอจะเห็นได้ทีละ ~3 วัน
   * และเริ่มจากวันอาทิตย์เสมอ — เปิดแอปวันศุกร์มาจึงเจอช่องว่างเปล่าๆ ต้องปัดหาเองว่างานวันนี้อยู่ไหน
   * ทั้งที่งานของวันนี้คือสิ่งแรกที่ทุกคนอยากเห็น
   * ✅ เลื่อนให้คอลัมน์ "วันนี้" มาอยู่กลางจอให้เลย — เปิดมาเห็นงานวันนี้ทันทีโดยไม่ต้องทำอะไร
   *
   * ⚠️ ทำเฉพาะตอนที่ตารางกว้างเกินจอจริงๆ เท่านั้น — จอคอม/มุมมองรายการ/ย่อจนพอดีจอ ไม่มีอะไรให้เลื่อน
   * การสั่ง scroll จึงไม่มีผลอะไรและไม่ควรไปยุ่ง
   * ⚠️ ใช้ scrollLeft ของกล่องเลื่อนโดยตรง ไม่ใช่ scrollIntoView — scrollIntoView จะเลื่อน "ทั้งหน้าเว็บ"
   * ในแนวตั้งตามไปด้วย ผู้ใช้จะโดนกระชากออกจากตำแหน่งที่กำลังดูอยู่
   */
  useEffect(() => {
    const t = setTimeout(() => {
      const scroller = swipeAreaRef.current?.querySelector(".fc-view-harness");
      if (!scroller) return;
      if (scroller.scrollWidth - scroller.clientWidth <= 4) return;
      const todayCell = scroller.querySelector(".fc-day-today");
      if (!todayCell) return;
      const sr = scroller.getBoundingClientRect();
      const tr = todayCell.getBoundingClientRect();
      // จัดให้คอลัมน์วันนี้อยู่กึ่งกลางจอ (ถ้าเลื่อนไปไม่ถึงก็ชิดสุดเท่าที่ไปได้เอง)
      const target = scroller.scrollLeft + (tr.left - sr.left) - (sr.width - tr.width) / 2;
      scroller.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
    }, 350);
    return () => clearTimeout(t);
    // ⚠️ ผูกกับ mobileColW ด้วย — ย่อ/ขยายแล้วตำแหน่งเดิมจะเพี้ยนไปคนละที่ ต้องจัดกึ่งกลางใหม่ทุกครั้ง
  }, [events, mobileColW, viewingDept]);

  /**
   * 🔀 ลากจัดลำดับงานในวันเดียวกัน — เลือกเองได้ว่างานไหนอยู่บน/ล่าง
   *
   * ⚠️ ทำไมไม่ใช้ระบบลากของ FullCalendar: การลากการ์ดของมันมีความหมายว่า "ย้ายงานไปวันอื่น" อยู่แล้ว
   * และมันไม่มีแนวคิดเรื่องลำดับภายในวันเลย (เรียงตาม eventOrder อย่างเดียว) — ถ้าเอามาปนกัน ผู้ใช้จะ
   * แยกไม่ออกว่าลากแล้วจะได้ย้ายวันหรือสลับลำดับ ✅ แยกเป็น "ปุ่มจับ" (⠿) ของตัวเองไปเลย ชัดเจนทั้งคู่
   *
   * ⚠️ ระหว่างลากใช้ transform ขยับการ์ดให้ดูตาม ไม่ยุ่งกับ DOM จริง — พอปล่อยค่อยบันทึกทีเดียวแล้วให้
   * ปฏิทินเรียงใหม่จากข้อมูล (ถ้าสลับ DOM ตอนลาก FullCalendar จะเขียนทับกลับตอน render รอบถัดไป)
   */
  useEffect(() => {
    let drag = null;
    // 🐛 BUG ที่แก้ (จับปุ่มลากแล้วเด้งฟอร์มแก้ไขงานขึ้นมา): เบราว์เซอร์ยิง click ต่อท้าย mousedown+
    // mouseup บน element เดิมเสมอ แม้เราจะ stopPropagation ที่ mousedown ไปแล้วก็ตาม — FullCalendar
    // ดัก click ของตัวการ์ดไว้เปิดหน้าแก้ไข ผลคือลากเสร็จปุ๊บฟอร์มเด้งขึ้นมาทันทีทุกครั้ง
    // ✅ กลืน click ครั้งถัดไปทิ้งหลังแตะปุ่มจับลาก (ทั้งกรณีลากจริงและกดเฉยๆ — กดที่ปุ่มจับไม่ควร
    // เปิดฟอร์มอยู่แล้ว) ⚠️ ต้องดักใน capture phase ให้ถึงก่อน listener ของ FullCalendar ที่อยู่ลึกกว่า
    // ⚠️ ใช้ "หมดอายุเองตามเวลา" ไม่ใช่ธงบูลีนที่รอให้ click มาล้าง — ถ้าปล่อยเมาส์นอก element เดิม
    // (ซึ่งเกิดตลอดเวลาเวลาลากไกลๆ) เบราว์เซอร์จะไม่ยิง click เลย ธงจะค้าง true แล้วไปกลืนคลิกจริง
    // ครั้งถัดไปของผู้ใช้แทน — กลายเป็นว่าคลิกการ์ดแล้วฟอร์มไม่เปิด ซึ่งแย่กว่าปัญหาเดิมอีก
    let suppressClicksUntil = 0;
    const onClickCapture = (e) => {
      if (Date.now() > suppressClicksUntil) return;
      e.preventDefault();
      e.stopPropagation();
    };

    /**
     * แท่งงานที่ "แย่งชั้นเดียวกัน" กับแท่งที่กำลังลาก = ตัวที่สลับบน/ล่างกันแล้วเห็นผลจริง
     *
     * ⚠️ ไม่ใช่ "ทุกใบในช่องวันเดียวกัน" — งานที่กินหลายวันเป็นแท่งพาดข้ามหลายช่อง ถ้าดูแค่ช่องเดียว
     * จะเจอไม่ครบ และไม่ใช่ "ทุกใบในสัปดาห์" เพราะแท่งที่อยู่คนละช่วงวันไม่ได้แย่งชั้นกันเลย สลับไป
     * ก็ไม่มีอะไรเปลี่ยน (ผู้ใช้จะรู้สึกว่าลากแล้วไม่เกิดอะไรขึ้น)
     * ✅ เกณฑ์ที่ตรงกับความจริงคือ "อยู่แถวสัปดาห์เดียวกัน และช่วงวันซ้อนทับกัน" — ซึ่งวัดจากกรอบ
     * แนวนอนบนจอได้ตรงๆ (แท่งที่คาบวันเดียวกันย่อมซ้อนกันในแนวนอน)
     */
    const peersOf = (harness) => {
      const row = harness.closest("tr");
      if (!row) return [harness];
      const base = harness.getBoundingClientRect();
      return [...row.querySelectorAll("[data-ec-grip]")]
        .map((g) => g.closest(".fc-daygrid-event-harness"))
        .filter(Boolean)
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return Math.min(base.right, r.right) - Math.max(base.left, r.left) > 4;
        })
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    };

    const pointOf = (e) => (e.touches?.[0] ? e.touches[0] : e);

    /* ── กดค้างแล้วลาก (สำหรับสัมผัส) ──────────────────────────────────────────────────────
       จอคอมใช้ปุ่มจับ (⠿) ซึ่งเล็งด้วยเมาส์ได้แม่น แต่บนมือถือปุ่มขนาดเท่านิ้วกินที่มากเกินไปบน
       คอลัมน์ ~61px จึงใช้ "กดค้างที่การ์ดทั้งใบ" แทน — เป้ากดใหญ่เท่าการ์ด เล็งไม่พลาด
       ⚠️ ห้าม preventDefault ตอน touchstart — จะบล็อกการเลื่อนหน้าจอทันทีตั้งแต่ยังไม่รู้ว่าผู้ใช้
       ตั้งใจจะลากหรือแค่ปัดดู · รอให้ครบเวลากดค้างก่อนแล้วค่อยเริ่มลาก (ตอนนั้น onMove จะ
       preventDefault ให้เอง) ถ้านิ้วขยับเกินระยะเผื่อก่อนครบเวลา = ตั้งใจปัด ไม่ใช่ลาก → ยกเลิก

       🐛 ที่แก้ (ผู้ใช้แจ้ง: "กดค้าง...นานเกินไป และทำได้ยาก"):
       • 420ms → 240ms — ใกล้เคียงจังหวะกดค้างของ iOS/Android ที่มือคุ้นอยู่แล้ว
       • ระยะเผื่อนิ้วสั่น 10px → 16px — นิ้วมนุษย์ขยับเล็กน้อยเสมอระหว่างกดค้าง ค่าเดิมแคบไปจน
         การกดค้างถูกตีความเป็น "ตั้งใจปัด" แล้วยกเลิกทิ้งบ่อยๆ = อาการ "จับไม่ค่อยติด"
       • เพิ่มการสั่นตอบรับ + ไฟวิ่งรอบการ์ด ตอนจับติด (ดู beginDrag) — เดิมไม่มีสัญญาณอะไรบอกเลย
         ว่าครบเวลาแล้ว ผู้ใช้จึงต้องเดาเอง แล้วมักปล่อยก่อนเวลา */
    const LONG_PRESS_MS = 240;
    const LONG_PRESS_SLOP = 16;
    let pending = null; // { timer, x, y, harness }

    const cancelPending = () => {
      if (!pending) return;
      clearTimeout(pending.timer);
      pending = null;
    };

    const beginDrag = (harness, clientY) => {
      const items = peersOf(harness);
      if (items.length < 2) return false; // ไม่มีใครแย่งชั้นด้วย ก็ไม่มีอะไรให้สลับ
      drag = {
        harness,
        startY: clientY,
        items,
        rects: items.map((el) => el.getBoundingClientRect()),
        from: items.indexOf(harness),
        to: items.indexOf(harness),
        moved: false,
      };
      document.body.style.userSelect = "none";
      harness.classList.add("ec-reorder-dragging");
      // ✅ สัญญาณตอบรับว่า "จับติดแล้ว" — เดิมไม่มีอะไรบอกเลยว่าครบเวลากดค้างหรือยัง ผู้ใช้จึงเดาไม่ถูก
      // และมักปล่อยนิ้วก่อนเวลา จนรู้สึกว่า "ทำได้ยาก" (เบราว์เซอร์ที่ไม่รองรับก็แค่ข้ามไป)
      try {
        navigator.vibrate?.(12);
      } catch {
        /* บางเบราว์เซอร์โยน error ถ้าเรียกโดยไม่มี user gesture ที่มันยอมรับ — ไม่ใช่เรื่องสำคัญ */
      }
      // ⚠️ ปิดการเปิดฟอร์มไว้ตั้งแต่วินาทีที่จับติด — พอกดค้างสั้นลงเหลือ 240ms การ "กดค้างแล้ว
      // เปลี่ยนใจปล่อยเฉยๆ" จะสั้นกว่าเกณฑ์การแตะ (MAX_TAP_MS) ได้ง่ายมาก ถ้าไม่ปิดไว้ตรงนี้
      // ฟอร์มแก้ไขงานจะเด้งขึ้นมาทุกครั้งที่ผู้ใช้ยกเลิกการลาก (ค่านี้ถูกแปลงเป็น cooldown ปกติ
      // ตอนยกนิ้ว — ดูตัวกรองการแตะที่ต้นไฟล์)
      suppressUntilRef.current = Infinity;
      return true;
    };

    const onDown = (e) => {
      const grip = e.target.closest?.('[data-ec-grip="1"]');
      if (!grip) {
        // ไม่ได้จับที่ปุ่มจับ — ถ้าเป็นการสัมผัสนิ้วเดียวบนการ์ด ให้เริ่มนับเวลากดค้าง
        if (e.type !== "touchstart" || (e.touches && e.touches.length !== 1)) return cancelPending();
        const card = e.target.closest?.("[data-ec-card]");
        if (!card) return;
        // เว้นปุ่ม/ลิงก์ "ที่อยู่ข้างในการ์ด" ไว้ (ปุ่มพับ/กาง, ลิงก์โทรออก) — มีการกดของตัวเองอยู่แล้ว
        // 🐛 BUG ที่แก้: เดิมเขียน closest("a") เฉยๆ ซึ่ง "ตรงเสมอ" เพราะ FullCalendar ห่อทั้งการ์ด
        // ไว้ใน <a class="fc-event"> อยู่แล้ว ฟังก์ชันจึง return ทุกครั้ง กดค้างจึงไม่เคยทำงานเลย
        // ✅ ต้องเช็คว่าลิงก์นั้นอยู่ "ข้างใน" การ์ดจริงๆ (card.contains) ไม่ใช่ตัวห่อที่อยู่ข้างนอก
        const innerLink = e.target.closest?.("a[href]");
        if (e.target.closest?.(".ec-card-toggle") || (innerLink && card.contains(innerLink))) return;
        const h = card.closest(".fc-daygrid-event-harness");
        if (!h || peersOf(h).length < 2) return; // วันนั้นมีงานใบเดียว ไม่มีอะไรให้สลับ
        const p = pointOf(e);
        cancelPending();
        pending = {
          x: p.clientX,
          y: p.clientY,
          harness: h,
          timer: setTimeout(() => {
            const target = pending?.harness;
            const y = pending?.y;
            pending = null;
            if (target) beginDrag(target, y);
          }, LONG_PRESS_MS),
        };
        return;
      }
      const harness = grip.closest(".fc-daygrid-event-harness");
      if (!harness) return;
      const items = peersOf(harness);
      if (items.length < 2) return; // ไม่มีใครแย่งชั้นด้วย ก็ไม่มีอะไรให้สลับ

      e.preventDefault();
      e.stopPropagation();
      drag = {
        harness,
        startY: pointOf(e).clientY,
        items,
        // จำความสูงจริงของแต่ละใบไว้ ใช้คำนวณว่าลากผ่านใบไหนไปแล้วบ้าง
        rects: items.map((el) => el.getBoundingClientRect()),
        // 🐛 BUG ที่แก้ (ลากจัดลำดับแล้วการ์ดซ้อนทับกัน): เดิมเลื่อนใบอื่นด้วย "ความสูงของใบที่ลาก"
        // เพียวๆ แต่ getBoundingClientRect().height ไม่รวม margin ระหว่างใบ — พอมีการเว้นระยะให้ป้าย
        // ที่ยื่นพ้นขอบ (10px บนมือถือ / 17px บนจอคอม) ระยะเลื่อนจึงสั้นกว่าที่ว่างจริงเท่านั้นพอดี
        // ใบที่ขยับมาแทนเลยไปทับใบข้างเคียงระหว่างลาก
        // ✅ วัด "ช่องว่างจริงระหว่างใบ" จาก rect สองใบแรกแล้วบวกเข้าไป — ได้ที่ว่างที่ใบนั้นกินจริงๆ
        from: items.indexOf(harness),
        to: items.indexOf(harness),
        moved: false,
      };
      document.body.style.userSelect = "none";
      harness.classList.add("ec-reorder-dragging");
    };

    const onMove = (e) => {
      // ยังไม่เริ่มลาก แต่กำลังนับเวลากดค้างอยู่ — ขยับเกินเกณฑ์ = ตั้งใจปัด ไม่ใช่ลาก
      if (pending) {
        const p = pointOf(e);
        if (
          (e.touches && e.touches.length > 1) ||
          Math.abs(p.clientX - pending.x) > LONG_PRESS_SLOP ||
          Math.abs(p.clientY - pending.y) > LONG_PRESS_SLOP
        ) {
          cancelPending();
        }
      }
      if (!drag) return;
      const dy = pointOf(e).clientY - drag.startY;
      if (!drag.moved && Math.abs(dy) < 3) return;
      drag.moved = true;
      if (e.cancelable) e.preventDefault();

      // ตำแหน่งกึ่งกลางของใบที่กำลังลาก แล้วหาว่าควรไปแทรกที่ช่องไหน
      const r = drag.rects[drag.from];
      // ที่ว่างที่ใบนี้กินจริง = ความสูงของมัน + ช่องว่างระหว่างใบ (ดูคอมเมนต์ตอนสร้าง drag)
      const gap = drag.rects.length > 1
        ? Math.max(0, drag.rects[1].top - drag.rects[0].bottom)
        : 0;
      const slot = r.height + gap;
      const centre = r.top + r.height / 2 + dy;
      let to = 0;
      drag.rects.forEach((rr, i) => {
        if (centre > rr.top + rr.height / 2) to = i;
      });
      drag.to = to;

      // ✅ ขยับใบอื่นให้เห็นว่าจะไปแทรกตรงไหน (preview) — ใช้ transform ล้วน ไม่แตะ DOM จริง
      drag.items.forEach((el, i) => {
        if (i === drag.from) {
          el.style.transform = `translateY(${dy}px)`;
          el.style.transition = "none";
          return;
        }
        let shift = 0;
        if (drag.from < drag.to && i > drag.from && i <= drag.to) shift = -slot;
        if (drag.from > drag.to && i >= drag.to && i < drag.from) shift = slot;
        el.style.transition = "transform .18s cubic-bezier(.4, 0, .2, 1)";
        el.style.transform = shift ? `translateY(${shift}px)` : "";
      });
    };

    const clearDragStyles = (d) => {
      d.items.forEach((el) => { el.style.transform = ""; el.style.transition = ""; });
      d.harness.classList.remove("ec-reorder-dragging");
    };

    const onUp = async () => {
      cancelPending(); // ยกนิ้วก่อนครบเวลากดค้าง = แตะปกติ ปล่อยให้ทำงานตามเดิม
      if (!drag) return;
      const d = drag;
      drag = null;
      document.body.style.userSelect = "";
      // กลืนคลิกที่เบราว์เซอร์ยิงต่อท้ายการปล่อยเมาส์ (ถ้ามี) ไม่ให้ไปเปิดฟอร์มแก้ไขงาน
      suppressClicksUntil = Date.now() + 300;

      if (!d.moved || d.to === d.from) { clearDragStyles(d); return; }

      // ลำดับใหม่ของทั้งวัน
      const ids = d.items.map((el) => el.querySelector("[data-ec-grip]")?.dataset.eventId).filter(Boolean);
      const next = [...ids];
      next.splice(d.to, 0, next.splice(d.from, 1)[0]);
      // ⚠️ เว้นช่วงทีละ 10 ไม่ใช่ 1 — เผื่อที่ให้แทรกใบใหม่ระหว่างกลางทีหลังได้โดยไม่ต้องเขียนใหม่ทั้งวัน
      const items = next.map((id, i) => ({ id, displayOrder: (i + 1) * 10 }));

      // ✅ อัปเดตบนจอทันทีแบบ optimistic แล้วค่อยบันทึก — การลากต้องเห็นผลทันที ไม่ใช่รอ network
      setEvents((prev) => prev.map((ev) => {
        const hit = items.find((it) => String(it.id) === String(ev.id || ev._id));
        return hit ? { ...ev, displayOrder: hit.displayOrder } : ev;
      }));
      clearDragStyles(d);

      try {
        await EventService.ReorderEvents(items);
      } catch (err) {
        // ⚠️ ล้มแล้วต้องดึงของจริงกลับมา ไม่ใช่ปล่อยให้จอค้างลำดับที่ไม่ได้บันทึกจริง
        Swal.fire("❌ จัดลำดับไม่สำเร็จ", err?.response?.data?.message || "กรุณาลองใหม่อีกครั้ง", "error");
        fetchEventsFromDB(true);
      }
    };

    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("click", onClickCapture, true);
    document.addEventListener("touchstart", onDown, { capture: true, passive: false });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onUp);
    document.addEventListener("touchcancel", onUp);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("click", onClickCapture, true);
      document.removeEventListener("touchstart", onDown, true);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
      document.removeEventListener("touchcancel", onUp);
      cancelPending();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * กาง/ย่อ "ทุกใบ" ในหน้าจอปัจจุบัน — ปุ่มเดียวในแถบเครื่องมือ
   * ⚠️ ไล่จาก DOM จริงที่เห็นอยู่ ไม่ใช่จาก filteredCalendarEvents — สิ่งที่ผู้ใช้เห็นคือของที่ปฏิทิน
   * render จริงในเดือน/สัปดาห์ที่เปิดอยู่เท่านั้น การไปกางงานของเดือนอื่นที่ยังไม่ได้ render ไว้ล่วงหน้า
   * ไม่มีความหมายอะไรและทำให้ปุ่มนี้ "ทำงานแล้วแต่ไม่เห็นอะไรเปลี่ยน"
   */
  const toggleAllCards = () => {
    const cards = [...document.querySelectorAll("[data-ec-card]")]
      .filter((c) => c.querySelector('[data-ec-toggle="1"]'));
    if (cards.length === 0) return;
    // ถ้ายังมีใบที่พับอยู่แม้แต่ใบเดียว = กดแล้ว "กางทั้งหมด" (คนกดคาดหวังให้เห็นครบก่อนเสมอ)
    const next = cards.some((c) => !c.classList.contains("is-expanded"));
    // ⚠️ ใช้ตัวช่วยชุดเดียวกับปุ่มในการ์ด (ecReflowRef) — ถูกผูกไว้ตอน mount ใน useEffect ด้านบน
    // เพื่อไม่ต้องก๊อปตรรกะ FLIP มาไว้ 2 ที่แล้วต้องคอยแก้ให้ตรงกันตลอด
    ecReflowRef.current(() => {
      cards.forEach((card) => {
        card.classList.toggle("is-expanded", next);
        const btn = card.querySelector('[data-ec-toggle="1"]');
        if (btn) {
          btn.setAttribute("aria-expanded", String(next));
          btn.setAttribute("title", next ? "ย่อรายละเอียดงานนี้" : "ดูรายละเอียดงานนี้");
        }
      });
      // ✅ กดกาง/ย่อ "ทั้งหมด" = ตั้งค่าเริ่มต้นใหม่ทั้งชุด แล้วล้างรายการยกเว้นทิ้ง — งานใบใหม่ที่ยังไม่เคย
      // เห็นก็จะเป็นไปตามค่านี้ด้วย (ไม่ใช่แค่ใบที่อยู่บนจอตอนกด) และรายการยกเว้นไม่บวมข้ามเวลา
      cardPrefs.def = next;
      cardPrefs.ex.clear();
      saveCardPrefs();
      setAllCardsExpanded(next);
    });
  };

  return (
    <div
      className={`modern-calendar-container${mobileZoom > 0 ? " ec-zoomed" : ""}`}
      style={{ "--ec-m-col": `${mobileColW}px` }}
    >
      {/* ✅ แถบเดียวกระชับ: ค้นหา + ปุ่มตัวกรอง (มี badge บอกจำนวนที่เลือกไว้) + Export
          แบบไอคอนล้วน — เดิมมีทั้งแถวปุ่ม Export ข้อความยาว + แถวค้นหา + dropdown 2 ตัวโชว์
          ตลอดเวลา กินพื้นที่แนวตั้งเยอะมากบนจอมือถือ ตอนนี้ซ่อนตัวกรองทั้งหมดไว้หลังปุ่มเดียว
          กดเปิดเฉพาะตอนต้องการ ไม่เกะกะจอเวลาแค่อยากดูปฏิทินเฉยๆ */}
      <div className="event-toolbar-row mb-2">
        <div className="event-search-input">
          <span className="event-search-icon">🔍</span>
          <input
            type="search"
            placeholder="ค้นหาแผนงาน เช่น ชื่อโครงการ หัวข้อ ระบบ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* ✅ กาง/ย่อรายละเอียดของการ์ดงานทั้งหมดในหน้าจอนี้ทีเดียว — ค่าเริ่มต้นคือ "ย่อ" เพื่อให้
            ปฏิทินอ่านง่าย (ดูเหตุผลเต็มที่ expandedCardIds) แล้วกดปุ่มนี้ตอนต้องการดูรายละเอียดครบทุกใบ
            ⚠️ ไม่ทำเป็นการตั้งค่าค้างถาวร — เป็นการสลับมุมมองชั่วคราวของการดูรอบนี้เท่านั้น */}
        <button
          className={`filter-toggle-btn ${allCardsExpanded ? "filter-toggle-btn--open" : ""}`}
          onClick={toggleAllCards}
          title={allCardsExpanded ? "ย่อรายละเอียดงานทั้งหมด" : "กางรายละเอียดงานทั้งหมด"}
          aria-label={allCardsExpanded ? "ย่อรายละเอียดงานทั้งหมด" : "กางรายละเอียดงานทั้งหมด"}
        >
          <span style={{ fontSize: "0.95em", lineHeight: 1, display: "inline-block", transition: "transform .2s ease", transform: allCardsExpanded ? "rotate(180deg)" : "none" }}>
            ⌄
          </span>
        </button>

        <button
          className={`filter-toggle-btn ${showFilterPanel ? "filter-toggle-btn--open" : ""} ${activeFilterCount > 0 ? "filter-toggle-btn--active" : ""}`}
          onClick={() => setShowFilterPanel((p) => !p)}
          title="ตัวกรอง"
        >
          <FontAwesomeIcon icon={faFilter} />
          {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
        </button>

        {/* ⚠️ นัดหมายของเซลไม่มีแนวคิด "วางแผนล่วงหน้าไม่ระบุวันที่" เลย (ดู fetchDrafts) —
            ปุ่มนี้จึงไม่มีความหมายในโลกฝ่ายขาย ซ่อนไปเลยแทนที่จะโชว์ปุ่มที่กดแล้วว่างเปล่าตลอด */}
        {!isSalesView && !isServiceObserver && (
          <button
            className={`filter-toggle-btn ${showDraftsPanel ? "filter-toggle-btn--open" : ""} ${visibleDrafts.length > 0 ? "filter-toggle-btn--active" : ""}`}
            onClick={() => setShowDraftsPanel((p) => !p)}
            title="งานวางแผนล่วงหน้า (ยังไม่ลงตาราง)"
          >
            <FontAwesomeIcon icon={faLayerGroup} />
            {visibleDrafts.length > 0 && <span className="filter-badge">{visibleDrafts.length}</span>}
          </button>
        )}

        {/* ✅ ปุ่ม "N ต้องอนุมัติ" — ซ่อนไปเลยตอนไม่มีอะไรรออนุมัติ (เทียบ pattern เดียวกับ
            ClosureRequestsPanel ในหน้า Operation ที่ return null ตอนไม่มีคำขอ) กดแล้วกรองตารางเหลือ
            เฉพาะงานรออนุมัติทันที พร้อมเปิดแผงงานล่วงหน้าด้วย (ให้เห็นทั้งงานที่มีวันที่แล้วและแผนงานที่
            ยังไม่มีวันที่พร้อมกันในมุมมองเดียว) */}
        {pendingApprovalCount > 0 && (
          <button
            className="filter-toggle-btn filter-toggle-btn--approval-pending"
            onClick={() => {
              setSelectedApproval("pending");
              setShowFilterPanel(true);
              setShowDraftsPanel(true);
            }}
            title="งานรออนุมัติ"
          >
            ⏳
            <span className="filter-badge filter-badge--approval-pending">{pendingApprovalCount}</span>
          </button>
        )}

        {/* ✅ ปุ่ม "สร้าง PDF" (จับภาพทั้งหน้าปฏิทินเป็น PDF) ถูกตัดออกตามที่ผู้ใช้ขอ — ได้ไฟล์เป็นรูป
            ภาพหน้าจอ ค้นหา/คัดลอก/คำนวณต่อไม่ได้เลย ต่างจากไฟล์ Excel ที่เอาไปทำงานต่อได้จริง
            ⚠️ ไม่เกี่ยวกับ "ใบสั่งงาน (Work Permit) PDF" ในฟอร์มแก้ไขงาน ซึ่งเป็นคนละฟีเจอร์และยังอยู่
            ครบเหมือนเดิม (ดู generateWorkPermitPDF ที่ส่งเข้า getEditEvent) */}
        <button
          className="toolbar-icon-btn toolbar-icon-btn--excel"
          onClick={handleExportExcel}
          disabled={exportingExcel || filteredCalendarEvents.length === 0}
          title={
            filteredCalendarEvents.length === 0
              ? "ไม่มีข้อมูลให้ส่งออก"
              : `ส่งออก ${filteredCalendarEvents.length} รายการที่กรองอยู่เป็นไฟล์ Excel (.xlsx)`
          }
        >
          <FontAwesomeIcon icon={faFileExcel} />
        </button>
      </div>

      {/* ✅ แถบแจ้ง "กำลังคัดลอกงาน" — โชว์ตราบใดที่ clipboardEvent ยังมีค่าอยู่ (ค้างได้จนกว่าจะกด
          ยกเลิกเอง หรือคัดลอกทับ เพื่อวางซ้ำได้หลายวันโดยไม่ต้องคัดลอกใหม่ทุกครั้ง) กดวันที่บนปฏิทิน
          เพื่อวาง (ดู handleAddEvent → sourceEvent) */}
      {clipboardEvent && (
        <div className="ec-clipboard-banner">
          <span className="ec-clipboard-banner-text">
            📋 พร้อมวาง: <b>{clipboardEvent.title || "งาน"}</b>
            {clipboardEvent.site ? ` · ${clipboardEvent.site}` : ""} — คลิกวันที่ในปฏิทินเพื่อวางงานนี้
          </span>
          <button
            type="button"
            className="ec-clipboard-banner-cancel"
            onClick={() => setClipboardEvent(null)}
          >
            ✕ ยกเลิก
          </button>
        </div>
      )}

      {/* ✅ แผงตัวกรอง — พับซ่อนไว้ default กดปุ่มช่องแว่นขยาย/漏斗ด้านบนถึงเปิด แยกประเภทงาน/ระบบ
          เพิ่มจากเดิมที่มีแค่ช่าง/สถานะ ให้ค้นหางานตามหมวดได้ครบขึ้น */}
      {showFilterPanel && (
        <div className="event-filter-panel mb-3">
          {/* 🐛 ที่แก้ (ผู้ใช้แจ้ง: "อัปเดตสถานะแล้วดูเพี้ยนๆ"): แผงนี้เดิมใช้ตัวเลือกของงานช่างเสมอ
              ไม่ว่าจะเปิดปฏิทินไหน — ปฏิทินเซลจึงมี "ช่างทุกคน" / สถานะช่าง (กำลังรอยืนยัน ฯลฯ) /
              ประเภทงานช่าง (จาก JobType) / ระบบ ซึ่งไม่มีสักอันที่ตรงกับนัดหมายของเซลเลย เลือกกรอง
              แล้วไม่มีอะไรตรงเงื่อนไข ดูเหมือนตัวกรองพัง
              ✅ แยกชุดตัวเลือกตาม isSalesView ให้ตรงกับคำศัพท์ของแผนกที่กำลังดูอยู่จริง */}
          {isSalesView ? (
            <>
              {/* คนเดียวเห็นนัดตัวเองอยู่แล้วจากขอบเขตฝั่ง server — ตัวกรองนี้มีความหมายเฉพาะตอน
                  แอดมิน/ผู้จัดการเปิดดูรวมของทุกเซล */}
              {viewingSalesCalendar && (
                <select
                  className="event-filter-select"
                  value={selectedTechnician}
                  onChange={(e) => setSelectedTechnician(e.target.value)}
                >
                  <option value="">เซลทุกคน</option>
                  {salespersonOptions.map((sp) => (
                    <option key={sp._id} value={sp._id}>
                      {sp.fname ? `${sp.fname} ${sp.lname || ""}`.trim() : sp.username}
                    </option>
                  ))}
                </select>
              )}

              <select
                className="event-filter-select"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="">ทุกสถานะนัดหมาย</option>
                {SALES_STATUSES.map((st) => (
                  <option key={st.key} value={st.key}>{st.icon} {st.key}</option>
                ))}
              </select>

              <select
                className="event-filter-select"
                value={selectedJobType}
                onChange={(e) => setSelectedJobType(e.target.value)}
              >
                <option value="">ทุกประเภทนัดหมาย</option>
                {SALES_APPOINTMENT_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>{t.icon} {t.key}</option>
                ))}
              </select>
            </>
          ) : (
            <>
              <select
                className="event-filter-select"
                value={selectedTechnician}
                onChange={(e) => setSelectedTechnician(e.target.value)}
              >
                <option value="">ช่างทุกคน</option>
                {technicianOptions.map((tech) => (
                  <option key={tech._id} value={tech._id}>
                    {tech.fname ? `${tech.fname} ${tech.lname || ""}`.trim() : tech.username}
                  </option>
                ))}
              </select>

              {/* ✅ รวมสถานะงาน + สถานะอนุมัติไว้ในช่องเดียวกัน (เดิมแยกเป็น 2 dropdown คนละที่ ต้องเช็ค
                  2 จุดถึงจะรู้ว่างานไหนต้องดูแล) — ใช้ prefix "status:"/"approval:" แยกประเภทค่าที่เลือก
                  แล้วแปลงกลับเป็น selectedStatus/selectedApproval ตามเดิม (ดู handleCombinedStatusChange) */}
              <select
                className="event-filter-select"
                value={combinedStatusValue}
                onChange={(e) => handleCombinedStatusChange(e.target.value)}
              >
                <option value="">ทุกสถานะ</option>
                {statusLegend.map((s) => (
                  <option key={s.label} value={`status:${s.label}`}>{s.label}</option>
                ))}
                <option value="approval:pending">⏳ รออนุมัติ</option>
                <option value="approval:rejected">❌ ไม่อนุมัติ</option>
              </select>

              <select
                className="event-filter-select"
                value={selectedJobType}
                onChange={(e) => setSelectedJobType(e.target.value)}
              >
                <option value="">ทุกประเภทงาน</option>
                {jobTypeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              <select
                className="event-filter-select"
                value={selectedSystem}
                onChange={(e) => setSelectedSystem(e.target.value)}
              >
                <option value="">ทุกระบบ</option>
                {systemOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </>
          )}

          {hasActiveFilters && (
            <button className="event-filter-clear" onClick={clearFilters}>
              <FontAwesomeIcon icon={faXmark} /> ล้างตัวกรองทั้งหมด
            </button>
          )}
        </div>
      )}

      {/* ✅ งานวางแผนล่วงหน้า (ยังไม่ลงตาราง) แยกเป็นเดือนๆ — ลากการ์ดวางบนปฏิทิน หรือกดปุ่ม
          "ลงตาราง" เลือกวันที่เองก็ได้ ตาม requirement: บันทึกไว้ก่อนว่ามีงานนี้แน่ๆ เดือนนี้
          แต่ยังไม่รู้วันที่เป๊ะ ไม่ต้องลงตารางทันที
          ✅ ปฏิทิน + คอลัมน์นี้เรียงข้างกันบนจอใหญ่ (≥992px) — กดปุ่มด้านบนเพื่อเปิด/ปิด ปฏิทินย่อ
          ความกว้างให้เองอัตโนมัติ (ดู .calendar-layout ใน index.css) จอเล็กกว่านั้นไม่มีที่พอวาง
          ข้างกัน กลับไปเรียงบนล่างเหมือนเดิม (เดิมแผงนี้ดันปฏิทินลงมาทุกครั้งที่เปิด) */}
      <div className={`calendar-layout ${showDraftsPanel && !isSalesView ? "calendar-layout--with-drafts" : ""}`}>
        {/* ⚠️ กันซ้ำอีกชั้น (ปุ่มเปิดถูกซ่อนไปแล้วด้านบน) เผื่อ showDraftsPanel ยังค้างค่า true
            จากตอนอยู่ปฏิทินช่างก่อนสลับมา — คนละ query string บนหน้าเดียวกัน ไม่ได้ remount */}
        {showDraftsPanel && !isSalesView && (
          <aside className="calendar-drafts-col">
            <UnscheduledPanel
              ref={draftsPanelRef}
              drafts={draftsForMonth}
              loading={draftsLoading}
              month={draftMonth}
              onMonthChange={handleDraftMonthChange}
              onAddClick={handleAddDraft}
              onEditClick={handleEditDraftClick}
              onScheduleClick={handleScheduleDraftClick}
              onDeleteClick={handleDeleteDraftClick}
              onCopyClick={handleCopyEvent}
              highlightDraftId={highlightDraftId}
              isAdminOrManager={isAdminOrManager}
              onDecideApproval={handleDecideDraftApproval}
            />
          </aside>
        )}

        {/* ✅ ไม่ตั้ง CSS zoom เองอีกต่อไป (ปฏิทินแสดงที่ 100% เสมอตอนเปิดหน้า) — การย่อ/ขยายบนมือถือ
            ใช้การหุบ/กางนิ้วของเบราว์เซอร์เองแทน ซึ่งไม่ไปยุ่งกับ layout ของปฏิทิน จึงไม่มีปัญหาพื้นที่
            เลื่อน/ตำแหน่งกดเพี้ยนแบบที่ต้องคอยแก้ตอนตั้ง zoom เอง */}
        {/* ⚠️ ec-sales เปลี่ยนสีหัวตารางเป็นม่วง (ดู index.css) — ปฏิทินตัวเดียวกันถูกใช้
            ทั้งฝ่ายช่างและฝ่ายขาย สีคือสิ่งที่บอกทันทีว่ากำลังดูปฏิทินของสายงานไหน */}
        <div
          id="content-id"
          className={"calendar-wrapper" + (isSalesView ? " ec-sales" : "")}
          ref={swipeAreaRef}
        >
        <FullCalendar
          ref={calendarRef}
          locales={[thLocale]} // ใช้งานภาษาไทย
          locale="th" // กำหนดให้ใช้ภาษาไทยเป็นค่าเริ่มต้น
          plugins={[
            dayGridPlugin,
            interactionPlugin,
            timeGridPlugin,
            momentTimezonePlugin,
            listPlugin,
          ]}
          initialView="dayGridMonth"
          // 🐛 ที่แก้ (ผู้ใช้แจ้ง: "ใส่เวลาแล้วสีจะเพี้ยน"): ค่า default ของ FullCalendar
          // (eventDisplay: "auto") วาดงานที่มีเวลาเจาะจง (allDay: false — กรณีปกติของนัดหมายเซล
          // ที่ระบุเวลานัด) เป็นสไตล์ "list-item" (จุดกลมเล็กๆ + เวลา พื้นหลังโปร่งใส) แทนที่จะเป็น
          // แท่งสีทึบแบบงาน allDay — สีพื้นหลังที่ตั้งไว้ (เช่น #d946ef ของ "นำเสนอ/เสนอราคา") จึง
          // หายไปเหลือแต่กรอบสีน้ำเงิน default ทั้งที่ backgroundColor ที่บันทึกในฐานข้อมูลถูกต้องอยู่แล้ว
          // ✅ บังคับ "block" ทุกงานเสมอ ไม่ว่าจะมีเวลาหรือไม่ — สีจึงสม่ำเสมอทั้งปฏิทิน
          eventDisplay="block"
          // editable={isAdmin}
          // selectable={isAdmin}
          // droppable={isAdmin}
          // dateClick={isAdmin ? handleAddEvent : null}

          editable={true} // ✅ เปิดให้ทุกคน drag/resize ได้
          selectable={true} // ✅ เปิดให้ทุกคนเลือกวันได้
          /* 🐛 ที่แก้ (ผู้ใช้แจ้ง: "แตะนิ้วแช่เพื่อเลื่อนงานหรือขยายมันนานเกินไป และทำได้ยาก"):
             บนอุปกรณ์สัมผัส FullCalendar บังคับให้ "กดค้าง" ก่อนถึงจะย้าย/ขยายงานได้ เพื่อแยกออก
             จากการปัดเลื่อนหน้าจอ — แต่ค่าปริยายคือ 1000ms (1 วินาทีเต็ม) และไฟล์นี้ไม่เคยตั้งค่านี้
             มาก่อน จึงใช้ค่าปริยายมาตลอด นิ้วต้องนิ่งสนิทนานมากจนรู้สึกเหมือนจับงานไม่ติด
             แยกตั้งทีละตัวแทนที่จะใช้ longPressDelay ตัวรวม เพราะสองงานนี้มีข้อจำกัดไม่เท่ากัน:

             • selectLongPressDelay (ลากเลือกช่วงวันบนช่องว่าง) — ไม่ชนกับใคร กดสั้นได้เต็มที่ 200ms
             • eventLongPressDelay (ย้าย/ขยายตัวงาน) — ต้องทิ้งช่วงให้มากกว่าเวลากดค้างเพื่อ
               "สลับลำดับในวันเดียวกัน" ของเรา (LONG_PRESS_MS = 240ms) พอสมควร ไม่งั้นสองระบบจะ
               จับงานใบเดียวกันพร้อมกัน · 400ms ยังเร็วกว่าเดิม 2.5 เท่า และพ้นกันชัดเจน
             ⚠️ ทั้งคู่ยกเลิกเองทันทีที่นิ้วขยับก่อนครบเวลา การปัดเลื่อนดูปฏิทินจึงไม่กลายเป็นการลากงาน */
          selectLongPressDelay={200}
          eventLongPressDelay={400}
          droppable={true}
          dateClick={(arg) => {
            if (isPinching()) return; // กำลังหุบ/กางนิ้วซูมอยู่ ไม่ใช่การแตะเลือกวัน
            handleAddEvent(arg);
          }}
          eventReceive={handleEventReceive}
          eventDragStart={handleEventDragStart}
          eventDragStop={handleEventDragStop}
          eventClick={(arg) => {
            if (isPinching()) return; // กำลังหุบ/กางนิ้วซูมอยู่ ไม่ใช่การแตะเปิดงาน
            if (arg.event.extendedProps?.isHoliday) {
              Swal.fire("❌ ข้อมูลวันหยุดไม่สามารถแก้ไขได้");
              return;
            }

            // ✅ "ลูกทีม" ที่มีชื่อในงานนี้เปิดดูรายละเอียดได้ด้วย (ตามที่ผู้ใช้ขอ) — เดิมกดแล้วเด้ง
            // "ไม่มีสิทธิ์" ทันที ทั้งที่เป็นคนที่ต้องไปทำงานนั้นเองและควรเห็นรายละเอียด/วันเวลา/สถานที่
            // ⚠️ เปิดได้ ≠ แก้ได้ — ฟอร์มจะล็อกทุกช่องให้เองเมื่อผู้ใช้เป็นลูกทีมล้วนๆ (isTeamMemberViewer
            // ใน EditEvent.js) จึงส่งเข้า handleEditEvent ตัวเดียวกันได้เลย ไม่ต้องทำหน้าจอแยกอีกชุด
            if (canViewEvent(arg.event.extendedProps)) {
              handleEditEvent(arg);
            } else {
              Swal.fire("❌ คุณไม่มีสิทธิ์ดูแผนงานนี้");
            }
          }}
          eventDrop={(arg) => {
            if (arg.event.extendedProps?.isHoliday) {
              Swal.fire("❌ ข้อมูลวันหยุดไม่สามารถแก้ไขได้");
              arg.revert();
              return;
            }

            if (canEditEvent(arg.event.extendedProps)) {
              handleEventDrop(arg);
            } else {
              Swal.fire("❌ คุณไม่มีสิทธิ์แก้ไขแผนงานนี้");
            }
          }}
          eventResize={(arg) => {
            if (arg.event.extendedProps?.isHoliday) {
              Swal.fire("❌ ข้อมูลวันหยุดไม่สามารถแก้ไขได้");
              arg.revert();
              return;
            }

            if (canEditEvent(arg.event.extendedProps)) {
              handleEventResize(arg);
            } else {
              Swal.fire("❌ คุณไม่มีสิทธิ์แก้ไขแผนงานนี้");
            }
          }}
          events={filteredCalendarEvents}
          allDaySlot={true}
          nowIndicator={true}
          selectMirror={true}
          weekends={true}
          contentHeight="auto"
          // ✅ ให้แถบหัววัน (อาทิตย์-เสาร์) ล็อกค้างด้านบนตอนเลื่อนจอลง เห็นว่าคอลัมน์ไหนคือวันไหน
          // ได้ตลอด — ใช้ position:sticky ที่ FullCalendar ทำมาให้ในตัวอยู่แล้ว (ผ่าน
          // .fc-scrollgrid-section-sticky) ทำงานได้แม้ contentHeight="auto" (ไม่มี scroll
          // container ภายในของตัวเอง) เพราะ sticky อิงกับ scroll ของหน้าเว็บทั้งหน้าได้เหมือนกัน
          /**
           * ✅ ลำดับงานในช่องวันเดียวกัน — ผู้ใช้ลากสลับบน/ล่างเองได้ (ดู displayOrder ใน models/Events.js)
           * ⚠️ sortPriority ต้องมาก่อนเสมอ: วันหยุด (0) ต้องอยู่เหนืองาน (1) ตลอด ไม่ว่าใครจะจัดลำดับ
           * อะไรไว้ก็ตาม — เป็นข้อมูลบริบทของวันนั้น ไม่ใช่งานที่เอามาสลับกันได้
           * ⚠️ ต้องมีเกณฑ์สำรองต่อท้าย (start/title) — งานที่ยังไม่เคยถูกจัดลำดับมี displayOrder เท่ากัน
           * หมด (0) ถ้าไม่มีเกณฑ์สำรอง ลำดับจะสลับไปมาเองทุกครั้งที่ข้อมูลมาจาก server คนละรอบ
           */
          eventOrder="sortPriority,displayOrder,start,title"
          stickyHeaderDates={true}
          showNonCurrentDates={false} // ✅ ไม่แสดงวันของเดือนก่อนและหลัง
          firstDay={0} // ✅ กำหนดให้วันอาทิตย์เป็นวันแรกของสัปดาห์
          eventContent={(arg) => {
            const { title, extendedProps, textColor, backgroundColor } = arg.event;
            const {
              system = "",
              time = "",
              visitCount = "",
              site = "",
              team = "",
              teamMembers = [],
              startTime = "",
              endTime = "",
              status,
              jobGroupId,
              approvalStatus,
              contactName = "",
              contactTel = "",
            } = extendedProps;
            const approvalState = approvalStatus || "approved";

            // ✅ สร้าง display string แบบมีเงื่อนไข
            // ⚠️ ป้องกัน stored XSS — ทุกฟิลด์ตรงนี้ (โครงการ/ระบบ/ทีม/เวลา/ชื่องาน) เป็นข้อความที่
            // ผู้ใช้พิมพ์เองได้ทั้งหมด แล้วถูกใช้เป็น eventContent แบบ raw HTML ของ FullCalendar
            // (render ให้ "ทุกคน" ที่เปิดปฏิทินเห็น ไม่ต้องคลิกอะไรเลย) ต้อง escape ก่อนเสมอ
            // ✅ แถวรายละเอียด = [ขีดนำ] [หัวข้อ] [ : ] [ค่า] — ส่วนที่เป็น "แค่การจัดรูปแบบ"
            // (ขีดนำกับช่องว่างรอบ :) ถูกห่อด้วย .ec-card-deco เพื่อให้ CSS ซ่อนได้ตอนคอลัมน์แคบ
            // ⚠️ วัดจริงที่จอ 412px: ตัวคั่นเหล่านี้กินความกว้าง ~7px ต่อแถว บนคอลัมน์ 47px
            // คือ 15% — พอที่จะดันข้อความให้ตกบรรทัดเพิ่มอีก 1 บรรทัด โดยไม่ได้ให้ข้อมูลเพิ่มขึ้นเลย
            // ⚠️ บนจอคอมและมุมมอง "รายการ" ยังแสดงตัวคั่นครบเหมือนเดิมทุกประการ
            // 🐛 BUG ที่แก้ (ไอคอนกับค่าอยู่คนละบรรทัดบนคอลัมน์แคบ): เคยมี <wbr> คั่นหลังเครื่องหมาย :
            // เพื่อเป็น "จุดที่ขึ้นบรรทัดใหม่ได้ถ้าจำเป็น" — แต่เบราว์เซอร์ถือว่า <wbr> เป็นจุดตัดที่ใช้ได้
            // แม้ตั้ง white-space:nowrap ไว้แล้ว (ไม่เหมือนช่องว่างธรรมดาที่ nowrap กดไว้ได้) ค่าจึงตก
            // ไปบรรทัดใหม่ทิ้งไอคอนไว้ลอยๆ บรรทัดบน — เอาออกแล้วใช้ช่องว่างจริงเป็นจุดตัดแทน
            // ซึ่งให้ผลเหมือนกันตอนที่อนุญาตให้ห่อบรรทัด (จอคอม/โหมดขยาย) แต่ nowrap กดไว้ได้จริง
            // บนคอลัมน์แคบ เบราว์เซอร์จะเลือกตัดตรงนี้ก่อนเสมอ — ได้ "หัวข้อ:" / "ค่า" อ่านง่าย
            // แทนที่จะหั่นกลางคำเป็น "โครงการ:Am" / "azon" — แต่แถวที่สั้นพออยู่แล้วก็ยังคง 1 บรรทัดเหมือนเดิม
            // โครงสร้าง: [ขีดนำ] [หัวข้อ :] [ช่องว่าง] [ค่า]
            // ✅ แยก .ec-card-k (หัวข้อ) กับ .ec-card-v (ค่า) เพื่อให้ CSS ทำน้ำหนักต่างกันได้
            // ปัญหาที่แก้: เดิมทั้งแถวเป็นตัวหนังสือน้ำหนัก/สีเดียวกันหมด การ์ดหนึ่งใบจึงเป็นก้อนข้อความ
            // ทึบๆ ตาไม่มีจุดเกาะ ต้องอ่านไล่ทีละตัวถึงจะรู้ว่าบรรทัดไหนคืออะไร — ช้าและล้า
            // ⚠️ ไอคอนชุดเดียวกับที่หน้า "การดำเนินงาน" ใช้กำกับข้อมูลชุดนี้อยู่แล้ว (ดู InfoLine ที่
            //    OperationBoard) — คนใช้เห็นความหมายเดียวกันทั้งสองหน้า ไม่ต้องจำสองชุด
            // ⚠️ title บนทั้งแถว = คำเต็มเสมอ แม้ในโหมดที่ย่อเหลือไอคอน (แตะค้าง/ชี้เมาส์ก็รู้)
            const detailRow = (label, value, icon = "") =>
              `<span class="ec-card-deco">- </span><span class="ec-card-k" title="${label}"><span class="ec-card-ico" aria-hidden="true">${icon}</span><span class="ec-card-kw">${label}<span class="ec-card-deco"> </span>:</span></span><span class="ec-card-deco"> </span><span class="ec-card-v">${value}</span>`;

            const siteDisplay = site ? detailRow("โครงการ", escapeHtml(site), "🏢") : "";
            // ✅ โชว์ "1/3" (ครั้งที่/จำนวนครั้งทั้งหมดของสัญญา) แทน "1" เฉยๆ — เห็นสัดส่วนความคืบหน้า
            // ทันทีจากหน้าปฏิทินโดยไม่ต้องเปิดไปดูหน้าภาพรวมสัญญา งานที่ไม่ใช่งานสัญญา (ไม่มี visitCount)
            // ยังโชว์แค่เลขครั้งเฉยๆ เหมือนเดิม (ดู formatRoundLabel)
            const timeDisplay = time ? detailRow("ครั้งที่", escapeHtml(formatRoundLabel(time, visitCount)), "🔢") : "";
            // ✅ รวมช่างหลัก (team) + ลูกทีมเพิ่มเติม (teamMembers) เป็นรายชื่อเดียว ให้เห็นครบ
            // ทุกคนที่ช่วยทำงานนี้ในบรรทัดเดียวกัน แทนที่จะเห็นแค่ช่างหลักคนเดียวเหมือนเดิม
            const allTeamNames = [team, ...teamMembers.map((m) => m?.name)]
              .filter(Boolean)
              .filter((name, idx, arr) => arr.indexOf(name) === idx);
            const teamDisplay = allTeamNames.length ? detailRow("ทีม", allTeamNames.map(escapeHtml).join(", "), "👷") : "";

            const systemDisplay = system ? detailRow("ระบบ", escapeHtml(system), "💻") : "";

            // ✅ ผู้ติดต่อหน้างานบนการ์ดในปฏิทิน — เห็นได้โดยไม่ต้องเปิดงานขึ้นมาก่อน
            // ⚠️ เบอร์เป็นลิงก์ tel: จริง กดโทรออกได้เลยจากปฏิทิน (สำคัญกับช่างที่เปิดจากมือถือ) —
            // ต้อง stopPropagation ไม่งั้น FullCalendar จะจับเป็น eventClick แล้วเปิดหน้าแก้ไขงานแทน
            // ⚠️ escape ทุกค่าเหมือนฟิลด์อื่นในบล็อกนี้ — เป็นข้อความที่ผู้ใช้พิมพ์เองแล้วถูก render
            // เป็น raw HTML ให้ทุกคนที่เปิดปฏิทินเห็น (ดูคอมเมนต์ XSS ด้านบน)
            const telDial = String(contactTel).replace(/[^\d+]/g, "");
            // ⚠️ ชื่อกับเบอร์แยกคนละบรรทัดโดยตั้งใจ — ต่อท้ายกันแล้วบรรทัดยาวเกินความกว้างแท่งงาน
            // เบอร์จะถูกดันไปขึ้นบรรทัดใหม่เองแบบครึ่งๆ กลางๆ (ตัวเลขแยกจากชื่อโดยไม่มีป้ายกำกับ)
            // อ่านแล้วงงว่าเลขนั้นคืออะไร — แยกเป็นบรรทัดของตัวเองพร้อมไอคอนโทรจึงชัดเจนกว่า
            const contactDisplay = contactName ? detailRow("ผู้ติดต่อ", escapeHtml(contactName), "📇") : "";
            const contactTelDisplay = contactTel
              // 🐛 BUG ที่แก้ (บนมือถือเบอร์โทรไม่มีไอคอนนำเลย เห็นเป็นตัวเลขลอยๆ ไม่รู้ว่าเลขอะไร):
              // เดิมใส่ 📞 ไว้ใน .ec-card-deco ซึ่งเป็นคลาสของ "ตัวคั่นที่ตัดทิ้งได้" และถูกซ่อนทั้งหมด
              // ตอนคอลัมน์แคบ — ไอคอนจึงหายไปพร้อมขีดนำ/ช่องว่าง ทั้งที่มันคือตัวบอกความหมายของแถว
              // ✅ ใช้ detailRow ตัวเดียวกับแถวอื่น ไอคอนอยู่ใน .ec-card-ico ซึ่งเป็นตัวที่ "แทนคำกำกับ"
              // ตอนแคบ จึงแสดงเสมอ และได้ป้ายคำเต็มบนจอคอมฟรีไปด้วย
              ? `<a href="tel:${escapeHtml(telDial)}" onclick="event.stopPropagation()" style="color:inherit;text-decoration:underline;">${detailRow("เบอร์ติดต่อ", escapeHtml(contactTel), "📞")}</a>`
              : "";

            const timeRangeDisplay =
              startTime && endTime
                ? detailRow("เวลา", `${escapeHtml(startTime)} - ${escapeHtml(endTime)}`, "🕐")
                : startTime
                ? detailRow("เริ่มเวลา", escapeHtml(startTime), "🕐")
                : endTime
                ? detailRow("สิ้นสุดเวลา", escapeHtml(endTime), "🕐")
                : "";

            // ✅ ไอคอนสถานะ — คำนวณใหม่ทุกครั้งที่ event นี้ re-render (เช่นหลังบันทึกแก้ไข)
            // ต่างจาก eventDidMount ที่จะไม่ถูกเรียกซ้ำถ้า element ของ event ยังไม่ถูก unmount
            // ⚠️ padding ของการ์ดย้ายไปอยู่ใน .ec-card (index.css) แล้ว — เดิมต้องเผื่อที่ว่างมุมขวา
            // ให้ไอคอนที่ลอย absolute อยู่ ตอนนี้ไอคอนอยู่ในแถวหัวการ์ดตามปกติ ไม่ต้องเผื่ออะไรอีก

            const icon = getStatusIcon(status);
            // ⚠️ ไอคอนสถานะอยู่บน "ป้ายไอคอน" ที่พื้นเป็นสีตัวหนังสือของงาน (ดู badgeChipStyle) ถ้ายังใช้
            // สีตัวหนังสือเหมือนเดิมจะกลายเป็นสีเดียวกับพื้นป้าย = หายไปเลย — ต้องสลับเป็นสีการ์ดแทน
            const iconColor = textColor || "#ffffff";
            const statusTitle = STATUS_DESCRIPTIONS[status] || "สถานะไม่ระบุ";

            // 🐛 BUG ที่แก้ (การ์ดดูมั่ว ไอคอนลอยกระจาย): เดิมไอคอนสถานะ/กลุ่มงานเป็น position:absolute
            // เกาะมุมการ์ด แต่ ".fc-daygrid-event { align-items:center }" ทำให้กล่องเนื้อหาหดเท่าความ
            // กว้างข้อความ ไม่เต็มแท่งงาน — "มุมการ์ด" ที่ไอคอนไปเกาะจึงเป็นมุมของกล่องข้อความแคบๆ
            // ที่ลอยอยู่กลางแท่ง ไม่ใช่มุมแท่งจริง ผลคือไอคอนไปโผล่กลางแท่งห่างจากข้อความแบบไร้ระเบียบ
            // ✅ ย้ายมาเป็น "แถวหัวการ์ด" แบบ flex ปกติ: [ไอคอนกลุ่ม] ชื่องาน [ไอคอนสถานะ] [ปุ่มพับ/กาง]
            // เรียงชิดซ้าย-ขวาอย่างเป็นระเบียบทุกใบ ไม่ว่าแท่งจะกว้างแค่ไหน
            // ✅ ป้าย "ประเภทงาน" ให้เด่นด้วยการ "สลับสี" ของงานนั้นเอง: พื้นป้าย = สีตัวหนังสือของงาน
            // ตัวอักษรบนป้าย = สีพื้นหลังของงาน
            // ⚠️ ห้ามใช้สีตายตัว — พื้นหลังการ์ดเป็นสีที่ผู้ใช้เลือกเองได้ทุกสี และ textColor ก็ตั้งเองได้
            // (ขาว/ดำ) สีตายตัวจะกลืนหายไปกับพื้นทันทีที่ใครสักคนเลือกสีใกล้เคียงกัน · การสลับสีจาก
            // คู่สีของงานเองจึงคอนทราสต์สูงเสมอโดยอัตโนมัติ ไม่ว่าจะเลือกสีอะไรมา
            const chipBg = textColor || "#ffffff";
            // ⚠️ สีพื้นหลังงานบางสี (เช่นฟ้าอมเขียวของงานสัญญา) วางบนพื้นขาวแล้วคอนทราสต์ได้แค่ ~3.7:1
            // ซึ่งต่ำกว่าเกณฑ์อ่านออก 4.5:1 — ป้ายจะดูจางจนไม่เด่นสมกับที่ตั้งใจ · ปรับความเข้มให้ผ่าน
            // เกณฑ์เสมอแทนที่จะหวังว่าผู้ใช้จะเลือกสีที่พอดีเอง (เลือกได้อิสระทุกสีอยู่แล้ว)
            const typeChipStyle = `background:${escapeHtml(chipBg)};color:${escapeHtml(readableOn(backgroundColor || "#3788d8", chipBg))};`;

            // ป้ายไอคอนมุมขวาบน — ใช้ "สีเดียวกับการ์ด" เป็นพื้น ไอคอนใช้สีตัวหนังสือตามปกติ
            // ⚠️ เคยลองใช้พื้นขาว (สลับสีแบบป้ายประเภทงาน) แล้วมันเด่นเกินจนดูเป็นก้อนแปลกปลอมลอยอยู่
            // เหนือการ์ด ไม่กลมกลืน — พอใช้สีการ์ด ครึ่งล่างที่ทับการ์ดจะกลืนหายไปสนิท เหลือเห็นเป็น
            // "ติ่งมนๆ ที่งอกออกมาจากมุมการ์ด" ซึ่งอ่านออกว่าเป็นของการ์ดใบนั้นทันที
            const badgeChipStyle = `--ec-badge-bg:${escapeHtml(backgroundColor || "#3788d8")};--ec-badge-fg:${escapeHtml(iconColor)};`;

            const badgeHtml = icon
              ? `<span class="ec-card-icon" title="${statusTitle}">${faIconToSvg(
                  icon,
                  // ⚠️ currentColor ไม่ใช่สีตายตัว — ไอคอนตัวเดียวกันถูกใช้ 2 บริบทที่ต้องการสีคนละแบบ:
                  //   จอคอม = วางบนพื้นการ์ดโดยตรง ต้องเป็นสีตัวหนังสือของงาน (ขาว)
                  //   มือถือ = วางบนป้ายพื้นสีตัวหนังสือ ต้องสลับเป็นสีการ์ด ไม่งั้นขาวบนขาว = หายไป
                  // ปล่อยให้ CSS เป็นคนกำหนดผ่าน color จึงคุมได้ทั้งสองบริบทโดยไม่ต้องวาดไอคอนสองชุด
                  { color: "currentColor" },
                )}</span>`
              : "";

            // ✅ สัญลักษณ์บอกว่างานนี้เป็นส่วนหนึ่งของ "งานหลายวัน" (ผูกกับ jobGroupId เดียวกัน)
            // กันผู้ใช้สับสนว่าทำไมมี event หน้าตาเหมือนกันโผล่คนละวันในปฏิทิน
            const groupBadgeHtml = jobGroupId
              ? `<span class="ec-card-icon ec-card-group" title="งานนี้เป็นส่วนหนึ่งของงานหลายวัน (กลุ่มเดียวกัน)">🔗</span>`
              : "";

            // ✅ ป้าย "รออนุมัติ/ไม่อนุมัติ" — เป็นบรรทัดแรกสุดของการ์ด ไม่ใช่ไอคอนมุมเล็กๆ อีกอันเพราะ
            // การ์ดมีไอคอนมุมอยู่แล้ว 2 จุด (สถานะ/กลุ่มงานหลายวัน) เพิ่มอีกจุดจะอ่านยากเกินไปบนจอเล็ก —
            // นี่คือข้อมูลสำคัญที่สุดของการ์ดตอนที่ยังไม่ approved จึงควรเห็นชัดสุดเป็นบรรทัดแรก
            const approvalPillHtml = approvalState !== "approved"
              ? `<div style="display:inline-block; font-size:0.72em; font-weight:700; padding:0 5px; border-radius:4px; margin-bottom:2px; background:${approvalState === "pending" ? "rgba(245,158,11,.9)" : "rgba(239,68,68,.9)"}; color:#fff;">${approvalState === "pending" ? "⏳ รออนุมัติ" : "❌ ไม่อนุมัติ"}</div>`
              : "";

            // ✅ แท่งจับลากขยายของเราเอง — เฉพาะงานที่มีเวลา (allDay:false) เพราะงาน allDay ลากขยาย
            // ด้วย eventResize ของ FullCalendar ได้อยู่แล้วตามปกติ (ดูเหตุผลเต็มที่ useEffect ด้านบน
            // ที่ผูก mousedown/touchstart ไว้ที่ document ทั้งก้อน — data-ec-resize เป็นตัวเชื่อม)
            const resizeHandleHtml = !arg.event.allDay && canEditEvent(extendedProps)
              ? `<div class="ec-timed-resize-handle" data-ec-resize="1" data-event-id="${escapeHtml(String(arg.event.id))}" title="ลากเพื่อขยายข้ามวัน"></div>`
              : "";

            // ── การ์ดพับ/กางได้ ────────────────────────────────────────────────
            // ส่วนหัว = ข้อมูลที่ "ระบุได้ว่างานนี้คืองานอะไร ที่ไหน" เห็นตลอดไม่ว่าพับหรือกาง
            // ส่วนรายละเอียด = ระบบ · ครั้งที่ · ทีม · ผู้ติดต่อ · เวลา — กางดูเมื่อต้องการ
            // ⚠️ วันหยุดไม่ต้องมีปุ่มพับ/กาง (ไม่มีรายละเอียดอะไรให้กาง) — เช็คที่ hasDetail
            const eventIdStr = String(arg.event.id);
            // ⚠️ แถว "ทีม" ต้องแยกคลาสไว้ — บนมือถือมันถูกย้ายไปแสดงเป็นป้ายล่างกึ่งกลางแทน (ดู
            // .ec-card-team) จึงต้องซ่อนแถวนี้ทิ้งไม่ให้ซ้ำกัน · จอคอม/มุมมองรายการยังใช้แถวนี้ตามปกติ
            // ✅ ป้าย "ทีมที่เข้างาน" เกาะขอบล่างกึ่งกลางการ์ด — คู่กับป้ายไอคอนที่ขอบบนขวา
            // ⚠️ ใช้คู่สีเดียวกับป้ายบน (--ec-badge-bg/fg) ครึ่งบนที่ทับการ์ดจึงกลืนหายไปสนิท
            // เหลือเห็นเป็นติ่งมนๆ ที่ขอบล่าง อ่านออกว่าเป็นของการ์ดใบนั้น
            // ⚠️ title เก็บรายชื่อเต็มไว้ — ป้ายกว้างจำกัด ชื่อยาวจะถูกตัดด้วย ellipsis
            const teamBadgeHtml = allTeamNames.length
              ? `<span class="ec-card-team" style="${badgeChipStyle}" title="ทีมที่เข้างาน: ${escapeHtml(allTeamNames.join(", "))}"><span class="ec-card-team-ico" aria-hidden="true">👷</span>${escapeHtml(allTeamNames.join(", "))}</span>`
              : "";

            const detailRows = [
              [systemDisplay, ""],
              [timeDisplay, ""],
              [teamDisplay, " ec-card-row--team"],
              [contactDisplay, ""],
              [contactTelDisplay, ""],
              [timeRangeDisplay, ""],
            ].filter(([html]) => html);
            const hasDetail = detailRows.length > 0;
            const isExpanded = isCardExpanded(eventIdStr);

            // ⚠️ ปุ่มนี้ต้องไม่ใช่ <button> ที่ซ้อนอยู่ใน element ซึ่ง FullCalendar ผูก drag ไว้ —
            // ใช้ div + ตัวดักคลิกที่ document (capture) แทน ดู useEffect "ปุ่มพับ/กางการ์ด"
            // ✅ ปุ่มจับลากจัดลำดับ — ลากขึ้น/ลงเพื่อเลือกว่างานไหนอยู่บน/ล่างในวันนั้น
            // ⚠️ ต้องเป็น "ปุ่มจับ" แยกต่างหาก ไม่ใช่ลากที่ตัวการ์ด — การลากตัวการ์ดคือการย้ายงานไปวันอื่น
            // (ของ FullCalendar เอง) ซึ่งต้องใช้ได้เหมือนเดิม ถ้าเอามาปนกันผู้ใช้จะแยกไม่ออกว่ากำลังทำอะไร
            // ✅ จัดลำดับได้ทั้งงานวันเดียวและงานที่กินหลายวัน (รวมงานหลายวันแบบไม่ต่อเนื่อง ซึ่งแต่ละ
            // ช่วงเป็นแท่งของตัวเอง) — ดูวิธีหา "คู่แข่งที่แย่งชั้นเดียวกัน" ที่ peersOf ด้านล่าง
            // ⚠️ วันหยุดจัดลำดับไม่ได้ — เป็นข้อมูลบริบทของวัน ต้องอยู่บนสุดเสมอ (ดู eventOrder)
            const canReorder = !arg.event.extendedProps?.isHoliday;
            const reorderGripHtml = canReorder
              ? `<span class="ec-card-grip" data-ec-grip="1" data-event-id="${escapeHtml(eventIdStr)}"
                       title="ลากขึ้น/ลงเพื่อจัดลำดับงานในวันนี้">⠿</span>`
              : "";

            const toggleHtml = hasDetail
              ? `<div class="ec-card-toggle" data-ec-toggle="1" data-event-id="${escapeHtml(eventIdStr)}"
                      role="button" tabindex="0" aria-expanded="${isExpanded}"
                      title="${isExpanded ? "ย่อรายละเอียดงานนี้" : "ดูรายละเอียดงานนี้"}">
                   <span class="ec-card-toggle-icon">▾</span>
                 </div>`
              : "";

            // ── โครงสร้างการ์ด ────────────────────────────────────────────────
            //   แถวหัว : [🔗 กลุ่มงาน] ชื่องาน ......... [ไอคอนสถานะ] [ปุ่มพับ/กาง]
            //   แถวสอง : โครงการ  (ข้อมูลที่ระบุ "งานไหน ที่ไหน" — เห็นตลอดแม้พับอยู่)
            //   ส่วนพับ : ระบบ · ครั้งที่ · ทีม · ผู้ติดต่อ · เวลา
            // ⚠️ ทุกบรรทัดชิดซ้ายเสมอ ไม่ว่าแท่งงานจะกว้างแค่ไหน — งานที่กินหลายวันจะกว้างเต็มสัปดาห์
            // ถ้าปล่อยให้ข้อความลอยกลางแท่ง (พฤติกรรมเดิม) จะอ่านไล่ลงมาเป็นคอลัมน์ไม่ได้เลย
            return {
              html: `
                <div class="ec-card${isExpanded ? " is-expanded" : ""}" data-ec-card="${escapeHtml(eventIdStr)}">
                  <div class="ec-card-head">
                    ${/* ⚠️ ลำดับใน DOM นี้ถูกจัดเพื่อ "โหมดลอยขวา (float)" บนมือถือโดยเฉพาะ — ตัวที่ float
                          ก่อนจะไปอยู่ขวาสุด เรียง toggle → สถานะ → กลุ่มงาน จึงได้ภาพ [🔗][✓][▲] ตามที่ต้องการ
                          ⚠️ บนจอคอมใช้ flex ซึ่งไม่สนใจลำดับ DOM แต่ดู order ที่ตั้งไว้ใน CSS แทน
                          (ดู .ec-card-grip/.ec-card-title/... ที่กำหนด order ไว้) ลำดับเดิมจึงไม่เพี้ยน */""}
                    ${reorderGripHtml}
                    ${/* ⚠️ ต้องห่อเป็นกล่องเดียว ไม่ใช่ปล่อยลอยทีละตัว — พื้นหลังของป้ายต้องเป็นผืนเดียว
                          ต่อเนื่องกัน ถ้าให้แต่ละไอคอนมีพื้นของตัวเองจะกลายเป็น 3 ก้อนเรียงกันดูรก
                          ⚠️ ลำดับใน DOM คือ toggle → สถานะ → กลุ่มงาน แล้วพลิกด้วย row-reverse ใน CSS
                          จึงเห็นเป็น [🔗][✓][▲] โดยที่ปุ่มพับอยู่ขวาสุดตามตำแหน่งที่คนคุ้นเคย */""}
                    <span class="ec-card-badges" style="${badgeChipStyle}">${toggleHtml}${badgeHtml}${groupBadgeHtml}</span>
                    <div class="ec-card-title" title="${escapeHtml(title)}"><span class="ec-card-deco">[ </span><span class="ec-card-type" style="${typeChipStyle}">${escapeHtml(title)}</span><span class="ec-card-deco"> ]</span></div>
                  </div>
                  ${approvalPillHtml}
                  ${siteDisplay ? `<div class="ec-card-site">${siteDisplay}</div>` : ""}
                  ${hasDetail ? `
                  <div class="ec-card-detail">
                    <div class="ec-card-detail-inner">
                      ${detailRows.map(([r, cls]) => `<div class="ec-card-row${cls}">${r}</div>`).join("")}
                    </div>
                  </div>` : ""}
                  ${teamBadgeHtml}
                  ${resizeHandleHtml}
                </div>
    `,
            };
          }}
          // ✅ เดิมแยกลูกศรซ้าย (prev) ไว้ไกลจาก title+next มากๆ ดูเหมือนคนละชุดกัน กดสลับ
          // ซ้าย-ขวาสับสน — รวมทั้งคู่ไว้ขนาบ title ในกลุ่มกลางเดียวกัน "‹ กรกฎาคม 2569 ›"
          // ให้เห็นชัดว่าเป็นชุดเลื่อนเดือนเดียวกัน กดง่ายขึ้นโดยเฉพาะจอมือถือ
          headerToolbar={{
            left: "",
            center: "prev title next",
            // ⚠️ ปุ่มย่อ/ขยายโผล่เฉพาะจอมือถือ (ซ่อนด้วย CSS บนจอคอม — ดู .fc-zoomIn-button)
            right: "zoomOut,zoomIn today",
          }}
          footerToolbar={{
            right: "dayGridMonth,timeGridWeek,listWeek",
            // right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
          }}
          customButtons={{
            prev: {
              text: "ย้อนกลับ",
              click: () => calendarRef.current.getApi().prev(),
            },
            next: {
              text: "ถัดไป",
              click: () => calendarRef.current.getApi().next(),
            },
            today: {
              text: "วันนี้",
              click: () => calendarRef.current.getApi().today(),
            },
            // ✅ ปุ่มย่อ/ขยายความกว้างคอลัมน์ — วางไว้แถวเดียวกับ "วันนี้" ตรงกลางจอ กดง่ายด้วยนิ้วโป้ง
            // (เดิมอยู่บนสุดปนกับปุ่มค้นหา/ตัวกรอง/ส่งออก ซึ่งเป็นกลุ่มเครื่องมือคนละเรื่องกันและอยู่ไกล)
            // ⚠️ ซ่อนบนจอคอมด้วย CSS — คอลัมน์กว้างพออยู่แล้ว ไม่มีอะไรต้องย่อ/ขยาย
            zoomOut: {
              text: "−",
              click: () => changeMobileCol(-1),
            },
            zoomIn: {
              text: "+",
              click: () => changeMobileCol(1),
            },
          }}
          datesSet={handleDatesSet} // ✅ อัปเดตสีวันเสาร์-อาทิตย์ + sync เดือนกับแผงงานล่วงหน้า
          buttonText={{
            today: "วันนี้",
            month: "เดือน",
            week: "สัปดาห์",
            day: "วัน",
            list: "รายการ",
          }}
          views={{
            listWeek: { dayMaxEventRows: window.innerWidth >= 576 ? 7 : 7 },
            dayGridMonth: { dayMaxEventRows: window.innerWidth >= 576 ? 7 : 7 },
            timeGridWeek: { dayMaxEventRows: window.innerWidth >= 576 ? 7 : 7 },
            timeGridDay: { dayMaxEventRows: window.innerWidth >= 576 ? 7 : 7 },
          }}
          eventClassNames={(arg) => {
            const classes = !canEditEvent(arg.event.extendedProps) ? ["fc-event-locked"] : [];
            const approvalState = getApprovalState(arg.event);
            if (approvalState === "pending") classes.push("fc-event-pending-approval");
            else if (approvalState === "rejected") classes.push("fc-event-rejected-approval");
            // ✅ แถบสีขอบซ้ายบอกประเภทงาน (ทั่วไป/โปรเจค/สัญญา) — ใช้ className แทนการเพิ่มไอคอนมุม
            // อีกจุด (การ์ดมีไอคอนมุม 2 จุด + ป้ายรออนุมัติอยู่แล้ว เพิ่มอีกจะรกเกินไป) กวาดตาดูทั้งเดือน
            // แยกประเภทได้ทันทีโดยไม่ต้องอ่านข้อความ ไม่ทับซ้อนกับสิ่งที่มีอยู่แล้วเพราะอยู่คนละตำแหน่ง
            const jobClass = classifyJob(arg.event.extendedProps);
            if (jobClass) classes.push(`fc-event-type-${jobClass}`);
            // ✅ ไฮไลต์งานที่ถูกลิงก์มาเจาะจงจากหน้าอื่น (?event=<id>) — ดูคอมเมนต์ที่ highlightEventId
            if (highlightEventId && String(arg.event.id) === String(highlightEventId)) {
              classes.push("fc-event-linked-highlight");
            }
            return classes;
          }}
          dayCellDidMount={(info) => {
            const date = moment(info.date); // แปลงเป็น moment object
            const currentMonth = moment(info.view.currentStart).month(); // เดือนปัจจุบันที่กำลังแสดงในปฏิทิน
            const isSaturday = date.isoWeekday() === 6; // ตรวจสอบวันเสาร์
            const isSunday = date.isoWeekday() === 7; // ตรวจสอบวันอาทิตย์
            const isSameMonth = date.month() === currentMonth; // ตรวจสอบว่าเป็นของเดือนปัจจุบันหรือไม่

            // ✅ ไฮไลต์วันเสาร์-อาทิตย์ เฉพาะวันที่อยู่ในเดือนปัจจุบัน
            // ✅ เดิมเหลืองอ่อนไม่ตรงธีม เปลี่ยนเป็นแดงอ่อนแบบเดียวกับ handleHighlightWeekends
            if ((isSaturday || isSunday) && isSameMonth) {
              info.el.style.backgroundColor = "#fef2f2"; // แดงอ่อน (ธีมแอพ)
            }
          }}

          
        />
        <style>
          {`
          @media (max-width: 768px) {
            .fc-header-toolbar {
              display: flex;
              flex-direction: column;
              width: 100%;
              gap: 8px;
            }
            .fc-toolbar-chunk {
              justify-content: center;
              width: 100%;
        font-size: 12px !important; /* ✅ ปรับขนาดฟอนต์ให้เล็กลงสำหรับมือถือ */
            }
            /* ✅ บั๊ก: ตอนแก้ desktop ก่อนหน้านี้ ใช้ selector ".fc .fc-toolbar-title"/".fc
               .fc-prev-button" (2 คลาส) ซึ่ง specificity สูงกว่า selector มือถือแค่ 1 คลาสตรงนี้
               (".fc-toolbar-title"/".fc-prev-button") — เลยทับกฎมือถือทิ้งไปเงียบๆ ต่อให้อยู่ใน
               media query ก็ตาม (specificity ชนะ media query เสมอ) เพิ่ม !important กันไว้แน่นอน
               ✅ ทดสอบจริงผ่าน headless screenshot (แยก harness นอกแอพ) แล้วว่าขนาดชุดนี้
               อ่านง่าย ไม่เล็กเกินไป ก่อนค่อยเอามาใส่ในแอพจริง */
            .fc-toolbar-title {
              flex: 1;
              min-width: 0;
              text-align: center;
              font-size: 1.5em !important;
              margin: 0;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .fc-prev-button,
            .fc-next-button {
              flex-shrink: 0;
              width: 55px !important;
              height: 32px !important;
              padding: 0 !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              border-radius: 16px;
              touch-action: manipulation;
            }
            .fc-prev-button .fc-icon,
            .fc-next-button .fc-icon {
              display: flex;
              align-items: center;
              justify-content: center;
              width: 100%;
              line-height: 1;
              margin: 0;
            }
            .fc-today-button {
              flex-shrink: 0;
              width: 100%;
              min-height: 28px;
              padding: 4px 10px;
              font-size: 12px;
              border-radius: 8px;
              touch-action: manipulation;
            }
            .fc-button:not(.fc-prev-button):not(.fc-next-button):not(.fc-today-button) {
              flex-shrink: 0;
              padding: 6px 10px;
              touch-action: manipulation;
            }
            .fc-footer-toolbar {
              display: flex;
              justify-content: center;
              width: 100%;
              margin-top: 5px;
            }
            .fc-col-header-cell-cushion {
              font-size: 11px !important;
              padding: 6px 3px !important;
            }
          }
.fc-event-locked {
      /* ✅ เดิม opacity 0.7 จางเกินไปจนสีตัดกับพื้นหลังไม่ชัด อ่านยาก — เพิ่มความเข้มขึ้น */
      opacity: 0.88;
      filter: grayscale(10%);
    }

/* ✅ งานที่ยังรออนุมัติ — เทาลง + ลายทแยงบางๆ ให้ดูออกทันทีว่า "ยังไม่ยืนยันจริง" โดยไม่ต้องอ่านป้าย
   ข้อความก่อน (ดู approvalPillHtml ใน eventContent สำหรับป้ายข้อความ) */
.fc-event-pending-approval {
      opacity: 0.82;
      filter: grayscale(70%);
      background-image: repeating-linear-gradient(
        45deg,
        rgba(255,255,255,.35),
        rgba(255,255,255,.35) 6px,
        transparent 6px,
        transparent 12px
      ) !important;
    }
/* ✅ งานที่ไม่ผ่านการอนุมัติ — กรอบแดงประ ให้ต่างจาก "รออนุมัติ" (เทา/ลายทแยง) ชัดเจน ไม่ปนกัน */
.fc-event-rejected-approval {
      opacity: 0.82;
      filter: grayscale(40%);
      outline: 2px dashed #ef4444;
      outline-offset: -2px;
    }

/* ✅ ไฮไลต์งานที่ถูกลิงก์มาเจาะจง (?event=<id> จากหน้าการดำเนินงาน/แผงรออนุมัติ) — วงแหวนสีแบรนด์
   กะพริบช้าๆ ให้ตาจับได้ทันทีว่างานไหน แล้วหายเองใน 6 วิ (ดู highlightEventId)
   ⚠️ ใช้ outline ไม่ใช่ border — border จะไปดันขนาดกล่องทำให้การ์ดขยับ/ตารางเลื่อน ส่วน outline
   วาดทับนอกกรอบโดยไม่กินพื้นที่ layout เลย */
/* ⚠️ การ์ดงานมีสีพื้นของตัวเองได้ทุกสี (ผู้ใช้เลือกเอง) — ถ้าใช้แค่วงแหวนสีแดง งานที่พื้นหลังเป็นสีแดง/
   ส้มอยู่แล้วจะกลืนไปกับกรอบจนแทบมองไม่เห็นว่าอันไหนถูกไฮไลต์ จึงเพิ่ม "วงแหวนขาว" คั่นอีกชั้นระหว่าง
   ตัวการ์ดกับวงแหวนแดง (box-shadow ซ้อน 2 ชั้น) ทำให้เห็นชัดบนพื้นทุกสีเหมือนกันหมด
   ⚠️ ยังใช้ outline/box-shadow เท่านั้น ไม่ใช้ border — border จะไปดันขนาดกล่องทำให้การ์ดขยับ/ตารางเลื่อน */
@keyframes ecLinkedPulse {
  0%, 100% {
    outline-color: rgba(220,38,38,1);
    box-shadow: 0 0 0 2px #fff, 0 0 0 6px rgba(220,38,38,.35), 0 2px 10px rgba(220,38,38,.45);
  }
  50% {
    outline-color: rgba(220,38,38,.4);
    box-shadow: 0 0 0 2px #fff, 0 0 0 10px rgba(220,38,38,0), 0 2px 10px rgba(220,38,38,.15);
  }
}
.fc-event-linked-highlight {
  outline: 2px solid rgba(220,38,38,1);
  outline-offset: 2px;
  border-radius: 4px;
  animation: ecLinkedPulse 1.2s ease-in-out infinite;
  /* ยกขึ้นมาอยู่เหนือการ์ดใบอื่นในช่องวันเดียวกัน ไม่งั้นวงแหวนโดนใบที่วาดทีหลังทับบางส่วน */
  position: relative;
  z-index: 6;
}
@media (prefers-reduced-motion: reduce) {
  .fc-event-linked-highlight { animation: none; }
}

/* ✅ อนิเมชันเลื่อนเข้าตอนปัดเปลี่ยนเดือนบนมือถือ (ดู hammer.on("swipeleft"/"swiperight") ด้านบน) —
   FullCalendar เปลี่ยนเดือนแบบตัดภาพทันทีไม่มีอนิเมชันมาให้ ปัดแล้วไม่แน่ใจว่าเปลี่ยนไปทางไหน/เปลี่ยนไหม
   ⚠️ ใช้แค่ transform + opacity (สองอย่างที่เบราว์เซอร์เร่งด้วย GPU ได้) ไม่แตะ width/height/margin
   ซึ่งจะบังคับให้คำนวณ layout ใหม่ทั้งหน้าทุกเฟรม = กระตุกบนมือถือ
   ⚠️ ตั้งเวลาไว้สั้น (0.22s) พอให้รู้ทิศทางแต่ไม่หน่วงจนรู้สึกช้าเวลาปัดดูหลายเดือนติดกันเร็วๆ */
@keyframes ecSlideInLeft {
  from { transform: translate3d(28px, 0, 0); opacity: 0.35; }
  to   { transform: translate3d(0, 0, 0);    opacity: 1; }
}
@keyframes ecSlideInRight {
  from { transform: translate3d(-28px, 0, 0); opacity: 0.35; }
  to   { transform: translate3d(0, 0, 0);     opacity: 1; }
}
.ec-slide-in-left  { animation: ecSlideInLeft  0.22s ease-out; }
.ec-slide-in-right { animation: ecSlideInRight 0.22s ease-out; }

/* ✅ เคารพการตั้งค่าระบบ "ลดการเคลื่อนไหว" (ผู้ใช้บางคนเวียนหัวกับอนิเมชัน) — ยังเปลี่ยนเดือนได้ปกติ
   แค่ไม่มีอนิเมชันเลื่อน */
@media (prefers-reduced-motion: reduce) {
  .ec-slide-in-left, .ec-slide-in-right { animation: none; }
}

/* ✅ แถบสีขอบซ้ายบอกประเภทงาน — บางๆ ไม่แย่งพื้นที่จากไอคอนมุม/ป้ายรออนุมัติที่มีอยู่แล้ว
   (ดู eventClassNames ด้านบน และป้ายอธิบายสีใน .ec-legend-panel กลุ่ม "ประเภทงาน" ด้านล่างของหน้า)

   🐛 BUG ที่แก้ (งานข้ามเดือน/ข้ามสัปดาห์แสดงเหมือนเป็นคนละงาน): งานที่กินหลายวันติดกันจะถูก
   FullCalendar "ตัดเป็นท่อน" (segment) ทุกครั้งที่ข้ามบรรทัดสัปดาห์หรือข้ามเดือน — แต่ละท่อนได้
   className ชุดเดียวกันทั้งหมด เดิมจึงวาดแถบสีขอบซ้ายทึบให้ "ทุกท่อน" เท่ากันหมด ผลคือท่อนที่เป็นแค่
   ส่วนต่อเนื่องมาจากเดือนก่อน (เช่นงาน 31 ม.ค. – 4 ก.พ. พอเปิดดูเดือน ก.พ. จะเห็นท่อนวันที่ 1–4 ก.พ.)
   มีแถบสีเต็มขอบซ้ายเหมือนงานที่เพิ่งเริ่มวันนั้นจริงๆ อ่านแล้วนึกว่าเป็นงานใหม่คนละงาน/นับซ้ำ
   ✅ แถบทึบ = ท่อนที่มี "วันเริ่มงานจริง" อยู่เท่านั้น (FullCalendar ใส่ .fc-event-start ให้เฉพาะท่อนนั้น)
   ✅ ท่อนต่อเนื่อง = เส้นประจางๆ สีเดียวกัน สื่อว่า "ต่อมาจากก่อนหน้า" ยังบอกประเภทงานได้เหมือนเดิม
      แต่ไม่ถูกเข้าใจผิดว่าเป็นจุดเริ่มงาน */
/* ✅ เส้นคั่นขาวบางๆ ประกบด้านในของแถบสีทุกอัน — ผู้ใช้เลือกสีพื้นหลังงานเองได้อิสระ จึงมีโอกาสเลือก
   สีที่ใกล้เคียงกับสีแถบประเภทงานจนกลืนกันเมื่อไหร่ก็ได้ (เคยเกิดจริงตอนสีสัญญา = สีพื้นหลังเริ่มต้น
   เป๊ะๆ) เส้นคั่นนี้ทำให้แถบ "แยกออกจากพื้นหลังได้เสมอ" ไม่ว่าพื้นหลังจะเป็นสีอะไรก็ตาม */
.fc-event-type-contract.fc-event-start,
.fc-event-type-project.fc-event-start,
.fc-event-type-general.fc-event-start,
.fc-event-type-contract:not(.fc-event-start),
.fc-event-type-project:not(.fc-event-start),
.fc-event-type-general:not(.fc-event-start) {
  box-shadow: inset 2px 0 0 rgba(255, 255, 255, 0.75);
}
.fc-event-type-contract.fc-event-start { border-left: 4px solid ${JOB_CLASS_META.contract.color} !important; }
.fc-event-type-project.fc-event-start  { border-left: 4px solid ${JOB_CLASS_META.project.color} !important; }
.fc-event-type-general.fc-event-start  { border-left: 4px solid ${JOB_CLASS_META.general.color} !important; }

.fc-event-type-contract:not(.fc-event-start) { border-left: 4px dashed ${JOB_CLASS_META.contract.color}80 !important; }
.fc-event-type-project:not(.fc-event-start)  { border-left: 4px dashed ${JOB_CLASS_META.project.color}80 !important; }
.fc-event-type-general:not(.fc-event-start)  { border-left: 4px dashed ${JOB_CLASS_META.general.color}80 !important; }

/* ✅ จอมือถือ: ช่องวันกว้างแค่ ~55px แถบ 4px + เส้นคั่นขาว 2px = 6px กินความกว้างไปกว่า 10% ของการ์ด
   เบียดข้อความจนอ่านไม่ออก — ย่อเหลือแถบ 2px + เส้นคั่น 1px (รวม 3px) พอให้เห็นว่าเป็นประเภทไหน
   โดยไม่แย่งพื้นที่ข้อความ (สีต่างกันชัดอยู่แล้ว ไม่ต้องหนาก็แยกออก)
   ⚠️ เส้นคั่นขาว 1px ตัดออกไม่ได้ — ผู้ใช้เลือกสีพื้นหลังงานเองได้ ถ้าเลือกสีใกล้กับสีประเภทงาน
   แถบจะกลืนหายไปกับพื้นหลังทันที (เคยเกิดจริง) เส้นนี้ทำให้แถบแยกออกได้เสมอไม่ว่าพื้นจะสีอะไร */
@media (max-width: 575.98px) {
  .fc-event-type-contract.fc-event-start,
  .fc-event-type-project.fc-event-start,
  .fc-event-type-general.fc-event-start,
  .fc-event-type-contract:not(.fc-event-start),
  .fc-event-type-project:not(.fc-event-start),
  .fc-event-type-general:not(.fc-event-start) {
    border-left-width: 2px !important;
    box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.75);
  }
}

/* ✅ แท่งจับลากขยาย "งานที่มีเวลา" ของเราเอง (ดู useEffect ที่ผูก mousedown/touchstart ไว้ที่
   document) — มุมมองเดือนของ FullCalendar ไม่มี handle ให้งานที่มีเวลาโดยธรรมชาติของมันเอง
   (ดูเหตุผลเต็มที่ตรง useEffect) จึงต้องวาดเองตรงนี้แทน วางที่ขอบขวาของการ์ด กว้างพอกดง่ายบนมือถือ
   แต่ไม่บังเนื้อหา */
.ec-timed-resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 14px;
  cursor: ew-resize;
  z-index: 6;
  touch-action: none;
}
.ec-timed-resize-handle::after {
  content: "";
  position: absolute;
  top: 50%;
  right: 3px;
  transform: translateY(-50%);
  width: 3px;
  height: 55%;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.55);
}
.ec-timed-resize-handle:hover::after {
  background: rgba(255, 255, 255, 0.95);
}
/* ✅ ไฮไลต์ช่องวันที่ปลายทางระหว่างลาก — feedback ว่าปล่อยแล้วจะไปจบที่วันไหน */
.fc-daygrid-day.ec-day-drop-target {
  background: rgba(139, 92, 246, 0.14) !important;
  box-shadow: inset 0 0 0 2px #8b5cf6;
}

/* ✅ แผงคำอธิบายสัญลักษณ์ — ออกแบบใหม่ทั้งหมด (เดิมยัดทุกอย่าง 11 รายการ เป็นแถว flex-wrap เดียว
   ปนกันไม่มีหัวข้อ อ่านยาก/รกตามที่ผู้ใช้ทัก) แยกเป็นกลุ่มตามความหมาย (สถานะ/การอนุมัติ/ประเภทงาน/
   อื่นๆ) แต่ละกลุ่มมีหัวข้อกำกับ + รายการเรียงเป็นคอลัมน์อ่านง่าย คั่นด้วยเส้นแบ่งบนจอกว้าง */
.ec-legend-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 18px 0;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px 4px;
  box-shadow: 0 1px 3px rgba(0,0,0,.03);
}
.ec-legend-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 168px;
  flex: 1;
  padding: 0 18px;
}
.ec-legend-group + .ec-legend-group {
  border-left: 1px solid #f1f5f9;
}
.ec-legend-group-title {
  font-size: 10.5px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: .4px;
}
.ec-legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: #334155;
  line-height: 1.4;
}
.ec-legend-item .ec-legend-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
}
.ec-legend-swatch {
  display: inline-block;
  flex-shrink: 0;
  border-radius: 3px;
}

@media (max-width: 768px) {
  .ec-legend-panel { flex-direction: column; gap: 14px; padding: 12px 14px; }
  .ec-legend-group { padding: 0 0 12px; border-left: none !important; }
  .ec-legend-group + .ec-legend-group { border-top: 1px solid #f1f5f9; padding-top: 12px; }
}
        `}
        </style>
        {/* ✅ คำอธิบายสัญลักษณ์ — คนละชุดตามสายงาน
            ⚠️ ฝ่ายขายไม่มี "การอนุมัติ" (นัดของตัวเองไม่ต้องรออนุมัติ) และไม่มี "งานสัญญา/
            งานโปรเจค" (เป็นแนวคิดของงานช่างล้วนๆ) การโชว์ให้เซลเห็นคือคำอธิบายของสิ่งที่
            ไม่มีวันเกิดขึ้นในปฏิทินของเขา */}
        {isSalesView ? (
          <div className="ec-legend-panel">
            <div className="ec-legend-group">
              <div className="ec-legend-group-title">ประเภทนัดหมาย</div>
              {SALES_APPOINTMENT_TYPES.map((t) => (
                <div key={t.key} className="ec-legend-item">
                  <span className="ec-legend-icon">
                    <span className="ec-legend-swatch" style={{ width: 14, height: 14, background: t.color }} />
                  </span>
                  <span>{t.icon} {t.key}</span>
                </div>
              ))}
            </div>
            {/* ✅ สถานะของฝ่ายขายเอง — คนละชุดกับสถานะงานช่าง (ดู SALES_STATUSES)
                แก้ได้จากในกล่องแก้ไขนัดหมาย */}
            <div className="ec-legend-group">
              <div className="ec-legend-group-title">สถานะนัดหมาย</div>
              {SALES_STATUSES.map((st) => (
                <div key={st.key} className="ec-legend-item">
                  <span className="ec-legend-icon">{st.icon}</span>
                  <span>{st.key} — {st.hint}</span>
                </div>
              ))}
            </div>
            <div className="ec-legend-group">
              <div className="ec-legend-group-title">อื่นๆ</div>
              <div className="ec-legend-item">
                <span className="ec-legend-icon">💡</span>
                <span>กดวันที่บนปฏิทินเพื่อเพิ่มนัดหมายใหม่</span>
              </div>
              <div className="ec-legend-item">
                <span className="ec-legend-icon">🔒</span>
                <span>ปฏิทินนี้เห็นเฉพาะนัดของฝ่ายขาย ไม่ปนกับตารางงานช่าง</span>
              </div>
            </div>
          </div>
        ) : (
        <div className="ec-legend-panel">
          <div className="ec-legend-group">
            <div className="ec-legend-group-title">สถานะงาน</div>
            {statusLegend.map((status) => (
              <div key={status.label} className="ec-legend-item">
                <span className="ec-legend-icon">
                  <FontAwesomeIcon icon={status.icon} style={{ color: status.color }} />
                </span>
                <span>{status.label}</span>
              </div>
            ))}
          </div>

          <div className="ec-legend-group">
            <div className="ec-legend-group-title">การอนุมัติ</div>
            <div className="ec-legend-item">
              <span className="ec-legend-icon">⏳</span>
              <span>รออนุมัติ — แอดมิน/manager ยังไม่ได้อนุมัติ ทำงานต่อได้แต่ยังปิดงานไม่ได้</span>
            </div>
            <div className="ec-legend-item">
              <span className="ec-legend-icon">❌</span>
              <span>ไม่อนุมัติ — แก้ไขข้อมูลแล้วบันทึก ระบบจะส่งขออนุมัติใหม่ให้อัตโนมัติ</span>
            </div>
          </div>

          {/* ✅ อธิบายแถบสีขอบซ้าย (ประเภทงาน) — คู่กับ eventClassNames/fc-event-type-* ด้านบน */}
          <div className="ec-legend-group">
            <div className="ec-legend-group-title">ประเภทงาน</div>
            {Object.entries(JOB_CLASS_META).map(([key, meta]) => (
              <div key={key} className="ec-legend-item">
                <span className="ec-legend-icon">
                  <span className="ec-legend-swatch" style={{ width: 4, height: 14, background: meta.color }} />
                </span>
                <span>{meta.emoji} {meta.label}</span>
              </div>
            ))}
          </div>

          <div className="ec-legend-group">
            <div className="ec-legend-group-title">อื่นๆ</div>
            <div className="ec-legend-item">
              <span className="ec-legend-icon">
                <span className="ec-legend-swatch" style={{ width: 14, height: 14, background: "#8A8A8A", opacity: .7 }} />
              </span>
              <span>งานสีจาง = ไม่ใช่งานของคุณ (ดูได้ แต่แก้ไขไม่ได้)</span>
            </div>
            {/* ✅ บอกวิธีก๊อปปี้งานด้วยการลาก — ท่านี้ไม่มีปุ่มให้เห็นเลย (เป็น gesture ล้วนๆ) ถ้าไม่บอก
                ไว้ตรงนี้ไม่มีทางรู้ได้เองว่าใช้งานได้ — ใช้ Alt ไม่ใช่ Ctrl เพราะ @fullcalendar/interaction
                ตัดการลากทิ้งทันทีถ้ากด Ctrl ค้างไว้ตอนกดเมาส์ลง (ดูคอมเมนต์ละเอียดใน EventDrop.js) */}
            <div className="ec-legend-item">
              <span className="ec-legend-icon">💡</span>
              <span>กด Alt (หรือ Cmd บน Mac) ค้างไว้แล้วลากงาน เพื่อก๊อปปี้ไปวันอื่น</span>
            </div>
          </div>
        </div>
        )}
        </div>
      </div>

      {/* ✅ กล่องออกใบส่งมอบงาน — เปิดจากปุ่มในหน้าแก้ไขงาน (ดู onOpenDeliveryNote) */}
      {deliveryNoteJob && (
        <DeliveryNoteDialog
          open
          onClose={() => setDeliveryNoteJob(null)}
          job={deliveryNoteJob}
        />
      )}

      {/* ✅ กล่องออกใบแจ้งเข้าปฏิบัติงาน — เปิดจากปุ่มในหน้าแก้ไขงานเหมือนกัน (ดู onOpenWorkNotice)
          ⚠️ ส่ง userData เข้าไปเป็น "ผู้ออกเอกสาร" — ใบแจ้งเข้างานต้องมีชื่อ+เบอร์คนที่ลูกค้าติดต่อกลับได้
          เมื่อไม่สะดวกตามกำหนดการ (ของเดิมก็ใช้ userData เหมือนกัน แค่แก้ไขไม่ได้)
          ⚠️ canUseRunningNumber — เลขเดินหน้าของบริษัทออกได้เฉพาะ admin/manager (server บังคับอยู่แล้ว)
          ถ้าไม่ส่งค่านี้ ช่างจะเห็นเลขล่วงหน้าแล้วกดออกไม่ได้เพราะโดน 403 ตอนกินเลขจริง */}
      {workNoticeJob && (
        <WorkNoticeDialog
          open
          onClose={() => setWorkNoticeJob(null)}
          job={workNoticeJob}
          issuer={userData}
          canUseRunningNumber={isAdminOrManager}
        />
      )}

      {loading && (
        <div className="loading-overlay">
          <ThreeDots type="ThreeDots" color="#007bff" height={50} width={50} />
        </div>
      )}
    </div>
  );
}

export default EventCalendar;
