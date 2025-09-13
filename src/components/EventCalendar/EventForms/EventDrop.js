export const getEventDrop = async ({
  arg,
  fetchEventsFromDB,
  setEvents,
  EventService,
  Swal,
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
    console.log("⏸️ ไม่มีการเปลี่ยนแปลงวันที่ ไม่ต้องอัปเดต");
    return;
  }

  try {
    await EventService.UpdateEvent(event.id, updatedEvent);

    // อัปเดตเฉพาะ event ที่เปลี่ยนใน state
    setEvents((prevEvents) =>
      prevEvents.map((e) =>
        e.id === updatedEvent.id ? { ...e, ...updatedEvent } : e
      )
    );

    console.log(`✅ Event ${event.id} updated`);
    // ไม่ต้อง fetchEventsFromDB ถ้าเราอัปเดต state แล้ว
  } catch (error) {
    console.error("❌ Error updating event:", error);
    Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถอัปเดตแผนงานได้", "error");
  }
};
