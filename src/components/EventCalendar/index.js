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
  faFilePdf,
  faHourglassHalf,
  faCheck,
  faCheckDouble,
  faFilter,
  faXmark,
  faLayerGroup,
} from "@fortawesome/free-solid-svg-icons"; // Import ไอคอนต่างๆ

import CustomerService from "../../services/CustomerService";
import EventService from "../../services/EventService";
import JobTypeService from "../../services/JobTypeService";
import SystemTypeService from "../../services/SystemTypeService";

import AuthService from "../../services/authService";

import moment from "moment";

import { ThreeDots } from "react-loader-spinner";

import generatePDF, { Resolution, Margin } from "react-to-pdf";

import { CSVLink } from "react-csv";

import "./index.css";

import API from "../../API/axiosInstance";
import { escapeHtml } from "../../utils/escapeHtml";
import { getApprovalState, isPendingApproval, countPendingJobs } from "../../utils/approvalStatus";
import { formatRoundLabel } from "../../utils/contractRounds";
import { classifyJob, JOB_CLASS_META } from "../../utils/jobClassification";

import thLocale from "@fullcalendar/core/locales/th"; // นำเข้า locale ภาษาไทย

import { useAuth } from "../../auth/AuthContext"; // ✅ ดึงข้อมูล Auth

import { jsPDF } from "jspdf";

import thSarabunFont from "../../Fonts/THSarabunNew_base64"; // นำเข้า base64 font

import TomSelect from "tom-select";
import "tom-select/dist/css/tom-select.css";

import Hammer from "hammerjs";

import { getAddEvent } from "./EventForms/AddEvent";
import { getEditEvent } from "./EventForms/EditEvent";
import { getSaveEventToDB } from "./EventForms/SaveEvent";
import { getEventDrop } from "./EventForms/EventDrop";
import { getEventResize } from "./EventForms/EventResize";
import { getFetchEvents } from "./EventForms/FetchEvents";
import { getDeleteEvent } from "./EventForms/DeleteEvent";
import { getAddDraftEvent } from "./EventForms/AddDraftEvent";

import { getGeneratePDF } from "./Functions/GenPDF";

import UnscheduledPanel from "./UnscheduledPanel";

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

function EventCalendar() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { userData } = useAuth(); // ✅ เปลี่ยนจาก user → userData
  const isAdmin = userData?.role?.toLowerCase() === "admin"; // ✅ รองรับ case-insensitive
  const isAdminOrManager = ["admin", "manager"].includes(
    userData?.role?.toLowerCase(),
  );

  const userId = userData?.userId; // หรือ field ที่เก็บ id ของ user

  // งานที่ปิดแล้ว (ดำเนินการเสร็จสิ้น) และผู้ใช้ไม่ใช่ admin/manager → ล็อก แก้ไขไม่ได้อีก
  const isJobLocked = (extendedProps) =>
    extendedProps?.status === "ดำเนินการเสร็จสิ้น" && !isAdminOrManager;

  // ✅ แก้ไขได้ถ้า: เป็น admin, เป็นคนเพิ่ม event เอง, หรือได้รับมอบหมาย
  // (resPerson ตรงกับ ID ตัวเอง หรือ team ตรงกับชื่อตัวเอง — เผื่อ event เก่าที่ยังไม่มี resPerson)
  // ❌ ยกเว้น: งานที่ admin ปิดแล้ว (ดำเนินการเสร็จสิ้น) ช่างแก้ไขไม่ได้อีก มีแค่ admin/manager เท่านั้น
  const canEditEvent = (extendedProps) => {
    if (isJobLocked(extendedProps)) {
      return false;
    }
    return (
      isAdmin ||
      extendedProps?.userId === userId ||
      (extendedProps?.resPerson && extendedProps.resPerson === userId) ||
      (extendedProps?.team && extendedProps.team === userData?.fname)
    );
  };

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
  // ✅ ใช้เช็คว่าตอนลากงานจากปฏิทินจริงออกมา (eventDragStop) ปล่อยเมาส์ทับแผงนี้หรือเปล่า
  // ถ้าใช่ = ลากกลับไปเป็นงานวางแผนล่วงหน้า (ดู handleEventDragStop ด้านล่าง)
  const draftsPanelRef = useRef(null);
  // ✅ เปิดแผงงานล่วงหน้าให้อัตโนมัติแค่ตอนโหลดครั้งแรกสุดถ้ามีงานอยู่จริง (ดู fetchDrafts) —
  // ป้องกันไม่ให้ auto เปิดซ้ำทับการปิดเองของผู้ใช้ทุกครั้งที่ fetch ใหม่ (เช่น silent refresh 30s)
  const hasAutoOpenedDraftsRef = useRef(false);

  useEffect(() => {
    fetchEventsFromDB();
    fetchDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!("ontouchstart" in window)) return;

    const calendarEl = document.querySelector(".fc-view-harness");
    if (!calendarEl) return;

    const hammer = new Hammer(calendarEl);
    hammer.on("swipeleft", () => calendarRef.current?.getApi().next());
    hammer.on("swiperight", () => calendarRef.current?.getApi().prev());

    return () => hammer.destroy();
  }, []);

  const generateWorkPermitPDF = async (event, docNo, subject, description) => {
    try {
      setLoading(true);
      await getGeneratePDF({
        jsPDF,
        thSarabunFont,
        event,
        moment,
        docNo,
        subject,
        description,
        userData,
      });
    } catch (error) {
      Swal.fire({
        title: "สร้าง PDF ไม่สำเร็จ",
        text: error.message || "โปรดลองอีกครั้ง",
        icon: "error",
        showConfirmButton: true,
      });
    } finally {
      setLoading(false);
    }
  };

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
    });
  };

  // ✅ งานวางแผนล่วงหน้า (unscheduled) — backend กรองแยกไว้จาก events ปกติแล้ว (ดู GET /events/drafts)
  const fetchDrafts = async (silent = false) => {
    if (!silent) setDraftsLoading(true);
    try {
      const res = await EventService.GetDraftEvents();
      const list = Array.isArray(res?.drafts) ? res.drafts : [];
      setDrafts(list);
      // ✅ เปิดแผงงานล่วงหน้าอัตโนมัติแค่ครั้งแรกสุดที่โหลดสำเร็จ ถ้ามีงานอยู่จริง — หลังจากนั้น
      // ผู้ใช้เปิด/ปิดเองได้ตามปกติโดยไม่ถูก auto เปิดทับซ้ำอีกตอน refresh รอบถัดๆ ไป
      if (!hasAutoOpenedDraftsRef.current) {
        hasAutoOpenedDraftsRef.current = true;
        if (list.length > 0) setShowDraftsPanel(true);
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
    await getEditEvent({
      navigate,
      events,
      setEvents,
      fetchEventsFromDB,
      fetchLookupOptions,
      eventInfo,
      setLoading,
      generateWorkPermitPDF,
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
            const ts = new TomSelect(el, {
              create: true,
              maxOptions: 7,
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
      willClose: (popup) => popup.querySelectorAll(".tomselected").forEach((el) => el.tomselect?.destroy()),
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
    const result = await Swal.fire({
      title: "ลบงานวางแผนล่วงหน้านี้?",
      text: `${draft.title || "งาน"} · ${[draft.company, draft.site].filter(Boolean).join(" · ")}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ลบ",
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
    // ❌ งานที่ปิดแล้ว (ดำเนินการเสร็จสิ้น) ห้ามย้ายกลับไปแผนล่วงหน้าเด็ดขาด ไม่มีข้อยกเว้นแม้แต่ admin/
    // manager — เทียบ pattern เดียวกับ canUnscheduleEvent ใน EditEvent.js/backend PUT /:id/unschedule
    // (canEditEvent ด้านบนไม่กันเคสนี้ เพราะ admin/manager ผ่าน canEditEvent เสมอไม่ว่างานจะปิดหรือไม่)
    if (info.event.extendedProps?.status === "ดำเนินการเสร็จสิ้น") {
      Swal.fire("❌ งานนี้ปิดแล้ว ไม่สามารถย้ายกลับไปแผนล่วงหน้าได้");
      return;
    }
    handleUnscheduleViaDrag(info.event.id);
  };

  const options = {
    // default is `save`
    method: "save",
    // default is Resolution.MEDIUM = 3, which should be enough, higher values
    // increases the image quality but also the size of the PDF, so be careful
    // using values higher than 10 when having multiple pages generated, it
    // might cause the page to crash or hang.
    resolution: Resolution.HIGH,
    page: {
      // margin is in MM, default is Margin.NONE = 0
      margin: Margin.SMALL,
      // default is 'A4'
      format: "a4",
      // default is 'portrait'
      orientation: "portrait",
    },
    canvas: {
      // default is 'image/jpeg' for better size performance
      mimeType: "image/png",
      qualityRatio: 1,
    },
    // Customize any value passed to the jsPDF instance and html2canvas
    // function. You probably will not need this and things can break,
    // so use with caution.
    overrides: {
      // see https://artskydj.github.io/jsPDF/docs/jsPDF.html for more options
      pdf: {
        compress: true,
      },
      // see https://html2canvas.hertzen.com/configuration for more options
      canvas: {
        useCORS: true,
      },
    },
  };

  const generatePdf = async () => {
    setLoading(true);

    try {
      const getTargetElement = () => document.getElementById("content-id");

      await generatePDF(getTargetElement, options);
      setLoading(false);
    } catch (error) {
      console.log(error);
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
    () => employeeList.filter((u) => u.role?.toLowerCase() === "technician"),
    [employeeList],
  );

  // ✅ กรอง drafts ที่ดึงมาทั้งหมดให้เหลือเฉพาะเดือนที่กำลังเปิดดูอยู่ในแผงงานล่วงหน้า
  const draftsForMonth = useMemo(
    () => drafts.filter((d) => d.plannedMonth === draftMonth),
    [drafts, draftMonth],
  );

  // ✅ ยอดรวม "งานรออนุมัติ" — แอดมิน/manager เห็นทั้งระบบ (มีสิทธิ์อนุมัติได้ทุกงาน) คนอื่นเห็นแค่ของ
  // ตัวเอง กันโชว์ตัวเลขที่กดอนุมัติเองไม่ได้อยู่ดี ดูแล้วงงว่าทำไมกดไม่ได้ — นับรวมทั้งงานที่มีวันที่แล้ว
  // (events) และแผนงานล่วงหน้าที่ยังไม่มีวันที่ (drafts) เข้าด้วยกัน
  const pendingApprovalCount = useMemo(
    () => countPendingJobs(events, drafts, { userId, isAdminOrManager }),
    [events, drafts, userId, isAdminOrManager]
  );

  const activeFilterCount = [selectedTechnician, selectedStatus, selectedJobType, selectedSystem, selectedApproval].filter(Boolean).length;
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

      const matchesTechnician =
        !selectedTechnician ||
        event.resPerson === selectedTechnician ||
        (!event.resPerson && selectedTechnicianName && event.team === selectedTechnicianName);

      const matchesStatus = !selectedStatus || event.status === selectedStatus;
      const matchesJobType = !selectedJobType || event.title === selectedJobType;
      const matchesSystem = !selectedSystem || event.system === selectedSystem;
      const matchesApproval = !selectedApproval || getApprovalState(event) === selectedApproval;

      return matchesKeyword && matchesTechnician && matchesStatus && matchesJobType && matchesSystem && matchesApproval;
    });
  }, [events, searchTerm, employeeList, selectedTechnician, selectedStatus, selectedJobType, selectedSystem, selectedApproval, technicianOptions]);

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

        <button
          className={`filter-toggle-btn ${showDraftsPanel ? "filter-toggle-btn--open" : ""} ${drafts.length > 0 ? "filter-toggle-btn--active" : ""}`}
          onClick={() => setShowDraftsPanel((p) => !p)}
          title="งานวางแผนล่วงหน้า (ยังไม่ลงตาราง)"
        >
          <FontAwesomeIcon icon={faLayerGroup} />
          {drafts.length > 0 && <span className="filter-badge">{drafts.length}</span>}
        </button>

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

        <button className="toolbar-icon-btn toolbar-icon-btn--pdf" onClick={generatePdf} title="สร้าง PDF">
          <FontAwesomeIcon icon={faFilePdf} />
        </button>

        <CSVLink
          data={
            filteredCalendarEvents
              ? Object.values(filteredCalendarEvents)
                  .sort((a, b) => new Date(a.start) - new Date(b.start))
                  .map((event) => ({
                    วันที่เริ่มต้น: moment(event.start).format("YYYY-MM-DD"),
                    วันที่สิ้นสุด: event.end
                      ? moment(event.end).format("YYYY-MM-DD")
                      : moment(event.start).format("YYYY-MM-DD"),
                    บริษัท: event.company ?? "",
                    สถานที่ติดตั้ง: event.site ?? "",
                    หัวข้อ: event.title ?? "",
                    ระบบ: event.system ?? "",
                    // ⚠️ event.extendedProps มีแค่ userId/lastModifiedBy/startTime/endTime เท่านั้น
                    // (ดู FetchEvents.js) ไม่มี time/team อยู่ในนั้นเลย ต้องอ่านจาก event.time/event.team
                    // (top-level) โดยตรง ไม่งั้นสองคอลัมน์นี้จะว่างเปล่าทุกแถวใน Excel/CSV ที่ export ออกไป
                    // ✅ "1/3" (ครั้งที่/จำนวนครั้งทั้งหมด) เหมือนจุดอื่นๆ — เติม ' นำหน้าไว้เสมอกัน Excel
                    // ตีความ "1/3" เป็นวันที่ (1 มี.ค.) ให้อัตโนมัติ ซึ่งเคยเป็นปัญหาแม้กับเลขครั้งเดี่ยวๆ
                    ครั้งที่: event.time ? `'${formatRoundLabel(event.time, event.visitCount)}` : "",
                    ทีมงาน: event.team ?? "",

                    เวลาเริ่ม: event.extendedProps?.startTime ?? "",
                    เวลาสิ้นสุด: event.extendedProps?.endTime ?? "",
                  }))
              : []
          }
          filename="events.csv"
        >
          <button className="toolbar-icon-btn toolbar-icon-btn--excel" title="สร้าง Excel">
            <FontAwesomeIcon icon={faFileExcel} />
          </button>
        </CSVLink>
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

          <select
            className="event-filter-select"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="">ทุกสถานะ</option>
            {statusLegend.map((s) => (
              <option key={s.label} value={s.label}>{s.label}</option>
            ))}
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

          <select
            className="event-filter-select"
            value={selectedApproval}
            onChange={(e) => setSelectedApproval(e.target.value)}
          >
            <option value="">ทุกสถานะอนุมัติ</option>
            <option value="pending">⏳ รออนุมัติ</option>
            <option value="rejected">❌ ไม่อนุมัติ</option>
          </select>

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
      <div className={`calendar-layout ${showDraftsPanel ? "calendar-layout--with-drafts" : ""}`}>
        {showDraftsPanel && (
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

        <div id="content-id" className="calendar-wrapper">
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

            if (canEditEvent(arg.event.extendedProps)) {
              handleEditEvent(arg);

            } else {
              Swal.fire("❌ คุณไม่มีสิทธิ์แก้ไขแผนงานนี้");
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

/* ✅ แถบสีขอบซ้ายบอกประเภทงาน — บางๆ ไม่แย่งพื้นที่จากไอคอนมุม/ป้ายรออนุมัติที่มีอยู่แล้ว
   (ดู eventClassNames ด้านบน และป้ายอธิบายสีใน .ec-legend-panel กลุ่ม "ประเภทงาน" ด้านล่างของหน้า) */
.fc-event-type-contract { border-left: 4px solid ${JOB_CLASS_META.contract.color} !important; }
.fc-event-type-project  { border-left: 4px solid ${JOB_CLASS_META.project.color} !important; }
.fc-event-type-general  { border-left: 4px solid ${JOB_CLASS_META.general.color} !important; }

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
        {/* ✅ คำอธิบายสัญลักษณ์ — แยกเป็น 4 กลุ่มตามความหมาย (สถานะ/การอนุมัติ/ประเภทงาน/อื่นๆ) แทน
            แถวเดียวยัดรวมกันแบบเดิม (11 รายการปนกันไม่มีหัวข้อ อ่านยาก) แต่ละกลุ่มมีหัวข้อกำกับชัดเจน */}
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
        </div>
      </div>

      {loading && (
        <div className="loading-overlay">
          <ThreeDots type="ThreeDots" color="#007bff" height={50} width={50} />
        </div>
      )}
    </div>
  );
}

export default EventCalendar;
