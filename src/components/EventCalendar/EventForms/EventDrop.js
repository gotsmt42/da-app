
export const getEventDrop = async ({
  arg,
  fetchEventsFromDB,
  setEvents,

  EventService,
  Swal,
  moment
}) => {
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
