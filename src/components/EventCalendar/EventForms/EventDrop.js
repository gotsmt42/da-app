import { showTeamOverlapWarning } from "../../../utils/teamOverlapWarning";

export const getEventDrop = async ({
  arg,
  events,
  fetchEventsFromDB,
  setEvents,
  EventService,
  saveEventToDB, // ✅ ใช้เฉพาะตอนกด Alt/Cmd ค้างไว้ระหว่างลาก (ก๊อปปี้ — ดู isCopyDrag ด้านล่าง)
  userData, // ✅ ใช้ตั้งชื่อผู้ทำรายการใน activityLog ตอนย้ายวันที่ปกติ (ดู logEntry ด้านล่าง)
  Swal,
  moment,
}) => {
  const event = arg.event;

  // ✅ กด Alt (Windows/Linux) หรือ Cmd (Mac) ค้างไว้ระหว่างลาก = ก๊อปปี้ไปวางที่วันใหม่ แทนการย้าย
  // งานเดิม — งานต้นฉบับต้องอยู่ที่เดิมไม่ขยับ จึง revert() การลากก่อนเสมอ แล้วค่อยสร้างงานใหม่แยก
  // ต่างหากที่ตำแหน่งที่ปล่อย
  // ⚠️ ตั้งใจใช้ Alt ไม่ใช่ Ctrl: @fullcalendar/interaction เช็ค `ev.button === 0 && !ev.ctrlKey`
  // เพื่อตัดสินว่าเป็นคลิกซ้ายจริงหรือไม่ (จำลอง convention ของ Mac ที่ Ctrl+คลิกซ้าย = คลิกขวา)
  // ทำให้ถ้ากด Ctrl ค้างไว้ตอนกดเมาส์ลง FullCalendar จะไม่เริ่มลากให้เลยตั้งแต่ต้น (ไม่ว่าจะ Windows
  // หรือ Mac ก็ตาม) — eventDragStart/eventDrop ไม่ยิงเลยด้วยซ้ำ ไม่ใช่แค่เช็คค่า ctrlKey ผิดพลาด
  // metaKey (Cmd) ไม่โดนเช็คนี้บล็อก จึงยังใช้ได้ปกติบน Mac
  const isCopyDrag = Boolean(arg.jsEvent?.altKey || arg.jsEvent?.metaKey);
  if (isCopyDrag) {
    arg.revert();

    // ✅ งานผูกสัญญาก๊อปปี้ด้วยการลากไม่ได้ — เหมือนปุ่ม "คัดลอกงานนี้" ใน EditEvent.js (canCopyEvent)
    // กันตัวนับ "ครั้งที่" ที่ใช้ไปแล้วของสัญญาเดิมสับสน/เพี้ยน
    if (event.extendedProps?.contractGroupId) {
      Swal.fire({
        toast: true, position: "top", icon: "info",
        title: "งานผูกสัญญาก๊อปปี้ด้วยการลากไม่ได้",
        showConfirmButton: false, timer: 2500,
      });
      return;
    }

    // ✅ FullCalendar เก็บ start/end แบบ exclusive-end อยู่แล้ว (event.end = วันถัดจากวันสุดท้ายจริง)
    // ตรงกับ contract ที่ getSaveEventToDB/POST events ต้องการพอดี (เทียบ AddEvent.js ที่ต้อง
    // moment(getVal("end")).add(1,"days") เอง เพราะ input ดิบเป็น inclusive) จึงส่งตรงๆ ได้เลย
    // ไม่ต้องแปลงเหมือน updatedEvent.end ด้านล่าง (นั่นสำหรับ UpdateEvent ซึ่งคนละ contract กัน)
    const dupDate = moment(event.start).format("YYYY-MM-DD");
    const dupEnd = moment(event.end || event.start).format("YYYY-MM-DD");

    const duplicatedEvent = {
      company: event.extendedProps?.company || "",
      site: event.extendedProps?.site || "",
      title: event.title || "",
      system: event.extendedProps?.system || "",
      team: event.extendedProps?.team || "",
      resPerson: event.extendedProps?.resPerson || "",
      teamMembers: event.extendedProps?.teamMembers || [],
      backgroundColor: event.backgroundColor || "#3b82f6",
      textColor: event.textColor || "#ffffff",
      fontSize: event.extendedProps?.fontSize || "8",
      startTime: event.extendedProps?.startTime || "",
      endTime: event.extendedProps?.endTime || "",
      jobClassification: event.extendedProps?.jobClassification || "general",
      start: dupDate,
      end: dupEnd,
      date: dupDate,
    };

    try {
      await saveEventToDB(duplicatedEvent);
      await fetchEventsFromDB(true);
      showTeamOverlapWarning({
        Swal, moment, events,
        movedEvent: { id: "new", extendedProps: { resPerson: duplicatedEvent.resPerson, team: duplicatedEvent.team } },
        start: duplicatedEvent.start,
        end: duplicatedEvent.end,
      });
      Swal.fire({
        toast: true, position: "top", icon: "success",
        title: "ก๊อปปี้งานแล้ว ✅ (ต้นฉบับอยู่ที่เดิม)",
        showConfirmButton: false, timer: 2000,
      });
    } catch (error) {
      console.error("❌ Error duplicating event via drag:", error);
      Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถก๊อปปี้แผนงานได้", "error");
    }
    return;
  }

  const start = moment(event.start).format("YYYY-MM-DD");
  const endRaw = moment(event.end);
  const end = event.allDay
    ? endRaw.format("YYYY-MM-DD")
    : endRaw.subtract(1, "days").format("YYYY-MM-DD");

  const updatedEvent = {
    id: event.id,
    // title: event.title,
    // textColor: event.textColor,
    // backgroundColor: event.backgroundColor,
    // fontSize: event.extendedProps?.fontSize?.toString() || "12",
    start,
    end,
    allDay: event.allDay,
  };

  // ตรวจสอบว่า event มีการเปลี่ยนแปลงจริงหรือไม่
  const originalStart = moment(event.extendedProps?.start).format("YYYY-MM-DD");
  const originalEnd = moment(event.extendedProps?.end).format("YYYY-MM-DD");

  const hasChanged = start !== originalStart || end !== originalEnd;

  if (!hasChanged) {
    console.log("⏸️ ไม่มีการเปลี่ยนแปลงวันที่ ไม่ต้องอัปเดต");
    return;
  }

  // ✅ บันทึกประวัติ — เดิมการลากย้ายวันที่งานไม่เคยถูกบันทึกลง activityLog เลย เทียบ pattern
  // เดียวกับ EventResize.js/buildChangeLogEntries ใน EditEvent.js
  const actorName = [userData?.fname, userData?.lname].filter(Boolean).join(" ") || userData?.username || "ผู้ใช้งาน";
  updatedEvent.activityLog = [
    ...(event.extendedProps?.activityLog || []),
    {
      action: "schedule_changed",
      detail: `ลากย้ายวันที่เป็น ${start}${end !== start ? ` – ${end}` : ""}`,
      userName: actorName,
      timestamp: new Date().toISOString(),
    },
  ];

  try {
    await EventService.UpdateEvent(event.id, updatedEvent);

    // อัปเดตทันทีแบบ optimistic ให้เห็นผลไว ๆ ก่อน
    setEvents((prevEvents) =>
      prevEvents.map((e) =>
        e.id === updatedEvent.id ? { ...e, ...updatedEvent } : e
      )
    );

    // แล้วรีเฟรชเงียบ ๆ เพื่อให้ตรงกับข้อมูลจริงบนเซิร์ฟเวอร์เสมอ (เผื่อมีผลข้างเคียงอื่น)
    await fetchEventsFromDB(true);

    // ✅ ไม่บล็อกแล้ว (เดิม backend เช็คช่างชนกันแล้วปฏิเสธ ตัดออกไปแล้ว) แต่ยังแจ้งเตือนเบาๆ ให้รู้ตัว
    showTeamOverlapWarning({ Swal, moment, events, movedEvent: event, start, end });

    console.log(`✅ Event ${event.id} updated`);
  } catch (error) {
    console.error("❌ Error updating event:", error);
    Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถอัปเดตแผนงานได้", "error");
  }
};
