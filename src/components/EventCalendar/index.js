import React, { useState, useEffect, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction"; // for selectable
import timeGridPlugin from "@fullcalendar/timegrid"; // for dayClick
import momentTimezonePlugin from "@fullcalendar/moment-timezone";
import adaptivePlugin from "@fullcalendar/adaptive";

import listPlugin from "@fullcalendar/list";

import Swal from "sweetalert2";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"; // Import FontAwesomeIcon component

import {
  faBell,
  faFileExcel,
  faFilePdf,
} from "@fortawesome/free-solid-svg-icons"; // Import ไอคอนต่างๆ

import EventService from "../../services/EventService";
import moment from "moment";

import { ThreeDots } from "react-loader-spinner";

import generatePDF, { Resolution, Margin } from "react-to-pdf";

import { Col, Row } from "reactstrap";

import { CSVLink } from "react-csv";

function EventCalendar() {
  const [events, setEvents] = useState([]);
  const [defaultAllDay, setdefaultAllDay] = useState(true); // สีข้อความเริ่มต้น
  const [defaultTextColor, setDefaultTextColor] = useState("#FFFFFF"); // สีข้อความเริ่มต้น
  const [defaultBackgroundColor, setDefaultBackgroundColor] =
    useState("#0c49ac"); // สีพื้นหลังเริ่มต้น
  const [defaultFontSize, setDefaultFontSize] = useState(11); // สีพื้นหลังเริ่มต้น

  const [loading, setLoading] = useState(false); // เพิ่มสถานะการโหลด

  const componentRef = useRef();

  useEffect(() => {
    fetchEventsFromDB(); // Fetch events when component mounts
  }, []);

  const saveEventToDB = async (newEvent) => {
    try {
      await EventService.AddEvent(newEvent);
    } catch (error) {
      console.error("Error saving event:", error);
    }
  };

  const fetchEventsFromDB = async () => {
    setLoading(true);

    try {
      const res = await EventService.getEvents();
      const eventsWithId = res.userEvents.map((event) => ({
        ...event,
        id: event._id,
      }));
      setEvents(eventsWithId);

      setLoading(false);
    } catch (error) {
      console.error("Error fetching events:", error);
      setLoading(false);
    }
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

        <label for="fontSize">All-Day: </label>
        <select id="allDay" class="swal2-select">
        
          <option value="${defaultAllDay}">${defaultAllDay}</option>
          <option value="false">False</option>
         
        </select><br><br><br>


  
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
        const allDay = document.getElementById("allDay").value;
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
          allDay,
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
          allDay,
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
          allDay,
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

    <span style='color:red'; font-size: 2px>ถ้าต้องการตั้งระยะเวลาของเหตุการณ์ กรุณาตั้งค่า All-Day เป็น False ก่อน</span> <br><br>
    <label for="editAllDay">All-Day : </label>
    <select id="editAllDay" class="swal2-select">
      <option selected disabled>${eventAllDay}</option>
      <option value="true">True</option>
      <option value="false">False</option>
    </select><br><br>
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

        const isAllDay = document.getElementById("editAllDay").value === "true";

        const start = moment(
          document.getElementById("editStart").value
        ).toISOString();
        let end = document.getElementById("editEnd").value;

        if (end === "null" || end === "") {
          // If end is null or empty, set end to original event end
          end = eventEnd.toISOString();
        } else {
          if (!isAllDay) {
            // Convert end to datetime format
            end = moment(end).toISOString();
          } else {
            end = moment(end).add(1, "days").toISOString();
          }
        }

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
          allDay: isAllDay,
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
          allDay,
        } = result.value;

        const updatedEvent = {
          title,
          textColor,
          backgroundColor,
          fontSize,
          start,
          end,
          allDay,
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

          Swal.fire({
            title: "Deleted!",
            text: "Your file has been deleted.",
            icon: "success",
          });
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
                ? Object.keys(events).map((event) => ({
                    Title: event.title,
                    Date: event.date,
                    Start: event.start,
                    End: event.end,
                    AllDay: event.allDay,
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

      <div id="content-id">
        <FullCalendar
          ref={calendarRef}
          // schedulerLicenseKey="<YOUR-LICENSE-KEY-GOES-HERE>" //FullCalendar Premium
          contentHeight="auto" // กำหนดให้ความสูงของตารางปรับเป็นอัตโนมัติ
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
          editable={true}
          events={events}
          dateClick={handleAddEvent}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          allDaySlot={true}
          nowIndicator={true}
          selectMirror={true}
          weekends={true}
          // slotLabelFormat={{
          //   hour: "2-digit",
          //   minute: "2-digit",
          //   omitZeroMinute: false,
          //   hour12: false,
          // }}

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
                      whiteSpace: "nowrap",
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
                  backgroundColor: eventInfo.event.backgroundColor,

                  color: eventInfo.event.textColor,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  border: "3px solid",
                  borderRadius: "20px",
                }}
              >
                <span
                  style={{
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    margin: "auto",
                    padding: "5px",
                    fontSize: eventInfo.event.extendedProps.fontSize,
                  }}
                >
                  {eventInfo.event.allDay === false ? (
                    <span
                      style={{
                        whiteSpace: "nowrap",
                        fontSize: eventInfo.event.extendedProps.fontSize,
                      }}
                    >
                      {eventInfo.event.title}
                    </span>
                  ) : (
                    <span
                      style={{
                        whiteSpace: "nowrap",
                        fontSize: eventInfo.event.extendedProps.fontSize,
                      }}
                    >
                      {eventInfo.event.title}
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}
          eventClick={handleEditEvent}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
          }}
          dayMaxEventRows={true} // ใช้งานการแสดงเหตุการณ์ที่ยาวนานใน dayGridMonth
          views={{
            listWeek: {
              dayMaxEventRows: window.innerWidth >= 576 ? 5 : 3,
            },
            dayGridMonth: {
              dayMaxEventRows: window.innerWidth >= 576 ? 5 : 3,
            },
            timeGridWeek: {
              dayMaxEventRows: window.innerWidth >= 576 ? 5 : 3,
            },
            timeGridDay: {
              dayMaxEventRows: window.innerWidth >= 576 ? 5 : 3,
            },
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
