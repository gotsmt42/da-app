import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";

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
} from "@fortawesome/free-solid-svg-icons"; // Import ไอคอนต่างๆ

import CustomerService from "../../services/CustomerService";
import EventService from "../../services/EventService";

import AuthService from "../../services/authService";

import moment from "moment";

import { ThreeDots } from "react-loader-spinner";

import generatePDF, { Resolution, Margin } from "react-to-pdf";

import { Col, Row } from "reactstrap";

import { CSVLink } from "react-csv";

import "./index.css";

import API from "../../API/axiosInstance";

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

import { getGeneratePDF } from "./Functions/GenPDF";

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
  const [defaultBackgroundColor, setDefaultBackgroundColor] =
    useState("#FF5733"); // สีพื้นหลังเริ่มต้น

  const [defaultFontSize, setDefaultFontSize] = useState(8); //

  const [loading, setLoading] = useState(false); // เพิ่มสถานะการโหลด

  const [searchTerm, setSearchTerm] = useState(""); // 🔍 State สำหรับค้นหา

  const calendarRef = useRef(null);

  useEffect(() => {
    fetchEventsFromDB();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Realtime: รีเฟรชข้อมูลเงียบๆ ทุก 30 วินาที เพื่อให้เห็นการเปลี่ยนแปลง
  // จากคนอื่น (เพิ่ม/แก้ไข/ลบ event) โดยไม่ต้องกดรีเฟรชหน้าเอง
  useEffect(() => {
    const interval = setInterval(() => {
      fetchEventsFromDB(true);
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
        event.status === "ยืนยันแล้ว"
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

  const HOLIDAY_COLORS = {
    public: "#FF0000", // วันหยุดราชการ
    bank: "#1E90FF", // วันหยุดธนาคาร
    default: "#8A8A8A", // อื่น ๆ
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

  const saveEventToDB = async (newEvent) => {
    await getSaveEventToDB({ newEvent, EventService });
  };

  const handleAddEvent = async (arg) => {
    await getAddEvent({
      arg,
      events,
      setEvents,
      defaultTextColor,
      defaultBackgroundColor,
      setDefaultTextColor,
      setDefaultBackgroundColor,
      setDefaultFontSize,
      saveEventToDB,
      fetchEventsFromDB,

      CustomerService,
      AuthService,
      Swal,
      TomSelect,
      moment,
    });
  };

  const handleEditEvent = async (eventInfo) => {
    await getEditEvent({
      navigate,
      setEvents,
      fetchEventsFromDB,
      eventInfo,
      setLoading,
      generateWorkPermitPDF,
      handleDeleteEvent,
      EventService,
      CustomerService,
      AuthService,
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

  const handleEventDrop = async (arg) => {
    await getEventDrop({
      arg,
      fetchEventsFromDB,
      setEvents,

      EventService,
      Swal,
      moment,
    });
  };

  const handleEventResize = async (arg) => {
    await getEventResize({
      arg,
      fetchEventsFromDB,
      setEvents,
      EventService,
      moment,
    });
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

        cell.style.backgroundColor = isWeekend && isSameMonth ? "#FFFFF4" : "";
      });
    });
  }, []);

  const [employeeList, setEmployeeList] = useState([]);

  useEffect(() => {
    (async () => {
      const res = await AuthService.getAllUserData();
      setEmployeeList(res?.allUser || []);
    })();
  }, []);

  const filteredCalendarEvents = useMemo(() => {
    const keyword = searchTerm.toLowerCase();

    return events.filter((event) => {
      // หาคนที่เป็นเจ้าของ event จาก employeeList
      const owner = employeeList.find(
        (emp) =>
          emp._id?.toString() === event.extendedProps?.userId?.toString(),
      );

      const ownerName = owner?.username?.toLowerCase() || "";

      return [
        event.title ?? "",
        event.site ?? "",
        event.company ?? "",
        event.system ?? "",
        event.team ?? "",
        event.time?.toString() ?? "",
        ownerName, // ✅ เพิ่มชื่อเจ้าของเข้าไปในเงื่อนไข search
      ].some((field) => field.toLowerCase().includes(keyword));
    });
  }, [events, searchTerm, employeeList]);

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
<div className="modern-calendar-container">      <Row className="flex-wrap mb-3 d-flex justify-content-center justify-content-md-between">
        <Col className="col-12 col-md-5 col-lg">
          <button className="btn btn-sm btn-danger" onClick={generatePdf}>
            <FontAwesomeIcon icon={faFilePdf} /> สร้าง PDF
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
                      ครั้งที่: event.time ? `'${event.time}` : "",
                      ทีมงาน: event.team ?? "",

                      เวลาเริ่ม: event.extendedProps?.startTime ?? "",
                      เวลาสิ้นสุด: event.extendedProps?.endTime ?? "",
                    }))
                : []
            }
            filename="events.csv"
          >
            <button className="btn btn-sm btn-success mx-1 m-2">
              <FontAwesomeIcon icon={faFileExcel} /> สร้าง Excel
            </button>
          </CSVLink>
        </Col>
      </Row>

      <div className="mb-3">
        <input
          type="search"
          className="form-control"
          placeholder="🔍 ค้นหาแผนงาน เช่น ชื่อโครงการ หัวข้อ ระบบ..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div
        id="content-id"
        className="calendar-wrapper"
        style={{ flex: 1, width: "100%" }}
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
          // editable={isAdmin}
          // selectable={isAdmin}
          // droppable={isAdmin}
          // dateClick={isAdmin ? handleAddEvent : null}

          editable={true} // ✅ เปิดให้ทุกคน drag/resize ได้
          selectable={true} // ✅ เปิดให้ทุกคนเลือกวันได้
          droppable={true}
          dateClick={handleAddEvent}
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
          showNonCurrentDates={false} // ✅ ไม่แสดงวันของเดือนก่อนและหลัง
          firstDay={0} // ✅ กำหนดให้วันอาทิตย์เป็นวันแรกของสัปดาห์
          eventContent={(arg) => {
            const { title, extendedProps, backgroundColor, textColor } = arg.event;
            const {
              system = "",
              time = "",
              site = "",
              team = "",
              startTime = "",
              endTime = "",
              status,
            } = extendedProps;

            // ✅ สร้าง display string แบบมีเงื่อนไข
            const siteDisplay = site ? `- โครงการ : ${site}` : "";
            const timeDisplay = time ? `- ครั้งที่ : ${time}` : "";
            const teamDisplay = team ? `- ทีม : ${team}` : "";

            const systemDisplay = system ? `- ระบบ : ${system}` : "";

            const timeRangeDisplay =
              startTime && endTime
                ? `เวลา : ${startTime} - ${endTime}`
                : startTime
                ? `- เริ่มเวลา : ${startTime}`
                : endTime
                ? `- สิ้นสุดเวลา : ${endTime}`
                : "";

            const isSmallScreen = window.innerWidth < 576;
            const fontSize = isSmallScreen ? "0.67em" : "1em";

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

            return {
              html: `
                <div style="position: relative; display: flex; align-items: center; padding: ${badgePadding}; width: 110%;">
                  <div style="font-size: ${fontSize}; line-height: 2; padding: 0px; flex: 1; min-width: 0;">
                    <div>[ ${title} ]  </div>

                    <div> ${systemDisplay} </div>
                    <div> ${siteDisplay}</div>
                     <div>${timeDisplay} </div>


                <div>${teamDisplay}</div>
                  ${timeRangeDisplay ? `<div>${timeRangeDisplay}</div>` : ""}
                </div>
                  ${badgeHtml}
                </div>
    `,
            };
          }}
          headerToolbar={{
            left: "prev,next",
            center: "title",
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
          datesSet={handleHighlightWeekends} // ✅ อัปเดตสีวันเสาร์-อาทิตย์เมื่อเปลี่ยนเดือน
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
          eventClassNames={(arg) =>
            !canEditEvent(arg.event.extendedProps) ? ["fc-event-locked"] : []
          }
          dayCellDidMount={(info) => {
            const date = moment(info.date); // แปลงเป็น moment object
            const currentMonth = moment(info.view.currentStart).month(); // เดือนปัจจุบันที่กำลังแสดงในปฏิทิน
            const isSaturday = date.isoWeekday() === 6; // ตรวจสอบวันเสาร์
            const isSunday = date.isoWeekday() === 7; // ตรวจสอบวันอาทิตย์
            const isSameMonth = date.month() === currentMonth; // ตรวจสอบว่าเป็นของเดือนปัจจุบันหรือไม่

            // ✅ ไฮไลต์วันเสาร์-อาทิตย์ เฉพาะวันที่อยู่ในเดือนปัจจุบัน
            if ((isSaturday || isSunday) && isSameMonth) {
              info.el.style.backgroundColor = "#FFFFF4"; // สีเหลืองอ่อน
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
              display: flex;
              justify-content: space-between;
              width: 100%;
        font-size: 12px !important; /* ✅ ปรับขนาดฟอนต์ให้เล็กลงสำหรับมือถือ */
            }
            .fc-toolbar-title {
              flex: 1;
              text-align: center;
              font-size: 1.5em;
              margin: 0;
            }
            .fc-button {
              flex: 1;
              min-width: 0;
              margin: 2px;
            }
            .fc-button-group {
              display: flex;
              width: 100%;
            }
            .fc-button-group .fc-button {
              flex: 1;
            }
            .fc-footer-toolbar {
              display: flex;
              justify-content: center;
              width: 100%;
              margin-top: 5px;
            }
          }
.fc-event-locked {
      opacity: 0.7;
      filter: grayscale(10%);
    }

.legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
    }

    .legend-color {
      width: 14px;
      height: 14px;
      border-radius: 3px;
    }

    @media (max-width: 768px) {
      .color-legend-container {
        justify-content: left; /* ✅ จัดตรงกลางในหน้าจอเล็ก */
      }

      .color-legend {
        justify-content: left;
        flex-direction: column;
        font-size: 12px;
        gap: 10px;
      }
    }
        `}
        </style>
        {/* ✅ คำอธิบายสถานะแผนงาน (Legend) */}
        <div
          className="color-legend-container"
          style={{
            display: "flex",
            justifyContent: "left",
            alignItems: "flex-start",
            flexWrap: "wrap",
            padding: "8px",
            borderRadius: "8px",
            width: "100%",
          }}
        >
          <div
            className="color-legend"
            style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}
          >
            {statusLegend.map((status) => (
              <div
                key={status.label}
                className="legend-item"
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <FontAwesomeIcon
                  icon={status.icon}
                  style={{ color: status.color }}
                />
                <span>{status.label}</span>
              </div>
            ))}
            <div
              className="legend-item"
              style={{ display: "flex", alignItems: "center", gap: "8px", opacity: 0.7, filter: "grayscale(10%)" }}
            >
              <span
                style={{
                  display: "inline-block", width: 14, height: 14, borderRadius: 3,
                  background: "#8A8A8A",
                }}
              />
              <span>งานสีจาง = ไม่ใช่งานของคุณ (ดูได้ แต่แก้ไขไม่ได้)</span>
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
