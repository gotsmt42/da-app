  import React, { useState, useEffect, useRef } from "react";
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
    faFileExcel,
    faFilePdf,
    faPlus,
  } from "@fortawesome/free-solid-svg-icons"; // Import ไอคอนต่างๆ

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

  function EventCalendar() {
    const { userData } = useAuth(); // ✅ เปลี่ยนจาก user → userData
    const isAdmin = userData?.role?.toLowerCase() === "admin"; // ✅ รองรับ case-insensitive

    const [events, setEvents] = useState([]);
    const [newEventTitle, setNewEventTitle] = useState(""); // State สำหรับ input

    const [eventReceive, setEventReceive] = useState([]);
    const [defaultAllDay, setdefaultAllDay] = useState(true); // สีข้อความเริ่มต้น
    const [defaultTextColor, setDefaultTextColor] = useState("#FFFFFF"); // สีข้อความเริ่มต้น
    const [defaultBackgroundColor, setDefaultBackgroundColor] =
      useState("#0c49ac"); // สีพื้นหลังเริ่มต้น

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
          backgroundColor: droppedEvent.backgroundColor || "#0c49ac",
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

    const handleAddEvent = (arg) => {
      Swal.fire({
        title: "เพิ่มแผนงานใหม่",
        customClass: "swal-wide",
        html: `
          <label for="eventTitle">ชื่อแผนงาน:</label>
          <input id="eventTitle" type="text" class="swal2-input" placeholder="กรอกชื่อแผนงาน" 
          style="margin-bottom: 1rem; width: 250px">

          <label for="fontSize" style="display: none;">ขนาดตัวอักษร:</label>
          <select id="fontSize" style="display: none;" class="swal2-input">
            <option selected disabled>${defaultFontSize}</option>
            <option value="8">8</option>
            <option value="9">9</option>
            <option value="10">10</option>
            <option value="11">11</option>
            <option value="12">12</option>
            <option value="14">14</option>
            <option value="16">16</option>
            <option value="18">18</option>
            <option value="20">20</option>
            <option value="22">22</option>
            <option value="24">24</option>
            <option value="26">26</option>
            <option value="28">28</option>
            <option value="36">36</option>
            <option value="48">48</option>
            <option value="72">72</option>
          </select><br><br>

          <label for="textColorPicker">สีข้อความ:</label><br>
          <input id="textColorPicker" type="color" value="${defaultTextColor}" style="margin-bottom: 1rem;"><br>

          <label for="backgroundColorPicker">สีพื้นหลัง:</label><br>
          <input id="backgroundColorPicker" type="color" value="${defaultBackgroundColor}" style="margin-bottom: 1rem;"><br>

          <label for="start">วันที่เริ่มต้น:</label>
          <input id="start" type="date" class="swal2-input" value="${arg.dateStr}" style="margin-bottom: 1rem;"><br>

          <label for="end">วันที่สิ้นสุด:</label>
          <input id="end" type="date" class="swal2-input" value="${arg.dateStr}" style="margin-bottom: 1rem;"><br>
        `,
        showCancelButton: true,
        confirmButtonText: "บันทึกแผนงาน",
        cancelButtonText: "ยกเลิก",
        didOpen: () => {
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
          const title = document.getElementById("eventTitle").value;
          const backgroundColor = document.getElementById(
            "backgroundColorPicker"
          ).value;
          const textColor = document.getElementById("textColorPicker").value;
          const fontSize = document.getElementById("fontSize").value;

          if (!title) {
            Swal.showValidationMessage("กรุณากรอกชื่อแผนงาน");
          }

          return {
            title,
            backgroundColor,
            textColor,
            fontSize,
            start,
            end,
          };
        },
      }).then(async (result) => {
        if (result.isConfirmed) {
          const { title, backgroundColor, textColor, fontSize, start, end } =
            result.value;

          const newEnd = moment(end).add(1, "days");
          const newEvent = {
            title,
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
          fetchEventsFromDB(); // โหลดข้อมูลแผนงานใหม่จากฐานข้อมูล
        }
      });
    };

    const handleEditEvent = (eventInfo) => {
      const inputBackgroundColor = document.createElement("input");
      inputBackgroundColor.type = "color";
      inputBackgroundColor.value = eventInfo.event.backgroundColor;

      const inputTextColor = document.createElement("input");
      inputTextColor.type = "color";
      inputTextColor.value = eventInfo.event.textColor;

      const eventId = eventInfo.event.id;
      const eventTitle = eventInfo.event.title;
      const eventFontSize = eventInfo.event.extendedProps.fontSize;

      const eventStart = moment(eventInfo.event.start);
      const eventEnd = moment(eventInfo.event.end);
      const eventAllDay = eventInfo.event.allDay;

      // ✅ แก้ไข: ไม่ใช้ .subtract(1, "days") ตอนแสดงวันที่
      const formattedEnd = eventAllDay
        ? moment(eventEnd).subtract(1, "days").format("YYYY-MM-DDTHH:mm")
        : moment(eventEnd).format("YYYY-MM-DDTHH:mm");

      const htmlEdit = `
      <label for="editTitle">ชื่อแผนงาน:</label>
      <input id="editTitle" class="swal2-input" type="text" value="${eventTitle}"
      style="margin-bottom: 1rem; width: 250px">

      <label for="editFontSize" style="display: none;">ขนาดตัวอักษร:</label>
      <select id="editFontSize" style="display: none;" class="swal2-input">
        <option selected disabled>${eventFontSize}</option>
        <option value="8">8</option>
        <option value="10">10</option>
        <option value="12">12</option>
        <option value="14">14</option>
        <option value="16">16</option>
        <option value="18">18</option>
        <option value="20">20</option>
      </select><br><br>

      <label for="editBackgroundColor">สีพื้นหลัง:</label><br>
      <div id="backgroundColorPickerContainer"></div><br>

      <label for="editTextColor">สีข้อความ:</label><br>
      <div id="textColorPickerContainer" class="swal2-input"></div>

      <label for="editStart">วันที่เริ่มต้น:</label>
      <input id="editStart" type="datetime-local" class="swal2-input" value="${eventStart.format(
        "YYYY-MM-DDTHH:mm"
      )}" style="margin-bottom: 1rem;"><br>

      <label for="editEnd">วันที่สิ้นสุด:</label>
      <input id="editEnd" type="datetime-local" class="swal2-input" value="${formattedEnd}" style="margin-bottom: 1rem;"><br>
    `;

      Swal.fire({
        title: `แก้ไขแผนงาน: ${eventTitle}`,
        html: htmlEdit,
        customClass: "swal-wide",
        showCloseButton: true,
        didOpen: () => {
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
        cancelButtonText: "ยกเลิกแผนงาน",
        preConfirm: () => {
          const title = document.getElementById("editTitle").value;
          const textColor = inputTextColor.value;
          const backgroundColor = inputBackgroundColor.value;
          const fontSize = document.getElementById("editFontSize").value;

          const start = moment(
            document.getElementById("editStart").value
          ).toISOString();
          let end = document.getElementById("editEnd").value;

          if (!end) {
            end = eventEnd.toISOString();
          } else {
            end = eventAllDay
              ? moment(end).add(1, "days").toISOString() // ✅ บวก 1 วันสำหรับ allDay event
              : moment(end).toISOString();
          }

          if (!title) {
            Swal.showValidationMessage("กรุณากรอกชื่อแผนงาน");
          }

          return {
            id: eventId,
            title,
            textColor,
            backgroundColor,
            fontSize,
            start,
            end,
          };
        },
      }).then(async (result) => {
        if (result.isConfirmed) {
          setLoading(true);
          const { id, title, textColor, backgroundColor, fontSize, start, end } =
            result.value;
          const updatedEvent = {
            title,
            textColor,
            backgroundColor,
            fontSize,
            start,
            end,
          };

          await EventService.UpdateEvent(id, updatedEvent);
          fetchEventsFromDB();
          setLoading(false);

          Swal.fire({
            title: "บันทึกการเปลี่ยนแปลงสำเร็จ",
            icon: "success",
            showConfirmButton: false,
            timer: 1000,
          });
        } else if (result.isDenied) {
          handleDeleteEvent(eventId);
        } else if (result.dismiss === Swal.DismissReason.cancel) {
          confirmCancelEvent(eventId);
        }
      });
    };

    const confirmCancelEvent = async (eventId) => {
      Swal.fire({
        title: "ยืนยันการยกเลิกแผนงาน?",
        text: "แผนงานนี้จะถูกนำออกจากปฏิทินและสามารถเพิ่มกลับมาได้ในภายหลัง",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "ใช่, ยกเลิกแผนงาน",
        cancelButtonText: "ไม่, เก็บไว้",
      }).then(async (result) => {
        if (result.isConfirmed) {
          handleCancelEvent(eventId);
        }
      });
    };

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
        // อัปเดตเหตุการณ์ในฐานข้อมูล

        const updatedEvents = await EventService.UpdateEvent(
          event.id,
          updatedEvent
        );

        // อัปเดต events ใน state ของ React component

        setEvents(updatedEvents);

        // ดึงข้อมูลเหตุการณ์จากฐานข้อมูลอีกครั้งเพื่อให้มั่นใจว่าข้อมูลเป็นปัจจุบัน
        fetchEventsFromDB();

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

      const updatedEvents = await EventService.UpdateEvent(
        event.id,
        updatedEvent
      );

      setEvents(updatedEvents);

      fetchEventsFromDB();

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
          const currentMonth = moment(calendarRef.current.getApi().getDate()).month(); // ดึงเดือนปัจจุบันที่กำลังแสดง
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

            <button
              className="btn btn-sm btn-secondary mx-1 "
              onClick={handleLineNotify}
            >
              <FontAwesomeIcon icon={faBell} /> LINE NOTIFY
            </button>
          </Col>
        </Row>
        {isAdmin && (
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
        )}
        {isAdmin && (
          <div
            id="external-events"
            style={{ padding: "8px", background: "#f8f9fa", width: "100%" }}
            className="mb-4"
          >
            <h5 className="mb-2 p-2">แผนงานรอจัดลงตาราง</h5>

            {/* 🔍 ช่องค้นหา */}
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
            </div>
            {/* ✅ แสดงเฉพาะข้อมูลที่ค้นหา พร้อม Pagination */}
            <div className="row row-cols-1 row-cols-md-2 row-cols-lg-4 g-2 p-2">
              {paginatedEvents.map((event) => (
                <div
                  key={event._id || event.id}
                  className="col d-flex align-items-center gap-2 mb-2"
                >
                  {/* 🔹 กล่อง Event */}
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

                  {/* 🔹 ปุ่มลบ */}
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

            {/* ✅ Pagination Controls เฉพาะข้อมูลที่ค้นหา */}
            {totalPages > 1 && (
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
            )}
          </div>
        )}

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
            events={events}
            allDaySlot={true}
            nowIndicator={true}
            selectMirror={true}
            weekends={true}
            contentHeight="auto"
            showNonCurrentDates={false} // ✅ ไม่แสดงวันของเดือนก่อนและหลัง
            firstDay={0} // ✅ กำหนดให้วันอาทิตย์เป็นวันแรกของสัปดาห์

            headerToolbar={{
              left: "prev,next",
              center: "title",
              right: "today",
            }}
            footerToolbar={{
              right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
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
        `}
          </style>
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
