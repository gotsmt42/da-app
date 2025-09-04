
export const getEventResize = async ({
  arg,
  fetchEventsFromDB,
  setEvents,
  EventService,
  moment
}) => {
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

};
