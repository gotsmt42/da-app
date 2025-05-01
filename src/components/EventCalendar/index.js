import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom/client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid"; // for dayClick
import momentTimezonePlugin from "@fullcalendar/moment-timezone";

import interactionPlugin, { Draggable } from "@fullcalendar/interaction"; // ✅ เพิ่ม Draggable

import listPlugin from "@fullcalendar/list";

import { saveAs } from "file-saver";

import * as XLSX from "xlsx";

import Swal from "sweetalert2";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"; // Import FontAwesomeIcon component

import {
  faBell,
  faClockFour,
  faClockRotateLeft,
  faFileExcel,
  faFilePdf,
  faPlus,
} from "@fortawesome/free-solid-svg-icons"; // Import ไอคอนต่างๆ

import CustomerService from "../../services/CustomerService";
import EventService from "../../services/EventService";
import EventReceiveService from "../../services/EventReceiveService";
import fetchHolidayService from "../../services/fetchHolidayService";
import moment from "moment";

import { ThreeDots } from "react-loader-spinner";

import generatePDF, { Resolution, Margin } from "react-to-pdf";

import { Col, Row } from "reactstrap";

import { CSVLink } from "react-csv";

import "./index.css";

import API from "../../API/axiosInstance";

import { toast } from "react-toastify"; // หากใช้ react-toastify

import { faTimes } from "@fortawesome/free-solid-svg-icons";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import thLocale from "@fullcalendar/core/locales/th"; // นำเข้า locale ภาษาไทย

import { useAuth } from "../../auth/AuthContext"; // ✅ ดึงข้อมูล Auth

import {
  faHourglassHalf,
  faCheckCircle,
  faCheck,
  faClock,
  faSpinner,
  faCheckDouble,
} from "@fortawesome/free-solid-svg-icons";

import { jsPDF } from "jspdf";

import thSarabunFont from "../../Fonts/THSarabunNew_base64"; // นำเข้า base64 font

import TomSelect from "tom-select";
import "tom-select/dist/css/tom-select.css";

import Hammer from "hammerjs";

function EventCalendar() {
  const { userData } = useAuth(); // ✅ เปลี่ยนจาก user → userData
  const isAdmin = userData?.role?.toLowerCase() === "admin"; // ✅ รองรับ case-insensitive

  const [events, setEvents] = useState([]);
  const [newEventTitle, setNewEventTitle] = useState(""); // State สำหรับ input

  const [eventReceive, setEventReceive] = useState([]);
  const [defaultAllDay, setdefaultAllDay] = useState(true); // สีข้อความเริ่มต้น
  const [defaultTextColor, setDefaultTextColor] = useState("#FFFFFF"); // สีข้อความเริ่มต้น
  const [defaultBackgroundColor, setDefaultBackgroundColor] =
    useState("#FF5733"); // สีพื้นหลังเริ่มต้น

  const [defaultFontSize, setDefaultFontSize] = useState(8); //

  const [loading, setLoading] = useState(false); // เพิ่มสถานะการโหลด

  const [searchTerm, setSearchTerm] = useState(""); // 🔍 State สำหรับค้นหา

  const [currentMonth, setCurrentMonth] = useState(moment().format("YYYY-MM"));

  let isProcessing = false; // ตัวแปรกันซ้ำ

  useEffect(() => {
    fetchEventsFromDB();
    fetchEventReceiveFromDB();
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
      "แจ้งแผนงานการเข้าดำเนินการซ่อมหรือปรับปรุงระบบสัญญาณแจ้งเหตุเพลิงไหม้",
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
      `เรียน  ผู้จัดการโครงการ`,
      "",
      `        ตามที่บริษัท ดู ออล อาคิเทค แอนด์ เอ็นจิเนียริ่ง จำกัด ได้รับความไว้วางใจจาก บริษัท ${event.extendedProps.company} `,
      `ให้เข้าดำเนินการ ${event.title} ระบบ ${event.extendedProps.system} ครั้งที่ ${event.extendedProps.time} ณ โครงการ ${event.extendedProps.site}`,
      "",

      `        บริษัท ดู ออล อาคิเทค แอนด์ เอ็นจิเนียริ่ง จำกัด ขอแจ้งให้ท่านทราบถึงกำหนดการเข้า ${event.title} ระบบ ${event.extendedProps.system}`,
      `ครั้งที่ ${event.extendedProps.time} ซึ่งทางบริษัทฯ มีกำหนดการเข้าดำเนินการในช่วงเวลาดังนี้`,

      "",

      `        Description`,

      "",

      "        ดังนั้น บริษัท ฯ ใคร่ขอความร่วมมือ แจ้งผู้เกี่ยวข้องทุกท่านเพื่อทราบกำหนดการดังกล่าว ทั้งนี้บริษัทจะเข้าดำเนินการโดยไม่ส่งผลกระทบ",
      "ต่อผู้ใช้งานพื้นที่พร้อมมีมาตรการความปลอดภัยตามมาตรฐาน หากท่านไม่สะดวกในการดำเนินการตามวันเวลาดังกล่าวกรุณาแจ้งกลับที่",
      "บริษัท ดู ออล อาคิเทค แอนด์ เอ็นจิเนียริ่ง จำกัด โทรศัพท์ 082-069-0919 ด้วย จักขอบพระคุณยิ่ง ",
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

    doc.text("ขอแสดงความนับถือ", 140, y + 35);
    doc.text("วิศวกรควบคุมระบบ", 140, y + 45);
    doc.text("064-111-0988", 140, y + 52);

    // 👉 บันทึก PDF
    doc.save(`WorkPermit_${event.title}.pdf`);
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

  const fetchEventReceiveFromDB = async () => {
    setLoading(true);
    try {
      const res = await EventReceiveService.getEvents();
      const eventsWithId = res.userEvents.map((eventReceive) => ({
        ...eventReceive,
        id: eventReceive._id || eventReceive.id,
        extendedProps: { _id: eventReceive._id || eventReceive.id }, // ✅ เพิ่ม _id ใน extendedProps
      }));

      setEventReceive(eventsWithId);
    } catch (error) {
      console.error("❌ Error fetching events:", error);
      toast.error("Failed to load events. Please try again later."); // แจ้งเตือน error
    } finally {
      setLoading(false);
    }
  };
  const saveEventReceiveToDB = async (newEvent) => {
    try {
      // console.log("🔍 Sending data to API:", JSON.stringify(newEvent, null, 2));

      const response = await EventReceiveService.AddEvent(newEvent);

      return response.data;
    } catch (error) {
      console.error(
        "❌ Error saving event to DB:",
        error.response?.data || error.message
      );
      throw error;
    }
  };
  const deleteEventFromDB = async (eventId) => {
    try {
      if (!eventId) {
        console.warn("⚠ Event ID is missing, skipping deletion.");
        return;
      }

      console.log(`🔍 ตรวจสอบ Event ID: ${eventId} ก่อนลบ`);

      // ✅ ตรวจสอบว่า Event มีอยู่ใน eventReceive หรือไม่
      const eventExists = eventReceive.some((e) => e._id === eventId);
      if (!eventExists) {
        console.warn(`⚠ Event ID ${eventId} ไม่พบใน eventReceive, ข้ามการลบ.`);
        return;
      }

      console.log(`🗑 ลบ Event ID: ${eventId}`);
      const response = await API.delete(`/eventReceive/${eventId}`);

      if (response.status === 200) {
        console.log(`✅ Event ${eventId} ลบสำเร็จ`);
      } else {
        console.warn(
          `⚠ Event ${eventId} ลบไม่สำเร็จ, status: ${response.status}`
        );
      }
    } catch (error) {
      console.error(
        `❌ Error deleting event ${eventId}:`,
        error.response?.data || error
      );
    }
  };

  const handleAddEventReceive = async (event) => {
    event.preventDefault(); // ป้องกันการ reload หน้า

    if (!newEventTitle.trim()) return; // ถ้า input ว่าง ไม่ต้องทำอะไร

    const newEvent = { title: newEventTitle };

    try {
      // ✅ เพิ่ม event ใหม่เข้า UI
      setEventReceive((prevEvents) => [...prevEvents, newEvent]);

      // ✅ บันทึกอีเวนต์ลงฐานข้อมูล
      const savedEvent = await saveEventReceiveToDB(newEvent);

      // ตรวจสอบว่าได้รับข้อมูลจาก API หรือไม่
      // if (!savedEvent) {
      //   console.warn("⚠️ API ไม่ส่งข้อมูลกลับมา แต่อาจบันทึกสำเร็จ");
      // }

      // ✅ ตรวจสอบว่ามี _id หรือไม่ ถ้าไม่มีต้องเติม _id ชั่วคราว
      if (savedEvent && !savedEvent._id) {
        savedEvent._id = generateTemporaryId(); // คุณสามารถสร้าง ID ชั่วคราวเพื่อให้ได้ ID
      }

      // ✅ โหลดข้อมูลอีเวนต์ใหม่จาก DB
      await fetchEventReceiveFromDB();
      await fetchEventsFromDB();

      // ✅ เคลียร์ input หลังจากเพิ่มอีเวนต์
      setNewEventTitle("");
    } catch (error) {
      console.error("❌ Error handling event addition:", error);
    }
  };
  const handleEventReceive = async (info) => {
    if (isProcessing) {
      console.warn("⚠ Function is already running, skipping duplicate call.");
      return;
    }

    isProcessing = true;

    try {
      const droppedEvent = info.event;
      const draggedEl = info.draggedEl;

      if (!droppedEvent.start) {
        console.error("❌ Dropped event has no start date.");
        return;
      }

      let eventIdToDelete = droppedEvent.extendedProps?._id || droppedEvent.id;
      if (!eventIdToDelete) {
        eventIdToDelete =
          draggedEl?.dataset?.eventId ||
          draggedEl?.getAttribute("data-event-id");
      }

      if (!eventIdToDelete) {
        console.error("⚠ Event ID is missing. Skipping deletion.");
        return;
      }

      // ✅ ตรวจสอบว่า Event ซ้ำหรือไม่
      const isDuplicate = events.some((e) => e._id === eventIdToDelete);
      if (isDuplicate) {
        console.warn(
          `⚠ Event ID ${eventIdToDelete} is already in FullCalendar.`
        );
        return;
      }

      // ✅ ตรวจสอบว่า Event มีอยู่ใน `eventReceive` หรือไม่
      const eventExistsInReceive = eventReceive.some(
        (e) => e._id === eventIdToDelete
      );
      if (eventExistsInReceive) {
        console.log(
          `✅ Event ID ${eventIdToDelete} found in eventReceive, proceeding with deletion.`
        );

        // ✅ ลบออกจาก state โดยใช้ `setEventReceive` เพียงครั้งเดียว
        setEventReceive((prevEvents) =>
          prevEvents.filter((event) => event._id !== eventIdToDelete)
        );

        // ✅ ลบออกจากฐานข้อมูล
        await deleteEventFromDB(eventIdToDelete);
      } else {
        console.warn(
          `⚠ Event ID ${eventIdToDelete} not found in eventReceive, skipping deletion.`
        );
      }

      // ✅ ตั้งค่า start, end และ date
      const startDate = moment(droppedEvent.start).format("YYYY-MM-DD");
      const endDate = droppedEvent.end
        ? moment(droppedEvent.end).format("YYYY-MM-DD")
        : moment(startDate).add(1, "days").format("YYYY-MM-DD");

      const newEvent = {
        title: droppedEvent.title || "Untitled Event",
        backgroundColor: droppedEvent.backgroundColor || "#FF5733",
        textColor: droppedEvent.textColor || "#ffffff",
        fontSize: droppedEvent.extendedProps?.fontSize
          ? droppedEvent.extendedProps.fontSize.toString()
          : "8",
        start: startDate,
        end: endDate,
        date: startDate,
        allDay: droppedEvent.allDay ?? true,
      };

      // ✅ บันทึกอีเวนต์ใหม่ลงฐานข้อมูล
      const response = await saveEventToDB(newEvent);

      if (response && response._id) {
        newEvent._id = response._id;
        newEvent.extendedProps = { _id: response._id };
      }

      // ✅ อัปเดต events ใน FullCalendar
      setEvents((prevEvents) => [...prevEvents, newEvent]);

      // ✅ รีโหลดปฏิทินและ eventReceive เพื่อป้องกันข้อมูลซ้ำ
      await fetchEventsFromDB();
    } catch (error) {
      console.error("❌ Error in handleEventReceive:", error);
    } finally {
      isProcessing = false;
    }
  };

  const handleAddEventToCalendar = async (eventData) => {
    Swal.fire({
      title: `${eventData.title || "แผนงานไม่มีชื่อ"} `, // ✅ แสดงชื่อแผนงานที่ถูกคลิก
      customClass: "swal-wide",
      html: `
            <label for="startDate">วันที่เริ่มต้น:</label>
            <input id="startDate" type="date" class="swal2-input" style="margin-bottom: 1rem; width: 250px"><br>
        
            <label for="endDate">วันที่สิ้นสุด:</label>
            <input id="endDate" type="date" class="swal2-input" style="margin-bottom: 1rem; width: 250px">
          `,
      showCancelButton: true,
      confirmButtonText: "เพิ่มลงในตาราง",
      cancelButtonText: "ยกเลิก",
      preConfirm: () => {
        const startDate = document.getElementById("startDate").value;
        const endDate = document.getElementById("endDate").value;

        if (!startDate || !endDate) {
          Swal.showValidationMessage("กรุณาระบุวันที่เริ่มต้นและวันที่สิ้นสุด");
          return false;
        }

        if (moment(endDate).isBefore(moment(startDate))) {
          Swal.showValidationMessage(
            "วันที่สิ้นสุดต้องมากกว่าหรือเท่ากับวันที่เริ่มต้น"
          );
          return false;
        }

        return { startDate, endDate };
      },
    }).then(async (result) => {
      if (result.isConfirmed) {
        const { startDate, endDate } = result.value;

        if (!startDate || !endDate) {
          Swal.fire(
            "เกิดข้อผิดพลาด",
            "กรุณาระบุวันที่เริ่มต้นและวันที่สิ้นสุด!",
            "error"
          );
          return;
        }

        const start = moment(startDate).format("YYYY-MM-DD");
        const end = moment(endDate).add(1, "days").format("YYYY-MM-DD");

        // ✅ เพิ่มแผนงานลงใน FullCalendar
        const newEvent = {
          title: eventData.title,
          start: start,
          end: end,
          date: start,
          backgroundColor: eventData.backgroundColor || "#0c49ac",
          textColor: eventData.textColor || "#ffffff",
          fontSize: eventData.fontSize || "12",
          allDay: true,
        };

        try {
          // ✅ อัปเดต state ของ FullCalendar
          setEvents((prevEvents) => [...prevEvents, newEvent]);

          // ✅ บันทึกลงฐานข้อมูล
          await saveEventToDB(newEvent);

          // ✅ ลบแผนงานออกจาก "รายการรอจัดลงตาราง"
          setEventReceive((prevEvents) =>
            prevEvents.filter((event) => event._id !== eventData._id)
          );

          // ✅ ลบออกจากฐานข้อมูลของ "รายการรอจัดลงตาราง"
          await deleteEventFromDB(eventData._id);

          Swal.fire({
            title: "เพิ่มแผนงานสำเร็จ!",
            text: "แผนงานถูกเพิ่มลงในตารางเรียบร้อยแล้ว",
            icon: "success",
            timer: 1500,
            showConfirmButton: false,
          });

          // ✅ โหลดข้อมูลใหม่จากฐานข้อมูล
          await fetchEventsFromDB();
        } catch (error) {
          console.error("❌ เกิดข้อผิดพลาดขณะเพิ่มแผนงาน:", error);
          Swal.fire(
            "เกิดข้อผิดพลาด",
            "ไม่สามารถเพิ่มแผนงานได้ กรุณาลองใหม่อีกครั้ง",
            "error"
          );
        }
      }
    });
  };

  const handleDeleteEventReceive = async (eventId) => {
    try {
      Swal.fire({
        title: "คุณแน่ใจหรือไม่?",
        text: "การกระทำนี้ไม่สามารถย้อนกลับได้!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "ใช่, ลบออก!",
        cancelButtonText: "ยกเลิก",
      }).then(async (result) => {
        if (result.isConfirmed) {
          // ✅ ลบข้อมูลออกจากฐานข้อมูล
          await deleteEventFromDB(eventId);

          // ✅ อัปเดต state eventReceive (ลบอีเวนต์ที่ถูกลบออก)
          setEventReceive((prevEvents) => {
            const updatedEvents = prevEvents.filter(
              (event) => event._id !== eventId
            );

            // ✅ ตรวจสอบว่าเหลือข้อมูลในหน้าปัจจุบันหรือไม่
            const totalItemsLeft = updatedEvents.length;
            const maxPages = Math.ceil(totalItemsLeft / eventsPerPage);

            if (totalItemsLeft <= startIndex && currentPage > 1) {
              setCurrentPage(Math.max(1, currentPage - 1)); // ✅ กลับไปหน้าก่อนหน้า
            }

            return updatedEvents;
          });

          // Swal.fire({
          //   title: "ลบสำเร็จ!",
          //   text: "กิจกรรมถูกลบออกเรียบร้อยแล้ว",
          //   icon: "success",
          //   timer: 1500,
          //   showConfirmButton: false,
          // });
        }
      });
    } catch (error) {
      console.error("❌ เกิดข้อผิดพลาดขณะลบกิจกรรม:", error);
      Swal.fire({
        title: "เกิดข้อผิดพลาด!",
        text: "ไม่สามารถลบกิจกรรมได้ กรุณาลองใหม่อีกครั้ง",
        icon: "error",
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
    setLoading(true);
    try {
      // ดึงข้อมูล events จากฐานข้อมูล
      const res = await EventService.getEvents();
      const eventsWithId = res.userEvents.map((event) => ({
        ...event,
        id: event._id,
        extendedProps: {
          ...event.extendedProps,
          company: event.company,
          site: event.site,
          system: event.system,
          time: event.time,
          manualStatus: event.manualStatus,
          status: event.status,
          fontSize: event.fontSize,
        },
      }));

      // ดึงข้อมูลวันหยุดจาก API
      const thaiHolidays = await fetchThaiHolidaysFromAPI();
      // console.log("Fetched holidays:", thaiHolidays);

      // ตรวจสอบว่าได้ข้อมูลวันหยุดแล้วหรือไม่
      if (thaiHolidays.length > 0) {
        const combinedEvents = [
          ...eventsWithId,
          ...thaiHolidays.map((holiday) => ({
            ...holiday,
            fontSize: defaultFontSize.extendedProps, // Apply default font size
          })),
        ]; // console.log("Combined events:", combinedEvents); // ตรวจสอบข้อมูลที่รวมกันแล้ว

        // อัปเดตข้อมูลใน state
        setEvents(combinedEvents);
      } else {
        console.log("No holidays found, only user events will be displayed.");
        setEvents(eventsWithId);
      }
    } catch (error) {
      console.error("Error fetching events or holidays:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveEventToDB = async (newEvent) => {
    try {
      // ✅ ตรวจสอบว่ามี start, end, และ date ครบถ้วน
      if (!newEvent.start || !newEvent.end || !newEvent.date) {
        console.error("❌ Missing required fields:", newEvent);
        throw new Error("Missing required fields: start, end, or date");
      }

      // console.log("🔍 Sending data to API:", JSON.stringify(newEvent, null, 2));

      const response = await EventService.AddEvent(newEvent);

      return response;
    } catch (error) {
      console.error("❌ Error saving event to DB:", error.message);
      throw error;
    }
  };

  // สร้าง ID ชั่วคราว (ถ้าต้องการ)
  const generateTemporaryId = () => {
    return "_" + Math.random().toString(36).substr(2, 9); // สร้าง id แบบสุ่ม
  };

  const handleAddEvent = async (arg) => {
    const res = await CustomerService.getUserCustomers();

    Swal.fire({
      title: "เพิ่มแผนงานใหม่",
      customClass: "swal-wide",
      // ✅ ฟอร์มเพิ่มแผนงานแบบ 2 คอลัมน์ Responsive
      html: `
      <div class="swal-form-grid">
        <!-- กลุ่มซ้าย-ขวาแบบ 2 คอลัมน์ -->
        <div>
          <label for="eventCompany">ชื่อบริษัท : </label>
          <select id="eventCompany" class="swal2-select">
            <option selected disabled></option>
            ${res.userCustomers
              .map(
                (customer) =>
                  `<option value="${customer.cCompany}">${customer.cCompany}</option>`
              )
              .join("")}
          </select>
        </div>
    
        <div>
          <label for="eventSite">ชื่อโครงการ : </label>
          <select id="eventSite" class="swal2-select">
            <option selected disabled></option>
            ${res.userCustomers
              .map(
                (customer) =>
                  `<option value="${customer.cSite}">${customer.cSite}</option>`
              )
              .join("")}
          </select>
        </div>
    
        <div>
          <label for="eventTitle">ประเภทงาน:</label>
          <select id="eventTitle" class="swal2-select">
            <option selected disabled></option>
            <option value="Preventive Maintenance (PM)">Preventive Maintenance (PM)</option>
            <option value="Service">Service</option>
            <option value="Inspection">Inspection</option>
            <option value="Test & Commissioning">Test & Commissioning</option>
          </select>
        </div>
    
        <div>
          <label for="eventSystem">ระบบงาน:</label>
          <select id="eventSystem" class="swal2-select">
            <option selected disabled></option>
            <option value="Fire Alarm">Fire Alarm</option>
            <option value="CCTV">CCTV</option>
            <option value="Access Control">Access Control</option>
          </select>
        </div>
    
        <div>
          <label for="eventTime">ครั้งที่:</label>
          <select id="eventTime" class="swal2-select">
            <option selected disabled></option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
          </select>
        </div>
    
        <div style="display: none;">
          <label for="fontSize">ขนาดตัวอักษร:</label>
          <select id="fontSize" class="swal2-input">
            ${[8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72]
              .map((size) => `<option value="${size}">${size}</option>`)
              .join("")}
          </select>
        </div>
      </div>
    
      <!-- ส่วนล่างแนวตั้ง -->
      <div class="swal-form-bottom">
     
    
        <div>
          <label for="backgroundColorPicker">สีพื้นหลัง:</label>
          <input id="backgroundColorPicker" style="width: 150px; height: 35px" type="color" value="${defaultBackgroundColor}" />
        </div><br>
       <div>
          <label for="textColorPicker">สีข้อความ:</label>
          <input id="textColorPicker" style="width: 150; height: 35px" type="color" value="${defaultTextColor}" />
        </div><br>
        
      </div>
      <div>
          <label for="start">เริ่มต้น:</label>
          <input id="start" type="date" style="width: 80%; height: 35px" class="swal2-input" value="${
            arg.dateStr
          }" />
        </div>
    
        <div>
          <label for="end">สิ้นสุด:</label>
          <input id="end" type="date" style="width: 80%; height: 35px" class="swal2-input" value="${
            arg.dateStr
          }" />
        </div>
    `,

      showCancelButton: true,
      confirmButtonText: "บันทึกแผนงาน",
      cancelButtonText: "ยกเลิก",
      didOpen: () => {
        new TomSelect("#eventCompany", {
          create: true, // ✅ อนุญาตให้ผู้ใช้พิมพ์ชื่อใหม่ได้
          placeholder: "เลือกหรือพิมพ์ชื่อบริษัท",
          sortField: {
            field: "text",
            direction: "asc",
          },
        });

        new TomSelect("#eventSite", {
          create: true,
          placeholder: "เลือกหรือพิมพ์ชื่อโครงการ",
          sortField: {
            field: "text",
            direction: "asc",
          },
        });

        new TomSelect("#eventTitle", {
          create: true,
          placeholder: "เลือกหรือพิมพ์ชื่อหัวข้อ",
          sortField: {
            field: "text",
            direction: "asc",
          },
        });

        new TomSelect("#eventSystem", {
          create: true,
          placeholder: "เลือกหรือพิมพ์ชื่อระบบ",
          sortField: {
            field: "text",
            direction: "asc",
          },
        });
        new TomSelect("#eventTime", {
          create: false,
          sortField: {
            field: "text",
            direction: "asc",
          },
        });

        const textColorPicker =
          Swal.getPopup().querySelector("#textColorPicker");
        textColorPicker.setAttribute("value", defaultTextColor);

        const backgroundColorPicker = Swal.getPopup().querySelector(
          "#backgroundColorPicker"
        );
        backgroundColorPicker.setAttribute("value", defaultBackgroundColor);
      },
      preConfirm: () => {
        const start = document.getElementById("start").value;
        const end = document.getElementById("end").value;
        const company = document.getElementById("eventCompany").value;
        const site = document.getElementById("eventSite").value;
        const title = document.getElementById("eventTitle").value;
        const system = document.getElementById("eventSystem").value;
        const time = document.getElementById("eventTime").value;
        const backgroundColor = document.getElementById(
          "backgroundColorPicker"
        ).value;
        const textColor = document.getElementById("textColorPicker").value;
        const fontSize = document.getElementById("fontSize").value;
        if (!site) {
          Swal.showValidationMessage("กรุณาระบุโครงการ");
        }
        if (!title) {
          Swal.showValidationMessage("กรุณาระบุหัวข้อ");
        }

        return {
          company,
          site,
          title,
          system,
          time,
          backgroundColor,
          textColor,
          fontSize,
          start,
          end,
        };
      },
    }).then(async (result) => {
      if (result.isConfirmed) {
        const {
          company,
          site,
          title,
          system,
          time,
          backgroundColor,
          textColor,
          fontSize,
          start,
          end,
        } = result.value;

        const newEnd = moment(end).add(1, "days");
        const newEvent = {
          company,
          site,
          title,
          system,
          time,
          date: arg.dateStr,
          backgroundColor,
          textColor,
          fontSize,
          start,
          end: newEnd.format("YYYY-MM-DD"),
        };

        setEvents([...events, newEvent]); // อัปเดต state ของ FullCalendar
        await saveEventToDB(newEvent); // บันทึกแผนงานลงฐานข้อมูล
        setDefaultTextColor(textColor);
        setDefaultBackgroundColor(backgroundColor);
        setDefaultFontSize(fontSize);
        await fetchEventsFromDB(); // โหลดข้อมูลแผนงานใหม่จากฐานข้อมูล
      }
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "กำลังรอยืนยัน":
        return faHourglassHalf; // ⏳ รอยืนยัน
      case "ยืนยันแล้ว":
        return faCheck; // ✅ ยืนยันแล้ว
      case "กำลังดำเนินการ":
        return faClockRotateLeft; // 🔄 กำลังดำเนินการ
      case "ดำเนินการเสร็จสิ้น":
        return faCheckDouble; // ✔✔ เสร็จสิ้น
      default:
        return null;
    }
  };

  const handleEditEvent = async (eventInfo) => {
    const inputBackgroundColor = document.createElement("input");
    inputBackgroundColor.type = "color";
    inputBackgroundColor.value = eventInfo.event.backgroundColor;

    const inputTextColor = document.createElement("input");
    inputTextColor.type = "color";
    inputTextColor.value = eventInfo.event.textColor;

    const eventId = eventInfo.event.id;
    const eventCompany = eventInfo.event.extendedProps?.company || "";
    const eventSite = eventInfo.event.extendedProps?.site || "";

    const eventTitle = eventInfo.event.title;
    const eventSystem = eventInfo.event.extendedProps?.system || "";
    const eventTime = eventInfo.event.extendedProps?.time || "";

    const eventFontSize = eventInfo.event.extendedProps.fontSize;

    const eventStart = moment(eventInfo.event.start);
    const eventEnd = moment(eventInfo.event.end);
    const eventAllDay = eventInfo.event.allDay;

    let eventStatus = eventInfo.event.extendedProps?.status || "กำลังรอยืนยัน"; // ค่าเริ่มต้น
    let isAutoUpdated = eventInfo.event.extendedProps?.isAutoUpdated || false;

    const formattedEnd = eventAllDay
      ? moment(eventEnd).subtract(1, "days").format("YYYY-MM-DDTHH:mm")
      : moment(eventEnd).format("YYYY-MM-DDTHH:mm");

    const getBackgroundColorByStatus = (status) => {
      switch (status) {
        case "กำลังรอยืนยัน":
          return "#FF5733"; // สีส้ม
        case "ยืนยันแล้ว":
          return "#0c49ac"; // สีน้ำเงิน
        case "กำลังดำเนินการ":
          return "#d1c000"; // สีเหลือง
        case "ดำเนินการเสร็จสิ้น":
          return "#7bff00"; // สีเขียว (เอา # ตัวที่สองออก)
        default:
          return "#ffffff"; // สีขาว
      }
    };

    const getTextColorByStatus = (status) => {
      switch (status) {
        case "กำลังรอยืนยัน":
          return "#ffffff"; // ดำ
        case "ยืนยันแล้ว":
          return "#ffffff"; // ขาว
        case "กำลังดำเนินการ":
          return "#000000"; // ขาว
        case "ดำเนินการเสร็จสิ้น":
          return "#000000"; // ดำ (แก้จาก ##fff เป็น #000)
        default:
          return "#ffffff"; // ขาว
      }
    };

    let currentTextColor = getTextColorByStatus(eventStatus);
    let currentBackgroundColor = getBackgroundColorByStatus(eventStatus);

    const res = await CustomerService.getUserCustomers();

    // 🔧 โค้ด htmlEdit พร้อม label ทุกหัวข้อเพื่อความชัดเจน
    const htmlEdit = `
      <div class="swal-form-grid">
  
      <!-- สถานะงาน -->
      <div>
        <label for="editStatus">สถานะงาน : </label>
        <select id="editStatus" class="swal2-select">
          <option disabled selected>${eventStatus}</option>
          <option value="กำลังรอยืนยัน" ${
            eventStatus === "กำลังรอยืนยัน" ? "selected" : ""
          }>กำลังรอยืนยัน</option>
          <option value="ยืนยันแล้ว" ${
            eventStatus === "ยืนยันแล้ว" ? "selected" : ""
          }>ยืนยันแล้ว</option>
          <option value="กำลังดำเนินการ" ${
            eventStatus === "กำลังดำเนินการ" ? "selected" : ""
          }>กำลังดำเนินการ</option>
          <option value="ดำเนินการเสร็จสิ้น" ${
            eventStatus === "ดำเนินการเสร็จสิ้น" ? "selected" : ""
          }>ดำเนินการเสร็จสิ้น</option>
        </select>
      </div>
  
      <!-- ชื่อบริษัท -->
      <div>
        <label for="editCompany">ชื่อบริษัท : </label>
        <select id="editCompany" class="swal2-select">
          <option disabled selected>${eventCompany || "เลือกบริษัท"}</option>
          ${res.userCustomers
            .map(
              (c) =>
                `<option value="${c.cCompany}" ${
                  eventCompany === c.cCompany ? "selected" : ""
                }>${c.cCompany}</option>`
            )
            .join("")}
        </select>
      </div>
  
      <!-- สถานที่ -->
      <div>
        <label for="editSite">ชื่อโครงการ : </label>
        <select id="editSite" class="swal2-select">
          <option disabled selected>${eventSite || "เลือกสถานที่"}</option>
          ${res.userCustomers
            .map(
              (c) =>
                `<option value="${c.cSite}" ${
                  eventSite === c.cSite ? "selected" : ""
                }>${c.cSite}</option>`
            )
            .join("")}
        </select>
      </div>
  
      <!-- ประเภทแผนงาน -->
      <div>
        <label for="editTitle">ประเภทงาน : </label>
        <select id="editTitle" class="swal2-select">
          <option disabled selected>${
            eventTitle || "เลือกประเภทแผนงาน"
          }</option>
          ${[
            "Preventive Maintenance (PM)",
            "Service",
            "Inspection",
            "Test & Commissioning",
          ]
            .map(
              (title) =>
                `<option value="${title}" ${
                  eventTitle === title ? "selected" : ""
                }>${title}</option>`
            )
            .join("")}
        </select>
      </div>
  
      <!-- ระบบงาน -->
      <div>
        <label for="editSystem">ระบบงาน : </label>
        <select id="editSystem" class="swal2-select">
          <option disabled selected>${eventSystem || "เลือกระบบงาน"}</option>
          ${["Fire Alarm", "CCTV", "Access Control"]
            .map(
              (sys) =>
                `<option value="${sys}" ${
                  eventSystem === sys ? "selected" : ""
                }>${sys}</option>`
            )
            .join("")}
        </select>
      </div>
  
      <!-- ครั้งที่ -->
      <div>
        <label for="editTime">ครั้งที่ : </label>
        <select id="editTime" class="swal2-select">
          <option disabled selected>${eventTime}</option>
          ${["1", "2", "3", "4"]
            .map(
              (t) =>
                `<option value="${t}" ${
                  eventTime === t ? "selected" : ""
                }>${t}</option>`
            )
            .join("")}
        </select>
      </div>
  
      
  
    </div>
    <!-- สีพื้นหลัง -->
      <div>
        <label>สีพื้นหลัง : </label><br>
        <div id="backgroundColorPickerContainer"></div>
      </div><br>
  
      <!-- สีข้อความ -->
      <div>
        <label>สีข้อความ : </label><br>
        <div id="textColorPickerContainer" ></div>
      </div><br>
  
      <!-- วันที่เริ่ม -->
      <div >
        <label for="editStart">เริ่มต้น : </label>
        <input id="editStart" type="datetime-local" style="width: 80%; height: 35px" class="swal2-input" value="${eventStart.format(
          "YYYY-MM-DDTHH:mm"
        )}" />
      </div><br>
  
      <!-- วันที่สิ้นสุด -->
      <div>
        <label for="editEnd">สิ้นสุด : </label>
        <input id="editEnd" type="datetime-local" style="width: 80%; height: 35px" class="swal2-input" value="${formattedEnd}" />
      </div><br>
  `;

    Swal.fire({
      title: `แก้ไขแผนงาน: ${eventSite}`,
      html: htmlEdit,
      customClass: "swal-wide",
      showCloseButton: true,
      didOpen: () => {
        new TomSelect("#editStatus", {
          create: false, // ✅ อนุญาตให้ผู้ใช้พิมพ์ชื่อใหม่ได้
          placeholder: "เลือกหรือพิมพ์ชื่อบริษัท",
          sortField: {
            field: "text",
            direction: "asc",
          },
        });

        new TomSelect("#editCompany", {
          create: true, // ✅ อนุญาตให้ผู้ใช้พิมพ์ชื่อใหม่ได้
          placeholder: "เลือกหรือพิมพ์ชื่อบริษัท",
          sortField: {
            field: "text",
            direction: "asc",
          },
        });

        new TomSelect("#editSite", {
          create: true, // ✅ อนุญาตให้ผู้ใช้พิมพ์ชื่อใหม่ได้
          placeholder: "เลือกหรือพิมพ์ชื่อโครงการ",
          sortField: {
            field: "text",
            direction: "asc",
          },
        });

        new TomSelect("#editTitle", {
          create: true, // ✅ อนุญาตให้ผู้ใช้พิมพ์ชื่อใหม่ได้
          placeholder: "เลือกหรือพิมพ์ชื่อหัวข้อ",
          sortField: {
            field: "text",
            direction: "asc",
          },
        });

        new TomSelect("#editSystem", {
          create: true, // ✅ อนุญาตให้ผู้ใช้พิมพ์ชื่อใหม่ได้
          placeholder: "เลือกหรือพิมพ์ชื่อระบบ",
          sortField: {
            field: "text",
            direction: "asc",
          },
        });

        new TomSelect("#editTime", {
          create: false, // ✅ อนุญาตให้ผู้ใช้พิมพ์ชื่อใหม่ได้
          sortField: {
            field: "text",
            direction: "asc",
          },
        });

        document
          .getElementById("backgroundColorPickerContainer")
          .appendChild(inputBackgroundColor);
        document
          .getElementById("textColorPickerContainer")
          .appendChild(inputTextColor);
      },
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonColor: "#0ECC00",
      confirmButtonText: "บันทึกการเปลี่ยนแปลง",
      denyButtonText: "ลบแผนงาน",
      // cancelButtonText: "ยกเลิกแผนงาน",
      showExtraButton: true,
      didRender: () => {
        const pdfButton = document.createElement("button");
        pdfButton.innerText = "ออกใบแจ้งเข้างาน";
        pdfButton.className = "swal2-confirm swal2-styled";
        pdfButton.style.backgroundColor = "#6c757d"; // สีเทา
        pdfButton.style.marginLeft = "10px";
        pdfButton.onclick = () => generateWorkPermitPDF(eventInfo.event);
        Swal.getActions().appendChild(pdfButton);
      },
      preConfirm: () => {
        const company = document.getElementById("editCompany").value;
        const site = document.getElementById("editSite").value;
        const title = document.getElementById("editTitle").value;
        const system = document.getElementById("editSystem").value;
        const time = document.getElementById("editTime").value;
        const textColor = inputTextColor.value;
        const backgroundColor = inputBackgroundColor.value;
        const fontSize = eventFontSize;
        const status = document.getElementById("editStatus").value;
        const start = moment(
          document.getElementById("editStart").value
        ).toISOString();
        let end = document.getElementById("editEnd").value;
        if (!end) {
          end = eventEnd.toISOString();
        } else {
          end = eventAllDay
            ? moment(end).add(1, "days").toISOString()
            : moment(end).toISOString();
        }
        if (!title) {
          Swal.showValidationMessage("กรุณากรอกชื่อแผนงาน");
        }
        // ส่งกลับข้อมูลพร้อมกับ flag manualStatus: true
        return {
          id: eventId,
          company,
          site,
          title,
          system,
          time,
          textColor,
          backgroundColor,
          fontSize,
          status,
          start,
          end,
          manualStatus: true,
        };
      },
    }).then(async (result) => {
      if (result.isConfirmed) {
        setLoading(true);
        const {
          id,
          company,
          site,
          title,
          system,
          time,
          textColor,
          backgroundColor,
          fontSize,
          status,
          start,
          end,
          manualStatus,
        } = result.value;

        const updatedEvent = {
          company,
          site,
          title,
          system,
          time,
          textColor,
          backgroundColor,
          fontSize,
          status,
          start,
          end,
          manualStatus, // เพิ่ม field นี้ในรูปแบบ level บนสุด
          extendedProps: { manualStatus },
        };

        // อัปเดต event ใน FullCalendar
        eventInfo.event.setProp("textColor", textColor);
        eventInfo.event.setProp("backgroundColor", backgroundColor);
        eventInfo.event.setExtendedProp("status", status);
        eventInfo.event.setExtendedProp("manualStatus", manualStatus);

        setEvents((prevEvents) =>
          prevEvents.map((event) => (event.id === id ? updatedEvent : event))
        );

        // ส่งข้อมูลแก้ไขไปยัง API
        await EventService.UpdateEvent(id, updatedEvent);
        await fetchEventsFromDB();
        setLoading(false);

        Swal.fire({
          title: "บันทึกการเปลี่ยนแปลงสำเร็จ",
          icon: "success",
          showConfirmButton: false,
          timer: 1000,
        });
      } else if (result.isDenied) {
        handleDeleteEvent(eventId);
      }
      // else if (result.dismiss === Swal.DismissReason.cancel) {
      //   confirmCancelEvent(eventId);
      // }
    });
  };

  // const confirmCancelEvent = async (eventId) => {
  //   Swal.fire({
  //     title: "ยืนยันการยกเลิกแผนงาน?",
  //     text: "แผนงานนี้จะถูกนำออกจากปฏิทินและสามารถเพิ่มกลับมาได้ในภายหลัง",
  //     icon: "warning",
  //     showCancelButton: true,
  //     confirmButtonColor: "#d33",
  //     cancelButtonColor: "#3085d6",
  //     confirmButtonText: "ใช่, ยกเลิกแผนงาน",
  //     cancelButtonText: "ไม่, เก็บไว้",
  //   }).then(async (result) => {
  //     if (result.isConfirmed) {
  //       handleCancelEvent(eventId);
  //     }
  //   });
  // };

  // ฟังก์ชันยกเลิกแผนงานออกจาก FullCalendar และเก็บไว้ในรายการรอจัดลงตาราง
  const handleCancelEvent = async (eventId) => {
    setLoading(true);

    try {
      // ค้นหาอีเวนต์จาก events
      const eventToCancel = events.find((event) => event.id === eventId);
      if (!eventToCancel) {
        console.warn("⚠ Event not found for cancellation");
        return;
      }

      // ลบอีเวนต์ออกจากปฏิทิน
      setEvents((prevEvents) =>
        prevEvents.filter((event) => event.id !== eventId)
      );

      // เพิ่มอีเวนต์กลับไปที่แผนงานรอจัดลงตาราง
      setEventReceive((prevEvents) => [
        ...prevEvents,
        { ...eventToCancel, id: eventToCancel.id || generateTemporaryId() },
      ]);

      // อัปเดตฐานข้อมูล (ลบออกจากปฏิทินและเพิ่มกลับไปที่รายการรอจัดตาราง)
      await EventService.DeleteEvent(eventId);

      // Swal.fire({
      //   title: "Event Moved to Unscheduled",
      //   icon: "info",
      //   showConfirmButton: false,
      //   timer: 1000,
      // });
    } catch (error) {
      console.error("❌ Error in handleCancelEvent:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEventDrop = async (arg) => {
    const event = arg.event;

    const start = moment(event.startStr);
    const end = moment(event.endStr);

    let newEnd;

    if (start.isSame(end, "day")) {
      newEnd = end;
    } else {
      newEnd = end.subtract(1, "days");
    }

    const updatedEvent = {
      id: event.id,
      title: event.title,
      textColor: event.textColor,
      backgroundColor: event.backgroundColor,
      fontSize: event.extendedProps.fontSize.toString(),
      start: event.startStr,
      end: event.endStr, // ตรวจสอบ allDay ก่อนกำหนด end
      allDay: event.allDay,
    };

    try {
      // ✅ อัปเดตเหตุการณ์ในฐานข้อมูล
      await EventService.UpdateEvent(event.id, updatedEvent);

      // ✅ ตรวจสอบว่า events เป็น Array ก่อนใช้ map
      setEvents((prevEvents) =>
        Array.isArray(prevEvents)
          ? prevEvents.map((e) => (e.id === updatedEvent.id ? updatedEvent : e))
          : [updatedEvent]
      );

      // ดึงข้อมูลเหตุการณ์จากฐานข้อมูลอีกครั้งเพื่อให้มั่นใจว่าข้อมูลเป็นปัจจุบัน
      await fetchEventsFromDB();

      // แสดงข้อความแจ้งเตือนเมื่ออัปเดตเหตุการณ์สำเร็จ
      // Swal.fire("Event Updated", "", "success");
    } catch (error) {
      console.error("Error updating event:", error);
      // แสดงข้อความแจ้งเตือนเมื่อเกิดข้อผิดพลาดในการอัปเดตเหตุการณ์
      Swal.fire("Error", "Failed to update event", "error");
    }
  };

  const handleEventResize = async (arg) => {
    const event = arg.event;

    const start = moment(event.startStr);
    const end = moment(event.endStr);

    let newEnd;

    if (start.isSame(end, "day")) {
      newEnd = end; // ใช้ end ตรงๆ เมื่อเริ่มและสิ้นสุดในวันเดียวกัน
    } else {
      newEnd = end;
    }

    const updatedEvent = {
      id: event.id,
      title: event.title,
      textColor: event.textColor,
      backgroundColor: event.backgroundColor,
      fontSize: event.extendedProps.fontSize.toString(),
      start: event.startStr,
      end: event.allDay ? newEnd.format("YYYY-MM-DD: HH:mm") : newEnd.format(), // ตรวจสอบ allDay ก่อนกำหนด end
      allDay: event.allDay,
    };

    // ✅ อัปเดตเหตุการณ์ในฐานข้อมูล
    await EventService.UpdateEvent(event.id, updatedEvent);

    // ✅ ตรวจสอบว่า events เป็น Array ก่อนใช้ map
    setEvents((prevEvents) =>
      Array.isArray(prevEvents)
        ? prevEvents.map((e) => (e.id === updatedEvent.id ? updatedEvent : e))
        : [updatedEvent]
    );

    await fetchEventsFromDB();

    // Swal.fire("Event Updated", "", "success");
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

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const handleLineNotify = () => {
    const html = `
        <label for="description">เพิ่มคำอธิบายสำหรับการอัพเดตนี้ : </label> <br>
        <input id="description" class="swal2-input"  type="text"  placeholder="กรอกคำอธิบาย"
        style="margin-bottom: 2rem width: auto"> <br /> 
        
        
      
      `;
    try {
      Swal.fire({
        title: "ส่งแจ้งเตือนการอัพเดตตารางแผนงานไปที่ Line Notify",
        icon: "question",
        html: html,
        width: "475px",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Confirm",

        preConfirm: () => {
          const description = document.getElementById("description").value;

          return {
            description,
          };
        },
      }).then(async (result) => {
        if (result.isConfirmed) {
          const description = result.value;

          console.log(description);
          await EventService.LineNotify(description);

          Swal.fire({
            title: "ส่งแจ้งเตือน Line สำเร็จ!",
            icon: "success",
          });
        }
      });

      // .then(async (result) => {
      //   if (result.isConfirmed) {
      //     await EventService.LineNotify();
      //     Swal.fire({
      //       title: "ส่งแจ้งเตือน Line สำเร็จ!",
      //       icon: "success",
      //     });
      //   }
      // });
    } catch (error) {
      console.error("Error deleting event:", error);
    }
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

  const handleDatesSet = (info) => {
    const newMonth = moment(info.start).format("YYYY-MM");
    setCurrentMonth(newMonth);
  };

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
                    .sort((a, b) => new Date(a.start) - new Date(b.start)) // จัดเรียงตามวันและเวลา
                    .map((event) => ({
                      Date: moment(event.start).format("YYYY-MM-DD"), // วันที่
                      Title: event.title, // ชื่อเหตุการณ์

                      AllDay: event.allDay ? "Yes" : "No", // เหตุการณ์ทั้งวัน
                    }))
                : null
            }
            filename={"events.csv"}
          >
            <button className="btn btn-sm btn-success mx-1 m-2 ">
              <FontAwesomeIcon icon={faFileExcel} /> สร้าง Excel
            </button>
          </CSVLink>

          {/* <button
            className="btn btn-sm btn-secondary mx-1 "
            onClick={handleLineNotify}
          >
            <FontAwesomeIcon icon={faBell} /> LINE NOTIFY
          </button> */}
        </Col>
      </Row>
      {/* {isAdmin && (
        <div
          className="card p-2 mb-4 mt-4"
          style={{ background: "#f8f9fa", borderRadius: "8px", width: "100%" }}
        >
          <h5 className="mb-3">เพิ่มแผนงานใหม่</h5>
          <form onSubmit={handleAddEventReceive} className="d-flex gap-2 p-2">
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Enter event title"
              value={newEventTitle}
              onChange={(e) => setNewEventTitle(e.target.value)}
              style={{ width: "100%", fontSize: "14px", padding: "6px" }} // ✅ ขยาย input เต็มความกว้าง
            />
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              style={{
                fontSize: "14px",
                padding: "6px 12px",
                whiteSpace: "nowrap",
              }}
            >
              เพิ่มแผนงาน
            </button>
          </form>
        </div>
      )} */}
      {isAdmin && (
        <div
          id="external-events"
          style={{ padding: "8px", background: "#f8f9fa", width: "100%" }}
          className="mb-4"
        >
          {/* <h5 className="mb-2 p-2">แผนงานรอจัดลงตาราง</h5>

          <div className="input-group mb-2 p-2">
            <span className="input-group-text bg-white border border-secondary">
              <FontAwesomeIcon icon={faSearch} className="text-muted" />
            </span>
            <input
              type="search"
              className="form-control form-control-sm border border-secondary"
              placeholder="ค้นหาแผนงาน..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ fontSize: "14px", padding: "6px" }}
            />
          </div> */}
          <div className="row row-cols-1 row-cols-md-2 row-cols-lg-4 g-2 p-2">
            {paginatedEvents.map((event) => (
              <div
                key={event._id || event.id}
                className="col d-flex align-items-center gap-2 mb-2"
              >
                <div
                  className="fc-event flex-grow-1 text-white d-flex align-items-center justify-content-between px-3 py-2"
                  data-event-id={event._id || event.id}
                  onClick={() => handleAddEventToCalendar(event)}
                  style={{
                    background: event.backgroundColor || "#0c49ac",
                    borderRadius: "5px",
                    fontSize: "11px",
                    width: "100%",
                    overflow: "hidden",
                    textAlign: "center",
                    cursor: "pointer",
                  }}
                >
                  <span>{event.title}</span>
                </div>

                <button
                  className="btn btn-danger btn-sm d-flex align-items-center justify-content-center"
                  onClick={() =>
                    handleDeleteEventReceive(event._id || event.id)
                  }
                  style={{
                    width: "25px",
                    height: "25px",
                    borderRadius: "50%",
                  }}
                >
                  <FontAwesomeIcon icon={faTimes} className="text-white" />
                </button>
              </div>
            ))}
          </div>

          {/* {totalPages > 1 && (
            <div className="d-flex justify-content-center mt-2">
              <button
                className="btn btn-outline-primary btn-sm me-1"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                «
              </button>
              <span className="mx-1">
                {currentPage} / {totalPages}
              </span>
              <button
                className="btn btn-outline-primary btn-sm ms-1"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                »
              </button>
            </div>
          )} */}
        </div>
      )}
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
          eventReceive={handleEventReceive} // ✅ ต้องกำหนด eventReceive
          eventContent={(arg) => {
            const { title, extendedProps } = arg.event;
            const { system = "", time = "", site = "" } = extendedProps;

            const timeDisplay = time ? `ครั้งที่ ${time}` : "";
            return {
              html: `
              [ ${title} ]
              ${system} ${timeDisplay}
              ${site}
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
              กำลังรอยืนยัน: "กำลังรอยืนยัน",
              ยืนยันแล้ว: "ยืนยันแล้ว",
              กำลังดำเนินการ: "กำลังดำเนินการ",
              ดำเนินการเสร็จสิ้น: "ดำเนินการเสร็จสิ้น",
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
            alignItems: "left",
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
            <div
              className="legend-item"
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <FontAwesomeIcon
                icon={faHourglassHalf}
                style={{ color: "#FF5733" }}
              />
              <span>กำลังรอยืนยัน</span>
            </div>

            <div
              className="legend-item"
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <FontAwesomeIcon icon={faCheck} style={{ color: "#0c49ac" }} />
              <span>ยืนยันแล้ว</span>
            </div>

            <div
              className="legend-item"
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <FontAwesomeIcon
                icon={faClockRotateLeft}
                style={{ color: "#a1b50b" }}
              />
              <span>กำลังดำเนินการ</span>
            </div>

            <div
              className="legend-item"
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <FontAwesomeIcon
                icon={faCheckDouble}
                style={{ color: "#18b007" }}
              />
              <span>ดำเนินการเสร็จสิ้น</span>
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
