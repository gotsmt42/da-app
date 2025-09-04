import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom/client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid"; // for dayClick
import momentTimezonePlugin from "@fullcalendar/moment-timezone";

import interactionPlugin, { Draggable } from "@fullcalendar/interaction"; // ✅ เพิ่ม Draggable

import listPlugin from "@fullcalendar/list";

import Swal from "sweetalert2";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"; // Import FontAwesomeIcon component

import {
  faBell,
  faClockFour,
  faClockRotateLeft,
  faFileExcel,
  faFilePdf,
  faPlus,
  faHourglassHalf,
  faCheckCircle,
  faCheck,
  faClock,
  faSpinner,
  faCheckDouble,
  faTimesCircle,
  faFileSignature,
  faFileInvoiceDollar,
  faCoins,
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

function EventCalendar() {
  const { userData } = useAuth(); // ✅ เปลี่ยนจาก user → userData
  const isAdmin = userData?.role?.toLowerCase() === "admin"; // ✅ รองรับ case-insensitive

  const [events, setEvents] = useState([]);

  const [eventReceive, setEventReceive] = useState([]);
  const [defaultTextColor, setDefaultTextColor] = useState("#FFFFFF"); // สีข้อความเริ่มต้น
  const [defaultBackgroundColor, setDefaultBackgroundColor] =
    useState("#FF5733"); // สีพื้นหลังเริ่มต้น

  const [defaultFontSize, setDefaultFontSize] = useState(8); //

  const [loading, setLoading] = useState(false); // เพิ่มสถานะการโหลด

  const [searchTerm, setSearchTerm] = useState(""); // 🔍 State สำหรับค้นหา

  useEffect(() => {
    fetchEventsFromDB();
    initExternalEvents(); // ✅ เรียกใช้เมื่อลง component
  }, []);

  useEffect(() => {
    const today = moment().format("YYYY-MM-DD");
    let hasUpdated = false;

    const updatedEvents = events.map((event) => {
      const eventStartDate = moment(event.start).format("YYYY-MM-DD");
      // เงื่อนไข: หาก event อยู่ในวันที่ปัจจุบันและ
      // ไม่มีการแก้ไขด้วยมือ (manualStatus ไม่เป็น true)
      // และ status ไม่ใช่ "กำลังดำเนินการ"
      if (
        eventStartDate === today &&
        !event.manualStatus && // สามารถใช้ event.manualStatus จากระดับบนสุดได้
        event.extendedProps?.status !== "กำลังดำเนินการ"
      ) {
        hasUpdated = true;
        return {
          ...event,
          extendedProps: {
            ...event.extendedProps,
            status: "กำลังดำเนินการ",
          },
          manualStatus: false, // กำหนดให้ชัดเจน
        };
      }
      return event;
    });

    if (hasUpdated) {
      setEvents(updatedEvents);
      updatedEvents.forEach(async (event) => {
        if (
          moment(event.start).format("YYYY-MM-DD") === today &&
          !event.manualStatus &&
          event.extendedProps?.status === "กำลังดำเนินการ"
        ) {
          try {
            await EventService.UpdateEvent(event.id, {
              status: "กำลังดำเนินการ",
              manualStatus: false,
            });
            console.log(
              `✅ อัปเดตสถานะของ Event ID ${event.id} เป็น "กำลังดำเนินการ"`
            );
          } catch (error) {
            console.error(
              `❌ อัปเดตสถานะของ Event ID ${event.id} ไม่สำเร็จ: ${error}`
            );
          }
        }
      });
    }
  }, [events]);

  useEffect(() => {
    const calendarEl = document.querySelector(".fc-view-harness");
    if (!calendarEl) return;

    const hammer = new Hammer(calendarEl);

    hammer.on("swipeleft", () => {
      calendarRef.current?.getApi().next();
    });

    hammer.on("swiperight", () => {
      calendarRef.current?.getApi().prev();
    });

    return () => hammer.destroy();
  }, []);

  const generateWorkPermitPDF = (event) => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "A4",
    });

    const timeText = event.extendedProps.time
      ? `ครั้งที่ ${event.extendedProps.time} `
      : ""; // ถ้าไม่มี time จะไม่แสดงอะไรเลย

    // 👉 ฟอนต์ THSarabun
    doc.addFileToVFS("THSarabun.ttf", thSarabunFont);
    doc.addFont("THSarabun.ttf", "THSarabun", "normal");
    doc.setFont("THSarabun");
    doc.setFontSize(16);

    // 👉 ใส่โลโก้บริษัท (ระบุ base64 หรือ path)
    const logo = "001.png"; // 👈 โลโก้บริษัท
    doc.addImage(logo, "PNG", 15, 10, 30, 30); // x, y, width, height

    // 👉 ข้อมูลหัวจดหมาย
    doc.setFontSize(20);
    doc.text("บริษัท ดู ออล อาร์คิเทค แอนด์ เอ็นจิเนียริ่ง จำกัด", 105, 20, {
      align: "center",
    });

    doc.setFontSize(14);
    doc.text("DO ALL ARCHITECT AND ENGINEERING CO.,LTD.", 105, 28, {
      align: "center",
    });

    doc.setFontSize(12);
    doc.text(
      "68/155 หมู่ 3 ถนนชัยพฤกษ์ ตำบลคลองพระอุดม อำเภอปากเกร็ด จังหวัดนนทบุรี 11120",
      105,
      34,
      {
        align: "center",
      }
    );

    doc.text("วันที่: " + moment().format("DD-MM-YYYY"), 170, 44, {
      align: "right",
    });

    doc.line(15, 48, 195, 48); // เส้นคั่น

    // 👉 หัวเรื่อง
    doc.setFontSize(16);
    doc.text(
      `แจ้งแผนงานการเข้าดำเนินการ ${event.title} ระบบ ${event.extendedProps.system} ${timeText}`,
      105,
      58,
      {
        align: "center",
      }
    );

    // 👉 ข้อมูล Event
    const end_o = moment(event.end).format("DD-MM-YYYY");
    const start = moment(event.start).format("DD-MM-YYYY");
    const end = moment(event.end).format("DD-MM-YYYY");

    const lines = [
      "",
      `เรียน  ผู้จัดการโครงการ ${event.extendedProps.site}`,
      "",
      `        ตามที่บริษัท ดู ออล อาคิเทค แอนด์ เอ็นจิเนียริ่ง จำกัด ได้รับความไว้วางใจจาก ${event.extendedProps.company} `,
      `ให้เข้าดำเนินการ ${event.title} ระบบ ${event.extendedProps.system} ${timeText} ณ โครงการ ${event.extendedProps.site}`,
      "",

      `        บริษัท ดู ออล อาคิเทค แอนด์ เอ็นจิเนียริ่ง จำกัด ขอแจ้งให้ท่านทราบถึงกำหนดการเข้า ${event.title} ระบบ ${event.extendedProps.system}`,
      `ครั้งที่ ${event.extendedProps.time} ซึ่งทางบริษัทฯ มีกำหนดการเข้าดำเนินการในช่วงเวลาดังนี้`,

      "",

      `        Description`,

      "",

      "        ดังนั้น บริษัท ฯ ใคร่ขอความร่วมมือ แจ้งผู้เกี่ยวข้องทุกท่านเพื่อทราบกำหนดการดังกล่าว ทั้งนี้บริษัทจะเข้าดำเนินการโดยไม่ส่งผลกระทบ",
      "ต่อผู้ใช้งานพื้นที่พร้อมมีมาตรการความปลอดภัยตามมาตรฐาน หากท่านไม่สะดวกในการดำเนินการตามวันเวลาดังกล่าวกรุณาแจ้งกลับที่",
      "บริษัท ดู ออล อาคิเทค แอนด์ เอ็นจิเนียริ่ง จำกัด ด้วย จักขอบพระคุณยิ่ง ",
    ];

    doc.setFontSize(14);
    let y = 68;
    lines.forEach((line) => {
      doc.text(line, 20, y);
      y += 8;
    });

    // 👉 ลายเซ็น
    const signature = "001.png"; // 👈 ลายเซ็น
    doc.addImage(signature, "PNG", 140, y + 10, 40, 20); // ปรับตำแหน่งตามความเหมาะสม

    doc.text("ขอแสดงความนับถือ", 150, y + 35);
    // doc.text("วิศวกรควบคุมระบบ", 140, y + 45);
    // doc.text("064-111-0988", 140, y + 52);

    // 👉 บันทึก PDF
    doc.save(`WorkPermit_${event.title}.pdf`);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      // case "ยกเลิก":
      //   return faTimesCircle; // ❌
      case "กำลังรอยืนยัน":
        return faHourglassHalf; // ⏳
      case "ยืนยันแล้ว":
        return faCheck; // ✔️
      case "กำลังดำเนินการ":
        return faClockRotateLeft; // 🕒
      // case "เสนอราคาแก้ไขแล้ว":
      //   return faFileSignature; // 📝
      // case "วางบิลแล้วรอเก็บเงิน":
      //   return faFileInvoiceDollar; // 📄💸
      case "ดำเนินการเสร็จสิ้น":
        return faCheckDouble; // 💰
      default:
        return null;
    }
  };

  // ✅ ฟังก์ชันตั้งค่า External Events ให้สามารถลากได้
  const initExternalEvents = () => {
    let containerEl = document.getElementById("external-events");
    if (containerEl) {
      new Draggable(containerEl, {
        itemSelector: ".fc-event",
        eventData: (eventEl) => {
          return {
            title: eventEl.innerText.trim(), // ดึงข้อความของ event
          };
        },
      });
    }
  };

  const fetchThaiHolidaysFromAPI = async () => {
    try {
      const response = await API.get(`/holidays`);
      // console.log("API Response:", response.data); // ตรวจสอบโครงสร้างของ API response

      // ตรวจสอบว่า response.data มีค่าหรือไม่
      if (response.data) {
        // แสดงข้อมูลทั้งหมดของ response.data
        // console.log("Complete Data Structure:", JSON.stringify(response.data, null, 2));  // ตรวจสอบโครงสร้างทั้งหมด

        // ตรวจสอบโครงสร้างและหาข้อมูลที่ต้องการ
        if (response.data && Array.isArray(response.data)) {
          // ถ้าข้อมูลใน response.data เป็น Array
          const holidays = response.data.map((holiday) => ({
            title: holiday.HolidayDescriptionThai,
            start: holiday.Date, //
            color: "#FF0000", // กำหนดสี
          }));

          // console.log("Mapped Holidays for Calendar:", holidays);  // ตรวจสอบข้อมูลหลังจาก map
          return holidays;
        } else {
          console.error(
            "Invalid structure, 'result.data' missing or incorrect."
          );
          return [];
        }
      } else {
        console.error("No data found in API response.");
        return [];
      }
    } catch (error) {
      console.error("Error fetching holidays from API:", error.message);
      return [];
    }
  };

  const fetchEventsFromDB = async () => {
    await getFetchEvents({
      defaultFontSize,
      setEvents,
      setLoading,
      EventService,
      fetchThaiHolidaysFromAPI,
    });
  };

  const saveEventToDB = async (newEvent) => {
    await getSaveEventToDB({ newEvent });
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
    });
  };

  const handleDeleteEvent = (id) => {
    try {
      Swal.fire({
        title: "คุณแน่ใจหรือไม่?",
        text: "เมื่อทำการลบแล้ว คุณจะไม่สามารถกู้คืนแผนงานนี้ได้!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "ใช่, ลบแผนงาน",
        cancelButtonText: "ยกเลิก",
      }).then(async (result) => {
        if (result.isConfirmed) {
          setLoading(true); // เริ่มต้นโหลดข้อมูล

          try {
            // ส่งคำขอลบแผนงานไปที่เซิร์ฟเวอร์
            await EventService.DeleteEvent(id);

            // อัปเดต state โดยกรองแผนงานที่ถูกลบออกจากปฏิทิน
            setEvents((prevEvents) =>
              prevEvents.filter((event) => event._id !== id)
            );

            // โหลดข้อมูลใหม่จากฐานข้อมูล
            await fetchEventsFromDB();

            setLoading(false);

            // แสดงข้อความแจ้งเตือนว่าการลบสำเร็จ
            Swal.fire({
              title: "ลบแผนงานสำเร็จ!",
              text: "แผนงานของคุณถูกลบแล้ว",
              icon: "success",
              showConfirmButton: false,
              timer: 1500,
            });
          } catch (error) {
            console.error("❌ เกิดข้อผิดพลาดในการลบแผนงาน:", error);
            Swal.fire({
              title: "เกิดข้อผิดพลาด!",
              text: "ไม่สามารถลบแผนงานได้ กรุณาลองใหม่อีกครั้ง",
              icon: "error",
            });
          } finally {
            setLoading(false);
          }
        }
      });
    } catch (error) {
      console.error("❌ เกิดข้อผิดพลาดในการลบแผนงาน:", error);
    }
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

  const calendarRef = useRef(null);

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

  const [currentPage, setCurrentPage] = useState(1);
  const [eventsPerPage, setEventsPerPage] = useState(8); // ค่าเริ่มต้น

  // ✅ ตรวจจับขนาดหน้าจอและอัปเดตจำนวน event ต่อหน้า
  useEffect(() => {
    const updateEventsPerPage = () => {
      if (window.innerWidth < 768) {
        setEventsPerPage(5); // หน้าจอเล็ก
      } else {
        setEventsPerPage(8); // หน้าจอใหญ่
      }
    };

    updateEventsPerPage(); // เรียกใช้งานครั้งแรก
    window.addEventListener("resize", updateEventsPerPage); // ฟังชั่นจะทำงานทุกครั้งที่หน้าจอเปลี่ยนขนาด

    return () => window.removeEventListener("resize", updateEventsPerPage); // ลบ event listener เมื่อ component ถูก unmount
  }, []);

  const sortedEvents = [...eventReceive].sort((a, b) => {
    const dateA = a.createdAt
      ? moment(a.createdAt)
      : a._id
      ? moment(a._id?.toString().substring(0, 8), "hex")
      : moment(0);

    const dateB = b.createdAt
      ? moment(b.createdAt)
      : b._id
      ? moment(b._id?.toString().substring(0, 8), "hex")
      : moment(0);

    return dateB.diff(dateA); // เรียงจากใหม่ไปเก่า
  });

  // ✅ กรองข้อมูลที่ค้นหา ก่อนแบ่งหน้า
  const filteredEvents = sortedEvents.filter((event) =>
    event.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ✅ คำนวณ Pagination จากผลลัพธ์ที่กรองแล้ว
  const totalPages = Math.ceil(filteredEvents.length / eventsPerPage);
  const startIndex = (currentPage - 1) * eventsPerPage;
  const endIndex = startIndex + eventsPerPage;
  const paginatedEvents = filteredEvents.slice(startIndex, endIndex);

  // ✅ ตรวจสอบว่าหน้าปัจจุบันเกิน totalPages หรือไม่ แล้วปรับให้ถูกต้อง
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [filteredEvents, totalPages, currentPage]);

  const handleHighlightWeekends = () => {
    setTimeout(() => {
      document.querySelectorAll(".fc-daygrid-day").forEach((cell) => {
        const dateStr = cell.getAttribute("data-date"); // รับค่าวันที่จาก attribute
        const date = moment(dateStr);
        const currentMonth = moment(
          calendarRef.current.getApi().getDate()
        ).month(); // ดึงเดือนปัจจุบันที่กำลังแสดง
        const isSaturday = date.isoWeekday() === 6;
        const isSunday = date.isoWeekday() === 7;
        const isSameMonth = date.month() === currentMonth; // ตรวจสอบว่าเป็นของเดือนปัจจุบัน

        // รีเซ็ตสีพื้นหลังทุกเซลล์ก่อน
        cell.style.backgroundColor = "";

        // ไฮไลต์เฉพาะวันเสาร์-อาทิตย์ของเดือนปัจจุบัน
        if ((isSaturday || isSunday) && isSameMonth) {
          cell.style.backgroundColor = "#FFFFF4"; // สีเหลืองอ่อน
        }
      });
    }, 0); // ใช้ setTimeout(0) เพื่อให้แน่ใจว่าทำหลังจาก FullCalendar render เสร็จ
  };

  const filteredCalendarEvents = events.filter((event) => {
    const keyword = searchTerm.toLowerCase();
    return (
      event.title?.toLowerCase().includes(keyword) ||
      event.extendedProps?.site?.toLowerCase().includes(keyword) ||
      event.extendedProps?.company?.toLowerCase().includes(keyword) ||
      event.extendedProps?.system?.toLowerCase().includes(keyword) ||
      event.extendedProps?.time?.toString().includes(keyword)
    );
  });

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
    <div>
      <Row className="flex-wrap mb-3 d-flex justify-content-center justify-content-md-between">
        <Col className="col-12 col-md-5 col-lg">
          <button className="btn btn-sm btn-danger" onClick={generatePdf}>
            <FontAwesomeIcon icon={faFilePdf} /> สร้าง PDF
          </button>
          <CSVLink
            data={
              events
                ? Object.values(events)
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
                      ครั้งที่: event.extendedProps?.time
                        ? `'${event.extendedProps.time}`
                        : "",
                      ทีมงาน: event.extendedProps?.team ?? "",
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
      <div id="content-id" style={{ flex: 1, width: "100%" }}>
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
          editable={isAdmin}
          selectable={isAdmin}
          droppable={isAdmin}
          dateClick={isAdmin ? handleAddEvent : null}
          eventClick={isAdmin ? handleEditEvent : null}
          eventDrop={isAdmin ? handleEventDrop : null}
          eventResize={isAdmin ? handleEventResize : null}
          events={filteredCalendarEvents}
          allDaySlot={true}
          nowIndicator={true}
          selectMirror={true}
          weekends={true}
          contentHeight="auto"
          showNonCurrentDates={false} // ✅ ไม่แสดงวันของเดือนก่อนและหลัง
          firstDay={0} // ✅ กำหนดให้วันอาทิตย์เป็นวันแรกของสัปดาห์
          eventContent={(arg) => {
            const { title, extendedProps } = arg.event;
            const {
              system = "",
              time = "",
              site = "",
              team = "",
            } = extendedProps;

            const siteDisplay = site ? ` - ${site}` : "";
            const timeDisplay = time ? ` ครั้งที่ ${time}` : "";
            const teamDisplay = team ? ` - ( ทีม ${team} )` : "";
            return {
              html: `
              [ ${title} ]
              ${system} ${timeDisplay}
              ${siteDisplay} ${teamDisplay}
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
            listWeek: { dayMaxEventRows: window.innerWidth >= 576 ? 7 : 5 },
            dayGridMonth: { dayMaxEventRows: window.innerWidth >= 576 ? 7 : 5 },
            timeGridWeek: { dayMaxEventRows: window.innerWidth >= 576 ? 7 : 5 },
            timeGridDay: { dayMaxEventRows: window.innerWidth >= 576 ? 7 : 5 },
          }}
          eventDidMount={(info) => {
            const status = info.event.extendedProps.status;
            const icon = getStatusIcon(status);
            const statusDescription = {
              ยกเลิก: "ยกเลิก",
              กำลังรอยืนยัน: "กำลังรอยืนยัน",
              ยืนยันแล้ว: "ยืนยันแล้ว",
              กำลังดำเนินการ: "กำลังดำเนินการ",
              เสนอราคาแก้ไขแล้ว: "เสนอราคาแก้ไขแล้ว",
              วางบิลแล้วรอเก็บเงิน: "วางบิลแล้วรอเก็บเงิน",
              ดำเนินการเสร็จสิ้นเก็บเงินแล้ว: "ดำเนินการเสร็จสิ้นเก็บเงินแล้ว",
            };

            if (icon) {
              // ✅ ตรวจสอบขนาดหน้าจอ
              const isSmallScreen = window.innerWidth < 768; // ✅ กำหนดเงื่อนไขสำหรับหน้าจอเล็ก

              // ✅ ดึงสีพื้นหลังและสีตัวหนังสือของ Event
              const backgroundColor = info.event.backgroundColor || "#ffffff"; // สีพื้นหลัง
              const textColor = info.event.textColor || "#000000"; // สีตัวหนังสือ

              // ✅ ขนาดของไอคอนตามขนาดหน้าจอ
              const iconSize = isSmallScreen ? "10px" : "15px"; // 📌 ถ้าหน้าจอเล็ก ใช้ขนาด 10px, ถ้าหน้าจอใหญ่ ใช้ขนาด 16px
              const padding = isSmallScreen
                ? "10px 0px 2px 2px" // 📌 ถ้าหน้าจอเล็ก
                : "10px 0px 3px 3px"; // 📌 ถ้าหน้าจอใหญ่

              // 🔹 ปรับแต่ง container หลักของ event (ให้มีพื้นที่สำหรับไอคอน)
              info.el.style.position = "relative"; // ✅ ทำให้ไอคอนใช้ absolute ได้
              info.el.style.display = "flex";
              info.el.style.alignItems = "center"; // ✅ จัดข้อความให้อยู่ตรงกลางแนวตั้ง
              info.el.style.padding = `${padding}`; // ✅ เพิ่ม Padding ด้านขวาให้ไอคอนไม่ทับตัวหนังสือ

              // 🔹 สร้าง div สำหรับไอคอน
              const iconContainer = document.createElement("div");
              iconContainer.style.position = "absolute";
              iconContainer.style.right = "2px"; // ✅ อยู่ชิดขวา
              iconContainer.style.top = "1px"; // ✅ อยู่มุมขวาบน
              iconContainer.style.width = iconSize; // ✅ ใช้ขนาดที่กำหนดจากเงื่อนไข
              iconContainer.style.height = iconSize;
              iconContainer.style.display = "flex";
              iconContainer.style.alignItems = "center";
              iconContainer.style.justifyContent = "center";
              iconContainer.style.backgroundColor = `${backgroundColor}`; // ✅ ใช้สีพื้นหลังของ event
              iconContainer.style.cursor = "pointer"; // ✅ เปลี่ยนเป็น pointer แสดงว่าเป็น tooltip
              iconContainer.style.zIndex = "10"; // ✅ ให้ไอคอนอยู่ด้านหน้า
              iconContainer.title = statusDescription[status] || "สถานะไม่ระบุ"; // ✅ Tooltip

              // 🔹 เรนเดอร์ไอคอนใน FullCalendar
              ReactDOM.createRoot(iconContainer).render(
                <FontAwesomeIcon
                  icon={icon}
                  style={{
                    fontSize: isSmallScreen ? "8px" : "12px", // ✅ ปรับขนาด icon ตามหน้าจอ
                    color: textColor, // ✅ ไอคอนใช้สีเดียวกับตัวหนังสือ
                  }}
                />
              );

              // 🔹 เพิ่มไอคอนไปที่ event container
              info.el.appendChild(iconContainer);
            }
          }}
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
