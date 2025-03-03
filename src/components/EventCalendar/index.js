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

function EventCalendar() {
  const [events, setEvents] = useState([]);
  const [newEventTitle, setNewEventTitle] = useState(""); // State สำหรับ input

  const [eventReceive, setEventReceive] = useState([]);
  const [defaultAllDay, setdefaultAllDay] = useState(true); // สีข้อความเริ่มต้น
  const [defaultTextColor, setDefaultTextColor] = useState("#FFFFFF"); // สีข้อความเริ่มต้น
  const [defaultBackgroundColor, setDefaultBackgroundColor] =
    useState("#0c49ac"); // สีพื้นหลังเริ่มต้น

  const [defaultFontSize, setDefaultFontSize] = useState(8); //

  const [loading, setLoading] = useState(false); // เพิ่มสถานะการโหลด

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
      // console.log(`🗑 Attempting to delete event ID: ${eventId}`); // ตรวจสอบว่า ID ถูกส่งมาหรือไม่

      const response = await API.delete(`/eventReceive/${eventId}`);

      // console.log("📩 Response from server:", response);

      if (response.status === 200) {
        // console.log(`✅ Event ${eventId} deleted successfully`);
      } else {
        console.warn(
          `⚠ Event ${eventId} deletion failed, status: ${response.status}`
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

      // ✅ ดึง `_id` ของ event ที่ถูกลาก
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

      // ✅ ลบข้อมูลจากฐานข้อมูลก่อนที่จะบันทึก event ใหม่
      await deleteEventFromDB(eventIdToDelete);

      // ✅ ลบอีเวนต์ออกจาก `eventReceive`
      setEventReceive((prevEvents) =>
        prevEvents.filter((event) => event._id !== eventIdToDelete)
      );

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
        end: endDate, // ✅ กำหนดค่า end เสมอ
        date: startDate, // ✅ เพิ่ม date ให้ตรงกับ Schema
        allDay: droppedEvent.allDay ?? true,
      };

      // console.log("✅ New Event Data:", newEvent);

      // ✅ บันทึกอีเวนต์ใหม่ลงฐานข้อมูล
      const response = await saveEventToDB(newEvent);

      if (response && response._id) {
        newEvent._id = response._id;
        newEvent.extendedProps = { _id: response._id };
      }

      // ✅ อัปเดต events ใน FullCalendar
      setEvents((prevEvents) => [...prevEvents, newEvent]);

      // โหลดข้อมูลใหม่จากฐานข้อมูล
      await fetchEventReceiveFromDB();
      await fetchEventsFromDB();
    } catch (error) {
      console.error("❌ Error in handleEventReceive:", error);
    } finally {
      isProcessing = false;
    }
  };
  const handleAddEventToCalendar = async (eventData) => {
    Swal.fire({
      title: `${eventData.title || "Untitled Event"}`, // ✅ แสดงชื่ออีเวนต์ที่ถูกคลิก
      html: `
        <label for="startDate">Start Date:</label>
        <input id="startDate" type="date" class="swal2-input" style="margin-bottom: 1rem; width: 250px">
    
        <label for="endDate">End Date:</label>
        <input id="endDate" type="date" class="swal2-input" style="margin-bottom: 1rem; width: 250px">
      `,
      showCancelButton: true,
      confirmButtonText: "Add Event",
      preConfirm: () => {
        const startDate = document.getElementById("startDate").value;
        const endDate = document.getElementById("endDate").value;

        if (!startDate || !endDate) {
          Swal.showValidationMessage("กรุณาระบุวันที่เริ่มต้นและวันที่สิ้นสุด");
          return false;
        }

        if (moment(endDate).isBefore(moment(startDate))) {
          Swal.showValidationMessage("วันที่สิ้นสุดต้องอยู่หลังวันที่เริ่มต้น");
          return false;
        }

        return { startDate, endDate };
      },
    }).then(async (result) => {
      if (result.isConfirmed) {
        const { startDate, endDate } = result.value;

        if (!startDate || !endDate) {
          Swal.fire("Error", "Start date and end date are required!", "error");
          return;
        }

        const start = moment(startDate).format("YYYY-MM-DD");
        const end = moment(endDate).add(1, "days").format("YYYY-MM-DD"); // ✅ เพิ่ม 1 วันเพื่อให้สิ้นสุดวันสุดท้าย

        // ✅ ตรวจสอบค่าก่อนบันทึก
        // console.log("📅 New Event Data:", { start, end, date: start });

        // ✅ เพิ่ม Event ลง FullCalendar
        const newEvent = {
          title: eventData.title,
          start: start,
          end: end,
          date: start, // ✅ ต้องมี date เพื่อให้ Mongoose ไม่ error
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

          // ✅ ลบ Event ออกจาก `eventReceive`
          setEventReceive((prevEvents) =>
            prevEvents.filter((event) => event._id !== eventData._id)
          );

          // ✅ ลบออกจากฐานข้อมูลของ `eventReceive`
          await deleteEventFromDB(eventData._id);

          Swal.fire({
            title: "Added!",
            text: "Event added successfully.",
            icon: "success",
            timer: 1500,
            showConfirmButton: false,
          });

          // ✅ โหลดข้อมูลใหม่จากฐานข้อมูล
          await fetchEventsFromDB();
        } catch (error) {
          console.error("❌ Error adding event:", error);
          Swal.fire("Error", "Failed to add event. Please try again.", "error");
        }
      }
    });
  };

  const handleDeleteEventReceive = async (eventId) => {
    try {
      Swal.fire({
        title: "Are you sure?",
        text: "You won't be able to undo this action!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Yes, delete it!",
        cancelButtonText: "Cancel",
      }).then(async (result) => {
        if (result.isConfirmed) {
          // ✅ ลบข้อมูลออกจากฐานข้อมูล
          await deleteEventFromDB(eventId);
  
          // ✅ อัปเดต state eventReceive (ลบอีเวนต์ที่ถูกลบออก)
          setEventReceive((prevEvents) => {
            const updatedEvents = prevEvents.filter((event) => event._id !== eventId);
  
            // ✅ ตรวจสอบว่าเหลือข้อมูลในหน้าปัจจุบันหรือไม่
            const totalItemsLeft = updatedEvents.length;
            const maxPages = Math.ceil(totalItemsLeft / eventsPerPage);
  
            if (totalItemsLeft <= startIndex && currentPage > 1) {
              setCurrentPage(Math.max(1, currentPage - 1)); // ✅ กลับไปหน้าก่อนหน้า
            }
  
            return updatedEvents;
          });
  
          // Swal.fire({
          //   title: "Deleted!",
          //   text: "The event has been deleted.",
          //   icon: "success",
          //   timer: 1500,
          //   showConfirmButton: false,
          // });
        }
      });
    } catch (error) {
      console.error("❌ Error deleting event:", error);
      Swal.fire({
        title: "Error!",
        text: "Failed to delete event. Please try again.",
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
      title: "Enter for your event : ",
      customClass: "swal-wide",
      html: `

      <label for="editTitle">Title : </label>

      <input id="eventTitle" type="text" class="swal2-input"  placeholder="Event Title"  style="margin-bottom: 1rem; width: 250px"> <br>


        <label for="fontSize">Font Size:</label><br>
        <select id="fontSize" class="swal2-input">
        
          <option selected disabled>${defaultFontSize}</option>
          <option value="8">8</option>
          <option value="9">9</option>
          <option value="10">10</option>
          <option value="11">11</option>
          <option value="12" >12</option>
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

        <label for="textColorPicker">Text Color:</label><br>
        <input id="textColorPicker" type="color" value="${defaultTextColor}" style="margin-bottom: 1rem;"><br>
  
        <label for="backgroundColorPicker">Background Color:</label><br>
        <input id="backgroundColorPicker" type="color" value="${defaultBackgroundColor}" style="margin-bottom: 1rem;"><br>
  
        <label for="start">Start:</label>
        <input id="start" type="date" class="swal2-input" value="${arg.dateStr}" style="margin-bottom: 1rem;"><br>
  
        <label for="end">End:</label>
        <input id="end" type="date" class="swal2-input"  value="${arg.dateStr}" style="margin-bottom: 1rem;"><br>

        <br><br><br>


  
      `,
      showCancelButton: true,
      confirmButtonText: "Save",
      cancelButtonText: "Cancel",
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

        // const startTime = document.getElementById("startTime").value;
        // const endTime = document.getElementById("endTime").value;

        const title = document.getElementById("eventTitle").value;
        const backgroundColor = document.getElementById(
          "backgroundColorPicker"
        ).value;
        const textColor = document.getElementById("textColorPicker").value;
        const fontSize = document.getElementById("fontSize").value;
        if (!title) {
          Swal.showValidationMessage("Please enter a title");
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
        const {
          title,
          backgroundColor,
          textColor,
          fontSize,
          start,
          end,
        } = result.value;

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
        setEvents([...events, newEvent]); // Update local state
        await saveEventToDB(newEvent); // Save event to database
        setDefaultTextColor(textColor);
        setDefaultBackgroundColor(backgroundColor);
        setDefaultFontSize(fontSize);
        fetchEventsFromDB(); // Fetch events from database
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

    const htmlEdit = `
    <input id="editTitle" class="swal2-input" type="text" value="${eventTitle}" 
    style="margin-bottom: 1rem; width: 250px"><i id="copyEventDetails" title="Copied to clipboard!" class="fas fa-copy"></i>
    
    <br>

    <label for="editFontSize">Font Size : </label><br>
    <select id="editFontSize" class="swal2-input">
      <option selected disabled>${eventFontSize}</option>
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

    <label for="editBackgroundColor">Background Color : </label><br>
    <div id="backgroundColorPickerContainer"></div><br>

    <label for="editTextColor">Text Color : </label><br>
    <div id="textColorPickerContainer" class="swal2-input"></div>

    <label for="editStart">Start : </label>
    <input id="editStart" type="datetime-local" class="swal2-input" value="${eventStart.format(
      "YYYY-MM-DDTHH:mm"
    )}" style="margin-bottom: 1rem;"><br>

    <label for="fakeEditEnd">End :</label>
    <input id="fakeEditEnd" type="datetime-local" class="swal2-input" value="${
      eventAllDay
        ? moment(eventEnd).subtract(1, "days").format("YYYY-MM-DDTHH:mm")
        : eventEnd.format("YYYY-MM-DDTHH:mm")
    }" style="margin-bottom: 1rem;"><br>

    <input id="editEnd" type="datetime-local" class="swal2-input" style="display: none; margin-bottom: 1rem;"><br>

   
  `;

    Swal.fire({
      title: eventTitle,
      html: htmlEdit,
      customClass: "swal-wide",
      didOpen: () => {
        document
          .getElementById("backgroundColorPickerContainer")
          .appendChild(inputBackgroundColor);
        document
          .getElementById("textColorPickerContainer")
          .appendChild(inputTextColor);

        // สร้างการจัดการเหตุการณ์สำหรับปุ่มคัดลอกรายละเอียด
        document
          .getElementById("copyEventDetails")
          .addEventListener("click", () => {
            const details = `${eventTitle}`;
            copyToClipboard(details);

            Swal.fire({
              title: "Copied",
              icon: "success",
              showConfirmButton: false,
              timer: 1000,
            });
          });

        // Handle change event for fakeEditEnd and update editEnd value
        document
          .getElementById("fakeEditEnd")
          .addEventListener("change", (e) => {
            const newEndDate = moment(e.target.value); // สร้างวัตถุ Moment จาก string

            const formattedNewEnd = newEndDate.format("YYYY-MM-DDTHH:mm:ss"); // จัดรูปแบบวันที่

            document.getElementById("editEnd").value = formattedNewEnd; // กำหนดค่าให้กับ editEnd
          });
      },
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonColor: "#0ECC00",
      confirmButtonText: "Save Update",
      denyButtonText: `Delete Event`,
      preConfirm: () => {
        const title = document.getElementById("editTitle").value;
        const textColor = inputTextColor.value;
        const backgroundColor = inputBackgroundColor.value;
        const fontSize = document.getElementById("editFontSize").value;

        // const isAllDay = document.getElementById("editAllDay").value === "true";

        const start = moment(
          document.getElementById("editStart").value
        ).toISOString();
        let end = document.getElementById("editEnd").value;

        if (end === "null" || end === "") {
          // If end is null or empty, set end to original event end
          end = eventEnd.toISOString();
         } 
        // else {
        //   if (!isAllDay) {
        //     // Convert end to datetime format
        //     end = moment(end).toISOString();
        //   } else {
        //     end = moment(end).add(1, "days").toISOString();
        //   }
        // }

        if (!title) {
          Swal.showValidationMessage("Please enter a title");
        }

        return {
          id: eventId,
          title,
          textColor,
          backgroundColor,
          fontSize,
          start,
          end,
          // allDay: isAllDay,
        };
      },
    }).then(async (result) => {
      if (result.isConfirmed) {
        setLoading(true); // เริ่มต้นโหลดข้อมูล

        const {
          id,
          title,
          textColor,
          backgroundColor,
          fontSize,
          start,
          end,
          // allDay,
        } = result.value;

        const updatedEvent = {
          title,
          textColor,
          backgroundColor,
          fontSize,
          start,
          end,
          // allDay,
        };

        const updatedEvents = await EventService.UpdateEvent(id, updatedEvent);

        setEvents(updatedEvents);

        fetchEventsFromDB();

        setLoading(false); // เริ่มต้นโหลดข้อมูล

        Swal.fire({
          title: "Updated Successfully",
          icon: "success",
          showConfirmButton: false,
          timer: 1000,
        });
      } else if (result.isDenied) {
        handleDeleteEvent(eventId);
      }
    });
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
        title: "Are you sure?",
        text: "You won't be able to revert this!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Yes, delete it!",
      }).then(async (result) => {
        if (result.isConfirmed) {
          setLoading(true); // เริ่มต้นโหลดข้อมูล

          // Send DELETE request to server with event ID
          await EventService.DeleteEvent(id);
          // Update events state after deletion
          const updatedEvents = events.filter((event) => event._id !== id);
          setEvents(updatedEvents);
          await fetchEventsFromDB();

          setLoading(false);

          // Swal.fire({
          //   title: "Deleted!",
          //   text: "Your file has been deleted.",
          //   icon: "success",
          // });
        }
      });
    } catch (error) {
      console.error("Error deleting event:", error);
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
  

// ✅ คำนวณ Pagination
const startIndex = (currentPage - 1) * eventsPerPage;
const endIndex = startIndex + eventsPerPage;
const currentEvents = sortedEvents.slice(startIndex, endIndex);

// ✅ ปรับจำนวนหน้าหลังจากลบข้อมูลออก
const totalPages = Math.ceil(sortedEvents.length / eventsPerPage);
if (currentPage > totalPages && totalPages > 0) {
  setCurrentPage(totalPages);
}

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
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

      <div
        className="card p-4 mb-4"
        style={{ background: "#f8f9fa", borderRadius: "10px" }}
      >
        <h4 className="mb-3">เพิ่มแผนงานใหม่</h4>
        <form onSubmit={handleAddEventReceive} className="d-flex gap-3">
          <input
            type="text"
            className="form-control"
            placeholder="Enter event title"
            value={newEventTitle} // ✅ ใช้ value เพื่อให้ state อัปเดตทันที
            onChange={(e) => setNewEventTitle(e.target.value)}
          />

          <button type="submit" className="btn btn-primary">
            Add Event
          </button>
        </form>
      </div>

      <div
        id="external-events"
        style={{ padding: "10px", background: "#f8f9fa" }}
        className="mb-5"
      >
        <h4 className="mb-3">แผนงานใหม่รอจัดลงตาราง :</h4>

        <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-2">
          {currentEvents.map((event) => (
            <div
              key={event._id || event.id || Math.random()}
              className="col d-flex align-items-center"
            >
              <div
                className="fc-event flex-grow-1 text-white d-flex align-items-center px-3 py-2"
                data-event-id={event._id || event.id}
                onClick={() => handleAddEventToCalendar(event)}
                style={{
                  background: event.backgroundColor || "#0c49ac",
                  borderRadius: "5px",
                  minWidth: "120px",
                  maxWidth: "100%",
                  overflow: "hidden",
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "center",
                  }}
                >
                  {event.title}
                </span>
              </div>

              {/* ปุ่มลบอีเวนต์ */}
              <button
                className="btn btn-danger btn-sm ms-2 d-flex align-items-center justify-content-center"
                onClick={() => handleDeleteEventReceive(event._id || event.id)}
                style={{ width: "30px", height: "30px", borderRadius: "50%" }}
              >
                <FontAwesomeIcon icon={faTimes} className="text-white" />
              </button>
            </div>
          ))}
        </div>

        {/* ✅ Pagination Controls */}
        {totalPages > 1 && (
          <div className="d-flex justify-content-center mt-3">
            <button
              className="btn btn-outline-primary me-2"
              onClick={handlePrevPage}
              disabled={currentPage === 1}
            >
              « Previous
            </button>
            <span className="mx-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="btn btn-outline-primary ms-2"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
            >
              Next »
            </button>
          </div>
        )}
      </div>

      <div id="content-id" style={{ flex: 1 }}>
        <FullCalendar
          ref={calendarRef}
          contentHeight="auto"
          timeZone="local"
          plugins={[
            dayGridPlugin,
            interactionPlugin,
            timeGridPlugin,
            momentTimezonePlugin,
            listPlugin,
          ]}
          initialView="dayGridMonth"
          selectable={true}
          editable={true} // ✅ ให้สามารถลาก event ได้
          droppable={true} // ✅ เปิดให้ลาก event จากภายนอกลงใน calendar ได้
          eventReceive={handleEventReceive} // ✅ จับ event ที่ถูกลากลงมา
          events={events} // ✅ ใช้ state events
          dateClick={handleAddEvent}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          allDaySlot={true}
          nowIndicator={true}
          selectMirror={true}
          weekends={true}
          eventContent={(eventInfo) => (
            <div>
              {eventInfo.event.allDay === false ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                      margin: "auto",
                      padding: "2px",
                      fontSize: "11px",
                    }}
                  >
                    {moment(eventInfo.event.startStr).format("HH:mm")} -{" "}
                    {moment(eventInfo.event.endStr).format("HH:mm")}
                  </span>
                </div>
              ) : null}
              <div
                style={{
                  backgroundColor: eventInfo.event.backgroundColor, // เปลี่ยนสีพื้นหลังสำหรับวันหยุด
                  color: eventInfo.event.textColor, // เปลี่ยนสีข้อความสำหรับวันหยุด
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  padding: "5px",
                  borderRadius: "5px",
                  flexDirection: "column",
                  // เพิ่มเงาหรือการจัดระเบียบที่แตกต่างถ้าต้องการ
                  boxShadow: eventInfo.event.allDay
                    ? "0 0 20px rgba(0, 0, 0, 0.2)"
                    : "none", // เพิ่มเงาเฉพาะสำหรับวันหยุด
                }}
              >
                {window.innerWidth >= 768 ? (
                  <span
                    style={{
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                      margin: "auto",
                      fontSize: isNaN(eventInfo.event.extendedProps.fontSize)
                        ? 12
                        : eventInfo.event.extendedProps.fontSize + 4, // Default to 14 if NaN
                      display: "block",
                    }}
                  >
                    {eventInfo.event.title}
                  </span>
                ) : (
                  <span
                    style={{
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                      margin: "auto",
                      fontSize: isNaN(eventInfo.event.extendedProps.fontSize)
                        ? 8
                        : eventInfo.event.extendedProps.fontSize, // Default to 14 if NaN
                      display: "block",
                    }}
                  >
                    {eventInfo.event.title}
                  </span>
                )}
              </div>
            </div>
          )}
          eventClick={handleEditEvent}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
          }}
          dayMaxEventRows={true}
          views={{
            listWeek: {
              dayMaxEventRows: window.innerWidth >= 576 ? 7 : 5,
            },
            dayGridMonth: {
              dayMaxEventRows: window.innerWidth >= 576 ? 7 : 5,
            },
            timeGridWeek: {
              dayMaxEventRows: window.innerWidth >= 576 ? 7 : 5,
            },
            timeGridDay: {
              dayMaxEventRows: window.innerWidth >= 576 ? 7 : 5,
            },
          }}
          dayCellDidMount={(info) => {
            // เช็คว่าวันนี้เป็นวันเสาร์หรือวันอาทิตย์หรือไม่
            const date = info.date;
            const isSaturday = date.getUTCDay() === 5; // 6 = Saturday
            const isSunday = date.getUTCDay() === 6; // 0 = Sunday

            if (isSaturday || isSunday) {
              // ถ้าเป็นวันเสาร์หรือวันอาทิตย์
              info.el.style.backgroundColor = "#FFFFF4"; // สีพื้นหลังสำหรับวันเสาร์-อาทิตย์
            }
          }}
        />
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
