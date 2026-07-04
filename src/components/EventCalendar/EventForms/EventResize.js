export const getEventResize = async ({
  arg,
  fetchEventsFromDB,
  setEvents,
  EventService,
  moment,
}) => {
  const event = arg.event;

  const start = moment(event.startStr).format("YYYY-MM-DD");
  const endRaw = moment(event.endStr);
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
    console.log("⏸️ ไม่มีการเปลี่ยนแปลงขนาด ไม่ต้องอัปเดต");
    return;
  }

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

    console.log(`✅ Event ${event.id} resized`);
  } catch (error) {
    console.error("❌ Error resizing event:", error);
  }
};
