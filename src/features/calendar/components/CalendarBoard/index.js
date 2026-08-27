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
const faIconToSvg = (iconDef, { size = 12, color = "#000000" } = {}) => {
  if (!iconDef?.icon) return "";
  const [width, height, , , svgPathData] = iconDef.icon;
  const paths = Array.isArray(svgPathData) ? svgPathData : [svgPathData];
  const pathsHtml = paths
    .map((d) => `<path fill="${color}" d="${d}"></path>`)
    .join("");
  return `<svg viewBox="0 0 ${width} ${height}" style="width:${size}px;height:${size}px;display:block;">${pathsHtml}</svg>`;
};

// ✅ ปุ่มย่อ/ขยายปฏิทิน (− 100% +) ถูกตัดออกตามที่ผู้ใช้ขอ — บนมือถือใช้การหุบ/กางนิ้ว (pinch-zoom)
// ของเบราว์เซอร์เองได้อยู่แล้ว (โค้ดปัดเปลี่ยนเดือนด้านล่างตั้งใจไม่แตะ touch-action เลย) และปัดซ้าย-ขวา
// เพื่อเลื่อนเดือนได้เหมือนเดิม จึงไม่จำเป็นต้องมีปุ่มซูมของตัวเองซ้ำอีกชุด
// 🐛 BUG ที่แก้ (ปฏิทินค้างขนาดผิดโดยแก้ไม่ได้เลย): ตอนตัดปุ่มออก ตัวแปร zoomIndex ยังโหลดค่าที่เคย
// บันทึกไว้จาก localStorage อยู่ และ setZoomIndex เหลือแต่ตัวเรียกที่ตายแล้ว — ใครที่เคยกดขยายไว้
// 175% (หรือย่อไว้ 70%) จะเปิดหน้าปฏิทินมาเจอขนาดนั้นค้างถาวร ไม่มีปุ่มให้กดกลับอีกแล้ว
// ✅ ตัดสถานะซูมออกทั้งชุด เริ่มที่ 100% เสมอทุกครั้งที่เปิดหน้า (ไม่อ่าน/ไม่เขียน localStorage อีก)

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
  const viewingDept = searchParams.get("dept") === "sales" ? "sales" : undefined;
  const viewingSalesCalendar = viewingDept === "sales";
  // ✅ ใช้จุดเดียวคุมทั้งแผงตัวกรองและตรรกะกรอง — เดิมแยกเช็คคนละที่ (isSaleUser ที่ฟอร์ม
  // เพิ่ม/แก้ไข, isSaleUser || viewingSalesCalendar ที่ legend) พอเพิ่มแผงตัวกรองอีกจุดจะเสี่ยง
  // ลืมจุดใดจุดหนึ่งอีก
  const isSalesView = isSaleUser || viewingSalesCalendar;

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
  const canViewEvent = (extendedProps) =>
    isJobParticipant(extendedProps) || canViewEventAsTeamMember(extendedProps);

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

    const onTouchStart = (e) => {
      // นิ้วเดียวเท่านั้น — 2 นิ้วขึ้นไปคือกำลังหุบ/กางเพื่อซูม ต้องไม่ตีความเป็นการปัดเปลี่ยนเดือน
      if (e.touches.length !== 1) { tracking = false; return; }
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
    if (isSalesView) { setDrafts([]); setShowDraftsPanel(false); return; }
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
    // ✅ เซลได้ฟอร์ม "นัดหมาย" ของตัวเอง ไม่ใช่ฟอร์มงานของช่าง
    // ⚠️ ฟอร์มของช่างเริ่มด้วยขั้นตอน "ประเภทงาน: งานทั่วไป/โปรเจค/ตามสัญญา" แล้วต่อด้วย ระบบ/ทีม/
    // ครั้งที่/สัญญา ซึ่งไม่มีความหมายกับงานขายเลยสักช่อง (ดูเหตุผลเต็มที่ AddSalesAppointment.js)
    // ⚠️ แอดมินที่เปิดเมนู "ตารางงานเซล" (?dept=sales) ก็ต้องได้ฟอร์มนัดหมาย ไม่ใช่ฟอร์มงานช่าง
    // — ปฏิทินที่กำลังเปิดอยู่คือตัวบอกว่ากำลังจะสร้างของแผนกไหน
    if (isSaleUser || viewingSalesCalendar) {
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
    if (isSaleUser || isSalesEvent(src) || isSalesEvent(eventInfo?.event)) {
      await getEditSalesAppointment({
        eventInfo, events, EventService, fetchEventsFromDB, handleDeleteEvent, Swal, moment,
      });
      return;
    }
    await getEditEvent({
      navigate,
      events,
      setEvents,
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

  return (
    <div className="modern-calendar-container">
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
        {!isSalesView && (
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
          className={"calendar-wrapper" + (isSaleUser || viewingSalesCalendar ? " ec-sales" : "")}
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
          droppable={true}
          dateClick={handleAddEvent}
          eventReceive={handleEventReceive}
          eventDragStart={handleEventDragStart}
          eventDragStop={handleEventDragStop}
          eventClick={(arg) => {
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
          stickyHeaderDates={true}
          showNonCurrentDates={false} // ✅ ไม่แสดงวันของเดือนก่อนและหลัง
          firstDay={0} // ✅ กำหนดให้วันอาทิตย์เป็นวันแรกของสัปดาห์
          eventContent={(arg) => {
            const { title, extendedProps, backgroundColor, textColor } = arg.event;
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
            } = extendedProps;
            const approvalState = approvalStatus || "approved";

            // ✅ สร้าง display string แบบมีเงื่อนไข
            // ⚠️ ป้องกัน stored XSS — ทุกฟิลด์ตรงนี้ (โครงการ/ระบบ/ทีม/เวลา/ชื่องาน) เป็นข้อความที่
            // ผู้ใช้พิมพ์เองได้ทั้งหมด แล้วถูกใช้เป็น eventContent แบบ raw HTML ของ FullCalendar
            // (render ให้ "ทุกคน" ที่เปิดปฏิทินเห็น ไม่ต้องคลิกอะไรเลย) ต้อง escape ก่อนเสมอ
            const siteDisplay = site ? `- โครงการ : ${escapeHtml(site)}` : "";
            // ✅ โชว์ "1/3" (ครั้งที่/จำนวนครั้งทั้งหมดของสัญญา) แทน "1" เฉยๆ — เห็นสัดส่วนความคืบหน้า
            // ทันทีจากหน้าปฏิทินโดยไม่ต้องเปิดไปดูหน้าภาพรวมสัญญา งานที่ไม่ใช่งานสัญญา (ไม่มี visitCount)
            // ยังโชว์แค่เลขครั้งเฉยๆ เหมือนเดิม (ดู formatRoundLabel)
            const timeDisplay = time ? `- ครั้งที่ : ${escapeHtml(formatRoundLabel(time, visitCount))}` : "";
            // ✅ รวมช่างหลัก (team) + ลูกทีมเพิ่มเติม (teamMembers) เป็นรายชื่อเดียว ให้เห็นครบ
            // ทุกคนที่ช่วยทำงานนี้ในบรรทัดเดียวกัน แทนที่จะเห็นแค่ช่างหลักคนเดียวเหมือนเดิม
            const allTeamNames = [team, ...teamMembers.map((m) => m?.name)]
              .filter(Boolean)
              .filter((name, idx, arr) => arr.indexOf(name) === idx);
            const teamDisplay = allTeamNames.length ? `- ทีม : ${allTeamNames.map(escapeHtml).join(", ")}` : "";

            const systemDisplay = system ? `- ระบบ : ${escapeHtml(system)}` : "";

            const timeRangeDisplay =
              startTime && endTime
                ? `เวลา : ${escapeHtml(startTime)} - ${escapeHtml(endTime)}`
                : startTime
                ? `- เริ่มเวลา : ${escapeHtml(startTime)}`
                : endTime
                ? `- สิ้นสุดเวลา : ${escapeHtml(endTime)}`
                : "";

            const isSmallScreen = window.innerWidth < 576;
            const fontSize = isSmallScreen ? "0.7em" : "1em";

            // ✅ ไอคอนสถานะ — คำนวณใหม่ทุกครั้งที่ event นี้ re-render (เช่นหลังบันทึกแก้ไข)
            // ต่างจาก eventDidMount ที่จะไม่ถูกเรียกซ้ำถ้า element ของ event ยังไม่ถูก unmount
            const isSmallBadgeScreen = window.innerWidth < 768;
            const badgeIconPx = isSmallBadgeScreen ? 6 : 12;
            const badgeBoxSize = isSmallBadgeScreen ? "5px" : "19px";
            const badgePadding = isSmallBadgeScreen
              ? "8px 0px 2px 0px"
              : "10px 20px 3px 3px";

            const icon = getStatusIcon(status);
            const iconColor = textColor || "#000000";
            const bgColor = backgroundColor || "#ffffff";
            const statusTitle = STATUS_DESCRIPTIONS[status] || "สถานะไม่ระบุ";

            const badgeHtml = icon
              ? `<div title="${statusTitle}" style="position:absolute; top:0px; right:5px; width:${badgeBoxSize}; height:${badgeBoxSize}; display:flex; align-items:center; justify-content:center; background:${bgColor}; z-index:10; cursor:pointer;">${faIconToSvg(
                  icon,
                  { size: badgeIconPx, color: iconColor },
                )}</div>`
              : "";

            // ✅ สัญลักษณ์บอกว่างานนี้เป็นส่วนหนึ่งของ "งานหลายวัน" (ผูกกับ jobGroupId เดียวกัน)
            // กันผู้ใช้สับสนว่าทำไมมี event หน้าตาเหมือนกันโผล่คนละวันในปฏิทิน
            const groupBadgeHtml = jobGroupId
              ? `<div title="งานนี้เป็นส่วนหนึ่งของงานหลายวัน (กลุ่มเดียวกัน)" style="position:absolute; top:0px; left:3px; font-size:${badgeIconPx}px; line-height:1; z-index:10;">🔗</div>`
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

            return {
              html: `
                <div style="position: relative; display: flex; align-items: center; padding: ${badgePadding}; width: 100%;">
                  <div style="font-size: ${fontSize}; line-height: 2; padding: 0px; flex: 1; min-width: 0;">
                    ${approvalPillHtml}
                    <div>[ ${escapeHtml(title)} ]  </div>

                    <div> ${systemDisplay} </div>
                    <div> ${siteDisplay}</div>
                     <div>${timeDisplay} </div>


                <div>${teamDisplay}</div>
                  ${timeRangeDisplay ? `<div>${timeRangeDisplay}</div>` : ""}
                </div>
                  ${badgeHtml}
                  ${groupBadgeHtml}
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
            right: "today",
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
   เบียดข้อความจนอ่านไม่ออก — ย่อเหลือแถบ 3px + เส้นคั่น 1px (รวม 4px) พอให้เห็นว่าเป็นประเภทไหน
   โดยไม่แย่งพื้นที่ข้อความ (สีต่างกันชัดอยู่แล้ว ไม่ต้องหนาก็แยกออก) */
@media (max-width: 575.98px) {
  .fc-event-type-contract.fc-event-start,
  .fc-event-type-project.fc-event-start,
  .fc-event-type-general.fc-event-start,
  .fc-event-type-contract:not(.fc-event-start),
  .fc-event-type-project:not(.fc-event-start),
  .fc-event-type-general:not(.fc-event-start) {
    border-left-width: 3px !important;
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
        {isSaleUser || viewingSalesCalendar ? (
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
